import { getStore } from '@netlify/blobs'

/**
 * Реальный расход AI-токенов: runtime-часть из Blobs (чат/спрайты на проде).
 * Файловую часть (фабрика в CI: factory/data/usage.json) портал читает
 * статически из /data/usage.json и складывает сам.
 */
export default async (req) => {
  if (req.method !== 'GET') return Response.json({ error: 'method not allowed' }, { status: 405 })
  const s = getStore('zavod-usage')
  const u = (await s.get('usage', { type: 'json' })) ?? {
    anthropic: { requests: 0, inputTokens: 0, outputTokens: 0 },
    replicate: { images: 0 },
    updatedAt: null,
  }
  return Response.json(u, { headers: { 'Cache-Control': 'no-store' } })
}

export const config = { path: '/api/usage' }
