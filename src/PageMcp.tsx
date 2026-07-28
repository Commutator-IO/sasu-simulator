import { useState } from 'react';
import { Entete, Pied } from './components/Cadre';
import { ConversationMcp } from './components/ConversationMcp';
import { nb, txt, type Echange } from './lib/conversationMcp';
import {
  PLATEFORMES,
  getProfession,
  moyenneVille,
  positionner,
  serieVille,
} from './lib/barometreTjm';
import { DEFAUTS_ARBITRAGE } from './lib/arbitrage';
import { balayer } from './lib/simulation';
import { decomposerTjm, netEnPocheSalaire, seuilRentabilite } from './lib/rentabilite';
import { DEFAUTS_PROJECTION, calculerProjection, reprojeter } from './lib/projection';
import { DEFAUTS_ACOMPTES, calculerAcomptes, isExercice } from './lib/acomptes';
import { eur } from './lib/format';
import * as P from './lib/parametres2026';

/**
 * Waitlist page for the planned MCP server.
 *
 * The site is static, so nothing is charged or stored here: the price shown is
 * informational. The sign-up form is intentionally inert for now — the way
 * people will register is still to be decided — so it collects and sends
 * nothing, and no contact address is exposed.
 */

/**
 * Six questions, each wired to the engine that already runs this site.
 *
 * Nothing here is mocked up: change a figure in a question and the answer is
 * recomputed by the same functions the server would call, so an illustration
 * cannot promise an answer the tool would not give.
 */
const VILLES = ['Paris', 'Lyon', 'Bordeaux', 'Lille', 'Marseille'];
const NIVEAUX = ['0 à 2 ans', '3 à 7 ans', '8 à 15 ans', '15 ans et +'];
const MOIS_LETTRE = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
const NOMS_MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

/** "2023-03" read back as "mars 2023". */
const moisAn = (date: string) => {
  const [an, m] = date.split('-').map(Number);
  return `${NOMS_MOIS[(m || 1) - 1]} ${an}`;
};

const pct = (t: number) => `${Math.round(t * 100)} %`;

