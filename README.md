# SASU simulator

Boîte à outils d'optimisation fiscale pour les SASU. Premier outil livré : le
**simulateur salaire / dividendes**, qui cherche le niveau de rémunération du
président laissant le plus d'argent en poche, une fois payés les cotisations
sociales, l'impôt sur les sociétés et l'impôt sur le revenu.

Barèmes **2026**.

## Démarrer

```bash
npm install
npm run dev      # serveur de développement
npm test         # 36 tests sur le moteur de calcul
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
  → dividendes bruts (part distribuée) et réserves
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

## Architecture

| Fichier | Rôle |
| --- | --- |
| [src/lib/parametres2026.ts](src/lib/parametres2026.ts) | Tous les taux, plafonds et barèmes, avec leurs sources en commentaire. **Le seul fichier à toucher pour passer à 2027.** |
| [src/lib/simulation.ts](src/lib/simulation.ts) | Moteur de calcul, sans dépendance ni React |
| [src/lib/simulation.test.ts](src/lib/simulation.test.ts) | Tests du moteur |
| [src/components/](src/components/) | Curseurs et champs, courbe SVG, ruban de répartition, détail du calcul, sources |
| [src/App.tsx](src/App.tsx) | Page du simulateur |

Le moteur est volontairement isolé de l'interface : il est testable seul et
réutilisable pour les prochains outils.

### Contrôle de cohérence

Le test central vérifie que rien ne se perd en route :

```
net en poche + réserves + prélèvements = résultat avant rémunération
```

Toute erreur d'assiette ou de double comptage casse cette égalité.

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
