import { Component } from 'react'

/**
 * The four states every tab in this panel now renders explicitly. Before this,
 * a tab either showed a spinner or a table — an empty queue, a failed query and
 * a still-loading query were indistinguishable to the operator.
 *
 * Icons are inline monochrome SVG on purpose: the brand rules forbid coloured
 * icons, and an emoji would render in a different font per platform.
 */

export function LoadingState() {
  return (
    <div className="admin-loading">
      <div className="admin-spinner" />
    </div>
  )
}

export function TableSkeleton({ rows = 5, cols = 5 }) {
  return (
    <div className="admin-table-wrapper" aria-hidden="true">
      <table className="admin-table admin-skeleton-table">
        <tbody>
          {Array.from({ length: rows }).map((_, r) => (
            <tr key={r}>
              {Array.from({ length: cols }).map((__, c) => (
                <td key={c}>
                  <span className="admin-skeleton-bar" style={{ width: c === 0 ? '70%' : '45%' }} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function EmptyState({ title, hint, action }) {
  return (
    <div className="admin-empty">
      <svg className="admin-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="admin-empty-title">{title}</p>
      {hint && <p className="admin-empty-hint">{hint}</p>}
      {action && <div className="admin-empty-action">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="admin-empty admin-empty-error">
      <svg className="admin-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.5v5M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="admin-empty-title">تعذّر تحميل البيانات</p>
      {message && <p className="admin-empty-hint">{message}</p>}
      <div className="admin-empty-action">
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={onRetry || (() => window.location.reload())}
        >
          إعادة المحاولة
        </button>
      </div>
    </div>
  )
}

/**
 * A Convex `useQuery` that throws — an expired session hitting requireAdmin, for
 * instance — throws during render. Without a boundary here the root
 * ErrorBoundary catches it and replaces the whole panel with an English "reload"
 * screen. Mount one per tab (keyed by tab id) so the failure stays in the tab
 * that caused it and the nav still works.
 */
export class TabErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Admin tab error:', error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          message={this.state.error?.message?.slice(0, 300)}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
