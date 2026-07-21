import { eur, pct } from '../lib/format';
import type { Resultat } from '../lib/simulation';

type Segment = {
  cle: string;
  label: string;
  montant: number;
  couleur: string;
  detail?: string;
};

/**
 * Breaks the pre-salary profit down into a proportional ribbon: what goes to
 * taxes and contributions, what lands in the pocket, what stays in reserves.
 */
export function Cascade({ r }: { r: Resultat }) {
  const total = Math.max(r.resultatAvantRemuneration, 1);

  const segments: Segment[] = [
    {
      cle: 'net',
      label: 'Net en poche',
      montant: Math.max(0, r.netEnPoche),
      couleur: 'var(--color-brand-500)',
      detail: `${eur(r.salaireNet - r.irSurSalaire)} de salaire + ${eur(r.dividendesNets)} de dividendes`,
    },
    {
      cle: 'reserves',
      label: 'Trésorerie conservée',
      montant: Math.max(0, r.reserves),
      couleur: 'var(--color-brand-200)',
      detail: 'Résultat net non distribué, laissé dans la société',
    },
    {
      cle: 'patronales',
      label: 'Cotisations patronales',
      montant: r.cotisationsPatronales,
      couleur: 'var(--color-ink-700)',
    },
    {
      cle: 'salariales',
      label: 'Cotisations salariales et CSG-CRDS',
      montant: r.cotisationsSalariales,
      couleur: 'var(--color-ink-500)',
    },
    {
      cle: 'is',
      label: 'Impôt sur les sociétés',
      montant: r.is,
      couleur: 'var(--color-gold-600)',
    },
    {
      cle: 'ps',
      label: 'Prélèvements sociaux sur dividendes',
      montant: r.prelevementsSociauxDividendes,
      couleur: 'var(--color-gold-500)',
    },
    {
      cle: 'ir',
      label: 'Impôt sur le revenu',
      montant: r.irTotal,
      couleur: 'var(--color-gold-300)',
    },
  ].filter((s) => s.montant > total * 0.0005);

  return (
    <div>
      <div className="flex h-10 w-full overflow-hidden rounded-lg">
        {segments.map((s) => (
          <div
            key={s.cle}
            className="group relative h-full transition-all"
            style={{ width: `${(s.montant / total) * 100}%`, background: s.couleur }}
            title={`${s.label} — ${eur(s.montant)}`}
          />
        ))}
      </div>

      <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
        {segments.map((s) => (
          <div key={s.cle} className="flex items-start gap-2.5">
            <span
              className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: s.couleur }}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                <dt className="text-sm text-ink-700">{s.label}</dt>
                <dd className="tabular shrink-0 text-sm font-semibold text-ink-900">
                  {eur(s.montant)}
                  <span className="ml-1.5 font-normal text-ink-400">
                    {pct(s.montant / total, 0)}
                  </span>
                </dd>
              </div>
              {s.detail && <p className="mt-0.5 text-xs text-ink-400">{s.detail}</p>}
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
