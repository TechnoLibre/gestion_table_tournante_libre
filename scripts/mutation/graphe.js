// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le graphe des imports, pour l'audit par mutation (§ 14.13) : un mutant ne
// se joue que contre les épreuves dont les imports atteignent le module muté.
// Un chemin est relatif à la racine du projet, séparé par « / » sur tout
// système. Seuls comptent les chargements relatifs écrits en clair — import,
// export … from, import() d'une chaîne : un spécificateur nu ou natif mène
// hors du projet, et un chemin calculé ne désigne aucun module avant
// l'exécution. Une épreuve qui n'atteint un module que par un chemin calculé
// ne se joue donc pas contre ses mutants.
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { parseAst } from 'vite';

// « ./ » ou « ../ » en tête, ou « . » et « .. » seuls.
const RELATIF = /^\.{1,2}(?:\/|$)/;

// Une épreuve, quel que soit son niveau : .test.js, .long.test.js,
// .navigateur.test.js.
const estEpreuve = (fichier) => fichier.endsWith('.test.js');

// Les spécificateurs écrits en clair d'un nœud, s'il en charge un.
function specificateurDe(noeud) {
  switch (noeud.type) {
    case 'ImportDeclaration':
    case 'ExportAllDeclaration':
    case 'ExportNamedDeclaration':
    case 'ImportExpression': {
      const source = noeud.source;
      return source && source.type === 'Literal' && typeof source.value === 'string' ? source.value : null;
    }
    default:
      return null;
  }
}

// Visite chaque nœud de l'arbre, en profondeur.
function parcourir(noeud, visiter) {
  visiter(noeud);
  for (const valeur of Object.values(noeud)) {
    const enfants = Array.isArray(valeur) ? valeur : [valeur];
    for (const enfant of enfants) {
      if (enfant !== null && typeof enfant === 'object' && typeof enfant.type === 'string') parcourir(enfant, visiter);
    }
  }
}

/**
 * Les modules que le source charge par un chemin relatif, résolus depuis la
 * racine, sans le suffixe de requête (« ?raw »), triés et sans doublon.
 * Lève sur un source que parseAst refuse.
 * @param {string} source
 * @param {string} fichier  chemin du module, relatif à la racine
 * @returns {string[]}
 */
export function importsDe(source, fichier) {
  const dossier = posix.dirname(fichier);
  const vus = new Set();
  parcourir(parseAst(source), (noeud) => {
    const specificateur = specificateurDe(noeud);
    if (specificateur !== null && RELATIF.test(specificateur)) {
      vus.add(posix.normalize(posix.join(dossier, specificateur.replace(/\?.*$/su, ''))));
    }
  });
  return [...vus].sort();
}

/**
 * Le graphe des fichiers donnés : chacun, dans l'ordre trié, vers ses imports.
 * Un import hors de la liste reste une feuille.
 * @param {string[]} fichiers       chemins relatifs à la racine
 * @param {(fichier: string) => string} lire  le texte d'un fichier
 * @returns {Map<string, string[]>}
 */
export function construireGraphe(fichiers, lire) {
  return new Map([...fichiers].sort().map((fichier) => [fichier, importsDe(lire(fichier), fichier)]));
}

/**
 * Le graphe des modules .js des dossiers donnés, lus sous la racine.
 * @param {string} racine    chemin absolu de la racine du projet
 * @param {string[]} dossiers  relatifs à la racine
 * @returns {Map<string, string[]>}
 */
export function grapheDuProjet(racine, dossiers) {
  const fichiers = dossiers.flatMap((dossier) =>
    readdirSync(join(racine, dossier), { recursive: true, withFileTypes: true })
      .filter((entree) => entree.isFile() && entree.name.endsWith('.js'))
      .map((entree) => relative(racine, join(entree.parentPath, entree.name)).split(sep).join('/')),
  );
  return construireGraphe(fichiers, (fichier) => readFileSync(join(racine, fichier), 'utf8'));
}

/**
 * Les épreuves du graphe (*.test.js) dont les imports, de proche en proche,
 * atteignent le module muté ; triées. Un cycle se parcourt une fois.
 * @param {string} fichierMute  chemin relatif à la racine
 * @param {Map<string, string[]>} graphe
 * @returns {string[]}
 */
export function testsConcernes(fichierMute, graphe) {
  const atteint = (depart) => {
    const vus = new Set([depart]);
    const pile = [depart];
    while (pile.length > 0) {
      for (const suivant of graphe.get(pile.pop()) ?? []) {
        if (suivant === fichierMute) return true;
        if (!vus.has(suivant)) {
          vus.add(suivant);
          pile.push(suivant);
        }
      }
    }
    return false;
  };
  return [...graphe.keys()].filter((fichier) => estEpreuve(fichier) && atteint(fichier)).sort();
}
