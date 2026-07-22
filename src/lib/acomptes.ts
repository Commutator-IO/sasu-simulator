import * as P from './parametres2026';
import { calculerIS } from './simulation';

/**
 * Corporate tax instalments ("acomptes d'impôt sur les sociétés").
 *
 * Four quarterly instalments. For a company closing its books on 31 December
 * they fall on 15 March, 15 June, 15 September and 15 December, and the
 * balance is due on 15 May of the following year.
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

export type Strategie = 'appele' | 'conserver' | 'lisser' | 'manuel';

export type Echeance = {
  /** 1 to 4. */
  rang: number;
  /** Due date for a 31 December year-end. */
  date: string;
  /**
   * The instalment properly due: a quarter of the tax on the reference year,
   * identical for all four (BOI-IS-DECLA-20-10-10 § 110).
   */
  acompteDu: number;
  /**
   * The quarter called at this date: a quarter of the reference tax, except in
   * March where the year before last serves as a provisional base.
   */
  quart: number;
  /**
   * Adjustment carried by this date. Only the June instalment bears one: it
   * settles the provisional March call, "majoré ou réduit à due concurrence"
   * (BOI-IS-DECLA-20-10-10 § 120). It can bring that instalment to zero but
   * never below, and never touches the later ones.
   */
  regularisation: number;
  /** What is actually asked for: the quarter plus any adjustment, never below zero. */
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
  /** Length in months of that exercise; 12 unless the company was created
   * mid-year or changed its closing date. */
  moisAvantDernier: number;
  /** Taxable profit of the previous year: the reference for the instalments. */
  beneficePrecedent: number;
  /** Length in months of the reference exercise. */
  moisPrecedent: number;
  /** Expected taxable profit of the current year: what will really be owed. */
  beneficePrevisionnel: number;
  eligibleISReduit: boolean;
  /** First financial year of a newly created company: no instalment due. */
  premierExercice: boolean;
  /**
   * How the remaining instalments are sized.
   *  - `appele`    : pay exactly what is called for
   *  - `conserver` : never pay more than called, and stop once the expected
   *                  tax is covered — keeps cash as long as the law allows
   *  - `lisser`    : spread what is still owed over the remaining dates *and*
   *                  the May balance, so no single date spikes across the two
   *                  years
   *  - `manuel`    : whatever `versementManuel` says, per remaining date
   */
  strategie: Strategie;
  /** Amount paid at each remaining date under the `manuel` strategy. */
  versementManuel: number;
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
  /**
   * Tax on the reference profit brought back to twelve months: the figure
   * that sets the instalments (CGI annexe III, art. 360).
   */
  isReference: number;
  /** Tax actually owed on the reference exercise, at its real length. */
  isReferenceReel: number;
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
   * Cash kept from now on, compared with paying what is called. Zero when the
   * strategy pays ahead instead — see `tresorerieAvancee`.
   */
  gainTresorerie: number;
  /** Cash paid ahead of the call, which the previous field would show negative. */
  tresorerieAvancee: number;
  /** Per-date amount that keeps cash longest without ever exceeding the call. */
  versementConserver: number;
  /** Per-date amount that levels the remaining dates with the May balance. */
  versementLisser: number;
  /** Highest per-date amount worth paying: beyond it the balance turns into a refund. */
  versementPlafond: number;
  /** Largest single outflow between now and 15 June of next year. */
  picTresorerie: number;
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

/**
 * Reference profit brought back to a twelve-month period
 * (CGI annexe III, art. 360).
 *
 * An exercise that ran fifteen months carries fifteen months of profit; using
 * it as it stands would inflate every instalment by a quarter. The rule bites
 * whenever a company was created mid-year or moved its closing date — exactly
 * when the instalments matter most.
 */
export function ramenerADouzeMois(benefice: number, mois: number): number {
  const duree = Number.isFinite(mois) && mois > 0 ? Math.min(mois, 24) : 12;
  return (benefice * 12) / duree;
}

/**
 * Tax on an exercise whose reduced-rate band is prorated to its length: the
 * €42,500 ceiling covers twelve months, no more (CGI art. 219, I-b).
 */
