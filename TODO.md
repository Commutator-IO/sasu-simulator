# Feuille de route

Ce dépôt est une boîte à outils pour les freelances en SASU, pas un simulateur
isolé. Voici ce qui est en ligne, puis ce qui viendrait ensuite.

Le moteur de calcul ([src/lib/simulation.ts](src/lib/simulation.ts)) est
volontairement séparé de l'interface : chaque outil le réutilise sans le
dupliquer, et c'est ce qui rend les suivants peu coûteux à ajouter.

## Ce qui est en ligne

| Outil | Ce qu'il répond |
|---|---|
| Projection de CA | Du chiffre d'affaires mois par mois au résultat de fin d'exercice |
| Salaire ou dividendes | Quel niveau de rémunération maximise le net en poche |
| Acomptes d'IS | Combien verser à chaque échéance, et le coût d'une sous-estimation |
| Synthèse | Les volets réconciliés en un scénario, imprimable pour le comptable |
| TJM du marché | Où se situe un tarif, ce qu'il faut pour en vivre, ce qu'il en reste |
| Serveur MCP | Page d'attente : le moteur exposé aux assistants IA (à venir) |

L'état de chaque outil tient dans son URL, ce qui permet de passer de l'un à
l'autre sans ressaisie et de partager une simulation telle quelle.

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

## Fraîcheur des données TJM

**Constat du 28 juillet 2026.** Un contrôle des neuf métiers face à leurs pages
publiques a montré huit relevés justes à un ou trois euros près — le bruit d'une
fenêtre glissante de trois mois — et un faux de bout en bout : Experts data
donnait 680 € au lieu de 666 € en national et 742 € au lieu de 710 € à Paris,
avec des plafonds de séniorité d'un cran trop haut. La catégorie ne publie plus
qu'une seule spécialité là où elle en publiait plusieurs, donc les moyennes par
ville ne reposaient plus sur la même base que la capture. Corrigé, et
`meta.verifieLe` est désormais affiché sur la page.

**La capture automatique ne peut pas tourner.** La source est derrière une
protection anti-bot : un runner headless reçoit une page de vérification 403, et
même en se présentant comme un navigateur ordinaire le site refuse ensuite sur
les cookies. Le contournement est hors sujet pour ce dépôt. Le workflow est donc
passé en déclenchement manuel, le script couvre les neuf métiers quand il est
lancé depuis un environnement que la source sert, et le rafraîchissement se fait
sinon à la main.

**Les archives ne comblent pas le trou.** Entre mai 2025 et juillet 2026, la
Wayback Machine n'a aucune capture exploitable des neuf pages : zéro instantané
pour huit d'entre elles, et un seul pour la neuvième — un 403. Le crawler se fait
bloquer comme le nôtre. Ce trou de quatorze mois ne se rattrapera pas et il
continuera de grandir : d'où l'intérêt de dater ce qui est affiché.

**Une réserve de méthode connue.** Le chiffre national vient du bandeau de tête
(tous profils expérimentés de la catégorie) tandis que les valeurs par ville sont
la moyenne des spécialités publiées. Les deux ne sont pas calculés sur la même
base : l'écart va de 5 € à 32 € selon le métier, soit jusqu'à 7 %. Le facteur
ville utilisé par l'application (`ville / national`) en hérite. Le corriger
supposerait de stocker aussi la moyenne de la colonne spécialités et de s'en
servir comme dénominateur, en gardant le bandeau comme ancre de séniorité.

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

## Couverture de tests de l'interface

Le moteur est couvert ; l'interface ne l'est pas du tout. Dix fichiers `.tsx`,
zéro test.

**Pourquoi ça compte.** Les défauts trouvés sur la page des acomptes ont tous
échappé aux tests, parce qu'aucun ne regarde le JSX :

