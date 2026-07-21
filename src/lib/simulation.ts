import * as P from './parametres2026';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Hypotheses = {
  /** Résultat de l'exercice avant toute rémunération du président (CA − charges). */
  resultatAvantRemuneration: number;
  /** Rémunération brute annuelle du président. */
  brutAnnuel: number;
  /**
   * Nombre de mois de mandat dans l'année, qui proratise les plafonds de
   * cotisation : une société créée en juillet n'ouvre droit qu'à six plafonds
   * mensuels.
   *
   * Attention, c'est bien la durée de la **période d'emploi** qui proratise le
   * plafond, et non le rythme des versements : un président en poste toute
   * l'année qui se rémunère irrégulièrement conserve un plafond annuel entier,
   * la régularisation progressive recalculant les cotisations plafonnées de
   * façon cumulative depuis janvier.
   */
  moisRemuneration: number;
  /** Part du résultat net distribuée en dividendes (0 → 1). */
  tauxDistribution: number;
  /** Nombre de parts du foyer fiscal. */
  parts: number;
  /** Le foyer est-il un couple soumis à imposition commune ? (décote) */
  couple: boolean;
  /** Autres revenus nets imposables du foyer (salaire du conjoint, foncier…). */
  autresRevenus: number;
  /**
   * Salaire brut annuel que le président perçoit d'un autre employeur — un
   * emploi à temps partiel mené en parallèle de la SASU, typiquement.
   */
  salaireExterneBrut: number;
  /** Taux AT/MP de l'entreprise, en %. */
  tauxATMP: number;
  /** La société est-elle éligible au taux réduit d'IS à 15 % ? */
  eligibleISReduit: boolean;
  /** Option pour le barème progressif sur les dividendes (au lieu du PFU). */
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
  // Volet société
  resultatAvantRemuneration: number;
  brutAnnuel: number;
  moisRemuneration: number;
  /** Plafond de tranche 1 effectivement applicable, proratisé. */
  plafondTranche1: number;
  cotisationsPatronales: number;
  coutEmployeur: number;
  resultatFiscal: number;
  is: number;
  resultatNet: number;
  reserves: number;

  // Volet rémunération
  lignes: LigneCotisation[];
  cotisationsSalariales: number;
  csgCrds: number;
  csgDeductible: number;
  salaireNet: number;
  salaireNetImposable: number;

  // Volet dividendes
  dividendesBruts: number;
  prelevementsSociauxDividendes: number;
  irDividendes: number;
  dividendesNets: number;

  // Volet salaire extérieur
  salaireExterneBrut: number;
  salaireExterneNet: number;
  salaireExterneNetImposable: number;

  // Volet impôt sur le revenu
  revenuImposable: number;
  /** Impôt sur le revenu et PFU imputables à la SASU seule. */
  irTotal: number;
  /** Impôt supplémentaire causé par la rémunération de président. */
  irSurSalaire: number;
  /** Impôt du foyer, toutes ressources confondues. */
  irFoyer: number;
  tmi: number;

  // Prélèvement à la source
  /** Assiette de la seule rémunération de président. */
  assiettePAS: number;
  /** Assiette du foyer, salaire extérieur compris. */
  assiettePASFoyer: number;
  tauxPAS: number;
  /** Retenue mensuelle sur la seule paie de la SASU. */
  prelevementMensuelPAS: number;

  // Synthèse
  netEnPoche: number;
  totalPrelevements: number;
  tauxPrelevementGlobal: number;

  // Protection sociale
  trimestresValides: number;
  /** Trimestres déjà acquis par le seul salaire extérieur. */
  trimestresExterne: number;
  pointsAgircArrco: number;
  retraiteComplementaireAnnuelle: number;
};

// ---------------------------------------------------------------------------
// Cotisations sociales
// ---------------------------------------------------------------------------

/**
 * Plafond applicable à la tranche 1 : le plafond mensuel multiplié par le
 * nombre de mois de rémunération. Sur douze mois, on retombe exactement sur le
 * plafond annuel.
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
 * Assiette CSG-CRDS : 98,25 % du brut, l'abattement étant plafonné à quatre
 * fois le plafond applicable.
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

/** Coût total employeur (brut + cotisations patronales) pour un brut donné. */
export function coutEmployeur(
  brut: number,
  tauxATMP: number,
  moisRemuneration = 12,
): number {
  const lignes = calculerCotisations(brut, tauxATMP, moisRemuneration);
  return brut + lignes.reduce((s, l) => s + l.patronal, 0);
}

