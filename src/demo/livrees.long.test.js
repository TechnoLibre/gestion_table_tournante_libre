// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves longues des démonstrations livrées (§ 14.4) : l'empreinte de la
// charge de chaque fichier livré contre celle que rejoue le script (§ 15.5,
// point 5), le profil d'appartenances lu dans le fichier (§ 15.2), et
// l'aller-retour sur chacun, grande démonstration comprise (§ 8.9). Le
// fichier livré est la source de vérité : un écart d'empreinte se nomme par
// les chemins de la charge qui diffèrent, et se résout en engendrant de
// nouveau, geste conscient, jamais en corrigeant l'épreuve.
import assert from 'node:assert/strict';
import { empreinte, texteDeDemonstration } from '../../scripts/engendrer_livrables.js';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { serialiser } from '../stockage/canonique.js';
import { difference } from '../stockage/correctifs.js';
import { analyser } from '../stockage/document.js';
import { examiner } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { CATALOGUE } from './catalogue.js';
import { LIVREES, texteLivre } from './livrees.js';

const EMPREINTE = /^[0-9a-f]{64}$/;

// Chemin d'une opération de correctif, lisible : les clés jointes par des
// points, un rang entre crochets, un enregistrement par [id=n].
const cheminLisible = (chemin) =>
  chemin
    .map((etape) => {
      if (typeof etape === 'string') return `.${etape}`;
      return typeof etape === 'number' ? `[${etape}]` : `[id=${etape.id}]`;
    })
    .join('')
    .replace(/^\./, '');

// Affirme que la charge rejouée a l'empreinte de la charge livrée ; à
// l'échec, nomme chaque chemin où elles diffèrent, tel que le correctif de
// l'une à l'autre le pose ou le retire (§ 15.5, point 5).
function memeEmpreinte(livree, rejouee, cle) {
  if (empreinte(rejouee) === empreinte(livree)) return;
  const chemins = difference(livree, rejouee).map(({ op, chemin }) => `${op} ${cheminLisible(chemin)}`);
  assert.fail(
    `${cle} : la charge que rejoue le script diffère du fichier livré : ${chemins.join(' ; ')}. ` +
      'Engendrer de nouveau est un geste conscient : node scripts/engendrer_livrables.js',
  );
}

// Profil d'appartenances d'une liste de participants (§ 15.2) : pour chaque
// taille de groupe, le nombre de groupes de cette taille, tailles
// croissantes ; les personnes sans appartenance ne forment pas de groupe.
function profil(participants) {
  const tailles = new Map();
  for (const { appartenance } of participants) {
    if (appartenance !== null) tailles.set(appartenance, (tailles.get(appartenance) ?? 0) + 1);
  }
  const groupesParTaille = new Map();
  for (const taille of tailles.values()) groupesParTaille.set(taille, (groupesParTaille.get(taille) ?? 0) + 1);
  return [...groupesParTaille].sort((a, b) => a[0] - b[0]);
}

// Les fichiers livrés, tous ; lève quand il n'y en a aucun (§ 14.2).
function balayer() {
  assert.ok(LIVREES.length > 0, 'aucun fichier livré examiné');
  return LIVREES;
}

// Aller-retour d'un fichier livré (§ 8.9) : charger — analyser, puis
// contrôler les placements, qui n'écartent ni ne signalent rien —,
// enregistrer sous une autre construction et à la révision suivante,
// recharger. Rend la charge chargée, la charge rechargée, et le texte que
// l'enregistrement écrirait sous l'en-tête lu.
function allerRetour(texte) {
  const lu = analyser(texte);
  const { charge, fautives, derives } = examiner(lu.charge);
  assert.deepEqual([fautives, derives], [[], []]);
  const enregistre = serialiser(charge, {
    revision: lu.entete.revision + 1,
    produitVersion: versionVoisine(VERSION.affichee),
  });
  const relu = analyser(enregistre);
  assert.notEqual(relu.entete.revision, lu.entete.revision);
  return { charge, relue: relu.charge, sousLEnteteLu: serialiser(charge, lu.entete) };
}

