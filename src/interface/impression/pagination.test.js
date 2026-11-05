// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La pagination des listes imprimées (§ 11.7), sans DOM : des hauteurs
// mesurées, la hauteur utile d'une page et celle de l'en-tête que chaque
// page répète, et les pages qu'elles donnent — aux bords exacts, une ligne
// plus haute qu'une page, une liste vide, plusieurs feuilles bout à bout,
// une ligne liée qui ne finit pas une page ; le texte d'une ligne plus haute
// qu'une page coupé en morceaux qui tiennent chacun sur une page, entre les
// mots, et ses pages de suite.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { couperTexte, hauteurDuMorceau, mesurerPlace, morcelerPages, paginer, paginerFeuilles, trancher } from './pagination.js';

describe('paginer : les lignes d’une liste en pages', () => {
  test('une somme exactement égale à la hauteur utile, en-tête compris, tient sur une page ; + 0,01 en donne deux', () => {
    const options = { hauteurUtile: 100, hauteurEntete: 10 };
    assert.deepEqual(paginer([25.5, 30.25, 34.25], options), [{ debut: 0, fin: 3, seule: false }]);
    assert.deepEqual(paginer([25.5, 30.25, 34.26], options), [
      { debut: 0, fin: 2, seule: false },
      { debut: 2, fin: 3, seule: false },
    ]);
  });

  test('le bruit de l’arithmétique flottante ne pousse pas une ligne sur la page suivante : 0,1 + 0,2 tient dans 0,3', () => {
    assert.ok(0.1 + 0.2 > 0.3);
    assert.deepEqual(paginer([0.1, 0.2], { hauteurUtile: 0.3, hauteurEntete: 0 }), [{ debut: 0, fin: 2, seule: false }]);
  });

  test('l’en-tête se répète sur chaque page : chacune le retranche de sa hauteur utile', () => {
    const pages = paginer([30, 30, 30, 30, 30, 30, 30], { hauteurUtile: 100, hauteurEntete: 10 });
    assert.deepEqual(pages, [
      { debut: 0, fin: 3, seule: false },
      { debut: 3, fin: 6, seule: false },
      { debut: 6, fin: 7, seule: false },
    ]);
    // Sans en-tête, trois lignes de 30 laissent la place d'une quatrième de 10.
    assert.deepEqual(paginer([30, 30, 30, 10], { hauteurUtile: 100, hauteurEntete: 0 }), [{ debut: 0, fin: 4, seule: false }]);
    assert.deepEqual(paginer([30, 30, 30, 10], { hauteurUtile: 100, hauteurEntete: 10 }), [
      { debut: 0, fin: 3, seule: false },
      { debut: 3, fin: 4, seule: false },
    ]);
    // La deuxième page retranche aussi l'en-tête : deux lignes de 50 n'y
    // tiennent pas ensemble, quand elles rempliraient une page sans lui.
    assert.deepEqual(paginer([45, 45, 50, 50], { hauteurUtile: 100, hauteurEntete: 10 }), [
      { debut: 0, fin: 2, seule: false },
      { debut: 2, fin: 3, seule: false },
      { debut: 3, fin: 4, seule: false },
    ]);
  });

  test('une ligne plus haute qu’une page est seule sur la sienne, et seule à porter seule vrai', () => {
    const pages = paginer([20, 95, 20, 20], { hauteurUtile: 100, hauteurEntete: 10 });
    assert.deepEqual(pages, [
      { debut: 0, fin: 1, seule: false },
      { debut: 1, fin: 2, seule: true },
      { debut: 2, fin: 4, seule: false },
    ]);
    // Une ligne qui tient juste n'est pas signalée, même seule sur sa page.
    assert.deepEqual(paginer([20, 90], { hauteurUtile: 100, hauteurEntete: 10 }), [
      { debut: 0, fin: 1, seule: false },
      { debut: 1, fin: 2, seule: false },
    ]);
    assert.deepEqual(paginer([200], { hauteurUtile: 100, hauteurEntete: 10 }), [{ debut: 0, fin: 1, seule: true }]);
  });

  test('une liste vide donne une page, son en-tête seul ; une ligne, une page', () => {
    assert.deepEqual(paginer([], { hauteurUtile: 100, hauteurEntete: 10 }), [{ debut: 0, fin: 0, seule: false }]);
    assert.deepEqual(paginer([5], { hauteurUtile: 100, hauteurEntete: 10 }), [{ debut: 0, fin: 1, seule: false }]);
  });

  test('chaque ligne est sur une page et une seule, dans l’ordre, et aucune page ne dépasse sa hauteur utile', () => {
    const hauteurs = Array.from({ length: 257 }, (_, i) => 4 + ((i * 7) % 11));
    const options = { hauteurUtile: 120, hauteurEntete: 13 };
    const pages = paginer(hauteurs, options);
    assert.equal(pages[0].debut, 0);
    assert.equal(pages.at(-1).fin, hauteurs.length);
    for (let i = 1; i < pages.length; i += 1) assert.equal(pages[i].debut, pages[i - 1].fin);
    for (const { debut, fin } of pages) {
      const somme = hauteurs.slice(debut, fin).reduce((a, b) => a + b, options.hauteurEntete);
      assert.ok(somme <= options.hauteurUtile, `${debut}..${fin} : ${somme}`);
      // La ligne suivante n'y tenait pas.
      if (fin < hauteurs.length) assert.ok(somme + hauteurs[fin] > options.hauteurUtile, `${debut}..${fin} pouvait prendre ${fin}`);
    }
  });

  test('des hauteurs ou des options hors de leur domaine lèvent RangeError ; un en-tête qui remplit la page aussi', () => {
    const options = { hauteurUtile: 100, hauteurEntete: 10 };
    for (const hauteurs of [[-1], [Number.NaN], [Number.POSITIVE_INFINITY], ['3']]) {
      assert.throws(() => paginer(hauteurs, options), RangeError, JSON.stringify(hauteurs));
    }
    assert.throws(() => paginer('abc', options), TypeError);
    for (const fautives of [{ hauteurUtile: 0, hauteurEntete: 0 }, { hauteurUtile: 100, hauteurEntete: -1 }, { hauteurUtile: 100, hauteurEntete: 100 }, { hauteurUtile: Number.NaN, hauteurEntete: 0 }]) {
      assert.throws(() => paginer([1], fautives), RangeError, JSON.stringify(fautives));
    }
  });
});

