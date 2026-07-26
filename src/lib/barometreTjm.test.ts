import { describe, expect, it } from 'vitest';
import {
  anneeDecimale,
  dernier,
  getSpecialite,
  positionner,
  serieExperience,
  SPECIALITES,
  villesDisponibles,
} from './barometreTjm';

describe('données du baromètre', () => {
  it('expose plusieurs spécialités, data scientist en tête', () => {
    expect(SPECIALITES.length).toBeGreaterThan(1);
    expect(SPECIALITES[0].cle).toBe('data-scientist');
  });

  it('date les points de chaque spécialité dans l’ordre chronologique', () => {
    for (const s of SPECIALITES) {
      const annees = s.villes.map((p) => anneeDecimale(p.date));
      for (let i = 1; i < annees.length; i++) {
        expect(annees[i]).toBeGreaterThan(annees[i - 1]);
      }
    }
  });

  it('porte une valeur pour chaque ville disponible à chaque date', () => {
    for (const s of SPECIALITES) {
      const villes = villesDisponibles(s);
      expect(villes).toContain('national');
      expect(villes).toContain('Paris');
      for (const p of s.villes) {
        for (const v of villes) expect(p[v]).toBeGreaterThan(0);
      }
    }
  });

  it('range les niveaux d’expérience : bas ≤ moyen ≤ haut, moyen croissant', () => {
    for (const s of SPECIALITES) {
      let precedentMoyen = 0;
      for (const n of s.experience) {
        expect(n.bas).toBeLessThanOrEqual(n.moyen);
        expect(n.moyen).toBeLessThanOrEqual(n.haut);
        expect(n.moyen).toBeGreaterThan(precedentMoyen);
        precedentMoyen = n.moyen;
      }
    }
  });

  it('convertit une date « AAAA-MM » en année décimale', () => {
    expect(anneeDecimale('2020-01')).toBeCloseTo(2020 + 0.5 / 12, 6);
    expect(anneeDecimale('2026-07')).toBeCloseTo(2026 + 6.5 / 12, 6);
  });

  it('donne un historique par tranche pour data scientist, rien pour les nouvelles', () => {
    expect(serieExperience(getSpecialite('data-scientist'), '0-2').length).toBeGreaterThan(1);
    expect(serieExperience(getSpecialite('data-ml'), '6-9')).toHaveLength(0);
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
    const d = dernier(getSpecialite('data-scientist'));
    expect((d.Paris as number)).toBeGreaterThan(d.national as number);
  });
});
