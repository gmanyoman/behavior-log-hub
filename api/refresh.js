import { refreshPayload } from '../scripts/refresh.mjs'

export const config = {
  maxDuration: 60,
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body ?? {})
    const existing = Array.isArray(body.existing) ? body.existing : []
    const payload = await refreshPayload({ existing })
    res.status(200).json(payload)
  } catch (err) {
    console.error('[refresh]', err)
    res.status(500).json({ error: err.message ?? 'refresh failed' })
  }
}
