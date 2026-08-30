import { useId, useMemo, useState } from 'react'
import { BRAND, formatNumber } from './chart-tokens'

/**
 * The panel's charts, as inline SVG.
 *
 * No charting library: the admin chunk is already the heaviest thing the site
 * ships, and these forms are a few dozen lines each. Everything here follows one
 * set of rules, so the dashboard reads as one system:
 *
 * - Marks are thin and quiet. 2px lines, area wash at ~10%, hairline axes one
 *   step off the surface. The data is the only loud thing.
 * - Magnitude is one hue. Nominal bars all take the brand green: colouring them
 *   by their own value spends the identity channel re-encoding what bar length
 *   already shows.
 * - Status colour never travels alone. Status rows pair a colour with a written
 *   label and a number, because the reserved status palette is not
 *   colourblind-separable on its own — that pairing is the mitigation.
 * - Single series carry no legend; two series get one, plus a direct end label.
 */

/**
 * Single-series area chart with a hover crosshair. Used as a small multiple —
 * two of these side by side beat one two-series chart where the reader's
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

        <circle cx={last[0]} cy={last[1]} r="4.5" fill={color} stroke="#fff" strokeWidth="2"
                vectorEffect="non-scaling-stroke" />
      </svg>

      {hover !== null && (
        <div className="ar-chart-tip" style={{ insetInlineEnd: `${(hover / (values.length - 1)) * 100}%` }}>
          <strong>{formatNumber(values[hover])}</strong>
          <span>{labels?.[hover]?.slice(5) || ''}</span>
        </div>
      )}

      {!compact && (
        <div className="ar-chart-foot">
          <span>منذ 14 يوماً</span>
          <span className="ar-chart-peak">الأعلى: {formatNumber(max)}</span>
          <span>اليوم</span>
        </div>
      )}
    </div>
  )
}

/**
 * Two series over time, with a legend, a hover marker and a value pill.
 *
 * Two series is where a legend becomes mandatory: colour alone must never be the
 * only way to tell them apart, so each series is also labelled at its end point.
 */
