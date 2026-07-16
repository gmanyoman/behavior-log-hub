import { useEffect, useMemo, useState } from 'react'
import CategoryFilter from './components/CategoryFilter.jsx'
import PostCard from './components/PostCard.jsx'

const ALL = '전체'
const CATEGORIES = [ALL, '설계 가이드', '도구 리뷰', '활용 후기', '조직·문화·프로세스', '기타']

export default function App() {
  const [data, setData] = useState({ posts: [], lastUpdated: null })
  const [category, setCategory] = useState(ALL)
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    fetch('/api/posts')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(json => {
        setData({ posts: json.posts ?? [], lastUpdated: json.lastUpdated ?? null })
        setStatus('ready')
      })
      .catch(() => setStatus('error'))
  }, [])

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
        {data.lastUpdated && (
          <p className="meta">마지막 갱신: {formatDate(data.lastUpdated)}</p>
        )}
      </header>

      <div className="controls">
        <CategoryFilter
          categories={CATEGORIES}
          active={category}
          counts={counts}
          onChange={setCategory}
        />
      </div>

      {status === 'loading' && <div className="loading">불러오는 중…</div>}
      {status === 'error' && <div className="empty">데이터를 불러오지 못했습니다.</div>}
      {status === 'ready' && (
        <>
          <div className="stats">{filtered.length}개 아티클</div>
          {filtered.length === 0 ? (
            <div className="empty">
              {data.posts.length === 0
                ? '수집 대기 중 · 잠시 후 새로고침해 주세요'
                : '이 카테고리엔 아직 글이 없어요'}
            </div>
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
