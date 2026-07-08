import type { CursorState } from '../core/types'
import { CanvasEffect } from './CanvasEffect'
import { FxAudio } from '../core/sound'

export interface DogfightCursorOptions {
  /** Fugitive ship color. Default `#3bdcff`. */
  shipColor?: string
  /** Hunter ships color. Default `#ff4d6d`. */
  hunterColor?: string
  /** Laser bolt color. Default `#ffd400`. */
  boltColor?: string
  /** Number of hunters (2–5). Default `3`. */
  hunters?: number
  /** Seconds of stillness before the hunters land their shots. Default `0.8`. */
  doomAfter?: number
  /** Enable laser/explosion sound. Default `false`. */
  sound?: boolean
  /** Sound volume 0..1. Default `0.5`. */
  volume?: number
}

interface Hunter { x: number; y: number; vx: number; vy: number; phase: number; gun: number }
interface Bolt { x: number; y: number; vx: number; vy: number; aimed: boolean }
interface Debris { x: number; y: number; vx: number; vy: number; age: number; life: number; r: number; spark: boolean }

/**
 * Space dogfight: YOUR cursor is the fugitive fighter, a squadron chases it,
 * firing lasers (occasionally on their own, always when you click). Missed
 * bolts fly off-screen. Freeze — and they finally land the shot: the fugitive
 * explodes, the squadron circles wide over the wreck in victory. Move again —
 * the fighter respawns and the hunt is back on.
 */
export class DogfightCursor extends CanvasEffect {
  readonly id = 'dogfight'
  private readonly o: Required<DogfightCursorOptions>
  private readonly audio: FxAudio
  private hunters: Hunter[] = []
  private readonly bolts: Bolt[] = []
  private readonly debris: Debris[] = []
  private mode: 'chase' | 'wreck' = 'chase'
  private still = 0
  private wreckX = 0
  private wreckY = 0
  private circleA = 0
  private shipAngle = 0
  private wasPressed = false
  private respawn = 1 // 0..1 fade-in

  constructor(options: DogfightCursorOptions = {}) {
    super()
    this.o = {
      shipColor: '#3bdcff',
      hunterColor: '#ff4d6d',
      boltColor: '#ffd400',
      hunters: 3,
      doomAfter: 0.8,
      sound: false,
      volume: 0.5,
      ...options,
    }
    this.audio = new FxAudio(this.o.sound, this.o.volume)
  }

  protected setup(): void {
    const n = Math.max(2, Math.min(5, this.o.hunters))
    this.hunters = Array.from({ length: n }, (_, i) => ({
      x: window.innerWidth / 2 + (i - n / 2) * 90,
      y: window.innerHeight + 60 + i * 40,
      vx: 0, vy: 0,
      phase: i * 2.4,
      gun: 0.6 + i * 0.5,
    }))
  }

