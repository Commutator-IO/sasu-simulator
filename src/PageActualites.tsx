import { useEffect, useState } from 'react';
import { Entete, Pied } from './components/Cadre';
import { Segments } from './components/Champs';
import { TimelineAnnee } from './components/TimelineAnnee';
import { VERIFIE_LE } from './lib/barometreTjm';
import {
  calendrierPour,
  decoderCalendrier,
  encoderCalendrier,
  DEFAUTS_CALENDRIER,
  REGIMES_TVA,
  type OptionsCalendrier,
} from './lib/calendrierOptions';
import { CLE_CALENDRIER, litStockage, sauvegarderRecherche } from './lib/persistance';
import {
  ACTUALITES,
  jalonsAutourDeCeJour,
  prochainesRecurrences,
  LIBELLE_CATEGORIE,
  LIBELLE_THEME,
  MIS_A_JOUR_LE,
  REFERENCES_PERMANENTES,
  THEMES,
  type Actualite,
  type Theme,
} from './lib/actualites';

/**
 * Everything the site leans on, in one dated feed.
 *
 * Scattered across the tools, a source is only ever seen by whoever opens the
 * page that uses it — so a reader has no way of telling whether the whole thing
 * is kept up. Gathered and dated, the feed answers that question by itself: the
 * top of the list is how current the site is.
 *
 * Nothing here is authored twice. Each entry is read from where it belongs —
 * the barometer dataset for market milestones and deadlines, actualites.json
 * for the fiscal texts — so this page cannot contradict the pages it summarises.
 */
