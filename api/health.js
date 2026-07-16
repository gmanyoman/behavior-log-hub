import { getStatus } from './_lib/store.js'

export default async function handler(_req, res) {
  const status = await getStatus()
  res.status(200).json(status)
}
