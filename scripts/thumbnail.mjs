const OG_IMAGE_RE = /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
const OG_IMAGE_RE_ALT = /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
const TWITTER_IMAGE_RE = /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
const FIRST_IMG_RE = /<img[^>]+src=["']([^"']+)["']/i

export function extractThumbnailFromHtml(html) {
  const m = html.match(OG_IMAGE_RE)
    ?? html.match(OG_IMAGE_RE_ALT)
    ?? html.match(TWITTER_IMAGE_RE)
    ?? html.match(FIRST_IMG_RE)
  if (!m) return null
  return m[1].trim()
}

export function extractThumbnailFromRssItem(item) {
  const enclosure = item.enclosure?.url
  if (enclosure && /^https?:/.test(enclosure)) return enclosure
  const mediaContent = item['media:content']?.$?.url || item['media:thumbnail']?.$?.url
  if (mediaContent) return mediaContent
  const content = item.contentEncoded ?? item.content ?? ''
  const inline = extractThumbnailFromHtml(content)
  if (inline) return inline
  return null
}

export async function fetchOgImage(url, { timeoutMs = 8000 } = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (behavior-log-hub/0.1)',
        Accept: 'text/html',
      },
      redirect: 'follow',
    })
    if (!res.ok) return null
    const html = await res.text()
    return extractThumbnailFromHtml(html)
  } catch {
    return null
  } finally {
    clearTimeout(t)
  }
}
