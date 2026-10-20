#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Installe de quoi lancer l'application depuis les sources et jouer les
# épreuves sous node : les outils et les bibliothèques du système, Node de la
# majeure de .node-version, et les dépendances de package-lock.json.
# Relancé, il ne refait que ce qui manque.
#
#   ./install.sh
#
# Sous Windows (bash de Git), la main passe à install.cmd ; sous NixOS, à
# scripts/installation/shell.nix, qui déclare ce que les autres systèmes
# installent.
set -euo pipefail
cd -- "$(dirname -- "$0")"
. scripts/installation/commun.sh

for argument in "$@"; do
  case "$argument" in
    -h | --help)
      sed -n '5,9p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      gtt_dire "usage : ./install.sh"
      exit 2
      ;;
  esac
done

famille="$(gtt_famille)"
case "$famille" in
  windows) gtt_powershell installer.ps1 ;;
  nixos)
    gtt_dans_nix_shell ./install.sh
    gtt_npm_ci
    gtt_dire "Installation terminée. Lancer : ./run.sh, ou make."
    exit 0
    ;;
  macos)
    xcode-select -p > /dev/null 2>&1 \
      || gtt_dire "Outils de ligne de commande de Xcode absents, dont make : xcode-select --install"
    ;;
  debian | fedora | suse | arch)
    paquets="$(gtt_paquets_outils "$famille")"
    if gtt_electron_disponible; then
      paquets="$paquets $(gtt_paquets_electron "$famille")"
    fi
    # shellcheck disable=SC2086
    gtt_installer_paquets "$famille" $paquets
    ;;
  *)
    gtt_refuser "système non reconnu ($(uname -s), /etc/os-release). Systèmes pris en charge :" \
      "Debian, Ubuntu, Proxmox VE, Fedora, AlmaLinux, Rocky Linux, openSUSE, Arch, NixOS, macOS, Windows." \
      "Un dérivé se rattache à sa famille : GTT_FAMILLE=debian ./install.sh (debian, fedora, suse, arch)."
    ;;
esac

gtt_poser_node
gtt_activer_node
if ! gtt_electron_disponible; then
  gtt_dire "Electron n'est pas publié pour $(gtt_os_node)-$(gtt_arch_node) :" \
    "./run.sh servira l'application à un navigateur."
fi
gtt_npm_ci

if gtt_electron_disponible && [ "$(gtt_os_node)" = linux ]; then
  manquantes="$(gtt_bibliotheques_manquantes node_modules/electron/dist/electron)"
  [ -z "$manquantes" ] || gtt_refuser "Electron ne trouve pas :" "$manquantes"
  gtt_preparer_bac_a_sable
fi
gtt_dire "Installation terminée. Lancer : ./run.sh, ou make."
