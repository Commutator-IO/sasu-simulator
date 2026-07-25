import { DEFAUTS_PROJECTION } from './projection';
import { encoderProjection } from './urlProjection';
import { encoderEtat } from './url';
import { ETAT_ARBITRAGE_PAR_DEFAUT } from './arbitrage';
import { DEFAUTS_ACOMPTES } from './acomptes';
import { encoderAcomptes } from './urlAcomptes';
import { minifier } from './compact';
import type { ScenarioSynthese } from './synthese';

/**
 * The synthesis link is the union of the three tools' own encodings: each only
 * writes what differs from its defaults, and merging their query strings
 * reproduces the whole scenario. `isReduit` is the only shared key, with the
 * same value, so the merge is safe.
 */
export function encoderSynthese(scenario: ScenarioSynthese): string {
  const params = new URLSearchParams();
  const fusionner = (requete: string) => {
    const source = new URLSearchParams(
      requete.startsWith('?') ? requete.slice(1) : requete,
    );
    source.forEach((valeur, cle) => params.set(cle, valeur));
  };

  fusionner(encoderProjection(scenario.projection, DEFAUTS_PROJECTION));
  fusionner(encoderEtat(scenario.arbitrage, ETAT_ARBITRAGE_PAR_DEFAUT));
  fusionner(encoderAcomptes(scenario.acomptes, DEFAUTS_ACOMPTES));

  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

/** Absolute URL that reopens this exact deck. */
export function lienPartageSynthese(scenario: ScenarioSynthese): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${minifier(encoderSynthese(scenario))}`;
}
