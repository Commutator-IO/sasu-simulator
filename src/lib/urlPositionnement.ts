import { getSpecialite, SPECIALITES, villesDisponibles, type Specialite } from './barometreTjm';
import { MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of the TJM positioning state. Same two principles as the other
 * tools: only what differs from the defaults is written, everything read back is
 * clamped or validated — here against the chosen specialty's own brackets and
 * cities, since those change from one specialty to the next.
 */

export type EtatPositionnement = {
  specialite: string;
  tjm: number;
  /** One of the specialty's experience keys. */
  niveau: string;
  /** A city the specialty has data for, or "national". */
  ville: string;
  /** Add the platform commission back to the entered rate before comparing. */
  commission: boolean;
};

/** The middle bracket of a specialty — a sensible default seniority. */
export function niveauDefaut(s: Specialite): string {
  return s.experience[Math.min(2, s.experience.length - 1)].cle;
}

export const DEFAUTS_POSITIONNEMENT: EtatPositionnement = {
  specialite: SPECIALITES[0].cle,
  tjm: 600,
  niveau: niveauDefaut(SPECIALITES[0]),
  ville: 'national',
  commission: false,
};

const CLES = {
  specialite: 'specialite',
  tjm: 'tjm',
  niveau: 'niveau',
  ville: 'ville',
  commission: 'commission',
} as const;

export const CLES_POSITIONNEMENT: string[] = Object.values(CLES);

function lireSpecialite(brut: string | null, defaut: string): string {
  return SPECIALITES.some((s) => s.cle === brut) ? (brut as string) : defaut;
}

function lireNiveau(brut: string | null, s: Specialite, defaut: string): string {
  return s.experience.some((n) => n.cle === brut) ? (brut as string) : defaut;
}

function lireVille(brut: string | null, s: Specialite, defaut: string): string {
  return villesDisponibles(s).includes(brut ?? '') ? (brut as string) : defaut;
}

function lireBool(brut: string | null, defaut: boolean): boolean {
  if (brut === '1') return true;
  if (brut === '0') return false;
  return defaut;
}

export function encoderPositionnement(
  e: EtatPositionnement,
  defauts: EtatPositionnement,
): string {
  const params = new URLSearchParams();
  if (e.specialite !== defauts.specialite) params.set(CLES.specialite, e.specialite);
  if (Math.round(e.tjm) !== defauts.tjm) params.set(CLES.tjm, String(Math.round(e.tjm)));
  if (e.niveau !== defauts.niveau) params.set(CLES.niveau, e.niveau);
  if (e.ville !== defauts.ville) params.set(CLES.ville, e.ville);
  if (e.commission !== defauts.commission) params.set(CLES.commission, e.commission ? '1' : '0');
  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

export function decoderPositionnement(
  recherche: string,
  defauts: EtatPositionnement,
): EtatPositionnement {
  const p = new URLSearchParams(recherche);
  const specialite = lireSpecialite(p.get(CLES.specialite), defauts.specialite);
  const s = getSpecialite(specialite);
  // The bracket/city defaults must belong to the resolved specialty, not to a
  // different one carried over from `defauts`.
  const niveauFallback = specialite === defauts.specialite ? defauts.niveau : niveauDefaut(s);
  const villeFallback = lireVille(defauts.ville, s, 'national');
  return {
    specialite,
    tjm: nombre(p.get(CLES.tjm), defauts.tjm, 0, MAX_MONTANT),
    niveau: lireNiveau(p.get(CLES.niveau), s, niveauFallback),
    ville: lireVille(p.get(CLES.ville), s, villeFallback),
    commission: lireBool(p.get(CLES.commission), defauts.commission),
  };
}

export function lienPartagePositionnement(
  e: EtatPositionnement,
  defauts: EtatPositionnement,
): string {
  if (typeof window === 'undefined') return '';
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${encoderPositionnement(e, defauts)}`;
}
