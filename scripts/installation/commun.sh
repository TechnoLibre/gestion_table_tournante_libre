#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Fonctions communes d'install.sh, d'install_dev.sh, de run.sh et
# d'avec_node.sh : reconnaître le système, poser le Node du projet, installer
# des paquets. Ce fichier se source, il ne s'exécute pas.
#
# Il reste lisible par le bash 3.2 de macOS : ni tableau associatif, ni
# ${v,,}, ni mapfile, ni readlink -f.

GTT_RACINE="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)"

gtt_dire() {
  printf '%s\n' "$*" >&2
}

gtt_refuser() {
  printf 'Refusé : %s\n' "$*" >&2
  exit 1
}

# Famille d'un fichier os-release : debian, fedora, suse, arch, nixos ou
# inconnu. ID puis ID_LIKE décident, et non le nom affiché : AlmaLinux et
# Rocky se déclarent « rhel centos fedora », Linux Mint « ubuntu debian »,
# Proxmox VE « debian ». NixOS passe en premier : sa famille ne pose aucun
# paquet.
gtt_famille_depuis_os_release() {
  local fichier="$1" id id_like
  if [ ! -r "$fichier" ]; then
    echo inconnu
    return
  fi
  id="$(sed -n 's/^ID=//p' "$fichier" | tr -d "\"'" | head -n 1)"
  id_like="$(sed -n 's/^ID_LIKE=//p' "$fichier" | tr -d "\"'" | head -n 1)"
  case " $id $id_like " in
    *" nixos "*) echo nixos ;;
    *" debian "* | *" ubuntu "*) echo debian ;;
    *" suse "* | *" opensuse "* | *" opensuse-leap "* | *" opensuse-tumbleweed "* | *" sles "*) echo suse ;;
    *" fedora "* | *" rhel "* | *" centos "*) echo fedora ;;
    *" arch "*) echo arch ;;
    *) echo inconnu ;;
  esac
}

# Famille du système courant : celles d'os-release, plus macos et windows
# (bash de Git, MSYS2, Cygwin). GTT_FAMILLE la force, pour un dérivé que
# os-release ne rattache à rien. uname -s interroge le noyau ; $OSTYPE, figé
# à la compilation de bash, vaut « linux » sous openSUSE et « linux-gnu »
# ailleurs.
gtt_famille() {
  if [ -n "${GTT_FAMILLE:-}" ]; then
    echo "$GTT_FAMILLE"
    return
  fi
  case "$(uname -s)" in
    Darwin) echo macos ;;
    MINGW* | MSYS* | CYGWIN*) echo windows ;;
    Linux) gtt_famille_depuis_os_release /etc/os-release ;;
    *) echo inconnu ;;
  esac
}

# Architecture d'une machine au sens de nodejs.org (x64, arm64, s390x,
# ppc64le), « inconnue » ailleurs.
gtt_arch_node_depuis() {
  case "$1" in
    x86_64 | amd64) echo x64 ;;
    aarch64 | arm64) echo arm64 ;;
    s390x) echo s390x ;;
    ppc64le) echo ppc64le ;;
    *) echo inconnue ;;
  esac
}

gtt_arch_node() {
  gtt_arch_node_depuis "$(uname -m)"
}

# Système au sens de nodejs.org : linux, darwin, win.
gtt_os_node() {
  case "$(gtt_famille)" in
    macos) echo darwin ;;
    windows) echo win ;;
    *) echo linux ;;
  esac
}

# Vrai quand Electron publie un binaire pour ce système et cette
# architecture. Ailleurs — s390x, ppc64le —, l'application se sert dans un
# navigateur.
gtt_electron_publie() {
  case "$1-$2" in
    linux-x64 | linux-arm64 | darwin-x64 | darwin-arm64) return 0 ;;
    *) return 1 ;;
  esac
}

gtt_electron_disponible() {
  gtt_electron_publie "$(gtt_os_node)" "$(gtt_arch_node)"
}