/**
 * Brut maximal versable pour un budget employeur donné.
 * Le coût employeur étant continu et strictement croissant en fonction du brut,
 * on inverse par dichotomie.
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
// Impôt sur les sociétés
// ---------------------------------------------------------------------------

export function calculerIS(resultatFiscal: number, eligibleTauxReduit: boolean): number {
  if (resultatFiscal <= 0) return 0;
  if (!eligibleTauxReduit) return resultatFiscal * P.IS_TAUX_NORMAL;
  const partReduite = Math.min(resultatFiscal, P.IS_SEUIL_TAUX_REDUIT);
  const partNormale = Math.max(0, resultatFiscal - P.IS_SEUIL_TAUX_REDUIT);
  return partReduite * P.IS_TAUX_REDUIT + partNormale * P.IS_TAUX_NORMAL;
}

// ---------------------------------------------------------------------------
// Impôt sur le revenu
// ---------------------------------------------------------------------------

/** Impôt brut issu du barème progressif, pour un revenu donné. */
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

/** Taux marginal d'imposition atteint par le revenu par part. */
export function tauxMarginal(revenuParPart: number): number {
  for (const tranche of P.BAREME_IR) {
    if (revenuParPart <= tranche.plafond) return tranche.taux;
  }
  return P.BAREME_IR[P.BAREME_IR.length - 1].taux;
}

/**
 * Impôt sur le revenu du foyer, quotient familial plafonné et décote appliqués.
 */
export function calculerIR(revenuImposable: number, parts: number, couple: boolean): number {
  if (revenuImposable <= 0) return 0;

  const partsDeBase = couple ? 2 : 1;
  const impotAvecQuotient = baremeIR(revenuImposable / parts) * parts;

  // Plafonnement de l'avantage lié aux demi-parts supplémentaires.
  const impotSansQuotient = baremeIR(revenuImposable / partsDeBase) * partsDeBase;
  const demiPartsSupp = Math.max(0, (parts - partsDeBase) * 2);
  const avantageMax = demiPartsSupp * P.PLAFOND_DEMI_PART;
  const avantage = impotSansQuotient - impotAvecQuotient;

  let impot =
    avantage > avantageMax ? impotSansQuotient - avantageMax : impotAvecQuotient;

  // Décote.
  const seuil = couple ? P.DECOTE_COUPLE : P.DECOTE_CELIBATAIRE;
  const decote = seuil - P.DECOTE_TAUX * impot;
  if (decote > 0) impot = Math.max(0, impot - decote);

  return Math.max(0, impot);
}

/**
 * Taux de prélèvement à la source du foyer (CGI art. 204 H).
 *
 *                 impôt au barème × (revenus dans le champ / revenu imposable)
 *   taux =    ────────────────────────────────────────────────────────────────
 *                       assiette du prélèvement (art. 204 F)
 *
 * L'assiette, elle, est le net imposable **avant** la déduction forfaitaire de
 * 10 % : c'est ce décalage qui fait que le taux paraît plus faible que le
 * rapport « impôt sur revenu imposable ». Le taux est arrondi à la décimale la
 * plus proche.
 *
 * @param irBareme        impôt du foyer issu du barème, avant réductions et
 *                        crédits d'impôt (le PFU sur dividendes en est exclu :
 *                        les revenus de capitaux mobiliers ne sont pas dans le
 *                        champ du prélèvement à la source)
 * @param revenuImposable revenu net imposable total du foyer
 * @param partDansLeChamp part de ce revenu imposable relevant du prélèvement
 * @param assiette        assiette du prélèvement, avant abattement de 10 %
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
 * Décompose un salaire brut du point de vue du salarié : cotisations retenues,
 * net à payer, et net imposable avant la déduction forfaitaire de 10 %.
 *
 * Sert aussi bien à la rémunération du président qu'à un salaire perçu chez un
 * autre employeur : côté salarial, les taux sont les mêmes (le président ne se
 * distingue que par l'absence de cotisation chômage, elle-même supprimée pour
 * les salariés depuis 2018).
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
    // La CSG non déductible et la CRDS restent dans l'assiette imposable.
    netImposableAvantAbattement: Math.max(
      0,
      brut - cotisationsHorsCSG - csgDeductible,
    ),
  };
}

/** Salaire net imposable après déduction forfaitaire de 10 %. */
export function abattementSalaire(netImposableAvantAbattement: number): number {
  const abattement = Math.min(
    Math.max(netImposableAvantAbattement * P.ABATTEMENT_SALAIRE, P.ABATTEMENT_SALAIRE_MIN),
    P.ABATTEMENT_SALAIRE_MAX,
  );
  return Math.max(0, netImposableAvantAbattement - abattement);
}

// ---------------------------------------------------------------------------
// Simulation complète
// ---------------------------------------------------------------------------

