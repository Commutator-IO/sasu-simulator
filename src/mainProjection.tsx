import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PageProjection from './PageProjection.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PageProjection />
  </StrictMode>,
)
