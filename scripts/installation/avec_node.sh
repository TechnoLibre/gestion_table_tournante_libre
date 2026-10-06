#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Exécute une commande à la racine du projet, le Node du projet en tête du
# PATH, une fois l'installation vérifiée : c'est par lui que le Makefile
# lance npm, npx et node. Sous NixOS, la commande s'exécute dans
# scripts/installation/shell.nix.
#
#   scripts/installation/avec_node.sh npm test
set -euo pipefail
. "$(dirname -- "$0")/commun.sh"

if [ $# -eq 0 ]; then
  gtt_dire "usage : scripts/installation/avec_node.sh <commande> [argument…]"
  exit 2
fi
[ "$(gtt_famille)" = windows ] && gtt_powershell avec_node.ps1 "$@"
gtt_dans_nix_shell "$0" "$@"
cd -- "$GTT_RACINE"
gtt_preparer
exec "$@"
