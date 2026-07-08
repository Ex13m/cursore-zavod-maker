import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'
import { expSmooth } from '../core/math'

export interface NoiseBlobCursorOptions {
  /** Base radius px. Default `26`. */
  size?: number
  /** Seconds between colour shifts. Default `2.4`. */
  colorPeriod?: number
  /** Seconds between violent noise bursts. Default `3` (±random). */
  burstEvery?: number
  /** Enable glitch blips on bursts. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

/**
 * An abstract living organism at the pointer: a pulsating blob whose outline
 * is displaced by layered noise. Every few seconds it convulses — a violent
 * jitter burst that shakes it in pseudo-3D (asymmetric squash + chromatic
 * ghosts) — and periodically shifts its colour.
 */
export class NoiseBlobCursor extends CanvasEffect {
  readonly id = 'noiseblob'
  private readonly o: Required<NoiseBlobCursorOptions>
  private readonly audio: FxAudio
  private x = 0
  private y = 0
  private hue = 210
  private hueTarget = 210
  private hueTimer = 0
  private burstTimer = 1.5
  private burst = 0
  private started = false

  constructor(options: NoiseBlobCursorOptions = {}) {
    super()
    this.o = {
      size: 26,
      colorPeriod: 2.4,
      burstEvery: 3,
      sound: false,
      volume: 0.5,
      ...options,
    }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  /** Cheap layered value-noise: sum of sines is enough for an outline. */
  private noise(a: number, t: number): number {
    return (
      Math.sin(a * 3 + t * 2.1) * 0.45 +
      Math.sin(a * 5 - t * 3.3 + 1.7) * 0.3 +
      Math.sin(a * 9 + t * 5.2 + 4.2) * 0.25
    )
  }

  private blobPath(cx: number, cy: number, r: number, t: number, squashX: number, squashY: number): void {
    const { ctx } = this
    const STEPS = 42
    ctx.beginPath()
    for (let i = 0; i <= STEPS; i++) {
      const a = (i / STEPS) * Math.PI * 2
      const n = this.noise(a, t)
      const rr = r * (1 + 0.22 * n + this.burst * 0.35 * Math.sin(a * 13 + t * 40))
      const x = cx + Math.cos(a) * rr * squashX
      const y = cy + Math.sin(a) * rr * squashY
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    if (!this.started) {
      this.x = state.pointer.x
      this.y = state.pointer.y
      this.started = true
    }
    this.x = expSmooth(this.x, state.pointer.x, 0.05, state.dt)
    this.y = expSmooth(this.y, state.pointer.y, 0.05, state.dt)

    // periodic colour shift
    this.hueTimer += state.dt
    if (this.hueTimer > o.colorPeriod) {
      this.hueTimer = 0
      this.hueTarget = (this.hueTarget + 70 + Math.random() * 140) % 360
    }
    this.hue = expSmooth(this.hue, this.hueTarget, 0.35, state.dt)

    // violent convulsion bursts
    this.burstTimer -= state.dt
    if (this.burstTimer <= 0) {
      this.burstTimer = o.burstEvery * (0.6 + Math.random() * 0.8)
      this.burst = 1
      this.audio.beep({ freq: 90 + Math.random() * 500, slide: -60, duration: 0.12, type: 'sawtooth', gain: 0.05 })
      this.audio.burst({ duration: 0.08, gain: 0.04, lowpass: 3000 })
    }
    this.burst = Math.max(0, this.burst - state.dt * 3.2)

    // heartbeat pulse + burst shake
    const pulse = 1 + 0.1 * Math.sin(state.elapsed * 4.6) + 0.05 * Math.sin(state.elapsed * 9.1)
    const jx = this.burst > 0 ? (Math.random() - 0.5) * 22 * this.burst : 0
    const jy = this.burst > 0 ? (Math.random() - 0.5) * 22 * this.burst : 0
    // pseudo-3D: asymmetric squash rotating with time, exaggerated during burst
    const wob = state.elapsed * 2.7
    const squashX = 1 + (0.12 + 0.45 * this.burst) * Math.sin(wob)
    const squashY = 1 + (0.12 + 0.45 * this.burst) * Math.cos(wob * 1.3)

    const r = o.size * pulse
    const cx = this.x + jx
    const cy = this.y + jy

    // chromatic ghosts during bursts (fake 3D shake)
    if (this.burst > 0.05) {
      ctx.globalAlpha = 0.5 * this.burst
      ctx.fillStyle = `hsl(${(this.hue + 120) % 360} 90% 60%)`
      this.blobPath(cx + 8 * this.burst, cy, r, state.elapsed, squashX, squashY)
      ctx.fill()
      ctx.fillStyle = `hsl(${(this.hue + 240) % 360} 90% 60%)`
      this.blobPath(cx - 8 * this.burst, cy + 4 * this.burst, r, state.elapsed + 9, squashX, squashY)
      ctx.fill()
      ctx.globalAlpha = 1
    }

    // core body with inner glow
    const grad = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r * 1.5)
    grad.addColorStop(0, `hsl(${this.hue} 95% 72%)`)
    grad.addColorStop(1, `hsl(${this.hue} 90% 48% / 0.85)`)
    ctx.fillStyle = grad
    this.blobPath(cx, cy, r, state.elapsed, squashX, squashY)
    ctx.fill()

    // nucleus
    ctx.fillStyle = `hsl(${this.hue} 40% 96%)`
    ctx.beginPath()
    ctx.arc(cx + jx * 0.4, cy + jy * 0.4, r * 0.22 * pulse, 0, Math.PI * 2)
    ctx.fill()
  }

  protected teardown(): void {
    this.audio.dispose()
  }
}
