// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Analyseur des chargements qu'un texte demande, seul lu par les gardes de
// l'arborescence (test/arborescence.test.js) et du livrable
// (test/livrable.test.js) : import et export statiques, import seul, import()
// et require().
//
// Le relevé lit le texte entier, commentaires et chaînes compris. Une
// instruction à « from » se lit à partir de ce mot, que seuls import et
// export font suivre d'une chaîne : un motif parti du mot-clé s'arrêterait à
// l'apostrophe d'un commentaire placé entre les accolades. L'import d'un
// module seul exige un blanc après le mot-clé, et aucune arobase devant lui :
// une chaîne qui finit sur « import », comme l'argument « --import » d'une
// commande, n'en est pas un, ni la règle @import d'une feuille de style, dont
// la chaîne est une adresse relative à la feuille et non un paquet. import()
// et require() désignent un spécificateur quand leur argument est une chaîne
// littérale, entre guillemets, apostrophes ou accents graves sans
// interpolation, suivie ou non d'options ; tout autre argument est calculé.
const DEPUIS = /\bfrom\s*(['"])(?<specificateur>[^'"\n]+)\1/g;
const IMPORT_SEUL = /(?<!@)\bimport\s+(['"])(?<specificateur>[^'"\n]+)\1/g;
const APPEL =
  /\b(?:import|require)\s*\(\s*(?:(['"`])(?<specificateur>[^'"`$\n]+)\1\s*[,)]|(?<argument>[^)]*)\))/g;

// Chargements que demande un texte, dans l'ordre du texte. Chacun est
// { indice, specificateur } pour une chaîne littérale, { indice, argument }
// pour un argument calculé, son texte jusqu'à la première parenthèse
// fermante, blancs de bord retirés. indice est la position du mot « from »,
// de « import » ou de « require » dans le texte.
export function chargements(texte) {
  return [DEPUIS, IMPORT_SEUL, APPEL]
    .flatMap((motif) =>
      [...texte.matchAll(motif)].map(({ groups, index }) =>
        groups.specificateur === undefined
          ? { indice: index, argument: groups.argument.trim() }
          : { indice: index, specificateur: groups.specificateur },
      ),
    )
    .sort((a, b) => a.indice - b.indice);
}
