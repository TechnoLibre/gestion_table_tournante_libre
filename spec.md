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
**Produire** (badges). Le groupement est une lecture, non un ordre : chaque
section reste offerte depuis toutes les autres.

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

**4. Préparer les tables.** *Obligatoire.* L'opérateur fixe le nombre de sièges
par défaut, crée les tables, surcharge celles qui diffèrent (§ 6.1) et les
dispose sur le plan (§ 7.1). Le logiciel énonce la conséquence chiffrée d'un
changement de défaut avant de l'appliquer, n'écrase aucune surcharge, et refuse
en bloc une baisse qu'une seule table refuse (§ 6.1).

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
les objectifs de soirée restent. Les placements déjà engendrés, eux, ne sont pas
tronqués : ils ne portent plus le nombre de tours de la soirée, restent entiers
**en dérive** (§ 9), et le logiciel nomme ceux que le changement touche. Les
annoncer après coup ferait découvrir la perte à l'impression.

**6. Désigner les animateurs, table par table.** *Facultative — une soirée sans
aucun animateur est une configuration valide, et la petite démonstration en est
une (§ 15.3). Reprenable : une désignation se retire, se déplace, s'ajoute après
la génération.*

L'opérateur désigne **lui-même quelle personne anime quelle table**. Il n'existe
aucune commande qui répartit les animateurs sur les tables (§ 5.8).

Un geste de désignation produit **deux faits sur la même place**, sous une seule
entrée d'historique : une **réservation** de portée « tous les tours » au nom de
la personne, et un **titre de place** (§ 4). Les deux ensemble font l'animateur ;
ni l'un ni l'autre seul. Le titre reste quand son titulaire part, et la table
affiche « titre *animateur* non pourvu » (§ 4.1). Le statut d'« ancré » du § 4.2
en découle comme un fait calculé : le logiciel ne porte aucune case « est
animateur ».

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
tourne plus. `Σ (c_t − k_t) < n` ne se déclenche jamais ici, l'écart étant
invariant sous toute réservation (§ 5.9). Les autres refus du § 5.9 gardent
cette étape comme n'importe quelle autre pose : personne exclue, deux places sur
un même tour, dépôt sur une place déjà réservée à un autre.

Le logiciel n'assigne pas, il **montre le travail qui reste**, par deux listes
cliquables qui mènent à la place ou à la personne : la liste des **titres de
place non pourvus** (§ 4.1), et la liste des participants portant un **titre
pressenti** (§ 4) qui ne sont encore réservés nulle part.

**7. Placer des participants à la main.** *Facultative, reprenable.* Ce sont des
réservations ordinaires (§ 5.8). Le logiciel refuse de déposer quelqu'un sur une
place réservée à un autre ; **déplacer** une réservation est une commande
séparée (§ 5.9).

**8. Lire le diagnostic.** *Le logiciel le présente, l'opérateur n'a rien à
demander.* Avant toute recherche, il énonce ce que la configuration rend
inévitable, combien, et ce qui le rendrait évitable (§ 5.6), donne le **plafond
a priori** (§ 5.5), et donne le **plancher de l'écart d'itinéraire maximal**
quand la configuration en impose un. Sans ce dernier, le troisième chiffre de la
page de qualité envoie relancer vers un zéro que la configuration interdit.

**9. Générer.** *Nécessaire pour obtenir un placement, reprenable sans perte.*
La commande prend une **graine** et un **compte d'arrêt** ; chaque proposition
conserve sa graine dérivée, ce compte et la longueur d'historique qui l'ont
produite (§ 5.7, § 8.9). Le logiciel produit plusieurs propositions
comparables ; relancer **ajoute** des candidats, un classement unique les
ordonne tous. Les réservations des étapes 6 et 7 sont honorées, le moteur place
les autres autour (§ 5.2). Les critères que la recherche poursuit et que le
classement applique sont ceux que l'opérateur coche (§ 5.3), dans l'**ordre des
priorités** qu'il règle à côté (§ 5.7) ; pour les objectifs des tables, il y
choisit aussi ce que le critère cherche d'abord, le **mode** (§ 5.3). Sans
réglage, c'est l'ordre par défaut et le mode « le plus de places servies ». Le
logiciel nomme automatiquement l'instant qui précède chaque génération (§ 8.3).

**10. Comparer, et retenir.** *Facultative en droit — l'impression d'un plan non
retenu sort en filigrane BROUILLON (§ 11.7) — nécessaire en fait pour distribuer
quoi que ce soit.* L'opérateur lit la page de qualité (§ 12), compare deux
propositions sur le même axe — celui du **manque** (§ 12.10) —, retient celle
qu'il préfère. La page de qualité est la section « Qualité » de l'événement :
elle mesure le placement que le plan montre, et chaque ligne du tableau des
propositions y mène. Elle répond à deux questions — ce placement est-il bon, qui
s'y trouve mal servi — par le profil des rencontres, les collisions
d'appartenance, les paires répétées, le mélange des appartenances à chaque
table, les objectifs des tables tour par tour, les animateurs, et la performance
du calcul qui a produit la proposition. Le logiciel sépare ce que le moteur a
décidé de ce que les réservations imposent (§ 5.4). Retenir fait passer le plan
à l'état *Retenu* (§ 9) ; les propositions non retenues restent disponibles. Le
retenu se résume ensuite dans la liste des événements, par ses collisions
cumulées et ses rencontres répétées choisies (§ 5.4, § 8.1).

**11. Ajuster à la main.** *Facultative, reprenable.* Le même geste qu'à
l'étape 7 déplace maintenant une personne réelle dans le placement retenu. **Le
geste est identique, l'état des données change, et l'interface le dit** (§ 5.8).
Les indicateurs et la page de qualité suivent l'ajustement (§ 12.9 : la page
lit, elle ne recalcule rien).

**12. Imprimer.** La **planche de badges** (§ 11.1), qui est le seul document
PDF, et au besoin les vues imprimables : liste d'accueil, feuille par table,
plan (§ 11.7). La page de qualité se lit à l'écran et ne s'imprime pas. Le
logiciel n'interdit pas d'imprimer un plan qui n'est ni retenu ni bloqué ; il le
marque **BROUILLON** en filigrane. **Produire la planche n'est pas une
modification** : elle reste disponible en mode lecture et sur un plan bloqué.
L'opérateur bloque ensuite le plan pour le distribuer (§ 9).

**Ce qui doit avoir eu lieu.** Les étapes 2, 3, 5, 6, 7, 10 et 11 sont
facultatives ; 2, 3, 4, 5, 6, 7, 9 et 11 se reprennent indéfiniment, dans
n'importe quel ordre. Deux dépendances seulement : la 4 **et** au moins l'une
des étapes 2 ou 3 avant la 9 — le générateur refuse une configuration à zéro
participant ou à zéro table (§ 15.4) — et la 10 avant la 12 pour qu'une
impression ne sorte pas en brouillon.

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
une **appartenance** — le groupe qui sépare les gens qui se connaissent déjà :
entreprise, équipe, famille, école.

> L'identifiant est un petit entier et non un identifiant opaque. Le calcul de
> taille du § 8.6 repose dessus : sous la forme positionnelle du § 8.9, un
> identifiant de trente-six caractères remplace quatre octets par trente-neuf
> et **décuple** le poids des placements, qui sont la partie volumineuse du
> fichier.

Un participant porte aussi un **titre pressenti** — « animatrice », « hôte » —
qui est **purement informatif** : il s'imprime sur sa fiche, il n'attribue
aucun rôle, il ne pourvoit aucune place et il ne contraint rien. Il existe pour
qu'une liste reçue où les animateurs sont signalés ne perde pas cette
information à l'import.

Un participant peut être **exclu** sans être supprimé : il reste dans la liste,
il n'est plus placé, et il sort de toutes les statistiques.

**Table** — un **identifiant entier**, unique dans l'événement et jamais
réutilisé, exactement comme un participant ; un **numéro affiché** à partir
de 1 ; un nombre de sièges ; une forme (ronde ou carrée) ; une position sur le
plan en centimètres. **Le nombre de sièges d'une table ne change pas d'un tour à
l'autre** : c'est une propriété du mobilier.

> L'identifiant et le numéro affiché sont deux choses. La forme positionnelle du
> § 8.9 indexe les placements par **identifiant** : indexée par le rang d'une
> table, elle se tromperait de table dès qu'une table est supprimée, et le ferait
> en silence — trente-trois listes glissent d'un cran et tout le monde change de
> salle.

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

**Étiquette** — un mot court qu'une personne porte — « finance », « Montréal »,
« bénévole » — et qu'un objectif de table vise. L'appartenance sépare les gens
qui se connaissent déjà ; l'étiquette dit à quelle table une personne est
attendue. Une personne en porte de zéro à vingt.

**Objectif de table** — une liste d'étiquettes attachée à une table, sous une
règle : *au moins une* de ces étiquettes, ou *toutes*. Il vaut pour la soirée,
ou pour un tour désigné. Il ne fixe personne : c'est un critère de la recherche
(§ 5.3), jamais une réservation.

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

La portée « pour la soirée » d'un objectif de table (§ 4.5) est symbolique au
même titre : jamais développée en R objectifs, elle se retrouve intacte quand un
tour retiré revient. Un objectif de tour désigné suit les réservations de même
portée : retirer son tour le détruit, et le logiciel le dit avant d'appliquer
(§ 2.1, étape 5).

### 4.4 L'exclusion l'emporte

Exclure une personne **suspend toutes ses réservations**, rend ses places aux
mobiles, rend les titres correspondants non pourvus, et le logiciel le dit. La
réintégration les rend. L'exclusion décrit une absence physique : aucune table
ne peut asseoir quelqu'un qui n'est pas là.

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
par égalité de chaînes, comme les appartenances (§ 5.2). Un fichier retouché à
la main peut donc porter deux orthographes d'une même étiquette, que le moteur
tient pour deux ; l'analyse du fichier ne le refuse pas, même limite que pour
les appartenances (§ 10.1).

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
correspond, au tour r, à au moins une table qui peut l'accueillir à ce tour : sa
table réservée quand une réservation le fixe à ce tour, sinon toute table qui
garde à ce tour un siège qu'aucune réservation n'occupe. Le tour r est **servi**
quand p y est assis à une table qui lui correspond et qu'il peut occuper à ce
tour, au même sens. Le critère (§ 5.3) et l'indicateur (§ 5.4) ne comptent que
les couples possibles : une personne qu'aucune table ne peut servir au tour r
n'est pas « hors objectif » à ce tour, où qu'elle soit assise ; une personne
qu'une table pouvait servir et qui n'est pas servie compte un tour hors
objectif. Un couple fixé n'est possible que si sa table réservée lui correspond,
et il y est alors servi : un couple fixé n'est jamais hors objectif, et le
critère n'a pas de part imposée. Sur un plan ajusté qui déplace une réservation,
les tours servis ne dépassent toujours pas les tours possibles.

**L'animateur, pour le critère du § 5.3.** La personne présente qui pourvoit un
titre de place au tour r **anime** à ce tour, quel que soit le libellé du
titre ; est **animateur** la personne qui anime à un tour au moins. Le fait se
lit tour par tour, comme le statut d'ancré (§ 4.2), sur ce qui est tenu et
jamais sur la forme du stockage : une réservation de portée « tous les tours »
sur la place titrée fait animer à chaque tour, R réservations de tour désigné
sur cette place aussi, une seule réservation de tour désigné au seul tour
qu'elle couvre. Le pourvoyeur d'un titre à un tour se lit par la règle qui
dresse la liste des titres non pourvus (§ 4.1) ; sans sièges attribués,
plusieurs ancrés d'une table titrée n'en font qu'un animateur par titre, celui
que cette règle désigne. Une réservation pourvoit le titre : qui anime au tour r
est fixé à ce tour à la table du titre. Le logiciel ne porte aucune
case « est animateur » ; une réservation sans titre ne fait pas animer, et le
titre pressenti reste informatif (§ 4). Le diagnostic du § 5.6 garde son propre
emploi du mot, les ancrés d'une même appartenance : un ancré sans titre n'anime
pas, qui n'anime qu'à un tour n'est pas ancré, et le code nomme les deux
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
à un tour où f anime : à sa table fixée quand une réservation fixe p à ce tour,
sinon à une table qui garde à ce tour un siège qu'aucune réservation n'occupe.
Le second somme, sur les tours, le plus grand nombre d'animateurs autres que p
qui animent à une même table que p peut occuper à ce tour : p ne s'assied qu'à
une table par tour. Aucun plan ne fait rencontrer à p plus de B(p) animateurs ;
aucun ne garantit d'atteindre B(p). La personne est **concernée par les
animateurs** quand B(p) > 0.

---

## 5. Le cœur : le placement

### 5.1 Le problème

Étant donné N participants, T tables de capacités c₁…c_T et R tours, répartir
les gens à chaque tour de façon à **maximiser le nombre de personnes distinctes
que chacun rencontre**, sous les contraintes que l'opérateur active.

C'est l'objectif de l'ordre des priorités par défaut (§ 5.7) ; l'opérateur peut
ranger d'autres critères devant, et l'ordre affiché dit alors lequel prime.

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
participants et annote les tables — jamais un second algorithme. Une garde de
l'arborescence le tient : dans le moteur, seuls la normalisation de la
configuration et le diagnostic lisent les réservations.

### 5.3 Les contraintes, activables une à une

| contrainte | ce qu'elle exige |
|---|---|
| **Séparer les appartenances** | deux personnes de la même appartenance ne partagent pas une table |
| **Nouveaux voisins à chaque tour** | deux personnes ne se retrouvent pas deux fois à la même table |
| **Nouvelle table à chaque tour** | *voir ci-dessous* |
| **Varier les appartenances rencontrées** | sur l'ensemble des tours, chacun rencontre le plus d'appartenances **différentes** possible |
| **Respecter les objectifs des tables** | à chaque tour, chacun est assis à une table dont l'objectif lui correspond, quand une telle table peut l'accueillir (§ 4.5), selon le mode réglé : le plus de places servies, chacun au moins une fois, ou l'équité d'abord |
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
| excédent de collisions, collisions cumulées | « Séparer les appartenances » est cochée — une case, deux critères |
| tours hors objectif | « Respecter les objectifs des tables » est cochée et a un objet |
| rencontres répétées et retours | « Nouveaux voisins » **ou** « Nouvelle table » est cochée ; décoché quand aucune des deux ne l'est |
| animateurs non rencontrés | « Rencontrer le plus d'animateurs différents » est cochée et a un objet |
| redondance d'appartenance | « Varier les appartenances rencontrées » est cochée |

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

**« Varier les appartenances » n'est pas « séparer les appartenances ».** La
première porte sur **celle des autres**, **à travers les tours** ; la seconde
sur **la sienne**, **à l'intérieur d'un tour**. Elles s'activent séparément.

### 5.4 Les indicateurs

Tout placement proposé porte les mêmes chiffres, pour que la comparaison soit
une lecture et non un jugement :

| indicateur | définition |
|---|---|
| **personnes distinctes rencontrées** | sur l'ensemble des tours ; une personne revue compte une fois |
| **collisions cumulées** | occurrences (paire, tour) où deux personnes d'une même appartenance partagent une table — l'unité dans laquelle les planchers du § 5.6 se démontrent |
| **paires de même appartenance** | **paires distinctes** réunies au moins une fois ; jamais la même unité que la ligne précédente |
| **excédent de collisions** | collisions cumulées − paires distinctes : le nombre de **retrouvailles au-delà de la première** entre deux personnes d'une même appartenance. Nul quand aucune paire de collègues n'est réunie deux fois |
| **rencontres répétées** | paires réunies plus d'une fois |
| **nombre maximal de rencontres d'une même paire** | |
| **retours à une table déjà occupée** | *voir ci-dessous* |
| **appartenances distinctes rencontrées** — A(p) | nombre d'appartenances différentes portées par les personnes **affiliées** que p rencontre, **la sienne comprise** |
| **redondance d'appartenance** — r(p) | \|F(p)\| − A(p), où F(p) sont les affiliés rencontrés ; r = 0 signifie qu'aucune appartenance n'a été recroisée |
| **taux de diversité** — d(p) | A(p) / \|F(p)\| ; « — » quand \|F(p)\| = 0 |
| **manque** | plafond réalisé − rencontres (§ 5.5) — la grandeur qui compare deux propositions (§ 12.10) |
| **écart d'itinéraire** | plafond a priori − plafond réalisé (§ 5.5, § 12.10) |
| **tours selon l'objectif** — s(p) | tours servis de p : tours où p est assis à une table dont l'objectif en vigueur lui correspond et qu'il peut occuper (§ 4.5) ; ils ne dépassent pas P(p), ses **tours possibles**, les couples (p, r) possibles |
| **tours hors objectif** | Σ (P(p) − s(p)) : couples (p, r) possibles (§ 4.5) où p n'est pas servi ; zéro veut dire que personne n'est hors objectif, et n'est atteignable que si les places libres des tables à objectif suffisent (plancher au § 5.6) |
| **personnes jamais servies** | personnes concernées dont s(p) vaut zéro |
| **le plus de tours hors objectif d'une personne** | max (P(p) − s(p)) sur les personnes concernées |
| **animateurs rencontrés** — m(p) | animateurs distincts (§ 4.5) que p rencontre à un tour où ils animent, lui-même non compté ; un animateur rencontré à plusieurs tours compte une fois ; m(p) ne dépasse pas B(p), la borne des animateurs |
| **animateurs non rencontrés** | Σ (B(p) − m(p)) sur les personnes présentes placées : ce qui leur reste à rencontrer de ce que la configuration leur permettait |

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
l'ordre par défaut du § 5.7 le range devant les collisions cumulées.

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

**Les indicateurs se mesurent sur le plan complet**, les N participants et les
R tours, comme si les réservations n'existaient pas. Des formes closes servent
au diagnostic préalable ; elles ne corrigent jamais après coup un chiffre
mesuré. Deux arithmétiques pour une même quantité sont le mode de défaillance
que le § 13.2 interdit.

**La page de qualité lit, en plus, des mesures qui ne classent rien.** Elles
décrivent un placement à la fois (§ 12) ; aucune n'entre dans la recherche ni
dans le classement, et aucune ne s'affiche dans le tableau des propositions.
Elles se mesurent, comme les autres, sur le plan complet, par le même parcours
des tours.

| mesure | définition | population, et « — » |
|---|---|---|
| **capacité** — c_t | sièges de la table t (§ 4) | toute table |
| **occupants** — o_{t,r} | personnes assises à la table t au tour r | toute table, tout tour ; une table vide à un tour donne une case vide, « — » |
| **affiliés assis** — α_{t,r} | occupants qui portent une appartenance | idem |
| **appartenances à la table** — δ_{t,r} | appartenances distinctes portées par les affiliés assis | « — » quand α_{t,r} = 0 |
| **sièges sans appartenance nouvelle** — c_t − δ_{t,r} | sièges de la table au-delà du nombre de ses appartenances distinctes : siège vide, assis sans appartenance, ou second d'une appartenance ; zéro veut dire que chaque siège porte une appartenance de plus | « — » quand α_{t,r} = 0 |
| **assis sans appartenance nouvelle** — o_{t,r} − δ_{t,r} | occupants au-delà du nombre des appartenances distinctes ; zéro veut dire que chaque assis porte une appartenance de plus | idem |
| **doublons d'appartenance** — α_{t,r} − δ_{t,r} | affiliés assis au-delà du premier de leur appartenance ; zéro veut dire qu'aucune appartenance n'est assise deux fois à cette table ce tour-là | idem |
| **possibles du tour** — Π_r | couples (p, r) possibles au tour r (§ 4.5), fixés compris | personnes concernées ; « — » sans couple possible à ce tour |
| **servis du tour** — S_r | couples (p, r) servis au tour r : p assis à une table dont l'objectif en vigueur au tour r lui correspond et qu'il peut occuper | idem |
| **hors objectif du tour** | Π_r − S_r ; la somme sur les tours est le total des tours hors objectif | idem |
| **assis sans table possible** — σ_r | personnes présentes assises à une table au tour r dont le couple (p, r) n'est pas possible : concernées ou non, sans étiquette comprises ; une personne en réserve à ce tour n'y est pas | tout tour, dès qu'une personne est concernée ; écrit même quand Π_r = 0 |
| **personnes rencontrées en animant** — U_f, U_{f,r} | pour un animateur f, les personnes distinctes assises à sa table à un tour où il anime, à une table qu'elles peuvent occuper (§ 4.5), lui non compté : sur l'union de ses tours animés, U_f ; au seul tour r, U_{f,r} | animateurs présents ; « — » sans animateur |
| **appartenances rencontrées en animant** — A_f, A_{f,r} | appartenances distinctes portées par les affiliés de U_f, de U_{f,r} | idem |
| **étiquettes rencontrées en animant** — E_f, E_{f,r} | étiquettes distinctes portées par les personnes de U_f, de U_{f,r}, chaque étiquette comptée une fois quel que soit le nombre de ses porteurs | animateurs présents, quand une personne présente porte une étiquette ; « — » sinon |
| **tours animés** — T_f | tours où f anime | animateurs présents |

Les trois comptes du mélange d'une table s'emboîtent : c_t − δ ≥ o − δ ≥ α − δ
≥ 0, chacun nul exactement quand son dénominateur ne porte que des appartenances
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
| appartenances d'une table à un tour, par siège, par assis, par affilié | δ_{t,r} | c_t, o_{t,r}, α_{t,r} |

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

**Deux moments, deux bases, et un glossaire qui fait autorité.** Le plafond
dépend de l'itinéraire, et les deux plafonds ne se calculent pas sur la même
base :

