import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const PairsWatchlist = lazy(() => import('./PairsWatchlist.jsx'))

const path = window.location.pathname

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<div style={{background:'#060810',minHeight:'100vh'}} />}>
      {path === '/watchlist' ? <PairsWatchlist /> : <App />}
    </Suspense>
  </React.StrictMode>
)
