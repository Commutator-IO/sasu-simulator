import {
  DEFAUTS_PROJECTION,
  calculerProjection,
  type HypothesesProjection,
  type ResultatProjection,
} from './projection';
import { decoderProjection } from './urlProjection';
import { balayer, simuler, type Resultat } from './simulation';
import { decoderEtat, type EtatPartage } from './url';
import { ETAT_ARBITRAGE_PAR_DEFAUT } from './arbitrage';
import {
  DEFAUTS_ACOMPTES,
  calculerAcomptes,
  type HypothesesAcomptes,
  type ResultatAcomptes,
} from './acomptes';
import { decoderAcomptes } from './urlAcomptes';
import { CLE_PROJECTION, CLE_ARBITRAGE, CLE_ACOMPTES } from './persistance';

/**
 * One consolidated scenario across the three tools, for the synthesis deck.
 *
 * Each tool's state comes from the URL when it carries that tool's keys — a
 * shared or deep link reproduces its scenario — otherwise from what the tool
 * last saved in the browser. So a deck opened without parameters still shows
 * the work done in the tools, not the defaults.
 *
 * The states are then reconciled along the funnel projection → arbitration →
 * instalments so the deck tells one coherent story:
 *
 *  - the projected result before remuneration feeds the arbitration input;
 *  - the arbitration, knowing the salary, yields the *taxable* result, which
 *    is the honest forecast profit for the instalments — closing the
 *    approximation the individual bridges leave open.
 */

export type ScenarioSynthese = {
  projection: HypothesesProjection;
  arbitrage: EtatPartage;
  acomptes: HypothesesAcomptes;
  /** Whether each tool was actually used (URL keys, or a saved state). */
  aProjection: boolean;
  aArbitrage: boolean;
  aAcomptes: boolean;
  /** True when a gross salary was chosen; otherwise the optimum is used. */
  brutExplicite: boolean;
};

const CLES_PROJECTION = ['ca', 'moisFactures', 'fraisMensuels', 'tauxVariable'];
const CLES_ARBITRAGE = [
  'resultat',
  'brut',
  'mois',
  'parts',
  'couple',
  'salaireExterne',
  'autresRevenus',
  'reserves',
  'distribution',
  'atmp',
  'bareme',
];
const CLES_ACOMPTES = [
  'precedent',
  'moisPrecedent',
  'avantDernier',
  'moisAvantDernier',
  'previsionnel',
  'premierExercice',
  'strategie',
  'versement',
  'passees',
  'verses',
];

/**
 * The state string for one tool: the URL when it carries the tool's keys,
 * otherwise the value it last saved in the browser. Empty outside a browser
 * (tests), which falls back to the tool's defaults.
 */
function sourceOutil(recherche: string, cles: string[], cleStockage: string): string {
  const p = new URLSearchParams(recherche);
  if (cles.some((c) => p.has(c))) return recherche;
  try {
    if (typeof localStorage !== 'undefined') return localStorage.getItem(cleStockage) ?? '';
  } catch {
    // Storage unavailable: fall back to defaults.
  }
  return '';
}

export function construireScenario(recherche: string): ScenarioSynthese {
  const srcProjection = sourceOutil(recherche, CLES_PROJECTION, CLE_PROJECTION);
  const srcArbitrage = sourceOutil(recherche, CLES_ARBITRAGE, CLE_ARBITRAGE);
  const srcAcomptes = sourceOutil(recherche, CLES_ACOMPTES, CLE_ACOMPTES);

  const projection = decoderProjection(srcProjection, DEFAUTS_PROJECTION);
  const arbitrage = decoderEtat(srcArbitrage, ETAT_ARBITRAGE_PAR_DEFAUT);
  const acomptes = decoderAcomptes(srcAcomptes, DEFAUTS_ACOMPTES);

  const aProjection = srcProjection !== '';
  const aArbitrage = srcArbitrage !== '';
  const aAcomptes = srcAcomptes !== '';

  const pArb = new URLSearchParams(srcArbitrage);
  const pAco = new URLSearchParams(srcAcomptes);
  const brutExplicite = pArb.has('brut');

  // 1. The projected result before remuneration drives the arbitration input,
  //    unless the arbitration carries its own explicit result.
  if (aProjection && !pArb.has('resultat')) {
    arbitrage.base.resultatAvantRemuneration = Math.max(
      0,
      calculerProjection(projection).resultatAvantRemuneration,
    );
  }

  // 2. The forecast profit for the instalments is the *taxable* result, after
  //    the president's pay — which the arbitration knows. Only when an upstream
  //    tool was actually used and the forecast is not set explicitly; a deck
  //    touching the instalments alone keeps their own figure.
  if ((aProjection || aArbitrage) && !pAco.has('previsionnel')) {
    const brut = brutExplicite
      ? arbitrage.brut
      : balayer(arbitrage.base).optimum.brutAnnuel;
    acomptes.beneficePrevisionnel = Math.max(
      0,
      simuler({ ...arbitrage.base, brutAnnuel: brut }).resultatFiscal,
    );
  }

  return {
    projection,
    arbitrage,
    acomptes,
    aProjection,
    aArbitrage,
    aAcomptes,
    brutExplicite,
  };
}

export type PartRepartition = { label: string; montant: number };

export type Synthese = {
  scenario: ScenarioSynthese;
  projection: ResultatProjection;
  balayage: ReturnType<typeof balayer>;
  brutChoisi: number;
  arbitrage: Resultat;
  acomptes: ResultatAcomptes;
  /**
   * Where the result before remuneration (plus any prior reserves) goes. The
   * parts sum to that total, by the accounting identity of the engine.
   */
  repartition: PartRepartition[];
};

export function calculerSynthese(recherche: string): Synthese {
  const scenario = construireScenario(recherche);
  const projection = calculerProjection(scenario.projection);
  const balayage = balayer(scenario.arbitrage.base);
  const brutChoisi = scenario.brutExplicite
    ? scenario.arbitrage.brut
    : balayage.optimum.brutAnnuel;
  const arbitrage = simuler({ ...scenario.arbitrage.base, brutAnnuel: brutChoisi });
  const acomptes = calculerAcomptes(scenario.acomptes);

  const repartition: PartRepartition[] = [
    { label: 'Net en poche', montant: arbitrage.netEnPoche },
    {
      label: 'Cotisations sociales',
      montant: arbitrage.cotisationsPatronales + arbitrage.cotisationsSalariales,
    },
    { label: 'Impôt sur les sociétés', montant: arbitrage.is },
    { label: 'Impôt sur le revenu', montant: arbitrage.irTotal },
    {
      label: 'Prélèvements sociaux (dividendes)',
      montant: arbitrage.prelevementsSociauxDividendes,
    },
    { label: 'Mis en réserve', montant: arbitrage.reserves },
  ];

  return { scenario, projection, balayage, brutChoisi, arbitrage, acomptes, repartition };
}