| terme | définition | base | où il s'affiche |
|---|---|---|---|
| **plafond a priori** | maximisé sur les itinéraires admissibles | **capacités** | diagnostic § 5.6, tuile § 12.2 |
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
plafond réalisé(p) = min( N − 1 ,  Σ a_t  +  min( n_p ,   Σ     v_{t,r} ) )
                                  t∈D                  (t,r)∈I

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
rencontres. Soit G le nombre d'appartenances distinctes des personnes
présentes — les exclues n'en apportent aucune —, N_aff le nombre de personnes
présentes affiliées, g_p l'effectif de l'appartenance de p, et ε_p = 1 si p est
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
l'appartenance de p, qu'un collègue rencontré suffit à apporter : sans lui, un
événement où tout le monde partage une appartenance annoncerait A_max = 0 alors
que chacun en rencontre une. Une personne sans appartenance n'en apporte aucune,
et ses autres termes la bornent déjà. Chaque autre appartenance comptant au
moins une personne présente, (N_aff − g_p) + 1 ne descend jamais sous G : le
terme rappelle d'où vient la borne, G la tient.

La borne de diversité se trace sur le profil en comptes, en pointillés, sous son
nom, et s'écrit dans la tuile des appartenances distinctes rencontrées, dans le
jumeau et dans l'infobulle du profil (§ 12.2, § 12.3) ; aucun pourcentage ne la
prend pour dénominateur. La garde du § 12.3 éprouve A(p) ≤ |F(p)| ≤ Φ_aff(p) et
A(p) ≤ A_max(p). Elle ne se calcule pas a priori : le diagnostic garde sa
redondance minimale (§ 5.6).

### 5.6 Le diagnostic, avant la recherche

Certaines configurations rendent un conflit **inévitable**, quel que soit
l'algorithme. Le logiciel les détecte **avant** de chercher et énonce ce qui est
inévitable, **combien**, et ce qui le rendrait évitable :

- plus de personnes d'une appartenance que de tables → « au moins 8 collisions
  cumulées sur les 4 tours, portées par au moins 2 paires distinctes ». Le
  plancher se démontre **en occurrences** ; le chiffre nomme donc son unité, et
  le compte de paires distinctes l'accompagne (§ 5.4) ;
- **le plancher de l'excédent**, quand un groupe de g personnes subit un plancher
  de C collisions cumulées et que `C > C(g, 2)` : les retrouvailles sont alors
  forcées, et l'excédent ne descend pas sous `C − C(g, 2)`. Le diagnostic l'écrit
  **quand il est strictement positif**, et se tait sinon — annoncer un plancher
  nul laisserait croire qu'un plancher a été calculé là où il n'y en a pas ;
- redondance minimale `r_min(p) = max(0, |F(p)| − G)` → « au moins 6
  appartenances recroisées par personne ; avec 3 tours au lieu de 4, aucune ne
  le serait » ;
- **tous les animateurs de même appartenance** → chaque mobile accumule au
  moins min(R, T) − 1 redondances qu'aucune recherche ne réduit. Remède : les
  laisser sans appartenance déclarée, ou leur en donner des distinctes ;
- **taux d'ancrage par table** : une table dont tous les sièges sont ancrés ne
  tourne plus ; une table à moitié ancrée réduit d'autant le brassage de tout
  l'événement ;
- **le plancher de l'écart d'itinéraire maximal**, quand la configuration en
  impose un (§ 12.10.4). Le diagnostic ne l'écrit que là où il sait le prouver,
  et se tait ailleurs — **jamais 0 par défaut** ; sur la page de qualité, la
  tuile de ce chiffre l'écrit dessous (§ 12.2). Sans ce plancher, le troisième
  chiffre de la page envoie relancer indéfiniment vers un zéro que la
  configuration interdit ;
- **le manque de places**, `Σ (c_t − k_t) < n`. Ce n'est pas un refus de geste
  mais une **propriété de la configuration** (§ 5.9) : le diagnostic la nomme
  avec le nombre de places manquantes, et **la génération la refuse** ;
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
  personne ; sur quarante personnes, 128, huit et quatre.

L'objectif auquel aucune personne présente ne correspond est signalé à
l'objectif même (§ 5.9).

À l'écran, les énoncés se regroupent en cartes, sans changer d'ordre : la
séparation des appartenances vidée de son sens, une carte par appartenance en
collision, titrée de sa pastille d'appartenance (§ 12.7), puis ce qui vaut pour
tout l'événement.

Un opérateur à qui l'on dit « c'est impossible, voici pourquoi, voici le
remède » cesse de relancer en espérant mieux.

### 5.7 Plusieurs propositions, pas une

Une génération produit **plusieurs placements distincts et comparables**, en
nombre réglable. Les générations **s'accumulent** : relancer avec d'autres
réglages ajoute des candidats plutôt que d'effacer les précédents, et un
classement unique les ordonne tous. Une commande efface la liste en épargnant
celui qui est retenu.

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
d'historique d'acceptation dont l'algorithme fixe la valeur par défaut. Chaque
proposition conserve sa graine dérivée, ce compte et cette longueur (§ 8.9).
C'est le support de « à graine et entrée égales, placement identique » ; sans
eux, une proposition retenue cesse d'être régénérable.

**L'identifiant entier d'une proposition vient de sa place dans la suite de
graines dérivées, jamais de son ordre d'achèvement.** Quand plusieurs
propositions se calculent en parallèle, leur ordre d'arrivée varie : un
identifiant attribué à l'achèvement ferait départager deux propositions à
égalité par la vitesse de la machine, et deux exécutions les classeraient dans
deux ordres.

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
| redondance d'appartenance | Σ r(p) | la même | raffinement |

**La liste est complète** : chaque critère y figure une fois, coché ou non. Deux
critères y sont **seuls à leur palier** : ils se déplacent, ils ne partagent pas
leur palier. L'écart au plafond a priori, parce que sa valeur nulle est le
certificat du § 5.5 et qu'une somme pondérée le noierait dans d'autres unités.
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

**Ordre par défaut** : écart au plafond a priori, puis excédent de collisions,
puis collisions cumulées, puis tours hors objectif, puis rencontres répétées et
retours, puis animateurs non rencontrés, puis redondance d'appartenance, chacun
seul à son palier, sous le mode « le plus de places servies ». L'**ordre fixe de
référence** est la liste écart, excédent, cumulées, rencontres répétées,
redondance, chacun seul à son palier : l'ordre par défaut sans les deux critères
des objectifs et des animateurs. Sous l'ordre par défaut, sans objectif de table
et sans la case des animateurs, quel que soit le mode : sous toute combinaison
des cases du § 5.3, les plans à graine égale sont ceux de l'ordre fixe de
référence ; sous les quatre cases cochées, le classement et sa phrase le sont
aussi. Une case décochée retire son critère du classement et de la phrase
(§ 5.3) ; « nouvelle table » cochée seule y fait classer les retours choisis. Un
événement qui ne règle rien n'écrit rien (§ 8.9) ; « Rétablir l'ordre par
défaut » retire le réglage.

**L'ordre par défaut se justifie par l'asymétrie des gains.** Il met l'écart au
plafond a priori en tête : rencontrer une personne de plus est un gain certain,
rencontrer une appartenance de plus, ou un animateur de plus, un raffinement.
Mettre la diversité au-dessus ferait **refuser un contact neuf** parce que
l'appartenance du voisin est déjà croisée. Il met l'excédent de collisions
devant les collisions cumulées : le § 5.4 le démontre en trois plans, classer
d'abord sur les collisions cumulées — comme classer d'abord sur les paires
distinctes — met en tête le plan qui fait passer toute la soirée aux deux mêmes
collègues, parce qu'il en porte le moins. L'excédent d'abord, le volume
ensuite : un plan qui répartit six collisions sur six paires passe devant un
plan qui en concentre quatre sur une seule. L'opérateur qui inverse ces deux
paliers remet ce plan en tête ; l'éditeur le permet, l'ordre par défaut ne le
fait pas.

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
« contrainte », sauf le palier de l'écart, seul de la famille « rencontres ». Dès
que sa meilleure affectation porte un plus grand écart nul, la recherche compare
les paliers dans l'ordre où le palier de l'écart descend juste avant le premier
palier « raffinement » qui le suit — à la fin s'il n'y en a pas —, les autres
gardant leur ordre : elle peut perdre une rencontre le temps de défaire une
collision, puis la reprendre. Sous l'ordre par défaut, cela compare excédent,
cumulées, tours hors objectif, rencontres répétées et retours, l'écart,
animateurs, redondance. Le classement, lui, suit toujours l'ordre réglé.

**Tant que l'écart n'est pas annulé, la somme des carrés précède tous les
paliers qui suivent l'écart.** Là où le plus grand écart ne peut pas descendre à
zéro — le diagnostic en donne le plancher (§ 5.6) —, la bascule n'a jamais
lieu : un palier rangé après l'écart ne départage que des affectations de même
somme des carrés, et pèse dans la recherche à peine plus qu'un départage. Un
critère rangé après l'écart ne coûte donc aucune rencontre à personne ; pour
qu'il pèse sur une soirée tendue, l'opérateur le range devant l'écart, et
accepte de perdre des rencontres pour lui.

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
s'écrivent pareil : les commandes et le moteur refusent un palier rangé
autrement, et la lecture d'un fichier le range (§ 8.9).

**La phrase de l'ordre dit les paliers.** Elle nomme les paliers appliqués, dans
l'ordre, séparés par « puis » ; un palier de plusieurs critères se lit
« ensemble, » suivi de chaque critère et de son poids. Elle nomme la valeur que
le palier applique : « rencontres répétées », ou « retours » sous « nouvelle
table » seule ; un critère qui en classe deux les nomme l'une après l'autre,
séparées par « puis » comme deux paliers — « personnes jamais servies, puis
tours hors objectif ». L'éditeur, lui, écrit le nom complet du critère. Sous
l'ordre par défaut, sans objectif et sans la case des animateurs, les quatre
cases cochées, elle est mot pour mot celle de l'ordre fixe de référence.

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
— les personnes rencontrées, les collisions d'appartenance, les rencontres
répétées et les retours, la diversité d'appartenance, le manque et le plafond a
priori —, et sous un sixième, « les objectifs des tables et les animateurs »,
quand l'un de ces deux critères est coché et a un objet : ses colonnes sont,
pour le premier, les tours hors objectif et le minimum des tours selon
l'objectif, précédés des personnes jamais servies sous « chacun au moins une
fois » et du plus de tours hors objectif d'une personne sous « l'équité
d'abord » ; pour le second, le minimum des animateurs rencontrés et les
animateurs non rencontrés ; chacune présente quand son critère compte (§ 5.3).
Chacun de ces deux minimums porte sur tous les concernés, sans ses lignes
secondaires (§ 5.4). Le regroupement ne change l'en-tête ni l'explication
d'aucune colonne ; ses nombres s'alignent à droite en chiffres tabulaires. La
ligne du placement retenu porte la teinte de l'état Retenu, et la proposition
retenue, la pastille « retenue ».

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

**Il n'existe aucune commande qui répartit les animateurs sur les tables.**
L'opérateur désigne lui-même quelle personne anime quelle table (§ 2.1,
étape 6). Une commande qui attribuerait un animateur par numéro de table le
ferait sous une **seule** entrée d'historique : revenir sur elle, parce que douze
attributions sur trente-trois sont fausses, emporterait aussi les vingt-et-une
qui étaient bonnes — le § 8.3 restitue un état, il ne défait pas un geste.

Ce qui la remplace : le logiciel **montre le travail qui reste**, par deux listes
cliquables qui mènent à la place ou à la personne — la liste des **titres de
place non pourvus** (§ 4.1) et la liste des participants portant un **titre
pressenti** (§ 4) qui ne sont encore réservés nulle part.

### 5.9 Ce que le logiciel refuse, au moment du geste

Ces contrôles s'exécutent **à la pose**, jamais à la génération : un échec de
génération que rien n'explique coûte une relance inutile et la confiance mise
dans l'outil.

- **k_t > c_t** — plus d'ancrés que de sièges : refusé.
- **k_t = c_t** — table entièrement gelée : accepté, **signalé**, parce que
  c'est rarement l'intention.
- **Σ (c_t − k_t) < n** — il manque des places à chaque tour. **Celui-ci n'est
  pas un refus de geste.** L'écart `Σ (c_t − k_t) − n` est **invariant sous
  toute réservation** : une portée « tous les tours » retire la personne des
  mobiles et son siège de la capacité libre en parts égales ; une portée « tour
  désigné » rend la personne partiellement fixée, qui compte parmi les mobiles
  (§ 5.4) et ne change ni `n` ni `k_t` ; déplacer une réservation décrémente un
  `k_t` et en incrémente un autre. Aucun geste de réservation ne peut donc le
  faire franchir. C'est une **propriété de la configuration** : le § 5.6
  l'évalue au diagnostic et **la génération la refuse**, en nommant le nombre de
  places manquantes. Les gestes qui la font franchir sont ceux qui augmentent
  `n` ou diminuent `Σ c_t` — un import, une saisie, la réintégration d'un exclu
  (§ 4.4), une baisse de capacité (§ 6.2), la suppression d'une table — et
  **aucun n'est refusé pour cette raison** : refuser un import parce que la
  salle est devenue trop petite empêcherait d'enregistrer qui s'est présenté, et
  le § 9 pose déjà que la dérive avertit sans bloquer. Chacun **avertit**, avec
  le nombre.
- Réserver plus de places qu'une table n'en a ; un siège inexistant ; la même
  personne à deux places sur un même tour ; une personne exclue.
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
  objet » dans l'ordre des priorités.

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
et elle ne paie rien pour eux, même quand des personnes animent. Le coût d'un
mouvement reste de l'ordre des sièges des deux tables, et un n-uplet de dix
composantes au plus se compose et se compare dans le même ordre de grandeur que
celui de six : mesuré sur la grande démonstration, un mouvement coûte quelques
pour cent de plus que sous l'ordre fixe de référence sans objectif, et moins
d'un dixième de plus avec des étiquettes, des objectifs, la case des animateurs
et un ordre réglé.

**L'ordre des priorités et le mode ne touchent pas au hasard.** Ils changent la
façon dont deux scores se comparent, jamais les tirages : aucun ne s'ajoute ni
ne se déplace (§ 15.5, point 3). La liste se lit dans l'ordre où le fichier
l'écrit, jamais par le parcours des clés d'un objet, et les sommes d'un palier
sont des entiers exacts.

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
qui, sur la machine de référence, reste bien en deçà de ce plafond.

**Une génération longue s'annonce avant de partir.** À partir de la dernière
durée mesurée, le logiciel énonce l'ordre de grandeur attendu — « environ vingt
minutes à ce réglage » — et, **au-delà d'une minute estimée**, demande, par une
question posée en place, sans fenêtre. L'estimation compte les mouvements qui se
suivent sur un même cœur — le compte d'arrêt pour chacune des ⌈propositions /
cœurs⌉ vagues de propositions calculées ensemble —, chaque vague ralentie de
**ρ(W)**, le ralentissement d'un cœur quand W cœurs calculent ensemble : un cœur
va moins vite quand ses voisins travaillent aussi. ρ croît en ligne droite de 1,
sur un cœur seul, au **ralentissement à pleine charge** quand les L processeurs
logiques travaillent — `ρ(W) = 1 + (ρ_max − 1)(W − 1)/(L − 1)`, et 1 sur un poste
d'un seul processeur logique —, une constante du banc (§ 19.10) que l'estimation
lit au registre à chaque appel. Les mouvements de la dernière mesure se ramènent
de même aux cœurs qu'elle a employés. Sans mesure, il demande dès que ces
mouvements, ralentissement compris, dépassent dix fois ceux du réglage par
défaut. Une recherche d'une demi-heure lancée par mégarde est une demi-heure de
soirée perdue, et aucun réglage par défaut ne protège de cela.

**Pendant la recherche, l'application reste vivante.** Le calcul ne tient pas le
fil d'exécution de l'interface : le plan reste lisible, la page de qualité des
propositions déjà obtenues reste ouverte, et l'avancement est visible. Une
demi-heure de fenêtre figée se lit comme un plantage, et l'opérateur tue le
logiciel — ce qui perd exactement ce que la recherche avait trouvé. Le compteur
d'inactivité du § 8.4 est suspendu tant qu'un calcul tourne, donc le retour
automatique en lecture ne tombe jamais au milieu d'une génération.

**Les propositions d'une génération se calculent en parallèle, sur les cœurs du
poste.** Chaque proposition ne dépend que de sa graine dérivée (§ 5.7) : un
groupe de fils d'exécution, hors de celui de l'interface, s'en partage les rangs,
chacun prenant le suivant dès qu'il a rendu le sien, et le résultat, rangé par
identifiant, est octet pour octet celui d'un calcul sur un seul fil, quel que
soit le nombre de cœurs. Ce nombre est un **réglage du poste, non de
l'événement** : une case « Cœurs automatiques », cochée par défaut, en emploie un
par processeur logique, hyperthreads compris ; décochée, elle laisse saisir un
« Nombre de cœurs », un entier de 1 au nombre de processeurs logiques, la valeur
automatique affichée à côté, et refuse toute autre saisie là où elle a eu lieu.
Le réglage vaut pour la séance du logiciel, comme la durée observée : il ne
s'écrit ni dans le fichier d'état ni dans le journal, et se règle en lecture
comme en écriture. Une génération n'emploie jamais plus de cœurs que de
propositions demandées. L'avancement reste une seule barre, la somme des
mouvements évalués de toutes les propositions ; l'annulation arrête tous les fils
à la fois, et l'échec de l'un les arrête tous, sans résultat partiel.

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
qu'en laissant l'opérateur manquer sa cible sans comprendre.

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

**La troncature se décide par document, pas par support — et sur le badge, par
champ :**

| document | règle |
|---|---|
| le plan de salle, à l'écran comme à l'impression | **abrège** avec une marque, la largeur d'un bloc de noms étant la même contrainte des deux côtés |
| la fiche à l'écran, la feuille par table, la liste d'accueil | **ne tronquent jamais** : elles replient |
| le **badge** (§ 11.5) | **par champ** : le nom ne s'abrège jamais — il réduit de corps par paliers, puis se replie — tandis que l'appartenance s'abrège sur une seule ligne |

Un nom coupé sur la feuille que tient le personnel de salle ne sert à personne ;
un nom de deux cents caractères déployé sur un plan de 33 tables détruit la
page.

**Sur une feuille imprimée, replier s'étend à la page.** La feuille par table
garde à chaque colonne de tour au moins la largeur de son plus long mot ; des
tours qui n'y tiennent pas côte à côte se scindent en **groupes de tours
consécutifs**, chacun sur ses pages, sous ses propres têtes de tour. Une ligne
encore plus haute qu'une page — un nom de plusieurs milliers de caractères — ne
se coupe pas au bord de la feuille : son texte se poursuit sur la page suivante,
sous l'en-tête répété, coupé au début d'un mot, ou entre deux caractères quand
un mot seul dépasse la page — jamais entre une lettre et son accent. Rien d'une
ligne ne tombe hors de la page, et aucun nom n'est tronqué.

### 7.5 Les tables en conflit

Une table dont le placement viole une règle active se signale par une classe
posée à partir des indicateurs du moteur — **le plan ne recalcule rien, il
lit**.

Le signal **ne repose pas sur la seule couleur** : contour épaissi, trame, et
une **pastille portant le nombre de violations**. Une part notable des
opérateurs ne distingue pas un rouge d'un vert.

**Chaque règle a sa trame, d'une forme et d'une teinte propres** — hachures
descendantes pour « séparer les appartenances », hachures montantes pour
« nouveaux voisins », points pour « nouvelle table ». La forme suffit sans la
couleur ; la teinte la redit. Une table qui viole plusieurs règles superpose
leurs trames — les deux hachures se croisent en quadrillage — sous un même
contour épaissi, commun aux trois règles ; la pastille compte toutes ses
violations.

**Une légende des conflits reste accessible depuis le plan**, par la barre de
vue : pour chaque règle active, un échantillon de sa trame — la forme et la
teinte que le plan peint — et son nom ; elle dit aussi ce que compte la
pastille. Une règle inactive n'y paraît pas.

Le détail d'une table en conflit nomme les personnes de chaque violation ;
pour « séparer les appartenances », il nomme aussi **l'appartenance qui les
réunit**, telle que la liste la porte : « Même appartenance (Club des Merles) :
Iris Ombrelle et Théo Pervenche ».

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

Chaque événement vit dans **son propre fichier d'état**, complet et autonome. Ce
fichier seul suffit à rouvrir, imprimer et transmettre ; l'historique vit à côté
et n'est jamais nécessaire pour ouvrir.

**Ce que le fichier porte :**

| | |
|---|---|
| participants | avec identifiant entier, titre pressenti, notes, **étiquettes** |
| tables | capacité **et son état** : `sieges: null` (suit le défaut) ou un entier (surcharge) |
| le **nombre de sièges par défaut** de l'événement | |
| tours, réglages, réservations avec leur portée, **titres de place** | |
| **objectifs des tables**, avec leur portée et leur règle propre | |
| **règle par défaut** et **mode des objectifs**, **ordre des priorités** | dans les réglages, absents tant qu'ils valent leur défaut |
| placements engendrés, celui qui est retenu, état du plan | |
| **positions en centimètres**, et l'unité déclarée | |
| **filiation** : nom et identifiant de la source, instant d'origine | |

**Ce que le fichier ne porte pas : ni le mode, ni le cadrage.** Une liste de ce
qui est dedans, sans son complément, laisse l'implémenteur ajouter.

