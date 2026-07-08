import { promptToCursor } from '../../factory/chat.js'
import { imagegenAvailable, generateCursorSprite, extractDrawRequest } from '../../factory/imagegen.js'

/** Workshop chat: prompt → cursor spec (serverless twin of devserver /api/chat). */

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
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
    } catch (err) {
      result.notes = [...(result.notes ?? []), `replicate degraded: ${err.message}`]
    }
  }
  return Response.json(result)
}

export const config = { path: '/api/chat' }
