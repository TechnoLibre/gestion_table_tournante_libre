// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Analyseur des chargements qu'un texte demande, seul lu par les gardes de
// l'arborescence (test/arborescence.test.js) et du livrable
// (test/livrable.test.js) : import et export statiques, import seul, import()
// et require(). Un composant Svelte se lit par le texte de ses blocs de
// script et des import() de son gabarit, que rend scriptsDe.
import { parse } from 'svelte/compiler';

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

// Un bloc de script d'un composant Svelte : une balise <script …>, attributs
// compris — ainsi <script module> —, son contenu, puis </script>, ou la fin
// du texte quand le bloc ne se ferme pas. Un commentaire HTML <!-- … -->
// est reconnu pour être sauté : une balise qui y figure n'ouvre aucun bloc.
const BLOC_OU_COMMENTAIRE = /<!--[\s\S]*?(?:-->|$)|<script(?:\s[^>]*)?>(?<contenu>[\s\S]*?)(?:<\/script\s*>|$)/g;

// Étendues { debut, fin } du contenu des blocs de script d'un composant
// Svelte, balises exclues, dans l'ordre du texte : debut est l'indice du
// premier caractère du contenu, fin celui qui suit son dernier.
export function blocsScript(texte) {
  return [...texte.matchAll(BLOC_OU_COMMENTAIRE)]
    .filter(({ groups }) => groups.contenu !== undefined)
    .map(({ 0: lu, index, groups }) => {
      const debut = index + lu.indexOf('>') + 1;
      return { debut, fin: debut + groups.contenu.length };
    });
}

// Les import() du gabarit d'un composant Svelte, en étendues { debut, fin }
// dans l'ordre du texte : chaque nœud ImportExpression de l'arbre que rend
// l'analyseur de Svelte (svelte/compiler) hors des blocs de script et de la
// feuille de style — un bloc {#await import(…)}, un attribut, une
// expression à toute profondeur. Le texte d'un nœud n'est pas une
// expression : « import » dans une phrase n'en donne aucun. null quand
// l'analyseur refuse le composant.
function importsDuGabarit(texte) {
  let arbre;
  try {
    arbre = parse(texte, { modern: true });
  } catch {
    return null;
  }
  const etendues = [];
  const vus = new WeakSet();
  const parcourir = (noeud) => {
    if (noeud === null || typeof noeud !== 'object' || vus.has(noeud)) return;
    vus.add(noeud);
    if (noeud.type === 'ImportExpression') etendues.push({ debut: noeud.start, fin: noeud.end });
    for (const valeur of Object.values(noeud)) parcourir(valeur);
  };
  parcourir(arbre.fragment);
  return etendues.sort((a, b) => a.debut - b.debut);
}

// Le texte qu'un relevé de chargements lit dans un composant Svelte, à la
// longueur du composant : ses blocs de script et les import() de son
// gabarit gardés, tout autre caractère devenu une espace, fins de ligne
// gardées, si bien que les indices et les numéros de ligne restent ceux du
// composant. Le balisage, le style et les autres expressions du gabarit ne
// sont pas lus : le texte d'un nœud — « import » dans une phrase — ne charge
// aucun module. Un composant que l'analyseur de Svelte refuse se lit en
// entier, gabarit compris : le relevé y trouve plus, jamais moins, et la
// construction le refuse de toute façon.
export function scriptsDe(texte) {
  const gabarit = importsDuGabarit(texte);
  if (gabarit === null) return texte;
  const blanc = (morceau) => morceau.replace(/[^\n]/g, ' ');
  const gardes = [...blocsScript(texte), ...gabarit].sort((a, b) => a.debut - b.debut);
  let sortie = '';
  let fin = 0;
  for (const etendue of gardes) {
    sortie += blanc(texte.slice(fin, etendue.debut)) + texte.slice(etendue.debut, etendue.fin);
    fin = etendue.fin;
  }
  return sortie + blanc(texte.slice(fin));
}
