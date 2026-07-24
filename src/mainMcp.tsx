import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PageMcp from './PageMcp.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageMcp />
  </StrictMode>,
)
