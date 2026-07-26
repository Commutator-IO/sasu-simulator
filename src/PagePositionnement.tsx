import { useEffect, useMemo, useState } from 'react';
import { Montant, Segments } from './components/Champs';
import { Entete, Pied } from './components/Cadre';
import { BoutonPartage } from './components/BoutonPartage';
import { BoutonReset } from './components/BoutonReset';
import { LienSignaler } from './components/LienSignaler';
import { EvolutionTjm, type SerieTemporelle } from './components/EvolutionTjm';
import { JaugeExperience } from './components/JaugeExperience';
import { eur } from './lib/format';
import {
  anneeDecimale,
  DERNIER,
  EVENEMENTS,
  META,
  moyenneVille,
  NIVEAUX,
  POINTS_VILLES,
  serieExperience,
  TAUX_COMMISSION_PLATEFORME,
  VILLES,
  type Lieu,
} from './lib/barometreTjm';
import {
  decoderPositionnement,
  encoderPositionnement,
  lienPartagePositionnement,
  DEFAUTS_POSITIONNEMENT,
  type EtatPositionnement,
} from './lib/urlPositionnement';
import { litStockage, sauvegarderRecherche } from './lib/persistance';
import { minifier, rechercheCourante } from './lib/compact';

const CLE = 'sasu:positionnement';

