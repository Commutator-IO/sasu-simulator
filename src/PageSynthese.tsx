import { useEffect, useMemo, useState } from 'react';
import { Entete, Pied } from './components/Cadre';
import { Courbe } from './components/Courbe';
import { HistogrammeProjection } from './components/HistogrammeProjection';
import { HistogrammeAcomptes } from './components/HistogrammeAcomptes';
import { BoutonPartage } from './components/BoutonPartage';
import { eur, pct } from './lib/format';
import { calculerSynthese } from './lib/synthese';
import { lienPartageSynthese } from './lib/urlSynthese';
import { rechercheCourante } from './lib/compact';
import * as P from './lib/parametres2026';

export default function PageSynthese() {
  const recherche = rechercheCourante();
  const s = useMemo(() => calculerSynthese(recherche), [recherche]);
  const { projection, arbitrage, acomptes, balayage, brutChoisi, repartition, scenario } = s;

  const total = arbitrage.resultatAvantRemuneration + arbitrage.reservesAnterieures;

  // On screen the deck is a carousel: one slide at a time, arrow keys or the
  // controls below to move. In print every slide is shown, one per page.
  const slides = [
    <SlideCouverture
      key="couverture"
      caTotal={projection.caTotal}
      resultat={arbitrage.resultatAvantRemuneration}
      brut={brutChoisi}
      net={arbitrage.netEnPoche}
    />,
    <SlideProjection key="projection" projection={projection} arbitrage={arbitrage} aProjection={scenario.aProjection} />,
    <SlideArbitrage key="arbitrage" arbitrage={arbitrage} balayage={balayage} brutChoisi={brutChoisi} />,
    <SlideAcomptes key="acomptes" acomptes={acomptes} />,
    <SlideCascade key="cascade" arbitrage={arbitrage} repartition={repartition} total={total} />,
  ];

  const [index, setIndex] = useState(0);
  const nb = slides.length;
  const aller = (n: number) => setIndex(Math.min(nb - 1, Math.max(0, n)));

  useEffect(() => {
    const clavier = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(nb - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(0, i - 1));
    };
    window.addEventListener('keydown', clavier);
    return () => window.removeEventListener('keydown', clavier);
  }, [nb]);

  return (
    <div className="min-h-screen bg-ink-50 print:bg-white">
      <div className="print:hidden">
        <Entete chemin="/synthese/" />
      </div>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-10 print:max-w-none print:p-0">
        {/* Toolbar — never printed */}
        <div className="print:hidden mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-ink-900">
              Synthèse pour votre comptable
            </h1>
            <p className="mt-1 text-sm text-ink-500">
              Cinq volets à faire défiler, prêts à imprimer ou exporter en PDF.
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

        {/* The deck. On screen only the active slide shows; print reveals all. */}
        <div className="print:space-y-0">
          {slides.map((slide, i) => (
            <div key={i} className={i === index ? 'block' : 'hidden print:block'}>
              <SlideCadre numero={i + 1} total={nb} actif={i === index}>
                {slide}
              </SlideCadre>
            </div>
          ))}
        </div>

        {/* Carousel controls — never printed */}
        <div className="print:hidden mt-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => aller(index - 1)}
            disabled={index === 0}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40"
          >
            ← Précédent
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Volets de la synthèse">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Volet ${i + 1}`}
                onClick={() => setIndex(i)}
                className={[
                  'h-2.5 rounded-full transition-all',
                  i === index ? 'w-6 bg-brand-600' : 'w-2.5 bg-ink-300 hover:bg-ink-400',
                ].join(' ')}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => aller(index + 1)}
            disabled={index === nb - 1}
            className="rounded-lg border border-ink-200 bg-white px-4 py-2 text-sm font-medium text-ink-700 transition enabled:hover:border-brand-400 enabled:hover:text-brand-700 disabled:opacity-40"
          >
            Suivant →
          </button>
        </div>

        <div className="print:hidden mt-6">
          <BoutonPartage lien={lienPartageSynthese(scenario)} />
        </div>
      </main>

      <div className="print:hidden">
        <Pied />
      </div>
    </div>
  );
}