# Vrai quand Playwright publie son Chromium pour ce système et cette
# architecture : les épreuves du navigateur n'ont pas d'autre moteur.
gtt_chromium_disponible() {
  gtt_electron_publie "$(gtt_os_node)" "$(gtt_arch_node)"
}

# Majeure de Node que vise le projet. .node-version en est la seule source ;
# une valeur qui n'est pas un entier est refusée plutôt que passée à une URL.
gtt_node_majeure() {
  local majeure
  majeure="$(tr -d ' \t\r\n' < "$GTT_RACINE/.node-version")"
  case "$majeure" in
    '' | *[!0-9]*) gtt_refuser ".node-version doit porter une majeure entière : « $majeure »." ;;
  esac
  echo "$majeure"
}

# Dossiers hors du dépôt : le Node posé, et les archives téléchargées. Rangé
# hors du dépôt, Node échappe à l'observateur de Vite, au balayage des
# épreuves et à « git clean », et sert à chaque copie de travail.
gtt_dossier_donnees() {
  echo "${XDG_DATA_HOME:-$HOME/.local/share}/gestion_table_tournante_libre"
}

gtt_dossier_cache() {
  echo "${XDG_CACHE_HOME:-$HOME/.cache}/gestion_table_tournante_libre"
}

gtt_dossier_node() {
  echo "$(gtt_dossier_donnees)/node-$(gtt_node_majeure)-$(gtt_os_node)-$(gtt_arch_node)"
}

# Somme et nom de l'archive .tar.xz d'une plateforme dans un SHASUMS256.txt
# de nodejs.org, lignes « <somme>  node-v26.1.0-linux-x64.tar.xz » ; rien
# quand la plateforme n'y figure pas. Le suffixe se compare en entier :
# « linux-x64 » ne retient ni « linux-x64-musl » ni une archive .tar.gz.
gtt_archive_node() {
  local sommes="$1" os="$2" arch="$3"
  awk -v suffixe="-$os-$arch.tar.xz" '
    $2 ~ /^node-v[0-9]+\.[0-9]+\.[0-9]+-/ &&
    length($2) > length(suffixe) &&
    substr($2, length($2) - length(suffixe) + 1) == suffixe {
      print $1, $2
      exit
    }' "$sommes"
}

gtt_telecharger() {
  local url="$1" destination="$2"
  if command -v curl > /dev/null 2>&1; then
    curl -fsSL --retry 3 -o "$destination" "$url"
  elif command -v wget > /dev/null 2>&1; then
    wget -q -O "$destination" "$url"
  else
    gtt_refuser "ni curl ni wget : impossible de télécharger $url"
  fi
}

gtt_sha256() {
  if command -v sha256sum > /dev/null 2>&1; then
    sha256sum "$1" | cut -d ' ' -f 1
  else
    shasum -a 256 "$1" | cut -d ' ' -f 1
  fi
}

