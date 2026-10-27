# Changelog — Gestion table tournante Libre

## 2026.10.05.01 — 5 octobre 2026

**Ce qui change pour vous**
- L'application s'ouvre et affiche sa version dans un bandeau permanent et dans
  le titre de sa fenêtre.
- La section « Badges » produit la planche de badges en PDF, sur deux modèles
  au choix, que la machine retient : par défaut, des cartes Avery 5392
  prédécoupées, six par feuille Lettre, sans rien à couper, leur feuille de
  contrôle en un second PDF à imprimer sur papier ordinaire, qui montre aussi
  le contour des six cartes pour vérifier l'alignement sur une feuille de
  cartes ; ou des badges A6 à découper, quatre par feuille A4 ou deux à plat
  par feuille Lettre, précédés de leur feuille de contrôle. Chaque feuille de
  contrôle se mesure sous une règle avant d'imprimer. Les badges se rangent
  dans l'ordre alphabétique ou par table, et les A6 feuille par feuille ou en
  pile pour le massicot. Sous Windows, la planche se dépose dans le dossier de
  l'événement et l'application en affiche le chemin ; « Ouvrir le dossier »,
  offert en tout temps dans la section, avant comme après la production, montre
  ce dossier dans l'explorateur, même après que l'événement a été écrit sur un
  autre emplacement.
- Le format de papier se demande une seule fois, au premier aperçu, puis la
  machine le retient ; il se change d'un clic. Les badges ne le demandent
  pas : les cartes Avery 5392 n'existent qu'en Lettre, et les badges A6
  partent sur Lettre tant qu'un autre papier n'est pas choisi.
- Après un changement de dossier de travail, ou une écriture ailleurs, réussie
  ou refusée par le nouveau support, l'application montre le papier que ce
  dossier retient, jamais celui de l'ancien, même un instant.
- Avant de produire, l'application annonce le nombre de badges et de feuilles,
  nomme les homonymes que rien ne distingue et les caractères que la police ne
  sait pas dessiner ; un placement qui ne décrit plus la soirée est refusé, avec
  la raison.
- Un badge perdu se réédite seul : la réédition produit une planche des seuls
  badges choisis, identiques aux premiers tant que le placement n'a pas bougé.
- « Produire la liste (CSV) » dépose à côté de la planche la liste des mêmes
  badges, pour un tableur : nom, prénom, organisation et, dans une seule
  cellule, les lignes de tour du badge, une par ligne. Elle se tire du
  placement retenu ou d'une proposition, dont le nom de fichier porte alors
  « BROUILLON », et se produit même quand un nom trop long empêche la
  planche.
- La ligne de tour d'un badge porte le libellé de la table entre parenthèses
  après son numéro : « Tour 1 — table 5 (Terrasse), siège 3 — animation ». Un
  libellé trop long pour la carte s'abrège ; le numéro et le siège, jamais.
- « Enregistrer sous… » des cartes Avery 5392 affiche les deux chemins
  choisis, et une feuille de contrôle qui ne s'écrit pas le dit en nommant le
  fichier, les cartes déjà déposées. Un modèle de badge que le poste ne peut
  pas retenir s'annonce sous les réglages de la section.
- Sous le pied de chaque badge, le pied TechnoLibre : « Demander un
  développement logiciel personnalisé avec https://technolibre.ca pour votre
  entreprise », suivi du logo de TechnoLibre en couleurs : avec le logo de la
  personne, les seules couleurs du badge. Une case de la section, cochée par
  défaut, le retire, et le poste la retient. Il ne prend que la place libre :
  il rapetisse sur un badge chargé, s'en retire quand même sa plus petite
  taille ne tient pas ou quand le badge perd le nom de l'événement, et
  l'annonce compte ces badges. La feuille de contrôle ne le porte pas.
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
- L'export des participants écrit toujours la colonne `etiquettes`, puis la
  colonne `presence`, en dernières positions ; le collage en bloc suit le même
  ordre de colonnes.
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
  décoché garde son rang et ne compte nulle part.
- Dans l'ordre des priorités, survoler le nom d'un critère, ou l'atteindre au
  clavier, ouvre une bulle d'aide qui dit ce qu'il compte et la colonne des
  propositions qui le montre.
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
  plus dans la liste, dont les tables ou le nombre de tours ont changé depuis
  lui, ou qui n'assied pas quelqu'un là où une réservation posée depuis le
  fixe. Le placement retenu n'est pas un départ.
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
- La liste des événements s'ouvre avec ses chiffres : les mesures du placement
  retenu et la meilleure proposition de chaque événement viennent d'un petit
  fichier à côté de son état, `<nom>.gtt-apercu.json`, la dernière vue
  d'ensemble, sans rien recalculer tant que l'événement n'a pas changé. Un
  événement modifié depuis montre son ancien chiffre atténué, le signe de
  chargement qui tourne à côté, le temps que la liste le recalcule en
  arrière-plan, hors du fil de la page, puis réécrive le fichier. Renommer et
  supprimer l'emportent avec l'événement ; copier et importer ne le recopient
  pas.
- La section « Propositions » offre « Garder les 10 meilleures » : les dix
  premières du classement restent, et celle d'où vient le placement retenu
  aussi, les autres s'effacent. Le nombre se règle dans le champ voisin. Une
  fenêtre dit d'abord combien de propositions partent, et « Défaire » les rend.
  Tant que le classement compte moins de propositions que le nombre choisi,
  le geste refuse d'effacer une proposition qui sert encore de départ sans
  avoir été comparée : générer des dérivées jusqu'à en classer autant, ou en
  garder moins, le lève.
  Une longue liste allégée garde le logiciel rapide ; le nombre choisi ne
  s'enregistre pas dans l'événement.
