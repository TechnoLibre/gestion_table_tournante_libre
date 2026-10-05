# Gestion table tournante Libre — spécification

Exécutable livré : `gestion_table_tournante_libre_v#_#.exe`

---

## 1. Objet

Un logiciel qui place les personnes d'un événement autour de tables et les fait
tourner sur plusieurs tours, de sorte que chacune rencontre le plus de monde
possible. Il propose **plusieurs placements comparables** plutôt qu'une réponse
unique, mesure chacun par les mêmes indicateurs, et dit à l'opérateur ce qu'une
configuration rend inévitable avant qu'il ne cherche en vain.

Il fonctionne **hors ligne, sans serveur**, et se livre comme un exécutable.

## 2. Contexte d'usage

L'opérateur organise un souper, un colloque, un banquet. Il travaille sur un
portable, dans une salle, souvent sans réseau fiable. Il prépare son plan la
veille et le retouche sur place quand des gens manquent ou s'ajoutent.

Les conséquences de ce contexte sont des exigences :

- **Aucune connexion n'est requise**, à aucun moment, pas même au premier
  démarrage.
- **Aucune installation de serveur ni de base de données.** L'exécutable se
  copie et se lance.
- **Rien ne sort de la machine.** Pas de télémétrie, pas de service distant.
- Les données se copient, se sauvegardent et se transmettent comme des
  fichiers ordinaires.
- **L'interface est en français.** Une seule langue dans la première
  itération ; le mécanisme de traduction est néanmoins posé dès le départ
  (§ 14.6), parce que retrouver les chaînes après coup coûte dix fois plus.

## 3. Périmètre

**Dans le périmètre.** Saisir les participants, décrire la salle, générer et
comparer des placements, retoucher à la main, mesurer la qualité, imprimer ce
qu'il faut pour tenir la soirée.

**Hors périmètre, explicitement.** Les inscriptions en ligne, la billetterie,
le paiement, l'envoi de courriels, le travail à plusieurs sur un même plan, la
synchronisation entre postes, les comptes et les droits d'accès.

Un seul opérateur, une seule machine, un seul événement ouvert à la fois.

---

## 4. Les objets manipulés

**Événement** — un nom, une date, un nombre de sièges par défaut, et tout le
reste ci-dessous. Le logiciel en gère plusieurs (§ 8).

**Participant** — un **identifiant entier court**, unique dans l'événement et
jamais réutilisé ; un nom ; éventuellement un prénom, un courriel, des notes,
et une **appartenance** — l'étiquette qui sépare les gens qui se connaissent
déjà : entreprise, équipe, famille, école.

> L'identifiant est un petit entier et non un identifiant opaque. Le calcul de
> taille du § 8.6 repose dessus : un identifiant long quadruplerait le poids
> des placements, qui sont la partie volumineuse du fichier.

Un participant porte aussi un **titre pressenti** — « animatrice », « hôte » —
qui est **purement informatif** : il s'imprime sur sa fiche, il n'attribue
aucun rôle, il ne pourvoit aucune place et il ne contraint rien. Il existe pour
qu'une liste reçue où les animateurs sont signalés ne perde pas cette
information à l'import.

Un participant peut être **exclu** sans être supprimé : il reste dans la liste,
il n'est plus placé, et il sort de toutes les statistiques.

**Table** — un numéro à partir de 1, un nombre de sièges, une forme (ronde ou
carrée), une position sur le plan en centimètres. **Le nombre de sièges d'une
table ne change pas d'un tour à l'autre** : c'est une propriété du mobilier.

**Tour** — une des R rondes de la soirée. À chaque tour, chaque participant non
exclu est assis à exactement une table.

**Placement** — pour chaque tour, qui est à quelle table, et à quel siège si
les sièges sont attribués.

**Réservation** — **le seul objet** qui fixe quelqu'un quelque part. Elle lie
une personne à une place, et porte une **portée** : *un tour désigné*, ou *tous
les tours*. Elle contraint la génération, qui l'honore, et elle lui survit.

**Titre de place** — un libellé attaché à **une place**, jamais à une personne :
« ce siège est le siège de l'animateur ». Il ne nomme personne et vaut pour
toute la soirée.

### 4.1 Pourquoi le titre appartient à la place

Si le titre voyageait avec la personne, retirer celle-ci du plan emporterait le
rôle **sans bruit** : la table se retrouverait sans animateur et rien ne le
dirait avant le soir même. Attaché au siège, le titre reste quand son titulaire
part, et le logiciel affiche « table 3 : titre *animateur* non pourvu ».

**Un titre n'est pourvu que par une réservation.** Quelqu'un que le moteur
assoit sur une place titrée n'en devient pas titulaire : la place reste comptée
« non pourvue ». Dériver le rôle de la simple occupation ferait désigner
l'animateur par un tirage au sort, changeant à chaque relance.

Les trois combinaisons se produisent dans une préparation ordinaire :

| cas | ce que l'opérateur fait |
|---|---|
| titre sans réservation | « il faut un animateur à la table 5, on ne sait pas encore qui » — **titre non pourvu**, et la liste de ces titres est sa liste de travail |
| réservation sans titre | asseoir quelqu'un près de la sortie parce qu'il part tôt |
| les deux | le cas courant de l'animateur |

### 4.2 Trois statuts, calculés et non déclarés

| statut | définition |
|---|---|
| **ancré** | une réservation fixe la même table à **chacun** des R tours |
| **mobile** | aucune réservation |
| **partiellement fixé** | le reste : quelques tours, ou des tables différentes |

Le statut se dérive **du fait**, jamais d'une case à cocher ni de la forme du
stockage : qu'il résulte d'une portée « tous les tours » ou de R réservations
de tour désigné sur la même table, le participant est ancré. Une case « est
animateur » posée à côté d'une réservation absente peut mentir ; un statut
calculé ne le peut pas.

Le logiciel **propose** de convertir R réservations de tour désigné en une
portée « tous les tours », et ne le fait pas seul : la conversion change ce qui
arrive quand un tour est ajouté.

### 4.3 La portée « tous les tours » est symbolique

Elle est stockée telle quelle, **jamais développée en R réservations**. La
conséquence tranche un cas limite : retirer le tour 4 puis le remettre retrouve
l'ancrage intact, parce qu'il n'a jamais été énuméré. Une portée matérialisée
obligerait à choisir entre détruire les lignes excédentaires — l'opérateur ne
retrouve pas son travail — et les garder en sommeil, c'est-à-dire porter un
état invisible.

### 4.4 L'exclusion l'emporte

Exclure une personne **suspend toutes ses réservations**, rend ses places aux
mobiles, rend les titres correspondants non pourvus, et le logiciel le dit. La
réintégration les rend. L'exclusion décrit une absence physique : aucune table
ne peut asseoir quelqu'un qui n'est pas là.

---

## 5. Le cœur : le placement

### 5.1 Le problème

Étant donné N participants, T tables de capacités c₁…c_T et R tours, répartir
les gens à chaque tour de façon à **maximiser le nombre de personnes distinctes
que chacun rencontre**, sous les contraintes que l'opérateur active.

### 5.2 L'instance réduite : ce que les réservations changent

Soit k le nombre d'ancrés, dont k_t à la table t. Le moteur résout une
**instance réduite** : n = N − k mobiles, des tables de capacité libre
c′_t = c_t − k_t, les mêmes R tours.

C'est la forme du problème initial **à une donnée près, et elle n'est pas
facultative** : chaque table transporte **l'ensemble des appartenances de ses
ancrés**. Un mobile d'appartenance X placé à une table où siège un ancré
d'appartenance X viole « séparer les appartenances » à **chacun des R tours**.
Réduire sans cette donnée produit un plan qui assoit un invité à côté d'un
collègue animateur tous les tours, **sans qu'aucun indicateur ne s'en
aperçoive**.

Moyennant cet ajout, le moteur n'a **qu'un seul chemin de code** : la
réservation est un prétraitement qui réduit les capacités, retire des
participants et annote les tables — jamais un second algorithme.

### 5.3 Les contraintes, activables une à une

| contrainte | ce qu'elle exige |
|---|---|
| **Séparer les appartenances** | deux personnes de la même appartenance ne partagent pas une table |
| **Nouveaux voisins à chaque tour** | deux personnes ne se retrouvent pas deux fois à la même table |
| **Nouvelle table à chaque tour** | *voir ci-dessous* |
| **Varier les appartenances rencontrées** | sur l'ensemble des tours, chacun rencontre le plus d'appartenances **différentes** possible |
| **Attribuer les sièges** | chacun reçoit un numéro de siège, pas seulement une table |

Ce sont des **objectifs**, pas des interdits : quand la configuration les rend
impossibles à satisfaire toutes, le moteur produit le meilleur compromis **et
dit lequel**, au lieu de refuser.

**« Nouvelle table à chaque tour », énoncée correctement.** La formulation
naïve — « personne ne revient à une table déjà occupée » — est fausse pour un
ancré dès le deuxième tour, et une exception « sauf les animateurs » laisserait
sans réponse le cas d'un participant ordinaire réservé au tour 1. L'énoncé
porte donc sur **ce que le moteur décide** :

> Le moteur n'assoit jamais un participant à une table où il l'a déjà assis, ni
> à une table où l'opérateur l'a placé.

Aucune exception n'est nécessaire. Pour un ancré, le moteur ne décide rien : la
règle est vraie sans rien exiger.

**« Varier les appartenances » n'est pas « séparer les appartenances ».** La
première porte sur **celle des autres**, **à travers les tours** ; la seconde
sur **la sienne**, **à l'intérieur d'un tour**. Elles s'activent séparément.

### 5.4 Les indicateurs

Tout placement proposé porte les mêmes chiffres, pour que la comparaison soit
une lecture et non un jugement :

| indicateur | définition |
|---|---|
| **personnes distinctes rencontrées** | sur l'ensemble des tours ; une personne revue compte une fois |
| **paires de même appartenance** | paires distinctes assises ensemble |
| **rencontres répétées** | paires réunies plus d'une fois |
| **nombre maximal de rencontres d'une même paire** | |
| **retours à une table déjà occupée** | *voir ci-dessous* |
| **appartenances distinctes rencontrées** — A(p) | nombre d'appartenances différentes portées par les personnes **affiliées** que p rencontre, **la sienne comprise** |
| **redondance d'appartenance** — r(p) | \|F(p)\| − A(p), où F(p) sont les affiliés rencontrés ; r = 0 signifie qu'aucune appartenance n'a été recroisée |
| **taux de diversité** — d(p) | A(p) / \|F(p)\| ; « — » quand \|F(p)\| = 0 |

**Les agrégats portent sur tous les participants placés.** Le minimum et la
moyenne se calculent sur l'ensemble, ancrés compris, et **deux lignes
secondaires** donnent la même mesure restreinte aux **mobiles** et aux
**ancrés**. Un participant partiellement fixé compte parmi les mobiles.

> Un ancré n'est pas structurellement désavantagé : à table de 8 avec un seul
> ancré et R = 4, son plafond vaut 28, exactement celui d'un mobile visitant
> quatre tables de 8. Le retirer du minimum cacherait un animateur réellement
> mal servi, qui est précisément la personne dont on veut connaître le sort.
> Les deux lignes secondaires existent pour que l'opérateur sache si le minimum
> global désigne un défaut qu'une relance corrige, ou la conséquence de son
> propre plan de réservation.

**Le minimum compte plus que la moyenne.** Il décrit le sort de la personne la
plus mal servie, qui est celle qui se plaindra.

