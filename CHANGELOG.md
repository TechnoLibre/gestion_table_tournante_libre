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

**Version de format des fichiers** : 2. Les étiquettes, les objectifs, leurs
règles, les cases nouvelles, le mode des objectifs et l'ordre des priorités
s'enregistrent dans des champs facultatifs, absents à leur défaut. Un fichier
de format 1, écrit par une version de développement, s'ouvre tel quel et se
convertit, son historique avec lui, au premier geste en écriture.

**En remplaçant** : rien à faire, c'est la première version.
