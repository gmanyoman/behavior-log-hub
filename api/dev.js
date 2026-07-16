import express from 'express'
import postsHandler from './posts.js'
import healthHandler from './health.js'
import { triggerBackgroundRefresh } from './_lib/store.js'

const app = express()
app.use(express.json({ limit: '256kb' }))

app.get('/posts', (req, res) => postsHandler(req, res))
app.get('/health', (req, res) => healthHandler(req, res))
app.post('/admin/refresh', (_req, res) => {
  triggerBackgroundRefresh()
  res.json({ triggered: true })
})

const port = Number(process.env.PORT) || 8080
app.listen(port, () => {
  console.log(`dev api on :${port}`)
})
