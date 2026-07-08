import type { CursorEffect, CursorState, EffectContext } from '../core/types'

export interface TrailCursorOptions {
  /** Particle color (any CSS color). Default `#ff3b81`. */
  color?: string
  /** Max particle radius in px. Default `7`. */
  size?: number
  /** Particle lifetime in seconds. Default `0.6`. */
  life?: number
  /** Hard cap on simultaneous particles. Default `240`. */
  max?: number
  /** Minimum pointer speed (px/s) before particles spawn. Default `40`. */
  threshold?: number
  /** Canvas composite op. Default `lighter` (additive neon glow). */
  composite?: GlobalCompositeOperation
}

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  age: number
  life: number
  r: number
}

/** A canvas particle trail emitted along the pointer's path. */
export class TrailCursor implements CursorEffect {
  readonly id = 'trail'
  private canvas!: HTMLCanvasElement
  private ctx!: CanvasRenderingContext2D
  private dpr = 1
  private readonly particles: Particle[] = []
  private readonly o: Required<TrailCursorOptions>

  constructor(options: TrailCursorOptions = {}) {
    this.o = {
      color: '#ff3b81',
      size: 7,
      life: 0.6,
      max: 240,
      threshold: 40,
      composite: 'lighter',
      ...options,
    }
  }

  init({ layer }: EffectContext): void {
    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>)
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('TrailCursor: 2D canvas context unavailable')
    this.ctx = ctx
    layer.appendChild(canvas)
    this.resize()
    window.addEventListener('resize', this.resize)
  }

  private readonly resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.floor(window.innerWidth * this.dpr)
    this.canvas.height = Math.floor(window.innerHeight * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  update(state: Readonly<CursorState>): void {
    const { ctx, o } = this

    if (state.speed > o.threshold && this.particles.length < o.max) {
      // Emit a couple of particles per frame, scaled by speed.
      const count = state.speed > o.threshold * 4 ? 2 : 1
      for (let i = 0; i < count; i++) {
        this.particles.push({
          x: state.pointer.x,
          y: state.pointer.y,
          vx: -state.velocity.x * 0.04 + (Math.cos(state.elapsed * 7 + i) * 12),
          vy: -state.velocity.y * 0.04 + (Math.sin(state.elapsed * 7 + i) * 12),
          age: 0,
          life: o.life * (0.7 + 0.3 * ((i + 1) % 2)),
          r: o.size * (0.6 + 0.4 * ((state.elapsed * 13 + i) % 1)),
        })
      }
    }

    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    ctx.globalCompositeOperation = o.composite
    ctx.fillStyle = o.color

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i]!
      p.age += state.dt
      if (p.age >= p.life) {
        this.particles.splice(i, 1)
        continue
      }
      const t = p.age / p.life
      p.x += p.vx * state.dt
      p.y += p.vy * state.dt
      ctx.globalAlpha = (1 - t) * 0.9
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r * (1 - t), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  destroy(): void {
    window.removeEventListener('resize', this.resize)
    this.particles.length = 0
    this.canvas.remove()
  }
}
