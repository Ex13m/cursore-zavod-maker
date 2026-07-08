import { rngFor } from './lib/seed.js'
import { emojiToDataUrl } from './archetypes.js'
import { inspect } from './qa.js'

/**
 * chat — turns a free-text prompt into a cursor (EffectSpec[]).
 *
 * Two engines:
 *  - heuristic (always available): keyword/color extraction, no network;
 *  - anthropic (when ANTHROPIC_API_KEY is set): Claude builds the spec,
 *    validated against the same qa rules, heuristic as safety net.
 */

// ---------------------------------------------------------------- heuristics ---
const COLOR_WORDS = {
  'красн': '#e74c3c', red: '#e74c3c',
  'оранж': '#ff9e00', orange: '#ff9e00',
  'жёлт': '#ffd400', 'желт': '#ffd400', yellow: '#ffd400',
  'зелён': '#2ecc71', 'зелен': '#2ecc71', green: '#2ecc71', lime: '#39ff14',
  'голуб': '#3bdcff', cyan: '#00e5ff',
  'син': '#3a86ff', blue: '#3a86ff',
  'фиолет': '#8338ec', purple: '#8338ec', violet: '#9b5bff',
  'розов': '#ff3b81', pink: '#ff3b81', magenta: '#ff2bd0',
  'бел': '#ffffff', white: '#ffffff',
  'чёрн': '#111111', 'черн': '#111111', black: '#111111',
  'золот': '#ffd700', gold: '#ffd700',
  'неон': '#39ff14', neon: '#39ff14',
}

const EMOJI_WORDS = {
  'звезд': '★', star: '★', 'сердц': '♥', heart: '♥', 'молни': '⚡',
  lightning: '⚡', bolt: '⚡', 'цвет': '✿', flower: '✿', 'алмаз': '◆',
  diamond: '◆', 'череп': '☻', skull: '☻',
}

