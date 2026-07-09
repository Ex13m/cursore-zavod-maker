import { createServer } from 'node:http'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { DATA_DIR, readJson } from './lib/paths.js'
import { readQueue, upsertQueueItem, removeQueueItem, publishQueue } from './publish.js'
import { promptToCursor } from './chat.js'
import { imagegenAvailable, generateCursorSprite, extractDrawRequest } from './imagegen.js'
import { addUsage } from './lib/usage.js'

/**
 * Local dev API — mirrors the Netlify Functions endpoints so the portal works
 * identically in `npm run dev` and in production. Zero dependencies (node:http).
 */

const PORT = Number(process.env.PORT) || 8787

const json = (res, code, value) => {
  res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
  res.end(JSON.stringify(value))
}

const readBody = (req) =>
  new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')) } catch { resolve({}) }
    })
  })

/** Мутации и чат — только с ключом владельца (если ZAVOD_ADMIN_KEY задан). */
const authorized = (req) => {
  const key = process.env.ZAVOD_ADMIN_KEY
  return !key || req.headers['x-zavod-key'] === key
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`)
  const path = url.pathname

  try {
    // Static factory data (in production these files ship with the portal build).
    if (req.method === 'GET' && path.startsWith('/data/')) {
      const file = join(DATA_DIR, path.slice('/data/'.length))
      if (!file.startsWith(DATA_DIR) || !existsSync(file)) return json(res, 404, { error: 'not found' })
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' })
      return res.end(readFileSync(file))
    }

    if (path === '/api/health') {
      return json(res, 200, {
        ok: true,
        gumroad: Boolean(process.env.GUMROAD_ACCESS_TOKEN),
        anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
        replicate: imagegenAvailable(),
        resend: Boolean(process.env.RESEND_API_KEY),
      })
    }

    // dev пишет расход в файл (/data/usage.json) — runtime-часть тут нулевая,
    // чтобы портал (файл + runtime) не посчитал дважды
    if (path === '/api/policy' && req.method === 'GET') {
      const { canPublish, dailyLimit, publishedToday, POLICY } = await import('./lib/policy.js')
      const today = new Date().toISOString().slice(0, 10)
      return json(res, 200, { today, limit: dailyLimit(today), used: publishedToday(today), gate: canPublish(today), policy: POLICY })
    }

    if (path === '/api/usage' && req.method === 'GET') {
      return json(res, 200, { anthropic: { requests: 0, inputTokens: 0, outputTokens: 0 }, replicate: { images: 0 }, updatedAt: null })
    }

    if (path === '/api/queue' && req.method === 'GET') return json(res, 200, readQueue())

    // Всё ниже — мутации или расход токенов: под ключ.
    if (!authorized(req) && path.startsWith('/api/')) {
      return json(res, 401, { error: 'нужен ключ владельца (X-Zavod-Key)' })
    }

    if (path === '/api/queue' && req.method === 'POST') {
      const body = await readBody(req)
      if (!body.id || !body.name || !Array.isArray(body.effects)) {
        return json(res, 400, { error: 'id, name, effects are required' })
      }
      return json(res, 200, upsertQueueItem({ ...body, status: 'queued' }))
    }
    if (path.startsWith('/api/queue/') && req.method === 'DELETE') {
      return json(res, 200, { ok: removeQueueItem(path.split('/').pop()) })
    }

    if (path === '/api/publish' && req.method === 'POST') {
      return json(res, 200, await publishQueue())
    }

    // ручное управление заводом: локально выполняем фабрику прямо в процессе
    if (path === '/api/factory' && req.method === 'POST') {
      const { action, hour, minute } = await readBody(req)
      if (action === 'trends') {
        const { runTrendScout } = await import('./trends.js')
        const t = await runTrendScout()
        return json(res, 200, { ok: true, message: `тренды обновлены: ${t.notes.join(' · ')}` })
      }
      if (action === 'regenerate') {
        const { runTrendScout } = await import('./trends.js')
        const { produceDrop } = await import('./produce.js')
        await runTrendScout()
        const drop = await produceDrop(undefined, { force: true })
        return json(res, 200, { ok: true, message: `дроп ${drop.date} перегенерирован: ${drop.items.length} шт, тревог ${drop.alarms.length}. Обнови страницу.` })
      }
      if (action === 'schedule') {
        const { readFileSync, writeFileSync } = await import('node:fs')
        const { join } = await import('node:path')
        const { ROOT_DIR } = await import('./lib/paths.js')
        const file = join(ROOT_DIR, '.github', 'workflows', 'daily-factory.yml')
        const yml = readFileSync(file, 'utf8')
        const next = yml.replace(/- cron: '\d+ \d+ \* \* \*'/, `- cron: '${minute ?? 0} ${hour ?? 7} * * *'`)
        writeFileSync(file, next, 'utf8')
        return json(res, 200, { ok: true, message: `расписание в workflow-файле: ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} UTC — закоммить и запушь.` })
      }
      return json(res, 400, { error: 'unknown action' })
    }

    if (path === '/api/chat' && req.method === 'POST') {
      const { prompt } = await readBody(req)
      if (!prompt) return json(res, 400, { error: 'prompt required' })
      const result = await promptToCursor(prompt)
      // Optional Replicate sprite when the prompt asks to draw something.
      const subject = extractDrawRequest(prompt)
      if (subject && imagegenAvailable()) {
        try {
          const sprite = await generateCursorSprite(subject)
          result.item.effects = result.item.effects.filter((e) => e.type !== 'image')
          result.item.effects.push({ type: 'image', options: { src: sprite.url, size: 44, spin: 0, pulse: 0.08 } })
          result.sprite = sprite
          addUsage({ replicate: { images: 1 } })
        } catch (err) {
          result.notes = [...(result.notes ?? []), `replicate degraded: ${err.message}`]
        }
      }
      if (result.usage) addUsage(result.usage)
      return json(res, 200, result)
    }

    json(res, 404, { error: 'not found' })
  } catch (err) {
    json(res, 500, { error: String(err) })
  }
})

server.listen(PORT, () => {
  console.log(`[devserver] http://localhost:${PORT}`)
  console.log(`[devserver] keys: gumroad=${!!process.env.GUMROAD_ACCESS_TOKEN} anthropic=${!!process.env.ANTHROPIC_API_KEY} replicate=${imagegenAvailable()} resend=${!!process.env.RESEND_API_KEY}`)
})
