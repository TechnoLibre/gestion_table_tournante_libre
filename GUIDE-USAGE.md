# Gestion table tournante Libre — le guide d’usage

Ce guide suit une soirée du début à la fin : ouvrir un événement, y mettre les
participants et les tables, laisser le logiciel chercher des placements, en
retenir un, l’ajuster, puis imprimer. Il s’adresse à la personne qui prépare la
soirée ; il ne suppose rien de la façon dont le logiciel est écrit.

Les écrans montrés ici se reproduisent. Le parcours crée un événement nommé
« Soirée d’essai », y importe le fichier `exemples/participants_cas_limites.csv`
livré avec le logiciel, donne une étiquette à une personne, pose deux tables et
leurs objectifs, importe `exemples/objectifs_cas_limites.csv`, désigne un
animateur, règle l’ordre des priorités et génère avec la graine 4242 et un
compte d’arrêt de 300, les autres réglages de génération gardant leur valeur
par défaut ; les étapes où la taille compte chargent la « Grande
démonstration » depuis le premier écran. Suivez les mêmes gestes, avec les
mêmes réglages, et vous verrez les mêmes écrans.

Les étapes sont **un ordre de lecture, pas un assistant** : le logiciel
n’enchaîne rien et ne vous oblige jamais à revenir au début. Une faute de
saisie découverte au moment d’imprimer se corrige à l’endroit où elle se trouve.

Pour installer et lancer le logiciel sous Windows, et savoir où vont vos
fichiers, lisez `GUIDE-WINDOWS.md`.

## Avant de commencer : lecture, écriture, et trois garanties

**Tout événement s’ouvre en lecture.** Rien ne s’y modifie tant que vous n’avez
pas cliqué sur « Modifier », toujours à la même place, en haut de l’écran. La
bande de couleur sous le bandeau, le libellé à côté de « Modifier » et le
bandeau disent dans quel mode vous êtes. Après un
moment d’inactivité, le logiciel revient seul en lecture, entre deux gestes et
jamais au milieu de l’un d’eux.

**Un plan bloqué** refuse toute modification, import compris, jusqu’à ce que
vous le débloquiez. L’état du plan — « Brouillon », « Proposé », « Retenu »,
« Bloqué » — se lit et se change en haut de l’événement.

Tout geste qui modifie l’événement suit trois règles :

1. une fois achevé, il est **à la fois** dans l’historique et sur le disque ;
   il n’y a jamais rien à enregistrer ;
2. il se reprend : « Défaire » et « Refaire » remontent et redescendent
   l’historique, qui ne perd jamais rien ;
3. s’il est refusé, le refus dit pourquoi et, quand un geste le lève, lequel —
   à l’endroit même où vous avez agi : sur la place, sur la ligne de l’aperçu
   d’import, sur le champ. Seul un geste qui détruit de la saisie ouvre une
   fenêtre de confirmation.

Lire le diagnostic et comparer les propositions ne modifient rien : ces écrans
restent utilisables en lecture.

## Étape 1 — Ouvrir ou créer l’événement

Le premier écran est la liste des événements. Quand elle est vide, elle n’est
jamais une page blanche : elle offre de créer un événement et de charger l’une
des démonstrations livrées. Elle affiche aussi le dossier de travail, avec la
commande qui l’ouvre dans l’explorateur.

![Le premier écran : le dossier de travail, la création d’un événement, les démonstrations](doc/captures/01-premier-ecran.png)

*Regardez la partie « Démonstrations » : chacune se charge comme un nouvel
événement, ouvert en lecture, sans toucher aux autres. Sous « Créer un
événement », seul le nom est exigé ; la date est facultative.*

Ouvrir un événement existant ne réécrit jamais son fichier. Créer un événement,
ou charger une démonstration, en écrit un nouveau.

## Étape 1b — Passer en écriture

L’événement s’ouvre en lecture. Tentez un geste qui modifie, par exemple
« Ajouter une table ronde » dans la section « Tables et tours » : le refus
s’affiche à côté du bouton, et propose « Modifier ».

![Un ajout de table refusé en lecture, et la commande « Modifier »](doc/captures/01b-passer-en-ecriture.png)

*Le refus apparaît là où vous avez cliqué, sans fenêtre. Le mot « Lecture »
figure dans le bandeau, dans la bande de mode et à côté de « Modifier ».*

Cliquez sur « Modifier » : la bande et le libellé passent en écriture, et le
même geste réussit. « Revenir en lecture » fait l’inverse.

## Étape 2 — Importer la liste des participants

Cette étape est facultative : la liste peut aussi se saisir à la main
(étape 3). Dans la section « Import », choisissez un fichier CSV ou déposez-le
sur la fenêtre. **Rien ne s’importe avant l’aperçu.**

![L’aperçu d’un import : encodage, séparateur, colonnes reconnues](doc/captures/02-import-apercu.png)

*L’aperçu nomme l’encodage et le séparateur que le logiciel a reconnus, dit ce
que devient chaque colonne — « Organisation » devient l’appartenance, « Rôle »
le titre pressenti — et signale une colonne non reconnue, ignorée. Vérifiez ces
trois lignes avant d’importer.*

