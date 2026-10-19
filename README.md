# Gestion table tournante Libre

Logiciel hors ligne qui place les personnes d'un événement autour de tables et
les fait tourner sur plusieurs tours, pour que chacune rencontre le plus de
monde possible.

## Installer et lancer

| système | installer | lancer |
|---|---|---|
| Linux, macOS | `./install.sh` | `./run.sh`, ou `make` |
| Windows | `install.cmd` | `run.cmd` |
| NixOS | `./install.sh` | `./run.sh` ; `make` dans `nix-shell scripts/installation/shell.nix` |

`./install_dev.sh` (sous Windows `install_dev.cmd`) installe en plus le Chromium
des épreuves du navigateur, des polices et, sur amd64, `podman`, sous lequel se
construit l'exécutable Windows.

L'installation pose les paquets du système qui manquent — apt, dnf, zypper ou
pacman, par `sudo` —, puis Node de la majeure écrite dans `.node-version`,
téléchargé de nodejs.org et vérifié contre sa somme, hors du dépôt :
`~/.local/share/gestion_table_tournante_libre`, sous Windows
`%LOCALAPPDATA%\gestion_table_tournante_libre`. Node n'exige donc aucun droit
d'administration. Sous NixOS, `scripts/installation/shell.nix` déclare Node,
Electron et Chromium, d'un nixpkgs épinglé.

Systèmes éprouvés, en conteneurs, par `make verifier_systemes` : Ubuntu 24.04,
25.10 et 26.04, Debian 12 et 13 (Proxmox VE 9 en dérive), Fedora 41 à 44,
AlmaLinux et Rocky Linux 9 et 10, openSUSE Leap 16.0 et Tumbleweed, Arch Linux,
et Nix ; les scripts Windows sous `pwsh`.

`./run.sh` lance la coquille Electron sur une session graphique ; sans écran,
ou là où Electron n'est pas publié (s390x, ppc64le), il sert l'application à un
navigateur sur http://localhost:5173. `./run.sh --web` et `./run.sh --electron`
forcent l'un ou l'autre.

## Commandes

| commande | effet |
|---|---|
| `make` | lance l'application, comme `./run.sh` |
| `make test` | série `node` : les fonctions pures, à chaque modification |
| `make test_long` | épreuves lourdes, avant un commit |
| `make test_navigateur` | épreuves de rendu dans Chromium, avant une livraison |
| `make build` | construit la page dans `www/` |
| `make windows` | construit l'exécutable Windows portable, sous `podman`, depuis Linux, comme `./create_exe.sh` |
| `make essai_demarrage` | lance la vraie coquille Electron, lit son titre et ferme |
| `make help` | toutes les cibles |

Chaque cible passe par le Node du projet. Les commandes npm d'origine restent
valables avec un Node de la bonne majeure dans le `PATH` : `npm test`,
`npm run dev`, `npm run build`.

L'exécutable porte la version datée du logiciel dans son nom, selon le gabarit
`gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe`.

## Documentation

| document | pour qui, pour quoi |
|---|---|
| `GUIDE-USAGE.md` | l'opérateur : le parcours d'une soirée, de la liste des participants à l'impression, écran par écran ; ce que fait la recherche, et ce que relancer peut ou ne peut pas ; en annexe, les réglages, les colonnes du CSV, les commandes, les raccourcis et les démonstrations |
| `GUIDE-WINDOWS.md` | l'opérateur sous Windows : obtenir et lancer l'exécutable, où vont les fichiers, sauvegarder, l'antivirus, la version, signaler un problème |
| `CHANGELOG.md` | ce qui change d'une version à l'autre, et ce qu'il faut faire en remplaçant l'exécutable |

Les images du guide d'usage sont dans `doc/captures/`, avec leur manifeste.
Les tableaux qui suivent, comme les annexes du guide, sont engendrés : on ne
les corrige pas à la main. `node scripts/documentation.js engendrer` les
réécrit depuis leur source ; `node scripts/documentation.js verifier` échoue
dès qu'un tableau diffère de ce que sa source produirait, et la construction
de livraison le lance.

## Contrastes

