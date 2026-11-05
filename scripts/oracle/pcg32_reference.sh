#!/usr/bin/env bash
# © 2026 TechnoLibre (http://www.technolibre.ca)
# SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

# Imprime la sortie de la démo de l'implémentation de référence de PCG32, que
# rejoue src/demo/prng.test.js (§ 14.11 : un vecteur pris hors du code éprouvé).
#
#   scripts/oracle/pcg32_reference.sh
#
# Le script récupère pcg-c-basic en profondeur 1 dans un répertoire
# temporaire, au commit que cite src/demo/prng.test.js, et imprime le hachage
# du commit extrait. Il compile pcg32-demo.c avec pcg_basic.c (gcc -O2), puis
# exécute la démo sans argument : elle ensemence par
# pcg32_srandom_r(&rng, 42u, 54u) et imprime cinq tours de tirages. Le commit
# est demandé par son hachage, et non comme tête d'une branche : le dépôt peut
# avancer sans changer ce que le script compile. Le répertoire temporaire est
# retiré à la sortie. La récupération demande un accès réseau, et échoue
# plutôt que de demander un identifiant.
#
# Sortie : 0, la démo a tourné ; 1, outil absent, récupération, compilation ou
# exécution en échec ; 2, argument reçu.
set -euo pipefail

readonly DEPOT='https://github.com/imneme/pcg-c-basic'
readonly COMMIT='bc39cd76ac3d541e618606bcc6e1e5ba5e5e6aa3'

refuser() {
  printf 'Oracle PCG32 : %s\n' "$1" >&2
  exit 1
}

if (($# > 0)); then
  printf 'usage : scripts/oracle/pcg32_reference.sh\n' >&2
  exit 2
fi

for outil in git gcc; do
  command -v "$outil" >/dev/null || refuser "$outil introuvable."
done

temporaire="$(mktemp -d)"
trap 'rm -rf -- "$temporaire"' EXIT
source_c="$temporaire/pcg-c-basic"
demo="$temporaire/pcg32-demo"

# Un dépôt vide reçoit le seul commit COMMIT, sans historique, et l'extrait.
recuperer() {
  git init --quiet -- "$source_c" &&
    GIT_TERMINAL_PROMPT=0 git -C "$source_c" fetch --quiet --depth 1 -- "$DEPOT" "$COMMIT" &&
    git -C "$source_c" checkout --quiet FETCH_HEAD
}
recuperer || refuser "récupération de $DEPOT au commit $COMMIT impossible."
commit="$(git -C "$source_c" rev-parse HEAD)"

gcc -O2 -o "$demo" "$source_c/pcg32-demo.c" "$source_c/pcg_basic.c" \
  || refuser 'compilation de pcg32-demo.c et pcg_basic.c impossible.'

printf 'dépôt : %s\n' "$DEPOT"
printf 'commit : %s\n' "$commit"
printf 'compilation : gcc -O2 pcg32-demo.c pcg_basic.c\n'
printf 'exécution : pcg32-demo, sans argument\n\n'
"$demo" || refuser 'la démo a échoué.'
