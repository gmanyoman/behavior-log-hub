export default function CategoryFilter({ categories, active, counts, onChange }) {
  return (
    <div className="filter-row">
      {categories.map(c => (
        <button
          key={c}
          className={`pill${c === active ? ' active' : ''}`}
          onClick={() => onChange(c)}
        >
          {c}
          {counts[c] != null && <span className="count">{counts[c]}</span>}
        </button>
      ))}
    </div>
  )
}
