# Audit par mutation du moteur

Écrit par `make mutation` (`scripts/mutation/audit.js`, § 14.13) ; ne se modifie pas à la main.

| | |
|---|---|
| version | 2026.10.05.01 |
| périmètre | `src/moteur` |
| sources et épreuves du périmètre (SHA-256) | `03c4a69b22d817acb42df47fd69ad536ed9c59cec709217ba3d165300f404715` |
| Node | v26.10.0 |

Chaque mutant se joue contre les épreuves de la série node qui atteignent son module, sous `node --test`.
Un survivant sur une ligne couverte désigne une épreuve qui exécute sans affirmer.

## Bilan

| mutants | tués | survivants | équivalents | délais | erreurs |
|---:|---:|---:|---:|---:|---:|
| 2576 | 2171 | 137 | 61 | 207 | 0 |

## Par fichier

| fichier | total | tués | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|
| `src/moteur/classement.js` | 45 | 38 | 0 | 5 | 2 | 0 |
| `src/moteur/configuration.js` | 407 | 365 | 11 | 0 | 31 | 0 |
| `src/moteur/conflits.js` | 24 | 24 | 0 | 0 | 0 | 0 |
| `src/moteur/diagnostic.js` | 383 | 312 | 45 | 0 | 26 | 0 |
| `src/moteur/indicateurs.js` | 325 | 281 | 0 | 18 | 26 | 0 |
| `src/moteur/manque.js` | 162 | 148 | 0 | 9 | 5 | 0 |
| `src/moteur/plafond.js` | 397 | 305 | 2 | 29 | 61 | 0 |
| `src/moteur/recherche.js` | 648 | 530 | 69 | 0 | 49 | 0 |
| `src/moteur/verification.js` | 185 | 168 | 10 | 0 | 7 | 0 |

## Par opérateur

| opérateur | total | tués | survivants | équivalents | délais | erreurs |
|---|---:|---:|---:|---:|---:|---:|
| arithmetique | 287 | 270 | 8 | 7 | 2 | 0 |
| frontiere | 165 | 113 | 31 | 20 | 1 | 0 |
| negation | 343 | 314 | 5 | 0 | 24 | 0 |
| logique | 77 | 71 | 3 | 0 | 3 | 0 |
| retrait-non | 36 | 36 | 0 | 0 | 0 | 0 |
| mise-a-jour | 158 | 84 | 2 | 0 | 72 | 0 |
| nombre-plus-un | 540 | 469 | 47 | 20 | 4 | 0 |
| nombre-zero | 291 | 184 | 6 | 5 | 96 | 0 |
| booleen | 22 | 22 | 0 | 0 | 0 | 0 |
| si-vrai | 186 | 170 | 9 | 6 | 1 | 0 |
| si-faux | 186 | 174 | 9 | 1 | 2 | 0 |
| ternaire-vrai | 39 | 35 | 4 | 0 | 0 | 0 |
| ternaire-faux | 39 | 37 | 2 | 0 | 0 | 0 |
| min-max | 21 | 19 | 1 | 1 | 0 | 0 |
| corps-si | 186 | 173 | 10 | 1 | 2 | 0 |

## Survivants (137), lignes couvertes d’abord

