import { eur } from './format';
import * as P from './parametres2026';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Hypotheses = {
  /** Profit for the year before any salary paid to the president (revenue − costs). */
  resultatAvantRemuneration: number;
  /** President's gross annual salary. */
  brutAnnuel: number;
  /**
   * Number of months in office during the year, which prorates the
   * contribution ceilings: a company incorporated in July only gets six
   * monthly ceilings.
   *
   * Careful: it is the length of the **employment period** that prorates the
   * ceiling, not the pace of the payments. A president in office all year who
   * pays themselves irregularly keeps a full annual ceiling, because the
   * progressive year-to-date adjustment recomputes capped contributions
   * cumulatively from January.
   */
  moisRemuneration: number;
  /**
   * Retained earnings and reserves carried over from previous years, still
   * available for distribution.
   *
   * Corporate tax was already paid on them when they were earned, so they are
   * added to the distributable amount without being taxed again at company
   * level. They are taxed as ordinary dividends in the shareholder's hands.
   */
  reservesDistribuables: number;
  /** Share of the distributable amount paid out as dividends (0 → 1). */
  tauxDistribution: number;
  /** Number of shares in the household for the family quotient. */
  parts: number;
  /** Is the household a jointly assessed couple? (affects the rebate) */
  couple: boolean;
  /** Other net taxable household income (partner's salary, rental income…). */
  autresRevenus: number;
  /**
   * Gross annual salary the president earns from another employer — typically
   * a part-time job held alongside the company.
   */
  salaireExterneBrut: number;
  /**
   * Yearly employee savings paid by the company: profit-sharing, statutory
   * participation, employer top-up on a savings plan, plus holiday vouchers.
   * A deductible company expense, received net of CSG-CRDS.
   */
  epargneSalariale: number;
  /**
   * Yearly benefits exempt from every levy within their limits, chiefly the
   * employer aid for home services (CESU préfinancé), which a president with no
   * employee may grant themselves. A deductible company expense, received in
   * full.
   */
  avantagesExoneres: number;
  /**
   * Employer aid for home services (CESU préfinancé) the company pays its
   * president, capped at the yearly ceiling and at the spending it funds.
   */
  cesuPrefinance: number;
  /** The household's yearly home-service spending, before any aid. */
  depensesServicesPersonne: number;
  /** Dependants raising the tax-credit ceiling by €1,500 each. */
  majorationsCreditImpot: number;
  /** First year the household directly employs someone at home. */
  premiereAnneeEmploiDomicile: boolean;
  /** Disability raising the ceiling to €20,000. */
  invaliditeCreditImpot: boolean;
  /**
   * Will this year rank among the 25 best of the career? Only then does it
   * raise the base pension.
   */
  anneeParmiMeilleures: boolean;
  /** Count the pension this year earns, at its present value, in the optimum. */
  valoriserRetraite: boolean;
  /** Years until the pension starts. */
  anneesAvantRetraite: number;
  /** Years the pension is expected to be paid. */
  dureeRetraite: number;
  /** Real discount rate, as a percentage. */
  tauxActualisation: number;
  /** Voluntary payments into an individual PER this year, opted as deductible. */
  versementPER: number;
  /**
   * Deduction ceiling available this year, as printed on the tax notice: this
   * year's ceiling plus the unused ones carried forward.
   */
  plafondPER: number;
  /** Company's work-accident insurance rate, as a percentage. */
  tauxATMP: number;
  /** Is the company eligible for the reduced 15% corporate tax rate? */
  eligibleISReduit: boolean;
  /** Opt for the progressive scale on dividends instead of the flat tax. */
  dividendesAuBareme: boolean;
};

export type LigneCotisation = {
  libelle: string;
  famille: string;
  basePatronale: number;
  baseSalariale: number;
  tauxPatronal: number;
  tauxSalarial: number;
  patronal: number;
  salarial: number;
  note?: string;
};

