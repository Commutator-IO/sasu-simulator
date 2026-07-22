import { useState } from 'react';
import { eur, tauxPct } from '../lib/format';
import type { Resultat } from '../lib/simulation';
import * as P from '../lib/parametres2026';

function Ligne({
  label,
  montant,
  fort = false,
  negatif = false,
  note,
}: {
  label: string;
  montant: number;
  fort?: boolean;
  negatif?: boolean;
  note?: string;
}) {
  return (
    <div
      className={[
        'flex items-baseline justify-between gap-4 py-2',
        fort ? 'border-t border-ink-200 pt-3 font-semibold text-ink-900' : 'text-ink-600',
      ].join(' ')}
    >
      <span className="text-sm">
        {label}
        {note && <span className="ml-1.5 text-xs text-ink-400">{note}</span>}
      </span>
      <span
        className={[
          'tabular shrink-0 text-sm',
          fort ? 'text-base' : '',
          negatif ? 'text-ink-500' : '',
        ].join(' ')}
      >
        {negatif ? `− ${eur(Math.abs(montant))}` : eur(montant)}
      </span>
    </div>
  );
}

function Bloc({
  titre,
  sousTitre,
  children,
}: {
  titre: string;
  sousTitre?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="card p-6">
      <h3 className="text-base font-semibold text-ink-900">{titre}</h3>
      {sousTitre && <p className="mt-0.5 mb-3 text-sm text-ink-400">{sousTitre}</p>}
      <div className={sousTitre ? '' : 'mt-3'}>{children}</div>
    </section>
  );
}

