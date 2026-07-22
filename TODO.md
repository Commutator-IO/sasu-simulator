# Feuille de route

Ce dépôt a vocation à devenir une boîte à outils pour les freelances en SASU,
pas seulement un simulateur. Le premier outil — l'arbitrage salaire /
dividendes — est en ligne ; voici ce qui viendrait ensuite.

Le moteur de calcul ([src/lib/simulation.ts](src/lib/simulation.ts)) est
volontairement séparé de l'interface : les prochains outils doivent pouvoir le
réutiliser sans le dupliquer.

---

## Veille sur l'évolution de la législation

**Priorité haute.** Un simulateur fiscal qui affiche un barème périmé est pire
qu'inexistant : il inspire confiance tout en donnant un mauvais conseil.

**Le cas d'école.** Pendant le développement, la flat tax était calculée à
30 %. Or l'article 12 de la LFSS 2026 avait porté la CSG sur le capital
mobilier de 9,2 % à 10,6 %, donc le PFU de 30 % à 31,4 %. L'écart aurait été
d'environ 1 000 € sur une simulation courante, et surtout le point de bascule
entre flat tax et barème progressif se serait déplacé de plusieurs dizaines de
milliers d'euros — soit une recommandation inversée pour toute une catégorie
de profils.

Corrigé avant la mise en ligne, donc jamais publié. Mais le taux avait tenu
plusieurs itérations sans que rien ne le signale, et c'est une relecture
humaine qui l'a arrêté, pas un garde-fou. La prochaine fois, ce sera peut-être
après la publication.

**Ce qui a rendu l'erreur possible, et qui reste à corriger.**

- Le taux était écrit en dur à quatre endroits de l'interface, en plus de la
  constante. Les libellés dérivent désormais des constantes ; il faut tenir
  cette règle et ne jamais réintroduire un taux littéral dans du JSX.
- Rien n'indique **quand** un paramètre a été vérifié pour la dernière fois. Un
  chiffre juste et un chiffre périmé se ressemblent.
- Rien ne signale à l'utilisateur l'ancienneté des données.

**Pistes.**

- Attacher à chaque paramètre une date de dernière vérification et l'URL de sa
  source, plutôt que de laisser l'information en commentaire libre. Un simple
  objet `{ valeur, source, verifieLe }` suffirait, et permettrait d'afficher
  « barèmes vérifiés le … » en pied de page.
- Un job planifié qui échoue au-delà d'un certain âge de vérification, pour
  transformer l'oubli en alerte.
- Surveiller les textes plutôt que les blogs : le PLF et le PLFSS à l'automne,
  la publication au JO fin décembre puis en février, les taux Urssaf au
  1ᵉʳ janvier, la revalorisation Agirc-Arrco en novembre, le Pass en décembre.
  Les sites d'actualité fiscale relaient souvent des amendements qui ne
  survivent pas au vote — le seuil d'IS réduit relevé à 100 000 € en est un
  exemple, annoncé partout et jamais adopté.
- Écrire les tests de manière à ce qu'ils cassent quand un taux change sans que
  son libellé suive, plutôt que de simplement recopier la constante.

**Calendrier à surveiller.**

| Période | Ce qui bouge |
| --- | --- |
| Septembre – octobre | Dépôt du PLF et du PLFSS |
| Fin décembre | Adoption et publication au JO ; taux Urssaf au 1ᵉʳ janvier |
| Décembre | Pass de l'année suivante |
| Novembre | Paramètres Agirc-Arrco |
| Janvier et juin | Revalorisations du Smic |
| Avril – juin | Barème IR définitif et campagne déclarative |

**Passage à 2027.** Ne toucher qu'à
[src/lib/parametres2026.ts](src/lib/parametres2026.ts), puis renommer le
fichier. C'est la contrainte d'architecture à préserver : si un taux se met à
vivre ailleurs, la veille devient ingérable.

---

## Glossaire

Un lexique des termes qui reviennent partout dans le simulateur et que
personne n'explique jamais vraiment.

**Pourquoi.** L'utilisateur type découvre ces mots en créant sa société. Le
simulateur affiche déjà « assiette », « Pass », « tranche 2 », « CEG »,
« abattement », « net imposable » sans les définir. Un glossaire est aussi ce
qui donne au site sa raison d'exister entre deux simulations.

