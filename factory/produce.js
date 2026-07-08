import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { DROPS_DIR, DATA_DIR, readJson, writeJson } from './lib/paths.js'
import { rngFor, pick, pickWeighted, todayKey } from './lib/seed.js'
import { NAME_ADJ, NAME_NOUN } from './trendbank.js'
import { ARCHETYPES } from './archetypes.js'
import { buildTrends, readTrends } from './trends.js'
import { inspectDrop } from './qa.js'

/**
 * producer — manufactures the daily drop from current trends.
 * Deterministic: seed = date. Idempotent: skips if today's drop file exists
 * (rerun with --force to regenerate).
 */

const BATCH_SIZE = Number(process.env.DROP_SIZE) || 20
const INDEX_FILE = join(DATA_DIR, 'index.json')

function generateItem(date, index, trends) {
  const rng = rngFor(`${date}#${index}`)
  const palette = pickWeighted(rng, trends.palettes)
  const style = pickWeighted(rng, trends.styles)
  const archetype = ARCHETYPES.find((a) => a.style === style.tag) ?? pick(rng, ARCHETYPES)
  const built = archetype.build(rng, palette)
  const name = `${pick(rng, NAME_ADJ)} ${pick(rng, NAME_NOUN)}`
  const price = Math.min(14, 4 + built.effects.length * 2 + Math.floor(rng() * 3))

  return {
    id: `drop-${date}-${index}`,
    name,
    description: built.desc,
    tags: built.tags,
    accent: palette.colors[0],
    background: palette.bg,
    dark: palette.dark,
    suggestedPrice: price,
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

  const items = Array.from({ length: BATCH_SIZE }, (_, i) => generateItem(date, i, trends))
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