describe('paginer : une ligne liée à la suivante ne finit pas une page', () => {
  const options = { hauteurUtile: 100, hauteurEntete: 10 };

  test('une ligne liée qui finirait la page passe sur la suivante avec la ligne qui la suit', () => {
    assert.deepEqual(paginer([30, 30, 20, 30], options), [
      { debut: 0, fin: 3, seule: false },
      { debut: 3, fin: 4, seule: false },
    ]);
    assert.deepEqual(paginer([30, 30, 20, 30], { ...options, liees: [2] }), [
      { debut: 0, fin: 2, seule: false },
      { debut: 2, fin: 4, seule: false },
    ]);
    // Deux lignes liées de suite vont ensemble avec la ligne qui les suit.
    assert.deepEqual(paginer([30, 30, 5, 5, 30], { ...options, liees: [2, 3] }), [
      { debut: 0, fin: 2, seule: false },
      { debut: 2, fin: 5, seule: false },
    ]);
  });

  test('une ligne liée que sa suivante accompagne sur la page, ou que rien ne suit, ne change rien', () => {
    assert.deepEqual(paginer([20, 20, 20, 20], { ...options, liees: [0, 2] }), [{ debut: 0, fin: 4, seule: false }]);
    assert.deepEqual(paginer([30, 30, 25, 5], { ...options, liees: [3] }), [{ debut: 0, fin: 4, seule: false }]);
    assert.deepEqual(paginer([30, 30, 30, 20], { ...options, liees: [3] }), [
      { debut: 0, fin: 3, seule: false },
      { debut: 3, fin: 4, seule: false },
    ]);
  });

  test('une ligne liée en tête de page reste sur la sienne : la ligne qui la suit, plus haute que ce qu’elle laisse, y est coupée, seule vrai', () => {
    // La ligne de 85 tiendrait seule sous l'en-tête, pas sous sa ligne liée :
    // elle se coupe sous elle plutôt que de l'abandonner en bas de page.
    assert.deepEqual(paginer([20, 10, 85, 20], { ...options, liees: [1] }), [
      { debut: 0, fin: 1, seule: false },
      { debut: 1, fin: 3, seule: true },
      { debut: 3, fin: 4, seule: false },
    ]);
    assert.deepEqual(paginer([10, 300], { ...options, liees: [0] }), [{ debut: 0, fin: 2, seule: true }]);
  });

  test('une ligne liée plus haute qu’une page est seule sur la sienne, et la ligne qui la suit commence la suivante', () => {
    assert.deepEqual(paginer([20, 200, 20], { ...options, liees: [1] }), [
      { debut: 0, fin: 1, seule: false },
      { debut: 1, fin: 2, seule: true },
      { debut: 2, fin: 3, seule: false },
    ]);
  });

  test('chaque ligne sur une page et une seule ; une page ne finit sur une ligne liée que si elle finit la liste ou y est coupée', () => {
    const hauteurs = Array.from({ length: 311 }, (_, i) => (i % 37 === 5 ? 130 : 4 + ((i * 7) % 11)));
    const liees = hauteurs.map((_, i) => i).filter((i) => i % 5 === 0 || i % 37 === 4);
    const { hauteurUtile, hauteurEntete } = { hauteurUtile: 120, hauteurEntete: 13 };
    const pages = paginer(hauteurs, { hauteurUtile, hauteurEntete, liees });
    assert.equal(pages[0].debut, 0);
    assert.equal(pages.at(-1).fin, hauteurs.length);
    for (let i = 1; i < pages.length; i += 1) assert.equal(pages[i].debut, pages[i - 1].fin);
    for (const { debut, fin, seule } of pages) {
      const somme = hauteurs.slice(debut, fin).reduce((a, b) => a + b, hauteurEntete);
      assert.equal(seule, somme > hauteurUtile, `${debut}..${fin} : ${somme}`);
      // Sur une page coupée, seule la dernière ligne passe ce qui reste.
      if (seule) assert.ok(somme - hauteurs[fin - 1] <= hauteurUtile, `${debut}..${fin}`);
      if (fin < hauteurs.length && liees.includes(fin - 1)) assert.ok(seule, `${debut}..${fin} finit sur une ligne liée`);
    }
    assert.ok(pages.some(({ debut, fin, seule }) => seule && fin - debut > 1), 'une page coupée sous une ligne liée');
  });

  test('des lignes liées hors des rangs de la liste lèvent RangeError ; autre chose qu’une liste, TypeError', () => {
    for (const liees of [[-1], [3], [1.5], ['1']]) {
      assert.throws(() => paginer([1, 2, 3], { ...options, liees }), RangeError, JSON.stringify(liees));
    }
    assert.throws(() => paginer([1, 2, 3], { ...options, liees: 'abc' }), TypeError);
  });
});

