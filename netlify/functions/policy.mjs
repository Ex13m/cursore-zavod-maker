import { canPublish, dailyLimit, publishedToday, POLICY } from '../../factory/lib/policy.js'

/** Текущее состояние антибан-политики публикаций (только чтение). */
export default async (req) => {
  if (req.method !== 'GET') return Response.json({ error: 'method not allowed' }, { status: 405 })
  const today = new Date().toISOString().slice(0, 10)
  return Response.json(
    { today, limit: dailyLimit(today), used: publishedToday(today), gate: canPublish(today), policy: POLICY },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}

export const config = { path: '/api/policy' }
