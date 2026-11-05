// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du plan imprimé, sans DOM (§ 7.7, § 11.7) : les pages que rend
// pagesDuPlan sont celles de la découpe (decouperPlan), une par feuille,
// chacune sous le pied d'un seul tour, la mention « disposition relative »
// et l'échelle graphique de son échelle ; la mention des listes sur chaque
// page qui en porte, quand elles sont montrées. La découpe attendue se
// recalcule ici par decouperPlan et englobantImpression, appelées
// directement ; la hauteur des listes, de la hauteur de ligne reçue.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { ErreurCommande } from '../../application/erreurs.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { etatPlaces } from '../../application/places.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { echelleGraphique } from '../../geometrie/echelle.js';
import { decouperPlan } from '../../geometrie/pages.js';
import { HAUTEUR_LIGNE_SUPPOSEE, englobantImpression, geometrieTable } from '../../geometrie/tables.js';
import { analyser, creerCharge } from '../../stockage/document.js';
import { constante } from '../../geometrie/constantes.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { modeleDessin } from '../plan/modele.js';
import { feuilleDe } from './modele.js';
import {
  CARTOUCHE_GABARIT,
  ECHELLE_GABARIT,
  LARGEUR_ECHELLE_MM,
  MENTIONS_GABARIT,
  hauteursListes,
  modeleDeLaPage,
  pagesDuPlan,
  renvois,
} from './plan.js';

const H = HAUTEUR_LIGNE_SUPPOSEE;
const TABLES = [...TABLES_APPLICATION, ...TABLES_INTERFACE];

// Le pied d'une feuille au tour donné, ou de la soirée.
const piedAu = (tour) =>
  feuilleDe({ nom: 'Soirée des Merles', date: null, tour, horodatage: null, version: 'epreuve' }, false);

const demonstration = (cle) => analyser(texteLivre(cle)).charge;

// L'état des places du tour 1 d'une charge, ses géométries à leur capacité.
function plan(charge, tour = 1) {
  const etat = etatPlaces(charge, { tour });
  const geometries = etat.tables.map((table) => geometrieTable(table, table.capacite));
  return { etat, geometries };
}

// Une charge de tables rondes de 6 places, aux positions données (cm).
function chargeDeTables(positions) {
  const charge = creerCharge({ id: 'epreuve:plan-imprime', nom: 'Plan imprimé', siegesParDefaut: 6, tours: 2 });
  charge.tables = positions.map(([x, y], i) => ({ id: i + 1, numero: i + 1, sieges: null, forme: 'ronde', position: { x, y } }));
  charge.prochainsIds = { participant: 1, table: positions.length + 1, proposition: 1 };
  return charge;
}

// La découpe attendue, par decouperPlan appelée directement.
function decoupeAttendue(etat, geometries, mode, { papier = 'A4', bandeMm = 12, listes = false, hauteurLigne = H } = {}) {
  const blocs = listes ? { largeur: constante('LARGEUR_BLOC_NOMS_CM'), hauteurs: hauteursListes(etat, hauteurLigne) } : null;
  return decouperPlan(englobantImpression(geometries, { listes: blocs }), { papier, bandeMm, mode, geometries, listes: blocs });
}

describe('hauteursListes : la hauteur du bloc de noms de chaque table (§ 7.4, § 7.7)', () => {
  test('une ligne par siège, l’en-tête d’une table gelée, et une ligne pour le jambage de la dernière', () => {
    const etat = { tables: [{ id: 4, capacite: 6, gelee: false }, { id: 9, capacite: 3, gelee: true }] };
    const hauteurs = hauteursListes(etat, 20);
    assert.deepEqual([...hauteurs], [[4, 7 * 20], [9, 5 * 20]]);
  });

  test('une hauteur de ligne non finie ou ≤ 0 se refuse', () => {
    const etat = { tables: [{ id: 1, capacite: 2, gelee: false }] };
    for (const h of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, null]) {
      assert.throws(() => hauteursListes(etat, h), RangeError, String(h));
    }
  });
});

