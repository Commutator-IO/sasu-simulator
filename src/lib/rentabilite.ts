import * as P from './parametres2026';
import {
  abattementSalaire,
  balayer,
  brutMaxPourBudget,
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

export type PartTjm = {
  /** What the client pays — above the invoiced rate when a body shop resells it. */
  clientPaie: number;
  /** Kept by the intermediary, whether deducted or added on top. */
  commission: number;
  /** Running costs of the company. */
  frais: number;
  /** Social contributions, employer and employee side. */
  cotisations: number;
  /** Corporate tax and income tax. */
  impots: number;
  /** What the freelance is left with. */
  net: number;
};

/**
 * Where one billed day goes, for an intermediary keeping `taux`.
 *
 * `tjm` is what the freelance keeps, not what the client is charged: a rate is
 * held constant and each channel is asked what the client must pay to leave it
 * intact. Whether the cut is deducted from the invoice or added on top by a
 * body shop, the arithmetic is the same and the freelance's own side —
 * costs, contributions, tax, take-home — is identical across channels. Only the
 * intermediary's slice, and so the total, moves.
 */
export function decomposerTjm(
  tjm: number,
  taux: number,
  base: BaseRentabilite,
  options: { tauxFrais?: number; jours?: number } = {},
): PartTjm {
  const tauxFrais = Math.min(Math.max(options.tauxFrais ?? P.TAUX_FRAIS_REFERENCE, 0), 0.9);
  const jours = Math.max(options.jours ?? P.JOURS_FACTURES_REFERENCE, 1);
  const tauxInter = Math.min(Math.max(taux, 0), 0.9);
  if (tjm <= 0) {
    return { clientPaie: 0, commission: 0, frais: 0, cotisations: 0, impots: 0, net: 0 };
  }

  const clientPaie = tjm / (1 - tauxInter);
  const ca = tjm * jours;
  const frais = ca * tauxFrais;
  const resultat = ca - frais;
  const r = balayer({ ...base, resultatAvantRemuneration: resultat }).optimum;

  // Taxes are read off the engine; contributions are what the levies leave, so
  // the parts cannot drift apart from the take-home it computed.
  const impots = r.is + r.irTotal;
  return {
    clientPaie,
    commission: clientPaie - tjm,
    frais: frais / jours,
    cotisations: Math.max(0, resultat - r.netEnPoche - impots) / jours,
    impots: impots / jours,
    net: r.netEnPoche / jours,
  };
}

export type PartCdi = {
  /** Employer's total cost — the envelope compared against a day rate. */
  coutEmployeur: number;
  /** Paid by the employer, above the gross: money the employee never sees. */
  patronales: number;
  /** Withheld from the gross, payslip side. */
  salariales: number;
  impots: number;
  net: number;
};

/**
 * The same envelope taken as a salaried job, for comparison.
 *
 * A day rate is what a client pays; the equivalent question on the other side
 * is what an employer could pay for the same money. The gross that fits the
 * envelope is solved with the engine's own inversion, then split the same way:
 * contributions, income tax, take-home.
 *
 * Contributions are split employer/employee, which a SASU bar does not need:
 * there the president is both, so the distinction changes no decision. In a job
 * the employer's part is money the employee never sees.
 */
export function decomposerCdi(
  enveloppeParJour: number,
  base: BaseRentabilite,
  options: { jours?: number } = {},
): PartCdi {
  const jours = Math.max(options.jours ?? P.JOURS_FACTURES_REFERENCE, 1);
  if (enveloppeParJour <= 0) {
    return { coutEmployeur: 0, patronales: 0, salariales: 0, impots: 0, net: 0 };
  }
  const enveloppe = enveloppeParJour * jours;
  const brut = brutMaxPourBudget(enveloppe, base.tauxATMP, base.moisRemuneration);
  const { net, netImposableAvantAbattement } = decomposerSalaire(brut, base.moisRemuneration);
  const imposable = abattementSalaire(netImposableAvantAbattement);
  const ir =
    calculerIR(imposable + base.autresRevenus, base.parts, base.couple) -
    calculerIR(base.autresRevenus, base.parts, base.couple);

  return {
    coutEmployeur: enveloppeParJour,
    patronales: (enveloppe - brut) / jours,
    salariales: (brut - net) / jours,
    impots: ir / jours,
    net: (net - ir) / jours,
  };
}

/**
 * Typical margin a body shop keeps on the client price. It is negotiated and
 * ranges roughly from 10 to 30%, so it is an order of magnitude, not a rate.
 */
export const MARGE_ESN_TYPIQUE = 0.2;

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
