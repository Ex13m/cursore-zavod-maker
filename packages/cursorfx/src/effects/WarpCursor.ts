import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'

export interface WarpCursorOptions {
  /** Star streak color. Default `#e8eaed`. */
  color?: string
  /** Accent color for the closest stars. Default `#3bdcff`. */
  accent?: string
  /** Number of stars. Default `160`. */
  starCount?: number
  /** Base flight speed. Default `0.35`. */
  baseSpeed?: number
}

interface Star { x: number; y: number; z: number }

/**
 * Hyperspace at the pointer: the cursor is the vanishing point of a starfield
 * warp. Stars streak outward past the viewer; move the mouse fast and the
 * whole space accelerates into light-speed lines.
 */
export class WarpCursor extends CanvasEffect {
  readonly id = 'warp'
  private readonly o: Required<WarpCursorOptions>
  private stars: Star[] = []
  private speed = 0

  constructor(options: WarpCursorOptions = {}) {
    super()
    this.o = { color: '#e8eaed', accent: '#3bdcff', starCount: 160, baseSpeed: 0.35, ...options }
  }

  protected setup(): void {
    this.stars = Array.from({ length: this.o.starCount }, () => ({
      x: Math.random() * 2 - 1,
      y: Math.random() * 2 - 1,
      z: Math.random(),
    }))
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const cx = state.pointer.x
    const cy = state.pointer.y
    const scale = Math.max(window.innerWidth, window.innerHeight)

    // speed follows the pointer: standing still = drift, moving = warp jump
    const target = o.baseSpeed + Math.min(3.2, state.speed * 0.004)
    this.speed += (target - this.speed) * Math.min(1, state.dt * 4)

    for (const s of this.stars) {
      const zPrev = s.z
      s.z -= this.speed * state.dt
      if (s.z <= 0.02) {
        s.x = Math.random() * 2 - 1
        s.y = Math.random() * 2 - 1
        s.z = 1
        continue
      }
      const px = cx + (s.x / s.z) * scale * 0.5
      const py = cy + (s.y / s.z) * scale * 0.5
      const qx = cx + (s.x / zPrev) * scale * 0.5
      const qy = cy + (s.y / zPrev) * scale * 0.5
      const near = 1 - s.z
      ctx.strokeStyle = near > 0.75 ? o.accent : o.color
      ctx.globalAlpha = 0.15 + near * 0.85
      ctx.lineWidth = 0.6 + near * 2
      ctx.beginPath()
      ctx.moveTo(qx, qy)
      ctx.lineTo(px, py)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // the vanishing point
    ctx.fillStyle = o.accent
    ctx.beginPath()
    ctx.arc(cx, cy, 3.5, 0, Math.PI * 2)
    ctx.fill()
  }

  protected teardown(): void {
    this.stars.length = 0
  }
}
