/**
 * Ручное управление заводом с прод-пульта.
 * «Проверить тренды» / «Перегенерировать всё» → workflow_dispatch daily-factory
 * в GitHub Actions; «время смены» → правка cron в workflow-файле через
 * GitHub Contents API. Нужен GH_TRIGGER_TOKEN (fine-grained PAT: Actions rw +
 * Contents rw на репозиторий) в env Netlify. Без токена — понятная подсказка.
 */

const REPO = process.env.GH_REPO || 'Ex13m/cursore-zavod-maker'
const WORKFLOW = 'daily-factory.yml'

const authorized = (req) => {
  const key = process.env.ZAVOD_ADMIN_KEY
  return !key || req.headers.get('x-zavod-key') === key
}

const gh = (path, init = {}) =>
  fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.GH_TRIGGER_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...init.headers,
    },
    signal: AbortSignal.timeout(20000),
  })

export default async (req) => {
  if (req.method !== 'POST') return Response.json({ error: 'method not allowed' }, { status: 405 })
  if (!authorized(req)) return Response.json({ error: 'нужен ключ владельца (X-Zavod-Key)' }, { status: 401 })
  if (!process.env.GH_TRIGGER_TOKEN) {
    return Response.json({
      ok: false,
      message: 'GH_TRIGGER_TOKEN не задан в Netlify env. Создай fine-grained PAT (репо cursore-zavod-maker, права Actions+Contents read/write) на github.com/settings/personal-access-tokens и добавь в переменные окружения сайта.',
    })
  }

  const { action, hour, minute } = await req.json().catch(() => ({}))

  if (action === 'trends' || action === 'regenerate') {
    const res = await gh(`/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`, {
      method: 'POST',
      body: JSON.stringify({ ref: 'main', inputs: { mode: action } }),
    })
    if (res.status !== 204) {
      return Response.json({ ok: false, message: `GitHub ответил ${res.status}: ${(await res.text()).slice(0, 160)}` })
    }
    return Response.json({
      ok: true,
      message: action === 'trends'
        ? 'Смена запущена: проверка трендов. Результат приедет на сайт через ~3 мин (commit → автодеплой).'
        : 'Смена запущена: полная перегенерация дропа. Новый дроп на сайте через ~3–4 мин.',
    })
  }

  if (action === 'schedule') {
    const h = Math.max(0, Math.min(23, Number(hour) || 0))
    const m = Math.max(0, Math.min(59, Number(minute) || 0))
    const path = `/repos/${REPO}/contents/.github/workflows/${WORKFLOW}`
    const cur = await gh(path)
    if (!cur.ok) return Response.json({ ok: false, message: `не смог прочитать workflow: ${cur.status}` })
    const file = await cur.json()
    const content = Buffer.from(file.content, 'base64').toString('utf8')
    const next = content.replace(/- cron: '\d+ \d+ \* \* \*'/, `- cron: '${m} ${h} * * *'`)
    if (next === content && !content.includes(`- cron: '${m} ${h} * * *'`)) {
      return Response.json({ ok: false, message: 'не нашёл строку cron в workflow — формат изменился?' })
    }
    const put = await gh(path, {
      method: 'PUT',
      body: JSON.stringify({
        message: `chore: время смены → ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UTC (с пульта)`,
        content: Buffer.from(next, 'utf8').toString('base64'),
        sha: file.sha,
      }),
    })
    if (!put.ok) return Response.json({ ok: false, message: `не смог сохранить: ${put.status}` })
    return Response.json({ ok: true, message: `Расписание сохранено: смена теперь в ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} UTC.` })
  }

  return Response.json({ error: 'unknown action' }, { status: 400 })
}

export const config = { path: '/api/factory' }
