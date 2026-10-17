import * as P from '../lib/parametres2026';
import { eur } from '../lib/format';
import { DEPOT, LIEN_ISSUES, lienNouvelleIssue } from '../lib/depot';

const SOURCES = [
  {
    titre: 'Plafond de la sécurité sociale 2026',
    detail: `Pass ${eur(P.PASS)} par an, ${eur(P.PMSS)} par mois.`,
    url: 'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/plafonds.html',
    hote: 'urssaf.fr',
  },
  {
    titre: 'Taux de cotisations du régime général',
    detail:
      'Maladie 13 %, allocations familiales 5,25 %, vieillesse 8,55 % + 2,11 % patronal. La réduction de taux disparaît au 1ᵉʳ janvier 2026 au profit de la RGDU, dont les mandataires sociaux sont exclus.',
    url: 'https://www.urssaf.fr/accueil/outils-documentation/taux-baremes/taux-cotisations-secteur-prive.html',
    hote: 'urssaf.fr',
  },
  {
    titre: 'Cotisations Agirc-Arrco 2026',
    detail:
      'T1 7,87 % et T2 21,59 %, CEG 2,15 % et 2,70 %, CET 0,35 %, répartis à 60 % employeur et 40 % salarié.',
    url: 'https://reglementation.agirc-arrco.fr/home/baremes/listes-area/baremes-1/cotisations-au-regime-agirc-arrco-en-2026.html',
    hote: 'agirc-arrco.fr',
  },
  {
    titre: "Barème de l'impôt sur le revenu 2026",
    detail:
      'Revenus 2025, tranches revalorisées de 0,9 % par la loi de finances du 19 février 2026 : 0 %, 11 %, 30 %, 41 % et 45 %.',
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F1419',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: "Taux d'impôt sur les sociétés",
    detail: `15 % jusqu'à ${eur(P.IS_SEUIL_TAUX_REDUIT)} de bénéfice pour les PME éligibles, 25 % au-delà.`,
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F23575',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: 'Repère de marché : baromètre Malt',
    detail: `La valeur proposée par défaut correspond à un tarif journalier de ${eur(P.TJM_MOYEN_REFERENCE)} — la moyenne tech constatée par Malt — sur ${P.JOURS_FACTURES_REFERENCE} jours facturés, moins 10 % de frais. Cette base de jours suppose une année pleine : comptez plutôt 180 à 216 jours en pratique.`,
    url: 'https://www.malt.fr/t/barometre-tarifs/tech/',
    hote: 'malt.fr',
  },
  {
    titre: 'Taux de prélèvement à la source',
    detail:
      "Taux = impôt au barème × (revenus dans le champ / revenu imposable), rapporté à l'assiette de l'article 204 F — le net imposable avant déduction de 10 %. Arrondi à la décimale la plus proche.",
    url: 'https://bofip.impots.gouv.fr/bofip/11247-PGP.html/identifiant=BOI-IR-PAS-20-20-10-20240618',
    hote: 'bofip.impots.gouv.fr',
  },
  {
    titre: 'Imposition des dividendes',
    detail:
      "Prélèvement forfaitaire unique de 31,4 % : 12,8 % d'impôt sur le revenu et 18,6 % de prélèvements sociaux. Ou barème progressif après abattement de 40 %, sur option globale.",
    url: 'https://entreprendre.service-public.gouv.fr/actualites/A18796',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: 'Hausse de la CSG sur le capital mobilier',
    detail:
      "L'article 12 de la LFSS 2026 porte la CSG sur les revenus du capital mobilier de 9,2 % à 10,6 %, soit 18,6 % de prélèvements sociaux au total. Les revenus d'activité, l'assurance-vie et les revenus fonciers ne sont pas concernés.",
    url: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000051917000',
    hote: 'legifrance.gouv.fr',
  },
  {
    titre: 'Plafond partagé entre plusieurs employeurs',
    detail:
      "Quand une même personne est payée par plusieurs employeurs, chacun applique le plafond × (son salaire / total des salaires). La règle vaut pour le mandataire social qui garde un emploi ailleurs.",
    url: 'https://boss.gouv.fr/portail/accueil/regles-dassujettissement/assiette-generale.html',
    hote: 'boss.gouv.fr',
  },
  {
    titre: "Crédit d'impôt emploi à domicile",
    detail: `50 % des dépenses de services à la personne, aides reçues déduites, dans la limite de ${eur(P.CI_SAP_PLAFOND)} (jusqu'à ${eur(P.CI_SAP_PLAFOND_MAJORE_MAX)} avec majorations, ${eur(P.CI_SAP_PLAFOND_PREMIERE_ANNEE_MAX)} la première année, ${eur(P.CI_SAP_PLAFOND_INVALIDITE)} en cas d'invalidité). Le CESU préfinancé réduit donc le crédit tant que les dépenses restent sous le plafond.`,
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F12',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: 'Plafond de déduction du PER individuel',
    detail: `10 % des revenus d'activité de l'année précédente nets de frais professionnels, entre ${eur(P.PER_PLAFOND_MINIMUM)} et ${eur(P.PER_PLAFOND_MAXIMUM)} en 2026, majoré des plafonds non utilisés des années précédentes : le total figure sur l'avis d'impôt.`,
    url: 'https://www.service-public.gouv.fr/particuliers/vosdroits/F34982',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: 'Épargne salariale et président de SASU',
    detail:
      "Intéressement, participation et abondement sont déductibles du bénéfice, exonérés de cotisations et de forfait social sous 50 salariés, mais soumis à la CSG-CRDS. Le président n'y a accès que si la société emploie au moins un salarié en plus de lui.",
    url: 'https://entreprendre.service-public.gouv.fr/vosdroits/F2140',
    hote: 'service-public.gouv.fr',
  },
  {
    titre: 'CESU préfinancé pour un président sans salarié',
    detail: `Aide aux services à la personne exonérée de cotisations, de CSG et d'impôt jusqu'à ${eur(P.PLAFOND_AIDE_SERVICES_PERSONNE)} par an en 2026. Dans une société sans salarié, le président peut se l'allouer « sans autre condition » ; elle se déduit de la base du crédit d'impôt emploi à domicile.`,
    url: 'https://bofip.impots.gouv.fr/bofip/1022-PGP.html/identifiant%3DBOI-BIC-CHG-40-50-10-20170705',
    hote: 'bofip.impots.gouv.fr',
  },
  {
    titre: "CSG-CRDS sur l'épargne salariale",
    detail:
      "9,7 % sur la totalité du montant : intéressement, participation, abondements et chèques-vacances des entreprises de moins de 50 salariés sont exclus de l'abattement de 1,75 %.",
    url: 'https://boss.gouv.fr/portail/accueil/regles-dassujettissement/assiette-generale.html',
    hote: 'boss.gouv.fr',
  },
];

