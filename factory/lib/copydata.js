import { cpSync, existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DATA_DIR, ROOT_DIR } from './paths.js'

/** Ship factory state with the portal build: portal/dist/data = factory/data. */
const out = join(ROOT_DIR, 'portal', 'dist', 'data')
if (!existsSync(out)) mkdirSync(out, { recursive: true })
cpSync(DATA_DIR, out, { recursive: true })
console.log(`[copydata] factory/data → portal/dist/data`)