  private ship(ctx: CanvasRenderingContext2D, x: number, y: number, a: number, color: string, scale = 1, alpha = 1): void {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(a + Math.PI / 2)
    ctx.scale(scale, scale)
    ctx.globalAlpha = alpha
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(0, -14)       // nose
    ctx.lineTo(9, 8)
    ctx.lineTo(4, 5)
    ctx.lineTo(0, 10)
    ctx.lineTo(-4, 5)
    ctx.lineTo(-9, 8)
    ctx.closePath()
    ctx.fill()
    // engine flare
    ctx.fillStyle = '#ffffff'
    ctx.globalAlpha = alpha * (0.5 + Math.random() * 0.5)
    ctx.beginPath()
    ctx.ellipse(0, 11, 2.2, 4 + Math.random() * 3, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    ctx.globalAlpha = 1
  }

  private fire(h: Hunter, tx: number, ty: number, aimed: boolean): void {
    const dx = tx - h.x
    const dy = ty - h.y
    // прицельный выстрел летит точно, обычный — с разбросом (уйдёт за экран)
    const spread = aimed ? 0 : (Math.random() - 0.5) * 0.5
    const a = Math.atan2(dy, dx) + spread
    const v = 900
    this.bolts.push({ x: h.x, y: h.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, aimed })
    this.audio.beep({ freq: 1200 + Math.random() * 500, slide: -700, duration: 0.07, type: 'square', gain: 0.035 })
  }

  private explode(x: number, y: number): void {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2
      const v = 60 + Math.random() * 380
      this.debris.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v,
        age: 0, life: 0.5 + Math.random() * 0.7,
        r: 1.5 + Math.random() * 3.5,
        spark: Math.random() > 0.4,
      })
    }
    this.audio.burst({ duration: 0.35, gain: 0.14, lowpass: 900 })
  }

  protected draw(state: Readonly<CursorState>): void {
    const { ctx, o } = this
    const px = state.pointer.x
    const py = state.pointer.y
    const w = window.innerWidth
    const h = window.innerHeight

    if (state.speed > 8) this.shipAngle = Math.atan2(state.velocity.y, state.velocity.x)
    this.still = state.speed < 25 ? this.still + state.dt : 0

    // -------- mode machine --------
    if (this.mode === 'chase' && this.still > o.doomAfter) {
      // роковой залп: каждый охотник бьёт прицельно
      for (const hn of this.hunters) this.fire(hn, px, py, true)
    }
    if (this.mode === 'wreck' && state.speed > 60) {
      this.mode = 'chase'
      this.respawn = 0
    }
    this.respawn = Math.min(1, this.respawn + state.dt * 2.2)

    // -------- hunters --------
    for (const [i, hn] of this.hunters.entries()) {
      hn.phase += state.dt
      let tx: number
      let ty: number
      if (this.mode === 'wreck') {
        // широкий победный круг над обломками
        const a = this.circleA + (i / this.hunters.length) * Math.PI * 2
        tx = this.wreckX + Math.cos(a) * 130
        ty = this.wreckY + Math.sin(a) * 130
      } else {
        // погоня строем позади беглеца
        const back = this.shipAngle + Math.PI
        const lag = 90 + i * 55
        tx = px + Math.cos(back + Math.sin(hn.phase * 1.3 + i) * 0.5) * lag
        ty = py + Math.sin(back + Math.sin(hn.phase * 1.1 + i) * 0.5) * lag
      }
      const dx = tx - hn.x
      const dy = ty - hn.y
      hn.vx += dx * 5.2 * state.dt
      hn.vy += dy * 5.2 * state.dt
      hn.vx *= 1 - Math.min(1, state.dt * 2.6)
      hn.vy *= 1 - Math.min(1, state.dt * 2.6)
      hn.x += hn.vx * state.dt
      hn.y += hn.vy * state.dt

      const ang = this.mode === 'wreck'
        ? Math.atan2(hn.vy, hn.vx)
        : Math.atan2(py - hn.y, px - hn.x)
      this.ship(ctx, hn.x, hn.y, ang, o.hunterColor, 0.92)

      // стрельба: по клику — все; иногда сами в погоне
      if (this.mode === 'chase') {
        hn.gun -= state.dt
        const clicked = state.pressed && !this.wasPressed
        if (clicked || (hn.gun <= 0 && Math.random() < 0.6)) {
          hn.gun = 0.7 + Math.random() * 1.1
          this.fire(hn, px, py, false)
        }
      }
    }
    this.circleA += state.dt * 1.1
    this.wasPressed = state.pressed

    // -------- bolts --------
    ctx.globalCompositeOperation = 'lighter'
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]!
      b.x += b.vx * state.dt
      b.y += b.vy * state.dt
      // попадание — только прицельные и только пока беглец жив
      if (b.aimed && this.mode === 'chase' && Math.hypot(b.x - px, b.y - py) < 16) {
        this.bolts.splice(i, 1)
        this.mode = 'wreck'
        this.wreckX = px
        this.wreckY = py
        this.explode(px, py)
        continue
      }
      if (b.x < -40 || b.x > w + 40 || b.y < -40 || b.y > h + 40) {
        this.bolts.splice(i, 1) // промахи улетают за экран
        continue
      }
      const len = 16
      const d = Math.hypot(b.vx, b.vy)
      ctx.strokeStyle = o.boltColor
      ctx.lineWidth = 2.4
      ctx.beginPath()
      ctx.moveTo(b.x - (b.vx / d) * len, b.y - (b.vy / d) * len)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
    }

    // -------- debris / explosion --------
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const dbr = this.debris[i]!
      dbr.age += state.dt
      if (dbr.age >= dbr.life) { this.debris.splice(i, 1); continue }
      const t = dbr.age / dbr.life
      dbr.x += dbr.vx * state.dt
      dbr.y += dbr.vy * state.dt
      dbr.vx *= 1 - state.dt * 1.4
      dbr.vy *= 1 - state.dt * 1.4
      ctx.globalAlpha = 1 - t
      ctx.fillStyle = dbr.spark ? o.boltColor : o.hunterColor
      ctx.beginPath()
      ctx.arc(dbr.x, dbr.y, dbr.r * (1 - t * 0.6), 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'

    // -------- fugitive / wreck --------
    if (this.mode === 'chase') {
      this.ship(ctx, px, py, this.shipAngle, o.shipColor, 1.05, this.respawn)
    } else {
      // тлеющие обломки
      ctx.fillStyle = o.hunterColor
      ctx.globalAlpha = 0.5 + Math.random() * 0.3
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        ctx.arc(this.wreckX + Math.sin(i * 2.4) * 7, this.wreckY + Math.cos(i * 3.1) * 6, 2.4, 0, Math.PI * 2)
        ctx.fill()
      }
      ctx.globalAlpha = 1
      // курсор-точка, чтобы не потеряться
      ctx.fillStyle = '#e8eaed'
      ctx.beginPath()
      ctx.arc(px, py, 2.5, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  protected teardown(): void {
    this.audio.dispose()
    this.bolts.length = 0
    this.debris.length = 0
    this.hunters.length = 0
  }
}