describe('pagesDuPlan : une page par feuille, chacune la tuile de la découpe (§ 11.7)', () => {
  for (const [mode, listes] of [
    ['auto', false],
    ['auto', true],
    ['decoupe', true],
    ['unePage', true],
  ]) {
    test(`grande démonstration, ${mode}, listes ${listes ? 'montrées' : 'masquées'} : N pages, celles de decouperPlan, tuile, cartouche et tables`, () => {
      const { etat, geometries } = plan(demonstration('grande'));
      const attendue = decoupeAttendue(etat, geometries, mode, { listes });
      const pages = pagesDuPlan(etat, geometries, mode, { papier: 'A4', bandeMm: 12, listes, hauteurLigne: H, pied: piedAu(1) });
      assert.equal(pages.length, attendue.pages.length);
      for (const [rang, page] of pages.entries()) {
        const tuile = attendue.pages[rang];
        assert.equal(page.rang, tuile.rang);
        assert.equal(page.orientation, attendue.orientation);
        assert.deepEqual(page.viewBox, tuile.cadrage);
        assert.deepEqual(page.cartouche, tuile.cartouche);
        assert.deepEqual(page.tables, tuile.tables);
        assert.deepEqual(page.taille, { largeur: tuile.cadrage.largeur * attendue.echelle, hauteur: tuile.cadrage.hauteur * attendue.echelle });
      }
    });
  }

  test('le pied de chaque page est celui d’un seul tour, le tour imprimé', () => {
    const { etat, geometries } = plan(demonstration('grande'));
    const pied = piedAu(3);
    const pages = pagesDuPlan(etat, geometries, 'decoupe', { papier: 'A4', bandeMm: 12, listes: true, hauteurLigne: H, pied });
    assert.ok(pages.length > 1);
    for (const page of pages) {
      assert.equal(page.pied, pied);
      const tour = page.pied.elements.find(({ element }) => element === 'tour');
      assert.deepEqual(tour.libelle, { cle: 'impression.pied.tour', details: { tour: 3 } });
    }
  });

  test('un nom d’événement au-delà de 68 caractères : NOM_EVENEMENT_TROP_LONG et le remède « Renommer » avant toute découpe, même sous une bande que la découpe ne tiendrait pas', () => {
    const { etat, geometries } = plan(demonstration('petite'));
    const pied = (nom) => feuilleDe({ nom, date: null, tour: 1, horodatage: null, version: 'epreuve' }, false);
    const options = { papier: 'A4', bandeMm: 12 };
    const attendue = decoupeAttendue(etat, geometries, 'auto');
    assert.equal(pagesDuPlan(etat, geometries, 'auto', { ...options, pied: pied('m'.repeat(68)) }).length, attendue.pages.length);
    assert.throws(() => decoupeAttendue(etat, geometries, 'auto', { bandeMm: 400 }), RangeError);
    for (const [nom, bandeMm] of [['m'.repeat(69), 12], ['Gala des Grèbes '.repeat(500), 400]]) {
      assert.throws(
        () => pagesDuPlan(etat, geometries, 'auto', { papier: 'A4', bandeMm, pied: pied(nom) }),
        (erreur) => {
          assert.ok(erreur instanceof ErreurCommande, `ErreurCommande attendue, reçu ${erreur}`);
          assert.equal(erreur.code, 'NOM_EVENEMENT_TROP_LONG');
          assert.deepEqual(erreur.details, { longueur: nom.trim().length, maximum: 68, remede: { geste: 'renommer' } });
          return true;
        },
      );
    }
  });

  test('un pied de la soirée se refuse : le plan s’imprime à un tour', () => {
    const { etat, geometries } = plan(demonstration('petite'));
    assert.throws(() => pagesDuPlan(etat, geometries, 'auto', { papier: 'A4', bandeMm: 12, pied: piedAu('tous') }), RangeError);
  });

  test('chaque page porte la mention « disposition relative » ; celle des listes, si et seulement si les listes sont montrées et que la page porte une table', () => {
    // Deux tables à 200 m l'une de l'autre : découpé, le plan a des pages
    // sans table entre elles.
    const { etat, geometries } = plan(chargeDeTables([[0, 0], [20000, 0]]));
    for (const listes of [true, false]) {
      const pages = pagesDuPlan(etat, geometries, 'decoupe', { papier: 'A4', bandeMm: 12, listes, hauteurLigne: H, pied: piedAu(1) });
      const vides = pages.filter(({ tables }) => tables.length === 0);
      assert.ok(vides.length > 0 && vides.length < pages.length, `${vides.length} pages vides sur ${pages.length}`);
      for (const page of pages) {
        assert.equal(page.mentions.relative, true);
        assert.equal(page.mentions.listes, listes && page.tables.length > 0, `page ${page.rang}, listes ${listes}`);
      }
    }
  });

  test('l’échelle graphique de chaque page : la longueur ronde qui tient dans LARGEUR_ECHELLE_MM à l’échelle de la découpe, et sa largeur en mm', () => {
    for (const cle of ['petite', 'grande']) {
      const { etat, geometries } = plan(demonstration(cle));
      for (const mode of ['auto', 'unePage']) {
        const attendue = decoupeAttendue(etat, geometries, mode, { listes: true });
        const pages = pagesDuPlan(etat, geometries, mode, { papier: 'A4', bandeMm: 12, listes: true, hauteurLigne: H, pied: piedAu(1) });
        const { longueurCm, largeurPx } = echelleGraphique(attendue.echelle, LARGEUR_ECHELLE_MM);
        for (const page of pages) {
          assert.deepEqual(page.echelle, { longueurCm, largeurMm: largeurPx });
          assert.ok(page.echelle.largeurMm <= LARGEUR_ECHELLE_MM);
          assert.equal(page.echelle.largeurMm, page.echelle.longueurCm * attendue.echelle);
        }
      }
    }
  });

  test('grande démonstration, listes montrées, A4 : découpée par défaut, chaque table sur une page au moins', () => {
    const { etat, geometries } = plan(demonstration('grande'));
    const pages = pagesDuPlan(etat, geometries, 'auto', { papier: 'A4', bandeMm: 12, listes: true, hauteurLigne: H, pied: piedAu(1) });
    assert.ok(pages.length > 1, `${pages.length} page(s)`);
    const portees = new Set(pages.flatMap(({ tables }) => tables));
    assert.deepEqual([...portees].sort((a, b) => a - b), etat.tables.map(({ id }) => id).sort((a, b) => a - b));
  });

  test('les listes montrées étendent la découpe de leurs blocs : sans hauteur de ligne, elles se refusent', () => {
    const { etat, geometries } = plan(demonstration('petite'));
    assert.throws(() => pagesDuPlan(etat, geometries, 'auto', { papier: 'A4', bandeMm: 12, listes: true, pied: piedAu(1) }), RangeError);
    const sans = pagesDuPlan(etat, geometries, 'unePage', { papier: 'A4', bandeMm: 12, listes: false, pied: piedAu(1) });
    const avec = pagesDuPlan(etat, geometries, 'unePage', { papier: 'A4', bandeMm: 12, listes: true, hauteurLigne: H, pied: piedAu(1) });
    // Sur une page, le plan avec ses listes couvre plus de dessin : son
    // échelle est plus petite.
    assert.ok(avec[0].taille.largeur / avec[0].viewBox.largeur < sans[0].taille.largeur / sans[0].viewBox.largeur);
  });

  test('un plan vide : une page, aucune table, une échelle graphique finie', () => {
    const { etat, geometries } = plan(chargeDeTables([]));
    const pages = pagesDuPlan(etat, geometries, 'auto', { papier: 'Lettre', bandeMm: 12, listes: true, hauteurLigne: H, pied: piedAu(1) });
    assert.equal(pages.length, 1);
    assert.deepEqual(pages[0].tables, []);
    assert.equal(pages[0].mentions.listes, false);
    assert.ok(Number.isFinite(pages[0].echelle.largeurMm) && pages[0].echelle.largeurMm > 0);
  });
});

