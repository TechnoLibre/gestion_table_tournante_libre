# Audit par mutation du moteur

Écrit par `make mutation` (`scripts/mutation/audit.js`, § 14.13) ; ne se modifie pas à la main.

| | |
|---|---|
| version | 2026.10.05.01 |
| périmètre | `src/moteur` |
| sources et épreuves du périmètre (SHA-256) | `9d29ff506ad68dc6cc35390cbc5160c8f8b052c0bcc99d3283997ea40befc62f` |
| Node | v26.10.0 |

Chaque mutant se joue contre les épreuves de la série node qui atteignent son module, sous `node --test`.
Un survivant se rejoue contre les épreuves longues qui atteignent son module avant d’être compté : tué par elles, il se compte à part.
Un survivant sur une ligne couverte désigne une épreuve qui exécute sans affirmer.

## Bilan

| mutants | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---:|---:|---:|---:|---:|---:|---:|
| 5147 | 4535 | 7 | 0 | 239 | 366 | 0 |

## Par fichier

| fichier | total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| `src/moteur/classement.js` | 93 | 81 | 0 | 0 | 8 | 4 | 0 |
| `src/moteur/configuration.js` | 907 | 813 | 0 | 0 | 22 | 72 | 0 |
| `src/moteur/conflits.js` | 24 | 24 | 0 | 0 | 0 | 0 | 0 |
| `src/moteur/correspondance.js` | 18 | 18 | 0 | 0 | 0 | 0 | 0 |
| `src/moteur/criteres.js` | 211 | 203 | 0 | 0 | 8 | 0 | 0 |
| `src/moteur/diagnostic.js` | 525 | 447 | 0 | 0 | 33 | 45 | 0 |
| `src/moteur/diversite.js` | 220 | 183 | 0 | 0 | 19 | 18 | 0 |
| `src/moteur/indicateurs.js` | 488 | 429 | 0 | 0 | 23 | 36 | 0 |
| `src/moteur/manque.js` | 218 | 197 | 0 | 0 | 12 | 9 | 0 |
| `src/moteur/paires.js` | 123 | 108 | 0 | 0 | 2 | 13 | 0 |
| `src/moteur/plafond.js` | 490 | 380 | 2 | 0 | 41 | 67 | 0 |
| `src/moteur/qualite.js` | 412 | 394 | 0 | 0 | 5 | 13 | 0 |
| `src/moteur/recherche.js` | 1078 | 936 | 5 | 0 | 57 | 80 | 0 |
| `src/moteur/verification.js` | 340 | 322 | 0 | 0 | 9 | 9 | 0 |

## Par opérateur

| opérateur | total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| arithmetique | 547 | 531 | 0 | 0 | 12 | 4 | 0 |
| frontiere | 298 | 213 | 2 | 0 | 82 | 1 | 0 |
| negation | 721 | 670 | 0 | 0 | 2 | 49 | 0 |
| logique | 189 | 181 | 0 | 0 | 2 | 6 | 0 |
| retrait-non | 83 | 83 | 0 | 0 | 0 | 0 | 0 |
| mise-a-jour | 306 | 175 | 2 | 0 | 2 | 127 | 0 |
| nombre-plus-un | 1014 | 928 | 2 | 0 | 80 | 4 | 0 |
| nombre-zero | 538 | 357 | 0 | 0 | 14 | 167 | 0 |
| booleen | 40 | 39 | 0 | 0 | 1 | 0 | 0 |
| si-vrai | 401 | 382 | 1 | 0 | 15 | 3 | 0 |
| si-faux | 401 | 389 | 0 | 0 | 9 | 3 | 0 |
| ternaire-vrai | 86 | 82 | 0 | 0 | 4 | 0 | 0 |
| ternaire-faux | 86 | 82 | 0 | 0 | 4 | 0 | 0 |
| min-max | 36 | 34 | 0 | 0 | 2 | 0 | 0 |
| corps-si | 401 | 389 | 0 | 0 | 10 | 2 | 0 |

## Survivants (0), lignes couvertes d’abord

Aucun.

## Tués par la série longue (7)

Survivants de la série node que les épreuves longues tuent : la série node exécute leur ligne sans l’affirmer.

| lieu | opérateur | avant | après | ligne couverte |
|---|---|---|---|---|
| `src/moteur/plafond.js:379:9` | si-vrai | `plafond === undefined` | `true` | oui |
| `src/moteur/plafond.js:396:16` | frontiere | `>` | `>=` | oui |
| `src/moteur/recherche.js:438:23` | frontiere | `<` | `<=` | oui |
| `src/moteur/recherche.js:449:16` | nombre-plus-un | `0` | `1` | oui |
| `src/moteur/recherche.js:449:31` | nombre-plus-un | `1` | `2` | oui |
| `src/moteur/recherche.js:496:20` | mise-a-jour | `+=` | `-=` | oui |
| `src/moteur/recherche.js:499:31` | mise-a-jour | `+=` | `-=` | oui |

## Mutants équivalents (239)

Déclarés dans `audit/mutants-equivalents.json`, avec leur raison.

