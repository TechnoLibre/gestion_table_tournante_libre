// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la mise en forme (§ 5.4, § 5.10, § 11.7, § 18.4) : les valeurs
// du contrat, exactement ; « — » pour une valeur absente, jamais « 0 » ; un
// nombre non fini lève ; l'échelle des ordres de grandeur et ses frontières ;
// en langue témoin, un texte qui porte une lettre est encadré de la marque.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerFormat } from './format.js';
import { TABLES_APPLICATION } from './libelles.js';
import { MARQUE_TEMOIN, creerTraduction } from './traduction.js';

const { ouverture: O, fermeture: F } = MARQUE_TEMOIN;
const FINE = '\u{202F}';

const francais = creerTraduction(TABLES_APPLICATION);
const format = creerFormat(francais.t);
const temoin = creerFormat(creerTraduction(TABLES_APPLICATION, { langue: 'temoin' }).t);

describe('format : les nombres (§ 5.4, § 11.7)', () => {
  test('les valeurs du contrat : « — » pour null, espace fine insécable entre les milliers, virgule décimale', () => {
    assert.equal(format.nombre(null), '\u{2014}');
    assert.equal(format.nombre(null), francais.t('format.vide'));
    assert.equal(format.nombre(1234.5, { decimales: 1 }), `1${FINE}234,5`);
    assert.equal(format.nombre(0), '0');
    assert.notEqual(format.nombre(null), '0');
  });

  test("l'arrondi suit les décimales demandées ; les grands nombres se groupent par trois", () => {
    assert.equal(format.nombre(2.25, { decimales: 0 }), '2');
    assert.equal(format.nombre(2.75), '3');
    assert.equal(format.nombre(999), '999');
    assert.equal(format.nombre(1000), `1${FINE}000`);
    assert.equal(format.nombre(1234567.891, { decimales: 2 }), `1${FINE}234${FINE}567,89`);
    assert.equal(format.nombre(0.5, { decimales: 2 }), '0,50');
  });

  test('un négatif porte le signe moins typographique ; zéro négatif s’écrit 0', () => {
    assert.equal(format.nombre(-1234), `\u{2212}1${FINE}234`);
    assert.equal(format.nombre(-0), '0');
    assert.equal(format.nombre(-0.04, { decimales: 1 }), '0,0');
  });

  test('Infinity et NaN lèvent ; une valeur qui n’est pas un nombre lève ; des décimales hors de 0 à 20 lèvent', () => {
    for (const valeur of [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NaN]) {
      assert.throws(() => format.nombre(valeur), RangeError, String(valeur));
    }
    for (const valeur of [undefined, '12', 12n]) assert.throws(() => format.nombre(valeur), TypeError, String(valeur));
    for (const decimales of [-1, 1.5, 21]) assert.throws(() => format.nombre(1, { decimales }), RangeError, String(decimales));
  });

  test("en langue témoin, la valeur absente est encadrée ; un nombre, qui ne porte aucune lettre, ne l'est pas", () => {
    assert.equal(temoin.nombre(null), `${O}\u{2014}${F}`);
    assert.equal(temoin.nombre(1234.5, { decimales: 1 }), `1${FINE}234,5`);
  });
});

describe('format : les durées (§ 5.10)', () => {
  test('les valeurs du contrat', () => {
    assert.equal(format.duree(1800), '1,8 s');
    assert.equal(format.duree(150000), '2 min 30 s');
  });

  test("sous la minute au dixième de seconde, puis minutes et secondes, puis heures et minutes ; une part nulle se tait", () => {
    assert.equal(format.duree(0), '0 s');
    assert.equal(format.duree(12000), '12 s');
    assert.equal(format.duree(59940), '59,9 s');
    assert.equal(format.duree(59960), '1 min');
    assert.equal(format.duree(120000), '2 min');
    assert.equal(format.duree(3599400), '59 min 59 s');
    assert.equal(format.duree(3599600), '1 h');
    assert.equal(format.duree(5400000), '1 h 30 min');
    assert.equal(format.duree(36000000), '10 h');
  });

  test('une durée négative ou non finie lève', () => {
    for (const ms of [-1, Number.NaN, Number.POSITIVE_INFINITY]) assert.throws(() => format.duree(ms), RangeError, String(ms));
    assert.throws(() => format.duree(null), TypeError);
  });

  test('en langue témoin, une durée est encadrée de la marque, une fois', () => {
    assert.equal(temoin.duree(1800), `${O}1,8 s${F}`);
    assert.equal(temoin.duree(150000), `${O}2 min 30 s${F}`);
  });
});

