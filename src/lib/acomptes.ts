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
 *
 * Instalments already paid are inputs, not results: what matters in practice
 * is how much is left to pay, given what has gone out already.
 */

/** Tax on reference profits at or below which no instalment is due. */
export const SEUIL_DISPENSE = 3_000;

/** Late-payment surcharge on an insufficient instalment (CGI art. 1731). */
export const MAJORATION_RETARD = 0.05;
/** Monthly late-payment interest (CGI art. 1727, III). */
export const INTERET_RETARD_MENSUEL = 0.002;

export const NB_ECHEANCES = 4;

export type Echeance = {
  /** 1 to 4. */
  rang: number;
  /** Due date for a 31 December year-end. */
  date: string;
  /** Amount due under the standard rules, before any adjustment. */
  parDefaut: number;
  /** Amount paid, or to be paid: declared for past instalments, computed otherwise. */
  ajuste: number;
  /** Whether the due date has passed and the amount is a declaration. */
  passee: boolean;
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
  /** Whether the remaining instalments are cut down to what is still owed. */
  moduler: boolean;
  /** How many due dates have already passed, 0 to 4. */
  echeancesPassees: number;
  /**
   * What was actually paid at each past due date. Only the first
   * `echeancesPassees` entries are read; the rest is ignored.
   */
  versements: number[];
};

export type ResultatAcomptes = {
  isAvantDernier: number;
  /** Tax on the reference profit, which sets the instalments. */
  isReference: number;
  /** Tax expected on the current year. */
  isPrevisionnel: number;
  dispense: boolean;
  motifDispense: 'premier exercice' | 'seuil de 3 000 €' | null;
  echeances: Echeance[];
  /** Sum of the instalments called for over the year. */
  totalParDefaut: number;
  /** Sum of what is paid over the year, declarations included. */
  totalAjuste: number;
  /** What has already gone out. */
  dejaVerse: number;
  /** What the remaining due dates would call for. */
  resteParDefaut: number;
  /** What is left to pay once the remaining instalments are adjusted. */
  resteAVerser: number;
  /**
   * Cash kept from now on by adjusting the remaining instalments. Negative
   * when the adjustment tops them up instead, to clear the balance.
   */
  gainTresorerie: number;
  /**
   * Amount already overpaid, which no adjustment can recover before the
   * balance: past instalments cannot be taken back.
   */
  excedentDejaVerse: number;
  /** Balance due on 15 May of the following year; negative means a refund. */
  solde: number;
  /**
   * How much the profit could exceed the forecast before any shortfall
   * appears. Past instalments that already overshot the expected tax build up
   * this cushion.
   */
  matelasSecurite: number;
  /**
   * True when adjusting genuinely exposes the company: the remaining
   * instalments are cut *and* nothing has been overpaid to absorb a surprise.
   */
  risqueMajoration: boolean;
  /**
   * What follows the balance, next year. The balance for the current year
   * falls on 15 May, i.e. between the first and second instalments of the
   * following year — and that second instalment is the one regularised on the
   * current year's profit. A profit that jumps therefore lands twice within
   * a month.
   */
  suite: {
    /** 15 March of next year, still resting on the previous year. */
    acompte1: number;
    /** 15 June of next year, regularised on the current year. */
    acompte2: number;
    /** What leaves the account between 15 May and 15 June of next year. */
    cumulMaiJuin: number;
  };
};

const DATES = ['15 mars', '15 juin', '15 septembre', '15 décembre'];

/** Tax on a given profit, reusing the engine of the salary simulator. */
export function isSur(benefice: number, eligibleTauxReduit: boolean): number {
  return calculerIS(Math.max(0, benefice), eligibleTauxReduit);
}

const borner = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, Number.isFinite(v) ? v : min));

/**
 * Instalments called for over the year, before anything is declared or
 * adjusted. Exported so the interface can prefill a past instalment with what
 * was due at that date.
 */
