import { minifier } from './compact';
import type { Hypotheses } from './simulation';

/**
 * Serialisation of a simulation into the URL.
 *
 * The site is fully static, so the URL is the only place to store shareable
 * state. State goes in the query string rather than the fragment, the latter
 * being already used by the in-page navigation anchors (#sources).
 *
 * Two principles:
 *  - only parameters that differ from the defaults are written, so links stay
 *    short and a future change of default value is not frozen into links that
 *    have already been shared;
 *  - everything read back is clamped, the URL being untrusted input.
 */

export type EtatPartage = {
  base: Omit<Hypotheses, 'brutAnnuel'>;
  brut: number;
};

/** Explicit keys: a tax simulation link benefits from being readable. */
const CLES = {
  resultat: 'resultat',
  brut: 'brut',
  mois: 'mois',
  parts: 'parts',
  couple: 'couple',
  salaireExterne: 'salaireExterne',
  autresRevenus: 'autresRevenus',
  reserves: 'reserves',
  distribution: 'distribution',
  atmp: 'atmp',
  isReduit: 'isReduit',
  bareme: 'bareme',
  epargneSalariale: 'epargneSalariale',
  avantages: 'avantages',
  cesu: 'cesu',
  depensesSAP: 'depensesSAP',
  majorationsCI: 'majorationsCI',
  premiereAnneeSAP: 'premiereAnneeSAP',
  invaliditeCI: 'invaliditeCI',
  meilleures: 'meilleures',
  valoriserRetraite: 'valoriserRetraite',
  avantRetraite: 'avantRetraite',
  dureeRetraite: 'dureeRetraite',
  actualisation: 'actualisation',
  versementPER: 'versementPER',
  plafondPER: 'plafondPER',
} as const;

/** Query-string keys this tool owns, for state persistence. */
export const CLES_ARBITRAGE: string[] = Object.values(CLES);

export const MAX_MONTANT = 100_000_000;

export function nombre(
  brut: string | null,
  defaut: number,
  min: number,
  max: number,
  decimales = 0,
): number {
  if (brut === null || brut.trim() === '') return defaut;
  const valeur = Number(brut);
  if (!Number.isFinite(valeur)) return defaut;
  const borne = Math.min(max, Math.max(min, valeur));
  const facteur = 10 ** decimales;
  return Math.round(borne * facteur) / facteur;
}

export function booleen(brut: string | null, defaut: boolean): boolean {
  if (brut === null) return defaut;
  if (brut === '1' || brut === 'true') return true;
  if (brut === '0' || brut === 'false') return false;
  return defaut;
}

/** Display rounding, to keep stray decimals out of the URL. */
export const arrondi = (v: number, decimales = 0) => {
  const facteur = 10 ** decimales;
  return Math.round(v * facteur) / facteur;
};

/**
 * Builds the query string representing the state, including only what differs
 * from the defaults. Returns an empty string when everything is default.
 */