const ECHANGES: Echange[] = [
  {
    question:
      'Mon TJM est à {tjm} €. Il tient la route à {ville} pour un expert data sur la tranche {niveau} ?',
    champs: { tjm: 700, ville: 'Paris', niveau: '8 à 15 ans' },
    options: { ville: VILLES, niveau: NIVEAUX },
    outil: 'positionnerTjm',
    calculer: (v) => {
      const tjm = nb(v, 'tjm');
      const ville = txt(v, 'ville');
      const p = getProfession('expert-data');
      const niv = p.experience.find((n) => n.label === txt(v, 'niveau')) ?? p.experience[2];
      // The brackets are national; a city moves them by the ratio of its own
      // average to the national one, exactly as the market tab does.
      const facteur = moyenneVille(p, ville) / moyenneVille(p, 'national');
      const local = {
        ...niv,
        bas: Math.round(niv.bas * facteur),
        moyen: Math.round(niv.moyen * facteur),
        haut: Math.round(niv.haut * facteur),
      };
      const pos = positionner(tjm, local);
      const mesures = serieVille(p, ville).filter((s) => !s.projete);
      const pic = mesures.reduce((a, b) => (b.valeur > a.valeur ? b : a), mesures[0]);
      const fin = mesures[mesures.length - 1];
      return {
        reponse: [
          `À ${ville}, la tranche ${niv.label} tourne autour de **${eur(local.moyen)}**. Vos ${eur(tjm)} vous placent **${eur(Math.abs(pos.ecartMoyen))} ${pos.ecartMoyen >= 0 ? 'au-dessus' : 'en dessous'}**, au **${Math.round(pos.positionDansPlage * 100)}ᵉ centile** d’une fourchette qui va de ${eur(local.bas)} à ${eur(local.haut)}.`,
          `Le tarif publié à ${ville} a culminé à **${eur(pic.valeur)}** en ${moisAn(pic.date)} et se tient à **${eur(fin.valeur)}** à la dernière mesure, en ${moisAn(fin.date)}.`,
        ],
      };
    },
  },
  {
    question:
      'Je dois chiffrer {jours} jours via {plateforme} et je veux garder mes {tjm} € par jour. J’affiche combien ?',
    champs: { jours: 12, plateforme: 'Malt', tjm: 700 },
    options: {
      plateforme: ['Malt', 'Comet', 'Le Hibou', 'Crème de la Crème', 'En direct'],
    },
    outil: 'decomposerTjm',
    calculer: (v) => {
      const tjm = nb(v, 'tjm');
      const jours = nb(v, 'jours');
      const pf = PLATEFORMES.find((x) => x.nom === txt(v, 'plateforme'));
      const taux = pf && pf.taux >= 0 ? pf.taux : 0;
      const marge = pf?.margeClient ?? 0;
      // Annual billable days are left at the reference: they set the tax split,
      // not the length of this mission.
      const part = decomposerTjm(tjm, taux, DEFAUTS_ARBITRAGE, { marge });
      const facture = tjm + part.commission;
      const estimee = marge > 0 && !pf?.margeClientPubliee;
      return {
        reponse: [
          taux > 0
            ? `Affichez **${eur(Math.round(facture))}** par jour : la commission de ${pct(taux)} vous laisse bien vos ${eur(tjm)}.`
            : `Rien n’est prélevé sur votre facture : affichez vos **${eur(tjm)}** par jour.`,
          marge > 0
            ? `Le client verra **${eur(Math.round(part.clientPaie))}** par jour, sa part de service ${estimee ? 'estimée à' : 'de'} ${pct(marge)} comprise — soit **${eur(Math.round(part.clientPaie * jours))}** pour la mission, dont **${eur(Math.round(tjm * jours))}** pour vous.`
            : `Le client paie ce que vous facturez — soit **${eur(Math.round(facture * jours))}** pour la mission, dont **${eur(Math.round(tjm * jours))}** pour vous.`,
        ],
      };
    },
  },
  {
    question: 'Quel salaire me verser si je termine l’année à {resultat} € de résultat ?',
    champs: { resultat: 140000 },
    outil: 'balayer',
    calculer: (v) => {
      const b = balayer({
        ...DEFAUTS_ARBITRAGE,
        resultatAvantRemuneration: nb(v, 'resultat'),
      });
      return {
        reponse: [
          `L’optimum est à **${eur(Math.round(b.optimum.brutAnnuel))}** de brut annuel, pour **${eur(Math.round(b.optimum.netEnPoche))}** net en poche.`,
          `La courbe est plate autour : de **${eur(Math.round(b.plateau.min))}** à **${eur(Math.round(b.plateau.max))}**, l’écart de net reste sous ${eur(b.plateau.tolerance)}. Choisissez dans cette plage selon vos besoins de trésorerie.`,
        ],
      };
    },
  },
  {
    question:
      'Voici mes factures des six premiers mois. Où j’atterris à fin décembre si ça continue comme ça ?',
    champs: { m1: 8400, m2: 9600, m3: 9600, m4: 12000, m5: 0, m6: 4200 },
    outil: 'calculerProjection',
    fichier: 'factures-jan-juin.zip',
    calculer: (v) => {
      const factures = 6;
      const saisis = Array.from({ length: factures }, (_, i) => nb(v, `m${i + 1}`));
      const r = calculerProjection({
        ...DEFAUTS_PROJECTION,
        facturation: reprojeter([...saisis, ...Array(12 - factures).fill(0)], factures),
        moisFactures: factures,
      });
      const creux = saisis.reduce(
        (a, m, i) => (m < a.montant ? { montant: m, i } : a),
        { montant: saisis[0], i: 0 },
      );
      return {
        graphique: r.mois.map((m, i) => ({
          mois: MOIS_LETTRE[i],
          valeur: m.montant,
          projete: m.projete,
          ...(i < factures ? { cle: `m${i + 1}` } : {}),
        })),
        reponse: [
          `Vos six mois totalisent **${eur(Math.round(r.caFacture))}**, soit **${eur(Math.round(r.moyenneMensuelle))}** de moyenne mensuelle. Je n’ai relevé que ces six montants dans vos factures — ni vos clients, ni les lignes de détail.`,
          `Au même rythme, vous finiriez à **${eur(Math.round(r.caTotal))}** de chiffre d’affaires, pour un résultat de **${eur(Math.round(r.resultatAvantRemuneration))}** avant votre rémunération.`,
          `Votre mois le plus faible, **${NOMS_MOIS[creux.i]} à ${eur(Math.round(creux.montant))}**, tire la moyenne vers le bas : c’est lui qui pèse le plus sur la projection.`,
        ],
      };
    },
  },
  {
    question:
      'Je te joins mon bilan 2026. Combien d’impôt sur les sociétés au total, et qu’est-ce que je dois provisionner en 2027 ?',
    champs: { resultat: 96000 },
    outil: 'calculerAcomptes',
    fichier: 'bilan-2026.pdf',
    calculer: (v) => {
      const benefice = nb(v, 'resultat');
      const is = isExercice(benefice, 12, true);
      // The previous exercise is taken as steady: nothing is invented beyond
      // the one figure read off the balance sheet.
      const a = calculerAcomptes({
        ...DEFAUTS_ACOMPTES,
        beneficeAvantDernier: benefice,
        beneficePrecedent: benefice,
        beneficePrevisionnel: benefice,
        strategie: 'appele',
      });
      const acompte = a.echeances[0]?.parDefaut ?? 0;
      return {
        reponse: [
          `Votre bilan donne **${eur(Math.round(benefice))}** de résultat fiscal. C’est le seul chiffre que j’envoie au serveur — le document reste chez vous.`,
          a.dispense
            ? `L’IS de l’exercice ressort à **${eur(Math.round(is))}**, sous le seuil de ${eur(3000)} : aucun acompte n’est dû en 2027, tout se règle au solde.`
            : `L’IS de l’exercice ressort à **${eur(Math.round(is))}** : ${pct(P.IS_TAUX_REDUIT)} jusqu’à ${eur(P.IS_SEUIL_TAUX_REDUIT)} de bénéfice, ${pct(P.IS_TAUX_NORMAL)} au-delà.`,
          a.dispense
            ? 'Gardez-le de côté : il tombera en une fois, au solde de mai.'
            : `À bénéfice stable, provisionnez **${eur(Math.round(acompte))}** à chacune des quatre échéances de 2027 — 15 mars, juin, septembre et décembre. Si l’année décroche, l’onglet acomptes vous laisse les moduler.`,
        ],
      };
    },
  },
  {
    question:
      'Je gagnais {brut} € brut en CDI. Il me faut quoi pour retrouver ça, à {tjm} € par jour ?',
    champs: { brut: 60000, tjm: 700, jours: 200 },
    outil: 'seuilRentabilite',
    calculer: (v) => {
      const net = netEnPocheSalaire(nb(v, 'brut'), DEFAUTS_ARBITRAGE);
      const jours = nb(v, 'jours');
      const s = seuilRentabilite(net, DEFAUTS_ARBITRAGE, { jours, tjm: nb(v, 'tjm') });
      if (s.horsAtteinte) {
        return {
          reponse: [
            'Cet objectif dépasse ce que le simulateur sait modéliser — vérifiez le montant saisi.',
          ],
        };
      }
      return {
        reponse: [
          `Ce salaire laissait **${eur(Math.round(net))}** net en poche. Il vous faut **${eur(Math.round(s.caNecessaire))}** de chiffre d’affaires pour l’égaler.`,
          `Sur ${jours} jours facturés, cela fait **${eur(Math.round(s.tjmNecessaire))}** par jour. À votre tarif, **${s.joursNecessaires === null ? '—' : Math.ceil(s.joursNecessaires)} jours** suffisent.`,
          'Attention : à net égal, un CDI vaut davantage — mutuelle, tickets restaurant et droits au chômage ne sont pas comptés ici.',
        ],
      };
    },
  },
];

