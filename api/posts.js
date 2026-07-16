import { getPosts } from './_lib/store.js'

export default async function handler(_req, res) {
  const data = await getPosts()
  res.setHeader('Cache-Control', 'public, max-age=60')
  res.status(200).json(data)
}