| lieu | opérateur | avant | après | ligne couverte | série longue |
|---|---|---|---|---|---|
| `src/moteur/configuration.js:58:20` | nombre-plus-un | `2` | `3` | oui | survit |
| `src/moteur/configuration.js:76:37` | ternaire-vrai | `typeof valeur === 'string'` | `true` | oui | survit |
| `src/moteur/configuration.js:108:7` | si-faux | `typeof contraintes !== 'object' \|\| contraintes === null` | `false` | oui | survit |
| `src/moteur/configuration.js:108:39` | logique | `typeof contraintes !== 'object' \|\| contraintes === null` | `((typeof contraintes !== 'object' )&&( contraintes === null…` | oui | survit |
| `src/moteur/configuration.js:108:64` | corps-si | `{ throw new TypeError('configuration.contraintes : objet at…` | `{}` | oui | survit |
| `src/moteur/configuration.js:204:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/configuration.js:207:11` | si-vrai | `t !== LIBRE` | `true` | oui | survit |
| `src/moteur/configuration.js:210:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/configuration.js:242:17` | corps-si | `{ statut[p] = STATUT.MOBILE; }` | `{}` | oui | survit |
| `src/moteur/configuration.js:307:27` | arithmetique | `-` | `+` | oui | survit |
| `src/moteur/configuration.js:431:23` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:91:7` | si-faux | `T === 0` | `false` | oui | survit |
| `src/moteur/diagnostic.js:91:13` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/diagnostic.js:91:16` | corps-si | `return 0;` | `{}` | oui | survit |
| `src/moteur/diagnostic.js:91:23` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/diagnostic.js:95:18` | nombre-zero | `1` | `0` | oui | survit |
| `src/moteur/diagnostic.js:95:23` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:95:51` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:123:22` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/diagnostic.js:162:31` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:174:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:195:25` | nombre-plus-un | `2` | `3` | oui | survit |
| `src/moteur/diagnostic.js:205:53` | arithmetique | `-` | `+` | oui | survit |
| `src/moteur/diagnostic.js:232:7` | si-faux | `lignes.length === 0` | `false` | oui | survit |
| `src/moteur/diagnostic.js:232:28` | corps-si | `return lignes;` | `{}` | oui | survit |
| `src/moteur/diagnostic.js:234:109` | frontiere | `<=` | `<` | oui | survit |
| `src/moteur/diagnostic.js:235:25` | min-max | `max` | `min` | oui | survit |
| `src/moteur/diagnostic.js:236:55` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:239:39` | arithmetique | `-` | `+` | oui | survit |
| `src/moteur/diagnostic.js:239:41` | nombre-zero | `1` | `0` | oui | survit |
| `src/moteur/diagnostic.js:239:80` | arithmetique | `+` | `-` | oui | survit |
| `src/moteur/diagnostic.js:243:43` | logique | `ligne.tablesManquantes === null && !sansRemede.has(ligne.gr…` | `((ligne.tablesManquantes === null )\|\|( !sansRemede.has(lign…` | oui | survit |
| `src/moteur/diagnostic.js:243:76` | logique | `ligne.tablesManquantes === null && !sansRemede.has(ligne.gr…` | `((ligne.tablesManquantes === null && !sansRemede.has(ligne.…` | oui | survit |
| `src/moteur/diagnostic.js:243:81` | frontiere | `<=` | `<` | oui | survit |
| `src/moteur/diagnostic.js:258:22` | arithmetique | `-` | `+` | oui | survit |
| `src/moteur/diagnostic.js:258:24` | nombre-zero | `1` | `0` | oui | survit |
| `src/moteur/diagnostic.js:258:33` | frontiere | `>=` | `>` | oui | survit |
| `src/moteur/diagnostic.js:258:36` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:258:48` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:286:16` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/diagnostic.js:286:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:286:85` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:288:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:288:31` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:336:7` | si-faux | `mobile === -1` | `false` | oui | survit |
| `src/moteur/diagnostic.js:336:19` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/diagnostic.js:336:22` | corps-si | `return null;` | `{}` | oui | survit |
| `src/moteur/diagnostic.js:348:9` | si-vrai | `passant === undefined` | `true` | oui | survit |
| `src/moteur/diagnostic.js:355:45` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:365:21` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/diagnostic.js:366:21` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/diagnostic.js:368:16` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/diagnostic.js:369:9` | si-vrai | `valeur > max` | `true` | oui | survit |
| `src/moteur/diagnostic.js:369:9` | si-faux | `valeur > max` | `false` | oui | survit |
| `src/moteur/diagnostic.js:369:16` | frontiere | `>` | `>=` | oui | survit |
| `src/moteur/diagnostic.js:369:23` | corps-si | `max = valeur;` | `{}` | oui | survit |
| `src/moteur/plafond.js:268:9` | si-vrai | `plafond === undefined` | `true` | oui | tué |
| `src/moteur/plafond.js:285:16` | frontiere | `>` | `>=` | oui | tué |
| `src/moteur/recherche.js:143:18` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/recherche.js:160:20` | nombre-plus-un | `0xffff` | `65536` | oui | survit |
| `src/moteur/recherche.js:160:20` | nombre-zero | `0xffff` | `0` | oui | survit |
| `src/moteur/recherche.js:165:3` | ternaire-vrai | `typeof valeur === 'number'` | `true` | oui | survit |
| `src/moteur/recherche.js:165:3` | ternaire-faux | `typeof valeur === 'number'` | `false` | oui | survit |
| `src/moteur/recherche.js:165:17` | negation | `===` | `!==` | oui | survit |
| `src/moteur/recherche.js:200:36` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/recherche.js:201:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:204:16` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:204:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:204:75` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/recherche.js:214:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:215:18` | nombre-plus-un | `0` | `1` | oui | tué |
| `src/moteur/recherche.js:217:23` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:223:23` | nombre-plus-un | `1` | `2` | oui | tué |
| `src/moteur/recherche.js:241:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:241:31` | nombre-plus-un | `1` | `2` | oui | tué |
| `src/moteur/recherche.js:242:23` | frontiere | `<` | `<=` | oui | tué |
| `src/moteur/recherche.js:247:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:252:19` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:253:16` | nombre-plus-un | `0` | `1` | oui | tué |
| `src/moteur/recherche.js:253:31` | nombre-plus-un | `1` | `2` | oui | tué |
| `src/moteur/recherche.js:269:37` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/recherche.js:285:13` | frontiere | `>` | `>=` | oui | survit |
| `src/moteur/recherche.js:299:20` | mise-a-jour | `+=` | `-=` | oui | tué |
| `src/moteur/recherche.js:301:23` | frontiere | `>` | `>=` | oui | survit |
| `src/moteur/recherche.js:302:31` | mise-a-jour | `+=` | `-=` | oui | tué |
| `src/moteur/recherche.js:317:15` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:317:15` | negation | `<` | `>=` | oui | survit |
| `src/moteur/recherche.js:325:13` | frontiere | `>` | `>=` | oui | survit |
| `src/moteur/recherche.js:351:9` | si-faux | `s === exclu` | `false` | oui | survit |
| `src/moteur/recherche.js:351:22` | corps-si | `continue;` | `{}` | oui | survit |
| `src/moteur/recherche.js:353:9` | si-vrai | `q !== FANTOME` | `true` | oui | tué |
| `src/moteur/recherche.js:417:13` | ternaire-vrai | `R <= UINT16_MAX` | `true` | oui | survit |
| `src/moteur/recherche.js:417:13` | ternaire-faux | `R <= UINT16_MAX` | `false` | oui | survit |
| `src/moteur/recherche.js:417:15` | frontiere | `<=` | `<` | oui | survit |
| `src/moteur/recherche.js:417:15` | negation | `<=` | `>` | oui | survit |
| `src/moteur/recherche.js:417:74` | arithmetique | `*` | `/` | oui | survit |
| `src/moteur/recherche.js:424:31` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:452:13` | si-vrai | `q !== FANTOME` | `true` | oui | survit |
| `src/moteur/recherche.js:491:17` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:494:16` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:494:42` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/recherche.js:535:18` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:536:16` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:542:18` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:547:9` | si-vrai | `mouvement !== null` | `true` | oui | survit |
| `src/moteur/recherche.js:551:50` | nombre-plus-un | `0` | `1` | oui | tué |
| `src/moteur/recherche.js:551:62` | nombre-plus-un | `0` | `1` | oui | tué |
| `src/moteur/recherche.js:551:69` | nombre-plus-un | `0` | `1` | oui | tué |
| `src/moteur/recherche.js:560:34` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/recherche.js:664:23` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:670:16` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:721:16` | nombre-plus-un | `0` | `1` | oui | survit |
| `src/moteur/recherche.js:772:34` | nombre-plus-un | `0` | `1` | oui | tué |
| `src/moteur/recherche.js:779:21` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:782:11` | si-vrai | `t !== RESERVE` | `true` | oui | survit |
| `src/moteur/recherche.js:813:7` | si-faux | `m < 2` | `false` | oui | survit |
| `src/moteur/recherche.js:813:9` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/recherche.js:813:11` | nombre-plus-un | `2` | `3` | oui | survit |
| `src/moteur/recherche.js:813:11` | nombre-zero | `2` | `0` | oui | survit |
| `src/moteur/recherche.js:813:14` | corps-si | `return null;` | `{}` | oui | survit |
| `src/moteur/recherche.js:818:7` | si-faux | `siege[base + a] === FANTOME && siege[base + b] === FANTOME` | `false` | oui | survit |
| `src/moteur/recherche.js:818:18` | arithmetique | `+` | `-` | oui | survit |
| `src/moteur/recherche.js:818:23` | negation | `===` | `!==` | oui | survit |
| `src/moteur/recherche.js:818:49` | arithmetique | `+` | `-` | oui | survit |
| `src/moteur/recherche.js:818:54` | negation | `===` | `!==` | oui | survit |
| `src/moteur/recherche.js:818:67` | corps-si | `return null;` | `{}` | oui | survit |
| `src/moteur/recherche.js:832:7` | si-vrai | `mouvement !== null` | `true` | oui | survit |
| `src/moteur/verification.js:25:21` | nombre-plus-un | `2` | `3` | oui | survit |
| `src/moteur/verification.js:157:17` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/verification.js:157:17` | nombre-zero | `1` | `0` | oui | survit |
| `src/moteur/verification.js:164:17` | ternaire-vrai | `i < tableDeListe.length` | `true` | oui | survit |
| `src/moteur/verification.js:164:19` | frontiere | `<` | `<=` | oui | survit |
| `src/moteur/verification.js:167:13` | si-faux | `p < 0` | `false` | oui | survit |
| `src/moteur/verification.js:167:20` | corps-si | `continue;` | `{}` | oui | survit |
| `src/moteur/verification.js:168:24` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/verification.js:169:50` | nombre-plus-un | `1` | `2` | oui | survit |
| `src/moteur/verification.js:174:44` | frontiere | `<` | `<=` | oui | survit |

