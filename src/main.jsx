import React from 'react'
import ReactDOM from 'react-dom/client'
import App from '@/App.jsx'
import '@/index.css'

class RootErrorBoundary extends React.Component {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('GHB Pay failed to render:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main role="alert" style={{ minHeight: '100vh', display: 'grid', placeContent: 'center', gap: '1rem', padding: '2rem', color: '#faf8f0', background: '#061a16', textAlign: 'center' }}>
          <h1>GHB Pay n’a pas pu s’afficher</h1>
          <p>Rechargez la page. Si le problème persiste, contactez l’assistance.</p>
          <button type="button" onClick={() => window.location.reload()}>
            Recharger
          </button>
        </main>
      )
    }

    return this.props.children
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <RootErrorBoundary>
    <App />
  </RootErrorBoundary>
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error) => {
      console.error('GHB Pay service worker registration failed:', error)
    })
  })
}
