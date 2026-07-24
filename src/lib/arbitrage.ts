import * as P from './parametres2026';
import type { Hypotheses } from './simulation';
import type { EtatPartage } from './url';

/**
 * Default assumptions for the salary / dividend arbitration.
 *
 * Extracted from the page so the synthesis can reuse the exact same defaults:
 * a single source of truth avoids the two drifting apart.
 */
export const DEFAUTS_ARBITRAGE: Omit<Hypotheses, 'brutAnnuel'> = {
  resultatAvantRemuneration: P.RESULTAT_PAR_DEFAUT,
  tauxDistribution: 1,
  parts: 1,
  couple: false,
  autresRevenus: 0,
  salaireExterneBrut: 0,
  reservesDistribuables: 0,
  moisRemuneration: 12,
  tauxATMP: P.AT_MP_DEFAUT,
  eligibleISReduit: true,
  dividendesAuBareme: false,
};

/** Default gross salary the slider starts from. */
export const BRUT_ARBITRAGE_PAR_DEFAUT = 45_000;

export const ETAT_ARBITRAGE_PAR_DEFAUT: EtatPartage = {
  base: DEFAUTS_ARBITRAGE,
  brut: BRUT_ARBITRAGE_PAR_DEFAUT,
};
