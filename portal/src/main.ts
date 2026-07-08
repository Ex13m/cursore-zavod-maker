import { createCursor } from 'cursorfx'
import type { CursorEngine } from 'cursorfx'
import { api, adminKey } from './api'
import type { Drop, DropItem, Health, QueueItem, Trends } from './api'
import { renderCover } from './cover'
import { drawPreview } from './preview'
import { maybeAnnounce } from './announce'
import { VERSION } from './version'

// ----------------------------------------------------------- rejects (БРАК) ---
const REJ_KEY = 'zavod.rejected'
const rejected = new Set<string>(JSON.parse(localStorage.getItem(REJ_KEY) ?? '[]') as string[])
function toggleRejected(id: string): void {
  if (rejected.has(id)) rejected.delete(id)
  else rejected.add(id)
  localStorage.setItem(REJ_KEY, JSON.stringify([...rejected]))
}

const SCENE_TYPES = new Set(['turret', 'rocket', 'lure', 'noiseblob'])
const hasSound = (item: DropItem) => item.effects.some((e) => SCENE_TYPES.has(e.type))
const soundOn = (item: DropItem) =>
  item.effects.some((e) => SCENE_TYPES.has(e.type) && Boolean((e.options as { sound?: boolean } | undefined)?.sound))
function toggleSound(item: DropItem): void {
  const next = !soundOn(item)
  for (const e of item.effects) {
    if (!SCENE_TYPES.has(e.type)) continue
    e.options = { ...(e.options ?? {}), sound: next }
  }
}

// ----------------------------------------------------------------- state ---
type View = 'board' | 'conveyor' | 'chat' | 'warehouse' | 'sales'

const state = {
  view: 'board' as View,
  cursorOn: true,
  activeId: null as string | null,
  engine: null as CursorEngine | null,
  health: null as Health | null,
  index: { drops: [] as string[], latest: undefined } as { drops: string[]; latest?: string },
  drop: null as Drop | null,
  trends: null as Trends | null,
  queue: [] as QueueItem[],
  warehouseDate: null as string | null,
  chatLog: [] as Array<{ who: 'user' | 'zavod'; text: string; item?: DropItem }>,
}

// ------------------------------------------------------------- dom utils ---
const $ = <T extends HTMLElement>(sel: string): T => document.querySelector(sel) as T
function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v
    else node.setAttribute(k, v)
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c)
  return node
}

// ---------------------------------------------------------- cursor engine ---
function findItem(id: string): DropItem | undefined {
  const inDrop = state.drop?.items.find((i) => i.id === id)
  if (inDrop) return inDrop
  const chat = state.chatLog.find((m) => m.item?.id === id)?.item
  return chat
}

function applyCursor(): void {
  state.engine?.destroy()
  state.engine = null
  document.body.style.background = ''
  const item = state.cursorOn && state.activeId ? findItem(state.activeId) : null
  if (item) {
    document.body.style.background = item.background
    state.engine = createCursor(item.effects, { hideNativeCursor: true })
  }
}

function setActive(id: string | null): void {
  state.activeId = state.activeId === id ? null : id
  applyCursor()
  document.querySelectorAll('.unit').forEach((u) => {
    u.classList.toggle('is-active', (u as HTMLElement).dataset.id === state.activeId)
  })
  document.querySelectorAll('.btn--test').forEach((b) => {
    const on = (b as HTMLElement).dataset.id === state.activeId
    b.classList.toggle('is-on', on)
    b.textContent = on ? 'ТЕСТ ● ' : 'ТЕСТ'
  })
}

// ------------------------------------------------------------- queue ops ---
async function approve(item: DropItem, price: number, productId: string): Promise<void> {
  await api.enqueue({
    id: item.id,
    name: item.name,
    description: item.description,
    tags: item.tags,
    accent: item.accent,
    background: item.background,
    effects: item.effects,
    price,
    productId,
    coverDataUrl: renderCover(item),
  })
  state.queue = await api.queue()
  render()
}

async function unapprove(id: string): Promise<void> {
  await api.dequeue(id)
  state.queue = await api.queue()
  render()
}

