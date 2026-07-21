/**
 * French tax and social security parameters applicable in 2026.
 *
 * Sources:
 *  - PASS 2026: €48,060/year, €4,005/month (Urssaf, order of 15/12/2025)
 *  - 2026 standard rates: health 13% and family allowances 5.25% (the reduced
 *    rates were replaced on 01/01/2026 by the RGDU, which company officers are
 *    not eligible for — see `RGDU_APPLICABLE_AU_PRESIDENT` below)
 *  - Agirc-Arrco 2026: T1 7.87%, T2 21.59%, CEG 2.15%/2.70%, CET 0.35%,
 *    split 60% employer / 40% employee
 *  - 2026 income tax brackets (2025 income), Finance Act of 19/02/2026
 *  - Corporate tax: 15% up to €42,500 then 25%
 *  - Flat tax: 12.8% income tax + 18.6% social levies, i.e. 31.4% since the
 *    2026 Social Security Financing Act (law 2025-1403 of 30/12/2025, art. 12)
 *
 * User-facing labels stay in French: this is a French tax tool.
 */

export const ANNEE = 2026;

/** Annual social security ceiling. */
export const PASS = 48_060;
/** Monthly ceiling. */
export const PMSS = 4_005;

/** Gross hourly minimum wage as of 1 January 2026. */
export const SMIC_HORAIRE = 11.88;
/** Gross monthly minimum wage (35 h/week) as of 1 January 2026. */
export const SMIC_MENSUEL = 1_823.03;

// ---------------------------------------------------------------------------
// Social contributions — SASU president (employee-equivalent status)
// ---------------------------------------------------------------------------

/**
 * Contribution bases:
 *  - `totalite`             : the whole gross salary
 *  - `t1`                   : band 1, from 0 to 1 PASS
 *  - `t2`                   : band 2, from 1 to 8 PASS
 *  - `tranche_a_4pass`      : from 0 to 4 PASS (Apec)
 *  - `totalite_si_sup_pass` : the whole gross salary, only when it exceeds
 *                             1 PASS (CET)
 */
export type Assiette =
  | 'totalite'
  | 't1'
  | 't2'
  | 'tranche_a_4pass'
  | 'totalite_si_sup_pass';

export type Cotisation = {
  /** Label shown in the breakdown table. */
  libelle: string;
  /** Grouping used by the summary table. */
  famille: 'Sécurité sociale' | 'Retraite complémentaire' | 'Autres' | 'CSG-CRDS';
  /** Employer rate, as a percentage. */
  patronal: number;
  /** Employee rate, as a percentage. */
  salarial: number;
  assiette: Assiette;
  /** SASU presidents pay no unemployment contribution; kept for the record. */
  exclu?: boolean;
  note?: string;
};

/**
 * A SASU president belongs to the general social security scheme but has **no
 * unemployment insurance** (no employment contract). They are likewise
 * excluded from the RGDU, the single sliding-scale reduction reserved for
 * employees covered by unemployment insurance. Health and family allowance
 * contributions therefore apply at their standard rate whatever the salary.
 */
export const RGDU_APPLICABLE_AU_PRESIDENT = false;

