import { describe, expect, it } from 'vitest';
import {
  calculerAcomptes,
  coutSousEstimation,
  isSur,
  SEUIL_DISPENSE,
  type HypothesesAcomptes,
} from './acomptes';
import { calculerIS } from './simulation';

const BASE: HypothesesAcomptes = {
  beneficeAvantDernier: 120_000,
  beneficePrecedent: 120_000,
  beneficePrevisionnel: 120_000,
  eligibleISReduit: true,
  premierExercice: false,
  moduler: false,
  echeancesPassees: 0,
  versements: [],
};

const calc = (sur: Partial<HypothesesAcomptes> = {}) =>
  calculerAcomptes({ ...BASE, ...sur });

describe('assiette des acomptes', () => {
  it('réutilise le calcul d’IS du simulateur', () => {
    expect(isSur(120_000, true)).toBeCloseTo(calculerIS(120_000, true), 6);
    expect(isSur(120_000, false)).toBeCloseTo(calculerIS(120_000, false), 6);
  });

  it('ne calcule pas d’IS sur un exercice déficitaire', () => {
    expect(isSur(-30_000, true)).toBe(0);
  });
});

describe('dispenses', () => {
  it('dispense la société de son premier exercice', () => {
    const r = calc({ premierExercice: true });
    expect(r.dispense).toBe(true);
    expect(r.motifDispense).toBe('premier exercice');
    expect(r.totalParDefaut).toBe(0);
    // Tout l'impôt est alors payé en une fois au solde.
    expect(r.solde).toBeCloseTo(r.isPrevisionnel, 6);
  });

  it('dispense en deçà de 3 000 € d’IS de référence', () => {
    // 20 000 € de bénéfice au taux réduit font 3 000 € d'IS pile.
    const auSeuil = calc({ beneficePrecedent: 20_000 });
    expect(auSeuil.isReference).toBeCloseTo(SEUIL_DISPENSE, 6);
    expect(auSeuil.dispense).toBe(true);
    expect(auSeuil.motifDispense).toBe('seuil de 3 000 €');

    const auDessus = calc({ beneficePrecedent: 25_000 });
    expect(auDessus.isReference).toBeGreaterThan(SEUIL_DISPENSE);
    expect(auDessus.dispense).toBe(false);
  });

  it('fait primer le premier exercice sur le seuil', () => {
    const r = calc({ premierExercice: true, beneficePrecedent: 500_000 });
    expect(r.motifDispense).toBe('premier exercice');
  });
});