describe('paginerFeuilles : plusieurs listes, chacune sur ses propres pages', () => {
  test('chaque feuille commence une page ; ses pages se suivent, son en-tête retranché de chacune', () => {
    const pages = paginerFeuilles(
      [
        { entete: 10, lignes: [30, 30, 30, 30] },
        { entete: 20, lignes: [] },
        { entete: 5, lignes: [50, 45] },
      ],
      100,
    );
    assert.deepEqual(pages, [
      { rang: 0, feuille: 0, debut: 0, fin: 3, seule: false },
      { rang: 1, feuille: 0, debut: 3, fin: 4, seule: false },
      { rang: 2, feuille: 1, debut: 0, fin: 0, seule: false },
      { rang: 3, feuille: 2, debut: 0, fin: 2, seule: false },
    ]);
  });

  test('les lignes liées de chaque feuille ne valent que pour elle', () => {
    const pages = paginerFeuilles(
      [
        { entete: 10, lignes: [30, 30, 20, 30], liees: [2] },
        { entete: 10, lignes: [30, 30, 20, 30] },
      ],
      100,
    );
    assert.deepEqual(pages, [
      { rang: 0, feuille: 0, debut: 0, fin: 2, seule: false },
      { rang: 1, feuille: 0, debut: 2, fin: 4, seule: false },
      { rang: 2, feuille: 1, debut: 0, fin: 3, seule: false },
      { rang: 3, feuille: 1, debut: 3, fin: 4, seule: false },
    ]);
  });

  test('aucune feuille, aucune page', () => {
    assert.deepEqual(paginerFeuilles([], 100), []);
  });
});

