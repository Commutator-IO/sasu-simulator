import { describe, expect, it } from 'vitest';
import { DEFAUTS_ARBITRAGE } from './arbitrage';
import { netEnPocheSalaire, seuilRentabilite } from './rentabilite';
import { balayer } from './simulation';
import * as P from './parametres2026';

const base = { ...DEFAUTS_ARBITRAGE };
const meilleurNet = (resultat: number) =>
  balayer({ ...base, resultatAvantRemuneration: resultat }).optimum.netEnPoche;

describe('équivalent d’un salaire', () => {
  it('laisse un net en poche inférieur au brut, et croissant', () => {
    const nets = [30_000, 45_000, 60_000, 90_000].map((b) => netEnPocheSalaire(b, base));
    nets.forEach((net, i) => {
      expect(net).toBeGreaterThan(0);
      expect(net).toBeLessThan([30_000, 45_000, 60_000, 90_000][i]);
      if (i > 0) expect(net).toBeGreaterThan(nets[i - 1]);
    });
  });

  it('ne prélève rien sur un salaire nul', () => {
    expect(netEnPocheSalaire(0, base)).toBe(0);
  });
});

describe('seuil de rentabilité', () => {
  it('trouve le plus petit résultat qui atteint la cible', () => {
    for (const cible of [25_000, 40_000, 60_000]) {
      const s = seuilRentabilite(cible, base);
      // Le seuil atteint la cible…
      expect(meilleurNet(s.resultatNecessaire)).toBeGreaterThanOrEqual(cible - 1);
      // …et un résultat sensiblement plus bas ne l’atteint pas.
      expect(meilleurNet(s.resultatNecessaire - 500)).toBeLessThan(cible);
    }
  });

  it('déduit le CA des frais, et les jours du TJM', () => {
    const s = seuilRentabilite(40_000, base, { tauxFrais: 0.2, jours: 200, tjm: 500 });
    expect(s.caNecessaire).toBeCloseTo(s.resultatNecessaire / 0.8, 6);
    expect(s.tjmNecessaire).toBeCloseTo(s.caNecessaire / 200, 6);
    expect(s.joursNecessaires).toBeCloseTo(s.caNecessaire / 500, 6);
  });

  it('n’exige aucun chiffre d’affaires pour une cible nulle', () => {
    const s = seuilRentabilite(0, base);
    expect(s.resultatNecessaire).toBe(0);
    expect(s.caNecessaire).toBe(0);
    expect(s.horsAtteinte).toBe(false);
  });

  it('signale une cible hors d’atteinte au lieu de renvoyer un seuil faux', () => {
    const s = seuilRentabilite(5_000_000, base);
    expect(s.horsAtteinte).toBe(true);
  });

  it('exige davantage de chiffre d’affaires quand la cible monte', () => {
    const petit = seuilRentabilite(30_000, base).caNecessaire;
    const grand = seuilRentabilite(50_000, base).caNecessaire;
    expect(grand).toBeGreaterThan(petit);
  });

  it('utilise les frais et jours de référence par défaut', () => {
    const s = seuilRentabilite(35_000, base);
    expect(s.caNecessaire).toBeCloseTo(
      s.resultatNecessaire / (1 - P.TAUX_FRAIS_REFERENCE),
      6,
    );
    expect(s.tjmNecessaire).toBeCloseTo(s.caNecessaire / P.JOURS_FACTURES_REFERENCE, 6);
    expect(s.joursNecessaires).toBeNull();
  });
});
