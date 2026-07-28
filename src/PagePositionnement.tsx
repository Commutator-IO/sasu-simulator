import { useEffect, useMemo, useState } from 'react';
import { Segments } from './components/Champs';
import { Entete, Pied } from './components/Cadre';
import { BoutonPartage } from './components/BoutonPartage';
import { BoutonReset } from './components/BoutonReset';
import { LienSignaler } from './components/LienSignaler';
import { EvolutionTjm, type SerieTemporelle } from './components/EvolutionTjm';
import { JaugeExperience } from './components/JaugeExperience';
import { eur } from './lib/format';
import { ClassementMetiers } from './components/ClassementMetiers';
import { TarifsPlateformes } from './components/TarifsPlateformes';
import { SeuilRentabilite } from './components/SeuilRentabilite';
import { DecompositionTjm } from './components/DecompositionTjm';
import { DEFAUTS_ARBITRAGE } from './lib/arbitrage';
import { decomposerTjm, netEnPocheSalaire, seuilRentabilite } from './lib/rentabilite';
import {
  anneeDecimale,
  EVENEMENTS,
  finDesMesures,
  getProfession,
  META,
  moyenneVille,
  PROFESSIONS,
  REFERENCES,
  VERIFIE_LE,
  serieVille,
  villesCommunes,
  type NiveauExperience,
} from './lib/barometreTjm';
import {
  decoderPositionnement,
  encoderPositionnement,
  lienPartagePositionnement,
  DEFAUTS_POSITIONNEMENT,
  type EtatPositionnement,
} from './lib/urlPositionnement';
import { litStockage, sauvegarderRecherche, CLE_POSITIONNEMENT } from './lib/persistance';
import { minifier, rechercheCourante } from './lib/compact';

