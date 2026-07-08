import type { CursorEffect, CursorState, EffectContext } from '../core/types'
import { clamp, expSmooth } from '../core/math'

export interface GlowCursorOptions {
  /** Diameter of the glow in px. Default `300`. */
  size?: number
  /** Core color of the radial gradient. Default `#5b8cff`. */
  color?: string
  /** Follow lag as a half-life in seconds. Default `0.16`. */
  halfLife?: number
  /** Base opacity. Default `0.45`. */
  opacity?: number
  /** CSS blend mode. Default `screen`. */
  blendMode?: string
}

/** A big, soft, lazily-trailing radial glow. Looks best on dark backgrounds. */
export class GlowCursor implements CursorEffect {
  readonly id = 'glow'
  private el!: HTMLDivElement
  private x = 0
  private y = 0
  private scale = 1
  private readonly o: Required<GlowCursorOptions>

  constructor(options: GlowCursorOptions = {}) {
    this.o = {
      size: 300,
      color: '#5b8cff',
      halfLife: 0.16,
      opacity: 0.45,
      blendMode: 'screen',
      ...options,
    }
  }

  init({ layer }: EffectContext): void {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: `${this.o.size}px`,
      height: `${this.o.size}px`,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${this.o.color} 0%, transparent 68%)`,
      opacity: String(this.o.opacity),
      mixBlendMode: this.o.blendMode,
      willChange: 'transform',
    } satisfies Partial<CSSStyleDeclaration>)
    this.el = el
    layer.appendChild(el)
  }

  update(state: Readonly<CursorState>): void {
    this.x = expSmooth(this.x || state.pointer.x, state.pointer.x, this.o.halfLife, state.dt)
    this.y = expSmooth(this.y || state.pointer.y, state.pointer.y, this.o.halfLife, state.dt)
    // Swell a little with speed and on hover for a reactive feel.
    const speedScale = 1 + clamp(state.speed * 0.0004, 0, 0.5)
    const target = (state.hover ? 1.25 : 1) * speedScale
    this.scale = expSmooth(this.scale, target, 0.12, state.dt)
    this.el.style.transform = `translate3d(${this.x}px, ${this.y}px, 0) translate(-50%, -50%) scale(${this.scale})`
  }

  destroy(): void {
    this.el.remove()
  }
}