Le logiciel ouvre sur une **liste des événements**, avec pour chacun le nom, la
date, l'état, le nombre de participants, la dernière modification et le chemin.
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
cartes offrent la création, le dossier de travail et les démonstrations. Deux
colonnes résument en plus le **placement retenu**, sous l'en-tête du groupe qui
les couvre toutes deux : « Collisions cumulées (paire et tour) », les collisions
cumulées du retenu, puis « Rencontres répétées choisies (paires) », les paires
réunies plus d'une fois que le placement a choisies, sans celles que les
réservations imposent (§ 5.4) — dans chacune, le nombre que la colonne du même
intitulé du tableau des propositions porte sur la ligne du retenu. Les deux se
lisent dans une seule mesure du retenu, celle du tableau, sans rien écrire ; un
événement sans retenu, ou dont le retenu est fautif ou en dérive (§ 8.9, § 9),
porte « — » dans l'une et l'autre.
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
colonnes calculées** : ses lignes s'affichent dès le relevé du dossier, et les
mesures du retenu et la meilleure proposition, qui évaluent chaque événement, se
calculent ensuite, un événement après l'autre, la main rendue au navigateur
entre deux. Tant que celles d'une ligne se calculent, chacune de ses valeurs
porte un signe de chargement qui tourne ; chaque ligne montre les siennes dès
qu'elles sont obtenues, et une liste relue abandonne les calculs de la
précédente. **Un répertoire vide n'affiche pas une liste vide** : il présente la
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
cadrage plutôt que de l'écrire à chaque image d'un zoom. Lui appliquer la règle
écrirait un fichier par image de molette.

**Le coût d'un enregistrement complet est un seuil mesuré**, non un ordre de
grandeur posé de tête : la réécriture intégrale du fichier d'état **à chaque
entrée** est la contrainte réelle qui gouverne le format (§ 8.9). La mesure se
prend sur la grande démonstration, sur la plateforme livrée, et le test échoue
au-delà (§ 14.1 ; série `node:long` du § 14.4).

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

**Défaire et refaire avancent toujours d'un pas.** Quand l'instant visé a le
même contenu que l'instant courant, leur entrée s'écrit quand même : c'est elle
qui déplace le fil, et un refus laisserait chaque nouveau « Défaire » buter sur
le même instant. Revenir à un tel instant, choisi dans la liste, ne change rien
et ne s'écrit pas.

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
**page de qualité** (§ 12), la comparaison des propositions, la lecture de
l'historique, l'impression, et la **production de la planche de badges**, qui
n'écrit aucun fichier d'événement (§ 11.6). C'est la condition pour que la
protection tienne : si naviguer exigeait de passer en écriture, l'opérateur y
resterait en permanence et le mode lecture ne protégerait plus rien.

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
d'un signalement sur deux. Le bandeau porte aussi la marque du logiciel, le
réglage de thème et « À propos » ; il garde une hauteur d'une ligne de commande,
de sorte que la surface de travail ne perd rien.

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

Ce fichier porte **deux choses, et deux seulement** :

| réglage | portée |
|---|---|
| le **cadrage** | indexé par identifiant d'événement |
| le **format de papier** (§ 11.2) | global à la machine |

Le format de papier décrit le bac de l'imprimante, pas le plan : l'écrire dans
le fichier d'événement ferait voyager le bac d'un bureau avec le plan. Le
logiciel le demande à la première sortie qui en a besoin — la première
production d'une planche, ou le premier aperçu d'impression — et ne le redemande
plus ; la section des badges et l'aperçu le montrent, et il se change d'un
geste. La question offre chaque papier comme un choix distinct, d'un geste. Le
redemander chaque fois apprend à cliquer sans lire (§ 5.9). Le choix s'écrit
dans tout mode, en lecture et sur un plan bloqué : c'est un réglage de la
machine, pas une modification de l'événement. En mode portable (§ 8.6), ce
fichier suit la clé avec les événements.

**Le cadrage s'écrit en différé**, et échappe nommément à la règle « fin du
geste, jamais un minuteur » du § 8.2 : un zoom continu écrit une fois par délai,
jamais à chaque image. **Le papier s'écrit au geste qui le choisit.** Les deux
passent par une même file, qui relit le fichier avant chaque écriture : deux
écrivains qui le liraient chacun avant que l'autre l'ait écrit perdraient l'un
des deux réglages. Un fichier que la lecture ne prend pas ne s'écrase pas. Ni
lui, ni un dossier qui refuse de l'écrire, ne bloque le choix du papier : le
papier choisi vaut pour la séance sur ce dossier de travail, sans être retenu sur
la machine, et un avertissement nomme le fichier et dit que le choix n'est pas
retenu ; la première écriture des réglages qui y réussit le retient, et
l'avertissement se retire. Le cadrage attend.

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
   d'héritages, d'appartenances de groupe, de stratégies d'antivirus, et un
   support amovible en lecture seule présente un dossier d'apparence
   inscriptible. Une écriture suivie d'une relecture répond.
4. L'épreuve réussit → `data/` est le dossier de travail. C'est le **mode
   portable** : l'exécutable et les événements se déplacent ensemble, et la
   sauvegarde est la copie d'un seul dossier.
5. L'épreuve échoue, ou le point 2 l'a interrompue → le dossier de travail est
   un dossier nommé d'après le produit, dans les *Documents* de l'opérateur. Le
   logiciel **dit pourquoi**, une fois par séance, sans bloquer : s'en souvenir
   d'une séance à l'autre demanderait un réglage local de plus, et le § 8.5 les
   borne à deux.

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
  même événement dérivent sous le même identifiant interne.
- **Le mode portable affaiblit une garantie du § 8.8** sur un support amovible,
  et le logiciel l'annonce.

**Dans les deux modes, le logiciel affiche le chemin du dossier de travail en
clair dans la liste des événements**, et une commande l'ouvre dans l'explorateur.

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

**Deux fichiers par événement, et le compagnon des courses :**

| fichier | contenu | écriture |
|---|---|---|
| `<nom>.gtt.json` | l'état courant, complet | réécrit en entier à chaque entrée |
| `<nom>.gtt-journal.jsonl` | les entrées d'historique | **ajout en fin**, une ligne par entrée ; réécrit en entier, de façon atomique, à la conversion de format (§ 8.8) et après des lignes écartées |
| `<nom>.gtt-courses.json` | la course de la recherche de chaque proposition (§ 5.10) : ses mouvements évalués et les placements de ses points de relevé | réécrit en entier, de façon atomique, après l'état, **seulement quand les propositions changent** — une génération, un effacement, un retour qui en rend ou en retire — ; jamais à un autre geste |

Les deux portent **l'identifiant interne de l'événement**, et c'est lui qui les
apparie — jamais leurs noms.

**Le compagnon des courses** suit le nom du fichier d'état, et porte lui aussi
l'identifiant de l'événement. Il garde ce que la recherche a rapporté
d'elle-même (§ 5.10), que ni le fichier d'état ni le journal ne portent : une
course pèse environ cinq fois sa proposition, et chaque geste, qui réécrit
l'état en entier (§ 8.2), en paierait le poids. À part, elle ne coûte qu'à la
génération qui la produit.

Sa première ligne porte son propre format, 1, et l'identifiant de l'événement ;
puis une ligne par proposition, `{id, graine, arret, historique, horodatage,
empreinte, course}`, puis la fermeture. `horodatage` est celui que la génération
a posé sur la proposition (§ 8.9), absent quand elle n'en porte pas. `empreinte`
est un entier de 0 à 2⁵³ − 1, l'empreinte du texte canonique du placement de la
proposition (§ 8.9) : sa réserve rangée par identifiant croissant, chaque liste
de table aussi quand `siegesAttribues` est faux ; ni l'horodatage ni la version
qui l'a produite n'y entrent. Elle n'est pas cryptographique : elle départage
deux placements qui partagent déjà les autres champs. `course` porte :

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
est dans la liste.

**Une entrée ne vaut que pour sa proposition** : celle de l'état qui porte
exactement son identifiant, sa graine, son compte d'arrêt, son historique, son
horodatage — ou n'en porte pas, comme l'entrée — et l'empreinte de son
placement. Les quatre premiers ne suffisent pas à désigner une recherche : le
compteur des propositions recule quand l'opérateur reprend un état d'avant une
génération (un `.precedent`), et la graine proposée peut être la même ; après un
changement qui laisse la déclaration intacte — une appartenance, une
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
vides, les longueurs ou le multiensemble des identifiants, réserve comprise,
contredisent la déclaration de la proposition —, s'ignore seule, les autres
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
générique** quand la dérivation ne laisse rien. Ce plus long chemin assemble les
plus longues parties qu'un fichier de l'événement peut porter : le dossier daté
de la corbeille (§ 8.7) au rang de collision le plus long — deux suppressions
dans la même seconde se départagent par `_2`, `_3`… jusqu'à `_99` —, le plus
long suffixe, celui de la génération de secours, `.gtt.json.precedent`, dix-neuf
caractères, et le suffixe `.ecriture` de l'écriture atomique (§ 8.8) :
`corbeille/AAAA-MM-JJ_HH-MM-SS_99/<nom>.gtt.json.precedent.ecriture`, soixante
et un caractères outre le nom. `.gtt-journal.jsonl` n'en compte que dix-huit,
`.gtt-courses.json` dix-sept, et `.gtt.json` neuf : une borne posée sur l'état
ou sur le journal laisserait déborder tout le reste. **La dérivation reçoit la
racine du dossier de travail en paramètre**, celle-ci n'étant plus connue à
l'écriture du code, et son test l'exerce sur les deux issues. **L'autorité reste
le nom inscrit dans le fichier.**

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

Le compagnon des courses suit : écrit sous le nouveau nom après l'état, supprimé
avec l'ancienne paire ; quand l'écriture du nouveau est refusée, l'ancien se
déplace sous le nouveau nom, ou reste où il est si le déplacement l'est aussi,
et n'est jamais supprimé. **Copier** donne à la copie le compagnon des courses
de ses propositions, sous son identifiant ; **supprimer** le met à la corbeille
avec les autres fichiers. **Importer de l'autre emplacement** le recopie tel
quel après l'état, quand il se lit ; l'ouverture le revalide entrée par entrée,
et un refus de l'écrire ne refuse pas l'import. Un **fichier d'état venu
d'ailleurs** n'en a pas : ses courses ne sont pas connues.

**Importer** un fichier venu d'ailleurs le **copie** dans le dossier de travail.
Travailler en place écrirait dans un dossier de téléchargements que l'opérateur
vide régulièrement.

**Supprimer** déplace tous les fichiers dans une `corbeille/` datée. Le logiciel
ne la vide jamais de lui-même et affiche ce qu'elle contient : un opérateur qui
croit avoir supprimé les coordonnées d'une personne les a en réalité déplacées.

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
- **Version de format.** Le format courant est le **2**. Il ajoute au format 1
  des champs **facultatifs** seulement (§ 8.9) : un fichier de format 1 se lit
  comme un fichier de format 2 qui n'en porte aucun, sans fonction de
  conversion, et un fichier qui annonce le format 1 en portant déjà l'un d'eux
  se lit aussi. Un fichier **plus récent** s'ouvre en lecture seule sans passage
  possible en écriture ; un fichier **plus ancien** se convertit au premier
  geste qui l'écrit, jamais à l'ouverture ni au passage en écriture, qui ne
  réécrit pas le fichier d'état. **Son journal se convertit avec lui** : un
  journal ouvert sous un format plus ancien se lit, et le premier geste réécrit
  le journal entier au format courant, historique conservé, et l'état quand il
  l'écrit. Sinon, des entrées du format 2 s'ajouteraient sous une ouverture du
  format 1, qu'une construction ancienne lirait comme sienne avant de tronquer
  l'historique à la première entrée qu'elle ne sait pas lire. Un jalon, qui
  n'écrit pas l'état, convertit le journal seul : l'état garde son format
  jusqu'au geste suivant, et une construction du format 1 ouvre alors
  l'événement en lecture seule, son journal étant plus récent. Quand ce journal
  vit sous un autre nom que l'état — un renommage interrompu (§ 8.7) —, cette
  lecture seule n'est plus garantie : une construction du format 1 qui ne
  l'apparie pas ouvrirait l'état en écriture, sans son historique. Le format
  monte parce que les étiquettes et les objectifs sont de la saisie : une
  construction du format 1 refuserait comme illisible un fichier qui les porte
  et proposerait un secours qui les perd ; devant un fichier du format 2, elle
  s'ouvre en lecture seule.
- **Une seule séance en écriture**, le verrou se prenant **à l'entrée en mode
  écriture** et non à l'ouverture. Le verrou porte l'instant de sa prise, que la
  séance lit à l'horloge unique de l'application (§ 19.4), comme toute date
  qu'elle écrit.
- **Contrôle de cohérence** : l'en-tête annonce ses comptes, sa révision, sa
  **version de format** et `produit_version` (§ 18.6) ; l'analyse syntaxique
  seule ne distingue pas un fichier complet d'un fichier plausible. Le contrôle
  **s'étend aux placements** (§ 8.9) : longueurs déclarées contre listes
  écrites, identifiants vérifiés en multiensemble par tour, réserve comprise.
- **Sérialisation canonique** : **ordre de clés fixé, et aucune valeur que le
  sérialiseur dérive de l'horloge ou d'un tirage au moment d'écrire.** La règle
  porte sur le **sérialiseur**, jamais sur la provenance de la donnée : une
  valeur tirée ou horodatée **une fois**, puis devenue partie de l'état — graine
  d'une proposition, `produit_version`, identifiant d'événement — est une donnée
  ordinaire. Lue comme un interdit sur la provenance, cette règle interdirait
  d'enregistrer la graine, et une proposition retenue cesserait d'être
  régénérable. Lue comme un interdit sur le sérialiseur, elle garde tout son
  effet : ce qu'elle empêche est l'horodatage glissé à chaque écriture, qui fait
  enregistrer du bruit à chaque geste.
- **Le fichier se partage en en-tête et charge utile.** En-tête : comptes,
  révision, version de format, `produit_version`. Charge utile : tout le reste.
  La canonicité octet pour octet est exigée du **fichier entier**, pour un
  binaire donné ; mais les deux comparaisons qui **traversent les
  constructions** — l'empreinte des fichiers de démonstration (§ 15.5, point 5)
  et l'aller-retour sur les fichiers livrés (§ 8.9) — portent sur la **charge
  utile seule**. Sans cette restriction, `produit_version` fait échouer
  l'empreinte à **chaque** livraison : le test exigerait alors de régénérer les
  démonstrations à chaque incrément de version, c'est-à-dire exactement la dérive
  que le § 15.5 existe pour empêcher, et le geste conscient qu'il réclame
  deviendrait mécanique, donc aveugle.
- **Le journal note la construction qui change** : quand `produit_version`
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

Chacun est **absent tant qu'il vaut son défaut** et s'écrit après les clés du
format 1 de son objet, dans l'ordre du tableau qui suit — pour les réglages,
`regleObjectifs`, `respecterObjectifs`, `modeObjectifs`,
`rencontrerAnimateurs`, `priorites` : un événement qui n'emploie ni étiquette,
ni objectif, ni ordre réglé s'écrit comme un fichier du format 1, au numéro de
format près. Chacun se pose par une commande — une entrée d'historique, refusée
en lecture et sur un plan bloqué — qui le retire quand il revient à son défaut :
deux états de même valeur effective posés par les commandes s'écrivent pareil.
Un fichier lu garde ce qu'il écrit : une liste `priorites` dont un critère seul
à son palier porte un poids autre que 1 se lit telle quelle, même de même effet
que l'ordre par défaut, et ne revient à l'absence que par une commande. Un
correctif du journal (§ 8.6) le pose quand il apparaît et le retire quand il
disparaît. Un champ écrit à son défaut, ou sous toute autre forme que celle du
tableau, est une faute de forme du fichier, nommée par son chemin (§ 8.8).
L'ordre, lui, ne fait pas faute : des étiquettes, des objectifs ou les critères
d'un palier rangés autrement se lisent, et s'écrivent rangés.

| champ | où | absent, il vaut | forme |
|---|---|---|---|
| `etiquettes` | chaque participant | aucune étiquette | liste non vide d'au plus 20 étiquettes (§ 4.5), sans doublon exact, écrite triée par unités de code |
| `objectifs` | chaque table | aucun objectif | liste non vide d'objets `{portee, tour, regle, etiquettes}` ; `portee` `tous` ou `tour` ; `tour` nul sous `tous`, de 1 à R sous `tour` ; `regle` `ou`, `et` ou nul (suit le défaut) ; `etiquettes` sous la forme de celles d'un participant ; au plus un objectif par portée et tour ; écrite la soirée d'abord, puis les tours croissants |
| `regleObjectifs` | réglages | `ou` | `ou` ou `et` ; présent seulement à `et` |
| `respecterObjectifs` | réglages | coché | booléen ; présent seulement à faux |
| `modeObjectifs` | réglages | le plus de places servies | `chacun` (chacun au moins une fois) ou `minimum` (l'équité d'abord) ; présent seulement hors du défaut |
| `rencontrerAnimateurs` | réglages | décoché | booléen ; présent seulement à vrai |
| `priorites` | réglages | l'ordre par défaut (§ 5.7) | liste de paliers, chacun une liste non vide de `{critere, poids}` ; chaque critère du § 5.7 une fois ; l'écart au plafond a priori et les rencontres répétées et retours seuls à leur palier, au poids 1 ; sous `modeObjectifs` présent, les tours hors objectif aussi ; poids entiers de 1 à 100, un critère seul à son palier hors de ceux-là gardant le poids écrit (§ 5.7) ; chaque palier écrit dans l'ordre du tableau du § 5.7 ; absent quand il égale le défaut, chaque critère seul à son palier au poids 1 |

La liste `priorites` est complète : une liste qui ne nomme pas un critère est
une faute de forme. Le lecteur de l'ordre sait compléter une liste qui ne
nommerait pas un critère — chaque critère manquant à sa place de l'ordre par
défaut, seul à son palier, au poids 1 — ; au format courant l'analyse la refuse
avant, et ce complément sert la liste d'un format qui ne connaissait pas un
critère.

Un objectif appartient à sa table : supprimer la table l'emporte, et la fenêtre
qui annonce la suppression le compte (§ 2.1). Retirer un tour détruit les
objectifs de ce tour, que l'annonce compte avec les réservations (§ 2.1, étape
5).

#### La forme positionnelle

Une proposition porte un **identifiant entier séquentiel**, et les propositions
sont rangées **en liste ordonnée** — jamais en objet indexé par une clé, dont
l'ordre n'est pas garanti par la forme. L'identifiant vient de la place dans la
suite de graines dérivées (§ 5.7), et ne dérive ni de l'horloge ni d'un tirage.
Il se compte à partir d'un compteur du fichier, `prochainsIds.proposition`, qui
dépasse tout identifiant de proposition jamais attribué, celui d'où vient le
placement retenu compris : une génération numérote ses propositions dans
l'ordre de ses graines à partir de lui, puis le porte au-delà de la dernière. Le
compteur ne recule jamais — ni quand une commande efface les propositions
(§ 5.7), ni quand une main l'abaisse dans le fichier, l'ouverture le relevant
au-delà de chaque identifiant qu'elle lit. Les générations s'accumulent ainsi
sans qu'un identifiant se répète ni revienne, et le retenu désigne toujours la
même proposition d'origine.

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
(`produit_version`, § 8.8), la régénération d'une proposition à partir d'eux
seuls rend son plan, quel que soit son rang dans sa génération. Sans eux, cette
phrase n'existe que dans un scénario de pilotage, et une proposition retenue
cesse d'être régénérable. La longueur de l'historique a une valeur par défaut,
mais la proposition porte celle qui l'a produite : régénérer sous une valeur
supposée rendrait une autre proposition, sans le dire. Les trois champs ne
déterminent le plan que pour l'algorithme de recherche qui l'a produit, dont
l'ordre des tirages et les règles d'acceptation font partie du résultat : une
proposition produite par une autre version du moteur n'est pas garantie
régénérable.

**« À configuration égale » comprend les étiquettes, les objectifs, la règle par
défaut, le mode des objectifs, les cases du § 5.3 et l'ordre des priorités.**
Les changer ne met aucune proposition en dérive : elle reste comparable, se
reclasse sous l'ordre courant (§ 5.7), et sa régénération rend un autre plan,
comme après un changement de contrainte. Seuls les participants, les tables, les
capacités et les tours font une dérive (§ 9).

Puis, **par tour** : la liste des tables, chacune étant la liste de ses
occupants **dans l'ordre des sièges** — leurs **identifiants entiers**, et `null`
pour une chaise vide sous des sièges attribués — ; et la **réserve**, la liste
des identifiants assis nulle part à ce tour. Le numéro de
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
participants et chaque réserve se trient par identifiant croissant dans tous
les cas : ce sont des ensembles.

