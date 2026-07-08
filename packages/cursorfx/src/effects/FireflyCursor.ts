import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'

export interface FireflyCursorOptions {
  /** Firefly glow color. Default `#ffd400`. */
  color?: string
  /** Swarm size. Default `14`. */
  count?: number
}

interface Fly { x: number; y: number; vx: number; vy: number; phase: number; blink: number }

/**
 * A living swarm of fireflies. They wander lazily around the pointer, blink
 * out of sync, scatter in fright when you dash — and slowly gather again
 * around the light when you rest. Alive, like the fish.
 */
export class FireflyCursor extends CanvasEffect {
  readonly id = 'firefly'
  private readonly o: Required<FireflyCursorOptions>
  private flies: Fly[] = []

  constructor(options: FireflyCursorOptions = {}) {
    super()
    this.o = { color: '#ffd400', count: 14, ...options }
  }

  protected setup(): void {
    this.flies = Array.from({ length: this.o.count }, (_, i) => ({
      x: window.innerWidth / 2,
      y: window.innerHeight / 2,
      vx: 0, vy: 0,
      phase: i * 1.7,
      blink: Math.random() * Math.PI * 2,
    }))
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const px = state.pointer.x
    const py = state.pointer.y
    const scare = state.speed > 700 // рывок пугает стаю

    ctx.globalCompositeOperation = 'lighter'
    for (const f of this.flies) {
      f.phase += state.dt * (0.8 + Math.sin(f.blink) * 0.2)
      f.blink += state.dt * (2 + Math.cos(f.phase) * 0.7)

      // wander target orbiting the pointer
      const tx = px + Math.cos(f.phase) * (60 + 50 * Math.sin(f.phase * 0.37))
      const ty = py + Math.sin(f.phase * 0.83) * (46 + 40 * Math.cos(f.phase * 0.29))
      let ax = (tx - f.x) * 2.4
      let ay = (ty - f.y) * 2.4
      if (scare) {
        // разлетаются от курсора
        const dx = f.x - px
        const dy = f.y - py
        const d = Math.hypot(dx, dy) || 1
        ax = (dx / d) * 2600
        ay = (dy / d) * 2600
      }
      f.vx += ax * state.dt
      f.vy += ay * state.dt
      f.vx *= 1 - Math.min(1, state.dt * 2.2)
      f.vy *= 1 - Math.min(1, state.dt * 2.2)
      f.x += f.vx * state.dt
      f.y += f.vy * state.dt

      const glow = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(f.blink))
      const r = 2 + glow * 2.4
      const grad = ctx.createRadialGradient(f.x, f.y, 0.5, f.x, f.y, r * 5)
      grad.addColorStop(0, o.color)
      grad.addColorStop(1, 'transparent')
      ctx.globalAlpha = glow
      ctx.fillStyle = grad
      ctx.beginPath()
      ctx.arc(f.x, f.y, r * 5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.fillStyle = '#fff8d8'
      ctx.beginPath()
      ctx.arc(f.x, f.y, r * 0.55, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalCompositeOperation = 'source-over'

    // тёплая точка-фонарик у курсора
    ctx.fillStyle = o.color
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.arc(px, py, 3.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }

  protected teardown(): void {
    this.flies.length = 0
  }
}
