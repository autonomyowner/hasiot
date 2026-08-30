import { useId, useMemo, useState } from 'react'
import { BRAND, formatNumber } from './chart-tokens'

/**
 * The panel's charts, as inline SVG.
 *
 * No charting library: the admin chunk is already the heaviest thing the site
 * ships, and these four forms are a few dozen lines each. Everything here
 * follows one set of rules, so the dashboard reads as one system:
 *
 * - Marks are thin and quiet. 2px lines, area wash at ~10%, bars capped at 22px
 *   with a 4px rounded data-end and a square baseline, hairline axes one step off
 *   the surface. The data is the only loud thing.
 * - Magnitude is one hue. Nominal bars (listing types) all take the brand green:
 *   colouring them by their own value spends the identity channel re-encoding
 *   what bar length already shows.
 * - Status colour never travels alone. The booking-status rows pair a colour with
 *   a written label and a number, because the reserved status palette is not
 *   colourblind-separable on its own — that pairing is the mitigation.
 * - Single series carry no legend; the card's title says what is plotted.
 */

/**
 * Single-series area chart with a hover crosshair. Used as a small multiple —
 * two of these side by side beat one two-series chart here, because the reader's
 * question is "is this going up", per series, not "which is bigger".
 */
export function AreaChart({ values, labels, height = 120, color = BRAND, valueLabel = '', compact = false }) {
  const gradientId = useId()
  const [hover, setHover] = useState(null)

  const width = 320
  const padY = 10
  const max = Math.max(1, ...values)
  const stepX = values.length > 1 ? width / (values.length - 1) : width
  const y = (v) => padY + (1 - v / max) * (height - padY * 2)

  const points = values.map((v, i) => [i * stepX, y(v)])
  const line = points.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
  const area = `${line} L${width},${height} L0,${height} Z`
  const last = points[points.length - 1]

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    const index = Math.round(ratio * (values.length - 1))
    if (index >= 0 && index < values.length) setHover(index)
  }

  return (
    <div className="ar-chart" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
           aria-label={`${valueLabel}: ${values.join('، ')}`}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.18" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} className="ar-chart-axis" />
        <path d={area} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2"
              strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />

        {hover !== null && (
          <line x1={points[hover][0]} y1="0" x2={points[hover][0]} y2={height}
                className="ar-chart-crosshair" vectorEffect="non-scaling-stroke" />
        )}

        {/* End dot carries a surface-coloured ring so it stays legible over the line. */}
        <circle cx={last[0]} cy={last[1]} r="4.5" fill={color} stroke="#fff" strokeWidth="2"
                vectorEffect="non-scaling-stroke" />
      </svg>

      {hover !== null && (
        <div className="ar-chart-tip" style={{ insetInlineEnd: `${(hover / (values.length - 1)) * 100}%` }}>
          <strong>{formatNumber(values[hover])}</strong>
          <span>{labels?.[hover]?.slice(5) || ''}</span>
        </div>
      )}

      {/* No y-axis: on a card this size, one label for the peak plus the two
          ends of the range says everything the ticks would have. */}
      {!compact && <div className="ar-chart-foot">
        <span>منذ 14 يوماً</span>
        <span className="ar-chart-peak">الأعلى: {formatNumber(max)}</span>
        <span>اليوم</span>
      </div>}
    </div>
  )
}

/** Value + label + trend, the form for "one number that matters". */
export function StatTile({ label, value, hint, trend }) {
  return (
    <div className="ar-stat">
      <span className="ar-stat-label">{label}</span>
      <span className="ar-stat-value">{formatNumber(value)}</span>
      {trend && (
        <div className="ar-stat-spark">
          <AreaChart values={trend} height={36} valueLabel={label} />
        </div>
      )}
      {hint && <span className="ar-stat-hint">{hint}</span>}
    </div>
  )
}

/**
 * Horizontal bars for comparing magnitude across a handful of named things.
 * Rows sort themselves largest-first: the reader's job is the ranking.
 */
export function BarList({ items, color = BRAND, emptyLabel = 'لا توجد بيانات' }) {
  const rows = useMemo(
    () => [...items].sort((a, b) => b.value - a.value),
    [items]
  )
  const max = Math.max(1, ...rows.map((r) => r.value))

  if (rows.length === 0 || rows.every((r) => r.value === 0)) {
    return <p className="ar-chart-empty">{emptyLabel}</p>
  }

  return (
    <ul className="ar-barlist">
      {rows.map((row) => (
        <li key={row.label} className="ar-barlist-row">
          <span className="ar-barlist-label">
            {row.color && (
              <span className="ar-barlist-dot" style={{ background: row.color }} aria-hidden="true" />
            )}
            {row.label}
          </span>
          <span className="ar-barlist-track">
            <span
              className="ar-barlist-bar"
              style={{ width: `${(row.value / max) * 100}%`, background: row.color || color }}
            />
          </span>
          <span className="ar-barlist-value">{formatNumber(row.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** A single ratio against its limit — a meter, never a two-slice pie. */
export function Meter({ label, value, total, hint, invert = false }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  // `invert` means the number counts what is *missing*, so a full bar is bad.
  const tone = invert
    ? (pct === 0 ? 'good' : pct < 25 ? 'warn' : 'bad')
    : (pct >= 75 ? 'good' : pct >= 40 ? 'warn' : 'bad')

  return (
    <div className="ar-meter">
      <div className="ar-meter-head">
        <span className="ar-meter-label">{label}</span>
        {/* "3 / 58" set in an RTL paragraph reorders to "58 / 3" and reads as the
            wrong number. Arabic "من" carries the fraction unambiguously. */}
        <span className="ar-meter-value">
          {formatNumber(value)} <small>من {formatNumber(total)}</small>
        </span>
      </div>
      <div className="ar-meter-track" role="img" aria-label={`${label}: ${pct}%`}>
        <div className={`ar-meter-fill ${tone}`} style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      {hint && <p className="ar-meter-hint">{hint}</p>}
    </div>
  )
}
