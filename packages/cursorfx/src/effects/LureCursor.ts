import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'

export interface LureCursorOptions {
  /** Fish color. Default `#3bdcff`. */
  fishColor?: string
  /** Lure color. Default `#ff4d6d`. */
  lureColor?: string
  /** How many fish chase the lure (1–5). Default `3`. */
  fishCount?: number
  /** Enable water blips. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

interface Fish { x: number; y: number; vx: number; vy: number; phase: number; size: number; orbit: number }
interface Bubble { x: number; y: number; age: number; life: number; r: number }

/**
 * Fishing cursor: the pointer is a wobbler lure; a small school of fish chases
 * it, wiggling. When the lure sits still the fish circle it warily; a jerk of
 * the pointer makes them strike — with a bubble pop.
 */
export class LureCursor extends CanvasEffect {
  readonly id = 'lure'
  private readonly o: Required<LureCursorOptions>
  private readonly audio: FxAudio
  private fish: Fish[] = []
  private readonly bubbles: Bubble[] = []
  private wobble = 0

  constructor(options: LureCursorOptions = {}) {
    super()
    this.o = {
      fishColor: '#3bdcff',
      lureColor: '#ff4d6d',
      fishCount: 3,
      sound: false,
      volume: 0.5,
      ...options,
    }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  protected setup(): void {
    const n = Math.max(1, Math.min(5, this.o.fishCount))
    this.fish = Array.from({ length: n }, (_, i) => ({
      x: window.innerWidth / 2 + (i - n / 2) * 60,
      y: window.innerHeight / 2 + 80,
      vx: 0, vy: 0,
      phase: i * 2.1,
      size: 0.8 + (i % 3) * 0.25,
      orbit: 46 + i * 22,
    }))
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const px = state.pointer.x
    const py = state.pointer.y
    const idle = state.speed < 25
    this.wobble += state.dt * (4 + state.speed * 0.02)

    // strike splash on a sharp jerk
    if (state.speed > 900 && this.bubbles.length < 30) {
      for (let i = 0; i < 5; i++) {
        this.bubbles.push({ x: px, y: py, age: 0, life: 0.5 + Math.random() * 0.4, r: 2 + Math.random() * 3 })
      }
      this.audio.beep({ freq: 320, slide: 260, duration: 0.1, type: 'sine', gain: 0.05 })
    }

    // --- fish steering ---
    for (const [i, f] of this.fish.entries()) {
      f.phase += state.dt * (5 + state.speed * 0.004)
      let tx: number
      let ty: number
      if (idle) {
        // wary orbiting
        const a = state.elapsed * (0.7 + i * 0.13) + f.phase
        tx = px + Math.cos(a) * f.orbit
        ty = py + Math.sin(a) * f.orbit * 0.7
      } else {
        // chase with per-fish lag offset
        tx = px - Math.cos(f.phase * 0.4) * 26 * (i + 1) * 0.5
        ty = py - Math.sin(f.phase * 0.5) * 20 * (i + 1) * 0.5
      }
      const dx = tx - f.x
      const dy = ty - f.y
      f.vx += dx * 6 * state.dt
      f.vy += dy * 6 * state.dt
      f.vx *= 1 - Math.min(1, state.dt * 3.2) // water drag
      f.vy *= 1 - Math.min(1, state.dt * 3.2)
      f.x += f.vx * state.dt
      f.y += f.vy * state.dt

      const ang = Math.atan2(f.vy, f.vx)
      const wig = Math.sin(f.phase * 2) * 0.35
      ctx.save()
      ctx.translate(f.x, f.y)
      ctx.rotate(ang)
      ctx.scale(f.size, f.size)
      ctx.fillStyle = o.fishColor
      // body
      ctx.beginPath()
      ctx.ellipse(0, 0, 14, 6, 0, 0, Math.PI * 2)
      ctx.fill()
      // tail wiggles
      ctx.beginPath()
      ctx.moveTo(-12, 0)
      ctx.lineTo(-22, -6 + wig * 10)
      ctx.lineTo(-22, 6 + wig * 10)
      ctx.closePath()
      ctx.fill()
      // eye
      ctx.fillStyle = '#0d1116'
      ctx.beginPath()
      ctx.arc(8, -1.5, 1.8, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }

    // --- bubbles ---
    ctx.strokeStyle = '#9adcf0'
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      const b = this.bubbles[i]!
      b.age += state.dt
      if (b.age >= b.life) { this.bubbles.splice(i, 1); continue }
      b.y -= 30 * state.dt
      ctx.globalAlpha = 1 - b.age / b.life
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2)
      ctx.stroke()
    }
    ctx.globalAlpha = 1

    // --- the wobbler lure at the pointer ---
    const tilt = Math.sin(this.wobble) * (idle ? 0.15 : 0.5)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(tilt)
    // line up to the surface
    ctx.strokeStyle = 'rgba(154,163,173,0.5)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(6, -60)
    ctx.stroke()
    // body
    ctx.fillStyle = o.lureColor
    ctx.beginPath()
    ctx.ellipse(0, 0, 6, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.beginPath()
    ctx.ellipse(0, -4, 4.5, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    // hook
    ctx.strokeStyle = '#8a93a0'
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.arc(0, 15, 4, -0.3, Math.PI * 1.1)
    ctx.stroke()
    ctx.restore()
  }

  protected teardown(): void {
    this.audio.dispose()
    this.bubbles.length = 0
  }
}