- Dans le tableau des propositions, les commandes d'une ligne — « Voir sur le
  plan », « Qualité », « Retenir », « Repartir d'elle », « Comparer » — passent
  dans son menu « Actions », un seul bouton par ligne, et chaque phrase
  « Imposé par les réservations » tient sur une ligne : chaque ligne reprend la
  hauteur de ses chiffres. Le menu s'ouvre au clic ou au clavier, et le refus
  d'une commande reste affiché à côté de son bouton.
- La section « Import » offre « Télécharger un modèle » pour le contenu choisi.
  Le modèle des participants montre chaque colonne sur quatre personnes
  inventées, sa colonne de présence réglée par le nombre de tours de
  l'événement ; celui des objectifs de table porte une ligne par table de
  l'événement, et par tour pour une table qui a des objectifs par tour, avec
  deux objectifs d'exemple, « au moins une » et « toutes », sur des lignes
  sans objectif — il en ajoute au besoin une par tour ; un événement dont
  chaque table a déjà ses objectifs n'en reçoit aucun. Une table dont le
  numéro est porté par une autre n'a que des lignes à remplir, et le modèle se
  refuse quand chaque numéro est ainsi partagé, en menant à la section des
  tables. Les deux s'importent tels quels sans aucun refus. Le modèle n'écrit
  rien dans l'événement et reste disponible en lecture.
- Sous « Télécharger un modèle », « Guide import », replié par défaut, décrit
  chaque colonne reconnue du contenu choisi : son en-tête, si elle est
  obligatoire, ce qu'elle contient, comment séparer plusieurs valeurs et ses
  synonymes. Les organisations en conflit se séparent par « ; », « | » ou un
  retour à la ligne dans la cellule, jamais par une virgule, qui reste dans le
  nom.
- Dans un fichier d'objectifs, une ligne sans objectif ni règle est une ligne à
  remplir : l'import la passe sans la refuser, et l'objectif de sa table reste
  en mise à jour.
- Le panneau « À propos » nomme l'éditeur, TechnoLibre Inc., et l'auteur,
  Mathieu Benoit, développeur, concepteur et mainteneur du logiciel. Son bloc à
  copier ne porte plus que la version affichée, sans sa forme Windows.
- L'exécutable pèse environ 8 Mo de moins : il ne garde que le français et
  l'anglais parmi les traductions internes du navigateur qu'il embarque.
  L'interface ne change pas.
- Une **vue d'historique** s'ouvre par « Historique… », à côté de « Défaire »
  et « Refaire » : la liste des gestes de l'événement, le plus récent en haut,
  chacun avec sa date et son heure. L'instant courant y est marqué ; un geste
  défait puis remplacé par un autre reste dans la liste, grisé, avec la
  pastille « fil abandonné ». « Revenir à cet instant » rend l'état d'une ligne
  sans rien effacer, et se défait comme un autre geste. Le panneau nomme
  l'instant courant, ne garde au besoin que les instants nommés, et se lit par
  pages de cent. En lecture, il se lit, et ses commandes demandent « Modifier ».
- Au clavier, sur l'écran de l'événement et hors d'un champ de saisie,
  **Ctrl+Z** défait le dernier geste, **Ctrl+Maj+Z** et **Ctrl+Y** le refont.
  Dans un champ, Ctrl+Z défait la frappe, comme ailleurs ; une touche tenue ne
  défait qu'une fois.
- Un retour fait au clavier nomme sa touche dans l'historique : « Défait
  (Ctrl+Z) : … », « Refait (Ctrl+Y) : … » ; « Défaire » et « Refaire »
  écrivent toujours « Défait : … » et « Refait : … ». Revenir à un instant qui
  a déjà le contenu courant le dit, et nettoyer des propositions sans rien à
  effacer dit qu'aucune n'est à effacer, au lieu de « Ce geste ne change
  rien ».
- Le guide d'usage montre l'historique à l'étape 11, capture à l'appui.
- La liste d'accueil imprimée garde à chaque tour la largeur de son libellé
  de place. Une soirée dont les tours ne tiennent plus côte à côte — une
  trentaine de tours, ou quelques-uns sous des libellés longs — s'y répartit en
  blocs de tours consécutifs, chacun sur ses pages, sous un en-tête qui nomme
  ses tours (« Tours 1 à 6 ») ; chaque bloc reprend les noms.
- **Un dossier par événement.** Le dossier de travail s'appelle `data` dans les
  deux modes : à côté de l'exécutable, ou, sous Windows quand le logiciel n'y
  travaille pas, `Documents\Gestion table tournante Libre\data`. Il porte un
  dossier par événement, à son nom, la corbeille et le fichier des réglages du
  poste. Le dossier d'un événement garde son fichier d'état, son historique et
  son verrou, et reçoit les sorties des badges ; la liste des événements affiche
  le chemin du fichier d'état dans ce dossier. Créer, copier, importer ou
  charger une démonstration crée le dossier. Un événement ne prend jamais le nom
  de la corbeille ni celui du fichier des réglages : nommé « Corbeille », il
  s'enregistre sous « Corbeille (2) ». Son nom compte au plus 68 caractères, à
  la création, à la copie et au renommage : à cette longueur, un nom de
  caractères ordinaires tient entier sous le `data` des Documents, où il compte
  deux fois, au dossier et à ses fichiers ; un nom long raccourcit plus souvent
  celui d'une planche rééditée ou tirée d'une proposition. Un événement dont le
  fichier porte un nom plus long s'ouvre comme avant ; son aperçu d'impression
  refuse d'imprimer, au lieu d'échouer, et offre « Renommer », qui ramène à la
  liste des événements. Renommer emporte tout le dossier : les badges et la
  liste en CSV déjà produits prennent le nouveau nom, leur date gardée, le reste
  — fichiers posés à la main, dossier `logo` — suit sous son nom, et l'ancien
  dossier se retire. Supprimer range tout le contenu du dossier, `logo` compris,
  dans un dossier daté de la corbeille qui le porte directement, puis retire le
  dossier ; la corbeille montre aussi les fichiers de ses sous-dossiers. Un
  dossier qui ne se vide pas — un fichier encore ouvert ailleurs — reste sur le
  disque, et un avis le nomme au-dessus de la liste, sans faire échouer
  l'opération. Un dossier d'événement déplacé ou supprimé pendant la séance
  n'est pas recréé : la production des badges le dit introuvable et propose «
  Enregistrer sous… ». Les fichiers d'événement posés à même le dossier de
  travail, hors d'un dossier, comme ceux posés directement dans
  `Documents\Gestion table tournante Libre`, ne s'affichent plus, ne s'importent
  plus de l'autre emplacement et restent intacts : rien ne les déplace. Il n'y a
  pas de retour arrière : une version antérieure ne voit pas les événements
  rangés en dossiers.
