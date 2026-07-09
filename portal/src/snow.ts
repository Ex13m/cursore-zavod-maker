/**
 * Снегопад над hero-фото: лёгкий canvas-слой (~140 хлопьев, ветер, покачивание,
 * ближние хлопья крупнее и быстрее). Один активный экземпляр: повторный вызов
 * останавливает предыдущий (render() пересоздаёт экраны).
 */

interface Flake {
  x: number
  y: number
  r: number // радиус = «глубина»: крупные ближе, летят быстрее
  vy: number
  sway: number
  phase: number
  alpha: number
}

let stopPrev: (() => void) | null = null

export function mountSnow(canvas: HTMLCanvasElement): void {
  stopPrev?.()

  const ctx = canvas.getContext('2d')
  if (!ctx) return

  let w = 0
  let h = 0
  let flakes: Flake[] = []
  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  const spawn = (atTop = false): Flake => {
    const depth = Math.random() // 0 — дальний план, 1 — ближний
    return {
      x: Math.random() * w,
      y: atTop ? -6 : Math.random() * h,
      r: 0.8 + depth * 2.6,
      vy: 14 + depth * 46,
      sway: 6 + depth * 16,
      phase: Math.random() * Math.PI * 2,
      alpha: 0.35 + depth * 0.6,
    }
  }

  const resize = (): void => {
    const rect = canvas.parentElement?.getBoundingClientRect()
    w = Math.max(1, Math.floor(rect?.width ?? canvas.clientWidth))
    h = Math.max(1, Math.floor(rect?.height ?? canvas.clientHeight))
    canvas.width = Math.floor(w * dpr)
    canvas.height = Math.floor(h * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const count = Math.min(160, Math.round((w * h) / 5200))
    flakes = Array.from({ length: count }, () => spawn(false))
  }

  let raf = 0
  let last = performance.now()
  let elapsed = 0
  const tick = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    elapsed += dt
    const wind = Math.sin(elapsed * 0.25) * 9 // медленно гуляющий ветер

    ctx.clearRect(0, 0, w, h)
    ctx.fillStyle = '#eef4fa'
    for (const f of flakes) {
      f.phase += dt * (0.8 + f.r * 0.35)
      f.y += f.vy * dt
      f.x += (Math.cos(f.phase) * f.sway + wind) * dt
      if (f.y > h + 6) Object.assign(f, spawn(true))
      if (f.x < -8) f.x = w + 6
      if (f.x > w + 8) f.x = -6
      ctx.globalAlpha = f.alpha
      ctx.beginPath()
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2)
      ctx.fill()
    }
    ctx.globalAlpha = 1
    raf = requestAnimationFrame(tick)
  }

  resize()
  window.addEventListener('resize', resize)
  raf = requestAnimationFrame(tick)

  stopPrev = () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    stopPrev = null
  }
}
