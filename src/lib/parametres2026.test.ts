import { describe, expect, it } from 'vitest';
import * as P from './parametres2026';

/** Every exported parameter: values, not types, functions or the registry. */
const PARAMETRES = Object.entries(P)
  .filter(([, v]) => typeof v !== 'function')
  .map(([nom]) => nom)
  .filter((nom) => nom !== 'VALIDITE_PARAMETRES');

const couverts = P.VALIDITE_PARAMETRES.flatMap((v) => v.constantes);

describe('validité des paramètres', () => {
  it('rattache chaque paramètre exporté à exactement une date de validité', () => {
    // A parameter added without a date would never turn stale in CI.
    expect(PARAMETRES.filter((nom) => !couverts.includes(nom))).toEqual([]);
    expect(couverts.filter((nom, i) => couverts.indexOf(nom) !== i)).toEqual([]);
    expect(couverts.filter((nom) => !PARAMETRES.includes(nom))).toEqual([]);
  });

  it('écrit chaque date au format AAAA-MM-JJ et cite une source', () => {
    for (const v of P.VALIDITE_PARAMETRES) {
      if (v.valableJusquau !== null) {
        expect(v.valableJusquau, v.constantes.join(', ')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
      expect(v.source, v.constantes.join(', ')).toMatch(/^https:\/\//);
    }
  });

  it('repère les paramètres périmés à une date donnée', () => {
    expect(P.parametresPerimes('2026-10-31')).toEqual([]);
    expect(P.parametresPerimes('2026-11-01').flatMap((v) => v.constantes)).toEqual([
      'VALEUR_POINT_AGIRC_ARRCO',
    ]);
    // A convention never goes stale.
    expect(
      P.parametresPerimes('2100-01-01').flatMap((v) => v.constantes),
    ).not.toContain('TOLERANCE_OPTIMUM');
  });

  it('prend le jour à Paris, où les textes changent à minuit', () => {
    // 23:30 UTC on 31 October is already 1 November in Paris.
    expect(P.aujourdhuiAParis(new Date('2026-10-31T23:30:00Z'))).toBe('2026-11-01');
  });
});

// The clock-dependent check: CI goes red the day a parameter expires.
describe(`paramètres en vigueur au ${P.aujourdhuiAParis()}`, () => {
  const jour = P.aujourdhuiAParis();
  for (const v of P.VALIDITE_PARAMETRES.filter((e) => e.valableJusquau !== null)) {
    it(`${v.constantes.join(', ')} — valable jusqu'au ${v.valableJusquau}`, () => {
      expect(
        jour <= v.valableJusquau!,
        `Paramètre périmé : ${v.constantes.join(', ')} (valable jusqu'au ${v.valableJusquau}). ` +
          `À vérifier : ${v.aVerifier} Source : ${v.source}`,
      ).toBe(true);
    });
  }
});
