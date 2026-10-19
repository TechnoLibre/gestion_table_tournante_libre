# Audit par mutation du moteur

Écrit par `make mutation` (`scripts/mutation/audit.js`, § 14.13) ; ne se modifie pas à la main.

| | |
|---|---|
| version | 2026.10.05.01 |
| périmètre | `src/moteur` |
| sources et épreuves du périmètre (SHA-256) | `f1494902e3bc6967cddfe5a6a9668c906f12bdab1e96095e07ad491796a99d82` |
| Node | v26.10.0 |

Chaque mutant se joue contre les épreuves de la série node qui atteignent son module, sous `node --test`.
Un survivant se rejoue contre les épreuves longues qui atteignent son module avant d’être compté : tué par elles, il se compte à part.
Un survivant sur une ligne couverte désigne une épreuve qui exécute sans affirmer.

## Bilan

| mutants | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---:|---:|---:|---:|---:|---:|---:|
| 6028 | 5238 | 10 | 0 | 280 | 500 | 0 |

## Par fichier

| fichier | total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| `src/moteur/classement.js` | 93 | 81 | 0 | 0 | 8 | 4 | 0 |
| `src/moteur/configuration.js` | 1156 | 1034 | 0 | 0 | 36 | 86 | 0 |
| `src/moteur/conflits.js` | 24 | 24 | 0 | 0 | 0 | 0 | 0 |
| `src/moteur/correspondance.js` | 18 | 18 | 0 | 0 | 0 | 0 | 0 |
| `src/moteur/criteres.js` | 211 | 203 | 0 | 0 | 8 | 0 | 0 |
| `src/moteur/diagnostic.js` | 584 | 499 | 1 | 0 | 36 | 48 | 0 |
| `src/moteur/diversite.js` | 220 | 183 | 0 | 0 | 19 | 18 | 0 |
| `src/moteur/indicateurs.js` | 500 | 438 | 0 | 0 | 24 | 38 | 0 |
| `src/moteur/manque.js` | 218 | 198 | 0 | 0 | 12 | 8 | 0 |
| `src/moteur/paires.js` | 123 | 108 | 0 | 0 | 2 | 13 | 0 |
| `src/moteur/plafond.js` | 541 | 416 | 4 | 0 | 49 | 72 | 0 |
| `src/moteur/presence.js` | 30 | 30 | 0 | 0 | 0 | 0 | 0 |
| `src/moteur/qualite.js` | 419 | 401 | 0 | 0 | 5 | 13 | 0 |
| `src/moteur/recherche.js` | 1490 | 1222 | 5 | 0 | 72 | 191 | 0 |
| `src/moteur/verification.js` | 401 | 383 | 0 | 0 | 9 | 9 | 0 |

## Par opérateur

| opérateur | total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| arithmetique | 676 | 635 | 0 | 0 | 14 | 27 | 0 |
| frontiere | 348 | 245 | 2 | 0 | 100 | 1 | 0 |
| negation | 848 | 775 | 0 | 0 | 2 | 71 | 0 |
| logique | 224 | 214 | 0 | 0 | 3 | 7 | 0 |
| retrait-non | 93 | 93 | 0 | 0 | 0 | 0 | 0 |
| mise-a-jour | 340 | 182 | 2 | 0 | 2 | 154 | 0 |
| nombre-plus-un | 1178 | 1069 | 2 | 0 | 87 | 20 | 0 |
| nombre-zero | 630 | 411 | 0 | 0 | 19 | 200 | 0 |
| booleen | 45 | 43 | 0 | 0 | 2 | 0 | 0 |
| si-vrai | 474 | 447 | 3 | 0 | 18 | 6 | 0 |
| si-faux | 474 | 456 | 0 | 0 | 11 | 7 | 0 |
| ternaire-vrai | 93 | 88 | 0 | 0 | 5 | 0 | 0 |
| ternaire-faux | 93 | 89 | 0 | 0 | 4 | 0 | 0 |
| min-max | 38 | 36 | 1 | 0 | 1 | 0 | 0 |
| corps-si | 474 | 455 | 0 | 0 | 12 | 7 | 0 |

## Survivants (0), lignes couvertes d’abord

Aucun.

## Tués par la série longue (10)

Survivants de la série node que les épreuves longues tuent : la série node exécute leur ligne sans l’affirmer.

| lieu | opérateur | avant | après | ligne couverte |
|---|---|---|---|---|
| `src/moteur/diagnostic.js:420:9` | si-vrai | `passant === undefined` | `true` | oui |
| `src/moteur/plafond.js:371:18` | min-max | `min` | `max` | oui |
| `src/moteur/plafond.js:426:9` | si-vrai | `connu === undefined \|\| nP > connu` | `true` | oui |
| `src/moteur/plafond.js:434:9` | si-vrai | `programme === undefined` | `true` | oui |
| `src/moteur/plafond.js:483:16` | frontiere | `>` | `>=` | oui |
| `src/moteur/recherche.js:486:23` | frontiere | `<` | `<=` | oui |
| `src/moteur/recherche.js:497:16` | nombre-plus-un | `0` | `1` | oui |
| `src/moteur/recherche.js:497:31` | nombre-plus-un | `1` | `2` | oui |
| `src/moteur/recherche.js:546:20` | mise-a-jour | `+=` | `-=` | oui |
| `src/moteur/recherche.js:549:31` | mise-a-jour | `+=` | `-=` | oui |