| Défaut | Trouvé par |
| --- | --- |
| Le curseur affichait 5 563 € pendant que le bouton annonçait 1 500 € | l'utilisateur |
| Deux stratégies au comportement identique dès que le bénéfice monte | l'utilisateur |
| Le pic de trésorerie nommé différemment à deux endroits | relecture |
| Un message renvoyant à un vocabulaire disparu de l'interface | relecture |
| « Les suivantes s'ajustent », faux sous « verser ce qui est appelé » | relecture |

Ce ne sont pas des broutilles de style : `Message` choisit une branche parmi
sept par ordre de priorité, `reductionPossible` décide quel préréglage
s'affiche, le curseur bascule la stratégie en `manuel`. C'est de la logique, et
elle n'est vérifiée nulle part.

**Deux approches, non exclusives.**

- **Extraire la décision.** Sortir dans `src/lib/` les fonctions pures qui
  décident — quel message, quels préréglages, quel montant montre le curseur —
  et ne laisser au JSX que le rendu. Aucune dépendance ajoutée, et cela couvre
  exactement les défauts ci-dessus. Ne verra pas un composant qui plante au
  rendu.
- **Rendre les composants**, avec `@testing-library/react` et `jsdom`. Trois
  dépendances de développement et une suite plus lente, mais cela attrape aussi
  le rendu lui-même, et c'est ce qui aurait détecté l'incohérence
  curseur / bouton en simulant le clic.

**À tenir dans tous les cas.** Les balayages d'invariants étiquettent chaque
cas et utilisent `expect.soft`, pour qu'un échec nomme la combinaison fautive
et les remonte toutes ensemble. Un balayage muet coûte plus cher à diagnostiquer
qu'il ne rapporte.

---

## Ce que propose la concurrence

Relevé de l'existant, pour situer ce qui manque ici et ce qui ne vaut pas la
peine d'être refait. Deux familles : les cabinets comptables, qui publient des
calculateurs pour capter du trafic, et les sites de simulateurs purs, apparus
depuis.

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

**IndepNet** — le concurrent le plus proche, et le seul à jouer le même jeu :
un site de simulateurs, sans produit derrière. Neuf outils, tous gratuits et
sans inscription : revenu net micro, TVA auto-entrepreneur, ACRE et versement
libératoire, portage salarial, TJM freelance, comparateur de statuts
(micro / EI / SASU / portage), simulateur SASU avec arbitrage salaire /
dividendes, ARE et cumul création, ARCE.

Vérifié en le parcourant : il ne propose **ni historique de TJM par métier et
par ville, ni comparaison des commissions de plateformes, ni décomposition
d'une journée facturée, ni acomptes d'IS, ni synthèse partageable**. En
revanche il nous dépasse nettement sur les statuts, le chômage et l'ARCE.

D'autres suivent le même modèle sur le seul arbitrage : FreelanceKit, RemUp,
Cleerly, CalculateurFinance, salaire-freelance.com.

**Ce qu'il faut en retenir — et une correction.** Ce document affirmait que
l'arbitrage salaire / dividendes était l'un de nos différenciateurs. **Ce n'est
plus vrai** : au moins six sites le font désormais, certains avec plus d'options
que nous. Il faut cesser de compter dessus.

Ce qui distingue réellement, après vérification :

- **les sources.** Aucun de ces outils ne cite le texte appliqué. Nous
  référençons le BOFiP et Légifrance paramètre par paramètre ;
- **le volet marché.** Historique de TJM depuis 2019, positionnement, seuil de
  rentabilité face à un CDI, décomposition par canal de distribution : personne
  ne le fait, et c'est ce qui a le moins de chances d'être copié vite, parce que
  les données ont dû être reconstituées d'archives ;
- **le chaînage.** Du positionnement de tarif jusqu'aux acomptes d'IS, avec
  l'état porté par l'URL d'un outil à l'autre. Les autres sont des calculateurs
  isolés ;
- **le partage et l'ouverture.** Une simulation tient dans une URL, et le code
  est vérifiable.

