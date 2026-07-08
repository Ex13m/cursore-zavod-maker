import type { CursorEngine } from './CursorEngine'

/** A 2D vector. Mutated in place inside the engine for zero-allocation updates. */
export interface Vec2 {
  x: number
  y: number
}

/** Describes the element currently under the pointer that matches the hover selector. */
export interface HoverState {
  /** The matched element (closest ancestor matching the hover selector). */
  target: Element
  /** Bounding rect of the target, refreshed every frame. */
  rect: DOMRect
}

/**
 * The live state of the cursor, recomputed every frame and passed to each effect.
 * Treat it as read-only inside effects — the engine owns it.
 */
export interface CursorState {
  /** Raw pointer position from the latest pointer event. */
  pointer: Vec2
  /** Lightly smoothed primary position. Most "dot" effects follow this. */
  position: Vec2
  /** Position on the previous frame (used to derive velocity). */
  previous: Vec2
  /** Pixels per second, derived from `position`. */
  velocity: Vec2
  /** Magnitude of `velocity`. */
  speed: number
  /** Whether a pointer button is currently pressed. */
  pressed: boolean
  /** Whether the pointer is currently over the document. */
  visible: boolean
  /** Hover target info, or null when not hovering an interactive element. */
  hover: HoverState | null
  /** Delta time of the current frame, in seconds (clamped). */
  dt: number
  /** Seconds elapsed since the engine started. */
  elapsed: number
  /** Current viewport size in CSS pixels. */
  viewport: { width: number; height: number }
}

/** What every effect receives once, when it is mounted. */
export interface EffectContext {
  /** A dedicated, pointer-events:none container owned by this effect. */
  layer: HTMLElement
  /** The engine driving this effect. */
  engine: CursorEngine
}

/**
 * A cursor effect is a self-contained visual layer.
 * Compose several of them in a single engine to build a cursor.
 */
export interface CursorEffect {
  /** Unique-ish identifier, used for the layer's data attribute. */
  readonly id: string
  /** Called once when the engine starts. Build your DOM/canvas here. */
  init(ctx: EffectContext): void
  /** Called every animation frame with the latest state. */
  update(state: Readonly<CursorState>): void
  /** Called when the engine stops. Remove listeners and detach DOM here. */
  destroy(): void
}
