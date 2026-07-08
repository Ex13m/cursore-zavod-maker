import type { EffectSpec } from './effects'

/**
 * A named, sellable cursor configuration. Everything here is plain data so it
 * can be serialized into a product bundle and rebuilt anywhere.
 */
export interface CursorPreset {
  /** Stable identifier (kebab-case). */
  id: string
  /** Human-facing name. */
  name: string
  /** One-line pitch, reused as the product description. */
  description: string
  /** Search/marketplace tags. */
  tags: string[]
  /** Accent color for studio cards and generated cover art. */
  accent: string
  /** Recommended page background (some effects shine on dark only). */
  background: string
  /** Whether the look is tuned for a dark background. */
  dark: boolean
  /** Suggested marketplace price in USD. */
  suggestedPrice: number
  /** The effect stack, drawn back-to-front. */
  effects: EffectSpec[]
}

/** The built-in catalog of cursors shown in the studio. */
export const PRESETS: CursorPreset[] = [
  {
    id: 'inkwell',
    name: 'Inkwell',
    description: 'A crisp difference-blend dot that reads on any background. The honest default.',
    tags: ['minimal', 'dot', 'classic'],
    accent: '#111111',
    background: '#f5f5f0',
    dark: false,
    suggestedPrice: 4,
    effects: [{ type: 'dot', options: { size: 12, blendMode: 'difference' } }],
  },
  {
    id: 'halo',
    name: 'Halo',
    description: 'A lagging ring chasing a tight dot — the timeless duo for portfolios.',
    tags: ['ring', 'dot', 'portfolio'],
    accent: '#111111',
    background: '#f5f5f0',
    dark: false,
    suggestedPrice: 6,
    effects: [
      { type: 'ring', options: { size: 38, thickness: 2 } },
      { type: 'dot', options: { size: 7, blendMode: 'normal', color: '#111111' } },
    ],
  },
  {
    id: 'magnet',
    name: 'Magnet',
    description: 'The ring snaps around buttons and links, wrapping each one as you hover.',
    tags: ['magnetic', 'ring', 'interactive'],
    accent: '#1b1b1b',
    background: '#ededea',
    dark: false,
    suggestedPrice: 9,
    effects: [
      { type: 'ring', options: { size: 34, thickness: 2, halfLife: 0.07, hoverPadding: 10 } },
      { type: 'dot', options: { size: 6, blendMode: 'difference' } },
    ],
  },
  {
    id: 'goo',
    name: 'Goo',
    description: 'A gooey blob that squashes and stretches with your speed. Playful and physical.',
    tags: ['blob', 'squash', 'fun'],
    accent: '#111111',
    background: '#f2f2ec',
    dark: false,
    suggestedPrice: 7,
    effects: [{ type: 'blob', options: { size: 18 } }],
  },
  {
    id: 'aurora',
    name: 'Aurora',
    description: 'A soft trailing glow over a sharp dot. Built for dark, premium landing pages.',
    tags: ['glow', 'dark', 'premium'],
    accent: '#5b8cff',
    background: '#0a0b14',
    dark: true,
    suggestedPrice: 9,
    effects: [
      { type: 'glow', options: { size: 320, color: '#5b8cff', opacity: 0.5 } },
      { type: 'dot', options: { size: 9, color: '#ffffff', blendMode: 'normal' } },
    ],
  },
  {
    id: 'comet',
    name: 'Comet',
    description: 'An additive particle trail streaming behind the pointer. Neon energy on dark.',
    tags: ['trail', 'particles', 'neon'],
    accent: '#ff3b81',
    background: '#0d0221',
    dark: true,
    suggestedPrice: 11,
    effects: [
      { type: 'trail', options: { color: '#ff3b81', size: 7 } },
      { type: 'dot', options: { size: 8, color: '#ffffff', blendMode: 'normal' } },
    ],
  },
  {
    id: 'supernova',
    name: 'Supernova',
    description: 'Glow plus particle trail plus a bright core — the maximalist showpiece.',
    tags: ['glow', 'trail', 'maximal', 'dark'],
    accent: '#39ff14',
    background: '#08010f',
    dark: true,
    suggestedPrice: 14,
    effects: [
      { type: 'glow', options: { size: 280, color: '#7a2bff', opacity: 0.4 } },
      { type: 'trail', options: { color: '#39ff14', size: 6 } },
      { type: 'dot', options: { size: 7, color: '#ffffff', blendMode: 'normal' } },
    ],
  },
  {
    id: 'brut',
    name: 'Brutalist',
    description: 'A fat hard dot inside a thick square ring. Raw, loud, unapologetic.',
    tags: ['brutalism', 'bold', 'agency'],
    accent: '#000000',
    background: '#f5f5f0',
    dark: false,
    suggestedPrice: 8,
    effects: [
      { type: 'ring', options: { size: 44, thickness: 4, hoverRadius: 0, color: '#000000' } },
      { type: 'dot', options: { size: 14, blendMode: 'difference', radius: '0%' } },
    ],
  },
]

/** Look up a preset by id. */
export const getPreset = (id: string): CursorPreset | undefined =>
  PRESETS.find((p) => p.id === id)
