import brut from '../data/actualites.json';
import { ECHEANCES, EVENEMENTS, REFERENCES } from './barometreTjm';

/**
 * One chronological feed of everything the site leans on.
 *
 * Built by merging rather than by copying. The market milestones and the coming
 * deadlines already live in the barometer dataset, and the fiscal texts sit in
 * actualites.json because nothing else dates them; the feed reads all three, so
 * a correction made where an item belongs shows up here and cannot drift.
 */

export type Categorie = 'fiscal' | 'reglementaire' | 'marche';

/** The site's own subjects, so a reader can narrow the feed to their question. */
export type Theme = 'tjm' | 'ca' | 'salaire' | 'impots' | 'obligations';

export const LIBELLE_THEME: Record<Theme, string> = {
  tjm: 'TJM',
  ca: "Chiffre d'affaires",
  salaire: 'Salaire et dividendes',
  impots: 'Impôts',
  obligations: 'Obligations',
};

/** Listing order: the tools' order, not the order themes happen to appear in. */
export const THEMES = Object.keys(LIBELLE_THEME) as Theme[];

export type Actualite = {
  /** "YYYY-MM-DD" or "YYYY-MM" when only the month is known. */
  date: string;
  /** Written out, since some entries are a season rather than a day. */
  quand: string;
  categorie: Categorie;
  titre: string;
  detail: string;
  url?: string;
  hote?: string;
  /** Which of the site's subjects the item bears on. */
  themes: Theme[];
  /** True for a date that has not passed: the feed marks it rather than hides it. */
  aVenir?: boolean;
};

export const LIBELLE_CATEGORIE: Record<Categorie, string> = {
  fiscal: 'Fiscal et social',
  reglementaire: 'Réglementaire',
  marche: 'Marché',
};

/** Month names, for the entries that carry only a month. */
const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

const FISCALES = (brut as { entrees: Actualite[] }).entrees;

/**
 * A duty that comes back every year, as opposed to a one-off change.
 *
 * It has no place in a dated feed — a deadline that returns each 15 March is
 * never news — but it is the other half of what a reader wants from this page:
 * not only what changed, but what is owed and when.
 */
export type Rendezvous = {
  /** Written out; some are a rule ("le délai fixé par les statuts") not a date. */
  quand: string;
  /**
   * "MM-DD", where it falls in the year — for placing it on the timeline only.
   * `quand` stays the authority on what is displayed, since a couple of these
   * are a working-day rule rather than a fixed date. Absent when the duty has
   * no single moment: a monthly return, a deadline set by the articles.
   */
  jour?: string;
  titre: string;
  detail: string;
  themes: Theme[];
  /** Path of the tool that computes it, when there is one. */
  outil?: string;
};

export const CALENDRIER = ((brut as { calendrier?: Rendezvous[] }).calendrier ??
  []) as Rendezvous[];

/**
 * When the feed itself was last revised, spelled out.
 *
 * Distinct from the barometer's own check date: this one says when entries were
 * last added or corrected, which is what tells a reader whether the page is
 * still tended.
 */
/**
 * The two duties just passed and the two just ahead, from today's place in the
 * year — wrapping around the turn of it, so early January looks back at
 * December rather than at nothing.
 *
 * Only the fixed dates take part. A monthly return or a deadline the articles
 * set has no single point to sit on, and inventing one would misinform.
 */
export function jalonsAutourDeCeJour(
  aujourdhui = new Date(),
  combien = 2,
): { passees: Rendezvous[]; aVenir: Rendezvous[] } {
  const fixes = CALENDRIER.filter((r) => r.jour).sort((a, b) =>
    a.jour! < b.jour! ? -1 : 1,
  );
  if (!fixes.length) return { passees: [], aVenir: [] };

  const jour = `${String(aujourdhui.getMonth() + 1).padStart(2, '0')}-${String(
    aujourdhui.getDate(),
  ).padStart(2, '0')}`;
  const suivant = fixes.findIndex((r) => r.jour! > jour);
  // Everything behind us if none is ahead — December's is then the latest.
  const coupe = suivant === -1 ? fixes.length : suivant;

  // Modulo, so the two before January's first are the tail of the year before.
  const a = (i: number) => fixes[((i % fixes.length) + fixes.length) % fixes.length];
  return {
    passees: Array.from({ length: combien }, (_, k) => a(coupe - combien + k)),
    aVenir: Array.from({ length: combien }, (_, k) => a(coupe + k)),
  };
}

export const MIS_A_JOUR_LE: string | null = (() => {
  const iso = (brut as { misAJourLe?: string }).misAJourLe;
  if (!iso) return null;
  const [a, m, j] = iso.split('-').map(Number);
  return `${j}${j === 1 ? 'ᵉʳ' : ''} ${MOIS[m - 1]} ${a}`;
})();

/** "2026-10" sorts as if the 1st, so a month and a day compare cleanly. */
const clef = (date: string) => (date.length === 7 ? `${date}-01` : date);

/**
 * Last day the entry can still be called ahead of us.
 *
 * A date known only to the month has not happened on the 1st — "autumn 2026"
 * should not read as past the moment October opens. So a month runs out at its
 * end, while a full date is spent on the day itself.
 */
const echu = (date: string) => {
  if (date.length !== 7) return date;
  const [a, m] = date.split('-').map(Number);
  const dernier = new Date(Date.UTC(a, m, 0)).getUTCDate();
  return `${date}-${dernier}`;
};

const moisAn = (date: string) => {
  const [a, m] = date.split('-').map(Number);
  return `${MOIS[(m || 1) - 1]} ${a}`;
};

const AUJOURDHUI = new Date().toISOString().slice(0, 10);

/**
 * Everything the site cites, newest first, upcoming dates included.
 *
 * Future entries lead the feed: a reader wants to know what is about to move
 * before being told what already did.
 */
export const ACTUALITES: Actualite[] = [
  ...FISCALES,
  ...EVENEMENTS.map(
    (e): Actualite => ({
      date: e.date,
      quand: moisAn(e.date),
      categorie: 'marche',
      titre: e.label,
      detail: e.explication ?? '',
      themes: (e.themes ?? []) as Theme[],
    }),
  ),
  ...ECHEANCES.map(
    (e): Actualite => ({
      date: e.date,
      quand: e.quand,
      categorie: 'reglementaire',
      titre: e.titre,
      detail: e.explication,
      url: e.url,
      hote: e.hote,
      themes: (e.themes ?? []) as Theme[],
    }),
  ),
]
  .map((a) => ({ ...a, aVenir: echu(a.date) >= AUJOURDHUI }))
  .sort((a, b) => (clef(a.date) < clef(b.date) ? 1 : -1));

/**
 * Standing references with no date of their own.
 *
 * Market studies and rate barometers are revised rather than published once, so
 * dropping them into a chronological feed would put a false date on them. They
 * are listed apart instead.
 */
export const REFERENCES_PERMANENTES = REFERENCES;
