import { describe, expect, it } from 'vitest';
import { calculerCfe, DEFAUTS_CFE, trancheBaseMinimum, type HypothesesCfe } from './cfe';

const cas = (modifs: Partial<HypothesesCfe>): HypothesesCfe => ({
  ...DEFAUTS_CFE,
  anneeCreation: 2024,
  tauxCommune: 25,
  ...modifs,
});

describe('CFE sur base minimum', () => {
  it('reprend les tranches 2026 de service-public', () => {
    expect(trancheBaseMinimum(10_000)).toEqual({ min: 250, max: 597 });
    expect(trancheBaseMinimum(10_001)).toEqual({ min: 250, max: 1_194 });
    expect(trancheBaseMinimum(100_000)).toEqual({ min: 250, max: 2_509 });
    expect(trancheBaseMinimum(117_000)).toEqual({ min: 250, max: 4_183 });
    expect(trancheBaseMinimum(400_000)).toEqual({ min: 250, max: 5_974 });
    expect(trancheBaseMinimum(2_000_000)).toEqual({ min: 250, max: 7_769 });
  });

  it("exonère l'année de création, puis divise la base par deux l'année suivante", () => {
    const r = calculerCfe(cas({ chiffreAffaires: 117_000 }));
    expect(r.annees.map((a) => a.annee)).toEqual([2024, 2025, 2026]);
    expect(r.annees[0]).toMatchObject({ exoneration: 'creation', total: 0 });
    expect(r.annees[1].base).toBe(4_183 / 2);
    expect(r.annees[2].base).toBe(4_183);
    expect(r.premiereAnneeDue).toBe(2025);
  });

  it('calcule la cotisation, la taxe CCI et les frais de gestion', () => {
    // €4,183 × 25% = €1,045.75; CCI 1.12% of the base = €46.85; then 1% on both.
    const pleine = calculerCfe(cas({ chiffreAffaires: 117_000 })).annees[2];
    expect(pleine.cfe).toBeCloseTo(1_045.75, 6);
    expect(pleine.taxeAdditionnelle).toBeCloseTo(46.8496, 4);
    expect(pleine.total).toBeCloseTo((1_045.75 + 46.8496) * 1.01, 4);
    const horsCci = calculerCfe(cas({ chiffreAffaires: 117_000, ressortissantCci: false }));
    expect(horsCci.annees[2].taxeAdditionnelle).toBe(0);
  });

  it('retient la base votée par la commune, bornée à la fourchette légale', () => {
    expect(calculerCfe(cas({ chiffreAffaires: 50_000, baseCommune: 1_500 })).baseRetenue).toBe(1_500);
    expect(calculerCfe(cas({ chiffreAffaires: 50_000, baseCommune: 9_999 })).baseRetenue).toBe(2_509);
    expect(calculerCfe(cas({ chiffreAffaires: 50_000, baseCommune: 100 })).baseRetenue).toBe(250);
    // Unknown: the ceiling of the range, the cautious reading.
    expect(calculerCfe(cas({ chiffreAffaires: 50_000, baseCommune: 0 })).baseRetenue).toBe(2_509);
  });

  it("n'est jamais due sous 5 000 € de chiffre d'affaires", () => {
    const r = calculerCfe(cas({ chiffreAffaires: 5_000 }));
    expect(r.premiereAnneeDue).toBeNull();
    expect(r.annees.every((a) => a.total === 0)).toBe(true);
    expect(r.annees[2].exoneration).toBe('chiffreAffaires');
  });

  it('ne chiffre rien tant que le taux de la commune manque', () => {
    const r = calculerCfe(cas({ chiffreAffaires: 117_000, tauxCommune: 0 }));
    expect(r.annees[2].cfe).toBe(0);
    expect(r.premiereAnneeDue).toBe(2025);
  });
});