const HYPOTHESES = [
  "Le président est affilié au régime général en qualité d'assimilé salarié, sans contrat de travail : il ne cotise ni à l'assurance chômage ni à l'AGS, et ne bénéficie pas de la réduction générale dégressive unique.",
  "Sa rémunération est traitée comme celle d'un cadre : Apec et CET sont retenues.",
  "La rémunération d'un mandataire social sans contrat de travail est exclue de l'assiette de la taxe d'apprentissage et de la contribution à la formation professionnelle.",
  "L'abattement de 1,75 % sur l'assiette CSG-CRDS est plafonné à 4 Pass, la fraction supérieure étant soumise sur 100 % du brut.",
  "Le crédit d'impôt emploi à domicile appartient au foyer, avec ou sans la société : seule la part de crédit que fait perdre le CESU préfinancé est imputée à la SASU. Les sous-plafonds par activité (jardinage, informatique, bricolage) ne sont pas contrôlés.",
  "Les versements sur un PER individuel sont déduits du seul revenu imposé au barème : les dividendes soumis à la flat tax n'en profitent pas. Le plafond est celui du président ; la mutualisation avec celui du conjoint n'est pas modélisée.",
  "L'épargne salariale saisie est supposée placée sur un plan d'épargne, donc exonérée d'impôt sur le revenu, et versée par une société de moins de 50 salariés, donc sans forfait social. Les autres avantages sont supposés rester dans leurs limites d'exonération.",
  "L'impôt sur le revenu est calculé sur la seule année simulée : la CSG déductible sur dividendes est imputée sur la même année, alors qu'elle l'est en pratique l'année suivante.",
  "Le taux de prélèvement à la source affiché est celui qui correspondrait à la situation simulée. Le taux réellement appliqué par l'Urssaf est calculé sur vos dernières déclarations et actualisé en septembre : il est donc en décalage d'un à deux ans. Tant que l'administration n'a transmis aucun taux — le cas d'une société qui vient d'être créée — c'est la grille de taux par défaut qui s'applique.",
  "Le taux de prélèvement à la source est celui du foyer : il porte sur la rémunération de président et sur un éventuel salaire extérieur, la retenue affichée n'étant que la part opérée par la SASU. Les revenus du conjoint saisis en « autres revenus » ne sont en revanche pas comptés dans son assiette.",
  "En cas de cumul avec un emploi extérieur, le plafond de la sécurité sociale est réparti entre les employeurs au prorata des salaires versés : chacun ne plafonne qu'à sa part. Dès que le total dépasse le plafond, la tranche 2 et la CET s'appliquent des deux côtés. L'effet sur la fiche de paie extérieure est imputé à la rémunération versée par la SASU, qui en est la cause.",
  "L'impôt sur le revenu attribué à la rémunération de président est l'impôt supplémentaire qu'elle provoque, le reste du foyer étant tenu pour acquis. Un salaire extérieur ou les revenus du conjoint occupent le bas du barème et renchérissent donc la rémunération.",
  "En cas d'option pour le barème, rémunération et dividendes partagent le même barème progressif : l'impôt qu'ils provoquent ensemble est réparti entre eux à parts égales de contribution marginale, chacun étant crédité de la moyenne entre « entrer le premier dans l'assiette » et « entrer le dernier ». Taxer la rémunération en premier lui attribuerait les tranches basses et ferait paraître le salaire artificiellement peu imposé. Ce partage ne change ni le net en poche ni l'optimum, qui ne dépendent que du total.",
  "Les plafonds de cotisation sont proratisés à la durée du mandat : sur six mois d'activité, la tranche 1 s'arrête à six plafonds mensuels. C'est bien la période d'emploi qui proratise le plafond, non le rythme des versements — un président en poste toute l'année conserve un plafond annuel entier, même s'il se rémunère irrégulièrement, grâce à la régularisation progressive.",
  "La rémunération est supposée versée en parts égales sur la période. La régularisation progressive mois par mois n'est pas reproduite : seul le résultat annuel est calculé.",
  "Les dividendes sont décidés en assemblée après approbation des comptes. Les réserves des exercices antérieurs s'ajoutent au distribuable sans repasser par l'impôt sur les sociétés, déjà acquitté lors des exercices d'origine ; la réserve légale, indisponible, n'est pas à saisir.",
  "La contribution exceptionnelle sur les hauts revenus n'est pas calculée. Au-delà de 250 000 € de revenu fiscal de référence pour une personne seule, ou 500 000 € pour un couple, elle ajoute 3 % puis 4 %, y compris sur les dividendes soumis à la flat tax pour leur montant brut. Le simulateur signale le franchissement du seuil mais surestime alors le net en poche.",
];