describe('démonstrations livrées : empreinte (§ 15.5, point 5)', () => {
  test("pour chaque entrée du catalogue, la charge que rejoue le script a l'empreinte du fichier livré", () => {
    assert.ok(CATALOGUE.length > 0, 'catalogue vide');
    for (const entree of CATALOGUE) {
      const livree = analyser(texteLivre(entree.cle)).charge;
      const rejouee = analyser(texteDeDemonstration(entree)).charge;
      memeEmpreinte(livree, rejouee, entree.cle);
    }
  });

  test("un changement de produitVersion seul ne change pas l'empreinte : elle porte sur la charge, l'en-tête exclu", () => {
    const voisine = versionVoisine(VERSION.affichee);
    for (const entree of CATALOGUE) {
      const texteIci = texteDeDemonstration(entree);
      const texteAilleurs = texteDeDemonstration(entree, { produitVersion: voisine });
      assert.notEqual(texteAilleurs, texteIci, entree.cle);
      const ailleurs = analyser(texteAilleurs);
      assert.equal(ailleurs.entete.produitVersion, voisine, entree.cle);
      assert.equal(empreinte(ailleurs.charge), empreinte(analyser(texteIci).charge), entree.cle);
      memeEmpreinte(analyser(texteLivre(entree.cle)).charge, ailleurs.charge, entree.cle);
    }
  });

  test("l'empreinte : 64 chiffres hexadécimaux, une par charge — les quatre démonstrations en ont quatre", () => {
    const empreintes = balayer().map(({ texte }) => empreinte(analyser(texte).charge));
    assert.ok(empreintes.every((valeur) => EMPREINTE.test(valeur)), empreintes.join(' '));
    assert.equal(new Set(empreintes).size, empreintes.length);
  });

  test("l'échec nomme les chemins qui diffèrent, jamais seulement deux empreintes", () => {
    const livree = analyser(texteLivre('petite')).charge;
    const rejouee = structuredClone(livree);
    rejouee.participants.find(({ id }) => id === 7).nom = 'Lanterneau';
    rejouee.tables.find(({ id }) => id === 3).position.x += 1;
    assert.notEqual(empreinte(rejouee), empreinte(livree));
    assert.throws(
      () => memeEmpreinte(livree, rejouee, 'petite'),
      (erreur) => {
        assert.match(erreur.message, /^petite : /);
        assert.match(erreur.message, /poser participants\[id=7\]\.nom ; poser tables\[id=3\]\.position\.x\./);
        assert.doesNotMatch(erreur.message, /[0-9a-f]{64}/);
        return true;
      },
    );
  });
});

describe("démonstrations livrées : profil d'appartenances (§ 15.2)", () => {
  test("les tailles d'appartenance lues dans chaque fichier livré égalent celles du générateur", () => {
    for (const entree of CATALOGUE) {
      const attendu = profil(analyser(texteLivre(entree.cle)).charge.participants);
      assert.ok(attendu.length > 0, entree.cle);
      assert.deepEqual(profil(entree.construire().participants), attendu, entree.cle);
    }
  });

  test('le profil compte les groupes par taille, sans les personnes sans appartenance', () => {
    const personne = (id, appartenance) => ({ id, appartenance });
    assert.deepEqual(
      profil([
        personne(1, 'Chœur de l\u{2019}Anse'),
        personne(2, 'Cercle des Saules'),
        personne(3, 'Chœur de l\u{2019}Anse'),
        personne(4, null),
        personne(5, 'Société des Hérons'),
      ]),
      [[1, 2], [2, 1]],
    );
  });
});

describe('démonstrations livrées : aller-retour sur chacune, grande comprise (§ 8.9)', () => {
  test("charger, enregistrer, recharger rend la même charge ; le texte livré est celui qu'écrit le sérialiseur", () => {
    const examines = balayer();
    for (const { cle, texte } of examines) {
      const { charge, relue, sousLEnteteLu } = allerRetour(texte);
      assert.deepEqual(relue, charge, cle);
      assert.equal(sousLEnteteLu, texte, cle);
    }
    assert.ok(examines.some(({ cle }) => cle === 'grande'), 'la grande démonstration non examinée');
  });
});