**Quand une population est vide, le logiciel écrit « — », jamais zéro.** Un
ensemble vide n'est pas une mesure nulle.

**Ce que le moteur a décidé, et ce que les réservations imposent.** L'indicateur
« retours à une table » ne compte que les retours **choisis par le moteur** ;
ce que les réservations imposent est énoncé **à part et chiffré** — « 99
retours imposés par 33 ancrages ». Sinon l'indicateur affiche la même valeur
pour toute proposition et cesse de les séparer. La même lecture vaut pour les
rencontres répétées entre deux personnes réservées à la même table.

**Les indicateurs se mesurent sur le plan complet**, les N participants et les
R tours, comme si les réservations n'existaient pas. Des formes closes servent
au diagnostic préalable ; elles ne corrigent jamais après coup un chiffre
mesuré. Deux arithmétiques pour une même quantité sont le mode de défaillance
que le § 13.2 interdit.

### 5.5 Le plafond et la borne prouvée

Deux notions, **deux noms, jamais trois**.

Le **plafond** est une borne arithmétique, **individuelle**, toujours
calculable. La **borne prouvée** est l'affirmation plus forte qu'une
construction l'atteint. Elle seule autorise la mention « minimum atteint ».

**Une seule formule, paramétrée par l'itinéraire.** Écrire une formule par
statut garantit qu'elles se contrediront, et aucune ne couvrirait un
participant partiellement fixé. Pour une personne p et un itinéraire — la table
qu'elle occupe à chaque tour :

- D = les tables **distinctes** visitées, m_t = tours passés à la table t ;
- a_t = le nombre d'**ancrés** de la table t, p non compté ;
- v_t = c_t − 1 − a_t = les sièges qui changent d'occupant ;
- n_p = n − 1 si p est mobile ou partiellement fixé, n s'il est ancré.

```
plafond(p) = min( N − 1 , Σ a_t + min( n_p , Σ m_t · v_t ) )
                          t∈D              t∈D
```

Les ancrés d'une table visitée sont rencontrés **une fois**, quel que soit le
nombre de tours passés là ; les sièges libres se renouvellent, mais ne peuvent
livrer plus de personnes qu'il n'existe de mobiles.

> Le terme `min(n_p, …)` n'est pas décoratif. Un ancré **ne rencontre jamais
> les ancrés des autres tables**. Sans ce terme, sur 4 tables de 5 avec un
> ancré chacune et 5 tours, la formule annonce 19 là où 16 est le vrai maximum :
> l'opérateur voit à perpétuité un animateur « à 84 % de son plafond » et
> relance une génération qui ne peut rien.

**Deux moments, deux noms.** Le plafond dépend de l'itinéraire :

- le **plafond a priori**, maximisé sur les itinéraires admissibles, affiché par
  le diagnostic **avant** la recherche ;
- le **plafond réalisé**, calculé sur l'itinéraire de la proposition, affiché à
  côté de la mesure.

Sans ce partage, le diagnostic annonce 28, la page de qualité affiche 27, et
l'opérateur conclut à une régression du moteur.

**Deux chemins seulement concluent « minimum atteint ».**

1. *Par certificat* — une proposition **égale** le plafond. Ce chemin ne
   suppose rien.
2. *Par famille connue* — l'instance appartient à une famille dont la
   construction parfaite est démontrée. **Les conditions portent sur l'instance
   réduite**, pas sur l'instance complète, et les deux sens se produisent.

**Un réduit parfait ne prouve pas le plafond complet**, et c'est vérifié par
énumération : 16 mobiles, 4 tables de 5 dont une place ancrée chacune, 5 tours.
Le réduit — 16 points, blocs de 4 — est un plan affine d'ordre 4, chaque mobile
rencontre bien les 15 autres. Son plafond vaut pourtant 19 et n'est pas
atteint : aucune affectation des blocs aux tables ne donne plus de **2** tables
distinctes au mobile le plus mal servi, soit 17 sur 19. La construction porte
sur le réduit ; le plafond sur le complet ; **l'affectation des blocs aux tables
est un troisième objet**, et c'est lui qui décide.

Quand aucun chemin ne conclut, le logiciel affiche l'écart et écrit
**« atteignabilité inconnue »**, jamais « peut mieux faire » : l'un invite à
relancer, l'autre dit que relancer ne prouvera rien.

**La borne de diversité.** Soit G le nombre d'appartenances déclarées et g_p
l'effectif de celle de p :

```
A_max(p) = min( Φ(p) , G , (N − g_p) + 1 )
```

où Φ(p) est le plafond recalculé en ne comptant comme occupants que les
affiliés. Le « + 1 » compte sa propre appartenance, qu'un collègue rencontré
suffit à apporter : sans lui, un événement où tout le monde partage une
appartenance annoncerait A_max = 0 alors que chacun en rencontre une.

### 5.6 Le diagnostic, avant la recherche

Certaines configurations rendent un conflit **inévitable**, quel que soit
l'algorithme. Le logiciel les détecte **avant** de chercher et énonce ce qui est
inévitable, **combien**, et ce qui le rendrait évitable :

- plus de personnes d'une appartenance que de tables → « au moins 8 paires de
  collègues » ;
- redondance minimale `r_min(p) = max(0, |F(p)| − G)` → « au moins 6
  appartenances recroisées par personne ; avec 3 tours au lieu de 4, aucune ne
  le serait » ;
- **tous les animateurs de même appartenance** → chaque mobile accumule au
  moins min(R, T) − 1 redondances qu'aucune recherche ne réduit. Remède : les
  laisser sans appartenance déclarée, ou leur en donner des distinctes ;
- **taux d'ancrage par table** : une table dont tous les sièges sont ancrés ne
  tourne plus ; une table à moitié ancrée réduit d'autant le brassage de tout
  l'événement.

Un opérateur à qui l'on dit « c'est impossible, voici pourquoi, voici le
remède » cesse de relancer en espérant mieux.

### 5.7 Plusieurs propositions, pas une

Une génération produit **plusieurs placements distincts et comparables**, en
nombre réglable. Les générations **s'accumulent** : relancer avec d'autres
réglages ajoute des candidats plutôt que d'effacer les précédents, et un
classement unique les ordonne tous. Une commande efface la liste en épargnant
celui qui est retenu.

**La recherche descend un scalaire ; le classement affiché est un ordre
explicite**, écrit dans l'interface. Confondre les deux ferait dépendre l'ordre
de poids internes que l'opérateur ne voit pas.

Ordre par défaut : minimum de personnes rencontrées, puis paires de même
appartenance, puis rencontres répétées, puis **redondance d'appartenance comme
départage**. Ce rang se justifie par l'asymétrie des gains — rencontrer une
personne de plus est un gain certain, rencontrer une appartenance de plus est un
raffinement. Mettre la diversité au-dessus ferait **refuser un contact neuf**
parce que l'appartenance du voisin est déjà croisée.

Un départage ne se déclenchant presque jamais, les chiffres de diversité sont
affichés **en colonne pour chaque proposition**, et non pour la seule gagnante.

### 5.8 Le placement à la main

L'opérateur peut asseoir des gens **avant toute génération** : ce sont des
réservations. La génération les honore et place les autres autour. Une commande
transforme un placement partiel en placement complet, le générateur comblant les
vides.

Une fois un placement retenu, le même geste déplace une personne réelle. **Le
geste est identique ; ce qui change est l'état des données**, et l'interface le
dit, pour que l'opérateur sache lequel des deux il fait.

**Une commande assistée, « Poser les animateurs »**, prend les participants
portant un titre pressenti donné et crée pour chacun une réservation de portée
« tous les tours » **et** un titre sur la place visée. Un geste, une entrée
d'historique, tous les refus évalués avant d'appliquer quoi que ce soit.

### 5.9 Ce que le logiciel refuse, au moment du geste

Ces contrôles s'exécutent **à la pose**, jamais à la génération : un échec de
génération que rien n'explique coûte une relance inutile et la confiance mise
dans l'outil.

- **k_t > c_t** — plus d'ancrés que de sièges : refusé.
- **k_t = c_t** — table entièrement gelée : accepté, **signalé**, parce que
  c'est rarement l'intention.
- **Σ (c_t − k_t) < n** — il manque des places à chaque tour : refusé, avec le
  nombre de places manquantes.
- Réserver plus de places qu'une table n'en a ; un siège inexistant ; la même
  personne à deux places sur un même tour ; une personne exclue.
- Déposer quelqu'un sur une place réservée à un autre, ou l'échanger avec elle.
  **Déplacer la réservation** est une commande séparée et explicite.

Un refus **nomme sa cause et propose le geste qui le lève**, et se manifeste
**sur la place concernée**, pas dans une boîte de dialogue. Seul un geste qui
détruit de la saisie ouvre une fenêtre à confirmer : une suite de modales
apprend à cliquer sans lire, et le premier refus qui comptait passe inaperçu.

### 5.10 Le coût d'évaluation

A(p) et r(p) demandent de parcourir les personnes rencontrées par chacun.
Recalculés intégralement à chaque candidat d'une recherche locale, ils dominent
le temps de génération. Le moteur les met à jour **de façon incrémentale**, sur
les seules tables modifiées. C'est une exigence de faisabilité : sans elle,
l'objectif existe dans l'interface et ne converge pas dans le temps que
l'opérateur accorde.

Le logiciel **éprouve l'incrémental contre le recalcul complet** sur chaque
configuration de démonstration.

---

## 6. Les sièges d'une table

### 6.1 Un défaut d'événement, des surcharges par table

L'événement porte un **nombre de sièges par défaut**. Toute table créée **suit**
ce défaut ; elle n'en garde pas une copie. Une table peut recevoir une
**surcharge** et cesse alors de le suivre.

| état d'une table | ce que cela veut dire |
|---|---|
| **suit le défaut** | sa capacité vaut le défaut et change avec lui |
| **surchargée** | sa capacité est fixée à la main, le défaut ne l'atteint plus |

*Réaligner* n'est pas un troisième état : c'est la commande qui retire une
surcharge. **L'interface montre l'état, pas seulement la valeur** — une table à
8 qui suit un défaut de 8 et une table surchargée à 8 affichent le même nombre
et réagissent différemment au prochain changement.

**Changer le défaut n'écrase aucune surcharge.** Une saisie manuelle table par
table disparaîtrait sinon sans trace, et l'écart ne se découvrirait qu'à
l'impression.

Le logiciel **énonce la conséquence chiffrée avant de l'appliquer** :

> « 9 tables suivent le défaut et passent de 8 à 10 places ; 4 tables
> surchargées (7, 7, 6, 12) ne changent pas. Total : 104 → 122 sièges pour 118
> participants. »

Deux boutons : appliquer, ou appliquer **et réaligner les 4 surchargées** — le
second geste est séparé parce qu'il détruit de la saisie.

**Un changement de défaut est une seule entrée d'historique**, quel que soit le
nombre de tables touchées. **Baisser le défaut** subit les refus du § 6.2, et
le logiciel les évalue **toutes avant d'en appliquer aucune** : si une seule
table refuse, l'opération entière est refusée, nommément, et rien ne change.

### 6.2 Ce que le logiciel refuse

- **Moins de 2 sièges.** Une table à 1 place est un participant qui ne
  rencontre personne de la soirée — c'est ce que le logiciel existe pour éviter.
- Une capacité inférieure au nombre de réservations portées par la table.
- Une réduction qui retire un siège portant une réservation ou un titre — les
  sièges disparaissent par numéro décroissant ; le refus les liste.
