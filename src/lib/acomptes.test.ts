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

/** Profit collapses from one year to the next: the case the tool exists for. */
const EFFONDREMENT = {
  beneficeAvantDernier: 200_000,
  beneficePrecedent: 200_000,
  beneficePrevisionnel: 40_000,
};
/** Profit jumps: the balance and the June instalment pile up. */
const ENVOLEE = {
  beneficeAvantDernier: 120_000,
  beneficePrecedent: 120_000,
  beneficePrevisionnel: 300_000,
};

const aVenir = (r: ReturnType<typeof calc>) => r.echeances.filter((e) => !e.passee);

describe('impôt de référence', () => {
  it('réutilise le calcul d’IS du simulateur, et n’impose pas un déficit', () => {
    expect(isSur(120_000, true)).toBeCloseTo(calculerIS(120_000, true), 6);
    expect(isSur(120_000, false)).toBeCloseTo(calculerIS(120_000, false), 6);
    expect(isSur(-30_000, true)).toBe(0);
  });

  it('ramène le bénéfice de référence à douze mois', () => {
    // CGI annexe III, art. 360. Sans cette règle, quinze mois de bénéfice
    // gonfleraient les acomptes d'un quart.
    expect(ramenerADouzeMois(150_000, 15)).toBeCloseTo(120_000, 6);
    expect(ramenerADouzeMois(100_000, 12)).toBeCloseTo(100_000, 6);
    expect(ramenerADouzeMois(50_000, 6)).toBeCloseTo(100_000, 6);
    // Durées aberrantes ramenées à l'année pleine.
    expect(ramenerADouzeMois(120_000, 0)).toBeCloseTo(120_000, 6);
    expect(ramenerADouzeMois(120_000, -5)).toBeCloseTo(120_000, 6);
  });

  it('proratise le plafond du taux réduit à la durée de l’exercice', () => {
    // Sur quinze mois, la tranche à 15 % couvre 53 125 € et non 42 500 €.
    const surQuinze = isExercice(150_000, 15, true);
    expect(surQuinze).toBeLessThan(isExercice(150_000, 12, true));
    expect(surQuinze).toBeCloseTo(53_125 * 0.15 + (150_000 - 53_125) * 0.25, 2);
  });

  it('distingue la base des acomptes de l’impôt réel de l’exercice', () => {
    // Base ramenée à douze mois d'un côté, impôt dû sur la durée effective de
    // l'autre — plafond du taux réduit proratisé compris.
    const r = calc({ beneficePrecedent: 150_000, moisPrecedent: 15 });
    expect(r.isReference).toBeCloseTo(isSur(ramenerADouzeMois(150_000, 15), true), 6);
    expect(r.isReferenceReel).toBeCloseTo(isExercice(150_000, 15, true), 6);
    expect(r.isReference).toBeLessThan(r.isReferenceReel);

    // Sur douze mois, les deux se confondent.
    const douze = calc();
    expect(douze.isReference).toBeCloseTo(douze.isReferenceReel, 6);
  });
});

describe('dispenses', () => {
  it('dispense la société de son premier exercice', () => {
    const r = calc({ premierExercice: true });
    expect(r.motifDispense).toBe('premier exercice');
    expect(r.totalParDefaut).toBe(0);
    for (const e of r.echeances) expect(e.acompteDu).toBe(0);
    // Tout l'impôt est alors payé en une fois au solde.
    expect(r.solde).toBeCloseTo(r.isPrevisionnel, 6);
  });

  it('dispense en deçà de 3 000 € d’IS de référence', () => {
    // 20 000 € de bénéfice au taux réduit font 3 000 € d'IS pile.
    const auSeuil = calc({ beneficePrecedent: 20_000 });
    expect(auSeuil.isReference).toBeCloseTo(SEUIL_DISPENSE, 6);
    expect(auSeuil.motifDispense).toBe('seuil de 3 000 €');

    expect(calc({ beneficePrecedent: 25_000 }).dispense).toBe(false);
  });

  it('fait primer le premier exercice sur le seuil', () => {
    expect(calc({ premierExercice: true, beneficePrecedent: 500_000 }).motifDispense).toBe(
      'premier exercice',
    );
  });

  it('n’appelle aucun acompte l’année suivante sous le seuil', () => {
    const r = calc({ beneficePrevisionnel: 15_000 });
    expect(r.suite.acompte1).toBe(0);
    expect(r.suite.acompte2).toBe(0);
  });
});

