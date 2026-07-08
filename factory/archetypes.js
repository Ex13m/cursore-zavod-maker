import { pick, round } from './lib/seed.js'
import { EMOJI } from './trendbank.js'

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
]