export default function PageActualites() {
  // No theme selected means everything, rather than nothing: a filter should
  // start by showing the feed, not by asking a question.
  const [choisis, setChoisis] = useState<Theme[]>([]);
  const retenues = choisis.length
    ? ACTUALITES.filter((a) => a.themes.some((t) => choisis.includes(t)))
    : ACTUALITES;
  // Opposite orders, because they answer opposite questions. What is coming
  // reads soonest first — that is the one you have to prepare. What already
  // happened reads most recent first, since the latest change is the one that
  // set the figures in force. `filter` returns a fresh array, so reversing it
  // leaves the shared feed untouched.
  const aVenir = retenues.filter((a) => a.aVenir).reverse();
  const passees = retenues.filter((a) => !a.aVenir);

  // VAT and property tax follow the company, not the law alone, so the reader
  // states their case once and it is remembered.
  const [options, setOptions] = useState<OptionsCalendrier>(() =>
    decoderCalendrier(litStockage(CLE_CALENDRIER), DEFAUTS_CALENDRIER),
  );
  useEffect(() => {
    sauvegarderRecherche(CLE_CALENDRIER, encoderCalendrier(options));
  }, [options]);

  const calendrier = calendrierPour(options);
  const rendezvous = choisis.length
    ? calendrier.filter((r) => r.themes.some((t) => choisis.includes(t)))
    : calendrier;

  // Computed once per render from the runtime clock: the page is static, so
  // this is the only thing that keeps it speaking about today.
  const jalons = jalonsAutourDeCeJour(new Date(), 2, calendrier);
  const recurrentes = prochainesRecurrences(new Date(), calendrier);

  const basculer = (t: Theme) =>
    setChoisis((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));

  return (
    <div className="min-h-screen">
      <Entete chemin="/actualites/" />

      <main>
        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Mis à jour en continu
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Ce qui fait bouger les chiffres
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Les textes fiscaux, les jalons de marché et les échéances derrière
              chaque paramètre du simulateur, du plus récent au plus ancien. Un
              barème périmé ne se distingue pas d'un barème juste&nbsp;: cette page
              est là pour qu'on puisse en juger.
            </p>
            <p className="field-hint mt-4">
              {MIS_A_JOUR_LE && <>Fil mis à jour le {MIS_A_JOUR_LE}.</>}
              {MIS_A_JOUR_LE && VERIFIE_LE && ' '}
              {VERIFIE_LE && <>Données de marché relevées à la source le {VERIFIE_LE}.</>}
            </p>

            <div className="mt-8 rounded-2xl border border-ink-200 bg-white p-5 sm:p-6">
              <p className="field-label">Où en est votre exercice</p>
              <p className="mt-1 mb-5 text-sm text-ink-500">
                Une SASU paie son impôt avant de savoir ce qu'elle doit&nbsp;: les
                acomptes courent toute l'année et la régularisation ne vient
                qu'après la clôture.
              </p>
              <TimelineAnnee
                passees={jalons.passees}
                aVenir={jalons.aVenir}
                recurrentes={recurrentes}
              />
            </div>

            <div className="mt-8">
              <p className="field-label">Filtrer par sujet</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {THEMES.map((t) => {
                  const actif = choisis.includes(t);
                  const n = ACTUALITES.filter((a) => a.themes.includes(t)).length;
                  return (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={actif}
                      onClick={() => basculer(t)}
                      className={[
                        'rounded-full px-3 py-1.5 text-sm font-medium transition',
                        actif
                          ? 'bg-brand-600 text-white'
                          : 'border border-ink-200 bg-white text-ink-600 hover:border-ink-300 hover:text-ink-900',
                      ].join(' ')}
                    >
                      {LIBELLE_THEME[t]}{' '}
                      <span className="tabular opacity-60">{n}</span>
                    </button>
                  );
                })}
                {choisis.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setChoisis([])}
                    className="rounded-full px-3 py-1.5 text-sm font-medium text-ink-500 underline underline-offset-4 hover:text-ink-900"
                  >
                    Tout afficher
                  </button>
                )}
              </div>
              {choisis.length > 0 && (
                <p className="field-hint mt-3">
                  {retenues.length} entrée{retenues.length > 1 ? 's' : ''} sur{' '}
                  {ACTUALITES.length}.
                </p>
              )}
            </div>
          </div>
        </section>

        {aVenir.length > 0 && (
          <section className="border-b border-ink-200/70 bg-ink-50">
            <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
                À venir
              </h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
                Des dates déjà fixées, dont l'effet reste à constater.
              </p>
              <Fil entrees={aVenir} />
            </div>
          </section>
        )}

        {passees.length > 0 && (
        <section className="bg-white">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Déjà survenu
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
              Ce qui a produit les paramètres en vigueur et la forme des courbes.
            </p>
            <Fil entrees={passees} />
          </div>
        </section>
        )}

        {retenues.length === 0 && rendezvous.length === 0 && (
          <section className="bg-white">
            <div className="mx-auto max-w-6xl px-5 py-14 text-ink-500 sm:py-16">
              Aucune entrée sur ce sujet pour l'instant.
            </div>
          </section>
        )}

        {rendezvous.length > 0 && (
          <section className="border-t border-ink-200/70 bg-white">
            <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
                Le calendrier récurrent
              </h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
                Les échéances d'une SASU à l'impôt sur les sociétés dont l'exercice
                est clos au 31 décembre. Elles ne sont pas dans le fil&nbsp;: une
                date qui revient tous les ans n'est jamais une nouvelle.
              </p>
              <div className="mt-6 grid gap-4 rounded-2xl border border-ink-200 bg-white p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-4">
                <Segments
                  label="Votre TVA"
                  classe="sm:col-span-2"
                  valeur={options.tva}
                  options={REGIMES_TVA}
                  onChange={(tva) => setOptions((o) => ({ ...o, tva }))}
                />
                <Bascule
                  label="Année de création"
                  actif={options.premiereAnnee}
                  hint="La CFE n'est pas due, mais la 1447-C reste à déposer."
                  onChange={(premiereAnnee) =>
                    setOptions((o) => ({ ...o, premiereAnnee }))
                  }
                />
                <Bascule
                  label="CFE ≥ 3 000 € l'an dernier"
                  actif={options.acompteCfe}
                  hint="Un acompte de 50 % est alors appelé au 15 juin."
                  onChange={(acompteCfe) => setOptions((o) => ({ ...o, acompteCfe }))}
                />
              </div>

              <ul className="m-0 mt-4 list-none divide-y divide-ink-100 overflow-hidden rounded-2xl border border-ink-200 bg-white p-0">
                {rendezvous.map((r) => (
                  <li
                    key={r.titre}
                    className="flex flex-col gap-x-5 px-4 py-2.5 sm:flex-row"
                  >
                    <span className="tabular shrink-0 text-sm font-semibold text-ink-900 sm:w-48">
                      {r.quand}
                    </span>
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                        <span className="text-sm font-medium text-ink-900">
                          {r.titre}
                        </span>
                        {r.themes.map((t) => (
                          <span
                            key={t}
                            className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700"
                          >
                            {LIBELLE_THEME[t]}
                          </span>
                        ))}
                        {r.outil && (
                          <a
                            href={r.outil}
                            className="text-xs font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                          >
                            le calculer
                          </a>
                        )}
                      </p>
                      <p className="text-sm leading-snug text-ink-500">
                        {r.detail}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}

        {REFERENCES_PERMANENTES.length > 0 && (
          <section className="border-t border-ink-200/70 bg-ink-50">
            <div className="mx-auto max-w-6xl px-5 py-14 sm:py-16">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
                Références permanentes
              </h2>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
                Des travaux révisés plutôt que publiés une fois&nbsp;: les dater
                dans le fil leur donnerait une fausse actualité.
              </p>
              <ul className="mt-8 grid gap-4 sm:grid-cols-2">
                {REFERENCES_PERMANENTES.map((r) => (
                  <li key={r.titre} className="card p-5">
                    <h3 className="text-sm font-semibold text-ink-900">{r.titre}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">
                      {r.detail}
                    </p>
                    {r.url && <Lien url={r.url} hote={r.hote} />}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </main>

      <Pied />
    </div>
  );
}

/** A yes/no in the shape of the Segments control, so the row reads as one. */
function Bascule({
  label,
  actif,
  hint,
  onChange,
}: {
  label: string;
  actif: boolean;
  hint?: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <Segments
      label={label}
      valeur={actif}
      options={[
        { valeur: false, label: 'Non' },
        { valeur: true, label: 'Oui' },
      ]}
      onChange={onChange}
      hint={hint}
    />
  );
}

/** The feed itself: a rule down the left, one dated entry per row. */
function Fil({ entrees }: { entrees: Actualite[] }) {
  return (
    <ol className="mt-8 m-0 list-none space-y-4 border-l border-ink-200 p-0 pl-5 sm:pl-7">
      {entrees.map((a) => (
        <li key={`${a.date}-${a.titre}`} className="relative">
          <span
            aria-hidden="true"
            className={[
              'absolute top-6 h-2 w-2 rounded-full -left-[1.55rem] sm:-left-[2.05rem]',
              a.aVenir ? 'bg-white ring-2 ring-ink-300' : 'bg-brand-500',
            ].join(' ')}
          />
          <article className="card p-5">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="tabular text-sm font-semibold text-ink-900">
                {a.quand}
              </span>
              <span className="rounded-md bg-ink-100 px-2 py-0.5 text-[11px] font-medium text-ink-500">
                {LIBELLE_CATEGORIE[a.categorie]}
              </span>
              {a.themes.map((t) => (
                <span
                  key={t}
                  className="rounded-md bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700"
                >
                  {LIBELLE_THEME[t]}
                  {/* The arrow rides the TJM chip rather than standing alone:
                      it is a market signal, and only that theme carries one. */}
                  {t === 'tjm' && a.effet && (
                    <span
                      title={
                        a.effet === 'hausse'
                          ? 'Plutôt porteur pour les tarifs'
                          : 'Plutôt défavorable aux tarifs'
                      }
                      className={
                        a.effet === 'hausse'
                          ? 'ml-1 text-brand-700'
                          : 'ml-1 text-gold-700'
                      }
                    >
                      {a.effet === 'hausse' ? '↑' : '↓'}
                      <span className="sr-only">
                        {a.effet === 'hausse'
                          ? ' — plutôt porteur pour les tarifs'
                          : ' — plutôt défavorable aux tarifs'}
                      </span>
                    </span>
                  )}
                </span>
              ))}
            </div>
            <h3 className="mt-1.5 font-semibold text-ink-900">{a.titre}</h3>
            {a.detail && (
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{a.detail}</p>
            )}
            {a.url && <Lien url={a.url} hote={a.hote} />}
          </article>
        </li>
      ))}
    </ol>
  );
}

function Lien({ url, hote }: { url: string; hote?: string }) {
  return (
    <p className="mt-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
      >
        {hote ?? 'Source'} ↗
      </a>
    </p>
  );
}