Le plus petit rapport de contraste relevé pour chaque couleur de l'interface,
dans le rôle où elle sert, sur les captures du guide, en thème clair puis
sombre ; à côté, le seuil que ce rôle exige et la capture où le plus petit
rapport se relève. Un tiret : le thème ne montre pas cette couleur dans ce rôle
sur les captures.

<!-- engendre:debut contrastes -->

| Jeton | Rôle | Seuil | Thème clair | Capture | Thème sombre | Capture |
|---|---|---|---|---|---|---|
| `--couleur-action-encre` | texte | 4,5 | 8,29 | 14-qualite-paires | 9,62 | 14-qualite-paires |
| `--couleur-action-texte` | texte | 4,5 | — | — | 8,45 | 01-premier-ecran |
| `--couleur-avis` | texte | 4,5 | 6,58 | 03-import-rapport | 8,93 | 03-import-rapport |
| `--couleur-bandeau-fond` | texte | 4,5 | 15,94 | 01-premier-ecran | 12,84 | 01-premier-ecran |
| `--couleur-bandeau-texte` | texte | 4,5 | 5,85 | 13a-qualite-tables | 12,84 | 01-premier-ecran |
| `--couleur-bandeau-texte-secondaire` | texte | 4,5 | 9,05 | 01-premier-ecran | 7,60 | 01-premier-ecran |
| `--couleur-chaise-pleine` | marque | 3 | 15,09 | 07a-cibles-sieges | 14,94 | 07a-cibles-sieges |
| `--couleur-chaise-trait` | marque | 3 | 7,44 | 07-plan-tables | 8,13 | 22-plan-brouillon |
| `--couleur-conflit-appartenance` | marque | 3 | 8,92 | 20-mode-lecture | 6,81 | 20-mode-lecture |
| `--couleur-contour-fort` | marque | 3 | 12,30 | 20-mode-lecture | 11,62 | 20-mode-lecture |
| `--couleur-echelle` | marque | 3 | 14,82 | 07-plan-tables | 14,62 | 07-plan-tables |
| `--couleur-fantome` | marque | 3 | 4,34 | 19-ajustement | 4,10 | 19-ajustement |
| `--couleur-filigrane` | marque | 3 | 5,10 | 22-plan-brouillon | 5,10 | 22-plan-brouillon |
| `--couleur-graphique-axe` | marque | 3 | 5,64 | 12-qualite-profil | 5,38 | 12-qualite-profil |
| `--couleur-graphique-bordure-case` | marque | 3 | 4,78 | 12c-qualite-un-tour | 5,38 | 12c-qualite-un-tour |
| `--couleur-graphique-borne` | marque | 3 | 3,93 | 12g-qualite-plafond-nul | 4,96 | 12g-qualite-plafond-nul |
| `--couleur-graphique-encre-claire` | texte | 4,5 | — | — | 6,03 | 13a-qualite-tables |
| `--couleur-graphique-encre-foncee` | texte | 4,5 | 5,43 | 12c-qualite-un-tour | — | — |
| `--couleur-graphique-marque` | marque | 3 | 9,67 | 12-qualite-profil | 10,64 | 12-qualite-profil |
| `--couleur-graphique-niveau-1` | marque | 3 | 3,46 | 12c-qualite-un-tour | 3,31 | 12c-qualite-un-tour |
| `--couleur-graphique-niveau-2` | marque | 3 | 5,85 | 13a-qualite-tables | 5,35 | 13a-qualite-tables |
| `--couleur-graphique-prouve` | marque | 3 | 4,23 | 13-qualite-collisions | 5,12 | 13-qualite-collisions |
| `--couleur-graphique-repere` | marque | 3 | 6,15 | 12-qualite-profil | 7,01 | 12-qualite-profil |
| `--couleur-graphique-reste` | marque | 3 | 5,10 | 13-qualite-collisions | 6,89 | 13-qualite-collisions |
| `--couleur-graphique-serie-1` | marque | 3 | 5,10 | 12-qualite-profil | 6,89 | 12-qualite-profil |
| `--couleur-graphique-serie-2` | marque | 3 | 4,53 | 12g-qualite-plafond-nul | 6,29 | 12g-qualite-plafond-nul |
| `--couleur-hachure` | marque | 3 | 16,48 | 08-animateurs-designes | 15,21 | 08-animateurs-designes |
| `--couleur-liste-texte` | texte | 4,5 | 14,82 | 07-plan-tables | — | — |
| `--couleur-marque` | marque | 3 | 3,63 | 07a-cibles-sieges | 3,50 | 07a-cibles-sieges |
| `--couleur-page-texte` | texte | 4,5 | 13,78 | 01b-passer-en-ecriture | 11,02 | 02c-import-presence |
| `--couleur-page-texte-secondaire` | texte | 4,5 | 5,57 | 01-premier-ecran | 6,72 | 01b-passer-en-ecriture |
| `--couleur-papier` | texte | 4,5 | — | — | 5,00 | 12c-qualite-un-tour |
| `--couleur-pastille-fond` | marque | 3 | 13,44 | 19-ajustement | 11,62 | 19-ajustement |
| `--couleur-pastille-texte` | texte | 4,5 | — | — | 14,51 | 19-ajustement |
| `--couleur-poignee` | marque | 3 | 7,44 | 07-plan-tables | 11,32 | 07-plan-tables |
| `--couleur-refus` | texte | 4,5 | 8,34 | 01b-passer-en-ecriture | 8,14 | 01b-passer-en-ecriture |
| `--couleur-retrait` | marque | 3 | 5,62 | 04a-etiquettes | 5,96 | 04a-etiquettes |
| `--couleur-selection` | marque | 3 | 4,57 | 08-animateurs-designes | 4,18 | 08-animateurs-designes |
| `--couleur-table-trait` | marque | 3 | 7,44 | 07-plan-tables | 5,59 | 07-plan-tables |
| `rgb(24, 33, 47)` | texte | 4,5 | — | — | 16,19 | 22-plan-brouillon |
| `rgb(28, 33, 40)` | texte | 4,5 | — | — | 16,18 | 22-plan-brouillon |

