// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La police embarquée (§ 11.1, § 14.15, § 19.4) : les deux fichiers de
// src/polices sont ceux que PROVENANCE déclare, octet pour octet ; chacun
// couvre le latin étendu du français et ses ligatures, lu par fontkit ;
// regulier.js et gras.js nomment ces fichiers ; la licence voyage à côté, à
// son seul emplacement, public/licences/. La longueur de la chaîne témoin se
// calcule des avances de la police, sans crénage (contrainte 26). Le point
// d'entrée de la page et le montage des épreuves passent le chargement de la
// police à App, et attendent ses deux faces avant de la monter ;
// jetons.css déclare ces faces sur les mêmes fichiers que regulier.js et
// gras.js, et fait de Noto Sans la police de l'interface. Que la page les
// charge et les rende se lit dans le navigateur
// (src/interface/Police.navigateur.test.js).
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import fontkit from '@pdf-lib/fontkit';
import { describe, test } from './lanceur.js';
import { cheminPolice, FICHIERS_POLICES, lirePolices } from './polices.js';
import { CHAINE_TEMOIN, lireProvenance, longueurTemoin } from './temoin.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const lire = (chemin) => readFileSync(`${RACINE}${chemin}`);
const sha256 = (octets) => createHash('sha256').update(octets).digest('hex');
const provenance = () => lireProvenance(readFileSync(cheminPolice('PROVENANCE'), 'utf8'));

// Les blocs du latin que la police couvre en entier, bornes comprises, et
// les signes du français hors de ces blocs.
const BLOCS = [
  ['Latin-1', 0xa0, 0xff],
  ['Latin étendu A', 0x100, 0x17f],
  ['Latin étendu B', 0x180, 0x24f],
  ['Latin étendu additionnel', 0x1e00, 0x1eff],
];
const SIGNES = 'œŒæÆ’«»–—…ﬁ';

// Les points de code à couvrir, dans l'ordre des blocs puis des signes.
function pointsACouvrir() {
  const points = [];
  for (const [, debut, fin] of BLOCS) for (let point = debut; point <= fin; point += 1) points.push(point);
  for (const signe of SIGNES) points.push(signe.codePointAt(0));
  return points;
}

describe('polices : les fichiers (§ 11.1, § 14.15)', () => {
  test('PROVENANCE déclare la version amont et les deux fichiers, dont la taille et l’empreinte sont celles du disque', () => {
    const { version, fichiers } = provenance();
    assert.match(version ?? '', /^\d+\.\d+$/);
    const polices = lirePolices();
    const attendus = [
      [FICHIERS_POLICES.regulier, polices.regulier],
      [FICHIERS_POLICES.gras, polices.gras],
    ];
    for (const [nom, octets] of attendus) {
      const entree = fichiers.find((f) => f.nom === nom);
      assert.ok(entree !== undefined, `${nom} absent de PROVENANCE`);
      assert.equal(octets.length, entree.octets, nom);
      assert.equal(sha256(octets), entree.sha256, nom);
    }
  });

  test('chaque graisse est Noto Sans de la version déclarée, Regular puis Bold', () => {
    const { version } = provenance();
    const polices = lirePolices();
    for (const [graisse, sousFamille] of [['regulier', 'Regular'], ['gras', 'Bold']]) {
      const police = fontkit.create(polices[graisse]);
      assert.equal(police.familyName, 'Noto Sans', graisse);
      assert.equal(police.subfamilyName, sousFamille, graisse);
      assert.ok(police.version.startsWith(`Version ${version};`), `${graisse} : ${police.version}`);
    }
  });

  test('chaque graisse couvre Latin-1, les latins étendus A, B et additionnel, et « œŒæÆ’«»–—…ﬁ »', () => {
    const points = pointsACouvrir();
    assert.equal(points.length, 96 + 128 + 208 + 256 + 11);
    const polices = lirePolices();
    for (const graisse of ['regulier', 'gras']) {
      const police = fontkit.create(polices[graisse]);
      const manquants = points
        .filter((point) => police.glyphForCodePoint(point).id === 0)
        .map((point) => `U+${point.toString(16).toUpperCase().padStart(4, '0')}`);
      assert.deepEqual(manquants, [], graisse);
    }
  });

  test('regulier.js et gras.js réexportent chacun leur fichier, incrusté par « ?inline »', () => {
    for (const [module, nom] of [['regulier.js', FICHIERS_POLICES.regulier], ['gras.js', FICHIERS_POLICES.gras]]) {
      const texte = readFileSync(cheminPolice(module), 'utf8');
      // « fro[m] » : la garde des chargements (test/chargements.js) ne lit
      // pas ce motif comme un import.
      const reexports = [...texte.matchAll(/^export \{ default \} fro[m] '\.\/([^'?]+)\?inline';$/gm)].map((m) => m[1]);
      assert.deepEqual(reexports, [nom], module);
    }
  });

  test('la licence de la police est public/licences/NotoSans-OFL.txt, l’OFL.txt de l’archive amont, et TIERS.txt la nomme', () => {
    const { fichiers } = provenance();
    const ofl = fichiers.find((f) => f.nom === 'NotoSans-OFL.txt');
    assert.ok(ofl !== undefined, 'NotoSans-OFL.txt absent de PROVENANCE');
    assert.equal(ofl.amont, 'OFL.txt');
    const texte = lire('public/licences/NotoSans-OFL.txt');
    assert.equal(sha256(texte), ofl.sha256);
    assert.match(texte.toString('utf8'), /SIL OPEN FONT LICENSE Version 1\.1/);
    assert.match(lire('public/licences/TIERS.txt').toString('utf8'), /^Noto Sans .* — OFL-1\.1 — NotoSans-OFL\.txt$/m);
  });
});

