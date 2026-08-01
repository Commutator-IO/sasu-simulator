/**
 * Best-effort persistence of a tool's state in the browser.
 *
 * Precedence on load:
 *   1. a URL that carries this tool's keys — a shared or deep link must
 *      reproduce its scenario exactly, so it always wins;
 *   2. otherwise the last state saved in localStorage;
 *   3. otherwise the defaults.
 *
 * State is stored as the same query string the tool already produces, so the
 * existing encoders and decoders — validated and clamped — do all the work,
 * and nothing new needs its own schema.
 */

export const CLE_PROJECTION = 'sasu:projection';
export const CLE_ARBITRAGE = 'sasu:arbitrage';
export const CLE_ACOMPTES = 'sasu:acomptes';
export const CLE_POSITIONNEMENT = 'sasu:positionnement';
export const CLE_CALENDRIER = 'sasu:calendrier';

/**
 * The query string a tool last saved, or empty. Decode it against the defaults
 * to get the "saved state", then decode the current URL *against that saved
 * state* — so a link that only carries some keys (a funnel hand-off like
 * `?resultat=…`) overrides just those and keeps every other saved value,
 * instead of resetting them to defaults.
 */
export function litStockage(cleStockage: string): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(cleStockage) ?? '';
  } catch {
    // Storage may be unavailable (private mode, disabled): fall back to defaults.
    return '';
  }
}

/** Saves the current encoding, or clears the slot when the state is back to default. */
export function sauvegarderRecherche(cleStockage: string, requete: string): void {
  try {
    if (requete) localStorage.setItem(cleStockage, requete);
    else localStorage.removeItem(cleStockage);
  } catch {
    // Persistence is best-effort; ignore storage failures.
  }
}
