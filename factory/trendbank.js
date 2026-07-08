/**
 * Built-in trend bank — the offline fallback source for trend-scout.
 * Distilled from 2026 web-design research (aurora glass, dopamine, neo-brutalism,
 * retrofuturism/Y2K, high-performance HMI). Weights are baseline popularity;
 * trend-scout rotates them daily and may blend in live signals.
 */

export const PALETTES = [
  { name: 'aurora',      bg: '#0a0b14', dark: true,  weight: 9, colors: ['#5b8cff', '#9b5bff', '#3bdcff'] },
  { name: 'y2k-neon',    bg: '#0d0221', dark: true,  weight: 8, colors: ['#ff3b81', '#39ff14', '#00e5ff', '#ffd400'] },
  { name: 'dopamine',    bg: '#fff3f8', dark: false, weight: 7, colors: ['#ff4d6d', '#ff9e00', '#8338ec', '#3a86ff'] },
  { name: 'brutalist',   bg: '#f5f5f0', dark: false, weight: 7, colors: ['#111111', '#d9ff00', '#ff3b81'] },
  { name: 'chrome',      bg: '#08010f', dark: true,  weight: 6, colors: ['#c0c0c0', '#7a2bff', '#ff2bd0'] },
  { name: 'mono-ink',    bg: '#ededea', dark: false, weight: 5, colors: ['#111111', '#444444'] },
  { name: 'sunset',      bg: '#1a0b2e', dark: true,  weight: 6, colors: ['#ff6b6b', '#feca57', '#ff9ff3'] },
  { name: 'acid-forest', bg: '#0b130d', dark: true,  weight: 5, colors: ['#39ff14', '#00ffa3', '#baff66'] },
  { name: 'hmi-signal',  bg: '#1a1d21', dark: true,  weight: 6, colors: ['#2ecc71', '#f39c12', '#3498db', '#e74c3c'] },
  { name: 'porcelain',   bg: '#f7f4ef', dark: false, weight: 4, colors: ['#2b6cb0', '#c05621', '#2d3748'] },
]

/** Style tags: bias which archetypes get produced. */
export const STYLES = [
  { tag: 'minimal',   weight: 5 },
  { tag: 'magnetic',  weight: 6 },
  { tag: 'glow',      weight: 6 },
  { tag: 'particles', weight: 5 },
  { tag: 'gooey',     weight: 4 },
  { tag: 'image',     weight: 2 }, // статичные иконки не в чести у владельца
  { tag: 'maximal',   weight: 4 },
  { tag: 'brutal',    weight: 4 },
  // «живые» сценарии — премиум-сегмент дропа
  { tag: 'gunner',    weight: 6 },
  { tag: 'rocket',    weight: 6 },
  { tag: 'fishing',   weight: 7 }, // владельцу зашли рыбки
  { tag: 'organism',  weight: 6 },
  // v1.3: сцены, меняющие пространство (по бестселлерам маркетплейсов:
  // trails/neon/particles — codecanyon top; + фирменные идеи завода)
  { tag: 'blackhole',  weight: 8 },
  { tag: 'hyperspace', weight: 7 },
  { tag: 'storm',      weight: 8 },
  { tag: 'spacetime',  weight: 8 },
  { tag: 'ribbon',     weight: 7 },
  { tag: 'fireflies',  weight: 7 },
  { tag: 'dogfight',   weight: 8 },
]

export const NAME_ADJ = ['Neon', 'Hyper', 'Soft', 'Lunar', 'Atomic', 'Velvet', 'Chrome', 'Pixel', 'Cosmic', 'Retro', 'Brutal', 'Liquid', 'Solar', 'Frost', 'Turbo', 'Ghost', 'Plasma', 'Mono', 'Vivid', 'Hollow']
export const NAME_NOUN = ['Comet', 'Halo', 'Pulse', 'Drift', 'Spark', 'Orbit', 'Bloom', 'Glitch', 'Vortex', 'Echo', 'Flux', 'Nova', 'Trace', 'Beam', 'Ember', 'Haze', 'Prism', 'Wisp', 'Quartz', 'Dash']
export const EMOJI = ['✦', '★', '✺', '❖', '✿', '◆', '✸', '⚡', '✶', '♥', '☻', '✷']
