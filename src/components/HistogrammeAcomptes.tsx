import { eur } from '../lib/format';
import type { ResultatAcomptes } from '../lib/acomptes';

/**
 * Cash going out, from the first instalment of the year to the second
 * instalment of the next.
 *
 * The point of running past 31 December is the 15 March → 15 May → 15 June
 * sequence: the balance lands between next year's first two instalments, and
 * the June one is the one regularised on this year's profit. A profit that
 * jumps is therefore paid twice within a month.
 *
 * Hand-drawn SVG scaled through the viewBox — no external dependency.
 */

const W = 860;
const H = 320;
const HAUT = 26;
const BAS = 78;
const GAUCHE = 8;
const DROITE = 8;

/** Rounds an axis step to 1, 2, 2.5 or 5 times a power of ten. */
function pasLisible(brut: number): number {
  if (brut <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(brut));
  const palier = [1, 2, 2.5, 5, 10].find((p) => brut / magnitude <= p) ?? 10;
  return palier * magnitude;
}

type Colonne = {
  cle: string;
  libelle: string;
  sousTitre: string;
  appele: number;
  verse: number;
  couleur: string;
  anneeSuivante: boolean;
};

export function HistogrammeAcomptes({ r }: { r: ResultatAcomptes }) {
  const solde = r.solde;

  const colonnes: Colonne[] = [
    ...r.echeances.map((e) => ({
      cle: `t${e.rang}`,
      libelle: e.date,
      sousTitre: e.passee ? 'déjà versé' : 'à venir',
      appele: e.parDefaut,
      verse: e.ajuste,
      couleur: e.passee ? 'var(--color-ink-500)' : 'var(--color-brand-500)',
      anneeSuivante: false,
    })),
    {
      cle: 'suite-mars',
      libelle: '15 mars',
      sousTitre: 'acompte, sur N−1',
      appele: 0,
      verse: r.suite.acompte1,
      couleur: 'var(--color-brand-300)',
      anneeSuivante: true,
    },
    {
      cle: 'solde',
      libelle: '15 mai',
      sousTitre:
        solde > 0.5 ? 'solde à payer' : solde < -0.5 ? 'restitution' : 'rien à payer',
      appele: 0,
      verse: Math.abs(solde),
      couleur: solde > 0.5 ? 'var(--color-gold-500)' : 'var(--color-brand-200)',
      anneeSuivante: true,
    },
    {
      cle: 'suite-juin',
      libelle: '15 juin',
      sousTitre: 'régularisé sur N',
      appele: 0,
      verse: r.suite.acompte2,
      couleur: 'var(--color-gold-500)',
      anneeSuivante: true,
    },
  ];

  const maxi = Math.max(...colonnes.flatMap((c) => [c.appele, c.verse]), 1);
  const pas = pasLisible(maxi / 3);
  const plafond = Math.ceil(maxi / pas) * pas;

  const largeurColonne = (W - GAUCHE - DROITE) / colonnes.length;
  const y = (v: number) => HAUT + (1 - v / plafond) * (H - HAUT - BAS);
  const hauteur = (v: number) => Math.max(v > 0 ? 2 : 0, (v / plafond) * (H - HAUT - BAS));

  const graduations: number[] = [];
  for (let v = 0; v <= plafond + 1; v += pas) graduations.push(v);

  const debutSuivante = GAUCHE + largeurColonne * r.echeances.length;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full select-none"
        role="img"
        aria-label="Sorties de trésorerie, des acomptes de l'année au solde et à l'acompte de juin suivant"
      >
        {/* The following year sits on its own tinted band */}
        <rect
          x={debutSuivante}
          y={HAUT - 18}
          width={W - DROITE - debutSuivante}
          height={H - HAUT - BAS + 18}
          fill="var(--color-ink-100)"
          opacity="0.55"
          rx="6"
        />
        <text
          x={debutSuivante + 8}
          y={HAUT - 6}
          fontSize="10"
          fontWeight="600"
          fill="var(--color-ink-400)"
          letterSpacing="0.05em"
        >
          ANNÉE SUIVANTE
        </text>

        {graduations.map((v) => (
          <g key={v}>
            <line
              x1={GAUCHE}
              x2={W - DROITE}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--color-ink-200)"
              strokeDasharray={v === 0 ? undefined : '3 4'}
            />
            <text
              x={GAUCHE + 2}
              y={y(v) - 5}
              className="tabular"
              fontSize="11"
              fill="var(--color-ink-400)"
            >
              {eur(v)}
            </text>
          </g>
        ))}

        {colonnes.map((c, i) => {
          const centre = GAUCHE + largeurColonne * (i + 0.5);
          const largeurBarre = Math.min(34, largeurColonne * 0.32);
          const paire = c.appele > 0;
          const xAppele = centre - largeurBarre - 2;
          const xVerse = paire ? centre + 2 : centre - largeurBarre / 2;

          return (
            <g key={c.cle}>
              {paire && (
                <rect
                  x={xAppele}
                  y={y(c.appele)}
                  width={largeurBarre}
                  height={hauteur(c.appele)}
                  rx="3"
                  fill="var(--color-ink-200)"
                />
              )}
              <rect
                x={xVerse}
                y={y(c.verse)}
                width={largeurBarre}
                height={hauteur(c.verse)}
                rx="3"
                fill={c.couleur}
              />
              {c.verse > 0 && (
                <text
                  x={xVerse + largeurBarre / 2}
                  y={y(c.verse) - 6}
                  textAnchor="middle"
                  className="tabular"
                  fontSize="11"
                  fontWeight="600"
                  fill="var(--color-ink-700)"
                >
                  {eur(c.verse)}
                </text>
              )}
              <text
                x={centre}
                y={H - BAS + 20}
                textAnchor="middle"
                fontSize="12"
                fill="var(--color-ink-600)"
              >
                {c.libelle}
              </text>
              <text
                x={centre}
                y={H - BAS + 35}
                textAnchor="middle"
                fontSize="10"
                fill="var(--color-ink-400)"
              >
                {c.sousTitre}
              </text>
            </g>
          );
        })}

        {/* The May–June cluster is the crunch worth naming */}
        {r.suite.cumulMaiJuin > 0 && (
          <>
            <line
              x1={GAUCHE + largeurColonne * 5.1}
              x2={GAUCHE + largeurColonne * 6.9}
              y1={H - BAS + 48}
              y2={H - BAS + 48}
              stroke="var(--color-gold-500)"
              strokeWidth="1.5"
            />
            <text
              x={GAUCHE + largeurColonne * 6}
              y={H - BAS + 64}
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fill="var(--color-gold-600)"
            >
              {eur(r.suite.cumulMaiJuin)} en un mois
            </text>
          </>
        )}
      </svg>

      <figcaption className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-200" /> Appelé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-ink-500" /> Déjà versé
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-500" /> À verser
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-gold-500" /> Solde et régularisation
        </span>
      </figcaption>
    </figure>
  );
}
