import type { CursorEffect, CursorState } from './types'
import { expSmooth } from './math'

export interface CursorEngineOptions {
  /** The effects (layers) that make up this cursor, drawn back-to-front. */
  effects: CursorEffect[]
  /** Where to mount the overlay. Defaults to `document.body`. */
  root?: HTMLElement
  /** CSS selector for elements that should trigger the hover state. */
  hoverSelector?: string
  /** Hide the native OS cursor while the engine runs. Default `true`. */
  hideNativeCursor?: boolean
  /** z-index of the overlay. Default `2147483000` (just below max). */
  zIndex?: number
  /** Half-life (seconds) of the primary smoothed `position`. Default `0.018`. */
  positionHalfLife?: number
}

const DEFAULT_HOVER_SELECTOR =
  'a, button, input, label, select, textarea, summary, [role="button"], [data-cursor-hover]'

const HIDE_STYLE_ID = 'cursorfx-hide-native'

/**
 * The runtime that tracks the pointer, advances a shared {@link CursorState}
 * every animation frame, and drives a stack of {@link CursorEffect}s.
 */
export class CursorEngine {
  readonly state: CursorState
  private readonly effects: CursorEffect[]
  private readonly root: HTMLElement
  private readonly hoverSelector: string
  private readonly hideNative: boolean
  private readonly zIndex: number
  private readonly positionHalfLife: number

  private overlay: HTMLElement | null = null
  private rafId = 0
  private lastTime = 0
  private running = false

  constructor(options: CursorEngineOptions) {
    this.effects = options.effects
    this.root = options.root ?? document.body
    this.hoverSelector = options.hoverSelector ?? DEFAULT_HOVER_SELECTOR
    this.hideNative = options.hideNativeCursor ?? true
    this.zIndex = options.zIndex ?? 2147483000
    this.positionHalfLife = options.positionHalfLife ?? 0.018

    const cx = typeof window !== 'undefined' ? window.innerWidth / 2 : 0
    const cy = typeof window !== 'undefined' ? window.innerHeight / 2 : 0
    this.state = {
      pointer: { x: cx, y: cy },
      position: { x: cx, y: cy },
      previous: { x: cx, y: cy },
      velocity: { x: 0, y: 0 },
      speed: 0,
      pressed: false,
      visible: false,
      hover: null,
      dt: 0,
      elapsed: 0,
      viewport: {
        width: typeof window !== 'undefined' ? window.innerWidth : 0,
        height: typeof window !== 'undefined' ? window.innerHeight : 0,
      },
    }
  }

