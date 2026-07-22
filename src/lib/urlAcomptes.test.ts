import { describe, expect, it } from 'vitest';
import { decoderAcomptes, encoderAcomptes } from './urlAcomptes';
import { DEFAUTS_ACOMPTES, type HypothesesAcomptes } from './acomptes';

const D = DEFAUTS_ACOMPTES;
const avec = (modifs: Partial<HypothesesAcomptes>): HypothesesAcomptes => ({
  ...D,
  ...modifs,
});

describe('encodage des acomptes', () => {
  it('ne produit aucun paramètre pour un état par défaut', () => {
    expect(encoderAcomptes(D, D)).toBe('');
  });

  it('n’écrit que ce qui diffère', () => {
    expect(encoderAcomptes(avec({ moduler: !D.moduler }), D)).toBe(
      `?moduler=${D.moduler ? '0' : '1'}`,
    );
  });

  it('n’écrit pas de décimales parasites', () => {
    expect(encoderAcomptes(avec({ beneficePrecedent: 120_000.4 }), D)).toBe(
      '?precedent=120000',
    );
  });
});

describe('aller-retour', () => {
  it('restitue un état complet', () => {
    const etat = avec({
      beneficePrecedent: 250_000,
      beneficeAvantDernier: 310_000,
      beneficePrevisionnel: 40_000,
      eligibleISReduit: false,
      premierExercice: true,
      moduler: false,
    });
    expect(decoderAcomptes(encoderAcomptes(etat, D), D)).toEqual(etat);
  });

  it('restitue les valeurs par défaut depuis une URL vide', () => {
    expect(decoderAcomptes('', D)).toEqual(D);
    expect(decoderAcomptes('?', D)).toEqual(D);
  });

  it('survit à un aller-retour répété', () => {
    const un = decoderAcomptes(
      encoderAcomptes(avec({ beneficePrevisionnel: 12_345 }), D),
      D,
    );
    expect(decoderAcomptes(encoderAcomptes(un, D), D)).toEqual(un);
  });
});

describe('robustesse face à une URL trafiquée', () => {
  it('ignore les valeurs non numériques et les infinis', () => {
    const r = decoderAcomptes('?precedent=abc&previsionnel=Infinity', D);
    expect(r.beneficePrecedent).toBe(D.beneficePrecedent);
    expect(Number.isFinite(r.beneficePrevisionnel)).toBe(true);
  });

  it('borne les valeurs négatives et démesurées', () => {
    const r = decoderAcomptes('?precedent=-9000&avantDernier=99999999999999', D);
    expect(r.beneficePrecedent).toBe(0);
    expect(r.beneficeAvantDernier).toBeLessThanOrEqual(100_000_000);
  });

  it('rejette un booléen incompréhensible', () => {
    expect(decoderAcomptes('?moduler=peut-être', D).moduler).toBe(D.moduler);
    expect(decoderAcomptes('?moduler=0', D).moduler).toBe(false);
    expect(decoderAcomptes('?moduler=true', D).moduler).toBe(true);
  });

  it('ignore les paramètres inconnus', () => {
    expect(decoderAcomptes('?inconnu=1', D)).toEqual(D);
  });
});
