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

/**
 * Gross hourly minimum wage as of 1 January 2026 (decree 2025-1228 of
 * 17/12/2025). Pension quarters are earned on the rate in force on
 * 1 January, so this one stays the reference for the whole year even though
 * the rate rose on 1 June.
 */
export const SMIC_HORAIRE = 12.02;
/**
 * Gross monthly minimum wage (35 h/week) in force today: €1,867.02 since
 * 1 June 2026 (order of 22/05/2026), up from €1,823.03. Only used to suggest a
 * salary level.
 */
export const SMIC_MENSUEL = 1_867.02;

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

// --- Benefits paid outside salary and dividends ----------------------------

/**
 * CSG-CRDS withheld from employee savings (profit-sharing, statutory
 * participation, employer top-up on a PEE or PERCO/PERECO) and from
 * holiday vouchers in companies under 50 employees: 9.2% + 0.5% = 9.7%, on
 * the **whole** amount — these sums are outside the 1.75% professional
 * expense allowance (BOSS, Assiette générale, § 270).
 *
 * Under 50 employees the company owes no forfait social on them and no social
 * contributions (service-public.gouv.fr F2140, F2141, F2142). Placed on a
 * savings plan within 15 days, they are also exempt from income tax up to
 * €36,045 in 2026.
 *
 * Eligibility is the catch for a sole president: the company must employ at
 * least one employee besides its officer for them to join the PEE or
 * profit-sharing, and a company whose only employee is its president cannot
 * sign a profit-sharing agreement (F2140, F2142).
 */
export const CSG_CRDS_EPARGNE_SALARIALE =
  (CSG_DEDUCTIBLE + CSG_NON_DEDUCTIBLE + CRDS) / 100;

/**
 * Yearly ceiling of the employer aid for home services (CESU préfinancé) per
 * beneficiary, from 1 January 2026 (order of 23/12/2025). In a company with no
 * employee, the president may grant it to themselves "sans autre condition"
 * (BOI-BIC-CHG-40-50-10 § 20). It is free of contributions, CSG and income
 * tax, but it must be taken off the expenses that open the home-employment tax
 * credit (CGI art. 199 sexdecies).
 */
export const PLAFOND_AIDE_SERVICES_PERSONNE = 2_591;

/**
 * Home-employment tax credit (CGI art. 199 sexdecies, service-public F12): half
 * of the year's home-service spending, net of any aid received for it, within
 * a ceiling of €12,000, raised by €1,500 per dependent child or member over
 * 65 up to €15,000. The first year of direct employment starts at €15,000
 * (up to €18,000); disability raises it to €20,000.
 */
export const CI_SAP_TAUX = 0.5;
export const CI_SAP_PLAFOND = 12_000;
export const CI_SAP_MAJORATION = 1_500;
export const CI_SAP_PLAFOND_MAJORE_MAX = 15_000;
export const CI_SAP_PLAFOND_PREMIERE_ANNEE = 15_000;
export const CI_SAP_PLAFOND_PREMIERE_ANNEE_MAX = 18_000;
export const CI_SAP_PLAFOND_INVALIDITE = 20_000;
/** Overall cap on tax breaks the credit counts towards (CGI art. 200-0 A). */
export const PLAFONNEMENT_GLOBAL_NICHES = 10_000;

// --- Individual retirement savings (PER) -------------------------------------

/**
 * Deduction ceiling for voluntary payments into an individual PER in 2026:
 * 10% of 2025 earned income net of professional expenses, at least €4,710
 * (10% of the 2025 PASS) and at most €37,680 (10% of 8 times it). Unused
 * ceilings of earlier years add to it, which is why the figure to enter is the
 * one printed on the tax notice (service-public.gouv.fr F34982).
 */
export const PER_PLAFOND_MINIMUM = 4_710;
export const PER_PLAFOND_MAXIMUM = 37_680;
/** Share of earned income that opens next year's ceiling. */
export const PER_TAUX_PLAFOND = 0.1;

// ---------------------------------------------------------------------------
// Corporate income tax
// ---------------------------------------------------------------------------

export const IS_SEUIL_TAUX_REDUIT = 42_500;
export const IS_TAUX_REDUIT = 0.15;
export const IS_TAUX_NORMAL = 0.25;

// ---------------------------------------------------------------------------
// Cotisation foncière des entreprises (CFE)
// ---------------------------------------------------------------------------

/**
 * Minimum tax base for the CFE due in 2026, by turnover excluding VAT of year
 * N-2 (CGI art. 1647 D). Each commune votes its own base within the range; the
 * floor is the same in every bracket. A company working from home or from a
 * domiciliation address has next to no rental value, so this minimum base is
 * what it is taxed on (service-public.gouv.fr F23547).
 */
