import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PageAcomptes from './PageAcomptes.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageAcomptes />
  </StrictMode>,
)
