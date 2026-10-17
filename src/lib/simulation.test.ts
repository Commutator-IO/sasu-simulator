import { describe, expect, it } from 'vitest';
import {
  abattementSalaire,
  assietteCSG,
  balayer,
  budgetRemuneration,
  plafondCreditImpotServices,
  baremeIR,
  brutMaxPourBudget,
  calculerCotisations,
  calculerIR,
  calculerIS,
  coutEmployeur,
  decomposerSalaire,
  plafondReparti,
  plafondTranche1,
  plateauOptimum,
  valeurActuelleRente,
  seuilsCourbe,
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
  epargneSalariale: 0,
  avantagesExoneres: 0,
  cesuPrefinance: 0,
  depensesServicesPersonne: 0,
  majorationsCreditImpot: 0,
  premiereAnneeEmploiDomicile: false,
  invaliditeCreditImpot: false,
  anneeParmiMeilleures: true,
  valoriserRetraite: false,
  anneesAvantRetraite: 25,
  dureeRetraite: 25,
  tauxActualisation: 2,
  versementPER: 0,
  plafondPER: P.PER_PLAFOND_MINIMUM,
  reservesDistribuables: 0,
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

  it('applique 25 % partout si la société est inéligible, et rien sur un déficit', () => {
    expect(calculerIS(42_500, false)).toBeCloseTo(10_625, 2);
    expect(calculerIS(-10_000, true)).toBe(0);
  });
});

