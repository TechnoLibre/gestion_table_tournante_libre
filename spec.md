# Gestion de tables tournantes — spécification

## 1. Objet

Un logiciel qui place les personnes d'un événement autour de tables et les
fait tourner sur plusieurs tours, de sorte que chacune rencontre le plus de
monde possible. Il propose **plusieurs placements comparables** plutôt qu'une
réponse unique, mesure chacun par les mêmes indicateurs, et dit à l'opérateur
ce qu'une configuration rend inévitable avant qu'il ne cherche en vain.

Il fonctionne **hors ligne, sans serveur**, et se livre comme un exécutable.

## 2. Contexte d'usage

L'opérateur est l'organisateur d'un souper, d'un colloque ou d'un banquet. Il
travaille sur un portable, dans une salle, souvent sans réseau fiable. Il
prépare son plan la veille et le retouche sur place quand des gens manquent
ou s'ajoutent.

Les conséquences de ce contexte sont des exigences :

- **Aucune connexion n'est requise**, à aucun moment, pas même au premier
  démarrage.
- **Aucune installation de serveur, ni de base de données.** L'exécutable se
  copie et se lance.
- **Rien ne sort de la machine.** Pas de télémétrie, pas de service distant.
- Les données d'un événement se copient, se sauvegardent et se transmettent
  comme des fichiers ordinaires.

## 3. Périmètre

**Dans le périmètre.** Saisir les participants, décrire la salle, générer et
comparer des placements, retoucher à la main, imprimer ce qu'il faut pour
tenir la soirée.

**Hors périmètre, explicitement.** Les inscriptions en ligne, la billetterie,
le paiement, l'envoi de courriels, le travail à plusieurs sur un même plan,
la synchronisation entre postes, les comptes et les droits d'accès.

Un seul opérateur, une seule machine, un seul plan à la fois.

## 4. Les objets manipulés

**Événement** — un nom, une date, et tout le reste ci-dessous.

**Participant** — un nom, éventuellement un courriel et une **appartenance**
(entreprise, équipe, famille, école : l'étiquette qui sert à séparer les gens
qui se connaissent déjà). Un participant peut être **exclu** sans être
supprimé : il reste dans la liste, il n'est plus placé.

**Table** — un numéro à partir de 1, un nombre de sièges, une forme (ronde ou
carrée), et une position sur le plan. **Le nombre de sièges d'une table ne
change pas d'un tour à l'autre** : c'est une propriété du mobilier, pas du
tour.

**Tour** — une des R rondes de la soirée. À chaque tour, chaque participant
non exclu est assis à exactement une table.

**Placement** — l'affectation complète : pour chaque tour, qui est à quelle
table, et à quel siège si les sièges sont attribués.

**Réservation** — une place retenue à la main par l'opérateur avant la
génération. Elle contraint ce que la machine produira et lui survit.

## 5. Le cœur : le placement

### 5.1 Le problème

Étant donné N participants, T tables de capacités fixées et R tours, répartir
les gens à chaque tour de façon à **maximiser le nombre de personnes
distinctes que chacun rencontre**, sous les contraintes que l'opérateur active.

### 5.2 Les contraintes, activables une à une

| contrainte | ce qu'elle exige |
|---|---|
| **Séparer les appartenances** | deux personnes de la même appartenance ne partagent pas une table |
| **Nouveaux voisins à chaque tour** | deux personnes ne se retrouvent pas deux fois à la même table |
| **Nouvelle table à chaque tour** | personne ne revient à une table déjà occupée |
| **Attribuer les sièges** | chacun reçoit un numéro de siège, pas seulement une table |

Elles sont des **objectifs**, pas des interdits absolus : quand la
configuration les rend impossibles à toutes satisfaire, le logiciel produit le
meilleur compromis **et dit lequel**, plutôt que de refuser.

### 5.3 Les indicateurs, mesurés pour chaque placement

Tout placement proposé porte les mêmes chiffres, afin que la comparaison soit
une lecture et non un jugement :

