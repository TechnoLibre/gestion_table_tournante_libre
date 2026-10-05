// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Chaque fichier source du projet s'ouvre sur l'en-tête de licence : la ligne
// du titulaire, puis celle de la licence, après un éventuel shebang ou la
// déclaration <!doctype html>. Les deux lignes sont des commentaires du
// langage du fichier ; le texte ne varie pas. package.json déclare la même
// licence et le même titulaire, que reprennent les outils d'emballage.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

const TITULAIRE = /^© \d{4} TechnoLibre \(http:\/\/www\.technolibre\.ca\)$/;
const LICENCE = 'License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)';

// Marqueurs de commentaire, par extension de fichier source. Un commentaire
// de ligne n'a pas de fermant.
const COMMENTAIRE = new Map([
  ['.js', { ouvrant: '//', fermant: null }],
  ['.cjs', { ouvrant: '//', fermant: null }],
  ['.mjs', { ouvrant: '//', fermant: null }],
  ['.sh', { ouvrant: '#', fermant: null }],
  ['.svelte', { ouvrant: '<!--', fermant: '-->' }],
  ['.html', { ouvrant: '<!--', fermant: '-->' }],
  ['.css', { ouvrant: '/*', fermant: '*/' }],
]);

// Périmètre : les fichiers de la racine et les arbres des sources, des
// épreuves, des scripts et de la coquille. Les dépendances et les sorties de
// construction n'y entrent pas, ni les données d'épreuve, qui sont des
// données et non des sources. Le séparateur final borne l'exclusion au
// répertoire test/fixtures/ : un module test/fixtures.js reste une source.
const ARBRES = ['src', 'test', 'scripts', 'electron'];
const DONNEES_EPREUVE = join(RACINE, 'test', 'fixtures') + sep;

function fichiersSources() {
  const chemins = readdirSync(RACINE, { withFileTypes: true })
    .filter((e) => e.isFile())
    .map((e) => join(RACINE, e.name));
  for (const arbre of ARBRES) {
    const dossier = join(RACINE, arbre);
    let entrees;
    try {
      entrees = readdirSync(dossier, { withFileTypes: true, recursive: true });
    } catch (erreur) {
      if (erreur.code === 'ENOENT') continue;
      throw erreur;
    }
    for (const e of entrees) {
      if (e.isFile()) chemins.push(join(e.parentPath, e.name));
    }
  }
  return chemins
    .filter((chemin) => COMMENTAIRE.has(extname(chemin)))
    .filter((chemin) => !chemin.startsWith(DONNEES_EPREUVE))
    .sort();
}

// Vrai quand les deux lignes sont des commentaires, et que le commentaire ne
// se prolonge pas au-delà de la seconde. Un commentaire de ligne ouvre
// chacune d'elles. Un commentaire de bloc court sur les deux — ouvert sur la
// première sans s'y fermer, fermé en fin de seconde — ou s'ouvre et se ferme
// sur chacune. Une seconde ligne hors commentaire se lit comme du code : un
// texte affiché avant le bandeau dans un composant, une règle de style
// invalidée dans une feuille, une commande dans un script.
function enCommentaire(premiere, seconde, { ouvrant, fermant }) {
  const suite = seconde.trim();
  if (!premiere.startsWith(ouvrant)) return false;
  if (fermant === null) return suite.startsWith(ouvrant);
  const courant = !premiere.includes(fermant) && suite.endsWith(fermant);
  const repete =
    premiere.trimEnd().endsWith(fermant) &&
    suite.startsWith(ouvrant) &&
    suite.endsWith(fermant);
  return courant || repete;
}

// Vrai quand le contenu s'ouvre sur l'en-tête, après un éventuel shebang ou
// la déclaration <!doctype html> : deux lignes de commentaire du langage de
// l'extension, dont le texte, débarrassé des marqueurs, est celui de
// l'en-tête.
function porteLEnTete(contenu, extension) {
  let lignes = contenu.split('\n');
  if (lignes[0].startsWith('#!')) lignes = lignes.slice(1);
  if (/^<!doctype html>$/i.test(lignes[0])) lignes = lignes.slice(1);
  const [premiere = '', seconde = ''] = lignes;
  const texte = (ligne) =>
    ligne
      .replace(/^\s*(?:\/\/|#|<!--|\/\*|\*)?\s*/, '')
      .replace(/\s*(?:-->|\*\/)?\s*$/, '');
  return (
    enCommentaire(premiere, seconde, COMMENTAIRE.get(extension)) &&
    TITULAIRE.test(texte(premiere)) &&
    texte(seconde) === LICENCE
  );
}

describe('licence', () => {
  test("chaque fichier source s'ouvre sur l'en-tête de licence", () => {
    const fichiers = fichiersSources();
    assert.ok(fichiers.length > 0, 'aucun fichier source examiné');
    const sansEnTete = fichiers
      .filter((chemin) => !porteLEnTete(readFileSync(chemin, 'utf8'), extname(chemin)))
      .map((chemin) => relative(RACINE, chemin));
    assert.deepEqual(sansEnTete, []);
  });

  test("l'en-tête tient en deux lignes de commentaire du langage du fichier", () => {
    const titulaire = '© 2026 TechnoLibre (http://www.technolibre.ca)';
    // [extension, contenu, admis] : les formes admises ; puis des secondes
    // lignes laissées hors commentaire, que le langage lirait comme du code,
    // et un commentaire qui se prolonge au-delà de la seconde ligne.
    const cas = [
      ['.js', `// ${titulaire}\n// ${LICENCE}\n`, true],
      ['.sh', `#!/bin/sh\n# ${titulaire}\n# ${LICENCE}\n`, true],
      ['.svelte', `<!-- ${titulaire}\n     ${LICENCE} -->\n`, true],
      ['.svelte', `<!-- ${titulaire} -->\n<!-- ${LICENCE} -->\n`, true],
      ['.html', `<!doctype html>\n<!-- ${titulaire}\n     ${LICENCE} -->\n`, true],
      ['.css', `/* ${titulaire}\n   ${LICENCE} */\n`, true],
      ['.css', `/* ${titulaire} */\n/* ${LICENCE} */\n`, true],
      ['.js', `// ${titulaire}\n${LICENCE}\n`, false],
      ['.sh', `#!/bin/sh\n# ${titulaire}\n${LICENCE}\n`, false],
      ['.svelte', `<!-- ${titulaire} -->\n${LICENCE}\n`, false],
      ['.html', `<!doctype html>\n<!-- ${titulaire} -->\n${LICENCE}\n`, false],
      ['.html', `<!-- ${titulaire}\n     ${LICENCE}\n-->\n`, false],
      ['.css', `/* ${titulaire} */\n${LICENCE}\n`, false],
      ['.css', `/* ${titulaire} */\n * ${LICENCE} */\n`, false],
    ];
    const ecarts = cas
      .filter(([extension, contenu, admis]) => porteLEnTete(contenu, extension) !== admis)
      .map(([extension, contenu, admis]) =>
        `${extension} ${admis ? 'refusé' : 'admis'} : ${JSON.stringify(contenu)}`,
      );
    assert.deepEqual(ecarts, []);
  });

  test('package.json déclare la licence et le titulaire', () => {
    const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
    assert.equal(paquet.license, 'AGPL-3.0-or-later');
    assert.equal(paquet.author, 'TechnoLibre (http://www.technolibre.ca)');
  });
});
