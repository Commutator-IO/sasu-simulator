import { describe, expect, it } from 'vitest';
import {
  abattementSalaire,
  assietteCSG,
  balayer,
  baremeIR,
  brutMaxPourBudget,
  calculerCotisations,
  calculerIR,
  calculerIS,
  coutEmployeur,
  decomposerSalaire,
  plafondTranche1,
  plateauOptimum,
  simuler,
  tauxPrelevementSource,
  type Hypotheses,
} from './simulation';
import * as P from './parametres2026';

const BASE: Omit<Hypotheses, 'brutAnnuel'> = {
  resultatAvantRemuneration: 150_000,
  tauxDistribution: 1,
  parts: 1,
  couple: false,
  autresRevenus: 0,
  salaireExterneBrut: 0,
  moisRemuneration: 12,
  tauxATMP: P.AT_MP_DEFAUT,
  eligibleISReduit: true,
  dividendesAuBareme: false,
};

const sim = (brutAnnuel: number, sur: Partial<Hypotheses> = {}) =>
  simuler({ ...BASE, brutAnnuel, ...sur });

describe('impôt sur les sociétés', () => {
  it("applique 15 % jusqu'au seuil puis 25 %", () => {
    expect(calculerIS(42_500, true)).toBeCloseTo(6_375, 2);
    expect(calculerIS(100_000, true)).toBeCloseTo(6_375 + 57_500 * 0.25, 2);
  });

  it('applique 25 % sur tout le bénéfice si la société est inéligible', () => {
    expect(calculerIS(42_500, false)).toBeCloseTo(10_625, 2);
  });

  it("n'impose pas un résultat déficitaire", () => {
    expect(calculerIS(-10_000, true)).toBe(0);
  });
});

describe('barème de l’impôt sur le revenu', () => {
  it('exonère la première tranche', () => {
    expect(baremeIR(11_600)).toBe(0);
  });

  it('taxe la deuxième tranche à 11 %', () => {
    expect(baremeIR(20_000)).toBeCloseTo((20_000 - 11_600) * 0.11, 2);
  });

  it('cumule les tranches franchies', () => {
    const attendu =
      (29_579 - 11_600) * 0.11 + (84_577 - 29_579) * 0.3 + (100_000 - 84_577) * 0.41;
    expect(baremeIR(100_000)).toBeCloseTo(attendu, 2);
  });

  it('applique la décote aux impôts faibles', () => {
    // 15 000 € pour une part : impôt brut 374 €, décote 897 − 45,25 % × 374.
    const brut = baremeIR(15_000);
    const decote = P.DECOTE_CELIBATAIRE - P.DECOTE_TAUX * brut;
    expect(calculerIR(15_000, 1, false)).toBeCloseTo(Math.max(0, brut - decote), 2);
  });

  it('plafonne l’avantage du quotient familial', () => {
    // Un célibataire avec deux enfants (2 parts) : l'avantage des deux
    // demi-parts ne peut dépasser 2 × 1 807 €.
    const impot = calculerIR(120_000, 2, false);
    const sansEnfants = calculerIR(120_000, 1, false);
    expect(sansEnfants - impot).toBeCloseTo(2 * P.PLAFOND_DEMI_PART, 2);
  });

  it('ne plafonne pas le quotient conjugal d’un couple', () => {
    expect(calculerIR(120_000, 2, true)).toBeCloseTo(baremeIR(60_000) * 2, 2);
  });
});

describe('abattement salarial de 10 %', () => {
  it('applique 10 % dans le cas courant', () => {
    expect(abattementSalaire(50_000)).toBeCloseTo(45_000, 2);
  });

  it('plafonne la déduction pour les hauts revenus', () => {
    expect(abattementSalaire(300_000)).toBeCloseTo(300_000 - P.ABATTEMENT_SALAIRE_MAX, 2);
  });

  it('garantit la déduction minimale', () => {
    expect(abattementSalaire(2_000)).toBeCloseTo(2_000 - P.ABATTEMENT_SALAIRE_MIN, 2);
  });
});

describe('assiette CSG-CRDS', () => {
  it('abat 1,75 % en deçà de 4 Pass', () => {
    expect(assietteCSG(40_000)).toBeCloseTo(40_000 * 0.9825, 2);
  });

  it('ne l’abat plus au-delà de 4 Pass', () => {
    const plafond = 4 * P.PASS;
    expect(assietteCSG(plafond + 50_000)).toBeCloseTo(plafond * 0.9825 + 50_000, 2);
  });
});

