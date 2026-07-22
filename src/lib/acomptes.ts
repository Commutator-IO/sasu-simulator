import * as P from './parametres2026';
import { calculerIS } from './simulation';

/**
 * Corporate tax instalments ("acomptes d'impôt sur les sociétés").
 *
 * Four quarterly instalments, not monthly ones. For a company closing its
 * books on 31 December they fall on 15 March, 15 June, 15 September and
 * 15 December, and the balance is due on 15 May of the following year.
 *
 * Rules implemented, with their sources:
 *  - each instalment is a quarter of the tax on the reference profit, i.e. the
 *    previous financial year (CGI art. 1668, 1)
 *  - the first instalment falls due before the previous year's accounts are
 *    known, so it is computed on the year before that and regularised at the
 *    second instalment (BOI-IS-DECLA-20-10 §120)
 *  - no instalment at all when the tax on the reference profit is €3,000 or
 *    less (annexe III art. 359, automatic)
 *  - a newly created company owes no instalment during its first financial
 *    year (CGI art. 1668, 1)
 *  - a company may reduce or stop its instalments once those already paid
 *    cover the tax it expects to owe, under its own responsibility
 *    (CGI art. 1668, 4 bis)
 */

/** Tax on reference profits at or below which no instalment is due. */
export const SEUIL_DISPENSE = 3_000;

/** Late-payment surcharge on an insufficient instalment (CGI art. 1731). */
export const MAJORATION_RETARD = 0.05;
/** Monthly late-payment interest (CGI art. 1727, III). */
export const INTERET_RETARD_MENSUEL = 0.002;

export type Echeance = {
  /** 1 to 4. */
  rang: number;
  /** Due date for a 31 December year-end. */
  date: string;
  /** Amount due under the standard rules, before any adjustment. */
  parDefaut: number;
  /** Amount actually paid once the company adjusts its instalments. */
  ajuste: number;
};

export type HypothesesAcomptes = {
  /**
   * Taxable profit of the year before last. Only drives the first instalment,
   * which falls due before the previous year's accounts are approved.
   */
  beneficeAvantDernier: number;
  /** Taxable profit of the previous year: the reference for the instalments. */
  beneficePrecedent: number;
  /** Expected taxable profit of the current year: what will really be owed. */
  beneficePrevisionnel: number;
  eligibleISReduit: boolean;
  /** First financial year of a newly created company: no instalment due. */
  premierExercice: boolean;
  /** Whether the company adjusts its instalments down to what it expects to owe. */
  moduler: boolean;
};

export type ResultatAcomptes = {
  isAvantDernier: number;
  /** Tax on the reference profit, which sets the instalments. */
  isReference: number;
  /** Tax expected on the current year. */
  isPrevisionnel: number;
  /** True when no instalment is due at all. */
  dispense: boolean;
  motifDispense: 'premier exercice' | 'seuil de 3 000 €' | null;
  echeances: Echeance[];
  totalParDefaut: number;
  totalAjuste: number;
  /** Cash freed over the year by adjusting the instalments. */
  gainTresorerie: number;
  /** Balance due on 15 May of the following year; negative means a refund. */
  solde: number;
  /**
   * True when the adjustment leaves less paid than actually owed, exposing the
   * company to the surcharge and interest.
   */
  risqueMajoration: boolean;
};

const DATES = ['15 mars', '15 juin', '15 septembre', '15 décembre'];

/** Tax on a given profit, reusing the engine of the salary simulator. */
export function isSur(benefice: number, eligibleTauxReduit: boolean): number {
  return calculerIS(Math.max(0, benefice), eligibleTauxReduit);
}

export function calculerAcomptes(h: HypothesesAcomptes): ResultatAcomptes {
  const isAvantDernier = isSur(h.beneficeAvantDernier, h.eligibleISReduit);
  const isReference = isSur(h.beneficePrecedent, h.eligibleISReduit);
  const isPrevisionnel = isSur(h.beneficePrevisionnel, h.eligibleISReduit);

  const motifDispense = h.premierExercice
    ? ('premier exercice' as const)
    : isReference <= SEUIL_DISPENSE
      ? ('seuil de 3 000 €' as const)
      : null;

  if (motifDispense !== null) {
    return {
      isAvantDernier,
      isReference,
      isPrevisionnel,
      dispense: true,
      motifDispense,
      echeances: DATES.map((date, i) => ({
        rang: i + 1,
        date,
        parDefaut: 0,
        ajuste: 0,
      })),
      totalParDefaut: 0,
      totalAjuste: 0,
      gainTresorerie: 0,
      solde: isPrevisionnel,
      risqueMajoration: false,
    };
  }

  // The first instalment rests on the year before last; the second one squares
  // the account so that half the reference tax has been paid after two.
  const premier = isAvantDernier / 4;
  const deuxieme = isReference / 2 - premier;

  // A shrinking reference can make the second instalment negative. The excess
  // is not refunded straight away: it is carried onto the following ones.
  const bruts = [premier, deuxieme, isReference / 4, isReference / 4];
  const parDefaut: number[] = [];
  let report = 0;
  for (const montant of bruts) {
    const avecReport = montant + report;
    const du = Math.max(0, avecReport);
    report = Math.min(0, avecReport);
    parDefaut.push(du);
  }

  // Adjustment: never pay more, in total, than the tax expected for the year.
  let cumule = 0;
  const echeances: Echeance[] = parDefaut.map((montant, i) => {
    const ajuste = h.moduler
      ? Math.min(montant, Math.max(0, isPrevisionnel - cumule))
      : montant;
    cumule += ajuste;
    return { rang: i + 1, date: DATES[i], parDefaut: montant, ajuste };
  });

  const totalParDefaut = parDefaut.reduce((s, v) => s + v, 0);
  const totalAjuste = echeances.reduce((s, e) => s + e.ajuste, 0);

  return {
    isAvantDernier,
    isReference,
    isPrevisionnel,
    dispense: false,
    motifDispense: null,
    echeances,
    totalParDefaut,
    totalAjuste,
    gainTresorerie: totalParDefaut - totalAjuste,
    solde: isPrevisionnel - totalAjuste,
    // Adjusting is only safe while the forecast holds. Paying less than the
    // tax finally due turns the shortfall into a late payment.
    risqueMajoration: h.moduler && totalAjuste < totalParDefaut,
  };
}

/**
 * Cost of an adjustment that turns out too optimistic: the 5% surcharge plus
 * late-payment interest on the shortfall.
 *
 * `moisDeRetard` counts from each instalment's due date to the balance date;
 * a flat average is used rather than a per-instalment computation, so this is
 * an order of magnitude, not an assessment.
 */
export function coutSousEstimation(manque: number, moisDeRetard = 9): number {
  if (manque <= 0) return 0;
  return manque * (MAJORATION_RETARD + INTERET_RETARD_MENSUEL * moisDeRetard);
}

/** Default assumptions, aligned with the salary simulator. */
export const DEFAUTS_ACOMPTES: HypothesesAcomptes = {
  beneficeAvantDernier: P.RESULTAT_PAR_DEFAUT,
  beneficePrecedent: P.RESULTAT_PAR_DEFAUT,
  beneficePrevisionnel: Math.round(P.RESULTAT_PAR_DEFAUT / 2),
  eligibleISReduit: true,
  premierExercice: false,
  moduler: true,
};
