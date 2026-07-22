import { NB_ECHEANCES, type HypothesesAcomptes, type Strategie } from './acomptes';
import { arrondi, booleen, MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of an instalment simulation into the URL.
 *
 * Same two principles as the salary simulator: only what differs from the
 * defaults is written, and everything read back is clamped. The validation
 * primitives are shared with `url.ts` so both tools stay consistent.
 */

const CLES = {
  precedent: 'precedent',
  avantDernier: 'avantDernier',
  previsionnel: 'previsionnel',
  isReduit: 'isReduit',
  premierExercice: 'premierExercice',
  strategie: 'strategie',
  versement: 'versement',
  passees: 'passees',
  verses: 'verses',
} as const;

const STRATEGIES: Strategie[] = ['appele', 'conserver', 'lisser', 'manuel'];

function lireStrategie(brut: string | null, defaut: Strategie): Strategie {
  return STRATEGIES.includes(brut as Strategie) ? (brut as Strategie) : defaut;
}

/** Amounts paid travel as a comma-separated list, e.g. "11437,3000". */
function encoderVersements(versements: number[], passees: number): string {
  return versements
    .slice(0, passees)
    .map((v) => String(arrondi(v)))
    .join(',');
}

function decoderVersements(brut: string | null): number[] {
  if (brut === null || brut.trim() === '') return [];
  return brut
    .split(',')
    .slice(0, NB_ECHEANCES)
    .map((v) => nombre(v, 0, 0, MAX_MONTANT));
}

export function encoderAcomptes(
  h: HypothesesAcomptes,
  defauts: HypothesesAcomptes,
): string {
  const params = new URLSearchParams();
  const ajouter = (cle: string, valeur: number | boolean, defaut: number | boolean) => {
    if (valeur === defaut) return;
    params.set(cle, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : String(valeur));
  };

  ajouter(CLES.precedent, arrondi(h.beneficePrecedent), defauts.beneficePrecedent);
  ajouter(
    CLES.avantDernier,
    arrondi(h.beneficeAvantDernier),
    defauts.beneficeAvantDernier,
  );
  ajouter(
    CLES.previsionnel,
    arrondi(h.beneficePrevisionnel),
    defauts.beneficePrevisionnel,
  );
  ajouter(CLES.isReduit, h.eligibleISReduit, defauts.eligibleISReduit);
  ajouter(CLES.premierExercice, h.premierExercice, defauts.premierExercice);
  if (h.strategie !== defauts.strategie) params.set(CLES.strategie, h.strategie);
  // Written whenever it differs, even under another strategy: switching back
  // to the slider should find its position again.
  ajouter(CLES.versement, arrondi(h.versementManuel), defauts.versementManuel);
  ajouter(
    CLES.passees,
    arrondi(h.echeancesPassees),
    defauts.echeancesPassees,
  );
  const verses = encoderVersements(h.versements, h.echeancesPassees);
  if (verses !== encoderVersements(defauts.versements, defauts.echeancesPassees)) {
    params.set(CLES.verses, verses);
  }

  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

export function decoderAcomptes(
  recherche: string,
  defauts: HypothesesAcomptes,
): HypothesesAcomptes {
  const p = new URLSearchParams(recherche);
  return {
    beneficePrecedent: nombre(
      p.get(CLES.precedent),
      defauts.beneficePrecedent,
      0,
      MAX_MONTANT,
    ),
    beneficeAvantDernier: nombre(
      p.get(CLES.avantDernier),
      defauts.beneficeAvantDernier,
      0,
      MAX_MONTANT,
    ),
    beneficePrevisionnel: nombre(
      p.get(CLES.previsionnel),
      defauts.beneficePrevisionnel,
      0,
      MAX_MONTANT,
    ),
    eligibleISReduit: booleen(p.get(CLES.isReduit), defauts.eligibleISReduit),
    premierExercice: booleen(p.get(CLES.premierExercice), defauts.premierExercice),
    strategie: lireStrategie(p.get(CLES.strategie), defauts.strategie),
    versementManuel: nombre(
      p.get(CLES.versement),
      defauts.versementManuel,
      0,
      MAX_MONTANT,
    ),
    echeancesPassees: nombre(p.get(CLES.passees), defauts.echeancesPassees, 0, NB_ECHEANCES),
    versements: decoderVersements(p.get(CLES.verses)),
  };
}

/** Absolute URL to share, keeping the current path. */
export function lienPartageAcomptes(
  h: HypothesesAcomptes,
  defauts: HypothesesAcomptes,
): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${encoderAcomptes(h, defauts)}`;
}
