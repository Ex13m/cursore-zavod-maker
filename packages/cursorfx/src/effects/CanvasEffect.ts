import type { CursorEffect, CursorState, EffectContext } from '../core/types'

/**
 * Base for full-screen canvas effects (scenario cursors: turret, rocket, lure…).
 * Handles canvas creation, DPR-aware resize and teardown; subclasses implement
 * {@link draw} and may override {@link setup}.
 */
export abstract class CanvasEffect implements CursorEffect {
  abstract readonly id: string
  protected canvas!: HTMLCanvasElement
  protected ctx!: CanvasRenderingContext2D
  protected dpr = 1

  init({ layer }: EffectContext): void {
    const canvas = document.createElement('canvas')
    Object.assign(canvas.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      pointerEvents: 'none',
    } satisfies Partial<CSSStyleDeclaration>)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(`${this.id}: 2D canvas context unavailable`)
    this.canvas = canvas
    this.ctx = ctx
    layer.appendChild(canvas)
    this.resize()
    window.addEventListener('resize', this.resize)
    this.setup()
  }

  private readonly resize = (): void => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2)
    this.canvas.width = Math.floor(window.innerWidth * this.dpr)
    this.canvas.height = Math.floor(window.innerHeight * this.dpr)
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0)
  }

  /** Optional one-time setup after the canvas exists. */
  protected setup(): void {}

  update(state: Readonly<CursorState>): void {
    this.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight)
    this.draw(state)
  }

  /** Render one frame. The canvas is already cleared. */
  protected abstract draw(state: Readonly<CursorState>): void

  destroy(): void {
    window.removeEventListener('resize', this.resize)
    this.teardown()
    this.canvas.remove()
  }

  /** Optional cleanup besides canvas removal. */
  protected teardown(): void {}
}
