// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du texte du plan (§ 7.4, § 14.1) : la troncature avec marque, le
// repli d'un libellé de table en lignes, et les décalages des lignes d'une
// liste. La mesure est injectée : ici, une
// somme de largeurs par glyphe écrites dans l'épreuve, où le glyphe large
// coûte plus que la moyenne ; au navigateur, getComputedTextLength.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { GABARIT_HAUTEUR_LIGNE, TAILLE_TEXTE_LISTE_CM, decalagesLignes, replier, tronquer } from './texte.js';

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

describe('texte : le repli en lignes, puis la troncature (§ 7.4)', () => {
  test('un texte qui tient dans la première ligne y reste entier ; un texte vide ou fait de blancs ne rend aucune ligne', () => {
    assert.deepEqual(replier('Ombrelle', [48, 48], mesurer, MARQUE), ['Ombrelle']);
    assert.deepEqual(replier('', [48], mesurer, MARQUE), []);
    assert.deepEqual(replier('  \u{0009} ', [48], mesurer, MARQUE), []);
    assert.deepEqual(replier('Ombrelle', [], mesurer, MARQUE), []);
  });

  test('le texte se replie entre les mots, chaque ligne aussi pleine que sa largeur le permet, les blancs réduits à une espace', () => {
    // Iris 4 glyphes de 6, sauf le i à 3 : 6 + 6 + 3 + 6 = 21 ; une espace 6.
    assert.equal(mesurer('Iris'), 21);
    assert.deepEqual(replier('Iris Ombrelle Pervenche', [80, 80], mesurer, MARQUE), ['Iris Ombrelle', 'Pervenche']);
    assert.deepEqual(replier('Iris Ombrelle Pervenche', [50, 60, 60], mesurer, MARQUE), ['Iris', 'Ombrelle', 'Pervenche']);
    assert.deepEqual(replier('  Iris \u{0009}  Ombrelle  ', [200], mesurer, MARQUE), ['Iris Ombrelle']);
    // Chaque ligne a sa largeur : la deuxième, plus large, prend deux mots.
    assert.deepEqual(replier('Iris Iris Iris Iris', [30, 70, 30], mesurer, MARQUE), ['Iris', 'Iris Iris', 'Iris']);
  });

  test('un mot plus large que sa ligne se coupe entre deux caractères, et sa suite ouvre la ligne suivante', () => {
    assert.deepEqual(replier('WWWWWWWWWW', [30, 30, 100], mesurer, MARQUE), ['WWW', 'WWW', 'WWWW']);
    assert.deepEqual(replier('Iris WWWWWWWW', [30, 50, 100], mesurer, MARQUE), ['Iris', 'WWWWW', 'WWW']);
  });

  test('quand le texte ne tient pas dans les lignes, la dernière s\u{2019}abrège, suivie de la marque, sans espace devant elle', () => {
    assert.deepEqual(replier('Iris Ombrelle Pervenche', [50, 50], mesurer, MARQUE), ['Iris', 'Ombrell\u{2026}']);
    assert.deepEqual(replier('WWWWWWWWWW', [30, 30], mesurer, MARQUE), ['WWW', 'WW\u{2026}']);
    // Le préfixe qui tient finit sur l'espace entre deux mots : elle tombe.
    assert.equal(mesurer('Iris \u{2026}'), 33);
    assert.deepEqual(replier('Iris Ombrelle', [34], mesurer, MARQUE), ['Iris\u{2026}']);
    // La marque qui ne tient pas dans la dernière ligne la fait tomber.
    assert.deepEqual(replier('Iris Ombrelle', [30, 4], mesurer, MARQUE), ['Iris']);
    // Une ligne trop étroite pour un seul caractère tient lieu de dernière :
    // le texte s'y abrège, ou s'arrête quand la marque n'y tient pas.
    assert.deepEqual(replier('WWW', [5, 100], mesurer, MARQUE), []);
    assert.deepEqual(replier('WWW', [7, 100], mesurer, MARQUE), ['\u{2026}']);
    assert.deepEqual(replier('Iris WWW', [30, 7, 100], mesurer, MARQUE), ['Iris', '\u{2026}']);
  });

  test('une coupe ne tombe jamais entre les deux moitiés d\u{2019}une paire de substitution, ni devant une marque combinante, ni de part et d\u{2019}autre d\u{2019}un liant sans chasse', () => {
    const paires = '\u{1D49C}'.repeat(8);
    const combine = 'e\u{0301}'.repeat(8);
    const liees = '\u{1F469}\u{200D}\u{1F4BB}'.repeat(4);
    let comptes = 0;
    for (const texte of [paires, `Iris ${paires}`, combine, `${combine} Iris`, liees]) {
      for (let largeur = 0; largeur <= 40; largeur += 1) {
        for (const largeurs of [[largeur], [largeur, largeur], [largeur, largeur, 200]]) {
          const lignes = replier(texte, largeurs, mesurer, MARQUE);
          for (const ligne of lignes) {
            assert.ok(ligne.isWellFormed(), `${JSON.stringify(texte)} dans ${largeurs} : ${JSON.stringify(lignes)}`);
            assert.ok(!/^\p{M}/u.test(ligne), `${JSON.stringify(texte)} dans ${largeurs} : ${JSON.stringify(lignes)}`);
            assert.ok(!/^\u{200D}|\u{200D}$/u.test(ligne), `${JSON.stringify(texte)} dans ${largeurs} : ${JSON.stringify(lignes)}`);
          }
          comptes += 1;
        }
      }
    }
    assert.equal(comptes, 5 * 41 * 3);
    assert.deepEqual(replier(paires, [12, 12, 200], mesurer, MARQUE), ['\u{1D49C}\u{1D49C}', '\u{1D49C}\u{1D49C}', '\u{1D49C}'.repeat(4)]);
  });

  test('chaque ligne tient dans sa largeur, au plus une ligne par largeur ; hors de la marque, les lignes rendent le texte dans l\u{2019}ordre', () => {
    const textes = ['Table d\u{2019}honneur des invités', 'WWWWWWWWWWWWWWWWWWWW', 'Æ Æ Æ ÆÆÆÆÆÆ iii W', 'Ondine \u{1D49C}\u{1D49C}\u{1D49C} Lacasse', 'x'.repeat(60)];
    let comptes = 0;
    for (const texte of textes) {
      const mots = texte.split(' ').join('');
      for (let largeur = 6; largeur <= 90; largeur += 3) {
        const largeurs = [largeur, largeur + 12, largeur];
        const lignes = replier(texte, largeurs, mesurer, MARQUE);
        assert.ok(lignes.length <= largeurs.length, `${texte} dans ${largeurs}`);
        lignes.forEach((ligne, rang) => {
          assert.ok(mesurer(ligne) <= largeurs[rang], `${texte} dans ${largeurs} : ${JSON.stringify(lignes)}`);
          assert.ok(ligne === ligne.trim() && !ligne.includes('  '), `${texte} dans ${largeurs} : ${JSON.stringify(lignes)}`);
        });
        const abregee = lignes.length > 0 && lignes.at(-1).endsWith(MARQUE);
        const sansMarque = lignes.map((ligne, rang) => (abregee && rang === lignes.length - 1 ? ligne.slice(0, -MARQUE.length) : ligne));
        const lu = sansMarque.join('').split(' ').join('');
        if (abregee) assert.ok(mots.startsWith(lu) && lu.length < mots.length, `${texte} dans ${largeurs} : ${JSON.stringify(lignes)}`);
        else assert.equal(lu, mots, `${texte} dans ${largeurs} : ${JSON.stringify(lignes)}`);
        comptes += 1;
      }
    }
    assert.equal(comptes, 5 * 29);
  });
});
