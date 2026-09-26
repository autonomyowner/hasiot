/**
 * The portal's small pieces: monochrome icons (currentColor, one stroke
 * weight), a spinner, and the loading / empty / error blocks every screen
 * shows. Text arrives as props so each page keeps its own translations.
 */

const PATHS = {
  home: 'M3 11l9-7 9 7M5 10v10h14V10',
  building: 'M4 21V4h11v17M15 9h5v12M8 8h3M8 12h3M8 16h3M3 21h18',
  briefcase: 'M3 8h18v12H3zM8 8V5h8v3M3 13h18',
  calendar: 'M4 6h16v15H4zM4 10h16M8 3v5M16 3v5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z M9 12l2 2 4-4',
  logout: 'M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10',
  globe: 'M12 3a9 9 0 100 18 9 9 0 000-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  check: 'M5 12l5 5 9-10',
  clock: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 7v5l3 2',
  alert: 'M12 3l10 18H2zM12 10v5M12 18v.5',
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 005 5L15 13l5 2v4a1 1 0 01-1 1A16 16 0 014 5a1 1 0 011-1z',
  user: 'M12 12a4 4 0 100-8 4 4 0 000 8zM4 21c1-4 4-6 8-6s7 2 8 6',
  chevron: 'M9 6l6 6-6 6',
  wallet: 'M4 7h15a1 1 0 011 1v11a1 1 0 01-1 1H4zM4 7V5a1 1 0 011-1h11v3M15 13.5h2',
  menu: 'M4 7h16M4 12h16M4 17h16',
  close: 'M6 6l12 12M18 6L6 18',
  info: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 11v5M12 7.5v.5',
  inbox: 'M4 13l2.5-8h11l2.5 8v6H4zM4 13h5l1 2h4l1-2h5',
  chart: 'M4 20h16M7 16v-4M12 16V8M17 16v-7',
  map: 'M9 4L3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
}

export function Icon({ name, size = 20, className = '' }) {
  return (
    <svg
      className={`p-icon ${className}`}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name] ?? ''} />
    </svg>
  )
}

export function Spinner({ label }) {
  return <span className="p-spinner" role="status" aria-label={label || 'Loading'} />
}

/**
 * A KPI tile: label row with a round icon dot at the end, the big number,
 * then whatever hint or change line the page passes as children. `index`
 * staggers its entrance (CSS reads --i).
 */
export function Kpi({ label, icon, value, index = 0, className = '', children }) {
  return (
    <div className={`p-card p-kpi ${className}`} style={{ '--i': index }}>
      <div className="p-kpi-head">
        <span className="p-kpi-label">{label}</span>
        {icon && <span className="p-kpi-dot">{icon}</span>}
      </div>
      <strong className="p-kpi-value">{value}</strong>
      {children}
    </div>
  )
}

/** Loading placeholders shaped like the KPI grid and the list below it. */
export function SkeletonKpis({ count = 4, label }) {
  return (
    <div className="p-kpis" role="status" aria-label={label || 'Loading'}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="p-card p-kpi p-skel-card" style={{ '--i': i }} aria-hidden="true">
          <span className="p-skel" style={{ width: '45%', height: 12 }} />
          <span className="p-skel" style={{ width: '60%', height: 30 }} />
          <span className="p-skel" style={{ width: '35%', height: 12 }} />
        </div>
      ))}
    </div>
  )
}

export function SkeletonList({ rows = 3, label }) {
  return (
    <div className="p-skel-list" role="status" aria-label={label || 'Loading'}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="p-card p-skel-row" style={{ '--i': i }} aria-hidden="true">
          <span className="p-skel p-skel-thumb" />
          <span className="p-skel-lines">
            <span className="p-skel" style={{ width: '55%', height: 14 }} />
            <span className="p-skel" style={{ width: '80%', height: 12 }} />
            <span className="p-skel" style={{ width: '30%', height: 12 }} />
          </span>
        </div>
      ))}
    </div>
  )
}

export function PageSpinner() {
  return (
    <div className="p-page-spinner">
      <Spinner />
    </div>
  )
}

export function EmptyState({ title, hint, icon = 'calendar' }) {
  return (
    <div className="p-state">
      <Icon name={icon} size={28} />
      <p className="p-state-title">{title}</p>
      {hint && <p className="p-state-hint">{hint}</p>}
    </div>
  )
}

export function ErrorState({ title, hint, retryLabel, onRetry }) {
  return (
    <div className="p-state p-state-error" role="alert">
      <Icon name="alert" size={28} />
      <p className="p-state-title">{title}</p>
      {hint && <p className="p-state-hint">{hint}</p>}
      {onRetry && (
        <button type="button" className="p-btn p-btn-ghost" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
    </div>
  )
}

/** Wraps Arabic-line phone numbers so "+966 50 …" keeps its order. */
export function Ltr({ children }) {
  return <bdi dir="ltr">{children}</bdi>
}
