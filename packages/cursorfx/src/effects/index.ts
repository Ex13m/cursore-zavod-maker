import type { CursorEffect } from '../core/types'
import { DotCursor } from './DotCursor'
import { RingCursor } from './RingCursor'
import { GlowCursor } from './GlowCursor'
import { TrailCursor } from './TrailCursor'
import { BlobCursor } from './BlobCursor'
import { ImageCursor } from './ImageCursor'

export { DotCursor } from './DotCursor'
export { RingCursor } from './RingCursor'
export { GlowCursor } from './GlowCursor'
export { TrailCursor } from './TrailCursor'
export { BlobCursor } from './BlobCursor'
export { ImageCursor } from './ImageCursor'

export type { DotCursorOptions } from './DotCursor'
export type { RingCursorOptions } from './RingCursor'
export type { GlowCursorOptions } from './GlowCursor'
export type { TrailCursorOptions } from './TrailCursor'
export type { BlobCursorOptions } from './BlobCursor'
export type { ImageCursorOptions } from './ImageCursor'

/** The string keys used to refer to an effect in a serializable {@link EffectSpec}. */
export type EffectType = 'dot' | 'ring' | 'glow' | 'trail' | 'blob' | 'image'

/**
 * A serializable description of a single effect: its type plus constructor
 * options. This is what gets saved into a preset and shipped inside a product.
 */
export interface EffectSpec {
  type: EffectType
  options?: Record<string, unknown>
}

type EffectConstructor = new (options?: Record<string, unknown>) => CursorEffect

const REGISTRY: Record<EffectType, EffectConstructor> = {
  dot: DotCursor as unknown as EffectConstructor,
  ring: RingCursor as unknown as EffectConstructor,
  glow: GlowCursor as unknown as EffectConstructor,
  trail: TrailCursor as unknown as EffectConstructor,
  blob: BlobCursor as unknown as EffectConstructor,
  image: ImageCursor as unknown as EffectConstructor,
}

/** Instantiate a single effect from its serializable spec. */
export function buildEffect(spec: EffectSpec): CursorEffect {
  const Ctor = REGISTRY[spec.type]
  if (!Ctor) throw new Error(`cursorfx: unknown effect type "${spec.type}"`)
  return new Ctor(spec.options)
}

/** Instantiate a stack of effects from serializable specs. */
export function buildEffects(specs: EffectSpec[]): CursorEffect[] {
  return specs.map(buildEffect)
}
