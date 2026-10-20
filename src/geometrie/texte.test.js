// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du texte du plan (§ 7.4, § 14.1) : la troncature avec marque et
// les décalages des lignes d'une liste. La mesure est injectée : ici, une
// somme de largeurs par glyphe écrites dans l'épreuve, où le glyphe large
// coûte plus que la moyenne ; au navigateur, getComputedTextLength.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { GABARIT_HAUTEUR_LIGNE, TAILLE_TEXTE_LISTE_CM, decalagesLignes, tronquer } from './texte.js';

const MARQUE = '…';

// Largeur d'un glyphe : W 10, Æ 11, i 3, la marque 6, tout autre 6. Une
// moitié de paire de substitution isolée ne dessine rien de mesurable et
// compte 0 : une coupe au milieu d'une paire paraîtrait tenir.
const LARGEURS = new Map([['W', 10], ['Æ', 11], ['i', 3], [MARQUE, 6]]);
const MOITIE = /^[\u{D800}-\u{DFFF}]$/u;
const mesurer = (chaine) =>
  [...chaine].reduce((somme, glyphe) => somme + (MOITIE.test(glyphe) ? 0 : (LARGEURS.get(glyphe) ?? 6)), 0);

// Une moitié de paire de substitution isolée, n'importe où dans la chaîne.
const MOITIE_ISOLEE = /[\u{D800}-\u{DFFF}]/u;

describe('texte : la troncature (§ 7.4, § 14.1)', () => {
  test('un texte qui tient reste entier ; sinon le plus long préfixe qui, suivi de la marque, tient', () => {
    assert.equal(mesurer('Ombrelle'), 48);
    assert.equal(tronquer('Ombrelle', 60, mesurer, MARQUE), 'Ombrelle');
    assert.equal(tronquer('Ombrelle', 48, mesurer, MARQUE), 'Ombrelle');
    assert.equal(tronquer('WWWWWWWW', 60, mesurer, MARQUE), 'WWWWW…');
    assert.equal(mesurer('WWWWW…'), 56);
    assert.equal(tronquer('ÆÆÆÆÆÆ', 40, mesurer, MARQUE), 'ÆÆÆ…');
    assert.equal(tronquer('Ombrelle', 47, mesurer, MARQUE), 'Ombrel…');
  });

  test("la marque seule qui ne tient pas rend '' ; un texte entier qui tient sans marque reste ; '' reste ''", () => {
    assert.equal(tronquer('Ombrelle', 4, mesurer, MARQUE), '');
    assert.equal(tronquer('i', 4, mesurer, MARQUE), 'i');
    assert.equal(tronquer('', 0, mesurer, MARQUE), '');
    assert.equal(tronquer('', 100, mesurer, MARQUE), '');
    assert.equal(tronquer('Ombrelle', 6, mesurer, MARQUE), '…');
  });

  test("une lettre hors du plan de base n'est jamais coupée entre ses deux unités UTF-16", () => {
    const texte = '\u{1D49C}\u{1D49C}\u{1D49C}\u{1D49C}';
    assert.equal(texte.length, 8);
    assert.equal(tronquer(texte, 20, mesurer, MARQUE), '\u{1D49C}\u{1D49C}…');
    let comptes = 0;
    for (let largeur = 0; largeur <= 30; largeur += 1) {
      const rendu = tronquer(texte, largeur, mesurer, MARQUE);
      assert.ok(!MOITIE_ISOLEE.test(rendu), `largeur ${largeur} : ${JSON.stringify(rendu)}`);
      comptes += 1;
    }
    assert.equal(comptes, 31);
    assert.equal(tronquer('Iris \u{1D49C}mbrelle', 44, mesurer, MARQUE), 'Iris \u{1D49C}…');
  });

  test('le résultat ne dépasse jamais la largeur, et garde le plus long préfixe admis', () => {
    const textes = ['Théo Pervenche', 'WWWWWWWWWWWW', 'ÆÆÆÆ iii WWW', 'Ondine Lacasse \u{1D49C}\u{1D49C} Grisaille', 'Ôjgq', 'x'.repeat(200)];
    let comptes = 0;
    for (const texte of textes) {
      for (let largeur = 0; largeur <= 130; largeur += 1) {
        const rendu = tronquer(texte, largeur, mesurer, MARQUE);
        assert.ok(mesurer(rendu) <= largeur, `${texte} dans ${largeur} : ${rendu}`);
        if (rendu !== texte && rendu !== '') {
          // Le préfixe d'un glyphe de plus, suivi de la marque, ne tiendrait pas.
          const prefixe = [...rendu.slice(0, -MARQUE.length)];
          const suivant = [...texte][prefixe.length];
          assert.ok(texte.startsWith(prefixe.join('')), `${texte} dans ${largeur}`);
          assert.ok(mesurer(prefixe.join('') + suivant + MARQUE) > largeur, `${texte} dans ${largeur} : ${rendu}`);
        }
        comptes += 1;
      }
    }
    assert.equal(comptes, 6 * 131);
  });
});

describe("texte : les lignes d'une liste (§ 7.4)", () => {
  test('les ordonnées des n lignes partent de 0 et avancent de la hauteur de ligne', () => {
    assert.deepEqual(decalagesLignes(3, 21.5), [0, 21.5, 43]);
    assert.deepEqual(decalagesLignes(1, 21.5), [0]);
    assert.deepEqual(decalagesLignes(0, 21.5), []);
    assert.throws(() => decalagesLignes(-1, 21.5), RangeError);
    assert.throws(() => decalagesLignes(1.5, 21.5), RangeError);
  });

  test('le gabarit de hauteur porte capitales accentuées et jambages ; le corps des listes vaut 18 cm', () => {
    assert.equal(GABARIT_HAUTEUR_LIGNE, 'Ôjgq Æ W');
    assert.equal(TAILLE_TEXTE_LISTE_CM, 18);
  });
});
