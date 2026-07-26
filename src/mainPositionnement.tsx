import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import PagePositionnement from './PagePositionnement.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PagePositionnement />
  </StrictMode>,
)