# Pose la dernière version publiée de la majeure voulue, une fois : un Node
# déjà posé qui démarre est gardé. L'archive est vérifiée contre la somme
# que nodejs.org publie, puis extraite à côté de la cible et renommée, si
# bien qu'une extraction interrompue ne laisse jamais une cible à moitié
# écrite.
gtt_poser_node() {
  local majeure os arch cible cache sommes ligne somme nom archive partiel tmp manquantes
  majeure="$(gtt_node_majeure)"
  os="$(gtt_os_node)"
  arch="$(gtt_arch_node)"
  [ "$arch" != inconnue ] || gtt_refuser "architecture $(uname -m) : nodejs.org n'y publie pas Node."
  cible="$(gtt_dossier_node)"
  if [ -x "$cible/bin/node" ] && "$cible/bin/node" --version > /dev/null 2>&1; then
    gtt_dire "Node $("$cible/bin/node" --version) : $cible"
    return 0
  fi
  cache="$(gtt_dossier_cache)"
  mkdir -p "$(gtt_dossier_donnees)" "$cache"
  sommes="$cache/SHASUMS256-v$majeure.txt"
  gtt_telecharger "https://nodejs.org/dist/latest-v$majeure.x/SHASUMS256.txt" "$sommes"
  ligne="$(gtt_archive_node "$sommes" "$os" "$arch")"
  [ -n "$ligne" ] || gtt_refuser "nodejs.org ne publie pas Node $majeure pour $os-$arch."
  somme="${ligne%% *}"
  nom="${ligne#* }"
  archive="$cache/$nom"
  if [ ! -f "$archive" ] || [ "$(gtt_sha256 "$archive")" != "$somme" ]; then
    gtt_dire "Téléchargement de $nom"
    # Nom unique : deux installations qui partagent le cache téléchargent
    # chacune dans son fichier.
    partiel="$(mktemp "$archive.XXXXXX")"
    gtt_telecharger "https://nodejs.org/dist/latest-v$majeure.x/$nom" "$partiel"
    if [ "$(gtt_sha256 "$partiel")" != "$somme" ]; then
      rm -f "$partiel"
      gtt_refuser "$nom : la somme SHA-256 ne correspond pas à celle que publie nodejs.org."
    fi
    mv -f "$partiel" "$archive"
  fi
  tmp="$(mktemp -d "$(gtt_dossier_donnees)/extraction.XXXXXX")"
  tar -xJf "$archive" -C "$tmp"
  rm -rf "$cible"
  mv "$tmp/${nom%.tar.xz}" "$cible"
  rmdir "$tmp"
  if ! "$cible/bin/node" --version > /dev/null 2>&1; then
    manquantes="$(gtt_bibliotheques_manquantes "$cible/bin/node")"
    rm -rf "$cible"
    gtt_refuser "le Node de nodejs.org ne démarre pas ici${manquantes:+ ; bibliothèques absentes : $manquantes}."
  fi
  gtt_dire "Node $("$cible/bin/node" --version) posé : $cible"
}

# Met le Node du projet en tête du PATH ; faux quand il n'est pas posé.
gtt_activer_node() {
  local bin
  bin="$(gtt_dossier_node)/bin"
  [ -x "$bin/node" ] || return 1
  PATH="$bin:$PATH"
  export PATH
}

# Vrai quand les dépendances npm suivent package-lock.json : npm écrit
# node_modules/.package-lock.json à chaque installation, et un verrou plus
# récent que lui annonce une installation à refaire.
gtt_dependances_a_jour() {
  local recu="$GTT_RACINE/node_modules/.package-lock.json"
  [ -f "$recu" ] && [ ! "$GTT_RACINE/package-lock.json" -nt "$recu" ]
}

# Vrai sur une réponse affirmative au terminal — o, oui, y, yes, sans égard à
# la casse. Le défaut est non, et sans terminal rien ne consent. Seul le
# terminal répond : GTT_OUI n'est pas lu.
gtt_demander() {
  local reponse
  [ -t 0 ] || return 1
  printf '%s [o/N] ' "$1" >&2
  read -r reponse || return 1
  case "$(printf '%s' "$reponse" | tr '[:upper:]' '[:lower:]')" in
    o | oui | y | yes) return 0 ;;
    *) return 1 ;;
  esac
}

# Comme gtt_demander, sauf que GTT_OUI=1 répond oui d'avance, pour une
# installation sans opérateur.
gtt_confirmer() {
  [ "${GTT_OUI:-}" = 1 ] && return 0
  gtt_demander "$1"
}

# Exécute une commande d'administration : telle quelle sous root, par sudo
# ailleurs.
gtt_admin() {
  if [ "$(id -u)" = 0 ]; then
    "$@"
  elif command -v sudo > /dev/null 2>&1; then
    sudo "$@"
  else
    gtt_refuser "sudo introuvable : relancer en root, ou exécuter : $*"
  fi
}