- Une capacité non entière, négative, ou saisie en texte.

Deux cas **avertissent sans refuser** : réduire sous le nombre de personnes
assises (les surnuméraires vont dans la réserve visible, nommément listées,
jamais effacées en silence) ; et dépasser le nombre de sièges au-delà duquel le
dessin cesse d'être lisible — seuil **mesuré** au sens du § 14.1.

---

## 7. Le plan de salle

C'est la surface de travail, du début à la fin. Il est dessiné en **SVG** et
l'opérateur agit directement dessus.

### 7.1 Les gestes

| geste | effet |
|---|---|
| cliquer une chaise | sélectionne la place — l'assigner, la réserver, lui donner un titre |
| glisser une personne sur un siège libre | la déplace |
| glisser une personne sur une autre | les échange |
| glisser une personne hors des tables | la retire du tour ; elle attend dans la **réserve** visible |
| glisser une table | change sa position |
| tirer la poignée d'une table | **change son nombre de places** |
| survoler une table en conflit | affiche le détail des règles violées |
| zoomer, déplacer la vue | change le cadrage |

Un **menu par personne** offre les mêmes actions sans glisser, pour le tactile
et le clavier.

**La poignée pilote le nombre de places, jamais une taille libre.** Chaque table
est dessinée à l'échelle de son nombre de sièges ; une taille libre permettrait
un dessin qui ment sur la capacité, et ce mensonge n'apparaîtrait sur aucun
indicateur. En tirant, l'opérateur fait défiler des nombres entiers ; les
chaises apparaissent et disparaissent sous le pointeur.

**La poignée refuse de descendre sous le nombre de sièges occupés, tous tours
confondus** — sinon un geste de géométrie désassoit deux personnes au troisième
tour, que l'opérateur ne regarde pas. Le logiciel nomme le nombre bloquant et le
tour concerné.

**La rotation d'une table carrée n'existe pas dans la première itération** :
elle introduirait une orientation dans la numérotation des sièges et dans la
position de la liste de noms. Le logiciel n'offre aucune poignée de rotation,
plutôt qu'une poignée qui dérange la numérotation.

### 7.2 Les coordonnées

C'est l'endroit où un plan interactif se casse, silencieusement, et seulement
quand on a zoomé.

**Le `<svg>` racine ne porte pas de `viewBox`**, ni bordure ni remplissage. Son
unité est donc le pixel CSS. La formule qui répartit la position du pointeur
dans la largeur d'un `viewBox` est fausse dès que les rapports diffèrent : le
moteur de rendu centre le dessin, laisse des bandes vides, et le plan répond
juste au centre et faux sur les bords. Supprimer la cause vaut mieux que
corriger l'effet.

**L'état de vue est trois nombres** : `k`, l'échelle en **pixels par
centimètre**, et `tx`, `ty` en pixels. Le plan vit dans un unique groupe
`<g transform="translate(tx,ty) scale(k)">` : zoomer écrit **un attribut sur un
élément**.

**La conversion est une fonction pure**, donc éprouvée sous `node` :

```
dessin_depuis_ecran(vue, cadre, xEcran, yEcran) =
    { x: (xEcran − cadre.gauche − vue.tx) / vue.k,
      y: (yEcran − cadre.haut   − vue.ty) / vue.k }
```

Trois invariants la rendent vraie, et **chacun est une épreuve** : pas de
`viewBox` ; ni bordure ni remplissage sur le `<svg>` ; **aucun ancêtre portant
une transformation CSS** — elle déplacerait le rectangle sans déplacer les
unités, et le plan répondrait faux partout.

Une épreuve en navigateur confronte la fonction pure à
`getScreenCTM().inverse()`. Ce n'est pas une seconde implémentation : c'est un
**oracle** fourni par le moteur de rendu.

**Le zoom se fait sous le curseur**, sinon le contenu fuit vers un coin et
l'opérateur poursuit la table qu'il visait.

**Les bornes du zoom sont relatives, jamais absolues** : `k` reste entre
`0,5 × k_ajusté` et 10 px/cm. Une borne basse absolue est une erreur
démontrable — sur un portable de 1 366 × 700, un plan de 36 m s'ajuste à
`k ≈ 0,19 px/cm`, et un plancher fixé à 0,2 rendrait l'ajustement à la fenêtre
**impossible sur la configuration de démonstration elle-même**.

**Le plan vide** — aucune table — n'a pas de rectangle englobant : `k_ajusté`
vaut 1 px/cm, l'origine est centrée. Sans cette règle, l'ajustement divise par
zéro et rend `k = Infinity`, que le `transform` accepte sans rien dessiner et
sans rien signaler.

**Un glissement se calcule en écart, jamais en position absolue** — sinon la
table saute au premier mouvement pour mettre son origine sous le pointeur.

Le logiciel **ne lit ni `getBBox()` ni `getScreenCTM()` dans un
`pointermove`** : ces appels forcent un recalcul de mise en page au milieu de
la boucle d'images.

### 7.3 Le pointeur et le tactile

**La capture du pointeur est obligatoire**, et elle porte sur la **racine
`<svg>`**, pas sur la table. Sans capture, un mouvement rapide sort le curseur,
les événements vont à ce qui est dessous, le `pointerup` n'arrive jamais et la
table reste collée au curseur. Et si le composant remplaçait l'élément capturant
pendant le glissement, la capture serait perdue — raison pour laquelle le
logiciel écrit l'attribut `transform` **directement** pendant le glissement et
ne confie le résultat au modèle qu'au `pointerup`.

**Pendant une capture, `ev.target` désigne l'élément capturant, pas ce qui est
sous le pointeur.** Le logiciel ne cherche donc **pas la cible d'un dépôt dans
le DOM** : il convertit le point en coordonnées de dessin et demande au module
de géométrie quel siège le contient. Le dépôt devient une fonction pure,
éprouvable sous `node`, qui ne peut pas diverger du dessin puisque c'est elle
qui place les chaises.

**`pointercancel` est une annulation, pas une fin** : le logiciel remet la table
où elle était. La touche d'échappement et le passage en lecture font de même.

**Le tactile.** `touch-action: none` sur le plan, sans quoi le navigateur
interprète le glissement comme un défilement avant de livrer le moindre
`pointermove` — la panne tactile la plus fréquente, et la plus déroutante
puisqu'à la souris tout marche.

**La taille des cibles dépend du zoom, et la règle doit le dire.** Deux sièges
voisins d'une table de 8 sont à 60 cm ; une cible de 44 px exige
`k ≥ 0,73 px/cm`, le plancher de 24 px exige `k ≥ 0,40` — tandis que
l'ajustement d'une salle entière donne `k ≈ 0,2 à 0,45`. **Au cadrage le plus
utile, un siège n'est pas pointable au doigt.** La règle est donc : sous le zoom
où la cible tomberait en deçà de 24 px, **les sièges cessent d'être des cibles
et la table devient la cible**, le siège se choisissant dans son panneau. Le
logiciel le montre en cessant de dessiner les chaises individuellement, plutôt
qu'en laissant l'opérateur manquer sa cible sans comprendre.

**Il n'y a pas de survol au doigt** : le détail d'un conflit est accessible par
survol, par focus clavier **et par pression longue** — un seul composant
d'infobulle, trois déclencheurs.

**Un seul écouteur sur la racine**, la cible étant identifiée par
`closest('[data-siege]')`. Les mouvements sont **regroupés par image**.

**Le clavier n'enfile pas 264 arrêts de tabulation** : le plan est **un seul
arrêt**, les flèches passent d'une table à l'autre, l'entrée descend dans ses
sièges, l'échappement remonte.

### 7.4 Le texte

`<text>` n'a **aucun retour à la ligne** : chaque ligne d'une liste est un
`<tspan>` à décalage vertical explicite. La largeur se **mesure** par
`getComputedTextLength()` sur la police rendue ; la hauteur de ligne se mesure
sur un gabarit portant capitales accentuées et jambages — « Ôjgq », « Æ »,
« W » — jamais une chaîne moyenne, jamais déduite de la taille de police.

Le logiciel **n'emploie pas `textLength`** : cet attribut comprime les glyphes
et produit un nom déformé plutôt qu'un nom tronqué.

**La troncature se décide par document, pas par support :**

| document | règle |
|---|---|
| le plan de salle, à l'écran **comme au PDF** | **abrège** avec une marque, la largeur d'un bloc de noms étant la même contrainte des deux côtés |
| la fiche, la feuille par table, la liste d'accueil | **ne tronquent jamais** : elles replient |

Un nom coupé sur la feuille que tient le personnel de salle ne sert à personne ;
un nom de deux cents caractères déployé sur un plan de 33 tables détruit la
page.

### 7.5 Les tables en conflit

Une table dont le placement viole une règle active se signale par une classe
posée à partir des indicateurs du moteur — **le plan ne recalcule rien, il
lit**.

Le signal **ne repose pas sur la seule couleur** : contour épaissi, trame, et
une **pastille portant le nombre de violations**. Une part notable des
opérateurs ne distingue pas un rouge d'un vert.

**Quand toutes les tables sont en conflit, le plan cesse de signaler quoi que ce
soit** — cas que le diagnostic sait prédire. La pastille chiffrée garde sa
valeur puisqu'elle ordonne les tables entre elles, et le bandeau énonce le
diagnostic plutôt que de laisser compter des contours rouges.

### 7.6 Le vocabulaire visuel des places

**Aucun état ne se distingue par la seule couleur** : chacun porte une forme.
Les marques sont **dessinées en SVG**, jamais écrites avec des caractères
emoji — leur présence et leur rendu dépendent des polices installées, ce qu'une
livraison hors ligne ne contrôle pas.

| information | canal |
|---|---|
| réservée à une personne / titre seul / ni l'un ni l'autre | **cadenas fermé** / **cadenas ouvert** / aucune marque |
| pourvue / à pourvoir | remplissage **plein** / **hachuré** |
| portée « tous les tours » | **anneau** autour de la chaise |

**La chaise porte au plus deux marques ; la liste porte le texte.** Trois
glyphes empilés sur une chaise deviennent illisibles au zoom par défaut. La
liste numérotée énonce l'état en toutes lettres — « 1. (réservée, tous les
tours) Nom — *animateur* » — et c'est elle qui fait foi.

### 7.7 L'échelle, et ce que le logiciel refuse d'affirmer

**L'unité du modèle est le centimètre réel**, dès le premier fichier. Le
diamètre d'une table ronde se déduit de son nombre de places :

```
diamètre = max(70, places × 60 / π)        en centimètres
```

Soit 115 cm pour 6 places, 153 pour 8, 191 pour 10. **Le plancher n'est pas
cosmétique** : en deçà de six convives ce n'est plus le périmètre qui borne la
table mais le plateau, et la formule seule dessinerait des guéridons. Les deux
valeurs sont des **réglages par défaut, non des normes vérifiées** ; un diamètre
saisi à la main l'emporte.

**Les étiquettes ne sont pas à l'échelle, le mobilier l'est.** Une liste de dix
noms couvre plusieurs mètres carrés fictifs. **Le plan à l'échelle du bâtiment
est le plan listes masquées**, et le logiciel le dit sur chaque impression
portant les listes.

**Tant qu'aucune dimension de salle n'est saisie, le plan est exact dans ses
tables et arbitraire dans son cadre.** Le logiciel porte alors, sur le plan et
sur **chaque impression**, la mention « disposition relative — l'encombrement
dans la salle n'est pas vérifié ». Une mention imprimée coûte une ligne ; un
montage à refaire coûte une soirée.

