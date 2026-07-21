import { describe, expect, it } from 'vitest';
import { decoderEtat, encoderEtat, type EtatPartage } from './url';
import { brutMaxPourBudget, coutEmployeur } from './simulation';
import * as P from './parametres2026';

const DEFAUTS: EtatPartage = {
  base: {
    resultatAvantRemuneration: P.RESULTAT_PAR_DEFAUT,
    tauxDistribution: 1,
    parts: 1,
    couple: false,
    autresRevenus: 0,
    salaireExterneBrut: 0,
    moisRemuneration: 12,
    tauxATMP: P.AT_MP_DEFAUT,
    eligibleISReduit: true,
    dividendesAuBareme: false,
  },
  brut: 45_000,
};

const avec = (modifs: Partial<EtatPartage['base']>, brut = DEFAUTS.brut): EtatPartage => ({
  base: { ...DEFAUTS.base, ...modifs },
  brut,
});

describe('encodage', () => {
  it('ne produit aucun paramètre pour un état par défaut', () => {
    expect(encoderEtat(DEFAUTS, DEFAUTS)).toBe('');
  });

  it('n’écrit que ce qui diffère des valeurs par défaut', () => {
    const url = encoderEtat(avec({ couple: true }), DEFAUTS);
    expect(url).toBe('?couple=1');
  });

  it('exprime le taux de distribution en pourcentage entier', () => {
    const url = encoderEtat(avec({ tauxDistribution: 0.45 }), DEFAUTS);
    expect(url).toBe('?distribution=45');
  });

  it('n’écrit pas de décimales parasites', () => {
    const url = encoderEtat(avec({}, 23_366.66666), DEFAUTS);
    expect(url).toBe('?brut=23367');
  });

  it('garde deux décimales pour le taux AT/MP', () => {
    expect(encoderEtat(avec({ tauxATMP: 2.35 }), DEFAUTS)).toBe('?atmp=2.35');
  });
});

describe('aller-retour', () => {
  it('restitue un état complet', () => {
    const etat = avec(
      {
        resultatAvantRemuneration: 250_000,
        tauxDistribution: 0.6,
        parts: 2.5,
        couple: true,
        autresRevenus: 18_000,
        salaireExterneBrut: 32_000,
        moisRemuneration: 7,
        tauxATMP: 2.4,
        eligibleISReduit: false,
        dividendesAuBareme: true,
      },
      61_500,
    );
    expect(decoderEtat(encoderEtat(etat, DEFAUTS), DEFAUTS)).toEqual(etat);
  });

  it('restitue les valeurs par défaut depuis une URL vide', () => {
    expect(decoderEtat('', DEFAUTS)).toEqual(DEFAUTS);
    expect(decoderEtat('?', DEFAUTS)).toEqual(DEFAUTS);
  });

  it('survit à un aller-retour répété', () => {
    const etat = avec({ couple: true, parts: 3 }, 30_000);
    const un = decoderEtat(encoderEtat(etat, DEFAUTS), DEFAUTS);
    const deux = decoderEtat(encoderEtat(un, DEFAUTS), DEFAUTS);
    expect(deux).toEqual(un);
  });
});