```
# illustration, annotée ; le fichier livré est du JSON strict
propositions: [
  { id: 3,
    graine: 48271, arret: 20000, historique: 1000,
    tables:    [7, 12, 2, ...],        identifiants de table (§ 4)
    capacites: [8, 8, 7, ...],
    tours: 4,
    participants: [1, 2, 3, ..., 260],
    placement: [
      { sieges: [[12,45,7,101,3,88,56,9], [21,64,...], ...],  tour 1
        reserve: [] },
      { sieges: [[12,33,...], ...],                           tour 2
        reserve: [177] },
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
2. **Les identifiants se vérifient comme un multiensemble, réserve comprise.** À
   chaque tour, chaque identifiant déclaré par la proposition apparaît **exactement
   une fois** dans l'union des listes de table et de la réserve. L'égalité
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
   Fautif = le fichier se contredit lui-même : une longueur fausse, un identifiant
   dupliqué, un identifiant absent de l'ensemble déclaré. Périmé = la proposition
   est cohérente mais ne décrit plus la configuration courante : une table
   supprimée, une capacité changée, une personne exclue depuis (§ 4.4), un tour
   retiré.
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
- **Corruption délibérée** : le test abîme un fichier de quatre façons — une
  longueur fausse, un identifiant dupliqué, un identifiant inconnu, un identifiant
  manquant sans entrée de réserve — et exige que le logiciel nomme chacune et
  écarte la seule proposition fautive. Un test qui ne charge que des fichiers bien
  formés ne peut pas échouer et ne prouve rien (§ 14.2).
- **Péremption délibérée** : le test exclut une personne, supprime une table,
  réduit une capacité, et exige que les propositions touchées soient **signalées
  comme dérive et conservées**, jamais écartées. C'est le test qui empêche la
  correction suivante de reclasser le périmé en fautif.
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

**La dérive avertit, elle ne bloque pas.** Si les participants ou le mobilier
changent après qu'un placement a été retenu, le logiciel le signale et laisse
l'opérateur décider : lui seul sait si la personne arrivée en retard doit être
placée.

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
| `etiquettes` | non | plusieurs par cellule, séparées par `,`, `;`, `\|` ou une fin de ligne (§ 4.5) ; synonymes : `étiquette`, `mots-clés` |

Les en-têtes se reconnaissent **sans tenir compte de la casse, des accents ni
des espaces**. **Deux colonnes reconnues sous le même nom** ne se départagent
pas toutes seules : le logiciel n'associe ni l'une ni l'autre et demande.

**La valeur de `exclu`** appartient à une liste fermée : `oui`, `o`, `vrai`,
`1` ou `x` pour une exclusion ; `non`, `n`, `faux`, `0` ou vide pour aucune ;
sans égard à la casse, aux accents ni aux espaces. Toute autre valeur **refuse
la ligne**. Traiter l'inconnu comme `non` placerait dans la salle une personne
qui s'est désistée, et la chaise vide ne se verrait que le soir même.

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
**information** — les orthographes fondues, un import qui n'a rien écrit. Une
pastille nomme la classe en texte, avec son icône ; la couleur la redit.

**La ligne invalide : importer le reste.** Le logiciel importe les lignes
valides et **réexporte les refusées** en un CSV reprenant les colonnes
d'origine, augmenté de `ligne` et `motif` — deux colonnes qu'aucun en-tête ne
reconnaît, donc le fichier corrigé se réimporte tel quel. `ligne` porte le
numéro de l'enregistrement, en-tête compris : celui qu'un tableur affiche, un
champ cité sur plusieurs lignes du texte n'y comptant qu'une fois. Sur 260
lignes, un refus global coûterait l'import entier pour une faute en ligne 213.

Hors de l'encodage et du séparateur, quatre cas restent des refus **globaux** :
aucun en-tête reconnaissable, aucune colonne associée à `nom`, zéro ligne
valide, et **un guillemet resté ouvert** jusqu'à la fin du texte
(`GUILLEMET_OUVERT`, avec l'enregistrement où il s'ouvre) — tout ce qui le suit
tiendrait dans un seul champ, et deux personnes se fondraient en une.

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

**Le modèle à télécharger.** La section d'import offre « Télécharger un
modèle » pour la nature cochée (§ 10.4) ; la commande passe par « Enregistrer
sous… » et n'écrit rien dans l'événement : elle est permise en lecture et sur
un plan bloqué. Son nom accessible nomme la nature, et le chemin enregistré
s'annonce sous elle. Le modèle a la forme de l'export — UTF-8 avec marque, `;`,
CRLF, les en-têtes de l'import — et **s'importe tel quel sans refuser aucune
ligne**. Celui des participants, `modele-participants.csv`, est fixe : quatre
personnes inventées, dont les cellules remplissent chaque colonne du tableau
ci-dessus, `exclu` sous ses deux valeurs et une cellule à deux étiquettes.
Celui des objectifs suit l'événement (§ 10.4).

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

La liste des participants porte une ligne de comptes — personnes, à placer,
exclues, appartenances — et une légende des appartenances, chacune avec le
nombre de personnes qui la portent, exclues comprises ; dans la grille,
l'appartenance s'affiche en pastille de sa teinte (§ 12.7), le titre pressenti
et l'exclusion en pastilles à icône.

La fiche d'une personne porte ses étiquettes, en pastilles **neutres** — la
teinte d'appartenance ne sert qu'à l'appartenance (§ 12.7) —, chacune suivie,
en mode écriture seulement, d'une petite croix cerclée rouge qui la retire,
nommée « Retirer « étiquette » » pour les technologies d'assistance, et un
champ qui en ajoute une ou plusieurs, séparées comme dans une cellule CSV ; la saisie passe par la même lecture que l'import (§ 4.5,
§ 10.1). Quand l'événement porte des étiquettes, une légende des étiquettes suit
celle des appartenances, chacune avec le nombre de personnes qui la portent,
exclues comprises.

**La liste s'exporte en CSV dans la forme exacte qu'il importe.** L'aller-retour
est éprouvé par un test qui importe, exporte et compare champ par champ : il
fait du fichier une sauvegarde, et de l'export le gabarit que personne n'a
besoin de documenter.

L'export écrit toujours la colonne `etiquettes`, en dernière position, les
étiquettes jointes par une virgule suivie d'une espace (`, `) ; le collage en
bloc suit le même ordre de colonnes, la huitième étant celle des étiquettes. Les
objectifs des tables s'exportent par leur propre CSV, dans la forme exacte qu'il
importe (§ 10.4).

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
une personne sans appartenance, une exclusion, un champ cité contenant le
séparateur, un champ cité sur deux lignes, un doublon, une personne sans prénom,
une **paire d'orthographes d'une même appartenance à fondre** (§ 10.1), et une
ligne refusée faute de nom. Il **alimente aussi deux captures d'écran** du guide
(§ 19.3) — l'aperçu d'import et son rapport —, qui sont les deux écrans où une
fusion d'orthographes et un refus de ligne se montrent ensemble.

Il porte aussi une colonne `Étiquettes`, en-tête accentué en casse mixte : une
cellule à plusieurs étiquettes séparées par `,`, une séparée par `|`, une paire
d'orthographes d'une même étiquette à fondre, et une cellule vide. Sa colonne
non reconnue reste la dernière. Les deux fichiers `participants_demo_*.csv`,
exports des démonstrations, portent la colonne `etiquettes`, vide ; les
démonstrations elles-mêmes ne changent pas. Le fichier des objectifs exerce un
numéro de table inconnu, un tour hors de la soirée, une règle inconnue, deux
lignes pour une même table et un même tour, une orthographe qui se fond avec une
étiquette des participants, et une table qui porte un objectif de soirée et un
objectif de tour ; il alimente la capture d'écran de l'aperçu des objectifs
(§ 19.3).

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
| `regle` | non | liste fermée, sans égard à la casse, aux accents ni aux espaces, comme `exclu` (§ 10.1) : `ou`, `une`, `au moins une` ; `et`, `toutes` ; vide pour suivre le défaut ; synonyme : `règle` |

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

Le logiciel produit **un seul document PDF** : la planche de badges à découper,
distribués à l'accueil et portés autour du cou. Toute autre sortie se lit à
l'écran et s'imprime par le navigateur ou par l'hôte `electron` (§ 11.7).

**Il le produit en mémoire, par une bibliothèque embarquée** — `pdf-lib`, sa
police lue par `fontkit` (§ 17, point 2). L'argument est
celui du § 14.4, et il est le seul qui tienne : une bibliothèque embarquée
s'exécute sous `node`, donc **dans le cycle « à chaque modification »**. Un test
de quelques secondes affirme que la boîte de page mesure 210 × 297 mm à moins de
0,1 mm près, que la planche porte quatre cellules de 105 × 148 mm, que les
filets de coupe tombent à 105, 148 et 296 mm, que l'ordre des badges est celui
qu'annonce l'imposition choisie, et que les caractères accentués se retrouvent
**dans la couche de texte** — pas dans une image.

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
reste exigé d'elle est du texte, des filets, des rectangles et une police
embarquée.

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
  voit sur aucune des deux boîtes.
- **Les mesures de texte ont une seule autorité : les métriques de la police
  embarquée**, lues par la bibliothèque qui dessine. Le § 14.1 impose de mesurer
  dans un navigateur ce qui dépend du rendu du navigateur ; le badge n'en dépend
  pas, et le mesurer là introduirait la seconde arithmétique que le § 13.2
  interdit.

### 11.2 La planche : deux impositions, A4 et Lettre

**Le logiciel sait produire sur les deux papiers, et aucun des deux n'est un cas
de repli.** Le badge est un A6 exact — 105 × 148 mm — dans les deux cas ; ce qui
change est le nombre de cellules par feuille et le tracé de coupe.

| papier | format | badges par feuille | axes de coupe | pour 257 badges |
|---|---|---|---|---|
| **A4** | 210 × 297 mm | **4**, deux colonnes de 105 et deux rangées de 148 | **3** : une verticale, deux horizontales | **65 planches** |
| **Lettre** | 215,9 × 279,4 mm | **2**, à plat, 148 de large et 105 de haut | **5** : un encadrement complet | **129 planches** |

**Le logiciel demande le format à la première sortie et ne le redemande plus**
(§ 8.5) : à la première production d'une planche, ou au premier aperçu
d'impression, puis jamais ; le format retenu reste affiché, et se change d'un
geste. Il n'en impose aucun par défaut : choisir pour l'opérateur, c'est
produire soixante-cinq feuilles inutilisables quand le bac contient l'autre
papier. Le format retenu est écrit sur la feuille de contrôle et dans le nom du
fichier (§ 11.3, § 11.6), parce que c'est la seule chose qui survit à l'envoi de
la planche à quelqu'un d'autre.

**Les deux impositions sont éprouvées à égalité** (§ 14.4) : la pagination sur
`n = 1, 4, 5, 259, 261` en A4 et `n = 1, 2, 3, 257` en Lettre, et la géométrie —
cellules, filets, zone de silence — sur chacune. Une branche qui ne serait
éprouvée que « au cas où » est une branche qui sort fausse le jour où elle sert.

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
suivre un repère.

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

**Le format de papier est un réglage local de la machine** (§ 8.5), retenu d'une
séance à l'autre, jamais écrit dans le fichier d'événement : il décrit le bac de
l'imprimante, pas le plan.

### 11.3 Le découpage, et la feuille de contrôle

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
§ 14.1**, et la constante le déclare. La mesure appartient au **niveau manuel**
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

**La feuille de contrôle est la page 1 du document**, et les pages qui la
suivent quand ses lignes — la liste des noms d'une réédition — ne tiennent pas
sur une page ; **elle ne se découpe pas**, ses pages de suite non plus. Elle
porte une **échelle graphique de 100 mm, repérée tous les 10 mm**, sur sa
première page, les dimensions annoncées du badge, le format de papier,
l'imposition retenue, le nombre de planches, le compte de badges produits et le
compte attendu, le nom et la date de l'événement, la source — le placement
retenu, ou la proposition imprimée par son numéro, que l'horodatage ne
distingue pas des autres propositions de sa génération —, l'horodatage du
placement, la version (§ 18.6), la consigne d'impression — recto seul, à 100 % —, les
caractères que la police n'a pas, par leur point de code (§ 11.5), et le
filigrane BROUILLON s'il y a lieu, sur chacune de ses pages. L'opérateur la
mesure sous une règle avant d'engager la
rame : si la planche est sortie « ajustée à la page », la graduation ne fait plus
100 mm et le défaut se découvre sur la première feuille au lieu de la
soixante-cinquième.

**L'impression est recto seul.** Un verso aligné dépend d'un retournement dont le
décalage se cumule avec celui du recto, et un badge dont le dos appartient à
quelqu'un d'autre n'est pas rattrapable.

### 11.4 Ce que porte un badge

Le lecteur est la personne qui le porte, debout, le carton à hauteur de poitrine,
et qui cherche sa table. Le second lecteur est l'hôte de salle, à un mètre, qui
cherche à qui il parle.

| rang | contenu | pourquoi |
|---|---|---|
| 1 | **prénom et nom**, le plus grand corps de la planche | c'est l'identité, et c'est ce que lit l'hôte à un mètre |
| 2 | **une ligne par tour** : « Tour 1 — table 12 », et le siège quand les sièges sont attribués | c'est la question à laquelle le badge existe pour répondre |
| 3 | **appartenance**, un corps réduit, sous le nom | elle distingue deux homonymes à l'accueil |
| 4 | **nom de l'événement et date**, en pied, corps minimal | deux soupers dans la même salle le même mois |
| 5 | **l'horodatage du placement**, en pied, corps minimal, lisible en main et non à un mètre | sans lui, deux versions d'un plan circulent autour de deux cous et personne ne dit laquelle fait foi |

Le pied des **pages** imprimées porte cinq éléments, la version comprise
(§ 11.7). Le badge n'est pas une page : il porte le nom de l'événement, sa date
et l'horodatage, **pas le tour** — il les porte tous — et **pas la version**, qui
ne sert à aucun diagnostic au cou d'un invité et dont la place est comptée.

**Un itinéraire constant s'écrit en une ligne.** Quand une personne occupe la même
table à chacun des R tours, R ≥ 2 — au même siège sous attribution, sous le même
titre —, le cas de tout participant ancré (§ 4.2), le badge
écrit « Toute la soirée — table 7 » plutôt que R lignes identiques. Le rang 2 ne
perd rien : la question « où vais-je au tour 3 » reçoit la même réponse, et la
place gagnée revient au nom.

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
appartenance et navigue par identifiant ; sur un badge, deux personnes de même
nom normalisé **et sans appartenance, ou de même appartenance normalisée**, ne
se distinguent par rien : une appartenance imprimée deux fois à l'identique ne
les sépare pas plus que son absence. La pile étant
alphabétique, leurs deux cartons sont voisins : l'hôte en tend un au hasard et
deux personnes passent la soirée aux tables l'une de l'autre, sans que rien ne le
signale. Le logiciel **compte ces collisions avant de produire, les nomme, et
porte l'identifiant en pied des seuls badges concernés.**

### 11.5 Les cas qui cassent la mise en page

Le badge est un cadre utile de **89 × 132 mm** — 105 et 148 moins deux fois la
zone de silence. Ce qu'on y met est variable. Le logiciel fixe donc un **ordre de
sacrifice**, écrit une fois, et ne laisse jamais la mise en page se résoudre par
un débordement.

> nom › lignes de tour › appartenance › nom de l'événement

- **Un nom très long.** Le nom **ne s'abrège jamais**. Le logiciel réduit le corps
  par paliers jusqu'à un plancher de lisibilité **mesuré sur les métriques de la
  police embarquée**, puis replie sur une seconde ligne, puis sur une troisième —
  aux espaces, et entre deux lettres seulement quand un mot seul ne tient pas,
  jamais entre une lettre et son accent. Si, le nom au plancher, le badge ne tient
  toujours pas, il se dépouille dans l'ordre de sacrifice : le nom de l'événement
  quitte le pied, sa date restant, puis l'appartenance part. **Au-delà de trois
  lignes, le nom continue de se replier** au corps plancher, sur autant de lignes
  qu'il lui faut, et le badge perd d'emblée le nom de l'événement, puis
  l'appartenance s'il le faut ; si les lignes de tour ne tiennent plus sous lui,
  le logiciel **refuse de produire la planche** et nomme la personne, dont le nom
  se corrige dans la liste des participants. L'horodatage ne quitte jamais le
  pied. Le seuil se cale sur le **glyphe le plus large** de l'alphabet visé,
  jamais sur une moyenne (§ 14.1) : un nom en capitales larges déborde sinon
  par-dessus la première ligne de tour, en silence.
- **Une appartenance très longue.** Elle **s'abrège** avec une marque, sur une
  seule ligne. C'est une étiquette de contexte, pas une identité, et un
  repliement sur trois lignes mange les tours.
- **Beaucoup de tours.** Le logiciel passe à deux colonnes au-dessus d'un nombre
  de tours **mesuré sur le gabarit**, et **n'affiche jamais une liste tronquée** :
  un badge qui omet le tour 5 envoie son porteur nulle part. Si la liste ne tient
  pas à deux colonnes au corps plancher, le logiciel **refuse de produire la
  planche** et nomme le nombre de tours en cause. Le gabarit tient largement les
  deux à six tours d'une soirée ordinaire ; ce refus est une garde contre la
  troncature silencieuse, pas un comportement attendu.
- **Un titre long sur une ligne de tour.** Une ligne de tour s'écrit entière ; au
  corps plancher seulement, une ligne trop large pour sa colonne **abrège son
  titre** avec une marque. La table et le siège ne s'abrègent jamais : c'est la
  réponse que le badge porte.
- **Un caractère que la police n'a pas** — un nom écrit hors de l'alphabet latin,
  par exemple. La police le dessinerait comme une case vide, et l'opérateur ne le
  verrait qu'au cou de l'invité. Le logiciel nomme ces caractères dans l'annonce,
  **avant de produire** ; la feuille de contrôle les liste par leur point de code
  — « U+674E » — et n'en écrit jamais un tel quel. La planche se produit : le
  remède est dans la liste des participants, et l'opérateur décide.
- **Un participant sans appartenance.** La ligne **n'existe pas**. Ni espace
  réservé, ni tiret : le « — » signale une mesure vide dans la page de qualité
  (§ 5.4), et sur un carton il se lit comme une donnée manquante dont la personne
  viendra demander la cause à l'accueil. La place libérée revient au bloc du nom.
  La mise en page est donc un flux, non une grille de cases fixes.
- **Une personne en réserve à un tour.** La ligne porte « pas de table » en toutes
  lettres. Une ligne blanche se lit comme un défaut d'impression.
- **Une personne exclue** n'a pas de badge (§ 4). Le logiciel annonce le compte
  produit et le compte attendu — « 257 badges pour 260 participants, 3 exclus » —
  sur la feuille de contrôle, pour que l'écart soit lu avant la coupe et non à
  l'accueil.

### 11.6 L'ordre des badges, et l'imposition

**L'ordre est alphabétique**, sur la **forme normalisée** du § 10.1 — espaces
réduits, casse et accents ignorés — appliquée au couple (nom, prénom), et
départagée par identifiant entier pour que deux productions de la même planche
soient identiques.

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
réserve au premier tour viennent en dernier.

**L'ordre sur la feuille dépend de la façon de couper, et le logiciel le
demande.** C'est la différence entre une pile prête à l'emploi et des centaines de
cartons à intercaler à la main.

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
```

— la base des fichiers de l'événement (§ 8.6), raccourcie et suivie d'un point
quand le chemin dépasserait la borne (ci-dessous) ; l'identifiant de la proposition
imprimée, rien pour le retenu ; le nombre k de badges d'une réédition ; le
papier ; l'imposition ; `_table` pour l'ordre par table, rien pour l'ordre
alphabétique ; le jour et l'heure de l'horodatage du placement, décalage
retiré, ou `horodatage-inconnu` quand le placement n'en porte pas ; enfin le
rang n d'un nom déjà pris dans le dossier. Il ne contient aucun deux-points,
que Windows refuse.

**Le nom est injectif sur ce qui change la pile.** Une génération date toutes
les propositions qu'elle ajoute du même instant (§ 8.9) : sans leur
identifiant, deux propositions donneraient le même nom, et la seconde planche
remplacerait la première sans rien dire. L'ordre par table change la pile
autant que l'imposition, et se lit donc dans le nom de la même façon. Même
événement, même source, même papier, même imposition, même ordre, même
placement : même nom, et la planche entière remplace la sienne, qui imprime la
même pile. **Une réédition ne remplace jamais un fichier** : deux rééditions de
trois personnes différentes partagent tout le reste du nom, et la seconde prend
le premier rang libre, `_2`, `_3`…, comme le dossier daté de la corbeille
(§ 8.7). Une planche dont la base se raccourcit (ci-dessous) prend aussi le
premier rang libre : la base d'un événement et celle de sa copie (§ 8.7), qui
partagent propositions et horodatages, peuvent se raccourcir en une même tête.
Un dossier qui ne se liste pas refuse ces planches plutôt que de risquer un
remplacement, et offre « Enregistrer sous… ».

**Le nom tient sous la borne de chemin du § 8.6.** Sans marque, son plus long
suffixe tient dans la réserve que la borne fait à chaque base. Les marques et le
rang l'allongent : quand le chemin complet dépasserait la borne, la base se
raccourcit dans le nom de la planche, sans couper un caractère, espaces et points
finaux retirés, sans laisser un nom réservé (§ 8.6), suivie d'un point ; le reste
du nom demeure entier. Aucune base ne finit par un point, que Windows retire de
la fin d'un nom et que la dérivation retire donc aussi (§ 8.6) : un nom
raccourci ne se confond avec aucun nom entier, et la planche entière d'une base
qui tient ne remplace jamais une planche raccourcie. Le nom raccourci dépend de
la racine du dossier qui le reçoit. Quand même un caractère de la base ne tient
pas, le nom garde sa base, l'écriture refusée se dit, et « Enregistrer sous… »
dépose la planche ailleurs.

**Sous `electron`, le fichier se dépose à côté des fichiers d'événement** (§ 8.6),
par une écriture atomique, et le logiciel en nomme le chemin ; une écriture
refusée se dit et offre « Enregistrer sous… ». **Sous `web`, la planche se
télécharge** : le dossier de travail y est invisible à l'opérateur, et la section
nomme le fichier, sans chemin.

**La planche se produit depuis le retenu, ou depuis une proposition choisie**
(§ 2.1, étape 12). La section des badges offre le retenu quand il existe, et la
proposition choisie dans la section des propositions ; l'annonce nomme la source.
Une planche tirée d'une proposition sort **toujours** en BROUILLON (§ 11.7), à
l'horodatage de cette proposition : elle n'est pas le plan retenu. Sans retenu ni
proposition désignée, la production se refuse et renvoie aux propositions. Une
proposition qui se contredit se refuse aussi, et renvoie aux propositions : la
version précédente du fichier, le remède d'un retenu qui se contredit, ne se
reprend pas pour elle, puisque le retenu est sain.

**Produire la planche n'est pas une modification.** Elle n'écrit aucun fichier
d'événement et n'ajoute aucune entrée d'historique (§ 8.2), donc elle reste
disponible en **mode lecture** et sur un plan **bloqué**, où la lecture et
l'impression restent ouvertes (§ 9). Ses seules écritures sont le PDF lui-même
et, au premier choix, le papier dans les réglages locaux (§ 8.5).

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

