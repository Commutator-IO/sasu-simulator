import { useEffect, useId, useState } from 'react';
import { num } from '../lib/format';

// ---------------------------------------------------------------------------
// Curseur
// ---------------------------------------------------------------------------

type CurseurProps = {
  label: string;
  valeur: number;
  min: number;
  max: number;
  pas: number;
  onChange: (v: number) => void;
  /** Affichage de la valeur courante, à droite du label. */
  rendu: (v: number) => string;
  /** Graduations affichées sous la piste. */
  reperes?: { valeur: number; label: string }[];
  hint?: string;
};

export function Curseur({
  label,
  valeur,
  min,
  max,
  pas,
  onChange,
  rendu,
  reperes = [],
  hint,
}: CurseurProps) {
  const id = useId();
  const progression = max > min ? ((valeur - min) / (max - min)) * 100 : 0;

  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        <output
          htmlFor={id}
          className="tabular text-xl font-semibold text-ink-900 sm:text-2xl"
        >
          {rendu(valeur)}
        </output>
      </div>

      <input
        id={id}
        type="range"
        className="brand-range"
        min={min}
        max={max}
        step={pas}
        value={valeur}
        // Sans cela, le navigateur restaure la valeur du champ au rechargement
        // et elle diverge de l'état React.
        autoComplete="off"
        onChange={(e) => onChange(Number(e.target.value))}
        // Faire défiler la page au-dessus du curseur ne doit pas en changer
        // la valeur : on rend la molette inopérante en la laissant passer.
        onWheel={(e) => e.currentTarget.blur()}
        style={{
          ['--range-track' as string]: `linear-gradient(to right, var(--color-brand-500) ${progression}%, var(--color-ink-200) ${progression}%)`,
        }}
      />

      {reperes.length > 0 && (
        <div className="relative mt-1 h-9">
          {reperes.map((r) => {
            const position = ((r.valeur - min) / (max - min)) * 100;
            if (position < 0 || position > 100) return null;
            return (
              <button
                key={r.valeur}
                type="button"
                onClick={() => onChange(r.valeur)}
                className="absolute top-0 -translate-x-1/2 whitespace-nowrap rounded px-1 py-0.5 text-[11px] text-ink-400 transition hover:text-brand-600"
                style={{ left: `${position}%` }}
              >
                <span className="mx-auto mb-1 block h-1.5 w-px bg-ink-300" />
                {r.label}
              </button>
            );
          })}
        </div>
      )}

      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Saisie d'un montant
// ---------------------------------------------------------------------------

type MontantProps = {
  label: string;
  valeur: number;
  onChange: (v: number) => void;
  suffixe?: string;
  hint?: string;
  min?: number;
  max?: number;
  /** Nombre de décimales autorisées ; 0 pour un montant en euros entiers. */
  decimales?: number;
};

export function Montant({
  label,
  valeur,
  onChange,
  suffixe = '€',
  hint,
  min = 0,
  max = 100_000_000,
  decimales = 0,
}: MontantProps) {
  const id = useId();

  const formater = (v: number) =>
    decimales === 0
      ? num(v)
      : v.toLocaleString('fr-FR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: decimales,
        });

  const analyser = (saisie: string) => {
    const nettoye =
      decimales === 0
        ? saisie.replace(/[^\d]/g, '')
        : saisie.replace(/,/g, '.').replace(/[^\d.]/g, '');
    return { nettoye, valeur: Number(nettoye || 0) };
  };

  // Tampon local pour laisser l'utilisateur effacer le champ sans le voir
  // repasser à zéro sous ses doigts.
  const [brouillon, setBrouillon] = useState(() => formater(valeur));

  useEffect(() => {
    if (analyser(brouillon).valeur !== valeur) setBrouillon(formater(valeur));
    // On ne resynchronise que sur changement de la valeur amont.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valeur]);

  return (
    <div>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <div className="flex items-center rounded-xl border border-ink-200 bg-white transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          className="tabular w-full rounded-xl bg-transparent px-3.5 py-2.5 text-base font-semibold text-ink-900 outline-none"
          value={brouillon}
          onChange={(e) => {
            const { nettoye, valeur: v } = analyser(e.target.value);
            setBrouillon(
              decimales === 0
                ? // Un montant en euros se relit mieux avec ses séparateurs,
                  // y compris pendant la frappe.
                  nettoye === ''
                  ? ''
                  : formater(Number(nettoye))
                : // Une saisie décimale en cours (« 1, », « 1,2 ») doit rester
                  // telle quelle, sous peine de bloquer la frappe.
                  nettoye.replace('.', ','),
            );
            onChange(Math.min(max, Math.max(min, v)));
          }}
          onBlur={() => setBrouillon(formater(valeur))}
        />
        <span className="shrink-0 pr-3.5 text-sm text-ink-400">{suffixe}</span>
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Groupe de boutons radio
// ---------------------------------------------------------------------------

type SegmentProps<T extends string | number | boolean> = {
  label?: string;
  valeur: T;
  options: { valeur: T; label: string }[];
  onChange: (v: T) => void;
  hint?: string;
};

export function Segments<T extends string | number | boolean>({
  label,
  valeur,
  options,
  onChange,
  hint,
}: SegmentProps<T>) {
  return (
    <div>
      {label && <span className="field-label">{label}</span>}
      <div className="flex rounded-xl border border-ink-200 bg-ink-100/60 p-1">
        {options.map((o) => {
          const actif = o.valeur === valeur;
          return (
            <button
              key={String(o.valeur)}
              type="button"
              aria-pressed={actif}
              onClick={() => onChange(o.valeur)}
              className={[
                'flex-1 rounded-lg px-3 py-2 text-sm font-medium transition',
                actif
                  ? 'bg-white text-ink-900 shadow-sm'
                  : 'text-ink-500 hover:text-ink-800',
              ].join(' ')}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {hint && <p className="field-hint">{hint}</p>}
    </div>
  );
}