// -------------------------------------------------------------- unit card ---
function unitCard(item: DropItem): HTMLElement {
  const queued = state.queue.find((q) => q.id === item.id)
  const isRejected = rejected.has(item.id)
  const preview = el('div', { class: 'unit__preview' })
  const pcanvas = el('canvas', { class: 'unit__canvas' })
  drawPreview(pcanvas, item)
  preview.append(pcanvas)

  const price = el('input', { class: 'price-in', type: 'number', min: '1', value: String(queued?.price ?? item.suggestedPrice) }) as HTMLInputElement
  const pid = el('input', { class: 'pid', placeholder: 'gumroad product id (черновик)', value: queued?.productId ?? '' }) as HTMLInputElement

  const check = el('input', { type: 'checkbox' }) as HTMLInputElement
  check.checked = Boolean(queued)
  check.addEventListener('change', () =>
    check.checked ? approve(item, Number(price.value), pid.value) : unapprove(item.id),
  )
  const resync = () => { if (check.checked) approve(item, Number(price.value), pid.value) }
  price.addEventListener('change', resync)
  pid.addEventListener('change', resync)

  const test = el('button', { class: 'btn btn--test', 'data-id': item.id }, ['ТЕСТ'])
  test.addEventListener('click', () => setActive(item.id))

  // БРАК: забраковать/вернуть изделие
  const rej = el('button', { class: `btn${isRejected ? '' : ' btn--warn'}` }, [isRejected ? 'ВЕРНУТЬ' : 'БРАК'])
  rej.addEventListener('click', async () => {
    toggleRejected(item.id)
    if (rejected.has(item.id) && queued) await unapprove(item.id)
    else render()
  })

  const controls: HTMLElement[] = [test]
  // звук — только у сценарных курсоров, выключен по умолчанию
  if (hasSound(item)) {
    const snd = el('button', { class: 'btn', title: 'Звук курсора (WebAudio, генерируется)' }, [soundOn(item) ? '🔊' : '🔇'])
    snd.addEventListener('click', () => {
      toggleSound(item)
      snd.textContent = soundOn(item) ? '🔊' : '🔇'
      if (state.activeId === item.id) applyCursor() // перезапустить с новым звуком
    })
    controls.push(snd)
  }
  controls.push(rej)

  const body = el('div', { class: 'unit__body' }, [
    el('div', { class: 'unit__head' }, [
      el('span', { class: 'unit__name' }, [item.name]),
      el('span', { class: 'unit__price' }, [`$${item.suggestedPrice}`]),
    ]),
    el('p', { class: 'unit__desc' }, [item.description]),
    el('div', { class: 'unit__tags' }, item.tags.map((t) => el('span', { class: 'tag' }, [t]))),
    ...(item.alarms.length ? [el('div', { class: 'unit__alarm' }, [`⚠ ${item.alarms.join('; ')}`])] : []),
    el('div', { class: 'unit__row' }, [...controls, price, el('label', { class: 'approve' }, [check, el('span', {}, ['ОДОБРИТЬ'])])]),
    pid,
  ])

  const card = el('article', { class: 'unit', 'data-id': item.id }, [preview, body])
  if (item.id === state.activeId) card.classList.add('is-active')
  if (isRejected) {
    card.classList.add('is-rejected')
    check.disabled = true
    card.append(el('span', { class: 'stamp stamp--alarm' }, ['БРАК']))
  } else if (queued?.status === 'published') card.append(el('span', { class: 'stamp' }, ['ОТГРУЖЕНО']))
  else if (queued) card.append(el('span', { class: 'stamp stamp--queued' }, ['В ОЧЕРЕДИ']))
  else if (item.alarms.length) card.append(el('span', { class: 'stamp stamp--alarm' }, ['ОТК']))
  return card
}

