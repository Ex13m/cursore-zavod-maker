import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { DROPS_DIR, DATA_DIR, readJson, writeJson } from './lib/paths.js'
import { rngFor, pick, pickWeighted, todayKey } from './lib/seed.js'
import { NAME_ADJ, NAME_NOUN } from './trendbank.js'
import { ARCHETYPES } from './archetypes.js'
import { buildTrends, readTrends } from './trends.js'
import { inspectDrop } from './qa.js'
import { imagegenAvailable, generateCursorSprite } from './imagegen.js'

/** Темы для ежедневных свежих спрайтов (когда задан REPLICATE_API_TOKEN). */
const REPLICATE_SUBJECTS = [
  'a tiny neon koi fish', 'a glowing crystal shard', 'a small friendly ghost',
  'a neon paper plane', 'a tiny thunder cloud with lightning', 'a glowing origami crane',
  'a small magic potion bottle', 'a neon cat face', 'a tiny planet with rings',
]

/**
 * Если есть ключ Replicate — заменяем эмодзи-спрайты свежесгенерированными
 * картинками (до REPLICATE_DAILY_LIMIT штук). Без ключа/при ошибке остаются
 * эмодзи — конвейер не падает.
 */
async function enrichWithReplicate(items) {
  if (!imagegenAvailable()) return
  const limit = Number(process.env.REPLICATE_DAILY_LIMIT) || 3
  let done = 0
  for (const item of items) {
    if (done >= limit) break
    const img = item.effects.find((e) => e.type === 'image' && String(e.options?.src ?? '').startsWith('data:image/svg'))
    if (!img) continue
    const subject = REPLICATE_SUBJECTS[(item.id.charCodeAt(item.id.length - 1) + done) % REPLICATE_SUBJECTS.length]
    try {
      const sprite = await generateCursorSprite(subject)
      img.options = { ...img.options, src: sprite.url }
      item.tags = [...new Set([...item.tags, 'ai-sprite'])]
      item.description = `${item.description} Fresh AI sprite: ${subject}.`
      done++
    } catch (err) {
      item.alarms.push(`replicate degraded: ${err.message}`)
    }
  }
  if (done) console.log(`[producer] replicate enriched ${done} sprites`)
}

/**
 * producer — manufactures the daily drop from current trends.
 * Deterministic: seed = date. Idempotent: skips if today's drop file exists
 * (rerun with --force to regenerate).
 */

const BATCH_SIZE = Number(process.env.DROP_SIZE) || 20
const INDEX_FILE = join(DATA_DIR, 'index.json')

/**
 * Diversity planner: weighted shuffle WITHOUT replacement, round by round.
 * Каждый раунд использует каждый архетип максимум один раз, поэтому при
 * N архетипов повтор возможен только после N уникальных идей. Веса стилей
 * из трендов влияют на порядок, не ломая разнообразие.
 */
function planArchetypes(rng, trends, count) {
  const weightOf = (a) => trends.styles.find((s) => s.tag === a.style)?.weight ?? 4
  const plan = []
  while (plan.length < count) {
    const pool = [...ARCHETYPES]
    while (pool.length > 0 && plan.length < count) {
      const chosen = pickWeighted(rng, pool.map((a) => ({ ...a, weight: weightOf(a) })))
      plan.push(chosen)
      pool.splice(pool.findIndex((a) => a.style === chosen.style && a.build === chosen.build), 1)
    }
  }
  return plan
}

function generateItem(date, index, trends, archetype, used) {
  const rng = rngFor(`${date}#${index}`)

  // палитра: не повторять пару архетип+палитра (до 6 попыток)
  let palette = pickWeighted(rng, trends.palettes)
  for (let tries = 0; tries < 6 && used.combos.has(`${archetype.style}:${palette.name}`); tries++) {
    palette = pickWeighted(rng, trends.palettes)
  }
  used.combos.add(`${archetype.style}:${palette.name}`)

  const built = archetype.build(rng, palette)

  // имя: без дублей внутри дропа
  let name = `${pick(rng, NAME_ADJ)} ${pick(rng, NAME_NOUN)}`
  for (let tries = 0; tries < 8 && used.names.has(name); tries++) {
    name = `${pick(rng, NAME_ADJ)} ${pick(rng, NAME_NOUN)}`
  }
  used.names.add(name)

  const price = Math.min(14, 4 + built.effects.length * 2 + Math.floor(rng() * 3))

  return {
    id: `drop-${date}-${index}`,
    name: built.name ?? name,
    description: built.desc,
    tags: built.tags,
    accent: built.accent ?? palette.colors[0],
    background: built.background ?? palette.bg,
    dark: built.dark ?? palette.dark,
    suggestedPrice: built.price ?? price,
    effects: built.effects,
    alarms: [],
  }
}

export async function produceDrop(date = todayKey(), { force = false } = {}) {
  const file = join(DROPS_DIR, `${date}.json`)
  if (existsSync(file) && !force) {
    console.log(`[producer] drop ${date} already exists — idempotent skip (use --force to rebuild)`)
    return readJson(file)
  }

  let trends = readTrends()
  if (!trends || trends.date !== date) trends = await buildTrends(date)

  const planRng = rngFor(`plan:${date}`)
  const plan = planArchetypes(planRng, trends, BATCH_SIZE)
  const used = { combos: new Set(), names: new Set() }
  const items = plan.map((archetype, i) => generateItem(date, i, trends, archetype, used))
  await enrichWithReplicate(items)
  const alarms = inspectDrop(items)

  const drop = {
    date,
    generatedAt: new Date().toISOString(),
    seed: date,
    trendsNotes: trends.notes,
    items,
    alarms,
  }
  writeJson(file, drop)

  // Maintain the drops index (portal's entry point).
  const index = readJson(INDEX_FILE, { drops: [] })
  if (!index.drops.includes(date)) index.drops.unshift(date)
  index.drops.sort().reverse()
  index.latest = index.drops[0]
  writeJson(INDEX_FILE, index)

  const alarmNote = alarms.length ? ` · ⚠ ${alarms.length} alarms` : ' · OTK clean'
  console.log(`[producer] drop ${date}: ${items.length} cursors${alarmNote}`)
  return drop
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('produce.js')) {
  const force = process.argv.includes('--force')
  const dateArg = process.argv.find((a) => /^\d{4}-\d{2}-\d{2}$/.test(a))
  produceDrop(dateArg ?? todayKey(), { force })
}