describe('échéancier appelé', () => {
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
    for (const e of r.echeances) expect(e.acompteDu).toBeCloseTo(r.isReference / 4, 6);
  });

  it('assoit le premier appel sur l’avant-dernier exercice, et régularise en juin', () => {
    // C'est le cœur du dispositif : au 15 mars, les comptes de N-1 ne sont pas
    // encore approuvés, donc l'appel repose sur l'exercice d'avant.
    const r = calc({ beneficeAvantDernier: 300_000, beneficePrecedent: 120_000 });
    expect(r.echeances[0].parDefaut).toBeCloseTo(r.isAvantDernier / 4, 6);
    expect(r.echeances[0].parDefaut).toBeGreaterThan(r.isReference / 4);

    // Juin rattrape l'écart : après deux échéances, la moitié de l'IS de
    // référence a été versée. Il faut pour cela que la régularisation reste
    // positive, c'est-à-dire un avant-dernier exercice plus faible — sinon
    // elle bute sur zéro, ce que vérifie le test suivant.
    const rattrapage = calc({ beneficeAvantDernier: 60_000, beneficePrecedent: 120_000 });
    expect(
      rattrapage.echeances[0].parDefaut + rattrapage.echeances[1].parDefaut,
    ).toBeCloseTo(rattrapage.isReference / 2, 6);
  });

  it('fait coïncider l’appel et l’acompte dû quand les exercices se suivent', () => {
    // Cas courant : rien ne distingue alors le provisoire du définitif.
    const r = calc();
    for (const e of r.echeances) {
      expect(e.parDefaut).toBeCloseTo(r.isReference / 4, 6);
      expect(e.parDefaut).toBeCloseTo(e.acompteDu, 6);
    }
    expect(r.totalParDefaut).toBeCloseTo(r.isReference, 6);
  });

  it('n’annule que l’acompte de juin, jamais ceux de septembre et décembre', () => {
    // Régression : l'excédent de la régularisation glissait sur les échéances
    // suivantes et les mettait à zéro. Le texte ne l'ajuste qu'« à due
    // concurrence » sur le deuxième acompte ; les suivants restent appelés pour
    // leur quart, et le trop-versé revient au solde.
    const r = calc({ beneficeAvantDernier: 106_000, beneficePrecedent: 24_000 });
    const quart = r.isReference / 4;

    expect(r.echeances[1].parDefaut).toBe(0);
    expect(r.echeances[2].parDefaut).toBeCloseTo(quart, 6);
    expect(r.echeances[3].parDefaut).toBeCloseTo(quart, 6);
    // L'appel de mars peut alors dépasser à lui seul l'impôt de référence,
    // d'où une impression d'erreur.
    expect(r.echeances[0].parDefaut).toBeGreaterThan(r.isReference);
    expect(r.totalParDefaut).toBeGreaterThan(r.isReference);
  });
});