export function simuler(h: Hypotheses): Resultat {
  const brut = Math.max(0, h.brutAnnuel);
  const mois = bornerMois(h.moisRemuneration);

  // --- Société -------------------------------------------------------------
  const lignes = calculerCotisations(brut, h.tauxATMP, mois);
  const cotisationsPatronales = lignes.reduce((s, l) => s + l.patronal, 0);
  const cout = brut + cotisationsPatronales;
  const resultatFiscal = h.resultatAvantRemuneration - cout;
  const is = calculerIS(resultatFiscal, h.eligibleISReduit);
  const resultatNet = resultatFiscal - is;

  const distribuable = Math.max(0, resultatNet);
  const dividendesBruts = distribuable * h.tauxDistribution;
  const reserves = resultatNet - dividendesBruts;

  // --- Rémunération --------------------------------------------------------
  const csgCrdsLignes = lignes.filter((l) => l.famille === 'CSG-CRDS');
  const csgCrds = csgCrdsLignes.reduce((s, l) => s + l.salarial, 0);
  const csgDeductible =
    csgCrdsLignes.find((l) => l.libelle === 'CSG déductible')?.salarial ?? 0;
  const cotisationsSalarialesHorsCSG = lignes
    .filter((l) => l.famille !== 'CSG-CRDS')
    .reduce((s, l) => s + l.salarial, 0);
  const cotisationsSalariales = cotisationsSalarialesHorsCSG + csgCrds;

  const salaireNet = brut - cotisationsSalariales;
  // Net imposable = brut − cotisations déductibles − CSG déductible.
  // La CSG non déductible et la CRDS restent dans l'assiette imposable.
  const netImposableAvantAbattement = Math.max(
    0,
    brut - cotisationsSalarialesHorsCSG - csgDeductible,
  );

  // --- Salaire extérieur ---------------------------------------------------
  const externeBrut = Math.max(0, h.salaireExterneBrut);
  const externe = decomposerSalaire(externeBrut);

  // L'abattement de 10 % porte sur l'ensemble des salaires de la personne, et
  // son plafond ne joue qu'une fois : on ne peut donc pas abattre chaque
  // salaire séparément.
  const salairesImposables = abattementSalaire(
    netImposableAvantAbattement + externe.netImposableAvantAbattement,
  );
  const salaireExterneNetImposable = abattementSalaire(
    externe.netImposableAvantAbattement,
  );
  const salaireNetImposable = Math.max(0, salairesImposables - salaireExterneNetImposable);

  // --- Dividendes ----------------------------------------------------------
  const prelevementsSociauxDividendes = dividendesBruts * P.PRELEVEMENTS_SOCIAUX;

  let irDividendes: number;
  let revenuImposable: number;
  let irFoyer: number;
  let irSurSalaire: number;

  // Deux bases : celle du foyer tel qu'il est, et celle qu'il aurait sans la
  // rémunération de président. La différence isole l'impôt réellement causé
  // par cette rémunération — l'impôt dû sur un emploi extérieur ou sur les
  // revenus du conjoint n'a pas à être imputé à la SASU.
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

  // --- Prélèvement à la source ---------------------------------------------
  // Le taux est celui du foyer et s'applique à tous ses revenus dans le champ,
  // donc aux deux salaires. Les dividendes en sont exclus : ils relèvent du
  // prélèvement forfaitaire non libératoire de 12,8 % opéré par la société.
  const irBareme = h.dividendesAuBareme ? irFoyer : irHorsDividendes;
  const assiettePAS = netImposableAvantAbattement;
  const assiettePASFoyer = assiettePAS + externe.netImposableAvantAbattement;
  const tauxPAS = tauxPrelevementSource(
    irBareme,
    revenuImposable,
    salairesImposables,
    assiettePASFoyer,
  );
  // Ce que retient la SASU sur chacune de ses paies, l'autre employeur
  // retenant sa part de son côté au même taux.
  const prelevementMensuelPAS = (assiettePAS * tauxPAS) / mois;

  // --- Synthèse ------------------------------------------------------------
  const netEnPoche = salaireNet + dividendesNets - irSurSalaire;
  const totalPrelevements =
    cotisationsPatronales +
    cotisationsSalariales +
    is +
    prelevementsSociauxDividendes +
    irTotal;
  const assiette = h.resultatAvantRemuneration;
  const tauxPrelevementGlobal = assiette > 0 ? totalPrelevements / assiette : 0;

  // --- Protection sociale --------------------------------------------------
  // Les trimestres se comptent par personne, tous employeurs confondus, et
  // dépendent du salaire annuel, non du nombre de mois travaillés.
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

/**
 * Balaye tous les niveaux de rémunération possibles et retourne la courbe du
 * net en poche, ainsi que l'optimum. Le niveau de rémunération étant la
 * variable balayée, il ne fait pas partie des hypothèses attendues.
 */
export type Plateau = {
  /** Rémunération brute la plus basse restant dans la tolérance. */
  min: number;
  /** Rémunération brute la plus haute restant dans la tolérance. */
  max: number;
  /** Écart de net en poche accepté sur toute la plage. */
  tolerance: number;
};

/**
 * Plage de rémunérations dont le net en poche reste à `tolerance` près de
 * l'optimum.
 *
 * Le net croît puis décroît de part et d'autre de l'optimum : chaque borne se
 * trouve donc par dichotomie sur une branche monotone.
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
    // `depart` est dans la plage, `arrivee` en dehors.
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

  // Affinage autour du meilleur point de la grille.
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
