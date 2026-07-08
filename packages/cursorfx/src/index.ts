// Core engine
export { CursorEngine } from './core/CursorEngine'
export type { CursorEngineOptions } from './core/CursorEngine'
export type {
  CursorEffect,
  CursorState,
  EffectContext,
  HoverState,
  Vec2,
} from './core/types'

// Math helpers (handy when authoring custom effects)
export { lerp, clamp, distance, expSmooth } from './core/math'

// Built-in effects + the serializable spec/registry
export {
  DotCursor,
  RingCursor,
  GlowCursor,
  TrailCursor,
  BlobCursor,
  ImageCursor,
  buildEffect,
  buildEffects,
} from './effects'
export type {
  EffectType,
  EffectSpec,
  DotCursorOptions,
  RingCursorOptions,
  GlowCursorOptions,
  TrailCursorOptions,
  BlobCursorOptions,
  ImageCursorOptions,
} from './effects'

// Presets (the sellable catalog)
export { PRESETS, getPreset } from './presets'
export type { CursorPreset } from './presets'

// One-call factory
export { createCursor } from './createCursor'
export type { CursorInput } from './createCursor'
