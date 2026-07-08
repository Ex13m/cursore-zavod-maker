import type { CursorEffect, CursorState, EffectContext } from '../core/types'
import { expSmooth } from '../core/math'

export interface RingCursorOptions {
  /** Ring diameter in px when idle. Default `38`. */
  size?: number
  /** Border color. Default `#111111`. */
  color?: string
  /** Border thickness in px. Default `2`. */
  thickness?: number
  /** Follow lag, as a half-life in seconds. Higher = lazier. Default `0.09`. */
  halfLife?: number
  /** Extra px added around a hovered element when wrapping it. Default `8`. */
  hoverPadding?: number
  /** Corner radius (px) used while wrapping a hovered element. Default `10`. */
  hoverRadius?: number
}

/**
 * An outlined ring that lags behind the pointer and morphs to wrap whatever
 * interactive element is hovered — the classic "magnetic" cursor.
 */
export class RingCursor implements CursorEffect {
  readonly id = 'ring'
  private el!: HTMLDivElement
  private cx = 0
  private cy = 0
  private w = 0
  private h = 0
  private readonly o: Required<RingCursorOptions>

  constructor(options: RingCursorOptions = {}) {
    this.o = {
      size: 38,
      color: '#111111',
      thickness: 2,
      halfLife: 0.09,
      hoverPadding: 8,
      hoverRadius: 10,
      ...options,
    }
    this.w = this.h = this.o.size
  }

  init({ layer }: EffectContext): void {
    const el = document.createElement('div')
    Object.assign(el.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      boxSizing: 'border-box',
      border: `${this.o.thickness}px solid ${this.o.color}`,
      borderRadius: '999px',
      willChange: 'transform, width, height',
    } satisfies Partial<CSSStyleDeclaration>)
    this.el = el
    layer.appendChild(el)
  }

  update(state: Readonly<CursorState>): void {
    const hl = this.o.halfLife
    let targetX: number
    let targetY: number
    let targetW: number
    let targetH: number

    if (state.hover) {
      const r = state.hover.rect
      targetX = r.left + r.width / 2
      targetY = r.top + r.height / 2
      targetW = r.width + this.o.hoverPadding * 2
      targetH = r.height + this.o.hoverPadding * 2
      this.el.style.borderRadius = `${this.o.hoverRadius}px`
    } else {
      targetX = state.pointer.x
      targetY = state.pointer.y
      targetW = this.o.size
      targetH = this.o.size
      this.el.style.borderRadius = '999px'
    }

    this.cx = expSmooth(this.cx || targetX, targetX, hl, state.dt)
    this.cy = expSmooth(this.cy || targetY, targetY, hl, state.dt)
    this.w = expSmooth(this.w, targetW, hl, state.dt)
    this.h = expSmooth(this.h, targetH, hl, state.dt)

    this.el.style.width = `${this.w}px`
    this.el.style.height = `${this.h}px`
    this.el.style.transform = `translate3d(${this.cx}px, ${this.cy}px, 0) translate(-50%, -50%)`
  }

  destroy(): void {
    this.el.remove()
  }
}