export default function PagePositionnement() {
  const [h, setH] = useState<EtatPositionnement>(() => {
    const saved = decoderPositionnement(litStockage(CLE_POSITIONNEMENT), DEFAUTS_POSITIONNEMENT);
    return decoderPositionnement(rechercheCourante(), saved);
  });

  useEffect(() => {
    const requete = encoderPositionnement(h, DEFAUTS_POSITIONNEMENT);
    sauvegarderRecherche(CLE_POSITIONNEMENT, requete);
    const t = setTimeout(() => {
      window.history.replaceState(
        null,
        '',
        `${window.location.pathname}${minifier(requete)}${window.location.hash}`,
      );
    }, 250);
    return () => clearTimeout(t);
  }, [h]);

  // Drop unknown or repeated keys — a stale saved link would otherwise fall back
  // to the first profession and draw it twice.
  const clesValides = [...new Set(h.professions)].filter((c) =>
    PROFESSIONS.some((p) => p.cle === c),
  );
  const profs = (clesValides.length ? clesValides : [PROFESSIONS[0].cle]).map(getProfession);
  const villes = villesCommunes(profs);
  const ville = villes.includes(h.ville) ? h.ville : 'national';

  // Shared seniority brackets — every profession uses the same keys/labels.
  const brackets = PROFESSIONS[0].experience;

  // Barometer rates are the invoiced price, before any platform fee — the rate
  // entered here is on the same basis, so it is compared as is.
  const tjmEffectif = Math.round(h.tjm);

  const basculerProfession = (cle: string) =>
    setH((s) => {
      const dedans = s.professions.includes(cle);
      if (dedans && s.professions.length === 1) return s; // keep at least one
      const professions = dedans
        ? s.professions.filter((c) => c !== cle)
        : [...s.professions, cle];
      return { ...s, professions };
    });

  // One market line per selected profession (for the chosen city), plus the
  // user's own path if they filled in 2024/2025.
  const series = useMemo<SerieTemporelle[]>(() => {
    const marche: SerieTemporelle[] = profs.map((p) => {
      // The published average is that of the 8-15 bracket, so a curve at another
      // seniority is that same curve scaled by the brackets' ratio.
      const niv = p.experience.find((n) => n.cle === h.niveau) ?? p.experience[2];
      const ref = p.experience.find((n) => n.cle === '8-15') ?? p.experience[2];
      const ratio = ref.moyen ? niv.moyen / ref.moyen : 1;
      return {
        label: `${p.libelle} · ${niv.label}`,
        couleur: p.couleur,
        epais: true,
        // The whole point scales, bounds included: otherwise a projection's
        // band would stay at the 8-15 level while its line moves.
        points: serieVille(p, ville).map((pt) => ({
          ...pt,
          valeur: Math.round(pt.valeur * ratio),
          ...(pt.bas !== undefined ? { bas: Math.round(pt.bas * ratio) } : {}),
          ...(pt.haut !== undefined ? { haut: Math.round(pt.haut * ratio) } : {}),
        })),
      };
    });
    const pts = [
      h.tjm2024 > 0
        ? { annee: anneeDecimale('2024-07'), date: '2024-07', valeur: Math.round(h.tjm2024) }
        : null,
      h.tjm2025 > 0
        ? { annee: anneeDecimale('2025-07'), date: '2025-07', valeur: Math.round(h.tjm2025) }
        : null,
      { annee: anneeDecimale('2026-07'), date: '2026-07', valeur: tjmEffectif },
      // A target for next year extends the line into the projected zone.
      h.tjm2027 > 0
        ? {
            annee: anneeDecimale('2027-07'),
            date: '2027-07',
            valeur: Math.round(h.tjm2027),
            projete: true,
          }
        : null,
    ].filter(
      (p): p is { annee: number; date: string; valeur: number; projete?: boolean } => p !== null,
    );
    if (pts.length > 1) {
      marche.push({ label: 'Votre TJM', couleur: 'var(--color-ink-800)', epais: true, points: pts });
    }
    return marche;
  }, [profs, ville, h.niveau, h.tjm2024, h.tjm2025, h.tjm2027, tjmEffectif]);

  const trajectoire = h.tjm2024 > 0 || h.tjm2025 > 0 || h.tjm2027 > 0;

  // Computed here rather than inside the card, so the chart can draw the same
  // break-even line without solving it a second time.
  const { netCible, seuil, netPlein } = useMemo(() => {
    const n =
      h.cibleMode === 'cdi' ? netEnPocheSalaire(h.cible, DEFAUTS_ARBITRAGE) : h.cible;
    return {
      netCible: n,
      seuil: seuilRentabilite(n, DEFAUTS_ARBITRAGE, { jours: h.jours, tjm: tjmEffectif }),
      // What the same rate yields once every planned day is billed — the
      // threshold says what is needed, this says what is on the table.
      netPlein:
        decomposerTjm(tjmEffectif, 0, DEFAUTS_ARBITRAGE, { jours: h.jours }).net * h.jours,
    };
  }, [h.cibleMode, h.cible, h.jours, tjmEffectif]);

  // Where the market is projected to be next year, for the leading profession,
  // so a target can be read against it rather than in the abstract.
  const marche2027 = (() => {
    const p = profs[0];
    const niv = p.experience.find((n) => n.cle === h.niveau) ?? p.experience[2];
    const ref = p.experience.find((n) => n.cle === '8-15') ?? p.experience[2];
    const ratio = ref.moyen ? niv.moyen / ref.moyen : 1;
    const pt = p.villes.find((x) => x.date === '2027-07');
    return pt ? Math.round((pt[ville] as number) * ratio) : null;
  })();

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
              Votre TJM vaut-il ce qu'il devrait&nbsp;?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Trois questions, une page&nbsp;: où se situe votre tarif face au
              marché, quel chiffre d'affaires il vous faut pour en vivre, et ce
              qu'il en reste vraiment une fois l'intermédiaire, les cotisations et
              l'impôt passés.
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
                  <div>
                    <p className="field-label">Métiers à comparer</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {PROFESSIONS.map((p) => {
                        const actif = h.professions.includes(p.cle);
                        return (
                          <button
                            key={p.cle}
                            type="button"
                            aria-pressed={actif}
                            title={p.libelle}
                            onClick={() => basculerProfession(p.cle)}
                            className={[
                              'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium transition',
                              actif
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-800',
                            ].join(' ')}
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{ backgroundColor: p.couleur }}
                            />
                            {p.court ?? p.libelle}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  {/* Four rates on one row: the past two and the target read as
                      a trajectory, and the block costs a quarter of the height. */}
                  <div>
                    <p className="field-label">Votre TJM, année par année</p>
                    <div className="mt-1 grid grid-cols-4 gap-1.5">
                      {(
                        [
                          ['2024', h.tjm2024, (v: number) => ({ tjm2024: v })],
                          ['2025', h.tjm2025, (v: number) => ({ tjm2025: v })],
                          ['2026', h.tjm, (v: number) => ({ tjm: v })],
                          ['2027', h.tjm2027, (v: number) => ({ tjm2027: v })],
                        ] as const
                      ).map(([an, valeur, maj]) => (
                        <label key={an} className="block">
                          <span
                            className={[
                              'block text-center text-[11px] font-medium',
                              an === '2026' ? 'text-ink-800' : 'text-ink-400',
                            ].join(' ')}
                          >
                            {an}
                            {an === '2027' ? ' visé' : ''}
                          </span>
                          <input
                            type="number"
                            inputMode="numeric"
                            value={valeur || ''}
                            placeholder="—"
                            onChange={(e) => setH((s) => ({ ...s, ...maj(Number(e.target.value)) }))}
                            className={[
                              'tabular mt-0.5 w-full rounded-lg border bg-white px-1.5 py-1.5 text-center text-sm',
                              'focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100',
                              an === '2026'
                                ? 'border-ink-300 font-semibold text-ink-900'
                                : 'border-ink-200 text-ink-700',
                            ].join(' ')}
                          />
                        </label>
                      ))}
                    </div>
                    <p className="field-hint">
                      {h.tjm2027 > 0 && marche2027
                        ? `2027 visé : ${eur(Math.abs(h.tjm2027 - marche2027))} ${
                            h.tjm2027 >= marche2027 ? 'au-dessus' : 'en dessous'
                          } du marché projeté (${eur(marche2027)}).`
                        : marche2027
                          ? `2026 est votre tarif actuel. Marché projeté en 2027 : ${eur(marche2027)}.`
                          : '2026 est votre tarif actuel ; les autres années sont optionnelles.'}
                    </p>
                  </div>
                  <div>
                    <p className="field-label">Votre expérience</p>
                    <div className="mt-1">
                      <Segments
                        valeur={h.niveau}
                        options={brackets.map((n) => ({ valeur: n.cle, label: n.label }))}
                        onChange={(v) => setH((s) => ({ ...s, niveau: v }))}
                      />
                    </div>
                  </div>
                  <div>
                    <p className="field-label">Ville de référence</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {villes.map((l) => (
                        <button
                          key={l}
                          type="button"
                          aria-pressed={ville === l}
                          onClick={() => setH((s) => ({ ...s, ville: l }))}
                          className={[
                            'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                            ville === l
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

                <BoutonPartage lien={lienPartagePositionnement(h, DEFAUTS_POSITIONNEMENT)} />
                <BoutonReset onReset={() => setH(DEFAUTS_POSITIONNEMENT)} />
              </div>
            </div>

            {/* -------------------------------------------------- Visuels */}
            <div className="lg:col-span-8">
              <div className="card p-5 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  Évolution du TJM {ville === 'national' ? 'en France' : `à ${ville}`}
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Une courbe par métier, au niveau d'expérience choisi&nbsp;: le
                  tarif publié est celui des 8-15&nbsp;ans, les autres tranches sont
                  déduites au prorata.{' '}
                  {trajectoire
                    ? 'Votre trajectoire (2024 → 2026) en trait sombre.'
                    : 'Votre TJM en trait horizontal.'}{' '}
                  {!seuil.horsAtteinte && 'Le trait doré marque le seuil sous lequel votre objectif n’est plus atteint.'}
                </p>
                {VERIFIE_LE && (
                  <p className="field-hint mt-1">
                    Dernier relevé à la source&nbsp;: {VERIFIE_LE}.
                  </p>
                )}
                <div className="mt-5">
                  <EvolutionTjm
                    series={series}
                    evenements={EVENEMENTS}
                    tjmUtilisateur={trajectoire ? undefined : tjmEffectif}
                    tjmSeuil={seuil.horsAtteinte ? undefined : seuil.tjmNecessaire}
                    finMesures={finDesMesures(profs)}
                  />
                </div>
              </div>

              <div className="card mt-6 p-5 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  Tous les métiers {ville === 'national' ? 'en France' : `à ${ville}`}
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Dernier tarif mesuré, et son évolution depuis 2023 — l'année où la
                  plupart des courbes culminent. Cliquez pour ajouter un métier au
                  graphique.
                </p>
                <div className="mt-5">
                  <ClassementMetiers
                    lieu={ville}
                    selection={h.professions}
                    onChoisir={basculerProfession}
                  />
                </div>
              </div>

              <div className="card mt-6 p-5 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  À partir de quel chiffre d'affaires vivez-vous de votre SASU&nbsp;?
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Fixez ce que vous voulez gagner — un net en poche, ou le salaire
                  CDI que vous voulez égaler — et voyez le chiffre d'affaires, le
                  TJM et le nombre de jours qu'il faut pour y arriver.
                </p>
                <div className="mt-5">
                  <SeuilRentabilite
                    mode={h.cibleMode}
                    cible={h.cible}
                    jours={h.jours}
                    tjm={tjmEffectif}
                    net={netCible}
                    seuil={seuil}
                    netPlein={netPlein}
                    onMode={(m) => setH((s) => ({ ...s, cibleMode: m }))}
                    onCible={(v) => setH((s) => ({ ...s, cible: v }))}
                    onJours={(v) => setH((s) => ({ ...s, jours: v }))}
                  />
                </div>
              </div>

              <div className="card mt-6 p-5 sm:p-8">
                <h2 className="text-lg font-semibold text-ink-900">
                  Ce qu'il faut afficher selon la plateforme
                </h2>
                <p className="mt-1 text-sm text-ink-500">
                  Les tarifs du baromètre — et celui que vous saisissez — sont le
                  prix HT que vous facturez, <strong>avant</strong> les frais de
                  service de l'intermédiaire. Pour percevoir la même chose partout,
                  il faut donc afficher davantage là où une commission s'applique.
                </p>
                <div className="mt-5">
                  <TarifsPlateformes tjm={tjmEffectif} cible={h.tjm2027 > 0 ? h.tjm2027 : undefined} />
                </div>

                <h3 className="mt-10 text-base font-semibold text-ink-900">
                  Où part votre TJM de {eur(tjmEffectif)}
                </h3>
                <p className="mt-1 text-sm text-ink-500">
                  Vous conservez {eur(tjmEffectif)} par jour quel que soit le canal
                  — ce qui change, c'est ce que le client paie par-dessus. Chaque
                  barre montre ce prix client, puis ce qu'il en reste vraiment une
                  fois les frais, les cotisations et l'impôt payés.
                </p>
                <div className="mt-4">
                  <DecompositionTjm tjm={tjmEffectif} jours={h.jours} />
                </div>
              </div>

              {profs.map((p) => (
                <GaugeMetier
                  key={p.cle}
                  libelle={p.libelle}
                  couleur={p.couleur}
                  niveau={p.experience.find((n) => n.cle === h.niveau) ?? p.experience[2]}
                  facteurVille={moyenneVille(p, ville) / moyenneVille(p, 'national')}
                  ville={ville}
                  tjm={tjmEffectif}
                />
              ))}
            </div>
          </div>
        </section>

        <ReperesEconomiques />
        <Regles />
      </main>

      <Pied />
    </div>
  );
}

function GaugeMetier({
  libelle,
  couleur,
  niveau,
  facteurVille,
  ville,
  tjm,
}: {
  libelle: string;
  couleur: string;
  niveau: NiveauExperience;
  facteurVille: number;
  ville: string;
  tjm: number;
}) {
  const niveauVille =
    ville === 'national'
      ? niveau
      : {
          ...niveau,
          bas: Math.round(niveau.bas * facteurVille),
          moyen: Math.round(niveau.moyen * facteurVille),
          haut: Math.round(niveau.haut * facteurVille),
        };
  return (
    <div className="card mt-6 p-5 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink-900">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: couleur }} />
        {libelle} — tranche {niveau.label}
        {ville !== 'national' && ` à ${ville}`}
      </h2>
      <div className="mt-5">
        <JaugeExperience tjm={tjm} niveau={niveauVille} />
      </div>
    </div>
  );
}

/** The milestones drawn on the chart, explained, with the studies behind them. */
function ReperesEconomiques() {
  return (
    <section id="reperes" className="scroll-mt-20 border-t border-ink-200/70 bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
          Repères économiques
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
          Les jalons tracés sur le graphique, et ce qu'ils ont changé pour les
          tarifs freelances.
        </p>

        <ol className="mt-8 grid gap-4 sm:grid-cols-2">
          {EVENEMENTS.map((e) => (
            <li key={e.date} className="card p-5">
              <div className="flex items-baseline gap-3">
                <span className="tabular shrink-0 rounded-md bg-gold-100 px-2 py-0.5 text-xs font-semibold text-gold-700">
                  {e.date}
                </span>
                <h3 className="text-sm font-semibold text-ink-900">{e.label}</h3>
              </div>
              {e.explication && (
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{e.explication}</p>
              )}
            </li>
          ))}
        </ol>

        {REFERENCES.length > 0 && (
          <>
            <h3 className="mt-12 text-lg font-semibold text-ink-900">
              Études de marché citées
            </h3>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {REFERENCES.map((r) => (
                <li key={r.titre} className="card p-5">
                  <p className="text-sm font-semibold text-ink-900">{r.titre}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{r.detail}</p>
                  {r.url && (
                    <a
                      href={r.url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-block text-sm font-medium text-brand-700 underline underline-offset-4 hover:text-brand-800"
                    >
                      {r.hote ?? 'Consulter'}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
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
        {/* A stale figure and a current one look alike; only the date separates
            them, so it is stated rather than left in the data. */}
        {VERIFIE_LE && (
          <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-ink-200">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-400" />
            Chiffres relevés à la source le{' '}
            <strong className="font-medium text-white">{VERIFIE_LE}</strong>
          </p>
        )}
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
