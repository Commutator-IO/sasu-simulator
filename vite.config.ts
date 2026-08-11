import { defineConfig, type Plugin } from 'vite'
import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Le site est servi à la racine de son domaine ; l'origine reste surchargeable
// pour un déploiement ailleurs.
const ORIGINE = process.env.SITE_URL ?? 'https://sasu.commutator.io'

// Une page HTML par outil. La même table sert au build et au plan du site :
// ajouter un outil suffit à le faire apparaître dans les deux.
const PAGES = {
  main: 'index.html',
  acomptes: 'acomptes/index.html',
  projection: 'projection/index.html',
  synthese: 'synthese/index.html',
  mcp: 'mcp/index.html',
  tjm: 'tjm/index.html',
  actualites: 'actualites/index.html',
} as const

/**
 * Date du dernier commit, en ISO.
 *
 * C'est la bonne granularité ici, et non un pis-aller : l'en-tête, le pied et
 * le moteur de calcul sont partagés, donc un commit sur ce dépôt peut modifier
 * n'importe laquelle des pages. Sans dépôt git — archive, build hors contexte —
 * on n'écrit pas de date plutôt que d'en inventer une, car « maintenant » se
 * renouvellerait à chaque reconstruction sans que rien n'ait changé.
 */
function dernierCommit(): string | null {
  try {
    return execFileSync('git', ['log', '-1', '--format=%cI'], {
      cwd: import.meta.dirname,
      encoding: 'utf8',
    }).trim()
  } catch {
    return null
  }
}

/** Écrit sitemap.xml et robots.txt à partir de PAGES, pendant le build. */
function planDuSite(): Plugin {
  return {
    name: 'plan-du-site',
    apply: 'build',
    generateBundle() {
      const modifie = dernierCommit()
      const url = (page: string) => {
        // "acomptes/index.html" est servi comme "/acomptes/", "index.html" comme "/".
        const chemin = page === 'index.html' ? '/' : `/${page.replace(/index\.html$/, '')}`
        return [
          '  <url>',
          `    <loc>${ORIGINE}${chemin}</loc>`,
          ...(modifie ? [`    <lastmod>${modifie}</lastmod>`] : []),
          '  </url>',
        ].join('\n')
      }
      this.emitFile({
        type: 'asset',
        fileName: 'sitemap.xml',
        source: [
          '<?xml version="1.0" encoding="UTF-8"?>',
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
          ...Object.values(PAGES).map(url),
          '</urlset>',
          '',
        ].join('\n'),
      })
      this.emitFile({
        type: 'asset',
        fileName: 'robots.txt',
        // Sans cette ligne, le plan n'est trouvé que s'il est déclaré à la main
        // dans les outils pour webmasters.
        source: `User-agent: *\nAllow: /\nSitemap: ${ORIGINE}/sitemap.xml\n`,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), planDuSite()],
  // GitHub Pages sert un site de projet sous /<dépôt>/ : le workflow de
  // déploiement renseigne BASE_PATH. En local et sur un domaine dédié, la
  // racine suffit.
  base: process.env.BASE_PATH ?? '/',
  build: {
    rollupOptions: {
      // Un point d'entrée HTML par outil. L'hébergement étant statique, chaque
      // outil est une vraie page : /acomptes/ est servi depuis son propre
      // index.html, sans redirection ni routeur côté client.
      input: Object.fromEntries(
        Object.entries(PAGES).map(([cle, page]) => [
          cle,
          resolve(import.meta.dirname, page),
        ]),
      ),
    },
  },
  server: {
    // Respecte le port imposé par l'environnement (aperçu, conteneur, CI).
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
