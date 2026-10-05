// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la version datée (§ 18). Ce fichier cite des versions en clair
// par nécessité : le balayage du point 6 du § 18.5 l'exclut, et lui seul.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../test/lanceur.js';
import {
  controler,
  dateCivileLocale,
  dateEnLettres,
  deriver,
  engendrer,
  engendrerModule,
  redecomposer,
} from './version.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const SCRIPT = fileURLToPath(new URL('./version.js', import.meta.url));

const UN_JOUR_MS = 86_400_000;

// Les jours d'une année, énumérés par le calendrier de Date.UTC : l'oracle ne
// partage rien avec la règle des mois et des années bissextiles du module
// éprouvé.
function joursDe(annee) {
  const jours = [];
  for (
    let instant = Date.UTC(annee, 0, 1);
    new Date(instant).getUTCFullYear() === annee;
    instant += UN_JOUR_MS
  ) {
    const date = new Date(instant);
    jours.push({ annee, mois: date.getUTCMonth() + 1, jour: date.getUTCDate() });
  }
  return jours;
}

// Dernier jour du mois, lu dans le même calendrier : le jour 0 d'un mois est
// la veille de son premier jour.
function dernierJour(annee, mois) {
  return new Date(Date.UTC(annee, mois, 0)).getUTCDate();
}

const deux = (n) => String(n).padStart(2, '0');
const forme = ({ annee, mois, jour }, rang) =>
  `${annee}.${deux(mois)}.${deux(jour)}.${deux(rang)}`;
const champs = (technique) => technique.split('.').map(Number);

