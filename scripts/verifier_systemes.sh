#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Installe et éprouve le projet sur chaque système du catalogue de machines
# virtuelles de TODO (ERPLibre), chacun dans un conteneur podman : sous un
# compte ordinaire qui passe par sudo, ./install_dev.sh, puis make test,
# make test_long, make test_navigateur, l'essai de démarrage d'Electron, et
# le serveur de Vite. Les scripts PowerShell s'éprouvent sous pwsh.
#
#   scripts/verifier_systemes.sh                  tout le catalogue
#   scripts/verifier_systemes.sh debian-13 arch   ces systèmes
#   scripts/verifier_systemes.sh --liste          les systèmes connus
#
# Ce qu'un conteneur n'éprouve pas : le bac à sable d'Electron (pas d'espaces
# de noms d'utilisateur, Electron s'y lance sans), une autre architecture
# que celle de l'hôte, NixOS lui-même (l'image nix éprouve shell.nix, sur
# une base qui n'est pas NixOS), une vraie session graphique.
#
# Les étapes tournent sous LANG=C.UTF-8, des paramètres régionaux UTF-8 que
# la plupart des images ne posent pas, et sous lesquels Chromium nomme une
# entrée hors ASCII de l'OPFS. La préparation installe ps (procps) là où
# l'image ne le porte pas : une épreuve de la coquille lit par lui l'heure de
# démarrage d'un processus.
#
# GTT_PARALLELES (4 par défaut) borne les conteneurs simultanés ; les
# journaux vont dans GTT_JOURNAUX, un dossier temporaire par défaut. Les
# téléchargements — npm, Electron, Chromium, Node — se partagent entre
# conteneurs par des volumes nommés gttl-cache-*.
set -euo pipefail

racine="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

# Système, image : le catalogue de script/qemu/deploy_qemu.py d'ERPLibre.
# Proxmox VE 9 est Debian 13 sous ses paquets : debian-13 le représente.
CATALOGUE='
ubuntu-24.04 docker.io/library/ubuntu:24.04
ubuntu-25.10 docker.io/library/ubuntu:25.10
ubuntu-26.04 docker.io/library/ubuntu:26.04
debian-12 docker.io/library/debian:12
debian-13 docker.io/library/debian:13
fedora-41 docker.io/library/fedora:41
fedora-42 docker.io/library/fedora:42
fedora-43 docker.io/library/fedora:43
fedora-44 docker.io/library/fedora:44
almalinux-9 docker.io/library/almalinux:9
almalinux-10 docker.io/library/almalinux:10
rocky-9 docker.io/rockylinux/rockylinux:9
rocky-10 docker.io/rockylinux/rockylinux:10
opensuse-leap-16.0 registry.opensuse.org/opensuse/leap:16.0
opensuse-tumbleweed registry.opensuse.org/opensuse/tumbleweed:latest
arch docker.io/library/archlinux:latest
nix docker.io/nixos/nix:latest
pwsh mcr.microsoft.com/powershell:latest
'

usage() {
  sed -n '9,12p' "$0" | sed 's/^# \{0,1\}//'
}

image_de() {
  printf '%s\n' "$CATALOGUE" | awk -v s="$1" '$1 == s { print $2 }'
}

systemes=()
for argument in "$@"; do
  case "$argument" in
    --liste)
      printf '%s\n' "$CATALOGUE" | awk 'NF { print $1 }'
      exit 0
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    -*)
      usage >&2
      exit 2
      ;;
    *)
      [ -n "$(image_de "$argument")" ] || { echo "système inconnu : $argument (--liste)" >&2; exit 2; }
      systemes+=("$argument")
      ;;
  esac