describe('polices : la chaîne témoin (§ 19.4, contrainte 26)', () => {
  test('la chaîne témoin est celle du contrat', () => {
    assert.equal(CHAINE_TEMOIN, 'Ôjgq Æ W — Benoît Œuvre fi');
  });

  test('sa longueur est la somme des avances, sans crénage ni ligature : la mise en forme de fontkit sans « kern » ni « liga » la redonne', () => {
    const polices = lirePolices();
    for (const graisse of ['regulier', 'gras']) {
      const police = fontkit.create(polices[graisse]);
      const brute = police.layout(CHAINE_TEMOIN, { kern: false, liga: false }).advanceWidth;
      const avecCrenage = police.layout(CHAINE_TEMOIN, { liga: false }).advanceWidth;
      assert.ok(Math.abs(longueurTemoin(polices[graisse], police.unitsPerEm) - brute) < 1e-9, graisse);
      // Le crénage change la longueur : la somme ne le confond pas avec elle.
      assert.notEqual(brute, avecCrenage, graisse);
    }
  });

  test('la longueur croît avec le corps, en proportion ; le gras est plus long ; un corps hors domaine lève', () => {
    const { regulier, gras } = lirePolices();
    const a16 = longueurTemoin(regulier, 16);
    assert.ok(Math.abs(longueurTemoin(regulier, 32) - 2 * a16) < 1e-9);
    assert.ok(longueurTemoin(gras, 16) > a16);
    assert.ok(longueurTemoin(regulier, 16, 'W') > longueurTemoin(regulier, 16, 'i'));
    for (const corps of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '16']) {
      assert.throws(() => longueurTemoin(regulier, corps), RangeError, String(corps));
    }
  });
});

// Le texte d'un module du projet, lu par le disque : le point d'entrée de la
// page et le montage des épreuves ne se chargent pas sous node.
const texteDe = (chemin) => readFileSync(`${RACINE}${chemin}`, 'utf8');

// Le texte d'un module sans ses commentaires de ligne ni de bloc : un appel
// cité dans un commentaire ne compte pas.
const sansCommentaires = (texte) => texte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

