import { useMemo } from 'react';
import { Entete, Pied } from './components/Cadre';
import { Courbe } from './components/Courbe';
import { HistogrammeProjection } from './components/HistogrammeProjection';
import { HistogrammeAcomptes } from './components/HistogrammeAcomptes';
import { BoutonPartage } from './components/BoutonPartage';
import { eur, pct } from './lib/format';
import { calculerSynthese } from './lib/synthese';
import { lienPartageSynthese } from './lib/urlSynthese';
import * as P from './lib/parametres2026';

export default function PageSynthese() {
  const recherche = typeof window === 'undefined' ? '' : window.location.search;
  const s = useMemo(() => calculerSynthese(recherche), [recherche]);
  const { projection, arbitrage, acomptes, balayage, brutChoisi, repartition, scenario } = s;

  const total = arbitrage.resultatAvantRemuneration + arbitrage.reservesAnterieures;

  return (
    <div className="min-h-screen bg-ink-50 print:bg-white">
      <div className="print:hidden">
        <Entete chemin="/synthese/" />
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12 print:max-w-none print:p-0">
        {/* Toolbar — never printed */}
        <div className="print:hidden mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              Synthèse pour votre comptable
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Les cinq volets de l'analyse, prêts à imprimer ou exporter en PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Imprimer / exporter en PDF
          </button>
        </div>

        <div className="space-y-8 print:space-y-0">
          {/* ------------------------------------------------ Slide 1 — Cover */}
          <Slide numero={1} total={5}>
            <div className="flex h-full flex-col justify-center">
              <p className="text-sm font-medium uppercase tracking-[0.15em] text-brand-600">
                SASU à l'impôt sur les sociétés · Barèmes {P.ANNEE}
              </p>
              <h2 className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-4xl">
                Synthèse fiscale et de trésorerie
              </h2>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-ink-500">
                Une lecture d'ensemble en cinq volets : projection du chiffre
                d'affaires, arbitrage rémunération / dividendes, acomptes
                d'impôt sur les sociétés, et la répartition de chaque euro de
                résultat.
              </p>

              <dl className="mt-10 grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                <Chiffre label="Chiffre d'affaires" valeur={eur(projection.caTotal)} />
                <Chiffre
                  label="Résultat avant rémunération"
                  valeur={eur(arbitrage.resultatAvantRemuneration)}
                />
                <Chiffre label="Rémunération retenue" valeur={eur(brutChoisi)} />
                <Chiffre label="Net en poche" valeur={eur(arbitrage.netEnPoche)} accent />
              </dl>
            </div>
          </Slide>

          {/* -------------------------------------------- Slide 2 — Projection */}
          <Slide numero={2} total={5} titre="Projection du chiffre d'affaires">
            {scenario.aProjection ? (
              <>
                <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
                  <Chiffre label="CA facturé" valeur={eur(projection.caFacture)} />
                  <Chiffre label="CA projeté" valeur={eur(projection.caProjete)} />
                  <Chiffre label="Total annuel" valeur={eur(projection.caTotal)} accent />
                  <Chiffre
                    label="Résultat avant rémunération"
                    valeur={eur(projection.resultatAvantRemuneration)}
                  />
                </dl>
                <div className="mt-6">
                  <HistogrammeProjection r={projection} />
                </div>
              </>
            ) : (
              <div className="flex h-full flex-col justify-center">
                <p className="max-w-2xl text-base leading-relaxed text-ink-500">
                  La projection mensuelle n'a pas été renseignée. Le résultat
                  avant rémunération utilisé dans cette synthèse est{' '}
                  <strong className="text-ink-900">
                    {eur(arbitrage.resultatAvantRemuneration)}
                  </strong>
                  , tel que saisi dans l'arbitrage.
                </p>
                <p className="mt-3 text-sm text-ink-400">
                  Pour détailler mois par mois, renseignez l'onglet « Projection
                  de CA », puis rouvrez cette synthèse.
                </p>
              </div>
            )}
          </Slide>

          {/* --------------------------------------------- Slide 3 — Arbitrage */}
          <Slide numero={3} total={5} titre="Arbitrage rémunération / dividendes">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              <Chiffre label="Rémunération brute" valeur={eur(brutChoisi)} />
              <Chiffre
                label="Salaire net après impôt"
                valeur={eur(arbitrage.salaireNet - arbitrage.irSurSalaire)}
              />
              <Chiffre label="Dividendes nets" valeur={eur(arbitrage.dividendesNets)} />
              <Chiffre label="Net en poche" valeur={eur(arbitrage.netEnPoche)} accent />
            </dl>

            <p className="mt-4 text-sm leading-relaxed text-ink-500">
              Optimum de rémunération autour de{' '}
              <strong className="text-ink-900">
                {eur(balayage.optimum.brutAnnuel)}
              </strong>{' '}
              de brut (plage équivalente de {eur(balayage.plateau.min)} à{' '}
              {eur(balayage.plateau.max)}). Taux de prélèvement global :{' '}
              {pct(arbitrage.tauxPrelevementGlobal)}.
            </p>

            <div className="mt-4">
              <Courbe
                points={balayage.points}
                brutCourant={brutChoisi}
                brutOptimal={balayage.optimum.brutAnnuel}
                plateau={balayage.plateau}
              />
            </div>
          </Slide>

          {/* ---------------------------------------------- Slide 4 — Acomptes */}
          <Slide numero={4} total={5} titre="Acomptes d'impôt sur les sociétés">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
              <Chiffre label="Impôt de référence" valeur={eur(acomptes.isReference)} />
              <Chiffre label="Impôt prévisionnel" valeur={eur(acomptes.isPrevisionnel)} />
              <Chiffre label="Reste à verser" valeur={eur(acomptes.resteAVerser)} accent />
              <Chiffre
                label={acomptes.solde >= 0 ? 'Solde au 15 mai' : 'Restitution au 15 mai'}
                valeur={eur(Math.abs(acomptes.solde))}
              />
            </dl>
            <div className="mt-6">
              <HistogrammeAcomptes r={acomptes} />
            </div>
          </Slide>

          {/* --------------------------------------------- Slide 5 — Cascade */}
          <Slide numero={5} total={5} titre="Où va chaque euro de résultat">
            <p className="text-sm leading-relaxed text-ink-500">
              Décomposition du résultat avant rémunération
              {arbitrage.reservesAnterieures > 0 && ', réserves antérieures comprises,'}{' '}
              en {eur(total)}.
            </p>

            <div className="mt-6 space-y-3">
              {repartition
                .filter((part) => part.montant > 0.5)
                .map((part) => {
                  const p = total > 0 ? part.montant / total : 0;
                  const poche = part.label === 'Net en poche';
                  return (
                    <div key={part.label}>
                      <div className="flex items-baseline justify-between gap-4 text-sm">
                        <span className={poche ? 'font-semibold text-ink-900' : 'text-ink-600'}>
                          {part.label}
                        </span>
                        <span className="tabular shrink-0 font-semibold text-ink-900">
                          {eur(part.montant)}{' '}
                          <span className="font-normal text-ink-400">({pct(p)})</span>
                        </span>
                      </div>
                      <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={poche ? 'h-full bg-brand-500' : 'h-full bg-ink-300'}
                          style={{ width: `${Math.min(100, p * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>

            <p className="mt-6 text-xs leading-relaxed text-ink-400">
              Sur {eur(total)} de résultat avant rémunération, vous conservez{' '}
              {eur(arbitrage.netEnPoche)} nets en poche, soit{' '}
              {pct(total > 0 ? arbitrage.netEnPoche / total : 0)}. Le reste couvre
              cotisations, impôts et mise en réserve.
            </p>
          </Slide>
        </div>

        <div className="print:hidden mt-8">
          <BoutonPartage lien={lienPartageSynthese(scenario)} />
        </div>
      </main>

      <div className="print:hidden">
        <Pied />
      </div>
    </div>
  );
}

function Slide({
  numero,
  total,
  titre,
  children,
}: {
  numero: number;
  total: number;
  titre?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="slide card break-inside-avoid p-6 sm:p-10 print:min-h-[170mm] print:break-after-page print:shadow-none">
      <div className="flex items-center justify-between border-b border-ink-100 pb-3">
        {titre ? (
          <h2 className="text-lg font-semibold tracking-tight text-ink-900">{titre}</h2>
        ) : (
          <span className="text-sm font-medium text-brand-600">SASU simulator</span>
        )}
        <span className="tabular text-xs text-ink-400">
          {numero} / {total}
        </span>
      </div>
      <div className="mt-6 h-[calc(100%-3rem)]">{children}</div>
    </section>
  );
}

function Chiffre({
  label,
  valeur,
  accent = false,
}: {
  label: string;
  valeur: string;
  accent?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs text-ink-400">{label}</dt>
      <dd
        className={[
          'tabular mt-1 text-xl font-semibold tracking-tight sm:text-2xl',
          accent ? 'text-brand-700' : 'text-ink-900',
        ].join(' ')}
      >
        {valeur}
      </dd>
    </div>
  );
}