/** Uniform slide frame: a running header, and a body that fills the height. */
function SlideCadre({
  numero,
  total,
  actif,
  children,
}: {
  numero: number;
  total: number;
  actif?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      className="slide card flex min-h-[68vh] flex-col p-6 sm:p-10 print:min-h-[172mm]"
      aria-hidden={actif === false}
    >
      <div className="flex items-center justify-between border-b border-ink-100 pb-3">
        <span className="text-sm font-semibold text-brand-600">SASU simulator</span>
        <span className="tabular text-xs text-ink-400">
          {numero} / {total}
        </span>
      </div>
      <div className="mt-6 flex flex-1 flex-col justify-center">{children}</div>
    </section>
  );
}

function Titre({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-5 text-xl font-semibold tracking-tight text-ink-900">{children}</h3>
  );
}

function SlideCouverture({
  caTotal,
  resultat,
  brut,
  net,
}: {
  caTotal: number;
  resultat: number;
  brut: number;
  net: number;
}) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-sm font-medium uppercase tracking-[0.15em] text-brand-600">
        SASU à l'impôt sur les sociétés · Barèmes {P.ANNEE}
      </p>
      <h2 className="mt-4 text-4xl font-semibold leading-tight tracking-tight text-ink-900 sm:text-5xl">
        Synthèse fiscale
        <br />
        et de trésorerie
      </h2>
      <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
        Ce document suit un même exercice de bout en bout : du chiffre d'affaires
        facturé jusqu'à ce qui reste réellement en poche. Il réunit en cinq
        volets les décisions qui, d'ordinaire, sont examinées séparément.
      </p>
      <ul className="mt-5 grid max-w-2xl gap-x-8 gap-y-2 text-sm leading-relaxed text-ink-500 sm:grid-cols-2">
        <li className="flex gap-2">
          <span className="text-brand-500">1.</span> La projection du chiffre
          d'affaires et du résultat de fin d'année.
        </li>
        <li className="flex gap-2">
          <span className="text-brand-500">2.</span> L'arbitrage entre
          rémunération et dividendes, et son optimum.
        </li>
        <li className="flex gap-2">
          <span className="text-brand-500">3.</span> Les acomptes d'impôt sur les
          sociétés et le solde de mai.
        </li>
        <li className="flex gap-2">
          <span className="text-brand-500">4.</span> La répartition de chaque euro
          de résultat entre poche, charges et impôts.
        </li>
      </ul>
      <p className="mt-5 max-w-2xl text-sm leading-relaxed text-ink-400">
        Les chiffres se recoupent d'un volet à l'autre : le résultat projeté
        alimente l'arbitrage, dont découle le bénéfice imposable qui fonde les
        acomptes. Barèmes {P.ANNEE}, à valider avec votre expert-comptable.
      </p>

      <dl className="mt-auto grid grid-cols-2 gap-x-8 gap-y-5 border-t border-ink-100 pt-8 sm:grid-cols-4">
        <Chiffre label="Chiffre d'affaires" valeur={eur(caTotal)} />
        <Chiffre label="Résultat avant rémunération" valeur={eur(resultat)} />
        <Chiffre label="Rémunération retenue" valeur={eur(brut)} />
        <Chiffre label="Net en poche" valeur={eur(net)} accent />
      </dl>
    </div>
  );
}

function SlideProjection({
  projection,
  arbitrage,
  aProjection,
}: {
  projection: ReturnType<typeof calculerSynthese>['projection'];
  arbitrage: ReturnType<typeof calculerSynthese>['arbitrage'];
  aProjection: boolean;
}) {
  if (!aProjection) {
    return (
      <div className="flex h-full flex-col justify-center">
        <Titre>Projection du chiffre d'affaires</Titre>
        <p className="max-w-2xl text-base leading-relaxed text-ink-500">
          La projection mensuelle n'a pas été renseignée. Le résultat avant
          rémunération utilisé dans cette synthèse est{' '}
          <strong className="text-ink-900">
            {eur(arbitrage.resultatAvantRemuneration)}
          </strong>
          , tel que saisi dans l'arbitrage.
        </p>
        <p className="mt-3 text-sm text-ink-400">
          Pour détailler mois par mois, renseignez l'onglet « Projection de CA »,
          puis rouvrez cette synthèse.
        </p>
      </div>
    );
  }
  return (
    <div className="flex h-full flex-col">
      <Titre>Projection du chiffre d'affaires</Titre>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Chiffre label="CA facturé" valeur={eur(projection.caFacture)} />
        <Chiffre label="CA projeté" valeur={eur(projection.caProjete)} />
        <Chiffre label="Total annuel" valeur={eur(projection.caTotal)} accent />
        <Chiffre
          label="Résultat avant rémunération"
          valeur={eur(projection.resultatAvantRemuneration)}
        />
      </dl>
      <div className="mt-auto pt-6">
        <HistogrammeProjection r={projection} />
      </div>
    </div>
  );
}

