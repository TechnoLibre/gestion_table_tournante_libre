// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le bloc « À propos » (§ 18.6) : une ligne que l'opérateur copie dans un
// courriel — nom, version affichée, version Windows, plateforme, provenance,
// version de format —, et ce qui tient lieu de version à l'écran, la marque
// de provenance dans une construction de documentation (§ 19.4).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { MARQUE_TEMOIN, creerTraduction } from '../application/traduction.js';
import { FORMAT } from '../stockage/document.js';
import { VERSION } from '../version.genere.js';
import { blocAPropos, provenanceVisible, versionVisible } from './apropos.js';
import { TABLES_INTERFACE, libelleProvenance } from './libelles.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const temoin = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE], { langue: 'temoin' }).t;

describe('blocAPropos (§ 18.6)', () => {
  test('une ligne : nom, version affichée, version Windows, plateforme, provenance, format, séparés par « · »', () => {
    assert.match(VERSION.windows ?? '', /^\d+\.\d+\.\d+\.0$/, 'VERSION.windows engendré');
    const bloc = blocAPropos({ version: VERSION, plateforme: 'electron', provenance: 'livraison', format: FORMAT }, t);
    assert.equal(typeof bloc, 'string');
    assert.doesNotMatch(bloc, /[\n\r\u{2028}\u{2029}]/u);
    assert.deepEqual(bloc.split(' \u{00B7} '), [
      t('coquille.nom'),
      VERSION.affichee,
      VERSION.windows,
      'electron',
      libelleProvenance('livraison'),
      t('coquille.apropos.format', { format: FORMAT }),
    ]);
    assert.ok(bloc.includes(String(FORMAT)));
  });

  test('chaque plateforme et chaque provenance s’y lisent ; un mode sans libellé sous son propre nom', () => {
    const cas = [
      ['web', 'developpement', libelleProvenance('developpement')],
      ['epreuve', 'test', libelleProvenance('test')],
      ['electron', 'documentation', libelleProvenance('documentation')],
      ['web', 'production', 'production'],
    ];
    assert.ok(cas.length > 0);
    for (const [plateforme, provenance, libelle] of cas) {
      const champs = blocAPropos({ version: VERSION, plateforme, provenance, format: FORMAT }, t).split(' \u{00B7} ');
      assert.equal(champs[3], plateforme, provenance);
      assert.equal(champs[4], libelle, provenance);
    }
  });

  test('une forme de la version absente, vide ou qui n’est pas une chaîne lève RangeError en la nommant : jamais un bloc copiable faux', () => {
    const fautes = [undefined, null, '', 7];
    assert.equal(fautes.length, 4);
    for (const faute of fautes) {
      for (const [forme, version] of [
        ['windows', { affichee: VERSION.affichee, windows: faute }],
        ['affichee', { affichee: faute, windows: VERSION.windows }],
      ]) {
        assert.throws(
          () => blocAPropos({ version, plateforme: 'web', provenance: 'test', format: FORMAT }, t),
          (erreur) => erreur instanceof RangeError && erreur.message.includes(forme),
          `${forme} ${String(faute)}`,
        );
      }
    }
  });

  test('en langue témoin, le bloc entier est encadré une fois', () => {
    const bloc = blocAPropos({ version: VERSION, plateforme: 'web', provenance: 'test', format: FORMAT }, temoin);
    const { ouverture, fermeture } = MARQUE_TEMOIN;
    assert.ok(bloc.startsWith(ouverture) && bloc.endsWith(fermeture), bloc);
    assert.equal(bloc.split(ouverture).length, 2, bloc);
    assert.equal(bloc.split(fermeture).length, 2, bloc);
  });
});

describe('versionVisible (§ 18.6, § 19.4)', () => {
  test('la version affichée, hors d’une construction de documentation', () => {
    for (const provenance of ['developpement', 'livraison', 'test']) {
      assert.equal(versionVisible(provenance, VERSION.affichee, t), VERSION.affichee, provenance);
    }
  });

  test('la marque de provenance, sans le numéro, dans une construction de documentation', () => {
    const marque = versionVisible('documentation', VERSION.affichee, t);
    assert.equal(marque, t('coquille.version.documentation'));
    assert.ok(!marque.includes(VERSION.affichee), marque);
  });
});

describe('provenanceVisible (§ 18.6)', () => {
  test('le libellé du mode par la traduction reçue ; un mode sans libellé sous son propre nom', () => {
    for (const mode of ['developpement', 'livraison', 'documentation', 'test']) {
      assert.equal(provenanceVisible(mode, t), libelleProvenance(mode), mode);
    }
    assert.equal(provenanceVisible('production', t), 'production');
    assert.equal(provenanceVisible('constructor', t), 'constructor');
  });

  test('en langue témoin, le libellé est encadré, le mode sans libellé non : il est une donnée', () => {
    const { ouverture, fermeture } = MARQUE_TEMOIN;
    assert.equal(provenanceVisible('test', temoin), `${ouverture}${libelleProvenance('test')}${fermeture}`);
    assert.equal(provenanceVisible('production', temoin), 'production');
  });
});

describe('la version de l’interface vient des dépendances (§ 13.4, § 18.6)', () => {
  test('App.svelte ne lit pas la version engendrée : la version affichée et la forme Windows arrivent par ses propriétés, produitVersion et versionWindows', () => {
    const source = readFileSync(new URL('./App.svelte', import.meta.url), 'utf8');
    const imports = [...source.matchAll(/^\s*import\s[^;]*?from\s+'([^']+)'/gmu)].map(([, chemin]) => chemin);
    assert.ok(imports.length > 0, 'des imports relevés');
    assert.deepEqual(
      imports.filter((chemin) => chemin.includes('version.genere')),
      [],
    );
    assert.match(source, /\bversionWindows\b/u);
    assert.match(source, /blocAPropos\(\s*\{\s*version:\s*\{\s*affichee:\s*produitVersion,\s*windows:\s*versionWindows\s*\}/u);
  });
});