export type Resultat = {
  // Company side
  resultatAvantRemuneration: number;
  brutAnnuel: number;
  moisRemuneration: number;
  /** Band 1 ceiling for the months in office, prorated. */
  plafondTranche1: number;
  /**
   * The company's share of that ceiling once an outside salary takes its own
   * part; equal to `plafondTranche1` without one.
   */
  plafondApplique: number;
  cotisationsPatronales: number;
  coutEmployeur: number;
  resultatFiscal: number;
  is: number;
  resultatNet: number;
  /** Reserves carried over from previous years and put into play. */
  reservesAnterieures: number;
  /** Total available for distribution: after-tax profit plus those reserves. */
  distribuable: number;
  /** What is left in the company once the dividend is paid. */
  reserves: number;
  /**
   * Whether the household is likely to cross the high-income levy threshold.
   * The levy itself is not computed — this only flags that the simulation
   * understates the tax due. See `CEHR_SEUIL_CELIBATAIRE`.
   */
  cehrPossible: boolean;

  // Salary side
  lignes: LigneCotisation[];
  cotisationsSalariales: number;
  csgCrds: number;
  csgDeductible: number;
  salaireNet: number;
  salaireNetImposable: number;

  // Dividend side
  dividendesBruts: number;
  prelevementsSociauxDividendes: number;
  irDividendes: number;
  dividendesNets: number;

  // Outside salary
  salaireExterneBrut: number;
  salaireExterneNet: number;
  salaireExterneNetImposable: number;
  /**
   * Change in the outside job's net pay caused by the company salary taking
   * its share of the ceiling. Zero without an outside job.
   */
  effetPlafondExterne: number;

  // Personal income tax
  revenuImposable: number;
  /** Income tax and flat tax attributable to the company alone. */
  irTotal: number;
  /** Extra tax caused by the president's salary. */
  irSurSalaire: number;
  /** Household tax across all sources of income. */
  irFoyer: number;
  tmi: number;

  // Pay-as-you-earn withholding
  /** Withholding base for the president's salary alone. */
  assiettePAS: number;
  /** Household withholding base, outside salary included. */
  assiettePASFoyer: number;
  tauxPAS: number;
  /**
   * Amount actually withheld over the year on the company payslips, i.e.
   * `tauxPAS × assiettePAS`.
   *
   * This is deliberately distinct from `irSurSalaire`: withholding is a
   * provisional payment computed from a household rate, whereas
   * `irSurSalaire` is the definitive extra tax the salary causes. They only
   * coincide when the salary is the household's sole income; the tax return
   * settles the difference.
   */
  prelevementAnnuelPAS: number;
  /** Monthly amount withheld on the company payslip alone. */
  prelevementMensuelPAS: number;

  // Benefits outside salary and dividends
  /** Company cost of the employee savings and other exempt benefits. */
  chargesAvantages: number;
  /** CSG-CRDS withheld from the employee savings. */
  csgCrdsEpargneSalariale: number;
  /** What the benefits leave in the pocket. */
  avantagesNets: number;

  // Home services (CESU préfinancé and the home-employment tax credit)
  /** Aid actually paid, after its caps. */
  cesuVerse: number;
  /** Household tax credit, with and without the aid taken off its base. */
  creditImpotServices: number;
  creditImpotServicesSansAide: number;
  /** Credit lost because of the aid: always zero or negative. */
  effetCesuSurCredit: number;
  /** Spending above which the aid stops eating into the credit. */
  seuilRentabiliteCesu: number;

  // Individual retirement savings (PER)
  /** Payment actually deducted: capped by the ceiling and by taxable income. */
  deductionPER: number;
  /** Household income tax saved by the deduction. */
  economieImpotPER: number;
  /** Ceiling this year's earned income opens for next year's payments. */
  plafondPERAnneeSuivante: number;

  // Summary
  /** President's salary after income tax, including its effect on an outside job. */
  salaireNetApresImpot: number;
  netEnPoche: number;
  totalPrelevements: number;
  tauxPrelevementGlobal: number;

  // Social entitlements
  trimestresValides: number;
  /** Pension quarters already earned by the outside salary alone. */
  trimestresExterne: number;
  pointsAgircArrco: number;
  retraiteComplementaireAnnuelle: number;
  /** Yearly base pension this year's company salary adds, at the full rate. */
  retraiteBaseAnnuelle: number;
  /** Base plus complementary, gross and net of the levies on pensions. */
  retraiteAcquiseBrute: number;
  retraiteAcquiseNette: number;
  /** Old-age and complementary-pension contributions, both sides. */
  cotisationsRetraite: number;
  /** Today's value of the net pension earned this year. */
  valeurRetraite: number;
  /** The assumptions behind that value, echoed for display. */
  anneesAvantRetraite: number;
  dureeRetraite: number;
  tauxActualisation: number;
  /**
   * What the optimum maximises: take-home pay, plus the pension's value when
   * the reader chose to count it.
   */
  critere: number;
};

// ---------------------------------------------------------------------------
// Social contributions
// ---------------------------------------------------------------------------

/**
 * Ceiling applicable to band 1: the monthly ceiling times the number of months
 * in office. Over twelve months this lands exactly on the annual ceiling.
 */
export function plafondTranche1(moisRemuneration = 12): number {
  return P.PMSS * bornerMois(moisRemuneration);
}

/**
 * Share of the ceiling one employer applies when the same person is paid by
 * several employers at once: the ceiling times this employer's pay over the
 * total pay (BOSS, Assiette générale, § 960-970, which extends the rule to
 * company officers who also hold a job elsewhere).
 *
 * Without the split, each employer would apply a full ceiling and the capped
 * contributions would be computed as though the person earned twice the
 * ceiling's worth of capped pay.
 */
export function plafondReparti(
  plafond: number,
  brut: number,
  brutAutresEmployeurs = 0,
): number {
  const autres = Math.max(0, brutAutresEmployeurs);
  const total = Math.max(0, brut) + autres;
  if (autres === 0 || total === 0) return plafond;
  return (plafond * Math.max(0, brut)) / total;
}

function bornerMois(mois: number): number {
  if (!Number.isFinite(mois)) return 12;
  return Math.min(12, Math.max(1, mois));
}

function assiette(type: P.Assiette, brut: number, plafond: number): number {
  switch (type) {
    case 'totalite':
      return brut;
    case 't1':
      return Math.min(brut, plafond);
    case 't2':
      return Math.max(0, Math.min(brut, 8 * plafond) - plafond);
    case 'tranche_a_4pass':
      return Math.min(brut, 4 * plafond);
    case 'totalite_si_sup_pass':
      return brut > plafond ? Math.min(brut, 8 * plafond) : 0;
  }
}

/**
 * CSG-CRDS base: 98.25% of gross salary, the allowance being capped at four
 * times the applicable ceiling.
 */
export function assietteCSG(
  brut: number,
  moisRemuneration = 12,
  brutAutresEmployeurs = 0,
): number {
  const plafond =
    4 * plafondReparti(plafondTranche1(moisRemuneration), brut, brutAutresEmployeurs);
  const partAbattue = Math.min(brut, plafond);
  const partNonAbattue = Math.max(0, brut - plafond);
  return partAbattue * (1 - P.CSG_ABATTEMENT) + partNonAbattue;
}

