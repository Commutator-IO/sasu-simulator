import { useEffect, useRef, useState } from 'react';
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
  // Below md the tabs are a menu rather than a scrolling row: eight names in a
  // 375-pixel bar means guessing what is off-screen, and a visitor should not
  // have to swipe a navigation bar to find out where they can go.
  const [ouvert, setOuvert] = useState(false);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const fermer = (e: Event) => {
      if (e instanceof KeyboardEvent && e.key !== 'Escape') return;
      if (e.type === 'pointerdown' && menu.current?.contains(e.target as Node)) return;
      setOuvert(false);
    };
    document.addEventListener('pointerdown', fermer);
    document.addEventListener('keydown', fermer);
    return () => {
      document.removeEventListener('pointerdown', fermer);
      document.removeEventListener('keydown', fermer);
    };
  }, [ouvert]);

  const actuel = OUTILS.find((o) => estActif(o.chemin, chemin));

  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      {/* From md up, one line at any width: nothing wraps, and the tools scroll
          sideways rather than pushing the bar onto a second row. */}
      <div className="mx-auto flex max-w-6xl items-center gap-x-4 px-5 py-3">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">
            SASU <span className="text-brand-600">simulator</span>
          </span>
        </a>

        <nav className="hidden min-w-0 flex-1 items-center gap-0.5 overflow-x-auto md:flex [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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
          className="hidden shrink-0 whitespace-nowrap text-sm text-ink-500 transition hover:text-ink-900 md:block"
        >
          Méthode
        </a>

        <div ref={menu} className="relative ml-auto md:hidden">
          <button
            type="button"
            aria-expanded={ouvert}
            aria-haspopup="menu"
            onClick={() => setOuvert((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-700 hover:bg-ink-100"
          >
            {/* Naming the current page, so the button says where you are as
                well as offering to leave. */}
            <span className="max-w-[9rem] truncate">{actuel?.libelle ?? 'Menu'}</span>
            <span aria-hidden="true" className="text-ink-400">
              {ouvert ? '▴' : '▾'}
            </span>
          </button>

          {ouvert && (
            <div
              role="menu"
              className="absolute top-full right-0 mt-2 w-60 rounded-xl border border-ink-200 bg-white p-1 shadow-lg"
            >
              {OUTILS.map((o) => {
                const actif = estActif(o.chemin, chemin);
                return (
                  <a
                    key={o.chemin}
                    role="menuitem"
                    href={href(o.chemin, chemin, liens)}
                    aria-current={actif ? 'page' : undefined}
                    className={[
                      'flex items-baseline justify-between gap-2 rounded-lg px-3 py-2 text-sm font-medium',
                      actif ? 'bg-brand-50 text-brand-700' : 'text-ink-600',
                    ].join(' ')}
                  >
                    {o.libelle}
                    {o.aVenir && (
                      <span className="rounded-full bg-gold-100 px-1.5 py-0.5 text-[10px] font-medium text-gold-700">
                        bientôt
                      </span>
                    )}
                  </a>
                );
              })}
              <a
                role="menuitem"
                href="#sources"
                onClick={() => setOuvert(false)}
                className="mt-1 block border-t border-ink-100 px-3 py-2 pt-3 text-sm text-ink-500"
              >
                Méthode et sources
              </a>
            </div>
          )}
        </div>
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