Une fois les dimensions saisies, **le logiciel mesure et rapporte, il ne déclare
pas conforme.** Le mot « conforme » est absent de l'interface tant que les
dégagements de référence ne sont pas établis.

**Toute impression porte une échelle graphique**, non la seule mention
« 1:100 » : une impression ajustée à la page change le facteur sans prévenir, et
le chiffre devient un mensonge tandis que la règle graphique reste juste.

**Pourquoi poser l'unité maintenant**, alors que la première itération n'exige
aucun contrôle d'encombrement : le coût est nul aujourd'hui, et plus tard c'est
une migration silencieuse — tous les fichiers enregistrés porteraient des
coordonnées dans une unité arbitraire, que rien ne distingue des nouvelles.

---

## 8. Les événements : fichiers, enregistrement, historique

### 8.1 Un événement, un fichier, une liste

Chaque événement vit dans **son propre fichier d'état**, complet et autonome. Ce
fichier seul suffit à rouvrir, imprimer et transmettre ; l'historique vit à côté
et n'est jamais nécessaire pour ouvrir.

**Ce que le fichier porte :**

| | |
|---|---|
| participants | avec identifiant entier, titre pressenti, notes |
| tables | capacité **et son état** : `sieges: null` (suit le défaut) ou un entier (surcharge) |
| le **nombre de sièges par défaut** de l'événement | |
| tours, réglages, réservations avec leur portée, **titres de place** | |
| placements engendrés, celui qui est retenu, état du plan | |
| **positions en centimètres**, et l'unité déclarée | |
| **filiation** : nom et identifiant de la source, instant d'origine | |

**Ce que le fichier ne porte pas : ni le mode, ni le cadrage.** Une liste de ce
qui est dedans, sans son complément, laisse l'implémenteur ajouter.

Le logiciel ouvre sur une **liste des événements**, avec pour chacun le nom, la
date, l'état, le nombre de participants, la dernière modification et le chemin.
**Un répertoire vide n'affiche pas une liste vide** : il présente la commande de
création et les démonstrations — une liste vide sans issue est le premier écran
que voit un opérateur qui lance l'exécutable.

Le logiciel n'ouvre **qu'un événement à la fois**, et ferme le précédent sans
question : il n'y a rien à enregistrer.

### 8.2 L'enregistrement et l'entrée d'historique sont le même événement

Toute modification passe par une **commande nommée**. Quand elle s'achève, le
logiciel **ajoute une entrée** au journal, **puis écrit le fichier d'état**.
Jamais l'un sans l'autre.

> **un geste achevé ⇔ une entrée d'historique ⇔ un état enregistré**

Il n'existe donc aucun état sur le disque que l'opérateur ne puisse nommer, et
aucun travail « non enregistré ».

**L'ordre n'est pas indifférent : le journal d'abord.** Une panne entre les deux
laisse un journal en avance d'une entrée, cas dont le logiciel se relève seul en
comparant les numéros de révision. L'ordre inverse perdrait le geste sans trace.

**Ce qui achève une commande est la fin du geste, jamais un minuteur** : le
relâchement du pointeur, la sortie d'un champ, la validation d'un formulaire, la
fin d'un calcul. Un intervalle de temps ferait tomber la frontière **au milieu
d'un geste** — une personne enlevée d'un siège et pas encore posée.

**Est une entrée exactement ce qui change le contenu du fichier.** Changer de
tour affiché, zoomer, mettre en évidence, masquer les listes **n'en sont pas**.
Déplacer une table **en est une** : sa position est une donnée du plan.

**Chaque entrée porte un libellé en français, figé à l'écriture** — « Déplacé
Camille Roy de la table 4 à la table 7, tour 2 ». Jamais reconstruit ensuite :
les objets nommés peuvent avoir disparu, et un historique qui affiche « déplacé
‹participant supprimé› » ne sert plus à rien.

**L'ordre des entrées est celui des lignes, jamais celui des horodatages.** Une
horloge reculée rendrait le tri non monotone.

### 8.3 Le retour arrière : on revient à un instant

**Le logiciel restitue un état, il ne défait pas un geste.** L'opérateur, lui,
lit une liste de gestes : chaque instant est présenté par le libellé qui l'a
produit.

Défaire en appliquant un inverse exigerait d'écrire et d'éprouver un inverse par
commande, et **un inverse faux corrompt le plan sans rien signaler**. Un état
restitué ne peut pas être faux : il a existé.

**Le journal ne se tronque jamais.** Revenir **ajoute une entrée** dont l'état
résultant est l'état visé. L'historique classique, qui efface la suite dès qu'on
modifie après avoir défait, perd exactement le travail qu'un opérateur pressé
vient de mettre de côté pour essayer autre chose.

**Le fil courant** se définit par un parcours arrière : le prédécesseur d'une
entrée ordinaire est celle qui la précède ; le prédécesseur d'une entrée de
retour est **l'entrée qu'elle vise**. *Défaire* vise le prédécesseur sur ce fil.
*Refaire* n'existe que tant que les dernières entrées sont des retours. La liste
**distingue le fil courant des fils abandonnés** : un opérateur qui croit
remonter son fil et atterrit sur un fil mort obtient un état légitime, jamais
celui qu'il visait.

**Les jalons.** L'opérateur peut **nommer l'instant courant**, et filtrer
l'historique sur les instants nommés. Nommer ne modifie pas le contenu : c'est
une **ligne de marque**, pas une entrée, sinon l'équivalence du § 8.2 serait
fausse. Le logiciel nomme automatiquement la création, chaque changement d'état,
et l'instant qui précède chaque génération.

### 8.4 Le mode lecture, par défaut

**Le logiciel ouvre tout événement en lecture.** Toujours, y compris celui qui
était en écriture à la fermeture précédente. Le mode n'est pas écrit dans le
fichier : c'est une posture de la séance, pas une propriété du plan.

**En lecture, aucun geste ne modifie quoi que ce soit**, et le fichier n'est pas
écrit. **Ouvrir un événement ne réécrit jamais son fichier d'état.**

**Ce qui reste vivant en lecture** : le sélecteur de tour, le zoom, le cadrage,
l'ajustement, le plein écran, la mise en évidence, l'affichage des listes, la
**page de qualité** et ses exports, la comparaison des propositions, la lecture
de l'historique, l'impression. C'est la condition pour que la protection
tienne : si naviguer exigeait de passer en écriture, l'opérateur y resterait en
permanence et le mode lecture ne protégerait plus rien.

**On en sort par un seul geste délibéré** — une commande « Modifier » à place
fixe — et le logiciel y retourne **seul après inactivité**. Ce retour ne coûte
rien et ne perd rien, puisque tout geste achevé est déjà sur le disque.

**Le compteur d'inactivité ne court pas pendant un geste** : il est suspendu
tant qu'un pointeur est enfoncé, qu'un champ contient une saisie non validée ou
qu'un calcul tourne. Le retour **automatique** ne peut donc jamais tomber
pendant un geste ; le retour **explicite**, lui, annule un glissement en cours
comme le ferait un `pointercancel`.

**Le mode est visible sur la surface de travail elle-même** — un cadre et un
libellé permanents autour du plan — et non dans un coin de barre d'outils :
l'opérateur regarde le plan.

**Fermer en mode écriture ne coûte rien**, et **le logiciel ne pose jamais la
question « enregistrer les modifications ? »** : un opérateur ne sait pas ce que
contient un tampon.

**Seconde protection, à l'intérieur du mode écriture** : un clic n'est pas un
glisser. Le déplacement ne commence qu'au-delà d'un seuil de mouvement
**mesuré** sur la tolérance réelle d'un pavé tactile, et s'abandonne par Échap.

### 8.5 Mode et état : deux axes, pas une énumération

Le mode **n'est pas un cinquième état**. L'état décrit **où en est le plan** et
voyage avec le fichier ; le mode décrit **ce que la main a le droit de faire** et
ne quitte pas la séance.

Il n'y a donc **jamais trois comportements à tenir, mais deux** — lecture et
écriture — dont l'un est atteint par deux chemins : le défaut d'ouverture, et
l'état bloqué qui le force en remplaçant « Modifier » par « Débloquer ».

**Bloqué et lecture se ressemblent et diffèrent en nature.** Bloqué est inscrit
dans le fichier, vaut pour toutes les séances, et ne se lève que par une
commande nommée : on bloque un plan pour le distribuer. Lecture est la posture
par défaut, à un clic de l'écriture. Les confondre donnerait l'un des deux
désastres : déverrouiller un plan distribué deviendrait aussi facile qu'un clic
involontaire, ou déplacer une personne dans un brouillon exigerait de
« débloquer ».

**Le cadrage se range avec le mode, hors du fichier** — dans un réglage local de
la machine indexé par l'identifiant de l'événement. Écrire le zoom dans le
fichier d'état contredirait l'équivalence du § 8.2, et **zoomer sur un plan
bloqué écrirait dans le fichier d'un plan qui refuse toute modification**. Ce
réglage n'est ni transmis avec le fichier, ni restitué par un retour arrière.

### 8.6 Les fichiers

**Emplacement** : un dossier nommé d'après le produit, dans les *Documents* de
l'opérateur — pas dans un répertoire de données caché. Il doit pouvoir copier un
événement sur une clé, le joindre à un courriel, le restaurer depuis sa
sauvegarde, **sans le logiciel**.

**Deux fichiers par événement :**

| fichier | contenu | écriture |
|---|---|---|
| `<nom>.gtt.json` | l'état courant, complet | réécrit en entier à chaque entrée |
| `<nom>.gtt-journal.jsonl` | les entrées d'historique | **ajout en fin**, une ligne par entrée |

Les deux portent **l'identifiant interne de l'événement**, et c'est lui qui les
apparie — jamais leurs noms.

**Le nom du fichier dérive du nom de l'événement** — un dossier d'identifiants
opaques est inutilisable dans un explorateur. La dérivation retire les
caractères que Windows refuse, **refuse les noms réservés quelle que soit la
casse**, **compare les collisions sans égard à la casse** (le système de
livraison y est insensible, celui de développement non), **borne le chemin
complet sur le plus long des deux suffixes** (sinon l'état tient et son journal
déborde), et **retombe sur un nom générique** quand la dérivation ne laisse
rien. **L'autorité reste le nom inscrit dans le fichier.**

**Pourquoi l'historique n'est pas dans le fichier d'état**, pour deux raisons
distinctes. *La taille* : un plan de 260 personnes sur 4 tours pèse de l'ordre
de 250 ko avec une vingtaine de propositions ; 500 entrées en instantanés
complets pèseraient **de l'ordre de 125 Mo** — d'où les **correctifs**, avec un
instantané tous les cinquante au plus, pour qu'aucune restitution ne demande
plus de cinquante applications. *Le couplage* : un journal illisible n'empêche
jamais d'ouvrir le plan ; transmettre un plan ne transmet pas quatre cents
gestes portant les noms des personnes retirées ; vider l'historique est le
remplacement d'un fichier.

**Une ligne illisible arrête la lecture** : le logiciel écarte cette entrée **et
tout ce qui suit**, et annonce le nombre. Reprendre après elle ferait suivre un
correctif à un instant qui n'est pas le sien.