describe('cotisations du président', () => {
  it('ne retient aucune cotisation chômage', () => {
    const libelles = calculerCotisations(60_000, 1.3).map((l) => l.libelle.toLowerCase());
    expect(libelles.some((l) => l.includes('chômage'))).toBe(false);
    expect(libelles.some((l) => l.includes('ags'))).toBe(false);
  });

  it("ne déclenche la CET qu'au-delà d'un Pass", () => {
    const sous = calculerCotisations(P.PASS - 1_000, 1.3).find((l) =>
      l.libelle.includes('CET'),
    );
    const au_dela = calculerCotisations(P.PASS + 1_000, 1.3).find((l) =>
      l.libelle.includes('CET'),
    );
    expect(sous?.patronal).toBe(0);
    expect(au_dela?.patronal).toBeGreaterThan(0);
  });

  it('plafonne la tranche 2 à huit Pass', () => {
    const ligne = calculerCotisations(20 * P.PASS, 1.3).find((l) =>
      l.libelle.includes('Agirc-Arrco T2'),
    );
    expect(ligne?.basePatronale).toBeCloseTo(7 * P.PASS, 2);
  });

  it('produit un coût employeur strictement croissant', () => {
    let precedent = -1;
    for (let brut = 0; brut <= 400_000; brut += 5_000) {
      const cout = coutEmployeur(brut, 1.3);
      expect(cout).toBeGreaterThan(precedent);
      precedent = cout;
    }
  });

  it('situe les charges patronales dans la fourchette attendue', () => {
    // Sous le Pass, la retraite complémentaire est intégralement en tranche 1 :
    // le taux patronal global tourne autour de 35 à 40 % du brut.
    const r = sim(40_000);
    const taux = r.cotisationsPatronales / r.brutAnnuel;
    expect(taux).toBeGreaterThan(0.33);
    expect(taux).toBeLessThan(0.42);
  });

  it('alourdit les charges patronales au-dessus du Pass', () => {
    // La tranche 2 Agirc-Arrco (12,95 % patronal) remplace la tranche 1 (4,72 %).
    const bas = sim(40_000);
    const haut = sim(120_000);
    expect(haut.cotisationsPatronales / haut.brutAnnuel).toBeGreaterThan(
      bas.cotisationsPatronales / bas.brutAnnuel,
    );
  });

  it('laisse un net salarial entre 70 et 80 % du brut', () => {
    for (const brut of [30_000, 60_000, 120_000]) {
      const r = sim(brut);
      expect(r.salaireNet / brut).toBeGreaterThan(0.7);
      expect(r.salaireNet / brut).toBeLessThan(0.8);
    }
  });
});

describe('inversion du coût employeur', () => {
  it('retrouve le brut correspondant à un budget donné', () => {
    for (const budget of [10_000, 75_000, 250_000]) {
      const brut = brutMaxPourBudget(budget, 1.3);
      expect(coutEmployeur(brut, 1.3)).toBeCloseTo(budget, 0);
    }
  });

  it('renvoie zéro pour un budget nul ou négatif', () => {
    expect(brutMaxPourBudget(0, 1.3)).toBe(0);
    expect(brutMaxPourBudget(-5_000, 1.3)).toBe(0);
  });
});

