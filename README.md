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
| `make windows` | construit l'exécutable Windows portable, sous `podman`, depuis Linux |
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
| `--couleur-bandeau-fond` | texte | 4,5 | 14,26 | 01-premier-ecran | 12,84 | 01-premier-ecran |
| `--couleur-bandeau-texte` | texte | 4,5 | 13,44 | 19-ajustement | 12,84 | 01-premier-ecran |
| `--couleur-cadre-ecriture` | marque | 3 | 4,78 | 02-import-apercu | 9,10 | 02-import-apercu |
| `--couleur-cadre-lecture` | marque | 3 | 5,29 | 01b-passer-en-ecriture | 7,34 | 01b-passer-en-ecriture |
| `--couleur-chaise-pleine` | marque | 3 | 15,38 | 07a-cibles-sieges | 14,94 | 07a-cibles-sieges |
| `--couleur-chaise-trait` | marque | 3 | 7,58 | 07-plan-tables | 8,89 | 07-plan-tables |
| `--couleur-conflit-appartenance` | marque | 3 | 8,92 | 19-ajustement | 6,81 | 19-ajustement |
| `--couleur-contour-fort` | marque | 3 | 12,54 | 19-ajustement | 11,62 | 19-ajustement |
| `--couleur-echelle` | marque | 3 | 15,10 | 07-plan-tables | 14,62 | 07-plan-tables |
| `--couleur-fantome` | marque | 3 | 4,34 | 19-ajustement | 4,10 | 19-ajustement |
| `--couleur-hachure` | marque | 3 | 16,48 | 08-animateurs-designes | 15,21 | 08-animateurs-designes |
| `--couleur-marque` | marque | 3 | 3,63 | 07a-cibles-sieges | 3,50 | 07a-cibles-sieges |
| `--couleur-page-texte` | texte | 4,5 | 15,10 | 01-premier-ecran | 11,39 | 19-ajustement |
| `--couleur-page-texte-secondaire` | texte | 4,5 | 7,05 | 10-diagnostic | 7,98 | 10-diagnostic |
| `--couleur-papier` | texte | 4,5 | — | — | 5,33 | 09-refus-sur-place |
| `--couleur-pastille-fond` | marque | 3 | 13,44 | 19-ajustement | 11,62 | 19-ajustement |
| `--couleur-pastille-texte` | texte | 4,5 | — | — | 14,51 | 19-ajustement |
| `--couleur-poignee` | marque | 3 | 7,58 | 07-plan-tables | 11,32 | 07-plan-tables |
| `--couleur-refus` | texte | 4,5 | 8,76 | 01b-passer-en-ecriture | 9,24 | 01b-passer-en-ecriture |
| `--couleur-selection` | marque | 3 | 4,66 | 08-animateurs-designes | 4,18 | 08-animateurs-designes |
| `--couleur-table-trait` | marque | 3 | 7,58 | 07-plan-tables | 5,59 | 07-plan-tables |
| `rgb(0, 0, 0)` | texte | 4,5 | 18,26 | 09-refus-sur-place | — | — |

<!-- engendre:fin contrastes -->

## Constantes

Les seuils et les durées dont le logiciel dépend, chacun avec son unité, celui
qui en fixe la valeur — le banc de mesure, un contrôle à la main, ou
l'exécution elle-même —, son statut et la façon de le relever. Une valeur au
« défaut de travail » attend encore son relevé.

<!-- engendre:debut constantes -->

