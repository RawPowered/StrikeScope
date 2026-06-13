import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ErrorBoundary } from '@strikescope/shared/src/ErrorBoundary'
import { AuthProvider } from './auth'
import './index.css'
import App from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('Root element not found')

const apiBase = import.meta.env.VITE_API_URL || ''

createRoot(rootEl).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider apiBase={apiBase}>
        <App />
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>
)