export function isExercice(
  benefice: number,
  mois: number,
  eligibleTauxReduit: boolean,
): number {
  const b = Math.max(0, benefice);
  if (!eligibleTauxReduit) return b * P.IS_TAUX_NORMAL;
  const duree = Number.isFinite(mois) && mois > 0 ? Math.min(mois, 24) : 12;
  const plafond = (P.IS_SEUIL_TAUX_REDUIT * duree) / 12;
  return (
    Math.min(b, plafond) * P.IS_TAUX_REDUIT +
    Math.max(0, b - plafond) * P.IS_TAUX_NORMAL
  );
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
  moisAvantDernier?: number;
  beneficePrecedent: number;
  moisPrecedent?: number;
  eligibleISReduit: boolean;
  premierExercice: boolean;
}): { quarts: number[]; regularisations: number[]; parDefaut: number[] } {
  const isReference = isSur(
    ramenerADouzeMois(h.beneficePrecedent, h.moisPrecedent ?? 12),
    h.eligibleISReduit,
  );
  if (h.premierExercice || isReference <= SEUIL_DISPENSE) {
    const zeros = () => Array(NB_ECHEANCES).fill(0) as number[];
    return { quarts: zeros(), regularisations: zeros(), parDefaut: zeros() };
  }

  const isAvantDernier = isSur(
    ramenerADouzeMois(h.beneficeAvantDernier, h.moisAvantDernier ?? 12),
    h.eligibleISReduit,
  );

  // Every date carries a quarter. March uses the year before last as its base,
  // the previous year's accounts not being approved yet.
  const quarts = [
    isAvantDernier / NB_ECHEANCES,
    isReference / NB_ECHEANCES,
    isReference / NB_ECHEANCES,
    isReference / NB_ECHEANCES,
  ];
  // June settles March's provisional call.
  const regularisations = [0, isReference / NB_ECHEANCES - isAvantDernier / NB_ECHEANCES, 0, 0];

  // The adjustment lands on the June instalment and nowhere else, "à due
  // concurrence" (BOI-IS-DECLA-20-10-10 § 120). A credit larger than that
  // instalment simply brings it to zero: it does not cancel the September and
  // December calls, which stay due for their quarter. Whatever was overpaid
  // comes back at the balance, or is avoided by adjusting the instalments.
  const parDefaut = quarts.map((quart, i) =>
    Math.max(0, quart + regularisations[i]),
  );
  return { quarts, regularisations, parDefaut };
}

