import donnees from '../data/barometreTjm.json';

/**
 * "Data scientists" (Experts Data) day-rate figures, gathered from public
 * sources, for positioning a freelancer's own rate and tracing its evolution.
 *
 * The figures live in ../data/barometreTjm.json so the dataset can grow — more
 * capture dates, more cities — without touching this logic. Read the JSON's own
 * `meta.notes` for the caveats: snapshot metric, archive reconstruction, the
 * estimated 2024-2025 points, low city samples, and the seasonality of dates.
 */

export const META = donnees.meta;

/**
 * The reference figures are quoted commission included (the client-facing price
 * on the platform they come from). A freelancer whose own rate is quoted net of
 * commission — as on most other platforms — can add this back to compare on the
 * same basis.
 */
export const TAUX_COMMISSION_PLATEFORME = 0.1;

export const VILLES = ['Paris', 'Lyon', 'Bordeaux', 'Lille', 'Marseille'] as const;
export type Ville = (typeof VILLES)[number];
export type Lieu = Ville | 'national';

export type PointVille = { date: string; origine: string } & Record<Lieu, number>;
export const POINTS_VILLES = donnees.villes as PointVille[];
export const DERNIER = POINTS_VILLES[POINTS_VILLES.length - 1];

export type NiveauExperience = {
  cle: string;
  label: string;
  bas: number;
  moyen: number;
  haut: number;
};
export const NIVEAUX = donnees.experience as NiveauExperience[];

export type Evenement = { date: string; label: string };
export const EVENEMENTS = donnees.evenements as Evenement[];

type PointExperience = Record<string, string | number>;
const EXPERIENCE_HISTORIQUE = donnees.experienceHistorique as PointExperience[];

/**
 * National average over time for one seniority bracket, at the dates where that
 * bracket has data (the finer brackets only appear from 2023).
 */
export function serieExperience(cle: string): { annee: number; valeur: number }[] {
  return EXPERIENCE_HISTORIQUE.filter((p) => typeof p[cle] === 'number').map((p) => ({
    annee: anneeDecimale(p.date as string),
    valeur: p[cle] as number,
  }));
}

export const HISTORIQUE_NATIONAL = donnees.nationalHistorique as {
  date: string;
  moyenneActifs: number;
  origine: string;
}[];

/** A "YYYY-MM" date as a decimal year, for placing points on a time axis. */
export function anneeDecimale(date: string): number {
  const [an, mois] = date.split('-').map(Number);
  return an + ((mois || 1) - 0.5) / 12;
}

/** Average day rate for a place, at the most recent capture. */
export function moyenneVille(lieu: Lieu): number {
  return DERNIER[lieu];
}

export type Positionnement = {
  /** Signed gap to the bracket average; positive is above. */
  ecartMoyen: number;
  /** Where the rate sits within [bas, haut], clamped to 0..1. */
  positionDansPlage: number;
  auDessusDeLaMoyenne: boolean;
};

/** Places a rate within its seniority bracket. */
export function positionner(tjm: number, niveau: NiveauExperience): Positionnement {
  const etendue = niveau.haut - niveau.bas;
  const position = etendue > 0 ? (tjm - niveau.bas) / etendue : 0.5;
  return {
    ecartMoyen: Math.round(tjm - niveau.moyen),
    positionDansPlage: Math.max(0, Math.min(1, position)),
    auDessusDeLaMoyenne: tjm > niveau.moyen,
  };
}
