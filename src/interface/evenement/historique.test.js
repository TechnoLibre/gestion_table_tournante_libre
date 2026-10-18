// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La vue du panneau d'historique (historique.js, § 8.3) : les lignes de la
// plus récente à la plus ancienne, le filtre des instants nommés, les pages
// de cent lignes, l'instant courant et les retours offerts, l'horodatage
// rendu par découpe, l'état vide ; l'étendue de la page, par la traduction
// et le format de l'application. Les historiques sont inventés, de la forme
// que rend seance.historique().
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { TAILLE_PAGE } from '../propositions/modele.js';
import { etendueHistorique, vueHistorique } from './historique.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

// Une ligne de l'historique : la révision n, son libellé, un horodatage de
// minute n, une entrée ordinaire du fil courant, sans jalon.
const ligne = (n, autres = {}) => ({
  revision: n,
  libelle: `Geste ${n}`,
  horodatage: `2031-04-0${1 + (n % 9)}T1${n % 10}:${String(n % 60).padStart(2, '0')}:07-04:00`,
  sens: null,
  retour: null,
  fil: 'courant',
  jalons: [],
  ...autres,
});

// Un historique de n lignes, révisions 1 à n, la dernière courante.
const historiqueDe = (n, autres = {}) => ({
  position: n === 0 ? null : n,
  lignes: Array.from({ length: n }, (_, rang) => ligne(rang + 1)),
  reprise: false,
  ...autres,
});

const revisions = (vue) => vue.lignes.map(({ revision }) => revision);

describe('vueHistorique : l’ordre, l’instant courant, l’heure', () => {
  test('les lignes vont de la plus récente à la plus ancienne ; l’historique reçu ne change pas', () => {
    const historique = historiqueDe(4);
    const avant = structuredClone(historique);
    const vue = vueHistorique(historique, { jalonsSeuls: false, page: 1 });
    assert.deepEqual(revisions(vue), [4, 3, 2, 1]);
    assert.deepEqual(historique, avant);
    assert.notEqual(vue.lignes[0].jalons, historique.lignes[3].jalons);
  });

  test('chaque ligne garde ce qu’elle portait, et ajoute courante, revenir et quand ; la plus récente est l’instant courant, où que soit la position', () => {
    const jalons = [{ nom: 'Avant la soirée', horodatage: '2031-04-02T09:15:00-04:00' }];
    // Un défaire : la ligne 4 restitue la ligne 2, la position ; la ligne 3,
    // défaite, sort du fil courant.
    const historique = {
      position: 2,
      lignes: [ligne(1), ligne(2, { jalons }), ligne(3, { fil: 'abandonne' }), ligne(4, { sens: 'defaire', retour: 2, fil: 'retour' })],
      reprise: false,
    };
    const vue = vueHistorique(historique, { jalonsSeuls: false, page: 1 });
    const quand = (n) => historique.lignes[n].horodatage.slice(0, 10) + ' ' + historique.lignes[n].horodatage.slice(11, 16);
    assert.deepEqual(vue.lignes[2], { ...historique.lignes[1], courante: false, revenir: true, quand: quand(1) });
    assert.deepEqual(vue.lignes[0], { ...historique.lignes[3], courante: true, revenir: false, quand: quand(3) });
    assert.deepEqual(
      vue.lignes.map(({ revision, fil, courante, revenir }) => [revision, fil, courante, revenir]),
      [
        [4, 'retour', true, false],
        [3, 'abandonne', false, true],
        [2, 'courant', false, true],
        [1, 'courant', false, true],
      ],
    );
  });

  test('un défaire puis un nom : le jalon, posé sur la révision de l’Ouvert, et l’instant courant sont sur la même ligne', () => {
    const jalons = [{ nom: 'Essai', horodatage: '2031-04-02T09:15:00-04:00' }];
    const historique = {
      position: 2,
      lignes: [ligne(1), ligne(2), ligne(3, { fil: 'abandonne' }), ligne(4, { sens: 'defaire', retour: 2, fil: 'retour', jalons })],
      reprise: false,
    };
    const vue = vueHistorique(historique, { jalonsSeuls: false, page: 1 });
    assert.deepEqual(
      vue.lignes.filter(({ courante }) => courante).map(({ revision, jalons: noms }) => [revision, noms.map(({ nom }) => nom)]),
      [[4, ['Essai']]],
    );
    // Filtrée, la ligne nommée reste l'instant courant.
    assert.deepEqual(
      vueHistorique(historique, { jalonsSeuls: true, page: 1 }).lignes.map(({ revision, courante }) => [revision, courante]),
      [[4, true]],
    );
  });

  test('quand découpe l’horodatage en « AAAA-MM-JJ HH:MM », sans conversion de fuseau ni seconde', () => {
    const lignes = [
      ligne(1, { horodatage: '2031-12-31T23:59:59-11:00' }),
      ligne(2, { horodatage: '2032-01-01T00:00:00+14:00' }),
      ligne(3, { horodatage: '2031-06-15T08:05:41+00:00' }),
    ];
    const vue = vueHistorique({ position: 3, lignes, reprise: false }, { jalonsSeuls: false, page: 1 });
    assert.deepEqual(
      vue.lignes.map(({ quand }) => quand),
      ['2031-06-15 08:05', '2032-01-01 00:00', '2031-12-31 23:59'],
    );
  });

  test('en reprise — le journal en retard sur l’état — aucune ligne n’est courante, et chacune offre le retour', () => {
    const vue = vueHistorique(historiqueDe(3, { position: null, reprise: true }), { jalonsSeuls: false, page: 1 });
    assert.deepEqual(
      vue.lignes.map(({ courante, revenir }) => [courante, revenir]),
      [
        [false, true],
        [false, true],
        [false, true],
      ],
    );
    assert.equal(vue.vide, null);
  });

  test('un retour sans prédécesseur, sa propre position, est la ligne courante, et n’offre pas le retour', () => {
    const historique = { position: 9, lignes: [ligne(9, { sens: 'revenir', retour: 4 })], reprise: false };
    const [seule] = vueHistorique(historique, { jalonsSeuls: false, page: 1 }).lignes;
    assert.deepEqual([seule.fil, seule.courante, seule.revenir], ['courant', true, false]);
  });
});

