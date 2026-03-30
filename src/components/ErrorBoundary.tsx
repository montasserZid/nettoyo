import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '100vh',
            fontFamily: 'sans-serif',
            gap: '16px',
            padding: '24px'
          }}
        >
          <h2 style={{ color: '#1A1A2E', margin: 0 }}>Something went wrong</h2>
          <p
            style={{
              color: '#6B7280',
              maxWidth: '400px',
              textAlign: 'center',
              margin: 0
            }}
          >
            {this.state.error?.message}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              padding: '10px 24px',
              background: '#4FC3F7',
              color: 'white',
              border: 'none',
              borderRadius: '9999px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Reload page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
