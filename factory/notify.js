import { join } from 'node:path'
import { DROPS_DIR, readJson } from './lib/paths.js'
import { todayKey } from './lib/seed.js'

/**
 * notifier — emails the owner a link to today's drop on the HMI portal.
 * Resend when RESEND_API_KEY/EMAIL_TO/EMAIL_FROM are set; otherwise logs the
 * link (visible in the Actions run — graceful degradation).
 */

export async function notify(date = todayKey()) {
  const portal = process.env.PORTAL_URL || 'http://localhost:5173'
  const link = `${portal}/?drop=${date}`
  const drop = readJson(join(DROPS_DIR, `${date}.json`))
  const names = drop?.items?.map((i) => i.name) ?? []
  const alarms = drop?.alarms?.length ?? 0

  const subject = `🏭 CURSOR ZAVOD · дроп ${date}: ${names.length} курсоров${alarms ? ` · ⚠ ${alarms} тревог` : ''}`
  const html = `
  <div style="font-family:system-ui,sans-serif;background:#1a1d21;color:#e8eaed;padding:24px;line-height:1.5">
    <div style="border:1px solid #2e343b;background:#22262b;padding:8px 14px;font-family:monospace;font-size:12px;letter-spacing:.15em">
      <span style="color:#2ecc71">●</span> CURSOR ZAVOD · СМЕНА ${date}
    </div>
    <h2 style="margin:16px 0 8px">Дроп готов: ${names.length} курсоров ждут проверки</h2>
    <p style="color:#9aa3ad">${names.slice(0, 10).join(' · ')}</p>
    ${alarms ? `<p style="color:#f39c12">⚠ ОТК: ${alarms} тревог — глянь на пульте.</p>` : '<p style="color:#2ecc71">ОТК: партия чистая.</p>'}
    <p style="margin:20px 0">
      <a href="${link}" style="display:inline-block;background:#f39c12;color:#111;padding:12px 20px;font-weight:700;text-decoration:none;font-family:monospace;letter-spacing:.1em">▶ ОТКРЫТЬ ПУЛЬТ</a>
    </p>
    <p style="color:#5c6670;font-size:12px;font-family:monospace">${link}</p>
  </div>`

  const key = process.env.RESEND_API_KEY
  const to = process.env.EMAIL_TO
  const from = process.env.EMAIL_FROM
  if (key && to && from) {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject, html }),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`resend ${res.status}: ${await res.text()}`)
    console.log(`[notifier] email sent to ${to} for drop ${date}`)
  } else {
    console.log('[notifier] email not configured (RESEND_API_KEY / EMAIL_TO / EMAIL_FROM)')
    console.log(`[notifier] drop link: ${link}`)
  }
}

if (process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('notify.js')) {
  notify().catch((err) => {
    console.error('[notifier] failed:', err.message)
    process.exitCode = 1
  })
}