- Sous le placement retenu, glisser hors des tables une personne que sa
  réservation tient à la sienne annonce le refus dès le survol, au lieu de
  « retire du tour ».
- Chaque personne porte une **présence** : les tours où elle est là, « tous »
  tant qu'on ne la change pas. Un retard, un départ avant la fin, une arrivée
  en cours de soirée se disent dans la grille des participants, par une
  colonne « Présence » qui s'ouvre en cases, une par tour, ou dans la fiche ;
  la validation est un seul geste, que « Défaire » reprend. Une présence sans
  aucun tour est refusée : exclure écarte de toute la soirée.
- Une personne absente à un tour n'y a ni chaise ni place en réserve, ne
  compte pas dans les places de ce tour, et ses réservations y sont
  suspendues, le logiciel le dit ; les indicateurs se lisent sur ses tours de
  présence, et ses rencontres des tours où elle était là comptent.
- L'import lit une colonne facultative « présence » : « 1-3 », « 2, 3 »,
  « tours 1 et 2 », « tous ». À la création, une cellule vide vaut tous les
  tours ; en mise à jour, elle garde la présence de la personne que la ligne
  désigne, et l'aperçu écrit « présence inchangée » sur cette seule ligne.
  Un tour hors de la soirée ou une date qu'un tableur a faite d'une plage
  refusent la ligne, avec leur motif.
- Le placement retenu **suit qui est là** : changer une présence, ajouter,
  exclure, réintégrer ou supprimer une personne, importer la liste l'ajuste
  dans le même geste. Qui part laisse sa chaise libre, qui arrive attend dans
  la réserve, que la liste « En réserve dans le placement retenu » nomme au
  plan ; personne d'autre ne bouge, et le retenu ne dérive pas. Exclure ou
  supprimer une personne assise au retenu avertit que ses rencontres des
  tours joués n'y comptent plus.
- Au plan, une carte « Absentes » nomme, sous la réserve, les personnes
  absentes au tour affiché ; chacune ouvre sa fiche.
- Sur le badge, la ligne d'un tour d'absence dit « absente » : « Tour 3 —
  absente » ; la liste d'accueil l'écrit dans la case de ce tour.
- La page de qualité marque d'un losange creux une personne absente à un tour
  au moins ; l'écart d'itinéraire maximal n'y a plus de plancher prouvé dès
  qu'une personne manque un tour, et sa tuile le dit, les autres planchers
  restant.
- Les places manquantes se comptent tour par tour, sur les personnes
  présentes : dès qu'une présence est partielle, l'avertissement et le refus
  de générer nomment chaque tour qui en manque ; sans absence, ils disent
  toujours « Il manque N places à chaque tour ».
- « Repartir d'elle » reste offert sur une proposition qu'un changement de
  participants a mise en dérive : la génération part de son plan ajusté à la
  soirée, et la carte du départ nomme, avant le lancement, qui en est retiré,
  qui est à asseoir, et, à un tour figé, qui prend la meilleure chaise libre
  ou reste en réserve. Une telle proposition ne se classe plus ; ses dérivées
  entrent au classement. Quand le départ est la proposition du placement
  retenu, le lancement avertit si un tour figé du retenu diffère de cette
  proposition ajustée à la soirée — une retouche à la main, ou une personne
  partie puis revenue.
- Le guide d'usage montre la présence, de l'aperçu du modèle aux badges,
  captures à l'appui.
- Un geste, et son retour par « Défaire », s'enregistrent plus vite sur un
  événement qui porte beaucoup de propositions : celles qui ne changent pas ne
  se recopient ni ne se recontrôlent plus. Les fichiers écrits restent les
  mêmes, octet pour octet.
- Pendant une opération longue — ouvrir un événement, charger une
  démonstration, défaire, importer un fichier, finir une génération, ouvrir
  l'aperçu, produire la planche —, une pastille « Traitement en cours… »
  apparaît au bas de la fenêtre au bout d'une demi-seconde : l'application
  n'est pas figée.
- Chaque table du plan porte son numéro en grand au centre du plateau, affiché
  même au zoom où les listes de noms disparaissent, à l'écran comme sur le plan
  imprimé. Un numéro de trois chiffres ou plus s'écrit un peu plus petit sur les
  petites tables, pour ne pas toucher la pastille. La pastille qui compte les
  conflits d'une table passe en haut à droite du plateau, sur son bord, entre
  deux chaises, sans peindre le fond de la table sur le sol autour d'elle ni
  interrompre le contour épaissi d'une table en conflit.