**Toute impression passe par un écran d'aperçu**, que la commande « Imprimer… »
de l'événement ouvre et qui se referme vers la section d'où il vient. Il offre
**trois vues** : le plan, tour par tour ; la liste d'accueil ; la feuille par
table. Le tableau des propositions (§ 5.7) et la page de qualité (§ 12) se
lisent à l'écran, où l'opérateur choisit sa proposition : ils ne s'impriment
pas, et aucun indicateur ne s'exporte en CSV. L'aperçu imprime la source que le
plan montre — le retenu, la proposition montrée, ou les seules réservations — et
n'écrit rien dans l'événement : il vit en lecture et sur un plan bloqué. Sa
commande « Imprimer » demande à la plateforme le papier et l'orientation de la
vue : la boîte de dialogue du navigateur sous `web`, celle du système sous
`electron`. Un échec se dit sur la commande ; une annulation ne dit rien. La
barre de l'aperçu, qui ne s'imprime pas, groupe ses commandes : la vue imprimée,
les réglages de la vue, le papier et « Imprimer », puis « Fermer l'aperçu » à
part.

**La feuille par table couvre la soirée** : une feuille par table, une colonne
par tour, que l'animateur garde d'un tour à l'autre. L'aperçu offre aussi « Une
feuille par tour », une feuille par table et par tour. Ses colonnes et ses
lignes suivent le § 7.4 : des tours qui ne tiennent pas côte à côte se scindent
en groupes de tours consécutifs, et une ligne plus haute qu'une page se poursuit
sur la suivante. **Les listes s'impriment en portrait.**

**Chaque page imprimée porte un pied de cinq éléments** : le nom de l'événement,
sa date, **le tour** — ou la soirée, pour une vue qui les couvre tous —,
**l'horodatage du placement** et **la version** (§ 18.6).
Une feuille sans horodatage circule après avoir été invalidée et personne ne peut
dire laquelle des deux versions posées sur la table est la bonne. La règle vise
la **page** ; un carton découpé et porté au cou n'est pas une page (§ 11.4).

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

**La mention « disposition relative » et l'échelle graphique du § 7.7 restent sur
chaque page imprimée du plan.** Elles y gagnent même leur pleine utilité : c'est
désormais le réglage d'échelle du navigateur, et non le logiciel, qui peut changer
le facteur sans prévenir.

**Une vue d'aperçu d'impression** applique au document vivant la feuille de style
d'impression réelle. Ce n'est pas une seconde mise en page : c'est la même,
regardée avant d'être envoyée à l'imprimante — là où l'aperçu d'une mise en page
PDF en serait une seconde, avec le défaut que les deux dérivent et que les tests
des deux restent verts. C'est cette vue que le guide photographie (§ 19.6).

**Ce qu'une feuille porte hors de sa zone de contenu se mesure sur le rendu** —
le pied et, sur le plan, ses mentions, son échelle graphique et son cartouche —,
à chaque ouverture de l'aperçu. La zone de contenu prend le reste de la page,
marges ôtées, et la découpe du plan reçoit la même hauteur. Le registre n'en
écrit aucune valeur (§ 14.1) : elle suit la police et le rendu.

**Fiches participants : la sortie imprimée est supprimée.** Son contenu — nom,
appartenance, titre, table et siège par tour — est exactement celui du badge.
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
  et l'annonce comme telle sur sa feuille de contrôle. Tant que le placement n'a
  pas bougé, le badge réédité est **identique** à celui de la première planche —
  c'est ce qu'on attend d'un badge perdu ; s'il a bougé, l'horodatage diffère, et
  c'est ce qu'on attend d'un badge refait.

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
se mesurent pas. Chaque ligne du tableau des propositions offre la commande
« Qualité », qui montre la proposition au plan et ouvre la page. Sans source
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
source le dit.

**Les vues, dans leur ordre à l'écran.** Une liste en tête de page les nomme et
mène à chacune.

| vue | question (§ 12.1) | forme | jumeau tabulaire |
|---|---|---|---|
| en-tête chiffré (§ 12.2) | les deux | une rangée de tuiles | les tuiles sont du texte |
| profil trié (§ 12.3) | qui est le plus mal servi, de combien, et combien sont-ils ? | deux graphiques au même ordre de rangs : l'escalier en comptes, deux séries, le plafond réalisé et la borne de diversité en repères ; dessous, les rencontres en pourcentage du plafond réalisé | une ligne par personne dans l'ordre du profil, comptes et pourcentage, et la répartition des rencontres |
| collisions d'appartenance (§ 12.4) | d'où vient le problème, et relancer peut-il y changer quelque chose ? | barres horizontales à deux segments | une ligne par appartenance |
| appartenances à chaque table (§ 12.11) | où les mêmes cercles se retrouvent-ils à une même table ? | un sélecteur à trois positions, puis la grille tables × tours, chaque case le compte de la position, échelle d'une teinte | une ligne par table, et par tour les trois comptes et leurs pourcentages |
| paires répétées (§ 12.5) | qui revoit trop souvent la même personne ? | tableau paginé ; matrice sous le seuil | le tableau est la vue ; la matrice a le sien |
| objectifs des tables (§ 12.12) | qui n'est jamais assis à une table qui lui correspond, et à quel tour l'objectif perd-il ? | la soirée en texte, puis des barres horizontales par tour, à deux segments, chacune avec son pourcentage et ses assis sans table possible | une ligne par tour, et la liste des personnes jamais servies |
| animateurs rencontrés (§ 12.13) | qui a rencontré le moins d'animateurs ? | escalier, une série, la borne des animateurs en repère | une ligne par personne concernée, et la répartition |
| diversité par animateur (§ 12.13) | quel animateur voit le moins de diversité à sa table ? | deux colonnes de barres horizontales juxtaposées, appartenances et étiquettes, chacune son axe, sur la soirée | une ligne par animateur sur la soirée, puis une par animateur et tour animé |
| performance du calcul (§ 12.14) | relancer plus longtemps aurait-il donné mieux ? | petits multiples, un indicateur par graphique, points aux seuls points de relevé, abscisse logarithmique | une ligne par point de relevé, une colonne par indicateur |

Une vue sans objet — aucune personne concernée par les objectifs, aucun
animateur, aucune course connue — cède la place à sa phrase (§ 12.6), jamais à
des axes vides.

**Un pourcentage de la page est toujours suivi, juste dessous, du pire cas en
compte** : « 88 % », puis « minimum 24 sur 27 » ; « 77 % des tours possibles
servis », puis « 3 personnes jamais servies ». Le pire cas d'une tuile, d'une
phrase de synthèse ou de la soirée est celui de sa population. **Le pourcentage
d'une ligne** — une ligne de jumeau, une infobulle — est suivi du **compte de
cette ligne**, son numérateur sur son dénominateur, une ligne n'ayant qu'un
cas : « 24 sur 27 », « 5 appartenances pour 8 sièges », « 24 servis sur 30
possibles ». Les graduations d'un axe en pourcentages et le libellé « 100 % » de
sa règle sont des repères, non le pourcentage d'une mesure, et n'ont pas de
compte. Les rapports admis sont ceux du § 5.4, et d'eux seuls (§ 12.8). Les
pourcentages s'écrivent sur cette page seulement : le tableau des propositions
garde ses comptes (§ 5.7).

### 12.1 Les deux questions

L'opérateur n'ouvre pas cette page pour connaître une variance :

1. **Ce placement est-il bon ?** — reste-t-il à gagner en relançant ?
2. **Qui s'y trouve mal servi ?** — car la plainte ne vient pas de la moyenne,
   elle vient d'une personne.

Le logiciel n'affiche **aucune forme qui ne réponde à l'une des deux**, et
chaque vue porte en toutes lettres la question qu'elle traite — **la vue de
comparaison du § 12.10.6 comprise** : *laquelle des deux sert mieux, et qui y
perd ?*

Les vues des mélanges — appartenances à chaque table, objectifs des tables,
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
(§ 5.4), le suivent, chacune sa tuile. Puis les collisions cumulées, les paires
distinctes et l'excédent ; les rencontres répétées choisies, les imposées
énoncées à part ; le plus grand nombre de rencontres d'une paire ; les retours
choisis, les imposés à part ; le minimum de A(p), avec la borne de diversité de
la personne au rang 1 du même tri sur A(p) (§ 5.5) — une phrase dit à sa place
qu'aucune personne présente ne porte d'appartenance — ; la somme de redondance ;
le minimum du taux de diversité d(p), au centième, comme au tableau des
propositions. Puis le manque maximal, avec l'effectif au manque maximal et le
**plafond réalisé de la personne au rang 1 du profil de manque** (§ 12.10.6) ;
l'effectif du manque ; l'écart d'itinéraire maximal et l'écart au plafond a
priori, « inconnu » quand le plafond a priori l'est (§ 12.6). Quand une personne
est concernée, les personnes jamais servies, le plus de tours hors objectif
d'une personne et les tours hors objectif, puis le minimum de s(p) avec les
tours possibles de la personne à ce minimum ; quand une personne est concernée
par les animateurs, le minimum de m(p) avec la borne des animateurs de la
personne à ce minimum, et les animateurs non rencontrés. La mention « minimum
atteint », ou « atteignabilité inconnue », suit les tuiles (§ 5.5).

**Une tuile écrit le plancher que le diagnostic écrit pour sa mesure** (§ 5.6),
et là seulement, en dernière ligne, sous son chiffre : « plancher 4 », ou
« plancher 4, le meilleur atteint » quand la mesure que la tuile
écrit l'égale. Ces deux lignes ne parlent que de cette mesure, jamais du
placement entier, et ne nomment personne. Sept tuiles peuvent en porter un : les
collisions cumulées, les paires distinctes et l'excédent, chacun la somme des
planchers de ses appartenances en collision ; l'écart d'itinéraire maximal,
aucun quand le plafond a priori est inconnu ; les personnes jamais servies, le
plus de tours hors objectif d'une personne et les tours hors objectif, chacun
seulement quand le critère des objectifs est coché et que le mode réglé compare
sa valeur, comme au diagnostic : une tuile des objectifs qui ne classe pas n'en
porte aucun. Un plancher nul ne s'écrit jamais, pas plus qu'un 0 à sa place, et
aucune tuile n'en porte sur un plan hors du domaine des planchers (§ 12.4). Le
détail du placement en porte d'autres, qui se lisent dans leur propre vue :
ceux des collisions par appartenance (§ 12.4), ceux des objectifs par tour
(§ 12.12), que cette vue dessine même quand le critère ne classe pas.

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
appartenances rencontrées n'y ont pas de série : leur seule borne est la borne
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
appartenance, les planchers des objectifs par tour (§ 12.12), la validité de ces
planchers pour le plan (§ 12.4) et les bornes de diversité : la garde éprouve
alors aussi que le segment « reste » n'est jamais négatif, ni pour une
appartenance ni pour un tour, et que A(p) ne dépasse ni les rencontres de p,
ni |F(p)|, ni sa borne de diversité, |F(p)| ne dépassant pas Φ_aff(p) (§ 5.5).
La propriété A(p) ≤ rencontres(p) fonde l'axe unique de cette vue ; elle n'est
vraie que par construction tant qu'aucune garde ne l'éprouve. Le refus vaut pour
la page entière, et nomme la mesure et les personnes en cause.

**Les places contraintes sont marquées.** Sans cela, l'opérateur attribue au
générateur un minimum que sa propre réservation impose.

Un point marqué porte un signe de forme, non une couleur : ancré ou
partiellement fixé, en réserve à un tour au moins, plafond réalisé nul. Les
autres rangs ne portent aucune marque : un escalier est un tracé, non 260
points.

**Le pointage au plus proche** (§ 12.7) désigne le rang sous le pointeur ; son
infobulle porte la ligne entière — le rang, le nom entier, l'appartenance, les
rencontres, le plafond réalisé, leur pourcentage suivi de leur compte (§ 12), le
plafond a priori, A(p), la borne de diversité, les tours non assis ; le rang
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
lit en absolu, l'escalier du plafond est tracé à côté, et l'opérateur lit l'écart
à l'œil. **Dès deux propositions, la comparaison change de quantité** : elle
trace le **manque**, et non les nombres bruts, pour la raison exposée au
§ 12.10.1. **Quand les courbes se croisent, l'arbitrage est réel** — l'un sert
mieux les plus mal lotis, l'autre la masse — et le graphique le montre au lieu de
le trancher. En comparaison, l'abscisse change de sens et **la page l'écrit** : le
rang 1 de l'une et de l'autre ne désignent pas la même personne.

### 12.4 Deuxième vue — les collisions d'appartenance

**Question : d'où vient le problème, et relancer peut-il y changer quelque
chose ?**

Des barres **horizontales**, une par appartenance, la pire en haut, chacune
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
appartenance est celle qui remet le plus souvent les mêmes personnes ensemble,
non celle qui porte le plus d'occurrences — c'est le même arbitrage qu'au § 5.7,
et deux tris opposés dans une même page se contredisent devant l'opérateur.

À excédent égal, les collisions cumulées décroissantes, puis la clé normalisée
de l'appartenance (§ 10.1), puis sa chaîne.

**« Prouvé inévitable » est le plancher des collisions cumulées du diagnostic**
(§ 5.6) pour cette appartenance, zéro quand le diagnostic n'en écrit pas. **Ce
plancher vaut sur un plan qui assoit chacun à chaque tour et honore les
réservations** : c'est le domaine où il se démontre. Un placement ajusté qui
laisse quelqu'un en réserve peut mesurer moins ; ses barres n'ont alors qu'un
segment, les collisions cumulées, et la vue écrit pourquoi le plancher ne s'y
applique pas. La garde n'éprouve le segment « reste » que sur le domaine.

L'intitulé de chaque ligne porte la **pastille de l'appartenance** (§ 12.7) :
c'est une liste. Les segments ne portent ni teinte d'appartenance ni teinte de
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
diagnostic (§ 5.6), et là seulement : une table de plus, ou une appartenance
répartie autrement, « la rend évitable » parce qu'elle change la
**configuration** — jamais parce qu'une relance ferait mieux.

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
Une ligne n'est pas cliquable : **sa première commande mène au plan au premier
tour où la paire se revoit**, la première des deux personnes mise en évidence,
et chacun de ses tours est une commande sœur vers le plan à ce tour. Les
**paires choisies** viennent d'abord, triées par nombre de fois décroissant,
puis par les identifiants ; les **paires que les réservations imposent** —
chacune de leurs rencontres a lieu à une table où les deux sont réservées ce
tour-là — suivent sous leur intitulé, triées de même : le § 5.4 les énonce à
part. Le tableau **se pagine comme celui des propositions**, par pages de cent
(§ 5.7), l'étendue et le total écrits.

**Deux exceptions** : la matrice se dessine sous un seuil de participants
**mesuré sur le rendu réel**, `SEUIL_MATRICE_PARTICIPANTS` (§ 19.10), et la
**ligne d'une seule personne** reste toujours accessible par la rubrique
« Rencontres » de sa **fiche à l'écran** — les personnes qu'elle a rencontrées
dans le placement que le plan montre, avec le nombre de fois et les tours, les
plus revues d'abord, sous la ligne de source de la page de qualité ; quand la
source ne se mesure pas ou que la personne est exclue, une phrase le dit ; sans
placement, la rubrique est absente —, chemin garanti vers une personne quand la
matrice n'est pas dessinée, et c'est pourquoi la fiche écran demeure alors que
sa version imprimée est supprimée (§ 11.7).

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
| personne en réserve à un tour | gardée, point marqué, avec le nombre de tours non assis ; son plafond réalisé se calcule sur les seuls tours où elle est assise, **et son écart d'itinéraire porte ce que son manque ne porte pas** |
| aucun placement — ni proposition ni retenu | le diagnostic préalable et une phrase, **jamais des axes vides** |
| une seule table | le profil, les collisions, les appartenances à chaque table et les paires cèdent la place à une phrase : elles diraient la même chose ; les objectifs, les animateurs et la performance restent |
| un seul tour | le tableau des paires est remplacé par une phrase, non par un tableau vide |
| une seule appartenance | le profil n'a qu'une série et pas de borne de diversité, et la phrase le dit ; les collisions et les appartenances à chaque table restent : les doublons disent où le groupe se retrouve |
| aucune appartenance | le profil n'a qu'une série et pas de borne de diversité ; les collisions et les appartenances à chaque table cèdent la place à une phrase ; **jamais** une seconde courbe plate à zéro, qui se lit comme une panne |
| aucune collision | la vue des collisions cède la place à sa phrase ; la grille des tables aussi sous la position « doublons » du sélecteur, dont toutes les cases vaudraient zéro ; sous « sièges » et « assis », la grille reste, ses comptes ne dépendant pas des collisions |
| noms longs | tronqués à une largeur **mesurée**, entiers dans l'infobulle et le tableau |
| homonymes | distingués par leur appartenance ; la navigation se fait par identifiant |
| le manque ne prend qu'une ou deux valeurs distinctes | une phrase portant les effectifs, non une courbe à deux marches |
| deux propositions au même profil de manque | « indiscernables sur le manque » ; l'ordre des priorités du § 5.7 les départage sur le palier suivant, et la page le nomme |
| deux profils qui alternent plusieurs fois | les trois effectifs de rangs, **sans** rang de bascule ; le jumeau tabulaire porte le détail |
| populations mesurées différentes entre deux propositions — ce que produit la dérive du § 9 sur des générations accumulées | ni courbe ni dominance : la page nomme les personnes exclues de part et d'autre et le dit **non comparable** |
| le plafond réalisé d'une personne vaut 0 | son manque vaut 0 et n'enseigne rien : la page marque le point et renvoie à l'écart d'itinéraire. Un manque nul n'est jamais lu comme « bien servi » sans son plafond à côté |
| le plafond a priori n'a pas pu être maximisé | l'écart d'itinéraire s'écrit **« inconnu »**, jamais 0, et sans plancher (§ 12.2) ; le certificat reste hors d'atteinte (§ 5.5) et le départage du § 5.7 qui en dépend est sauté, la page nommant le palier suivant |
| des propositions, aucune montrée | une phrase, et la commande qui montre la première proposition comparable du classement ; sans proposition comparable, la phrase seule |
| la source est en dérive ou fautive | ses raisons, comme au tableau des propositions ; aucune vue |
| la configuration ne se normalise pas | la phrase du refus de la génération ; aucune vue |
| la source disparaît | la page suit le plan, qui revient au retenu ou aux réservations ; la ligne de source le dit |
| un plan qui laisse quelqu'un en réserve | collisions et objectifs sans segment « prouvé inévitable », et la phrase qui dit pourquoi (§ 12.4) ; aucune tuile n'écrit de plancher (§ 12.2) |
| un pourcentage de dénominateur nul — plafond réalisé nul, tour sans couple possible, personne sans tour possible, table vide ou sans affilié | « — », jamais 0 % ni 100 % ; le compte reste écrit |
| une table sans affilié à un tour | sa case écrit « — » sous les trois positions du sélecteur, sans couleur, et se range après les tables qui portent un compte |
| aucune personne concernée par les objectifs | la vue des objectifs cède la place à sa phrase |
| un tour sans couple possible | sa ligne écrit « — », sans barre ni pourcentage ; ses assis sans table possible restent écrits |
| aucune personne concernée par les animateurs, ou aucun animateur | les deux vues des animateurs cèdent la place à leur phrase |
| aucune étiquette portée | la diversité par animateur n'a que la colonne des appartenances, et la phrase le dit |
| aucune appartenance, ou une seule, mais des étiquettes | la diversité par animateur n'a que la colonne des étiquettes, triée sur E_f |
| ni étiquette, ni plus d'une appartenance | la diversité par animateur cède la place à sa phrase ; son jumeau garde les tours animés et les personnes rencontrées en animant |
| une grille tables × tours trop large pour ses cases | le jumeau seul, et la phrase qui le dit |
| la matrice sous le seuil, mais trop étroite pour la largeur de la carte | la phrase de la matrice non dessinée, qui renvoie à la fiche |
| le placement retenu | la performance dit qu'elle mesure une proposition ; un retenu non ajusté nomme la proposition d'où il vient et en montre la course tant qu'elle est dans la liste ; un retenu ajusté, ou dont la proposition a été effacée, n'en a aucune |
| une proposition rouverte, dont le compagnon des courses garde la course | la performance la montre, ses valeurs mesurées sous les réglages courants ; la durée et la cadence s'écrivent « inconnues » (§ 5.10) |
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
- **Les couleurs d'état sont réservées** : **les teintes de conflit** — trois,
  une par règle que le plan localise (§ 7.5) — ne peignent que le plan de salle,
  et la page de qualité n'en emploie aucune ; chacune ne peint que les marques
  de sa règle. Elles se distinguent entre elles et des autres marques du plan
  **une fois les trois dichromaties simulées**.
- **Le rouge du retrait** (`--couleur-retrait`) ne peint que la croix cerclée
  d'une commande qui retire, sur une carte, jamais sur le plan : c'est le seul
  jeton chromatique admis à moins de 30° d'une teinte de conflit.
- **Les couleurs d'appartenance ne vont que sur les listes**, jamais sur le
  plan, dont le canal chromatique appartient aux conflits : au plus six teintes
  catégorielles, chacune à 30° au moins des teintes de conflit dans chaque
  thème, distinctes deux à deux une fois les trois dichromaties simulées et,
  deux teintes voisines, en clarté. Les appartenances distinctes de l'événement
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
  pastille d'état, de statut ou d'appartenance est un fond teinté, un signe —
  icône ou point — de la teinte, et un libellé de l'encre de la page.
- **La palette se valide par calcul, jamais à l'œil** : simuler d'abord les trois
  dichromaties, **puis** mesurer l'écart — mesurer sur les couleurs d'origine ne
  dit rien de ce que voit une personne daltonienne. **4,5:1** pour le texte,
  **3:1** pour les marques porteuses d'information.
