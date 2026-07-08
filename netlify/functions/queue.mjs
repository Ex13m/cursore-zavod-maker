import { getStore } from '@netlify/blobs'

/**
 * Publish queue backed by Netlify Blobs — lets the owner approve cursors from
 * any device (the daily email opens the deployed portal). Mirrors the local
 * devserver /api/queue contract.
 */

const store = () => getStore('zavod-queue')

async function readQueue() {
  const s = store()
  return (await s.get('queue', { type: 'json' })) ?? []
}
const writeQueue = (q) => store().setJSON('queue', q)

export default async (req) => {
  const url = new URL(req.url)

  if (req.method === 'GET') return Response.json(await readQueue())

  if (req.method === 'POST') {
    const body = await req.json().catch(() => ({}))
    if (!body.id || !body.name || !Array.isArray(body.effects)) {
      return Response.json({ error: 'id, name, effects are required' }, { status: 400 })
    }
    const queue = await readQueue()
    const now = new Date().toISOString()
    const idx = queue.findIndex((q) => q.id === body.id)
    const item = idx === -1
      ? { status: 'queued', createdAt: now, updatedAt: now, ...body }
      : { ...queue[idx], ...body, status: 'queued', updatedAt: now }
    if (idx === -1) queue.push(item)
    else queue[idx] = item
    await writeQueue(queue)
    return Response.json(item)
  }

  if (req.method === 'DELETE') {
    const id = url.pathname.split('/').pop()
    const queue = await readQueue()
    const next = queue.filter((q) => q.id !== id)
    await writeQueue(next)
    return Response.json({ ok: next.length !== queue.length })
  }

  return Response.json({ error: 'method not allowed' }, { status: 405 })
}

export const config = { path: ['/api/queue', '/api/queue/:id'] }
