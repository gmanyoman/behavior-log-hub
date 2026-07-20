import { useEffect, useMemo, useState } from 'react'
import CategoryFilter from './components/CategoryFilter.jsx'
import PostCard from './components/PostCard.jsx'

const ALL = '전체'
const CATEGORIES = [ALL, '설계 가이드', '도구 리뷰', '활용 후기', '조직·문화·프로세스', '기타']
const STORAGE_KEY = 'behavior-log-hub:posts'

function loadFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}
function saveToStorage(data) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)) } catch {}
}

export default function App() {
  const [data, setData] = useState({ posts: [], lastUpdated: null })
  const [category, setCategory] = useState(ALL)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    const cached = loadFromStorage()
    if (cached) setData({ posts: cached.posts ?? [], lastUpdated: cached.lastUpdated ?? null })
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const existing = data.posts
      const res = await fetch('/api/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ existing }),
      })
      if (!res.ok) throw new Error(`서버 응답 오류 (${res.status})`)
      const payload = await res.json()
      const next = { posts: payload.posts ?? [], lastUpdated: payload.lastUpdated ?? null }
      setData(next)
      saveToStorage(next)
    } catch (e) {
      setError(e.message ?? '알 수 없는 오류')
    } finally {
      setRefreshing(false)
    }
  }

  const counts = useMemo(() => {
    const c = { [ALL]: data.posts.length }
    for (const p of data.posts) c[p.category] = (c[p.category] ?? 0) + 1
    return c
  }, [data.posts])

  const filtered = useMemo(() => {
    if (category === ALL) return data.posts
    return data.posts.filter(p => p.category === category)
  }, [data.posts, category])

  return (
    <div className="container">
      <header>
        <h1 className="title">행동로그 허브</h1>
        <p className="sub">국내외 기술블로그의 행동로그·이벤트 태깅 아티클을 한 곳에서</p>
        <div className="header-row">
          {data.lastUpdated && (
            <p className="meta">마지막 갱신: {formatDate(data.lastUpdated)}</p>
          )}
          <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? '새 글 수집 중…' : '🔄 새로고침'}
          </button>
        </div>
      </header>

      <div className="controls">
        <CategoryFilter
          categories={CATEGORIES}
          active={category}
          counts={counts}
          onChange={setCategory}
        />
      </div>

      {error && <div className="notice-error">{error}</div>}
      {refreshing && data.posts.length === 0 && (
        <div className="loading">RSS 피드 수집 + AI 분류 중… (30~60초 소요)</div>
      )}
      {!refreshing && data.posts.length === 0 && (
        <div className="empty">
          아직 수집된 글이 없어요.<br />
          우측 상단 <strong>새로고침</strong> 버튼을 눌러 최신 글을 불러오세요.
        </div>
      )}
      {data.posts.length > 0 && (
        <>
          <div className="stats">{filtered.length}개 아티클</div>
          {filtered.length === 0 ? (
            <div className="empty">이 카테고리엔 아직 글이 없어요</div>
          ) : (
            <div className="grid">
              {filtered.map(p => <PostCard key={p.url} post={p} />)}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function formatDate(iso) {
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  } catch { return iso }
}
function pad(n) { return String(n).padStart(2, '0') }
