import { VERSION, RELEASE_NOTES } from './version'

const SEEN_KEY = 'zavod.seenVersion'

/**
 * Version announcement: each line bursts out of a random "explosion" somewhere
 * on screen, then slowly flies toward the viewer for ~15s, fading out at the
 * end. Click anywhere to dismiss. Shown once per version.
 */
export function maybeAnnounce(): void {
  if (localStorage.getItem(SEEN_KEY) === VERSION) return
  localStorage.setItem(SEEN_KEY, VERSION)

  const overlay = document.createElement('div')
  overlay.className = 'boom-overlay'
  overlay.addEventListener('click', () => overlay.remove())
  document.body.append(overlay)

  const LINE_LIFE = 15000 // каждая надпись живёт ~15 секунд
  const STAGGER = 1600

  RELEASE_NOTES.forEach((text, i) => {
    setTimeout(() => {
      if (!overlay.isConnected) return
      const x = 12 + Math.random() * 66 // % viewport, с запасом от краёв
      const y = 15 + Math.random() * 60
      const line = document.createElement('div')
      line.className = 'boom-line'
      line.style.left = `${x}%`
      line.style.top = `${y}%`
      line.style.setProperty('--life', `${LINE_LIFE}ms`)
      line.textContent = text

      // взрыв: искры разлетаются из точки появления
      for (let s = 0; s < 14; s++) {
        const p = document.createElement('i')
        p.className = 'boom-spark'
        const a = Math.random() * Math.PI * 2
        const d = 40 + Math.random() * 120
        p.style.setProperty('--dx', `${Math.cos(a) * d}px`)
        p.style.setProperty('--dy', `${Math.sin(a) * d}px`)
        p.style.animationDelay = `${Math.random() * 80}ms`
        line.append(p)
      }

      overlay.append(line)
      setTimeout(() => line.remove(), LINE_LIFE + 500)
    }, i * STAGGER)
  })

  // авто-уборка после последней надписи
  setTimeout(() => overlay.remove(), RELEASE_NOTES.length * STAGGER + LINE_LIFE + 1000)
}
