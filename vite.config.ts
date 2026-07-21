import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages sert un site de projet sous /<dépôt>/ : le workflow de
  // déploiement renseigne BASE_PATH. En local et sur un domaine dédié, la
  // racine suffit.
  base: process.env.BASE_PATH ?? '/',
  server: {
    // Respecte le port imposé par l'environnement (aperçu, conteneur, CI).
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
