import donnees from '../data/barometreTjm.json';

/**
 * Freelance data day-rate figures, gathered from public sources, for positioning
 * one's own rate and tracing its evolution — across several data specialties.
 *
 * The figures live in ../data/barometreTjm.json so the dataset can grow — more
 * capture dates, more specialties — without touching this logic. Data scientist
 * carries a reconstructed history (with estimated 2024-2025 points); the other
 * specialties start from a single recent point and densify month by month.
 */

export const META = donnees.meta;

/** The reference figures are quoted commission included; a rate quoted net of it
 * can be grossed back up to compare on the same basis. */
export const TAUX_COMMISSION_PLATEFORME = 0.1;

export type NiveauExperience = {
  cle: string;
  label: string;
  bas: number;
  moyen: number;
  haut: number;
};

export type PointVille = {
  date: string;
  origine: string;
} & Record<string, string | number>;

type PointExperience = Record<string, string | number>;

export type Specialite = {
  cle: string;
  libelle: string;
  source: string;
  villes: PointVille[];
  experience: NiveauExperience[];
  experienceHistorique?: PointExperience[];
  nationalHistorique?: { date: string; moyenneActifs: number; origine: string }[];
};

export const SPECIALITES = donnees.specialites as Specialite[];

export type Evenement = { date: string; label: string };
export const EVENEMENTS = donnees.evenements as Evenement[];

/** A specialty by key, defaulting to the first (data scientist). */
export function getSpecialite(cle: string): Specialite {
  return SPECIALITES.find((s) => s.cle === cle) ?? SPECIALITES[0];
}

const ORDRE_VILLES = ['national', 'Paris', 'Lyon', 'Bordeaux', 'Lille', 'Marseille'];

/** The places this specialty actually has figures for, in a stable order. */
export function villesDisponibles(s: Specialite): string[] {
  const cles = new Set<string>();
  for (const p of s.villes) {
    for (const k of Object.keys(p)) {
      if (k !== 'date' && k !== 'origine') cles.add(k);
    }
  }
  return ORDRE_VILLES.filter((c) => cles.has(c));
}

/** The most recent point of a specialty. */
export function dernier(s: Specialite): PointVille {
  return s.villes[s.villes.length - 1];
}

/** Average day rate for a place, at the most recent capture. */
export function moyenneVille(s: Specialite, lieu: string): number {
  return dernier(s)[lieu] as number;
}

/** A "YYYY-MM" date as a decimal year, for placing points on a time axis. */
export function anneeDecimale(date: string): number {
  const [an, mois] = date.split('-').map(Number);
  return an + ((mois || 1) - 0.5) / 12;
}

/**
 * National average over time for one seniority bracket, at the dates where that
 * bracket has data (empty when the specialty carries no history yet).
 */
export function serieExperience(s: Specialite, cle: string): { annee: number; valeur: number }[] {
  const hist = s.experienceHistorique ?? [];
  return hist
    .filter((p) => typeof p[cle] === 'number')
    .map((p) => ({ annee: anneeDecimale(p.date as string), valeur: p[cle] as number }));
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
