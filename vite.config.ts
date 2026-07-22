import { defineConfig } from 'vite'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // GitHub Pages sert un site de projet sous /<dépôt>/ : le workflow de
  // déploiement renseigne BASE_PATH. En local et sur un domaine dédié, la
  // racine suffit.
  base: process.env.BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      // Un point d'entrée HTML par outil. L'hébergement étant statique, chaque
      // outil est une vraie page : /acomptes/ est servi depuis son propre
      // index.html, sans redirection ni routeur côté client.
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        acomptes: resolve(import.meta.dirname, 'acomptes/index.html'),
      },
    },
  },
  server: {
    // Respecte le port imposé par l'environnement (aperçu, conteneur, CI).
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
