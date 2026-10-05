#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

# Construit l'exécutable Windows portable (§ 16) dans dist-electron/, par
# electron-builder exécuté sous podman, puis imprime son chemin, sa taille et
# ce qu'en dit « file ».
#
#   scripts/construire_windows.sh                  refuse si l'exécutable existe
#   scripts/construire_windows.sh --reconstruire   l'efface, puis le reconstruit
#
# Sortie : 0, l'exécutable est construit ; 1, refus ou échec ; 2, option
# inconnue ; 130 ou 143, interrompu par INT ou TERM. La racine du projet est
# le parent du répertoire du script.
#
# Chaque étape arrête la suite quand elle échoue :
# 1. « node scripts/version.js controler » applique les huit points du
#    § 18.5 : une version sans section au changelog ne se construit pas.
# 2. Le nom du livrable est celui que deriver tire de version.json : ce script
#    ne le compose pas. electron-builder.config.cjs doit passer le même nom à
#    electron-builder ; s'il en passe un autre, tout s'arrête là.
# 3. Un exécutable de ce nom dans dist-electron/ arrête tout (§ 18.2), sauf
#    --reconstruire, qui l'efface d'abord. Passé cette étape, un fichier de ce
#    nom ne peut venir que de cette exécution.
# 4. La page est construite sur l'hôte, en mode livraison.
# 5. electron-builder emballe www/ et electron/ dans le conteneur.
# 6. Contrôle de fin de construction (§ 18.5) : le seul exécutable apparu au
#    premier niveau de dist-electron/ porte le nom de l'étape 2.
# De l'étape 5 à l'acceptation par l'étape 6, toute sortie retire le fichier
# de ce nom : une construction qui échoue, ou que le contrôle refuse, ne
# laisse aucun exécutable sous ce nom.
set -euo pipefail

# Image sans Wine, épinglée par empreinte. La cible portable n'appelle pas
# Wine ; une cible qui l'exige, un installateur, échoue dans cette image au
# lieu de produire le livrable que le § 16 exclut. L'empreinte fige l'image,
# qu'une étiquette ferait avancer à chaque publication.
readonly IMAGE='docker.io/electronuserland/builder@sha256:e41cd059a4fdc0831ccd2a55cb59cbc6b73dc5f44c625778f7fda38874a70df3'
readonly SORTIE='dist-electron'
readonly CONFIGURATION='electron-builder.config.cjs'

refuser() {
  printf 'Construction refusée : %s\n' "$1" >&2
  exit 1
}

# Noms des fichiers .exe au premier niveau de dist-electron/, un par ligne.
executables() {
  find "$SORTIE" -maxdepth 1 -type f -name '*.exe' -printf '%f\n'
}

# Retire le fichier du nom du livrable qu'aucun contrôle de fin n'a accepté.
# electron-builder l'écrit avant d'avoir fini : resté là après un échec ou un
# refus, il serait refusé à l'exécution suivante comme un exécutable déjà
# construit.
retirer_non_controle() {
  [[ -e "$cible" ]] || return 0
  rm -f -- "$cible"
  printf '%s retiré : il n’a pas passé le contrôle de fin de construction.\n' "$cible" >&2
}

reconstruire=0
for argument in "$@"; do
  case "$argument" in
    --reconstruire) reconstruire=1 ;;
    *)
      printf 'usage : scripts/construire_windows.sh [--reconstruire]\n' >&2
      exit 2
      ;;
  esac
done

racine="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd -- "$racine"

command -v podman >/dev/null || refuser 'podman introuvable : electron-builder s’exécute dans un conteneur.'

# 1. Contrôle de version.
node scripts/version.js controler \
  || refuser 'le contrôle de version du § 18.5 échoue (voir ci-dessus).'

# 2. Nom du livrable. Un seul lancement de node imprime deux lignes : le nom
# que deriver tire de version.json, puis celui que la configuration passe à
# electron-builder. L'étape 1 a déjà appliqué deriver à version.json : un
# échec vient de la configuration. Les deux noms doivent coïncider avant
# l'étape 3, la première qui efface : une configuration refusée n'efface
# rien, même sous --reconstruire, et « rm » ne reçoit que le nom calculé.
noms="$(node -e "
  const { deriver } = require('./scripts/version.js');
  console.log(deriver(require('./version.json').version).nomFichier);
  console.log(require('./$CONFIGURATION').artifactName);
