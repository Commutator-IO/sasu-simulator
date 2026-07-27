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

/**
 * Freelance platforms and the service fee they deduct, so a rate can be set to
 * earn the same across them. Barometer figures are the price invoiced by the
 * freelance, before any such fee.
 */
export type Plateforme = {
  nom: string;
  /** Service fee taken on the freelance's invoice, 0 when none. */
  taux: number;
  /** Shown instead of the rate when it is not a published percentage. */
  tauxLibelle?: string;
  /** Share billed to the client on top of your invoice. */
  margeClient?: number;
  /** False when that share is an estimate rather than a published rate. */
  margeClientPubliee?: boolean;
  note: string;
  url?: string | null;
  hote?: string | null;
};
export const PLATEFORMES = (donnees.meta.plateformes ?? []) as Plateforme[];

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
  /** Projection only: [low, high] band per city. */
  marge?: Record<string, number[]>;
  [cle: string]: string | number | Record<string, number[]> | undefined;
};

type PointExperience = Record<string, string | number>;

export type Profession = {
  cle: string;
  libelle: string;
  /** Short form, for the cramped picker; falls back to `libelle`. */
  court?: string;
  couleur: string;
  villes: PointVille[];
  experience: NiveauExperience[];
  experienceHistorique?: PointExperience[];
  nationalHistorique?: { date: string; moyenneActifs: number; origine: string }[];
};

export const PROFESSIONS = donnees.professions as Profession[];

export type Evenement = {
  date: string;
  label: string;
  /** Why this milestone moved day rates — shown in the economic references. */
  explication?: string;
};
export const EVENEMENTS = donnees.evenements as Evenement[];

/** Published market studies backing the milestones above. */
export type Reference = { titre: string; detail: string; url?: string; hote?: string };
export const REFERENCES = (donnees.meta.references ?? []) as Reference[];

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

export type PointSerie = {
  annee: number;
  /** "YYYY-MM", for labelling a hovered point. */
  date: string;
  valeur: number;
  /** A projected point (2027-2028), not a measurement. */
  projete?: boolean;
  /** Uncertainty band around a projection. */
  bas?: number;
  haut?: number;
};

/** A profession's day-rate points for one city, ready to plot. */
export function serieVille(p: Profession, lieu: string): PointSerie[] {
  return p.villes
    .filter((pt) => typeof pt[lieu] === 'number')
    .map((pt) => {
      const marge = pt.marge?.[lieu];
      return {
        annee: anneeDecimale(pt.date),
        date: pt.date,
        valeur: pt[lieu] as number,
        projete: pt.origine === 'projection',
        ...(marge ? { bas: marge[0], haut: marge[1] } : {}),
      };
    });
}

/** The most recent measured point (projections excluded). */
export function derniereMesure(p: Profession): PointVille | undefined {
  return [...p.villes].reverse().find((pt) => pt.origine !== 'projection');
}

/**
 * Change in a profession's rate for a city between the capture closest to a
 * reference year and the latest measurement. Null when that year is not covered,
 * so a profession with no history is not given a made-up variation.
 */
export function variationDepuis(
  p: Profession,
  lieu: string,
  anneeRef: number,
): { depuis: string; pourcent: number } | null {
  const mesures = p.villes.filter((pt) => pt.origine !== 'projection' && pt[lieu]);
  const fin = mesures[mesures.length - 1];
  const candidats = mesures.filter((pt) => Math.abs(anneeDecimale(pt.date) - anneeRef) <= 1);
  if (!fin || !candidats.length) return null;
  const debut = candidats.reduce((a, b) =>
    Math.abs(anneeDecimale(b.date) - anneeRef) < Math.abs(anneeDecimale(a.date) - anneeRef) ? b : a,
  );
  if (debut.date === fin.date) return null;
  const av = debut[lieu] as number;
  const ap = fin[lieu] as number;
  return { depuis: debut.date, pourcent: ((ap - av) / av) * 100 };
}

/** The last measured date across professions — where projections take over. */
export function finDesMesures(profs: Profession[]): number {
  const dates = profs.flatMap((p) =>
    p.villes.filter((pt) => pt.origine !== 'projection').map((pt) => anneeDecimale(pt.date)),
  );
  return dates.length ? Math.max(...dates) : 0;
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
