// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Chaque fichier source du projet s'ouvre sur l'en-tête de licence : la ligne
// du titulaire, puis l'identifiant SPDX de la licence double, après un
// éventuel shebang ou la déclaration <!doctype html>, et après la marque
// d'ordre d'octets que portent les scripts PowerShell. Les deux lignes sont
// des commentaires du langage du fichier ; le texte ne varie pas, et aucun
// fichier du dépôt ne garde l'ancienne ligne de licence. package.json et
// l'entrée racine de package-lock.json déclarent la même expression SPDX, et
// package.json le même titulaire, que reprennent les outils d'emballage.
// LICENSES/ porte le texte complet de chaque licence de l'expression, et lui
// seul, à l'octet près la copie que la page livre depuis public/licences/ ;
// LICENSE, à la racine, est la notice qui y renvoie.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { basename, extname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

const TITULAIRE = /^© \d{4} TechnoLibre \(http:\/\/www\.technolibre\.ca\)$/;
const EXPRESSION = 'AGPL-3.0-or-later OR LiLiQ-Rplus-1.1';
const LICENCE = `SPDX-License-Identifier: ${EXPRESSION}`;
const IDENTIFIANTS = EXPRESSION.split(' OR ');

// L'empreinte SHA-256 du texte de chaque licence, tel que le publie la liste
// SPDX : une copie tronquée ou retouchée, partout à la fois, ne passe pas.
const EMPREINTES = Object.freeze({
  'AGPL-3.0-or-later': '0d96a4ff68ad6d4b6f1f30f713b18d5184912ba8dd389f86aa7710db079abcb0',
  'LiLiQ-Rplus-1.1': 'a26dc35b0586cfd36cf8f854c731ea20552d916a1d9f43387aa6636ec371838f',
});

// Le nom de chaque licence que la notice LICENSE donne en clair.
const NOMS = Object.freeze({
  'AGPL-3.0-or-later': 'GNU Affero General Public License v3.0 ou ultérieure',
  'LiLiQ-Rplus-1.1': 'Licence Libre du Québec – Réciprocité forte v1.1',
});

// La ligne de licence d'avant l'identifiant SPDX. Le point échappé du motif
// fait que ce fichier ne la porte pas lui-même.
const ANCIENNE_LICENCE = /License AGPL-3\.0 or later/;

// Dossiers que le balayage de l'ancienne ligne saute, relatifs à la racine :
// le dépôt de git, les dépendances, les sorties de construction, de
// couverture, de Vite et de Vitest, les projets natifs engendrés, les
// relevés du banc et les captures en attente — ce que .gitignore écarte.
const HORS_DEPOT = new Set([
  '.git',
  'node_modules',
  'www',
  'dist',
  'dist-electron',
  'android',
  'ios',
  '.vite',
  '.vitest',
  'coverage',
  join('scripts', 'banc', 'sorties'),
  join('doc', 'captures', '.attente'),
]);

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
// épreuves, des scripts, de la coquille et des fichiers que Vite copie tels
// quels dans la page (public/). Les dépendances et les sorties de
// construction n'y entrent pas, ni les données d'épreuve, qui sont des
// données et non des sources. Le séparateur final borne l'exclusion au
// répertoire test/fixtures/ : un module test/fixtures.js reste une source.
const ARBRES = ['src', 'test', 'scripts', 'electron', 'public'];
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

