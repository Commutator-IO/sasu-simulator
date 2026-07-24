import * as P from './parametres2026';

/**
 * Year-end projection of turnover and result.
 *
 * The freelancer fills in what they have invoiced month by month. The months
 * not yet invoiced are extrapolated from the average of those already billed,
 * and stay editable — a known future invoice can override the average.
 *
 * From turnover to result:
 *   result before remuneration = turnover − fixed costs − variable costs
 *
 * That "result before remuneration" is exactly the input of the salary /
 * dividend arbitration, and a starting point for the instalment forecast. The
 * projection stops there on purpose: corporate tax and the president's pay
 * depend on the arbitration decision, which is another tool's job. Everything
 * here is net of VAT (hors taxes).
 */

export const NB_MOIS = 12;

/** Sentence-case month names, for labels. */
export const MOIS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
] as const;

/** Short month names, for the chart axis. */
export const MOIS_COURT = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
] as const;

export type HypothesesProjection = {
  /** Invoiced amount for each of the twelve months (turnover, net of VAT). */
  facturation: number[];
  /**
   * How many months are already invoiced, 0 to 12. The following months are
   * projected, and marked as such.
   */
  moisFactures: number;
  /** Fixed recurring monthly costs: accountant, software, insurance… */
  fraisMensuels: number;
  /**
   * Variable cost rate applied to turnover: subcontracting, platform fees.
   * Between 0 and 1.
   */
  tauxFraisVariables: number;
  /**
   * Reduced corporate-tax eligibility. Unused by the projection itself; kept
   * so the bridge links to the other tools carry it.
   */
  eligibleISReduit: boolean;
};

export type MoisProjete = {
  nom: string;
  court: string;
  montant: number;
  /** True for a month not yet invoiced, whose amount is a projection. */
  projete: boolean;
};

export type ResultatProjection = {
  mois: MoisProjete[];
  /** Turnover of the months already invoiced. */
  caFacture: number;
  /** Turnover of the projected months. */
  caProjete: number;
  caTotal: number;
  /** Average of the months already invoiced: the extrapolation basis. */
  moyenneMensuelle: number;
  fraisFixesAnnuels: number;
  fraisVariablesAnnuels: number;
  chargesTotales: number;
  /** Turnover minus all costs, before the president is paid. May be negative. */
  resultatAvantRemuneration: number;
  /** True when costs exceed turnover. */
  deficit: boolean;
};

const borner = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

const positif = (v: number) => Math.max(0, Number.isFinite(v) ? v : 0);

/** Number of invoiced months, clamped to a whole number in [0, 12]. */
function nbFactures(moisFactures: number): number {
  return Math.round(borner(moisFactures, 0, NB_MOIS));
}

/** Average monthly turnover over the invoiced months; zero if none. */
export function moyenneFacturee(facturation: number[], moisFactures: number): number {
  const n = nbFactures(moisFactures);
  if (n === 0) return 0;
  let somme = 0;
  for (let i = 0; i < n; i++) somme += positif(facturation[i] ?? 0);
  return somme / n;
}

/**
 * Fills the not-yet-invoiced months with the average of the invoiced ones,
 * leaving the invoiced months untouched. Used when the user declares how far
 * into the year they are.
 */
export function reprojeter(facturation: number[], moisFactures: number): number[] {
  const n = nbFactures(moisFactures);
  const moyenne = moyenneFacturee(facturation, n);
  return Array.from({ length: NB_MOIS }, (_, i) =>
    i < n ? positif(facturation[i] ?? 0) : moyenne,
  );
}

export function calculerProjection(h: HypothesesProjection): ResultatProjection {
  const n = nbFactures(h.moisFactures);
  const montants = Array.from({ length: NB_MOIS }, (_, i) =>
    positif(h.facturation[i] ?? 0),
  );

  const mois: MoisProjete[] = montants.map((montant, i) => ({
    nom: MOIS[i],
    court: MOIS_COURT[i],
    montant,
    projete: i >= n,
  }));

  const caFacture = montants.slice(0, n).reduce((s, v) => s + v, 0);
  const caProjete = montants.slice(n).reduce((s, v) => s + v, 0);
  const caTotal = caFacture + caProjete;

  const fraisFixesAnnuels = positif(h.fraisMensuels) * NB_MOIS;
  const fraisVariablesAnnuels = caTotal * borner(h.tauxFraisVariables, 0, 1);
  const chargesTotales = fraisFixesAnnuels + fraisVariablesAnnuels;
  const resultatAvantRemuneration = caTotal - chargesTotales;

  return {
    mois,
    caFacture,
    caProjete,
    caTotal,
    moyenneMensuelle: moyenneFacturee(montants, n),
    fraisFixesAnnuels,
    fraisVariablesAnnuels,
    chargesTotales,
    resultatAvantRemuneration,
    deficit: resultatAvantRemuneration < 0,
  };
}

/** Default assumptions, aligned with the other tools' reference figures. */
export const DEFAUTS_PROJECTION: HypothesesProjection = {
  facturation: Array(NB_MOIS).fill(P.CA_MENSUEL_PAR_DEFAUT),
  moisFactures: 6,
  fraisMensuels: P.FRAIS_MENSUELS_PAR_DEFAUT,
  tauxFraisVariables: 0,
  eligibleISReduit: true,
};
