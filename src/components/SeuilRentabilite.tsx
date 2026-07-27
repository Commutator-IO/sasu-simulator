import { useMemo } from 'react';
import { eur } from '../lib/format';
import { Segments } from './Champs';
import { DEFAUTS_ARBITRAGE } from '../lib/arbitrage';
import { netEnPocheSalaire, seuilRentabilite } from '../lib/rentabilite';
import * as P from '../lib/parametres2026';

/**
 * How much the company has to invoice for the president to live on it.
 *
 * The target is either a take-home figure or the CDI gross it should match —
 * the comparison most people actually have in mind when they weigh going
 * freelance. Everything below is the arbitration engine read backwards, at the
 * best salary/dividend split for each level of profit.
 */
export function SeuilRentabilite({
  mode,
  cible,
  jours,
  tjm,
  onMode,
  onCible,
  onJours,
}: {
  mode: 'net' | 'cdi';
  cible: number;
  jours: number;
  /** The user's own day rate, to express the threshold in billable days. */
  tjm: number;
  onMode: (m: 'net' | 'cdi') => void;
  onCible: (v: number) => void;
  onJours: (v: number) => void;
}) {
  const base = DEFAUTS_ARBITRAGE;

  const { net, seuil } = useMemo(() => {
    const n = mode === 'cdi' ? netEnPocheSalaire(cible, base) : cible;
    return { net: n, seuil: seuilRentabilite(n, base, { jours, tjm }) };
  }, [mode, cible, jours, tjm, base]);

  const marge = tjm > 0 && seuil.joursNecessaires ? jours - seuil.joursNecessaires : null;

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Segments
          label="Votre objectif"
          valeur={mode}
          options={[
            { valeur: 'cdi' as const, label: 'Salaire CDI' },
            { valeur: 'net' as const, label: 'Net en poche' },
          ]}
          onChange={onMode}
        />
        <label className="block">
          <span className="field-label">
            {mode === 'cdi' ? 'Brut annuel à égaler' : 'Net en poche visé'}
          </span>
          <input
            type="number"
            inputMode="numeric"
            value={cible || ''}
            onChange={(e) => onCible(Number(e.target.value))}
            className="tabular mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <span className="field-hint">
            {mode === 'cdi'
              ? `Soit ${eur(Math.round(net))} net en poche, une fois cotisations et impôt payés.`
              : 'Ce qu’il vous reste après cotisations et impôt.'}
          </span>
        </label>
        <label className="block">
          <span className="field-label">Jours facturés par an</span>
          <input
            type="number"
            inputMode="numeric"
            value={jours || ''}
            onChange={(e) => onJours(Number(e.target.value))}
            className="tabular mt-1 w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100"
          />
          <span className="field-hint">
            Rarement plus de 216 : congés, intercontrats et avant-vente.
          </span>
        </label>
      </div>

      {seuil.horsAtteinte ? (
        <p className="mt-6 rounded-xl bg-gold-50 p-4 text-sm text-ink-700">
          Cet objectif dépasse ce que le simulateur sait modéliser. Vérifiez le
          montant saisi.
        </p>
      ) : (
        <>
          <dl className="mt-6 grid gap-3 sm:grid-cols-3">
            <Chiffre
              libelle="Chiffre d'affaires nécessaire"
              valeur={eur(Math.round(seuil.caNecessaire))}
              principal
            />
            <Chiffre
              libelle={`TJM nécessaire sur ${Math.round(jours)} jours`}
              valeur={eur(Math.round(seuil.tjmNecessaire))}
            />
            <Chiffre
              libelle="Résultat avant rémunération"
              valeur={eur(Math.round(seuil.resultatNecessaire))}
            />
          </dl>

          {tjm > 0 && seuil.joursNecessaires !== null && (
            <p className="mt-5 text-sm leading-relaxed text-ink-600">
              À votre TJM de <strong className="text-ink-900">{eur(tjm)}</strong>, il
              vous faut{' '}
              <strong className="text-ink-900">
                {Math.ceil(seuil.joursNecessaires)} jours facturés
              </strong>{' '}
              pour atteindre {eur(Math.round(net))} net en poche
              {marge !== null && (
                <>
                  {' '}
                  — soit{' '}
                  <strong className={marge >= 0 ? 'text-brand-700' : 'text-gold-700'}>
                    {marge >= 0
                      ? `${Math.floor(marge)} jours de marge`
                      : `${Math.ceil(-marge)} jours de trop`}
                  </strong>{' '}
                  sur les {Math.round(jours)} que vous visez
                </>
              )}
              .
            </p>
          )}

          <p className="field-hint mt-3">
            Au meilleur arbitrage salaire/dividendes pour ce niveau de résultat, avec
            les hypothèses par défaut du simulateur (célibataire, une part, pas
            d'autres revenus) et des frais de {Math.round(P.TAUX_FRAIS_REFERENCE * 100)}
            &nbsp;% du chiffre d'affaires. Ajustez votre situation dans l'onglet
            «&nbsp;Salaire ou dividendes&nbsp;».
          </p>
        </>
      )}
    </div>
  );
}

function Chiffre({
  libelle,
  valeur,
  principal,
}: {
  libelle: string;
  valeur: string;
  principal?: boolean;
}) {
  return (
    <div
      className={[
        'rounded-xl border p-4',
        principal ? 'border-brand-200 bg-brand-50' : 'border-ink-200 bg-white',
      ].join(' ')}
    >
      <dt className="text-xs text-ink-500">{libelle}</dt>
      <dd
        className={[
          'tabular mt-1 font-semibold',
          principal ? 'text-xl text-brand-800' : 'text-lg text-ink-900',
        ].join(' ')}
      >
        {valeur}
      </dd>
    </div>
  );
}