Le mode de l’import se choisit au même endroit : « Ajouter » ajoute des
personnes, « Mettre à jour » met à jour celles que le fichier reconnaît sans
effacer les champs qu’il ne porte pas, « Remplacer » remplace la liste et
annonce d’abord ce qu’il détruit.

Un fichier enregistré par un tableur sous Windows n’est souvent pas en UTF-8.
Le logiciel le reconnaît et le dit :

![L’aperçu du même fichier enregistré en windows-1252 : les accents intacts](doc/captures/02b-import-cp1252.png)

*Ici l’encodage lu est « windows-1252 » et le séparateur la virgule. Vérifiez
un nom accentué : « Givrecœur » et « Héloïse » doivent s’afficher tels quels. Un
prénom écrit « HÃ©loÃ¯se » au lieu de « Héloïse » trahit un encodage mal lu, et
rien d’autre ne vous en avertirait.*

Après l’import, le rapport compte ce qui est entré :

![Le rapport d’import : personnes ajoutées, orthographes fondues, lignes refusées](doc/captures/03-import-rapport.png)

*Le rapport compte les personnes ajoutées, mises à jour, inchangées ou
retirées, regroupe les orthographes d’une même appartenance qu’il a fondues, et
liste les lignes refusées avec leur motif. « Enregistrer les lignes refusées »
les écrit dans un fichier, pour les corriger dans un tableur et les réimporter.
L’import entier compte pour un seul geste : « Défaire » le reprend d’un coup.*

Un import est refusé sur un plan bloqué ; le message nomme la commande qui
débloque.

## Étape 3 — Compléter la liste à la main

Dans la section « Participants », la grille se modifie directement. Seul le nom
est exigé ; le logiciel n’invente aucune valeur manquante. La ligne « Ajouter
une personne » ajoute quelqu’un ; une plage de cellules copiée d’un tableur et
collée dans la grille passe par l’aperçu d’import.

![La grille des participants, triée par nom, avec une personne exclue](doc/captures/04-grille-participants.png)

*Le compte des participants égale celui de l’import. La personne marquée
« exclue » reste dans la liste mais n’est plus placée, et ne compte plus dans
aucune statistique : « Réintégrer » la remet. Cliquez sur un en-tête de colonne
pour trier, tapez dans « Filtrer » pour réduire la liste.*

« Exporter la liste » écrit la grille dans un fichier CSV. L’export écrit
chaque valeur telle qu’elle a été saisie, sans rien y ajouter : un tableur qui
l’ouvre peut prendre pour une formule une cellule qui commence par « = »,
« + », « - » ou « @ ». Si une valeur commence ainsi, ouvrez le fichier par la
commande d’import de texte du tableur, colonnes en texte.

Chaque personne peut porter des **étiquettes** — « finance », « bénévole »,
« Montréal » —, que les objectifs des tables attendent (étape 4). Une colonne
« Étiquettes » du fichier les importe ; la fiche d’une personne, ouverte par
« Fiche » dans la grille, les montre et les modifie. Elles ne sont exigées
nulle part.

![La fiche d’une personne : ses étiquettes, le champ d’ajout, une orthographe reçue sous celle de l’événement](doc/captures/04a-etiquettes.png)

*Chaque étiquette est une pastille grise, suivie de sa commande « Retirer ».
Tapez une ou plusieurs étiquettes séparées par une virgule, puis « Ajouter »
ou Entrée. Ici, « FINANCE » s’enregistre sous « Finance », l’orthographe que
l’événement porte déjà, et le logiciel le dit sous le champ : une même
étiquette ne s’écrit jamais de deux façons. La légende, au-dessus de la
grille et hors de cette image, compte les personnes qui portent chaque
étiquette.*

## Étape 4 — Préparer les tables

Dans la section « Tables et tours », fixez d’abord les **places par défaut**,
puis ajoutez les tables, rondes ou carrées. Chaque table suit le défaut, ou
porte son propre nombre de places : on dit alors qu’elle est surchargée.

![Deux tables de huit places : l’une suit le défaut, l’autre est surchargée](doc/captures/05-tables-etat.png)

*Les deux tables ont le même nombre de places, mais l’une « Suit le défaut » et
l’autre est « Surchargée » : seule la première suivra un changement du défaut.
« Réaligner » ramène une table surchargée au défaut.*

Une table peut aussi porter un **objectif** : les étiquettes des personnes
qu’elle attend, sous la règle « au moins une » (OU) ou « toutes » (ET). Un
objectif vaut pour la soirée, ou pour un tour désigné, dont l’objectif
remplace alors celui de la soirée. Il ne fixe personne : il oriente la
recherche.

![Deux objectifs : la soirée de la table 1 suit la règle par défaut, le tour 1 de la table 2 porte la sienne](doc/captures/05a-objectifs-tables.png)

