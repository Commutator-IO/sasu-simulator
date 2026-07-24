import { useEffect, useMemo, useState } from 'react';
import { Curseur, Montant, Segments } from './components/Champs';
import { Entete, Pied } from './components/Cadre';
import { HistogrammeProjection } from './components/HistogrammeProjection';
import { BoutonPartage } from './components/BoutonPartage';
import { eur, pct } from './lib/format';
import {
  calculerProjection,
  DEFAUTS_PROJECTION,
  MOIS,
  NB_MOIS,
  reprojeter,
  type HypothesesProjection,
} from './lib/projection';
import {
  decoderProjection,
  encoderProjection,
  lienPartageProjection,
  lienVersAcomptes,
  lienVersArbitrage,
} from './lib/urlProjection';
import { LIEN_ISSUES } from './lib/depot';
import * as P from './lib/parametres2026';

export default function PageProjection() {
  // Initial state comes from the URL: a shared link must reopen exactly the
  // same projection.
  const [h, setH] = useState<HypothesesProjection>(() =>
    decoderProjection(
      typeof window === 'undefined' ? '' : window.location.search,
      DEFAUTS_PROJECTION,
    ),
  );
  const r = useMemo(() => calculerProjection(h), [h]);

  // The URL follows the state without pushing a history entry on every edit.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const requete = encoderProjection(h, DEFAUTS_PROJECTION);
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${requete}${window.location.hash}`,
      );
    }, 250);
    return () => clearTimeout(minuteur);
  }, [h]);

  const majFacturation = (i: number, montant: number) =>
    setH((v) => {
      const facturation = [...v.facturation];
      facturation[i] = montant;
      return { ...v, facturation };
    });

  // Declaring how far into the year you are extrapolates the remaining months
  // to the average of those already invoiced. They stay editable afterwards.
  const majMoisFactures = (n: number) =>
    setH((v) => ({
      ...v,
      moisFactures: n,
      facturation: reprojeter(v.facturation, n),
    }));

  const reprojeterMaintenant = () =>
    setH((v) => ({ ...v, facturation: reprojeter(v.facturation, v.moisFactures) }));

  const jusqua = h.moisFactures > 0 ? MOIS[h.moisFactures - 1].toLowerCase() : null;

  return (
    <div className="min-h-screen">
      <Entete chemin="/projection/" />

      <main>
        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Barèmes {P.ANNEE} à jour
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Où en sera votre chiffre d'affaires en fin d'année&nbsp;?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Saisissez ce que vous avez facturé mois par mois. Les mois qui
              restent se projettent à votre rythme moyen, et l'outil en déduit
              votre résultat avant rémunération — celui qui décide de votre
              salaire, de vos dividendes et de vos acomptes.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* ------------------------------------------------------ Saisie */}
            <div className="lg:col-span-7">
              <div className="card p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  Où en êtes-vous dans l'année&nbsp;?
                </h2>

                <div className="mt-6">
                  <Curseur
                    label="Mois déjà facturés"
                    valeur={h.moisFactures}
                    min={0}
                    max={NB_MOIS}
                    pas={1}
                    onChange={majMoisFactures}
                    rendu={(n) => (n === 0 ? 'aucun' : `${n} mois`)}
                    hint={
                      jusqua
                        ? `Facturé jusqu'à ${jusqua}. Les mois suivants se projettent à la moyenne, et restent modifiables.`
                        : 'Aucun mois facturé : renseignez au moins un mois pour lancer la projection.'
                    }
                  />
                </div>

                <div className="mt-8">
                  <div className="flex items-baseline justify-between gap-4">
                    <h3 className="text-sm font-medium text-ink-700">
                      Chiffre d'affaires mensuel
                    </h3>
                    {h.moisFactures > 0 && h.moisFactures < NB_MOIS && (
                      <button
                        type="button"
                        onClick={reprojeterMaintenant}
                        className="rounded-lg border border-ink-200 bg-white px-2.5 py-1 text-xs font-medium text-ink-500 transition hover:border-brand-400 hover:text-brand-700"
                      >
                        Reprojeter les mois à venir
                      </button>
                    )}
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    Montants hors taxes. Les mois à venir sont grisés&nbsp;: ce
                    sont des projections que vous pouvez ajuster.
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {r.mois.map((m, i) => (
                      <Montant
                        key={m.nom}
                        label={m.nom}
                        valeur={h.facturation[i] ?? 0}
                        onChange={(v) => majFacturation(i, v)}
                        hint={m.projete ? 'projeté' : undefined}
                      />
                    ))}
                  </div>
                </div>

                <div className="mt-8 border-t border-ink-200 pt-6">
                  <h3 className="text-sm font-medium text-ink-700">Vos charges</h3>
                  <div className="mt-4 grid gap-5">
                    <Montant
                      label="Frais fixes mensuels"
                      valeur={h.fraisMensuels}
                      onChange={(v) => setH((s) => ({ ...s, fraisMensuels: v }))}
                      hint="Comptabilité, logiciels, assurance, banque, abonnements — ce qui tombe chaque mois quel que soit le chiffre d'affaires."
                    />
                    <Curseur
                      label="Frais variables"
                      valeur={h.tauxFraisVariables}
                      min={0}
                      max={0.3}
                      pas={0.005}
                      onChange={(v) => setH((s) => ({ ...s, tauxFraisVariables: v }))}
                      rendu={(v) => pct(v)}
                      hint="Part du chiffre d'affaires : sous-traitance, commissions de plateforme, tout ce qui monte avec l'activité."
                    />
                  </div>

                  <div className="mt-6">
                    <Segments
                      label="Taux réduit d'impôt sur les sociétés"
                      valeur={h.eligibleISReduit}
                      options={[
                        { valeur: true, label: 'Éligible' },
                        { valeur: false, label: 'Non éligible' },
                      ]}
                      onChange={(v) => setH((s) => ({ ...s, eligibleISReduit: v }))}
                      hint="Transmis aux autres outils quand vous y ouvrez cette projection."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- Résultat */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <div className="card overflow-hidden">
                  <div className="bg-brand-700 px-6 py-7 text-white sm:px-8">
                    <p className="text-sm text-brand-100">
                      {r.deficit
                        ? 'Perte projetée avant rémunération'
                        : 'Résultat projeté avant rémunération'}
                    </p>
                    <p className="tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                      {r.deficit ? `− ${eur(-r.resultatAvantRemuneration)}` : eur(r.resultatAvantRemuneration)}
                    </p>
                    <p className="mt-1.5 text-sm text-brand-100">
                      sur {eur(r.caTotal)} de chiffre d'affaires
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-brand-600">
                      <div className="bg-brand-700 px-4 py-3">
                        <p className="text-xs text-brand-200">CA facturé</p>
                        <p className="tabular mt-0.5 font-semibold">{eur(r.caFacture)}</p>
                      </div>
                      <div className="bg-brand-700 px-4 py-3">
                        <p className="text-xs text-brand-200">CA projeté</p>
                        <p className="tabular mt-0.5 font-semibold">{eur(r.caProjete)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-6 sm:px-8">
                    <dl className="space-y-3">
                      <Stat label="Frais fixes sur l'année" valeur={eur(r.fraisFixesAnnuels)} />
                      {r.fraisVariablesAnnuels > 0 && (
                        <Stat
                          label={`Frais variables (${pct(h.tauxFraisVariables)})`}
                          valeur={eur(r.fraisVariablesAnnuels)}
                        />
                      )}
                      <Stat label="Total des charges" valeur={eur(r.chargesTotales)} />
                      <Stat
                        label="Moyenne mensuelle facturée"
                        valeur={eur(r.moyenneMensuelle)}
                      />
                    </dl>

                    <div className="mt-6 space-y-2">
                      <a
                        href={lienVersArbitrage(r.resultatAvantRemuneration, h.eligibleISReduit)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                      >
                        Optimiser salaire / dividendes →
                      </a>
                      <a
                        href={lienVersAcomptes(r.resultatAvantRemuneration, h.eligibleISReduit)}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-800 transition hover:border-brand-400 hover:text-brand-700"
                      >
                        Prévoir mes acomptes →
                      </a>
                      <p className="px-2 text-xs leading-relaxed text-ink-400">
                        Ce résultat est calculé avant votre rémunération. Les
                        deux outils reprennent le chiffre&nbsp;; l'arbitrage y
                        applique salaire et impôts, les acomptes s'en servent
                        comme bénéfice de départ.
                      </p>
                    </div>
                  </div>
                </div>

                <BoutonPartage lien={lienPartageProjection(h, DEFAUTS_PROJECTION)} />
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Graphique */}
        <section className="border-y border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Votre année, mois par mois
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
              Les mois facturés en plein, les mois projetés en clair. La ligne
              dorée marque votre rythme moyen&nbsp;: c'est à ce rythme que se
              remplissent les mois restants, tant que vous ne les ajustez pas.
            </p>

            <div className="card mt-8 p-5 sm:p-8">
              <HistogrammeProjection r={r} />
            </div>
          </div>
        </section>

        <Regles />
      </main>

      <Pied />
    </div>
  );
}