**Taille bornée** : au moins les cinq cents dernières entrées, et au-delà
élagage sur **frontière d'instantané**. **Le plancher l'emporte sur le plafond**
— un historique qui affiche un instant qu'il ne sait plus reconstruire est pire
que pas d'historique.

### 8.7 Copier, renommer, importer, supprimer

**Copier** produit un nouvel événement avec une identité propre. Le logiciel
**demande le nom avant de créer** ; sans cela les noms s'empilent en « (copie)
(copie) ».

**L'historique ne se copie pas.** La copie démarre sur une entrée unique :
« Créée par copie de ‹nom›, à l'instant ‹libellé› ». Rejouer les entrées de
l'original promettrait un retour arrière qui ramènerait le contenu de
l'original — exactement ce dont l'opérateur voulait diverger. La **filiation**
est conservée comme un fait inscrit dans le fichier.

**La copie d'un plan bloqué n'est pas bloquée** : son état se déduit de son
contenu. Copier un plan bloqué est le geste même de « le plan distribué reste
figé, je travaille sur une variante ».

**Renommer** change les **deux** fichiers : le logiciel écrit d'abord la paire
complète sous les nouveaux noms, puis supprime l'ancienne — jamais l'inverse.
Une panne laisse alors deux paires, ce qui se voit et se répare, au lieu
d'aucune.

**Importer** un fichier venu d'ailleurs le **copie** dans le dossier de travail.
Travailler en place écrirait dans un dossier de téléchargements que l'opérateur
vide régulièrement.

**Supprimer** déplace tous les fichiers dans une `corbeille/` datée. Le logiciel
ne la vide jamais de lui-même et affiche ce qu'elle contient : un opérateur qui
croit avoir supprimé les coordonnées d'une personne les a en réalité déplacées.

### 8.8 Ce qui résiste à une panne

Ces garanties sont des propriétés de l'implémentation **`electron`**, celle qui
est livrée. L'implémentation `browser`, de développement, n'offre ni renommage
atomique ni verrou, et **le logiciel l'annonce au démarrage sur cette
plateforme**.

- **Écriture atomique** : fichier temporaire dans le même répertoire, vidé sur
  le disque, puis **renommé par-dessus**. Sous Windows ce renommage échoue tant
  qu'un antivirus ou un agent de synchronisation tient la cible ouverte : le
  logiciel réessaie, puis renonce en nommant le fichier, et **un renommage qui
  échoue ne détruit jamais la cible**.
- **Une génération de secours** sous `.precedent`. Le renommage atomique protège
  d'une panne ; il ne protège pas d'une écriture complète mais fautive.
- **À l'ouverture, le logiciel ne repart jamais de zéro en silence** : il nomme
  le fichier illisible et propose la version précédente, puis le dernier instant
  du journal. Créer un événement vide est la défaillance qui perd une soirée,
  parce que l'enregistrement automatique la rend définitive en une seconde.
- **Version de format.** Un fichier **plus récent** s'ouvre en lecture seule
  sans passage possible en écriture ; un fichier **plus ancien** se convertit au
  premier passage en écriture, jamais à l'ouverture.
- **Une seule séance en écriture**, le verrou se prenant **à l'entrée en mode
  écriture** et non à l'ouverture.
- **Contrôle de cohérence** : l'en-tête annonce ses comptes et sa révision ;
  l'analyse syntaxique seule ne distingue pas un fichier complet d'un fichier
  plausible.
- **Sérialisation canonique** : ordre de clés fixé, aucune valeur dérivée de
  l'horloge ou d'un tirage. Sans elle, deux états identiques produisent deux
  fichiers différents et un correctif enregistre du bruit à chaque geste.

---

## 9. Les états d'un plan

| état | ce qu'il signifie |
|---|---|
| **Brouillon** | on prépare |
| **Proposé** | des placements existent, aucun n'est retenu |
| **Retenu** | un placement est en vigueur |
| **Bloqué** | rien ne peut plus changer |

**Brouillon, proposé et retenu n'interdisent rien.** Ils ordonnent le travail,
se posent en cliquant l'état, et passer de l'un à l'autre **ne détruit jamais**
de données.

**Bloqué refuse toute modification** — tours, options, tables, participants,
import, et jusqu'à la position d'une table à l'écran. La lecture et l'impression
restent ouvertes : on bloque un plan précisément pour le distribuer.

**La dérive avertit, elle ne bloque pas.** Si les participants ou le mobilier
changent après qu'un placement a été retenu, le logiciel le signale et laisse
l'opérateur décider : lui seul sait si la personne arrivée en retard doit être
placée.

---

## 10. La liste des participants

### 10.1 L'import CSV

**L'aperçu est obligatoire.** Il n'existe pas de bouton « importer
directement » : l'aperçu est la seule garde contre une détection d'encodage ou
de séparateur qui se trompe sans rien faire échouer, et une garde qu'on peut
sauter ne garde rien.

**Les colonnes s'associent par leur en-tête, jamais par leur position** — un
tableur où une colonne a été déplacée importerait sinon les noms dans les
appartenances sans rien signaler.

| en-tête | obligatoire | contenu |
|---|---|---|
| `nom` | **oui** | |
| `prenom` | non | |
| `appartenance` | non | synonymes : `organisation`, `entreprise`, `équipe` |
| `courriel` | non | |
| `titre_pressenti` | non | synonymes : `titre`, `rôle` — **informatif, ne pourvoit aucune place** |
| `exclu` | non | liste fermée ; vide vaut `non` |
| `notes` | non | texte libre, jamais interprété |

Les en-têtes se reconnaissent **sans tenir compte de la casse, des accents ni
des espaces**. **Deux colonnes reconnues sous le même nom** ne se départagent
pas toutes seules : le logiciel n'associe ni l'une ni l'autre et demande.

**La valeur de `exclu`** appartient à une liste fermée ; toute autre valeur
**refuse la ligne**. Traiter l'inconnu comme `non` placerait dans la salle une
personne qui s'est désistée, et la chaise vide ne se verrait que le soir même.

**L'encodage se tranche en quatre temps, dans cet ordre :** marque d'ordre
d'octets UTF-8 ; marque UTF-16 ; **un octet nul dans les quatre premiers
kibioctets sans marque** → refus global avec le remède nommé ; sinon décodage
UTF-8 strict, et repli sur windows-1252 en cas d'échec.

> L'étape 3 n'est pas une précaution de principe : **un texte UTF-16 dont le
> contenu est latin est valide en UTF-8**, chaque octet nul s'y décodant comme
> le caractère nul. Un ordre à trois temps produirait des noms entrelardés de
> caractères nuls, qui ne font échouer aucun calcul. Le mode de défaillance est
> muet : « Benoît » importé en « BenoÃ®t » se découvre sur le plan imprimé.

**Le séparateur** se choisit entre `;`, `,` et la tabulation, en **analysant**
les vingt premiers enregistrements : le candidat retenu termine sans guillemet
ouvert, donne le même nombre de champs partout, **et ce nombre dépasse 1**. À
égalité, celui qui donne **le plus d'en-têtes reconnus**.

> Les deux dernières conditions ne sont pas des raffinements. Sur un fichier
> séparé par des virgules, `;` donne lui aussi un nombre de champs parfaitement
> constant : **un**. Une règle qui ne retiendrait que la constance importerait
> chaque ligne entière dans la colonne `nom`.

**Les appartenances se réconcilient sur la même forme normalisée que la clé de
doublon** — espaces réduits, casse et accents ignorés ; la première orthographe
rencontrée s'affiche. **Le rapport d'import nomme chaque groupe d'orthographes
fondues et son nombre de lignes** : une fusion silencieuse est aussi fausse
qu'une séparation silencieuse. Une appartenance vide vaut **absence**, jamais
une appartenance nommée « ».

> Sans cette réconciliation, deux orthographes d'une même organisation
> deviennent deux appartenances : « séparer les appartenances » cesse de séparer
> deux collègues, G est gonflé, et A_max avec lui. Le défaut est muet — aucun
> indicateur ne s'en aperçoit.

**La ligne invalide : importer le reste.** Le logiciel importe les lignes
valides et **réexporte les refusées** en un CSV reprenant les colonnes
d'origine, augmenté de `ligne` et `motif` — deux colonnes qu'aucun en-tête ne
reconnaît, donc le fichier corrigé se réimporte tel quel. Sur 260 lignes, un
refus global coûterait l'import entier pour une faute en ligne 213.

Trois cas restent des refus **globaux** : aucun en-tête reconnaissable, aucune
colonne associée à `nom`, zéro ligne valide.

**L'import entier est une seule entrée d'historique.**

**Les doublons** se repèrent sur le triplet (nom, prénom, appartenance)
normalisé, et le logiciel **ne fusionne jamais tout seul** : deux personnes
portent le même nom, et la fusion silencieuse fait disparaître un convive qui se
présentera quand même.

**Mettre à jour n'efface pas** : un champ vide dans le fichier laisse la valeur
existante. Un fichier ne portant que les noms effacerait sinon tous les
courriels, d'un geste qui s'annonce comme une mise à jour.

**Remplacer annonce ce qu'il détruit**, réservations et titres compris :
« 260 personnes seront supprimées » laisse croire qu'on ne perd que des noms.

**Importer selon l'état** : sans avertissement en brouillon et proposé ; avec
l'avertissement de dérive en retenu ; **refusé** en bloqué, le message nommant
la commande qui déverrouille.

### 10.2 La saisie

Seul `nom` est obligatoire : refuser une personne faute de courriel pousse
l'opérateur à inventer une valeur, qui ne se distingue plus ensuite d'une vraie.

Trois mécanismes rendent tenable la saisie de 260 personnes :

1. **Le collage en bloc**, passé **au même analyseur** que l'import — un second
   analyseur « simplifié » divergerait sur les accents et les guillemets, et les
   tests des deux resteraient verts.
2. **L'appartenance collante** : le champ conserve sa dernière valeur. Saisir
   les sept personnes d'une organisation, c'est taper sept noms.
3. **La grille éditable**, au clavier, avec tri et filtre. Corriger est ce que
   l'opérateur fait le plus, la veille et sur place.

**La liste s'exporte en CSV dans la forme exacte qu'il importe.** L'aller-retour
est éprouvé par un test qui importe, exporte et compare champ par champ : il
fait du fichier une sauvegarde, et de l'export le gabarit que personne n'a
besoin de documenter.

### 10.3 Les fichiers d'exemple livrés

| fichier | emploi |
|---|---|
| `exemples/participants_demo_petite.csv` | la **liste des participants** de la petite démonstration |
| `exemples/participants_demo_grande.csv` | celle de la grande |
| `exemples/participants_cas_limites.csv` | éprouve l'analyseur ; n'alimente aucune démonstration |
| `exemples/participants_cas_limites_cp1252.csv` | même contenu, windows-1252, séparé par des virgules |

**Un CSV ne reproduit pas une configuration** : un import de participants ne
crée ni tables, ni tours, ni réservations, ni titres. Les deux premiers fichiers
sont donc **produits par l'export CSV** à partir des fichiers de démonstration
livrés, **jamais saisis à la main** — la dérive entre l'exemple et la
démonstration devient impossible plutôt que surveillée.

Le fichier de cas limites exerce, ligne par ligne : une colonne non reconnue,
une personne sans appartenance, une exclusion, un champ cité contenant le
séparateur, un champ cité sur deux lignes, un doublon, une personne sans prénom,
et une ligne refusée faute de nom.

