import { eur } from '../lib/format';
import { PLATEFORMES } from '../lib/barometreTjm';

/**
 * What to configure on each platform to keep the same earnings.
 *
 * Barometer rates — and the rate entered here — are the price the freelancer
 * invoices, before the platform deducts its service fee. So on a platform
 * charging c, invoicing T leaves T × (1 − c); to keep T, you must ask
 * T / (1 − c).
 */
export function TarifsPlateformes({ tjm, cible }: { tjm: number; cible?: number }) {
  const aSaisir = (base: number, taux: number) => Math.round(taux < 1 ? base / (1 - taux) : base);

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left">
            <th className="pb-2 pr-3 font-semibold text-ink-900">Plateforme</th>
            <th className="pb-2 px-3 text-right font-semibold text-ink-900">Commission</th>
            <th className="pb-2 px-3 text-right font-semibold text-ink-900">
              À saisir aujourd'hui
            </th>
            {cible ? (
              <th className="pb-2 px-3 text-right font-semibold text-ink-900">
                À saisir pour 2027
              </th>
            ) : null}
            <th className="pb-2 pl-3 text-right font-semibold text-ink-900">
              Perçu si vous saisissez {eur(tjm)}
            </th>
          </tr>
        </thead>
        <tbody>
          {PLATEFORMES.map((p) => (
            <tr key={p.nom} className="border-b border-ink-100 align-top">
              <td className="py-3 pr-3">
                <span className="font-medium text-ink-900">{p.nom}</span>
                <p className="mt-0.5 text-xs leading-relaxed text-ink-500">{p.note}</p>
                {p.url && (
                  <a
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-1 inline-block text-xs text-brand-700 underline underline-offset-2 hover:text-brand-800"
                  >
                    {p.hote}
                  </a>
                )}
              </td>
              <td className="tabular px-3 py-3 text-right text-ink-600">
                {p.taux === 0 ? '—' : `${Math.round(p.taux * 100)} %`}
              </td>
              <td className="tabular px-3 py-3 text-right font-semibold text-ink-900">
                {eur(aSaisir(tjm, p.taux))}
              </td>
              {cible ? (
                <td className="tabular px-3 py-3 text-right font-semibold text-brand-700">
                  {eur(aSaisir(cible, p.taux))}
                </td>
              ) : null}
              <td className="tabular py-3 pl-3 text-right text-ink-600">
                {eur(Math.round(tjm * (1 - p.taux)))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="mt-8 text-sm font-semibold text-ink-900">
        Comment corriger votre tarif, plateforme par plateforme
      </h3>
      <ol className="mt-3 space-y-3">
        {PLATEFORMES.filter((p) => p.instruction).map((p) => (
          <li key={p.nom} className="flex gap-3">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400" />
            <p className="text-sm leading-relaxed text-ink-600">
              <strong className="text-ink-900">{p.nom}</strong>
              {p.taux > 0 && (
                <>
                  {' '}
                  — saisir{' '}
                  <span className="tabular font-semibold text-ink-900">
                    {eur(aSaisir(cible ?? tjm, p.taux))}
                  </span>
                  {cible ? ' pour 2027' : ''}.
                </>
              )}{' '}
              {p.instruction}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