describe("format : l'ordre de grandeur d'une durée (§ 5.10)", () => {
  const ATTENDUS = [
    [30, "moins d'une minute"],
    [59, "moins d'une minute"],
    [60, 'environ deux minutes'],
    [848, 'environ dix minutes'],
    [849, 'environ vingt minutes'],
    [1200, 'environ vingt minutes'],
    [1900, 'environ une demi-heure'],
    [5399, 'environ une heure'],
    [5400, 'plusieurs heures'],
    [7200, 'plusieurs heures'],
  ];

  test("les valeurs du contrat, frontières comprises", () => {
    assert.equal(ATTENDUS.length, 10);
    for (const [secondes, texte] of ATTENDUS) assert.equal(format.ordreDeGrandeur(secondes), texte, String(secondes));
    assert.equal(format.ordreDeGrandeur(1200), francais.t('format.duree.vingtMinutes'));
    assert.equal(francais.t('format.duree.vingtMinutes'), 'environ vingt minutes');
  });

  test('chaque pas a sa frontière en √(a·b) : le dernier entier de chaque pas, puis le premier du suivant', () => {
    // Les pas en secondes, et le premier entier au-delà de chaque frontière.
    const pas = [120, 300, 600, 1200, 1800, 3600];
    const textes = pas.map((s) => format.ordreDeGrandeur(s));
    assert.equal(new Set(textes).size, 6);
    for (let i = 0; i + 1 < pas.length; i += 1) {
      const produit = pas[i] * pas[i + 1];
      let premier = Math.ceil(Math.sqrt(produit));
      while (premier * premier < produit) premier += 1;
      while ((premier - 1) * (premier - 1) >= produit) premier -= 1;
      assert.equal(format.ordreDeGrandeur(premier - 1), textes[i], `${premier - 1} s`);
      assert.equal(format.ordreDeGrandeur(premier), textes[i + 1], `${premier} s`);
    }
  });

  test('-1, NaN et Infinity lèvent', () => {
    for (const secondes of [-1, Number.NaN, Number.POSITIVE_INFINITY]) {
      assert.throws(() => format.ordreDeGrandeur(secondes), RangeError, String(secondes));
    }
  });

  test('en langue témoin, un ordre de grandeur est encadré de la marque', () => {
    assert.equal(temoin.ordreDeGrandeur(1200), `${O}environ vingt minutes${F}`);
  });
});

describe('format : les dates et les horodatages (§ 18.4)', () => {
  test('les valeurs du contrat : la date en lettres, « 1er » pour le premier du mois', () => {
    assert.equal(format.date('2026-10-06'), '6 octobre 2026');
    assert.equal(format.date('2026-10-01'), '1er octobre 2026');
    assert.equal(format.horodatage('2026-10-06T19:02:11-04:00'), '6 octobre 2026, 19 h 02');
  });

  test("chaque mois a son nom ; l'heure du matin s'écrit sans zéro de tête, à l'heure que l'horodatage porte", () => {
    const mois = Array.from({ length: 12 }, (_, i) => format.date(`2031-${String(i + 1).padStart(2, '0')}-17`));
    assert.equal(mois.length, 12);
    assert.deepEqual(mois.map((texte) => texte.split(' ')[1]), [
      'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
      'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
    ]);
    assert.equal(format.horodatage('2031-05-01T08:05:00+02:00'), '1er mai 2031, 8 h 05');
  });

  test("une date ou un horodatage hors de leur forme, ou hors du calendrier, lèvent", () => {
    for (const date of ['2026-10-6', '06/10/2026', '2026-13-01', '2026-02-29', '2026-04-31', '2026-10-00', null]) {
      assert.throws(() => format.date(date), RangeError, String(date));
    }
    assert.equal(format.date('2028-02-29'), '29 février 2028');
    for (const horodatage of ['2026-10-06T19:02:11', '2026-10-06T24:00:00-04:00', '2026-10-06T19:60:00-04:00', '2026-10-06']) {
      assert.throws(() => format.horodatage(horodatage), RangeError, horodatage);
    }
  });

  test('en langue témoin, une date et un horodatage sont encadrés de la marque, une fois', () => {
    assert.equal(temoin.date('2026-10-01'), `${O}1er octobre 2026${F}`);
    assert.equal(temoin.horodatage('2026-10-06T19:02:11-04:00'), `${O}6 octobre 2026, 19 h 02${F}`);
  });
});

describe('format : rien ne vient de la locale du système', () => {
  test("les textes qui portent une lettre viennent des clés format.… de la table", () => {
    const cles = francais.cles().filter((cle) => cle.startsWith('format.'));
    assert.ok(cles.length > 0, 'aucune clé format.');
    for (const cle of ['format.vide', 'format.duree.vingtMinutes']) assert.ok(cles.includes(cle), cle);
    // Une table substituée change le texte rendu : il ne vient que d'elle.
    const autre = creerFormat((cle, details) => (cle === 'format.vide' ? 'néant' : francais.t(cle, details)));
    assert.equal(autre.nombre(null), 'néant');
  });
});