Tous sont en **UTF-8 avec marque d'ordre d'octets, séparés par `;`** — la forme
qu'un tableur francophone sous Windows rouvre sans manipulation — sauf le
dernier. Noms, organisations et courriels sont **inventés** ; les courriels
emploient le domaine réservé `.test`.

---

## 11. Les sorties

### 11.1 Une bibliothèque embarquée, jamais l'impression du navigateur

Le logiciel produit ses PDF **en mémoire, par une bibliothèque embarquée**.

**L'argument décisif est l'épreuve.** Une bibliothèque embarquée s'exécute sous
`node` : un test de quelques secondes affirme qu'une feuille de table tient sur
une page, que 260 fiches comptent le nombre de pages attendu, et que les accents
sont présents — **en extrayant la couche de texte du PDF produit**, pas en
regardant une image. L'impression du navigateur exige de démarrer l'application
et un moteur de rendu : elle sort du cycle « à chaque modification », et **un
contrôle qui ne tourne qu'avant une livraison ne tourne pas**.

S'y ajoute que la pagination de l'impression dépend des règles CSS, dont le
comportement diffère d'un moteur à l'autre : l'opérateur découvre le saut de
page au milieu d'une table une fois la feuille sortie.

Conséquences à tenir :

- **La police est embarquée** dans le PDF, couvrant le latin étendu du français,
  ligatures comprises. Un test échoue si un caractère d'un nom d'épreuve ne se
  retrouve pas dans la couche de texte.
- **Le PDF se construit depuis le modèle, jamais depuis le DOM** : l'écran et la
  feuille lisent la même source.
- **Le plan s'exporte en vectoriel.** Le SVG inséré est la **forme d'export**,
  avec son `viewBox` calculé — que le document vivant n'a pas — et il porte le
  **cadrage ajusté à la page**, non celui de l'écran. Sans le `viewBox`, un SVG
  autonome se rend à 300 × 150 pixels ; sans le cadrage de page, deux
  impressions du même plan diffèrent selon le zoom laissé à l'écran.
- Le rendu du plan **s'interdit tout élément HTML enchâssé dans le SVG**, que le
  PDF ne sait pas reprendre.

**À confirmer dans la première semaine : que la bibliothèque accepte le SVG que
le plan produit**, avec ses `<use>`, ses `<symbol>` et ses `<tspan>` à décalage
explicite. C'est le seul point de l'architecture de sortie qui repose sur une
supposition.

### 11.2 Ce qui s'exporte

| sortie | contenu |
|---|---|
| **Fiches participants** | nom, appartenance, titre, et pour chaque tour la table et le siège |
| **Feuilles par table** | une table, tous les tours, les convives numérotés |
| **Liste d'accueil** | tous les participants par ordre alphabétique, table de chaque tour en regard |
| **Plan de salle** | vectoriel, listes comprises, un tour par page |
| **Rapport de placement** | indicateurs, écart au plafond, diagnostic |
| **Page de qualité** | l'en-tête chiffré, les graphiques, les tableaux |

La **liste d'accueil** est la feuille la plus manipulée de la soirée : sans elle,
retrouver une personne oblige à parcourir les feuilles de table.

**Le plan ne tient pas toujours sur une page.** Le logiciel calcule l'échelle qui
le ferait tenir ; si la taille de caractère tombe sous le seuil **mesuré** de
lisibilité, il découpe en pages contiguës, chacune portant un cartouche de
repérage. Le choix est offert, le découpage étant proposé par défaut.

**Chaque page porte en pied** le nom de l'événement, sa date, le tour, et
**l'horodatage du placement exporté** — une feuille sans horodatage circule
après avoir été invalidée et personne ne peut dire laquelle des deux versions
posées sur la table est la bonne.

Un plan qui n'est ni **retenu** ni **bloqué** s'exporte avec la mention
**BROUILLON** en filigrane. Le logiciel n'interdit pas d'imprimer un brouillon ;
il interdit qu'on le confonde avec le plan définitif.

---

## 12. La page de qualité

### 12.1 Les deux questions

L'opérateur n'ouvre pas cette page pour connaître une variance :

1. **Ce placement est-il bon ?** — reste-t-il à gagner en relançant ?
2. **Qui s'y trouve mal servi ?** — car la plainte ne vient pas de la moyenne,
   elle vient d'une personne.

Le logiciel n'affiche **aucune forme qui ne réponde à l'une des deux**, et
chaque vue porte en toutes lettres la question qu'elle traite.

**Le minimum gouverne la page** : chaque vue place le cas le plus défavorable à
une position **fixe et prévisible** — le premier point, la première ligne —
jamais là où il faut le chercher. La moyenne l'accompagne en encre secondaire et
n'apparaît jamais seule. Un placement où chacun rencontre 27 personnes sauf une
qui en rencontre 14 a une excellente moyenne et un problème.

### 12.2 L'en-tête chiffré

Les indicateurs du § 5.4 en une rangée de tuiles, **le minimum en premier**,
chacun avec son **plafond réalisé** et la mention de la population mesurée.

Le chiffre de tête est une **mesure avec son unité et son plafond**, jamais un
score composite.

### 12.3 Première vue — le profil trié

**Question : qui est le plus mal servi, de combien, et combien sont-ils ?**

Une **courbe en escalier**. En abscisse les participants **triés du moins bien
au mieux servi** — c'est un rang, et l'axe le dit. Deux séries sur **un seul axe
vertical** : personnes distinctes rencontrées, et appartenances distinctes
rencontrées.

> Un seul axe, parce que le nombre d'appartenances rencontrées **ne peut pas
> dépasser** le nombre de personnes rencontrées : la seconde courbe est partout
> sous la première, et **l'écart se lit directement** comme la redondance des
> cercles fréquentés. Deux axes détruiraient cette propriété et fabriqueraient,
> par le seul choix d'alignement, une corrélation absente des données.

**Un seul tri, celui de la première série**, vaut pour les deux : une abscisse
désigne toujours le même participant. La seconde courbe est donc irrégulière, et
cette irrégularité est de l'information.

**Les égalités se départagent par une clé stable** — sinon deux affichages du
même placement donnent deux dessins, et deux impressions ne se superposent pas.

**Le plafond réalisé se trace dans le même ordre** : règle horizontale quand il
est constant, **ligne en escalier** dès qu'une table est incomplète. Une règle
unique mentirait.

**Le logiciel vérifie que la courbe ne dépasse jamais son plafond.** Si elle le
dépasse, le calcul est faux : la page **refuse de dessiner** et le dit, plutôt
que d'afficher un graphique impossible que personne ne regardera d'assez près.

**Les places contraintes sont marquées.** Sans cela, l'opérateur attribue au
générateur un minimum que sa propre réservation impose.

**Pourquoi cette forme.** L'histogramme fait de la personne la plus mal servie
une barre de quelques pixels au bord du dessin, que l'œil saute. La boîte à
moustaches remplace le minimum par une convention de tracé que l'opérateur ne
parle pas. Le violon lisse précisément le bout de queue qui porte
l'information. La courbe triée **commence par le pire cas**.

**Ce qu'on lit quand le placement est mauvais :** une falaise à gauche — bon en
moyenne, contient une plainte ; une courbe plate mais basse — défaut systémique,
relancer a du sens ; **les deux courbes largement écartées** — les gens
rencontrent beaucoup de monde et toujours les mêmes cercles, l'échec exact que
la diversité cherche à éviter et qu'aucun chiffre global ne montre.

**Comparer deux placements** sur le même axe. **Quand les courbes se croisent,
l'arbitrage est réel** — l'un sert mieux les plus mal lotis, l'autre la masse —
et le graphique le montre au lieu de le trancher. En comparaison, l'abscisse
change de sens et **la page l'écrit** : le rang 1 de l'une et de l'autre ne
désignent pas la même personne.

### 12.4 Deuxième vue — les collisions d'appartenance

**Question : d'où vient le problème, et relancer peut-il y changer quelque
chose ?**

Des barres **horizontales**, une par appartenance, la pire en haut, chacune
empilée en **deux segments** : **prouvé inévitable** (le plancher du diagnostic)
et **reste**. Chaque ligne porte l'effectif du groupe.

**Le second segment ne s'appelle pas « évitable ».** Le plancher se calcule en
relâchant les contraintes : c'est une **borne inférieure**, jamais un fait.
Nommer « évitable » le complément affirmerait qu'un meilleur placement le
retire, et condamnerait l'opérateur à relancer indéfiniment sur un conflit
qu'aucun placement ne retire.

**Les participants sans appartenance ne forment pas un groupe** : sinon un
pseudo-groupe de quarante personnes produit la plus longue barre, un plancher
entièrement fictif, et l'opérateur conclut que sa salle est trop petite.

C'est **la seule vue qui désigne une action** : un segment « prouvé inévitable »
long signifie que relancer est futile et qu'il faut une table de plus.

### 12.5 Troisième vue — les paires répétées

**La matrice « qui a rencontré qui » n'est pas lisible à 260 participants**, et
le logiciel ne la dessine pas à cette taille. Les raisons se mesurent : 67 600
cellules donnent environ 4 px par cellule sur un portable, loin sous les 24 px
de cible de pointage ; la matrice est creuse à huit neuvièmes ; elle ne porte
que R+1 valeurs dont trois sont décisionnelles ; et en ordre alphabétique elle
ne montre qu'un grain aléatoire où l'opérateur croira voir un motif.

**Ce qui la remplace** : un **tableau des paires répétées**, trié par nombre
décroissant — les deux noms, leurs appartenances, le nombre de fois, les tours.
Chaque ligne est cliquable et amène sur le plan, au tour fautif.

**Deux exceptions** : la matrice se dessine sous un seuil de participants
**mesuré sur le rendu réel**, et la **ligne d'une seule personne** reste toujours
accessible par sa fiche.

### 12.6 Les cas limites

Une page de statistiques se casse par ses bords, et chacun se produira.

| cas | ce que la page affiche |
|---|---|
| participants exclus | retirés de toutes les statistiques, effectifs mesuré et exclu annoncés |
| personne en réserve à un tour | gardée, point marqué, avec le nombre de tours non assis |
| aucun placement | le diagnostic préalable et une phrase, **jamais des axes vides** |
| une seule table | une phrase ; pas trois vues qui disent la même chose |
| un seul tour | le tableau des paires est remplacé par une phrase, non par un tableau vide |
| une seule appartenance, ou aucune | une phrase ; **pas** une seconde courbe plate à zéro, qui se lit comme une panne |
| aucune collision | la deuxième vue est remplacée par sa phrase |
| noms longs | tronqués à une largeur **mesurée**, entiers dans l'infobulle et le tableau |
| homonymes | distingués par leur appartenance ; la navigation se fait par identifiant |

### 12.7 Les règles de forme

- **Jamais deux axes verticaux.**
- **L'identité d'une série ne repose jamais sur la seule couleur** : au plus
  deux séries, **étiquetées directement sur le tracé** en plus de la légende. La
  page s'imprime, souvent en noir et blanc.
- **Les couleurs d'état sont réservées** : la teinte qui signale un conflit ici
  est **la même** que sur le plan de salle, et ne sert à rien d'autre.
- **Une échelle séquentielle est une seule teinte, du clair au foncé.** Jamais
  d'arc-en-ciel : un dégradé multicolore invente des frontières là où la
  grandeur est continue.
- **Le texte garde une encre neutre** ; la couleur est portée par la marque.
- **La palette se valide par calcul, jamais à l'œil** : simuler d'abord les trois
  dichromaties, **puis** mesurer l'écart — mesurer sur les couleurs d'origine ne
  dit rien de ce que voit une personne daltonienne. **4,5:1** pour le texte,
  **3:1** pour les marques porteuses d'information.