const OUTILS_EXPOSES = [
  {
    nom: 'Arbitrage rémunération / dividendes',
    detail:
      'Le net en poche pour chaque niveau de salaire, l’optimum et sa plage équivalente.',
  },
  {
    nom: 'Modulation des acomptes d’IS',
    detail:
      'Les quatre échéances, la régularisation de juin, le solde de mai et le coût d’une sous-estimation.',
  },
  {
    nom: 'Projection du chiffre d’affaires',
    detail: 'Du CA mensuel au résultat avant rémunération de fin d’année.',
  },
  {
    nom: 'Étude de marché du TJM',
    detail:
      'L’évolution du tarif jour depuis 2019, métier par métier et ville par ville, avec les repères économiques qui l’expliquent.',
  },
  {
    nom: 'Seuil de rentabilité',
    detail:
      'Le chiffre d’affaires et le nombre de jours qu’il faut pour atteindre un net en poche, ou pour égaler un salaire en CDI.',
  },
  {
    nom: 'Décomposition d’une journée facturée',
    detail:
      'Ce que gardent la plateforme, l’intermédiaire et l’État, selon le canal — freelance en direct, via une plateforme, en régie ou salarié en ESN.',
  },
  {
    nom: 'Aide à la rédaction d’un devis',
    detail:
      'Le tarif à afficher selon le canal, ce qu’il laisse une fois la commission passée, et sa position face au marché — de quoi chiffrer une proposition sans quitter la conversation.',
  },
  {
    nom: 'Appui à la tenue comptable',
    detail:
      'Les échéances de l’exercice, les montants à provisionner et le contrôle de cohérence entre le prévisionnel et le réalisé. L’assistant prépare les chiffres ; il ne remplace ni le comptable ni sa signature.',
  },
  {
    nom: 'Synthèse consolidée',
    detail: 'Tous les volets réconciliés en un seul scénario cohérent.',
  },
];

