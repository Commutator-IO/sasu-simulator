import { useRef, useState } from 'react';

/**
 * Copies the link that reopens the current simulation.
 *
 * Takes the link already built rather than the state, so every tool can reuse
 * it with its own serialisation.
 */
export function BoutonPartage({ lien }: { lien: string }) {
  const [etat, setEtat] = useState<'repos' | 'copie' | 'manuel'>('repos');
  const champ = useRef<HTMLInputElement>(null);

  const copier = async () => {
    try {
      // Unavailable outside a secure context, or if the user denies clipboard
      // access.
      await navigator.clipboard.writeText(lien);
      setEtat('copie');
      setTimeout(() => setEtat('repos'), 2500);
    } catch {
      // Surface the link for manual copying rather than failing silently.
      setEtat('manuel');
      requestAnimationFrame(() => champ.current?.select());
    }
  };

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={copier}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-3 text-sm font-medium text-ink-800 transition hover:border-brand-400 hover:text-brand-700"
      >
        {etat === 'copie' ? (
          <>
            <span className="text-brand-600">✓</span> Lien copié
          </>
        ) : (
          <>Copier le lien de cette simulation</>
        )}
      </button>

      {etat === 'manuel' && (
        <input
          ref={champ}
          readOnly
          value={lien}
          onFocus={(e) => e.currentTarget.select()}
          aria-label="Lien de la simulation, à copier"
          className="tabular mt-2 w-full rounded-xl border border-ink-200 bg-ink-50 px-3 py-2 text-xs text-ink-600 outline-none focus:border-brand-500"
        />
      )}

      <p className="mt-2 px-2 text-xs leading-relaxed text-ink-400">
        {etat === 'manuel'
          ? 'Copie automatique indisponible : sélectionnez le lien ci-dessus.'
          : 'Le lien rouvre la simulation avec tous vos paramètres. Rien n’est enregistré : tout tient dans l’adresse.'}
      </p>
    </div>
  );
}
