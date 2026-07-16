import { useState } from 'react'

export default function PostCard({ post }) {
  const [imgError, setImgError] = useState(false)
  const hasImage = post.thumbnailUrl && !imgError
  return (
    <a className="card" href={post.url} target="_blank" rel="noreferrer noopener">
      <div className={`thumb${hasImage ? '' : ' thumb-placeholder'}`}>
        {hasImage
          ? <img src={post.thumbnailUrl} alt="" loading="lazy" onError={() => setImgError(true)} />
          : <span className="thumb-fallback">{post.source}</span>}
      </div>
      <div className="card-body">
        <div className="card-head">
          <span className="badge source">{post.source}</span>
          {post.category && <span className="badge category">{post.category}</span>}
        </div>
        <h3 className="card-title">{post.title}</h3>
        {post.summary && <p className="card-summary">{post.summary}</p>}
        <div className="card-foot">
          <span className="date">{formatShort(post.publishedAt)}</span>
          {post.tags?.length > 0 && (
            <div className="tags">
              {post.tags.slice(0, 3).map(t => <span key={t} className="tag">#{t}</span>)}
            </div>
          )}
        </div>
      </div>
    </a>
  )
}

function formatShort(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`
  } catch { return '' }
}
function pad(n) { return String(n).padStart(2, '0') }
