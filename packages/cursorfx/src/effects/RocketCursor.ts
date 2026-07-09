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

    // --- rocket body (polished: metal gradient, glints, layered exhaust) ---
    ctx.save()
    ctx.translate(this.x, this.y)
    ctx.rotate(this.angle + Math.PI / 2)

    // exhaust bloom right at the nozzle (under the hull)
    if (thrust > 0.05) {
      const flameLen = 16 + 18 * thrust + Math.random() * 6
      const bloom = ctx.createRadialGradient(0, 14, 1, 0, 16, flameLen)
      bloom.addColorStop(0, '#ffffff')
      bloom.addColorStop(0.25, o.flameColor)
      bloom.addColorStop(1, 'transparent')
      ctx.globalCompositeOperation = 'lighter'
      ctx.fillStyle = bloom
      ctx.beginPath()
      ctx.moveTo(-4.5, 10)
      ctx.quadraticCurveTo(0, 14 + flameLen, 4.5, 10)
      ctx.closePath()
      ctx.fill()
      // inner white core
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      ctx.beginPath()
      ctx.moveTo(-2, 10)
      ctx.quadraticCurveTo(0, 12 + flameLen * 0.45, 2, 10)
      ctx.closePath()
      ctx.fill()
      ctx.globalCompositeOperation = 'source-over'
    }

    // fins behind hull: gradient, swept
    const finGrad = ctx.createLinearGradient(0, 2, 0, 15)
    finGrad.addColorStop(0, o.flameColor)
    finGrad.addColorStop(1, '#7a3502')
    ctx.fillStyle = finGrad
    ctx.beginPath(); ctx.moveTo(6.5, 2); ctx.quadraticCurveTo(15, 8, 13.5, 15); ctx.lineTo(6.5, 11); ctx.closePath(); ctx.fill()
    ctx.beginPath(); ctx.moveTo(-6.5, 2); ctx.quadraticCurveTo(-15, 8, -13.5, 15); ctx.lineTo(-6.5, 11); ctx.closePath(); ctx.fill()

    // hull: brushed metal (light source top-left), soft ambient glow
    ctx.shadowColor = o.flameColor
    ctx.shadowBlur = thrust > 0.05 ? 14 : 6
    const hull = ctx.createLinearGradient(-8, 0, 8, 0)
    hull.addColorStop(0, '#8d99a6')
    hull.addColorStop(0.35, '#f4f7fa')
    hull.addColorStop(0.55, '#cfd8e0')
    hull.addColorStop(1, '#6d7884')
    ctx.fillStyle = hull
    ctx.beginPath()
    ctx.moveTo(0, -19)
    ctx.bezierCurveTo(7.5, -12, 8.2, -2, 7, 10)
    ctx.lineTo(-7, 10)
    ctx.bezierCurveTo(-8.2, -2, -7.5, -12, 0, -19)
    ctx.fill()
    ctx.shadowBlur = 0

    // nose cone tint + specular streak
    const nose = ctx.createLinearGradient(0, -19, 0, -8)
    nose.addColorStop(0, o.flameColor)
    nose.addColorStop(1, 'rgba(255,158,0,0)')
    ctx.fillStyle = nose
    ctx.beginPath()
    ctx.moveTo(0, -19)
    ctx.bezierCurveTo(6, -13.5, 6.8, -9, 6.4, -7)
    ctx.lineTo(-6.4, -7)
    ctx.bezierCurveTo(-6.8, -9, -6, -13.5, 0, -19)
    ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.75)'
    ctx.lineWidth = 1.2
    ctx.beginPath()
    ctx.moveTo(-3.2, -14)
    ctx.quadraticCurveTo(-4.6, -6, -4.2, 4)
    ctx.stroke()

    // panel seam + nozzle collar
    ctx.strokeStyle = 'rgba(40,48,56,0.5)'
    ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(-6.6, 2); ctx.lineTo(6.6, 2); ctx.stroke()
    const collar = ctx.createLinearGradient(-5, 0, 5, 0)
    collar.addColorStop(0, '#39424c')
    collar.addColorStop(0.5, '#9aa7b3')
    collar.addColorStop(1, '#2c343c')
    ctx.fillStyle = collar
    ctx.fillRect(-5, 9, 10, 3.4)

    // cockpit: glass sphere with sky reflection and glint
    const glass = ctx.createRadialGradient(-1.2, -6.2, 0.4, 0, -5, 4.2)
    glass.addColorStop(0, '#eaf7ff')
    glass.addColorStop(0.45, '#5ec1f0')
    glass.addColorStop(1, '#14547e')
    ctx.fillStyle = glass
    ctx.beginPath(); ctx.arc(0, -5, 3.8, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = 'rgba(255,255,255,0.65)'
    ctx.lineWidth = 0.9
    ctx.beginPath(); ctx.arc(0, -5, 3.8, -2.4, -0.9); ctx.stroke()

    // legs when landing: hinged struts with feet
    if (this.mode !== 'chase') {
      ctx.strokeStyle = '#8a93a0'
      ctx.lineWidth = 2.2
      ctx.lineCap = 'round'
      ctx.beginPath(); ctx.moveTo(5.5, 9); ctx.lineTo(11, 17); ctx.moveTo(-5.5, 9); ctx.lineTo(-11, 17); ctx.stroke()
      ctx.strokeStyle = '#5c6670'
      ctx.beginPath(); ctx.moveTo(8.6, 17.6); ctx.lineTo(13.4, 17.6); ctx.moveTo(-8.6, 17.6); ctx.lineTo(-13.4, 17.6); ctx.stroke()
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
