import { useState } from 'react'

// Wordless placeholder — a text label here would be untranslated on the Arabic
// side of the app, so use a neutral image glyph instead.
const fallbackImage = 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#E8DFD4"/><g fill="none" stroke="#9ca3af" stroke-width="2"><rect x="160" y="120" width="80" height="60" rx="4"/><circle cx="180" cy="140" r="7"/><path d="M164 172l24-22 20 18 12-10 16 14"/></g></svg>`)

export default function ImageCarousel({ images = [], height = 200, borderRadius = '16px 16px 0 0', alt = '' }) {
  const [current, setCurrent] = useState(0)
  const srcs = images.length > 0 ? images : [fallbackImage]

  const prev = (e) => {
    e.stopPropagation()
    setCurrent((c) => (c - 1 + srcs.length) % srcs.length)
  }
  const next = (e) => {
    e.stopPropagation()
    setCurrent((c) => (c + 1) % srcs.length)
  }

  return (
    <div style={{ position: 'relative', width: '100%', height, overflow: 'hidden', borderRadius, background: '#f3f4f6' }}>
      <img
        src={srcs[current]}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        onError={(e) => { e.target.src = fallbackImage }}
      />
      {srcs.length > 1 && (
        <>
          <button onClick={prev} style={arrowStyle('left')} aria-label="Previous">‹</button>
          <button onClick={next} style={arrowStyle('right')} aria-label="Next">›</button>
          <div style={{ position: 'absolute', bottom: 8, left: '50%', transform: 'translateX(-50%)', display: 'flex', gap: 4 }}>
            {srcs.map((_, i) => (
              <span key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: i === current ? '#fff' : 'rgba(255,255,255,0.5)', transition: 'background 0.2s' }} />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function arrowStyle(side) {
  return {
    position: 'absolute',
    top: '50%',
    [side]: 6,
    transform: 'translateY(-50%)',
    background: 'rgba(255,255,255,0.85)',
    border: 'none',
    borderRadius: '50%',
    width: 28,
    height: 28,
    fontSize: 18,
    lineHeight: '28px',
    textAlign: 'center',
    cursor: 'pointer',
    color: '#333',
    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
    opacity: 0.8,
    padding: 0,
  }
}