function extractColors(text) {
  const found = []
  const hex = text.match(/#[0-9a-fA-F]{6}\b/g)
  if (hex) found.push(...hex)
  const lower = text.toLowerCase()
  for (const [word, color] of Object.entries(COLOR_WORDS)) {
    if (lower.includes(word) && !found.includes(color)) found.push(color)
  }
  return found
}

export function heuristicParse(prompt) {
  const lower = prompt.toLowerCase()
  const colors = extractColors(prompt)
  const primary = colors[0] ?? '#5b8cff'
  const secondary = colors[1] ?? '#ffffff'
  const dark = !/(светл|бел\w* фон|light)/.test(lower)
  const background = dark ? '#0a0b14' : '#f5f5f0'
  const rng = rngFor(`chat:${prompt}`)

  const wants = {
    trail: /(шлейф|хвост|част[ии]ц|trail|particle|комет|comet|искр)/.test(lower),
    glow: /(свеч|сиян|glow|аура|halo|ореол)/.test(lower),
    ring: /(кольц|ring|круг|обвод|магнит|magnet)/.test(lower),
    blob: /(кап[лж]|жидк|blob|goo|слизь|тягуч)/.test(lower),
    image: /(эмодзи|emoji|картинк|звезд|сердц|молни|череп|алмаз|цветок|star|heart|bolt|skull|diamond|flower)/.test(lower),
    square: /(квадрат|square|брутал|brutal)/.test(lower),
    fast: /(быстр|резк|snappy|fast)/.test(lower),
    slow: /(медлен|плавн|lazy|slow|лениво)/.test(lower),
  }

  const effects = []
  if (wants.glow) effects.push({ type: 'glow', options: { size: 280, color: primary, opacity: 0.45 } })
  if (wants.trail) effects.push({ type: 'trail', options: { color: primary, size: 7, life: 0.6 } })
  if (wants.ring) {
    effects.push({ type: 'ring', options: { size: 38, thickness: wants.square ? 4 : 2, color: primary, halfLife: wants.fast ? 0.05 : wants.slow ? 0.16 : 0.09, ...(wants.square ? { hoverRadius: 0 } : {}) } })
  }
  if (wants.blob) effects.push({ type: 'blob', options: { size: 18, color: primary, blendMode: dark ? 'normal' : 'difference' } })
  if (wants.image) {
    let emoji = '✦'
    for (const [word, e] of Object.entries(EMOJI_WORDS)) if (lower.includes(word)) { emoji = e; break }
    effects.push({ type: 'image', options: { src: emojiToDataUrl(emoji), size: 36, spin: /(крут|верт|spin|rotat)/.test(lower) ? 140 : 0, pulse: 0.1 } })
  }
  // Always finish with a core dot unless an image already is the core.
  if (!wants.image) {
    effects.push({
      type: 'dot',
      options: {
        size: wants.square ? 13 : 9,
        color: effects.length ? secondary : primary,
        blendMode: dark || effects.length ? 'normal' : 'difference',
        ...(wants.square ? { radius: '0%' } : {}),
      },
    })
  }

  const name = prompt.trim().split(/\s+/).slice(0, 3).join(' ').slice(0, 32) || 'Custom cursor'
  return {
    engine: 'heuristic',
    item: {
      id: `chat-${Math.floor(rng() * 1e9).toString(36)}`,
      name,
      description: `Built from prompt: "${prompt.trim().slice(0, 120)}"`,
      tags: ['chat', ...(dark ? ['dark'] : ['light'])],
      accent: primary,
      background,
      dark,
      suggestedPrice: 4 + effects.length * 2,
      effects,
      alarms: [],
    },
  }
}

// ---------------------------------------------------------------- anthropic ---
const SPEC_TOOL = {
  name: 'emit_cursor',
  description: 'Emit the final cursor spec.',
  input_schema: {
    type: 'object',
    required: ['name', 'background', 'dark', 'effects'],
    properties: {
      name: { type: 'string' },
      description: { type: 'string' },
      background: { type: 'string', description: 'page background hex' },
      dark: { type: 'boolean' },
      accent: { type: 'string' },
      effects: {
        type: 'array', maxItems: 4,
        items: {
          type: 'object', required: ['type'],
          properties: {
            type: { enum: ['dot', 'ring', 'glow', 'trail', 'blob', 'image'] },
            options: { type: 'object' },
          },
        },
      },
    },
  },
}

async function anthropicParse(prompt) {
  const key = process.env.ANTHROPIC_API_KEY
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      tools: [SPEC_TOOL],
      tool_choice: { type: 'tool', name: 'emit_cursor' },
      messages: [{
        role: 'user',
        content:
          `Design an animated web cursor from this request: "${prompt}".\n` +
          'Available effects and options: dot{size,color,blendMode,hoverScale,radius}, ' +
          'ring{size,thickness,color,halfLife,hoverPadding,hoverRadius}, glow{size,color,opacity,halfLife}, ' +
          'trail{color,size,life,threshold}, blob{size,color,stretch,hoverScale,blendMode}, ' +
          'image{src(dataURL svg emoji),size,spin,pulse,hoverScale}. ' +
          'Stack 1-4 effects back-to-front. glow/trail read best on dark backgrounds. Emit via the tool.',
      }],
    }),
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${(await res.text()).slice(0, 200)}`)
  const json = await res.json()
  const call = json.content?.find((c) => c.type === 'tool_use')
  if (!call) throw new Error('anthropic: no tool_use in response')
  const spec = call.input
  const rng = rngFor(`chat:${prompt}`)
  return {
    engine: 'anthropic',
    item: {
      id: `chat-${Math.floor(rng() * 1e9).toString(36)}`,
      name: spec.name?.slice(0, 40) || 'Custom cursor',
      description: spec.description ?? `Built from prompt: "${prompt.slice(0, 120)}"`,
      tags: ['chat', 'ai', spec.dark ? 'dark' : 'light'],
      accent: spec.accent ?? '#5b8cff',
      background: spec.background ?? '#0a0b14',
      dark: Boolean(spec.dark),
      suggestedPrice: 4 + (spec.effects?.length ?? 1) * 2,
      effects: spec.effects ?? [],
      alarms: [],
    },
  }
}

/** Main entry: prompt → { engine, item } with qa alarms filled in. */
export async function promptToCursor(prompt) {
  let result
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      result = await anthropicParse(prompt)
    } catch (err) {
      console.warn(`[chat] anthropic failed (${err.message}) — falling back to heuristic`)
    }
  }
  if (!result) result = heuristicParse(prompt)
  result.item.alarms = inspect(result.item)
  // A broken AI spec falls back to the heuristic instead of shipping alarms.
  if (result.engine === 'anthropic' && result.item.alarms.length > 0) {
    const fallback = heuristicParse(prompt)
    fallback.item.alarms = inspect(fallback.item)
    if (fallback.item.alarms.length === 0) {
      fallback.notes = ['anthropic spec failed qa — heuristic used']
      return fallback
    }
  }
  return result
}
