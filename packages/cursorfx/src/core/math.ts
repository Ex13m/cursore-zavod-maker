import type { Vec2 } from './types'

/** Linear interpolation between `a` and `b` by `t` in [0, 1]. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Clamp `v` into the inclusive range [min, max]. */
export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

/** Euclidean distance between two points. */
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y)

/**
 * Frame-rate independent exponential smoothing.
 *
 * Moves `current` toward `target` such that, regardless of frame rate, half of
 * the remaining distance is covered every `halfLife` seconds. Smaller halfLife =
 * snappier. A halfLife <= 0 snaps instantly.
 */
export const expSmooth = (
  current: number,
  target: number,
  halfLife: number,
  dt: number,
): number => {
  if (halfLife <= 0) return target
  const t = 1 - Math.pow(2, -dt / halfLife)
  return lerp(current, target, t)
}

/** Round to device pixels to keep edges crisp. */
export const snap = (v: number, dpr: number): number => Math.round(v * dpr) / dpr
