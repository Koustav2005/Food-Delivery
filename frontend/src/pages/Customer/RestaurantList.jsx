import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../utils/supabase'

const GRADIENTS = [
  ['#ff7a59', '#ffb199'],
  ['#f7971e', '#ffd200'],
  ['#ff5f6d', '#ffc371'],
  ['#ff4d6d', '#ff8a3d'],
  ['#e96443', '#904e95'],
]

function gradientFor(name) {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  const [from, to] = GRADIENTS[hash % GRADIENTS.length]
  return `linear-gradient(135deg, ${from}, ${to})`
}

export default function RestaurantList() {
  const [restaurants, setRestaurants] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')

  useEffect(() => {
    supabase
      .from('restaurants')
      .select('*')
      .order('is_open', { ascending: false })
      .order('name')
      .then(({ data }) => {
        setRestaurants(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return restaurants
    return restaurants.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.city?.toLowerCase().includes(q) ||
        r.cuisine_tags?.some((t) => t.toLowerCase().includes(q)),
    )
  }, [restaurants, query])

  if (loading) return <p className="cd-empty">Finding restaurants near you…</p>

  return (
    <div className="cd-list-page">
      <div className="cd-search">
        <input
          placeholder="Search restaurants, cuisines, cities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {filtered.length === 0 && <p className="cd-empty">No restaurants match your search.</p>}

      <div className="cd-restaurant-grid">
        {filtered.map((r) => (
          <Link
            key={r.id}
            to={`/restaurant/${r.id}`}
            className={`cd-restaurant-card ${!r.is_open ? 'closed' : ''}`}
          >
            <div className="cd-restaurant-thumb" style={{ background: gradientFor(r.name) }}>
              <span>{r.name.trim()[0]?.toUpperCase() ?? '?'}</span>
              {!r.is_open && <span className="cd-closed-badge">Closed</span>}
            </div>
            <div className="cd-restaurant-info">
              <h3>{r.name}</h3>
              <p>{[r.address_line, r.city].filter(Boolean).join(', ')}</p>
              {r.cuisine_tags?.length > 0 && (
                <div className="cd-chip-row">
                  {r.cuisine_tags.slice(0, 3).map((tag) => (
                    <span key={tag} className="cd-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              <span className="cd-prep-time">~{r.avg_prep_minutes} min</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