- paires de même appartenance assises ensemble ;
- rencontres répétées (deux personnes réunies plus d'une fois) ;
- nombre maximal de rencontres d'une même paire ;
- retours à une table déjà occupée ;
- personnes rencontrées : **minimum** sur l'ensemble des participants, et
  moyenne.

Le minimum compte plus que la moyenne : il décrit le sort de la personne la
plus mal servie, qui est celle qui se plaindra.

### 5.4 La borne prouvée

Pour certaines configurations — tables de taille égale, nombres bien choisis —
il existe une construction mathématique qui atteint l'optimum, et l'on peut
**prouver** qu'aucun placement ne fera mieux.

Le logiciel doit :

1. calculer cette borne quand elle existe ;
2. afficher, à côté de chaque proposition, l'écart qui l'en sépare ;
3. dire explicitement **« minimum atteint »** quand la proposition l'égale.

Sans cela, l'opérateur ne sait jamais s'il doit relancer la recherche ou
s'arrêter. C'est la différence entre un outil qui propose et un outil en
qui l'on a confiance.

### 5.5 Le diagnostic, avant la recherche

Certaines configurations rendent un conflit **inévitable**, quel que soit
l'algorithme. Par exemple : plus de personnes d'une même appartenance que de
tables — deux d'entre elles se retrouveront forcément ensemble.

Le logiciel détecte ces cas **avant** de chercher, et énonce :

- ce qui est inévitable, et **combien** (« au moins 8 paires de collègues ») ;
- ce qui le rendrait évitable (« avec 7 tables, un plan parfait existe »).

Un opérateur à qui l'on dit « c'est impossible, voici pourquoi, voici le
remède » cesse de relancer la génération en espérant mieux.

### 5.6 Plusieurs propositions, pas une

Une génération produit **plusieurs placements distincts et comparables** — le
nombre est réglable. L'opérateur les compare par leurs indicateurs, en examine
un sur le plan de salle, puis en **retient** un.

Les générations **s'accumulent** : relancer avec d'autres réglages ajoute des
candidats à la liste plutôt que d'effacer les précédents, et un classement
unique les ordonne tous. Une commande efface la liste en épargnant celui qui
est retenu.

### 5.7 Le placement à la main

L'opérateur peut asseoir des gens **avant toute génération** : ces places sont
des **réservations**. La génération suivante les honore et place les autres
autour. Une commande transforme un placement manuel partiel en placement
complet, le générateur comblant les vides.

Une fois un placement retenu, le même geste déplace une personne réelle au
lieu de réserver une place. **Le geste est identique ; ce qui change est
l'état des données**, et l'interface doit le dire pour que l'opérateur sache
lequel des deux il est en train de faire.

## 6. Le plan de salle

C'est la surface de travail principale, du début à la fin.

**Ce qu'il dessine.** Chaque table à l'échelle de son nombre de sièges, ronde
ou carrée, avec ses chaises en couronne. À côté de chaque table, la **liste
numérotée** des personnes qui y sont assises, reliée à la table par un trait.
Les noms ne sont pas écrits autour de la table : au-delà de quelques convives
ils se chevauchent et deviennent illisibles.

**Les gestes.**

- Glisser une personne sur un siège libre la déplace.
- Glisser une personne sur une autre les échange.
- Glisser une personne hors des tables la retire du tour ; elle attend dans
  une **réserve** visible.
- Un menu par personne offre les mêmes actions sans glisser, pour le tactile
  et le clavier.

**Les aides à la lecture.**

- Un sélecteur de tour.
- La mise en évidence d'une personne, **visible à chaque tour**, pour suivre
  son parcours.
- Afficher ou masquer les listes de noms.
- Zoom, ajustement à la fenêtre, plein écran.
- Une commande qui **réorganise les tables** sur une grille assez large pour
  les listes de noms, sans jamais déplacer quelqu'un.

**Les signaux.** Une table où une contrainte est violée le signale sur le
plan, avec le détail au survol. Un bandeau compare en permanence le nombre de
participants au nombre de sièges.

## 7. Les états d'un plan

Quatre états, dont un seul restreint quoi que ce soit.

| état | ce qu'il signifie |
|---|---|
| **Brouillon** | on prépare |
| **Proposé** | des placements existent, aucun n'est retenu |
| **Retenu** | un placement est en vigueur |
| **Bloqué** | rien ne peut plus changer |

**Brouillon, proposé et retenu n'interdisent rien.** Ils ordonnent le travail
et se posent en cliquant l'état ; passer de l'un à l'autre **ne détruit
jamais** de données.

**Bloqué refuse toute modification** — tours, options, tables, participants,
et jusqu'à la position d'une table à l'écran. La lecture et l'impression
restent ouvertes : on bloque un plan précisément pour le distribuer. Seules
deux commandes explicites y entrent et en sortent.

**La dérive avertit, elle ne bloque pas.** Si les participants changent après
qu'un placement a été retenu, le logiciel le signale et laisse l'opérateur
décider : lui seul sait si la personne arrivée en retard doit être placée ou
non.

## 8. Les sorties

- **Une fiche par participant** : son nom, et pour chaque tour sa table et
  son siège.
- **Une feuille par table** : pour chaque tour, qui y est assis.
- **Export du plan** en fichier, pour archive ou transmission.

Tout s'imprime depuis le logiciel, sans service externe.

## 9. Architecture

### 9.1 Forme du projet

Une application **Cordova**, dont le code vit dans `www/` et ne dépend
d'aucun service.

| plateforme | rôle |
|---|---|
| `electron` | la livraison : un exécutable Windows |
| `browser` | le développement et les tests sous Linux |
| `android` | ouvert, non requis pour la première livraison |

Le code applicatif ignore sur quelle plateforme il tourne, sauf aux deux
frontières nommées ci-dessous.

### 9.2 Une seule langue, et c'est une exigence

Tout — le moteur de placement, la géométrie du plan, l'interface — est écrit
en **JavaScript**. Aucune partie du calcul n'est dupliquée dans un second
langage.

Cette propriété doit être **préservée délibérément**. Dès que la même
arithmétique existe en deux endroits, une suite de tests peut prouver qu'ils
s'accordent sans jamais prouver qu'ils ont raison : les deux dérivent
ensemble et les tests restent verts. Une seule implémentation rend ce mode de
défaillance impossible.

### 9.3 Les couches

```
  interface          le plan de salle, les listes, les formulaires
      │
  application        les états, les commandes, l'historique
      │
  moteur             le placement : pur, sans DOM, sans API de plateforme
      │
  stockage           lecture et écriture de fichiers
```

**Le moteur ne connaît ni le DOM ni Cordova.** Il reçoit des nombres et des
listes, il rend des placements. C'est ce qui le rend testable sous `node`, en
quelques secondes, sans navigateur ni émulateur — et c'est la condition pour
qu'il soit éprouvé sérieusement.

**La géométrie du plan** — taille d'une table selon son nombre de sièges,
position des chaises, place réservée à une liste de noms — est elle aussi un
module **de fonctions pures**, séparé du rendu, et testé de la même façon.

### 9.4 Stockage

Un **fichier par événement**, en JSON, dans le répertoire de données de
l'application. Lisible, copiable, sauvegardable, transmissible.

Un plan complet — une centaine de personnes, une douzaine de tables, cinq
tours — pèse quelques centaines de kilooctets. Une base de données
n'apporterait rien et ajouterait une dépendance native à empaqueter par
plateforme.

L'accès au système de fichiers est la **première des deux frontières de
plateforme** : une interface unique, deux implémentations, l'une pour
`electron`, l'autre pour `browser`.

La seconde frontière est l'**impression**.

## 10. Exigences de développement

Elles ne sont pas des préférences de style : chacune répond à une façon connue
de se tromper.

### 10.1 Les constantes de géométrie se mesurent

Toute dimension qui dépend du rendu du texte — hauteur d'une ligne, largeur
d'une colonne, nombre de caractères tenant sur une ligne — se **mesure dans un
navigateur**, sur la police réellement rendue. Jamais déduite d'une autre
constante, jamais posée de tête.

Un seuil en nombre de caractères se cale sur le **glyphe le plus large** de
l'alphabet visé, pas sur une moyenne. Un seuil moyen laisse déborder les noms
écrits en lettres larges, silencieusement, par-dessus la ligne suivante.

Chaque constante mesurée porte en commentaire **ce qu'elle mesure et
pourquoi**, afin que personne ne la « corrige » plus tard par le calcul.

### 10.2 Un test qui ne peut pas échouer ne prouve rien

Tout test ajouté doit être **montré en train d'échouer** sur le code
d'avant. Un test qui passe du premier coup n'a rien démontré tant qu'on n'a
pas vu ce qu'il refuse.

Un test de rendu lit le **style calculé**, pas la présence d'une classe : une
classe peut se poser sur un élément qui ne peint rien.

Un test qui parcourt un ensemble refuse de passer quand cet ensemble est
vide : « zéro fichier examiné » n'est pas « zéro problème ».

### 10.3 Les règles se gardent, pas seulement les cas

Quand un défaut est corrigé, le test qui l'accompagne épingle la **règle**
plutôt que le cas. Une valeur remise à la main sera défaite par la main
suivante ; une règle qui fait échouer la construction tient.

### 10.4 Les trois niveaux d'épreuve

| niveau | ce qu'il couvre | quand |
|---|---|---|
| `node` | moteur et géométrie, sans navigateur | à chaque modification, quelques secondes |
| navigateur | ce que l'interface dessine et ce que les gestes produisent | avant chaque livraison |
| manuel | une soirée complète, de la saisie à l'impression | avant chaque livraison au client |

### 10.5 Accessibilité et thèmes

Le texte tient **4,5:1** de contraste sur son fond. Chaque couleur choisie est
accompagnée du ratio mesuré. L'application fonctionne en thème clair comme en
thème sombre ; les deux sont éprouvés par rendu, jamais seulement par calcul.

## 11. Livraison

L'exécutable Windows se construit depuis Linux par la plateforme `electron`
de Cordova. **Cette capacité est à vérifier dès la première semaine**, sur un
squelette vide : découvrir en fin de projet qu'une étape exige une machine
Windows coûte beaucoup plus cher que de le découvrir tout de suite.

Ce qui est livré au client : un exécutable, et rien d'autre à installer.

## 12. Ce que ce document ne tranche pas

À décider avant de coder :

1. **La bibliothèque d'interface** — Cordova n'en impose aucune.
2. **Le rendu du plan de salle** — SVG, canvas, ou éléments positionnés. Le
   premier se teste et s'inspecte le plus facilement.
3. **La langue de l'interface** et le mécanisme de traduction, à poser dès le
   départ plutôt que d'avoir à retrouver les chaînes plus tard.
4. **Le nom du produit** et l'identité de l'exécutable.
