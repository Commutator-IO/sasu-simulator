import { describe, expect, it } from 'vitest';
import {
  anneeDecimale,
  dernier,
  getProfession,
  positionner,
  PROFESSIONS,
  serieVille,
  villesCommunes,
  villesProfession,
} from './barometreTjm';

describe('données du baromètre', () => {
  it('expose plusieurs métiers, expert data en tête', () => {
    expect(PROFESSIONS.length).toBeGreaterThan(1);
    expect(PROFESSIONS[0].cle).toBe('expert-data');
    expect(PROFESSIONS.map((p) => p.cle)).toContain('developpeur');
  });

  it('ne projette qu’après la dernière mesure, avec une fourchette', () => {
    for (const p of PROFESSIONS) {
      const projections = p.villes.filter((pt) => pt.origine === 'projection');
      const mesures = p.villes.filter((pt) => pt.origine !== 'projection');
      for (const pj of projections) {
        expect(pj.date > mesures[mesures.length - 1].date).toBe(true);
        const [bas, haut] = pj.marge?.Paris ?? [];
        expect(bas).toBeLessThanOrEqual(pj.Paris as number);
        expect(haut).toBeGreaterThanOrEqual(pj.Paris as number);
      }
    }
  });

  it('date les points de chaque métier dans l’ordre chronologique', () => {
    for (const p of PROFESSIONS) {
      const annees = p.villes.map((pt) => anneeDecimale(pt.date));
      for (let i = 1; i < annees.length; i++) {
        expect(annees[i]).toBeGreaterThan(annees[i - 1]);
      }
    }
  });

  it('porte une valeur pour chaque ville disponible à chaque date', () => {
    for (const p of PROFESSIONS) {
      const villes = villesProfession(p);
      expect(villes).toContain('national');
      expect(villes).toContain('Paris');
      for (const pt of p.villes) {
        for (const v of villes) expect(pt[v]).toBeGreaterThan(0);
      }
    }
  });

  it('partage les mêmes tranches d’ancienneté entre métiers', () => {
    const cles = (p: (typeof PROFESSIONS)[number]) => p.experience.map((n) => n.cle).join(',');
    for (const p of PROFESSIONS) expect(cles(p)).toBe(cles(PROFESSIONS[0]));
  });

  it('range les niveaux : bas ≤ moyen ≤ haut, moyen croissant', () => {
    for (const p of PROFESSIONS) {
      let precedent = 0;
      for (const n of p.experience) {
        expect(n.bas).toBeLessThanOrEqual(n.moyen);
        expect(n.moyen).toBeLessThanOrEqual(n.haut);
        expect(n.moyen).toBeGreaterThan(precedent);
        precedent = n.moyen;
      }
    }
  });

  it('donne les villes communes à un ensemble de métiers', () => {
    const communes = villesCommunes(PROFESSIONS);
    expect(communes).toContain('national');
    expect(communes).toContain('Paris');
  });

  it('sérialise une ville en points datés', () => {
    const pts = serieVille(getProfession('developpeur'), 'Paris');
    expect(pts.length).toBe(getProfession('developpeur').villes.length);
    expect(pts[0].annee).toBeLessThan(pts[pts.length - 1].annee);
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
  });

  it('situe dans la plage, borné entre 0 et 1', () => {
    expect(positionner(300, niveau).positionDansPlage).toBeCloseTo(0, 6);
    expect(positionner(1210, niveau).positionDansPlage).toBeCloseTo(1, 6);
    expect(positionner(100, niveau).positionDansPlage).toBe(0);
    expect(positionner(5000, niveau).positionDansPlage).toBe(1);
  });

  it('la dernière capture donne bien Paris au-dessus du national', () => {
    const d = dernier(getProfession('expert-data'));
    expect(d.Paris as number).toBeGreaterThan(d.national as number);
  });
});