")" || refuser "$CONFIGURATION ne se charge pas."
nom="${noms%%$'\n'*}"
nom_configuration="${noms#*$'\n'}"
[[ "$nom_configuration" == "$nom" ]] \
  || refuser "$CONFIGURATION nomme le livrable $nom_configuration ; version.json donne $nom (§ 18.2)."
cible="$SORTIE/$nom"

# 3. Refus d'écraser.
if [[ -e "$cible" ]]; then
  if (( ! reconstruire )); then
    refuser "$cible existe déjà. Un numéro ne désigne qu'un binaire (§ 18.2) : changer la version, ou relancer avec --reconstruire si cet exécutable n'a pas quitté cette machine."
  fi
  rm -f -- "$cible"
fi

# 4. La page.
npm run --silent build:livraison || refuser 'la construction de la page échoue.'
[[ -f www/index.html ]] || refuser 'www/index.html manque après la construction de la page.'

# 5. L'exécutable. Le projet est monté en lecture seule : seuls dist-electron/
# et les volumes nommés sont inscriptibles. Le volume monté sur
# /project/node_modules masque celui de l'hôte, que le « npm ci » du
# conteneur, sous un autre Node, écraserait. « --ignore-scripts » n'exécute
# aucun script d'installation : electron-builder télécharge lui-même
# l'Electron Windows qu'il emballe. /root/.cache garde ce téléchargement et
# les outils d'electron-builder, /root/.npm les archives npm, d'une
# construction à l'autre.
# La commande ne passe aucune variable, et --env-host=false refuse
# l'environnement de l'hôte quel que soit containers.conf, dont un
# env_host = true le transmettrait entier : BUILD_NUMBER et les numéros de
# construction des services d'intégration continue y remplaceraient le
# quatrième champ de la version Windows. podman relaie encore les variables
# de mandataire de l'hôte (http_proxy, https_proxy, ftp_proxy, no_proxy, en
# minuscules comme en majuscules) : derrière un mandataire, npm et
# electron-builder en ont besoin pour télécharger, et elles ne touchent pas
# à la version.
mkdir -p -- "$SORTIE"
declare -A avant=()
while IFS= read -r fichier; do
  avant["$fichier"]=1
done < <(executables)

# Le retrait s'arme avant podman. INT et TERM mènent à exit, donc au retrait,
# une fois podman terminé : le shell n'exécute un piège qu'après la commande
# en cours, et podman ne peut plus rien écrire après le retrait. Sans ces deux
# pièges, TERM arrête le shell sur-le-champ, podman continue d'écrire après le
# retrait, et INT reçu par le shell seul n'interrompt rien.
trap retirer_non_controle EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

printf 'Construction de %s sous podman.\n' "$nom"
podman run --rm --env-host=false \
  -v "$racine:/project:ro" \
  -v "$racine/$SORTIE:/project/$SORTIE" \
  -v gestion_table_tournante_libre-node_modules:/project/node_modules \
  -v gestion_table_tournante_libre-cache:/root/.cache \
  -v gestion_table_tournante_libre-npm:/root/.npm \
  -w /project \
  "$IMAGE" \
  bash -c "npm ci --ignore-scripts --no-audit --no-fund && npx --no-install electron-builder --win --publish never --config $CONFIGURATION" \
  || refuser "electron-builder échoue sous podman (code $?)."

# 6. Contrôle de fin de construction.
apparus=()
while IFS= read -r fichier; do
  [[ -n "${avant["$fichier"]-}" ]] || apparus+=("$fichier")
done < <(executables)
if (( ${#apparus[@]} == 0 )); then
  refuser "aucun exécutable n'est apparu dans $SORTIE/ ; attendu : $nom."
fi
if (( ${#apparus[@]} > 1 )) || [[ "${apparus[0]}" != "$nom" ]]; then
  refuser "exécutable apparu : ${apparus[*]} ; attendu : $nom, le seul nom que version.json donne (§ 18.5)."
fi
# Accepté : l'exécutable reste, même si l'impression qui suit est interrompue.
trap - EXIT INT TERM

printf 'Exécutable : %s\n' "$racine/$cible"
printf 'Taille     : %s octets\n' "$(wc -c < "$cible")"
printf 'Type       : %s\n' "$(file -b -- "$cible" 2>/dev/null || echo 'inconnu, « file » indisponible')"
