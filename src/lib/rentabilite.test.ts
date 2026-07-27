import { describe, expect, it } from 'vitest';
import { DEFAUTS_ARBITRAGE } from './arbitrage';
import {
  decomposerCdi,
  decomposerTjm,
  netEnPocheSalaire,
  seuilRentabilite,
} from './rentabilite';
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

describe('décomposition d’un TJM', () => {
  it('répartit exactement ce que paie le client', () => {
    for (const taux of [0, 0.1, 0.15, 0.2]) {
      const p = decomposerTjm(700, taux, base, { jours: 200 });
      expect(p.clientPaie).toBeCloseTo(700 / (1 - taux), 6);
      expect(
        p.commission + p.frais + p.cotisations + p.is + p.ir + p.net,
      ).toBeCloseTo(p.clientPaie, 6);
      for (const part of Object.values(p)) expect(part).toBeGreaterThanOrEqual(0);
    }
  });

  it('laisse au freelance exactement la même chose sur tous les canaux', () => {
    const canaux = [0, 0.1, 0.15, 0.2].map((t) => decomposerTjm(700, t, base, { jours: 200 }));
    for (const c of canaux) {
      expect(c.net).toBeCloseTo(canaux[0].net, 6);
      expect(c.cotisations).toBeCloseTo(canaux[0].cotisations, 6);
      expect(c.is).toBeCloseTo(canaux[0].is, 6);
      expect(c.ir).toBeCloseTo(canaux[0].ir, 6);
      expect(c.frais).toBeCloseTo(canaux[0].frais, 6);
    }
    // Seule la part de l’intermédiaire — et donc le prix client — bouge.
    expect(canaux[3].commission).toBeGreaterThan(canaux[1].commission);
    expect(canaux[0].commission).toBe(0);
  });

  it('sépare impôts et cotisations sans en perdre', () => {
    const p = decomposerTjm(700, 0.1, base, { jours: 200 });
    expect(p.is).toBeGreaterThan(0);
    expect(p.ir).toBeGreaterThan(0);
    expect(p.cotisations).toBeGreaterThan(0);
  });

  it('fait payer le client davantage quand la commission monte', () => {
    const sans = decomposerTjm(700, 0, base, { jours: 200 });
    const avec = decomposerTjm(700, 0.15, base, { jours: 200 });
    expect(avec.clientPaie).toBeGreaterThan(sans.clientPaie);
    expect(avec.commission).toBeGreaterThan(sans.commission);
  });

  it('ne renvoie que des zéros pour un tarif nul', () => {
    expect(decomposerTjm(0, 0.1, base)).toEqual({
      clientPaie: 0,
      commission: 0,
      frais: 0,
      cotisations: 0,
      is: 0,
      ir: 0,
      net: 0,
    });
  });
});

describe('la même enveloppe prise en CDI', () => {
  it('répartit exactement le coût employeur', () => {
    const p = decomposerCdi(700, base, { jours: 200 });
    expect(p.coutEmployeur).toBeCloseTo(700, 6);
    expect(p.patronales + p.salariales + p.ir + p.net).toBeCloseTo(700, 6);
    for (const part of Object.values(p)) expect(part).toBeGreaterThanOrEqual(0);
  });

  it('distingue la part employeur de la part salarié', () => {
    const p = decomposerCdi(700, base, { jours: 200 });
    expect(p.patronales).toBeGreaterThan(0);
    expect(p.salariales).toBeGreaterThan(0);
    // Le brut se retrouve : coût employeur moins la part patronale.
    expect(p.coutEmployeur - p.patronales).toBeCloseTo(p.salariales + p.ir + p.net, 6);
  });

  it('valorise les avantages en plus de l’enveloppe', () => {
    const p = decomposerCdi(700, base, { jours: 200 });
    expect(p.avantages).toBeGreaterThan(0);
    // Ils s’ajoutent : ils ne sont pas pris sur le coût employeur réparti.
    expect(p.patronales + p.salariales + p.ir + p.net).toBeCloseTo(p.coutEmployeur, 6);
  });

  it('laisse moins en poche qu’une SASU à enveloppe égale', () => {
    const cdi = decomposerCdi(700, base, { jours: 200 });
    const sasu = decomposerTjm(700, 0, base, { jours: 200 });
    expect(cdi.net).toBeLessThan(sasu.net);
  });

  it('ne renvoie que des zéros pour une enveloppe nulle', () => {
    expect(decomposerCdi(0, base)).toEqual({
      coutEmployeur: 0,
      patronales: 0,
      salariales: 0,
      ir: 0,
      net: 0,
      avantages: 0,
    });
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