function Stat({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="tabular shrink-0 text-sm font-semibold text-ink-900">{valeur}</dd>
    </div>
  );
}

const METHODE = [
  'La projection additionne les mois facturés puis extrapole les mois restants à la moyenne des premiers. Un mois à venir dont vous connaissez déjà le montant se saisit directement : il remplace la moyenne pour ce mois-là.',
  "Résultat avant rémunération = chiffre d'affaires − frais fixes annualisés − frais variables (part du CA). C'est le résultat d'exploitation avant que le président ne se paie.",
  "Tous les montants sont hors taxes. La TVA collectée et déductible n'entre pas dans le résultat, elle transite par la société.",
  "L'impôt sur les sociétés et la rémunération ne sont pas calculés ici : ils dépendent de l'arbitrage salaire / dividendes, qui reprend ce résultat comme point de départ.",
  "La projection suppose un rythme régulier. Une activité saisonnière se saisit mois par mois plutôt qu'en s'appuyant sur la moyenne.",
];

function Regles() {
  return (
    <section id="sources" className="scroll-mt-20 bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Méthode et hypothèses
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-300">
          Comment la projection est construite, et ce qu'elle laisse de côté.
        </p>

        <ul className="mt-8 max-w-3xl space-y-3">
          {METHODE.map((x) => (
            <li key={x} className="flex gap-3 text-sm leading-relaxed text-ink-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
              {x}
            </li>
          ))}
        </ul>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <a
            href="https://www.malt.fr/t/barometre-tarifs/tech/"
            target="_blank"
            rel="noreferrer"
            className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/50 hover:bg-white/10"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-white">Valeurs par défaut</h3>
              <span className="mt-0.5 shrink-0 text-ink-400 transition group-hover:text-brand-300">
                ↗
              </span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-ink-300">
              Le chiffre d'affaires et les frais proposés par défaut découlent
              du TJM moyen relevé par le baromètre Malt, réparti sur douze mois.
              Ce sont des repères à remplacer par vos chiffres.
            </p>
            <p className="mt-3 text-xs text-ink-400">malt.fr</p>
          </a>
        </div>

        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-300">
          Un calcul vous paraît faux ?{' '}
          <a
            href={LIEN_ISSUES}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-300 underline underline-offset-4 hover:text-brand-200"
          >
            Signalez-le
          </a>
          .
        </p>
      </div>
    </section>
  );
}