export function calculerCotisations(
  brut: number,
  tauxATMP: number,
  moisRemuneration = 12,
  brutAutresEmployeurs = 0,
): LigneCotisation[] {
  const plafond = plafondReparti(
    plafondTranche1(moisRemuneration),
    brut,
    brutAutresEmployeurs,
  );
  const lignes: LigneCotisation[] = P.COTISATIONS.map((c) => {
    const base = assiette(c.assiette, brut, plafond);
    return {
      libelle: c.libelle,
      famille: c.famille,
      basePatronale: base,
      baseSalariale: base,
      tauxPatronal: c.patronal,
      tauxSalarial: c.salarial,
      patronal: (base * c.patronal) / 100,
      salarial: (base * c.salarial) / 100,
      note: c.note,
    };
  });

  lignes.push({
    libelle: 'Accidents du travail / maladies professionnelles',
    famille: 'Autres',
    basePatronale: brut,
    baseSalariale: 0,
    tauxPatronal: tauxATMP,
    tauxSalarial: 0,
    patronal: (brut * tauxATMP) / 100,
    salarial: 0,
    note: "Taux notifié par la Carsat, variable selon l'activité.",
  });

  const baseCSG = assietteCSG(brut, moisRemuneration, brutAutresEmployeurs);
  lignes.push(
    {
      libelle: 'CSG déductible',
      famille: 'CSG-CRDS',
      basePatronale: 0,
      baseSalariale: baseCSG,
      tauxPatronal: 0,
      tauxSalarial: P.CSG_DEDUCTIBLE,
      patronal: 0,
      salarial: (baseCSG * P.CSG_DEDUCTIBLE) / 100,
    },
    {
      libelle: 'CSG non déductible',
      famille: 'CSG-CRDS',
      basePatronale: 0,
      baseSalariale: baseCSG,
      tauxPatronal: 0,
      tauxSalarial: P.CSG_NON_DEDUCTIBLE,
      patronal: 0,
      salarial: (baseCSG * P.CSG_NON_DEDUCTIBLE) / 100,
    },
    {
      libelle: 'CRDS',
      famille: 'CSG-CRDS',
      basePatronale: 0,
      baseSalariale: baseCSG,
      tauxPatronal: 0,
      tauxSalarial: P.CRDS,
      patronal: 0,
      salarial: (baseCSG * P.CRDS) / 100,
    },
  );

  return lignes;
}

/** Total employer cost (gross + employer contributions) for a given gross. */
export function coutEmployeur(
  brut: number,
  tauxATMP: number,
  moisRemuneration = 12,
  brutAutresEmployeurs = 0,
): number {
  const lignes = calculerCotisations(brut, tauxATMP, moisRemuneration, brutAutresEmployeurs);
  return brut + lignes.reduce((s, l) => s + l.patronal, 0);
}

/**
 * Highest gross salary payable within a given employer budget. Employer cost
 * is continuous and strictly increasing in gross salary, so it is inverted by
 * bisection.
 */
export function brutMaxPourBudget(
  budget: number,
  tauxATMP: number,
  moisRemuneration = 12,
  brutAutresEmployeurs = 0,
): number {
  if (budget <= 0) return 0;
  let bas = 0;
  let haut = budget;
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2;
    if (coutEmployeur(milieu, tauxATMP, moisRemuneration, brutAutresEmployeurs) > budget)
      haut = milieu;
    else bas = milieu;
  }
  return bas;
}

/**
 * Today's value of a yearly pension that starts in `differe` years and is paid
 * for `duree` years, at a real discount rate: a euro of pension in thirty
 * years is not a euro today.
 */
export function valeurActuelleRente(
  rente: number,
  differe: number,
  duree: number,
  taux: number,
): number {
  const n = Math.max(0, duree);
  const r = Math.max(-0.99, taux);
  const annuite = Math.abs(r) < 1e-9 ? n : (1 - (1 + r) ** -n) / r;
  return rente * annuite * (1 + r) ** -Math.max(0, differe);
}

/** Spending ceiling of the home-employment tax credit for the household. */
export function plafondCreditImpotServices(
  h: Pick<
    Hypotheses,
    'majorationsCreditImpot' | 'premiereAnneeEmploiDomicile' | 'invaliditeCreditImpot'
  >,
): number {
  if (h.invaliditeCreditImpot) return P.CI_SAP_PLAFOND_INVALIDITE;
  const majorations = Math.max(0, h.majorationsCreditImpot) * P.CI_SAP_MAJORATION;
  return h.premiereAnneeEmploiDomicile
    ? Math.min(P.CI_SAP_PLAFOND_PREMIERE_ANNEE_MAX, P.CI_SAP_PLAFOND_PREMIERE_ANNEE + majorations)
    : Math.min(P.CI_SAP_PLAFOND_MAJORE_MAX, P.CI_SAP_PLAFOND + majorations);
}

/**
 * What is left of the profit to pay a salary once the benefits paid outside
 * salary are funded.
 */
export function budgetRemuneration(
  h: Pick<
    Hypotheses,
    | 'resultatAvantRemuneration'
    | 'epargneSalariale'
    | 'avantagesExoneres'
    | 'cesuPrefinance'
    | 'depensesServicesPersonne'
  >,
): number {
  const cesu = Math.min(
    Math.max(0, h.cesuPrefinance),
    P.PLAFOND_AIDE_SERVICES_PERSONNE,
    Math.max(0, h.depensesServicesPersonne),
  );
  return (
    h.resultatAvantRemuneration -
    Math.max(0, h.epargneSalariale) -
    Math.max(0, h.avantagesExoneres) -
    cesu
  );
}

// ---------------------------------------------------------------------------
// Corporate income tax
// ---------------------------------------------------------------------------

