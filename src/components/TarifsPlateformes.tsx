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

  // Platforms charging the same are one row: identical figures repeated three
  // times read as three choices when they are one.
  const groupes = [...new Map(PLATEFORMES.map((p) => [p.taux, [] as typeof PLATEFORMES])).keys()]
    .sort((a, b) => a - b)
    .map((taux) => {
      const membres = PLATEFORMES.filter((p) => p.taux === taux);
      // A label only stands for the row when every member shares it: one
      // platform's "negotiated margin" must not be read onto its neighbours.
      const libelles = new Set(membres.map((m) => m.tauxLibelle ?? ''));
      return {
        taux,
        membres,
        tauxLibelle: libelles.size === 1 ? membres[0].tauxLibelle : undefined,
      };
    });

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
              <th className="pb-2 pl-3 text-right font-semibold text-ink-900">
                À saisir pour 2027
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {groupes.map((g) => (
            <tr key={g.taux} className="border-b border-ink-100 align-top">
              <td className="py-3 pr-3">
                <span className="font-medium text-ink-900">
                  {g.membres.map((m) => m.nom).join(', ')}
                </span>
                {g.membres.map((m) => (
                  <p key={m.nom} className="mt-0.5 text-xs leading-relaxed text-ink-500">
                    {g.membres.length > 1 && (
                      <span className="font-medium text-ink-600">{m.nom} — </span>
                    )}
                    {m.note}
                    {m.url && (
                      <>
                        {' '}
                        <a
                          href={m.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-brand-700 underline underline-offset-2 hover:text-brand-800"
                        >
                          {m.hote}
                        </a>
                      </>
                    )}
                  </p>
                ))}
              </td>
              <td className="tabular px-3 py-3 text-right text-ink-600">
                {g.tauxLibelle ?? (g.taux === 0 ? '—' : `${Math.round(g.taux * 100)} %`)}
              </td>
              <td className="tabular px-3 py-3 text-right font-semibold text-ink-900">
                {eur(aSaisir(tjm, g.taux))}
              </td>
              {cible ? (
                <td className="tabular py-3 pl-3 text-right font-semibold text-brand-700">
                  {eur(aSaisir(cible, g.taux))}
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

    </div>
  );
}
