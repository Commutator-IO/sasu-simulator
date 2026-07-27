import * as P from './parametres2026';
import {
  abattementSalaire,
  balayer,
  calculerIR,
  decomposerSalaire,
  type Hypotheses,
  type Resultat,
} from './simulation';

/**
 * Break-even: the revenue the company must invoice for the president to take
 * home a given amount.
 *
 * The simulator answers the forward question — this profit, that salary, this
 * much in the president's pocket. Break-even is the same model read backwards,
 * so nothing is recomputed here: for a candidate profit, `balayer` returns the
 * best take-home achievable at that level, and the search looks for the
 * smallest profit whose best split reaches the target. Take-home grows with
 * profit, so a bisection is enough.
 */

/** Everything the search holds fixed; profit and salary are what it solves for. */
export type BaseRentabilite = Omit<Hypotheses, 'resultatAvantRemuneration' | 'brutAnnuel'>;

export type Seuil = {
  /** Take-home the search had to reach. */
  cible: number;
  /** Profit before the president's salary needed to reach it. */
  resultatNecessaire: number;
  /** Revenue needed, running costs added back. */
  caNecessaire: number;
  /** Best salary/dividend split at that profit. */
  optimum: Resultat;
  /** Day rate needed over `jours` billable days. */
  tjmNecessaire: number;
  /** Days needed at the user's own day rate, when one is given. */
  joursNecessaires: number | null;
  /** True when the target is out of reach within the searched range. */
  horsAtteinte: boolean;
};

/**
 * Take-home pay left by a gross salary, so a CDI offer can be turned into the
 * target a company has to match.
 *
 * A president is assimilé salarié: on the employee side the contributions are
 * those of an executive employee, which is what makes the comparison fair. The
 * gap lies elsewhere — no unemployment insurance — and that is a difference in
 * cover, not in net pay.
 */
export function netEnPocheSalaire(
  brutAnnuel: number,
  base: Pick<BaseRentabilite, 'parts' | 'couple' | 'autresRevenus' | 'moisRemuneration'>,
): number {
  const { net, netImposableAvantAbattement } = decomposerSalaire(
    brutAnnuel,
    base.moisRemuneration,
  );
  const imposable = abattementSalaire(netImposableAvantAbattement);
  const irAvec = calculerIR(imposable + base.autresRevenus, base.parts, base.couple);
  const irSans = calculerIR(base.autresRevenus, base.parts, base.couple);
  return net - (irAvec - irSans);
}

/** Best take-home achievable at a given profit, whatever the split. */
function meilleurNet(base: BaseRentabilite, resultat: number, pas: number): number {
  if (resultat <= 0) return 0;
  return balayer({ ...base, resultatAvantRemuneration: resultat }, pas).optimum.netEnPoche;
}

/** Upper bound of the search: enough profit that any realistic target is inside. */
const RESULTAT_MAX = 1_000_000;

export function seuilRentabilite(
  cible: number,
  base: BaseRentabilite,
  options: {
    /** Running costs as a share of revenue (0 → 1). */
    tauxFrais?: number;
    /** Billable days used to turn revenue into a day rate. */
    jours?: number;
    /** The user's own day rate, to express the threshold in days. */
    tjm?: number;
  } = {},
): Seuil {
  const tauxFrais = Math.min(Math.max(options.tauxFrais ?? P.TAUX_FRAIS_REFERENCE, 0), 0.9);
  const jours = Math.max(options.jours ?? P.JOURS_FACTURES_REFERENCE, 1);

  const vide = (resultat: number, horsAtteinte: boolean): Seuil => {
    const optimum = balayer({ ...base, resultatAvantRemuneration: resultat }).optimum;
    const ca = resultat / (1 - tauxFrais);
    return {
      cible,
      resultatNecessaire: resultat,
      caNecessaire: ca,
      optimum,
      tjmNecessaire: ca / jours,
      joursNecessaires: options.tjm && options.tjm > 0 ? ca / options.tjm : null,
      horsAtteinte,
    };
  };

  if (cible <= 0) return vide(0, false);
  if (meilleurNet(base, RESULTAT_MAX, 25) < cible) return vide(RESULTAT_MAX, true);

  // Coarse sweeps during the search, then one full sweep on the answer.
  let bas = 0;
  let haut = RESULTAT_MAX;
  for (let i = 0; i < 34; i++) {
    const milieu = (bas + haut) / 2;
    if (meilleurNet(base, milieu, 25) >= cible) haut = milieu;
    else bas = milieu;
  }
  return vide(Math.ceil(haut), false);
}
