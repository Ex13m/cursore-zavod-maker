export default async () =>
  Response.json({
    ok: true,
    gumroad: Boolean(process.env.GUMROAD_ACCESS_TOKEN),
    anthropic: Boolean(process.env.ANTHROPIC_API_KEY),
    replicate: Boolean(process.env.REPLICATE_API_TOKEN),
    resend: Boolean(process.env.RESEND_API_KEY),
  })

export const config = { path: '/api/health' }
