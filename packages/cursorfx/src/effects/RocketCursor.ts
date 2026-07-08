import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'

export interface RocketCursorOptions {
  /** Hull color. Default `#e8eaed`. */
  color?: string
  /** Flame color. Default `#ff9e00`. */
  flameColor?: string
  /** Max acceleration px/s². Default `2600`. */
  accel?: number
  /** Seconds of pointer stillness before landing. Default `0.9`. */
  landAfter?: number
  /** Enable generated engine rumble. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

interface Flame { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number }

/**
 * A little rocket that chases the pointer with real steering physics.
 * When the pointer goes still, the rocket flips upright, descends and LANDS
 * beside it (legs out, engine off); it lifts off again on the next move.
 */
export class RocketCursor extends CanvasEffect {
  readonly id = 'rocket'
  private readonly o: Required<RocketCursorOptions>
  private readonly audio: FxAudio
  private readonly flames: Flame[] = []
  private x = 0
  private y = 0
  private vx = 0
  private vy = 0
  private angle = -Math.PI / 2
  private still = 0
  private mode: 'chase' | 'land' | 'landed' = 'chase'
  private started = false

  constructor(options: RocketCursorOptions = {}) {
    super()
    this.o = {
      color: '#e8eaed',
      flameColor: '#ff9e00',
      accel: 2600,
      landAfter: 0.9,
      sound: false,
      volume: 0.5,
      ...options,
    }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const px = state.pointer.x
    const py = state.pointer.y
    if (!this.started) {
      this.x = px
      this.y = py + 120
      this.started = true
    }

    // --- mode machine ---
    this.still = state.speed < 30 ? this.still + state.dt : 0
    const padX = px + 46
    const padY = py + 6
    if (this.mode === 'chase' && this.still > o.landAfter) this.mode = 'land'
    if (this.mode !== 'chase' && this.still === 0) this.mode = 'chase'

    let thrust = 0
    if (this.mode === 'chase') {
      // seek with velocity damping — orbit-ish overshoot looks alive
      const dx = px - this.x
      const dy = py - this.y
      const dist = Math.hypot(dx, dy) || 1
      const desiredV = Math.min(dist * 6, 900)
      const dvx = (dx / dist) * desiredV - this.vx
      const dvy = (dy / dist) * desiredV - this.vy
      const dv = Math.hypot(dvx, dvy) || 1
      const a = Math.min(dv * 8, o.accel)
      this.vx += (dvx / dv) * a * state.dt
      this.vy += (dvy / dv) * a * state.dt
      this.x += this.vx * state.dt
      this.y += this.vy * state.dt
      const speed = Math.hypot(this.vx, this.vy)
      if (speed > 12) this.angle = Math.atan2(this.vy, this.vx)
      thrust = Math.min(1, a / o.accel + 0.25)
    } else if (this.mode === 'land') {
      // flip upright and descend onto the pad next to the cursor
      const ta = -Math.PI / 2
      this.angle += (ta - this.angle) * Math.min(1, state.dt * 6)
      this.x += (padX - this.x) * Math.min(1, state.dt * 4)
      this.y += (padY - 26 - this.y) * Math.min(1, state.dt * 2.2)
      this.vx = 0
      this.vy = 40
      thrust = 0.35
      if (Math.abs(this.y - (padY - 26)) < 2 && Math.abs(this.x - padX) < 3) {
        this.mode = 'landed'
        this.audio.burst({ duration: 0.15, gain: 0.05, lowpass: 500 }) // touchdown puff
      }
    } else {
      this.x = padX
      this.y = padY - 26
      this.angle = -Math.PI / 2
      thrust = 0
    }
    this.audio.rumble(thrust)

    // --- flame particles ---
    if (thrust > 0.05) {
      const bx = this.x - Math.cos(this.angle) * 16
      const by = this.y - Math.sin(this.angle) * 16
      for (let i = 0; i < 2; i++) {
        this.flames.push({
          x: bx, y: by,
          vx: -Math.cos(this.angle) * (120 + Math.random() * 120) + (Math.random() - 0.5) * 50,
          vy: -Math.sin(this.angle) * (120 + Math.random() * 120) + (Math.random() - 0.5) * 50,
          age: 0, life: 0.3 + Math.random() * 0.2, r: 3 + Math.random() * 3 * thrust,
        })
      }
    }
    ctx.globalCompositeOperation = 'lighter'
    for (let i = this.flames.length - 1; i >= 0; i--) {
      const f = this.flames[i]!
      f.age += state.dt
      if (f.age >= f.life) { this.flames.splice(i, 1); continue }
      const t = f.age / f.life
      f.x += f.vx * state.dt
      f.y += f.vy * state.dt
      ctx.globalAlpha = (1 - t) * 0.9
      ctx.fillStyle = t < 0.4 ? o.flameColor : '#5c6670'
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r * (1 - t * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    // --- landing pad while landing/landed ---
    if (this.mode !== 'chase') {
      ctx.strokeStyle = '#5c6670'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(padX - 16, padY)
      ctx.lineTo(padX + 16, padY)
      ctx.stroke()
    }

    // --- rocket body ---
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle + Math.PI / 2)
    ctx.fillStyle = o.color
    ctx.beginPath()
    ctx.moveTo(0, -18) // nose
    ctx.quadraticCurveTo(9, -6, 7, 10)
    ctx.lineTo(-7, 10)
    ctx.quadraticCurveTo(-9, -6, 0, -18)
    ctx.fill()
    ctx.fillStyle = o.flameColor
    // fins
    ctx.beginPath(); ctx.moveTo(7, 4); ctx.lineTo(14, 14); ctx.lineTo(7, 12); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-7, 4); ctx.lineTo(-14, 14); ctx.lineTo(-7, 12); ctx.fill()
    // window
    ctx.fillStyle = '#3498db'
    ctx.beginPath(); ctx.arc(0, -4, 3.4, 0, Math.PI * 2); ctx.fill()
    // legs when landing
    if (this.mode !== 'chase') {
      ctx.strokeStyle = '#8a93a0'
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(6, 10); ctx.lineTo(11, 17); ctx.moveTo(-6, 10); ctx.lineTo(-11, 17); ctx.stroke()
    }
    ctx.restore()

    // subtle pointer mark
    ctx.fillStyle = '#e8eaed'
    ctx.beginPath()
    ctx.arc(px, py, 3, 0, Math.PI * 2)
    ctx.fill()
  }

  protected teardown(): void {
    this.audio.dispose()
    this.flames.length = 0
  }
}
