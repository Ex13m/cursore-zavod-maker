import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'

export interface RibbonCursorOptions {
  /** Fixed hue (0-360) or -1 for rainbow cycling. Default `-1`. */
  hue?: number
  /** Ribbon max width px. Default `18`. */
  width?: number
  /** Trail length in points. Default `42`. */
  length?: number
}

/**
 * A silk ribbon flowing behind the pointer — tapered, luminous, hue-cycling.
 * The classic best-seller trail, done smooth: width breathes with speed and
 * the tail settles like real fabric when you stop.
 */
export class RibbonCursor extends CanvasEffect {
  readonly id = 'ribbon'
  private readonly o: Required<RibbonCursorOptions>
  private readonly pts: Array<{ x: number; y: number }> = []
  private hueShift = 0

  constructor(options: RibbonCursorOptions = {}) {
    super()
    this.o = { hue: -1, width: 18, length: 42, ...options }
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    this.hueShift = (this.hueShift + state.dt * 60) % 360

    // head follows pointer; the rest springs after the previous point
    this.pts.unshift({ x: state.position.x, y: state.position.y })
    if (this.pts.length > o.length) this.pts.pop()
    for (let i = 1; i < this.pts.length; i++) {
      const p = this.pts[i]!
      const prev = this.pts[i - 1]!
      p.x += (prev.x - p.x) * Math.min(1, state.dt * 22)
      p.y += (prev.y - p.y) * Math.min(1, state.dt * 22)
    }
    if (this.pts.length < 3) return

    const widthBoost = Math.min(1.6, 0.7 + state.speed * 0.0012)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalCompositeOperation = 'lighter'
    for (let i = 0; i < this.pts.length - 1; i++) {
      const t = i / this.pts.length
      const p = this.pts[i]!
      const q = this.pts[i + 1]!
      const hue = this.o.hue >= 0 ? this.o.hue : (this.hueShift + t * 140) % 360
      ctx.strokeStyle = `hsl(${hue} 95% ${62 - t * 18}%)`
      ctx.globalAlpha = (1 - t) * 0.9
      ctx.lineWidth = Math.max(0.5, o.width * widthBoost * (1 - t))
      ctx.beginPath()
      ctx.moveTo(p.x, p.y)
      ctx.lineTo(q.x, q.y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  protected teardown(): void {
    this.pts.length = 0
  }
}
