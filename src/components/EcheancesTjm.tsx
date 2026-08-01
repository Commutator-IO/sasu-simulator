import type { Echeance } from '../lib/barometreTjm';

/**
 * What is coming, and why it might move a day rate.
 *
 * Deliberately not drawn on the chart. The markers there annotate a curve that
 * has already bent; these have not happened, and putting them on the same axis
 * would let a reader mistake a diary entry for a measurement. A list also has
 * room to say *how* each one would act — a regulation that creates demand and
 * one that freezes it look identical as a vertical line.
 */
export function EcheancesTjm({ echeances }: { echeances: Echeance[] }) {
  if (!echeances.length) return null;

  return (
    <ol className="mt-8 grid gap-4 sm:grid-cols-2">
      {echeances.map((e) => (
        <li key={e.titre} className="card p-5">
          <div className="flex items-baseline gap-3">
            {/* Outlined, where the past markers are filled: nothing has happened
                yet, and the chip should not claim otherwise. */}
            <span className="tabular shrink-0 rounded-md border border-dashed border-ink-300 px-2 py-0.5 text-xs font-semibold text-ink-500">
              {e.quand}
            </span>
            <h3 className="text-sm font-semibold text-ink-900">{e.titre}</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-ink-600">{e.explication}</p>
          {e.url && (
            <p className="mt-3">
              <a
                href={e.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
              >
                {e.hote ?? 'Source'}
              </a>
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}