## Mutants équivalents (61)

Déclarés dans `audit/mutants-equivalents.json`, avec leur raison.

| lieu | opérateur | avant | après | raison |
|---|---|---|---|---|
| `src/moteur/classement.js:43:61` | frontiere | `>` | `>=` | classement.js, plusGrand, valeur >= plus : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/classement.js:95:21` | frontiere | `<` | `<=` | classement.js, comparerCles, i <= a.length : a[length] et b[length] sont tous deux undefined, donc égaux ; la boucle finit et rend 0, comme sans le tour de trop. |
| `src/moteur/classement.js:96:36` | frontiere | `<` | `<=` | classement.js, comparerCles, a[i] <= b[i] sous a[i] !== b[i] : pour deux nombres différents, <= et < coïncident. Une clé ne mêle jamais null et nombre : le premier critère vaut null pour une liste d'écarts vide, et toutes les entrées ont des listes de même longueur (exigerMemeTaille), toutes vides ou aucune. |
| `src/moteur/classement.js:96:46` | nombre-plus-un | `1` | `2` | classement.js, comparerCles, −2 au lieu de −1 : le résultat ne se lit que par son signe, dans sort et dans le \|\| du départage par identifiant. |
| `src/moteur/classement.js:96:50` | nombre-plus-un | `1` | `2` | classement.js, comparerCles, 2 au lieu de 1 : le résultat ne se lit que par son signe, dans sort et dans le \|\| du départage par identifiant. |
| `src/moteur/indicateurs.js:136:21` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, visites[t] += 2 au lieu de 1 : visites[t] ne se lit que par visites[t] > 0 et se remet à 0 après chaque personne ; un pas de 2 garde le signe, aucune sortie ne change. |
| `src/moteur/indicateurs.js:137:40` | nombre-plus-un | `1` | `2` | indicateurs.js, parcourirTours, reserveeAvant[t] = 2 au lieu de 1 : la marque ne se lit que par reserveeAvant[t] === 0. |
| `src/moteur/indicateurs.js:139:23` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, remise à zéro jusqu'à r <= R : le tour de trop lit la première case de la personne suivante, dont la table vaut 0 dans visites et reserveeAvant sauf si la personne courante l'a visitée, auquel cas la boucle la remet à 0 de toute façon ; pour la dernière personne la case est undefined, et une écriture à l'index undefined pose une propriété hors des éléments du tableau typé, que rien ne lit. |
| `src/moteur/indicateurs.js:141:11` | si-faux | `t === RESERVE` | `false` | indicateurs.js, parcourirTours, remise à zéro sans le continue des cases RESERVE : la case −1 écrit visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:141:26` | corps-si | `continue;` | `{}` | indicateurs.js, parcourirTours, if (t === RESERVE) {} : même effet que le mutant si-faux du même if — visites[−1] et reserveeAvant[−1] ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/indicateurs.js:169:25` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, i <= liste.length : le tour de trop lit a = undefined ; revenu[NaN] et fixe[NaN] sont undefined, rien n'est poussé, et la boucle intérieure part de j = length + 1, au-delà de la liste. |
| `src/moteur/indicateurs.js:174:31` | frontiere | `<` | `<=` | indicateurs.js, parcourirTours, j <= liste.length : le tour de trop lit b = undefined ; k = rangPaire(N, a, undefined) vaut NaN, parPaire[NaN] et libre[NaN] n'écrivent rien sur un tableau typé, groupe[undefined] n'égale aucun groupe et parPaire[NaN] >= 2 est faux : ni collègue ni revue n'est poussé. |
| `src/moteur/indicateurs.js:212:23` | nombre-plus-un | `1` | `2` | indicateurs.js, lirePaires, vu[p * G + g] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:218:21` | frontiere | `<` | `<=` | indicateurs.js, lirePaires, a <= N : pour a = N, la boucle intérieure (b de N + 1 à N − 1) ne tourne pas, et k n'avance pas. |
| `src/moteur/indicateurs.js:224:13` | frontiere | `>` | `>=` | indicateurs.js, lirePaires, n >= maxRencontresPaire : à égalité, l'affectation écrit la valeur déjà retenue. |
| `src/moteur/indicateurs.js:237:32` | arithmetique | `-` | `+` | indicateurs.js, lireTours, nombrePaires = N(N + 1)/2 : ne dimensionne que collegueVu et revueVue, indexés par rangPaire, toujours < N(N − 1)/2 ; un tableau plus long garde les mêmes cases utiles, les autres ne se lisent jamais. |
| `src/moteur/indicateurs.js:237:34` | nombre-zero | `1` | `0` | indicateurs.js, lireTours, nombrePaires = N·N/2 : même raison que N(N + 1)/2 — une longueur au moins égale (tronquée à l'entier par le constructeur du tableau typé) pour des index rangPaire < N(N − 1)/2. |
| `src/moteur/indicateurs.js:237:38` | arithmetique | `/` | `*` | indicateurs.js, lireTours, nombrePaires = 2N(N − 1) : longueur au moins égale à N(N − 1)/2, mêmes cases utiles, les autres jamais lues. |
| `src/moteur/indicateurs.js:251:27` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, collegueVu[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:258:25` | nombre-plus-un | `1` | `2` | indicateurs.js, lireTours, revueVue[k] = 2 au lieu de 1 : la marque ne se lit que par === 0. |
| `src/moteur/indicateurs.js:274:31` | frontiere | `<` | `<=` | indicateurs.js, ajouter, valeur <= min : à égalité, le minimum retenu est la même valeur. |
| `src/moteur/indicateurs.js:324:21` | frontiere | `<` | `<=` | indicateurs.js, mesurer, p <= N au compte des effectifs : groupe[N] est undefined, différent de SANS_GROUPE ; effectifs[undefined] += 1 pose une propriété « undefined » sur un tableau ordinaire, et parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/indicateurs.js:325:9` | si-vrai | `groupe[p] !== SANS_GROUPE` | `true` | indicateurs.js, mesurer, if (true) au compte des effectifs : une personne sans appartenance incrémente effectifs[SANS_GROUPE], soit effectifs[−1], propriété hors des index d'un tableau ordinaire ; parGroupe ne lit que les index 0 à G − 1. |
| `src/moteur/manque.js:91:64` | frontiere | `>` | `>=` | manque.js, plusGrand, valeur >= cumul : à égalité, le cumul retenu est la même valeur. |
| `src/moteur/manque.js:231:82` | arithmetique | `-` | `+` | manque.js, profilManque, départage a.id + b.id : à manque et plafond réalisé égaux, le comparateur rend un nombre positif. Le tri de V8 ne lit que « < 0 » et est stable : un positif s'y lit comme 0, et l'ordre reçu reste, celui de instance.ids, que normaliser trie par identifiant croissant et sans doublon — l'ordre de a.id − b.id. Une liste reçue dans un autre ordre ne peut pas se construire : profilManque parcourt instance.ids. |
| `src/moteur/manque.js:287:34` | frontiere | `<` | `<=` | manque.js, comparerProfils, difference <= 0 : la ligne ne s'atteint que pour difference !== 0, où <= 0 et < 0 coïncident. |
| `src/moteur/manque.js:287:36` | nombre-plus-un | `0` | `1` | manque.js, comparerProfils, difference < 1 : un manque est un entier (plafond réalisé − rencontres, deux comptes), et la ligne ne s'atteint que pour difference !== 0 : < 1 et < 0 coïncident. |
| `src/moteur/manque.js:287:41` | nombre-plus-un | `1` | `2` | manque.js, comparerProfils, signeRang = −2 au lieu de −1 : signeRang ne se lit que par < 0 et par comparaison à signe, qui reçoit les mêmes valeurs ; signe ne se rend pas. |
| `src/moteur/manque.js:287:45` | nombre-plus-un | `1` | `2` | manque.js, comparerProfils, signeRang = 2 au lieu de 1 : signeRang ne se lit que par < 0 et par comparaison à signe, qui reçoit les mêmes valeurs ; signe ne se rend pas. |
| `src/moteur/manque.js:288:19` | frontiere | `<` | `<=` | manque.js, comparerProfils, signeRang <= 0 : signeRang vaut −1 ou 1, jamais 0. |
| `src/moteur/manque.js:288:21` | nombre-plus-un | `0` | `1` | manque.js, comparerProfils, signeRang < 1 : signeRang vaut −1 ou 1 ; < 1 et < 0 coïncident. |
| `src/moteur/manque.js:292:11` | si-vrai | `changements === 1` | `true` | manque.js, comparerProfils, bascule posée à chaque changement : rangBascule ne la rend que pour changements === 1, où la première et la dernière affectation sont la même. |
| `src/moteur/plafond.js:55:30` | arithmetique | `-` | `+` | plafond.js, borne, min(N + 1, …) : le terme Σ a_t + min(n_p, S) ne dépasse jamais N − 1. Les ancrés des tables distinctes, p exclu, sont au plus k − 1 pour un ancré et k sinon ; n_p vaut n pour un ancré et n − 1 sinon ; la somme vaut au plus k + n − 1 = N − 1 (n = N − k, configuration.js). Le min extérieur ne mord jamais, que sa borne soit N − 1 ou plus. |
| `src/moteur/plafond.js:55:32` | nombre-zero | `1` | `0` | plafond.js, borne, min(N − 0, …) : même raison que min(N + 1, …) — le terme intérieur vaut au plus N − 1. |
| `src/moteur/plafond.js:65:74` | nombre-plus-un | `1` | `2` | plafond.js, ancrageDe, −2 au lieu de −1 pour un non-ancré : l'ancrage ne sert qu'à t === ancrage, où t est un index de table ≥ 0, et à la clé de signature, où −2 remplace −1 pour tous les non-ancrés à la fois : aucune comparaison ni aucun regroupement ne change. |
| `src/moteur/plafond.js:74:21` | frontiere | `<` | `<=` | plafond.js, tablesAdmissibles, t <= T : ancresParTable[T] et capacite[T] sont undefined, undefined < undefined est faux, rien ne s'ajoute. |
| `src/moteur/plafond.js:160:21` | frontiere | `<` | `<=` | plafond.js, plafondsRealises, p <= N : la case N × R + r est hors du plan (undefined, différent de RESERVE) ; occupation[NaN] += 1 n'écrit rien sur un Int32Array. |
| `src/moteur/plafond.js:163:11` | si-vrai | `t !== RESERVE` | `true` | plafond.js, plafondsRealises, if (true) : une case RESERVE (−1) écrit occupation[−R + r], index négatif puisque r < R ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/plafond.js:180:38` | si-vrai | `fixe[p * R + r] !== LIBRE` | `true` | plafond.js, signature, chaque case poussée, LIBRE comprise : le nombre de cases LIBRE vaut R moins le nombre de tours fixés, que le multiensemble des tables fixées donne déjà ; deux clés sont égales sous le mutant si et seulement si elles le sont sans lui. |
| `src/moteur/plafond.js:181:27` | arithmetique | `-` | `+` | plafond.js, signature, tri par x + y : le tri ne sert qu'à rendre la clé indépendante de l'ordre des tours. Un ordre faux peut séparer deux rangées de même multiensemble en deux clés, jamais réunir deux multiensembles distincts — la clé garde ses éléments — : la valeur mémoïsée reste exacte, seul le partage se perd. |
| `src/moteur/plafond.js:223:14` | nombre-plus-un | `0` | `1` | plafond.js, maximiser, vMax part de 1 : vMax ne sert qu'à W, qui grandit ou reste. Tout W' ≥ W rend le même plafond : sans écrêtage (W' ≥ f·vMax) la programmation dynamique est exacte, et un écrêtage à W' ≥ cap ne fond que des états où min(n_p, sieges0 + w) vaut déjà n_p. |
| `src/moteur/plafond.js:225:18` | min-max | `min` | `max` | plafond.js, maximiser, W = max(cap, f·vMax) : W grandit ou reste ; même raison que vMax partant de 1 — tout W' ≥ W rend le même plafond. |
| `src/moteur/plafond.js:225:31` | nombre-plus-un | `0` | `1` | plafond.js, maximiser, cap = max(1, n_p − sieges0) : W grandit ou reste ; tout W' ≥ W rend le même plafond (voir vMax partant de 1). |
| `src/moteur/plafond.js:225:37` | arithmetique | `-` | `+` | plafond.js, maximiser, cap = max(0, n_p + sieges0) : sieges0 ≥ 0 (v ≥ 0 pour toute table qu'un plan valide fixe), donc W grandit ou reste ; tout W' ≥ W rend le même plafond (voir vMax partant de 1). |
| `src/moteur/plafond.js:226:23` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, largeur = W + 2 : une colonne de plus par rangée, jamais écrite (cible ≤ W) ni lue (w ≤ W) ; chaque état garde une case distincte. |
| `src/moteur/plafond.js:227:38` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, (f + 2) × largeur cases : une rangée de plus en fin de tableau, jamais lue ni écrite (s + m ≤ f). |
| `src/moteur/plafond.js:227:58` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, fill(−2) : le marqueur d'état inatteignable ne se lit que par < 0 et >= 0, et tout atteint + gain ≥ 0 le dépasse ; −2 se comporte comme −1. |
| `src/moteur/plafond.js:233:23` | frontiere | `<` | `<=` | plafond.js, maximiser, s <= f : à s = f, la boucle sur m (s + m ≤ f) ne tourne pas. |
| `src/moteur/plafond.js:239:30` | frontiere | `>` | `>=` | plafond.js, maximiser, atteint + gain >= suivant[cible] : à égalité, l'affectation écrit la valeur déjà présente. |
| `src/moteur/plafond.js:245:18` | nombre-plus-un | `1` | `2` | plafond.js, maximiser, plafond part de −2 : l'état (f, W) est toujours atteint — la table de plus grand v prise f fois — avec une somme d'ancrés ≥ 0, et sa borne vaut au moins 0 ; le maximum ne dépend pas de la valeur initiale, pourvu qu'elle ne dépasse pas 0. |
| `src/moteur/plafond.js:245:18` | nombre-zero | `1` | `0` | plafond.js, maximiser, plafond part de −0 : même raison que −2 — un état atteint donne une borne x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:248:9` | si-vrai | `ajout >= 0` | `true` | plafond.js, maximiser, if (true) sur ajout >= 0 : un état inatteignable porte −1, soit ancres0 − 1, à un w ≤ W ; l'état (f, W) est atteint avec une somme ≥ 0, et la borne, croissante en ses deux termes, y vaut au moins autant : un état inatteignable ne l'emporte jamais. |
| `src/moteur/plafond.js:299:21` | frontiere | `<` | `<=` | plafond.js, enumerer, r <= R : itineraire[R] est undefined, qui n'égale pas LIBRE ; aucun tour libre ne s'ajoute. |
| `src/moteur/plafond.js:316:18` | nombre-plus-un | `1` | `2` | plafond.js, enumerer, plafond part de −2 : au moins un itinéraire s'évalue (f > 0 et A > 0), et son plafond est ≥ 0 ; la valeur initiale ne l'emporte jamais. |
| `src/moteur/plafond.js:316:18` | nombre-zero | `1` | `0` | plafond.js, enumerer, plafond part de −0 : au moins un itinéraire s'évalue, de plafond x ≥ 0, et Math.max(−0, x) = x. |
| `src/moteur/plafond.js:318:23` | frontiere | `<` | `<=` | plafond.js, enumerer, i <= f : libres[f] est undefined ; itineraire[undefined] = … pose une propriété hors des index de l'Int32Array, que plafondItineraire ne lit pas (il lit length et les index 0 à R − 1). |
| `src/moteur/plafond.js:324:22` | nombre-zero | `1` | `0` | plafond.js, enumerer, j = i + 0 : le premier tour écrit choix[i] = choix[i], sans effet ; les tours suivants sont ceux du code. |
| `src/moteur/plafond.js:324:27` | frontiere | `<` | `<=` | plafond.js, enumerer, j <= f : choix[f] est hors d'un Int32Array de f cases ; un index hors des éléments d'un tableau typé n'écrit rien. |
| `src/moteur/plafond.js:350:33` | arithmetique | `*` | `/` | plafond.js, plafondsAPrioriParEnumeration, clé subarray(p / R, …) : l'index de début se tronque, et la clé devient une tranche qui finit par la rangée de p. Pour R ≥ 2 sa longueur, (p + 1)R − ⌊p/R⌋, croît strictement avec p : aucune clé n'est partagée, chaque plafond se calcule et reste exact ; pour R = 1, la tranche est la rangée même. |
| `src/moteur/plafond.js:350:43` | nombre-plus-un | `1` | `2` | plafond.js, plafondsAPrioriParEnumeration, clé subarray(pR, (p + 2)R) : la clé ajoute la rangée suivante (rien pour la dernière personne, dont la clé a R cases contre 2R) ; deux clés égales ont même longueur et même début, donc même rangée : le regroupement se fait plus fin, jamais plus large. |
| `src/moteur/plafond.js:352:9` | si-vrai | `plafond === undefined` | `true` | plafond.js, plafondsAPrioriParEnumeration, if (true) : le plafond se recalcule pour chaque personne au lieu d'être repris de sa rangée ; même valeur, seule la mémoïsation de l'oracle se perd, et l'oracle n'a pas de budget de temps. |

## Délais et erreurs (207)

| lieu | opérateur | avant | après | issue |
|---|---|---|---|---|
| `src/moteur/classement.js:95:35` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/classement.js:95:38` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:129:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:153:49` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:182:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:204:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:204:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:204:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:205:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:205:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:210:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:210:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:210:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:211:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:211:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:233:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:233:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:233:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:237:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:237:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:418:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:427:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:431:23` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:431:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:431:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:460:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:485:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:490:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:511:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:511:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/configuration.js:551:21` | negation | `<` | `>=` | délai |
| `src/moteur/configuration.js:551:41` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/configuration.js:551:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:93:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:93:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:93:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:95:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:95:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:99:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:99:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:119:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:121:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:124:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:124:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:160:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:160:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:162:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:162:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:174:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:174:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:174:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:258:45` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/diagnostic.js:258:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:286:21` | negation | `<` | `>=` | délai |
| `src/moteur/diagnostic.js:286:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:286:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:288:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/diagnostic.js:288:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/diagnostic.js:341:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:126:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:126:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:126:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:127:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:127:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:139:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:139:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:157:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:157:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:159:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:164:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:169:25` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:169:43` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:169:46` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:174:31` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:174:49` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:174:52` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:218:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:218:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:218:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:219:27` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:219:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:219:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/indicateurs.js:324:21` | negation | `<` | `>=` | délai |
| `src/moteur/indicateurs.js:324:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/indicateurs.js:324:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:80:40` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/manque.js:80:43` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:227:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/manque.js:227:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/manque.js:281:44` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:74:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:74:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:74:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:81:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:81:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:93:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:93:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:107:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:160:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:160:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:160:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:161:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:161:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:167:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:167:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:167:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:180:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:180:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:205:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:205:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:233:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:233:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:234:33` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:234:36` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:237:27` | arithmetique | `+` | `-` | délai |
| `src/moteur/plafond.js:237:39` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:237:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:246:29` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:246:32` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:265:21` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:265:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:265:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:283:29` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:283:32` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:299:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:299:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:303:7` | si-faux | `f === 0 \|\| A === 0` | `false` | délai |
| `src/moteur/plafond.js:303:15` | logique | `f === 0 \|\| A === 0` | `((f === 0 )&&( A === 0))` | délai |
| `src/moteur/plafond.js:303:20` | negation | `===` | `!==` | délai |
| `src/moteur/plafond.js:303:24` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/plafond.js:303:27` | corps-si | `return plafondItineraire(instance, p, itineraire);` | `{}` | délai |
| `src/moteur/plafond.js:318:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:318:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:320:15` | arithmetique | `-` | `+` | délai |
| `src/moteur/plafond.js:320:17` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:321:14` | frontiere | `>=` | `>` | délai |
| `src/moteur/plafond.js:321:14` | negation | `>=` | `<` | délai |
| `src/moteur/plafond.js:321:17` | nombre-plus-un | `0` | `1` | délai |
| `src/moteur/plafond.js:321:39` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/plafond.js:321:44` | mise-a-jour | `-=` | `+=` | délai |
| `src/moteur/plafond.js:321:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:322:9` | si-faux | `i < 0` | `false` | délai |
| `src/moteur/plafond.js:322:11` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:322:16` | corps-si | `return plafond;` | `{}` | délai |
| `src/moteur/plafond.js:323:14` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:323:17` | nombre-plus-un | `1` | `2` | délai |
| `src/moteur/plafond.js:323:17` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:324:27` | negation | `<` | `>=` | délai |
| `src/moteur/plafond.js:324:34` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/plafond.js:324:37` | nombre-zero | `1` | `0` | délai |
| `src/moteur/plafond.js:349:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:156:18` | nombre-zero | `10` | `0` | délai |
| `src/moteur/recherche.js:201:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:201:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:204:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:204:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:214:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:214:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:217:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:217:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:228:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:228:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:241:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:241:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:242:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:242:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:247:45` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:247:48` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:253:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:253:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:350:57` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:350:60` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:432:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:432:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:438:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:440:44` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:440:47` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:442:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:442:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:444:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:444:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:450:42` | negation | `<` | `>=` | délai |
| `src/moteur/recherche.js:450:54` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:450:57` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:478:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:494:42` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:536:29` | logique | `i < arret && !estNul(courant)` | `((i < arret )\|\|( !estNul(courant)))` | délai |
| `src/moteur/recherche.js:536:52` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:536:55` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:537:9` | si-vrai | `immobile >= patience && ordre === ORDRE_CONTRAINTES` | `true` | délai |
| `src/moteur/recherche.js:537:18` | negation | `>=` | `<` | délai |
| `src/moteur/recherche.js:537:30` | logique | `immobile >= patience && ordre === ORDRE_CONTRAINTES` | `((immobile >= patience )\|\|( ordre === ORDRE_CONTRAINTES))` | délai |
| `src/moteur/recherche.js:616:37` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:616:40` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:665:47` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:665:50` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:779:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:779:31` | nombre-zero | `1` | `0` | délai |
| `src/moteur/recherche.js:780:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/recherche.js:780:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:137:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:163:45` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:174:72` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:181:30` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:181:33` | nombre-zero | `1` | `0` | délai |
| `src/moteur/verification.js:249:28` | mise-a-jour | `+=` | `-=` | délai |
| `src/moteur/verification.js:249:31` | nombre-zero | `1` | `0` | délai |
