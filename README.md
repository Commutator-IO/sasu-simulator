# SASU simulator

Boîte à outils fiscale pour les SASU. Barèmes **2026**.

| Outil | Page | Ce qu'il répond |
| --- | --- | --- |
| **Salaire ou dividendes** | `/` | Quel niveau de rémunération du président laisse le plus d'argent en poche, cotisations, IS et IR payés |
| **Acomptes d'IS** | `/acomptes/` | De combien réduire légalement ses acomptes trimestriels quand le bénéfice baisse |

Le site est statique : chaque outil est une vraie page, avec son propre
`index.html` généré par Vite. GitHub Pages sert `/acomptes/` directement, sans
routeur côté client ni redirection. Les liens internes portent la barre finale,
qui évite un aller-retour de redirection.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm test         # 142 tests sur les moteurs de calcul
npm run build    # build de production
npm run lint
```

## Comment ça marche

Le simulateur part du **résultat de la société avant rémunération du président**
et le répartit selon le curseur de rémunération brute :

```
résultat avant rémunération
  − rémunération brute
  − cotisations patronales            →  coût employeur
  = résultat fiscal
  − impôt sur les sociétés            →  15 % jusqu'à 42 500 €, 25 % au-delà
  = résultat net
  + réserves des exercices antérieurs   →  IS déjà acquitté, pas réimposées
  = distribuable
  → dividendes bruts (part distribuée) et réserves conservées
```

Puis, côté dirigeant :

- le **salaire** subit les cotisations salariales, la CSG-CRDS, puis le barème
  progressif de l'impôt sur le revenu après abattement de 10 % ;
- les **dividendes** subissent 18,6 % de prélèvements sociaux et, au choix,
  12,8 % d'impôt forfaitaire — soit un PFU à **31,4 %** — ou le barème
  progressif après abattement de 40 %.

> **La flat tax n'est plus à 30 %.** L'article 12 de la LFSS 2026 (loi
> n° 2025-1403 du 30 décembre 2025) porte la CSG sur le capital mobilier de
> 9,2 % à 10,6 %, ce qui fait passer les prélèvements sociaux de 17,2 % à
> 18,6 % et le PFU de 30 % à 31,4 %. La hausse ne touche **que** le capital
> mobilier : les revenus d'activité restent à 9,2 % de CSG, et
> l'assurance-vie, les PEL-CEL et les revenus fonciers restent à 17,2 %. La
> fraction de CSG déductible en cas d'option pour le barème reste à 6,8 points.
>
> Conséquence pratique : l'option pour le barème progressif est désormais
> gagnante plus longtemps — jusqu'aux alentours de 200 000 € de résultat pour
> un célibataire, contre nettement moins avant la réforme.

Le **taux de prélèvement à la source** du foyer est déduit de ce calcul
(CGI art. 204 H) :

```
        impôt au barème × (revenus dans le champ / revenu imposable)
taux = ─────────────────────────────────────────────────────────────
              assiette du prélèvement (CGI art. 204 F)
```

Le piège classique est l'assiette : celle du prélèvement est le net imposable
**avant** la déduction forfaitaire de 10 %, alors que le revenu déclaré est
pris après. Confondre les deux surcollecte d'environ 11 %. Les dividendes ne
sont pas dans le champ du prélèvement à la source : la société retient à leur
place un prélèvement forfaitaire non libératoire de 12,8 %, imputable sur
l'impôt de l'année suivante.

Le net en poche est la somme des deux, nette d'impôt. La courbe balaye tous les
niveaux de rémunération finançables et affine l'optimum autour du meilleur
point.

## Déploiement

Le site est publié sur [sasu.commutator.io](http://sasu.commutator.io/) par
[la GitHub Action](.github/workflows/deploy.yml), à chaque poussée sur `main` :
lint, tests, build, puis déploiement. Les pull requests passent les mêmes
contrôles mais ne déploient pas.

Le domaine étant personnalisé, le site est servi **à la racine** et les URL
d'assets ne sont pas préfixées. Sans domaine personnalisé, un site de projet
vit sous `/<dépôt>/` et le build a besoin de `BASE_PATH=/<dépôt>/`.

## Partage d'une simulation

Le site est entièrement statique : il n'y a ni base de données ni identifiant
de simulation. L'état tient donc dans l'URL, en « query string », et le bouton
« Copier le lien » produit une adresse qui rouvre la simulation à l'identique.

```
?resultat=180000&brut=31000&mois=7&parts=3&couple=1&salaireExterne=24000
```

Deux règles gouvernent ce format :

- **Seuls les écarts aux valeurs par défaut sont écrits.** Les liens restent
  courts, et surtout un changement de valeur par défaut ne se retrouve pas figé
  dans les liens déjà partagés.
- **Tout ce qui est relu est borné.** L'URL est une donnée non maîtrisée : les
  valeurs non numériques, négatives, infinies ou démesurées retombent sur la
  valeur par défaut, et une rémunération que la société ne peut pas financer
  est ramenée au maximum possible.

Le fragment (`#`) est laissé aux ancres de navigation, d'où le choix de la
query string. L'URL est mise à jour par `replaceState` : elle suit l'état sans
empiler une entrée d'historique à chaque cran du curseur.

