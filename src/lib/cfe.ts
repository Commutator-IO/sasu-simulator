import * as P from './parametres2026';

/**
 * Cotisation foncière des entreprises for a company with no premises of its
 * own — working from home, from a client's site or a domiciliation address.
 * Such a company has next to no rental value, so it is taxed on the minimum
 * base its commune voted.
 *
 * The commune's rate is not in any national dataset the site could ship, so it
 * is asked for rather than guessed: a national average would be wrong for
 * almost everyone. The commune's minimum base defaults to the top of the
 * legal range for the turnover, the cautious reading.
 */
export type HypothesesCfe = {
  /** Turnover excluding VAT over twelve months, for the reference period (N-2). */
  chiffreAffaires: number;
  /** Calendar year the company was created. */
  anneeCreation: number;
  /** Minimum base voted by the commune; 0 means "unknown, take the ceiling". */
  baseCommune: number;
  /** Commune's CFE rate, as a percentage; 0 means "not entered yet". */
  tauxCommune: number;
  /** Registered with the chamber of commerce, hence liable for its additional tax. */
  ressortissantCci: boolean;
};

export type MotifExoneration = 'creation' | 'chiffreAffaires';

export type AnneeCfe = {
  annee: number;
  /** Why nothing is due this year, if nothing is. */
  exoneration: MotifExoneration | null;
  /** Taxable base after the reduction of the year after creation. */
  base: number;
  cfe: number;
  taxeAdditionnelle: number;
  fraisGestion: number;
  total: number;
};

export type ResultatCfe = {
  /** Legal range of the minimum base for this turnover. */
  baseMin: number;
  baseMax: number;
  /** Base retained: the commune's when known, else the ceiling of the range. */
  baseRetenue: number;
  /** Creation year and the two following, to show when the bill starts. */
  annees: AnneeCfe[];
  /** First year an amount is due, or null if the turnover keeps it exempt. */
  premiereAnneeDue: number | null;
};

export const DEFAUTS_CFE: HypothesesCfe = {
  chiffreAffaires: P.CA_MENSUEL_PAR_DEFAUT * 12,
  // Created two years ago: the year a full CFE is first owed.
  anneeCreation: P.ANNEE - 2,
  baseCommune: 0,
  tauxCommune: 0,
  ressortissantCci: true,
};

/** Range of the minimum base the commune may vote for a turnover. */
export function trancheBaseMinimum(chiffreAffaires: number): { min: number; max: number } {
  const tranche =
    P.CFE_TRANCHES_BASE_MINIMUM.find((t) => chiffreAffaires <= t.plafondCA) ??
    P.CFE_TRANCHES_BASE_MINIMUM[P.CFE_TRANCHES_BASE_MINIMUM.length - 1];
  return { min: P.CFE_BASE_MINIMUM_PLANCHER, max: tranche.baseMax };
}

export function calculerCfe(h: HypothesesCfe): ResultatCfe {
  const chiffreAffaires = Math.max(0, h.chiffreAffaires);
  const { min, max } = trancheBaseMinimum(chiffreAffaires);
  const baseRetenue = h.baseCommune > 0 ? Math.min(max, Math.max(min, h.baseCommune)) : max;
  const taux = Math.max(0, h.tauxCommune) / 100;

  const annees: AnneeCfe[] = [0, 1, 2].map((ecart) => {
    const annee = h.anneeCreation + ecart;
    const exoneration: MotifExoneration | null =
      ecart === 0
        ? 'creation'
        : chiffreAffaires <= P.CFE_SEUIL_EXONERATION_CA
          ? 'chiffreAffaires'
          : null;
    if (exoneration) {
      return { annee, exoneration, base: 0, cfe: 0, taxeAdditionnelle: 0, fraisGestion: 0, total: 0 };
    }
    const base =
      ecart === 1 ? baseRetenue * (1 - P.CFE_REDUCTION_ANNEE_SUIVANT_CREATION) : baseRetenue;
    const cfe = base * taux;
    const taxeAdditionnelle = h.ressortissantCci ? base * P.CFE_TAXE_ADDITIONNELLE_CCI : 0;
    const fraisGestion = (cfe + taxeAdditionnelle) * P.CFE_FRAIS_GESTION;
    return {
      annee,
      exoneration: null,
      base,
      cfe,
      taxeAdditionnelle,
      fraisGestion,
      total: cfe + taxeAdditionnelle + fraisGestion,
    };
  });

  return {
    baseMin: min,
    baseMax: max,
    baseRetenue,
    annees,
    premiereAnneeDue: annees.find((a) => !a.exoneration)?.annee ?? null,
  };
}
