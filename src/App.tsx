import { useEffect, useMemo, useState } from 'react';
import { Curseur, Montant, Segments } from './components/Champs';
import { Courbe } from './components/Courbe';
import { Cascade } from './components/Cascade';
import { Detail } from './components/Detail';
import { Sources } from './components/Sources';
import { eur, pct } from './lib/format';
import { balayer, brutMaxPourBudget, simuler, type Hypotheses } from './lib/simulation';
import * as P from './lib/parametres2026';

const DEFAUTS: Omit<Hypotheses, 'brutAnnuel'> = {
  resultatAvantRemuneration: P.RESULTAT_PAR_DEFAUT,
  tauxDistribution: 1,
  parts: 1,
  couple: false,
  autresRevenus: 0,
  salaireExterneBrut: 0,
  moisRemuneration: 12,
  tauxATMP: P.AT_MP_DEFAUT,
  eligibleISReduit: true,
  dividendesAuBareme: false,
};

export default function App() {
  const [base, setBase] = useState(DEFAUTS);
  const [brut, setBrut] = useState(45_000);
  const [avanceOuvert, setAvanceOuvert] = useState(false);

  const brutMax = useMemo(
    () =>
      brutMaxPourBudget(
        base.resultatAvantRemuneration,
        base.tauxATMP,
        base.moisRemuneration,
      ),
    [base.resultatAvantRemuneration, base.tauxATMP, base.moisRemuneration],
  );
  const brutMaxArrondi = Math.max(1000, Math.floor(brutMax / 500) * 500);

  // La rémunération ne peut pas dépasser ce que la société peut financer.
  useEffect(() => {
    setBrut((b) => Math.min(b, brutMaxArrondi));
  }, [brutMaxArrondi]);

  const r = useMemo(() => simuler({ ...base, brutAnnuel: brut }), [base, brut]);
  const { points, optimum, plateau } = useMemo(() => balayer(base), [base]);

  const ecart = optimum.netEnPoche - r.netEnPoche;
  // La courbe est plate à son sommet : tout un intervalle de rémunérations
  // revient au même à quelques euros près. Le dire vaut mieux que de désigner
  // un point unique.
  const estOptimal = ecart <= plateau.tolerance;

  const maj = <K extends keyof typeof base>(cle: K, valeur: (typeof base)[K]) =>
    setBase((b) => ({ ...b, [cle]: valeur }));

  const reperes = [
    { valeur: 0, label: '0 €' },
    {
      valeur: Math.round((P.SMIC_MENSUEL * base.moisRemuneration) / 500) * 500,
      label: 'Smic',
    },
    {
      valeur: Math.round(r.plafondTranche1 / 500) * 500,
      // Le plafond proratisé n'est un Pass entier que sur douze mois.
      label: base.moisRemuneration >= 12 ? '1 Pass' : 'Plafond T1',
    },
  ].filter((x) => x.valeur > 0 && x.valeur <= brutMaxArrondi);

  return (
    <div className="min-h-screen">
      <Entete />

      <main>
        {/* ---------------------------------------------------------- Hero */}
        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Barèmes {P.ANNEE} à jour
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Salaire ou dividendes&nbsp;? Trouvez le bon dosage pour votre SASU.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Déplacez le curseur de rémunération et voyez en direct ce qui vous reste
              réellement, une fois payés les cotisations sociales, l'impôt sur les
              sociétés et l'impôt sur le revenu.
            </p>
          </div>
        </section>

        {/* --------------------------------------------- Paramètres + résultat */}
        <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <div className="card p-6 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">Votre situation</h2>

                <div className="mt-6">
                  <Montant
                    label="Résultat avant votre rémunération"
                    valeur={base.resultatAvantRemuneration}
                    onChange={(v) => maj('resultatAvantRemuneration', v)}
                    hint={`Chiffre d'affaires encaissé moins toutes vos charges, avant de vous verser quoi que ce soit. Soit ${eur(
                      P.tjmEquivalent(base.resultatAvantRemuneration),
                    )} de TJM sur ${P.JOURS_FACTURES_MALT} jours facturés — la moyenne tech du baromètre Malt est de ${eur(
                      P.TJM_MOYEN_MALT,
                    )}.`}
                  />
                </div>

                <div className="mt-8 rounded-2xl bg-ink-50 p-5 sm:p-6">
                  <Curseur
                    label="Rémunération brute annuelle"
                    valeur={brut}
                    min={0}
                    max={brutMaxArrondi}
                    pas={500}
                    onChange={setBrut}
                    rendu={eur}
                    reperes={reperes}
                  />
                  <div className="mt-2 grid gap-4 border-t border-ink-200 pt-4 sm:grid-cols-2">
                    <Montant
                      label="Mois de mandat dans l'année"
                      valeur={base.moisRemuneration}
                      onChange={(v) => maj('moisRemuneration', Math.min(12, Math.max(1, v)))}
                      suffixe="mois"
                      min={1}
                      max={12}
                      hint="12 pour une année pleine. Réduisez seulement si la société a été créée en cours d'année : c'est la durée du mandat qui proratise le plafond, pas le rythme auquel vous vous versez la rémunération."
                    />
                    <p className="self-center text-xs leading-relaxed text-ink-500">
                      {base.moisRemuneration >= 12 ? (
                        <>
                          Les cotisations plafonnées s'arrêtent à un Pass entier, soit{' '}
                          {eur(P.PASS)} de rémunération. Un président en poste toute
                          l'année conserve ce plafond même s'il se rémunère
                          irrégulièrement.
                        </>
                      ) : (
                        <>
                          Le plafond est proratisé : sur {base.moisRemuneration} mois, la
                          tranche 1 s'arrête à{' '}
                          <strong className="font-semibold text-ink-800">
                            {eur(r.plafondTranche1)}
                          </strong>{' '}
                          au lieu de {eur(P.PASS)}. La part au-delà bascule en tranche 2,
                          qui rapporte davantage de points de retraite pour un coût
                          employeur quasi inchangé.
                        </>
                      )}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-4 gap-3 border-t border-ink-200 pt-4 text-center">
                    <Mini
                      label="Brut par paie"
                      valeur={eur(brut / base.moisRemuneration)}
                    />
                    <Mini label="Coût employeur" valeur={eur(r.coutEmployeur)} />
                    <Mini
                      label="Net par paie"
                      valeur={eur(r.salaireNet / base.moisRemuneration)}
                    />
                    <Mini
                      label="Net après PAS"
                      valeur={eur(
                        r.salaireNet / base.moisRemuneration - r.prelevementMensuelPAS,
                      )}
                    />
                  </div>
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Segments
                    label="Situation du foyer fiscal"
                    valeur={base.couple}
                    options={[
                      { valeur: false, label: 'Célibataire' },
                      { valeur: true, label: 'Couple' },
                    ]}
                    onChange={(v) =>
                      setBase((b) => ({
                        ...b,
                        couple: v,
                        parts: v ? Math.max(2, b.parts + 1) : Math.max(1, b.parts - 1),
                      }))
                    }
                  />
                  <Montant
                    label="Parts fiscales"
                    valeur={base.parts * 2}
                    onChange={(v) =>
                      maj('parts', Math.max(base.couple ? 2 : 1, Math.min(10, v / 2)))
                    }
                    suffixe="demi-parts"
                    hint={`Soit ${base.parts.toLocaleString('fr-FR')} part${base.parts > 1 ? 's' : ''} — 2 demi-parts par adulte, 1 par enfant.`}
                  />
                </div>

                <div className="mt-6 grid gap-5 sm:grid-cols-2">
                  <Montant
                    label="Salaire brut perçu ailleurs"
                    valeur={base.salaireExterneBrut}
                    onChange={(v) => maj('salaireExterneBrut', v)}
                    hint="Un emploi salarié mené en parallèle, à temps partiel ou non. Laissez à 0 si la SASU est votre seule activité."
                  />
                  <Montant
                    label="Autres revenus imposables du foyer"
                    valeur={base.autresRevenus}
                    onChange={(v) => maj('autresRevenus', v)}
                    hint="Salaire du conjoint, revenus fonciers… en net imposable, hors votre propre salaire."
                  />
                </div>

                {base.salaireExterneBrut > 0 && (
                  <p className="mt-3 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-ink-600">
                    Votre emploi extérieur vous rapporte{' '}
                    <strong className="font-semibold text-ink-900">
                      {eur(r.salaireExterneNet)}
                    </strong>{' '}
                    net avant impôt et valide déjà{' '}
                    <strong className="font-semibold text-ink-900">
                      {r.trimestresExterne} trimestre{r.trimestresExterne > 1 ? 's' : ''}
                    </strong>{' '}
                    sur 4. Il occupe le bas du barème : chaque euro de rémunération versé
                    par la SASU est donc imposé plus haut.
                  </p>
                )}

                <div className="mt-6">
                  <Segments
                    label="Imposition de vos dividendes"
                    valeur={base.dividendesAuBareme}
                    options={[
                      { valeur: false, label: `Flat tax ${pct(P.PFU_TOTAL, 1)}` },
                      { valeur: true, label: 'Barème progressif' },
                    ]}
                    onChange={(v) => maj('dividendesAuBareme', v)}
                    hint={
                      base.dividendesAuBareme
                        ? "Abattement de 40 % avant barème, mais l'option vaut pour tous vos revenus de capitaux mobiliers de l'année."
                        : `Prélèvement forfaitaire unique : ${pct(P.PFU_IR, 1)} d’impôt sur le revenu et ${pct(P.PRELEVEMENTS_SOCIAUX, 1)} de prélèvements sociaux, portés de 17,2 % à ${pct(P.PRELEVEMENTS_SOCIAUX, 1)} au 1ᵉʳ janvier 2026.`
                    }
                  />
                </div>

                <button
                  type="button"
                  onClick={() => setAvanceOuvert((v) => !v)}
                  className="mt-7 text-sm font-medium text-brand-600 transition hover:text-brand-700"
                >
                  {avanceOuvert ? '− Masquer' : '+ Afficher'} les hypothèses avancées
                </button>

                {avanceOuvert && (
                  <div className="mt-5 grid gap-5 border-t border-ink-200 pt-6 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <Curseur
                        label="Part du résultat net distribuée en dividendes"
                        valeur={Math.round(base.tauxDistribution * 100)}
                        min={0}
                        max={100}
                        pas={5}
                        onChange={(v) => maj('tauxDistribution', v / 100)}
                        rendu={(v) => `${v} %`}
                        hint="Le reste est mis en réserve : non imposé chez vous cette année, mais indisponible."
                      />
                    </div>
                    <Montant
                      label="Taux accidents du travail"
                      valeur={base.tauxATMP}
                      onChange={(v) => maj('tauxATMP', v)}
                      suffixe="%"
                      max={20}
                      decimales={2}
                      hint={`Notifié par la Carsat. ${P.AT_MP_DEFAUT.toLocaleString('fr-FR')} % par défaut pour une activité de bureau.`}
                    />
                    <div className="sm:col-span-2">
                      <Segments
                        label="Taux réduit d'impôt sur les sociétés"
                        valeur={base.eligibleISReduit}
                        options={[
                          { valeur: true, label: 'Éligible' },
                          { valeur: false, label: 'Non éligible' },
                        ]}
                        onChange={(v) => maj('eligibleISReduit', v)}
                        hint="15 % jusqu'à 42 500 € de bénéfice si le chiffre d'affaires est inférieur à 10 M€, le capital entièrement libéré et détenu à 75 % au moins par des personnes physiques."
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="lg:col-span-5">
              <div className="lg:sticky lg:top-24">
                <div className="card overflow-hidden">
                  <div className="bg-brand-700 px-6 py-7 text-white sm:px-8">
                    <p className="text-sm text-brand-100">
                      Ce qu'il vous reste, net d'impôts
                    </p>
                    <p className="tabular mt-1 text-4xl font-semibold tracking-tight sm:text-5xl">
                      {eur(r.netEnPoche)}
                    </p>
                    <p className="mt-1.5 text-sm text-brand-100">
                      soit {eur(r.netEnPoche / 12)} par mois
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-brand-600">
                      <div className="bg-brand-700 px-4 py-3">
                        <p className="text-xs text-brand-200">Salaire net après impôt</p>
                        <p className="tabular mt-0.5 font-semibold">
                          {eur(r.salaireNet - r.irSurSalaire)}
                        </p>
                      </div>
                      <div className="bg-brand-700 px-4 py-3">
                        <p className="text-xs text-brand-200">Dividendes nets</p>
                        <p className="tabular mt-0.5 font-semibold">
                          {eur(r.dividendesNets)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-6 sm:px-8">
                    {estOptimal ? (
                      <div className="rounded-xl bg-brand-50 p-4">
                        <div className="flex items-start gap-3">
                          <span className="mt-px font-semibold text-brand-600">✓</span>
                          <p className="text-sm leading-relaxed text-ink-700">
                            <span className="font-semibold text-ink-900">
                              Vous êtes dans la zone optimale.
                            </span>{' '}
                            {ecart < 1
                              ? 'Vous êtes au point le plus haut de la courbe.'
                              : `Il vous manque ${eur(ecart)} sur l'année par rapport au meilleur point.`}
                          </p>
                        </div>
                        <p className="mt-3 border-t border-brand-200/70 pt-3 text-xs leading-relaxed text-ink-600">
                          La courbe est plate à son sommet : toute rémunération brute
                          entre{' '}
                          <strong className="font-semibold text-ink-900">
                            {eur(plateau.min)}
                          </strong>{' '}
                          et{' '}
                          <strong className="font-semibold text-ink-900">
                            {eur(plateau.max)}
                          </strong>{' '}
                          vous laisse à moins de {eur(plateau.tolerance)} de l'optimum.
                          Dans cet intervalle, le choix se joue sur vos droits sociaux et
                          votre trésorerie, plus sur la fiscalité.
                        </p>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          setBrut(
                            Math.min(
                              brutMaxArrondi,
                              Math.round(optimum.brutAnnuel / 500) * 500,
                            ),
                          )
                        }
                        className="w-full rounded-xl bg-gold-100 p-4 text-left transition hover:bg-gold-300/40"
                      >
                        <p className="text-sm leading-relaxed text-ink-700">
                          <span className="font-semibold text-ink-900">
                            +{eur(ecart)} à récupérer.
                          </span>{' '}
                          Une rémunération brute de {eur(optimum.brutAnnuel)} vous
                          laisserait {eur(optimum.netEnPoche)}.
                        </p>
                        <span className="mt-2 inline-block text-sm font-semibold text-gold-600">
                          Appliquer cette rémunération →
                        </span>
                      </button>
                    )}

                    <dl className="mt-6 space-y-3">
                      <Stat
                        label="Prélèvements totaux"
                        valeur={eur(r.totalPrelevements)}
                        annexe={pct(r.tauxPrelevementGlobal, 1)}
                      />
                      <Stat
                        label="Taux de prélèvement à la source"
                        valeur={pct(r.tauxPAS, 1)}
                        annexe={`${eur(r.prelevementMensuelPAS)} / mois`}
                      />
                      <Stat label="Tranche marginale d'imposition" valeur={pct(r.tmi, 0)} />
                      <Stat
                        label="Trimestres de retraite validés"
                        valeur={`${r.trimestresValides} / 4`}
                      />
                      {r.reserves > 0.5 && (
                        <Stat label="Laissé en réserve" valeur={eur(r.reserves)} />
                      )}
                    </dl>
                  </div>
                </div>

                <p className="mt-4 px-2 text-xs leading-relaxed text-ink-400">
                  Simulation indicative, hors CFE, mutuelle et prévoyance. Elle ne
                  remplace pas l'avis de votre expert-comptable.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Courbe */}
        <section className="border-y border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              La courbe de votre net en poche
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
              Chaque euro de salaire supplémentaire coûte des cotisations, mais réduit
              d'autant le bénéfice imposé à l'IS puis à la flat tax. L'optimum se situe là
              où ces deux forces s'équilibrent.
            </p>
            <div className="card mt-8 p-5 sm:p-8">
              <Courbe
                points={points}
                brutCourant={brut}
                brutOptimal={optimum.brutAnnuel}
                plateau={plateau}
                onScrub={(b) =>
                  setBrut(Math.min(brutMaxArrondi, Math.round(b / 500) * 500))
                }
              />
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------- Cascade */}
        <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Où partent vos {eur(base.resultatAvantRemuneration)} ?
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
            Répartition du résultat de votre société entre ce que vous encaissez et ce que
            vous reversez.
          </p>
          <div className="card mt-8 p-6 sm:p-8">
            <Cascade r={r} />
          </div>
        </section>

        {/* -------------------------------------------------------- Détail */}
        <section className="border-t border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="mb-8 text-2xl font-semibold tracking-tight text-ink-900">
              Le détail du calcul
            </h2>
            <Detail r={r} />
          </div>
        </section>

        <Sources />
      </main>

      <Pied />

      {/* Sur mobile, le panneau de résultat est loin sous le curseur : on garde
          l'essentiel visible en permanence. */}
      <div className="sticky bottom-0 z-20 border-t border-ink-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4 px-5 py-3">
          <div>
            <p className="text-xs text-ink-400">Net en poche</p>
            <p className="tabular text-xl font-semibold text-ink-900">
              {eur(r.netEnPoche)}
            </p>
          </div>
          {estOptimal ? (
            <span className="rounded-full bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700">
              ✓ Zone optimale
            </span>
          ) : (
            <button
              type="button"
              onClick={() =>
                setBrut(
                  Math.min(brutMaxArrondi, Math.round(optimum.brutAnnuel / 500) * 500),
                )
              }
              className="rounded-full bg-gold-100 px-3.5 py-2 text-xs font-semibold text-gold-600"
            >
              +{eur(ecart)} possible →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Mini({ label, valeur }: { label: string; valeur: string }) {
  return (
    <div>
      <p className="text-xs text-ink-400">{label}</p>
      <p className="tabular mt-0.5 text-sm font-semibold text-ink-800">{valeur}</p>
    </div>
  );
}

function Stat({
  label,
  valeur,
  annexe,
}: {
  label: string;
  valeur: string;
  annexe?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-ink-100 pb-3 last:border-0 last:pb-0">
      <dt className="text-sm text-ink-500">{label}</dt>
      <dd className="tabular shrink-0 text-sm font-semibold text-ink-900">
        {valeur}
        {annexe && <span className="ml-1.5 font-normal text-ink-400">{annexe}</span>}
      </dd>
    </div>
  );
}

function Entete() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-200/70 bg-white/85 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <a href="#" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            S
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink-900">
            SASU <span className="text-brand-600">simulator</span>
          </span>
        </a>
        <nav className="flex items-center gap-6 text-sm text-ink-500">
          <a href="#sources" className="transition hover:text-ink-900">
            Méthode et sources
          </a>
        </nav>
      </div>
    </header>
  );
}

function Pied() {
  return (
    <footer className="border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-10 text-sm text-ink-400">
        <p>
          Simulateur d'optimisation salaire / dividendes pour SASU — barèmes {P.ANNEE}.
        </p>
        <p className="mt-2 max-w-3xl leading-relaxed">
          Outil informatif. Les montants affichés sont des estimations : ils ne tiennent
          pas compte de votre situation complète, des crédits et réductions d'impôt, ni
          des spécificités de votre contrat de prévoyance.
        </p>
      </div>
    </footer>
  );
}