// ------------------------------------------------------------ view: board ---
function viewBoard(): HTMLElement {
  const root = el('div', { class: 'grid grid--board' })
  const drop = state.drop
  const alarmsTotal = (drop?.alarms.length ?? 0)
  const queuedCount = state.queue.filter((q) => q.status === 'queued').length
  const publishedCount = state.queue.filter((q) => q.status === 'published').length

  // readouts
  root.append(
    el('div', { class: 'panel span12' }, [
      el('div', { class: 'readout' }, [
        readout(String(drop?.items.length ?? 0), 'КУРСОРОВ В ДРОПЕ', 'info'),
        readout(String(alarmsTotal), 'ТРЕВОГ ОТК', alarmsTotal ? 'alarm' : 'run'),
        readout(String(queuedCount), 'ЖДУТ ОТГРУЗКИ', queuedCount ? 'queued' : 'run'),
        readout(String(publishedCount), 'ОТГРУЖЕНО', 'run'),
        readout(state.index.drops.length.toString(), 'СМЕН НА СКЛАДЕ', 'info'),
      ]),
    ]),
  )

  // trend gauges
  const gauges = el('div', { class: 'panel span8' })
  gauges.append(el('h3', { class: 'panel__title' }, [`ДАТЧИКИ ТРЕНДОВ · ${state.trends?.date ?? '—'}`]))
  const palettes = [...(state.trends?.palettes ?? [])].sort((a, b) => b.weight - a.weight)
  const max = palettes[0]?.weight ?? 1
  for (const p of palettes.slice(0, 8)) {
    const g = el('div', { class: `gauge${p.weight / max > 0.75 ? ' gauge--hot' : ''}` }, [
      el('div', { class: 'gauge__label' }, [el('span', {}, [p.name]), el('span', {}, [String(p.weight)])]),
    ])
    const bar = el('div', { class: 'gauge__bar' })
    const fill = el('div', { class: 'gauge__fill' })
    fill.style.width = `${Math.round((p.weight / max) * 100)}%`
    bar.append(fill)
    g.append(bar)
    gauges.append(g)
  }
  root.append(gauges)

  // alarms & journal
  const alarms = el('div', { class: 'panel span4' })
  alarms.append(el('h3', { class: 'panel__title' }, ['ЖУРНАЛ СМЕНЫ']))
  const list = el('ul', {})
  if (drop) {
    list.append(el('li', { class: 'ok' }, [`дроп ${drop.date} выпущен (${drop.items.length} шт.)`]))
    for (const note of drop.trendsNotes ?? []) list.append(el('li', { class: 'ok' }, [note]))
    for (const a of drop.alarms) list.append(el('li', {}, [a]))
  } else {
    list.append(el('li', {}, ['дроп сегодня не найден — запусти factory:daily']))
  }
  alarms.append(el('div', { class: 'alarms' }, [list]))
  root.append(alarms)

  return root
}

function readout(value: string, label: string, tone: string): HTMLElement {
  return el('div', { class: 'readout__item' }, [
    el('div', { class: `readout__value ${tone}` }, [value]),
    el('div', { class: 'readout__label' }, [label]),
  ])
}

// --------------------------------------------------------- view: conveyor ---
function viewConveyor(): HTMLElement {
  const root = el('div', {})
  const drop = state.drop
  const head = el('div', { class: 'panel', style: 'margin-bottom:14px' }, [
    el('h3', { class: 'panel__title' }, [
      `ЛИНИЯ-1 · ДРОП ${drop?.date ?? '—'}`,
      publishButton(),
    ]),
    el('div', { class: 'hint' }, [
      'ТЕСТ — курсор оживает на всей странице (наводись на кнопки). ОДОБРИТЬ — в очередь отгрузки. Отгрузка — кнопкой справа.',
    ]),
  ])
  root.append(head)
  const belt = el('div', { class: 'belt' })
  for (const item of drop?.items ?? []) belt.append(unitCard(item))
  if (!drop) belt.append(el('div', { class: 'empty' }, ['Дроп не найден. Запусти npm run factory:daily.']))
  root.append(belt)
  return root
}

function publishButton(): HTMLElement {
  const queued = state.queue.filter((q) => q.status === 'queued' || q.status === 'error').length
  const btn = el('button', { class: 'btn btn--go' }, [`▶ ОТГРУЗИТЬ (${queued})`]) as HTMLButtonElement
  btn.disabled = queued === 0
  btn.addEventListener('click', async () => {
    btn.disabled = true
    btn.textContent = 'ОТГРУЗКА…'
    try {
      const res = await api.publish()
      state.queue = await api.queue()
      const ok = res.results.filter((r) => r.ok).length
      btn.textContent = `ГОТОВО ${ok}/${res.count}`
    } catch (err) {
      btn.textContent = 'ОШИБКА'
      console.error(err)
    }
    setTimeout(render, 1200)
  })
  return btn
}