La ligne directrice à tenir : peu d'outils, mais chacun sourcé, décidable et
partageable — et ne plus investir sur les terrains déjà saturés.

## Le cycle de vie du CA : les maillons manquants

Une manière de cadrer la suite : suivre **un euro de chiffre d'affaires depuis
la facture jusqu'à la poche du dirigeant**, et repérer les étapes qu'aucun des
trois outils ne modélise. Les trois onglets couvrent bien le segment
*résultat → poche* ; ce qui manque est **avant** (encaissement, TVA) et **au
milieu** (résultat comptable → résultat fiscal).

La cascade complète, avec ce qui est couvert (✅) et ce qui manque (⭕) :

1. Facture émise, CA HT — ✅ projection
2. **Encaissement** : délai de paiement client, impayés. CA facturé ≠ CA
   encaissé — ⭕
3. − Charges déductibles : frais courants ✅ · **amortissements** des
   investissements — partiel
4. = Résultat comptable
5. **± Retraitements fiscaux** : charges non déductibles réintégrées
   (quote-part véhicule, amendes, cadeaux…) — ⭕
6. − Rémunération du dirigeant et cotisations patronales — ✅ arbitrage
7. **− Report des déficits antérieurs** — ⭕
8. = **Résultat fiscal / bénéfice imposable** — ⭕ *maillon jamais calculé de
   bout en bout*
9. − IS : montant ✅, échéancier ✅ (arbitrage + acomptes)
10. = Résultat net
11. **− Réserve légale** (5 % jusqu'à 10 % du capital, obligatoire avant
    distribution) — ⭕
12. Réserves distribuables et report à nouveau — partiel ✅
13. Dividendes : flat tax / barème / PS ✅ · **CEHR** (seulement un
    avertissement)
14. = Poche du dirigeant — ✅

### La colonne vertébrale : du résultat comptable au bénéfice fiscal

**Priorité.** Les étapes 5 à 8 forment le trou le plus coûteux : c'est le
chiffre sur lequel l'IS et les acomptes tournent réellement, et il n'est
calculé nulle part.

C'est aussi le point faible du pont projection → acomptes. Aujourd'hui la
projection transmet le **résultat avant rémunération** comme « bénéfice
prévisionnel » ; le vrai bénéfice imposable, c'est ce résultat **moins** la
rémunération et les cotisations patronales déductibles, **plus** les
réintégrations, **moins** les déficits reportés. Le pont n'est donc exact que
pour une année sans salaire ; dès qu'on se verse une rémunération, il surestime
la base taxable. Fermer ce maillon relierait vraiment les trois onglets en une
seule chaîne.

À modéliser, dans l'ordre :

- **Le vrai bénéfice fiscal** : rémunération déduite, réintégrations de charges
  non déductibles, report des déficits antérieurs. Rend le pont exact.
- **Amortissements et investissements** : dès un achat de matériel, le résultat
  fiscal décroche du résultat de trésorerie.
- **Réserve légale et affectation du résultat** : les 5 % obligatoires avant
  toute distribution, aujourd'hui absents.

### Les angles trésorerie : le cycle du cash

Distinct du résultat, mais c'est ce qui décide si le compte tient :

- **Facturé vs encaissé** : délais de paiement, impayés, affacturage. La
  projection porte sur la facturation, pas sur l'encaissement.
- **TVA** : collectée − déductible = à reverser. Hors résultat, mais rythme la
  trésorerie. Déjà notée plus bas comme calculateur (régime et seuils) ; il
  manque le versant *flux de trésorerie*.
