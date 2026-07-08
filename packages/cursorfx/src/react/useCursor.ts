import { useEffect, useRef } from 'react'
import { CursorEngine } from '../core/CursorEngine'
import type { CursorEngineOptions } from '../core/CursorEngine'
import { createCursor } from '../createCursor'
import type { CursorInput } from '../createCursor'

export type UseCursorOptions = Partial<Omit<CursorEngineOptions, 'effects'>> & {
  /** Set to false to skip mounting (e.g. on touch devices). Default `true`. */
  enabled?: boolean
}

/**
 * Mounts a cursor for the lifetime of the component and returns a ref to the
 * live {@link CursorEngine}. The cursor is rebuilt whenever `deps` change.
 *
 * ```tsx
 * useCursor(getPreset('halo')!)
 * ```
 */
export function useCursor(
  input: CursorInput,
  { enabled = true, ...options }: UseCursorOptions = {},
  deps: ReadonlyArray<unknown> = [],
): React.MutableRefObject<CursorEngine | null> {
  const ref = useRef<CursorEngine | null>(null)

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return
    const engine = createCursor(input, options)
    ref.current = engine
    return () => {
      engine.destroy()
      ref.current = null
    }
    // `input`/`options` are intentionally controlled via the explicit `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return ref
}