describe('mesurerPlace : la part de la largeur d’une liste que prend son plus large libellé de tour', () => {
  // Un élément réduit à sa boîte rendue, de la largeur donnée en px.
  const boite = (width) => ({ getBoundingClientRect: () => ({ width }) });

  test('la largeur de la sonde, plus un pixel d’arrondi, sur celle du tableau, en pour cent', () => {
    assert.equal(mesurerPlace(boite(79), boite(800)), 10);
    assert.equal(mesurerPlace(boite(0), boite(400)), 0.25);
  });

  test('un tableau sans largeur lève RangeError', () => {
    assert.throws(() => mesurerPlace(boite(10), boite(0)), RangeError);
  });
});

describe('trancher : la part de chaque fragment entre deux positions du texte mis bout à bout', () => {
  test('chaque fragment garde ce qui tombe entre debut et fin, le texte vide sinon', () => {
    const textes = ['Iris Ombrelle', 'hôte', ''];
    assert.deepEqual(trancher(textes, 0, 17), textes);
    assert.deepEqual(trancher(textes, 0, 5), ['Iris ', '', '']);
    assert.deepEqual(trancher(textes, 5, 15), ['Ombrelle', 'hô', '']);
    assert.deepEqual(trancher(textes, 13, 17), ['', 'hôte', '']);
    assert.deepEqual(trancher(textes, 17, 17), ['', '', '']);
  });

  test('des positions hors du texte ou dans le désordre lèvent RangeError ; des fragments qui ne sont pas des textes, TypeError', () => {
    for (const [debut, fin] of [[-1, 3], [3, 2], [0, 18], [0.5, 2], [Number.NaN, 2]]) {
      assert.throws(() => trancher(['Iris Ombrelle', 'hôte'], debut, fin), RangeError, `${debut}..${fin}`);
    }
    assert.throws(() => trancher('Iris', 0, 1), TypeError);
    assert.throws(() => trancher(['Iris', null], 0, 1), TypeError);
  });
});

