import { Component } from 'react'
import './SectionBoundary.css'

const copy = {
  ar: {
    title: 'تعذّر تحميل هذا القسم',
    body: 'حدث خطأ أثناء جلب البيانات. تحقّق من اتصالك ثم أعد المحاولة.',
    retry: 'إعادة المحاولة',
  },
  en: {
    title: "Couldn't load this section",
    body: 'Something went wrong while fetching the data. Check your connection and try again.',
    retry: 'Try again',
  },
}

/**
 * Inline error state for a failed Convex query.
 *
 * Convex surfaces both "loading" and "errored" as `undefined`, so without this
 * a failing query renders a skeleton forever. Use it directly when you detect a
 * failure, or let SectionBoundary render it on a thrown error.
 */
export function QueryError({ lang = 'ar', onRetry }) {
  const t = copy[lang] || copy.ar
  return (
    <div className="hs-query-error" role="alert">
      <h3>{t.title}</h3>
      <p>{t.body}</p>
      <button type="button" onClick={onRetry || (() => window.location.reload())}>
        {t.retry}
      </button>
    </div>
  )
}

/**
 * Catches render errors from one region of the page — a thrown Convex query
 * included — so a single broken section does not blank the whole route the way
 * the top-level ErrorBoundary does.
 */
class SectionBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Section error:', error, errorInfo)
  }

  handleRetry = () => {
    // Remount the subtree rather than reloading the whole document — a
    // transient query failure usually resolves on a re-subscribe.
    this.setState({ hasError: false })
  }

  render() {
    if (this.state.hasError) {
      return <QueryError lang={this.props.lang} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

export default SectionBoundary