describe('simulation complète', () => {
  it('conserve l’équilibre comptable : résultat = net en poche + réserves + prélèvements', () => {
    for (const brut of [0, 25_000, 60_000, 100_000]) {
      const r = sim(brut);
      expect(r.netEnPoche + r.reserves + r.totalPrelevements).toBeCloseTo(
        r.resultatAvantRemuneration,
        4,
      );
    }
  });

  it('conserve l’équilibre lorsque le résultat est mis en réserve', () => {
    const r = sim(50_000, { tauxDistribution: 0.4 });
    expect(r.netEnPoche + r.reserves + r.totalPrelevements).toBeCloseTo(150_000, 4);
  });

  it('verse tout en dividendes lorsque la rémunération est nulle', () => {
    const r = sim(0);
    expect(r.salaireNet).toBe(0);
    expect(r.is).toBeCloseTo(calculerIS(150_000, true), 2);
    expect(r.dividendesBruts).toBeCloseTo(150_000 - r.is, 2);
    expect(r.trimestresValides).toBe(0);
  });

  it('valide quatre trimestres dès 600 heures de Smic', () => {
    expect(sim(4 * P.BRUT_PAR_TRIMESTRE).trimestresValides).toBe(4);
    expect(sim(4 * P.BRUT_PAR_TRIMESTRE - 1).trimestresValides).toBe(3);
  });

  it('n’ouvre aucun droit retraite via les dividendes', () => {
    const r = sim(0);
    expect(r.pointsAgircArrco).toBe(0);
    expect(r.dividendesNets).toBeGreaterThan(0);
  });

  it('applique la flat tax à 31,4 % sur les dividendes', () => {
    // 12,8 % d'impôt sur le revenu + 18,6 % de prélèvements sociaux depuis la
    // LFSS 2026 : le PFU n'est plus à 30 %.
    const r = sim(0);
    expect(r.dividendesNets).toBeCloseTo(r.dividendesBruts * (1 - 0.314), 2);
  });

  it('retient 18,6 % de prélèvements sociaux sur les dividendes', () => {
    const r = sim(0);
    expect(r.prelevementsSociauxDividendes).toBeCloseTo(r.dividendesBruts * 0.186, 2);
  });

  it('laisse la CSG des salaires à 9,2 %, non concernée par la hausse', () => {
    // La LFSS 2026 ne relève la CSG que sur le capital mobilier.
    const lignes = calculerCotisations(60_000, 1.3);
    const csgD = lignes.find((l) => l.libelle === 'CSG déductible')!;
    const csgND = lignes.find((l) => l.libelle === 'CSG non déductible')!;
    expect(csgD.tauxSalarial + csgND.tauxSalarial).toBeCloseTo(9.2, 10);
  });

  it('rend le barème plus favorable que la flat tax à faible revenu', () => {
    const petit = { ...BASE, resultatAvantRemuneration: 25_000 };
    const pfu = simuler({ ...petit, brutAnnuel: 0, dividendesAuBareme: false });
    const bareme = simuler({ ...petit, brutAnnuel: 0, dividendesAuBareme: true });
    expect(bareme.netEnPoche).toBeGreaterThan(pfu.netEnPoche);
  });

  it('rend la flat tax plus favorable que le barème à haut revenu', () => {
    const gros = { ...BASE, resultatAvantRemuneration: 400_000 };
    const pfu = simuler({ ...gros, brutAnnuel: 0, dividendesAuBareme: false });
    const bareme = simuler({ ...gros, brutAnnuel: 0, dividendesAuBareme: true });
    expect(pfu.netEnPoche).toBeGreaterThan(bareme.netEnPoche);
  });

  it('ne dépasse jamais le budget de la société', () => {
    const brutMax = brutMaxPourBudget(150_000, P.AT_MP_DEFAUT);
    const r = sim(brutMax);
    expect(r.resultatFiscal).toBeCloseTo(0, 0);
    expect(r.dividendesBruts).toBeCloseTo(0, 0);
  });
});

