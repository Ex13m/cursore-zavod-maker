import { getStore } from '@netlify/blobs'
import { promptToCursor } from '../../factory/chat.js'
import { imagegenAvailable, generateCursorSprite, extractDrawRequest } from '../../factory/imagegen.js'

/** Workshop chat: prompt → cursor spec (serverless twin of devserver /api/chat). */

/** Runtime-учёт расхода токенов в Blobs (файловая часть пишется фабрикой в CI). */
async function recordUsage(delta) {
  try {
    const s = getStore('zavod-usage')
    const u = (await s.get('usage', { type: 'json' })) ?? {
      anthropic: { requests: 0, inputTokens: 0, outputTokens: 0 },
      replicate: { images: 0 },
    }
    if (delta.anthropic) {
      u.anthropic.requests += delta.anthropic.requests ?? 0
      u.anthropic.inputTokens += delta.anthropic.inputTokens ?? 0
      u.anthropic.outputTokens += delta.anthropic.outputTokens ?? 0
    }
    if (delta.replicate) u.replicate.images += delta.replicate.images ?? 0
    u.updatedAt = new Date().toISOString()
    await s.setJSON('usage', u)
  } catch (err) {
    console.warn('[usage] not recorded:', err.message)
  }
}

/** Чат тратит Anthropic/Replicate токены владельца — тоже под ключ. */
const authorized = (req) => {
  const key = process.env.ZAVOD_ADMIN_KEY
  return !key || req.headers.get('x-zavod-key') === key
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
  if (!authorized(req)) {
    return Response.json({ error: 'нужен ключ владельца (X-Zavod-Key)' }, { status: 401 })
  }
  const { prompt } = await req.json().catch(() => ({}))
  if (!prompt) return Response.json({ error: 'prompt required' }, { status: 400 })

  const result = await promptToCursor(prompt)
  const subject = extractDrawRequest(prompt)
  if (subject && imagegenAvailable()) {
    try {
      const sprite = await generateCursorSprite(subject)
      result.item.effects = result.item.effects.filter((e) => e.type !== 'image')
      result.item.effects.push({ type: 'image', options: { src: sprite.url, size: 44, spin: 0, pulse: 0.08 } })
      result.sprite = sprite
      await recordUsage({ replicate: { images: 1 } })
    } catch (err) {
      result.notes = [...(result.notes ?? []), `replicate degraded: ${err.message}`]
    }
  }
  if (result.usage) await recordUsage(result.usage)
  return Response.json(result)
}

export const config = { path: '/api/chat' }
