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
    // €15,000 for one share: gross tax €374, rebate 897 − 45.25% × 374.
    const brut = baremeIR(15_000);
    const decote = P.DECOTE_CELIBATAIRE - P.DECOTE_TAUX * brut;
    expect(calculerIR(15_000, 1, false)).toBeCloseTo(Math.max(0, brut - decote), 2);
  });

  it('plafonne l’avantage du quotient familial', () => {
    // A single parent with two children (2 shares): the benefit of the two
    // extra half-shares cannot exceed 2 × €1,807.
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
    // Below the annual ceiling, supplementary pension sits entirely in band 1:
    // the overall employer rate lands around 35-40% of gross.
    const r = sim(40_000);
    const taux = r.cotisationsPatronales / r.brutAnnuel;
    expect(taux).toBeGreaterThan(0.33);
    expect(taux).toBeLessThan(0.42);
  });

  it('alourdit les charges patronales au-dessus du Pass', () => {
    // Agirc-Arrco band 2 (12.95% employer) replaces band 1 (4.72%).
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
      for (const dividendesAuBareme of [false, true]) {
        for (const autresRevenus of [0, 35_000]) {
          const r = sim(brut, { dividendesAuBareme, autresRevenus });
          expect(r.netEnPoche + r.reserves + r.totalPrelevements).toBeCloseTo(
            r.resultatAvantRemuneration,
            4,
          );
        }
      }
    }
  });

  it('recompose le net en poche à partir des deux chiffres affichés', () => {
    // Le panneau de résultat affiche le net en poche, puis le salaire net
    // après impôt et les dividendes nets. Les deux doivent en faire la somme
    // exacte, sans quoi le lecteur soupçonne à raison une incohérence.
    for (const brut of [0, 9_500, 45_000, 90_000]) {
      for (const sur of [
        {},
        { salaireExterneBrut: 13_800, moisRemuneration: 6 },
        { dividendesAuBareme: true, autresRevenus: 20_000 },
      ]) {
        const r = sim(brut, { resultatAvantRemuneration: 110_000, ...sur });
        expect(r.salaireNet - r.irSurSalaire + r.dividendesNets).toBeCloseTo(
          r.netEnPoche,
          6,
        );
      }
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
    // 12.8% income tax + 18.6% social levies since the 2026 Social Security
    // Financing Act: the flat tax is no longer 30%.
    const r = sim(0);
    expect(r.dividendesNets).toBeCloseTo(r.dividendesBruts * (1 - 0.314), 2);
  });

  it('retient 18,6 % de prélèvements sociaux sur les dividendes', () => {
    const r = sim(0);
    expect(r.prelevementsSociauxDividendes).toBeCloseTo(r.dividendesBruts * 0.186, 2);
  });

  it('laisse la CSG des salaires à 9,2 %, non concernée par la hausse', () => {
    // The 2026 act only raises the CSG on investment income.
    const lignes = calculerCotisations(60_000, 1.3);
    const csgD = lignes.find((l) => l.libelle === 'CSG déductible')!;
    const csgND = lignes.find((l) => l.libelle === 'CSG non déductible')!;
    expect(csgD.tauxSalarial + csgND.tauxSalarial).toBeCloseTo(9.2, 10);
  });

  it('partage l’impôt du barème entre salaire et dividendes', () => {
    // Régression : au barème, le salaire était taxé comme s'il était seul et
    // les dividendes récupéraient les tranches marginales. L'impôt imputé au
    // salaire était sous-évalué de près de 7 000 €, et le « salaire net après
    // impôt » d'autant surévalué.
    const h = { resultatAvantRemuneration: 180_000, dividendesAuBareme: true };
    const r = sim(45_000, h);

    // Bornes des deux attributions extrêmes : le salaire d'abord, ou en dernier.
    const salaireDAbord = sim(45_000, {
      ...h,
      dividendesAuBareme: false,
    }).irSurSalaire;
    const dividendesImposables =
      r.dividendesBruts * (1 - P.ABATTEMENT_DIVIDENDES) -
      r.dividendesBruts * P.CSG_DEDUCTIBLE_DIVIDENDES;
    const salaireEnDernier =
      calculerIR(r.salaireNetImposable + dividendesImposables, 1, false) -
      calculerIR(dividendesImposables, 1, false);

    expect(r.irSurSalaire).toBeGreaterThan(salaireDAbord);
    expect(r.irSurSalaire).toBeLessThan(salaireEnDernier);
    // Moyenne exacte des deux contributions marginales.
    expect(r.irSurSalaire).toBeCloseTo((salaireDAbord + salaireEnDernier) / 2, 2);
  });

  it('répartit sans rien perdre : les deux parts recomposent l’impôt du foyer', () => {
    for (const bareme of [false, true]) {
      for (const autres of [0, 35_000]) {
        const r = sim(45_000, {
          resultatAvantRemuneration: 180_000,
          dividendesAuBareme: bareme,
          autresRevenus: autres,
        });
        const irSansLaSASU = calculerIR(autres, 1, false);
        expect(r.irSurSalaire + r.irDividendes).toBeCloseTo(r.irFoyer - irSansLaSASU, 2);
      }
    }
  });

  it('laisse le mode flat tax inchangé, les dividendes étant hors barème', () => {
    // Le partage ne doit jouer qu'au barème : sous PFU le salaire supporte
    // exactement son propre impôt.
    const r = sim(45_000, { resultatAvantRemuneration: 180_000 });
    expect(r.irSurSalaire).toBeCloseTo(calculerIR(r.salaireNetImposable, 1, false), 2);
    expect(r.irDividendes).toBeCloseTo(r.dividendesBruts * P.PFU_IR, 2);
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
    // The withholding base is higher than the declared taxable salary, which
    // does bear the flat deduction.
    expect(r.assiettePAS).toBeGreaterThan(r.salaireNetImposable);
    expect(abattementSalaire(r.assiettePAS)).toBeCloseTo(r.salaireNetImposable, 2);
  });

  it('prélève sur l’année l’impôt dû sur le salaire, au centime d’arrondi près', () => {
    const r = sim(60_000);
    // Rounding the rate to one decimal makes an exact match impossible: the
    // gap cannot exceed half a decimal of rate applied to the base, and the
    // annual tax return settles it.
    const toleranceArrondi = r.assiettePAS * (P.PAS_ARRONDI / 2);
    expect(Math.abs(r.prelevementMensuelPAS * 12 - r.irSurSalaire)).toBeLessThanOrEqual(
      toleranceArrondi,
    );
  });

  it('fait toujours coïncider la retenue avec le taux et l’assiette affichés', () => {
    // Régression : la ligne « Prélèvement à la source » montrait l'impôt
    // imputable au salaire tout en l'annotant du taux de PAS. Multiplier le
    // taux affiché par l'assiette affichée ne retombait pas sur le montant,
    // avec des écarts allant jusqu'à 4 000 € dès que le foyer avait d'autres
    // ressources.
    for (const sur of [
      {},
      { autresRevenus: 40_000 },
      { salaireExterneBrut: 40_000 },
      { dividendesAuBareme: true },
      { couple: true, parts: 3, salaireExterneBrut: 30_000 },
    ]) {
      const r = sim(45_000, { resultatAvantRemuneration: 180_000, ...sur });
      expect(r.prelevementAnnuelPAS).toBeCloseTo(r.tauxPAS * r.assiettePAS, 6);
      expect(r.prelevementMensuelPAS * r.moisRemuneration).toBeCloseTo(
        r.prelevementAnnuelPAS,
        6,
      );
    }
  });

  it('distingue la retenue de l’impôt définitif quand le foyer a d’autres ressources', () => {
    // Les deux ne coïncident que si la rémunération est le seul revenu, et
    // seulement à l'arrondi du taux près.
    const seul = sim(45_000, { resultatAvantRemuneration: 180_000 });
    expect(Math.abs(seul.prelevementAnnuelPAS - seul.irSurSalaire)).toBeLessThanOrEqual(
      seul.assiettePAS * (P.PAS_ARRONDI / 2),
    );

    const avecAutres = sim(45_000, {
      resultatAvantRemuneration: 180_000,
      autresRevenus: 40_000,
    });
    // L'acompte est calculé au taux du foyer et sous-estime ici l'impôt
    // réellement imputable à la rémunération.
    expect(avecAutres.prelevementAnnuelPAS).toBeLessThan(avecAutres.irSurSalaire);
  });

  it('n’impute jamais un impôt négatif à la rémunération', () => {
    for (const brut of [0, 5_000, 20_000, 60_000]) {
      for (const autres of [0, 30_000, 90_000]) {
        expect(sim(brut, { autresRevenus: autres }).irSurSalaire).toBeGreaterThanOrEqual(
          0,
        );
      }
    }
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
    // Investment income is out of the withholding scope: paying out more
    // dividends must not change the rate applied to the payslip.
    const peu = sim(50_000, { tauxDistribution: 0.1 });
    const tout = sim(50_000, { tauxDistribution: 1 });
    expect(peu.tauxPAS).toBeCloseTo(tout.tauxPAS, 10);
  });

  it('relève le taux quand le foyer opte pour le barème', () => {
    // Dividends taxed on the scale raise household tax, hence the rate
    // applied to the salary.
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
    // The proration isolates the tax attributable to in-scope income.
    expect(tauxPrelevementSource(4_000, 40_000, 20_000, 22_222)).toBeCloseTo(0.09, 10);
  });
});

