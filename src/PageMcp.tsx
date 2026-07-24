import { useState } from 'react';
import { Entete, Pied } from './components/Cadre';
import * as P from './lib/parametres2026';

/**
 * Waitlist page for the planned MCP server.
 *
 * The site is static, so nothing is charged or stored here: the pricing tiers
 * are informational. The sign-up form is intentionally inert for now — the way
 * people will register is still to be decided — so it collects and sends
 * nothing, and no contact address is exposed.
 */

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
    nom: 'Synthèse consolidée',
    detail: 'Les trois volets réconciliés en un seul scénario cohérent.',
  },
];

const FORMULES = [
  {
    cle: '3 mois',
    prix: '10 €',
    periode: '3 mois',
    accroche: 'Pour tester sur un exercice',
    points: ['Accès complet aux outils', 'Barèmes tenus à jour', 'Sans reconduction automatique'],
    vedette: false,
  },
  {
    cle: '1 an',
    prix: '100 €',
    periode: '1 an',
    accroche: 'Pour s’y appuyer durablement',
    points: [
      'Tout ce qui précède',
      'Un an de mises à jour des barèmes',
      'Le meilleur coût annuel',
    ],
    vedette: true,
  },
];

export default function PageMcp() {
  const [email, setEmail] = useState('');
  const [formule, setFormule] = useState<string>('3 mois');
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
              moteur de ces simulateurs à Claude, ChatGPT et consorts. Vous
              demandez « quel salaire pour 140 000 € de résultat ? » et l'assistant
              répond, chiffré et sourcé, sans quitter votre conversation — et peut
              enchaîner avec vos données comptables réelles.
            </p>
          </div>
        </section>

        {/* Ce que le serveur expose */}
        <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
          <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
            Ce que l'assistant pourra faire
          </h2>
          <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
            Les mêmes calculs que le site, appelables en langage naturel — avec les
            mêmes sources officielles derrière chaque paramètre.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {OUTILS_EXPOSES.map((o) => (
              <div key={o.nom} className="card p-5">
                <h3 className="font-semibold text-ink-900">{o.nom}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{o.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Formules */}
        <section className="border-y border-ink-200/70 bg-ink-50">
          <div className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
            <h2 className="text-2xl font-semibold tracking-tight text-ink-900">
              Tarifs prévus
            </h2>
            <p className="mt-2 max-w-2xl leading-relaxed text-ink-500">
              Un accès simple, sans abonnement qui se renouvelle à votre insu. Rien
              n'est encaissé pour l'instant : l'accès ouvrira à la sortie du serveur.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:max-w-3xl">
              {FORMULES.map((f) => (
                <div
                  key={f.cle}
                  className={[
                    'card relative flex flex-col p-6 sm:p-8',
                    f.vedette ? 'ring-2 ring-brand-500' : '',
                  ].join(' ')}
                >
                  {f.vedette && (
                    <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white">
                      Le plus avantageux
                    </span>
                  )}
                  <p className="text-sm text-ink-500">{f.accroche}</p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="tabular text-4xl font-semibold tracking-tight text-ink-900">
                      {f.prix}
                    </span>
                    <span className="text-sm text-ink-400">/ {f.periode}</span>
                  </p>
                  <ul className="mt-6 space-y-2.5 text-sm text-ink-600">
                    {f.points.map((p) => (
                      <li key={p} className="flex gap-2">
                        <span className="text-brand-500">✓</span>
                        {p}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    onClick={() => {
                      setFormule(f.cle);
                      document.getElementById('alerte')?.scrollIntoView({ behavior: 'smooth' });
                    }}
                    className={[
                      'mt-8 rounded-xl px-4 py-3 text-sm font-semibold transition',
                      f.vedette
                        ? 'bg-brand-600 text-white hover:bg-brand-700'
                        : 'border border-ink-200 text-ink-800 hover:border-brand-400 hover:text-brand-700',
                    ].join(' ')}
                  >
                    Être prévenu pour cette formule
                  </button>
                </div>
              ))}
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

                <fieldset className="mt-5">
                  <legend className="field-label">Formule qui vous intéresse</legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {FORMULES.map((f) => (
                      <button
                        key={f.cle}
                        type="button"
                        aria-pressed={formule === f.cle}
                        onClick={() => setFormule(f.cle)}
                        className={[
                          'rounded-lg border px-3 py-1.5 text-sm font-medium transition',
                          formule === f.cle
                            ? 'border-brand-500 bg-brand-50 text-brand-700'
                            : 'border-ink-200 bg-white text-ink-500 hover:border-ink-300 hover:text-ink-800',
                        ].join(' ')}
                      >
                        {f.cle} · {f.prix}
                      </button>
                    ))}
                  </div>
                </fieldset>

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