# Nom d'un paquet apt sur ce système. Debian 13 et Ubuntu 24.04 ont renommé
# en « t64 » les bibliothèques dont l'interface a changé avec le temps sur
# 64 bits ; l'ancien nom n'y est plus qu'un paquet virtuel, qu'apt-get refuse
# d'installer sans qu'on choisisse son fournisseur.
gtt_nom_apt() {
  if apt-cache show "${1}t64" > /dev/null 2>&1; then
    echo "${1}t64"
  else
    echo "$1"
  fi
}

# Paquets de la liste qui ne sont pas installés, un par ligne, sous le nom
# que le gestionnaire connaît. Sous apt, les noms t64 se résolvent par
# apt-cache, qui ne connaît que les paquets des listes déjà téléchargées.
gtt_paquets_manquants() {
  local famille="$1" paquet nom
  shift
  case "$famille" in
    arch) pacman -T "$@" 2> /dev/null || true ;;
    *)
      for paquet in "$@"; do
        case "$famille" in
          debian)
            nom="$(gtt_nom_apt "$paquet")"
            [ "$(dpkg-query -W -f='${db:Status-Abbrev}' "$nom" 2> /dev/null)" = "ii " ] || echo "$nom"
            ;;
          fedora | suse) rpm -q "$paquet" > /dev/null 2>&1 || echo "$paquet" ;;
          *) echo "$paquet" ;;
        esac
      done
      ;;
  esac
}

# Installe ce qui manque de la liste par le gestionnaire de la famille, sans
# question ; rien, et sans sudo, quand tout est là. pacman met tout le
# système à jour : Arch ne prend pas en charge les mises à jour partielles.
# $noms se découpe en paquets, un par mot.
# shellcheck disable=SC2086
gtt_installer_paquets() {
  local famille="$1" paquet noms
  shift
  [ $# -gt 0 ] || return 0
  if [ "$famille" = debian ] && ! apt-cache show libc6 > /dev/null 2>&1; then
    gtt_admin env DEBIAN_FRONTEND=noninteractive apt-get update -q
  fi
  noms="$(gtt_paquets_manquants "$famille" "$@" | tr '\n' ' ')"
  if [ -z "${noms// /}" ]; then
    gtt_dire "Paquets du système : déjà installés."
    return 0
  fi
  gtt_dire "Paquets du système à installer : $noms"
  case "$famille" in
    debian)
      gtt_admin env DEBIAN_FRONTEND=noninteractive apt-get update -q
      gtt_admin env DEBIAN_FRONTEND=noninteractive apt-get install -y -q --no-install-recommends $noms
      ;;
    fedora) gtt_admin dnf install -y $noms ;;
    suse) gtt_admin zypper --non-interactive install --no-recommends $noms ;;
    arch) gtt_admin pacman -Syu --noconfirm --needed $noms ;;
    *) gtt_refuser "aucun gestionnaire de paquets connu pour la famille « $famille »." ;;
  esac
}

# Outils dont les scripts et les épreuves se servent, par famille : de quoi
# télécharger et extraire Node, la libatomic que réclame le Node de
# nodejs.org, awk, que l'image de Tumbleweed n'a pas, make, et file et find,
# qu'appelle l'épreuve de scripts/construire_windows.sh. curl n'est demandé qu'en l'absence de curl
# et de wget : Fedora et ses dérivés livrent curl-minimal, qu'un paquet curl
# contredirait.
gtt_paquets_outils() {
  local liste="make file tar"
  if ! command -v curl > /dev/null 2>&1 && ! command -v wget > /dev/null 2>&1; then
    liste="$liste curl"
  fi
  case "$1" in
    debian) echo "$liste ca-certificates xz-utils findutils libatomic1" ;;
    fedora) echo "$liste ca-certificates xz findutils libatomic" ;;
    suse) echo "$liste ca-certificates xz findutils gawk libatomic1" ;;
    arch) echo "$liste ca-certificates xz findutils gcc-libs" ;;
  esac
}

