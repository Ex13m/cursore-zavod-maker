import { join } from 'node:path'
import { DATA_DIR, writeJson, readJson } from './lib/paths.js'
import { rngFor, todayKey } from './lib/seed.js'
import { PALETTES, STYLES } from './trendbank.js'

/**
 * trend-scout — assembles today's trend weights into factory/data/trends.json.
 *
 * Sources, in order:
 *  1. Built-in trend bank (always available — graceful degradation).
 *  2. Daily deterministic rotation: weights wobble by date seed so every day
 *     favors a different corner of the bank (the factory doesn't repeat itself).
 *  3. Optional live signals from TRENDS_SIGNAL_URL (JSON: {palettes?,styles?}
 *     with {name|tag, weight} entries) — merged on top when reachable.
 */

const TRENDS_FILE = join(DATA_DIR, 'trends.json')

function wobble(items, rng) {
  return items.map((item) => {
    // ±40% deterministic daily variation, never below 1.
    const factor = 0.6 + rng() * 0.8
    return { ...item, weight: Math.max(1, Math.round((item.weight ?? 1) * factor * 10) / 10), source: 'bank' }
  })
}

async function fetchLiveSignals() {
  const url = process.env.TRENDS_SIGNAL_URL
  if (!url) return null
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function mergeSignals(base, signals) {
  if (!Array.isArray(signals)) return base
  const out = [...base]
  for (const sig of signals) {
    const id = sig.name ?? sig.tag
    const idx = out.findIndex((i) => (i.name ?? i.tag) === id)
    if (idx >= 0) out[idx] = { ...out[idx], weight: sig.weight ?? out[idx].weight, source: 'live' }
  }
  return out
}

export async function buildTrends(date = todayKey()) {
  const rng = rngFor(`trends:${date}`)
  let palettes = wobble(PALETTES, rng)
  let styles = wobble(STYLES, rng)

  const live = await fetchLiveSignals()
  const notes = []
  if (live) {
    palettes = mergeSignals(palettes, live.palettes)
    styles = mergeSignals(styles, live.styles)
    notes.push(`live signals merged from TRENDS_SIGNAL_URL`)
  } else {
    notes.push('no live signals — built-in bank with daily rotation')
  }

  const top = [...palettes].sort((a, b) => b.weight - a.weight).slice(0, 3).map((p) => p.name)
  notes.push(`today favors: ${top.join(', ')}`)

  return { date, updatedAt: new Date().toISOString(), palettes, styles, notes }
}

export async function runTrendScout() {
  const trends = await buildTrends()
  writeJson(TRENDS_FILE, trends)
  console.log(`[trend-scout] trends.json for ${trends.date}: ${trends.notes.join(' · ')}`)
  return trends
}

export function readTrends() {
  return readJson(TRENDS_FILE)
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('trends.js')) {
  runTrendScout()
}