describe('stratégies de versement', () => {
  it('verse exactement l’appel sous la stratégie « appelé »', () => {
    const r = calc({ ...EFFONDREMENT, strategie: 'appele' });
    expect(r.totalAjuste).toBeCloseTo(r.totalParDefaut, 6);
    expect(r.gainTresorerie).toBeCloseTo(0, 6);
    expect(r.tresorerieAvancee).toBeCloseTo(0, 6);
  });

  it('étale un montant unique par échéance restante', () => {
    // Le curseur affiche un montant par échéance : si une stratégie versait en
    // escalier, il en donnerait une image fausse. Régression : la conservation
    // payait l'appel plein puis s'arrêtait, ce qui affichait 5 563 € sur le
    // curseur pendant que le bouton annonçait 1 500 €.
    for (const cas of [EFFONDREMENT, ENVOLEE]) {
      for (const [strategie, montant] of [
        ['conserver', 'versementConserver'],
        ['lisser', 'versementLisser'],
      ] as const) {
        const r = calc({ ...cas, strategie });
        for (const e of aVenir(r)) expect(e.ajuste).toBeCloseTo(r[montant], 6);
      }
    }
  });

  it('conserve la trésorerie sans jamais dépasser l’appel', () => {
    // Bénéfice en baisse : on s'arrête dès que l'impôt attendu est couvert, et
    // le solde tombe à zéro.
    const baisse = calc({ ...EFFONDREMENT, strategie: 'conserver' });
    expect(baisse.totalAjuste).toBeCloseTo(baisse.isPrevisionnel, 6);
    expect(baisse.gainTresorerie).toBeGreaterThan(0);
    expect(baisse.solde).toBeCloseTo(0, 4);
    expect(aVenir(baisse)[0].ajuste).toBeLessThan(aVenir(baisse)[0].parDefaut);

    // Bénéfice en hausse : on ne peut pas verser moins que l'appel, donc rien
    // n'est avancé et le complément part au solde.
    const hausse = calc({ ...ENVOLEE, strategie: 'conserver' });
    expect(hausse.totalAjuste).toBeCloseTo(hausse.totalParDefaut, 6);
    expect(hausse.tresorerieAvancee).toBeCloseTo(0, 6);
    expect(hausse.solde).toBeGreaterThan(0);
  });

  it('égalise les échéances restantes et le solde en lissant', () => {
    const r = calc({ ...ENVOLEE, strategie: 'lisser' });
    for (const e of aVenir(r)) expect(e.ajuste).toBeCloseTo(r.solde, 6);
    // Payer d'avance abaisse le pic, au prix d'une trésorerie sortie plus tôt.
    const conserver = calc({ ...ENVOLEE, strategie: 'conserver' });
    expect(r.picTresorerie).toBeLessThanOrEqual(conserver.picTresorerie);
    expect(r.solde).toBeLessThan(conserver.solde);
    expect(r.tresorerieAvancee).toBeGreaterThan(0);
    // Le champ opposé reste à zéro plutôt que de devenir négatif.
    expect(r.gainTresorerie).toBe(0);
  });

  it('applique au curseur le montant choisi, borné entre zéro et le plafond utile', () => {
    const r = calc({ ...ENVOLEE, strategie: 'manuel', versementManuel: 5_000 });
    for (const e of aVenir(r)) expect(e.ajuste).toBeCloseTo(5_000, 6);
    expect(r.totalAjuste).toBeCloseTo(20_000, 6);

    const repere = calc({ ...ENVOLEE, strategie: 'lisser' });
    expect(repere.versementLisser).toBeGreaterThan(0);
    expect(repere.versementLisser).toBeLessThan(repere.versementPlafond);
    expect(repere.versementConserver).toBeLessThanOrEqual(repere.versementPlafond);
    // Au plafond, le solde s'annule : au-delà, on ne ferait que se faire
    // rembourser.
    const auPlafond = calc({
      ...ENVOLEE,
      strategie: 'manuel',
      versementManuel: repere.versementPlafond,
    });
    expect(auPlafond.solde).toBeCloseTo(0, 4);
  });

  it('ne signale un risque de majoration que si l’on verse moins que l’appel', () => {
    expect(calc({ ...EFFONDREMENT, strategie: 'conserver' }).risqueMajoration).toBe(true);
    expect(calc({ ...EFFONDREMENT, strategie: 'appele' }).risqueMajoration).toBe(false);
    // En versant plus que l'appel, aucun manque n'est possible.
    expect(calc({ ...ENVOLEE, strategie: 'lisser' }).risqueMajoration).toBe(false);
  });
});

