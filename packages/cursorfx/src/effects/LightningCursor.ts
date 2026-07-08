import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'

export interface LightningCursorOptions {
  /** Bolt color. Default `#3bdcff`. */
  color?: string
  /** Core flash color. Default `#ffffff`. */
  coreColor?: string
  /** Bolts per second while moving. Default `6`. */
  rate?: number
  /** Enable crackle sound. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

interface Bolt { points: Array<[number, number]>; age: number; life: number; width: number }

/**
 * A storm lives in the pointer: jagged branching bolts crackle out of it while
 * you move; a click discharges a full radial strike. Neon, loud, alive.
 */
export class LightningCursor extends CanvasEffect {
  readonly id = 'lightning'
  private readonly o: Required<LightningCursorOptions>
  private readonly audio: FxAudio
  private readonly bolts: Bolt[] = []
  private cooldown = 0
  private wasPressed = false

  constructor(options: LightningCursorOptions = {}) {
    super()
    this.o = { color: '#3bdcff', coreColor: '#ffffff', rate: 6, sound: false, volume: 0.5, ...options }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  /** Build a jagged path from (x,y) toward angle a with length len. */
  private forge(x: number, y: number, a: number, len: number, width: number): void {
    const points: Array<[number, number]> = [[x, y]]
    const steps = 8 + Math.floor(Math.random() * 5)
    let px = x
    let py = y
    let pa = a
    for (let i = 0; i < steps; i++) {
      const seg = len / steps
      pa += (Math.random() - 0.5) * 1.1
      px += Math.cos(pa) * seg
      py += Math.sin(pa) * seg
      points.push([px, py])
      // branch occasionally
      if (Math.random() < 0.18 && width > 1) {
        this.forge(px, py, pa + (Math.random() - 0.5) * 1.6, len * 0.4, width * 0.55)
      }
    }
    this.bolts.push({ points, age: 0, life: 0.14 + Math.random() * 0.1, width })
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const px = state.pointer.x
    const py = state.pointer.y

    // strikes while moving
    this.cooldown -= state.dt
    if (state.speed > 60 && this.cooldown <= 0) {
      this.cooldown = 1 / o.rate
      const a = Math.atan2(state.velocity.y, state.velocity.x) + Math.PI + (Math.random() - 0.5) * 1.4
      this.forge(px, py, a, 90 + Math.random() * 140, 2.2)
      this.audio.beep({ freq: 1600 + Math.random() * 900, slide: -1200, duration: 0.05, type: 'sawtooth', gain: 0.03 })
    }
    // full discharge on click
    if (state.pressed && !this.wasPressed) {
      for (let i = 0; i < 7; i++) this.forge(px, py, (i / 7) * Math.PI * 2, 150 + Math.random() * 120, 2.6)
      this.audio.burst({ duration: 0.22, gain: 0.12, lowpass: 3600 })
    }
    this.wasPressed = state.pressed

    ctx.globalCompositeOperation = 'lighter'
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!
      b.age += state.dt
      if (b.age >= b.life) { this.bolts.splice(i, 1); continue }
      const t = 1 - b.age / b.life
      // outer glow pass + white core pass
      for (const [style, w, alpha] of [[o.color, b.width * 3, 0.35 * t], [o.coreColor, b.width, t]] as const) {
        ctx.strokeStyle = style
        ctx.lineWidth = w
        ctx.globalAlpha = alpha
        ctx.beginPath()
        ctx.moveTo(b.points[0]![0], b.points[0]![1])
        for (const [bx, by] of b.points.slice(1)) ctx.lineTo(bx, by)
        ctx.stroke()
      }
    }
    ctx.globalAlpha = 1

    // storm core
    const flick = 0.75 + Math.random() * 0.25
    const grad = ctx.createRadialGradient(px, py, 1, px, py, 26)
    grad.addColorStop(0, o.coreColor)
    grad.addColorStop(0.3, o.color)
    grad.addColorStop(1, 'transparent')
    ctx.globalAlpha = flick
    ctx.fillStyle = grad
    ctx.beginPath()
    ctx.arc(px, py, 26, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  protected teardown(): void {
    this.audio.dispose()
    this.bolts.length = 0
  }
}