export const COTISATIONS: Cotisation[] = [
  {
    libelle: 'Maladie, maternité, invalidité, décès',
    famille: 'Sécurité sociale',
    patronal: 13.0,
    salarial: 0,
    assiette: 'totalite',
    note: "Taux de droit commun : le président, exclu de la RGDU, ne bénéficie pas du taux réduit de 7 %.",
  },
  {
    libelle: 'Vieillesse plafonnée',
    famille: 'Sécurité sociale',
    patronal: 8.55,
    salarial: 6.9,
    assiette: 't1',
  },
  {
    libelle: 'Vieillesse déplafonnée',
    famille: 'Sécurité sociale',
    patronal: 2.11,
    salarial: 0.4,
    assiette: 'totalite',
  },
  {
    libelle: 'Allocations familiales',
    famille: 'Sécurité sociale',
    patronal: 5.25,
    salarial: 0,
    assiette: 'totalite',
    note: 'Taux de droit commun 2026.',
  },
  {
    libelle: 'Retraite complémentaire Agirc-Arrco T1',
    famille: 'Retraite complémentaire',
    patronal: 4.72,
    salarial: 3.15,
    assiette: 't1',
  },
  {
    libelle: 'Retraite complémentaire Agirc-Arrco T2',
    famille: 'Retraite complémentaire',
    patronal: 12.95,
    salarial: 8.64,
    assiette: 't2',
  },
  {
    libelle: "Contribution d'équilibre général (CEG) T1",
    famille: 'Retraite complémentaire',
    patronal: 1.29,
    salarial: 0.86,
    assiette: 't1',
  },
  {
    libelle: "Contribution d'équilibre général (CEG) T2",
    famille: 'Retraite complémentaire',
    patronal: 1.62,
    salarial: 1.08,
    assiette: 't2',
  },
  {
    libelle: "Contribution d'équilibre technique (CET)",
    famille: 'Retraite complémentaire',
    patronal: 0.21,
    salarial: 0.14,
    assiette: 'totalite_si_sup_pass',
    note: 'Due uniquement si la rémunération dépasse 1 PASS.',
  },
  {
    libelle: 'Apec (cadres)',
    famille: 'Retraite complémentaire',
    patronal: 0.036,
    salarial: 0.024,
    assiette: 'tranche_a_4pass',
  },
  {
    libelle: 'Contribution solidarité autonomie (CSA)',
    famille: 'Autres',
    patronal: 0.3,
    salarial: 0,
    assiette: 'totalite',
  },
  {
    libelle: 'Fnal (entreprise de moins de 50 salariés)',
    famille: 'Autres',
    patronal: 0.1,
    salarial: 0,
    assiette: 't1',
  },
  {
    libelle: 'Contribution au dialogue social',
    famille: 'Autres',
    patronal: 0.016,
    salarial: 0,
    assiette: 'totalite',
  },
];

/** Default work-accident rate (office / service activity). Configurable. */
export const AT_MP_DEFAUT = 1.3;

// --- CSG / CRDS -------------------------------------------------------------

/** Professional expense allowance on the CSG-CRDS base. */
export const CSG_ABATTEMENT = 0.0175;
/** The 1.75% allowance is capped at 4 PASS. */
export const CSG_ABATTEMENT_PLAFOND = 4 * PASS;
export const CSG_DEDUCTIBLE = 6.8;
export const CSG_NON_DEDUCTIBLE = 2.4;
export const CRDS = 0.5;

// ---------------------------------------------------------------------------
// Corporate income tax
// ---------------------------------------------------------------------------

export const IS_SEUIL_TAUX_REDUIT = 42_500;
export const IS_TAUX_REDUIT = 0.15;
export const IS_TAUX_NORMAL = 0.25;

// ---------------------------------------------------------------------------
// Personal income tax — 2026 brackets (2025 income)
// ---------------------------------------------------------------------------

export const BAREME_IR: { plafond: number; taux: number }[] = [
  { plafond: 11_600, taux: 0 },
  { plafond: 29_579, taux: 0.11 },
  { plafond: 84_577, taux: 0.3 },
  { plafond: 181_917, taux: 0.41 },
  { plafond: Infinity, taux: 0.45 },
];

/** Flat 10% deduction for professional expenses. */
export const ABATTEMENT_SALAIRE = 0.1;
export const ABATTEMENT_SALAIRE_MIN = 508;
export const ABATTEMENT_SALAIRE_MAX = 14_556;

/** Low-income tax rebate: flat amount and rate. */
export const DECOTE_CELIBATAIRE = 897;
export const DECOTE_COUPLE = 1_483;
export const DECOTE_TAUX = 0.4525;

/** Cap on the family quotient benefit, per additional half-share. */
export const PLAFOND_DEMI_PART = 1_807;

// ---------------------------------------------------------------------------
// Pay-as-you-earn withholding
// ---------------------------------------------------------------------------

/**
 * The withholding rate is rounded to the nearest decimal of a percentage
 * point (tax code art. 204 H and BOI-IR-PAS-20-20-10): 6.85% becomes 6.9%.
 */
export const PAS_ARRONDI = 0.001;