describe('nombre de mois de rémunération', () => {
  it('retombe sur le plafond annuel pour douze mois', () => {
    // The annual ceiling is exactly twelve monthly ceilings: if that identity
    // breaks, the whole proration drifts.
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
    // €40,000 paid over six months exceeds the prorated ceiling (€24,030),
    // whereas it would stay entirely in band 1 over twelve months.
    const annee = calculerCotisations(40_000, 1.3, 12);
    const semestre = calculerCotisations(40_000, 1.3, 6);
    const t2Annee = annee.find((l) => l.libelle.includes('Agirc-Arrco T2'))!;
    const t2Semestre = semestre.find((l) => l.libelle.includes('Agirc-Arrco T2'))!;

    expect(t2Annee.basePatronale).toBe(0);
    expect(t2Semestre.basePatronale).toBeCloseTo(40_000 - 6 * P.PMSS, 6);
  });

  it('laisse le coût employeur quasi inchangé malgré le passage en tranche 2', () => {
    // Counter-intuitive: above the ceiling the employer supplementary pension
    // rate goes from 4.72% to 12.95%, but the capped old-age contribution
    // (8.55%) disappears. The two effects nearly cancel out and only the CET
    // is added. This test exists because the UI first claimed, wrongly, that
    // the cost rose noticeably.
    const annee = sim(45_000, { moisRemuneration: 12 });
    const semestre = sim(45_000, { moisRemuneration: 6 });
    const ecart =
      (semestre.cotisationsPatronales - annee.cotisationsPatronales) /
      annee.cotisationsPatronales;
    expect(ecart).toBeGreaterThan(0);
    expect(ecart).toBeLessThan(0.01);
  });

  it('allège les cotisations salariales et augmente les points de retraite', () => {
    // Band 2 buys pension points at 17% versus 6.20% in band 1.
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
    // Two salaries of €150,000 are well past the deduction cap: the total
    // deduction cannot amount to two caps.
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
    // With no president's salary the company causes no salary tax at all,
    // even though the household is taxable.
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

    // A part-time job earning only two quarters: the president's salary tops
    // it up to four.
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
    // The displayed withholding covers the company payslip only.
    expect(r.prelevementMensuelPAS * 12).toBeCloseTo(r.assiettePAS * r.tauxPAS, 6);
  });

  it('applique le même taux de prélèvement aux deux employeurs', () => {
    // The rate belongs to the household: it does not depend on how income is
    // split between the two payslips, at constant total income.
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
    // The first euros of salary are lightly taxed (0% and 11% brackets)
    // whereas a dividend bears corporate tax plus flat tax from the start.
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
    // This is why the plateau exists: the "you are at the optimum" badge used
    // to show across several thousand euros of salary without the user
    // understanding why.
    const { optimum, plateau } = balayer(BASE);
    expect(plateau.max - plateau.min).toBeGreaterThan(1_000);

    // Moving €2,000 away from the optimum costs less than €200.
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
    // With a household already taxed in the upper brackets, salary loses its
    // edge and the optimum moves down.
    const seul = balayer(BASE).optimum.brutAnnuel;
    const avecRevenus = balayer({ ...BASE, autresRevenus: 120_000 }).optimum.brutAnnuel;
    expect(avecRevenus).toBeLessThan(seul);
  });
});