describe('échéancier de droit commun', () => {
  it('répartit l’IS de référence en quatre quarts quand les exercices se suivent', () => {
    const r = calc();
    for (const e of r.echeances) {
      expect(e.parDefaut).toBeCloseTo(r.isReference / 4, 6);
    }
    expect(r.totalParDefaut).toBeCloseTo(r.isReference, 6);
  });

  it('porte les quatre échéances aux dates trimestrielles', () => {
    expect(calc().echeances.map((e) => e.date)).toEqual([
      '15 mars',
      '15 juin',
      '15 septembre',
      '15 décembre',
    ]);
  });

  it('assoit le premier acompte sur l’avant-dernier exercice', () => {
    // C'est le cœur du dispositif : au 15 mars, les comptes de N-1 ne sont pas
    // encore approuvés.
    const r = calc({ beneficeAvantDernier: 300_000, beneficePrecedent: 120_000 });
    expect(r.echeances[0].parDefaut).toBeCloseTo(r.isAvantDernier / 4, 6);
    expect(r.echeances[0].parDefaut).toBeGreaterThan(r.isReference / 4);
  });

  it('régularise au deuxième acompte', () => {
    // Après deux échéances, la moitié de l'IS de référence doit être versée.
    const r = calc({ beneficeAvantDernier: 60_000, beneficePrecedent: 120_000 });
    const deuxPremiers = r.echeances[0].parDefaut + r.echeances[1].parDefaut;
    expect(deuxPremiers).toBeCloseTo(r.isReference / 2, 6);
  });

  it('reporte l’excédent quand l’avant-dernier exercice était bien meilleur', () => {
    // Le deuxième acompte serait négatif : il tombe à zéro et l'excédent
    // s'impute sur les suivants, sans remboursement immédiat.
    const r = calc({ beneficeAvantDernier: 600_000, beneficePrecedent: 60_000 });
    expect(r.echeances[1].parDefaut).toBe(0);
    for (const e of r.echeances) expect(e.parDefaut).toBeGreaterThanOrEqual(0);
    // Le total versé ne peut pas descendre sous le premier acompte déjà payé.
    expect(r.totalParDefaut).toBeGreaterThanOrEqual(r.echeances[0].parDefaut);
  });

  it('laisse le premier acompte dépasser l’impôt de référence après un effondrement', () => {
    // Cas signalé : 24 000 € de bénéfice l'an dernier, mais 106 000 € l'année
    // d'avant. L'acompte du 15 mars vaut un quart de l'impôt sur 106 000 €,
    // sans rapport apparent avec la référence — d'où l'impression d'erreur.
    const r = calc({ beneficeAvantDernier: 106_000, beneficePrecedent: 24_000 });
    expect(r.isReference).toBeCloseTo(24_000 * 0.15, 2);
    expect(r.echeances[0].parDefaut).toBeCloseTo(r.isAvantDernier / 4, 6);
    expect(r.echeances[0].parDefaut).toBeGreaterThan(r.isReference);

    // Les acomptes suivants absorbent l'excédent en tombant à zéro.
    for (const e of r.echeances.slice(1)) expect(e.parDefaut).toBe(0);
    expect(r.totalParDefaut).toBeCloseTo(r.echeances[0].parDefaut, 6);
  });

  it('ne verse jamais d’acompte négatif', () => {
    for (const avant of [0, 50_000, 400_000]) {
      for (const precedent of [25_000, 120_000, 400_000]) {
        const r = calc({ beneficeAvantDernier: avant, beneficePrecedent: precedent });
        for (const e of r.echeances) {
          expect(e.parDefaut).toBeGreaterThanOrEqual(0);
          expect(e.ajuste).toBeGreaterThanOrEqual(0);
        }
      }
    }
  });
});

describe('modulation des acomptes', () => {
  const enBaisse = {
    beneficeAvantDernier: 200_000,
    beneficePrecedent: 200_000,
    beneficePrevisionnel: 40_000,
  };

  it('ne change rien quand elle est désactivée', () => {
    const r = calc(enBaisse);
    expect(r.totalAjuste).toBeCloseTo(r.totalParDefaut, 6);
    expect(r.gainTresorerie).toBeCloseTo(0, 6);
  });

  it('plafonne le total versé à l’impôt réellement attendu', () => {
    const r = calc({ ...enBaisse, moduler: true });
    expect(r.totalAjuste).toBeCloseTo(r.isPrevisionnel, 6);
    expect(r.totalAjuste).toBeLessThan(r.totalParDefaut);
  });

  it('libère la trésorerie correspondante', () => {
    const r = calc({ ...enBaisse, moduler: true });
    expect(r.gainTresorerie).toBeCloseTo(r.totalParDefaut - r.isPrevisionnel, 6);
    expect(r.gainTresorerie).toBeGreaterThan(0);
  });

  it('interrompt les échéances une fois l’impôt attendu couvert', () => {
    const r = calc({ ...enBaisse, moduler: true });
    const derniere = r.echeances.filter((e) => e.ajuste > 0).length;
    expect(derniere).toBeLessThan(4);
    // Les échéances suivantes sont à zéro, pas négatives.
    for (const e of r.echeances.slice(derniere)) expect(e.ajuste).toBe(0);
  });

  it('n’a aucun effet si le bénéfice ne baisse pas', () => {
    const r = calc({ beneficePrevisionnel: 200_000, moduler: true });
    expect(r.totalAjuste).toBeCloseTo(r.totalParDefaut, 6);
    expect(r.gainTresorerie).toBeCloseTo(0, 6);
    expect(r.risqueMajoration).toBe(false);
  });

  it('signale le risque de majoration dès qu’elle réduit les versements', () => {
    expect(calc({ ...enBaisse, moduler: true }).risqueMajoration).toBe(true);
    expect(calc(enBaisse).risqueMajoration).toBe(false);
  });
});

