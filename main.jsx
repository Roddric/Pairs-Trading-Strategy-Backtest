import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'

const PairsWatchlist = lazy(() => import('./Pairswatchlist.jsx'))
const TradingScanner = lazy(() => import('./TradingScanner.jsx'))

const path = window.location.pathname
const Loading = () => <div style={{background:'#05070e',minHeight:'100vh'}}/>

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<Loading/>}>
      {path === '/watchlist' ? <PairsWatchlist /> :
       path === '/scanner'  ? <TradingScanner /> :
       <App />}
    </Suspense>
  </React.StrictMode>
)
