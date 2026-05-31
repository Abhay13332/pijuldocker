import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { applyTheme } from './themes'

// Apply saved color theme before React renders — prevents flash
const _savedTheme = localStorage.getItem('pijulserv-color-theme') ?? 'default';
applyTheme(_savedTheme);

const root = document.getElementById('root')
if (!root) throw new Error('Root element not found')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
