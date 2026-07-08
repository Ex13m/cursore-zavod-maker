import { getStore } from '@netlify/blobs'
import { publishItem } from '../../factory/publish.js'

/** Publish everything approved in the Blobs queue (serverless twin of devserver /api/publish). */

const store = () => getStore('zavod-queue')

/** Публикация только с ключом владельца — иначе аноним может жечь Gumroad-токен. */
const authorized = (req) => {
  const key = process.env.ZAVOD_ADMIN_KEY
  return !key || req.headers.get('x-zavod-key') === key
}

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
  if (!authorized(req)) {
    return Response.json({ error: 'нужен ключ владельца (X-Zavod-Key)' }, { status: 401 })
  }

  const s = store()
  const queue = (await s.get('queue', { type: 'json' })) ?? []
  const pending = queue.filter((q) => q.status === 'queued' || q.status === 'error')
  const results = []

  for (const item of pending) {
    const idx = queue.findIndex((q) => q.id === item.id)
    queue[idx] = { ...item, status: 'publishing' }
    await s.setJSON('queue', queue)
    try {
      const result = await publishItem(item)
      queue[idx] = { ...item, status: result.ok ? 'published' : 'error', result, error: result.ok ? null : result.message, updatedAt: new Date().toISOString() }
      results.push({ id: item.id, ...result })
    } catch (err) {
      queue[idx] = { ...item, status: 'error', error: String(err), updatedAt: new Date().toISOString() }
      results.push({ id: item.id, ok: false, message: String(err) })
    }
    await s.setJSON('queue', queue)
  }

  return Response.json({ count: results.length, results })
}

export const config = { path: '/api/publish' }