## Mutants équivalents (280)

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
| `src/moteur/configuration.js:100:20` | nombre-plus-un | `2` | `3` | configuration.js, NON_PLACE = −3 au lieu de −2 : la marque ne sert qu'à indexerPlan, qui en remplit tableDe, la compare par !== et === et la remplace par un index de table (≥ 0) ou RESERVE (−1) ; toute case encore marquée lève PLAN_NON_ASSIS, si bien que la marque n'est jamais rendue, et −3 n'égale ni RESERVE ni un index. |
| `src/moteur/configuration.js:304:7` | si-faux | `absences === 0` | `false` | configuration.js, coPresences, if (false) au lieu de absences === 0 : sans absence, chaque rangée du masque ne porte que des 1 ; la réunion des présents des tours de chacun contient les N personnes, d'où un compte N et N − 1 co-présents, la valeur que fill écrit. Le raccourci n'épargne que le calcul. |
| `src/moteur/configuration.js:304:20` | nombre-plus-un | `0` | `1` | configuration.js, coPresences, absences === 1 au lieu de absences === 0 : la seule absence est celle d'une personne à un tour ; chacun étant présent à un tour au moins, R vaut alors au moins 2, et cette personne est présente à un autre tour, où les N − 1 autres le sont toutes : chacun croise chacun, N − 1 co-présents pour tous, la valeur que fill écrit. |
| `src/moteur/configuration.js:307:30` | arithmetique | `/` | `*` | configuration.js, coPresences, Math.ceil(N × 32) mots au lieu de ⌈N/32⌉ : l'index d'une personne, r × mots + (p >>> 5), et les boucles sur m < mots suivent le même mots ; les mots ajoutés restent à 0, et bitsA1(0) vaut 0. Seule la mémoire change. |
| `src/moteur/configuration.js:309:23` | frontiere | `<` | `<=` | configuration.js, coPresences, p <= N au remplissage des présents de chaque tour : le tour de trop lit present[N × R + r], hors des éléments du tableau typé, undefined, qui n'égale pas 1 : rien ne s'écrit. |
| `src/moteur/configuration.js:310:25` | frontiere | `<` | `<=` | configuration.js, coPresences, r <= R au remplissage des présents de chaque tour : la case de trop, present[p × R + R], est le tour 1 de la personne suivante ; quand elle vaut 1, l'écriture vise presentsDuTour[R × mots + (p >>> 5)], au-delà de la longueur R × mots du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:316:23` | frontiere | `<` | `<=` | configuration.js, coPresences, p <= N au décompte : le tour de trop prend le motif vide de present.subarray(N × R, (N + 1) × R) et écrit son compte dans coPresents[N], au-delà de la longueur N du tableau typé, qui n'écrit rien ; le motif vide n'est celui d'aucune personne, R valant au moins 1, et la Map ne le rend à personne. |
| `src/moteur/configuration.js:317:40` | arithmetique | `*` | `/` | configuration.js, coPresences, motif lu depuis p / R au lieu de p × R : subarray tronque le début à ⌊p/R⌋, et la clé de la Map porte la rangée de p en suffixe ; sa longueur, (p + 1) × R − ⌊p/R⌋, croît strictement avec p dès que R ≥ 2, ce qu'impose une absence : deux personnes n'ont jamais la même clé, et chacune calcule son compte depuis present[p × R + r], qui ne dépend pas de la clé. Seule la mémoïsation se perd. |
| `src/moteur/configuration.js:317:50` | nombre-plus-un | `1` | `2` | configuration.js, coPresences, motif lu jusqu'à (p + 2) × R au lieu de (p + 1) × R : la clé porte la rangée de p suivie de celle de p + 1, ou la seule rangée de p pour la dernière personne, de longueur R ; deux clés égales ont donc la même rangée de p en tête, et le compte retrouvé est celui de ce motif. Deux personnes au même motif peuvent recalculer le même compte : seule la mémoïsation se perd. |
| `src/moteur/configuration.js:319:11` | si-vrai | `compte === undefined` | `true` | configuration.js, coPresences, if (true) au lieu de compte === undefined : chaque personne recalcule la réunion des présents de ses tours au lieu de reprendre le compte de son motif, la même valeur ; seule la mémoïsation se perd. |
| `src/moteur/configuration.js:321:27` | frontiere | `<` | `<=` | configuration.js, coPresences, r <= R dans la réunion : la case de trop, present[p × R + R], est le tour 1 de la personne suivante, ou undefined pour la dernière ; quand elle n'est pas 0, reunion[m] \|= presentsDuTour[R × mots + m] lit undefined hors du tableau typé, et x \| undefined vaut x : la réunion ne change pas. |
| `src/moteur/configuration.js:323:29` | frontiere | `<` | `<=` | configuration.js, coPresences, m <= mots dans la réunion : le mot de trop écrit reunion[mots], au-delà de la longueur mots du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:326:27` | frontiere | `<` | `<=` | configuration.js, coPresences, m <= mots au compte : bitsA1 reçoit reunion[mots], undefined hors du tableau typé ; ses décalages et masques font du NaN un 0, et bitsA1 rend 0 : le compte ne change pas. |
| `src/moteur/configuration.js:333:21` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, p <= N : le tour de trop lit fixe[N × R + r], undefined, puis objectifDe[NaN] et correspond[NaN], undefined ; undefined === 1 est faux, rien n'est écrit. |
| `src/moteur/configuration.js:403:21` | frontiere | `<` | `<=` | configuration.js, siegesLibresApres, p <= N : le tour de trop lit fixe[N × R + r], undefined, différent de LIBRE ; l'écriture fixees[NaN] += 1 vise un index hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:406:11` | si-vrai | `t !== LIBRE` | `true` | configuration.js, siegesLibresApres, if (true) au lieu de t !== LIBRE : une case libre écrit fixees[−R + r], un index négatif, hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:409:21` | frontiere | `<` | `<=` | configuration.js, siegesLibresApres, t <= T : le tour de trop compare undefined > undefined, faux, et écrit fixees[T × R + r], au-delà de la longueur T × R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:445:17` | corps-si | `{ statut[p] = STATUT.MOBILE; }` | `{}` | configuration.js, deriverStatuts, if (aucune) {} : statut est un Uint8Array, dont chaque case vaut 0 à sa création, et STATUT.MOBILE vaut 0 ; la case reste à 0. |
| `src/moteur/configuration.js:472:42` | nombre-plus-un | `1` | `2` | configuration.js, numeroterObjectifs, rangDe de longueur T × (R + 2) au lieu de T × (R + 1) : toutes les lectures et écritures visent t × (R + 1) + k avec k ≤ R, au plus T × (R + 1) − 1 ; les cases ajoutées en fin ne se lisent jamais. |
| `src/moteur/configuration.js:490:44` | nombre-plus-un | `1` | `2` | configuration.js, numeroterObjectifs, numeroDe de longueur T × (R + 2) au lieu de T × (R + 1) : les lectures visent t × (R + 1) + k avec k ≤ R, au plus T × (R + 1) − 1 ; les cases ajoutées en fin ne se lisent jamais. |
| `src/moteur/configuration.js:508:21` | frontiere | `<` | `<=` | configuration.js, numeroterObjectifs, t <= T dans le calcul de objectifDe : le tour de trop écrit objectifDe[T × R + r], au-delà de la longueur T × R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:509:23` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, r <= R dans le parcours des tables à siège libre : le tour de trop écrit plusGrandLibre[R], hors du tableau typé de longueur R, qui n'écrit rien, et pousse une liste libresDuTour[R] que le parcours des personnes (r < R) ne lit jamais. |
| `src/moteur/configuration.js:530:21` | frontiere | `>` | `>=` | configuration.js, couplesPossibles, O >= 0 && p < N : sans objectif, la boucle tourne sans rien écrire — correspond est vide, copyWithin(0, 0, 0) ne copie rien, la boucle intérieure (o < 0) ne tourne pas ; seul le temps change. |
| `src/moteur/configuration.js:534:9` | si-faux | `premiere !== undefined` | `false` | configuration.js, couplesPossibles, if (false) au lieu de premiere !== undefined : chaque personne recalcule sa rangée par correspondA, fonction pure des étiquettes et de l'objectif, au lieu de recopier celle de la première personne aux mêmes étiquettes, égale ; seul le temps change. |
| `src/moteur/configuration.js:534:33` | corps-si | `{ correspond.copyWithin(p * O, premiere * O, premiere * O +…` | `{}` | configuration.js, couplesPossibles, corps vide du if (premiere !== undefined) : même effet que le mutant si-faux du même if — la rangée se recalcule par correspondA, pure, au lieu d'être recopiée, égale ; seul le temps change. |
| `src/moteur/configuration.js:546:23` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, t <= T dans le marquage des objectifs offerts : le tour de trop lit objectifDe[T × R + r] et siegesLibres[T × R + r], undefined hors des tableaux typés ; undefined > 0 est faux, rien n'est marqué. |
| `src/moteur/configuration.js:550:23` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, p <= N : le tour de trop lit present[N × R + r], undefined, qui n'égale pas 0, puis fixe[N × R + r], undefined, différent de LIBRE ; objectifDe[NaN] vaut undefined, différent de SANS_OBJECTIF, et correspond[NaN], undefined, n'égale pas 1 : oui reste faux, rien ne s'écrit. |
| `src/moteur/configuration.js:558:27` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, o <= O : le tour de trop lit offert[O], undefined hors du tableau typé ; undefined === 1 est faux, oui reste faux. |
| `src/moteur/configuration.js:604:29` | frontiere | `<` | `<=` | configuration.js, deriverAnimateurs, ligne <= T × R : le tour de trop écrit debutAnimes[T × R + 1], au-delà de la longueur T × R + 1 du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:629:7` | si-faux | `A === 0` | `false` | configuration.js, bornerAnimateurs, if (false) au lieu de A === 0 : sans animateur, animes est vide et debutAnimes ne porte que des zéros ; aucune liste de rangs ne se remplit, plusGrandLibre reste à 0, aucune boucle sur les animateurs ne tourne, et chaque borne vaut min(0, 0) = 0, la valeur de la sortie anticipée ; seul le temps change. |
| `src/moteur/configuration.js:629:16` | corps-si | `return borne;` | `{}` | configuration.js, bornerAnimateurs, corps vide du if (A === 0) : même effet que le mutant si-faux du même if — le calcul complet rend des bornes toutes nulles, celles de la sortie anticipée ; seul le temps change. |
| `src/moteur/configuration.js:632:21` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, r <= R au relevé des tables à siège libre : le tour de trop ajoute libresDuTour[R], que la boucle des personnes, sur les tours 0 à R − 1, ne lit jamais, et écrit plusGrandLibre[R], au-delà de la longueur R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:644:42` | nombre-plus-un | `1` | `2` | configuration.js, bornerAnimateurs, marque remplie de −2 au lieu de −1 : marque[f] ne se lit que par marque[f] === p, avec p ≥ 0 ; aucune des deux valeurs initiales ne l'égale. |
| `src/moteur/configuration.js:645:21` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, p <= N : le tour de trop lit present et fixe hors des tableaux typés, undefined, qui n'égale ni 0 ni LIBRE ; la boucle des animateurs va de debutAnimes[NaN] à debutAnimes[NaN], undefined < undefined est faux : rien ne se marque, et borne[N], au-delà de la longueur N du tableau typé, n'écrit rien. |
| `src/moteur/configuration.js:1024:23` | frontiere | `<` | `<=` | configuration.js, indexerPlan, p <= N à la recherche des non-placés : le tour de trop lit tableDe[N × R + r], hors du tableau typé, undefined, différent de NON_PLACE : continue, rien ne s'écrit ni ne se lève. |
| `src/moteur/configuration.js:1055:33` | frontiere | `>` | `>=` | configuration.js, exigerPlanIndexe, absences >= 0 au lieu de absences > 0 : le masque se lit aussi sans absence ; une instance de normaliser sans absence a present à 1 partout, absences valant Σ_p (R − toursPresents[p]), si bien que present[i] === 0 n'est jamais vrai et que rien de plus ne se lève. Seule la lecture du masque, que le raccourci épargne, s'ajoute. |
| `src/moteur/criteres.js:266:79` | frontiere | `<` | `<=` | criteres.js, verifierPriorites, ordre d'un palier jugé par rangDe(critere) <= rangDe(précédent) : deux entrées d'un palier de même rang nomment le même critère, et la répétition a déjà rendu critereRepete à la lecture des entrées, avant ce jugement. |
| `src/moteur/criteres.js:290:19` | ternaire-faux | `rang === 0` | `false` | criteres.js, completerPriorites, place du premier critère calculée par palierDe(CRITERES[−1]) + 1 : CRITERES[−1] vaut undefined, aucune entrée de la forme {critere, poids} du contrat, critere une chaîne, ne le porte, palierDe rend −1 et la place vaut 0, comme la branche rang === 0. Ses deux appelants lui passent une liste que verifierPriorites a jugée : lirePriorites (configuration.js) juste avant le complément, priorites(charge) (document.js) une charge dont examinerPriorites a jugé la liste. |
| `src/moteur/criteres.js:302:10` | ternaire-vrai | `criteres.length === 1` | `true` | criteres.js, familleDuPalier, famille du premier critère même pour un palier partagé : la liste compilée est valide, ses critères suivent l'ordre de CRITERES, où les deux raffinements viennent en dernier ; un palier partagé qui n'est pas tout raffinement s'ouvre donc sur un critère d'avant eux, ni l'écart (seul à son palier), ni un raffinement, soit un critère de la famille contrainte, ce que rend la branche d'origine. |
| `src/moteur/criteres.js:344:22` | nombre-plus-un | `1` | `2` | criteres.js, compiler, palierEcart initial −2 au lieu de −1 : la valeur ne se lit que par palierEcart < 0, ou après avoir été remplacée par un rang ≥ 0. |
| `src/moteur/criteres.js:348:21` | ternaire-vrai | `criteres.length === 1` | `true` | criteres.js, compiler, largeur d'un palier partagé prise de composantesDe de son premier critère : un critère d'un palier partagé n'est pas de seulsASonPalier(mode) (verifierPriorites), et hors de ceux-là composantesDe rend une seule grandeur — l'écart (deux) est toujours seul, les tours hors objectif n'en ont plusieurs que sous les modes où ils sont seuls ; la largeur vaut 1 comme dans la branche d'origine. |
| `src/moteur/criteres.js:361:54` | frontiere | `>` | `>=` | criteres.js, compiler, palier raffinement suivant cherché dès i >= palierEcart : le palier de l'écart, où l'écart est seul, est de la famille rencontres, jamais raffinement ; le rang palierEcart n'est jamais rendu. |
| `src/moteur/criteres.js:362:23` | frontiere | `<` | `<=` | criteres.js, compiler, suivant <= 0 au lieu de suivant < 0 : suivant vaut −1 ou un rang strictement supérieur à palierEcart ≥ 0, jamais 0. |
| `src/moteur/criteres.js:362:25` | nombre-plus-un | `0` | `1` | criteres.js, compiler, suivant < 1 au lieu de suivant < 0 : suivant vaut −1 ou un rang strictement supérieur à palierEcart ≥ 0, jamais 0. |
| `src/moteur/diagnostic.js:113:7` | si-faux | `T === 0` | `false` | diagnostic.js, pairesMinimales, if (false) au lieu de if (T === 0) : sans table, membres est un Int32Array vide ; la boucle des libres écrit membres[0], hors des éléments d'un tableau typé, ce qui n'écrit rien, et la somme sur aucune table rend 0, la valeur du retour anticipé. |
| `src/moteur/diagnostic.js:113:16` | corps-si | `return 0;` | `{}` | diagnostic.js, pairesMinimales, if (T === 0) {} : même chemin que le mutant si-faux du même if — sans table, membres[0] += 1 n'écrit rien dans un Int32Array vide et la somme rend 0. |
| `src/moteur/diagnostic.js:117:18` | nombre-zero | `1` | `0` | diagnostic.js, pairesMinimales, boucle de la table la moins remplie partant de t = 0 : le premier tour compare membres[0] < membres[0], toujours faux ; moins ne change pas. |
| `src/moteur/diagnostic.js:117:23` | frontiere | `<` | `<=` | diagnostic.js, pairesMinimales, t <= T dans la recherche de la table la moins remplie : membres[T] est undefined, et undefined < x est faux ; moins ne change pas. |
| `src/moteur/diagnostic.js:117:51` | frontiere | `<` | `<=` | diagnostic.js, pairesMinimales, membres[t] <= membres[moins] : à égalité le libre va à la dernière table la moins remplie au lieu de la première ; ajouter 1 à un minimum ou à un autre donne le même multiensemble de membres par table, et Σ C(x_t, 2) ne lit que ce multiensemble. |
| `src/moteur/diagnostic.js:146:22` | nombre-plus-un | `0` | `1` | diagnostic.js, planchersCollisions, distinctes initialisé à 1 : un groupe n'est écrit que si cumulees > 0, donc qu'un tour au moins a un minimum entier ≥ 1 ; max(1, …) y rend la même valeur que max(0, …), et un groupe à cumulees nul n'est pas écrit. |
| `src/moteur/diagnostic.js:198:21` | frontiere | `<` | `<=` | diagnostic.js, animateursMemeAppartenance, p <= N : statut[N] est undefined, différent de STATUT.ANCRE ; le tour de trop passe par continue. |
| `src/moteur/diagnostic.js:259:109` | frontiere | `<=` | `<` | diagnostic.js, avecTablesManquantes, enAttente avec m < l.effectif : une ligne absente de sansRemede a, à chaque tour, ses membres réservés à des tables distinctes parmi les T existantes ; ses s − k_r libres trouvent une table vide dès que T + m ≥ s, et son plancher tombe à 0 à m = s − T ≤ s − 1 (une ligne suppose T ≥ 1). Aucune ligne n'est donc en attente à m = s, où seules les deux bornes diffèrent. |
| `src/moteur/diagnostic.js:260:25` | min-max | `max` | `min` | diagnostic.js, avecTablesManquantes, tables ajoutées de la plus petite capacité au lieu de la plus grande : normaliser refuse toute capacité < 2, la plus petite présente est donc valide ; planchersCollisions ne lit ni capacite ni idsTables, et les tablesManquantes rendues ne changent pas. |
| `src/moteur/diagnostic.js:261:55` | nombre-plus-un | `1` | `2` | diagnostic.js, avecTablesManquantes, premierId = max + 2 : les identifiants ajoutés restent des entiers ≥ 1 distincts de ceux de la configuration et entre eux ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:264:39` | arithmetique | `-` | `+` | diagnostic.js, avecTablesManquantes, id = premierId + m + 1 : identifiants toujours distincts, entiers et au-delà du plus grand ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:264:41` | nombre-zero | `1` | `0` | diagnostic.js, avecTablesManquantes, id = premierId + m − 0 : identifiants toujours distincts, entiers et au-delà du plus grand ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:264:80` | arithmetique | `+` | `-` | diagnostic.js, avecTablesManquantes, numero = tables.length − m : normaliser ne lit pas le numéro d'une table (seuls id et capacite entrent dans l'instance) ; la sonde rend les mêmes planchers. |
| `src/moteur/diagnostic.js:268:81` | frontiere | `<=` | `<` | diagnostic.js, avecTablesManquantes, affectation sous m < ligne.effectif : même raison que pour enAttente — une ligne absente de sansRemede s'annule à m = s − T ≤ s − 1, avant que la borne ne joue. |
| `src/moteur/diagnostic.js:303:84` | logique | `tour === null \|\| tour === undefined` | `((tour === null )&&( tour === undefined))` | diagnostic.js, surMoinsDeTours, tour === null && tour === undefined : un objectif de soirée à tour null passe encore par avant(null), null <= R′ étant vrai ; seul un objectif à tour absent est retiré de la sonde. La sonde ne sert qu'à redondanceMinimale et plafondsAPriori, qui ne lisent aucun objectif, et retirer un objectif déjà validé ne fait lever aucune règle de normaliser. |
| `src/moteur/diagnostic.js:303:106` | logique | `tour === null \|\| tour === undefined \|\| avant(tour)` | `((tour === null \|\| tour === undefined )&&( avant(tour)))` | diagnostic.js, surMoinsDeTours, (tour nul ou absent) && avant(tour) : la sonde perd ses objectifs d'un tour désigné, et ceux à tour absent ; elle n'en gagne aucun au-delà de R′. redondanceMinimale et plafondsAPriori ne lisent aucun objectif, et en retirer un ne fait lever aucune règle de normaliser. |
| `src/moteur/diagnostic.js:314:22` | arithmetique | `-` | `+` | diagnostic.js, toursSansRedondance, départ à R + 1 : la sonde à R + 1 tours garde toutes les réservations et se normalise sans lever ; le plafond a priori, maximum exact de la formule sur les itinéraires admissibles, ne décroît pas quand un tour s'ajoute (un itinéraire prolongé d'une table ne perd ni ancré ni siège), donc la redondance y reste ≥ sa valeur à R, positive. La sonde à R est la configuration même. Seul le temps change. Un participant réservé tour par tour à la même table sur chacun des R tours, ancré à R, devient partiellement fixé à R + 1 : l'ancré perdu à sa table est compensé, pour qui y passe, par un mobile et au moins un siège de plus (A − 1 + min(n_p + 1, S + m) ≥ A + min(n_p, S)). |
| `src/moteur/diagnostic.js:314:24` | nombre-zero | `1` | `0` | diagnostic.js, toursSansRedondance, départ à R : la sonde à R tours est la configuration elle-même, dont la redondance minimale est positive à ce point ; un chiffrage de plus, aucun résultat changé. |
| `src/moteur/diagnostic.js:342:16` | nombre-zero | `1` | `0` | diagnostic.js, collisionPartout, recherche de la plus petite capacité partant de t = 0 : plusPetite vaut déjà capacite[0], et le tour de trop compare capacite[0] < capacite[0], faux ; plusPetite ne change pas. |
| `src/moteur/diagnostic.js:342:21` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, t <= T : capacite[T] est undefined, N − (places − undefined) vaut NaN, et NaN <= x est faux ; le tour de trop ne rend pas false, et la boucle rend true exactement quand les T tables réelles passent. |
| `src/moteur/diagnostic.js:342:50` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, capacite[t] <= plusPetite : à égalité, l'affectation écrit la capacité déjà retenue. |
| `src/moteur/diagnostic.js:344:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, r <= R dans le compte des sièges libres : le tour de trop écrit libresAuTour[R], hors des éléments d'un Int32Array de longueur R, ce qui n'écrit rien (la lecture objectifDe[t·R + R] est celle d'une autre table, ou undefined, sans effet). |
| `src/moteur/diagnostic.js:348:23` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, p <= N dans le compte des sans appartenance : groupe[N] est undefined, différent de SANS_GROUPE (−1) ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:353:18` | nombre-plus-un | `1` | `2` | diagnostic.js, collisionPartout, vue[g] = 2 : vue, un Uint8Array remis à 0 à chaque tour, ne se lit que par vue[g] === 0 ; 2 y est non nul comme 1, et chaque appartenance se compte une fois par tour. |
| `src/moteur/diagnostic.js:408:7` | si-faux | `mobile === -1` | `false` | diagnostic.js, ecartItineraire, if (false) au lieu de if (mobile === -1) : sans mobile ni partiellement fixé, tous les présents sont ancrés ; Σ c_t = N et a_t ≤ c_t (SURRESERVATION sinon) forcent a_t = c_t à chaque table, chaque table est sautée par sieges === 0, et siegesToursInferieurs nul rend null, comme le retour anticipé. |
| `src/moteur/diagnostic.js:408:19` | nombre-plus-un | `1` | `2` | diagnostic.js, ecartItineraire, mobile === -2 : indexOf ne rend jamais −2, le retour anticipé disparaît ; même chemin que le mutant si-faux du même if, qui rend null. |
| `src/moteur/diagnostic.js:408:22` | corps-si | `return null;` | `{}` | diagnostic.js, ecartItineraire, if (mobile === -1) {} : même chemin que le mutant si-faux du même if — chaque table pleine d'ancrés est sautée, et la fonction rend null. |
| `src/moteur/diagnostic.js:427:45` | frontiere | `<` | `<=` | diagnostic.js, ecartItineraire, ecartPassant <= plancher : à égalité la même valeur est réécrite dans plancher. |
| `src/moteur/diagnostic.js:450:37` | nombre-plus-un | `0` | `1` | diagnostic.js, objectifsInevitables, parTour rempli de 1 : la boucle des tours écrit parTour[r] pour chaque r de 0 à R − 1 avant toute lecture. |
| `src/moteur/diagnostic.js:454:23` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, r <= R dans le cumul des sièges libres par tour : au tour de trop, l'écriture vise libresAuTour[R], hors de l'Int32Array de longueur R, et un tableau typé l'ignore sans lever ; les lectures de objectifDe et siegesLibres à t × R + R ne lèvent pas, et la suite ne lit libresAuTour qu'aux r < R. |
| `src/moteur/diagnostic.js:463:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le marquage des personnes : possible[N·R + r] et fixe[N·R + r] sont undefined, donc la branche else écrit servieDOffice[N], hors des éléments d'un Uint8Array de longueur N, ce qui n'écrit rien. |
| `src/moteur/diagnostic.js:467:31` | nombre-plus-un | `1` | `2` | diagnostic.js, objectifsInevitables, servieDOffice[p] = 2 : la marque ne se lit que par servieDOffice[p] === 0. |
| `src/moteur/diagnostic.js:472:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le compte des concernées : aUnTourLibre[N] est undefined, différent de 1 ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:479:23` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le compte par tour : possible[N·R + r] est undefined, différent de 0, et fixe[N·R + r] undefined est différent de LIBRE, donc continue ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:502:16` | frontiere | `<` | `<=` | diagnostic.js, etendue, valeur <= min : à égalité la même valeur est réécrite dans min. |
| `src/moteur/diagnostic.js:503:16` | frontiere | `>` | `>=` | diagnostic.js, etendue, valeur >= max : à égalité la même valeur est réécrite dans max. |
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
| `src/moteur/indicateurs.js:193:45` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, rencontre rempli de −2 au lieu de −1 : la marque ne se lit que par rencontre[f] === p, p ≥ 0 ; ni −1 ni −2 n'égale une personne. |
| `src/moteur/indicateurs.js:223:21` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, visites[t] += 2 au lieu de 1 : visites[t] ne se lit que par visites[t] > 0 et se remet à 0 après chaque personne ; un pas de 2 garde le signe, aucune sortie ne change. |
| `src/moteur/indicateurs.js:224:40` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, reserveeAvant[t] = 2 au lieu de 1 : la marque ne se lit que par reserveeAvant[t] === 0. |
| `src/moteur/indicateurs.js:226:23` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, remise à zéro jusqu'à r <= R : le tour de trop lit la première case de la personne suivante, dont la table vaut 0 dans visites et reserveeAvant sauf si la personne courante l'a visitée, auquel cas la boucle la remet à 0 de toute façon ; pour la dernière personne la case est undefined, et une écriture à l'index undefined pose une propriété hors des éléments du tableau typé, que rien ne lit. |
| `src/moteur/indicateurs.js:228:11` | si-faux | `t === RESERVE` | `false` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:228:26` | corps-si | `continue;` | `{}` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:257:25` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, i <= liste.length : le tour de trop lit a = undefined ; revenu[NaN] et fixe[NaN] sont undefined, rien n'est poussé, et la boucle intérieure part de j = length + 1, au-delà de la liste. |
| `src/moteur/indicateurs.js:262:31` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, j <= liste.length : le tour de trop lit b = undefined ; k = rangPaire(N, a, undefined) vaut NaN, parPaire[NaN] et libre[NaN] n'écrivent rien sur un tableau typé, groupe[undefined] n'égale aucun groupe et parPaire[NaN] >= 2 est faux : ni collègue ni revue n'est poussé. |
| `src/moteur/indicateurs.js:314:23` | nombre-plus-un | `1` | `2` | indicateurs.js, lirePaires, vu[p * G + g] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:319:21` | frontiere | `<` | `<=` | indicateurs.js, lirePaires, i <= reunies.length : reunies a une longueur paire, le tour de trop lit a = b = undefined. rencontres[undefined] et affilies[undefined] posent une propriété « undefined » sur l'Int32Array, que Array.from (mesurer) ne lit pas ; groupe[undefined] n'égale pas SANS_GROUPE, mais vu[NaN] se lit undefined, jamais === 0 ; n = parPaire[NaN] est undefined, ni > maxRencontresPaire ni >= 2. |
| `src/moteur/indicateurs.js:325:11` | frontiere | `>` | `>=` | indicateurs.js, lirePaires, n >= maxRencontresPaire : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/indicateurs.js:337:32` | arithmetique | `-` | `+` | indicateurs.js, lireTours, nombrePaires = N(N + 1)/2 : ne dimensionne que collegueVu et revueVue, indexés par rangPaire, toujours < N(N − 1)/2 ; un tableau plus long garde les mêmes cases utiles, les autres ne se lisent jamais. |
| `src/moteur/indicateurs.js:337:34` | nombre-zero | `1` | `0` | indicateurs.js, lireTours, nombrePaires = N·N/2 : même raison que N(N + 1)/2 — une longueur au moins égale (tronquée à l'entier par le constructeur du tableau typé) pour des index rangPaire < N(N − 1)/2. |
| `src/moteur/indicateurs.js:337:38` | arithmetique | `/` | `*` | indicateurs.js, lireTours, nombrePaires = 2N(N − 1) : longueur au moins égale à N(N − 1)/2, mêmes cases utiles, les autres jamais lues. |
| `src/moteur/indicateurs.js:351:27` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, collegueVu[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:358:25` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, revueVue[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:370:48` | nombre-plus-un | `0` | `1` | indicateurs.js, VIDE.somme = 1 : la somme de VIDE ne se lit jamais. ajouter ouvre un cumul neuf sans la lire, et conclure ne la lit que pour un effectif non nul ; VIDE a un effectif nul et rend moyenne null. |
| `src/moteur/indicateurs.js:377:14` | frontiere | `<` | `<=` | indicateurs.js, ajouter, valeur <= min : à égalité, le minimum retenu est la même valeur ; aucune valeur agrégée ne vaut −0 (comptes entiers, différences de comptes, quotient A/\|F\| à \|F\| > 0). |
| `src/moteur/indicateurs.js:410:21` | frontiere | `<` | `<=` | indicateurs.js, mesurer, p <= N au compte des effectifs : groupe[N] est undefined, différent de SANS_GROUPE ; effectifs[undefined] += 1 pose une propriété « undefined » sur un tableau ordinaire, et parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:418:15` | nombre-plus-un | `0` | `1` | indicateurs.js, lireObjectifs, auMax part de 1 : quand E reste à 0, personnesAuMax vaut 0 quelle que soit la valeur ; sinon E a grandi au moins une fois, chaque croissance remet auMax à 0, et seuls comptent les incréments qui suivent la dernière : la valeur initiale ne survit jamais. |
| `src/moteur/indicateurs.js:453:21` | frontiere | `<` | `<=` | indicateurs.js, lireAnimateurs, p <= N au compte des concernés : borneAnimateurs[N] est undefined, et undefined > 0 est faux ; concernes ne bouge pas. |
| `src/moteur/indicateurs.js:499:21` | frontiere | `<` | `<=` | indicateurs.js, mesurer, p <= N au compte des effectifs : groupe[N] est undefined, différent de SANS_GROUPE ; effectifs[undefined] += 1 pose une propriété « undefined » sur un tableau ordinaire, et parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:500:9` | si-vrai | `groupe[p] !== SANS_GROUPE` | `true` | indicateurs.js, mesurer, if (true) au compte des effectifs : une personne sans appartenance incrémente effectifs[SANS_GROUPE], soit effectifs[−1], propriété hors des index d'un tableau ordinaire ; parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:552:21` | frontiere | `<` | `<=` | indicateurs.js, assisAChaqueTourPresent, p <= N : toursAssis (mesures.toursAssis) et toursPresents (l'Int32Array de l'instance) ont N cases ; à p = N, les deux lectures valent undefined, donc égales, et la boucle finit et rend vrai comme sans le tour de trop. |
| `src/moteur/manque.js:91:64` | frontiere | `>` | `>=` | manque.js, plusGrand, valeur >= cumul : à égalité, le cumul retenu est la même valeur. |
| `src/moteur/manque.js:233:82` | arithmetique | `-` | `+` | manque.js, profilManque, départage a.id + b.id : à manque et plafond réalisé égaux, le comparateur rend un nombre positif. Le tri de V8 ne lit que « < 0 » et est stable : un positif s'y lit comme 0, et l'ordre reçu reste, celui de instance.ids, que normaliser trie par identifiant croissant et sans doublon — l'ordre de a.id − b.id. Une liste reçue dans un autre ordre ne peut pas se construire : profilManque parcourt instance.ids. |
| `src/moteur/manque.js:315:34` | frontiere | `<` | `<=` | manque.js, comparerProfils, difference <= 0 : la ligne ne s'atteint que pour difference !== 0, où <= 0 et < 0 coïncident. |
| `src/moteur/manque.js:315:36` | nombre-plus-un | `0` | `1` | manque.js, comparerProfils, difference < 1 : un manque est un entier (plafond réalisé − rencontres, deux comptes), et la ligne ne s'atteint que pour difference !== 0 : < 1 et < 0 coïncident. |
| `src/moteur/manque.js:315:41` | nombre-plus-un | `1` | `2` | manque.js, comparerProfils, signeRang = −2 au lieu de −1 : signeRang ne se lit que par < 0 et par comparaison à signe, qui reçoit les mêmes valeurs ; signe ne se rend pas. |
| `src/moteur/manque.js:315:45` | nombre-plus-un | `1` | `2` | manque.js, comparerProfils, signeRang = 2 au lieu de 1 : signeRang ne se lit que par < 0 et par comparaison à signe, qui reçoit les mêmes valeurs ; signe ne se rend pas. |
| `src/moteur/manque.js:316:19` | frontiere | `<` | `<=` | manque.js, comparerProfils, signeRang <= 0 : signeRang vaut −1 ou 1, jamais 0. |
| `src/moteur/manque.js:316:21` | nombre-plus-un | `0` | `1` | manque.js, comparerProfils, signeRang < 1 : signeRang vaut −1 ou 1 ; < 1 et < 0 coïncident. |
| `src/moteur/manque.js:320:11` | si-vrai | `changements === 1` | `true` | manque.js, comparerProfils, bascule posée à chaque changement : rangBascule ne la rend que pour changements === 1, où la première et la dernière affectation sont la même. |
| `src/moteur/manque.js:342:66` | frontiere | `>` | `>=` | manque.js, plusGrandManque, manque >= plus au lieu de > : à égalité, la valeur retenue est la même. Pour des manques numériques (RangProfil), seul −0 contre 0 peut changer le signe du zéro rendu, et les deux appelants le passent par Math.max avec 0 (escalierDuManque) ou 1 (borneHaute), qui rend le même nombre ; null et NaN sont hors du type des manques. |
| `src/moteur/manque.js:352:38` | nombre-plus-un | `1` | `2` | manque.js, effectifsParValeur, haut + 2 cases : une case de plus au-delà de haut, à 0, jamais écrite (chaque manque vaut au plus haut, le plus grand manque des deux profils) ni lue (escalierDuManque parcourt les valeurs de haut à 0). |
| `src/moteur/manque.js:436:56` | nombre-zero | `1` | `0` | manque.js, borneHaute, plusGrandManque(…) ?? 0 : la valeur de repli ne sert que pour deux profils vides, où Math.max(0, 1) et Math.max(1, 1) valent tous deux 1. |
| `src/moteur/paires.js:54:50` | frontiere | `<` | `<=` | paires.js, compte, a <= b au lieu de a < b : le choix de branche ne change qu'à a = b, où les deux branches calculent rangPaire(N, a, a) ; la valeur lue est la même pour toute entrée. |
| `src/moteur/paires.js:154:21` | frontiere | `<` | `<=` | paires.js, matriceRencontres, boucle extérieure jusqu'à i <= n : au tour de trop, i = n, la boucle intérieure part de j = n + 1 et ne s'exécute pas ; rien n'est écrit. |
| `src/moteur/plafond.js:89:18` | nombre-plus-un | `0` | `1` | plafond.js, affiliesDe, effectif part de 1 : N_aff grandit de 1, et il ne se lit qu'à deux places où un terme plus grand ne mord pas. Dans borne, le terme Σ a^aff_t + min(n^aff_p, S) vaut au plus N_aff − ε_p : un affilié ancré voit au plus k_aff − 1 ancrés affiliés sur ses tables distinctes et n^aff_p = n_aff ; un affilié mobile au plus k_aff, avec n^aff_p = n_aff − 1 ; un non-affilié au plus k_aff, avec n^aff_p = n_aff ; et N_aff = k_aff + n_aff, chaque membre étant ancré ou mobile. Dans borneDiversite, le troisième terme N_aff − g_p + 1 ne descend jamais sous G (chaque appartenance de instance.groupes compte au moins un présent, numeroterGroupes) : plus grand, il ne mord pas davantage. Φ_aff et A_max restent. |
| `src/moteur/plafond.js:94:17` | nombre-plus-un | `1` | `2` | plafond.js, affiliesDe, effectif += 2 : N_aff devient 2·N_aff ≥ N_aff ; même raison que effectif partant de 1 — le premier terme de borne et le troisième terme de A_max ne mordent pas davantage en grandissant. |
| `src/moteur/plafond.js:113:18` | ternaire-vrai | `population.autres === null` | `true` | plafond.js, borne, premier terme effectif − ε pour tout le monde : il devient N − 1 au lieu de C(p), plus grand ou égal, et C(p) ne mord déjà jamais pour tout le monde. Chacun est présent à un tour au moins (PRESENCE_VIDE) et un ancré à chaque tour : les ancrés autres que p sont tous co-présents de p, et C(p) = n_p^C + k − [p ancré] (configuration.js, coPresences). Le terme intérieur vaut au plus Σ a_t sur des tables distinctes, soit k − [p ancré], plus n_p^C : au plus C(p), quel que soit l'itinéraire, même assis à un tour d'absence. Le min extérieur rend le terme intérieur avant comme après. Pour les affiliés, autres est déjà null. |
| `src/moteur/plafond.js:113:67` | arithmetique | `-` | `+` | plafond.js, borne, min(effectif + ε, …) : le premier terme grandit ou reste, et le terme intérieur ne l'atteint déjà jamais. Pour tout le monde, il vaut au plus N − 1 : sur ses tables distinctes, un ancré voit au plus k − 1 ancrés, p exclu, avec n_p = n ; un mobile ou un partiel au plus k, avec n_p = n − 1 ; et n = N − k (configuration.js). Pour les affiliés, il vaut au plus N_aff − ε_p, par le même compte restreint aux affiliés (voir effectif partant de 1 dans affiliesDe). Le min extérieur ne mord jamais. |
| `src/moteur/plafond.js:127:74` | nombre-plus-un | `1` | `2` | plafond.js, ancrageDe, −2 au lieu de −1 pour un non-ancré : l'ancrage ne sert qu'à t === ancrage, où t est un index de table ≥ 0, et à la clé de signature, où −2 remplace −1 pour tous les non-ancrés à la fois : aucune comparaison ni aucun regroupement ne change. |
| `src/moteur/plafond.js:138:21` | frontiere | `<` | `<=` | plafond.js, tablesAdmissibles, t <= T : ancresParTable[T] et capacite[T] sont undefined, undefined < undefined est faux, rien ne s'ajoute. |
| `src/moteur/plafond.js:295:16` | nombre-plus-un | `0` | `1` | plafond.js, borneDiversite, compte des effectifs à partir de p = 1 : effectifs ne se lit que dans le troisième terme de A_max, N_aff − effectifs[g] + 1. Toute mutation qui ne fait que diminuer effectifs[g] laisse ce terme au moins égal à N_aff − g_p + 1, qui ne descend jamais sous G (chaque appartenance de instance.groupes compte au moins un présent) : min(Φ_aff, G, terme) vaut min(Φ_aff, G) avant comme après. Sauter la personne 0 diminue un effectif. |
| `src/moteur/plafond.js:295:31` | nombre-plus-un | `1` | `2` | plafond.js, borneDiversite, compte des effectifs par pas de 2 : une personne sur deux est sautée, les effectifs ne font que diminuer ; même raison que le compte à partir de p = 1 — le troisième terme reste au moins N_aff − g_p + 1 ≥ G. |
| `src/moteur/plafond.js:295:38` | si-vrai | `groupe[p] !== SANS_GROUPE` | `true` | plafond.js, borneDiversite, if (true) au compte des effectifs : une personne sans appartenance incrémente effectifs[SANS_GROUPE], soit effectifs[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/plafond.js:295:38` | si-faux | `groupe[p] !== SANS_GROUPE` | `false` | plafond.js, borneDiversite, if (false) au compte des effectifs : tous les effectifs restent à 0, le troisième terme vaut N_aff + 1 ≥ N_aff − g_p + 1 ≥ G ; même raison que le compte à partir de p = 1. |
| `src/moteur/plafond.js:295:48` | negation | `!==` | `===` | plafond.js, borneDiversite, groupe[p] === SANS_GROUPE au compte des effectifs : seules les personnes sans appartenance entrent, à effectifs[−1], qu'un tableau typé n'écrit pas ; les effectifs restent à 0, et le troisième terme, N_aff + 1, ne mord pas (voir if (false)). |
| `src/moteur/plafond.js:295:65` | corps-si | `effectifs[groupe[p]] += 1;` | `{}` | plafond.js, borneDiversite, corps du compte des effectifs vidé : les effectifs restent à 0 ; même raison que if (false). |
| `src/moteur/plafond.js:295:86` | mise-a-jour | `+=` | `-=` | plafond.js, borneDiversite, effectifs[g] −= 1 : chaque effectif devient −g_p, et le troisième terme N_aff + g_p + 1 dépasse N_aff − g_p + 1 ≥ G ; même raison que le compte à partir de p = 1. |
| `src/moteur/plafond.js:295:89` | nombre-zero | `1` | `0` | plafond.js, borneDiversite, effectifs[g] += 0 : les effectifs restent à 0 ; même raison que if (false). |
| `src/moteur/plafond.js:302:15` | ternaire-vrai | `g === SANS_GROUPE` | `true` | plafond.js, borneDiversite, A_max = min(Φ_aff, G) pour chacun : pour un affilié, le troisième terme N_aff − g_p + 1 vaut au moins G, puisque chaque autre appartenance compte au moins un présent (N_aff − g_p ≥ G − 1) ; min(Φ_aff, G, terme) = min(Φ_aff, G). Le terme s'écrit pour que le code se lise contre la formule du § 5.5, comme le dit le commentaire de la fonction. |
| `src/moteur/plafond.js:302:91` | arithmetique | `-` | `+` | plafond.js, borneDiversite, troisième terme N_aff + g_p + 1 : il dépasse N_aff − g_p + 1, qui vaut déjà au moins G ; le min reste min(Φ_aff, G) (voir A_max = min(Φ_aff, G) pour chacun). |
| `src/moteur/plafond.js:302:108` | nombre-plus-un | `1` | `2` | plafond.js, borneDiversite, troisième terme N_aff − g_p + 2 : plus grand d'un que N_aff − g_p + 1, qui vaut déjà au moins G ; le min reste min(Φ_aff, G). |
| `src/moteur/plafond.js:325:38` | si-vrai | `fixe[p * R + r] !== LIBRE` | `true` | plafond.js, signature, chaque case poussée, LIBRE comprise : le nombre de cases LIBRE vaut R moins le nombre de tours fixés, que le multiensemble des tables fixées donne déjà ; deux clés sont égales sous le mutant si et seulement si elles le sont sans lui. |
| `src/moteur/plafond.js:326:27` | arithmetique | `-` | `+` | plafond.js, signature, tri par x + y : le tri ne sert qu'à rendre la clé indépendante de l'ordre des tours. Un ordre faux peut séparer deux rangées de même multiensemble en deux clés, jamais réunir deux multiensembles distincts — la clé garde ses éléments — : la valeur mémoïsée reste exacte, seul le partage se perd. |
| `src/moteur/plafond.js:369:14` | nombre-plus-un | `0` | `1` | plafond.js, maximiser, vMax part de 1 : vMax ne sert qu'à W, qui grandit ou reste. Tout W' ≥ W rend le même plafond : sans écrêtage (W' ≥ f·vMax) la programmation dynamique est exacte, et un écrêtage à W' ≥ cap ne fond que des états où min(n_p, sieges0 + w) vaut déjà n_p. |
| `src/moteur/plafond.js:371:31` | nombre-plus-un | `0` | `1` | plafond.js, maximiser, W = min(max(1, nPMax − sieges0), f·vMax) : W grandit ou reste (de 0 à 1 quand nPMax ≤ sieges0), sans dépasser f·vMax. Tout W' entre W et f·vMax rend le même plafond : à W = f·vMax rien n'est écrêté ; sinon un état à w ≥ W porte sieges0 + w ≥ nPMax ≥ n_p^C pour chaque membre de la signature, où min(n_p^C, sieges0 + w) vaut déjà n_p^C. L'état écrêté garde la plus grande somme d'ancrés des états qu'il fond, la lecture prend le maximum sur les cases, et la borne croît avec la somme d'ancrés : séparer ces états ne change pas le maximum. |
| `src/moteur/plafond.js:371:40` | arithmetique | `-` | `+` | plafond.js, maximiser, max(0, nPMax + sieges0) : sieges0 ≥ 0, chaque table fixée à p gardant c_t − 1 − a_t ≥ 0 (normaliser refuse une table qui reçoit plus de personnes fixées que de sièges, SURRESERVATION) ; W grandit ou reste, sans dépasser f·vMax ; même raison que max(1, nPMax − sieges0). |
| `src/moteur/plafond.js:372:23` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, largeur = W + 2 : une colonne de plus par rangée, jamais écrite (cible ≤ W) ni lue (w ≤ W) ; chaque état garde une case distincte. |
| `src/moteur/plafond.js:373:38` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, (f + 2) × largeur cases : une rangée de plus en fin de tableau, jamais lue ni écrite (s + m ≤ f). |
| `src/moteur/plafond.js:373:58` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, fill(−2) : le marqueur d'état inatteignable ne se lit que par < 0 et >= 0, et tout atteint + gain ≥ 0 le dépasse ; −2 se comporte comme −1. |
| `src/moteur/plafond.js:379:23` | frontiere | `<` | `<=` | plafond.js, maximiser, s <= f : à s = f, la boucle sur m (s + m ≤ f) ne tourne pas. |
| `src/moteur/plafond.js:385:30` | frontiere | `>` | `>=` | plafond.js, maximiser, atteint + gain >= suivant[cible] : à égalité, l'affectation écrit la valeur déjà présente. |
| `src/moteur/plafond.js:391:74` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, subarray(f·largeur, (f + 2)·largeur) : meilleur compte (f + 1)·largeur cases, et subarray ramène une fin au-delà de la longueur à la longueur : la même vue de la dernière rangée. |
| `src/moteur/plafond.js:398:60` | nombre-plus-un | `1` | `2` | plafond.js, lireProgramme, mobilesRencontrables(…, 2) : lireProgramme ne reçoit que la population de tout le monde (plafondsEtProgrammes), dont mobilesVus n'est jamais null ; ε ne se lit que dans l'autre branche, et n_p^C reste mobilesVus[p]. |
| `src/moteur/plafond.js:398:60` | nombre-zero | `1` | `0` | plafond.js, lireProgramme, mobilesRencontrables(…, 0) : même raison que (…, 2) — pour tout le monde, mobilesVus n'est pas null, ε ne se lit pas, n_p^C reste mobilesVus[p]. |
| `src/moteur/plafond.js:399:52` | nombre-plus-un | `1` | `2` | plafond.js, lireProgramme, borne(population, p, 2, …) sans tour libre présent ou sans table admissible : borne ne lit ε que quand population.autres est null ; pour tout le monde, autres vaut instance.coPresents, et le premier terme reste C(p). |
| `src/moteur/plafond.js:399:52` | nombre-zero | `1` | `0` | plafond.js, lireProgramme, borne(population, p, 0, …) sans tour libre présent ou sans table admissible : même raison que ε = 2 — pour tout le monde, borne ne lit pas ε, le premier terme reste C(p). |
| `src/moteur/plafond.js:400:18` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, plafond part de −2 : l'état (f, W) est toujours atteint — la table de plus grand v prise f fois — avec une somme d'ancrés ≥ 0, et sa borne vaut au moins 0 ; le maximum ne dépend pas de la valeur initiale, pourvu qu'elle ne dépasse pas 0. |
| `src/moteur/plafond.js:400:18` | nombre-zero | `1` | `0` | plafond.js, maximiser, plafond part de −0 : même raison que −2 — un état atteint donne une borne x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:401:21` | frontiere | `<` | `<=` | plafond.js, lireProgramme, w <= rangee.length : rangee[rangee.length] est undefined sur un tableau typé, undefined >= 0 est faux, rien ne s'ajoute. |
| `src/moteur/plafond.js:403:9` | si-vrai | `ajout >= 0` | `true` | plafond.js, maximiser, if (true) sur ajout >= 0 : un état inatteignable porte −1, soit ancres0 − 1, à un w ≤ W ; l'état (f, W) est atteint avec une somme ≥ 0, et la borne, croissante en ses deux termes, y vaut au moins autant : un état inatteignable ne l'emporte jamais. |
| `src/moteur/plafond.js:403:70` | nombre-plus-un | `1` | `2` | plafond.js, lireProgramme, borne(population, p, 2, …) à chaque case atteinte : borne ne lit ε que quand population.autres est null ; pour tout le monde, le premier terme reste C(p). |
| `src/moteur/plafond.js:403:70` | nombre-zero | `1` | `0` | plafond.js, lireProgramme, borne(population, p, 0, …) à chaque case atteinte : même raison que ε = 2 — pour tout le monde, borne ne lit pas ε. |
| `src/moteur/plafond.js:424:62` | nombre-plus-un | `1` | `2` | plafond.js, plafondsEtProgrammes, mobilesRencontrables(…, 2) au relevé de nPMax : la population est celle de tout le monde, mobilesVus n'est pas null, ε ne se lit pas, et n_p^C reste mobilesVus[p] ; nPMax ne change pas. |
| `src/moteur/plafond.js:424:62` | nombre-zero | `1` | `0` | plafond.js, plafondsEtProgrammes, mobilesRencontrables(…, 0) au relevé de nPMax : la population est celle de tout le monde, mobilesVus n'est pas null, ε ne se lit pas, et n_p^C reste mobilesVus[p] ; nPMax ne change pas. |
| `src/moteur/plafond.js:426:35` | frontiere | `>` | `>=` | plafond.js, plafondsEtProgrammes, nP >= connu : à égalité, set écrit la valeur déjà présente. |
| `src/moteur/plafond.js:440:9` | si-vrai | `plafond === undefined` | `true` | plafond.js, plafondsEtProgrammes, if (true) à la lecture : chaque personne relit le programme de sa signature au lieu de reprendre la lecture gardée sous la même signature, le même C(p) et le même n_p^C ; lireProgramme ne lit que ces trois données, la valeur est la même et seul le partage se perd — une performance seule. Le nombre de programmes rendu ne dépend pas des lectures. |
| `src/moteur/plafond.js:498:21` | frontiere | `<` | `<=` | plafond.js, enumerer, r <= R : itineraire[R] est undefined sur un Int32Array de R cases, qui n'égale pas LIBRE ; la conjonction s'arrête là et aucun tour libre ne s'ajoute. |
| `src/moteur/plafond.js:515:18` | nombre-plus-un | `1` | `2` | plafond.js, enumerer, plafond part de −2 : au moins un itinéraire s'évalue (f > 0 et A > 0), et son plafond est ≥ 0 ; la valeur initiale ne l'emporte jamais. |
| `src/moteur/plafond.js:515:18` | nombre-zero | `1` | `0` | plafond.js, enumerer, plafond part de −0 : au moins un itinéraire s'évalue, de plafond x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:517:23` | frontiere | `<` | `<=` | plafond.js, enumerer, i <= f : libres[f] est undefined ; itineraire[undefined] = … pose une propriété hors des index de l'Int32Array, que plafondItineraire ne lit pas (il lit length et les index 0 à R − 1). |
| `src/moteur/plafond.js:523:22` | nombre-zero | `1` | `0` | plafond.js, enumerer, j = i + 0 : le premier tour écrit choix[i] = choix[i], sans effet ; les tours suivants sont ceux du code. |
| `src/moteur/plafond.js:523:27` | frontiere | `<` | `<=` | plafond.js, enumerer, j <= f : choix[f] est hors d'un Int32Array de f cases ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/plafond.js:552:9` | si-vrai | `plafond === undefined` | `true` | plafond.js, plafondsAPrioriParEnumeration, if (true) : le plafond se recalcule pour chaque personne au lieu d'être repris de sa rangée ; même valeur, seule la mémoïsation de l'oracle se perd, et l'oracle n'a pas de budget de temps. |
| `src/moteur/qualite.js:185:57` | nombre-plus-un | `0` | `1` | qualite.js, repartition, cumul: 1 au lieu de 0 à la création d'une ligne : la seconde boucle affecte ligne.cumul à chaque ligne avant le retour, et la clé cumul garde sa place dans l'objet ; la valeur initiale ne se lit jamais. |
| `src/moteur/qualite.js:550:40` | nombre-plus-un | `1` | `2` | qualite.js, barresCollisions, comparer rend -2 au lieu de -1 : la valeur ne se lit que par \|\| (non nulle dans les deux cas) et par le tri, qui n'en retient que le signe. |
| `src/moteur/qualite.js:550:52` | nombre-plus-un | `1` | `2` | qualite.js, barresCollisions, comparer rend 2 au lieu de 1 : la valeur ne se lit que par \|\| (non nulle dans les deux cas) et par le tri, qui n'en retient que le signe. |
| `src/moteur/qualite.js:593:38` | nombre-plus-un | `1` | `2` | qualite.js, mixTables, vu rempli de -2 au lieu de -1 : vu[b] ne se lit que par vu[b] === jeton, et jeton = t · R + r vaut 0 au moins ; ni -1 ni -2 ne l'égale. |
| `src/moteur/qualite.js:680:19` | nombre-plus-un | `0` | `1` | qualite.js, objectifsParTour, pireReste initialisé à 1 au lieu de 0 : pireReste ne se lit que dans pireTour === null \|\| reste > pireReste ; au premier tour lu pireTour vaut null, le \|\| ne lit pas pireReste, et la même branche l'affecte à reste. |
| `src/moteur/recherche.js:292:20` | nombre-plus-un | `0xffff` | `65536` | recherche.js, UINT16_MAX = 65 536 : seul R = 65 536 change de tableau, et un Uint16Array y reste exact. Le compte d'une paire va de 0 à R ; modifierPaire ne le lit que par avant !== 0 à un ajout et apres !== 0 à un retrait. Un compte vrai de 65 536 se range 0, mais un ajout depuis 65 536 ou un retrait depuis 65 537 exigent R ≥ 65 537 : le compte rangé modulo 2^16 donne toujours la même décision. |
| `src/moteur/recherche.js:292:20` | nombre-zero | `0xffff` | `0` | recherche.js, UINT16_MAX = 0 : R ≥ 1 donne toujours un Uint32Array à paires, qui tient tout compte de 0 à R ; mêmes valeurs lues, seule la mémoire double. paires n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:295:19` | nombre-plus-un | `0xff` | `256` | recherche.js, UINT8_MAX = 256 : seul R = 256 change de tableau, et un Uint8Array y reste exact. Le compte d'un couple (personne, animateur) va de 0 au nombre de tours où l'animateur anime, ≤ R ; changerAnimateurs ne le lit que par avant === 0 à un ajout et avant === 1 à un retrait. Confondre 256 avec 0, ou 257 avec 1, exige un ajout depuis 256 ou un retrait depuis 257, donc R ≥ 257. |
| `src/moteur/recherche.js:295:19` | nombre-zero | `0xff` | `0` | recherche.js, UINT8_MAX = 0 : R ≥ 1 donne toujours un Uint32Array à rencontresAnimees, qui tient tout compte de 0 à R ; mêmes valeurs, seule la largeur des éléments change, que rien ne lit. |
| `src/moteur/recherche.js:310:20` | nombre-plus-un | `11` | `12` | recherche.js, REDONDANCE = 12 au lieu de 11 : le code n'est lu que par lire, où Σ r(p) est la branche default du switch ; 12, distinct des onze autres codes, y tombe comme 11, et ANIMATEURS (10) n'est comparé qu'à lui-même. |
| `src/moteur/recherche.js:444:36` | nombre-plus-un | `1` | `2` | recherche.js, preparer, debut de longueur T + 2 : la boucle ne remplit que debut[0..T], la case T + 1 reste 0 ; preparer, voisiner, remplisseur et etatInitial ne lisent debut[t + 1] que pour t < T. debut n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:445:21` | frontiere | `<` | `<=` | recherche.js, preparer, t <= T au calcul de debut : le tour de trop écrit debut[T + 1] = debut[T] + capacite[T], soit NaN à un index hors d'un Int32Array de longueur T + 1, qui n'écrit rien. |
| `src/moteur/recherche.js:448:16` | nombre-plus-un | `0` | `1` | recherche.js, preparer, tableDuSiege rempli à partir de t = 1 : les sièges de la table 0 gardent la valeur initiale d'un Int32Array neuf, 0, l'index de leur table. |
| `src/moteur/recherche.js:448:21` | frontiere | `<` | `<=` | recherche.js, preparer, t <= T au remplissage de tableDuSiege : le tour de trop fait fill(T, debut[T], undefined), soit de S à la fin d'un tableau de longueur S : aucune case. |
| `src/moteur/recherche.js:448:75` | nombre-plus-un | `1` | `2` | recherche.js, preparer, fill(t, debut[t], debut[t + 2]) : la table t déborde sur les sièges de t + 1, que l'itération suivante récrit à t + 1 ; au dernier tour, debut[T + 1] est undefined et fill va jusqu'à la fin, qui est debut[T] : mêmes cases finales. |
| `src/moteur/recherche.js:458:21` | frontiere | `<` | `<=` | recherche.js, preparer, r <= R : au tour de trop, fixe[p × R + R] lit la case du tour 0 de la personne suivante (undefined pour la dernière) ; une personne fixée y écrit siegesFixes et mobiles à des index ≥ R × S, hors des tableaux typés, qui n'écrivent rien, occupes est remis à zéro en tête de chaque tour, nombreMobiles[R] est hors du tableau, et libres reçoit une R + 1e liste que etatInitial et remplisseur ne lisent pas (r < R). |
| `src/moteur/recherche.js:461:23` | frontiere | `<` | `<=` | recherche.js, preparer, p <= N aux sièges fixés : fixe[N × R + r] est undefined, différent de LIBRE ; siegesFixes[r × S + debut[undefined] + occupes[undefined]] est un index NaN, qui n'écrit rien dans un tableau typé, et occupes[undefined] += 1 pose une propriété « undefined » que rien ne lit. |
| `src/moteur/recherche.js:485:21` | frontiere | `<` | `<=` | recherche.js, preparer, p <= N au seuil des retours : fixe[N × R + r] est undefined, différent de LIBRE, et seuilRetour[N × T + undefined] += 1 vise l'index NaN, qui n'écrit rien dans un tableau typé. |
| `src/moteur/recherche.js:491:21` | frontiere | `<` | `<=` | recherche.js, preparer, i <= seuilRetour.length : seuilRetour[length] est undefined, jamais === 0, rien n'est écrit. |
| `src/moteur/recherche.js:496:19` | nombre-plus-un | `0` | `1` | recherche.js, preparer, plusGrand part de 1 : largeurHistogramme ne vaut 2 au lieu de 1 que si tous les plafonds a priori sont nuls ; l'histogramme des écarts n'est indexé que par des écarts de 0 à aPriori[p], la case de plus reste 0 et ne se lit pas. histogramme n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:515:37` | nombre-plus-un | `1` | `2` | recherche.js, preparer, largeurHistogramme = plusGrand + 2 : un histogramme d'une case de plus, jamais indexée (écarts de 0 à aPriori[p] ≤ plusGrand) ; mêmes valeurs lues. |
| `src/moteur/recherche.js:532:13` | frontiere | `>` | `>=` | recherche.js, changerRencontres, apres >= ecartMax : à égalité, l'affectation écrit la valeur déjà retenue ; la branche else-if qu'elle court-circuite exige avant === ecartMax, impossible quand apres === ecartMax puisque avant = apres + sens, sens = ±1. |
| `src/moteur/recherche.js:548:23` | frontiere | `>` | `>=` | recherche.js, changerAffilie, sens >= 0 : modifierPaire ne passe que sens = 1 ou −1, jamais 0 ; les deux tests départagent les mêmes valeurs. |
| `src/moteur/recherche.js:564:15` | frontiere | `<` | `<=` | recherche.js, modifierPaire, a <= b : modifierPaire n'est appelé que pour a ≠ b (voisiner saute le siège exclu, etatInitial ne lit que les sièges avant s, chacun porte une autre personne), où <= et < coïncident. |
| `src/moteur/recherche.js:564:15` | negation | `<` | `>=` | recherche.js, modifierPaire, k = a >= b ? a × N + b : b × N + a : chaque paire reçoit toujours la case max × N + min au lieu de min × N + max ; l'index reste canonique, et paires ne se lit et ne s'écrit que par cette ligne. paires n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:572:13` | frontiere | `>` | `>=` | recherche.js, modifierPaire, sens >= 0 : sens vaut 1 ou −1 (voisiner, etatInitial), jamais 0. |
| `src/moteur/recherche.js:597:27` | frontiere | `>` | `>=` | recherche.js, changerServis, sens >= 0 : changerTable ne l'appelle qu'avec ecart ≠ 0, différence de deux valeurs de sert dans {0, 1}, donc ±1. |
| `src/moteur/recherche.js:598:13` | frontiere | `>` | `>=` | recherche.js, changerServis, apres >= horsObjectifMax : à égalité, l'affectation écrit la valeur déjà retenue ; la branche else-if exige avant === horsObjectifMax, impossible quand apres === horsObjectifMax puisque avant = apres + sens, sens = ±1. |
| `src/moteur/recherche.js:626:25` | frontiere | `>` | `>=` | recherche.js, changerAnimateurs, sens >= 0 : echanger, par changerTable, et etatInitial ne passent que sens = 1 ou −1. |
| `src/moteur/recherche.js:637:7` | si-vrai | `etat.O > 0` | `true` | recherche.js, changerTable, if (true) au lieu de etat.O > 0 : O, le nombre d'objectifs distincts, vaut 0 seulement quand la configuration n'en a aucun ; numeroterObjectifs (configuration.js) écrit alors SANS_OBJECTIF dans chaque case d'objectifDe, sert rend 0 aux deux tables, l'écart est nul et changerServis n'est pas appelé. Le test n'épargne que du temps. |
| `src/moteur/recherche.js:637:14` | frontiere | `>` | `>=` | recherche.js, changerTable, etat.O >= 0 : toujours vrai, même effet que if (true) — sans objectif, objectifDe ne porte que SANS_OBJECTIF, sert rend 0 et l'écart est nul ; seul le temps change. |
| `src/moteur/recherche.js:639:9` | si-vrai | `ecart !== 0` | `true` | recherche.js, changerTable, changerServis appelé même pour un écart nul : avec sens = 0, avant = apres, servis et horsObjectif ne bougent pas, l'histogramme perd puis regagne la même case, jamaisServies -= 0 ; apres > max est faux (apres = avant ≤ max), le else-if ne réécrit max qu'à sa propre valeur, et personnesAuMax se recalcule des mêmes valeurs. Une personne non concernée a s(p) = 0 (une table qui la sert rendrait le tour possible) et avant = 0. |
| `src/moteur/recherche.js:662:9` | si-faux | `s === exclu` | `false` | recherche.js, voisiner, sans le saut du siège exclu : avant l'échange, le siège exclu porte p, qui modifie la paire (p, p) de −1 ; après, il porte p de nouveau à son siège d'arrivée, qui la modifie de +1. Le tableau non signé passe de 0 au maximum puis revient à 0 ; à −1, apres = −1 ≠ 0 compte une répétition retirée, à +1, avant ≠ 0 en rend une : excedentPaires, et collisions cumulées et excédent pour une personne à appartenance, reviennent à leur valeur dans le même échange, avant toute lecture du score, et rencontres comme affiliés ne bougent pas. |
| `src/moteur/recherche.js:662:22` | corps-si | `continue;` | `{}` | recherche.js, voisiner, if (s === exclu) {} : même effet que la suppression du test — la paire (p, p) reçoit −1 avant l'échange et +1 après, dans le même échange ; le tableau non signé revient à 0 et chaque compteur à sa valeur avant toute lecture. |
| `src/moteur/recherche.js:748:13` | ternaire-faux | `R <= UINT16_MAX` | `false` | recherche.js, etatInitial, paires toujours en Uint32Array : il tient tout compte de 0 à R ; mêmes valeurs lues, seule la mémoire double. |
| `src/moteur/recherche.js:748:15` | frontiere | `<=` | `<` | recherche.js, etatInitial, R < UINT16_MAX : seul R = 65 535 passe à un Uint32Array, qui tient les mêmes comptes ; seule la mémoire change. |
| `src/moteur/recherche.js:769:46` | nombre-plus-un | `1` | `2` | recherche.js, etatInitial, histogrammeObjectifs de longueur R + 2 : il n'est indexé que par P(p) − s(p), de 0 à P(p) ≤ R ; la case de plus reste 0 et ne se lit pas. histogrammeObjectifs n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:773:21` | nombre-plus-un | `0` | `1` | recherche.js, etatInitial, personnesAuMax: 1 à la création de l'état : la valeur est récrite sans condition en fin d'etatInitial, avant tout retour et toute lecture. |
| `src/moteur/recherche.js:784:9` | ternaire-faux | `R <= UINT8_MAX` | `false` | recherche.js, etatInitial, rencontresAnimees toujours en Uint32Array quand l'état suit les animateurs : il tient tout compte de 0 à R ; mêmes valeurs, seule la largeur des éléments change. |
| `src/moteur/recherche.js:784:11` | frontiere | `<=` | `<` | recherche.js, etatInitial, R < UINT8_MAX : seul R = 255 passe à un Uint32Array, qui tient les mêmes comptes ; seule la mémoire change. |
| `src/moteur/recherche.js:786:30` | ternaire-faux | `suitAnimateurs` | `false` | recherche.js, etatInitial, animateursNonRencontres part de null même quand l'état suit les animateurs : la boucle qui suit y ajoute borneAnimateurs[p] pour chaque personne, et null + n vaut n. suitAnimateurs exige le critère non sans objet, donc une borne non nulle et N ≥ 1 : la boucle tourne au moins une fois, et la valeur est la même. |
| `src/moteur/recherche.js:816:11` | si-vrai | `etat.O > 0` | `true` | recherche.js, etatInitial, servis[p] += sert(...) sans le test etat.O > 0 : sans objectif, objectifDe ne porte que SANS_OBJECTIF (configuration.js, numeroterObjectifs), sert rend 0 et la somme ne change pas ; seul le temps change. |
| `src/moteur/recherche.js:816:18` | frontiere | `>` | `>=` | recherche.js, etatInitial, etat.O >= 0 : toujours vrai, même effet que sans test — sans objectif, sert rend 0. |
| `src/moteur/recherche.js:950:9` | si-vrai | `mouvement !== null` | `true` | recherche.js, descendre, évaluation d'un mouvement null : rien n'a changé, le candidat égale le score courant, la première comparaison (<= 0) l'accepte, change vaut faux, courant reçoit sa propre valeur, et retenir ne change rien, la meilleure affectation n'étant jamais pire que le score courant ; defaire n'est pas atteint. |
| `src/moteur/recherche.js:1008:21` | nombre-plus-un | `3` | `4` | recherche.js, EN_RESERVE = −4 au lieu de −3 : la sentinelle n'est écrite que par tableDuDepart, comparée à NON_ASSIS (−2) par !== et lue par t >= 0, puis remplacée par RESERVE au même tour avant que tableDe soit rendu ; toute valeur négative distincte de −2 tient le même rôle. |
| `src/moteur/recherche.js:1026:11` | frontiere | `>` | `>=` | recherche.js, exigerToursFiges, i >= 0 : pour i = 0, toursFiges[−1] est undefined, et tour <= undefined est faux pour tout entier ; aucun refus de plus. |
| `src/moteur/recherche.js:1116:23` | frontiere | `<` | `<=` | recherche.js, tableDuDepart, t <= T au contrôle des capacités : occupants[T] et capacite[T] sont undefined, et undefined > undefined est faux ; aucun refus de plus. |
| `src/moteur/recherche.js:1124:23` | frontiere | `<` | `<=` | recherche.js, tableDuDepart, p <= N au contrôle des absents et des fixés : tableDe[N × R + r] est hors du tableau, undefined, différent de NON_ASSIS ; fixe[N × R + r] aussi, et undefined !== t, t valant undefined, est faux : aucun refus de plus. |
| `src/moteur/recherche.js:1128:29` | corps-si | `{ tableDe[i] = RESERVE; }` | `{}` | recherche.js, tableDuDepart, corps vide pour un absent (tableDe[i] = RESERVE retiré) : la case d'un absent reste NON_ASSIS, mais aucun lecteur ne la lit — remplisseur ne lit tableDe que pour les libres présents (libres[r]), la boucle des libres en trop la compare à t ≥ 0 comme RESERVE, et l'état de recherche refait son tableDe depuis les sièges ; la sortie ne change pas. |
| `src/moteur/recherche.js:1136:13` | si-vrai | `fixee !== LIBRE` | `true` | recherche.js, tableDuDepart, fixee !== LIBRE → true : pour une libre à asseoir, occupants[LIBRE] += 1 écrit à l'index −1 d'un Int32Array, écriture que le tableau typé ignore ; aucun compte de table ne change. |
| `src/moteur/recherche.js:1143:22` | arithmetique | `-` | `+` | recherche.js, tableDuDepart, départ de la boucle des libres en trop à N + 1 au lieu de N − 1 : les deux premiers p lisent tableDe au-delà de N × R, undefined !== t, et continuent sans rien changer ; la boucle reprend à N − 1 comme l'original. |
| `src/moteur/recherche.js:1143:24` | nombre-zero | `1` | `0` | recherche.js, tableDuDepart, départ de la boucle des libres en trop à N au lieu de N − 1 : le premier p lit tableDe au-delà de N × R, undefined !== t, et continue sans rien changer ; la boucle reprend à N − 1 comme l'original. |
| `src/moteur/recherche.js:1166:22` | booleen | `false` | `true` | recherche.js, structureDuDepart, fixeeImposee = true : la copie se fait toujours. Sans réserve imposée fixée, elle égale structure champ pour champ — imposee ne marque que des libres, dont aucune case n'entre dans seuilRetour, et une animatrice est fixée au tour qu'elle anime (deriverAnimateurs), donc aucune n'est retirée des animes — : seule une allocation de plus, sortie anticipée de performance. |
| `src/moteur/recherche.js:1167:21` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, i <= N × R : la case de plus lit imposee[N × R], undefined === 1 faux, et ne change pas fixeeImposee. |
| `src/moteur/recherche.js:1167:42` | si-vrai | `imposee[i] === 1 && fixe[i] !== LIBRE` | `true` | recherche.js, structureDuDepart, condition de fixeeImposee → true : la copie se fait dès que N × R > 0, toujours ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1167:59` | logique | `imposee[i] === 1 && fixe[i] !== LIBRE` | `((imposee[i] === 1 )\|\|( fixe[i] !== LIBRE))` | recherche.js, structureDuDepart, && → \|\| dans la détection : la copie se fait aussi quand une case est fixée ou imposée sans les deux ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1168:7` | si-faux | `!fixeeImposee` | `false` | recherche.js, structureDuDepart, !fixeeImposee → false : la sortie anticipée ne joue jamais, la copie se fait toujours ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1168:22` | corps-si | `return structure;` | `{}` | recherche.js, structureDuDepart, return structure retiré : la copie se fait toujours ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1170:21` | frontiere | `<` | `<=` | recherche.js, scoreComplet, p <= N : tableDe[N × R + r] est hors du tableau, undefined, différent de RESERVE ; occupation[undefined × R + r] vise l'index NaN, qui n'écrit rien dans un tableau typé. |
| `src/moteur/recherche.js:1176:21` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, i <= seuilRetour.length : la case de plus lit seuilRetour au-delà du tableau, undefined === 0 faux, et n'écrit rien. |
| `src/moteur/recherche.js:1179:40` | nombre-plus-un | `1` | `2` | recherche.js, structureDuDepart, debut de T × R + 2 cases : la case de plus vaut 0 et n'est jamais lue — changerAnimateurs ne lit debutAnimes qu'aux lignes 0 à T × R, et ni bornerAnimateurs ni mesurer ne lisent la copie. |
| `src/moteur/recherche.js:1181:29` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, ligne <= T × R : la ligne de plus part de k = debutAnimes[T × R] = animes.length ; k < debutAnimes[T × R + 1], undefined, est faux, aucun animateur n'est parcouru, et debut[T × R + 1] s'écrit hors du tableau typé, écriture ignorée. |
| `src/moteur/recherche.js:1214:25` | frontiere | `<` | `<=` | recherche.js, remplisseur, t <= T : la table de plus part de s = debut[T] = S, s < debut[T + 1] (undefined) est faux, et prochain[T], laisse[T] s'écrivent hors des Int32Array de T cases, écritures ignorées. |
| `src/moteur/recherche.js:1216:18` | frontiere | `<` | `<=` | recherche.js, remplisseur, s <= debut[t + 1] : la boucle ne passe la fin de la table t que si chacun de ses sièges est fixé. Une telle table ne reçoit aucun libre dans un départ contrôlé : ses fixés y sont assis (tableDuDepart refuse un fixé assis ailleurs), ils la remplissent, et un libre de plus la ferait déborder, ce que tableDuDepart refuse. prochain[t] n'y est donc jamais lu. |
| `src/moteur/recherche.js:1229:24` | nombre-zero | `1` | `0` | recherche.js, remplisseur, laisse[t] += 0 : laisse reste sur le siège qu'il vient d'occuper ; le libre suivant de la table le trouve occupé, avance d'un siège dans la boucle while, et prend la même place que l'original. |
| `src/moteur/recherche.js:1281:11` | si-vrai | `choix !== a` | `true` | recherche.js, placerArrivantsFiges, choix !== a → true : quand l'arrivante garde son siège, echanger(etat, r, a, a) retire deux fois puis rajoute deux fois les mêmes voisins, les mêmes visites et les mêmes animateurs ; chaque pas défait exactement le précédent (un compte de paire à 0 passe par 2^16 − 1 ou 2^32 − 1 et revient à 0 sans toucher aux rencontres), et l'état rendu est identique : performance seule. |
| `src/moteur/recherche.js:1305:21` | frontiere | `<` | `<=` | recherche.js, preparerDepart, r <= R dans le relevé des tours tirables : la case de plus lit fige[R], undefined === 0 faux, et n'ajoute aucun tour. |
| `src/moteur/recherche.js:1393:23` | nombre-plus-un | `0` | `1` | recherche.js, repartirUne, graineDerivee part de 1 : exigerReglage impose rang ≥ 1, et la boucle de tirage 1 à rang la récrit au moins une fois avant toute lecture. |
| `src/moteur/recherche.js:1499:23` | nombre-plus-un | `0` | `1` | recherche.js, proposerUne, graineDerivee part de 1 : exigerReglage impose rang ≥ 1, et la boucle de tirage la récrit au moins une fois avant toute lecture. |
| `src/moteur/recherche.js:1595:16` | nombre-plus-un | `0` | `1` | recherche.js, regenerer, dejaFaits: 1 : dans descendre, fait ne sert qu'à la cadence de progression et de lireSignal ; regenerer ne passe ni progression ni signal, l'appel optionnel ne fait rien et lireSignal(undefined) ne lève pas. Le plan ne dépend pas de fait. |
| `src/moteur/recherche.js:1679:21` | frontiere | `<` | `<=` | recherche.js, scoreComplet, p <= N dans le compte des occupations : la personne de plus lit tableDe au-delà de N × R, undefined !== RESERVE, et ajoute 1 à occupation[NaN], écriture qu'un Int32Array ignore ; les réunions ne changent pas. |
| `src/moteur/recherche.js:1682:11` | si-vrai | `t !== RESERVE` | `true` | recherche.js, scoreComplet, occupation comptée même pour RESERVE : l'état de recherche assied chacun à chaque tour, sans réserve (en-tête, « Sièges » ; nombrePlacesManquantes nul), et tableDe ne s'écrit que dans ce module ; une case RESERVE (−1) viserait de plus l'index −R + r, négatif, qui n'écrit rien dans un Int32Array. |
| `src/moteur/recherche.js:1689:58` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, horsObjectif: 1 par défaut : le défaut ne sert que si mesurer rend objectifs null, c'est-à-dire sans personne concernée (indicateurs.js, lireObjectifs) ; le critère des tours hors objectif est alors sans objet (configuration.js, etatDesCriteres : tous les P(p) nuls), la compilation ne pose aucun terme qui lise cette grandeur, et composer ne la lit pas. |
| `src/moteur/recherche.js:1689:76` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, jamaisServies: 1 par défaut : même raison que horsObjectif — sans personne concernée, le critère des tours hors objectif est sans objet, et aucun terme ne lit jamaisServies. |
| `src/moteur/recherche.js:1689:96` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, horsObjectifMax: 1 par défaut : même raison — sans personne concernée, aucun terme ne lit horsObjectifMax. |
| `src/moteur/recherche.js:1689:115` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, personnesAuMax: 1 par défaut : même raison — sans personne concernée, aucun terme ne lit personnesAuMax. |
| `src/moteur/recherche.js:1702:67` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, animateursNonRencontres ?? 1 : le défaut ne sert que si mesurer rend animateurs null, c'est-à-dire quand aucune borne des animateurs n'est non nulle (indicateurs.js, lireAnimateurs) ; le critère est alors sans objet (configuration.js, etatDesCriteres), et aucun terme ne lit la grandeur. |
| `src/moteur/verification.js:42:21` | nombre-plus-un | `2` | `3` | verification.js, SANS_TABLE = -3 au lieu de -2 : la constante ne se compare qu'à elle-même (t !== SANS_TABLE) et à une case de instance.fixe, Int32Array qui ne porte que LIBRE (-1) ou un index de table (0 au moins) ; ni -2 ni -3 n'en est un. |
| `src/moteur/verification.js:210:17` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, compter rend -2 au lieu de -1 pour un id étranger : le résultat ne se lit que par p < 0, vrai pour les deux, et l'appel sur la réserve l'ignore. |
| `src/moteur/verification.js:217:17` | ternaire-vrai | `i < tableDeListe.length` | `true` | verification.js, verifierInvariants, t = tableDeListe[i] sans le repli SANS_TABLE : pour une liste au-delà de plan.tables, t vaut undefined au lieu de -2 ; t ne se lit que par fixe[p · R + r] === t, case d'un Int32Array dans ses bornes (p < N, r < R), toujours un nombre, qui n'égale ni undefined ni -2. |
| `src/moteur/verification.js:217:19` | frontiere | `<` | `<=` | verification.js, verifierInvariants, i <= tableDeListe.length au lieu de < : à i = tableDeListe.length, t vaut tableDeListe[i], undefined, au lieu de SANS_TABLE ; t ne se lit que par fixe[p · R + r] === t, case d'un Int32Array dans ses bornes, toujours un nombre, qui n'égale ni undefined ni -2. |
| `src/moteur/verification.js:220:13` | si-faux | `p < 0` | `false` | verification.js, verifierInvariants, sans le continue d'un id étranger (p = -1) : aUneTable[-1] = 1 n'écrit rien, -1 n'étant pas un index d'élément d'un Uint8Array ; fixe[-R + r], r < R, est hors des éléments et vaut undefined, qui n'égale pas t, un nombre : aSaTable n'est pas écrit. |
| `src/moteur/verification.js:220:20` | corps-si | `continue;` | `{}` | verification.js, verifierInvariants, if (p < 0) {} : même effet que la suppression du test, p = -1 ; aUneTable[-1] = 1 n'écrit rien dans un Uint8Array, et fixe[-R + r] vaut undefined, qui n'égale pas t : aSaTable n'est pas écrit. |
| `src/moteur/verification.js:221:24` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, aUneTable[p] = 2 au lieu de 1 : la marque ne se lit que par !aUneTable[p], et fill(0) la remet à zéro à chaque tour. |
| `src/moteur/verification.js:222:50` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, aSaTable[p] = 2 au lieu de 1 : la marque ne se lit que par !aSaTable[p], et fill(0) la remet à zéro à chaque tour. |
| `src/moteur/verification.js:227:44` | frontiere | `<` | `<=` | verification.js, verifierInvariants, boucle des capacités jusqu'à i <= tableDeListe.length : le tour de trop n'a lieu que pour une liste au-delà de plan.tables ; t = tableDeListe[i] vaut undefined, et listes[i].length > capacite[undefined] compare à undefined (propriété absente de l'Int32Array), toujours faux : aucun CAPACITE n'est ajouté. |

## Délais et erreurs (500)

| lieu | opérateur | avant | après | issue |
|---|---|---|---|---|
| `src/moteur/classement.js:155:21` | negation | `<` | `>=` | délai |
| `src/moteur/classement.js:155:35` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/classement.js:155:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/classement.js:281:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:202:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:273:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:309:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:309:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:310:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:310:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:316:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:316:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:321:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:321:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:323:39` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:323:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:326:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:326:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:333:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:333:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:333:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:349:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:378:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:403:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:403:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:403:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:404:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:404:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:409:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:409:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:409:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:410:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:410:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:436:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:436:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:436:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:440:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:440:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:494:34` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:508:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:508:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:508:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:509:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:509:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:530:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:539:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:544:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:544:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:546:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:546:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:546:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:550:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:550:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:550:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:558:27` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:558:31` | logique | `o < O && !oui` | `((o < O )\|\|( !oui))` | délai |
| `src/moteur/configuration.js:558:42` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:558:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:582:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:604:29` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:604:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:604:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:632:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:632:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:634:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:634:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:638:29` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:638:38` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:638:41` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:645:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:645:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:649:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:649:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:662:46` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:662:78` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:662:81` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1011:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1020:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1024:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:1024:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:1024:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1056:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1086:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1091:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1112:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:1112:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:1112:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1167:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:1167:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:1167:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:115:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:115:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:115:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:117:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:117:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:117:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:121:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:121:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:142:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:144:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:147:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:147:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:184:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:184:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:186:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:186:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:198:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:198:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:198:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:314:45` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/diagnostic.js:314:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:342:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:342:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:342:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:344:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:344:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:348:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:348:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:348:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:413:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:453:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:453:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:453:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:454:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:454:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:463:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:463:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:463:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:464:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:464:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:472:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:472:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:472:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:476:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:476:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:479:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:479:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:479:33` | nombre-zero | `1` | `0` | délai |
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
| `src/moteur/indicateurs.js:194:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:194:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:194:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:196:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:196:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:211:74` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:211:83` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:211:86` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:226:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:226:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:245:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:245:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:247:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:252:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:257:25` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:257:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:257:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:262:31` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:262:49` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:262:52` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:319:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:319:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:319:44` | nombre-zero | `2` | `0` | délai |
| `src/moteur/indicateurs.js:410:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:410:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:410:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:419:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:419:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:453:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:453:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:453:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:459:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:459:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:499:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:499:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:499:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:552:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:552:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:80:40` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/manque.js:80:43` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:229:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/manque.js:229:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:259:86` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:309:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:391:47` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/manque.js:391:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:59:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:59:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:95:21` | negation | `<` | `>=` | délai |
| `src/moteur/paires.js:95:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:95:44` | nombre-zero | `2` | `0` | délai |
| `src/moteur/paires.js:122:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:122:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:154:21` | negation | `<` | `>=` | délai |
| `src/moteur/paires.js:154:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:154:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/paires.js:155:27` | negation | `<` | `>=` | délai |
| `src/moteur/paires.js:155:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/paires.js:155:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:91:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:91:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:138:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:138:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:138:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:145:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:145:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:159:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:159:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:173:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:230:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:230:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:230:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:232:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:232:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:260:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:260:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:260:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:295:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:295:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:298:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:298:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:311:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:311:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:325:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:325:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:353:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:353:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:379:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:379:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:380:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:380:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:383:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/plafond.js:383:39` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:383:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:401:40` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:401:43` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:421:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:421:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:421:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:431:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:431:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:431:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:481:29` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:481:32` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:498:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:498:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:502:7` | si-faux | `f === 0 \|\| A === 0` | `false` | délai |
| `src/moteur/plafond.js:502:15` | logique | `f === 0 \|\| A === 0` | `((f === 0 )&&( A === 0))` | délai |
| `src/moteur/plafond.js:502:20` | negation | `===` | `!==` | délai |
| `src/moteur/plafond.js:502:24` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/plafond.js:502:27` | corps-si | `return plafondItineraire(instance, p, itineraire);` | `{}` | délai |
| `src/moteur/plafond.js:517:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:517:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:519:15` | arithmetique | `-` | `+` | délai |
| `src/moteur/plafond.js:519:17` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:520:14` | frontiere | `>=` | `>` | délai |
| `src/moteur/plafond.js:520:14` | negation | `>=` | `<` | délai |
| `src/moteur/plafond.js:520:17` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/plafond.js:520:39` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/plafond.js:520:44` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/plafond.js:520:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:521:9` | si-faux | `i < 0` | `false` | délai |
| `src/moteur/plafond.js:521:11` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:521:16` | corps-si | `return plafond;` | `{}` | délai |
| `src/moteur/plafond.js:522:14` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:522:17` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/plafond.js:522:17` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:523:27` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:523:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:523:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:549:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:143:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:224:21` | negation | `<` | `>=` | délai |
| `src/moteur/qualite.js:224:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:224:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:283:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:283:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:595:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:600:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:681:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:707:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:707:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:740:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:740:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:288:18` | nombre-zero | `10` | `0` | délai |
| `src/moteur/recherche.js:380:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:444:34` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:444:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:445:16` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:445:21` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:445:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:445:31` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:445:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:445:42` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:445:44` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:445:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:448:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:448:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:453:40` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:454:36` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:458:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:458:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:459:18` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:461:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:461:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:466:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:472:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:472:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:472:33` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:472:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:473:11` | si-faux | `siegesFixes[r * S + s] === FANTOME` | `false` | délai |
| `src/moteur/recherche.js:473:25` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:473:34` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:473:47` | corps-si | `{ mobiles[r * S + m] = s; m += 1; }` | `{}` | délai |
| `src/moteur/recherche.js:474:19` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:474:23` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:475:11` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:475:14` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:475:14` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:485:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:485:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:486:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:486:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:491:45` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:491:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:497:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:497:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:620:68` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:620:77` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:620:80` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:661:57` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:661:60` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:788:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:788:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:796:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:798:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:798:46` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:798:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:803:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:803:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:805:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:805:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:811:42` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:811:54` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:811:57` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:820:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:820:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:839:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:839:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:841:59` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:841:62` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:851:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:868:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:930:29` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:938:20` | logique | `i < arret && !estNul(courant)` | `((i < arret )\|\|( !estNul(courant)))` | délai |
| `src/moteur/recherche.js:938:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:938:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:939:9` | si-vrai | `immobile >= patience && ordre === ordreContraintes` | `true` | délai |
| `src/moteur/recherche.js:939:18` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:939:30` | logique | `immobile >= patience && ordre === ordreContraintes` | `((immobile >= patience )\|\|( ordre === ordreContraintes))` | délai |
| `src/moteur/recherche.js:965:9` | si-vrai | `i + 1 === releve` | `true` | délai |
| `src/moteur/recherche.js:965:15` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1099:16` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1099:21` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1099:31` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1113:22` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1113:25` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1116:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1116:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1121:17` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1124:18` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1124:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1124:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1124:33` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1124:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1125:23` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1130:18` | si-vrai | `t >= 0` | `true` | délai |
| `src/moteur/recherche.js:1130:20` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:1134:13` | si-vrai | `imposee[i] === 1` | `true` | délai |
| `src/moteur/recherche.js:1134:24` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1134:28` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1136:13` | si-faux | `fixee !== LIBRE` | `false` | délai |
| `src/moteur/recherche.js:1136:19` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1136:30` | corps-si | `occupants[fixee] += 1;` | `{}` | délai |
| `src/moteur/recherche.js:1136:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1136:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1139:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1139:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1139:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1141:11` | si-vrai | `enTrop <= 0` | `true` | délai |
| `src/moteur/recherche.js:1141:18` | negation | `<=` | `>` | délai |
| `src/moteur/recherche.js:1141:21` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1143:29` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:1143:44` | negation | `>` | `<=` | délai |
| `src/moteur/recherche.js:1143:46` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1143:51` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/recherche.js:1143:54` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1144:13` | si-vrai | `tableDe[p * R + r] !== t \|\| fixe[p * R + r] !== LIBRE` | `true` | délai |
| `src/moteur/recherche.js:1144:23` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1144:32` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1144:48` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1144:57` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1145:19` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1145:23` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1167:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1167:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1170:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1170:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1171:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1171:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1176:45` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1176:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1181:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1181:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1183:40` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1183:68` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1183:71` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1208:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1209:22` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1210:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1210:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1210:35` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1210:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1211:36` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1212:13` | si-faux | `p !== FANTOME && imposee[p * R + r] === 1` | `false` | délai |
| `src/moteur/recherche.js:1212:15` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1212:40` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1212:44` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1212:49` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1212:53` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1212:53` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1212:56` | corps-si | `siege[base + s] = FANTOME;` | `{}` | délai |
| `src/moteur/recherche.js:1212:67` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1214:20` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1214:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1214:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1214:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1216:33` | logique | `s < debut[t + 1] && siegesFixes[base + s] !== FANTOME` | `((s < debut[t + 1] )\|\|( siegesFixes[base + s] !== FANTOME))` | délai |
| `src/moteur/recherche.js:1216:73` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1216:76` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1221:29` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1221:33` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1222:13` | si-faux | `t === RESERVE` | `false` | délai |
| `src/moteur/recherche.js:1222:15` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1222:28` | corps-si | `continue;` | `{}` | délai |
| `src/moteur/recherche.js:1227:29` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1227:65` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1227:68` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1234:13` | si-faux | `fixe[p * R + r] !== LIBRE` | `false` | délai |
| `src/moteur/recherche.js:1234:40` | corps-si | `continue;` | `{}` | délai |
| `src/moteur/recherche.js:1235:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1235:42` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1235:63` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1235:66` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1235:66` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1256:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1264:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1264:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1270:35` | logique | `b < debut[t + 1] && siege[base + b] !== FANTOME` | `((b < debut[t + 1] )\|\|( siege[base + b] !== FANTOME))` | délai |
| `src/moteur/recherche.js:1270:69` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1270:72` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1305:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1305:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1349:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1349:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1394:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1394:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1451:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1451:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1500:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1500:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1679:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1679:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1680:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1680:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:190:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:216:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:227:72` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:234:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:234:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:326:58` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:333:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:434:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:434:31` | nombre-zero | `1` | `0` | délai |