export const CFE_BASE_MINIMUM_PLANCHER = 250;
export const CFE_TRANCHES_BASE_MINIMUM: { plafondCA: number; baseMax: number }[] = [
  { plafondCA: 10_000, baseMax: 597 },
  { plafondCA: 32_600, baseMax: 1_194 },
  { plafondCA: 100_000, baseMax: 2_509 },
  { plafondCA: 250_000, baseMax: 4_183 },
  { plafondCA: 500_000, baseMax: 5_974 },
  { plafondCA: Infinity, baseMax: 7_769 },
];
/** No CFE when the reference turnover does not exceed this. */
export const CFE_SEUIL_EXONERATION_CA = 5_000;
/** The base is halved the year after creation; the creation year is exempt. */
export const CFE_REDUCTION_ANNEE_SUIVANT_CREATION = 0.5;
/** Additional tax for the chambers of commerce, on the base. */
export const CFE_TAXE_ADDITIONNELLE_CCI = 0.0112;
/** Local tax management fee, on the CFE plus the additional tax. */
export const CFE_FRAIS_GESTION = 0.01;

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

/**
 * Thresholds of the exceptional levy on high incomes (tax code art. 223
 * sexies): 3% above these, 4% above twice these.
 *
 * The levy is **not** modelled — it applies to the reference taxable income,
 * which includes flat-taxed dividends at their gross amount, and it comes
 * with a smoothing mechanism for exceptional years. These constants only
 * drive a warning: a large one-off distribution can cross the threshold
 * while the flat tax makes the burden look capped at 12.8%.
 */
export const CEHR_SEUIL_CELIBATAIRE = 250_000;
export const CEHR_SEUIL_COUPLE = 500_000;

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
// Market benchmark — public day-rate survey
// ---------------------------------------------------------------------------

/**
 * Average daily rate for tech freelancers in 2026, from a public day-rate
 * survey.
 */
export const TJM_MOYEN_REFERENCE = 520;

/**
 * Number of days used by the survey: 251 working days minus five weeks
 * of holiday. This assumes full occupancy — in practice a freelancer bills
 * closer to 180-216 days.
 */
export const JOURS_FACTURES_REFERENCE = 226;

/** Running costs, also assumed at 10% by the survey. */
export const TAUX_FRAIS_REFERENCE = 0.1;

/**
 * Simulator default: the revenue of an average survey day rate over a full
 * year, less costs, rounded to the nearest thousand.
 */
export const RESULTAT_PAR_DEFAUT =
  Math.round(
    (TJM_MOYEN_REFERENCE * JOURS_FACTURES_REFERENCE * (1 - TAUX_FRAIS_REFERENCE)) / 1_000,
  ) * 1_000;

/**
 * Projection tool default: the average survey day-rate revenue spread evenly
 * over twelve months. A neutral starting point the user overwrites with their
 * own figures.
 */
export const CA_MENSUEL_PAR_DEFAUT = Math.round(
  (TJM_MOYEN_REFERENCE * JOURS_FACTURES_REFERENCE) / 12,
);

/**
 * Projection tool default fixed costs: the 10% reference cost rate applied to
 * the default monthly revenue, so the default result matches the other tools.
 */
export const FRAIS_MENSUELS_PAR_DEFAUT = Math.round(
  CA_MENSUEL_PAR_DEFAUT * TAUX_FRAIS_REFERENCE,
);

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
    resultatAvantRemuneration / (JOURS_FACTURES_REFERENCE * (1 - TAUX_FRAIS_REFERENCE))
  );
}

// ---------------------------------------------------------------------------
// Pension
// ---------------------------------------------------------------------------

/** One quarter is earned per 150 × hourly minimum wage of gross salary. */
export const BRUT_PAR_TRIMESTRE = 150 * SMIC_HORAIRE;
/** Agirc-Arrco 2026 reference salary (purchase price of one point). */
export const SALAIRE_REFERENCE_AGIRC_ARRCO = 20.1877;
/** Agirc-Arrco point value in 2026: the yearly pension paid per point. */
export const VALEUR_POINT_AGIRC_ARRCO = 1.4386;
/** Point-accrual rates (excluding the 127% call rate). */
export const TAUX_POINTS_T1 = 0.062;
export const TAUX_POINTS_T2 = 0.17;

// ---------------------------------------------------------------------------
// Validity
// ---------------------------------------------------------------------------

/**
 * How long each parameter above can be trusted, and what to re-read once it
 * cannot.
 *
 * A stale rate looks exactly like a right one: the flat tax was once computed
 * at 30% for several iterations after the 2026 Social Security Financing Act
 * had moved it to 31.4%. Every exported parameter belongs to exactly one entry
 * here (a test enforces it), and the test suite fails once an entry is past
 * its date, so CI turns red before the site turns wrong.
 *
 * Extending a date without re-reading the source defeats the purpose: update
 * the value or confirm it, then move the date.
 */
