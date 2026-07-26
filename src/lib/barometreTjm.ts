import donnees from '../data/barometreTjm.json';

/**
 * Freelance day-rate figures from public sources, by profession, for positioning
 * one's own rate and tracing its evolution — with several professions overlaid.
 *
 * The figures live in ../data/barometreTjm.json so the dataset can grow — more
 * capture dates, more professions — without touching this logic. Each profession
 * carries what public archives allowed to reconstruct plus a recent measured
 * point; the monthly capture densifies it going forward.
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

export type Profession = {
  cle: string;
  libelle: string;
  couleur: string;
  villes: PointVille[];
  experience: NiveauExperience[];
  experienceHistorique?: PointExperience[];
  nationalHistorique?: { date: string; moyenneActifs: number; origine: string }[];
};

export const PROFESSIONS = donnees.professions as Profession[];

export type Evenement = { date: string; label: string };
export const EVENEMENTS = donnees.evenements as Evenement[];

/** A profession by key, defaulting to the first (data scientist). */
export function getProfession(cle: string): Profession {
  return PROFESSIONS.find((p) => p.cle === cle) ?? PROFESSIONS[0];
}

const ORDRE_VILLES = ['national', 'Paris', 'Lyon', 'Bordeaux', 'Lille', 'Marseille'];

/** Cities present in a profession's data, in a stable order. */
export function villesProfession(p: Profession): string[] {
  const cles = new Set<string>();
  for (const pt of p.villes) {
    for (const k of Object.keys(pt)) {
      if (k !== 'date' && k !== 'origine') cles.add(k);
    }
  }
  return ORDRE_VILLES.filter((c) => cles.has(c));
}

/** Cities common to every selected profession — the ones an overlay can use. */
export function villesCommunes(profs: Profession[]): string[] {
  if (!profs.length) return ['national'];
  return profs
    .map(villesProfession)
    .reduce((commun, liste) => commun.filter((c) => liste.includes(c)));
}

/** The most recent point of a profession. */
export function dernier(p: Profession): PointVille {
  return p.villes[p.villes.length - 1];
}

/** Average day rate for a place, at the most recent capture. */
export function moyenneVille(p: Profession, lieu: string): number {
  return dernier(p)[lieu] as number;
}

/** A "YYYY-MM" date as a decimal year, for placing points on a time axis. */
export function anneeDecimale(date: string): number {
  const [an, mois] = date.split('-').map(Number);
  return an + ((mois || 1) - 0.5) / 12;
}

/** A profession's day-rate points for one city, ready to plot. */
export function serieVille(p: Profession, lieu: string): { annee: number; valeur: number; estime?: boolean }[] {
  return p.villes
    .filter((pt) => typeof pt[lieu] === 'number')
    .map((pt) => ({
      annee: anneeDecimale(pt.date),
      valeur: pt[lieu] as number,
      estime: pt.origine === 'estimation',
    }));
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
