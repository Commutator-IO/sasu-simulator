/**
 * Shape of the illustrated conversations on the MCP page, and the two accessors
 * their compute functions use.
 *
 * Kept out of the component file so the questions can be declared as data and
 * the answers computed by the site's own engine, without the page importing a
 * component just to reach a type.
 */

/** What a reader can change in a question: a figure, or a choice from a list. */
export type Valeurs = Record<string, number | string>;

export type Barre = {
  mois: string;
  valeur: number;
  /** True for a month not yet invoiced, whose amount is extrapolated. */
  projete?: boolean;
  /** Set on invoiced months, so the bar carries an adjustable amount. */
  cle?: string;
};

export type Echange = {
  /** Question text; every `{cle}` becomes an adjustable value. */
  question: string;
  /** Starting values. Numbers are typed in, strings are picked from a list. */
  champs: Valeurs;
  /** Allowed values for the fields that are choices rather than figures. */
  options?: Record<string, string[]>;
  outil: string;
  /** Document the user attached, if any. */
  fichier?: string;
  /** The engine call itself: same inputs in, same figures out as the tool. */
  calculer: (v: Valeurs) => { reponse: string[]; graphique?: Barre[] };
};

/** Reads a field as a number, whatever the control handed back. */
export const nb = (v: Valeurs, cle: string) => Number(v[cle]) || 0;

/** Reads a field as a string. */
export const txt = (v: Valeurs, cle: string) => String(v[cle] ?? '');