  /** Mount the overlay, attach listeners and start the animation loop. */
  start(): this {
    if (this.running || typeof window === 'undefined') return this
    this.running = true

    const overlay = document.createElement('div')
    overlay.setAttribute('data-cursorfx', 'overlay')
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      pointerEvents: 'none',
      zIndex: String(this.zIndex),
      overflow: 'visible',
      opacity: '0',
      transition: 'opacity 180ms ease',
    } satisfies Partial<CSSStyleDeclaration>)
    this.root.appendChild(overlay)
    this.overlay = overlay

    for (const effect of this.effects) {
      const layer = document.createElement('div')
      layer.setAttribute('data-cursorfx-effect', effect.id)
      Object.assign(layer.style, {
        position: 'absolute',
        top: '0',
        left: '0',
        width: '0',
        height: '0',
        pointerEvents: 'none',
      } satisfies Partial<CSSStyleDeclaration>)
      overlay.appendChild(layer)
      effect.init({ layer, engine: this })
    }

    if (this.hideNative) this.applyHideNative(true)

    window.addEventListener('pointermove', this.onPointerMove, { passive: true })
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true })
    window.addEventListener('pointerup', this.onPointerUp, { passive: true })
    window.addEventListener('pointerover', this.onPointerOver, { passive: true })
    window.addEventListener('blur', this.onLeave)
    window.addEventListener('resize', this.onResize)
    document.addEventListener('pointerleave', this.onLeave)

    this.lastTime = performance.now()
    this.rafId = requestAnimationFrame(this.tick)
    return this
  }

  /** Stop the loop and detach listeners, but keep effect DOM for a quick restart. */
  stop(): void {
    if (!this.running) return
    this.running = false
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('pointermove', this.onPointerMove)
    window.removeEventListener('pointerdown', this.onPointerDown)
    window.removeEventListener('pointerup', this.onPointerUp)
    window.removeEventListener('pointerover', this.onPointerOver)
    window.removeEventListener('blur', this.onLeave)
    window.removeEventListener('resize', this.onResize)
    document.removeEventListener('pointerleave', this.onLeave)
  }

  /** Fully tear down: stop the loop, destroy effects and remove the overlay. */
  destroy(): void {
    this.stop()
    for (const effect of this.effects) effect.destroy()
    this.overlay?.remove()
    this.overlay = null
    if (this.hideNative) this.applyHideNative(false)
  }

  private readonly tick = (now: number): void => {
    const state = this.state
    let dt = (now - this.lastTime) / 1000
    this.lastTime = now
    // Guard against huge jumps after a tab was backgrounded.
    if (dt > 0.1) dt = 0.1
    state.dt = dt
    state.elapsed += dt

    if (state.hover) {
      // Keep the rect fresh in case the target moved, scrolled or resized.
      if (state.hover.target.isConnected) {
        state.hover.rect = state.hover.target.getBoundingClientRect()
      } else {
        state.hover = null
      }
    }

    const prevX = state.position.x
    const prevY = state.position.y
    state.position.x = expSmooth(prevX, state.pointer.x, this.positionHalfLife, dt)
    state.position.y = expSmooth(prevY, state.pointer.y, this.positionHalfLife, dt)
    state.velocity.x = dt > 0 ? (state.position.x - prevX) / dt : 0
    state.velocity.y = dt > 0 ? (state.position.y - prevY) / dt : 0
    state.speed = Math.hypot(state.velocity.x, state.velocity.y)
    state.previous.x = prevX
    state.previous.y = prevY

    if (this.overlay) this.overlay.style.opacity = state.visible ? '1' : '0'

    for (const effect of this.effects) effect.update(state)

    if (this.running) this.rafId = requestAnimationFrame(this.tick)
  }

  private readonly onPointerMove = (e: PointerEvent): void => {
    this.state.pointer.x = e.clientX
    this.state.pointer.y = e.clientY
    this.state.visible = true
    const target = e.target as Element | null
    const match = target?.closest?.(this.hoverSelector) ?? null
    if (match) {
      if (this.state.hover?.target !== match) {
        this.state.hover = { target: match, rect: match.getBoundingClientRect() }
      }
    } else {
      this.state.hover = null
    }
  }

  private readonly onPointerOver = (e: PointerEvent): void => {
    const target = e.target as Element | null
    const match = target?.closest?.(this.hoverSelector) ?? null
    if (match && this.state.hover?.target !== match) {
      this.state.hover = { target: match, rect: match.getBoundingClientRect() }
    }
  }

  private readonly onPointerDown = (): void => {
    this.state.pressed = true
  }

  private readonly onPointerUp = (): void => {
    this.state.pressed = false
  }

  private readonly onLeave = (): void => {
    this.state.visible = false
  }

  private readonly onResize = (): void => {
    this.state.viewport.width = window.innerWidth
    this.state.viewport.height = window.innerHeight
  }

  private applyHideNative(on: boolean): void {
    const html = document.documentElement
    if (on) {
      html.classList.add('cursorfx-native-hidden')
      if (!document.getElementById(HIDE_STYLE_ID)) {
        const style = document.createElement('style')
        style.id = HIDE_STYLE_ID
        style.textContent =
          '.cursorfx-native-hidden, .cursorfx-native-hidden * { cursor: none !important; }'
        document.head.appendChild(style)
      }
    } else {
      html.classList.remove('cursorfx-native-hidden')
      document.getElementById(HIDE_STYLE_ID)?.remove()
    }
  }
}
