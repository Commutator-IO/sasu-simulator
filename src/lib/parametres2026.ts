/**
 * Paramètres fiscaux et sociaux applicables en 2026.
 *
 * Sources :
 *  - PASS 2026 : 48 060 € / an, 4 005 € / mois (Urssaf, arrêté du 15/12/2025)
 *  - Taux de droit commun 2026 maladie 13 % et allocations familiales 5,25 %
 *    (la réduction de taux est remplacée au 01/01/2026 par la RGDU, dont les
 *    mandataires sociaux ne bénéficient pas — cf. `RGDU` plus bas)
 *  - Agirc-Arrco 2026 : T1 7,87 %, T2 21,59 %, CEG 2,15 % / 2,70 %, CET 0,35 %
 *    répartition 60 % employeur / 40 % salarié
 *  - Barème IR 2026 (revenus 2025), loi de finances 2026 du 19/02/2026
 *  - IS : 15 % jusqu'à 42 500 € puis 25 %
 *  - PFU : 12,8 % IR + 18,6 % prélèvements sociaux, soit 31,4 % depuis la
 *    LFSS 2026 (loi n° 2025-1403 du 30 décembre 2025, art. 12)
 */

export const ANNEE = 2026;

/** Plafond annuel de la sécurité sociale. */
export const PASS = 48_060;
/** Plafond mensuel. */
export const PMSS = 4_005;

/** Smic horaire brut au 1er janvier 2026. */
export const SMIC_HORAIRE = 11.88;
/** Smic mensuel brut (35 h) au 1er janvier 2026. */
export const SMIC_MENSUEL = 1_823.03;

// ---------------------------------------------------------------------------
// Cotisations sociales — président de SASU (assimilé salarié)
// ---------------------------------------------------------------------------

/**
 * Assiettes possibles :
 *  - `totalite`  : totalité du brut
 *  - `t1`        : tranche 1, de 0 à 1 PASS
 *  - `t2`        : tranche 2, de 1 à 8 PASS
 *  - `tranche_a_4pass` : de 0 à 4 PASS (Apec)
 *  - `totalite_si_sup_pass` : totalité du brut, uniquement si brut > 1 PASS (CET)
 */
export type Assiette =
  | 'totalite'
  | 't1'
  | 't2'
  | 'tranche_a_4pass'
  | 'totalite_si_sup_pass';

export type Cotisation = {
  /** Libellé affiché dans le détail. */
  libelle: string;
  /** Regroupement pour le tableau de synthèse. */
  famille: 'Sécurité sociale' | 'Retraite complémentaire' | 'Autres' | 'CSG-CRDS';
  /** Taux patronal en %. */
  patronal: number;
  /** Taux salarial en %. */
  salarial: number;
  assiette: Assiette;
  /** Le président de SASU ne cotise pas au chômage : conservé pour mémoire. */
  exclu?: boolean;
  note?: string;
};

/**
 * Le président de SASU est affilié au régime général mais **sans assurance
 * chômage** (pas de contrat de travail). Il est également exclu de la réduction
 * générale dégressive unique (RGDU), réservée aux salariés relevant de
 * l'assurance chômage : les taux maladie et allocations familiales s'appliquent
 * donc à leur niveau de droit commun quelle que soit la rémunération.
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

/** Taux AT/MP par défaut (bureau / activité tertiaire). Paramétrable. */
export const AT_MP_DEFAUT = 1.3;

// --- CSG / CRDS -------------------------------------------------------------

/** Abattement pour frais professionnels sur l'assiette CSG-CRDS. */
export const CSG_ABATTEMENT = 0.0175;
/** L'abattement de 1,75 % est plafonné à 4 PASS. */
export const CSG_ABATTEMENT_PLAFOND = 4 * PASS;
export const CSG_DEDUCTIBLE = 6.8;
export const CSG_NON_DEDUCTIBLE = 2.4;
export const CRDS = 0.5;

// ---------------------------------------------------------------------------
// Impôt sur les sociétés
// ---------------------------------------------------------------------------

export const IS_SEUIL_TAUX_REDUIT = 42_500;
export const IS_TAUX_REDUIT = 0.15;
export const IS_TAUX_NORMAL = 0.25;

// ---------------------------------------------------------------------------
// Impôt sur le revenu — barème 2026 (revenus 2025)
// ---------------------------------------------------------------------------

export const BAREME_IR: { plafond: number; taux: number }[] = [
  { plafond: 11_600, taux: 0 },
  { plafond: 29_579, taux: 0.11 },
  { plafond: 84_577, taux: 0.3 },
  { plafond: 181_917, taux: 0.41 },
  { plafond: Infinity, taux: 0.45 },
];

/** Déduction forfaitaire de 10 % pour frais professionnels. */
export const ABATTEMENT_SALAIRE = 0.1;
export const ABATTEMENT_SALAIRE_MIN = 508;
export const ABATTEMENT_SALAIRE_MAX = 14_556;

/** Décote : montant forfaitaire et taux. */
export const DECOTE_CELIBATAIRE = 897;
export const DECOTE_COUPLE = 1_483;
export const DECOTE_TAUX = 0.4525;

/** Plafonnement du quotient familial, par demi-part supplémentaire. */
export const PLAFOND_DEMI_PART = 1_807;

