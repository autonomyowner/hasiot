import { Component } from 'react'

class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Page load error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          fontFamily: "'Outfit', system-ui, sans-serif",
          background: '#f8faf9',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.8)',
            backdropFilter: 'blur(12px)',
            borderRadius: '20px',
            padding: '2.5rem',
            maxWidth: '420px',
            boxShadow: '0 8px 32px rgba(13,122,95,0.08)'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🌐</div>
            <h2 style={{ color: '#0D7A5F', margin: '0 0 0.75rem', fontSize: '1.4rem' }}>
              Something went wrong
            </h2>
            <p style={{ color: '#6b7280', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              The page failed to load. This can happen with a slow connection. Please try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                background: '#0D7A5F',
                color: 'white',
                border: 'none',
                borderRadius: '14px',
                padding: '0.75rem 2rem',
                fontSize: '1rem',
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
