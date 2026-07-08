import type { EffectSpec } from 'cursorfx'

export interface DropItem {
  id: string
  name: string
  description: string
  tags: string[]
  accent: string
  background: string
  dark: boolean
  suggestedPrice: number
  effects: EffectSpec[]
  alarms: string[]
}

export interface Drop {
  date: string
  generatedAt: string
  trendsNotes: string[]
  items: DropItem[]
  alarms: string[]
}

export interface Trends {
  date: string
  palettes: Array<{ name: string; weight: number; colors: string[]; bg: string; dark: boolean }>
  styles: Array<{ tag: string; weight: number }>
  notes: string[]
}

export interface QueueItem extends Partial<DropItem> {
  id: string
  name: string
  price?: number
  productId?: string
  status: 'queued' | 'publishing' | 'published' | 'error'
  result?: { ok: boolean; url?: string; message?: string }
  error?: string | null
  updatedAt?: string
}

export interface Health {
  ok: boolean
  gumroad: boolean
  anthropic: boolean
  replicate: boolean
  resend: boolean
}

export interface ChatResult {
  engine: 'heuristic' | 'anthropic'
  item: DropItem
  notes?: string[]
  sprite?: { url: string; model: string }
}

const KEY_STORAGE = 'zavod.adminKey'

export const adminKey = {
  get: (): string => localStorage.getItem(KEY_STORAGE) ?? '',
  set: (v: string): void => {
    if (v) localStorage.setItem(KEY_STORAGE, v)
    else localStorage.removeItem(KEY_STORAGE)
  },
}

/** Заголовки для мутаций: ключ владельца, если задан. */
function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const key = adminKey.get()
  return key ? { ...extra, 'X-Zavod-Key': key } : extra
}

async function json<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new Error('401: нужен ключ владельца — нажми КЛЮЧ в шапке')
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return (await res.json()) as T
}

export const api = {
  health: () => fetch('/api/health').then(json<Health>),
  index: () => fetch('/data/index.json').then(json<{ drops: string[]; latest?: string }>),
  drop: (date: string) => fetch(`/data/drops/${date}.json`).then(json<Drop>),
  trends: () => fetch('/data/trends.json').then(json<Trends>),
  queue: () => fetch('/api/queue', { cache: 'no-store' }).then(json<QueueItem[]>),
  enqueue: (item: Record<string, unknown>) =>
    fetch('/api/queue', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(item),
    }).then(json<QueueItem>),
  dequeue: (id: string) =>
    fetch(`/api/queue/${id}`, { method: 'DELETE', headers: authHeaders() }).then(json<{ ok: boolean }>),
  publish: () =>
    fetch('/api/publish', { method: 'POST', headers: authHeaders() }).then(
      json<{ count: number; results: Array<{ id: string; ok: boolean; message?: string; url?: string }> }>,
    ),
  chat: (prompt: string) =>
    fetch('/api/chat', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ prompt }),
    }).then(json<ChatResult>),
}
