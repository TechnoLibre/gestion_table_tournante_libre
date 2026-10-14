#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Construit l'exécutable Windows portable depuis Linux (§ 16) : la page en
# mode livraison sur l'hôte, puis electron-builder sous podman, par
# scripts/construire_windows.sh, le Node du projet en tête du PATH. Il sort
# dans dist-electron/, nommé d'après version.json ; make windows passe ici.
#
#   ./create_exe.sh                  refuse si l'exécutable de la version existe
#   ./create_exe.sh --reconstruire   l'efface, puis le reconstruit
set -euo pipefail
cd -- "$(dirname -- "$0")"
. scripts/installation/commun.sh

for argument in "$@"; do
  case "$argument" in
    --reconstruire) ;;
    -h | --help)
      sed -n '5,11p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      gtt_dire "usage : ./create_exe.sh [--reconstruire]"
      exit 2
      ;;
  esac
done

case "$(gtt_famille)" in
  windows | macos) gtt_refuser "l'exécutable Windows se construit sous Linux, en conteneur podman (§ 16)." ;;
esac
exec scripts/installation/avec_node.sh scripts/construire_windows.sh "$@"
