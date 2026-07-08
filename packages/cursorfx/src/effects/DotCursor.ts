import type { CursorEffect, CursorState, EffectContext } from '../core/types'
import { expSmooth } from '../core/math'

export interface DotCursorOptions {
  /** Diameter in px. Default `10`. */
  size?: number
  /** Fill color. Default `#111111`. */
  color?: string
  /** Scale applied while a button is pressed. Default `0.7`. */
  pressScale?: number
  /** Scale applied while hovering an interactive element. Default `2`. */
  hoverScale?: number
  /** CSS mix-blend-mode for the dot. Default `difference`. */
  blendMode?: string
  /** Border radius as a CSS value. Default `50%` (a circle). */
  radius?: string
}

/** A small dot that tracks the smoothed pointer position closely. */
export class DotCursor implements CursorEffect {
  readonly id = 'dot'
  private el!: HTMLDivElement
  private scale = 1
  private readonly o: Required<DotCursorOptions>

  constructor(options: DotCursorOptions = {}) {
    this.o = {
      size: 10,
      color: '#111111',
      pressScale: 0.7,
      hoverScale: 2,
      blendMode: 'difference',
      radius: '50%',
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
      borderRadius: this.o.radius,
      background: this.o.color,
      mixBlendMode: this.o.blendMode,
      willChange: 'transform',
    } satisfies Partial<CSSStyleDeclaration>)
    this.el = el
    layer.appendChild(el)
  }

  update(state: Readonly<CursorState>): void {
    const target = state.pressed ? this.o.pressScale : state.hover ? this.o.hoverScale : 1
    this.scale = expSmooth(this.scale, target, 0.05, state.dt)
    const { x, y } = state.position
    this.el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) scale(${this.scale})`
  }

  destroy(): void {
    this.el.remove()
  }
}