/**
 * Two ways in, neither of them a subscription.
 *
 * A freelance reaches for these tools in bursts — fixing a rate, closing a
 * year, pricing a proposal — so access is bought outright rather than rented: a
 * month to settle one question, or paid once and kept for those who come
 * back. Nothing renews, so there is nothing to cancel.
 */
/**
 * Standard French VAT, charged on top of what the service is worth.
 *
 * Both figures are shown: the buyer pays the inclusive one, and a freelance
 * reading this page reclaims the tax, so the exclusive one is what it really
 * costs them. Derived rather than written twice, so they cannot drift apart.
 */
const TVA = 0.2;

const euros = (v: number) =>
  v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const OFFRES = [
  {
    cle: '1 mois',
    ttc: 7,
    duree: '1 mois d’accès',
    accroche: 'Le temps de trancher une question',
    points: [
      'De quoi arbitrer une rémunération ou chiffrer une proposition',
      'Le mois s’active quand vous en avez besoin',
      'Rechargeable : les périodes s’ajoutent, elles ne se remplacent pas',
    ],
    vedette: false,
  },
  {
    cle: 'à vie',
    ttc: 25,
    duree: 'une fois, accès à vie',
    accroche: 'Pour s’y appuyer sans y repenser',
    points: [
      'Payé une fois, gardé pour de bon',
      'Rentable dès le quatrième mois d’accès',
      'Les barèmes restent à jour aussi longtemps que le service tourne',
    ],
    vedette: true,
  },
];

