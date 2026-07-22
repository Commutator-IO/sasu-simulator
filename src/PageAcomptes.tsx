import { useEffect, useMemo, useState } from 'react';
import { Curseur, Montant, Segments } from './components/Champs';
import { Entete, Pied } from './components/Cadre';
import { HistogrammeAcomptes } from './components/HistogrammeAcomptes';
import { eur } from './lib/format';
import {
  calculerAcomptes,
  coutSousEstimation,
  DEFAUTS_ACOMPTES,
  echeancierParDefaut,
  NB_ECHEANCES,
  SEUIL_DISPENSE,
  type HypothesesAcomptes,
  type ResultatAcomptes,
} from './lib/acomptes';
import { BoutonPartage } from './components/BoutonPartage';
import {
  decoderAcomptes,
  encoderAcomptes,
  lienPartageAcomptes,
} from './lib/urlAcomptes';
import { LIEN_ISSUES } from './lib/depot';
import * as P from './lib/parametres2026';

export default function PageAcomptes() {
  // Initial state comes from the URL: a shared link must reopen exactly the
  // same simulation.
  const [h, setH] = useState<HypothesesAcomptes>(() =>
    decoderAcomptes(
      typeof window === 'undefined' ? '' : window.location.search,
      DEFAUTS_ACOMPTES,
    ),
  );
  const r = useMemo(() => calculerAcomptes(h), [h]);

  // The URL follows the state without pushing a history entry on every edit.
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const requete = encoderAcomptes(h, DEFAUTS_ACOMPTES);
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${requete}${window.location.hash}`,
      );
    }, 250);
    return () => clearTimeout(minuteur);
  }, [h]);

  // What the slider shows: the manual amount, or what the active strategy
  // works out to for the next unpaid instalment.
  const versementCourant =
    h.strategie === 'manuel'
      ? h.versementManuel
      : (r.echeances.find((e) => !e.passee)?.ajuste ?? 0);

  // Reducing below the call only means something when the profit falls: above
  // the reference, "au plus juste" and "verser l'appel" are the same total.
  const reductionPossible = r.isPrevisionnel < r.isReference - 1;

  const maj = <K extends keyof HypothesesAcomptes>(
    cle: K,
    valeur: HypothesesAcomptes[K],
  ) => setH((v) => ({ ...v, [cle]: valeur }));

  // Declaring a due date as past prefills it with the amount that was called:
  // paying what was asked is the usual case, editing it the exception.
  const majEcheancesPassees = (n: number) =>
    setH((v) => {
      const { parDefaut: appele } = echeancierParDefaut(v);
      const versements = Array.from(
        { length: NB_ECHEANCES },
        (_, i) => v.versements[i] ?? appele[i],
      );
      return { ...v, echeancesPassees: n, versements };
    });

  const majVersement = (i: number, montant: number) =>
    setH((v) => {
      const versements = [...v.versements];
      versements[i] = montant;
      return { ...v, versements };
    });

  return (
    <div className="min-h-screen">
      <Entete chemin="/acomptes/" />

      <main>
        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Barèmes {P.ANNEE} à jour
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Vos acomptes d'impôt sur les sociétés sont-ils trop élevés&nbsp;?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Ils sont calculés sur l'exercice passé. Si votre bénéfice baisse, vous
              avancez à l'État de la trésorerie qu'il vous rendra un an plus tard. Voici
              de combien vous pouvez légalement les réduire.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* ------------------------------------------------------ Saisie */}
            <div className="lg:col-span-7">
              <div className="card p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">Vos exercices</h2>

                <div className="mt-6 grid gap-5">
                  <Montant
                    label="Bénéfice de l'avant-dernier exercice"
                    valeur={h.beneficeAvantDernier}
                    onChange={(v) => maj('beneficeAvantDernier', v)}
                    hint="Il ne pilote que l'acompte du 15 mars : à cette date, les comptes de l'exercice précédent ne sont pas encore approuvés. Le deuxième acompte régularise."
                  />
                  <Montant
                    label="Bénéfice de l'exercice précédent"
                    valeur={h.beneficePrecedent}
                    onChange={(v) => maj('beneficePrecedent', v)}
                    hint="C'est la référence des acomptes : leur total doit égaler l'impôt correspondant."
                  />
                  <Montant
                    label="Bénéfice prévisionnel de l'exercice en cours"
                    valeur={h.beneficePrevisionnel}
                    onChange={(v) => maj('beneficePrevisionnel', v)}
                    hint="Votre estimation de ce que vous dégagerez cette année. C'est la seule donnée qui justifie de moduler."
                  />
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Segments
                    label="Taux réduit d'impôt sur les sociétés"
                    valeur={h.eligibleISReduit}
                    options={[
                      { valeur: true, label: 'Éligible' },
                      { valeur: false, label: 'Non éligible' },
                    ]}
                    onChange={(v) => maj('eligibleISReduit', v)}
                    hint={`15 % jusqu'à ${eur(P.IS_SEUIL_TAUX_REDUIT)} de bénéfice, 25 % au-delà.`}
                  />
                  <Segments
                    label="Premier exercice de la société"
                    valeur={h.premierExercice}
                    options={[
                      { valeur: false, label: 'Non' },
                      { valeur: true, label: 'Oui' },
                    ]}
                    onChange={(v) => maj('premierExercice', v)}
                    hint="Une société nouvellement créée ne verse aucun acompte durant son premier exercice."
                  />
                </div>

                <div className="mt-6">
                  {/* One decision, then a fine adjustment that only shows
                      when it can do something. The strategy buttons and the
                      slider used to be two controls for the same value, sitting
                      in separate blocks. */}
                  <Segments
                    label="Vos versements à venir"
                    valeur={h.strategie === 'appele'}
                    options={[
                      { valeur: true, label: 'Verser ce qui est appelé' },
                      { valeur: false, label: 'Ajuster' },
                    ]}
                    onChange={(verserAppel) =>
                      setH((v) => ({
                        ...v,
                        strategie: verserAppel
                          ? 'appele'
                          : reductionPossible
                            ? 'conserver'
                            : 'lisser',
                      }))
                    }
                    hint={
                      h.strategie === 'appele'
                        ? "Le montant réclamé, sans plus. C'est l'option par défaut si vous ne faites rien."
                        : "La loi permet de réduire un acompte sous votre responsabilité, et rien n'interdit d'en verser davantage."
                    }
                  />

                  {h.strategie !== 'appele' && r.versementPlafond > 0 && (
                    <div className="mt-4 rounded-2xl bg-ink-50 p-5 sm:p-6">
                      <Curseur
                        label="À verser à chaque échéance restante"
                        valeur={Math.round(versementCourant)}
                        min={0}
                        max={Math.ceil(r.versementPlafond / 100) * 100}
                        pas={100}
                        onChange={(v) =>
                          setH((etat) => ({
                            ...etat,
                            strategie: 'manuel',
                            versementManuel: v,
                          }))
                        }
                        rendu={eur}
                        hint={
                          reductionPossible
                            ? "Sous le montant appelé, vous modulez sous votre responsabilité. Au-dessus, vous payez d'avance — toujours permis."
                            : "Votre bénéfice ne baisse pas : il n'y a rien à réduire. Verser davantage étale l'impôt et évite un solde en mai."
                        }
                      />

                      <div className="mt-3 flex flex-wrap gap-2">
                        {(
                          [
                            // Only worth offering when it actually pays less
                            // than what is called: otherwise it is the same
                            // thing as "verser ce qui est appelé", and showing
                            // two buttons for one behaviour confuses.
                            ...(reductionPossible
                              ? ([['conserver', 'Au plus juste', r.versementConserver]] as const)
                              : []),
                            ['lisser', 'Lisser sur deux ans', r.versementLisser],
                          ] as const
                        ).map(([cle, titre, montant]) => {
                          const actif =
                            h.strategie === cle ||
                            (h.strategie === 'manuel' &&
                              Math.abs(h.versementManuel - montant) < 60);
                          return (
                            <button
                              key={cle}
                              type="button"
                              aria-pressed={actif}
                              onClick={() => maj('strategie', cle)}
                              className={[
                                'rounded-lg border px-3 py-1.5 text-xs font-medium transition',
                                actif
                                  ? 'border-brand-500 bg-white text-brand-700'
                                  : 'border-ink-200 bg-white/60 text-ink-500 hover:border-ink-300 hover:text-ink-800',
                              ].join(' ')}
                            >
                              {titre} · {eur(montant)}
                            </button>
                          );
                        })}
                      </div>

                      {/* The consequence, right under the control that causes it */}
                      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-ink-200 pt-4 text-xs sm:grid-cols-3">
                        <div>
                          <dt className="text-ink-400">Reste à verser</dt>
                          <dd className="tabular font-semibold text-ink-800">
                            {eur(r.resteAVerser)}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-400">
                            {r.solde >= 0 ? 'Solde au 15 mai' : 'Restitution au 15 mai'}
                          </dt>
                          <dd className="tabular font-semibold text-ink-800">
                            {eur(Math.abs(r.solde))}
                          </dd>
                        </div>
                        <div>
                          <dt className="text-ink-400">Plus grosse sortie</dt>
                          <dd className="tabular font-semibold text-ink-800">
                            {eur(r.picTresorerie)}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  )}
                </div>

                <div className="mt-8 rounded-2xl bg-ink-50 p-5 sm:p-6">
                  <h3 className="text-sm font-medium text-ink-700">
                    Où en êtes-vous dans l'année&nbsp;?
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-ink-500">
                    Déclarez les échéances déjà passées et ce que vous avez réellement
                    versé. Les suivantes s'ajustent au bénéfice prévisionnel.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {[0, 1, 2, 3, 4].map((n) => (
                      <button
                        key={n}
                        type="button"
                        aria-pressed={h.echeancesPassees === n}
                        onClick={() => majEcheancesPassees(n)}
                        className={[
                          'rounded-lg px-3 py-2 text-sm font-medium transition',
                          h.echeancesPassees === n
                            ? 'bg-white text-ink-900 shadow-sm ring-1 ring-ink-200'
                            : 'text-ink-500 hover:bg-white/60 hover:text-ink-800',
                        ].join(' ')}
                      >
                        {n === 0 ? 'Aucune' : `${n} échéance${n > 1 ? 's' : ''}`}
                      </button>
                    ))}
                  </div>

                  {h.echeancesPassees > 0 && (
                    <div className="mt-5 grid gap-4 sm:grid-cols-2">
                      {r.echeances
                        .filter((e) => e.passee)
                        .map((e) => (
                          <Montant
                            key={e.rang}
                            label={`Versé le ${e.date}`}
                            valeur={h.versements[e.rang - 1] ?? e.parDefaut}
                            onChange={(v) => majVersement(e.rang - 1, v)}
                            hint={
                              Math.abs((h.versements[e.rang - 1] ?? e.parDefaut) - e.parDefaut) < 1
                                ? 'Montant appelé'
                                : `Appelé : ${eur(e.parDefaut)}`
                            }
                          />
                        ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ---------------------------------------------------- Résultat */}
            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <div className="card overflow-hidden">
                  {/* One stable headline. It used to change meaning between
                      cash kept, cash advanced and total called, which made the
                      same slot say three different things. */}
                  <div className="bg-brand-700 px-6 py-7 text-white sm:px-8">
                    <p className="text-sm text-brand-100">Reste à verser cette année</p>
                    <p className="tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                      {eur(r.resteAVerser)}
                    </p>
                    <p className="mt-1.5 text-sm text-brand-100">
                      {r.dispense
                        ? "Aucun acompte n'est dû : tout se règle au solde"
                        : `sur ${eur(r.totalParDefaut)} appelés au total`}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-brand-600">
                      <div className="bg-brand-700 px-4 py-3">
                        <p className="text-xs text-brand-200">Impôt de référence</p>
                        <p className="tabular mt-0.5 font-semibold">
                          {eur(r.isReference)}
                        </p>
                      </div>
                      <div className="bg-brand-700 px-4 py-3">
                        <p className="text-xs text-brand-200">Impôt prévisionnel</p>
                        <p className="tabular mt-0.5 font-semibold">
                          {eur(r.isPrevisionnel)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-6 sm:px-8">
                    {/* At most one message: the notes used to stack up to five
                        deep. Ordered by what the reader can still act on. */}
                    <Message r={r} strategie={h.strategie} />

                    <dl className="mt-6 space-y-3">
                      {h.echeancesPassees > 0 && (
                        <Stat label="Déjà versé" valeur={eur(r.dejaVerse)} />
                      )}
                      <Stat label="Total sur l'année" valeur={eur(r.totalAjuste)} />
                      <Stat
                        label={r.solde >= 0 ? 'Solde au 15 mai' : 'Restitution au 15 mai'}
                        valeur={eur(Math.abs(r.solde))}
                      />
                      <Stat
                        label="Plus grosse échéance d'ici juin prochain"
                        valeur={eur(r.picTresorerie)}
                      />
                    </dl>
                  </div>
                </div>

                <BoutonPartage lien={lienPartageAcomptes(h, DEFAUTS_ACOMPTES)} />
              </div>
            </div>
          </div>
        </section>

        {/* --------------------------------------------------- Échéancier */}
        <section className="border-y border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Votre échéancier
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
              Quatre acomptes trimestriels — et non des mensualités — puis le solde au
              15 mai. Chaque échéance appelle <strong>un quart</strong> de l'impôt de
              référence ; celle de mars fait exception, son quart étant calculé sur
              l'avant-dernier exercice faute de comptes approuvés, et l'écart est repris
              sur celle de juin.
            </p>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-500">
              Le graphique déborde sur l'année suivante&nbsp;: le solde du 15 mai tombe
              entre les deux premiers acomptes de l'année d'après, et celui du 15 juin
              rattrape d'un coup tout ce que l'exercice simulé n'a pas encore payé. Un
              bénéfice qui progresse se paie donc deux fois en un mois.
            </p>

            <div className="card mt-8 p-5 sm:p-8">
              <HistogrammeAcomptes r={r} />
            </div>

            <div className="card mt-6 overflow-x-auto p-1">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                    <th className="px-4 py-3 font-medium">Échéance</th>
                    <th className="px-4 py-3 text-right font-medium">Quart</th>
                    <th className="px-4 py-3 text-right font-medium">Régularisation</th>
                    <th className="px-4 py-3 text-right font-medium">Appelé</th>
                    <th className="px-4 py-3 text-right font-medium">Versé</th>
                  </tr>
                </thead>
                <tbody>
                  {r.echeances.map((e) => (
                    <tr key={e.rang} className="border-b border-ink-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-ink-800">
                        {e.date}
                        {e.passee && (
                          <span className="ml-2 rounded bg-ink-100 px-1.5 py-0.5 text-[11px] font-normal text-ink-500">
                            versé
                          </span>
                        )}
                      </td>
                      <td className="tabular px-4 py-3 text-right text-ink-500">
                        {eur(e.quart)}
                      </td>
                      <td
                        className={[
                          'tabular px-4 py-3 text-right',
                          Math.abs(e.regularisation) > 1
                            ? 'font-medium text-gold-600'
                            : 'text-ink-300',
                        ].join(' ')}
                      >
                        {Math.abs(e.regularisation) < 1
                          ? '—'
                          : e.regularisation > 0
                            ? `+ ${eur(e.regularisation)}`
                            : `− ${eur(-e.regularisation)}`}
                      </td>
                      <td className="tabular px-4 py-3 text-right font-medium text-ink-700">
                        {eur(e.parDefaut)}
                      </td>
                      <td
                        className={[
                          'tabular px-4 py-3 text-right font-semibold',
                          e.ajuste < e.parDefaut ? 'text-brand-700' : 'text-ink-900',
                        ].join(' ')}
                      >
                        {eur(e.ajuste)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-ink-50 font-semibold">
                    <td className="px-4 py-3 text-ink-900">Total</td>
                    <td className="tabular px-4 py-3 text-right text-ink-500">
                      {eur(r.isReference)}
                    </td>
                    <td />
                    <td className="tabular px-4 py-3 text-right text-ink-500">
                      {eur(r.totalParDefaut)}
                    </td>
                    <td className="tabular px-4 py-3 text-right text-ink-900">
                      {eur(r.totalAjuste)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-ink-800">
                      15 mai — {r.solde >= 0 ? 'solde' : 'restitution'}
                    </td>
                    <td />
                    <td />
                    <td />
                    <td className="tabular px-4 py-3 text-right font-semibold text-ink-900">
                      {r.solde >= 0 ? eur(r.solde) : `− ${eur(-r.solde)}`}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <Regles />
      </main>

      <Pied />
    </div>
  );
}

/**
 * The one thing worth saying about this simulation, chosen by what the reader
 * can still act on. Showing every applicable note at once buried the useful
 * one under four others.
 */
function Message({
  r,
  strategie,
}: {
  r: ResultatAcomptes;
  strategie: HypothesesAcomptes['strategie'];
}) {
  const encadre = (ton: 'neutre' | 'bon' | 'alerte', enfants: React.ReactNode) => (
    <div
      className={[
        'rounded-xl p-4 text-sm leading-relaxed',
        ton === 'bon'
          ? 'bg-brand-50 text-ink-700'
          : ton === 'alerte'
            ? 'border border-gold-300 bg-gold-100 text-ink-700'
            : 'bg-ink-50 text-ink-600',
      ].join(' ')}
    >
      {enfants}
    </div>
  );

  if (r.dispense) {
    return encadre(
      'bon',
      <>
        <strong className="font-semibold text-ink-900">
          Dispense — {r.motifDispense}.
        </strong>{' '}
        {r.motifDispense === 'premier exercice'
          ? "Aucun acompte durant le premier exercice : l'impôt se règle en une fois au solde."
          : `L'impôt de l'exercice de référence ne dépasse pas ${eur(SEUIL_DISPENSE)}, la dispense est automatique.`}
      </>,
    );
  }

  if (r.risqueMajoration) {
    return encadre(
      'alerte',
      <>
        <strong className="font-semibold text-ink-900">
          Vos versements couvrent tout juste l'impôt prévu.
        </strong>{' '}
        Si le bénéfice le dépasse, le manque est traité comme un retard :
        majoration de 5 % et intérêt de 0,20 % par mois, soit environ{' '}
        {eur(coutSousEstimation(1_000))} pour 1 000 € manquants.
      </>,
    );
  }

  if (r.excedentDejaVerse > 0) {
    return encadre(
      'neutre',
      <>
        <strong className="font-semibold text-ink-900">
          {eur(r.excedentDejaVerse)} déjà versés en trop.
        </strong>{' '}
        Un acompte payé ne se reprend pas : cet excédent ne revient qu'au solde.
        Seules les échéances à venir peuvent encore être réduites.
      </>,
    );
  }

  if (r.tresorerieAvancee > 0) {
    return encadre(
      'neutre',
      <>
        <strong className="font-semibold text-ink-900">
          {eur(r.tresorerieAvancee)} versés d'avance.
        </strong>{' '}
        Vous n'y êtes pas tenu : c'est un choix d'étalement, qui prête cette somme
        à l'État sans intérêt jusqu'au solde.
      </>,
    );
  }

  if (r.gainTresorerie > 0) {
    return encadre(
      'bon',
      <>
        <strong className="font-semibold text-ink-900">
          {eur(r.gainTresorerie)} conservés dans l'entreprise
        </strong>{' '}
        au lieu d'être avancés puis restitués.
      </>,
    );
  }

  if (r.isPrevisionnel > r.isReference) {
    return encadre(
      'neutre',
      <>
        <strong className="font-semibold text-ink-900">
          Rien à réduire : votre bénéfice dépasse la référence.
        </strong>{' '}
        Les acomptes restent calculés sur l'exercice passé, plus faible, et le
        complément partira au solde. « Lisser sur deux ans » permet de le payer
        d'avance plutôt que d'un bloc en mai.
      </>,
    );
  }

  return encadre(
    'neutre',
    strategie === 'appele'
      ? "Vous versez ce qui est appelé. Les autres stratégies montrent ce qu'il serait possible de garder ou d'étaler."
      : "Votre bénéfice prévisionnel est trop proche de la référence pour qu'un ajustement change quelque chose.",
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

const SOURCES = [
  {
    titre: 'Versement des acomptes',
    detail:
      "Quatre acomptes égaux au quart de l'impôt de l'exercice de référence, aux 15 mars, 15 juin, 15 septembre et 15 décembre pour une clôture au 31 décembre (CGI art. 1668, 1).",
    url: 'https://bofip.impots.gouv.fr/bofip/3558-PGP.html/identifiant=BOI-IS-DECLA-20-10-20200610',
    hote: 'bofip.impots.gouv.fr',
  },
  {
    titre: 'Premier acompte et régularisation',
    detail:
      "Au 15 mars les comptes de l'exercice précédent ne sont pas approuvés : le premier acompte est assis sur l'avant-dernier exercice, puis régularisé à l'échéance du deuxième (BOI-IS-DECLA-20-10 § 120).",
    url: 'https://bofip.impots.gouv.fr/bofip/3558-PGP.html/identifiant=BOI-IS-DECLA-20-10-20200610',
    hote: 'bofip.impots.gouv.fr',
  },
  {
    titre: 'Dispense de 3 000 €',
    detail:
      "Aucun acompte n'est dû lorsque l'impôt correspondant aux bénéfices de référence n'excède pas 3 000 €. La dispense est automatique (annexe III art. 359).",
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23575',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: 'Modulation sous sa responsabilité',
    detail:
      "L'entreprise qui estime que les acomptes déjà versés égalent ou dépassent l'impôt finalement dû peut se dispenser des versements suivants (CGI art. 1668, 4 bis).",
    url: 'https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048846063',
    hote: 'legifrance.gouv.fr',
  },
];

const HYPOTHESES = [
  "L'échéancier retenu est celui d'une clôture au 31 décembre. Pour une autre date de clôture, les acomptes tombent aux mêmes rangs mais à des mois différents, et le solde au 15 du quatrième mois suivant la clôture.",
  "Le coût d'une sous-estimation est un ordre de grandeur : la majoration de 5 % s'ajoute à un intérêt de 0,20 % par mois, compté ici sur une durée moyenne forfaitaire et non échéance par échéance.",
  "Les seuils quantitatifs de l'article 1731 A, qui encadrent le dernier acompte des très grandes entreprises, ne concernent pas une SASU et ne sont pas modélisés.",
  "Ni la contribution sociale sur les bénéfices, ni les crédits d'impôt imputables sur les acomptes ne sont pris en compte.",
];

function Regles() {
  return (
    <section id="sources" className="scroll-mt-20 bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Méthode et sources
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-300">
          Les règles appliquées ici, et où les vérifier.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <a
              key={s.titre}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/50 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-white">{s.titre}</h3>
                <span className="mt-0.5 shrink-0 text-ink-400 transition group-hover:text-brand-300">
                  ↗
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.detail}</p>
              <p className="mt-3 text-xs text-ink-400">{s.hote}</p>
            </a>
          ))}
        </div>

        <h3 className="mt-14 text-lg font-semibold text-white">Hypothèses et limites</h3>
        <ul className="mt-4 max-w-3xl space-y-3">
          {HYPOTHESES.map((x) => (
            <li key={x} className="flex gap-3 text-sm leading-relaxed text-ink-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
              {x}
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-300">
          Un chiffre vous paraît faux ?{' '}
          <a
            href={LIEN_ISSUES}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-brand-300 underline underline-offset-4 hover:text-brand-200"
          >
            Signalez-le
          </a>
          , avec la référence officielle qui le contredit.
        </p>
      </div>
    </section>
  );
}
