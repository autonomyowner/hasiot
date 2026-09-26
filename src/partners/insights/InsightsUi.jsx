import { useState } from 'react'
import { formatCount } from './format'

/**
 * Small inline-SVG charts and icons for the analytics and guests pages.
 *
 * The admin panel's Charts.jsx is Arabic-only (RTL axes, Arabic captions) and
 * styled by admin.css, which the partner chunk does not load. These follow the
 * same rules — thin marks, one hue, every value also written as text — and
 * mirror the time axis in Arabic so the newest bucket sits at the reading end.
 */

const ICONS = {
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  users: 'M9 11a4 4 0 100-8 4 4 0 000 8zM2 21c.8-3.5 3.5-5.5 7-5.5s6.2 2 7 5.5M16 3.5a4 4 0 010 7.5M18 15.5c2 .7 3.4 2.6 4 5.5',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  search: 'M11 4a7 7 0 100 14 7 7 0 000-14zM20 20l-4-4',
  close: 'M6 6l12 12M18 6L6 18',
  star: 'M12 3l2.8 5.7 6.2.9-4.5 4.4 1 6.2L12 17.3 6.5 20.2l1-6.2L3 9.6l6.2-.9z',
}

export function InsightIcon({ name, size = 20 }) {
  return (
    <svg className="p-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={ICONS[name] ?? ''} />
    </svg>
  )
}

/**
 * Two or three series over time as small multiples: one row per series, each
 * with its own scale, because requests (tens) and revenue (thousands) on one
 * axis flatten the smaller line to the floor.
 */
export function TrendChart({ labels, series, rtl, formatters = {} }) {
  const width = 600
  const height = 96
  const count = labels.length
  const barW = count > 0 ? width / count : width
  // { key, i }: the bar under the pointer, drawn as a tooltip above its row.
  const [hover, setHover] = useState(null)

  return (
    <div className="p-ins-trend">
      {series.map((s) => {
        const max = Math.max(1, ...s.values)
        const fmt = formatters[s.key] ?? formatCount
        const total = s.values.reduce((a, b) => a + b, 0)
        const tip = hover && hover.key === s.key ? hover.i : null
        const tipSlot = tip === null ? 0 : rtl ? count - 1 - tip : tip
        return (
          <figure key={s.key} className="p-ins-trend-row">
            <figcaption className="p-ins-trend-head">
              <span>{s.label}</span>
              <strong>{fmt(total)}</strong>
            </figcaption>
            <div className="p-ins-plot" onMouseLeave={() => setHover(null)}>
              <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img"
                aria-label={`${s.label}: ${s.values.map((v, i) => `${labels[i]} ${fmt(v)}`).join(', ')}`}>
                <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="p-ins-gridline" />
                <line x1="0" y1="6" x2={width} y2="6" className="p-ins-gridline" />
                <line x1="0" y1={height - 0.5} x2={width} y2={height - 0.5} className="p-ins-axis" />
                {s.values.map((v, i) => {
                  const h = v > 0 ? Math.max(2, (v / max) * (height - 6)) : 0
                  const slot = rtl ? count - 1 - i : i
                  return (
                    <rect key={labels[i] ?? i} x={slot * barW + barW * 0.15} y={height - h} width={barW * 0.7} height={h}
                      className={tip === i ? 'p-ins-bar is-hover' : 'p-ins-bar'} rx={Math.min(4, barW * 0.2)}
                      onMouseEnter={() => setHover({ key: s.key, i })} />
                  )
                })}
              </svg>
              {tip !== null && (
                <span className="p-ins-tip" aria-hidden="true"
                  style={{ left: `${((tipSlot + 0.5) / Math.max(1, count)) * 100}%` }}>
                  <span className="p-ins-tip-label">{labels[tip]}</span>
                  <strong>{fmt(s.values[tip])}</strong>
                </span>
              )}
            </div>
          </figure>
        )
      })}
      {count > 0 && (
        <div className="p-ins-trend-foot" aria-hidden="true">
          <span>{labels[0]}</span>
          <span>{labels[count - 1]}</span>
        </div>
      )}
    </div>
  )
}

/** Horizontal bars with a written label and value on every row. */
export function Bars({ rows, format = formatCount }) {
  const max = Math.max(1, ...rows.map((r) => r.value))
  return (
    <ul className="p-ins-bars">
      {rows.map((row) => (
        <li key={row.key} className={row.value > 0 && row.value === max ? 'p-ins-bars-row is-top' : 'p-ins-bars-row'}>
          <span className="p-ins-bars-label">{row.label}</span>
          <span className="p-ins-bars-track">
            <span className="p-ins-bars-fill" style={{ width: `${(row.value / max) * 100}%` }} />
          </span>
          <span className="p-ins-bars-value">{format(row.value)}</span>
        </li>
      ))}
    </ul>
  )
}
