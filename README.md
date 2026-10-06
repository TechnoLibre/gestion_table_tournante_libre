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

## Licence

© 2026 TechnoLibre. GNU Affero General Public License, version 3 ou ultérieure ;
texte complet dans `LICENSE`.
