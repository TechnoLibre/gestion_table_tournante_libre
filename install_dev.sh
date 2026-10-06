#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Installe l'environnement de développement : ce qu'installe ./install.sh,
# puis le Chromium de Playwright des épreuves du navigateur, des polices, et
# podman, sous lequel se construit l'exécutable Windows (§ 16) sur amd64.
#
#   ./install_dev.sh
set -euo pipefail
cd -- "$(dirname -- "$0")"
. scripts/installation/commun.sh

for argument in "$@"; do
  case "$argument" in
    -h | --help)
      sed -n '5,10p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      gtt_dire "usage : ./install_dev.sh"
      exit 2
      ;;
  esac
done

famille="$(gtt_famille)"
case "$famille" in
  windows) gtt_powershell installer.ps1 -Dev ;;
  # shell.nix déclare aussi Chromium et ses polices.
  nixos) exec ./install.sh ;;
esac

./install.sh
case "$famille" in
  debian | fedora | suse | arch)
    paquets="$(gtt_paquets_developpement "$famille")"
    if [ "$(gtt_arch_node)" = x64 ]; then
      paquets="$paquets podman"
    fi
    # shellcheck disable=SC2086
    gtt_installer_paquets "$famille" $paquets
    ;;
esac

gtt_activer_node
if gtt_chromium_disponible; then
  npx --no-install playwright install --only-shell chromium
  if [ "$(gtt_os_node)" = linux ]; then
    navigateurs="${PLAYWRIGHT_BROWSERS_PATH:-$HOME/.cache/ms-playwright}"
    coquille="$(find "$navigateurs" -maxdepth 3 -type f \
      \( -name headless_shell -o -name chrome-headless-shell \) 2> /dev/null | head -n 1)"
    [ -n "$coquille" ] || gtt_refuser "Chromium de Playwright introuvable sous $navigateurs."
    manquantes="$(gtt_bibliotheques_manquantes "$coquille")"
    [ -z "$manquantes" ] || gtt_refuser "Chromium de Playwright ne trouve pas :" "$manquantes"
  fi
else
  gtt_dire "Playwright ne publie pas Chromium pour $(gtt_os_node)-$(gtt_arch_node) :" \
    "les épreuves du navigateur ne s'y jouent pas."
fi
gtt_dire "Environnement de développement prêt : make help."