describe('échéances déjà passées', () => {
  const passe = { ...EFFONDREMENT, strategie: 'conserver' as const };

  it('marque les échéances passées et retient le montant déclaré', () => {
    const r = calc({ ...passe, echeancesPassees: 2, versements: [9_000, 1_000] });
    expect(r.echeances.map((e) => e.passee)).toEqual([true, true, false, false]);
    expect(r.echeances[0].ajuste).toBeCloseTo(9_000, 6);
    expect(r.echeances[1].ajuste).toBeCloseTo(1_000, 6);
    expect(r.dejaVerse).toBeCloseTo(10_000, 6);
  });

  it('retient l’appel par défaut, et ignore les déclarations hors périmètre', () => {
    const defaut = calc({ ...passe, echeancesPassees: 2, versements: [] });
    expect(defaut.dejaVerse).toBeCloseTo(
      defaut.echeances[0].parDefaut + defaut.echeances[1].parDefaut,
      6,
    );
    // Au-delà des échéances passées, rien n'est déclarable.
    const trop = calc({ ...passe, echeancesPassees: 1, versements: [5_000, 99_999] });
    expect(trop.dejaVerse).toBeCloseTo(5_000, 6);
  });

  it('déduit le déjà-versé de ce qui reste à payer', () => {
    const r = calc({ ...passe, echeancesPassees: 1, versements: [3_000] });
    expect(r.resteAVerser).toBeCloseTo(r.isPrevisionnel - 3_000, 6);
    // Tant qu'on reste sous l'impôt dû, aucun excédent ni solde.
    expect(r.excedentDejaVerse).toBe(0);
    expect(r.solde).toBeCloseTo(0, 6);
  });

  it('n’appelle plus rien, et ne reprend rien, quand l’impôt attendu est déjà couvert', () => {
    // Un seul acompte de droit commun suffit à dépasser l'impôt attendu quand
    // le bénéfice s'effondre : c'est le cas que l'outil sert à repérer. Le
    // trop-versé ne peut pas être repris, il ne revient qu'au solde.
    const un = calc({ ...passe, echeancesPassees: 1 });
    expect(un.echeances[0].parDefaut).toBeGreaterThan(un.isPrevisionnel);
    expect(un.excedentDejaVerse).toBeGreaterThan(0);

    const deux = calc({ ...passe, echeancesPassees: 2 });
    expect(deux.resteAVerser).toBeCloseTo(0, 6);
    for (const e of aVenir(deux)) expect(e.ajuste).toBe(0);
    expect(deux.excedentDejaVerse).toBeCloseTo(deux.dejaVerse - deux.isPrevisionnel, 6);
    expect(deux.solde).toBeCloseTo(-deux.excedentDejaVerse, 6);
    // Seul ce qui reste à échoir compte comme trésorerie conservée.
    expect(deux.gainTresorerie).toBeCloseTo(deux.resteParDefaut, 6);
  });

  it('ne crie pas au risque quand le déjà-versé dépasse l’impôt attendu', () => {
    // Régression : l'avertissement de majoration s'affichait dès qu'on
    // réduisait les échéances à venir, y compris quand deux acomptes déjà
    // versés couvraient largement l'impôt prévu.
    const couvert = calc({ ...passe, echeancesPassees: 2 });
    expect(couvert.resteAVerser).toBeLessThan(couvert.resteParDefaut);
    expect(couvert.risqueMajoration).toBe(false);
    expect(couvert.matelasSecurite).toBeCloseTo(
      couvert.dejaVerse - couvert.isPrevisionnel,
      6,
    );

    // Sans matelas, en revanche, le risque est réel.
    const ajuste = calc({ ...passe, echeancesPassees: 0 });
    expect(ajuste.matelasSecurite).toBeCloseTo(0, 6);
    expect(ajuste.risqueMajoration).toBe(true);
  });

  it('borne les entrées aberrantes', () => {
    expect(calc({ echeancesPassees: -3 }).echeances.every((e) => !e.passee)).toBe(true);
    expect(calc({ echeancesPassees: 99 }).echeances.every((e) => e.passee)).toBe(true);
    expect(calc({ ...passe, echeancesPassees: 1, versements: [-5_000] }).dejaVerse).toBe(0);
    expect(
      calc({ ...ENVOLEE, strategie: 'manuel', versementManuel: -900 }).resteAVerser,
    ).toBe(0);
    expect(Number.isFinite(calc({ moisPrecedent: 0 }).isReference)).toBe(true);
  });
});