- **Chaque graphique a son jumeau tabulaire** : un survol n'est jamais le seul
  chemin vers une valeur, et un tableau s'imprime.
- **Le pointage se fait au plus proche** : à 260 points, le pas est de quelques
  pixels, et sans cette couche la vue est inutilisable au pavé tactile.

### 12.8 Ce que le logiciel ne dessine pas

- **Un score unique, une jauge, un feu vert** : il moyenne ce que l'opérateur
  doit arbitrer, cache quel critère a été sacrifié, et éteint la seconde
  question — un placement à 87 % ne dit pas qui est à 14.
- **Un camembert des appartenances** : il décrit les **entrées**, pas la qualité
  de la sortie ; identique sous un bon et un mauvais placement.
- **La moyenne seule**, sous quelque forme que ce soit.
- **Un nuage « rencontres contre appartenances »** : deux entiers bornés, 260
  points se superposent sur quelques centaines de positions.
- **Deux placements dans deux graphiques aux axes différents.**

### 12.9 D'où viennent les chiffres

Les statistiques sont calculées par le **moteur**, en fonctions pures, testées
sous `node`. **La page ne recalcule rien** : elle lit les mêmes valeurs que le
tableau d'indicateurs et que le classement. Dès que la même arithmétique existe
en deux endroits, le graphique et le tableau finissent par se contredire devant
l'opérateur.

Les trois vues se dessinent en **SVG**, avec **un module de géométrie frère** de
celui du plan — même principe, même discipline d'épreuve, mais **pas le même
module** : l'unité du plan est le centimètre réel, celle d'un graphique est le
rang et le nombre. Les confondre ferait fuir l'unité du bâtiment dans les axes.

---

## 13. Architecture

### 13.1 Forme du projet

Une application **Cordova**, dont le code vit dans `www/` et ne dépend d'aucun
service.

| plateforme | rôle |
|---|---|
| `electron` | la livraison : un exécutable Windows |
| `browser` | le développement et les tests sous Linux |
| `android` | ouvert, non requis pour la première livraison |

### 13.2 Une seule langue, et c'est une exigence

Tout — le moteur, la géométrie, l'interface — est écrit en **JavaScript**.
Aucune partie du calcul n'est dupliquée dans un second langage.

Cette propriété doit être **préservée délibérément**. Dès que la même
arithmétique existe en deux endroits, une suite de tests peut prouver qu'ils
s'accordent **sans jamais prouver qu'ils ont raison** : les deux dérivent
ensemble et les tests restent verts. Une seule implémentation rend ce mode de
défaillance impossible.

### 13.3 La bibliothèque d'interface : Svelte 5, construit par Vite

Le logiciel n'emploie **aucune bibliothèque de dessin SVG** : le plan est du SVG
écrit à la main, et le déplacement, le zoom et la conversion de coordonnées sont
des fonctions pures du module de géométrie.

| critère | ce que Svelte apporte |
|---|---|
| tenir hors ligne | se compile en JavaScript ordinaire ; Vite est une dépendance de développement qui ne survit pas à la construction |
| rester rapide | compile des mises à jour fines, sans arbre virtuel ni mémoïsation à poser à la main |
| se tester sans navigateur | n'impose d'écrire aucun calcul dans un composant ; le composant ne contient que le câblage |
| être joli sans y passer des semaines | un fichier de jetons — couleurs, rayons, ombres, échelle typographique — décliné en deux thèmes |

**Les candidates écartées.** Vue 3 est le second choix défendable, écarté de peu
sur le poids et sur la discipline qu'exige sa réactivité. React est écarté sur la
mémoïsation à poser à la main. Preact sans étape de construction supprime un gain
plus petit qu'il n'en a l'air et se paie chaque jour en ergonomie ; il reste le
repli nommé. Lit est écarté parce que son intérêt tient au DOM fantôme, qui
cloisonne les styles et rend plus coûteuse la lecture du style calculé qu'exige
le § 14.2. Solid est écarté sur la taille de sa communauté, pour un logiciel
destiné à être repris. Les bibliothèques canvas résolvent un problème que le
logiciel n'a pas. **D3** est écarté pour une raison précise : `d3-zoom` conserve
la transformation dans une propriété accrochée au nœud du DOM, **hors du
modèle** — or l'historique et la sauvegarde automatique exigent que tout état
persistant vive dans le modèle.

> Le poids ne tranche pas : l'application compilée pèse quelques dizaines de
> kilooctets, un paquet Electron plus de cent millions. L'écart entre la plus
> légère et la plus lourde des candidates représente **moins d'un millième du
> livrable**.

**Le logiciel n'emploie pas Tailwind** ni aucun outil qui déduit les styles en
lisant le code source. Le mode de défaillance est précis : les classes d'état
d'une table — conflit, rencontre répétée, siège réservé — se composent **à
l'exécution** à partir de ce que le moteur rend. Un balayage de sources ne les
voit pas, les élague, et **la table en conflit reste grise pour toujours, sans
message d'erreur**.

### 13.4 Les couches

```
  interface          le plan, les listes, les formulaires
      │
  application        les états, les commandes, l'historique
      │
  moteur             le placement : pur, sans DOM, sans API de plateforme
      │
  stockage           lecture et écriture de fichiers
```

**Le moteur ne connaît ni le DOM ni Cordova.** Il reçoit des nombres et des
listes, il rend des placements. C'est ce qui le rend testable sous `node`, en
quelques secondes — et c'est la condition pour qu'il soit éprouvé sérieusement.

**La géométrie du plan** est elle aussi un module de **fonctions pures**, séparé
du rendu.

Les **deux frontières de plateforme** sont le système de fichiers et
l'impression : une interface unique, deux implémentations.

### 13.5 Ce que le SVG donne et que le canvas ferait payer

- **La désignation de ce qui est sous le pointeur**, pour la sélection : le
  navigateur répond exactement, sans une ligne de code. En canvas il faut la
  réécrire et la maintenir en accord avec le dessin — une divergence donne des
  clics qui tombent à côté sans que rien ne le signale.
- **L'épreuve par le style calculé** (§ 14.2). Sur un canvas il n'y a pas de
  style calculé : on en serait réduit à comparer des pixels.
- **Le contraste et les deux thèmes** : en SVG les couleurs sont des propriétés
  CSS, gouvernées par un seul fichier de jetons.
- **Le PDF vectoriel** : la bibliothèque du § 11.1 ingère une géométrie
  vectorielle, là où un canvas exigerait un second chemin de rendu à haute
  densité.
- **L'accessibilité** : `tabindex`, `role` et `aria-label` fonctionnent sur les
  éléments SVG. Un canvas est un rectangle opaque pour un lecteur d'écran.
- **L'inspection** : le plan s'ouvre dans les outils du navigateur, élément par
  élément.

Ce que le canvas gagnerait — des dizaines de milliers d'objets — ne se présente
pas : une salle plafonne à quelques dizaines de tables.

---

## 14. Exigences de développement

Chacune répond à une façon connue de se tromper.

### 14.1 Les constantes de géométrie se mesurent

Toute dimension qui dépend du rendu du texte se **mesure dans un navigateur**,
sur la police réellement rendue. Jamais déduite, jamais posée de tête.

Un seuil en nombre de caractères se cale sur le **glyphe le plus large** de
l'alphabet visé, pas sur une moyenne. Un seuil moyen laisse déborder les noms
écrits en lettres larges, **silencieusement**, par-dessus la ligne suivante.

Chaque constante mesurée porte en commentaire **ce qu'elle mesure et pourquoi**,
afin que personne ne la « corrige » plus tard par le calcul.

### 14.2 Un test qui ne peut pas échouer ne prouve rien

- Tout test ajouté doit être **montré en train d'échouer** sur le code d'avant.
- Un test de rendu lit le **style calculé**, pas la présence d'une classe : une
  classe peut se poser sur un élément qui ne peint rien.
- Un test qui parcourt un ensemble **refuse de passer quand cet ensemble est
  vide** : « zéro fichier examiné » n'est pas « zéro problème ».

### 14.3 Les règles se gardent, pas seulement les cas

Quand un défaut est corrigé, le test qui l'accompagne épingle la **règle**
plutôt que le cas. Une valeur remise à la main sera défaite par la main
suivante ; une règle qui fait échouer la construction tient.

### 14.4 Les trois niveaux d'épreuve

| niveau | ce qu'il couvre | quand |
|---|---|---|
| `node` | moteur, géométrie, analyseur CSV, stockage, PDF | à chaque modification, quelques secondes |
| navigateur | ce que l'interface dessine, ce que les gestes produisent, les coordonnées | avant chaque livraison |
| manuel | une soirée complète, de la saisie à l'impression | avant chaque livraison au client |

**jsdom ne sait pas éprouver la géométrie SVG** : il n'implémente ni `getBBox`,
ni `getScreenCTM`, ni la mise en page du texte. Tout ce qui touche à une
dimension réelle exige un vrai moteur de rendu. Croire l'inverse fait sauter
l'étage intermédiaire et laisse partir les défauts de coordonnées.

### 14.5 Accessibilité et thèmes

Le texte tient **4,5:1** de contraste, les marques porteuses d'information
**3:1**. Chaque couleur est accompagnée du ratio **mesuré sur la couleur relue
du rendu**, non sur le jeton source. Les deux thèmes sont éprouvés **par
rendu**, jamais seulement par calcul.

### 14.6 La traduction, posée dès le départ

Une seule langue est livrée, mais **aucune chaîne visible n'est écrite en dur
dans un composant**. Le coût est nul aujourd'hui ; le retrouver plus tard
suppose de relire toute l'interface.

### 14.7 Le déterminisme

Aucune source non reproductible — `Math.random`, `Date.now`, `performance.now`,
`crypto.getRandomValues` — dans le **moteur** ni dans le **générateur de
démonstrations**. Un test de l'arborescence le refuse, **et échoue si son
balayage ne trouve aucun fichier**. L'interdit ne porte pas sur le reste de
l'application : l'historique horodate ses entrées.

---

## 15. Les configurations de démonstration

Elles servent à trois choses : montrer le logiciel sans saisir 260 personnes,
enseigner la lecture des indicateurs, et servir de témoin de test. Une
démonstration qui change d'un lancement à l'autre ne remplit aucun des trois.

**Charger une démonstration crée une configuration neuve**, nommée d'après elle
suivie d'un numéro d'ordre, ouverte en lecture. Le logiciel n'écrase jamais la
configuration courante et ne modifie jamais la démonstration d'origine :
l'opérateur qui explore pendant une présentation ne doit pas pouvoir détruire
son vrai plan d'un clic.

### 15.1 La grande démonstration — 260 membres

| grandeur | valeur |
|---|---|
| membres | 260 |
| sièges par défaut | 8 |
| tables | **33 : 29 à 8 sièges, 4 à 7** |
| sièges | 29×8 + 4×7 = **260**, aucun libre |
| animateurs | 33, un par table, **pris parmi les 260** |
| mobiles | 227 |
| tours | 4 |
| appartenances | tirées, de 1 à 12 membres |

**Le calcul, et pourquoi il ne tombe pas juste tout seul.** 260 ÷ 8 = 32,5 :
aucun nombre entier de tables de 8 ne reçoit 260 personnes. 33 tables de 8
offrent 264 sièges, soit 4 vides. Le logiciel règle cela par la capacité
individuelle, et **la démonstration exerce ainsi, sur son premier écran, la
fonction « défaut global, exception par table »**.