describe('polices : le montage d’App (§ 13.4, § 19.4)', () => {
  const ENTREES = [
    { chemin: 'src/main.js', passe: /^\s*polices: chargerPolices,$/m },
    { chemin: 'test/navigateur/montage.js', passe: /^\s*polices,$/m },
  ];

  test('src/main.js et le montage des épreuves importent chargerPolices et attendrePolices de src/polices/chargement.js, et passent le chargement à App', () => {
    for (const { chemin, passe } of ENTREES) {
      const code = sansCommentaires(texteDe(chemin));
      const imports = [...code.matchAll(/^import \{([^}]*)\} fro[m] '[./]*(?:src\/)?polices\/chargement\.js';$/gm)];
      assert.equal(imports.length, 1, `${chemin} : un import de polices/chargement.js`);
      const noms = imports[0][1].split(',').map((nom) => nom.trim()).filter(Boolean).sort();
      assert.deepEqual(noms, ['attendrePolices', 'chargerPolices'], chemin);
      const [, proprietes] = /\bmount\(App, \{[\s\S]*?\bprops: \{([\s\S]*?)\n\s*\},\n/.exec(code) ?? [];
      assert.ok(proprietes !== undefined, `${chemin} : mount(App, { props: { … } })`);
      assert.match(proprietes, passe, `${chemin} : polices passé à App`);
    }
    // Le montage prend chargerPolices par défaut, comme src/main.js.
    assert.match(sansCommentaires(texteDe('test/navigateur/montage.js')), /^\s*polices = chargerPolices,$/m);
  });

  test('chacun attend attendrePolices(document) avant de monter App, une seule fois', () => {
    for (const { chemin } of ENTREES) {
      const code = sansCommentaires(texteDe(chemin));
      const attentes = [...code.matchAll(/\battendrePolices\(document\)/g)].map((m) => m.index);
      const montages = [...code.matchAll(/\bmount\(App\b/g)].map((m) => m.index);
      assert.equal(attentes.length, 1, `${chemin} : ${attentes.length} appels à attendrePolices(document)`);
      assert.equal(montages.length, 1, `${chemin} : ${montages.length} montages d’App`);
      assert.ok(attentes[0] < montages[0], `${chemin} : l’attente suit le montage`);
      assert.match(code.slice(attentes[0] - 'await '.length, attentes[0]), /^await $/, `${chemin} : attendrePolices non attendue`);
    }
  });
});

// Les règles @font-face d'une feuille, dans leur ordre : chacune rend ses
// descripteurs, nom en minuscules, valeur telle qu'écrite, commentaires ôtés.
function reglesFontFace(feuille) {
  const sansCommentaires = feuille.replace(/\/\*[\s\S]*?\*\//g, '');
  return [...sansCommentaires.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, corps]) =>
    Object.fromEntries(
      corps
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .map((declaration) => {
          const deuxPoints = declaration.indexOf(':');
          return [declaration.slice(0, deuxPoints).trim().toLowerCase(), declaration.slice(deuxPoints + 1).trim()];
        }),
    ),
  );
}

describe('polices : la police de l’interface (§ 19.4, Q4)', () => {
  const JETONS = 'src/interface/jetons.css';

  test('jetons.css déclare Noto Sans en deux faces, 400 puis 700, de style normal, chacune sur le fichier que regulier.js ou gras.js incruste', () => {
    const regles = reglesFontFace(lire(JETONS).toString('utf8'));
    assert.equal(regles.length, 2, `${regles.length} règles @font-face`);
    const attendues = [
      ['400', FICHIERS_POLICES.regulier],
      ['700', FICHIERS_POLICES.gras],
    ];
    for (const [rang, [graisse, nom]] of attendues.entries()) {
      const regle = regles[rang];
      assert.equal(regle['font-family'].replace(/^(["'])(.*)\1$/, '$2'), 'Noto Sans', graisse);
      assert.equal(regle['font-weight'], graisse);
      assert.equal(regle['font-style'], 'normal', graisse);
      const adresses = [...regle.src.matchAll(/url\(\s*(["']?)([^"')]+)\1\s*\)/g)].map((m) => m[2]);
      assert.equal(adresses.length, 1, `${graisse} : ${regle.src}`);
      assert.equal(join(dirname(`${RACINE}${JETONS}`), adresses[0]), cheminPolice(nom), graisse);
    }
  });

  test('--police-interface nomme Noto Sans en tête, puis les replis du système', () => {
    const declarations = [...lire(JETONS).toString('utf8').matchAll(/--police-interface:\s*([^;]+);/g)].map((m) => m[1].trim());
    assert.deepEqual(declarations, ["'Noto Sans', system-ui, sans-serif"]);
  });
});