| lieu | opérateur | avant | après | raison |
|---|---|---|---|---|
| `src/moteur/classement.js:43:18` | booleen | `true` | `false` | classement.js, CASES_DE_REFERENCE, nouvelleTable à false : la case ne sert qu'aux rencontres répétées, cochées quand l'une de nouveauxVoisins ou nouvelleTable l'est (estCoche), et nouveauxVoisins reste cochée ; leur valeur qui classe ne lit que nouveauxVoisins (valeursQuiClassent). La compilation de référence ne change pas. |
| `src/moteur/classement.js:73:61` | frontiere | `>` | `>=` | classement.js, plusGrand, valeur >= plus : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/classement.js:155:21` | frontiere | `<` | `<=` | classement.js, comparerCles, i <= a.length : a[length] et b[length] sont tous deux undefined, donc égaux ; la boucle finit et rend 0, comme sans le tour de trop. |
| `src/moteur/classement.js:156:36` | frontiere | `<` | `<=` | classement.js, comparerCles, a[i] <= b[i] sous a[i] !== b[i] : pour deux nombres différents, <= et < coïncident. Une clé ne mêle jamais null et nombre : le premier critère vaut null pour une liste d'écarts vide, et toutes les entrées ont des listes de même longueur (exigerMemeTaille), toutes vides ou aucune. |
| `src/moteur/classement.js:156:46` | nombre-plus-un | `1` | `2` | classement.js, comparerCles, −2 au lieu de −1 : le résultat ne se lit que par son signe, dans sort et dans le \|\| du départage par identifiant. |
| `src/moteur/classement.js:156:50` | nombre-plus-un | `1` | `2` | classement.js, comparerCles, 2 au lieu de 1 : le résultat ne se lit que par son signe, dans sort et dans le \|\| du départage par identifiant. |
| `src/moteur/classement.js:164:15` | nombre-plus-un | `0` | `1` | classement.js, sommer, somme partant de 1 au lieu de 0 : chaque composante de chaque entrée grossit de 1 ; classer et premierPalierQuiDepartage ne font que comparer ces sommes entre entrées, composante par composante, et ne les rendent pas. |
| `src/moteur/classement.js:186:8` | nombre-plus-un | `1` | `2` | classement.js, lirePaliers, rangSaute −2 au lieu de −1 quand rien n'est sauté : aucun palier n'a ce rang, le filtre garde tout, et classer rend null pour tout rangSaute < 0. |
| `src/moteur/configuration.js:87:20` | nombre-plus-un | `2` | `3` | configuration.js, NON_PLACE = −3 au lieu de −2 : la marque ne sert qu'à indexerPlan, qui en remplit tableDe, la compare par !== et === et la remplace par un index de table (≥ 0) ou RESERVE (−1) ; toute case encore marquée lève PLAN_NON_ASSIS, si bien que la marque n'est jamais rendue, et −3 n'égale ni RESERVE ni un index. |
| `src/moteur/configuration.js:290:21` | frontiere | `<` | `<=` | configuration.js, siegesLibresApres, p <= N : le tour de trop lit fixe[N × R + r], undefined, différent de LIBRE ; l'écriture fixees[NaN] += 1 vise un index hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:293:11` | si-vrai | `t !== LIBRE` | `true` | configuration.js, siegesLibresApres, if (true) au lieu de t !== LIBRE : une case libre écrit fixees[−R + r], un index négatif, hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:296:21` | frontiere | `<` | `<=` | configuration.js, siegesLibresApres, t <= T : le tour de trop compare undefined > undefined, faux, et écrit fixees[T × R + r], au-delà de la longueur T × R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:330:17` | corps-si | `{ statut[p] = STATUT.MOBILE; }` | `{}` | configuration.js, deriverStatuts, if (aucune) {} : statut est un Uint8Array, dont chaque case vaut 0 à sa création, et STATUT.MOBILE vaut 0 ; la case reste à 0. |
| `src/moteur/configuration.js:357:42` | nombre-plus-un | `1` | `2` | configuration.js, numeroterObjectifs, rangDe de longueur T × (R + 2) au lieu de T × (R + 1) : toutes les lectures et écritures visent t × (R + 1) + k avec k ≤ R, au plus T × (R + 1) − 1 ; les cases ajoutées en fin ne se lisent jamais. |
| `src/moteur/configuration.js:375:44` | nombre-plus-un | `1` | `2` | configuration.js, numeroterObjectifs, numeroDe de longueur T × (R + 2) au lieu de T × (R + 1) : les lectures visent t × (R + 1) + k avec k ≤ R, au plus T × (R + 1) − 1 ; les cases ajoutées en fin ne se lisent jamais. |
| `src/moteur/configuration.js:393:21` | frontiere | `<` | `<=` | configuration.js, numeroterObjectifs, t <= T dans le calcul de objectifDe : le tour de trop écrit objectifDe[T × R + r], au-delà de la longueur T × R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:394:23` | frontiere | `<` | `<=` | configuration.js, numeroterObjectifs, r <= R dans le calcul de objectifDe : le tour de trop écrit objectifDe[(t + 1) × R], la case du tour 1 de la table suivante, que l'itération de cette table réécrit aussitôt de sa valeur juste ; pour la dernière table, l'index T × R est hors du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:415:21` | frontiere | `>` | `>=` | configuration.js, couplesPossibles, O >= 0 && p < N : sans objectif, la boucle tourne sans rien écrire — correspond est vide, copyWithin(0, 0, 0) ne copie rien, la boucle intérieure (o < 0) ne tourne pas ; seul le temps change. |
| `src/moteur/configuration.js:419:9` | si-faux | `premiere !== undefined` | `false` | configuration.js, couplesPossibles, if (false) au lieu de premiere !== undefined : chaque personne recalcule sa rangée par correspondA, fonction pure des étiquettes et de l'objectif, au lieu de recopier celle de la première personne aux mêmes étiquettes, égale ; seul le temps change. |
| `src/moteur/configuration.js:419:33` | corps-si | `{ correspond.copyWithin(p * O, premiere * O, premiere * O +…` | `{}` | configuration.js, couplesPossibles, corps vide du if (premiere !== undefined) : même effet que le mutant si-faux du même if — la rangée se recalcule par correspondA, pure, au lieu d'être recopiée, égale ; seul le temps change. |
| `src/moteur/configuration.js:431:23` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, t <= T dans le marquage des objectifs offerts : le tour de trop lit objectifDe[T × R + r] et siegesLibres[T × R + r], undefined hors des tableaux typés ; undefined > 0 est faux, rien n'est marqué. |
| `src/moteur/configuration.js:435:23` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, p <= N : le tour de trop lit fixe[N × R + r], undefined, puis objectifDe[NaN] et correspond[NaN], undefined ; undefined === 1 est faux, rien n'est écrit. |
| `src/moteur/configuration.js:442:27` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, o <= O : le tour de trop lit offert[O], undefined hors du tableau typé ; undefined === 1 est faux, oui reste faux. |
| `src/moteur/configuration.js:482:29` | frontiere | `<` | `<=` | configuration.js, deriverAnimateurs, ligne <= T × R : le tour de trop écrit debutAnimes[T × R + 1], au-delà de la longueur T × R + 1 du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:506:7` | si-faux | `A === 0` | `false` | configuration.js, bornerAnimateurs, if (false) au lieu de A === 0 : sans animateur, animes est vide et debutAnimes ne porte que des zéros ; aucune liste de rangs ne se remplit, plusGrandLibre reste à 0, aucune boucle sur les animateurs ne tourne, et chaque borne vaut min(0, 0) = 0, la valeur de la sortie anticipée ; seul le temps change. |
| `src/moteur/configuration.js:506:16` | corps-si | `return borne;` | `{}` | configuration.js, bornerAnimateurs, corps vide du if (A === 0) : même effet que le mutant si-faux du même if — le calcul complet rend des bornes toutes nulles, celles de la sortie anticipée ; seul le temps change. |
| `src/moteur/configuration.js:509:21` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, r <= R dans le parcours des tables à siège libre : le tour de trop écrit plusGrandLibre[R], hors du tableau typé de longueur R, qui n'écrit rien, et pousse une liste libresDuTour[R] que le parcours des personnes (r < R) ne lit jamais. |
| `src/moteur/configuration.js:521:42` | nombre-plus-un | `1` | `2` | configuration.js, bornerAnimateurs, marque remplie de −2 au lieu de −1 : marque[f] ne se lit que par marque[f] === p, avec p ≥ 0 ; aucune des deux valeurs initiales ne l'égale. |
| `src/moteur/configuration.js:522:21` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, p <= N : le tour de trop lit fixe[N × R + r], undefined, différent de LIBRE ; debutAnimes[NaN] est undefined, la boucle k < undefined ne tourne pas, et l'écriture borne[N] tombe hors du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:870:23` | frontiere | `<` | `<=` | configuration.js, indexerPlan, p <= N dans la recherche d'un non-assis : le tour de trop lit tableDe[N × R + r], undefined, qui n'égale pas NON_PLACE ; rien n'est levé. |
| `src/moteur/criteres.js:266:79` | frontiere | `<` | `<=` | criteres.js, verifierPriorites, ordre d'un palier jugé par rangDe(critere) <= rangDe(précédent) : deux entrées d'un palier de même rang nomment le même critère, et la répétition a déjà rendu critereRepete à la lecture des entrées, avant ce jugement. |
| `src/moteur/criteres.js:290:19` | ternaire-faux | `rang === 0` | `false` | criteres.js, completerPriorites, place du premier critère calculée par palierDe(CRITERES[−1]) + 1 : CRITERES[−1] vaut undefined, aucune entrée de la forme {critere, poids} du contrat, critere une chaîne, ne le porte, palierDe rend −1 et la place vaut 0, comme la branche rang === 0. Ses deux appelants lui passent une liste que verifierPriorites a jugée : lirePriorites (configuration.js) juste avant le complément, priorites(charge) (document.js) une charge dont examinerPriorites a jugé la liste. |
| `src/moteur/criteres.js:302:10` | ternaire-vrai | `criteres.length === 1` | `true` | criteres.js, familleDuPalier, famille du premier critère même pour un palier partagé : la liste compilée est valide, ses critères suivent l'ordre de CRITERES, où les deux raffinements viennent en dernier ; un palier partagé qui n'est pas tout raffinement s'ouvre donc sur un critère d'avant eux, ni l'écart (seul à son palier), ni un raffinement, soit un critère de la famille contrainte, ce que rend la branche d'origine. |
| `src/moteur/criteres.js:344:22` | nombre-plus-un | `1` | `2` | criteres.js, compiler, palierEcart initial −2 au lieu de −1 : la valeur ne se lit que par palierEcart < 0, ou après avoir été remplacée par un rang ≥ 0. |
| `src/moteur/criteres.js:348:21` | ternaire-vrai | `criteres.length === 1` | `true` | criteres.js, compiler, largeur d'un palier partagé prise de composantesDe de son premier critère : un critère d'un palier partagé n'est pas de seulsASonPalier(mode) (verifierPriorites), et hors de ceux-là composantesDe rend une seule grandeur — l'écart (deux) est toujours seul, les tours hors objectif n'en ont plusieurs que sous les modes où ils sont seuls ; la largeur vaut 1 comme dans la branche d'origine. |
| `src/moteur/criteres.js:361:54` | frontiere | `>` | `>=` | criteres.js, compiler, palier raffinement suivant cherché dès i >= palierEcart : le palier de l'écart, où l'écart est seul, est de la famille rencontres, jamais raffinement ; le rang palierEcart n'est jamais rendu. |
| `src/moteur/criteres.js:362:23` | frontiere | `<` | `<=` | criteres.js, compiler, suivant <= 0 au lieu de suivant < 0 : suivant vaut −1 ou un rang strictement supérieur à palierEcart ≥ 0, jamais 0. |
| `src/moteur/criteres.js:362:25` | nombre-plus-un | `0` | `1` | criteres.js, compiler, suivant < 1 au lieu de suivant < 0 : suivant vaut −1 ou un rang strictement supérieur à palierEcart ≥ 0, jamais 0. |
| `src/moteur/diagnostic.js:98:7` | si-faux | `T === 0` | `false` | diagnostic.js, pairesMinimales, if (false) au lieu de if (T === 0) : sans table, membres est un Int32Array vide ; la boucle des libres écrit membres[0], hors des éléments d'un tableau typé, ce qui n'écrit rien, et la somme sur aucune table rend 0, la valeur du retour anticipé. |
| `src/moteur/diagnostic.js:98:16` | corps-si | `return 0;` | `{}` | diagnostic.js, pairesMinimales, if (T === 0) {} : même chemin que le mutant si-faux du même if — sans table, membres[0] += 1 n'écrit rien dans un Int32Array vide et la somme rend 0. |
| `src/moteur/diagnostic.js:102:18` | nombre-zero | `1` | `0` | diagnostic.js, pairesMinimales, boucle de la table la moins remplie partant de t = 0 : le premier tour compare membres[0] < membres[0], toujours faux ; moins ne change pas. |
| `src/moteur/diagnostic.js:102:23` | frontiere | `<` | `<=` | diagnostic.js, pairesMinimales, t <= T dans la recherche de la table la moins remplie : membres[T] est undefined, et undefined < x est faux ; moins ne change pas. |
| `src/moteur/diagnostic.js:102:51` | frontiere | `<` | `<=` | diagnostic.js, pairesMinimales, membres[t] <= membres[moins] : à égalité le libre va à la dernière table la moins remplie au lieu de la première ; ajouter 1 à un minimum ou à un autre donne le même multiensemble de membres par table, et Σ C(x_t, 2) ne lit que ce multiensemble. |
| `src/moteur/diagnostic.js:130:22` | nombre-plus-un | `0` | `1` | diagnostic.js, planchersCollisions, distinctes initialisé à 1 : un groupe n'est écrit que si cumulees > 0, donc qu'un tour au moins a un minimum entier ≥ 1 ; max(1, …) y rend la même valeur que max(0, …), et un groupe à cumulees nul n'est pas écrit. |
| `src/moteur/diagnostic.js:181:21` | frontiere | `<` | `<=` | diagnostic.js, animateursMemeAppartenance, p <= N : statut[N] est undefined, différent de STATUT.ANCRE ; le tour de trop passe par continue. |
| `src/moteur/diagnostic.js:242:109` | frontiere | `<=` | `<` | diagnostic.js, avecTablesManquantes, enAttente avec m < l.effectif : une ligne absente de sansRemede a, à chaque tour, ses membres réservés à des tables distinctes parmi les T existantes ; ses s − k_r libres trouvent une table vide dès que T + m ≥ s, et son plancher tombe à 0 à m = s − T ≤ s − 1 (une ligne suppose T ≥ 1). Aucune ligne n'est donc en attente à m = s, où seules les deux bornes diffèrent. |
| `src/moteur/diagnostic.js:243:25` | min-max | `max` | `min` | diagnostic.js, avecTablesManquantes, tables ajoutées de la plus petite capacité au lieu de la plus grande : normaliser refuse toute capacité < 2, la plus petite présente est donc valide ; planchersCollisions ne lit ni capacite ni idsTables, et les tablesManquantes rendues ne changent pas. |
| `src/moteur/diagnostic.js:244:55` | nombre-plus-un | `1` | `2` | diagnostic.js, avecTablesManquantes, premierId = max + 2 : les identifiants ajoutés restent des entiers ≥ 1 distincts de ceux de la configuration et entre eux ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:247:39` | arithmetique | `-` | `+` | diagnostic.js, avecTablesManquantes, id = premierId + m + 1 : identifiants toujours distincts, entiers et au-delà du plus grand ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:247:41` | nombre-zero | `1` | `0` | diagnostic.js, avecTablesManquantes, id = premierId + m − 0 : identifiants toujours distincts, entiers et au-delà du plus grand ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:247:80` | arithmetique | `+` | `-` | diagnostic.js, avecTablesManquantes, numero = tables.length − m : normaliser ne lit pas le numéro d'une table (seuls id et capacite entrent dans l'instance) ; la sonde rend les mêmes planchers. |
| `src/moteur/diagnostic.js:251:81` | frontiere | `<=` | `<` | diagnostic.js, avecTablesManquantes, affectation sous m < ligne.effectif : même raison que pour enAttente — une ligne absente de sansRemede s'annule à m = s − T ≤ s − 1, avant que la borne ne joue. |
| `src/moteur/diagnostic.js:275:84` | logique | `tour === null \|\| tour === undefined` | `((tour === null )&&( tour === undefined))` | diagnostic.js, surMoinsDeTours, tour === null && tour === undefined : un objectif de soirée à tour null passe encore par avant(null), null <= R′ étant vrai ; seul un objectif à tour absent est retiré de la sonde. La sonde ne sert qu'à redondanceMinimale et plafondsAPriori, qui ne lisent aucun objectif, et retirer un objectif déjà validé ne fait lever aucune règle de normaliser. |
| `src/moteur/diagnostic.js:275:106` | logique | `tour === null \|\| tour === undefined \|\| avant(tour)` | `((tour === null \|\| tour === undefined )&&( avant(tour)))` | diagnostic.js, surMoinsDeTours, (tour nul ou absent) && avant(tour) : la sonde perd ses objectifs d'un tour désigné, et ceux à tour absent ; elle n'en gagne aucun au-delà de R′. redondanceMinimale et plafondsAPriori ne lisent aucun objectif, et en retirer un ne fait lever aucune règle de normaliser. |
| `src/moteur/diagnostic.js:286:22` | arithmetique | `-` | `+` | diagnostic.js, toursSansRedondance, départ à R + 1 : la sonde à R + 1 tours garde toutes les réservations et se normalise sans lever ; le plafond a priori, maximum exact de la formule sur les itinéraires admissibles, ne décroît pas quand un tour s'ajoute (un itinéraire prolongé d'une table ne perd ni ancré ni siège), donc la redondance y reste ≥ sa valeur à R, positive. La sonde à R est la configuration même. Seul le temps change. Un participant réservé tour par tour à la même table sur chacun des R tours, ancré à R, devient partiellement fixé à R + 1 : l'ancré perdu à sa table est compensé, pour qui y passe, par un mobile et au moins un siège de plus (A − 1 + min(n_p + 1, S + m) ≥ A + min(n_p, S)). |
| `src/moteur/diagnostic.js:286:24` | nombre-zero | `1` | `0` | diagnostic.js, toursSansRedondance, départ à R : la sonde à R tours est la configuration elle-même, dont la redondance minimale est positive à ce point ; un chiffrage de plus, aucun résultat changé. |
| `src/moteur/diagnostic.js:311:21` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, p <= N dans le compte des sans appartenance : groupe[N] est undefined, différent de SANS_GROUPE (−1) ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:313:21` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, t <= T : capacite[T] est undefined, N − (places − undefined) vaut NaN, et NaN <= x est faux ; le tour de trop ne rend pas false, et la boucle rend true exactement quand les T tables réelles passent. |
| `src/moteur/diagnostic.js:361:7` | si-faux | `mobile === -1` | `false` | diagnostic.js, ecartItineraire, if (false) au lieu de if (mobile === -1) : sans mobile ni partiellement fixé, tous les présents sont ancrés ; Σ c_t = N et a_t ≤ c_t (SURRESERVATION sinon) forcent a_t = c_t à chaque table, chaque table est sautée par sieges === 0, et siegesToursInferieurs nul rend null, comme le retour anticipé. |
| `src/moteur/diagnostic.js:361:19` | nombre-plus-un | `1` | `2` | diagnostic.js, ecartItineraire, mobile === -2 : indexOf ne rend jamais −2, le retour anticipé disparaît ; même chemin que le mutant si-faux du même if, qui rend null. |
| `src/moteur/diagnostic.js:361:22` | corps-si | `return null;` | `{}` | diagnostic.js, ecartItineraire, if (mobile === -1) {} : même chemin que le mutant si-faux du même if — chaque table pleine d'ancrés est sautée, et la fonction rend null. |
| `src/moteur/diagnostic.js:373:9` | si-vrai | `passant === undefined` | `true` | diagnostic.js, ecartItineraire, mémo parGabarit toujours manqué : plafondPassantPar est déterministe et rend la même valeur pour deux tables de même gabarit ; seule la mémoïsation, donc le temps, change. |
| `src/moteur/diagnostic.js:380:45` | frontiere | `<` | `<=` | diagnostic.js, ecartItineraire, ecartPassant <= plancher : à égalité la même valeur est réécrite dans plancher. |
| `src/moteur/diagnostic.js:403:37` | nombre-plus-un | `0` | `1` | diagnostic.js, objectifsInevitables, parTour rempli de 1 : la boucle des tours écrit parTour[r] pour chaque r de 0 à R − 1 avant toute lecture. |
| `src/moteur/diagnostic.js:407:23` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, r <= R dans le compte des sièges libres : le tour de trop écrit libresAuTour[R], hors des éléments d'un Int32Array de longueur R, ce qui n'écrit rien (la lecture objectifDe[t·R + R] est celle d'une autre table, ou undefined, sans effet). |
| `src/moteur/diagnostic.js:416:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le marquage des personnes : possible[N·R + r] et fixe[N·R + r] sont undefined, donc la branche else écrit servieDOffice[N], hors des éléments d'un Uint8Array de longueur N, ce qui n'écrit rien. |
| `src/moteur/diagnostic.js:420:31` | nombre-plus-un | `1` | `2` | diagnostic.js, objectifsInevitables, servieDOffice[p] = 2 : la marque ne se lit que par servieDOffice[p] === 0. |
| `src/moteur/diagnostic.js:425:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le compte des concernées : aUnTourLibre[N] est undefined, différent de 1 ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:432:23` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le compte par tour : possible[N·R + r] est undefined, différent de 0, et fixe[N·R + r] undefined est différent de LIBRE, donc continue ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:455:16` | frontiere | `<` | `<=` | diagnostic.js, etendue, valeur <= min : à égalité la même valeur est réécrite dans min. |
| `src/moteur/diagnostic.js:456:16` | frontiere | `>` | `>=` | diagnostic.js, etendue, valeur >= max : à égalité la même valeur est réécrite dans max. |
| `src/moteur/diversite.js:77:45` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, debutAssis de T × R + 2 cases au lieu de T × R + 1 : la case de trop n'est jamais écrite ni lue ; les lectures s'arrêtent à debutAssis[T × R] (cumul jusqu'à ligne < T × R, taille de assis, ligne + 1 ≤ T × R au parcours). |
| `src/moteur/diversite.js:78:21` | frontiere | `<` | `<=` | diversite.js, diversiteAnimateurs, comptage des assis jusqu'à i <= N × R : exigerPlanIndexe impose tableDe.length === N × R, donc tableDe[N × R] vaut undefined, et l'écriture se fait à l'index NaN d'un tableau typé, qui n'écrit rien. |
| `src/moteur/diversite.js:79:9` | si-vrai | `tableDe[i] !== RESERVE` | `true` | diversite.js, diversiteAnimateurs, comptage des assis sans exclure RESERVE (−1) : la case réservée vise l'index −R + r + 1, négatif, sans effet sur un tableau typé, sauf au dernier tour où il vaut 0 ; debutAssis[0] grossit alors de c, et le cumul décale de c tous les débuts, la taille de assis et rempli, si bien que chaque ligne garde ses mêmes assis, à c cases plus loin ; les c premières cases de assis ne se lisent jamais. |
| `src/moteur/diversite.js:81:20` | nombre-plus-un | `0` | `1` | diversite.js, diversiteAnimateurs, cumul des débuts à partir de ligne = 1 : le pas sauté ajoute debutAssis[0] à debutAssis[1], et debutAssis[0] vaut toujours 0, aucun index de table ne donnant la case 0 au comptage (tableDe[i] × R + r + 1 ≥ 1). |
| `src/moteur/diversite.js:81:29` | frontiere | `<` | `<=` | diversite.js, diversiteAnimateurs, cumul des débuts jusqu'à ligne <= T × R : le pas de trop écrit debutAssis[T × R + 1], hors des éléments du tableau typé, ce qui n'écrit rien. |
| `src/moteur/diversite.js:84:16` | nombre-plus-un | `0` | `1` | diversite.js, diversiteAnimateurs, remplissage des assis à partir de i = 1 : seule la case 0 (participant 0, premier tour) est sautée ; s'il est assis, il est le plus petit index de sa ligne, les autres remplissent les cases qui suivent son début d'un cran plus tôt, et la dernière case de la ligne, jamais écrite, garde le 0 du tableau neuf, soit lui-même. La ligne garde les mêmes assis dans un autre ordre, et chaque compte (personnes, appartenances, étiquettes, par marques) ne dépend pas de l'ordre de parcours. |
| `src/moteur/diversite.js:84:21` | frontiere | `<` | `<=` | diversite.js, diversiteAnimateurs, remplissage des assis jusqu'à i <= N × R : tableDe[N × R] vaut undefined (longueur exigée par exigerPlanIndexe), la ligne vaut NaN, rempli[NaN] vaut undefined ; l'écriture assis[undefined] pose une propriété nommée « undefined » que rien ne lit, et rempli[NaN] += 1 n'écrit rien. |
| `src/moteur/diversite.js:85:9` | si-faux | `tableDe[i] === RESERVE` | `false` | diversite.js, diversiteAnimateurs, remplissage des assis sans sauter RESERVE (−1) : la ligne vaut −R + r, toujours négative ; rempli[ligne] vaut undefined, assis[undefined] pose une propriété que rien ne lit, et rempli[ligne] += 1 n'écrit rien sur un tableau typé. |
| `src/moteur/diversite.js:85:33` | corps-si | `continue;` | `{}` | diversite.js, diversiteAnimateurs, if (tableDe[i] === RESERVE) {} au remplissage : même effet que l'absence du saut, une ligne négative dont les écritures ne touchent aucun élément lu. |
| `src/moteur/diversite.js:95:23` | frontiere | `<` | `<=` | diversite.js, diversiteAnimateurs, tours animés jusqu'à t <= T : la ligne T × R + r dépasse les lignes de debutAnimes (T × R + 1 cases, configuration.js) ; au tour 0, debutAnimes[T × R + 1] vaut undefined, aux autres les deux bornes aussi, et k < undefined est faux : la boucle n'ajoute rien. |
| `src/moteur/diversite.js:104:47` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, personneVue remplie de −2 au lieu de −1 : la marque ne se compare qu'au rang f de l'animateur, toujours ≥ 0 ; toute valeur négative la dit libre. |
| `src/moteur/diversite.js:105:57` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, groupeVu rempli de −2 au lieu de −1 : la marque ne se compare qu'au rang f, toujours ≥ 0. |
| `src/moteur/diversite.js:106:63` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, groupeVuAuTour rempli de −2 au lieu de −1 : la marque ne se compare qu'au jeton, augmenté avant chaque tour et donc ≥ 0 à toute comparaison. |
| `src/moteur/diversite.js:107:72` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, etiquetteVue remplie de −2 au lieu de −1 : la marque ne se compare qu'au rang f, toujours ≥ 0. |
| `src/moteur/diversite.js:108:78` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, etiquetteVueAuTour remplie de −2 au lieu de −1 : la marque ne se compare qu'au jeton, ≥ 0 à toute comparaison. |
| `src/moteur/diversite.js:109:16` | nombre-zero | `1` | `0` | diversite.js, diversiteAnimateurs, jeton initial −0 au lieu de −1 : le premier tour lit le jeton 1 au lieu de 0, chaque tour garde un jeton distinct des autres et des marques initiales (−1) ; seule l'égalité au jeton se lit. |
| `src/moteur/diversite.js:117:13` | mise-a-jour | `+=` | `-=` | diversite.js, diversiteAnimateurs, jeton -= 1 au lieu de += 1 : les jetons valent −2, −3, … ; chacun reste distinct des autres et des marques initiales (−1), et seule l'égalité au jeton se lit. |
| `src/moteur/diversite.js:117:16` | nombre-plus-un | `1` | `2` | diversite.js, diversiteAnimateurs, jeton += 2 au lieu de += 1 : les jetons 1, 3, 5, … restent distincts tour à tour et des marques initiales (−1) ; seule l'égalité au jeton se lit. |
| `src/moteur/diversite.js:167:105` | arithmetique | `-` | `+` | diversite.js, diversiteAnimateurs, tri à égalité des comptes par a.p + b.p au lieu de a.p − b.p : deux lignes distinctes égales sur tous les comptes rendent un positif dans les deux sens, comparateur incohérent dont ECMAScript laisse l'ordre à l'implémentation. Le tri de V8, celui de Node et d'Electron, ne déplace un élément que sur un résultat négatif et garde, stable, l'ordre où les lignes sont poussées : f croissant, donc p croissant, les animateurs étant rangés par index croissants (deriverAnimateurs, configuration.js). Seule une ligne comparée à elle-même, p = 0, rend 0. |
| `src/moteur/indicateurs.js:189:45` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, rencontre rempli de −2 au lieu de −1 : la marque ne se lit que par rencontre[f] === p, p ≥ 0 ; ni −1 ni −2 n'égale une personne. |
| `src/moteur/indicateurs.js:219:21` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, visites[t] += 2 au lieu de 1 : visites[t] ne se lit que par visites[t] > 0 et se remet à 0 après chaque personne ; un pas de 2 garde le signe, aucune sortie ne change. |
| `src/moteur/indicateurs.js:220:40` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, reserveeAvant[t] = 2 au lieu de 1 : la marque ne se lit que par reserveeAvant[t] === 0. |
| `src/moteur/indicateurs.js:222:23` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, remise à zéro jusqu'à r <= R : le tour de trop lit la première case de la personne suivante, dont la table vaut 0 dans visites et reserveeAvant sauf si la personne courante l'a visitée, auquel cas la boucle la remet à 0 de toute façon ; pour la dernière personne la case est undefined, et une écriture à l'index undefined pose une propriété hors des éléments du tableau typé, que rien ne lit. |
| `src/moteur/indicateurs.js:224:11` | si-faux | `t === RESERVE` | `false` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:224:26` | corps-si | `continue;` | `{}` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:253:25` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, i <= liste.length : le tour de trop lit a = undefined ; revenu[NaN] et fixe[NaN] sont undefined, rien n'est poussé, et la boucle intérieure part de j = length + 1, au-delà de la liste. |
| `src/moteur/indicateurs.js:258:31` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, j <= liste.length : le tour de trop lit b = undefined ; k = rangPaire(N, a, undefined) vaut NaN, parPaire[NaN] et libre[NaN] n'écrivent rien sur un tableau typé, groupe[undefined] n'égale aucun groupe et parPaire[NaN] >= 2 est faux : ni collègue ni revue n'est poussé. |
| `src/moteur/indicateurs.js:310:23` | nombre-plus-un | `1` | `2` | indicateurs.js, lirePaires, vu[p * G + g] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:315:21` | frontiere | `<` | `<=` | indicateurs.js, lirePaires, i <= reunies.length : reunies a une longueur paire, le tour de trop lit a = b = undefined. rencontres[undefined] et affilies[undefined] posent une propriété « undefined » sur l'Int32Array, que Array.from (mesurer) ne lit pas ; groupe[undefined] n'égale pas SANS_GROUPE, mais vu[NaN] se lit undefined, jamais === 0 ; n = parPaire[NaN] est undefined, ni > maxRencontresPaire ni >= 2. |
| `src/moteur/indicateurs.js:321:11` | frontiere | `>` | `>=` | indicateurs.js, lirePaires, n >= maxRencontresPaire : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/indicateurs.js:333:32` | arithmetique | `-` | `+` | indicateurs.js, lireTours, nombrePaires = N(N + 1)/2 : ne dimensionne que collegueVu et revueVue, indexés par rangPaire, toujours < N(N − 1)/2 ; un tableau plus long garde les mêmes cases utiles, les autres ne se lisent jamais. |
| `src/moteur/indicateurs.js:333:34` | nombre-zero | `1` | `0` | indicateurs.js, lireTours, nombrePaires = N·N/2 : même raison que N(N + 1)/2 — une longueur au moins égale (tronquée à l'entier par le constructeur du tableau typé) pour des index rangPaire < N(N − 1)/2. |
| `src/moteur/indicateurs.js:333:38` | arithmetique | `/` | `*` | indicateurs.js, lireTours, nombrePaires = 2N(N − 1) : longueur au moins égale à N(N − 1)/2, mêmes cases utiles, les autres jamais lues. |
| `src/moteur/indicateurs.js:347:27` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, collegueVu[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:354:25` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, revueVue[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:366:48` | nombre-plus-un | `0` | `1` | indicateurs.js, VIDE.somme = 1 : la somme de VIDE ne se lit jamais. ajouter ouvre un cumul neuf sans la lire, et conclure ne la lit que pour un effectif non nul ; VIDE a un effectif nul et rend moyenne null. |
| `src/moteur/indicateurs.js:373:14` | frontiere | `<` | `<=` | indicateurs.js, ajouter, valeur <= min : à égalité, le minimum retenu est la même valeur ; aucune valeur agrégée ne vaut −0 (comptes entiers, différences de comptes, quotient A/\|F\| à \|F\| > 0). |
| `src/moteur/indicateurs.js:406:21` | frontiere | `<` | `<=` | indicateurs.js, mesurer, p <= N au compte des effectifs : groupe[N] est undefined, différent de SANS_GROUPE ; effectifs[undefined] += 1 pose une propriété « undefined » sur un tableau ordinaire, et parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:414:15` | nombre-plus-un | `0` | `1` | indicateurs.js, lireObjectifs, auMax part de 1 : quand E reste à 0, personnesAuMax vaut 0 quelle que soit la valeur ; sinon E a grandi au moins une fois, chaque croissance remet auMax à 0, et seuls comptent les incréments qui suivent la dernière : la valeur initiale ne survit jamais. |
| `src/moteur/indicateurs.js:449:21` | frontiere | `<` | `<=` | indicateurs.js, lireAnimateurs, p <= N au compte des concernés : borneAnimateurs[N] est undefined, et undefined > 0 est faux ; concernes ne bouge pas. |
| `src/moteur/indicateurs.js:495:21` | frontiere | `<` | `<=` | indicateurs.js, mesurer, p <= N au compte des effectifs : groupe[N] est undefined, différent de SANS_GROUPE ; effectifs[undefined] += 1 pose une propriété « undefined » sur un tableau ordinaire, et parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:496:9` | si-vrai | `groupe[p] !== SANS_GROUPE` | `true` | indicateurs.js, mesurer, if (true) au compte des effectifs : une personne sans appartenance incrémente effectifs[SANS_GROUPE], soit effectifs[−1], propriété hors des index d'un tableau ordinaire ; parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/manque.js:91:64` | frontiere | `>` | `>=` | manque.js, plusGrand, valeur >= cumul : à égalité, le cumul retenu est la même valeur. |
| `src/moteur/manque.js:231:82` | arithmetique | `-` | `+` | manque.js, profilManque, départage a.id + b.id : à manque et plafond réalisé égaux, le comparateur rend un nombre positif. Le tri de V8 ne lit que « < 0 » et est stable : un positif s'y lit comme 0, et l'ordre reçu reste, celui de instance.ids, que normaliser trie par identifiant croissant et sans doublon — l'ordre de a.id − b.id. Une liste reçue dans un autre ordre ne peut pas se construire : profilManque parcourt instance.ids. |
| `src/moteur/manque.js:313:34` | frontiere | `<` | `<=` | manque.js, comparerProfils, difference <= 0 : la ligne ne s'atteint que pour difference !== 0, où <= 0 et < 0 coïncident. |
| `src/moteur/manque.js:313:36` | nombre-plus-un | `0` | `1` | manque.js, comparerProfils, difference < 1 : un manque est un entier (plafond réalisé − rencontres, deux comptes), et la ligne ne s'atteint que pour difference !== 0 : < 1 et < 0 coïncident. |
| `src/moteur/manque.js:313:41` | nombre-plus-un | `1` | `2` | manque.js, comparerProfils, signeRang = −2 au lieu de −1 : signeRang ne se lit que par < 0 et par comparaison à signe, qui reçoit les mêmes valeurs ; signe ne se rend pas. |
| `src/moteur/manque.js:313:45` | nombre-plus-un | `1` | `2` | manque.js, comparerProfils, signeRang = 2 au lieu de 1 : signeRang ne se lit que par < 0 et par comparaison à signe, qui reçoit les mêmes valeurs ; signe ne se rend pas. |
| `src/moteur/manque.js:314:19` | frontiere | `<` | `<=` | manque.js, comparerProfils, signeRang <= 0 : signeRang vaut −1 ou 1, jamais 0. |
| `src/moteur/manque.js:314:21` | nombre-plus-un | `0` | `1` | manque.js, comparerProfils, signeRang < 1 : signeRang vaut −1 ou 1 ; < 1 et < 0 coïncident. |
| `src/moteur/manque.js:318:11` | si-vrai | `changements === 1` | `true` | manque.js, comparerProfils, bascule posée à chaque changement : rangBascule ne la rend que pour changements === 1, où la première et la dernière affectation sont la même. |
| `src/moteur/manque.js:340:66` | frontiere | `>` | `>=` | manque.js, plusGrandManque, manque >= plus au lieu de > : à égalité, la valeur retenue est la même. Pour des manques numériques (RangProfil), seul −0 contre 0 peut changer le signe du zéro rendu, et les deux appelants le passent par Math.max avec 0 (escalierDuManque) ou 1 (borneHaute), qui rend le même nombre ; null et NaN sont hors du type des manques. |
| `src/moteur/manque.js:350:38` | nombre-plus-un | `1` | `2` | manque.js, effectifsParValeur, haut + 2 cases : une case de plus au-delà de haut, à 0, jamais écrite (chaque manque vaut au plus haut, le plus grand manque des deux profils) ni lue (escalierDuManque parcourt les valeurs de haut à 0). |
| `src/moteur/manque.js:434:56` | nombre-zero | `1` | `0` | manque.js, borneHaute, plusGrandManque(…) ?? 0 : la valeur de repli ne sert que pour deux profils vides, où Math.max(0, 1) et Math.max(1, 1) valent tous deux 1. |
| `src/moteur/paires.js:53:50` | frontiere | `<` | `<=` | paires.js, compte, a <= b au lieu de a < b : le choix de branche ne change qu'à a = b, où les deux branches calculent rangPaire(N, a, a) ; la valeur lue est la même pour toute entrée. |
| `src/moteur/paires.js:153:21` | frontiere | `<` | `<=` | paires.js, matriceRencontres, boucle extérieure jusqu'à i <= n : au tour de trop, i = n, la boucle intérieure part de j = n + 1 et ne s'exécute pas ; rien n'est écrit. |
| `src/moteur/plafond.js:74:18` | nombre-plus-un | `0` | `1` | plafond.js, affiliesDe, effectif part de 1 : N_aff grandit de 1, et il ne se lit qu'à deux places où un terme plus grand ne mord pas. Dans borne, le terme Σ a^aff_t + min(n^aff_p, S) vaut au plus N_aff − ε_p : un affilié ancré voit au plus k_aff − 1 ancrés affiliés sur ses tables distinctes et n^aff_p = n_aff ; un affilié mobile au plus k_aff, avec n^aff_p = n_aff − 1 ; un non-affilié au plus k_aff, avec n^aff_p = n_aff ; et N_aff = k_aff + n_aff, chaque membre étant ancré ou mobile. Dans borneDiversite, le troisième terme N_aff − g_p + 1 ne descend jamais sous G (chaque appartenance de instance.groupes compte au moins un présent, numeroterGroupes) : plus grand, il ne mord pas davantage. Φ_aff et A_max restent. |
| `src/moteur/plafond.js:79:17` | nombre-plus-un | `1` | `2` | plafond.js, affiliesDe, effectif += 2 : N_aff devient 2·N_aff ≥ N_aff ; même raison que effectif partant de 1 — le premier terme de borne et le troisième terme de A_max ne mordent pas davantage en grandissant. |
| `src/moteur/plafond.js:94:39` | arithmetique | `-` | `+` | plafond.js, borne, min(effectif + ε, …) : le premier terme grandit ou reste, et le terme intérieur ne l'atteint déjà jamais. Pour tout le monde, il vaut au plus N − 1 : sur ses tables distinctes, un ancré voit au plus k − 1 ancrés, p exclu, avec n_p = n ; un mobile ou un partiel au plus k, avec n_p = n − 1 ; et n = N − k (configuration.js). Pour les affiliés, il vaut au plus N_aff − ε_p, par le même compte restreint aux affiliés (voir effectif partant de 1 dans affiliesDe). Le min extérieur ne mord jamais. |
| `src/moteur/plafond.js:104:74` | nombre-plus-un | `1` | `2` | plafond.js, ancrageDe, −2 au lieu de −1 pour un non-ancré : l'ancrage ne sert qu'à t === ancrage, où t est un index de table ≥ 0, et à la clé de signature, où −2 remplace −1 pour tous les non-ancrés à la fois : aucune comparaison ni aucun regroupement ne change. |
| `src/moteur/plafond.js:115:21` | frontiere | `<` | `<=` | plafond.js, tablesAdmissibles, t <= T : ancresParTable[T] et capacite[T] sont undefined, undefined < undefined est faux, rien ne s'ajoute. |
| `src/moteur/plafond.js:270:16` | nombre-plus-un | `0` | `1` | plafond.js, borneDiversite, compte des effectifs à partir de p = 1 : effectifs ne se lit que dans le troisième terme de A_max, N_aff − effectifs[g] + 1. Toute mutation qui ne fait que diminuer effectifs[g] laisse ce terme au moins égal à N_aff − g_p + 1, qui ne descend jamais sous G (chaque appartenance de instance.groupes compte au moins un présent) : min(Φ_aff, G, terme) vaut min(Φ_aff, G) avant comme après. Sauter la personne 0 diminue un effectif. |
| `src/moteur/plafond.js:270:31` | nombre-plus-un | `1` | `2` | plafond.js, borneDiversite, compte des effectifs par pas de 2 : une personne sur deux est sautée, les effectifs ne font que diminuer ; même raison que le compte à partir de p = 1 — le troisième terme reste au moins N_aff − g_p + 1 ≥ G. |
| `src/moteur/plafond.js:270:38` | si-vrai | `groupe[p] !== SANS_GROUPE` | `true` | plafond.js, borneDiversite, if (true) au compte des effectifs : une personne sans appartenance incrémente effectifs[SANS_GROUPE], soit effectifs[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/plafond.js:270:38` | si-faux | `groupe[p] !== SANS_GROUPE` | `false` | plafond.js, borneDiversite, if (false) au compte des effectifs : tous les effectifs restent à 0, le troisième terme vaut N_aff + 1 ≥ N_aff − g_p + 1 ≥ G ; même raison que le compte à partir de p = 1. |
| `src/moteur/plafond.js:270:48` | negation | `!==` | `===` | plafond.js, borneDiversite, groupe[p] === SANS_GROUPE au compte des effectifs : seules les personnes sans appartenance entrent, à effectifs[−1], qu'un tableau typé n'écrit pas ; les effectifs restent à 0, et le troisième terme, N_aff + 1, ne mord pas (voir if (false)). |
| `src/moteur/plafond.js:270:65` | corps-si | `effectifs[groupe[p]] += 1;` | `{}` | plafond.js, borneDiversite, corps du compte des effectifs vidé : les effectifs restent à 0 ; même raison que if (false). |
| `src/moteur/plafond.js:270:86` | mise-a-jour | `+=` | `-=` | plafond.js, borneDiversite, effectifs[g] −= 1 : chaque effectif devient −g_p, et le troisième terme N_aff + g_p + 1 dépasse N_aff − g_p + 1 ≥ G ; même raison que le compte à partir de p = 1. |
| `src/moteur/plafond.js:270:89` | nombre-zero | `1` | `0` | plafond.js, borneDiversite, effectifs[g] += 0 : les effectifs restent à 0 ; même raison que if (false). |
| `src/moteur/plafond.js:277:15` | ternaire-vrai | `g === SANS_GROUPE` | `true` | plafond.js, borneDiversite, A_max = min(Φ_aff, G) pour chacun : pour un affilié, le troisième terme N_aff − g_p + 1 vaut au moins G, puisque chaque autre appartenance compte au moins un présent (N_aff − g_p ≥ G − 1) ; min(Φ_aff, G, terme) = min(Φ_aff, G). Le terme s'écrit pour que le code se lise contre la formule du § 5.5, comme le dit le commentaire de la fonction. |
| `src/moteur/plafond.js:277:91` | arithmetique | `-` | `+` | plafond.js, borneDiversite, troisième terme N_aff + g_p + 1 : il dépasse N_aff − g_p + 1, qui vaut déjà au moins G ; le min reste min(Φ_aff, G) (voir A_max = min(Φ_aff, G) pour chacun). |
| `src/moteur/plafond.js:277:108` | nombre-plus-un | `1` | `2` | plafond.js, borneDiversite, troisième terme N_aff − g_p + 2 : plus grand d'un que N_aff − g_p + 1, qui vaut déjà au moins G ; le min reste min(Φ_aff, G). |
| `src/moteur/plafond.js:289:38` | si-vrai | `fixe[p * R + r] !== LIBRE` | `true` | plafond.js, signature, chaque case poussée, LIBRE comprise : le nombre de cases LIBRE vaut R moins le nombre de tours fixés, que le multiensemble des tables fixées donne déjà ; deux clés sont égales sous le mutant si et seulement si elles le sont sans lui. |
| `src/moteur/plafond.js:290:27` | arithmetique | `-` | `+` | plafond.js, signature, tri par x + y : le tri ne sert qu'à rendre la clé indépendante de l'ordre des tours. Un ordre faux peut séparer deux rangées de même multiensemble en deux clés, jamais réunir deux multiensembles distincts — la clé garde ses éléments — : la valeur mémoïsée reste exacte, seul le partage se perd. |
| `src/moteur/plafond.js:330:69` | nombre-zero | `1` | `0` | plafond.js, maximiser, borne(population, 0, …) sans tour libre ou sans table admissible : ε ne sert qu'au premier terme, qui devient N au lieu de N − 1. Le terme intérieur vaut au plus N − 1 : ancres0 somme les ancrés vus sur des tables distinctes, au plus k − 1 pour un ancré et k sinon, et n_p vaut n pour un ancré, n − 1 sinon, avec n = N − k. Le min extérieur ne mord jamais. |
| `src/moteur/plafond.js:334:14` | nombre-plus-un | `0` | `1` | plafond.js, maximiser, vMax part de 1 : vMax ne sert qu'à W, qui grandit ou reste. Tout W' ≥ W rend le même plafond : sans écrêtage (W' ≥ f·vMax) la programmation dynamique est exacte, et un écrêtage à W' ≥ cap ne fond que des états où min(n_p, sieges0 + w) vaut déjà n_p. |
| `src/moteur/plafond.js:336:18` | min-max | `min` | `max` | plafond.js, maximiser, W = max(cap, f·vMax) : W grandit ou reste ; même raison que vMax partant de 1 — tout W' ≥ W rend le même plafond. |
| `src/moteur/plafond.js:336:31` | nombre-plus-un | `0` | `1` | plafond.js, maximiser, cap = max(1, n_p − sieges0) : W grandit ou reste ; tout W' ≥ W rend le même plafond (voir vMax partant de 1). |
| `src/moteur/plafond.js:336:37` | arithmetique | `-` | `+` | plafond.js, maximiser, cap = max(0, n_p + sieges0) : sieges0 ≥ 0 (v ≥ 0 pour toute table qu'un plan valide fixe), donc W grandit ou reste ; tout W' ≥ W rend le même plafond (voir vMax partant de 1). |
| `src/moteur/plafond.js:337:23` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, largeur = W + 2 : une colonne de plus par rangée, jamais écrite (cible ≤ W) ni lue (w ≤ W) ; chaque état garde une case distincte. |
| `src/moteur/plafond.js:338:38` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, (f + 2) × largeur cases : une rangée de plus en fin de tableau, jamais lue ni écrite (s + m ≤ f). |
| `src/moteur/plafond.js:338:58` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, fill(−2) : le marqueur d'état inatteignable ne se lit que par < 0 et >= 0, et tout atteint + gain ≥ 0 le dépasse ; −2 se comporte comme −1. |
| `src/moteur/plafond.js:344:23` | frontiere | `<` | `<=` | plafond.js, maximiser, s <= f : à s = f, la boucle sur m (s + m ≤ f) ne tourne pas. |
| `src/moteur/plafond.js:350:30` | frontiere | `>` | `>=` | plafond.js, maximiser, atteint + gain >= suivant[cible] : à égalité, l'affectation écrit la valeur déjà présente. |
| `src/moteur/plafond.js:356:18` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, plafond part de −2 : l'état (f, W) est toujours atteint — la table de plus grand v prise f fois — avec une somme d'ancrés ≥ 0, et sa borne vaut au moins 0 ; le maximum ne dépend pas de la valeur initiale, pourvu qu'elle ne dépasse pas 0. |
| `src/moteur/plafond.js:356:18` | nombre-zero | `1` | `0` | plafond.js, maximiser, plafond part de −0 : même raison que −2 — un état atteint donne une borne x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:359:9` | si-vrai | `ajout >= 0` | `true` | plafond.js, maximiser, if (true) sur ajout >= 0 : un état inatteignable porte −1, soit ancres0 − 1, à un w ≤ W ; l'état (f, W) est atteint avec une somme ≥ 0, et la borne, croissante en ses deux termes, y vaut au moins autant : un état inatteignable ne l'emporte jamais. |
| `src/moteur/plafond.js:359:67` | nombre-zero | `1` | `0` | plafond.js, maximiser, borne(population, 0, …) à chaque état final : premier terme N au lieu de N − 1. Chaque table admissible s'ajoute au plus une fois à la somme d'ancrés, et seulement hors de D₀ : ancres0 + ajout reste une somme sur des tables distinctes, et le terme intérieur vaut au plus N − 1 par le même compte que sans tour libre (borne(population, 0, …) de la sortie anticipée). Le min extérieur ne mord jamais. |
| `src/moteur/plafond.js:410:21` | frontiere | `<` | `<=` | plafond.js, enumerer, r <= R : itineraire[R] est undefined, qui n'égale pas LIBRE ; aucun tour libre ne s'ajoute. |
| `src/moteur/plafond.js:427:18` | nombre-plus-un | `1` | `2` | plafond.js, enumerer, plafond part de −2 : au moins un itinéraire s'évalue (f > 0 et A > 0), et son plafond est ≥ 0 ; la valeur initiale ne l'emporte jamais. |
| `src/moteur/plafond.js:427:18` | nombre-zero | `1` | `0` | plafond.js, enumerer, plafond part de −0 : au moins un itinéraire s'évalue, de plafond x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:429:23` | frontiere | `<` | `<=` | plafond.js, enumerer, i <= f : libres[f] est undefined ; itineraire[undefined] = … pose une propriété hors des index de l'Int32Array, que plafondItineraire ne lit pas (il lit length et les index 0 à R − 1). |
| `src/moteur/plafond.js:435:22` | nombre-zero | `1` | `0` | plafond.js, enumerer, j = i + 0 : le premier tour écrit choix[i] = choix[i], sans effet ; les tours suivants sont ceux du code. |
| `src/moteur/plafond.js:435:27` | frontiere | `<` | `<=` | plafond.js, enumerer, j <= f : choix[f] est hors d'un Int32Array de f cases ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/plafond.js:461:33` | arithmetique | `*` | `/` | plafond.js, plafondsAPrioriParEnumeration, clé subarray(p / R, …) : l'index de début se tronque, et la clé devient une tranche qui finit par la rangée de p. Pour R ≥ 2 sa longueur, (p + 1)R − ⌊p/R⌋, croît strictement avec p : aucune clé n'est partagée (deux jointures de longueurs différentes n'ont pas le même nombre de virgules), chaque plafond se calcule sur la rangée de p et reste exact ; la première personne dont l'énumération dépasse la limite reste la même, une rangée déjà vue n'ayant pas levé. Pour R = 1, la tranche est la rangée même. |
| `src/moteur/plafond.js:461:43` | nombre-plus-un | `1` | `2` | plafond.js, plafondsAPrioriParEnumeration, clé subarray(pR, (p + 2)R) : la clé ajoute la rangée suivante (rien pour la dernière personne, dont la clé a R cases contre 2R) ; deux clés égales ont même longueur et même début, donc même rangée : le regroupement se fait plus fin, jamais plus large. |
| `src/moteur/plafond.js:463:9` | si-vrai | `plafond === undefined` | `true` | plafond.js, plafondsAPrioriParEnumeration, if (true) : le plafond se recalcule pour chaque personne au lieu d'être repris de sa rangée ; même valeur, seule la mémoïsation de l'oracle se perd, et l'oracle n'a pas de budget de temps. |
| `src/moteur/qualite.js:175:57` | nombre-plus-un | `0` | `1` | qualite.js, repartition, cumul: 1 au lieu de 0 à la création d'une ligne : la seconde boucle affecte ligne.cumul à chaque ligne avant le retour, et la clé cumul garde sa place dans l'objet ; la valeur initiale ne se lit jamais. |
| `src/moteur/qualite.js:540:40` | nombre-plus-un | `1` | `2` | qualite.js, barresCollisions, comparer rend -2 au lieu de -1 : la valeur ne se lit que par \|\| (non nulle dans les deux cas) et par le tri, qui n'en retient que le signe. |
| `src/moteur/qualite.js:540:52` | nombre-plus-un | `1` | `2` | qualite.js, barresCollisions, comparer rend 2 au lieu de 1 : la valeur ne se lit que par \|\| (non nulle dans les deux cas) et par le tri, qui n'en retient que le signe. |
| `src/moteur/qualite.js:583:38` | nombre-plus-un | `1` | `2` | qualite.js, mixTables, vu rempli de -2 au lieu de -1 : vu[b] ne se lit que par vu[b] === jeton, et jeton = t · R + r vaut 0 au moins ; ni -1 ni -2 ne l'égale. |
| `src/moteur/qualite.js:670:19` | nombre-plus-un | `0` | `1` | qualite.js, objectifsParTour, pireReste initialisé à 1 au lieu de 0 : pireReste ne se lit que dans pireTour === null \|\| reste > pireReste ; au premier tour lu pireTour vaut null, le \|\| ne lit pas pireReste, et la même branche l'affecte à reste. |
| `src/moteur/recherche.js:244:18` | nombre-plus-un | `1` | `2` | recherche.js, FANTOME = −2 au lieu de −1 : la place fantôme est une sentinelle des sièges, écrite par preparer (siegesFixes) et comparée par === ou !== à elle-même seule (preparer, voisiner, echanger, etatInitial, remplisseur, mouvoirDans) ; une personne vaut un index ≥ 0, et aucune case de siège n'est comparée à LIBRE, RESERVE ni utilisée comme index : toute valeur négative tient le même rôle. |
| `src/moteur/recherche.js:255:20` | nombre-plus-un | `0xffff` | `65536` | recherche.js, UINT16_MAX = 65 536 : seul R = 65 536 change de tableau, et un Uint16Array y reste exact. Le compte d'une paire va de 0 à R ; modifierPaire ne le lit que par avant !== 0 à un ajout et apres !== 0 à un retrait. Un compte vrai de 65 536 se range 0, mais un ajout depuis 65 536 ou un retrait depuis 65 537 exigent R ≥ 65 537 : le compte rangé modulo 2^16 donne toujours la même décision. |
| `src/moteur/recherche.js:255:20` | nombre-zero | `0xffff` | `0` | recherche.js, UINT16_MAX = 0 : R ≥ 1 donne toujours un Uint32Array à paires, qui tient tout compte de 0 à R ; mêmes valeurs lues, seule la mémoire double. paires n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:258:19` | nombre-plus-un | `0xff` | `256` | recherche.js, UINT8_MAX = 256 : seul R = 256 change de tableau, et un Uint8Array y reste exact. Le compte d'un couple (personne, animateur) va de 0 au nombre de tours où l'animateur anime, ≤ R ; changerAnimateurs ne le lit que par avant === 0 à un ajout et avant === 1 à un retrait. Confondre 256 avec 0, ou 257 avec 1, exige un ajout depuis 256 ou un retrait depuis 257, donc R ≥ 257. |
| `src/moteur/recherche.js:258:19` | nombre-zero | `0xff` | `0` | recherche.js, UINT8_MAX = 0 : R ≥ 1 donne toujours un Uint32Array à rencontresAnimees, qui tient tout compte de 0 à R ; mêmes valeurs, seule la largeur des éléments change, que rien ne lit. |
| `src/moteur/recherche.js:273:20` | nombre-plus-un | `11` | `12` | recherche.js, REDONDANCE = 12 au lieu de 11 : le code n'est lu que par lire, où Σ r(p) est la branche default du switch ; 12, distinct des onze autres codes, y tombe comme 11, et ANIMATEURS (10) n'est comparé qu'à lui-même. |
| `src/moteur/recherche.js:396:36` | nombre-plus-un | `1` | `2` | recherche.js, preparer, debut de longueur T + 2 : la boucle ne remplit que debut[0..T], la case T + 1 reste 0 ; preparer, voisiner, remplisseur et etatInitial ne lisent debut[t + 1] que pour t < T. debut n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:397:21` | frontiere | `<` | `<=` | recherche.js, preparer, t <= T au calcul de debut : le tour de trop écrit debut[T + 1] = debut[T] + capacite[T], soit NaN à un index hors d'un Int32Array de longueur T + 1, qui n'écrit rien. |
| `src/moteur/recherche.js:400:16` | nombre-plus-un | `0` | `1` | recherche.js, preparer, tableDuSiege rempli à partir de t = 1 : les sièges de la table 0 gardent la valeur initiale d'un Int32Array neuf, 0, l'index de leur table. |
| `src/moteur/recherche.js:400:21` | frontiere | `<` | `<=` | recherche.js, preparer, t <= T au remplissage de tableDuSiege : le tour de trop fait fill(T, debut[T], undefined), soit de S à la fin d'un tableau de longueur S : aucune case. |
| `src/moteur/recherche.js:400:75` | nombre-plus-un | `1` | `2` | recherche.js, preparer, fill(t, debut[t], debut[t + 2]) : la table t déborde sur les sièges de t + 1, que l'itération suivante récrit à t + 1 ; au dernier tour, debut[T + 1] est undefined et fill va jusqu'à la fin, qui est debut[T] : mêmes cases finales. |
| `src/moteur/recherche.js:410:21` | frontiere | `<` | `<=` | recherche.js, preparer, r <= R : au tour de trop, fixe[p × R + R] lit la case du tour 0 de la personne suivante (undefined pour la dernière) ; une personne fixée y écrit siegesFixes et mobiles à des index ≥ R × S, hors des tableaux typés, qui n'écrivent rien, occupes est remis à zéro en tête de chaque tour, nombreMobiles[R] est hors du tableau, et libres reçoit une R + 1e liste que etatInitial et remplisseur ne lisent pas (r < R). |
| `src/moteur/recherche.js:413:23` | frontiere | `<` | `<=` | recherche.js, preparer, p <= N aux sièges fixés : fixe[N × R + r] est undefined, différent de LIBRE ; siegesFixes[r × S + debut[undefined] + occupes[undefined]] est un index NaN, qui n'écrit rien dans un tableau typé, et occupes[undefined] += 1 pose une propriété « undefined » que rien ne lit. |
| `src/moteur/recherche.js:437:21` | frontiere | `<` | `<=` | recherche.js, preparer, p <= N au seuil des retours : fixe[N × R + r] est undefined, différent de LIBRE, et seuilRetour[N × T + undefined] += 1 vise l'index NaN, qui n'écrit rien dans un tableau typé. |
| `src/moteur/recherche.js:443:21` | frontiere | `<` | `<=` | recherche.js, preparer, i <= seuilRetour.length : seuilRetour[length] est undefined, jamais === 0, rien n'est écrit. |
| `src/moteur/recherche.js:448:19` | nombre-plus-un | `0` | `1` | recherche.js, preparer, plusGrand part de 1 : largeurHistogramme ne vaut 2 au lieu de 1 que si tous les plafonds a priori sont nuls ; l'histogramme des écarts n'est indexé que par des écarts de 0 à aPriori[p], la case de plus reste 0 et ne se lit pas. histogramme n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:465:37` | nombre-plus-un | `1` | `2` | recherche.js, preparer, largeurHistogramme = plusGrand + 2 : un histogramme d'une case de plus, jamais indexée (écarts de 0 à aPriori[p] ≤ plusGrand) ; mêmes valeurs lues. |
| `src/moteur/recherche.js:482:13` | frontiere | `>` | `>=` | recherche.js, changerRencontres, apres >= ecartMax : à égalité, l'affectation écrit la valeur déjà retenue ; la branche else-if qu'elle court-circuite exige avant === ecartMax, impossible quand apres === ecartMax puisque avant = apres + sens, sens = ±1. |
| `src/moteur/recherche.js:498:23` | frontiere | `>` | `>=` | recherche.js, changerAffilie, sens >= 0 : modifierPaire ne passe que sens = 1 ou −1, jamais 0 ; les deux tests départagent les mêmes valeurs. |
| `src/moteur/recherche.js:514:15` | frontiere | `<` | `<=` | recherche.js, modifierPaire, a <= b : modifierPaire n'est appelé que pour a ≠ b (voisiner saute le siège exclu, etatInitial ne lit que les sièges avant s, chacun porte une autre personne), où <= et < coïncident. |
| `src/moteur/recherche.js:514:15` | negation | `<` | `>=` | recherche.js, modifierPaire, k = a >= b ? a × N + b : b × N + a : chaque paire reçoit toujours la case max × N + min au lieu de min × N + max ; l'index reste canonique, et paires ne se lit et ne s'écrit que par cette ligne. paires n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:522:13` | frontiere | `>` | `>=` | recherche.js, modifierPaire, sens >= 0 : sens vaut 1 ou −1 (voisiner, etatInitial), jamais 0. |
| `src/moteur/recherche.js:547:27` | frontiere | `>` | `>=` | recherche.js, changerServis, sens >= 0 : changerTable ne l'appelle qu'avec ecart ≠ 0, différence de deux valeurs de sert dans {0, 1}, donc ±1. |
| `src/moteur/recherche.js:548:13` | frontiere | `>` | `>=` | recherche.js, changerServis, apres >= horsObjectifMax : à égalité, l'affectation écrit la valeur déjà retenue ; la branche else-if exige avant === horsObjectifMax, impossible quand apres === horsObjectifMax puisque avant = apres + sens, sens = ±1. |
| `src/moteur/recherche.js:576:25` | frontiere | `>` | `>=` | recherche.js, changerAnimateurs, sens >= 0 : echanger, par changerTable, et etatInitial ne passent que sens = 1 ou −1. |
| `src/moteur/recherche.js:587:7` | si-vrai | `etat.O > 0` | `true` | recherche.js, changerTable, if (true) au lieu de etat.O > 0 : O, le nombre d'objectifs distincts, vaut 0 seulement quand la configuration n'en a aucun ; numeroterObjectifs (configuration.js) écrit alors SANS_OBJECTIF dans chaque case d'objectifDe, sert rend 0 aux deux tables, l'écart est nul et changerServis n'est pas appelé. Le test n'épargne que du temps. |
| `src/moteur/recherche.js:587:14` | frontiere | `>` | `>=` | recherche.js, changerTable, etat.O >= 0 : toujours vrai, même effet que if (true) — sans objectif, objectifDe ne porte que SANS_OBJECTIF, sert rend 0 et l'écart est nul ; seul le temps change. |
| `src/moteur/recherche.js:589:9` | si-vrai | `ecart !== 0` | `true` | recherche.js, changerTable, changerServis appelé même pour un écart nul : avec sens = 0, avant = apres, servis et horsObjectif ne bougent pas, l'histogramme perd puis regagne la même case, jamaisServies -= 0 ; apres > max est faux (apres = avant ≤ max), le else-if ne réécrit max qu'à sa propre valeur, et personnesAuMax se recalcule des mêmes valeurs. Une personne non concernée a s(p) = 0 (une table qui la sert rendrait le tour possible) et avant = 0. |
| `src/moteur/recherche.js:612:9` | si-faux | `s === exclu` | `false` | recherche.js, voisiner, sans le saut du siège exclu : avant l'échange, le siège exclu porte p, qui modifie la paire (p, p) de −1 ; après, il porte p de nouveau à son siège d'arrivée, qui la modifie de +1. Le tableau non signé passe de 0 au maximum puis revient à 0 ; à −1, apres = −1 ≠ 0 compte une répétition retirée, à +1, avant ≠ 0 en rend une : excedentPaires, et collisions cumulées et excédent pour une personne à appartenance, reviennent à leur valeur dans le même échange, avant toute lecture du score, et rencontres comme affiliés ne bougent pas. |
| `src/moteur/recherche.js:612:22` | corps-si | `continue;` | `{}` | recherche.js, voisiner, if (s === exclu) {} : même effet que la suppression du test — la paire (p, p) reçoit −1 avant l'échange et +1 après, dans le même échange ; le tableau non signé revient à 0 et chaque compteur à sa valeur avant toute lecture. |
| `src/moteur/recherche.js:692:13` | ternaire-faux | `R <= UINT16_MAX` | `false` | recherche.js, etatInitial, paires toujours en Uint32Array : il tient tout compte de 0 à R ; mêmes valeurs lues, seule la mémoire double. |
| `src/moteur/recherche.js:692:15` | frontiere | `<=` | `<` | recherche.js, etatInitial, R < UINT16_MAX : seul R = 65 535 passe à un Uint32Array, qui tient les mêmes comptes ; seule la mémoire change. |
| `src/moteur/recherche.js:713:46` | nombre-plus-un | `1` | `2` | recherche.js, etatInitial, histogrammeObjectifs de longueur R + 2 : il n'est indexé que par P(p) − s(p), de 0 à P(p) ≤ R ; la case de plus reste 0 et ne se lit pas. histogrammeObjectifs n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:717:21` | nombre-plus-un | `0` | `1` | recherche.js, etatInitial, personnesAuMax: 1 à la création de l'état : la valeur est récrite sans condition en fin d'etatInitial, avant tout retour et toute lecture. |
| `src/moteur/recherche.js:728:9` | ternaire-faux | `R <= UINT8_MAX` | `false` | recherche.js, etatInitial, rencontresAnimees toujours en Uint32Array quand l'état suit les animateurs : il tient tout compte de 0 à R ; mêmes valeurs, seule la largeur des éléments change. |
| `src/moteur/recherche.js:728:11` | frontiere | `<=` | `<` | recherche.js, etatInitial, R < UINT8_MAX : seul R = 255 passe à un Uint32Array, qui tient les mêmes comptes ; seule la mémoire change. |
| `src/moteur/recherche.js:730:30` | ternaire-faux | `suitAnimateurs` | `false` | recherche.js, etatInitial, animateursNonRencontres part de null même quand l'état suit les animateurs : la boucle qui suit y ajoute borneAnimateurs[p] pour chaque personne, et null + n vaut n. suitAnimateurs exige le critère non sans objet, donc une borne non nulle et N ≥ 1 : la boucle tourne au moins une fois, et la valeur est la même. |
| `src/moteur/recherche.js:757:13` | si-vrai | `q !== FANTOME` | `true` | recherche.js, etatInitial, modifierPaire sans le test q !== FANTOME : les sièges occupés d'une table en forment le début, à chaque tour. preparer place les fixés aux premiers sièges de leur table ; le mélange remplit les sièges mobiles dans l'ordre des sièges, et ceux qui restent sont les derniers ; remplisseur assied chaque libre au prochain siège mobile de sa table. Pour s occupé, chaque voisin de debut[t] à s − 1 l'est aussi : le test est toujours vrai. |
| `src/moteur/recherche.js:759:11` | si-vrai | `etat.O > 0` | `true` | recherche.js, etatInitial, servis[p] += sert(...) sans le test etat.O > 0 : sans objectif, objectifDe ne porte que SANS_OBJECTIF (configuration.js, numeroterObjectifs), sert rend 0 et la somme ne change pas ; seul le temps change. |
| `src/moteur/recherche.js:759:18` | frontiere | `>` | `>=` | recherche.js, etatInitial, etat.O >= 0 : toujours vrai, même effet que sans test — sans objectif, sert rend 0. |
| `src/moteur/recherche.js:893:9` | si-vrai | `mouvement !== null` | `true` | recherche.js, descendre, évaluation d'un mouvement null : rien n'a changé, le candidat égale le score courant, la première comparaison (<= 0) l'accepte, change vaut faux, courant reçoit sa propre valeur, et retenir ne change rien, la meilleure affectation n'étant jamais pire que le score courant ; defaire n'est pas atteint. |
| `src/moteur/recherche.js:949:20` | nombre-plus-un | `2` | `3` | recherche.js, NON_ASSIS = −3 au lieu de −2 : sentinelle de tableDuDepart, écrite par fill et comparée par === ou !== à elle-même seule ; une table vaut un index ≥ 0. Toute valeur négative tient le même rôle. |
| `src/moteur/recherche.js:967:11` | frontiere | `>` | `>=` | recherche.js, exigerToursFiges, i >= 0 : pour i = 0, toursFiges[−1] est undefined, et tour <= undefined est faux pour tout entier ; aucun refus de plus. |
| `src/moteur/recherche.js:1010:23` | frontiere | `<` | `<=` | recherche.js, tableDuDepart, t <= T au contrôle des capacités : occupants[T] et capacite[T] sont undefined, et undefined > undefined est faux ; aucun refus de plus. |
| `src/moteur/recherche.js:1012:23` | frontiere | `<` | `<=` | recherche.js, tableDuDepart, p <= N au contrôle des absents et des fixés : tableDe[N × R + r] est hors du tableau, undefined, différent de NON_ASSIS ; fixe[N × R + r] aussi, et undefined !== t, t valant undefined, est faux : aucun refus de plus. |
| `src/moteur/recherche.js:1035:25` | frontiere | `<` | `<=` | recherche.js, remplisseur, t <= T : pour t = T, s part de debut[T], s < debut[T + 1] (undefined) est faux, et prochain[T] est hors d'un Int32Array de longueur T : rien n'est écrit. |
| `src/moteur/recherche.js:1037:18` | frontiere | `<` | `<=` | recherche.js, remplisseur, s <= debut[t + 1] : la boucle ne passe la fin de la table t que si chacun de ses sièges est fixé. Une telle table ne reçoit aucun libre dans un départ contrôlé : ses fixés y sont assis (tableDuDepart refuse un fixé assis ailleurs), ils la remplissent, et un libre de plus la ferait déborder, ce que tableDuDepart refuse. prochain[t] n'y est donc jamais lu. |
| `src/moteur/recherche.js:1137:23` | nombre-plus-un | `0` | `1` | recherche.js, repartirUne, graineDerivee part de 1 : exigerReglage impose rang ≥ 1, et la boucle de tirage 1 à rang la récrit au moins une fois avant toute lecture. |
| `src/moteur/recherche.js:1241:23` | nombre-plus-un | `0` | `1` | recherche.js, proposerUne, graineDerivee part de 1 : exigerReglage impose rang ≥ 1, et la boucle de tirage la récrit au moins une fois avant toute lecture. |
| `src/moteur/recherche.js:1330:16` | nombre-plus-un | `0` | `1` | recherche.js, regenerer, dejaFaits: 1 : dans descendre, fait ne sert qu'à la cadence de progression et de lireSignal ; regenerer ne passe ni progression ni signal, l'appel optionnel ne fait rien et lireSignal(undefined) ne lève pas. Le plan ne dépend pas de fait. |
| `src/moteur/recherche.js:1396:21` | frontiere | `<` | `<=` | recherche.js, scoreComplet, p <= N : tableDe[N × R + r] est hors du tableau, undefined, différent de RESERVE ; occupation[undefined × R + r] vise l'index NaN, qui n'écrit rien dans un tableau typé. |
| `src/moteur/recherche.js:1399:11` | si-vrai | `t !== RESERVE` | `true` | recherche.js, scoreComplet, occupation comptée même pour RESERVE : l'état de recherche assied chacun à chaque tour, sans réserve (en-tête, « Sièges » ; nombrePlacesManquantes nul), et tableDe ne s'écrit que dans ce module ; une case RESERVE (−1) viserait de plus l'index −R + r, négatif, qui n'écrit rien dans un Int32Array. |
| `src/moteur/recherche.js:1406:58` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, horsObjectif: 1 par défaut : le défaut ne sert que si mesurer rend objectifs null, c'est-à-dire sans personne concernée (indicateurs.js, lireObjectifs) ; le critère des tours hors objectif est alors sans objet (configuration.js, etatDesCriteres : tous les P(p) nuls), la compilation ne pose aucun terme qui lise cette grandeur, et composer ne la lit pas. |
| `src/moteur/recherche.js:1406:76` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, jamaisServies: 1 par défaut : même raison que horsObjectif — sans personne concernée, le critère des tours hors objectif est sans objet, et aucun terme ne lit jamaisServies. |
| `src/moteur/recherche.js:1406:96` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, horsObjectifMax: 1 par défaut : même raison — sans personne concernée, aucun terme ne lit horsObjectifMax. |
| `src/moteur/recherche.js:1406:115` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, personnesAuMax: 1 par défaut : même raison — sans personne concernée, aucun terme ne lit personnesAuMax. |
| `src/moteur/recherche.js:1419:67` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, animateursNonRencontres ?? 1 : le défaut ne sert que si mesurer rend animateurs null, c'est-à-dire quand aucune borne des animateurs n'est non nulle (indicateurs.js, lireAnimateurs) ; le critère est alors sans objet (configuration.js, etatDesCriteres), et aucun terme ne lit la grandeur. |
| `src/moteur/verification.js:42:21` | nombre-plus-un | `2` | `3` | verification.js, SANS_TABLE = -3 au lieu de -2 : la constante ne se compare qu'à elle-même (t !== SANS_TABLE) et à une case de instance.fixe, Int32Array qui ne porte que LIBRE (-1) ou un index de table (0 au moins) ; ni -2 ni -3 n'en est un. |
| `src/moteur/verification.js:174:17` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, compter rend -2 au lieu de -1 pour un id étranger : le résultat ne se lit que par p < 0, vrai pour les deux, et l'appel sur la réserve l'ignore. |
| `src/moteur/verification.js:181:17` | ternaire-vrai | `i < tableDeListe.length` | `true` | verification.js, verifierInvariants, t = tableDeListe[i] sans le repli SANS_TABLE : pour une liste au-delà de plan.tables, t vaut undefined au lieu de -2 ; t ne se lit que par fixe[p · R + r] === t, case d'un Int32Array dans ses bornes (p < N, r < R), toujours un nombre, qui n'égale ni undefined ni -2. |
| `src/moteur/verification.js:181:19` | frontiere | `<` | `<=` | verification.js, verifierInvariants, i <= tableDeListe.length au lieu de < : à i = tableDeListe.length, t vaut tableDeListe[i], undefined, au lieu de SANS_TABLE ; t ne se lit que par fixe[p · R + r] === t, case d'un Int32Array dans ses bornes, toujours un nombre, qui n'égale ni undefined ni -2. |
| `src/moteur/verification.js:184:13` | si-faux | `p < 0` | `false` | verification.js, verifierInvariants, sans le continue d'un id étranger (p = -1) : aUneTable[-1] = 1 n'écrit rien, -1 n'étant pas un index d'élément d'un Uint8Array ; fixe[-R + r], r < R, est hors des éléments et vaut undefined, qui n'égale pas t, un nombre : aSaTable n'est pas écrit. |
| `src/moteur/verification.js:184:20` | corps-si | `continue;` | `{}` | verification.js, verifierInvariants, if (p < 0) {} : même effet que la suppression du test, p = -1 ; aUneTable[-1] = 1 n'écrit rien dans un Uint8Array, et fixe[-R + r] vaut undefined, qui n'égale pas t : aSaTable n'est pas écrit. |
| `src/moteur/verification.js:185:24` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, aUneTable[p] = 2 au lieu de 1 : la marque ne se lit que par !aUneTable[p], et fill(0) la remet à zéro à chaque tour. |
| `src/moteur/verification.js:186:50` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, aSaTable[p] = 2 au lieu de 1 : la marque ne se lit que par !aSaTable[p], et fill(0) la remet à zéro à chaque tour. |
| `src/moteur/verification.js:191:44` | frontiere | `<` | `<=` | verification.js, verifierInvariants, boucle des capacités jusqu'à i <= tableDeListe.length : le tour de trop n'a lieu que pour une liste au-delà de plan.tables ; t = tableDeListe[i] vaut undefined, et listes[i].length > capacite[undefined] compare à undefined (propriété absente de l'Int32Array), toujours faux : aucun CAPACITE n'est ajouté. |

## Délais et erreurs (366)

| lieu | opérateur | avant | après | issue |
|---|---|---|---|---|
| `src/moteur/classement.js:155:21` | negation | `<` | `>=` | délai |
| `src/moteur/classement.js:155:35` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/classement.js:155:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/classement.js:281:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:189:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:237:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:254:11` | si-faux | `!Number.isInteger(tour) \|\| tour < 1 \|\| tour > R` | `false` | délai |
| `src/moteur/configuration.js:265:9` | si-vrai | `p === undefined` | `true` | délai |
| `src/moteur/configuration.js:266:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:290:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:290:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:290:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:291:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:291:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:296:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:296:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:296:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:297:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:297:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:321:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:321:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:321:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:325:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:325:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:379:34` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:393:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:393:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:393:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:394:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:394:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:415:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:424:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:429:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:429:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:431:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:431:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:431:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:435:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:435:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:435:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:442:27` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:442:31` | logique | `o < O && !oui` | `((o < O )\|\|( !oui))` | délai |
| `src/moteur/configuration.js:442:42` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:442:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:464:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:482:29` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:482:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:482:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:509:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:509:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:511:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:511:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:515:29` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:515:38` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:515:41` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:522:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:522:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:526:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:526:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:538:46` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:538:78` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:538:81` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:857:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:866:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:870:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:870:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:870:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:899:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:924:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:929:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:950:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:950:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:950:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:991:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:991:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:991:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:100:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:100:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:100:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:102:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:102:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:102:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:106:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:106:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:126:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:128:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:131:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:131:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:167:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:167:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:169:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:169:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:181:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:181:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:181:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:286:45` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/diagnostic.js:286:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:311:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:311:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:311:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:313:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:313:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:366:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:406:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:406:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:406:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:407:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:407:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:416:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:416:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:416:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:417:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:417:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:425:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:425:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:425:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:429:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:429:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:432:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:432:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:432:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:78:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:78:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:81:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:81:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:84:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:84:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:94:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:94:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:95:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:95:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:97:73` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:112:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:122:47` | logique | `present && k < debutAssis[ligne + 1]` | `((present )\|\|( k < debutAssis[ligne + 1]))` | délai |
| `src/moteur/diversite.js:122:79` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:122:82` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diversite.js:142:44` | negation | `<` | `>=` | délai |
| `src/moteur/diversite.js:142:72` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diversite.js:142:75` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:190:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:190:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:190:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:192:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:192:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:207:74` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:207:83` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:207:86` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:222:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:222:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:241:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:241:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:243:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:248:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:253:25` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:253:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:253:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:258:31` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:258:49` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:258:52` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:315:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:315:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:315:44` | nombre-zero | `2` | `0` | délai |
| `src/moteur/indicateurs.js:406:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:406:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:406:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:415:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:415:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:449:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:449:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:449:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:455:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:455:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:495:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:495:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:495:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:80:21` | negation | `<` | `>=` | délai |
| `src/moteur/manque.js:80:40` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/manque.js:80:43` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:227:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/manque.js:227:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:257:86` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:307:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:389:47` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/manque.js:389:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:58:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:58:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:94:21` | negation | `<` | `>=` | délai |
| `src/moteur/paires.js:94:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:94:44` | nombre-zero | `2` | `0` | délai |
| `src/moteur/paires.js:121:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:121:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:153:21` | negation | `<` | `>=` | délai |
| `src/moteur/paires.js:153:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:153:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:154:27` | negation | `<` | `>=` | délai |
| `src/moteur/paires.js:154:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:154:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:76:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:76:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:115:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:115:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:115:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:122:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:122:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:136:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:136:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:150:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:206:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:206:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:206:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:208:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:208:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:235:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:235:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:235:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:270:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:270:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:273:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:273:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:289:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:289:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:316:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:316:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:344:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:344:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:345:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:345:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:348:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/plafond.js:348:39` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:348:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:357:29` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:357:32` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:376:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:376:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:376:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:394:29` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:394:32` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:410:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:410:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:414:7` | si-faux | `f === 0 \|\| A === 0` | `false` | délai |
| `src/moteur/plafond.js:414:15` | logique | `f === 0 \|\| A === 0` | `((f === 0 )&&( A === 0))` | délai |
| `src/moteur/plafond.js:414:20` | negation | `===` | `!==` | délai |
| `src/moteur/plafond.js:414:24` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/plafond.js:414:27` | corps-si | `return plafondItineraire(instance, p, itineraire);` | `{}` | délai |
| `src/moteur/plafond.js:429:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:429:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:431:15` | arithmetique | `-` | `+` | délai |
| `src/moteur/plafond.js:431:17` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:432:14` | frontiere | `>=` | `>` | délai |
| `src/moteur/plafond.js:432:14` | negation | `>=` | `<` | délai |
| `src/moteur/plafond.js:432:17` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/plafond.js:432:39` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/plafond.js:432:44` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/plafond.js:432:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:433:9` | si-faux | `i < 0` | `false` | délai |
| `src/moteur/plafond.js:433:11` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:433:16` | corps-si | `return plafond;` | `{}` | délai |
| `src/moteur/plafond.js:434:14` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:434:17` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/plafond.js:434:17` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:435:27` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:435:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:435:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:460:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:135:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:214:21` | negation | `<` | `>=` | délai |
| `src/moteur/qualite.js:214:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:214:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:273:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:273:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:585:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:590:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:671:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:697:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:697:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:730:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:730:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:251:18` | nombre-zero | `10` | `0` | délai |
| `src/moteur/recherche.js:343:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:397:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:397:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:400:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:400:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:410:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:410:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:413:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:413:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:424:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:424:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:437:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:437:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:438:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:438:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:443:45` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:443:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:449:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:449:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:493:15` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:570:68` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:570:77` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:570:80` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:611:57` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:611:60` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:624:18` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:732:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:732:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:740:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:742:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:742:46` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:742:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:747:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:747:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:749:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:749:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:755:42` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:755:54` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:755:57` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:763:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:763:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:782:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:782:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:784:59` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:784:62` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:794:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:811:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:881:20` | logique | `i < arret && !estNul(courant)` | `((i < arret )\|\|( !estNul(courant)))` | délai |
| `src/moteur/recherche.js:881:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:881:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:882:9` | si-vrai | `immobile >= patience && ordre === ordreContraintes` | `true` | délai |
| `src/moteur/recherche.js:882:18` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:882:30` | logique | `immobile >= patience && ordre === ordreContraintes` | `((immobile >= patience )\|\|( ordre === ordreContraintes))` | délai |
| `src/moteur/recherche.js:908:9` | si-vrai | `i + 1 === releve` | `true` | délai |
| `src/moteur/recherche.js:908:15` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1010:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1010:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1012:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1012:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1033:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1035:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1035:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1037:33` | logique | `s < debut[t + 1] && siegesFixes[base + s] !== FANTOME` | `((s < debut[t + 1] )\|\|( siegesFixes[base + s] !== FANTOME))` | délai |
| `src/moteur/recherche.js:1037:73` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1037:76` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1057:38` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1057:41` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1093:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1093:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1138:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1138:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1193:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1193:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1242:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1242:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1396:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1396:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1397:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1397:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:154:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:180:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:191:72` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:198:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:198:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:285:58` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:292:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:393:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:393:31` | nombre-zero | `1` | `0` | délai |