**La configuration est exactement tendue** : la capacité libre vaut 227, soit
exactement le nombre de mobiles. Chaque tour est une partition exacte, le moteur
n'a jamais la liberté de déplacer quelqu'un vers une table moins remplie, et
tout mouvement doit être un échange. C'est une propriété de l'espace de
recherche, pas un détail.

**Ce que la configuration rend possible, avant la génération :**

| | plafond a priori |
|---|---|
| un mobile passant par quatre tables de 8 | **28** |
| un mobile passant une fois par une table de 7 | **27** |
| un animateur d'une table de 8 | **28** |
| **les quatre animateurs des tables de 7** | **24** |

> Ces quatre-là sont, **par construction, les personnes les plus mal servies de
> la démonstration**. Comme le minimum se calcule sur tous les participants
> placés, **c'est ce 24 qui gouverne le minimum global, et aucune relance ne
> l'améliorera jamais.** C'est précisément ce que la ligne secondaire « ancrés »
> du § 5.4 permet de lire sans conclure à un défaut du moteur — et c'est la
> démonstration la plus utile du catalogue, puisqu'elle montre en une lecture
> pourquoi les deux populations sont séparées.

**99 retours imposés** (33 × 3), attribués aux réservations et non additionnés
aux autres.

**Les animateurs sont tirés sans égard à leur appartenance**, et aucun
regroupement ne leur en impose une commune — sinon chaque mobile accumulerait au
moins 3 redondances qu'aucune recherche ne réduit, et la démonstration vedette
illustrerait une impossibilité. Un test le garde.

**La variante sans exception** — 33 tables toutes à 8, 4 places libres — est
livrée à côté. Quatre sièges de marge rendent au moteur la liberté que la
configuration principale lui refuse ; comparer les deux mesure ce que coûte
l'absence de marge. Dans cette variante, **les tables incomplètes changent d'un
tour à l'autre**, donc le plafond **réalisé** varie d'une proposition à l'autre.

### 15.2 La distribution des appartenances

Loi discrète sur 1..12, à poids fixés, décrochant après 3 :

| taille | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| poids | 24 | 20 | 16 | 8 | 6 | 5 | 4 | 3 | 2 | 2 | 1 | 1 |

Somme 92 ; les tailles 1 à 3 pèsent 65,2 % des groupes ; taille moyenne
théorique 3,446, d'où **environ 75 groupes** pour 260 membres.

**Le compte réellement obtenu n'est pas une donnée de cette spécification** : il
dépend de la graine, fixée dans le dépôt. Le fichier livré porte le profil qu'il
a effectivement produit, et **c'est ce profil, lu dans le fichier, qui est la
valeur attendue du test**. Inscrire ici des effectifs tirés donnerait une
certitude fausse.

**La règle du dernier groupe** : tirer tant que le total reste sous 260, puis
**tronquer le dernier au reste**.

**La faisabilité se construit, elle ne se déduit pas d'une inégalité.** « Le plus
gros groupe tient dans le nombre de tables » est nécessaire mais **ne suffit
pas** : trois tables de 10, 1 et 1 ne peuvent séparer quatre groupes de 3, parce
que la table de 10 exigerait 10 appartenances distinctes. Le logiciel vérifie
**deux** inégalités — plus gros groupe ≤ nombre de tables, plus grande capacité
≤ nombre de groupes — puis **construit un tour témoin**. Le générateur **refuse
une graine dont aucun tour témoin ne se construit**.

### 15.3 La petite démonstration — 12 membres

| grandeur | valeur |
|---|---|
| membres | 12 |
| tables | 4, de **3 sièges** |
| tours | 4 |
| réservations | **aucune** |
| appartenances | **4, 4, 4**, fixées à la main |

Elle tient sur un écran, et c'est sa raison d'être : la grande noie un défaut
dans 33 tables, la petite le montre d'un coup d'œil.

**Elle admet un plan parfait, et ce plan est écrit.** Avec 4 tours et 2 voisins
par tour, nul ne peut rencontrer plus de **8** personnes sur 11.

| tour | table 1 | table 2 | table 3 | table 4 |
|---|---|---|---|---|
| 1 | 1, 2, 3 | 4, 5, 6 | 7, 8, 9 | 10, 11, 12 |
| 2 | 6, 9, 12 | 3, 8, 11 | 2, 5, 10 | 1, 4, 7 |
| 3 | 4, 8, 10 | 2, 7, 12 | 1, 6, 11 | 3, 5, 9 |
| 4 | 5, 7, 11 | 1, 9, 10 | 3, 4, 12 | 2, 6, 8 |

Appartenances : **A** = {1, 5, 8, 12}, **B** = {2, 4, 9, 11}, **C** = {3, 6, 7,
10}. Chaque table réunit à chaque tour un membre de chacune. **Vérifié par
énumération** : partition valide à chaque tour, zéro paire répétée, chacun
visite les quatre tables, 8 rencontres pour les douze, zéro collision. Le
logiciel doit afficher **« minimum atteint »** et tous ses compteurs à zéro.

**La variante « conflit inévitable »** ne change qu'une colonne : appartenances
de tailles **5, 4, 3**. Cinq personnes ne se répartissent pas sur quatre tables
sans que deux se retrouvent : **au moins une paire par tour, quatre sur quatre
tours**, quel que soit l'algorithme. Une personne déplacée d'un groupe à l'autre
fait basculer le logiciel de « minimum atteint » à « quatre paires
inévitables » : c'est le contraste le plus court que la spécification puisse
offrir.

### 15.4 Les cas limites, exercés plutôt que supposés

- **Une seule appartenance** — la contrainte de séparation est vide de sens : le
  logiciel doit l'annoncer et proposer de la désactiver, non afficher 12
  conflits sans commentaire.
- **Une seule table, un seul tour** — les indicateurs de répétition doivent
  valoir zéro, non lever une erreur de division.
- **Des noms longs** — la grande démonstration contient une poignée de noms
  proches de la limite, dont un de glyphes larges et un à diacritiques. Sans
  eux, une démonstration faite de noms courts laisse les seuils faux jusqu'à la
  première vraie liste.

Le générateur **refuse** une configuration à zéro participant ou à zéro table :
un fichier vide passe tous les tests sans rien démontrer.

### 15.5 La reproductibilité

1. **Un seul générateur pseudo-aléatoire**, à état entier et transition
   explicite, accompagné d'un **vecteur de test** qu'un test rejoue.
2. **Une graine entière écrite dans la définition**, pas enfouie dans le code.
3. **L'ordre des tirages fait partie du contrat** : insérer un tirage au milieu
   décale tout ce qui suit.
4. **Rien de dépendant de l'environnement** : aucun `localeCompare`, aucun
   parcours reposant sur l'ordre d'itération d'un objet ; deux éléments de même
   rang se départagent par leur identifiant entier.
5. **Le fichier livré est la source de vérité.** Un test rejoue le script
   générateur et compare l'empreinte au fichier livré. **La régénération devient
   un geste conscient**, et non une dérive qui change les démonstrations sous
   les pieds de l'opérateur. L'échec nomme ce qui a changé.
6. **Le placement, lui, n'est pas figé** : la démonstration fixe les entrées, le
   moteur reste libre. Figer le résultat empêcherait de montrer la comparaison
   de plusieurs propositions, qui est le cœur du logiciel.

### 15.6 Les noms : inventés, lisibles, sans collision

Une liste de chaînes aléatoires est illisible en démonstration, et des noms
réels n'ont pas leur place dans un dépôt. Le logiciel compose des noms **forgés
mais prononçables**, par produit cartésien **tiré sans remise** — ce qui garantit
l'unicité sans boucle de rattrapage, donc sans tirage supplémentaire qui
décalerait la suite.

**Les personnes** : un prénom courant et un patronyme forgé par assemblage d'un
préfixe et d'une terminaison. Le réservoir compte **au moins 320 combinaisons**,
plus que les 260 personnes : un réservoir plus étroit forcerait des homonymes de
famille, que l'œil lit comme des parentés sur une feuille de table.

**Les appartenances** : une tête de nom d'organisation — `Ateliers`,
`Coopérative`, `Verrerie` — et une racine forgée. La tête dit immédiatement
qu'il s'agit d'une organisation. Le réservoir se dimensionne sur le **maximum
structurel** : une loi qui peut tirer 260 groupes d'une personne exige 260
combinaisons. Le générateur **refuse** de produire une démonstration dont le
compte de groupes dépasse son réservoir.

Un test vérifie l'unicité et qu'aucun fragment forgé n'apparaît dans le dépôt
**hors des listes du générateur, des fichiers de démonstration et des CSV
d'exemple**. Il refuse de passer sur un balayage vide. **Ce test n'établit rien
sur le monde réel** : aucune vérification locale ne peut prouver qu'un nom forgé
ne désigne nulle part une organisation existante.

---

## 16. Livraison

L'exécutable Windows se construit depuis Linux par la plateforme `electron` de
Cordova, qui s'appuie sur `electron-builder`.

**Cette capacité est à vérifier dès la première semaine**, sur un squelette
vide, au même titre que l'ingestion du SVG par la bibliothèque PDF (§ 11.1).
Découvrir en fin de projet qu'une étape exige une machine Windows coûte
beaucoup plus cher que de le découvrir tout de suite.

Ce qui est livré au client : **un exécutable**, et rien d'autre à installer.

### 16.1 Les deux guides livrés

| document | contenu |
|---|---|
| `GUIDE-WINDOWS.md` | **un seul fichier** : obtenir l'exécutable, le lancer, où vivent les fichiers d'événements, comment les sauvegarder, que faire si l'antivirus bloque, et comment signaler un problème |
| `GUIDE-USAGE.md` | le parcours d'une soirée, de la liste de participants à l'impression, en une dizaine d'écrans commentés |

Le guide d'usage se rédige **à partir des configurations de démonstration**, pour
que le lecteur reproduise exactement ce qu'il lit. Il est relu par quelqu'un qui
n'a pas écrit le logiciel ; un guide relu par son auteur ne révèle aucune étape
manquante.

---

## 17. Ce que ce document ne tranche pas

1. **Le format de stockage des placements à l'intérieur du fichier** — la forme
   lisible et la forme compacte n'ont pas le même coût, et le § 8.6 pose un
   ordre de grandeur, pas une structure.
2. **La bibliothèque PDF**, et la confirmation qu'elle ingère le SVG produit.
3. **Le mécanisme exact de la commande « Poser les animateurs »** : quelle table
   reçoit quel animateur. Un tour par numéro de table est le plus simple ; rien
   n'établit que c'est ce que l'opérateur attend quand les appartenances sont
   inégalement réparties.
4. **Le coût de la maximisation du plafond a priori** sur les itinéraires
   admissibles, quand des réservations de tour désigné fixent une partie du
   parcours. L'énumération est annoncée immédiate pour une dizaine de tables ;
   aucune mesure n'a été faite sur 33 tables et 4 tours.
5. **Comment la page de qualité compare deux propositions dont les escaliers de
   plafond diffèrent**, cas que produit la variante de la grande démonstration.
6. **Le seuil de zoom qui retire les listes de noms** : il se fixe sur une
   mesure du temps par image, pas sur une intuition.
7. **Les dégagements de référence d'une salle**, sans lesquels le mot
   « conforme » reste absent de l'interface.
