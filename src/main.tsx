import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/inter/latin-400.css'
import '@fontsource/inter/latin-500.css'
import '@fontsource/inter/latin-600.css'
import '@fontsource/inter/latin-700.css'
import './styles/tokens.css'
import './styles/base.css'
import './styles/components.css'
import App from './App.tsx'
import { registerUpdates } from './app/pwa'

registerUpdates()

// iOS Safari ignores user-scalable=no, so pinch-zoom has to be cancelled at its gesture events.
document.addEventListener('gesturestart', (event) => event.preventDefault(), { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
