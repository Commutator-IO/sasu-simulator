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

/**
 * One consolidated scenario across the three tools, for the synthesis deck.
 *
 * The three tools serialise into the same URL without key collisions (only
 * `isReduit` is shared, with the same meaning). This reads all three states
 * from a single query string, then reconciles them along the funnel
 * projection → arbitration → instalments so the deck tells one coherent story:
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
  /** Whether each tool's parameters were actually present in the URL. */
  aProjection: boolean;
  aArbitrage: boolean;
  aAcomptes: boolean;
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

const uneCle = (p: URLSearchParams, cles: string[]) => cles.some((c) => p.has(c));

/** Gross salary retained: the one carried in the URL, or the optimum. */
export function brutRetenu(recherche: string, arbitrage: EtatPartage): number {
  const p = new URLSearchParams(recherche);
  return p.has('brut') ? arbitrage.brut : balayer(arbitrage.base).optimum.brutAnnuel;
}

export function construireScenario(recherche: string): ScenarioSynthese {
  const p = new URLSearchParams(recherche);
  const projection = decoderProjection(recherche, DEFAUTS_PROJECTION);
  const arbitrage = decoderEtat(recherche, ETAT_ARBITRAGE_PAR_DEFAUT);
  const acomptes = decoderAcomptes(recherche, DEFAUTS_ACOMPTES);

  const aProjection = uneCle(p, CLES_PROJECTION);
  const aArbitrage = uneCle(p, CLES_ARBITRAGE);
  const aAcomptes = uneCle(p, CLES_ACOMPTES);

  // 1. The projected result before remuneration drives the arbitration input,
  //    unless the arbitration carries its own explicit result.
  if (aProjection && !p.has('resultat')) {
    arbitrage.base.resultatAvantRemuneration = Math.max(
      0,
      calculerProjection(projection).resultatAvantRemuneration,
    );
  }

  // 2. The forecast profit for the instalments is the *taxable* result, after
  //    the president's pay — which the arbitration knows. Only when an upstream
  //    tool was actually used and the forecast is not set explicitly; a deck
  //    touching the instalments alone keeps their own figure.
  if ((aProjection || aArbitrage) && !p.has('previsionnel')) {
    const brut = brutRetenu(recherche, arbitrage);
    acomptes.beneficePrevisionnel = Math.max(
      0,
      simuler({ ...arbitrage.base, brutAnnuel: brut }).resultatFiscal,
    );
  }

  return { projection, arbitrage, acomptes, aProjection, aArbitrage, aAcomptes };
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
  const brutChoisi = brutRetenu(recherche, scenario.arbitrage);
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
