# Gestion table tournante Libre — spécification

Exécutable livré : `gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe`
— un **gabarit**, jamais un nom figé : le nom porte la date de la livraison
(§ 18.2).

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
  Le panneau « À propos » porte quatre liens (§ 18.6) : celui que l'opérateur
  clique s'ouvre dans son navigateur, hors de l'application, qui n'envoie
  rien elle-même et n'ouvre aucune autre adresse.
- Les données se copient, se sauvegardent et se transmettent comme des
  fichiers ordinaires.
- **L'interface est en français.** Une seule langue dans la première
  itération ; le mécanisme de traduction est néanmoins posé dès le départ
  (§ 14.6), parce que retrouver les chaînes après coup coûte dix fois plus.

### 2.1 Le parcours de l'opérateur

Cette section ne pose aucune exigence nouvelle : elle met **dans l'ordre où une
soirée se prépare** des exigences dispersées sur dix sections. Elle a un
consommateur nommé — `GUIDE-USAGE.md` (§ 16.1) suit ces douze étapes, et le
scénario de pilotage du § 19.3 les implémente, de sorte que le guide, la
spécification et le logiciel ne peuvent pas diverger sur l'ordre.

Le parcours est **un ordre de lecture, pas une séquence imposée**. Le logiciel
n'enchaîne aucun assistant et n'exige jamais de recommencer au début : un
assistant linéaire obligerait l'opérateur qui découvre une faute de saisie au
moment d'imprimer à ressortir de toutes les étapes pour y revenir, or corriger
est ce qu'il fait le plus (§ 10.2). La navigation de l'événement groupe ses neuf
sections en trois phases nommées : **Préparer** (import, participants, tables et
tours), **Placer** (plan, diagnostic, génération, propositions, qualité),
**Produire** (impression : la planche de badges, puis l'aperçu des autres
sorties). Le groupement est une lecture, non un ordre : chaque section reste
offerte depuis toutes les autres.

**Deux verrous existent pourtant, et ils sont ailleurs.** L'état **bloqué**
refuse toute modification, import compris (§ 9, § 10.1) ; le **mode lecture**,
qui est le mode d'ouverture par défaut, refuse tout geste modifiant (§ 8.4).
Aucun des deux ne dépend de l'étape atteinte.

**Trois garanties valent pour tout geste qui modifie** — les étapes 2 à 7, 9,
11, et la rétention de l'étape 10 — et ne sont pas répétées ensuite :

1. le geste achevé est une entrée d'historique **et** un état sur le disque,
   jamais l'un sans l'autre (§ 8.2) ;
2. il se reprend par un retour à un instant, et le journal ne se tronque jamais
   (§ 8.3) ;
3. s'il est refusé, le refus nomme sa cause et, quand un geste la lève, ce
   geste (§ 5.9), **là où le geste a eu lieu** : sur la place pour un geste du
   plan, dans l'aperçu d'import pour une ligne de CSV (§ 10.1), sur le champ
   pour une saisie. Seul un geste qui détruit de la saisie ouvre une fenêtre à
   confirmer, et « Garder les N meilleures », qui efface d'un coup des
   propositions que l'écran ne montre pas toutes (§ 5.7).

Les étapes 8 et 10 — lire le diagnostic, comparer — ne modifient rien et restent
vivantes en lecture (§ 8.4).

**1. Ouvrir ou créer l'événement.** *Obligatoire.* L'opérateur choisit dans la
liste (§ 8.1), crée, ou charge une démonstration (§ 15). **Ouvrir ne réécrit
jamais le fichier d'état** (§ 8.4) ; créer et charger une démonstration
écrivent, puisqu'ils produisent un événement neuf.

**1b. Passer en écriture.** *Obligatoire avant toute modification, reprenable.*
Le § 8.4 ouvre **tout** événement en lecture : les étapes 2 à 7, 9 et 11 sont
refusées tant que la commande « Modifier » n'a pas été exécutée. Elle est à
place fixe, et le logiciel retourne seul en lecture après inactivité. Ce retour
automatique tombe **entre** deux étapes et jamais pendant un geste, et le
reprendre ne coûte rien puisque tout geste achevé est déjà sur le disque.

**2. Importer la liste des participants.** *Facultative, reprenable.* Le
logiciel montre un aperçu avant tout import (§ 10.1), importe les lignes valides
et réexporte les refusées, et compte l'import entier comme une seule entrée
d'historique. Un second import met à jour sans effacer les champs absents, ou
remplace en annonçant d'abord ce qu'il détruit. L'import est **refusé en état
bloqué**, le message nommant la commande qui déverrouille.

**3. Compléter la liste à la main.** *Facultative, reprenable, y compris après
la génération.* Le logiciel n'exige que le nom (§ 10.2) et n'invente aucune
valeur manquante.

La fiche d'une personne porte ses **étiquettes** (§ 4.5), que l'opérateur ajoute
et retire là ; une colonne du CSV les importe (§ 10.1). Elles ne sont exigées
nulle part : une soirée sans étiquette est une configuration valide.

La fiche et la grille portent aussi sa **présence** (§ 4) : « tous » tant que
l'opérateur ne la change pas, sinon les tours où elle est là, une case par tour.
Un retard, un départ anticipé, une arrivée après les premiers tours se disent
là, avant comme pendant la soirée ; une colonne du CSV les importe (§ 10.1).
Valider une présence est une entrée d'historique, qui ajuste le placement
retenu (§ 5.8).

La fiche porte enfin ses **inclusions** (§ 4) : les organisations et les
personnes qu'elle doit rencontrer au moins une fois, une case par organisation
ou par personne, sous deux rubriques ; la grille les montre dans une colonne
qu'elle masque par défaut (§ 10.2), et deux colonnes du CSV les importent
(§ 10.1). Elles ne sont exigées nulle part.

**4. Préparer les tables.** *Obligatoire.* L'opérateur fixe le nombre de sièges
par défaut, crée les tables — une à une, ou d'un geste celles qui manquent pour
asseoir chacun, à la taille qu'il donne, et qui reçoivent les animateurs à
désigner (étape 6) —, surcharge celles qui diffèrent (§ 6.1) et les dispose sur
le plan (§ 7.1). Le logiciel énonce la conséquence chiffrée d'un changement de
défaut avant de l'appliquer, n'écrase aucune surcharge, et refuse en bloc une
baisse qu'une seule table refuse (§ 6.1).

Il donne au besoin à une table un **objectif** (§ 4.5) — les étiquettes des
personnes qu'elle attend, sous la règle « au moins une » ou « toutes » —, pour
la soirée ou pour un tour désigné, à l'écran ou par un CSV d'objectifs (§ 10.4).
La règle par défaut se règle avec le nombre de sièges par défaut. Un objectif ne
fixe personne : il oriente la recherche (§ 5.3).

**5. Fixer le nombre de tours.** *Obligatoire.* Retirer un tour puis le remettre
retrouve les **ancrages** intacts, parce que la portée « tous les tours » n'est
jamais développée (§ 4.3). La protection s'arrête là, et le logiciel le dit
**avant** d'appliquer : retirer le tour *r* détruit les réservations de portée
« tour désigné » portant sur *r*, et les objectifs de table de ce tour (§ 4.5) ;
les objectifs de soirée restent. Il retire aussi *r* de chaque présence
énumérée ; une présence qui n'en garderait aucun tour est **refusée**, le refus
nommant chaque personne (§ 4.3), et l'opérateur change d'abord sa présence ou
l'exclut. Ajouter un tour ne l'ajoute à aucune présence énumérée, et le logiciel
nomme les personnes qu'il laisse absentes de ce tour. Les placements déjà
engendrés, eux, ne sont pas tronqués : ils ne portent plus le nombre de tours de
la soirée, restent entiers **en dérive** (§ 9), et le logiciel nomme ceux que le
changement touche. Les annoncer après coup ferait découvrir la perte à
l'impression. Chaque tour peut aussi porter un nom, saisi au même endroit
(§ 4) : retirer un tour retire son nom, que l'annonce nomme, et un tour ajouté
vient sans nom.

**6. Désigner les animateurs, table par table.** *Facultative — une soirée sans
aucun animateur est une configuration valide, et la petite démonstration en est
une (§ 15.3). Reprenable : une désignation se retire, se déplace, s'ajoute après
la génération.*

L'opérateur désigne **lui-même quelle personne anime quelle table**. Une seule
commande répartit des animateurs, et seulement sur les tables qu'elle crée :
« Créer les tables… » (§ 6.1), pour les personnes que la marque de l'animation
réservée dit à désigner (§ 4, § 5.8).

Un geste de désignation produit **deux faits sur la même place**, sous une seule
entrée d'historique : une **réservation** de portée « tous les tours » au nom de
la personne, et un **titre de place** (§ 4). Les deux ensemble font l'animateur ;
ni l'un ni l'autre seul. Le titre reste quand son titulaire part, et la table
affiche « titre *animateur* non pourvu » (§ 4.1). Le statut d'« ancré » du § 4.2
en découle comme un fait calculé : le logiciel ne porte aucune case « est
animateur ». La marque de l'animation réservée (§ 4) n'en est pas une : elle
dit qu'une personne est **à désigner**, jamais qu'elle anime, et l'import qui
la pose ne désigne personne.

La désignation se fait aussi **en lot**, depuis la rangée « Animateurs » de
chaque table dans « Tables et tours » (§ 6.1) : les personnes choisies sont
désignées ensemble, en une seule entrée d'historique, et si une seule est
refusée, aucune n'est désignée. Une personne absente à un tour est refusée
avant toute désignation (§ 5.9) : sa réservation « tous les tours » ne
pourvoirait aucun titre pour la soirée. Chaque personne du lot reçoit **son
propre titre** : au siège sans titre qu'elle tient déjà à cette table, s'il en
est un, sinon au plus petit siège de la table qui n'en porte aucun et que ne
tient, à aucun tour, la réservation active d'une autre personne — une
réservation suspendue par une exclusion ou une absence ne tient rien (§ 4.4) :
un titre non pourvu posé avant le lot reste tel quel, à sa place, et une place
réservée à la main n'arrête pas le lot tant qu'il reste une place libre. Ce
titre porte le **titre pressenti** de la personne (§ 4), quand elle en a un
qui ne se réduit pas à des espaces ; le titre saisi dans la fenêtre vaut pour
les autres : une personne pressentie « animatrice VIP » porte ce titre sur sa
place et sur son badge, et sa voisine de lot sans titre pressenti reçoit le
titre saisi, « animateur » par défaut. Quand aucun siège n'est à la fois sans
titre et libre, le lot suit la règle de la désignation au plan et pourvoit le
premier titre non pourvu de la table, dont le libellé ne change pas.

La désignation se fait enfin **à la création des tables** qui manquent (§ 6.1),
dans l'entrée d'historique qui les crée : chaque personne à désigner — marquée,
non exclue, qui n'anime encore aucune table — l'est sur l'une des tables
créées. Les personnes passent par identifiant croissant ; chacune va à la table
créée qui a le moins d'animateurs, puis à celle dont aucun animateur ne porte
son organisation, puis à celle de plus petit numéro. Elle y reçoit, comme au
lot, une réservation « tous les tours » et son propre titre au plus petit siège
libre : son titre pressenti, s'il ne se réduit pas à des espaces, sinon
« animateur ». Une table créée garde au moins un siège qui tourne : elle reçoit
au plus un animateur de moins que ses places. Ne sont pas désignées une
personne absente à un tour, une personne à qui une place est déjà réservée, et
celle qui ne trouve plus de place d'animateur aux tables créées : la création
réussit quand même, et son avertissement (`ANIMATEURS_A_DESIGNER`) nomme
chacune avec sa cause et renvoie à la rangée « Animateurs », en disant, pour
chaque cause présente, ce qui y précède la désignation : l'absente s'y désigne
une fois sa présence rendue à tous les tours, la personne réservée à la table
de sa réservation ou une fois celle-ci retirée. Une personne exclue est passée
sans mot. Créer une seule table ne désigne personne.

Le retrait d'un animateur depuis cette rangée retire **ensemble** sa
réservation « tous les tours » et **un seul** titre, celui qu'elle pourvoit, en
une entrée ; les autres réservations et titres de la table restent. Le fichier
ne garde pas quel geste a posé un titre : deux titres au même siège, et le
premier par libellé part, l'autre reste non pourvu ; un titre posé avant une
désignation qui l'a pourvu — au plan, ou par un lot sans siège à la fois libre
et sans titre — part avec elle. Il ne garde pas non plus quel geste a posé une
réservation : chaque réservation « tous les tours » de la personne qui pourvoit
un titre de la table part au retrait, y compris celle posée à la main avant le
lot, au siège où le lot a mis son titre, et aucun avis ne le signale.

**« La place » se lit de deux façons, et le logiciel tranche** : c'est un
**siège** quand l'attribution des sièges est active (§ 5.3), la **table** sinon.
Dans le second cas, une table porte un **compte de titres**, pourvus ou non —
trois animateurs à une table sans sièges attribués, c'est trois titres sur la
table, dont deux peuvent rester non pourvus. Sans cette lecture, le refus « un
siège inexistant » du § 5.9 n'a pas de sens quand les sièges ne sont pas
attribués, et la liste des titres non pourvus ne sait pas compter.

**Zéro, un, ou plusieurs animateurs par table.** Le logiciel n'impose ni
plancher ni plafond propre à ce rôle. Des trois contrôles de capacité du § 5.9,
**un seul garde cette étape** : `k_t > c_t` est refusé — pas plus d'animateurs
qu'une table n'a de sièges. `k_t = c_t` est accepté et **signalé** : la table ne
tourne plus. Le manque de places à un tour ne se déclenche jamais ici, l'écart
étant invariant sous toute réservation, tour par tour (§ 5.9). Les autres refus
du § 5.9 gardent cette étape comme n'importe quelle autre pose : personne
exclue, deux places sur un même tour, dépôt sur une place déjà réservée à un
autre.

Hors de la création des tables, le logiciel n'assigne pas, il **montre le
travail qui reste**, par deux listes cliquables qui mènent à la place ou à la
personne : la liste des **titres de place non pourvus** (§ 4.1), et la liste des
participants portant un **titre pressenti** (§ 4) qui ne sont encore réservés
nulle part. La colonne « Animation » de la liste des participants (§ 10.2) dit,
pour chaque personne, les tables qu'elle anime, ou « à désigner » sous la marque
de l'animation réservée.

**7. Placer des participants à la main.** *Facultative, reprenable.* Ce sont des
réservations ordinaires (§ 5.8). Le logiciel refuse de déposer quelqu'un sur une
place réservée à un autre ; **déplacer** une réservation est une commande
séparée (§ 5.9).

**8. Lire le diagnostic.** *Le logiciel le présente, l'opérateur n'a rien à
demander.* Avant toute recherche, il énonce ce que la configuration rend
inévitable, combien, et ce qui le rendrait évitable (§ 5.6), donne le **plafond
a priori** (§ 5.5), et donne le **plancher de l'écart d'itinéraire maximal**
quand la configuration en impose un. Sans ce dernier, le troisième chiffre de la
page de qualité envoie relancer vers un zéro que la configuration interdit. Il
nomme aussi les inclusions qu'aucun plan ne satisfait, et les listes
d'inclusions qui demandent plus de personnes que leur personne n'en peut
rencontrer (§ 5.6).

**9. Générer.** *Nécessaire pour obtenir un placement, reprenable sans perte.*
La commande prend une **graine** et un **compte d'arrêt** ; chaque proposition
conserve sa graine dérivée, ce compte et la longueur d'historique qui l'ont
produite (§ 5.7, § 8.9). Le logiciel produit plusieurs propositions
comparables ; relancer **ajoute** des candidats, un classement unique les
ordonne tous. Les réservations des étapes 6 et 7 sont honorées, le moteur place
les autres autour (§ 5.2). Les critères que la recherche poursuit et que le
classement applique sont ceux que l'opérateur coche (§ 5.3), dans l'**ordre des
priorités** qu'il règle à côté (§ 5.7) ; pour les objectifs des tables, il y
choisit aussi ce que le critère cherche d'abord, le **mode** (§ 5.3). Les
conflits d'organisation et les inclusions de l'étape 3 comptent sans case dès
qu'ils ont un objet ; l'ordre par défaut les range en tête, les inclusions
juste après les conflits (§ 5.3, § 5.7). Sans réglage, c'est l'ordre par défaut
et le mode « le plus de places servies ». Le logiciel nomme automatiquement
l'instant qui précède chaque génération (§ 8.3).
Une génération peut aussi **repartir d'une proposition** choisie au tableau,
son **départ**, et en figer des tours : ses propositions, dites
**dérivées**, continuent le plan du départ sous de nouvelles graines, ne
refont que les tours non figés, et entrent au même classement, chacune
libellée « dérivée de n° X » (§ 5.7). Le départ peut être une proposition qu'un
changement de participants a mise en dérive — une arrivée, un départ, une
absence à un tour — : la génération part alors de son plan ajusté à la soirée
(§ 5.7), et ce changement ne demande pas de « Repartir de zéro ».

**10. Comparer, et retenir.** *Facultative en droit — l'impression d'un plan non
retenu sort en filigrane BROUILLON (§ 11.7) — nécessaire en fait pour distribuer
quoi que ce soit.* L'opérateur lit la page de qualité (§ 12), compare deux
placements sur le même axe — celui du **manque** (§ 12.10) — dans sa vue de
comparaison, qui trace les deux courbes sur un même tracé et pose leurs chiffres
côte à côte, puis retient celui qu'il préfère. « Comparer », dans le menu
« Actions » de la ligne d'une proposition comparable du tableau des propositions
et de celle du placement retenu, y mène. La page de qualité est la section
« Qualité » de l'événement : elle mesure le placement que le plan montre, et
chaque ligne du tableau des propositions y mène. Elle répond à deux questions —
ce placement est-il bon, qui s'y trouve mal servi — par le profil des
rencontres, les collisions d'organisation, les paires répétées, les inclusions
non satisfaites, le mélange des organisations à chaque table, les objectifs des
tables tour par tour, les animateurs, et la performance du calcul qui a produit
la proposition. Le tableau des propositions, le plan, la fiche et la grille des
participants nomment eux aussi chaque inclusion qu'un placement laisse non
satisfaite (§ 12.15). Le logiciel sépare ce que le moteur a décidé de ce que les
réservations imposent (§ 5.4). Retenir fait passer le plan à l'état *Retenu*
(§ 9) ; les propositions non retenues restent disponibles. Le retenu se résume
ensuite dans la liste des événements, par ses collisions cumulées et ses
rencontres répétées choisies (§ 5.4, § 8.1).

**11. Ajuster à la main.** *Facultative, reprenable.* Le même geste qu'à
l'étape 7 déplace maintenant une personne réelle dans le placement retenu. **Le
geste est identique, l'état des données change, et l'interface le dit** (§ 5.8).
Les indicateurs et la page de qualité suivent l'ajustement (§ 12.9 : la page
lit, elle ne recalcule rien). **Le retenu suit qui est là** : changer la
présence d'une personne, l'ajouter, l'exclure, la réintégrer, la supprimer ou
importer la liste ajuste le retenu dans la même entrée (§ 5.8). Qui part quitte
sa chaise aux tours où il est absent, qui arrive attend dans la réserve aux
tours où il est présent, et personne d'autre ne change de place.

**12. Imprimer.** La **planche de badges** (§ 11.1), qui est le seul document
PDF, et au besoin les vues imprimables : liste d'accueil, feuille par table,
plan (§ 11.7). Tout part de la section « Impression » : sous son titre
« Badges », la planche, sa liste CSV et la réédition ; sous son titre « Plan »,
l'aperçu avant impression des trois vues. La page de qualité se lit à l'écran et
ne s'imprime pas. Le logiciel n'interdit pas d'imprimer un plan qui n'est ni
retenu ni bloqué ; il le marque **BROUILLON** en filigrane. **Produire la
planche n'est pas une modification** : elle reste disponible en mode lecture et
sur un plan bloqué. L'opérateur bloque ensuite le plan pour le distribuer (§ 9).

**Ce qui doit avoir eu lieu.** Les étapes 2, 3, 5, 6, 7, 10 et 11 sont
facultatives ; 2, 3, 4, 5, 6, 7, 9 et 11 se reprennent indéfiniment, dans
n'importe quel ordre. Deux dépendances seulement : la 4 **et** au moins l'une
des étapes 2 ou 3 avant la 9 — le générateur refuse une configuration à zéro
participant ou à zéro table (§ 15.4) — et la 10 avant la 12 pour qu'une
impression ne sorte pas en brouillon.

### 2.2 Les fonctionnalités, numérotées

Le panneau « À propos » (§ 18.6) porte le sommaire des fonctionnalités du
logiciel, par catégorie. Chaque fonctionnalité a un **numéro** : le code de sa
catégorie, un tiret, deux chiffres. Un numéro est unique et **ne se réutilise
jamais** : une fonctionnalité retirée laisse le sien parmi les numéros retirés,
et une fonctionnalité nouvelle prend le plus grand numéro de sa catégorie,
retirés compris, plus un. Un signalement, une note de version ou une demande
peut ainsi nommer `PLA-08` sans craindre qu'il désigne demain autre chose.

Le tableau ci-dessous et le sommaire de l'application portent les mêmes
catégories, les mêmes numéros dans le même ordre, les mêmes intitulés et les
mêmes renvois ; une épreuve les compare, et vérifie que chaque renvoi désigne
une section de ce document. Les deux s'écrivent à la main (§ 19.8).

**Préparer** — `PRE`

| numéro | fonctionnalité | sections |
|---|---|---|
| `PRE-01` | Importer la liste des participants en CSV, après un aperçu | § 10.1 |
| `PRE-02` | Réexporter les lignes refusées d'un import | § 10.1 |
| `PRE-03` | Fondre les orthographes d'une même organisation, jamais en silence | § 10.1 |
| `PRE-04` | Saisir et corriger les participants à la main | § 10.2 |
| `PRE-05` | Exporter la liste des participants en CSV, dans la forme qu'il importe | § 10.2 |
| `PRE-06` | Étiqueter les personnes | § 4.5 |
| `PRE-07` | Dire la présence de chacun, tour par tour | § 4, § 10.2 |
| `PRE-08` | Exclure une personne, puis la réintégrer | § 4.4 |
| `PRE-09` | Créer les tables, avec un nombre de places par défaut et des surcharges | § 6.1 |
| `PRE-10` | Fixer le nombre de tours | § 2.1, § 4.3 |
| `PRE-11` | Donner des objectifs aux tables, à l'écran ou en CSV, et les exporter | § 4.5, § 10.4 |
| `PRE-12` | Télécharger les modèles CSV et les fichiers d'exemple | § 10.1, § 10.3 |
| `PRE-13` | Donner un libellé aux tables | § 4, § 7.7 |
| `PRE-14` | Donner un logo aux personnes | § 8.9, § 10.2 |
| `PRE-15` | Nommer les inclusions d'une personne : organisations et participants à rencontrer au moins une fois | § 4, § 10.1, § 10.2 |

**Placer** — `PLA`

| numéro | fonctionnalité | sections |
|---|---|---|
| `PLA-01` | Disposer les tables sur un plan de salle à l'échelle | § 7.1, § 7.7 |
| `PLA-02` | Déplacer et échanger les personnes sur le plan, au pointeur, au doigt ou par menu | § 7.1, § 7.3 |
| `PLA-03` | Désigner les animateurs, table par table | § 2.1, § 5.8 |
| `PLA-04` | Réserver des places à la main | § 5.8 |
| `PLA-05` | Refuser un geste impossible en nommant sa cause et son remède | § 5.9 |
| `PLA-06` | Lire le diagnostic avant toute recherche, avec le plafond et le plancher | § 5.5, § 5.6 |
| `PLA-07` | Choisir les critères et l'ordre des priorités | § 5.3, § 5.7 |
| `PLA-08` | Générer plusieurs propositions comparables, reproductibles par leur graine | § 5.7 |
| `PLA-09` | Calculer les propositions en parallèle, sur les cœurs du poste | § 5.10 |
| `PLA-10` | Repartir d'une proposition et en figer des tours | § 5.7 |
| `PLA-11` | Classer les propositions, et garder les meilleures | § 5.7 |
| `PLA-12` | Mesurer un placement sur la page de qualité | § 12 |
| `PLA-13` | Comparer deux placements par leur manque | § 12.10 |
| `PLA-14` | Retenir un placement | § 9 |
| `PLA-15` | Ajuster le placement retenu, qui suit les présences | § 5.8 |
| `PLA-16` | Signaler les tables en conflit sur le plan | § 7.5 |
| `PLA-17` | Inscrire le numéro de chaque table sur son plateau | § 7.7 |
| `PLA-18` | Voir chaque inclusion non satisfaite d'une proposition | § 5.7, § 7.5, § 12.15 |

**Produire** — `PRO`

| numéro | fonctionnalité | sections |
|---|---|---|
| `PRO-01` | Produire la planche de badges en PDF, sur A4 ou Lettre | § 11.1, § 11.2 |
| `PRO-02` | Vérifier le découpage par la feuille de contrôle | § 11.3 |
| `PRO-03` | Ordonner les badges pour l'accueil | § 11.6 |
| `PRO-04` | Ouvrir le dossier de l'événement, où la planche se dépose | § 11.6 |
| `PRO-05` | Imprimer la liste d'accueil | § 11.7 |
| `PRO-06` | Imprimer une feuille par table | § 11.7 |
| `PRO-07` | Imprimer le plan de salle, tour par tour | § 11.7 |
| `PRO-08` | Marquer BROUILLON ce qui n'est pas retenu | § 11.7 |
| `PRO-09` | Produire la liste des badges en CSV, pour un tableur | § 11.6 |

**Fichiers et sécurité** — `FIC`

| numéro | fonctionnalité | sections |
|---|---|---|
| `FIC-01` | Garder chaque événement dans des fichiers ordinaires, listés au premier écran | § 8.1, § 8.6 |
| `FIC-02` | Enregistrer chaque geste avec son entrée d'historique | § 8.2 |
| `FIC-03` | Revenir à un instant de l'historique | § 8.3 |
| `FIC-04` | Ouvrir en lecture par défaut, modifier sur demande | § 8.4 |
| `FIC-05` | Bloquer un plan distribué | § 9 |
| `FIC-06` | Copier, renommer, importer et supprimer un événement, vers une corbeille | § 8.7 |
| `FIC-07` | Résister à une panne, et reprendre un fichier abîmé | § 8.8 |
| `FIC-08` | Choisir le dossier de travail | § 8.6 |
| `FIC-09` | Travailler hors ligne, sans rien envoyer | § 2 |

**Interface** — `INT`

| numéro | fonctionnalité | sections |
|---|---|---|
| `INT-01` | Grouper les sections en trois phases : Préparer, Placer, Produire | § 2.1 |
| `INT-02` | Charger une démonstration | § 15 |
| `INT-03` | Choisir le thème clair ou sombre | § 14.5, § 18.6 |
| `INT-04` | Régler la taille du texte de l'écran | § 18.6 |
| `INT-05` | Agir au clavier, avec des contrastes vérifiés dans les deux thèmes | § 14.5 |
| `INT-06` | Voir la version partout, et la copier depuis « À propos » | § 18.6 |
| `INT-07` | Lire les licences, les liens et ce sommaire dans « À propos » | § 2.2, § 18.6 |

**Numéros retirés** : aucun.

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
jamais réutilisé ; un nom ; éventuellement un prénom, un courriel, des notes, et
une **organisation**, au sens large — le groupe qui sépare les gens qui se
connaissent déjà : entreprise, équipe, famille, école.

> L'identifiant est un petit entier et non un identifiant opaque. Le calcul de
> taille du § 8.6 repose dessus : sous la forme positionnelle du § 8.9, un
> identifiant de trente-six caractères remplace quatre octets par trente-neuf
> et **décuple** le poids des placements, qui sont la partie volumineuse du
> fichier.

Un participant porte aussi un **titre pressenti** — « animatrice », « hôte » —
qui est **purement informatif** : il s'imprime sur sa fiche, il n'attribue
aucun rôle, il ne pourvoit aucune place et il ne contraint rien. Il existe pour
qu'une liste reçue où les animateurs sont signalés ne perde pas cette
information à l'import. La désignation en lot lui emprunte le libellé du
titre qu'elle pose (§ 2.1 étape 6), la désignation une à une le propose
d'abord ; il ne pourvoit rien par lui-même.

Un participant peut porter la **marque de l'animation réservée** : elle dit
qu'il est **à désigner** animateur d'une table — une liste reçue où « animation
de la table d'honneur » est un titre pressenti ne dit pas, sinon, que la
personne doit animer. La marque est une **intention**, jamais le fait : elle ne
fait animer personne, ne pourvoit aucune place et ne contraint pas la
génération ; l'animateur reste celui que les titres pourvus désignent (§ 2.1
étape 6). « Créer les tables… » la lit, et désigne les personnes marquées sur
les tables qu'il crée (§ 6.1). Absente, elle vaut « non ». La fiche la saisit
par une case, la colonne CSV `animation_reservee` la porte à l'import comme à
l'export (§ 10.1, § 10.2), et la colonne « Animation » de la grille dit « à
désigner » pour une personne marquée, non exclue, qui n'anime encore aucune
table. Une personne exclue la garde, suspendue comme le reste.

Un participant peut être **exclu** sans être supprimé : il reste dans la liste,
il n'est plus placé, et il sort de toutes les statistiques.

Un participant porte une **présence** : les tours où il est là. Elle vaut « tous
les tours » tant que l'opérateur ne la change pas, et compte au moins un tour.
Hors de sa présence, la personne est **absente** à ce tour : elle n'y a ni
chaise ni place en réserve, ne compte pas dans les places de ce tour, et aucun
indicateur ne compte ce tour pour elle. Absente n'est pas exclue — l'exclusion
vaut pour toute la soirée et retire la personne de toutes les statistiques — ni
en réserve — la réserve tient une personne présente qui attend une table
(§ 7.1). « Personne présente », sans tour, désigne une personne non exclue,
présente à un tour au moins ; « présente au tour r » désigne ce tour.

Un participant que « Rendre les noms uniques » a renommé à l'import (§ 10.1)
porte la **marque du nom numéroté**, cachée : elle dit que le numéro final de
son nom — « Galet 01 » — vient de l'import, et non de la liste reçue. Ni la
fiche ni la grille ne la montrent, aucune colonne CSV ne la porte, et renommer
la personne la retire (§ 8.9, § 10.2).

**Table** — un **identifiant entier**, unique dans l'événement et jamais
réutilisé, exactement comme un participant ; un **numéro affiché** à partir
de 1 ; éventuellement un **libellé** — « Table d'honneur », « Coin des
invités » — de 60 caractères au plus ; un nombre de sièges ; une forme (ronde
ou carrée) ; une position sur le plan en centimètres. **Le nombre de sièges
d'une table ne change pas d'un tour à l'autre** : c'est une propriété du
mobilier.

Le libellé d'une table est **purement informatif**, comme le titre pressenti
d'une personne : le plan l'inscrit sous le numéro (§ 7.7), le panneau de la
table, son infobulle et son nom accessible le portent, et le titre de sa
feuille aussi (§ 11.7). Le moteur ne le lit pas : le poser, le changer ou le
retirer ne met aucun placement en dérive (§ 9).

> L'identifiant et le numéro affiché sont deux choses. La forme positionnelle du
> § 8.9 indexe les placements par **identifiant** : indexée par le rang d'une
> table, elle se tromperait de table dès qu'une table est supprimée, et le ferait
> en silence — trente-trois listes glissent d'un cran et tout le monde change de
> salle.

**Tour** — une des R rondes de la soirée. Dans une proposition, à chaque tour,
chaque participant non exclu présent à ce tour est assis à exactement une
table, sauf l'arrivée qu'un tour figé laisse en réserve (§ 5.7) ; un placement
ajusté peut tenir des présents en réserve (§ 7.1). Une personne absente à un
tour n'y occupe aucune place.

Un tour porte un **nom**, facultatif — « Apéritif », « Plat principal » —, de 60
caractères au plus ; sans nom, il se dit « Tour 3 ». Le nom est **purement
informatif**, comme le libellé d'une table : le moteur ne le lit pas, et le
poser, le changer ou le retirer ne met aucun placement en dérive (§ 9). Deux
tours peuvent porter le même nom. Il se saisit dans « Tables et tours », un
champ par tour, vide pour un tour sans nom, dont le texte indicatif est
« Tour 3 » ; saisir le nom par défaut d'un tour revient à vider son champ.
Retirer un tour retire son nom, que la fenêtre de la baisse nomme ; un tour
ajouté vient sans nom.

**Le nom se lit partout où un tour se désigne** à l'opérateur ou à l'invité,
sous trois formes. **Seul**, à la place de « Tour 3 », dans un titre, une tête
de colonne, un choix et une ligne de badge — « Plat principal — table 3 ». Dans
une colonne « Tour » qui ne porte que le numéro — le tableau des personnes
présentes par tour, l'itinéraire de la fiche, le choix du tour du plan —, à la
place du numéro. **Après son numéro, entre parenthèses**, dans une phrase, où le
numéro garde la grammaire — « absente au tour 2 (Plat principal) », « tours 1
(Apéritif) et 2 » ; une suite de tours consécutifs ne se resserre en
« tours 2 à 4 » que sur des tours sans nom. **À la place de « tour 3 »** dans
une mention brève, sans article — « (réservée, Plat principal) », « Plat
principal, table 5 ». Un libellé figé du journal prend le nom qu'a le tour au
moment du geste (§ 8.2). Une sortie imprimée pose le nom comme une donnée,
telle quelle, dans son propre nœud (§ 11.7).

**Le numéro reste là où une machine relit, ou où le fichier se décrit** : la
colonne `presence` du CSV des participants, à l'import comme à l'export
(« 1-3 », § 10.1), la colonne `tour` du CSV des objectifs (§ 10.4), les refus de
l'import qui citent une valeur du fichier, les fautes de forme du fichier et les
défauts du calcul, qui désignent une position, un tour qui n'existe pas, et
l'avancement du calcul exact (« tour 3 sur 5 »). La case compacte de la
présence, dans la grille, garde son numéro faute de place, et se nomme par le
nom du tour pour les technologies d'assistance. L'en-tête d'un bloc de tours de
la liste d'accueil, « Tours 1 à 34 », garde ses numéros : les colonnes du bloc
nomment chaque tour.

**Placement** — pour chaque tour, qui est à quelle table, et à quel siège si
les sièges sont attribués.

**Réservation** — **le seul objet** qui fixe quelqu'un quelque part. Elle lie
une personne à une place, et porte une **portée** : *un tour désigné*, ou *tous
les tours*. Elle contraint la génération, qui l'honore, et elle lui survit.

**Titre de place** — un libellé attaché à **une place**, jamais à une personne :
« ce siège est le siège de l'animateur ». Il ne nomme personne et vaut pour
toute la soirée.

**Étiquette** — un mot court qu'une personne porte — « finance », « Montréal »,
« bénévole » — et qu'un objectif de table vise. L'organisation sépare les gens
qui se connaissent déjà ; l'étiquette dit à quelle table une personne est
attendue. Une personne en porte de zéro à vingt.

**Conflit d'organisation** — une organisation qu'une personne nomme, et que
son organisation entière ne doit croiser à aucune table : si un membre de
l'organisation A nomme X, chaque membre de A évite chaque membre de X, et
chaque membre de X chaque membre de A, à chaque tour. Une personne sans
organisation qui nomme X évite X seule. Une personne porte une liste de
conflits, vide par défaut ; chaque organisation nommée est celle d'un
participant de l'événement, exclus compris, et jamais la sienne. Le conflit
est un critère de la recherche (§ 5.3, § 5.7), jamais une interdiction : la
recherche vise zéro et dit combien il en reste. L'exclusion suspend une
personne, pas son organisation : la liste d'un membre exclu de A relie encore
A à X, et ses collègues présents évitent X. Une personne exclue sans
organisation ne relie personne, et une organisation que seuls des exclus
portent n'est évitée de personne : comme toute statistique, le conflit ne
compte que des paires de présents.

Les listes suivent les organisations. Quand la dernière personne d'une
organisation en change, la référence suit ce renommage dans chaque liste,
dans la même entrée d'historique ; quand une organisation disparaît — sa
dernière personne supprimée, sans organisation, ou retirée par un import —,
elle quitte chaque liste dans la même entrée ; et une personne qui prend
l'organisation qu'elle nommait la retire de sa liste. Le libellé de l'entrée
le dit (§ 8.2).

**Inclusion** — une organisation ou une personne qu'une personne nomme pour la
**rencontrer au moins une fois** : partager une table avec elle à un tour au
moins, n'importe lequel. Une personne porte deux listes, vides par défaut : ses
**inclusions d'organisation**, chacune satisfaite quand la personne partage une
table avec au moins un membre de cette organisation, et ses **inclusions de
participant**, qui désignent chaque personne par son identifiant, jamais par
son nom : la renommer ne change rien, et deux homonymes restent distincts. Une
organisation incluse est celle d'un participant de l'événement, exclus compris,
et jamais la sienne ; une personne incluse est un participant de l'événement,
exclu compris, et jamais elle-même. Un collègue de sa propre organisation se
nomme comme un autre. Une inclusion que contredit un conflit de la personne
s'admet. L'inclusion n'est ni une réservation ni une fixation : elle ne place
personne et ne retire rien de ce que la génération peut faire ; c'est un
critère de la recherche et du classement (§ 5.3, § 5.7), que la mesure d'un
placement compte (§ 5.4). L'exclusion suspend une personne, pas ses listes :
la liste d'une exclue se garde, et une inclusion qui vise une exclue aussi.
Elle se saisit dans la fiche et dans la grille (§ 10.2), et s'importe en CSV,
une personne par son nom affiché (§ 10.1).

Les listes d'inclusions d'organisation suivent les organisations comme celles
des conflits : la référence suit le renommage de la dernière personne d'une
organisation, une organisation qui disparaît quitte chaque liste, et une
personne qui prend l'organisation qu'elle incluait la retire de sa liste. Une
personne supprimée quitte chaque liste d'inclusions de participant qui la
nomme. Tout cela se fait dans l'entrée du geste qui le provoque : son libellé
le dit (§ 8.2), et un retour arrière rend les listes d'avant (§ 8.3).

Une inclusion est **active** quand un plan qui honore les réservations peut la
satisfaire, au jugé de la configuration seule : la personne qui la porte n'est
pas exclue ; la personne incluse non plus, ou un présent porte
l'organisation incluse ; aucun conflit d'organisation ne sépare la personne de
la cible, ou des membres de l'organisation incluse ; et, à un tour au moins où
les deux sont présentes, une table peut les accueillir ensemble — leur table
réservée commune, la table réservée de l'une quand il y reste un siège, ou,
toutes deux libres, une table qui garde deux sièges. Une organisation incluse
l'est dès qu'un de ses membres l'est. Sinon l'inclusion est **hors
d'atteinte**, sous la première raison qui la retient : la personne incluse est
exclue, aucun présent ne porte l'organisation, un conflit la contredit, les
deux ne sont jamais présentes au même tour, les réservations les assoient à
deux tables différentes à chaque tour commun, aucune table n'a de place pour
les deux ; pour une organisation, la raison la plus proche du possible parmi
ses membres. Une inclusion hors d'atteinte ne compte nulle part, ni satisfaite
ni manquée : le diagnostic la nomme (§ 5.6). Sa propre organisation et une
cible nommée deux fois ne font pas d'inclusion de plus, et la liste d'une
exclue attend qu'elle soit réintégrée.

**Objectif de table** — une liste d'étiquettes attachée à une table, sous une
règle : *au moins une* de ces étiquettes, ou *toutes*. Il vaut pour la soirée,
ou pour un tour désigné. Il ne fixe personne : c'est un critère de la recherche
(§ 5.3), jamais une réservation.

**Proposition dérivée** — une proposition dont la recherche est partie du
plan d'une autre, son **départ**, au lieu d'un placement tiré (§ 5.7). Elle
nomme son départ — « dérivée de n° 4 » — et entre au classement comme toute
proposition. Son départ peut être en dérive par un changement de
participants : la recherche part alors de son plan ajusté (§ 5.7).
« Dérivée » dit d'où elle vient, jamais qu'elle est **en
dérive** (§ 9) : une proposition en dérive se dit « non comparable », avec
ses raisons ; la **graine dérivée** reste le nom de la graine de chaque
proposition, dérivée ou non. Le mot « variante » reste aux démonstrations
(§ 15) et à la copie d'un plan (§ 8.7), et ne désigne pas une dérivée.

**Tour figé** — un tour qu'une génération dérivée reprend du plan ajusté de son
départ, sans y déplacer personne : une personne absente à ce tour, exclue ou
supprimée en est retirée, sa chaise libre ; une personne présente que le départ
n'y assied pas y prend la meilleure chaise libre, ou y attend en réserve quand
aucune ne lui est permise (§ 5.7). Il ne fixe personne dans l'événement : il
n'est pas une réservation, ne change aucun statut (§ 4.2), et ne survit pas à
la génération qui l'a reçu.

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
| titre sans réservation | « il faut un animateur à la table 5, on ne sait pas encore qui » — **titre non pourvu**, et la liste de ces titres, dite **liste des titres de place non pourvus**, est sa liste de travail (§ 2.1, étape 6) |
| réservation sans titre | asseoir quelqu'un près de la sortie parce qu'il part tôt |
| les deux | le cas courant de l'animateur |

### 4.2 Trois statuts, calculés et non déclarés

| statut | définition |
|---|---|
| **ancré** | la personne est présente aux R tours, et une réservation fixe la même table à **chacun** d'eux |
| **mobile** | aucune réservation n'a d'effet à ses tours de présence |
| **partiellement fixé** | le reste : quelques tours, ou des tables différentes |

Une absence suspend la réservation au tour où elle tombe (§ 4.4) : un ancré
déclaré absent à un tour devient partiellement fixé, et sa place de ce tour
revient aux mobiles.

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

La portée « pour la soirée » d'un objectif de table (§ 4.5) est symbolique au
même titre : jamais développée en R objectifs, elle se retrouve intacte quand un
tour retiré revient. Un objectif de tour désigné suit les réservations de même
portée : retirer son tour le détruit, et le logiciel le dit avant d'appliquer
(§ 2.1, étape 5).

La présence « tous les tours » est symbolique au même titre : jamais énumérée,
elle s'étend au tour ajouté. Une présence énumérée — « tours 1 et 2 » — ne
s'étend pas, et l'ajout d'un tour le dit en nommant les personnes qu'il laisse
absentes de ce tour (`PRESENCE_TOURS_AJOUTES`). Retirer un tour le retire de
chaque présence ; une présence qui couvre alors chaque tour redevient « tous
les tours ». **Une présence qui n'en garderait aucun tour refuse le retrait**
(`PRESENCE_VIDEE_PAR_TOURS`), le refus nommant chaque personne et menant à la
liste des participants : retirer un tour ne fait jamais d'une personne une
exclue en silence. La présence d'une exclue se rogne de même ; quand elle se
viderait, elle part sans refus, et réintégrée, la personne est présente à tous
les tours.

### 4.4 L'exclusion l'emporte

Exclure une personne **suspend toutes ses réservations**, rend ses places aux
mobiles, rend les titres correspondants non pourvus, et le logiciel le dit. La
réintégration les rend. L'exclusion décrit une absence physique : aucune table
ne peut asseoir quelqu'un qui n'est pas là.

**L'absence à un tour suspend les réservations de ce tour**, comme l'exclusion
suspend toutes celles de la personne : une portée « tous les tours » ne vaut
plus qu'aux tours de présence, une réservation de tour désigné sur un tour
d'absence est suspendue, sa place rendue aux mobiles et son titre non pourvu à
ce tour, et le logiciel le dit. Rendre la présence les rend. Une animatrice
absente à un tour reste animatrice de sa table tant que sa réservation et son
titre existent : sa désignation est suspendue. Les désignations suspendues se
répartissent, par la règle des titres pourvus (§ 2.1 étape 6), sur les seuls
titres restés sans pourvoyeur pour la soirée, entre les réservations « tous
les tours » des absentes non exclues : elles ne prennent jamais le titre
d'une présente. La rangée « Animateurs » la garde, marquée de ses tours
d'absence, avec son retrait (§ 6.1). La présence d'une personne exclue se
garde, suspendue : ni la recherche, ni le placement, ni les titres ne la
lisent, et la réintégration la rend. **Retirer une personne après
des tours joués se fait par sa présence**, non par l'exclusion : elle garde sa
place aux tours où elle était là, et ses rencontres y comptent (§ 5.4) ;
l'exclusion et la suppression la retirent de toute la soirée, tours joués
compris, et le logiciel le dit quand le placement retenu l'asseyait.

### 4.5 Les étiquettes et les objectifs de table

**La forme d'une étiquette.** Une étiquette est un texte en forme normalisée de
composition (NFC), sans blanc en bord, ses blancs intérieurs — tout caractère
d'espacement qui n'est pas un caractère de contrôle — réduits à une espace. Elle
compte de 1 à 40 points de code. Elle ne porte ni `,`, ni `;`, ni `|` : ces
caractères séparent les étiquettes d'une cellule CSV (§ 10.1) et d'une saisie,
où « a|b » fait deux étiquettes, et une étiquette qui en porterait un se
couperait en deux à l'aller-retour (§ 10.2). Elle ne porte aucun caractère de
contrôle ni caractère invisible — de format ou ignorable par défaut, comme le
trait d'union conditionnel, l'espace sans chasse ou un contrôle
bidirectionnel —, tabulation comprise : invisible ou illisible à l'écran, il
ferait deux étiquettes d'apparence égale ; la fin de ligne, elle, sépare aussi.
Une personne porte au plus 20 étiquettes, un objectif en vise au plus 20 ; le
nombre d'étiquettes distinctes d'un événement n'a pas de borne propre.

**Deux orthographes, une étiquette.** Deux étiquettes de même clé normalisée —
espaces réduits, casse et accents ignorés, la clé du § 10.1 — sont la même
étiquette. La réconciliation se fait à l'entrée, sur l'événement entier,
personnes et objectifs confondus : une saisie qui donne « Finance » quand
« finance » existe reçoit l'orthographe existante, et le logiciel le dit, contre
le champ pour une saisie, dans le rapport pour un import. Quand l'événement
porte déjà plusieurs orthographes d'une même clé, la saisie reçoit la plus
petite par points de code ; deux orthographes d'une clé que l'événement ne porte
pas encore, dans une même saisie ou dans les lignes d'un même import, se fondent
de même en la plus petite : le résultat ne dépend ni de l'orthographe tapée ni
de l'ordre des lignes. Une saisie ne pose jamais deux fois la même étiquette
dans une liste : un doublon s'y fond. Le moteur compare ensuite les étiquettes
par égalité de chaînes, comme les organisations (§ 5.2). Un fichier retouché à
la main peut donc porter deux orthographes d'une même étiquette, que le moteur
tient pour deux ; l'analyse du fichier ne le refuse pas, même limite que pour
les organisations (§ 10.1).

**La règle d'un objectif.** Un objectif porte une liste non vide d'étiquettes et
une règle :

| règle | une personne correspond à l'objectif quand |
|---|---|
| **au moins une** (OU) | elle porte au moins une des étiquettes de l'objectif |
| **toutes** (ET) | elle porte chacune des étiquettes de l'objectif |

« finance OU RH » s'écrit [finance, RH] sous « au moins une » ; « finance ET
Montréal », [finance, Montréal] sous « toutes ». Un objectif d'une seule
étiquette se lit pareil sous les deux règles. La grammaire s'arrête là : ni
parenthèses, ni mélange des deux règles dans un objectif. « (finance ET
Montréal) OU RH » ne s'écrit pas ; ce qu'il décrit se répartit sur deux tables,
l'une « toutes : finance, Montréal », l'autre « au moins une : RH ». Une
grammaire à parenthèses demanderait un analyseur, des refus de syntaxe et un
éditeur que la saisie d'une liste n'a pas, pour un cas que deux tables couvrent.

**Le défaut de l'événement, la règle propre d'un objectif.** L'événement porte
une règle par défaut, « au moins une » tant que l'opérateur ne la change pas.
Chaque objectif **suit le défaut** ou porte **sa propre règle**, comme le nombre
de sièges d'une table suit le défaut ou le surcharge (§ 6.1) : l'écran montre
lequel des deux, et changer le défaut ne touche aucune règle propre.

**Pour la soirée, ou par tour.** Un objectif porte une portée, comme une
réservation : *pour la soirée* ou *pour un tour désigné*. Une table porte au
plus un objectif de soirée et au plus un objectif par tour. Au tour r,
l'objectif **en vigueur** à la table t est son objectif du tour r s'il existe,
sinon son objectif de soirée, sinon aucun : l'objectif d'un tour **remplace**
celui de la soirée, il ne s'y ajoute pas. Le mode n'est pas déclaré, il se lit
dans les données, comme le statut d'un participant (§ 4.2) : une table sans
objectif de tour garde le même objectif toute la soirée, une table qui en porte
un à chaque tour change d'objectif à chaque tour, et les deux se mêlent
librement.

**Correspondre à une table.** La personne p **correspond** à la table t au tour
r quand un objectif est en vigueur à t au tour r et que p lui correspond selon
sa règle. Une personne sans étiquette ne correspond à aucune table. Une table
sans objectif en vigueur ne correspond à personne. Une seule fonction décide
qu'une personne correspond à un objectif : le moteur, l'écran et l'import la
lisent (§ 13.2).

**Un couple possible, un tour servi.** Le couple (p, r) est **possible** quand p
est présente au tour r et correspond, à ce tour, à au moins une table qui peut
l'accueillir à ce tour : sa table réservée quand une réservation le fixe à ce
tour, sinon toute table qui garde à ce tour un siège qu'aucune réservation
n'occupe. Le tour r est **servi** quand p y est assis à une table qui lui
correspond et qu'il peut occuper à ce tour, au même sens. Le critère (§ 5.3) et
l'indicateur (§ 5.4) ne comptent que les couples possibles : une personne
qu'aucune table ne peut servir au tour r n'est pas « hors objectif » à ce tour,
où qu'elle soit assise ; une personne qu'une table pouvait servir et qui n'est
pas servie compte un tour hors objectif. Un couple fixé n'est possible que si sa
table réservée lui correspond, et il y est alors servi : un couple fixé n'est
jamais hors objectif, et le critère n'a pas de part imposée. Sur un plan ajusté
qui déplace une réservation, les tours servis ne dépassent toujours pas les
tours possibles.

**L'animateur, pour le critère du § 5.3.** La personne présente au tour r qui
pourvoit un titre de place à ce tour **anime** à ce tour, quel que soit le
libellé du titre ; est **animateur** la personne qui anime à un tour au moins.
Le fait se lit tour par tour, comme le statut d'ancré (§ 4.2), sur ce qui est
tenu et jamais sur la forme du stockage : une réservation de portée « tous les
tours » sur la place titrée fait animer à chaque tour, R réservations de tour
désigné sur cette place aussi, une seule réservation de tour désigné au seul
tour qu'elle couvre. Le pourvoyeur d'un titre à un tour se lit par la règle qui
dresse la liste des titres non pourvus (§ 4.1) ; sans sièges attribués,
plusieurs ancrés d'une table titrée n'en font qu'un animateur par titre, celui
que cette règle désigne. Une réservation pourvoit le titre : qui anime au tour r
est fixé à ce tour à la table du titre. Le logiciel ne porte aucune case « est
animateur » ; une réservation sans titre ne fait pas animer, et le titre
pressenti reste informatif (§ 4). Le diagnostic du § 5.6 garde son propre emploi
du mot, les ancrés d'une même organisation : un ancré sans titre n'anime pas,
qui n'anime qu'à un tour n'est pas ancré, et le code nomme les deux
différemment.

**Rencontrer un animateur.** La personne p **rencontre** l'animateur f quand p
et f partagent une table à un tour où f anime, à une table que p peut occuper à
ce tour. Partager sa table à un tour où f n'anime pas est une rencontre
ordinaire, que le critère des rencontres compte déjà. Un animateur en rencontre
un autre de la même façon : aux tours où lui-même n'anime pas, ou à une table
qui porte deux titres pourvus.

**La borne des animateurs.** B(p) borne, sur la seule configuration, le nombre
d'animateurs distincts que p peut rencontrer ; c'est le plus petit de deux
nombres. Le premier compte les animateurs f, autres que p, que p peut rejoindre
à un tour où p est présente et où f anime : à sa table fixée quand une
réservation fixe p à ce tour, sinon à une table qui garde à ce tour un siège
qu'aucune réservation n'occupe. Le second somme, sur les tours de présence de p,
le plus grand nombre d'animateurs autres que p qui animent à une même table que
p peut occuper à ce tour : p ne s'assied qu'à une table par tour. Aucun plan ne
fait rencontrer à p plus de B(p) animateurs ; aucun ne garantit d'atteindre
B(p). La personne est **concernée par les animateurs** quand B(p) > 0.

---

## 5. Le cœur : le placement

### 5.1 Le problème

Étant donné N participants et la présence de chacun, T tables de capacités
c₁…c_T et R tours, asseoir chaque personne à chacun de ses tours de présence de
façon à **maximiser le nombre de personnes distinctes que chacun rencontre**,
sous les contraintes que l'opérateur active.

C'est l'objectif de l'ordre des priorités par défaut (§ 5.7) ; l'opérateur peut
ranger d'autres critères devant, et l'ordre affiché dit alors lequel prime.

### 5.2 L'instance réduite : ce que les réservations changent

Soit k le nombre d'ancrés, dont k_t à la table t. Le moteur résout une
**instance réduite** : n = N − k mobiles, des tables de capacité libre
c′_t = c_t − k_t, les mêmes R tours.

Au tour r, les mobiles présents sont n_r, au plus n. La présence est un masque
par personne et par tour, qui ne réduit aucune capacité — un ancré est présent à
chaque tour (§ 4.2) — : un absent n'occupe aucun siège à ce tour, qui reste une
place libre de la recherche. Une seule fonction dit qu'une personne est présente
à un tour, une liste absente valant tous les tours (§ 13.2).

C'est la forme du problème initial **à une donnée près, et elle n'est pas
facultative** : chaque table transporte **l'ensemble des organisations de ses
ancrés**. Un mobile d'organisation X placé à une table où siège un ancré
d'organisation X viole « séparer les organisations » à **chacun des R tours**.
Réduire sans cette donnée produit un plan qui assoit un invité à côté d'un
collègue animateur tous les tours, **sans qu'aucun indicateur ne s'en
aperçoive**.

Moyennant cet ajout, le moteur n'a **qu'un seul chemin de code** : la
réservation est un prétraitement qui réduit les capacités, retire des
participants et annote les tables — jamais un second algorithme. Deux gardes
de l'arborescence le tiennent : dans le moteur, seuls la normalisation de la
configuration et le diagnostic lisent les réservations ; seuls la fonction
qui dit qu'une personne est présente, la normalisation et le diagnostic lisent
la présence, le diagnostic pour la ramener aux tours d'une soirée plus courte
qu'il sonde (§ 5.6). Les tours figés d'une génération dérivée (§ 5.7) n'y
entrent pas : ils ne réduisent aucune capacité, ne retirent personne et
n'annotent aucune table. La recherche les reçoit à part, ne tire aucun
mouvement dans ces tours, et compte leurs rencontres dans le score de la
soirée. L'inclusion n'y ajoute ni prétraitement ni placement préalable : c'est
un critère de la recherche (§ 5.3, § 5.7), et son mouvement dirigé (§ 5.10) ne
choisit que les sièges à échanger.

### 5.3 Les contraintes, activables une à une

| contrainte | ce qu'elle exige |
|---|---|
| **Séparer les organisations** | deux personnes de la même organisation ne partagent pas une table |
| **Nouveaux voisins à chaque tour** | deux personnes ne se retrouvent pas deux fois à la même table |
| **Nouvelle table à chaque tour** | *voir ci-dessous* |
| **Varier les organisations rencontrées** | sur l'ensemble des tours, chacun rencontre le plus d'organisations **différentes** possible |
| **Respecter les objectifs des tables** | à chacun de ses tours de présence, chacun est assis à une table dont l'objectif lui correspond, quand une telle table peut l'accueillir (§ 4.5), selon le mode réglé : le plus de places servies, chacun au moins une fois, ou l'équité d'abord |
| **Rencontrer le plus d'animateurs différents** | sur l'ensemble des tours, chacun rencontre le plus d'animateurs **différents** possible, là où ils animent (§ 4.5) |
| **Attribuer les sièges** | chacun reçoit un numéro de siège, pas seulement une table |

Ce sont des **objectifs**, pas des interdits : quand la configuration les rend
impossibles à satisfaire toutes, le moteur produit le meilleur compromis **et
dit lequel**, au lieu de refuser.

**Cochées, décochées, sans objet.** Un événement neuf coche les quatre premières
et « Respecter les objectifs des tables » ; « Rencontrer le plus d'animateurs
différents » et l'attribution des sièges sont décochées. Cochée d'office, la
case des animateurs changerait, à graine égale, le plan de chaque événement qui
pourvoit un titre de place. Un critère est **sans objet** quand l'événement ne
lui donne rien à mesurer : pour les objectifs, quand aucun couple (personne,
tour) n'est possible (§ 4.5) — aucune table à objectif en est un cas, un
objectif auquel aucune personne ne correspond en est un autre ; pour les
animateurs, quand aucune personne n'est concernée par les animateurs (§ 4.5), ce
qui arrive quand aucun titre n'est pourvu. Un critère décoché ou sans objet ne
compte nulle part : il ne pèse pas dans la recherche, ne classe pas (§ 5.7), ne
se nomme pas dans la phrase de l'ordre. Il garde son rang dans l'ordre des
priorités, où l'éditeur le marque « décoché » ou « sans objet » : le recocher le
remet là où l'opérateur l'avait rangé.

**Les cases et les critères de l'ordre.** L'ordre des priorités (§ 5.7) ne porte
aucune case : il montre l'état que donnent les cases de ce tableau.

| critère de l'ordre | il compte quand |
|---|---|
| écart au plafond a priori | toujours |
| excédent de collisions, collisions cumulées | « Séparer les organisations » est cochée — une case, deux critères |
| tours hors objectif | « Respecter les objectifs des tables » est cochée et a un objet |
| rencontres répétées et retours | « Nouveaux voisins » **ou** « Nouvelle table » est cochée ; décoché quand aucune des deux ne l'est |
| animateurs non rencontrés | « Rencontrer le plus d'animateurs différents » est cochée et a un objet |
| redondance d'organisation | « Varier les organisations rencontrées » est cochée |
| conflits d'organisation | toujours, sans case, quand il a un objet |
| inclusions non satisfaites | toujours, sans case, quand il a un objet |

**Le conflit d'organisation n'a pas de case.** Il compte dès qu'une paire de
personnes présentes est en conflit (§ 4) : une liste, d'une personne
présente ou d'un membre exclu d'une organisation qui compte des présents,
qui nomme l'organisation d'une personne présente. Sans liste, ou quand
aucune liste ne relie ainsi deux présents, il est sans objet — il ne compte
nulle part, et l'éditeur de l'ordre le marque « sans objet ». Un événement qui
ne porte aucune liste se génère donc exactement comme avant que le critère
existe : mêmes plans à graine égale, même classement, même phrase.

**Les inclusions n'ont pas de case.** Elles comptent dès qu'une inclusion est
active (§ 4). Sans liste, ou quand aucune inclusion n'est active, elles sont
sans objet, et l'éditeur de l'ordre les marque ainsi. Un événement sans
inclusion active se génère exactement comme avant que le critère existe :
mêmes plans à graine égale, même classement, même phrase. Quand des
inclusions sont actives mais que chaque liste dépasse ce que sa personne
peut rencontrer (§ 5.4), le critère a un objet et vaut zéro partout.

**« Attribuer les sièges » change les animateurs.** Sans sièges attribués, une
réservation sans siège à une table titrée peut pourvoir un titre de cette
table ; avec sièges attribués, seule une réservation à la place titrée le
pourvoit (§ 4.1). Changer cette case change donc les animateurs, et, la case des
animateurs cochée, le plan à graine égale.

**« Respecter les objectifs » n'est pas réserver.** L'objectif dit qui une table
attend, il n'assied personne ; la recherche le pèse avec les autres critères,
dans l'ordre que l'opérateur règle (§ 5.7). Une table d'objectif « finance » qui
reçoit plus de personnes « finance » qu'elle n'a de sièges en laisse ailleurs,
et l'indicateur le compte.

**Trois modes pour les objectifs.** Un réglage de l'événement, dans la section
Génération, dit ce que le critère cherche d'abord. Il lit, pour chaque personne,
ses tours possibles P(p) et ses tours servis s(p) (§ 5.4).

| mode | ce que le critère cherche | ce qu'il compare, dans l'ordre |
|---|---|---|
| **le plus de places servies** (par défaut) | le plus grand total de tours servis | les tours hors objectif |
| **chacun au moins une fois** | d'abord le plus de personnes concernées servies à un tour au moins, puis le plus grand total | les personnes jamais servies, puis les tours hors objectif |
| **l'équité d'abord** | d'abord la personne la plus mal servie, puis le plus grand total | le plus de tours hors objectif d'une personne, puis les tours hors objectif |

Dix personnes « finance », une table « finance » de huit places, quatre tours :
les trois modes servent au mieux les 32 places. Le premier peut laisser une
personne sans aucun tour servi ; le deuxième sert chacun une fois au moins, et
peut laisser une personne à un seul tour quand d'autres en ont quatre ; le
troisième sert chacun trois tours au moins. « L'équité d'abord » mesure chacun
contre ses propres tours possibles, comme l'écart au plafond a priori mesure
chacun contre son plafond (§ 5.5) : quand tous les concernés ont autant de tours
possibles, il cherche le plus grand des plus petits nombres de tours servis ;
une personne qu'une réservation tient hors objectif à un tour ne fixe pas la
cible des autres. Ce n'est pas un indice d'équité (§ 12.8) : le minimum d'abord,
puis le total (§ 12.1). Le libellé de ce mode à l'écran est le seul texte du
logiciel qui porte le mot « équité » ; son explication ne l'emploie pas, et le
journal nomme le mode « le minimum, puis le total ». Le mode ne compte que quand
le critère compte : sans objectif, aucun mode ne change rien.

**Tant qu'une personne qui a le plus de tours possibles n'en a aucun de servi,
« l'équité d'abord » compare ce que compare « chacun au moins une fois ».** Le
plus de tours hors objectif d'une personne vaut alors ce plus grand nombre de
tours possibles, et les personnes qui l'atteignent sont les jamais servies,
quand celles-ci ont toutes le plus de tours possibles. Sur une soirée où il en
reste une quel que soit le plan, les deux modes rendent les mêmes plans : le
troisième ne se distingue du deuxième que là où chacun peut être servi une fois.

**« Rencontrer le plus d'animateurs » n'est pas « rencontrer le plus de
monde ».** Sur une soirée tendue où chaque table porte un animateur à chaque
tour, atteindre le plafond a priori (§ 5.5) fait déjà visiter des tables
distinctes, donc rencontrer autant d'animateurs que de tours : le critère y
départage peu. Il départage quand des tables n'ont pas d'animateur ou en ont
plusieurs, quand un animateur n'anime qu'à certains tours, et quand le plafond
de rencontres ne force pas des tables distinctes.

**« Nouvelle table à chaque tour », énoncée correctement.** La formulation
naïve — « personne ne revient à une table déjà occupée » — est fausse pour un
ancré dès le deuxième tour, et une exception « sauf les animateurs » laisserait
sans réponse le cas d'un participant ordinaire réservé au tour 1. L'énoncé
porte donc sur **ce que le moteur décide** :

> Le moteur n'assoit jamais un participant à une table où il l'a déjà assis, ni
> à une table où l'opérateur l'a placé.

Aucune exception n'est nécessaire. Pour un ancré, le moteur ne décide rien : la
règle est vraie sans rien exiger.

**« Varier les organisations » n'est pas « séparer les organisations ».** La
première porte sur **celle des autres**, **à travers les tours** ; la seconde
sur **la sienne**, **à l'intérieur d'un tour**. Elles s'activent séparément.

### 5.4 Les indicateurs

Tout placement proposé porte les mêmes chiffres, pour que la comparaison soit
une lecture et non un jugement :

| indicateur | définition |
|---|---|
| **personnes distinctes rencontrées** | sur ses tours de présence ; une personne revue compte une fois |
| **collisions cumulées** | occurrences (paire, tour) où deux personnes d'une même organisation partagent une table — l'unité dans laquelle les planchers du § 5.6 se démontrent |
| **paires de même organisation** | **paires distinctes** réunies au moins une fois ; jamais la même unité que la ligne précédente |
| **excédent de collisions** | collisions cumulées − paires distinctes : le nombre de **retrouvailles au-delà de la première** entre deux personnes d'une même organisation. Nul quand aucune paire de collègues n'est réunie deux fois |
| **conflits d'organisation** | occurrences (paire, tour) où deux personnes en conflit d'organisation (§ 4) partagent une table, dans la même unité que les collisions cumulées ; « — » quand aucune paire de présents n'est en conflit |
| **rencontres répétées** | paires réunies plus d'une fois |
| **nombre maximal de rencontres d'une même paire** | |
| **retours à une table déjà occupée** | *voir ci-dessous* |
| **organisations distinctes rencontrées** — A(p) | nombre d'organisations différentes portées par les personnes **affiliées** que p rencontre, **la sienne comprise** |
| **redondance d'organisation** — r(p) | \|F(p)\| − A(p), où F(p) sont les affiliés rencontrés ; r = 0 signifie qu'aucune organisation n'a été recroisée |
| **taux de diversité** — d(p) | A(p) / \|F(p)\| ; « — » quand \|F(p)\| = 0 |
| **manque** | plafond réalisé − rencontres (§ 5.5) — la grandeur qui compare deux propositions (§ 12.10) |
| **écart d'itinéraire** | plafond a priori − plafond réalisé (§ 5.5, § 12.10) |
| **tours selon l'objectif** — s(p) | tours servis de p : tours où p est assis à une table dont l'objectif en vigueur lui correspond et qu'il peut occuper (§ 4.5) ; ils ne dépassent pas P(p), ses **tours possibles**, les couples (p, r) possibles |
| **tours hors objectif** | Σ (P(p) − s(p)) : couples (p, r) possibles (§ 4.5) où p n'est pas servi ; zéro veut dire que personne n'est hors objectif, et n'est atteignable que si les places libres des tables à objectif suffisent (plancher au § 5.6) |
| **personnes jamais servies** | personnes concernées dont s(p) vaut zéro |
| **le plus de tours hors objectif d'une personne** | max (P(p) − s(p)) sur les personnes concernées |
| **animateurs rencontrés** — m(p) | animateurs distincts (§ 4.5) que p rencontre à un tour où ils animent, lui-même non compté ; un animateur rencontré à plusieurs tours compte une fois ; m(p) ne dépasse pas B(p), la borne des animateurs |
| **animateurs non rencontrés** | Σ (B(p) − m(p)) sur les personnes présentes placées : ce qui leur reste à rencontrer de ce que la configuration leur permettait |
| **inclusions satisfaites** — sat(p) | inclusions actives de p (§ 4) satisfaites : p partage une table, à un tour au moins, n'importe lequel, avec la personne incluse, ou avec un membre au moins de l'organisation incluse ; elles ne dépassent pas I(p), ses **inclusions atteignables** |
| **inclusions non satisfaites** | rencontres demandées non satisfaites : chaque inclusion active non satisfaite d'une personne dont la liste ne dépasse pas son plafond, une même paire de personnes ne comptant qu'une fois, quel que soit le sens des demandes ; sans objet sans inclusion active |

**Les agrégats portent sur tous les participants placés.** Le minimum se calcule
sur l'ensemble, ancrés compris, et **deux lignes secondaires** donnent la même
mesure restreinte aux **mobiles** et aux **ancrés**. Un participant
partiellement fixé compte parmi les mobiles.

> Un ancré n'est pas structurellement désavantagé : à table de 8 avec un seul
> ancré et R = 4, son plafond vaut 28, exactement celui d'un mobile visitant
> quatre tables de 8. Le retirer du minimum cacherait un animateur réellement
> mal servi, qui est précisément la personne dont on veut connaître le sort.
> Les deux lignes secondaires existent pour que l'opérateur sache si le minimum
> global désigne un défaut qu'une relance corrige, ou la conséquence de son
> propre plan de réservation.

Le minimum des rencontres porte les siennes en colonnes au tableau des
propositions (§ 5.7), et en tuiles sur la page de qualité (§ 12.2). Les autres
agrégats — le minimum de A(p), celui de d(p), les trois chiffres du manque
(§ 12.10.4), les minimums de s(p) et de m(p) — les écrivent **sous leur
chiffre**, sur une ligne en encre secondaire : « mobiles 26 · ancrés 24 ». Elles
ne s'y écrivent que quand la population que l'agrégat mesure compte des mobiles
et des ancrés — celle de s(p) et de m(p) n'est que leurs concernés : sans ancré,
l'une écrirait « — » et l'autre répéterait le chiffre de tête. Le minimum de
A(p) les tait aussi quand le taux de diversité écrit « — » : personne n'y
rencontre d'organisation, et A(p) vaut 0 pour tous.

**Des rencontres, le minimum s'affiche, jamais la moyenne.** Le minimum décrit
le sort de la personne la plus mal servie, qui est celle qui se plaindra. La
moyenne ne sépare rien : quand les tables sont pleines à chaque tour, le nombre
de voisinages créés est fixé par le mobilier, et la moyenne est la même pour
toutes les propositions (§ 12.8).

**La redondance se lit par sa somme**, Σ r(p), la grandeur que la recherche et
le classement lisent (§ 5.7). Elle va dans l'autre sens que les autres
colonnes — plus elle est grande, pire est le sort —, et son minimum désignerait
la personne la mieux servie.

**Les deux unités de collision ne se mélangent jamais.** Un chiffre de collision
cité quelque part — § 5.6, § 12.4, § 15.3, une étape du pilotage — **nomme son
unité**. Un plan qui garde les deux mêmes collègues ensemble aux quatre tours
mesure **4** collisions cumulées et **1** paire distincte : confondre les deux
fait afficher une mesure inférieure à son propre plancher.

**Une collision répétée coûte plus cher que la même quantité répartie, et c'est
l'excédent qui le dit.** Trois plans à comparer, tous en conflit :

| plan | collisions cumulées | paires distinctes | excédent |
|---|---|---|---|
| un collègue retrouvé **quatre fois** | 4 | 1 | **3** |
| deux collègues retrouvés **deux fois** chacun | 4 | 2 | **2** |
| six collègues retrouvés **une fois** chacun | 6 | 6 | **0** |

Le dernier est le moins mauvais, bien qu'il porte le **plus** de collisions
cumulées — passer la soirée avec le même collègue est pire que croiser six
collègues une fois. Ni les collisions cumulées ni les paires distinctes, prises
seules, ne rendent cet ordre : **les deux classent le premier plan en tête**,
c'est-à-dire exactement à l'envers. L'excédent le rend, et c'est pour cela que
l'ordre par défaut du § 5.7 le range en tête, devant les collisions cumulées.

**Les rencontres répétées ne le rendent pas non plus : elles comptent des
paires.** Une paire réunie deux fois ou plus compte pour une rencontre
répétée, quel que soit le nombre de ses retrouvailles ; les paires de
collègues revues en font une, deux et aucune dans les trois plans. Classer
d'abord sur elles mettrait le troisième en tête, mais **le premier devant le
deuxième** : le plan qui garde un collègue toute la soirée passerait devant
celui qui ramène deux collègues deux fois chacun. L'ordre par défaut range
donc l'excédent devant les rencontres répétées aussi, et classe les trois
plans du dernier au premier.

Les trois restent **affichés** : ce sont trois conflits, et aucun ne se cache
derrière la grandeur qui ordonne.

**Quand une population est vide, le logiciel écrit « — », jamais zéro.** Un
ensemble vide n'est pas une mesure nulle.

**Les objectifs des tables se lisent sur les personnes concernées.** Une
personne est **concernée** quand au moins un de ses tours est possible (§ 4.5).
Le minimum de s(p), les personnes jamais servies et le plus de tours hors
objectif d'une personne portent sur les concernées ; le minimum a ses deux
lignes secondaires, mobiles et ancrés. Sans personne concernée — aucun objectif,
ou des objectifs que personne ne peut servir —, tous les chiffres des objectifs
écrivent « — », le total des tours hors objectif compris : un événement qui n'a
rien pu viser n'a rien manqué, et le signalement de l'objectif (§ 5.9) dit
pourquoi.

**Les tours hors objectif ne se séparent pas en choisis et imposés.** Un couple
fixé n'est possible que si sa table lui correspond, et il y est servi (§ 4.5) :
la part imposée vaudrait toujours zéro.

**Les animateurs rencontrés se lisent sur les personnes concernées.** Le minimum
de m(p) porte sur les personnes présentes placées concernées par les animateurs
(B(p) > 0, § 4.5), avec les deux lignes secondaires, mobiles et ancrés. Une
personne qui ne peut rencontrer aucun animateur, quel que soit le plan, mettrait
le minimum à zéro sur toute proposition : elle n'y entre pas, et vaut zéro dans
les animateurs non rencontrés. Un animateur y entre comme tout autre : aux tours
où il n'anime pas, il rencontre ceux qui animent. Comme les personnes
rencontrées, les animateurs rencontrés ne se séparent pas en imposé et choisi.
Sans personne concernée, m(p) et les animateurs non rencontrés écrivent « — ».

**Les inclusions se lisent sur les inclusions actives** (§ 4) ; une inclusion
hors d'atteinte n'y entre pas. Pour une personne p, k°(p) compte ses
inclusions actives ; Q(p) ses personnes incluses ; d(p) ses organisations
incluses qui contiennent une personne de Q(p) ; b(p) = k°(p) − d(p) les
personnes qu'il lui faut rencontrer pour toutes les satisfaire, une personne
n'ayant qu'une organisation ; K(p) son plafond a priori (§ 5.5), le plus de
personnes distinctes qu'un plan valide lui fait rencontrer. Ses inclusions
atteignables valent

```
I(p) = min( k°(p) , K(p) + min( K(p) , d(p) ) )
```

et aucun plan valide n'en satisfait davantage : parmi les M personnes qu'elle
rencontre, |M| ≤ K(p), chacune satisfait au plus sa propre inclusion et celle
de son organisation, et une personne de Q(p) ne touche qu'une organisation
qu'elle couvre, d'où sat(p) ≤ |M| + min(|M|, d(p)). Prendre d'abord une
personne de Q(p) par organisation couverte, puis une personne par inclusion
restante, atteint I(p) dès que K(p) personnes sont libres de la rencontrer.
Deux régimes en sortent :

- **b(p) ≤ K(p)** : toute la liste est atteignable, I(p) = k°(p), et chaque
  inclusion active que le plan ne satisfait pas est une inclusion non
  satisfaite, nommée ;
- **b(p) > K(p)** : la liste demande plus de personnes que p n'en peut
  rencontrer. Ne pas la satisfaire tout entière n'est pas une erreur : ses
  inclusions ne comptent jamais parmi les inclusions non satisfaites, et le
  nombre de celles qu'elle aurait pu atteindre, I(p) − sat(p), est une
  information.

Les inclusions non satisfaites comptent des **rencontres demandées**. Une
inclusion de personne demande la rencontre de la paire ; une inclusion
d'organisation dont un seul membre peut partager une table avec la personne
(§ 4) demande la même, car dans un plan qui honore les réservations ce membre
est le seul qui la satisfasse. Les inclusions qui demandent une même paire, dans
un sens ou dans l'autre, ne comptent qu'une fois, dès que l'une des deux
personnes reste dans son plafond. Une inclusion d'organisation que plusieurs
membres peuvent satisfaire est une rencontre à elle seule. Sans inclusion
active, le critère est sans objet, et ni colonne ni tuile n'écrit ces chiffres
(§ 5.7, § 12.2).

**Aucun de ces chiffres ne s'additionne à un autre pour s'afficher.** Un palier
pondéré du § 5.7 somme des paires, des couples (personne, tour) et des
personnes : sa clé est un ordre, jamais un indicateur, et ne s'affiche nulle
part.

**Ce que le moteur a décidé, et ce que les réservations imposent.** L'indicateur
« retours à une table » ne compte que les retours **choisis par le moteur** ;
ce que les réservations imposent est énoncé **à part et chiffré** — « 99
retours imposés par 33 ancrages ». Sinon l'indicateur affiche la même valeur
pour toute proposition et cesse de les séparer. La même lecture vaut pour les
rencontres répétées entre deux personnes réservées à la même table.

**Les indicateurs se mesurent sur le plan complet** — chaque personne présente,
à chacun de ses tours de présence —, comme si les réservations n'existaient pas.
Un tour d'absence ne compte ni rencontre, ni retour, ni tour possible, ni tour
en réserve : la personne n'y est pas. Les rencontres d'une personne dont la
présence s'arrête après des tours joués comptent, pour elle et pour ceux qu'elle
a rencontrés, aux tours où elle était là. Des formes closes servent au
diagnostic préalable ; elles ne corrigent jamais après coup un chiffre mesuré.
Deux arithmétiques pour une même quantité sont le mode de défaillance que le
§ 13.2 interdit.

**La page de qualité lit, en plus, des mesures qui ne classent rien.** Elles
décrivent un placement à la fois (§ 12) ; aucune n'entre dans la recherche ni
dans le classement, et aucune ne s'affiche dans le tableau des propositions.
Elles se mesurent, comme les autres, sur le plan complet, par le même parcours
des tours.

| mesure | définition | population, et « — » |
|---|---|---|
| **capacité** — c_t | sièges de la table t (§ 4) | toute table |
| **occupants** — o_{t,r} | personnes assises à la table t au tour r | toute table, tout tour ; une table vide à un tour donne une case vide, « — » |
| **affiliés assis** — α_{t,r} | occupants qui portent une organisation | idem |
| **organisations à la table** — δ_{t,r} | organisations distinctes portées par les affiliés assis | « — » quand α_{t,r} = 0 |
| **sièges sans organisation nouvelle** — c_t − δ_{t,r} | sièges de la table au-delà du nombre de ses organisations distinctes : siège vide, assis sans organisation, ou second d'une organisation ; zéro veut dire que chaque siège porte une organisation de plus | « — » quand α_{t,r} = 0 |
| **assis sans organisation nouvelle** — o_{t,r} − δ_{t,r} | occupants au-delà du nombre des organisations distinctes ; zéro veut dire que chaque assis porte une organisation de plus | idem |
| **doublons d'organisation** — α_{t,r} − δ_{t,r} | affiliés assis au-delà du premier de leur organisation ; zéro veut dire qu'aucune organisation n'est assise deux fois à cette table ce tour-là | idem |
| **possibles du tour** — Π_r | couples (p, r) possibles au tour r (§ 4.5), fixés compris | personnes concernées ; « — » sans couple possible à ce tour |
| **servis du tour** — S_r | couples (p, r) servis au tour r : p assis à une table dont l'objectif en vigueur au tour r lui correspond et qu'il peut occuper | idem |
| **hors objectif du tour** | Π_r − S_r ; la somme sur les tours est le total des tours hors objectif | idem |
| **assis sans table possible** — σ_r | personnes présentes au tour r et assises à une table dont le couple (p, r) n'est pas possible : concernées ou non, sans étiquette comprises ; une personne en réserve à ce tour n'y est pas, une personne absente à ce tour non plus | tout tour, dès qu'une personne est concernée ; écrit même quand Π_r = 0 |
| **personnes rencontrées en animant** — U_f, U_{f,r} | pour un animateur f, les personnes distinctes assises à sa table à un tour où il anime, à une table qu'elles peuvent occuper (§ 4.5), lui non compté : sur l'union de ses tours animés, U_f ; au seul tour r, U_{f,r} | animateurs présents ; « — » sans animateur |
| **organisations rencontrées en animant** — A_f, A_{f,r} | organisations distinctes portées par les affiliés de U_f, de U_{f,r} | idem |
| **étiquettes rencontrées en animant** — E_f, E_{f,r} | étiquettes distinctes portées par les personnes de U_f, de U_{f,r}, chaque étiquette comptée une fois quel que soit le nombre de ses porteurs | animateurs présents, quand une personne présente porte une étiquette ; « — » sinon |
| **tours animés** — T_f | tours où f anime | animateurs présents |

Les trois comptes du mélange d'une table s'emboîtent : c_t − δ ≥ o − δ ≥ α − δ
≥ 0, chacun nul exactement quand son dénominateur ne porte que des organisations
distinctes.

Un couple fixé n'est possible que si sa table réservée lui correspond, et il y
est servi (§ 4.5) : Π_r − S_r = P_r − S^nf_r, où P_r compte les couples
possibles du tour dont la personne n'est pas fixée (§ 5.6) et S^nf_r les servis
non fixés. Les symboles P_r, P′_r et L_r gardent le sens du § 5.6 ; U_f se lit
comme les rencontres d'animateurs du § 4.5, qui ne comptent qu'à une table que
la personne peut occuper.

Le compte de personnes rencontrées par chacun, défini plus haut, est déjà le
nombre de personnes **nouvelles** qu'elle rencontre : une personne revue y
compte une fois. Son mélange se lit par la répartition de ce compte (§ 12.3) et
par son pourcentage du plafond réalisé, toujours accompagné du compte.

**Les pourcentages de la page de qualité** sont ceux de quatre rapports, et
d'eux seuls (§ 12.8) :

| rapport | numérateur | dénominateur |
|---|---|---|
| rencontres d'une personne | rencontres(p) | plafond réalisé(p) |
| tours possibles servis, d'un tour ou de la soirée | S_r, ou Σ_r S_r | Π_r, ou Σ_r Π_r |
| tours servis d'une personne | s(p) | P(p), ses tours possibles |
| organisations d'une table à un tour, par siège, par assis, par affilié | δ_{t,r} | c_t, o_{t,r}, α_{t,r} |

Le moteur les calcule, par une seule fonction : ⌊100 · n / d⌋, borné à 1 et à 99
quand 0 < n < d, et « — » quand d vaut 0. Jamais 0 % tant que le compte n'est
pas nul, jamais 100 % tant qu'un manque existe. Aucun n'entre dans la recherche,
le classement ou le tableau des propositions.

### 5.5 Le plafond et la borne prouvée

Deux notions, **deux noms, jamais trois**.

Le **plafond** est une borne arithmétique, **individuelle**, toujours
calculable. La **borne prouvée** est l'affirmation plus forte qu'une
construction l'atteint. Elle seule autorise la mention « minimum atteint ».

**Une seule formule, paramétrée par l'itinéraire.** Écrire une formule par
statut garantit qu'elles se contrediront, et aucune ne couvrirait un
participant partiellement fixé. Pour une personne p et un itinéraire — la table
qu'elle occupe à chacun de ses tours de présence :

- D = les tables **distinctes** visitées, m_t = tours passés à la table t ;
- a_t = le nombre d'**ancrés** de la table t, p non compté ;
- v_t = c_t − 1 − a_t = les sièges qui changent d'occupant ;
- C(p) = les autres personnes présentes à un tour au moins où p l'est, ses
  **co-présents**, et |C(p)| leur nombre, N − 1 sans absence ;
- n_p^C = parmi elles, celles qui ne sont pas ancrées ; sans absence,
  n_p = n − 1 si p est mobile ou partiellement fixé, n s'il est ancré.

```
plafond(p) = min( |C(p)| , Σ a_t + min( n_p^C , Σ m_t · v_t ) )
                           t∈D                t∈D
```

Les ancrés d'une table visitée sont rencontrés **une fois**, quel que soit le
nombre de tours passés là ; les sièges libres se renouvellent, mais ne peuvent
livrer plus de personnes qu'il n'existe de mobiles que p peut croiser.

Un tour d'absence n'entre dans aucun itinéraire : le plafond a priori d'une
personne présente à deux tours sur quatre est celui de deux tours, et son écart
d'itinéraire ne porte rien de son absence. Le premier terme est |C(p)|, et non
N − 1 : une personne ne rencontre que ses co-présents. Avec N − 1, une seule
absence laisserait le plafond au-dessus de ce que la soirée permet, et la
chaîne `rencontres ≤ plafond réalisé ≤ plafond a priori ≤ |C(p)| ≤ N − 1`, que
les épreuves tiennent contre une énumération, ne tiendrait plus. Un ancré étant
présent à chaque tour (§ 4.2), les a_t ancrés occupent leur table à chaque
tour, comme sans absence.

> Le terme `min(n_p, …)` n'est pas décoratif. Un ancré **ne rencontre jamais
> les ancrés des autres tables**. Sans ce terme, sur 4 tables de 5 avec un
> ancré chacune et 5 tours, la formule annonce 19 là où 16 est le vrai maximum :
> l'opérateur voit à perpétuité un animateur « à 84 % de son plafond » et
> relance une génération qui ne peut rien.

**Deux moments, deux bases, et un glossaire qui fait autorité.** Le plafond
dépend de l'itinéraire, et les deux plafonds ne se calculent pas sur la même
base :

| terme | définition | base | où il s'affiche |
|---|---|---|---|
| **plafond a priori** | maximisé sur les itinéraires admissibles de ses tours de présence | **capacités** | diagnostic § 5.6, tuile § 12.2 |
| **plafond réalisé** | calculé sur l'itinéraire de la proposition | **occupation** | à côté de chaque mesure |
| **borne prouvée** | l'affirmation qu'une construction atteint le plafond | — | mention « minimum atteint » |
| **manque** | plafond réalisé − rencontres | — | tuile du manque maximal (§ 12.2), courbe de comparaison (§ 12.10) |
| **écart d'itinéraire** | plafond a priori − plafond réalisé | — | tuile de l'écart d'itinéraire maximal (§ 12.2), avec son plancher, comme au diagnostic (§ 5.6) |
| **écart au plafond a priori** | manque + écart d'itinéraire | — | départage § 5.7, certificat |

Ces six lignes sont la **seule** définition faisant autorité, et l'expression
« l'écart », employée seule, ne paraît nulle part : trois quantités affichées
sous un même libellé font conclure à l'opérateur que le logiciel compte mal. La
règle « deux notions, deux noms, jamais trois » n'est pas affaiblie — aucun de
ces noms ne désigne une **borne**, et il n'existe toujours que deux bornes sur
les rencontres — la borne de diversité et la borne des animateurs bornent
d'autres grandeurs et ne prouvent rien — ; elle est simplement tenue par un
tableau plutôt que par la mémoire du rédacteur.

Sans le partage a priori / réalisé, le diagnostic annonce 28, la page de qualité
affiche 27, et l'opérateur conclut à une régression du moteur.

**Le plafond réalisé se calcule sur l'occupation, jamais sur la capacité.** Soit
I l'itinéraire de p — les couples (table, tour) où p est assis —, D les tables
distinctes de I, et o_{t,r} l'occupation de la table t au tour r :

```
plafond réalisé(p) = min( |C(p)| ,  Σ a_t  +  min( n_p^C ,   Σ     v_{t,r} ) )
                                   t∈D                    (t,r)∈I

                     avec  v_{t,r} = o_{t,r} − 1 − a_t
```

Le terme des ancrés reste une somme sur les tables **distinctes** — un ancré
rencontré à trois tours compte une fois ; seul le terme des sièges qui se
renouvellent devient une somme sur les **tours parcourus**. Sans cette
substitution, une personne assise à une table de 8 occupée par 7 porte un manque
de 1 qu'aucun placement ne retire, et le manque perd la seule propriété qui le
rend lisible : zéro veut dire *rien à reprendre*. Les plafonds annoncés au
§ 15.1 ne changent pas, la configuration principale étant exactement tendue —
l'occupation y vaut la capacité à chaque tour.

L'inégalité `plafond a priori ≥ plafond réalisé` n'est vraie que dans cet
ordre : pour un même itinéraire, l'occupation ne dépasse jamais la capacité.

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

**Le certificat se lit contre le plafond a priori**, donc sur `manque + écart
d'itinéraire`, jamais sur le seul manque : une proposition qui range tout le
monde sur des itinéraires bas atteint son plafond réalisé partout et n'a rien
prouvé. Lire le certificat sur le manque seul ferait annoncer « minimum atteint »
à la proposition qui a le plus mal routé les gens. Conséquence directe, que le
guide d'usage écrit : **la grande démonstration ne décerne jamais ce
certificat**, son écart d'itinéraire maximal étant plancher à 1 (§ 12.10.4).

Quand aucun chemin ne conclut, le logiciel affiche l'**écart au plafond a
priori** et écrit **« atteignabilité inconnue »**, jamais « peut mieux faire » :
l'un invite à relancer, l'autre dit que relancer ne prouvera rien.

**La borne de diversité.** A(p) a sa propre borne arithmétique, calculée comme
le plafond réalisé, sur l'occupation de la proposition. Elle borne une autre
grandeur que les rencontres et ne prouve rien : elle se nomme **borne de
diversité**, jamais plafond, pour ne jamais se confondre avec le plafond des
rencontres. Soit G le nombre d'organisations distinctes des personnes
présentes — les exclues n'en apportent aucune —, N_aff le nombre de personnes
présentes affiliées, g_p l'effectif de l'organisation de p, et ε_p = 1 si p est
affiliée, 0 sinon :

```
A_max(p) = min( Φ_aff(p) , G , (N_aff − g_p) + 1 )     si p est affiliée
A_max(p) = min( Φ_aff(p) , G )                          sinon
```

où Φ_aff(p) est le **plafond réalisé des affiliés** : la formule du plafond
réalisé, où seuls les affiliés comptent comme occupants —

```
Φ_aff(p) = min( N_aff − ε_p ,  Σ a^aff_t  +  min( n^aff_p ,   Σ     v^aff_{t,r} ) )
                              t∈D                       (t,r)∈I

           avec  v^aff_{t,r} = α_{t,r} − ε_p − a^aff_t
```

a^aff_t compte les ancrés affiliés de t, p non compté ; n^aff_p, les mobiles et
partiellement fixés affiliés, p non compté ; α_{t,r}, les affiliés assis
(§ 5.4). Φ_aff(p) borne |F(p)|, les affiliés que p rencontre, pour la même
raison que le plafond réalisé borne ses rencontres. Le « + 1 » compte
l'organisation de p, qu'un collègue rencontré suffit à apporter : sans lui, un
événement où tout le monde partage une organisation annoncerait A_max = 0 alors
que chacun en rencontre une. Une personne sans organisation n'en apporte aucune,
et ses autres termes la bornent déjà. Chaque autre organisation comptant au
moins une personne présente, (N_aff − g_p) + 1 ne descend jamais sous G : le
terme rappelle d'où vient la borne, G la tient.

La borne de diversité se trace sur le profil en comptes, en pointillés, sous son
nom, et s'écrit dans la tuile des organisations distinctes rencontrées, dans le
jumeau et dans l'infobulle du profil (§ 12.2, § 12.3) ; aucun pourcentage ne la
prend pour dénominateur. La garde du § 12.3 éprouve A(p) ≤ |F(p)| ≤ Φ_aff(p) et
A(p) ≤ A_max(p). Elle ne se calcule pas a priori : le diagnostic garde sa
redondance minimale (§ 5.6).

### 5.6 Le diagnostic, avant la recherche

Certaines configurations rendent un conflit **inévitable**, quel que soit
l'algorithme. Le logiciel les détecte **avant** de chercher et énonce ce qui est
inévitable, **combien**, et ce qui le rendrait évitable :

- plus de personnes d'une organisation que de tables → « au moins 8 collisions
  cumulées sur les 4 tours, portées par au moins 2 paires distinctes ». Le
  plancher se démontre **en occurrences** ; le chiffre nomme donc son unité, et
  le compte de paires distinctes l'accompagne (§ 5.4). Le plancher se calcule
  tour par tour sur les membres présents à ce tour, et reste prouvé quelles que
  soient les absences ;
- **le plancher de l'excédent**, quand un groupe de g personnes subit un plancher
  de C collisions cumulées et que `C > C(g, 2)` : les retrouvailles sont alors
  forcées, et l'excédent ne descend pas sous `C − C(g, 2)`. Le diagnostic l'écrit
  **quand il est strictement positif**, et se tait sinon — annoncer un plancher
  nul laisserait croire qu'un plancher a été calculé là où il n'y en a pas ;
- **le plancher des conflits en étoile**, quand des conflits d'organisation
  (§ 4) empêchent des organisations de partager une table. Le graphe relie
  deux organisations en conflit ; une personne sans organisation n'y entre
  pas, seule de son unité. Une composante est **en étoile** quand une
  organisation, le centre, est en conflit avec chacune des autres, ses
  branches, et qu'aucune autre paire ne l'est — deux organisations seules en
  conflit forment une étoile à une branche. Dans tout plan sans conflit, une
  table d'un tour reçoit des membres du centre ou des membres des branches,
  jamais des deux, et les branches se partagent les mêmes tables. Soit
  f(n, k) le plus petit Σ C(xⱼ, 2) de n personnes sur k tables, celui de la
  répartition la plus égale (infini pour n > 0 et k = 0) : au tour r, n₀ et
  nᵢ les présents du centre et de chaque branche, le plancher du tour vaut
  `min sur a ∈ [0, T] de f(n₀, a) + Σᵢ f(nᵢ, T − a)`, et celui de la
  composante la somme sur les tours. Les capacités sont relâchées : la borne
  ne dépasse jamais le minimum de tout plan sans conflit. Deux organisations
  de 20 et 13 personnes en conflit, sur 22 tables de 8 et 4 tours : « les
  organisations « A » et « B » ne peuvent jamais partager une table : tant
  qu'aucun conflit ne se produit, au moins 44 collisions cumulées sur les 4
  tours (11 par tour) », là où chacune seule n'en impose aucune ; un centre
  de 27 contre trois branches de 10, 13 et 13 : 24 par tour, 96 en tout. Le
  diagnostic l'écrit, sous séparation active, dans une carte « Organisations
  en conflit », **seulement quand il dépasse la somme des planchers par
  groupe** de ses organisations — sinon il n'apprend rien. Il se tait quand
  un membre de la composante est réservé à une table, ne serait-ce qu'à un
  tour — les tables bloquées ne sont pas modélisées —, quand la composante
  n'est pas une étoile, et quand un tour ne laisse aucun plan sans conflit,
  une seule table pour le centre et une branche présents. Son remède : des
  tables de plus, jusqu'à l'annuler, ou lever le conflit, qui le ramène aux
  planchers de chaque organisation. Ce plancher ne vaut que sans conflit : un
  plan qui en accepte peut compter moins de collisions ;
- **le plancher exact de chaque tour**, qu'un solveur en nombres entiers,
  HiGHS, calcule hors du fil de l'interface. Les contraintes dures d'un plan —
  capacités, présence, réservations, ancrés — portent chacune sur un seul tour,
  et conflits comme collisions cumulées sont des sommes par tour : les tours se
  découplent, et chacun se résout seul. Au tour r, **(A)** dit si un placement
  du tour sans conflit d'organisation existe — zéro conflit est possible si et
  seulement si (A) vaut à chaque tour — et **(AC)** donne le minimum exact des
  collisions du tour parmi ces placements, toutes organisations comprises : les
  capacités les lient même sans conflit — 20 et 13 personnes sans conflit sur
  des tables de 11, 11, 6 et 5 places en imposent 63 par tour, là où la somme
  par groupe en dit 55. Les optimums des tours se recollent en un plan : la
  somme des (AC) est le minimum exact des collisions cumulées des plans sans
  conflit, un plancher qu'un plan atteint. Le modèle agrège chaque
  organisation : à chaque table, le nombre de ses membres libres, ses réservés
  en constante, ses collisions par les cordes de C(x, 2), exactes aux valeurs
  entières ; une personne sans organisation qui porte un conflit forme son
  unité, les autres remplissent les sièges restants. Égal au plancher des
  étoiles sur les étoiles éprouvées, il est strictement plus fort ailleurs :
  trois organisations de 12, toutes en conflit, sur 9 tables de 8, en imposent
  54 par tour, là où le plancher des étoiles se tait et la somme par groupe dit
  9. **Ce qu'il ne couvre pas** : il ne vaut que pour un plan sans conflit,
  comme celui des étoiles ; et la meilleure proposition du moteur ne l'atteint
  pas forcément — l'excédent et les rencontres répétées, qui lient les tours,
  passent avant les collisions cumulées dans l'ordre par défaut (§ 5.7) —, si
  bien qu'aucun énoncé ne promet que le moteur l'atteindra. **Chaque résolution
  dispose de 30 secondes** ; un tour arrêté sans placement en enchaîne une
  seconde, de faisabilité seule. Un tour qui atteint sa limite ne donne qu'une
  borne prouvée : le plancher se dit alors « au moins », prouvé mais peut-être
  pas atteignable ; un tour arrêté avant toute borne y compte pour zéro, et une
  limite qui tait aussi la faisabilité du tour ne laisse rien affirmer sur zéro
  conflit. Un échec du solveur n'est jamais lu comme une preuve. Le calcul ne se
  fait ni sur une configuration refusée, ni quand un tour manque de places —
  aucun plan n'existe, et ce manque ne doit pas se dire conflit inévitable —, ni
  sous séparation décochée. Le plancher des étoiles reste le repli instantané,
  et l'épreuve croisée : sur des charges tirées, il ne dépasse jamais la somme
  des (AC), et chaque (AC) égale le minimum d'une recherche exhaustive. Le
  diagnostic l'écrit, en tête de la carte de tout l'événement, **seulement
  quand il dépasse** la somme des planchers par groupe renforcée par les
  étoiles : « tant qu'aucun conflit ne se produit, les tables imposent au
  moins 216 collisions cumulées sur les 4 tours (54 par tour) : c'est le
  minimum exact, qu'au moins un plan sans conflit atteint », et, sous une
  limite, la même phrase sans le minimum exact, que son explication dit
  prouvée mais peut-être pas atteignable. Quand (A) tombe à un tour, hors
  des tours où des personnes en conflit sont réservées à une même table —
  l'énoncé des conflits imposés les dit déjà —, la carte « Organisations en
  conflit » énonce « aucun plan ne peut éviter tout conflit d'organisation
  au tour 2 », avec son remède — des tables de plus, lever un conflit ou
  retirer une réservation —, et les étoiles se taisent : leur promesse
  « tant qu'aucun conflit ne se produit » est vide. La carte de la
  proposition choisie lit ses collisions contre le plus fort des deux
  planchers pour une proposition sans conflit — au minimum quand elles
  l'égalent, même sous une limite, une borne valide égalée étant minimale —,
  contre la somme par groupe seule pour une proposition qui en a, et, quand
  aucun plan n'évite tout conflit, dit qu'une relance ne les fera pas tomber
  à zéro et ne propose plus de relancer pour eux ;
- redondance minimale `r_min(p) = max(0, |F(p)| − G)` → « au moins 6
  organisations recroisées par personne ; avec 3 tours au lieu de 4, aucune ne
  le serait » ;
- **tous les animateurs de même organisation** → chaque mobile accumule au
  moins min(R, T) − 1 redondances qu'aucune recherche ne réduit. Remède : les
  laisser sans organisation déclarée, ou leur en donner des distinctes ;
- **taux d'ancrage par table** : une table dont tous les sièges sont ancrés ne
  tourne plus ; une table à moitié ancrée réduit d'autant le brassage de tout
  l'événement ;
- **le plancher de l'écart d'itinéraire maximal**, quand la configuration en
  impose un (§ 12.10.4). Le diagnostic ne l'écrit que là où il sait le prouver,
  et se tait ailleurs — en particulier dès qu'une personne est absente à un
  tour, sa preuve supposant chacun présent à chaque tour ; **jamais 0 par
  défaut** ; sur la page de qualité, la
  tuile de ce chiffre l'écrit dessous (§ 12.2). Sans ce plancher, le troisième
  chiffre de la page envoie relancer indéfiniment vers un zéro que la
  configuration interdit ;
- **le manque de places**, à un tour r où Σ c_t est inférieure au nombre de
  personnes présentes au tour r. Ce n'est pas un refus de geste mais une
  **propriété de la configuration** (§ 5.9) : le diagnostic la nomme avec le
  nombre de places manquantes, et **la génération la refuse**
  (`PLACES_MANQUANTES`). Sans absence, le manque est le même à chaque tour, et
  l'énoncé le dit d'un nombre : « Il manque 2 places à chaque tour pour
  asseoir toutes les personnes ». Dès qu'une présence est partielle, il nomme
  chaque tour qui en manque — « Il manque 2 places au tour 3 et 1 place au
  tour 4 pour asseoir les personnes présentes » —, même quand ces tours
  couvrent la soirée. Une personne absente à un tour n'y demande pas de place ;
- **les objectifs hors d'atteinte** : au tour r, une personne servie qui n'est
  pas fixée occupe un siège libre — qu'aucune réservation n'occupe — d'une table
  dont l'objectif est en vigueur. Le nombre de tours hors objectif est donc au
  moins Σ_r max(0, P_r − L_r), où P_r compte les couples (p, r) possibles dont p
  n'est pas fixé au tour r, et L_r les sièges libres des tables qui portent un
  objectif au tour r. Un siège libre ne sert qu'une personne par tour : les
  personnes jamais servies sont au moins #C′ − Σ_r min(L_r, P′_r), où #C′ compte
  les personnes concernées qu'aucune réservation ne sert — les autres sont
  servies d'office — et P′_r celles de C′ dont le tour r est possible. Le plus
  grand ne descend pas sous la moyenne : le plus de tours hors objectif d'une
  personne est au moins le plancher des tours hors objectif divisé par le nombre
  de personnes qui ont un tour possible non fixé, arrondi au-dessus. Chaque
  plancher se calcule en O(T·R + N·R) une fois les couples possibles connus. Le
  diagnostic écrit le plancher de chaque valeur que le mode réglé compare
  (§ 5.3), quand il est strictement positif, et se tait sinon, comme pour
  l'excédent de collisions ; il se tait aussi quand le critère des objectifs est
  décoché ou sans objet, qui ne compare rien. Il ne tient pas compte de qui
  correspond à quelle table : un plancher plus serré demande un flot par tour,
  que le logiciel ne calcule pas. Sur dix personnes « finance », une table
  « finance » de huit places et quatre tours, les planchers valent huit tours
  hors objectif, zéro personne jamais servie et un tour hors objectif pour une
  personne ; sur quarante personnes, 128, huit et quatre ;
- **les conflits d'organisation imposés** : deux personnes en conflit (§ 4)
  que des réservations assoient à une même table d'un tour s'y rencontrent
  dans tout plan qui honore les réservations. Le diagnostic les compte, en
  occurrences (paire, tour), sur le plan des seules réservations — le même
  que mesure tout placement à ces tours —, et l'écrit quand ce compte est
  strictement positif : « 4 conflits d'organisation imposés par les
  réservations », avec pour remède de déplacer ou de retirer l'une de ces
  réservations. C'est le plancher des conflits de tout plan qui honore les
  réservations ; la page de qualité l'écrit sous la tuile des conflits
  (§ 12.2). Une réservation qui réunit deux personnes en conflit n'est pas
  refusée : elle est signalée.

L'objectif auquel aucune personne présente ne correspond est signalé à
l'objectif même (§ 5.9).

**Les inclusions qu'aucun plan ne satisfait.** Le diagnostic relève chaque
inclusion hors d'atteinte (§ 4), avec sa raison et la personne qui la porte. Il
relève aussi chaque personne **au-delà de son plafond**, dont la liste demande
plus de personnes qu'elle n'en peut rencontrer, b(p) > K(p) (§ 5.4) : avec ses
inclusions actives, les personnes qu'elles demandent, son plafond a priori et
ses inclusions atteignables I(p), si bien que k°(p) − I(p) d'entre elles restent
hors de portée quel que soit le plan. Ce sont des informations, jamais des
avis : aucun plan ne lève une inclusion hors d'atteinte, et ne pas satisfaire
toute une liste qui dépasse n'est pas une erreur. Elles ne touchent à aucun
plancher : celui des collisions, pris sur tous les plans, reste valide. Les
énoncés nomment les personnes : « inclusion hors d'atteinte : Iris Ombrelle →
Théo Pervenche, les deux ne sont jamais présentes au même tour », avec le remède
de sa raison — réintégrer la personne incluse, retirer le conflit ou
l'inclusion, rendre les deux présentes à un même tour, déplacer une réservation,
libérer un siège ; sans présent de l'organisation, un constat — ; « Ondine
Lacasse : 9 inclusions demandent 8 personnes ; la soirée lui en fait rencontrer
au plus 6, donc au plus 7 satisfaites, et 2 restent hors de portée », avec pour
remède de raccourcir la liste ou de lui faire rencontrer plus de monde.

**Sous absence.** Dès qu'une personne non exclue est absente à un tour, le
diagnostic le dit en tête de la carte de tout l'événement, après les
collisions et l'excédent : « 2 personnes ne sont pas présentes à chaque tour :
l'écart d'itinéraire n'a pas de plancher prouvé, et chaque chiffre se lit sur
les tours de présence. » Les planchers des collisions, de l'excédent et des
objectifs restent : ils se calculent tour par tour sur les présents, et une
absence ne sort pas un plan de leur domaine (§ 12.4). Seul l'écart
d'itinéraire perd le sien.

À l'écran, les énoncés se regroupent en cartes, sans changer d'ordre : la
séparation des organisations vidée de son sens, une carte par organisation en
collision, titrée de sa pastille d'organisation (§ 12.7), celle des
organisations en conflit, une ligne par étoile, ce qui vaut pour tout
l'événement, puis la carte « Inclusions », les inclusions hors d'atteinte puis
les listes au-delà de leur plafond.

**Chaque énoncé s'explique, toujours visible.** Dans la section du
diagnostic — le panneau compact à côté du plan garde les énoncés seuls —,
chaque énoncé est suivi d'une phrase « Concrètement : … » qui dit ce qu'il
signifie avec les chiffres de l'événement, puis de son remède. Un remède qui
dit un geste s'ouvre sur « Pour changer cela : » ; un remède qui dit un
constat — ce qu'aucune relance ne change, ce que les réservations veulent —
reste sans amorce. Rien ne s'y invente : chaque phrase se compose des
chiffres de l'énoncé et de ceux que le diagnostic porte déjà — capacités et
ancrés de chaque table, présents de chaque tour, nombre de tours —, et une
formule ne s'écrit que lorsque le chiffre de l'énoncé l'égale. Sur 4 tours
à des tables de 8 :

- le **plafond a priori** se dit par la table quand toutes les tables ont la
  même capacité c et que le plafond vaut R × (c − 1) : « à une table de 8, on
  rencontre 7 personnes par tour ; sur les 4 tours, 28 personnes différentes
  au plus, et seulement sans jamais revoir quelqu'un », suivi, sans absence et
  tant qu'il reste des personnes à rencontrer, du geste « Pour changer cela :
  des tables plus grandes, ou un tour de plus. » ; son remède, un constat,
  dit que seuls les capacités, le nombre de tours et les réservations le
  changent. Égal aux N − 1 autres personnes de l'événement, absence ou non,
  il se dit tel, sans geste ni capacité ; ailleurs, sans absence, il se dit
  par les capacités, sans formule ; sous absence, par les capacités et par
  les seules personnes présentes à chaque tour, sans trancher laquelle des
  deux bornes le fixe : le diagnostic ne donne pas les tours de présence
  d'une ligne. Sa première ligne porte aussi les **places vides**, quand des
  places restent vides à un tour — sur la grande démonstration sans
  exception : « 4 places restent vides à chaque tour, 260 personnes pour 264
  places : une personne assise à une table incomplète y rencontre une
  personne de moins par place vide, et ce plafond, compté sur des tables
  pleines, peut alors lui échapper » — quand le nombre de places vides varie
  d'un tour à l'autre, « Jusqu'à 4 places restent vides selon le tour ». Une
  présence partielle qui laisse le même nombre de places vides à chaque tour
  garde la première forme. C'est la source de l'écart d'itinéraire que le
  diagnostic ne chiffre pas d'avance quand des places restent vides ;
- les **retours imposés**, quand chaque personne qui en porte revient R − 1
  fois : « chacune des 33 personnes réservées à une table y reste aux 4
  tours, et y revient donc 3 fois ; ces retours sont voulus par les
  réservations et ne comptent pas contre les propositions » ; sinon leur
  compte et le nombre de personnes ;
- les **collisions** d'une organisation disent si les tables manquent ou si des
  réservations réunissent ses membres, et combien de fois deux d'entre eux
  partagent une table ; l'**excédent**, que deux collègues déjà assis ensemble
  se retrouvent ; l'**écart d'itinéraire**, que des tables plus petites ou plus
  ancrées se remplissent quand même ; une table **gelée** ou **à moitié
  ancrée**, qui y reste et combien de places s'y renouvellent ; les
  **animateurs** d'une même organisation, combien de fois un mobile la
  recroise ; la **redondance**, les **objectifs**, le **manque de places**, les
  **conflits imposés** et la **présence par tour**, chacun de ses propres
  chiffres ; une **étoile de conflits**, que chaque tour partage les tables
  entre le centre et ses branches, le plancher de ses organisations une à une,
  sans le conflit, et ce que le partage y ajoute ; une **inclusion hors
  d'atteinte**, qu'elle ne compte ni parmi les satisfaites ni parmi les non
  satisfaites ; une **liste au-delà du plafond**, que ne pas la satisfaire tout
  entière n'est pas une erreur, combien un placement lui en satisfait au plus,
  et que la page de qualité dit combien il en laisse encore possibles sans les
  atteindre.

**La proposition choisie, expliquée.** Sous la carte de tout l'événement,
la section — le panneau compact ne la porte pas — pose une carte « La
proposition choisie », toujours visible. Elle explique un placement : la
proposition demandée au plan quand la liste la porte, sinon le retenu,
sinon la première du classement, comme la source de la page de qualité
(§ 12) puis la meilleure proposition de la section Génération ; elle dit
laquelle — « Proposition n° 4, montrée au plan », « Le placement retenu »,
« La meilleure du classement, n° 7 ». Sans proposition, elle dit d'en
générer une ; aucune ne se classant, elle le dit ; une proposition en
dérive ou fautive se dit telle, sans chiffres. Une configuration refusée
n'a pas de carte. Ses phrases lisent la ligne d'évaluation du placement —
les valeurs mêmes des colonnes du tableau des propositions (§ 5.7) — et le
diagnostic que la table porte, sans rien mesurer à nouveau, en trois blocs
titrés :

- **Ce qui est atteint** : le minimum des rencontres, rapporté au plafond a
  priori des personnes qui l'atteignent — « Le moins bien servi rencontre 23
  personnes différentes, sur les 28 que son plafond a priori permet », leur
  étendue quand ces plafonds diffèrent —, les minimums des mobiles et des ancrés
  quand les deux populations existent ; puis, chacun quand son critère compte
  (§ 5.3) — coché, avec un objet —, les conflits d'organisation, les inclusions
  — « 2 rencontres demandées par les inclusions sur 5 ne se font pas : ce sont
  les inclusions non satisfaites », ou que chacune se fait, rien quand chaque
  liste active dépasse ce que sa personne peut rencontrer, puis, quand des
  listes dépassent ce que leurs personnes peuvent rencontrer, combien de leurs
  inclusions encore possibles le placement n'atteint pas, ou que toutes sont
  atteintes, sans que ce soit un avis —, les collisions — « 9 fois, deux
  personnes d'une même organisation partagent une table, toujours des paires
  différentes : aucune paire de collègues ne se retrouve deux fois » à excédent
  nul —, les retours choisis sous « nouvelle table », la diversité, les
  objectifs et les animateurs. Un plancher du diagnostic ne se dit égalé que sur
  un plan qui honore les réservations. Le plancher des collisions qui vaut pour
  tout plan est la somme des planchers par groupe ; pour un plan sans conflit,
  chaque étoile de conflits y remplace la somme de ses organisations par son
  propre plancher. Des collisions qui égalent ce plancher renforcé, sans aucun
  conflit, se disent au minimum : « Ses collisions sont au minimum : aucune
  relance ne les fera baisser sans créer de conflit d'organisation. » Le minimum
  atteint du § 5.5, qui se lit sur les rencontres, n'en change pas ;
- **Ce qui manque, et pourquoi** : l'écart au plafond a priori maximal,
  décomposé en ses deux parts (§ 12.10.5) — la place, par l'écart
  d'itinéraire maximal, les places vides de chaque tour et le plancher que
  le diagnostic prouve, et les revoirs, par le plus grand manque,
  l'effectif du manque et les rencontres répétées choisies, avec le plus
  grand nombre de rencontres d'une paire quand aucune paire imposée par
  les réservations n'y entre —, puis, quand les deux plus
  grands ne tombent pas sur la même personne — leur somme dépasse le plus
  grand écart —, la phrase qui le dit ; puis, quand le certificat ne conclut
  pas, « hors d'atteinte » si le diagnostic prouve un plancher d'écart
  d'itinéraire — au moins tant de mobiles finissent sous leur plafond a
  priori quel que soit le placement, aucun placement n'atteint donc celui
  de chacun —, « atteignabilité inconnue » sinon ; à écart nul, une phrase
  seule, le minimum atteint (§ 5.5) ;
- **Ce qu'on peut tenter**, des gestes qui existent seulement : « Repartir
  d'elle » — « Générer » pour le retenu, qui ne l'offre pas — avec un
  compte d'arrêt plus élevé que celui qui a produit la proposition — que
  le réglage, pour le retenu —, quand des revoirs coûtent des
  rencontres, quand une règle active reste au-dessus de ce que le
  diagnostic prouve inévitable — des conflits au-delà des conflits imposés,
  des collisions au-delà de leur plancher, renforcé par les étoiles pour un
  plan sans conflit, un excédent —, ou quand l'écart
  d'itinéraire dépasse l'inévitable : le plancher prouvé, ou, sans lui, une
  rencontre dès que des places restent vides, car qui s'assoit à une table
  incomplète y en perd au moins une ; accorder les places des tables aux
  présents quand des places vides coûtent des rencontres — des tables
  pleines retirent les places vides, et si leurs capacités diffèrent alors,
  le diagnostic dit l'écart d'itinéraire qui demeure ; les capacités ou les
  ancrages qui diffèrent quand l'écart d'itinéraire a un plancher prouvé ;
  au minimum atteint, « Rien pour les rencontres », suivi de « Repartir
  d'elle » si une règle reste au-dessus de son plancher. Un bloc sans
  phrase ne s'écrit pas.

Un opérateur à qui l'on dit « c'est impossible, voici pourquoi, voici le
remède » cesse de relancer en espérant mieux.

### 5.7 Plusieurs propositions, pas une

Une génération produit **plusieurs placements distincts et comparables**, en
nombre réglable : vingt par défaut pour un événement neuf (§ 5.10). Les
générations **s'accumulent** : relancer avec d'autres réglages ajoute des
candidats plutôt que d'effacer les précédents, et un classement unique les
ordonne tous. Une commande efface la liste en épargnant celui qui est retenu.
Une génération **écarte la proposition dont le placement est déjà celui** d'une
proposition comparable de la liste, ou d'une qu'elle vient de garder, et
l'annonce comme identique : deux lignes du classement sont toujours deux
placements. Effacer épargne la seule proposition d'où vient le
retenu ; il emporte le départ d'une proposition dérivée comme toute autre
proposition, et la dérivée gardée nomme alors un départ qui n'est plus dans la
liste (§ 8.9).

**« Garder les N meilleures » allège la liste sans la vider.** La commande
`garderMeilleures {n}` garde les n premières propositions du classement unique
— les n premières lignes que le tableau montre, dans son ordre : les
comparables dans l'ordre du classement, puis celles hors classement par
identifiant —, et la proposition d'où vient le placement retenu quand elle
vient après elles : n + 1 au plus. Les autres s'effacent, en une seule entrée
d'historique que « Défaire » reprend (§ 8.3), libellée « Gardé les 10
meilleures propositions, effacé 37 propositions », et « gardé aussi la retenue
(n° 42) » quand la proposition du retenu reste en plus. Le partage se lit sur
la mesure qui classe le tableau, jamais sur un ordre que l'écran referait. Le
compteur ne recule pas (§ 8.9), et l'état du plan ne change pas : une
proposition au moins reste. Rien à effacer — n au moins le nombre de
propositions, ou la seule au-delà est celle du retenu — : le geste est sans
effet, refusé comme tel (§ 8.2). En lecture et sur un plan bloqué, la séance le
refuse comme tout geste qui modifie (§ 8.4, § 9) ; une configuration qui ne se
normalise pas ne se classe pas, et son refus nomme sa cause, sans remède. Les
courses des propositions effacées quittent le compagnon des courses comme à
l'effacement (§ 8.6) ; rien de nouveau ne s'écrit dans le fichier (§ 8.9).
Comme l'effacement, il ne protège aucun départ : il peut emporter le départ
d'une proposition dérivée qu'il garde, et celle-ci nomme alors un départ qui
n'est plus dans la liste.

**Le tableau dit la présence.** Au-dessus du classement, sous une présence
partielle : « 2 personnes ne sont pas présentes à chaque tour : chaque chiffre
se lit sur leurs tours de présence. » Quand aucune proposition n'est classée
parce que les participants ont changé depuis leur calcul : « Aucune
proposition n'est classée : les participants ont changé depuis leur calcul.
« Repartir d'elle », dans le menu d'une ligne, en génère des propositions
dérivées qui suivent la soirée telle qu'elle est. »

**« Garder les N meilleures » refuse d'effacer sans avoir comparé.** Une
proposition qu'un changement de participants a seul mise en dérive ne se classe
pas, mais sert encore de départ (plus bas). Quand le classement compte moins de
n lignes et qu'une ligne à effacer sert ainsi de départ, le geste est refusé
(`NETTOYAGE_SANS_CLASSEMENT`), sans remède : « 3 propositions ne sont pas
classées depuis le changement de participants : garder les 10 meilleures les
effacerait sans les avoir comparées. Générer d'abord une dérivée. » Le refus
passe avant le geste sans effet, et se pose à côté du bouton, sans fenêtre. Une
proposition que le mobilier a mise en dérive ne sert pas de départ et n'arrête
rien.

**N est une saisie de la section, jamais écrite.** Il se saisit dans un champ
étroit à côté du bouton, dix au départ, un entier d'au moins 1, et le bouton le
nomme : « Garder les 10 meilleures », « Garder la meilleure ». Comme le filtre
d'une liste, ni le fichier ni le journal ne le portent : il se règle en
lecture, et revient à dix quand la section se rouvre. Une saisie qui n'est pas
un entier d'au moins 1 se refuse contre le champ, et le bouton garde le dernier
nombre accepté.

**Une fenêtre à confirmer précède le nettoyage**, parce qu'il efface d'un coup
des lignes que l'opérateur ne voit pas toutes : « Effacer 37 propositions et
garder les 10 meilleures ? ». Elle dit que les premières du classement restent,
que la proposition du retenu reste aussi quand elle vient après elles, et que
« Défaire » rend les effacées. Ouverte, elle se recompte sur chaque écriture
qui arrive pendant qu'elle attend — une génération qui s'achève en
arrière-plan ajoute des propositions à effacer —, et le compte qu'elle montre
est celui que « Confirmer » applique, sauf pour une écriture déjà en file au
moment du clic, que la commande voit avant elle : l'annonce donne alors le
compte réel, et « Défaire » rend tout. « Annuler » et Échap la referment sans
rien écrire, le focus revenu au bouton. Un geste que la séance refuserait, ou
qui n'effacerait rien, part sans fenêtre, et son refus se pose à côté du
bouton. Abouti, une annonce dit le nombre de propositions effacées, celui que
la commande rend dans son résumé (`{effacees}`), et la page montrée qui
n'existe plus ramène à la première.

Au-delà de cent propositions, le tableau se lit par pages de cent : la page
découpe ce classement unique sans le retrier, chaque ligne y garde son rang, et
la ligne du retenu reste en tête de chaque page, hors du compte. La page est une
posture de la navigation, jamais écrite (§ 8.4) : elle repart de la première à
chaque ouverture d'un événement et après une génération, se borne à la dernière
quand des propositions partent — à la première quand « Garder les N meilleures »
fait disparaître la page montrée —, et amène la proposition visée à chaque
demande au plan, même répétée.

**La commande prend une graine entière et un compte d'arrêt**, et une longueur
d'historique d'acceptation : celle des réglages de l'événement, 1 000
mouvements pour un événement neuf. Le moteur, quand l'appelant ne la donne pas,
en prend 1 000, la longueur de ses empreintes de référence (§ 14.10) : les deux
valeurs coïncident sans dépendre l'une de l'autre, et changer le défaut d'un
événement neuf ne déplace pas ces empreintes. Chaque proposition conserve sa
graine dérivée, ce compte et cette longueur (§ 8.9). C'est le support de « à
graine et entrée égales, placement identique » ; sans eux, une proposition
retenue cesse d'être régénérable.

**L'identifiant entier d'une proposition vient de sa place dans la suite de
graines dérivées, jamais de son ordre d'achèvement.** Quand plusieurs
propositions se calculent en parallèle, leur ordre d'arrivée varie : un
identifiant attribué à l'achèvement ferait départager deux propositions à
égalité par la vitesse de la machine, et deux exécutions les classeraient dans
deux ordres.

**Une génération peut repartir d'une proposition.** La commande « Repartir
d'elle », dans le menu « Actions » de la ligne d'une proposition comparable du
tableau, ou d'une proposition qu'un changement de participants a seul mise en
dérive, en fait le **départ** de la génération suivante et ouvre la section
de la génération, qui le montre au-dessus de « Générer »
— « Départ : proposition n° 4 » — avec la commande « Repartir de zéro », qui
le retire ; sous un départ, « Générer » se lit « Générer depuis n° 4 ».
Choisir le départ n'écrit rien : c'est un état de la navigation (§ 8.4),
vivant en lecture et sur un plan bloqué, retiré à l'ouverture d'un événement
et quand le départ quitte la liste. La génération lancée sous un départ est
une **génération dérivée**, et ses propositions sont des **propositions
dérivées** (§ 4). C'est une génération : la même graine saisie, dont la
suite donne les graines dérivées, les mêmes nombre, compte d'arrêt et
historique, la même estimation et la même question au-delà d'une
minute (§ 5.10), le même avancement, la même annulation, le même jalon
automatique avant elle (§ 8.3), la même entrée d'historique, refusée en lecture
et sur un plan bloqué. Ses identifiants suivent le compteur. Une dérivée et une
proposition ordinaire peuvent porter la même graine dérivée, le même compte et
le même historique pour deux plans : leur identifiant et le départ les
distinguent.

**Le départ est une proposition comparable, ou une proposition qu'un
changement de participants a seul mise en dérive, et il tient les réservations
courantes.** Le lancement refuse, en nommant la cause, un départ qui a quitté
la liste, un départ fautif (§ 9), un départ que le mobilier ou le nombre de
tours a mis en dérive — une table ajoutée ou supprimée, une capacité changée,
des tours ajoutés ou retirés : `DEPART_NON_COMPARABLE`, « le mobilier a changé
depuis elle » —, et un départ qui ne tient pas une réservation posée depuis sur
une personne qu'il assied — « la proposition n° 4 n'assied pas Prénom Nom à la
table 3 au tour 2, où une réservation la fixe » ; le remède de chacun est
« Repartir de zéro ». Un départ que l'ajout, l'exclusion, la réintégration, la
suppression ou la présence d'une personne a mis en dérive **sert de départ** :
la génération dérivée part de son **plan ajusté**, et ce changement ne demande
pas de repartir de zéro. Le placement retenu n'est pas un départ : il suit les
participants (§ 5.8) et, retouché à la main, n'est le plan d'aucune
proposition et ne se régénère pas.

**Le plan ajusté** est le plan du départ, rendu à la configuration courante par
une règle fixe, sans tirage : celle qui ajuste le placement retenu (§ 5.8). À
chaque tour, une personne que la configuration n'a plus, qu'elle exclut ou
qu'elle dit absente à ce tour quitte sa chaise, qui reste libre — vide à sa
place sous des sièges attribués. Une personne présente que le départ n'assied
pas — ajoutée, réintégrée, dont la présence s'étend, ou en réserve dans le
départ — est **à asseoir** à ce tour ; personne d'autre ne change de table.
- **Aux tours non figés**, elle va, par identifiant croissant, à sa table
  réservée quand une réservation la fixe à ce tour, sinon au premier siège
  resté libre, et la recherche la déplace ensuite comme tout mobile. Une libre
  qu'une arrivée réservée pousse hors d'une table pleine passe à asseoir à son
  tour.
- **Aux tours figés, personne ne bouge.** Elle prend la **meilleure chaise
  libre** de ce tour : chaque table qui garde une chaise libre qu'elle peut
  occuper est essayée, et le meilleur score de la recherche l'emporte, la
  première table à égalité, sans tirage. Une personne réservée n'a de chaise
  qu'à sa table, et, sous des sièges attribués du départ et de l'événement,
  qu'à son siège réservé. Sans chaise libre qu'elle puisse occuper, elle
  **reste en réserve** à ce tour : la dérivée la garde en réserve, et sort du
  domaine des planchers (§ 12.4). Une personne libre trouve toujours une
  chaise, puisque la génération refuse un manque de places (§ 5.6).
  L'application seule décide de ces réserves imposées, sur les tables, les
  sièges et les réservations du moment, et les passe à la recherche avec le
  départ.

L'ajustement se refait à l'identique à chaque régénération : une dérivée se
régénère de ses trois champs, de ses tours figés, du plan de son départ et de
la configuration. Le départ en dérive reste non comparable : il ne se classe
pas, ses raisons restent écrites (§ 9), et ses dérivées, qui décrivent la
configuration courante, entrent au classement. « Repartir de zéro » reste
offert.

**La carte du départ nomme ses écarts avant le lancement.** Sous son titre,
« Depuis n° 4 : », une ligne par personne, son nom puis chaque écart : « —
retirée des tours 3 et 4 » pour une personne absente, exclue ou supprimée que
le départ assied à ces tours ; « — à asseoir aux tours 3 et 4 » aux tours non
figés où elle arrive ; « — assise à la meilleure chaise libre du tour 1,
figé » ; « — en réserve au tour 1, figé : sa table n'a plus de chaise libre »,
ou « … : son siège réservé est pris ». Une exclue ou une supprimée assise à un
tour figé du départ y est retirée, et la ligne ajoute que ses rencontres de ce
tour ne comptent plus. La carte se lit avant tout calcul et n'écrit rien ;
elle reste après la génération, tant que le départ est choisi.

**Une dérivée fige les tours de sa proposition, non ceux du retenu.** Quand le
départ est la proposition d'où le placement retenu a été retenu et qu'un tour
figé du retenu diffère du plan ajusté du départ, le lancement **avertit**, sans
refuser (`DEPART_ECART_AU_RETENU`) : « Les tours figés 1 et 2 viennent de la
proposition n° 4 : les retouches du placement retenu à ces tours n'y sont
pas. » La carte le dit sous les cases dès qu'un tel tour est coché, et l'issue
le répète. La comparaison est stricte — les occupants de chaque table, par
identifiant de table, et la réserve ; chaise par chaise quand les deux
attribuent les sièges — : une personne retirée du tour à la main fait un
écart, une personne partie puis revenue aussi, le retenu la tenant en réserve
là où le départ l'assied ; un retenu seulement ajusté aux participants n'en
fait aucun. Un retenu qui vient d'une autre proposition, ou fautif, ne se
compare pas. Repartir du retenu lui-même n'existe pas.

**La dérivée continue son départ.** Sa recherche part du plan du départ — chaque
personne, à chaque tour, à la table qu'il lui donne — au lieu d'un placement
tiré, et ne garde une autre affectation que strictement meilleure dans l'ordre
de la recherche : une dérivée n'est jamais pire que son départ dans cet ordre,
et la descente s'en éloigne pourtant beaucoup — sur la grande démonstration, à
200 000 mouvements, elle change la plupart des places. Chaque fois que la
recherche tirerait un placement — à son début, et quand elle repart d'un autre
point après une longue immobilité —, une dérivée repart du plan de son départ,
tours figés compris. **Une dérivée n'est pas promise devant son départ au
classement** : la recherche descend un n-uplet que le classement ne compare pas
en entier — la somme des carrés le conduit sans classer —, et une dérivée peut
se ranger derrière lui ; à égalité sur tous les paliers, son identifiant, plus
grand, la range après.

**Une génération dérivée peut figer des tours.** Sous le départ, une case par
tour, toutes décochées à chaque choix d'un départ ; un tour coché est **figé** :
chaque proposition le reprend du départ tel quel — chaque table avec ses
occupants, et, quand le départ et l'événement attribuent tous deux les sièges,
leur ordre et ses chaises vides —, et la recherche ne refait que les autres.
Sous un départ en dérive, le tour figé est celui du plan ajusté (plus haut) :
qui part y laisse sa chaise libre, et qui arrive y prend la meilleure chaise
libre ou y attend en réserve, sans que personne y soit déplacé. Elle ne tire ses
mouvements que dans les tours non figés : un tour figé ne consomme rien du
compte d'arrêt. Les rencontres, les tours servis et les animateurs rencontrés
des tours figés comptent dans le score de toute la soirée, y compris pour une
personne absente aux tours suivants, et la recherche range les autres tours en
fonction d'eux — ce qui sépare figer de greffer après coup les tours du départ
sur une proposition nouvelle, qui refait les rencontres que ces tours ont déjà
faites. Figer tous les tours est refusé, le refus posé contre les cases : il ne
reste rien à refaire.

**Sous des sièges attribués, un tour figé garde ses sièges.** L'application
range d'ordinaire chaque table d'une proposition selon les réservations à un
siège du moment (§ 8.9) ; les listes d'un tour figé, elles, sont recopiées du
départ, jamais rangées de nouveau. Le lancement refuse donc, avant tout
calcul, un départ dont un tour figé n'assied pas une personne au siège
qu'une réservation courante lui fixe — « la proposition n° 4 n'assied pas
Prénom Nom au siège 2 de la table 3 au tour 1 » —, avec pour remède de
décocher ce tour, ou « Repartir de zéro » ; une arrivée n'y est pas comptée,
la règle du plan ajusté la place à son siège ou la laisse en réserve. Avant
d'enregistrer, l'application recopie chaque tour figé du plan ajusté — une
arrivée à siège réservé à son siège, une autre à la table que la recherche lui
donne, une réserve imposée dans la réserve —, vérifie que chacun, arrivées
retirées, égale le plan ajusté arrivées retirées, et refuse la génération
sinon, comme une violation d'invariant (§ 14.12) : aucun geste légitime ne
la déclenche.

**Un tour figé n'est pas une réservation** (§ 4, § 5.2). Statuts, diagnostic,
plafond a priori, planchers et populations mesurées sont ceux de la
configuration, et la recherche compose son score sur ses plafonds, ceux du
classement (§ 5.10). Les planchers du diagnostic bornent donc toute
proposition, dérivée ou non ; sous des tours figés, le meilleur atteignable
peut rester au-dessus d'eux, et « le meilleur atteint » ne s'écrit que s'il
l'est (§ 12.2).

**L'issue d'une génération dérivée** nomme ses propositions, la place de la
meilleure au classement et celle du départ — « 5 propositions dérivées de
n° 4 (n° 21 à 25) ; la meilleure, n° 23, est 2ᵉ du classement ; n° 4 est
5ᵉ » — et offre « Comparer n° 23 à n° 4 », qui montre n° 23 au plan et ouvre
la vue de comparaison sur la paire, sans rien écrire (§ 12.10.6). Quand toutes
ses propositions égalent leur départ, elles sont écartées comme identiques et
l'issue le dit : « la proposition n° 4 n'avait rien à reprendre sous ces
réglages ». Son entrée d'historique porte un libellé fixé à l'écriture (§ 8.2) :
« Généré 5 propositions dérivées de n° 4 (n° 21 à 25), tours 1 et 2 figés ».
Quand le départ est en dérive, l'issue dit qu'il ne se classe pas — « 5
propositions dérivées de n° 4 (n° 21 à 25) ; la meilleure, n° 23, est 2ᵉ du
classement ; n° 4, en dérive, n'est pas classée » — et n'offre aucune
comparaison. Une dérivée égale au plan ajusté de son départ n'est pas
identique à ce départ, qui est un autre placement : elle est gardée.
Le départ reste choisi après la génération, pour une autre graine ; « Générer
depuis n° 4 » le rappelle, et une génération ordinaire demande d'abord
« Repartir de zéro ».

**L'ordre des priorités est un réglage de l'événement, et l'interface l'écrit.**
Il range les critères en **paliers**, du premier au dernier. Deux propositions
se comparent palier par palier : un palier ne départage que des propositions
égales sur tous ceux qui le précèdent. Un palier porte un critère, ou plusieurs,
chacun avec un **poids** entier de 1 à 100 ; la clé du palier est la somme, sur
ses critères, du poids multiplié par la valeur du critère. Chaque valeur est un
entier ≥ 0, et la plus faible est la meilleure.

| critère | valeur qui classe | valeur que la recherche descend | famille |
|---|---|---|---|
| écart au plafond a priori | le plus grand écart (§ 5.5) | le plus grand écart, puis la somme des carrés des écarts | rencontres |
| excédent de collisions | l'excédent (§ 5.4) | la même | contrainte |
| collisions cumulées | les collisions cumulées | la même | contrainte |
| tours hors objectif | selon le mode (§ 5.3) : les tours hors objectif ; ou les personnes jamais servies, puis les tours hors objectif ; ou le plus de tours hors objectif d'une personne, puis les tours hors objectif | les mêmes ; sous « l'équité d'abord », entre les deux, le nombre de personnes qui ont ce plus grand nombre de tours hors objectif, zéro quand il est nul | contrainte |
| rencontres répétées et retours | les rencontres répétées choisies sous « nouveaux voisins » ; sinon, sous « nouvelle table » seule, les retours choisis | Σ_paires max(0, M − 1) sous « nouveaux voisins », plus les retours choisis sous « nouvelle table » | contrainte |
| animateurs non rencontrés | Σ (B(p) − m(p)) (§ 5.4) | la même | raffinement |
| redondance d'organisation | Σ r(p) | la même | raffinement |
| conflits d'organisation | les conflits d'organisation (§ 5.4) | la même | contrainte |
| inclusions non satisfaites | les inclusions non satisfaites (§ 5.4) | la même | contrainte |

**La liste est complète** : chaque critère y figure une fois, coché ou non ;
seule une liste lue d'un fichier écrit avant les inclusions peut les taire
(§ 8.9). Quatre critères y sont **seuls à leur palier** : ils se déplacent, ils
ne partagent pas leur palier. Le conflit d'organisation, parce qu'il dit ce que
la soirée promet de ne jamais faire : une somme pondérée l'échangerait contre
quelques collisions ou quelques retours. Les inclusions non satisfaites, pour
la même raison : une somme pondérée échangerait une rencontre promise contre
quelques collisions. L'écart au plafond a priori, parce que sa valeur nulle est
le certificat du § 5.5 et qu'une somme pondérée le noierait dans d'autres
unités.
Les rencontres répétées et les retours, parce que leurs deux valeurs ne
s'échangent pas au même taux contre un autre critère : une paire réunie trois
fois coûte deux à la recherche et un au classement, un retour coûte un à la
recherche et rien au classement sous « nouveaux voisins ». Seul à son palier, le
critère ne compare que l'ordre de ses deux valeurs, qui baissent ensemble ;
pondéré avec un autre, il ferait retenir par la recherche un plan que le
classement range sous un plan qu'elle a rejeté. Sous les modes « chacun au moins
une fois » et « l'équité d'abord », les tours hors objectif sont seuls à leur
palier eux aussi : ils comparent deux valeurs l'une après l'autre, qu'une somme
pondérée confondrait — une personne jamais servie s'y échangerait contre
quelques tours hors objectif. Sous le mode par défaut, ils se pondèrent comme
les autres. Le mode qui compare deux valeurs se refuse tant que le critère
partage son palier, et l'éditeur n'offre pas de l'y joindre sous ces modes
(§ 5.9) : changer de mode ne déplace aucun critère.

**Les commandes donnent le poids 1 à un critère seul à son palier, poids que
l'écran ne montre pas.** Seul, un poids ne change aucun ordre : la liste qu'une
commande écrit le ramène à 1, et deux listes de même effet qu'elle range
s'écrivent pareil. La lecture d'un fichier garde le poids écrit d'un critère
seul à son palier, hors des critères que le § 8.9 tient au poids 1 : une liste
de même effet que l'ordre par défaut s'y lit, et se réécrit présente (§ 8.9).
Un critère qui rejoint un palier y entre au poids 1. Changer de mode réécrit la
liste ainsi rangée, sans qu'aucun critère change de palier.

**Ordre par défaut** : conflits d'organisation, puis inclusions non
satisfaites, puis excédent de collisions, puis rencontres répétées et retours,
puis collisions cumulées, puis écart au plafond a priori, puis tours hors
objectif, puis animateurs non rencontrés, puis redondance d'organisation, chacun
seul à son palier, sous le mode « le plus de places servies ». Il n'est pas
l'ordre du tableau ci-dessus, qui reste celui des critères dans un palier.
L'**ordre fixe de référence** est la liste excédent, rencontres répétées,
cumulées, écart, redondance, chacun seul à son palier : l'ordre par défaut sans
les quatre critères des conflits, des inclusions, des objectifs et des
animateurs. Une liste écrite garde son ordre : seul l'événement qui ne règle
rien suit l'ordre par défaut. Sous l'ordre par défaut, sans liste de conflits,
sans inclusion active, sans objectif de table et sans la case des animateurs,
quel que soit le mode :
sous toute combinaison des cases du § 5.3, les plans à graine égale sont ceux
de l'ordre fixe de référence ; sous les quatre cases cochées, le classement et
sa phrase le sont aussi. Une case décochée retire son critère du
classement et de la phrase (§ 5.3) ; « nouvelle table » cochée seule y fait
classer les retours choisis. Un événement qui ne règle rien n'écrit rien
(§ 8.9) ; « Rétablir l'ordre par défaut » retire le réglage. Dans l'éditeur de
l'ordre, le nom de chaque critère est un terme expliqué : son survol, ou son
focus au clavier, ouvre une infobulle qui dit ce qu'il compte et nomme la
colonne des propositions qui le montre (§ 14.5).

**L'ordre par défaut met d'abord ce que la soirée promet à chacun.** Ne jamais
asseoir ensemble deux organisations en conflit vient avant tout ; les inclusions
suivent. Ce sont les deux critères que l'opérateur nomme personne par personne,
et il les nomme pour qu'ils tiennent : un conflit dit ce que la soirée ne fera
jamais, une inclusion ce qu'elle fera au moins une fois, et le « jamais » passe
devant. Une inclusion qu'un conflit contredit est hors d'atteinte, quel que soit
l'ordre (§ 4). Le conflit d'organisation ouvre l'ordre par défaut, les
inclusions non satisfaites viennent ensuite ; chacun se déplace comme les
autres, et l'opérateur qui le range plus bas l'accepte moins tenu. Ne pas passer
la soirée avec ses collègues, ne pas revoir à une table une personne déjà
rencontrée, ne pas revenir à une table déjà visitée : ce sont les promesses que
l'opérateur fait à la salle, et un plan qui en manque une se voit. L'excédent de
collisions vient en tête, puis les rencontres répétées et retours, puis les
collisions cumulées, puis l'écart au plafond a priori. Mettre la diversité
au-dessus de l'écart ferait encore **refuser un contact neuf** parce que
l'organisation du voisin est déjà croisée : la redondance reste en dernier.

**Ce placement de l'écart a un prix, en rencontres.** Rangées devant lui, les
répétitions et les collisions passent avant le nombre de personnes distinctes
que chacun rencontre : la recherche accepte qu'une personne en rencontre moins
pour éviter une paire revue ou une collision, et le classement met en tête le
plan sans répétition même quand un autre fait rencontrer davantage au plus mal
servi. Sous l'écart en tête, le plan qui annule l'écart passerait devant, et ses
répétitions avec lui. La recherche paie aussi : l'écart ne guide plus la
descente vers les plans parfaits, et sur une petite salle où tous peuvent
atteindre leur plafond sans répétition ni collision, une descente s'arrête plus
souvent sur un plan sans excédent mais aux collisions cumulées au-dessus du
plancher, parfois avec une paire revue, qu'elle ne défait plus sans faire perdre
une rencontre à quelqu'un. Plusieurs propositions et un compte plus long en
atténuent l'effet sans l'annuler. Monter l'écart seul en tête ne change pas les
contraintes de la recherche : une fois l'écart annulé, la bascule compare les
paliers dans le même ordre que sous l'ordre par défaut, les rencontres répétées
devant les collisions cumulées. L'ordre du tableau ci-dessus — écart, excédent,
cumulées, tours hors objectif, rencontres répétées et retours, animateurs,
redondance, conflits, inclusions — range les collisions devant les rencontres
répétées, et c'est sous lui que chaque proposition de la petite démonstration
et de sa variante atteint son optimum (§ 15.3) ; l'opérateur qui préfère les
rencontres le règle, et l'éditeur le permet.

**L'excédent de collisions précède les rencontres répétées et les collisions
cumulées.** Le § 5.4 le démontre en trois plans. Classer d'abord sur les
collisions cumulées — comme classer d'abord sur les paires distinctes — met en
tête le plan qui fait passer toute la soirée aux deux mêmes collègues, parce
qu'il en porte le moins. Classer d'abord sur les rencontres répétées, qui
comptent des paires et non des retrouvailles, met ce plan devant celui qui
ramène deux collègues deux fois chacun. L'excédent d'abord, le reste ensuite :
un plan qui répartit six collisions sur six paires passe devant un plan qui
en concentre quatre sur deux paires, qui passe devant un plan qui les
concentre sur une seule. L'opérateur qui range les rencontres répétées devant
l'excédent accepte l'inverse pour ces deux derniers ; l'éditeur le permet.

**La recherche et le classement compilent la même liste.** La recherche descend
un n-uplet, une composante par palier — deux pour l'écart au plafond a priori,
le plus grand écart puis la somme des carrés ; deux sous « chacun au moins une
fois » et trois sous « l'équité d'abord » pour les tours hors objectif, seuls à
leur palier —, chaque composante étant la somme pondérée des valeurs de
recherche de son palier. Le classement compare, palier par palier, les sommes
pondérées des valeurs qui classent — un critère seul à son palier qui en classe
deux les compare l'une après l'autre —, puis l'identifiant croissant. Ce que la
recherche a de plus sert à la conduire, jamais à classer : la somme des carrés
façonne la descente vers le plafond, le nombre de personnes au plus de tours
hors objectif façonne celle de « l'équité d'abord », et le critère des
rencontres répétées descend l'excès de chaque paire et les retours là où il
classe sur les paires revues. Le poids que la recherche applique est celui que
l'écran montre : aucun poids interne, que l'opérateur ne verrait pas, ne fait
l'ordre.

**Une fois l'écart au plafond a priori annulé, la recherche passe les
contraintes devant.** Un palier est de la famille « raffinement » quand tous ses
critères le sont ; un seul critère d'une autre famille en fait un palier
« contrainte », sauf le palier de l'écart, seul de la famille « rencontres ». Tant
que sa meilleure affectation porte un plus grand écart nul, la recherche compare
les paliers dans l'ordre où le palier de l'écart descend juste avant le premier
palier « raffinement » qui le suit — à la fin s'il n'y en a pas —, les autres
gardant leur ordre : elle peut perdre une rencontre le temps de défaire une
collision, puis la reprendre. L'écart en tête, une meilleure affectation garde
un écart nul, et la bascule est acquise ; rangé après d'autres paliers, il peut
redevenir non nul sur une meilleure affectation, et la recherche revient alors
à l'ordre du score. Sous l'ordre par défaut, cela compare conflits, inclusions,
excédent, rencontres répétées et retours, cumulées, tours hors objectif,
l'écart, animateurs, redondance : sans objectif, l'ordre des paliers ne change
pas, et les inclusions restent devant l'écart dans les deux ordres. Le
classement, lui, suit toujours l'ordre réglé.

**Tant que l'écart n'est pas annulé, la somme des carrés précède tous les
paliers qui suivent l'écart.** Là où le plus grand écart ne peut pas descendre à
zéro — le diagnostic en donne le plancher (§ 5.6) —, la bascule n'a jamais
lieu : un palier rangé après l'écart ne départage que des affectations de même
somme des carrés, et pèse dans la recherche à peine plus qu'un départage. Un
critère rangé après l'écart ne coûte donc aucune rencontre à personne ; pour
qu'il pèse sur une soirée tendue, l'opérateur le range devant l'écart, et
accepte de perdre des rencontres pour lui. L'ordre par défaut le fait pour les
conflits d'organisation, les inclusions non satisfaites, l'excédent, les
rencontres répétées et retours et les collisions cumulées.

**Un critère décoché ou sans objet** (§ 5.3) sort de la recherche comme du
classement ; un palier dont aucun critère ne compte disparaît, et les autres
gardent leur ordre.

**Le classement se départage sans arbitraire.** Les clés sont des entiers
exacts. Une valeur qui classe est au plus le nombre de couples (paire, tour),
C(N, 2)·R ; la clé d'un palier, au plus 100 fois la somme de cinq telles
valeurs ; la somme des carrés, seule à sa composante, au plus N·(N − 1)² ; les
valeurs des modes des objectifs, au plus N·R. Pour N ≤ 100 000 et R ≤ 100,
aucune n'approche 2⁵³, et la mémoire que la recherche alloue aux paires (N²)
borne N bien en deçà. Deux propositions égales sur tous les paliers se
départagent par l'identifiant croissant. L'ordre des paliers est celui de la
liste écrite. L'ordre des critères dans un palier ne change aucune clé ; il est
pourtant fixé, celui du tableau ci-dessus, pour que deux listes de même effet
s'écrivent pareil : le moteur refuse un palier rangé autrement ; les commandes
le rangent avant de l'écrire, et la lecture d'un fichier le range (§ 8.9).

**La phrase de l'ordre dit les paliers.** Elle nomme les paliers appliqués, dans
l'ordre, séparés par « puis » ; un palier de plusieurs critères se lit
« ensemble, » suivi de chaque critère et de son poids. Elle nomme la valeur que
le palier applique : « rencontres répétées », ou « retours » sous « nouvelle
table » seule ; un critère qui en classe deux les nomme l'une après l'autre,
séparées par « puis » comme deux paliers — « personnes jamais servies, puis
tours hors objectif ». L'éditeur, lui, écrit le nom complet du critère. Sous
l'ordre par défaut, sans liste de conflits, sans inclusion active, sans
objectif et sans la case des animateurs, les quatre cases cochées, elle est mot
pour mot celle de l'ordre fixe de référence.

**Les paires distinctes ne sont pas une clé de tri** ; elles restent une colonne
affichée, et se retrouvent de toute façon par soustraction. Trois clés pour deux
quantités indépendantes feraient un départage qui ne départage rien.

**Le plafond a priori par personne se calcule à chaque évaluation** d'une charge
nouvelle — une même charge figée relit sa table — : sa maximisation est mesurée
et ne coûte presque rien (§ 17, point 4), et l'écart au plafond a priori
s'applique toujours. Le chemin où il manque reste celui du moteur, que
l'application n'emprunte pas : ce critère y est **sauté**, avec son palier, où
il est seul, et la page nomme le palier qu'elle applique à sa place — un
classement qui se tait sur le critère qu'il n'a pas pu appliquer se lit comme un
classement complet.

Un départage ne se déclenchant presque jamais, les chiffres de diversité sont
affichés **en colonne pour chaque proposition**, et non pour la seule gagnante.
Le tableau réunit ses colonnes de mesure voisines sous cinq intitulés de groupe
— les personnes rencontrées, les collisions d'organisation, les rencontres
répétées et les retours, la diversité d'organisation, le manque et le plafond a
priori —, et sous un sixième, « les objectifs des tables et les animateurs »,
quand l'un de ces deux critères est coché et a un objet : ses colonnes sont,
pour le premier, les tours hors objectif et le minimum des tours selon
l'objectif, précédés des personnes jamais servies sous « chacun au moins une
fois » et du plus de tours hors objectif d'une personne sous « l'équité
d'abord » ; pour le second, le minimum des animateurs rencontrés et les
animateurs non rencontrés ; chacune présente quand son critère compte (§ 5.3).
Le groupe des collisions d'organisation s'ouvre, quand le conflit d'organisation
a un objet, sur la colonne des conflits d'organisation, en occurrences (paire,
tour) ; sans paire de présents en conflit, elle n'y est pas. Quand une inclusion
est active (§ 4), la colonne des inclusions non satisfaites la suit, en
rencontres demandées (§ 5.4) ; sans objet, elle n'y est pas. Une ligne qui en
laisse — la recherche les vise à zéro sans les interdire — le dit aussi sous son
numéro, après ses violations : « 2 conflits restants », « 1 conflit restant »,
puis « 2 inclusions non satisfaites », « 1 inclusion non satisfaite » ; à zéro,
la phrase manque, et la ligne garde sa hauteur sans elle. Chaque inclusion non
satisfaite se nomme à la page de qualité (§ 12.15). Chacun de ces deux minimums
porte sur tous les concernés, sans ses lignes secondaires (§ 5.4), que sa tuile
écrit (§ 12.2). Sous le chiffre de la colonne du plus grand manque, une ligne en
encre secondaire écrit le plafond réalisé de la personne au rang 1 du profil de
manque (§ 12.10.3) ; sous ceux du minimum de A(p), du taux de diversité et des
trois chiffres du manque, une autre écrit leurs deux lignes secondaires (§ 5.4).
Le regroupement ne change l'en-tête ni l'explication d'aucune colonne ; ses
nombres s'alignent à droite en chiffres tabulaires. La ligne du placement retenu
porte la teinte de l'état Retenu, et la proposition retenue, la pastille
« retenue ». Une proposition dérivée porte, sous son numéro, la phrase qui la
rattache à son départ — « Dérivée de n° 4. », ou « Dérivée de n° 4, tours 1 et 2
figés. » —, sans colonne de plus, comme la ligne du retenu porte « Tel que la
proposition n° X. », « Tel que la proposition n° X, ajusté aux participants. »
quand il ne diffère de sa proposition que par l'ajustement aux participants
(§ 5.8), et « Ajusté à la main depuis la proposition n° X. » quand il porte une
retouche que retenir de nouveau cette proposition détruirait. Seul le départ
immédiat est nommé : la ligne du départ dit le sien. Quand le départ n'est plus
dans la liste, la phrase le dit — « Dérivée de n° 4, qui n'est plus dans la
liste. » — et ne désigne aucune autre proposition. Les commandes d'une ligne
vivent dans son **menu « Actions »**, un seul bouton dans la dernière cellule :
fermé, il ne montre que ce bouton. Chaque phrase de la colonne « Imposé par les
réservations » tient sur une ligne, et chaque ligne a la hauteur de ses
chiffres, phrase de filiation et lignes sous un chiffre comprises. Le menu d'une
proposition porte « Voir sur le plan », « Qualité » et « Retenir » ; celui d'une
proposition comparable porte aussi « Repartir d'elle » et « Comparer » (§ 12) ;
celui d'une proposition qu'un changement de participants a seul mise en dérive
porte « Repartir d'elle », sans « Comparer » ; celui d'une autre ligne en
dérive, ou fautive, ni l'une ni l'autre ; le menu du placement retenu porte
« Voir sur le plan », « Qualité » et « Comparer ». Le bouton suit le motif du
bouton de menu de WAI-ARIA : il annonce son menu, s'ouvre au clic, par Entrée,
l'espace et les flèches, et le menu se parcourt aux flèches, à Début et à Fin,
se ferme par Échap, par Tab ou par un clic au dehors. Une commande exécutée
ferme le menu ; le refus d'une commande — « Retenir » en lecture — reste affiché
à côté du bouton, que le bouton désigne. Le bouton a un nom accessible qui porte
le numéro de la ligne, « Actions de la proposition n° 4 », « Actions du
placement retenu », comme « Repartir d'elle » et « Comparer » : « Comparer la
proposition n° 4 », « Repartir de la proposition n° 4 », « Comparer le placement
retenu ».

### 5.8 Le placement à la main

L'opérateur peut asseoir des gens **avant toute génération** : ce sont des
réservations. La génération les honore et place les autres autour. Une commande
transforme un placement partiel en placement complet, le générateur comblant les
vides.

Une fois un placement retenu, le même geste déplace une personne réelle. **Le
geste est identique ; ce qui change est l'état des données**, et l'interface le
dit, pour que l'opérateur sache lequel des deux il fait.

**Le placement se prépare, il ne suit pas la salle.** Retirer une personne du
placement retenu libère sa chaise, et personne d'autre ne change de siège ni de
table : la chaise reste vide jusqu'à ce qu'un geste y assoie quelqu'un, et un
geste n'assied que les personnes qu'il nomme. Quand les sièges sont attribués,
le fichier écrit cette chaise vide à sa place (§ 8.9).

**Le retenu suit qui est là.** Tout changement de participants — la présence
d'une personne, un ajout, une réintégration, une exclusion, une suppression, un
import — ajuste le placement retenu dans la même entrée d'historique, et rien
d'autre, par la règle fixe du plan ajusté (§ 5.7) : à chaque tour où une
personne devient absente, elle quitte sa chaise, qui reste libre, ou la
réserve ; à chaque tour où elle devient présente, elle entre dans la réserve de
ce tour, où un geste ou une proposition dérivée l'assied. Une personne exclue
ou supprimée quitte chaque tour du retenu, joués compris. Personne d'autre ne
change de siège ni de table, et **le retenu ne dérive jamais par ses
participants** : seul le mobilier, les tours ou un fichier écrit ailleurs l'y
mettent (§ 9). « Défaire » reprend le geste et l'ajustement ensemble. Le
libellé de l'entrée le dit — « ; placement retenu ajusté » —, et les
propositions, elles, gardent leur plan : elles entrent en dérive (§ 9), sans
cesser de servir de départ (§ 5.7). Le changement de présence nomme les tours
touchés au lieu de cette mention : « Présence de Prénom Nom : tours 2 et 3, au
lieu des tours 1 et 2 ; retirée du placement retenu au tour 1, mise en réserve
au tour 3 » — chaque partie seulement quand elle a des tours, et rien après la
présence quand le retenu ne bouge pas.

Une personne ajoutée en état retenu entre en réserve du retenu à ses tours de
présence, et le logiciel le dit (`A_PLACER_DANS_LE_RETENU`) : quand sa présence
vaut « tous », il ajoute de dire à quels tours elle est présente si elle arrive
en cours de soirée. **Exclure ou supprimer une personne assise au retenu**
avertit (`RENCONTRES_RETIREES_DU_RETENU`) : « Prénom Nom était assise aux tours
1 et 2 du placement retenu : ses rencontres de ces tours n'y comptent plus.
Pour les garder, défaire, puis la dire présente aux tours 1 et 2 seulement. » —
sans remède en un clic, l'exclusion ayant déjà retiré la personne des tours
joués.

**Retenir une proposition ajuste sa copie** à la présence de chacun, dans la
même entrée : une proposition en dérive par ses participants, retenue, donne un
retenu qui ne dérive pas, et le libellé ajoute « ; ajusté à la présence ». Une
dérive du mobilier reste ce qu'elle est. Retenir une autre proposition ne
demande confirmation que si le retenu porte une retouche à la main que ce geste
détruirait (§ 9) : un retenu seulement ajusté aux participants se remplace sans
fenêtre, sa proposition retenue de nouveau donnant le même ajustement.

**Une seule commande répartit des animateurs sur les tables**, et seulement sur
celles qu'elle crée : « Créer les tables… », pour les personnes que la marque de
l'animation réservée dit à désigner (§ 2.1 étape 6, § 6.1). Une table existante,
l'opérateur désigne lui-même qui l'anime (§ 2.1, étape 6). Une commande qui
attribuerait un animateur par numéro de table le ferait sous une **seule**
entrée d'historique : revenir sur elle, parce que douze attributions sur
trente-trois sont fausses, emporterait aussi les vingt-et-une qui étaient bonnes
— le § 8.3 restitue un état, il ne défait pas un geste. La création des tables
n'y tombe pas : elle suit l'intention que l'opérateur a écrite, personne par
personne, dans la marque, et ne touche que des tables qui n'existaient pas.
« Défaire » la reprend entière, tables et animateurs ensemble, et rien
d'autre ; une attribution à corriger se retire à la rangée « Animateurs » de
sa table, sans toucher aux autres.

Ce qui remplace la répartition : le logiciel **montre le travail qui reste**,
par des listes cliquables qui mènent à la place ou à la personne — la liste des
**titres de place non pourvus** (§ 4.1), la liste des participants portant un
**titre pressenti** (§ 4) qui ne sont encore réservés nulle part, et, sous un
retenu, la liste **« En réserve dans le placement retenu »** : chaque personne
que le retenu laisse en réserve, avec ses tours, une exclue, une supprimée ou
une absente au tour n'y figurant pas ; un clic montre le premier de ces tours et
la choisit. Elle n'existe pas sans retenu, et dit « Aucun. » sous un retenu qui
n'en laisse pas, ou qui se contredit. Puis la liste **« Inclusions non
satisfaites »** du placement que le plan montre — la proposition demandée, sinon
le retenu, comme la page de qualité le mesure (§ 12) — : chaque rencontre
demandée qu'il ne fait pas, dans les phrases de la page de qualité (§ 12.15),
« Iris Ombrelle n'a pas rencontré Théo Pervenche » ; un clic choisit la personne
qui la porte, un second l'oublie. Aucune table ne la signale (§ 7.5). Elle
n'existe que quand ce placement se mesure et qu'une inclusion est active, et dit
« Aucune. » quand il les fait toutes.

### 5.9 Ce que le logiciel refuse, au moment du geste

Ces contrôles s'exécutent **à la pose**, jamais à la génération : un échec de
génération que rien n'explique coûte une relance inutile et la confiance mise
dans l'outil.

- **k_t > c_t** — plus d'ancrés que de sièges : refusé.
- **k_t = c_t** — table entièrement gelée : accepté, **signalé**, parce que
  c'est rarement l'intention.
- **Il manque des places à un tour r** quand Σ c_t est inférieure au nombre de
  personnes présentes au tour r. **Celui-ci n'est pas un refus de geste.** À
  chaque tour, l'écart `Σ (c_t − k_t) − n_r`, n_r les mobiles présents au tour
  r, est **invariant sous toute réservation** : une portée « tous les tours »
  sur une personne présente aux R tours retire la personne des mobiles et son
  siège de la capacité libre en parts égales ; une portée « tour désigné », ou
  une portée « tous les tours » sur une personne absente à un tour, la rend
  partiellement fixée, qui compte parmi les mobiles (§ 5.4) et ne change ni
  `n_r` ni `k_t` ; déplacer une réservation décrémente un `k_t` et en
  incrémente un autre. Aucun geste de réservation ne peut donc le faire
  franchir. C'est une **propriété de la configuration** : le § 5.6 l'évalue au
  diagnostic et **la génération la refuse**, en nommant le nombre de places
  manquantes et, dès qu'une présence est partielle, chaque tour. Les gestes qui
  la font franchir sont ceux qui augmentent un `n_r` ou diminuent `Σ c_t` — un
  import, une saisie, la réintégration d'un exclu (§ 4.4), une présence
  étendue à un tour, une baisse de capacité (§ 6.2), la suppression d'une
  table — et **aucun n'est refusé pour cette raison** : refuser un import
  parce que la salle est devenue trop petite empêcherait d'enregistrer qui
  s'est présenté, et le § 9 pose déjà que la dérive avertit sans bloquer.
  Chacun **avertit** (`PLACES_MANQUANTES`) quand un tour voit son manque
  devenir positif ou grandir, avec le nombre et, sous une présence partielle,
  chaque tour qui en manque.
- Réserver plus de places qu'une table n'en a ; un siège inexistant ; la même
  personne à deux places sur un même tour ; une personne exclue ; une personne
  à un tour où elle est absente (`PERSONNE_ABSENTE_AU_TOUR`).
- Désigner en lot (§ 2.1 étape 6) une personne absente à un tour : refusé
  avant toute désignation (`ANIMATEUR_REFUSE`, cause `ABSENT_AU_TOUR`), le
  refus nommant la personne et son premier tour d'absence, le remède la disant
  présente à tous les tours ; rien du lot n'est posé. Le refus d'une seule
  personne du lot, pour toute autre cause, refuse de même le lot entier.
- Déposer, au plan, une personne absente au tour montré, la déplacer ou
  l'échanger dans le retenu à un tour d'absence : refusé sur la place
  (`PERSONNE_ABSENTE_AU_TOUR`), le refus proposant de la dire présente à ce
  tour — « La dire présente aux tours 1, 3 et 4 », sa présence plus le tour
  refusé —, un remède qui écrit et nomme son effet. Retirer du tour une
  personne absente à ce tour est sans effet.
- Une présence sans aucun tour : refusée contre les cases
  (`PRESENCE_VIDE`), sans remède — « Prénom Nom ne serait présente à aucun
  tour : pour l'écarter de toute la soirée, l'exclure. » L'exclusion retire la
  personne des tours joués : aucun geste destructeur ne s'offre en un clic.
- Étendre une présence à un tour où une réservation de la personne, suspendue
  jusque-là, ferait déborder sa table (`SURRESERVATION`), ou prendrait un siège
  réservé à une autre (`PLACE_RESERVEE`) : refusé, comme la réintégration
  (§ 4.4), avec les mêmes remèdes. La réintégration ne contrôle que les tours de
  présence de la personne. Un import qui étend ainsi une présence est refusé
  entier.
- Un import dont la colonne des conflits nomme une organisation qu'aucun
  participant ne porterait, ou la propre organisation de la personne : refusé
  entier, la cause nommant l'organisation et sa ligne, le remède invitant à
  corriger le fichier puis à l'importer de nouveau (§ 10.1).
- Une liste d'inclusions qui nomme la propre organisation de la personne
  (`INCLUSION_PROPRE_ORGANISATION`) ou la personne elle-même
  (`INCLUSION_DE_SOI`), une organisation qu'aucun participant ne porte
  (`ORGANISATION_INCONNUE`) ou un identifiant qu'aucun participant n'a
  (`PARTICIPANT_INCONNU`) : refusée entière à la première valeur fautive, dans
  l'ordre reçu, sans remède, l'organisation ou la personne se choisissant dans
  le champ même, parmi les autres. Une inclusion que contredit un conflit de la
  personne n'est pas refusée (§ 4) : elle est acceptée et signalée, plus bas.
- Déposer quelqu'un sur une place réservée à un autre, ou l'échanger avec elle.
  **Déplacer la réservation** est une commande séparée et explicite.
- Une saisie d'étiquettes vide — des blancs ou des séparateurs seuls —, une
  étiquette de plus de 40 caractères ou qui porte un caractère de contrôle ou
  invisible, une vingt-et-unième étiquette sur une personne ou dans un
  objectif : refusé contre le champ, le texte disant la forme attendue. Les
  séparateurs ne se refusent pas : ils découpent la saisie en plusieurs
  étiquettes (§ 4.5).
- Un objectif pour un tour qui n'existe pas : refusé. Un objectif sans étiquette
  n'existe pas : vider sa liste est refusé, et le refus propose la commande
  « Retirer l'objectif » quand le couple (table, tour) en porte un.
- Un poids hors de 1 à 100, ou non entier : refusé contre le champ. Joindre un
  critère au palier de l'écart au plafond a priori ou à celui des rencontres
  répétées et retours, ou joindre ces deux-là à un autre : l'éditeur ne l'offre
  pas (§ 5.7) ; sous « chacun au moins une fois » et « l'équité d'abord », pas
  davantage pour les tours hors objectif.
- Choisir « chacun au moins une fois » ou « l'équité d'abord » quand les tours
  hors objectif partagent un palier : refusé contre le choix, le texte nommant
  le palier et disant de séparer le critère d'abord ; le refus ne propose pas de
  remède, puisque séparer d'office déplacerait des critères que le choix ne
  nomme pas. Le mode reste celui d'avant ; aucun critère ne se déplace par un
  choix de mode.
- « Retirer l'objectif » et « Rétablir l'ordre par défaut » n'ouvrent pas de
  fenêtre à confirmer : chacun détruit un seul objet, nommé contre sa commande,
  qu'un retour à l'instant précédent rend.
- **Accepté et signalé**, comme une table entièrement gelée : un objectif auquel
  aucune personne présente ne correspond — la table ne servira personne à ce
  titre —, signalé contre l'objectif ; une étiquette d'objectif qu'aucune
  personne ne porte, exclues comprises, signalée avec l'orthographe voisine
  quand il en existe une ; un critère coché sans objet (§ 5.3), marqué « sans
  objet » dans l'ordre des priorités ; une réservation, ou un placement retouché
  à la main dans le retenu, qui réunit à une table deux personnes en conflit
  d'organisation (§ 4) : la commande écrit, la table porte la trame du conflit
  (§ 7.5), et son panneau nomme chaque paire sous « Conflits d'organisation à ce
  tour » ; une inclusion qu'un conflit d'organisation contredit (§ 4), quel que
  soit le geste qui la fait naître — l'inclusion posée, le conflit posé, une
  personne qui change d'organisation ou revient d'une exclusion — : la commande
  écrit, et un avertissement (`INCLUSION_CONTREDITE`) nomme chaque inclusion
  nouvellement contredite, sa personne et sa cible, et dit qu'elle reste dans sa
  liste, hors d'atteinte, tant que le conflit tient ; une contradiction qui
  était déjà là ne se redit pas, même quand l'organisation qu'elle vise est
  renommée et que les listes suivent le renommage (§ 4).

Un refus **nomme sa cause et propose le geste qui le lève**, et se manifeste
**sur la place concernée**, pas dans une boîte de dialogue. Seul un geste qui
détruit de la saisie ouvre une fenêtre à confirmer — et « Garder les N
meilleures », qui efface en bloc (§ 5.7) — : une suite de modales apprend à
cliquer sans lire, et le premier refus qui comptait passe inaperçu.

**Quand aucun geste ne lève le refus, il nomme sa cause seule.** Ainsi d'une
valeur qui se corrige dans le champ même, dont le texte dit la valeur attendue —
moins de deux sièges, une saisie non entière, moins d'un tour, un libellé ou un
nom vides, une étiquette mal formée, un poids hors de son domaine ; d'une cible
absente ou disparue entre-temps — une personne, une proposition, une
réservation, un titre, des réservations à convertir —, qu'aucune commande ne
fait revenir et sur laquelle l'interface n'offre pas le geste ; d'un compteur au
bout de sa règle, d'un plan qui n'est plus bloqué, d'un geste sans effet, et
d'un refus du CSV relayé par l'import, qui se lève dans le fichier ou dans
l'association de ses colonnes — `NOM_NON_ASSOCIE` quand aucune colonne n'est
associée au nom. Un remède posé pour la forme enverrait l'opérateur vers un
geste qui ne change rien.

### 5.10 Le coût d'évaluation

A(p) et r(p) demandent de parcourir les personnes rencontrées par chacun.
Recalculés intégralement à chaque candidat d'une recherche locale, ils dominent
le temps de génération. Le moteur les met à jour **de façon incrémentale**, sur
les seules tables modifiées. C'est une exigence de faisabilité : sans elle,
l'objectif existe dans l'interface et ne converge pas dans le temps que
l'opérateur accorde.

**Les grandeurs nouvelles se tiennent à jour de la même façon.** Un échange qui
fait passer une personne d'une table à une autre au tour r change ses tours
servis d'au plus un, lu dans une table de correspondance calculée une fois par
configuration, indexée par **objectif distinct** — deux objectifs de même règle
et de mêmes étiquettes n'en font qu'un — : personnes × objectifs, jamais
personnes × tables × tours, qui pèserait des dizaines de mégaoctets à cent
tours. Les valeurs des trois modes suivent en temps constant : les tours hors
objectif changent de un ; les personnes jamais servies, quand s(p) passe de zéro
à un ou de un à zéro ; le plus de tours hors objectif d'une personne et le
nombre de personnes qui l'ont, par un histogramme des P(p) − s(p), où le plus
grand ne bouge que de un, comme le plus grand écart au plafond a priori. Les
animateurs rencontrés ne changent que pour la personne déplacée : qui anime au
tour r y est fixé et ne se déplace pas à ce tour. Le déplacé quitte les
animateurs de sa table de départ à ce tour et rejoint ceux de sa table
d'arrivée ; un compteur par couple (personne, animateur), N × A octets pour A
animateurs tant que R ne dépasse pas 255, dit quand une rencontre apparaît ou
disparaît. La recherche ne tient ces compteurs que quand le critère des
animateurs compte, coché et avec un objet : sinon aucune composante ne les lit,
et elle ne paie rien pour eux, même quand des personnes animent. Les inclusions
non satisfaites se lisent sur deux compteurs que la recherche tient déjà : une
inclusion de personne est satisfaite quand la paire est réunie, une inclusion
d'organisation quand la personne compte un membre de cette organisation parmi
ses rencontres, comme la mesure les juge (§ 13.2). Après un échange, seules se
relisent les rencontres demandées des deux personnes déplacées — celles dont
elles sont une extrémité, celles qu'elles portent, et celles qui incluent leur
organisation —, chacune en temps constant ; la boucle des paires n'en lit rien
de plus, et sans inclusion active la recherche ne relit rien. Le coût d'un
mouvement reste de l'ordre des sièges des deux tables, et un n-uplet de douze
composantes au plus se compose et se compare dans le même ordre de grandeur que
celui de six : mesuré sur la grande démonstration, un mouvement coûte quelques
pour cent de plus que sous l'ordre fixe de référence sans objectif, et moins
d'un dixième de plus avec des étiquettes, des objectifs, la case des animateurs
et un ordre réglé ; deux cent dix inclusions actives n'en changent pas l'ordre
de grandeur.

**Tant qu'une rencontre demandée manque, un mouvement sur deux la rapproche.**
Quand le critère des inclusions compte et qu'une rencontre demandée (§ 5.4)
n'est pas faite, chaque mouvement tire d'abord entre deux genres, à parts
égales. Le mouvement ordinaire tire comme sans inclusion. Le mouvement dirigé
tire une rencontre demandée qui manque, puis, pour une organisation que
plusieurs membres satisfont, l'un d'eux ; puis un tour où les deux sont présents
et celle des deux qui y est libre, qui rejoint la table de l'autre à l'un de ses
sièges mobiles, par l'échange ordinaire avec son occupant, personne ou place
vide. Sans tour qui le permette, il est évalué et rejeté. Il ne touche ni un
siège fixé ni un tour figé, et s'accepte, se refuse et se défait comme un
autre : il ne choisit que les sièges à échanger, et la comparaison des scores
reste seule juge. Les rencontres qui manquent forment un ensemble que chaque
relecture tient en temps constant. Sans lui, la recherche ordinaire ne trouve
une rencontre demandée qu'au hasard d'un échange qui assied les deux personnes
ensemble, et en laisse, sur une soirée dense en listes, au compte par défaut.
Avec lui, la fixture de mesure du § 14.10 les fait toutes en quelques dizaines
de milliers de mouvements, une soirée dense en laisse près de dix fois moins au
compte par défaut, et sur une soirée moins dense les paliers qui suivent ne s'en
écartent pas au-delà du bruit des graines. La part d'un sur deux est une
constante du moteur, qu'aucun réglage n'expose. Un mouvement dirigé coûte de
l'ordre d'un dixième de plus qu'un mouvement ordinaire et ne se tire plus dès
que toutes les rencontres demandées sont faites ; le prix en temps se paie
pourtant surtout après ce point : à compte égal, une génération qui porte des
inclusions dure de l'ordre d'un dixième de plus, car une recherche plus avancée
rejette davantage de mouvements, et un mouvement rejeté se défait.

**La présence ne coûte rien à la recherche.** Une personne absente à un tour
n'occupe aucun siège de ce tour, aucun mouvement ne la touche, et les grandeurs
incrémentales ne la lisent qu'aux tours où elle est assise : la boucle des
mouvements est celle d'une soirée sans absence, et la recherche ne change pas
sous l'absence. Sans aucune absence, chaque chemin rapide de la co-présence
s'applique, et une graine donne les mêmes propositions qu'avant la présence.
Le plafond a priori, calculé une fois par configuration, ne croît pas avec le
nombre de motifs de présence : son programme dynamique se calcule une fois par
classe de personnes — statut, ancrage, tables fixées, nombre de tours libres
présents —, au plus grand nombre de mobiles co-présents de la classe, et
chacune le lit avec son |C(p)| et son n_p^C (§ 5.5).

**L'ordre des priorités et le mode ne touchent pas au hasard.** Ils changent la
façon dont deux scores se comparent, jamais les tirages : aucun ne s'ajoute ni
ne se déplace (§ 15.5, point 3). La liste se lit dans l'ordre où le fichier
l'écrit, jamais par le parcours des clés d'un objet, et les sommes d'un palier
sont des entiers exacts. Le mouvement dirigé des inclusions ne tire rien tant
qu'aucune rencontre demandée ne manque ; sans inclusion active, la suite des
tirages est celle d'avant.

**Une génération dérivée ne touche pas au hasard d'une génération
ordinaire.** Son départ remplace chaque tirage d'un placement, au début de la
recherche et à chaque relance, et ses mouvements se tirent dans les seuls
tours non figés : une génération ordinaire tire les mêmes nombres dans le
même ordre qu'avant les dérivées, ce que les empreintes de référence gardent
(§ 14.10). Une dérivée coûte de l'ordre d'un dixième de plus qu'une
proposition ordinaire au même compte, sur la grande démonstration ;
l'estimation ne distingue pas les deux.

**La recherche s'arrête sur un compte, jamais sur une durée** — un nombre
d'itérations, ou un nombre de mouvements consécutifs sans amélioration — fixé
dans les réglages de génération et enregistré avec la proposition, à côté de sa
graine (§ 8.9). Le temps que l'opérateur accorde s'achète par la mise à jour
incrémentale, pas par un chronomètre. Une recherche bornée par une durée rendrait
le placement dépendant de la vitesse de la machine : à graine et entrée égales,
deux exécutions donneraient deux plans, et toute la reproductibilité des captures
d'écran (§ 19.4) tomberait avec. L'interdit de `performance.now` dans le moteur
(§ 14.7) n'est donc pas une règle d'hygiène : c'est elle qui rend vraie la phrase
« à graine égale, placement identique ».

**Le compte est un réglage, et son plafond d'usage est de trente minutes.** Il
est exposé dans les réglages de génération, avec son unité ; le logiciel affiche
à côté la **durée réellement observée du dernier calcul de la séance**, et les
cœurs qu'il a employés, qui est la seule façon d'étalonner un compte. Elle vaut
pour la séance et ne se garde pas au-delà — rien ne survit à la séance hors du
dossier de travail (§ 8.6) : au premier calcul d'un lancement, aucune mesure
n'existe, et l'estimation se dit inconnue. Le réglage livré par défaut est celui
qui, sur la machine de référence, reste bien en deçà de ce plafond : un
événement neuf reçoit **vingt propositions de 2 000 000 mouvements, sous un
historique d'acceptation de 1 000**. Seul l'événement neuf les reçoit : un
événement dont le fichier porte ses réglages de génération les garde, et un
changement de ces défauts ne réécrit aucun fichier ; les démonstrations livrées
portent les leurs, cinq propositions de 200 000 mouvements sous un historique
de 1 000.

**Une génération longue s'annonce avant de partir.** À partir de la dernière
durée mesurée, le logiciel énonce l'ordre de grandeur attendu — « environ vingt
minutes à ce réglage » — et, **au-delà d'une minute estimée**, demande, par une
question posée en place, sans fenêtre. L'estimation compte les mouvements qui se
suivent sur un même cœur — le compte d'arrêt pour chacune des ⌈propositions /
cœurs⌉ vagues de propositions calculées ensemble —, chaque vague ralentie de
**ρ(W)**, le ralentissement d'un cœur quand W cœurs calculent ensemble : un cœur
va moins vite quand ses voisins travaillent aussi. ρ croît en ligne droite de 1,
sur un cœur seul, au **ralentissement à pleine charge** quand les L processeurs
logiques travaillent — `ρ(W) = 1 + (ρ_max − 1)(W − 1)/(L − 1)`, et 1 sur un
poste d'un seul processeur logique —, une constante du banc (§ 19.10) que
l'estimation lit au registre à chaque appel. Les mouvements de la dernière
mesure se ramènent de même aux cœurs qu'elle a employés. Sans mesure, il demande
dès que ces mouvements, ralentissement compris, dépassent **dix millions**, un
compte fixe qui ne suit pas le réglage par défaut : les vingt propositions d'un
événement neuf le dépassent sur les postes de moins de dix processeurs logiques,
et la première génération d'une séance y demande confirmation. Une recherche
d'une demi-heure lancée par mégarde est une demi-heure de soirée perdue, et
aucun réglage par défaut ne protège de cela.
**Pendant la recherche, l'application reste vivante.** Le calcul ne tient pas le
fil d'exécution de l'interface : le plan reste lisible, la page de qualité des
propositions déjà obtenues reste ouverte, et l'avancement est visible. Une
demi-heure de fenêtre figée se lit comme un plantage, et l'opérateur tue le
logiciel — ce qui perd exactement ce que la recherche avait trouvé. Le compteur
d'inactivité du § 8.4 est suspendu tant qu'un calcul tourne, donc le retour
automatique en lecture ne tombe jamais au milieu d'une génération.

**Une opération longue s'annonce, et l'écran ne paraît pas figé.** Ouvrir un
événement ou l'une de ses versions de secours (§ 8.8), charger une
démonstration, défaire, refaire ou revenir à un instant, appliquer un import,
finir une génération — trier et enregistrer ses propositions, après la
recherche —, ouvrir la section de l'impression, préparer, produire ou
enregistrer ailleurs la planche de badges, écrire ailleurs : ces opérations
calculent sur le fil de l'interface. Une pastille « Traitement en cours… », au
bas de la fenêtre et centrée, se pose et se peint **avant** que le calcul ne
parte, et ne se voit qu'au bout d'**une demi-seconde** : une opération brève
passe sans rien montrer. Son apparition et la rotation de son signe sont jouées
par le compositeur du navigateur pendant que le calcul tient le fil, sans
minuterie ; sous la préférence de mouvement réduit, elle apparaît de même et son
signe reste immobile. Le curseur dit l'attente tant qu'elle est là. Elle se
retire à la fin de l'opération, aboutie ou refusée, et deux opérations qui se
chevauchent n'en montrent qu'une. L'attente de la peinture ne change pas l'ordre
des gestes : un geste fait pendant elle part après l'opération qui l'attend —
« Défaire » puis un ajout défont le geste d'avant, et l'ajout suit. Un geste
ordinaire du plan ne la montre jamais, et l'écran au repos ne la porte pas.

**Les propositions d'une génération se calculent en parallèle, sur les cœurs du
poste.** Chaque proposition ne dépend que de sa graine dérivée — et, pour une
dérivée, du plan de son départ et de ses tours figés, que chaque fil reçoit avec
elle (§ 5.7) — : un groupe de fils d'exécution, hors de celui de l'interface,
s'en partage les rangs, chacun prenant le suivant dès qu'il a rendu le sien, et
le résultat, rangé par identifiant, est octet pour octet celui d'un calcul sur
un seul fil, quel que soit le nombre de cœurs. Ce nombre est un **réglage du
poste, non de l'événement** : une case « Cœurs automatiques », cochée par
défaut, en emploie un par processeur logique, hyperthreads compris ; décochée,
elle laisse saisir un « Nombre de cœurs », un entier de 1 au nombre de
processeurs logiques, la valeur automatique affichée à côté, et refuse toute
autre saisie là où elle a eu lieu. Le réglage vaut pour la séance du logiciel,
comme la durée observée : il ne s'écrit ni dans le fichier d'état ni dans le
journal, et se règle en lecture comme en écriture. Une génération n'emploie
jamais plus de cœurs que de propositions demandées. L'avancement reste une seule
barre, la somme des mouvements évalués de toutes les propositions ; l'annulation
arrête tous les fils à la fois, et l'échec de l'un les arrête tous, sans
résultat partiel.

**Le plancher exact se calcule à part, et s'annule.** Les résolutions de
HiGHS (§ 5.6) tournent dans un travailleur à part de ceux de la génération :
une résolution est synchrone et retiendrait les résumés de la liste, et le
solveur, chargé à la demande, n'alourdit pas le lancement. Le calcul part
seul, **400 millisecondes après une charge qui change le modèle** — ni un
plan, ni une proposition, ni un nom ne le relancent, et une saisie qui le
change à chaque frappe ne lance que le dernier. Chaque résolution dispose de
30 secondes, et un tour identique à un autre ne se résout qu'une fois.
Pendant le calcul, la section Diagnostic dit ce qui se calcule et pourquoi —
« Calcul exact du plancher des collisions… tour 2 sur 4. », puis ce qu'il
prouve —, dans une région d'état que lit un lecteur d'écran, avec le signe
d'un calcul en cours, immobile sous la préférence de mouvement réduit, une
barre des tours résolus et la commande « Annuler le calcul exact ». Annuler
termine le travailleur : une résolution synchrone ne s'interrompt pas
autrement, et file:// ne donne pas la mémoire partagée qui permettrait de
la prévenir. Le diagnostic garde alors les planchers instantanés, dit que
le calcul exact est annulé, et ne le relance pas tant que le modèle ne
change pas. Un modèle qui change pendant un calcul termine de même le
travailleur, et un neuf reprend. Un filet, réarmé à chaque tour reçu, de
deux limites plus cinq secondes, termine un calcul dont une limite ne serait
pas tenue. Un solveur qui ne se charge pas — un module WebAssembly refusé
par la plateforme — est indisponible pour la séance, sans nouvel essai à
chaque frappe ; une faute de calcul ne l'est que pour sa configuration.
Chacune va au collecteur d'erreurs, et le diagnostic garde ses planchers
instantanés. Le calcul n'est pas suspendu pendant une génération : il
n'occupe qu'un cœur, borné par le nombre de tours et la limite, et une
génération, qui ne change pas le modèle, ne le relance pas.

**Une commande annule une génération en cours, et elle écarte le résultat
partiel.** L'annulation est immédiate — elle n'attend pas la fin d'une itération
longue. Une proposition issue d'une recherche tronquée porterait la même graine
et le même compte qu'une proposition complète, et ne s'en distinguerait dans aucun
fichier.

**La recherche rapporte sa course, sans lire l'horloge.** Elle compte les
**mouvements évalués** de chaque proposition : le compte d'arrêt, ou moins quand
le n-uplet devient nul, rien ne restant à reprendre, ou zéro quand le plan
initial l'est déjà. Elle garde la meilleure affectation à chaque **point de
relevé** — 1, 10, 100, 1 000 mouvements, chaque puissance de dix strictement
sous le dernier mouvement évalué. Ce dernier est aussi un point de relevé, et
son plan est celui de la proposition, qui ne se copie pas : au plus ⌊log₁₀
a⌋ + 1 copies de N·R entiers pour un compte d'arrêt a. Le mot « jalon » reste à
l'historique (§ 8.3). Copier une affectation ne tire rien et ne change aucune
comparaison : à graine égale, le plan est celui d'avant. Tant que la règle
d'arrêt ne lit que le compte et les mouvements déjà évalués, le point de relevé
k est exactement le plan que la même graine rend au compte d'arrêt k, la
descente ne lisant le compte qu'à sa borne de boucle ; une règle d'arrêt qui
lirait autre chose romprait cette égalité, et l'épreuve du § 14.10 la refuse.

**La durée est celle de la génération** : l'application la prend autour du
calcul entier (§ 5.10), quel que soit le nombre de fils, et ne date aucune
proposition seule. La **cadence** de la génération est la somme des mouvements
évalués de toutes les propositions qu'elle a calculées, celles qu'elle écarte
comme identiques comprises, divisée par cette durée, par seconde : une mesure de
la génération entière, sur tous ses fils, qui ne se ramène ni à une proposition,
cherchée sur un seul fil, ni à un point de relevé ; aucune durée ne s'estime par
point. Une durée nulle ou absente s'écrit « inconnue », et la cadence avec elle.

**Les mouvements évalués et les plans des points de relevé s'écrivent dans le
compagnon des courses** (§ 8.6), sous l'identité de la proposition : ils sont un
fait de la recherche, que la configuration courante ne change pas. **Leurs
valeurs ne s'écrivent nulle part** : la page de qualité mesure chaque point de
relevé sous les réglages courants, par le recalcul complet, quand elle montre la
proposition (§ 12.14), jamais par le score incrémental ; elle garde ces valeurs
tant que la charge ne change pas, et n'affiche jamais une valeur mesurée sous
d'autres réglages. **La durée et la cadence valent pour la séance**, comme la
durée du dernier calcul : elles ne s'écrivent ni dans le fichier d'état ni dans
le journal, et dépendent de la machine. Elles se rattachent à la génération —
chaque proposition qu'elle ajoute, sous son identifiant, sa graine, son compte
d'arrêt et son historique — : un rechargement les retire, et une proposition qui
ne porte plus la même graine ou le même historique sous son identifiant ne les
retrouve pas. Une proposition rouverte montre la course que le compagnon garde
et dit sa durée inconnue. Le coût de la course dans la boucle est un compteur
par mouvement et, par point de relevé, une copie de l'affectation.

**Le recalcul complet est la mesure**, celui dont sortent les chiffres du § 5.4
et de la page de qualité ; **l'incrémental n'existe que dans la boucle de
recherche**, où il sert de score et ne s'affiche jamais. C'est l'exception nommée
au § 13.2. Sans ce partage, la recherche descend un score dérivé et converge vers
un plan que les indicateurs affichés classeront **sous** un plan qu'elle a
rejeté, et l'opérateur verra le classement contredire la proposition.

Le logiciel **éprouve l'incrémental contre le recalcul complet** sur chaque
configuration de démonstration — et sur une configuration qui porte des
objectifs de table et des animateurs, les deux critères cochés, sous chacun des
trois modes des objectifs —, **à 1, 10, 100, 1 000 et 10 000 mouvements** — non
au seul terme : comparer à la fin laisse passer une dérive qui se compense, et
ne dit pas à quel ordre de grandeur le défaut affleure, qui est précisément le
chiffre que l'épreuve doit produire (§ 14.10).

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

Sous une présence partielle, le compte est celui des personnes présentes au
plus à un même tour — « … pour 112 personnes présentes au plus à un même
tour » —, et la section des tables porte un tableau des présences par tour :
pour chaque tour, les personnes présentes, les places et le manque, un manque
positif signalé. Il n'existe pas sans présence partielle. Retirer un tour
nomme, dans son annonce, chaque présence que le retrait rogne.

Deux boutons : appliquer, ou appliquer **et réaligner les 4 surchargées** — le
second geste est séparé parce qu'il détruit de la saisie.

**Créer les tables qui manquent.** Quand les places manquent — le manque de
l'avertissement PLACES_MANQUANTES, le plus grand, d'un tour à l'autre, des
présents non exclus moins la somme des capacités —, l'avertissement offre,
à côté de « Ouvrir les tables », « Créer les tables… », et la section des
tables offre la même commande tant qu'il en manque. Elle déplie en place un
petit formulaire, sans fenêtre : le nombre de places par table, pré-rempli
du défaut, borné comme une table (§ 6.2), puis la forme des tables,
« Rondes » ou « Carrées » — cochée d'abord à la forme de la dernière table
créée dans l'événement, celle qui porte le plus grand identifiant, et à
« Rondes » s'il n'y en a aucune ; le fichier ne porte aucun champ pour
elle —, puis la conséquence chiffrée avant d'appliquer :

> « 22 tables de 8 places : 176 places pour 171 participants »

— sous une présence partielle, « … pour 112 personnes présentes au plus à un
même tour ». Elle ajoute aux tables existantes ⌈manque / taille⌉ tables
de cette taille et de la forme cochée, numérotées à la suite, posées sur des
cases libres, en **une seule entrée d'historique** ; une table à la taille
du défaut le suit, une autre est surchargée. Dans la même entrée, elle
désigne sur ces tables les personnes à désigner animatrices (§ 2.1 étape 6),
et le libellé de l'entrée les compte. Tant qu'une personne est à désigner,
l'aperçu le dit d'une seconde phrase, sous la première :

> « 2 personnes à l'animation réservée y seront désignées animatrices ;
> 1 restera à désigner. »

La phrase ne dit pas le geste qui désigne les restantes : il dépend de la
cause de chacune. La création se refuse en lecture et sur un plan bloqué comme
tout geste sur les tables, et quand plus rien ne manque. Après, l'avertissement
tombe, et le focus passe à l'annonce des tables créées, qui compte les
animateurs désignés ; l'avertissement `ANIMATEURS_A_DESIGNER` nomme chaque
personne laissée à désigner, avec sa cause, et le geste qui la désigne (§ 2.1
étape 6). Créer une seule table ne désigne personne.

**Les animateurs d'une table.** Chaque table de la liste porte une rangée
« Animateurs » : ses animateurs (§ 2.1 étape 6) en pastilles, chacun suivi d'un
bouton de retrait, nommé « Retirer *personne* des animateurs de la table *n* »,
puis « Ajouter… ». Être animateur se calcule — une réservation « tous les
tours » qui pourvoit pour la soirée un titre de la table, ou la désignation
suspendue d'une absente à un tour qui en pourvoit un resté sans pourvoyeur
(§ 4.4) — et la rangée ne lit rien d'autre. Une animatrice devenue absente à
un tour y reste donc, avec son retrait, tant que sa réservation et son titre
existent, et sa pastille est suivie de ses tours d'absence, « Absence au
tour 3 ». « Ajouter… » ouvre une fenêtre modale, « Ajouter des animateurs
à la table *n* », le focus dans sa recherche : la recherche porte sur le nom,
le prénom et l'organisation, sans égard à la casse ni aux accents ; la case
« Grouper par organisation », cochée à l'ouverture, range les personnes par
organisation, « Sans organisation » en dernier, chaque groupe dans l'ordre de
la grille des participants ; le champ « Titre pour les personnes sans titre
pressenti », prérempli d'« animateur », vaut pour les personnes choisies qui
n'en ont pas, chacune des autres recevant son titre pressenti (§ 2.1 étape 6).
Chaque personne a sa case et son statut **en texte** : elle anime cette table
(case cochée et désactivée), elle anime une autre table, elle est absente à un
tour — ses tours d'absence, « Absence au tour 3 » —, une place lui est
réservée à la main — sa table, puis son tour ou la soirée —, elle est exclue —
case désactivée dans ces quatre cas —, elle est placée au plan retenu sans
réservation — ses tables et leurs tours, et elle se choisit : le retenu passera
en dérive comme sous toute réservation (§ 9) —, ou elle est disponible ; son
titre pressenti s'y lit en information. Un compte dit « 2 choisies · 3 places
libres à cette table ».
« Ajouter », désactivé sans choix, désigne les personnes choisies, dans
l'ordre de la liste, en une entrée ; un refus se pose dans la fenêtre, qui
reste ouverte, et « Ajouter » le nomme dans sa description : son remède abouti,
le refus part et le focus revient à « Ajouter ». Pendant l'écriture, un second
« Ajouter », « Annuler » et Échap ne font rien. Une recherche ne renomme pas
un groupe : il garde l'orthographe de la liste entière. « Annuler » et
Échap ferment sans rien écrire ; Entrée dans la recherche ne valide rien ; la
fenêtre fermée, le focus revient à « Ajouter… ». En lecture et sur un plan
bloqué, les pastilles restent, sans retrait ni « Ajouter… ».

**Un changement de défaut est une seule entrée d'historique**, quel que soit le
nombre de tables touchées. **Baisser le défaut** subit les refus du § 6.2, et
le logiciel les évalue **toutes avant d'en appliquer aucune** : si une seule
table refuse, l'opération entière est refusée, nommément, et rien ne change.

### 6.2 Ce que le logiciel refuse

- **Moins de 2 sièges.** Une table à 1 place est un participant qui ne
  rencontre personne de la soirée — c'est ce que le logiciel existe pour éviter.
- **Plus de 1 000 sièges** (`TROP_DE_PLACES`, qui dit le maximum). Le plan
  dessine une chaise par place : au-delà, l'événement deviendrait inaffichable
  sans rien apporter. La borne vaut au défaut comme en surcharge, et pour
  « Créer les tables… » (§ 6.1) ; l'analyse d'un fichier refuse de même une
  capacité ou un défaut au-delà.
- Une capacité inférieure au nombre de réservations portées par la table.
- Une réduction qui retire un siège portant une réservation ou un titre — les
  sièges disparaissent par numéro décroissant ; le refus les liste.
- Une capacité non entière, négative, ou saisie en texte.

Deux cas **avertissent sans refuser** : réduire **par le champ** sous le nombre
de personnes assises (les surnuméraires vont dans la réserve visible, nommément
listées, jamais effacées en silence) ; et dépasser le nombre de sièges au-delà
duquel le dessin cesse d'être lisible — seuil **mesuré** au sens du § 14.1. Le
banc le relève **listes forcées**, sur une table seule, ronde puis carrée, au
zoom ajusté : le plus grand nombre de places dont la liste de noms tient dans la
hauteur du cadre d'affichage, la plus petite des deux formes. Il ne dépend donc
pas du zoom qui retire les listes (§ 17, point 6). Relevé à **18 places**, il est
adopté au registre (§ 19.10).

**Le champ avertit, la poignée refuse.** Saisir une capacité est un geste
délibéré, fait en lisant le nombre ; tirer une poignée est un geste de
géométrie, fait sans regarder les autres tours : la même réduction y est refusée
(§ 7.1). Un changement de défaut (§ 6.1) se contrôle, table par table, comme une
saisie au champ.

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
| glisser une personne hors des tables | la retire du tour ; elle attend dans la **réserve** visible, et sa chaise reste vide (§ 5.8) |
| glisser une table | change sa position |
| tirer la poignée d'une table | **change son nombre de places** |
| survoler une table en conflit | affiche le détail des règles violées |
| zoomer, déplacer la vue | change le cadrage |

Un **menu par personne** offre les mêmes actions sans glisser, pour le tactile
et le clavier.

**La réserve visible ne montre que des personnes présentes.** Une personne
absente au tour montré n'y est pas : la carte « Absentes », sous la réserve,
nomme les personnes absentes à ce tour, chacune suivie de ses tours de
présence — « Prénom Nom — présente aux tours 1 et 2 » ; elle n'existe pas quand
le tour n'en a pas. Une absente n'a ni chaise ni place en réserve ; son bouton
ouvre sa fiche, où sa présence se change (§ 10.2), et ne la choisit pas. Le
plan n'offre pas de commande qui change une présence : la fiche et la grille
en sont le lieu. La mise en évidence marque la chaise que la personne occupe
au tour montré, quand le plan dessine les chaises (§ 7.3) ; sans chaise à ce
tour, rien n'est marqué, et la barre de vue dit l'absence ou la réserve :
« — absente au tour 3 », ou « — dans la réserve au tour 3 ». Une exclue n'a
de chaise à aucun tour ; la barre la nomme sans la qualifier.
« Voir sur le plan », depuis la ligne d'une personne dans la grille des
participants, la met en évidence et ouvre le plan au tour montré quand elle y
a une chaise, sinon au premier tour où elle en a une : le plan la montre
assise, sans que l'opérateur cherche son tour. Sans chaise à aucun tour, le
tour montré reste.

**« Voir sur le plan » amène la chaise de la personne au centre du plan.** Le
plan s'ouvre avec sa chaise au centre de son cadre, au plus petit zoom où sa
table dessine ses chaises (§ 7.3), ou au zoom de la vue quand l'opérateur est
déjà plus près : sur une grande salle ajustée à la fenêtre, aucune chaise
n'est dessinée, et la marque n'aurait ni où se poser ni où se voir. Ce
cadrage est celui d'un zoom de l'opérateur, mémorisé comme lui (§ 8.5). Sans
chaise au tour montré, la vue ne bouge pas. Le tableau des paires répétées
mène au plan de même (§ 12.5). « Mettre en évidence », depuis le menu d'une
personne sur le plan, ne déplace pas la vue : la personne est déjà sous les
yeux de l'opérateur.

**La poignée pilote le nombre de places, jamais une taille libre.** Chaque table
est dessinée à l'échelle de son nombre de sièges ; une taille libre permettrait
un dessin qui ment sur la capacité, et ce mensonge n'apparaîtrait sur aucun
indicateur. En tirant, l'opérateur fait défiler des nombres entiers ; les
chaises apparaissent et disparaissent sous le pointeur.

**La poignée refuse de descendre sous le nombre de sièges occupés, tous tours
confondus** — sinon un geste de géométrie désassoit deux personnes au troisième
tour, que l'opérateur ne regarde pas. Le logiciel nomme le nombre bloquant et le
tour concerné. Le champ de capacité, saisie délibérée, accepte la même réduction
et l'annonce (§ 6.2).

**Une personne qu'une réservation tient à sa table ne se retire pas du tour.**
Le refus nomme la réservation et offre « Retirer la réservation » : une
réservation se défait par sa propre commande, jamais en passant par un
glissement.

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
**oracle** fourni par le moteur de rendu. L'écart admis est d'**un millième de
pixel d'écran** : le moteur de rendu lit les nombres de l'attribut `transform`
en flottants de 32 bits et compose sa matrice à cette précision, quand une
violation de l'un des trois invariants décale le plan d'un pixel au moins.

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
qu'en laissant l'opérateur manquer sa cible sans comprendre. Sous ce zoom, la
chaise d'une personne mise en évidence n'est pas dessinée non plus : « Voir
sur le plan » zoome jusqu'au seuil de sa table (§ 7.1).

**Le seuil se décide table par table**, sur le pas de chacune — la distance
entre deux sièges voisins au bord du plateau. Au même zoom, une petite table
ronde, dont le plancher du § 7.7 écarte les sièges de plus de 60 cm, garde ses
sièges pour cibles quand ses voisines de 8 n'en ont plus. Un seuil unique, réglé
sur la table la plus serrée, retirerait ses sièges à une table qui les montre
pointables.

**Il n'y a pas de survol au doigt** : le détail d'un conflit est accessible par
survol, par focus clavier **et par pression longue** — un seul composant
d'infobulle, trois déclencheurs. L'infobulle, comme un refus posé sur une place,
se tient dans le cadre du plan : à droite de sa table ou de sa place quand elle
y tient, sinon de l'autre côté, jamais sur le panneau voisin ni hors du cadre.

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

Le numéro d'une table, inscrit sur son plateau (§ 7.7), est un seul `<text>` :
il ne s'abrège ni ne se replie jamais. Le libellé de la table, inscrit sous lui,
est un `<text>` dont chaque ligne est un `<tspan>` : il **se replie** dans les
lignes que le plateau lui donne, entre ses mots d'abord, chaque suite de blancs
réduite à une espace ; un mot plus large que sa ligne s'y coupe entre deux
caractères — jamais entre les deux moitiés d'une paire de substitution, ni
devant une marque combinante, ni de part et d'autre d'un liant sans chasse —, et
sa suite ouvre la ligne suivante. Ce que la dernière ligne ne tient pas
l'**abrège** : le plus long début qui, suivi de la marque, y tient.

**La troncature se décide par document, pas par support — et sur le badge, par
champ :**

| document | règle |
|---|---|
| le plan de salle, à l'écran comme à l'impression | **abrège** avec une marque, la largeur d'un bloc de noms étant la même contrainte des deux côtés ; le libellé d'une table s'y **replie** dans son plateau, **puis s'abrège** ; l'organisation, demandée, s'y **replie** sous le nom et **ne s'abrège jamais** |
| la fiche à l'écran, la feuille par table, la liste d'accueil | **ne tronquent jamais** : elles replient |
| le **badge** (§ 11.5) | **ne tronque jamais** : chaque texte se replie en paragraphe, et l'ordre change **par champ** — le nom réduit de corps par paliers, puis se replie ; l'organisation se replie, puis réduit de corps ; une ligne de tour se replie au corps plancher, sa suite en retrait |

Un nom coupé sur la feuille que tient le personnel de salle ne sert à personne ;
un nom de deux cents caractères déployé sur un plan de 33 tables détruit la
page.

**L'organisation se lit à côté du nom, sur demande.** La barre de vue du plan
offre, à droite de « Listes de noms », la bascule « Organisation », éteinte à
l'ouverture de chaque événement. Allumée, la ligne d'une personne assise porte,
après son nom et un point médian, son organisation, à l'encre secondaire : « 3.
Iris Ombrelle · Club des Merles — *animateur* ». Une personne sans organisation
garde son nom seul ; la titulaire d'une réservation que la chaise n'assied pas
n'est nommée que par son nom. Regarder n'écrit rien (§ 8.4) : la bascule ne
touche ni l'événement ni les réglages du poste. Listes masquées, elle n'a rien à
montrer : elle reste à sa place et garde son état, inactive, et dit qu'il faut
montrer les listes. Le bloc de noms garde sa largeur, et **l'organisation ne
s'abrège jamais** : quand la ligne entière ne tient pas, elle passe sous le nom,
sans son point, en retrait d'un cadratin, et s'y replie sur autant de lignes
qu'il faut, entre ses mots — entre deux caractères pour un mot plus large que la
ligne, jamais entre une lettre et son accent. La ligne du nom s'ajuste alors
comme sans elle : un nom trop long s'y abrège encore, et une organisation dont
le nom tombe tombe avec lui. Le bloc s'allonge vers le bas de ces lignes, au
pas des autres, et les sièges suivants descendent d'autant ; aucune ligne ne
sort de la largeur du bloc. La grille des tables, dont le pas de rangée ne
compte que les emprises, l'emprise du plan à l'écran et l'ajustement ne
changent pas. **Un bloc ainsi allongé peut couvrir le bloc du dessous** : plus
haut que le pas de rangée, ce qu'est déjà sur la grille par défaut une ronde de
huit places dont chaque ligne se replie une fois, il descend sur la liste de la
table posée une rangée plus bas dans la même colonne, et leurs lignes se
superposent, à l'écran comme sur le papier. Rien ne le signale ; écarter les
deux tables, ou éteindre la bascule, les sépare. Ces lignes s'ajoutent sans
rien écrire, et l'avertissement d'une liste sur une voisine, qui juge
l'événement, ne les compte pas. Sur le papier, la découpe en pages compte
chacune (§ 11.7).

**La largeur d'une ligne est celle que le moteur de rendu pose.** Chaque partie
d'une ligne — numéro et état, nom, organisation, titre — est son propre
`<tspan>`, dont le moteur de rendu arrondit la chasse à son unité de mise en
page : une ligne de quatre parties peut rendre plus large que la même ligne
mesurée d'un tenant. La ligne s'ajuste sur la plus grande des deux largeurs, et
une épreuve du navigateur vérifie, sur le plan imprimé, que la chasse rendue de
chaque ligne tient dans le bloc.

**Sur une feuille imprimée, replier s'étend à la page.** La feuille par table
garde à chaque colonne de tour au moins la largeur de son plus long mot ; des
tours qui n'y tiennent pas côte à côte se scindent en **groupes de tours
consécutifs**, chacun sur ses pages, sous ses propres têtes de tour. La liste
d'accueil donne à chaque colonne de tour au moins la largeur du plus large
libellé de place ou tête de tour, sur une ligne, et garde aux nom, prénom et
organisation au moins le tiers de la largeur ; des tours qui n'y tiennent pas
côte à côte se répartissent en **blocs de tours consécutifs**, aussi peu que
possible, de même taille, le dernier plus court s'il le faut. Un libellé plus
large que les deux tiers laissés aux tours tient seul dans son bloc et y replie,
entre ses mots d'abord. Chaque bloc commence une page et reprend chaque ligne,
les colonnes de noms répétées, sous un en-tête qui nomme ses tours (« Tours 1 à
34 ») ; un bloc plus long qu'une page continue sur la suivante, sous son en-tête
répété. Une soirée dont les tours tiennent n'a qu'un bloc, sans cet en-tête. Une
ligne encore plus haute qu'une page — un nom de plusieurs milliers de caractères
— ne se coupe pas au bord de la feuille : son texte se poursuit sur la page
suivante, sous l'en-tête répété, coupé au début d'un mot, ou entre deux
caractères quand un mot seul dépasse la page — jamais entre une lettre et son
accent. Rien d'une ligne ne tombe hors de la page, et aucun nom n'est tronqué.

### 7.5 Les tables en conflit

Une table dont le placement viole une règle active se signale par une classe
posée à partir des indicateurs du moteur — **le plan ne recalcule rien, il
lit**.

Le signal **ne repose pas sur la seule couleur** : contour épaissi, trame, et
une **pastille portant le nombre de violations**. Une part notable des
opérateurs ne distingue pas un rouge d'un vert.

**La pastille se pose en haut à droite du plateau, sur son bord, comme un
badge** : au coin haut droit d'une table carrée ; sur le cercle d'une ronde, à
la diagonale qui monte vers la droite, sauf quand une chaise y toucherait la
pastille — elle prend alors le milieu de l'intervalle entre deux chaises
voisines le plus proche de cette diagonale, celui du haut quand deux le sont
autant. Elle ne couvre ainsi aucune chaise, ni la marque de gel, ni le numéro
de la table, qui tient le centre, ou monte au-dessus quand un libellé le suit
(§ 7.7), et dont le corps se réduit pour rester à l'écart d'elle. Sur une table
signalée, un socle du fond du plateau, sous la pastille, le numéro et chaque
ligne du libellé, les sépare des trames : tous se lisent contre le fond du
plateau (§ 14.5), et la trame reste peinte autour.
**Le socle de la pastille est rogné au plateau** : la pastille déborde du bord,
son socle non, et rien du fond du plateau ne se peint sur le sol ni sur
l'emprise. **Le contour épaissi**, l'un des trois signaux, **se peint
par-dessus les trames et les socles**, de toute son épaisseur, tout autour du
plateau et de part et d'autre de la pastille, où seul son disque le couvre ;
les chaises, posées sur le bord, se peignent par-dessus lui.

**Chaque règle a sa trame, d'une forme et d'une teinte propres** — hachures
horizontales pour le conflit d'organisation, hachures descendantes pour
« séparer les organisations », hachures montantes pour « nouveaux voisins »,
points pour « nouvelle table ». La forme suffit sans la couleur ; la teinte la
redit. Les teintes libres à trente degrés des autres jetons sont rares : celle
du conflit d'organisation est un brun presque noir dans le thème clair, un
vert-jaune vif dans le sombre. Une table qui viole plusieurs règles superpose
leurs trames — les deux hachures obliques se croisent en quadrillage, les
horizontales les traversent — sous un même contour épaissi, commun aux quatre
règles ; la pastille compte toutes ses violations, une paire en conflit
d'organisation pour une.

**Le conflit d'organisation se signale à la table, il ne se refuse pas.** Sa
règle, sans case, est active dès que le critère a un objet (§ 5.3), et ses
paires sont celles de la mesure : la somme des paires de chaque table, sur la
soirée, égale les conflits d'organisation du placement. Un placement retouché
à la main, ou une réservation, qui réunit deux personnes en conflit est
signalé ainsi, jamais refusé.

**Une légende des conflits reste accessible depuis le plan**, par la barre de
vue : pour chaque règle active, un échantillon de sa trame — la forme et la
teinte que le plan peint — et son nom ; elle dit aussi ce que compte la
pastille. Une règle inactive n'y paraît pas ; le conflit d'organisation y
paraît, en tête, quand son critère a un objet, tel que la table d'évaluation
le dit.

Le détail d'une table en conflit nomme les personnes de chaque violation ;
pour « séparer les organisations », il nomme aussi **l'organisation qui les
réunit**, telle que la liste la porte : « Même organisation (Club des Merles) :
Iris Ombrelle et Théo Pervenche ». Pour le conflit d'organisation, il nomme
chaque paire : « Conflit d'organisation : Iris Ombrelle et Théo Pervenche ».

**Les conflits du placement montré se lisent aussi dans la liste des
participants**, tirés des mêmes indicateurs — la proposition demandée au plan,
sinon le retenu —, sans seconde règle : chaque table y compte autant de conflits
que sa pastille. Groupée, la liste marque chaque groupe en conflit et en écrit
les lignes ; groupée ou non, la colonne « Conflits du placement » résume ceux de
chaque personne tour par tour, et sa fiche les détaille dans une rubrique du
même nom (§ 10.2). Hors du plan, le texte seul les dit : aucune couleur ne les
distingue, la teinte de conflit reste au plan.

**Une inclusion non satisfaite ne se peint sur aucune table** : elle n'est la
faute d'aucune, et la pastille ne compte que les violations de sa table. Elle se
lit dans la liste de travail « Inclusions non satisfaites » du plan (§ 5.8), et,
pour chaque personne, dans la rubrique « Inclusions du placement » de sa fiche
et dans la colonne du même nom de la grille (§ 10.2), tirées de la même mesure
que le tableau des propositions et la page de qualité (§ 12.15).

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

**Une réservation remplit sa chaise quand le placement y assied sa personne ;
un titre seul, dès qu'une réservation le pourvoit** (§ 4.1). La réservation que
le placement ne tient pas — chaise vide, ou une autre personne assise — laisse
sa chaise hachurée, au cadenas fermé. Le titre qu'une réservation pourvoit sans
que la chaise la porte — une réservation sans siège, sa personne assise ailleurs
ou nulle part — rend sa chaise pleine, au cadenas ouvert ; hachurée tant que
rien ne le pourvoit à ce tour.

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
cosmétique** : en deçà de quatre convives — la formule atteint 70 cm à 3,67
places — ce n'est plus le périmètre qui borne la table mais le plateau, et la
formule seule dessinerait des guéridons. Les deux valeurs sont des **réglages
par défaut, non des normes vérifiées** ; un diamètre saisi à la main l'emporte,
dès que le fichier d'état peut le porter : le format du fichier n'a pas de champ
pour lui, et toute table s'y dessine selon la formule.

**Les étiquettes ne sont pas à l'échelle, le mobilier l'est.** Une liste de dix
noms couvre plusieurs mètres carrés fictifs. **Le plan à l'échelle du bâtiment
est le plan listes masquées**, et le logiciel le dit sur chaque impression
portant les listes.

**Chaque table porte son numéro au centre de son plateau** — le numéro
affiché, non son identifiant (§ 4) —, à tout zoom, à l'écran comme sur le
papier. Son corps suit le plateau : 40 % de sa largeur, jamais moins que le
corps des listes de noms ; il reste donc affiché au zoom où les listes
disparaissent, d'autant plus grand que la table l'est. Il s'écrit de l'encre des listes, en gras,
et, sur une table signalée, un socle et un halo du fond du plateau le détachent
des trames (§ 7.5). Il est transparent au pointeur, et caché aux technologies
d'assistance : le nom accessible de la table le porte déjà.

**Le corps du numéro suit aussi ses chiffres**, que les numéros, jamais
réutilisés, portent au-delà de 99. Quand son encre, à 40 % de la largeur,
passerait à moins de 1,5 cm de la pastille, du bas de la marque de gel ou du
bord du plateau, il prend le plus grand corps qui l'en tient à cette
distance, au même centre. Jusqu'à deux chiffres, aucune table ne le réduit ;
trois chiffres le réduisent sur les rondes de une à quatre places, quatre sur
celles de une à six, cinq et plus sur toute table. La géométrie borne l'encre
par la chasse et la hauteur des chiffres de la police, et par le demi-centimètre
dont le moteur de rendu peut décaler leur ligne de base ; une épreuve du
navigateur vérifie ces bornes sur la police chargée. **Le corps ne descend
jamais sous celui des listes** : à ce corps, au centre, l'encre d'un numéro
reste à l'écart de la pastille et de la marque de gel, quel que soit son nombre
de chiffres ; un numéro que ce corps ne tient pas à l'écart du bord — sept
chiffres sur les plus petites tables — le garde, et peut déborder du plateau.
La place et le corps ne dépendent ni de la présence de la pastille ni du gel :
un conflit ou le gel d'une table ne déplace pas son numéro et n'en change pas
le corps.

La géométrie rend aussi sa place quand un libellé le suit dessous : il monte
alors au-dessus du centre, dans la bande qui va du bas de la marque de gel au
centre du plateau, au corps de cette bande, plafonné au sien et jamais sous
celui des listes, sans passer sur la marque de gel, et réduit selon ses
chiffres de la même façon. Sur les plus petites tables, rondes ou carrées de
une à quatre places, la bande est plus étroite que le corps des listes : le
numéro y prend ce corps quel que soit son nombre de chiffres. Sur ces rondes, à
trois chiffres ou plus, son encre peut alors toucher la pastille.

**Le libellé d'une table s'inscrit sous son numéro**, qui monte alors à cette
place, aux zooms où les listes de noms se dessinent et sur le papier. Sous le
seuil qui retire les listes (§ 17, point 6), il disparaît comme elles, et le
numéro revient au centre. Il ne suit pas la commande qui masque les listes : il
appartient à la table, non au bloc de noms. Il s'écrit au corps, à l'encre et
dans la police des listes, avec le halo du numéro, et, sur une table signalée,
chaque ligne repose sur un socle du fond du plateau, rogné au plateau. Sa
première ligne commence 1,5 cm sous l'encre du numéro ; les suivantes descendent
d'un pas que bornent l'encre du gabarit de hauteur (§ 7.4) au-dessus et
au-dessous de la ligne, et tant que l'encre d'une ligne, demi-centimètre du
rendu compris, reste à 1,5 cm du bord du plateau. Chaque ligne prend la largeur
que ce bord lui laisse à sa hauteur : la corde d'une ronde, le côté d'une
carrée. La plus petite ronde en tient une ligne d'environ 40 cm, quelques
caractères ; une ronde de huit places, trois. Le texte s'y replie, puis
s'abrège (§ 7.4) ; une épreuve du navigateur vérifie les bornes de l'encre sur
la police chargée. Transparent au pointeur, il est caché aux technologies
d'assistance : le nom accessible de la table le cite.

**Le bloc de noms d'une table se pose à droite de son emprise** — le plateau et
ses chaises —, à 36 cm d'elle : l'écart laisse passer le contour de focus de la
table sans qu'aucune marque couvre la liste. Sa largeur est fixée dans le
dessin, et un nom trop long s'y abrège (§ 7.4). **Aucune liste ne passe sur les
chaises d'une voisine posée sur la grille** : une table créée prend la première
case libre d'une grille dont les colonnes s'écartent d'une emprise, de deux
écarts et d'un bloc de noms, à un pas entier au moins, sur l'un des deux axes,
de toute table déjà posée, et les démonstrations (§ 15) sont rangées sur la même
grille. Le prix est la place : au zoom ajusté, une grande salle descend sous le
seuil qui retire les listes (§ 17, point 6), et un grand événement peut s'ouvrir
sans listes de noms, qui se dessinent quand l'opérateur rapproche la vue.

**Une table agrandie peut porter sa liste sur une voisine, et le logiciel le
dit.** La grille garde les tables qu'elle pose ; une capacité qui croît ensuite —
au champ, à la poignée, par un réalignement ou un changement de défaut — allonge
la liste et élargit l'emprise. Quand le geste fait qu'une liste couvre une table
qu'elle ne couvrait pas avant lui, d'un côté ou de l'autre, il passe et
**avertit** : l'avertissement nomme les deux tables et offre de déplacer la
voisine sur une case libre de la grille. Aucune table ne bouge seule — un geste
ne déplace que ce qu'il nomme —, et une paire de tables ne se dit qu'une fois.

**Tant qu'aucune dimension de salle n'est saisie, le plan est exact dans ses
tables et arbitraire dans son cadre.** Le logiciel porte alors, sur le plan et
sur **chaque impression**, la mention « disposition relative — l'encombrement
dans la salle n'est pas vérifié ». Une mention imprimée coûte une ligne ; un
montage à refaire coûte une soirée.

Une fois les dimensions saisies, **le logiciel mesure et rapporte, il ne déclare
pas conforme.** Le mot « conforme » est absent de l'interface tant que les
dégagements de référence ne sont pas établis.

**Toute impression à échelle réduite porte une échelle graphique**, non la
seule mention « 1:100 » : une impression ajustée à la page change le facteur sans
prévenir, et le chiffre devient un mensonge tandis que la règle graphique reste
juste. La **planche de badges**, qui est à l'échelle 1, porte la sienne sur sa
**feuille de contrôle** (§ 11.3) : la planche ne laisse pas un millimètre libre,
et une graduation tracée sur un axe de coupe laisserait des repères de 8 mm sur
le carton fini — elle ne disparaîtrait pas à la coupe.

**Pourquoi poser l'unité maintenant**, alors que la première itération n'exige
aucun contrôle d'encombrement : le coût est nul aujourd'hui, et plus tard c'est
une migration silencieuse — tous les fichiers enregistrés porteraient des
coordonnées dans une unité arbitraire, que rien ne distingue des nouvelles.

---

## 8. Les événements : fichiers, enregistrement, historique

### 8.1 Un événement, un fichier, une liste

Chaque événement vit dans **son propre fichier d'état**, complet et autonome, et
dans **son propre dossier**, sous le dossier de travail (§ 8.6). Ce fichier seul
suffit à rouvrir, imprimer et transmettre ; l'historique vit à côté et n'est
jamais nécessaire pour ouvrir.

**Ce que le fichier porte :**

| | |
|---|---|
| participants | avec identifiant entier, nom, prénom, organisation, courriel, titre pressenti, notes, **exclusion**, **étiquettes**, **présence**, **conflits d'organisation**, **inclusions** d'organisation et de participant, chemin du **logo**, marque du **nom numéroté**, marque de l'**animation réservée** |
| tables | numéro, capacité **et son état** : `sieges: null` (suit le défaut) ou un entier (surcharge) ; **forme**, **libellé** |
| le **nombre de sièges par défaut** de l'événement | |
| tours, réglages, réservations avec leur portée, **titres de place** | |
| **objectifs des tables**, avec leur portée et leur règle propre | |
| **règle par défaut**, case « Respecter les objectifs des tables », **mode des objectifs**, case « Rencontrer le plus d'animateurs différents », **ordre des priorités** | dans les réglages, absents tant qu'ils valent leur défaut |
| placements engendrés, celui qui est retenu, état du plan | |
| **positions en centimètres**, et l'unité déclarée | |
| **filiation** : nom et identifiant de la source, instant d'origine | |

Le § 8.9 donne la forme des placements et celle des champs facultatifs, chacun
absent tant qu'il vaut son défaut.

**Ce que le fichier ne porte pas : ni le mode, ni le cadrage.** Une liste de ce
qui est dedans, sans son complément, laisse l'implémenteur ajouter.

**Le nom d'un événement compte au plus 68 caractères.** La création, la copie et
le renommage le comptent en NFC, ses blancs de bord retirés, un caractère par
point de code, et refusent au-delà : `NOM_EVENEMENT_TROP_LONG`, qui dit la
longueur saisie et le maximum. Rien n'est tronqué. La borne vient du chemin
(§ 8.6) : un nom de 68 caractères ordinaires donne un nom de fichier entier sous
le dossier `data` des *Documents*, où il compte deux fois, au dossier de
l'événement et à ses fichiers ; un caractère hors du plan de base, un nom de
périphérique ou une racine plus longue le raccourcissent (§ 8.6). La lecture ne
borne pas : un fichier dont le nom passe la borne, écrit hors de l'application
ou sous une version qui en admettait de plus longs, s'ouvre et se lit comme un
autre. Seule son impression se refuse (§ 11.7).

Le logiciel ouvre sur une **liste des événements**, avec pour chacun le nom, la
date, l'état, le nombre de participants, la dernière modification et le chemin.
Le chemin est celui du fichier d'état, dans le dossier de l'événement :
`<dossier de travail>\<dossier>\<nom>.gtt.json`. Une ligne se désigne par
son dossier et le nom de ses fichiers — une copie faite à la main d'un dossier
porte un autre dossier et le même nom de fichiers, et fait une autre ligne.
La dernière modification est l'horodatage de la dernière entrée du journal
(§ 8.6), tel que l'horloge de l'application l'a noté (§ 19.4), jamais la date
du système de fichiers. La liste le lit depuis la fin du journal, sans
restituer aucune charge : la première ligne du journal se juge comme à la
lecture, puis la dernière ligne complète qui est une entrée, à l'horodatage de
forme admise, donne la date ; les jalons ne comptent pas. Ni la forme des
lignes qui précèdent cette entrée, ni ses autres champs, ni celle des
instantanés ne se contrôlent. Sur un journal sain, c'est donc la dernière
entrée que l'ouverture lit ; sur un journal dont une ligne au milieu est de
celles que l'ouverture refuse (JSON invalide, forme fausse, révision ou cadence
hors de sa suite), la date reste celle de la dernière entrée du fichier,
au-delà de l'avarie. Une ligne qui n'est pas de l'UTF-8 arrête la
date comme elle arrête l'ouverture, à la dernière entrée qui la précède. Sans
journal, sans ouverture lisible ou sans entrée, la ligne n'en porte pas.
Un en-tête la résume — « N événements · M participants au total », M la somme
des participants des lignes listées — et offre la création et l'import. Sous
lui, une tuile par filtre — tous les événements, puis chaque état du plan dans
l'ordre du § 9 —, avec le nombre de lignes qu'il retient, la pastille de l'état
et une aide qui redit sa ligne du § 9 ; ce sont des boutons-filtres, et le
filtre, avec le groupement, est un état d'interface que la séance retient et que
rien n'écrit. Le tableau groupe les lignes par état, dans l'ordre du § 9, les
états illisibles à la suite — chaque groupe sous un intitulé qui porte la
pastille de l'état et son compte —, ou ne les groupe pas, au choix ; ses
en-têtes de colonnes se groupent en « Événement », « Placement retenu » et
« Meilleure proposition du classement », et le nom de chaque ligne en est
l'en-tête, la date et le chemin en petite ligne dessous. Sous le tableau, des
cartes offrent la création, le dossier de travail et les démonstrations. Le
formulaire de la création exige un nom ; la date, facultative, se choisit dans
un sélecteur de date, borné de 1900 à 9999. Une date commencée mais
incomplète, ou complète mais absente du calendrier, refuse la création
(`DATE_INCOMPLETE`) ; une date d'une année avant 1900 — par exemple tapée sur
deux ou trois chiffres — la refuse aussi, sous un refus qui nomme ce
minimum, « L'année de la date est 1900 au plus tôt » ; l'un et l'autre se
posent contre le champ de la date, sans rien écrire. Deux colonnes résument
en plus le **placement retenu**, sous l'en-tête du groupe qui les couvre
toutes deux : « Collisions cumulées (paire et tour) », les collisions
cumulées du retenu, puis « Rencontres répétées choisies (paires) », les
paires réunies plus d'une fois que le placement a choisies, sans celles que
les réservations imposent (§ 5.4) — dans chacune, le nombre que la colonne
du même intitulé du tableau des propositions porte sur la ligne du retenu.
Les deux se lisent dans une seule mesure du retenu, celle du tableau, sans
rien écrire dans l'événement ; un événement sans retenu, ou dont le retenu
est fautif ou en dérive (§ 8.9, § 9), porte « — » dans l'une et l'autre.
Chaque ligne porte aussi la **« Meilleure proposition du classement »**, sous
les libellés du bloc que la section de la génération montre en tête :
l'identifiant de la proposition au rang 1 du classement (§ 5.7) — la même
proposition que ce bloc et que la première ligne du tableau des propositions,
retenue ou non ; une proposition fautive, que l'ouverture écarte (§ 8.9, point
3), n'y entre pas. Sans proposition classée — aucune, ou aucune qui décrive
encore la configuration —, elle vaut « — ». La liste ne montre pas les
collisions cumulées de la meilleure proposition : le tableau des propositions et
le bloc de la génération les portent. Chaque intitulé s'explique dans une
infobulle, posée sur l'en-tête de sa colonne. **La liste paraît avant ses
colonnes calculées** : ses lignes s'affichent dès le relevé du dossier, puis les
mesures du retenu et la meilleure proposition viennent de l'**aperçu** de chaque
événement (§ 8.6), qui garde les chiffres de la dernière vue d'ensemble avec
l'empreinte des textes dont ils viennent — le fichier d'état et la dernière
ligne complète du journal. Un aperçu dont l'empreinte est celle des fichiers sur
le disque donne ses chiffres aussitôt, sans rien évaluer, et ne se recalcule
pas. Un aperçu périmé — l'événement a changé depuis qu'il s'est écrit — donne
aussitôt son ancien chiffre, à l'encre secondaire de la page, sans opacité
partielle (§ 14.5), le signe de chargement qui tourne à côté, et l'aide
« Chiffre de la dernière vue d'ensemble, en cours de vérification », au survol
et pour les technologies d'assistance. Sans aperçu lisible — absent, d'une autre
forme, d'un autre format ou d'une autre construction du logiciel —, chaque
valeur porte le signe seul. Les événements sans aperçu à jour, eux seuls, se
recalculent ensuite, un événement après l'autre, la main rendue au navigateur
entre deux : la page relit l'état comme l'ouverture l'examine, une instance
propre du travailleur de la génération (§ 5.10) évalue la charge hors du fil de
l'interface, puis la liste réécrit l'aperçu et montre les chiffres recalculés.
Sans travailleur, l'évaluation se fait sur le fil, par les mêmes fonctions ; un
travailleur dont le script ne se charge pas compte comme une faute du calcul, et
la ligne porte « — ». Tant que celles d'une ligne attendent ou se vérifient, la
région d'état de la liste annonce le calcul, une fois pour toutes les lignes ;
une liste relue abandonne les calculs de la précédente, et renommer ou supprimer
un événement les arrête, puis attend l'aperçu qui s'écrit, avant de toucher au
disque ; le démontage de l'application termine le travailleur, qui ne retient
jamais la fermeture. L'aperçu est la seule écriture de la liste — jamais l'état,
le journal ni le verrou, y compris pour un événement qu'une autre séance tient
—, et un refus de l'écrire se tait : c'est un cache, que son empreinte juge. Un
état changé pendant son calcul laisse un aperçu périmé, que la liste suivante
recalcule. **Un répertoire vide n'affiche pas une liste vide** : il présente la
commande de création et les démonstrations — ni tuiles, ni tableau, ni résumé —,
car une liste vide sans issue est le premier écran que voit un opérateur qui
lance l'exécutable. Un filtre qui ne retient aucune ligne le dit, sans laisser
un tableau vide.

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

**Le fichier de réglages locaux du § 8.5 échappe nommément à cette règle** : il
ne porte aucune entrée d'historique, et le logiciel **diffère** l'écriture du
cadrage plutôt que de l'écrire à chaque image d'un zoom. Le papier et la taille
du texte, eux, s'écrivent au geste qui les choisit. Lui appliquer la règle
écrirait un fichier par image de molette.

**Le coût d'un enregistrement complet est un seuil mesuré**, non un ordre de
grandeur posé de tête : la réécriture intégrale du fichier d'état **à chaque
entrée** est la contrainte réelle qui gouverne le format (§ 8.9). La mesure se
prend sur la grande démonstration, sur la plateforme livrée, et le test échoue
au-delà (§ 14.1 ; série `node:long` du § 14.4). Le geste mesuré est celui des
commandes : il retouche une copie de travail qui partage les propositions
figées de l'événement ouvert (§ 13.4), et l'épreuve refuse un geste dont les
propositions arriveraient recopiées, qui mesurerait un autre chemin. Le relevé
sur la plateforme livrée porte sur la durée au mur, écritures comprises. La
série `node:long` en borne le calcul : le temps que le geste attend la coquille
pour écrire et vider ses fichiers dépend du système de fichiers et de ce qui
l'occupe au même moment ; il s'y relève sur chaque geste et s'ajoute à son
seuil, et l'épreuve vérifie à part que le geste écrit sa ligne de journal, le
`.precedent` et l'état, une fois chacun, et rien d'autre.

**Est une entrée exactement ce qui change le contenu du fichier.** Changer de
tour affiché, zoomer, mettre en évidence, masquer les listes ou y montrer les
organisations **n'en sont pas**.
Déplacer une table **en est une** : sa position est une donnée du plan.

**Chaque entrée porte un libellé en français, figé à l'écriture** — « Déplacé
Camille Roy de la table 4 à la table 7, tour 2 ». Jamais reconstruit ensuite :
les objets nommés peuvent avoir disparu, et un historique qui affiche « déplacé
‹participant supprimé› » ne sert plus à rien. Une inclusion de participant, que
le fichier ne désigne que par son identifiant, se nomme donc dans le libellé par
le nom de la personne visée : « Inclusions de participant de Iris Ombrelle :
ajouté Théo Pervenche » se lit encore après que Théo Pervenche a été renommée ou
supprimée. La suppression d'une personne incluse compte les listes qu'elle
quitte : « Supprimé Théo Pervenche ; retirée de 2 listes d'inclusions ».

**Un retour fait au clavier nomme sa touche dans son libellé** : « Défait
(Ctrl+Z) : », « Refait (Ctrl+Maj+Z) : » ou « Refait (Ctrl+Y) : », suivi du
libellé cité de l'instant ; « Défaire » et « Refaire », les commandes de la
barre, écrivent « Défait : » et « Refait : », sans touche. Avec la date et
l'heure de l'entrée, l'historique garde ainsi, pour chaque retour, la touche
ou la commande qui l'a fait, sans que le format du journal change.

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

**Défaire et refaire avancent toujours d'un pas.** Quand l'instant visé a le
même contenu que l'instant courant, leur entrée s'écrit quand même : c'est elle
qui déplace le fil, et un refus laisserait chaque nouveau « Défaire » buter sur
le même instant. Revenir à un tel instant, choisi dans la liste, ne change rien
et ne s'écrit pas : le refus le dit, « Cet instant a déjà le contenu courant :
rien n'est enregistré. »

**Un retour rend le chemin d'un logo, et son image est toujours là.** Le logo
d'une personne est un fichier du dossier de l'événement nommé par son contenu
(§ 8.9) ; l'état n'en garde que le chemin, qu'un retour restitue comme tout
champ. **Aucun geste n'efface une image de logo** — ni la remplacer, ni la
retirer, ni supprimer la personne, ni un import qui remplace la liste — : le
chemin restitué désigne toujours l'image que l'instant portait. Une image ne
part qu'avec le dossier de l'événement, à la corbeille (§ 8.7).

**La vue d'historique est un panneau**, ouvert et refermé par « Historique… »
dans la barre de l'événement, à côté de « Défaire » et « Refaire ». Il se pose
à droite de la surface, sur toute sa hauteur, ou par-dessus elle quand la
fenêtre est étroite ; il défile seul, et Échap, le focus dans le panneau, le
referme. Sa liste est **plate, dans l'ordre du journal, la plus récente en
haut** : chaque ligne porte la date et l'heure de son instant, puis son libellé
figé. La pastille « instant courant » marque la ligne la plus récente, celle de
l'état que l'écran montre — après un retour, la ligne de ce retour. Une entrée
d'un fil abandonné est en encre secondaire et porte la pastille « fil
abandonné » : elle reste dans la liste, et on peut encore y revenir. Chaque
jalon est une pastille de son nom, sur la ligne de l'entrée dont il porte la
révision : le nom que « Nommer » donne se lit sur la ligne marquée « instant
courant ». « Revenir à cet instant », sur chaque ligne sauf la courante,
restitue l'instant **sans confirmation**, puisque ce retour se défait comme un
autre. Une ligne de même contenu que l'instant courant — la cible d'un retour,
par exemple — garde « Revenir », qui refuse : « Cet instant a déjà le contenu
courant ». En tête du panneau, un champ nomme l'instant courant — la
saisie n'écrit rien, seul « Nommer » écrit —, et la case « Instants nommés
seulement » ne garde que les lignes qui portent un jalon. La liste se pagine
par cent lignes. Quand le journal et l'état sur le disque ne finissent pas au
même instant — l'un en avance sur l'autre, ou le journal absent —, le panneau
le dit, sans marquer d'instant courant : le prochain geste inscrit l'entrée de
reprise (§ 8.8). **En lecture, la vue se lit** ; « Revenir »,
« Nommer », « Défaire » et « Refaire » refusent à côté de leur commande, et
leurs touches à côté de « Défaire », avec « Modifier » pour remède (§ 8.4).

**Au clavier**, sur l'écran de l'événement et hors d'une saisie, **Ctrl+Z
défait, Ctrl+Maj+Z et Ctrl+Y refont**. Dans un champ, Ctrl+Z défait la frappe,
comme partout, et jamais le plan. Une touche tenue ne défait qu'une fois. Un
menu d'actions ouvert, une fenêtre à confirmer, un pointeur enfoncé ou un
fichier d'un format plus récent (§ 8.8) laissent la touche sans effet. Le
refus d'une touche — en lecture, ou sans rien à défaire ou à refaire — se pose
à côté de « Défaire », pour les trois touches : « Refaire » n'est dans la
barre que lorsqu'un retour reste à refaire.

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
l'ajustement, le plein écran, la mise en évidence, l'affichage des listes et
des organisations qu'elles portent, la **page de qualité** (§ 12), la
comparaison de deux placements et le choix du second, le choix d'un départ et
des tours à figer (§ 5.7), la lecture de l'historique, l'impression, et la
**production de la planche de badges**, qui n'écrit aucun fichier d'événement
(§ 11.6). C'est la condition pour que la protection tienne : si naviguer
exigeait de passer en écriture, l'opérateur y resterait en permanence et le
mode lecture ne protégerait plus rien.

**On en sort par un seul geste délibéré** — une commande « Modifier » à place
fixe — et le logiciel y retourne **seul après dix minutes d'inactivité**. Ce
retour ne coûte rien et ne perd rien, puisque tout geste achevé est déjà sur le
disque. En lecture, « Modifier » est l'action principale de l'écran ; « Revenir
en lecture » et « Débloquer », à la même place, ne le sont pas.

**Le compteur d'inactivité ne court pas pendant un geste** : il est suspendu
tant qu'un pointeur est enfoncé, qu'un champ contient une saisie non validée ou
qu'un calcul tourne. Le retour **automatique** ne peut donc jamais tomber
pendant un geste ; le retour **explicite**, lui, annule un glissement en cours
comme le ferait un `pointercancel`.

**Est une activité la fin d'un geste**, qui relance le compte : un geste achevé
ou refusé, une saisie validée ou abandonnée, une fenêtre à confirmer refermée,
et tout appui relâché sur le plan — un clic qui n'exécute rien et un déplacement
de vue compris. Regarder sans appuyer n'en est pas une : zoomer à la molette,
une commande de vue, changer de tour affiché ne relancent rien. Le retour
automatique se voit à la bande de mode, au libellé de mode et au bandeau, et un
avertissement non modal le dit jusqu'au passage en écriture suivant.

**Le mode est visible sans quitter la surface de travail des yeux**, et non dans
un coin de barre d'outils : l'opérateur regarde le plan. Sous le bandeau, quand
un plan est ouvert, une **bande de mode** court de bord à bord de la fenêtre et
dit le mode : son icône, son libellé, et une phrase qui dit ce qu'il permet en
nommant la commande de la place fixe qui en sort — « Modifier » en lecture,
« Revenir en lecture » en écriture, « Débloquer » sur un plan bloqué, et aucune
devant un fichier d'un format plus récent (§ 8.8), qui n'en offre pas —, sur le
fond de sa couleur. D'une hauteur constante, elle le dit dès l'entrée dans
l'écran. Le **libellé de mode**, une pastille à côté de la place fixe, le redit
là où la main agit. **Aucun cadre n'entoure la surface de travail** : l'écran de
l'événement prend **toute la largeur de la fenêtre**, à son retrait près, sans
la largeur de page qui borne la liste des événements, et le plan garde chaque
pixel que la bande et la barre lui laissent.

S'y ajoute un **bandeau d'application présent sur tout écran**, qui porte la
version et la provenance de la construction (§ 18.6) et, **quand un plan est
ouvert**, le libellé de mode. Ils ne font pas double emploi : la bande et le
libellé de la barre signalent le mode dans l'écran de l'événement ; le bandeau
porte la version jusque sur la liste des événements, qui est le premier écran
d'un signalement sur deux. Le bandeau porte aussi la marque du logiciel,
« Paramètres » — la taille du texte et le thème (§ 18.6) — et, à sa droite,
« À propos » ; à la taille du texte par défaut, il garde une hauteur d'une
ligne de commande, de sorte que la surface de travail ne perd rien ; aux
paliers plus grands, il peut passer sur deux lignes (§ 18.6). « Paramètres »
et « À propos » sont des boutons bascule : un clic ouvre le panneau, un
second le referme. La commande du panneau ouvert est en surbrillance — un
fond plein, un soulignement épais qui ne tient pas à la couleur seule — et
se dit enfoncée aux technologies d'assistance ; ouvrir ou refermer un
panneau ne déplace pas le bandeau d'un pixel.

**Le passage en écriture est une étape nommée du parcours** (§ 2.1, étape 1b),
et non un sous-entendu : huit des douze étapes sont modifiantes, et toutes sont
refusées tant qu'il n'a pas eu lieu.

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

**Le cadrage se range avec le mode, hors du fichier** — dans un **fichier de
réglages locaux**, `reglages_locaux.json` à la racine du dossier de travail
(§ 8.6), distinct des fichiers d'événements. Écrire le zoom dans le fichier
d'état contredirait l'équivalence du § 8.2, et **zoomer sur un plan bloqué
écrirait dans le fichier d'un plan qui refuse toute modification**. Ce réglage
n'est ni transmis avec le fichier, ni restitué par un retour arrière.

Ce fichier porte **dix choses, et dix seulement** :

| réglage | portée |
|---|---|
| le **cadrage** | indexé par identifiant d'événement |
| le **format de papier** (§ 11.2) | global à la machine |
| le **modèle de badge** (§ 11.2), clé `modele_badge` | global à la machine |
| la **case du pied TechnoLibre** des badges (§ 11.4), clé `pied_technolibre` | globale à la machine |
| le **texte du pied TechnoLibre** (§ 11.4), clé `texte_pied_technolibre` | global à la machine |
| les **cases de ce que le badge imprime** (§ 11.4), clé `donnees_badge` | globales à la machine |
| la **case qui laisse en blanc le nom des doublons** (§ 11.4), clé `cacher_numero_doublon` | globale à la machine |
| la **case qui met l'organisation en gros au-dessus du nom** (§ 11.4), clé `organisation_en_gros` | globale à la machine |
| les **colonnes de la liste des badges en CSV** (§ 11.6), clé `colonnes_liste_badges` | globales à la machine |
| la **taille du texte de l'écran** (§ 18.6), clé `taille_texte` | globale à la machine |

Le format de papier décrit le bac de l'imprimante, pas le plan : l'écrire dans
le fichier d'événement ferait voyager le bac d'un bureau avec le plan. Le
logiciel le demande au premier aperçu d'impression — la première ouverture de la
section de l'impression, dont le titre « Plan » porte l'aperçu, même quand on
n'y vient que pour les badges — et ne le redemande plus ; les badges ne le
demandent jamais, et partent sur Lettre tant qu'aucun papier n'est choisi, sans
le retenir (§ 11.2). La section de l'impression, pour l'A6, et l'aperçu le
montrent, et il se change d'un geste. La question offre chaque papier comme un
choix distinct, d'un geste. Le redemander chaque fois apprend à cliquer sans
lire (§ 5.9). Le choix s'écrit dans tout mode, en lecture et sur un plan
bloqué : c'est un réglage de la machine, pas une modification de l'événement. En
mode portable (§ 8.6), ce fichier suit la clé avec les événements.

**Le cadrage s'écrit en différé**, et échappe nommément à la règle « fin du
geste, jamais un minuteur » du § 8.2 : un zoom continu écrit une fois par délai,
jamais à chaque image. **Le papier s'écrit au geste qui le choisit.** Le
cadrage, le papier, le modèle de badge, la case du pied TechnoLibre et son
texte, les cases de ce que le badge imprime, celle du nom des doublons,
celle de l'organisation en gros, les colonnes de la liste et la taille du
texte passent par une même file, qui relit le fichier avant chaque
écriture : deux écrivains qui le liraient chacun avant que l'autre l'ait
écrit perdraient le réglage de l'un.
Un fichier que la lecture ne prend pas ne s'écrase pas ; son avertissement
dit pourquoi en clair — un texte qui n'est pas du JSON, une valeur hors de sa
règle, des octets qui ne sont pas de l'UTF-8, un lien qui mène hors du dossier
de travail, une lecture que le système refuse, la cause qu'il donne entre
parenthèses —, jamais par le code interne du refus. Ni lui, ni un dossier
qui refuse de l'écrire, ne bloque le choix du papier : le papier choisi vaut
pour la séance sur ce dossier de travail, sans être retenu sur la machine, et un
avertissement nomme le fichier et dit que le choix n'est pas retenu ; la
première écriture des réglages qui y réussit le retient, et l'avertissement se
retire. Le cadrage attend. Le papier se relit à chaque changement de dossier de
travail, écrire ailleurs compris, que l'écriture y réussisse ou que le support
y refuse l'état (§ 8.6) : l'écran ne montre le nouveau dossier qu'avec son
papier, jamais avec celui de l'ancien, pas même quand un choix fait pour
l'ancien finit de s'écrire pendant le changement.

**Le modèle de badge** décrit le support que la machine garnit — des cartes
Avery 5392 prédécoupées, ou des A6 à découper (§ 11.2) —, pas le plan. Le
fichier ne le porte que choisi ; sans lui, les badges partent sur Avery 5392,
qui impose le papier Lettre, sans rien demander : le papier choisi pour l'aperçu
ne change pas pour autant, et il reste partagé avec les badges A6. Une valeur
présente hors des deux modèles rend le fichier illisible, comme un papier
inconnu, et une construction qui ne connaît pas la clé la garde telle quelle. Le
modèle se choisit dans la section de l'impression, s'écrit au geste qui le
choisit, dans tout mode, par la même file, et se relit comme la taille du
texte : au lancement, puis à chaque changement de dossier de travail, celui que
le fichier porte, à défaut celui de la séance. Un fichier que la lecture ne
prend pas, ou un dossier qui refuse de l'écrire, ne bloque pas le choix : le
modèle vaut pour la séance, et la section dit, sous ses réglages, qu'il n'est
pas retenu sur ce poste.

**La case du pied TechnoLibre** dit si les badges de la machine portent le pied
de l'éditeur (§ 11.4) : un choix de la machine qui les imprime, pas du plan. Le
fichier ne la porte que touchée, un booléen ; sans elle, la case est cochée. Une
valeur présente qui n'est pas un booléen rend le fichier illisible, comme un
papier inconnu. Elle se coche et se décoche dans la section de l'impression,
sous les deux modèles, s'écrit au geste, dans tout mode, par la même file, et se
relit comme le modèle de badge ; un fichier que la lecture ne prend pas, ou un
dossier qui refuse de l'écrire, ne bloque pas le choix : la case vaut pour la
séance, et la section dit, sous ses réglages, qu'elle n'est pas retenue sur ce
poste.

**Le texte du pied TechnoLibre** remplace, sur les badges de la machine, la
phrase d'origine du pied (§ 11.4) : un choix de la machine qui les imprime,
comme la case. Il se saisit dans la section de l'impression, dans un champ de
quelques lignes sous la case, prérempli de la phrase d'origine et désactivé
tant que la case est décochée ; « Texte par défaut » la remet. Il se garde
**normalisé** : en NFC, chaque suite d'espaces, de tabulations ou de sauts de
ligne ramenée à une espace, les blancs de bord retirés — la mise en page replie
le texte d'elle-même, et un saut de ligne saisi n'est pas garanti sur le
badge. Le fichier ne le porte que s'il diffère de la phrase d'origine, une
chaîne sous `texte_pied_technolibre` ; sans elle, la phrase d'origine vaut, et
revenir à celle-ci retire la clé. Une valeur présente qui n'est pas une chaîne
rend le fichier illisible, comme un papier inconnu. Le texte s'écrit quand le
champ se quitte, jamais à chaque frappe, dans tout mode, par la même file. Il
se relit au lancement, puis à chaque changement de dossier de travail : celui
que le fichier porte, à défaut la phrase d'origine, car un fichier lu sans la
clé la désigne — le texte d'un autre dossier ne s'y applique pas. Seuls un
fichier que la lecture ne prend pas, l'absence de dossier, ou un choix fait
pendant la relecture laissent celui de la séance. Un fichier que la lecture ne
prend pas, ou un dossier qui refuse de l'écrire, ne bloque pas le choix : le
texte vaut pour la séance, et la section dit, sous ses réglages, qu'il n'est
pas retenu sur ce poste.

**Les cases de ce que le badge imprime** — « Organisation », « Nom de
l'événement », « Date de l'événement », « Date du placement », « Identifiant »
(§ 11.4) — sont, comme celle du pied TechnoLibre, un choix de la machine qui
imprime. Le fichier les porte sous `donnees_badge`, un objet d'un booléen par
donnée — `organisation`, `evenement`, `date`, `horodatage`, `identifiant` —, qui
n'existe que touché et ne porte que les cases touchées ; une case absente est
cochée. Un objet qui n'en est pas un, ou une case connue qui n'est pas un
booléen, rend le fichier illisible, comme un papier inconnu ; une clé inconnue
de l'objet se garde telle quelle. Chaque case se coche et se décoche dans la
section de l'impression, sous les deux modèles, s'écrit au geste, dans tout
mode, par la même file, et se relit comme le modèle de badge, chacune pour
elle-même : une case que le fichier ne porte pas garde celle de la séance. Un
fichier que la lecture ne prend pas, ou un dossier qui refuse de l'écrire, ne
bloque pas le choix : la case vaut pour la séance, et la section dit, sous ses
réglages, que les cases ne sont pas retenues sur ce poste. Chaque écriture ne
porte que sa case : une écriture qui réussit pour une case n'en retient pas une
autre, et l'avertissement reste tant qu'une case non retenue garde la valeur
choisie, jusqu'à ce qu'un choix de cette case soit retenu.

**La case qui laisse en blanc le nom des doublons** — « Laisser le nom des
doublons en blanc » (§ 11.4) — est, comme celle du pied TechnoLibre, un
choix de la machine qui imprime, et non une sixième donnée de
`donnees_badge` : cochée, elle vide la place d'un nom au lieu d'y garder
une donnée. Le fichier ne la porte que touchée, un booléen sous
`cacher_numero_doublon` ; sans elle, la case est cochée. Une valeur présente
qui n'est pas un booléen rend le fichier illisible, comme un papier inconnu.
Elle se coche et se décoche dans la section de l'impression, sous les deux
modèles, s'écrit au geste, dans tout mode, par la même file, et se relit
comme la case du pied TechnoLibre ; un fichier que la lecture ne prend pas,
ou un dossier qui refuse de l'écrire, ne bloque pas le choix : la case vaut
pour la séance, et la section dit, sous ses réglages, qu'elle n'est pas
retenue sur ce poste.

**La case qui met l'organisation en gros au-dessus du nom** — « Organisation
en gros, au-dessus du nom » (§ 11.4) — est, comme celle du pied TechnoLibre,
un choix de la machine qui imprime, et non une sixième donnée de
`donnees_badge` : cochée, elle échange la place de deux données au lieu d'en
retirer une. Le fichier ne la porte que touchée, un booléen sous
`organisation_en_gros` ; sans elle, la case est cochée. Une valeur présente
qui n'est pas un booléen rend le fichier illisible, comme un papier inconnu.
Elle se coche et se décoche dans la section de l'impression, sous les deux
modèles, s'écrit au geste, dans tout mode, par la même file, et se relit
comme la case du pied TechnoLibre ; un fichier que la lecture ne prend pas,
ou un dossier qui refuse de l'écrire, ne bloque pas le choix : la case vaut
pour la séance, et la section dit, sous ses réglages, qu'elle n'est pas
retenue sur ce poste.

**Les colonnes de la liste des badges en CSV** — « Une colonne par tour » ou
« Une seule colonne » (§ 11.6) — sont, comme le modèle de badge, un choix de
la machine : elles décrivent le tableur qui reçoit la liste, pas le plan. Le
fichier ne les porte que choisies, sous `colonnes_liste_badges`, `parTour` ou
`unique` ; sans elles, une colonne par tour. Une autre valeur rend le fichier
illisible, comme un papier inconnu. Elles se choisissent dans la section de
l'impression, s'écrivent au geste, dans tout mode, par la même file, et se
relisent comme le modèle de badge ; un fichier que la lecture ne prend pas, ou
un dossier qui refuse de l'écrire, ne bloque pas le choix : il vaut pour la
séance, et la section dit, sous ses réglages, qu'il n'est pas retenu sur ce
poste.

**La taille du texte de l'écran** se choisit dans le panneau « Paramètres »
(§ 18.6), en paliers : 90, 100, 115, 130 et 150 %, une seule définition dans
le code. Elle décrit les yeux de l'opérateur et l'écran du poste, pas le plan :
elle ne voyage pas avec l'événement. Le fichier ne la porte que choisie ; sans
elle, l'écran est à 100 %, et un fichier écrit sans ce choix ne change pas d'un
octet. Une valeur présente hors des paliers rend le fichier illisible, comme un
papier inconnu. Elle s'écrit au geste qui la choisit, dans tout mode, par la
même file que le cadrage et le papier, et emporte avec elle le papier de la
séance que le fichier ne retenait pas encore. Le logiciel la relit au lancement,
dès que le dossier de travail est déterminé, puis à chaque changement de dossier
de travail : la taille que le fichier porte, à défaut celle de la séance, de
sorte qu'un dossier sans réglages ne ramène pas l'écran à 100 %. Une relecture
partie avant un choix ne l'écrase pas. Ni un fichier que la lecture ne prend
pas, ni un dossier qui refuse de l'écrire, ni l'absence de dossier de travail —
une question du § 8.6 encore sans réponse — ne bloquent le choix : la taille vaut
pour la séance, et le panneau dit, sous les paliers, qu'elle n'est pas retenue
sur ce poste.

### 8.6 Les fichiers

**Emplacement.** Ces règles sont des propriétés de l'implémentation
**`electron`**, celle qui est livrée. Sous `web`, « à côté de l'exécutable »
ne désigne rien, et la plateforme l'annonce déjà au démarrage (§ 8.8).

Le logiciel détermine son **dossier de travail une fois par séance**, par une
règle écrite, et l'affiche :

1. Il calcule le dossier de l'exécutable **à partir du chemin que le lanceur
   portable publie**, jamais à partir du chemin du processus en cours
   d'exécution. Un exécutable portable est une archive auto-extractible : le
   processus tourne depuis un dossier temporaire que le système efface, et un
   `data/` créé là emporterait la soirée sans un message. **Que le lanceur
   publie bien ce dossier, et sous quel nom, se vérifie dès la première
   semaine**, au même titre que la construction depuis Linux (§ 16).
2. Si ce dossier se trouve sous un emplacement de **données applicatives par
   utilisateur** — `AppData` et ce qu'il contient, un dossier temporaire —, la
   règle **s'arrête ici** et le logiciel passe au point 5. Un installateur qui
   rangerait l'exécutable sous `AppData` y ferait réussir l'épreuve d'écriture,
   et le logiciel créerait son dossier de données exactement là où cette section
   l'interdit. Le livrable est pour cette raison un **exécutable portable à
   fichier unique, non un installateur** (§ 16).
3. Sinon, le logiciel **éprouve l'écriture** dans `data/` à côté de
   l'exécutable, qu'il crée au besoin : il écrit un fichier témoin, le relit,
   l'efface, et efface un témoin resté d'une séance précédente. Un contrôle de
   droits ne répond pas à la question posée — les droits effectifs dépendent
   d'héritages, des groupes du compte, de stratégies d'antivirus, et un
   support amovible en lecture seule présente un dossier d'apparence
   inscriptible. Une écriture suivie d'une relecture répond.
4. L'épreuve réussit → `data/` est le dossier de travail. C'est le **mode
   portable** : l'exécutable et les événements se déplacent ensemble, et la
   sauvegarde est la copie d'un seul dossier.
5. L'épreuve échoue, ou le point 2 l'a interrompue → le dossier de travail est
   le dossier `data` d'un dossier nommé d'après le produit, dans les
   *Documents* de l'opérateur : `Documents\<produit>\data`. Le logiciel **dit
   pourquoi**, une fois par séance, sans bloquer : s'en souvenir d'une séance à
   l'autre demanderait un réglage local de plus, et le § 8.5 les borne à huit.

Dans les deux modes, le dossier de travail s'appelle donc `data`. Il porte les
événements et, à côté d'eux, la corbeille (§ 8.7), le fichier des réglages
locaux (§ 8.5) et, le temps d'une épreuve d'écriture, le fichier témoin. Sous
`web`, il est la racine du stockage de la page, sans `data`, et suit les mêmes
règles. Un dossier désigné pour écrire ailleurs devient le dossier de travail
de la séance, de la même façon.

**Le dossier retenu est éprouvé à son tour, et c'est cette épreuve qui le
crée** : le dossier des *Documents* naît à la détermination, avant que la liste
des événements s'ouvre, et non à la première écriture. Aucun geste ne crée
ensuite le dossier où il écrit : un dossier de travail qui disparaît en cours de
séance ne renaît pas vide, en silence. Si l'épreuve échoue, le logiciel le dit
avant d'ouvrir la liste, puisqu'aucun geste ne s'y écrirait.

**Ce qui arrive ensuite est aussi réglé.**

- Si `data/` existe, **contient des événements** et cesse d'être inscriptible, le
  logiciel **ne bascule pas en silence** : il nomme le dossier, dit ce qui
  l'empêche, et demande. Basculer en silence ouvrirait sur une liste où le plan
  de la veille a disparu, et l'opérateur conclurait à une perte.
- La même règle vaut **en cours de séance**, pas seulement au démarrage : une clé
  se retire. Quand une écriture échoue, le logiciel nomme le fichier et le
  dossier, et propose d'écrire ailleurs, dans un dossier qu'il crée au besoin
  puisque l'opérateur l'a désigné. Il énonce alors que l'équivalence du
  § 8.2 est rompue **par le support**, au lieu de laisser croire que le dernier
  geste est sur le disque.
- Si le dossier de travail est neuf et vide alors que l'autre emplacement
  contient des événements, le logiciel le dit et propose de les importer (§ 8.7)
  plutôt que d'ouvrir sur la commande de création (§ 8.1). L'import **copie** :
  le logiciel annonce que les originaux restent où ils sont, sinon deux copies du
  même événement dérivent sous le même identifiant interne. Un dossier de
  travail qui refuse l'écriture ne le propose pas : la copie y échouerait, et
  la question posée avant d'ouvrir la liste, ou à défaut la première écriture
  refusée, nomme ce refus.
- **Le mode portable affaiblit une garantie du § 8.8** sur un support amovible,
  et le logiciel l'annonce.

**Dans les deux modes, le logiciel affiche le chemin du dossier de travail en
clair dans la liste des événements**, et une commande l'ouvre dans l'explorateur.
Sous `electron`, hors de Windows et de macOS, l'explorateur s'ouvre par
l'ouvreur du bureau, dont la coquille attend l'issue. Une ouverture qui échoue
le dit à côté de la commande — l'ouverture a échoué, avec la raison que donne
le système —, et la commande reste offerte : elle n'est pas absente, comme
sous `web`.

Ce que cette section défend n'est pas l'emplacement *Documents* : c'est que
l'opérateur puisse copier un événement sur une clé, le joindre à un courriel et
le restaurer depuis sa sauvegarde **sans le logiciel**. Cette propriété tient
dans les deux modes, parce qu'elle vient de la **forme** — des fichiers
ordinaires dans un dossier ordinaire, sans base de données ni format
propriétaire — et non du chemin.

Ce que le logiciel refuse, inchangé : **jamais de répertoire de données caché**,
jamais `AppData`, jamais un emplacement que l'opérateur ne peut pas nommer.

**Le profil de Chromium n'est pas un répertoire de données.** Chromium,
qu'emporte la coquille Electron, range par défaut son profil — cache,
préférences, stockage de la page — dans un dossier persistant des données
applicatives de l'utilisateur. Le logiciel n'y garde rien : la coquille pose ce
profil dans un dossier neuf du dossier temporaire du système, et l'efface à la
sortie ; chaque démarrage efface aussi ceux des séances terminées, que Chromium
a récrits après la sortie ou qu'une séance coupée a laissés. Un exécutable
portable ne laisse ainsi, hors du dossier de travail, rien qui survive à la
séance suivante.

**Un dossier par événement.** Chaque événement a son dossier, directement sous
le dossier de travail, à côté de la corbeille et du fichier des réglages
locaux ; le logiciel le nomme du nom de ses fichiers (`<nom>/`) et le crée
avant d'y écrire quoi que ce soit — une création coupée juste après lui laisse
un dossier vide, qui ne se liste pas et garde son nom. Le nom d'un événement
neuf évite le nom de chaque entrée du dossier de travail, dossier ou fichier.
La liste des événements lit chaque dossier du dossier de travail, hors la
corbeille ; un dossier sans fichier d'état ni journal ne s'y montre pas, ni un
dossier dont le système refuse la liste — un dossier système à la racine d'un
volume —, qui ne fait pas échouer celle des autres ; pour la règle de `data/`
ci-dessus, un tel dossier peut contenir des événements. **Des fichiers
d'événement posés à même le dossier de travail**, sans dossier — ceux d'une
version qui les rangeait ainsi —, **ne se lisent pas** : ni listés, ni ouverts,
ni importés, ni supprimés, ils restent tels quels. Un état s'apparie à
son journal **dans son dossier** ; deux états du même identifiant interne,
dans un dossier ou dans deux, se signalent doublons l'un de l'autre, et un
journal sans état se tait quand un état lisible d'un dossier porte son
identifiant.

**Deux fichiers par événement, le compagnon des courses et l'aperçu de la
liste**, dans son dossier :

| fichier | contenu | écriture |
|---|---|---|
| `<nom>/<nom>.gtt.json` | l'état courant, complet | réécrit en entier à chaque entrée |
| `<nom>/<nom>.gtt-journal.jsonl` | les entrées d'historique | **ajout en fin**, une ligne par entrée ; réécrit en entier, de façon atomique, après des lignes écartées |
| `<nom>/<nom>.gtt-courses.json` | la course de la recherche de chaque proposition (§ 5.10) : ses mouvements évalués et les placements de ses points de relevé | réécrit en entier, de façon atomique, après l'état, **seulement quand les propositions changent** — une génération, un effacement, un retour qui en rend ou en retire — ; jamais à un autre geste |
| `<nom>/<nom>.gtt-apercu.json` | les deux résumés que la liste des événements montre (§ 8.1), avec l'empreinte des textes dont ils viennent | écrit en entier, de façon atomique, **par la liste seule**, quand elle recalcule un aperçu absent ou périmé ; jamais par un geste |

Les deux portent **l'identifiant interne de l'événement**, et c'est lui qui les
apparie — jamais leurs noms.

**L'aperçu de la liste** suit le nom du fichier d'état et ne porte que des
nombres : aucun nom, aucun identifiant d'événement. Il tient en une ligne de
JSON, `{"format":1,"produit":…,"empreinte":…,"mesuresDuRetenu":…,
"meilleureDuClassement":…}` — son propre format, la construction du logiciel
qui l'a calculé, l'empreinte, `mesuresDuRetenu`, `{collisionsCumulees,
rencontresRepetees}` ou null, et `meilleureDuClassement`, `{id}` ou null,
les valeurs que la liste montre (§ 8.1). L'empreinte est FNV-1a 64 bits sur
les octets UTF-8 du texte de l'état, puis sur ceux de la dernière ligne
complète du journal que l'ouverture lit, « - » sans elle, deux moitiés jointes
par « : » : un geste réécrit l'état, et un journal en avance d'une entrée, que
l'ouverture rattrape, change sa dernière ligne. Ni le compagnon des courses, ni
l'état précédent, ni le verrou n'y entrent : les deux résumés n'en dépendent
pas. Elle n'est pas cryptographique, et se calcule sans interface
asynchrone, aussi hors d'un contexte sécurisé. **L'aperçu ne bloque jamais
rien** : illisible, d'une autre forme, d'un autre format ou d'une autre
construction, il vaut absent, sans erreur ni avis, et la liste le recalcule ;
un aperçu resté seul dans un dossier ne fait pas une ligne et ne passe jamais à
un autre événement ; le relevé du dossier de travail l'ignore comme le
compagnon des courses.

**Le compagnon des courses** suit le nom du fichier d'état, et porte lui aussi
l'identifiant de l'événement. Il garde ce que la recherche a rapporté
d'elle-même (§ 5.10), que ni le fichier d'état ni le journal ne portent : une
course pèse environ cinq fois sa proposition, et chaque geste, qui réécrit
l'état en entier (§ 8.2), en paierait le poids. À part, elle ne coûte qu'à la
génération qui la produit.

Sa première ligne porte son propre format, 1, et l'identifiant de l'événement ;
puis une ligne par proposition,
`{id, graine, arret, historique, horodatage, empreinte, course}`, puis la
fermeture. `horodatage` est celui que la génération a posé sur la proposition
(§ 8.9), absent quand elle n'en porte pas. `empreinte` est un entier de 0 à 2⁵³
− 1, l'empreinte du texte canonique du placement de la proposition (§ 8.9) : sa
réserve et ses absents rangés par identifiant croissant, chaque liste de table
aussi quand `siegesAttribues` est faux ; ni l'horodatage ni la version qui l'a
produite n'y entrent. Elle n'est pas cryptographique : elle départage deux
placements qui partagent déjà les autres champs. `course` porte :

| clé | forme |
|---|---|
| `evalues` | entier, de 0 à l'`arret` de la proposition : ses mouvements évalués |
| `releves` | liste d'un objet `{mouvements, placement}` par puissance de dix strictement inférieure à `evalues`, dans l'ordre croissant : `mouvements` vaut exactement 1, puis 10, puis 100… ; la liste est vide quand `evalues` vaut 0 ou 1. `placement` a la forme positionnelle de celui de la proposition (§ 8.9), sur ses tables, ses capacités, son nombre de tours et ses participants déclarés, mis en forme sous son drapeau `siegesAttribues` exactement comme celui de la proposition : sièges attribués, rangé par siège, chaises vides et sièges réservés compris |

Le dernier point de relevé, à `evalues` mouvements, est le placement de la
proposition : il ne s'écrit pas deux fois. La course ne porte rien d'autre :
aucune valeur mesurée — la page de qualité mesure chaque point sous les réglages
courants (§ 12.14) —, ni durée, ni cadence, qui valent pour la séance (§ 5.10).
Une génération écrit la course de chaque proposition qu'elle ajoute,
`{"evalues":0,"releves":[]}` quand le plan initial n'avait rien à reprendre. Le
retenu n'en a pas : il lit celle de la proposition d'où il vient, tant qu'elle
est dans la liste. La course d'une proposition dérivée est celle de sa propre
descente, partie du plan de son départ : ses points de relevé ne comptent pas
les mouvements qui ont produit le départ, et son entrée porte la même clé que
toute autre.

**Une entrée ne vaut que pour sa proposition** : celle de l'état qui porte
exactement son identifiant, sa graine, son compte d'arrêt, son historique, son
horodatage — ou n'en porte pas, comme l'entrée — et l'empreinte de son
placement. Les quatre premiers ne suffisent pas à désigner une recherche : le
compteur des propositions recule quand l'opérateur reprend un état d'avant une
génération (un `.precedent`), et la graine proposée peut être la même ; après un
changement qui laisse la déclaration intacte — une organisation, une
réservation, un réglage —, la recherche suivante porte les mêmes quatre champs
et une autre course, qui finit sur un autre placement **ou sur le même**.
L'empreinte seule ne départage donc pas deux recherches ; l'horodatage, que la
génération pose une fois sur chaque proposition à la seconde de son horloge et
que les gestes suivants gardent, les départage. Deux recherches ne se confondent
que générées sous la même graine à la même seconde de leurs horloges, et finies
sur le même placement à une collision d'empreinte près : la course de l'une ne
se prête pas à la proposition de l'autre, et un retour à la première génération
réécrit le compagnon. Une proposition sans horodatage — d'un état écrit avant
que la génération ne date ses propositions — n'est reconnue qu'aux quatre champs
et à l'empreinte : deux recherches de même identité qui finissent sur le même
placement s'y confondent, et l'une peut recevoir la course de l'autre. Une
entrée périmée — laissée par une coupure entre l'état et le compagnon, par une
copie à la main, par une autre recherche de même identité — ne trouve pas sa
proposition et s'ignore. Une entrée d'une autre forme, ou dont la course
contredit sa proposition — un `evalues` hors de ses bornes, une abscisse
manquante, en trop ou hors d'ordre, un placement de relevé dont les chaises
vides, les longueurs ou le multiensemble des identifiants, réserve et absents
compris, contredisent la déclaration de la proposition, ou des absents qui ne
sont pas ceux de la proposition à ce tour —, s'ignore seule, les autres
gardées. La course se contrôle contre sa proposition à la lecture du compagnon,
et de nouveau quand la page de qualité la lit : **une course contradictoire
n'atteint jamais le détail**.

**Le compagnon ne bloque jamais rien.** Ce qu'il porte se dérive de la
recherche, jamais de l'opérateur : absent, illisible, aux octets hors UTF-8,
d'un autre format ou d'un autre événement, il laisse inconnues les courses qu'il
ne confirme pas ; l'événement s'ouvre et s'écrit, et la page de qualité dit que
la course n'est pas gardée. Un fichier écrit avant le compagnon, ou par une
version antérieure, n'en a pas : ses propositions n'ont pas de course connue. Un
refus d'écrire le compagnon ne refuse pas le geste : l'état et le journal sont
écrits, la course reste connue pour la séance, et l'écriture suivante qui change
les propositions le pose.

**Il ne s'écrit que quand les propositions changent** : le logiciel écrit les
courses qu'il connaît des propositions de l'état, et seulement quand elles ne
sont plus celles que le compagnon porte — après une génération, un effacement,
un retour qui rend ou retire des propositions. Il garde pour la séance les
courses lues et celles de ses générations, même d'une proposition retirée : un
retour qui la rend retrouve sa course et la réécrit. Après une réouverture, une
proposition effacée puis rendue par un retour n'a plus de course connue.

**Ce qu'il coûte.** Sur la grande démonstration — 1 040 places par
proposition —, une course au compte d'arrêt de 200 000 mouvements porte six
placements de relevé, de l'ordre de 25 ko ; vingt propositions, de l'ordre de
0,5 Mo, deux cents, de l'ordre de 5 Mo. Il s'écrit au plus une fois par
génération, et sa lecture ne coûte qu'à l'ouverture.

**Le nom du fichier dérive du nom de l'événement** — un dossier d'identifiants
opaques est inutilisable dans un explorateur. La dérivation retire les
caractères que Windows refuse, **refuse les noms réservés quelle que soit la
casse**, **compare les collisions sans égard à la casse** (le système de
livraison y est insensible, celui de développement non), **borne le chemin
complet sur le plus long chemin que l'événement écrit**, et **retombe sur un nom
générique** quand la dérivation ne laisse rien. Elle **écarte aussi les noms
des entrées que le dossier de travail porte à côté des événements** —
`corbeille`, `reglages_locaux.json`, `.gtt-temoin` —, sans égard à la casse :
un nom qui y tombe prend le rang `(2)`, comme une collision, et aucun dossier
d'événement ne prend la place de la corbeille.

Le plus long chemin assemble les plus longues parties qu'un fichier de
l'événement peut porter. Le plus long suffixe est celui de la planche de badges
sans marque (§ 11.6), `.badges-9999_<papier>_feuille_<date>.pdf`, cinquante et
un caractères ; l'écriture atomique (§ 8.8) le prolonge de `.ecriture`. Dans le
dossier de l'événement, qui porte le nom de sa base, le nom compte deux fois :
`<nom>/<nom>.badges-…pdf.ecriture`, soixante et un caractères outre les deux
noms. Dans la corbeille (§ 8.7), le dossier daté porte directement les fichiers,
au rang de collision le plus long — deux suppressions dans la même seconde se
départagent par `_2`, `_3`… jusqu'à `_99` — :
`corbeille/AAAA-MM-JJ_HH-MM-SS_99/<nom>.badges-…pdf.ecriture`,
quatre-vingt-treize caractères outre le nom, compté une fois. Le logo d'une
personne, `logo/<empreinte>.png`, nommé par les 64 chiffres hexadécimaux de
l'empreinte SHA-256 de son contenu, compte soixante-treize caractères qui ne
dépendent pas du nom : dans le dossier de l'événement, en écriture atomique,
quatre-vingt-trois outre le nom, toujours moins que la corbeille ; dans le
dossier daté de la corbeille, où la suppression le déplace sans écriture,
`corbeille/AAAA-MM-JJ_HH-MM-SS_99/logo/<empreinte>.png`, cent six caractères,
sans le nom. Le plus long des trois borne le nom : le logo sous treize
caractères, la corbeille de treize à trente-deux, le dossier de l'événement
au-delà. Le logo pose ainsi un plancher : une racine de plus de cent
cinquante-deux caractères ne laisse tenir aucun nom, et la plus longue qui en
laisse un lui en donne treize ; l'empreinte reste entière, car raccourcie elle
laisserait deux images différentes prendre le même nom. `.gtt.json.precedent` ne
compte que dix-neuf caractères, `.gtt-journal.jsonl` dix-huit,
`.gtt-courses.json` dix-sept, `.gtt-apercu.json` seize, et `.gtt.json` neuf :
une borne posée sur l'état, sur le journal ou sur le nom compté une fois
laisserait déborder tout le reste. Sous une racine de soixante et un caractères,
celle du dossier `data` des *Documents* d'un compte au nom court, la borne
laisse 68 caractères au nom, la borne de la saisie (§ 8.1). Une racine plus
longue — un nom de compte long, un dossier synchronisé —, ou un caractère hors
du plan de base, qui pèse deux unités, raccourcissent encore la base : **la
dérivation reçoit la racine du dossier de travail en paramètre**, celle-ci
n'étant plus connue à l'écriture du code, et son test l'exerce sur les deux
issues. **L'autorité reste le nom inscrit dans le fichier.**

**Pourquoi l'historique n'est pas dans le fichier d'état**, pour deux raisons
distinctes. *La taille* : un plan de 260 personnes sur 4 tours pèse de l'ordre
de 250 ko avec une vingtaine de propositions ; 500 entrées en instantanés
complets pèseraient **de l'ordre de 125 Mo** — d'où les **correctifs**, avec un
instantané tous les cinquante au plus, pour qu'aucune restitution ne demande
plus de cinquante applications. *Le couplage* : un journal illisible n'empêche
jamais d'ouvrir le plan ; transmettre un plan ne transmet pas quatre cents
gestes portant les noms des personnes retirées ; vider l'historique est le
remplacement d'un fichier.

> **Ces ordres de grandeur ne valent que sous la forme positionnelle du § 8.9.**
> Sous une forme nommée par place, le fichier d'état dépasse le mégaoctet — et ce
> n'est pas l'historique qui casse alors, c'est le § 8.2, qui réécrit le fichier
> **en entier** à chaque entrée, c'est-à-dire au relâchement de chaque pointeur.

**Une ligne illisible arrête la lecture** : le logiciel écarte cette entrée **et
tout ce qui suit**, et annonce le nombre. Reprendre après elle ferait suivre un
correctif à un instant qui n'est pas le sien.

**Taille bornée** : au moins les cinq cents dernières entrées, et au-delà
élagage sur **frontière d'instantané**. **Le plancher l'emporte sur le plafond**
— un historique qui affiche un instant qu'il ne sait plus reconstruire est pire
que pas d'historique.

### 8.7 Copier, renommer, importer, supprimer

**Copier** produit un nouvel événement avec une identité propre, dans un
dossier neuf qui porte son nom (§ 8.6). Le logiciel **demande le nom avant de
créer** ; sans cela les noms s'empilent en « (copie) (copie) ».

**L'historique ne se copie pas.** La copie démarre sur une entrée unique :
« Créée par copie de ‹nom›, à l'instant ‹libellé› ». Rejouer les entrées de
l'original promettrait un retour arrière qui ramènerait le contenu de
l'original — exactement ce dont l'opérateur voulait diverger. La **filiation**
est conservée comme un fait inscrit dans le fichier.

**La copie d'un plan bloqué n'est pas bloquée** : son état se déduit de son
contenu. Copier un plan bloqué est le geste même de « le plan distribué reste
figé, je travaille sur une variante ».

**Renommer** change le dossier et les **deux** fichiers : le logiciel écrit
d'abord la paire complète sous les nouveaux noms, dans un dossier neuf qui
porte le nouveau nom, puis y déplace un à un ce que l'ancien dossier porte à
côté de l'événement, puis supprime l'ancienne paire — jamais l'inverse. Les
badges et la liste en CSV déjà produits (§ 11.6) **prennent le nouveau nom** :
l'ancien nom en tête du fichier cède la place au nouveau, et le reste — modèle,
papier, date, rang — ne change pas ; le nouveau nom se raccourcit, comme à la
production, quand le chemin dépasserait la borne (§ 8.6). Les autres fichiers,
et le dossier `logo/` avec ce qu'il porte, gardent leur nom. Une panne laisse
deux paires, ce qui se voit et se répare, au lieu d'aucune ; une écriture
refusée avant que la nouvelle paire soit complète en efface ce qui s'est écrit,
et le dossier neuf resté vide. Une fois le verrou rendu, **l'ancien dossier se
retire** s'il est vide. S'il ne l'est pas — un fichier qu'un autre programme
tient ouvert, un fichier apparu entre-temps, un déplacement refusé, les
fichiers d'un autre événement posés à la main dans ce dossier, une écriture
interrompue restée de l'ancienne paire —, il reste avec ce qu'il porte, et un
avertissement le nomme ; le renommage, lui, est fait. Le logiciel ne retire
jamais un dossier qui porte encore quelque chose. Un nom qui ne change que par
la casse, ou par un caractère que Windows refuse, se réécrit en place : le
dossier et les fichiers gardent leur nom.

Le compagnon des courses suit : écrit sous le nouveau nom après l'état, supprimé
avec l'ancienne paire ; quand l'écriture du nouveau est refusée, l'ancien se
déplace sous le nouveau nom, ou reste où il est si le déplacement l'est aussi,
et n'est jamais supprimé. **Copier** donne à la copie le compagnon des courses
de ses propositions, sous son identifiant ; **supprimer** le met à la corbeille
avec les autres fichiers. **Importer de l'autre emplacement** le recopie tel
quel après l'état, quand il se lit ; l'ouverture le revalide entrée par entrée,
et un refus de l'écrire ne refuse pas l'import. Un **fichier d'état venu
d'ailleurs** n'en a pas : ses courses ne sont pas connues.

L'aperçu de la liste suit aussi : **renommer** le déplace sous le nouveau nom,
avec les autres fichiers ; un déplacement refusé l'efface, pour que l'ancien
dossier se retire, et un effacement refusé l'y laisse, sans rien refuser.
**Supprimer** le met à la corbeille avec les autres fichiers. **Copier** et
**importer** ne le recopient pas : l'état de la copie n'est pas celui de
l'original, et la liste suivante calcule l'aperçu de l'événement neuf.

Les logos suivent aussi, fichier par fichier, une fois l'événement neuf
écrit : seuls les fichiers de `logo/` nommés comme un logo passent, un fichier
posé à la main dans ce dossier reste où il est. **Copier** les recopie tous
dans le dossier de la copie, ceux que seul l'historique de l'original désigne
compris. **Importer de l'autre emplacement** les recopie dans le dossier de
chaque événement importé. **Écrire ailleurs** (§ 8.6) les recopie depuis le
support rompu, quand il les rend encore. Un logo qui ne se recopie pas — un
fichier illisible, un support retiré, une écriture refusée — ne refuse jamais
l'opération : l'événement est copié, importé ou écrit, et un avertissement
compte les logos restés en arrière et les personnes dont la fiche les dira
introuvables, et dit quand l'image des badges (§ 11.4) en est un. Il se lit là
où l'opération mène l'opérateur : dans la vue de la copie, qu'elle ouvre ; sur
la liste des événements, un par événement importé ; dans la vue de l'événement
écrit ailleurs. Le disque n'en garde rien : il vit jusqu'au geste suivant dans
la vue, jusqu'à l'opération suivante sur la liste. Une panne pendant la recopie
laisse l'original intact et l'événement neuf complet, à quelques logos près ; un
état refusé là-bas lève avant la recopie, et les logos restent en arrière. Un
**fichier d'état venu d'ailleurs** n'emporte aucun logo : ses personnes gardent
leur chemin, et leur fiche dit le logo introuvable.

**Importer** un fichier venu d'ailleurs le **copie** dans le dossier de travail,
dans un dossier neuf qui porte son nom. Travailler en place écrirait dans un
dossier de téléchargements que l'opérateur vide régulièrement. **Importer de
l'autre emplacement** n'y lit que les dossiers d'événement (§ 8.6) : des
fichiers d'événement posés à même sa racine ne se copient pas.

**Supprimer** déplace **tout le contenu du dossier** de l'événement — ses
fichiers, les badges et la liste en CSV produits, le dossier `logo/`, les
écritures interrompues restées — dans une `corbeille/` datée, à la racine du
dossier de travail : le dossier daté porte directement ce contenu, `logo/` à son
niveau. L'état part en dernier, puis le dossier vide se retire. Un fichier qui
n'est pas à l'événement et refuse son déplacement — qu'un autre programme tient
ouvert — reste dans le dossier sans faire échouer la suppression : le reste
part, l'état compris. Un dossier qui ne se vide pas reste ainsi, et un
avertissement le nomme. Les fichiers d'un autre événement posés à la main dans
le même dossier ne partent pas, et cet événement reste listé. Le logiciel ne
vide jamais la corbeille de lui-même et affiche ce qu'elle contient, chaque
fichier par son chemin dans le dossier daté : un opérateur qui croit avoir
supprimé les coordonnées d'une personne les a en réalité déplacées. Il en va
de même de son logo : retirer le logo, le remplacer ou supprimer la personne
laisse son image dans `logo/`, que l'historique désigne encore (§ 8.3) ; elle
ne quitte le dossier qu'avec l'événement, pour la corbeille.

### 8.8 Ce qui résiste à une panne

Ces garanties sont des propriétés de l'implémentation **`electron`**, celle qui
est livrée. L'implémentation `web`, de développement, n'offre ni renommage
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
- **Version de format.** Le format courant est le **3**, et c'est le premier
  que le logiciel accepte. Un fichier **plus ancien**, du format 1 ou 2, écrit
  par une version de développement, **est refusé** : l'ouverture le dit
  illisible, de format trop ancien et non pris en charge, en nommant son
  format, sans rien lire d'autre de lui. Aucune fonction ne le convertit, et
  **aucun secours ne s'offre** à sa place : ouvrir la version précédente ou le
  dernier instant du journal mènerait le premier geste à écrire par-dessus
  lui ; un secours demandé quand même se refuse de la même raison. Le fichier
  reste tel quel sur le disque. Un **journal** d'un format plus ancien ne se
  lit pas davantage : à côté d'un état lisible, il est annoncé illisible,
  laissé tel quel, et le premier geste commence l'historique dans un nouveau
  fichier ; seul, sans état, il se refuse comme l'état, au nom du journal.
  Importer un tel fichier ou le charger comme démonstration se refuse aussi,
  sans rien écrire. Un fichier **plus récent** s'ouvre en lecture seule sans
  passage possible en écriture : une construction plus ancienne, devant un
  fichier qui porte une saisie qu'elle ne connaît pas, refuserait sinon comme
  illisible un fichier qu'elle n'a pas écrit, ou le réécrirait sans cette
  saisie.
- **Renommer et supprimer, interrompus.** Chaque fichier passe d'un dossier à
  l'autre en entier, par un déplacement : une panne à n'importe quelle étape
  laisse chacun à sa place ou à la nouvelle, une fois, jamais perdu ni copié.
  Un **renommage** coupé pendant l'écriture de la nouvelle paire laisse
  l'ancien événement, seul listé, son journal neuf tu ; coupé entre le nouvel
  état et l'effacement de l'ancien, les deux, signalés doublons l'un de
  l'autre ; coupé pendant les déplacements, les fichiers de l'ancien dossier
  répartis entre les deux ; coupé après l'effacement de l'ancienne paire, le
  seul événement renommé, et l'ancien dossier, vide ou qui garde le verrou de
  la séance coupée, qui ne se liste pas mais garde son nom. Une **suppression**
  coupée laisse l'événement listé et ouvrable tant que son état n'est pas parti,
  ce qui est déjà parti dans le dossier daté ; la supprimer de nouveau emporte
  le reste dans un autre dossier daté. Coupée après l'état, elle laisse un
  dossier vide, qui ne se liste pas. Chacun de ces états s'éprouve par une
  coupure après chaque écriture.
- **Une seule séance en écriture**, le verrou se prenant **à l'entrée en mode
  écriture** et non à l'ouverture. Le verrou est un fichier du dossier de
  l'événement, `<nom>.gtt.verrou`, à côté de son état. Il porte l'instant de sa
  prise, que la séance lit à l'horloge unique de l'application (§ 19.4), comme
  toute date qu'elle écrit.
- **Contrôle de cohérence** : l'en-tête annonce ses comptes, sa révision, sa
  **version de format** et `produitVersion` (§ 18.6) ; l'analyse syntaxique
  seule ne distingue pas un fichier complet d'un fichier plausible. Le contrôle
  **s'étend aux placements** (§ 8.9) : longueurs déclarées contre listes
  écrites, identifiants vérifiés en multiensemble par tour, réserve comprise.
- **Le logiciel n'écrit jamais un état qu'il ne relirait pas.** Avant la
  première écriture d'un geste, le texte d'état se relit par l'analyse même de
  l'ouverture ; une charge qu'elle refuserait refuse le geste, et rien ne
  s'écrit, ni journal ni état. Ce contrôle a lieu à chaque geste et jamais
  seulement en épreuve (§ 14.12) : c'est un geste qui produit l'état fautif.
- **Sérialisation canonique** : **ordre de clés fixé, et aucune valeur que le
  sérialiseur dérive de l'horloge ou d'un tirage au moment d'écrire.** La règle
  porte sur le **sérialiseur**, jamais sur la provenance de la donnée : une
  valeur tirée ou horodatée **une fois**, puis devenue partie de l'état — graine
  d'une proposition, `produitVersion`, identifiant d'événement — est une donnée
  ordinaire. Lue comme un interdit sur la provenance, cette règle interdirait
  d'enregistrer la graine, et une proposition retenue cesserait d'être
  régénérable. Lue comme un interdit sur le sérialiseur, elle garde tout son
  effet : ce qu'elle empêche est l'horodatage glissé à chaque écriture, qui fait
  enregistrer du bruit à chaque geste.
- **Le fichier se partage en en-tête et charge utile.** En-tête : comptes,
  révision, version de format, `produitVersion`. Charge utile : tout le reste.
  La canonicité octet pour octet est exigée du **fichier entier**, pour un
  binaire donné ; mais les deux comparaisons qui **traversent les
  constructions** — l'empreinte des fichiers de démonstration (§ 15.5, point 5)
  et l'aller-retour sur les fichiers livrés (§ 8.9) — portent sur la **charge
  utile seule**. Sans cette restriction, `produitVersion` fait échouer
  l'empreinte à **chaque** livraison : le test exigerait alors de régénérer les
  démonstrations à chaque incrément de version, c'est-à-dire exactement la dérive
  que le § 15.5 existe pour empêcher, et le geste conscient qu'il réclame
  deviendrait mécanique, donc aveugle.
- **Le journal note la construction qui change** : quand `produitVersion`
  diffère de celle de l'entrée précédente, l'entrée de journal la porte. Le coût
  est d'un champ par remplacement d'exécutable ; sans lui, un fichier transmis
  pour diagnostic annonce la construction qui a écrit **en dernier**, et rien ne
  dit laquelle a produit l'état suspect.
- **Sur un support amovible, la garantie d'écriture atomique est annoncée comme
  affaiblie** : le renommage par-dessus n'y a pas la même valeur que sur le
  volume système, et le support peut disparaître entre l'écriture et le
  renommage. Le logiciel l'annonce comme il annonce déjà les limites de la
  plateforme `web`.


### 8.9 La forme des placements dans le fichier

**« En clair » veut dire non chiffré, pas lisible à l'œil.** Le fichier reste du
texte, ouvrable dans un éditeur, sans clé ni outil.

**Le logiciel ne comprime pas.** Trois raisons, dont une seule suffirait. Le
journal est en **ajout de ligne en fin** (§ 8.6) et une archive comprimée ne
s'étend pas ainsi. Un octet abîmé dans un flux comprimé emporte tout ce qui suit,
là où une forme texte permet d'écarter une proposition et d'ouvrir le reste. Et
les **correctifs** du § 8.6 reposent sur la localité : une personne déplacée
touche deux entrées de deux listes, tandis qu'une recompression réécrit le flux
entier et rend le correctif aussi gros que l'instantané.

> La compression ne détruirait pas la canonicité du § 8.8 — un compresseur à
> niveau fixé est déterministe. L'argument est ailleurs, et il est celui
> ci-dessus.

**La compacité ne s'applique qu'aux placements.** Le fichier se partage en deux
régions, et la frontière suit une seule question : *ce qui se perd ici se
retrouve-t-il ?*

| région | forme | pourquoi |
|---|---|---|
| participants, tables, tours, réservations, titres de place, filiation | **champs nommés**, un objet par chose | c'est de la saisie d'opérateur : perdue, elle est perdue, et elle doit se lire à l'œil quand un fichier s'abîme. Elle est petite — de l'ordre de 40 ko pour 260 personnes avec courriels |
| placements engendrés | **forme positionnelle** | c'est la partie volumineuse, et la seule qui se **recalcule** : une proposition perdue coûte une relance |

#### Un champ ancien, oublié : la cible de la somme de redondance

Un fichier écrit par une construction antérieure peut porter, dans les
réglages de l'événement, un champ `cibleRedondance` : la cible à laquelle la
liste des événements comparait la somme de redondance Σ r(p) du retenu. La
liste montre les collisions cumulées du retenu (§ 8.1), et ce champ ne sert
plus. **Il est oublié** : un fichier qui le porte se lit sans faute de forme, sans
refus ni avertissement, quelle que soit sa valeur ; la charge lue ne le porte
pas, et le premier geste écrit le fichier sans lui. Aucune commande ne le pose.
Un correctif du journal (§ 8.6) qui le pose ou le retire, qu'un journal plus
ancien porte, s'applique sans rien changer : chaque instant se restitue sans
lui. L'instant qui le posait ou le retirait se restitue donc comme son
voisin : le défaire ou le refaire s'écrit quand même, d'une entrée qui ne
change rien, et le fil avance d'un pas (§ 8.3). Hors des réglages, la même clé
reste une clé inconnue, et une faute de forme.

#### Deux champs facultatifs : le placement daté

Le retenu et chaque proposition portent un champ **facultatif**, `horodatage`,
de la forme `AAAA-MM-JJTHH:MM:SS±HH:MM` — celle de l'horloge de l'application,
décalage local compris —, écrit en dernière clé de son objet, après le
placement. Pour le retenu, il est l'instant où le placement a pris sa forme
courante ; pour une proposition, celui de la génération qui l'a produite.
**Absent, il est inconnu**, et un fichier écrit avant lui — chaque démonstration
livrée comprise — se lit tel quel et s'écrit sans lui. Une valeur d'une autre
forme est une faute de forme du placement, nommée par son chemin (§ 8.8).

Le geste qui change le retenu le date de l'instant du geste ; un geste qui le
reconstruit sans le changer garde l'horodatage reçu. Une génération date les
propositions qu'elle ajoute, et les autres gardent le leur. **Il date le
placement, pas la page** : corriger un nom ne le change pas, et le retour à un
instant (§ 8.3) le restitue avec le reste de l'état — un badge réédité sur le
même placement redevient identique au premier (§ 11.8). Les sorties le lisent
là, et nulle part ailleurs : le pied des pages, la feuille de contrôle, le badge
(§ 11.4, § 11.7) et le nom du fichier de la planche (§ 11.6).

#### Les champs facultatifs des étiquettes, des objectifs et des priorités

Chacun est **absent tant qu'il vaut son défaut** et s'écrit après les clés
toujours présentes de son objet, dans l'ordre du tableau qui suit — pour les
réglages, `regleObjectifs`, `respecterObjectifs`, `modeObjectifs`,
`rencontrerAnimateurs`, `priorites` : un événement qui n'emploie ni étiquette,
ni objectif, ni ordre réglé n'en porte aucun. Chacun se pose par une commande —
une entrée d'historique, refusée en lecture et sur un plan bloqué — qui le
retire quand il revient à son défaut : deux états de même valeur effective
posés par les commandes s'écrivent pareil. Un fichier lu garde ce qu'il écrit :
une liste `priorites` dont un critère seul à son palier porte un poids autre
que 1 se lit telle quelle, même de même effet que l'ordre par défaut, et ne
revient à l'absence que par une commande. Un correctif du journal (§ 8.6) le
pose quand il apparaît et le retire quand il disparaît. Un champ écrit à son
défaut, ou sous toute autre forme que celle du tableau, est une faute de forme
du fichier, nommée par son chemin (§ 8.8). L'ordre, lui, ne fait pas faute :
des étiquettes, des objectifs ou les critères d'un palier rangés autrement se
lisent, et s'écrivent rangés.

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `etiquettes` | chaque participant | aucune étiquette | liste non vide d'au plus 20 étiquettes (§ 4.5), sans doublon exact, écrite triée par unités de code |
| `objectifs` | chaque table | aucun objectif | liste non vide d'objets `{portee, tour, regle, etiquettes}` ; `portee` `tous` ou `tour` ; `tour` nul sous `tous`, de 1 à R sous `tour` ; `regle` `ou`, `et` ou nul (suit le défaut) ; `etiquettes` sous la forme de celles d'un participant ; au plus un objectif par portée et tour ; écrite la soirée d'abord, puis les tours croissants |
| `regleObjectifs` | réglages | `ou` | `ou` ou `et` ; présent seulement à `et` |
| `respecterObjectifs` | réglages | coché | booléen ; présent seulement à faux |
| `modeObjectifs` | réglages | le plus de places servies | `chacun` (chacun au moins une fois) ou `minimum` (l'équité d'abord) ; présent seulement hors du défaut |
| `rencontrerAnimateurs` | réglages | décoché | booléen ; présent seulement à vrai |
| `priorites` | réglages | l'ordre par défaut (§ 5.7) | liste de paliers, chacun une liste non vide de `{critere, poids}` ; chaque critère du § 5.7 une fois, les inclusions non satisfaites pouvant manquer (plus bas) ; l'écart au plafond a priori, les rencontres répétées et retours, les conflits d'organisation et les inclusions non satisfaites seuls à leur palier, au poids 1 ; sous `modeObjectifs` présent, les tours hors objectif aussi ; poids entiers de 1 à 100, un critère seul à son palier hors de ceux-là gardant le poids écrit (§ 5.7) ; chaque palier écrit dans l'ordre du tableau du § 5.7 ; absent quand il égale le défaut, chaque critère seul à son palier au poids 1 |

La liste `priorites` est complète, à une exception : un critère ajouté au
format courant après que des listes ont pu s'écrire — les inclusions non
satisfaites — peut y manquer. Le lecteur de l'ordre le place juste après le
palier de son prédécesseur dans l'ordre par défaut, celui des conflits
d'organisation, seul, au poids 1 ; la liste se juge ainsi complétée, et une
liste qui, complétée, égalerait l'ordre par défaut reste une faute, comme
l'ordre par défaut écrit. Le fichier garde la liste telle qu'il l'écrit : la
relire et la réécrire ne la complète pas, et seule une commande de l'ordre en
écrit une complète. Tout autre critère absent reste une faute de forme. Le
lecteur sait compléter une liste à qui manqueraient d'autres critères —
chacun à sa place de l'ordre par défaut, seul à son palier, au poids 1 — ; au
format courant l'analyse la refuse avant, et ce complément sert la liste d'un
format qui ne connaissait pas un critère.

Un objectif appartient à sa table : supprimer la table l'emporte, et la fenêtre
qui annonce la suppression le compte (§ 2.1). Retirer un tour détruit les
objectifs de ce tour, que l'annonce compte avec les réservations (§ 2.1, étape
5).

#### Deux champs facultatifs : la dérivation

Une proposition dérivée (§ 5.7) porte deux champs facultatifs, écrits juste
après `historique` : `depart`, l'identifiant entier de la proposition d'où sa
recherche est partie, et `toursFiges`, la liste strictement croissante des
numéros des tours qu'elle a repris de son départ, de 1 au nombre de tours
qu'elle déclare. Une proposition qui n'est pas dérivée ne porte ni l'un ni
l'autre, et une dérivée sans tour figé ne porte pas `toursFiges` : un
événement sans dérivée s'écrit octet pour octet comme sans eux. La génération
les pose, et aucun geste ne les change ensuite. Le retenu ne les porte pas :
il désigne sa proposition, qui les porte.

Sont des fautes de la proposition, qui la rendent fautive seule (« Ce que la
compacité coûte, et ce qui le paie », point 3) : un `depart` qui n'est pas un
entier strictement inférieur à son identifiant — le départ précède toujours sa
dérivée —, un `toursFiges` vide, non strictement croissant, hors des tours
déclarés ou qui les porte tous, un `toursFiges` sans `depart`. **Un `depart`
absent de la liste n'est pas une faute** : effacer les propositions l'emporte
(§ 5.7), et la dérivée reste comparable et classée. L'ouverture ne compare pas
les tours figés à ceux du départ : les propositions tombent chacune seule, et
cette égalité se vérifie à la génération (§ 5.7). Les tours figés d'une
dérivée sont ceux du plan ajusté de son départ (§ 5.7) : l'ouverture ne les
compare toujours pas, et la génération vérifie cette égalité. Les deux champs
font partie du format 3 : aucune construction qui lit ce format ne les ignore.

**La référence reste juste à travers le journal.** Un état restitué (§ 8.3)
a existé avec ses dérivées et leurs départs ; un identifiant que la
génération suivante réattribue après un retour désigne, dans chaque état, la
proposition de cet état.

#### Un champ facultatif : le libellé d'une table

Le libellé d'une table (§ 4) s'écrit dans un champ facultatif, absent quand la
table n'en porte pas :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `libelle` | chaque table, après `position`, avant `objectifs` | aucun libellé | texte bien formé, en NFC, sans blanc en bord, de 1 à 60 points de code — un caractère hors du plan de base compte pour un |

Une autre forme — un texte vide, un blanc en bord, un texte hors de NFC, plus
de 60 points de code, une moitié de paire de substitution isolée, `null` — est
une faute de forme, nommée par son chemin (§ 8.8). Une table sans libellé
s'écrit octet pour octet comme sans ce champ, démonstrations comprises. Il se
pose par une commande — une entrée d'historique, refusée en lecture et sur un
plan bloqué — qui reçoit la saisie du champ « Libellé » de « Tables et tours »,
la met en NFC, retire ses blancs de bord et remplace une moitié de paire isolée
par le caractère de remplacement : vide, elle retire le champ ; au-delà de 60
caractères, elle refuse, contre le champ, en disant la longueur saisie et la
longueur admise ; le même libellé n'écrit rien. Un correctif du journal le pose
et le retire comme tout champ. Le moteur ne le lit pas : la configuration
qu'il reçoit, les empreintes et les raisons de dérive restent les mêmes. Le
champ fait partie du format 3.

#### Un champ facultatif : les noms des tours

Les noms des tours (§ 4) s'écrivent dans un champ facultatif de l'événement,
absent quand aucun tour n'a de nom :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `nomsTours` | l'événement, après `filiation`, avant `imageBadges` | aucun tour n'a de nom | liste d'un élément par tour, R éléments, chacun le nom du tour, de la forme du libellé d'une table — texte bien formé, en NFC, sans blanc en bord, de 1 à 60 points de code —, ou `null` pour un tour sans nom ; au moins un nom |

Une liste d'une autre longueur que le nombre de tours, une liste sans aucun nom
— le défaut écrit —, `null` à la place de la liste et un élément d'une autre
forme sont des fautes de forme, nommées par leur chemin (§ 8.8). Un événement
sans nom de tour s'écrit octet pour octet comme sans ce champ, démonstrations
comprises. Un nom se pose par une commande, `changerNomTour` — une entrée
d'historique, refusée en lecture et sur un plan bloqué —, qui reçoit la saisie
du champ de son tour dans « Tables et tours », la met en NFC, retire ses blancs
de bord et remplace une moitié de paire isolée par le caractère de
remplacement : vide, ou égale au nom par défaut du tour, « Tour 3 », elle retire
le nom, et le champ avec le dernier nom ; au-delà de 60 caractères, elle refuse,
contre le champ, en disant la longueur saisie et la longueur admise ; le même
nom n'écrit rien. Changer le nombre de tours rogne la liste aux tours qui
restent, et l'allonge de `null` pour un tour ajouté ; le champ part quand aucun
tour restant n'a de nom, et le libellé de l'entrée compte les noms retirés. Un
correctif du journal le pose et le retire comme tout champ. Le moteur ne le lit
pas : la configuration qu'il reçoit, les empreintes et les raisons de dérive
restent les mêmes. Le champ fait partie du format 3.

#### Un champ facultatif : l'image des badges

L'image que portent tous les badges (§ 11.4) s'écrit dans un champ facultatif
de l'événement, réglages compris, absent à son défaut :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `imageBadges` | l'événement, en dernière clé, après `nomsTours` | la case décochée, aucune image, en haut | un objet de trois clés, dans cet ordre : `active`, la case, un booléen ; `chemin`, le chemin de l'image dans le dossier de l'événement, de la forme du logo d'une personne — `logo/`, les 64 chiffres hexadécimaux minuscules du SHA-256 de ses octets, `.png` —, ou `null` sans image ; `position`, `haut`, `centre` ou `bas` |

Le défaut écrit — `active` faux, `chemin` `null`, `position` `haut` —, `null` à
la place de l'objet, une clé manquante ou inconnue et une valeur d'une autre
forme sont des fautes de forme, nommées par leur chemin (§ 8.8). Un événement
sans image s'écrit octet pour octet comme sans ce champ, démonstrations
comprises. L'image est un PNG d'au plus 1 200 pixels de côté, rangé avec les
logos des personnes dans `logo/`, sous le même nom par contenu : elle suit
l'événement copié, renommé, importé de son dossier ou mis à la corbeille comme
eux, et une recopie qui la manque se compte parmi les logos non recopiés, et
l'avertissement le dit (§ 8.7).

Le champ change par une commande, `changerImageBadges`, qui reçoit une, deux
ou trois de ses clés — une entrée d'historique, refusée en lecture et sur un
plan bloqué, dont le libellé dit ce qui change : la case cochée ou décochée,
l'image posée, remplacée ou retirée, la position ; rien qui change n'écrit
rien. Revenu à son défaut, le champ part. **L'image s'écrit avant l'entrée**,
comme le logo d'une personne : la séance refuse d'abord ce qu'un geste
refuserait, contrôle le PNG, essaie la commande à blanc, écrit l'image dans
`logo/` si elle n'y est pas encore, puis l'entrée ; une image que le disque
refuse refuse le geste, `IMAGE_BADGES_NON_ECRITE`, le fichier et la cause
nommés, sans rien enregistrer. Retirer l'image retire le chemin ; aucune image
ne s'efface (§ 8.3). Un chemin dont le fichier manque se lit comme absent, sans
faute du fichier. Le moteur ne lit pas le champ : la configuration qu'il
reçoit, les empreintes et les raisons de dérive restent les mêmes. Le champ
fait partie du format 3.

#### Un champ facultatif : les conflits d'organisation

Les conflits d'organisation d'une personne (§ 4) s'écrivent dans un champ
facultatif, absent quand elle n'en nomme aucun :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `conflits` | chaque participant, après `presence`, avant `inclusionsOrganisation` | aucun conflit | liste non vide de noms d'organisation, textes non vides, sans doublon exact, écrite triée par unités de code ; chacun est l'organisation d'un participant de la charge, exclus compris, comparée chaîne à chaîne, et jamais celle de la personne |

Une liste vide, un doublon, une valeur qui n'est pas un texte non vide sont des
fautes de forme ; la propre organisation de la personne aussi, nommée par le
rang qui la porte ; une organisation que nul participant ne porte est une faute
de référence (§ 8.8). Le champ se pose et se retire par trois commandes,
`ajouterConflit`, `retirerConflit` et `changerConflits` — une entrée
d'historique chacune, refusées en lecture et sur un plan bloqué — : la première
reçoit une organisation que porte un participant, mise en NFC et ses blancs de
bord retirés, refuse la propre organisation de la personne et une organisation
inconnue, et rend la liste rangée ; la deuxième retire le champ quand la liste
se vide ; la troisième pose la liste entière d'un geste, ajouts et retraits
ensemble, chaque nom nouveau jugé comme par la première, sans effet quand la
liste garde les mêmes noms. Modifier, supprimer ou importer des participants
fait suivre les listes dans la même entrée (§ 4). La configuration du moteur en
porte une copie : sans liste, elle est celle d'avant le champ, et les
empreintes avec elle. Le champ fait partie du format 3.

#### Deux champs facultatifs : les inclusions

Les inclusions d'une personne — les organisations et les participants qu'elle
doit rencontrer au moins une fois à une table — s'écrivent dans deux champs
facultatifs, absents quand elle n'en nomme aucun :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `inclusionsOrganisation` | chaque participant, après `conflits`, avant `inclusionsParticipant` | aucune organisation à rencontrer | liste non vide de noms d'organisation, textes non vides, sans doublon exact, écrite triée par unités de code ; chacun est l'organisation d'un participant de la charge, exclus compris, comparée chaîne à chaîne, et jamais celle de la personne |
| `inclusionsParticipant` | chaque participant, après `inclusionsOrganisation`, avant `logo` | aucun participant à rencontrer | liste non vide d'identifiants entiers distincts, écrite croissante ; chacun est celui d'un participant de la charge, exclus compris, et jamais celui de la personne |

Une liste vide, un doublon, une valeur d'une autre sorte sont des fautes de
forme ; la propre organisation de la personne et son propre identifiant aussi,
nommés par le rang qui les porte, pour chaque personne l'organisation d'abord,
et contrôlés après les conflits ; une organisation que nul participant ne porte
et un identifiant que nul participant n'a sont des fautes de référence, nommées
après celles des conflits (§ 8.8), pour chaque personne l'organisation avant
l'identifiant. **Une inclusion de participant désigne la personne par son
identifiant, jamais par son nom** : la renommer ne la change pas, et deux
homonymes restent distincts. Un collègue de la même organisation se nomme comme
un autre. Une inclusion que contredit un conflit de la personne n'est pas une
faute du fichier. La liste d'une exclue se garde, et une inclusion qui vise une
exclue aussi. Une personne sans inclusion s'écrit octet pour octet comme sans
ces champs, démonstrations comprises. Les champs se posent par trois commandes,
`changerInclusionsOrganisation`, `changerInclusionsParticipant` et
`changerInclusions` — une entrée d'historique chacune, refusées en lecture et
sur un plan bloqué — : chacune pose une liste entière d'un geste, ajouts et
retraits ensemble ; la première juge chaque organisation nouvelle comme
`changerConflits`, sous `INCLUSION_PROPRE_ORGANISATION` pour la sienne ; la
seconde refuse l'identifiant de la personne et un identifiant inconnu (§ 5.9) ;
la troisième pose l'une des deux listes ou les deux en une seule entrée, chacune
jugée comme par sa commande, les organisations d'abord, le premier fautif
refusant le geste entier, et laisse la liste qu'elle ne nomme pas. Chacune rend
les listes rangées, retire un champ quand sa liste se vide, et est sans effet
quand aucune liste ne change de valeurs. Modifier, supprimer ou importer des
participants fait suivre les listes dans la même entrée (§ 4). Un correctif du
journal les pose et les retire comme tout champ. La configuration du moteur en
porte une copie : sans liste, elle est celle d'avant les champs, et les
empreintes avec elle. Les raisons de dérive ne les lisent pas : **changer une
inclusion reclasse sans faire dériver**, comme un conflit, et une proposition
calculée avant se mesure et se classe sous les listes d'aujourd'hui (§ 5.7).
Les deux champs font partie du format 3.

#### Deux champs facultatifs : la présence

La présence d'une personne (§ 4) et les absents d'un tour de placement
s'écrivent dans deux champs facultatifs, absents à leur défaut :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `presence` | chaque participant, après `etiquettes` | présente à tous les tours | liste non vide de tours de 1 à R, entiers distincts, écrite triée ; une liste qui porte chaque tour est écrite à son défaut, une faute de forme |
| `absents` | chaque tour d'un placement, après `reserve` | aucun absent à ce tour | liste non vide d'identifiants, écrite triée |

Un événement sans absence s'écrit octet pour octet comme sans ces deux champs,
démonstrations comprises. Un tour au-delà de R dans `presence` est une faute de
forme, au chemin du premier dans l'ordre écrit ; une liste pleine aussi, au
chemin de la liste. Aucun code nouveau d'analyse n'existe : ce sont les fautes
de forme du § 8.8. La présence d'une exclue s'écrit comme les autres, et se
rogne avec R (§ 4.3).

Les `absents` d'un tour se tirent de la configuration, jamais d'un geste : à
l'écriture, ce sont les identifiants déclarés par le placement que la présence
du moment dit absents à ce tour, exclus mis à part. Le moteur ne les porte pas,
et la lecture d'un plan les laisse tomber : un absent n'est listé nulle part
dans un plan, sa présence suffit. **Une absence se change par la présence**, et
un placement relu qui ne les porte pas tels que la présence les dit est en
dérive (§ 9), avec les raisons `PRESENCE_RETIREE` — le placement assied ou
réserve la personne à des tours où elle est absente depuis — et
`PRESENCE_AJOUTEE` — il la dit absente à des tours où elle est présente
depuis —, chacune avec ses tours. Les deux champs font partie du format 3,
comme `depart` et `toursFiges`.

#### Un champ facultatif : le logo d'une personne

Le logo d'une personne s'écrit dans un champ facultatif, absent quand elle n'en
porte pas :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `logo` | chaque participant, après `inclusionsParticipant`, avant `nomNumerote` | aucun logo | `logo/`, puis les 64 chiffres hexadécimaux minuscules du SHA-256 des octets de l'image, puis `.png` : un chemin relatif au dossier de l'événement |

Une autre forme — des capitales, une autre longueur, un autre dossier ou une
autre extension, une remontée `..`, un chemin absolu, un blanc, `null` — est une
faute de forme, nommée par son chemin (§ 8.8) : un chemin lu dans le fichier ne
désigne ainsi qu'une image de `logo/`, jamais l'état, le journal ni un fichier
hors du dossier de l'événement. L'image est un PNG d'au plus 1 200 pixels de
côté, nommé par son contenu : les mêmes octets font le même fichier, écrit une
fois, et deux images distinctes ne se remplacent jamais. Une personne sans logo
s'écrit octet pour octet comme sans ce champ, démonstrations comprises.

Le champ se pose, se remplace et se retire par une commande, `changerLogo`, qui
reçoit le chemin ou `null` — une entrée d'historique, refusée en lecture et sur
un plan bloqué, dont le libellé dit le logo « posé », « remplacé » ou « retiré »
d'après celui d'avant et celui d'après ; le même chemin n'écrit rien.
`modifierParticipant` ne le reçoit pas. **L'image s'écrit avant l'entrée** : la
séance refuse d'abord tout ce qu'un geste refuserait, puis contrôle le PNG — sa
signature, son en-tête, le CRC de chaque morceau, ses côtés —, essaie la
commande à blanc, écrit l'image dans `logo/` si elle n'y est pas encore, puis
l'entrée. Une image que le disque refuse refuse le geste, `LOGO_NON_ECRIT`, le
fichier et la cause nommés : rien n'est enregistré, et le support n'en est pas
rompu. Le même logo choisi de nouveau, son image disparue du dossier, la
réécrit sans entrée. Retirer le logo retire le champ ; aucune image ne
s'efface (§ 8.3). L'image d'un chemin se lit dans tout mode, et un chemin dont
le fichier manque se lit comme absent, sans faute du fichier.

Le CSV des participants ne porte pas de logo : un import qui remplace la liste
retire les logos avec les personnes : la fenêtre à confirmer compte les logos
qui partiront, quand il y en a, et l'avis d'après le geste les compte encore ;
mettre à jour les garde (§ 10.1). Le moteur ne lit pas le champ : la
configuration qu'il reçoit, les empreintes et les raisons de dérive restent les
mêmes. Le champ fait partie du format 3.

#### Un champ facultatif : le nom numéroté

La marque du nom numéroté d'une personne (§ 4) s'écrit dans un champ
facultatif, absent quand son nom est celui qu'elle a reçu :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `nomNumerote` | chaque participant, après `logo`, avant `animationReservee` | aucun numéro ajouté au nom | `true` ; le nom finit alors par une espace (U+0020) et deux chiffres ASCII ou plus |

`false`, `null` ou toute autre valeur que `true` est une faute de forme ; une
marque posée sur un nom qui ne finit pas ainsi — un seul chiffre, un autre
blanc, des chiffres d'une autre écriture, un mot après — aussi, nommée par le
chemin de la marque et contrôlée après les conflits et les inclusions (§ 8.8).
Une personne sans marque s'écrit octet pour octet comme sans ce champ,
démonstrations comprises. **La marque ne se déduit jamais du nom** :
« Galet 01 » écrit tel quel dans un CSV ne la porte pas.

Aucune commande de saisie ne la pose ni ne la montre. L'import la pose sur
chaque personne qu'il crée d'une ligne que « Rendre les noms uniques » a
renommée, dans les trois modes (§ 10.1) ; une mise à jour la garde, sauf quand
le nom qu'elle pose ne finit plus par le numéro. `modifierParticipant` la retire
dès qu'il change le nom, par la fiche comme par la grille (§ 10.2), et garde la
marque quand il change un autre champ. Un correctif du journal la pose et la
retire comme tout champ : « Défaire » la rend avec l'ancien nom. Le CSV des
participants ne la porte pas : un export puis un réimport rendent le nom entier,
numéro compris, sans la marque (§ 10.2). Le moteur ne lit pas le champ : la
configuration qu'il reçoit, les empreintes et les raisons de dérive restent les
mêmes. Le champ fait partie du format 3.

#### Un champ facultatif : l'animation réservée

La marque de l'animation réservée d'une personne (§ 4) s'écrit dans un champ
facultatif, absent quand rien ne l'appelle à animer :

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `animationReservee` | chaque participant, en dernier, après `nomNumerote` | la personne n'est pas à désigner | `true` |

`false`, `null` ou toute autre valeur que `true` est une faute de forme, nommée
par le chemin de la marque (§ 8.8). Une personne sans marque s'écrit octet pour
octet comme sans ce champ, démonstrations comprises. `modifierParticipant` la
pose à vrai et la retire à faux, par la case de la fiche (§ 10.2), et
`ajouterParticipant` la reçoit de même ; l'import la pose ou la retire par la
colonne `animation_reservee` (§ 10.1), et l'export l'écrit. Elle ne dépend ni
de l'exclusion ni de la présence. Le moteur ne lit pas le champ : la
configuration qu'il reçoit, les empreintes et les raisons de dérive restent les
mêmes. Le champ fait partie du format 3.

#### La forme positionnelle

Une proposition porte un **identifiant entier séquentiel**, et les propositions
sont rangées **en liste ordonnée** — jamais en objet indexé par une clé, dont
l'ordre n'est pas garanti par la forme. L'identifiant vient de la place dans la
suite de graines dérivées (§ 5.7), et ne dérive ni de l'horloge ni d'un tirage.
Il se compte à partir d'un compteur du fichier, `prochainsIds.proposition`, qui
dépasse tout identifiant de proposition jamais attribué, celui d'où vient le
placement retenu compris : une génération numérote ses propositions dans
l'ordre de ses graines à partir de lui, puis le porte au-delà de la dernière.
L'identifiant d'une proposition reste sous le compteur que le fichier porte,
sous peine de la faute `IDENTIFIANT_HORS_COMPTEUR` : à l'ouverture, une
proposition qui l'atteint est fautive, et l'événement s'ouvre sans elle ; un
retenu dont la proposition d'origine l'atteint porte la même faute, qui le
rend fautif (point 3). Ces fautes se jugent contre le compteur reçu. Le
compteur ne recule jamais — ni quand une commande efface les propositions
(§ 5.7), ni quand une main l'abaisse dans le fichier : l'ouverture le relève
ensuite au-delà de chaque identifiant qu'elle lit, propositions écartées et
origine du retenu comprises. Un compteur abaissé à la main écarte donc les
propositions qu'il ne couvre plus, sans faire réattribuer aucun de leurs
identifiants. Les générations s'accumulent ainsi sans qu'un identifiant se
répète ni revienne, et le retenu ne désigne jamais une autre proposition que
la sienne.

**Un identifiant entier tient de 1 à 2³¹ − 1** — celui d'un participant, d'une
table, d'une proposition, ou de ce qu'une réservation, un titre ou un placement
désigne —, dans un entier signé de 32 bits, la largeur des tableaux du moteur.
Chaque compteur de `prochainsIds` suit la même borne : relevé au-delà d'un
identifiant lu, il reste ainsi loin de 2⁵³, où l'analyse ne le relirait plus.
Une valeur au-delà sort de sa règle, comme toute valeur que le format refuse.
Chaque identifiant attribué reste sous son compteur (`id < prochainsIds`), qui
ne passe pas 2³¹ − 1 : un identifiant attribué vaut donc au plus 2³¹ − 2. Un
compteur arrivé à 2³¹ − 1 est saturé : la création d'un participant, d'une
table ou d'une proposition qui demanderait un identifiant de plus est refusée
(`COMPTEUR_SATURE`), et rien ne se crée. Un geste qui en crée plusieurs — un
import, une génération, « Créer les tables… » — est refusé entier quand son
dernier identifiant passerait 2³¹ − 2 : aucun ne se crée.

Chaque proposition déclare, **une fois** :

- la **liste ordonnée des identifiants de table** sur laquelle elle est bâtie ;
- la **liste des capacités** correspondantes ;
- le **nombre de tours** ;
- l'**ensemble des identifiants de participants** qu'elle place ;
- le drapeau `siegesAttribues` : ses **sièges sont-ils attribués** (§ 5.3),
  l'ordre d'une liste de table étant alors celui des sièges ;
- sa **graine dérivée** (§ 5.7), le **compte d'arrêt** et la **longueur de
  l'historique** d'acceptation de la recherche qui l'a produite : les trois
  réglages qui la déterminent.

Ces trois champs sont le support de « à graine et entrée égales, placement
identique » (§ 5.10) : à configuration égale et pour une même version du moteur
(`produitVersion`, § 8.8), la régénération d'une proposition à partir d'eux
seuls rend son plan, quel que soit son rang dans sa génération. Sans eux, cette
phrase n'existe que dans un scénario de pilotage, et une proposition retenue
cesse d'être régénérable. La longueur de l'historique a une valeur par défaut,
mais la proposition porte celle qui l'a produite : régénérer sous une valeur
supposée rendrait une autre proposition, sans le dire. Les trois champs ne
déterminent le plan que pour l'algorithme de recherche qui l'a produit, dont
l'ordre des tirages et les règles d'acceptation font partie du résultat : une
proposition produite par une autre version du moteur n'est pas garantie
régénérable. **Une proposition dérivée se régénère de ces trois champs, de ses
tours figés et du plan de son départ**, que la liste porte et qui ne se
régénère pas. La régénération reçoit donc, avec les trois champs, `depart` et
`toursFiges` ; en présence de `depart`, elle exige le plan du départ, et refuse
sans lui, plutôt que de rendre en silence la proposition ordinaire de même
graine. Tant que son départ est dans la liste, à configuration égale, une
dérivée se régénère ; son départ effacé, elle ne l'est plus, comme une
proposition ordinaire cesse de l'être quand l'ordre des priorités change.

**« À configuration égale » comprend les étiquettes, les objectifs, la règle par
défaut, le mode des objectifs, les cases du § 5.3 et l'ordre des priorités.**
Les changer ne met aucune proposition en dérive : elle reste comparable, se
reclasse sous l'ordre courant (§ 5.7), et sa régénération rend un autre plan,
comme après un changement de contrainte. Seuls les participants, leur présence,
les tables, les capacités et les tours font une dérive (§ 9) ; un changement de
participants ou de présence laisse la proposition servir de départ (§ 5.7).

Puis, **par tour** : la liste des tables, chacune étant la liste de ses
occupants **dans l'ordre des sièges** — leurs **identifiants entiers**, et `null`
pour une chaise vide sous des sièges attribués — ; la **réserve**, la liste des
personnes présentes à ce tour et assises nulle part ; et les **absents**, la
liste des personnes que le placement dit absentes à ce tour, écrite seulement
quand elle n'est pas vide. Le numéro de
siège n'est pas stocké : il est la position dans la liste. Quand les sièges sont
attribués, une chaise vide avant le dernier occupant, siège 1 compris, s'écrit
`null` à sa position, et une liste ne finit jamais par `null` : retirer une
personne libère sa chaise, et aucun autre siège ne change — le placement se
prépare, il ne suit pas la salle.
Sans attribution, aucune liste ne porte `null`.

**Quand les sièges ne sont pas attribués** (§ 5.3), l'ordre à l'intérieur d'une
table ne porte aucune information : le logiciel l'écrit **trié par identifiant
croissant**. Sans cette règle, deux états identiques produisent deux fichiers
différents, et le § 8.8 est violé par la seule forme du stockage. **C'est le
drapeau de la proposition qui décide**, jamais le réglage courant de
l'événement : changer le réglage n'efface pas l'ordre des sièges d'une
proposition déjà produite. Le placement retenu a la même forme et son propre
drapeau, avec l'identifiant de la proposition dont il vient. L'ensemble des
participants, chaque réserve et chaque liste d'absents se trient par
identifiant croissant dans tous les cas : ce sont des ensembles.

```
# illustration, annotée ; le fichier livré est du JSON strict
propositions: [
  { id: 3,
    graine: 48271, arret: 20000, historique: 1000,
    produitVersion: "...",             la construction qui l'a produite (§ 8.8)
    siegesAttribues: true,             listes de table rangées par siège (§ 5.3)
    tables:    [7, 12, 2, ...],        identifiants de table (§ 4)
    capacites: [8, 8, 7, ...],
    tours: 4,
    participants: [1, 2, 3, ..., 260],
    placement: [
      { sieges: [[12,45,7,101,3,88,56,9], [21,64,...], ...],  tour 1
        reserve: [] },
      { sieges: [[12,33,...], ...],                           tour 2
        reserve: [177] },
      { sieges: [[12,90,...], ...],                           tour 3
        reserve: [], absents: [41] },
      ...
    ] } ]
```

#### Ce que cela économise

Sur la grande démonstration — 260 participants, 4 tours, une vingtaine de
propositions (§ 15.1), soit 1 040 places par proposition :

| forme | par proposition | vingt propositions |
|---|---|---|
| un enregistrement nommé par place (`tour`, `table`, `siege`, `participant`) | de l'ordre de 50 ko | **de l'ordre de 1 Mo** |
| positionnelle, en-têtes compris | de l'ordre de 5 ko | **de l'ordre de 100 ko** |

La course de la recherche n'est pas dans ce tableau : elle est dans le compagnon
des courses (§ 8.6), sous la même forme positionnelle. Le fichier d'état et le
journal n'en portent rien, et leurs ordres de grandeur valent tels quels.

Un facteur de l'ordre de **dix**. Trois conséquences sur des chiffres écrits
ailleurs :

1. **Les ordres de grandeur du § 8.6 présupposent cette forme.** Les « 250 ko »
   d'un fichier d'état sont atteints par la forme positionnelle, et dépassés d'un
   ordre de grandeur par la forme nommée, qui conduit au mégaoctet.
2. **Le coût d'un identifiant opaque est décuplé, non quadruplé** (§ 4) : sous la
   forme positionnelle, un identifiant de trente-six caractères remplace quatre
   octets par trente-neuf.
3. **La contrainte réelle est le § 8.2, pas l'historique.** Avec un instantané tous
   les cinquante, cinq cents entrées coûtent une dizaine d'instantanés — gros, pas
   rédhibitoire, même sous la forme nommée. Ce que la forme nommée casse est
   ailleurs : le § 8.2 **réécrit le fichier d'état en entier à chaque entrée
   d'historique**, c'est-à-dire au relâchement de chaque pointeur. Écrire, vider
   sur le disque et renommer 140 ko est une chose ; faire de même avec plus d'un
   mégaoctet, sur un support qu'un antivirus inspecte à chaque fichier temporaire
   créé, en est une autre — et la première victime serait l'équivalence « un geste
   achevé ⇔ un état enregistré », qu'on serait tenté de relâcher par un minuteur,
   ce que le § 8.2 interdit nommément. **Le coût d'un enregistrement se mesure**
   sur la grande démonstration, sur la plateforme livrée, et la mesure est écrite
   en commentaire à côté de sa valeur, avec ce qu'elle mesure, pourquoi et sur
   quelle configuration (§ 14.1). Un seuil posé de tête ici ne vaudrait rien.

#### Ce que la compacité coûte, et ce qui le paie

**Une forme positionnelle ne se diagnostique pas à l'œil.** Un tableau de 260
entiers ne dit pas qui est assis où, et un décalage d'une position déplace tout le
monde d'un siège sans qu'aucune syntaxe ne soit fautive.

Quatre exigences rendent ce coût acceptable, et aucune n'est facultative.

1. **Les longueurs déclarées s'éprouvent contre les listes écrites.** Chaque liste
   de tour a autant de listes de table que la proposition déclare de tables, et
   chaque liste de table la longueur que la proposition déclare. Ce contrôle est
   **interne** : il compare le fichier à lui-même. C'est le contrôle de cohérence
   du § 8.8 étendu aux placements — l'analyse syntaxique seule ne distingue pas un
   placement complet d'un placement plausible.
2. **Les identifiants se vérifient comme un multiensemble, réserve et absents
   compris.** À chaque tour, chaque identifiant déclaré par la proposition
   apparaît **exactement une fois** dans l'union des listes de table, de la
   réserve et des absents. Une personne absente aux R tours d'un placement n'est
   pas une faute. L'égalité
   d'ensembles ne suffirait pas : sans la réserve stockée et sans le « exactement
   une fois », un identifiant perdu passerait pour quelqu'un qui attend hors des
   tables, cas que le § 12.6 prévoit. Le multiensemble attrape le décalage de
   flux — il duplique un identifiant et en perd un autre —, l'identifiant inconnu,
   et la personne assise deux fois.
   **Ce qu'il n'attrape pas, et le logiciel ne prétend pas le contraire** : une
   permutation à l'intérieur d'une table, ou l'échange du contenu de deux tables de
   même capacité, conservent le multiensemble et les longueurs. Rien dans le
   fichier ne les distingue d'un placement légitime ; ils se voient sur le plan.
3. **Fautif et périmé sont deux choses, et le logiciel ne les confond pas.**
   Fautif = le fichier se contredit lui-même : une longueur fausse, un
   identifiant dupliqué, un identifiant absent de l'ensemble déclaré, une
   proposition qui porte l'identifiant d'une proposition gardée avant elle
   (`IDENTIFIANT_REPETE`), un identifiant de proposition qui atteint le
   compteur reçu (`IDENTIFIANT_HORS_COMPTEUR`). Une proposition écartée n'en
   écarte aucune autre : celle qui porte l'identifiant d'une fautive n'est pas
   une répétition. Périmé = la proposition est cohérente mais ne décrit plus la
   configuration courante : une table supprimée, une capacité changée, une
   personne exclue depuis (§ 4.4), une présence changée depuis, un tour retiré.
   Une proposition **fautive** est nommée, comptée, et l'événement s'ouvre sans
   elle. Une proposition **périmée** n'est pas écartée : c'est la **dérive** du
   § 9, qui avertit et ne bloque pas, et le logiciel dit laquelle et pourquoi.
   Écarter au chargement une proposition périmée détruirait le travail de
   l'opérateur à la suite d'une exclusion, geste qui ne demandait rien de tel.
   Le logiciel ne refuse jamais le fichier entier à cause d'une proposition : la
   saisie, qui est la partie irremplaçable, est dans l'autre région et n'est pas
   touchée.
   > La règle du journal est **l'inverse**, et pour une raison qui n'existe pas
   > ici : une ligne de journal illisible arrête la lecture et emporte tout ce qui
   > suit (§ 8.6), parce qu'un correctif suivrait sinon un instant qui n'est pas le
   > sien. Les propositions sont indépendantes les unes des autres ; chacune tombe
   > seule.
   Le placement **retenu** fait exception : s'il est fautif, le logiciel le dit en
   première ligne et propose la génération de secours `.precedent` (§ 8.8), parce
   que c'est le seul placement dont la perte se voit le soir même.
4. **Une commande rend n'importe quelle proposition sous forme nommée**, pour
   lecture et pour signalement d'un défaut. L'outil de diagnostic n'a pas à être le
   format de stockage — c'est en confondant les deux qu'on paie la lisibilité sur
   chaque enregistrement, à chaque écriture.

#### Ce que les épreuves exigent

- **Aller-retour** : charger, enregistrer, recharger, comparer structure à
  structure, **sur chacun des fichiers de démonstration livrés**. La comparaison
  porte sur la **charge utile**, l'en-tête exclu (§ 8.8). Le balayage refuse de
  passer s'il n'examine aucun fichier (§ 14.2). Sur la grande démonstration, cette
  épreuve est dans la série `node:long` (§ 14.4).
- **Canonicité** : enregistrer deux fois le même état produit deux fichiers
  **identiques octet pour octet**, y compris quand les sièges ne sont pas
  attribués — c'est là que la règle du tri croissant s'éprouve.
- **Corruption délibérée** : le test abîme un fichier de cinq façons — une
  longueur fausse, un identifiant dupliqué, un identifiant inconnu, un
  identifiant manquant sans entrée de réserve, un absent aussi assis — et exige
  que le logiciel nomme chacune et écarte la seule proposition fautive. Un test
  qui ne charge que des fichiers bien formés ne peut pas échouer et ne prouve
  rien (§ 14.2).
- **Péremption délibérée** : le test exclut une personne, change la présence
  d'une autre, supprime une table, réduit une capacité, et exige que les
  propositions touchées soient **signalées comme dérive et conservées**, jamais
  écartées. C'est le test qui empêche la correction suivante de reclasser le
  périmé en fautif.
- **Dérivation** : une proposition sans `depart` s'écrit octet pour octet
  comme avant ; une dérivée, avec et sans tours figés, fait l'aller-retour par
  l'état, par un instantané et par un correctif du journal ; chaque faute de
  dérivation — `depart` égal ou supérieur à l'identifiant, `toursFiges` vide,
  désordonné, hors des tours, complet, ou sans `depart` — écarte la seule
  proposition fautive et se nomme ; une dérivée dont le départ est effacé
  reste comparable et classée.
- **Coût d'enregistrement** : le test mesure la durée d'un enregistrement complet
  sur la grande démonstration et échoue au-delà du seuil mesuré du § 8.2. Il écrit
  sur un système de fichiers réel, donc il est dans `node:long`.

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
de données. Les quatre états se montrent en suite d'étapes, dans cet ordre.
L'état courant porte le fond de sa teinte, son icône et le gras ; chaque étape
reste la commande qui pose son état, et le refus s'affiche à côté d'elle.

**Bloqué refuse toute modification** — tours, options, tables, participants,
import, et jusqu'à la position d'une table à l'écran. La lecture et l'impression
restent ouvertes : on bloque un plan précisément pour le distribuer.

**La dérive avertit, elle ne bloque pas.** Si le mobilier ou les tours
changent après qu'un placement a été retenu, le logiciel le signale et laisse
l'opérateur décider. **Un changement de participants ne fait pas dériver le
retenu** : la présence, un ajout, une réintégration, une exclusion, une
suppression ou un import l'ajustent en place (§ 5.8), et l'arrivée attend dans
la réserve que l'opérateur décide où l'asseoir — lui seul sait si la personne
arrivée en retard doit être placée. Les propositions qu'il touche entrent en
dérive et servent encore de départ (§ 5.7) ; « Retenir » l'une d'elles ajuste
sa copie, et le retenu qui en naît ne dérive pas. Retenir une autre
proposition ne demande confirmation que quand le retenu porte une retouche à
la main : une retouche que retenir de nouveau sa proposition détruirait, à
l'exclusion de l'ajustement aux participants.

**Les raisons d'une dérive se nomment chacune** : une personne exclue depuis
(`PARTICIPANT_EXCLU`) ; supprimée depuis (`PARTICIPANT_SUPPRIME`) ; non placée
depuis — ajoutée ou réintégrée — (`PARTICIPANT_NON_PLACE`) ; « Prénom Nom est
absente aux tours 3 et 4 depuis » (`PRESENCE_RETIREE`) ; « Prénom Nom est
présente au tour 3 depuis » (`PRESENCE_AJOUTEE`) ; une table, une capacité ou
le nombre de tours changés. Les cinq premières sont les **raisons de
participants** : une proposition qui ne porte qu'elles sert encore de départ
(§ 5.7), et, tant que le classement compte moins de N lignes, « Garder les N
meilleures » ne l'efface pas sans l'avoir comparée ; les autres sont celles du
mobilier et des tours, qui refusent un départ.

**Une proposition rendue incohérente par un changement de configuration est une
dérive, jamais une corruption** (§ 8.9) : elle est conservée, signalée, et le
logiciel dit laquelle et pourquoi. L'écarter au chargement détruirait le travail
de l'opérateur à la suite d'une exclusion, geste qui ne demandait rien de tel.

---

## 10. La liste des participants

### 10.1 L'import CSV

**L'aperçu est obligatoire.** Il n'existe pas de bouton « importer
directement » : l'aperçu est la seule garde contre une détection d'encodage ou
de séparateur qui se trompe sans rien faire échouer, et une garde qu'on peut
sauter ne garde rien.

**Les colonnes s'associent par leur en-tête, jamais par leur position** — un
tableur où une colonne a été déplacée importerait sinon les noms dans les
organisations sans rien signaler.

| en-tête | obligatoire | contenu |
|---|---|---|
| `nom` | **oui** | |
| `prenom` | non | |
| `organisation` | non | synonymes : `appartenance`, `entreprise`, `équipe` |
| `courriel` | non | |
| `titre_pressenti` | non | synonymes : `titre`, `rôle` — **informatif, ne pourvoit aucune place** |
| `exclu` | non | liste fermée ; vide vaut `non` |
| `notes` | non | texte libre, jamais interprété |
| `etiquettes` | non | plusieurs par cellule, séparées par `,`, `;`, `\|` ou une fin de ligne (§ 4.5) ; synonymes : `étiquette`, `mots-clés` |
| `presence` | non | les tours de présence : des tours et des plages — « 1-3 », « 2, 3 », « tours 1 et 2 » ; `tous` ou `tous les tours` valent tous les tours ; vide, voir plus bas ; synonymes : `présence`, `tours de présence` |
| `conflit_organisation` | non | les organisations que la personne nomme en conflit (§ 4), plusieurs par cellule, séparées par `;`, `\|` ou une fin de ligne — une virgule reste dans le nom ; voir plus bas ; synonymes : `conflits`, `conflit d'organisation` sous ses deux apostrophes |
| `animation_reservee` | non | la marque de l'animation réservée (§ 4), par la liste fermée d'`exclu` ; voir plus bas ; synonymes : `animation réservée`, `animation réservé` — **l'import ne désigne personne** |
| `inclusion_organisation` | non | les organisations que la personne doit rencontrer au moins une fois (§ 4), séparées comme les conflits ; voir plus bas ; synonymes : `inclusions d'organisation` sous ses deux apostrophes |
| `inclusion_participant` | non | les personnes qu'elle doit rencontrer au moins une fois (§ 4), chacune par son prénom puis son nom, séparées comme les conflits ; voir plus bas ; synonyme : `inclusions de participant` |

Les en-têtes se reconnaissent **sans tenir compte de la casse, des accents,
des blancs, des traits de soulignement ni des traits d'union** :
« Titre-Pressenti », « titre pressenti » et « titre_pressenti » désignent la
même colonne. **Deux colonnes reconnues sous le même nom** ne se départagent
pas toutes seules : le logiciel n'associe ni l'une ni l'autre et demande.

**La valeur de `exclu`** appartient à une liste fermée : `oui`, `o`, `vrai`,
`1` ou `x` pour une exclusion ; `non`, `n`, `faux`, `0` ou vide pour aucune ;
sur la forme normalisée de la clé de doublon (plus bas) — casse et accents
ignorés, blancs de bord retirés, une suite de blancs réduite à une espace : un
blanc à l'intérieur d'une valeur compte, et « o u i » n'est pas « oui ». Toute
autre valeur **refuse la ligne**. Traiter l'inconnu comme `non` placerait dans
la salle une personne qui s'est désistée, et la chaise vide ne se verrait que le
soir même.

**La valeur de `animation_reservee`** se lit par la même liste fermée, sur la
même forme normalisée : `oui`, `o`, `vrai`, `1` ou `x` posent la marque de
l'animation réservée ; `non`, `n`, `faux` ou `0` l'écartent. Toute autre valeur
**refuse la ligne** (`ANIMATION_INCONNUE`, qui cite la valeur), après le refus
d'`exclu` et avant ceux des étiquettes : une cellule « Table d'honneur »
écrite là où l'on attend oui ou non ne dit pas si la personne est à désigner.
À la création, une cellule vide vaut `non` ; en mise à jour, elle garde la
marque de la personne, et une cellule non vide la pose ou la retire. **L'import
ne désigne personne** : il ne crée ni réservation ni titre, puisque les tables
qui recevront les animateurs ne sont pas encore connues. Quand la liste des
participants, après l'import, compte des personnes marquées, non exclues, qui
n'animent aucune table, le rapport d'import les compte, en information, et nomme
les gestes qui les désignent : « Créer les tables… », s'il manque des places,
puis la rangée « Animateurs » d'une table, dans « Tables et tours » (§ 2.1
étape 6, § 6.1). Une personne absente à un tour en est, et se désigne une fois
sa présence rendue (§ 5.9).

**La valeur de `presence`** se lit par une seule grammaire, celle que l'aperçu,
l'export et le modèle emploient (§ 13.2) : sans égard à la casse, chaque morceau
est un tour, entier de 1 à R en chiffres, ou une plage, le trait d'union, le
tiret demi-cadratin ou « à » entre deux tours ; « et », la virgule, le
point-virgule et les blancs séparent ; un préfixe « tour » ou « tours » se lit ;
les recouvrements se fondent ; une cellule qui nomme chaque tour vaut tous les
tours. Ce qui n'est ni un tour ni une plage, une plage inversée, une date qu'un
tableur a faite d'une plage — « 01-mars » — refusent la ligne
(`PRESENCE_ILLISIBLE`, le motif disant de mettre la colonne en texte quand c'est
une date) ; un tour hors de la soirée aussi (`PRESENCE_HORS_TOURS`, qui nomme le
tour et le nombre de tours de l'événement) : traiter l'inconnu comme « tous les
tours » placerait une personne aux tours où elle ne vient pas. Ces refus se
contrôlent après ceux des étiquettes. **À la création, une cellule vide vaut
tous les tours ; en mise à jour, elle garde la présence de la personne**, comme
tout champ, l'aperçu l'écrivant « présence inchangée » sur chaque ligne qui
désigne une personne existante, et sur elle seule — une ligne qui ne désigne
personne est créée, même en mise à jour, et sa cellule vide n'y dit rien —, et
`tous` la rend à tous les tours. Une cellule non vide remplace la présence ; la
comparaison se fait sur la forme canonique, si bien qu'un réimport de l'export
ne compte aucune personne modifiée. **Un aperçu calculé avant un changement du
nombre de tours ne s'applique pas** (`APERCU_TOURS_CHANGES`) : sa lecture des
tours n'est plus celle de la soirée, et relire le fichier refait l'aperçu. Un
import qui étend la présence d'une personne existante à un tour où sa
réservation ferait déborder une table est refusé entier (§ 5.9).

**La valeur de `conflit_organisation` se lit avant de valider quoi que ce
soit**, contre toutes les organisations que l'import laisse : celles des
participants existants, exclus compris, hors du mode « remplacer », qui les
retire, et celles des lignes valides du fichier que l'import pose — une
organisation que le fichier crée compte, même nommée plus haut que la ligne qui
la porte ; en mise à jour, celle d'une ligne que la mise à jour refuse
(`PLUSIEURS_CORRESPONDENT`, `DEJA_DESIGNE`) ne compte pas, puisque personne ne
la portera. La cellule se découpe sur ses séparateurs ; puis, de gauche à
droite, chaque nom est le plus long assemblage de morceaux consécutifs, rejoints
par les séparateurs que la cellule porte entre eux, dont la clé normalisée est
celle d'une de ces organisations, ou le morceau seul quand aucun ne l'est : un
nom d'organisation qui porte lui-même « ; » ou « | » se relit ainsi entier.
Chaque nom se met en NFC sans ses blancs de bord, les noms vides s'écartent, et
deux noms de même clé normalisée n'en font qu'un. Chaque nom s'apparie par la
clé de la réconciliation des organisations (plus bas) et se range sous
l'orthographe que l'événement emploie déjà, sinon sous la première que le
fichier écrit. **Un nom qu'aucune organisation ne porte refuse le fichier
entier** (`CONFLIT_ORGANISATION_INCONNUE`) — « L'organisation « Société Gamma »
n'existe pas (ligne 4, colonne des conflits). Rien n'est importé. » —, comme la
propre organisation de la personne (`CONFLIT_ORGANISATION_PROPRE`), comparée par
la même clé : celle de sa ligne, ou, en mise à jour sous une cellule
d'organisation vide, celle de la seule personne que la ligne désigne. La
première faute dans l'ordre du fichier, puis de la cellule, est nommée, avec le
nom tel que la cellule l'écrit et le rang de sa ligne ; l'aperçu ne montre alors
aucune ligne, et son remède invite à corriger la cellule — ou à ajouter au
fichier une personne de l'organisation — puis à importer le fichier de nouveau ;
sous un texte collé, il dit de corriger le texte et de le coller de nouveau.
Importer le reste ferait d'un conflit mal écrit un conflit perdu, sans que rien
ne le dise. À la création, une cellule vide ne nomme aucun conflit ; en mise à
jour, elle garde la liste de la personne, et une cellule non vide la remplace,
la comparaison se faisant sur la liste rangée.

**Les valeurs des colonnes `inclusion_organisation` et `inclusion_participant`
se lisent elles aussi avant de valider quoi que ce soit**, après celles des
conflits, ligne à ligne dans l'ordre du fichier, la cellule des organisations
avant celle des personnes. Les deux cellules se découpent comme celle des
conflits, par le plus long assemblage de morceaux, et aucun synonyme ne dit
« inclusion » seul, qui ne dirait pas laquelle. **Une organisation incluse** se
lit contre les mêmes organisations que les conflits, par la même clé, sous la
même orthographe : celle qu'aucune ne porte refuse le fichier entier
(`INCLUSION_ORGANISATION_INCONNUE`), comme la propre organisation de la personne
(`INCLUSION_ORGANISATION_PROPRE`). **Une personne incluse** se nomme par son nom
affiché — le prénom, une espace, puis le nom, le nom seul sans prénom (§ 8.2) —
et se lit contre les personnes que l'import laisse dans la liste, sous le nom
qu'il leur laisse : les participants existants, hors du mode « remplacer », et
les lignes valides que l'import crée, même plus bas que la ligne qui les nomme ;
en mise à jour, une personne que le fichier met à jour ne compte qu'une fois,
sous le nom et le prénom que sa ligne lui pose ; une ligne que l'import refuse,
dans tout mode, ne crée personne, si bien que son nom ne s'y trouve pas. Le nom
s'apparie par la clé normalisée. Un nom qu'aucune personne ne porte refuse le
fichier entier (`INCLUSION_PARTICIPANT_INCONNU`), comme un nom que plusieurs
portent (`INCLUSION_PARTICIPANT_AMBIGU`) — deux homonymes ne se départagent
jamais au hasard ; un nom que « Rendre les noms uniques » a numéroté,
« Roger Galet 01 », n'en est pas un — et le nom de la personne de la ligne
elle-même (`INCLUSION_PARTICIPANT_SOI`). La première faute est nommée, avec
l'organisation ou le nom tels que la cellule les écrit et le rang de sa ligne ;
l'aperçu ne montre alors aucune ligne, et son remède dit la correction :
corriger la cellule ou ajouter au fichier la personne ou l'organisation — ou
corriger la ligne refusée qui porte la personne —, distinguer par leur nom, dans
le fichier ou dans leur fiche, les personnes qui portent un nom ambigu, retirer
la sienne ou soi-même ; puis importer le fichier de nouveau, ou, sous un texte
collé, le coller de nouveau. Un collègue de sa propre organisation se nomme
comme un autre, et une inclusion que contredit un conflit de la personne s'admet
(§ 4). L'import écrit chaque personne incluse sous son identifiant, celui
qu'elle a ou celui que sa ligne reçoit, la liste rangée ; à la création, une
cellule vide n'inclut rien ; en mise à jour, elle garde la liste de la personne,
et une cellule non vide la remplace, la comparaison se faisant sur la liste
rangée. Les colonnes des inclusions ne se montrent dans le tableau des lignes de
l'aperçu que lorsque le fichier les porte, chaque nom en pastille à l'icône
« ajouter » ; montrées, le tableau peut défiler dans son cadre, jamais la page.

**L'encodage se tranche en quatre temps, dans cet ordre :** marque d'ordre
d'octets UTF-8 ; marque UTF-16 ; **un octet nul dans les quatre premiers
kibioctets sans marque** → refus global avec le remède nommé
(`UTF16_SANS_MARQUE`) ; sinon décodage UTF-8 strict, et repli sur windows-1252
en cas d'échec.

**Une marque déclare l'encodage, et rien ne la dément.** Des octets qui ne sont
pas l'UTF-8 ou l'UTF-16 qu'elle annonce — une séquence invalide, un nombre
impair d'octets, un substitut isolé — refusent le fichier (`UTF8_INVALIDE`,
`UTF16_INVALIDE`) : un repli sur windows-1252 changerait chaque accent de la
partie valide en caractères parasites, « Benoît » en « BenoÃ®t », et un décodage
indulgent sèmerait des caractères de remplacement dans les noms. Quel que soit
le temps qui a décodé, **un texte qui porte le caractère nul est refusé**
(`CARACTERE_NUL`) — un collage aussi, qui ne porte pas d'octets : le refus
rattrape un octet nul au-delà des quatre kibioctets, et un fichier que sa marque
fait lire sans erreur sous un autre encodage, la marque de l'UTF-32 LE
commençant par celle de l'UTF-16 LE. Chaque refus d'encodage nomme le même
remède : réenregistrer le fichier en UTF-8.

> L'étape 3 n'est pas une précaution de principe : **un texte UTF-16 sans
> marque se décode sans erreur dans l'un ou l'autre des temps suivants**. En
> ASCII, il est de l'UTF-8 valide, chaque octet nul s'y décodant comme le
> caractère nul ; accentué, il cesse de l'être et retombe sur windows-1252, qui
> accepte tout octet. Dans les deux cas, les noms arrivent entrelardés de
> caractères nuls, qui ne font échouer aucun calcul. Un ordre à trois temps
> produirait ce défaut muet, qui ne se découvre que sur le plan imprimé.

**Le séparateur** se choisit entre `;`, `,` et la tabulation, en **analysant**
les vingt premiers enregistrements : le candidat retenu termine sans guillemet
ouvert, donne le même nombre de champs partout, **et ce nombre dépasse 1**. À
égalité, celui qui donne **le plus d'en-têtes reconnus**. Quand aucun candidat
ne convient et que la première ligne entière est un en-tête reconnu, **le
fichier n'a qu'une colonne** — une liste de noms — et chaque ligne est un seul
champ : un nom qui porte une virgule reste entier. Sinon, le fichier est
refusé, et le refus nomme ce qui écarte le séparateur.

> Les deux dernières conditions ne sont pas des raffinements. Sur un fichier
> séparé par des virgules, `;` donne lui aussi un nombre de champs parfaitement
> constant : **un**. Une règle qui ne retiendrait que la constance importerait
> chaque ligne entière dans la colonne `nom`.

**Les organisations se réconcilient sur la même forme normalisée que la clé de
doublon** — espaces réduits, casse et accents ignorés ; la première orthographe
rencontrée s'affiche. **Le rapport d'import nomme chaque groupe d'orthographes
fondues et son nombre de lignes** : une fusion silencieuse est aussi fausse
qu'une séparation silencieuse. Une organisation vide vaut **absence**, jamais
une organisation nommée « ».

> Sans cette réconciliation, deux orthographes d'une même organisation
> deviennent deux organisations : « séparer les organisations » cesse de séparer
> deux collègues, G est gonflé, et A_max avec lui. Le défaut est muet — aucun
> indicateur ne s'en aperçoit.

**Les étiquettes se lisent par la règle de la saisie** (§ 4.5) : la cellule se
découpe sur ses séparateurs, chaque morceau se met en forme, les morceaux vides
s'écartent, et deux morceaux de même clé n'en font qu'un. Elles se réconcilient
ensuite sur la clé normalisée avec les étiquettes de l'événement — celles des
personnes, hors du mode « remplacer », qui les retire, et celles des objectifs
de table, qui restent sous tout mode parce qu'elles appartiennent aux tables —,
puis entre les lignes ; le rapport nomme chaque groupe d'orthographes fondues et
son nombre de lignes, en information. Une étiquette mal formée — plus de 40
points de code, ou un caractère de contrôle ou invisible autre que la fin de
ligne — refuse la ligne (`ETIQUETTE_MAL_FORMEE`), une vingt-et-unième étiquette
sur une même ligne aussi (`ETIQUETTES_TROP_NOMBREUSES`) : la tronquer ou
l'écarter en silence ferait manquer un objectif sans que rien ne le dise. En
mise à jour, une cellule non vide **remplace** les étiquettes de la personne, et
une cellule vide les garde : un CSV n'efface pas les étiquettes.

L'aperçu et le rapport classent chacun de leurs messages en **refus** — le refus
global, les lignes refusées —, **avis** — les doublons, les homonymes d'une mise
à jour, les cellules sur plusieurs lignes qui portent le séparateur — ou
**information** — les orthographes fondues, les noms rendus uniques, un import
qui n'a rien écrit, les personnes à désigner animatrices qu'il laisse. Une
pastille nomme la classe en texte, avec son icône ; la couleur la redit.

**La ligne invalide : importer le reste.** Le logiciel importe les lignes
valides et **réexporte les refusées** en un CSV reprenant les colonnes
d'origine, augmenté de `ligne` et `motif` — deux colonnes qu'aucun en-tête ne
reconnaît, donc le fichier corrigé se réimporte tel quel. `ligne` porte le
numéro de l'enregistrement, en-tête compris : celui qu'un tableur affiche, un
champ cité sur plusieurs lignes du texte n'y comptant qu'une fois. Sur 260
lignes, un refus global coûterait l'import entier pour une faute en ligne 213.

Hors de l'encodage et du séparateur, six cas restent des refus **globaux** :
aucun en-tête reconnaissable, aucune colonne associée à `nom`, zéro ligne
valide, **un guillemet resté ouvert** jusqu'à la fin du texte
(`GUILLEMET_OUVERT`, avec l'enregistrement où il s'ouvre) — tout ce qui le suit
tiendrait dans un seul champ, et deux personnes se fondraient en une —,
**un conflit d'organisation fautif** et **une inclusion fautive**, vus plus
haut.

**L'import entier est une seule entrée d'historique.** Les personnes qu'il crée
prennent leurs identifiants à la suite du compteur, dans l'ordre du fichier ;
quand la dernière demanderait plus que 2³¹ − 2, l'import est refusé entier
(`COMPTEUR_SATURE`, § 8.9) avant qu'aucune ne soit numérotée. En mise à jour,
seule une ligne qui ne désigne personne en demande un.

**Les doublons** se repèrent sur le triplet (nom, prénom, organisation)
normalisé, et le logiciel **ne fusionne jamais tout seul** : deux personnes
portent le même nom, et la fusion silencieuse fait disparaître un convive qui se
présentera quand même. Chaque doublon nomme la personne, prénom et nom tels que
sa première ligne les écrit, puis ses lignes en une phrase — « lignes 15, 16
et 17 », les rangs de la colonne « Ligne », en-tête compris —, puis les
personnes de la liste qu'il recoupe.

**« Rendre les noms uniques »**, offert dans le bloc des doublons, distingue les
personnes sans en fusionner aucune : dans chaque doublon, le premier porteur du
triplet garde son nom — la personne de la liste quand le doublon en recoupe
une, sinon la première ligne du fichier —, et chaque autre ligne, dans l'ordre
du fichier, reçoit au nom une espace et un numéro : « 01 », « 02 »…, deux
chiffres, trois au-delà de 99 ; le prénom ne change pas. Le nom « Galet », prénom
« Roger », devient « Galet 01 », « Roger ». Un nom suffixé que porte déjà une
personne de la liste ou une ligne du fichier, valide ou refusée, ou qu'un autre
doublon vient de recevoir, comparé par la clé normalisée, saute au numéro libre
suivant. En mise à jour, une ligne que l'import applique à une personne de la
liste est cette personne, non un doublon : elle garde son nom, que le suffixe
changerait en création ; sous « Remplacer », la liste retirée ne compte pas.
Le fichier n'est jamais réécrit : l'aperçu se recalcule sur les noms rendus, le
bloc des doublons se vide — sauf, en mise à jour, les lignes qui mettent à jour
leur personne —, et l'import applique ces noms ; l'aperçu, puis le rapport
d'import, comptent les noms rendus uniques, en information. Chaque personne
créée sous un nom rendu porte la marque du nom numéroté (§ 8.9), **cachée** : la
fiche ne la montre ni ne la saisit, et aucune colonne CSV ne la porte, ni à
l'import ni à l'export ; un nom que le fichier écrit déjà suivi d'un numéro ne
la reçoit pas. La commande n'est offerte que lorsqu'elle rend un nom au moins,
et vaut pour le texte ouvert, sous chaque mode et chaque choix de colonnes,
jusqu'à ce qu'un autre texte ou une autre nature l'ouvre de nouveau.

**Mettre à jour n'efface pas** : un champ vide dans le fichier laisse la valeur
existante. Un fichier ne portant que les noms effacerait sinon tous les
courriels, d'un geste qui s'annonce comme une mise à jour.

**Remplacer annonce ce qu'il détruit**, réservations et titres compris :
« 260 personnes seront supprimées » laisse croire qu'on ne perd que des noms.
La fenêtre à confirmer compte les personnes, les réservations, les titres qui
perdront leur réservation et les propositions qui deviendront périmées, puis
les inclusions que portent les personnes retirées — chacune vise une personne
retirée ou part avec elle —, seulement quand elles en portent, puis les logos
que le remplacement retire, seulement quand il en retire.

**Importer selon l'état** : sans avertissement en brouillon et proposé ; en
retenu, avec l'avertissement que le placement retenu suit la présence de chacun,
les arrivées en réserve et les départs laissant leur chaise vide (§ 5.8) ;
**refusé** en bloqué, le message nommant la commande qui déverrouille.

**Le modèle à télécharger.** La section d'import offre « Télécharger un modèle »
pour la nature cochée (§ 10.4) ; la commande passe par « Enregistrer sous… » et
n'écrit rien dans l'événement : elle est permise en lecture et sur un plan
bloqué. Son nom accessible nomme la nature, et le chemin enregistré s'annonce
sous elle. Le modèle a la forme de l'export — UTF-8 avec marque, `;`, CRLF, les
en-têtes de l'import — et **s'importe tel quel sans refuser aucune ligne**.
Celui des participants, `modele-participants.csv`, est réglé par le nombre de
tours de l'événement pour sa seule colonne `presence` : quatre personnes
inventées, dont les cellules remplissent chaque colonne du tableau ci-dessus,
`exclu` sous ses deux valeurs, `animation_reservee` aussi — `oui` pour la
personne au titre pressenti —, une cellule à deux étiquettes, un conflit, que la
personne sans organisation nomme envers l'organisation de l'exclue — une
organisation existe aussi par ses exclus —, une inclusion de cette même
organisation, celle de l'exclue, que nomme une autre personne, une inclusion de
participant, la personne sans organisation, et deux présences, l'une de 1 à
l'avant-dernier tour, l'autre aux tours 2 et 3 : « 1-3 » et « 2, 3 » à quatre
tours, « 1, 2 » et « 2, 3 » à trois, « 1 » et « 2 » à deux ; à un tour, la
colonne reste vide. Il s'importe tel quel sous tout nombre de tours, dans une
liste vide, en mise à jour ou en remplacement ; ajouté à une liste qui porte
déjà la personne sans organisation, son inclusion de participant nomme deux
personnes et refuse le fichier entier (`INCLUSION_PARTICIPANT_AMBIGU`).
Celui des objectifs suit l'événement (§ 10.4).

**Le guide de l'import.** Sous « Télécharger un modèle », dernier de la carte
de l'import, un bloc replié, « Guide import », décrit le fichier attendu pour
la nature cochée. Il est **fermé à l'ouverture de la section** ; son bouton
l'ouvre et le ferme, à la souris comme au clavier, dit son état par
`aria-expanded` et désigne le contenu ouvert par `aria-controls`. Son état
n'appartient qu'à l'écran : il ne s'écrit ni dans l'événement ni dans les
réglages, et il n'écrit rien, en lecture comme sur un plan bloqué. Ouvert, il
porte quelques consignes — les en-têtes reconnus sans égard à la casse, aux
accents, aux blancs, à « _ » ni à « - », l'ordre des colonnes libre et une
colonne inconnue ignorée ; le séparateur et l'encodage détectés, et nommés
par l'aperçu ; le modèle aux bons en-têtes ; rien d'importé avant l'aperçu —,
puis un tableau, **une ligne par colonne reconnue**, dans l'ordre de la table
d'en-têtes de la nature : l'en-tête, s'il est obligatoire, ce que la colonne
contient et comment une cellule sépare plusieurs valeurs, et les synonymes.
**En-têtes et synonymes se lisent dans la table d'en-têtes**, celle de la
reconnaissance (§ 19.8), jamais recopiés — deux écritures qui ne diffèrent
que par l'apostrophe, droite ou typographique, s'y montrent une fois, la
première : une colonne ajoutée à la table paraît au guide, et une colonne
sans texte de guide fait échouer une épreuve.
Le texte d'une colonne suit ce paragraphe et le § 10.4 : une liste fermée —
`exclu`, `animation_reservee`, `regle` — s'y donne en entier, la ligne
`animation_reservee` dit que l'import ne désigne personne et que « Créer les
tables… » désigne les personnes marquées, la ligne `conflit_organisation` et
celle d'`inclusion_organisation` disent qu'une virgule ne sépare pas deux
organisations, qu'elle reste dans le nom, et la ligne `inclusion_participant`
qu'une personne s'y écrit par son prénom puis son nom.
Changer de nature change le tableau, le bloc restant ouvert.

### 10.2 La saisie

Seul `nom` est obligatoire : refuser une personne faute de courriel pousse
l'opérateur à inventer une valeur, qui ne se distingue plus ensuite d'une vraie.

Trois mécanismes rendent tenable la saisie de 260 personnes :

1. **Le collage en bloc**, passé **au même analyseur** que l'import — un second
   analyseur « simplifié » divergerait sur les accents et les guillemets, et les
   tests des deux resteraient verts.
2. **Le formulaire d'ajout repart vide** : un ajout abouti vide tous ses
   champs, l'organisation comprise, et rend le focus au nom. Une valeur restée
   d'un ajout passerait inaperçue et s'enregistrerait sur la personne suivante.
3. **La grille éditable**, au clavier, avec tri et filtre. Corriger est ce que
   l'opérateur fait le plus, la veille et sur place.

**Le formulaire d'ajout confirme chaque ajout.** « Ajouter », ou Entrée dans un
champ, écrit `ajouterParticipant` ; abouti, un message nomme la personne
ajoutée — « Personne ajoutée : Iris Ombrelle », son nom lu comme la commande
l'enregistre —, dans une région `role="status"` qui l'annonce sans prendre le
focus. Il paraît sur la ligne du titre de la bande, à sa droite, ou dessous
quand la bande est étroite, au-dessus du nom où revient le focus ; la ligne en
garde la hauteur, et sur une bande large les champs ne bougent ni quand il
paraît ni quand il se retire. Il se retire seul au bout de cinq secondes, ou au
prochain envoi : un ajout suivant le remplace par le sien, un refus le retire.
Il ne vaut que pour la révision de son ajout : Défaire, ou toute autre
écriture, le retire, et il ne nomme jamais une personne absente de la liste.
Le formulaire remonté — retour d'une autre section, fermeture d'« À propos » —
repart vide et sans message. Pendant l'écriture d'un ajout, une seconde
soumission ne fait rien ; ce que l'opérateur tape entre-temps reste dans ses
champs, et seuls ceux qui portent encore la valeur envoyée se vident.

La liste des participants porte une ligne de comptes — personnes, à placer,
exclues, organisations, et « 2 présences partielles » quand des personnes non
exclues n'ont pas tous les tours — et une légende des organisations, chacune
avec le nombre de personnes qui la portent, exclues comprises ; dans la grille,
l'organisation s'affiche en pastille de sa teinte (§ 12.7), le titre pressenti
et l'exclusion en pastilles à icône.

**Les informations d'une personne se modifient dans sa fiche.** En tête de la
fiche, ses six valeurs de texte — nom, prénom, organisation, courriel, titre
pressenti, notes — se lisent chacune sous l'intitulé de sa colonne, « — » quand
elle manque, puis son animation réservée (§ 4), « oui » ou « non », son statut
calculé et la commande « Modifier ». « Modifier » ouvre à leur place un
formulaire prérempli, un champ par valeur, les notes en zone de texte,
l'organisation proposant celles de l'événement, puis la case « Animation
réservée », cochée sous la marque ; le focus va au nom. Cocher ou décocher la
case est un changement comme un autre : il part dans la même entrée, la marque
posée ou retirée, et « Défaire » la rend. « Enregistrer », ou Entrée —
Maj+Entrée garde un saut de ligne dans les notes —, écrit **une** entrée
d'historique, `modifierParticipant` des seuls champs que la saisie change depuis
l'ouverture et qui diffèrent encore de la personne, lus comme la saisie les
enregistre, que son libellé nomme ; sans champ changé, le formulaire se referme
sans rien écrire. Une écriture venue d'ailleurs pendant la saisie — une autre
fenêtre, Défaire — garde les champs que la saisie ne touche pas, et ne tient pas
le geste. « Annuler », ou Échap, le referme sans rien écrire ; refermé, il rend
le focus à « Modifier ». Une organisation saisie qui ne diffère de celle d'une
autre personne que par la casse, les accents ou les blancs s'enregistre sous
l'orthographe existante, et un signal le dit sous le bloc ; une organisation que
la saisie ne touche pas reste la sienne, même voisine d'une autre ; la seule
personne à porter une organisation en change la casse ; une saisie dont
l'orthographe retenue est déjà celle de la personne ne change rien et ne se
signale pas. Quand les listes de conflits suivent le changement d'organisation
(§ 4), un avis le dit sous le bloc, et un second quand les listes d'inclusions
d'organisation le suivent ; signal et avis tombent avec la révision qui les a
produits. Un refus garde le formulaire ouvert et la saisie : un nom vide se
refuse contre le nom (`NOM_REQUIS`), tout autre refus sous « Enregistrer », avec
son remède. En lecture et sur un plan bloqué, « Modifier » refuse à côté du
bouton, avec son remède, avant d'ouvrir le formulaire. Ouvrir la fiche d'une
autre personne referme le formulaire sans rien écrire. Les conflits
d'organisation, les inclusions, la présence et l'exclusion gardent leurs
commandes, hors du formulaire, et leurs rubriques restent actives pendant la
saisie.

**Renommer une personne retire la marque du nom numéroté** (§ 8.9) : un
`modifierParticipant` qui change le nom, par la fiche ou par la cellule de la
grille, la retire dans la même entrée, même quand le nom saisi finit par un
numéro — un nom retapé est voulu tel quel —, et « Défaire » la rend avec
l'ancien nom. Changer un autre champ la garde ; le libellé de l'entrée ne la
nomme pas.

La fiche d'une personne porte ses étiquettes, en pastilles **neutres** — la
teinte d'organisation ne sert qu'à l'organisation (§ 12.7) —, chacune suivie,
en mode écriture seulement, d'une petite croix cerclée rouge qui la retire,
nommée « Retirer « étiquette » » pour les technologies d'assistance, et un
champ qui en ajoute une ou plusieurs, séparées comme dans une cellule CSV ; la saisie passe par la même lecture que l'import (§ 4.5,
§ 10.1). Quand l'événement porte des étiquettes, une légende des étiquettes suit
celle des organisations, chacune avec le nombre de personnes qui la portent,
exclues comprises.

**Le logo d'une personne se pose dans sa fiche.** La rubrique « Logo », entre
les valeurs et les étiquettes, montre la vignette du logo (§ 8.9) sur le papier
blanc des badges, en clair comme en sombre, ou « Aucun logo. », ou « Logo
introuvable » quand son image manque au dossier de l'événement — un événement
importé d'un seul fichier, une image retirée à la main — ou ne se lit pas.
« Logo » ouvre le dialogue des images, puis pose ou remplace le logo ;
« Retirer le logo », en écriture seulement, le retire sans effacer l'image.
Sous « Logo introuvable », choisir de nouveau la même image la remet en place :
la vignette paraît, sans entrée au journal. Toute image que le moteur
de rendu décode s'accepte — PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, et SVG,
rastérisé à 1 200 pixels de plus grand côté ; une photo HEIC, une image TIFF
ou un fichier illisible se refusent, `LOGO_ILLISIBLE`, d'un texte qui dit de
l'exporter en JPEG ou en PNG. Un fichier de plus de 25 Mo se refuse sans être
lu (`TROP_VOLUMINEUX`), une image de plus de 50 millions de pixels sans être
décodée (`LOGO_TROP_GRAND`). L'interface convertit l'image en PNG : orientation
EXIF appliquée, transparence gardée, plus grand côté ramené à 1 200 pixels,
jamais agrandi. En lecture et sur un plan bloqué, « Logo » refuse avant que le
dialogue s'ouvre, le refus posé à côté du bouton avec son remède. Un clic sur
la vignette montre l'image à la largeur de la fiche, dans la fiche même —
aucune fenêtre ne s'ouvre (§ 5.9) —, avec « Fermer », qui, comme Échap, rend
la vignette ; la vue se lit dans tout mode, et un autre chemin la referme.

**La présence se saisit dans la grille et dans la fiche.** La colonne
« Présence » de la grille, après celle de l'exclusion, écrit « tous », en encre
secondaire, ou les tours de présence en pastille d'information à calendrier —
« tour 2 », « tours 1 et 2 », « tours 1 à 3 et 5 ». Entrée ou F2 l'ouvre en
cases, une par tour, nommées « Tour 2 » — ou du nom du tour (§ 4) — pour les
technologies d'assistance, dans un groupe nommé « Présence de Prénom Nom, une
case par tour » ; ← et → passent d'une case à l'autre, Début et Fin à la
première et à la dernière, sans boucler, et l'espace coche ou décoche **sans
rien écrire**. **Entrée, Tab ou la sortie du groupe valident**, en une seule
entrée d'historique, qui ajuste le retenu (§ 5.8) ; Tab puis la sortie qui le
suit ne valident pas deux fois, et une saisie revenue à la présence enregistrée
n'écrit rien. Échap rend la présence enregistrée. La fiche porte une rubrique
« Présence », entre les étiquettes et les réservations : un résumé, les mêmes
cases, « Tous les tours », qui coche chaque case sans rien écrire, et
« Appliquer », qui écrit en une entrée ; l'itinéraire du placement retenu y dit
« absente » à un tour d'absence. Une saisie sans aucun tour est refusée contre
les cases, sans remède : son texte nomme l'exclusion. Un changement est refusé
en lecture et sur un plan bloqué, le refus posé dans la cellule ou sous les
cases, avec son remède. La grille trie la colonne « tous » en tête, puis par la
liste des tours, et se groupe par présence.

**Les conflits d'organisation se saisissent dans la grille et dans la fiche.**
La colonne « Conflit d'organisation » de la grille suit celle de
l'organisation ; elle écrit chaque organisation que la personne nomme, en
pastille neutre à l'icône « interdit » — la teinte d'organisation reste à
l'organisation (§ 12.7) —, et rien sans conflit. Entrée ou F2 l'ouvre en
**choix multiple** : une case par organisation de l'événement, exclus compris,
hors la sienne, rangées par clé normalisée, chacune nommée par l'organisation,
dans un groupe nommé « Conflits d'organisation de Prénom Nom, une case par
organisation » ; un nom que la liste porte et que l'événement n'a plus y reste,
coché, pour qu'il se décoche. Les touches sont celles des cases de la
présence : ← et → passent d'une case à l'autre, Début et Fin aux bouts, sans
boucler, l'espace coche ou décoche sans rien écrire, Entrée, Tab ou la sortie
du groupe valident, Échap rend la liste enregistrée ; au-delà de quelques
lignes, le groupe défile, la case reçue amenée dans sa vue. Sans autre
organisation, le groupe le dit et prend lui-même le focus. **Valider écrit le
geste entier en une commande** — `changerConflits` de la liste saisie, ajouts
et retraits ensemble, une seule entrée d'historique (§ 8.2), que « Défaire »
reprend d'un coup —, et rien quand la saisie revient à la liste enregistrée. La
fiche porte une rubrique « Conflits d'organisation », entre les étiquettes et
les inclusions : un résumé — les organisations en pastilles, ou « Aucun conflit
d'organisation. » —, le même choix multiple sous la légende « Organisations à
éviter », et « Appliquer », qui écrit de même ; Entrée dans les cases applique,
Échap rend la liste enregistrée. Un refus — séance en lecture, plan bloqué — se
pose dans la cellule ou sous les cases, avec son remède, la saisie gardée. La
grille trie la colonne sur la liste rangée de ses clés normalisées, une
personne sans conflit après toutes les autres ; elle ne se groupe ni ne se
filtre par elle : une personne y porte plusieurs noms.

**Les inclusions se saisissent dans la fiche et dans la grille** (§ 4). La fiche
porte deux rubriques, l'une sous l'autre entre les conflits d'organisation et la
présence : « Inclusions d'organisation » et « Inclusions de participant ».
Chacune a son résumé — les organisations incluses en pastilles neutres à l'icône
« ajouter », les personnes incluses par leur nom, ou « Aucune inclusion
d'organisation. », « Aucune inclusion de participant. » —, son choix multiple et
son « Appliquer », qui écrit la liste entière en une commande,
`changerInclusionsOrganisation` ou `changerInclusionsParticipant`, une seule
entrée d'historique, et rien quand la saisie revient à la liste enregistrée. Le
choix des organisations offre une case par organisation de l'événement, exclus
compris, hors la sienne, rangées par clé normalisée, sous la légende
« Organisations à rencontrer », dans un groupe nommé « Inclusions d'organisation
de Prénom Nom, une case par organisation ». Celui des personnes offre une case
par personne de l'événement hors elle-même, exclues comprises, rangées par la
clé normalisée de leur nom puis par identifiant, jamais par une comparaison de
langue, sous la légende « Personnes à rencontrer », dans un groupe nommé
« Inclusions de participant de Prénom Nom, une case par personne » : un homonyme
y porte son identifiant, « Iris Ombrelle (n° 4) », une exclue « (exclue) ». Un
nom que la liste porte et que l'événement n'a plus y reste, coché, pour qu'il se
décoche. Une zone de recherche, en tête des personnes, « Chercher une
personne », ne montre que les cases dont le nom contient le texte tapé, sans
égard à la casse ni aux accents, et dit quand aucune ne le contient ; elle ne
change pas la saisie — une case cochée qu'elle cache reste cochée —, et Échap la
vide. Les touches des cases sont celles des conflits ; Entrée, dans les cases
comme dans la recherche, applique, et Échap dans les cases, ou dans la recherche
vide, rend la liste enregistrée. Un refus — séance en lecture, plan bloqué — se
pose sous les cases de sa rubrique, avec son remède, la saisie gardée. Ouvrir la
fiche d'une autre personne repart de ses listes, sans brouillon ni refus. Sous
le résumé de chaque rubrique, les inclusions de la liste que le diagnostic dit
hors d'atteinte (§ 5.6), sous « Hors d'atteinte, aucun placement ne peut les
satisfaire : », chacune par sa cible et sa raison — « Théo Pervenche : les deux
ne sont jamais présentes au même tour » — : une information, que la saisie ne
refuse pas, et qui suit la configuration, placement ou non.

La colonne « Inclusions » de la grille, juste après celle des conflits du
placement, est **masquée par défaut**, avec celle des inclusions du placement
qui la suit (plus bas) : la case « Montrer les inclusions », dans la barre de la
liste, les montre et les masque ensemble, sans rien écrire, le temps que la
section est ouverte, et les masquer retire le tri que la première portait.
Montrée, elle écrit chaque organisation incluse en pastille neutre à l'icône
« ajouter », puis chaque personne incluse, et rien sans inclusion. Entrée ou F2
l'ouvre en deux choix multiples, ceux de la fiche, sans légende, la recherche
comprise. Tab et Maj+Tab passent d'abord d'un contrôle à l'autre — les cases des
organisations, la recherche, les cases des personnes — ; Tab depuis le dernier,
Maj+Tab depuis le premier, valident et mènent à la cellule voisine, comme Entrée
et la sortie de l'éditeur valident ; Échap rend la saisie. **Valider écrit une
seule commande, `changerInclusions` des listes que la saisie change**, une seule
entrée d'historique, que « Défaire » reprend d'un coup, et rien quand la saisie
ne change plus rien ; une liste que la saisie ne touche pas ne part jamais, même
changée ailleurs pendant la saisie, et un refus n'écrit aucune des deux. Quitter
l'éditeur pour la case « Montrer les inclusions » valide la saisie comme toute
sortie ; une saisie refusée, restée ouverte, s'abandonne quand la colonne se
masque, sans rien écrire, son refus et son geste avec elle. La grille trie la
colonne par le nombre d'inclusions de chaque personne, une personne sans
inclusion après toutes les autres ; elle ne se groupe ni ne se filtre par elle,
et l'export écrit ses deux listes dans deux colonnes à lui (plus bas).

**Les conflits du placement de chaque personne se lisent dans la grille et
dans la fiche** (§ 7.5). La colonne « Conflits du placement », juste après celle
des conflits d'organisation, groupée ou non, écrit ceux de la personne dans le
placement que le plan montre — la proposition demandée, sinon le retenu —, de
toutes les règles que la génération compte : une ligne par tour où elle est en
conflit, « tour 2 : » puis le texte de chaque règle, dans l'ordre des règles,
séparés d'un point-virgule — « conflit d'organisation », « même organisation »,
« se revoient avec » suivi du nom de chaque personne revue à ce tour, « revient
à la table » suivi de son numéro : « tour 2 : même organisation ; se revoient
avec Iris Ombrelle et Théo Pervenche ; revient à la table 5 » —, deux homonymes
y faisant deux noms, comme dans la fiche ; un tiret sans conflit comme sans
placement montré, et « non compté » quand le placement montré dérive et que ses
conflits ne se comptent pas. C'est une mesure, non une donnée : elle se lit
seulement — sa cellule prend le focus, Entrée et F2 n'y ouvrent rien —, son
en-tête ne trie pas, la liste ne se groupe ni ne se filtre par elle, et l'export
ne l'écrit pas.
La fiche porte une rubrique « Conflits du placement », juste avant
« Rencontres », sous la même ligne de source : une ligne par conflit, dans
l'ordre des tours — « Tour 2, table 5 : avec Iris Ombrelle — même organisation »
—, les autres personnes d'une même règle à la même table, aux mêmes rencontres
antérieures, réunies en une ligne, et la personne elle-même nommée quand elle
revient à une table ; « Aucun conflit dans ce placement. » sans conflit, « Aucun
placement à mesurer. », sans ligne de source, sans placement, et une phrase qui
le dit quand les conflits du placement ne se comptent pas. Elle n'a aucune
commande, et se lit en lecture et sur un plan bloqué comme en écriture. La
marque d'un groupe en conflit et celle d'une personne, dans la liste groupée,
restent les leurs.

**Les inclusions du placement de chaque personne se lisent de même** (§ 7.5,
§ 12.15), dans le placement que la fiche mesure, sous les avis de sa ligne
d'évaluation — ceux du tableau des propositions. La fiche porte une rubrique
« Inclusions du placement », juste après celle des conflits, sous la même ligne
de source : ses inclusions satisfaites sur ses inclusions actives, « 1 inclusion
satisfaite sur 2. » ; quand sa liste dépasse ce qu'elle peut rencontrer, la
phrase qui dit combien de ses inclusions au plus peuvent être satisfaites, et
combien d'inclusions encore possibles le placement n'atteint pas, « Ce n'est pas
un avis. » ; puis la phrase de chaque avis qui la concerne, celle de la page de
qualité : qu'elle le porte, qu'elle soit la personne incluse, ou qu'elle demande
aussi la rencontre que l'autre personne porte par une inclusion de son
organisation, dont elle est le seul membre à sa portée. Sans rien de cela,
« Aucune inclusion active ne la nomme. » ; une personne exclue, un
placement qui ne se mesure pas, une phrase le dit ; sans placement, ou quand
aucune inclusion n'est active, la rubrique est absente. Elle n'a aucune
commande. La colonne « Inclusions du placement » de la grille, juste après celle
des inclusions et masquée avec elle, en écrit le résumé : « 1 sur 2 », « liste
au-delà du plafond », puis « sans » et l'autre partie de chaque avis qui la
concerne — la personne ou l'organisation incluse, ou la personne qui l'inclut —,
chaque nom dans son propre nœud ; un tiret sans rien de cela, et « non
comptées » quand le placement montré ne se mesure pas. C'est une mesure, comme
les conflits du placement : elle se lit seulement, son en-tête ne trie pas, la
liste ne se groupe ni ne se filtre par elle, et l'export ne l'écrit pas.

**La colonne « Animation » dit qui anime quelle table**, juste après celle du
titre pressenti : les numéros affichés des tables que la personne anime —
« 3 », « 3, 5 » —, lus dans les titres que ses réservations « tous les tours »
pourvoient, désignation suspendue par une absence comprise (§ 2.1 étape 6) ;
« à désigner », en pastille d'avis à triangle, pour une personne non exclue qui
porte la marque de l'animation réservée (§ 4) et n'anime encore aucune table ;
rien sinon. Une personne exclue n'anime rien et n'est pas à désigner. C'est une
mesure, non une donnée, comme les conflits du placement : elle se lit
seulement — sa cellule prend le focus, Entrée et F2 n'y ouvrent rien —, son
en-tête ne trie pas, la liste ne se groupe ni ne se filtre par elle, et
l'export ne l'écrit pas ; la marque, elle, s'exporte dans sa propre colonne.

La tenue de la grille suit la place que la carte lui laisse, non la largeur de
la fenêtre ; ses en-têtes sont en petit corps. Sous 86 rem de place, les
cellules et les actions se serrent, et les onze colonnes que la grille montre
par défaut tiennent dans la carte pleine largeur d'une fenêtre de 1024 px ; les
colonnes des inclusions montrées, la grille défile au besoin dans son conteneur,
sans sortir de la carte. À partir de 80 rem — la carte d'une fenêtre de 1 366 px
—, chaque en-tête tient sur une ligne, hors de ceux des conflits et des
inclusions du placement, qui se replient toujours entre leurs mots, les quatre
actions d'une ligne vont en deux rangées de deux, en colonnes alignées d'une
ligne à l'autre, un prénom ne se coupe qu'entre ses mots, et les tours nommés de
la présence ne se coupent pas ; en deçà, un en-tête se replie entre ses mots et
les actions passent à la ligne.

**La liste s'exporte en CSV dans la forme exacte qu'il importe.** L'aller-retour
est éprouvé par un test qui importe, exporte et compare champ par champ : il
fait du fichier une sauvegarde, et de l'export le gabarit que personne n'a
besoin de documenter. Seule une inclusion qui vise un homonyme non numéroté
n'y entre pas (plus bas).

L'export écrit toujours la colonne `etiquettes`, puis la colonne `presence`,
les étiquettes jointes par une virgule suivie d'une espace (`, `) ; la
présence s'écrit vide pour tous les tours, sinon chaque suite d'au moins trois
tours consécutifs en plage `a-b`, les autres tours un à un, joints par `, ` —
« 1-3 », « 2, 3 », « 1-3, 5 ». Dès qu'une personne de la liste nomme un
conflit, la colonne `conflit_organisation` suit, après la présence, ses
noms joints par un point-virgule suivi d'une espace (`; `), vide pour une
personne sans conflit. Quand une organisation de la liste porte elle-même
« ; » et que la cellule se relirait ainsi en d'autres noms — « Alpha; Beta »
lu comme une seule organisation de ce nom —, les noms se joignent par ` | `,
puis par une fin de ligne : la première jointure que la lecture de l'import
rend en la même liste. Sans conflit dans la liste, la colonne manque, et son
réimport en mise à jour ne touche aucune liste. Dès qu'une personne de la liste
porte la marque de l'animation réservée, la colonne `animation_reservee` suit,
`oui` pour la marque, `non` sans elle ; sans marque dans la liste, elle manque
de même. Puis viennent les deux colonnes des inclusions, chacune dès qu'une
personne de la liste porte une telle liste, et absente sinon :
`inclusion_organisation`, ses organisations jointes comme les conflits, puis
`inclusion_participant`, chaque personne incluse par son nom affiché, numéro
compris, dans l'ordre de ses identifiants, jointes de même — un nom qui porte
« ; » se joint par ` | `, puis par une fin de ligne. L'identifiant ne s'écrit
pas : le réimport relit chaque personne incluse par son nom, si bien que
l'aller-retour vaut **hors des inclusions qui visent un homonyme non
numéroté**, que l'import refuse (`INCLUSION_PARTICIPANT_AMBIGU`). Un export
qui en porte le dit, en avis sous l'en-tête de la liste, leur nombre en tête :
« 2 inclusions visent une personne dont une autre porte le même nom… » ;
l'avis tombe dès que la liste change. Comme le logo, la marque du nom
numéroté (§ 8.9) n'a pas de colonne : le nom s'écrit entier, numéro compris,
et se réimporte sans elle. Le collage en bloc suit le même ordre de colonnes,
la huitième étant celle des étiquettes, la neuvième celle de la présence, la
dixième celle des conflits, la onzième celle de l'animation réservée, la
douzième et la treizième celles des inclusions. Les objectifs des tables
s'exportent par leur propre CSV, dans la forme exacte qu'il importe (§ 10.4).

### 10.3 Les fichiers d'exemple livrés

| fichier | emploi |
|---|---|
| `exemples/participants_demo_petite.csv` | la **liste des participants** de la petite démonstration |
| `exemples/participants_demo_grande.csv` | celle de la grande |
| `exemples/participants_cas_limites.csv` | éprouve l'analyseur ; n'alimente aucune démonstration |
| `exemples/participants_cas_limites_cp1252.csv` | même contenu, windows-1252, séparé par des virgules |
| `exemples/objectifs_cas_limites.csv` | éprouve l'import des objectifs de table ; n'alimente aucune démonstration |

**Un CSV ne reproduit pas une configuration** : un import de participants ne
crée ni tables, ni tours, ni réservations, ni titres. Les deux premiers fichiers
sont donc **produits par l'export CSV** à partir des fichiers de démonstration
livrés, **jamais saisis à la main** — la dérive entre l'exemple et la
démonstration devient impossible plutôt que surveillée.

Le fichier de cas limites exerce, ligne par ligne : une colonne non reconnue,
une personne sans organisation, une exclusion, un champ cité contenant le
séparateur, un champ cité sur deux lignes, un doublon, une personne sans prénom,
une **paire d'orthographes d'une même organisation à fondre** (§ 10.1), et une
ligne refusée faute de nom. Il **alimente aussi deux captures d'écran** du guide
(§ 19.3) — l'aperçu d'import et son rapport —, qui sont les deux écrans où une
fusion d'orthographes et un refus de ligne se montrent ensemble.

Il porte aussi une colonne `Étiquettes`, en-tête accentué en casse mixte : une
cellule à plusieurs étiquettes séparées par `,`, une séparée par `|`, une paire
d'orthographes d'une même étiquette à fondre, et une cellule vide. Sa colonne
non reconnue reste la dernière. Il porte aussi une colonne `Présence`, avant la
colonne non reconnue : des cellules vides, un « Tous », et une plage qui
commence avant la soirée, « 0-2 », qui refuse sa ligne sous tout nombre de
tours. Il ne porte aucune présence partielle admise : ses lignes valides passent
par le moteur dans les épreuves d'intégration, et y gardent leurs personnes. Les
deux fichiers `participants_demo_*.csv`, exports des démonstrations, portent la
colonne `etiquettes`, vide, et la colonne `presence`, vide ; les démonstrations
elles-mêmes ne changent pas. Aucun fichier livré ne porte de colonne
d'inclusion : une inclusion fautive refuse le fichier entier et vide l'aperçu,
si bien que son refus s'éprouve, et se montre, sur un texte à part. Le fichier
des objectifs exerce un numéro de table inconnu, un tour hors de la soirée, une
règle inconnue, deux lignes pour une même table et un même tour, une orthographe
qui se fond avec une étiquette des participants, et une table qui porte un
objectif de soirée et un objectif de tour ; il alimente la capture d'écran de
l'aperçu des objectifs (§ 19.3).

Tous sont en **UTF-8 avec marque d'ordre d'octets, séparés par `;`** — la forme
qu'un tableur francophone sous Windows rouvre sans manipulation — sauf
`participants_cas_limites_cp1252.csv`. Noms, organisations et courriels sont
**inventés** ; les courriels emploient le domaine réservé `.test`.

### 10.4 Les objectifs de table en CSV

**Un second fichier, choisi par l'opérateur.** Les objectifs s'importent par
leur propre CSV, jamais par une section du fichier des participants : chaque
fichier garde son séparateur, son en-tête et son CSV des refus. L'opérateur dit
ce qu'il importe — des participants ou des objectifs de table — avant l'aperçu ;
le logiciel ne le devine pas, une liste de participants reçue portant souvent
une colonne « Table » d'une soirée passée. Changer ce choix, l'aperçu ouvert,
relit le même texte sous l'autre nature ; un collage depuis la grille des
participants arrive sous « participants ».

| en-tête | obligatoire | contenu |
|---|---|---|
| `table` | **oui** | le **numéro affiché** de la table, jamais son identifiant |
| `tour` | non | vide pour la soirée, sinon un tour de 1 à R |
| `objectif` | **oui** | les étiquettes, découpées comme la colonne `etiquettes` (§ 10.1) ; synonyme : `objectifs` |
| `regle` | non | liste fermée, sur la forme normalisée, comme `exclu` (§ 10.1) — casse et accents ignorés, blancs réduits, si bien que « Au moins une » se lit et « aumoinsune » non : `ou`, `une`, `au moins une` ; `et`, `toutes` ; vide pour suivre le défaut ; synonyme : `règle` |

Sous la nature « Objectifs de table », le guide de l'import (§ 10.1) décrit
ces colonnes.

**Tout le § 10.1 vaut, sauf ce qui nomme les participants** : aperçu
obligatoire, encodage en quatre temps, séparateur analysé, colonnes par en-tête,
lignes valides importées et refusées réexportées avec `ligne` et `motif`, import
entier en une entrée d'historique, refus en bloqué. Les étiquettes se
réconcilient avec celles de l'événement — celles des personnes, exclues
comprises, et celles des objectifs de table, hors du mode « remplacer », qui
retire ces objectifs —, et le rapport nomme chaque fusion. En état retenu,
l'import avertit que le classement des propositions peut changer ; il ne met
aucune proposition en dérive (§ 8.9).

**Deux modes.** *Mettre à jour* : chaque couple (table, tour) du fichier
remplace l'objectif de ce couple, les autres restent. *Remplacer* : tous les
objectifs de l'événement partent, puis ceux du fichier s'écrivent ; le logiciel
annonce avant d'agir combien d'objectifs et de tables il touche.

**Refus globaux** : ceux du § 10.1 hors `NOM_NON_ASSOCIE`, plus aucune colonne
associée à `table` (`TABLE_NON_ASSOCIEE`) ou à `objectif`
(`OBJECTIF_NON_ASSOCIE`), et un événement sans table (`OBJECTIFS_SANS_TABLE`),
dont le remède mène à la section des tables. **Refus de ligne**, un motif par
ligne, dans cet ordre : champs en trop ; numéro de table absent, non entier,
inconnu, ou porté par deux tables ; tour non entier ou hors de la soirée ;
objectif vide sous une règle écrite ; étiquette mal formée ou vingt-et-unième
étiquette ; règle hors de la liste fermée — l'inconnu ne se lit jamais comme le
défaut ; deuxième ligne pour un même couple (table, tour), qui nomme la
première. **Avis** : après l'import, un objectif écrit par le fichier auquel
aucune personne présente ne correspond ; l'aperçu ne le calcule pas.

**Un aperçu lu avant un changement du nombre de tours ne s'applique pas**
(`APERCU_TOURS_CHANGES`, § 10.1) quand une colonne est associée à `tour` : un
tour admis sous l'ancien nombre sortirait de la soirée, et un tour refusé ne le
serait peut-être plus. Relire le fichier refait l'aperçu. Sans colonne `tour`,
le fichier ne parle que de la soirée, et l'aperçu s'applique.

**La ligne à remplir.** Une ligne dont la cellule `objectif` ne porte aucune
étiquette — vide, ou faite de blancs et de séparateurs — et dont la cellule
`regle` est vide ne demande rien : l'import la passe, ni importée ni refusée,
quels que soient sa table et son tour ; seul un champ en trop la refuse. En
mise à jour, l'objectif de son couple reste ; en remplacement, son couple est
de ceux que le fichier ne nomme pas. Sous une règle écrite, la même cellule est
un objectif vide, refusé (`OBJECTIF_VIDE`). Un fichier fait des seules lignes à
remplir n'a aucune ligne valide.

**L'export des objectifs** écrit `table;tour;objectif;regle`, une ligne par
objectif, les tables par numéro affiché puis identifiant croissant, et pour
chacune la soirée puis les tours croissants ; la règle s'écrit `ou`, `et`, ou
vide quand l'objectif suit le défaut ; il est le gabarit de l'import et sa
sauvegarde, et l'aller-retour s'éprouve comme celui des participants. La
commande « Exporter les objectifs » se trouve dans la section des tables ; elle
est permise en lecture et sur un plan bloqué : sortir n'est pas modifier.

**Le modèle des objectifs**, `‹base›-modele-objectifs.csv` (§ 10.1), écrit
l'en-tête de l'export puis une ligne par couple (table, tour) de l'événement,
les tables par numéro affiché puis identifiant : la soirée d'une table qui ne
porte aucun objectif de tour ; la soirée puis chaque tour, de 1 à R, d'une table
qui en porte au moins un — le mode se lit dans les données (§ 4.5). Sur une
table dont aucune autre ne partage le numéro, un couple qui porte un objectif
l'écrit, comme l'export, et les deux premiers couples libres reçoivent un
exemple, `finance, ressources humaines` sous `ou`, puis `finance, Montréal`
sous `et` ; les autres couples sont des lignes à remplir. Une ligne nomme sa
table par son numéro : l'import refuse l'objectif d'une table dont le numéro est
partagé (`PLUSIEURS_TABLES`), et chacun de ses couples, objectif existant
compris, est au modèle une ligne à remplir. Quand les tables à numéro unique
offrent moins de deux couples libres — chacune garnie à sa soirée, ou une seule
table sans objectif —, les premières d'entre elles sans objectif de tour
prennent aussi leurs lignes de tour 1 à R, une table après l'autre, jusqu'à en
offrir deux. Le modèle montre ainsi les deux formes, sauf quand ces tables
n'offrent qu'un couple libre et aucune table à étendre — il n'écrit alors que
l'exemple `ou` — ou aucun — il n'en écrit aucun. Importé tel quel, sous l'un ou
l'autre mode, il ne refuse aucune ligne, rend inchangés les objectifs existants
des tables à numéro unique et ajoute les exemples ; *Remplacer* retire ceux
d'une table à numéro partagé, comme son bilan l'annonce avant d'agir. Un
événement sans table refuse le modèle (`OBJECTIFS_SANS_TABLE`), et un événement
dont chaque numéro de table est partagé aussi (`OBJECTIFS_NUMEROS_PARTAGES`) —
aucune ligne de son modèle ne s'importerait —, l'un et l'autre avec le remède
qui ouvre la section des tables.

---

## 11. Les sorties

### 11.1 Une seule sortie PDF : la planche de badges

Le logiciel produit **un seul document PDF** : la planche de badges,
distribués à l'accueil et portés autour du cou — avec, pour les cartes Avery
5392 prédécoupées, sa feuille de contrôle en un second PDF, à imprimer sur
papier ordinaire (§ 11.3). Les mêmes badges se tirent aussi en **liste CSV**,
pour un tableur ou une imprimante d'étiquettes (§ 11.6) : un fichier de
données, pas une page. Toute autre sortie se lit à l'écran et s'imprime par
le navigateur ou par l'hôte `electron` (§ 11.7).

**Il le produit en mémoire, par une bibliothèque embarquée** — `pdf-lib`, sa
police lue par `fontkit` (§ 17, point 2). L'argument est
celui du § 14.4, et il est le seul qui tienne : une bibliothèque embarquée
s'exécute sous `node`, donc **dans le cycle « à chaque modification »**. Un test
de quelques secondes affirme que la boîte de page mesure 210 × 297 mm à moins de
0,1 mm près, que la planche porte quatre cellules de 105 × 148 mm, que les
filets de coupe tombent à 105, 148 et 296 mm, que les six cartes Avery 5392
tombent aux cotes de leur gabarit, sans un filet, que l'ordre des badges est
celui qu'annonce l'imposition choisie, et que les caractères accentués se
retrouvent **dans la couche de texte** — pas dans une image.

Le chemin d'impression, lui, exige de démarrer l'application et un moteur de
rendu : il appartient au niveau « navigateur », éprouvé **avant chaque
livraison** et non à chaque modification. *Un contrôle qui ne tourne qu'avant une
livraison ne tourne pas*, et la justesse du badge est la seule justesse de sortie
qui soit **géométrique** : une liste mal paginée se réimprime, soixante badges
coupés trop court sont refaits à la main pendant que la file s'allonge.

> **Ce que l'hôte `electron` sait faire, et qui ne suffit pas.** L'hôte
> d'impression de la plateforme de livraison accepte un format de page, des
> marges et un facteur d'échelle fixés par le programme, sans boîte de dialogue :
> affirmer que « le logiciel ne lit pas les marges » serait faux sur la
> plateforme livrée. Ce qui manque n'est pas la maîtrise, c'est **l'épreuve** —
> elle passe par un rendu, donc par un moteur de navigateur que le cycle court
> n'a pas. La plateforme `web`, elle, n'offre que la boîte de dialogue du
> navigateur et son « ajuster à la page ».

**Ce que cette réduction retire du chemin critique.** La bibliothèque n'ingère
plus de SVG : ni `<use>`, ni `<symbol>`, ni `<tspan>` à décalage explicite, ni
plan vectoriel. Le seul point de l'architecture de sortie qui reposait sur une
supposition **disparaît**, et avec lui le test permanent qui l'éprouvait. Ce qui
reste exigé d'elle est du texte, des filets, des rectangles, une police
embarquée et, pour le logo d'un participant (§ 11.4), une image PNG qu'elle
embarque telle que le dossier de l'événement la porte, une fois par fichier
quel que soit le nombre de badges qui la portent.

Conséquences à tenir :

- **La police est embarquée** : Noto Sans, en graisses normale et grasse, sous
  la licence libre SIL Open Font License 1.1, dont le texte accompagne le
  livrable. Elle couvre le latin étendu du français, ligatures comprises, et
  n'entre dans le document qu'en **sous-ensemble**, les seuls glyphes que la
  planche emploie. C'est aussi la police de toute l'interface : l'écran
  ressemble aux captures d'écran, et la mesure de la chaîne témoin du § 19.4
  porte sur la police que l'opérateur voit. L'interface ne l'emploie qu'en ses
  deux seules graisses : ni demi-gras ni graisse intermédiaire. Un caractère
  qu'elle n'a pas se nomme avant de produire (§ 11.5).
- **Chaque police embarquée porte une table `ToUnicode`.** Sans elle, un
  sous-ensemble de police encode ses glyphes dans un ordre interne : les accents
  s'impriment correctement et l'extraction rend du charabia. Le test ne distingue
  alors plus « é absent » de « é inextractible », il échoue sur un défaut qui
  n'existe pas — ou pire, on le désarme.
- **Le badge se construit depuis le modèle, jamais depuis le DOM.**
- **Aucune mise à l'échelle n'est inscrite dans le document** : pas de
  `/UserUnit`, pas de boîte de recadrage distincte de la boîte de média. Le test
  le vérifie sur le fichier produit, et vérifie en outre la **position mesurée**
  des filets de coupe : une transformation posée dans le flux de contenu ne se
  voit sur aucune des deux boîtes. La seule matrice du flux est celle d'une
  image, qu'un PDF ne peint que dans son carré unité : elle ne vit que dans
  l'état graphique de cette image et ne touche ni le texte ni les filets ; le
  test mesure l'image à sa place dans le badge, debout comme à plat.
- **Les mesures de texte ont une seule autorité : les métriques de la police
  embarquée**, lues par la bibliothèque qui dessine. Le § 14.1 impose de mesurer
  dans un navigateur ce qui dépend du rendu du navigateur ; le badge n'en dépend
  pas, et le mesurer là introduirait la seconde arithmétique que le § 13.2
  interdit.

### 11.2 La planche : Avery 5392, ou l'A6 sur A4 et Lettre

**Le badge a deux modèles, et le modèle est distinct du papier.** Le modèle
par défaut est **Avery 5392** : des cartes prédécoupées de 4 po × 3 po, six par
feuille Lettre, qui n'ont besoin d'aucune coupe. Le second est **l'A6 à
découper**, sur A4 ou sur Lettre. Le modèle est un réglage local de la
machine (§ 8.5), choisi dans la section de l'impression, qui ne voyage pas avec
l'événement. Avery 5392 impose son papier, le Lettre : la section ne montre
alors ni l'imposition ni le papier. L'A6 prend le papier de la machine, que
l'aperçu d'impression partage, et le Lettre tant qu'aucun n'est choisi : les
badges ne posent jamais la question du papier.

#### Avery 5392 : six cartes prédécoupées, sur Lettre

La feuille est un Lettre portrait de six cartes de **101,6 × 76,2 mm** (4 po ×
3 po), **à plat**, en **deux colonnes et trois rangées, sans gouttière**, à
**6,35 mm** (0,25 po) des bords latéraux et **25,4 mm** (1 po) des bords haut et
bas : 2 × 6,35 + 2 × 101,6 = 215,9 et 2 × 25,4 + 3 × 76,2 = 279,4, les cotes
du Lettre. Ces cotes ont une seule définition dans le code, à côté de l'A6, et
la planche les reprend à 0,01 mm près, sans calcul ni centrage. Le texte de
chaque carte se lit droit, sans rotation.

Les cartes étant prédécoupées, la planche **ne porte aucun filet de coupe**, et
la section **n'offre pas d'imposition** : les cartes suivent l'ordre de la
pile, carte après carte, feuille après feuille — la feuille par feuille du
§ 11.6. La pagination s'éprouve sur `n = 1, 6, 7, 257` : 1, 1, 2 et **43
feuilles**, `7` séparant la troncature de l'arrondi par excès.

#### L'A6 : deux impositions, A4 et Lettre

**L'A6 se produit sur les deux papiers, et aucun des deux n'est un cas de
repli.** Le badge est un A6 exact — 105 × 148 mm — dans les deux cas ; ce qui
change est le nombre de cellules par feuille et le tracé de coupe.

| papier | format | badges par feuille | axes de coupe | pour 257 badges |
|---|---|---|---|---|
| **A4** | 210 × 297 mm | **4**, deux colonnes de 105 et deux rangées de 148 | **3** : une verticale, deux horizontales | **65 planches** |
| **Lettre** | 215,9 × 279,4 mm | **2**, à plat, 148 de large et 105 de haut | **5** : un encadrement complet | **129 planches** |

**Les badges partent sur Lettre sans rien demander** (§ 8.5) : Avery 5392, dont
la feuille de cartes n'existe qu'en Lettre, l'impose ; l'A6 le prend tant que la
machine n'a pas de papier, sans l'écrire dans les réglages locaux, et le papier
qu'on y choisit d'un geste, « Changer », devient celui de la machine. Le défaut
ne choisit pas en silence : la section montre le papier à côté du modèle, et
l'annonce nomme le papier et le nombre de feuilles avant toute production
(§ 11.8). L'aperçu d'impression, lui, demande le format à sa première ouverture,
puis jamais ; le format retenu reste affiché, et se change d'un geste. Le format
retenu est écrit sur la feuille de contrôle et dans le nom du fichier (§ 11.3,
§ 11.6), parce que c'est la seule chose qui survit à l'envoi de la planche à
quelqu'un d'autre.

**Les deux impositions de l'A6 et la feuille Avery sont éprouvées à égalité**
(§ 14.4) : la pagination sur `n = 1, 4, 5, 259, 261` en A4, `n = 1, 2, 3, 257`
en Lettre et `n = 1, 6, 7, 257` pour Avery 5392, et la géométrie — cellules,
filets, zone de silence — sur chacune. Une branche qui ne serait éprouvée que
« au cas où » est une branche qui sort fausse le jour où elle sert.

#### L'A4 : quatre cellules, un millimètre perdu

A4 fait 210 × 297 mm, A6 fait 105 × 148 mm. Deux colonnes de 105 occupent
**exactement** 210 ; deux rangées de 148 occupent 296 et laissent **1 mm**.

Le logiciel **ne répartit pas ce millimètre dans la hauteur des badges.** Il
dessine quatre cellules de **105 × 148 mm exactement** et laisse le millimètre en
bande perdue au pied de la feuille. Le coût est **une troisième coupe** : une
verticale à 105, une horizontale à 148, une horizontale à 296 qui retire la
bande. Élargir les cellules à 148,5 économiserait cette coupe et produirait un
carton d'un demi-millimètre hors format, que rien ne garantit qu'une pochette
taillée à 148 accepte — et la planche cesserait de pouvoir s'annoncer A6. **Une
sortie qui ment sur son format est pire qu'une sortie qui coûte une coupe**, et
c'est la même règle qui gouverne le papier Lettre ci-dessous.

> La troisième coupe ne coûte rien à qui tranche la rame entière sur un massicot :
> trois réglages de butée, trois passes, quel que soit le nombre de feuilles. Elle
> coûte un geste par feuille aux ciseaux. C'est un argument de plus pour
> l'imposition en pile (§ 11.6) sur les gros tirages, pas une raison de rogner le
> badge.

**L'absence de marge latérale gouverne tout le reste.** Le bord d'un badge est le
bord de la feuille, où aucune imprimante à jet ou à laser courante ne dépose
d'encre. Le logiciel ne dessine donc **ni fond perdu, ni aplat de couleur, ni
cadre** : un fond coloré ressort avec une bande blanche de trois à cinq
millimètres sur deux côtés, et la coupe se met à chasser la bande au lieu de
suivre un repère. **La couleur n'entre sur le badge que par deux logos : celui
du pied TechnoLibre** (§ 11.4), dans ses couleurs d'origine, fond compris,
**et celui du participant**, l'image telle que son fichier la porte. Ils se
tiennent dans le cadre utile, loin de tout bord de coupe ou de feuille, et ne
sont donc pas des fonds perdus ; sur une imprimante en noir et blanc, ils
sortent en gris sans que rien d'autre ne change.

#### Le Lettre : deux cellules, un encadrement complet

Le Lettre mesure 215,9 × 279,4 mm : deux rangées de 148 en demandent 296. Un
gabarit A4 imprimé sur Lettre perd la rangée du bas. Le logiciel **refuse de
réduire en silence** : il produit **deux badges A6 exacts par feuille, à plat** —
148 de large, 105 de haut — plutôt que quatre cartons rognés à 139 mm. Sur Lettre
les badges ne pavent plus la feuille : le logiciel trace un **encadrement de coupe
complet**, et la coupe demande cinq passes au lieu de trois. Le nombre de feuilles
**double**, et le logiciel l'annonce **avant** de produire.

> **Trois badges par feuille Lettre sont géométriquement possibles, et le logiciel
> ne les produit pas.** Deux A6 debout côte à côte occupent 210 × 148, et un A6
> couché entre dans la bande de 215,9 × 131,4 qui reste : quatre-vingt-sept
> feuilles au lieu de cent trente pour deux cent soixante badges. Le prix est une
> **coupe non traversante**, qui interdit de trancher la rame entière en un
> réglage — elle échange un tiers du papier contre un geste par feuille. Elle se
> décidera sur l'outil de coupe réellement disponible, et pas avant : une
> imposition de plus est une imposition de plus à éprouver.

**La pagination s'éprouve sur les deux impositions, et sur les comptes qui
séparent les deux arrondis** (§ 14.2) : `n = 1, 4, 5, 259, 261` pour l'A4 —
jamais 260, où la troncature et l'arrondi par excès rendent la même valeur — et
`n = 1, 2, 3, 257` pour le Lettre, où `3` sépare les deux calculs que `4`
confond. **Le compte est celui des participants non exclus** : un exclu n'a de
table à aucun tour, son badge serait vide, et c'est ce cas qui fait passer de 65
pages à 65 avec une case blanche, ou à 64, selon l'implémentation. Le témoin de
257 badges donne **65 planches A4** et **129 planches Lettre**.

**Le format de papier et le modèle de badge sont des réglages locaux de la
machine** (§ 8.5), retenus d'une séance à l'autre, jamais écrits dans le fichier
d'événement : ils décrivent le bac de l'imprimante et le support qu'on y pose,
pas le plan.

### 11.3 Le découpage, et la feuille de contrôle

Ce qui suit sur les filets et la coupe vaut pour l'A6 ; les cartes Avery 5392,
prédécoupées, n'en portent aucun.

**Les filets de coupe sont fins, d'une encre neutre, continus**, tracés sur les
**trois** axes de coupe. Ils tombent sur le bord du badge, dans la zone de
silence, et ce qu'il en reste après la coupe ne porte aucune information. Le
logiciel **ne pose pas de traits de coupe en marge** : il n'y a pas de marge, et
il ne prétend pas en poser. Les trois axes ne sont pas deux médianes : 148 n'est
pas la médiane de 297, et le troisième filet est celui qui retire la bande
perdue.

**La zone de silence est la garantie de la coupe.** Aucun texte, aucune marque ne
s'approche à moins de **8 mm** d'un bord de badge. Cette distance couvre **deux
bornes différentes selon le bord**, et l'entrée de la constante au registre le
dit, sans quoi la prochaine main la « corrigera » par le calcul :

- sur un **bord de coupe** : le décalage de l'imprimante, qui déplace la planche
  entière sur la feuille, plus l'erreur de main, qui déplace la lame ;
- sur un **bord de feuille** : la marge non imprimable de l'imprimante et le
  biais d'entraînement du papier, qui n'ont rien à voir avec la coupe.

**8 mm est aujourd'hui un défaut de travail, non une constante mesurée au sens du
§ 14.1**, et la constante le déclare. Une carte Avery 5392 n'a pas d'erreur de
coupe : sa zone de silence, une constante à elle, ne couvre que le décalage de
l'imprimante par rapport aux prédécoupes, et vaut **5 mm**, un défaut de
travail lui aussi, que la feuille de contrôle posée sur une feuille de cartes
permet de relever. La mesure appartient au **niveau manuel**
du § 14.4 : elle se fait sur les imprimantes visées, avant la livraison, parce
qu'un banc de navigateur ne mesure ni un décalage d'imprimante ni une erreur de
main. Une zone calculée au plus juste fait couper dans un patronyme.

**La cote intérieure des pochettes n'est pas une contrainte de la première
itération.** Le badge reste un A6 exact, et la troisième coupe reste : la découpe
se fait au massicot, où trois passes coûtent trois réglages de butée quel que soit
le nombre de feuilles. Si une pochette mesurée tolérait un demi-millimètre, la
bande perdue pourrait être répartie et la troisième coupe disparaître — mais la
planche cesserait alors de pouvoir s'annoncer A6, et **une sortie qui ment sur son
format est pire qu'une sortie qui coûte une coupe**.

**La feuille de contrôle de l'A6 est la page 1 du document**, et les pages qui
la suivent quand ses lignes — la liste des noms entiers d'une réédition, ceux
que la case des doublons laisse en blanc compris (§ 11.4) — ne tiennent pas sur
une page ; **elle ne se découpe pas**, ses pages de suite non plus.
**Celle d'Avery 5392 est un second PDF**, écrit à côté du premier sous le même
nom, `.controle` à la place de `.badges` (§ 11.6) : une feuille de cartes gâchée
pour une règle coûterait six badges, et la feuille de contrôle s'imprime sur
papier ordinaire. Elle porte en plus, sur sa première page, le **contour des six
cartes à leur place exacte**, du trait fin des filets : posée sur une feuille
Avery 5392, il tombe sur les prédécoupes, ce qui vérifie l'alignement de
l'imprimante avant d'engager les cartes ; ses lignes de contrôle se replient
alors dans la colonne de gauche des cartes, sans croiser le contour du milieu,
et une ligne de plus dit de l'imprimer sur papier ordinaire. Chacune porte une
**échelle graphique de 100 mm, repérée tous les 10 mm**, sur sa première page,
les dimensions annoncées du badge et son modèle — « (A6) », ou « (Avery 5392,
six cartes prédécoupées par feuille) » —, le format de papier, l'imposition
retenue — l'A6 seulement —, le nombre de planches, le compte de badges produits
et le compte attendu, le nom et la date de l'événement, la source — le placement
retenu, ou la proposition imprimée par son numéro, que l'horodatage ne distingue
pas des autres propositions de sa génération —, l'horodatage du placement, la
version (§ 18.6), la consigne d'impression — recto seul, à 100 % —, quand un
badge désigne un logo de participant, une ligne de texte qui compte les logos —
« Logos : 41 posés, 2 sans place, 1 introuvable » (§ 11.5) —, quand une case de
la section retire des données des badges (§ 11.4), une ligne qui les nomme dans
l'ordre des cases — « Données retirées des badges : organisation et date du
placement » —, les caractères que la police n'a pas, par leur point de code
(§ 11.5), et le filigrane BROUILLON s'il y a lieu, sur chacune de ses pages.
Elle ne porte aucune image, ni logo de participant ni logo TechnoLibre.
L'opérateur la mesure sous une règle avant d'engager la rame : si la planche est
sortie « ajustée à la page », la graduation ne fait plus 100 mm et le défaut se
découvre sur la première feuille au lieu de la soixante-cinquième.

**L'impression est recto seul.** Un verso aligné dépend d'un retournement dont le
décalage se cumule avec celui du recto, et un badge dont le dos appartient à
quelqu'un d'autre n'est pas rattrapable.

### 11.4 Ce que porte un badge

Le lecteur est la personne qui le porte, debout, le carton à hauteur de poitrine,
et qui cherche sa table. Le second lecteur est l'hôte de salle, à un mètre, qui
cherche à qui il parle.

| rang | contenu | pourquoi |
|---|---|---|
| 1 | **prénom et nom**, le plus grand corps de la planche — l'organisation prend cette place sous la case de l'organisation en gros, cochée par défaut (ci-dessous) | c'est l'identité, et c'est ce que lit l'hôte à un mètre |
| 2 | **une ligne par tour** : « Tour 1 — table 12 », le tour par son nom quand il en porte un (§ 4) — « Plat principal — table 12 » —, le libellé de la table entre parenthèses après son numéro quand elle en porte un (§ 4) — « Tour 1 — table 5 (Terrasse), siège 3 — animation » —, et le siège quand les sièges sont attribués ; une ligne aussi pour un tour d'absence, qui dit « absente » | c'est la question à laquelle le badge existe pour répondre |
| 3 | **organisation**, un corps réduit, sous le nom — le nom de la personne prend cette place sous la même case (ci-dessous) | elle distingue deux homonymes à l'accueil |
| 4 | **nom de l'événement et date**, en pied, corps minimal | deux soupers dans la même salle le même mois |
| 5 | **l'horodatage du placement**, en pied, corps minimal, lisible en main et non à un mètre | sans lui, deux versions d'un plan circulent autour de deux cous et personne ne dit laquelle fait foi |
| 6 | **l'image des badges**, quand sa case est cochée et qu'une image est choisie (ci-dessous), la même sur chaque badge, en haut, au centre ou en bas | l'événement se reconnaît d'un coup d'œil, l'emblème d'un congrès ou d'une association ; elle ne prend que la place que tout le texte laisse |
| 7 | **le logo du participant**, quand sa fiche en porte un (§ 10.2), entre les tours et le pied, le plus grand que l'écart permette | l'hôte de salle reconnaît l'organisation d'un coup d'œil ; il ne prend que la place que tout le texte laisse |
| 8 | **le pied TechnoLibre**, sous le pied, quand la case de la machine est cochée (§ 8.5) : « Demander un développement logiciel personnalisé avec https://technolibre.ca pour votre entreprise », ou le texte que la machine garde à sa place (§ 8.5), suivi du logo de TechnoLibre en couleurs d'origine ; un texte vide laisse le logo seul | l'éditeur du logiciel s'y fait connaître ; il ne prend que la place que tout le reste laisse |

Le pied des **pages** imprimées porte cinq éléments, la version comprise
(§ 11.7). Le badge n'est pas une page : il porte le nom de l'événement, sa date
et l'horodatage, **pas le tour** — il les porte tous — et **pas la version**, qui
ne sert à aucun diagnostic au cou d'un invité et dont la place est comptée.

**Cinq cases retirent des données du badge.** La section de l'impression porte,
à côté de la case du pied TechnoLibre, cinq cases, **toutes cochées par
défaut** et **gardées sur le poste** comme elle (§ 8.5) : « Organisation »
(rang 3), « Nom de l'événement » et « Date de l'événement » (rang 4), « Date du
placement » — la ligne « Placement du … à … », rang 5 — et « Identifiant » — la
ligne « Identifiant n° … » d'un homonyme. Le nom de la personne et ses tours
s'impriment toujours. Une case décochée retire sa donnée de chaque badge du
PDF, A6 comme Avery 5392, et la place libérée revient au reste comme celle
d'une ligne absente (§ 11.5) : au nom et aux tours, puis à l'image des badges,
au logo du participant et au pied TechnoLibre. Le nom et la date de l'événement
se combinent : la date décochée, le nom reste seul sur sa ligne ; le nom
décoché, la date seule ; les deux décochés, la ligne disparaît. Un nom de
l'événement que sa case retire n'est pas un nom perdu au sens de l'ordre de
sacrifice : l'image des badges, le logo du participant et le pied TechnoLibre
s'y posent encore quand l'écart le permet. La feuille de contrôle nomme les
données retirées, d'une ligne (§ 11.3) ; l'annonce nomme toujours les homonymes
que rien ne sépare, « Identifiant » décoché compris, et l'opérateur décide. La
liste des badges en CSV (§ 11.6) ne lit aucune case : elle ne change pas.
Toutes les cases cochées, la planche garde exactement ses octets.

**Une case laisse en blanc le nom des doublons.** Juste avant celle du pied
TechnoLibre, la case « Laisser le nom des doublons en blanc », **cochée par
défaut** et **gardée sur le poste** comme elle (§ 8.5), vise les personnes
que « Rendre les noms uniques » a numérotées à l'import et dont la marque
cachée tient encore (§ 8.9, § 10.1). Une note sous la case dit pourquoi :
la place du nom reste vide, pour l'écrire à la main. Cochée, le badge d'une
telle personne n'imprime **aucun nom**, prénom compris : la place où
« Roger Galet 01 » s'imprimerait reste blanche. La mise en page mesure le
nom entier et lui réserve exactement sa place — même corps, mêmes lignes,
même hauteur —, si bien que le reste de la carte est celui du badge au nom
imprimé, ligne pour ligne ; la couche de texte du PDF ne porte pas le nom.
Décochée, le badge imprime le nom entier, numéro compris. Un nom sans marque
s'imprime toujours, chiffres compris, saisis à la main ou importés tels
quels. Seul le nom du badge change : le plan, les listes, la liste des
badges en CSV et la feuille de contrôle gardent le nom entier, comme l'ordre
de la pile (§ 11.6) et le refus d'un nom trop long, qui nomme la personne
(§ 11.5). Sans personne marquée, la planche garde exactement ses octets, la
case cochée ou non.

**Une case met l'organisation en gros, au-dessus du nom.** Sous les cinq cases,
la case « Organisation en gros, au-dessus du nom », **cochée par défaut** et
**gardée sur le poste** comme elles (§ 8.5), échange les rangs 1 et 3 sur le
badge d'une personne qui a une organisation. L'organisation prend la place et la
règle du nom : le plus grand corps de la carte, en gras, réduite jusqu'à son
plancher puis repliée sur trois lignes au plus, jamais abrégée. Le nom de la
personne prend la place et la règle de l'organisation, en petit sous elle.
Décochée, le nom est en gros, au-dessus de l'organisation en petit. Une personne
sans organisation, ou dont la case « Organisation » retire l'organisation — la
case de l'organisation en gros est alors désactivée —, garde son nom en gros.
L'ordre de sacrifice suit les rôles, non les données (§ 11.5) : le gros texte ne
se retire jamais, et c'est le nom, en petit, qui part après le nom de
l'événement quand la carte ne tient pas. Un nom que la case des doublons laisse
en blanc garde sa place de petit texte, vide. Une organisation trop longue pour
le gros texte refuse la planche comme un nom trop long, en nommant la personne
(§ 11.5). La feuille de contrôle et la liste des badges en CSV ne lisent pas la
case. Sans organisation imprimée, la planche garde exactement ses octets, la
case cochée ou non.

**Une case pose une image sur tous les badges.** Sous le groupe des cases, la
case « Image sur tous les badges », **décochée par défaut**, n'est pas un
réglage du poste : l'événement la garde, avec l'image et sa position (§ 8.9),
et chaque geste qui la change est une entrée d'historique, refusée en lecture
et sur un plan bloqué, à côté du contrôle, avec son remède. Cochée, elle
montre sous elle la vignette de l'image, ou « Aucune image choisie. », ou,
quand le fichier manque au dossier de l'événement, « Image introuvable » ;
« Choisir l'image », qui accepte les mêmes images que le logo d'une personne
et les réduit de même à 1 200 pixels de côté au plus (§ 10.2) ; « Retirer
l'image » ; et la position, « En haut », « Au centre » ou « En bas ». En haut,
l'image se pose au haut du cadre utile, et le nom, l'organisation et les tours
descendent sous elle ; au centre, entre le bloc du nom — le gros et le petit
texte — et les lignes de tour ; en bas, entre les tours et le pied, au-dessus
du pied. Elle se centre en largeur, proportions gardées, à sa hauteur maximale
quand l'écart le permet : 30 mm sur l'A6, 15 mm sur la carte Avery 5392, sans
dépasser la largeur du cadre. Elle ne retire ni ne réduit aucun texte : elle
**rapetisse** avec l'écart que le texte laisse, puis **se retire** de ce
badge, avant tout refus (§ 11.5). Décochée, l'image et la position restent
dans l'événement. Une image introuvable ou illisible, ou cochée sans image,
s'annonce, et les badges s'impriment sans elle ; la planche ne se refuse
jamais pour elle. La feuille de contrôle et la liste des badges en CSV ne la
lisent pas. Sans image posée, la planche garde exactement ses octets.

**Le logo du participant passe après tout le texte.** La place du badge se
donne dans cet ordre : le nom et les tours toujours ; puis l'organisation et
le pied, dans l'ordre de sacrifice du § 11.5 ; puis l'image des badges ; puis
le logo du participant ; le pied TechnoLibre en dernier. Le logo ne prend que
l'écart que le texte et l'image des badges laissent entre les tours et le
pied, moins un dégagement au-dessus et au-dessous : il ne réduit ni ne retire
aucun texte. Il s'y pose le plus grand possible, proportions gardées, sans
plafond, centré, et ne se pose pas sur un badge où sa plus petite cote
n'atteindrait pas son plancher, ni sur un badge qui a perdu le nom de
l'événement ou l'organisation (§ 11.5). Son image se lit dans le dossier de
l'événement, au chemin que porte la fiche, à la première préparation qui la
demande, puis se garde pour cet événement ; un échec ne se garde pas. La
planche l'embarque une fois par fichier, quel que soit le nombre de badges qui
la portent.

**Le pied TechnoLibre passe après tout le reste.** Il se compose d'un texte,
centré, replié comme le pied, puis du logo, centré, posé sur le bord bas du
cadre utile, le pied remontant d'autant. Le texte est la phrase d'origine, ou
celui que la machine garde à sa place (§ 8.5), sans borne de longueur : il se
replie et rapetisse comme elle. Le repli ne laisse un mot seul sur la dernière
ligne que si les deux derniers mots, le dernier morceau d'un mot coupé compris,
ne tiennent pas ensemble sur une ligne. Il garde le nombre de lignes du repli
mot à mot, et quand celui-ci finit sur un mot seul, les mots se répartissent
sur autant de lignes, la dernière de deux mots au moins, la plus large ligne la
plus étroite possible ; à largeur égale, la première ligne la plus longue, les
lignes suivantes se répartissant de même entre elles (leur plus large ligne la
plus étroite possible, puis leur première ligne la plus longue) — la phrase
d'origine, sur deux lignes, finit par « avec https://technolibre.ca pour votre
entreprise ». Un mot plus large qu'une ligne se coupe comme au pied : les
lignes qui précèdent celle du dernier morceau du dernier mot coupé restent
celles du repli mot à mot, ce morceau compte pour un mot, et lui et la suite se
répartissent sur les lignes restantes. Un texte vide ne pose que le logo, à la
même taille. La phrase d'origine donne la même planche, octet pour octet, que
la machine n'en garde pas d'autre ou qu'elle y soit revenue. Il ne prend que
l'écart que le badge, composé sans lui, laisse entre ses tours et son pied : il
ne réduit ni le nom, ni les tours, ni l'organisation, ni le pied, et ne les
déplace pas, le pied excepté. Il rapetisse jusqu'à un plancher lisible à la
loupe, puis se retire, et l'annonce le dit (§ 11.5). Un badge qui a perdu le nom
de l'événement, et à plus forte raison l'organisation, ne le porte pas : il
vient après eux dans l'ordre de sacrifice, et la place que leur retrait libère
ne lui revient pas. Sous un logo de participant, il cède au logo tout ce qui
dépasse son plancher, puis reprend le plus grand palier que le logo laisse ;
quand même ainsi le logo n'atteint pas son plancher, il se retire pour lui
(§ 11.5). Son logo, l'un des deux seuls éléments en couleur du badge
(§ 11.2), se dessine en vecteurs, chemins et couleurs du fichier de l'éditeur,
`src/actifs/full_logo_technolibre_2023.svg`, et un logo que l'éditeur changerait
pour une forme que la planche ne sait pas rendre fidèlement — un dégradé, une
transparence, un arc, une transformation — se refuse à la production au lieu de
sortir faux. **La feuille de contrôle ne le porte pas** : elle s'imprime sur
papier ordinaire et ne se distribue pas, et elle reste une page de mesure.

**Un itinéraire constant s'écrit en une ligne.** Quand une personne, présente
aux R tours, occupe la même table à chacun d'eux, R ≥ 2 — au même siège sous
attribution, sous le même titre —, le cas de tout participant ancré (§ 4.2), le
badge écrit « Toute la soirée — table 7 » plutôt que R lignes identiques ; deux
tables de même numéro et de libellés différents ne font pas une même table. Le
rang 2 ne perd rien : la question « où vais-je au tour 3 » reçoit la même
réponse, et la place gagnée revient au nom.

**Le filigrane BROUILLON s'applique au badge comme au reste** (§ 11.7). C'est la
sortie où la confusion coûte le plus cher : elle ne reste pas sur une table, elle
part au cou de deux cents personnes.

**Ce qui n'y va pas**, et la raison de chaque exclusion :

- **Le courriel.** Un badge se perd, se photographie et se lit par-dessus une
  épaule. Rien n'oblige à y porter une coordonnée.
- **Les notes.** Champ libre où l'opérateur écrit ce qu'il ne dirait pas à
  l'intéressé.
- **Le titre pressenti.** Il est informatif et ne pourvoit aucune place (§ 4).
- **Un titre de place que le moteur a simplement fait occuper.** Le § 4.1 pose
  qu'un titre n'est pourvu que par une **réservation**, et que dériver le rôle de
  l'occupation désigne l'animateur par tirage au sort. Imprimer le titre du siège
  occupé reproduit exactement cette faute, en la portant au cou. **Le badge porte
  le titre uniquement quand une réservation en fait la titulaire** et que le
  placement l'assied à la place de ce titre à ce tour — sa table, et son siège
  sous attribution —, et il l'écrit sur la ligne du tour concerné, non en
  bandeau — une titulaire d'un seul tour n'est pas animatrice de la soirée.
- **Le numéro d'identifiant**, sauf le cas d'homonymie ci-dessous.
- **Un code à barres ou un code QR.** Le logiciel est hors ligne, aucun lecteur
  n'existe dans la salle, et le code laisse croire qu'un système suit l'entrée.
- **Une couleur par table.** Des dizaines de tables ne se distinguent pas par des
  dizaines de teintes, et la planche sort souvent en noir et blanc.
- **Les indicateurs, le plafond, la qualité du placement.** Ils ne concernent pas
  la personne qui porte le carton.

**Les homonymes que rien ne sépare.** Le § 12.6 distingue les homonymes par leur
organisation et navigue par identifiant ; sur un badge, deux personnes de même
nom normalisé **et sans organisation, ou de même organisation normalisée**, ne
se distinguent par rien : une organisation imprimée deux fois à l'identique ne
les sépare pas plus que son absence. La pile étant
alphabétique, leurs deux cartons sont voisins : l'hôte en tend un au hasard et
deux personnes passent la soirée aux tables l'une de l'autre, sans que rien ne le
signale. Le logiciel **compte ces collisions avant de produire, les nomme, et
porte l'identifiant en pied des seuls badges concernés** — sauf quand la case
« Identifiant » est décochée : l'annonce les nomme encore, et aucun badge ne le
porte. Les homonymes se comptent sur le nom entier : la case des doublons n'en
fait pas, si bien que « Roger Galet 01 » et « Roger Galet 02 », la case
cochée, sortent en deux badges au nom laissé en blanc, sans ligne
« Identifiant n° … », et l'annonce ne les nomme pas.

### 11.5 Les cas qui cassent la mise en page

Le badge A6 est un cadre utile de **89 × 132 mm** — 105 et 148 moins deux fois
la zone de silence ; la carte Avery 5392, de **91,6 × 66,2 mm** — 101,6 et 76,2
moins deux fois la sienne. Chaque modèle a ses corps de départ, au registre des
constantes : sur la carte, la capitale du nom part de 7 mm, les tours de 12 pt,
l'organisation de 10 pt, le pied de 7 pt ; les planchers de lisibilité — la
capitale du nom à 4 mm, les tours à 10 pt, l'organisation à 8 pt, le pied à 5 pt
— sont communs aux deux modèles, comme le plancher du nom au dernier recours,
une capitale de 3 mm. Mesuré sur la police embarquée, un nom qui demande deux
lignes, quatre tours titrés sous sièges attribués, l'organisation et le pied
entier tiennent ensemble sur la carte ; la ligne « Toute la soirée — table 13 —
animation » mesure 65,3 mm au plancher des tours, et tient sur une ligne. Ce
qu'on y met est variable. Le logiciel fixe donc un **ordre de sacrifice**, écrit
une fois, et ne laisse jamais la mise en page se résoudre par un débordement.
**Aucun texte du badge ne s'abrège** : ce qui ne tient pas sur sa ligne se
replie sur la suivante, comme un paragraphe, au dernier espace qui tient ; un
mot plus large que la ligne s'y coupe entre deux lettres, jamais entre une
lettre et son accent. Le badge porte son texte entier, ou se refuse.

> nom › lignes de tour › organisation › nom de l'événement › image des badges › logo du participant › pied TechnoLibre

Le nom et l'organisation y sont des **rôles** : le gros texte et le petit.
Sous la case de l'organisation en gros (§ 11.4), l'organisation tient le rôle
du nom, et le nom celui de l'organisation ; tout ce que cette section dit du
nom vaut alors pour elle, corps, repli, plancher et refus compris, et ce
qu'elle dit de l'organisation vaut pour le nom de la personne.

**Le refus vient après le dernier recours.** Un badge dont les lignes de tour ne
tiennent pas même dépouillé — le nom à son plancher, sans le nom de l'événement
ni l'organisation, donc sans image des badges, ni logo du participant, ni pied
TechnoLibre — réduit encore tout ce qui n'est pas ses tours, dans cet ordre,
avant que le logiciel ne refuse la planche. D'abord ses lignes se resserrent :
chacune n'occupe plus la hauteur que la police réserve à tout glyphe, mais celle
de l'encre que posent les textes de ce badge, du plus haut accent au plus bas
jambage. Deux lignes ne mêlent jamais leur encre, mais aucun jeu ne les sépare :
un jambage peut toucher l'accent de la ligne suivante, à sa verticale. Puis le
pied rapetisse d'un point par palier jusqu'à son plancher, 5 pt, date et
horodatage toujours entiers. Puis le nom passe sous son plancher, d'un point par
palier, replié chaque fois sur le moins de lignes qui tient, jusqu'à une
capitale de 3 mm, et jamais sous le corps des tours à leur plancher : le nom
reste le plus grand texte du badge. Les lignes de tour gardent leur plancher de
10 pt ; le papier ne change pas, rien ne s'abrège, et la première étape qui
tient l'emporte. La gouttière entre deux colonnes et le retrait d'une suite
gardent leur cadratin : la gouttière seule sépare deux colonnes de lignes
inégales, le retrait seul dit qu'une ligne continue la précédente. Ces deux
planchers sont au registre des constantes (`CORPS_PIED_PLANCHER_PT`,
`HAUTEUR_CAPITALE_NOM_DERNIER_RECOURS_MM`, § 14.1), défauts de travail jusqu'à
leur relevé sur une impression réelle ; ce relevé dit aussi si des lignes
serrées dont l'encre se touche se lisent, et relève les planchers sinon. Un
badge qui tient sans le dernier recours ne change pas.

- **Un nom très long.** Le nom **ne s'abrège jamais**. Un nom que la case des
  doublons laisse en blanc (§ 11.4) se mesure entier, comme imprimé : sa place
  vide est celle qu'il prendrait, et il se refuse comme lui. Le logiciel réduit
  le corps par paliers jusqu'à un plancher de lisibilité **mesuré sur les
  métriques de la police embarquée**, puis replie sur une seconde ligne, puis
  sur une troisième — aux espaces, et entre deux lettres seulement quand un mot
  seul ne tient pas, jamais entre une lettre et son accent. Si, le nom au
  plancher, le badge ne tient toujours pas, il se dépouille dans l'ordre de
  sacrifice : le nom de l'événement quitte le pied, sa date restant, puis
  l'organisation part. **Au-delà de trois lignes, le nom continue de se
  replier** au corps plancher, sur autant de lignes qu'il lui faut, et le badge
  perd d'emblée le nom de l'événement, puis l'organisation s'il le faut ; si les
  lignes de tour ne tiennent plus sous lui, même au dernier recours, le logiciel
  **refuse de produire la planche** et nomme la personne, dont le nom se corrige
  dans la liste des participants. Une organisation en gros (§ 11.4) qui ne tient
  pas se refuse de même, et le refus nomme la personne : l'organisation se
  raccourcit dans la liste des participants, ou sa case se décoche, qui la remet
  en petit. L'horodatage ne quitte jamais le pied ; seule sa case le retire
  (§ 11.4). Le seuil se cale sur le **glyphe le plus large** de l'alphabet visé,
  jamais sur une moyenne (§ 14.1) : un nom en capitales larges déborde sinon
  par-dessus la première ligne de tour, en silence.
- **Une organisation très longue.** Elle **se replie** sur autant de lignes
  qu'il lui faut, chacune centrée, et ne s'abrège jamais. C'est une étiquette
  de contexte, pas une identité : repliée, elle rapetisse, quand le badge ne
  tient pas, avant le nom et les tours, d'un point par palier, de son corps
  de départ jusqu'à son plancher, 8 pt, au registre des constantes (§ 14.1).
  Une organisation qui tient sur une ligne garde son corps de départ. Si même
  ainsi le badge ne tient pas, le nom au plancher et le nom de l'événement
  parti, elle part entière, dans l'ordre de sacrifice, plutôt que de sortir
  tronquée.
- **Beaucoup de tours.** Le logiciel passe à deux colonnes au-dessus d'un
  nombre de tours **mesuré sur le gabarit**, et **n'affiche jamais une liste
  tronquée** : un badge qui omet le tour 5 envoie son porteur nulle part. Si la
  liste ne tient pas à deux colonnes au corps plancher, même au dernier recours,
  le logiciel **refuse de produire la planche** et nomme le nombre de tours en
  cause ; les lignes repliées (puce suivante) y comptent chacune. Sans libellé
  de table ni titre longs, le gabarit tient largement les deux à six tours d'une
  soirée ordinaire ; ce refus est une garde contre la troncature silencieuse,
  pas un comportement attendu. Sur la carte Avery 5392, sous un nom court et son
  organisation, quarante-quatre lignes de tour sans siège ni titre tiennent sur
  deux colonnes, au dernier recours, et la quarante-cinquième se refuse. Quand
  ce sont des lignes repliées par un libellé ou un titre qui débordent, et non
  leur nombre, le refus le dit autrement (puce suivante).
- **Un titre long, ou un long libellé de table, sur une ligne de tour.** Une
  ligne de tour s'écrit entière ; au corps plancher seulement, une ligne trop
  large pour sa colonne **se replie**, au dernier espace qui tient, et sa suite
  descend sous elle **en retrait** d'un cadratin, dans la même colonne : l'œil
  retrouve le début de chaque tour. Un numéro ne quitte pas le mot qui l'annonce
  — « Tour 2 », « table 5 », « siège 3 » restent sur une même ligne —, car la
  table et le siège sont la réponse que le badge porte. Rien ne s'y abrège, ni
  le libellé de la table, ni le titre, ni le numéro de la table, ni le siège ;
  un mot plus large que la ligne s'y coupe comme ailleurs. Les lignes repliées
  comptent dans la hauteur des tours : elles avancent le passage à deux colonnes
  et le refus. Tout voir a donc un prix, mesuré sur la police embarquée sous un
  nom court, son organisation et des sièges attribués, le dernier recours
  compris : sur la carte Avery 5392, un libellé de soixante caractères, le plus
  long que la saisie admet (§ 4), tient replié jusqu'à huit tours, sous le titre
  « animation » comme sans titre, et jusqu'à cinq sous un titre de trente-deux
  caractères, « Animatrice de la table d'honneur » ; un libellé de quarante
  caractères, jusqu'à dix ; un libellé court sous le titre « animateur VIP »,
  jusqu'à douze. Sur l'A6, le libellé de soixante caractères tient jusqu'à
  quatorze ou dix-sept tours, selon le titre. Au-delà, le logiciel **refuse de
  produire la planche**, et ce refus ne met pas en cause le nombre de tours : il
  **nomme la personne** dont les lignes débordent, dit qu'un libellé de table ou
  un titre trop long les replie, et offre d'ouvrir la section des tables, où
  l'un et l'autre se raccourcissent.
- **Un caractère que la police n'a pas** — un nom écrit hors de l'alphabet latin,
  par exemple, ou un caractère du texte du pied TechnoLibre saisi sur la
  machine (§ 8.5). La police le dessinerait comme une case vide, et l'opérateur ne le
  verrait qu'au cou de l'invité. Le logiciel nomme ces caractères dans l'annonce,
  **avant de produire** ; la feuille de contrôle les liste par leur point de code
  — « U+674E » — et n'en écrit jamais un tel quel. Ceux du nom de l'événement,
  que la feuille de contrôle écrit toujours, se nomment de même, même quand
  sa case le retire des badges (§ 11.4), comme ceux d'un nom que la case des
  doublons laisse en blanc, que la liste d'une réédition écrit entier. La
  planche se produit : le remède est dans la liste des participants, et
  l'opérateur décide.
- **Un participant sans organisation.** La ligne **n'existe pas**. Ni espace
  réservé, ni tiret : le « — » signale une mesure vide dans la page de qualité
  (§ 5.4), et sur un carton il se lit comme une donnée manquante dont la personne
  viendra demander la cause à l'accueil. La place libérée revient au bloc du nom.
  La mise en page est donc un flux, non une grille de cases fixes. Une
  organisation, ou une ligne de pied, que sa case retire (§ 11.4) s'en va de
  même, et sa place revient au reste.
- **Une personne en réserve à un tour.** La ligne porte « pas de table » en toutes
  lettres. Une ligne blanche se lit comme un défaut d'impression. En réserve à
  tous les tours, elle garde une ligne par tour : la réserve n'est pas une
  table, et son badge n'a jamais la ligne « Toute la soirée ».
- **Une personne absente à un tour.** La ligne de ce tour porte « absente » en
  toutes lettres — « Tour 3 — absente » —, ni table, ni siège, ni titre, et
  chaque tour garde sa ligne : une personne absente à un tour n'a jamais la
  ligne « Toute la soirée », même assise à la même table à chacun de ses tours
  de présence. Ni ligne blanche ni « pas de table », qui dirait qu'une table
  l'attend. Elle a son badge et compte dans les badges produits.
- **Une personne exclue** n'a pas de badge (§ 4). Le logiciel annonce le compte
  produit et le compte attendu — « 257 badges pour 260 participants, 3 exclus » —
  sur la feuille de contrôle, pour que l'écart soit lu avant la coupe et non à
  l'accueil.
- **Un badge sans place pour le pied TechnoLibre.** Le pied TechnoLibre
  (§ 11.4) part de 6 pt, et descend d'un point par palier jusqu'à son
  plancher, 4 pt, lisible à la loupe ; son logo mesure deux cadratins de ce
  corps de haut — 4,2 mm au départ, 2,8 mm au plancher —, cinq fois plus en
  largeur. Ces valeurs sont communes aux deux modèles ; le corps de départ et
  le plancher sont au registre des constantes (§ 14.1), défauts de travail
  jusqu'à leur relevé sur une impression réelle. Il prend le plus grand palier
  dont le texte et le logo tiennent dans l'écart libre ; quand même le
  plancher ne tient pas, ou que le badge a perdu le nom de l'événement ou
  l'organisation, qui le précèdent dans l'ordre de sacrifice, il se retire de
  ce badge, qui sort tel qu'il serait sans lui, et l'annonce compte les badges
  concernés — « Pied TechnoLibre : retiré de 3 badges, faute de place sous
  leurs tours. ». Ce n'est jamais un refus : la planche se produit. Mesuré sur
  la police embarquée, sous un nom d'une ligne et son organisation, avec des
  lignes de tour sans siège ni titre, il tient au corps de départ jusqu'à cinq
  tours sur la carte Avery 5392 et treize sur l'A6. Un texte que la machine
  garde à la place de la phrase d'origine (§ 8.5) suit la même règle : plus
  long, il rapetisse plus tôt et se retire plus tôt ; vide, le bloc n'est que
  le logo. Sous un logo de participant, il se compte d'abord à son plancher,
  puis reprend le plus grand palier que le logo laisse, et se retire quand le
  logo ne trouve qu'ainsi sa place : le retrait se compte de même.
- **Un badge sans place pour le logo du participant.** Le logo prend l'écart
  entre les tours et le pied, moins 1,5 mm au-dessus et au-dessous ; sa plus
  petite cote dessinée ne descend pas sous 8 mm. Ces deux valeurs, communes
  aux deux modèles, sont au registre des constantes
  (`LOGO_PARTICIPANT_ECART_MM`, `LOGO_PARTICIPANT_PLANCHER_MM`), défauts de
  travail jusqu'à leur relevé sur une impression réelle. Quand même sans le
  pied TechnoLibre il n'atteint pas son plancher, ou que le badge a perdu le
  nom de l'événement ou l'organisation, il ne se pose pas sur ce badge, qui
  sort tel qu'il serait sans logo, et l'annonce compte les badges concernés —
  « Logo du participant : retiré de 3 badges, faute de place sous leurs
  tours. ». Un logo très large bute sur la largeur du cadre, un logo très haut
  sur la hauteur de l'écart ; l'un et l'autre peuvent ainsi manquer leur
  plancher sur tous les badges. Ce n'est jamais un refus.
- **Un badge sans place pour l'image des badges.** L'image se taille avant le
  logo du participant et le pied TechnoLibre : la plus grande boîte, au rapport
  de l'image, sous sa hauteur maximale — `IMAGE_BADGES_HAUTEUR_MAX_MM`, 30 mm
  sur l'A6, `IMAGE_BADGES_HAUTEUR_MAX_CARTE_MM`, 15 mm sur la carte —, dans la
  largeur du cadre et dans l'écart que le texte laisse entre les tours et le
  pied, moins le dégagement du logo, `LOGO_PARTICIPANT_ECART_MM`, sous elle en
  haut, de part et d'autre au centre et en bas. Le logo du participant et le
  pied TechnoLibre prennent ensuite, par leurs règles, l'écart qu'elle laisse.
  Quand sa plus petite cote n'atteint pas le plancher du logo,
  `LOGO_PARTICIPANT_PLANCHER_MM`, ou que le badge a perdu le nom de l'événement
  ou l'organisation, elle ne se pose pas sur ce badge, qui sort tel qu'il serait
  sans elle, et l'annonce compte les badges concernés — « Image des badges :
  retirée de 3 badges, faute de place. ». Deux colonnes de tours libèrent de la
  hauteur : l'image peut y reparaître. Mesuré sur la police embarquée, sous un
  nom d'une ligne, son organisation et trois tours sans siège ni titre, une
  image carrée ou deux fois plus large que haute tient à sa hauteur maximale sur
  la carte Avery 5392, à chaque position, et le pied TechnoLibre y garde sa
  place. Une image très large bute sur la largeur du cadre, une image très haute
  sur sa hauteur maximale : sur la carte, une image plus étroite que 8 mm de
  large pour 15 mm de haut — près de deux fois plus haute que large — n'atteint
  pas son plancher, et ne se pose sur aucun badge. Les deux hauteurs maximales
  sont au registre des constantes (§ 14.1), défauts de travail jusqu'à leur
  relevé sur une impression réelle. Ce n'est jamais un refus.
- **Une image des badges introuvable ou illisible.** Le fichier que
  l'événement désigne peut manquer au dossier de l'événement ou ne pas se lire
  comme un PNG. L'annonce le dit — « Image des badges introuvable dans le
  dossier de l'événement : les badges s'impriment sans image. », « Image des
  badges illisible : … » —, de même qu'une case cochée sans image choisie, et
  les badges s'impriment sans elle. Ce n'est jamais un refus : un fichier
  remis se lit à la préparation suivante.
- **Un logo introuvable ou illisible.** Le fichier qu'une fiche désigne peut
  manquer au dossier de l'événement — un événement importé d'un seul fichier
  d'état —, ne pas se lire, ou ne pas être un PNG. L'annonce nomme les
  personnes concernées, la cause dite — « Logo introuvable dans le dossier de
  l'événement pour… », « Logo illisible pour… » —, et leur badge s'imprime
  sans logo. Ce n'est jamais un refus (§ 5.9) : la planche se produit, et un
  fichier remis se lit à la préparation suivante. La feuille de contrôle
  compte ces logos parmi les introuvables. Seules la structure et les sommes
  de contrôle du PNG s'éprouvent à la préparation : un fichier dont les
  données compressées ne se décompressent pas, qu'aucune image écrite par
  l'interface ne donne, se compte posé, et son badge sort sans logo.

### 11.6 L'ordre des badges, et l'imposition

**L'ordre est alphabétique**, sur la **forme normalisée** du § 10.1 — espaces
réduits, casse et accents ignorés — appliquée au couple (nom, prénom), et
départagée par identifiant entier pour que deux productions de la même planche
soient identiques. Le nom est le nom entier, numéro compris, même quand la case
des doublons le laisse en blanc sur le badge (§ 11.4) : « Roger Galet 01 » se
range après « Zoé Galet », et non à côté de « Roger Galet ».

**La comparaison n'emploie pas `localeCompare`** : le § 15.5 l'interdit pour la
même raison qu'ici, l'ordre dépendrait de la langue du système et deux machines
produiraient deux piles différentes du même fichier. Le logiciel compare les
formes normalisées par points de code.

La justification de l'ordre est le geste réel : à l'accueil, une personne arrive
et **dit son nom**. L'hôte cherche dans une pile. Un classement par table
exigerait de connaître la table avant de connaître la personne, c'est-à-dire de
disposer déjà de la réponse que le badge apporte. Le classement par table sert un
autre geste — déposer les cartons sur les tables avant l'arrivée — que le logiciel
offre en second choix et ne retient pas par défaut. Il range les badges par numéro
de la table du premier tour, puis dans l'ordre alphabétique ; les personnes en
réserve au premier tour viennent après les tables, puis celles qui y sont
absentes.

**L'ordre sur la feuille dépend de la façon de couper, et le logiciel le
demande** pour l'A6 ; les cartes Avery 5392, qui ne se coupent pas, suivent
toujours la feuille par feuille, et la question ne se pose pas. C'est la
différence entre une pile prête à l'emploi et des centaines de cartons à
intercaler à la main.

| imposition | ce que le logiciel écrit sur la planche *i* (sur *S* planches, *P* cellules par planche) | pour qui |
|---|---|---|
| **feuille par feuille** *(défaut)* | les badges *P*(*i*−1)+1 à *Pi*, en ordre de lecture | ciseaux ou massicot à main : l'opérateur empile les cartons d'une feuille, puis la feuille suivante par-dessous, et la pile sort triée |
| **en pile** | en position *p*, le badge (*p*−1)×*S* + *i* | massicot qui tranche toute la rame : les *P* piles obtenues s'empilent dans l'ordre 1…*P* et donnent la séquence complète |

**Les cellules excédentaires restent vides, sans filet ni mention.** Leur place
dépend de l'imposition, et le logiciel ne prétend pas le contraire : en feuille
par feuille elles sont au pied de la **dernière** planche ; en pile, la formule
les envoie au bas des **dernières piles**. Dans les deux cas les blancs tombent à
la fin de la pile finale, ce qui est la propriété qui compte.

Les deux impositions produisent la même pile finale par deux gestes différents ;
prendre l'une pour l'autre oblige à retrier la totalité. Le logiciel inscrit
l'imposition retenue **dans le nom du fichier produit**, avec le nom de
l'événement, le format de papier, la source, l'ordre et l'horodatage du
placement, parce que c'est la seule chose qui survit à l'envoi de la planche à
quelqu'un d'autre. Le nom suit un gabarit fixe :

```
<base>.badges[-p<id>][-<k>]_<A4|Lettre>_<feuille|pile>[_table]_<AAAA-MM-JJ_HH-MM-SS>[_<n>].pdf
<base>.badges[-p<id>][-<k>]_avery5392[_table]_<AAAA-MM-JJ_HH-MM-SS>[_<n>].pdf
<base>.controle[-p<id>][-<k>]_avery5392[_table]_<AAAA-MM-JJ_HH-MM-SS>[_<n>].pdf
```

— la première ligne pour l'A6, les deux suivantes pour les cartes Avery 5392
et leur feuille de contrôle à part, où le modèle tient la place du papier et de
l'imposition, qu'il fixe. Les deux noms d'Avery se choisissent ensemble : même
rang, le premier où ni l'un ni l'autre n'est pris, et même tête quand la base
se raccourcit, réglée sur le plus long des deux. Le plus long nom d'Avery sans
marque, `.controle-9999_avery5392_<date>.pdf`, compte 48 unités, sous les 51
du plus long de l'A6.

— la base des fichiers de l'événement (§ 8.6), raccourcie et suivie d'un point
quand le chemin dépasserait la borne (ci-dessous) ; l'identifiant de la proposition
imprimée, rien pour le retenu ; le nombre k de badges d'une réédition ; le
papier ; l'imposition ; `_table` pour l'ordre par table, rien pour l'ordre
alphabétique ; le jour et l'heure de l'horodatage du placement, décalage
retiré, ou `horodatage-inconnu` quand le placement n'en porte pas ; enfin le
rang n d'un nom déjà pris dans le dossier. Il ne contient aucun deux-points,
que Windows refuse.

**Le nom est injectif sur ce qui change la pile.** Une génération date toutes
les propositions qu'elle ajoute du même instant (§ 8.9) : sans leur identifiant,
deux propositions donneraient le même nom, et la seconde planche remplacerait la
première sans rien dire. L'ordre par table change la pile autant que
l'imposition, et se lit donc dans le nom de la même façon. Même événement, même
source, même papier, même imposition, même ordre, même placement : même nom, et
la planche entière remplace la sienne, qui imprime la même pile. Le logo d'une
personne, la case du pied TechnoLibre et celle des doublons n'entrent pas dans
le nom : une planche refaite après un changement de logo remplace celle du même
placement. **Une réédition ne remplace jamais un fichier** : deux rééditions de
trois personnes différentes partagent tout le reste du nom, et la seconde prend
le premier rang libre, `_2`, `_3`…, comme le dossier daté de la corbeille
(§ 8.7). Une planche dont la base se raccourcit (ci-dessous) prend aussi le
premier rang libre : la base d'un événement et celle de sa copie (§ 8.7), qui
partagent propositions et horodatages, peuvent se raccourcir en une même tête.
Une base lue sur le disque qui finit par un point — celle d'un fichier
« Gala..gtt.json » déposé dans le dossier — prend aussi le premier rang libre :
son nom entier est celui qu'une base plus longue raccourcit en la même tête.
Un dossier qui ne se liste pas refuse ces planches plutôt que de risquer un
remplacement, et offre « Enregistrer sous… ».

**Le nom tient sous la borne de chemin du § 8.6.** Sans marque, son plus long
suffixe tient dans la réserve que la borne fait à chaque base. Les marques et le
rang l'allongent : quand le chemin complet dépasserait la borne, la base se
raccourcit dans le nom de la planche, sans couper un caractère, espaces et points
finaux retirés, sans laisser un nom réservé (§ 8.6), suivie d'un point ; le reste
du nom demeure entier. Aucune base dérivée ne finit par un point, que Windows
retire de la fin d'un nom et que la dérivation retire donc aussi (§ 8.6) : un
nom raccourci ne se confond avec aucun nom entier. Une base lue sur le disque
peut finir par un point ; son nom se choisit alors parmi les entrées du
dossier, si bien que la planche entière d'une base qui tient ne remplace jamais
une planche raccourcie. Le nom raccourci dépend du chemin du dossier qui le
reçoit, celui de l'événement — la racine, un séparateur, le dossier — : la
borne compte le nom de l'événement deux fois, dans le dossier et dans la base,
si bien qu'un nom d'événement long raccourcit plus tôt une planche marquée.
Quand même un caractère de la base ne tient pas, le nom garde sa base,
l'écriture refusée se dit, et « Enregistrer sous… » dépose la planche ailleurs.

**Sous `electron`, le fichier se dépose dans le dossier de l'événement**
(§ 8.6), `<racine>\<dossier>\<nom>`, par une écriture atomique ; les noms déjà
pris se lisent dans ce dossier, et le logiciel nomme le chemin de chaque fichier
— les cartes d'abord, puis la feuille de contrôle à part, chacune nommée ; une
écriture refusée se dit en nommant le fichier en cause et le dossier — une
feuille de contrôle refusée après les cartes dit aussi que les cartes, elles,
sont déposées, et où — et offre « Enregistrer sous… », qui ouvre un dialogue par
fichier et nomme chaque chemin choisi ; une feuille de contrôle refusée au
second dialogue se dit de même, le chemin des cartes écrites montré. Un dossier
d'événement qui disparaît pendant la séance — déplacé, renommé ou retiré hors de
l'application — ne se recrée pas (§ 8.6) : la production se refuse en disant le
dossier introuvable, et « Enregistrer sous… » reste offert. La section de
l'impression offre **en tout temps « Ouvrir le dossier »**, parmi ses commandes,
avant toute production comme après : la commande montre dans l'explorateur du
système le dossier de l'événement, où la planche se dépose, sous la racine où
l'événement est ouvert — la nouvelle, après l'écriture ailleurs (§ 8.6) —, et
jamais l'emplacement choisi par « Enregistrer sous… » ; un dossier disparu s'y
refuse de même, nommé. L'accueil garde « Ouvrir dans l’explorateur », qui montre
le dossier de travail (§ 8.6). **Sous `web`, la planche se télécharge** : le
dossier de travail y est invisible à l'opérateur, la section nomme le fichier —
les deux fichiers d'Avery 5392 —, sans chemin, et n'offre pas « Ouvrir le
dossier ».

**La planche se produit depuis le retenu, ou depuis une proposition choisie**
(§ 2.1, étape 12). La section de l'impression offre le retenu quand il existe,
et la proposition choisie dans la section des propositions ; l'annonce nomme la
source. Une planche tirée d'une proposition sort **toujours** en BROUILLON
(§ 11.7), à l'horodatage de cette proposition : elle n'est pas le plan retenu.
Sans retenu ni proposition désignée, la production se refuse et renvoie aux
propositions. Une proposition qui se contredit se refuse aussi, et renvoie aux
propositions : la version précédente du fichier, le remède d'un retenu qui se
contredit, ne se reprend pas pour elle, puisque le retenu est sain.

**La liste des badges, en CSV.** La section de l'impression offre, à côté de
« Produire la planche (PDF) », **« Produire la liste (CSV) »** : la liste se
tire de la même source et dans le même ordre que la planche, pour toute la
soirée ; la réédition de la section ne produit que la planche. La séance
accepte aussi une demande de liste qui porte une sélection : la liste n'a alors
que les badges choisis, et son nom porte leur nombre k, comme la planche d'une
réédition. Un enregistrement par badge : le nom entier et le prénom de la
personne — même quand la case des doublons les laisse en blanc sur le badge
(§ 11.4), le prénom vide quand elle n'en a pas —, l'organisation telle que le
badge l'imprime, vide sans elle, puis ses tours, sous les en-têtes `Nom`,
`Prénom`, `Organisation`. Les personnes exclues n'y figurent pas.

**Ses tours prennent l'une de deux formes**, que le réglage « Colonnes de la
liste (CSV) », parmi ceux de la planche, choisit pour la machine (§ 8.5) :

- **Une colonne par tour**, par défaut. Chaque tour a sa colonne, dont
  l'en-tête est le nom du tour (§ 4), ou « Tour 3 » sans lui, et dont la
  cellule porte la place de la personne à ce tour, sans le tour : « table 5
  (Terrasse), siège 2 — animation », « pas de table », « absente ». Un
  itinéraire constant remplit chaque colonne de la même place : le tableur
  trie et filtre tour par tour.
- **Une seule colonne**, sous l'en-tête `Tours`. La cellule porte les lignes
  de tour du badge, **texte pour texte**, jointes par « ; » : « Plat
  principal — table 3 ; Dessert — table 5 », ou « Toute la soirée — table 13
  — animation » quand rien ne change.

Dans les deux formes, rien n'est abrégé, et la cellule, comme la tête de sa
colonne, tient sur une ligne : un saut de ligne qu'un nom de tour, un libellé
de table ou un titre lu d'un fichier porte devient une espace. Les têtes ne
sont pas garanties uniques : deux tours de même nom, ou un tour nommé `Nom`,
donnent deux colonnes de même tête. Le choix ne change ni la pile ni le nom du
fichier : une liste produite de nouveau sous l'autre forme, du même placement,
remplace la précédente.
**Elle ne porte jamais le logo** : un logo ne se range pas dans une cellule, ses
octets sont les mêmes avec et sans logos, et elle ne lit aucun fichier de logo.
Le fichier est celui de l'export des participants (§ 10.3) : UTF-8 avec marque
d'ordre d'octets, `;`, CRLF entre les enregistrements, et une cellule qui porte
le séparateur s'écrit entre guillemets (RFC 4180). Mêmes entrées, même choix,
mêmes octets. Il se dépose dans le dossier de l'événement, comme la planche, et
« Ouvrir le dossier » le montre ; sous `web`, il se télécharge. Son nom suit le
gabarit de la planche, sans papier, imposition ni modèle, qui ne changent pas la
liste :

```
<base>.badges[-p<id>][-<k>][_table][_BROUILLON]_<AAAA-MM-JJ_HH-MM-SS>[_<n>].csv
```

— `_BROUILLON` quand la source n'est pas le placement retenu d'un plan retenu
ou bloqué, toujours pour une proposition : la liste n'a pas de filigrane, son
nom le porte. Son plus long suffixe sans marque compte 46 unités, sous les 51
de la planche : la même borne le tient, et les mêmes règles de rang et de
coupe s'y appliquent. La liste subit les refus du **placement** — sans
placement, placement qui se contredit ou qui ne décrit plus la soirée —, et
la commande se désactive, expliquée, tant que l'annonce montrée en porte un ;
jamais ceux de la **mise en page** : un nom trop long pour son badge ou des
tours trop nombreux n'empêchent pas une ligne de tableur. Une écriture
refusée nomme la liste et offre « Enregistrer sous… ».

**Produire la planche n'est pas une modification.** Elle n'écrit aucun fichier
d'événement et n'ajoute aucune entrée d'historique (§ 8.2), donc elle reste
disponible en **mode lecture** et sur un plan **bloqué**, où la lecture et
l'impression restent ouvertes (§ 9). Ses seules écritures sont ses PDF, sa
liste CSV et, dans les réglages locaux (§ 8.5), les choix de la section,
chacun au geste qui le fait : le papier, le modèle de badge, la case du pied
TechnoLibre et son texte, les cases de ce que le badge imprime, celle qui
laisse en blanc le nom des doublons et celle qui met l'organisation en gros
(§ 11.4), et les colonnes de la liste. L'image des badges fait exception : un
réglage de l'événement, non du poste, dont chaque geste est une entrée
d'historique (§ 8.9), et que la section ne change qu'en écriture.

### 11.7 Les autres sorties, et ce que porte toute page imprimée

Le logiciel n'en produit **aucune en PDF**. Elles se lisent à l'écran et chacune
porte une **feuille de style d'impression** que le navigateur ou l'hôte
`electron` applique. Une impression mal paginée s'y rattrape en réimprimant une
page ; aucune ne se découpe, aucune ne doit entrer dans une pochette.

| vue | qui s'en sert, quand | ce qui se passe sans elle |
|---|---|---|
| **liste d'accueil** | l'accueil, du début à la fin de l'arrivée | la pile de badges triée la remplace **pour l'arrivée** ; elle ne la remplace ni pour « où est assise telle personne ? » posé par un tiers, ni pour un badge perdu en cours de soirée. Le logiciel la conserve : c'est une table de texte, la sortie la moins exposée au risque de pagination, et la plus manipulée |
| **feuille par table** | l'animateur de table, à chaque changement de tour | chacun connaît sa table par son badge, donc la rotation se fait ; ce qui disparaît est l'appel nominal, et une place vide ne se remarque plus |
| **plan de salle** | l'opérateur et le personnel, au montage | il reste à l'écran, où il est interactif ; c'est la vue qui perd le plus à n'être pas sur papier pendant le montage d'une salle sans portable |

**Toute impression passe par l'aperçu**, que la section « Impression » de
l'événement porte sous son titre « Plan », après la partie « Badges » — la
planche, sa liste CSV, la réédition. C'est le seul endroit d'où l'on imprime :
l'événement n'a pas d'autre commande d'impression, et l'aperçu n'a ni écran à
lui ni commande pour se refermer. Il s'ouvre avec la section, sur le plan au
tour que le plan montre, et tombe quand une autre section s'ouvre ; ses réglages
ne s'écrivent nulle part. Il offre **trois vues** : le plan, tour par tour ; la
liste d'accueil ; la feuille par table. Le tableau des propositions (§ 5.7) et
la page de qualité (§ 12) se lisent à l'écran, où l'opérateur choisit sa
proposition : ils ne s'impriment pas, et aucun indicateur ne s'exporte en CSV.
L'aperçu imprime la source que le plan montre — le retenu, la proposition
montrée, ou les seules réservations — et n'écrit rien dans l'événement : il vit
en lecture et sur un plan bloqué. Sa commande « Imprimer » demande à la
plateforme le papier et l'orientation de la vue : la boîte de dialogue du
navigateur sous `web`, celle du système sous `electron`. Un échec se dit sur la
commande ; une annulation ne dit rien. La barre de l'aperçu, qui ne s'imprime
pas, groupe ses commandes : la vue imprimée, les réglages de la vue, le papier
et « Imprimer ». À l'impression, la feuille de style ne peint que les pages : ni
la navigation, ni la partie « Badges », ni les titres de la section, ni la
barre.

**La feuille par table couvre la soirée** : une feuille par table, une colonne
par tour, que l'animateur garde d'un tour à l'autre. L'aperçu offre aussi « Une
feuille par tour », une feuille par table et par tour. **Une table où personne
n'est assis aux tours d'une feuille n'a pas cette feuille**, même quand ses
places portent un titre ; une soirée sans table occupée imprime une feuille qui
le dit. **Chaque table commence une page**, et chaque occupant y porte son
organisation après son nom, séparée d'un tiret, à l'encre secondaire — rien
quand il n'en a pas. Ses colonnes et ses lignes suivent le § 7.4 : des tours
qui ne tiennent pas côte à côte se scindent en groupes de tours consécutifs,
et une ligne plus haute qu'une page se poursuit sur la suivante.

**Le texte d'une feuille par table grandit pour remplir sa page, sans
exagérer.** Le corps des noms part de celui de toute liste imprimée, 12 pt, et
monte au plus à 18 pt, titre et retraits dans la même proportion : la plus
grande taille, par pas d'un trente-deuxième, où la table tient sur sa page —
mesurée sur les dimensions du papier choisi, jamais sur la fenêtre — et où
chaque mot tient encore dans sa colonne, sans se couper. Chaque table a sa
taille, la même sur toutes ses pages. Une table qui ne tient pas sur une page au
plancher le garde, et se poursuit sur la suivante : jamais de texte tronqué ni
qui déborde.

**« Dessiner la table »**, décochée par défaut, pose en tête de chaque page de
la feuille par table, à la place de son titre, le dessin de la table tel que le
plan imprimé la dessine au premier tour de la feuille — sa forme, ses chaises,
son numéro et son libellé —, réduit à 40 mm de haut ; la taille du texte se
règle sur la place qu'il laisse. Décochée, le titre nomme la table par son
numéro et, quand elle en porte un, par son libellé (§ 4), entier : il replie
dans la largeur de la page, entre deux caractères au besoin. C'est un réglage
de l'aperçu, que rien n'écrit.

La liste d'accueil couvre aussi la soirée, une colonne par tour ; la case d'un
tour où la personne est absente porte « absente », ni table, ni siège, ni
réserve. La feuille par table ne nomme pas une personne absente à son tour :
l'appel nominal ne la cherche pas. Des tours trop nombreux pour la page se
répartissent en blocs de tours consécutifs, chacun sous l'en-tête qui nomme ses
tours (§ 7.4). **Les listes s'impriment en portrait.**

**La liste d'accueil se trie par organisation, par nom ou par prénom**, au
choix de « Trier par », dans les réglages de sa vue ; elle s'ouvre triée par
organisation. Par organisation, les personnes d'une même organisation se
suivent, par prénom puis par nom, et celles qui n'en ont pas viennent à la fin ;
la dernière ligne de chaque organisation porte un filet à l'encre du texte, de
la même épaisseur que les autres, si bien que ni la hauteur des lignes ni la
pagination n'en dépendent. Par nom : le nom, puis le prénom, puis
l'organisation. Par prénom : le prénom, puis le nom, puis l'organisation, et les
personnes sans prénom à la fin. Toutes les clés sont les formes normalisées du
§ 10.1, comparées par points de code, comme l'ordre des badges (§ 11.6) ; un
champ absent, ou fait de blancs, compte comme le texte vide là où il départage,
et l'identifiant départage en dernier. C'est un réglage de l'aperçu, que rien
n'écrit.

**Chaque page imprimée porte un pied de cinq éléments** : le nom de l'événement,
sa date, **le tour** — par son nom quand il en porte un (§ 4), ou la soirée,
pour une vue qui les couvre tous —, **l'horodatage du placement** et **la
version** (§ 18.6). Une feuille sans horodatage circule après avoir été
invalidée et personne ne peut dire laquelle des deux versions posées sur la
table est la bonne. La règle vise la **page** ; un carton découpé et porté au
cou n'est pas une page (§ 11.4). Le pied porte le nom entier, jamais tronqué. Un
nom qui passe la borne du § 8.1 ne s'imprime pas : l'aperçu le refuse avant de
mettre une page en forme, dans aucune vue, et pose sur « Imprimer » le refus
`NOM_EVENEMENT_TROP_LONG` avec le remède « Renommer ». Ce remède ferme
l'événement et rend la liste des événements, où il se renomme : la liste lue, le
focus va à la commande « Renommer » de sa ligne, un filtre qui la cachait levé.
« Imprimer » rend ce refus sans appeler l'imprimante.

**Toute page imprimée porte la mention BROUILLON en filigrane, sauf dans un seul
cas** : celle qui imprime le placement retenu, quand le plan est retenu ou
bloqué et que le tour imprimé est l'un de ceux que le retenu porte — tous, pour
une vue qui couvre la soirée. La règle vaut pour la planche de badges, qui
couvre la soirée : une planche tirée d'une proposition est toujours un
brouillon (§ 11.6).
L'état seul ne lève pas le filigrane : une proposition montrée puis imprimée sur
un plan retenu n'est pas le plan retenu. Le logiciel n'interdit pas d'imprimer un
brouillon ; il interdit qu'on le confonde avec le plan définitif. Le filigrane
est un texte au trait, qui laisse lire ce qu'il recouvre.

**La pagination du plan n'est pas une affaire de feuille de style.** Un navigateur
ne sait pas fragmenter **un** élément SVG en pages contiguës : une règle de saut
de page porte sur des boîtes, pas sur l'intérieur d'un dessin. Le logiciel
produit donc, pour l'impression, **autant d'éléments SVG que de pages**, chacun
portant son propre `viewBox` sur sa tuile et son cartouche de repérage, et la
feuille de style en place un par page. **La découpe du plan en pages est une
fonction pure** — elle rend N cadrages contigus et leurs cartouches — éprouvée
sous `node` : c'est du code qu'il faut éprouver, pas une règle de style. Le
logiciel calcule l'échelle qui ferait tenir le plan sur une page ; si la taille
de caractère tombe sous le seuil **mesuré** de lisibilité — le corps minimal
d'impression, relevé au niveau manuel sur l'imprimante visée (§ 19.10) —, il
découpe en tuiles contiguës, chacune sous son cartouche : sa page, sa colonne et
sa rangée, ses voisines. Le choix reste offert — tenir sur une page, ou découper
— et le découpage selon le seuil est proposé par défaut. Le plan s'imprime dans
l'orientation qui donne le moins de pages ; à pages égales, à la plus grande
échelle ; à échelle égale aussi, en paysage.

**Le plan s'imprime aussi une colonne de tables par page.** L'aperçu du plan
offre « Une colonne par page », éteinte par défaut. Une colonne de tables réunit
les tables que relie leur étendue horizontale, celle de l'emprise et, listes
imprimées, du bloc de noms : deux tables dont les étendues se recouvrent sont de
la même colonne, de proche en proche, et une colonne ne se coupe jamais entre
deux tables qu'un bloc de noms relie. Chaque colonne se découpe seule, selon le
choix du découpage, et ses pages ne dessinent que ses tables. Toutes les pages
partagent une orientation, celle que l'imprimante reçoit, et une échelle, la
plus petite de celles des colonnes prises seules : une table a la même taille
sur chaque page, et chaque colonne tient dans ses pages. Les pages se suivent
colonne par colonne, de gauche à droite ; le cartouche compte les colonnes de
pages sur tout le plan, et une page voisine à gauche ou à droite, au bord d'une
colonne, est la page de la même rangée dans la colonne voisine. L'orientation
est celle qui donne le moins de pages en tout ; à pages égales, la plus grande
échelle ; à échelle égale aussi, le paysage.

**Les listes imprimées portent l'organisation comme l'écran** (§ 7.4) : à
l'ouverture, l'aperçu reprend la bascule de l'écran, puis la sienne,
« Organisation », la change pour le papier seul ; listes masquées, elle reste
offerte, inactive. Une organisation repliée sous le nom allonge le bloc sur le
papier comme à l'écran : la hauteur de chaque bloc, qui entre dans l'emprise du
plan imprimé, dans ses colonnes de tables et dans sa découpe en pages, compte
ces lignes, mesurées sur la police rendue comme celles de l'écran. Un bloc ne
déborde ainsi d'aucune page ; découpé, il passe d'une page à sa voisine comme
le reste du dessin. La découpe ne déplace aucune table : un bloc qui couvre à
l'écran la liste du dessous la couvre aussi sur le papier (§ 7.4).

**Le plan imprimé est le dessin de l'écran** : chaque table y porte son numéro au
centre du plateau et sa pastille sur son bord, aux mêmes places et aux mêmes
corps (§ 7.5, § 7.7). Le numéro n'étant jamais plus petit que les listes, le
corps des listes reste le plus petit texte du dessin, et c'est lui que le seuil
de lisibilité compare.

**La mention « disposition relative » et l'échelle graphique du § 7.7 restent sur
chaque page imprimée du plan.** Elles y gagnent même leur pleine utilité : c'est
désormais le réglage d'échelle du navigateur, et non le logiciel, qui peut changer
le facteur sans prévenir.

**Une vue d'aperçu d'impression** applique au document vivant la feuille de style
d'impression réelle. Ce n'est pas une seconde mise en page : c'est la même,
regardée avant d'être envoyée à l'imprimante — là où l'aperçu d'une mise en page
PDF en serait une seconde, avec le défaut que les deux dérivent et que les tests
des deux restent verts. C'est cette vue que le guide photographie (§ 19.6).

**La hauteur de ce qu'une feuille porte hors de sa zone de contenu se mesure
sur le rendu** — le pied et, sur le plan, ses mentions, son échelle graphique
et son cartouche —, à chaque ouverture de l'aperçu. La zone de contenu prend
le reste de la page, marges et hauteur mesurée ôtées, et la découpe du plan
reçoit cette même hauteur mesurée, qu'elle ôte de chaque orientation qu'elle
essaie. Le registre n'écrit aucune valeur de la hauteur mesurée (§ 14.1) :
elle suit la police et le rendu.

**Fiches participants : la sortie imprimée est supprimée.** Son contenu — nom,
organisation, titre, table et siège par tour — est exactement celui du badge.
Deux sorties pour la même information divergent ; celle qui tient autour du cou
gagne. **La fiche à l'écran demeure** : sa rubrique « Rencontres » est le chemin
d'accès garanti à la ligne d'une seule personne quand la matrice n'est pas
dessinée (§ 12.5), et le § 7.4 la range parmi les documents qui ne tronquent
jamais.

### 11.8 Ce que le logiciel refuse encore

- **Produire une planche depuis un plan qui a dérivé.** Si les participants ou le
  mobilier ont changé depuis que le placement a été retenu, le logiciel signale la
  dérive (§ 9) et nomme ce qui a changé **avant** de produire. L'horodatage du
  badge le dirait aussi, mais après la coupe.
- **Produire une planche partielle en silence.** Rééditer le badge de trois
  retardataires est une commande nommée, qui produit une planche de trois badges
  et l'annonce comme telle sur sa feuille de contrôle. Tant que ni le placement
  ni le logo de la personne n'ont bougé, le badge réédité est **identique** à
  celui de la première planche — c'est ce qu'on attend d'un badge perdu ; si le
  placement a bougé, l'horodatage diffère, et c'est ce qu'on attend d'un badge
  refait. Un logo changé change le badge sans faire dériver le placement : il
  ne garde pas la planche. Une case de ce que le badge imprime (§ 11.4), ou
  celle des doublons pour une personne numérotée, changée sur le poste le
  change de même.

---

## 12. La page de qualité

La page de qualité est la section « Qualité » de l'événement, dans la phase
Placer, après Propositions (§ 2.1). Elle **ne modifie rien** : elle vit en
lecture, en écriture et sur un plan bloqué, et reste ouverte pendant une
génération (§ 5.10).

**Elle mesure le placement que le plan montre** — le retenu, ou la proposition
montrée —, comme l'aperçu d'impression (§ 11.7), et une ligne de source le
nomme : « Placement retenu », « Proposition n° 4 » ; sans placement à mesurer,
elle n'en nomme aucun et dit que le plan ne montre que les réservations, qui ne
se mesurent pas. Le menu « Actions » de chaque ligne du tableau des propositions
offre la commande « Qualité », qui montre la proposition au plan et ouvre la
page. Celui d'une proposition comparable offre aussi « Comparer », qui ouvre la
page à sa vue de comparaison (§ 12.10.6) : la proposition de la ligne y devient
le **second placement**, mesuré contre la source ; quand le plan ne montre rien, ou montre
déjà cette proposition ou le retenu non ajusté qui lui est identique, celle-ci
devient la source, montrée au plan, et le second placement prend son défaut.
Le menu du retenu l'offre aussi, aux mêmes règles. « Comparer » n'est offert
que quand la vue aurait un second placement, c'est-à-dire quand deux placements
mesurables et distincts existent. Le second placement ne vit que dans cette
vue : il ne change ni la source, ni le plan, ni les autres vues. Sans source
mesurable, la page ne dessine aucune vue, et quatre cas se partagent sans se
recouvrir :

- **ni proposition ni retenu** — « aucun placement » (§ 12.6) : le diagnostic
  préalable et sa phrase ;
- **des propositions, aucune montrée** : une phrase et la commande qui montre la
  première proposition comparable du classement ; sans proposition comparable,
  la phrase seule ;
- **la source est en dérive ou fautive** (§ 9) : ses raisons, comme au tableau
  des propositions ;
- **la configuration ne se normalise pas** : la phrase du refus de la
  génération, qui l'emporte sur les trois autres.

Quand la source disparaît — une génération qui remplace la proposition montrée,
un retour à un instant de l'historique, une exclusion qui la fait dériver —, la
page suit le plan, qui revient au retenu ou aux réservations, et la ligne de
source le dit. Le second placement qui disparaît — effacé, retiré par un retour,
en dérive, devenu la source — cède la place au défaut de la vue, qui nomme
toujours les deux placements qu'elle compare, ou, sans candidat, à sa phrase
(§ 12.6).

**Les vues, dans leur ordre à l'écran.** Une liste en tête de page les nomme et
mène à chacune.

| vue | question (§ 12.1) | forme | jumeau tabulaire |
|---|---|---|---|
| en-tête chiffré (§ 12.2) | les deux | une rangée de tuiles | les tuiles sont du texte |
| profil trié (§ 12.3) | qui est le plus mal servi, de combien, et combien sont-ils ? | deux graphiques au même ordre de rangs : l'escalier en comptes, deux séries, le plafond réalisé et la borne de diversité en repères ; dessous, les rencontres en pourcentage du plafond réalisé | une ligne par personne dans l'ordre du profil, comptes et pourcentage, et la répartition des rencontres |
| comparaison (§ 12.10.6) | laquelle des deux sert mieux, et qui y perd ? | un tracé, le manque des deux placements en escaliers superposés sur un axe commun, en comptes ; au-dessus, leurs chiffres en deux colonnes côte à côte, chacun en compte, ou en pourcentage suivi du compte du pire là où sa tuile en porte un | l'escalier du manque : une ligne par valeur de manque, et par placement l'effectif et l'effectif cumulé, en comptes |
| collisions d'organisation (§ 12.4) | d'où vient le problème, et relancer peut-il y changer quelque chose ? | barres horizontales à deux segments | une ligne par organisation |
| organisations à chaque table (§ 12.11) | où les mêmes cercles se retrouvent-ils à une même table ? | un sélecteur à trois positions, puis la grille tables × tours, chaque case le compte de la position, échelle d'une teinte | une ligne par table et par tour, les trois comptes et leurs pourcentages |
| paires répétées (§ 12.5) | qui revoit trop souvent la même personne ? | tableau paginé ; matrice sous le seuil | le tableau est la vue ; la matrice a le sien |
| inclusions (§ 12.15) | quelles rencontres demandées par les inclusions ce placement ne fait-il pas ? | une phrase de synthèse, puis trois listes : les inclusions non satisfaites, les listes au-delà du plafond, les inclusions hors d'atteinte | les listes sont la vue |
| objectifs des tables (§ 12.12) | qui n'est jamais assis à une table qui lui correspond, et à quel tour l'objectif perd-il ? | la soirée en texte, puis des barres horizontales par tour, à deux segments, chacune avec ses assis sans table possible ; dessous, chaque tour avec son pourcentage et ses deux comptes | une ligne par tour, et la liste des personnes jamais servies |
| animateurs rencontrés (§ 12.13) | qui a rencontré le moins d'animateurs ? | escalier, une série, la borne des animateurs en repère | une ligne par personne concernée, et la répartition |
| diversité par animateur (§ 12.13) | quel animateur voit le moins de diversité à sa table ? | deux colonnes de barres horizontales juxtaposées, organisations et étiquettes, chacune son axe, sur la soirée | une ligne par animateur sur la soirée, puis une par animateur et tour animé |
| performance du calcul (§ 12.14) | relancer plus longtemps aurait-il donné mieux ? | petits multiples, un indicateur par graphique, points aux seuls points de relevé, abscisse logarithmique | une ligne par point de relevé, une colonne par indicateur |

Une vue sans objet — aucune inclusion active, aucune personne concernée par les
objectifs, aucun animateur, aucune course connue — cède la place à sa phrase
(§ 12.6), jamais à des axes vides. La vue de comparaison n'y fait pas
exception : sans second placement — un seul placement mesurable —, elle garde
son entrée dans la liste des vues et cède la place à sa phrase, « un seul
placement mesurable : rien à comparer ».

**Un pourcentage de la page est toujours suivi, juste dessous, du pire cas en
compte** : « 88 % », puis « minimum 24 sur 27 » ; « 77 % des tours possibles
servis », puis « 3 personnes jamais servies ». Le pire cas d'une tuile, d'une
colonne de la vue de comparaison (§ 12.10.6), d'une phrase de synthèse ou de la
soirée est celui de sa population. **Le pourcentage d'une ligne** — une ligne de
jumeau, une infobulle — est suivi du **compte de cette ligne**, son numérateur
sur son dénominateur, une ligne n'ayant qu'un cas : « 24 sur 27 », « 5
organisations pour 8 sièges », « 24 servis sur 30 possibles ». Les graduations
d'un axe en pourcentages et le libellé « 100 % » de sa règle sont des repères,
non le pourcentage d'une mesure, et n'ont pas de compte. Les rapports admis sont
ceux du § 5.4, et d'eux seuls (§ 12.8). Les pourcentages s'écrivent sur cette
page seulement : le tableau des propositions garde ses comptes (§ 5.7).

### 12.1 Les deux questions

L'opérateur n'ouvre pas cette page pour connaître une variance :

1. **Ce placement est-il bon ?** — reste-t-il à gagner en relançant ?
2. **Qui s'y trouve mal servi ?** — car la plainte ne vient pas de la moyenne,
   elle vient d'une personne.

Le logiciel n'affiche **aucune forme qui ne réponde à l'une des deux**, et
chaque vue porte en toutes lettres la question qu'elle traite — **la vue de
comparaison du § 12.10.6 comprise** : *laquelle des deux sert mieux, et qui y
perd ?*

Les vues des mélanges — organisations à chaque table, objectifs des tables,
animateurs — et celle de la performance écrivent la leur (§ 12) : chacune
précise l'une des deux, sur une table, un tour, un animateur ou un compte de
mouvements.

**Le minimum gouverne la page** : chaque vue place le cas le plus défavorable à
une position **fixe et prévisible** — le premier point, la première ligne —
jamais là où il faut le chercher. La moyenne des rencontres ne s'affiche pas : à
tables pleines, elle est la même pour toutes les propositions (§ 12.8). Un
placement où chacun rencontre 27 personnes sauf une qui en rencontre 14 a une
excellente moyenne et un problème.

### 12.2 L'en-tête chiffré

Les indicateurs du § 5.4 en une rangée de tuiles, chacun avec **sa borne, et
son plancher quand le diagnostic le prouve**, lus au détail du placement
(§ 12.9), et la mention de la population mesurée. **Une tuile par colonne de
mesure du tableau des propositions** (§ 5.7), dans son ordre et sous ses
groupes. Une tuile qui a sa colonne en lit la valeur, le libellé et
l'explication (§ 12.9) ; une tuile sans colonne — critère décoché, valeur que le
mode réglé ne compare pas — lit la même mesure de la ligne d'évaluation sous son
propre libellé, et dit qu'elle ne classe pas.
**Trois tuiles portent les questions de tête** — le minimum brut ouvre la
rangée, le manque maximal et l'écart d'itinéraire maximal se lisent dans le
groupe du manque, à la place de leurs colonnes :

| tuile | la question qu'elle pose |
|---|---|
| **minimum brut** | combien de personnes rencontre la plus mal servie ? |
| **manque maximal** (§ 12.10.4) | de combien la plus privée est-elle privée, compte tenu de là où ce placement l'a assise ? |
| **écart d'itinéraire maximal** (§ 12.10.4) | cette proposition a-t-elle perdu avant même de s'asseoir ? |

Le chiffre de tête est une **mesure avec son unité et son plafond**, jamais un
score composite.

**Chaque borne d'une tuile est celle d'une personne nommée.** Les tuiles suivent
l'ordre des colonnes, chacune avec sa population. Le minimum brut porte le
**plafond réalisé et le plafond a priori de la personne au rang 1 du profil**
(§ 12.3), qu'elle nomme ; ses deux lignes secondaires, les mobiles et les ancrés
(§ 5.4), le suivent, chacune sa tuile. Le minimum se lit sur la population
entière : la personne qui en a le moins est souvent une présence partielle, et
l'infobulle de la tuile le dit alors — « Prénom Nom, au rang 1, est présente aux
tours 1 et 2. ». Puis, quand le conflit d'organisation a un objet, les conflits
d'organisation ; puis, quand une inclusion est active, les inclusions non
satisfaites, sans plancher ; puis les collisions cumulées, les paires distinctes
et l'excédent ; les rencontres répétées choisies, les imposées énoncées à part ;
le plus grand nombre de rencontres d'une paire ; les retours choisis, les
imposés à part ; le minimum de A(p), avec la borne de diversité de la personne
au rang 1 du même tri sur A(p) (§ 5.5) — une phrase dit à sa place qu'aucune
personne présente ne porte d'organisation — ; la somme de redondance ; le
minimum du taux de diversité d(p), au centième, comme au tableau des
propositions. Puis le manque maximal, avec l'effectif au manque maximal — les
personnes dont le manque l'égale, que la tuile tait quand il vaut 0, personne
n'y manquant de rien — et le **plafond réalisé de la personne au rang 1 du
profil de manque** (§ 12.10.6) ; l'effectif du manque, les personnes à qui il en
manque au moins une rencontre ; l'écart d'itinéraire maximal et l'écart au
plafond a priori, « inconnu » quand le plafond a priori l'est (§ 12.6). Quand
une personne est concernée, les personnes jamais servies, le plus de tours hors
objectif d'une personne et les tours hors objectif, puis le minimum de s(p) avec
les tours possibles de la personne à ce minimum ; quand une personne est
concernée par les animateurs, le minimum de m(p) avec la borne des animateurs de
la personne à ce minimum, et les animateurs non rencontrés. La mention « minimum
atteint », ou « atteignabilité inconnue », suit les tuiles (§ 5.5).

**Les lignes secondaires des autres agrégats ne font pas de tuile.** Le minimum
brut a les siennes en tuiles parce que le tableau des propositions les porte en
colonnes ; la tuile du minimum de A(p), celle du minimum de d(p), celles des
trois chiffres du manque (§ 12.10.4) et celles des minimums de s(p) et de m(p)
écrivent les leurs dans la tuile, sous les lignes de sa borne et avant son
plancher, sur une ligne : « mobiles 3 · ancrés 2 » (§ 5.4). La règle d'une tuile
par colonne tient donc partout. Le minimum de s(p) et celui de m(p) les écrivent
ici bien que le tableau les taise (§ 5.7).

**Une tuile écrit le plancher que le diagnostic écrit pour sa mesure** (§ 5.6),
et là seulement, en dernière ligne, sous son chiffre : « plancher 4 », ou
« plancher 4, le meilleur atteint » quand la mesure que la tuile écrit l'égale.
Ces deux lignes ne parlent que de cette mesure, jamais du placement entier, et
ne nomment personne. Huit tuiles peuvent en porter un : les conflits
d'organisation, ceux que les réservations imposent (§ 5.6), quand le critère a
un objet ; les collisions cumulées, les paires distinctes et l'excédent, chacun
la somme des planchers de ses organisations en collision ; l'écart d'itinéraire maximal, aucun quand le
plafond a priori est inconnu ou qu'une personne est absente à un tour (§ 5.6),
sa tuile écrivant alors, sous son chiffre, « Plancher non prouvé : une personne
au moins est absente à un tour. » ; les personnes jamais servies, le plus de
tours hors objectif d'une personne et les tours hors objectif, chacun seulement
quand le critère des objectifs est coché et que le mode réglé compare sa valeur,
comme au diagnostic : une tuile des objectifs qui ne classe pas n'en porte
aucun. Un plancher nul ne s'écrit jamais, pas plus qu'un 0 à sa place, et aucune
tuile n'en porte sur un plan hors du domaine des planchers (§ 12.4). Le détail
du placement en porte d'autres, qui se lisent dans leur propre vue : ceux des
collisions par organisation (§ 12.4), ceux des objectifs par tour (§ 12.12), que
cette vue dessine même quand le critère ne classe pas.

**Trois tuiles portent un pourcentage** (§ 5.4), écrit sous leur valeur et
suivi, juste dessous, du compte du pire : le minimum brut, le pourcentage de son
plafond réalisé qu'atteint la personne au rang 1 du profil, puis « minimum 24
sur 27 » ; les tours hors objectif, le pourcentage des tours possibles servis
sur la soirée, puis « 3 personnes jamais servies » ; le minimum de s(p), le
pourcentage de ses tours possibles que sert la personne à ce minimum, puis
« minimum 1 sur 4 ». Le pourcentage d'une tuile est celui de la personne que sa
borne nomme, ou de la soirée pour les objectifs, jamais une moyenne de la
population. Les autres tuiles n'en portent pas : leur grandeur n'a pas de
dénominateur admis — une collision, une paire, une redondance —, ou n'a qu'une
borne (§ 5.5), qui ne prouve rien ; le taux de diversité garde sa forme au
centième.

Les bornes, les planchers et les pourcentages qui accompagnent les tuiles
viennent du détail du placement (§ 12.9), qui les rend une fois et dit lui-même
quel plancher est atteint, sur la valeur même que la ligne d'évaluation porte :
l'en-tête ne compare rien. Un critère sans objet n'a pas de tuile.

### 12.3 Première vue — le profil trié

**Question : qui est le plus mal servi, de combien, et combien sont-ils ?**

Une **courbe en escalier**. En abscisse les participants **triés du moins bien
au mieux servi** — c'est un rang, et l'axe le dit. Deux séries sur **un seul axe
vertical** : personnes distinctes rencontrées, et organisations distinctes
rencontrées.

> Un seul axe, parce que le nombre d'organisations rencontrées **ne peut pas
> dépasser** le nombre de personnes rencontrées : la seconde courbe est partout
> sous la première, et **l'écart se lit directement** comme la redondance des
> cercles fréquentés. Deux axes détruiraient cette propriété et fabriqueraient,
> par le seul choix d'alignement, une corrélation absente des données.

**Un seul tri, celui de la première série**, vaut pour les deux : une abscisse
désigne toujours le même participant. La seconde courbe est donc irrégulière, et
cette irrégularité est de l'information.

**Les égalités se départagent par une clé stable** : à rencontres égales, le
plafond réalisé le plus haut d'abord — son manque est le plus grand —, puis
l'identifiant croissant. Sans clé stable, deux ouvertures du même placement
donnent deux dessins.

**Le plafond réalisé se trace dans le même ordre** : règle horizontale quand il
est constant, **ligne en escalier** dès qu'une table est incomplète. Une règle
unique mentirait.

Le plafond tracé est un **repère, pas une série** (§ 12.7) : encre neutre, trait
mince et mixte — tiret-point —, son nom posé sur le tracé ; son motif n'est ni
le plein de la première série ni les tirets de la seconde. **La borne de
diversité se trace aussi, dans le même ordre, en repère pointillé** sous son
nom : elle borne la seconde série comme le plafond borne la première, et son
trait ne se confond ni avec les tirets de la seconde série ni avec le plafond.
Le graphique porte ainsi deux séries et deux repères, sur un seul axe, en
comptes de personnes.

**Sous lui, un second graphique dit la même chose en pourcentages** : les
rencontres de chacun en pourcentage de son plafond réalisé (§ 5.4), une seule
série, une règle à 100 % en repère — l'image du plafond réalisé, de son motif
mixte, libellée « 100 % » —, **dans le même ordre de rangs**, les abscisses des
deux graphiques alignées. Le pourcentage n'y est pas une clé de tri : trier sur
lui serait trier sur le manque relatif, que le § 12.10.3 refuse. Un rang dont le
plafond réalisé est nul n'y a pas de point, et le tracé s'interrompt. Les
organisations rencontrées n'y ont pas de série : leur seule borne est la borne
de diversité, dont aucun pourcentage ne se prend. Deux graphiques, jamais deux
axes sur un même graphique (§ 12.7). Sa phrase de synthèse porte le pire cas en
compte : « minimum 24 sur 27 ».

**Le logiciel vérifie les trois inégalités de la ligne de décomposition du
§ 12.10.5** — `N − 1 ≥ plafond a priori ≥ plafond réalisé ≥ rencontres`. La
garde est une fonction du moteur, `verifier_indicateurs(mesures,
plafonds_a_priori, plafonds_realises, complements)` (§ 14.12), dont le quatrième
paramètre est facultatif : avec une seule famille de plafonds, l'inégalité
`a priori ≥ réalisé` — la seule que la bascule vers l'occupation rend non
triviale — ne serait éprouvée nulle part. Si une inégalité tombe, le calcul est
faux : la page **refuse de dessiner** et le dit, plutôt que d'afficher un
graphique impossible que personne ne regardera d'assez près.

La page lui passe en complément les planchers des collisions cumulées par
organisation, les planchers des objectifs par tour (§ 12.12), les conflits
imposés par les réservations (§ 5.6), la validité de ces planchers pour le plan
(§ 12.4) et les bornes de diversité : la garde éprouve alors aussi que le
segment « reste » n'est jamais négatif, ni pour une organisation ni pour un
tour, que les conflits d'organisation du plan ne tombent pas sous les conflits
imposés, et que A(p) ne dépasse ni les rencontres de p, ni |F(p)|, ni sa borne
de diversité, |F(p)| ne dépassant pas Φ_aff(p) (§ 5.5).
La propriété A(p) ≤ rencontres(p) fonde l'axe unique de cette vue ; elle n'est
vraie que par construction tant qu'aucune garde ne l'éprouve. Le refus vaut pour
la page entière, et nomme la mesure et les personnes en cause.

**Les places contraintes sont marquées.** Sans cela, l'opérateur attribue au
générateur un minimum que sa propre réservation impose.

Un point marqué porte un signe de forme, non une couleur : ancré ou
partiellement fixé, en réserve à un tour au moins, absente à un tour au moins
— un losange creux —, plafond réalisé nul ; une personne qui relève de deux
marques porte la première dans cet ordre. Une absence n'est pas une réserve :
les tours en réserve se comptent parmi les tours de présence, et le profil
gagne une colonne « Absences » — « absente à 2 tours » — quand une personne
manque un tour, « — » pour qui vient à chaque tour. Les
autres rangs ne portent aucune marque : un escalier est un tracé, non 260
points.

**Le pointage au plus proche** (§ 12.7) désigne le rang sous le pointeur ; son
infobulle porte la ligne entière — le rang, le nom entier, l'organisation, les
rencontres, le plafond réalisé, leur pourcentage suivi de leur compte (§ 12), le
plafond a priori, A(p), la borne de diversité, les tours en réserve, et les
tours d'absence quand la personne en a ; le rang
pointé est le même dans les deux graphiques. **Le jumeau tabulaire** porte une
ligne par personne dans l'ordre du profil, avec les mêmes colonnes, et **la
répartition des rencontres** : une ligne par valeur, de la plus basse à la plus
haute, avec l'effectif, l'effectif cumulé et le nombre de personnes à leur
plafond réalisé. C'est le mélange des rencontres par personne, dont le second
graphique donne la part. La phrase de synthèse, visible sous le premier
graphique, en donne l'essentiel : le minimum, l'effectif au minimum et
l'effectif sous son plafond réalisé.

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

**Cette vue est inchangée pour UNE proposition** : le nombre de rencontres s'y
lit en absolu, l'escalier du plafond est tracé à côté, et l'opérateur lit
l'écart à l'œil. **Dès deux placements, la comparaison change de quantité**,
dans sa vue à elle (§ 12.10.6), le profil restant celui de la source : elle
trace le **manque**, et non les nombres bruts, pour la raison exposée au
§ 12.10.1. **Quand les courbes se croisent, l'arbitrage est réel** — l'un sert
mieux les plus mal lotis, l'autre la masse — et le graphique le montre au lieu
de le trancher. En comparaison, l'abscisse change de sens et **la page
l'écrit** : le rang 1 de l'une et de l'autre ne désignent pas la même personne.

### 12.4 Deuxième vue — les collisions d'organisation

**Question : d'où vient le problème, et relancer peut-il y changer quelque
chose ?**

Des barres **horizontales**, une par organisation, la pire en haut, chacune
empilée en **deux segments** : **prouvé inévitable** (le plancher du diagnostic)
et **reste**. Chaque ligne porte l'effectif du groupe.

**La barre est dessinée en collisions cumulées** — des occurrences
(paire, tour) —, parce que c'est l'unité dans laquelle le plancher se démontre.
Empiler deux unités dans une même barre produit un segment « reste » négatif : un
plan qui garde les deux mêmes collègues ensemble aux quatre tours mesure **1**
paire distincte contre un plancher de **4**, la garde du § 12.3 refuse alors de
dessiner, et elle a raison — l'arithmétique est fausse, non dans le code mais
dans la spécification.

**Chaque ligne porte en encre secondaire ses trois autres chiffres** : l'effectif
du groupe, les **paires distinctes**, et l'**excédent** (§ 5.4). Les deux derniers
sont ce qui distingue un conflit réparti d'un conflit concentré, et c'est
l'excédent qui ordonne les propositions (§ 5.7) : une vue qui ne montrerait que
le volume ferait conclure que le plan le mieux classé est le plus mauvais.

**Les lignes se trient sur l'excédent, pas sur la longueur de la barre.** La pire
organisation est celle qui remet le plus souvent les mêmes personnes ensemble,
non celle qui porte le plus d'occurrences — c'est le même arbitrage qu'au § 5.7,
et deux tris opposés dans une même page se contredisent devant l'opérateur.

À excédent égal, les collisions cumulées décroissantes, puis la clé normalisée
de l'organisation (§ 10.1), puis sa chaîne.

**« Prouvé inévitable » est le plancher des collisions cumulées du diagnostic**
(§ 5.6) pour cette organisation, zéro quand le diagnostic n'en écrit pas. **Ce
plancher vaut sur un plan qui assoit chaque personne présente à chacun de ses
tours de présence et honore les réservations** : c'est le domaine où il se
démontre. Une absence n'en sort pas le plan, le plancher se calculant sur les
présents de chaque tour (§ 5.6) ; une personne présente laissée en réserve, une
arrivée qu'un tour figé n'a pu asseoir comprise (§ 5.7), l'en sort. Un placement
ajusté qui laisse quelqu'un en réserve peut mesurer moins ; ses barres n'ont
alors qu'un segment, les collisions cumulées, et la vue écrit pourquoi le
plancher ne s'y applique pas. La garde n'éprouve le segment « reste » que sur le
domaine.

L'intitulé de chaque ligne porte la **pastille de l'organisation** (§ 12.7) :
c'est une liste. Les segments ne portent ni teinte d'organisation ni teinte de
conflit : « prouvé inévitable » et « reste » ont chacun leur jeton de graphique,
leur forme et leur libellé, posé sur la première barre où leur segment est non
nul et repris par la légende. Les barres partent de zéro, sur un axe commun à
toutes les lignes de la vue.

**« Prouvé inévitable » se trace en contour** — un trait de 2 px de son jeton,
tenu dans la boîte du segment —, « reste » en aplat : les deux se séparent par
la forme comme par la couleur, à toute largeur, et le prouvé ne retombe jamais
en aplat. Un segment prouvé n'est donc jamais plus étroit que ses deux traits
et leur vide, 6 px : ce qui lui manque se prend sur les autres segments de la
ligne, ceux qui le suivent d'abord, puis ceux qui le précèdent, chacun jusqu'à
zéro. La barre finit ainsi au plus loin à sa valeur ou, pour une ligne plus
étroite que ces 6 px de son premier segment à sa valeur, à 6 px de son début.
L'infobulle et le jumeau nomment la part prouvée, « Prouvé
inévitable », et en portent la valeur, quelle que soit sa largeur.

**Le second segment ne s'appelle pas « évitable ».** Le plancher se calcule en
relâchant les contraintes : c'est une **borne inférieure**, jamais un fait.
Nommer « évitable » le complément affirmerait qu'un meilleur placement le
retire, et condamnerait l'opérateur à relancer indéfiniment sur un conflit
qu'aucun placement ne retire. Le mot garde son sens dans les remèdes du
diagnostic (§ 5.6), et là seulement : une table de plus, ou une organisation
répartie autrement, « la rend évitable » parce qu'elle change la
**configuration** — jamais parce qu'une relance ferait mieux.

**Les participants sans organisation ne forment pas un groupe** : sinon un
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
décroissant — les deux noms, leurs organisations, le nombre de fois, les tours.
Une ligne n'est pas cliquable : **sa première commande mène au plan au premier
tour où la paire se revoit**, la première des deux personnes mise en évidence,
et chacun de ses tours est une commande sœur vers le plan à ce tour ; chacune
amène la chaise de la première personne au centre du plan (§ 7.1). Les
**paires choisies** viennent d'abord, triées par nombre de fois décroissant,
puis par les identifiants ; les **paires que les réservations imposent** —
chacune de leurs rencontres a lieu à une table où les deux sont réservées ce
tour-là — suivent sous leur intitulé, triées de même : le § 5.4 les énonce à
part. Le tableau **se pagine comme celui des propositions**, par pages de
cent (§ 5.7), l'étendue et le total écrits.

**Deux exceptions** : la matrice se dessine sous un seuil de participants
**mesuré sur le rendu réel**, `SEUIL_MATRICE_PARTICIPANTS` (§ 19.10), et la
**ligne d'une seule personne** reste toujours accessible par la rubrique
« Rencontres » de sa **fiche à l'écran** — les personnes qu'elle a rencontrées
dans le placement que le plan montre, avec le nombre de fois et les tours, les
plus revues d'abord, sous la ligne de source de la page de qualité ; quand la
source ne se mesure pas ou que la personne est exclue, une phrase le dit ; sans
placement, la rubrique est absente —, chemin garanti vers une personne quand la
matrice n'est pas dessinée, et c'est pourquoi la fiche écran demeure alors que
sa version imprimée est supprimée (§ 11.7). Juste avant elle, les rubriques
« Conflits du placement » et « Inclusions du placement » lisent le même
placement, sous la même ligne de source (§ 10.2).

La matrice se dessine sous ce seuil **et** quand ses cases tiennent la cible de
24 px dans la largeur réelle de la carte, que la géométrie éprouve ; sinon, la
vue écrit qu'elle ne dessine pas la matrice et pourquoi, et renvoie à la fiche.
Elle range les personnes par l'ordre du profil (§ 12.3), jamais par l'alphabet.
Une case porte le nombre de rencontres de la paire, écrit, sur l'échelle
séquentielle à **quatre niveaux** — 0, 1, 2, 3 et plus — : les trois valeurs
décisionnelles et ce qui les dépasse. La diagonale est vide et neutre. Une case
n'est pas une cible : son jumeau, le même tableau en texte, et la fiche portent
les mêmes comptes.

> **Les paires répétées ne sont pas garanties sur la grande démonstration.** À
> 260 personnes, 33 tables et 4 tours, chacun occupe au plus 28 créneaux de
> voisinage sur 259 autres : rien n'oblige une paire à se répéter, et une épreuve
> qui affirmerait un tableau non vide pourrait échouer sans qu'aucun défaut
> n'existe. Le tableau se photographie donc (§ 19.3) sur une configuration
> **construite** où le dénombrement le force — 12 personnes, 4 tables de 3,
> 6 tours : 12 créneaux de voisinage pour 11 autres personnes, donc au moins une
> répétition pour chacun, quel que soit l'algorithme.

### 12.6 Les cas limites

Une page de statistiques se casse par ses bords, et chacun se produira.

| cas | ce que la page affiche |
|---|---|
| participants exclus | retirés de toutes les statistiques, effectifs mesuré et exclu annoncés |
| personne absente à un tour | gardée, point marqué d'un losange creux ; ses mesures, son plafond a priori et son plafond réalisé portent sur ses tours de présence ; l'infobulle et le jumeau disent à combien de tours elle est absente |
| une personne absente à un tour dans la configuration | les planchers des collisions et des objectifs restent ; l'écart d'itinéraire maximal n'en porte aucun, sa tuile le dit, et le diagnostic dit que sa preuve suppose chacun présent à chaque tour |
| personne en réserve à un tour | gardée, point marqué, avec le nombre de tours non assis ; son plafond réalisé se calcule sur les seuls tours où elle est assise, **et son écart d'itinéraire porte ce que son manque ne porte pas** |
| aucun placement — ni proposition ni retenu | le diagnostic préalable et une phrase, **jamais des axes vides** |
| une seule table | le profil, les collisions, les organisations à chaque table et les paires cèdent la place à une phrase : elles diraient la même chose ; les objectifs, les animateurs et la performance restent |
| un seul tour | le tableau des paires est remplacé par une phrase, non par un tableau vide |
| une seule organisation | le profil n'a qu'une série et pas de borne de diversité, et la phrase le dit ; les collisions et les organisations à chaque table restent : les doublons disent où le groupe se retrouve |
| aucune organisation | le profil n'a qu'une série et pas de borne de diversité ; les collisions et les organisations à chaque table cèdent la place à une phrase ; **jamais** une seconde courbe plate à zéro, qui se lit comme une panne |
| aucune collision | la vue des collisions cède la place à sa phrase ; la grille des tables aussi sous la position « doublons » du sélecteur, dont toutes les cases vaudraient zéro ; sous « sièges » et « assis », la grille reste, ses comptes ne dépendant pas des collisions |
| noms longs | tronqués à une largeur **mesurée**, entiers dans l'infobulle et le tableau |
| homonymes | distingués par leur organisation ; la navigation se fait par identifiant |
| les deux profils de manque réunis prennent moins de valeurs distinctes que le seuil du registre (§ 19.10) — le cas courant d'une soirée détendue, où le manque est nul pour presque tous | ni tracé ni escalier dessiné : une phrase portant, par valeur et par placement, les effectifs, puis les trois effectifs de rangs, puis, quand le rang 1 ne désigne pas la même personne, la phrase qui le dit ; le jumeau reste |
| deux placements au même profil de manque | « indiscernables sur le manque » ; entre deux propositions, la page nomme ce qui les départage au classement — le premier palier appliqué (§ 5.7) où leurs clés diffèrent, ou l'identifiant quand toutes sont égales ; avec le retenu, qui ne se classe pas, l'indiscernabilité seule |
| deux profils qui alternent plusieurs fois | les trois effectifs de rangs, **sans** rang de bascule ; le jumeau tabulaire porte le détail |
| un seul placement mesurable | la vue de comparaison garde son entrée et écrit « un seul placement mesurable : rien à comparer » ; aucune ligne n'offre « Comparer » |
| la ligne d'évaluation de l'un des deux placements porte un refus de dessin (§ 12.10.5) | la vue ne trace rien, et nomme celui des deux dont le calcul est faux ; les deux se jugent sur le même test, celui de leur ligne |
| le second placement disparaît | la vue revient à son défaut et nomme les deux placements qu'elle compare ; sans candidat, elle écrit sa phrase |
| la source est une proposition dérivée | la ligne de source porte « dérivée de n° X », et la performance dit que la course part du plan de son départ (§ 12.14) |
| populations mesurées différentes entre deux placements | ne survient pas entre deux placements comparables d'un même état, qui mesurent la population de la configuration courante, la dérive les écartant avant toute mesure (§ 9) ; la garde reste : si elle tombe, ni courbe ni dominance, la page nomme les personnes mesurées d'un seul côté et dit **non comparable** |
| le plafond réalisé d'une personne vaut 0 | son manque vaut 0 et n'enseigne rien : la page marque le point et renvoie à l'écart d'itinéraire, que la marque de sa ligne écrit, à l'infobulle et au jumeau — son plafond a priori, ou « inconnu ». Un manque nul n'est jamais lu comme « bien servi » sans son plafond à côté |
| le plafond a priori n'a pas pu être maximisé | l'écart d'itinéraire s'écrit **« inconnu »**, jamais 0, et sans plancher (§ 12.2) ; le certificat reste hors d'atteinte (§ 5.5) et le départage du § 5.7 qui en dépend est sauté, la page nommant le palier suivant |
| des propositions, aucune montrée | une phrase, et la commande qui montre la première proposition comparable du classement ; sans proposition comparable, la phrase seule |
| la source est en dérive ou fautive | ses raisons, comme au tableau des propositions ; aucune vue |
| la configuration ne se normalise pas | la phrase du refus de la génération ; aucune vue |
| la source disparaît | la page suit le plan, qui revient au retenu ou aux réservations ; la ligne de source le dit |
| un plan qui laisse quelqu'un en réserve | collisions et objectifs sans segment « prouvé inévitable », et la phrase qui dit pourquoi (§ 12.4) ; aucune tuile n'écrit de plancher (§ 12.2) |
| un pourcentage de dénominateur nul — plafond réalisé nul, tour sans couple possible, personne sans tour possible, table vide ou sans affilié | « — », jamais 0 % ni 100 % ; le compte reste écrit |
| une table sans affilié à un tour | sa case écrit « — » sous les trois positions du sélecteur, sans couleur, et se range après les tables qui portent un compte |
| aucune inclusion active | la vue des inclusions cède la place à sa phrase, suivie des inclusions hors d'atteinte quand les listes en portent, et le tableau des propositions n'a pas leur colonne |
| aucune personne concernée par les objectifs | la vue des objectifs cède la place à sa phrase |
| un tour sans couple possible | sa ligne écrit « — », sans barre ni pourcentage ; ses assis sans table possible restent écrits |
| aucune personne concernée par les animateurs, ou aucun animateur | les deux vues des animateurs cèdent la place à leur phrase, la diversité par animateur même quand un animateur anime un tour où personne ne peut le rencontrer |
| aucune étiquette portée | la diversité par animateur n'a que la colonne des organisations, et la phrase le dit |
| aucune organisation, ou une seule, mais des étiquettes | la diversité par animateur n'a que la colonne des étiquettes, triée sur E_f |
| ni étiquette, ni plus d'une organisation | la diversité par animateur cède la place à sa phrase ; son jumeau garde les tours animés et les personnes rencontrées en animant |
| une grille tables × tours trop large pour ses cases | le jumeau seul, et la phrase qui le dit |
| la matrice sous le seuil, mais trop étroite pour la largeur de la carte | la phrase de la matrice non dessinée, qui renvoie à la fiche |
| le placement retenu | la performance dit qu'elle mesure une proposition ; un retenu non ajusté nomme la proposition d'où il vient et en montre la course tant qu'elle est dans la liste ; un retenu ajusté, aux participants ou à la main, ou dont la proposition a été effacée, n'en a aucune |
| une proposition rouverte, dont le compagnon des courses garde la course | la performance la montre, ses valeurs mesurées sous les réglages courants ; « durée inconnue », sans cadence (§ 5.10) |
| une proposition dont la course n'est pas gardée — écrite avant le compagnon ou par une version antérieure, compagnon absent, illisible ou contradictoire, proposition effacée puis rendue après une réouverture (§ 8.6) | la performance cède la place à sa phrase : sa course n'est pas gardée |
| une proposition dont la recherche a atteint un n-uplet nul | la performance l'écrit : « rien à reprendre après 3 412 mouvements sur 20 000 » ; à zéro mouvement, « le plan initial n'avait rien à reprendre » |
| une génération de durée nulle ou inconnue | « durée inconnue », sans cadence |

### 12.7 Les règles de forme

- **Jamais deux axes verticaux.**
- **L'identité d'une série ne repose jamais sur la seule couleur** : au plus
  deux séries, **étiquetées directement sur le tracé** en plus de la légende, et
  distinctes aussi par le trait — plein et tirets — ou par la forme du segment.
  Une personne daltonienne, un écran en niveaux de gris et un lecteur d'écran
  lisent la page sans sa couleur. Un plafond ou une borne tracés sont des
  **repères**, non des séries : encre neutre, trait mince, nommés sur le tracé ;
  **un plafond en trait mixte — tiret-point —, une borne en pointillés**, chacun
  sous son jeton. Chaque trait d'un graphique a son motif — plein et tirets pour
  les séries, mixte et pointillé pour les repères — : aucun repère n'a le motif
  d'une série ni de l'autre repère. La règle à 100 % d'un graphique en
  pourcentages est l'image d'un plafond, et prend son motif. **Deux grandeurs
  d'unités différentes se dessinent en deux graphiques**, chacun son seul axe
  vertical, au même ordre quand ils portent les mêmes rangs : le profil en
  comptes, puis en pourcentages (§ 12.3).
- **Les couleurs d'état sont réservées** : **les teintes de conflit** — quatre,
  une par règle que le plan localise (§ 7.5) — ne peignent que le plan de salle,
  et la page de qualité n'en emploie aucune ; chacune ne peint que les marques
  de sa règle. Elles se distinguent entre elles et des autres marques du plan
  **une fois les trois dichromaties simulées**.
- **Le rouge du retrait** (`--couleur-retrait`) ne peint que la croix cerclée
  d'une commande qui retire, sur une carte, jamais sur le plan : c'est le seul
  jeton chromatique admis à moins de 30° d'une teinte de conflit.
- **Les couleurs d'organisation ne vont que sur les listes**, jamais sur le
  plan, dont le canal chromatique appartient aux conflits : au plus six teintes
  catégorielles, chacune à 30° au moins des teintes de conflit dans chaque
  thème, distinctes deux à deux une fois les trois dichromaties simulées et,
  deux teintes voisines, en clarté. Les organisations distinctes de l'événement
  — deux chaînes différentes en font deux, comme pour le moteur — se rangent par
  leur clé normalisée (§ 10.1), comparée point de code par point de code, puis,
  à clé égale, par leur chaîne, et reçoivent les teintes dans cet ordre.
  L'attribution lit toute la liste, exclues comprises : un filtre, un tri ou une
  exclusion ne repeint rien. Au-delà de six, la pastille est neutre. Une
  pastille porte toujours le nom.
- **Une échelle séquentielle est une seule teinte, du clair au foncé.** Jamais
  d'arc-en-ciel : un dégradé multicolore invente des frontières là où la
  grandeur est continue. Ses niveaux sont peu nombreux — quatre, 0, 1, 2, 3 et
  plus, pour la matrice comme pour la grille tables × tours —, en couleurs
  pleines, chaque case bordée d'un trait qui tient 3:1 sur le fond de la carte,
  son compte écrit dans l'une de **deux encres neutres au plus**, chacune
  déclarée pour les niveaux qu'elle sert et mesurée à 4,5:1 sur chacun. **Le
  niveau zéro est le plus proche du fond de la carte dans chaque thème**, et la
  grandeur croît en s'en éloignant : en thème sombre, l'échelle va du sombre au
  clair. Le niveau zéro n'est pas tenu à 3:1 : il ne porte rien que la bordure
  et le chiffre ne portent déjà.
- **Le texte garde une encre neutre** ; la couleur est portée par la marque. Une
  pastille d'état, de statut ou d'organisation est un fond teinté, un signe —
  icône ou point — de la teinte, et un libellé de l'encre de la page.
- **La palette se valide par calcul, jamais à l'œil** : simuler d'abord les trois
  dichromaties, **puis** mesurer l'écart — mesurer sur les couleurs d'origine ne
  dit rien de ce que voit une personne daltonienne. **4,5:1** pour le texte,
  **3:1** pour les marques porteuses d'information.
- **Chaque graphique a son jumeau tabulaire** : un survol n'est jamais le seul
  chemin vers une valeur, et un tableau se parcourt au clavier et au lecteur
  d'écran. Il s'ouvre à la demande, par une commande sous le graphique. Chaque
  graphique est une image nommée par un titre qui dit ce qu'elle dessine et
  décrite par une phrase de synthèse — le pire cas et son effectif. La
  question de la vue est le sous-titre de sa carte : les graphiques d'une même
  vue la partagent, comme les deux du profil, en comptes et en pourcentages.
  **Un jumeau porte au moins les valeurs de son graphique, et peut détailler
  au-delà** — les trois comptes du mélange d'une table, quand la grille n'en
  dessine qu'un ; la diversité de chaque animateur tour par tour, quand le
  graphique dessine la soirée —, jamais en deçà. Celui de la vue de
  comparaison est **l'escalier du manque** (§ 12.10.6), une colonne par
  placement comparé.
- **Le pointage se fait au plus proche** : à 260 points, le pas est de quelques
  pixels, et sans cette couche la vue est inutilisable au pavé tactile.
- **Les jetons de graphique forment une famille** (§ 13.3) : deux séries, le
  repère d'un plafond, celui d'une borne, l'axe, « prouvé inévitable » et
  « reste », l'échelle séquentielle, ses encres et la bordure des cases, dans
  les deux thèmes. Les deux séries se distinguent l'une de l'autre et des six
  teintes d'organisation une fois les trois dichromaties simulées, chacune à 3:1
  au moins sur le fond de la carte et à 30° au moins des teintes de conflit :
  une série voisine d'une pastille se lirait comme cette organisation. Une
  série à motif tracée par-dessus une autre — les tirets du second placement
  sur le trait plein du premier (§ 12.10.6) — se mesure contre le fond de la
  carte, que les vides de son motif laissent voir, quand sa couleur diffère de
  celle de la série qu'elle recouvre ; peinte de la même couleur, elle ne s'en
  distingue que par son motif, et les deux séries se mesurent l'une contre
  l'autre. Une grille de fond ne porte pas d'information et n'est pas tenue à
  3:1 ; elle reste en couleur pleine.
- **Le pointage au plus proche a une règle par forme** : sur un escalier, le
  rang sous le pointeur ; sur des barres, la ligne sous le pointeur ; sur une
  grille, la case ; sur les petits multiples, le point de relevé le plus proche
  sur l'abscisse commune, désigné dans tous les graphiques à la fois.
  L'infobulle porte la ligne du jumeau qui correspond.

### 12.8 Ce que le logiciel ne dessine pas

- **Un score unique, une jauge, un feu vert** : il moyenne ce que l'opérateur
  doit arbitrer, cache quel critère a été sacrifié, et éteint la seconde
  question — un placement à 87 % ne dit pas qui est à 14.
- **Un camembert des organisations** : il décrit les **entrées**, pas la qualité
  de la sortie ; identique sous un bon et un mauvais placement.
- **La moyenne seule**, sous quelque forme que ce soit.
- **Un nuage « rencontres contre organisations »** : deux entiers bornés, 260
  points se superposent sur quelques centaines de positions.
- **Deux placements dans deux graphiques aux axes différents.**
- **Le taux de satisfaction**, `Σ rencontres / Σ plafond réalisé` : il affiche
  100 % sur un placement dont rien ne peut plus être tiré, et **99,8 %** sur le
  placement du § 12.1 où 259 personnes sont à 27 sur 27 et une à 14 sur 27. Deux
  dixièmes de point séparent un plan sans reproche d'un plan qui contient une
  plainte.
- **La somme, ou la moyenne, des manques** : une personne à 14 de manque et
  quatorze personnes à 1 donnent le même total et appellent des décisions
  opposées. C'est en outre le scalaire qu'une recherche descend le plus
  volontiers, et il achète toujours la queue contre la masse.
- **La moyenne des rencontres**, et le taux de couverture des paires qui en est
  la même chose divisée par C(N, 2) : quand les tables sont pleines à chaque
  tour, le nombre de voisinages créés vaut `R · Σ C(c_t, 2)`, fixé par le
  mobilier et identique pour toutes les propositions ; la moyenne est alors une
  fonction affine décroissante du seul **excédent de rencontres**, que les
  colonnes du § 5.4 encadrent déjà par les deux bouts. Sur un seul tour, les
  répétitions sont impossibles et **toutes les propositions ont rigoureusement la
  même moyenne**.
- **L'écart-type, la variance, l'indice d'équité** : minimisés en servant tout le
  monde également mal. Une courbe plate et basse les emporte sur une courbe haute
  portant une seule personne en bas — ils inversent l'ordre des deux questions du
  § 12.1.
- **Le rapport manque / plafond** : indéfini quand le plafond vaut 0, et il fait
  passer un manque de 1 sur un plafond de 3 devant un manque de 3 sur 28
  (§ 12.10.3).
- **Un pourcentage hors de la liste du § 5.4**, ou sans son compte : ni le
  pourcentage d'une borne — la borne de diversité, la borne des animateurs, qui
  ne prouvent rien —, ni le rapport manque / plafond, ni Σ rencontres / Σ
  plafond réalisé, ni un pourcentage au tableau des propositions (§ 5.7), dans
  un critère ou comme clé de tri. Le **taux de diversité** d(p), défini au
  § 5.4, garde sa forme, au centième.
- **Un indice d'équité entre animateurs** : l'équité se lit par le moins varié,
  le plus varié et l'effectif au minimum.
- **Un histogramme des rencontres** : la répartition est un tableau, le profil
  trié la dessine (§ 12.3).
- **Une durée seule comme qualité du calcul** : le temps dépend de la machine ;
  la performance se lit en mouvements, la durée observée à côté.

**Les pourcentages de mélange sont une exception nommée à cette liste**, bornée
aux quatre rapports du § 5.4 : les rencontres d'une personne sur son plafond
réalisé, les tours possibles servis d'un tour ou de la soirée, les tours servis
d'une personne sur ses tours possibles, les organisations distinctes d'une table
et d'un tour sur ses sièges, ses assis ou ses affiliés. La première est le
complément du rapport manque / plafond ; la deuxième, prise sur la soirée, est
le taux de satisfaction transposé aux objectifs. Leur défaut est celui que le
premier point de cette liste nomme — 99,8 % cache la personne à 14 sur 27 —, et
la page le corrige par la règle qui fonde l'exception : **chaque pourcentage est
suivi, juste dessous, du pire cas en compte** — « minimum 14 sur 27 », « 3
personnes jamais servies », ou, sur une ligne, son propre compte (§ 12) —, et ne
sert ni à trier, ni à classer, ni à départager deux placements, qui se
comparent sur le manque (§ 12.10). **La vue de comparaison est le seul
affichage qui en pose deux côte à côte** (§ 12.10.6) : ses deux colonnes
portent, chacune pour son placement, les pourcentages que portent les tuiles
(§ 12.2), et eux seuls, chacun suivi du compte du pire, pour que la page
n'écrive ses chiffres que d'une seule façon. Ils s'y lisent, ils n'y
départagent rien : la vue n'écrit ni leur écart, ni lequel est le plus haut,
n'en tire aucune phrase, et ne les porte ni au tracé, ni à son infobulle, ni
à l'escalier, qui restent en comptes — un manque en pourcentage serait le
rapport manque / plafond que cette liste refuse. Deux pourcentages voisins
peuvent cacher deux pires cas sans commune mesure — 51 % d'un côté, une
personne à 14 sur 27 ; 50 % de l'autre, une personne à 1 sur 2 — : le compte
sous chacun le dit. Sur la soirée, les rencontres ne se somment pas : le
pourcentage d'une tuile est celui de la personne que sa borne nomme (§ 12.2), et
le taux de satisfaction reste refusé.

### 12.9 D'où viennent les chiffres

Les statistiques sont calculées par le **moteur**, en fonctions pures, testées
sous `node`. **La page ne recalcule rien** : elle lit les mêmes valeurs que le
tableau d'indicateurs et que le classement. Dès que la même arithmétique existe
en deux endroits, le graphique et le tableau finissent par se contredire devant
l'opérateur.

**Le détail d'un placement** — son profil trié, ses collisions jointes aux
planchers, ses paires, sa matrice, ses mélanges, ses bornes de diversité, ses
inclusions et celles hors d'atteinte du diagnostic — se calcule pour lui seul, à
l'ouverture de la page, par les fonctions du moteur, en une lecture du plan ;
jamais pour toutes les propositions, dont la table d'évaluation se recalcule à
chaque écriture. Les points de relevé de la performance s'y ajoutent, leurs
plans lus dans la course que le compagnon des courses garde pour la proposition
(§ 8.6), chacun mesuré sous les réglages courants par la mesure qui fait foi ;
les pourcentages aussi, par la seule fonction du moteur qui les calcule (§ 5.4).
Le détail d'une charge se garde tant qu'elle ne change pas, et se refait sur la
suivante : aucune valeur ne survit à un changement de réglage. Les tuiles lisent
les mesures de la ligne de cette table. Le détail ne reçoit pas cette ligne, que
la table calcule pour chaque proposition : il mesure son placement par le même
chemin qu'elle — la mesure, les plafonds réalisés et les trois chiffres du
§ 12.10.4, pris d'une seule fonction de l'application —, et ses fonctions du
moteur n'en recomptent rien. Elles rendent une fois les bornes et les planchers
qui accompagnent les tuiles, et jugent un plancher atteint sur la valeur même
que la ligne porte. Les tris, les échelles, les chemins des tracés et le
pointage au plus proche sont des fonctions pures : un composant n'en fait aucun.

Les vues se dessinent en **SVG**, avec **un module de géométrie frère** de celui
du plan, dans la même couche (§ 13.4) — même principe, même discipline
d'épreuve, mais **pas le même module** : l'unité du plan est le centimètre réel,
celle d'un graphique est le rang et le nombre. Les confondre ferait fuir l'unité
du bâtiment dans les axes.


### 12.10 Le manque : la grandeur qui compare deux propositions

#### 12.10.1 Pourquoi les nombres bruts ne se comparent pas

Le § 12.3 trie les participants sur le nombre de personnes rencontrées. Tant que
toutes les tables sont pleines à tous les tours, ce nombre se compare : le
plafond réalisé est le même pour tout le monde, et la règle horizontale du
plafond suffit à lire l'écart. Dès qu'une table est incomplète — la variante du
§ 15.1 — le plafond réalisé devient un escalier, et cet escalier **change d'une
proposition à l'autre** : qui passe par la table incomplète dépend du placement.

Comparer les nombres bruts est alors faux dans les deux sens. Une personne à 27
sur un plafond réalisé de 27 est **servie au maximum de ce que son placement lui
permettait** ; une personne à 27 sur 28 est privée d'une rencontre. Les deux
affichent 27, et le rang 1 de la courbe désigne la mieux servie des deux.

#### 12.10.2 La grandeur de base : le manque

Pour une personne p de la population mesurée :

```
manque(p) = plafond réalisé(p) − rencontres(p)
```

Un entier positif ou nul, exprimé en **personnes**. Il ramène tout le monde à la
même échelle parce qu'il mesure chacun **contre ce que son propre placement
rendait possible**, et non contre une valeur commune qui n'existe pas. Zéro
signifie la même chose pour les quatre animateurs des tables de 7 de la grande
démonstration, dont le plafond vaut 24, et pour un mobile de quatre tables de 8,
dont il vaut 28 : *rien de ce placement-ci ne peut leur être repris*.

Le plafond réalisé se calcule **sur l'occupation**, le plafond a priori sur les
**capacités** : le § 5.5 en donne les deux formules et le glossaire.

C'est la lecture que le § 15.1 demande sans la nommer. Le minimum brut de la
grande démonstration vaut 24 et **aucune relance ne l'améliore jamais** ; le
manque, lui, répond à la relance. L'opérateur cesse de relancer sur un chiffre
qui ne bougera pas.

#### 12.10.3 Le manque relatif : refusé comme grandeur

Le manque absolu ne distingue pas un manque de 1 sur un plafond de 3 d'un manque
de 1 sur un plafond de 28. Le logiciel **ne fait pourtant pas du rapport
manque / plafond une grandeur** : ni clé de tri, ni critère, ni colonne du
tableau des propositions, ni grandeur de comparaison, et il ne le calcule nulle
part. Son complément, les rencontres d'une personne en pourcentage de son
plafond réalisé, s'écrit sur la page de qualité seule, sous l'exception nommée
du § 12.8 : sur l'axe du second graphique du profil, rangé dans l'ordre du
premier, dans l'infobulle et le jumeau, et dans la tuile du minimum brut pour la
personne au rang 1 — chaque fois suivi du compte du pire. Il ne gouverne rien :
l'ordre des rangs reste celui des rencontres (§ 12.3), et la relance se décide
sur le manque.

| choix | mode de défaillance |
|---|---|
| le rapport gouverne la page | sur un événement à un tour et des tables de 4 — plafond 3 — un manque de 1 vaut 33 % et passe devant un manque de 3 sur 28, qui vaut 11 %. L'opérateur relance pour quelqu'un qui peut gagner **une** rencontre et ignore trois rencontres perdues. Le rapport est en outre indéfini quand le plafond vaut 0, et ne prend que quatre valeurs sur un plafond de 3 : des paliers que l'œil lit comme des écarts |
| le manque absolu seul | une personne sur un itinéraire bas paraît bien servie alors qu'elle est proportionnellement la plus privée |

Le second défaut se corrige sans inventer de grandeur : **le plafond réalisé
accompagne le manque partout** — tuile, colonne de la comparaison, infobulle,
tableau des propositions, sous le chiffre du plus grand manque (§ 5.7) — comme
le § 12.2 l'exige déjà du chiffre de tête, et **à manque égal, le tri place
d'abord le plafond le plus bas**. Entre deux manques égaux, la personne
proportionnellement la plus privée est donc la première ; **entre deux manques
différents, le tri ne prétend rien sur la proportion**, et c'est le choix assumé
ci-dessus. L'infobulle d'un point porte la ligne entière, qui enseigne le
vocabulaire :

> manque 3 · rencontres 24 · plafond réalisé 27 · plafond a priori 28 · 259 au total

#### 12.10.4 Les trois chiffres, et aucun quatrième

Chacun porte sa population mesurée et ses deux lignes secondaires — mobiles,
ancrés — comme tout agrégat du § 5.4, sous son chiffre, au tableau des
propositions (§ 5.7) comme sur sa tuile (§ 12.2). Quand la population mesurée
est vide, les trois s'écrivent « — ».

**1. Le manque maximal.** *De combien la personne la plus privée est-elle privée,
compte tenu de là où ce placement l'a assise ?* Le plus grand manque sur la
population mesurée. Vaut **0** sur un placement dont personne ne peut plus rien
tirer : la tuile ne compte alors personne au manque maximal, et la mention de la
population mesurée (§ 12.2) dit sur combien de personnes ce zéro tient. Vaut
**13** sur le placement du § 12.1 où chacun atteint un plafond réalisé de 27 sauf
une personne qui ne rencontre que 14. Majorant : le plus grand plafond réalisé.
L'axe de la comparaison, lui, s'arrête au plus grand manque des deux
placements (§ 12.10.6) : borné au majorant, il écraserait les courbes contre
le zéro. C'est la transposition du « le minimum gouverne la page » sur
une échelle comparable ; la page écrit **« le plus grand manque »**, jamais
« manque minimal », qui désignerait le mieux servi.

**2. L'effectif du manque.** *La falaise est-elle une personne ou quarante ?* Le
nombre de personnes dont le manque vaut au moins 1. Vaut **0** sur un placement
sans manque — un vrai zéro, mesuré sur une population non vide, et non un « — ».
Vaut **1** sur le placement précédent, et jusqu'à l'effectif mesuré sur un
placement systématiquement mauvais. Un manque maximal de 13 porté par une
personne et un manque maximal de 13 porté par quarante appellent deux décisions
opposées : déplacer quelqu'un, ou ajouter une table.

**3. L'écart d'itinéraire maximal.** *Cette proposition a-t-elle perdu avant même
de s'asseoir ?* Le plus grand `plafond a priori(p) − plafond réalisé(p)`. Il
recouvre les deux façons de perdre sur le parcours : visiter moins de tables
distinctes qu'il n'était possible, et occuper des tables incomplètes. Vaut **4**
dans la variante du § 15.1 pour un mobile que la proposition assoit aux quatre
tours à une table occupée par 7 : quatre tours à `7 − 1 − 1 = 5` sièges
renouvelés, soit 20, plus les 4 animateurs rencontrés une fois — 24 contre les 28
que la configuration promettait.

**C'est le chiffre qui sauve le manque d'un contresens.** Une personne mise en
réserve à trois tours sur quatre a un plafond réalisé minuscule et un manque
nul : elle n'apparaît ni au premier chiffre, ni au second, alors qu'elle est la
plus mal servie de la soirée. Son écart d'itinéraire, lui, est énorme. Une
personne absente à trois tours sur quatre n'y ressemble pas : son plafond a
priori ne compte que son tour de présence, et son écart d'itinéraire ne porte
rien de son absence.

**Et c'est une borne, pas une promesse.** Un écart d'itinéraire non nul n'est
pas toujours récupérable : dans la grande démonstration, les tables de 7 offrent
112 sièges-tours dont 16 aux animateurs, donc **96 sièges-tours mobiles** qu'un
placement ne peut pas ne pas servir ; chaque mobile n'en absorbant que 4 au
plus, **au moins 24 mobiles** terminent sous leur plafond a priori de 28, et
l'écart d'itinéraire maximal **ne descend jamais sous 1**. Il en va de même dans
la variante, où les 4 sièges vides laissent à chaque tour une table d'au moins 3
mobiles incomplète. **La page écrit ce plancher sous le chiffre** (§ 12.2),
comme le diagnostic du § 5.6, et n'appelle jamais « récupérable » le
complément — exactement la discipline du § 12.4 sur « prouvé inévitable » et
« reste ». Sans ce plancher, le troisième chiffre enverrait l'opérateur
relancer indéfiniment vers un 0 que la configuration interdit.

#### 12.10.5 La décomposition, et ce qu'elle autorise à écrire

Quatre quantités sur une ligne, trois différences entre elles :

```
N − 1   ≥   plafond a priori   ≥   plafond réalisé   ≥   rencontres
                                écart d'itinéraire       manque
```

Le logiciel **ne nomme que deux** de ces différences — celles qu'il affiche. La
première est le diagnostic du § 5.6, qui a déjà ses mots. Le § 5.5 pose « deux
notions, deux noms, jamais trois » ; la discipline tient, parce que **aucun de
ces deux noms ne désigne une borne** : ce sont des différences entre deux termes
voisins de la même ligne, et il n'existe toujours que deux bornes sur les
rencontres.

La décomposition tranche une ambiguïté : le certificat de « minimum atteint » se
lit **contre le plafond a priori**, donc sur `manque + écart d'itinéraire`,
jamais sur le seul manque (§ 5.5). Conséquence directe, que le guide d'usage
écrit : **la grande démonstration ne décerne jamais ce certificat.**

La vérification du § 12.3 — la courbe ne dépasse jamais son plafond, sinon la
page refuse de dessiner — devient un **test de signe sur les trois inégalités**
de la ligne. Un écart négatif est un calcul faux, et la page le dit au lieu de
tracer.

#### 12.10.6 La vue de comparaison

Elle porte sa question en toutes lettres, comme le § 12.1 l'exige de chaque
vue : **laquelle des deux sert mieux, et qui y perd ?**

Le § 12.3 reste inchangé pour **une** proposition. Quatre lignes ne se lisent
pas ; dès **deux** placements, le logiciel dessine donc l'écart lui-même, dans
une vue de la page de qualité, la troisième, après le profil trié (§ 12).

**Les deux placements.** Le premier, **A**, est la source de la page — la
proposition montrée, ou le retenu. Le second, **B**, se choisit parmi les
**candidats** : les propositions comparables et le retenu mesurable, moins A, et
moins le placement identique à A — un retenu non ajusté et sa proposition
d'origine sont un même placement, et ne se comparent pas l'un à l'autre. Une
liste en tête de la vue, « Comparer à : », porte exactement les candidats, le
retenu d'abord, puis les propositions dans l'ordre du classement, chacune sous
son numéro et son rang ; la commande « Comparer » du menu d'une ligne du tableau
des propositions pose aussi B (§ 12). Sans choix, B est le premier qui existe, parmi
les candidats, de : le départ de A, quand A est une dérivée ; la proposition
d'origine de A, quand A est un retenu ajusté ; la première proposition du
classement ; le retenu. La vue s'ouvre ainsi sur la question qu'on se pose —
« a-t-elle fait mieux que son départ ? », « mon ajustement a-t-il coûté ? ».
Sans candidat, elle cède la place à sa phrase (§ 12.6). Le choix est un état de
la navigation (§ 8.4) : il n'écrit rien, vit en lecture et sur un plan bloqué,
et se retire à l'ouverture d'un événement. La vue ne retient rien : retenir se
fait au tableau des propositions. Une ligne nomme les deux placements, « n° 4 »
et « n° 7 », ou « placement retenu », sous les noms que le tracé et les phrases
leur donnent ensuite.

**Côte à côte, au-dessus du tracé**, deux colonnes juxtaposées, une par
placement, portent les mêmes chiffres dans le même ordre. En tête, ceux de la
question de la vue : la place au classement — celle de sa proposition pour un
retenu non ajusté, « — » pour un retenu ajusté, aux participants ou à la main,
qui ne se classe pas, avec la mention « ajusté depuis sa proposition : ne se
classe pas » —, le minimum brut, le plus grand manque avec le plafond réalisé de
la personne au rang 1, l'effectif du manque et l'écart d'itinéraire maximal.
Dessous, repliés sous « Tous les indicateurs », un repli que le clavier ouvre et
ferme, les indicateurs des tuiles de l'en-tête chiffré (§ 12.2), par les groupes
des colonnes du tableau des propositions (§ 5.7) — personnes rencontrées,
collisions d'organisation, rencontres répétées et retours, diversité, manque et
plafond a priori, objectifs des tables et animateurs ; les chiffres de la tête
n'y reparaissent pas, si bien que le groupe du manque n'y garde que l'écart au
plafond a priori ; une colonne que le tableau ne porte pas sous un critère
décoché y reste, comme sa tuile, avec « ne classe pas » —, lus dans les deux
lignes de la table d'évaluation, sans le détail de B. Chaque chiffre porte ses
lignes secondaires, et son plancher quand il est prouvé, comme sur les tuiles
(§ 12.2) ; les planchers sont ceux du diagnostic, communs aux deux placements.
Une colonne nomme la personne que la tuile nomme, sauf au minimum de A(p) et au
minimum de m(p), dont la borne ne se lit que dans le détail : ces deux chiffres
s'y écrivent sans personne ni borne ; quand aucune personne présente ne porte
d'organisation, la cellule de la diversité écrit, comme sa tuile, la phrase qui
le dit (§ 12.2). Une dérivée y porte « dérivée de n° X ».

**Les colonnes portent les pourcentages des tuiles**, et eux seuls
(§ 12.2) : un chiffre dont la tuile porte un pourcentage le porte aussi dans
sa colonne, écrit sous sa valeur et suivi, juste dessous, du compte du pire,
comme sur la tuile. Ils sont trois. Le minimum brut, en tête : le
pourcentage de son plafond réalisé qu'atteint la personne au rang 1 du
profil de ce placement, puis « minimum 24 sur 27 ». Sous « Tous les
indicateurs », les tours hors objectif : le pourcentage des tours possibles
servis sur la soirée, Σ_r S_r sur Σ_r Π_r, puis « 3 personnes jamais
servies » ; et le minimum de s(p) : le pourcentage de ses tours possibles que
sert la personne à ce minimum, puis « minimum 1 sur 4 ». Le pourcentage
d'une colonne est celui du **pire cas de son placement** — la personne que
sa borne nomme, ou la soirée —, jamais une moyenne de la population ; chaque
colonne lit le sien dans la ligne d'évaluation de son placement, et le pire
cas d'une colonne n'est pas forcément la personne de l'autre. Il s'écrit par
la fonction unique du § 5.4 : « — » quand son dénominateur vaut 0 — un
plafond réalisé nul au rang 1 —, jamais 0 % ni 100 %, le compte restant
écrit (§ 12.6). Le manque maximal, l'effectif du manque, l'écart
d'itinéraire maximal, la place au classement et les autres indicateurs
restent en comptes ; le taux de diversité garde sa forme, au centième.

**Aucun pourcentage ne compare** (§ 12.8) : la vue n'écrit pas l'écart des
deux, ne marque pas le plus haut, et ses phrases — les trois effectifs de
rangs, la bascule, la dominance, l'indiscernabilité — ne portent que sur le
manque. Le tracé, son infobulle et l'escalier restent en comptes : un manque
en pourcentage serait le manque relatif que le § 12.10.3 refuse.

- **La quantité** : le manque, et lui seul. Une seule série par placement,
  deux au plus sur le tracé, **superposées**, A en trait plein et B en
  tirets, chacune étiquetée directement de son nom (§ 12.7).
- **L'axe vertical** : le manque en personnes, **zéro en bas**, graduations
  entières, borne haute commune aux deux courbes — **le plus grand des deux
  manques maximaux**, au moins 1 —, jamais une échelle par courbe, que le
  § 12.8 refuse. Le zéro porte son libellé : « rien à reprendre à ce
  placement ».
- **La synthèse du tracé** dit, pour chaque placement, son plus grand manque
  et l'effectif à ce manque — « chez 2 personnes » —, l'effectif qu'écrit sa
  tuile (§ 12.2) ; elle tait cet effectif pour un placement dont le plus grand
  manque vaut 0, où personne ne manque de rien.
- **L'abscisse** : le rang, chaque placement trié **par son propre manque
  décroissant**, départagé par plafond réalisé croissant puis par
  identifiant. Les deux courbes descendent. Le rang 1 de l'une et de l'autre
  ne désigne pas la même personne, et la page l'écrit.
- **L'infobulle d'un rang** porte deux lignes, une par placement, chacune
  au format du § 12.10.3 précédé du nom de la personne : « n° 4 — Prénom
  Nom : manque 3 · rencontres 24 · plafond réalisé 27 · plafond a priori
  28 · 259 au total ».
- **Le jumeau tabulaire** (§ 12.7) est **l'escalier du manque** : une ligne
  par entier, de la plus grande valeur de manque à 0, présente ou non, et par
  placement une colonne d'effectif et une colonne d'effectif cumulé — le
  nombre de rangs dont le manque atteint au moins la valeur de la ligne,
  c'est-à-dire le dernier rang où la courbe atteint cette valeur : la courbe
  elle-même, lue à l'envers, sans trou. Il lit le même tableau que le tracé
  (§ 12.9).

**Quand aucune ne domine**, le § 12.3 dit déjà que l'arbitrage est réel. Le
manque change ce qui se lit : avec des nombres bruts, un croisement peut
n'être qu'un artefact des plafonds — la courbe du bas appartient peut-être à
des gens assis à des tables de 7. Avec le manque, **le croisement porte sur le
placement**. Le logiciel ne laisse pas lire la position du croisement à l'œil
sur 260 points : **il compte les rangs**, parce que deux profils décroissants
peuvent se recroiser plusieurs fois et qu'un « rang de croisement » unique
n'existe pas en général. La page écrit les trois effectifs — « n° 4 sert
mieux à 12 rangs, n° 7 à 200, égalité à 48 » — et, **quand le signe ne change
qu'une fois**, nomme en plus le rang de bascule.

**Peu de valeurs, une phrase.** Quand les deux profils réunis prennent moins de
valeurs distinctes que le seuil du registre (§ 19.10), la vue ne trace rien et
écrit, par valeur, l'effectif de chaque placement, puis les trois effectifs de
rangs, puis, quand le rang 1 ne désigne pas la même personne, la phrase qui le
dit ; le jumeau reste. Une courbe à deux marches ne dit rien que la phrase ne
dise mieux (§ 12.6).

**Un calcul faux d'un côté refuse toute la vue** : quand la ligne
d'évaluation de l'un des deux placements porte un refus de dessin
(§ 12.10.5), la vue ne trace aucune des deux courbes et nomme celui dont le
calcul est faux. Les deux côtés se jugent sur ce même test, celui de leur
ligne, jamais l'un sur le détail de la source et l'autre sur sa ligne.

Ce que la vue ne dit pas, et que les colonnes gardent à côté : le manque
mesure chacun contre son propre placement, donc **un placement peut avoir un
manque plus bas en offrant moins de rencontres réelles**. Le minimum brut et
l'écart d'itinéraire maximal des deux restent affichés à côté des courbes ;
une implémentation qui les retire rend le piège invisible.

#### 12.10.7 La dominance

**Dominance de profil.** La proposition A domine B quand, à **chaque rang** i,
`manque_A(i) ≤ manque_B(i)`, avec au moins une inégalité stricte, les deux
séries étant triées chacune par son propre ordre. C'est exactement « les courbes
ne se croisent pas ». Un parcours linéaire après le tri suffit. Le logiciel
l'énonce en toutes lettres quand elle tient — « la proposition n° 4 sert mieux à
tous les rangs », « le placement retenu sert mieux à tous les rangs » — et
**n'affiche rien quand elle ne tient pas** : un témoin presque toujours éteint
apprend à ne plus être regardé, et la page montre déjà le croisement.

**La formulation est à surveiller mot à mot** : « sert mieux à tous les rangs »
n'est pas « sert mieux chaque personne ». Le rang 3 des deux propositions désigne
deux personnes différentes. Écrire la seconde phrase promet à l'opérateur qu'il
peut basculer sans léser personne, ce qui est faux. Une garde des libellés
refuse la seconde phrase dans toute table de traduction.

**Dominance personne par personne** — `manque_A(p) ≤ manque_B(p)` pour tout p —
se calcule aussi, en une passe, et **le logiciel ne la calcule pas**. La raison
est une implication, pas une statistique : **un ordre point par point survit au
tri**, donc une dominance personne par personne entraîne toujours la dominance de
profil, qui est déjà annoncée. La seconde ligne ne s'allumerait que dans les cas
où la première est déjà allumée, et l'opérateur n'en tire aucune décision
différente.

La petite démonstration du § 15.3 donne le test qui peut échouer (§ 14.2) : son
plan parfait a un manque nul pour les douze, donc **aucune proposition ne le
domine, et il domine strictement toute proposition qui n'est pas elle-même à
manque nul**. Le test s'énonce dans ces termes et non en « domine toute autre
proposition » : la petite démonstration admet plusieurs plans parfaits, et deux
profils tous à zéro ne se dominent pas — la formulation forte ferait échouer le
test sur un résultat juste. Le test **refuse de passer** s'il ne trouve aucune
proposition concurrente à comparer.

#### 12.10.8 Ce que le logiciel ne sort pas

Le § 12.8 en porte la liste, allongée de quatre familles qui s'offrent
d'elles-mêmes et trompent dans ce contexte précis : le taux de satisfaction, la
somme ou la moyenne des manques, la moyenne des rencontres et le taux de
couverture des paires, l'écart-type et ses parents. Chacune y est écartée avec le
chiffre qui montre sa défaillance.

#### 12.10.9 D'où viennent ces chiffres

Du moteur, en fonctions pures, comme tout le § 12.9. Le manque et l'écart
d'itinéraire sont deux soustractions sur des tableaux déjà calculés ; ils
n'ouvrent aucun parcours des ensembles de rencontres et ne changent pas le coût
du § 5.10. Le tri du profil est en O(N log N) sur une clé stable. La page ne
recalcule rien : la vue de comparaison lit les deux lignes de la table
d'évaluation, qui portent déjà, par personne, les rencontres et le plafond
réalisé, et ne demande pas le détail du second placement (§ 12.9) ; elle se
recompose à chaque dessin, sans cache de plus que la table (§ 13.3) — deux tris
et un parcours, de l'ordre de deux millisecondes sur la grande démonstration.
La table porte aussi le diagnostic que l'évaluation calcule déjà et le plafond
a priori de chaque personne mesurée ; la comparaison en tire, par une fonction
du moteur, les planchers des colonnes une fois par appel, communs aux deux
placements.

Une réserve honnête sur l'un des deux : le manque ne coûte rien, le plafond
réalisé se lisant sur le placement. **L'écart d'itinéraire suppose le plafond a
priori disponible par personne**, et non seulement en agrégat au diagnostic ;
son coût est exactement le point 4 du § 17, que cette section rend porteur. **Il
se calcule à chaque évaluation** : le coût est mesuré, et il ne retarde pas la
page. Le chemin « inconnu » reste celui du moteur, que l'application n'emprunte
pas : là, le troisième chiffre s'écrit **« inconnu »** et le départage du § 5.7
qui en dépend est sauté en nommant le palier appliqué à sa place.

### 12.11 Les organisations à chaque table

**Question : où les mêmes cercles se retrouvent-ils à une même table ?**

**Un sélecteur à trois positions** choisit ce que la grille compte, pour la
table t au tour r (§ 5.4) :

| position | la case écrit et colore | son pourcentage, à l'infobulle et au jumeau |
|---|---|---|
| **organisations par siège** — par défaut | les **sièges sans organisation nouvelle**, c_t − δ_{t,r} | δ organisations pour c sièges |
| **organisations par personne assise** | les **assis sans organisation nouvelle**, o_{t,r} − δ_{t,r} | δ organisations pour o assis |
| **doublons parmi les affiliés** | les **doublons d'organisation**, α_{t,r} − δ_{t,r} | δ organisations pour α affiliés |

La position est un état de la séance, comme le tour montré : elle survit au
changement de section, repart de « par siège » à l'ouverture d'un événement,
n'écrit rien et ne fait aucune entrée d'historique ; elle vit en lecture et sur
un plan bloqué (§ 8.4). C'est un groupe de boutons radio, au clavier.

Une **grille**, une ligne par table, une colonne par tour. Sous chaque position,
chaque case **écrit et colore le même nombre** — le compte de la position —, sur
l'échelle séquentielle à quatre niveaux, 0, 1, 2, 3 et plus. Les trois comptes
ont le même sens : zéro veut dire que chaque siège, chaque assis ou chaque
affilié porte une organisation de plus, et ce niveau est le plus proche du fond
de la carte (§ 12.7). Ils s'emboîtent, le compte des sièges majorant celui des
assis, qui majore les doublons (§ 5.4). Une case sans affilié, ou d'une table
vide à ce tour, écrit « — » sous les trois positions, sans couleur : une table
de bénévoles sans organisation n'a rien à mélanger, et ne se lit pas comme la
pire de la soirée. L'infobulle d'une case porte le pourcentage de la position,
puis ses deux comptes — « 62 % », puis « 5 organisations pour 8 sièges » —, les
occupants, les affiliés et la capacité. Une case ne porte qu'un nombre : le
pourcentage n'y tient pas à côté du compte, et la couleur ne porte que ce que la
case écrit.

**Les tables se rangent de la pire à la meilleure, sous la position choisie** :
le plus grand compte d'une case, puis la somme des comptes sur les tours, puis
l'ordre des tables ; une table dont toutes les cases écrivent « — » vient en
dernier. La pire case est donc dans la première ligne. Le moteur rend les trois
ordres ; l'écran lit celui de la position. La synthèse de la grille (§ 12.7)
nomme la première table, sa case la plus haute, et le nombre de cases de la
grille à ce compte : le pire cas et son effectif.

La vue décrit **la sortie**, pas les entrées : elle ne dit jamais combien chaque
organisation compte de membres (§ 12.8, le camembert). Elle complète la vue des
collisions (§ 12.4) : celle-ci dit quelle organisation se retrouve, la grille où
et quand ; un doublon d'organisation non nul est exactement une table où la vue
des collisions compte au moins une collision ce tour-là.

**Le jumeau** porte une ligne par table et par tour, les tables dans l'ordre de
la position et, sous chacune, ses tours dans l'ordre ; chaque ligne écrit **les
trois comptes et leurs trois pourcentages**, chaque pourcentage suivi du compte
de sa ligne (§ 12), les occupants, les affiliés et la capacité : il détaille
au-delà de la grille (§ 12.7). Une case tient son chiffre et 24 px de côté ; une
grille dont les cases ne tiennent pas dans la largeur de la carte cède la place
à son jumeau, avec la phrase qui le dit, et le sélecteur reste. Une case n'est
pas une cible : le pointage au plus proche désigne la case sous le pointeur
(§ 12.7), et le jumeau porte les mêmes valeurs. Sans collision, la grille cède
la place à la phrase de la vue des collisions sous la position « doublons »
seulement ; sans organisation, à celle du § 12.6 sous les trois ; avec une seule
organisation, elle reste.

### 12.12 Les objectifs des tables

**Question : qui n'est jamais assis à une table qui lui correspond, et à quel
tour l'objectif perd-il ?**

**Les personnes jamais servies viennent d'abord**, nommées, chacune avec ses
tours possibles : c'est la seconde question du § 12.1, à place fixe.

**La soirée s'écrit ensuite en texte**, non en barre : le pourcentage des tours
possibles servis, puis juste dessous le pire cas en compte — « 77 % des tours
possibles servis », « 3 personnes jamais servies » —, ses deux comptes — « 31
servis sur 40 possibles » —, ses tours hors objectif et leur plancher. À un seul
tour, la soirée ne s'écrit pas : la ligne du tour la dit.

Puis des **barres horizontales, une par tour**. Chaque barre porte les **tours
hors objectif** du tour, Π_r − S_r (§ 5.4), en deux segments : **prouvé
inévitable**, le **plancher du tour** max(0, P_r − L_r), avec le P_r et le L_r
du § 5.6, et **reste**. Un couple fixé possible étant servi, Π_r − S_r = P_r
− S^nf_r, et une personne servie non fixée occupe un siège libre : S^nf_r ≤ L_r,
donc le plancher du tour borne la barre. **La première barre est celle du tour
au plus grand reste**, à place fixe ; les autres tours suivent dans leur ordre ;
aucune couleur ne désigne un tour. En encre secondaire, chaque ligne porte
**ses assis sans table possible** σ_r (§ 5.4) : « 10 assis sans table
possible ». Ce compte lit tous les assis du tour, concernés ou non : il dit
combien de personnes aucune table ne pouvait servir, sans entrer dans le
dénominateur, que le plancher borne. Un tour sans couple possible n'a pas de
barre : sa ligne écrit « — » et garde ses assis sans table possible — « —, 10
assis sans table possible ». Sous le graphique, une liste reprend les tours dans
l'ordre des barres, chacun avec le pourcentage des tours possibles servis à ce
tour et ses deux comptes dessous — « 80 % », « 24 servis sur 30 possibles » ; un
tour sans couple possible y écrit « aucun couple possible à ce tour », sans
pourcentage. Les mots, la forme des segments et le domaine des planchers sont
ceux du § 12.4.

**Le diagnostic calcule le plancher de chaque tour**, que le critère classe ou
non, et en rend les termes et la somme ; le détail les lit et ne les recompte
pas (§ 13.2). La vue les dessine dans tous les cas ; la somme des planchers des
tours égale le plancher des tours hors objectif quand le diagnostic l'écrit
(§ 5.6). Le diagnostic ne calcule aucun flot : le plancher d'un tour est
immédiat, comme celui de la soirée.

**Le jumeau** porte une ligne par tour — possibles, servis, leur pourcentage,
hors objectif, plancher, assis sans table possible —, la ligne de la soirée, la
liste des personnes jamais servies, chacune avec ses tours possibles, et la
répartition du nombre de tours hors objectif d'une personne, P(p) − s(p), de la
plus grande valeur à la plus petite, avec l'effectif.

La vue lit les personnes concernées (§ 5.4) ; sans elles, elle cède la place à
sa phrase. Le critère décoché ne la retire pas : elle dit qu'il ne classe pas.

### 12.13 Les animateurs

**Les animateurs rencontrés.** *Qui a rencontré le moins d'animateurs ?* Un
**profil trié** de m(p) (§ 5.4), sur les personnes concernées par les
animateurs, de la moins servie à la mieux servie : à m égal, la borne la plus
haute d'abord, puis l'identifiant. Une seule série ; la **borne des animateurs**
B(p) tracée dans le même ordre, en repère pointillé (§ 12.7), sous ce nom —
jamais « plafond » : aucun plan ne garantit de l'atteindre (§ 4.5), et la vue
n'en tire ni manque ni pourcentage. Le jumeau porte une ligne par personne, avec
m(p), B(p) et son statut, puis la répartition de m(p), de la plus basse valeur à
la plus haute.

**La diversité par animateur.** *Quel animateur voit le moins de diversité à sa
table ?* Pour chaque animateur, **sur la soirée** — l'union de ses tours
animés — **et à chacun de ses tours animés** : les organisations rencontrées en
animant A_f, A_{f,r} et, quand une personne présente porte une étiquette, les
étiquettes rencontrées en animant E_f, E_{f,r} (§ 5.4). Le graphique dessine la
soirée ; les deux grandeurs se dessinent en **deux colonnes de barres
horizontales juxtaposées**, chacune avec son axe et sa graduation, les
animateurs dans le même ordre d'une colonne à l'autre : ce sont de petits
multiples, jamais deux séries empilées ni un axe commun — une organisation et
une étiquette ne s'additionnent pas et ne se comparent pas. **Le moins varié en
tête** : A_f croissant, puis E_f, puis les personnes rencontrées en animant,
puis l'identifiant. Chaque ligne porte en encre secondaire ses tours animés et
ses personnes rencontrées en animant : un animateur d'un seul tour en rencontre
moins, et la vue le montre au lieu de le corriger.

**Le jumeau** porte, dans l'ordre du graphique, la ligne de la soirée de chaque
animateur — tours animés, personnes, organisations et étiquettes rencontrées en
animant —, puis sous elle une ligne par tour animé, dans l'ordre des tours, avec
les mêmes comptes pour ce tour seul : il détaille au-delà du graphique (§ 12.7),
et dit lequel des tours d'un animateur a appauvri sa soirée. Le pire (animateur,
tour) n'a pas de place fixe : la soirée gouverne l'ordre.

**Au-dessus de chaque colonne, trois nombres** : le moins varié, le plus varié,
et combien d'animateurs sont au minimum — pour A_f, et pour E_f quand sa colonne
existe. Leurs libellés à l'écran sont « le moins varié », « le plus varié » et
« au minimum » ; le mot « équité » n'y paraît pas, réservé au libellé du mode
« l'équité d'abord » (§ 5.3). Aucun indice ne les résume (§ 12.8).

Sans organisation, ou avec une seule, mais avec des étiquettes, la vue ne trace
que la colonne des étiquettes, triée sur E_f puis comme ci-dessus ; les autres
cas sont au § 12.6.

### 12.14 La performance du calcul

**Question : relancer plus longtemps aurait-il donné mieux ?**

La vue lit la course que le compagnon des courses garde pour la proposition
montrée (§ 8.6) : ses **mouvements évalués** sur son compte d'arrêt, et les
plans de ses points de relevé. Pour la génération qui l'a produite dans cette
séance, elle lit aussi sa **durée observée**, ses cœurs et sa **cadence**
(§ 5.10). Une durée nulle, ou absente — une proposition lue d'un fichier, une
génération d'une séance précédente —, s'écrit « inconnue », et la cadence avec
elle. Sans mouvement évalué, la vue écrit que le plan initial n'avait rien à
reprendre. Pour une proposition dérivée, la vue dit que la course part du plan
de son départ — « partie de la proposition n° 4 » — et non d'un placement tiré :
ses premiers points mesurent déjà un plan cherché, et ses mouvements ne
comptent pas ceux qui ont produit le départ (§ 8.6). Le retenu non ajusté qui
vient d'une dérivée, dont la vue montre la course, le dit aussi.

Puis des **petits multiples** : un graphique par indicateur, une valeur par
critère que le classement applique, dans son ordre, jamais la clé pondérée d'un
palier, précédés du minimum brut. Chacun marque la valeur de l'indicateur pour
la meilleure affectation **aux seuls points de relevé** — les plans de la
course, puis le plan de la proposition au dernier —, **mesurée sous les réglages
courants** par le recalcul complet, les points reliés par un trait mince ; la
phrase de synthèse le dit, car un indicateur seul n'est pas monotone le long de
la recherche. Changer une étiquette, un objectif ou l'ordre des priorités
remesure les points : le dernier point égale toujours la ligne de la proposition
au tableau des propositions, et aucune valeur mesurée sous d'autres réglages ne
s'affiche. L'abscisse, commune, est le nombre de mouvements en échelle
logarithmique, graduée aux points de relevé ; chaque graphique a son seul axe
vertical (§ 12.7), de zéro à sa plus grande valeur. Une phrase dit le dernier
point de relevé où une valeur a changé : « aucune valeur n'a changé entre 10 000
et 20 000 mouvements ; une autre graine est l'autre façon de chercher ». Elle
n'affirme rien des mouvements que la recherche n'a pas évalués.

**Le jumeau** porte une ligne par point de relevé — le nombre de mouvements,
puis une colonne par indicateur. Il ne porte aucune durée : la cadence est celle
de la génération entière, répartie sur ses fils, et ne date aucun point
(§ 5.10).

La vue mesure une proposition : sur le placement retenu, elle le dit, et montre
la course de la proposition d'où il vient quand il en vient sans ajustement et
qu'elle est encore dans la liste. Une proposition dont la course n'est pas
gardée — écrite avant le compagnon ou par une version antérieure, compagnon
absent, illisible ou contradictoire, proposition effacée puis rendue après une
réouverture — n'a pas ces données : la vue dit que sa course n'est pas gardée.
La page ne lit l'horloge que par l'application ; le moteur ne la lit jamais
(§ 14.7).

### 12.15 Les inclusions

**Question : quelles rencontres demandées par les inclusions ce placement ne
fait-il pas ?**

La vue lit les inclusions du détail du placement (§ 12.9) : celles de sa ligne
d'évaluation, chaque personne par son identifiant, et les inclusions hors
d'atteinte du diagnostic. Elle n'en mesure aucune : une seule fonction décide
qu'une inclusion est satisfaite (§ 13.2).

Une phrase de synthèse l'ouvre : « 2 inclusions non satisfaites sur 5 rencontres
demandées. », ou « Chacune des 5 rencontres demandées se fait. », « La rencontre
demandée se fait. » pour une seule ; quand chaque liste active dépasse ce que sa
personne peut rencontrer, « Aucune rencontre demandée ne fait d'avis : chaque
liste dépasse ce que sa personne peut rencontrer. ». Puis **les inclusions non
satisfaites, à place fixe en tête** (§ 12.1) : une phrase par rencontre demandée
que le placement ne fait pas, dans l'ordre de la mesure, par la personne qui la
porte puis par sa liste — « Iris Ombrelle n'a pas rencontré Théo Pervenche »,
« Iris Ombrelle n'a rencontré personne de Club des Merles ». Une rencontre que
les deux personnes demandent ne compte qu'une fois (§ 5.4) : sa phrase la nomme
une fois, chez la première des deux, et le dit, « …, une rencontre demandée des
deux côtés ». Sans avis, « Aucune. ».

Puis deux informations, jamais des avis, chacune sous la phrase qui le dit et
seulement quand elle a des lignes :

- **les listes au-delà du plafond** : chaque personne dont la liste demande
  plus de personnes qu'elle n'en peut rencontrer (§ 5.4), par identifiant, ses
  inclusions satisfaites sur ses inclusions actives, ses inclusions
  atteignables et celles qui restent possibles sans que le placement les
  atteigne — « Ondine Lacasse : 5 inclusions satisfaites sur 9, au plus 7
  possibles ; 2 inclusions encore possibles non atteintes », ou « toutes ses
  inclusions encore possibles sont atteintes » ;
- **les inclusions hors d'atteinte** (§ 4, § 5.6), dans l'ordre du diagnostic,
  chacune par sa personne, sa cible et sa raison — « Théo Pervenche → Capucine
  Sarcelle : la personne incluse est exclue ».

Chaque nom et chaque organisation est une donnée, dans son propre nœud. Les
phrases des avis sont celles de la liste de travail du plan (§ 5.8) et de la
rubrique « Inclusions du placement » de la fiche (§ 10.2) ; la colonne du
tableau des propositions, sa phrase sous le numéro (§ 5.7) et la tuile de
l'en-tête (§ 12.2) en écrivent le compte. Sans inclusion active, la vue cède la
place à sa phrase (§ 12.6) ; quand les listes portent des inclusions toutes hors
d'atteinte, la phrase le dit, « Aucune inclusion n'est active : celles que les
listes portent sont toutes hors d'atteinte. », et la liste des inclusions hors
d'atteinte la suit.

---

## 13. Architecture

### 13.1 Forme du projet

Une application **Capacitor**, dont le code web vit dans `www/` — la sortie de
Vite, que Capacitor désigne comme son répertoire web — et ne dépend d'aucun
service.

| plateforme | ce qui la porte | rôle |
|---|---|---|
| `electron` | une **coquille Electron propre au projet**, emballée par `electron-builder` | la livraison : un exécutable Windows |
| `web` | la plateforme web de Capacitor, servie en local | le développement et les tests sous Linux |
| `android` | la plateforme Android de Capacitor | ouverte, non requise pour la première livraison |

**Capacitor ne porte pas l'exécutable Windows, et c'est délibéré.** Il ne
fournit de plateforme de bureau que par une extension communautaire, et une
plateforme dont la mise à jour ne dépend pas du projet fige le moteur
d'exécution embarqué : l'exécutable livré porterait un Chromium que plus
personne ne corrige. La coquille du projet tient en quatre fichiers — le
processus principal, ses primitives de fichiers (`fichiers.js`), son
gestionnaire d'impression (`impression.js`) et le script de préchargement — et
fixe elle-même sa version d'Electron, que la construction met à jour comme
n'importe quelle dépendance.

**La coquille est l'endroit où vivent les deux frontières de plateforme du § 13.4
sous `electron`** : le système de fichiers — écriture atomique, verrou, sonde
d'écriture, chemin publié par le lanceur portable (§ 8.6, § 8.8) — et
l'impression (§ 11.7), dont le processus principal compose lui-même les options
— la boîte de dialogue du système, le papier, l'orientation — en refusant toute
autre demande de la page. Le processus principal les exécute ; le script de
préchargement les expose à l'application par un **pont étroit et nommé**,
l'isolation de contexte restant active et l'intégration de Node coupée dans la
page. Une page qui atteindrait le système de fichiers directement ferait d'une
faille d'affichage — un nom importé interprété comme du balisage — un accès
complet au disque.

Le code que Vite compile vit sous **`src/`**, en modules nommés d'après les
couches du § 13.4 : `src/moteur`, `src/geometrie`, `src/stockage`, `src/csv`,
`src/pdf`, `src/impression`, `src/polices`, `src/demo`, `src/application`,
`src/interface`, et `src/actifs`, qui porte le logo de l'éditeur tel qu'il le
fournit, que le panneau « À propos » montre et que la séance passe à la planche
de badges (§ 11.4), et les modules qui chargent à la demande ce logo, les textes
des licences de `public/licences` et les avis des tiers, que ce panneau donne à
lire. À la racine du projet, **`version.json`** est l'unique source de la
version (§ 18.3) et **`src/version.genere.js`** le module qu'elle engendre —
**versionné dans le dépôt**, parce qu'une séance de développement lancée sans
l'étape de construction doit afficher une version et non une importation
manquante, et **contrôlé par rejeu du script**, parce qu'un fichier engendré et
oublié affiche une version périmée avec l'assurance d'une constante.

**Ce qui n'est pas un composant s'éprouve sous `node`** : `src/application` et
les modules purs de `src/interface` — tri, filtre, mise en forme, modèle de
dessin, navigation au clavier — entrent dans le projet `node` du § 14.8, à côté
du moteur ; seuls les composants Svelte, et ce qu'ils peignent, passent au
navigateur.

### 13.2 Une seule langue, et c'est une exigence

Tout — le moteur, la géométrie, l'interface — est écrit en **JavaScript**.
Aucune partie du calcul n'est dupliquée dans un second langage.

Cette propriété doit être **préservée délibérément**, et une garde de
l'arborescence la tient : sous `src/`, `electron/` et `scripts/`, rien d'autre
que du JavaScript, des composants Svelte, des feuilles de style, des données
JSON, les scripts nommés — d'installation, d'environnement et de lancement sous
Linux et sous Windows, de construction de l'exécutable Windows, d'épreuve de
l'installation sur chaque système, et de l'oracle du générateur pseudo-aléatoire
(§ 14.11) — et les données nommées, qui ne calculent rien : les deux fichiers de
la police embarquée et leur provenance, les deux fichiers du logo de l'éditeur.
Dès que la même arithmétique existe en deux endroits, une suite de tests peut
prouver qu'ils s'accordent **sans jamais prouver qu'ils ont raison** : les deux
dérivent ensemble et les tests restent verts. Une seule implémentation rend ce
mode de défaillance impossible.

**Deux exceptions, nommées, et elles seules.** La première est le calcul
incrémental des indicateurs du § 5.10. Elle tient à une condition écrite — **le
recalcul complet est la mesure**, celle dont sortent les chiffres affichés ;
**l'incrémental n'existe que dans la boucle de recherche**, où il sert de score et
ne s'affiche jamais — et à une épreuve qui lie les deux à la fin de chaque
recherche, à cinq ordres de grandeur de mouvements (§ 14.10).

La seconde est la borne des collisions d'un plan sans conflit (§ 5.6), qui
existe en deux endroits : le plancher des conflits en étoile, calculé en
JavaScript et instantané, et le plancher exact de chaque tour, que résout
HiGHS. Le texte de chaque modèle s'engendre en JavaScript, et HiGHS est un
solveur externe, comme `pdf-lib` est un écrivain externe : aucune
arithmétique du logiciel n'est réécrite dans un second langage. Une épreuve
recoupe les deux bornes sur des charges tirées — le plancher des étoiles ne
dépasse jamais la somme exacte — et confronte chaque minimum exact à une
recherche exhaustive.

**Une seule fonction décide qu'une inclusion est satisfaite**, dans la mesure
du moteur : la personne et sa cible partagent une table à un tour au moins, ou
la personne a rencontré un membre de l'organisation incluse. Le compte de
chacun, les inclusions non satisfaites et leur garde (§ 12.3) la lisent toutes.

**La présence a une règle de lecture et une grammaire, chacune en un seul
lieu.** Une seule fonction décide qu'une personne est présente à un tour — une
liste absente valant tous les tours —, dans le moteur, que la normalisation, les
mesures, l'application et les sorties lisent. Une seule grammaire lit et écrit
la présence en texte, dans le CSV : l'import, l'export, le modèle et l'aperçu
l'emploient, et la grille et la fiche, qui saisissent par cases, écrivent ce
qu'elle relit. Une seule fonction ajuste un placement à la présence — celle du
retenu, du plan ajusté d'un départ et de la copie qu'on retient (§ 5.7,
§ 5.8).

### 13.3 La bibliothèque d'interface : Svelte 5, construit par Vite

Le logiciel n'emploie **aucune bibliothèque de dessin SVG** : le plan est du SVG
écrit à la main, et le déplacement, le zoom et la conversion de coordonnées sont
des fonctions pures du module de géométrie.

| critère | ce que Svelte apporte |
|---|---|
| tenir hors ligne | se compile en JavaScript ordinaire ; Vite est une dépendance de développement qui ne survit pas à la construction |
| rester rapide | compile des mises à jour fines, sans arbre virtuel ni mémoïsation à poser à la main — à une exception près : la table d'évaluation des propositions, gardée dans le modèle pur sous l'identité de la charge figée de la séance, qu'une écriture remplace ; ses propositions figées sont partagées d'un état publié au suivant |
| se tester sans navigateur | n'impose d'écrire aucun calcul dans un composant ; le composant ne contient que le câblage |
| être joli sans y passer des semaines | un fichier de jetons — couleurs, rayons, ombres, échelle typographique, cible principale, largeur de page — décliné en deux thèmes ; ses familles de couleur : la page, le bandeau, la carte, l'action principale, les quatre états du plan, le neutre, les organisations, la bande de mode, les messages (avis, refus, information), le retrait, le plan, le graphique, le papier |

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
  csv                l'import et l'export des listes, sur le modèle du stockage
      │
  stockage           lecture et écriture de fichiers
      │
  moteur             le placement : pur, sans DOM, sans API de plateforme
```

Une couche n'importe que des couches placées plus bas, hors du générateur
pseudo-aléatoire `src/demo/prng.js`, que le moteur partage avec le générateur de
démonstrations ; l'interface n'atteint le CSV, le stockage et le moteur que par
l'application. Deux modules hors des couches lui sont admis : `src/actifs`,
qu'aucune autre couche n'importe, et qui n'importe que ses propres fichiers et
les textes des licences de `public/`, sans toucher le navigateur ; et
`src/version.genere.js`, que ni le moteur, ni la géométrie, ni le générateur de
démonstrations ne lisent (§ 14.7).

**Le moteur ne connaît ni le DOM, ni Capacitor, ni Electron.** Il reçoit des
nombres et des listes, il rend des placements. C'est ce qui le rend testable sous
`node`, en quelques secondes — et c'est la condition pour qu'il soit éprouvé
sérieusement.

**La géométrie du plan** est une couche à part, de **fonctions pures**, séparée
du rendu et placée plus bas que le moteur : elle n'importe ni le moteur, ni
l'analyseur CSV, ni le générateur de démonstrations, ni l'application, ni
l'interface, ni le stockage, et ne touche pas le navigateur. Elle est
**requise** : sa garde échoue quand son arbre ne fournit aucun module. Le
dessin, la désignation d'un siège et le dépôt partagent ses conversions et ses
chaises (§ 7.2, § 7.3).

Les **deux frontières de plateforme** sont le système de fichiers et
l'impression : une interface unique, deux implémentations — plus, pour le
système de fichiers, une **troisième implémentation injectée par les épreuves**,
qui sait simuler l'échec de renommage du § 8.8, le dossier vide que le système
ne laisse pas retirer, et les cinq issues du § 8.6 : le chemin publié par le
lanceur portable, un dossier de travail sous un emplacement de données
applicatives, une sonde d'écriture qui échoue, une perte d'inscriptibilité **en
cours de séance**, et un support amovible. Sans elle, les 100 % de branches
exigés des chemins de reprise (§ 14.13) ne s'écrivent pas, et la règle à cinq
issues du § 8.6 reste le code le moins éprouvé du logiciel alors qu'elle décide
de l'endroit où vit la soirée. L'impression a de même sa troisième
implémentation, simulée, qui rend l'issue que l'épreuve choisit.

**Un dossier ne se retire que vide.** Aucune primitive du système de fichiers
ne retire un dossier avec ce qu'il porte : la seule qui en retire un refuse
celui qui porte encore une entrée, fût-ce un dossier vide, et le laisse tel,
contenu compris ; elle ne retire jamais la racine. Un retrait récursif ferait
d'un chemin mal composé — un nom vide, un dossier oublié dans le chemin — la
perte du dossier de travail entier ; un retrait qui se refuse ne perd rien.
Sous `electron`, un fichier effacé qu'un antivirus ou un agent de
synchronisation tient encore ouvert reste un instant dans son dossier sous
Windows : le retrait se réessaie comme le renommage de l'écriture atomique
(§ 8.8), puis se refuse. Sous `web`, l'OPFS retire de même un dossier vide et
refuse celui qui porte une entrée, fichier d'échange de Chromium compris. La
commande de l'explorateur (§ 8.6) ouvre la racine ou l'un de ses dossiers,
confiné à elle comme toute cible.

**Les octets se lisent tels quels, et une image se pèse avant de se lire.**
L'interface du système de fichiers compte vingt primitives. Une seule lit un
fichier d'une racine en octets, sans le décoder : elle rend un fichier
binaire — un logo — tel qu'écrit, sous le confinement de la lecture d'un
texte, et un fichier absent
ou un dossier s'y disent absents. Le dialogue d'import demande au besoin un
genre, l'image : il en filtre les extensions sans fermer l'accès aux autres
fichiers, et lit la taille du fichier choisi avant ses octets ; au-delà de
25 Mo, il refuse sans rien lire, car le fichier entier traverserait sinon le
pont de la coquille avant qu'aucun contrôle ne le voie.

**Une proposition entrée dans l'événement ouvert ne change plus** : le stockage
la fige, et tout changement passe par un objet neuf. Les mémoires du stockage
(copie canonique, texte, contrôle de forme, examen) se gardent par l'identité de
ces objets figés ; elles n'ont d'effet que sur le temps, et une épreuve compare
leurs sorties à celles d'objets non figés, octet pour octet.

**Trois couches servent les sorties, et chacune n'importe que ce que sa liste
nomme.** `src/pdf` produit la planche de badges (§ 11.1) : l'imposition, la mise
en page du badge et le document. C'est la seule couche qui importe `pdf-lib` et
`fontkit`, et elle n'importe du reste du code que le registre des constantes et
la définition des papiers ; elle ne touche pas le navigateur, et s'éprouve donc
sous `node`. L'application charge la production par un seul import différé, ne
lui passe que des données et les octets de la police, et ne voit jamais un objet
de la bibliothèque. `src/impression` est la frontière de plateforme
« impression » : la boîte de dialogue du navigateur sous `web`, le gestionnaire
de la coquille sous `electron` ; elle n'importe que les papiers. `src/polices`
porte la police embarquée, ses fichiers et son chargement, et n'importe rien.
**Seul le point d'entrée de la page câble l'impression et la police** : aucune
autre couche ne les importe, et l'application les reçoit avec ses dépendances.

**Les fils de la génération sont un paramètre, comme le système de fichiers.**
L'exécuteur qui répartit les propositions entre ses fils (§ 5.10) reçoit de quoi
en faire naître et le nombre de processeurs logiques du poste ; seul le point
d'entrée de la page lit ce nombre de la plateforme. Les épreuves donnent le leur,
et des fils simulés qui s'achèvent dans l'ordre qu'elles choisissent : c'est
ainsi que s'éprouve un résultat indépendant de l'ordre d'achèvement (§ 5.7).

**Le solveur du plancher exact ne se charge qu'à un endroit.**
`src/application/solveur_travailleur.js` est le seul module de `src/` qui
importe `highs` (§ 5.6), et une garde le tient. Le texte de chaque modèle
s'engendre en JavaScript pur (`modele_tour.js`), sans paquet, et ce que
l'interface lit des planchers exacts (`planchers_exacts.js`) n'importe pas le
solveur. Le point d'entrée de son travailleur
(`src/interface/diagnostic/travailleur_solveur.js`) n'importe que
l'application ; l'exécuteur qui lui parle et le suivi que le Diagnostic lit
(`executeur_solveur.js`, `suivi_solveur.js`) n'importent pas `highs`. Seul le
point d'entrée de la page importe ce travailleur, par un import différé : il
forme un morceau que la page ne charge qu'au premier calcul. Il désigne aussi le
module WebAssembly du solveur, par `highs/runtime?url` et par ce seul
spécificateur — la garde relève tout autre import de `highs` qu'il ferait. App
reçoit, comme les autres plateformes, une seule propriété, `chargerSolveur` :
une fonction asynchrone qui fait l'import différé et rend `{fabrique, urlWasm}`,
la fabrique du travailleur et l'adresse du module, dont App fait l'exécuteur du
solveur au premier calcul. Une épreuve monte App sans elle, sur les planchers
instantanés seuls.

**La frontière des couches est gardée mécaniquement**, et pas seulement par
discipline : un test du **graphe d'imports** refuse qu'un module de `src/moteur`
ou de `src/geometrie` importe de `src/interface`, de `src/application`, de
`src/stockage`, de `src/csv` ou d'une interface de plateforme. Il refuse de même
que `src/stockage` importe de `src/csv`, de `src/application`, de
`src/interface` ou d'une plateforme, ou touche le navigateur hors de ses deux
implémentations du système de fichiers, qu'aucun autre de ses modules
n'importe ; que `src/csv`, qui lit le modèle du stockage, importe de
`src/application`, de `src/interface` ou d'une plateforme ; que `src/geometrie`
importe en outre du moteur ou de `src/demo` ; que `src/application` importe de
`src/interface` ou de Svelte ; que `src/interface` importe autre chose que
Svelte, ses propres modules, `src/application`, `src/geometrie`, `src/actifs` et
`src/version.genere.js` — une liste fermée : elle atteint le CSV et le moteur
par l'application, jamais en direct, et tout autre fichier du projet se refuse ;
et qu'une autre couche importe `src/actifs`. Un type que la documentation d'un
module importe compte comme un import. Le projet `node` ne chargeant pas le
greffon Svelte (§ 14.8), un test de moteur qui importerait un composant échoue
au chargement — mais cette garde-là ne couvre que les composants, et un module
qui touche `document` ne tomberait qu'à l'exécution de la branche fautive.

### 13.5 Ce que le SVG donne et que le canvas ferait payer

- **La désignation de ce qui est sous le pointeur**, pour la sélection : le
  navigateur répond exactement, sans une ligne de code. En canvas il faut la
  réécrire et la maintenir en accord avec le dessin — une divergence donne des
  clics qui tombent à côté sans que rien ne le signale.
- **L'épreuve par le style calculé** (§ 14.2). Sur un canvas il n'y a pas de
  style calculé : on en serait réduit à comparer des pixels.
- **Le contraste et les deux thèmes** : en SVG les couleurs sont des propriétés
  CSS, gouvernées par un seul fichier de jetons.
- **L'impression vectorielle** : le plan s'imprime en SVG, à la résolution de
  l'imprimante (§ 11.7), là où un canvas exigerait un second chemin de rendu à
  haute densité.
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

Chaque constante du registre porte, à son entrée, **ce qu'elle mesure,
pourquoi, et sur quelle configuration elle a été relevée** — ses champs `mesure`,
`raison` et `configuration` —, afin que personne ne la « corrige » plus tard par
le calcul. Un seuil mesuré propre à une épreuve, comme le coût d'un
enregistrement (§ 8.2), porte les trois en commentaire à côté de sa valeur.

**Chaque seuil dit « mesuré » a un propriétaire nommé** — le banc de mesure du
§ 19.10, le niveau `node`, le **niveau manuel**, ou l'**exécution**, qui le relève
sur le rendu à chaque usage et n'en écrit aucune valeur. Un seuil sans propriétaire
reste à sa valeur de départ pour toujours. Des mesures sortent du banc parce
qu'un banc de navigateur ne les prend pas : le **décalage des imprimantes
visées** et leur **marge non imprimable**, qui bornent séparément la zone de
silence du badge sur un bord de coupe et sur un bord de feuille (§ 11.3), et les
autres que le § 19.10 range au niveau manuel — ce qu'une impression réelle, un
lecteur ou une main seuls disent. Elles appartiennent au **niveau manuel, avant
livraison** ; tant qu'elles n'ont pas eu lieu, la constante **se déclare défaut
de travail** à son entrée du registre, avec le protocole qui la relèvera.

### 14.2 Un test qui ne peut pas échouer ne prouve rien

- Tout test ajouté doit être **montré en train d'échouer** sur le code d'avant.
- Un test de rendu lit le **style calculé**, pas la présence d'une classe : une
  classe peut se poser sur un élément qui ne peint rien.
- Un test qui parcourt un ensemble **refuse de passer quand cet ensemble est
  vide** : « zéro fichier examiné » n'est pas « zéro problème ».

La clause de l'ensemble vide ne vaut pas que pour les balayages d'arborescence.
Elle vaut pour le **vérificateur d'invariants** (§ 14.12) — un vérificateur qui
rend toujours la liste vide rend verts tous les tests de propriété qui s'appuient
sur lui ; pour les **boucles de propriété**, qui comptent les configurations
acceptées et échouent sous un plancher, parce qu'un générateur refusant les
configurations difficiles rend la propriété vraie sans rien éprouver ; et pour le
**choix des comptes d'épreuve**. Un accord incrémental éprouvé à dix mouvements,
ou une pagination éprouvée sur le seul compte où la troncature et l'arrondi par
excès coïncident, sont des tests qui ne peuvent pas échouer.

### 14.3 Les règles se gardent, pas seulement les cas

Quand un défaut est corrigé, le test qui l'accompagne épingle la **règle**
plutôt que le cas. Une valeur remise à la main sera défaite par la main
suivante ; une règle qui fait échouer la construction tient.

### 14.4 Les niveaux d'épreuve

| niveau | ce qu'il couvre | quand |
|---|---|---|
| **`node`, série surveillée** | moteur, géométrie, CSV, indicateurs et plafonds — des fonctions pures ; l'application et les modules purs de l'interface, sur le système de fichiers simulé et l'horloge pilotée ; cohérence des versions (§ 18.5) ; appariement captures/manifeste (§ 19.7) ; aller-retour et canonicité du stockage sur la petite démonstration ; quelques productions de la planche de badges, sur de petits modèles et en nombre compté par fichier, avec contrôle de géométrie et de couche de texte ; grille de propriétés sur petites instances | **à chaque modification**, quelques secondes (§ 14.14) |
| **`node:long`** | accord de l'incrémental à 1, 10, 100, 1 000 et 10 000 mouvements ; rejeu du générateur et empreinte ; pagination des badges sur ses cinq comptes A4, ses quatre comptes Lettre et ses deux impositions, et sur ses quatre comptes Avery 5392 ; reconstruction de tous les instants du journal ; aller-retour sur la grande démonstration ; coût d'enregistrement ; sonde d'écriture sur système de fichiers réel ; grande grille de propriétés | avant un commit, et à la construction |
| **navigateur** | ce que l'interface dessine, ce que les gestes produisent, les coordonnées ; le scénario de pilotage (§ 19.3) ; les épreuves de style calculé | avant chaque livraison |
| **manuel** | une soirée complète, de la saisie à l'impression ; l'impression réelle sur chaque papier, et sur une feuille Avery 5392 ; le décalage des imprimantes et leur marge non imprimable (§ 11.3), et l'écart du contour de la feuille de contrôle aux prédécoupes ; les corps du badge et le corps minimal du plan imprimé, la lisibilité des listes de noms, la largeur du bloc de noms, le seuil du glisser, la durée de la pression longue (§ 19.10) ; `pointercancel` et `touch-action` (§ 7.3) | avant chaque livraison au client |
| **sa propre commande** | le banc de mesure (§ 19.10), `make banc` ; l'audit par mutation (§ 14.13), `make mutation` | avant une livraison, sous aucun budget |

**La commande surveillée ne lance que le projet `node`.** Le lanceur en porte
trois (§ 14.8) — `node`, `node-long` et `navigateur` ; lancés ensemble, ils
démarrent un navigateur et la série longue à chaque modification, et le niveau
navigateur reste à « avant chaque livraison ».

**Le banc et l'audit ne sont dans aucune des trois séries.** Chacun a sa commande,
lancée avant une livraison. Le banc est un projet Vitest à part, de configuration
propre, qui pilote le même navigateur au même cadre d'affichage mais que seul
`make banc` lance (§ 19.10) ; l'audit joue le moteur sous `node --test`, le repli
du § 14.8, par `make mutation` (§ 14.13). Leur coût est d'un autre ordre que les
budgets du § 14.14, et aucun lancement des trois séries ne les démarre.

**Le partage entre les deux séries `node` est écrit avant la première mesure**,
et non après. Trois familles tombent naturellement dans la série surveillée sans
que personne ne les compte — la **production de PDF**, qui charge un
sous-ensemble de police et analyse sa sortie ; les **épreuves de stockage** à
système de fichiers réel ; la **grille de propriétés**, qui appelle un générateur
capable de construire 260 participants et un tour témoin. Chacune a l'ordre de
grandeur que le § 14.14 désigne comme fatal, et la réponse naturelle au
dépassement — relever le budget — supprime la propriété qu'il achète.

**jsdom ne sait pas éprouver la géométrie SVG** : il n'implémente ni `getBBox`,
ni `getScreenCTM`, ni la mise en page du texte. Tout ce qui touche à une
dimension réelle exige un vrai moteur de rendu. Croire l'inverse fait sauter
l'étage intermédiaire et laisse partir les défauts de coordonnées.

### 14.5 Accessibilité et thèmes

Le texte tient **4,5:1** de contraste, les marques porteuses d'information
**3:1**. Une commande sans texte, à icône seule, offre une cible de 24 × 24 px
au moins et porte son libellé en nom accessible. Chaque couleur est accompagnée du ratio **mesuré sur la couleur relue du
rendu**, non sur le jeton source. Les deux thèmes sont éprouvés **par rendu**,
jamais seulement par calcul, et le tableau des ratios est **engendré pour les
deux** à partir des styles relevés au pilotage (§ 19.5), jamais recopié. Le
document imprimé y fait exception par construction : le papier est clair dans
les deux thèmes, et ses textes et marques prennent les couleurs du thème clair ;
le tableau les montre donc aux mêmes ratios sous les deux thèmes, sans que la
mesure ait failli.

**Une seule exception, bornée, à l'épreuve par rendu** : le signe d'une
pastille, d'un message et de la bande de mode, que son libellé accompagne
toujours, tient 3:1 sur le fond de sa pastille, de son message ou de sa bande,
mesuré au rendu des primitives dans les deux thèmes ; ses autres fonds sont
validés par calcul sous les trois dichromaties ; le libellé, lui, se mesure au
rendu comme tout texte. Tant qu'aucun écran ne montre tous ces signes, ils ne
figurent pas au tableau des ratios du § 19.5.

**Le logiciel n'applique aucune opacité partielle, aucun filtre et aucun mode de
fusion au texte ni aux marques porteuses d'information.** Le style calculé rend
la couleur **résolue** d'un élément, non le pixel composé : sous une opacité
partielle, la couleur relue diffère de la couleur peinte et le tableau des ratios
mentirait avec l'autorité d'une mesure. Sans opacité ni filtre, les deux
coïncident par construction.

### 14.6 La traduction, posée dès le départ

Une seule langue est livrée, mais **aucune chaîne visible n'est écrite en dur
dans un composant**. Le coût est nul aujourd'hui ; le retrouver plus tard suppose
de relire toute l'interface.

**La règle se garde par deux moyens, et aucun n'est le scénario de captures**
(§ 19.11) : comparer le texte affiché au texte attendu ne distingue pas une
chaîne venue de la table de traduction d'une chaîne écrite dans le composant —
les deux s'affichent à l'identique. Les deux gardes sont un **balayage des
sources** sous `node`, qui refuse une chaîne visible en dur et **échoue sur un
balayage vide** (§ 14.2), et une **exécution en langue témoin** où chaque chaîne
traduite est encadrée d'une marque — `⁅` et `⁆`, U+2045 et U+2046, une fois,
autour du texte entier : tout ce qui apparaît à l'écran sans sa marque est écrit
en dur. La langue témoin est un mode du mécanisme, que la construction livrée
n'emploie jamais.

**Un seul mécanisme, deux familles de tables.** Les textes de l'application —
codes de refus et d'avertissement, mise en forme des nombres et des durées — et
ceux des écrans vivent dans des tables distinctes, que réunit un seul mécanisme
de traduction. Un code s'affiche par sa propre clé, un libellé par une clé qui
nomme sa table ; une clé portée par deux tables, ou absente, lève — l'écran ne
montre jamais une clé brute ni un texte vide. Un texte qui devient une donnée —
le libellé figé d'une entrée du journal (§ 8.2), le motif du CSV des lignes
refusées (§ 10.1) — se compose en français, sans la marque de la langue témoin.

**L'écran pose les insécables de la ponctuation haute, au rendu seulement.** Le
`t` de l'écran, la traduction qu'App pose au contexte, passe son résultat
entier, une fois et avant la marque témoin, par `typographier` : la suite
d'espaces qui suit « « » ou précède « : » et « » » devient une insécable
U+00A0, celle qui précède « ; », « ? » et « ! » une fine insécable U+202F ; le
saut de ligne, la tabulation et un signe sans espace devant restent tels. Le
navigateur ne renvoie donc plus un signe seul en début de ligne. La même passe
lie un nombre à l'unité d'une liste fermée qui le suit, « n° » à ce qu'il
numérote, et le jour, le mois et l'année d'une date en lettres : « 20 h 30 »,
« 3 min 4 s », « n° 4 » et « 1er mai 2031 » ne se coupent plus, quand
« 3 sièges » ou l'espace entre « min » et « 4 » restent sécables. Les tables
gardent leurs espaces ordinaires, et ce qui quitte l'écran garde le texte brut :
le journal, le motif du CSV des refus, les PDF, la documentation engendrée, le
bloc copié de « À propos » et le titre de la fenêtre. L'historique, qui montre
les libellés figés du journal sans passer par `t`, les typographie à
l'affichage, la donnée lue restant intacte ; une donnée saisie montrée hors de
`t` — un nom, un libellé de table, le nom d'un jalon — reste telle. Les pages
imprimées, rendues par le même `t`, ne coupent un texte entre deux mots qu'à
un blanc sécable ; un mot trop long pour une page se coupe encore par
caractères.

**Les tours se nomment par une seule aide**, que les textes de la présence
emploient tous : « tous les tours », « tour 2 », « tours 1 et 3 », « tours 2 à
4 », « tours 1 à 3 et 5 » — une suite d'au moins trois tours se lit « a à
b » —, et sa forme qui porte la préposition : « au tour 3 », « aux tours 3 et
4 », « à tous les tours ». Un texte qui l'écrit à la main finirait par dire
« au lieu des tour 4 ».

### 14.7 Le déterminisme

Aucune source non reproductible — `Math.random`, `Date.now`, `performance.now`,
`crypto.getRandomValues` — dans le **moteur**, dans la **géométrie du plan**,
dans le **générateur de démonstrations**, ni dans le **stockage** et
l'**analyseur CSV**, qui reçoivent l'horloge et l'aléa en paramètre, ni dans la
**production PDF**. Un test de l'arborescence le refuse, **et échoue si son
balayage ne trouve aucun fichier**. Son périmètre est nommé : `src/moteur`,
`src/geometrie`, `src/demo`, `src/stockage`, `src/csv` et `src/pdf`, à
l'exclusion du code d'épreuve, où un tirage sert légitimement (§ 14.12). La
production PDF y est parce que sa sortie est un fichier que l'on compare : la
date du document y entre en paramètre, celle de l'horodatage du placement,
jamais lue, et deux productions du même modèle rendent les mêmes octets.
L'interdit ne porte pas sur le reste de l'application : l'application lit
l'horloge pour horodater les entrées de l'historique, que le stockage écrit
telles qu'il les reçoit, et la même horloge date le placement (§ 8.9) et la prise
d'un verrou (§ 8.8) ; le banc de mesure du § 19.10 relève des temps par image, et
l'audit par mutation des durées, sans en écrire aucune dans ce qu'ils
produisent.

**Ce n'est pas une règle d'hygiène.** L'interdit de `performance.now` dans le
moteur est ce qui rend vraie la phrase « à graine et entrée égales, placement
identique » : une recherche bornée par une durée rendrait le placement dépendant
de la vitesse de la machine, et le § 19.4 neutraliserait alors toutes ses sources
de variation sauf la seule qui compte. La règle d'arrêt de la recherche est pour
cette raison un **compte**, jamais une durée (§ 5.10).

**La version est une constante engendrée à la construction**, jamais une lecture
d'horloge à l'exécution (§ 18.5) : le moteur et le générateur ne la lisent pas.


### 14.8 L'outillage des épreuves

**Un seul lanceur, trois projets : Vitest.** Les deux séries `node` et le niveau
navigateur du § 14.4 sont trois configurations du même lanceur, pas trois
outils.

| projet | environnement | ce qu'il inclut | greffon Svelte |
|---|---|---|---|
| `node` | `node`, aucun DOM | les fichiers `.test.js` de `src/`, de `scripts/` et de `test/` : le moteur, la géométrie, le stockage, le CSV, les démonstrations, le PDF, l'application, les modules purs de `src/interface`, l'outillage et les gardes du dépôt — hors des suffixes `.long.test.js` et `.navigateur.test.js`, et hors des épreuves lourdes qu'une petite machine passe à `node-long` (§ 14.14) | **absent** |
| `node-long` | `node`, aucun DOM | les épreuves lourdes du niveau `node:long` (§ 14.4), suffixe `.long.test.js`, de `src/` et de `test/`, hors de la série surveillée, et sur une petite machine les épreuves lourdes qui quittent la série `node` (§ 14.14) | **absent** |
| `navigateur` | un vrai moteur de rendu, piloté par le mode navigateur de Vitest | les fichiers `.navigateur.test.js` de `src/` et de `test/` : les composants de `src/interface`, les épreuves de coordonnées et de style calculé, le système de fichiers de la page sur l'OPFS, le chargement des polices et des actifs, le travailleur du solveur, le parcours photographié (§ 19.3) | présent |

Un quatrième projet, **le banc de mesure**, vit hors de ces trois : sa
configuration est un fichier à part, aucun lancement des trois séries ne le
joue, et seule sa commande le lance (§ 14.4, § 19.10).

**Pourquoi Vitest.** Il lit la **configuration Vite qui construit le
livrable** : un module importé par un test se résout exactement comme un module
importé par l'application. Deux chaînes de résolution — l'une pour construire,
l'autre pour éprouver — sont le mode de défaillance du § 13.2 transposé à
l'outillage : le test passe sur un fichier que l'application ne charge jamais,
un alias diverge, et rien ne le signale. Le lanceur observe en outre le **graphe
de dépendances**, donc une modification du moteur ne rejoue que les tests du
moteur, et son mode navigateur offre **la même API d'assertion** au niveau 2, de
sorte que l'oracle de géométrie du § 7.2 s'écrit une fois.

**Les trois durées sont des cibles, mesurées la première semaine.** Le démarrage
à froid, la relance sous surveillance et la série complète se mesurent sur un
squelette, au même titre que la publication du dossier d'origine par le lanceur
portable (§ 8.6) et la construction depuis Linux (§ 16). Ce qui est tranché ici
n'est pas le chiffre mais **lequel gouverne** : le démarrage à froid se paie une
fois par séance, la relance sous surveillance se paie à chaque geste, et c'est
elle que le budget du § 14.14 borne.

**L'issue de secours est une règle d'écriture, et elle passe par un module.** Les
tests du projet `node` n'emploient que les assertions de `node:assert/strict` —
jamais `expect`, jamais un comparateur propre à Vitest. Ils importent `test` et
`describe` d'un **unique module local**, `test/lanceur.js`, qui réexporte ceux du
lanceur en place. Les fonctions de `node:test` ne sont pas globales et celles de
Vitest ne portent pas le même chemin d'import : sans cette indirection,
« tourner tels quels sous `node --test` » est faux, et le repli exigerait de
retoucher chaque fichier le jour où il presse. L'audit par mutation l'emprunte à
chaque passage (§ 14.13) : le repli est éprouvé, et non seulement promis.
Deux conditions le rendent réel et sont tenues par le projet `node` : ses modules
s'importent par **chemins relatifs à extension explicite**, sans alias ni syntaxe
propre à Vite. Le prix est réel — les écarts affichés par
`assert.deepEqual` sont plus pauvres — et il s'accepte parce qu'une dépendance
qu'on ne peut pas quitter finit par dicter l'architecture.

**Ce qui est écarté, et pourquoi.**

| écarté | raison |
|---|---|
| **Jest** | exige sa propre chaîne de transformation, parallèle à celle de Vite — la seconde résolution que l'on veut éviter |
| **Mocha + Chai + Sinon + nyc** | quatre choix à maintenir et à accorder pour ce qu'un lanceur rend d'emblée |
| **Karma, Jasmine, QUnit** | conçus pour un monde sans étape de construction ; ils rajoutent un second serveur devant Vite |
| **`node --test` seul** | ne résout ni les alias de Vite ni un composant ; pas de graphe de dépendances sous surveillance. Reste le **repli nommé**, et c'est pour lui que la règle d'assertion et `test/lanceur.js` existent |
| **jsdom**, sous quelque lanceur que ce soit | le § 14.4 l'écarte déjà pour la géométrie ; elle l'est aussi pour le style — sans mise en page, le style calculé ne rend pas ce qui est peint, et l'épreuve du § 14.2 devient une formalité toujours verte |
| **un pilote de navigateur distinct pour le niveau 2** | deux pilotes signifient deux façons de décrire un geste de pointeur, et le § 7.3 est précisément l'endroit où cette divergence coûte cher |

Pour les composants, **aucun outil supplémentaire** : le projet `navigateur`
monte le composant dans un vrai moteur de rendu. Un composant ne contient que du
câblage (§ 13.3) ; ce qu'il y a à vérifier est ce qui est **peint**. Le mode
navigateur pilote Chromium par Playwright, et le parcours photographié du § 19.3
comme le banc du § 19.10 emploient ce même pilote.

### 14.9 Où vivent les tests

Le test vit **à côté du module** — `plafond.js` et `plafond.test.js` dans le même
répertoire. Un arbre miroir éloigné ne s'ouvre pas quand on modifie le module, et
le test qui n'est pas sous les yeux n'est pas étendu. Les tests du niveau
navigateur portent le suffixe `.navigateur.test.js`, qui est aussi ce qui les
range dans leur projet.

Les données d'épreuve vivent dans `test/fixtures/`, les fichiers d'exemple
livrés restant ceux du § 10.3 — une donnée d'épreuve qui double un fichier livré
dérive de lui. **Les noms inventés d'une donnée d'épreuve sont disjoints du
réservoir du générateur** : le balayage du § 15.6 refuse qu'un fragment forgé
apparaisse hors des listes du générateur, des fichiers de démonstration, des CSV
d'exemple et du manifeste des captures, et une donnée d'épreuve qui emprunte une
racine d'organisation plausible le fait échouer. Un test vérifie cette
disjonction, faute de quoi la garde du § 15.6 tombe au premier exemple écrit de
bonne foi.

**La co-localisation se garde.** Un test de la construction affirme que le
paquet livré ne contient **aucun fichier de test ni aucun import du lanceur**.
Le § 14.15 pose que la suite n'est pas livrée ; avec des tests rangés dans
`src/`, cette propriété tient par la seule analyse statique de Vite,
c'est-à-dire par chance, jusqu'au jour où un module de production importe une
donnée d'épreuve « pour un cas par défaut ». Une garde de l'arborescence exige
aussi que chaque test de `src/` importe un module de son propre répertoire, hors
d'exceptions nommées avec leur raison, et qu'aucune donnée de `test/fixtures/`
n'égale, octet pour octet, un fichier livré.

### 14.10 La carte de ce qui s'éprouve

| module (§ 13.4) | niveau | ce qui s'y éprouve |
|---|---|---|
| moteur | `node` | indicateurs, plafonds et borne, inclusions atteignables, diagnostic, invariants d'un plan, accord de l'incrémental et du recalcul, registre et compilation de l'ordre des priorités, correspondance des objectifs, empreintes de référence de l'ordre par défaut, détail d'un placement pour la page de qualité, borne de diversité, points de relevé de la recherche |
| géométrie | `node` + navigateur | conversions, ajustement, bornes de zoom, désignation d'un siège ; l'oracle du moteur de rendu au niveau 2 ; la découpe du plan en pages (§ 11.7) ; les échelles, tracés et pointage des graphiques (§ 12.9) |
| stockage | `node` | sérialisation canonique, équivalence geste/entrée/état, reprise après panne, dérivation des noms de fichiers, forme positionnelle et champs facultatifs (§ 8.9), refus des formats plus anciens, état, journal et secours compris, compagnon des courses (§ 8.6), accord de la restitution incrémentale avec la chaîne des correctifs, de l'élagage en mémoire avec le texte relu, de SANS_EFFET par la différence avec le texte, des mémoires par identité avec le recalcul |
| analyseur CSV | `node` | encodage, séparateur, association des colonnes, réconciliation des organisations et des étiquettes, lignes refusées, aller-retour, CSV des objectifs de table |
| générateur de démonstrations | `node` | vecteur du générateur pseudo-aléatoire, empreinte des fichiers livrés, refus, noms forgés |
| PDF | `node` | couche de texte, pagination, police embarquée et table `ToUnicode`, géométrie de la planche, reproductibilité |
| application | `node` | les commandes et leurs refus, la séance observable, les contrôles de pose et de capacité, la table d'évaluation — sur le système de fichiers simulé et l'horloge pilotée |
| interface | navigateur ; ses modules purs sous `node` | ce que les gestes produisent, le style calculé, les trois invariants du § 7.2 |

#### Le moteur

**Un tour où une table est vide ne produit aucune rencontre.** Un plan dont une
table n'accueille personne au tour 3, et une autre où elle accueille une seule
personne : dans les deux cas, zéro paire ajoutée. Il refuse l'énumération qui
compte la paire (p, p) et crédite un convive isolé d'une rencontre avec lui-même
— défaut qui ne se voit sur aucun total, parce qu'il ajoute un au bon endroit.

**Le plafond d'un ancré sur quatre tables de 5, un ancré chacune, cinq tours, vaut
16 ; celui d'un mobile de la même instance vaut 19.** Les deux valeurs sont dans
le même test, parce que c'est leur écart qui est l'objet. Il refuse la suppression
du terme `min(n_p, …)`, qui se lit comme une borne redondante et dont l'absence
porte l'ancré à 19, affichant à perpétuité un animateur « à 84 % de son plafond »
(§ 5.5).

**Les retours imposés sont identiques pour toutes les propositions d'une même
configuration.** Sur la grande démonstration, chacune annonce 99 retours imposés.
Ce n'est pas le seul chiffre qu'elles partagent, mais c'est le seul qui, additionné
aux retours choisis, **noierait une quantité variable de quelques unités dans une
constante de 99**, à une résolution où l'opérateur ne lit plus l'écart. Le test
affirme les deux comptes **séparés et chacun à sa valeur** (§ 5.4).

**Une population vide rend « — », jamais zéro.** Il refuse `somme / 0` affiché en
`0`, et refuse un minimum d'ensemble vide rendu en `Infinity` que la mise en forme
convertit en tiret par accident plutôt que par décision.

**L'organisation d'un ancré voyage dans l'instance réduite.** Une table porte un
ancré d'une organisation inventée, un mobile de la même organisation existe, la
séparation est active : le plan rendu signale la collision ou l'évite, il ne
l'ignore pas. Il refuse la réduction qui n'annote pas les tables, laquelle assoit
un invité à côté d'un collègue animateur aux quatre tours **sans qu'aucun
indicateur ne s'en aperçoive** (§ 5.2).

**L'incrémental et le recalcul complet s'accordent, et le test dit à partir de
quand ils cessent de s'accorder.** Sur chaque configuration de démonstration, une
suite déterministe d'échanges, avec comparaison terme à terme de A(p) et de |F(p)|
à **1, 10, 100, 1 000 et 10 000 mouvements** — non au seul terme. Il refuse la mise
à jour qui oublie de décrémenter un compteur sur la table quittée. **Le nombre de
mouvements est l'exigence du test** : un test à dix mouvements est le test qui ne
peut pas échouer du § 14.2. Cette épreuve est dans la série `node:long`.

**Les conflits d'organisation tenus coup par coup égalent leur recalcul.** Sur
une soirée inventée où chaque critère compte, conflits compris — un membre
d'une organisation en nomme une autre, une personne sans organisation en nomme
une troisième —, sous chaque mode, l'ordre par défaut et un ordre déplacé, le
n-uplet tenu à jour égale le recalcul et une énumération directe des paires à
1, 10, 100, 1 000 et 10 000 mouvements, et revient au départ une fois les
mouvements défaits. L'énumération lit la relation sur la configuration, sans
le moteur : un conflit compté d'un seul sens, sur la seule personne qui nomme,
ou sur une organisation que seuls des exclus portent, la fait tomber. Il
refuse la mise à jour qui oublie une paire en conflit à l'arrivée ou au départ
d'une table.

**Sans liste de conflits, le critère ne change aucun plan.** Le conflit
d'organisation, en tête de l'ordre par défaut, est sans objet sans liste : les
empreintes de référence se relèvent identiques, plans, combinaisons, bascule
et classements, octet pour octet ; seul le nom du critère s'ajoute à la liste
écrite de l'ordre du registre que la section de la bascule porte.

**Les inclusions atteignables sont un maximum, et la mesure une lecture du
plan.** Sur cent configurations tirées, I(p) égale le plus d'inclusions que
satisfait un ensemble de K(p) personnes au plus, chaque ensemble énuméré, et
vaut k°(p) exactement quand b(p) ≤ K(p) ; sur cent plans tirés, les inclusions
satisfaites de chacun et les inclusions non satisfaites égalent celles d'une
lecture naïve des tables de chaque tour. Deux cas écrits refusent les formules
qui comptent d(p) sans le borner par K(p), ou qui ne lui accordent rien : trois
personnes incluses de trois organisations, et les trois organisations, sous
K = 2, donnent I = 4 ; une personne et son organisation sous K = 1 donnent
I = 2. Chaque raison d'une inclusion hors d'atteinte a son cas ; deux personnes
qui s'incluent l'une l'autre ne font qu'une unité, comme une personne et
l'organisation dont elle est le seul membre rencontrable, et une organisation
que deux membres satisfont en fait une à elle seule.

**Sans inclusion active, le critère ne change aucun plan ; avec elles, la
recherche tient les mêmes avis que la mesure.** Les empreintes de référence se
relèvent identiques, seul le nom du critère s'ajoutant à la liste de l'ordre
du registre ; une salle dont les seules inclusions sont hors d'atteinte rend
les plans de la même salle sans liste, et l'état n'en tient rien. Avec des
inclusions — paires demandées des deux côtés, organisations incluses,
inclusions contredites —, sous objectifs, animateurs, chaque mode et un ordre
déplacé, l'état tenu à jour égale, après chaque mouvement et chaque mouvement
défait, les avis que la mesure recompte, et le n-uplet celui de l'oracle ;
sous un départ à tour figé et réserves imposées aussi, où une personne
rencontre au siège d'une réserve un membre qu'aucun plan honorant les
réservations ne lui fait rencontrer. Une génération répartie sur plusieurs
fils égale celle d'un seul, et une dérivée n'en laisse jamais plus que son
départ. La grande démonstration portant les listes d'une fixture de graine
fixe (`test/fixtures/moteur/inclusions_grande.json`) a sa section des
empreintes de référence, ses inclusions non satisfaites comprises.

**Le mouvement dirigé se lit tirage par tirage.** Sous des tirages imposés,
il rend l'échange que décrit le § 5.10, chaque borne demandée dans l'ordre :
la rencontre, le partenaire, l'option, puis le siège, celui de la personne qui
reste sauté. Une personne fixée ne se déplace pas, un tour où l'une manque
n'offre rien, une table sans siège mobile ne reçoit personne, et sans option
rien ne change. Coup par coup, sous un départ à tour figé et réserves
imposées, aucun tour figé ni siège fixé ne bouge ; sur la fixture, l'ensemble
des rencontres qui manquent égale le recompte après chaque mouvement et chaque
retour, et l'état défait revient à ses compteurs. La recherche et la dérivée
rendent les plans de leur réplique, qui dirige un mouvement sur deux ; quand
un tour figé fait toutes les rencontres demandées, la dérivée tire comme sans
mouvement dirigé. Cinq propositions de 50 000 mouvements font toutes les
rencontres demandées de la fixture.

**Ce que l'écran dit des inclusions se lit dans la ligne d'évaluation.** Une
rencontre demandée des deux côtés fait une phrase et un avis, au tableau des
propositions, à la liste de travail du plan, à la page de qualité, à la fiche et
à la grille, qui la nomment chez les deux personnes ; une liste au-delà de son
plafond n'y fait aucun avis, et ses inclusions encore possibles se comptent à la
page de qualité, à la fiche et à la carte de la proposition choisie ; une
inclusion hors d'atteinte se nomme avec sa raison au diagnostic, à la page de
qualité et sous la liste de sa fiche. Un conflit posé, ou une inclusion posée
contre un conflit, avertit une fois, et une contradiction qui reste ne se redit
pas, même sous une organisation renommée. Sans inclusion active, ni phrase, ni
liste, ni rubrique : la vue cède la place à sa phrase, et les inclusions hors
d'atteinte se disent seules, au diagnostic, à la vue et sous les listes de la
fiche.

**L'ordre par défaut rend les plans de l'ordre fixe de référence.** Des
**empreintes de référence**, fichier d'épreuve versionné
(`test/fixtures/moteur/empreintes_defaut.json`), gardent les plans et les
grandeurs nommées qu'ils mesurent — excédent, cumulées, rencontres répétées
choisies, retours choisis, redondance, plus grand écart — de la petite
démonstration, de sa variante « conflit inévitable », de la grande et de la
variante sans exception, sous trois graines et un compte réduit ; de la petite
sous chacune des seize combinaisons des quatre cases ; de la petite et de sa
variante sous un compte plus long et sous l'ordre du registre, l'écart en
tête, où l'acceptation bascule et passe les contraintes devant lui ; et le
classement de douze propositions de la variante et de la grande, plafond a
priori connu et inconnu. Elles ne se régénèrent que par un geste conscient,
comme l'empreinte des démonstrations (§ 15.5, point 5). Un changement de
l'ordre par défaut réécrit celles que l'ordre touche, et se prouve : relevées
sur le code d'avant, le nouvel ordre donné en liste réglée, elles rendent le
même fichier, octet pour octet. Il refuse la compilation qui place mal une
composante nulle, déplace un tirage, ou range mal les paliers que
l'acceptation compare après la bascule.

**Le classement par défaut est celui de l'ordre fixe de référence sous les
quatre cases cochées, et une case décochée n'en retire que son critère.** Sous
les quatre cases cochées, l'ordre des propositions et la liste des critères
appliqués se comparent aux empreintes de référence. Sous chacune des quinze
autres combinaisons, l'ordre est celui de la clé de référence privée des
critères que les cases décochées retirent — et, sous « nouvelle table » seule,
où les retours choisis remplacent les rencontres répétées. Il refuse le critère
décoché qui classe encore, et celui qui se nomme dans la phrase.

**La bascule suit l'ordre réglé.** Sur des ordres inventés — l'écart en
troisième palier, un palier mixte { tours hors objectif × 2, redondance × 1 }
sous le mode par défaut, un palier de deux raffinements —, la compilation rend
l'ordre d'acceptation que le § 5.7 décrit, palier mixte compté « contrainte ».
Une épreuve de la série `node:long` compare, sur cinq graines, l'excédent et les
cumulées atteints sous l'ordre par défaut et sous un ordre qui range les
objectifs au deuxième palier, et borne leur écart. Il refuse le palier lu
critère par critère et la famille tirée du premier critère d'un palier.

**L'animateur se lit sur le fait, tour par tour.** Sur une petite configuration
inventée, animent à chaque tour : une réservation « tous les tours » sur une
place titrée ; R réservations de tour désigné sur cette même place. Anime au
seul tour 2 : une réservation du tour 2 sur une place titrée. N'animent pas : un
titre sans réservation ; une réservation sans titre ; une personne exclue ; le
second ancré d'une table à un titre, sans sièges attribués. Il refuse
l'animateur lu sur la seule portée « tous les tours », et le titre d'un seul
tour qui fait animer à tous.

**m(p) se compare à une lecture directe.** Sur une petite configuration où un
animateur n'anime qu'à un tour, où une table porte deux titres pourvus, et où
une personne partage la table d'un animateur à un tour où il n'anime pas, m(p),
son minimum, B(p) et les animateurs non rencontrés égalent un compte fait couple
par couple, tour par tour. Il refuse la rencontre comptée à un tour où
l'animateur n'anime pas, l'animateur compté deux fois, et la personne non
concernée comptée dans le minimum.

**La borne des animateurs tient sur tous les plans.** Sur des configurations
inventées assez petites pour énumérer tous les plans, aucun plan ne fait
dépasser B(p) à m(p), et sur l'une d'elles un plan l'atteint pour chaque
personne. Il refuse la borne qui ignore la table fixée d'une personne à un tour
où elle y est fixée, et celle qui ignore le plus grand nombre d'animateurs par
table et par tour.

**Chaque mode des objectifs compare ce qu'il dit.** Dix personnes « finance »,
une table « finance » de huit places, quatre tours, et trois plans inventés qui
servent tous 32 places : l'un laisse une personne sans tour servi, l'autre sert
chacun une fois au moins et une personne une fois seulement, le dernier sert
chacun trois tours au moins. Sous « le plus de places servies », les trois sont
égaux sur le critère ; sous « chacun au moins une fois », le premier passe
derrière les deux autres ; sous « l'équité d'abord », le dernier passe devant
les deux autres. Sur une soirée inventée où servir la dernière personne coûte
une collision — des personnes « finance » d'une même organisation, une personne
de cette organisation réservée à la table « finance », « séparer les
organisations » seule cochée, les tours hors objectif au premier palier —,
chaque mode atteint, à trois graines, le plancher que le diagnostic donne de la
valeur qu'il compare d'abord, que la même graine laisse au-dessus sous « le plus
de places servies ». Il refuse le mode lu sur le total seul, le plus de tours
hors objectif mesuré sur s(p) au lieu de P(p) − s(p), et une personne servie par
une réservation comptée jamais servie.

**Un mode qui compare deux valeurs garde son palier.** Sous « chacun au moins
une fois » et « l'équité d'abord », la liste qui joint les tours hors objectif à
un autre critère est refusée, et le choix du mode est refusé tant qu'elle les y
joint. Il refuse le palier mixte accepté sous ces modes.

**Le mode ne touche pas au défaut.** Sans objectif de table, les plans et le
classement des empreintes de référence sont identiques sous les trois modes. Il
refuse la composante d'un mode comptée pour un critère sans objet.

**Une correspondance se décide par la règle.** Sur une petite configuration qui
mêle objectifs de soirée et de tour, règles propres et défaut, tables gelées et
personnes réservées, chaque couple (personne, table, tour) se compare à une
lecture directe du § 4.5. Il refuse l'objectif de tour qui s'ajoute à celui de
la soirée au lieu de le remplacer, et le couple compté possible vers une table
sans siège libre.

**Un palier pondéré classe par sa somme, et le palier suivant ne départage que
l'égalité.** Trois propositions inventées, dont deux égales sur la somme
pondérée d'un palier : la troisième, moins bonne sur ce palier et meilleure sur
le suivant, reste derrière. Il refuse le palier lu critère par critère.

**La borne de diversité tient sur tous les plans**, et s'arbitre par énumération
exhaustive comme le plafond : sur des configurations inventées de quelques
personnes, chaque plan admissible mesure A(p) ≤ A_max(p) et |F(p)| ≤ Φ_aff(p)
pour chacun, et au moins un plan atteint Φ_aff(p) pour une personne. Une seule
organisation partagée par tous donne A_max = 1 à toute personne qui rencontre au
moins une personne ; puis un cas où Φ_aff(p) l'emporte, un où G l'emporte, et un
où (N_aff − g_p) + 1 égale G — chaque autre organisation réduite à une
personne —, sans jamais descendre sous lui (§ 5.5).

**Un point de relevé est le plan d'un compte d'arrêt plus court.** Pour une
graine donnée, la meilleure affectation gardée au point de relevé k égale le
plan que la même graine rend au compte d'arrêt k, à 1, 10, 100 et 1 000
mouvements, sur la petite démonstration et la grande ; et le plan final ne
change pas quand les points de relevé sont gardés. L'épreuve refuse une copie
qui tirerait un nombre ou changerait l'ordre d'acceptation. La course écrite au
compagnon des courses se relit à l'identique (§ 8.6) : une génération écrite,
rouverte, montre les mêmes points, mesurés sous les réglages courants, et le
dernier égale la ligne de la proposition.

**Une dérivée est déterministe, et ne touche pas au chemin ordinaire.** Les
empreintes de référence ne changent pas. À départ, tours figés et graine
égaux, une génération dérivée rend les mêmes plans sur un fil et sur tous, et
la proposition de rang k calculée seule égale celle de la génération entière.
Son point de relevé k égale le plan que le même départ et la même graine
rendent au compte d'arrêt k. Il refuse la génération ordinaire qui tire un
nombre de plus ou de moins, et la dérivée qui tire son placement initial.

**Un tour figé ne bouge pas, relances comprises.** L'épreuve court sur une
instance, une graine et un historique court, écrits une fois dans l'épreuve,
où l'écart au plafond a priori de la meilleure affectation tombe à zéro sans
que le score s'annule — la recherche ne relance que dans l'ordre des
contraintes, et s'arrête sur un score nul — : la petite démonstration, tour 1
figé, ou, si aucune graine ne l'y mène, une instance construite dans
l'épreuve. Elle constate au moins une relance, par le nombre de relances que
la recherche rend aux épreuves, et refuse de passer sans relance. Chaque tour
figé du plan rendu et de chaque point de relevé égale, case par case, celui
du départ, sièges compris sous des sièges attribués ; aucun mouvement évalué
ne tombe dans un tour figé. Il refuse la relance qui tire un placement neuf,
et le tour figé qui ne se reprend qu'au premier départ.

**Une dérivée n'est jamais pire que son départ dans l'ordre de la recherche,
et lui est identique quand rien ne l'améliore.** Partie du plan parfait de la
petite démonstration, la dérivée rend ce plan, et la génération l'écarte comme
identique, l'issue disant que le départ n'avait rien à reprendre. L'épreuve
n'affirme rien du classement, qui peut ranger une dérivée derrière son départ
(§ 5.7).

**Les refus se posent au lancement.** Un départ absent, fautif, en dérive par le
mobilier ou les tours, ou qui ne tient pas une réservation courante, un tour
figé où le départ n'assied pas une personne au siège qu'une réservation courante
lui fixe, tous les tours figés, un tour hors de la soirée : chacun est refusé
avant tout calcul, nommé, avec son remède ; en lecture et sur un plan bloqué, le
refus de la séance passe avant eux. Une réservation à un siège posée après le
départ, dans un tour figé, se refuse au lancement et non à l'enregistrement.
L'application recopie les tours figés du départ, et refuse d'enregistrer une
dérivée dont un tour figé en diffère ; une épreuve atteint ce refus en forçant
le défaut, aucune par un geste. La régénération d'une dérivée sans le plan de
son départ est refusée.

**Sans aucune présence, rien ne change à l'octet près.** L'instance, les plans
à graine égale, les empreintes de référence, les démonstrations, la forme
canonique, les libellés et les détails des codes — `PLACES_MANQUANTES` reste
`{placesManquantes}` — sont ceux d'une soirée sans présence ; chaque épreuve
d'empreinte existante en est le témoin.

**La présence s'éprouve contre une énumération.** Sur de petites instances, la
chaîne `rencontres ≤ plafond réalisé ≤ plafond a priori ≤ |C(p)| ≤ N − 1` tient
contre un oracle qui énumère les itinéraires, et le coût du plafond ne croît pas
avec le nombre de motifs de présence ; les planchers gardés sous l'absence —
collisions, excédent, objectifs — tiennent contre un oracle exhaustif des
affectations, jusqu'à cinq personnes, dans la série `node:long`. Un plan
indexé ne place aucun absent, un absent omis vaut la réserve, et le
vérificateur nomme un absent placé. Une réservation est suspendue aux tours
d'absence, partout de la même façon : le moteur, le CSV et l'application, une
épreuve de propriété comparant l'application au moteur.

**Le départ ajusté est déterministe.** À départ, tours figés, réserves imposées
et graine égaux, la régénération rend, octet pour octet, ce que la génération a
rendu. Aux tours figés, personne ne bouge : une arrivée prend la meilleure
chaise libre, la première table à égalité, ou reste en réserve imposée ; une
épreuve de bout en bout l'éprouve avec et sans sièges attribués. Une propriété
de l'application garde qu'aucun geste sur les participants ne laisse le retenu
en dérive par ses participants, et que « Défaire » reprend le geste et
l'ajustement ensemble.

**Le détail d'un placement ne recompte rien.** Ses doublons d'organisation d'une
case sont non nuls exactement là où les collisions de ce tour et de cette table
le sont ; ses servis des tours somment s(p) ; ses paires répétées ont l'effectif
que compte `mesurer`, choisies et imposées ; ses planchers par tour sont ceux
que le diagnostic rend, leur somme est le plancher des tours hors objectif qu'il
écrit quand il l'écrit, et chacun borne les tours hors objectif de son tour sur
le domaine des planchers ; ses assis sans table possible et ses possibles d'un
tour ne dépassent pas ensemble les présents. Les trois comptes du mélange d'une
table s'emboîtent, sièges ≥ assis ≥ doublons, et chacun des trois ordres des
tables suit le sien.

**Un pourcentage s'écrit par une seule fonction.** Elle rend « — » à
dénominateur nul, 0 à numérateur nul, 100 au numérateur égal au dénominateur, et
entre 1 et 99 partout ailleurs : 259 sur 260 donne 99, 1 sur 300 donne 1.
L'épreuve refuse un pourcentage de la page qui ne sortirait pas d'elle.

**Chaque critère se lit sous sa propre grandeur.** Sous chaque mode des
objectifs, une épreuve parcourt `CRITERES` et confronte chaque composante du
score, complet et incrémental, à la grandeur que l'oracle lit sous le nom du
critère. Elle refuse un critère ajouté sans code, que la recherche lirait sans
lever comme l'écart au plafond, ou inconnu de l'oracle : l'épreuve échoue à son
nom.

#### La géométrie

**Le plan vide donne `k_ajusté = 1 px/cm`, pas `Infinity`.** Il refuse la division
par zéro du § 7.2, que le `transform` accepte sans rien dessiner et sans rien
signaler.

**La borne basse du zoom est relative, et le test le prouve en chiffres.** Sur une
fenêtre de 1 366 × 700 et un plan de 36 m, `k_ajusté ≈ 0,19 px/cm` : le test
affirme **`k_min < 0,2`**, et affirme `k_min = 0,5 × k_ajusté` sur deux plans
d'encombrements très différents. Affirmer `k_min ≤ k_ajusté` serait inutile : avec
un facteur de 0,5 la relation est vraie par construction, y compris si un plancher
absolu a été ajouté — c'est le test qui ne peut pas échouer du § 14.2. Ce qui doit
échouer, c'est le plancher absolu de 0,2.

**Le siège désigné est celui que le dessin a posé, dans les deux régimes de zoom.**
Le test demande au module la position de chaque chaise, puis lui redemande quel
siège contient ce point ; puis vérifie qu'un point du vide entre deux chaises ne
désigne rien. Il le refait **sous le seuil du § 7.3**, où les sièges cessent d'être
des cibles : sans ce second passage, le basculement n'est éprouvé nulle part.

**La découpe du plan en pages est une fonction pure** (§ 11.7) : elle rend N
cadrages contigus et leurs cartouches, et s'éprouve sous `node`. Un navigateur ne
sait pas fragmenter un SVG ; c'est du code qu'il faut éprouver, pas une règle de
style.

**Au niveau navigateur**, la fonction pure est confrontée à
`getScreenCTM().inverse()` sur un rendu réel, à plusieurs `k` et après
défilement de la page, à un millième de pixel d'écran près (§ 7.2). **Les trois
invariants du § 7.2 ont chacun leur test** : que le `<svg>` racine ne porte pas
d'attribut `viewBox` ; que son style calculé donne une bordure et un remplissage
intérieur nuls — `getBoundingClientRect` les inclut, donc l'origine du contenu
s'en décale ; qu'aucun ancêtre, ni lui-même, ne porte de transformation CSS. Il
refuse la feuille de style qui ajoute un jour `transform: translateZ(0)` « pour
la fluidité » : le plan répondrait faux partout, et la cause serait cherchée
dans le module de géométrie.

**Le module des graphiques est frère de celui du plan, et n'en importe rien.**
Les deux ne partagent que le seuil des cibles d'écran de 24 px (§ 7.3), dans un
module à part qui n'importe rien ; une garde de l'arborescence refuse tout autre
import entre eux, dans un sens comme dans l'autre. Ses échelles rendent un pixel
d'écran depuis un rang ou un nombre ; ses graduations sont des entiers ronds
pour des comptes ; son escalier ne trace que des segments horizontaux et
verticaux, un pas par rang ; le rang au plus proche d'une abscisse est borné aux
rangs existants, y compris hors du tracé. L'épreuve refuse une graduation non
entière sur un axe de comptes, et un escalier qui relierait deux rangs en
diagonale.

#### Le stockage

**Le système de fichiers est un paramètre, pas un import** (§ 13.4). Sans
l'implémentation injectée, ni le test du renommage ni les 100 % de branches du
§ 14.13 ne s'écrivent, et les chemins de reprise restent le code le moins éprouvé
du logiciel alors qu'ils sont ceux qui perdent une soirée.

**Les trois implémentations du système de fichiers passent la même suite de
contrat** (§ 13.4) : celle d'épreuve, la coquille devant un vrai dossier, en
série `node:long`, et l'OPFS de Chromium, en série navigateur. Le retrait d'un
dossier y passe ses cas : un dossier vide part, puis son parent devenu vide ;
un absent n'est pas une faute ; un dossier qui porte une entrée se refuse sans
rien perdre ; la racine se refuse, vide ou non ; un fichier à la place du
dossier se refuse. Un dossier qui ne porte qu'un dossier vide se refuse aussi,
et c'est ce cas qui refuse le retrait récursif, lequel les emporterait tous
deux.

**Deux sérialisations du même état sont identiques octet pour octet**, y compris
quand l'état a été construit dans deux ordres d'insertion différents, et y compris
quand les sièges ne sont pas attribués — c'est là que la règle du tri croissant du
§ 8.9 s'éprouve. Il refuse l'ordre de clés hérité de l'itération d'objet et
l'horodatage glissé dans la charge utile.

**Chaque instant du journal se reconstruit.** Après une suite de commandes
dépassant deux frontières d'instantané, le test reconstruit **tous** les instants
et compare chacun à l'état écrit à ce moment. Il refuse l'application de correctifs
juste quarante-neuf fois et fausse au passage de l'instantané — défaut qui
n'apparaît qu'au bout d'une longue séance, c'est-à-dire la veille de l'événement.
Série `node:long`.

**Un journal en avance d'une entrée se rattrape.** Le test écrit la ligne de
journal et n'écrit pas le fichier d'état : l'ouverture compare les révisions et
retrouve le geste. Il refuse la reprise fondée sur la date de modification des
fichiers, que recopier un dossier suffit à fausser.

**Un fichier d'un format plus ancien se refuse sans rien écrire.** Ouvrir, la
liste et chaque secours le disent de format trop ancien, son format nommé,
sans proposer de secours, et aucun octet ne change. Un vrai événement du
format 1 — état, `.precedent` et journal — en est la donnée d'épreuve, dans la
série `node:long`. Il refuse le secours qui écrirait par-dessus le fichier
refusé, et le journal trop ancien qu'un geste remplacerait.

**Une ligne illisible arrête la lecture et annonce le compte.** Journal de cent
entrées corrompu à la trente-septième : trente-six entrées retenues,
soixante-quatre annoncées écartées.

**La dérivation des noms refuse `con` comme `CON`**, donne `Corbeille (2)` à
`Corbeille`, et borne le plus long chemin que l'événement écrit, dossier de
l'événement, planche de badges, corbeille et écriture atomique comprises
(§ 8.6) : le test recompose ce chemin en entier, et échoue sur une borne posée
sur `.gtt.json`, neuf caractères, sur le seul `.gtt-journal.jsonl`, dix-huit,
sur le nom compté une fois, ou qui oublie la planche, la corbeille ou
l'écriture atomique. Elle reçoit la racine en paramètre et son test l'exerce
sur les **deux** dossiers de travail possibles (§ 8.6) ; un nom de 68
caractères ordinaires, la borne de la saisie, y donne un nom de fichier
entier sous le dossier `data` des *Documents*.

**Un renommage atomique qui échoue ne détruit pas la cible.** L'implémentation
d'épreuve échoue au renommage : la cible conserve son contenu antérieur, et le
logiciel nomme le fichier. Il refuse l'écriture qui tronque la cible avant
d'écrire, c'est-à-dire la variante qui perd une soirée quand un agent de
synchronisation tient le fichier ouvert.

**La forme positionnelle du § 8.9 est abîmée délibérément** — une longueur fausse,
un identifiant dupliqué, un identifiant inconnu, un identifiant manquant sans
entrée de réserve, un absent aussi assis — et le logiciel doit nommer chacune et
écarter la **seule** proposition fautive. Un second test **périme**
délibérément : il exclut une personne, change la présence d'une autre, supprime
une table, réduit une capacité, et exige que les propositions touchées soient
**signalées comme dérive et conservées**, jamais écartées, avec les raisons
`PRESENCE_RETIREE` ou `PRESENCE_AJOUTEE` et leurs tours. L'ajustement d'un
placement à la présence est idempotent, et ne laisse aucune raison de
participants pour les personnes qu'il ajuste.

**La dérivation se lit, s'écrit et se défait.** Une proposition sans
dérivation s'écrit comme avant ; une dérivée garde `depart` et `toursFiges`
par l'état, l'instantané et le correctif du journal ; chaque faute de
dérivation du § 8.9 écarte la seule dérivée fautive ; une dérivée dont le
départ est effacé reste comparable, et un retour qui rend le départ rend le
libellé « dérivée de n° X » à son état. Une dérivée d'un départ en dérive par
la présence fait l'aller-retour. Un événement sans absence s'écrit octet pour
octet comme sans `presence` ni `absents`.

**Le coût d'un enregistrement complet se mesure** sur la grande démonstration et
échoue au-delà du seuil du § 8.2. Il écrit sur un système de fichiers réel : série
`node:long`, comme la **sonde d'écriture** du § 8.6, qui ne s'éprouve utilement
contre un système de fichiers réel qu'au moins une fois.

#### L'analyseur CSV

**Un fichier séparé par des virgules n'est pas lu comme séparé par
point-virgule.** Le test affirme que le candidat `;` est écarté parce qu'il donne
**un** champ. Il refuse la règle fondée sur la seule constance, qui importerait
chaque ligne entière dans la colonne `nom` (§ 10.1).

**Un contenu latin encodé en UTF-16 est refusé globalement, avec son remède.** Il
refuse l'ordre à trois temps, dont le mode de défaillance est muet.

**Le collage en bloc et l'import du même contenu rendent les mêmes participants.**
Le test fournit **le même texte décodé** par les deux chemins : un collage ne porte
pas d'octets, et les quatre temps de détection d'encodage ne concernent que
l'import. Il refuse le second analyseur « simplifié » du § 10.2.

**Le rapport d'import nomme chaque groupe d'orthographes fondues.** L'assertion
porte **sur le rapport**, pas seulement sur le résultat fusionné. Il refuse la
fusion silencieuse, qui gonfle G, gonfle A_max avec lui, et qu'aucun indicateur ne
signale.

**Une valeur d'`exclu` hors de la liste fermée refuse la ligne, et la ligne revient
dans le CSV des refus, lequel se réimporte tel quel.** Le test boucle : import,
export des refus, correction d'un champ, réimport. Il refuse le refus global sur
une faute unique, et refuse le fichier de refus qu'il faudrait nettoyer à la main.

**Une étiquette écrite de deux orthographes est une seule étiquette, et le
rapport nomme la fusion.** Il refuse la fusion silencieuse, qui ferait manquer
un objectif à la moitié des personnes visées.

**Les étiquettes font l'aller-retour** : import, export, réimport, mêmes
ensembles. Il refuse un séparateur que l'export écrirait autrement que l'import
le lit.

**Une règle d'objectif hors de la liste fermée refuse la ligne, et la ligne
revient dans le CSV des refus, qui se réimporte tel quel.**

**Une présence hors de la soirée ou illisible refuse la ligne, et la ligne
revient dans le CSV des refus, qui se réimporte tel quel.** Une forme de date
qu'un tableur a faite d'une plage se reconnaît et se nomme. **La présence fait
l'aller-retour** : import, export, réimport, mêmes ensembles, pour chaque
partie non vide des tours de 1 à 6, et un réimport compte zéro personne
modifiée. **Le modèle s'importe sans refus sous tout nombre de tours.** En mise
à jour, une cellule vide garde la présence et une cellule « tous » la retire ;
un aperçu calculé sous un autre nombre de tours ne s'applique pas.

**Une inclusion fautive refuse le fichier entier, et la cause nomme sa ligne,
sa cellule et le nom tel qu'écrit.** Une personne se lit sous le nom que
l'import lui laisse, une personne mise à jour comptée une fois ; un nom que
deux personnes portent ne se départage jamais. **Les inclusions font
l'aller-retour** sous chaque mode, hors d'une inclusion vers un homonyme non
numéroté, que l'export compte, et un réimport en mise à jour compte zéro
personne modifiée.

**Un objectif sur un numéro de table inconnu refuse la ligne, jamais le
fichier.**

#### Le générateur de démonstrations

**Le vecteur du générateur pseudo-aléatoire est rejoué, et il vient de la
publication de référence de l'algorithme.** Un vecteur produit en exécutant
l'implémentation ne prouve rien d'autre que sa stabilité : il fige la transition, y
compris fausse. Pris hors du code, il arbitre. Si l'algorithme retenu ne publie pas
de vecteur, le test change de nature et le dit : il devient un **témoin de
non-régression**, pas un oracle (§ 14.11).

**Le profil d'organisations attendu est lu dans le fichier livré**, jamais écrit à
la main (§ 15.2).

**Le générateur refuse quatre configurations**, chacune son test : zéro
participant, zéro table, une graine dont aucun tour témoin ne se construit, un
compte de groupes dépassant le réservoir de noms.

**Le plan écrit de la petite démonstration atteint 8 pour les douze participants,
zéro paire répétée, zéro collision**, et le logiciel écrit « minimum atteint ». Le
test mesure d'abord ce plan (§ 15.3) — il éprouve les indicateurs contre un
oracle — puis lance la recherche **sous l'ordre du registre, écrit en liste
réglée**, et affirme qu'elle **atteint le même plafond**, sans collision, et que la
première proposition du classement porte « minimum atteint », sans jamais comparer
le plan obtenu au plan écrit (§ 15.5, point 6). Sous cet ordre, l'épreuve lourde
exige l'optimum de **chaque** proposition, sur vingt graines de trois
propositions, dans la petite démonstration comme dans sa variante.

**Sous l'ordre par défaut, la recherche sur ces deux salles se tient par des
planchers, et non par l'optimum de chaque proposition.** C'est l'ordre que reçoit
l'événement qui ne règle rien, et une descente peut s'y arrêter avant l'optimum
(§ 5.7). L'épreuve lourde lance la recherche sans priorités réglées, sur les
mêmes vingt graines de trois propositions, et compte celles qui atteignent
l'optimum, et les graines dont une proposition au moins l'atteint : au moins
**40 sur 60 et 18 sur 20** dans la petite démonstration, **29 sur 60 et 19 sur
20** dans sa variante. Une recherche qui dégrade l'ordre par défaut sur une petite
salle passe sous l'un d'eux.

**La variante 5, 4, 3 annonce au moins quatre collisions cumulées, et au moins une
paire distincte.** Les deux chiffres sont différents et le test les sépare : cinq
personnes ne tiennent pas sur quatre tables sans que deux se retrouvent, donc **au
moins une collision par tour, quatre sur les quatre tours** — mais l'indicateur
« paires de même organisation » compte des **paires distinctes**, et un plan qui
garde les deux mêmes personnes ensemble aux quatre tours n'en affiche qu'**une**.
Affirmer « aucune proposition ne descend sous quatre » sur cet indicateur ferait
échouer le test sur un plan légitime. Un second test tient l'autre bout : le
classement par défaut du § 5.7 **préfère le plan qui répartit**, donc celui dont
l'**excédent** est nul et qui porte quatre paires distinctes, et non celui qui
concentre ses quatre collisions sur une seule paire. Le test compare deux plans
construits à la main — l'un réparti, l'autre concentré — et affirme l'ordre ; il
est l'unique garde contre une réécriture du classement qui le remettrait à
l'envers (§ 5.4).

#### Le PDF

**Un nom portant « Ôjgq » et « Æ » se retrouve caractère par caractère dans la
couche de texte.** Il refuse le sous-ensemble de police qui laisse tomber un glyphe
en silence, et la police sans table `ToUnicode`, dont les accents s'impriment juste
et s'extraient en charabia (§ 11.1).

**La géométrie du quatre-par-page est contrainte, et le test l'affirme telle
qu'elle est** : quatre cellules de 105 × 148 mm exactement, **trois** filets de
coupe — une verticale à 105 mm, une horizontale à 148 mm, une horizontale à 296 mm
qui retire la bande perdue —, et aucun contenu de badge à moins de la zone de
silence d'un axe de coupe ou d'un bord de feuille. Ce ne sont pas deux médianes :
148 n'est pas la médiane de 297.

**La feuille Avery 5392 s'affirme aux cotes du gabarit** : six cartes de 101,6 ×
76,2 mm, deux colonnes et trois rangées, la première à 6,35 mm du bord gauche et
25,4 mm du haut, à 0,01 mm près, et **aucun filet** : les cartes sont
prédécoupées. Sa feuille de contrôle, un PDF à part, porte le contour des six
cartes aux mêmes cotes.

**La pagination s'éprouve sur les comptes qui séparent les deux arrondis, et sur
les deux impositions** : `n = 1, 4, 5, 259, 261` en A4 — jamais 260, où `260 / 4`
tombe juste et où un calcul qui tronque rend la même valeur — et `n = 1, 2, 3,
257` en Lettre, et `n = 1, 6, 7, 257` sur la feuille Avery 5392. Le compte est
celui des **participants non exclus**. Série `node:long`.

**Deux exports du même placement produisent la même couche de texte.** Il refuse
l'horodatage d'export glissé dans le pied de page à la place de celui du placement.
L'assertion porte sur la couche de texte, qui dit ce qui est imprimé ; les octets
s'éprouvent en plus, parce que le logiciel neutralise la date de création — celle
du placement — et l'identifiant de document que la bibliothèque poserait :
deux productions du même modèle rendent le même fichier (§ 14.7).

**Le filigrane BROUILLON se lit dans la couche de texte** d'un plan ni retenu ni
bloqué. Il refuse le filigrane dessiné en image, que personne ne vérifie plus.

**Le niveau `node` est une garde structurelle, à une condition nommée.** Le DOM
n'existe pas, donc un générateur de PDF qui lirait l'écran échoue dès que le test
l'exécute — la garde n'est pas l'environnement seul, elle est l'environnement
**plus** un test qui parcourt le chemin de production ; sans ce test, rien ne lève.
Et elle ne tient que parce que les mesures de texte du badge emploient les
**métriques de la police embarquée** (§ 11.1) : un appel vivant à
`getComputedTextLength` ramènerait le DOM dans le module PDF.

### 14.11 Les oracles, et ce qui n'en est pas

Un **oracle** est une source de la réponse attendue **produite hors du code
éprouvé**. Un **témoin de non-régression** est une valeur produite par le code
lui-même, figée. Les deux sont utiles, ils ne prouvent pas la même chose, et les
confondre fait croire qu'une suite arbitre là où elle ne fait que conserver.

| source | nature | ce qu'elle arbitre |
|---|---|---|
| le plan parfait de la petite démonstration (§ 15.3), vérifié par énumération | **oracle** | les indicateurs |
| `getScreenCTM().inverse()` du moteur de rendu (§ 7.2) | **oracle** | la conversion de coordonnées |
| une énumération exhaustive sur une instance minuscule | **oracle** | la formule du plafond, le diagnostic |
| le vecteur du générateur pseudo-aléatoire | **oracle** s'il vient de la publication de l'algorithme, **témoin** s'il a été produit par l'implémentation | la transition du tirage |
| les fichiers de démonstration livrés et leur empreinte (§ 15.5) | **témoin** — ils sortent du générateur qu'ils éprouvent | que le générateur n'a pas changé |

Le témoin garde sa valeur entière : le § 15.5 veut que la régénération soit un
geste conscient, et un témoin fait exactement cela. Ce qu'il ne fait pas, c'est
dire que le générateur a raison.

**Ce qu'un oracle apporte qu'une assertion écrite à la main n'apporte pas.**

1. **Il ne partage pas l'erreur de lecture de l'auteur.** Une valeur attendue tapée
   dans un test est calculée par la tête qui a écrit le code, sur la même lecture
   de la spécification. Si cette lecture est fausse, le test confirme la faute. Une
   énumération exhaustive sur quatre tables de 5 contredit la formule sans avoir
   rien lu.
2. **Il couvre ce que personne ne penserait à écrire.** Le moteur de rendu donne la
   matrice exacte à **tout** `k`, non aux trois valeurs que l'auteur aurait
   choisies — et ce sont les valeurs non choisies qui cassent.
3. **Il survit à un changement légitime.** Quand la loi de distribution change, le
   fichier livré dit **ce qui a changé** ; un effectif écrit dans le test est remis
   à la main, et la remise à la main est l'endroit où l'on cesse de vérifier.

**Un oracle tiré du code éprouvé n'est pas un oracle.** L'aller-retour CSV du
§ 10.2 en est l'exemple : importer puis exporter prouve que les deux moitiés
s'accordent, jamais qu'elles ont raison — le mode de défaillance du § 13.2. Il
reste utile, et il est **toujours accompagné** d'au moins une donnée d'épreuve dont
le contenu attendu est écrit à la main, ligne par ligne : le fichier de cas limites
du § 10.3.

**Le recalcul complet est l'oracle de l'incrémental**, à la condition du § 13.2 :
le recalcul est la mesure, l'incrémental ne vit que dans la boucle de recherche, et
le test les lie à la fin de chaque recherche.

### 14.12 Les invariants et les tests de propriété

**Le vérificateur d'invariants est du code de l'application, pas du code de test.**
`verifier_invariants(plan, configuration)` rend la liste des violations :

- chaque participant non exclu présent au tour r est assis à **exactement
  une** table à ce tour, ou en réserve quand le plan l'admet — une réserve
  imposée d'un tour figé l'est toujours (§ 5.7) ; aucun participant n'est assis
  ni en réserve à un tour où il est absent ;
- aucun participant n'occupe deux places sur un même tour — distinct du précédent,
  qui ne dit rien de deux sièges à la **même** table ;
- aucune table ne dépasse sa capacité, et aucun siège n'est hors de sa table ;
- chaque réservation est honorée, de portée « tour désigné » comme « tous les
  tours » ;
- aucun participant exclu n'est placé.

Il vit dans le moteur parce que l'application l'appelle : après une génération,
après la commande qui complète un placement partiel, après un retour arrière, et
au chargement d'un fichier. **Un vérificateur appelé seulement par les tests cesse
d'être appelé** ; appelé par les commandes, il refuse au moment du geste, là où le
§ 5.9 veut les refus.

**La garde du § 12.3 est une seconde fonction, de signature différente.**
`verifier_indicateurs(mesures, plafonds_a_priori, plafonds_realises,
complements)` éprouve les **trois** inégalités de la ligne de décomposition du
§ 12.10.5. Avec ses compléments, que seule la page de qualité lui passe, elle
éprouve aussi, sur le domaine des planchers (§ 12.4, § 12.12), le segment
« reste » de chaque organisation et de chaque tour et les conflits
d'organisation du plan contre les conflits imposés (§ 5.6), puis la diversité de
chacun contre ses rencontres et sa borne (§ 5.5) ; la table d'évaluation
l'appelle sans eux. Quand les mesures portent les objectifs des tables ou les
animateurs (§ 5.4), elle éprouve aussi, pour chacun, s(p) ≤ P(p), s(p) ≤ ses
tours assis et m(p) ≤ B(p), puis, sur les totaux, les personnes jamais servies
contre les concernées et le plus de tours hors objectif d'une personne contre le
plus de tours possibles. P(p) ne se compare pas aux tours assis : un plan qui
laisse une personne en réserve à un tour possible le tient au-delà. Quand les
mesures portent les inclusions, elle éprouve sat(p) ≤ I(p) pour chacun, plafond
a priori connu, puis que les inclusions non satisfaites valent les unités
demandées moins les satisfaites, une par unité nommée. Elle ne prend pas un plan
mais des mesures, et ce qu'elle refuse n'est pas un geste mais un **dessin**.
Les deux fonctions vivent dans le moteur, sous la même discipline ; les
confondre obligerait le vérificateur de plan à recevoir des indicateurs qu'il
n'a aucune raison de connaître.

**Le vérificateur est lui-même éprouvé par mutation.** Le test prend un plan
valide, déplace une personne pour qu'elle occupe deux tables au tour 2, et affirme
que le vérificateur signale **cette violation-là** et aucune autre. Une mutation
par invariant listé. Sans cela, un vérificateur qui rend toujours la liste vide
rend verts tous les tests de propriété qui s'appuient sur lui.

**Les tests de propriété valent, et s'écrivent d'abord à la main.** Le corpus
d'entrées existe déjà : le générateur de démonstrations est déterministe et sait
produire une configuration à partir d'une graine. Une boucle sur une grille de
graines et de tailles, appelant les deux vérificateurs, couvre l'essentiel sans
dépendance nouvelle.

**Une bibliothèque de propriétés se justifie à deux endroits du calcul, et
seulement deux** : la formule du plafond et la détection du séparateur. Toutes
deux prennent des entrées petites et combinatoires, toutes deux bénéficient du
**rétrécissement** — quand une configuration à 120 participants échoue, l'outil
rend un contre-exemple à trois tables, là où la réduction manuelle coûte une
heure. Leurs oracles ne sont pas de même nature et le texte ne les confond pas :
le plafond s'arbitre par **énumération exhaustive** ; le séparateur s'arbitre
par **construction** — un tableau de champs engendré, rendu avec un séparateur
connu, et la détection doit le retrouver. Ailleurs, non : une propriété sur la
recherche rejouerait la partie lente et épuiserait le budget du § 14.14.

**Le stockage l'emploie pour deux propriétés de plus, nommées.** L'aller-retour
des correctifs du journal — appliquer à une charge la différence qui mène à une
autre rend l'autre, sur des paires de charges tirées — et la restitution de
chaque instant d'une séance tirée, qui vit dans la série longue parce que ses
séances lancent des générations, à compte d'arrêt court. Leurs entrées sont des
suites d'opérations, où le **rétrécissement** sert comme au plafond : le
contre-exemple rendu tient en quelques opérations.

**La géométrie l'emploie pour une cinquième, nommée : la découpe du plan en
pages** (§ 11.7). Sur des englobants tirés — de dix centimètres à cinq cents
mètres, sur les deux papiers et les trois modes de découpe —, les tuiles sont
contiguës à l'égalité exacte, bord droit contre bord gauche, tiennent dans la
surface utile, couvrent le plan et portent des cartouches cohérents. L'oracle est
la construction : chaque bord se compare à celui de sa voisine. Le
rétrécissement rend un plan de quelques centimètres là où l'échec portait sur
des centaines de mètres.

**Le plancher exact l'emploie pour une sixième, nommée** (§ 5.6). Sur des
charges tirées — deux à cinq organisations, deux à cinq tables de deux à six
places, des conflits, une réservation, une absence —, le minimum que HiGHS rend
pour chaque tour égale celui d'une recherche exhaustive sur les tables, et le
plancher des étoiles, ajouté à la somme par groupe, ne dépasse jamais la somme
des minimums des tours. L'oracle est l'énumération, comme au plafond ;
l'épreuve vit dans la série longue parce que chaque charge passe par le
solveur, et le rétrécissement rend un contre-exemple de quelques personnes. La
liste est fermée : une garde de l'arborescence refuse la bibliothèque hors de
ces six familles.

**La bibliothèque tourne sur une graine fixée.** Une bibliothèque de propriétés
retire par défaut une graine neuve à chaque exécution : le même code échoue une
fois sur dix et passe le reste du temps. Un test capricieux se désactive, et le
désactiver coûte plus cher que le défaut qu'il annonçait. La graine est écrite dans
le dépôt ; un contre-exemple trouvé devient un test nommé à part entière.

**Le piège qu'un test de propriété pose.** Un générateur qui refuse les
configurations difficiles rend la propriété vraie sans rien éprouver. La boucle
**compte les configurations acceptées et échoue sous un plancher** (§ 14.2).

### 14.13 La couverture

**Aucun seuil global.** Un pourcentage d'ensemble se satisfait en couvrant les
modules faciles pendant que les branches qui comptent restent nues : le plafond
d'un participant partiellement fixé, la frontière d'instantané, le renommage qui
échoue. Le chiffre monte, et c'est le chiffre qui cache.

**La couverture se mesure et se publie par module.** Les lignes d'ensemble et
de dossier que le tableau imprime aussi ne décident de rien : aucun seuil ne
les lit. La couverture vaut parce qu'elle **désigne ce qui n'est jamais
exécuté** ; c'est une liste à lire, pas une note.

**Des seuils durs, en branches, sur quinze modules.** Le module des indicateurs
et du plafond, les chemins de reprise du stockage, le registre des critères avec
la règle de correspondance des objectifs, les quatre modules qui calculent la
page de qualité — le détail d'un placement, les paires répétées, la diversité
par animateur et la géométrie des graphiques —, les deux modèles purs qui
mettent en forme sa vue de comparaison — la vue et ses colonnes côte à côte —,
le geste « Comparer » du tableau des propositions, et le départ d'une génération
dérivée, dans l'application comme dans la section de la génération (§ 5.7),
tiennent **100 % de branches**. Ils sont petits, purs — les chemins de reprise à
la condition d'injection du § 13.4 — et chaque branche non couverte y est un cas
que l'opérateur rencontre au pire moment. Ceux de la page de qualité rendent
chaque nombre qu'elle écrit, l'écran ne faisant que les mettre en forme
(§ 12.9) : une branche nue y est un chiffre affiché que rien n'éprouve. Ceux du
départ décident ce qu'une dérivée garde de sa proposition de départ et ce que le
lancement refuse : une branche nue y est un refus ou un tour recopié que rien
n'éprouve. Une branche qu'on ne sait pas couvrir est soit du code mort — on le
retire — soit un cas que la spécification n'a pas prévu — on l'écrit.

**La mesure est sa propre commande**, `make couverture` : la série `node` sous
instrumentation, hors des budgets du § 14.14. Elle publie un tableau par couche
et par module, et un rapport à parcourir qui montre, ligne à ligne, ce qui n'est
jamais exécuté. Les seuils portent sur quinze fichiers —
`src/moteur/indicateurs.js` et `src/moteur/plafond.js`, `src/stockage/depot.js`
et `src/stockage/journal.js`, `src/moteur/criteres.js` et
`src/moteur/correspondance.js`, `src/moteur/qualite.js`, `src/moteur/paires.js`,
`src/moteur/diversite.js`, `src/geometrie/graphique.js`,
`src/interface/qualite/comparaison.js` et `src/interface/qualite/colonnes.js`,
`src/interface/propositions/comparer.js`, `src/application/depart.js` et
`src/interface/generation/depart.js` — et la commande échoue en deçà. Un test de
l'arborescence refuse un seuil abaissé, un seuil global, et un seuil posé sur un
fichier absent ou hors de la mesure : l'outil tiendrait ce dernier pour atteint,
faute de branche à compter. Il refuse de même une commande qui ne mesure pas —
sans instrumentation, la série passe et aucun seuil ne se lit —, une commande
dont les arguments redéfinissent la mesure ou ce qu'elle exécute, un tableau qui
tait les modules pleins, et l'absence du rapport ligne à ligne.

**Ce qui l'empêche de devenir une case à cocher** ne vient pas de l'outil de
couverture :

1. **La clause du § 14.2** — tout test ajouté est montré en échec sur le code
   d'avant. Un test qui n'assert rien ne peut pas être montré en échec. Aucun outil
   ne le vérifie ; l'historique des correctifs, lui, se relit.
2. **Un audit par mutation**, périodique et non bloquant, sur le moteur seul. Un
   mutant survivant sur une ligne couverte à 100 % est la preuve directe que le
   test exécute sans rien affirmer. Il est **sa propre commande**, `make
   mutation`, lancée avant une livraison, avec un résultat écrit — ni dans la
   série surveillée, ni dans `node:long`, parce que son coût est d'un autre ordre
   que les budgets du § 14.14. Un audit que l'on tenterait de faire tenir dans un
   budget ne serait pas fait du tout.
   Chaque mutant se joue sous `node --test`, le repli du § 14.8, contre les
   épreuves de la série `node` qui atteignent son module, et un survivant se
   rejoue contre les épreuves longues qui l'atteignent avant d'être compté.
   Un mutant déclaré équivalent que le délai arrête se rejoue seul, sans
   autre mutant à côté, avant d'être compté : l'audit joue ses mutants
   plusieurs à la fois, et cette charge ne fait pas passer un équivalent lent
   pour une boucle sans fin.
   Le résultat s'écrit sous **`audit/`**, versionné : `mutation-moteur.md`, le
   rapport à lire, et `mutation-moteur.json`, le même à comparer d'un audit à
   l'autre ; `mutants-equivalents.json` y déclare, un par un et avec sa raison,
   les survivants qui ne changent rien et qu'aucune épreuve ne peut donc tuer.
   Un mutant qui ferait tourner sans fin une boucle sur une entrée vide ne se
   tue pas par le délai : l'épreuve garde chaque liste vide de l'instance, et
   le plan, par un mandataire qui lève `RangeError` à la lecture d'un index, si
   bien que le mutant échoue à sa première lecture, qui nomme la liste.
   Le rapport porte la version, le périmètre, l'empreinte des sources et la
   version de Node, jamais la machine ni une date. L'audit ne bloque rien, et
   n'écrit rien quand il n'a pas mesuré.

### 14.14 Le budget de temps

| cycle | budget | au-delà |
|---|---|---|
| relance sous surveillance, après une modification | **2 secondes** | le développeur commence à grouper ses modifications, et le test cesse de désigner laquelle a cassé |
| série `node` surveillée complète, à froid | **10 secondes** | le développeur change de fenêtre ; le retour de contexte coûte plus que l'épreuve, et le niveau glisse vers « avant un commit » |

**La série surveillée s'adapte au nombre de cœurs, et le budget tient sur toute
machine.** À partir de quatre cœurs, des processus complets portent la série
entière. En deçà, le lanceur n'en porterait la série que dans un seul
processus, et la relance qui suit un module de base — celui que presque toutes
les épreuves importent — dépasserait deux secondes. La série s'y joue donc en
threads sur tous les cœurs, et ses épreuves lourdes passent dans la série
`node:long`. Aucune épreuve ne disparaît : elle change de série, et ce qu'elle
éprouve ne dépend pas de la machine. Une garde refuse, dans ces séries, ce
qu'un thread refuserait et qu'un processus accepte, et le lanceur annonce à
chaque exécution le mode qu'il a retenu.

**Pourquoi ces deux valeurs.** En deçà de deux secondes, l'attention reste sur le
code et le résultat se lit comme la suite du geste. Au-delà de dix, elle part
ailleurs ; le niveau `node` cesse d'être lancé à chaque modification, et les
défauts qu'il attrapait se retrouvent par un chemin plus long, souvent au niveau
navigateur, qui ne dit plus quelle ligne les a produits. Ce sont des **budgets**,
c'est-à-dire des seuils de refus — non une prédiction de ce que la suite coûtera,
que seule la mesure du § 14.8 donnera.

**Le budget est tenable par construction.** Quelques centaines de tests sur des
fonctions pures s'exécutent en une fraction de seconde. Le temps part ailleurs :
dans le démarrage du lanceur, et dans trois ou quatre épreuves lourdes. **Dépasser
le budget n'est donc jamais le signe que la suite a grandi** ; c'est le signe qu'un
test a acquis un système de fichiers réel, un minuteur, ou une vraie recherche.

**Les épreuves lourdes sont nommées et rangées à part**, dans la série `node:long`
du § 14.4. **L'audit par mutation n'y est pas** (§ 14.13).

**Deux règles tiennent le budget.** Aucun test de la série surveillée n'attend un
délai — un minuteur est la façon ordinaire dont une série de deux secondes en
devient une de quarante. Aucun n'écrit hors d'un répertoire temporaire, dont le
stockage reçoit le chemin en paramètre : un module qui ne sait pas où il écrit ne
se teste pas en parallèle.

**La mesure est affichée, le refus est généreux.** Le lanceur imprime à chaque
exécution la durée totale et les dix tests les plus lents ; la construction échoue
quand la série surveillée dépasse **trente secondes**. Un refus calé sur le budget
lui-même serait capricieux sur une machine chargée, et un test capricieux se
désactive — ce qui coûte plus cher que le dépassement qu'il annonçait. La série
`node:long` porte son propre plafond, posé après sa première mesure. La dérive se
lit dans la liste bien avant d'être fatale.

**Deux contrôles qui balayent une arborescence sont bornés** : la cohérence des
versions (§ 18.5) et l'appariement captures/manifeste (§ 19.7). Chacun déclare son
périmètre — l'arbre des sources pour l'un, les sources de documentation et le
manifeste pour l'autre —, exclut les dépendances et les sorties de construction,
refuse de passer sur un balayage vide, et est **montré en train d'échouer** :
modifier `version.json` seul fait tomber le premier ; remplacer une image par une
version antérieure fait tomber le second.

### 14.15 Ce que l'exécutable emporte, et ce qu'il n'emporte pas

La suite d'épreuves **n'est pas livrée** : lanceur, données d'épreuve et moteur de
rendu de test sont des dépendances de développement, et les données d'épreuve
contiennent des cas qui n'ont rien à faire chez l'opérateur. Cette propriété est
**gardée**, non supposée, par le test de construction du § 14.9.

Mais le travail d'épreuve laisse **trois pièces dans l'application livrée**, et ce
sont celles que l'exigence « des tests unitaires dans l'application » vise
réellement :

- le **vérificateur d'invariants** du § 14.12, appelé par les commandes et au
  chargement d'un fichier — une incohérence se refuse au moment du geste plutôt que
  de se découvrir sur une feuille imprimée ;
- le **vérificateur d'indicateurs**, qui tient la garde du § 12.3 : la page refuse
  de dessiner une courbe au-dessus de son plafond et le dit ;
- le **contrôle de cohérence** du § 8.8, qui est le même réflexe appliqué au
  fichier : le logiciel refuse d'ouvrir ce qu'il ne peut pas justifier, et le
  nomme.

Ces trois pièces sont du code de production, tenu par les mêmes épreuves que le
reste. Ce qui reste dehors est le harnais, jamais la vérification.

**Le solveur du diagnostic voyage avec la page.** Le module WebAssembly de
HiGHS (§ 5.6), `highs.wasm`, d'environ 3,5 Mo, est émis une seule fois dans
`www/assets/`, octet pour octet celui du paquet, et l'exécutable l'emporte
avec la page ; le travailleur qui le charge forme un morceau différé, jamais
chargé ni préchargé au lancement. Le test de construction tient les trois.
Aucun canal ni protocole de la coquille n'y sert : le travailleur, incrusté
et servi depuis `blob:`, charge le module par son adresse absolue `file://`.
L'essai de démarrage le prouve sous la vraie coquille. Une politique de
sécurité du contenu, que la page n'a pas aujourd'hui, devra admettre
`'wasm-unsafe-eval'` et `worker-src blob: data:`.

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
| organisations | tirées, de 1 à 12 membres |

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

**Les animateurs sont tirés sans égard à leur organisation**, et aucun
regroupement ne leur en impose une commune — sinon chaque mobile accumulerait au
moins 3 redondances qu'aucune recherche ne réduit, et la démonstration vedette
illustrerait une impossibilité. Un test le garde.

**La variante sans exception** — 33 tables toutes à 8, 4 places libres — est
livrée à côté. Quatre sièges de marge rendent au moteur la liberté que la
configuration principale lui refuse ; comparer les deux mesure ce que coûte
l'absence de marge. Dans cette variante, **les tables incomplètes changent d'un
tour à l'autre**, donc le plafond **réalisé** varie d'une proposition à l'autre :
c'est elle, et non la principale, qui est la **configuration témoin de la vue de
comparaison** du § 12.10.6, puisqu'elle est la seule où les escaliers de plafond
diffèrent entre deux propositions.

**La grande démonstration ne décerne jamais « minimum atteint ».** Les tables de 7
offrent 112 sièges-tours dont 16 aux animateurs, donc 96 sièges-tours mobiles
qu'un placement ne peut pas ne pas servir ; chaque mobile n'en absorbant que 4 au
plus, **au moins 24 mobiles** terminent sous leur plafond a priori, et l'écart
d'itinéraire maximal ne descend jamais sous 1 (§ 12.10.4). Le certificat se lisant
contre le plafond a priori (§ 5.5), il est hors d'atteinte ici — et c'est une
propriété de la configuration, non un défaut du moteur.

**Un témoin de pagination à 257 badges** accompagne le catalogue sans en être une
cinquième entrée : c'est une **donnée d'épreuve** (§ 14.9), qui donne 65 planches
A4 et 129 planches Lettre (§ 11.2). Les configurations dont une épreuve ou une
capture d'écran a besoin et que le catalogue ne porte pas se **construisent** par
des scénarios courts (§ 19.3) ; le catalogue reste à **quatre** entrées, et
l'étape qui lit leur nombre le lit dans le catalogue plutôt que de l'écrire.

### 15.2 La distribution des organisations

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
que la table de 10 exigerait 10 organisations distinctes. Le logiciel vérifie
**deux** inégalités — plus gros groupe ≤ nombre de tables, plus grande
capacité − places vides ≤ nombre de groupes — puis **construit un tour
témoin**. Les places vides sont les sièges qui restent une fois chaque membre
assis, zéro quand la salle n'en laisse pas : une table reçoit au moins sa
capacité moins ces places, chacun de ses occupants d'une organisation
différente. Dans une salle exactement pleine, la seconde inégalité se lit
« plus grande capacité ≤ nombre de groupes » ; ailleurs, cette lecture
refuserait à tort deux tables de 3 pour deux membres d'organisations
différentes, qu'un tour sépare. Le générateur **refuse une graine dont aucun
tour témoin ne se construit**.

### 15.3 La petite démonstration — 12 membres

| grandeur | valeur |
|---|---|
| membres | 12 |
| tables | 4, de **3 sièges** |
| tours | 4 |
| réservations | **aucune** |
| organisations | **4, 4, 4**, fixées à la main |

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

Organisations : **A** = {1, 5, 8, 12}, **B** = {2, 4, 9, 11}, **C** = {3, 6, 7,
10}. Chaque table réunit à chaque tour un membre de chacune. **Vérifié par
énumération** : partition valide à chaque tour, zéro paire répétée, chacun
visite les quatre tables, 8 rencontres pour les douze, zéro collision. Le
logiciel doit afficher **« minimum atteint »**, les compteurs de collision et de
répétition **mesurés** à zéro, et la ligne secondaire « ancrés » à **« — »** :
cette démonstration n'ayant aucune réservation, sa population d'ancrés est vide,
et le § 5.4 exige le tiret, jamais zéro.

**La variante « conflit inévitable »** ne change qu'une colonne : organisations
de tailles **5, 4, 3**. Cinq personnes ne se répartissent pas sur quatre tables
sans que deux se retrouvent : **au moins une collision par tour, quatre collisions
cumulées sur les quatre tours**, quel que soit l'algorithme — et **au moins une
paire distincte**, jamais quatre : un plan qui garde les deux mêmes personnes
ensemble aux quatre tours n'en réunit qu'une. Les deux planchers sont dans deux
unités différentes et le logiciel ne les confond jamais (§ 5.4).

Cette variante est aussi l'instance la plus courte où le classement du § 5.7 se
lit : le groupe de 5 porte dix paires possibles pour quatre collisions forcées,
donc l'**excédent n'est pas forcé** — un plan peut répartir ses quatre collisions
sur quatre paires distinctes, et c'est celui que le logiciel met en tête, devant
un plan qui les concentrerait sur une seule.

Une personne déplacée d'un groupe à l'autre fait basculer le logiciel de « minimum
atteint » à « quatre collisions cumulées inévitables » : c'est le contraste le
plus court que la spécification puisse offrir.

### 15.4 Les cas limites, exercés plutôt que supposés

- **Une seule organisation** — la contrainte de séparation est vide de sens : le
  logiciel doit l'annoncer et proposer de la désactiver, non afficher 12
  conflits sans commentaire.
- **Une seule table, un seul tour** — les indicateurs de répétition doivent
  valoir zéro, non lever une erreur de division.
- **Des noms longs** — la grande démonstration contient une poignée de noms
  proches de la limite, dont un de glyphes larges et un à diacritiques. Sans
  eux, une démonstration faite de noms courts laisse les seuils faux jusqu'à la
  première vraie liste.
- **Une personne présente à un seul tour** — ses indicateurs portent sur ce
  tour, et aucun ne la compte absente comme on compterait une réserve.

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
   rang se départagent par leur identifiant entier. **Cette règle vaut pour le
   moteur autant que pour le générateur** : sans elle, le même code et la même
   graine donnent deux placements sur deux moteurs d'exécution, et toute la
   reproductibilité des captures d'écran tombe (§ 19.4).
5. **Le fichier livré est la source de vérité.** Un test rejoue le script
   générateur et compare l'empreinte au fichier livré. **L'empreinte porte sur la
   charge utile, l'en-tête exclu** (§ 8.8) : sans cette restriction,
   `produitVersion` la fait échouer à chaque livraison, et le geste conscient
   qu'elle réclame devient mécanique, donc aveugle. **La régénération devient un
   geste conscient**, et non une dérive qui change les démonstrations sous les
   pieds de l'opérateur. L'échec nomme ce qui a changé.
6. **Le placement, lui, n'est pas figé** : la démonstration fixe les entrées, le
   moteur reste libre. Figer le résultat empêcherait de montrer la comparaison de
   plusieurs propositions, qui est le cœur du logiciel. **Cela ne veut pas dire
   que le moteur dispose d'une source de hasard libre** : il prend une graine et
   un compte d'arrêt (§ 5.7), et à graine et entrée égales il rend le même plan.
   Ce qui n'est pas figé est le **stockage** d'un résultat dans la démonstration,
   pas le déterminisme du calcul.

Les démonstrations ne portent aucune absence, et s'écrivent octet pour octet
comme avant la présence.

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

**Les organisations** : une tête de nom d'organisation — `Ateliers`,
`Coopérative`, `Verrerie` — et une racine forgée. La tête dit immédiatement
qu'il s'agit d'une organisation. Le réservoir se dimensionne sur le **maximum
structurel** : une loi qui peut tirer 260 groupes d'une personne exige 260
combinaisons. Le générateur **refuse** de produire une démonstration dont le
compte de groupes dépasse son réservoir.

Un test vérifie l'unicité et qu'aucun fragment forgé n'apparaît dans le dépôt
**hors des listes du générateur, des fichiers de démonstration, des CSV
d'exemple et du manifeste des captures** (`doc/captures/manifeste.json`,
§ 19.7), qui relève les textes visibles du parcours photographié et porte donc
les noms des démonstrations qu'il joue. Le balayage s'étend aux **données
d'épreuve** (§ 14.9), dont les noms inventés sont disjoints de ce réservoir :
une donnée d'épreuve qui emprunte une racine d'organisation plausible fait
échouer la garde, et c'est ce qui l'empêche de tomber au premier exemple écrit
de bonne foi. Il refuse de passer sur un balayage vide. **Ce test n'établit rien
sur le monde réel** : aucune vérification locale ne peut prouver qu'un nom forgé
ne désigne nulle part une organisation existante.

---

## 16. Livraison

L'exécutable Windows se construit depuis Linux par `electron-builder`, qui
emballe la coquille Electron du projet et le même `www/` que servent les
plateformes de Capacitor (§ 13.1). La construction s'exécute dans un conteneur,
sous une image épinglée par empreinte, de sorte que la machine de développement
n'a rien à installer en dehors du projet. La cible portable n'exige pas Wine :
`electron-builder` édite lui-même les ressources de l'exécutable. L'image n'en
porte donc pas, et une cible qui l'exigerait — un installateur — y échoue au
lieu de produire le livrable que ce paragraphe exclut. Le conteneur ne reçoit
aucune variable de l'hôte, hors des variables de mandataire : un numéro de
construction d'intégration continue y remplacerait le quatrième champ de la
version Windows (§ 18.1). Les variables de mandataire (`http_proxy`,
`https_proxy`, `ftp_proxy`, `no_proxy`, en minuscules comme en majuscules), que
le moteur de conteneurs relaie de lui-même, ne touchent pas à la version, et
derrière un mandataire le téléchargement des dépendances et d'Electron en a
besoin.

**Cette capacité est à vérifier dès la première semaine**, sur un squelette vide,
au même titre que la publication du dossier d'origine par le lanceur portable
(§ 8.6). Découvrir en fin de projet qu'une étape exige une machine Windows coûte
beaucoup plus cher que de le découvrir tout de suite.

Ce qui est livré au client : **un exécutable**, et rien d'autre à installer.
Le paquet ne garde que les traductions des textes propres à Chromium en français
et en anglais des États-Unis, sa langue de repli : l'interface porte ses propres
libellés, et les autres langues alourdiraient l'exécutable sans servir.

**Le livrable est un exécutable portable à fichier unique, non un
installateur**, et ce n'est pas une préférence : la règle du dossier de travail du
§ 8.6 en dépend. Un installateur qui rangerait l'exécutable sous un emplacement de
données applicatives y ferait réussir la sonde d'écriture, et le logiciel créerait
son dossier de données exactement là où le § 8.6 l'interdit.

**La construction refuse de produire un exécutable dont la version n'a pas de
section au changelog** (§ 18.4), et refuse d'écraser un exécutable portant le même
nom dans le dossier de sortie (§ 18.2).

### 16.1 Les documents livrés

| document | contenu |
|---|---|
| `GUIDE-WINDOWS.md` | obtenir l'exécutable, le lancer, **la règle du dossier de travail et ses deux issues** (§ 8.6), la commande qui ouvre ce dossier, comment sauvegarder, que faire si l'antivirus bloque, **où lire la version** et comment signaler un problème |
| `GUIDE-USAGE.md` | le parcours d'une soirée, de la liste de participants à l'impression, écran par écran |
| `CHANGELOG.md` | ce qui change d'une version à l'autre, et ce qu'il faut faire en remplaçant (§ 18.4) |

**Le `GUIDE-USAGE.md` suit les douze étapes du § 2.1**, et le scénario de pilotage
les implémente : chaque capture d'écran déclare l'étape à laquelle elle
appartient, et un contrôle du niveau `node` échoue si une étape n'a aucune
capture, ou si l'ordre des captures contredit l'ordre des étapes (§ 19.3). Deux
sources pour une même séquence sont le mode de défaillance que toute cette
spécification combat — à ceci près qu'il est ici mécaniquement détectable, donc
qu'il se **garde** au lieu de se surveiller. La liste des écrans est celle du
§ 19.3.

**`GUIDE-WINDOWS.md` sort de la boucle d'engendrement** (§ 19.8) : le pilotage
s'exécute sur `web` sous Linux, et les écrans que ce guide décrit appartiennent
à `electron` sous Windows. Il **ne cite jamais un nom d'exécutable complet** : il
cite le **gabarit** et désigne « le fichier dont le nom commence par
`gestion_table_tournante_libre_v` » — un nom daté change à chaque livraison, et
une phrase qui en cite un envoie l'opérateur chercher un fichier qui n'existe pas.
Il n'écrit pas davantage de phrase fixe sur l'emplacement des fichiers : il énonce
la règle du § 8.6, ses deux issues, et la commande qui ouvre le dossier.

Le guide d'usage se rédige **à partir des configurations de démonstration**, pour
que le lecteur reproduise exactement ce qu'il lit. Il est relu par quelqu'un qui
n'a pas écrit le logiciel ; un guide relu par son auteur ne révèle aucune étape
manquante.

### 16.2 Le poste de développement

Le projet s'installe et se lance d'une commande, la même sur chaque système
Linux, NixOS compris, et sous macOS ; Windows a la sienne. Une étape laissée à
la main est celle qu'un nouveau venu oublie, sans savoir ensuite laquelle.

| commande | ce qu'elle fait |
|---|---|
| `./install.sh` | pose les paquets du système qui manquent — par apt, dnf, zypper ou pacman, sous `sudo` —, puis le Node du projet et les dépendances que fixe `package-lock.json` ; relancée, ne refait que ce qui manque |
| `./install_dev.sh` | ajoute le Chromium des épreuves du navigateur, des polices et, sur amd64, `podman`, sous lequel se construit l'exécutable |
| `./run.sh` | lance la coquille Electron sur une session graphique ; sans écran, ou là où Electron n'est pas publié, sert l'application à un navigateur par le serveur de Vite |
| `make` | lance l'application comme `./run.sh` ; `make help` nomme les autres cibles — les trois séries d'épreuves, la couverture et l'audit par mutation (§ 14.13), le banc de mesure (§ 19.10), les captures d'écran (§ 19.5), la construction, le contrôle de version (§ 18.5), l'essai de démarrage |

**Le Node du projet a une seule source** : la majeure écrite dans
`.node-version`, que lisent les scripts bash, les scripts PowerShell et
`shell.nix`. L'installation télécharge cette version de nodejs.org, la vérifie
contre sa somme et la range hors du dépôt, dans le dossier de l'utilisateur :
elle n'exige aucun droit d'administration et ne dépend pas du Node que porte —
ou ne porte pas — le système. Chaque cible du `Makefile` passe par ce Node.

**Sous Windows**, `install.cmd`, `install_dev.cmd` et `run.cmd` passent la main à
des scripts PowerShell 5.1, la version que porte tout Windows. **Sous NixOS**,
où les binaires téléchargés ne trouvent ni leur chargeur ni leurs bibliothèques
aux chemins qu'ils attendent, `scripts/installation/shell.nix` déclare Node,
Electron et Chromium d'un nixpkgs épinglé par révision et par somme ; les scripts
du projet s'y relancent d'eux-mêmes.

**`make verifier_systemes` éprouve l'installation elle-même.** Sur chaque système
du catalogue — les familles Debian, Fedora, openSUSE et Arch, et Nix —, un
conteneur `podman` exécute, sous un compte ordinaire qui passe par `sudo`,
`./install_dev.sh`, puis les trois séries d'épreuves, l'essai de démarrage
d'Electron et le serveur de Vite ; les scripts PowerShell s'y éprouvent sous
`pwsh`. Ce qu'un conteneur n'éprouve pas est nommé, et reste à vérifier sur une
machine : le bac à sable d'Electron, une autre architecture que celle de l'hôte,
NixOS lui-même, une vraie session graphique, Windows et macOS réels.

---

## 17. Ce que ce document ne tranche pas

Les numéros ne bougent pas : ils sont cités ailleurs. Cinq points sont désormais
tranchés et le disent ; un a reçu son **propriétaire** et son protocole sans que
sa valeur soit encore relevée ; un seul reste entièrement ouvert.

1. **TRANCHÉ — le format de stockage des placements.** La saisie reste en champs
   nommés, les placements engendrés passent à la **forme positionnelle** : § 8.9.
2. **TRANCHÉ — la bibliothèque PDF est `pdf-lib`, sa police lue par `fontkit` ;
   l'outil d'extraction est `pdfjs-dist`.** La question de l'ingestion du SVG
   avait disparu : la bibliothèque ne dessine que du texte, des filets, des
   rectangles et le PNG du logo d'un participant (§ 11.1). `pdf-lib` tient le cahier des charges étroit qui restait :
   exécution sous `node`, police embarquée en latin étendu et en sous-ensemble,
   table `ToUnicode` écrite, boîte de page exacte, couche de texte extractible, et
   la liberté de ne poser ni date lue à l'horloge, ni identifiant de document, ni
   producteur — la date du document est l'horodatage du placement (§ 14.7).
   `pdfjs-dist` lit sous `node` la couche de texte, les traits et les boîtes dont
   le test dépend entièrement, et trame les pages des captures d'écran du
   § 19.6. Le solveur du plancher exact du diagnostic, `highs` (highs-js,
   qui compile HiGHS en WebAssembly), les rejoint aux mêmes
   conditions. Toutes sont des dépendances de développement épinglées à leur
   version exacte : Vite incorpore au paquet ce que la page importe, et rien
   d'autre. Leurs avis, et ceux des œuvres que leur construction publiée
   incorpore, vont dans `public/licences/TIERS.txt`, qui voyage avec la page.
3. **TRANCHÉ — la désignation des animateurs est manuelle, hors de la création
   des tables.** Seule « Créer les tables… » répartit des animateurs, sur les
   tables qu'elle crée, pour les personnes que la marque de l'animation
   réservée dit à désigner. Une table existante, l'opérateur la pourvoit
   lui-même : § 5.8 et § 2.1, étape 6.
4. **TRANCHÉ — mesuré : le coût de la maximisation du plafond a priori** sur
   les itinéraires admissibles. Sous `node`, sur la grande démonstration et sa
   variante, le plafond a priori coûte de l'ordre d'un dixième de milliseconde,
   le diagnostic de l'ordre d'une milliseconde ; sur une configuration
   pessimiste — 260 signatures distinctes, 10 tours — une dizaine de
   millisecondes chacun, sur un processeur de bureau récent. Le point porte trois
   usages — le diagnostic, le troisième chiffre de la page de qualité et le
   départage du § 5.7 —, et le plafond a priori par personne se calcule donc à
   chaque évaluation ; le chemin « inconnu » reste celui du moteur, que
   l'application n'emprunte pas. Le relevé est `scripts/banc/plafond.js`, la
   garde `src/moteur/plafond.long.test.js`.
5. **TRANCHÉ — la comparaison trace le manque.** § 12.10, et sa configuration
   témoin est la variante sans exception (§ 15.1).
6. **Le seuil de zoom qui retire les listes de noms est un seuil de lisibilité,
   et son propriétaire est le niveau manuel.** Le coût des listes ne dépend pas du
   zoom : un temps par image ne dit donc pas où les retirer. `K_LISTES` se relève
   sur la machine de référence — le plus petit zoom où une personne qui n'a pas
   écrit le logiciel lit les listes de la grande démonstration —, et garde son
   défaut de travail, 0,30 px/cm, jusqu'à ce relevé. Le banc du § 19.10 relève
   le **temps par image** comme une **garde**, non comme un arbitre : listes
   forcées, à plusieurs zooms, sur les 33 tables, sous un processeur ralenti ; un
   temps au-delà de son critère fait échouer le banc, il ne déplace pas le seuil.
   Aucune capture d'écran ne le mesure — une image est muette sur la durée qui
   l'a produite. Sa valeur de travail a déjà une conséquence visible : sur un
   écran de 1 366 × 700, la grande démonstration s'ajuste sous elle et s'ouvre
   sans listes de noms, qui se dessinent en rapprochant la vue (§ 7.7).
7. **OUVERT, et hors périmètre de la première itération — les dégagements de
   référence d'une salle.** Le mot « conforme » reste absent de l'interface et la
   mention « disposition relative » reste sur chaque impression du plan (§ 7.7).
   L'unité étant déjà le centimètre réel, l'ajouter plus tard ne coûte **aucune
   migration**.

---

## 18. La version, le nom du livrable, le changelog

Le logiciel se livre comme un fichier unique que l'opérateur copie lui-même. Il
n'existe ni dépôt de paquets, ni mise à jour automatique, ni canal par lequel le
logiciel pourrait annoncer son âge. Ce qui permet de dire *laquelle de ces copies
est laquelle* tient donc entièrement dans le **nom du fichier**, dans ce que
**l'application affiche** et dans le **changelog** — et cette section existe pour
que ces endroits ne puissent pas se contredire.

### 18.1 Le schéma : `AAAA.MM.JJ.NN`

Une version est **la date de la livraison suivie d'un rang dans la journée**, sur
quatre champs, tous présents, tous à longueur fixe :

```
2026.10.05.01        première livraison du 5 octobre 2026
2026.10.05.02        seconde livraison du même jour
2026.01.05.01        5 janvier 2026 — le mois garde son zéro de tête
```

Les quatre champs sont **toujours** écrits : l'année sur 4 chiffres, le mois et le
jour sur 2, le rang sur 2, zéros de tête compris. Un format qui change de forme
entre deux livraisons — le rang n'apparaissant qu'à partir de la seconde — casse
le tri d'un dossier, la comparaison de deux noms et l'expression régulière du
contrôle du § 18.5.

**Pourquoi la date.** L'opérateur et celui qui reçoit son signalement n'ont qu'une
chose en commun : le moment où le fichier a été envoyé. Un numéro de publication
oblige à ouvrir le changelog pour savoir s'il est vieux de trois jours ou de trois
mois. `AAAA.MM` ne suffit pas : pendant la préparation d'un événement, plusieurs
livraisons dans le même mois sont la règle.

**Pourquoi pas un versionnage sémantique.** Personne ne consomme ce logiciel comme
une dépendance : il n'y a ni interface de programmation publiée, ni résolution de
contraintes, ni arbitre pour trancher « est-ce un changement cassant ». Un champ
majeur mal choisi est une erreur muette, qu'aucun contrôle ne peut relever. Ce que
le versionnage sémantique servirait à dire ici — « ce que tu enregistres
aujourd'hui, la version d'hier ne le modifiera plus » — est dit par la **version
de format des fichiers** du § 8.8, qui est un nombre distinct et le reste
(§ 18.4).

**L'ordre.** Deux versions se comparent champ par champ comme quatre entiers. Les
champs étant à longueur fixe, l'ordre alphabétique des noms de fichiers coïncide
avec l'ordre chronologique : un opérateur qui trie son dossier par nom lit sa
version courante sur la dernière ligne, sans rien savoir du schéma.

**Le rang.** Il repart à `01` chaque jour et ne décroît jamais. Un numéro est
**consommé au moment où l'exécutable quitte la machine qui l'a construit**, et
cesse alors d'être réutilisable : deux binaires différents répondant à un même
nom, chacun dans une main différente, rendent irréparable le seul moment qui
compte — l'opérateur qui décrit un défaut en nommant sa version. Un exécutable
construit puis jeté sans être envoyé n'a consommé aucun numéro.

**Le rang plafonne à 99.** La construction refuse le centième et le dit. Élargir
le champ détruirait la propriété de tri que toute la section achète, et cent
livraisons dans une journée désignent un autre problème que le format du numéro.

**La forme technique.** Le fichier de description du projet, `package.json`,
exige trois champs entiers **sans zéro de tête** — le format de version qu'il
valide refuse `0105` — et `electron-builder` en tire la ressource de version de
l'exécutable Windows. Le logiciel dérive donc le mois et le jour en **un entier**,
`MM × 100 + JJ`, écrit sans remplissage, et le rang en entier :

```
version affichée   2026.10.05.01      2026.01.05.01
version technique  2026.1005.1        2026.105.1       (AAAA . MM×100+JJ . NN)
version Windows    2026.1005.1.0      2026.105.1.0
```

La dérivation est **monotone** — `MM × 100 + JJ` croît strictement avec la date,
donc `2026.105.1 < 2026.1005.1 < 2026.1231.1 < 2027.105.1` — et **bijective** : le
jour étant inférieur à 100, un entier se redécompose d'une seule façon. Un
contrôle refait le trajet dans les deux sens et refuse une divergence. Les trois
nombres tiennent dans les **16 bits** que le format de ressources Windows impose à
chacun de ses quatre champs : l'année, `MM × 100 + JJ` qui vaut au plus 1231, et
le rang.

**Quand la plateforme `android` sera ajoutée**, son `versionCode`, un entier
unique, dérivera de la même source sous la forme `AAMMJJNN` sur huit chiffres —
`26100501` —, monotone et sous la borne de 2 100 000 000 qu'impose la
plateforme, et rejoindra le contrôle du § 18.5.

**La longueur fixe ne vaut que pour la forme affichée et pour le nom de fichier**,
qui sont les seules qu'un humain trie. La forme technique n'est jamais lue par
l'opérateur et n'est jamais triée.

### 18.2 Le nom du livrable

```
gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe
gestion_table_tournante_libre_v2026_10_05_01.exe
```

Les séparateurs de la version deviennent des **soulignés**. Le nom ne contient
alors **qu'un seul point**, celui de l'extension : tout outil qui coupe un nom à
son dernier point, et le réglage de Windows qui masque les extensions connues,
laissent la version entière visible. Un nom portant `v2026.10.05.01` la ferait
amputer par les outils qui coupent au **premier** point.

**Le nom n'est jamais saisi.** Il est **calculé** à la construction depuis
l'unique source du § 18.3, par substitution des points par des soulignés. Un nom
tapé à la main finit par mentir sur son contenu, et le signalement arrive sur
cette copie-là.

La construction **refuse d'écraser un exécutable portant le même nom** dans le
dossier de sortie. Ce refus est un garde-fou local — le § 18.5 énonce ce qu'il ne
couvre pas — et une option explicite le lève pour reconstruire un numéro qui n'a
pas été livré. `./create_exe.sh` remplace ce refus par une **question posée au
terminal** : « oui » passe l'option, toute autre réponse laisse l'exécutable en
place. Sans terminal, la réponse est non, et `GTT_OUI=1`, qui répond oui d'avance
aux questions de l'installation, **ne répond pas à celle-ci** : écraser un numéro
qui a peut-être quitté la machine se décide à la main, ou par l'option.

**Le guide ne cite jamais un nom complet, il cite le gabarit** (§ 16.1).

### 18.3 Une seule source, cinq destinations

La version est écrite **à un seul endroit**, un fichier `version.json` à la racine
du projet :

```json
{ "version": "2026.10.05.01" }
```

Tout le reste en dérive, par un script de construction :

| destination | forme | usage |
|---|---|---|
| `package.json` | technique | ce qu'exigent npm et `electron-builder`, qui en tire la ressource de version Windows |
| `package-lock.json`, champ `version` et celui du paquet racine, `packages[""].version` | technique | ce que npm recopie de `package.json` dans son verrou ; le point 1 du § 18.5 le contrôle comme `package.json` |
| nom de l'exécutable, posé dans la configuration d'`electron-builder` | soulignés | ce que l'opérateur voit dans son dossier |
| `src/version.genere.js` | affichée **et** technique | ce que l'application affiche |
| titre de la section de tête du `CHANGELOG.md` | affichée | ce que l'opérateur lit avant de remplacer |

**Le module engendré est versionné dans le dépôt**, et un contrôle rejoue le
script puis compare — la même discipline qu'au § 15.5 pour les fichiers de
démonstration (§ 13.1).

**Le module engendré ne porte que la version.** La **provenance de la
construction** — livraison, séance de développement, ou construction de
documentation — est le mode de construction que pose la commande qui construit,
celui de Vite, que l'application reçoit avec ses dépendances ; elle n'est jamais
lue dans l'horloge ni dans l'environnement du poste. Sans elle, une capture
d'écran prise pendant le développement annonce un numéro déjà livré, et le
diagnostic porte sur un binaire que personne ne détient.

### 18.4 Le `CHANGELOG.md`

**Son lecteur est l'opérateur qui décide s'il remplace son exécutable.** Il est
rédigé en français, la version la plus récente en tête, et il n'est jamais
tronqué.

Une section par version :

```markdown
## 2026.10.05.01 — 5 octobre 2026

**Ce qui change pour vous**
- Le plan de salle se recadre sur la table sélectionnée.
- L'import d'un tableur accepte la tabulation comme séparateur.

**Ce qui est corrigé**
- Un nom portant des accents, importé depuis un tableur enregistré par un
  logiciel qui n'annonce pas son encodage, s'affichait avec des caractères
  parasites sur le plan imprimé.
- Une table ramenée à sa capacité par la poignée pouvait désasseoir une personne
  à un tour qui n'était pas affiché.

**Version de format des fichiers** : inchangée.

**En remplaçant** : rien à faire. Copier le nouvel exécutable par-dessus
l'ancien ; les événements déjà enregistrés s'ouvrent sans manipulation.
```

La date en toutes lettres du titre n'est pas une seconde source : le contrôle la
**réengendre** depuis la version et compare.

Les deux premières rubriques s'omettent quand elles sont vides. **Les deux
dernières lignes sont obligatoires** : ce sont celles qui répondent à la question
que l'opérateur se pose. Une rubrique absente se lit comme un oubli ; un « rien à
faire » écrit est une réponse.

La ligne de format est obligatoire parce qu'elle seule annonce un échange devenu à
sens unique. Quand la version de format monte, la nouvelle version **refuse** un
fichier d'un format plus ancien (§ 8.8), et l'ancienne version n'ouvre qu'en
lecture seule un fichier de la nouvelle. La ligne dit donc, dans ce cas, quels
fichiers ne s'ouvrent plus, pour que l'opérateur garde l'ancienne version tant
qu'il en a besoin.

**L'épreuve de ce qui entre.** Une ligne du changelog a pour sujet **ce que
l'opérateur voit, fait ou subit**. Une ligne dont le sujet est un module, un
fichier source, une bibliothèque ou un test n'y entre pas : ce récit vit dans
l'historique du dépôt. Une correction se décrit **par son symptôme visible** — « les
accents s'affichaient de travers sur le plan imprimé » — et non par sa cause dans
le code : l'opérateur reconnaît ce qu'il a vécu, pas ce qui l'a produit.

**Il n'existe aucune section « à venir ».** Une version existe lorsqu'un exécutable
a été livré. Une section d'intentions transforme le fichier en feuille de route, et
l'opérateur cesse de lire la première section comme « ce que je peux avoir ».

La section de tête s'écrit donc **au moment de la livraison**. La commande de
livraison **refuse de construire** si la section de tête manque, si son titre ne
reproduit pas la version de `version.json`, si son corps est vide, ou si l'une des
deux lignes obligatoires manque. Une livraison dont le motif n'est écrit nulle part
est une livraison dont l'opérateur ne peut pas décider.

### 18.5 Le contrôle qui interdit la divergence

Chaque endroit où un chiffre se recopie est une occasion de diverger. Un contrôle
de la série `node` surveillée (§ 14.4) **échoue** quand :

1. la version technique de `package.json`, ou l'un des deux champs de version
   de `package-lock.json`, n'est pas celle que la dérivation du § 18.1 produit
   depuis `version.json`, ou ne se redécompose pas en la version affichée, ou
   le verrou manque ;
2. le module engendré ne reproduit pas, caractère pour caractère, ce que le script
   réengendre ;
3. le titre de la première section du `CHANGELOG.md` n'est pas la version
   courante, sa date en toutes lettres n'est pas celle que la version engendre, ou
   son corps n'a pas ses deux lignes obligatoires ;
4. les sections du changelog ne sont pas en ordre strictement décroissant, ou deux
   sections portent la même version ;
5. la date inscrite dans la version dépasse de plus d'un jour la date civile locale
   de la machine qui construit. La tolérance absorbe l'écart de fuseau ; ce que le
   contrôle attrape est une année ou un mois tapé de travers, pas une minute ;
6. une chaîne **de la forme affichée** apparaît ailleurs que dans `version.json`,
   le module engendré et le changelog, ou une chaîne **de la forme technique**
   ailleurs que dans `package.json`, `package-lock.json` et le module engendré.
   Le verrou est hors du balayage, comme `version.json`, le module et le
   changelog, que les points 1 à 3 contrôlent : la version s'y recopie par
   construction ;
7. un document construit porte le littéral `#_#`, ou cite un nom d'exécutable qui
   **ne se conforme pas au gabarit** du § 18.2. Un gabarit non substitué se lit
   comme un nom de fichier et envoie l'opérateur chercher un fichier qui n'existe
   pas. Le contrôle ne peut pas exiger qu'un nom cité **figure parmi les sorties de
   la construction** : un gabarit ne satisfait par construction jamais cette
   condition, et la seule formulation qui tienne échouerait ;
8. son balayage ne trouve **aucun** fichier à examiner (§ 14.2).

**Le périmètre du balayage du point 6 se pose à l'écriture du contrôle, pas
après.** Il porte sur **l'arbre des sources, les fichiers de configuration et les
scripts de construction**, à l'exclusion des **données engendrées** — fichiers de
démonstration qui portent `produitVersion`, manifeste des captures d'écran,
données d'épreuve —, des guides, des épreuves de la dérivation elle-même qui citent
des exemples par nécessité, des dépendances et des sorties de construction. Sans
cette exclusion le contrôle échoue au premier jour, et un contrôle qui échoue en
permanence se désactive.

Un contrôle de fin de construction lit le nom du fichier réellement produit et
exige qu'il dérive de la même source. Ces contrôles se montrent en train d'échouer
(§ 14.2) : modifier `version.json` seul fait tomber les points 1, 2 et 3, et
l'échec nomme lequel des endroits est resté en arrière.

**Ce que ces contrôles ne couvrent pas, et qui reste un geste humain.**
Reconstruire après une modification du code **sans** changer `version.json` produit
un second binaire sous un numéro déjà livré, et aucun des huit points ne le voit :
le changelog n'a pas changé non plus, donc tout s'accorde. Le refus d'écrasement du
§ 18.2 n'attrape le cas que si l'exécutable précédent est encore dans le dossier de
sortie. La discipline qui tient réellement est celle du § 18.4 : livrer exige
d'écrire une section, et écrire une section pour une version déjà publiée fait
échouer le point 4.

**Le déterminisme n'est pas entamé** (§ 14.7). La version est une **constante
engendrée à la construction**, jamais une lecture d'horloge à l'exécution. Le
moteur et le générateur de démonstrations ne la lisent pas. Le script de
construction, lui, lit la date civile au point 5 ; il n'appartient ni au moteur ni
au générateur, sur lesquels seuls porte l'interdit.

### 18.6 Où la version se voit

Un opérateur qui signale un défaut sans pouvoir dire sa version coûte un
aller-retour complet : la première réponse n'est pas un diagnostic, c'est une
question. Le logiciel fait donc en sorte qu'on n'ait pas à la chercher.

| endroit | forme |
|---|---|
| **bandeau d'application**, sur tout écran (§ 8.4) | `2026.10.05.01`, avec la provenance et — quand un plan est ouvert — le libellé de mode |
| **premier écran** (§ 8.1), liste des événements comme répertoire vide | `version 2026.10.05.01`, ou la marque de provenance d'une construction de documentation |
| **titre de la fenêtre** | `Gestion table tournante Libre — 2026.10.05.01` |
| **panneau « À propos »** | un bloc d'une ligne que l'opérateur **copie**, sous l'éditeur et l'auteur |
| **pied de chaque page imprimée** (§ 11.7) | la version, à côté de l'horodatage du placement |
| **en-tête du fichier d'état** (§ 8.8) | champ `produitVersion` |

**Le bandeau d'application est le porteur principal, et le titre de fenêtre son
complément.** Un signalement arrive le plus souvent sous forme d'image, et une
capture faite à la touche d'impression d'écran, ou cadrée sur le défaut, ne
contient pas toujours la barre de titre du système — elle ne la contient jamais sur
la plateforme `web`, où le titre est celui d'un onglet. Un bandeau dessiné par
l'application est dans l'image quel que soit le cadrage. Le § 8.4 impose en plus une
bande de mode **sous le bandeau** et un libellé de mode à côté de la place fixe : ils
coexistent, la bande et le libellé signalant le mode dans l'écran de l'événement, le
bandeau portant la version jusque sur la liste des événements.

**Le bandeau annonce aussi la version de format du fichier ouvert** quand elle
est plus récente que celle que le binaire écrit : « ce fichier s'ouvre en lecture
seule ». Un fichier d'un format plus ancien ne s'ouvre pas (§ 8.8) : le refus le
dit, et le bandeau n'a rien à annoncer. Le changelog annonce le changement de
format à la livraison ; le bandeau l'annonce au moment où l'opérateur ouvre le
fichier.

**Le bloc copiable** du panneau « À propos » tient en une ligne — nom du
produit, version affichée, plateforme, provenance de la construction, version de
format des fichiers, séparés par « · » — et se colle dans un courriel. Un
chiffre recopié à la main se recopie faux. Il ne porte que la version affichée,
`2026.10.05.01`, celle du changelog et du nom du livrable : la forme Windows,
`2026.1005.1.0`, reste dans la fiche de propriétés du fichier, et le guide
Windows renvoie au nom de l'exécutable pour la version.
Au-dessus du bloc, le panneau nomme l'éditeur, **TechnoLibre Inc.**, et l'auteur,
**Mathieu Benoit**, développeur, concepteur et mainteneur du logiciel ; « Copier »
ne les emporte pas.

**Le reste du panneau « À propos ».** Au-dessus de l'éditeur, le **logo de
TechnoLibre** : un clic ouvre un petit menu, « Télécharger en SVG » et
« Télécharger en PNG », dont chaque commande enregistre les octets exacts du
fichier que l'éditeur fournit, par l'enregistrement commun du logiciel. Le
chemin écrit se dit sous le logo ; un enregistrement refusé — un dossier où
rien ne s'écrit — s'y dit aussi, comme tout refus d'écriture, et le
téléchargement suivant le retire. Le logo se charge à part, et le lancement ne
le lit pas. Sous l'éditeur, le lien vers son site, `https://technolibre.ca` ;
sous l'auteur, le lien vers le code source du projet. Suivent quatre cartes :

- l'**attribution**, une demande de courtoisie — afficher le logo de
  TechnoLibre sur les badges, puis un lien vers son site — qui n'ajoute aucune
  condition à la licence ;
- la **licence** : le choix entre l'AGPL-3.0-or-later et la LiLiQ-R+,
  l'identifiant SPDX `AGPL-3.0-or-later OR LiLiQ-Rplus-1.1` — celui que
  déclarent `package.json` et l'en-tête de chaque fichier source, et dont le
  dossier `LICENSES/` des sources porte les deux textes —, ce que demande la
  licence choisie, la permission additionnelle à la LiLiQ-R+ — écrite dans la
  notice `LICENSE`, par laquelle TechnoLibre Inc., titulaire du droit
  d'auteur, permet de distribuer le logiciel combiné à des composants sous
  licence libre permissive, comme ceux qu'il incorpore —, les liens vers les
  deux textes officiels, et les deux textes complets, livrés avec le logiciel
  et lisibles sur place, sans réseau, un à la fois ;
- les **composants tiers et leurs licences** : chaque œuvre que la page
  incorpore, tirée de `public/licences/TIERS.txt` et de lui seul — aucune
  liste n'est recopiée —, son nom, sa version et sa licence, les œuvres
  qu'un paquet incorpore regroupées en retrait sous lui ; « Lire la licence »
  montre le texte de sa section — celui de `NotoSans-OFL.txt` pour la
  police — sous son entrée, dans un bloc pareil à celui des licences du
  logiciel, un seul texte à la fois dans tout le panneau. La liste se charge à l'ouverture du panneau,
  dans le morceau des textes de licence, que le lancement ne lit pas ; un
  chargement qui échoue le dit et renvoie au fichier livré ;
- le **sommaire des fonctionnalités** du § 2.2, par catégorie, chaque numéro
  devant son intitulé.

**Un lien ne fait jamais naviguer la fenêtre de l'application.** Chacun s'ouvre
dans une nouvelle fenêtre, sans ouvreur ni référent : un nouvel onglet sur
`web` ; sous `electron`, la coquille refuse toute fenêtre et toute navigation,
et passe au navigateur du système l'adresse cliquée quand elle est exactement
l'une des quatre adresses https du panneau (§ 2). Une autre adresse n'ouvre
rien. Hors de Windows et de macOS, l'adresse passe par l'ouvreur du bureau,
celui qui montre un dossier (§ 8.6), dont la coquille attend l'issue ; ailleurs,
par le navigateur que désigne le système. Dans les deux cas, l'issue revient à
la page : une ouverture qui échoue se dit dans le panneau, sous les liens de la
carte qui porte le lien, par le texte de l'explorateur qui ne s'ouvre pas —
l'ouverture a échoué, avec sa raison —, et le même lien ouvert ensuite le
retire.

**Le panneau « Paramètres »** s'ouvre du bandeau, par la commande placée juste à
gauche de « À propos », et remplace l'écran comme lui ; les deux ne sont jamais
ouverts ensemble, et « Fermer » rend l'écran d'où il s'est ouvert, l'événement
ouvert et sa section compris. La commande du bandeau le rend aussi : chacune
des deux est un bouton bascule, qui ouvre son panneau fermé et le referme
ouvert, en laissant le focus sur elle ; celle d'un autre panneau passe de l'un
à l'autre. Tant que son panneau est ouvert, la commande est en surbrillance —
le fond plein de la teinte de la marque, le texte de l'encre du bandeau, à
4,5:1 au moins dans les deux thèmes, souligné d'un trait épais qui la
distingue sans la couleur, même en couleurs forcées — et porte
`aria-pressed="true"` ; l'autre porte `aria-pressed="false"`. La surbrillance
ne change pas la hauteur de la commande : le bandeau garde la sienne
(§ 8.4).

Le panneau « Paramètres » porte deux réglages, chacun une carte titrée et
expliquée, ses choix en commandes enfoncées :

- **la taille du texte de l'écran**, un choix par palier, 90, 100, 115, 130 et
  150 %, retenue sur le poste (§ 8.5). Elle se pose en taille de police de la
  racine du document, que suivent tous les jetons de l'interface, exprimés en
  `rem`. Elle ne touche que l'écran : le dessin du plan, en unités du plan, garde
  ses tailles à tout palier ; le document imprimé de l'aperçu — plan imprimé,
  liste d'accueil, feuilles par table — et la feuille gabarit qui mesure sa bande
  redéclarent ces jetons en pixels, aux valeurs d'une racine de 16 px, si bien que
  chaque page et la pagination sont celles d'une racine à 100 % (§ 11.7) ; les
  badges, produits en PDF, ne lisent aucune feuille de style. Le bandeau tient
  sur une ligne à 1 366 px à 100 % ; à un palier plus grand, ou dans une fenêtre
  plus étroite, il peut en prendre deux, sans déborder de la fenêtre.
- **le thème**, clair ou sombre, choisi pour la séance (§ 19.2).

**Le pied des impressions** porte la version parce qu'une feuille circule et survit
à la séance. La règle vaut pour la **page** ; un carton découpé et porté au cou
n'est pas une page et n'en porte rien (§ 11.4).

**Le champ dans le fichier d'état** enregistre la version qui a écrit le fichier
**en dernier**. Il ne compromet pas la sérialisation canonique du § 8.8 — c'est une
constante de construction, pas une valeur tirée de l'horloge — et il change une
fois lors du premier geste suivant un remplacement d'exécutable, ce qui coûte un
correctif et non du bruit à chaque geste. Il **n'est pas** la version de format,
qui reste un nombre séparé, comparé selon ses propres règles.

**Pendant une construction de documentation, le numéro est remplacé par une
marque de provenance** — dans le bandeau, sur le premier écran, au pied des
pages imprimées et sur la feuille de contrôle des badges. La raison est au
§ 19.4 : sans cette marque, le texte relevé de chaque capture d'écran change à
chaque incrément de version, et toutes les images se réécrivent. Le manifeste,
lui, enregistre la **version réelle**, et le contrôle de version de la livraison
la compare (§ 19.7).

---

## 19. Les captures d'écran, la documentation engendrée, le banc de mesure

> **Vocabulaire.** Le § 7.3 emploie « capture » au sens de la **capture du
> pointeur**. Cette section écrit toujours **« capture d'écran »** en entier, et
> aucun autre texte n'emploie « capture » seul. Deux mécanismes sans rapport
> portant le même mot dans un même document se confondent à la lecture rapide — et
> la lecture rapide est celle que fait l'implémenteur qui cherche une règle.

### 19.1 Une seule boucle, pas deux chantiers

Le scénario de pilotage et la documentation sont **un seul mécanisme**. Le
scénario conduit l'application le long du parcours de l'opérateur (§ 2.1) et dépose
une capture d'écran à chaque étape ; la documentation affiche ces captures et rien
d'autre. `GUIDE-USAGE.md` (§ 16.1) est la **lecture** d'un parcours que la machine
vient de refaire.

La conséquence est la raison d'être du couplage : **un guide ne peut plus vieillir
en silence.** Si une commande change de nom, si un écran disparaît, si un bouton
cesse d'être atteignable, l'étape correspondante échoue, la construction de la
documentation s'arrête en nommant l'étape, et **elle ne republie pas les images du
passage précédent** : une documentation partielle qui se complète avec d'anciennes
images est exactement le défaut que la boucle existe pour supprimer.

**Le pilotage est le parcours d'épreuve du projet `navigateur`** (§ 14.8) : la
plateforme `web` (§ 13.1), servie en local par Vite, sur le système de fichiers
simulé, l'horloge pilotée (§ 19.4) et l'exécuteur de génération qui calcule dans
la page. Les captures d'écran et les épreuves du parcours sont une seule
exécution : `make captures` publie ce qu'elle photographie, et sans lui, la même
exécution compare chaque capture au manifeste (§ 19.7). Le pilote, le navigateur
et son pilote de protocole sont des **dépendances de développement** :
l'exigence « aucune connexion requise » du § 2 porte sur le logiciel livré,
jamais sur l'atelier qui le construit.

Les étapes s'exécutent dans la page, et ce qui touche le disque — images,
manifeste, tramage du PDF — dans des commandes du lanceur, sous `node`, dans la
même langue que tout le reste (§ 13.2). **Elles ne calculent aucun indicateur.**
Quand une étape vérifie un chiffre
affiché, elle appelle la fonction du moteur qui l'a produit et compare : la même
implémentation sollicitée deux fois, un **oracle** au sens du § 14.11, jamais une
seconde arithmétique.

### 19.2 Le pilote, et les propriétés dont le reste dépend

Le pilote est **Playwright**, conduit par le mode navigateur de Vitest : le
projet `navigateur` du § 14.8, qui monte déjà les composants, porte aussi le
parcours photographié — un seul pilote pour les épreuves et pour la
documentation, comme le § 14.8 l'exige du niveau 2. L'horloge propre du pilote
est écartée : elle fige la boucle d'images, que le plan attend ; le scénario
pilote l'horloge de l'application (§ 19.4). Le choix se remplace, mais il engage
quatre propriétés dont toute la section dépend, et une substitution se juge sur
elles, pas sur le nom :

1. **Des événements de pointeur que le navigateur traite comme réels.** Sans eux,
   un glissement du § 7.1 ne se conduit pas et la moitié du parcours n'est pas
   atteignable.
2. **La capture d'écran d'un élément**, et non de la fenêtre. Elle **recadre sur la
   surface de l'application** : le cadre de fenêtre et la barre système — ce qui
   diffère entre `web` sous Linux et `electron` sous Windows — sortent de
   l'image, et le guide d'usage reste vrai sur la plateforme livrée.
3. **La maîtrise de la taille du cadre d'affichage.** Voir § 19.4 : une taille
   demandée n'est pas une taille obtenue, et le logiciel ne s'en contente pas.
4. **Un navigateur lancé sans accès réseau hors de la boucle locale.** Le § 2
   interdit que quoi que ce soit sorte de la machine ; une requête sortante est
   alors un **échec de connexion observable**, et non une requête qu'il faudrait
   avoir su écouter.

Deux propriétés que le logiciel **ne demande pas** au pilote, parce qu'aucun pilote
ne les offre de façon portable :

- **La lecture de la console.** Le logiciel installe donc, **avant le chargement de
  ses propres scripts**, un collecteur de page — `error`, `unhandledrejection`, et
  l'enveloppe de `console.error` — qui accumule dans un tableau que chaque étape
  relit. Une étape qui trouve ce tableau non vide échoue en citant la première
  entrée. Le mécanisme est portable et il attrape ce qu'un journal de console
  n'attrape pas : une promesse rejetée sans gestionnaire.
- **L'émulation d'une préférence système.** Le logiciel règle son **propre**
  réglage de thème, qui est celui que l'opérateur manipule dans le panneau
  « Paramètres » (§ 13.3, § 18.6), et injecte une
  feuille de style qui annule transitions et animations. L'interface n'en porte
  que deux : la rotation d'un signe de chargement — celui de la liste des
  événements (§ 8.1), celui de la pastille d'activité (§ 5.10) —, qui s'arrête
  sous la préférence de mouvement réduit, et l'apparition de cette pastille, de
  l'opacité 0 à 1 en un seul pas une demi-seconde après son montage, qui n'est
  pas un mouvement et demeure. Aucun état n'attend l'une ou l'autre, rien ne lit
  leur rendu, et cette feuille les annule comme toute autre ; la pastille,
  absente de l'écran au repos, n'entre dans aucune capture. La préférence
  système est consultée à chaque lancement, et le réglage de l'opérateur vaut
  pour la séance : rien ne l'enregistre, ni fichier ni stockage du navigateur
  (§ 8.6).
  **Le scénario pose donc le thème par le réglage, à chaque exécution, et ne le
  déduit jamais de la machine** : il le donne au montage comme thème de départ.
  Une épreuve qui mesure un écran dans l'autre thème le change dans l'état de
  navigation, celui que le panneau « Paramètres » règle, sans ouvrir le panneau,
  qui remplacerait l'écran mesuré. La taille du texte de l'écran, elle, est retenue
  sur le poste (§ 8.5) : le scénario démarre sur un dossier de travail neuf,
  dont aucun fichier de réglages ne la porte, et chaque capture est prise à
  100 %.

### 19.3 Le parcours, et ce qu'il photographie

Un parcours ordonné, du premier écran à l'impression. **Son ordre est celui des
douze étapes du § 2.1, et c'est la seule source de cet ordre** : chaque capture
d'écran déclare l'étape à laquelle elle appartient, et un contrôle du niveau `node`
échoue si une étape n'a **aucune** capture, ou si l'ordre des captures contredit
l'ordre des étapes.

**Seule une capture photographiée, présente au manifeste, couvre une étape** :
aucune liste ne déclare un écran sans image qui en tiendrait lieu, et la liste
`reportees` du format du manifeste est toujours vide — chacune de ses entrées est
une faute. La publication du § 19.5 passe le même contrôle ; celle d'une
sélection de captures, que font les épreuves de la publication, n'exige que les
étapes de sa sélection, et le contrôle du niveau `node` refuse le manifeste
qu'elle laisserait.

Chaque étape **affirme une condition visible avant de prendre sa capture
d'écran** — l'élément nommé est présent et porte le libellé attendu — et
l'exécution s'arrête sur la première condition fausse et sur la première entrée du
collecteur d'erreurs. **Une étape n'attend jamais un délai pour laisser le logiciel
rattraper son retard : elle attend un état.** Un délai n'est légitime que lorsque
la durée *est* la chose éprouvée — la pression longue du § 7.3, le retour
automatique en lecture du § 8.4 — et l'étape avance alors l'horloge contrôlée du
§ 19.4 plutôt que d'attendre le temps réel.

**Le parcours principal construit son événement, il ne charge pas une
démonstration.** C'est le parcours de l'opérateur. Un CSV ne reproduit pas une
configuration (§ 10.3) ; une démonstration chargée court-circuite précisément les
sept premiers écrans que le guide doit montrer. Les démonstrations livrées
n'interviennent qu'aux étapes où une configuration **déjà tendue** est le propos.

| fichier | configuration | ce que la capture d'écran montre | ce que son étape affirme |
|---|---|---|---|
| `01-premier-ecran.png` | répertoire neuf | le répertoire vide : la commande de création et les configurations de démonstration offertes, **jamais une liste vide** (§ 8.1), et le chemin du dossier de travail, le dossier `data` des *Documents* sous la racine neutre (§ 8.6, § 19.4) | chaque configuration que le catalogue déclare est nommée et cliquable, et **leur nombre est lu dans le catalogue, jamais écrit dans le scénario** ; le chemin affiché est celui de la racine de la séance |
| `01b-passer-en-ecriture.png` | idem | la commande « Modifier » à place fixe, la bande de mode et le libellé de mode, sans cadre autour du plan (§ 8.4) | avant ce geste, une tentative de modification est refusée ; après, elle passe |
| `02-import-apercu.png` | `participants_cas_limites.csv` | le haut de l'aperçu obligatoire (§ 10.1) : la nature du fichier choisie, « Participants » (§ 10.4), le mode de l'import, le nom du fichier, l'encodage et le séparateur détectés et **nommés** ; le tableau des colonnes, qui porte l'association par en-tête, s'ouvre au bord inférieur et se poursuit sous l'image | l'encodage et le séparateur affichés sont ceux que le module d'import a retenus ; l'aperçu n'est pas contournable ; au moins un groupe d'orthographes fondu et au moins une ligne refusée sont affirmés sur l'écran, sous l'image |
| `02b-import-cp1252.png` | `participants_cas_limites_cp1252.csv` | le haut de l'aperçu du même contenu en windows-1252 (§ 10.1) : la nature du fichier choisie, le nom du fichier, l'encodage détecté et **nommé**, le séparateur, « virgule » ; les cellules accentuées sont sous l'image | l'encodage affiché est celui que le module d'import a retenu ; les cellules accentuées de l'aperçu sont celles que rend le décodage du fichier, sans caractère parasite, et sont affirmées sur l'écran, sous l'image : l'épreuve lit le texte de l'aperçu, non ce que la fenêtre laisse voir |
| `02c-import-presence.png` | **petite démonstration**, générée, n° 1 retenue (« la présence par tour », plus bas) | l'aperçu, en mise à jour, du modèle de participants téléchargé sous quatre tours, plus une ligne qui désigne une personne inscrite par son nom et son prénom, sa présence vide : la colonne « présence » et ses cellules lues en tours ; « présence inchangée » sur la seule ligne de la personne inscrite (§ 10.1) | la cellule « 1-3 » se lit « tours 1 à 3 » et la cellule « 2, 3 » « tours 2 et 3 », par la grammaire du CSV ; les cellules vides des personnes du modèle, que l'import crée, ne disent rien ; aucune ligne refusée, aucun doublon ; « Fermer l'aperçu » n'écrit rien |
| `03-import-rapport.png` | `participants_cas_limites.csv`, comme `02` | le haut du rapport : les comptes de l'import — personnes ajoutées, mises à jour, inchangées, retirées, réservations retirées —, le nom du fichier, l'encodage et le séparateur | le compte des personnes ajoutées égale le nombre de participants de l'événement, et l'import fait une seule entrée d'historique ; au moins un groupe d'orthographes fondu et au moins une ligne refusée sont affirmés sur l'écran, sous l'image |
| `04-grille-participants.png` | l'événement en construction | la grille éditable, le tri, le filtre, une personne exclue, la légende des étiquettes, chacune chiffrée (§ 10.2) | le compte affiché égale le compte importé |
| `04a-etiquettes.png` | l'événement en construction | la fiche d'une personne, sa rubrique « Logo » sans logo — « Aucun logo. » et la commande « Logo » —, puis ses étiquettes en pastilles neutres, le champ d'ajout, et le signal de l'orthographe retenue sous le champ ; la légende des étiquettes, chiffrée, est celle de `04` (§ 10.2) | les étiquettes affichées sont celles de la personne ; une saisie d'une orthographe voisine reçoit l'orthographe existante, et le signal est visible ; la légende compte les porteurs de chaque étiquette, exclues comprises |
| `04b-presence-grille.png` | idem que `02c`, l'arrivée ajoutée et dite présente aux tours 3 et 4 par sa fiche | la grille triée par nom, les cases de présence de la partante ouvertes au clavier, tours 1 et 2 cochés, et la ligne de l'arrivée, « tours 3 et 4 » en pastille (§ 10.2) | les cases ouvertes et cochées n'écrivent rien ; Entrée, après l'image, écrit une entrée, et le retenu laisse la chaise de la partante libre aux tours 3 et 4, sans dériver |
| `04c-presence-fiche.png` | idem | la rubrique « Présence » de la fiche de l'arrivée : son résumé, ses cases 3 et 4 cochées, et l'itinéraire du retenu, « absente, absente, en réserve, en réserve » ; la rubrique « Logo », plus haut dans la fiche, hors de l'image (§ 10.2) | le résumé, les cases et l'itinéraire égalent la présence et le retenu de la charge |
| `05-tables-etat.png` | l'événement en construction, deux tables posées par le scénario | deux tables à 8 places dont l'une **suit le défaut** et l'autre porte une **surcharge de même valeur** (§ 6.1) | les deux états s'affichent différemment **à valeur égale** |
| `05a-objectifs-tables.png` | idem | une table à objectif de soirée qui suit la règle par défaut, que son choix de règle nomme en mots (« selon le réglage général (…) »), une table à objectif de tour à règle propre (§ 4.5) | les deux états de règle s'affichent différemment ; l'objectif auquel personne ne correspond porte son signal ; la règle par défaut, changée puis rendue, n'est pas écrite |
| `05b-import-objectifs.png` | `objectifs_cas_limites.csv` | l'aperçu des objectifs : lignes refusées avec leur motif, orthographes fondues (§ 10.4) | au moins une ligne refusée et un groupe fondu sont visibles ; la nature du fichier, cochée et nommée, et le séparateur nommé sont affirmés sur l'écran, au-dessus de l'image |
| `06-defaut-consequence.png` | l'événement en construction | l'énoncé chiffré avant application — tables suivant le défaut, surchargées épargnées, total des sièges contre nombre de participants | le total annoncé égale celui que recalcule le moteur |
| `07-plan-tables.png` | idem | le plan, ses tables à l'échelle, l'échelle graphique, la mention « disposition relative » (§ 7.7) | la mention est présente tant qu'aucune dimension de salle n'est saisie |
| `07a-cibles-sieges.png` | **grande démonstration** (celle de la capture `10`) | zoomée jusqu'au régime des sièges : les chaises dessinées une à une, chacune une cible (§ 7.3) | le centre d'une chaise désigne cette chaise |
| `07a-cibles-tables.png` | idem | au zoom ajusté, sous le seuil de 24 px : la table est la cible, et ses chaises ne se dessinent plus une à une | le même point désigne la table, et aucune chaise |
| `07b-nombre-de-tours.png` | l'événement en construction | l'annonce qui précède le retrait d'un tour : la réservation de portée « tour désigné » que le retrait détruit, nommée (§ 2.1, étape 5) | l'annonce paraît avant toute écriture |
| `08-animateurs-designes.png` | idem | un siège **cadenas fermé + anneau** (réservé, tous les tours) et un siège **hachuré à cadenas ouvert** (titre non pourvu), avec la liste numérotée de la première table qui énonce sa réservation en toutes lettres, celle de la seconde coupée par le bord du plan (§ 7.6) ; le panneau latéral s'ouvre sur le diagnostic, et les deux listes de travail du § 5.8, plus bas dans le panneau, sont affirmées sans l'image | les marques sont des éléments SVG, **aucun point de code emoji dans le sous-arbre** ; aucune chaise ne porte plus de deux marques ; la liste de chaque table énonce son état en toutes lettres ; la liste de travail des titres nomme le titre non pourvu, celle des pressentis n'est pas vide |
| `09-refus-sur-place.png` | idem | un refus du § 5.9 affiché **sur la place concernée**, nommant sa cause et le geste qui le lève | le refus photographié est l'un de ceux qui subsistent à la pose — `k_t > c_t`, une personne exclue, deux places sur un même tour, un dépôt sur une place réservée à un autre ; aucune boîte de dialogue n'est ouverte |
| `10-diagnostic.png` | **grande démonstration** | le diagnostic préalable (§ 5.6), le plafond a priori, les **99 retours imposés** énoncés à part, et le plancher de l'écart d'itinéraire | les valeurs affichées égalent celles du moteur pour la même entrée ; le plafond des quatre animateurs des tables de 7 vaut **24** |
| `10a-ordre-priorites.png` | l'événement en construction | l'ordre des priorités : paliers numérotés, un palier de deux critères avec leurs poids — excédent de collisions × 1 et tours hors objectif × 3 —, « rencontrer le plus d'animateurs différents » marqué décoché (§ 5.3, § 5.7) | l'ordre affiché est celui que compile le moteur ; la capture `11` qui suit nomme les mêmes paliers ; le choix du mode des objectifs, à son défaut « le plus de places servies », et la commande qui rétablit le défaut sont affirmés hors de l'image |
| `11-propositions.png` | l'événement en construction | plusieurs propositions comparées, l'ordre de classement **écrit dans l'interface** par paliers (§ 5.7), le tableau défilé en largeur des colonnes de diversité jusqu'à celles des objectifs | au moins trois propositions ; l'ordre affiché est celui que produit la clé de tri du moteur |
| `11a-depart-derive.png` | **variante sans exception** (§ 15.1), ses propositions engendrées sous une graine écrite et un compte réduit | la section de la génération sous un départ choisi : « Départ : proposition n° X », « Repartir de zéro », les cases des tours, le tour 1 coché, et la commande « Générer depuis n° X » (§ 5.7) | le départ nommé est celui dont la ligne a reçu « Repartir d'elle », de son menu « Actions » ; aucune écriture n'a eu lieu avant le lancement |
| `11b-propositions-derivees.png` | idem, la génération dérivée faite | les lignes des dérivées au tableau des propositions, chacune portant « Dérivée de n° X, tour 1 figé. » sous son numéro, et le départ dans le même classement (§ 5.7) | chaque dérivée garde le tour 1 de son départ case par case ; le libellé d'historique est celui du § 5.7 |
| `11c-derivee-presence.png` | idem que `02c`, la partante et l'arrivée dites, n° 1 en dérive par ses participants | la carte du départ n° 1, tours 1 et 2 figés, qui nomme ses écarts — la partante retirée des tours 3 et 4, l'arrivée à asseoir à ces tours —, puis l'issue « … ; n° 1, en dérive, n'est pas classée » (§ 5.7) | les écarts se lisent avant le lancement, sans écriture ; chaque dérivée reprend les tours figés du départ ajusté, qui sont ceux du retenu, et décrit la soirée, comparable ; aucune comparaison n'est offerte, aucun écart au retenu n'est annoncé |
| `12-qualite-profil.png` | **grande démonstration** | le profil en deux graphiques au même ordre de rangs : l'escalier en comptes de personnes, deux séries — rencontres en trait plein, organisations en tirets —, le plafond réalisé en repère mixte et la borne de diversité en repère pointillé, chacun nommé sur le tracé ; dessous, les rencontres en pourcentage du plafond réalisé jusqu'à la règle à 100 %, du motif du plafond, l'axe des rangs de ce second graphique hors de l'image ; le pire cas au premier rang (§ 12.3) | la page a **dessiné** plutôt que d'opposer son refus — c'est ainsi que la garde du § 12.3 montre qu'elle n'a pas été déclenchée ; chaque graphique a un seul axe vertical ; le rang 1 est le même dans les deux ; chaque pourcentage écrit est suivi de son compte du pire ; aucun repère n'a le motif d'une série |
| `12a-qualite-sans-placement.png` | **petite démonstration, variante « conflit inévitable »**, avant sa génération | la page sans placement : la ligne de source, le diagnostic préalable et sa phrase (§ 12.6) | aucun graphique n'est dessiné ; la phrase est celle d'« aucun placement » |
| `12b-qualite-une-table.png` | **6 personnes de trois organisations, une table de 6, 3 tours**, construite, sa génération faite | la phrase d'une seule table à la place du profil, des collisions, de la grille et des paires ; la performance (§ 12.6) | ni profil, ni barre de collision, ni grille, ni tableau des paires n'est dessiné ; la phrase est celle d'« une seule table » |
| `12c-qualite-un-tour.png` | **12 personnes de trois organisations, 3 tables de 4, 1 tour**, construite, sa génération faite | la vue des tables entière, le sélecteur sur « par siège » et la grille d'une seule colonne, puis la phrase du tableau des paires ; le profil et les collisions, dessinés plus haut, sont affirmés sans l'image (§ 12.6) | aucun tableau des paires, vide ou non, n'est rendu ; la phrase est celle d'« un seul tour » |
| `12d-qualite-une-organisation.png` | **12 personnes d'une même organisation, 3 tables de 4, 3 tours**, construite, sa génération faite | le profil à une seule série et sa phrase ; les collisions et la grille des tables, qui restent (§ 12.6) | le profil porte une série et aucune borne de diversité ; les barres des collisions sont dessinées |
| `12e-qualite-sans-collision.png` | **9 personnes de neuf organisations distinctes, 3 tables de 3, 2 tours**, construite, sa génération faite | la phrase de la vue des collisions ; la grille sous la position « par siège », qui reste (§ 12.6, § 12.11) | aucune barre de collision n'est dessinée ; le sélecteur est sur « par siège » et chaque case écrit 0 |
| `12f-qualite-reserve.png` | **petite démonstration, variante « conflit inévitable »**, sa première proposition retenue puis ajustée au plan : une personne mobile — ni ancrée ni partiellement fixée — mise en réserve au tour 2 | le premier graphique du profil, le point de la personne marqué « en réserve » ; les collisions à un seul segment et la phrase qui dit pourquoi le plancher ne s'applique pas, plus bas, sont affirmées sans l'image (§ 12.4, § 12.6) | aucun segment « prouvé inévitable » n'est dessiné ; le point de la personne porte la marque de la réserve |
| `12g-qualite-plafond-nul.png` | **5 personnes, une table de 4 et une table de 2, 2 tours**, construite : quatre réservées à la table de 4 aux deux tours, la cinquième sans réservation, que sa génération assoit seule à la table de 2 aux deux tours | le point marqué d'un plafond réalisé nul au rang 1 du profil, son infobulle ouverte ; au second graphique, ce rang sans point (§ 12.3, § 12.6) | la cinquième, ni ancrée, ni partiellement fixée, ni en réserve, porte la marque du plafond réalisé nul ; l'infobulle écrit le plafond réalisé 0 et le pourcentage « — » ; le second graphique n'a pas de point à ce rang |
| `12h-qualite-absence.png` | idem que `02c`, la meilleure dérivée montrée | le bas de l'en-tête chiffré : la tuile de l'écart d'itinéraire maximal, « Plancher non prouvé : une personne au moins est absente à un tour. », et ses voisines (§ 12.2) | seule cette tuile le dit ; hors de l'image, les collisions gardent leur segment « prouvé inévitable », égal au plancher du diagnostic — une collision à chacun des tours de l'arrivée, son groupe y comptant une personne de plus que les tables —, et le profil marque d'un losange la partante et l'arrivée, « absente à un tour au moins » |
| `13-qualite-collisions.png` | **petite démonstration, variante « conflit inévitable »** | les barres horizontales à deux segments, « prouvé inévitable » et « reste », en **collisions cumulées**, avec l'effectif, les paires distinctes et l'**excédent** en encre secondaire | le segment prouvé vaut **4 collisions cumulées** et égale le plancher du diagnostic, au chiffre près ; les lignes sont triées sur l'excédent (§ 12.4) |
| `13a-qualite-tables.png` | **petite démonstration, variante « conflit inévitable »** | le sélecteur à trois positions sur « par siège », la grille tables × tours, chaque case ses sièges sans organisation nouvelle, de 0 ou 1, en deux teintes, la pire table en première ligne, que la phrase sous la grille nomme (§ 12.11) | la première ligne porte le plus grand compte de la position « par siège » ; chaque case écrit le nombre que son niveau colore ; une case sans affilié écrit « — » sans teinte |
| `14-qualite-paires.png` | **12 personnes, 4 tables de 3, 6 tours**, construite | le tableau des paires répétées trié, pas la matrice (§ 12.5) | le tableau n'est pas vide, et la première commande de chaque ligne mène au premier tour où la paire se revoit |
| `14a-fiche-rencontres.png` | **12 personnes, 4 tables de 3, 6 tours**, construite | la rubrique « Rencontres » de la fiche d'une personne, ses premières lignes, les plus revues d'abord ; le haut de la fiche, son nom et sa rubrique « Logo » compris, hors de l'image (§ 12.5, § 10.2) | la ligne de la fiche égale la ligne de la personne dans le tableau des paires |
| `15-pas-de-matrice.png` | **grande démonstration** | à 260 participants, le tableau et non la matrice, avec la phrase qui le dit | aucune matrice n'est dessinée |
| `15a-qualite-objectifs.png` | l'événement en construction, la première proposition du classement montrée | les personnes jamais servies en tête, la soirée en texte, son pourcentage et le compte des jamais servies dessous, puis les barres des tours hors objectif, « prouvé inévitable » et « reste », chacune avec ses assis sans table possible, puis chaque tour avec son pourcentage et ses deux comptes (§ 12.12) | la somme des planchers des tours égale le plancher du diagnostic ; possibles − servis de la soirée égale la colonne des tours hors objectif du tableau des propositions ; chaque ligne de tour écrit ses assis sans table possible |
| `15b-qualite-animateurs.png` | **grande démonstration** | le profil des animateurs rencontrés avec la borne des animateurs en repère pointillé, puis le début de la diversité par animateur sur la soirée, le moins varié en tête ; ses colonnes et leurs trois nombres, plus bas, sont affirmés sans l'image (§ 12.13) | le mot « plafond » n'est pas écrit dans la vue ; la première barre porte le minimum annoncé |
| `15c-qualite-performance.png` | **grande démonstration**, une proposition montrée, dans la séance qui l'a engendrée | la ligne de tête — mouvements évalués, durée et cadence de la génération — et les deux premiers rangs des petits multiples sur l'abscisse logarithmique ; les autres multiples et la phrase du dernier changement, plus bas, sont affirmés sans l'image (§ 12.14) | le dernier point de relevé est le plan de la proposition ; ses valeurs égalent la ligne du tableau des propositions ; la durée écrite est celle dont le parcours a avancé l'horloge |
| `16-minimum-atteint.png` | **petite démonstration** | le bas de l'en-tête chiffré : la diversité d'organisation, le manque à zéro et **« minimum atteint »** ; les compteurs de collision et de répétition **mesurés** à zéro et la ligne secondaire « ancrés » à **« — »**, plus haut, sont affirmés sans l'image (§ 15.3) | la mention est présente, les compteurs mesurés sont nuls, et la population vide affiche un tiret, **jamais zéro** |
| `17-comparaison-manque.png` | **variante sans exception** (§ 15.1), une paire de placements écrite dans le scénario | la vue de comparaison : « Tous les indicateurs » replié, les deux profils de manque superposés qui se croisent, l'axe commun, le zéro libellé, la synthèse du tracé, les trois effectifs de rangs (§ 12.10.6) ; les colonnes, plus haut, sont affirmées sans l'image, et `17a` les montre, leurs en-têtes nommant les deux placements ; la question et la ligne qui nomme les deux placements, au-dessus d'elles, ne sont dans aucune des deux images et s'affirment par l'épreuve | la page écrit sa question en toutes lettres et les trois effectifs ; aucune échelle propre à une courbe ; chaque pourcentage d'une colonne est suivi de son compte du pire ; aucun pourcentage hors des colonnes — ni au tracé, ni à sa synthèse, ni dans les phrases ; le signe change au moins une fois |
| `17a-comparaison-colonnes.png` | idem, la même paire | la même vue, cadrée sur ses colonnes : leurs en-têtes, qui nomment les deux placements, leurs chiffres en deux colonnes côte à côte — le minimum brut de chacune en pourcentage, le compte du pire dessous, les lignes secondaires des trois chiffres du manque —, « Tous les indicateurs » replié | chaque colonne porte un pourcentage par indicateur visible qui en a un, le pire cas de son placement, chacun suivi de son compte du pire |
| `18-comparaison-escalier.png` | idem | l'escalier du manque ouvert, jumeau tabulaire de la vue précédente, une colonne d'effectif et une d'effectif cumulé par placement | les effectifs cumulés du tableau reproduisent la courbe ; l'escalier n'écrit aucun pourcentage |
| `19-ajustement.png` | l'événement retenu | le déplacement d'une personne après la retenue, l'interface disant **lequel des deux gestes** est en cours (§ 5.8) | le libellé de l'état des données est visible |
| `19a-presence-plan.png` | idem que `02c` | le retenu au tour 3 : la chaise libre de la partante, l'arrivée dans la réserve, la carte « Absentes » qui nomme la partante, et la liste « En réserve dans le placement retenu » (§ 5.8, § 7.1) | une entrée par geste depuis l'ajout, trois en tout ; le retenu ne dérive pas ; la réserve, les absentes et la liste nomment chacune la seule personne attendue |
| `20-mode-lecture.png` | l'événement retenu | la bande de mode, le libellé de mode à côté de la place fixe, et le bandeau d'application (§ 8.4) | un geste de chaque famille — glisser une personne, glisser une table, tirer une poignée, poser une réservation — est tenté, et l'empreinte d'état est inchangée après les quatre |
| `21-historique.png` | idem | le panneau d'historique ouvert à côté du plan : la liste, la plus récente en haut, chaque ligne sa date et son heure ; un geste défait au clavier, sa ligne « Défait (Ctrl+Z) : … », qui n'est pas abandonnée, et sous elle le geste défait, sur un fil abandonné, en encre secondaire et marqué ; en tête, l'instant courant, nommé « Avant l'accueil » par le champ du panneau (§ 8.2, § 8.3) | au moins un fil abandonné est présent et marqué comme tel ; le libellé du retour nomme la touche ; le jalon est sur l'instant courant, et le nommer ne change pas la révision |
| `22-plan-brouillon.png` / `23-plan-retenu.png` | idem | l'**aperçu d'impression** du plan (§ 11.7) avec son cartouche, son échelle graphique et son horodatage, **avec** puis **sans** le filigrane BROUILLON | **deux images, parce qu'une absence ne se photographie pas** : le filigrane présent sur l'un, absent sur l'autre, et la paire est le seul exposé lisible de la règle |
| `24-badges-controle.png` / `25-badges-planche.png` | idem, sur une machine qui n'a pas choisi de modèle de badge : Avery 5392 | la **feuille de contrôle à part**, avec son échelle de 100 mm, le contour des six cartes et ses comptes, puis la première **feuille de cartes**, six cartes Avery 5392 sans filet, les six premiers noms de l'ordre alphabétique ; une personne assise à la même table à chaque tour lit une seule ligne, « Toute la soirée — table 1 (Table d’honneur) », le libellé de la table après son numéro (§ 11.4) ; sous le pied de chaque carte, le pied TechnoLibre, son texte puis le logo en couleurs, la case de la machine étant cochée par défaut — la feuille de contrôle ne le porte pas | voir § 19.6 — ces deux images ne viennent pas du navigateur. La paire est nécessaire : la feuille de contrôle est ce que l'opérateur mesure sous une règle et pose sur une feuille de cartes avant d'engager les cartes, et une feuille de cartes seule ne le montre pas ; produire n'écrit que les deux PDF |
| `25a-badge-absente.png` | idem que `02c`, la meilleure dérivée retenue | la feuille de cartes de la réédition des badges de la partante et de l'arrivée : « Tour 3 — absente » sur l'un, « Tour 1 — absente » sur l'autre (§ 11.5), chacun sous son pied TechnoLibre | « Retenir » n'ouvre aucune fenêtre, le retenu n'étant ajusté qu'aux participants ; seuls la planche et sa feuille de contrôle s'écrivent ; tramée du PDF comme `24` et `25` (§ 19.6) |

Une image montre ce que tient la surface défilante d'un cadre de 1 366 × 700
(§ 19.4), soit 482 px de haut sous la barre du plan ; ce que la ligne du tableau
décrit au-delà s'affirme par l'épreuve, sans l'image.

**L'événement en construction est généré sous ses objectifs et son ordre
réglé.** Les objectifs posés en `05a` et l'import de `05b` restent, et l'ordre
réglé en `10a` reste : la capture `11` montre la phrase par paliers et les
colonnes des objectifs, son tableau défilé en largeur de la diversité jusqu'à
elles, et les captures du placement qui en découle changent avec elle. Que
l'ordre par défaut rende les plans de l'ordre fixe de référence ne se
photographie pas : les empreintes de référence le gardent (§ 14.10).

**La capture `21` ne change pas ce que l'étape 12 reçoit.** Elle se prend
après `20`, l'événement repassé en écriture : le geste défait au clavier, puis
celui qui le remplace, changent le courriel de deux personnes, que rien
n'imprime, et le parcours défait le second au clavier après l'image.
L'événement revient au contenu qu'il avait après `20`, et `22` à `25`
photographient le même plan.

Les deux `07a` se photographient sur la grande démonstration, chargée pour la
capture `10` : sur la soirée que le parcours construit, deux tables, même le
zoom le plus faible laisse les sièges pour cibles, et la bascule ne se montre
pas.

Les captures de la page de qualité, `12` à `16` et leurs voisines en « a » à
« g », illustrent l'étape 10 et se prennent **à la fin du parcours**, après les
familles en lecture et sur un plan bloqué, chacune sur sa charge, pour ne rien
changer de ce que les captures précédentes reçoivent : `12`, `15`, `15b` et
`15c` sur la grande démonstration, dont le parcours engendre les propositions
sous une graine écrite et un compte réduit ; `12a`, puis `13` et `13a` après la
génération, puis `12f` après l'ajustement du retenu, sur la variante « conflit
inévitable » ; `12b`, `12c`, `12d`, `12e` et `12g` chacune sur sa configuration
construite ; `14` et `14a` sur la configuration construite des paires ; `15a`
sur l'événement en construction ; `16` sur la petite. **La durée de `15c` est
pilotée** : la génération de la grande se fait sous l'horloge pilotée, que le
parcours avance d'un pas écrit à chaque avancement du moteur ; la durée et la
cadence affichées sont alors les mêmes à chaque exécution (§ 19.4). Le parcours
rouvre ensuite l'événement, sans photographier : la même proposition montre la
même course, la durée « inconnue ».

**Les captures des dérivées et de la comparaison se prennent aussi à la fin**,
sur la variante sans exception, que le parcours charge depuis le premier écran
et génère sous une graine écrite et un compte réduit : `11a` au départ choisi,
`11b` après la génération dérivée, puis `17`, `17a` et `18` sur une paire de
placements dont les profils de manque se croisent et prennent au moins le seuil
de valeurs distinctes (§ 19.10) — la dérivée et son départ si une graine écrite
le donne, sinon deux propositions de la génération. La paire se cherche une
fois, sous un compte réduit, et ses numéros et ses graines s'écrivent dans le
scénario : la recherche n'est pas refaite à chaque exécution. `11a` et `11b`
appartiennent à l'étape 9 et se rangent entre `11` et `12` ; prises à la fin,
elles ne changent rien de ce que `19`, `20` et les familles reçoivent. Le guide
d'utilisation cite `11a` et `11b` à l'étape 9, sous « Repartir d'une
proposition », et `17`, `17a` et `18` à l'étape 10 ; l'appariement les garde
(§ 19.7). Les deux générations que ces captures demandent, ordinaire puis
dérivée, sur 260 personnes, ont un coût **mesuré, non supposé** : le scénario
écrit leur compte réduit avec la durée relevée, et cette durée décide, comme
pour toute étape de la grande démonstration, si elles restent au parcours
principal (§ 19.3).

**Les captures de la présence par tour se prennent les dernières**, après
celles de la dérivée et de la comparaison, sur la petite démonstration chargée
depuis le premier écran, générée sous la graine écrite, sa proposition n° 1
retenue : l'aperçu du modèle de participants, plus la ligne d'une personne
inscrite (`02c`), puis une personne ajoutée
par le formulaire et dite présente aux tours 3 et 4 par sa fiche, et la
personne n° 1 dite présente aux tours 1 et 2 par la grille, au clavier (`04b`,
`04c`) ; le retenu ajusté au plan (`19a`) ; la génération dérivée de n° 1, en
dérive, ses tours 1 et 2 figés (`11c`) ; la page de qualité de la meilleure
dérivée (`12h`) ; enfin, la meilleure dérivée retenue, la réédition de leurs
badges (`25a`). Aux tours 3 et 4, la salle reste juste pleine : la partante
libère la place de l'arrivée. Prises à la fin, elles ne changent rien de ce que
les autres captures et les familles reçoivent ; chacune se range à son étape
par son nom. Le guide les cite aux étapes 2, 3, 9, 10, 11 et 12 ; l'appariement
les garde (§ 19.7).

**L'aperçu d'impression est plus haut que la surface de l'événement.** `22` et
`23` le photographient, dans la section « Impression », au défilement de la
surface où le filigrane et le pied de la première page la partagent, la barre de
l'aperçu au-dessus d'elle ; `23` reprend le cadrage de `22` sur le placement
retenu.

**Trois pièges de dénombrement que cette table évite, et qui sont la raison de sa
forme.**

- **Le premier écran n'offre pas « deux démonstrations ».** Le § 15 en livre
  **quatre** configurations. Une étape qui en affirme deux échoue, ou pire, fige un
  compte faux. Le compte se lit dans le catalogue.
- **Les paires répétées ne sont pas garanties sur la grande démonstration** — le
  § 12.5 donne le dénombrement. Le tableau se photographie sur une configuration où
  la répétition est forcée.
- **Les collisions d'organisation ne sont pas garanties non plus sur la grande** :
  sa plus grosse organisation compte 12 membres pour 33 tables. La variante
  « conflit inévitable » les force.

**Les configurations qu'aucun catalogue ne porte sont construites, pas
cataloguées.** Trois besoins sortent des quatre entrées du § 15 : les paires
répétées sur 12 personnes, 4 tables de 3 et 6 tours ; le témoin de pagination à 257
badges ; les cas dégénérés du § 12.6. Le scénario les **construit**, par des
scénarios courts, et le catalogue reste à quatre entrées — sans cette règle,
l'étape `01-premier-ecran` change de valeur chaque fois qu'une épreuve a besoin
d'une configuration de plus.

**Les cas dégénérés du § 12.6 se photographient à part**, par des scénarios
courts qui montent la configuration visée et vont droit à l'écran : aucun
placement (`12a`), une seule table (`12b`), un seul tour (`12c`), une seule
organisation (`12d`), aucune collision (`12e`), une personne en réserve (`12f`),
un plafond réalisé nul (`12g`). Chacune affirme qu'aucun axe vide n'est dessiné
et que la phrase est celle du cas. Les autres cas du § 12.6 s'éprouvent sans
image. La raison n'est pas la fragilité d'une chaîne longue : **chacun exige une
configuration différente**, et un parcours linéaire n'en porte qu'une à la fois.

S'y ajoute, au même titre, le fichier `participants_cas_limites_cp1252.csv`
(§ 10.3) : la décision d'encodage en quatre temps du § 10.1 est le mécanisme dont
la défaillance est la plus muette — « Benoît » devient « BenoÃ®t » et aucun calcul
n'échoue — et c'est la raison pour laquelle le guide la montre.

**La grande démonstration n'intervient qu'aux étapes où l'échelle est le propos.**
Le coût d'un parcours mené sur 260 personnes est dominé par la génération, et il
est **mesuré, non supposé** (§ 14.1) : le seuil au-delà duquel une étape quitte le
parcours principal est cette mesure.

### 19.4 Ce qui rend une capture d'écran reproductible

Une capture d'écran qui change à chaque exécution rend sa revue impossible : le
diff est entièrement bruit, et la seule image qui comptait s'y noie. Le logiciel
neutralise chaque source de variation nommément.

| source de variation | neutralisation |
|---|---|
| **la règle d'arrêt de la recherche** | **un compte, jamais une durée** (§ 5.10). C'est la source décisive, celle qui rendrait toutes les autres inutiles : une recherche bornée par le temps rend le placement dépendant de la vitesse de la machine, et la capture du plan de salle ne serait reproductible sur aucune autre machine que celle de référence |
| **le placement engendré** | une **graine entière écrite dans le scénario**, passée à la commande de génération ; à graine et entrée égales, le placement est identique |
| **l'ordre d'itération et les comparaisons de chaînes dans le moteur** | la règle du § 15.5, point 4, **étendue du générateur au moteur** : aucun `localeCompare`, aucun parcours reposant sur l'ordre des clés d'un objet, départage par identifiant entier |
| **l'ordre des propositions à égalité** | l'identifiant vient de la place dans la suite de graines dérivées, **jamais de l'ordre d'achèvement** (§ 5.7) : sinon le départage se fait par la vitesse de la machine, et deux exécutions classent deux propositions à égalité dans deux ordres |
| **la taille du cadre d'affichage** | **une taille demandée n'est pas une taille obtenue** : ce que l'interface du navigateur prend autour du cadre diffère d'une version à l'autre, et un cadre laissé libre gouverne `k_ajusté` (§ 7.2) et donc le seuil de 24 px au-delà duquel les sièges cessent d'être des cibles (§ 7.3). Le scénario pose le cadre, **relit `innerWidth` et `innerHeight`, corrige de l'écart relevé, et échoue** s'il n'obtient pas les valeurs visées |
| **un écran plus haut que la fenêtre** | il se photographie à la taille de la fenêtre, à une position défilée que le scénario pose et relit : l'image ne dépend pas de la hauteur de l'écran entier |
| **le facteur d'échelle de l'affichage** | fixé **au lancement du navigateur**, par son argument de lancement, la page ouverte au même facteur 1 : aucune commande du pilote ne le fixe pour la fenêtre |
| **le mode d'affichage du navigateur** | un seul mode, sans tête, et **le mode réel est nommé et inscrit au manifeste** : celui du Chromium de Playwright, `chromium-headless-shell`, ou, sous `GTT_CHROMIUM`, celui que le nom de l'exécutable désigné annonce — `chromium-headless` pour un navigateur complet. Les métriques de texte en diffèrent : une capture prise dans un autre mode s'écarte du manifeste au lieu de passer pour la même |
| **le cadrage mémorisé** | le § 8.5 range le cadrage dans un fichier de réglages locaux : le scénario démarre sur un **profil neuf**, ce qui lui donne du même geste un dossier de travail neuf |
| **le numéro d'ordre du nom de démonstration** | charger une démonstration crée « ‹nom› 2 » à la deuxième exécution (§ 15) ; le répertoire neuf ramène chaque exécution au premier ordinal |
| **l'horloge** — horodatage d'historique, pied de page, « dernière modification », retour automatique en lecture | **une seule source d'horloge dans toute l'application hors moteur**, et **elle possède aussi les minuteries** : le stockage reçoit d'elle ses horodatages en paramètre, le système de fichiers web l'horloge elle-même pour ses minuteries, et une garde de l'arborescence refuse toute minuterie armée hors d'elle dans l'interface, l'application, le stockage et le point d'entrée de la page. Un instant figé ne suffit pas : un compte à rebours bâti sur une minuterie du moteur d'exécution continue d'avancer sous une horloge gelée, et **le retour automatique en lecture tombe au milieu d'une étape**. Le scénario installe une horloge dont il contrôle l'avance, ce qui lui permet aussi d'éprouver les durées |
| **le numéro de version affiché** | une construction de documentation pose une **marque de provenance à la place du numéro** (§ 18.6), dans le bandeau, sur le premier écran, au pied des pages imprimées et sur la feuille de contrôle des badges. Sans elle, le texte relevé de chaque capture change à chaque livraison, l'empreinte d'étape change avec lui, et **toutes les images se réécrivent à chaque incrément** — précisément le bruit que la réécriture conditionnelle du § 19.5 existe pour supprimer |
| **le chemin affiché** dans la liste des événements (§ 8.1) | racine de travail neutre, et le contrôle **refuse une capture dont le texte relevé — celui de tous les nœuds de texte de la région photographiée, pas des seuls éléments que l'étape nomme — porte un chemin hors de cette racine**. Un chemin réel porte un nom de compte, qu'une documentation publie |
| **la police réellement rendue** | la police embarquée (§ 11.1) est celle du pilotage. Le scénario **mesure une chaîne témoin** par `getComputedTextLength()` et la compare à la valeur enregistrée **avec une tolérance relative, constante mesurée** (§ 14.1) — exiger l'égalité exacte reproduirait, sur une mesure de texte, l'erreur que cette section refuse sur les pixels. La tolérance se fixe au-dessous de l'écart qu'introduit un repli de police, qui est d'un tout autre ordre |
| **le thème** | réglé par le réglage de l'application, non par une préférence système émulée (§ 19.2) |
| **les transitions et animations** | annulées par une feuille de style injectée. Une capture prise à mi-transition est une image différente à chaque exécution |
| **l'horodatage interne du PDF** | il est l'horodatage du placement (§ 8.9), qui vient de la même source d'horloge, donc de l'instant contrôlé ; le PDF ne porte ni identifiant de document ni date lue à l'écriture |
| **le tramage du rendu** — lissage des glyphes, accélération matérielle | **ne se neutralise pas** d'une machine à l'autre. C'est la source que le logiciel ne prétend pas supprimer, et elle décide de tout ce qui suit |

**Parce que le tramage ne se neutralise pas, la fraîcheur ne se contrôle jamais sur
les pixels.** Une empreinte d'image échouerait sur toute machine autre que celle
qui a produit la référence ; un contrôle qui échoue partout se désactive, et il ne
reste rien. Le contrôle porte donc sur **l'état**, pas sur l'image.

### 19.5 Le manifeste, et l'écriture conditionnelle

Chaque capture d'écran porte une entrée dans un **manifeste engendré** :
identifiant d'étape, **étape du § 2.1 à laquelle elle appartient**, version réelle
de l'application, graine, dimensions relues du cadre d'affichage, facteur
d'échelle, mode d'affichage, thème, instant contrôlé, le **texte relevé** de la
région photographiée, les **styles calculés** des marques porteuses d'information,
et une **empreinte canonique de l'état de l'événement** au sens du § 8.8. S'y
ajoutent la **source** de l'image — le navigateur, ou le PDF —, l'empreinte des
octets du PDF pour une image de la planche, et le contrôle du fichier image, son
empreinte et ses dimensions, qui égalent le cadre multiplié par le facteur
d'échelle ; jamais des pixels (§ 19.4).

**Le manifeste porte en tête son pilote** — le navigateur et sa version, le mode
d'affichage, le facteur d'échelle et le cadre —, **tiré des seules captures
d'écran du navigateur** : une page de PDF a la taille de sa page, pas celle du
cadre, et une publication sans aucune capture du navigateur se refuse.
**L'entrée d'une image de la planche** porte pour cadre la page tramée à 96 ppp
— 794 × 1 123 pixels pour une page A4 —, pour facteur 1, pour mode
`pdfjs-dist-96ppp`, l'empreinte SHA-256 des octets du PDF, et aucun style
relevé : un PDF n'a pas de style calculé.

**Le manifeste ne nomme pas sa machine.** Ses clés forment des listes fermées, et
aucun de ses textes ne porte un chemin hors de la racine neutre, un nom d'hôte,
un utilisateur ou un instant autre que celui de l'horloge pilotée ; un contrôle
le refuse, montré rouge sur des valeurs inventées.

**L'empreinte d'une étape est celle de son entrée de manifeste entière, l'image,
l'empreinte elle-même, la version réelle et la version du navigateur exclues** —
et non celle du seul état de l'événement. Les étapes 10 à 18 consultent
le même état sous des vues différentes : une empreinte réduite à l'état leur
donnerait à toutes la même valeur, et une régression de la page de qualité ne
réécrirait jamais son image. Les deux versions changent d'une livraison et d'un
poste à l'autre sans que l'état montré change : les garder réécrirait chaque
image à chaque incrément.

**Le scénario ne réécrit un fichier image que si l'empreinte de son étape a
changé.** Sans cette règle, une exécution sur une autre machine réécrit toutes les
images par le seul effet du lissage, le dépôt enfle à chaque passage et le diff
cesse d'être lisible. Avec elle, **une image qui change dans un diff signifie que
l'état qu'elle montre a changé** — c'est la propriété qui rend la revue possible.

Les styles calculés relevés servent deux fois : ils détectent une feuille de style
qui ne s'est pas appliquée, et ils **produisent le tableau des ratios de contraste
que le § 14.5 exige mesurés sur la couleur relue du rendu**, **pour les deux
thèmes**. Ce tableau est engendré, pas recopié.

Une réserve que le style calculé impose, et qui devient une règle de conception :
**le style calculé rend la couleur résolue d'un élément, non le pixel composé.**
C'est pourquoi le § 14.5 interdit toute opacité partielle, tout filtre et tout mode
de fusion sur le texte et sur les marques porteuses d'information.

### 19.6 Les images qui ne viennent pas du navigateur

**La planche de badges est le seul PDF** (§ 11.1) — avec, pour Avery 5392, sa
feuille de contrôle à part —, et le logiciel la construit
depuis le modèle par une bibliothèque embarquée, jamais par le moteur de rendu. Une
capture d'écran d'un aperçu, pour la montrer, exigerait une **seconde
implémentation de la mise en page** — la double arithmétique que le § 13.2
interdit, transposée à la pagination, avec le même défaut : les deux dérivent et
les tests des deux restent verts.

Le logiciel engendre donc ces images **sous `node`, en tramant les pages du PDF
effectivement produit**. Le rasteriseur est une dépendance de construction de la
documentation. Ce chemin est plus fort qu'un aperçu : l'image montre l'artéfact
livré, et non une approximation à l'écran. Sa fraîcheur se contrôle sur
l'**empreinte canonique du PDF produit**, que l'horloge contrôlée du § 19.4 rend
stable, et non sur les pixels tramés.

Le PDF tramé est celui que la section de l'impression vient de produire dans le
parcours — la feuille de contrôle à part pour `24`, la première feuille de
cartes pour `25` et `25a` —, et non une seconde production : la page le passe
aux commandes du lanceur, sous `node`, qui le lisent par `pdfjs-dist` — sa
couche de texte, ses traits, la taille de ses pages — et, sous `make captures`
seulement, le trament à 96 ppp par le canevas natif que `pdfjs-dist` charge.
**Seul `make captures` exige ce canevas** : en vérification, le parcours lit le
PDF sans le tramer, et le contrôle porte sur son empreinte ; sans canevas, le
tramage se refuse en le nommant, et l'étape échoue sans rien publier.

**Le plan, lui, n'est plus un PDF** : ses deux images viennent du navigateur, sur
la **vue d'aperçu d'impression** du § 11.7, qui applique au document vivant la
feuille de style d'impression réelle. Ce n'est pas une seconde mise en page : c'est
la même, regardée avant d'être envoyée à l'imprimante.

Le plan **à l'écran** reste une capture ordinaire du navigateur : il est la surface
de travail, et c'est à ce titre que le guide le montre.

### 19.7 Comment une capture d'écran périmée se détecte

Une documentation dont les images montrent une version antérieure est pire qu'une
documentation sans image : elle fait croire au lecteur qu'il regarde le logiciel
qu'il a sous les yeux. Trois contrôles, à **trois moments**, et le moment compte
autant que le contrôle.

**Au niveau `node`, à chaque modification** (§ 14.4), sans navigateur :
**l'appariement**. Toute image référencée par la documentation a son entrée au
manifeste, et toute image présente est référencée. Une orpheline est un échec dans
les deux sens. S'y ajoute le contrôle d'ordre du § 19.3 : une étape du § 2.1 sans
capture, ou des captures dont l'ordre contredit celui des étapes, font échouer la
construction. Ces contrôles passent sur une machine sans navigateur, à toute heure,
et c'est pourquoi ils sont à ce niveau — **bornés** à leur périmètre, dépendances
et sorties de construction exclues (§ 14.14).

**Au niveau `node`, à la construction d'une livraison** : **la version**. La version
réelle inscrite au manifeste égale celle que la construction produit. Ce contrôle
**ne descend pas au cycle de chaque modification** : le manifeste n'est réécrit que
par une exécution en navigateur, donc un simple incrément de version le rendrait
rouge à chaque modification jusqu'à ce que quelqu'un relance le pilotage. Un
contrôle qui échoue en permanence se désactive. Au cycle court, l'écart de version
est **affiché, nommé et non bloquant** ; à la livraison, il bloque.

**Au niveau navigateur, avant chaque livraison** : le scénario rejoue le parcours et
compare, étape par étape, l'empreinte d'étape et le texte relevé à ceux du
manifeste. Un écart nomme l'étape et la nature de l'écart.

Ces contrôles **refusent de passer sur un balayage vide** (§ 14.2) : « zéro capture
examinée » n'est pas « zéro capture périmée ». Et chacun est montré en train
d'échouer avant d'être retenu — une image volontairement remplacée par une version
antérieure doit faire échouer la construction.

**Ce que le contrôle d'état ne voit pas, et il faut le dire : une régression
purement visuelle à état identique.** Les styles calculés relevés en attrapent une
partie — une couleur d'état devenue grise, un contraste tombé sous le seuil — mais
une image mal cadrée, une table qui déborde ou un texte qui se chevauche passent.
La relecture humaine du § 16.1 reste la seule garde.

### 19.8 Ce qui est engendré, ce qui est écrit à la main

La frontière passe là où une divergence est **mécaniquement détectable**.

**Écrit à la main, jamais engendré** : toute phrase qui décrit une fonctionnalité,
qui dit pourquoi elle existe, et qui dit ce qu'un écran veut dire. Un texte
explicatif engendré à partir du code décrit ce que le code fait, ce que le lecteur
voit déjà sur l'image, et jamais ce qu'il cherche. Les légendes des captures
d'écran sont également manuelles : nommer ce qu'il faut regarder dans une image est
un jugement.

**Engendré** :

| contenu | source unique |
|---|---|
| les captures d'écran et leur manifeste | le scénario, et pour les images de la planche, la construction sous `node` |
| le tableau des réglages et de leurs valeurs par défaut | la même définition que lit l'interface |
| le tableau des colonnes CSV reconnues et de leurs synonymes (§ 10.1) | le module d'import |
| la liste des commandes et de leurs libellés d'historique (§ 8.2) | le registre des commandes |
| les raccourcis clavier | la table des raccourcis |
| le tableau des ratios de contraste, **par thème** (§ 14.5) | les styles relevés au pilotage |
| les grandeurs des démonstrations et leurs plafonds a priori (§ 15.1) | les fichiers de démonstration livrés, lus, jamais recopiés |
| le tableau des constantes mesurées (§ 14.1) | le banc du § 19.10 |
| le **numéro de version**, partout où il paraît, **nom de l'exécutable compris** | `version.json` (§ 18.3) |

Un tableau recopié à la main diverge du logiciel en un commit et personne ne s'en
aperçoit : c'est le même mode de défaillance que la double arithmétique du § 13.2,
transposé à la prose.

**Le mécanisme d'insertion.** Les sources de documentation portent des **marqueurs
nommés** ; la construction remplace le contenu entre marqueurs et ne touche à rien
d'autre. Elle dispose d'un **mode de vérification** qui échoue quand une région
engendrée diffère de ce qu'elle produirait : une correction faite à la main dans une
région engendrée fait échouer la construction au lieu d'être perdue au passage
suivant (§ 14.3).

**`GUIDE-WINDOWS.md` sort de la boucle** (§ 16.1). Le pilotage s'exécute sur
`web` sous Linux ; les écrans que ce guide décrit — obtenir l'exécutable, le
premier lancement, le blocage par un antivirus, l'emplacement des fichiers dans
l'explorateur — appartiennent à `electron` sous Windows et **aucun scénario ne les
produit**. Le guide les décrit en toutes lettres, ou les illustre par des images
faites à la main qui portent la mention de leur origine. Prétendre les engendrer
livrerait des images de Linux dans un guide Windows.

### 19.9 La section sur l'algorithme

Son lecteur est l'opérateur. Il l'ouvre avec **deux questions, toujours les
mêmes** : pourquoi deux propositions issues du même plan diffèrent, et pourquoi
relancer aide parfois et jamais d'autres fois. La section répond à ces deux
questions et s'arrête.

**Ce qu'elle contient, dans cet ordre.**

1. **Le problème, en une phrase** : asseoir chaque personne présente à chacun
   de ses tours de sorte que le plus mal servi rencontre le plus de monde
   possible. L'ordre par défaut le poursuit après les rencontres répétées et
   les collisions ; la section le dit en une phrase, et que l'opérateur peut
   le ranger devant elles (§ 5.7).
2. **Pourquoi il n'a pas de réponse évidente**, par un compte, pas par un mot
   savant. Douze personnes se répartissent sur quatre tables **numérotées** de
   trois de **369 600 façons pour un seul tour** — 12! divisé par 6 quatre fois —
   et sur quatre tours le nombre dépasse **10²²**. Le logiciel n'essaie pas toutes
   les combinaisons, et la petite démonstration est le plus petit cas du catalogue.
   Ce compte est vérifiable et remplace avantageusement toute affirmation sur la
   difficulté du problème.
3. **Comment le logiciel cherche** : il part d'un placement complet dont le
   point de départ dépend de la **graine**, **échange** des personnes entre
   tables, garde ce qui ne dégrade pas le placement, à score égal compris, et
   s'arrête après un **compte** de mouvements essayés, le compte d'arrêt
   (§ 5.10), ou plus tôt s'il ne reste rien à améliorer. D'où **la réponse à
   la première question** : deux recherches parties de deux points différents
   s'arrêtent sur deux placements différents, et aucun des deux n'est « le
   bon ». Cette phrase est **vérifiable, et elle est vérifiée** : un test sous
   `node` affirme que deux graines donnent deux résultats et qu'une même graine
   donne deux fois le même. Un énoncé vérifiable vieillit mieux qu'un énoncé
   vague : si le moteur est réécrit et que la phrase cesse d'être vraie, le
   test le dit.
4. **Ce que les contraintes font** : chacune est un **objectif**, pas un interdit
   (§ 5.3). Quand elles ne tiennent pas ensemble, le logiciel produit le meilleur
   compromis et dit lequel, au lieu de refuser et de ne rien montrer.
5. **Le plafond**, expliqué sur la petite démonstration : quatre tours, deux
   voisins par tour, **huit rencontres au plus sur onze personnes**. Personne ne
   peut faire mieux, et ce n'est pas un défaut du logiciel. Puis le même calcul sur
   une table de huit — quatre tours, sept voisins, **28** — et le cas des quatre
   animateurs des tables de sept de la grande démonstration, plafonnés à **24** :
   **la relance ne déplace jamais un plafond.**
6. **Ce que « minimum atteint » signifie** : le logiciel l'écrit quand la personne
   la plus mal servie atteint ce que l'arithmétique autorise au mieux, **mesuré
   contre le plafond a priori** (§ 5.5) — raison pour laquelle la grande
   démonstration ne le décerne jamais. Relancer alors ne sert plus à rien. **Et ce
   que son absence ne signifie pas** : « atteignabilité inconnue » dit que le
   logiciel ne sait pas si mieux existe, pas qu'il existe.
7. **Ce que relancer ne peut pas** : effacer une collision portée au segment
   « prouvé inévitable » (§ 12.4), ni rendre une table qui n'existe pas. Le
   diagnostic (§ 5.6) dit **avant** la recherche ce qui est hors d'atteinte et quel
   changement de configuration le lèverait — une table de plus, un tour de moins,
   une organisation redistribuée.
8. **Comment comparer deux propositions** : par le **manque**, et pourquoi les
   nombres bruts ne se comparent pas dès qu'une table est incomplète (§ 12.10.1).
   La section explique les trois chiffres de l'en-tête et, surtout, pourquoi un
   manque nul sur un itinéraire bas n'est pas une bonne nouvelle.
9. **Une lecture de l'écart entre propositions d'une même génération**, donnée pour
   ce qu'elle est : **un indice, pas une preuve**. Quand la meilleure et la pire
   proposition d'une même génération portent le même minimum, c'est le plus souvent
   qu'une borne le tient — et la tuile du § 12.2 qui affiche le plafond à côté du
   minimum le dit en un coup d'œil, là où l'écart ne fait que le suggérer.

**Ce qu'elle ne contient pas** : aucun pseudo-code, aucun nom de fonction, aucun
nom de module, aucune complexité asymptotique, aucun nom de famille d'algorithmes.
Ces éléments n'apprennent rien à l'opérateur, se périment à la première réécriture
du moteur, et **font croire au lecteur que le texte ne lui est pas destiné** —
après quoi il ne lit plus la section, qui est la seule réponse écrite à la question
qu'il posera.

La section s'appuie sur les captures d'écran `10`, `11`, `11b`, `12`, `13`,
`16`, `17` et `18` : le diagnostic, les propositions classées, les dérivées, le
profil trié, les collisions de la variante « conflit inévitable », « minimum
atteint » sur la petite démonstration, et la vue de comparaison et son
escalier. La comparaison par le manque s'y lit sur `17` et `18`, les colonnes
du tableau des propositions en donnant les chiffres ; une dérivée s'y lit sur
`11b`, qui montre qu'elle entre au même classement que son départ. Le point 3
s'appuie en outre sur `15c` : la course d'une recherche, et son plateau. Le
contraste de la variante « conflit inévitable » (§ 15.3) — une personne
déplacée d'une organisation à l'autre, et la mention bascule — est le plus
court exposé de toute la section, et il tient en deux images : `16`, « minimum
atteint » sans collision, puis `13`, les quatre collisions cumulées au segment
« prouvé inévitable ». Le point 7 le porte, puisque c'est ce que relancer ne
peut pas effacer. Une épreuve du niveau `node` refuse une section qui ne cite
pas chacune de ces captures, et un point 3 qui ne cite pas `15c` ou un point 7
qui ne cite pas `16` et `13`.

### 19.10 Le banc de mesure

La spécification exige à plusieurs endroits un seuil « mesuré » — le nombre de
sièges au-delà duquel le dessin cesse d'être lisible (§ 6.2), le seuil de
participants sous lequel la matrice se dessine (§ 12.5), la largeur de troncature
des noms longs (§ 12.6), la tolérance de la chaîne témoin
(§ 19.4), le ralentissement d'un cœur chargé (§ 5.10). Le niveau navigateur est
le seul endroit qui le peut, puisqu'une mesure sur le rendu réel est précisément
ce que `jsdom` ne sait pas faire (§ 14.4).

**La hauteur de ligne des listes de noms n'est pas au banc** : elle relève de
l'exécution (§ 14.1), qui la mesure sur la police calculée à chaque montage du
plan (§ 7.4), comme la hauteur de ce qu'une feuille imprimée porte hors de sa
zone de contenu se mesure à chaque ouverture de l'aperçu (§ 11.7). Le registre
n'écrit aucune valeur de l'une ni de l'autre.

Le logiciel porte donc, **avec le même pilote que le scénario et le même cadre
d'affichage fixé**, un banc de mesure qui produit un tableau de constantes **avec,
pour chacune, ce qu'elle mesure, sa valeur et la configuration sur laquelle elle a
été relevée** (§ 14.1). Ce tableau est une région engendrée de la documentation.
Le banc est un projet à part, hors des trois séries, que sa seule commande lance,
`make banc`, avant une livraison (§ 14.4).

**Le banc écrit un relevé versionné, jamais le registre.** Adopter une valeur est
un geste du développeur : il l'écrit au registre des constantes, la déclare
mesurée et y cite la configuration du relevé. Une garde refuse ensuite une
constante du banc déclarée mesurée que le relevé ne soutient pas, en valeur ou en
configuration. Quatre constantes sont ainsi adoptées. Deux le sont hors de la
page de qualité : le nombre de sièges lisibles, `SEUIL_SIEGES_LISIBLES`, à
**18 places**, et la tolérance de la chaîne témoin, `TOLERANCE_CHAINE_TEMOIN`,
à **0,011** — le quart de l'écart relatif qu'introduit une famille de repli
forcée, et au moins trois fois la gigue de dix mesures. L'épreuve de la police
la juge au même corps, 16 px, celui du texte courant : l'écart admis est
relatif, et l'arrondi des avances pèse plus à petit corps.

Les deux autres sont celles de la page de qualité, relevées au même banc,
chacune avec le protocole écrit à son entrée du registre :
`SEUIL_MATRICE_PARTICIPANTS`, le nombre de participants au-delà duquel une case
de la matrice tombe sous la cible de 24 px dans la largeur de la carte, au cadre
d'affichage fixé, à **44 participants** ; et `LARGEUR_TRONCATURE_NOM_PX`, la
largeur à laquelle un nom se tronque dans une étiquette de graphique, calée sur
une longueur de nom écrite au registre, composée du glyphe le plus large de
l'alphabet visé (§ 14.1), jamais sur les noms d'une démonstration, à **168 px**.
Le seuil de la matrice borne son coût et sa lisibilité au cadre fixé ; la page
éprouve en plus, par la géométrie, que les cases tiennent 24 px dans la largeur
réelle de la carte (§ 12.5). Le nombre de valeurs distinctes de manque sous
lequel la comparaison cède la place à une phrase, sur les deux profils réunis
(§ 12.10.6), appartient à la comparaison : `VALEURS_MANQUE_COURBE`, au
registre, à **3**, au statut de défaut de travail — une ou deux valeurs se
disent mieux qu'elles ne se tracent (§ 12.6). C'est une règle de forme, non une
mesure : le banc ne la relève pas, et les constantes adoptées restent quatre.

**Le relevé nomme la classe de la machine, jamais la machine.** Sa configuration
est une liste fermée : le cadre d'affichage, le facteur d'échelle, le navigateur et
sa version, la version de Node, le nombre de processeurs logiques, le
ralentissement imposé au processeur et la police rendue. Ni nom d'hôte, ni
utilisateur, ni chemin de compte, ni modèle de processeur, ni date n'y entrent, et
une garde le refuse, montrée rouge sur des valeurs inventées. Une mesure porte en
outre le ralentissement sous lequel elle s'est prise, que cite la configuration de
sa constante.

**La machine de référence est le poste de développement**, son navigateur ralenti
quatre fois pour la garde du temps par image, qui doit tenir sur la machine de
l'opérateur et non sur celle du développement. Le ralentissement à pleine charge
du § 5.10 se relève aussi, sur le poste non ralenti ; il reste à son défaut de
travail : relevé sur le poste de développement, il ne décrit pas la machine de
l'opérateur, et la mesure reste informative jusqu'à un relevé sur un portable de
sa classe.

Trois mesures qu'il faut distinguer :

- **Le seuil de 24 px du § 7.3** — en deçà duquel les sièges cessent d'être des
  cibles — est une **géométrie**. Deux captures d'écran l'encadrent délibérément, à
  cadre d'affichage fixé, et la documentation montre la bascule.
- **Le temps par image des listes de noms est une garde, pas un seuil.** Aucune
  capture d'écran ne le mesure : une image est muette sur la durée qui l'a
  produite. Le banc relève le temps par image pendant un déplacement de vue à
  plusieurs niveaux de zoom, sur la grande démonstration et ses 33 tables, listes
  forcées, sous le processeur ralenti ; un 95ᵉ centile au-delà de son critère
  fait échouer la commande. Le seuil qui retire les listes est de lisibilité, et
  relève du niveau manuel (§ 17, point 6). La mesure est permise ici : le § 14.7
  interdit `performance.now` dans le moteur et dans le générateur, pas dans un
  banc.
- **Le nombre de sièges lisibles se relève listes forcées**, sur une table seule
  au zoom ajusté : il ne dépend pas du zoom qui retire les listes (§ 6.2).

Le même banc répond au § 17, point 4 : le coût de la maximisation du plafond a
priori sur les itinéraires admissibles se relève **sous `node`** sur la grande
démonstration, sa variante et une configuration pessimiste ; il est mesuré, et le
point est tranché.

**Des mesures lui échappent et appartiennent au niveau manuel**, chacune avec son
protocole écrit à son entrée du registre. Le décalage des imprimantes visées et
leur marge non imprimable (§ 11.3, § 14.1), les corps du badge et le **corps
minimal** du plan imprimé, en deçà duquel le plan se découpe (§ 11.7), se lisent
sur une page d'essai imprimée : un banc de navigateur ne mesure pas une
imprimante. Le **seuil de lisibilité des listes de noms** (§ 17, point 6) et la
**largeur du bloc de noms** d'une table, où un nom trop long s'abrège (§ 7.4), se
lisent par une personne qui n'a pas écrit le logiciel ; le **seuil de mouvement**
qui sépare un clic d'un glisser (§ 8.4) se relève au pavé tactile de la machine
de référence, et la **durée de la pression longue** qui ouvre le menu d'une
personne (§ 7.3) à son écran tactile, d'une main que le pilote ne remplace pas.

### 19.11 Ce que le pilotage attrape, et ce qu'il n'attrape pas

Un scénario de captures d'écran **n'est pas une suite de tests**, et le confondre
avec elle donne une couverture imaginaire.

**Ce qu'il attrape réellement :**

- un écran devenu inatteignable, un bouton renommé, une étape du parcours qui
  n'existe plus — c'est-à-dire **un guide d'usage devenu faux** ;
- une page qui ne se dessine pas, une erreur non rattrapée, une promesse rejetée
  sans gestionnaire, un échec de construction de l'interface ;
- une tentative de requête hors de la boucle locale, que le § 2 interdit ;
- un **libellé manquant** — une clé affichée telle quelle, un élément vide ;
- un style qui ne s'applique pas, et un contraste tombé sous le seuil du § 14.5 ;
- une capture d'écran périmée, par le § 19.7 ;
- un chemin portant un nom de compte affiché dans l'interface.

**Ce qu'il n'attrape pas :**

- **un libellé écrit en dur.** Comparer le texte affiché au texte attendu ne
  distingue pas une chaîne venue de la table de traduction d'une chaîne écrite dans
  le composant. Le § 14.6 se garde par deux autres moyens, tous deux hors du
  parcours.
- **la justesse d'un placement.** Elle s'éprouve sous `node`, sur le moteur pur. Un
  parcours vert sur un moteur faux est exactement aussi vert. En particulier, **que
  la petite démonstration atteigne son minimum est une propriété du moteur** :
  l'étape `16` la photographie, elle ne l'établit pas.
- **le contenu d'un PDF.** Le § 11.1 l'éprouve en extrayant la couche de texte sous
  `node`. L'image tramée du § 19.6 montre une mise en page, elle ne dit rien des
  accents présents dans le fichier produit.
- **la géométrie du pointeur dans ses modes de défaillance.** Le pilote produit des
  événements que le navigateur traite comme réels, donc un glissement se conduit et
  se photographie — et le **comportement** du seuil du § 8.4 s'éprouve bel et bien.
  Ce qui échappe est ailleurs : **la valeur** du seuil, qui relève du niveau
  manuel (§ 19.10) ;
  `pointercancel`, qui n'arrive que d'un geste système ou d'une paume ; et
  `touch-action`, qui ne se juge que sous un vrai doigt. Ce sont les pannes que le
  § 7.3 nomme, et elles restent au niveau manuel.
- **les garanties de panne du § 8.8.** Elles sont des propriétés de
  l'implémentation `electron` ; le pilotage s'exécute sur `web`. **Aucune
  capture d'écran n'établit quoi que ce soit sur la résistance à une panne.**
- **la lisibilité.** Une image nette d'un plan illisible est une image nette.
- **la justesse du français**, et le fait qu'une phrase du guide dise bien ce que
  l'écran fait.
- **le fait que le parcours soit celui de l'opérateur.** Un scénario vert prouve que
  le script et le logiciel s'accordent. Qu'ils décrivent tous deux la bonne soirée
  reste la charge du niveau manuel (§ 14.4) et de la relecture par quelqu'un qui n'a
  pas écrit le logiciel (§ 16.1).

**La règle qui empêche le faux vert** : une étape qui ne trouve pas son élément
échoue, elle ne passe pas son tour ; une exécution qui produit zéro capture d'écran
échoue ; une construction dont une étape a échoué ne republie pas les images du
passage précédent ; et chaque étape ajoutée est montrée en train d'échouer sur le
code d'avant (§ 14.2). Un scénario qui avale ses échecs pour « toujours produire
les images » rend exactement le service inverse de celui qu'on lui demande.