- **Chaque graphique a son jumeau tabulaire** : un survol n'est jamais le seul
  chemin vers une valeur, et un tableau se parcourt au clavier et au lecteur
  d'écran. Il s'ouvre à la demande, par une commande sous le graphique. Chaque
  graphique est une image nommée par la question de sa vue et décrite par une
  phrase de synthèse — le pire cas et son effectif. **Un jumeau porte au moins
  les valeurs de son graphique, et peut détailler au-delà** — les trois comptes
  du mélange d'une table, quand la grille n'en dessine qu'un ; la diversité de
  chaque animateur tour par tour, quand le graphique dessine la soirée —, jamais
  en deçà. Celui de la vue de comparaison est **l'escalier du manque**
  (§ 12.10.6), qui accepte en outre plus de deux propositions là où le tracé
  s'arrête à deux.
- **Le pointage se fait au plus proche** : à 260 points, le pas est de quelques
  pixels, et sans cette couche la vue est inutilisable au pavé tactile.
- **Les jetons de graphique forment une famille** (§ 13.3) : deux séries, le
  repère d'un plafond, celui d'une borne, l'axe, « prouvé inévitable » et
  « reste », l'échelle séquentielle, ses encres et la bordure des cases, dans
  les deux thèmes. Les deux séries se distinguent l'une de l'autre et des six
  teintes d'appartenance une fois les trois dichromaties simulées, chacune à 3:1
  au moins sur le fond de la carte et à 30° au moins des teintes de conflit :
  une série voisine d'une pastille se lirait comme cette appartenance. Une
  grille de fond ne porte pas d'information et n'est pas tenue à 3:1 ; elle
  reste en couleur pleine.
- **Le pointage au plus proche a une règle par forme** : sur un escalier, le
  rang sous le pointeur ; sur des barres, la ligne sous le pointeur ; sur une
  grille, la case ; sur les petits multiples, le point de relevé le plus proche
  sur l'abscisse commune, désigné dans tous les graphiques à la fois.
  L'infobulle porte la ligne du jumeau qui correspond.

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
d'une personne sur ses tours possibles, les appartenances distinctes d'une table
et d'un tour sur ses sièges, ses assis ou ses affiliés. La première est le
complément du rapport manque / plafond ; la deuxième, prise sur la soirée, est
le taux de satisfaction transposé aux objectifs. Leur défaut est celui que le
premier point de cette liste nomme — 99,8 % cache la personne à 14 sur 27 —, et
la page le corrige par la règle qui fonde l'exception : **chaque pourcentage est
suivi, juste dessous, du pire cas en compte** — « minimum 14 sur 27 », « 3
personnes jamais servies », ou, sur une ligne, son propre compte (§ 12) —, et ne
sert ni à trier, ni à classer, ni à comparer deux propositions, qui se comparent
sur le manque (§ 12.10). Sur la soirée, les rencontres ne se somment pas : le
pourcentage d'une tuile est celui de la personne que sa borne nomme (§ 12.2), et
le taux de satisfaction reste refusé.

### 12.9 D'où viennent les chiffres

Les statistiques sont calculées par le **moteur**, en fonctions pures, testées
sous `node`. **La page ne recalcule rien** : elle lit les mêmes valeurs que le
tableau d'indicateurs et que le classement. Dès que la même arithmétique existe
en deux endroits, le graphique et le tableau finissent par se contredire devant
l'opérateur.

**Le détail d'un placement** — son profil trié, ses collisions jointes aux
planchers, ses paires, sa matrice, ses mélanges, ses bornes de diversité — se
calcule pour lui seul, à l'ouverture de la page, par les fonctions du moteur, en
une lecture du plan ; jamais pour toutes les propositions, dont la table
d'évaluation se recalcule à chaque écriture. Les points de relevé de la
performance s'y ajoutent, leurs plans lus dans la course que le compagnon des
courses garde pour la proposition (§ 8.6), chacun mesuré sous les réglages
courants par la mesure qui fait foi ; les pourcentages aussi, par la seule
fonction du moteur qui les calcule (§ 5.4). Le détail d'une charge se garde tant
qu'elle ne change pas, et se refait sur la suivante : aucune valeur ne survit à
un changement de réglage. Les tuiles lisent les mesures de la ligne de cette
table. Le détail ne reçoit pas cette ligne, que la table calcule pour chaque
proposition : il mesure son placement par le même chemin qu'elle — la mesure,
les plafonds réalisés et les trois chiffres du § 12.10.4, pris d'une seule
fonction de l'application —, et ses fonctions du moteur n'en recomptent rien.
Elles rendent une fois les bornes et les planchers qui accompagnent les tuiles,
et jugent un plancher atteint sur la valeur même que la ligne porte. Les tris,
les échelles, les chemins des tracés et le pointage au plus proche sont des
fonctions pures : un composant n'en fait aucun.

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
accompagne le manque partout** — tuile, infobulle, tableau — comme le § 12.2
l'exige déjà du chiffre de tête, et **à manque égal, le tri place d'abord le
plafond le plus bas**. Entre deux manques égaux, la personne proportionnellement
la plus privée est donc la première ; **entre deux manques différents, le tri ne
prétend rien sur la proportion**, et c'est le choix assumé ci-dessus.
L'infobulle d'un point porte la ligne entière, qui enseigne le vocabulaire :

> manque 3 · rencontres 24 · plafond réalisé 27 · plafond a priori 28 · 259 au total

#### 12.10.4 Les trois chiffres, et aucun quatrième

Chacun porte sa population mesurée et ses deux lignes secondaires — mobiles,
ancrés — comme tout agrégat du § 5.4. Quand la population mesurée est vide, les
trois s'écrivent « — ».

**1. Le manque maximal.** *De combien la personne la plus privée est-elle privée,
compte tenu de là où ce placement l'a assise ?* Le plus grand manque sur la
population mesurée. Vaut **0** sur un placement dont personne ne peut plus rien
tirer, et le logiciel écrit alors le nombre de personnes mesurées à côté. Vaut
**13** sur le placement du § 12.1 où chacun atteint un plafond réalisé de 27 sauf
une personne qui ne rencontre que 14. Majorant : le plus grand plafond réalisé,
qui borne l'axe. C'est la transposition du « le minimum gouverne la page » sur
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
plus mal servie de la soirée. Son écart d'itinéraire, lui, est énorme.

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

Elle porte sa question en toutes lettres, comme le § 12.1 l'exige de chaque vue :
**laquelle des deux sert mieux, et qui y perd ?**

Le § 12.3 reste inchangé pour **une** proposition. Quatre lignes ne se lisent
pas ; dès **deux** propositions, le logiciel dessine donc l'écart lui-même.

- **La quantité** : le manque, et lui seul. Une seule série par proposition, deux
  propositions au plus sur le tracé, étiquetées directement (§ 12.7).
- **L'axe vertical** : le manque en personnes, **zéro en bas**, graduations
  entières, borne haute commune aux deux courbes — jamais une échelle par courbe,
  que le § 12.8 refuse. Le zéro porte son libellé : « rien à reprendre à ce
  placement ».
- **L'abscisse** : le rang, chaque proposition triée **par son propre manque
  décroissant**, départagé par plafond réalisé croissant puis par identifiant.
  Les deux courbes descendent. Le rang 1 de l'une et de l'autre ne désigne pas la
  même personne, et la page l'écrit.
- **Le jumeau tabulaire** (§ 12.7) est **l'escalier du manque** : une ligne par
  valeur de manque, et par proposition une colonne d'effectif et une colonne
  d'effectif cumulé — la seconde est la courbe elle-même, lue à l'envers. Il
  accepte plus de deux propositions là où le tracé s'arrête à deux. Il lit le
  même tableau que le tracé (§ 12.9).

**Quand aucune ne domine**, le § 12.3 dit déjà que l'arbitrage est réel. Le
manque change ce qui se lit : avec des nombres bruts, un croisement peut n'être
qu'un artefact des plafonds — la courbe du bas appartient peut-être à des gens
assis à des tables de 7. Avec le manque, **le croisement porte sur le
placement**. Le logiciel ne laisse pas lire la position du croisement à l'œil sur
260 points : **il compte les rangs**, parce que deux profils décroissants peuvent
se recroiser plusieurs fois et qu'un « rang de croisement » unique n'existe pas
en général. La page écrit les trois effectifs — « A sert mieux à 12 rangs, B à
200, égalité à 48 » — et, **quand le signe ne change qu'une fois**, nomme en plus
le rang de bascule.

Ce que la vue ne dit pas, et que l'en-tête garde à côté : le manque mesure chacun
contre son propre placement, donc **une proposition peut avoir un manque plus bas
en offrant moins de rencontres réelles**. La tuile du minimum brut et l'écart
d'itinéraire maximal restent affichés à côté des courbes ; une implémentation qui
les retire rend le piège invisible.

#### 12.10.7 La dominance

**Dominance de profil.** La proposition A domine B quand, à **chaque rang** i,
`manque_A(i) ≤ manque_B(i)`, avec au moins une inégalité stricte, les deux séries
étant triées chacune par son propre ordre. C'est exactement « les courbes ne se
croisent pas ». Un parcours linéaire après le tri suffit. Le logiciel l'énonce en
toutes lettres quand elle tient — « la proposition A sert mieux à tous les
rangs » — et **n'affiche rien quand elle ne tient pas** : un témoin presque
toujours éteint apprend à ne plus être regardé, et la page montre déjà le
croisement.

**La formulation est à surveiller mot à mot** : « sert mieux à tous les rangs »
n'est pas « sert mieux chaque personne ». Le rang 3 des deux propositions désigne
deux personnes différentes. Écrire la seconde phrase promet à l'opérateur qu'il
peut basculer sans léser personne, ce qui est faux.

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
recalcule rien.

Une réserve honnête sur l'un des deux : le manque ne coûte rien, le plafond
réalisé se lisant sur le placement. **L'écart d'itinéraire suppose le plafond a
priori disponible par personne**, et non seulement en agrégat au diagnostic ;
son coût est exactement le point 4 du § 17, que cette section rend porteur. **Il
se calcule à chaque évaluation** : le coût est mesuré, et il ne retarde pas la
page. Le chemin « inconnu » reste celui du moteur, que l'application n'emprunte
pas : là, le troisième chiffre s'écrit **« inconnu »** et le départage du § 5.7
qui en dépend est sauté en nommant le palier appliqué à sa place.

### 12.11 Les appartenances à chaque table

**Question : où les mêmes cercles se retrouvent-ils à une même table ?**

**Un sélecteur à trois positions** choisit ce que la grille compte, pour la
table t au tour r (§ 5.4) :

| position | la case écrit et colore | son pourcentage, à l'infobulle et au jumeau |
|---|---|---|
| **appartenances par siège** — par défaut | les **sièges sans appartenance nouvelle**, c_t − δ_{t,r} | δ appartenances pour c sièges |
| **appartenances par personne assise** | les **assis sans appartenance nouvelle**, o_{t,r} − δ_{t,r} | δ appartenances pour o assis |
| **doublons parmi les affiliés** | les **doublons d'appartenance**, α_{t,r} − δ_{t,r} | δ appartenances pour α affiliés |

La position est un état de la séance, comme le tour montré : elle survit au
changement de section, repart de « par siège » à l'ouverture d'un événement,
n'écrit rien et ne fait aucune entrée d'historique ; elle vit en lecture et sur
un plan bloqué (§ 8.4). C'est un groupe de boutons radio, au clavier.

Une **grille**, une ligne par table, une colonne par tour. Sous chaque position,
chaque case **écrit et colore le même nombre** — le compte de la position —, sur
l'échelle séquentielle à quatre niveaux, 0, 1, 2, 3 et plus. Les trois comptes
ont le même sens : zéro veut dire que chaque siège, chaque assis ou chaque
affilié porte une appartenance de plus, et ce niveau est le plus proche du fond
de la carte (§ 12.7). Ils s'emboîtent, le compte des sièges majorant celui des
assis, qui majore les doublons (§ 5.4). Une case sans affilié, ou d'une table
vide à ce tour, écrit « — » sous les trois positions, sans couleur : une table
de bénévoles sans appartenance n'a rien à mélanger, et ne se lit pas comme la
pire de la soirée. L'infobulle d'une case porte le pourcentage de la position,
puis ses deux comptes — « 62 % », puis « 5 appartenances pour 8 sièges » —, les
occupants, les affiliés et la capacité. Une case ne porte qu'un nombre : le
pourcentage n'y tient pas à côté du compte, et la couleur ne porte que ce que la
case écrit.

**Les tables se rangent de la pire à la meilleure, sous la position choisie** :
le plus grand compte d'une case, puis la somme des comptes sur les tours, puis
l'ordre des tables ; une table dont toutes les cases écrivent « — » vient en
dernier. La pire case est donc dans la première ligne. Le moteur rend les trois
ordres ; l'écran lit celui de la position.

La vue décrit **la sortie**, pas les entrées : elle ne dit jamais combien chaque
appartenance compte de membres (§ 12.8, le camembert). Elle complète la vue des
collisions (§ 12.4) : celle-ci dit quelle appartenance se retrouve, la grille où
et quand ; un doublon d'appartenance non nul est exactement une table où la vue
des collisions compte au moins une collision ce tour-là.

**Le jumeau** porte une ligne par table dans l'ordre de la position, et par tour
**les trois comptes et leurs trois pourcentages**, chaque pourcentage suivi du
compte de sa ligne (§ 12), les occupants, les affiliés et la capacité : il
détaille au-delà de la grille (§ 12.7). Une case tient son chiffre et 24 px de
côté ; une grille dont les cases ne tiennent pas dans la largeur de la carte
cède la place à son jumeau, avec la phrase qui le dit, et le sélecteur reste.
Une case n'est pas une cible : le pointage au plus proche désigne la case sous
le pointeur (§ 12.7), et le jumeau porte les mêmes valeurs. Sans collision, la
grille cède la place à la phrase de la vue des collisions sous la position
« doublons » seulement ; sans appartenance, à celle du § 12.6 sous les trois ;
avec une seule appartenance, elle reste.

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
aucune couleur ne désigne un tour. En encre secondaire, chaque ligne porte le
pourcentage des tours possibles servis à ce tour, ses deux comptes dessous —
« 80 % », « 24 servis sur 30 possibles » —, puis **ses assis sans table
possible** σ_r (§ 5.4) : « 10 assis sans table possible ». Ce compte lit tous
les assis du tour, concernés ou non : il dit combien de personnes aucune table
ne pouvait servir, sans entrer dans le dénominateur, que le plancher borne. Un
tour sans couple possible écrit « — », sans barre ni pourcentage, et garde ses
assis sans table possible. Les mots, la forme des segments et le domaine des
planchers sont ceux du § 12.4.

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
animés — **et à chacun de ses tours animés** : les appartenances rencontrées en
animant A_f, A_{f,r} et, quand une personne présente porte une étiquette, les
étiquettes rencontrées en animant E_f, E_{f,r} (§ 5.4). Le graphique dessine la
soirée ; les deux grandeurs se dessinent en **deux colonnes de barres
horizontales juxtaposées**, chacune avec son axe et sa graduation, les
animateurs dans le même ordre d'une colonne à l'autre : ce sont de petits
multiples, jamais deux séries empilées ni un axe commun — une appartenance et
une étiquette ne s'additionnent pas et ne se comparent pas. **Le moins varié en
tête** : A_f croissant, puis E_f, puis les personnes rencontrées en animant,
puis l'identifiant. Chaque ligne porte en encre secondaire ses tours animés et
ses personnes rencontrées en animant : un animateur d'un seul tour en rencontre
moins, et la vue le montre au lieu de le corriger.

**Le jumeau** porte, dans l'ordre du graphique, la ligne de la soirée de chaque
animateur — tours animés, personnes, appartenances et étiquettes rencontrées en
animant —, puis sous elle une ligne par tour animé, dans l'ordre des tours, avec
les mêmes comptes pour ce tour seul : il détaille au-delà du graphique (§ 12.7),
et dit lequel des tours d'un animateur a appauvri sa soirée. Le pire (animateur,
tour) n'a pas de place fixe : la soirée gouverne l'ordre.

**Au-dessus de chaque colonne, trois nombres** : le moins varié, le plus varié,
et combien d'animateurs sont au minimum — pour A_f, et pour E_f quand sa colonne
existe. Leurs libellés à l'écran sont « le moins varié », « le plus varié » et
« au minimum » ; le mot « équité » n'y paraît pas, réservé au libellé du mode
« l'équité d'abord » (§ 5.3). Aucun indice ne les résume (§ 12.8).

Sans appartenance, ou avec une seule, mais avec des étiquettes, la vue ne trace
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
reprendre.

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
`src/interface`. À la racine du
projet, **`version.json`** est l'unique source de la version (§ 18.3) et
**`src/version.genere.js`** le module qu'elle engendre — **versionné dans le
dépôt**, parce qu'une séance de développement lancée sans l'étape de construction
doit afficher une version et non une importation manquante, et **contrôlé par
rejeu du script**, parce qu'un fichier engendré et oublié affiche une version
périmée avec l'assurance d'une constante.

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
JSON et les scripts d'installation nommés. Dès que la même arithmétique existe
en deux endroits, une suite de tests peut prouver qu'ils s'accordent **sans
jamais prouver qu'ils ont raison** : les deux dérivent ensemble et les tests
restent verts. Une seule implémentation rend ce mode de défaillance impossible.

**Une exception, nommée, et une seule** : le calcul incrémental des indicateurs
du § 5.10. Elle tient à une condition écrite — **le recalcul complet est la
mesure**, celle dont sortent les chiffres affichés ; **l'incrémental n'existe que
dans la boucle de recherche**, où il sert de score et ne s'affiche jamais — et à
une épreuve qui lie les deux à la fin de chaque recherche, à cinq ordres de
grandeur de mouvements (§ 14.10).

### 13.3 La bibliothèque d'interface : Svelte 5, construit par Vite

Le logiciel n'emploie **aucune bibliothèque de dessin SVG** : le plan est du SVG
écrit à la main, et le déplacement, le zoom et la conversion de coordonnées sont
des fonctions pures du module de géométrie.

| critère | ce que Svelte apporte |
|---|---|
| tenir hors ligne | se compile en JavaScript ordinaire ; Vite est une dépendance de développement qui ne survit pas à la construction |
| rester rapide | compile des mises à jour fines, sans arbre virtuel ni mémoïsation à poser à la main — à une exception près : la table d'évaluation des propositions, gardée dans le modèle pur sous l'identité de la charge figée de la séance, qu'une écriture remplace |
| se tester sans navigateur | n'impose d'écrire aucun calcul dans un composant ; le composant ne contient que le câblage |
| être joli sans y passer des semaines | un fichier de jetons — couleurs, rayons, ombres, échelle typographique, cible principale, largeur de page — décliné en deux thèmes ; ses familles de couleur : la page, le bandeau, la carte, l'action principale, les quatre états du plan, le neutre, les appartenances, la bande de mode, les messages (avis, refus, information), le retrait, le plan, le graphique, le papier |

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
l'impression : une interface unique, deux implémentations — plus, pour le système
de fichiers, une **troisième implémentation injectée par les épreuves**, qui sait
simuler l'échec de renommage du § 8.8 et les cinq issues du § 8.6 : le chemin
publié par le lanceur portable, un dossier de travail sous un emplacement de
données applicatives, une sonde d'écriture qui échoue, une perte
d'inscriptibilité **en cours de séance**, et un support amovible. Sans elle, les
100 % de branches exigés des chemins de reprise (§ 14.13) ne s'écrivent pas, et
la règle à cinq issues du § 8.6 reste le code le moins éprouvé du logiciel alors
qu'elle décide de l'endroit où vit la soirée. L'impression a de même sa
troisième implémentation, simulée, qui rend l'issue que l'épreuve choisit.

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

**La frontière des couches est gardée mécaniquement**, et pas seulement par
discipline : un test du **graphe d'imports** refuse qu'un module de `src/moteur`
ou de `src/geometrie` importe de `src/interface`, de `src/application`, de
`src/stockage` ou d'une interface de plateforme. Il refuse de même que
`src/stockage` importe de `src/csv`, de `src/application`, de `src/interface` ou
d'une plateforme, ou touche le navigateur hors de ses deux implémentations du
système de fichiers, qu'aucun autre de ses modules n'importe ; que `src/csv`,
qui lit le modèle du stockage, importe de `src/application`, de `src/interface`
ou d'une plateforme ; que `src/geometrie` importe en outre du moteur, de
`src/csv` ou de `src/demo` ; que `src/application` importe de `src/interface` ou
de Svelte ; et que `src/interface` importe autre chose que Svelte, ses propres
modules, `src/application` et `src/geometrie` — elle atteint le CSV et le moteur
par l'application, jamais en direct. Un type que la documentation d'un module
importe compte comme un import. Le projet `node` ne chargeant pas le greffon
Svelte (§ 14.8), un test de moteur qui importerait un composant échoue au
chargement — mais cette garde-là ne couvre que les composants, et un module qui
touche `document` ne tomberait qu'à l'exécution de la branche fautive.

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
le calcul. Un seuil propre à une épreuve, comme le coût d'un enregistrement
(§ 8.2), porte les trois en commentaire à côté de sa valeur.

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
| **`node:long`** | accord de l'incrémental à 1, 10, 100, 1 000 et 10 000 mouvements ; rejeu du générateur et empreinte ; pagination des badges sur ses cinq comptes A4, ses quatre comptes Lettre et ses deux impositions ; reconstruction de tous les instants du journal ; aller-retour sur la grande démonstration ; coût d'enregistrement ; sonde d'écriture sur système de fichiers réel ; grande grille de propriétés | avant un commit, et à la construction |
| **navigateur** | ce que l'interface dessine, ce que les gestes produisent, les coordonnées ; le scénario de pilotage (§ 19.3) ; les épreuves de style calculé | avant chaque livraison |
| **manuel** | une soirée complète, de la saisie à l'impression ; l'impression réelle sur chaque papier ; le décalage des imprimantes et leur marge non imprimable (§ 11.3) ; les corps du badge et le corps minimal du plan imprimé, la lisibilité des listes de noms, la largeur du bloc de noms, le seuil du glisser, la durée de la pression longue (§ 19.10) ; `pointercancel` et `touch-action` (§ 7.3) | avant chaque livraison au client |
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
| `node` | `node`, aucun DOM | `src/moteur`, `src/geometrie`, `src/stockage`, `src/csv`, `src/demo`, `src/pdf`, `src/application`, et les modules purs de `src/interface` | **absent** |
| `node-long` | `node`, aucun DOM | les épreuves lourdes du niveau `node:long` (§ 14.4), suffixe `.long.test.js`, hors de la série surveillée | **absent** |
| `navigateur` | un vrai moteur de rendu, piloté par le mode navigateur de Vitest | les composants de `src/interface`, les épreuves de coordonnées et de style calculé, le parcours photographié (§ 19.3) | présent |

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

