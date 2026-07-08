import { pick, round } from './lib/seed.js'
import { EMOJI } from './trendbank.js'

// Статичные спрайты-иконки сняты с производства (решение владельца:
// «иконки на палочке не нужны») — завод делает только динамичные сцены.

/** Emoji → inline SVG data URL, usable as ImageCursor src. */
export function emojiToDataUrl(emoji) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><text x="32" y="50" font-size="52" text-anchor="middle">${emoji}</text></svg>`
  return 'data:image/svg+xml,' + encodeURIComponent(svg)
}

/**
 * Effect-stack archetypes. Each takes (rng, palette) and returns
 * { effects, tags, desc }. Style tags connect archetypes to trend weights.
 */
export const ARCHETYPES = [
  {
    style: 'minimal',
    build: (rng, p) => ({
      effects: [{ type: 'dot', options: { size: round(8 + rng() * 14, 1), color: p.colors[0], blendMode: p.dark ? 'normal' : 'difference' } }],
      tags: ['minimal', 'dot', p.name],
      desc: 'A clean single dot tuned to this palette. Fast, quiet, universal.',
    }),
  },
  {
    style: 'magnetic',
    build: (rng, p) => ({
      effects: [
        { type: 'ring', options: { size: round(30 + rng() * 22, 1), thickness: round(1 + rng() * 3, 1), color: p.colors[0], halfLife: round(0.06 + rng() * 0.08, 0.01), hoverPadding: round(6 + rng() * 8, 1) } },
        { type: 'dot', options: { size: round(5 + rng() * 5, 1), color: p.colors[1] ?? p.colors[0] } },
      ],
      tags: ['ring', 'magnetic', p.name],
      desc: 'A lagging ring that wraps buttons, chasing a tight inner dot.',
    }),
  },
  {
    style: 'glow',
    build: (rng, p) => ({
      effects: [
        { type: 'glow', options: { size: round(220 + rng() * 160, 10), color: p.colors[0], opacity: round(0.3 + rng() * 0.3, 0.05) } },
        { type: 'dot', options: { size: round(6 + rng() * 5, 1), color: '#ffffff' } },
      ],
      tags: ['glow', 'premium', p.name],
      desc: 'A soft trailing halo over a bright core. Built for dark heroes.',
    }),
  },
  {
    style: 'particles',
    build: (rng, p) => ({
      effects: [
        { type: 'trail', options: { color: p.colors[0], size: round(5 + rng() * 6, 1), life: round(0.4 + rng() * 0.5, 0.05) } },
        { type: 'dot', options: { size: round(6 + rng() * 4, 1), color: '#ffffff' } },
      ],
      tags: ['trail', 'particles', 'neon', p.name],
      desc: 'An additive particle stream that flares behind the pointer.',
    }),
  },
  {
    style: 'gooey',
    build: (rng, p) => ({
      effects: [{ type: 'blob', options: { size: round(12 + rng() * 14, 1), color: p.colors[0], blendMode: p.dark ? 'normal' : 'difference' } }],
      tags: ['blob', 'squash', 'fun', p.name],
      desc: 'A gooey blob that squashes and stretches with your speed.',
    }),
  },
  {
    style: 'image',
    build: (rng, p) => {
      const emoji = pick(rng, EMOJI)
      const effects = [
        { type: 'image', options: { src: emojiToDataUrl(emoji), size: round(28 + rng() * 18, 1), spin: round(40 + rng() * 160, 10), pulse: round(rng() * 0.18, 0.02) } },
      ]
      if (rng() > 0.5) effects.unshift({ type: 'trail', options: { color: p.colors[0], size: 5, life: 0.5 } })
      return { effects, tags: ['image', 'animated', 'emoji', p.name], desc: `A spinning ${emoji} cursor with a lively pulse.` }
    },
  },
  {
    style: 'maximal',
    build: (rng, p) => ({
      effects: [
        { type: 'glow', options: { size: round(220 + rng() * 120, 10), color: p.colors[1] ?? p.colors[0], opacity: 0.4 } },
        { type: 'trail', options: { color: p.colors[0], size: round(5 + rng() * 4, 1), life: 0.6 } },
        { type: 'dot', options: { size: 7, color: '#ffffff' } },
      ],
      tags: ['glow', 'trail', 'maximal', p.name],
      desc: 'Glow plus particles plus a bright core. The maximalist showpiece.',
    }),
  },
  {
    style: 'brutal',
    build: (rng, p) => ({
      effects: [
        { type: 'ring', options: { size: round(40 + rng() * 10, 1), thickness: 4, hoverRadius: 0, color: p.colors[0] } },
        { type: 'dot', options: { size: round(12 + rng() * 4, 1), blendMode: 'difference', radius: '0%', color: p.colors[1] ?? p.colors[0] } },
      ],
      tags: ['brutalism', 'bold', 'agency', p.name],
      desc: 'A fat hard dot inside a thick square ring. Raw and loud.',
    }),
  },
  // ---- живые сценарии (звук по умолчанию выключен — тумблер в карточке) ----
  {
    style: 'gunner',
    build: (rng, p) => ({
      effects: [
        { type: 'turret', options: { color: p.colors[0], fireRate: round(5 + rng() * 5, 1), sound: false } },
      ],
      tags: ['scene', 'gunner', 'game', p.name],
      desc: 'You are the gunner: turrets fire from off-screen at your crosshair.',
    }),
  },
  {
    style: 'rocket',
    build: (rng, p) => ({
      effects: [
        { type: 'rocket', options: { flameColor: p.colors[0], accel: round(2200 + rng() * 1200, 100), sound: false } },
      ],
      tags: ['scene', 'rocket', 'chase', p.name],
      desc: 'A rocket chases your pointer — and lands beside it when you stop.',
    }),
  },
  {
    style: 'fishing',
    build: (rng, p) => ({
      effects: [
        { type: 'lure', options: { fishColor: p.colors[0], lureColor: p.colors[1] ?? '#ff4d6d', fishCount: 2 + Math.floor(rng() * 3), sound: false } },
      ],
      tags: ['scene', 'fishing', 'fun', p.name],
      desc: 'Your pointer is a wobbler lure — a school of fish hunts it.',
    }),
  },
  {
    style: 'organism',
    build: (rng, p) => ({
      effects: [
        { type: 'noiseblob', options: { size: round(20 + rng() * 14, 1), colorPeriod: round(1.8 + rng() * 2, 0.1), burstEvery: round(2.5 + rng() * 2, 0.1), sound: false } },
      ],
      tags: ['scene', 'organism', 'abstract', '3d', p.name],
      desc: 'A pulsating abstract organism that convulses in noisy 3D bursts, cycling colours.',
    }),
  },
  // ---- v1.3: сцены, которые МЕНЯЮТ ПРОСТРАНСТВО (по бестселлерам рынка) ----
  {
    style: 'blackhole',
    build: (rng, p) => ({
      effects: [{ type: 'vortex', options: { color: p.colors[0], glowColor: p.colors[1] ?? '#3bdcff', particleCount: round(110 + rng() * 70, 10), sound: false } }],
      tags: ['scene', 'blackhole', 'space', 'gravity', p.name],
      desc: 'A black hole devours the page: particles spiral from every corner into your pointer.',
      background: '#05060a', dark: true, price: 13,
    }),
  },
  {
    style: 'hyperspace',
    build: (rng, p) => ({
      effects: [{ type: 'warp', options: { accent: p.colors[0], starCount: round(130 + rng() * 80, 10) } }],
      tags: ['scene', 'hyperspace', 'space', 'warp', p.name],
      desc: 'Starfield warp: your pointer is the vanishing point — move fast to jump to light speed.',
      background: '#05060a', dark: true, price: 12,
    }),
  },
  {
    style: 'storm',
    build: (rng, p) => ({
      effects: [{ type: 'lightning', options: { color: p.colors[0], rate: round(4 + rng() * 5, 1), sound: false } }],
      tags: ['scene', 'storm', 'electric', 'neon', p.name],
      desc: 'A storm lives in the pointer: branching bolts crackle as you move, a click discharges a full strike.',
      background: '#0a0b14', dark: true, price: 12,
    }),
  },
  {
    style: 'spacetime',
    build: (rng, p) => ({
      effects: [{ type: 'ripple', options: { crestColor: p.colors[0], spacing: round(40 + rng() * 14, 2), amplitude: round(12 + rng() * 10, 1) } }],
      tags: ['scene', 'spacetime', 'grid', 'physics', p.name],
      desc: 'The page becomes fabric: the grid bends in waves around your movement, a click drops a stone.',
      background: '#05060a', dark: true, price: 13,
    }),
  },
  {
    style: 'ribbon',
    build: (rng, p) => ({
      effects: [{ type: 'ribbon', options: { hue: rng() > 0.5 ? -1 : round(rng() * 360, 1), width: round(14 + rng() * 10, 1) } }],
      tags: ['scene', 'ribbon', 'trail', 'silk', p.name],
      desc: 'A luminous silk ribbon flows behind the pointer and settles like fabric when you stop.',
      background: '#0a0b14', dark: true, price: 9,
    }),
  },
  {
    style: 'fireflies',
    build: (rng, p) => ({
      effects: [{ type: 'firefly', options: { color: p.colors[0], count: round(10 + rng() * 8, 1) } }],
      tags: ['scene', 'fireflies', 'swarm', 'alive', p.name],
      desc: 'A living swarm of fireflies wanders around the pointer, blinking — dash and they scatter in fright.',
      background: '#0b130d', dark: true, price: 11,
    }),
  },
  {
    style: 'dogfight',
    build: (rng, p) => ({
      effects: [{ type: 'dogfight', options: { shipColor: p.colors[0], hunterColor: p.colors[1] ?? '#ff4d6d', hunters: 2 + Math.floor(rng() * 3), sound: false } }],
      tags: ['scene', 'dogfight', 'space', 'game', p.name],
      desc: 'You fly the fugitive fighter; a squadron hunts you, lasers flying off-screen. Freeze — you are shot down; move — respawn and run.',
      background: '#05060a', dark: true, price: 14,
    }),
  },
]