<!-- engendre:fin contrastes -->

## Constantes

Les seuils et les durées dont le logiciel dépend, chacun avec son unité, celui
qui en fixe la valeur — le banc de mesure, un contrôle à la main, ou
l'exécution elle-même —, son statut et la façon de le relever. Une valeur au
« défaut de travail » attend encore son relevé.

<!-- engendre:debut constantes -->

| Constante | Ce qu’elle mesure | Valeur | Statut | Propriétaire | Protocole | Valeur proposée par le banc | Configuration du relevé |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `SEUIL_GLISSER_PX` | déplacement du pointeur, entre pointerdown et pointerup, au-delà duquel un appui devient un glissement | 4 px | défaut de travail | manuel | vingt clics délibérés au pavé tactile de la machine de référence ; le plus grand déplacement entre pointerdown et pointerup, × 1,5, écrit dans ce registre | — | pavé tactile de la machine de référence |
| `DUREE_PRESSION_LONGUE_MS` | durée d'un appui immobile au-delà de laquelle il ouvre le menu d'une personne | 500 ms | défaut de travail | manuel | à l'écran tactile de la machine de référence, la plus courte durée qu'aucun appui bref ne déclenche, sur dix essais, écrite dans ce registre | — | écran tactile de la machine de référence |
| `SEUIL_SIEGES_LISIBLES` | plus grand nombre de places d'une table dont la liste de noms reste lisible | 18 places | mesurée | banc | banc de mesure, cadre de 1 366 × 700 px : le plus grand nombre de places dont la liste, à la hauteur de ligne mesurée, tient dans la hauteur du cadre au zoom ajusté d'une table seule, ronde puis carrée, par dichotomie ; le plus petit des deux seuils, écrit dans ce registre | 18 places | cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, 16 processeurs logiques, processeur non ralenti, police Noto Sans |
| `K_LISTES` | échelle sous laquelle le plan retire les listes de noms | 0,3 px/cm | défaut de travail | manuel | une personne qui n'a pas écrit le logiciel lit les listes de la grande démonstration sur la machine de référence à k décroissant ; le plus petit k où elle les lit sans erreur, écrit dans ce registre | — | grande démonstration, 33 tables avec listes, machine de référence, cadre de 1 366 × 700 px |
| `LARGEUR_BLOC_NOMS_CM` | largeur, dans le dessin, du bloc de noms d'une table, où un nom trop long s'abrège | 500 cm | défaut de travail | manuel | relecture de la grande démonstration au zoom par défaut par une personne qui n'a pas écrit le logiciel (§ 19.11) ; la largeur retenue, écrite dans ce registre | — | grande démonstration au zoom par défaut |
| `HAUTEUR_LIGNE` | hauteur d'une ligne d'une liste de noms, dans le dessin | relevée à l’exécution | mesurée | exécution | mesurée à chaque montage du plan : measureText du gabarit « Ôjgq Æ W » sur la police calculée des listes ; aucune valeur n'est écrite dans ce registre | — | police calculée des listes, relevée à chaque montage du plan |
| `ZONE_SILENCE_MM` | distance en deçà de laquelle aucun texte ni aucune marque ne s'approche d'un bord de badge | 8 mm | défaut de travail | manuel | sur chaque imprimante visée : une planche de filets imprimée, son décalage mesuré à la règle, plus l'erreur de dix coupes ; puis sa marge non imprimable et le biais d'entraînement sur dix feuilles. La plus grande des deux bornes, arrondie au millimètre supérieur, écrite dans ce registre | — | imprimantes visées, chaque papier des sorties, massicot et ciseaux |
| `HAUTEUR_CAPITALE_NOM_MAX_MM` | hauteur de capitale du nom sur le badge, au plus grand corps que la mise en page lui donne | 9 mm | défaut de travail | manuel | impression réelle d'une planche ; lecture à un mètre par une personne qui n'a pas écrit le logiciel ; la hauteur retenue, écrite dans ce registre | — | badge A6 imprimé, police embarquée, lecture à un mètre |
| `HAUTEUR_CAPITALE_NOM_PLANCHER_MM` | hauteur de capitale du nom sous laquelle la mise en page ne descend pas : un nom plus long replie | 4 mm | défaut de travail | manuel | impression réelle d'une planche à hauteurs décroissantes ; lecture à un mètre par une personne qui n'a pas écrit le logiciel ; la plus petite lue sans erreur, écrite dans ce registre | — | badge A6 imprimé, police embarquée, lecture à un mètre |
| `CORPS_TOURS_PT` | corps des lignes de tour du badge | 14 pt | défaut de travail | manuel | impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; le corps retenu, écrit dans ce registre | — | badge A6 imprimé, police embarquée, lecture en main |
| `CORPS_TOURS_PLANCHER_PT` | corps sous lequel les lignes de tour ne descendent pas | 10 pt | défaut de travail | manuel | impression réelle d'une planche à corps décroissants ; lecture en main par une personne qui n'a pas écrit le logiciel ; le plus petit corps lu sans erreur, écrit dans ce registre | — | badge A6 imprimé, police embarquée, lecture en main |
| `CORPS_APPARTENANCE_PT` | corps de la ligne d'appartenance du badge | 12 pt | défaut de travail | manuel | impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; le corps retenu, écrit dans ce registre | — | badge A6 imprimé, police embarquée, lecture en main |
| `CORPS_PIED_PT` | corps du pied du badge : nom et date de l'événement, horodatage du placement | 8 pt | défaut de travail | manuel | impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; le corps retenu, écrit dans ce registre | — | badge A6 imprimé, police embarquée, lecture en main |
| `CORPS_MIN_IMPRESSION_MM` | hauteur de caractère du plan imprimé en deçà de laquelle le plan se découpe en pages | 2,5 mm | défaut de travail | manuel | page d'essai à corps décroissants imprimée sur l'imprimante visée, lue à bout de bras ; le plus petit corps lu sans erreur, écrit dans ce registre | — | imprimante visée, chaque papier des sorties, lecture à bout de bras |
| `MARGE_PAGE_MM` | marge de chaque bord d'une page imprimée par l'aperçu | 10 mm | défaut de travail | manuel | marge non imprimable mesurée sur chaque imprimante visée (une page de filets à 1 mm d'écart, lue à la règle) ; la plus grande, écrite dans ce registre | — | imprimantes visées, chaque papier des sorties |
| `HAUTEUR_BANDE_IMPRESSION` | hauteur de ce que porte une feuille imprimée hors de sa zone de contenu : pied, mentions, barre, cartouche | relevée à l’exécution | mesurée | exécution | mesurée à l'ouverture de l'aperçu : tout ce qu'une feuille porte hors de [data-contenu] ; aucune valeur n'est écrite dans ce registre | — | rendu de l'aperçu, relevé à chaque ouverture |
| `TOLERANCE_CHAINE_TEMOIN` | écart relatif admis entre la longueur rendue de la chaîne témoin et celle que donnent les avances de la police | 0,011 rapport | mesurée | banc | banc de mesure : le quart de l'écart relatif entre la police embarquée et une famille de repli forcée, et au moins trois fois la gigue de dix mesures, chaîne témoin à 16 px, crénage et ligatures coupés ; arrondi par excès à deux chiffres significatifs, écrit dans ce registre | 0,011 rapport | cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, 16 processeurs logiques, processeur non ralenti, police Noto Sans |
| `RALENTISSEMENT_PLEINE_CHARGE` | ralentissement d'une génération quand tous les processeurs logiques travaillent, t(L) / t(1) | 2 × | défaut de travail | banc | banc de mesure : durée d'une même génération sur un travailleur, puis sur L travailleurs ; le rapport ρ des médianes, écrit dans ce registre | 2,98 × | cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, 16 processeurs logiques, processeur non ralenti, police Noto Sans |
| `SEUIL_MATRICE_PARTICIPANTS` | nombre de participants au-delà duquel une case de la matrice « qui a rencontré qui » tombe sous la cible de 24 px dans la largeur de la carte, au cadre fixé | 44 participants | mesurée | banc | banc de mesure, cadre de 1 366 × 700 px : le plus grand nombre de participants dont la case de la matrice tient 24 px dans la largeur de la carte de la vue, noms en tête compris, relevé sur le rendu ; la valeur proposée, adoptée à la main dans ce registre | 44 participants | cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, 16 processeurs logiques, processeur non ralenti, police Noto Sans |
| `LARGEUR_TRONCATURE_NOM_PX` | largeur à laquelle un nom se tronque dans une étiquette de graphique | 168 px | mesurée | banc | banc de mesure, police Noto Sans : la largeur rendue d'un nom de 14 caractères, chacun le glyphe le plus large de l'alphabet visé, au corps des étiquettes de graphique, dans la marge gauche d'une vue à barres — jamais un nom de démonstration ; arrondie au pixel supérieur, adoptée à la main dans ce registre | 168 px | cadre de 1 366 × 700 px, facteur 1, Chromium 153.0.8010.12, Node v26.10.0, 16 processeurs logiques, processeur non ralenti, police Noto Sans |
| `VALEURS_MANQUE_COURBE` | nombre de valeurs distinctes de manque, sur les deux profils comparés réunis, sous lequel la vue de comparaison écrit les effectifs en une phrase au lieu de tracer | 3 valeurs | défaut de travail | manuel | règle de forme, non une mesure : le banc ne la relève pas. Une personne qui n'a pas écrit le logiciel lit la vue de comparaison sur une soirée détendue et sur une soirée serrée ; le plus petit nombre de valeurs dont le tracé dit plus que la phrase, écrit dans ce registre | — | vue de comparaison de la page de qualité, une soirée détendue et une soirée serrée |

<!-- engendre:fin constantes -->

## Licence

© 2026 TechnoLibre. GNU Affero General Public License, version 3 ou ultérieure ;
texte complet dans `LICENSE`.

L'application embarque la police **Noto Sans** (Regular et Bold), sous la
**SIL Open Font License 1.1**, sans nom de police réservé : elle sert à la
planche de badges et à l'interface. Son texte est dans
`public/licences/NotoSans-OFL.txt`, sa provenance dans `src/polices/PROVENANCE`.
Les avis des paquets que la page incorpore — Svelte, pdf-lib, fontkit et ce
qu'ils tirent — sont dans `public/licences/TIERS.txt`. Les deux fichiers
voyagent avec la page, dans `www/licences/`.