// ------------------------------------------------------------- view: chat ---
function viewChat(): HTMLElement {
  const root = el('div', { class: 'chat' })

  const logPanel = el('div', { class: 'panel' })
  logPanel.append(el('h3', { class: 'panel__title' }, ['ЦЕХ РУЧНОЙ СБОРКИ']))
  const log = el('div', { class: 'chat__log' })
  if (state.chatLog.length === 0) {
    log.append(el('div', { class: 'empty' }, ['Опиши курсор словами — цех соберёт его и сразу включит на странице.']))
  }
  for (const m of state.chatLog) {
    const box = el('div', { class: `msg msg--${m.who}` })
    box.append(document.createTextNode(m.text))
    if (m.item) {
      box.append(el('div', { class: 'mono' }, [`→ ${m.item.effects.map((e) => e.type).join(' + ')}`]))
      const row = el('div', { class: 'unit__row', style: 'margin-top:8px' })
      const test = el('button', { class: 'btn btn--test', 'data-id': m.item.id }, ['ТЕСТ'])
      test.addEventListener('click', () => setActive(m.item!.id))
      const add = el('button', { class: 'btn btn--warn' }, ['В ОЧЕРЕДЬ'])
      add.addEventListener('click', () => approve(m.item!, m.item!.suggestedPrice, ''))
      row.append(test, add)
      box.append(row)
    }
    log.append(box)
  }
  logPanel.append(log)

  const input = el('input', { class: 'chat__input', placeholder: 'например: неоновый шлейф с зелёным свечением и кольцом' }) as HTMLInputElement
  const send = el('button', { class: 'btn btn--go' }, ['СОБРАТЬ'])
  const submit = async () => {
    const prompt = input.value.trim()
    if (!prompt) return
    input.value = ''
    state.chatLog.push({ who: 'user', text: prompt })
    render()
    try {
      const res = await api.chat(prompt)
      state.chatLog.push({
        who: 'zavod',
        text: `Собрано (${res.engine === 'anthropic' ? 'AI-инженер' : 'эвристика цеха'}${res.sprite ? ' + Replicate-спрайт' : ''}): ${res.item.name}`,
        item: res.item,
      })
      render()
      setActive(res.item.id)
    } catch (err) {
      state.chatLog.push({ who: 'zavod', text: `Цех недоступен: ${err instanceof Error ? err.message : err}. Запусти npm run dev:api.` })
      render()
    }
  }
  send.addEventListener('click', submit)
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit() })
  logPanel.append(el('div', { class: 'chat__form' }, [input, send]))

  const help = el('div', { class: 'panel' }, [
    el('h3', { class: 'panel__title' }, ['ПОНИМАЕТ ЦЕХ']),
    el('div', { class: 'hint' }, [
      'ЦВЕТА: красный, неоновый, #ff3b81…', el('br', {}),
      'ЭФФЕКТЫ: шлейф/частицы, свечение, кольцо/магнит, капля/жидкий, эмодзи (звезда, сердце, молния, череп)', el('br', {}),
      'ХАРАКТЕР: быстрый/резкий, плавный/ленивый, квадратный/брутальный, крутится', el('br', {}), el('br', {}),
      '«нарисуй курсор-дракона» → при ключе Replicate цех сгенерирует картинку-спрайт (FLUX).', el('br', {}), el('br', {}),
      `Движок: ${state.health?.anthropic ? 'AI-инженер (Anthropic) ✓' : 'эвристика (ключ Anthropic не задан)'}`, el('br', {}),
      `Спрайты: ${state.health?.replicate ? 'Replicate ✓' : 'выкл (ключа нет) — эмодзи/SVG'}`,
    ]),
  ])

  root.append(logPanel, help)
  return root
}

// -------------------------------------------------------- view: warehouse ---
function viewWarehouse(): HTMLElement {
  const root = el('div', {})
  const bar = el('div', { class: 'panel', style: 'margin-bottom:14px' })
  bar.append(el('h3', { class: 'panel__title' }, ['СКЛАД ГОТОВОЙ ПРОДУКЦИИ · СМЕНЫ']))
  const row = el('div', { class: 'unit__row' })
  for (const date of state.index.drops.slice(0, 30)) {
    const b = el('button', { class: 'btn' }, [date])
    if (date === (state.warehouseDate ?? state.index.latest)) b.classList.add('btn--warn')
    b.addEventListener('click', async () => {
      state.warehouseDate = date
      state.drop = await api.drop(date)
      render()
    })
    row.append(b)
  }
  bar.append(row)
  root.append(bar)
  const belt = el('div', { class: 'belt' })
  for (const item of state.drop?.items ?? []) belt.append(unitCard(item))
  root.append(belt)
  return root
}