function SlideArbitrage({
  arbitrage,
  balayage,
  brutChoisi,
}: {
  arbitrage: ReturnType<typeof calculerSynthese>['arbitrage'];
  balayage: ReturnType<typeof calculerSynthese>['balayage'];
  brutChoisi: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <Titre>Arbitrage rémunération / dividendes</Titre>
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
        Optimum autour de{' '}
        <strong className="text-ink-900">{eur(balayage.optimum.brutAnnuel)}</strong> de
        brut (plage équivalente de {eur(balayage.plateau.min)} à {eur(balayage.plateau.max)}).
        Taux de prélèvement global : {pct(arbitrage.tauxPrelevementGlobal)}.
        {arbitrage.salaireExterneBrut > 0 && (
          <>
            {' '}
            Cette rémunération de président s'ajoute à{' '}
            <strong className="text-ink-900">{eur(arbitrage.salaireExterneBrut)}</strong>{' '}
            de salaire brut perçu ailleurs.
          </>
        )}
      </p>
      <p className="mt-2 text-sm leading-relaxed text-ink-500">
        Après impôt sur les sociétés, le résultat net s'élève à{' '}
        <strong className="text-ink-900">{eur(arbitrage.resultatNet)}</strong> : c'est ce
        que vous pouvez mettre en réserve à l'issue de l'exercice plutôt que distribuer.
        {arbitrage.reserves > 0.5 && (
          <>
            {' '}
            Ici, <strong className="text-ink-900">{eur(arbitrage.reserves)}</strong> y sont
            effectivement affectés.
          </>
        )}
      </p>
      <div className="mt-auto pt-4">
        <Courbe
          points={balayage.points}
          brutCourant={brutChoisi}
          brutOptimal={balayage.optimum.brutAnnuel}
          plateau={balayage.plateau}
          brutExterne={arbitrage.salaireExterneBrut}
        />
      </div>
    </div>
  );
}

function SlideAcomptes({
  acomptes,
}: {
  acomptes: ReturnType<typeof calculerSynthese>['acomptes'];
}) {
  return (
    <div className="flex h-full flex-col">
      <Titre>Acomptes d'impôt sur les sociétés</Titre>
      <dl className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
        <Chiffre label="Impôt de référence" valeur={eur(acomptes.isReference)} />
        <Chiffre label="Impôt prévisionnel" valeur={eur(acomptes.isPrevisionnel)} />
        <Chiffre label="Reste à verser" valeur={eur(acomptes.resteAVerser)} accent />
        <Chiffre
          label={acomptes.solde >= 0 ? 'Solde au 15 mai' : 'Restitution au 15 mai'}
          valeur={eur(Math.abs(acomptes.solde))}
        />
      </dl>
      <div className="mt-auto pt-6">
        <HistogrammeAcomptes r={acomptes} />
      </div>
    </div>
  );
}

function SlideCascade({
  arbitrage,
  repartition,
  total,
}: {
  arbitrage: ReturnType<typeof calculerSynthese>['arbitrage'];
  repartition: ReturnType<typeof calculerSynthese>['repartition'];
  total: number;
}) {
  return (
    <div className="flex h-full flex-col">
      <Titre>Où va chaque euro de résultat</Titre>
      <p className="text-sm leading-relaxed text-ink-500">
        Décomposition du résultat avant rémunération
        {arbitrage.reservesAnterieures > 0 && ', réserves antérieures comprises,'} en{' '}
        {eur(total)}.
      </p>

      <div className="mt-6 flex-1 space-y-4">
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
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-ink-100">
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
        {pct(total > 0 ? arbitrage.netEnPoche / total : 0)}. Le reste couvre cotisations,
        impôts et mise en réserve.
      </p>
    </div>
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