export function encoderEtat(
  etat: EtatPartage,
  defauts: EtatPartage,
): string {
  const params = new URLSearchParams();
  const ajouter = (cle: string, valeur: number | boolean, defaut: number | boolean) => {
    if (valeur === defaut) return;
    params.set(cle, typeof valeur === 'boolean' ? (valeur ? '1' : '0') : String(valeur));
  };

  const { base, brut } = etat;
  const d = defauts.base;

  ajouter(CLES.resultat, arrondi(base.resultatAvantRemuneration), d.resultatAvantRemuneration);
  ajouter(CLES.brut, arrondi(brut), arrondi(defauts.brut));
  ajouter(CLES.mois, arrondi(base.moisRemuneration), d.moisRemuneration);
  ajouter(CLES.parts, arrondi(base.parts, 1), d.parts);
  ajouter(CLES.couple, base.couple, d.couple);
  ajouter(CLES.salaireExterne, arrondi(base.salaireExterneBrut), d.salaireExterneBrut);
  ajouter(CLES.autresRevenus, arrondi(base.autresRevenus), d.autresRevenus);
  ajouter(
    CLES.reserves,
    arrondi(base.reservesDistribuables),
    d.reservesDistribuables,
  );
  // The payout ratio travels as a whole percentage, which reads better.
  ajouter(
    CLES.distribution,
    arrondi(base.tauxDistribution * 100),
    arrondi(d.tauxDistribution * 100),
  );
  ajouter(CLES.atmp, arrondi(base.tauxATMP, 2), d.tauxATMP);
  ajouter(CLES.isReduit, base.eligibleISReduit, d.eligibleISReduit);
  ajouter(CLES.bareme, base.dividendesAuBareme, d.dividendesAuBareme);
  ajouter(CLES.epargneSalariale, arrondi(base.epargneSalariale), d.epargneSalariale);
  ajouter(CLES.avantages, arrondi(base.avantagesExoneres), d.avantagesExoneres);
  ajouter(CLES.cesu, arrondi(base.cesuPrefinance), d.cesuPrefinance);
  ajouter(
    CLES.depensesSAP,
    arrondi(base.depensesServicesPersonne),
    d.depensesServicesPersonne,
  );
  ajouter(CLES.majorationsCI, arrondi(base.majorationsCreditImpot), d.majorationsCreditImpot);
  ajouter(
    CLES.premiereAnneeSAP,
    base.premiereAnneeEmploiDomicile,
    d.premiereAnneeEmploiDomicile,
  );
  ajouter(CLES.invaliditeCI, base.invaliditeCreditImpot, d.invaliditeCreditImpot);
  ajouter(CLES.meilleures, base.anneeParmiMeilleures, d.anneeParmiMeilleures);
  ajouter(CLES.valoriserRetraite, base.valoriserRetraite, d.valoriserRetraite);
  ajouter(CLES.avantRetraite, arrondi(base.anneesAvantRetraite), d.anneesAvantRetraite);
  ajouter(CLES.dureeRetraite, arrondi(base.dureeRetraite), d.dureeRetraite);
  ajouter(CLES.actualisation, arrondi(base.tauxActualisation, 2), d.tauxActualisation);
  ajouter(CLES.versementPER, arrondi(base.versementPER), d.versementPER);
  ajouter(CLES.plafondPER, arrondi(base.plafondPER), d.plafondPER);

  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

/** Reads a state back from a query string, clamping every value. */
export function decoderEtat(recherche: string, defauts: EtatPartage): EtatPartage {
  const p = new URLSearchParams(recherche);
  const d = defauts.base;

  const couple = booleen(p.get(CLES.couple), d.couple);
  // A couple counts at least two household shares.
  const parts = nombre(p.get(CLES.parts), d.parts, couple ? 2 : 1, 20, 1);

  return {
    base: {
      resultatAvantRemuneration: nombre(
        p.get(CLES.resultat),
        d.resultatAvantRemuneration,
        0,
        MAX_MONTANT,
      ),
      moisRemuneration: nombre(p.get(CLES.mois), d.moisRemuneration, 1, 12),
      parts,
      couple,
      salaireExterneBrut: nombre(
        p.get(CLES.salaireExterne),
        d.salaireExterneBrut,
        0,
        MAX_MONTANT,
      ),
      autresRevenus: nombre(p.get(CLES.autresRevenus), d.autresRevenus, 0, MAX_MONTANT),
      reservesDistribuables: nombre(
        p.get(CLES.reserves),
        d.reservesDistribuables,
        0,
        MAX_MONTANT,
      ),
      tauxDistribution:
        nombre(
          p.get(CLES.distribution),
          d.tauxDistribution * 100,
          0,
          100,
        ) / 100,
      tauxATMP: nombre(p.get(CLES.atmp), d.tauxATMP, 0, 20, 2),
      eligibleISReduit: booleen(p.get(CLES.isReduit), d.eligibleISReduit),
      dividendesAuBareme: booleen(p.get(CLES.bareme), d.dividendesAuBareme),
      epargneSalariale: nombre(
        p.get(CLES.epargneSalariale),
        d.epargneSalariale,
        0,
        MAX_MONTANT,
      ),
      avantagesExoneres: nombre(p.get(CLES.avantages), d.avantagesExoneres, 0, MAX_MONTANT),
      cesuPrefinance: nombre(p.get(CLES.cesu), d.cesuPrefinance, 0, MAX_MONTANT),
      depensesServicesPersonne: nombre(
        p.get(CLES.depensesSAP),
        d.depensesServicesPersonne,
        0,
        MAX_MONTANT,
      ),
      majorationsCreditImpot: nombre(p.get(CLES.majorationsCI), d.majorationsCreditImpot, 0, 10),
      premiereAnneeEmploiDomicile: booleen(
        p.get(CLES.premiereAnneeSAP),
        d.premiereAnneeEmploiDomicile,
      ),
      invaliditeCreditImpot: booleen(p.get(CLES.invaliditeCI), d.invaliditeCreditImpot),
      anneeParmiMeilleures: booleen(p.get(CLES.meilleures), d.anneeParmiMeilleures),
      valoriserRetraite: booleen(p.get(CLES.valoriserRetraite), d.valoriserRetraite),
      anneesAvantRetraite: nombre(p.get(CLES.avantRetraite), d.anneesAvantRetraite, 0, 60),
      dureeRetraite: nombre(p.get(CLES.dureeRetraite), d.dureeRetraite, 0, 60),
      tauxActualisation: nombre(p.get(CLES.actualisation), d.tauxActualisation, -5, 15, 2),
      versementPER: nombre(p.get(CLES.versementPER), d.versementPER, 0, MAX_MONTANT),
      plafondPER: nombre(p.get(CLES.plafondPER), d.plafondPER, 0, MAX_MONTANT),
    },
    brut: nombre(p.get(CLES.brut), defauts.brut, 0, MAX_MONTANT),
  };
}

/** Absolute URL to share, keeping the current path. */
export function lienPartage(etat: EtatPartage, defauts: EtatPartage): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${minifier(encoderEtat(etat, defauts))}`;
}
