import { DEPOT } from '../lib/depot';
import { LienSignaler } from './LienSignaler';
import * as P from '../lib/parametres2026';

/**
 * Header and footer shared by every tool.
 *
 * The site is statically hosted, so each tool is a real page rather than a
 * client-side route: GitHub Pages serves /acomptes/ from its own index.html
 * without any redirect trick, and links survive being shared.
 */

const OUTILS: { chemin: string; libelle: string; aVenir?: boolean }[] = [
  { chemin: '/projection/', libelle: 'Projection' },
  { chemin: '/', libelle: 'Salaire ou dividendes' },
  { chemin: '/acomptes/', libelle: "Acomptes d'IS" },
  { chemin: '/synthese/', libelle: 'Synthèse' },
  // Sits after the synthesis: it informs the day rate rather than continuing
  // the turnover-to-dividends sequence.
  { chemin: '/tjm/', libelle: 'TJM du marché' },
  { chemin: '/actualites/', libelle: 'Actualités' },
  { chemin: '/mcp/', libelle: 'Serveur MCP', aVenir: true },
];

/**
 * The synthesis reads every tool's parameters from one URL, so opening it from
 * a tool carries the work in progress: the current query string is forwarded.
 * The plain tool links stay bare — switching tools should not drag along
 * another tool's parameters.
 */
function href(chemin: string, courant: string, liens?: Record<string, string>): string {
  // A page can hand a tab its own destination — the projection sends the other
  // tools its computed result, so the top tabs carry the funnel just like its
  // buttons do.
  if (liens && liens[chemin]) return liens[chemin];
  if (chemin !== '/synthese/' || estActif(chemin, courant)) return chemin;
  const recherche = typeof window === 'undefined' ? '' : window.location.search;
  return `${chemin}${recherche}`;
}

function estActif(chemin: string, courant: string): boolean {
  // The current path may or may not carry a trailing slash depending on how
  // the visitor arrived.
  const normalise = (c: string) => (c.endsWith('/') ? c : `${c}/`);
  return normalise(courant) === normalise(chemin);
}

export function Entete({
  chemin,
  liens,
}: {
  chemin: string;
  /** Optional per-tab href overrides, keyed by tool path. */
  liens?: Record<string, string>;
}) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      {/* One line at any width: nothing wraps, and the tools scroll sideways
          rather than pushing the bar onto a second row. */}
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 px-5 py-3">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">
            SASU <span className="text-brand-600">simulator</span>
          </span>
        </a>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {OUTILS.map((o) => {
            const actif = estActif(o.chemin, chemin);
            return (
              <a
                key={o.chemin}
                href={href(o.chemin, chemin, liens)}
                aria-current={actif ? 'page' : undefined}
                className={[
                  'shrink-0 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-medium transition',
                  actif
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
                ].join(' ')}
              >
                {o.libelle}
                {/* The badge is the first thing dropped when room runs out. */}
                {o.aVenir && (
                  <span className="ml-1.5 hidden rounded-full bg-gold-100 px-1.5 py-0.5 align-middle text-[10px] font-medium text-gold-700 xl:inline-block">
                    bientôt
                  </span>
                )}
              </a>
            );
          })}
        </nav>

        <a
          href="#sources"
          className="shrink-0 whitespace-nowrap text-sm text-ink-500 transition hover:text-ink-900"
        >
          Méthode
        </a>
      </div>
    </header>
  );
}

export function Pied() {
  return (
    <footer className="border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-400">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-3">
          <p>Boîte à outils fiscale pour les SASU — barèmes {P.ANNEE}.</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <LienSignaler className="transition hover:text-ink-900">
              Signaler une erreur
            </LienSignaler>
            <a
              href={DEPOT}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-ink-900"
            >
              Code source
            </a>
          </p>
        </div>
        <p className="mt-4 max-w-3xl leading-relaxed">
          Outil informatif. Les montants affichés sont des estimations : ils ne tiennent
          pas compte de votre situation complète, des crédits et réductions d'impôt, ni
          des spécificités de votre contrat de prévoyance.
        </p>
      </div>
    </footer>
  );
}
