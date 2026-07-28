/**
 * Illustrations of what a conversation would look like once the server exists.
 *
 * Drawn rather than screenshotted, for two reasons. The server is not built, so
 * a screenshot would show a product that does not exist; and the figures are
 * not invented — every one comes from the engine this site already runs, so an
 * illustration cannot drift from what the tool would actually answer.
 */

export type Echange = {
  question: string;
  outil: string;
  /** Document the user attached, if any. */
  fichier?: string;
  reponse: string[];
};

export function ConversationMcp({ echanges }: { echanges: Echange[] }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {echanges.map((e) => (
        <figure
          key={e.question}
          className="m-0 overflow-hidden rounded-2xl border border-ink-200 bg-white"
        >
          <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50 px-4 py-2">
            <span className="h-2 w-2 rounded-full bg-ink-300" />
            <span className="h-2 w-2 rounded-full bg-ink-300" />
            <span className="h-2 w-2 rounded-full bg-ink-300" />
            <span className="ml-2 text-[11px] font-medium text-ink-400">
              Exemple d’échange — illustration
            </span>
          </div>

          <div className="space-y-3 p-4 sm:p-5">
            <div className="ml-auto max-w-[85%] space-y-1.5">
              {e.fichier && (
                <p className="ml-auto flex w-fit items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 py-1.5 text-xs text-ink-600">
                  <span aria-hidden="true">📎</span>
                  <span className="font-medium">{e.fichier}</span>
                </p>
              )}
              <p className="rounded-2xl rounded-br-sm bg-brand-600 px-3.5 py-2.5 text-sm leading-relaxed text-white">
                {e.question}
              </p>
            </div>

            <p className="inline-flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 text-[11px] font-medium text-ink-500">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              appelle&nbsp;<code className="font-mono">{e.outil}</code>
            </p>

            <div className="max-w-[92%] space-y-2 rounded-2xl rounded-bl-sm bg-ink-50 px-3.5 py-3 text-sm leading-relaxed text-ink-700">
              {e.reponse.map((ligne) => (
                <p key={ligne}>
                  {/* The figures carry the meaning, so they are set apart from
                      the prose rather than buried in it. */}
                  {ligne.split(/\*\*(.+?)\*\*/g).map((bout, i) =>
                    i % 2 === 1 ? (
                      <strong key={bout} className="tabular text-ink-900">
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
      ))}
    </div>
  );
}
