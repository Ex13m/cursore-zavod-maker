import { join } from 'node:path'
import { DATA_DIR, readJson, writeJson } from './paths.js'

/**
 * Учёт реального расхода AI-токенов фабрикой (файловая часть журнала).
 * Runtime-расход прод-функций пишется в Netlify Blobs; портал складывает оба.
 */

const USAGE_FILE = join(DATA_DIR, 'usage.json')

export const EMPTY_USAGE = {
  anthropic: { requests: 0, inputTokens: 0, outputTokens: 0 },
  replicate: { images: 0 },
  updatedAt: null,
}

export function readUsage() {
  return readJson(USAGE_FILE, { ...EMPTY_USAGE })
}

/** delta: { anthropic?: {requests,inputTokens,outputTokens}, replicate?: {images} } */
export function addUsage(delta) {
  const u = readUsage()
  if (delta.anthropic) {
    u.anthropic.requests += delta.anthropic.requests ?? 0
    u.anthropic.inputTokens += delta.anthropic.inputTokens ?? 0
    u.anthropic.outputTokens += delta.anthropic.outputTokens ?? 0
  }
  if (delta.replicate) {
    u.replicate.images += delta.replicate.images ?? 0
  }
  u.updatedAt = new Date().toISOString()
  writeJson(USAGE_FILE, u)
  return u
}