export function calculerIS(resultatFiscal: number, eligibleTauxReduit: boolean): number {
  if (resultatFiscal <= 0) return 0;
  if (!eligibleTauxReduit) return resultatFiscal * P.IS_TAUX_NORMAL;
  const partReduite = Math.min(resultatFiscal, P.IS_SEUIL_TAUX_REDUIT);
  const partNormale = Math.max(0, resultatFiscal - P.IS_SEUIL_TAUX_REDUIT);
  return partReduite * P.IS_TAUX_REDUIT + partNormale * P.IS_TAUX_NORMAL;
}

// ---------------------------------------------------------------------------
// Personal income tax
// ---------------------------------------------------------------------------

/** Gross tax from the progressive scale, for a given income. */
export function baremeIR(revenu: number): number {
  let impot = 0;
  let precedent = 0;
  for (const tranche of P.BAREME_IR) {
    if (revenu <= precedent) break;
    const base = Math.min(revenu, tranche.plafond) - precedent;
    impot += base * tranche.taux;
    precedent = tranche.plafond;
  }
  return impot;
}

/** Marginal tax rate reached by the income per household share. */
export function tauxMarginal(revenuParPart: number): number {
  for (const tranche of P.BAREME_IR) {
    if (revenuParPart <= tranche.plafond) return tranche.taux;
  }
  return P.BAREME_IR[P.BAREME_IR.length - 1].taux;
}

/**
 * Household income tax, with the family quotient cap and the low-income
 * rebate applied.
 */
export function calculerIR(revenuImposable: number, parts: number, couple: boolean): number {
  if (revenuImposable <= 0) return 0;

  const partsDeBase = couple ? 2 : 1;
  const impotAvecQuotient = baremeIR(revenuImposable / parts) * parts;

  // Cap the benefit granted by the additional half-shares.
  const impotSansQuotient = baremeIR(revenuImposable / partsDeBase) * partsDeBase;
  const demiPartsSupp = Math.max(0, (parts - partsDeBase) * 2);
  const avantageMax = demiPartsSupp * P.PLAFOND_DEMI_PART;
  const avantage = impotSansQuotient - impotAvecQuotient;

  let impot =
    avantage > avantageMax ? impotSansQuotient - avantageMax : impotAvecQuotient;

  // Low-income rebate.
  const seuil = couple ? P.DECOTE_COUPLE : P.DECOTE_CELIBATAIRE;
  const decote = seuil - P.DECOTE_TAUX * impot;
  if (decote > 0) impot = Math.max(0, impot - decote);

  return Math.max(0, impot);
}

/**
 * Household pay-as-you-earn withholding rate (tax code art. 204 H).
 *
 *              scale tax × (in-scope income / total taxable income)
 *   rate =    ─────────────────────────────────────────────────────
 *                     withholding base (art. 204 F)
 *
 * The base is the net taxable salary **before** the flat 10% deduction. That
 * mismatch is why the rate looks lower than a naive "tax over taxable income"
 * ratio. The rate is rounded to the nearest decimal.
 *
 * @param irBareme        household tax from the progressive scale, before
 *                        reductions and credits (the flat tax on dividends is
 *                        excluded: investment income is out of the
 *                        withholding scope)
 * @param revenuImposable total net taxable household income
 * @param partDansLeChamp share of that taxable income within the scope
 * @param assiette        withholding base, before the 10% deduction
 */
export function tauxPrelevementSource(
  irBareme: number,
  revenuImposable: number,
  partDansLeChamp: number,
  assiette: number,
): number {
  if (assiette <= 0 || revenuImposable <= 0) return 0;
  const impotDansLeChamp = irBareme * (partDansLeChamp / revenuImposable);
  const taux = impotDansLeChamp / assiette;
  if (taux <= 0) return 0;
  return Math.round(taux / P.PAS_ARRONDI) * P.PAS_ARRONDI;
}

/**
 * Breaks a gross salary down from the employee's point of view: contributions
 * withheld, net pay, and net taxable pay before the flat 10% deduction.
 *
 * Used both for the president's salary and for a salary earned at another
 * employer: on the employee side the rates are identical (the president only
 * differs by the absence of an unemployment contribution, which was itself
 * abolished for employees in 2018).
 */
export function decomposerSalaire(
  brut: number,
  moisRemuneration = 12,
  brutAutresEmployeurs = 0,
): {
  cotisationsHorsCSG: number;
  csgCrds: number;
  csgDeductible: number;
  net: number;
  netImposableAvantAbattement: number;
} {
  const lignes = calculerCotisations(
    Math.max(0, brut),
    0,
    moisRemuneration,
    brutAutresEmployeurs,
  );
  const csgLignes = lignes.filter((l) => l.famille === 'CSG-CRDS');
  const csgCrds = csgLignes.reduce((s, l) => s + l.salarial, 0);
  const csgDeductible =
    csgLignes.find((l) => l.libelle === 'CSG déductible')?.salarial ?? 0;
  const cotisationsHorsCSG = lignes
    .filter((l) => l.famille !== 'CSG-CRDS')
    .reduce((s, l) => s + l.salarial, 0);

  return {
    cotisationsHorsCSG,
    csgCrds,
    csgDeductible,
    net: brut - cotisationsHorsCSG - csgCrds,
    // Non-deductible CSG and CRDS remain part of the taxable base.
    netImposableAvantAbattement: Math.max(
      0,
      brut - cotisationsHorsCSG - csgDeductible,
    ),
  };
}

/** Net taxable salary after the flat 10% deduction. */
export function abattementSalaire(netImposableAvantAbattement: number): number {
  const abattement = Math.min(
    Math.max(netImposableAvantAbattement * P.ABATTEMENT_SALAIRE, P.ABATTEMENT_SALAIRE_MIN),
    P.ABATTEMENT_SALAIRE_MAX,
  );
  return Math.max(0, netImposableAvantAbattement - abattement);
}

