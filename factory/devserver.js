import { createServer } from 'node:http'
import { join } from 'node:path'
import { readFileSync, existsSync } from 'node:fs'
import { DATA_DIR, readJson } from './lib/paths.js'
import { readQueue, upsertQueueItem, removeQueueItem, publishQueue } from './publish.js'
import { promptToCursor } from './chat.js'
import { imagegenAvailable, generateCursorSprite, extractDrawRequest } from './imagegen.js'

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
        } catch (err) {
          result.notes = [...(result.notes ?? []), `replicate degraded: ${err.message}`]
        }
      }
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