Les données d'épreuve vivent dans `test/fixtures/`, les fichiers d'exemple livrés
restant ceux du § 10.3 — une donnée d'épreuve qui double un fichier livré dérive
de lui. **Les noms inventés d'une donnée d'épreuve sont disjoints du réservoir du
générateur** : le balayage du § 15.6 refuse qu'un fragment forgé apparaisse hors
des listes du générateur, des fichiers de démonstration et des CSV d'exemple, et
une donnée d'épreuve qui emprunte une racine d'organisation plausible le fait
échouer. Un test vérifie cette disjonction, faute de quoi la garde du § 15.6
tombe au premier exemple écrit de bonne foi.

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
| moteur | `node` | indicateurs, plafonds et borne, diagnostic, invariants d'un plan, accord de l'incrémental et du recalcul, registre et compilation de l'ordre des priorités, correspondance des objectifs, empreintes de référence de l'ordre par défaut, détail d'un placement pour la page de qualité, borne de diversité, points de relevé de la recherche |
| géométrie | `node` + navigateur | conversions, ajustement, bornes de zoom, désignation d'un siège ; l'oracle du moteur de rendu au niveau 2 ; la découpe du plan en pages (§ 11.7) ; les échelles, tracés et pointage des graphiques (§ 12.9) |
| stockage | `node` | sérialisation canonique, équivalence geste/entrée/état, reprise après panne, dérivation des noms de fichiers, forme positionnelle et champs facultatifs (§ 8.9), conversion du format 1 avec son journal, compagnon des courses (§ 8.6) |
| analyseur CSV | `node` | encodage, séparateur, association des colonnes, réconciliation des appartenances et des étiquettes, lignes refusées, aller-retour, CSV des objectifs de table |
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

**L'appartenance d'un ancré voyage dans l'instance réduite.** Une table porte un
ancré d'une appartenance inventée, un mobile de la même appartenance existe, la
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

**L'ordre par défaut rend les plans de l'ordre fixe de référence.** Des
**empreintes de référence**, fichier d'épreuve versionné
(`test/fixtures/moteur/empreintes_defaut.json`), gardent les plans et les
grandeurs nommées qu'ils mesurent — excédent, cumulées, rencontres répétées
choisies, retours choisis, redondance, plus grand écart — de la petite
démonstration, de sa variante « conflit inévitable », de la grande et de la
variante sans exception, sous trois graines et un compte réduit ; de la petite
sous chacune des seize combinaisons des quatre cases ; de la petite et de sa
variante sous un compte plus long, où l'acceptation bascule ; et le classement
de douze propositions de la variante et de la grande, plafond a priori connu et
inconnu. Elles ne se régénèrent que par un geste conscient, comme l'empreinte
des démonstrations (§ 15.5, point 5). Il refuse la compilation qui place mal une
composante nulle, déplace un tirage, ou fait basculer l'acceptation sur un autre
rang que celui de l'écart.

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
une collision — des personnes « finance » d'une même appartenance, une personne
de cette appartenance réservée à la table « finance », « séparer les
appartenances » seule cochée, les tours hors objectif au premier palier —,
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
appartenance partagée par tous donne A_max = 1 à toute personne qui rencontre au
moins une personne ; puis un cas où Φ_aff(p) l'emporte, un où G l'emporte, et un
où (N_aff − g_p) + 1 égale G — chaque autre appartenance réduite à une
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

**Le détail d'un placement ne recompte rien.** Ses doublons d'appartenance d'une
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
Ses échelles rendent un pixel d'écran depuis un rang ou un nombre ; ses
graduations sont des entiers ronds pour des comptes ; son escalier ne trace que
des segments horizontaux et verticaux, un pas par rang ; le rang au plus proche
d'une abscisse est borné aux rangs existants, y compris hors du tracé. L'épreuve
refuse une graduation non entière sur un axe de comptes, et un escalier qui
relierait deux rangs en diagonale.

#### Le stockage

**Le système de fichiers est un paramètre, pas un import** (§ 13.4). Sans
l'implémentation injectée, ni le test du renommage ni les 100 % de branches du
§ 14.13 ne s'écrivent, et les chemins de reprise restent le code le moins éprouvé
du logiciel alors qu'ils sont ceux qui perdent une soirée.

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

**Un fichier du format 1 et son journal se convertissent ensemble, au premier
geste.** Ouvrir et passer en écriture n'écrivent rien ; le premier geste écrit
l'état et le journal au format 2, chaque instant d'avant se reconstruit encore,
et défaire revient avant la conversion. Un vrai événement du format 1, avec ses
jalons, en est la donnée d'épreuve, dans la série `node:long`. Il refuse le
journal du format 1 rejeté comme illisible, qu'une écriture remplacerait,
historique perdu.

**Une ligne illisible arrête la lecture et annonce le compte.** Journal de cent
entrées corrompu à la trente-septième : trente-six entrées retenues,
soixante-quatre annoncées écartées.

**La dérivation des noms refuse `con` comme `CON`**, et borne le plus long
chemin que l'événement écrit, corbeille et écriture atomique comprises (§ 8.6) :
le test recompose ce chemin en entier, et échoue sur une borne posée sur
`.gtt.json`, neuf caractères, sur le seul `.gtt-journal.jsonl`, dix-huit, ou qui
oublie la corbeille ou l'écriture atomique. Elle reçoit la racine en paramètre et
son test l'exerce sur les **deux** dossiers de travail possibles (§ 8.6).

**Un renommage atomique qui échoue ne détruit pas la cible.** L'implémentation
d'épreuve échoue au renommage : la cible conserve son contenu antérieur, et le
logiciel nomme le fichier. Il refuse l'écriture qui tronque la cible avant
d'écrire, c'est-à-dire la variante qui perd une soirée quand un agent de
synchronisation tient le fichier ouvert.

**La forme positionnelle du § 8.9 est abîmée délibérément** — une longueur fausse,
un identifiant dupliqué, un identifiant inconnu, un identifiant manquant sans
entrée de réserve — et le logiciel doit nommer chacune et écarter la **seule**
proposition fautive. Un second test **périme** délibérément : il exclut une
personne, supprime une table, réduit une capacité, et exige que les propositions
touchées soient **signalées comme dérive et conservées**, jamais écartées.

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

**Un objectif sur un numéro de table inconnu refuse la ligne, jamais le
fichier.**

#### Le générateur de démonstrations

**Le vecteur du générateur pseudo-aléatoire est rejoué, et il vient de la
publication de référence de l'algorithme.** Un vecteur produit en exécutant
l'implémentation ne prouve rien d'autre que sa stabilité : il fige la transition, y
compris fausse. Pris hors du code, il arbitre. Si l'algorithme retenu ne publie pas
de vecteur, le test change de nature et le dit : il devient un **témoin de
non-régression**, pas un oracle (§ 14.11).

**Le profil d'appartenances attendu est lu dans le fichier livré**, jamais écrit à
la main (§ 15.2).

**Le générateur refuse quatre configurations**, chacune son test : zéro
participant, zéro table, une graine dont aucun tour témoin ne se construit, un
compte de groupes dépassant le réservoir de noms.

**La petite démonstration atteint 8 pour les douze participants, zéro paire
répétée, zéro collision**, et le logiciel écrit « minimum atteint ». Le test mesure
d'abord le plan écrit au § 15.3 — il éprouve les indicateurs contre un oracle —
puis lance la recherche et affirme qu'elle **atteint le même plafond**, sans jamais
comparer le plan obtenu au plan écrit (§ 15.5, point 6).

**La variante 5, 4, 3 annonce au moins quatre collisions cumulées, et au moins une
paire distincte.** Les deux chiffres sont différents et le test les sépare : cinq
personnes ne tiennent pas sur quatre tables sans que deux se retrouvent, donc **au
moins une collision par tour, quatre sur les quatre tours** — mais l'indicateur
« paires de même appartenance » compte des **paires distinctes**, et un plan qui
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

**La pagination s'éprouve sur les comptes qui séparent les deux arrondis, et sur
les deux impositions** : `n = 1, 4, 5, 259, 261` en A4 — jamais 260, où `260 / 4`
tombe juste et où un calcul qui tronque rend la même valeur — et
`n = 1, 2, 3, 257` en Lettre. Le compte est celui des **participants non exclus**.
Série `node:long`.

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

- chaque participant non exclu est assis à **exactement une** table par tour ;
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
éprouve aussi le segment « reste » de chaque appartenance et de chaque tour sur
le domaine des planchers (§ 12.4, § 12.12) et la diversité de chacun contre ses
rencontres et sa borne (§ 5.5) ; la table d'évaluation l'appelle sans eux. Quand
les mesures portent les objectifs des tables ou les animateurs (§ 5.4), elle
éprouve aussi, pour chacun, s(p) ≤ P(p), s(p) ≤ ses tours assis et m(p) ≤ B(p),
puis, sur les totaux, les personnes jamais servies contre les concernées et le
plus de tours hors objectif d'une personne contre le plus de tours possibles.
P(p) ne se compare pas aux tours assis : un plan qui laisse une personne en
réserve à un tour possible le tient au-delà. Elle ne prend pas un plan mais des
mesures, et ce qu'elle refuse n'est pas un geste mais un **dessin**. Les deux
fonctions vivent dans le moteur, sous la même discipline ; les confondre
obligerait le vérificateur de plan à recevoir des indicateurs qu'il n'a aucune
raison de connaître.

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
des centaines de mètres. La liste est fermée : une garde de l'arborescence
refuse la bibliothèque hors de ces cinq familles.

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

**La couverture se mesure et se publie par module**, jamais agrégée. Sa valeur est
de **désigner ce qui n'est jamais exécuté** ; c'est une liste à lire, pas une note.

**Des seuils durs, en branches, sur dix modules.** Le module des indicateurs
et du plafond, les chemins de reprise du stockage, le registre des critères
avec la règle de correspondance des objectifs, et les quatre modules qui
calculent la page de qualité — le détail d'un placement, les paires répétées,
la diversité par animateur et la géométrie des graphiques — tiennent **100 %
de branches**. Ils sont petits, purs — les chemins de reprise à la condition
d'injection du § 13.4 — et chaque branche non couverte y est un cas que
l'opérateur rencontre au pire moment. Ceux de la page de qualité rendent
chaque nombre qu'elle écrit, l'écran ne faisant que les mettre en forme
(§ 12.9) : une branche nue y est un chiffre affiché que rien n'éprouve. Une
branche qu'on ne sait pas couvrir est soit du code mort — on le retire — soit
un cas que la spécification n'a pas prévu — on l'écrit.

**La mesure est sa propre commande**, `make couverture` : la série `node` sous
instrumentation, hors des budgets du § 14.14. Elle publie un tableau par couche
et par module, et un rapport à parcourir qui montre, ligne à ligne, ce qui n'est
jamais exécuté. Les seuils portent sur dix fichiers —
`src/moteur/indicateurs.js` et `src/moteur/plafond.js`, `src/stockage/depot.js`
et `src/stockage/journal.js`, `src/moteur/criteres.js` et
`src/moteur/correspondance.js`, `src/moteur/qualite.js`,
`src/moteur/paires.js`, `src/moteur/diversite.js` et
`src/geometrie/graphique.js` — et la commande échoue en deçà. Un test de
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
   rejoue contre les épreuves longues qui l'atteignent avant d'être compté. Le
   résultat s'écrit sous **`audit/`**, versionné : `mutation-moteur.md`, le
   rapport à lire, et `mutation-moteur.json`, le même à comparer d'un audit à
   l'autre ; `mutants-equivalents.json` y déclare, un par un et avec sa raison,
   les survivants qui ne changent rien et qu'aucune épreuve ne peut donc tuer.
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
**deux** inégalités — plus gros groupe ≤ nombre de tables, plus grande
capacité − places vides ≤ nombre de groupes — puis **construit un tour
témoin**. Les places vides sont les sièges qui restent une fois chaque membre
assis, zéro quand la salle n'en laisse pas : une table reçoit au moins sa
capacité moins ces places, chacun de ses occupants d'une appartenance
différente. Dans une salle exactement pleine, la seconde inégalité se lit
« plus grande capacité ≤ nombre de groupes » ; ailleurs, cette lecture
refuserait à tort deux tables de 3 pour deux membres d'appartenances
différentes, qu'un tour sépare. Le générateur **refuse une graine dont aucun
tour témoin ne se construit**.

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
logiciel doit afficher **« minimum atteint »**, les compteurs de collision et de
répétition **mesurés** à zéro, et la ligne secondaire « ancrés » à **« — »** :
cette démonstration n'ayant aucune réservation, sa population d'ancrés est vide,
et le § 5.4 exige le tiret, jamais zéro.

**La variante « conflit inévitable »** ne change qu'une colonne : appartenances
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
   rang se départagent par leur identifiant entier. **Cette règle vaut pour le
   moteur autant que pour le générateur** : sans elle, le même code et la même
   graine donnent deux placements sur deux moteurs d'exécution, et toute la
   reproductibilité des captures d'écran tombe (§ 19.4).
5. **Le fichier livré est la source de vérité.** Un test rejoue le script
   générateur et compare l'empreinte au fichier livré. **L'empreinte porte sur la
   charge utile, l'en-tête exclu** (§ 8.8) : sans cette restriction,
   `produit_version` la fait échouer à chaque livraison, et le geste conscient
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
d'exemple**. Le balayage s'étend aux **données d'épreuve** (§ 14.9), dont les noms
inventés sont disjoints de ce réservoir : une donnée d'épreuve qui emprunte une
racine d'organisation plausible fait échouer la garde, et c'est ce qui l'empêche
de tomber au premier exemple écrit de bonne foi. Il refuse de passer sur un
balayage vide. **Ce test n'établit rien sur le monde réel** : aucune
vérification locale ne peut prouver qu'un nom forgé ne désigne nulle part une
organisation existante.

---

## 16. Livraison

L'exécutable Windows se construit depuis Linux par `electron-builder`, qui
emballe la coquille Electron du projet et le même `www/` que servent les
plateformes de Capacitor (§ 13.1). La construction s'exécute dans un conteneur,
sous une image épinglée par empreinte, de sorte que la machine de développement
n'a rien à installer en dehors du projet. La cible portable n'exige pas Wine :
`electron-builder` édite lui-même les ressources de l'exécutable. L'image n'en
porte donc pas, et une cible qui l'exigerait — un installateur — y échoue au lieu
de produire le livrable que ce paragraphe exclut. Le conteneur ne reçoit aucune
variable de l'hôte : un numéro de construction d'intégration continue y
remplacerait le quatrième champ de la version Windows (§ 18.1).

**Cette capacité est à vérifier dès la première semaine**, sur un squelette vide,
au même titre que la publication du dossier d'origine par le lanceur portable
(§ 8.6). Découvrir en fin de projet qu'une étape exige une machine Windows coûte
beaucoup plus cher que de le découvrir tout de suite.

Ce qui est livré au client : **un exécutable**, et rien d'autre à installer.

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
   avait disparu : la bibliothèque ne dessine que du texte, des filets et des
   rectangles (§ 11.1). `pdf-lib` tient le cahier des charges étroit qui restait :
   exécution sous `node`, police embarquée en latin étendu et en sous-ensemble,
   table `ToUnicode` écrite, boîte de page exacte, couche de texte extractible, et
   la liberté de ne poser ni date lue à l'horloge, ni identifiant de document, ni
   producteur — la date du document est l'horodatage du placement (§ 14.7).
   `pdfjs-dist` lit sous `node` la couche de texte, les traits et les boîtes dont
   le test dépend entièrement, et trame les pages des captures d'écran du
   § 19.6. Toutes sont des dépendances de développement épinglées à leur version
   exacte : Vite incorpore au paquet ce que la page importe, et rien d'autre.
3. **TRANCHÉ — la désignation des animateurs est manuelle.** Il n'existe aucune
   commande qui les répartit : § 5.8 et § 2.1, étape 6.
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
pas été livré.

**Le guide ne cite jamais un nom complet, il cite le gabarit** (§ 16.1).

### 18.3 Une seule source, quatre destinations

La version est écrite **à un seul endroit**, un fichier `version.json` à la racine
du projet :

```json
{ "version": "2026.10.05.01" }
```

Tout le reste en dérive, par un script de construction :

| destination | forme | usage |
|---|---|---|
| `package.json` | technique | ce qu'exigent npm et `electron-builder`, qui en tire la ressource de version Windows |
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
sens unique. Quand la version de format monte, un événement ouvert en écriture par
la nouvelle version **se convertit** (§ 8.8) ; l'ancienne version ne le rouvrira
plus qu'en lecture seule. La ligne dit donc, dans ce cas, de **conserver une copie
du fichier avant la première modification** — la conversion n'a pas lieu à
l'ouverture, et c'est exactement le moment où l'opérateur peut encore se ménager
un retour en arrière.

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

1. la version technique de `package.json` n'est pas celle que la
   dérivation du § 18.1 produit depuis `version.json`, ou ne se redécompose pas en
   la version affichée ;
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
   ailleurs que dans `package.json` et le module engendré ;
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
démonstration qui portent `produit_version`, manifeste des captures d'écran,
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
| **en-tête du fichier d'état** (§ 8.8) | champ `produit_version` |

**Le bandeau d'application est le porteur principal, et le titre de fenêtre son
complément.** Un signalement arrive le plus souvent sous forme d'image, et une
capture faite à la touche d'impression d'écran, ou cadrée sur le défaut, ne
contient pas toujours la barre de titre du système — elle ne la contient jamais sur
la plateforme `web`, où le titre est celui d'un onglet. Un bandeau dessiné par
l'application est dans l'image quel que soit le cadrage. Le § 8.4 impose en plus une
bande de mode **sous le bandeau** et un libellé de mode à côté de la place fixe : ils
coexistent, la bande et le libellé signalant le mode dans l'écran de l'événement, le
bandeau portant la version jusque sur la liste des événements.

**Le bandeau annonce aussi la version de format du fichier ouvert** dès qu'elle
diffère de celle que le binaire écrit : plus ancienne, « ce fichier se convertira à
votre première modification » ; plus récente, « ce fichier s'ouvre en lecture
seule ». Le changelog annonce l'événement à la livraison ; le bandeau l'annonce au
moment où l'opérateur peut encore se ménager un retour en arrière, c'est-à-dire
avant le premier geste.

**Le bloc copiable** du panneau « À propos » tient en une ligne — version affichée,
plateforme, provenance de la construction, version de format des fichiers — et se
colle dans un courriel. Un chiffre recopié à la main se recopie faux. Il ne porte
que la version affichée, `2026.10.05.01`, celle du changelog et du nom du
livrable : la forme Windows, `2026.1005.1.0`, reste dans la fiche de propriétés du
fichier, et le guide Windows renvoie au nom de l'exécutable pour la version.
Au-dessus du bloc, le panneau nomme l'éditeur, **TechnoLibre Inc.**, et l'auteur,
**Mathieu Benoit**, développeur, concepteur et mainteneur du logiciel ; « Copier »
ne les emporte pas.

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
  réglage de thème, qui est celui que l'opérateur manipule (§ 13.3), et injecte une
  feuille de style qui annule transitions et animations. L'interface n'en porte
  qu'une : la rotation du signe de chargement de la liste des événements
  (§ 8.1), qu'aucun état n'attend et dont rien ne lit le rendu ; elle s'arrête
  sous la préférence de mouvement réduit, et cette feuille l'annule comme toute
  autre. La préférence système est consultée à chaque lancement, et le réglage
  de l'opérateur vaut pour la séance : rien ne l'enregistre, ni fichier ni
  stockage du navigateur (§ 8.6).
  **Le scénario pose donc le thème par le réglage, à chaque exécution, et ne le
  déduit jamais de la machine.**

### 19.3 Le parcours, et ce qu'il photographie