// ---------------------------------------------------------------------------
// Full simulation
// ---------------------------------------------------------------------------

export function simuler(h: Hypotheses): Resultat {
  const brut = Math.max(0, h.brutAnnuel);
  const mois = bornerMois(h.moisRemuneration);

  // --- Company -------------------------------------------------------------
  // A job held elsewhere takes its share of the ceiling: each employer only
  // caps contributions at its pro rata part.
  const externeBrut = Math.max(0, h.salaireExterneBrut);
  const lignes = calculerCotisations(brut, h.tauxATMP, mois, externeBrut);
  const cotisationsPatronales = lignes.reduce((s, l) => s + l.patronal, 0);
  const cout = brut + cotisationsPatronales;
  // Benefits outside salary are a deductible expense like the salary itself:
  // they come off the profit before corporate tax.
  const epargneSalariale = Math.max(0, h.epargneSalariale);
  const avantagesExoneres = Math.max(0, h.avantagesExoneres);
  // The aid cannot exceed its ceiling nor the cost it actually funds.
  const depensesSAP = Math.max(0, h.depensesServicesPersonne);
  const cesuVerse = Math.min(
    Math.max(0, h.cesuPrefinance),
    P.PLAFOND_AIDE_SERVICES_PERSONNE,
    depensesSAP,
  );
  const chargesAvantages = epargneSalariale + avantagesExoneres + cesuVerse;
  const resultatFiscal = h.resultatAvantRemuneration - cout - chargesAvantages;
  const is = calculerIS(resultatFiscal, h.eligibleISReduit);
  const resultatNet = resultatFiscal - is;

  // Reserves from previous years join the distributable amount without going
  // through corporate tax again: it was already paid when they were earned.
  // A loss for the year still eats into equity, hence the max() on the
  // distributable side but not on the reserves left behind.
  const reservesAnterieures = Math.max(0, h.reservesDistribuables);
  const distribuable = Math.max(0, resultatNet) + reservesAnterieures;
  const dividendesBruts = distribuable * h.tauxDistribution;
  const reserves = resultatNet + reservesAnterieures - dividendesBruts;

  // --- Salary --------------------------------------------------------------
  const csgCrdsLignes = lignes.filter((l) => l.famille === 'CSG-CRDS');
  const csgCrds = csgCrdsLignes.reduce((s, l) => s + l.salarial, 0);
  const csgDeductible =
    csgCrdsLignes.find((l) => l.libelle === 'CSG déductible')?.salarial ?? 0;
  const cotisationsSalarialesHorsCSG = lignes
    .filter((l) => l.famille !== 'CSG-CRDS')
    .reduce((s, l) => s + l.salarial, 0);
  const cotisationsSalariales = cotisationsSalarialesHorsCSG + csgCrds;

  const salaireNet = brut - cotisationsSalariales;
  // Net taxable = gross − deductible contributions − deductible CSG.
  // Non-deductible CSG and CRDS remain part of the taxable base.
  const netImposableAvantAbattement = Math.max(
    0,
    brut - cotisationsSalarialesHorsCSG - csgDeductible,
  );

  // --- Outside salary ------------------------------------------------------
  const externe = decomposerSalaire(externeBrut, 12, brut);
  // The same job without the company: it keeps the whole ceiling. Paying a
  // salary from the company shifts part of the outside pay into band 2 and
  // brings in the CET, so the outside net moves too. That change is caused by
  // the company salary and is charged to it.
  const externeSeul = decomposerSalaire(externeBrut);
  const effetPlafondExterne = externe.net - externeSeul.net;

  // The 10% deduction applies to all of a person's salaries at once, and its
  // cap only bites once: the salaries cannot be deducted separately.
  const salairesImposables = abattementSalaire(
    netImposableAvantAbattement + externe.netImposableAvantAbattement,
  );
  const salaireExterneNetImposable = abattementSalaire(
    externe.netImposableAvantAbattement,
  );
  const salaireNetImposable = Math.max(0, salairesImposables - salaireExterneNetImposable);

  // --- Dividends -----------------------------------------------------------
  const prelevementsSociauxDividendes = dividendesBruts * P.PRELEVEMENTS_SOCIAUX;

  let irDividendes: number;
  let revenuImposable: number;
  let irFoyer: number;
  let irSurSalaire: number;
  let deductionPER: number;

  // Two bases: the household as it stands, and the household without the
  // president's salary. The difference isolates the tax that salary actually
  // causes — tax owed on an outside job or on a partner's income must not be
  // charged to the company.
  //
  // A PER payment comes off the household's income taxed at the progressive
  // scale, in every one of these bases alike: the deduction exists with or
  // without the company, and only the tax the salary still causes on top of it
  // is charged to the salary. It cannot take a base below zero, and income
  // under the flat tax is outside its reach.
  const versementPER = Math.max(0, h.versementPER);
  const deductionPlafonnee = Math.min(versementPER, Math.max(0, h.plafondPER));
  const deduire = (base: number) => Math.max(0, base - deductionPlafonnee);
  const baseHorsDividendes = salairesImposables + h.autresRevenus;
  const baseSansRemuneration =
    abattementSalaire(externeSeul.netImposableAvantAbattement) + h.autresRevenus;
  const irHorsDividendes = calculerIR(deduire(baseHorsDividendes), h.parts, h.couple);
  const irSansRemuneration = calculerIR(deduire(baseSansRemuneration), h.parts, h.couple);

  if (h.dividendesAuBareme) {
    const dividendesImposables =
      dividendesBruts * (1 - P.ABATTEMENT_DIVIDENDES) -
      dividendesBruts * P.CSG_DEDUCTIBLE_DIVIDENDES;
    const avantDeduction = baseHorsDividendes + Math.max(0, dividendesImposables);
    revenuImposable = deduire(avantDeduction);
    deductionPER = avantDeduction - revenuImposable;
    irFoyer = calculerIR(revenuImposable, h.parts, h.couple);

    // Salary and dividends now share one progressive scale, so the tax they
    // jointly cause has to be split between them. Charging the salary first
    // would hand it the cheap brackets and leave the marginal ones to the
    // dividends — the salary would look far cheaper than it is.
    //
    // Each side is therefore credited with the average of its two marginal
    // contributions: entering the base first, and entering it last. This is
    // the Shapley value for two contributors, and it adds up exactly to the
    // tax they cause together.
    const irDividendesDAbord = calculerIR(
      deduire(baseSansRemuneration + Math.max(0, dividendesImposables)),
      h.parts,
      h.couple,
    );
    irSurSalaire =
      (irHorsDividendes - irSansRemuneration + (irFoyer - irDividendesDAbord)) / 2;
    irDividendes =
      (irDividendesDAbord - irSansRemuneration + (irFoyer - irHorsDividendes)) / 2;
  } else {
    revenuImposable = deduire(baseHorsDividendes);
    deductionPER = baseHorsDividendes - revenuImposable;
    // Under the flat tax, dividends stay out of the progressive scale: there
    // is nothing to share, and the salary bears exactly its own tax.
    irDividendes = dividendesBruts * P.PFU_IR;
    irFoyer = irHorsDividendes + irDividendes;
    irSurSalaire = irHorsDividendes - irSansRemuneration;
  }
  const irTotal = irSurSalaire + irDividendes;

  // What the PER saves the household, against the same year without it.
  const economieImpotPER =
    deductionPER > 0 ? simuler({ ...h, versementPER: 0 }).irFoyer - irFoyer : 0;
  // This year's salaries open next year's ceiling: 10% of earned income net of
  // the professional-expense deduction, bounded by 10% of one and eight PASS.
  const plafondPERAnneeSuivante = Math.min(
    8 * P.PASS * P.PER_TAUX_PLAFOND,
    Math.max(P.PASS * P.PER_TAUX_PLAFOND, salairesImposables * P.PER_TAUX_PLAFOND),
  );

  const dividendesNets = dividendesBruts - prelevementsSociauxDividendes - irDividendes;

  // --- Withholding ---------------------------------------------------------
  // The rate belongs to the household and applies to all its in-scope income,
  // hence to both salaries. Dividends are excluded: they fall under the 12.8%
  // non-final withholding operated by the company.
  const irBareme = h.dividendesAuBareme ? irFoyer : irHorsDividendes;
  const assiettePAS = netImposableAvantAbattement;
  const assiettePASFoyer = assiettePAS + externe.netImposableAvantAbattement;
  const tauxPAS = tauxPrelevementSource(
    irBareme,
    revenuImposable,
    salairesImposables,
    assiettePASFoyer,
  );
  // What the company withholds on its own payslips; the other employer
  // withholds its share separately at the same rate.
  const prelevementAnnuelPAS = assiettePAS * tauxPAS;
  const prelevementMensuelPAS = prelevementAnnuelPAS / mois;

  // --- Summary -------------------------------------------------------------
  // Employee savings and holiday vouchers only bear CSG-CRDS; they are assumed
  // placed on a savings plan, hence exempt from income tax.
  const csgCrdsEpargneSalariale = epargneSalariale * P.CSG_CRDS_EPARGNE_SALARIALE;
  // The home-employment credit is the household's whether or not the company
  // pays an aid; what the aid changes is the base, which it must come off. Only
  // that change is charged to the company, so below the ceiling each euro of
  // aid costs fifty cents of credit.
  const plafondCredit = plafondCreditImpotServices(h);
  const credit = (aide: number) =>
    Math.min(
      P.PLAFONNEMENT_GLOBAL_NICHES,
      P.CI_SAP_TAUX * Math.min(Math.max(0, depensesSAP - aide), plafondCredit),
    );
  const creditImpotServices = credit(cesuVerse);
  const creditImpotServicesSansAide = credit(0);
  const effetCesuSurCredit = creditImpotServices - creditImpotServicesSansAide;
  const seuilRentabiliteCesu = plafondCredit + cesuVerse;

  const avantagesNets = chargesAvantages - csgCrdsEpargneSalariale + effetCesuSurCredit;

  const salaireNetApresImpot = salaireNet - irSurSalaire + effetPlafondExterne;
  const netEnPoche = salaireNetApresImpot + dividendesNets + avantagesNets;
  const totalPrelevements =
    cotisationsPatronales +
    cotisationsSalariales +
    csgCrdsEpargneSalariale -
    // What the outside payslip gains or loses in contributions because of the
    // company salary.
    effetPlafondExterne +
    is +
    prelevementsSociauxDividendes +
    irTotal;
  const assiette = h.resultatAvantRemuneration;
  const tauxPrelevementGlobal = assiette > 0 ? totalPrelevements / assiette : 0;

  // --- Social entitlements -------------------------------------------------
  // Pension quarters are counted per person across all employers, and depend
  // on annual salary rather than on the number of months worked.
  const trimestresValides = Math.min(
    4,
    Math.floor((brut + externeBrut) / P.BRUT_PAR_TRIMESTRE),
  );
  const trimestresExterne = Math.min(
    4,
    Math.floor(externeBrut / P.BRUT_PAR_TRIMESTRE),
  );
  const plafond = plafondTranche1(mois);
  const plafondSASU = plafondReparti(plafond, brut, externeBrut);
  const t1 = Math.min(brut, plafondSASU);
  const t2 = Math.max(0, Math.min(brut, 8 * plafondSASU) - plafondSASU);
  const pointsAgircArrco =
    (t1 * P.TAUX_POINTS_T1 + t2 * P.TAUX_POINTS_T2) / P.SALAIRE_REFERENCE_AGIRC_ARRCO;
  // The point value is a yearly amount: points × value is already the annual pension.
  const retraiteComplementaireAnnuelle = pointsAgircArrco * P.VALEUR_POINT_AGIRC_ARRCO;

  // A year among the 25 best adds its capped salary / 25 to the average the
  // base pension is 50% of. With an outside job the cap is shared, so only the
  // part the company salary adds on top of it is credited to the company.
  const retraiteBaseAnnuelle = h.anneeParmiMeilleures
    ? (P.RETRAITE_BASE_TAUX_PLEIN *
        (Math.min(brut + externeBrut, plafond) - Math.min(externeBrut, plafond))) /
      P.RETRAITE_BASE_MEILLEURES_ANNEES
    : 0;
  const retraiteAcquiseBrute = retraiteBaseAnnuelle + retraiteComplementaireAnnuelle;
  const retraiteAcquiseNette = retraiteAcquiseBrute * (1 - P.PRELEVEMENTS_SOCIAUX_PENSION);
  const cotisationsRetraite = lignes
    .filter(
      (l) =>
        l.libelle.startsWith('Vieillesse') ||
        (l.famille === 'Retraite complémentaire' && !l.libelle.startsWith('Apec')),
    )
    .reduce((s, l) => s + l.patronal + l.salarial, 0);
  const valeurRetraite = valeurActuelleRente(
    retraiteAcquiseNette,
    h.anneesAvantRetraite,
    h.dureeRetraite,
    h.tauxActualisation / 100,
  );
  const critere = netEnPoche + (h.valoriserRetraite ? valeurRetraite : 0);

  return {
    resultatAvantRemuneration: h.resultatAvantRemuneration,
    brutAnnuel: brut,
    moisRemuneration: mois,
    plafondTranche1: plafond,
    plafondApplique: plafondSASU,
    cotisationsPatronales,
    coutEmployeur: cout,
    resultatFiscal,
    is,
    resultatNet,
    reservesAnterieures,
    distribuable,
    reserves,
    // The reference taxable income includes flat-taxed dividends at their
    // gross amount, hence the sum below rather than `revenuImposable`.
    cehrPossible:
      salairesImposables + h.autresRevenus + dividendesBruts >
      (h.couple ? P.CEHR_SEUIL_COUPLE : P.CEHR_SEUIL_CELIBATAIRE),
    lignes,
    cotisationsSalariales,
    csgCrds,
    csgDeductible,
    salaireNet,
    salaireNetImposable,
    dividendesBruts,
    prelevementsSociauxDividendes,
    irDividendes,
    dividendesNets,
    salaireExterneBrut: externeBrut,
    salaireExterneNet: externe.net,
    salaireExterneNetImposable,
    effetPlafondExterne,
    revenuImposable,
    irTotal,
    irSurSalaire,
    irFoyer,
    tmi: tauxMarginal(revenuImposable / h.parts),
    assiettePAS,
    assiettePASFoyer,
    tauxPAS,
    prelevementAnnuelPAS,
    prelevementMensuelPAS,
    chargesAvantages,
    csgCrdsEpargneSalariale,
    avantagesNets,
    cesuVerse,
    creditImpotServices,
    creditImpotServicesSansAide,
    effetCesuSurCredit,
    seuilRentabiliteCesu,
    deductionPER,
    economieImpotPER,
    plafondPERAnneeSuivante,
    salaireNetApresImpot,
    netEnPoche,
    totalPrelevements,
    tauxPrelevementGlobal,
    trimestresValides,
    trimestresExterne,
    pointsAgircArrco,
    retraiteComplementaireAnnuelle,
    retraiteBaseAnnuelle,
    retraiteAcquiseBrute,
    retraiteAcquiseNette,
    cotisationsRetraite,
    valeurRetraite,
    anneesAvantRetraite: h.anneesAvantRetraite,
    dureeRetraite: h.dureeRetraite,
    tauxActualisation: h.tauxActualisation,
    critere,
  };
}