describe('vueHistorique : le filtre des instants nommés et l’état vide', () => {
  test('jalonsSeuls garde les lignes qui portent un jalon au moins, dans le même ordre', () => {
    const jalon = (nom) => [{ nom, horodatage: '2031-04-02T09:15:00-04:00' }];
    const historique = {
      position: 5,
      lignes: [ligne(1, { jalons: jalon('Création') }), ligne(2), ligne(3, { jalons: [...jalon('A'), ...jalon('B')] }), ligne(4), ligne(5)],
      reprise: false,
    };
    const filtree = vueHistorique(historique, { jalonsSeuls: true, page: 1 });
    assert.deepEqual(revisions(filtree), [3, 1]);
    assert.deepEqual([filtree.total, filtree.vide], [2, null]);
    assert.deepEqual(revisions(vueHistorique(historique, { jalonsSeuls: false, page: 1 })), [5, 4, 3, 2, 1]);
  });

  test('vide : « aucunInstant » sans ligne, filtre ou non ; « aucunJalon » quand le filtre ne garde rien ; null sinon', () => {
    for (const jalonsSeuls of [false, true]) {
      const vue = vueHistorique(historiqueDe(0, { reprise: true }), { jalonsSeuls, page: 1 });
      assert.deepEqual(
        [vue.lignes, vue.vide, vue.total, vue.page, vue.pages, vue.premier, vue.dernier, vue.paginee],
        [[], 'aucunInstant', 0, 1, 1, 0, 0, false],
      );
    }
    const sansJalon = vueHistorique(historiqueDe(3), { jalonsSeuls: true, page: 1 });
    assert.deepEqual([sansJalon.lignes, sansJalon.vide, sansJalon.total], [[], 'aucunJalon', 0]);
    assert.equal(vueHistorique(historiqueDe(3), { jalonsSeuls: false, page: 1 }).vide, null);
  });

  test('sans événement — historique null — la vue est celle d’aucun instant', () => {
    const vue = vueHistorique(null, { jalonsSeuls: false, page: 1 });
    assert.deepEqual([vue.lignes, vue.vide, vue.total, vue.pages], [[], 'aucunInstant', 0, 1]);
  });
});