// ---------------------------------------------------------------------------
// Prélèvement à la source
// ---------------------------------------------------------------------------

/**
 * Le taux est arrondi à la décimale la plus proche, exprimé en pourcentage
 * (CGI art. 204 H et BOI-IR-PAS-20-20-10) : 6,85 % devient 6,9 %.
 */
export const PAS_ARRONDI = 0.001;

/**
 * Revenu fiscal de référence en deçà duquel on peut demander une dispense du
 * prélèvement forfaitaire non libératoire de 12,8 % sur les dividendes
 * (CGI art. 242 quater).
 */
export const DISPENSE_PFNL_CELIBATAIRE = 50_000;
export const DISPENSE_PFNL_COUPLE = 75_000;

// ---------------------------------------------------------------------------
// Dividendes
// ---------------------------------------------------------------------------

export const PFU_IR = 0.128;

/**
 * Prélèvements sociaux sur les revenus du capital mobilier : 18,6 % depuis le
 * 1ᵉʳ janvier 2026, contre 17,2 % auparavant.
 *
 * L'article 12 de la LFSS 2026 (loi n° 2025-1403 du 30 décembre 2025) porte la
 * CSG sur le capital mobilier de 9,2 % à 10,6 %, soit :
 *
 *   CSG 10,6 % + CRDS 0,5 % + prélèvement de solidarité 7,5 % = 18,6 %
 *
 * Le PFU passe donc de 30 % à **31,4 %**. Attention, la hausse ne concerne que
 * le capital mobilier : l'assurance-vie, les PEL-CEL, les revenus fonciers et
 * les plus-values immobilières restent à 17,2 %, et la CSG sur les revenus
 * d'activité reste à 9,2 % (cf. `CSG_DEDUCTIBLE` et `CSG_NON_DEDUCTIBLE`).
 */
export const PRELEVEMENTS_SOCIAUX = 0.186;
export const PFU_TOTAL = PFU_IR + PRELEVEMENTS_SOCIAUX;

/** Abattement de 40 % en cas d'option pour le barème progressif. */
export const ABATTEMENT_DIVIDENDES = 0.4;

/**
 * Part de CSG déductible du revenu global sur les dividendes au barème.
 * La hausse de 1,4 point de la CSG n'a pas été suivie d'une hausse de la
 * fraction déductible : elle reste fixée à 6,8 points.
 */
export const CSG_DEDUCTIBLE_DIVIDENDES = 0.068;

// ---------------------------------------------------------------------------
// Repère de marché — baromètre Malt
// ---------------------------------------------------------------------------

/**
 * Tarif journalier moyen constaté par Malt pour les profils tech en 2026.
 * https://www.malt.fr/t/barometre-tarifs/tech/
 */
export const TJM_MOYEN_MALT = 520;

/**
 * Base de jours retenue par le baromètre Malt : 251 jours ouvrés moins cinq
 * semaines de congés. C'est une hypothèse de plein emploi — un freelance
 * facture en pratique plutôt 180 à 216 jours.
 */
export const JOURS_FACTURES_MALT = 226;

/** Frais de fonctionnement, également retenus à 10 % par le baromètre Malt. */
export const TAUX_FRAIS_REFERENCE = 0.1;

/**
 * Valeur par défaut du simulateur : le chiffre d'affaires d'un TJM moyen Malt
 * sur une année pleine, diminué des frais, arrondi au millier.
 */
export const RESULTAT_PAR_DEFAUT =
  Math.round(
    (TJM_MOYEN_MALT * JOURS_FACTURES_MALT * (1 - TAUX_FRAIS_REFERENCE)) / 1_000,
  ) * 1_000;

/**
 * Écart annuel de net en poche en deçà duquel deux niveaux de rémunération
 * sont tenus pour équivalents.
 *
 * L'optimum est un maximum : la courbe y est plate, et le net varie donc de
 * façon quadratique autour de ce point. Concrètement, s'écarter de 2 000 € de
 * l'optimum ne coûte qu'une soixantaine d'euros. Annoncer un point unique
 * serait trompeur ; on affiche une plage.
 */
export const TOLERANCE_OPTIMUM = 100;

/** Tarif journalier qu'implique un résultat donné, à jours et frais constants. */
export function tjmEquivalent(resultatAvantRemuneration: number): number {
  return (
    resultatAvantRemuneration / (JOURS_FACTURES_MALT * (1 - TAUX_FRAIS_REFERENCE))
  );
}

// ---------------------------------------------------------------------------
// Retraite
// ---------------------------------------------------------------------------

/** Un trimestre est validé par tranche de 150 × Smic horaire de salaire brut. */
export const BRUT_PAR_TRIMESTRE = 150 * SMIC_HORAIRE;
/** Salaire de référence Agirc-Arrco 2026 (prix d'achat d'un point). */
export const SALAIRE_REFERENCE_AGIRC_ARRCO = 20.1877;
/** Valeur de service du point Agirc-Arrco en 2026. */
export const VALEUR_POINT_AGIRC_ARRCO = 1.4386;
/** Taux de calcul des points (hors taux d'appel de 127 %). */
export const TAUX_POINTS_T1 = 0.062;
export const TAUX_POINTS_T2 = 0.17;
