import { useMemo } from 'react';
import { Montant, Segments } from './Champs';
import { calculerCfe, type HypothesesCfe } from '../lib/cfe';
import { eur, tauxPct } from '../lib/format';
import * as P from '../lib/parametres2026';

const LIEN_TAUX = 'https://entreprendre.service-public.gouv.fr/vosdroits/R66389';

/**
 * The CFE estimate: the bill founders forget, exempt the first year, halved
 * the second, then due every December on the commune's minimum base.
 */
export function SectionCfe({
  h,
  onChange,
}: {
  h: HypothesesCfe;
  onChange: (h: HypothesesCfe) => void;
}) {
  const r = useMemo(() => calculerCfe(h), [h]);
  const maj = <K extends keyof HypothesesCfe>(cle: K, valeur: HypothesesCfe[K]) =>
    onChange({ ...h, [cle]: valeur });
  const tauxConnu = h.tauxCommune > 0;
  const anneeCourante = r.annees.find((a) => a.annee === P.ANNEE);

  return (
    <section id="cfe" className="scroll-mt-20 mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
        Et la CFE&nbsp;?
      </h2>
      <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
        La cotisation foncière des entreprises arrive en décembre et surprend presque
        tous les créateurs : rien l'année de création, une base réduite de moitié
        l'année suivante, puis la base minimum de votre commune chaque année. Sans
        local, c'est sur cette base minimum que vous êtes imposé.
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-12">
        <div className="card grid gap-5 p-5 sm:grid-cols-2 sm:p-7 lg:col-span-7">
          <Montant
            label="Chiffre d'affaires annuel HT"
            valeur={h.chiffreAffaires}
            onChange={(v) => maj('chiffreAffaires', v)}
            hint={`Celui de l'avant-dernière année (N-2), ramené à douze mois. Base minimum entre ${eur(r.baseMin)} et ${eur(r.baseMax)} selon la commune.`}
          />
          <Segments
            label="Création de la société"
            valeur={h.anneeCreation}
            options={[
              { valeur: P.ANNEE, label: String(P.ANNEE) },
              { valeur: P.ANNEE - 1, label: String(P.ANNEE - 1) },
              { valeur: P.ANNEE - 2, label: `${P.ANNEE - 2} ou avant` },
            ]}
            onChange={(v) => maj('anneeCreation', v)}
          />
          <Montant
            label="Taux de CFE de votre commune"
            valeur={h.tauxCommune}
            onChange={(v) => maj('tauxCommune', v)}
            suffixe="%"
            max={100}
            decimales={2}
            hint="Aucune moyenne nationale ne le remplace : il varie fortement d'une commune à l'autre."
          />
          <Montant
            label="Base minimum votée par la commune"
            valeur={h.baseCommune}
            onChange={(v) => maj('baseCommune', v)}
            hint={`Laissez 0 si vous l'ignorez : le calcul retient alors le haut de la fourchette, ${eur(r.baseMax)}.`}
          />
          <div className="sm:col-span-2">
            <Segments
              label="Taxe additionnelle de la chambre de commerce"
              valeur={h.ressortissantCci}
              options={[
                { valeur: true, label: 'Due' },
                { valeur: false, label: 'Non due' },
              ]}
              onChange={(v) => maj('ressortissantCci', v)}
              hint={`${tauxPct(P.CFE_TAXE_ADDITIONNELLE_CCI * 100)} de la base pour une société commerciale. Les artisans inscrits à la seule chambre des métiers en sont exonérés.`}
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-500 sm:col-span-2">
            Le taux figure sur votre dernier avis de CFE, ou dans{' '}
            <a
              href={LIEN_TAUX}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-brand-600 underline decoration-brand-200 underline-offset-2 hover:text-brand-700"
            >
              le service des taux d'imposition par commune
            </a>
            .
          </p>
        </div>

        <div className="lg:col-span-5">
          <div className="card p-5 sm:p-7">
            {r.premiereAnneeDue === null ? (
              <p className="leading-relaxed text-ink-700">
                <strong className="text-ink-900">Aucune CFE due</strong> : avec{' '}
                {eur(P.CFE_SEUIL_EXONERATION_CA)} de chiffre d'affaires ou moins, la société
                en est exonérée. La déclaration initiale 1447-C reste à déposer l'année de
                création.
              </p>
            ) : (
              <>
                <p className="text-sm text-ink-500">CFE due en {P.ANNEE}</p>
                <p className="tabular mt-1 text-4xl font-semibold tracking-tight text-ink-900">
                  {anneeCourante && anneeCourante.total > 0
                    ? eur(anneeCourante.total)
                    : anneeCourante?.exoneration
                      ? '0 €'
                      : '—'}
                </p>
                <p className="mt-1.5 text-sm text-ink-500">
                  {!tauxConnu
                    ? 'Saisissez le taux de votre commune pour chiffrer le montant.'
                    : `Première année due : ${r.premiereAnneeDue}, à payer au 15 décembre.`}
                </p>
                <ul className="mt-6 divide-y divide-ink-100 border-t border-ink-100">
                  {r.annees.map((a, i) => (
                    <li key={a.annee} className="flex items-baseline justify-between gap-4 py-3 text-sm">
                      <span className="text-ink-600">
                        {i === 2 && h.anneeCreation === P.ANNEE - 2 ? `${a.annee} et après` : a.annee}
                        <span className="ml-2 text-xs text-ink-400">
                          {a.exoneration === 'creation'
                            ? 'année de création, exonérée'
                            : a.exoneration === 'chiffreAffaires'
                              ? 'exonérée'
                              : i === 1
                                ? `base réduite de moitié, ${eur(a.base)}`
                                : `base ${eur(a.base)}`}
                        </span>
                      </span>
                      <span className="tabular font-semibold text-ink-900">
                        {a.exoneration ? '0 €' : tauxConnu ? eur(a.total) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
                {tauxConnu && anneeCourante && !anneeCourante.exoneration && (
                  <p className="mt-3 text-xs leading-relaxed text-ink-500">
                    Dont {eur(anneeCourante.cfe)} de cotisation,{' '}
                    {eur(anneeCourante.taxeAdditionnelle)} de taxe additionnelle et{' '}
                    {eur(anneeCourante.fraisGestion)} de frais de gestion. Un local
                    professionnel dont la valeur locative dépasse la base minimum serait
                    imposé sur cette valeur.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