*La table 1 attend « Finance » toute la soirée, sous la règle par défaut,
que son choix nomme : « selon le réglage général (au moins une) ». Au tour 1,
la table 2 attend les personnes qui portent « Montréal » **et** « bénévole » :
« Règle propre » le dit. Aucune personne présente ne porte les deux, et le
logiciel le signale sous l’objectif. La règle par défaut se règle avec les
places par défaut et le nombre de tours ; la changer ne touche pas une règle
propre. « Retirer l’objectif » ne demande pas de confirmation : « Défaire » le
rend.*

Les objectifs s’importent aussi d’un fichier CSV, par le même aperçu que les
participants : cochez « Objectifs de table » avant de choisir le fichier.

![L’aperçu d’un fichier d’objectifs : les lignes refusées et leur motif, les orthographes fondues](doc/captures/05b-import-objectifs.png)

*Chaque ligne refusée dit pourquoi : une table que la soirée n’a pas, un tour
au-delà du nombre de tours, une règle inconnue, un objectif déjà donné plus
haut pour la même table et le même tour. Les orthographes d’une même étiquette
sont fondues sous celle que l’événement porte déjà. « Mettre à jour » remplace
les objectifs que le fichier nomme et garde les autres ; « Remplacer » les
retire tous d’abord, et l’annonce.*

Changer le défaut ne s’applique pas tout de suite : le logiciel annonce d’abord
la conséquence, chiffrée.

![L’annonce d’un changement de défaut, avant application](doc/captures/06-defaut-consequence.png)

*L’annonce dit combien de tables suivent le défaut et ce qu’elles deviennent,
lesquelles, surchargées, ne changent pas, et le total des sièges contre le
nombre de participants. Choisissez « Appliquer », « Appliquer et réaligner la
surchargée » ou « Garder le défaut actuel ». Une baisse qu’une seule table
refuse est refusée en entier.*

La section « Plan » montre les tables à l’échelle :

![Le plan des tables, leur échelle graphique et la mention « disposition relative »](doc/captures/07-plan-tables.png)

*Chaque table se dessine à sa taille réelle, avec ses sièges numérotés. Tant
qu’aucune dimension de salle n’est saisie, la mention « disposition relative »
rappelle que l’encombrement dans la salle n’est pas vérifié. Faites glisser une
table pour la déplacer ; « Ajuster » cadre le plan entier.*

Sur un grand plan, le dessin s’adapte au zoom. Zoomé, chaque siège se vise :

![La grande démonstration zoomée : chaque siège est une cible](doc/captures/07a-cibles-sieges.png)

*À ce zoom, un clic ou un dépôt vise le siège sous le pointeur.*

Au zoom qui montre toute la salle, les sièges deviennent trop petits pour être
visés un par un, et c’est la table entière qui reçoit le geste :

![La grande démonstration au zoom ajusté : chaque table est une cible](doc/captures/07a-cibles-tables.png)

*Ici, un dépôt vise la table ; zoomez pour choisir un siège précis.*

## Étape 5 — Fixer le nombre de tours

Le nombre de tours se règle dans la même section. Retirer un tour puis le
remettre retrouve intactes les réservations valables à tous les tours. En
revanche, retirer le tour *r* détruit les réservations posées sur ce seul tour,
et le logiciel le dit **avant** d’appliquer :

![L’annonce d’un retrait de tour : la réservation qu’il emporte](doc/captures/07b-nombre-de-tours.png)

*L’annonce nomme chaque réservation détruite, avec sa personne, sa table et
son tour. « Annuler » ne change rien.*

Les placements déjà générés ne sont pas tronqués : ils restent entiers, mais ne
décrivent plus la soirée, et le logiciel nomme ceux que le changement touche.

## Étape 6 — Désigner les animateurs, table par table

Cette étape est facultative : une soirée sans animateur est valide. Le
logiciel ne répartit pas les animateurs : vous désignez vous-même **quelle
personne anime quelle table**.

Choisissez la personne — dans la « Réserve » du plan, ou par « Voir sur le
plan » depuis la grille —, puis la place : « Désigner » pose d’un seul geste une
réservation valable à tous les tours et un titre de place, par exemple
« animation ». Les deux ensemble font l’animateur. « Réserver » pose une
réservation seule, pour un tour ou pour tous ; « Donner un titre » pose un
titre seul, que personne n’occupe encore.

![Un animateur désigné, un titre non pourvu, et les deux listes de travail](doc/captures/08-animateurs-designes.png)

*À la table 1, le siège 1 porte un cadenas fermé et un anneau : réservé à tous
les tours, à l’animateur. À la table 2, le siège 1 est hachuré avec un cadenas
ouvert : un titre « animation » attend son titulaire. La liste des sièges
énonce les deux en toutes lettres. À droite, les « Listes de travail » montrent
ce qui reste à faire : les titres de place non pourvus, et les personnes au
titre pressenti qui ne sont réservées nulle part.*

Une table peut avoir zéro, un ou plusieurs animateurs, mais jamais plus
d’animateurs que de sièges. Une table dont tous les sièges sont réservés est
acceptée et signalée : elle ne tourne plus. Quand les sièges ne sont pas
attribués, « la place » est la table entière, qui porte un compte de titres.

## Étape 7 — Placer des participants à la main

