/**
 * qa-inspector — validates a produced cursor before it reaches the conveyor.
 * Never throws: returns alarms[] so the pipeline keeps running (exception-based
 * review — the owner sees alarms on the HMI, the factory doesn't stop).
 */

const KNOWN_EFFECTS = new Set([
  'dot', 'ring', 'glow', 'trail', 'blob', 'image',
  'turret', 'rocket', 'lure', 'noiseblob',
])
/** Scenario effects draw their own self-luminous scene — contrast check не про них. */
const SCENE_EFFECTS = new Set(['turret', 'rocket', 'lure', 'noiseblob'])
const MAX_EFFECTS = 4
const MAX_TRAIL_SIZE = 20

function hexLuma(hex) {
  const h = String(hex || '').replace('#', '')
  if (h.length < 6) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if ([r, g, b].some(Number.isNaN)) return null
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

/** Inspect one produced item. Returns an array of alarm strings (empty = OK). */
export function inspect(item) {
  const alarms = []

  if (!item.name || item.name.length < 3) alarms.push('name: too short')
  if (!Array.isArray(item.effects) || item.effects.length === 0) {
    alarms.push('effects: empty stack')
    return alarms
  }
  if (item.effects.length > MAX_EFFECTS) alarms.push(`effects: ${item.effects.length} > ${MAX_EFFECTS}`)

  for (const [i, fx] of item.effects.entries()) {
    if (!KNOWN_EFFECTS.has(fx.type)) alarms.push(`effects[${i}]: unknown type "${fx.type}"`)
    const o = fx.options ?? {}
    if (typeof o.size === 'number' && (o.size <= 0 || o.size > 600)) alarms.push(`effects[${i}].size out of range: ${o.size}`)
    if (fx.type === 'trail' && typeof o.size === 'number' && o.size > MAX_TRAIL_SIZE) alarms.push(`trail.size ${o.size} > ${MAX_TRAIL_SIZE}`)
    if (fx.type === 'image' && !o.src) alarms.push(`effects[${i}]: image without src`)
  }

  // Readability heuristic: the primary color must not blend into the background,
  // unless a blend mode (difference/exclusion) guarantees contrast.
  const bgLuma = hexLuma(item.background)
  const first = item.effects[item.effects.length - 1] // topmost layer
  const fxLuma = hexLuma(first?.options?.color)
  const blend = first?.options?.blendMode
  if (bgLuma !== null && fxLuma !== null && !SCENE_EFFECTS.has(first?.type) && blend !== 'difference' && blend !== 'exclusion') {
    if (Math.abs(bgLuma - fxLuma) < 0.12) alarms.push(`contrast: top layer luma ${fxLuma.toFixed(2)} ≈ bg ${bgLuma.toFixed(2)}`)
  }

  if (typeof item.suggestedPrice !== 'number' || item.suggestedPrice < 1 || item.suggestedPrice > 50) {
    alarms.push(`price out of range: ${item.suggestedPrice}`)
  }

  return alarms
}

/** Inspect a whole drop; annotates items and returns drop-level alarm summary. */
export function inspectDrop(items) {
  const dropAlarms = []
  for (const item of items) {
    item.alarms = inspect(item)
    if (item.alarms.length) dropAlarms.push(`${item.id}: ${item.alarms.join('; ')}`)
  }
  const names = new Set(items.map((i) => i.name))
  if (names.size < items.length) dropAlarms.push('duplicate names in drop')
  return dropAlarms
}
