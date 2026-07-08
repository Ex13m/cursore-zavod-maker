import { CursorEngine } from './core/CursorEngine'
import type { CursorEngineOptions } from './core/CursorEngine'
import type { CursorEffect } from './core/types'
import { buildEffects } from './effects'
import type { EffectSpec } from './effects'
import type { CursorPreset } from './presets'

export type CursorInput = CursorPreset | EffectSpec[] | CursorEffect[]

const isEffectInstance = (v: unknown): v is CursorEffect =>
  typeof v === 'object' && v !== null && typeof (v as CursorEffect).init === 'function'

function toEffects(input: CursorInput): CursorEffect[] {
  if (Array.isArray(input)) {
    if (input.length === 0) return []
    return isEffectInstance(input[0])
      ? (input as CursorEffect[])
      : buildEffects(input as EffectSpec[])
  }
  return buildEffects(input.effects)
}

/**
 * Build and start a cursor from a preset, a list of effect specs, or ready
 * effect instances. Returns the running {@link CursorEngine} — call
 * `.destroy()` to clean up.
 *
 * ```ts
 * import { createCursor, getPreset } from 'cursorfx'
 * const cursor = createCursor(getPreset('aurora')!)
 * ```
 */
export function createCursor(
  input: CursorInput,
  options: Partial<Omit<CursorEngineOptions, 'effects'>> = {},
): CursorEngine {
  const effects = toEffects(input)
  return new CursorEngine({ ...options, effects }).start()
}