// Tous les fichiers du dépôt, sources, données d'épreuve, documents et
// rapports compris, hors des dossiers HORS_DEPOT, chemins absolus triés. Le
// parcours descend dossier par dossier pour ne pas entrer dans ceux qu'il
// saute.
function fichiersDuDepot() {
  const chemins = [];
  const aParcourir = [RACINE];
  while (aParcourir.length > 0) {
    const dossier = aParcourir.pop();
    for (const e of readdirSync(dossier, { withFileTypes: true })) {
      const chemin = join(dossier, e.name);
      if (e.isDirectory() && !HORS_DEPOT.has(relative(RACINE, chemin))) aParcourir.push(chemin);
      else if (e.isFile()) chemins.push(chemin);
    }
  }
  return chemins.sort();
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

  test('le périmètre couvre les fichiers que la page charge tels quels, sous public/', () => {
    const relatifs = fichiersSources().map((chemin) => relative(RACINE, chemin).split(sep).join('/'));
    assert.ok(relatifs.includes('public/collecteur.js'), 'public/collecteur.js hors du périmètre');
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
      // L'identifiant ne souffre aucune variante : une seule des deux
      // licences, l'opérateur en minuscules, l'identifiant sans son préfixe.
      ['.js', `// ${titulaire}\n// SPDX-License-Identifier: ${IDENTIFIANTS[0]}\n`, false],
      ['.js', `// ${titulaire}\n// SPDX-License-Identifier: ${IDENTIFIANTS.join(' or ')}\n`, false],
      ['.js', `// ${titulaire}\n// ${EXPRESSION}\n`, false],
    ];
    const ecarts = cas
      .filter(([extension, contenu, admis]) => porteLEnTete(contenu, extension) !== admis)
      .map(([extension, contenu, admis]) =>
        `${extension} ${admis ? 'refusé' : 'admis'} : ${JSON.stringify(contenu)}`,
      );
    assert.deepEqual(ecarts, []);
  });

  test("aucun fichier du dépôt ne garde l'ancienne ligne de licence, données d'épreuve comprises", () => {
    const fichiers = fichiersDuDepot();
    assert.ok(
      fichiers.includes(join(RACINE, 'test', 'licence.test.js')),
      'le balayage ne voit pas test/licence.test.js',
    );
    const anciens = fichiers
      .filter((chemin) => ANCIENNE_LICENCE.test(readFileSync(chemin, 'latin1')))
      .map((chemin) => relative(RACINE, chemin).split(sep).join('/'));
    assert.deepEqual(anciens, []);
  });

  test("package.json déclare l'expression SPDX et le titulaire ; l'entrée racine du verrou, la même expression", () => {
    const paquet = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
    assert.equal(paquet.license, EXPRESSION);
    assert.equal(paquet.author, 'TechnoLibre (http://www.technolibre.ca)');
    const verrou = JSON.parse(readFileSync(join(RACINE, 'package-lock.json'), 'utf8'));
    assert.equal(verrou.packages[''].license, EXPRESSION);
  });

  test("LICENSES/ porte le texte publié de chaque licence de l'expression, et rien d'autre, identique à la copie de public/licences/", () => {
    const attendus = IDENTIFIANTS.map((identifiant) => `${identifiant}.txt`);
    assert.deepEqual(readdirSync(join(RACINE, 'LICENSES')).sort(), [...attendus].sort());
    for (const identifiant of IDENTIFIANTS) {
      const fichier = `${identifiant}.txt`;
      const texte = readFileSync(join(RACINE, 'LICENSES', fichier));
      assert.equal(createHash('sha256').update(texte).digest('hex'), EMPREINTES[identifiant], `LICENSES/${fichier}`);
      assert.ok(texte.equals(readFileSync(join(RACINE, 'public', 'licences', fichier))), `LICENSES/${fichier}`);
    }
  });

  test("LICENSE, à la racine, est la notice qui nomme l'expression SPDX et renvoie au texte de chaque licence sous LICENSES/", () => {
    const notice = readFileSync(join(RACINE, 'LICENSE'), 'utf8');
    const lignes = notice.split('\n');
    assert.ok(lignes.includes(LICENCE), `ligne « ${LICENCE} » absente`);
    for (const identifiant of IDENTIFIANTS) {
      assert.ok(notice.includes(`LICENSES/${identifiant}.txt`), `LICENSES/${identifiant}.txt non nommé`);
      assert.ok(notice.includes(NOMS[identifiant]), `${identifiant} non nommée en clair`);
    }
    // La permission additionnelle à la LiLiQ-R+ : le titulaire y autorise la
    // combinaison avec des composants sous licence libre permissive, dont
    // l'Apache-2.0 avec l'exception LLVM que le module de HiGHS incorpore.
    assert.ok(lignes.includes('Permission additionnelle à la LiLiQ-R+'), 'titre de la permission absent');
    for (const attendu of ['TechnoLibre Inc., titulaire', 'licence libre permissive', 'Apache-2.0 avec ou sans l\'exception LLVM']) {
      assert.ok(notice.replace(/\s+/g, ' ').includes(attendu), `permission : « ${attendu} » absent`);
    }
    // Une notice, et non le texte d'une des licences : la recopier ici la
    // donnerait seule pour licence du dépôt.
    for (const identifiant of IDENTIFIANTS) {
      const texte = readFileSync(join(RACINE, 'LICENSES', `${identifiant}.txt`), 'utf8');
      assert.ok(notice.length < texte.length / 4, `LICENSE recopie ${identifiant}`);
    }
  });
});
