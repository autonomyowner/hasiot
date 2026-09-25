import { Component } from 'react'
import { readableError } from './toast-context'

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

/**
 * A failure, in Arabic, with the technical detail folded away.
 *
 * `error` is the thrown value: its readable sentence leads (the Arabic half of
 * a server refusal, or a named session / deployment problem), and the raw
 * message sits behind «التفاصيل التقنية» for whoever debugs it, instead of
 * being the first thing an operator reads.
 */
export function ErrorState({ title = 'تعذّر تحميل البيانات', error, message, onRetry }) {
  const readable = message ?? (error ? readableError(error, { log: false }) : null)
  const detail = error ? String(error?.message || error).slice(0, 2000) : null

  return (
    <div className="admin-empty admin-empty-error" role="alert">
      <svg className="admin-empty-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
        <path d="M12 7.5v5M12 16h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <p className="admin-empty-title">{title}</p>
      {readable && <p className="admin-empty-hint">{readable}</p>}
      <div className="admin-empty-action">
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          onClick={onRetry || (() => window.location.reload())}
        >
          إعادة المحاولة
        </button>
      </div>
      {detail && (
        <details className="admin-error-details">
          <summary>التفاصيل التقنية</summary>
          <pre dir="ltr">{detail}</pre>
        </details>
      )}
    </div>
  )
}

/**
 * Catch a render failure in one part of the panel and draw `fallback` in its
 * place, so the rest keeps working. `fallback(error, retry)`; `retry` renders
 * the children again.
 */
export class SectionBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
    this.retry = () => this.setState({ error: null })
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error(`[admin] ${this.props.name || 'section'} failed:`, error, info)
  }

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.retry)
    return this.props.children
  }
}

/**
 * A Convex `useQuery` that throws — an expired session hitting requireAdmin, for
 * instance — throws during render. Without a boundary here the root
 * ErrorBoundary catches it and replaces the whole panel with the site's English
 * "reload" screen. Mount one per tab (keyed by tab id) so the failure stays in
 * the tab that caused it, reads in Arabic, and the nav still works.
 */
export function TabErrorBoundary({ children }) {
  return (
    <SectionBoundary
      name="tab"
      fallback={(error, retry) => (
        <ErrorState title="تعذّر تحميل هذا القسم" error={error} onRetry={retry} />
      )}
    >
      {children}
    </SectionBoundary>
  )
}

/**
 * The foot of a paged table: a button while more pages exist, placeholder rows
 * while one is on its way, nothing once the list is complete.
 */
export function LoadMore({ status, onLoadMore, cols = 5 }) {
  if (status === 'LoadingMore') return <TableSkeleton rows={2} cols={cols} />
  if (status !== 'CanLoadMore') return null
  return (
    <div className="admin-load-more">
      <button type="button" className="admin-btn admin-btn-secondary" onClick={onLoadMore}>
        تحميل المزيد
      </button>
    </div>
  )
}

/**
 * A paged list with nothing on screen yet but more pages left to read: the
 * automatic follow-up stopped after several empty pages (see usePagedList).
 * Saying "no results" here would be false, so it offers to keep looking.
 */
export function KeepLooking({ onLoadMore }) {
  return (
    <EmptyState
      title="لا نتائج في ما تمت قراءته حتى الآن"
      hint="بقيت سجلات أخرى لم تُقرأ بعد، وقد تحتوي على نتائج مطابقة."
      action={
        <button type="button" className="admin-btn admin-btn-secondary" onClick={onLoadMore}>
          متابعة البحث
        </button>
      }
    />
  )
}
