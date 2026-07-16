import Parser from 'rss-parser'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { extractThumbnailFromRssItem, fetchOgImage } from './thumbnail.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(__dirname, '..')

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'behavior-log-hub/0.1 (+contact)' },
  customFields: {
    item: [
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'creator'],
    ],
  },
})

const HTML_TAG = /<[^>]+>/g
const WHITESPACE = /\s+/g

function stripHtml(s) {
  if (!s) return ''
  return String(s).replace(HTML_TAG, ' ').replace(WHITESPACE, ' ').trim()
}

function matchKeywords(text, keywords) {
  if (!text) return []
  const hay = text.toLowerCase()
  const hits = []
  for (const k of keywords) {
    if (hay.includes(k.toLowerCase())) hits.push(k)
  }
  return hits
}

async function fetchFeed(feed, keywords) {
  try {
    const parsed = await parser.parseURL(feed.url)
    const items = parsed.items ?? []
    const passed = []
    for (const it of items) {
      const title = (it.title ?? '').trim()
      const url = it.link ?? it.guid
      if (!url || !title) continue

      const bodyRaw = it.contentEncoded ?? it.content ?? it.contentSnippet ?? it.summary ?? ''
      const body = stripHtml(bodyRaw)
      const searchText = `${title}\n${body}`
      const hits = matchKeywords(searchText, keywords)
      if (hits.length === 0) continue

      passed.push({
        url,
        title,
        source: feed.name,
        lang: feed.lang,
        publishedAt: it.isoDate ?? it.pubDate ?? null,
        rawSnippet: body.slice(0, 500),
        matchedKeywords: hits,
        thumbnailUrl: extractThumbnailFromRssItem(it),
      })
    }
    return { ok: true, feed: feed.name, count: passed.length, items: passed }
  } catch (err) {
    return { ok: false, feed: feed.name, error: err.message, items: [] }
  }
}

async function enrichThumbnails(items, { concurrency = 6, verbose = false } = {}) {
  const queue = items.filter(it => !it.thumbnailUrl)
  let done = 0
  async function worker() {
    while (queue.length) {
      const it = queue.shift()
      if (!it) return
      it.thumbnailUrl = await fetchOgImage(it.url)
      done++
      if (verbose && done % 10 === 0) console.log(`  … og:image ${done}`)
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()))
}

export async function collect({ verbose = false, enrich = true } = {}) {
  const [sourcesRaw, keywordsRaw] = await Promise.all([
    readFile(path.join(ROOT, 'data/sources.json'), 'utf8'),
    readFile(path.join(ROOT, 'data/keywords.json'), 'utf8'),
  ])
  const { feeds } = JSON.parse(sourcesRaw)
  const kw = JSON.parse(keywordsRaw)
  const keywords = [...(kw.ko ?? []), ...(kw.en ?? [])]

  const results = await Promise.all(feeds.map(f => fetchFeed(f, keywords)))
  const merged = []
  for (const r of results) {
    if (verbose) {
      if (r.ok) console.log(`  ✓ ${r.feed}: ${r.count} matched`)
      else console.log(`  ✗ ${r.feed}: ${r.error}`)
    }
    merged.push(...r.items)
  }
  if (enrich) {
    if (verbose) console.log(`[collect] enriching thumbnails…`)
    await enrichThumbnails(merged, { verbose })
  }
  return { items: merged, results }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { items, results } = await collect({ verbose: true })
  const dead = results.filter(r => !r.ok).map(r => r.feed)
  console.log(`\n총 ${items.length}건 매칭 (피드 ${results.length}개, 실패 ${dead.length}개)`)
  if (dead.length) console.log('실패 피드:', dead)
}