- Le bouton « Paramètres », à gauche de « À propos », règle la taille du texte
  de l'écran, de 90 à 150 %, et le thème clair ou sombre, qui quitte le bandeau.
  La machine retient la taille d'un lancement à l'autre ; le plan, les pages
  imprimées et les badges gardent la leur.
- « À propos » présente le logo de TechnoLibre, qu'un clic offre de
  télécharger en SVG ou en PNG ; les liens vers le site de TechnoLibre, le code
  source du projet et les deux licences, qui s'ouvrent dans votre navigateur ;
  la licence, au choix AGPL-3.0-or-later ou LiLiQ-R+, dont les deux textes
  complets se lisent sur place, sans réseau, et voyagent avec l'exécutable ;
  une demande d'attribution ; et le sommaire des fonctionnalités, chacune sous
  un numéro qui ne change pas, `PLA-08` par exemple, que la spécification porte
  aussi.
- Le logiciel se redistribue au choix sous l'AGPL-3.0-or-later ou sous la
  LiLiQ-R+ : ses sources portent l'identifiant SPDX
  `AGPL-3.0-or-later OR LiLiQ-Rplus-1.1` et les deux textes complets, dans
  `LICENSES/`.
- Le groupe qui sépare les gens qui se connaissent déjà s'appelle désormais
  l'**organisation** — une entreprise, une équipe, une famille, une école —,
  partout : à l'écran, dans les réglages « Séparer les organisations » et
  « Varier les organisations rencontrées », sur les listes imprimées, dans le
  fichier de l'événement et dans l'en-tête `organisation` du CSV ; un fichier
  des participants dont la colonne s'intitule encore « appartenance »
  s'importe comme avant.
- Une table peut porter un **libellé** — « Table d'honneur », « Coin des
  invités » —, soixante caractères au plus, saisi dans le champ « Libellé » de
  « Tables et tours » et retiré en vidant le champ. Sur le plan, le numéro
  monte au-dessus du centre et le libellé s'inscrit dessous, dans le plateau,
  replié sur plusieurs lignes puis abrégé quand il ne tient pas, aux zooms où
  les listes de noms paraissent et sur le plan imprimé. Le panneau de la
  table, son infobulle, son nom pour les lecteurs d'écran et le titre de sa
  feuille imprimée le portent aussi. Il ne change aucun placement.
- L'**ordre des priorités par défaut** commence par l'excédent de collisions,
  puis les rencontres répétées et retours, les collisions cumulées et l'écart
  au plafond a priori : ne pas réunir des collègues ni faire revoir une
  personne passe avant les rencontres de la personne la plus mal servie, et
  une petite salle atteint moins souvent le plan parfait. Un événement qui a
  réglé son ordre le garde. L'ordre d'avant — écart, excédent, cumulées, tours
  hors objectif, rencontres répétées et retours, animateurs, redondance —,
  réglé, rend les propositions d'avant.
- Une personne peut nommer des **organisations en conflit** : son
  organisation entière ne doit en croiser aucun membre à une table, et
  réciproquement. Le conflit d'organisation ouvre l'ordre des priorités par
  défaut et s'y déplace comme les autres critères ; la recherche vise zéro,
  sans jamais l'interdire. Le tableau des propositions et la page de qualité
  en comptent les occurrences, le plan signale chaque table concernée par des
  hachures horizontales, et le diagnostic compte ceux que les réservations
  imposent. Sans conflit nommé, une graine donne les mêmes propositions
  qu'avant. Les conflits se saisissent dans la colonne « Conflit
  d'organisation » de la grille des participants et dans la fiche, une case
  par organisation, au clavier comme à la souris, et une saisie qui en coche
  ou décoche plusieurs ne fait qu'une entrée d'historique ; ils s'importent
  et s'exportent par la colonne `conflit_organisation` du CSV, après la
  présence, plusieurs noms séparés par « ; », « | » ou un retour à la ligne,
  un nom d'organisation qui porte lui-même l'un de ces signes se relisant
  entier. Une organisation qu'aucune personne ne porte, ou la sienne, refuse
  l'import entier, la ligne et l'organisation nommées, jusqu'à ce que le
  fichier corrigé soit réimporté. Une proposition qui garde des conflits le
  dit sous son numéro, « 2 conflits restants », et une réservation ou un
  placement à la main qui en crée un est accepté, la table signalée et son
  panneau nommant la paire.
- **Le logo d'une personne.** Il se pose dans sa fiche, sous la rubrique
  « Logo » : le bouton « Logo » choisit une image PNG, JPEG, GIF, WebP, AVIF,
  BMP, ICO ou SVG, que le logiciel range en PNG dans le sous-dossier `logo` du
  dossier de l'événement, redressée, ramenée à 1 200 pixels de plus grand côté,
  jamais agrandie ; un SVG se dessine à 1 200 pixels de plus grand côté. Une
  photo HEIC, une image TIFF ou un fichier illisible est refusé, avec le conseil
  de l'exporter en JPEG ou en PNG ; un fichier de plus de 25 Mo l'est sans être
  lu, une image de plus de 50 millions de pixels sans être ouverte. Un clic sur
  la vignette montre le logo à la largeur de la fiche, « Fermer » ou Échap la
  rend. « Retirer le logo » n'est offert qu'en écriture, et « Défaire » rend le
  logo d'avant : aucune image ne s'efface, elle ne part qu'avec l'événement, à
  la corbeille. « Copier », « Importer ces événements » et l'écriture ailleurs
  qu'offre une écriture échouée — « Écrire dans les Documents » ou « Choisir un
  dossier… » — emportent les logos, et un avertissement compte ceux qui ne se
  recopient pas, sans refuser l'opération ; un événement importé d'un seul
  fichier ne les emporte pas, et sa fiche dit « Logo introuvable ». Le CSV des
  participants ne porte pas de logo : « Mettre à jour » les garde, « Remplacer »
  compte ceux qu'il retire, que « Défaire » rend. Sur le badge, le logo prend la
  place que le texte laisse entre les tours et le pied, le plus grand possible,
  sans jamais réduire ni retirer un texte ; le pied TechnoLibre rapetisse, puis
  se retire, avant lui, et un logo dont la plus petite dimension n'atteindrait
  pas 8 mm ne se pose pas. L'annonce nomme les personnes dont le logo est
  introuvable ou illisible et compte les badges sans place pour le leur, qui
  s'impriment sans logo, sans rien refuser. Quand un badge désigne un logo, la
  feuille de contrôle ajoute une ligne qui les compte, « Logos : 12 posés, 2
  sans place, 1 introuvable » par exemple, sans image ; la liste des badges en
  CSV ne porte jamais le logo.