- **Calendrier de trésorerie consolidé** : encaissements face aux sorties (TVA,
  cotisations mensuelles, acomptes d'IS, solde du 15 mai) sur un même axe. Les
  acomptes en font déjà une partie pour l'IS seul.

**CFE**, **TVA** et **CEHR** figurent déjà ailleurs dans cette feuille de
route ; **réserve légale**, **réintégrations fiscales**, **report déficitaire**
et **encaissement / trésorerie** n'y étaient pas.

## Distribution : exposer le moteur en serveur MCP

Le moteur est déjà des fonctions pures, déterministes et sourcées
([simulation.ts](src/lib/simulation.ts), [acomptes.ts](src/lib/acomptes.ts),
[projection.ts](src/lib/projection.ts), [synthese.ts](src/lib/synthese.ts)) —
exactement ce qu'on veut derrière des outils MCP (Model Context Protocol).
L'exposer comme serveur MCP ouvrirait un second canal de distribution, sur une
case aujourd'hui vide.

**L'état de l'art laisse un creux.** Deux familles existent :

- les **connecteurs de logiciels comptables** (Moneybird, QuickBooks, Zoho
  Books, AgenticBooks, Maesn) donnent à une IA l'accès au grand livre — lire le
  P&L, créer des factures — mais ne *décident* rien : ni arbitrage, ni
  modulation d'acomptes ;
- les **calculateurs socio-fiscaux français** (MCP OpenFisca, French Admin MCP)
  calculent l'IR, l'URSSAF, les aides — pour un particulier, pas pour
  l'arbitrage du dirigeant de SASU.

Personne n'expose l'arbitrage rémunération / dividendes **+** la modulation des
acomptes d'IS **+** la projection de CA. C'est le creux.

**Ce que le serveur exposerait.** `simuler`, `balayer`, `calculerAcomptes`,
`calculerProjection`, `calculerSynthese`, plus le volet marché ajouté depuis —
`seuilRentabilite`, `decomposerTjm`, `decomposerCdi` et les séries du baromètre.
Chaque paramètre sourcé.

**Trois usages inédits.**

1. L'arbitrage dans la conversation : « quel salaire pour 140 k€ de résultat ? »
   → réponse chiffrée et sourcée, sans ouvrir le site.
2. L'étude de marché à la demande : « mon TJM tient-il face au marché, et que me
   faut-il pour égaler mon ancien CDI ? » → l'historique par métier et par ville,
   le seuil de rentabilité et la décomposition par canal, en une réponse.
3. Le chaînage avec un connecteur de la première famille : lire le vrai P&L
   depuis Pennylane / QuickBooks → le passer à la projection → arbitrer. La
   donnée réelle rencontre la décision, ce qu'aucune famille ne fait seule.

**Deux usages qui débordent du calcul fiscal**, et qui tirent parti du volet
marché autant que du moteur :

- **l'aide au devis.** Chiffrer une proposition demande de savoir ce que vaut la
  journée sur le marché, quel tarif afficher selon le canal et ce qu'il en reste
  après commission. Les trois réponses sont déjà dans le moteur ; un assistant
  qui rédige le devis peut les appeler au lieu de les inventer ;
- **l'appui à la tenue comptable.** Échéances de l'exercice, montants à
  provisionner, écart entre prévisionnel et réalisé. La limite doit rester
  explicite : l'outil prépare des chiffres, il ne tient pas la comptabilité et
  n'engage personne.

**Garde-fous.** Même discipline de veille qu'aujourd'hui — un MCP qui débite un
barème périmé à une IA est pire qu'un site périmé. Et la ligne à tenir : l'outil
*calcule*, il ne délivre pas de *conseil financier personnalisé*.

**Modèle envisagé.** Deux accès achetés, non loués : **7 € TTC** pour un mois
à activer quand on veut, ou **25 € TTC** à vie. Les prix affichés sont
calculés à l'envers depuis ce qui doit rester, puis arrondis à l'euro
supérieur : TVA à 20 % reversée et commission Stripe déduites, il reste 5,48 € et
20,21 € — soit les 5 € et 20 € HT visés, avec un peu de marge. Précédé d'une
page de pré-inscription pour prévenir de la sortie (onglet « Serveur MCP »). Le
formulaire est pour l'instant inerte — le moyen d'inscription reste à décider —
et n'expose aucune adresse. Un backend de collecte (Formspree, Buttondown…) ou
une fonction serverless, ainsi qu'un encaissement (Stripe Payment Link, Lemon
Squeezy…), restent à choisir avant le lancement. Rien n'est encaissé ni stocké
tant que ce choix n'est pas fait.

