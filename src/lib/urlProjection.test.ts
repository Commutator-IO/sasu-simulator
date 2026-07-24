import { describe, expect, it } from 'vitest';
import {
  decoderProjection,
  encoderProjection,
  lienVersAcomptes,
  lienVersArbitrage,
} from './urlProjection';
import { DEFAUTS_PROJECTION, NB_MOIS, type HypothesesProjection } from './projection';

const D = DEFAUTS_PROJECTION;
const avec = (modifs: Partial<HypothesesProjection>): HypothesesProjection => ({
  ...D,
  ...modifs,
});

describe('encodage de la projection', () => {
  it('ne produit aucun paramètre pour un état par défaut', () => {
    expect(encoderProjection(D, D)).toBe('');
  });

  it('n’écrit que ce qui diffère', () => {
    expect(encoderProjection(avec({ moisFactures: 8 }), D)).toBe('?moisFactures=8');
    expect(encoderProjection(avec({ fraisMensuels: 1_500 }), D)).toBe('?fraisMensuels=1500');
  });

  it('encode la facturation mensuelle comme une liste', () => {
    // Comme la liste des versements passés des acomptes, les virgules sont
    // percent-encodées par URLSearchParams ; le décodage les restitue.
    const facturation = Array(NB_MOIS).fill(5_000);
    const requete = encoderProjection(avec({ facturation }), D);
    expect(decodeURIComponent(requete)).toBe(`?ca=${Array(NB_MOIS).fill(5_000).join(',')}`);
  });

  it('conserve trois décimales de taux', () => {
    expect(encoderProjection(avec({ tauxFraisVariables: 0.125 }), D)).toBe(
      '?tauxVariable=0.125',
    );
  });
});

describe('aller-retour', () => {
  it('restitue un état complet', () => {
    const facturation = [
      12_000, 8_000, 15_000, 9_000, 0, 0, 7_000, 7_000, 7_000, 7_000, 7_000, 7_000,
    ];
    const etat = avec({
      facturation,
      moisFactures: 4,
      fraisMensuels: 1_200,
      tauxFraisVariables: 0.08,
      eligibleISReduit: false,
    });
    expect(decoderProjection(encoderProjection(etat, D), D)).toEqual(etat);
  });

  it('restitue les valeurs par défaut depuis une URL vide', () => {
    expect(decoderProjection('', D)).toEqual(D);
    expect(decoderProjection('?', D)).toEqual(D);
  });

  it('survit à un aller-retour répété', () => {
    const un = decoderProjection(encoderProjection(avec({ moisFactures: 9 }), D), D);
    expect(decoderProjection(encoderProjection(un, D), D)).toEqual(un);
  });
});

describe('robustesse face à une URL trafiquée', () => {
  it('complète une liste de facturation trop courte avec les valeurs par défaut', () => {
    const r = decoderProjection('?ca=10000,20000', D);
    expect(r.facturation[0]).toBe(10_000);
    expect(r.facturation[1]).toBe(20_000);
    expect(r.facturation[2]).toBe(D.facturation[2]);
    expect(r.facturation).toHaveLength(NB_MOIS);
  });

  it('borne les montants et le nombre de mois', () => {
    const r = decoderProjection('?ca=-500,99999999999999&moisFactures=40', D);
    expect(r.facturation[0]).toBe(0);
    expect(r.facturation[1]).toBeLessThanOrEqual(100_000_000);
    expect(r.moisFactures).toBe(NB_MOIS);
  });

  it('ignore les valeurs non numériques', () => {
    const r = decoderProjection('?fraisMensuels=abc&tauxVariable=xyz', D);
    expect(r.fraisMensuels).toBe(D.fraisMensuels);
    expect(r.tauxFraisVariables).toBe(D.tauxFraisVariables);
  });

  it('ignore les paramètres inconnus', () => {
    expect(decoderProjection('?inconnu=1', D)).toEqual(D);
  });
});

describe('ponts vers les autres outils', () => {
  it('passe le résultat à l’arbitrage', () => {
    expect(lienVersArbitrage(106_000, true)).toBe('/?resultat=106000');
    // Le taux réduit non éligible est transmis.
    expect(lienVersArbitrage(106_000, false)).toBe('/?resultat=106000&isReduit=0');
  });

  it('passe le résultat aux acomptes comme point de départ', () => {
    expect(lienVersAcomptes(80_000, true)).toBe('/acomptes/?previsionnel=80000');
  });

  it('borne un résultat déficitaire à zéro dans les liens', () => {
    expect(lienVersArbitrage(-20_000, true)).toBe('/?resultat=0');
    expect(lienVersAcomptes(-20_000, true)).toBe('/acomptes/?previsionnel=0');
  });
});
