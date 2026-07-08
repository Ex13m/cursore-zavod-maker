import type { DropItem } from './api'

/** Render an HMI-styled product cover (PNG data URL) for the bundle. */
export function renderCover(item: DropItem): string {
  const W = 1280
  const H = 720
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  // graphite field
  ctx.fillStyle = '#1a1d21'
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  for (let x = 0; x <= W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke() }
  for (let y = 0; y <= H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke() }

  // strip
  ctx.fillStyle = '#22262b'
  ctx.fillRect(48, 48, W - 96, 54)
  ctx.strokeStyle = '#2e343b'
  ctx.strokeRect(48, 48, W - 96, 54)
  ctx.fillStyle = '#2ecc71'
  ctx.beginPath()
  ctx.arc(76, 75, 6, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = '#9aa3ad'
  ctx.font = '600 20px "IBM Plex Mono", monospace'
  ctx.fillText('CURSOR ZAVOD · СЕРИЙНЫЙ ОБРАЗЕЦ', 96, 82)

  // preview swatch: the cursor's own background + accent shapes
  ctx.fillStyle = item.background
  ctx.fillRect(48, 140, 560, 420)
  ctx.strokeStyle = '#2e343b'
  ctx.strokeRect(48, 140, 560, 420)
  ctx.fillStyle = item.accent
  ctx.beginPath()
  ctx.arc(328, 350, 26, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = item.accent
  ctx.lineWidth = 4
  ctx.beginPath()
  ctx.arc(328, 350, 64, 0, Math.PI * 2)
  ctx.stroke()
  ctx.globalAlpha = 0.35
  ctx.beginPath()
  ctx.arc(328, 350, 130, 0, Math.PI * 2)
  ctx.fillStyle = item.accent
  ctx.fill()
  ctx.globalAlpha = 1

  // name + meta
  ctx.fillStyle = '#e8eaed'
  ctx.font = '800 64px Archivo, sans-serif'
  ctx.fillText(item.name.toUpperCase().slice(0, 16), 656, 260)
  ctx.fillStyle = '#9aa3ad'
  ctx.font = '400 22px "IBM Plex Mono", monospace'
  wrap(ctx, item.description, 656, 310, 540, 32)
  ctx.fillStyle = '#f39c12'
  ctx.font = '600 20px "IBM Plex Mono", monospace'
  ctx.fillText(item.tags.map((t) => `#${t}`).join(' ').slice(0, 46), 656, 440)
  ctx.fillStyle = '#2ecc71'
  ctx.font = '800 56px "IBM Plex Mono", monospace'
  ctx.fillText(`$${item.suggestedPrice}`, 656, 540)

  ctx.fillStyle = '#5c6670'
  ctx.font = '400 16px "IBM Plex Mono", monospace'
  ctx.fillText(`${item.effects.map((e) => e.type).join(' + ')} · cursorfx`, 48, H - 60)

  return canvas.toDataURL('image/png')
}

function wrap(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number): void {
  let line = ''
  let cy = y
  for (const word of text.split(' ')) {
    const test = line ? `${line} ${word}` : word
    if (ctx.measureText(test).width > max && line) {
      ctx.fillText(line, x, cy)
      line = word
      cy += lh
    } else line = test
  }
  if (line) ctx.fillText(line, x, cy)
}
