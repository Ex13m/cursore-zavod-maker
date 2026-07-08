import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'

export interface VortexCursorOptions {
  /** Particle color. Default `#9b5bff`. */
  color?: string
  /** Accretion glow color. Default `#3bdcff`. */
  glowColor?: string
  /** Particles alive at once. Default `140`. */
  particleCount?: number
  /** Pull strength. Default `1`. */
  strength?: number
  /** Enable a low gravitational hum. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

interface P { x: number; y: number; a: number; r: number; vr: number; hueShift: number }

/**
 * A black hole at the pointer: particles from all over the page spiral inward,
 * stretching into streaks as they accelerate, and vanish past the event
 * horizon — then respawn at the edges. The page itself feeds the vortex.
 */
export class VortexCursor extends CanvasEffect {
  readonly id = 'vortex'
  private readonly o: Required<VortexCursorOptions>
  private readonly audio: FxAudio
  private particles: P[] = []

  constructor(options: VortexCursorOptions = {}) {
    super()
    this.o = {
      color: '#9b5bff',
      glowColor: '#3bdcff',
      particleCount: 140,
      strength: 1,
      sound: false,
      volume: 0.5,
      ...options,
    }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  private spawn(): P {
    const w = window.innerWidth
    const h = window.innerHeight
    return {
      x: Math.random() * w,
      y: Math.random() * h,
      a: 0,
      r: 0,
      vr: 0,
      hueShift: Math.random(),
    }
  }

  protected setup(): void {
    this.particles = Array.from({ length: this.o.particleCount }, () => this.spawn())
    for (const p of this.particles) this.initPolar(p)
  }

  private initPolar(p: P): void {
    // convert stored x/y to polar around current pointer later — set on first draw
    p.r = -1
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const cx = state.pointer.x
    const cy = state.pointer.y

    this.audio.rumble(0.35)

    ctx.globalCompositeOperation = 'lighter'
    for (const p of this.particles) {
      if (p.r < 0) {
        // (re)bind particle to the hole in polar coords
        const dx = p.x - cx
        const dy = p.y - cy
        p.r = Math.hypot(dx, dy)
        p.a = Math.atan2(dy, dx)
        p.vr = 0
      }
      // gravity: faster near the core; tangential swirl grows inward
      const pull = (140000 / (p.r + 60)) * o.strength
      p.vr += pull * state.dt
      p.r -= p.vr * state.dt
      p.a += (2.6 + 900 / (p.r + 40)) * state.dt * 0.35

      if (p.r < 12) {
        // swallowed — respawn at an edge
        const edge = Math.floor(Math.random() * 4)
        const w = window.innerWidth
        const h = window.innerHeight
        p.x = edge === 0 ? Math.random() * w : edge === 1 ? Math.random() * w : edge === 2 ? -10 : w + 10
        p.y = edge === 0 ? -10 : edge === 1 ? h + 10 : Math.random() * h
        p.r = -1
        continue
      }

      const x = cx + Math.cos(p.a) * p.r
      const y = cy + Math.sin(p.a) * p.r
      // streak: draw a short arc segment backwards along the orbit
      const tail = Math.min(0.35, 6 / Math.sqrt(p.r + 1) + p.vr * 0.0004)
      const x2 = cx + Math.cos(p.a - tail) * (p.r + p.vr * 0.02)
      const y2 = cy + Math.sin(p.a - tail) * (p.r + p.vr * 0.02)
      const near = Math.max(0, 1 - p.r / 500)
      ctx.strokeStyle = p.hueShift > 0.5 ? o.color : o.glowColor
      ctx.globalAlpha = 0.25 + near * 0.75
      ctx.lineWidth = 1 + near * 1.6
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x, y)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // accretion glow + event horizon
    const grad = ctx.createRadialGradient(cx, cy, 2, cx, cy, 60)
    grad.addColorStop(0, o.glowColor)
    grad.addColorStop(0.35, `${o.color}88`)
    grad.addColorStop(1, 'transparent')
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(cx, cy, 60, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalCompositeOperation = 'source-over'
    ctx.fillStyle = '#000'
    ctx.beginPath()
    ctx.arc(cx, cy, 9 + Math.sin(state.elapsed * 5) * 1.2, 0, Math.PI * 2)
    ctx.fill()
  }

  protected teardown(): void {
    this.audio.dispose()
    this.particles.length = 0
  }
}
