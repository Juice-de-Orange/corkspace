import '@fontsource/caveat/400.css'
import '@fontsource/caveat/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/source-serif-4/400.css'
import '@fontsource/source-serif-4/600.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'
import { initLang } from './i18n'
import { initTheme } from './lib/theme'

initLang()
initTheme()

const root = document.getElementById('root')
if (!root) {
  throw new Error('root element #root is missing')
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