/**
 * Reference taxable income below which one may opt out of the 12.8%
 * non-final withholding on dividends (tax code art. 242 quater).
 */
export const DISPENSE_PFNL_CELIBATAIRE = 50_000;
export const DISPENSE_PFNL_COUPLE = 75_000;

// ---------------------------------------------------------------------------
// Dividends
// ---------------------------------------------------------------------------

export const PFU_IR = 0.128;

/**
 * Social levies on investment income: 18.6% since 1 January 2026, up from
 * 17.2%.
 *
 * Article 12 of the 2026 Social Security Financing Act (law 2025-1403 of
 * 30 December 2025) raises the CSG on investment income from 9.2% to 10.6%:
 *
 *   CSG 10.6% + CRDS 0.5% + solidarity levy 7.5% = 18.6%
 *
 * The flat tax therefore moves from 30% to **31.4%**. Note that the increase
 * only concerns investment income: life insurance, regulated savings plans,
 * rental income and property capital gains stay at 17.2%, and the CSG on
 * earned income stays at 9.2% (see `CSG_DEDUCTIBLE` / `CSG_NON_DEDUCTIBLE`).
 */
export const PRELEVEMENTS_SOCIAUX = 0.186;
export const PFU_TOTAL = PFU_IR + PRELEVEMENTS_SOCIAUX;

/** 40% allowance when opting for the progressive income tax scale. */
export const ABATTEMENT_DIVIDENDES = 0.4;

/**
 * Share of the CSG on dividends deductible from total taxable income when
 * opting for the progressive scale. The 1.4 point CSG increase was not
 * matched by a rise in the deductible share, which stays at 6.8 points.
 */
export const CSG_DEDUCTIBLE_DIVIDENDES = 0.068;

// ---------------------------------------------------------------------------
// Market benchmark — Malt day-rate survey
// ---------------------------------------------------------------------------

/**
 * Average daily rate reported by Malt for tech freelancers in 2026.
 * https://www.malt.fr/t/barometre-tarifs/tech/
 */
export const TJM_MOYEN_MALT = 520;

/**
 * Number of days used by the Malt survey: 251 working days minus five weeks
 * of holiday. This assumes full occupancy — in practice a freelancer bills
 * closer to 180-216 days.
 */
export const JOURS_FACTURES_MALT = 226;

/** Running costs, also assumed at 10% by the Malt survey. */
export const TAUX_FRAIS_REFERENCE = 0.1;

/**
 * Simulator default: the revenue of an average Malt day rate over a full
 * year, less costs, rounded to the nearest thousand.
 */
export const RESULTAT_PAR_DEFAUT =
  Math.round(
    (TJM_MOYEN_MALT * JOURS_FACTURES_MALT * (1 - TAUX_FRAIS_REFERENCE)) / 1_000,
  ) * 1_000;

/**
 * Yearly take-home difference below which two salary levels are treated as
 * equivalent.
 *
 * The optimum is a maximum: the curve is flat there, so take-home pay varies
 * quadratically around that point. Moving €2,000 away from the optimum only
 * costs around sixty euros. Advertising a single point would be misleading,
 * so a range is shown instead.
 */
export const TOLERANCE_OPTIMUM = 100;

/** Day rate implied by a given profit, at constant days and costs. */
export function tjmEquivalent(resultatAvantRemuneration: number): number {
  return (
    resultatAvantRemuneration / (JOURS_FACTURES_MALT * (1 - TAUX_FRAIS_REFERENCE))
  );
}

// ---------------------------------------------------------------------------
// Pension
// ---------------------------------------------------------------------------

/** One quarter is earned per 150 × hourly minimum wage of gross salary. */
export const BRUT_PAR_TRIMESTRE = 150 * SMIC_HORAIRE;
/** Agirc-Arrco 2026 reference salary (purchase price of one point). */
export const SALAIRE_REFERENCE_AGIRC_ARRCO = 20.1877;
/** Agirc-Arrco point value in 2026. */
export const VALEUR_POINT_AGIRC_ARRCO = 1.4386;
/** Point-accrual rates (excluding the 127% call rate). */
export const TAUX_POINTS_T1 = 0.062;
export const TAUX_POINTS_T2 = 0.17;