// ------------------------------------------------------------ view: sales ---
function viewSales(): HTMLElement {
  const root = el('div', { class: 'panel' })
  root.append(el('h3', { class: 'panel__title' }, ['ОТГРУЗКИ И ПРОДАЖИ', publishButton()]))
  if (state.queue.length === 0) {
    root.append(el('div', { class: 'empty' }, ['Очередь пуста. Одобряй курсоры на конвейере.']))
    return root
  }
  const table = el('table', { class: 'hmi' })
  table.append(el('tr', {}, [el('th', {}, ['ИЗДЕЛИЕ']), el('th', {}, ['ЦЕНА']), el('th', {}, ['СТАТУС']), el('th', {}, ['ССЫЛКА / ОШИБКА']), el('th', {}, [''])]))
  for (const q of state.queue) {
    const link = q.result?.url
      ? el('a', { class: 'linklike', href: q.result.url, target: '_blank' }, [q.result.url])
      : el('span', { class: 'faint' }, [q.error ?? q.result?.message ?? '—'])
    const rm = el('button', { class: 'btn' }, ['✕'])
    rm.addEventListener('click', () => unapprove(q.id))
    table.append(
      el('tr', {}, [
        el('td', {}, [q.name]),
        el('td', { class: 'mono' }, [`$${q.price ?? '—'}`]),
        el('td', {}, [el('span', { class: `status status--${q.status}` }, [q.status.toUpperCase()])]),
        el('td', {}, [link]),
        el('td', {}, [rm]),
      ]),
    )
  }
  root.append(table)
  return root
}

// ------------------------------------------------------------------ render ---
const VIEWS: Record<View, () => HTMLElement> = {
  board: viewBoard,
  conveyor: viewConveyor,
  chat: viewChat,
  warehouse: viewWarehouse,
  sales: viewSales,
}

function render(): void {
  const host = $('#view')
  host.innerHTML = ''
  host.append(VIEWS[state.view]())
  document.querySelectorAll('#nav button').forEach((b) => {
    b.classList.toggle('is-on', (b as HTMLElement).dataset.view === state.view)
  })
  const lamp = $('#line-lamp')
  const alarms = state.drop?.alarms.length ?? 0
  lamp.className = `lamp ${alarms ? 'lamp--alarm' : 'lamp--run'}`
}

// -------------------------------------------------------------------- boot ---
async function boot(): Promise<void> {
  $('#nav').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('button')
    if (!btn?.dataset.view) return
    state.view = btn.dataset.view as View
    render()
  })

  const keyBtn = $('#admin-key')
  const syncKeyBtn = () => {
    keyBtn.textContent = adminKey.get() ? 'КЛЮЧ ✓' : 'КЛЮЧ'
    keyBtn.classList.toggle('is-off', !adminKey.get())
  }
  keyBtn.addEventListener('click', () => {
    const v = prompt('Ключ владельца (ZAVOD_ADMIN_KEY). Пусто — убрать ключ.', adminKey.get())
    if (v !== null) adminKey.set(v.trim())
    syncKeyBtn()
  })
  syncKeyBtn()

  const kill = $('#kill-switch')
  kill.addEventListener('click', () => {
    state.cursorOn = !state.cursorOn
    kill.textContent = `CURSOR: ${state.cursorOn ? 'ON' : 'OFF'}`
    kill.classList.toggle('is-off', !state.cursorOn)
    applyCursor()
  })

  try {
    state.health = await api.health()
    const h = state.health
    $('#keys-status').textContent =
      `keys: gumroad ${h.gumroad ? '✓' : '—'} · anthropic ${h.anthropic ? '✓' : '—'} · replicate ${h.replicate ? '✓' : '—'} · resend ${h.resend ? '✓' : '—'}`
  } catch {
    $('#keys-status').textContent = 'api offline — просмотр без публикации'
  }

  try {
    state.index = await api.index()
    const wanted = new URLSearchParams(location.search).get('drop')
    const date = (wanted && state.index.drops.includes(wanted) ? wanted : state.index.latest) ?? state.index.drops[0]
    if (date) {
      state.drop = await api.drop(date)
      $('#shift-date').textContent = `СМЕНА ${date}`
    }
  } catch { /* no data yet */ }

  try { state.trends = await api.trends() } catch { /* optional */ }
  try { state.queue = await api.queue() } catch { /* api offline */ }

  const ver = document.querySelector('#version')
  if (ver) ver.textContent = `v${VERSION}`

  render()
  maybeAnnounce()
}

boot()