export function Sources({ lienSimulation }: { lienSimulation?: string }) {
  return (
    <section id="sources" className="scroll-mt-20 bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:py-20">
        <h2 className="text-2xl font-semibold tracking-tight text-white">
          Méthode et sources
        </h2>
        <p className="mt-2 max-w-2xl leading-relaxed text-ink-300">
          Tous les paramètres utilisés dans ce simulateur sont ceux publiés pour{' '}
          {P.ANNEE}. Voici lesquels, et où les vérifier.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <a
              key={s.titre}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="group rounded-2xl border border-white/10 bg-white/5 p-5 transition hover:border-brand-400/50 hover:bg-white/10"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold text-white">{s.titre}</h3>
                <span className="mt-0.5 shrink-0 text-ink-400 transition group-hover:text-brand-300">
                  ↗
                </span>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.detail}</p>
              <p className="mt-3 text-xs text-ink-400">{s.hote}</p>
            </a>
          ))}
        </div>

        <h3 className="mt-14 text-lg font-semibold text-white">
          Hypothèses retenues dans le calcul
        </h3>
        <ul className="mt-4 max-w-3xl space-y-3">
          {HYPOTHESES.map((h) => (
            <li key={h} className="flex gap-3 text-sm leading-relaxed text-ink-300">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-brand-400" />
              {h}
            </li>
          ))}
        </ul>

        <div className="mt-12 max-w-3xl rounded-2xl border border-white/10 bg-white/5 p-6">
          <h3 className="font-semibold text-white">
            Un taux vous paraît faux ? Une idée à proposer ?
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-ink-300">
            Les barèmes bougent à chaque loi de finances, et une valeur périmée ne se
            distingue pas d'une valeur juste. Si un chiffre vous semble erroné,
            signalez-le : avec la référence officielle qui le contredit, la correction
            est immédiate. Le simulateur est ouvert, les contributions aussi.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <a
              href={lienNouvelleIssue(lienSimulation)}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-brand-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-400"
            >
              Signaler une erreur
            </a>
            <a
              href={DEPOT}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-ink-200 transition hover:border-white/30 hover:text-white"
            >
              Voir le code source et contribuer
            </a>
            <a
              href={LIEN_ISSUES}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-white/15 px-4 py-2.5 text-sm font-medium text-ink-200 transition hover:border-white/30 hover:text-white"
            >
              Signalements ouverts
            </a>
          </div>
          <p className="mt-3 text-xs text-ink-400">
            Le rapport est prérempli avec le lien de la simulation affichée, pour que
            le cas se reproduise sans avoir à décrire vos paramètres.
          </p>
        </div>
      </div>
    </section>
  );
}
