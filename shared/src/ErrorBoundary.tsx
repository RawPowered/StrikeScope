import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
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

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ padding: 40, textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: '#888', fontSize: 14, margin: '8px 0' }}>
            {this.state.error?.message}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.reload() }}
            style={{
              background: '#F57C00', color: '#fff', border: 'none',
              padding: '8px 20px', borderRadius: 6, cursor: 'pointer', fontSize: 14,
            }}
          >
            Reload
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