**Contenu envisagé.** Assiette · Pass et tranches T1/T2 · brut, net social, net
imposable, net à payer · cotisations patronales et salariales · CSG déductible
et non déductible · abattement de 10 % · quotient familial et décote · TMI ·
prélèvement à la source · PFU et flat tax · prélèvement forfaitaire non
libératoire · IS et taux réduit · résultat fiscal, résultat net, réserves ·
dividendes et acompte · assimilé salarié · mandataire social · trimestre validé
· point Agirc-Arrco.

**Pistes techniques.**
- Un fichier de données typé plutôt que du JSX, pour que les définitions soient
  réutilisables ailleurs.
- Rendre les termes cliquables **depuis le simulateur** : c'est là qu'on se
  pose la question, pas sur une page à part. Une infobulle au survol, un lien
  ancré vers le glossaire au clic.
- Chaque définition porte sa source officielle, comme les paramètres fiscaux.

---

## Comparateur de comptables en ligne

Comparer les offres de comptabilité en ligne pour une SASU : prix annuel, ce
qui est inclus, ce qui est en option.

**Pourquoi.** C'est la première dépense structurante après la création, les
grilles tarifaires sont opaques, et l'écart entre offres se compte en milliers
d'euros par an. C'est aussi le sujet qui amène naturellement du trafic.

**Critères à couvrir.** Prix mensuel et annuel réel, engagement, périmètre
(bilan, liasse, TVA, paie du président, dépôt des comptes), coût des options
fréquentes (première année, dépôt de comptes, AG annuelle), outil de
facturation inclus ou non, interlocuteur dédié, récupération des données en cas
de départ.

**Points de vigilance.**
- Les tarifs bougent souvent : prévoir une date de dernière vérification
  affichée par offre, comme pour les barèmes fiscaux.
- Ce marché est saturé d'affiliation. Décider **explicitement** de la position
  du site — et si des liens affiliés sont utilisés, le dire en clair sur la
  page. La crédibilité du simulateur ne survivrait pas à un comparateur
  déguisé en publicité.
- Ne pas comparer que le prix : le périmètre est ce qui fait vraiment l'écart.

---

## Annuaire des plateformes de freelance

Recenser les plateformes de mise en relation : positionnement, commission,
métiers couverts, mode de facturation.

**Pourquoi.** Le choix de plateforme conditionne le TJM net. La commission est
rarement affichée franchement, et elle se compare mal d'une plateforme à
l'autre selon qu'elle porte sur le TJM client ou le TJM freelance.

**Champs envisagés.** Nom, positionnement (tech, marketing, cadres dirigeants,
généraliste), commission et sur quelle base elle s'applique, TJM typique,
délai de paiement, existence d'un affacturage, portage salarial proposé ou
non, zone géographique, exclusivité imposée ou non.

**Pistes techniques.**
- Un jeu de données statique en JSON, versionné, avec une date de vérification
  par entrée.
- Connecter avec le simulateur : de la commission d'une plateforme au résultat
  avant rémunération, il n'y a qu'un calcul — c'est exactement l'entrée du
  simulateur actuel.

---

## Liste des webinaires des plateformes freelance

Agréger les webinaires et événements organisés par les plateformes
(Malt, Freelance.com, Comet, Collective, etc.) et l'écosystème freelance.

**Pourquoi.** L'information est éparpillée entre LinkedIn, newsletters et pages
d'événements. Un agrégateur à jour est un motif de revenir sur le site — ce
qu'un simulateur, consulté une fois par an, n'offre pas.

**Points de vigilance.**
- Le contenu est périssable : sans mise à jour, la page devient contre-productive
  en quelques semaines. Ne pas lancer sans un moyen d'entretenir la liste.
- Regarder d'abord s'il existe des flux exploitables (iCal, RSS, pages
  structurées) avant d'envisager quoi que ce soit de plus lourd. Vérifier les
  conditions d'utilisation de chaque source.
- Une collecte semi-automatique relancée par la CI, avec relecture humaine,
  est probablement le bon compromis.

---

---

## Ce que proposent les cabinets en ligne

Relevé de l'existant chez trois acteurs, pour situer ce qui manque ici et ce
qui ne vaut pas la peine d'être refait.

**Dougs** — une cinquantaine d'outils, de loin le catalogue le plus fourni.
Création (forme juridique, capital social, SASU vs EURL, ARCE, holding),
fiscalité (TVA, IS et ses acomptes, CFE, CVAE, seuils micro, taxe véhicules,
distribution de dividendes), social (taxe d'apprentissage, formation
professionnelle), rémunération (dirigeant TNS, dirigeant assimilé salarié,
frais kilométriques), personnel (coût d'embauche, rupture conventionnelle,
licenciement, intéressement), finance (CAF, plan de financement, emprunt,
amortissement, effet de levier, TRI), gestion (seuil de rentabilité, prix de
vente, coût de revient, rotation des stocks), trésorerie (délais de paiement,
affacturage, découvert), transmission (plus-values de cession).

