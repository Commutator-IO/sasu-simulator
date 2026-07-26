import { NIVEAUX, VILLES, type Ville } from './barometreTjm';
import { MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of the TJM positioning state. Same two principles as the other
 * tools: only what differs from the defaults is written, everything read back
 * is clamped or validated against the known values.
 */

export type EtatPositionnement = {
  tjm: number;
  /** One of NIVEAUX keys. */
  niveau: string;
  /** A city, or "national". */
  ville: Ville | 'national';
};

export const DEFAUTS_POSITIONNEMENT: EtatPositionnement = {
  tjm: 600,
  niveau: '8-15',
  ville: 'national',
};

const CLES = { tjm: 'tjm', niveau: 'niveau', ville: 'ville' } as const;

export const CLES_POSITIONNEMENT: string[] = Object.values(CLES);

function lireNiveau(brut: string | null, defaut: string): string {
  return NIVEAUX.some((n) => n.cle === brut) ? (brut as string) : defaut;
}

function lireVille(brut: string | null, defaut: Ville | 'national'): Ville | 'national' {
  if (brut === 'national') return 'national';
  return (VILLES as readonly string[]).includes(brut ?? '')
    ? (brut as Ville)
    : defaut;
}

export function encoderPositionnement(
  e: EtatPositionnement,
  defauts: EtatPositionnement,
): string {
  const params = new URLSearchParams();
  if (Math.round(e.tjm) !== defauts.tjm) params.set(CLES.tjm, String(Math.round(e.tjm)));
  if (e.niveau !== defauts.niveau) params.set(CLES.niveau, e.niveau);
  if (e.ville !== defauts.ville) params.set(CLES.ville, e.ville);
  const chaine = params.toString();
  return chaine === '' ? '' : `?${chaine}`;
}

export function decoderPositionnement(
  recherche: string,
  defauts: EtatPositionnement,
): EtatPositionnement {
  const p = new URLSearchParams(recherche);
  return {
    tjm: nombre(p.get(CLES.tjm), defauts.tjm, 0, MAX_MONTANT),
    niveau: lireNiveau(p.get(CLES.niveau), defauts.niveau),
    ville: lireVille(p.get(CLES.ville), defauts.ville),
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
