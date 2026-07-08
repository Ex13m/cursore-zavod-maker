/**
 * imagegen — Replicate FLUX sprite generation for image-cursors.
 * Used by the workshop chat when the prompt asks for a drawn cursor
 * ("нарисуй курсор-дракона"). Requires REPLICATE_API_TOKEN; without it the
 * caller degrades to emoji/SVG cursors.
 */

const API = 'https://api.replicate.com/v1'
const DEFAULT_MODEL = process.env.REPLICATE_MODEL || 'black-forest-labs/flux-schnell'

export function imagegenAvailable() {
  return Boolean(process.env.REPLICATE_API_TOKEN)
}

/**
 * Generate a small transparent-friendly sprite for a cursor.
 * Returns { url } of the generated image. Throws on failure — callers catch
 * and degrade.
 */
export async function generateCursorSprite(subject) {
  const token = process.env.REPLICATE_API_TOKEN
  if (!token) throw new Error('REPLICATE_API_TOKEN is not set')

  const prompt =
    `tiny game cursor icon of ${subject}, centered single object, ` +
    'flat vector sticker style, bold outline, vivid colors, plain solid dark background, ' +
    'no text, no watermark, simple silhouette readable at 32x32 pixels'

  const create = await fetch(`${API}/models/${DEFAULT_MODEL}/predictions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      Prefer: 'wait=30',
    },
    body: JSON.stringify({
      input: { prompt, aspect_ratio: '1:1', output_format: 'png', num_outputs: 1 },
    }),
    signal: AbortSignal.timeout(45000),
  })
  if (!create.ok) throw new Error(`replicate ${create.status}: ${(await create.text()).slice(0, 200)}`)
  let prediction = await create.json()

  // Poll if the sync wait didn't finish it.
  const started = Date.now()
  while (prediction.status === 'starting' || prediction.status === 'processing') {
    if (Date.now() - started > 90000) throw new Error('replicate: timed out')
    await new Promise((r) => setTimeout(r, 2000))
    const poll = await fetch(`${API}/predictions/${prediction.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    prediction = await poll.json()
  }
  if (prediction.status !== 'succeeded') {
    throw new Error(`replicate: ${prediction.status} ${prediction.error ?? ''}`.trim())
  }
  const url = Array.isArray(prediction.output) ? prediction.output[0] : prediction.output
  if (!url) throw new Error('replicate: empty output')
  return { url, model: DEFAULT_MODEL }
}

/** Detect "draw me a ..." style requests and extract the subject. */
export function extractDrawRequest(prompt) {
  const m = prompt.match(/(?:нарисуй|нарисовать|draw|generate|сгенерируй)\s+(?:курсор[- ]?)?(.{3,60})/i)
  return m ? m[1].trim().replace(/[.!?].*$/, '') : null
}
