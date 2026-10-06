// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Chaque fichier source du projet s'ouvre sur l'en-tête de licence : la ligne
// du titulaire, puis celle de la licence, après un éventuel shebang ou la
// déclaration <!doctype html>, et après la marque d'ordre d'octets que
// portent les scripts PowerShell. Les deux lignes sont des commentaires du
// langage du fichier ; le texte ne varie pas. package.json déclare la même
// licence et le même titulaire, que reprennent les outils d'emballage.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

const TITULAIRE = /^© \d{4} TechnoLibre \(http:\/\/www\.technolibre\.ca\)$/;
const LICENCE = 'License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)';

// Marqueurs de commentaire, par extension de fichier source, ou par nom pour
// un fichier sans extension. Un commentaire de ligne n'a pas de fermant. Un
// ouvrant est une chaîne qui ouvre la ligne, ou un motif : REM ouvre une
// ligne de commandes Windows, précédé ou non de @, quelle que soit sa casse,
// et suivi d'un blanc — @REMARQUE est une commande.
const COMMENTAIRE = new Map([
  ['.js', { ouvrant: '//', fermant: null }],
  ['.cjs', { ouvrant: '//', fermant: null }],
  ['.mjs', { ouvrant: '//', fermant: null }],
  ['.sh', { ouvrant: '#', fermant: null }],
  ['.svelte', { ouvrant: '<!--', fermant: '-->' }],
  ['.html', { ouvrant: '<!--', fermant: '-->' }],
  ['.css', { ouvrant: '/*', fermant: '*/' }],
  ['.ps1', { ouvrant: '#', fermant: null }],
  ['.nix', { ouvrant: '#', fermant: null }],
  ['.cmd', { ouvrant: /^@?rem(?=\s)/i, fermant: null }],
  ['Makefile', { ouvrant: '#', fermant: null }],
]);

// Clé d'un fichier dans COMMENTAIRE : son nom quand il y figure, son
// extension sinon.
const cle = (chemin) => (COMMENTAIRE.has(basename(chemin)) ? basename(chemin) : extname(chemin));

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
    .filter((chemin) => COMMENTAIRE.has(cle(chemin)))
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
  const ouvre = (ligne) => (typeof ouvrant === 'string' ? ligne.startsWith(ouvrant) : ouvrant.test(ligne));
  if (!ouvre(premiere)) return false;
  if (fermant === null) return ouvre(suite);
  const courant = !premiere.includes(fermant) && suite.endsWith(fermant);
  const repete =
    premiere.trimEnd().endsWith(fermant) &&
    suite.startsWith(ouvrant) &&
    suite.endsWith(fermant);
  return courant || repete;
}

// Vrai quand le contenu s'ouvre sur l'en-tête, après une éventuelle marque
// d'ordre d'octets, un shebang ou la déclaration <!doctype html> : deux
// lignes de commentaire du langage de la clé, extension ou nom, dont le
// texte, débarrassé des marqueurs, est celui de l'en-tête. Les fins de ligne
// sont celles d'Unix ou de Windows.
function porteLEnTete(contenu, cleFichier) {
  let lignes = contenu.replace(/^\uFEFF/, '').split(/\r?\n/);
  if (lignes[0].startsWith('#!')) lignes = lignes.slice(1);
  if (/^<!doctype html>$/i.test(lignes[0])) lignes = lignes.slice(1);
  const [premiere = '', seconde = ''] = lignes;
  const texte = (ligne) =>
    ligne
      .replace(/^\s*(?:\/\/|#|<!--|\/\*|\*|@?rem(?=\s))?\s*/i, '')
      .replace(/\s*(?:-->|\*\/)?\s*$/, '');
  return (
    enCommentaire(premiere, seconde, COMMENTAIRE.get(cleFichier)) &&
    TITULAIRE.test(texte(premiere)) &&
    texte(seconde) === LICENCE
  );
}

describe('licence', () => {
  test("chaque fichier source s'ouvre sur l'en-tête de licence", () => {
    const fichiers = fichiersSources();
    assert.ok(fichiers.length > 0, 'aucun fichier source examiné');
    const sansEnTete = fichiers
      .filter((chemin) => !porteLEnTete(readFileSync(chemin, 'utf8'), cle(chemin)))
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
      ['.ps1', `\uFEFF# ${titulaire}\r\n# ${LICENCE}\r\n`, true],
      ['.ps1', `# ${titulaire}\n# ${LICENCE}\n`, true],
      ['.nix', `# ${titulaire}\n# ${LICENCE}\n`, true],
      ['.cmd', `@REM ${titulaire}\r\n@REM ${LICENCE}\r\n@echo off\r\n`, true],
      ['.cmd', `REM ${titulaire}\r\nrem ${LICENCE}\r\n`, true],
      ['Makefile', `# ${titulaire}\n# ${LICENCE}\n`, true],
      ['.ps1', `\uFEFF# ${titulaire}\r\nWrite-Host '${LICENCE}'\r\n`, false],
      ['.cmd', `@REM ${titulaire}\r\n@echo ${LICENCE}\r\n`, false],
      ['.cmd', `@REMARQUE ${titulaire}\r\n@REM ${LICENCE}\r\n`, false],
      ['Makefile', `# ${titulaire}\n\t${LICENCE}\n`, false],
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