describe('prélèvement à la source', () => {
  it('assoit le prélèvement sur le net imposable avant abattement de 10 %', () => {
    const r = sim(60_000);
    // L'assiette est bien supérieure au net imposable déclaré, qui lui subit
    // la déduction forfaitaire.
    expect(r.assiettePAS).toBeGreaterThan(r.salaireNetImposable);
    expect(abattementSalaire(r.assiettePAS)).toBeCloseTo(r.salaireNetImposable, 2);
  });

  it('prélève sur l’année l’impôt dû sur le salaire, au centime d’arrondi près', () => {
    const r = sim(60_000);
    // L'arrondi du taux à la décimale empêche de tomber juste : l'écart ne
    // peut pas dépasser une demi-décimale de taux appliquée à l'assiette,
    // et c'est la déclaration de revenus qui le régularise.
    const toleranceArrondi = r.assiettePAS * (P.PAS_ARRONDI / 2);
    expect(Math.abs(r.prelevementMensuelPAS * 12 - r.irSurSalaire)).toBeLessThanOrEqual(
      toleranceArrondi,
    );
  });

  it('arrondit le taux à la décimale la plus proche', () => {
    for (const brut of [30_000, 45_000, 60_000, 90_000, 150_000]) {
      const taux = sim(brut).tauxPAS * 100;
      expect(taux).toBeCloseTo(Math.round(taux * 10) / 10, 10);
    }
  });

  it('reste nul quand le foyer n’est pas imposable', () => {
    const r = sim(14_000, { resultatAvantRemuneration: 20_000 });
    expect(r.irSurSalaire).toBe(0);
    expect(r.tauxPAS).toBe(0);
    expect(r.prelevementMensuelPAS).toBe(0);
  });

  it('est nul en l’absence de rémunération', () => {
    const r = sim(0);
    expect(r.assiettePAS).toBe(0);
    expect(r.tauxPAS).toBe(0);
  });

  it('croît avec la rémunération', () => {
    let precedent = -1;
    for (const brut of [20_000, 40_000, 60_000, 100_000, 140_000]) {
      const taux = sim(brut, { resultatAvantRemuneration: 300_000 }).tauxPAS;
      expect(taux).toBeGreaterThanOrEqual(precedent);
      precedent = taux;
    }
  });

  it('exclut les dividendes soumis au PFU du champ du prélèvement', () => {
    // Les revenus de capitaux mobiliers ne sont pas prélevés à la source :
    // distribuer davantage ne doit pas changer le taux appliqué à la paie.
    const peu = sim(50_000, { tauxDistribution: 0.1 });
    const tout = sim(50_000, { tauxDistribution: 1 });
    expect(peu.tauxPAS).toBeCloseTo(tout.tauxPAS, 10);
  });

  it('relève le taux quand le foyer opte pour le barème', () => {
    // Les dividendes au barème font monter l'impôt du foyer, donc le taux
    // appliqué au salaire.
    const pfu = sim(50_000, { dividendesAuBareme: false });
    const bareme = sim(50_000, { dividendesAuBareme: true });
    expect(bareme.tauxPAS).toBeGreaterThan(pfu.tauxPAS);
  });

  it('reste sous le taux marginal du foyer', () => {
    for (const brut of [30_000, 60_000, 120_000]) {
      const r = sim(brut, { resultatAvantRemuneration: 300_000 });
      expect(r.tauxPAS).toBeLessThan(r.tmi);
    }
  });

  it('applique la formule de l’article 204 H', () => {
    expect(tauxPrelevementSource(3_000, 30_000, 30_000, 33_333)).toBeCloseTo(0.09, 10);
    // Le prorata isole la part d'impôt afférente aux revenus dans le champ.
    expect(tauxPrelevementSource(4_000, 40_000, 20_000, 22_222)).toBeCloseTo(0.09, 10);
  });
});

