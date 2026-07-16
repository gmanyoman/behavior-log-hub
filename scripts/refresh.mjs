import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { collect } from './collect.mjs'
import { categorize } from './categorize.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')
const DEFAULT_TARGET = path.join(ROOT, 'data/posts.json')

async function readExisting(target) {
  try {
    const raw = await readFile(target, 'utf8')
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed.posts) ? parsed.posts : []
  } catch {
    return []
  }
}

function dedupByUrl(posts) {
  const seen = new Map()
  for (const p of posts) {
    const prev = seen.get(p.url)
    if (!prev) { seen.set(p.url, p); continue }
    const prevTime = prev.publishedAt ? Date.parse(prev.publishedAt) : 0
    const curTime = p.publishedAt ? Date.parse(p.publishedAt) : 0
    if (curTime >= prevTime) seen.set(p.url, p)
  }
  return [...seen.values()]
}

function sortNewest(posts) {
  return [...posts].sort((a, b) => {
    const ta = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const tb = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return tb - ta
  })
}

export async function refresh({ target = DEFAULT_TARGET, verbose = false } = {}) {
  if (verbose) console.log('[refresh] collecting…')
  const { items } = await collect({ verbose })

  if (verbose) console.log(`[refresh] categorizing ${items.length} items…`)
  const existing = await readExisting(target)
  const fresh = await categorize(items, { existing, verbose })

  const merged = dedupByUrl([...fresh, ...existing])
  const sorted = sortNewest(merged)
  const payload = {
    lastUpdated: new Date().toISOString(),
    posts: sorted,
  }

  await mkdir(path.dirname(target), { recursive: true })
  await writeFile(target, JSON.stringify(payload, null, 2))
  if (verbose) console.log(`[refresh] wrote ${sorted.length} posts → ${target}`)
  return payload
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await refresh({ verbose: true })
}
