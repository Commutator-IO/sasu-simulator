import { CALENDRIER, type Rendezvous } from './actualites';

/**
 * The two things the calendar cannot know on its own.
 *
 * VAT and property tax are the only duties here whose dates depend on the
 * company rather than on the law alone: a quarterly filer and a monthly one owe
 * the same tax on different days, and a company in its first year owes no CFE
 * at all but still has to file for it. Showing one reading as if it were
 * everyone's would be worse than showing none — so the reader states their
 * case once and the calendar follows.
 */

export type RegimeTva = 'mensuelle' | 'trimestrielle' | 'annuelle' | 'franchise';

export type OptionsCalendrier = {
  tva: RegimeTva;
  /** Last year's CFE reached 3 000 €, so a June instalment is called. */
  acompteCfe: boolean;
  /** First financial year: no CFE due, but the 1447-C return still is. */
  premiereAnnee: boolean;
};

export const DEFAUTS_CALENDRIER: OptionsCalendrier = {
  tva: 'mensuelle',
  acompteCfe: false,
  premiereAnnee: false,
};

export const REGIMES_TVA: { valeur: RegimeTva; label: string }[] = [
  { valeur: 'mensuelle', label: 'Mensuelle' },
  { valeur: 'trimestrielle', label: 'Trimestrielle' },
  { valeur: 'annuelle', label: 'Annuelle' },
  { valeur: 'franchise', label: 'Franchise' },
];

/** How each regime files, and when — the wording shown in place of the default. */
const TVA: Record<
  RegimeTva,
  { quand: string; detail: string; recurrence?: Rendezvous['recurrence'] } | null
> = {
  mensuelle: {
    quand: 'Entre le 15 et le 24 du mois suivant',
    detail:
      'Déclaration CA3 au réel normal, tous les mois. La date exacte dans cette fenêtre dépend de votre situation et figure dans votre espace professionnel.',
    recurrence: {
      jourDuMois: 15,
      jourFin: 24,
      court: 'TVA',
      legende: 'la CA3, tous les mois',
    },
  },
  trimestrielle: {
    quand: 'Entre le 15 et le 24 suivant la fin du trimestre',
    detail:
      'Déclaration CA3 trimestrielle : en janvier, avril, juillet et octobre. La date exacte dans cette fenêtre figure dans votre espace professionnel.',
    recurrence: {
      jourDuMois: 15,
      jourFin: 24,
      court: 'TVA',
      mois: [1, 4, 7, 10],
      legende: 'la CA3, à chaque trimestre',
    },
  },
  annuelle: {
    quand: 'Avec la déclaration de résultats',
    detail:
      'Au réel simplifié, la CA12 est déposée une fois par an, et deux acomptes sont versés en juillet et en décembre.',
  },
  // Nothing is owed, so nothing is shown: an empty row would read as a duty.
  franchise: null,
};

/** The calendar as it applies to one company, in the order it is displayed. */
export function calendrierPour(
  options: OptionsCalendrier,
  calendrier: Rendezvous[] = CALENDRIER,
): Rendezvous[] {
  return calendrier.flatMap((r) => {
    switch (r.option) {
      case 'tva': {
        const regime = TVA[options.tva];
        return regime ? [{ ...r, ...regime }] : [];
      }
      case 'cfeAcompte':
        return options.acompteCfe && !options.premiereAnnee ? [r] : [];
      // The year of creation is exempt from paying, not from filing.
      case 'cfeSolde':
        return options.premiereAnnee ? [] : [r];
      case 'cfeCreation':
        return options.premiereAnnee ? [r] : [];
      default:
        return [r];
    }
  });
}

/** Round-trips the choices through the query string localStorage already holds. */
export function encoderCalendrier(o: OptionsCalendrier): string {
  const p = new URLSearchParams();
  if (o.tva !== DEFAUTS_CALENDRIER.tva) p.set('tva', o.tva);
  if (o.acompteCfe) p.set('acf', '1');
  if (o.premiereAnnee) p.set('an1', '1');
  const q = p.toString();
  return q ? `?${q}` : '';
}

export function decoderCalendrier(
  requete: string,
  base: OptionsCalendrier = DEFAUTS_CALENDRIER,
): OptionsCalendrier {
  const p = new URLSearchParams(requete);
  const tva = p.get('tva');
  return {
    tva: REGIMES_TVA.some((r) => r.valeur === tva) ? (tva as RegimeTva) : base.tva,
    acompteCfe: p.has('acf') ? p.get('acf') === '1' : base.acompteCfe,
    premiereAnnee: p.has('an1') ? p.get('an1') === '1' : base.premiereAnnee,
  };
}
