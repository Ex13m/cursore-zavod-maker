/**
 * Anti-ban publish policy. Маркетплейсы (Gumroad и др.) банят за поведение,
 * похожее на спам-ферму: заливы пачками, всплески через API, дубли, игнор 429.
 * Здесь — правила «медленной честной публикации».
 */

import { join } from 'node:path'
import { DATA_DIR, readJson, writeJson } from './paths.js'

const POLICY_STATE = join(DATA_DIR, 'publish-state.json')

/** Настройки политики (переопределяются через env). */
export const POLICY = {
  // потолок публикаций в сутки, когда аккаунт «прогрет»
  dailyMax: Number(process.env.PUBLISH_DAILY_MAX) || 6,
  // пауза между заливами, сек (нижняя/верхняя граница — берём случайную в диапазоне)
  minGapSec: Number(process.env.PUBLISH_MIN_GAP) || 45,
  maxGapSec: Number(process.env.PUBLISH_MAX_GAP) || 180,
  // сколько дней разогреваем аккаунт от 1 публикации до dailyMax
  warmupDays: Number(process.env.PUBLISH_WARMUP_DAYS) || 7,
}

function readState() {
  return readJson(POLICY_STATE, { firstPublishDate: null, days: {} })
}
function writeState(s) {
  writeJson(POLICY_STATE, s)
  return s
}

/** Разница в днях между двумя YYYY-MM-DD. */
function daysBetween(a, b) {
  return Math.floor((Date.parse(b) - Date.parse(a)) / 86400000)
}

/**
 * Дневной лимит с учётом разогрева: в первый день 1, дальше линейно до dailyMax
 * за warmupDays. Так новый аккаунт не выглядит фермой с первого залива.
 */
export function dailyLimit(today, state = readState()) {
  const first = state.firstPublishDate ?? today
  const age = Math.max(0, daysBetween(first, today))
  const ramp = Math.min(1, (age + 1) / POLICY.warmupDays)
  return Math.max(1, Math.round(POLICY.dailyMax * ramp))
}

/** Сколько уже опубликовано сегодня. */
export function publishedToday(today, state = readState()) {
  return state.days?.[today] ?? 0
}

/**
 * Можно ли публиковать ещё один товар прямо сейчас?
 * Возвращает { allowed, reason, limit, used, gapSec }.
 */
export function canPublish(today) {
  const state = readState()
  const limit = dailyLimit(today, state)
  const used = publishedToday(today, state)
  if (used >= limit) {
    return { allowed: false, reason: `дневной лимит достигнут (${used}/${limit}, warm-up)`, limit, used }
  }
  return { allowed: true, limit, used }
}

/** Зафиксировать успешную публикацию (двигает счётчики и дату первого релиза). */
export function recordPublish(today) {
  const state = readState()
  if (!state.firstPublishDate) state.firstPublishDate = today
  state.days[today] = (state.days[today] ?? 0) + 1
  return writeState(state)
}

/** Случайная пауза между заливами (детерминированный джиттер по индексу). */
export function gapSeconds(index) {
  const span = POLICY.maxGapSec - POLICY.minGapSec
  // псевдослучайно, но воспроизводимо: без Math.random (правило factory)
  const jitter = ((index * 2654435761) >>> 0) / 4294967296
  return Math.round(POLICY.minGapSec + jitter * span)
}

/** Слова-триггеры модерации в названии/описании (базовый фильтр качества). */
const BANNED_WORDS = ['free download', 'crack', 'nulled', 'giveaway', '100% free', 'best ever', 'guaranteed']

/** Проверка метаданных товара перед заливом. Возвращает массив проблем. */
export function inspectListing(item) {
  const issues = []
  const text = `${item.name} ${item.description ?? ''}`.toLowerCase()
  for (const w of BANNED_WORDS) if (text.includes(w)) issues.push(`стоп-слово модерации: "${w}"`)
  if (!item.description || item.description.length < 20) issues.push('слишком короткое описание')
  if (!Array.isArray(item.tags) || item.tags.length < 2) issues.push('мало тегов (< 2)')
  if (typeof item.price !== 'number' || item.price < 1) issues.push('некорректная цена')
  return issues
}