export function echeancierParDefaut(h: {
  beneficeAvantDernier: number;
  beneficePrecedent: number;
  eligibleISReduit: boolean;
  premierExercice: boolean;
}): number[] {
  const isReference = isSur(h.beneficePrecedent, h.eligibleISReduit);
  if (h.premierExercice || isReference <= SEUIL_DISPENSE) {
    return Array(NB_ECHEANCES).fill(0);
  }

  const isAvantDernier = isSur(h.beneficeAvantDernier, h.eligibleISReduit);
  // The first instalment rests on the year before last; the second one squares
  // the account so that half the reference tax has been paid after two.
  const bruts = [
    isAvantDernier / 4,
    isReference / 2 - isAvantDernier / 4,
    isReference / 4,
    isReference / 4,
  ];

  // A shrinking reference can make the second instalment negative. The excess
  // is not refunded straight away: it is carried onto the following ones.
  const parDefaut: number[] = [];
  let report = 0;
  for (const montant of bruts) {
    const avecReport = montant + report;
    parDefaut.push(Math.max(0, avecReport));
    report = Math.min(0, avecReport);
  }
  return parDefaut;
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

  const parDefaut = echeancierParDefaut(h);
  const passees = Math.round(borner(h.echeancesPassees, 0, NB_ECHEANCES));

  // Past due dates are declarations, and cannot be changed after the fact.
  const dejaVerseParEcheance = parDefaut.map((montant, i) =>
    i < passees ? borner(h.versements[i] ?? montant, 0, Number.MAX_SAFE_INTEGER) : 0,
  );
  const dejaVerse = dejaVerseParEcheance.reduce((s, v) => s + v, 0);

  // Remaining due dates are spread so that nothing is left for the balance:
  // what is still owed, split evenly over the dates left. This both cuts them
  // when the profit falls and tops them up when it rises — paying more than
  // called for is always allowed, and it avoids a lump sum in May.
  const restantes = NB_ECHEANCES - passees;
  const besoin = Math.max(0, isPrevisionnel - dejaVerse);
  const parEcheanceRestante = restantes > 0 ? besoin / restantes : 0;

  const echeances: Echeance[] = parDefaut.map((montant, i) => {
    const passee = i < passees;
    const aVenir = motifDispense !== null
      ? 0
      : h.moduler
        ? parEcheanceRestante
        : montant;
    return {
      rang: i + 1,
      date: DATES[i],
      parDefaut: montant,
      ajuste: passee ? dejaVerseParEcheance[i] : aVenir,
      passee,
    };
  });

  const somme = (f: (e: Echeance) => number, filtre: (e: Echeance) => boolean) =>
    echeances.filter(filtre).reduce((s, e) => s + f(e), 0);

  const resteParDefaut = somme((e) => e.parDefaut, (e) => !e.passee);
  const resteAVerser = somme((e) => e.ajuste, (e) => !e.passee);
  const totalParDefaut = parDefaut.reduce((s, v) => s + v, 0);
  const totalAjuste = dejaVerse + resteAVerser;

  return {
    isAvantDernier,
    isReference,
    isPrevisionnel,
    dispense: motifDispense !== null,
    motifDispense,
    echeances,
    totalParDefaut,
    totalAjuste,
    dejaVerse,
    resteParDefaut,
    resteAVerser,
    gainTresorerie: resteParDefaut - resteAVerser,
    // Past instalments cannot be taken back: only the balance settles them.
    excedentDejaVerse: Math.max(0, dejaVerse - isPrevisionnel),
    solde: isPrevisionnel - totalAjuste,
    matelasSecurite: Math.max(0, totalAjuste - isPrevisionnel),
    // Next year the roles shift by one: this year's profit becomes the
    // reference, and the previous year drives the first instalment.
    suite: (() => {
      const suivantes = echeancierParDefaut({
        beneficeAvantDernier: h.beneficePrecedent,
        beneficePrecedent: h.beneficePrevisionnel,
        eligibleISReduit: h.eligibleISReduit,
        premierExercice: false,
      });
      const solde = isPrevisionnel - totalAjuste;
      return {
        acompte1: suivantes[0],
        acompte2: suivantes[1],
        cumulMaiJuin: Math.max(0, solde) + suivantes[1],
      };
    })(),
    // Adjusting is only safe while the forecast holds. But a company that has
    // already paid more than it expects to owe cannot fall short: warning it
    // would be crying wolf.
    risqueMajoration:
      h.moduler && resteAVerser < resteParDefaut && totalAjuste <= isPrevisionnel,
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
  echeancesPassees: 0,
  versements: [],
};
