import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PageSynthese from './PageSynthese.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageSynthese />
  </StrictMode>,
)