describe('échéances déjà passées', () => {
  const enBaisse = {
    beneficeAvantDernier: 200_000,
    beneficePrecedent: 200_000,
    beneficePrevisionnel: 40_000,
    moduler: true,
  };

  it('marque les échéances passées et laisse les autres à venir', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 2 });
    expect(r.echeances.map((e) => e.passee)).toEqual([true, true, false, false]);
  });

  it('retient par défaut le montant appelé pour une échéance passée', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 2, versements: [] });
    expect(r.dejaVerse).toBeCloseTo(
      r.echeances[0].parDefaut + r.echeances[1].parDefaut,
      6,
    );
  });

  it('retient le montant déclaré quand il diffère de l’appel', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 2, versements: [9_000, 1_000] });
    expect(r.dejaVerse).toBeCloseTo(10_000, 6);
    expect(r.echeances[0].ajuste).toBeCloseTo(9_000, 6);
    expect(r.echeances[1].ajuste).toBeCloseTo(1_000, 6);
  });

  it('ignore les déclarations au-delà des échéances passées', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 1, versements: [5_000, 99_999] });
    expect(r.dejaVerse).toBeCloseTo(5_000, 6);
    expect(r.echeances[1].passee).toBe(false);
  });

  it('déduit le déjà-versé de ce qui reste à payer', () => {
    // 8 000 € d'impôt attendu, 3 000 € déjà versés : il reste 5 000 €.
    const r = calc({
      ...enBaisse,
      beneficePrevisionnel: 40_000,
      echeancesPassees: 1,
      versements: [3_000],
    });
    expect(r.resteAVerser).toBeCloseTo(r.isPrevisionnel - 3_000, 6);
    expect(r.dejaVerse + r.resteAVerser).toBeCloseTo(r.isPrevisionnel, 6);
  });

  it('n’appelle plus rien quand le déjà-versé couvre l’impôt attendu', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 2 });
    expect(r.dejaVerse).toBeGreaterThan(r.isPrevisionnel);
    expect(r.resteAVerser).toBeCloseTo(0, 6);
    for (const e of r.echeances.filter((x) => !x.passee)) expect(e.ajuste).toBe(0);
  });

  it('ne réduit jamais rétroactivement une échéance passée', () => {
    // Le trop-versé ne peut pas être repris : il ne revient qu'au solde.
    const r = calc({ ...enBaisse, echeancesPassees: 3 });
    expect(r.dejaVerse).toBeGreaterThan(r.isPrevisionnel);
    expect(r.excedentDejaVerse).toBeCloseTo(r.dejaVerse - r.isPrevisionnel, 6);
    expect(r.solde).toBeCloseTo(-r.excedentDejaVerse, 6);
  });

  it('ne signale aucun excédent tant que le déjà-versé reste sous l’impôt dû', () => {
    // Il faut un versement déclaré inférieur à l'appel : avec cette référence,
    // un seul acompte de droit commun dépasse déjà l'impôt attendu.
    const r = calc({ ...enBaisse, echeancesPassees: 1, versements: [3_000] });
    expect(r.dejaVerse).toBeLessThan(r.isPrevisionnel);
    expect(r.excedentDejaVerse).toBe(0);
    expect(r.solde).toBeCloseTo(0, 6);
  });

  it('un seul acompte suffit à dépasser l’impôt attendu quand le bénéfice s’effondre', () => {
    // C'est exactement le cas que l'outil sert à repérer.
    const r = calc({ ...enBaisse, echeancesPassees: 1 });
    expect(r.echeances[0].parDefaut).toBeGreaterThan(r.isPrevisionnel);
    expect(r.excedentDejaVerse).toBeGreaterThan(0);
  });

  it('ne compte comme gain que ce qui reste à échoir', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 2 });
    expect(r.gainTresorerie).toBeCloseTo(r.resteParDefaut, 6);
    // Les deux premières échéances, déjà payées, n'y comptent pas.
    expect(r.gainTresorerie).toBeLessThan(r.totalParDefaut);
  });

  it('boucle le compte quel que soit le nombre d’échéances passées', () => {
    for (let passees = 0; passees <= 4; passees++) {
      for (const moduler of [false, true]) {
        const r = calc({ ...enBaisse, moduler, echeancesPassees: passees });
        expect(r.dejaVerse + r.resteAVerser).toBeCloseTo(r.totalAjuste, 6);
        expect(r.totalAjuste + r.solde).toBeCloseTo(r.isPrevisionnel, 4);
      }
    }
  });

  it('borne un nombre d’échéances aberrant', () => {
    expect(calc({ echeancesPassees: -3 }).echeances.every((e) => !e.passee)).toBe(true);
    expect(calc({ echeancesPassees: 99 }).echeances.every((e) => e.passee)).toBe(true);
  });

  it('ne crie pas au risque quand le déjà-versé dépasse l’impôt attendu', () => {
    // Régression : l'avertissement de majoration s'affichait dès qu'on
    // réduisait les échéances à venir, y compris quand deux acomptes déjà
    // versés couvraient largement l'impôt prévu. Aucun manque n'est possible
    // dans ce cas.
    const r = calc({ ...enBaisse, echeancesPassees: 2 });
    expect(r.dejaVerse).toBeGreaterThan(r.isPrevisionnel);
    expect(r.resteAVerser).toBeLessThan(r.resteParDefaut);
    expect(r.risqueMajoration).toBe(false);
    expect(r.matelasSecurite).toBeCloseTo(r.dejaVerse - r.isPrevisionnel, 6);
  });

  it('signale le risque quand les versements collent à l’impôt prévu', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 0 });
    expect(r.totalAjuste).toBeCloseTo(r.isPrevisionnel, 6);
    expect(r.matelasSecurite).toBeCloseTo(0, 6);
    expect(r.risqueMajoration).toBe(true);
  });

  it('borne un versement négatif', () => {
    const r = calc({ ...enBaisse, echeancesPassees: 1, versements: [-5_000] });
    expect(r.dejaVerse).toBe(0);
  });
});

