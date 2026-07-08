import { useCursor } from './useCursor'
import type { UseCursorOptions } from './useCursor'
import type { CursorInput } from '../createCursor'

export interface AnimatedCursorProps extends UseCursorOptions {
  /** A preset, effect specs, or effect instances to render. */
  cursor: CursorInput
  /**
   * Values that, when changed, rebuild the cursor. Pass `[presetId]` when
   * switching presets at runtime.
   */
  rebuildOn?: ReadonlyArray<unknown>
}

/**
 * Drop-in React component that mounts an animated cursor for the whole page.
 * Renders nothing itself.
 *
 * ```tsx
 * import { AnimatedCursor } from 'cursorfx/react'
 * import { getPreset } from 'cursorfx'
 *
 * <AnimatedCursor cursor={getPreset('aurora')!} />
 * ```
 */
export function AnimatedCursor({ cursor, rebuildOn = [], ...options }: AnimatedCursorProps): null {
  useCursor(cursor, options, rebuildOn)
  return null
}
