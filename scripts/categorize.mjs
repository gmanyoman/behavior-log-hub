const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const CATEGORIES = ['설계 가이드', '도구 리뷰', '활용 후기', '조직·문화·프로세스', '기타']

const SYSTEM_INSTRUCTION = `너는 국내외 기술블로그 아티클을 "행동로그/이벤트 태깅" 관점으로 분류하는 편집자다.
각 아티클을 다음 카테고리 중 하나로 분류하고, 한국어 한 줄 요약(40자 내외)과 관련 도구 태그를 추출한다.

카테고리:
- 설계 가이드: 이벤트 스키마, 명명 규칙, taxonomy, 로그 구조 설계 등
- 도구 리뷰: Amplitude/Mixpanel/PostHog/GA/GTM 등 도구 소개·비교·후기
- 활용 후기: 실제 팀·서비스에서 이벤트 태깅을 도입/운영한 사례
- 조직·문화·프로세스: 데이터 조직 운영, 워크플로우, 거버넌스
- 기타: 위에 해당하지 않지만 행동로그 문맥과 관련 있는 글

태그: 아티클에서 언급된 도구/기술명(소문자, 예: amplitude, mixpanel, gtm, ga4, posthog, segment, bigquery)만 뽑는다. 최대 5개.

출력은 반드시 아래 JSON 스키마 하나만.
{"summary": "한국어 한 줄", "category": "설계 가이드", "tags": ["gtm", "amplitude"]}`

function buildPrompt(item) {
  const snippet = (item.rawSnippet ?? '').slice(0, 800)
  return `제목: ${item.title}
출처: ${item.source}
매칭 키워드: ${item.matchedKeywords?.join(', ') ?? ''}
본문 발췌: ${snippet}

위 아티클을 지시대로 분류하고 JSON 하나만 출력하라.`
}

async function callGemini(item, apiKey) {
  const body = {
    system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: buildPrompt(item) }] }],
    generationConfig: {
      response_mime_type: 'application/json',
      response_schema: {
        type: 'object',
        properties: {
          summary: { type: 'string' },
          category: { type: 'string', enum: CATEGORIES },
          tags: { type: 'array', items: { type: 'string' } },
        },
        required: ['summary', 'category'],
      },
      temperature: 0.2,
    },
  }
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${text.slice(0, 200)}`)
  }
  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text
  if (!text) throw new Error('Gemini empty response')
  return JSON.parse(text)
}

function normalize(result, item) {
  const category = CATEGORIES.includes(result.category) ? result.category : '기타'
  const tags = Array.isArray(result.tags)
    ? result.tags.map(t => String(t).toLowerCase().trim()).filter(Boolean).slice(0, 5)
    : []
  return {
    url: item.url,
    title: item.title,
    source: item.source,
    publishedAt: item.publishedAt,
    thumbnailUrl: item.thumbnailUrl ?? null,
    summary: (result.summary ?? '').trim(),
    category,
    tags,
  }
}

export async function categorize(items, { concurrency = 4, existing = [], verbose = false } = {}) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY not set')

  const existingMap = new Map(existing.map(p => [p.url, p]))
  const queue = [...items]
  const output = []
  let done = 0

  async function worker() {
    while (queue.length) {
      const item = queue.shift()
      if (!item) return
      const cached = existingMap.get(item.url)
      if (cached && cached.summary && cached.category) {
        output.push(cached)
        done++
        continue
      }
      try {
        const result = await callGemini(item, apiKey)
        output.push(normalize(result, item))
      } catch (err) {
        if (verbose) console.log(`  ✗ ${item.title.slice(0, 40)} — ${err.message}`)
      }
      done++
      if (verbose && done % 10 === 0) console.log(`  … ${done}/${items.length}`)
    }
  }

  const workers = Array.from({ length: concurrency }, () => worker())
  await Promise.all(workers)
  return output
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { collect } = await import('./collect.mjs')
  const { items } = await collect({ verbose: true })
  console.log(`\n분류 대상: ${items.length}건`)
  const posts = await categorize(items, { verbose: true })
  console.log(`\n분류 완료: ${posts.length}건`)
  console.log(JSON.stringify(posts.slice(0, 3), null, 2))
}