export default function PageMcp() {
  const [email, setEmail] = useState('');
  // The form does nothing yet: the sign-up channel is still to be decided, so
  // submitting only shows a note and sends nothing anywhere.
  const [note, setNote] = useState(false);

  return (
    <div className="min-h-screen">
      <Entete chemin="/mcp/" />

      <main>
        <section className="border-b border-ink-200/70 bg-white">
          <div className="mx-auto max-w-6xl px-5 pt-14 pb-12 sm:pt-20 sm:pb-16">
            <p className="mb-5 inline-flex items-center gap-2 rounded-full bg-gold-100 px-3 py-1 text-xs font-medium text-gold-700">
              <span className="h-1.5 w-1.5 rounded-full bg-gold-500" />
              À venir — sans date de sortie ferme
            </p>
            <h1 className="max-w-3xl text-3xl font-semibold leading-[1.1] tracking-tight text-ink-900 sm:text-5xl">
              Ces calculs, directement dans votre assistant IA
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-500 sm:text-lg">
              Un <strong>serveur MCP</strong> (Model Context Protocol) exposera le
              moteur de ces simulateurs à Claude, ChatGPT et consorts. Vous posez
              la question dans vos mots&nbsp;; l'assistant appelle le bon calcul et
              répond chiffré et sourcé, sans quitter votre conversation — et en
              enchaînant, si vous le voulez, avec vos données comptables réelles.
            </p>
          </div>
        </section>

        {/* Ce qu'on pourra lui demander */}
        <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Ce que vous pourrez lui demander
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
            Vos questions telles que vous les posez. L'assistant appelle le calcul
            qui convient et rend un chiffre, pas une approximation — les montants
            ci-dessous sortent du moteur de ce site, ils ne sont pas maquettés.
          </p>

          <div className="mt-8">
            <ConversationMcp echanges={ECHANGES} />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="card border-brand-200 bg-brand-50 p-5">
              <p className="text-sm leading-relaxed text-ink-700">
                <strong className="text-ink-900">Vous gardez la main.</strong>{' '}
                L'assistant propose un chiffre et la règle qui l'a produit&nbsp;; la
                décision reste la vôtre, et chaque paramètre est vérifiable sur ce
                site comme dans le texte officiel qui le fonde.
              </p>
            </div>
            <div className="card border-brand-200 bg-brand-50 p-5">
              <p className="text-sm leading-relaxed text-ink-700">
                <strong className="text-ink-900">Vos documents ne partent pas.</strong>{' '}
                Joignez un bilan ou des factures&nbsp;: c'est votre assistant qui les
                lit, chez lui. Il n'envoie au serveur que les nombres dont le calcul a
                besoin — un résultat, un chiffre d'affaires — jamais le fichier, ni vos
                clients, ni le détail des lignes.
              </p>
            </div>
          </div>
        </section>

        {/* Ce que le serveur expose */}
        <section className="border-t border-ink-200/70">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Les calculs derrière ces réponses
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
            Les mêmes que le site, appelables en langage naturel — avec les mêmes
            sources officielles derrière chaque paramètre.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {OUTILS_EXPOSES.map((o) => (
              <div key={o.nom} className="card p-5">
                <h3 className="font-semibold text-ink-900">{o.nom}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{o.detail}</p>
              </div>
            ))}
          </div>
          </div>
        </section>

        {/* Formules */}
        <section className="border-y border-ink-200/70 bg-ink-50">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Tarifs prévus
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
              Deux façons d'entrer, aucune n'étant un abonnement. Ces outils
              servent par à-coups — fixer un tarif, clôturer un exercice, chiffrer
              une proposition — pas tous les mois&nbsp;: on achète l'accès, on ne le
              loue pas. Prix TTC, TVA à 20 % comprise, et le HT en dessous. Rien n'est encaissé pour
              l'instant, l'accès ouvrira à la sortie du serveur.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:max-w-3xl">
              {OFFRES.map((o) => (
                <div
                  key={o.cle}
                  className={[
                    'card relative flex flex-col p-6 sm:p-8',
                    o.vedette ? 'ring-2 ring-brand-500' : '',
                  ].join(' ')}
                >
                  {o.vedette && (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">
                      Le plus avantageux
                    </span>
                  )}
                  <p className="text-sm text-ink-500">{o.accroche}</p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="tabular text-4xl font-semibold tracking-tight text-ink-900">
                      {o.ttc}&nbsp;€
                    </span>
                    <span className="text-sm text-ink-400">TTC / {o.duree}</span>
                  </p>
                  <p className="tabular mt-1 text-xs text-ink-400">
                    soit {euros(o.ttc / (1 + TVA))}&nbsp;€ HT
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-ink-600">
                    {o.points.map((pt) => (
                      <li key={pt} className="flex gap-2">
                        <span className="shrink-0 text-brand-500">✓</span>
                        {pt}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() =>
                      document.getElementById('alerte')?.scrollIntoView({ behavior: 'smooth' })
                    }
                    className={[
                      'mt-8 rounded-xl px-4 py-3 text-sm font-semibold transition',
                      o.vedette
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'border border-ink-200 text-ink-800 hover:border-brand-400 hover:text-brand-700',
                    ].join(' ')}
                  >
                    Être prévenu de la sortie
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-6 lg:max-w-3xl">
              <div className="rounded-2xl border border-ink-200 bg-white/60 p-6 sm:p-8">
                <h3 className="font-semibold text-ink-900">À quoi sert ce prix</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">
                  Un serveur MCP demande un backend qui tourne, contrairement à ce
                  site qui est statique et gratuit à héberger. Ces quelques euros
                  couvrent cet hébergement et le travail de conception — lire les
                  textes, sourcer chaque paramètre, tenir les barèmes à jour.
                </p>
                <p className="mt-3 text-sm leading-relaxed text-ink-600">
                  Le prix n'est pas indexé sur ce que l'outil vous fait gagner, et il
                  n'est pas récurrent&nbsp;: un outil qu'on ouvre trois fois dans
                  l'année ne justifie pas un prélèvement tous les mois. Les
                  simulateurs du site, eux, restent gratuits et sans compte.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Formulaire d'alerte */}
        <section id="alerte" className="scroll-mt-20">
          <div className="mx-auto max-w-2xl px-5 py-14 sm:py-20">
            <h2 className="text-center text-2xl font-semibold tracking-tight text-ink-900">
              Prévenez-moi de la sortie
            </h2>
            <p className="mx-auto mt-2 max-w-md text-center leading-relaxed text-ink-500">
              Laissez votre adresse : vous recevrez un message à l'ouverture du
              serveur, et rien d'autre.
            </p>

            <div className="card mt-8 p-6 sm:p-8">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setNote(true);
                }}
              >
                <label htmlFor="email-mcp" className="field-label">
                  Votre adresse email
                </label>
                <input
                  id="email-mcp"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="vous@exemple.fr"
                  className="mt-1 w-full rounded-xl border border-ink-200 bg-white px-3.5 py-2.5 text-base text-ink-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-100"
                />


                <button
                  type="submit"
                  className="mt-6 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-brand-700"
                >
                  Être prévenu
                </button>
              </form>

              {note ? (
                <p className="mt-4 rounded-xl bg-brand-50 p-4 text-sm leading-relaxed text-ink-700">
                  Les inscriptions ne sont pas encore ouvertes. Cette page évoluera
                  dès que le serveur approchera de sa sortie — repassez d'ici là.
                </p>
              ) : (
                <p className="mt-4 text-xs leading-relaxed text-ink-400">
                  Le formulaire n'est pas encore actif&nbsp;: rien n'est envoyé ni
                  stocké, et aucun paiement n'est demandé. Le moyen d'inscription
                  sera précisé ici à l'approche de la sortie.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Méthode / cadre */}
        <section id="sources" className="scroll-mt-20 bg-ink-900 text-ink-100">
          <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
            <h2 className="text-2xl font-semibold tracking-tight text-white">
              Ce que le serveur MCP fera, et ne fera pas
            </h2>
            <ul className="mt-8 max-w-3xl space-y-3">
              {[
                'Il exposera les mêmes calculs que le site, avec les mêmes barèmes officiels et les mêmes sources — tenus à jour au fil des lois de finances.',
                'Il pourra se combiner à un connecteur de logiciel comptable pour partir de vos chiffres réels plutôt que d’une saisie manuelle.',
                'Il calcule et documente ses hypothèses ; il ne remplace pas votre expert-comptable et ne délivre pas de conseil financier personnalisé.',
                `Barèmes ${P.ANNEE}. Comme le site, il restera à jour ou il ne sortira pas : un barème périmé fourni à une IA serait pire qu’un site périmé.`,
              ].map((x) => (
                <li key={x} className="flex gap-3 text-sm leading-relaxed text-ink-300">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <Pied />
    </div>
  );
}
