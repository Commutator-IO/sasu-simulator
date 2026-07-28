import { useMemo, useState } from 'react';
import { nb, type Barre, type Echange, type Valeurs } from '../lib/conversationMcp';

/**
 * Illustrations of what a conversation would look like once the server exists.
 *
 * Drawn rather than screenshotted, for two reasons. The server is not built, so
 * a screenshot would show a product that does not exist; and the figures are
 * not invented — every one comes from the engine this site already runs, so an
 * illustration cannot drift from what the tool would actually answer.
 *
 * The values in each question can be changed, and the answer is recomputed on
 * the spot. They are underlined rather than boxed: in a real conversation you
 * would retype the question, so a form control would promise the wrong thing.
 */

export function ConversationMcp({ echanges }: { echanges: Echange[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {echanges.map((e) => (
        <Exemple key={e.question} echange={e} />
      ))}
    </div>
  );
}

function Exemple({ echange }: { echange: Echange }) {
  const [valeurs, setValeurs] = useState<Valeurs>(echange.champs);
  const { reponse, graphique } = useMemo(
    () => echange.calculer(valeurs),
    [echange, valeurs],
  );
  const modifier = (cle: string, v: number | string) =>
    setValeurs((s) => ({ ...s, [cle]: v }));

  return (
    <figure className="m-0 overflow-hidden rounded-2xl border border-ink-200 bg-white">
      <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2">
        <span className="h-2 w-2 rounded-full bg-ink-300" />
        <span className="h-2 w-2 rounded-full bg-ink-300" />
        <span className="h-2 w-2 rounded-full bg-ink-300" />
        <span className="ml-2 text-[11px] font-medium text-ink-400">
          Exemple d’échange — cliquez sur les valeurs soulignées
        </span>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        <div className="ml-auto max-w-[85%] space-y-1.5">
          {echange.fichier && (
            <p className="ml-auto flex w-fit items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-600">
              <span aria-hidden="true">📎</span>
              <span className="font-medium">{echange.fichier}</span>
            </p>
          )}
          <p className="rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">
            {echange.question.split(/\{(\w+)\}/g).map((bout, i) =>
              i % 2 === 0 ? (
                bout
              ) : (
                <Controle
                  key={bout}
                  cle={bout}
                  valeur={valeurs[bout]}
                  options={echange.options?.[bout]}
                  onChange={(v) => modifier(bout, v)}
                />
              ),
            )}
          </p>
        </div>

        <p className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-500">
          <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
          appelle&nbsp;<code className="font-mono">{echange.outil}</code>
        </p>

        <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
          {/* An assistant that can draw will draw: the shape of a year is read
              faster than twelve figures in a sentence. */}
          {graphique && (
            <Graphique barres={graphique} valeurs={valeurs} onChange={modifier} />
          )}
          {reponse.map((ligne, i) => (
            <p key={i}>
              {/* The figures carry the meaning, so they are set apart from the
                  prose rather than buried in it. */}
              {ligne.split(/\*\*(.+?)\*\*/g).map((bout, j) =>
                j % 2 === 1 ? (
                  <strong key={j} className="tabular text-ink-900">
                    {bout}
                  </strong>
                ) : (
                  bout
                ),
              )}
            </p>
          ))}
        </div>
      </div>
    </figure>
  );
}

/**
 * One adjustable value inside the question.
 *
 * Styled as the sentence itself, marked only by a dotted underline: the reader
 * is invited to click, not handed a form. Nothing is boxed, so the bubble still
 * reads as something someone typed.
 */
function Controle({
  cle,
  valeur,
  options,
  onChange,
}: {
  cle: string;
  valeur: number | string;
  options?: string[];
  onChange: (v: number | string) => void;
}) {
  const commun =
    'cursor-pointer appearance-none border-0 border-b border-dashed border-white/60 bg-transparent p-0 font-semibold text-white caret-white underline-offset-4 hover:border-white focus:border-solid focus:border-white focus:outline-none';

  if (options) {
    return (
      <select
        aria-label={cle}
        title="Cliquez pour changer"
        value={String(valeur)}
        onChange={(e) => onChange(e.target.value)}
        className={commun}
      >
        {options.map((o) => (
          <option key={o} value={o} className="text-ink-900">
            {o}
          </option>
        ))}
      </select>
    );
  }
  // Text rather than number: a figure sitting in a sentence has to keep its
  // thousands separator, which a numeric input will not show.
  const affiche = grouper(Number(valeur));
  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label={cle}
      title="Cliquez pour changer"
      value={affiche}
      onChange={(e) => onChange(chiffres(e.target.value))}
      style={{ width: `${largeurCh(affiche)}ch` }}
      className={`tabular ${commun}`}
    />
  );
}

/** A figure as it is written in French prose: 140 000, not 140000. */
const grouper = (n: number) => (Number.isFinite(n) ? n : 0).toLocaleString('fr-FR');

/** Keeps only the digits a reader typed, separators and stray keys dropped. */
const chiffres = (s: string) => Number(s.replace(/\D/g, '')) || 0;

/**
 * Width the field needs, in `ch`.
 *
 * `ch` is the width of a zero, and the digits are tabular, so they measure
 * exactly one each; the thousands separator is a narrow space, worth about a
 * third. Sizing on the string length alone leaves a visible gap before the unit
 * that follows in the sentence.
 */
const largeurCh = (s: string) => {
  const separateurs = s.length - s.replace(/\D/g, '').length;
  return s.length - separateurs * 0.65 + 0.15;
};

/** Monthly turnover, invoiced months solid and adjustable, projection hollow. */
function Graphique({
  barres,
  valeurs,
  onChange,
}: {
  barres: Barre[];
  valeurs: Valeurs;
  onChange: (cle: string, v: number) => void;
}) {
  const max = Math.max(...barres.map((b) => b.valeur)) || 1;
  return (
    <div className="mb-3 flex items-end gap-1">
      {barres.map((b, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex h-20 w-full items-end">
            <div
              className={[
                'w-full rounded-t',
                b.projete
                  ? 'border border-dashed border-brand-400 bg-brand-100'
                  : 'bg-brand-500',
              ].join(' ')}
              style={{ height: `${Math.max((b.valeur / max) * 72, 2)}px` }}
            />
          </div>
          <span className="text-[9px] text-ink-400">{b.mois}</span>
          {b.cle ? (
            <input
              type="text"
              inputMode="numeric"
              aria-label={`${b.mois} — chiffre d’affaires`}
              title="Cliquez pour changer"
              value={grouper(nb(valeurs, b.cle))}
              onChange={(e) => onChange(b.cle!, chiffres(e.target.value))}
              className="tabular w-full cursor-pointer appearance-none border-0 border-b border-dashed border-ink-300 bg-transparent p-0 text-center text-[9px] text-ink-600 hover:border-ink-500 focus:border-solid focus:border-brand-500 focus:outline-none"
            />
          ) : (
            <span className="text-[9px] text-ink-300">—</span>
          )}
        </div>
      ))}
    </div>
  );
}