### Quel prestataire de paiement

Deux contraintes commandent le choix, et elles tirent dans le même sens :
**les montants sont petits** (5 € et 20 €) et **l'acheteur doit être rassuré**
au moment de sortir sa carte sur un site qu'il ne connaît pas.

**Les frais fixes décident.** À ces prix, le pourcentage compte moins que les
40 à 50 centimes fixes par transaction :

| | Sur 5 € | Sur 20 € |
|---|---|---|
| Stripe (carte européenne, ~1,5 % + 0,25 €) | 0,33 € — **6 %** | 0,55 € — **3 %** |
| Polar (MoR, ~4 % + 0,40 $) | 0,57 € — 11 % | 1,17 € — 6 % |
| Lemon Squeezy, Paddle (MoR, 5 % + 0,50 $) | 0,71 € — **14 %** | 1,46 € — 7 % |

Un *merchant of record* prélève donc le double à le triple sur l'offre à 5 €.
Ce qu'il vend en échange, c'est la TVA gérée à sa place.

**Or cette TVA n'est pas un problème au départ.** Pour des services
électroniques vendus à des particuliers dans l'UE, le guichet OSS ne devient
obligatoire qu'au-delà de **10 000 € de ventes transfrontalières par an** —
soit 2 000 ventes à 5 € ou 500 à 20 €. En dessous, la TVA française suffit.
Payer 14 % de commission pour éviter une formalité qui ne s'applique pas encore
serait un mauvais calcul.

**La confiance penche du même côté.** Stripe est le tunnel de paiement le plus
reconnu en France : la page de paiement est hébergée par Stripe, la carte ne
transite jamais par le site, et le logo est familier. Un MoR américain émet en
revanche une facture au nom d'une société inconnue de l'acheteur français, ce
qui interroge davantage qu'il ne rassure sur un achat à 5 €.

**Recommandation.** **Stripe Payment Links** ou Checkout, pour trois raisons :
les frais les plus bas sur les petits montants, la page de paiement hébergée
(donc aucune donnée bancaire à toucher), et Apple Pay / Google Pay en un geste —
sur un achat à 5 €, la friction coûte plus cher que la commission.

**Ce qu'il faut surveiller.** Le seuil des 10 000 € de ventes transfrontalières :
une fois approché, soit on s'inscrit au guichet OSS, soit on bascule vers un MoR
— le surcoût devient alors supportable puisque le volume est là. À noter aussi
que le paiement introduit une donnée client là où le site n'en a aucune : un
modèle à clé de licence (une adresse, une clé) garde cette empreinte minimale et
reste cohérent avec la promesse « rien n'est enregistré » des simulateurs.

**La tension à surveiller.** L'offre à vie finance des coûts récurrents avec un
paiement unique : l'hébergement du backend et la veille sur les barèmes ne
s'arrêtent pas après la vente. Elle ne tient que tant que les nouveaux achats
couvrent le service rendu aux anciens, ou tant que le coût marginal d'une
réponse reste proche de zéro. C'est le cas ici — le calcul est bon marché à
servir — mais cela cesserait si le serveur devait appeler des modèles payants à
chaque requête. À réexaminer avant d'encaisser le premier euro, et c'est aussi
ce qui justifie de garder l'option courte : elle amortit le risque si
l'engagement à vie devient intenable. Le rapport entre les deux — quatre passages
d'un mois et l'accès à vie est déjà rentabilisé — pousse volontairement
vers l'achat unique, qui coûte moins cher à servir qu'une succession de
réactivations.

## Autres calculateurs envisageables

Classés par intérêt pour un freelance en SASU, en réutilisant le moteur
existant.

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