Les mêmes gestes posent des réservations ordinaires, pour un tour ou pour tous.
Le logiciel refuse de déposer quelqu’un sur une place réservée à un autre, et
dit pourquoi sur la place même :

![Un dépôt refusé sur une place réservée, et le geste qui le lèverait](doc/captures/09-refus-sur-place.png)

*Le refus s’affiche sur le siège visé, nomme sa cause — le siège est réservé à
une autre personne à tous les tours — et le geste qui la lève : déplacer cette
réservation. Aucune fenêtre ne s’ouvre, rien ne s’écrit.*

Déplacer une réservation est un geste à part : « Déplacer sa réservation »,
dans le menu de la personne.

## Étape 8 — Lire le diagnostic

Le diagnostic se calcule seul, avant toute recherche : il n’y a rien à
demander. Il dit ce que la configuration rend inévitable, combien, et ce qui le
rendrait évitable.

![Le diagnostic de la grande démonstration](doc/captures/10-diagnostic.png)

*Sur la grande démonstration, le diagnostic donne le **plafond a priori** — le
plus de personnes qu’on puisse rencontrer, ici différent pour les animateurs des
petites tables et pour les autres —, les **retours imposés** par les
réservations, comptés à part de ceux que choisit la recherche, et le
**plancher de l’écart d’itinéraire**. Chaque ligne dit ce qui la ferait bouger,
et ce qu’aucune relance ne changera.*

Le même diagnostic s’affiche à côté du plan, pendant que vous préparez les
tables : chaque appartenance trop nombreuse pour ses tables y annonce les
retrouvailles qu’elle imposera.

## Étape 9 — Générer

Dans la section « Génération », réglez au besoin la **graine**, le nombre de
**propositions par génération** et le **compte d’arrêt**, puis cliquez sur
« Générer ». Les réservations des étapes 6 et 7 sont honorées ; la recherche
place les autres personnes autour.

Les propositions montrées ci-dessous, et les écrans qui en découlent aux
étapes 10 et 11, viennent d’une génération faite avec la graine 4242 et un
compte d’arrêt de 300, sous les objectifs de l’étape 4 et l’ordre des
priorités montré ci-dessous ; les autres réglages gardent leur valeur par
défaut.
Le compte d’arrêt par défaut, bien plus grand, cherche plus longtemps et donne
d’autres propositions : écrivez ces deux valeurs pour retrouver les mêmes.

Les **cœurs de calcul** sont automatiques par défaut, un par processeur
logique du poste ; vous pouvez aussi en fixer le nombre. Ce réglage vaut pour la
séance, sur ce poste, et ne s’enregistre pas dans l’événement. Le logiciel
affiche la durée du dernier calcul et estime celle de la prochaine génération ;
une génération qui s’annonce longue demande d’abord confirmation.

Chaque génération **ajoute** ses propositions aux précédentes, et un seul
classement les ordonne toutes. Le logiciel marque dans l’historique l’instant
qui précède chaque génération, pour y revenir.

Au même endroit, l’**ordre des priorités** dit ce que la recherche poursuit
d’abord et ce que le classement compare. Par défaut, chaque critère est seul à
son palier. Les boutons d’un critère le montent ou le descendent d’un palier,
ou le joignent au palier du dessus, où chacun reçoit un poids ; « Rétablir
l’ordre par défaut » revient au départ. Un critère que ses cases ne cochent
pas garde son rang, mais ne compte nulle part.

![L’ordre des priorités : un palier de deux critères et leurs poids, les animateurs décochés](doc/captures/10a-ordre-priorites.png)

*Ici, l’excédent de collisions et les tours hors objectif partagent le
palier 2, aux poids 1 et 3 : le classement y compare l’excédent plus trois
fois les tours hors objectif. « Animateurs non rencontrés » est marqué
« décoché » : la case « Rencontrer le plus d’animateurs différents » ne l’est
pas. Au-dessus de la liste, hors de l’image, le choix « Objectifs des
tables : chercher d’abord » reste à son défaut, « le plus de places
servies ».*

![Les propositions classées, l’ordre du classement écrit au-dessus, le tableau défilé jusqu’aux colonnes des objectifs](doc/captures/11-propositions.png)

*Le tableau range les propositions selon l’ordre écrit au-dessus de lui,
celui des priorités réglé plus haut : d’abord l’écart au plafond a priori,
puis, ensemble, l’excédent de collisions et les tours hors objectif avec
leurs poids, et ainsi de suite, chaque critère au plus faible d’abord. Plus
large que l’écran, le tableau défile de côté ; il est montré ici défilé vers
la droite : la diversité des appartenances rencontrées, le manque et le
plafond a priori, puis, en dernier groupe, les objectifs des tables — les
tours hors objectif et le moins de tours servis selon l’objectif. À sa
gauche, hors de l’image, viennent le rang, la proposition, les personnes
distinctes rencontrées, les collisions entre personnes d’une même
appartenance et les rencontres répétées.*

## Étape 10 — Comparer, et retenir

