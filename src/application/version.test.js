// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la version visible (§ 18.6, § 19.4) : ce qui tient lieu de
// version à l'écran, au pied des pages imprimées et sur la feuille de
// contrôle — la marque de provenance dans une construction de
// documentation —, et la provenance à l'écran. Une seule définition, que
// l'interface réexporte. La version vient du module engendré.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { TABLES_INTERFACE, libelleProvenance } from '../interface/libelles.js';
import { VERSION } from '../version.genere.js';
import { TABLES_APPLICATION, libelle } from './libelles.js';
import { MARQUE_TEMOIN, creerTraduction } from './traduction.js';
import { provenanceVisible, versionVisible } from './version.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const temoin = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE], { langue: 'temoin' }).t;

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

// Les modules JavaScript de src/, épreuves comprises, en chemins relatifs à
// la racine. Les composants n'y entrent pas : ils importent la règle, et une
// épreuve qui les lirait par le disque devrait se relancer à chacun d'eux.
function sources(dossier = join(RACINE, 'src')) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return sources(chemin);
    return entree.name.endsWith('.js') ? [relative(RACINE, chemin)] : [];
  });
}

describe('versionVisible (§ 18.6, § 19.4)', () => {
  test('la version affichée, hors d’une construction de documentation', () => {
    for (const provenance of ['developpement', 'livraison', 'test', 'production']) {
      assert.equal(versionVisible(provenance, VERSION.affichee, t), VERSION.affichee, provenance);
      assert.equal(versionVisible(provenance, VERSION.affichee, libelle), VERSION.affichee, provenance);
    }
  });

  test("la marque de provenance, sans le numéro, dans une construction de documentation : par t à l'écran, par libelle sur le papier", () => {
    const marque = versionVisible('documentation', VERSION.affichee, t);
    assert.equal(marque, libelle('sorties.version.documentation'));
    assert.equal(versionVisible('documentation', VERSION.affichee, libelle), marque);
    assert.ok(!marque.includes(VERSION.affichee), marque);
    const encadree = versionVisible('documentation', VERSION.affichee, temoin);
    assert.equal(encadree, `${MARQUE_TEMOIN.ouverture}${marque}${MARQUE_TEMOIN.fermeture}`);
  });
});

describe('provenanceVisible (§ 18.6)', () => {
  test('le libellé du mode par la traduction reçue ; un mode sans libellé sous son propre nom', () => {
    for (const mode of ['developpement', 'livraison', 'documentation', 'test']) {
      assert.equal(provenanceVisible(mode, t), libelleProvenance(mode), mode);
    }
    assert.equal(provenanceVisible('production', t), 'production');
    assert.equal(provenanceVisible('constructor', t), 'constructor');
    assert.equal(provenanceVisible('__proto__', t), '__proto__');
  });

  test('en langue témoin, le libellé est encadré, le mode sans libellé non : il est une donnée', () => {
    const { ouverture, fermeture } = MARQUE_TEMOIN;
    assert.equal(provenanceVisible('test', temoin), `${ouverture}${libelleProvenance('test')}${fermeture}`);
    assert.equal(provenanceVisible('production', temoin), 'production');
  });
});

describe('la version visible : une seule définition (§ 13.2, § 18.6)', () => {
  test("versionVisible et provenanceVisible ne se définissent qu'ici ; apropos.js les réexporte, les mêmes fonctions", async () => {
    const definitions = sources().filter((chemin) =>
      /\bfunction\s+(versionVisible|provenanceVisible)\b|\b(versionVisible|provenanceVisible)\s*=/.test(readFileSync(join(RACINE, chemin), 'utf8')),
    );
    assert.deepEqual(definitions, [join('src', 'application', 'version.js')]);
    const apropos = await import('../interface/apropos.js');
    assert.equal(apropos.versionVisible, versionVisible);
    assert.equal(apropos.provenanceVisible, provenanceVisible);
  });
});