describe('solde', () => {
  it('boucle le compte : acomptes versés plus solde égalent l’impôt dû', () => {
    for (const moduler of [false, true]) {
      for (const previsionnel of [0, 40_000, 120_000, 400_000]) {
        const r = calc({ beneficePrevisionnel: previsionnel, moduler });
        expect(r.totalAjuste + r.solde).toBeCloseTo(r.isPrevisionnel, 4);
      }
    }
  });

  it('devient négatif quand les acomptes ont dépassé l’impôt dû', () => {
    // Sans modulation, un exercice en forte baisse fait trop payer.
    const r = calc({
      beneficeAvantDernier: 300_000,
      beneficePrecedent: 300_000,
      beneficePrevisionnel: 20_000,
    });
    expect(r.solde).toBeLessThan(0);
  });

  it('tombe à zéro quand la modulation a exactement couvert l’impôt', () => {
    const r = calc({
      beneficeAvantDernier: 200_000,
      beneficePrecedent: 200_000,
      beneficePrevisionnel: 40_000,
      moduler: true,
    });
    expect(r.solde).toBeCloseTo(0, 4);
  });
});

describe('coût d’une sous-estimation', () => {
  it('est nul si rien ne manque', () => {
    expect(coutSousEstimation(0)).toBe(0);
    expect(coutSousEstimation(-500)).toBe(0);
  });

  it('cumule la majoration de 5 % et l’intérêt de retard', () => {
    // 10 000 € manquants sur neuf mois : 5 % + 9 × 0,20 %.
    expect(coutSousEstimation(10_000, 9)).toBeCloseTo(10_000 * (0.05 + 0.018), 6);
  });

  it('croît avec le retard', () => {
    expect(coutSousEstimation(10_000, 12)).toBeGreaterThan(
      coutSousEstimation(10_000, 3),
    );
  });
});