Comparer se fait dans le [tableau classé](doc/captures/11-propositions.png) de
la section « Propositions ». La première ligne est la meilleure selon le
classement ; les colonnes du **manque** — « Plus grand manque », « Personnes à
qui il en manque », « Écart d’itinéraire maximal » — permettent de comparer deux
propositions même quand des tables sont incomplètes (voir « Comment le logiciel
cherche », plus bas). « Imposé par les réservations » sépare ce que vos
réservations imposent de ce que la recherche a choisi.

« Voir sur le plan » montre une proposition sur le plan, sans rien écrire.
« Retenir » en fait le **placement retenu** : l’état du plan passe à
« Retenu », et les autres propositions restent dans la liste. Retenir une autre
proposition alors que le retenu a été ajusté à la main détruit ces ajustements :
une fenêtre le dit avant.

La liste des événements résume ensuite le retenu par l’écart de sa somme de
redondance d’appartenance à la cible de la soirée.

Retenir n’est pas obligatoire, mais tout ce qui s’imprime sans placement retenu
porte la mention BROUILLON (étape 12).

## Étape 11 — Ajuster à la main

Sur le placement retenu, le geste de l’étape 7 déplace maintenant une personne
réelle, au tour affiché. **Le geste est le même, ce qu’il change ne l’est pas,
et l’interface le dit** pendant que vous faites glisser :

![Un déplacement dans le placement retenu, annoncé pendant le glissement](doc/captures/19-ajustement.png)

*Pendant le glissement, l’étiquette qui suit le pointeur dit « déplace dans le
placement retenu » : la personne change de place dans le plan qui sera
imprimé, sans poser de réservation. Le titre du plan, « Placement retenu »,
dit quel placement vous regardez.*

Les indicateurs du tableau des propositions suivent l’ajustement.

En lecture, aucun de ces gestes ne passe :

![Le plan en lecture : la bande de mode, le libellé, et un geste refusé](doc/captures/20-mode-lecture.png)

*La bande de mode et le libellé « Lecture » le disent au-dessus du plan, et le
bandeau le répète.
Glisser une personne ou une table, tirer une poignée, poser une réservation :
chaque geste est refusé avec « Modifier » pour remède, et rien ne change sur le
disque.*

## Étape 12 — Imprimer

La commande « Imprimer… », en haut de l’événement, ouvre l’**aperçu
d’impression**, qui montre les pages telles qu’elles sortiront : le **plan**
de salle, la **liste d’accueil** et la **feuille par table**. Le plan se
découpe en pages quand il ne tient pas lisiblement sur une seule ; chaque page
porte son repère et ses voisines. Au premier aperçu, le logiciel demande le
format du papier, A4 ou Lettre, puis le garde pour ce poste ; il se change
ensuite à tout moment.

La **planche de badges** est le seul document produit en PDF : quatre badges
par feuille A4, deux par feuille Lettre, avec leurs traits de coupe. Sa
première page est une **feuille de contrôle** : mesurez son échelle sous une
règle avant d’imprimer toute la rame, pour vérifier que l’imprimante n’a pas
réduit la page. Les badges se tirent du placement retenu, ou d’une proposition
choisie.

Imprimer et produire la planche ne modifient pas l’événement : ces commandes
restent disponibles en lecture et sur un plan bloqué. Le logiciel n’interdit
pas d’imprimer un plan qui n’est pas retenu, mais il le marque **BROUILLON**
en filigrane ; une planche tirée d’une proposition l’est toujours. Chaque page
imprimée porte en pied le nom et la date de l’événement, le tour, l’instant où
le placement a pris sa forme, et la version du logiciel.

L’aperçu imprime ce que le plan montre. Une proposition ouverte depuis la
section « Propositions » s’imprime en brouillon, même quand un autre placement
est retenu :

![L’aperçu du plan d’une proposition non retenue, sous le filigrane BROUILLON](doc/captures/22-plan-brouillon.png)

*Le filigrane BROUILLON couvre chaque page. Sous le plan, le repère de la
page, l’échelle graphique et la mention « disposition relative » ; en pied, le
tour et l’instant où cette proposition a été générée.*

Revenu au placement retenu, l’aperçu sort sans filigrane :

![L’aperçu du plan retenu, sans filigrane](doc/captures/23-plan-retenu.png)

*Le même cadrage, sur le placement retenu : le filigrane a disparu, et le pied
porte l’instant de ce placement. C’est cette page qui part à l’imprimante pour
le montage de la salle.*

La planche se produit dans la section « Badges » de l’événement. On y choisit
l’imposition — feuille par feuille, ou en pile pour un massicot qui tranche
toute la rame — et l’ordre des badges, alphabétique ou par table du premier
tour. « Préparer » annonce ce qui sortira : le nombre de badges et de planches,
les homonymes, les caractères que la police ne dessine pas. « Produire la
planche » écrit le PDF à côté des fichiers de l’événement et en affiche le
chemin ; dans un navigateur, le PDF se télécharge. Sa première page est la
feuille de contrôle :

![La feuille de contrôle de la planche : la règle de 100 mm, puis les comptes de la soirée](doc/captures/24-badges-controle.png)