- La fiche d'une personne montre en tête son nom, son prénom, son
  organisation, son courriel, son titre pressenti et ses notes, et
  « Modifier » les change dans un formulaire prérempli : « Enregistrer » écrit
  les seuls champs changés en une entrée d'historique, que « Défaire »
  reprend, et rien quand rien n'a changé ; « Annuler » ou Échap referment sans
  rien écrire. Une organisation tapée autrement que celle d'une autre
  personne — casse, accents, espaces — s'enregistre sous l'orthographe
  existante, et la fiche le dit, comme elle dit les conflits d'organisation
  qui suivent le changement. Un nom vidé est refusé sous le champ ; en lecture
  et sur un plan bloqué, « Modifier » refuse à côté du bouton, avec son
  remède.
- À la création d'un événement, la date facultative se choisit dans un
  sélecteur de date, qui la montre au format du poste ; une date commencée mais
  incomplète, ou absente du calendrier, refuse la création, contre son champ,
  sans rien écrire.
- À l'écran, « : », « ; », « ? », « ! » et le guillemet fermant ne commencent
  plus une ligne, et le guillemet ouvrant n'en finit plus une ; un nombre ne se
  sépare plus de son unité (« 20 h 30 », « 3 min 4 s », « 25 Mo »), ni « n° »
  de son numéro, ni le jour, le mois et l'année d'une date : ces espaces
  deviennent insécables à l'affichage, historique compris ; le journal, les CSV
  et les PDF gardent le texte tel quel.
- Sous Linux, quand le gestionnaire de fichiers ne s'ouvre pas, « Ouvrir dans
  l'explorateur » et « Ouvrir le dossier » le disent à côté du bouton, avec la
  raison donnée par le système, au lieu de ne rien faire.
- Dans l'aperçu d'un import, chaque doublon nomme la personne et énumère ses
  lignes, « lignes 15 et 16 », là où les numéros se collaient en « 1516 ».
  « Rendre les noms uniques », dans le bloc des doublons, garde le nom de la
  première personne et numérote les suivantes, « Galet 01 », « Galet 02 », en
  sautant un nom déjà pris ; le fichier n'est pas modifié, l'aperçu se
  recalcule, et le rapport d'import compte les noms rendus uniques. Chaque
  personne ainsi numérotée garde une marque cachée qui dit que le numéro vient
  de l'import : ni la fiche ni le CSV ne la montrent, renommer la personne la
  retire, et « Défaire » la rend.
- Dans la section « Badges », à côté du pied TechnoLibre, cinq cases disent ce
  que chaque badge imprime en plus du nom et des tours : « Organisation »,
  « Nom de l'événement », « Date de l'événement », « Date du placement » et
  « Identifiant ». Toutes cochées par défaut, elles sont gardées sur le poste.
  Une case décochée retire sa donnée de chaque badge, A6 comme Avery 5392, et
  la place libérée revient au reste ; la feuille de contrôle nomme alors les
  données retirées. La liste en CSV ne change pas, et toutes cochées, la
  planche porte les mêmes données qu'avant.
- Dans la section « Badges », juste avant le pied TechnoLibre, la case
  « Laisser le nom des doublons en blanc », cochée par défaut et gardée sur le
  poste, laisse vide, prénom compris, la place du nom sur le badge d'une
  personne que « Rendre les noms uniques » a numérotée, pour l'écrire à la
  main ; une note sous la case le dit. La place garde la hauteur du nom
  entier, et le reste de la carte ne bouge pas. Décochée, le badge imprime le
  nom entier, « Roger Galet 01 ». Le plan, les listes, la liste des badges en
  CSV et la feuille de contrôle gardent le nom entier, et l'ordre de la pile
  ne change pas ; aucune ligne « Identifiant » ne s'ajoute. Sans personne
  numérotée, la planche ne change pas.
- Quand les places manquent, l'avis qui offre « Ouvrir les tables » offre aussi
  « Créer les tables… », et la section « Tables et tours » offre la même
  commande tant qu'il en manque. Elle déplie un petit formulaire : le nombre de
  places par table, pré-rempli du défaut de l'événement, puis ce que la
  création fera, « 22 tables de 8 places : 176 places pour 171 participants ».
  « Créer » ajoute aux tables existantes juste assez de tables de cette taille
  pour asseoir chacun, numérotées à la suite, en une seule entrée de
  l'historique que « Défaire » ou Ctrl+Z retire ; l'avis tombe, et une annonce
  nomme les tables créées. Sous une présence partielle, le compte est celui des
  personnes présentes au plus à un même tour.
- Le formulaire « Créer les tables… » offre le choix de la forme, « Rondes » ou
  « Carrées » : celle de la table la plus récemment créée est cochée d'abord,
  « Rondes » quand l'événement n'a aucune table. Le fichier de l'événement ne
  change pas.