# Bibliothèques qu'Electron charge au démarrage, par famille : GTK 3, NSS,
# ALSA, GBM, et les extensions X11 du compositeur. L'installation vérifie
# ensuite par ldd qu'aucune ne manque.
gtt_paquets_electron() {
  case "$1" in
    debian)
      echo "libgtk-3-0 libnss3 libasound2 libgbm1 libdrm2 libxkbcommon0" \
        "libatk-bridge2.0-0 libcups2 libxcomposite1 libxdamage1 libxrandr2" \
        "libpango-1.0-0 libcairo2 libatspi2.0-0"
      ;;
    fedora)
      echo "gtk3 nss alsa-lib mesa-libgbm libdrm libxkbcommon at-spi2-atk" \
        "cups-libs libXcomposite libXdamage libXrandr pango cairo"
      ;;
    suse)
      echo "libgtk-3-0 mozilla-nss libasound2 libgbm1 libdrm2 libxkbcommon0" \
        "libatk-bridge-2_0-0 libcups2 libXcomposite1 libXdamage1 libXrandr2" \
        "libpango-1_0-0 libcairo2"
      ;;
    arch)
      echo "gtk3 nss alsa-lib mesa libdrm libxkbcommon at-spi2-core libcups" \
        "libxcomposite libxdamage libxrandr pango cairo"
      ;;
  esac
}

# Ce que le développement ajoute : des polices, sans lesquelles Chromium
# dessine un texte sans largeur. Lancer Electron sans écran ne demande rien
# de plus : scripts/essai_demarrage.js emploie la plateforme Ozone headless.
gtt_paquets_developpement() {
  case "$1" in
    debian) echo "fonts-dejavu-core" ;;
    fedora) echo "dejavu-sans-fonts" ;;
    suse) echo "dejavu-fonts" ;;
    arch) echo "ttf-dejavu" ;;
  esac
}

# Bibliothèques qu'un exécutable réclame sans les trouver, sur une ligne ;
# rien quand toutes se résolvent, ou quand ldd manque. Un exécutable absent
# est nommé comme tel.
gtt_bibliotheques_manquantes() {
  if [ ! -f "$1" ]; then
    echo "$1 (absent)"
    return 0
  fi
  command -v ldd > /dev/null 2>&1 || return 0
  { ldd "$1" 2> /dev/null || true; } | awk '/not found/ { print $1 }' | sort -u | tr '\n' ' ' | sed 's/ $//'
}

# Vrai quand une session graphique est ouverte : Electron a où dessiner.
gtt_session_graphique() {
  case "$(gtt_famille)" in
    macos | windows) return 0 ;;
  esac
  [ -n "${DISPLAY:-}${WAYLAND_DISPLAY:-}" ]
}

# Vrai quand Chromium ne peut pas cloisonner ses processus par des espaces
# de noms d'utilisateur : Ubuntu depuis 24.04 les restreint par AppArmor, un
# noyau peut les couper. Electron se rabat alors sur son assistant
# chrome-sandbox, qui doit appartenir à root et porter le bit setuid.
gtt_espaces_utilisateur_restreints() {
  [ "$(cat /proc/sys/kernel/apparmor_restrict_unprivileged_userns 2> /dev/null)" = 1 ] && return 0
  [ "$(cat /proc/sys/kernel/unprivileged_userns_clone 2> /dev/null)" = 0 ] && return 0
  [ "$(cat /proc/sys/user/max_user_namespaces 2> /dev/null)" = 0 ] && return 0
  return 1
}

GTT_ASSISTANT_BAC_A_SABLE="node_modules/electron/dist/chrome-sandbox"

