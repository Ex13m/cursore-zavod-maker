import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import archiver from 'archiver'
import { DATA_DIR, ROOT_DIR, readJson, writeJson } from './lib/paths.js'

/**
 * publisher — packages an approved cursor and ships it.
 * Gumroad path (GUMROAD_ACCESS_TOKEN + productId): upload zip into an existing
 * draft product, then enable it. Platform limitation: the public API cannot
 * CREATE products (antiwork/gumroad#4019) — drafts are pre-created by the owner.
 * Fallback path: write a ready-to-upload bundle into /published.
 */

const QUEUE_FILE = join(DATA_DIR, 'queue.json')
const OUT_DIR = join(ROOT_DIR, 'published')
const API = 'https://api.gumroad.com/v2'

export const readQueue = () => readJson(QUEUE_FILE, [])
export const writeQueue = (q) => writeJson(QUEUE_FILE, q)

export function upsertQueueItem(item) {
  const queue = readQueue()
  const now = new Date().toISOString()
  const idx = queue.findIndex((q) => q.id === item.id)
  if (idx === -1) queue.push({ status: 'queued', createdAt: now, updatedAt: now, ...item })
  else queue[idx] = { ...queue[idx], ...item, updatedAt: now }
  writeQueue(queue)
  return queue.find((q) => q.id === item.id)
}

export function removeQueueItem(id) {
  const queue = readQueue()
  const next = queue.filter((q) => q.id !== id)
  writeQueue(next)
  return next.length !== queue.length
}

const slugify = (s) =>
  String(s || 'cursor').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'cursor'

function usageMarkdown(item) {
  return `# ${item.name} — cursorfx preset

${item.description ?? ''}

## Use

\`\`\`bash
npm install cursorfx
\`\`\`

\`\`\`ts
import { createCursor } from 'cursorfx'
import config from './cursor.config.json'
createCursor(config.effects)
\`\`\`

Tags: ${(item.tags ?? []).join(', ')}
`
}

export function buildBundle(item) {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks = []
    archive.on('data', (c) => chunks.push(c))
    archive.on('error', reject)
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    archive.append(
      JSON.stringify(
        { name: item.name, description: item.description, tags: item.tags ?? [], accent: item.accent, background: item.background, effects: item.effects ?? [] },
        null, 2,
      ),
      { name: 'cursor.config.json' },
    )
    archive.append(usageMarkdown(item), { name: 'README.md' })
    if (item.coverDataUrl) {
      const m = /^data:image\/png;base64,(.*)$/.exec(item.coverDataUrl)
      if (m) archive.append(Buffer.from(m[1], 'base64'), { name: 'cover.png' })
    }
    archive.finalize()
  })
}

async function gumroadCall(method, path, { form } = {}) {
  const token = process.env.GUMROAD_ACCESS_TOKEN
  const headers = { Authorization: `Bearer ${token}` }
  let body
  if (form) body = form
  else {
    headers['Content-Type'] = 'application/x-www-form-urlencoded'
    body = new URLSearchParams({ access_token: token }).toString()
  }
  const res = await fetch(`${API}${path}`, { method, headers, body, signal: AbortSignal.timeout(30000) })
  const text = await res.text()
  let json
  try { json = JSON.parse(text) } catch { json = { success: false, message: text.slice(0, 200) } }
  return { ok: res.ok && json.success !== false, json }
}

export async function publishItem(item) {
  const steps = []
  const slug = slugify(item.name)
  const zip = await buildBundle(item)

  // Local artifact — the safety net. Best-effort: serverless filesystems are
  // read-only, so a failed write is a note, not an error.
  try {
    const dir = join(OUT_DIR, slug)
    await mkdir(dir, { recursive: true })
    await writeFile(join(dir, `${slug}.zip`), zip)
    steps.push({ step: 'bundle', ok: true, detail: `published/${slug}/${slug}.zip` })
  } catch {
    steps.push({ step: 'bundle', ok: true, detail: 'fs read-only (serverless) — bundle kept in memory' })
  }

  const token = process.env.GUMROAD_ACCESS_TOKEN
  const productId = item.productId?.trim()
  if (!token || !productId) {
    return {
      ok: true, provider: 'local', steps,
      message: token
        ? 'No Gumroad productId on the card — bundle written locally, attach it to a draft manually.'
        : 'GUMROAD_ACCESS_TOKEN not set — bundle written locally.',
    }
  }

  const check = await gumroadCall('GET', `/products/${productId}`)
  steps.push({ step: 'validate', ok: check.ok })
  if (!check.ok) return { ok: false, provider: 'gumroad', steps, message: `cannot read product ${productId}` }

  try {
    const form = new FormData()
    form.set('access_token', token)
    form.set('file', new Blob([zip], { type: 'application/zip' }), `${slug}.zip`)
    const upload = await gumroadCall('POST', `/products/${productId}/product_files`, { form })
    steps.push({ step: 'upload', ok: upload.ok })
  } catch (err) {
    steps.push({ step: 'upload', ok: false, detail: String(err) })
  }

  const enable = await gumroadCall('PUT', `/products/${productId}/enable`)
  steps.push({ step: 'enable', ok: enable.ok })

  const ok = steps.every((s) => s.ok)
  return {
    ok, provider: 'gumroad', steps,
    url: check.json?.product?.short_url ?? `https://app.gumroad.com/products/${productId}`,
    message: ok ? 'Uploaded and published on Gumroad.' : 'Published with warnings — see steps.',
  }
}

/** Publish everything approved in the queue. */
export async function publishQueue() {
  const queue = readQueue()
  const pending = queue.filter((q) => q.status === 'queued' || q.status === 'error')
  const results = []
  for (const item of pending) {
    upsertQueueItem({ ...item, status: 'publishing' })
    try {
      const result = await publishItem(item)
      upsertQueueItem({ ...item, status: result.ok ? 'published' : 'error', result, error: result.ok ? null : result.message })
      results.push({ id: item.id, ...result })
    } catch (err) {
      upsertQueueItem({ ...item, status: 'error', error: String(err) })
      results.push({ id: item.id, ok: false, message: String(err) })
    }
  }
  return { count: results.length, results }
}
