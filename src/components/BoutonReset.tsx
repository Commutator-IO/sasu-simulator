import { useState } from 'react';

/**
 * Clears the tool back to its defaults. Two steps, so a stray click cannot
 * wipe values the user spent time entering: the first click asks to confirm,
 * and the request lapses on its own after a few seconds.
 */
export function BoutonReset({ onReset }: { onReset: () => void }) {
  const [confirme, setConfirme] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        if (confirme) {
          onReset();
          setConfirme(false);
        } else {
          setConfirme(true);
          setTimeout(() => setConfirme(false), 3500);
        }
      }}
      className={[
        'mt-2 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition',
        confirme
          ? 'border border-gold-300 bg-gold-100 text-ink-800 hover:bg-gold-200'
          : 'text-ink-400 hover:text-ink-700',
      ].join(' ')}
    >
      {confirme ? 'Confirmer la remise à zéro' : 'Réinitialiser les valeurs'}
    </button>
  );
}