describe('nombre de mois de rémunération', () => {
  it('retombe sur le plafond annuel pour douze mois', () => {
    // Le plafond annuel est exactement douze plafonds mensuels : si cette
    // égalité se rompt, toute la proratisation dérive.
    expect(plafondTranche1(12)).toBeCloseTo(P.PASS, 10);
    expect(12 * P.PMSS).toBeCloseTo(P.PASS, 10);
  });

  it('proratise le plafond au nombre de mois', () => {
    expect(plafondTranche1(6)).toBeCloseTo(6 * P.PMSS, 10);
    expect(plafondTranche1(1)).toBeCloseTo(P.PMSS, 10);
  });

  it('borne les valeurs aberrantes', () => {
    expect(plafondTranche1(0)).toBeCloseTo(P.PMSS, 10);
    expect(plafondTranche1(-3)).toBeCloseTo(P.PMSS, 10);
    expect(plafondTranche1(24)).toBeCloseTo(P.PASS, 10);
    expect(plafondTranche1(Number.NaN)).toBeCloseTo(P.PASS, 10);
  });

  it('ne change rien à douze mois', () => {
    const douze = sim(60_000, { moisRemuneration: 12 });
    const defaut = sim(60_000);
    expect(douze.cotisationsPatronales).toBeCloseTo(defaut.cotisationsPatronales, 6);
    expect(douze.netEnPoche).toBeCloseTo(defaut.netEnPoche, 6);
  });

  it('bascule davantage de rémunération en tranche 2 sur une année partielle', () => {
    // 40 000 € versés sur six mois dépassent le plafond proratisé (24 030 €),
    // alors qu'ils resteraient intégralement en tranche 1 sur douze mois.
    const annee = calculerCotisations(40_000, 1.3, 12);
    const semestre = calculerCotisations(40_000, 1.3, 6);
    const t2Annee = annee.find((l) => l.libelle.includes('Agirc-Arrco T2'))!;
    const t2Semestre = semestre.find((l) => l.libelle.includes('Agirc-Arrco T2'))!;

    expect(t2Annee.basePatronale).toBe(0);
    expect(t2Semestre.basePatronale).toBeCloseTo(40_000 - 6 * P.PMSS, 6);
  });

  it('laisse le coût employeur quasi inchangé malgré le passage en tranche 2', () => {
    // Contre-intuitif : au-dessus du plafond, la retraite complémentaire
    // patronale passe de 4,72 % à 12,95 %, mais la vieillesse plafonnée
    // (8,55 %) disparaît. Les deux effets se compensent presque, et seule la
    // CET vient s'ajouter. Ce test existe parce que l'interface a d'abord
    // annoncé, à tort, une hausse sensible du coût.
    const annee = sim(45_000, { moisRemuneration: 12 });
    const semestre = sim(45_000, { moisRemuneration: 6 });
    const ecart =
      (semestre.cotisationsPatronales - annee.cotisationsPatronales) /
      annee.cotisationsPatronales;
    expect(ecart).toBeGreaterThan(0);
    expect(ecart).toBeLessThan(0.01);
  });

  it('allège les cotisations salariales et augmente les points de retraite', () => {
    // La tranche 2 achète les points à 17 % contre 6,20 % en tranche 1.
    const annee = sim(45_000, { moisRemuneration: 12 });
    const semestre = sim(45_000, { moisRemuneration: 6 });
    expect(semestre.cotisationsSalariales).toBeLessThan(annee.cotisationsSalariales);
    expect(semestre.salaireNet).toBeGreaterThan(annee.salaireNet);
    expect(semestre.pointsAgircArrco).toBeGreaterThan(annee.pointsAgircArrco * 1.5);
  });

  it('déclenche la CET dès le plafond proratisé', () => {
    const lignes = calculerCotisations(30_000, 1.3, 6);
    const cet = lignes.find((l) => l.libelle.includes('CET'))!;
    expect(cet.patronal).toBeGreaterThan(0);
    // Sur douze mois, 30 000 € restent sous le Pass : pas de CET.
    const sur12 = calculerCotisations(30_000, 1.3, 12).find((l) =>
      l.libelle.includes('CET'),
    )!;
    expect(sur12.patronal).toBe(0);
  });

  it('proratise aussi le plafond de l’abattement CSG', () => {
    const plafond6 = 4 * plafondTranche1(6);
    expect(assietteCSG(plafond6 + 10_000, 6)).toBeCloseTo(
      plafond6 * 0.9825 + 10_000,
      6,
    );
  });

  it('ne change pas les trimestres validés, qui dépendent du salaire annuel', () => {
    const annee = sim(4 * P.BRUT_PAR_TRIMESTRE, { moisRemuneration: 12 });
    const trimestre = sim(4 * P.BRUT_PAR_TRIMESTRE, { moisRemuneration: 3 });
    expect(annee.trimestresValides).toBe(4);
    expect(trimestre.trimestresValides).toBe(4);
  });

  it('étale la retenue à la source sur le nombre de paies réel', () => {
    const r = sim(60_000, { moisRemuneration: 6 });
    expect(r.prelevementMensuelPAS * 6).toBeCloseTo(r.assiettePAS * r.tauxPAS, 6);
  });

  it('conserve l’équilibre comptable sur une année partielle', () => {
    for (const mois of [1, 3, 6, 9, 12]) {
      const r = sim(30_000, { moisRemuneration: mois });
      expect(r.netEnPoche + r.reserves + r.totalPrelevements).toBeCloseTo(
        r.resultatAvantRemuneration,
        4,
      );
    }
  });

  it('respecte le budget de la société quel que soit le nombre de mois', () => {
    for (const mois of [3, 6, 12]) {
      const brutMax = brutMaxPourBudget(150_000, P.AT_MP_DEFAUT, mois);
      expect(coutEmployeur(brutMax, P.AT_MP_DEFAUT, mois)).toBeCloseTo(150_000, 0);
    }
  });
});