export type Validite = {
  /** Names of the exported constants this entry covers. */
  constantes: string[];
  /**
   * Last day the values hold, as YYYY-MM-DD; null for the simulator's own
   * conventions, which no text can make stale.
   */
  valableJusquau: string | null;
  /** What changes them, and where to check. */
  aVerifier: string;
  source: string;
};

export const VALIDITE_PARAMETRES: Validite[] = [
  {
    constantes: ['ANNEE'],
    valableJusquau: '2026-12-31',
    aVerifier:
      "Passage à l'année suivante : revoir chaque paramètre de ce fichier, puis le renommer.",
    source: 'https://github.com/Commutator-IO/sasu-simulator/blob/main/TODO.md',
  },
  {
    constantes: ['PASS', 'PMSS', 'CSG_ABATTEMENT_PLAFOND'],
    valableJusquau: '2026-12-31',
    aVerifier: "Plafond de la sécurité sociale de l'année suivante, fixé par arrêté en décembre.",
    source: 'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds.html',
  },
  {
    constantes: ['SMIC_HORAIRE', 'SMIC_MENSUEL', 'BRUT_PAR_TRIMESTRE'],
    valableJusquau: '2026-12-31',
    aVerifier:
      'Revalorisation du Smic au 1ᵉʳ janvier, ou en cours d’année si l’inflation la déclenche. Le Smic horaire au 1ᵉʳ janvier sert aux trimestres, le Smic mensuel en vigueur aux suggestions de salaire.',
    source: 'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/montant-smic.html',
  },
  {
    constantes: ['RGDU_APPLICABLE_AU_PRESIDENT', 'COTISATIONS', 'AT_MP_DEFAUT'],
    valableJusquau: '2026-12-31',
    aVerifier:
      'Taux de cotisations Urssaf et Agirc-Arrco au 1ᵉʳ janvier, après la loi de financement de la sécurité sociale.',
    source:
      'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html',
  },
  {
    constantes: [
      'CSG_ABATTEMENT',
      'CSG_DEDUCTIBLE',
      'CSG_NON_DEDUCTIBLE',
      'CRDS',
      'CSG_CRDS_EPARGNE_SALARIALE',
    ],
    valableJusquau: '2026-12-31',
    aVerifier: "Taux et assiette de la CSG-CRDS sur les revenus d'activité, dans la LFSS.",
    source: 'https://boss.gouv.fr/portail/accueil/regles-dassujettissement/assiette-generale.html',
  },
  {
    constantes: [
      'CI_SAP_TAUX',
      'CI_SAP_PLAFOND',
      'CI_SAP_MAJORATION',
      'CI_SAP_PLAFOND_MAJORE_MAX',
      'CI_SAP_PLAFOND_PREMIERE_ANNEE',
      'CI_SAP_PLAFOND_PREMIERE_ANNEE_MAX',
      'CI_SAP_PLAFOND_INVALIDITE',
      'PLAFONNEMENT_GLOBAL_NICHES',
    ],
    valableJusquau: '2026-12-31',
    aVerifier:
      "Taux et plafonds du crédit d'impôt emploi à domicile, et plafonnement global des niches fiscales, dans la loi de finances.",
    source: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12',
  },
  {
    constantes: ['PLAFOND_AIDE_SERVICES_PERSONNE'],
    valableJusquau: '2026-12-31',
    aVerifier: "Plafond annuel de l'aide aux services à la personne (CESU préfinancé), revalorisé par arrêté en fin d'année.",
    source:
      'https://www.servicesalapersonne.gouv.fr/tout-savoir-sur-les-services-la-personne/les-avantages-du-cesu-prefinance',
  },
  {
    constantes: ['PER_PLAFOND_MINIMUM', 'PER_PLAFOND_MAXIMUM', 'PER_TAUX_PLAFOND'],
    valableJusquau: '2026-12-31',
    aVerifier:
      "Plafond de déduction de l'épargne retraite (10 % des revenus d'activité, bornes de 10 % et 80 % du Pass de l'année précédente) et règles de report des plafonds non utilisés.",
    source: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F34982',
  },
  {
    constantes: [
      'CFE_BASE_MINIMUM_PLANCHER',
      'CFE_TRANCHES_BASE_MINIMUM',
      'CFE_SEUIL_EXONERATION_CA',
      'CFE_REDUCTION_ANNEE_SUIVANT_CREATION',
      'CFE_TAXE_ADDITIONNELLE_CCI',
      'CFE_FRAIS_GESTION',
    ],
    valableJusquau: '2026-12-31',
    aVerifier:
      'Tranches de base minimum de CFE (revalorisées chaque année), seuil d’exonération, taxe additionnelle CCI et frais de gestion.',
    source: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23547',
  },
  {
    constantes: ['IS_SEUIL_TAUX_REDUIT', 'IS_TAUX_REDUIT', 'IS_TAUX_NORMAL'],
    valableJusquau: '2026-12-31',
    aVerifier: "Taux et seuil de l'impôt sur les sociétés dans la loi de finances.",
    source: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23575',
  },
  {
    constantes: [
      'BAREME_IR',
      'ABATTEMENT_SALAIRE',
      'ABATTEMENT_SALAIRE_MIN',
      'ABATTEMENT_SALAIRE_MAX',
      'DECOTE_CELIBATAIRE',
      'DECOTE_COUPLE',
      'DECOTE_TAUX',
      'PLAFOND_DEMI_PART',
      'PAS_ARRONDI',
    ],
    valableJusquau: '2026-12-31',
    aVerifier:
      "Barème de l'impôt sur le revenu, décote, plafond du quotient familial et déduction de 10 % votés dans la loi de finances suivante.",
    source: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1419',
  },
  {
    constantes: [
      'DISPENSE_PFNL_CELIBATAIRE',
      'DISPENSE_PFNL_COUPLE',
      'CEHR_SEUIL_CELIBATAIRE',
      'CEHR_SEUIL_COUPLE',
    ],
    valableJusquau: '2026-12-31',
    aVerifier:
      'Seuils de dispense de l’acompte de 12,8 % (CGI, art. 242 quater) et de la contribution exceptionnelle sur les hauts revenus (CGI, art. 223 sexies).',
    source: 'https://www.legifrance.gouv.fr/codes/texte_lc/LEGITEXT000006069577',
  },
  {
    constantes: [
      'PFU_IR',
      'PRELEVEMENTS_SOCIAUX',
      'PFU_TOTAL',
      'ABATTEMENT_DIVIDENDES',
      'CSG_DEDUCTIBLE_DIVIDENDES',
    ],
    valableJusquau: '2026-12-31',
    aVerifier:
      'Flat tax, prélèvements sociaux sur les revenus du capital et abattement de 40 % : loi de finances et LFSS.',
    source: 'https://entreprendre.service-public.gouv.fr/actualites/A18796',
  },
  {
    constantes: [
      'TJM_MOYEN_REFERENCE',
      'JOURS_FACTURES_REFERENCE',
      'TAUX_FRAIS_REFERENCE',
      'RESULTAT_PAR_DEFAUT',
      'CA_MENSUEL_PAR_DEFAUT',
      'FRAIS_MENSUELS_PAR_DEFAUT',
    ],
    valableJusquau: '2026-12-31',
    aVerifier: 'Tarif journalier moyen du baromètre public de l’année suivante.',
    source: 'https://www.malt.fr/t/barometre-tarifs/tech/',
  },
  {
    constantes: ['SALAIRE_REFERENCE_AGIRC_ARRCO', 'TAUX_POINTS_T1', 'TAUX_POINTS_T2'],
    valableJusquau: '2026-12-31',
    aVerifier: "Valeur d'achat du point (salaire de référence) Agirc-Arrco de l'année suivante.",
    source:
      'https://reglementation.agirc-arrco.fr/home/baremes/listes-area/baremes-1/valeur-d-achat-du-point-agirc-arrco.html',
  },
  {
    constantes: ['VALEUR_POINT_AGIRC_ARRCO'],
    // The point is revalued every 1 November.
    valableJusquau: '2026-10-31',
    aVerifier: 'Valeur de service du point Agirc-Arrco, revalorisée chaque 1ᵉʳ novembre.',
    source:
      'https://reglementation.agirc-arrco.fr/home/baremes/listes-area/baremes-1/valeur-de-service-du-point-agirc-arrco.html',
  },
  {
    constantes: ['TOLERANCE_OPTIMUM'],
    valableJusquau: null,
    aVerifier: 'Convention du simulateur : aucun texte ne la fait évoluer.',
    source: 'https://github.com/Commutator-IO/sasu-simulator',
  },
];

/** Entries past their date on a given day (YYYY-MM-DD). */
export function parametresPerimes(jour: string): Validite[] {
  return VALIDITE_PARAMETRES.filter(
    (v) => v.valableJusquau !== null && jour > v.valableJusquau,
  );
}

/** Today as YYYY-MM-DD, in Paris time: the rules change at midnight there. */
export function aujourdhuiAParis(maintenant = new Date()): string {
  return new Intl.DateTimeFormat('fr-CA', {
    timeZone: 'Europe/Paris',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(maintenant);
}