done
if [ ${#systemes[@]} -eq 0 ]; then
  while read -r s _; do
    [ -n "$s" ] && systemes+=("$s")
  done <<< "$CATALOGUE"
fi
command -v podman > /dev/null || { echo "podman introuvable." >&2; exit 1; }

journaux="${GTT_JOURNAUX:-$(mktemp -d "${TMPDIR:-/tmp}/verifier_systemes.XXXXXX")}"
mkdir -p "$journaux"

# Étiquette des conteneurs de cette vérification : une interruption arrête
# ceux-là, et aucun autre conteneur de la machine.
ETIQUETTE="gttl-verification=$$"
arreter() {
  podman ps -q --filter "label=$ETIQUETTE" | xargs -r podman stop -t 2 > /dev/null 2>&1 || true
}
trap 'arreter; exit 130' INT
trap 'arreter; exit 143' TERM

# Copie de l'arbre de travail tel qu'il est — fichiers suivis et nouveaux
# non ignorés —, sans node_modules : chaque conteneur part de zéro.
source_copie="$journaux/source"
rm -rf "$source_copie"
mkdir -p "$source_copie"
(cd "$racine" && git ls-files -co --exclude-standard -z | tar --null -cf - -T - | tar -xf - -C "$source_copie")

# Préparation sous root, par famille : sudo, ps quand l'image ne le porte
# pas — procps-ng chez Fedora, AlmaLinux, Rocky et Arch, procps ailleurs —,
# et un compte ordinaire « dev » qui emploie sudo sans mot de passe, comme un
# poste de développement. Son uid est le même dans chaque conteneur — 1500,
# libre aussi sous Ubuntu, dont l'image donne 1000 à son propre compte — :
# les caches partagés ne changent jamais de propriétaire.
preparation() {
  case "$1" in
    ubuntu-* | debian-*) echo 'apt-get update -q && DEBIAN_FRONTEND=noninteractive apt-get install -y -q sudo $(command -v ps > /dev/null || echo procps)' ;;
    fedora-* | almalinux-* | rocky-*) echo 'dnf install -y sudo shadow-utils $(command -v ps > /dev/null || echo procps-ng)' ;;
    opensuse-*) echo 'zypper --non-interactive install sudo shadow $(command -v ps > /dev/null || echo procps)' ;;
    arch) echo 'pacman -Syu --noconfirm sudo $(command -v ps > /dev/null || echo procps-ng)' ;;
  esac
}