## Architecture

| Fichier | Rôle |
| --- | --- |
| [src/lib/parametres2026.ts](src/lib/parametres2026.ts) | Tous les taux, plafonds et barèmes, avec leurs sources en commentaire. **Le seul fichier à toucher pour passer à 2027.** |
| [src/lib/simulation.ts](src/lib/simulation.ts) | Moteur salaire / dividendes, sans dépendance ni React |
| [src/lib/acomptes.ts](src/lib/acomptes.ts) | Moteur des acomptes d'IS, qui réutilise le calcul d'IS du premier |
| [src/lib/*.test.ts](src/lib/) | Tests des moteurs |
| [src/components/Cadre.tsx](src/components/Cadre.tsx) | En-tête à onglets et pied de page, partagés par les outils |
| [src/lib/url.ts](src/lib/url.ts) | Sérialisation de la simulation dans l'URL, pour le partage |
| [src/components/](src/components/) | Curseurs et champs, courbe SVG, ruban de répartition, détail du calcul, sources |
| [src/App.tsx](src/App.tsx) | Page du simulateur |

Le moteur est volontairement isolé de l'interface : il est testable seul et
réutilisable pour les prochains outils.

### Contrôle de cohérence

Le test central vérifie que rien ne se perd en route :

```
net en poche + réserves + prélèvements
      = résultat avant rémunération + réserves antérieures apportées
```

Toute erreur d'assiette ou de double comptage casse cette égalité. Elle est
vérifiée sous flat tax comme au barème, avec et sans autres revenus.

## Paramètres 2026 retenus

| Paramètre | Valeur |
| --- | --- |
| Pass | 48 060 € par an, 4 005 € par mois |
| Maladie (patronal) | 13 % |
| Allocations familiales (patronal) | 5,25 % |
| Vieillesse | 8,55 % + 2,11 % patronal, 6,90 % + 0,40 % salarial |
| Agirc-Arrco | T1 7,87 %, T2 21,59 %, réparti 60 / 40 |
| CEG / CET | 2,15 % et 2,70 % / 0,35 % |
| CSG-CRDS | 9,70 % sur 98,25 % du brut, abattement plafonné à 4 Pass |
| Impôt sur les sociétés | 15 % jusqu'à 42 500 €, 25 % au-delà |
| Barème IR | 0 / 11 / 30 / 41 / 45 % — seuils 11 600, 29 579, 84 577, 181 917 € |
| Flat tax (PFU) | 12,8 % + 18,6 % = **31,4 %** |
| CSG sur capital mobilier | 10,6 %, dont 6,8 points déductibles au barème |
| Dispense de l'acompte de 12,8 % | RFR < 50 000 € seul, < 75 000 € en couple |
| Smic | 11,88 € de l'heure au 1ᵉʳ janvier 2026 |

Le président de SASU est un assimilé salarié **sans assurance chômage** et,
n'étant pas titulaire d'un contrat de travail, il est exclu de la réduction
générale dégressive unique qui remplace la réduction Fillon au 1ᵉʳ janvier 2026 :
les taux maladie et allocations familiales s'appliquent donc à leur niveau de
droit commun quelle que soit la rémunération.

Les sources sont listées en bas de page dans l'application, et référencées en
commentaire dans `parametres2026.ts`.

## Limites connues

- Hors CFE, mutuelle, prévoyance et frais de tenue de comptabilité.
- La CSG déductible sur dividendes est imputée sur l'année simulée, alors
  qu'elle l'est en pratique l'année suivante.
- Pas de crédits ni de réductions d'impôt, pas de PER, pas d'épargne salariale.
- La contribution exceptionnelle sur les hauts revenus n'est pas calculée. Le
  simulateur signale le franchissement du seuil de revenu fiscal de référence
  et prévient qu'il surestime alors le net en poche.
- Le taux de prélèvement à la source affiché est celui qui correspondrait à
  l'année simulée. Le taux réel est assis sur les dernières déclarations et
  actualisé en septembre : il est en décalage d'un à deux ans. La grille de
  taux par défaut, applicable tant qu'aucun taux n'a été transmis, n'est pas
  implémentée.
- Le taux suppose que la rémunération du président est le seul revenu du foyer
  dans le champ du prélèvement à la source.
- Rémunération supposée régulière sur douze mois, sans régularisation
  progressive des plafonds.

## Prochains outils envisagés

Glossaire, comparateur de comptables en ligne, annuaire des plateformes de
freelance, agrégateur de webinaires — voir [TODO.md](TODO.md).
