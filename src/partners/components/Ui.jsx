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