export function Detail({ r }: { r: Resultat }) {
  const [tableauOuvert, setTableauOuvert] = useState(false);

  const cotisationsHorsCSG = r.lignes.filter((l) => l.famille !== 'CSG-CRDS');
  const csg = r.lignes.filter((l) => l.famille === 'CSG-CRDS');

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Bloc
        titre="Du résultat aux dividendes"
        sousTitre="Ce que la société paie et ce qu'elle peut distribuer"
      >
        <Ligne label="Résultat avant rémunération du président" montant={r.resultatAvantRemuneration} />
        <Ligne label="Rémunération brute" montant={r.brutAnnuel} negatif />
        <Ligne label="Cotisations patronales" montant={r.cotisationsPatronales} negatif />
        <Ligne label="Résultat fiscal" montant={r.resultatFiscal} fort />
        <Ligne
          label="Impôt sur les sociétés"
          montant={r.is}
          negatif
          note={
            r.resultatFiscal > 0
              ? `taux effectif ${tauxPct(Number(((r.is / r.resultatFiscal) * 100).toFixed(1)))}`
              : undefined
          }
        />
        <Ligne label="Résultat net" montant={r.resultatNet} fort />
        {r.reservesAnterieures > 0 && (
          <>
            <Ligne
              label="Réserves des exercices antérieurs"
              montant={r.reservesAnterieures}
              note="IS déjà acquitté"
            />
            <Ligne label="Distribuable" montant={r.distribuable} fort />
          </>
        )}
        <Ligne label="Mis en réserve" montant={r.reserves} negatif />
        <Ligne label="Dividendes bruts distribués" montant={r.dividendesBruts} fort />
      </Bloc>

      <Bloc titre="Votre rémunération" sousTitre="Du brut au net avant impôt sur le revenu">
        <Ligne label="Rémunération brute" montant={r.brutAnnuel} />
        <Ligne
          label="Cotisations salariales"
          montant={cotisationsHorsCSG.reduce((s, l) => s + l.salarial, 0)}
          negatif
        />
        <Ligne label="CSG et CRDS" montant={r.csgCrds} negatif />
        <Ligne label="Salaire net avant impôt" montant={r.salaireNet} fort />
        <Ligne
          label="Net imposable, assiette du prélèvement à la source"
          montant={r.assiettePAS}
          note="avant abattement"
        />
        <Ligne
          label="Prélèvement à la source retenu"
          montant={r.prelevementAnnuelPAS}
          negatif
          note={tauxPct(Number((r.tauxPAS * 100).toFixed(1)))}
        />
        <Ligne
          label="Impôt sur le revenu imputable à cette rémunération"
          montant={r.irSurSalaire}
          negatif
        />
        <Ligne label="Salaire net après impôt" montant={r.salaireNet - r.irSurSalaire} fort />

        {Math.abs(r.prelevementAnnuelPAS - r.irSurSalaire) > 20 && (
          <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-500">
            Les deux montants diffèrent de{' '}
            {eur(Math.abs(r.prelevementAnnuelPAS - r.irSurSalaire))} : le prélèvement à
            la source est un acompte calculé au taux du foyer, alors que l'impôt
            imputable à cette rémunération tient compte de vos autres ressources, qui
            occupent déjà le bas du barème.{' '}
            {r.prelevementAnnuelPAS < r.irSurSalaire
              ? "La déclaration de revenus réclamera le complément."
              : "La déclaration de revenus vous en restituera l'excédent."}
          </p>
        )}

        <div className="mt-4 rounded-xl bg-ink-50 p-4">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-sm text-ink-600">Sur votre bulletin de paie</span>
            <span className="tabular text-lg font-semibold text-ink-900">
              {eur(r.salaireNet / r.moisRemuneration - r.prelevementMensuelPAS)} / mois
            </span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
            {eur(r.salaireNet / r.moisRemuneration)} de net à payer, moins{' '}
            {eur(r.prelevementMensuelPAS)} de prélèvement à la source au taux de{' '}
            {tauxPct(Number((r.tauxPAS * 100).toFixed(1)))}, appliqué à une assiette de{' '}
            {eur(r.assiettePAS / r.moisRemuneration)} — le net imposable, retenu{' '}
            <em>avant</em> l'abattement de 10 %.
            {r.moisRemuneration < 12 &&
              ` Sur ${r.moisRemuneration} paies dans l'année.`}
          </p>
        </div>
      </Bloc>

      <Bloc titre="Vos dividendes" sousTitre="Après impôt sur les sociétés déjà acquitté">
        <Ligne label="Dividendes bruts" montant={r.dividendesBruts} />
        <Ligne
          label="Prélèvements sociaux"
          montant={r.prelevementsSociauxDividendes}
          negatif
          note={tauxPct(Number((P.PRELEVEMENTS_SOCIAUX * 100).toFixed(1)))}
        />
        <Ligne label="Impôt sur le revenu" montant={r.irDividendes} negatif />
        <Ligne label="Dividendes nets" montant={r.dividendesNets} fort />
        {r.dividendesBruts > 0 && (
          <>
            <p className="mt-3 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-500">
              Chaque euro de dividende a déjà supporté l'impôt sur les sociétés :{' '}
              {eur(r.dividendesBruts)} de dividendes bruts ont coûté{' '}
              {eur(r.is * (r.dividendesBruts / Math.max(1, r.resultatNet)))} d'IS en
              amont, avant les {eur(r.prelevementsSociauxDividendes + r.irDividendes)}{' '}
              prélevés ensuite chez vous.
            </p>
            <p className="mt-2 rounded-lg bg-ink-50 px-3 py-2 text-xs leading-relaxed text-ink-500">
              Les dividendes échappent au prélèvement à la source, mais pas à toute
              retenue : la société prélève{' '}
              {eur(r.dividendesBruts * P.PFU_IR + r.prelevementsSociauxDividendes)} au
              moment du versement — 12,8 % d'acompte d'impôt sur le revenu et{' '}
              {tauxPct(Number((P.PRELEVEMENTS_SOCIAUX * 100).toFixed(1)))} de
              prélèvements sociaux. L'acompte est un prélèvement forfaitaire{' '}
              <em>non libératoire</em> : il s'impute sur l'impôt de l'année suivante, et
              l'excédent vous est restitué. Vous pouvez en demander la dispense si votre
              revenu fiscal de référence est inférieur à{' '}
              {eur(P.DISPENSE_PFNL_CELIBATAIRE)} pour une personne seule ou{' '}
              {eur(P.DISPENSE_PFNL_COUPLE)} pour un couple.
            </p>
          </>
        )}
      </Bloc>

      <Bloc titre="Ce que le salaire vous ouvre" sousTitre="Droits acquis sur l'année">
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-xl bg-brand-50 p-4">
            <div className="tabular text-2xl font-semibold text-brand-700">
              {r.trimestresValides}
              <span className="text-base font-normal text-brand-600">/4</span>
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              trimestres de retraite validés
              <br />
              <span className="text-ink-400">
                {r.trimestresExterne > 0
                  ? `dont ${r.trimestresExterne} par votre emploi extérieur`
                  : `4 trimestres dès ${eur(4 * P.BRUT_PAR_TRIMESTRE)} de brut`}
              </span>
            </p>
          </div>
          <div className="rounded-xl bg-brand-50 p-4">
            <div className="tabular text-2xl font-semibold text-brand-700">
              {Math.round(r.pointsAgircArrco)}
            </div>
            <p className="mt-0.5 text-xs text-ink-500">
              points Agirc-Arrco acquis via la SASU
              <br />
              <span className="text-ink-400">
                soit {eur(r.retraiteComplementaireAnnuelle)} de rente annuelle future
              </span>
            </p>
          </div>
        </div>
        <p className="mt-4 text-xs leading-relaxed text-ink-500">
          Les dividendes n'ouvrent aucun droit : ni retraite, ni indemnités journalières,
          ni prévoyance. Le président de SASU ne cotise pas à l'assurance chômage, quelle
          que soit sa rémunération.
        </p>
      </Bloc>

      <div className="lg:col-span-2">
        <button
          type="button"
          onClick={() => setTableauOuvert((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-ink-200 bg-white px-5 py-4 text-left transition hover:border-ink-300"
        >
          <span className="text-sm font-medium text-ink-800">
            Détail ligne à ligne des cotisations sociales
          </span>
          <span className="text-sm text-ink-400">
            {tableauOuvert ? 'Masquer' : 'Afficher'}
          </span>
        </button>

        {tableauOuvert && (
          <div className="card mt-3 overflow-x-auto p-1">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-ink-200 text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-3 font-medium">Cotisation</th>
                  <th className="px-4 py-3 text-right font-medium">Base</th>
                  <th className="px-4 py-3 text-right font-medium">Taux pat.</th>
                  <th className="px-4 py-3 text-right font-medium">Patronal</th>
                  <th className="px-4 py-3 text-right font-medium">Taux sal.</th>
                  <th className="px-4 py-3 text-right font-medium">Salarial</th>
                </tr>
              </thead>
              <tbody>
                {[...cotisationsHorsCSG, ...csg].map((l) => (
                  <tr key={l.libelle} className="border-b border-ink-100 last:border-0">
                    <td className="px-4 py-2.5 text-ink-700">
                      {l.libelle}
                      {l.note && (
                        <span className="block text-xs text-ink-400">{l.note}</span>
                      )}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-500">
                      {eur(Math.max(l.basePatronale, l.baseSalariale))}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-500">
                      {l.tauxPatronal ? tauxPct(l.tauxPatronal) : '—'}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-800">
                      {l.patronal ? eur(l.patronal) : '—'}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-500">
                      {l.tauxSalarial ? tauxPct(l.tauxSalarial) : '—'}
                    </td>
                    <td className="tabular px-4 py-2.5 text-right text-ink-800">
                      {l.salarial ? eur(l.salarial) : '—'}
                    </td>
                  </tr>
                ))}
                <tr className="bg-ink-50 font-semibold">
                  <td className="px-4 py-3 text-ink-900">Total</td>
                  <td />
                  <td />
                  <td className="tabular px-4 py-3 text-right text-ink-900">
                    {eur(r.cotisationsPatronales)}
                  </td>
                  <td />
                  <td className="tabular px-4 py-3 text-right text-ink-900">
                    {eur(r.cotisationsSalariales)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
