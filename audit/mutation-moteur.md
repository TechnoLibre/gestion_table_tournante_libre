# Audit par mutation du moteur

Écrit par `make mutation` (`scripts/mutation/audit.js`, § 14.13) ; ne se modifie pas à la main.

| | |
|---|---|
| version | 2026.10.05.01 |
| périmètre | `src/moteur` |
| sources et épreuves du périmètre (SHA-256) | `12633abb44b9c6c7ec93def7a0a2b760ff2633bec3946f108743b47daa378229` |
| Node | v26.13.0 |

Chaque mutant se joue contre les épreuves de la série node qui atteignent son module, sous `node --test`.
Un mutant déclaré équivalent que le délai arrête se rejoue seul, sans autre mutant à côté, avant d’être compté.
Un survivant se rejoue contre les épreuves longues qui atteignent son module avant d’être compté : tué par elles, il se compte à part.
Un mutant déclaré équivalent que les épreuves longues tuent s’y rejoue seul, sans autre mutant à côté, avant d’être compté.
Un survivant sur une ligne couverte désigne une épreuve qui exécute sans affirmer.

## Bilan

| mutants | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---:|---:|---:|---:|---:|---:|---:|
| 7091 | 6100 | 10 | 0 | 332 | 649 | 0 |

## Par fichier

| fichier | total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| `src/moteur/classement.js` | 96 | 84 | 0 | 0 | 8 | 4 | 0 |
| `src/moteur/configuration.js` | 1425 | 1278 | 0 | 0 | 44 | 103 | 0 |
| `src/moteur/conflits.js` | 34 | 33 | 0 | 0 | 1 | 0 | 0 |
| `src/moteur/correspondance.js` | 18 | 18 | 0 | 0 | 0 | 0 | 0 |
| `src/moteur/criteres.js` | 211 | 203 | 0 | 0 | 8 | 0 | 0 |
| `src/moteur/diagnostic.js` | 597 | 509 | 1 | 0 | 36 | 51 | 0 |
| `src/moteur/diversite.js` | 220 | 183 | 0 | 0 | 19 | 18 | 0 |
| `src/moteur/inclusions.js` | 230 | 179 | 0 | 0 | 26 | 25 | 0 |
| `src/moteur/indicateurs.js` | 596 | 528 | 0 | 0 | 23 | 45 | 0 |
| `src/moteur/manque.js` | 218 | 198 | 0 | 0 | 12 | 8 | 0 |
| `src/moteur/paires.js` | 123 | 108 | 0 | 0 | 2 | 13 | 0 |
| `src/moteur/plafond.js` | 541 | 416 | 4 | 0 | 49 | 72 | 0 |
| `src/moteur/presence.js` | 30 | 29 | 0 | 0 | 0 | 1 | 0 |
| `src/moteur/qualite.js` | 428 | 410 | 0 | 0 | 5 | 13 | 0 |
| `src/moteur/recherche.js` | 1889 | 1507 | 5 | 0 | 90 | 287 | 0 |
| `src/moteur/verification.js` | 435 | 417 | 0 | 0 | 9 | 9 | 0 |

## Par opérateur

| opérateur | total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|---:|
| arithmetique | 795 | 722 | 0 | 0 | 15 | 58 | 0 |
| frontiere | 420 | 300 | 2 | 0 | 116 | 2 | 0 |
| negation | 1001 | 908 | 0 | 0 | 2 | 91 | 0 |
| logique | 256 | 245 | 0 | 0 | 3 | 8 | 0 |
| retrait-non | 104 | 104 | 0 | 0 | 0 | 0 | 0 |
| mise-a-jour | 390 | 206 | 2 | 0 | 3 | 179 | 0 |
| nombre-plus-un | 1389 | 1251 | 2 | 0 | 102 | 34 | 0 |
| nombre-zero | 752 | 491 | 0 | 0 | 19 | 242 | 0 |
| booleen | 48 | 46 | 0 | 0 | 2 | 0 | 0 |
| si-vrai | 550 | 511 | 3 | 0 | 25 | 11 | 0 |
| si-faux | 550 | 525 | 0 | 0 | 14 | 11 | 0 |
| ternaire-vrai | 121 | 113 | 0 | 0 | 8 | 0 | 0 |
| ternaire-faux | 121 | 113 | 0 | 0 | 7 | 1 | 0 |
| min-max | 44 | 42 | 1 | 0 | 1 | 0 | 0 |
| corps-si | 550 | 523 | 0 | 0 | 15 | 12 | 0 |

## Survivants (0), lignes couvertes d’abord

Aucun.

## Tués par la série longue (10)

Survivants de la série node que les épreuves longues tuent : la série node exécute leur ligne sans l’affirmer.

| lieu | opérateur | avant | après | ligne couverte |
|---|---|---|---|---|
| `src/moteur/diagnostic.js:436:9` | si-vrai | `passant === undefined` | `true` | oui |
| `src/moteur/plafond.js:371:18` | min-max | `min` | `max` | oui |
| `src/moteur/plafond.js:426:9` | si-vrai | `connu === undefined \|\| nP > connu` | `true` | oui |
| `src/moteur/plafond.js:434:9` | si-vrai | `programme === undefined` | `true` | oui |
| `src/moteur/plafond.js:483:16` | frontiere | `>` | `>=` | oui |
| `src/moteur/recherche.js:612:23` | frontiere | `<` | `<=` | oui |
| `src/moteur/recherche.js:623:16` | nombre-plus-un | `0` | `1` | oui |
| `src/moteur/recherche.js:623:31` | nombre-plus-un | `1` | `2` | oui |
| `src/moteur/recherche.js:675:20` | mise-a-jour | `+=` | `-=` | oui |
| `src/moteur/recherche.js:678:31` | mise-a-jour | `+=` | `-=` | oui |

## Mutants équivalents (332)

Déclarés dans `audit/mutants-equivalents.json`, avec leur raison.

