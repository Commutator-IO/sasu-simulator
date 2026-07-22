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
  /** Share of after-tax profit paid out as dividends (0 → 1). */
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
  /** Band 1 ceiling actually applicable, prorated. */
  plafondTranche1: number;
  cotisationsPatronales: number;
  coutEmployeur: number;
  resultatFiscal: number;
  is: number;
  resultatNet: number;
  reserves: number;

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

  // Summary
  netEnPoche: number;
  totalPrelevements: number;
  tauxPrelevementGlobal: number;

  // Social entitlements
  trimestresValides: number;
  /** Pension quarters already earned by the outside salary alone. */
  trimestresExterne: number;
  pointsAgircArrco: number;
  retraiteComplementaireAnnuelle: number;
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
export function assietteCSG(brut: number, moisRemuneration = 12): number {
  const plafond = 4 * plafondTranche1(moisRemuneration);
  const partAbattue = Math.min(brut, plafond);
  const partNonAbattue = Math.max(0, brut - plafond);
  return partAbattue * (1 - P.CSG_ABATTEMENT) + partNonAbattue;
}

export function calculerCotisations(
  brut: number,
  tauxATMP: number,
  moisRemuneration = 12,
): LigneCotisation[] {
  const plafond = plafondTranche1(moisRemuneration);
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

  const baseCSG = assietteCSG(brut, moisRemuneration);
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
): number {
  const lignes = calculerCotisations(brut, tauxATMP, moisRemuneration);
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
): number {
  if (budget <= 0) return 0;
  let bas = 0;
  let haut = budget;
  for (let i = 0; i < 60; i++) {
    const milieu = (bas + haut) / 2;
    if (coutEmployeur(milieu, tauxATMP, moisRemuneration) > budget) haut = milieu;
    else bas = milieu;
  }
  return bas;
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
): {
  cotisationsHorsCSG: number;
  csgCrds: number;
  csgDeductible: number;
  net: number;
  netImposableAvantAbattement: number;
} {
  const lignes = calculerCotisations(Math.max(0, brut), 0, moisRemuneration);
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
  const lignes = calculerCotisations(brut, h.tauxATMP, mois);
  const cotisationsPatronales = lignes.reduce((s, l) => s + l.patronal, 0);
  const cout = brut + cotisationsPatronales;
  const resultatFiscal = h.resultatAvantRemuneration - cout;
  const is = calculerIS(resultatFiscal, h.eligibleISReduit);
  const resultatNet = resultatFiscal - is;

  const distribuable = Math.max(0, resultatNet);
  const dividendesBruts = distribuable * h.tauxDistribution;
  const reserves = resultatNet - dividendesBruts;

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
  const externeBrut = Math.max(0, h.salaireExterneBrut);
  const externe = decomposerSalaire(externeBrut);

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

  // Two bases: the household as it stands, and the household without the
  // president's salary. The difference isolates the tax that salary actually
  // causes — tax owed on an outside job or on a partner's income must not be
  // charged to the company.
  const baseHorsDividendes = salairesImposables + h.autresRevenus;
  const baseSansRemuneration = salaireExterneNetImposable + h.autresRevenus;
  const irHorsDividendes = calculerIR(baseHorsDividendes, h.parts, h.couple);
  const irSansRemuneration = calculerIR(baseSansRemuneration, h.parts, h.couple);

  if (h.dividendesAuBareme) {
    const dividendesImposables =
      dividendesBruts * (1 - P.ABATTEMENT_DIVIDENDES) -
      dividendesBruts * P.CSG_DEDUCTIBLE_DIVIDENDES;
    revenuImposable = baseHorsDividendes + Math.max(0, dividendesImposables);
    irFoyer = calculerIR(revenuImposable, h.parts, h.couple);
    irDividendes = irFoyer - irHorsDividendes;
  } else {
    revenuImposable = baseHorsDividendes;
    irDividendes = dividendesBruts * P.PFU_IR;
    irFoyer = irHorsDividendes + irDividendes;
  }
  irSurSalaire = irHorsDividendes - irSansRemuneration;
  const irTotal = irSurSalaire + irDividendes;

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
  const netEnPoche = salaireNet + dividendesNets - irSurSalaire;
  const totalPrelevements =
    cotisationsPatronales +
    cotisationsSalariales +
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
  const t1 = Math.min(brut, plafond);
  const t2 = Math.max(0, Math.min(brut, 8 * plafond) - plafond);
  const pointsAgircArrco =
    (t1 * P.TAUX_POINTS_T1 + t2 * P.TAUX_POINTS_T2) / P.SALAIRE_REFERENCE_AGIRC_ARRCO;
  const retraiteComplementaireAnnuelle = pointsAgircArrco * P.VALEUR_POINT_AGIRC_ARRCO * 12;

  return {
    resultatAvantRemuneration: h.resultatAvantRemuneration,
    brutAnnuel: brut,
    moisRemuneration: mois,
    plafondTranche1: plafond,
    cotisationsPatronales,
    coutEmployeur: cout,
    resultatFiscal,
    is,
    resultatNet,
    reserves,
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
    netEnPoche,
    totalPrelevements,
    tauxPrelevementGlobal,
    trimestresValides,
    trimestresExterne,
    pointsAgircArrco,
    retraiteComplementaireAnnuelle,
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
  const seuil = optimum.netEnPoche - tolerance;
  const net = (brut: number) => simuler({ ...h, brutAnnuel: brut }).netEnPoche;

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

/**
 * Sweeps every payable salary level and returns the take-home curve together
 * with the optimum. The salary level is the swept variable, so it is not part
 * of the expected assumptions.
 */
export function balayer(
  h: Omit<Hypotheses, 'brutAnnuel'>,
  pas = 61,
): {
  points: { brut: number; net: number; resultat: Resultat }[];
  optimum: Resultat;
  plateau: Plateau;
} {
  const brutMax = brutMaxPourBudget(
    h.resultatAvantRemuneration,
    h.tauxATMP,
    h.moisRemuneration,
  );
  const points = Array.from({ length: pas }, (_, i) => {
    const brut = (brutMax * i) / (pas - 1);
    const resultat = simuler({ ...h, brutAnnuel: brut });
    return { brut, net: resultat.netEnPoche, resultat };
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
    if (r.netEnPoche > optimum.netEnPoche) optimum = r;
  }

  return { points, optimum, plateau: plateauOptimum(h, optimum, brutMax) };
}