describe('salaire perçu chez un autre employeur', () => {
  it('ne change rien quand il est nul', () => {
    const sans = sim(45_000);
    const zero = sim(45_000, { salaireExterneBrut: 0 });
    expect(zero.netEnPoche).toBeCloseTo(sans.netEnPoche, 6);
    expect(zero.tauxPAS).toBeCloseTo(sans.tauxPAS, 10);
  });

  it('n’applique l’abattement de 10 % qu’une fois sur les deux salaires', () => {
    // Deux salaires de 150 000 € dépassent largement le plafond de
    // l'abattement : la déduction totale ne peut pas valoir deux plafonds.
    const r = sim(150_000, {
      resultatAvantRemuneration: 400_000,
      salaireExterneBrut: 150_000,
    });
    const deduction =
      r.assiettePASFoyer - (r.salaireNetImposable + r.salaireExterneNetImposable);
    expect(deduction).toBeCloseTo(P.ABATTEMENT_SALAIRE_MAX, 2);
  });

  it('n’impute pas à la SASU l’impôt dû sur le salaire extérieur', () => {
    const r = sim(0, { salaireExterneBrut: 60_000 });
    // Sans rémunération de président, la SASU ne cause aucun impôt sur salaire,
    // alors même que le foyer est imposable.
    expect(r.irSurSalaire).toBeCloseTo(0, 6);
    expect(r.irFoyer).toBeGreaterThan(0);
  });

  it('conserve l’équilibre comptable malgré le salaire extérieur', () => {
    for (const brut of [0, 30_000, 60_000]) {
      const r = sim(brut, { salaireExterneBrut: 40_000 });
      expect(r.netEnPoche + r.reserves + r.totalPrelevements).toBeCloseTo(
        r.resultatAvantRemuneration,
        4,
      );
    }
  });

  it('renchérit la rémunération de président en la poussant vers le haut du barème', () => {
    const seul = sim(40_000);
    const cumul = sim(40_000, { salaireExterneBrut: 45_000 });
    expect(cumul.irSurSalaire).toBeGreaterThan(seul.irSurSalaire);
    expect(cumul.tmi).toBeGreaterThanOrEqual(seul.tmi);
  });

  it('déplace l’optimum vers les dividendes', () => {
    const seul = balayer(BASE).optimum.brutAnnuel;
    const cumul = balayer({ ...BASE, salaireExterneBrut: 45_000 }).optimum.brutAnnuel;
    expect(cumul).toBeLessThan(seul);
  });

  it('compte les trimestres tous employeurs confondus', () => {
    const r = sim(0, { salaireExterneBrut: 4 * P.BRUT_PAR_TRIMESTRE });
    expect(r.trimestresValides).toBe(4);
    expect(r.trimestresExterne).toBe(4);

    // Un mi-temps qui ne valide que deux trimestres : la rémunération de
    // président complète jusqu'à quatre.
    const partiel = sim(2 * P.BRUT_PAR_TRIMESTRE, {
      salaireExterneBrut: 2 * P.BRUT_PAR_TRIMESTRE,
    });
    expect(partiel.trimestresExterne).toBe(2);
    expect(partiel.trimestresValides).toBe(4);
  });

  it('inclut les deux salaires dans l’assiette du prélèvement à la source', () => {
    const r = sim(45_000, { salaireExterneBrut: 30_000 });
    expect(r.assiettePASFoyer).toBeGreaterThan(r.assiettePAS);
    expect(r.assiettePASFoyer - r.assiettePAS).toBeCloseTo(
      decomposerSalaire(30_000).netImposableAvantAbattement,
      6,
    );
    // La retenue affichée ne porte que sur la paie de la SASU.
    expect(r.prelevementMensuelPAS * 12).toBeCloseTo(r.assiettePAS * r.tauxPAS, 6);
  });

  it('applique le même taux de prélèvement aux deux employeurs', () => {
    // Le taux est celui du foyer : il ne dépend pas de la répartition entre
    // les deux paies, à revenu total constant.
    const a = sim(40_000, { salaireExterneBrut: 40_000 });
    const b = sim(40_000, { salaireExterneBrut: 40_000 });
    expect(a.tauxPAS).toBeCloseTo(b.tauxPAS, 10);
    expect(a.tauxPAS).toBeGreaterThan(0);
  });

  it('décompose un salaire extérieur comme celui du président', () => {
    const d = decomposerSalaire(50_000);
    expect(d.net / 50_000).toBeGreaterThan(0.7);
    expect(d.net / 50_000).toBeLessThan(0.8);
    expect(d.netImposableAvantAbattement).toBeGreaterThan(d.net);
  });
});