export default function PagePositionnement() {
  const [h, setH] = useState<EtatPositionnement>(() => {
    const saved = decoderPositionnement(litStockage(CLE), DEFAUTS_POSITIONNEMENT);
    return decoderPositionnement(rechercheCourante(), saved);
  });

  useEffect(() => {
    const requete = encoderPositionnement(h, DEFAUTS_POSITIONNEMENT);
    sauvegarderRecherche(CLE, requete);
    const t = setTimeout(() => {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${minifier(requete)}${window.location.hash}`,
      );
    }, 250);
    return () => clearTimeout(t);
  }, [h]);

  const niveau = NIVEAUX.find((n) => n.cle === h.niveau) ?? NIVEAUX[2];

  // The reference figures include the platform commission. If the entered rate
  // is quoted net of it, add it back so the comparison is on the same basis.
  const pourcentCommission = Math.round(TAUX_COMMISSION_PLATEFORME * 100);
  const tjmEffectif = h.commission
    ? Math.round(h.tjm * (1 + TAUX_COMMISSION_PLATEFORME))
    : h.tjm;

  // The seniority brackets are only known nationally, so for a city we shift them
  // by that city's level relative to France — the gauge then follows the city.
  const facteurVille = moyenneVille(h.ville) / moyenneVille('national');
  const niveauVille =
    h.ville === 'national'
      ? niveau
      : {
          ...niveau,
          bas: Math.round(niveau.bas * facteurVille),
          moyen: Math.round(niveau.moyen * facteurVille),
          haut: Math.round(niveau.haut * facteurVille),
        };

  // Two lines that respond to the two selectors: the chosen city (all
  // seniorities) and, nationally, the chosen seniority bracket.
  const series = useMemo<SerieTemporelle[]>(() => {
    const ville = h.ville === 'national' ? 'France' : h.ville;
    return [
      {
        label: `${ville} · tous niveaux`,
        couleur: 'var(--color-brand-600)',
        epais: true,
        points: POINTS_VILLES.map((p) => ({ annee: anneeDecimale(p.date), valeur: p[h.ville] })),
      },
      {
        label: `France · ${niveau.label}`,
        couleur: 'var(--color-ink-500)',
        epais: false,
        points: serieExperience(h.niveau),
      },
    ];
  }, [h.ville, h.niveau, niveau.label]);

  const lieux: (Lieu)[] = ['national', ...VILLES];

  return (
    <div className="min-h-screen">
      <Entete chemin="/tjm/" />

      <main>
        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Données de sources publiques
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Où se situe votre TJM de data&nbsp;?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              L'évolution du tarif journalier moyen des experts data dans le
              temps, ville par ville, et où votre propre tarif se place dans sa
              tranche d'expérience.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
          <div className="grid gap-6 lg:grid-cols-12">
            {/* --------------------------------------------------- Saisie */}
            <div className="lg:col-span-4">
              <div className="card p-6 sm:p-8 lg:sticky lg:top-24">
                <h2 className="text-lg font-semibold text-ink-900">Votre profil</h2>
                <div className="mt-6 grid gap-5">
                  <Montant
                    label="Votre TJM"
                    valeur={h.tjm}
                    onChange={(v) => setH((s) => ({ ...s, tjm: v }))}
                    suffixe="€ / jour"
                    hint="Le tarif journalier que vous affichez ou visez."
                  />
                  <Segments
                    label="Commission plateforme"
                    valeur={h.commission}
                    options={[
                      { valeur: false, label: 'Déjà incluse' },
                      { valeur: true, label: `À ajouter (+${pourcentCommission} %)` },
                    ]}
                    onChange={(v) => setH((s) => ({ ...s, commission: v }))}
                    hint={
                      h.commission
                        ? `Les repères incluent la commission. Votre TJM est comparé à ${eur(tjmEffectif)}.`
                        : `Les repères incluent la commission plateforme (~${pourcentCommission} %). Si votre tarif est hors commission, ajoutez-la.`
                    }
                  />
                  <div>
                    <p className="field-label">Votre expérience</p>
                    <div className="mt-1">
                      <Segments
                        valeur={h.niveau}
                        options={NIVEAUX.map((n) => ({ valeur: n.cle, label: n.label }))}
                        onChange={(v) => setH((s) => ({ ...s, niveau: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="field-label">Ville de référence</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {lieux.map((l) => (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={h.ville === l}
                          onClick={() => setH((s) => ({ ...s, ville: l }))}
                          className={[
                            'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                            h.ville === l
                              ? 'border-brand-500 bg-brand-50 text-brand-700'
                              : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-800',
                          ].join(' ')}
                        >
                          {l === 'national' ? 'France' : l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <dl className="mt-6 space-y-3 border-t border-ink-100 pt-5">
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-ink-500">
                      Moyenne {h.ville === 'national' ? 'France' : h.ville} ({DERNIER.date.slice(0, 4)})
                    </dt>
                    <dd className="tabular text-sm font-semibold text-ink-900">
                      {eur(moyenneVille(h.ville))}
                    </dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-4">
                    <dt className="text-sm text-ink-500">Moyenne de votre tranche</dt>
                    <dd className="tabular text-sm font-semibold text-ink-900">
                      {eur(niveau.moyen)}
                    </dd>
                  </div>
                </dl>

                <BoutonPartage lien={lienPartagePositionnement(h, DEFAUTS_POSITIONNEMENT)} />
                <BoutonReset onReset={() => setH(DEFAUTS_POSITIONNEMENT)} />
              </div>
            </div>

            {/* -------------------------------------------------- Visuels */}
            <div className="lg:col-span-8">
              <div className="card p-5 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  L'évolution du TJM {h.ville === 'national' ? 'en France' : `à ${h.ville}`}
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Tarif jour moyen des experts data. Trait vert&nbsp;: le marché de
                  la ville choisie, tous niveaux. Trait gris&nbsp;: la moyenne France
                  de votre tranche d'expérience. Votre TJM en trait horizontal.
                </p>
                <div className="mt-5">
                  <EvolutionTjm series={series} evenements={EVENEMENTS} tjmUtilisateur={tjmEffectif} />
                </div>
              </div>

              <div className="card mt-6 p-5 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  Votre position dans la tranche {niveau.label}
                  {h.ville !== 'national' && ` à ${h.ville}`}
                </h2>
                {h.ville !== 'national' && (
                  <p className="mt-1 text-sm text-ink-500">
                    Repères de la tranche ajustés au niveau {h.ville}, soit{' '}
                    {facteurVille >= 1 ? '+' : ''}
                    {Math.round((facteurVille - 1) * 100)}&nbsp;% par rapport à la France.
                  </p>
                )}
                <div className="mt-5">
                  <JaugeExperience tjm={tjmEffectif} niveau={niveauVille} />
                </div>
              </div>
            </div>
          </div>
        </section>

        <Regles />
      </main>

      <Pied />
    </div>
  );
}

function Regles() {
  return (
    <section id="sources" className="scroll-mt-20 bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Méthode et sources
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-300">
          Comment ces chiffres sont réunis, et ce qu'ils valent.
        </p>
        <ul className="mt-8 max-w-3xl space-y-3">
          {META.notes.map((n) => (
            <li key={n} className="flex gap-3 text-sm leading-relaxed text-ink-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
              {n}
            </li>
          ))}
        </ul>

        <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-300">
          Un chiffre vous paraît faux&nbsp;?{' '}
          <LienSignaler className="font-medium text-brand-300 underline underline-offset-4 hover:text-brand-200">
            Signalez-le
          </LienSignaler>
          .
        </p>
      </div>
    </section>
  );
}
