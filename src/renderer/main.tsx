import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

declare global {
  interface Window {
    electronAPI: import('../preload').ElectronAPI
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)