export type Plateau = {
  /** Lowest gross salary still within the tolerance. */
  min: number;
  /** Highest gross salary still within the tolerance. */
  max: number;
  /** Take-home difference accepted across the whole range. */
  tolerance: number;
};

/**
 * Range of salaries whose take-home pay stays within `tolerance` of the
 * optimum.
 *
 * Take-home pay rises then falls on either side of the optimum, so each bound
 * is found by bisection on a monotonic branch.
 */
export function plateauOptimum(
  h: Omit<Hypotheses, 'brutAnnuel'>,
  optimum: Resultat,
  brutMax: number,
  tolerance = P.TOLERANCE_OPTIMUM,
): Plateau {
  const seuil = optimum.critere - tolerance;
  const net = (brut: number) => simuler({ ...h, brutAnnuel: brut }).critere;

  const borne = (depart: number, arrivee: number) => {
    // `depart` is inside the range, `arrivee` outside.
    if (net(arrivee) >= seuil) return arrivee;
    let dedans = depart;
    let dehors = arrivee;
    for (let i = 0; i < 40; i++) {
      const milieu = (dedans + dehors) / 2;
      if (net(milieu) >= seuil) dedans = milieu;
      else dehors = milieu;
    }
    return dedans;
  };

  return {
    min: borne(optimum.brutAnnuel, 0),
    max: borne(optimum.brutAnnuel, brutMax),
    tolerance,
  };
}

