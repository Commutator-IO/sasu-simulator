import { describe, expect, it } from 'vitest';
import {
  calculerProjection,
  DEFAUTS_PROJECTION,
  moyenneFacturee,
  NB_MOIS,
  reprojeter,
  type HypothesesProjection,
} from './projection';

const D = DEFAUTS_PROJECTION;
const calc = (sur: Partial<HypothesesProjection> = {}) =>
  calculerProjection({ ...D, ...sur });

/** A year invoiced at a flat 10 000 € a month. */
const plat = (montant = 10_000) => Array(NB_MOIS).fill(montant);

describe('projection du chiffre d’affaires', () => {
  it('somme les douze mois saisis', () => {
    const r = calc({ facturation: plat(10_000), moisFactures: NB_MOIS });
    expect(r.caTotal).toBe(120_000);
    expect(r.caFacture).toBe(120_000);
    expect(r.caProjete).toBe(0);
  });

  it('sépare les mois facturés des mois projetés', () => {
    const r = calc({ facturation: plat(8_000), moisFactures: 5 });
    expect(r.caFacture).toBe(5 * 8_000);
    expect(r.caProjete).toBe(7 * 8_000);
    expect(r.mois.filter((m) => m.projete)).toHaveLength(7);
    expect(r.mois.slice(0, 5).every((m) => !m.projete)).toBe(true);
  });

  it('prend la moyenne des seuls mois facturés', () => {
    // Trois mois à 12 000, 6 000 et 3 000 : moyenne 7 000, quel que soit le
    // contenu des mois suivants.
    const facturation = [12_000, 6_000, 3_000, ...Array(9).fill(99_999)];
    expect(moyenneFacturee(facturation, 3)).toBe(7_000);
  });

  it('extrapole les mois à venir à la moyenne des mois facturés', () => {
    const facturation = reprojeter([12_000, 6_000, 3_000, 0, 0, 0], 3);
    // La moyenne des trois premiers, 7 000, remplit les mois 4 à 12.
    expect(facturation.slice(0, 3)).toEqual([12_000, 6_000, 3_000]);
    expect(facturation.slice(3).every((v) => v === 7_000)).toBe(true);
    expect(facturation).toHaveLength(NB_MOIS);
  });

  it('laisse un mois à venir éditable sans écraser les autres', () => {
    // Après extrapolation, on force un gros mois de décembre : lui seul change.
    const base = reprojeter(plat(5_000), 6);
    const avecDecembre = [...base];
    avecDecembre[11] = 20_000;
    const r = calc({ facturation: avecDecembre, moisFactures: 6 });
    expect(r.caFacture).toBe(6 * 5_000);
    expect(r.caProjete).toBe(5 * 5_000 + 20_000);
  });

  it('annualise le rythme quand les mois à venir suivent la moyenne', () => {
    // Six mois à 10 000 puis extrapolation : le total projeté vaut douze mois
    // au rythme constaté.
    const r = calc({ facturation: reprojeter(plat(10_000), 6), moisFactures: 6 });
    expect(r.moyenneMensuelle).toBe(10_000);
    expect(r.caTotal).toBe(120_000);
  });

  it('ne projette rien tant qu’aucun mois n’est facturé', () => {
    const r = calc({ facturation: Array(NB_MOIS).fill(0), moisFactures: 0 });
    expect(r.moyenneMensuelle).toBe(0);
    expect(r.caTotal).toBe(0);
    expect(r.mois.every((m) => m.projete)).toBe(true);
  });
});

describe('passage au résultat', () => {
  it('retranche les frais fixes annualisés', () => {
    const r = calc({
      facturation: plat(10_000),
      moisFactures: NB_MOIS,
      fraisMensuels: 1_000,
      tauxFraisVariables: 0,
    });
    expect(r.fraisFixesAnnuels).toBe(12_000);
    expect(r.fraisVariablesAnnuels).toBe(0);
    expect(r.resultatAvantRemuneration).toBe(120_000 - 12_000);
  });

  it('applique le taux de frais variables au chiffre d’affaires', () => {
    const r = calc({
      facturation: plat(10_000),
      moisFactures: NB_MOIS,
      fraisMensuels: 0,
      tauxFraisVariables: 0.15,
    });
    expect(r.fraisVariablesAnnuels).toBeCloseTo(120_000 * 0.15, 6);
    expect(r.resultatAvantRemuneration).toBeCloseTo(120_000 * 0.85, 6);
  });

  it('cumule frais fixes et variables', () => {
    const r = calc({
      facturation: plat(10_000),
      moisFactures: NB_MOIS,
      fraisMensuels: 500,
      tauxFraisVariables: 0.1,
    });
    expect(r.chargesTotales).toBeCloseTo(6_000 + 12_000, 6);
    expect(r.resultatAvantRemuneration).toBeCloseTo(120_000 - 18_000, 6);
  });

  it('signale un déficit quand les charges dépassent le chiffre d’affaires', () => {
    const r = calc({
      facturation: plat(1_000),
      moisFactures: NB_MOIS,
      fraisMensuels: 2_000,
      tauxFraisVariables: 0,
    });
    expect(r.resultatAvantRemuneration).toBeLessThan(0);
    expect(r.deficit).toBe(true);
  });

  it('reproduit le résultat de référence des autres outils', () => {
    // Les valeurs par défaut doivent retomber sur un résultat proche du
    // 106 000 € servant de point de départ à l'arbitrage.
    const r = calc();
    expect(r.resultatAvantRemuneration).toBeGreaterThan(100_000);
    expect(r.resultatAvantRemuneration).toBeLessThan(110_000);
  });
});

describe('robustesse', () => {
  it('borne les montants négatifs à zéro', () => {
    const facturation = [-5_000, 10_000, ...Array(10).fill(0)];
    const r = calc({ facturation, moisFactures: 2 });
    expect(r.mois[0].montant).toBe(0);
    expect(r.caFacture).toBe(10_000);
    expect(r.moyenneMensuelle).toBe(5_000);
  });

  it('borne un nombre de mois aberrant', () => {
    expect(calc({ moisFactures: -3 }).mois.every((m) => m.projete)).toBe(true);
    expect(calc({ moisFactures: 99 }).mois.every((m) => !m.projete)).toBe(true);
  });

  it('borne le taux de frais variables', () => {
    const bas = calc({ tauxFraisVariables: -1, facturation: plat(10_000), moisFactures: 12 });
    expect(bas.fraisVariablesAnnuels).toBe(0);
    const haut = calc({ tauxFraisVariables: 5, facturation: plat(10_000), moisFactures: 12 });
    expect(haut.fraisVariablesAnnuels).toBe(120_000);
  });

  it('tolère un tableau de facturation trop court', () => {
    const r = calc({ facturation: [10_000, 10_000], moisFactures: 2 });
    expect(r.mois).toHaveLength(NB_MOIS);
    expect(r.caFacture).toBe(20_000);
    expect(r.caProjete).toBe(0);
  });
});
