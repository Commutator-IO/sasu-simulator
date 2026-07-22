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
} as const;

const MAX_MONTANT = 100_000_000;

function nombre(
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

function booleen(brut: string | null, defaut: boolean): boolean {
  if (brut === null) return defaut;
  if (brut === '1' || brut === 'true') return true;
  if (brut === '0' || brut === 'false') return false;
  return defaut;
}

/** Display rounding, to keep stray decimals out of the URL. */
const arrondi = (v: number, decimales = 0) => {
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
    },
    brut: nombre(p.get(CLES.brut), defauts.brut, 0, MAX_MONTANT),
  };
}

/** Absolute URL to share, keeping the current path. */
export function lienPartage(etat: EtatPartage, defauts: EtatPartage): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${encoderEtat(etat, defauts)}`;
}
