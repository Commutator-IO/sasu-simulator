import { useState } from 'react';
import { Entete, Pied } from './components/Cadre';
import { ConversationMcp, type Echange } from './components/ConversationMcp';
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
 * Figures below are not mocked up: each was produced by running this site's own
 * engine, so an illustration cannot promise an answer the tool would not give.
 */
const ECHANGES: Echange[] = [
  {
    question:
      'Mon TJM est à 700 €. Il tient la route à Paris pour un expert data avec 10 ans de métier ?',
    outil: 'positionnerTjm',
    reponse: [
      'À Paris, la tranche 8-15 ans est à **730 €** de moyenne. Vos 700 € vous placent **30 € en dessous**, au **39ᵉ centile** de la fourchette.',
      'Le marché parisien a culminé à **754 €** début 2023 puis reflué à **732 €** en 2025 : votre tarif suit la tendance plutôt qu’il ne décroche.',
    ],
  },
  {
    question:
      'Je dois chiffrer 12 jours via Malt et je veux garder mes 700 € par jour. J’affiche combien ?',
    outil: 'decomposerTjm',
    reponse: [
      'Affichez **778 €** par jour : la commission de 10 % vous laisse bien vos 700 €.',
      'Le client verra **836 €** par jour, sa part de service comprise — soit **10 036 €** pour la mission, dont **8 400 €** pour vous.',
    ],
  },
  {
    question: 'Quel salaire me verser si je termine l’année à 140 000 € de résultat ?',
    outil: 'balayer',
    reponse: [
      'L’optimum est à **23 362 €** de brut annuel, pour **77 002 €** net en poche.',
      'La courbe est plate autour : de **22 185 €** à **26 727 €**, l’écart de net reste sous 100 €. Choisissez dans cette plage selon vos besoins de trésorerie.',
    ],
  },
  {
    question: 'Je gagnais 60 000 € brut en CDI. Il me faut quoi pour retrouver ça ?',
    outil: 'seuilRentabilite',
    reponse: [
      'Ce salaire laissait **41 138 €** net en poche. Il vous faut **78 610 €** de chiffre d’affaires pour l’égaler.',
      'Sur 200 jours facturés, cela fait **393 €** par jour. À votre tarif de 700 €, **113 jours** suffisent.',
      'Attention : à net égal, un CDI vaut davantage — mutuelle, tickets restaurant et droits au chômage ne sont pas comptés ici.',
    ],
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
 * year, pricing a proposal — so access is bought outright rather than rented:
 * months to spend for someone testing the water, or paid once and kept for
 * those who settle in. Nothing renews, so there is nothing to cancel.
 */
const OFFRES = [
  {
    cle: '6 mois',
    prix: '10 €',
    duree: '6 mois d’accès',
    accroche: 'Pour voir ce que ça donne sur un exercice',
    points: [
      'Les six mois s’activent quand vous en avez besoin, dans les deux ans',
      'Rechargeable : les mois s’ajoutent, ils ne se remplacent pas',
      'Barèmes à jour pendant toute la durée active',
    ],
    vedette: false,
  },
  {
    cle: 'à vie',
    prix: '30 €',
    duree: 'une fois, accès à vie',
    accroche: 'Pour s’y appuyer sans y repenser',
    points: [
      'Payé une fois, gardé pour de bon',
      'Rentable dès la deuxième année',
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

          <div className="card mt-6 border-brand-200 bg-brand-50 p-5">
            <p className="text-sm leading-relaxed text-ink-700">
              <strong className="text-ink-900">Vous gardez la main.</strong> L'assistant
              propose un chiffre et la règle qui l'a produit&nbsp;; la décision reste la
              vôtre, et chaque paramètre est vérifiable sur ce site comme dans le texte
              officiel qui le fonde.
            </p>
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
              une proposition — pas toutes les semaines&nbsp;: on achète l'accès, on
              ne le loue pas. Rien n'est encaissé pour l'instant, l'accès ouvrira à
              la sortie du serveur.
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
                      {o.prix}
                    </span>
                    <span className="text-sm text-ink-400">/ {o.duree}</span>
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
                  site qui est statique et gratuit à héberger. Les 10 € couvrent cet
                  hébergement et le travail de conception — lire les textes, sourcer
                  chaque paramètre, tenir les barèmes à jour.
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