describe('renvois, modeleDeLaPage et le gabarit de la bande', () => {
  test('renvois : les pages voisines, haut, droite, bas, gauche, numérotées de 1, les bords omis', () => {
    const cartouche = { page: 5, total: 9, colonne: 'B', rangee: 2, voisins: { haut: 1, droite: 5, bas: null, gauche: 3 } };
    assert.deepEqual(renvois(cartouche), [
      { sens: 'haut', cle: 'impression.plan.renvoi.haut', page: 2 },
      { sens: 'droite', cle: 'impression.plan.renvoi.droite', page: 6 },
      { sens: 'gauche', cle: 'impression.plan.renvoi.gauche', page: 4 },
    ]);
    assert.deepEqual(renvois({ ...cartouche, voisins: { haut: null, droite: null, bas: null, gauche: null } }), []);
  });

  test('modeleDeLaPage : les tables de la page, dans l’ordre du modèle ; le reste du modèle tel quel', () => {
    const charge = demonstration('petite');
    const etat = etatPlaces(charge, { tour: 1 });
    const modele = modeleDessin(etat, { listes: true, nomDe: () => 'Iris Ombrelle', impression: true });
    const ids = modele.tables.map(({ id }) => id);
    const page = { tables: [ids[2], ids[0]] };
    const reduit = modeleDeLaPage(modele, page);
    assert.deepEqual(reduit.tables.map(({ id }) => id), [ids[0], ids[2]]);
    assert.equal(reduit.tables[0], modele.tables[0]);
    assert.deepEqual({ ...reduit, tables: null }, { ...modele, tables: null });
  });

  test('chaque renvoi a son libellé, en français comme en langue témoin', () => {
    for (const traduction of [creerTraduction(TABLES), creerTraduction(TABLES, { langue: 'temoin' })]) {
      for (const { cle, page } of renvois(CARTOUCHE_GABARIT)) {
        assert.match(traduction.t(cle, { page }), /888|887/u, cle);
      }
    }
  });

  test('le gabarit porte chaque élément que la bande peut porter : les quatre renvois, les deux mentions, l’échelle', () => {
    assert.equal(renvois(CARTOUCHE_GABARIT).length, 4);
    assert.deepEqual(MENTIONS_GABARIT, { relative: true, listes: true });
    assert.ok(ECHELLE_GABARIT.largeurMm > 0 && ECHELLE_GABARIT.largeurMm <= LARGEUR_ECHELLE_MM);
  });
});
