/** Deterministic PRNG utilities. Factory rule: seed = date string, never Math.random(). */

export function hashSeed(str) {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return h >>> 0
}

export function mulberry32(seed) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const rngFor = (key) => mulberry32(hashSeed(key))
export const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)]
export const round = (n, step) => Math.round(n / step) * step

/** Weighted pick: items need a numeric `weight`. */
export function pickWeighted(rng, items) {
  const total = items.reduce((s, i) => s + (i.weight ?? 1), 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= item.weight ?? 1
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

/** Today's date as YYYY-MM-DD (UTC — factory runs on UTC cron). */
export function todayKey(d = new Date()) {
  return d.toISOString().slice(0, 10)
}
