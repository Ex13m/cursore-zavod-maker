import type { DropItem } from './api'

/**
 * Draws a static picture of the cursor into the card preview canvas —
 * the owner sees WHAT the cursor is before hitting ТЕСТ.
 */
export function drawPreview(canvas: HTMLCanvasElement, item: DropItem): void {
  const W = (canvas.width = 260)
  const H = (canvas.height = 96)
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  ctx.fillStyle = item.background
  ctx.fillRect(0, 0, W, H)

  const cx = W / 2
  const cy = H / 2
  const top = item.effects[item.effects.length - 1]
  const accent = String(top?.options?.color ?? item.accent)
  const ink = item.dark ? '#e8eaed' : '#111'

  // Draw back-to-front so stacks compose like the real cursor.
  for (const fx of item.effects) {
    const o = fx.options ?? {}
    const color = String(o.color ?? item.accent)
    switch (fx.type) {
      case 'glow': {
        const g = ctx.createRadialGradient(cx, cy, 4, cx, cy, 44)
        g.addColorStop(0, color)
        g.addColorStop(1, 'transparent')
        ctx.fillStyle = g
        ctx.fillRect(cx - 46, cy - 46, 92, 92)
        break
      }
      case 'trail': {
        ctx.fillStyle = color
        for (let i = 0; i < 7; i++) {
          const t = i / 7
          ctx.globalAlpha = 1 - t
          ctx.beginPath()
          ctx.arc(cx - 12 - i * 13, cy + Math.sin(i * 1.2) * 6, 5.5 * (1 - t * 0.7), 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1
        break
      }
      case 'ring': {
        const size = Number(o.size ?? 38) / 2
        ctx.strokeStyle = color
        ctx.lineWidth = Number(o.thickness ?? 2)
        const square = String(o.hoverRadius) === '0' || o.hoverRadius === 0
        ctx.beginPath()
        if (square) ctx.rect(cx - size, cy - size, size * 2, size * 2)
        else ctx.arc(cx, cy, size, 0, Math.PI * 2)
        ctx.stroke()
        break
      }
      case 'dot': {
        const r = Number(o.size ?? 10) / 2
        ctx.fillStyle = color
        const square = String(o.radius) === '0%'
        if (square) ctx.fillRect(cx - r, cy - r, r * 2, r * 2)
        else {
          ctx.beginPath()
          ctx.arc(cx, cy, r, 0, Math.PI * 2)
          ctx.fill()
        }
        break
      }
      case 'blob': {
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.ellipse(cx, cy, 15, 9, 0.5, 0, Math.PI * 2)
        ctx.fill()
        break
      }
      case 'image': {
        const src = String(o.src ?? '')
        if (src) {
          // реальный спрайт: подгружаем и дорисовываем поверх, когда придёт
          const img = new Image()
          img.onload = () => {
            const s = Math.min(64, Number(o.size ?? 44) + 16)
            ctx.drawImage(img, cx - s / 2, cy - s / 2, s, s)
          }
          img.src = src
        } else {
          ctx.font = '30px serif'
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillStyle = color
          ctx.fillText('✦', cx, cy)
        }
        break
      }
      case 'turret': {
        // два ствола снизу + перекрестье
        ctx.fillStyle = '#8a93a0'
        ctx.save(); ctx.translate(30, H); ctx.rotate(-0.9); ctx.fillRect(0, -4, 34, 8); ctx.restore()
        ctx.save(); ctx.translate(W - 30, H); ctx.rotate(Math.PI + 0.9); ctx.fillRect(0, -4, 34, 8); ctx.restore()
        ctx.strokeStyle = color
        ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.arc(cx, cy - 6, 10, 0, Math.PI * 2); ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(cx - 16, cy - 6); ctx.lineTo(cx - 6, cy - 6)
        ctx.moveTo(cx + 6, cy - 6); ctx.lineTo(cx + 16, cy - 6)
        ctx.moveTo(cx, cy - 22); ctx.lineTo(cx, cy - 12)
        ctx.moveTo(cx, cy); ctx.lineTo(cx, cy + 10)
        ctx.stroke()
        // трассер
        ctx.strokeStyle = color
        ctx.globalAlpha = 0.7
        ctx.beginPath(); ctx.moveTo(52, H - 14); ctx.lineTo(cx - 8, cy); ctx.stroke()
        ctx.globalAlpha = 1
        break
      }
      case 'rocket': {
        const fc = String(o.flameColor ?? '#ff9e00')
        ctx.save()
        ctx.translate(cx, cy)
        ctx.rotate(0.6)
        ctx.fillStyle = ink
        ctx.beginPath(); ctx.moveTo(0, -16); ctx.quadraticCurveTo(8, -5, 6, 9); ctx.lineTo(-6, 9); ctx.quadraticCurveTo(-8, -5, 0, -16); ctx.fill()
        ctx.fillStyle = fc
        ctx.beginPath(); ctx.moveTo(6, 4); ctx.lineTo(12, 12); ctx.lineTo(6, 11); ctx.fill()
        ctx.beginPath(); ctx.moveTo(-6, 4); ctx.lineTo(-12, 12); ctx.lineTo(-6, 11); ctx.fill()
        // пламя
        ctx.globalAlpha = 0.85
        ctx.beginPath(); ctx.ellipse(0, 17, 4, 9, 0, 0, Math.PI * 2); ctx.fill()
        ctx.restore()
        ctx.globalAlpha = 1
        break
      }
      case 'lure': {
        const fc = String(o.fishColor ?? '#3bdcff')
        const lc = String(o.lureColor ?? '#ff4d6d')
        // рыба
        ctx.fillStyle = fc
        ctx.beginPath(); ctx.ellipse(cx - 34, cy + 8, 15, 6.5, 0.15, 0, Math.PI * 2); ctx.fill()
        ctx.beginPath(); ctx.moveTo(cx - 47, cy + 9); ctx.lineTo(cx - 58, cy + 2); ctx.lineTo(cx - 58, cy + 16); ctx.closePath(); ctx.fill()
        ctx.fillStyle = '#0d1116'
        ctx.beginPath(); ctx.arc(cx - 26, cy + 6, 1.8, 0, Math.PI * 2); ctx.fill()
        // воблер + леска
        ctx.strokeStyle = 'rgba(154,163,173,0.6)'
        ctx.beginPath(); ctx.moveTo(cx + 26, cy - 4); ctx.lineTo(cx + 40, cy - 34); ctx.stroke()
        ctx.fillStyle = lc
        ctx.beginPath(); ctx.ellipse(cx + 24, cy + 2, 6, 10, 0.2, 0, Math.PI * 2); ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.ellipse(cx + 23, cy - 2, 4, 5, 0.2, 0, Math.PI * 2); ctx.fill()
        break
      }
      case 'noiseblob': {
        // рваный пульсирующий контур
        ctx.fillStyle = color === item.accent ? `hsl(280 90% 65%)` : color
        ctx.beginPath()
        for (let i = 0; i <= 30; i++) {
          const a = (i / 30) * Math.PI * 2
          const r = 20 + Math.sin(a * 5) * 4 + Math.sin(a * 9 + 2) * 3
          const x = cx + Math.cos(a) * r * 1.15
          const y = cy + Math.sin(a) * r * 0.9
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath(); ctx.arc(cx, cy, 5, 0, Math.PI * 2); ctx.fill()
        break
      }
    }
  }

  // бейдж эффектов
  ctx.fillStyle = item.dark ? 'rgba(232,234,237,0.55)' : 'rgba(17,17,17,0.55)'
  ctx.font = '10px "IBM Plex Mono", monospace'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.fillText(item.effects.map((e) => e.type).join(' + '), 8, H - 8)
  void accent
}