describe('barème de l’impôt sur le revenu', () => {
  it('exonère la première tranche puis cumule les suivantes', () => {
    expect(baremeIR(11_600)).toBe(0);
    expect(baremeIR(20_000)).toBeCloseTo((20_000 - 11_600) * 0.11, 2);
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

  it('plafonne l’avantage du quotient familial, sauf pour le quotient conjugal', () => {
    // A single parent with two children (2 shares): the benefit of the two
    // extra half-shares cannot exceed 2 × €1,807.
    const impot = calculerIR(120_000, 2, false);
    const sansEnfants = calculerIR(120_000, 1, false);
    expect(sansEnfants - impot).toBeCloseTo(2 * P.PLAFOND_DEMI_PART, 2);
    // A couple's two shares are not capped.
    expect(calculerIR(120_000, 2, true)).toBeCloseTo(baremeIR(60_000) * 2, 2);
  });

  it('abat 10 % sur les salaires, entre plancher et plafond', () => {
    expect(abattementSalaire(50_000)).toBeCloseTo(45_000, 2);
    expect(abattementSalaire(300_000)).toBeCloseTo(300_000 - P.ABATTEMENT_SALAIRE_MAX, 2);
    expect(abattementSalaire(2_000)).toBeCloseTo(2_000 - P.ABATTEMENT_SALAIRE_MIN, 2);
  });
});

describe('cotisations du président', () => {
  it('abat 1,75 % sur la CSG jusqu’à quatre Pass seulement', () => {
    expect(assietteCSG(40_000)).toBeCloseTo(40_000 * 0.9825, 2);
    const plafond = 4 * P.PASS;
    expect(assietteCSG(plafond + 50_000)).toBeCloseTo(plafond * 0.9825 + 50_000, 2);
  });

  it('ne retient aucune cotisation chômage', () => {
    const libelles = calculerCotisations(60_000, 1.3).map((l) => l.libelle.toLowerCase());
    expect(libelles.some((l) => l.includes('chômage'))).toBe(false);
    expect(libelles.some((l) => l.includes('ags'))).toBe(false);
  });

  it("ne déclenche la CET qu'au-delà d'un Pass", () => {
    const cet = (brut: number) =>
      calculerCotisations(brut, 1.3).find((l) => l.libelle.includes('CET'))!.patronal;
    expect(cet(P.PASS - 1_000)).toBe(0);
    expect(cet(P.PASS + 1_000)).toBeGreaterThan(0);
  });

  it('plafonne la tranche 2 à huit Pass', () => {
    const ligne = calculerCotisations(20 * P.PASS, 1.3).find((l) =>
      l.libelle.includes('Agirc-Arrco T2'),
    );
    expect(ligne?.basePatronale).toBeCloseTo(7 * P.PASS, 2);
  });

  it('produit un coût employeur strictement croissant, inversible', () => {
    let precedent = -1;
    for (let brut = 0; brut <= 400_000; brut += 5_000) {
      const cout = coutEmployeur(brut, 1.3);
      expect(cout).toBeGreaterThan(precedent);
      precedent = cout;
    }
    for (const budget of [10_000, 75_000, 250_000]) {
      expect(coutEmployeur(brutMaxPourBudget(budget, 1.3), 1.3)).toBeCloseTo(budget, 0);
    }
    expect(brutMaxPourBudget(0, 1.3)).toBe(0);
    expect(brutMaxPourBudget(-5_000, 1.3)).toBe(0);
  });

  it('situe les charges patronales dans la fourchette attendue', () => {
    // Below the annual ceiling, supplementary pension sits entirely in band 1:
    // the overall employer rate lands around 35-40% of gross. Past the ceiling
    // band 2 (12.95% employer) replaces band 1 (4.72%) and the rate rises.
    const bas = sim(40_000);
    const taux = bas.cotisationsPatronales / bas.brutAnnuel;
    expect(taux).toBeGreaterThan(0.33);
    expect(taux).toBeLessThan(0.42);

    const haut = sim(120_000);
    expect(haut.cotisationsPatronales / haut.brutAnnuel).toBeGreaterThan(taux);
  });

  it('laisse un net salarial entre 70 et 80 % du brut', () => {
    for (const brut of [30_000, 60_000, 120_000]) {
      expect(sim(brut).salaireNet / brut).toBeGreaterThan(0.7);
      expect(sim(brut).salaireNet / brut).toBeLessThan(0.8);
    }
    // Un salaire extérieur se décompose de la même façon.
    const d = decomposerSalaire(50_000);
    expect(d.net / 50_000).toBeGreaterThan(0.7);
    expect(d.net / 50_000).toBeLessThan(0.8);
    expect(d.netImposableAvantAbattement).toBeGreaterThan(d.net);
  });

  it('laisse la CSG des salaires à 9,2 %, non concernée par la hausse de 2026', () => {
    // The 2026 act only raises the CSG on investment income.
    const lignes = calculerCotisations(60_000, 1.3);
    const csgD = lignes.find((l) => l.libelle === 'CSG déductible')!;
    const csgND = lignes.find((l) => l.libelle === 'CSG non déductible')!;
    expect(csgD.tauxSalarial + csgND.tauxSalarial).toBeCloseTo(9.2, 10);
  });
});

describe('arbitrage rémunération / dividendes', () => {
  it('verse tout en dividendes lorsque la rémunération est nulle', () => {
    const r = sim(0);
    expect(r.salaireNet).toBe(0);
    expect(r.is).toBeCloseTo(calculerIS(150_000, true), 2);
    expect(r.dividendesBruts).toBeCloseTo(150_000 - r.is, 2);
    // Les dividendes n'ouvrent aucun droit à la retraite.
    expect(r.trimestresValides).toBe(0);
    expect(r.pointsAgircArrco).toBe(0);
    expect(r.dividendesNets).toBeGreaterThan(0);
  });

  it('valide quatre trimestres dès 600 heures de Smic', () => {
    expect(sim(4 * P.BRUT_PAR_TRIMESTRE).trimestresValides).toBe(4);
    expect(sim(4 * P.BRUT_PAR_TRIMESTRE - 1).trimestresValides).toBe(3);
  });

  it('convertit les points Agirc-Arrco en rente annuelle sans les multiplier par douze', () => {
    // At 1 PASS, a year earns about 148 points, worth about €212 of yearly pension.
    const r = sim(P.PASS);
    expect(r.pointsAgircArrco).toBeCloseTo(
      (P.PASS * P.TAUX_POINTS_T1) / P.SALAIRE_REFERENCE_AGIRC_ARRCO,
      6,
    );
    expect(r.retraiteComplementaireAnnuelle).toBeCloseTo(
      r.pointsAgircArrco * P.VALEUR_POINT_AGIRC_ARRCO,
      6,
    );
    expect(r.retraiteComplementaireAnnuelle).toBeGreaterThan(200);
    expect(r.retraiteComplementaireAnnuelle).toBeLessThan(225);
  });

  it('applique la flat tax à 31,4 %, dont 18,6 % de prélèvements sociaux', () => {
    // 12.8% income tax + 18.6% social levies since the 2026 Social Security
    // Financing Act: the flat tax is no longer 30%.
    const r = sim(0);
    expect(r.dividendesNets).toBeCloseTo(r.dividendesBruts * (1 - 0.314), 2);
    expect(r.prelevementsSociauxDividendes).toBeCloseTo(r.dividendesBruts * 0.186, 2);
  });

  it('ne dépasse jamais le budget de la société', () => {
    const r = sim(brutMaxPourBudget(150_000, P.AT_MP_DEFAUT));
    expect(r.resultatFiscal).toBeCloseTo(0, 0);
    expect(r.dividendesBruts).toBeCloseTo(0, 0);
  });

  it('rend le barème favorable à faible revenu, la flat tax à haut revenu', () => {
    const comparer = (resultat: number) => ({
      pfu: simuler({ ...BASE, resultatAvantRemuneration: resultat, brutAnnuel: 0 })
        .netEnPoche,
      bareme: simuler({
        ...BASE,
        resultatAvantRemuneration: resultat,
        brutAnnuel: 0,
        dividendesAuBareme: true,
      }).netEnPoche,
    });
    const petit = comparer(25_000);
    expect(petit.bareme).toBeGreaterThan(petit.pfu);
    const gros = comparer(400_000);
    expect(gros.pfu).toBeGreaterThan(gros.bareme);
  });
});

describe('partage de l’impôt entre salaire et dividendes', () => {
  it('partage l’impôt du barème plutôt que de servir le salaire en premier', () => {
    // Régression : au barème, le salaire était taxé comme s'il était seul et
    // les dividendes récupéraient les tranches marginales. L'impôt imputé au
    // salaire était sous-évalué de près de 7 000 €, et le « salaire net après
    // impôt » d'autant surévalué.
    const h = { resultatAvantRemuneration: 180_000, dividendesAuBareme: true };
    const r = sim(45_000, h);

    // Bornes des deux attributions extrêmes : le salaire d'abord, ou en dernier.
    const salaireDAbord = sim(45_000, { ...h, dividendesAuBareme: false }).irSurSalaire;
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

  it('ne joue pas sous flat tax, les dividendes étant hors barème', () => {
    const r = sim(45_000, { resultatAvantRemuneration: 180_000 });
    expect(r.irSurSalaire).toBeCloseTo(calculerIR(r.salaireNetImposable, 1, false), 2);
    expect(r.irDividendes).toBeCloseTo(r.dividendesBruts * P.PFU_IR, 2);
  });

  it('n’impute pas à la SASU l’impôt dû sur un salaire extérieur', () => {
    const r = sim(0, { salaireExterneBrut: 60_000 });
    // With no president's salary the company causes no salary tax at all,
    // even though the household is taxable.
    expect(r.irSurSalaire).toBeCloseTo(0, 6);
    expect(r.irFoyer).toBeGreaterThan(0);
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

  it('applique la formule de l’article 204 H, arrondie à la décimale', () => {
    expect(tauxPrelevementSource(3_000, 30_000, 30_000, 33_333)).toBeCloseTo(0.09, 10);
    // The proration isolates the tax attributable to in-scope income.
    expect(tauxPrelevementSource(4_000, 40_000, 20_000, 22_222)).toBeCloseTo(0.09, 10);
    for (const brut of [30_000, 45_000, 60_000, 90_000, 150_000]) {
      const taux = sim(brut).tauxPAS * 100;
      expect(taux).toBeCloseTo(Math.round(taux * 10) / 10, 10);
    }
  });

  it('distingue la retenue de l’impôt définitif quand le foyer a d’autres ressources', () => {
    // Rounding the rate to one decimal makes an exact match impossible even
    // when the salary is the only income: the gap cannot exceed half a decimal
    // of rate applied to the base, and the annual return settles it.
    const seul = sim(45_000, { resultatAvantRemuneration: 180_000 });
    expect(Math.abs(seul.prelevementAnnuelPAS - seul.irSurSalaire)).toBeLessThanOrEqual(
      seul.assiettePAS * (P.PAS_ARRONDI / 2),
    );

    // L'acompte est calculé au taux du foyer et sous-estime ici l'impôt
    // réellement imputable à la rémunération.
    const avecAutres = sim(45_000, {
      resultatAvantRemuneration: 180_000,
      autresRevenus: 40_000,
    });
    expect(avecAutres.prelevementAnnuelPAS).toBeLessThan(avecAutres.irSurSalaire);
  });

  it('reste nul quand le foyer n’est pas imposable ou n’est pas rémunéré', () => {
    const pauvre = sim(14_000, { resultatAvantRemuneration: 20_000 });
    expect(pauvre.irSurSalaire).toBe(0);
    expect(pauvre.tauxPAS).toBe(0);
    expect(pauvre.prelevementMensuelPAS).toBe(0);

    const sansSalaire = sim(0);
    expect(sansSalaire.assiettePAS).toBe(0);
    expect(sansSalaire.tauxPAS).toBe(0);
  });

  it('croît avec la rémunération sans atteindre le taux marginal', () => {
    let precedent = -1;
    for (const brut of [20_000, 40_000, 60_000, 100_000, 140_000]) {
      const r = sim(brut, { resultatAvantRemuneration: 300_000 });
      expect(r.tauxPAS).toBeGreaterThanOrEqual(precedent);
      expect(r.tauxPAS).toBeLessThan(r.tmi);
      precedent = r.tauxPAS;
    }
  });

  it('exclut du champ les dividendes soumis au PFU, mais pas ceux au barème', () => {
    // Investment income is out of the withholding scope: paying out more
    // dividends must not change the rate applied to the payslip.
    expect(sim(50_000, { tauxDistribution: 0.1 }).tauxPAS).toBeCloseTo(
      sim(50_000, { tauxDistribution: 1 }).tauxPAS,
      10,
    );
    // Opting for the scale brings them back in and raises household tax.
    expect(sim(50_000, { dividendesAuBareme: true }).tauxPAS).toBeGreaterThan(
      sim(50_000, { dividendesAuBareme: false }).tauxPAS,
    );
  });

  it('n’applique le taux du foyer qu’à la fiche de paie de la société', () => {
    const r = sim(45_000, { salaireExterneBrut: 30_000 });
    // The household base covers both salaries...
    expect(r.assiettePASFoyer - r.assiettePAS).toBeCloseTo(
      // The outside employer applies its share of the ceiling.
      decomposerSalaire(30_000, 12, 45_000).netImposableAvantAbattement,
      6,
    );
    // ...but the withholding shown is the one the company operates.
    expect(r.prelevementAnnuelPAS).toBeCloseTo(r.tauxPAS * r.assiettePAS, 6);
  });
});

describe('nombre de mois de rémunération', () => {
  it('proratise le plafond de tranche 1, et borne les valeurs aberrantes', () => {
    // The annual ceiling is exactly twelve monthly ceilings: if that identity
    // breaks, the whole proration drifts.
    expect(plafondTranche1(12)).toBeCloseTo(P.PASS, 10);
    expect(12 * P.PMSS).toBeCloseTo(P.PASS, 10);
    expect(plafondTranche1(6)).toBeCloseTo(6 * P.PMSS, 10);
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
    const t2 = (mois: number) =>
      calculerCotisations(40_000, 1.3, mois).find((l) =>
        l.libelle.includes('Agirc-Arrco T2'),
      )!.basePatronale;
    expect(t2(12)).toBe(0);
    expect(t2(6)).toBeCloseTo(40_000 - 6 * P.PMSS, 6);

    // La CET suit le même plafond proratisé.
    const cet = (mois: number) =>
      calculerCotisations(30_000, 1.3, mois).find((l) => l.libelle.includes('CET'))!
        .patronal;
    expect(cet(12)).toBe(0);
    expect(cet(6)).toBeGreaterThan(0);

    // Ainsi que le plafond de l'abattement CSG.
    const plafond6 = 4 * plafondTranche1(6);
    expect(assietteCSG(plafond6 + 10_000, 6)).toBeCloseTo(plafond6 * 0.9825 + 10_000, 6);
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

    // Côté salarié en revanche, la tranche 2 achète des points à 17 % contre
    // 6,20 % en tranche 1 : moins de cotisations, plus de droits.
    expect(semestre.cotisationsSalariales).toBeLessThan(annee.cotisationsSalariales);
    expect(semestre.salaireNet).toBeGreaterThan(annee.salaireNet);
    expect(semestre.pointsAgircArrco).toBeGreaterThan(annee.pointsAgircArrco * 1.5);
  });

  it('ne change pas les trimestres validés, qui dépendent du salaire annuel', () => {
    const brut = 4 * P.BRUT_PAR_TRIMESTRE;
    expect(sim(brut, { moisRemuneration: 12 }).trimestresValides).toBe(4);
    expect(sim(brut, { moisRemuneration: 3 }).trimestresValides).toBe(4);
  });

  it('étale la retenue à la source sur le nombre de paies réel', () => {
    const r = sim(60_000, { moisRemuneration: 6 });
    expect(r.prelevementMensuelPAS * 6).toBeCloseTo(r.prelevementAnnuelPAS, 6);
  });

  it('respecte le budget de la société quel que soit le nombre de mois', () => {
    for (const mois of [3, 6, 12]) {
      const brutMax = brutMaxPourBudget(150_000, P.AT_MP_DEFAUT, mois);
      expect(coutEmployeur(brutMax, P.AT_MP_DEFAUT, mois)).toBeCloseTo(150_000, 0);
    }
  });
});

describe('salaire perçu chez un autre employeur', () => {
  // Hand-checked case: €45,000 from the company and €40,000 from an outside
  // employer, €85,000 in all, above the €48,060 ceiling. Each employer caps at
  // its pro rata share: the company at 48,060 × 45/85 = €25,443.53, the
  // outside job at 48,060 × 40/85 = €22,616.47.
  const S = 45_000;
  const E = 40_000;
  const partSASU = (P.PASS * S) / (S + E);
  const partExterne = (P.PASS * E) / (S + E);

  it('répartit le plafond entre employeurs au prorata des salaires', () => {
    expect(plafondReparti(P.PASS, S, E)).toBeCloseTo(25_443.53, 2);
    expect(plafondReparti(P.PASS, E, S)).toBeCloseTo(22_616.47, 2);
    expect(plafondReparti(P.PASS, S, E) + plafondReparti(P.PASS, E, S)).toBeCloseTo(P.PASS, 6);
    expect(plafondReparti(P.PASS, S, 0)).toBe(P.PASS);
    expect(plafondReparti(P.PASS, 0, E)).toBe(0);
  });

  it('cotise sur la part de plafond de la SASU, et non sur un plafond entier', () => {
    const r = sim(S, { salaireExterneBrut: E });
    const ligne = (k: string) => r.lignes.find((l) => l.libelle.includes(k))!;
    expect(r.plafondApplique).toBeCloseTo(partSASU, 6);
    expect(ligne('Vieillesse plafonnée').basePatronale).toBeCloseTo(partSASU, 6);
    expect(ligne('Agirc-Arrco T2').basePatronale).toBeCloseTo(S - partSASU, 6);
    // Combined pay is above the ceiling, so the CET is due on the whole salary
    // even though €45,000 alone is below it.
    expect(ligne('CET').basePatronale).toBe(S);
  });

  it("corrige le net en poche d'un cas vérifié à la main", () => {
    const r = sim(S, { salaireExterneBrut: E });
    const t1Salarie = 6.9 + 3.15 + 0.86; // capped old-age, Agirc-Arrco T1, CEG T1
    const t2Salarie = 8.64 + 1.08; // Agirc-Arrco T2, CEG T2
    const t1Patronal = 8.55 + 4.72 + 1.29 + 0.1; // same, plus Fnal
    const t2Patronal = 12.95 + 1.62;

    // Employee side: the slice moved from band 1 to band 2 bears 1.19 points
    // less, minus the 0.14% CET now due.
    const economieSalariale = ((t1Salarie - t2Salarie) * (S - partSASU) - 0.14 * S) / 100;
    expect(sim(S).cotisationsSalariales - r.cotisationsSalariales).toBeCloseTo(
      economieSalariale,
      6,
    );
    expect(economieSalariale).toBeCloseTo(169.72, 2);

    // Employer side: 0.09 point saved on the same slice, 0.21% of CET added.
    const surcoutPatronal = (0.21 * S - (t1Patronal - t2Patronal) * (S - partSASU)) / 100;
    expect(r.cotisationsPatronales - sim(S).cotisationsPatronales).toBeCloseTo(
      surcoutPatronal,
      6,
    );
    expect(surcoutPatronal).toBeCloseTo(76.9, 2);

    // The outside payslip gains the same way, and that gain is caused by the
    // company salary.
    expect(r.effetPlafondExterne).toBeCloseTo(
      ((t1Salarie - t2Salarie) * (E - partExterne) - 0.14 * E) / 100,
      6,
    );
    expect(r.effetPlafondExterne).toBeCloseTo(150.86, 2);

    // Before the split, each employer applied a full ceiling and the simulator
    // showed €74,104 of take-home: €194 too little.
    expect(r.netEnPoche).toBeCloseTo(74_298.82, 2);
    expect(r.netEnPoche - 74_104.36).toBeCloseTo(194.46, 2);
  });

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

  it('renchérit la rémunération de président et déplace l’optimum', () => {
    const seul = sim(40_000);
    const cumul = sim(40_000, { salaireExterneBrut: 45_000 });
    expect(cumul.irSurSalaire).toBeGreaterThan(seul.irSurSalaire);
    expect(cumul.tmi).toBeGreaterThanOrEqual(seul.tmi);
    expect(balayer({ ...BASE, salaireExterneBrut: 45_000 }).optimum.brutAnnuel).toBeLessThan(
      balayer(BASE).optimum.brutAnnuel,
    );
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
});

describe('réserves distribuables des exercices antérieurs', () => {
  const AVEC = { resultatAvantRemuneration: 120_000, reservesDistribuables: 200_000 };
  const SANS = { resultatAvantRemuneration: 120_000 };

  it('ne les soumet pas une seconde fois à l’impôt sur les sociétés', () => {
    // L'IS a été payé lors des exercices d'origine.
    const sans = sim(45_000, SANS);
    const avec = sim(45_000, AVEC);
    expect(avec.is).toBeCloseTo(sans.is, 6);
    expect(avec.resultatFiscal).toBeCloseTo(sans.resultatFiscal, 6);
    expect(avec.dividendesBruts - sans.dividendesBruts).toBeCloseTo(200_000, 6);
  });

  it('les ajoute au distribuable, et laisse en réserve le reste', () => {
    const r = sim(45_000, { ...AVEC, tauxDistribution: 0.25 });
    expect(r.distribuable).toBeCloseTo(r.resultatNet + 200_000, 6);
    expect(r.dividendesBruts).toBeCloseTo(r.distribuable * 0.25, 6);
    expect(r.reserves).toBeCloseTo(r.distribuable - r.dividendesBruts, 6);
    expect(r.reserves).toBeGreaterThan(0);
  });

  it('ne change l’impôt sur la rémunération que sous option barème', () => {
    // Sous flat tax les dividendes restent hors barème : leur montant n'a
    // aucun effet sur l'impôt du salaire, si gros soient-ils.
    const sansPfu = sim(45_000, SANS);
    const avecPfu = sim(45_000, AVEC);
    expect(avecPfu.irSurSalaire).toBeCloseTo(sansPfu.irSurSalaire, 6);
    expect(avecPfu.tauxPAS).toBeCloseTo(sansPfu.tauxPAS, 10);

    const sansBareme = sim(45_000, { ...SANS, dividendesAuBareme: true });
    const avecBareme = sim(45_000, { ...AVEC, dividendesAuBareme: true });
    expect(avecBareme.irSurSalaire).toBeGreaterThan(sansBareme.irSurSalaire);
    expect(avecBareme.tmi).toBeGreaterThanOrEqual(sansBareme.tmi);
  });

  it('laisse l’optimum intact sous flat tax, et l’écrase sous barème', () => {
    const sansReserves = balayer({ ...BASE, ...SANS }).optimum;
    const avecReserves = balayer({ ...BASE, ...AVEC }).optimum;
    expect(avecReserves.brutAnnuel).toBeCloseTo(sansReserves.brutAnnuel, 0);
    expect(avecReserves.brutAnnuel).toBeGreaterThan(10_000);

    // Sous barème, la rémunération est taxée au marginal.
    const bareme = balayer({ ...BASE, ...AVEC, dividendesAuBareme: true }).optimum;
    expect(bareme.brutAnnuel).toBeLessThan(5_000);
  });

  it('signale le franchissement probable du seuil des hauts revenus', () => {
    expect(sim(45_000, SANS).cehrPossible).toBe(false);
    expect(sim(45_000, AVEC).cehrPossible).toBe(true);
    // Le seuil double pour un couple soumis à imposition commune.
    expect(sim(45_000, { ...AVEC, couple: true, parts: 2 }).cehrPossible).toBe(false);
  });

  it('ignore une valeur négative', () => {
    const r = sim(45_000, { ...SANS, reservesDistribuables: -50_000 });
    expect(r.reservesAnterieures).toBe(0);
    expect(r.distribuable).toBeCloseTo(Math.max(0, r.resultatNet), 6);
  });
});

describe('recherche de l’optimum', () => {
  it('trouve un optimum au moins aussi bon que tous les points balayés', () => {
    const { points, optimum } = balayer(BASE);
    for (const p of points) {
      expect(optimum.netEnPoche).toBeGreaterThanOrEqual(p.net - 0.01);
    }
    expect(optimum.brutAnnuel).toBeGreaterThanOrEqual(0);
    expect(optimum.coutEmployeur).toBeLessThanOrEqual(150_000 + 1);
  });

  it('recommande une rémunération non nulle sur un résultat courant', () => {
    // The first euros of salary are lightly taxed (0% and 11% brackets)
    // whereas a dividend bears corporate tax plus flat tax from the start.
    expect(balayer(BASE).optimum.brutAnnuel).toBeGreaterThan(5_000);
  });

  it('encadre l’optimum par un plateau, et n’y admet que ce qui y a sa place', () => {
    const { optimum, plateau } = balayer(BASE);
    expect(plateau.min).toBeLessThanOrEqual(optimum.brutAnnuel);
    expect(plateau.max).toBeGreaterThanOrEqual(optimum.brutAnnuel);

    for (let i = 0; i <= 20; i++) {
      const brut = plateau.min + ((plateau.max - plateau.min) * i) / 20;
      const net = simuler({ ...BASE, brutAnnuel: brut }).netEnPoche;
      expect(optimum.netEnPoche - net).toBeLessThanOrEqual(plateau.tolerance + 0.01);
    }
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
    expect(balayer({ ...BASE, autresRevenus: 120_000 }).optimum.brutAnnuel).toBeLessThan(
      balayer(BASE).optimum.brutAnnuel,
    );
  });
});

describe('avantages versés hors salaire', () => {
  const BRUT = 30_000;

  it('déduit les avantages exonérés du bénéfice et les verse en entier', () => {
    const sans = sim(BRUT);
    const avec = sim(BRUT, { avantagesExoneres: 2_000 });
    expect(avec.resultatFiscal).toBeCloseTo(sans.resultatFiscal - 2_000, 6);
    // The profit sits in the 25% band: €2,000 less of it saves €500 of tax.
    expect(sans.is - avec.is).toBeCloseTo(2_000 * P.IS_TAUX_NORMAL, 6);
    expect(avec.avantagesNets).toBe(2_000);
    expect(avec.csgCrdsEpargneSalariale).toBe(0);
  });

  it("retient la CSG-CRDS sur la totalité de l'épargne salariale", () => {
    const r = sim(BRUT, { epargneSalariale: 10_000 });
    expect(P.CSG_CRDS_EPARGNE_SALARIALE).toBeCloseTo(0.097, 6);
    expect(r.csgCrdsEpargneSalariale).toBeCloseTo(970, 6);
    expect(r.avantagesNets).toBeCloseTo(9_030, 6);
  });

  it('rapporte plus que le même montant distribué en dividendes', () => {
    // A euro of benefit escapes corporate tax and the flat tax: it is worth
    // more in the pocket than the dividends it displaces.
    const sans = sim(BRUT);
    const avec = sim(BRUT, { epargneSalariale: 5_000 });
    expect(avec.netEnPoche).toBeGreaterThan(sans.netEnPoche);
    expect(avec.netEnPoche - sans.netEnPoche).toBeLessThan(avec.avantagesNets);
    // The levy is counted, so the overall total stays balanced.
    expect(avec.totalPrelevements - sans.totalPrelevements).toBeCloseTo(
      avec.csgCrdsEpargneSalariale - (sans.is - avec.is) -
        (sans.prelevementsSociauxDividendes - avec.prelevementsSociauxDividendes) -
        (sans.irTotal - avec.irTotal),
      6,
    );
  });

  it('réduit le salaire que la société peut financer', () => {
    const h = { ...BASE, avantagesExoneres: 20_000 };
    expect(budgetRemuneration(h)).toBe(BASE.resultatAvantRemuneration - 20_000);
    const { points, optimum } = balayer(h);
    expect(points.at(-1)!.brut).toBeCloseTo(brutMaxPourBudget(130_000, BASE.tauxATMP), 6);
    expect(points.at(-1)!.brut).toBeLessThan(balayer(BASE).points.at(-1)!.brut);
    expect(optimum.avantagesNets).toBe(20_000);
  });
});

describe('retraite acquise dans l’année', () => {
  it('ajoute 2 % du salaire plafonné à la retraite de base', () => {
    expect(sim(40_000).retraiteBaseAnnuelle).toBeCloseTo((0.5 * 40_000) / 25, 6);
    // Above the ceiling the base pension stops growing.
    expect(sim(90_000).retraiteBaseAnnuelle).toBeCloseTo((0.5 * P.PASS) / 25, 6);
    expect(sim(40_000, { anneeParmiMeilleures: false }).retraiteBaseAnnuelle).toBe(0);
  });

  it("ne crédite à la SASU que ce qu'elle ajoute au-dessus d'un emploi extérieur", () => {
    const r = sim(30_000, { salaireExterneBrut: 30_000 });
    expect(r.retraiteBaseAnnuelle).toBeCloseTo((0.5 * (P.PASS - 30_000)) / 25, 6);
  });

  it('déduit les prélèvements sociaux des pensions', () => {
    const r = sim(40_000);
    expect(r.retraiteAcquiseBrute).toBeCloseTo(
      r.retraiteBaseAnnuelle + r.retraiteComplementaireAnnuelle,
      6,
    );
    expect(r.retraiteAcquiseNette).toBeCloseTo(r.retraiteAcquiseBrute * (1 - 0.091), 6);
  });

  it('divise par deux la rente achetée par euro de coût au-delà du PASS', () => {
    const marginal = (brut: number) => {
      const a = sim(brut);
      const b = sim(brut + 1_000);
      return (
        (b.retraiteAcquiseBrute - a.retraiteAcquiseBrute) / (b.coutEmployeur - a.coutEmployeur)
      );
    };
    expect(marginal(60_000)).toBeLessThan(marginal(30_000) * 0.6);
  });

  it('actualise la rente', () => {
    expect(valeurActuelleRente(1_000, 0, 20, 0)).toBe(20_000);
    expect(valeurActuelleRente(1_000, 10, 20, 0.02)).toBeCloseTo(
      1_000 * ((1 - 1.02 ** -20) / 0.02) * 1.02 ** -10,
      6,
    );
  });

  it('pousse l’optimum vers le PASS quand on valorise la retraite', () => {
    const DEFAUT = { ...BASE, resultatAvantRemuneration: P.RESULTAT_PAR_DEFAUT };
    const sans = balayer(DEFAUT).optimum;
    const avec = balayer({ ...DEFAUT, valoriserRetraite: true }).optimum;
    expect(sans.critere).toBe(sans.netEnPoche);
    expect(avec.brutAnnuel - sans.brutAnnuel).toBeGreaterThan(15_000);
    expect(Math.abs(avec.brutAnnuel - P.PASS)).toBeLessThan(2_000);
    // Off by default: the recommendation does not change unless asked.
    expect(balayer(DEFAUT).optimum.brutAnnuel).toBe(sans.brutAnnuel);
  });
});

describe('CESU préfinancé et crédit d’impôt emploi à domicile', () => {
  // Profit stays in the 15% corporate-tax band and dividends go to the flat
  // tax, as in the worked example of issue #13.
  const CAS = { resultatAvantRemuneration: 60_000 } as const;
  const gain = (depenses: number) => {
    const sans = sim(15_000, { ...CAS, depensesServicesPersonne: depenses });
    const avec = sim(15_000, {
      ...CAS,
      depensesServicesPersonne: depenses,
      cesuPrefinance: P.PLAFOND_AIDE_SERVICES_PERSONNE,
    });
    expect(avec.resultatFiscal).toBeLessThan(P.IS_SEUIL_TAUX_REDUIT);
    return avec.netEnPoche - sans.netEnPoche;
  };

  it('rapporte environ 1 080 € quand les dépenses dépassent plafond + aide', () => {
    // €2,591 of aid against €2,591 × 0.85 × 0.686 of dividends, credit intact.
    expect(gain(14_591)).toBeCloseTo(2_591 - 2_591 * 0.85 * (1 - P.PFU_TOTAL), 1);
    expect(gain(14_591)).toBeCloseTo(1_080, -1);
  });

  it('fait perdre environ 215 € quand les dépenses restent sous le plafond', () => {
    // Half the aid comes off the credit: €1,295.50 lost.
    expect(gain(12_000)).toBeCloseTo(
      2_591 - 2_591 * P.CI_SAP_TAUX - 2_591 * 0.85 * (1 - P.PFU_TOTAL),
      1,
    );
    expect(gain(12_000)).toBeCloseTo(-215, -1);
  });

  it('signale le seuil à partir duquel l’aide ne réduit plus le crédit', () => {
    const r = sim(15_000, { depensesServicesPersonne: 12_000, cesuPrefinance: 2_591 });
    expect(r.seuilRentabiliteCesu).toBe(14_591);
    expect(r.effetCesuSurCredit).toBeCloseTo(-1_295.5, 6);
    expect(r.creditImpotServicesSansAide).toBe(6_000);
  });

  it("borne l'aide à son plafond et à la dépense qu'elle finance", () => {
    expect(sim(15_000, { depensesServicesPersonne: 20_000, cesuPrefinance: 9_000 }).cesuVerse).toBe(
      P.PLAFOND_AIDE_SERVICES_PERSONNE,
    );
    expect(sim(15_000, { depensesServicesPersonne: 1_000, cesuPrefinance: 2_000 }).cesuVerse).toBe(
      1_000,
    );
  });

  it('applique les plafonds du crédit selon la situation', () => {
    const base = { majorationsCreditImpot: 0, premiereAnneeEmploiDomicile: false, invaliditeCreditImpot: false };
    expect(plafondCreditImpotServices(base)).toBe(12_000);
    expect(plafondCreditImpotServices({ ...base, majorationsCreditImpot: 1 })).toBe(13_500);
    expect(plafondCreditImpotServices({ ...base, majorationsCreditImpot: 5 })).toBe(15_000);
    expect(plafondCreditImpotServices({ ...base, premiereAnneeEmploiDomicile: true })).toBe(15_000);
    expect(
      plafondCreditImpotServices({ ...base, premiereAnneeEmploiDomicile: true, majorationsCreditImpot: 3 }),
    ).toBe(18_000);
    expect(plafondCreditImpotServices({ ...base, invaliditeCreditImpot: true })).toBe(20_000);
  });
});

describe('versements sur un PER individuel', () => {
  it('déduit le versement dans la limite du plafond disponible', () => {
    const r = sim(60_000, { versementPER: 10_000, plafondPER: 4_710 });
    expect(r.deductionPER).toBe(4_710);
    expect(r.economieImpotPER).toBeCloseTo(sim(60_000).irFoyer - r.irFoyer, 6);
    // Still in the 30% bracket after the deduction: it all saves 30%.
    expect(r.tmi).toBe(0.3);
    expect(r.economieImpotPER).toBeCloseTo(4_710 * 0.3, 6);
  });

  it('ne déduit rien de revenus soumis à la seule flat tax', () => {
    // No salary, dividends at the flat tax: nothing is taxed at the scale.
    const r = sim(0, { versementPER: 5_000, plafondPER: 5_000 });
    expect(r.deductionPER).toBe(0);
    expect(r.economieImpotPER).toBe(0);
  });

  it('déplace l’optimum vers plus de salaire', () => {
    // The deduction frees the bottom of the scale, so salary stays cheaper
    // than dividends over a wider range: the recommendation changes by more
    // than €10,000 of gross pay.
    const DEFAUT = { ...BASE, resultatAvantRemuneration: P.RESULTAT_PAR_DEFAUT };
    const sans = balayer(DEFAUT).optimum.brutAnnuel;
    const avec = balayer({ ...DEFAUT, versementPER: 10_000, plafondPER: 10_000 }).optimum
      .brutAnnuel;
    expect(avec - sans).toBeGreaterThan(10_000);
  });

  it("ouvre le plafond de l'année suivante sur les salaires de l'année", () => {
    expect(sim(0).plafondPERAnneeSuivante).toBeCloseTo(0.1 * P.PASS, 6);
    expect(sim(20 * P.PASS).plafondPERAnneeSuivante).toBeCloseTo(0.8 * P.PASS, 6);
    const r = sim(120_000);
    expect(r.plafondPERAnneeSuivante).toBeCloseTo(0.1 * r.salaireNetImposable, 6);
  });
});

describe('seuils où la courbe change de pente', () => {
  const DEFAUT = { ...BASE, resultatAvantRemuneration: P.RESULTAT_PAR_DEFAUT };
  const parLibelle = (h: typeof BASE) =>
    Object.fromEntries(balayer(h).seuils.map((s) => [s.libelle, s.brut]));

  it('place la tranche à 30 % là où le revenu imposable atteint son plafond', () => {
    const brut = parLibelle(DEFAUT)['TMI 30 %'];
    expect(brut).toBeGreaterThan(39_000);
    expect(brut).toBeLessThan(41_000);
    expect(sim(brut - 10, DEFAUT).revenuImposable).toBeLessThan(P.BAREME_IR[1].plafond);
    expect(sim(brut + 10, DEFAUT).revenuImposable).toBeGreaterThan(P.BAREME_IR[1].plafond);
  });

  it("repère le passage de l'IS à 15 % et le PASS", () => {
    const seuils = parLibelle(DEFAUT);
    expect(sim(seuils['IS 15 %'] + 10, DEFAUT).resultatFiscal).toBeLessThan(P.IS_SEUIL_TAUX_REDUIT);
    expect(seuils.PASS).toBeCloseTo(P.PASS, 0);
  });

  it("ne marque pas l'entrée dans une tranche que la décote neutralise", () => {
    expect(parLibelle(DEFAUT)['TMI 11 %']).toBeUndefined();
  });

  it('ignore le taux réduit d’IS quand la société n’y a pas droit', () => {
    expect(parLibelle({ ...DEFAUT, eligibleISReduit: false })['IS 15 %']).toBeUndefined();
  });

  it('décale la tranche à 30 % avec le quotient familial', () => {
    const { points } = balayer({ ...DEFAUT, parts: 2, couple: true });
    const libelles = seuilsCourbe({ ...DEFAUT, parts: 2, couple: true }, points).map((s) => s.libelle);
    expect(libelles).not.toContain('TMI 30 %');
  });
});

describe('invariants, quelle que soit la situation', () => {
  // Un seul balayage remplace les vérifications éparpillées : chaque fois
  // qu'une fonctionnalité s'ajoutait — mois de rémunération, salaire
  // extérieur, réserves antérieures — sa propre copie de ces contrôles
  // apparaissait à côté des précédentes.
  const cas: Hypotheses[] = [];
  for (const brutAnnuel of [0, 25_000, 60_000, 100_000]) {
    for (const dividendesAuBareme of [false, true]) {
      for (const autresRevenus of [0, 35_000]) {
        for (const salaireExterneBrut of [0, 40_000]) {
          for (const moisRemuneration of [3, 12]) {
            for (const reservesDistribuables of [0, 200_000]) {
              for (const tauxDistribution of [0.4, 1]) {
                cas.push({
                  ...BASE,
                  brutAnnuel,
                  dividendesAuBareme,
                  autresRevenus,
                  salaireExterneBrut,
                  moisRemuneration,
                  reservesDistribuables,
                  tauxDistribution,
                });
              }
            }
          }
        }
      }
    }
  }

  /**
   * Chaque cas porte son étiquette : un balayage qui échoue doit dire lequel,
   * sans quoi il faut instrumenter à la main pour le retrouver. `expect.soft`
   * les signale tous d'un coup au lieu de s'arrêter au premier.
   */
  const nom = (h: Hypotheses) =>
    `brut=${h.brutAnnuel} mois=${h.moisRemuneration} externe=${h.salaireExterneBrut}` +
    ` autres=${h.autresRevenus} reserves=${h.reservesDistribuables}` +
    ` distrib=${h.tauxDistribution} bareme=${h.dividendesAuBareme}`;

  it('couvre un éventail représentatif', () => {
    expect(cas.length).toBeGreaterThan(200);
  });

  it('conserve l’équilibre : résultat et réserves = net en poche + réserves + prélèvements', () => {
    for (const h of cas) {
      const r = simuler(h);
      expect.soft(r.netEnPoche + r.reserves + r.totalPrelevements, nom(h)).toBeCloseTo(
        r.resultatAvantRemuneration + r.reservesAnterieures,
        4,
      );
    }
  });

  it('recompose le net en poche à partir des deux chiffres affichés', () => {
    // Le panneau de résultat affiche le net en poche, puis le salaire net
    // après impôt et les dividendes nets. Les deux doivent en faire la somme
    // exacte, sans quoi le lecteur soupçonne à raison une incohérence.
    for (const h of cas) {
      const r = simuler(h);
      expect
        .soft(r.salaireNetApresImpot + r.dividendesNets + r.avantagesNets, nom(h))
        .toBeCloseTo(r.netEnPoche, 6);
      // Without an outside job the displayed salary is the payslip minus its tax.
      if (h.salaireExterneBrut === 0) {
        expect
          .soft(r.salaireNetApresImpot, nom(h))
          .toBeCloseTo(r.salaireNet - r.irSurSalaire, 6);
      }
    }
  });

  it('répartit l’impôt du foyer sans rien perdre ni inventer', () => {
    for (const h of cas) {
      const r = simuler(h);
      // Ce que la SASU n'explique pas reste imputé au reste du foyer.
      const irSansLaSASU = simuler({
        ...h,
        brutAnnuel: 0,
        tauxDistribution: 0,
        reservesDistribuables: 0,
      }).irFoyer;
      expect
        .soft(r.irSurSalaire + r.irDividendes, nom(h))
        .toBeCloseTo(r.irFoyer - irSansLaSASU, 2);
      // Aucune part négative : un impôt imputé au salaire ne peut pas réduire
      // celui du foyer.
      expect.soft(r.irSurSalaire, nom(h)).toBeGreaterThanOrEqual(0);
      expect.soft(r.irDividendes, nom(h)).toBeGreaterThanOrEqual(0);
    }
  });

  it('fait toujours coïncider la retenue avec le taux et l’assiette affichés', () => {
    // Régression : la ligne « Prélèvement à la source » montrait l'impôt
    // imputable au salaire tout en l'annotant du taux de PAS. Multiplier le
    // taux affiché par l'assiette affichée ne retombait pas sur le montant,
    // avec des écarts allant jusqu'à 4 000 € dès que le foyer avait d'autres
    // ressources.
    for (const h of cas) {
      const r = simuler(h);
      expect.soft(r.prelevementAnnuelPAS, nom(h)).toBeCloseTo(r.tauxPAS * r.assiettePAS, 6);
      expect
        .soft(r.prelevementMensuelPAS * r.moisRemuneration, nom(h))
        .toBeCloseTo(r.prelevementAnnuelPAS, 6);
    }
  });
});
