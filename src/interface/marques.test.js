// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des marques porteuses d'information et des textes (§ 14.5,
// § 7.5, § 7.6, § 7.7), et la palette de jetons.css validée par calcul sur
// lui (§ 12.7) : chaque entrée tient son seuil sur chacun de ses fonds, dans
// les deux thèmes, en couleurs d'origine puis sous les trois dichromaties.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { MARQUES, TEXTES } from './marques.js';
import { lireBlocs, lireJetons, verifierPalette } from './palette.js';

const JETONS = readFileSync(new URL('./jetons.css', import.meta.url), 'utf8');
const THEMES = ['clair', 'sombre'];

const NOMS_MARQUES = [
  'cadenasFerme', 'cadenasOuvert', 'anneau', 'hachure', 'remplissagePlein',
  'contourConflit', 'trameConflit', 'pastille', 'poignee', 'gel', 'miseEnEvidence',
  'selection', 'cadreLecture', 'cadreEcriture', 'cadreBloque', 'focus',
  'contourTable', 'contourChaise', 'echelle', 'fantome',
];

// Les remplissages d'une chaise : fond, pleine, et les deux couleurs de la
// hachure — ses traits sur le fond de la chaise.
const REMPLISSAGES_CHAISE = ['--couleur-chaise-fond', '--couleur-chaise-pleine', '--couleur-hachure'];

// Fonds minimaux des marques de désignation et du fantôme. « chaise » vaut
// chacun des remplissages d'une chaise : la marque se pose sur une chaise
// vide, pourvue ou à pourvoir.
const c = (nom) => `--couleur-${nom}`;
const FONDS_REQUIS = {
  focus: [...['page-fond', 'bandeau-fond', 'sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
  selection: [...['page-fond', 'sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
  miseEnEvidence: [...['page-fond', 'sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
  fantome: [...['sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
};

const parNom = (registre, nom) => registre.find((e) => e.nom === nom);

describe('registre des marques', () => {
  test('les vingt marques du contrat, noms uniques, seuil 3, au moins un fond chacune', () => {
    assert.equal(MARQUES.length, NOMS_MARQUES.length);
    assert.deepEqual(MARQUES.map((m) => m.nom), NOMS_MARQUES);
    assert.equal(new Set(MARQUES.map((m) => m.nom)).size, MARQUES.length);
    for (const marque of MARQUES) {
      assert.deepEqual(Object.keys(marque).sort(), ['fonds', 'jeton', 'nom', 'seuil'], marque.nom);
      assert.equal(marque.seuil, 3, marque.nom);
      assert.ok(marque.fonds.length > 0, marque.nom);
      assert.equal(new Set(marque.fonds).size, marque.fonds.length, `${marque.nom} : fond en double`);
    }
  });

  test('le registre est figé', () => {
    assert.ok(Object.isFrozen(MARQUES) && Object.isFrozen(TEXTES));
    assert.ok(MARQUES.every((m) => Object.isFrozen(m) && Object.isFrozen(m.fonds)));
    assert.ok(TEXTES.every((m) => Object.isFrozen(m) && Object.isFrozen(m.fonds)));
  });

  test('le focus, la sélection, la mise en évidence et le fantôme se mesurent sur chaque fond où ils se peignent, chaque remplissage de chaise compris', () => {
    for (const nom of ['focus', 'selection', 'miseEnEvidence', 'fantome']) {
      const marque = parNom(MARQUES, nom);
      assert.notEqual(marque, undefined, nom);
      for (const fond of FONDS_REQUIS[nom]) {
        assert.ok(marque.fonds.includes(fond), `${nom} : ${fond}`);
      }
    }
  });

  test('une marque posée sur une chaise se mesure sur chacun de ses remplissages', () => {
    const surChaise = ['cadenasFerme', 'cadenasOuvert', 'anneau'];
    for (const nom of surChaise) {
      for (const fond of REMPLISSAGES_CHAISE) {
        assert.ok(parNom(MARQUES, nom).fonds.includes(fond), `${nom} : ${fond}`);
      }
    }
    assert.deepEqual(parNom(MARQUES, 'hachure').fonds, ['--couleur-chaise-fond']);
  });

  test('chaque jeton et chaque fond du registre existe dans les deux thèmes', () => {
    const entrees = [...MARQUES, ...TEXTES];
    assert.ok(entrees.length > 20);
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const entree of entrees) {
        for (const nom of [entree.jeton, ...entree.fonds]) {
          assert.ok(jetons.has(nom), `${theme} : ${entree.nom} → ${nom}`);
        }
      }
    }
  });
});

describe('registre des textes', () => {
  test('page, secondaire, bandeau, refus, avis, listes du plan, pastille ; seuil 4,5', () => {
    assert.deepEqual(TEXTES.map((t) => t.nom), ['page', 'secondaire', 'bandeau', 'refus', 'avis', 'listes', 'pastille']);
    assert.ok(TEXTES.every((t) => t.seuil === 4.5 && t.fonds.length > 0));
    assert.deepEqual(parNom(TEXTES, 'listes').fonds, ['--couleur-sol']);
    assert.deepEqual(parNom(TEXTES, 'pastille').fonds, ['--couleur-pastille-fond']);
  });
});

describe('palette de jetons.css validée par calcul (§ 12.7, § 14.5)', () => {
  test('aucun jeton de texte ou de marque, ni aucun de leurs fonds, n’a de canal alpha', () => {
    const noms = new Set([...MARQUES, ...TEXTES].flatMap((e) => [e.jeton, ...e.fonds]));
    assert.ok(noms.size > 20);
    const blocs = lireBlocs(JETONS);
    for (const theme of THEMES) {
      const selecteur = `:root[data-theme='${theme}']`;
      const brutes = new Map(
        blocs.filter((b) => b.selecteurs.includes(selecteur)).flatMap((b) => [...b.declarations]),
      );
      const jetons = lireJetons(JETONS, theme);
      for (const nom of noms) {
        assert.equal(jetons.get(nom)[3], 1, `${theme} : ${nom}`);
        assert.doesNotMatch(
          brutes.get(nom),
          /rgba|hsla|transparent|#[0-9a-f]{8}\b|#[0-9a-f]{4}\b|\/\s*[\d.]+%?\s*\)/i,
          `${theme} : ${nom}`,
        );
      }
    }
  });

  test('chaque marque tient 3:1 sur chacun de ses fonds, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, MARQUES), []);
  });

  test('chaque texte tient 4,5:1 sur chacun de ses fonds, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, TEXTES), []);
  });
});
