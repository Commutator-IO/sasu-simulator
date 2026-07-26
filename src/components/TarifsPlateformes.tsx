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
export function TarifsPlateformes({ tjm }: { tjm: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left">
            <th className="pb-2 pr-3 font-semibold text-ink-900">Plateforme</th>
            <th className="pb-2 px-3 text-right font-semibold text-ink-900">Commission</th>
            <th className="pb-2 px-3 text-right font-semibold text-ink-900">
              À afficher pour garder {eur(tjm)}
            </th>
            <th className="pb-2 pl-3 text-right font-semibold text-ink-900">
              Perçu si vous affichez {eur(tjm)}
            </th>
          </tr>
        </thead>
        <tbody>
          {PLATEFORMES.map((p) => {
            const aAfficher = p.taux < 1 ? tjm / (1 - p.taux) : tjm;
            const percu = tjm * (1 - p.taux);
            return (
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
                  {eur(Math.round(aAfficher))}
                </td>
                <td className="tabular py-3 pl-3 text-right text-ink-600">
                  {eur(Math.round(percu))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