# Vrai quand le bac à sable d'Electron démarre : espaces de noms libres, ou
# assistant setuid root. npm ci réécrit l'assistant sans ce bit.
gtt_bac_a_sable_pret() {
  local assistant="$GTT_RACINE/$GTT_ASSISTANT_BAC_A_SABLE"
  [ -f "$assistant" ] || return 0
  gtt_espaces_utilisateur_restreints || return 0
  [ -u "$assistant" ] && [ "$(stat -c %u "$assistant")" = 0 ]
}

gtt_preparer_bac_a_sable() {
  local assistant="$GTT_RACINE/$GTT_ASSISTANT_BAC_A_SABLE"
  gtt_bac_a_sable_pret && return 0
  gtt_dire "Espaces de noms d'utilisateur restreints : chrome-sandbox devient setuid root."
  gtt_admin chown root:root "$assistant"
  gtt_admin chmod 4755 "$assistant"
}

# Propose ./install.sh, et le lance sur consentement ; sans lui, refuse.
gtt_proposer_installation() {
  gtt_dire "$1"
  if ! gtt_confirmer "Lancer ./install.sh (paquets du système par sudo, Node, dépendances npm) ?"; then
    gtt_refuser "installation non lancée. Lancer ./install.sh, puis recommencer."
  fi
  "$GTT_RACINE/install.sh"
}

# Rend prêt à exécuter : le Node du projet en tête du PATH, et des
# dépendances npm qui suivent package-lock.json. Sous NixOS, le Node vient
# de scripts/installation/shell.nix, dans lequel l'appelant s'exécute déjà.
# Des dépendances en retard se réinstallent sans question : node_modules ne
# porte que ce que le verrou décrit.
gtt_preparer() {
  if [ "$(gtt_famille)" = nixos ]; then
    command -v node > /dev/null 2>&1 \
      || gtt_refuser "node absent : lancer depuis scripts/installation/shell.nix."
  elif ! gtt_activer_node; then
    gtt_proposer_installation "Node $(gtt_node_majeure) n'est pas posé."
    gtt_activer_node || gtt_refuser "Node $(gtt_node_majeure) reste introuvable après l'installation."
  fi
  if ! gtt_dependances_a_jour; then
    gtt_dire "Les dépendances npm ne suivent pas package-lock.json : npm ci."
    (cd -- "$GTT_RACINE" && gtt_npm_ci)
  else
    (cd -- "$GTT_RACINE" && gtt_poser_electron)
  fi
}

# Pose le binaire d'Electron de la version de package-lock.json. Le paquet
# electron ne le télécharge plus à l'installation mais au premier
# chargement ; install-electron le fait d'avance, contre les sommes que le
# paquet embarque, et ne refait rien quand il est déjà là. Rien là où
# Electron n'est pas publié, ni sous Nix, où ELECTRON_OVERRIDE_DIST_PATH
# désigne celui de nixpkgs.
gtt_poser_electron() {
  gtt_electron_disponible || return 0
  [ -z "${ELECTRON_OVERRIDE_DIST_PATH:-}" ] || return 0
  npx --no-install install-electron
}

gtt_npm_ci() {
  npm ci --no-audit --no-fund
  gtt_poser_electron
}

# Ligne de commande de PowerShell pour un script de scripts/windows, depuis
# le bash de Git sous Windows.
gtt_powershell() {
  local script="$1"
  shift
  exec powershell.exe -NoProfile -ExecutionPolicy Bypass -File "$GTT_RACINE/scripts/windows/$script" "$@"
}

# Relance la commande dans scripts/installation/shell.nix, sous NixOS, quand
# elle n'y est pas déjà. shell.nix pose GTT_SHELL_NIX : IN_NIX_SHELL, que
# pose tout nix-shell, ne dit pas lequel.
gtt_dans_nix_shell() {
  [ "$(gtt_famille)" = nixos ] || return 0
  [ "${GTT_SHELL_NIX:-}" != 1 ] || return 0
  exec nix-shell "$GTT_RACINE/scripts/installation/shell.nix" --run "$(printf '%q ' "$@")"
}