Un parcours ordonné, du premier écran à l'impression. **Son ordre est celui des
douze étapes du § 2.1, et c'est la seule source de cet ordre** : chaque capture
d'écran déclare l'étape à laquelle elle appartient, et un contrôle du niveau `node`
échoue si une étape n'a **aucune** capture, ou si l'ordre des captures contredit
l'ordre des étapes.

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
| `01-premier-ecran.png` | répertoire neuf | le répertoire vide : la commande de création et les configurations de démonstration offertes, **jamais une liste vide** (§ 8.1) | chaque configuration que le catalogue déclare est nommée et cliquable, et **leur nombre est lu dans le catalogue, jamais écrit dans le scénario** |
| `01b-passer-en-ecriture.png` | idem | la commande « Modifier » à place fixe, la bande de mode et le libellé de mode, sans cadre autour du plan (§ 8.4) | avant ce geste, une tentative de modification est refusée ; après, elle passe |
| `02-import-apercu.png` | `participants_cas_limites.csv` | le haut de l'aperçu obligatoire (§ 10.1) : la nature du fichier choisie, « Participants » (§ 10.4), le mode de l'import, le nom du fichier, l'encodage et le séparateur détectés et **nommés** ; le tableau des colonnes, qui porte l'association par en-tête, s'ouvre au bord inférieur et se poursuit sous l'image | l'encodage et le séparateur affichés sont ceux que le module d'import a retenus ; l'aperçu n'est pas contournable ; au moins un groupe d'orthographes fondu et au moins une ligne refusée sont affirmés sur l'écran, sous l'image |
| `02b-import-cp1252.png` | `participants_cas_limites_cp1252.csv` | le haut de l'aperçu du même contenu en windows-1252 (§ 10.1) : la nature du fichier choisie, le nom du fichier, l'encodage détecté et **nommé**, le séparateur, « virgule » ; les cellules accentuées sont sous l'image | l'encodage affiché est celui que le module d'import a retenu ; les cellules accentuées de l'aperçu sont celles que rend le décodage du fichier, sans caractère parasite, et sont affirmées sur l'écran, sous l'image : l'épreuve lit le texte de l'aperçu, non ce que la fenêtre laisse voir |
| `03-import-rapport.png` | idem | le haut du rapport : les comptes de l'import — personnes ajoutées, mises à jour, inchangées, retirées, réservations retirées —, le nom du fichier, l'encodage et le séparateur | le compte des personnes ajoutées égale le nombre de participants de l'événement, et l'import fait une seule entrée d'historique ; au moins un groupe d'orthographes fondu et au moins une ligne refusée sont affirmés sur l'écran, sous l'image |
| `04-grille-participants.png` | l'événement en construction | la grille éditable, le tri, le filtre, une personne exclue, la légende des étiquettes, chacune chiffrée (§ 10.2) | le compte affiché égale le compte importé |
| `04a-etiquettes.png` | l'événement en construction | la fiche d'une personne avec ses étiquettes en pastilles neutres, le champ d'ajout, et le signal de l'orthographe retenue sous le champ ; la légende des étiquettes, chiffrée, est celle de `04` (§ 10.2) | les étiquettes affichées sont celles de la personne ; une saisie d'une orthographe voisine reçoit l'orthographe existante, et le signal est visible ; la légende compte les porteurs de chaque étiquette, exclues comprises |
| `05-tables-etat.png` | idem, deux tables posées par le scénario | deux tables à 8 places dont l'une **suit le défaut** et l'autre porte une **surcharge de même valeur** (§ 6.1) | les deux états s'affichent différemment **à valeur égale** |
| `05a-objectifs-tables.png` | idem | une table à objectif de soirée qui suit la règle par défaut, que son choix de règle nomme en mots (« selon le réglage général (…) »), une table à objectif de tour à règle propre (§ 4.5) | les deux états de règle s'affichent différemment ; l'objectif auquel personne ne correspond porte son signal ; la règle par défaut, changée puis rendue, n'est pas écrite |
| `05b-import-objectifs.png` | `objectifs_cas_limites.csv` | l'aperçu des objectifs : lignes refusées avec leur motif, orthographes fondues (§ 10.4) | au moins une ligne refusée et un groupe fondu sont visibles ; la nature du fichier, cochée et nommée, et le séparateur nommé sont affirmés sur l'écran, au-dessus de l'image |
| `06-defaut-consequence.png` | idem | l'énoncé chiffré avant application — tables suivant le défaut, surchargées épargnées, total des sièges contre nombre de participants | le total annoncé égale celui que recalcule le moteur |
| `07-plan-tables.png` | idem | le plan, ses tables à l'échelle, l'échelle graphique, la mention « disposition relative » (§ 7.7) | la mention est présente tant qu'aucune dimension de salle n'est saisie |
| `07a-cibles-sieges.png` | **grande démonstration** (celle de la capture `10`) | zoomée jusqu'au régime des sièges : les chaises dessinées une à une, chacune une cible (§ 7.3) | le centre d'une chaise désigne cette chaise |
| `07a-cibles-tables.png` | idem | au zoom ajusté, sous le seuil de 24 px : la table est la cible, et ses chaises ne se dessinent plus une à une | le même point désigne la table, et aucune chaise |
| `07b-nombre-de-tours.png` | l'événement en construction | l'annonce qui précède le retrait d'un tour : la réservation de portée « tour désigné » que le retrait détruit, nommée (§ 2.1, étape 5) | l'annonce paraît avant toute écriture |
| `08-animateurs-designes.png` | idem | un siège **cadenas fermé + anneau** (réservé, tous les tours) et un siège **hachuré à cadenas ouvert** (titre non pourvu), avec la liste numérotée qui énonce les deux états en toutes lettres (§ 7.6), et les deux listes de travail du § 5.8 | les marques sont des éléments SVG, **aucun point de code emoji dans le sous-arbre** ; aucune chaise ne porte plus de deux marques |
| `09-refus-sur-place.png` | idem | un refus du § 5.9 affiché **sur la place concernée**, nommant sa cause et le geste qui le lève | le refus photographié est l'un de ceux qui subsistent à la pose — `k_t > c_t`, une personne exclue, deux places sur un même tour, un dépôt sur une place réservée à un autre ; aucune boîte de dialogue n'est ouverte |
| `10-diagnostic.png` | **grande démonstration** | le diagnostic préalable (§ 5.6), le plafond a priori, les **99 retours imposés** énoncés à part, et le plancher de l'écart d'itinéraire | les valeurs affichées égalent celles du moteur pour la même entrée ; le plafond des quatre animateurs des tables de 7 vaut **24** |
| `10a-ordre-priorites.png` | l'événement en construction | l'ordre des priorités : paliers numérotés, un palier de deux critères avec leurs poids — excédent de collisions × 1 et tours hors objectif × 3 —, « rencontrer le plus d'animateurs différents » marqué décoché (§ 5.3, § 5.7) | l'ordre affiché est celui que compile le moteur ; la capture `11` qui suit nomme les mêmes paliers ; le choix du mode des objectifs, à son défaut « le plus de places servies », et la commande qui rétablit le défaut sont affirmés hors de l'image |
| `11-propositions.png` | l'événement en construction | plusieurs propositions comparées, l'ordre de classement **écrit dans l'interface** par paliers (§ 5.7), le tableau défilé en largeur des colonnes de diversité jusqu'à celles des objectifs | au moins trois propositions ; l'ordre affiché est celui que produit la clé de tri du moteur |
| `12-qualite-profil.png` | **grande démonstration** | le profil en deux graphiques au même ordre de rangs : l'escalier en comptes de personnes, deux séries — rencontres en trait plein, appartenances en tirets —, le plafond réalisé en repère mixte et la borne de diversité en repère pointillé, chacun nommé sur le tracé ; dessous, les rencontres en pourcentage du plafond réalisé jusqu'à la règle à 100 %, du motif du plafond, l'axe des rangs de ce second graphique hors de l'image ; le pire cas au premier rang (§ 12.3) | la page a **dessiné** plutôt que d'opposer son refus — c'est ainsi que la garde du § 12.3 montre qu'elle n'a pas été déclenchée ; chaque graphique a un seul axe vertical ; le rang 1 est le même dans les deux ; chaque pourcentage écrit est suivi de son compte du pire ; aucun repère n'a le motif d'une série |
| `12a-qualite-sans-placement.png` | **petite démonstration, variante « conflit inévitable »**, avant sa génération | la page sans placement : la ligne de source, le diagnostic préalable et sa phrase (§ 12.6) | aucun graphique n'est dessiné ; la phrase est celle d'« aucun placement » |
| `12b-qualite-une-table.png` | **6 personnes de trois appartenances, une table de 6, 3 tours**, construite, sa génération faite | la phrase d'une seule table à la place du profil, des collisions, de la grille et des paires ; la performance (§ 12.6) | ni profil, ni barre de collision, ni grille, ni tableau des paires n'est dessiné ; la phrase est celle d'« une seule table » |
| `12c-qualite-un-tour.png` | **12 personnes de trois appartenances, 3 tables de 4, 1 tour**, construite, sa génération faite | la vue des tables entière, le sélecteur sur « par siège » et la grille d'une seule colonne, puis la phrase du tableau des paires ; le profil et les collisions, dessinés plus haut, sont affirmés sans l'image (§ 12.6) | aucun tableau des paires, vide ou non, n'est rendu ; la phrase est celle d'« un seul tour » |
| `12d-qualite-une-appartenance.png` | **12 personnes d'une même appartenance, 3 tables de 4, 3 tours**, construite, sa génération faite | le profil à une seule série et sa phrase ; les collisions et la grille des tables, qui restent (§ 12.6) | le profil porte une série et aucune borne de diversité ; les barres des collisions sont dessinées |
| `12e-qualite-sans-collision.png` | **9 personnes de neuf appartenances distinctes, 3 tables de 3, 2 tours**, construite, sa génération faite | la phrase de la vue des collisions ; la grille sous la position « par siège », qui reste (§ 12.6, § 12.11) | aucune barre de collision n'est dessinée ; le sélecteur est sur « par siège » et chaque case écrit 0 |
| `12f-qualite-reserve.png` | **petite démonstration, variante « conflit inévitable »**, sa première proposition retenue puis ajustée au plan : une personne mobile — ni ancrée ni partiellement fixée — mise en réserve au tour 2 | le premier graphique du profil, le point de la personne marqué « en réserve » ; les collisions à un seul segment et la phrase qui dit pourquoi le plancher ne s'applique pas, plus bas, sont affirmées sans l'image (§ 12.4, § 12.6) | aucun segment « prouvé inévitable » n'est dessiné ; le point de la personne porte la marque de la réserve |
| `12g-qualite-plafond-nul.png` | **5 personnes, une table de 4 et une table de 2, 2 tours**, construite : quatre réservées à la table de 4 aux deux tours, la cinquième sans réservation, que sa génération assoit seule à la table de 2 aux deux tours | le point marqué d'un plafond réalisé nul au rang 1 du profil, son infobulle ouverte ; au second graphique, ce rang sans point (§ 12.3, § 12.6) | la cinquième, ni ancrée, ni partiellement fixée, ni en réserve, porte la marque du plafond réalisé nul ; l'infobulle écrit le plafond réalisé 0 et le pourcentage « — » ; le second graphique n'a pas de point à ce rang |
| `13-qualite-collisions.png` | **petite démonstration, variante « conflit inévitable »** | les barres horizontales à deux segments, « prouvé inévitable » et « reste », en **collisions cumulées**, avec l'effectif, les paires distinctes et l'**excédent** en encre secondaire | le segment prouvé vaut **4 collisions cumulées** et égale le plancher du diagnostic, au chiffre près ; les lignes sont triées sur l'excédent (§ 12.4) |
| `13a-qualite-tables.png` | **petite démonstration, variante « conflit inévitable »** | le sélecteur à trois positions sur « par siège », la grille tables × tours, chaque case ses sièges sans appartenance nouvelle, la pire table en première ligne (§ 12.11) | la première ligne porte le plus grand compte de la position « par siège » ; chaque case écrit le nombre que son niveau colore ; une case sans affilié écrit « — » |
| `14-qualite-paires.png` | **12 personnes, 4 tables de 3, 6 tours**, construite | le tableau des paires répétées trié, pas la matrice (§ 12.5) | le tableau n'est pas vide, et la première commande de chaque ligne mène au premier tour où la paire se revoit |
| `14a-fiche-rencontres.png` | **12 personnes, 4 tables de 3, 6 tours**, construite | la rubrique « Rencontres » de la fiche d'une personne, ses premières lignes, les plus revues d'abord ; le haut de la fiche, son nom compris, hors de l'image (§ 12.5) | la ligne de la fiche égale la ligne de la personne dans le tableau des paires |
| `15-pas-de-matrice.png` | **grande démonstration** | à 260 participants, le tableau et non la matrice, avec la phrase qui le dit | aucune matrice n'est dessinée |
| `15a-qualite-objectifs.png` | l'événement en construction, la première proposition du classement montrée | les personnes jamais servies en tête, la soirée en texte, son pourcentage et le compte des jamais servies dessous, puis les barres des tours hors objectif, « prouvé inévitable » et « reste », chacune avec son pourcentage, ses deux comptes et ses assis sans table possible (§ 12.12) | la somme des planchers des tours égale le plancher du diagnostic ; possibles − servis de la soirée égale la colonne des tours hors objectif du tableau des propositions ; chaque ligne de tour écrit ses assis sans table possible |
| `15b-qualite-animateurs.png` | **grande démonstration** | le profil des animateurs rencontrés avec la borne des animateurs en repère pointillé, puis le début de la diversité par animateur sur la soirée, le moins varié en tête ; ses colonnes et leurs trois nombres, plus bas, sont affirmés sans l'image (§ 12.13) | le mot « plafond » n'est pas écrit dans la vue ; la première barre porte le minimum annoncé |
| `15c-qualite-performance.png` | **grande démonstration**, une proposition montrée, dans la séance qui l'a engendrée | la ligne de tête — mouvements évalués, durée et cadence de la génération — et les deux premiers rangs des petits multiples sur l'abscisse logarithmique ; les autres multiples et la phrase du dernier changement, plus bas, sont affirmés sans l'image (§ 12.14) | le dernier point de relevé est le plan de la proposition ; ses valeurs égalent la ligne du tableau des propositions ; la durée écrite est celle dont le parcours a avancé l'horloge |
| `16-minimum-atteint.png` | **petite démonstration** | le bas de l'en-tête chiffré : la diversité d'appartenance, le manque à zéro et **« minimum atteint »** ; les compteurs de collision et de répétition **mesurés** à zéro et la ligne secondaire « ancrés » à **« — »**, plus haut, sont affirmés sans l'image (§ 15.3) | la mention est présente, les compteurs mesurés sont nuls, et la population vide affiche un tiret, **jamais zéro** |
| `17-comparaison-manque.png` | **variante sans exception** (§ 15.1) | les deux profils de manque qui se croisent, l'axe commun, le zéro libellé, les trois effectifs de rangs (§ 12.10.6) | la page écrit sa question en toutes lettres et les trois effectifs ; aucune échelle propre à une courbe |
| `18-comparaison-escalier.png` | idem | l'escalier du manque, jumeau tabulaire de la vue précédente | les effectifs cumulés du tableau reproduisent la courbe |
| `19-ajustement.png` | l'événement retenu | le déplacement d'une personne après la retenue, l'interface disant **lequel des deux gestes** est en cours (§ 5.8) | le libellé de l'état des données est visible |
| `20-mode-lecture.png` | idem | la bande de mode, le libellé de mode à côté de la place fixe, et le bandeau d'application (§ 8.4) | un geste de chaque famille — glisser une personne, glisser une table, tirer une poignée, poser une réservation — est tenté, et l'empreinte d'état est inchangée après les quatre |
| `21-historique.png` | idem | la liste des instants, le fil courant distingué des fils abandonnés, un jalon nommé (§ 8.3) | au moins un fil abandonné est présent et marqué comme tel |
| `22-plan-brouillon.png` / `23-plan-retenu.png` | idem | l'**aperçu d'impression** du plan (§ 11.7) avec son cartouche, son échelle graphique et son horodatage, **avec** puis **sans** le filigrane BROUILLON | **deux images, parce qu'une absence ne se photographie pas** : le filigrane présent sur l'un, absent sur l'autre, et la paire est le seul exposé lisible de la règle |
| `24-badges-controle.png` / `25-badges-planche.png` | idem | la **feuille de contrôle** avec son échelle de 100 mm et ses comptes, puis une **planche** de quatre A6 et ses trois filets de coupe | voir § 19.6 — ces deux images ne viennent pas du navigateur. La paire est nécessaire : la feuille de contrôle est ce que l'opérateur mesure sous une règle avant d'engager la rame, et une planche seule ne le montre pas |

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

**Trois captures sont déclarées et reportées** : `17` et `18`, à l'étape 10, et
`21`, à l'étape 11, montrent la comparaison et la vue d'historique, que le
logiciel n'offre pas encore. Le manifeste les porte comme reportées, à leur
étape et sans image, et le contrôle d'ordre les compte : l'étape 10 n'est pas
une étape sans capture, et leur place dans l'ordre est déjà gardée. Les deux
`07a` se photographient sur la grande démonstration, chargée pour la capture
`10` : sur la soirée que le parcours construit, deux tables, même le zoom le
plus faible laisse les sièges pour cibles, et la bascule ne se montre pas.

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

**L'aperçu d'impression est plus haut que la fenêtre.** `22` et `23` le
photographient au défilement où le filigrane et le pied de la première page
partagent la fenêtre, la barre de l'aperçu hors de l'image ; `23` reprend le
cadrage de `22` sur le placement retenu.

**Trois pièges de dénombrement que cette table évite, et qui sont la raison de sa
forme.**

- **Le premier écran n'offre pas « deux démonstrations ».** Le § 15 en livre
  **quatre** configurations. Une étape qui en affirme deux échoue, ou pire, fige un
  compte faux. Le compte se lit dans le catalogue.
- **Les paires répétées ne sont pas garanties sur la grande démonstration** — le
  § 12.5 donne le dénombrement. Le tableau se photographie sur une configuration où
  la répétition est forcée.
- **Les collisions d'appartenance ne sont pas garanties non plus sur la grande** :
  sa plus grosse appartenance compte 12 membres pour 33 tables. La variante
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
appartenance (`12d`), aucune collision (`12e`), une personne en réserve (`12f`),
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
| **le mode d'affichage du navigateur** | un seul mode, nommé, inscrit au manifeste : les métriques de texte en diffèrent |
| **le cadrage mémorisé** | le § 8.5 range le cadrage dans un fichier de réglages locaux : le scénario démarre sur un **profil neuf**, ce qui lui donne du même geste un dossier de travail neuf |
| **le numéro d'ordre du nom de démonstration** | charger une démonstration crée « ‹nom› 2 » à la deuxième exécution (§ 15) ; le répertoire neuf ramène chaque exécution au premier ordinal |
| **l'horloge** — horodatage d'historique, pied de page, « dernière modification », retour automatique en lecture | **une seule source d'horloge dans toute l'application hors moteur**, et **elle possède aussi les minuteries**. Un instant figé ne suffit pas : un compte à rebours bâti sur une minuterie du moteur d'exécution continue d'avancer sous une horloge gelée, et **le retour automatique en lecture tombe au milieu d'une étape**. Le scénario installe une horloge dont il contrôle l'avance, ce qui lui permet aussi d'éprouver les durées |
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

**La planche de badges est le seul PDF** (§ 11.1), et le logiciel la construit
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

Le PDF tramé est celui que la section des badges vient de produire dans le
parcours, et non une seconde production : la page le passe aux commandes du
lanceur, sous `node`, qui le lisent par `pdfjs-dist` — sa couche de texte, ses
traits, la taille de ses pages — et, sous `make captures` seulement, le trament
à 96 ppp par le canevas natif que `pdfjs-dist` charge. **Seul `make captures`
exige ce canevas** : en vérification, le parcours lit le PDF sans le tramer, et
le contrôle porte sur son empreinte ; sans canevas, le tramage se refuse en le
nommant, et l'étape échoue sans rien publier.

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

1. **Le problème, en une phrase** : asseoir chacun à chaque tour de sorte que le
   plus mal servi rencontre le plus de monde possible. C'est l'objectif de
   l'ordre par défaut ; la section dit en une phrase que l'opérateur peut en
   ranger d'autres devant (§ 5.7).
2. **Pourquoi il n'a pas de réponse évidente**, par un compte, pas par un mot
   savant. Douze personnes se répartissent sur quatre tables **numérotées** de
   trois de **369 600 façons pour un seul tour** — 12! divisé par 6 quatre fois —
   et sur quatre tours le nombre dépasse **10²²**. Le logiciel n'essaie pas toutes
   les combinaisons, et la petite démonstration est le plus petit cas du catalogue.
   Ce compte est vérifiable et remplace avantageusement toute affirmation sur la
   difficulté du problème.
3. **Comment le logiciel cherche** : il part d'un placement complet dont le point
   de départ dépend de la **graine**, **échange** des personnes entre tables, garde
   ce qui améliore, et s'arrête sur un **compte** de mouvements sans amélioration
   (§ 5.10). D'où **la réponse à la première question** : deux recherches parties
   de deux points différents s'arrêtent sur deux placements différents, et aucun
   des deux n'est « le bon ». Cette phrase est **vérifiable, et elle est
   vérifiée** : un test sous `node` affirme que deux graines donnent deux résultats
   et qu'une même graine donne deux fois le même. Un énoncé vérifiable vieillit
   mieux qu'un énoncé vague : si le moteur est réécrit et que la phrase cesse
   d'être vraie, le test le dit.
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
   une appartenance redistribuée.
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

La section s'appuie sur les captures d'écran `10`, `11`, `12`, `16`, `17` et
`18` : le diagnostic, les propositions classées, le profil trié, « minimum
atteint » sur la petite démonstration, et les deux vues de comparaison. Tant que
`17` et `18` sont reportées (§ 19.3), elle s'appuie sur `10`, `11`, `12` et
`16`, et décrit la comparaison par le manque en mots, sur les colonnes du
tableau des propositions. Le point 3 s'appuie en outre sur `15c` : la course
d'une recherche, et son plateau. Le contraste de la variante « conflit
inévitable » (§ 15.3) — une personne déplacée d'une appartenance à l'autre, et
la mention bascule — est le plus court exposé de toute la section, et il tient
en deux images.

### 19.10 Le banc de mesure

La spécification exige à plusieurs endroits un seuil « mesuré » — le nombre de
sièges au-delà duquel le dessin cesse d'être lisible (§ 6.2), le seuil de
participants sous lequel la matrice se dessine (§ 12.5), la largeur de troncature
des noms longs (§ 12.6), le nombre de valeurs distinctes de manque sous lequel
la courbe cède la place à une phrase (§ 12.6), la tolérance de la chaîne témoin
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
forcée, et au moins trois fois la gigue de dix mesures.

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
lequel la courbe cède la place à une phrase appartient à la comparaison.

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

