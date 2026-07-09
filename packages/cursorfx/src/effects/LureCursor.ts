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

/** Осветлить/затемнить hex-цвет (factor >1 светлее, <1 темнее). */
function shade(hex: string, factor: number): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return hex
  const c = (i: number) => Math.max(0, Math.min(255, Math.round(parseInt(h.slice(i, i + 2), 16) * factor)))
  return `rgb(${c(0)} ${c(2)} ${c(4)})`
}

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

      // мягкое подводное свечение вокруг рыбы
      ctx.shadowColor = o.fishColor
      ctx.shadowBlur = 10

      // tail: полупрозрачный веер, машет
      ctx.fillStyle = o.fishColor
      ctx.globalAlpha = 0.7
      ctx.beginPath()
      ctx.moveTo(-11, 0)
      ctx.quadraticCurveTo(-19, -8 + wig * 12, -23, -5 + wig * 11)
      ctx.quadraticCurveTo(-18, 0 + wig * 6, -23, 6 + wig * 11)
      ctx.quadraticCurveTo(-19, 8 + wig * 12, -11, 0)
      ctx.fill()
      ctx.globalAlpha = 1

      // body: градиент спинка→брюшко (свет сверху)
      const body = ctx.createLinearGradient(0, -6, 0, 6)
      body.addColorStop(0, shade(o.fishColor, 1.35))
      body.addColorStop(0.55, o.fishColor)
      body.addColorStop(1, shade(o.fishColor, 0.55))
      ctx.fillStyle = body
      ctx.beginPath()
      ctx.moveTo(14, 0)
      ctx.quadraticCurveTo(9, -6.5, -2, -5.5)
      ctx.quadraticCurveTo(-10, -4, -12, 0)
      ctx.quadraticCurveTo(-10, 4, -2, 5.5)
      ctx.quadraticCurveTo(9, 6.5, 14, 0)
      ctx.fill()
      ctx.shadowBlur = 0

      // спинной и грудной плавники
      ctx.fillStyle = shade(o.fishColor, 1.2)
      ctx.globalAlpha = 0.8
      ctx.beginPath(); ctx.moveTo(1, -5.2); ctx.quadraticCurveTo(-2, -10 + wig * 3, -6, -5); ctx.closePath(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(2, 3); ctx.quadraticCurveTo(-1, 8 + wig * 4, -4, 4.4); ctx.closePath(); ctx.fill()
      ctx.globalAlpha = 1

      // жаберная дуга + чешуйный блик
      ctx.strokeStyle = 'rgba(13,17,22,0.35)'
      ctx.lineWidth = 0.9
      ctx.beginPath(); ctx.arc(5.5, 0, 4.6, -1.1, 1.1); ctx.stroke()
      ctx.strokeStyle = 'rgba(255,255,255,0.5)'
      ctx.beginPath(); ctx.moveTo(9, -2.6); ctx.quadraticCurveTo(2, -4.2, -5, -3); ctx.stroke()

      // глаз с бликом
      ctx.fillStyle = '#eef4f8'
      ctx.beginPath(); ctx.arc(9, -1.6, 2.2, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#0d1116'
      ctx.beginPath(); ctx.arc(9.5, -1.5, 1.3, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath(); ctx.arc(10, -2, 0.55, 0, Math.PI * 2); ctx.fill()
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

    // --- the wobbler lure at the pointer (глянцевый, с лопастью и бликом) ---
    const tilt = Math.sin(this.wobble) * (idle ? 0.15 : 0.5)
    ctx.save()
    ctx.translate(px, py)
    ctx.rotate(tilt)
    // леска с лёгким провисом
    ctx.strokeStyle = 'rgba(200,214,224,0.45)'
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(0, -10)
    ctx.quadraticCurveTo(4, -34, 7, -62)
    ctx.stroke()
    // вертлюжок
    ctx.fillStyle = '#9aa7b3'
    ctx.beginPath(); ctx.arc(0, -10, 1.6, 0, Math.PI * 2); ctx.fill()

    // тело: объёмный градиент + мягкое свечение
    ctx.shadowColor = o.lureColor
    ctx.shadowBlur = 8
    const lureBody = ctx.createLinearGradient(-6, 0, 6, 0)
    lureBody.addColorStop(0, shade(o.lureColor, 0.6))
    lureBody.addColorStop(0.45, o.lureColor)
    lureBody.addColorStop(1, shade(o.lureColor, 1.35))
    ctx.fillStyle = lureBody
    ctx.beginPath()
    ctx.ellipse(0, 0, 6, 11, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.shadowBlur = 0
    // белое брюшко с перламутром
    const belly = ctx.createLinearGradient(0, -9, 0, 2)
    belly.addColorStop(0, '#ffffff')
    belly.addColorStop(1, '#cfe6ef')
    ctx.fillStyle = belly
    ctx.beginPath()
    ctx.ellipse(0.5, -4, 4.2, 5.2, 0.15, 0, Math.PI * 2)
    ctx.fill()
    // глянцевый блик
    ctx.fillStyle = 'rgba(255,255,255,0.8)'
    ctx.beginPath()
    ctx.ellipse(-2.4, -5.5, 1.1, 3, -0.35, 0, Math.PI * 2)
    ctx.fill()
    // глаз приманки
    ctx.fillStyle = '#ffd400'
    ctx.beginPath(); ctx.arc(2.6, -6, 1.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#0d1116'
    ctx.beginPath(); ctx.arc(2.9, -6, 0.8, 0, Math.PI * 2); ctx.fill()
    // лопасть-заглубитель
    ctx.fillStyle = 'rgba(190,220,235,0.55)'
    ctx.beginPath()
    ctx.ellipse(0, 11.5, 3.2, 5, 0, 0, Math.PI * 2)
    ctx.fill()
    // тройник
    ctx.strokeStyle = '#aeb9c4'
    ctx.lineWidth = 1.4
    ctx.lineCap = 'round'
    for (const rot of [-0.5, 0.35, 1.2]) {
      ctx.beginPath()
      ctx.arc(Math.sin(rot) * 2, 16 + Math.cos(rot), 3.6, rot - 0.2, rot + Math.PI * 0.85)
      ctx.stroke()
    }
    ctx.restore()
  }

  protected teardown(): void {
    this.audio.dispose()
    this.bubbles.length = 0
  }
}
