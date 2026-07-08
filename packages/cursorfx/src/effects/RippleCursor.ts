import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'

export interface RippleCursorOptions {
  /** Grid line color. Default `rgba(59,220,255,0.28)`. */
  gridColor?: string
  /** Crest highlight color. Default `#3bdcff`. */
  crestColor?: string
  /** Grid spacing px. Default `46`. */
  spacing?: number
  /** Wave amplitude px. Default `16`. */
  amplitude?: number
}

interface Wave { x: number; y: number; r: number; power: number }

/**
 * Spacetime fabric: a grid covers the page and BENDS. Moving the pointer sends
 * expanding circular waves through the mesh; a click drops a heavy stone.
 * The cursor doesn't decorate space — it deforms it.
 */
export class RippleCursor extends CanvasEffect {
  readonly id = 'ripple'
  private readonly o: Required<RippleCursorOptions>
  private readonly waves: Wave[] = []
  private emitAccum = 0

  constructor(options: RippleCursorOptions = {}) {
    super()
    this.o = {
      gridColor: 'rgba(59,220,255,0.28)',
      crestColor: '#3bdcff',
      spacing: 46,
      amplitude: 16,
      ...options,
    }
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const w = window.innerWidth
    const h = window.innerHeight

    // emit ripples along movement; big one on click
    this.emitAccum += state.speed * state.dt
    if (this.emitAccum > 90 && this.waves.length < 26) {
      this.emitAccum = 0
      this.waves.push({ x: state.pointer.x, y: state.pointer.y, r: 4, power: 1 })
    }
    if (state.pressed && (this.waves.length === 0 || this.waves[this.waves.length - 1]!.power <= 1.6)) {
      this.waves.push({ x: state.pointer.x, y: state.pointer.y, r: 2, power: 2.4 })
    }
    for (let i = this.waves.length - 1; i >= 0; i--) {
      const wv = this.waves[i]!
      wv.r += 340 * state.dt
      wv.power *= 1 - Math.min(1, state.dt * 0.9)
      if (wv.power < 0.04) this.waves.splice(i, 1)
    }

    // displacement of a grid vertex by all waves
    const disp = (x: number, y: number): [number, number, number] => {
      let dx = 0
      let dy = 0
      let energy = 0
      for (const wv of this.waves) {
        const ddx = x - wv.x
        const ddy = y - wv.y
        const d = Math.hypot(ddx, ddy) || 1
        const band = d - wv.r
        // a moving crest: gaussian around the ring radius
        const k = Math.exp(-(band * band) / 900) * wv.power
        if (k > 0.01) {
          dx += (ddx / d) * k * o.amplitude
          dy += (ddy / d) * k * o.amplitude
          energy += k
        }
      }
      return [dx, dy, energy]
    }

    const cols = Math.ceil(w / o.spacing) + 1
    const rows = Math.ceil(h / o.spacing) + 1

    ctx.lineWidth = 1
    // horizontal lines
    for (let j = 0; j <= rows; j++) {
      ctx.beginPath()
      let maxE = 0
      for (let i = 0; i <= cols; i++) {
        const x = i * o.spacing
        const y = j * o.spacing
        const [dx, dy, e] = disp(x, y)
        maxE = Math.max(maxE, e)
        if (i === 0) ctx.moveTo(x + dx, y + dy)
        else ctx.lineTo(x + dx, y + dy)
      }
      ctx.strokeStyle = maxE > 0.5 ? o.crestColor : o.gridColor
      ctx.globalAlpha = maxE > 0.5 ? Math.min(1, 0.35 + maxE * 0.4) : 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    // vertical lines
    for (let i = 0; i <= cols; i++) {
      ctx.beginPath()
      let maxE = 0
      for (let j = 0; j <= rows; j++) {
        const x = i * o.spacing
        const y = j * o.spacing
        const [dx, dy, e] = disp(x, y)
        maxE = Math.max(maxE, e)
        if (j === 0) ctx.moveTo(x + dx, y + dy)
        else ctx.lineTo(x + dx, y + dy)
      }
      ctx.strokeStyle = maxE > 0.5 ? o.crestColor : o.gridColor
      ctx.globalAlpha = maxE > 0.5 ? Math.min(1, 0.35 + maxE * 0.4) : 1
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // the mass that bends space
    ctx.fillStyle = o.crestColor
    ctx.beginPath()
    ctx.arc(state.pointer.x, state.pointer.y, 5, 0, Math.PI * 2)
    ctx.fill()
  }

  protected teardown(): void {
    this.waves.length = 0
  }
}
