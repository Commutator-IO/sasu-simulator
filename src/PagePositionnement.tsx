import { useEffect, useMemo, useState } from 'react';
import { Montant, Segments } from './components/Champs';
import { Entete, Pied } from './components/Cadre';
import { BoutonPartage } from './components/BoutonPartage';
import { BoutonReset } from './components/BoutonReset';
import { LienSignaler } from './components/LienSignaler';
import { EvolutionTjm, type SerieTemporelle } from './components/EvolutionTjm';
import { JaugeExperience } from './components/JaugeExperience';
import {
  anneeDecimale,
  EVENEMENTS,
  getProfession,
  META,
  moyenneVille,
  PROFESSIONS,
  serieVille,
  TAUX_COMMISSION_PLATEFORME,
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

  const profs = h.professions.map(getProfession);
  const villes = villesCommunes(profs);
  const ville = villes.includes(h.ville) ? h.ville : 'national';

  // Shared seniority brackets — every profession uses the same keys/labels.
  const brackets = PROFESSIONS[0].experience;

  // Effective rates (add the platform commission back when asked).
  const facteurComm = h.commission ? 1 + TAUX_COMMISSION_PLATEFORME : 1;
  const pourcentCommission = Math.round(TAUX_COMMISSION_PLATEFORME * 100);
  const tjmEffectif = Math.round(h.tjm * facteurComm);

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
        points: serieVille(p, ville).map((pt) => ({
          ...pt,
          valeur: Math.round(pt.valeur * ratio),
        })),
      };
    });
    const pts = [
      h.tjm2024 > 0 ? { annee: anneeDecimale('2024-07'), valeur: Math.round(h.tjm2024 * facteurComm) } : null,
      h.tjm2025 > 0 ? { annee: anneeDecimale('2025-07'), valeur: Math.round(h.tjm2025 * facteurComm) } : null,
      { annee: anneeDecimale('2026-07'), valeur: tjmEffectif },
    ].filter((p): p is { annee: number; valeur: number } => p !== null);
    if (pts.length > 1) {
      marche.push({ label: 'Votre TJM', couleur: 'var(--color-ink-800)', epais: true, points: pts });
    }
    return marche;
  }, [profs, ville, h.niveau, h.tjm2024, h.tjm2025, facteurComm, tjmEffectif]);

  const trajectoire = h.tjm2024 > 0 || h.tjm2025 > 0;

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
              Où se situe votre TJM&nbsp;?
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Superposez l'évolution du tarif jour moyen de plusieurs métiers,
              ville par ville, situez votre tarif dans sa tranche d'expérience, et
              tracez votre propre trajectoire.
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
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {PROFESSIONS.map((p) => {
                        const actif = h.professions.includes(p.cle);
                        return (
                          <button
                            key={p.cle}
                            type="button"
                            aria-pressed={actif}
                            onClick={() => basculerProfession(p.cle)}
                            className={[
                              'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                              actif
                                ? 'border-brand-500 bg-brand-50 text-brand-700'
                                : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-800',
                            ].join(' ')}
                          >
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ backgroundColor: p.couleur }}
                            />
                            {p.libelle}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <Montant
                    label="Votre TJM (actuel)"
                    valeur={h.tjm}
                    onChange={(v) => setH((s) => ({ ...s, tjm: v }))}
                    suffixe="€ / jour"
                    hint="Le tarif journalier que vous affichez ou visez."
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <Montant
                      label="Votre TJM 2024"
                      valeur={h.tjm2024}
                      onChange={(v) => setH((s) => ({ ...s, tjm2024: v }))}
                      suffixe="€"
                      hint="Optionnel"
                    />
                    <Montant
                      label="Votre TJM 2025"
                      valeur={h.tjm2025}
                      onChange={(v) => setH((s) => ({ ...s, tjm2025: v }))}
                      suffixe="€"
                      hint="Optionnel"
                    />
                  </div>
                  <Segments
                    label="Commission plateforme"
                    valeur={h.commission}
                    options={[
                      { valeur: false, label: 'Déjà incluse' },
                      { valeur: true, label: `À ajouter (+${pourcentCommission} %)` },
                    ]}
                    onChange={(v) => setH((s) => ({ ...s, commission: v }))}
                    hint={
                      h.commission
                        ? `Vos TJM sont comparés commission incluse (+${pourcentCommission} %).`
                        : `Les repères incluent la commission plateforme (~${pourcentCommission} %).`
                    }
                  />
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
                    : 'Votre TJM en trait horizontal.'}
                </p>
                <div className="mt-5">
                  <EvolutionTjm
                    series={series}
                    evenements={EVENEMENTS}
                    tjmUtilisateur={trajectoire ? undefined : tjmEffectif}
                  />
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