# Étapes sous le compte dev, chacune annoncée par une ligne « === étape
# statut » que le bilan relit. L'essai et le serveur de Vite ne se jouent
# que sur une installation réussie. Elles tournent sous LANG=C.UTF-8, des
# paramètres régionaux UTF-8 comme ceux d'un poste de développement, que la
# plupart des images ne posent pas : sous le « C » qu'elles laissent,
# Chromium ne convertit plus un nom hors ASCII de l'OPFS, et les épreuves
# du navigateur n'éprouvent plus le projet. C.UTF-8 vient avec la glibc,
# sans paquet de langue ; une image qui ne le porterait pas retomberait sur
# « C », comme sans la variable.
ETAPES_DEV='
export LANG=C.UTF-8
etape() { local nom="$1"; shift; if "$@"; then echo "=== $nom ok"; else echo "=== $nom ÉCHEC"; return 1; fi; }
cd "$HOME/projet"
etape install_dev ./install_dev.sh || exit 1
etape test make test
etape test_long make test_long
etape test_navigateur make test_navigateur
etape essai_demarrage env GTT_SANS_BAC_A_SABLE=1 make essai_demarrage
web() {
  ./run.sh --web > "$HOME/web.log" 2>&1 &
  scripts/installation/avec_node.sh node -e "
    const fin = Date.now() + 60000;
    (async () => {
      while (Date.now() < fin) {
        try {
          const page = await (await fetch(\"http://localhost:5173/\")).text();
          if (page.includes(\"/src/main.js\")) process.exit(0);
        } catch {}
        await new Promise((r) => setTimeout(r, 500));
      }
      process.exit(1);
    })();"
}
etape web web
'

verifier_linux() {
  local systeme="$1" image="$2"
  podman run --rm --env-host=false --label "$ETIQUETTE" \
    -v "$source_copie:/source:ro" \
    -v gttl-cache-npm:/home/dev/.npm \
    -v gttl-cache-outils:/home/dev/.cache \
    "$image" bash -c "
      set -e
      $(preparation "$systeme")
      useradd -m -u 1500 -s /bin/bash dev 2> /dev/null || true
      echo 'dev ALL=(ALL) NOPASSWD: ALL' > /etc/sudoers.d/dev
      cp -a /source /home/dev/projet
      chown -R dev: /home/dev/projet
      chown dev: /home/dev /home/dev/.npm /home/dev/.cache
      sudo -u dev -H bash -c '$ETAPES_DEV'
    "
}

# L'image nix tourne sous root, sans sudo ni useradd : elle éprouve
# shell.nix, que GTT_FAMILLE désigne, sur une base qui n'est pas NixOS.
# ./install.sh y entre de lui-même ; make n'existe que dans shell.nix, où
# les étapes suivantes s'exécutent, comme sous NixOS.
verifier_nix() {
  podman run --rm --env-host=false --label "$ETIQUETTE" -e GTT_FAMILLE=nixos \
    -v "$source_copie:/source:ro" \
    "$2" sh -c "
      cp -a /source /root/projet
      export HOME=/root
      cd /root/projet
      if nix-shell -p bash --run ./install.sh; then echo '=== entree_shell_nix ok'; else echo '=== entree_shell_nix ÉCHEC'; exit 1; fi
      nix-shell scripts/installation/shell.nix --run 'bash -c '\''$ETAPES_DEV'\'''
    "
}

# Les scripts PowerShell sous pwsh : l'analyse syntaxique de chacun, puis la
# lecture de .node-version, le choix de l'archive dans SHASUMS256.txt, et le
# téléchargement, la vérification et l'extraction de Node pour win-x64 —
# node.exe ne s'exécute pas ici, son extraction se constate.
verifier_pwsh() {
  podman run --rm --env-host=false --label "$ETIQUETTE" -v "$source_copie:/source:ro" "$2" pwsh -NoProfile -Command '
    $ErrorActionPreference = "Stop"
    $erreurs = 0
    foreach ($f in Get-ChildItem /source/scripts/windows/*.ps1) {
      $jetons = $null; $fautes = $null
      [void][System.Management.Automation.Language.Parser]::ParseFile($f.FullName, [ref]$jetons, [ref]$fautes)
      if ($fautes.Count -gt 0) { $erreurs++; Write-Host "$($f.Name) : $($fautes[0].Message)" }
    }
    if ($erreurs -eq 0) { Write-Host "=== analyse ok" } else { Write-Host "=== analyse ÉCHEC"; exit 1 }
    Copy-Item -Recurse /source /tmp/projet
    $env:LOCALAPPDATA = "/tmp/donnees"
    $env:PROCESSOR_ARCHITECTURE = "AMD64"
    try { . /tmp/projet/scripts/windows/commun.ps1 } catch { Write-Host "=== chargement ÉCHEC $_"; exit 1 }
    Write-Host "=== chargement ok"
    $choix = Find-GttArchiveNode @("a1  node-v26.10.0-win-x64.7z", "b2  node-v26.10.0-win-x64.zip", "c3  node-v26.10.0-win-arm64.zip") "x64"
    if ("$choix" -eq "b2 node-v26.10.0-win-x64.zip" -and (Get-GttMajeure) -match "^[0-9]+$") { Write-Host "=== choix ok" } else { Write-Host "=== choix ÉCHEC $choix"; exit 1 }
    try { Install-GttNode } catch { }
    if (Test-Path (Join-Path (Get-GttDossierNode) "node.exe")) { Write-Host "=== node_windows ok" } else { Write-Host "=== node_windows ÉCHEC"; exit 1 }
  '
}

verifier() {
  local systeme="$1" image journal
  image="$(image_de "$systeme")"
  journal="$journaux/$systeme.log"
  {
    echo "### $systeme ($image)"
    case "$systeme" in
      nix) verifier_nix "$systeme" "$image" ;;
      pwsh) verifier_pwsh "$systeme" "$image" ;;
      *) verifier_linux "$systeme" "$image" ;;
    esac
  } > "$journal" 2>&1 || true
  echo "$systeme : $(grep -c '^=== .* ok$' "$journal") ok, $(grep -c '^=== .* ÉCHEC' "$journal") échec(s)"
}

paralleles="${GTT_PARALLELES:-4}"
echo "Journaux : $journaux"
for systeme in "${systemes[@]}"; do
  while [ "$(jobs -rp | wc -l)" -ge "$paralleles" ]; do
    sleep 2
  done
  verifier "$systeme" &
done
wait

echo
echo "Bilan :"
statut=0
for systeme in "${systemes[@]}"; do
  ligne="$(grep '^=== ' "$journaux/$systeme.log" | sed 's/^=== //' | tr '\n' ' ')"
  case "$ligne" in
    '' | *ÉCHEC*) statut=1 ;;
  esac
  printf '  %-22s %s\n' "$systeme" "${ligne:-aucune étape (voir $journaux/$systeme.log)}"
done
exit "$statut"
