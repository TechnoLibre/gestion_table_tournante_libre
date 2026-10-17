# Changelog — Gestion table tournante Libre

## 2026.10.05.01 — 5 octobre 2026

**Ce qui change pour vous**
- L'application s'ouvre et affiche sa version dans un bandeau permanent et dans
  le titre de sa fenêtre.
- La section « Badges » produit la planche de badges en PDF : quatre badges A6
  par feuille A4, ou deux à plat par feuille Lettre, précédés d'une feuille de
  contrôle à mesurer sous une règle avant d'imprimer la rame. Les badges se
  rangent dans l'ordre alphabétique ou par table, feuille par feuille ou en pile
  pour le massicot. Sous Windows, la planche se dépose à côté des fichiers de
  l'événement et l'application en affiche le chemin.
- Le format de papier se demande une seule fois, à la première planche ou au
  premier aperçu, puis la machine le retient ; il se change d'un clic.
- Avant de produire, l'application annonce le nombre de badges et de feuilles,
  nomme les homonymes que rien ne distingue et les caractères que la police ne
  sait pas dessiner ; un placement qui ne décrit plus la soirée est refusé, avec
  la raison.
- Un badge perdu se réédite seul : la réédition produit une planche des seuls
  badges choisis, identiques aux premiers tant que le placement n'a pas bougé.
- « Imprimer… » ouvre un aperçu de la page imprimée : le plan, découpé en pages
  repérées quand il ne se lit plus sur une seule ; la liste d'accueil ; la
  feuille par table, une pour la soirée ou une par tour. Les listes imprimées
  replient les noms longs au lieu de les couper.
- L'aperçu et la planche restent disponibles en lecture et sur un plan bloqué,
  et n'écrivent rien dans l'événement.
- Ce qui n'est pas le placement retenu s'imprime avec le filigrane BROUILLON,
  planche de badges comprise ; chaque page porte au pied l'heure du placement
  imprimé et la version.
- Agrandir une table dont la liste de noms passe sur une voisine le signale, et
  propose de déplacer la voisine.
- L'interface et les badges emploient la même police, Noto Sans.
- Le guide d'usage suit la soirée étape par étape, captures d'écran à l'appui,
  de la création de l'événement à la planche de badges.
- Chaque personne peut porter des **étiquettes** — « finance », « Montréal »,
  « bénévole » —, vingt au plus, ajoutées et retirées sur sa fiche, ou
  importées par une colonne « Étiquettes » du fichier des participants,
  plusieurs par cellule, séparées par une virgule, un point-virgule ou une
  barre verticale. Une étiquette écrite autrement qu'une étiquette déjà
  présente — casse, accents, espaces — reçoit l'orthographe existante, et le
  logiciel le dit ; une légende compte les personnes qui portent chacune. En
  mise à jour, une cellule vide garde les étiquettes de la personne.
- L'export des participants écrit toujours la colonne `etiquettes`, en
  dernière position ; le collage en bloc suit le même ordre de colonnes.
- Une table peut porter un **objectif** : les étiquettes des personnes qu'elle
  attend, sous la règle « au moins une » ou « toutes », pour la soirée ou pour
  un tour désigné, dont l'objectif remplace alors celui de la soirée. Un
  objectif ne fixe personne : il oriente la recherche. La règle par défaut se
  règle avec les places par défaut ; chaque objectif la suit ou porte la
  sienne. Un objectif auquel aucune personne présente ne correspond est
  signalé sous l'objectif ; retirer un tour retire les objectifs de ce tour,
  et le logiciel l'annonce avant d'appliquer.
- Les objectifs s'importent d'un second fichier CSV — colonnes `table`,
  `tour`, `objectif`, `regle` —, en cochant « Objectifs de table » avant de
  choisir le fichier, par le même aperçu que les participants, en « Mettre à
  jour » ou en « Remplacer ». « Exporter les objectifs » écrit ce même format,
  en lecture et sur un plan bloqué aussi.
- La section « Génération » porte deux cases nouvelles : « Respecter les
  objectifs des tables », cochée, et « Rencontrer le plus d'animateurs
  différents », décochée. Anime à un tour la personne qui y pourvoit un titre
  de place ; la seconde case fait rencontrer à chacun le plus d'animateurs
  différents, à la table où ils animent.
- « Objectifs des tables : chercher d'abord » choisit ce que le critère des
  objectifs poursuit : le plus de places servies, par défaut ; chacun au moins
  une fois ; ou l'équité d'abord, qui sert d'abord la personne la plus mal
  servie, puis le plus grand total.
