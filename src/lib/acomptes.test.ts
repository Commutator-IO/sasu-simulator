import { describe, expect, it } from 'vitest';
import {
  calculerAcomptes,
  coutSousEstimation,
  isExercice,
  isSur,
  ramenerADouzeMois,
  SEUIL_DISPENSE,
  type HypothesesAcomptes,
} from './acomptes';
import { calculerIS } from './simulation';

const BASE: HypothesesAcomptes = {
  beneficeAvantDernier: 120_000,
  moisAvantDernier: 12,
  beneficePrecedent: 120_000,
  moisPrecedent: 12,
  beneficePrevisionnel: 120_000,
  eligibleISReduit: true,
  premierExercice: false,
  strategie: 'appele',
  versementManuel: 0,
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

  it('fixe chaque acompte dû au quart de l’impôt de référence', () => {
    // BOI-IS-DECLA-20-10-10 § 110 : « chacun des quatre acomptes dus au titre
    // de l'exercice est égal au quart de ce montant ». C'est le principe, que
    // l'appel provisoire de mars ne remet pas en cause.
    const r = calc({ beneficeAvantDernier: 300_000, beneficePrecedent: 120_000 });
    for (const e of r.echeances) {
      expect(e.acompteDu).toBeCloseTo(r.isReference / 4, 6);
    }
    expect(r.echeances.reduce((s, e) => s + e.acompteDu, 0)).toBeCloseTo(
      r.isReference,
      6,
    );
  });

  it('ne réclame aucun acompte dû sous dispense', () => {
    for (const e of calc({ premierExercice: true }).echeances) {
      expect(e.acompteDu).toBe(0);
    }
  });

  it('fait coïncider l’appel et l’acompte dû quand les deux exercices se suivent', () => {
    // Cas courant : rien ne distingue alors le provisoire du définitif.
    for (const e of calc().echeances) {
      expect(e.parDefaut).toBeCloseTo(e.acompteDu, 6);
    }
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

  it('ramène à zéro le deuxième acompte quand l’avant-dernier exercice écrase la référence', () => {
    const r = calc({ beneficeAvantDernier: 600_000, beneficePrecedent: 60_000 });
    expect(r.echeances[1].parDefaut).toBe(0);
    for (const e of r.echeances) expect(e.parDefaut).toBeGreaterThanOrEqual(0);
    // Le total appelé dépasse alors l'impôt de référence : c'est un
    // trop-versé, restitué au solde.
    expect(r.totalParDefaut).toBeGreaterThan(r.isReference);
  });

  it('laisse le premier acompte dépasser l’impôt de référence après un effondrement', () => {
    // Bénéfice qui s'effondre d'une année sur l'autre : l'acompte de mars vaut
    // un quart de l'impôt sur l'exercice d'avant, sans rapport apparent avec
    // la référence — d'où une impression d'erreur.
    const r = calc({ beneficeAvantDernier: 106_000, beneficePrecedent: 24_000 });
    expect(r.isReference).toBeCloseTo(24_000 * 0.15, 2);
    expect(r.echeances[0].parDefaut).toBeCloseTo(r.isAvantDernier / 4, 6);
    expect(r.echeances[0].parDefaut).toBeGreaterThan(r.isReference);
  });

  it('n’annule que l’acompte de juin, jamais ceux de septembre et décembre', () => {
    // Régression : l'excédent de la régularisation glissait sur les échéances
    // suivantes et les mettait à zéro. Le texte ne l'ajuste qu'« à due
    // concurrence » sur le deuxième acompte ; les suivants restent appelés
    // pour leur quart, et le trop-versé revient au solde.
    const r = calc({ beneficeAvantDernier: 106_000, beneficePrecedent: 24_000 });
    const quart = r.isReference / 4;

    expect(r.echeances[1].parDefaut).toBe(0);
    expect(r.echeances[2].parDefaut).toBeCloseTo(quart, 6);
    expect(r.echeances[3].parDefaut).toBeCloseTo(quart, 6);
  });

  it('ne laisse jamais une régularisation rendre un acompte négatif', () => {
    for (const avant of [0, 60_000, 600_000]) {
      const r = calc({ beneficeAvantDernier: avant, beneficePrecedent: 60_000 });
      for (const e of r.echeances) expect(e.parDefaut).toBeGreaterThanOrEqual(0);
      // La régularisation ne porte que sur juin.
      expect(r.echeances.filter((e) => Math.abs(e.regularisation) > 0.01)).toHaveLength(
        Math.abs(r.echeances[1].regularisation) > 0.01 ? 1 : 0,
      );
    }
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

describe('exercice de durée différente de douze mois', () => {
  // Une société créée en cours d'année clôt souvent un premier exercice long,
  // puis revient à douze mois. L'acompte de mars repose alors sur un exercice
  // qui n'a pas la durée d'une année pleine.
  const premierExerciceLong = {
    beneficeAvantDernier: 150_000,
    moisAvantDernier: 15,
    beneficePrecedent: 24_000,
    moisPrecedent: 12,
    beneficePrevisionnel: 24_000,
  };

  it('ramène le bénéfice de référence à douze mois', () => {
    // CGI annexe III, art. 360. Sans cette règle, quinze mois de bénéfice
    // gonfleraient les acomptes d'un quart.
    expect(ramenerADouzeMois(150_000, 15)).toBeCloseTo(120_000, 6);
    expect(ramenerADouzeMois(100_000, 12)).toBeCloseTo(100_000, 6);
    expect(ramenerADouzeMois(50_000, 6)).toBeCloseTo(100_000, 6);
  });

  it('assoit l’acompte de mars sur le bénéfice ramené à douze mois', () => {
    const r = calc(premierExerciceLong);
    // 150 000 € sur quinze mois valent 120 000 € sur douze.
    expect(r.echeances[0].quart).toBeCloseTo(isSur(120_000, true) / 4, 6);
    // Sans la règle, la base serait un quart plus élevée.
    expect(r.echeances[0].quart).toBeLessThan(isSur(150_000, true) / 4);
  });

  it('proratise le plafond du taux réduit à la durée de l’exercice', () => {
    // Sur quinze mois, la tranche à 15 % couvre 53 125 € et non 42 500 €.
    const surQuinze = isExercice(150_000, 15, true);
    const surDouze = isExercice(150_000, 12, true);
    expect(surQuinze).toBeLessThan(surDouze);
    expect(surQuinze).toBeCloseTo(53_125 * 0.15 + (150_000 - 53_125) * 0.25, 2);
  });

  it('distingue l’impôt réel de l’exercice de la base des acomptes', () => {
    // Il faut que l'exercice *de référence* soit long : ici quinze mois.
    const r = calc({ beneficePrecedent: 150_000, moisPrecedent: 15 });
    // La base des acomptes est ramenée à douze mois.
    expect(r.isReference).toBeCloseTo(isSur(ramenerADouzeMois(150_000, 15), true), 6);
    // L'impôt réellement dû se calcule sur la durée effective, plafond du
    // taux réduit proratisé compris.
    expect(r.isReferenceReel).toBeCloseTo(isExercice(150_000, 15, true), 6);
    expect(r.isReference).toBeLessThan(r.isReferenceReel);
  });

  it('ne change rien sur un exercice de douze mois', () => {
    const douze = calc({ moisAvantDernier: 12, moisPrecedent: 12 });
    expect(douze.isReference).toBeCloseTo(douze.isReferenceReel, 6);
  });

  it('borne une durée aberrante', () => {
    expect(ramenerADouzeMois(120_000, 0)).toBeCloseTo(120_000, 6);
    expect(ramenerADouzeMois(120_000, -5)).toBeCloseTo(120_000, 6);
    expect(Number.isFinite(calc({ moisPrecedent: 0 }).isReference)).toBe(true);
  });
});

describe('stratégies de versement', () => {
  const enBaisse = {
    beneficeAvantDernier: 200_000,
    beneficePrecedent: 200_000,
    beneficePrevisionnel: 40_000,
  };
  const enHausse = {
    beneficeAvantDernier: 120_000,
    beneficePrecedent: 120_000,
    beneficePrevisionnel: 300_000,
  };

  it('verse exactement l’appel sous la stratégie « appelé »', () => {
    const r = calc({ ...enBaisse, strategie: 'appele' });
    expect(r.totalAjuste).toBeCloseTo(r.totalParDefaut, 6);
    expect(r.gainTresorerie).toBeCloseTo(0, 6);
    expect(r.tresorerieAvancee).toBeCloseTo(0, 6);
  });

  describe('conserver la trésorerie', () => {
    it('ne verse jamais plus que l’appel', () => {
      for (const cas of [enBaisse, enHausse]) {
        const r = calc({ ...cas, strategie: 'conserver' });
        for (const e of r.echeances.filter((x) => !x.passee)) {
          expect(e.ajuste).toBeLessThanOrEqual(e.parDefaut + 0.01);
        }
        expect(r.tresorerieAvancee).toBeCloseTo(0, 6);
      }
    });

    it('s’arrête dès que l’impôt attendu est couvert', () => {
      const r = calc({ ...enBaisse, strategie: 'conserver' });
      expect(r.totalAjuste).toBeCloseTo(r.isPrevisionnel, 6);
      expect(r.gainTresorerie).toBeGreaterThan(0);
      expect(r.solde).toBeCloseTo(0, 6);
    });

    it('laisse un solde à payer quand le bénéfice monte', () => {
      // On ne peut pas verser moins que l'appel : le complément part au solde,
      // et la trésorerie reste disponible jusque-là.
      const r = calc({ ...enHausse, strategie: 'conserver' });
      expect(r.totalAjuste).toBeCloseTo(r.totalParDefaut, 6);
      expect(r.solde).toBeGreaterThan(0);
    });
  });

  describe('lisser sur deux années', () => {
    it('égalise les échéances restantes et le solde', () => {
      const r = calc({ ...enHausse, strategie: 'lisser' });
      const aVenir = r.echeances.filter((e) => !e.passee);
      for (const e of aVenir) {
        expect(e.ajuste).toBeCloseTo(r.versementLisser, 6);
        expect(e.ajuste).toBeCloseTo(r.solde, 6);
      }
    });

    it('abaisse le pic de trésorerie face à la stratégie de conservation', () => {
      const conserver = calc({ ...enHausse, strategie: 'conserver' });
      const lisser = calc({ ...enHausse, strategie: 'lisser' });
      expect(lisser.picTresorerie).toBeLessThanOrEqual(conserver.picTresorerie);
      expect(lisser.solde).toBeLessThan(conserver.solde);
    });

    it('avance de la trésorerie quand le bénéfice monte', () => {
      const r = calc({ ...enHausse, strategie: 'lisser' });
      expect(r.tresorerieAvancee).toBeGreaterThan(0);
      // Le champ opposé reste à zéro plutôt que de devenir négatif.
      expect(r.gainTresorerie).toBe(0);
    });
  });

  it('rend chaque stratégie ajustée représentable par un montant unique', () => {
    // Le curseur affiche un montant par échéance restante : si une stratégie
    // versait en escalier, il en donnerait une image fausse. Régression : la
    // conservation payait l'appel plein puis s'arrêtait, ce qui affichait
    // 5 563 € sur le curseur pendant que le bouton annonçait 1 500 €.
    for (const cas of [enBaisse, enHausse]) {
      for (const [strategie, attendu] of [
        ['conserver', 'versementConserver'],
        ['lisser', 'versementLisser'],
      ] as const) {
        const r = calc({ ...cas, strategie });
        const aVenir = r.echeances.filter((e) => !e.passee);
        for (const e of aVenir) {
          expect(e.ajuste).toBeCloseTo(r[attendu], 6);
        }
      }
    }
  });

  it('conserve mieux la trésorerie en étalant qu’en versant puis s’arrêtant', () => {
    // Même total, mais réparti plus tard dans l'année.
    const r = calc({ ...enBaisse, strategie: 'conserver' });
    const aVenir = r.echeances.filter((e) => !e.passee);
    expect(aVenir[0].ajuste).toBeLessThan(aVenir[0].parDefaut);
    expect(r.totalAjuste).toBeCloseTo(r.isPrevisionnel, 6);
  });

  describe('curseur manuel', () => {
    it('applique le montant choisi à chaque échéance restante', () => {
      const r = calc({ ...enHausse, strategie: 'manuel', versementManuel: 5_000 });
      for (const e of r.echeances.filter((x) => !x.passee)) {
        expect(e.ajuste).toBeCloseTo(5_000, 6);
      }
      expect(r.totalAjuste).toBeCloseTo(20_000, 6);
    });

    it('encadre les deux stratégies entre zéro et le plafond utile', () => {
      const r = calc({ ...enHausse, strategie: 'lisser' });
      expect(r.versementLisser).toBeGreaterThan(0);
      expect(r.versementLisser).toBeLessThan(r.versementPlafond);
      expect(r.versementConserver).toBeLessThanOrEqual(r.versementPlafond);
    });

    it('annule le solde au plafond', () => {
      const r0 = calc({ ...enHausse, strategie: 'lisser' });
      const r = calc({
        ...enHausse,
        strategie: 'manuel',
        versementManuel: r0.versementPlafond,
      });
      expect(r.solde).toBeCloseTo(0, 4);
    });

    it('borne un montant négatif', () => {
      const r = calc({ ...enHausse, strategie: 'manuel', versementManuel: -900 });
      for (const e of r.echeances) expect(e.ajuste).toBeGreaterThanOrEqual(0);
    });
  });

  it('ne signale un risque de majoration que si l’on verse moins que l’appel', () => {
    expect(calc({ ...enBaisse, strategie: 'conserver' }).risqueMajoration).toBe(true);
    expect(calc({ ...enBaisse, strategie: 'appele' }).risqueMajoration).toBe(false);
    // En versant plus que l'appel, aucun manque n'est possible.
    expect(calc({ ...enHausse, strategie: 'lisser' }).risqueMajoration).toBe(false);
  });
});

describe('échéances déjà passées', () => {
  const enBaisse = {
    beneficeAvantDernier: 200_000,
    beneficePrecedent: 200_000,
    beneficePrevisionnel: 40_000,
    strategie: 'conserver' as const,
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
      for (const strategie of ['appele', 'conserver', 'lisser'] as const) {
        const r = calc({ ...enBaisse, strategie, echeancesPassees: passees });
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
    for (const strategie of ['appele', 'conserver', 'lisser'] as const) {
      for (const previsionnel of [0, 40_000, 120_000, 400_000]) {
        const r = calc({ beneficePrevisionnel: previsionnel, strategie });
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
      strategie: 'conserver',
    });
    expect(r.solde).toBeCloseTo(0, 4);
  });
});

describe('enchaînement mars — mai — juin de l’année suivante', () => {
  it('assoit le premier acompte suivant sur l’exercice précédent', () => {
    // Les rôles se décalent d'un cran : au 15 mars N+1, ce sont les comptes de
    // N qui ne sont pas encore approuvés.
    const r = calc({ beneficePrecedent: 120_000, beneficePrevisionnel: 300_000 });
    expect(r.suite.acompte1).toBeCloseTo(r.isReference / 4, 6);
  });

  it('régularise le deuxième acompte suivant sur l’exercice en cours', () => {
    const r = calc({ beneficePrecedent: 120_000, beneficePrevisionnel: 300_000 });
    // Après deux acomptes, la moitié de l'impôt de l'exercice en cours.
    expect(r.suite.acompte1 + r.suite.acompte2).toBeCloseTo(r.isPrevisionnel / 2, 6);
  });

  it('cumule le solde et l’acompte de juin', () => {
    // C'est le « double coup » : deux échéances lourdes à un mois d'écart.
    const r = calc({ beneficePrecedent: 120_000, beneficePrevisionnel: 300_000 });
    expect(r.solde).toBeGreaterThan(0);
    expect(r.suite.cumulMaiJuin).toBeCloseTo(r.solde + r.suite.acompte2, 6);
    expect(r.suite.cumulMaiJuin).toBeGreaterThan(r.totalAjuste);
  });

  it('ne compte pas une restitution comme une sortie', () => {
    const r = calc({ beneficePrecedent: 300_000, beneficePrevisionnel: 20_000 });
    expect(r.solde).toBeLessThan(0);
    expect(r.suite.cumulMaiJuin).toBeCloseTo(r.suite.acompte2, 6);
  });

  it('n’appelle aucun acompte suivant sous le seuil de dispense', () => {
    const r = calc({ beneficePrevisionnel: 15_000 });
    expect(r.suite.acompte1).toBe(0);
    expect(r.suite.acompte2).toBe(0);
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
