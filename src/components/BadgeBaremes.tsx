import * as P from '../lib/parametres2026';

/**
 * The "rates up to date" badge, which only says so while every parameter is
 * within its validity date. Past one, it admits the update is pending rather
 * than vouching for a rate that may have changed.
 */
export function BadgeBaremes() {
  const aJour = P.parametresPerimes(P.aujourdhuiAParis()).length === 0;
  return (
    <p
      className={`mb-5 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium ${
        aJour ? 'bg-brand-50 text-brand-700' : 'bg-gold-500/15 text-ink-700'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${aJour ? 'bg-brand-500' : 'bg-gold-500'}`}
      />
      {aJour ? `Barèmes ${P.ANNEE} à jour` : `Barèmes ${P.ANNEE} en cours de mise à jour`}
    </p>
  );
}