*La règle du haut mesure 100 mm sur le papier : posez-y une vraie règle. Si les
deux ne coïncident pas, l’imprimante a mis la page à l’échelle, et les badges
ne tomberont pas sur les traits de coupe. Suivent le format du badge et du
papier, l’imposition, le nombre de planches, les comptes de la soirée — un
badge par personne présente, les exclus comptés à part —, l’instant du
placement et la version du logiciel.*

Viennent ensuite les planches, quatre badges A6 par feuille A4 :

![La première planche : quatre badges A6 et leurs traits de coupe](doc/captures/25-badges-planche.png)

*Chaque badge porte le nom, l’appartenance et la table de chaque tour ; en
pied, le nom de l’événement et l’instant du placement. Les traits fins
marquent la coupe : un vertical au milieu de la feuille, un horizontal sous
chaque rangée de badges.*

Une fois le plan imprimé, bloquez-le : choisissez l’état « Bloqué » en haut de
l’événement. Plus rien ne le modifie, jusqu’à « Débloquer ».

**Ce qui doit avoir eu lieu.** Il faut des tables (étape 4) et au moins une
personne (étape 2 ou 3) avant de générer ; il faut avoir retenu un placement
(étape 10) pour qu’une impression ne sorte pas en brouillon. Tout le reste est
facultatif, et se reprend dans n’importe quel ordre.

## Comment le logiciel cherche

Cette section répond à deux questions : pourquoi deux propositions issues du
même plan diffèrent, et pourquoi relancer aide parfois, et parfois jamais.

### Le problème

Asseoir chacun, à chaque tour, de sorte que la personne la plus mal servie
rencontre le plus de monde possible. C’est l’objectif de l’ordre par défaut ;
vous pouvez en ranger d’autres devant, dans l’ordre des priorités de la
section « Génération ».

### Pourquoi il n’a pas de réponse évidente

Prenez les douze personnes de la petite démonstration et ses quatre tables
numérotées de trois places. Pour un seul tour, il y a 369 600 façons de les
répartir : on compte toutes les façons d’aligner les douze personnes, puis on
cesse de distinguer l’ordre des trois personnes d’une même table. Sur quatre
tours, le nombre dépasse 10²². Le logiciel n’essaie donc pas toutes les
combinaisons — et la petite démonstration est déjà le plus petit cas qu’il
livre.

### Comment la recherche avance

Le logiciel part d’un placement complet, dont le point de départ dépend de la
**graine**. Il **échange** des personnes entre les tables, garde ce qui ne
dégrade pas le placement, et s’arrête après un **compte** de mouvements
essayés — le compte d’arrêt de la section « Génération » —, ou plus tôt s’il
ne reste rien à améliorer.

D’où la réponse à la première question : deux recherches parties de deux
points différents s’arrêtent sur deux placements différents, et aucun des deux
n’est « le bon ». La même graine, sur la même configuration et les mêmes
réglages, redonne exactement les mêmes propositions ; une autre graine en donne
d’autres. Cette phrase est vérifiée par une épreuve du logiciel.

### Ce que font les contraintes

« Séparer les appartenances », « Nouveaux voisins à chaque tour », « Nouvelle
table à chaque tour », « Varier les appartenances rencontrées » sont des
**objectifs**, pas des interdits. Quand ils ne tiennent pas tous ensemble, le
logiciel produit le meilleur compromis et dit lequel, au lieu de refuser et de
ne rien montrer.

### Le plafond

Dans la petite démonstration, chacun a deux voisins par tour : en quatre tours,
il rencontre au plus 8 personnes, sur onze personnes qu’il pourrait rencontrer.
Personne ne peut faire mieux, et ce n’est pas un défaut du logiciel. À une
table de huit, chacun a sept voisins : en quatre tours, 28 rencontres au plus.
Dans la grande démonstration, les quatre animateurs des tables de sept restent
à leur table toute la soirée, et leur plafond vaut 24. Le diagnostic affiche
ces plafonds avant toute recherche
([le diagnostic de la grande démonstration](doc/captures/10-diagnostic.png)) :
**la relance ne déplace jamais un plafond.**

### Ce que « minimum atteint » veut dire

La colonne « Certificat » du tableau des propositions écrit « minimum atteint »
quand chaque personne rencontre autant de monde que son plafond a priori le
permet : personne ne peut faire mieux, et relancer ne sert plus à rien. Le
minimum se mesure contre le plafond a priori, pas contre ce qu’un placement
donné rendait possible. C’est pourquoi la grande démonstration ne l’obtient
jamais : son diagnostic prouve, avant toute recherche, que des personnes
finiront sous leur plafond a priori — c’est le plancher de l’écart
d’itinéraire.

Son absence ne dit pas qu’un meilleur placement existe. « Atteignabilité
inconnue » dit que le logiciel ne sait pas si mieux est possible.

### Ce que relancer ne peut pas

Relancer n’efface pas les collisions que le diagnostic annonce comme
inévitables — les « au moins » de chaque appartenance trop nombreuse pour ses
tables —, et ne crée pas une table qui n’existe pas. Le diagnostic dit **avant**
la recherche ce qui est hors d’atteinte, et quel changement de configuration le
lèverait : une table de plus, un tour de moins, une appartenance mieux
répartie.

