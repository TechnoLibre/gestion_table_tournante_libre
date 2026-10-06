#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Lance l'application depuis les sources. Sur une session graphique, la
# coquille Electron charge la page que Vite construit dans www/ (§ 13.1) ;
# sans écran, ou là où Electron n'est pas publié, le serveur de
# développement de Vite la sert à un navigateur.
#
#   ./run.sh              Electron si possible, sinon le serveur de Vite
#   ./run.sh --web        le serveur de Vite, http://localhost:5173
#   ./run.sh --electron   Electron, ou un refus qui dit pourquoi
set -euo pipefail
cd -- "$(dirname -- "$0")"
. scripts/installation/commun.sh

mode=auto
for argument in "$@"; do
  case "$argument" in
    --web) mode=web ;;
    --electron) mode=electron ;;
    -h | --help)
      sed -n '5,12p' "$0" | sed 's/^# \{0,1\}//'
      exit 0
      ;;
    *)
      gtt_dire "usage : ./run.sh [--web | --electron]"
      exit 2
      ;;
  esac
done

[ "$(gtt_famille)" = windows ] && gtt_powershell lancer.ps1 "$@"
gtt_dans_nix_shell ./run.sh "$@"
gtt_preparer

if [ "$mode" = auto ]; then
  if gtt_electron_disponible && gtt_session_graphique; then
    mode=electron
  else
    mode=web
  fi
fi

if [ "$mode" = web ]; then
  gtt_dire "Serveur de développement de Vite : http://localhost:5173 (Ctrl+C pour l'arrêter)."
  exec npm run --silent dev
fi

gtt_electron_disponible \
  || gtt_refuser "Electron n'est pas publié pour $(gtt_os_node)-$(gtt_arch_node) : ./run.sh --web."
gtt_session_graphique \
  || gtt_refuser "aucune session graphique (DISPLAY, WAYLAND_DISPLAY) : ./run.sh --web ; make essai_demarrage lance Electron sans écran."
options=()
if [ "$(gtt_os_node)" = linux ]; then
  if [ "$(id -u)" = 0 ]; then
    gtt_dire "Sous root, Chromium refuse son bac à sable : Electron se lance sans."
    options+=(--no-sandbox)
  elif ! gtt_bac_a_sable_pret; then
    gtt_dire "Le bac à sable d'Electron demande chrome-sandbox setuid root (espaces de noms restreints)."
    gtt_confirmer "Le poser par sudo ?" \
      || gtt_refuser "bac à sable non posé : ./install.sh le pose, puis relancer."
    gtt_preparer_bac_a_sable
  fi
fi
npm run --silent build
exec npx --no-install electron . ${options[@]+"${options[@]}"}
