import React, { lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import TradingScanner from './TradingScanner.jsx'

const path = window.location.pathname
const Loading = () => <div style={{background:'#05070e',minHeight:'100vh'}}/>

let Page = App
if (path === '/scanner') Page = TradingScanner

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Suspense fallback={<Loading/>}>
      <Page />
    </Suspense>
  </React.StrictMode>
)