- L'**ordre des priorités** se règle : des boutons montent ou descendent un
  critère d'un palier, ou le joignent au palier du dessus, où chaque critère
  reçoit un poids entier de 1 à 100 ; « Rétablir l'ordre par défaut » revient
  au départ. La recherche poursuit l'ordre réglé et le classement l'applique ;
  la phrase au-dessus du tableau nomme les paliers dans l'ordre. Un critère
  décoché garde son rang et ne compte nulle part. Sans objectif, sans la case
  des animateurs et sous l'ordre par défaut, une graine donne les mêmes
  propositions qu'avant.
- Le tableau des propositions ajoute le groupe de colonnes des objectifs des
  tables et des animateurs, quand l'un de ces critères compte ; le diagnostic
  dit combien de tours hors objectif la configuration impose au moins, pour
  ne pas relancer vers un zéro qu'elle interdit.
- Changer les étiquettes, les objectifs, les règles, les cases ou l'ordre des
  priorités ne met aucune proposition en dérive : le classement se refait.
- Au lecteur d'écran, les commandes répétées sous chaque table — places,
  objectifs, règle, retrait, et les remèdes de leurs refus — nomment leur
  table ; après un remède qui lève son propre refus, le focus revient à la
  commande refusée.
- Sur la grande démonstration, une génération sans objectif prend environ 1 %
  de plus qu'avant les étiquettes ; avec étiquettes et objectifs, 7 à 8 % de
  plus, quels que soient le mode et l'ordre. Recalculer le tableau de 200
  propositions prend 2 à 9 % de plus, ouvrir l'onglet des propositions
  environ 5 %.
- Le guide d'usage montre les étiquettes, les objectifs des tables, leur
  import et l'ordre des priorités, captures à l'appui.
- Une neuvième section, « Qualité », suit « Propositions » dans la phase Placer.
  Elle mesure le placement que le plan montre — le retenu ou la proposition
  montrée — et répond à deux questions : ce placement est-il bon, et qui s'y
  trouve mal servi ? Chaque ligne du tableau des propositions offre « Qualité »,
  qui montre la proposition au plan et ouvre la page. La page ne modifie rien :
  elle reste ouverte en lecture, sur un plan bloqué et pendant une génération.
- La page se lit vue par vue, une liste en tête menant à chacune : l'en-tête
  chiffré, une tuile par colonne du tableau des propositions, chaque borne celle
  d'une personne nommée ; le profil trié des rencontres ; les collisions
  d'appartenance, « prouvé inévitable » et « reste » ; les appartenances à
  chaque table ; les paires répétées ; les objectifs des tables ; les animateurs
  rencontrés ; la diversité par animateur ; la performance du calcul. Un cas
  sans objet — une seule table, un seul tour, aucune appartenance, aucune
  collision… — s'écrit en une phrase, jamais par des axes vides.
- Une tuile écrit sous son chiffre le plancher que le diagnostic prouve pour sa
  mesure, « plancher 4 », et « plancher 4, le meilleur atteint »
  quand la mesure l'égale : collisions cumulées, paires distinctes, excédent,
  écart d'itinéraire maximal et, chacun quand le critère des objectifs le
  compare sous le mode réglé, personnes jamais servies, plus de tours hors
  objectif d'une personne et tours hors objectif. Sur un placement qui assoit
  chacun à chaque tour et tient chaque réservation, relancer ne fera pas passer
  la mesure sous ce plancher ; hors de là, un placement ajusté qui laisse
  quelqu'un en réserve par exemple, la page n'en écrit aucun. Sans plancher
  prouvé, la tuile n'en écrit aucun, jamais un 0.
- Chaque graphique a son tableau jumeau, qui s'ouvre à la demande sous le
  graphique et se parcourt au clavier et au lecteur d'écran ; l'infobulle d'un
  point en porte la ligne. Les graphiques se lisent dans les deux thèmes et sans
  leur couleur : chaque tracé a son motif.
- Les parts se lisent en pourcentages, sur la page de qualité seulement, et
  chaque pourcentage est suivi, juste dessous, du pire cas en compte : « 88 % »,
  puis « minimum 24 sur 27 » ; « 77 % des tours possibles servis », puis « 3
  personnes jamais servies ». Sur une ligne de tableau ou d'infobulle, il est
  suivi du compte de cette ligne, « 5 appartenances pour 8 sièges ». Le tableau
  des propositions garde ses comptes.
- Le profil des rencontres se dessine en deux graphiques, au même ordre de
  personnes, de la plus mal servie à la mieux servie : en comptes, avec le
  plafond réalisé en trait mixte et la **borne de diversité** — une borne
  arithmétique, qui ne prouve rien, des appartenances qu'une personne peut
  rencontrer à ses tables — en pointillés ; puis en pourcentage du plafond
  réalisé, jusqu'à la règle à 100 %.