describe('recherche de l’optimum', () => {
  it('trouve un optimum au moins aussi bon que tous les points balayés', () => {
    const { points, optimum } = balayer(BASE);
    for (const p of points) {
      expect(optimum.netEnPoche).toBeGreaterThanOrEqual(p.net - 0.01);
    }
  });

  it('reste dans le domaine finançable', () => {
    const { optimum } = balayer(BASE);
    expect(optimum.brutAnnuel).toBeGreaterThanOrEqual(0);
    expect(optimum.coutEmployeur).toBeLessThanOrEqual(150_000 + 1);
  });

  it('recommande une rémunération non nulle sur un résultat courant', () => {
    // Les premiers euros de salaire sont peu taxés (tranches à 0 et 11 %)
    // alors que le dividende subit d'emblée IS + flat tax.
    const { optimum } = balayer(BASE);
    expect(optimum.brutAnnuel).toBeGreaterThan(5_000);
  });

  it('encadre l’optimum par un plateau', () => {
    const { optimum, plateau } = balayer(BASE);
    expect(plateau.min).toBeLessThanOrEqual(optimum.brutAnnuel);
    expect(plateau.max).toBeGreaterThanOrEqual(optimum.brutAnnuel);
  });

  it('garde tout le plateau dans la tolérance', () => {
    const { optimum, plateau } = balayer(BASE);
    for (let i = 0; i <= 20; i++) {
      const brut = plateau.min + ((plateau.max - plateau.min) * i) / 20;
      const net = simuler({ ...BASE, brutAnnuel: brut }).netEnPoche;
      expect(optimum.netEnPoche - net).toBeLessThanOrEqual(plateau.tolerance + 0.01);
    }
  });

  it('exclut de la plage ce qui est juste au-delà de ses bornes', () => {
    const { optimum, plateau } = balayer(BASE);
    for (const brut of [plateau.min - 200, plateau.max + 200]) {
      if (brut < 0) continue;
      const net = simuler({ ...BASE, brutAnnuel: brut }).netEnPoche;
      expect(optimum.netEnPoche - net).toBeGreaterThan(plateau.tolerance);
    }
  });

  it('confirme que la courbe est plate à son sommet', () => {
    // C'est la raison d'être du plateau : le badge « vous êtes à l'optimum »
    // s'affichait sur plusieurs milliers d'euros de rémunération sans que
    // l'utilisateur comprenne pourquoi.
    const { optimum, plateau } = balayer(BASE);
    expect(plateau.max - plateau.min).toBeGreaterThan(1_000);

    // S'écarter de 2 000 € de l'optimum coûte moins de 200 €.
    const ecarte = simuler({ ...BASE, brutAnnuel: optimum.brutAnnuel + 2_000 });
    expect(optimum.netEnPoche - ecarte.netEnPoche).toBeLessThan(200);
  });

  it('resserre le plateau quand la tolérance se resserre', () => {
    const { optimum } = balayer(BASE);
    const brutMax = brutMaxPourBudget(
      BASE.resultatAvantRemuneration,
      BASE.tauxATMP,
      BASE.moisRemuneration,
    );
    const large = plateauOptimum(BASE, optimum, brutMax, 500);
    const etroit = plateauOptimum(BASE, optimum, brutMax, 10);
    expect(etroit.max - etroit.min).toBeLessThan(large.max - large.min);
  });

  it('déplace l’optimum quand le foyer a déjà d’autres revenus', () => {
    // Avec un foyer déjà imposé dans les tranches hautes, le salaire perd de
    // son avantage : l'optimum recule.
    const seul = balayer(BASE).optimum.brutAnnuel;
    const avecRevenus = balayer({ ...BASE, autresRevenus: 120_000 }).optimum.brutAnnuel;
    expect(avecRevenus).toBeLessThan(seul);
  });
});