// Vrai quand a précède strictement b, comparés champ à champ comme des
// entiers.
function precede(a, b) {
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

describe('version : dérivation (§ 18.1, § 18.2)', () => {
  test('une version affichée donne ses formes technique et Windows et le nom du livrable', () => {
    assert.deepEqual(deriver('2026.10.05.01'), {
      affichee: '2026.10.05.01',
      technique: '2026.1005.1',
      windows: '2026.1005.1.0',
      nomFichier: 'gestion_table_tournante_libre_v2026_10_05_01.exe',
      annee: 2026,
      mois: 10,
      jour: 5,
      rang: 1,
    });
  });

  test('le mois garde son zéro de tête dans la forme affichée et le perd dans la technique', () => {
    assert.equal(deriver('2026.01.05.01').technique, '2026.105.1');
    assert.equal(redecomposer('2026.105.1'), '2026.01.05.01');
  });

  test('la forme technique croît avec la date, champ à champ', () => {
    const suite = ['2026.01.05.01', '2026.10.05.01', '2026.12.31.01', '2027.01.05.01'].map(
      (version) => champs(deriver(version).technique),
    );
    assert.deepEqual(suite, [
      [2026, 105, 1],
      [2026, 1005, 1],
      [2026, 1231, 1],
      [2027, 105, 1],
    ]);
    for (let i = 1; i < suite.length; i += 1) {
      assert.ok(precede(suite[i - 1], suite[i]), `${suite[i - 1]} < ${suite[i]}`);
    }
    assert.ok(
      precede(champs(deriver('2026.10.05.01').technique), champs(deriver('2026.10.05.02').technique)),
    );
  });

  test('aller-retour sur chaque jour de 2026 et de 2028, sur les 99 rangs', () => {
    const jours = [...joursDe(2026), ...joursDe(2028)];
    assert.equal(jours.length, 365 + 366);
    const affichees = [];
    const noms = [];
    let veille = null;
    jours.forEach((date, i) => {
      const rang = 1 + (i % 99);
      const version = forme(date, rang);
      const derivee = deriver(version);
      assert.equal(derivee.technique, `${date.annee}.${date.mois * 100 + date.jour}.${rang}`);
      assert.equal(derivee.windows, `${derivee.technique}.0`);
      assert.equal(
        derivee.nomFichier,
        `gestion_table_tournante_libre_v${version.replaceAll('.', '_')}.exe`,
      );
      assert.equal(redecomposer(derivee.technique), version);
      // Chaque champ de la ressource de version Windows tient sur 16 bits.
      for (const champ of champs(derivee.windows)) assert.ok(champ <= 0xffff, derivee.windows);
      const jour = champs(derivee.technique).slice(0, 2);
      if (veille !== null) assert.ok(precede(veille, jour), `${veille} < ${jour}`);
      veille = jour;
      affichees.push(forme(date, 1));
      noms.push(deriver(forme(date, 1)).nomFichier);
    });
    // L'ordre alphabétique des formes affichées et des noms de fichiers est
    // l'ordre chronologique.
    assert.deepEqual([...affichees].sort(), affichees);
    assert.deepEqual([...noms].sort(), noms);
  });

  test('le dernier jour de chaque mois passe, le lendemain est refusé', () => {
    let mois = 0;
    for (const annee of [2026, 2028]) {
      for (let m = 1; m <= 12; m += 1) {
        const dernier = dernierJour(annee, m);
        assert.doesNotThrow(() => deriver(forme({ annee, mois: m, jour: dernier }, 1)));
        assert.throws(() => deriver(forme({ annee, mois: m, jour: dernier + 1 }, 1)), /jour/);
        assert.throws(() => deriver(forme({ annee, mois: m, jour: 0 }, 1)), /jour/);
        mois += 1;
      }
    }
    assert.equal(mois, 24);
    assert.equal(dernierJour(2026, 2), 28);
    assert.equal(dernierJour(2028, 2), 29);
  });

  test('refuse une forme non conforme, une date invalide, un rang hors de 01 à 99', () => {
    const refus = [
      ['2026.1.5.1', /forme/],
      ['2026.13.01.01', /mois/],
      ['2026.00.10.01', /mois/],
      ['2026.02.30.01', /jour/],
      ['2026.10.05.00', /rang/],
      ['2026.10.05.100', /rang.*99/],
      ['2026.10.05.001', /forme/], // zéro de tête : une faute de forme, pas de plafond
      ['2026.13.45.100', /mois/], // la date se contrôle avant le plafond du rang
      ['2026.10.05.1', /forme/],
      ['2026.10.05', /forme/],
      ['2026.10.05.01 ', /forme/],
      ['v2026.10.05.01', /forme/],
      ['2026-10-05-01', /forme/],
      ['0999.10.05.01', /année/],
    ];
    for (const [version, motif] of refus) {
      assert.throws(() => deriver(version), motif, version);
    }
    assert.throws(() => deriver(20261005), TypeError);
  });

  test('accepte le rang 99', () => {
    assert.equal(deriver('2026.10.05.99').technique, '2026.1005.99');
    assert.equal(redecomposer('2026.1005.99'), '2026.10.05.99');
  });

  test('redecomposer refuse ce qui ne désigne pas exactement une version', () => {
    const refus = [
      ['2026.0105.1', /forme/], // zéro de tête
      ['2026.1005.01', /forme/], // zéro de tête
      ['2026.1005.0', /forme/], // rang 0
      ['2026.1005.100', /forme/], // rang au-delà de 99
      ['2026.99.1', /forme/], // mois et jour sur deux chiffres
      ['2026.1005', /forme/], // deux champs
      ['2026.10.05.01', /forme/], // forme affichée
      ['26.1005.1', /forme/], // année sur deux chiffres
      ['2026.1305.1', /mois/], // mois 13
      ['2026.230.1', /jour/], // 30 février
      ['2026.1000.1', /jour/], // jour 0
    ];
    for (const [technique, motif] of refus) {
      assert.throws(() => redecomposer(technique), motif, technique);
    }
    assert.throws(() => redecomposer(2026.1005), TypeError);
  });
});

describe('version : date en lettres (§ 18.4)', () => {
  test('écrit le jour, le mois en lettres et l’année ; le premier du mois est « 1er »', () => {
    assert.equal(dateEnLettres({ annee: 2026, mois: 10, jour: 5 }), '5 octobre 2026');
    assert.equal(dateEnLettres({ annee: 2027, mois: 1, jour: 1 }), '1er janvier 2027');
    assert.equal(dateEnLettres({ annee: 2028, mois: 2, jour: 29 }), '29 février 2028');
  });

  test('nomme les douze mois', () => {
    assert.deepEqual(
      MOIS.map((_, i) => dateEnLettres({ annee: 2026, mois: i + 1, jour: 2 })),
      MOIS.map((nom) => `2 ${nom} 2026`),
    );
  });

  test('refuse une date hors du calendrier', () => {
    assert.throws(() => dateEnLettres({ annee: 2026, mois: 2, jour: 29 }), /jour/);
    assert.throws(() => dateEnLettres({ annee: 2026, mois: 13, jour: 1 }), /mois/);
  });
});

// --- Arbres d'épreuve -------------------------------------------------------

const VERSION = '2026.10.05.01';
const TECHNIQUE = '2026.1005.1';
const DATE = '2026-10-05';

// Le module engendré pour VERSION, octet pour octet.
const MODULE = [
  '// © 2026 TechnoLibre (http://www.technolibre.ca)',
  '// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)',
  '',
  '// Engendré par scripts/version.js depuis version.json — ne pas modifier.',
  'export const VERSION = Object.freeze({',
  "  affichee: '2026.10.05.01',",
  "  technique: '2026.1005.1',",
  '});',
  '',
].join('\n');

const TITRE_CHANGELOG = '# Changelog — Gestion table tournante Libre';

// Une section de changelog complète : titre, une rubrique, les deux lignes
// obligatoires.
const section = (titre) =>
  [
    `## ${titre}`,
    '',
    '**Ce qui change pour vous**',
    '- Le bandeau affiche la version.',
    '',
    '**Version de format des fichiers** : inchangée.',
    '',
    '**En remplaçant** : rien à faire.',
    '',
  ].join('\n');

const changelog = (...titres) => [TITRE_CHANGELOG, '', ...titres.map(section)].join('\n');

const enJson = (valeur) => `${JSON.stringify(valeur, null, 2)}\n`;

function ecrire(racine, chemin, contenu) {
  const complet = join(racine, chemin);
  mkdirSync(dirname(complet), { recursive: true });
  writeFileSync(complet, contenu);
}

const lire = (racine, chemin) => readFileSync(join(racine, chemin), 'utf8');

function modifierJson(racine, chemin, modification) {
  const valeur = JSON.parse(lire(racine, chemin));
  modification(valeur);
  ecrire(racine, chemin, enJson(valeur));
}

// Arbre conforme à VERSION et à DATE : la source, ses trois recopies, un
// changelog, un README qui cite le gabarit du nom, une source et une
// configuration à la racine.
function arbreConforme() {
  const racine = mkdtempSync(join(tmpdir(), 'version-'));
  ecrire(racine, 'version.json', `{ "version": "${VERSION}" }\n`);
  ecrire(racine, 'package.json', enJson({ name: 'essai', version: TECHNIQUE, type: 'module' }));
  ecrire(
    racine,
    'package-lock.json',
    enJson({
      name: 'essai',
      version: TECHNIQUE,
      lockfileVersion: 3,
      requires: true,
      packages: { '': { name: 'essai', version: TECHNIQUE } },
    }),
  );
  ecrire(racine, 'src/version.genere.js', MODULE);
  ecrire(
    racine,
    'src/main.js',
    "import { VERSION } from './version.genere.js';\nexport const titre = VERSION.affichee;\n",
  );
  ecrire(racine, 'vite.config.js', 'export default {};\n');
  ecrire(racine, 'CHANGELOG.md', changelog(`${VERSION} — 5 octobre 2026`));
  ecrire(
    racine,
    'README.md',
    "# Essai\n\nL'exécutable se nomme `gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe`.\n",
  );
  return racine;
}

// Exécute l'épreuve sur un arbre conforme neuf, supprimé ensuite.
function surArbre(epreuve) {
  const racine = arbreConforme();
  try {
    return epreuve(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

// Numéros de point des échecs, sans doublon, croissants. Un échec sans
// numéro fait échouer l'épreuve.
function points(echecs) {
  const numeros = echecs.map((echec) => {
    const numero = /^([1-8])\. /.exec(echec);
    assert.ok(numero, `échec sans numéro de point : ${echec}`);
    return Number(numero[1]);
  });
  return [...new Set(numeros)].sort((a, b) => a - b);
}

// Contrôle l'arbre et exige que les échecs nomment exactement les points
// attendus, et que chaque motif se lise dans l'un d'eux.
function exigerEchecs(racine, attendus, motifs, dateCivile = DATE) {
  const echecs = controler(racine, { dateCivile });
  const liste = echecs.join('\n');
  assert.deepEqual(points(echecs), attendus, liste);
  for (const motif of motifs) {
    assert.ok(
      echecs.some((echec) => motif.test(echec)),
      `${motif} ne se lit dans aucun échec :\n${liste}`,
    );
  }
  return echecs;
}

describe('version : contrôle du § 18.5, un défaut à la fois', () => {
  test("l'arbre de référence est conforme", () =>
    surArbre((racine) => {
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('point 1 : package.json porte une autre version technique', () =>
    surArbre((racine) => {
      modifierJson(racine, 'package.json', (paquet) => {
        paquet.version = '2026.1006.1';
      });
      exigerEchecs(racine, [1], [/^1\. package\.json .*2026\.1006\.1.*2026\.1005\.1/]);
    }));

  test('point 1 : le champ version du verrou porte une autre version', () =>
    surArbre((racine) => {
      modifierJson(racine, 'package-lock.json', (verrou) => {
        verrou.version = '2026.1004.1';
      });
      exigerEchecs(racine, [1], [/^1\. package-lock\.json, champ « version » .*2026\.1004\.1/]);
    }));

  test('point 1 : le champ packages[""].version du verrou porte une autre version', () =>
    surArbre((racine) => {
      modifierJson(racine, 'package-lock.json', (verrou) => {
        verrou.packages[''].version = '2026.1004.1';
      });
      exigerEchecs(
        racine,
        [1],
        [/^1\. package-lock\.json, champ « packages\[""\]\.version » .*2026\.1004\.1/],
      );
    }));

  test('point 1 : le verrou manque', () =>
    surArbre((racine) => {
      unlinkSync(join(racine, 'package-lock.json'));
      exigerEchecs(racine, [1], [/^1\. package-lock\.json absent/]);
    }));

  test('point 1 : version.json manque', () =>
    surArbre((racine) => {
      unlinkSync(join(racine, 'version.json'));
      exigerEchecs(racine, [1], [/^1\. version\.json absent/]);
    }));

  test('point 1 : version.json porte une version non conforme', () =>
    surArbre((racine) => {
      ecrire(racine, 'version.json', '{ "version": "2026.10.05.100" }\n');
      exigerEchecs(racine, [1], [/^1\. version\.json : .*rang 100.*99/]);
    }));

  test('point 2 : le module engendré est modifié à la main', () =>
    surArbre((racine) => {
      ecrire(racine, 'src/version.genere.js', MODULE.replace("'2026.1005.1'", "'2026.1005.2'"));
      exigerEchecs(racine, [2], [/^2\. src\/version\.genere\.js, ligne 7 /]);
    }));

  test('point 2 : le module engendré manque', () =>
    surArbre((racine) => {
      unlinkSync(join(racine, 'src/version.genere.js'));
      exigerEchecs(racine, [2], [/^2\. src\/version\.genere\.js absent/]);
    }));

  test('point 3 : le titre de tête ne porte pas la version courante', () =>
    surArbre((racine) => {
      ecrire(racine, 'CHANGELOG.md', changelog('2026.10.04.01 — 4 octobre 2026'));
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md, ligne 3 : .*2026\.10\.04\.01.*2026\.10\.05\.01/]);
    }));

  test('point 3 : la date en lettres du titre de tête est fausse', () =>
    surArbre((racine) => {
      ecrire(racine, 'CHANGELOG.md', changelog(`${VERSION} — 6 octobre 2026`));
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md, ligne 3 : .*6 octobre 2026.*5 octobre 2026/]);
    }));

  test('point 3 : la ligne de la version de format manque', () =>
    surArbre((racine) => {
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(racine, 'CHANGELOG.md', texte.replace('**Version de format des fichiers** : inchangée.\n', ''));
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md.*Version de format des fichiers/]);
    }));

  test('point 3 : la ligne « En remplaçant » manque', () =>
    surArbre((racine) => {
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(racine, 'CHANGELOG.md', texte.replace('**En remplaçant** : rien à faire.\n', ''));
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md.*En remplaçant/]);
    }));

  test('point 3 : le changelog manque', () =>
    surArbre((racine) => {
      unlinkSync(join(racine, 'CHANGELOG.md'));
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md absent/]);
    }));

  test('point 3 : une ligne obligatoire absente de la section de tête échoue, même portée par une section plus ancienne', () => {
    const lignes = [
      ['**Version de format des fichiers** : inchangée.\n', /^3\. CHANGELOG\.md, ligne 3 : .*Version de format des fichiers/],
      ['**En remplaçant** : rien à faire.\n', /^3\. CHANGELOG\.md, ligne 3 : .*En remplaçant/],
    ];
    for (const [ligne, motif] of lignes) {
      surArbre((racine) => {
        const texte = changelog(`${VERSION} — 5 octobre 2026`, '2026.10.04.01 — 4 octobre 2026');
        // replace ne retire que la première occurrence : celle de la section de tête.
        ecrire(racine, 'CHANGELOG.md', texte.replace(ligne, ''));
        exigerEchecs(racine, [3], [motif]);
      });
    }
  });

  test('point 3 : une ligne obligatoire citée dans un bloc de code ne compte pas', () =>
    surArbre((racine) => {
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(
        racine,
        'CHANGELOG.md',
        texte.replace('**En remplaçant** : rien à faire.\n', '```\n**En remplaçant** : rien à faire.\n```\n'),
      );
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md, ligne 3 : .*En remplaçant/]);
    }));

  test('points 3 et 4 : une section « À venir » en tête', () =>
    surArbre((racine) => {
      // La section « À venir » porte ses deux lignes obligatoires : seul son
      // titre fait tomber le point 3.
      ecrire(racine, 'CHANGELOG.md', changelog('À venir', `${VERSION} — 5 octobre 2026`));
      exigerEchecs(racine, [3, 4], [
        /^3\. CHANGELOG\.md, ligne 3 : le titre « ## À venir » n'a pas la forme/,
        /^4\. CHANGELOG\.md, ligne 3 : le titre « ## À venir » ne s'ouvre pas sur une version/,
      ]);
    }));

  test('point 4 : une section « À venir » entre deux versions', () =>
    surArbre((racine) => {
      ecrire(
        racine,
        'CHANGELOG.md',
        changelog(`${VERSION} — 5 octobre 2026`, 'À venir', '2026.10.04.01 — 4 octobre 2026'),
      );
      exigerEchecs(racine, [4], [
        /^4\. CHANGELOG\.md, ligne 12 : le titre « ## À venir » ne s'ouvre pas sur une version/,
      ]);
    }));

  test('points 3 et 4 : un titre « ## » cité dans un bloc de code ne découpe pas la section', () =>
    surArbre((racine) => {
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(
        racine,
        'CHANGELOG.md',
        texte.replace(
          '- Le bandeau affiche la version.\n',
          '- Le bandeau affiche la version.\n\n```markdown\n## Notes de la soirée\n```\n',
        ),
      );
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('points 3 et 4 : un sous-titre « ### » ne découpe pas la section', () =>
    surArbre((racine) => {
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(
        racine,
        'CHANGELOG.md',
        texte.replace('**Ce qui change pour vous**\n', '**Ce qui change pour vous**\n\n### Le bandeau\n'),
      );
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('point 4 : deux sections portent la même version', () =>
    surArbre((racine) => {
      ecrire(
        racine,
        'CHANGELOG.md',
        changelog(`${VERSION} — 5 octobre 2026`, `${VERSION} — 5 octobre 2026`),
      );
      exigerEchecs(racine, [4], [/^4\. CHANGELOG\.md, lignes 3 et 12 : .*2026\.10\.05\.01/]);
    }));

  test('point 4 : une section plus récente suit une plus ancienne', () =>
    surArbre((racine) => {
      ecrire(
        racine,
        'CHANGELOG.md',
        changelog(`${VERSION} — 5 octobre 2026`, '2026.10.06.01 — 6 octobre 2026'),
      );
      exigerEchecs(racine, [4], [/^4\. CHANGELOG\.md, ligne 12 : .*2026\.10\.06\.01.*2026\.10\.05\.01/]);
    }));

  test('point 4 : des sections en ordre strictement décroissant sont admises', () =>
    surArbre((racine) => {
      ecrire(
        racine,
        'CHANGELOG.md',
        changelog(
          `${VERSION} — 5 octobre 2026`,
          '2026.10.04.02 — 4 octobre 2026',
          '2026.10.04.01 — 4 octobre 2026',
          '2025.12.31.01 — 31 décembre 2025',
        ),
      );
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test("point 5 : la version est datée de plus d'un jour après la date civile", () =>
    surArbre((racine) => {
      exigerEchecs(racine, [5], [/^5\. version\.json : .*5 octobre 2026.*3 octobre 2026/], '2026-10-03');
    }));

  test("point 5 : un jour d'avance sur la date civile est toléré", () =>
    surArbre((racine) => {
      assert.deepEqual(controler(racine, { dateCivile: '2026-10-04' }), []);
      assert.deepEqual(controler(racine, { dateCivile: '2027-03-01' }), []);
    }));

  test('point 6 : une forme affichée dans src/ hors du module engendré', () =>
    surArbre((racine) => {
      ecrire(racine, 'src/interface/bandeau.js', "// Bandeau.\n\nexport const v = 'v2026.10.05.01';\n");
      exigerEchecs(racine, [6], [/^6\. src\/interface\/bandeau\.js, ligne 3 : « 2026\.10\.05\.01 », forme affichée/]);
    }));

  test('point 6 : une forme technique hors de package.json et du module engendré', () =>
    surArbre((racine) => {
      ecrire(racine, 'vite.config.js', "export default { define: { V: '2026.1005.1' } };\n");
      ecrire(racine, 'scripts/construire.sh', '#!/bin/sh\nWINDOWS=2026.1005.1.0\n');
      exigerEchecs(racine, [6], [
        /^6\. vite\.config\.js, ligne 1 : « 2026\.1005\.1 », forme technique/,
        /^6\. scripts\/construire\.sh, ligne 2 : « 2026\.1005\.1 », forme technique/,
      ]);
    }));

  test('point 6 : une forme affichée dans package.json', () =>
    surArbre((racine) => {
      modifierJson(racine, 'package.json', (paquet) => {
        paquet.description = 'version 2026.10.05.01';
      });
      exigerEchecs(racine, [6], [/^6\. package\.json, ligne \d+ : « 2026\.10\.05\.01 », forme affichée/]);
    }));

  test('point 6 : les épreuves de test/ sont dans le périmètre', () =>
    surArbre((racine) => {
      ecrire(racine, 'test/bandeau.test.js', "export const attendu = '2026.10.05.01';\n");
      exigerEchecs(racine, [6], [/^6\. test\/bandeau\.test\.js, ligne 1 /]);
    }));

  test('point 6 : la coquille electron/ est dans le périmètre', () =>
    surArbre((racine) => {
      ecrire(racine, 'electron/main.js', "const titre = 'Gestion table tournante Libre — 2026.10.05.01';\n");
      exigerEchecs(racine, [6], [/^6\. electron\/main\.js, ligne 1 : « 2026\.10\.05\.01 », forme affichée/]);
    }));

  test('point 6 : une version ne se lit pas dans un nombre plus long qui la contient', () =>
    surArbre((racine) => {
      // Un chiffre ou un point devant, un chiffre derrière : chaque ligne
      // prolonge une version d'un côté, sous l'une des deux formes.
      ecrire(
        racine,
        'src/donnees.js',
        [
          "export const a = '12026.10.05.01';",
          "export const b = '1.2026.10.05.01';",
          "export const c = '2026.10.05.012';",
          "export const d = '12026.1005.1';",
          "export const e = '1.2026.1005.1';",
          "export const f = '2026.1005.123';",
          '',
        ].join('\n'),
      );
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test("point 6 : un fichier binaire, qui porte un octet nul, n'est pas lu comme du texte", () =>
    surArbre((racine) => {
      ecrire(racine, 'src/interface/icone.png', `PNG\u0000${VERSION} ${TECHNIQUE}\n`);
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('point 6 : données, guides, dépendances et sorties restent hors du périmètre', () =>
    surArbre((racine) => {
      const versions = `${VERSION} ${TECHNIQUE} ${TECHNIQUE}.0\n`;
      for (const chemin of [
        'scripts/version.test.js',
        'test/fixtures/demonstration.json',
        'GUIDE-USAGE.md',
        'docs/notes.md',
        'node_modules/paquet/index.js',
        'src/node_modules/paquet/index.js',
        'www/assets/index.js',
        'dist/sortie.js',
        'dist-electron/main.js',
        'android/app/build.gradle',
      ]) {
        ecrire(racine, chemin, versions);
      }
      ecrire(racine, 'README.md', `${lire(racine, 'README.md')}\nVersion ${versions}`);
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('point 7 : un document porte le littéral #_#', () =>
    surArbre((racine) => {
      ecrire(racine, 'README.md', `${lire(racine, 'README.md')}\nVersion : #_#\n`);
      exigerEchecs(racine, [7], [/^7\. README\.md, ligne 5 : .*#_#/]);
    }));

  test("point 7 : un document cite un nom d'exécutable hors du gabarit", () =>
    surArbre((racine) => {
      const fautifs = [
        'gestion_table_tournante_libre_v2026.10.05.01.exe',
        'gestion_table_tournante_libre_v2026_10_05_1.exe',
        'gestion_table_tournante_libre_v2026_13_05_01.exe',
        'gestion_table_tournante_libre_v<AAAA>.exe',
        'gestion_table_tournante_libre.exe',
        'Gestion_Table_Tournante_Libre_v2026_10_05_01.EXE',
      ];
      ecrire(racine, 'GUIDE-WINDOWS.md', fautifs.map((nom) => `Lancer \`${nom}\`.\n`).join(''));
      const echecs = exigerEchecs(
        racine,
        [7],
        fautifs.map((nom, i) => new RegExp(`^7\\. GUIDE-WINDOWS\\.md, ligne ${i + 1} : « ${nom.replace(/[.<>]/g, '\\$&')} »`)),
      );
      assert.equal(echecs.length, fautifs.length, echecs.join('\n'));
    }));

  test('point 7 : le gabarit, un nom conforme et le préfixe seul sont admis', () =>
    surArbre((racine) => {
      ecrire(
        racine,
        'GUIDE-WINDOWS.md',
        [
          'Le fichier dont le nom commence par `gestion_table_tournante_libre_v`.',
          'Gabarit : `gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe`.',
          'Par exemple gestion_table_tournante_libre_v2026_10_05_01.exe.',
          '',
        ].join('\n'),
      );
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('point 7 : le changelog est balayé', () =>
    surArbre((racine) => {
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(
        racine,
        'CHANGELOG.md',
        texte.replace(
          '- Le bandeau affiche la version.\n',
          '- Le bandeau affiche la version.\n- Lancer `gestion_table_tournante_libre.exe`.\n- Version #_#.\n',
        ),
      );
      const echecs = exigerEchecs(racine, [7], [
        /^7\. CHANGELOG\.md, ligne 7 : « gestion_table_tournante_libre\.exe »/,
        /^7\. CHANGELOG\.md, ligne 8 : littéral « #_# »/,
      ]);
      assert.equal(echecs.length, 2, echecs.join('\n'));
    }));

  test('point 8 : un balayage qui ne trouve aucune source échoue', () =>
    surArbre((racine) => {
      rmSync(join(racine, 'src'), { recursive: true });
      // Sans src/, le module engendré manque aussi : le point 2 tombe avec.
      exigerEchecs(racine, [2, 8], [/^8\. .*src\//]);
    }));

  test('point 8 : un src/ qui ne porte que le module engendré ne compte aucune source', () =>
    surArbre((racine) => {
      unlinkSync(join(racine, 'src/main.js'));
      const echecs = exigerEchecs(racine, [8], [/^8\. le balayage du point 6 n'examine aucun fichier sous src\//]);
      assert.equal(echecs.length, 1, echecs.join('\n'));
    }));

  test('point 8 : un balayage qui ne trouve aucun document échoue', () =>
    surArbre((racine) => {
      unlinkSync(join(racine, 'README.md'));
      unlinkSync(join(racine, 'CHANGELOG.md'));
      // Sans changelog, le point 3 tombe avec.
      exigerEchecs(racine, [3, 8], [/^8\. le balayage du point 7 n'examine aucun document/]);
    }));

  test("modifier version.json seul fait tomber les points 1, 2 et 3, chacun nommant l'endroit resté en arrière", () =>
    surArbre((racine) => {
      ecrire(racine, 'version.json', '{ "version": "2026.10.05.02" }\n');
      const echecs = exigerEchecs(racine, [1, 2, 3], [
        /^1\. package\.json /,
        /^1\. package-lock\.json, champ « version » /,
        /^1\. package-lock\.json, champ « packages\[""\]\.version » /,
        /^2\. src\/version\.genere\.js, ligne 6 /,
        /^3\. CHANGELOG\.md, ligne 3 : /,
      ]);
      assert.equal(echecs.length, 5, echecs.join('\n'));
      engendrer(racine);
      exigerEchecs(racine, [3], [/^3\. CHANGELOG\.md, ligne 3 : /]);
      const texte = lire(racine, 'CHANGELOG.md');
      ecrire(
        racine,
        'CHANGELOG.md',
        texte.replace(`${TITRE_CHANGELOG}\n\n`, `${TITRE_CHANGELOG}\n\n${section('2026.10.05.02 — 5 octobre 2026')}\n`),
      );
      assert.deepEqual(controler(racine, { dateCivile: DATE }), []);
    }));

  test('refuse une date civile mal formée', () => {
    assert.throws(() => controler(RACINE, { dateCivile: '2026-10-5' }), TypeError);
    assert.throws(() => controler(RACINE, { dateCivile: '2026-02-30' }), /jour/);
  });
});

describe('version : engendrement', () => {
  test("engendrerModule rend le module, l'en-tête de licence en tête", () => {
    assert.equal(engendrerModule(VERSION), MODULE);
  });

  test('engendrer réécrit le module, package.json et les deux champs du verrou', () =>
    surArbre((racine) => {
      ecrire(racine, 'version.json', '{ "version": "2026.10.06.02" }\n');
      const paquet = JSON.parse(lire(racine, 'package.json'));
      const verrou = JSON.parse(lire(racine, 'package-lock.json'));
      const reecrits = engendrer(racine);
      assert.deepEqual(reecrits, ['src/version.genere.js', 'package.json', 'package-lock.json']);
      assert.equal(lire(racine, 'src/version.genere.js'), engendrerModule('2026.10.06.02'));
      assert.equal(lire(racine, 'package.json'), enJson({ ...paquet, version: '2026.1006.2' }));
      verrou.version = '2026.1006.2';
      verrou.packages[''].version = '2026.1006.2';
      assert.equal(lire(racine, 'package-lock.json'), enJson(verrou));
    }));

  test('sur un arbre à jour, engendrer ne réécrit rien', () =>
    surArbre((racine) => {
      const fichiers = ['src/version.genere.js', 'package.json', 'package-lock.json'];
      const avant = fichiers.map((chemin) => lire(racine, chemin));
      assert.deepEqual(engendrer(racine), []);
      assert.deepEqual(fichiers.map((chemin) => lire(racine, chemin)), avant);
    }));

  test('engendrer lève quand le verrou manque, sans rien écrire', () =>
    surArbre((racine) => {
      ecrire(racine, 'version.json', '{ "version": "2026.10.06.02" }\n');
      unlinkSync(join(racine, 'package-lock.json'));
      assert.throws(() => engendrer(racine), /package-lock\.json absent.*npm install/);
      assert.equal(lire(racine, 'src/version.genere.js'), MODULE);
      assert.equal(JSON.parse(lire(racine, 'package.json')).version, TECHNIQUE);
    }));

  test('engendrer refuse le centième rang de la journée, sans rien écrire', () =>
    surArbre((racine) => {
      ecrire(racine, 'version.json', '{ "version": "2026.10.05.100" }\n');
      assert.throws(() => engendrer(racine), /^Error: version\.json : .*99/);
      assert.equal(lire(racine, 'src/version.genere.js'), MODULE);
    }));
});

describe('version : date civile de la machine', () => {
  test('dateCivileLocale écrit la date locale sous la forme AAAA-MM-JJ', () => {
    assert.equal(dateCivileLocale(new Date(2026, 9, 5, 23, 59)), '2026-10-05');
    assert.equal(dateCivileLocale(new Date(2027, 0, 1, 0, 0)), '2027-01-01');
  });
});

describe('version : ligne de commande', () => {
  // Le script copié dans l'arbre d'épreuve prend pour racine le parent de
  // son répertoire, comme dans le projet.
  function lancer(racine, ...arguments_) {
    const script = join(racine, 'scripts', 'version.js');
    mkdirSync(dirname(script), { recursive: true });
    copyFileSync(SCRIPT, script);
    return spawnSync(process.execPath, [script, ...arguments_], { encoding: 'utf8' });
  }

  test('controler sort en 0 sur un arbre conforme, en 1 en imprimant les échecs sinon', () =>
    surArbre((racine) => {
      const conforme = lancer(racine, 'controler');
      assert.equal(conforme.status, 0, conforme.stderr);
      modifierJson(racine, 'package.json', (paquet) => {
        paquet.version = '2026.1006.1';
      });
      const fautif = lancer(racine, 'controler');
      assert.equal(fautif.status, 1, fautif.stdout);
      assert.match(fautif.stderr, /^1\. package\.json /m);
    }));

  test('engendrer réécrit les recopies, et sort en 1 quand le verrou manque', () =>
    surArbre((racine) => {
      ecrire(racine, 'version.json', '{ "version": "2026.10.05.02" }\n');
      const reussi = lancer(racine, 'engendrer');
      assert.equal(reussi.status, 0, reussi.stderr);
      assert.equal(lire(racine, 'src/version.genere.js'), engendrerModule('2026.10.05.02'));
      unlinkSync(join(racine, 'package-lock.json'));
      const echoue = lancer(racine, 'engendrer');
      assert.equal(echoue.status, 1, echoue.stdout);
      assert.match(echoue.stderr, /package-lock\.json absent/);
    }));

  test("une commande inconnue sort en 2 et rappelle l'usage", () =>
    surArbre((racine) => {
      const inconnue = lancer(racine, 'publier');
      assert.equal(inconnue.status, 2);
      assert.match(inconnue.stderr, /engendrer.*controler/);
    }));
});

describe('version : arbre réel', () => {
  test("l'arbre réel du projet est conforme, à la date civile de la machine", () => {
    assert.deepEqual(controler(RACINE, { dateCivile: dateCivileLocale() }), []);
  });
});
