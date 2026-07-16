import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { refresh } from '../../scripts/refresh.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '../..')

const SEED_PATH = path.join(ROOT, 'data/posts.json')
const TMP_PATH = '/tmp/posts.json'
const TTL_MS = 6 * 60 * 60 * 1000

let cache = null
let loading = null
let refreshing = false
let lastRefreshErr = null

async function loadInitial() {
  try {
    const raw = await readFile(TMP_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {}
  try {
    const raw = await readFile(SEED_PATH, 'utf8')
    return JSON.parse(raw)
  } catch {
    return { lastUpdated: null, posts: [] }
  }
}

async function ensureLoaded() {
  if (cache) return cache
  if (!loading) loading = loadInitial().then(c => { cache = c; return c })
  return loading
}

function isStale() {
  if (!cache?.lastUpdated) return true
  const age = Date.now() - Date.parse(cache.lastUpdated)
  return Number.isNaN(age) || age > TTL_MS
}

export function triggerBackgroundRefresh() {
  if (refreshing) return
  refreshing = true
  refresh({ target: TMP_PATH, verbose: false })
    .then(payload => {
      cache = payload
      lastRefreshErr = null
      console.log(`[refresh] done: ${payload.posts.length} posts`)
    })
    .catch(err => {
      lastRefreshErr = err.message
      console.error(`[refresh] failed: ${err.message}`)
    })
    .finally(() => { refreshing = false })
}

export async function getPosts() {
  const data = await ensureLoaded()
  if (isStale()) triggerBackgroundRefresh()
  return data
}

export async function getStatus() {
  await ensureLoaded()
  return {
    ok: true,
    cached: (cache?.posts?.length ?? 0) > 0,
    lastUpdated: cache?.lastUpdated ?? null,
    stale: isStale(),
    refreshing,
    lastRefreshErr,
  }
}