| lieu | opérateur | avant | après | raison |
|---|---|---|---|---|
| `src/moteur/classement.js:45:18` | booleen | `true` | `false` | classement.js, CASES_DE_REFERENCE, nouvelleTable à false : la case ne sert qu'aux rencontres répétées, cochées quand l'une de nouveauxVoisins ou nouvelleTable l'est (estCoche), et nouveauxVoisins reste cochée ; leur valeur qui classe ne lit que nouveauxVoisins (valeursQuiClassent). La compilation de référence ne change pas. |
| `src/moteur/classement.js:82:61` | frontiere | `>` | `>=` | classement.js, plusGrand, valeur >= plus : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/classement.js:166:21` | frontiere | `<` | `<=` | classement.js, comparerCles, i <= a.length : a[length] et b[length] sont tous deux undefined, donc égaux ; la boucle finit et rend 0, comme sans le tour de trop. |
| `src/moteur/classement.js:167:36` | frontiere | `<` | `<=` | classement.js, comparerCles, a[i] <= b[i] sous a[i] !== b[i] : pour deux nombres différents, <= et < coïncident. Une clé ne mêle jamais null et nombre : le premier critère vaut null pour une liste d'écarts vide, et toutes les entrées ont des listes de même longueur (exigerMemeTaille), toutes vides ou aucune. |
| `src/moteur/classement.js:167:46` | nombre-plus-un | `1` | `2` | classement.js, comparerCles, −2 au lieu de −1 : le résultat ne se lit que par son signe, dans sort et dans le \|\| du départage par identifiant. |
| `src/moteur/classement.js:167:50` | nombre-plus-un | `1` | `2` | classement.js, comparerCles, 2 au lieu de 1 : le résultat ne se lit que par son signe, dans sort et dans le \|\| du départage par identifiant. |
| `src/moteur/classement.js:175:15` | nombre-plus-un | `0` | `1` | classement.js, sommer, somme partant de 1 au lieu de 0 : chaque composante de chaque entrée grossit de 1 ; classer et premierPalierQuiDepartage ne font que comparer ces sommes entre entrées, composante par composante, et ne les rendent pas. |
| `src/moteur/classement.js:197:8` | nombre-plus-un | `1` | `2` | classement.js, lirePaliers, rangSaute −2 au lieu de −1 quand rien n'est sauté : aucun palier n'a ce rang, le filtre garde tout, et classer rend null pour tout rangSaute < 0. |
| `src/moteur/configuration.js:104:20` | nombre-plus-un | `2` | `3` | configuration.js, NON_PLACE = −3 au lieu de −2 : la marque ne sert qu'à indexerPlan, qui en remplit tableDe, la compare par !== et === et la remplace par un index de table (≥ 0) ou RESERVE (−1) ; toute case encore marquée lève PLAN_NON_ASSIS, si bien que la marque n'est jamais rendue, et −3 n'égale ni RESERVE ni un index. |
| `src/moteur/configuration.js:253:15` | ternaire-faux | `organisation === null` | `false` | configuration.js, relierConflits, numeroDe.get(organisation) même pour un exclu sans organisation : numeroDe n'a pour clés que les libellés des groupes, que des présents portent, numeroterGroupes sautant organisation null ; get(null) rend undefined, la valeur de la branche d'origine, et l'exclu ne relie rien. |
| `src/moteur/configuration.js:261:21` | frontiere | `<` | `<=` | configuration.js, relierConflits, u <= G + N dans la numérotation des unités : rang[G + N] est hors des éléments de l'Int32Array de longueur G + N, undefined, différent de 0 : le tour de trop passe par continue, et K ne change pas. |
| `src/moteur/configuration.js:269:21` | frontiere | `<` | `<=` | configuration.js, relierConflits, p <= N au rang de chaque présent : le tour de trop lit groupe[N], undefined hors du tableau typé, différent de SANS_GROUPE, d'où rang[undefined], undefined, écrit dans uniteConflit[N], au-delà de la longueur N du tableau typé, qui n'écrit rien ; la relecture de uniteConflit[N] rend undefined, et undefined >= 0 est faux. |
| `src/moteur/configuration.js:271:9` | si-vrai | `uniteConflit[p] >= 0` | `true` | configuration.js, relierConflits, if (true) au lieu de uniteConflit[p] >= 0 : une personne qu'aucune liste ne relie, de rang −1, écrit effectif[−1], un index hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:271:57` | mise-a-jour | `+=` | `-=` | configuration.js, relierConflits, effectif[u] −= 1 au lieu de += 1 : chaque effectif change de signe ; effectif ne se lit qu'au produit effectif[u] × effectif[v] d'un lien, où (−a) × (−b) = a × b, et la fonction ne le rend pas : pairesEnConflit ne change pas. |
| `src/moteur/configuration.js:335:23` | frontiere | `<` | `<=` | configuration.js, empechement, u <= T : la table de trop lit siegesLibres[T × R + r], au-delà des T × R cases du tableau typé, undefined, et undefined >= 2 est faux : aucune table de plus n'accueille les deux. |
| `src/moteur/configuration.js:361:65` | nombre-plus-un | `2` | `3` | configuration.js, AVANCEE, pleine = 3 au lieu de 2 : le rang ne se lit que par AVANCEE[sienne] > AVANCEE[raison] dans relierInclusions ; 3 reste au-dessus de tablesImposees (1) et de sansTourCommun (0), et l'ordre des trois raisons ne change pas. |
| `src/moteur/configuration.js:416:29` | frontiere | `>` | `>=` | configuration.js, relierInclusions, AVANCEE[sienne] >= AVANCEE[raison] : les trois rangs sont distincts, deux rangs égaux désignent la même raison, et la remplacer par elle-même ne change rien. |
| `src/moteur/configuration.js:526:7` | si-faux | `absences === 0` | `false` | configuration.js, coPresences, if (false) au lieu de absences === 0 : sans absence, chaque rangée du masque ne porte que des 1 ; la réunion des présents des tours de chacun contient les N personnes, d'où un compte N et N − 1 co-présents, la valeur que fill écrit. Le raccourci n'épargne que le calcul. |
| `src/moteur/configuration.js:526:20` | nombre-plus-un | `0` | `1` | configuration.js, coPresences, absences === 1 au lieu de absences === 0 : la seule absence est celle d'une personne à un tour ; chacun étant présent à un tour au moins, R vaut alors au moins 2, et cette personne est présente à un autre tour, où les N − 1 autres le sont toutes : chacun croise chacun, N − 1 co-présents pour tous, la valeur que fill écrit. |
| `src/moteur/configuration.js:529:30` | arithmetique | `/` | `*` | configuration.js, coPresences, Math.ceil(N × 32) mots au lieu de ⌈N/32⌉ : l'index d'une personne, r × mots + (p >>> 5), et les boucles sur m < mots suivent le même mots ; les mots ajoutés restent à 0, et bitsA1(0) vaut 0. Seule la mémoire change. |
| `src/moteur/configuration.js:531:23` | frontiere | `<` | `<=` | configuration.js, coPresences, p <= N au remplissage des présents de chaque tour : le tour de trop lit present[N × R + r], hors des éléments du tableau typé, undefined, qui n'égale pas 1 : rien ne s'écrit. |
| `src/moteur/configuration.js:532:25` | frontiere | `<` | `<=` | configuration.js, coPresences, r <= R au remplissage des présents de chaque tour : la case de trop, present[p × R + R], est le tour 1 de la personne suivante ; quand elle vaut 1, l'écriture vise presentsDuTour[R × mots + (p >>> 5)], au-delà de la longueur R × mots du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:538:23` | frontiere | `<` | `<=` | configuration.js, coPresences, p <= N au décompte : le tour de trop prend le motif vide de present.subarray(N × R, (N + 1) × R) et écrit son compte dans coPresents[N], au-delà de la longueur N du tableau typé, qui n'écrit rien ; le motif vide n'est celui d'aucune personne, R valant au moins 1, et la Map ne le rend à personne. |
| `src/moteur/configuration.js:539:40` | arithmetique | `*` | `/` | configuration.js, coPresences, motif lu depuis p / R au lieu de p × R : subarray tronque le début à ⌊p/R⌋, et la clé de la Map porte la rangée de p en suffixe ; sa longueur, (p + 1) × R − ⌊p/R⌋, croît strictement avec p dès que R ≥ 2, ce qu'impose une absence : deux personnes n'ont jamais la même clé, et chacune calcule son compte depuis present[p × R + r], qui ne dépend pas de la clé. Seule la mémoïsation se perd. |
| `src/moteur/configuration.js:539:50` | nombre-plus-un | `1` | `2` | configuration.js, coPresences, motif lu jusqu'à (p + 2) × R au lieu de (p + 1) × R : la clé porte la rangée de p suivie de celle de p + 1, ou la seule rangée de p pour la dernière personne, de longueur R ; deux clés égales ont donc la même rangée de p en tête, et le compte retrouvé est celui de ce motif. Deux personnes au même motif peuvent recalculer le même compte : seule la mémoïsation se perd. |
| `src/moteur/configuration.js:541:11` | si-vrai | `compte === undefined` | `true` | configuration.js, coPresences, if (true) au lieu de compte === undefined : chaque personne recalcule la réunion des présents de ses tours au lieu de reprendre le compte de son motif, la même valeur ; seule la mémoïsation se perd. |
| `src/moteur/configuration.js:543:27` | frontiere | `<` | `<=` | configuration.js, coPresences, r <= R dans la réunion : la case de trop, present[p × R + R], est le tour 1 de la personne suivante, ou undefined pour la dernière ; quand elle n'est pas 0, reunion[m] \|= presentsDuTour[R × mots + m] lit undefined hors du tableau typé, et x \| undefined vaut x : la réunion ne change pas. |
| `src/moteur/configuration.js:545:29` | frontiere | `<` | `<=` | configuration.js, coPresences, m <= mots dans la réunion : le mot de trop écrit reunion[mots], au-delà de la longueur mots du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:548:27` | frontiere | `<` | `<=` | configuration.js, coPresences, m <= mots au compte : bitsA1 reçoit reunion[mots], undefined hors du tableau typé ; ses décalages et masques font du NaN un 0, et bitsA1 rend 0 : le compte ne change pas. |
| `src/moteur/configuration.js:555:21` | frontiere | `<` | `<=` | configuration.js, coPresences, p <= N au calcul des mobiles co-présents : le tour de trop lit coPresents[N] et statut[N], undefined hors des tableaux typés, et écrit mobilesCoPresents[N], au-delà de la longueur N du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:625:21` | frontiere | `<` | `<=` | configuration.js, siegesLibresApres, p <= N : le tour de trop lit fixe[N × R + r], undefined, différent de LIBRE ; l'écriture fixees[NaN] += 1 vise un index hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:628:11` | si-vrai | `t !== LIBRE` | `true` | configuration.js, siegesLibresApres, if (true) au lieu de t !== LIBRE : une case libre écrit fixees[−R + r], un index négatif, hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:631:21` | frontiere | `<` | `<=` | configuration.js, siegesLibresApres, t <= T : le tour de trop compare undefined > undefined, faux, et écrit fixees[T × R + r], au-delà de la longueur T × R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:667:17` | corps-si | `{ statut[p] = STATUT.MOBILE; }` | `{}` | configuration.js, deriverStatuts, if (aucune) {} : statut est un Uint8Array, dont chaque case vaut 0 à sa création, et STATUT.MOBILE vaut 0 ; la case reste à 0. |
| `src/moteur/configuration.js:694:42` | nombre-plus-un | `1` | `2` | configuration.js, numeroterObjectifs, rangDe de longueur T × (R + 2) au lieu de T × (R + 1) : toutes les lectures et écritures visent t × (R + 1) + k avec k ≤ R, au plus T × (R + 1) − 1 ; les cases ajoutées en fin ne se lisent jamais. |
| `src/moteur/configuration.js:712:44` | nombre-plus-un | `1` | `2` | configuration.js, numeroterObjectifs, numeroDe de longueur T × (R + 2) au lieu de T × (R + 1) : les lectures visent t × (R + 1) + k avec k ≤ R, au plus T × (R + 1) − 1 ; les cases ajoutées en fin ne se lisent jamais. |
| `src/moteur/configuration.js:730:21` | frontiere | `<` | `<=` | configuration.js, numeroterObjectifs, t <= T dans le calcul de objectifDe : le tour de trop écrit objectifDe[T × R + r], au-delà de la longueur T × R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:731:23` | frontiere | `<` | `<=` | configuration.js, numeroterObjectifs, r <= R dans le calcul de objectifDe : le tour de trop de la table t écrit objectifDe[t × R + R], la case du premier tour de la table t + 1, que le tour r = 0 de cette table récrit ensuite ; pour la dernière table, l'index T × R est au-delà de la longueur T × R du tableau typé, qui n'écrit rien. La lecture numeroDe[(t + 1) × (R + 1)] ne lève pas. |
| `src/moteur/configuration.js:752:21` | frontiere | `>` | `>=` | configuration.js, couplesPossibles, O >= 0 && p < N : sans objectif, la boucle tourne sans rien écrire — correspond est vide, copyWithin(0, 0, 0) ne copie rien, la boucle intérieure (o < 0) ne tourne pas ; seul le temps change. |
| `src/moteur/configuration.js:756:9` | si-faux | `premiere !== undefined` | `false` | configuration.js, couplesPossibles, if (false) au lieu de premiere !== undefined : chaque personne recalcule sa rangée par correspondA, fonction pure des étiquettes et de l'objectif, au lieu de recopier celle de la première personne aux mêmes étiquettes, égale ; seul le temps change. |
| `src/moteur/configuration.js:756:33` | corps-si | `{ correspond.copyWithin(p * O, premiere * O, premiere * O +…` | `{}` | configuration.js, couplesPossibles, corps vide du if (premiere !== undefined) : même effet que le mutant si-faux du même if — la rangée se recalcule par correspondA, pure, au lieu d'être recopiée, égale ; seul le temps change. |
| `src/moteur/configuration.js:768:23` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, t <= T dans le marquage des objectifs offerts : le tour de trop lit objectifDe[T × R + r] et siegesLibres[T × R + r], undefined hors des tableaux typés ; undefined > 0 est faux, rien n'est marqué. |
| `src/moteur/configuration.js:772:23` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, p <= N : le tour de trop lit present[N × R + r], undefined, qui n'égale pas 0, puis fixe[N × R + r], undefined, différent de LIBRE ; objectifDe[NaN] vaut undefined, différent de SANS_OBJECTIF, et correspond[NaN], undefined, n'égale pas 1 : oui reste faux, rien ne s'écrit. |
| `src/moteur/configuration.js:780:27` | frontiere | `<` | `<=` | configuration.js, couplesPossibles, o <= O : le tour de trop lit offert[O], undefined hors du tableau typé ; undefined === 1 est faux, oui reste faux. |
| `src/moteur/configuration.js:826:29` | frontiere | `<` | `<=` | configuration.js, deriverAnimateurs, ligne <= T × R : le tour de trop écrit debutAnimes[T × R + 1], au-delà de la longueur T × R + 1 du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:851:7` | si-faux | `A === 0` | `false` | configuration.js, bornerAnimateurs, if (false) au lieu de A === 0 : sans animateur, animes est vide et debutAnimes ne porte que des zéros ; aucune liste de rangs ne se remplit, plusGrandLibre reste à 0, aucune boucle sur les animateurs ne tourne, et chaque borne vaut min(0, 0) = 0, la valeur de la sortie anticipée ; seul le temps change. |
| `src/moteur/configuration.js:851:16` | corps-si | `return borne;` | `{}` | configuration.js, bornerAnimateurs, corps vide du if (A === 0) : même effet que le mutant si-faux du même if — le calcul complet rend des bornes toutes nulles, celles de la sortie anticipée ; seul le temps change. |
| `src/moteur/configuration.js:854:21` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, r <= R au relevé des tables à siège libre : le tour de trop ajoute libresDuTour[R], que la boucle des personnes, sur les tours 0 à R − 1, ne lit jamais, et écrit plusGrandLibre[R], au-delà de la longueur R du tableau typé, qui n'écrit rien. |
| `src/moteur/configuration.js:866:42` | nombre-plus-un | `1` | `2` | configuration.js, bornerAnimateurs, marque remplie de −2 au lieu de −1 : marque[f] ne se lit que par marque[f] === p, avec p ≥ 0 ; aucune des deux valeurs initiales ne l'égale. |
| `src/moteur/configuration.js:867:21` | frontiere | `<` | `<=` | configuration.js, bornerAnimateurs, p <= N : le tour de trop lit present et fixe hors des tableaux typés, undefined, qui n'égale ni 0 ni LIBRE ; la boucle des animateurs va de debutAnimes[NaN] à debutAnimes[NaN], undefined < undefined est faux : rien ne se marque, et borne[N], au-delà de la longueur N du tableau typé, n'écrit rien. |
| `src/moteur/configuration.js:1279:23` | frontiere | `<` | `<=` | configuration.js, indexerPlan, p <= N à la recherche des non-placés : le tour de trop lit tableDe[N × R + r], hors du tableau typé, undefined, différent de NON_PLACE : continue, rien ne s'écrit ni ne se lève. |
| `src/moteur/configuration.js:1310:33` | frontiere | `>` | `>=` | configuration.js, exigerPlanIndexe, absences >= 0 au lieu de absences > 0 : le masque se lit aussi sans absence ; une instance de normaliser sans absence a present à 1 partout, absences valant Σ_p (R − toursPresents[p]), si bien que present[i] === 0 n'est jamais vrai et que rien de plus ne se lève. Seule la lecture du masque, que le raccourci épargne, s'ajoute. |
| `src/moteur/conflits.js:59:27` | frontiere | `>` | `>=` | conflits.js, conflitsParTable, pairesEnConflit >= 0 au lieu de > 0 : la condition ne dépend plus que de enConflit.length > 0. Une paire n'entre dans enConflit (parcourirTours) que quand conflitEntre relie les unités des deux personnes ; un lien relie l'unité d'un présent, ou le groupe d'un exclu que des présents portent, à un groupe de présents (relierConflits), et ajoute à pairesEnConflit le produit de deux effectifs ≥ 1 : enConflit non vide implique pairesEnConflit > 0. |
| `src/moteur/criteres.js:321:79` | frontiere | `<` | `<=` | criteres.js, verifierPriorites, ordre d'un palier jugé par rangDe(critere) <= rangDe(précédent) : deux entrées d'un palier de même rang nomment le même critère, et la répétition a déjà rendu critereRepete à la lecture des entrées, avant ce jugement. |
| `src/moteur/criteres.js:345:19` | ternaire-faux | `rang === 0` | `false` | criteres.js, completerPriorites, place du premier critère calculée par palierDe(ORDRE_PAR_DEFAUT[−1]) + 1 : ORDRE_PAR_DEFAUT[−1] vaut undefined, aucune entrée de la forme {critere, poids} du contrat, critere une chaîne, ne le porte, palierDe rend −1 et la place vaut 0, comme la branche rang === 0. Ses appelants lui passent PRIORITES_PAR_DEFAUT ou une liste que verifierPriorites a jugée : lirePriorites (configuration.js) juste avant le complément, priorites(charge) (document.js) une charge dont examinerPriorites a jugé la liste. |
| `src/moteur/criteres.js:357:10` | ternaire-vrai | `criteres.length === 1` | `true` | criteres.js, familleDuPalier, famille du premier critère même pour un palier partagé : la liste compilée est valide, ses critères suivent l'ordre de CRITERES, où les deux raffinements viennent en dernier ; un palier partagé qui n'est pas tout raffinement s'ouvre donc sur un critère d'avant eux, ni l'écart (seul à son palier), ni un raffinement, soit un critère de la famille contrainte, ce que rend la branche d'origine. |
| `src/moteur/criteres.js:399:22` | nombre-plus-un | `1` | `2` | criteres.js, compiler, palierEcart initial −2 au lieu de −1 : la valeur ne se lit que par palierEcart < 0, ou après avoir été remplacée par un rang ≥ 0. |
| `src/moteur/criteres.js:403:21` | ternaire-vrai | `criteres.length === 1` | `true` | criteres.js, compiler, largeur d'un palier partagé prise de composantesDe de son premier critère : un critère d'un palier partagé n'est pas de seulsASonPalier(mode) (verifierPriorites), et hors de ceux-là composantesDe rend une seule grandeur — l'écart (deux) est toujours seul, les tours hors objectif n'en ont plusieurs que sous les modes où ils sont seuls ; la largeur vaut 1 comme dans la branche d'origine. |
| `src/moteur/criteres.js:416:54` | frontiere | `>` | `>=` | criteres.js, compiler, palier raffinement suivant cherché dès i >= palierEcart : le palier de l'écart, où l'écart est seul, est de la famille rencontres, jamais raffinement ; le rang palierEcart n'est jamais rendu. |
| `src/moteur/criteres.js:417:23` | frontiere | `<` | `<=` | criteres.js, compiler, suivant <= 0 au lieu de suivant < 0 : suivant vaut −1 ou un rang strictement supérieur à palierEcart ≥ 0, jamais 0. |
| `src/moteur/criteres.js:417:25` | nombre-plus-un | `0` | `1` | criteres.js, compiler, suivant < 1 au lieu de suivant < 0 : suivant vaut −1 ou un rang strictement supérieur à palierEcart ≥ 0, jamais 0. |
| `src/moteur/diagnostic.js:129:7` | si-faux | `T === 0` | `false` | diagnostic.js, pairesMinimales, if (false) au lieu de if (T === 0) : sans table, membres est un Int32Array vide ; la boucle des libres écrit membres[0], hors des éléments d'un tableau typé, ce qui n'écrit rien, et la somme sur aucune table rend 0, la valeur du retour anticipé. |
| `src/moteur/diagnostic.js:129:16` | corps-si | `return 0;` | `{}` | diagnostic.js, pairesMinimales, if (T === 0) {} : même chemin que le mutant si-faux du même if — sans table, membres[0] += 1 n'écrit rien dans un Int32Array vide et la somme rend 0. |
| `src/moteur/diagnostic.js:133:18` | nombre-zero | `1` | `0` | diagnostic.js, pairesMinimales, boucle de la table la moins remplie partant de t = 0 : le premier tour compare membres[0] < membres[0], toujours faux ; moins ne change pas. |
| `src/moteur/diagnostic.js:133:23` | frontiere | `<` | `<=` | diagnostic.js, pairesMinimales, t <= T dans la recherche de la table la moins remplie : membres[T] est undefined, et undefined < x est faux ; moins ne change pas. |
| `src/moteur/diagnostic.js:133:51` | frontiere | `<` | `<=` | diagnostic.js, pairesMinimales, membres[t] <= membres[moins] : à égalité le libre va à la dernière table la moins remplie au lieu de la première ; ajouter 1 à un minimum ou à un autre donne le même multiensemble de membres par table, et Σ C(x_t, 2) ne lit que ce multiensemble. |
| `src/moteur/diagnostic.js:162:22` | nombre-plus-un | `0` | `1` | diagnostic.js, planchersCollisions, distinctes initialisé à 1 : un groupe n'est écrit que si cumulees > 0, donc qu'un tour au moins a un minimum entier ≥ 1 ; max(1, …) y rend la même valeur que max(0, …), et un groupe à cumulees nul n'est pas écrit. |
| `src/moteur/diagnostic.js:214:21` | frontiere | `<` | `<=` | diagnostic.js, animateursMemeOrganisation, p <= N : statut[N] est undefined, différent de STATUT.ANCRE ; le tour de trop passe par continue. |
| `src/moteur/diagnostic.js:275:109` | frontiere | `<=` | `<` | diagnostic.js, avecTablesManquantes, enAttente avec m < l.effectif : une ligne absente de sansRemede a, à chaque tour, ses membres réservés à des tables distinctes parmi les T existantes ; ses s − k_r libres trouvent une table vide dès que T + m ≥ s, et son plancher tombe à 0 à m = s − T ≤ s − 1 (une ligne suppose T ≥ 1). Aucune ligne n'est donc en attente à m = s, où seules les deux bornes diffèrent. |
| `src/moteur/diagnostic.js:276:25` | min-max | `max` | `min` | diagnostic.js, avecTablesManquantes, tables ajoutées de la plus petite capacité au lieu de la plus grande : normaliser refuse toute capacité < 2, la plus petite présente est donc valide ; planchersCollisions ne lit ni capacite ni idsTables, et les tablesManquantes rendues ne changent pas. |
| `src/moteur/diagnostic.js:277:55` | nombre-plus-un | `1` | `2` | diagnostic.js, avecTablesManquantes, premierId = max + 2 : les identifiants ajoutés restent des entiers ≥ 1 distincts de ceux de la configuration et entre eux ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:280:39` | arithmetique | `-` | `+` | diagnostic.js, avecTablesManquantes, id = premierId + m + 1 : identifiants toujours distincts, entiers et au-delà du plus grand ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:280:41` | nombre-zero | `1` | `0` | diagnostic.js, avecTablesManquantes, id = premierId + m − 0 : identifiants toujours distincts, entiers et au-delà du plus grand ; aucune sortie ne les lit. |
| `src/moteur/diagnostic.js:280:80` | arithmetique | `+` | `-` | diagnostic.js, avecTablesManquantes, numero = tables.length − m : normaliser ne lit pas le numéro d'une table (seuls id et capacite entrent dans l'instance) ; la sonde rend les mêmes planchers. |
| `src/moteur/diagnostic.js:284:81` | frontiere | `<=` | `<` | diagnostic.js, avecTablesManquantes, affectation sous m < ligne.effectif : même raison que pour enAttente — une ligne absente de sansRemede s'annule à m = s − T ≤ s − 1, avant que la borne ne joue. |
| `src/moteur/diagnostic.js:319:84` | logique | `tour === null \|\| tour === undefined` | `((tour === null )&&( tour === undefined))` | diagnostic.js, surMoinsDeTours, tour === null && tour === undefined : un objectif de soirée à tour null passe encore par avant(null), null <= R′ étant vrai ; seul un objectif à tour absent est retiré de la sonde. La sonde ne sert qu'à redondanceMinimale et plafondsAPriori, qui ne lisent aucun objectif, et retirer un objectif déjà validé ne fait lever aucune règle de normaliser. |
| `src/moteur/diagnostic.js:319:106` | logique | `tour === null \|\| tour === undefined \|\| avant(tour)` | `((tour === null \|\| tour === undefined )&&( avant(tour)))` | diagnostic.js, surMoinsDeTours, (tour nul ou absent) && avant(tour) : la sonde perd ses objectifs d'un tour désigné, et ceux à tour absent ; elle n'en gagne aucun au-delà de R′. redondanceMinimale et plafondsAPriori ne lisent aucun objectif, et en retirer un ne fait lever aucune règle de normaliser. |
| `src/moteur/diagnostic.js:330:22` | arithmetique | `-` | `+` | diagnostic.js, toursSansRedondance, départ à R + 1 : la sonde à R + 1 tours garde toutes les réservations et se normalise sans lever ; le plafond a priori, maximum exact de la formule sur les itinéraires admissibles, ne décroît pas quand un tour s'ajoute (un itinéraire prolongé d'une table ne perd ni ancré ni siège), donc la redondance y reste ≥ sa valeur à R, positive. La sonde à R est la configuration même. Seul le temps change. Un participant réservé tour par tour à la même table sur chacun des R tours, ancré à R, devient partiellement fixé à R + 1 : l'ancré perdu à sa table est compensé, pour qui y passe, par un mobile et au moins un siège de plus (A − 1 + min(n_p + 1, S + m) ≥ A + min(n_p, S)). |
| `src/moteur/diagnostic.js:330:24` | nombre-zero | `1` | `0` | diagnostic.js, toursSansRedondance, départ à R : la sonde à R tours est la configuration elle-même, dont la redondance minimale est positive à ce point ; un chiffrage de plus, aucun résultat changé. |
| `src/moteur/diagnostic.js:358:16` | nombre-zero | `1` | `0` | diagnostic.js, collisionPartout, recherche de la plus petite capacité partant de t = 0 : plusPetite vaut déjà capacite[0], et le tour de trop compare capacite[0] < capacite[0], faux ; plusPetite ne change pas. |
| `src/moteur/diagnostic.js:358:21` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, t <= T : capacite[T] est undefined, N − (places − undefined) vaut NaN, et NaN <= x est faux ; le tour de trop ne rend pas false, et la boucle rend true exactement quand les T tables réelles passent. |
| `src/moteur/diagnostic.js:358:50` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, capacite[t] <= plusPetite : à égalité, l'affectation écrit la capacité déjà retenue. |
| `src/moteur/diagnostic.js:360:21` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, r <= R : au tour de trop, presentsParTour[R] est undefined hors du tableau typé, et presentsParTour[R] − (places − plusPetite) vaut NaN ; NaN <= x est faux, et le tour ne rend pas false. Ses lectures de present et ses écritures dans vue, aux index de groupes des présents, ne lèvent pas. |
| `src/moteur/diagnostic.js:364:23` | frontiere | `<` | `<=` | diagnostic.js, collisionPartout, p <= N dans le compte des sans appartenance : groupe[N] est undefined, différent de SANS_GROUPE (−1) ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:369:18` | nombre-plus-un | `1` | `2` | diagnostic.js, collisionPartout, vue[g] = 2 : vue, un Uint8Array remis à 0 à chaque tour, ne se lit que par vue[g] === 0 ; 2 y est non nul comme 1, et chaque appartenance se compte une fois par tour. |
| `src/moteur/diagnostic.js:424:7` | si-faux | `mobile === -1` | `false` | diagnostic.js, ecartItineraire, if (false) au lieu de if (mobile === -1) : sans mobile ni partiellement fixé, tous les présents sont ancrés ; Σ c_t = N et a_t ≤ c_t (SURRESERVATION sinon) forcent a_t = c_t à chaque table, chaque table est sautée par sieges === 0, et siegesToursInferieurs nul rend null, comme le retour anticipé. |
| `src/moteur/diagnostic.js:424:19` | nombre-plus-un | `1` | `2` | diagnostic.js, ecartItineraire, mobile === -2 : indexOf ne rend jamais −2, le retour anticipé disparaît ; même chemin que le mutant si-faux du même if, qui rend null. |
| `src/moteur/diagnostic.js:424:22` | corps-si | `return null;` | `{}` | diagnostic.js, ecartItineraire, if (mobile === -1) {} : même chemin que le mutant si-faux du même if — chaque table pleine d'ancrés est sautée, et la fonction rend null. |
| `src/moteur/diagnostic.js:443:45` | frontiere | `<` | `<=` | diagnostic.js, ecartItineraire, ecartPassant <= plancher : à égalité la même valeur est réécrite dans plancher. |
| `src/moteur/diagnostic.js:466:37` | nombre-plus-un | `0` | `1` | diagnostic.js, objectifsInevitables, parTour rempli de 1 : la boucle des tours écrit parTour[r] pour chaque r de 0 à R − 1 avant toute lecture. |
| `src/moteur/diagnostic.js:470:23` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, r <= R dans le cumul des sièges libres par tour : au tour de trop, l'écriture vise libresAuTour[R], hors de l'Int32Array de longueur R, et un tableau typé l'ignore sans lever ; les lectures de objectifDe et siegesLibres à t × R + R ne lèvent pas, et la suite ne lit libresAuTour qu'aux r < R. |
| `src/moteur/diagnostic.js:479:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le marquage des personnes : possible[N·R + r] et fixe[N·R + r] sont undefined, donc la branche else écrit servieDOffice[N], hors des éléments d'un Uint8Array de longueur N, ce qui n'écrit rien. |
| `src/moteur/diagnostic.js:483:31` | nombre-plus-un | `1` | `2` | diagnostic.js, objectifsInevitables, servieDOffice[p] = 2 : la marque ne se lit que par servieDOffice[p] === 0. |
| `src/moteur/diagnostic.js:488:21` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le compte des concernées : aUnTourLibre[N] est undefined, différent de 1 ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:495:23` | frontiere | `<` | `<=` | diagnostic.js, objectifsInevitables, p <= N dans le compte par tour : possible[N·R + r] est undefined, différent de 0, et fixe[N·R + r] undefined est différent de LIBRE, donc continue ; rien n'est compté de plus. |
| `src/moteur/diagnostic.js:542:16` | frontiere | `<` | `<=` | diagnostic.js, etendue, valeur <= min : à égalité la même valeur est réécrite dans min. |
| `src/moteur/diagnostic.js:543:16` | frontiere | `>` | `>=` | diagnostic.js, etendue, valeur >= max : à égalité la même valeur est réécrite dans max. |
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
| `src/moteur/inclusions.js:74:15` | nombre-plus-un | `1` | `2` | inclusions.js, partenaire, seul = −2 au lieu de −1 : seul ne se lit que par seul >= 0, faux pour l'un comme pour l'autre, et ne se rend tel quel que si aucun membre n'est rencontrable, ce qu'une ligne active exclut : relierInclusions ne garde une organisation que si empechement, que lit inclusionPossible, ne retient pas l'un de ses membres. |
| `src/moteur/inclusions.js:111:56` | nombre-plus-un | `1` | `2` | inclusions.js, calculer, incluse remplie de −2 au lieu de −1 : la marque ne se lit que par incluse[g] !== p, avec p ≥ 0 ; aucune des deux valeurs initiales ne l'égale. |
| `src/moteur/inclusions.js:112:57` | nombre-plus-un | `1` | `2` | inclusions.js, calculer, couverte remplie de −2 au lieu de −1 : la marque ne se lit que par couverte[g] === p, avec p ≥ 0 ; aucune des deux valeurs initiales ne l'égale. |
| `src/moteur/inclusions.js:113:21` | frontiere | `<` | `<=` | inclusions.js, calculer, p <= N au calcul des cibles : le tour de trop va de inclusionDebut[N] à inclusionDebut[N + 1], undefined, et i < undefined est faux ; ses écritures, d'actives[N] à auDela[N], tombent au-delà des N cases des tableaux typés, qui n'écrivent rien, et la lecture K[N], undefined, ne lève pas. |
| `src/moteur/inclusions.js:116:46` | si-vrai | `inclusionCible[i] < 0` | `true` | inclusions.js, calculer, if (true) au lieu de inclusionCible[i] < 0 au marquage des organisations incluses : une ligne de personne, de cible q ≥ 0, écrit incluse[−1 − q], un index négatif, hors des éléments d'un tableau typé, qui n'écrit rien. |
| `src/moteur/inclusions.js:116:64` | frontiere | `<` | `<=` | inclusions.js, calculer, inclusionCible[i] <= 0 au marquage des organisations incluses : la seule ligne de plus, la personne d'index 0, écrit incluse[−1], hors des éléments du tableau typé, qui n'écrit rien. |
| `src/moteur/inclusions.js:116:66` | nombre-plus-un | `0` | `1` | inclusions.js, calculer, inclusionCible[i] < 1 au marquage des organisations incluses : la seule ligne de plus, la personne d'index 0, écrit incluse[−1], hors des éléments du tableau typé, qui n'écrit rien. |
| `src/moteur/inclusions.js:120:11` | si-faux | `q < 0` | `false` | inclusions.js, calculer, if (false) au lieu de q < 0 au compte des organisations couvertes : une ligne d'organisation, q < 0, lit groupe[q], undefined hors du tableau typé, qui n'égale pas SANS_GROUPE, puis incluse[undefined], undefined, différent de p : continue, comme sans le mutant. |
| `src/moteur/inclusions.js:120:18` | corps-si | `continue;` | `{}` | inclusions.js, calculer, continue retiré sous q < 0 au compte des organisations couvertes : même effet que le mutant if (false) du même if — groupe[q] et incluse[undefined] valent undefined, et la ligne suivante fait continue. |
| `src/moteur/inclusions.js:141:21` | frontiere | `<` | `<=` | inclusions.js, calculer, p <= N au relevé des partenaires : le tour de trop va de inclusionDebut[N] à inclusionDebut[N + 1], undefined, et i < undefined est faux : rien ne se lit ni ne s'écrit. |
| `src/moteur/inclusions.js:145:18` | ternaire-faux | `q < 0` | `false` | inclusions.js, calculer, paire calculée même sans partenaire (q = −1) : min(p, −1) × N + max(p, −1) vaut p − N, entre −N et −1, négatif comme −1 ; la paire ne se lit que par paire[i] >= 0, dans reserver et au relevé des réciproques, faux dans les deux cas. |
| `src/moteur/inclusions.js:145:27` | nombre-plus-un | `1` | `2` | inclusions.js, calculer, paire = −2 au lieu de −1 sans partenaire : la paire ne se lit que par paire[i] >= 0, faux pour l'un comme pour l'autre. |
| `src/moteur/inclusions.js:145:46` | arithmetique | `*` | `/` | inclusions.js, calculer, paire min / N + max au lieu de min × N + max : min < N, donc min / N est dans [0, 1[ et la paire reste positive et injective — deux paires de même valeur ont le même max, puis le même min — ; elle ne sert que de clé à reservee et à demandeurs, et par paire[i] >= 0. |
| `src/moteur/inclusions.js:146:11` | si-vrai | `q >= 0` | `true` | inclusions.js, calculer, if (true) au relevé des demandeurs : une ligne sans partenaire ajoute à demandeurs la clé −1, que rien ne lit — la Map ne se consulte que pour une paire[i] >= 0. |
| `src/moteur/inclusions.js:146:81` | frontiere | `<` | `<=` | inclusions.js, calculer, p <= q au bit du demandeur : la source n'est jamais son propre partenaire — l'inclusion de soi est refusée, et sa propre organisation ne fait aucune ligne —, donc p ≠ q. |
| `src/moteur/inclusions.js:146:81` | negation | `<` | `>=` | inclusions.js, calculer, p >= q au bit du demandeur : les deux bits s'échangent ; demandeurs ne se lit que par === 3, vrai quand les deux personnes de la paire la demandent, quel que soit le bit de chacune, et jamais quand une seule la demande, autant de fois que ce soit. |
| `src/moteur/inclusions.js:155:18` | frontiere | `>=` | `>` | inclusions.js, calculer, reserver, paire[i] > 0 : une paire vaut min × N + max avec max > min ≥ 0, donc au moins 1 ; seule l'absence de paire, −1, est négative, et 0 n'est jamais une paire. |
| `src/moteur/inclusions.js:155:21` | nombre-plus-un | `0` | `1` | inclusions.js, calculer, reserver, paire[i] >= 1 : une paire vaut min × N + max avec max > min ≥ 0, donc au moins 1 ; seule l'absence de paire, −1, est négative, et les deux conditions coïncident. |
| `src/moteur/inclusions.js:159:16` | nombre-plus-un | `1` | `2` | inclusions.js, calculer, porte[i] = 2 au lieu de 1 : porte ne se lit que par porte[i] === 0. |
| `src/moteur/inclusions.js:161:21` | frontiere | `<` | `<=` | inclusions.js, calculer, p <= N à la réservation : le tour de trop lit auDela[N], undefined, différent de 1, puis va de inclusionDebut[N] à inclusionDebut[N + 1], undefined : i < undefined est faux, rien ne se réserve. |
| `src/moteur/inclusions.js:164:76` | si-vrai | `inclusionCible[i] < 0` | `true` | inclusions.js, calculer, if (true) au second passage de la réservation : chaque ligne de personne y repasse ; sa paire, réservée au premier passage par cette source ou avant elle, est déjà dans reservee, et reserver rend sans rien marquer. |
| `src/moteur/inclusions.js:164:94` | frontiere | `<` | `<=` | inclusions.js, calculer, inclusionCible[i] <= 0 au second passage de la réservation : la seule ligne de plus, la personne d'index 0, repasse ; sa paire est déjà dans reservee (voir le mutant if (true) du même passage). |
| `src/moteur/inclusions.js:164:96` | nombre-plus-un | `0` | `1` | inclusions.js, calculer, inclusionCible[i] < 1 au second passage de la réservation : la seule ligne de plus, la personne d'index 0, repasse ; sa paire est déjà dans reservee (voir le mutant if (true) du même passage). |
| `src/moteur/inclusions.js:169:21` | frontiere | `<` | `<=` | inclusions.js, calculer, p <= N au relevé des unités : le tour de trop va de inclusionDebut[N] à inclusionDebut[N + 1], undefined : i < undefined est faux, rien ne s'ajoute. |
| `src/moteur/inclusions.js:174:33` | frontiere | `>=` | `>` | inclusions.js, calculer, paire[i] > 0 au relevé des réciproques : une paire vaut min × N + max avec max > min ≥ 0, donc au moins 1 ; seule l'absence de paire, −1, est négative, et 0 n'est jamais une paire. |
| `src/moteur/inclusions.js:174:36` | nombre-plus-un | `0` | `1` | inclusions.js, calculer, paire[i] >= 1 au relevé des réciproques : une paire vaut min × N + max avec max > min ≥ 0, donc au moins 1 ; seule l'absence de paire, −1, est négative, et les deux conditions coïncident. |
| `src/moteur/indicateurs.js:229:45` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, rencontre rempli de −2 au lieu de −1 : la marque ne se lit que par rencontre[f] === p, p ≥ 0 ; ni −1 ni −2 n'égale une personne. |
| `src/moteur/indicateurs.js:259:21` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, visites[t] += 2 au lieu de 1 : visites[t] ne se lit que par visites[t] > 0 et se remet à 0 après chaque personne ; un pas de 2 garde le signe, aucune sortie ne change. |
| `src/moteur/indicateurs.js:260:40` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, reserveeAvant[t] = 2 au lieu de 1 : la marque ne se lit que par reserveeAvant[t] === 0. |
| `src/moteur/indicateurs.js:262:23` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, remise à zéro jusqu'à r <= R : le tour de trop lit la première case de la personne suivante, dont la table vaut 0 dans visites et reserveeAvant sauf si la personne courante l'a visitée, auquel cas la boucle la remet à 0 de toute façon ; pour la dernière personne la case est undefined, et une écriture à l'index undefined pose une propriété hors des éléments du tableau typé, que rien ne lit. |
| `src/moteur/indicateurs.js:264:11` | si-faux | `t === RESERVE` | `false` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:264:26` | corps-si | `continue;` | `{}` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:294:25` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, i <= liste.length : le tour de trop lit a = undefined ; revenu[NaN] et fixe[NaN] sont undefined, rien n'est poussé, et la boucle intérieure part de j = length + 1, au-delà de la liste. |
| `src/moteur/indicateurs.js:300:31` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, j <= liste.length : le tour de trop lit b = undefined ; k = rangPaire(N, a, undefined) vaut NaN, parPaire[NaN] et libre[NaN] n'écrivent rien sur un tableau typé, groupe[undefined] n'égale aucun groupe et parPaire[NaN] >= 2 est faux : ni collègue ni revue n'est poussé. |
| `src/moteur/indicateurs.js:359:21` | frontiere | `<` | `<=` | indicateurs.js, lirePaires, i <= reunies.length : reunies a une longueur paire, le tour de trop lit a = b = undefined. rencontres[undefined] et affilies[undefined] posent une propriété « undefined » sur l'Int32Array, que Array.from (mesurer) ne lit pas ; groupe[undefined] n'égale pas SANS_GROUPE, mais vu[NaN] se lit undefined, jamais === 0 ; n = parPaire[NaN] est undefined, ni > maxRencontresPaire ni >= 2. |
| `src/moteur/indicateurs.js:365:11` | frontiere | `>` | `>=` | indicateurs.js, lirePaires, n >= maxRencontresPaire : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/indicateurs.js:387:21` | frontiere | `<` | `<=` | indicateurs.js, inclusionSatisfaite, p <= cible : une ligne de personne ne vise jamais sa source — l'inclusion de soi est refusée à la normalisation —, donc p ≠ cible, et les deux rangs coïncident. |
| `src/moteur/indicateurs.js:443:32` | arithmetique | `-` | `+` | indicateurs.js, lireTours, nombrePaires = N(N + 1)/2 : ne dimensionne que collegueVu et revueVue, indexés par rangPaire, toujours < N(N − 1)/2 ; un tableau plus long garde les mêmes cases utiles, les autres ne se lisent jamais. |
| `src/moteur/indicateurs.js:443:34` | nombre-zero | `1` | `0` | indicateurs.js, lireTours, nombrePaires = N·N/2 : même raison que N(N + 1)/2 — une longueur au moins égale (tronquée à l'entier par le constructeur du tableau typé) pour des index rangPaire < N(N − 1)/2. |
| `src/moteur/indicateurs.js:443:38` | arithmetique | `/` | `*` | indicateurs.js, lireTours, nombrePaires = 2N(N − 1) : longueur au moins égale à N(N − 1)/2, mêmes cases utiles, les autres jamais lues. |
| `src/moteur/indicateurs.js:459:27` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, collegueVu[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:466:25` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, revueVue[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:478:48` | nombre-plus-un | `0` | `1` | indicateurs.js, VIDE.somme = 1 : la somme de VIDE ne se lit jamais. ajouter ouvre un cumul neuf sans la lire, et conclure ne la lit que pour un effectif non nul ; VIDE a un effectif nul et rend moyenne null. |
| `src/moteur/indicateurs.js:485:14` | frontiere | `<` | `<=` | indicateurs.js, ajouter, valeur <= min : à égalité, le minimum retenu est la même valeur ; aucune valeur agrégée ne vaut −0 (comptes entiers, différences de comptes, quotient A/\|F\| à \|F\| > 0). |
| `src/moteur/indicateurs.js:518:21` | frontiere | `<` | `<=` | indicateurs.js, lireObjectifs, p <= N au compte des concernés : P[N] est undefined hors du tableau typé, et undefined > 0 est faux : concernes ne change pas. |
| `src/moteur/indicateurs.js:526:15` | nombre-plus-un | `0` | `1` | indicateurs.js, lireObjectifs, auMax part de 1 : quand E reste à 0, personnesAuMax vaut 0 quelle que soit la valeur ; sinon E a grandi au moins une fois, chaque croissance remet auMax à 0, et seuls comptent les incréments qui suivent la dernière : la valeur initiale ne survit jamais. |
| `src/moteur/indicateurs.js:561:21` | frontiere | `<` | `<=` | indicateurs.js, lireAnimateurs, p <= N au compte des concernés : borneAnimateurs[N] est undefined, et undefined > 0 est faux ; concernes ne bouge pas. |
| `src/moteur/indicateurs.js:607:21` | frontiere | `<` | `<=` | indicateurs.js, mesurer, p <= N au compte des effectifs : groupe[N] est undefined, différent de SANS_GROUPE ; effectifs[undefined] += 1 pose une propriété « undefined » sur un tableau ordinaire, et parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:608:9` | si-vrai | `groupe[p] !== SANS_GROUPE` | `true` | indicateurs.js, mesurer, if (true) au compte des effectifs : une personne sans appartenance incrémente effectifs[SANS_GROUPE], soit effectifs[−1], propriété hors des index d'un tableau ordinaire ; parGroupe ne lit que les index 0 à G − 1. |
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
| `src/moteur/plafond.js:400:18` | nombre-plus-un | `1` | `2` | plafond.js, lireProgramme, plafond part de −2 : l'état (f, W) est toujours atteint — la table de plus grand v prise f fois — avec une somme d'ancrés ≥ 0, et sa borne vaut au moins 0 ; le maximum ne dépend pas de la valeur initiale, pourvu qu'elle ne dépasse pas 0. |
| `src/moteur/plafond.js:400:18` | nombre-zero | `1` | `0` | plafond.js, lireProgramme, plafond part de −0 : même raison que −2 — un état atteint donne une borne x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:401:21` | frontiere | `<` | `<=` | plafond.js, lireProgramme, w <= rangee.length : rangee[rangee.length] est undefined sur un tableau typé, undefined >= 0 est faux, rien ne s'ajoute. |
| `src/moteur/plafond.js:403:9` | si-vrai | `ajout >= 0` | `true` | plafond.js, lireProgramme, if (true) sur ajout >= 0 : un état inatteignable porte −1, soit ancres0 − 1, à un w ≤ W ; l'état (f, W) est atteint avec une somme ≥ 0, et la borne, croissante en ses deux termes, y vaut au moins autant : un état inatteignable ne l'emporte jamais. |
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
| `src/moteur/qualite.js:563:40` | nombre-plus-un | `1` | `2` | qualite.js, barresCollisions, comparer rend -2 au lieu de -1 : la valeur ne se lit que par \|\| (non nulle dans les deux cas) et par le tri, qui n'en retient que le signe. |
| `src/moteur/qualite.js:563:52` | nombre-plus-un | `1` | `2` | qualite.js, barresCollisions, comparer rend 2 au lieu de 1 : la valeur ne se lit que par \|\| (non nulle dans les deux cas) et par le tri, qui n'en retient que le signe. |
| `src/moteur/qualite.js:606:38` | nombre-plus-un | `1` | `2` | qualite.js, mixTables, vu rempli de -2 au lieu de -1 : vu[b] ne se lit que par vu[b] === jeton, et jeton = t · R + r vaut 0 au moins ; ni -1 ni -2 ne l'égale. |
| `src/moteur/qualite.js:693:19` | nombre-plus-un | `0` | `1` | qualite.js, objectifsParTour, pireReste initialisé à 1 au lieu de 0 : pireReste ne se lit que dans pireTour === null \|\| reste > pireReste ; au premier tour lu pireTour vaut null, le \|\| ne lit pas pireReste, et la même branche l'affecte à reste. |
| `src/moteur/recherche.js:344:20` | nombre-plus-un | `0xffff` | `65536` | recherche.js, UINT16_MAX = 65 536 : seul R = 65 536 change de tableau, et un Uint16Array y reste exact. Le compte d'une paire va de 0 à R ; modifierPaire ne le lit que par avant !== 0 à un ajout et apres !== 0 à un retrait. Un compte vrai de 65 536 se range 0, mais un ajout depuis 65 536 ou un retrait depuis 65 537 exigent R ≥ 65 537 : le compte rangé modulo 2^16 donne toujours la même décision. |
| `src/moteur/recherche.js:344:20` | nombre-zero | `0xffff` | `0` | recherche.js, UINT16_MAX = 0 : R ≥ 1 donne toujours un Uint32Array à paires, qui tient tout compte de 0 à R ; mêmes valeurs lues, seule la mémoire double. paires n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:347:19` | nombre-plus-un | `0xff` | `256` | recherche.js, UINT8_MAX = 256 : seul R = 256 change de tableau, et un Uint8Array y reste exact. Le compte d'un couple (personne, animateur) va de 0 au nombre de tours où l'animateur anime, ≤ R ; changerAnimateurs ne le lit que par avant === 0 à un ajout et avant === 1 à un retrait. Confondre 256 avec 0, ou 257 avec 1, exige un ajout depuis 256 ou un retrait depuis 257, donc R ≥ 257. |
| `src/moteur/recherche.js:347:19` | nombre-zero | `0xff` | `0` | recherche.js, UINT8_MAX = 0 : R ≥ 1 donne toujours un Uint32Array à rencontresAnimees, qui tient tout compte de 0 à R ; mêmes valeurs, seule la largeur des éléments change, que rien ne lit. |
| `src/moteur/recherche.js:522:36` | nombre-plus-un | `1` | `2` | recherche.js, unitesDeRecherche, debut de N + 2 cases : la case de plus vaut 0 et n'est jamais lue — relireInclusions ne lit debut qu'aux index p et p + 1 d'une personne, p < N. |
| `src/moteur/recherche.js:524:47` | nombre-plus-un | `1` | `2` | recherche.js, unitesDeRecherche, debutPartenaires de U + 2 cases : la case de plus vaut 0 et n'est jamais lue — rapprocher ne lit debutPartenaires qu'aux index u et u + 1 d'une unité, u < U. |
| `src/moteur/recherche.js:563:36` | nombre-plus-un | `1` | `2` | recherche.js, preparer, debut de longueur T + 2 : la boucle ne remplit que debut[0..T], la case T + 1 reste 0 ; preparer, voisiner, remplisseur et etatInitial ne lisent debut[t + 1] que pour t < T. debut n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:564:21` | frontiere | `<` | `<=` | recherche.js, preparer, t <= T au calcul de debut : le tour de trop écrit debut[T + 1] = debut[T] + capacite[T], soit NaN à un index hors d'un Int32Array de longueur T + 1, qui n'écrit rien. |
| `src/moteur/recherche.js:567:16` | nombre-plus-un | `0` | `1` | recherche.js, preparer, tableDuSiege rempli à partir de t = 1 : les sièges de la table 0 gardent la valeur initiale d'un Int32Array neuf, 0, l'index de leur table. |
| `src/moteur/recherche.js:567:21` | frontiere | `<` | `<=` | recherche.js, preparer, t <= T au remplissage de tableDuSiege : le tour de trop fait fill(T, debut[T], undefined), soit de S à la fin d'un tableau de longueur S : aucune case. |
| `src/moteur/recherche.js:567:75` | nombre-plus-un | `1` | `2` | recherche.js, preparer, fill(t, debut[t], debut[t + 2]) : la table t déborde sur les sièges de t + 1, que l'itération suivante récrit à t + 1 ; au dernier tour, debut[T + 1] est undefined et fill va jusqu'à la fin, qui est debut[T] : mêmes cases finales. |
| `src/moteur/recherche.js:577:45` | nombre-plus-un | `1` | `2` | recherche.js, preparer, mobilesDe de R × (T + 2) cases : chaque tour n'en écrit et n'en lit que T + 1, à partir de r × (T + 1) ; les R cases de plus, en fin de tableau, restent à 0 et ne se lisent jamais. |
| `src/moteur/recherche.js:580:21` | frontiere | `<` | `<=` | recherche.js, preparer, r <= R : au tour de trop, fixe[p × R + R] lit la case du tour 0 de la personne suivante (undefined pour la dernière) ; une personne fixée y écrit siegesFixes et mobiles à des index ≥ R × S, hors des tableaux typés, qui n'écrivent rien, occupes est remis à zéro en tête de chaque tour, nombreMobiles[R] est hors du tableau, et libres reçoit une R + 1e liste que etatInitial et remplisseur ne lisent pas (r < R). |
| `src/moteur/recherche.js:583:23` | frontiere | `<` | `<=` | recherche.js, preparer, p <= N aux sièges fixés : fixe[N × R + r] est undefined, différent de LIBRE ; siegesFixes[r × S + debut[undefined] + occupes[undefined]] est un index NaN, qui n'écrit rien dans un tableau typé, et occupes[undefined] += 1 pose une propriété « undefined » que rien ne lit. |
| `src/moteur/recherche.js:611:21` | frontiere | `<` | `<=` | recherche.js, preparer, p <= N au seuil des retours : fixe[N × R + r] est undefined, différent de LIBRE, et seuilRetour[N × T + undefined] += 1 vise l'index NaN, qui n'écrit rien dans un tableau typé. |
| `src/moteur/recherche.js:617:21` | frontiere | `<` | `<=` | recherche.js, preparer, i <= seuilRetour.length : seuilRetour[length] est undefined, jamais === 0, rien n'est écrit. |
| `src/moteur/recherche.js:622:19` | nombre-plus-un | `0` | `1` | recherche.js, preparer, plusGrand part de 1 : largeurHistogramme ne vaut 2 au lieu de 1 que si tous les plafonds a priori sont nuls ; l'histogramme des écarts n'est indexé que par des écarts de 0 à aPriori[p], la case de plus reste 0 et ne se lit pas. histogramme n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:643:37` | nombre-plus-un | `1` | `2` | recherche.js, preparer, largeurHistogramme = plusGrand + 2 : un histogramme d'une case de plus, jamais indexée (écarts de 0 à aPriori[p] ≤ plusGrand) ; mêmes valeurs lues. |
| `src/moteur/recherche.js:661:13` | frontiere | `>` | `>=` | recherche.js, changerRencontres, apres >= ecartMax : à égalité, l'affectation écrit la valeur déjà retenue ; la branche else-if qu'elle court-circuite exige avant === ecartMax, impossible quand apres === ecartMax puisque avant = apres + sens, sens = ±1. |
| `src/moteur/recherche.js:677:23` | frontiere | `>` | `>=` | recherche.js, changerAffilie, sens >= 0 : modifierPaire ne passe que sens = 1 ou −1, jamais 0 ; les deux tests départagent les mêmes valeurs. |
| `src/moteur/recherche.js:693:15` | frontiere | `<` | `<=` | recherche.js, modifierPaire, a <= b : modifierPaire n'est appelé que pour a ≠ b (voisiner saute le siège exclu, etatInitial ne lit que les sièges avant s, chacun porte une autre personne), où <= et < coïncident. |
| `src/moteur/recherche.js:701:13` | frontiere | `>` | `>=` | recherche.js, modifierPaire, sens >= 0 : sens vaut 1 ou −1 (voisiner, etatInitial), jamais 0. |
| `src/moteur/recherche.js:726:27` | frontiere | `>` | `>=` | recherche.js, changerServis, sens >= 0 : changerTable ne l'appelle qu'avec ecart ≠ 0, différence de deux valeurs de sert dans {0, 1}, donc ±1. |
| `src/moteur/recherche.js:727:13` | frontiere | `>` | `>=` | recherche.js, changerServis, apres >= horsObjectifMax : à égalité, l'affectation écrit la valeur déjà retenue ; la branche else-if exige avant === horsObjectifMax, impossible quand apres === horsObjectifMax puisque avant = apres + sens, sens = ±1. |
| `src/moteur/recherche.js:755:25` | frontiere | `>` | `>=` | recherche.js, changerAnimateurs, sens >= 0 : echanger, par changerTable, et etatInitial ne passent que sens = 1 ou −1. |
| `src/moteur/recherche.js:766:7` | si-vrai | `etat.O > 0` | `true` | recherche.js, changerTable, if (true) au lieu de etat.O > 0 : O, le nombre d'objectifs distincts, vaut 0 seulement quand la configuration n'en a aucun ; numeroterObjectifs (configuration.js) écrit alors SANS_OBJECTIF dans chaque case d'objectifDe, sert rend 0 aux deux tables, l'écart est nul et changerServis n'est pas appelé. Le test n'épargne que du temps. |
| `src/moteur/recherche.js:766:14` | frontiere | `>` | `>=` | recherche.js, changerTable, etat.O >= 0 : toujours vrai, même effet que if (true) — sans objectif, objectifDe ne porte que SANS_OBJECTIF, sert rend 0 et l'écart est nul ; seul le temps change. |
| `src/moteur/recherche.js:768:9` | si-vrai | `ecart !== 0` | `true` | recherche.js, changerTable, changerServis appelé même pour un écart nul : avec sens = 0, avant = apres, servis et horsObjectif ne bougent pas, l'histogramme perd puis regagne la même case, jamaisServies -= 0 ; apres > max est faux (apres = avant ≤ max), le else-if ne réécrit max qu'à sa propre valeur, et personnesAuMax se recalcule des mêmes valeurs. Une personne non concernée a s(p) = 0 (une table qui la sert rendrait le tour possible) et avant = 0. |
| `src/moteur/recherche.js:822:9` | si-faux | `s === exclu` | `false` | recherche.js, changerConflits, sans le saut du siège exclu : voisiner, son seul appelant, lui passe le siège exclu que echanger lui donne, celui où se tient p lui-même ; l'occupant lu est p, d'unité u, et conflitEntre[u × K + u] vaut 0 — relierConflits ne lie jamais une unité à elle-même (g !== unite), et deux unités distinctes ont des rangs distincts : rien ne s'ajoute. |
| `src/moteur/recherche.js:822:22` | corps-si | `continue;` | `{}` | recherche.js, changerConflits, if (s === exclu) {} : même effet que le mutant si-faux du même if — l'occupant du siège exclu est p lui-même, et conflitEntre[u × K + u] vaut 0 : rien ne s'ajoute. |
| `src/moteur/recherche.js:824:9` | si-faux | `q === FANTOME` | `false` | recherche.js, changerConflits, sans le saut des places fantômes : FANTOME vaut −1, uniteConflit[−1] est undefined hors du tableau typé, et undefined >= 0 est faux : rien ne s'ajoute. |
| `src/moteur/recherche.js:824:24` | corps-si | `continue;` | `{}` | recherche.js, changerConflits, if (q === FANTOME) {} : même effet que le mutant si-faux du même if — uniteConflit[−1] vaut undefined, et undefined >= 0 est faux. |
| `src/moteur/recherche.js:838:9` | si-faux | `s === exclu` | `false` | recherche.js, voisiner, sans le saut du siège exclu : avant l'échange, le siège exclu porte p, qui modifie la paire (p, p) de −1 ; après, il porte p de nouveau à son siège d'arrivée, qui la modifie de +1. Le tableau non signé passe de 0 au maximum puis revient à 0 ; à −1, apres = −1 ≠ 0 compte une répétition retirée, à +1, avant ≠ 0 en rend une : excedentPaires, et collisions cumulées et excédent pour une personne à organisation, reviennent à leur valeur dans le même échange, avant toute lecture du score, et rencontres comme affiliés ne bougent pas. |
| `src/moteur/recherche.js:838:22` | corps-si | `continue;` | `{}` | recherche.js, voisiner, if (s === exclu) {} : même effet que la suppression du test — la paire (p, p) reçoit −1 avant l'échange et +1 après, dans le même échange ; le tableau non signé revient à 0 et chaque compteur à sa valeur avant toute lecture. |
| `src/moteur/recherche.js:843:7` | si-vrai | `u >= 0` | `true` | recherche.js, voisiner, if (true) au lieu de u >= 0 : changerConflits reçoit u = −1 ; pour un occupant d'unité v, 0 ≤ v < K, l'index u × K + v = v − K est négatif, hors des éléments du tableau typé conflitEntre, undefined, qui n'égale pas 1 : rien ne s'ajoute. Seul le temps change. |
| `src/moteur/recherche.js:877:9` | si-vrai | `x !== FANTOME` | `true` | recherche.js, echanger, relireInclusions même pour x fantôme : relireInclusions(etat, −1) va de debut[−1], undefined hors du tableau typé, à debut[0], et undefined < debut[0] est faux : rien ne se relit. Performance seule. |
| `src/moteur/recherche.js:878:9` | si-vrai | `y !== FANTOME` | `true` | recherche.js, echanger, relireInclusions même pour y fantôme : relireInclusions(etat, −1) va de debut[−1], undefined hors du tableau typé, à debut[0], et undefined < debut[0] est faux : rien ne se relit. Performance seule. |
| `src/moteur/recherche.js:937:13` | ternaire-faux | `R <= UINT16_MAX` | `false` | recherche.js, etatInitial, paires toujours en Uint32Array : il tient tout compte de 0 à R ; mêmes valeurs lues, seule la mémoire double. |
| `src/moteur/recherche.js:937:15` | frontiere | `<=` | `<` | recherche.js, etatInitial, R < UINT16_MAX : seul R = 65 535 passe à un Uint32Array, qui tient les mêmes comptes ; seule la mémoire change. |
| `src/moteur/recherche.js:959:46` | nombre-plus-un | `1` | `2` | recherche.js, etatInitial, histogrammeObjectifs de longueur R + 2 : il n'est indexé que par P(p) − s(p), de 0 à P(p) ≤ R ; la case de plus reste 0 et ne se lit pas. histogrammeObjectifs n'est pas un champ que EtatRecherche déclare lisible. |
| `src/moteur/recherche.js:963:21` | nombre-plus-un | `0` | `1` | recherche.js, etatInitial, personnesAuMax: 1 à la création de l'état : la valeur est récrite sans condition en fin d'etatInitial, avant tout retour et toute lecture. |
| `src/moteur/recherche.js:974:9` | ternaire-faux | `R <= UINT8_MAX` | `false` | recherche.js, etatInitial, rencontresAnimees toujours en Uint32Array quand l'état suit les animateurs : il tient tout compte de 0 à R ; mêmes valeurs, seule la largeur des éléments change. |
| `src/moteur/recherche.js:974:11` | frontiere | `<=` | `<` | recherche.js, etatInitial, R < UINT8_MAX : seul R = 255 passe à un Uint32Array, qui tient les mêmes comptes ; seule la mémoire change. |
| `src/moteur/recherche.js:976:30` | ternaire-faux | `suitAnimateurs` | `false` | recherche.js, etatInitial, animateursNonRencontres part de null même quand l'état suit les animateurs : la boucle qui suit y ajoute borneAnimateurs[p] pour chaque personne, et null + n vaut n. suitAnimateurs exige le critère non sans objet, donc une borne non nulle et N ≥ 1 : la boucle tourne au moins une fois, et la valeur est la même. |
| `src/moteur/recherche.js:991:14` | ternaire-vrai | `suitInclusions` | `true` | recherche.js, etatInitial, options alloué même sans inclusions : seul reunir le lit, et rapprocher n'est tiré que quand l'état suit les inclusions (descendre, avecRapprochement) : une allocation de plus, sans effet. |
| `src/moteur/recherche.js:991:46` | nombre-plus-un | `2` | `3` | recherche.js, etatInitial, options de 3 × R cases au lieu de 2 × R : reunir en écrit au plus deux par tour, sur au plus R tours, et n'en lit que les n écrites. |
| `src/moteur/recherche.js:1023:52` | frontiere | `<` | `<=` | recherche.js, etatInitial, voisin <= s dans le compte des conflits au départ : le siège de trop est celui de p lui-même, d'unité u ; conflitEntre[u × K + u] vaut 0, relierConflits ne liant jamais une unité à elle-même et deux unités distinctes ayant des rangs distincts : rien ne s'ajoute. |
| `src/moteur/recherche.js:1025:19` | ternaire-faux | `q === FANTOME` | `false` | recherche.js, etatInitial, v lu par uniteConflit[q] même pour une place fantôme : FANTOME vaut −1, uniteConflit[−1] est undefined hors du tableau typé, et undefined >= 0 est faux, comme −1 >= 0. |
| `src/moteur/recherche.js:1025:36` | nombre-plus-un | `1` | `2` | recherche.js, etatInitial, v = −2 au lieu de −1 pour une place fantôme : v ne se lit que par v >= 0, faux pour l'un comme pour l'autre. |
| `src/moteur/recherche.js:1029:11` | si-vrai | `etat.O > 0` | `true` | recherche.js, etatInitial, servis[p] += sert(...) sans le test etat.O > 0 : sans objectif, objectifDe ne porte que SANS_OBJECTIF (configuration.js, numeroterObjectifs), sert rend 0 et la somme ne change pas ; seul le temps change. |
| `src/moteur/recherche.js:1029:18` | frontiere | `>` | `>=` | recherche.js, etatInitial, etat.O >= 0 : toujours vrai, même effet que sans test — sans objectif, sert rend 0. |
| `src/moteur/recherche.js:1137:19` | ternaire-vrai | `forme.suitInclusions` | `true` | recherche.js, descendre, avecRapprochement même sans inclusions : l'état y porte inclusionsNonSatisfaites à null, null > 0 est faux, et chaque mouvement est base(etat, rng), sans tirage de plus : une enveloppe de plus, performance seule. |
| `src/moteur/recherche.js:1177:9` | si-vrai | `mouvement !== null` | `true` | recherche.js, descendre, évaluation d'un mouvement null : rien n'a changé, le candidat égale le score courant, la première comparaison (<= 0) l'accepte, change vaut faux, courant reçoit sa propre valeur, et retenir ne change rien, la meilleure affectation n'étant jamais pire que le score courant ; defaire n'est pas atteint. |
| `src/moteur/recherche.js:1235:21` | nombre-plus-un | `3` | `4` | recherche.js, EN_RESERVE = −4 au lieu de −3 : la sentinelle n'est écrite que par tableDuDepart, comparée à NON_ASSIS (−2) par !== et lue par t >= 0, puis remplacée par RESERVE au même tour avant que tableDe soit rendu ; toute valeur négative distincte de −2 tient le même rôle. |
| `src/moteur/recherche.js:1253:11` | frontiere | `>` | `>=` | recherche.js, exigerToursFiges, i >= 0 : pour i = 0, toursFiges[−1] est undefined, et tour <= undefined est faux pour tout entier ; aucun refus de plus. |
| `src/moteur/recherche.js:1343:23` | frontiere | `<` | `<=` | recherche.js, tableDuDepart, t <= T au contrôle des capacités : occupants[T] et capacite[T] sont undefined, et undefined > undefined est faux ; aucun refus de plus. |
| `src/moteur/recherche.js:1351:23` | frontiere | `<` | `<=` | recherche.js, tableDuDepart, p <= N au contrôle des absents et des fixés : tableDe[N × R + r] est hors du tableau, undefined, différent de NON_ASSIS ; fixe[N × R + r] aussi, et undefined !== t, t valant undefined, est faux : aucun refus de plus. |
| `src/moteur/recherche.js:1355:29` | corps-si | `{ tableDe[i] = RESERVE; }` | `{}` | recherche.js, tableDuDepart, corps vide pour un absent (tableDe[i] = RESERVE retiré) : la case d'un absent reste NON_ASSIS, mais aucun lecteur ne la lit — remplisseur ne lit tableDe que pour les libres présents (libres[r]), la boucle des libres en trop la compare à t ≥ 0 comme RESERVE, et l'état de recherche refait son tableDe depuis les sièges ; la sortie ne change pas. |
| `src/moteur/recherche.js:1363:13` | si-vrai | `fixee !== LIBRE` | `true` | recherche.js, tableDuDepart, fixee !== LIBRE → true : pour une libre à asseoir, occupants[LIBRE] += 1 écrit à l'index −1 d'un Int32Array, écriture que le tableau typé ignore ; aucun compte de table ne change. |
| `src/moteur/recherche.js:1370:22` | arithmetique | `-` | `+` | recherche.js, tableDuDepart, départ de la boucle des libres en trop à N + 1 au lieu de N − 1 : les deux premiers p lisent tableDe au-delà de N × R, undefined !== t, et continuent sans rien changer ; la boucle reprend à N − 1 comme l'original. |
| `src/moteur/recherche.js:1370:24` | nombre-zero | `1` | `0` | recherche.js, tableDuDepart, départ de la boucle des libres en trop à N au lieu de N − 1 : le premier p lit tableDe au-delà de N × R, undefined !== t, et continue sans rien changer ; la boucle reprend à N − 1 comme l'original. |
| `src/moteur/recherche.js:1393:22` | booleen | `false` | `true` | recherche.js, structureDuDepart, fixeeImposee = true : la copie se fait toujours. Sans réserve imposée fixée, elle égale structure champ pour champ — imposee ne marque que des libres, dont aucune case n'entre dans seuilRetour, et une animatrice est fixée au tour qu'elle anime (deriverAnimateurs), donc aucune n'est retirée des animes — : seule une allocation de plus, sortie anticipée de performance. |
| `src/moteur/recherche.js:1394:21` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, i <= N × R : la case de plus lit imposee[N × R], undefined === 1 faux, et ne change pas fixeeImposee. |
| `src/moteur/recherche.js:1394:42` | si-vrai | `imposee[i] === 1 && fixe[i] !== LIBRE` | `true` | recherche.js, structureDuDepart, condition de fixeeImposee → true : la copie se fait dès que N × R > 0, toujours ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1394:59` | logique | `imposee[i] === 1 && fixe[i] !== LIBRE` | `((imposee[i] === 1 )\|\|( fixe[i] !== LIBRE))` | recherche.js, structureDuDepart, && → \|\| dans la détection : la copie se fait aussi quand une case est fixée ou imposée sans les deux ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1395:7` | si-faux | `!fixeeImposee` | `false` | recherche.js, structureDuDepart, !fixeeImposee → false : la sortie anticipée ne joue jamais, la copie se fait toujours ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1395:22` | corps-si | `return structure;` | `{}` | recherche.js, structureDuDepart, return structure retiré : la copie se fait toujours ; sans réserve imposée fixée elle égale structure champ pour champ (voir fixeeImposee = true) : performance seule. |
| `src/moteur/recherche.js:1397:21` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, p <= N au seuil des retours : le tour de trop lit fixe[N × R + r], undefined, différent de LIBRE, puis imposee[N × R + r], undefined hors du tableau typé, qui n'égale pas 0 : rien ne s'écrit. |
| `src/moteur/recherche.js:1403:21` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, i <= seuilRetour.length : la case de plus lit seuilRetour au-delà du tableau, undefined === 0 faux, et n'écrit rien. |
| `src/moteur/recherche.js:1406:40` | nombre-plus-un | `1` | `2` | recherche.js, structureDuDepart, debut de T × R + 2 cases : la case de plus vaut 0 et n'est jamais lue — changerAnimateurs ne lit debutAnimes qu'aux lignes 0 à T × R, et ni bornerAnimateurs ni mesurer ne lisent la copie. |
| `src/moteur/recherche.js:1408:29` | frontiere | `<` | `<=` | recherche.js, structureDuDepart, ligne <= T × R : la ligne de plus part de k = debutAnimes[T × R] = animes.length ; k < debutAnimes[T × R + 1], undefined, est faux, aucun animateur n'est parcouru, et debut[T × R + 1] s'écrit hors du tableau typé, écriture ignorée. |
| `src/moteur/recherche.js:1441:25` | frontiere | `<` | `<=` | recherche.js, remplisseur, t <= T : la table de plus part de s = debut[T] = S, s < debut[T + 1] (undefined) est faux, et prochain[T], laisse[T] s'écrivent hors des Int32Array de T cases, écritures ignorées. |
| `src/moteur/recherche.js:1443:18` | frontiere | `<` | `<=` | recherche.js, remplisseur, s <= debut[t + 1] : la boucle ne passe la fin de la table t que si chacun de ses sièges est fixé. Une telle table ne reçoit aucun libre dans un départ contrôlé : ses fixés y sont assis (tableDuDepart refuse un fixé assis ailleurs), ils la remplissent, et un libre de plus la ferait déborder, ce que tableDuDepart refuse. prochain[t] n'y est donc jamais lu. |
| `src/moteur/recherche.js:1456:24` | nombre-zero | `1` | `0` | recherche.js, remplisseur, laisse[t] += 0 : laisse reste sur le siège qu'il vient d'occuper ; le libre suivant de la table le trouve occupé, avance d'un siège dans la boucle while, et prend la même place que l'original. |
| `src/moteur/recherche.js:1508:11` | si-vrai | `choix !== a` | `true` | recherche.js, placerArrivantsFiges, choix !== a → true : quand l'arrivante garde son siège, echanger(etat, r, a, a) retire deux fois puis rajoute deux fois les mêmes voisins, les mêmes visites et les mêmes animateurs ; chaque pas défait exactement le précédent (un compte de paire à 0 passe par 2^16 − 1 ou 2^32 − 1 et revient à 0 sans toucher aux rencontres), et l'état rendu est identique : performance seule. |
| `src/moteur/recherche.js:1532:21` | frontiere | `<` | `<=` | recherche.js, preparerDepart, r <= R dans le relevé des tours tirables : la case de plus lit fige[R], undefined === 0 faux, et n'ajoute aucun tour. |
| `src/moteur/recherche.js:1620:23` | nombre-plus-un | `0` | `1` | recherche.js, repartirUne, graineDerivee part de 1 : exigerReglage impose rang ≥ 1, et la boucle de tirage 1 à rang la récrit au moins une fois avant toute lecture. |
| `src/moteur/recherche.js:1726:23` | nombre-plus-un | `0` | `1` | recherche.js, proposerUne, graineDerivee part de 1 : exigerReglage impose rang ≥ 1, et la boucle de tirage la récrit au moins une fois avant toute lecture. |
| `src/moteur/recherche.js:1822:16` | nombre-plus-un | `0` | `1` | recherche.js, regenerer, dejaFaits: 1 : dans descendre, fait ne sert qu'à la cadence de progression et de lireSignal ; regenerer ne passe ni progression ni signal, l'appel optionnel ne fait rien et lireSignal(undefined) ne lève pas. Le plan ne dépend pas de fait. |
| `src/moteur/recherche.js:1908:21` | frontiere | `<` | `<=` | recherche.js, scoreComplet, p <= N dans le compte des occupations : la personne de plus lit tableDe au-delà de N × R, undefined !== RESERVE, et ajoute 1 à occupation[NaN], écriture qu'un Int32Array ignore ; les réunions ne changent pas. |
| `src/moteur/recherche.js:1911:11` | si-vrai | `t !== RESERVE` | `true` | recherche.js, scoreComplet, occupation comptée même pour RESERVE : l'état de recherche assied chacun à chaque tour, sans réserve (en-tête, « Sièges » ; nombrePlacesManquantes nul), et tableDe ne s'écrit que dans ce module ; une case RESERVE (−1) viserait de plus l'index −R + r, négatif, qui n'écrit rien dans un Int32Array. |
| `src/moteur/recherche.js:1918:58` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, horsObjectif: 1 par défaut : le défaut ne sert que si mesurer rend objectifs null, c'est-à-dire sans personne concernée (indicateurs.js, lireObjectifs) ; le critère des tours hors objectif est alors sans objet (configuration.js, etatDesCriteres : tous les P(p) nuls), la compilation ne pose aucun terme qui lise cette grandeur, et composer ne la lit pas. |
| `src/moteur/recherche.js:1918:76` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, jamaisServies: 1 par défaut : même raison que horsObjectif — sans personne concernée, le critère des tours hors objectif est sans objet, et aucun terme ne lit jamaisServies. |
| `src/moteur/recherche.js:1918:96` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, horsObjectifMax: 1 par défaut : même raison — sans personne concernée, aucun terme ne lit horsObjectifMax. |
| `src/moteur/recherche.js:1918:115` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, personnesAuMax: 1 par défaut : même raison — sans personne concernée, aucun terme ne lit personnesAuMax. |
| `src/moteur/recherche.js:1922:59` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, conflitsOrganisation ?? 1 au lieu de ?? 0 : mesurer ne rend null que pour une instance sans paire en conflit (pairesEnConflit nul) ; le critère y est alors sans objet (etatDesCriteres, configuration.js), compilationDe ne le compile pas, et aucun terme de la composition ne porte le code CONFLITS : composer ne lit pas la grandeur. |
| `src/moteur/recherche.js:1932:67` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, animateursNonRencontres ?? 1 : le défaut ne sert que si mesurer rend animateurs null, c'est-à-dire quand aucune borne des animateurs n'est non nulle (indicateurs.js, lireAnimateurs) ; le critère est alors sans objet (configuration.js, etatDesCriteres), et aucun terme ne lit la grandeur. |
| `src/moteur/recherche.js:1933:59` | nombre-plus-un | `0` | `1` | recherche.js, scoreComplet, inclusions?.avis ?? 1 au lieu de ?? 0 : le défaut ne sert que si mesurer rend inclusions null, c'est-à-dire sans ligne active (indicateurs.js, lireInclusions) ; le critère est alors sans objet (configuration.js, etatDesCriteres), et aucun terme ne lit la grandeur. |
| `src/moteur/recherche.js:2010:13` | ternaire-vrai | `tirables === null` | `true` | recherche.js, reunir, k = R même parmi tirables : les rangs j de tirables.length à R − 1 lisent tirables[j], undefined ; tableDe et fixe s'y lisent à un index NaN, undefined, qui n'égale ni RESERVE ni LIBRE : aucune option de plus, et tirables ne compte jamais plus de R tours. |
| `src/moteur/recherche.js:2012:21` | frontiere | `<` | `<=` | recherche.js, reunir, j <= k : sans tirables, le rang de trop est le tour R, où tableDe et fixe lisent le tour 0 de la personne suivante, et siegesDArrivee lit mobilesDe au-delà de ses R × (T + 1) cases et rend NaN : NaN > 0 est faux ; parmi tirables, il lit tirables[k], undefined, qui ne mène à aucune option (voir k = R parmi tirables). |
| `src/moteur/verification.js:44:21` | nombre-plus-un | `2` | `3` | verification.js, SANS_TABLE = -3 au lieu de -2 : la constante ne se compare qu'à elle-même (t !== SANS_TABLE) et à une case de instance.fixe, Int32Array qui ne porte que LIBRE (-1) ou un index de table (0 au moins) ; ni -2 ni -3 n'en est un. |
| `src/moteur/verification.js:212:17` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, compter rend -2 au lieu de -1 pour un id étranger : le résultat ne se lit que par p < 0, vrai pour les deux, et l'appel sur la réserve l'ignore. |
| `src/moteur/verification.js:219:17` | ternaire-vrai | `i < tableDeListe.length` | `true` | verification.js, verifierInvariants, t = tableDeListe[i] sans le repli SANS_TABLE : pour une liste au-delà de plan.tables, t vaut undefined au lieu de -2 ; t ne se lit que par fixe[p · R + r] === t, case d'un Int32Array dans ses bornes (p < N, r < R), toujours un nombre, qui n'égale ni undefined ni -2. |
| `src/moteur/verification.js:219:19` | frontiere | `<` | `<=` | verification.js, verifierInvariants, i <= tableDeListe.length au lieu de < : à i = tableDeListe.length, t vaut tableDeListe[i], undefined, au lieu de SANS_TABLE ; t ne se lit que par fixe[p · R + r] === t, case d'un Int32Array dans ses bornes, toujours un nombre, qui n'égale ni undefined ni -2. |
| `src/moteur/verification.js:222:13` | si-faux | `p < 0` | `false` | verification.js, verifierInvariants, sans le continue d'un id étranger (p = -1) : aUneTable[-1] = 1 n'écrit rien, -1 n'étant pas un index d'élément d'un Uint8Array ; fixe[-R + r], r < R, est hors des éléments et vaut undefined, qui n'égale pas t, un nombre : aSaTable n'est pas écrit. |
| `src/moteur/verification.js:222:20` | corps-si | `continue;` | `{}` | verification.js, verifierInvariants, if (p < 0) {} : même effet que la suppression du test, p = -1 ; aUneTable[-1] = 1 n'écrit rien dans un Uint8Array, et fixe[-R + r] vaut undefined, qui n'égale pas t : aSaTable n'est pas écrit. |
| `src/moteur/verification.js:223:24` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, aUneTable[p] = 2 au lieu de 1 : la marque ne se lit que par !aUneTable[p], et fill(0) la remet à zéro à chaque tour. |
| `src/moteur/verification.js:224:50` | nombre-plus-un | `1` | `2` | verification.js, verifierInvariants, aSaTable[p] = 2 au lieu de 1 : la marque ne se lit que par !aSaTable[p], et fill(0) la remet à zéro à chaque tour. |
| `src/moteur/verification.js:229:44` | frontiere | `<` | `<=` | verification.js, verifierInvariants, boucle des capacités jusqu'à i <= tableDeListe.length : le tour de trop n'a lieu que pour une liste au-delà de plan.tables ; t = tableDeListe[i] vaut undefined, et listes[i].length > capacite[undefined] compare à undefined (propriété absente de l'Int32Array), toujours faux : aucun CAPACITE n'est ajouté. |

## Délais et erreurs (649)

| lieu | opérateur | avant | après | issue |
|---|---|---|---|---|
| `src/moteur/classement.js:166:21` | negation | `<` | `>=` | délai |
| `src/moteur/classement.js:166:35` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/classement.js:166:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/classement.js:292:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:206:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:251:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:261:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:261:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:261:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:269:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:269:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:269:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:274:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:274:39` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:274:42` | nombre-zero | `2` | `0` | délai |
| `src/moteur/configuration.js:320:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:335:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:335:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:388:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:395:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:495:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:498:30` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:498:35` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/configuration.js:531:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:531:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:532:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:532:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:538:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:538:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:543:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:543:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:545:39` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:545:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:548:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:548:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:555:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:555:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:555:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:571:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:600:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:625:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:625:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:625:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:626:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:626:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:631:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:631:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:631:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:632:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:632:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:658:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:658:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:658:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:662:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:662:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:716:34` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:730:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:730:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:730:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:731:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:731:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:752:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:761:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:766:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:766:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:768:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:768:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:768:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:772:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:772:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:772:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:780:27` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:780:31` | logique | `o < O && !oui` | `((o < O )\|\|( !oui))` | délai |
| `src/moteur/configuration.js:780:42` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:780:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:804:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:826:29` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:826:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:826:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:854:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:854:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:856:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:856:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:860:29` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:860:38` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:860:41` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:867:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:867:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:871:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:871:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:884:46` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:884:78` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:884:81` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1266:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1275:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1279:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:1279:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:1279:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1311:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1341:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1346:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1367:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:1367:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:1367:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:1422:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:1422:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:1422:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:131:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:131:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:131:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:133:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:133:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:133:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:137:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:137:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:158:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:160:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:163:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:163:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:200:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:200:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:202:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:202:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:214:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:214:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:214:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:330:45` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/diagnostic.js:330:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:358:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:358:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:358:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:360:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:360:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:364:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:364:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:364:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:429:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:469:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:469:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:469:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:470:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:470:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:479:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:479:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:479:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:480:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:480:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:488:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:488:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:488:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:492:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:492:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:495:23` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:495:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:495:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:520:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:520:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:520:31` | nombre-zero | `1` | `0` | délai |
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
| `src/moteur/inclusions.js:113:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:113:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:116:27` | negation | `<` | `>=` | délai |
| `src/moteur/inclusions.js:116:36` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:116:39` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:118:27` | negation | `<` | `>=` | délai |
| `src/moteur/inclusions.js:118:36` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:118:39` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:137:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:141:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:141:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:142:69` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:161:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:161:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:163:39` | negation | `<` | `>=` | délai |
| `src/moteur/inclusions.js:163:66` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:163:69` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:164:39` | negation | `<` | `>=` | délai |
| `src/moteur/inclusions.js:164:66` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:164:69` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:169:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:169:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/inclusions.js:170:39` | negation | `<` | `>=` | délai |
| `src/moteur/inclusions.js:170:66` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/inclusions.js:170:69` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:230:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:230:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:230:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:232:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:232:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:247:74` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:247:83` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:247:86` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:262:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:262:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:281:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:281:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:283:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:288:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:294:25` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:294:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:294:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:300:31` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:300:49` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:300:52` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:359:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:359:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:359:44` | nombre-zero | `2` | `0` | délai |
| `src/moteur/indicateurs.js:400:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:400:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:405:36` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:405:39` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:422:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:422:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:422:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:518:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:518:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:518:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:527:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:527:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:561:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:561:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:561:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:567:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:567:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:607:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:607:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:607:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:662:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:662:31` | nombre-zero | `1` | `0` | délai |
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
| `src/moteur/presence.js:26:84` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/qualite.js:143:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:224:21` | negation | `<` | `>=` | délai |
| `src/moteur/qualite.js:224:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:224:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:283:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:283:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:608:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:613:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:694:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:720:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:720:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/qualite.js:753:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/qualite.js:753:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:337:18` | nombre-zero | `10` | `0` | délai |
| `src/moteur/recherche.js:439:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:507:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:521:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:523:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:525:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:563:34` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:563:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:564:16` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:564:21` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:564:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:564:31` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:564:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:564:42` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:564:44` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:564:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:567:21` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:567:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:567:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:567:73` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:567:75` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:574:40` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:575:36` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:580:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:580:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:581:18` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:583:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:583:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:583:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:585:11` | si-vrai | `t === LIBRE` | `true` | délai |
| `src/moteur/recherche.js:585:11` | si-faux | `t === LIBRE` | `false` | délai |
| `src/moteur/recherche.js:585:24` | corps-si | `{ if (present[p * R + r] === 1) libresDuTour.push(p); }` | `{}` | délai |
| `src/moteur/recherche.js:586:13` | si-faux | `present[p * R + r] === 1` | `false` | délai |
| `src/moteur/recherche.js:586:32` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:586:36` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:586:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:586:39` | corps-si | `libresDuTour.push(p);` | `{}` | délai |
| `src/moteur/recherche.js:588:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:593:13` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:594:23` | frontiere | `<` | `<=` | délai |
| `src/moteur/recherche.js:594:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:594:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:594:33` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:594:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:595:11` | si-vrai | `siegesFixes[r * S + s] === FANTOME` | `true` | délai |
| `src/moteur/recherche.js:595:11` | si-faux | `siegesFixes[r * S + s] === FANTOME` | `false` | délai |
| `src/moteur/recherche.js:595:25` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:595:34` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:595:47` | corps-si | `{ mobiles[r * S + m] = s; m += 1; }` | `{}` | délai |
| `src/moteur/recherche.js:596:19` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:596:23` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:597:11` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:597:14` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:597:14` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:601:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:601:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:602:16` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:602:20` | logique | `i < m && mobiles[r * S + i] < debut[t + 1]` | `((i < m )\|\|( mobiles[r * S + i] < debut[t + 1]))` | délai |
| `src/moteur/recherche.js:602:63` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:611:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:611:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:612:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:612:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:617:45` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:617:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:623:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:623:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:672:15` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:749:68` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:749:77` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:749:80` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:802:48` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:802:57` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:802:60` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:821:57` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:821:60` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:837:57` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:837:60` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:853:18` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:854:24` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:855:24` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:860:14` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:861:14` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:862:7` | si-faux | `x !== FANTOME` | `false` | délai |
| `src/moteur/recherche.js:862:9` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:862:22` | corps-si | `{ tableDe[x * R + r] = tb; changerVisite(etat, x, ta, -1); …` | `{}` | délai |
| `src/moteur/recherche.js:863:15` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:863:19` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:869:7` | si-faux | `y !== FANTOME` | `false` | délai |
| `src/moteur/recherche.js:869:9` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:869:22` | corps-si | `{ tableDe[y * R + r] = ta; changerVisite(etat, y, tb, -1); …` | `{}` | délai |
| `src/moteur/recherche.js:870:15` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:870:19` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:936:31` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:993:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:993:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1000:25` | corps-si | `{ for (let r = 0; r < R; r += 1) { const melanges = rng.mel…` | `{}` | délai |
| `src/moteur/recherche.js:1001:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1001:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1003:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1003:46` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1003:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1008:16` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1008:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1008:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1010:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1010:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1011:28` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1014:17` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1014:21` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1016:42` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1016:54` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1016:57` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1023:42` | logique | `u >= 0 && voisin < s` | `((u >= 0 )\|\|( voisin < s))` | délai |
| `src/moteur/recherche.js:1023:52` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1023:64` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1023:67` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1033:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1033:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1043:64` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1043:67` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1053:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1053:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1055:59` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1055:62` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1065:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1083:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1165:20` | logique | `i < arret && !estNul(courant)` | `((i < arret )\|\|( !estNul(courant)))` | délai |
| `src/moteur/recherche.js:1165:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1165:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1166:9` | si-vrai | `immobile >= patience && ordre === ordreContraintes` | `true` | délai |
| `src/moteur/recherche.js:1192:9` | si-vrai | `i + 1 === releve` | `true` | délai |
| `src/moteur/recherche.js:1192:15` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1326:16` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1326:21` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1326:31` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1340:22` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1340:25` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1343:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1343:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1348:17` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1351:18` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1351:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1351:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1351:33` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1351:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1352:23` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1357:18` | si-vrai | `t >= 0` | `true` | délai |
| `src/moteur/recherche.js:1357:20` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:1361:13` | si-vrai | `imposee[i] === 1` | `true` | délai |
| `src/moteur/recherche.js:1361:24` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1361:28` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1363:13` | si-faux | `fixee !== LIBRE` | `false` | délai |
| `src/moteur/recherche.js:1363:19` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1363:30` | corps-si | `occupants[fixee] += 1;` | `{}` | délai |
| `src/moteur/recherche.js:1363:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1363:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1366:23` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1366:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1366:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1368:11` | si-vrai | `enTrop <= 0` | `true` | délai |
| `src/moteur/recherche.js:1368:21` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1370:29` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:1370:44` | negation | `>` | `<=` | délai |
| `src/moteur/recherche.js:1370:46` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1370:51` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/recherche.js:1370:54` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1371:13` | si-vrai | `tableDe[p * R + r] !== t \|\| fixe[p * R + r] !== LIBRE` | `true` | délai |
| `src/moteur/recherche.js:1371:23` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1371:32` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1371:48` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1371:57` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1372:19` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1372:23` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1394:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1394:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1397:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1397:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1398:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1398:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1403:45` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1403:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1408:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1408:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1410:40` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1410:68` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1410:71` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1435:18` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1435:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1436:22` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1437:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1437:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1437:35` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1437:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1438:36` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1439:13` | si-faux | `p !== FANTOME && imposee[p * R + r] === 1` | `false` | délai |
| `src/moteur/recherche.js:1439:15` | negation | `!==` | `===` | délai |
| `src/moteur/recherche.js:1439:40` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1439:44` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1439:49` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1439:53` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1439:53` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1439:56` | corps-si | `siege[base + s] = FANTOME;` | `{}` | délai |
| `src/moteur/recherche.js:1439:67` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1441:20` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/recherche.js:1441:25` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:1441:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1441:35` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1441:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1443:33` | logique | `s < debut[t + 1] && siegesFixes[base + s] !== FANTOME` | `((s < debut[t + 1] )\|\|( siegesFixes[base + s] !== FANTOME))` | délai |
| `src/moteur/recherche.js:1443:73` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1443:76` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1448:29` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:1448:33` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1449:13` | si-faux | `t === RESERVE` | `false` | délai |
| `src/moteur/recherche.js:1449:15` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:1449:28` | corps-si | `continue;` | `{}` | délai |
| `src/moteur/recherche.js:1454:29` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1454:68` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1461:13` | si-faux | `fixe[p * R + r] !== LIBRE` | `false` | délai |
| `src/moteur/recherche.js:1461:40` | corps-si | `continue;` | `{}` | délai |
| `src/moteur/recherche.js:1462:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1462:42` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:1462:63` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1462:66` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:1462:66` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1483:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1491:32` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1491:35` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1497:35` | logique | `b < debut[t + 1] && siege[base + b] !== FANTOME` | `((b < debut[t + 1] )\|\|( siege[base + b] !== FANTOME))` | délai |
| `src/moteur/recherche.js:1497:69` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1497:72` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1532:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1532:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1576:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1576:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1621:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1621:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1678:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1678:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1727:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1727:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1908:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1908:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:1909:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:1909:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2000:32` | arithmetique | `-` | `+` | délai |
| `src/moteur/recherche.js:2000:52` | arithmetique | `-` | `+` | délai |
| `src/moteur/recherche.js:2000:55` | ternaire-faux | `etat.fixe[y * etat.R + r] === LIBRE` | `false` | délai |
| `src/moteur/recherche.js:2000:67` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:2000:76` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2000:81` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:2000:93` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2012:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:2012:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2016:30` | negation | `===` | `!==` | délai |
| `src/moteur/recherche.js:2018:20` | nombre-plus-un | `2` | `3` | délai |
| `src/moteur/recherche.js:2022:20` | nombre-plus-un | `2` | `3` | délai |
| `src/moteur/recherche.js:2022:28` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:2028:23` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:2028:23` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2030:18` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:2031:27` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:2031:31` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2032:21` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2032:35` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:2032:38` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:2032:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2035:31` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:2035:36` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2035:38` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:2035:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2035:41` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2035:53` | arithmetique | `*` | `/` | délai |
| `src/moteur/recherche.js:2035:57` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2036:19` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2037:35` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:2037:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:2039:9` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:2039:12` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/recherche.js:2043:26` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2054:7` | si-vrai | `m < 2` | `true` | délai |
| `src/moteur/recherche.js:2054:9` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:2056:26` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2057:26` | arithmetique | `+` | `-` | délai |
| `src/moteur/recherche.js:2058:7` | si-vrai | `tableDuSiege[a] === tableDuSiege[b]` | `true` | délai |
| `src/moteur/recherche.js:2059:7` | si-vrai | `siege[base + a] === FANTOME && siege[base + b] === FANTOME` | `true` | délai |
| `src/moteur/verification.js:192:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:218:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:229:72` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:236:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:236:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:329:58` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:336:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:470:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:470:31` | nombre-zero | `1` | `0` | délai |