| Constante | Valeur | Unité | Propriétaire | Statut | Protocole |
|---|---|---|---|---|---|
| `SEUIL_GLISSER_PX` | 4 | px | manuel | défaut de travail | vingt clics délibérés au pavé tactile de la machine de référence ; le plus grand déplacement entre pointerdown et pointerup, × 1,5, écrit dans ce registre |
| `DUREE_PRESSION_LONGUE_MS` | 500 | ms | manuel | défaut de travail | à l'écran tactile de la machine de référence, la plus courte durée qu'aucun appui bref ne déclenche, sur dix essais, écrite dans ce registre |
| `SEUIL_SIEGES_LISIBLES` | 16 | places | banc | défaut de travail | banc de mesure, cadre de 1 366 × 700 px : le plus grand nombre de places dont la liste, à la hauteur de ligne mesurée, tient dans la hauteur du cadre au zoom ajusté d'une table seule ; écrit dans ce registre |
| `K_LISTES` | 0,3 | px/cm | manuel | défaut de travail | une personne qui n'a pas écrit le logiciel lit les listes de la grande démonstration sur la machine de référence à k décroissant ; le plus petit k où elle les lit sans erreur, écrit dans ce registre |
| `LARGEUR_BLOC_NOMS_CM` | 500 | cm | manuel | défaut de travail | relecture de la grande démonstration au zoom par défaut par une personne qui n'a pas écrit le logiciel (§ 19.11) ; la largeur retenue, écrite dans ce registre |
| `HAUTEUR_LIGNE` | — | cm | execution | mesurée | mesurée à chaque montage du plan : measureText du gabarit « Ôjgq Æ W » sur la police calculée des listes ; aucune valeur n'est écrite dans ce registre |
| `ZONE_SILENCE_MM` | 8 | mm | manuel | défaut de travail | sur chaque imprimante visée : une planche de filets imprimée, son décalage mesuré à la règle, plus l'erreur de dix coupes ; puis sa marge non imprimable et le biais d'entraînement sur dix feuilles. La plus grande des deux bornes, arrondie au millimètre supérieur, écrite dans ce registre |
| `HAUTEUR_CAPITALE_NOM_MAX_MM` | 9 | mm | manuel | défaut de travail | impression réelle d'une planche ; lecture à un mètre par une personne qui n'a pas écrit le logiciel ; la hauteur retenue, écrite dans ce registre |
| `HAUTEUR_CAPITALE_NOM_PLANCHER_MM` | 4 | mm | manuel | défaut de travail | impression réelle d'une planche à hauteurs décroissantes ; lecture à un mètre par une personne qui n'a pas écrit le logiciel ; la plus petite lue sans erreur, écrite dans ce registre |
| `CORPS_TOURS_PT` | 14 | pt | manuel | défaut de travail | impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; le corps retenu, écrit dans ce registre |
| `CORPS_TOURS_PLANCHER_PT` | 10 | pt | manuel | défaut de travail | impression réelle d'une planche à corps décroissants ; lecture en main par une personne qui n'a pas écrit le logiciel ; le plus petit corps lu sans erreur, écrit dans ce registre |
| `CORPS_APPARTENANCE_PT` | 12 | pt | manuel | défaut de travail | impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; le corps retenu, écrit dans ce registre |
| `CORPS_PIED_PT` | 8 | pt | manuel | défaut de travail | impression réelle d'une planche ; lecture en main par une personne qui n'a pas écrit le logiciel ; le corps retenu, écrit dans ce registre |
| `CORPS_MIN_IMPRESSION_MM` | 2,5 | mm | manuel | défaut de travail | page d'essai à corps décroissants imprimée sur l'imprimante visée, lue à bout de bras ; le plus petit corps lu sans erreur, écrit dans ce registre |
| `MARGE_PAGE_MM` | 10 | mm | manuel | défaut de travail | marge non imprimable mesurée sur chaque imprimante visée (une page de filets à 1 mm d'écart, lue à la règle) ; la plus grande, écrite dans ce registre |
| `HAUTEUR_BANDE_IMPRESSION` | — | mm | execution | mesurée | mesurée à l'ouverture de l'aperçu : tout ce qu'une feuille porte hors de [data-contenu] ; aucune valeur n'est écrite dans ce registre |
| `TOLERANCE_CHAINE_TEMOIN` | 0,01 | rapport | banc | défaut de travail | banc de mesure : le quart de l'écart relatif entre la police embarquée et une famille de repli forcée, et au moins trois fois la gigue de dix mesures ; écrit dans ce registre |
| `RALENTISSEMENT_PLEINE_CHARGE` | 2 | × | banc | défaut de travail | banc de mesure : durée d'une même génération sur un travailleur, puis sur L travailleurs ; le rapport ρ des médianes, écrit dans ce registre |

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
