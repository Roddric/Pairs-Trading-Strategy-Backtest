import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import PairsWatchlist from './PairsWatchlist.jsx'

const path = window.location.pathname

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {path === '/watchlist' ? <PairsWatchlist /> : <App />}
  </React.StrictMode>
)