### Comparer deux propositions

Comparez par le **manque** : pour chaque personne, l’écart entre ce que son
placement lui permettait de rencontrer et ce qu’elle rencontre. Les nombres
bruts ne se comparent plus dès qu’une table est incomplète : qui s’assied à
cette table rencontre moins de monde, et cela change d’une proposition à
l’autre.

Trois colonnes le disent ([le tableau classé](doc/captures/11-propositions.png)).
« Plus grand manque » : de combien la personne la plus privée l’est-elle, compte
tenu de là où ce placement l’a assise. « Personnes à qui il en manque » : une
seule personne, ou quarante ? Les deux appellent des décisions opposées —
déplacer quelqu’un, ou ajouter une table. « Écart d’itinéraire maximal » : la
proposition a-t-elle perdu avant même que chacun s’asseye, en envoyant
quelqu’un à des tables incomplètes ou trop souvent aux mêmes tables ?

C’est la troisième colonne qui évite le contresens : une personne laissée en
réserve pendant presque toute la soirée a un manque nul, puisqu’elle n’avait
presque personne à rencontrer. Un manque nul sur un itinéraire bas n’est pas
une bonne nouvelle.

### L’écart entre les propositions d’une génération

Quand la meilleure et la moins bonne proposition d’une même génération
atteignent le même minimum, c’est le plus souvent qu’une borne le tient, et
relancer n’y changera rien. C’est **un indice, pas une preuve**. Le plafond a
priori, que le diagnostic affiche, le dit d’un coup d’œil : quand le minimum
d’une proposition l’égale, c’est la borne qui le tient, et aucune relance ne
fera mieux.

## Annexe A — Les réglages et leurs valeurs par défaut

Les réglages que l’événement enregistre, l’écran qui les montre et leur valeur
à la création d’un événement. Les cœurs de calcul n’y figurent pas : c’est un
réglage du poste, pour la séance, automatique par défaut (étape 9).

<!-- engendre:debut reglages -->

| Réglage | Écran | Valeur par défaut |
|---|---|---|
| Propositions par génération (nombre de propositions) | Génération | 5 |
| Compte d'arrêt (mouvements évalués par proposition) | Génération | 200 000 |
| Historique d'acceptation (longueur, en mouvements) | Génération | 1 000 |
| Séparer les appartenances | Génération | cochée |
| Nouveaux voisins à chaque tour | Génération | cochée |
| Nouvelle table à chaque tour | Génération | cochée |
| Varier les appartenances rencontrées | Génération | cochée |
| Respecter les objectifs des tables | Génération | cochée |
| Rencontrer le plus d'animateurs différents | Génération | décochée |
| Attribuer les sièges | Génération | décochée |
| Objectifs des tables : chercher d'abord | Génération | le plus de places servies |
| Ordre des priorités | Génération | écart au plafond a priori, puis excédent de collisions, puis collisions cumulées, puis tours hors objectif, puis rencontres répétées et retours, puis animateurs non rencontrés, puis redondance d'appartenance |
| Cible de la somme de redondance | Propositions | 1 000 |

<!-- engendre:fin reglages -->

## Annexe B — Les colonnes reconnues à l’import

Chaque colonne que l’import reconnaît, sous son en-tête d’export, et les autres
intitulés qu’il accepte pour elle. Les intitulés se comparent sans égard aux
majuscules ni aux accents.

<!-- engendre:debut colonnes-csv -->

| Colonne | Synonymes reconnus |
|---|---|
| `nom` | — |
| `prenom` | — |
| `appartenance` | `organisation`, `entreprise`, `équipe` |
| `courriel` | — |
| `titre_pressenti` | `titre`, `rôle` |
| `exclu` | — |
| `notes` | — |
| `etiquettes` | `étiquette`, `mots-clés` |

<!-- engendre:fin colonnes-csv -->

Les objectifs des tables s’importent par leur propre fichier, qui reconnaît
ces colonnes de la même façon ; la table se désigne par le numéro qu’elle
affiche sur le plan.

<!-- engendre:debut colonnes-objectifs -->

| Colonne | Synonymes reconnus |
|---|---|
| `table` | — |
| `tour` | — |
| `objectif` | `objectifs` |
| `regle` | `règle` |

<!-- engendre:fin colonnes-objectifs -->

## Annexe C — Les commandes et leur trace dans l’historique

Chaque geste qui modifie l’événement, et la ligne qu’il laisse dans
l’historique ; les noms des exemples sont inventés.

<!-- engendre:debut commandes -->

