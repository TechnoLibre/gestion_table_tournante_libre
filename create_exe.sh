#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Construit l'exécutable Windows portable depuis Linux (§ 16) : la page en
# mode livraison sur l'hôte, puis electron-builder sous podman, par
# scripts/construire_windows.sh, le Node du projet en tête du PATH. Il sort
# dans dist-electron/, nommé d'après version.json ; make windows passe ici.
#
#   ./create_exe.sh                  demande avant d'écraser l'exécutable de la version
#   ./create_exe.sh --reconstruire   l'écrase sans demander
#
# Sans terminal, la question reçoit « non » : l'exécutable existant reste, sauf
# sous --reconstruire ou GTT_OUI=1.
set -euo pipefail
cd -- "$(dirname -- "$0")"
. scripts/installation/commun.sh

reconstruire=0
for argument in "$@"; do
  case "$argument" in
    --reconstruire) reconstruire=1 ;;
    -h | --help)
      sed -n '5,14p' "$0" | sed 's/^# \{0,1\}//'
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

# Un exécutable de cette version déjà construit : la question remplace le
# refus de scripts/construire_windows.sh, et « oui » lui passe --reconstruire.
# Le nom vient de deriver, appliqué à version.json, comme dans ce script.
if [ "$reconstruire" = 0 ]; then
  nom="$(scripts/installation/avec_node.sh node -e "
    const { deriver } = require('./scripts/version.js');
    console.log(deriver(require('./version.json').version).nomFichier);
  ")"
  if [ -e "dist-electron/$nom" ]; then
    gtt_confirmer "dist-electron/$nom existe déjà. L'écraser ?" \
      || gtt_refuser "dist-electron/$nom reste. Un numéro ne désigne qu'un binaire (§ 18.2) : changer la version pour un exécutable qui a déjà quitté cette machine."
    reconstruire=1
  fi
fi
options=()
[ "$reconstruire" = 1 ] && options+=(--reconstruire)
exec scripts/installation/avec_node.sh scripts/construire_windows.sh ${options[@]+"${options[@]}"}
