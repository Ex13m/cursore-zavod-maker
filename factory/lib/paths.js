import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'

// NB: не называть __dirname — esbuild при бандлинге Netlify-функций
// объявляет собственный __dirname, и дубль роняет функцию SyntaxError'ом.
const HERE = dirname(fileURLToPath(import.meta.url))

export const FACTORY_DIR = join(HERE, '..')
export const DATA_DIR = join(FACTORY_DIR, 'data')
export const DROPS_DIR = join(DATA_DIR, 'drops')
export const ROOT_DIR = join(FACTORY_DIR, '..')

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, DROPS_DIR]) {
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
  }
}

export function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return fallback
  }
}

export function writeJson(path, value) {
  ensureDataDirs()
  writeFileSync(path, JSON.stringify(value, null, 2) + '\n', 'utf8')
}
