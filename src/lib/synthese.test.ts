import { describe, expect, it, vi } from 'vitest';
import { calculerSynthese, construireScenario } from './synthese';
import { encoderSynthese } from './urlSynthese';
import { calculerProjection, NB_MOIS } from './projection';
import { simuler } from './simulation';

describe('construction du scénario', () => {
  it('part des défauts pour une URL vide', () => {
    const s = construireScenario('');
    expect(s.aProjection).toBe(false);
    expect(s.aArbitrage).toBe(false);
    expect(s.aAcomptes).toBe(false);
  });

  it('détecte les paramètres de chaque outil', () => {
    expect(construireScenario('?ca=10000').aProjection).toBe(true);
    expect(construireScenario('?brut=60000').aArbitrage).toBe(true);
    expect(construireScenario('?precedent=90000').aAcomptes).toBe(true);
  });

  it('injecte le résultat de la projection dans l’arbitrage', () => {
    // Douze mois à 10 000, sans frais : résultat avant rémunération 120 000.
    const ca = Array(NB_MOIS).fill(10_000).join(',');
    const s = construireScenario(`?ca=${ca}&moisFactures=12&fraisMensuels=0`);
    expect(s.arbitrage.base.resultatAvantRemuneration).toBeCloseTo(120_000, 0);
  });

  it('laisse un résultat explicite primer sur la projection', () => {
    const ca = Array(NB_MOIS).fill(10_000).join(',');
    const s = construireScenario(`?ca=${ca}&moisFactures=12&resultat=90000`);
    expect(s.arbitrage.base.resultatAvantRemuneration).toBe(90_000);
  });

  it('assoit le bénéfice prévisionnel des acomptes sur le résultat fiscal', () => {
    // Le prévisionnel doit être le résultat APRÈS rémunération, pas avant.
    const s = construireScenario('?resultat=150000&brut=60000');
    const fiscal = simuler({ ...s.arbitrage.base, brutAnnuel: 60_000 }).resultatFiscal;
    expect(s.acomptes.beneficePrevisionnel).toBeCloseTo(fiscal, 6);
    expect(s.acomptes.beneficePrevisionnel).toBeLessThan(150_000);
  });

  it('laisse un prévisionnel explicite intact', () => {
    const s = construireScenario('?resultat=150000&brut=60000&previsionnel=42000');
    expect(s.acomptes.beneficePrevisionnel).toBe(42_000);
  });
});

describe('repli sur la mémoire du navigateur', () => {
  const avecStockage = (store: Record<string, string>, corps: () => void) => {
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store[k] ?? null,
      setItem: () => {},
      removeItem: () => {},
    });
    try {
      corps();
    } finally {
      vi.unstubAllGlobals();
    }
  };

  it('lit la projection sauvegardée quand l’URL ne la porte pas', () => {
    // Le bug : la synthèse ouverte sans paramètres affichait « non renseignée »
    // alors que la projection avait été saisie et sauvegardée.
    const ca = Array(NB_MOIS).fill(10_000).join(',');
    avecStockage(
      { 'sasu:projection': `?ca=${ca}&moisFactures=12&fraisMensuels=0` },
      () => {
        const s = construireScenario('');
        expect(s.aProjection).toBe(true);
        expect(s.arbitrage.base.resultatAvantRemuneration).toBeCloseTo(120_000, 0);
      },
    );
  });

  it('laisse l’URL primer sur la mémoire', () => {
    avecStockage({ 'sasu:arbitrage': '?resultat=90000' }, () => {
      const s = construireScenario('?resultat=150000');
      expect(s.arbitrage.base.resultatAvantRemuneration).toBe(150_000);
    });
  });
});

describe('calcul de la synthèse', () => {
  it('retient la rémunération de l’URL, sinon l’optimum', () => {
    const impose = calculerSynthese('?resultat=150000&brut=70000');
    expect(impose.brutChoisi).toBe(70_000);

    const auto = calculerSynthese('?resultat=150000');
    expect(auto.brutChoisi).toBe(auto.balayage.optimum.brutAnnuel);
  });

  it('répartit exactement le résultat avant rémunération et les réserves', () => {
    // L'identité comptable du moteur : la somme des parts égale le résultat
    // avant rémunération augmenté des réserves antérieures.
    for (const recherche of [
      '',
      '?resultat=200000&brut=60000',
      '?resultat=90000&distribution=0.4&reserves=50000&bareme=1',
    ]) {
      const s = calculerSynthese(recherche);
      const somme = s.repartition.reduce((t, part) => t + part.montant, 0);
      expect(somme).toBeCloseTo(
        s.arbitrage.resultatAvantRemuneration + s.arbitrage.reservesAnterieures,
        4,
      );
    }
  });

  it('aligne les trois volets sur un même scénario', () => {
    const ca = Array(NB_MOIS).fill(12_000).join(',');
    const s = calculerSynthese(`?ca=${ca}&moisFactures=12&fraisMensuels=1000&brut=50000`);
    // La projection nourrit l'arbitrage.
    const resProj = calculerProjection(s.scenario.projection).resultatAvantRemuneration;
    expect(s.arbitrage.resultatAvantRemuneration).toBeCloseTo(resProj, 0);
    // L'arbitrage nourrit le prévisionnel des acomptes.
    expect(s.acomptes.isPrevisionnel).toBeCloseTo(
      simuler({ ...s.scenario.arbitrage.base, brutAnnuel: 50_000 }).is,
      0,
    );
  });
});

describe('lien de partage de la synthèse', () => {
  it('fusionne les trois encodages et se relit à l’identique', () => {
    const recherche = '?resultat=150000&brut=60000&distribution=0.5&strategie=lisser';
    const scenario = construireScenario(recherche);
    const requete = encoderSynthese(scenario);
    // Tout se relit : le scénario reconstruit est stable.
    const rejoue = construireScenario(requete);
    expect(rejoue.arbitrage.base.resultatAvantRemuneration).toBe(150_000);
    expect(rejoue.arbitrage.brut).toBe(60_000);
    expect(rejoue.acomptes.strategie).toBe('lisser');
  });

  it('ne produit aucun paramètre pour un scénario par défaut', () => {
    expect(encoderSynthese(construireScenario(''))).toBe('');
  });
});