**L-Expert-Comptable** — une cinquantaine également, plus orientée droit du
travail et fiscalité des personnes. Revenus par statut (SASU, EURL, EI, micro,
libérale), IS/IR, dividendes, honoraires d'expert-comptable, plafond Madelin,
amortissements ; puis brut/net, coût salarié, indemnités de licenciement et de
congés payés, IJSS, congé maternité, chômage, réduction Fillon ; enfin impôt
sur le revenu, quotient familial, prélèvement à la source, TJM freelance.

**Indy** — presque rien en propre. Quelques simulateurs de charges et de
revenu pour l'auto-entrepreneur, adossés à des pages de guide. Leur produit
est l'application comptable, pas les calculateurs.

**Ce qu'il faut en retenir.** Le volume est déjà pris : aligner cinquante
calculateurs de plus n'aurait aucun intérêt. Trois choses manquent en revanche
partout, et sont déjà les nôtres :

- **les sources.** Aucun de ces outils ne cite le texte appliqué. Nous
  référençons le BOFiP et Légifrance paramètre par paramètre ;
- **l'arbitrage plutôt que le calcul.** Ils répondent « combien » ; nous
  répondons « quel niveau choisir », courbe et optimum à l'appui ;
- **le partage et l'ouverture.** Une simulation tient dans une URL, et le code
  est vérifiable.

La ligne directrice à tenir : peu d'outils, mais chacun sourcé, décidable et
partageable.

## Autres calculateurs envisageables

Classés par intérêt pour un freelance en SASU, en réutilisant le moteur
existant.

**TJM nécessaire pour un revenu net cible.** L'inverse du simulateur
salaire / dividendes : on part du net voulu et on remonte au tarif journalier.
C'est la question que se pose réellement un indépendant qui fixe ses prix, et
tout le calcul est déjà écrit — il ne manque que l'inversion.

**ARE et ARCE.** Le cumul allocation chômage / création d'entreprise décide du
niveau de rémunération des premiers mois, et interagit directement avec
l'arbitrage salaire / dividendes : se verser un salaire réduit l'ARE, pas les
dividendes. Aucun outil ne traite les deux ensemble.

**Coût du premier salarié.** Le moteur de cotisations est déjà là ; il faudrait
y ajouter le chômage et l'AGS, dont le président est exempté, et la réduction
générale dégressive dont un salarié bénéficie.

**CFE.** Oubliée par presque tous les créateurs, exonérée la première année
puis due sur une base minimale qui dépend du chiffre d'affaires et de la
commune. Peu de calcul, beaucoup de valeur.

**TVA : régime et seuils.** Franchise en base, réel simplifié, réel normal, et
les échéances qui vont avec. Sujet fréquent au démarrage.

**Indemnités journalières et droits ouverts.** Le simulateur affiche déjà les
trimestres validés et les points Agirc-Arrco ; les IJSS maladie et maternité
compléteraient la réponse à « qu'est-ce que mon salaire m'achète ».

**Plus-value de cession.** L'horizon de sortie, avec abattements pour durée de
détention et départ à la retraite.

**Holding et régime mère-fille.** Réservé aux structures qui grossissent, mais
c'est la suite logique de la question des dividendes.

## Améliorations du simulateur existant

- **Grille de taux par défaut du prélèvement à la source**, applicable tant que
  l'administration n'a transmis aucun taux — le cas d'une société qui vient
  d'être créée.
- **Contribution différentielle sur les hauts revenus** : vérifier si elle est
  reconduite en 2026 et, le cas échéant, la modéliser. Elle concerne les
  revenus fiscaux de référence supérieurs à 250 000 €.
- **Arbitrage PER** : les versements déductibles changent l'optimum, parfois
  nettement.
- **Intérêts de compte courant d'associé**, déductibles du résultat dans la
  limite du taux fiscal.
- **Comparaison SASU / EURL** à revenu net constant, la question qui précède
  toutes les autres.
- **Régularisation du plafond entre employeurs** : quand le président cumule sa
  rémunération avec un emploi extérieur, chaque employeur applique le Pass de
  son côté, et une régularisation annuelle recalcule les cotisations plafonnées
  sur le total. Le simulateur ne la modélise pas et surestime donc légèrement
  les cotisations vieillesse plafonnée et de retraite complémentaire dans ce
  cas de figure.
