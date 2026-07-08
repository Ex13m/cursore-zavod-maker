import type { CursorEffect, CursorState, EffectContext } from '../core/types'
import { clamp, expSmooth } from '../core/math'

export interface BlobCursorOptions {
  /** Base diameter in px. Default `16`. */
  size?: number
  /** Fill color. Default `#111111`. */
  color?: string
  /** How strongly velocity stretches the blob. Default `0.0011`. */
  stretch?: number
  /** Scale while hovering an interactive element. Default `2.2`. */
  hoverScale?: number
  /** CSS mix-blend-mode. Default `difference`. */
  blendMode?: string
}

/**
 * A gooey dot that squashes and stretches along its direction of travel,
 * giving a lively, physical feel.
 */
export class BlobCursor implements CursorEffect {
  readonly id = 'blob'
  private el!: HTMLDivElement
  private angle = 0
  private stretchAmt = 1
  private scale = 1
  private readonly o: Required<BlobCursorOptions>

  constructor(options: BlobCursorOptions = {}) {
    this.o = {
      size: 16,
      color: '#111111',
      stretch: 0.0011,
      hoverScale: 2.2,
      blendMode: 'difference',
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
      background: this.o.color,
      mixBlendMode: this.o.blendMode,
      willChange: 'transform',
    } satisfies Partial<CSSStyleDeclaration>)
    this.el = el
    layer.appendChild(el)
  }

  update(state: Readonly<CursorState>): void {
    if (state.speed > 1) {
      this.angle = Math.atan2(state.velocity.y, state.velocity.x)
    }
    const targetStretch = 1 + clamp(state.speed * this.o.stretch, 0, 0.6)
    this.stretchAmt = expSmooth(this.stretchAmt, targetStretch, 0.04, state.dt)
    this.scale = expSmooth(this.scale, state.hover ? this.o.hoverScale : 1, 0.06, state.dt)

    const sx = this.stretchAmt
    const sy = 1 / this.stretchAmt
    const { x, y } = state.position
    this.el.style.transform =
      `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) ` +
      `rotate(${this.angle}rad) scale(${this.scale * sx}, ${this.scale * sy})`
  }

  destroy(): void {
    this.el.remove()
  }
}