export function calculerAcomptes(h: HypothesesAcomptes): ResultatAcomptes {
  // Instalment bases: profits brought back to twelve months (art. 360).
  const isAvantDernier = isSur(
    ramenerADouzeMois(h.beneficeAvantDernier, h.moisAvantDernier),
    h.eligibleISReduit,
  );
  const isReference = isSur(
    ramenerADouzeMois(h.beneficePrecedent, h.moisPrecedent),
    h.eligibleISReduit,
  );
  // Tax actually owed on the reference exercise, ceiling prorated to its
  // length. It differs from `isReference` as soon as that exercise was not
  // twelve months, and it is what the balance settles.
  const isReferenceReel = isExercice(
    h.beneficePrecedent,
    h.moisPrecedent,
    h.eligibleISReduit,
  );
  const isPrevisionnel = isSur(h.beneficePrevisionnel, h.eligibleISReduit);

  const motifDispense = h.premierExercice
    ? ('premier exercice' as const)
    : isReference <= SEUIL_DISPENSE
      ? ('seuil de 3 000 €' as const)
      : null;

  const { quarts, regularisations, parDefaut } = echeancierParDefaut(h);
  const passees = Math.round(borner(h.echeancesPassees, 0, NB_ECHEANCES));

  // Past due dates are declarations, and cannot be changed after the fact.
  const dejaVerseParEcheance = parDefaut.map((montant, i) =>
    i < passees ? borner(h.versements[i] ?? montant, 0, Number.MAX_SAFE_INTEGER) : 0,
  );
  const dejaVerse = dejaVerseParEcheance.reduce((s, v) => s + v, 0);

  const restantes = NB_ECHEANCES - passees;
  const besoin = Math.max(0, isPrevisionnel - dejaVerse);
  const appeleRestant = parDefaut
    .filter((_, i) => i >= passees)
    .reduce((s, v) => s + v, 0);

  // Paying more than the balance requires would only earn a refund, so this is
  // the highest per-date amount worth considering.
  const versementPlafond = restantes > 0 ? besoin / restantes : 0;
  // Keeping cash: never above the call, and nothing once the tax is covered.
  const versementConserver =
    restantes > 0 ? Math.min(appeleRestant / restantes, versementPlafond) : 0;
  // Levelling: the May balance counts as one more date, so the remaining
  // instalments and the balance all come out equal.
  const versementLisser = restantes > 0 ? besoin / (restantes + 1) : 0;

  const acompteDu = motifDispense !== null ? 0 : isReference / NB_ECHEANCES;

  // Every adjusted strategy spreads a flat amount over the remaining dates.
  // Paying the full call and then stopping would settle the same total, but
  // earlier — which defeats the point of keeping cash. A flat amount is also
  // what the slider can faithfully represent.
  const echeances: Echeance[] = parDefaut.map((montant, i) => {
    const passee = i < passees;
    let aVenir: number;
    if (motifDispense !== null) {
      aVenir = 0;
    } else if (h.strategie === 'appele') {
      aVenir = montant;
    } else if (h.strategie === 'conserver') {
      aVenir = versementConserver;
    } else if (h.strategie === 'lisser') {
      aVenir = versementLisser;
    } else {
      aVenir = borner(h.versementManuel, 0, Number.MAX_SAFE_INTEGER);
    }
    return {
      rang: i + 1,
      date: DATES[i],
      acompteDu,
      quart: quarts[i],
      regularisation: regularisations[i],
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

  const solde = isPrevisionnel - totalAjuste;
  // Next year the roles shift by one: this year's profit becomes the
  // reference, and the previous year drives the first instalment.
  const { parDefaut: suivantes } = echeancierParDefaut({
    beneficeAvantDernier: h.beneficePrecedent,
    moisAvantDernier: h.moisPrecedent,
    beneficePrecedent: h.beneficePrevisionnel,
    eligibleISReduit: h.eligibleISReduit,
    premierExercice: false,
  });
  const suite = {
    acompte1: suivantes[0],
    acompte2: suivantes[1],
    cumulMaiJuin: Math.max(0, solde) + suivantes[1],
  };

  // Every outflow from now to 15 June next year. Levelling aims at bringing
  // this peak down.
  const picTresorerie = Math.max(
    0,
    ...echeances.filter((e) => !e.passee).map((e) => e.ajuste),
    Math.max(0, solde),
    suite.acompte1,
    suite.acompte2,
  );

  return {
    isAvantDernier,
    isReference,
    isReferenceReel,
    isPrevisionnel,
    dispense: motifDispense !== null,
    motifDispense,
    echeances,
    totalParDefaut,
    totalAjuste,
    dejaVerse,
    resteParDefaut,
    resteAVerser,
    gainTresorerie: Math.max(0, resteParDefaut - resteAVerser),
    tresorerieAvancee: Math.max(0, resteAVerser - resteParDefaut),
    versementConserver,
    versementLisser,
    versementPlafond,
    // Past instalments cannot be taken back: only the balance settles them.
    excedentDejaVerse: Math.max(0, dejaVerse - isPrevisionnel),
    solde,
    matelasSecurite: Math.max(0, totalAjuste - isPrevisionnel),
    suite,
    picTresorerie,
    // Adjusting is only safe while the forecast holds. But a company that has
    // already paid more than it expects to owe cannot fall short: warning it
    // would be crying wolf.
    risqueMajoration:
      h.strategie !== 'appele' &&
      resteAVerser < resteParDefaut &&
      totalAjuste <= isPrevisionnel,
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
  moisAvantDernier: 12,
  beneficePrecedent: P.RESULTAT_PAR_DEFAUT,
  moisPrecedent: 12,
  beneficePrevisionnel: Math.round(P.RESULTAT_PAR_DEFAUT / 2),
  eligibleISReduit: true,
  premierExercice: false,
  strategie: 'conserver',
  versementManuel: 0,
  echeancesPassees: 0,
  versements: [],
};