/** Salary level at which a tax rule kicks in and the curve changes slope. */
export type Seuil = {
  brut: number;
  /** Short label drawn above the marker. */
  libelle: string;
  /** One-sentence explanation of what changes past this point. */
  explication: string;
};

/**
 * Salary levels where the take-home curve bends, for the given assumptions.
 *
 * Each rule is read off `simuler` rather than inverted by hand: the salary
 * that crosses a tax bracket depends on contributions, the 10% allowance, the
 * household shares and the other income, and the engine already knows all of
 * that. A change of state between two grid points is pinned down by bisection.
 */
export function seuilsCourbe(
  h: Omit<Hypotheses, 'brutAnnuel'>,
  grille: { brut: number; resultat: Resultat }[],
): Seuil[] {
  const plafond = plafondTranche1(h.moisRemuneration);
  const regles: {
    etat: (r: Resultat) => number | boolean;
    seuil: (apres: Resultat) => Omit<Seuil, 'brut'> | null;
  }[] = [
    {
      etat: (r) => r.irSurSalaire > 0.5,
      seuil: (apres) =>
        apres.irSurSalaire > 0.5
          ? {
              libelle: 'IR',
              explication:
                "Le salaire commence à payer de l'impôt sur le revenu : la décote ne suffit plus à l'annuler.",
            }
          : null,
    },
    {
      etat: (r) => r.tmi,
      // Entering a bracket while the rebate still cancels the tax changes nothing.
      seuil: (apres) =>
        apres.irSurSalaire > 0.5
          ? {
              libelle: `TMI ${Math.round(apres.tmi * 100)} %`,
              explication: `Le revenu imposable du foyer entre dans la tranche à ${Math.round(apres.tmi * 100)} % : chaque euro de salaire supplémentaire y est imposé à ce taux.`,
            }
          : null,
    },
    {
      etat: (r) => h.eligibleISReduit && r.resultatFiscal <= P.IS_SEUIL_TAUX_REDUIT,
      seuil: (apres) =>
        apres.resultatFiscal <= P.IS_SEUIL_TAUX_REDUIT
          ? {
              libelle: 'IS 15 %',
              explication: `Le bénéfice restant passe sous ${eur(P.IS_SEUIL_TAUX_REDUIT)} : il n'est plus imposé qu'à 15 %, donc chaque euro de salaire fait moins économiser d'IS.`,
            }
          : null,
    },
    {
      // With an outside job the ceiling is shared: it is the combined pay that
      // crosses it.
      etat: (r) => r.brutAnnuel + r.salaireExterneBrut > plafond,
      seuil: (apres) =>
        apres.brutAnnuel + apres.salaireExterneBrut > plafond
          ? {
              libelle: 'PASS',
              explication:
                `Au-delà du plafond de la Sécurité sociale (${eur(plafond)}` +
                (apres.salaireExterneBrut > 0 ? ', salaire extérieur compris' : '') +
                "), la CET et la tranche 2 de retraite complémentaire s'ajoutent.",
            }
          : null,
    },
  ];

  const seuils: Seuil[] = [];
  for (const regle of regles) {
    for (let i = 1; i < grille.length; i++) {
      const avant = grille[i - 1];
      const apres = grille[i];
      if (regle.etat(avant.resultat) === regle.etat(apres.resultat)) continue;
      const etatAvant = regle.etat(avant.resultat);
      let bas = avant.brut;
      let haut = apres.brut;
      let resultatHaut = apres.resultat;
      for (let k = 0; k < 30; k++) {
        const milieu = (bas + haut) / 2;
        const r = simuler({ ...h, brutAnnuel: milieu });
        if (regle.etat(r) === etatAvant) bas = milieu;
        else {
          haut = milieu;
          resultatHaut = r;
        }
      }
      const seuil = regle.seuil(resultatHaut);
      if (seuil) seuils.push({ brut: haut, ...seuil });
    }
  }
  return seuils.sort((a, b) => a.brut - b.brut);
}