describe('vueHistorique : les pages', () => {
  test('601 lignes font 7 pages de TAILLE_PAGE, la dernière d’une ligne : la page 1 porte les révisions 601 à 502, la 7 la révision 1', () => {
    assert.equal(TAILLE_PAGE, 100);
    const historique = historiqueDe(601);
    const premiere = vueHistorique(historique, { jalonsSeuls: false, page: 1 });
    assert.deepEqual(
      [premiere.page, premiere.pages, premiere.premier, premiere.dernier, premiere.total, premiere.paginee],
      [1, 7, 1, 100, 601, true],
    );
    assert.deepEqual([premiere.lignes.length, premiere.lignes[0].revision, premiere.lignes.at(-1).revision], [100, 601, 502]);
    const troisieme = vueHistorique(historique, { jalonsSeuls: false, page: 3 });
    assert.deepEqual([troisieme.premier, troisieme.dernier, troisieme.lignes[0].revision, troisieme.lignes.at(-1).revision], [201, 300, 401, 302]);
    const derniere = vueHistorique(historique, { jalonsSeuls: false, page: 7 });
    assert.deepEqual([derniere.premier, derniere.dernier, revisions(derniere)], [601, 601, [1]]);
  });

  test('la page se borne aux pages existantes : la première en deçà, la dernière au-delà', () => {
    const historique = historiqueDe(250);
    assert.equal(vueHistorique(historique, { jalonsSeuls: false, page: 0 }).page, 1);
    assert.equal(vueHistorique(historique, { jalonsSeuls: false, page: -4 }).page, 1);
    const auDela = vueHistorique(historique, { jalonsSeuls: false, page: 9 });
    assert.deepEqual([auDela.page, auDela.pages, auDela.premier, auDela.dernier], [3, 3, 201, 250]);
  });

  test('cent lignes tiennent sur une page, non paginée ; cent une en font deux', () => {
    const cent = vueHistorique(historiqueDe(100), { jalonsSeuls: false, page: 1 });
    assert.deepEqual([cent.pages, cent.paginee, cent.lignes.length], [1, false, 100]);
    const centUne = vueHistorique(historiqueDe(101), { jalonsSeuls: false, page: 2 });
    assert.deepEqual([centUne.pages, centUne.paginee, revisions(centUne)], [2, true, [1]]);
  });

  test('le filtre se pagine sur ses propres lignes : 150 jalons sur 300 lignes font 2 pages', () => {
    const historique = historiqueDe(300);
    historique.lignes.forEach((l) => {
      if (l.revision % 2 === 0) l.jalons = [{ nom: `J${l.revision}`, horodatage: l.horodatage }];
    });
    const vue = vueHistorique(historique, { jalonsSeuls: true, page: 2 });
    assert.deepEqual([vue.total, vue.pages, vue.premier, vue.dernier, vue.lignes[0].revision, vue.lignes.at(-1).revision], [150, 2, 101, 150, 100, 2]);
  });

  test('une page qui n’est pas un entier lève TypeError ; les options manquantes valent la première page, sans filtre', () => {
    for (const page of [1.5, '2', null, Number.NaN]) {
      assert.throws(() => vueHistorique(historiqueDe(3), { jalonsSeuls: false, page }), TypeError, String(page));
    }
    const defaut = vueHistorique(historiqueDe(120));
    assert.deepEqual([defaut.page, defaut.total], [1, 120]);
  });
});

describe('etendueHistorique : l’étendue de la page', () => {
  test('les nombres passent par le format : « Instants 1 001 à 1 100 sur 1 500 » ; une page d’une ligne se dit au singulier', () => {
    const fine = '\u{202F}';
    assert.equal(etendueHistorique({ premier: 1001, dernier: 1100, total: 1500 }, { t, format }), `Instants 1${fine}001 à 1${fine}100 sur 1${fine}500`);
    assert.equal(etendueHistorique(vueHistorique(historiqueDe(601), { jalonsSeuls: false, page: 7 }), { t, format }), 'Instant 601 sur 601');
    assert.equal(etendueHistorique(vueHistorique(historiqueDe(601), { jalonsSeuls: false, page: 2 }), { t, format }), 'Instants 101 à 200 sur 601');
  });
});
