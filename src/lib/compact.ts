/**
 * Shortens the query string carried in the address bar and in shared links.
 *
 * Two space savings, both reversible and backward-compatible:
 *  - long keys become short aliases (`resultat` → `r`, `fraisMensuels` → `fm`…);
 *  - list separators stay as literal commas instead of `%2C`.
 *
 * `minifier` is applied when a link is written (address bar, share buttons);
 * `etendre` restores full keys when a link is read, and leaves already-long
 * keys untouched — so links made before this existed still open. localStorage
 * keeps the full, readable form; only the URL is minified.
 *
 * Values here are numbers and comma-separated lists of numbers, so they are
 * rebuilt without re-encoding: no value contains `&`, `=` or `#`.
 */

/** Full key → short alias. Aliases must stay unique across every tool, since a
 * synthesis link carries all three tools' keys at once. */
const VERS_COURT: Record<string, string> = {
  // Arbitration
  resultat: 'r',
  brut: 'b',
  mois: 'mo',
  parts: 'pt',
  couple: 'cp',
  salaireExterne: 'se',
  autresRevenus: 'ar',
  reserves: 'rs',
  distribution: 'ds',
  atmp: 'at',
  bareme: 'bm',
  // Shared
  isReduit: 'ir',
  // Instalments
  precedent: 'pc',
  moisPrecedent: 'mp',
  avantDernier: 'ad',
  moisAvantDernier: 'ma',
  previsionnel: 'pv',
  premierExercice: 'pe',
  strategie: 'st',
  versement: 'vm',
  passees: 'ps',
  verses: 'vs',
  // Projection ("ca" is already short and kept as is)
  moisFactures: 'mf',
  fraisMensuels: 'fm',
  tauxVariable: 'tv',
  // TJM positioning
  specialite: 'sp',
  tjm: 'tj',
  niveau: 'nv',
  ville: 'vl',
  commission: 'cm',
};

const VERS_LONG: Record<string, string> = Object.fromEntries(
  Object.entries(VERS_COURT).map(([long, court]) => [court, long]),
);

function transformer(requete: string, table: Record<string, string>): string {
  if (!requete || requete === '?') return '';
  const p = new URLSearchParams(requete);
  const parts: string[] = [];
  // URLSearchParams decodes values; re-encode them (keeping commas literal, for
  // the month-by-month lists) so a "+" or space survives the round trip.
  for (const [cle, valeur] of p) {
    const v = encodeURIComponent(valeur).replace(/%2C/g, ',');
    parts.push(`${table[cle] ?? cle}=${v}`);
  }
  return parts.length ? `?${parts.join('&')}` : '';
}

/** Full keys → short aliases, with literal commas. */
export function minifier(requete: string): string {
  return transformer(requete, VERS_COURT);
}

/** Short aliases → full keys; long keys pass through unchanged. */
export function etendre(requete: string): string {
  return transformer(requete, VERS_LONG);
}

/** The current address-bar query, expanded to full keys (empty outside a browser). */
export function rechercheCourante(): string {
  return typeof window === 'undefined' ? '' : etendre(window.location.search);
}