describe('couperTexte : les bornes des morceaux d’un texte trop haut pour une page', () => {
  // Un prédicat qui tient tout morceau d'au plus n unités, et le relevé de
  // ses appels.
  function auPlus(n) {
    const appels = [];
    const tient = (debut, fin) => {
      appels.push([debut, fin]);
      return fin - debut <= n;
    };
    return { tient, appels };
  }

  test('un texte qui tient d’un bloc donne un seul morceau', () => {
    assert.deepEqual(couperTexte(['Iris Ombrelle', 'hôte'], () => true), [0, 17]);
  });

  test('les morceaux se coupent au début d’un mot, le plus long qui tient ; le dernier finit le texte', () => {
    const { tient } = auPlus(20);
    const textes = ['Ombrelle Pervenche Ombrelle Pervenche'];
    const bornes = couperTexte(textes, tient);
    assert.deepEqual(bornes, [0, 19, 37]);
    assert.deepEqual(
      bornes.slice(1).map((fin, rang) => trancher(textes, bornes[rang], fin)[0]),
      ['Ombrelle Pervenche ', 'Ombrelle Pervenche'],
    );
  });

  test('le début d’un fragment est une coupe : le titre passe entier sur la page suivante', () => {
    assert.deepEqual(couperTexte(['Iris Ombrelle', 'hôte'], auPlus(13).tient), [0, 13, 17]);
  });

  test('un mot plus long qu’une page se coupe entre deux caractères : jamais avant un accent combinant, dans un caractère ou après un liant', () => {
    assert.deepEqual(couperTexte(['Ombrelle'.repeat(5)], auPlus(15).tient), [0, 15, 30, 40]);
    // Dix e à accent combinant, deux unités chacun : une coupe à 5 tomberait
    // entre la lettre et sa marque.
    assert.deepEqual(couperTexte(['e\u{301}'.repeat(10)], auPlus(5).tient), [0, 4, 8, 12, 16, 20]);
    // Un caractère hors du plan de base, deux unités UTF-16.
    assert.deepEqual(couperTexte(['\u{1F33C}'.repeat(3)], auPlus(3).tient), [0, 2, 4, 6]);
    // Deux suites liées par U+200D, cinq unités chacune, plus longues que le
    // morceau : chacune reste entière, ni coupée avant le liant ni après.
    assert.deepEqual(couperTexte(['\u{1F33C}\u{200D}\u{1F33C}'.repeat(2)], auPlus(4).tient), [0, 5, 10]);
  });

  test('un mot coupé reprend aux mots : la coupe revient au début du mot suivant dès qu’elle tient', () => {
    // « OmbrelleOmbrelle » passe la page de 10 : coupé à 10 ; le morceau
    // suivant finit au début de « Pervenche ».
    assert.deepEqual(couperTexte(['OmbrelleOmbrelle Pervenche'], auPlus(10).tient), [0, 10, 17, 26]);
  });

  test('seul un blanc sécable ouvre un mot : un morceau ne finit jamais sur une insécable, devant « : » ou « ? »', () => {
    // « Ombrelle Pervenche » puis l'insécable et le signe : la page de 20
    // tiendrait « Ombrelle Pervenche » et l'insécable ; le signe resterait
    // seul en tête de la page suivante. Le mot va avec son signe.
    assert.deepEqual(couperTexte(['Ombrelle Pervenche\u{00A0}: Lys'], auPlus(20).tient), [0, 9, 24]);
    assert.deepEqual(couperTexte(['Ombrelle Pervenche\u{202F}? Lys'], auPlus(20).tient), [0, 9, 24]);
    // Après « et son insécable, le mot cité reste avec le guillemet.
    assert.deepEqual(couperTexte(['Ombrelle «\u{00A0}Pervenche'], auPlus(12).tient), [0, 9, 20]);
    // La tabulation et le saut de ligne restent des blancs sécables.
    assert.deepEqual(couperTexte(['Ombrelle\tPervenche\nLys'], auPlus(10).tient), [0, 9, 19, 22]);
  });

  test('rien ne tient : chaque morceau prend un caractère, le texte avance toujours', () => {
    assert.deepEqual(couperTexte(['abc'], () => false), [0, 1, 2, 3]);
  });

  test('la recherche est dichotomique : quelques sondes par morceau, non une par mot', () => {
    const { tient, appels } = auPlus(200);
    const texte = 'Ombrelle Pervenche '.repeat(1500).trim();
    const bornes = couperTexte([texte], tient);
    assert.equal(bornes[0], 0);
    assert.equal(bornes.at(-1), texte.length);
    assert.ok(bornes.length - 1 >= Math.ceil(texte.length / 200));
    for (let rang = 1; rang < bornes.length; rang += 1) {
      assert.ok(bornes[rang] - bornes[rang - 1] <= 200, `morceau ${rang}`);
      // Chaque coupe tombe au début d'un mot, et le mot suivant n'y tenait pas.
      if (rang < bornes.length - 1) {
        assert.match(texte.slice(bornes[rang]), /^Ombrelle|^Pervenche/, `coupe ${rang}`);
        const suivant = texte.indexOf(' ', bornes[rang]) + 1;
        assert.ok(suivant - bornes[rang - 1] > 200, `coupe ${rang} : le mot suivant tenait`);
      }
    }
    assert.ok(appels.length <= 20 * (bornes.length - 1), `${appels.length} sondes pour ${bornes.length - 1} morceaux`);
  });

  test('un texte vide donne un seul morceau vide ; des fragments qui ne sont pas des textes lèvent TypeError', () => {
    assert.deepEqual(couperTexte(['', ''], () => false), [0, 0]);
    assert.throws(() => couperTexte([3], () => true), TypeError);
    assert.throws(() => couperTexte(['Iris'], null), TypeError);
  });
});