- Dans « Tables et tours », chaque table porte une rangée « Animateurs » : ses
  animateurs en pastilles, chacun avec un bouton qui le retire, puis
  « Ajouter… ». Ce bouton ouvre une fenêtre qui cherche les personnes par nom,
  prénom ou organisation, sans égard aux majuscules ni aux accents, les groupe
  par organisation, et dit pour chacune si elle anime déjà une table, si elle
  est absente à un tour, si une place lui est réservée, si elle est exclue ou
  placée au plan retenu ; celles qu'on ne peut pas choisir ont leur case
  désactivée, avec la raison. Les personnes cochées sont désignées ensemble
  sous le titre saisi, « animateur » par défaut, en une seule entrée de
  l'historique, chacune avec son propre titre, à une place qu'aucune autre
  personne ne tient (la sienne d'abord, si elle en tient une) : un titre posé
  avant reste tel quel, et une place réservée à la main est passée. Si une
  seule est refusée, aucune n'est désignée, et le refus la nomme dans la
  fenêtre, qui reste ouverte ; son remède abouti, le refus part et le focus
  revient à « Ajouter ». Retirer un animateur de sa rangée retire sa
  réservation et son titre ensemble, un seul titre, le reste de la table
  intact. En lecture, les pastilles restent, sans ces boutons.
- Dans la section « Badges », sous la case du pied TechnoLibre, un champ porte
  le texte de ce pied, prérempli de l'invitation d'origine : on le remplace par
  le sien, et le poste le garde, comme la case ; « Texte par défaut » remet
  l'invitation. Le texte s'enregistre quand on quitte le champ, se replie seul
  sur le badge — un retour à la ligne y devient une espace — et rapetisse,
  puis se retire faute de place, comme l'invitation. Laissé vide, le pied ne
  porte que le logo. Un caractère que la police ne dessine pas s'annonce avant
  de produire et se nomme sur la feuille de contrôle, qui ne change pas
  autrement ; la liste en CSV non plus. Garder l'invitation d'origine ou y
  revenir donne la même planche, octet pour octet.
- Le texte du pied TechnoLibre ne laisse plus un mot seul sur sa dernière ligne,
  sauf quand ses deux derniers mots ne tiennent pas ensemble sur une ligne (le
  dernier bout d'un mot coupé, trop long pour une ligne, compte pour un mot) :
  ses lignes s'équilibrent, sans en ajouter une, et l'invitation d'origine, sur
  deux lignes, finit par « avec https://technolibre.ca pour votre entreprise ».
  Un texte remplacé suit la même règle.
- Un événement neuf propose 20 propositions par génération et un compte
  d'arrêt de 2 000 000 mouvements, au lieu de 5 et de 200 000 ; l'historique
  d'acceptation reste 1 000. Une génération à ces réglages dure bien plus
  longtemps, et tant qu'aucune durée n'est mesurée dans la séance, elle
  demande d'abord confirmation sur les postes de moins de dix processeurs
  logiques. Un événement existant garde les réglages que son fichier porte,
  et les démonstrations livrées gardent les leurs.
- La liste des participants dit les conflits du placement de chaque personne,
  même sans « Grouper par » : la colonne « Conflits du placement », juste après
  celle des conflits d'organisation, les résume tour par tour, en nommant qui la
  personne revoit et à quelle table elle revient — « tour 2 : même
  organisation ; se revoient avec Iris Ombrelle ; revient à la table 5 » —, un
  tiret sans conflit, pour la proposition que le plan montre ou, à défaut, le
  placement retenu. Elle se lit seulement et ne s'exporte pas. La fiche de la
  personne les détaille dans une rubrique du même nom, juste avant
  « Rencontres », une ligne par conflit : « Tour 2, table 5 : avec Iris
  Ombrelle — même organisation ». Les en-têtes de la grille passent en petit
  corps, pour que les dix colonnes tiennent.
- La section « Diagnostic » explique chaque ligne, toujours visible : une
  phrase « Concrètement : » dit ce qu'elle signifie avec les chiffres de
  l'événement — « à une table de 8, on rencontre 7 personnes par tour ; sur
  les 4 tours, 28 personnes différentes au plus, et seulement sans jamais
  revoir quelqu'un » —, nomme les places qui restent vides à chaque tour et ce
  qu'elles coûtent à qui s'assoit à une table incomplète, et dit des retours
  imposés que chaque personne réservée reste à sa table, des retours voulus
  qui ne comptent pas contre les propositions. Le remède qui dit un geste
  s'ouvre sur « Pour changer cela : », et le plafond reçoit le sien : des
  tables plus grandes, ou un tour de plus. Le panneau à côté du plan garde les
  lignes seules.
- Sous « Tout l'événement », le diagnostic explique la proposition choisie
  — celle que montre le plan, sinon le placement retenu, sinon la meilleure
  du classement — en trois blocs : ce qui est atteint (le moins bien servi
  rapporté à son plafond a priori, les collisions, les retours, la diversité,
  chacun sous sa règle cochée), ce qui manque et pourquoi (la part des places
  vides et celle des revoirs, puis « hors d'atteinte » quand le diagnostic
  prouve qu'aucun placement n'atteint le plafond de chacun), et ce qu'on peut
  tenter (« Repartir d'elle » avec un compte d'arrêt plus élevé quand une
  part du manque ou une règle cochée dépasse l'inévitable, les tables, ou
  rien pour les rencontres au minimum atteint).
- Le diagnostic chiffre ce que coûtent des organisations en conflit qui ne
  peuvent jamais partager une table : une carte « Organisations en conflit »
  dit, par exemple pour deux organisations de 20 et 13 personnes sur 22
  tables de 8, « au moins 44 collisions cumulées sur les 4 tours (11 par
  tour) » tant qu'aucun conflit ne se produit, explique que chaque tour
  partage les tables entre elles, et propose des tables de plus ou de lever
  le conflit. Elle ne s'écrit que lorsque ce plancher dépasse celui de
  chaque organisation seule. La carte de la proposition choisie dit d'une
  proposition sans conflit qui l'atteint que ses collisions sont au minimum,
  et ne propose plus « Repartir d'elle » pour elles.
- Le diagnostic calcule de lui-même le plancher exact des collisions, tour
  par tour, toutes organisations, capacités et réservations comprises, 400
  millisecondes après chaque changement de la configuration ; changer un nom
  ou générer des propositions ne le relance pas. Pendant le calcul, une
  ligne sous les cartes dit « Calcul exact du plancher des collisions… tour
  2 sur 4. », pourquoi, et où il en est, avec un bouton « Annuler le calcul
  exact » ; annulé, le diagnostic garde ses planchers habituels jusqu'au
  prochain changement. Quand ce plancher dépasse ceux de chaque
  organisation, la carte « Tout l'événement » s'ouvre sur « tant qu'aucun
  conflit ne se produit, les tables imposent au moins 216 collisions
  cumulées sur les 4 tours (54 par tour) : c'est le minimum exact, qu'au
  moins un plan sans conflit atteint » ; un tour trop long à prouver, au-delà
  de 30 secondes, donne un nombre « au moins ». Quand aucun placement ne peut
  séparer des organisations en conflit à un tour, la carte « Organisations
  en conflit » dit « aucun plan ne peut éviter tout conflit d'organisation
  au tour 2 » à la place de son plancher, et la carte de la proposition
  choisie dit qu'une relance ne fera pas tomber ses conflits à zéro.
- Les avis des tiers livrés avec l'application, `licences/TIERS.txt`,
  nomment le solveur HiGHS, qui calcule le plancher exact des collisions du
  diagnostic, et chaque œuvre que son module WebAssembly compile, chacune
  avec le texte entier de sa licence.
- « À propos » porte une carte « Composants tiers et leurs licences » : chaque
  œuvre que l'application incorpore, avec sa version et sa licence, celles
  qu'un paquet incorpore à son tour en retrait sous lui. « Lire la licence »
  en montre le texte sur place, sans réseau, un seul à la fois. La liste est
  celle de `licences/TIERS.txt`, livré avec l'application.
- Dans « À propos », la carte « Attribution » passe au-dessus de celle de la
  licence, juste sous l'éditeur et l'auteur.
- « Paramètres » et « À propos » se referment d'un second clic sur leur
  commande du bandeau, sans chercher « Fermer » : la commande du panneau
  ouvert reste en surbrillance, et l'écran d'où il s'est ouvert revient
  tel quel.
- Sous la LiLiQ-R+, une permission additionnelle de TechnoLibre Inc., dans la
  notice `LICENSE`, permet de distribuer l'application avec des composants
  sous licence libre permissive, comme ceux qu'elle incorpore ; la carte
  « Licence » d'« À propos » le dit.
- La date d'un événement créé commence en 1900 : une année tapée sur deux ou
  trois chiffres, comme « 0203 », est refusée contre le champ de la date
  par un message qui nomme ce minimum, et ne crée plus d'événement.
- L'aide de la touche Échap pendant un geste sur le plan décrit chaque geste
  qu'elle annule — une table ou une personne déplacée, une capacité changée à
  la poignée, la vue glissée —, et plus seulement la table.
- Le conseil « Repartir d'elle » de la carte de la proposition choisie nomme
  le compte d'arrêt qui a produit cette proposition, même quand les réglages
  de la génération ont changé depuis.
- Le remède « Renommer » d'un nom d'événement trop long ramène à la liste, le
  focus sur « Renommer » de la ligne de cet événement, même si un filtre la
  cachait.
- La fenêtre à confirmer de « Remplacer », à l'import des participants, dit
  combien de logos seront retirés, quand des personnes en portent ; l'avis
  d'après le geste reste.
- Une personne désignée animatrice, devenue absente à un tour, reste dans la
  rangée « Animateurs » de sa table, marquée « Absence au tour 3 », avec son
  × pour la retirer, tant que sa réservation et son titre existent. Quand
  une personne présente pourvoit l'un des titres de la table, l'absente garde
  un titre resté libre, au lieu de quitter la rangée, sans jamais prendre
  celui de la présente.
- « Ouvrir le dossier » et « Ouvrir dans l'explorateur », quand l'explorateur
  ne s'ouvre pas, disent que l'ouverture a échoué, avec la raison que donne le
  système, au lieu de « Cette commande n'est pas offerte ici ».
- Sous Linux, les liens d'« À propos » s'ouvrent par le même ouvreur du bureau
  que « Ouvrir le dossier ». Sous tout système, un lien qui ne s'ouvre pas le
  dit sous les liens de sa carte, avec la raison, au lieu de se taire.
- Des réglages locaux qui ne se lisent pas en disent la raison en clair, sans le
  code interne du refus entre parenthèses. Un fichier qui n'est pas en UTF-8
  le dit, au lieu d'annoncer que le système en refuse la lecture ; un lien qui
  mène hors du dossier de travail le dit aussi ; une lecture que le système
  refuse cite entre parenthèses la cause qu'il donne, comme « EACCES ».
- Un dossier de travail qui refuse l'écriture ne propose plus d'y importer les
  événements de l'autre emplacement : la copie y échouerait.
- Un dossier dont le fichier d'essai se relit autrement qu'il s'est écrit
  nomme cette cause en clair dans l'application de bureau, comme dans le
  navigateur, et non par un code.
- Le sommaire des fonctionnalités d'« À propos » nomme la liste des badges en
  CSV, sous « Produire », avec son numéro, PRO-09.
- Dans « À propos », l'avis du composant tiers @pdf-lib/fontkit porte une
  ligne de copyright par titulaire, sans incise.
- Un import de participants qui épuiserait les numéros de l'événement est
  refusé entier, avec la raison, sans créer personne, comme l'ajout d'une
  seule personne ; il ne laisse plus un événement qui ne s'enregistre pas.
- L'import d'objectifs de table dont l'aperçu a été lu avant un changement du
  nombre de tours est refusé, et dit de relire le fichier, comme celui des
  participants : un objectif ne se pose plus à un tour que la soirée n'a pas.
- Un badge dont la case « Nom de l'événement » est décochée garde le logo de
  la personne et le pied TechnoLibre quand la place le permet, même sous un
  nom de plus de trois lignes : seul ce qui part faute de place, le nom de
  l'événement, puis l'organisation, les retire.
- Une personne en réserve à tous les tours lit sur son badge une ligne « pas
  de table » par tour, et non plus « Toute la soirée — pas de table ».
- Le nom de l'événement décoché, un caractère de ce nom que la police ne
  dessine pas s'annonce encore, et la feuille de contrôle, qui écrit ce nom,
  le donne par son point de code.
- Un texte tapé et pas encore pris ne laisse plus le logiciel revenir seul en
  lecture : le libellé d'un titre dans le panneau d'une place ou d'une table,
  le nombre de « Garder les N meilleures », la graine, le « Nombre de cœurs »
  et le texte du pied TechnoLibre comptent, comme les autres champs, pour une
  saisie en cours. Un « Nombre de cœurs » accepté s'affiche sous sa forme
  normale : « 02 » devient « 2 ».
- Ouvrir une version de secours, depuis la récupération d'un fichier abîmé ou
  par « Ouvrir la version précédente », montre la pastille « Traitement en
  cours… » comme toute ouverture d'un événement.
- Dans la page de qualité, « Diversité par animateur » cède la place à sa
  phrase quand personne n'est concerné par les animateurs, comme « Animateurs
  rencontrés », même si un animateur anime un tour où personne d'autre n'est
  présent.
- La marque d'une personne au plafond réalisé nul, dans l'infobulle et le
  tableau du profil, écrit son écart d'itinéraire : « plafond réalisé nul ;
  écart d'itinéraire de 3 personnes ».
- La phrase qui décrit la grille des organisations à chaque table dit aussi
  combien de cases atteignent le compte le plus haut.
- Sur le plan, la chaise d'un titre pourvu se remplit, même quand la personne
  qui le pourvoit, réservée à la table sans siège, est assise ailleurs ou
  attend en réserve ; elle reste hachurée tant que rien ne le pourvoit.
- Quand toutes les tables sont en conflit, le bandeau du plan nomme les deux
  unités de chaque organisation : « au moins 8 collisions cumulées sur la
  soirée, portées par au moins 2 paires distinctes ».
- Au tableau des propositions, le plus grand manque porte dessous, en petit, le
  plafond réalisé de la personne la plus privée. Quand des réservations ancrent
  des personnes à leur table, le minimum des organisations rencontrées, le taux
  de diversité et les trois chiffres du manque portent aussi la même mesure sur
  les mobiles et sur les ancrés : « mobiles 26 · ancrés 24 ». Dans la page de
  qualité, les tuiles de ces chiffres écrivent la même ligne, comme les
  colonnes de la comparaison ; celles des tours selon l'objectif et des
  animateurs rencontrés l'écrivent quand des ancrés sont concernés.
- Le guide d'usage, dans « Comment le logiciel cherche », montre en deux
  captures ce que relancer ne peut pas effacer : « minimum atteint » sur la
  petite démonstration, puis, une seule personne passée d'une organisation à
  une autre, les quatre collisions inévitables de la variante « conflit
  inévitable ».
- « Voir sur le plan », depuis la grille des participants, ouvre le plan au
  tour où la personne est assise quand elle est absente ou en réserve au tour
  montré : sa chaise est mise en évidence tout de suite, sans changer de tour
  à la main. Une personne en réserve au tour montré se dit telle dans la barre
  de vue, « — dans la réserve au tour 1 », comme une absente.

**Version de format des fichiers** : 3. Les étiquettes, les objectifs, leurs
règles, les cases nouvelles, le mode des objectifs et l'ordre des priorités
s'enregistrent dans des champs facultatifs, absents à leur défaut ; une
proposition dérivée y porte aussi son départ et ses tours figés, `depart` et
`toursFiges`, absents de toute autre proposition. La présence d'une personne,
`presence`, est absente quand elle vaut tous les tours, et chaque tour d'un
placement nomme ses absents, `absents`, seulement quand il en a. Le libellé
d'une table, `libelle`, est absent quand elle n'en porte pas ; les conflits
d'organisation d'une personne, `conflits`, quand elle n'en nomme aucun ; son
logo, `logo`, le chemin de son image dans le dossier de l'événement, quand
elle n'en a pas ; la marque de son nom numéroté, `nomNumerote`, quand
« Rendre les noms uniques » ne l'a pas renommée. Un fichier de format 1 ou 2,
écrit par une version de développement, est refusé :
il ne s'ouvre pas, ne s'importe pas, et l'application dit que son format, trop
ancien, n'est plus pris en charge, sans rien écrire par-dessus. La course de
la recherche ne va ni dans le fichier de l'événement ni dans son historique :
elle a son propre fichier, `<nom>.gtt-courses.json`.

**En remplaçant** : rien à faire, c'est la première version.