- Les appartenances à chaque table se lisent sur une grille tables × tours, sous
  trois positions d'un sélecteur : « appartenances par siège », par défaut,
  « appartenances par personne assise » et « doublons parmi les affiliés ». La
  pire table vient en tête ; la position choisie se garde jusqu'à la fermeture
  de l'événement et n'écrit rien.
- La fiche d'une personne porte une rubrique « Rencontres » : les personnes
  qu'elle a rencontrées, le nombre de fois et les tours, les plus revues
  d'abord. C'est le chemin vers une personne quand la matrice « qui a rencontré
  qui » ne se dessine pas, au-delà de 44 participants.
- Les objectifs des tables se lisent tour par tour : les personnes jamais
  servies d'abord, la soirée, puis une barre par tour, avec ses tours hors
  objectif, la part que la configuration rend inévitable, et les personnes
  assises sans table possible.
- Les animateurs se lisent en deux vues : les animateurs que chacun a
  rencontrés, avec la borne des animateurs en pointillés ; puis la diversité que
  chaque animateur voit à sa table, appartenances et étiquettes, sur la soirée,
  et tour par tour dans le tableau jumeau, avec le moins varié, le plus varié et
  combien sont au minimum.
- La performance du calcul montre la course de la recherche qui a produit la
  proposition : ses mouvements évalués, la valeur de chaque critère à 1, 10,
  100… mouvements, toujours remesurée sous les réglages courants, et le dernier
  point où une valeur a changé. La durée et la cadence de la génération
  s'affichent pendant la séance qui l'a produite ; rouverte plus tard, la
  proposition garde sa course et dit sa durée inconnue.
- La course de chaque proposition se garde dans un fichier à côté de celui de
  l'événement, `<nom>.gtt-courses.json`, écrit seulement quand les propositions
  changent — génération, effacement, retour dans l'historique. Le perdre ne perd
  rien de votre travail : la page dit seulement que la course n'est pas gardée.
  Renommer, copier et supprimer l'événement l'emportent avec lui ; un fichier
  d'événement venu d'ailleurs arrive sans course connue.
- Rien de la page de qualité ne s'imprime, et aucun indicateur ne s'exporte en
  CSV : elle se lit à l'écran, où l'on choisit sa proposition.
- À graine égale, les propositions et leur classement sont les mêmes qu'avant la
  page de qualité.
- Le guide d'usage montre la page de qualité, ses vues et ses cas limites,
  captures à l'appui.
- Une génération peut **repartir d'une proposition** : « Repartir d'elle », sur
  sa ligne du tableau, en fait le départ et ouvre la section « Génération », qui
  le nomme — « Départ : proposition n° 4 » — et lance « Générer depuis n° 4 ».
  Les propositions qu'elle produit, dites dérivées, partent du plan du départ
  sous de nouvelles graines, ne gardent un changement que s'il améliore, et
  entrent au même classement que les autres. « Repartir de zéro » retire le
  départ ; le choisir n'écrit rien et reste possible en lecture.
- Sous le départ, une case par tour **fige** ce tour : chaque dérivée le reprend
  tel quel, sièges compris quand l'événement les attribue, et la recherche ne
  refait que les autres tours, en tenant compte des rencontres déjà faites dans
  les tours figés. Figer tous les tours est refusé.
- Le lancement refuse, en nommant la cause et le remède, un départ qui n'est
  plus dans la liste, qui ne décrit plus la soirée — une personne ajoutée ou
  retirée, une table changée depuis lui —, ou qui n'assied pas quelqu'un là où
  une réservation posée depuis le fixe. Le placement retenu n'est pas un départ.
- Chaque dérivée porte sous son numéro « Dérivée de n° 4. », ou « Dérivée de
  n° 4, tours 1 et 2 figés. », et « qui n'est plus dans la liste » quand son
  départ a été effacé. La même phrase se lit sur la page de qualité, dont la
  performance dit que la course est « partie de la proposition n° 4 ».
- L'issue d'une génération dérivée nomme la place au classement de la meilleure
  dérivée et celle du départ, et offre « Comparer n° 23 à n° 4 » ; quand toutes
  les dérivées égalent leur départ, elle dit que le départ n'avait rien à
  reprendre. L'historique écrit « Généré 5 propositions dérivées de n° 4 (n° 21
  à 25), tours 1 et 2 figés ».