describe('morcelerPages : une ligne seule, continuée sur autant de pages que de morceaux', () => {
  test('chaque morceau d’une ligne seule prend une page, sous le même rang de ligne ; les autres pages restent, renumérotées', () => {
    const pages = paginerFeuilles(
      [
        { entete: 10, lignes: [20, 300, 20] },
        { entete: 10, lignes: [300] },
      ],
      100,
    );
    assert.deepEqual(morcelerPages(pages, [{ feuille: 0, ligne: 1, bornes: [0, 40, 80, 95] }]), [
      { rang: 0, feuille: 0, debut: 0, fin: 1, seule: false, morceau: null },
      { rang: 1, feuille: 0, debut: 1, fin: 2, seule: true, morceau: { debut: 0, fin: 40 } },
      { rang: 2, feuille: 0, debut: 1, fin: 2, seule: true, morceau: { debut: 40, fin: 80 } },
      { rang: 3, feuille: 0, debut: 1, fin: 2, seule: true, morceau: { debut: 80, fin: 95 } },
      { rang: 4, feuille: 0, debut: 2, fin: 3, seule: false, morceau: null },
      { rang: 5, feuille: 1, debut: 0, fin: 1, seule: true, morceau: null },
    ]);
  });

  test('une page coupée sous une ligne liée : la coupure vise sa dernière ligne, et chaque morceau garde la page entière, la ligne liée répétée', () => {
    const pages = paginerFeuilles([{ entete: 10, lignes: [20, 10, 300], liees: [1] }], 100);
    assert.deepEqual(morcelerPages(pages, [{ feuille: 0, ligne: 2, bornes: [0, 40, 95] }]), [
      { rang: 0, feuille: 0, debut: 0, fin: 1, seule: false, morceau: null },
      { rang: 1, feuille: 0, debut: 1, fin: 3, seule: true, morceau: { debut: 0, fin: 40 } },
      { rang: 2, feuille: 0, debut: 1, fin: 3, seule: true, morceau: { debut: 40, fin: 95 } },
    ]);
    // Une coupure de la ligne liée, qui n'est pas la dernière, ne change rien.
    assert.deepEqual(
      morcelerPages(pages, [{ feuille: 0, ligne: 1, bornes: [0, 4, 9] }]),
      pages.map((page) => ({ ...page, morceau: null })),
    );
  });

  test('hauteurDuMorceau : la hauteur utile, moins l’en-tête et les lignes liées qui précèdent la ligne coupée', () => {
    const feuille = { entete: 10, lignes: [20, 7, 5, 300] };
    assert.equal(hauteurDuMorceau(feuille, { debut: 1, fin: 4 }, 100), 78);
    assert.equal(hauteurDuMorceau(feuille, { debut: 3, fin: 4 }, 100), 90);
  });

  test('sans coupure, ou d’un seul morceau, une ligne seule garde sa page ; une coupure d’une ligne qui n’est pas seule ne change rien', () => {
    const pages = paginerFeuilles([{ entete: 10, lignes: [20, 300] }], 100);
    const attendues = pages.map((page) => ({ ...page, morceau: null }));
    assert.deepEqual(morcelerPages(pages, []), attendues);
    assert.deepEqual(morcelerPages(pages, [{ feuille: 0, ligne: 1, bornes: [0, 95] }]), attendues);
    assert.deepEqual(morcelerPages(pages, [{ feuille: 0, ligne: 0, bornes: [0, 5, 9] }]), attendues);
  });

  test('des bornes qui ne partent pas de 0 ou ne croissent pas lèvent RangeError', () => {
    const pages = paginerFeuilles([{ entete: 10, lignes: [300] }], 100);
    for (const bornes of [[1, 5], [0, 5, 5], [0, 7, 3], [], [0, 2.5]]) {
      assert.throws(() => morcelerPages(pages, [{ feuille: 0, ligne: 0, bornes }]), RangeError, JSON.stringify(bornes));
    }
  });
});
