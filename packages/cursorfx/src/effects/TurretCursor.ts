import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'

export interface TurretCursorOptions {
  /** Tracer/flash color. Default `#ffd400`. */
  color?: string
  /** Barrel color. Default `#8a93a0`. */
  barrelColor?: string
  /** Shots per second per turret while firing. Default `7`. */
  fireRate?: number
  /** Fire while the pointer moves faster than this (px/s). Default `140`. */
  moveThreshold?: number
  /** Enable generated gunfire sound. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

interface Tracer { x0: number; y0: number; x1: number; y1: number; age: number; life: number }
interface Spark { x: number; y: number; vx: number; vy: number; age: number; life: number }

/**
 * Gunner-cabin cursor: two turrets at the bottom corners aim at the pointer
 * and open fire while it moves (or the button is held). Crosshair at the
 * pointer, tracers, muzzle flashes and hit sparks — you are the gunner.
 */
export class TurretCursor extends CanvasEffect {
  readonly id = 'turret'
  private readonly o: Required<TurretCursorOptions>
  private readonly audio: FxAudio
  private readonly tracers: Tracer[] = []
  private readonly sparks: Spark[] = []
  private cooldown = [0, 0]
  private flash = [0, 0]
  private recoil = [0, 0]

  constructor(options: TurretCursorOptions = {}) {
    super()
    this.o = {
      color: '#ffd400',
      barrelColor: '#8a93a0',
      fireRate: 7,
      moveThreshold: 140,
      sound: false,
      volume: 0.5,
      ...options,
    }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  private turretPos(i: number): { x: number; y: number } {
    const w = window.innerWidth
    const h = window.innerHeight
    return i === 0 ? { x: w * 0.12, y: h + 6 } : { x: w * 0.88, y: h + 6 }
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const firing = state.pressed || state.speed > o.moveThreshold
    const px = state.pointer.x
    const py = state.pointer.y

    for (let i = 0; i < 2; i++) {
      const t = this.turretPos(i)
      const angle = Math.atan2(py - t.y, px - t.x)
      this.cooldown[i] -= state.dt
      this.flash[i] = Math.max(0, this.flash[i]! - state.dt * 12)
      this.recoil[i] = Math.max(0, this.recoil[i]! - state.dt * 90)

      if (firing && this.cooldown[i]! <= 0) {
        this.cooldown[i] = 1 / o.fireRate + Math.random() * 0.02
        this.flash[i] = 1
        this.recoil[i] = 7
        const mx = t.x + Math.cos(angle) * (58 - this.recoil[i]!)
        const my = t.y + Math.sin(angle) * (58 - this.recoil[i]!)
        // slight spread so both guns don't draw the same line
        const jx = px + (Math.random() - 0.5) * 14
        const jy = py + (Math.random() - 0.5) * 14
        this.tracers.push({ x0: mx, y0: my, x1: jx, y1: jy, age: 0, life: 0.09 })
        for (let s = 0; s < 4; s++) {
          const a = Math.random() * Math.PI * 2
          const v = 60 + Math.random() * 160
          this.sparks.push({ x: jx, y: jy, vx: Math.cos(a) * v, vy: Math.sin(a) * v, age: 0, life: 0.25 + Math.random() * 0.2 })
        }
        this.audio.burst({ duration: 0.09, gain: 0.07, lowpass: 2200 })
      }

      // barrel
      const len = 58 - this.recoil[i]!
      ctx.save()
      ctx.translate(t.x, t.y)
      ctx.rotate(angle)
      ctx.fillStyle = o.barrelColor
      ctx.fillRect(0, -5, len, 10)
      ctx.fillStyle = '#5c6670'
      ctx.beginPath()
      ctx.arc(0, 0, 16, 0, Math.PI * 2)
      ctx.fill()
      if (this.flash[i]! > 0) {
        ctx.globalAlpha = this.flash[i]!
        ctx.fillStyle = o.color
        ctx.beginPath()
        ctx.arc(len + 6, 0, 9 + Math.random() * 4, 0, Math.PI * 2)
        ctx.fill()
        ctx.globalAlpha = 1
      }
      ctx.restore()
    }

    // tracers
    ctx.strokeStyle = o.color
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i]!
      tr.age += state.dt
      if (tr.age >= tr.life) { this.tracers.splice(i, 1); continue }
      const t = tr.age / tr.life
      ctx.globalAlpha = 1 - t
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(tr.x0 + (tr.x1 - tr.x0) * t * 0.7, tr.y0 + (tr.y1 - tr.y0) * t * 0.7)
      ctx.lineTo(tr.x1, tr.y1)
      ctx.stroke()
    }

    // hit sparks
    ctx.fillStyle = o.color
    for (let i = this.sparks.length - 1; i >= 0; i--) {
      const s = this.sparks[i]!
      s.age += state.dt
      if (s.age >= s.life) { this.sparks.splice(i, 1); continue }
      s.x += s.vx * state.dt
      s.y += s.vy * state.dt
      ctx.globalAlpha = 1 - s.age / s.life
      ctx.fillRect(s.x, s.y, 2.5, 2.5)
    }
    ctx.globalAlpha = 1

    // crosshair at the pointer
    ctx.strokeStyle = firing ? o.color : '#e8eaed'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.arc(px, py, 14, 0, Math.PI * 2)
    ctx.stroke()
    ctx.beginPath()
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      ctx.moveTo(px + dx * 8, py + dy * 8)
      ctx.lineTo(px + dx * 20, py + dy * 20)
    }
    ctx.stroke()
  }

  protected teardown(): void {
    this.audio.dispose()
    this.tracers.length = 0
    this.sparks.length = 0
  }
}