- La page de qualité gagne une vue « Comparaison », la troisième, qui répond à
  « laquelle des deux sert mieux, et qui y perd ? » pour deux placements : la
  proposition montrée, ou le retenu, et un second choisi par « Comparer » sur
  une ligne du tableau des propositions ou dans la liste « Comparer à : » de la
  vue. Le retenu se compare aussi, ajusté contre sa proposition d'origine. Sans
  choix, la vue compare une dérivée à son départ.
- La vue superpose les deux profils de manque sur un même axe, compte les rangs
  où chacun sert mieux, nomme le rang de bascule quand il n'y en a qu'un, et
  dit quand l'un sert mieux à tous les rangs. Au-dessus, les chiffres des deux
  placements se lisent en deux colonnes côte à côte, puis, sous « Tous les
  indicateurs », ceux de toutes les tuiles. Le minimum brut, les tours hors
  objectif et le minimum des tours selon l'objectif y portent leur
  pourcentage, chacun suivi du compte du pire, comme sur les tuiles ; le tracé,
  son infobulle et les phrases restent en comptes. Son tableau jumeau est
  l'escalier du manque. Quand le manque prend trop peu de valeurs, une phrase
  remplace le tracé.
- Sur la page de qualité, la ligne « … au manque maximal » sous le plus grand
  manque compte les personnes à ce manque, et non toutes celles à qui il en
  manque ; elle se tait quand personne ne manque de rien.
- Rien de la comparaison ni des dérivées ne s'imprime, et rien ne s'exporte en
  CSV. À graine égale, une génération ordinaire donne les mêmes propositions
  qu'avant les dérivées.
- Le guide d'usage montre le départ, les dérivées au tableau et la vue de
  comparaison, captures à l'appui.
- Dans la liste des événements, le placement retenu montre ses « Collisions
  cumulées (paire et tour) » et ses « Rencontres répétées choisies (paires) »,
  les mêmes nombres que les colonnes du tableau des propositions, au lieu de
  « Diff somme d'appartenance ». Le réglage « Cible de la somme de redondance »,
  qui ne servait qu'à cette ancienne colonne, quitte la section des
  propositions : un fichier qui le porte s'ouvre sans message, et le perd au
  premier enregistrement.
- La section « Propositions » offre « Garder les 10 meilleures » : les dix
  premières du classement restent, et celle d'où vient le placement retenu
  aussi, les autres s'effacent. Le nombre se règle dans le champ voisin. Une
  fenêtre dit d'abord combien de propositions partent, et « Défaire » les rend.
  Une longue liste allégée garde le logiciel rapide ; le nombre choisi ne
  s'enregistre pas dans l'événement.
- La section « Import » offre « Télécharger un modèle » pour le contenu choisi.
  Le modèle des participants montre chaque colonne sur quatre personnes
  inventées ; celui des objectifs de table porte une ligne par table de
  l'événement, et par tour pour une table qui a des objectifs par tour, avec
  deux objectifs d'exemple, « au moins une » et « toutes », sur des lignes
  sans objectif — il en ajoute au besoin une par tour ; un événement dont
  chaque table a déjà ses objectifs n'en reçoit aucun. Une table dont le
  numéro est porté par une autre n'a que des lignes à remplir, et le modèle se
  refuse quand chaque numéro est ainsi partagé, en menant à la section des
  tables. Les deux s'importent tels quels sans aucun refus. Le modèle n'écrit
  rien dans l'événement et reste disponible en lecture.
- Dans un fichier d'objectifs, une ligne sans objectif ni règle est une ligne à
  remplir : l'import la passe sans la refuser, et l'objectif de sa table reste
  en mise à jour.
- Le panneau « À propos » nomme l'éditeur, TechnoLibre Inc., et l'auteur,
  Mathieu Benoit, développeur, concepteur et mainteneur du logiciel. Son bloc à
  copier ne porte plus que la version affichée, sans sa forme Windows.
- L'exécutable pèse environ 8 Mo de moins : il ne garde que le français et
  l'anglais parmi les traductions internes du navigateur qu'il embarque.
  L'interface ne change pas.

**Version de format des fichiers** : 2. Les étiquettes, les objectifs, leurs
règles, les cases nouvelles, le mode des objectifs et l'ordre des priorités
s'enregistrent dans des champs facultatifs, absents à leur défaut ; une
proposition dérivée y porte aussi son départ et ses tours figés, `depart` et
`toursFiges`, absents de toute autre proposition. Un fichier
de format 1, écrit par une version de développement, s'ouvre tel quel et se
convertit, son historique avec lui, au premier geste en écriture.
La course de la recherche ne va ni dans le fichier de l'événement ni dans son
historique : elle a son propre fichier, `<nom>.gtt-courses.json`.

**En remplaçant** : rien à faire, c'est la première version.