describe('enchaînement mars — mai — juin de l’année suivante', () => {
  const r = calc({ beneficePrecedent: 120_000, beneficePrevisionnel: 300_000 });

  it('décale les rôles d’un cran', () => {
    // Au 15 mars N+1, ce sont les comptes de N qui ne sont pas encore
    // approuvés ; après deux acomptes, la moitié de l'impôt de l'exercice en
    // cours doit être versée.
    expect(r.suite.acompte1).toBeCloseTo(r.isReference / 4, 6);
    expect(r.suite.acompte1 + r.suite.acompte2).toBeCloseTo(r.isPrevisionnel / 2, 6);
  });

  it('cumule le solde et l’acompte de juin', () => {
    // C'est le « double coup » : deux échéances lourdes à un mois d'écart.
    expect(r.solde).toBeGreaterThan(0);
    expect(r.suite.cumulMaiJuin).toBeCloseTo(r.solde + r.suite.acompte2, 6);
    expect(r.suite.cumulMaiJuin).toBeGreaterThan(r.totalAjuste);
  });

  it('ne compte pas une restitution comme une sortie', () => {
    const restitue = calc({ beneficePrecedent: 300_000, beneficePrevisionnel: 20_000 });
    expect(restitue.solde).toBeLessThan(0);
    expect(restitue.suite.cumulMaiJuin).toBeCloseTo(restitue.suite.acompte2, 6);
  });
});

describe('invariants, quelle que soit la situation', () => {
  // Un seul balayage remplace les vérifications éparpillées : chaque fois
  // qu'une fonctionnalité s'ajoutait, sa propre copie de ces contrôles
  // apparaissait à côté des précédentes.
  const cas = [] as HypothesesAcomptes[];
  for (const avantDernier of [0, 60_000, 200_000, 600_000]) {
    for (const precedent of [24_000, 120_000, 400_000]) {
      for (const previsionnel of [0, 40_000, 300_000]) {
        for (const strategie of ['appele', 'conserver', 'lisser', 'manuel'] as const) {
          for (const echeancesPassees of [0, 2, 4]) {
            cas.push({
              ...BASE,
              beneficeAvantDernier: avantDernier,
              beneficePrecedent: precedent,
              beneficePrevisionnel: previsionnel,
              strategie,
              versementManuel: 4_000,
              echeancesPassees,
            });
          }
        }
      }
    }
  }

  it('couvre un éventail représentatif', () => {
    expect(cas.length).toBeGreaterThan(300);
  });

  it('ne verse jamais de montant négatif', () => {
    for (const h of cas) {
      for (const e of calculerAcomptes(h).echeances) {
        expect(e.parDefaut).toBeGreaterThanOrEqual(0);
        expect(e.ajuste).toBeGreaterThanOrEqual(0);
      }
    }
  });

  it('ne régularise que l’échéance de juin', () => {
    for (const h of cas) {
      const autres = calculerAcomptes(h).echeances.filter(
        (e) => e.rang !== 2 && Math.abs(e.regularisation) > 0.01,
      );
      expect(autres).toHaveLength(0);
    }
  });

  it('boucle le compte : versé plus solde égalent l’impôt dû', () => {
    for (const h of cas) {
      const r = calculerAcomptes(h);
      expect(r.dejaVerse + r.resteAVerser).toBeCloseTo(r.totalAjuste, 6);
      expect(r.totalAjuste + r.solde).toBeCloseTo(r.isPrevisionnel, 4);
    }
  });
});

describe('coût d’une sous-estimation', () => {
  it('est nul si rien ne manque', () => {
    expect(coutSousEstimation(0)).toBe(0);
    expect(coutSousEstimation(-500)).toBe(0);
  });

  it('cumule la majoration de 5 % et l’intérêt de retard, croissant avec celui-ci', () => {
    // 10 000 € manquants sur neuf mois : 5 % + 9 × 0,20 %.
    expect(coutSousEstimation(10_000, 9)).toBeCloseTo(10_000 * (0.05 + 0.018), 6);
    expect(coutSousEstimation(10_000, 12)).toBeGreaterThan(coutSousEstimation(10_000, 3));
  });
});