export function LineChart({ series, labels, height = 190 }) {
  const [hover, setHover] = useState(null)

  const width = 460
  const padTop = 18
  const padBottom = 26
  const count = labels.length
  const max = Math.max(1, ...series.flatMap((s) => s.values))
  const stepX = count > 1 ? width / (count - 1) : width
  const y = (v) => padTop + (1 - v / max) * (height - padTop - padBottom)

  // Two or three gridlines, on round numbers — they carry the values that are
  // not directly labelled, which is why the chart needs no y-axis text clutter.
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i)

  const onMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect()
    // RTL: the first point sits at the right edge of the box.
    const ratio = 1 - (e.clientX - rect.left) / rect.width
    const index = Math.round(ratio * (count - 1))
    if (index >= 0 && index < count) setHover(index)
  }

  return (
    <div className="ar-line" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <div className="ar-line-legend">
        {series.map((s) => (
          <span key={s.label} className="ar-line-key">
            <span className="ar-line-swatch" style={{ background: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img"
           aria-label={series.map((s) => `${s.label}: ${s.values.join('، ')}`).join(' — ')}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1="0" y1={y(t)} x2={width} y2={y(t)} className="ar-chart-grid" />
            <text x={width - 2} y={y(t) - 4} className="ar-chart-tick">{formatNumber(t)}</text>
          </g>
        ))}

        {series.map((s) => {
          const pts = s.values.map((v, i) => [width - i * stepX, y(v)])
          const d = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`).join(' ')
          return (
            <path key={s.label} d={d} fill="none" stroke={s.color} strokeWidth="2"
                  strokeDasharray={s.dashed ? '4 4' : undefined}
                  strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          )
        })}

        {hover !== null && (
          <>
            <line x1={width - hover * stepX} y1={padTop - 10} x2={width - hover * stepX}
                  y2={height - padBottom} className="ar-chart-crosshair" vectorEffect="non-scaling-stroke" />
            {series.map((s) => (
              <circle key={s.label} cx={width - hover * stepX} cy={y(s.values[hover])} r="4.5"
                      fill={s.color} stroke="#fff" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            ))}
          </>
        )}

        {labels.map((label, i) => (
          i % 2 === 0 ? (
            <text key={label} x={width - i * stepX} y={height - 6} className="ar-chart-xlabel">
              {label.slice(5)}
            </text>
          ) : null
        ))}
      </svg>

      {hover !== null && (
        <div className="ar-line-tip" style={{ insetInlineStart: `${(hover / (count - 1)) * 100}%` }}>
          <span className="ar-line-tip-date">{labels[hover]?.slice(5)}</span>
          {series.map((s) => (
            <span key={s.label} className="ar-line-tip-row">
              <span className="ar-line-swatch" style={{ background: s.color }} aria-hidden="true" />
              {formatNumber(s.values[hover])}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * A calendar-style dot grid: one column per day, one row per metric, dot
 * brightness by volume. It answers "which days were busy" at a glance without
 * asking anyone to read fourteen numbers.
 */
export function DotMatrix({ rows, labels }) {
  const max = Math.max(1, ...rows.flatMap((r) => r.values))

  return (
    <div className="ar-dots">
      {rows.map((row) => (
        <div key={row.label} className="ar-dots-row">
          <span className="ar-dots-label">{row.label}</span>
          <span className="ar-dots-track">
            {row.values.map((v, i) => {
              const level = v === 0 ? 0 : v >= max ? 3 : v > max / 2 ? 2 : 1
              return (
                <span
                  key={i}
                  className={`ar-dot lvl-${level}`}
                  title={`${labels[i]?.slice(5) || ''}: ${formatNumber(v)}`}
                />
              )
            })}
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Donut for one part-to-whole split, with the total as a hero number in the
 * middle. Two segments only — past that the reader is comparing arc lengths,
 * which a bar list does better.
 */
export function Donut({ value, total, centerLabel, segments }) {
  const size = 168
  const stroke = 18
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const pct = total > 0 ? value / total : 0

  return (
    <div className="ar-donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img"
           aria-label={`${centerLabel}: ${formatNumber(value)} من ${formatNumber(total)}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
                stroke="var(--ar-line-soft)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={BRAND} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${c * pct} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>

      <div className="ar-donut-center">
        <span className="ar-donut-value">{formatNumber(total)}</span>
        <span className="ar-donut-label">{centerLabel}</span>
      </div>

      <div className="ar-donut-legend">
        {segments.map((s) => (
          <span key={s.label} className="ar-donut-key">
            <span className="ar-line-swatch" style={{ background: s.color }} aria-hidden="true" />
            <strong>{total > 0 ? Math.round((s.value / total) * 100) : 0}%</strong>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  )
}

/**
 * The segmented capsule under the greeting: one bar, each segment a share of the
 * whole, each labelled above with its own percentage. Segments are separated by
 * a gap in the surface colour rather than a stroke.
 */
export function SegmentBar({ segments, total }) {
  const share = (v) => (total > 0 ? (v / total) * 100 : 0)

  return (
    <div className="ar-segments">
      {segments.map((s) => (
        <div key={s.label} className="ar-segment" style={{ flexGrow: Math.max(share(s.value), 6) }}>
          <span className="ar-segment-label">{s.label}</span>
          <span className={`ar-segment-bar ${s.tone}`}>
            <span className="ar-segment-pct">{Math.round(share(s.value))}%</span>
          </span>
        </div>
      ))}
    </div>
  )
}

/**
 * Horizontal bars for comparing magnitude across a handful of named things.
 * Rows sort themselves largest-first: the reader's job is the ranking.
 */
export function BarList({ items, color = BRAND, emptyLabel = 'لا توجد بيانات' }) {
  const rows = useMemo(() => [...items].sort((a, b) => b.value - a.value), [items])
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
            <span className="ar-barlist-bar"
                  style={{ width: `${(row.value / max) * 100}%`, background: row.color || color }} />
          </span>
          <span className="ar-barlist-value">{formatNumber(row.value)}</span>
        </li>
      ))}
    </ul>
  )
}

/** A single ratio against its limit — a meter, never a two-slice pie. */
export function Meter({ label, value, total, hint }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  const tone = pct >= 75 ? 'good' : pct >= 40 ? 'warn' : 'bad'

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

/** Value + label, the form for "one number that matters". */
export function StatTile({ label, value, hint, trend }) {
  return (
    <div className="ar-stat">
      <span className="ar-stat-label">{label}</span>
      <span className="ar-stat-value">{formatNumber(value)}</span>
      {trend && (
        <div className="ar-stat-spark">
          <AreaChart values={trend} height={36} valueLabel={label} compact />
        </div>
      )}
      {hint && <span className="ar-stat-hint">{hint}</span>}
    </div>
  )
}
