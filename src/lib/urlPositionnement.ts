import { getProfession, PROFESSIONS, villesProfession } from './barometreTjm';
import { MAX_MONTANT, nombre } from './url';

/**
 * Serialisation of the TJM positioning state. Same two principles as the other
 * tools: only what differs from the defaults is written, everything read back is
 * clamped or validated. Professions are multi-select (overlaid curves); the
 * seniority brackets are shared across professions.
 */

export type EtatPositionnement = {
  /** One or more profession keys, overlaid on the chart. */
  professions: string[];
  tjm: number;
  /** Optional own rate in 2024 / 2025 (0 = not filled) to trace a real path. */
  tjm2024: number;
  tjm2025: number;
  /** Optional target for next year (0 = not set). */
  tjm2027: number;
  niveau: string;
  ville: string;
};

/** Shared seniority brackets (every profession uses the same keys). */
const CLES_NIVEAUX = PROFESSIONS[0].experience.map((n) => n.cle);

export const DEFAUTS_POSITIONNEMENT: EtatPositionnement = {
  professions: [PROFESSIONS[0].cle],
  tjm: 600,
  tjm2024: 0,
  tjm2025: 0,
  tjm2027: 0,
  niveau: '8-15',
  ville: 'national',
};

const CLES = {
  professions: 'metiers',
  tjm: 'tjm',
  tjm2024: 'tjm2024',
  tjm2025: 'tjm2025',
  tjm2027: 'tjm2027',
  niveau: 'niveau',
  ville: 'ville',
} as const;

export const CLES_POSITIONNEMENT: string[] = Object.values(CLES);

function lireProfessions(brut: string | null, defaut: string[]): string[] {
  const connus = new Set(PROFESSIONS.map((p) => p.cle));
  const liste = (brut ?? '').split(',').filter((c) => connus.has(c));
  const uniques = [...new Set(liste)];
  return uniques.length ? uniques : defaut;
}

function lireNiveau(brut: string | null, defaut: string): string {
  return CLES_NIVEAUX.includes(brut ?? '') ? (brut as string) : defaut;
}

function lireVille(brut: string | null, profs: string[], defaut: string): string {
  const dispo = villesProfession(getProfession(profs[0]));
  return dispo.includes(brut ?? '') ? (brut as string) : defaut;
}

export function encoderPositionnement(
  e: EtatPositionnement,
  defauts: EtatPositionnement,
): string {
  const params = new URLSearchParams();
  if (e.professions.join(',') !== defauts.professions.join(','))
    params.set(CLES.professions, e.professions.join(','));
  if (Math.round(e.tjm) !== defauts.tjm) params.set(CLES.tjm, String(Math.round(e.tjm)));
  if (e.tjm2024 > 0) params.set(CLES.tjm2024, String(Math.round(e.tjm2024)));
  if (e.tjm2025 > 0) params.set(CLES.tjm2025, String(Math.round(e.tjm2025)));
  if (e.tjm2027 > 0) params.set(CLES.tjm2027, String(Math.round(e.tjm2027)));
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
  const professions = lireProfessions(p.get(CLES.professions), defauts.professions);
  return {
    professions,
    tjm: nombre(p.get(CLES.tjm), defauts.tjm, 0, MAX_MONTANT),
    tjm2024: nombre(p.get(CLES.tjm2024), defauts.tjm2024, 0, MAX_MONTANT),
    tjm2025: nombre(p.get(CLES.tjm2025), defauts.tjm2025, 0, MAX_MONTANT),
    tjm2027: nombre(p.get(CLES.tjm2027), defauts.tjm2027, 0, MAX_MONTANT),
    niveau: lireNiveau(p.get(CLES.niveau), defauts.niveau),
    ville: lireVille(p.get(CLES.ville), professions, defauts.ville),
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
