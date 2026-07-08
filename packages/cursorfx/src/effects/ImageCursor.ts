import type { CursorEffect, CursorState, EffectContext } from '../core/types'
import { expSmooth } from '../core/math'

export interface ImageCursorOptions {
  /** Image URL or data URL (PNG/SVG). Emojis can be turned into SVG data URLs. */
  src: string
  /** Rendered size in px. Default `40`. */
  size?: number
  /** Continuous spin speed in degrees per second. Default `0` (no spin). */
  spin?: number
  /** Pulse amplitude as a fraction of size, 0..1. Default `0`. */
  pulse?: number
  /** Pulse speed in cycles per second. Default `2`. */
  pulseSpeed?: number
  /** Scale while hovering an interactive element. Default `1.4`. */
  hoverScale?: number
  /** Follow lag as a half-life in seconds. Default `0.03`. */
  halfLife?: number
}

/** A cursor made from an image or emoji, with optional spin and pulse. */
export class ImageCursor implements CursorEffect {
  readonly id = 'image'
  private el!: HTMLImageElement
  private x = 0
  private y = 0
  private rotation = 0
  private scale = 1
  private readonly o: Required<ImageCursorOptions>

  constructor(options: ImageCursorOptions) {
    this.o = {
      size: 40,
      spin: 0,
      pulse: 0,
      pulseSpeed: 2,
      hoverScale: 1.4,
      halfLife: 0.03,
      ...options,
    }
  }

  init({ layer }: EffectContext): void {
    const el = document.createElement('img')
    el.src = this.o.src
    el.draggable = false
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: `${this.o.size}px`,
      height: `${this.o.size}px`,
      userSelect: 'none',
      willChange: 'transform',
    } satisfies Partial<CSSStyleDeclaration>)
    this.el = el
    layer.appendChild(el)
  }

  update(state: Readonly<CursorState>): void {
    this.x = expSmooth(this.x || state.pointer.x, state.pointer.x, this.o.halfLife, state.dt)
    this.y = expSmooth(this.y || state.pointer.y, state.pointer.y, this.o.halfLife, state.dt)
    this.rotation += this.o.spin * state.dt

    const pulse = this.o.pulse
      ? 1 + this.o.pulse * Math.sin(state.elapsed * this.o.pulseSpeed * Math.PI * 2)
      : 1
    const target = (state.hover ? this.o.hoverScale : 1) * pulse
    this.scale = expSmooth(this.scale, target, 0.06, state.dt)

    this.el.style.transform =
      `translate3d(${this.x}px, ${this.y}px, 0) translate(-50%, -50%) ` +
      `rotate(${this.rotation}deg) scale(${this.scale})`
  }

  destroy(): void {
    this.el.remove()
  }
}