| Commande | Libellé d'historique (exemple) |
|---|---|
| `ajouterParticipant` | Ajouté Iris Ombrelle |
| `modifierParticipant` | Modifié Ondine Lacasse : courriel |
| `changerEtiquettes` | Étiquettes de Iris Ombrelle : ajouté « finance » |
| `exclureParticipant` | Exclu Théo Pervenche |
| `reintegrerParticipant` | Réintégré Théo Pervenche |
| `supprimerParticipant` | Supprimé Ondine Lacasse |
| `importerParticipants` | Importé 12 participants |
| `importerObjectifs` | Mis à jour les objectifs de table par import : 3 ajoutés, 1 remplacé |
| `changerEtat` | Plan passé à l'état « Bloqué » |
| `debloquer` | Plan débloqué, état « Retenu » |
| `enregistrerGeneration` | Généré 5 propositions (n° 3 à 7) |
| `retenirProposition` | Retenu la proposition n° 3 |
| `effacerPropositions` | Effacé 4 propositions, gardé la retenue (n° 2) |
| `creerTable` | Ajouté la table 3 |
| `supprimerTable` | Supprimé la table 2 ; retirés : 2 réservations et 1 titre |
| `deplacerTable` | Déplacé la table 3 |
| `changerPlacesTable` | Table 5 : 10 places |
| `realignerTable` | Table 5 : suit le défaut (8 places) |
| `changerDefaut` | Sièges par défaut : 10 ; 4 tables réalignées |
| `changerTours` | Nombre de tours : 3 ; 2 réservations retirées |
| `modifierReglage` | Séparer les appartenances : désactivé |
| `changerCibleRedondance` | Cible de la somme de redondance : 1200 |
| `poserObjectif` | Table 3 : objectif de la soirée « finance », règle par défaut |
| `retirerObjectif` | Table 3, tour 2 : objectif retiré |
| `changerRegleObjectifs` | Règle par défaut des objectifs : toutes les étiquettes |
| `changerPriorites` | Ordre des priorités : « collisions cumulées » au palier 2 sur 6, avec « excédent de collisions » |
| `retablirPriorites` | Ordre des priorités : ordre par défaut rétabli |
| `reserver` | Réservé Théo Pervenche à la table 4, siège 2, tour 2 |
| `retirerReservation` | Réservation retirée : Théo Pervenche, table 4, tous les tours |
| `deplacerReservation` | Réservation déplacée : Théo Pervenche, de la table 4 à la table 7, tour 2 |
| `poserTitre` | Posé le titre « accueil » à la table 3, siège 1 |
| `retirerTitre` | Retiré le titre « accueil » de la table 3, siège 1 |
| `designer` | Désigné Iris Ombrelle à la table 3, siège 1 : « accueil » |
| `convertirEnTous` | Converti en « tous les tours » : Iris Ombrelle, table 3 |
| `deplacerDansRetenu` | Déplacé Iris Ombrelle de la table 4 à la table 7, tour 2 |
| `echangerDansRetenu` | Échangé Iris Ombrelle (table 4) et Théo Pervenche (réserve), tour 2 |
| `retirerDuTour` | Retiré Iris Ombrelle de la table 4, tour 2 |

<!-- engendre:fin commandes -->

## Annexe D — Les raccourcis clavier

<!-- engendre:debut raccourcis -->

| Où | Touches | Effet |
|---|---|---|
| Plan | → | Passe à la table voisine à droite, ou au siège suivant. |
| Plan | ↓ | Passe à la table voisine en dessous, ou au siège suivant. |
| Plan | ← | Passe à la table voisine à gauche, ou au siège précédent. |
| Plan | ↑ | Passe à la table voisine au-dessus, ou au siège précédent. |
| Plan | Entrée ou Espace | Descend dans les sièges de la table, ou choisit la place. |
| Plan | Échap | Remonte du siège à sa table ; sur une table, oublie le choix. |
| Grille des participants | → | Passe à la cellule de droite. |
| Grille des participants | ↓ | Passe à la cellule du dessous. |
| Grille des participants | ← | Passe à la cellule de gauche. |
| Grille des participants | ↑ | Passe à la cellule du dessus. |
| Grille des participants | Tab | Valide la saisie en cours et passe à la cellule suivante. |
| Grille des participants | Maj+Tab | Valide la saisie en cours et revient à la cellule précédente. |
| Grille des participants | Entrée ou F2 | Ouvre la saisie de la cellule, ou bascule l'exclusion. |
| Grille des participants | Échap | Efface le refus affiché sous la cellule. |
| Champ de saisie | Entrée | Valide la saisie. |
| Champ de saisie | Échap | Rend la valeur d'avant la saisie. |
| Bouton de commande | Entrée ou Espace | Exécute la commande une fois, même maintenue. |
| Geste en cours | Échap | Annule le geste en cours : la table revient où elle était. |
| Panneau ou infobulle | Échap | Ferme le panneau ou l'infobulle. |

<!-- engendre:fin raccourcis -->

## Annexe E — Les démonstrations livrées

Les démonstrations que le premier écran offre, lues dans leurs fichiers : leur
taille et l’étendue de leur plafond a priori.

<!-- engendre:debut demonstrations -->

| Démonstration | Effectif | Tables | Tours | Plafond a priori, minimum | Plafond a priori, maximum |
|---|---|---|---|---|---|
| Grande démonstration | 260 | 33 | 4 | 24 | 28 |
| Grande démonstration sans exception | 260 | 33 | 4 | 28 | 28 |
| Petite démonstration | 12 | 4 | 4 | 8 | 8 |
| Petite démonstration, conflit inévitable | 12 | 4 | 4 | 8 | 8 |

<!-- engendre:fin demonstrations -->
