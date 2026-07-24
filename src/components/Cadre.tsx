import { DEPOT, LIEN_ISSUES } from '../lib/depot';
import * as P from '../lib/parametres2026';

/**
 * Header and footer shared by every tool.
 *
 * The site is statically hosted, so each tool is a real page rather than a
 * client-side route: GitHub Pages serves /acomptes/ from its own index.html
 * without any redirect trick, and links survive being shared.
 */

const OUTILS = [
  { chemin: '/projection/', libelle: 'Projection de CA' },
  { chemin: '/', libelle: 'Salaire ou dividendes' },
  { chemin: '/acomptes/', libelle: "Acomptes d'IS" },
] as const;

function estActif(chemin: string, courant: string): boolean {
  // The current path may or may not carry a trailing slash depending on how
  // the visitor arrived.
  const normalise = (c: string) => (c.endsWith('/') ? c : `${c}/`);
  return normalise(courant) === normalise(chemin);
}

export function Entete({ chemin }: { chemin: string }) {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-8 gap-y-3 px-5 py-4">
        <a href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">
            SASU <span className="text-brand-600">simulator</span>
          </span>
        </a>

        <nav className="flex flex-1 flex-wrap items-center gap-1">
          {OUTILS.map((o) => {
            const actif = estActif(o.chemin, chemin);
            return (
              <a
                key={o.chemin}
                href={o.chemin}
                aria-current={actif ? 'page' : undefined}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition',
                  actif
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-ink-500 hover:bg-ink-100 hover:text-ink-900',
                ].join(' ')}
              >
                {o.libelle}
              </a>
            );
          })}
        </nav>

        <a href="#sources" className="text-sm text-ink-500 transition hover:text-ink-900">
          Méthode et sources
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
            <a
              href={LIEN_ISSUES}
              target="_blank"
              rel="noreferrer"
              className="transition hover:text-ink-900"
            >
              Signaler une erreur
            </a>
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