/**
 * Sweeps every payable salary level and returns the take-home curve together
 * with the optimum and the levels where the curve bends. The salary level is
 * the swept variable, so it is not part of the expected assumptions.
 */
export function balayer(
  h: Omit<Hypotheses, 'brutAnnuel'>,
  pas = 61,
): {
  points: { brut: number; net: number; resultat: Resultat }[];
  optimum: Resultat;
  plateau: Plateau;
  seuils: Seuil[];
} {
  const brutMax = brutMaxPourBudget(
    budgetRemuneration(h),
    h.tauxATMP,
    h.moisRemuneration,
    h.salaireExterneBrut,
  );
  const points = Array.from({ length: pas }, (_, i) => {
    const brut = (brutMax * i) / (pas - 1);
    const resultat = simuler({ ...h, brutAnnuel: brut });
    return { brut, net: resultat.critere, resultat };
  });

  // Refine around the best point of the grid.
  let meilleur = points[0];
  for (const p of points) if (p.net > meilleur.net) meilleur = p;

  const largeur = brutMax / (pas - 1);
  let optimum = meilleur.resultat;
  for (let i = 0; i <= 40; i++) {
    const brut = Math.max(
      0,
      Math.min(brutMax, meilleur.brut - largeur + (2 * largeur * i) / 40),
    );
    const r = simuler({ ...h, brutAnnuel: brut });
    if (r.critere > optimum.critere) optimum = r;
  }

  return {
    points,
    optimum,
    plateau: plateauOptimum(h, optimum, brutMax),
    seuils: seuilsCourbe(h, points),
  };
}