describe('robustesse face à une URL trafiquée', () => {
  it('ignore les valeurs non numériques', () => {
    const r = decoderEtat('?resultat=abc&brut=<script>&mois=null', DEFAUTS);
    expect(r.base.resultatAvantRemuneration).toBe(DEFAUTS.base.resultatAvantRemuneration);
    expect(r.brut).toBe(DEFAUTS.brut);
    expect(r.base.moisRemuneration).toBe(12);
  });

  it('ne laisse passer ni NaN ni Infinity', () => {
    const r = decoderEtat('?resultat=NaN&brut=Infinity&atmp=-Infinity', DEFAUTS);
    expect(Number.isFinite(r.base.resultatAvantRemuneration)).toBe(true);
    expect(Number.isFinite(r.brut)).toBe(true);
    expect(Number.isFinite(r.base.tauxATMP)).toBe(true);
  });

  it('borne les valeurs négatives', () => {
    const r = decoderEtat('?resultat=-50000&brut=-1&autresRevenus=-9', DEFAUTS);
    expect(r.base.resultatAvantRemuneration).toBe(0);
    expect(r.brut).toBe(0);
    expect(r.base.autresRevenus).toBe(0);
  });

  it('borne les valeurs démesurées', () => {
    const r = decoderEtat('?resultat=99999999999999&mois=999&atmp=5000', DEFAUTS);
    expect(r.base.resultatAvantRemuneration).toBeLessThanOrEqual(100_000_000);
    expect(r.base.moisRemuneration).toBe(12);
    expect(r.base.tauxATMP).toBe(20);
  });

  it('borne le taux de distribution entre 0 et 1', () => {
    expect(decoderEtat('?distribution=500', DEFAUTS).base.tauxDistribution).toBe(1);
    expect(decoderEtat('?distribution=-20', DEFAUTS).base.tauxDistribution).toBe(0);
  });

  it('garantit au moins deux parts à un couple', () => {
    // A hand-edited URL must not produce an inconsistent household.
    const r = decoderEtat('?couple=1&parts=1', DEFAUTS);
    expect(r.base.parts).toBe(2);
  });

  it('accepte les booléens sous leurs deux formes et rejette le reste', () => {
    expect(decoderEtat('?couple=true', DEFAUTS).base.couple).toBe(true);
    expect(decoderEtat('?couple=0', DEFAUTS).base.couple).toBe(false);
    expect(decoderEtat('?couple=peut-être', DEFAUTS).base.couple).toBe(
      DEFAUTS.base.couple,
    );
  });

  it('ignore les paramètres inconnus', () => {
    expect(decoderEtat('?inconnu=1&autre=2', DEFAUTS)).toEqual(DEFAUTS);
  });

  it('ne se laisse pas troubler par un paramètre répété', () => {
    const r = decoderEtat('?brut=10000&brut=20000', DEFAUTS);
    expect(Number.isFinite(r.brut)).toBe(true);
    expect(r.brut).toBe(10_000);
  });
});

describe('cohérence avec le budget de la société', () => {
  // The app clamps the salary read from the URL to what the company can fund.
  // This test pins the invariant it relies on: clamping must never push a
  // salary *up*.
  const borner = (etat: EtatPartage) => {
    const max = brutMaxPourBudget(
      etat.base.resultatAvantRemuneration,
      etat.base.tauxATMP,
      etat.base.moisRemuneration,
    );
    return Math.min(etat.brut, Math.max(1000, Math.floor(max / 500) * 500));
  };

  it('ramène une rémunération infinançable au maximum possible', () => {
    const etat = decoderEtat('?resultat=60000&brut=900000', DEFAUTS);
    const borne = borner(etat);
    expect(borne).toBeLessThan(etat.brut);
    expect(coutEmployeur(borne, etat.base.tauxATMP, etat.base.moisRemuneration))
      .toBeLessThanOrEqual(etat.base.resultatAvantRemuneration);
  });

  it('laisse intacte une rémunération finançable', () => {
    for (const url of [
      '?resultat=180000&brut=31000&mois=7&atmp=2.35',
      '?resultat=180000&brut=31000&parts=3&couple=1&salaireExterne=24000&bareme=1',
      '?resultat=60000&brut=5000',
    ]) {
      const etat = decoderEtat(url, DEFAUTS);
      expect(borner(etat)).toBe(etat.brut);
    }
  });
});

describe('durabilité des liens', () => {
  it('ne fige pas les valeurs par défaut dans le lien', () => {
    // A link created today does not mention the default profit: if that value
    // changes tomorrow the link follows instead of freezing the old one.
    const url = encoderEtat(avec({ couple: true }), DEFAUTS);
    expect(url).not.toContain('resultat');
    expect(url).not.toContain('mois');
  });

  it('conserve une valeur explicitement choisie même si elle vaut le défaut d’un autre foyer', () => {
    const autresDefauts: EtatPartage = {
      base: { ...DEFAUTS.base, resultatAvantRemuneration: 200_000 },
      brut: DEFAUTS.brut,
    };
    const url = encoderEtat(avec({ resultatAvantRemuneration: 106_000 }), autresDefauts);
    expect(url).toContain('resultat=106000');
  });
});
