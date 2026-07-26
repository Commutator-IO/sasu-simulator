import { describe, expect, it } from 'vitest';
import {
  anneeDecimale,
  DERNIER,
  NIVEAUX,
  POINTS_VILLES,
  positionner,
  VILLES,
} from './barometreTjm';

describe('données du baromètre', () => {
  it('a des points datés et croissants', () => {
    const annees = POINTS_VILLES.map((p) => anneeDecimale(p.date));
    for (let i = 1; i < annees.length; i++) {
      expect(annees[i]).toBeGreaterThan(annees[i - 1]);
    }
  });

  it('porte une valeur pour chaque ville à chaque date', () => {
    for (const p of POINTS_VILLES) {
      expect(p.national).toBeGreaterThan(0);
      for (const v of VILLES) expect(p[v]).toBeGreaterThan(0);
    }
  });

  it('range les niveaux d’expérience : bas ≤ moyen ≤ haut, et croissants', () => {
    let precedentMoyen = 0;
    for (const n of NIVEAUX) {
      expect(n.bas).toBeLessThanOrEqual(n.moyen);
      expect(n.moyen).toBeLessThanOrEqual(n.haut);
      expect(n.moyen).toBeGreaterThan(precedentMoyen);
      precedentMoyen = n.moyen;
    }
  });

  it('convertit une date « AAAA-MM » en année décimale', () => {
    expect(anneeDecimale('2020-01')).toBeCloseTo(2020 + 0.5 / 12, 6);
    expect(anneeDecimale('2026-07')).toBeCloseTo(2026 + 6.5 / 12, 6);
  });
});

describe('positionnement d’un TJM', () => {
  const niveau = { cle: '8-15', label: '8 à 15 ans', bas: 300, moyen: 680, haut: 1210 };

  it('mesure l’écart à la moyenne', () => {
    expect(positionner(800, niveau).ecartMoyen).toBe(120);
    expect(positionner(600, niveau).ecartMoyen).toBe(-80);
    expect(positionner(800, niveau).auDessusDeLaMoyenne).toBe(true);
    expect(positionner(600, niveau).auDessusDeLaMoyenne).toBe(false);
  });

  it('situe dans la plage, borné entre 0 et 1', () => {
    expect(positionner(300, niveau).positionDansPlage).toBeCloseTo(0, 6);
    expect(positionner(1210, niveau).positionDansPlage).toBeCloseTo(1, 6);
    expect(positionner(755, niveau).positionDansPlage).toBeCloseTo(0.5, 6);
    expect(positionner(100, niveau).positionDansPlage).toBe(0);
    expect(positionner(5000, niveau).positionDansPlage).toBe(1);
  });

  it('la dernière capture donne bien Paris au-dessus du national', () => {
    expect(DERNIER.Paris).toBeGreaterThan(DERNIER.national);
  });
});
