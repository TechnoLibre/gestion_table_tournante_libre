// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les modèles de la liste d'accueil et de la feuille par table (§ 11.7,
// § 11.4, § 7.4, § 15.5), sans DOM : l'ordre de la liste d'accueil par la clé
// normalisée injectée, jamais localeCompare ; ce que chaque ligne dit de
// chaque tour ; les feuilles par table, les tours en colonnes ou une feuille
// par tour (Q6 c) ; le pied et le filigrane d'une feuille d'un seul tour ;
// les groupes de tours de la feuille par table, leur taille tirée de la
// part mesurée d'un tour, et leur resserrement sous une page seule ; les
// blocs de tours de la liste d'accueil, chaque tour à sa part, les noms à
// leur plancher, chaque ligne répétée dans chaque bloc ; les
// textes d'une cellule de la feuille par table et d'une ligne de la liste
// d'accueil, dans l'ordre où elles les posent.
// Les noms d'épreuve sont inventés, hors du réservoir des démonstrations.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { H_RETENU, personne, soiree, table } from '../../../test/fixtures/badges/cas.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { cleNormalisee } from '../../application/csv.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { feuilleDe } from './modele.js';
import {
  ECHELLE_TEXTE_MAX,
  PAS_ECHELLE,
  blocsAccueil,
  echelleAjustee,
  echellesParTable,
  etatsDesTours,
  feuilleDuTour,
  feuillesTables,
  grouperTours,
  largeursColonnes,
  libellePlace,
  lignesAccueil,
  partsDesCellules,
  plafondEchelle,
  resserrerGroupes,
  textesCellule,
  textesLigneAccueil,
  toursParBloc,
  toursParGroupe,
} from './listes.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Dix personnes, dont une exclue, sur deux tables de quatre, deux tours :
// Anouk Eboulis attend au tour 1, Iris Ombrelle au tour 2. Les Lacasse
// partagent leur nom ; quatre Ondine Lacasse ne se séparent que par
// l'organisation, deux d'entre elles par l'identifiant seul.
function accueil(autres = {}) {
  return soiree({
    personnes: [
      personne(1, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' }),
      personne(2, 'Théo', '\u{0152}illet'),
      personne(3, '\u{00C9}lise', 'Lacasse'),
      personne(4, 'Ondine', 'Lacasse'),
      personne(5, 'Ondine', 'Lacasse', { organisation: 'Grisaille' }),
      personne(6, 'Ondine', 'Lacasse', { organisation: 'Club des Merles' }),
      personne(7, 'Ondine', 'Lacasse', { organisation: ' club  des MERLES ' }),
      personne(8, null, '\u{00C9}zard'),
      personne(9, 'Rémi', 'Zinnia', { exclu: true }),
      personne(10, 'Anouk', 'Eboulis'),
    ],
    tables: [table(1, 7, 4), table(2, 3, 4)],
    plan: [
      { sieges: [[1, 2, 3, 4], [5, 6, 7, 8]], reserve: [10] },
      { sieges: [[2, 3, 4, 10], [5, 6, 7, 8]], reserve: [1] },
    ],
    ...autres,
  });
}

const etats = (charge, proposition = null) => etatsDesTours(charge, proposition);
const ids = (lignes) => lignes.map(({ participant }) => participant);
const ligneDe = (lignes, id) => lignes.find(({ participant }) => participant === id);

describe('etatsDesTours : l’état des places de chaque tour de la soirée', () => {
  test('un état par tour, de 1 à R, de la source demandée', () => {
    const charge = accueil();
    const lus = etats(charge);
    assert.deepEqual(lus.map(({ tour }) => tour), [1, 2]);
    assert.deepEqual(lus.map(({ source }) => source), ['retenu', 'retenu']);
  });
});

describe('lignesAccueil : la liste d’accueil (§ 11.7)', () => {
  test('triée par la clé normalisée du nom, puis du prénom, par points de code : un accent ne renvoie pas un nom après Z, Œ vient après O', () => {
    const lignes = lignesAccueil(accueil(), etats(accueil()), cleNormalisee);
    assert.deepEqual(ids(lignes), [10, 8, 3, 4, 6, 7, 5, 1, 2]);
    // Par unités brutes, « Ézard » et « Œillet » partiraient en fin de liste.
    assert.ok('\u{00C9}zard' > 'Zinnia' && '\u{0152}illet' > 'Zinnia');
    // localeCompare rangerait « œillet » avant « ombrelle » : la liste ne le suit pas.
    assert.ok(cleNormalisee('\u{0152}illet').localeCompare('ombrelle', 'fr') < 0);
  });

  test('jamais localeCompare : la liste se compose quand il lève', () => {
    const charge = accueil();
    const lus = etats(charge);
    const original = String.prototype.localeCompare;
    String.prototype.localeCompare = () => {
      throw new Error('localeCompare appelé');
    };
    try {
      assert.deepEqual(ids(lignesAccueil(charge, lus, cleNormalisee)), [10, 8, 3, 4, 6, 7, 5, 1, 2]);
    } finally {
      String.prototype.localeCompare = original;
    }
  });

  test('la clé est celle qu’on injecte : une clé brute rend l’ordre des unités', () => {
    const lignes = lignesAccueil(accueil(), etats(accueil()), (texte) => texte);
    assert.deepEqual(ids(lignes), [10, 4, 7, 6, 5, 3, 1, 8, 2]);
  });

  test('des homonymes se départagent par l’organisation — absente d’abord —, puis par l’identifiant', () => {
    const lignes = lignesAccueil(accueil(), etats(accueil()), cleNormalisee);
    const ondines = lignes.filter(({ nom, prenom }) => nom === 'Lacasse' && prenom === 'Ondine');
    assert.deepEqual(ids(ondines), [4, 6, 7, 5]);
    assert.deepEqual(
      ondines.map(({ organisation }) => organisation),
      [null, 'Club des Merles', ' club  des MERLES ', 'Grisaille'],
    );
  });

  test('un exclu n’a pas de ligne ; chaque autre personne en a une, avec nom, prénom et organisation tels quels', () => {
    const charge = accueil();
    const lignes = lignesAccueil(charge, etats(charge), cleNormalisee);
    assert.equal(ligneDe(lignes, 9), undefined);
    assert.equal(lignes.length, 9);
    assert.deepEqual(
      { nom: ligneDe(lignes, 8).nom, prenom: ligneDe(lignes, 8).prenom, organisation: ligneDe(lignes, 8).organisation },
      { nom: '\u{00C9}zard', prenom: null, organisation: null },
    );
    // Exclue, la personne ne revient pas même quand un état la nommerait.
    const exclue = accueil();
    exclue.participants[0].exclu = true;
    assert.equal(ligneDe(lignesAccueil(exclue, etats(exclue), cleNormalisee), 1), undefined);
  });

  test('par tour, le numéro de la table ; la réserve, sans table ni siège', () => {
    const charge = accueil();
    const lignes = lignesAccueil(charge, etats(charge), cleNormalisee);
    assert.deepEqual(ligneDe(lignes, 1).places, [
      { tour: 1, table: 7, siege: null },
      { tour: 2, table: null, siege: null },
    ]);
    assert.deepEqual(ligneDe(lignes, 10).places, [
      { tour: 1, table: null, siege: null },
      { tour: 2, table: 7, siege: null },
    ]);
    assert.deepEqual(ligneDe(lignes, 5).places, [
      { tour: 1, table: 3, siege: null },
      { tour: 2, table: 3, siege: null },
    ]);
  });

  test('le siège seulement sous sièges attribués, compté chaises vides comprises', () => {
    const attribuee = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 3)],
      plan: [{ sieges: [[1, null, 2]] }],
      siegesAttribues: true,
    });
    const lignes = lignesAccueil(attribuee, etats(attribuee), cleNormalisee);
    assert.deepEqual(ligneDe(lignes, 1).places, [{ tour: 1, table: 7, siege: 1 }]);
    assert.deepEqual(ligneDe(lignes, 2).places, [{ tour: 1, table: 7, siege: 3 }]);
    const libre = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 3)],
      plan: [{ sieges: [[1, 2]] }],
    });
    for (const ligne of lignesAccueil(libre, etats(libre), cleNormalisee)) {
      assert.deepEqual(ligne.places, [{ tour: 1, table: 7, siege: null }], String(ligne.participant));
    }
  });

  test('chaque place a son libellé : la table, la table et le siège, ou la réserve', () => {
    assert.deepEqual(libellePlace({ tour: 1, table: 7, siege: null }), { cle: 'feuilles.accueil.table', details: { table: 7 } });
    assert.deepEqual(libellePlace({ tour: 2, table: 7, siege: 3 }), { cle: 'feuilles.accueil.tableSiege', details: { table: 7, siege: 3 } });
    assert.deepEqual(libellePlace({ tour: 1, table: null, siege: null }), { cle: 'feuilles.accueil.reserve', details: {} });
    assert.equal(t('feuilles.accueil.tableSiege', { table: 7, siege: 3 }), 'Table 7, siège 3');
    assert.equal(t('feuilles.accueil.reserve'), 'Réserve');
  });

  test('un tour d\u{2019}absence : « absente », sans table ni siège, et non la réserve ; les autres tours inchangés', () => {
    const charge = accueil();
    // Iris Ombrelle, assise au tour 1, n'est présente qu'à lui : le retenu
    // la dit absente au tour 2, où elle attendait.
    charge.participants[0].presence = [1];
    charge.retenu.placement[1] = { sieges: [[2, 3, 4, 10], [5, 6, 7, 8]], reserve: [], absents: [1] };
    const lignes = lignesAccueil(charge, etats(charge), cleNormalisee);
    assert.deepEqual(ligneDe(lignes, 1).places, [
      { tour: 1, table: 7, siege: null },
      { tour: 2, table: null, siege: null, absente: true },
    ]);
    assert.deepEqual(textesLigneAccueil(ligneDe(lignes, 1), t).slice(3), ['Table 7', 'absente']);
    // Anouk Eboulis attend toujours au tour 1 : la réserve garde son libellé.
    assert.deepEqual(ligneDe(lignes, 10).places[0], { tour: 1, table: null, siege: null });
    assert.deepEqual(textesLigneAccueil(ligneDe(lignes, 10), t).slice(3), ['Réserve', 'Table 7']);
  });

  test('sans aucune présence, aucune place ne porte « absente » : les lignes d\u{2019}aujourd\u{2019}hui', () => {
    const charge = accueil();
    for (const { places } of lignesAccueil(charge, etats(charge), cleNormalisee)) {
      for (const place of places) assert.equal(Object.hasOwn(place, 'absente'), false);
    }
  });

  test('le libellé d\u{2019}une absente vient avant le cas de la réserve : « absente »', () => {
    assert.deepEqual(libellePlace({ tour: 2, table: null, siege: null, absente: true }), { cle: 'feuilles.accueil.absente', details: {} });
    assert.equal(t('feuilles.accueil.absente'), 'absente');
  });

  test('une soirée sans personne donne une liste vide', () => {
    const vide = soiree({ personnes: [], tables: [table(1, 7, 3)], plan: [{ sieges: [[]] }] });
    assert.deepEqual(lignesAccueil(vide, etats(vide), cleNormalisee), []);
  });
});

// Trois personnes à la table 7, sièges attribués, deux tours, une chaise
// vide au siège 2 du tour 1 ; Iris Ombrelle réservée au siège 1 pour la
// soirée, qui porte le titre « animateur » ; le siège 2 porte « hôte », que
// rien ne pourvoit. Théo Pervenche est de la Coopérative des Saules, Ondine
// Lacasse d'une organisation faite de blancs. La table 3, vide, vient avant
// elle par son numéro.
function titree() {
  return soiree({
    personnes: [
      personne(1, 'Iris', 'Ombrelle'),
      personne(2, 'Théo', 'Pervenche', { organisation: 'Coopérative des Saules' }),
      personne(3, 'Ondine', 'Lacasse', { organisation: '  ' }),
    ],
    tables: [table(1, 7, 3), table(2, 3, 2)],
    plan: [
      { sieges: [[1, null, 2], []], reserve: [3] },
      { sieges: [[1, 3, 2], []] },
    ],
    siegesAttribues: true,
    reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }],
    titres: [
      { table: 1, siege: 1, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'hôte' },
    ],
  });
}

const vide = (tour) => ({ tour, occupant: null, nom: null, organisation: null, titre: null });

// Les personnes de titree, la table 3 occupée au seul tour 2 par Ondine
// Lacasse, qui attend à la réserve au tour 1.
function titreeDeuxTables() {
  return soiree({
    personnes: titree().participants,
    tables: [table(1, 7, 3), table(2, 3, 2)],
    plan: [
      { sieges: [[1, null, 2], []], reserve: [3] },
      { sieges: [[1, null, 2], [3]] },
    ],
    siegesAttribues: true,
  });
}

describe('feuillesTables : la feuille par table (§ 11.7, Q6 c)', () => {
  test('par défaut une feuille par table occupée, par numéro croissant, les tours en colonnes ; chaque siège listé, une place vide écrite comme telle', () => {
    const charge = titree();
    const feuilles = feuillesTables(charge, etats(charge));
    assert.deepEqual(feuilles.map(({ table: id, numero, tours }) => ({ id, numero, tours })), [{ id: 1, numero: 7, tours: [1, 2] }]);
    const [siege1, siege2, siege3] = feuilles[0].lignes;
    assert.deepEqual(siege1, {
      place: 1,
      cellules: [
        { tour: 1, occupant: 1, nom: 'Iris Ombrelle', organisation: null, titre: { libelle: 'animateur', pourvu: true } },
        { tour: 2, occupant: 1, nom: 'Iris Ombrelle', organisation: null, titre: { libelle: 'animateur', pourvu: true } },
      ],
    });
    assert.deepEqual(siege2, {
      place: 2,
      cellules: [
        { tour: 1, occupant: null, nom: null, organisation: null, titre: { libelle: 'hôte', pourvu: false } },
        { tour: 2, occupant: 3, nom: 'Ondine Lacasse', organisation: null, titre: { libelle: 'hôte', pourvu: false } },
      ],
    });
    assert.deepEqual(siege3.cellules.map(({ nom }) => nom), ['Théo Pervenche', 'Théo Pervenche']);
  });

  test('chaque occupant porte son organisation telle que la charge l’écrit ; null sans organisation, pour une organisation de blancs et pour une place vide', () => {
    const charge = titree();
    const [table7] = feuillesTables(charge, etats(charge));
    assert.deepEqual(
      table7.lignes.map(({ cellules }) => cellules.map(({ organisation }) => organisation)),
      [
        [null, null],
        [null, null],
        ['Coopérative des Saules', 'Coopérative des Saules'],
      ],
    );
  });

  test('une table où personne n’est assis à aucun tour n’a pas de feuille, même quand ses places portent un titre ; une table occupée à un seul tour en a une, ses deux tours en colonnes', () => {
    const charge = titreeDeuxTables();
    charge.titres = [{ table: 2, siege: 1, libelle: 'hôte' }];
    assert.deepEqual(feuillesTables(charge, etats(charge)).map(({ table: id, tours }) => [id, tours]), [
      [2, [1, 2]],
      [1, [1, 2]],
    ]);
    const vides = soiree({ personnes: charge.participants, tables: [table(1, 7, 3), table(2, 3, 2)], plan: [{ sieges: [[1, 2, 3], []] }] });
    assert.deepEqual(feuillesTables(vides, etats(vides)).map(({ table: id }) => id), [1]);
  });

  test('sous parTour, une feuille par table et par tour où quelqu’un y est assis, la table d’abord ; chacune une seule colonne', () => {
    const charge = titreeDeuxTables();
    const feuilles = feuillesTables(charge, etats(charge), { parTour: true });
    assert.deepEqual(feuilles.map(({ table: id, tours }) => [id, tours]), [
      [2, [2]],
      [1, [1]],
      [1, [2]],
    ]);
    assert.deepEqual(feuilles[2].lignes.map(({ place, cellules }) => [place, cellules.map(({ occupant }) => occupant)]), [
      [1, [1]],
      [2, [null]],
      [3, [2]],
    ]);
  });

  test('chaque feuille porte le libellé de sa table, null quand elle n’en a pas, sous parTour comme en colonnes', () => {
    const charge = titreeDeuxTables();
    charge.tables.find(({ id }) => id === 1).libelle = 'Coin des invités';
    assert.deepEqual(feuillesTables(charge, etats(charge)).map(({ table, libelle }) => [table, libelle]), [
      [2, null],
      [1, 'Coin des invités'],
    ]);
    assert.deepEqual(feuillesTables(charge, etats(charge), { parTour: true }).map(({ table, libelle }) => [table, libelle]), [
      [2, null],
      [1, 'Coin des invités'],
      [1, 'Coin des invités'],
    ]);
  });

  test('un exclu n’occupe aucune place : la sienne s’écrit vide', () => {
    const charge = titree();
    charge.participants[1].exclu = true;
    const [table7] = feuillesTables(charge, etats(charge));
    assert.deepEqual(table7.lignes[2].cellules, [vide(1), vide(2)]);
  });

  test('sans tables, aucune feuille', () => {
    const charge = soiree({ personnes: [personne(1, 'Iris', 'Ombrelle')], tables: [], plan: null });
    assert.deepEqual(feuillesTables(charge, etats(charge)), []);
  });

  test('parTour hors des booléens lève TypeError', () => {
    const charge = titree();
    assert.throws(() => feuillesTables(charge, etats(charge), { parTour: 'oui' }), TypeError);
  });
});

describe('feuilleDuTour : le pied et le filigrane d’une feuille d’un seul tour (Q5 b, Q6 c)', () => {
  // La soirée titree retenue à un tour, puis portée à deux : le retenu porte
  // le tour 1, pas le tour 2, que les réservations seules décrivent.
  function retenuCourt() {
    const charge = titree();
    charge.retenu.tours = 1;
    charge.retenu.placement = charge.retenu.placement.slice(0, 1);
    return charge;
  }
  const PIED = Object.freeze({ nom: 'Soirée des Lucioles', date: '2031-05-17', tour: 'tous', horodatage: H_RETENU, version: 'v' });

  test('le tour porté : son numéro, l’horodatage du retenu, sans filigrane ; le tour que le retenu ne porte pas : non daté, BROUILLON', () => {
    const charge = retenuCourt();
    const lus = etats(charge);
    assert.deepEqual(lus.map(({ source }) => source), ['retenu', 'reservations']);
    const feuille = feuilleDe(PIED, true);
    assert.deepEqual(feuilleDuTour(charge, feuille, lus[0]), feuilleDe({ ...PIED, tour: 1 }, false));
    assert.deepEqual(feuilleDuTour(charge, feuille, lus[1]), feuilleDe({ ...PIED, tour: 2, horodatage: null }, true));
  });

  test('une date absente reste absente ; nom et version restent ceux de la feuille reçue', () => {
    const charge = retenuCourt();
    const sansDate = { ...PIED, date: null, nom: 'Club des Merles', version: 'documentation' };
    assert.deepEqual(feuilleDuTour(charge, feuilleDe(sansDate, false), etats(charge)[0]), feuilleDe({ ...sansDate, tour: 1 }, false));
  });
});

describe('largeursColonnes : les colonnes d’une liste imprimée, en pour cent', () => {
  test('la liste d’accueil : nom, prénom, organisation, puis un tour par colonne ; la feuille par table : la place, puis les tours', () => {
    assert.deepEqual(largeursColonnes('accueil', 2), [24, 18, 18, 20, 20]);
    assert.deepEqual(largeursColonnes('tables', 1), [12, 88]);
    assert.deepEqual(largeursColonnes('tables', 4), [12, 22, 22, 22, 22]);
    for (const [vue, tours] of [['accueil', 1], ['accueil', 7], ['tables', 3]]) {
      const somme = largeursColonnes(vue, tours).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(somme - 100) < 1e-9, `${vue} ${tours} : ${somme}`);
    }
  });

  test('la liste d’accueil, la part mesurée d’un tour reçue : chaque tour la prend, les noms se partagent le reste dans leurs proportions', () => {
    const largeurs = largeursColonnes('accueil', 4, 11);
    assert.deepEqual(largeurs.slice(3), [11, 11, 11, 11]);
    const noms = largeurs.slice(0, 3);
    for (const [rang, attendue] of [22.4, 16.8, 16.8].entries()) assert.ok(Math.abs(noms[rang] - attendue) < 1e-9, `${rang} : ${noms[rang]}`);
    assert.ok(Math.abs(largeursColonnes('accueil', 1, 9)[0] - 91 * 0.4) < 1e-9);
  });

  test('la liste d’accueil, des tours qui ne tiennent pas : les noms gardent leur plancher d’un tiers, les tours se partagent le reste', () => {
    const largeurs = largeursColonnes('accueil', 6, 12);
    for (const part of largeurs.slice(3)) assert.ok(Math.abs(part - 200 / 18) < 1e-9, String(part));
    assert.ok(Math.abs(largeurs.slice(0, 3).reduce((a, b) => a + b, 0) - 100 / 3) < 1e-9);
    // Juste au plancher, les tours tiennent encore.
    assert.deepEqual(largeursColonnes('accueil', 2, 100 / 3).slice(3), [100 / 3, 100 / 3]);
    // Une part plus large que la page ne lève pas : le plancher la borne.
    assert.deepEqual(largeursColonnes('accueil', 1, 150).slice(3), [100 - 100 / 3]);
    for (const [tours, part] of [[4, 11], [6, 12], [3, 40], [1, 0.5], [1, 150]]) {
      const somme = largeursColonnes('accueil', tours, part).reduce((a, b) => a + b, 0);
      assert.ok(Math.abs(somme - 100) < 1e-9, `${tours} ${part} : ${somme}`);
    }
  });

  test('une vue, un nombre de tours ou une part hors de leur domaine lèvent RangeError', () => {
    assert.throws(() => largeursColonnes('plan', 1), RangeError);
    assert.throws(() => largeursColonnes('accueil', 0), RangeError);
    assert.throws(() => largeursColonnes('tables', 1.5), RangeError);
    for (const part of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '10']) {
      assert.throws(() => largeursColonnes('accueil', 2, part), RangeError, String(part));
    }
    assert.throws(() => largeursColonnes('tables', 2, 10), RangeError);
  });
});

describe('les blocs de tours de la liste d’accueil (§ 7.4)', () => {
  // La part que les tours d'un bloc se partagent au plus : ce que le
  // plancher d'un tiers des noms laisse.
  const BUDGET = 200 / 3;
  const numeros = (n) => Array.from({ length: n }, (_, rang) => rang + 1);
  // Une ligne de la liste d'accueil à tours tours : la personne id, à la
  // table du numéro de chaque tour, sans siège.
  const ligneDeTours = (id, tours) => ({
    participant: id,
    nom: `Brumaire${id}`,
    prenom: id % 2 === 0 ? null : 'Ysaline',
    organisation: null,
    places: numeros(tours).map((tour) => ({ tour, table: tour, siege: null })),
  });
  const lignesDeTours = (tours) => [3, 1, 2].map((id) => ligneDeTours(id, tours));
  const tailles = (blocs) => blocs.map(({ tours }) => tours.length);
  const proche = (a, b) => Math.abs(a - b) < 1e-9;

  test('toursParBloc : autant de tours que leur part en tient dans ce que le plancher des noms laisse, entre 1 et les tours', () => {
    assert.equal(toursParBloc(2, 30), 30);
    assert.equal(toursParBloc(2, 31), 31);
    assert.equal(toursParBloc(2, 34), 33);
    assert.equal(toursParBloc(BUDGET / 34, 100), 34, 'juste au plancher, le bruit flottant ne retire pas un tour');
    assert.equal(toursParBloc(10, 30), 6);
    assert.equal(toursParBloc(100 / 3, 3), 2);
    // Un libellé plus large que tout ce que le plancher laisse : un tour par bloc.
    assert.equal(toursParBloc(80, 5), 1);
    assert.equal(toursParBloc(80, 1), 1);
    assert.equal(toursParBloc(0.5, 1), 1);
    for (const part of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '10']) assert.throws(() => toursParBloc(part, 3), RangeError, String(part));
    for (const tours of [0, 1.5, Number.NaN]) assert.throws(() => toursParBloc(10, tours), RangeError, String(tours));
  });

  test('blocsAccueil : des blocs consécutifs de taille égale, le dernier plus court ; 30, 31, 60 et 100 tours', () => {
    for (const [tours, taille, attendues] of [
      [30, 30, [30]],
      [30, 6, [6, 6, 6, 6, 6]],
      [31, 30, [16, 15]],
      [31, 6, [6, 6, 6, 6, 6, 1]],
      [60, 34, [30, 30]],
      [60, 7, [7, 7, 7, 7, 7, 7, 7, 7, 4]],
      [100, 34, [34, 34, 32]],
      [100, 6, [...Array.from({ length: 16 }, () => 6), 4]],
      [1, 1, [1]],
      [1, 5, [1]],
    ]) {
      const blocs = blocsAccueil(lignesDeTours(tours), numeros(tours), taille);
      assert.deepEqual(tailles(blocs), attendues, `${tours} tours par ${taille}`);
      assert.deepEqual(
        blocs.flatMap((bloc) => bloc.tours),
        numeros(tours),
        `${tours} tours par ${taille} : chaque tour une fois, dans l’ordre`,
      );
    }
    const [premier] = blocsAccueil(lignesDeTours(100), numeros(100), 34);
    assert.deepEqual([premier.tours[0], premier.tours.at(-1)], [1, 34]);
    assert.equal(t('feuilles.accueil.tours', { premier: 1, dernier: 34 }), 'Tours 1 à 34');
    assert.equal(t('feuilles.accueil.tours', { premier: 7, dernier: 7 }), t('feuilles.tour', { tour: 7 }));
  });

  test('blocsAccueil : chaque bloc répète chaque ligne, ses noms entiers, et ne garde de ses places que celles de ses tours', () => {
    const lignes = lignesDeTours(31);
    const blocs = blocsAccueil(lignes, numeros(31), 6);
    for (const bloc of blocs) {
      assert.deepEqual(ids(bloc.lignes), ids(lignes), `tours ${bloc.tours[0]} à ${bloc.tours.at(-1)}`);
      bloc.lignes.forEach((ligne, rang) => {
        const { places, ...noms } = lignes[rang];
        const { places: gardees, ...nomsDuBloc } = ligne;
        assert.deepEqual(nomsDuBloc, noms);
        assert.deepEqual(gardees, places.filter(({ tour }) => bloc.tours.includes(tour)));
      });
    }
    // Une liste sans personne garde ses blocs de tours, chacun sans ligne.
    assert.deepEqual(blocsAccueil([], numeros(31), 30).map(({ tours, lignes: l }) => [tours.length, l.length]), [[16, 0], [15, 0]]);
    // Les lignes reçues ne changent pas.
    assert.deepEqual(lignes, lignesDeTours(31));
  });

  test('blocsAccueil : une taille hors du domaine, des places qui ne suivent pas les tours lèvent RangeError', () => {
    for (const taille of [0, -1, 1.5, Number.NaN, '6']) assert.throws(() => blocsAccueil(lignesDeTours(3), numeros(3), taille), RangeError, String(taille));
    assert.throws(() => blocsAccueil(lignesDeTours(3), numeros(4), 2), RangeError, 'une place de moins que de tours');
  });

  test('chaque bloc à ses largeurs : chaque tour au moins sa part, les noms au moins leur plancher ; un libellé plus large que la page replie dans un bloc d’un tour', () => {
    for (const [tours, part] of [
      [30, 10],
      [31, 10],
      [60, 9.5],
      [100, BUDGET / 34],
      [100, 11],
      [1, 20],
    ]) {
      const blocs = blocsAccueil(lignesDeTours(tours), numeros(tours), toursParBloc(part, tours));
      for (const bloc of blocs) {
        const largeurs = largeursColonnes('accueil', bloc.tours.length, part);
        const ou = `${tours} tours, part ${part}, tours ${bloc.tours[0]} à ${bloc.tours.at(-1)}`;
        for (const largeur of largeurs.slice(3)) assert.ok(proche(largeur, part), `${ou} : ${largeur}`);
        assert.ok(largeurs.slice(0, 3).reduce((a, b) => a + b, 0) >= 100 / 3 - 1e-9, ou);
        assert.ok(proche(largeurs.reduce((a, b) => a + b, 0), 100), ou);
      }
    }
    // Plus large que ce que le plancher laisse : un tour par bloc, à toute
    // cette largeur, où son libellé replie ; les noms gardent leur tiers.
    const blocs = blocsAccueil(lignesDeTours(3), numeros(3), toursParBloc(80, 3));
    assert.deepEqual(tailles(blocs), [1, 1, 1]);
    assert.ok(proche(largeursColonnes('accueil', 1, 80)[3], BUDGET));
  });
});

describe('les groupes de tours de la feuille par table', () => {
  // Une feuille de deux places et de tours tours, numérotés de 1 ; chaque
  // cellule porte son tour et sa place.
  const feuilleDeTours = (table, tours) => ({
    table,
    numero: table,
    libelle: table === 2 ? 'Coin des invités' : null,
    tours: Array.from({ length: tours }, (_, rang) => rang + 1),
    lignes: [1, 2].map((place) => ({
      place,
      cellules: Array.from({ length: tours }, (_, rang) => ({ tour: rang + 1, occupant: place, nom: `n${place}`, titre: null })),
    })),
  });

  test('toursParGroupe : autant de colonnes que la part de la place en laisse à chacune, entre 1 et les tours', () => {
    assert.equal(toursParGroupe(22, 4), 4);
    assert.equal(toursParGroupe(22, 10), 4);
    assert.equal(toursParGroupe(88 / 6, 10), 6);
    assert.equal(toursParGroupe(14.7, 10), 5);
    assert.equal(toursParGroupe(89, 10), 1);
    assert.equal(toursParGroupe(500, 3), 1);
    assert.equal(toursParGroupe(1, 3), 3);
    for (const part of [0, -1, Number.NaN, Number.POSITIVE_INFINITY, '10']) assert.throws(() => toursParGroupe(part, 3), RangeError, String(part));
    for (const tours of [0, 1.5, Number.NaN]) assert.throws(() => toursParGroupe(10, tours), RangeError, String(tours));
  });

  test('grouperTours : des groupes consécutifs, de tailles égales à un près, les plus grands d’abord ; chaque cellule suit son tour', () => {
    const feuilles = [feuilleDeTours(1, 10), feuilleDeTours(2, 7), feuilleDeTours(3, 4)];
    const groupes = grouperTours(feuilles, [6, 3, 4]);
    // Chaque groupe porte le numéro et le libellé de sa table.
    assert.deepEqual(
      groupes.map(({ table, numero, libelle }) => [table, numero, libelle]),
      [[1, 1, null], [1, 1, null], [2, 2, 'Coin des invités'], [2, 2, 'Coin des invités'], [2, 2, 'Coin des invités'], [3, 3, null]],
    );
    assert.deepEqual(
      groupes.map(({ table, tours, source }) => [table, tours, source]),
      [
        [1, [1, 2, 3, 4, 5], 0],
        [1, [6, 7, 8, 9, 10], 0],
        [2, [1, 2, 3], 1],
        [2, [4, 5], 1],
        [2, [6, 7], 1],
        [3, [1, 2, 3, 4], 2],
      ],
    );
    for (const groupe of groupes) {
      for (const { place, cellules } of groupe.lignes) {
        assert.deepEqual(
          cellules.map(({ tour }) => tour),
          groupe.tours,
          `table ${groupe.table}, place ${place}`,
        );
      }
    }
    assert.deepEqual(
      grouperTours(feuilles, [1, 7, 9]).map(({ tours }) => tours.length),
      [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 7, 4],
    );
    assert.throws(() => grouperTours(feuilles, [1, 2]), RangeError, 'un compte autre');
    assert.throws(() => grouperTours(feuilles, [1, 0, 2]), RangeError, 'une taille nulle');
  });

  test('resserrerGroupes : une page seule ramène sa feuille à la moitié de son plus grand groupe ; un groupe d’un tour reste ; rien de seul, null', () => {
    const feuilles = [feuilleDeTours(1, 10), feuilleDeTours(2, 10)];
    const parGroupe = [5, 5];
    const groupes = grouperTours(feuilles, parGroupe);
    const pages = groupes.map((_, feuille) => ({ feuille, seule: false }));
    assert.equal(resserrerGroupes(parGroupe, groupes, pages), null);
    const seule = pages.map((page) => (page.feuille === 3 ? { ...page, seule: true } : page));
    assert.deepEqual(resserrerGroupes(parGroupe, groupes, seule), [5, 3]);
    const unParGroupe = grouperTours(feuilles, [1, 5]);
    const seuleDUnTour = unParGroupe.map((_, feuille) => ({ feuille, seule: feuille === 0 }));
    assert.equal(resserrerGroupes([1, 5], unParGroupe, seuleDUnTour), null);
    assert.deepEqual(resserrerGroupes([1, 5], unParGroupe, [...seuleDUnTour, { feuille: unParGroupe.length - 1, seule: true }]), [1, 3]);
  });
});

describe('textesCellule : les textes d’une cellule de la feuille par table, dans l’ordre où elle les pose', () => {
  test('le nom ou la place vide, le séparateur et l’organisation, puis le libellé du titre, puis « non pourvu » ; le texte vide pour ce qui manque', () => {
    const titre = { libelle: 'animateur', pourvu: true };
    assert.deepEqual(textesCellule({ tour: 1, occupant: 1, nom: 'Iris Ombrelle', organisation: null, titre }, t), [
      'Iris Ombrelle',
      '',
      '',
      'animateur',
      '',
    ]);
    assert.deepEqual(textesCellule({ tour: 1, occupant: 1, nom: 'Iris Ombrelle', organisation: 'Club des Merles', titre }, t), [
      'Iris Ombrelle',
      t('feuilles.tables.avantOrganisation'),
      'Club des Merles',
      'animateur',
      '',
    ]);
    assert.deepEqual(textesCellule({ tour: 1, occupant: null, nom: null, organisation: null, titre: { libelle: 'hôte', pourvu: false } }, t), [
      t('feuilles.tables.vide'),
      '',
      '',
      'hôte',
      t('feuilles.tables.titreNonPourvu'),
    ]);
    assert.deepEqual(textesCellule({ tour: 2, occupant: 3, nom: 'Théo Pervenche', organisation: null, titre: null }, t), ['Théo Pervenche', '', '', '', '']);
  });

  test('le séparateur s’ouvre et se ferme d’un blanc, et ne se réduit pas à des blancs : il a son nœud de texte à lui', () => {
    const separateur = t('feuilles.tables.avantOrganisation');
    assert.match(separateur, /^\s\S+\s$/u);
  });
});

describe('partsDesCellules : les textes que chaque cellule d’une ligne pose sur une page', () => {
  const cellules = [
    { tour: 1, occupant: 1, nom: 'Iris Ombrelle', organisation: 'Club des Merles', titre: null },
    { tour: 2, occupant: null, nom: null, organisation: null, titre: { libelle: 'hôte', pourvu: false } },
  ];

  test('sans morceau, les textes entiers de chaque cellule (textesCellule)', () => {
    assert.deepEqual(partsDesCellules(cellules, t, null), cellules.map((cellule) => textesCellule(cellule, t)));
  });

  test('un morceau garde de chaque texte ce qui tombe dans ses bornes, les textes mis bout à bout dans l’ordre du document', () => {
    const bout = textesCellule(cellules[0], t).join('');
    const parts = partsDesCellules(cellules, t, { debut: 5, fin: bout.length + 5 });
    assert.deepEqual(parts[0], ['Ombrelle', t('feuilles.tables.avantOrganisation'), 'Club des Merles', '', '']);
    assert.deepEqual(parts[1], [t('feuilles.tables.vide').slice(0, 5), '', '', '', '']);
  });
});

describe('plafondEchelle : l’échelle au-delà de laquelle un mot passerait la largeur de sa colonne', () => {
  test('la plus petite des deux marges : les colonnes de tour sur la part du plus long mot, la colonne de la place sur la part de sa tête', () => {
    // 88 % pour deux tours, 44 % chacun ; un mot de 22 % double au plus.
    assert.equal(plafondEchelle(2, 22, 4), 2);
    // La place, 12 %, sur une tête de 10 % : 1,2.
    assert.equal(plafondEchelle(2, 22, 10), 1.2);
    // Un tour de plus : 88 / 3 / 22 = 4 / 3.
    assert.ok(Math.abs(plafondEchelle(3, 22, 4) - 4 / 3) < 1e-12);
  });

  test('décroît quand un mot s’élargit ou qu’un tour s’ajoute', () => {
    let avant = Infinity;
    for (const part of [5, 10, 20, 40, 80]) {
      const plafond = plafondEchelle(2, part, 1);
      assert.ok(plafond < avant, String(part));
      avant = plafond;
    }
    avant = Infinity;
    for (let tours = 1; tours <= 6; tours += 1) {
      const plafond = plafondEchelle(tours, 10, 1);
      assert.ok(plafond < avant, String(tours));
      avant = plafond;
    }
  });

  test('une part ou un nombre de tours hors du domaine lève RangeError', () => {
    for (const [tours, partTour, partPlace] of [
      [0, 10, 1],
      [1.5, 10, 1],
      [2, 0, 1],
      [2, Infinity, 1],
      [2, 10, -1],
      [2, 10, Number.NaN],
    ]) {
      assert.throws(() => plafondEchelle(tours, partTour, partPlace), RangeError, JSON.stringify([tours, partTour, partPlace]));
    }
  });
});

describe('echelleAjustee : la taille du texte d’une feuille par table, bornée', () => {
  // Une page de hauteur utile donnée, où la feuille mesure hauteur × échelle.
  const tientDans = (utile, hauteur) => (echelle) => hauteur * echelle <= utile;

  test('la plus grande échelle du pas, de 1 à ECHELLE_TEXTE_MAX, qui tient ; 1 quand rien au-delà ne tient', () => {
    assert.equal(ECHELLE_TEXTE_MAX, 1.5);
    assert.equal(echelleAjustee(Infinity, tientDans(1000, 100)), ECHELLE_TEXTE_MAX, 'une feuille courte s’arrête au plafond');
    assert.equal(echelleAjustee(Infinity, tientDans(125, 100)), 1.25);
    assert.equal(echelleAjustee(Infinity, tientDans(100, 100)), 1, 'au plancher');
    assert.equal(echelleAjustee(Infinity, () => false), 1, 'rien ne tient : le plancher, jamais moins');
  });

  test('jamais au-delà du plafond reçu, même quand la page laisse de la place ; un plafond sous 1 laisse le plancher', () => {
    assert.equal(echelleAjustee(1.2, tientDans(1000, 100)), 1.1875);
    assert.equal(echelleAjustee(1.25, tientDans(1000, 100)), 1.25);
    assert.equal(echelleAjustee(0.5, tientDans(1000, 100)), 1);
  });

  test('l’échelle croît avec la hauteur utile, et ne la passe jamais', () => {
    let avant = 0;
    for (let utile = 90; utile <= 200; utile += 3) {
      const echelle = echelleAjustee(Infinity, tientDans(utile, 100));
      assert.ok(echelle >= avant, String(utile));
      assert.ok(echelle >= 1 && echelle <= ECHELLE_TEXTE_MAX, String(utile));
      if (echelle > 1) assert.ok(100 * echelle <= utile, String(utile));
      assert.ok(echelle + PAS_ECHELLE > Math.min(ECHELLE_TEXTE_MAX, utile / 100) - 1e-12, `la plus grande, ${utile}`);
      avant = echelle;
    }
  });

  test('tient n’est jamais appelée au plancher ni hors des bornes', () => {
    const essayees = [];
    echelleAjustee(1.3, (echelle) => {
      essayees.push(echelle);
      return echelle < 1.2;
    });
    assert.ok(essayees.length > 0);
    assert.ok(essayees.every((echelle) => echelle > 1 && echelle <= 1.3), JSON.stringify(essayees));
  });

  test('un plafond qui n’est pas un nombre, ou un prédicat qui n’est pas une fonction, lève', () => {
    assert.throws(() => echelleAjustee(Number.NaN, () => true), RangeError);
    assert.throws(() => echelleAjustee('2', () => true), RangeError);
    assert.throws(() => echelleAjustee(2, null), TypeError);
  });
});

describe('echellesParTable : une échelle par table', () => {
  test('chaque groupe reçoit la plus petite échelle des groupes de sa table, groupes d’autres feuilles compris', () => {
    const groupes = [{ table: 4 }, { table: 4 }, { table: 9 }, { table: 4 }];
    assert.deepEqual(echellesParTable(groupes, [1.5, 1.25, 1.375, 1.5]), [1.25, 1.25, 1.375, 1.25]);
    assert.deepEqual(echellesParTable([], []), []);
  });

  test('une échelle par groupe, ou RangeError', () => {
    assert.throws(() => echellesParTable([{ table: 1 }], []), RangeError);
  });
});

describe('textesLigneAccueil : les textes d’une ligne de la liste d’accueil, dans l’ordre où elle les pose', () => {
  test('le nom, le prénom, l’organisation, puis le libellé de la place à chaque tour ; le texte vide pour un champ absent ou blanc', () => {
    const places = [
      { tour: 1, table: 2, siege: null },
      { tour: 2, table: null, siege: null },
      { tour: 3, table: 4, siege: 5 },
    ];
    assert.deepEqual(textesLigneAccueil({ participant: 1, nom: 'Ombrelle', prenom: 'Iris', organisation: 'Club des Merles', places }, t), [
      'Ombrelle',
      'Iris',
      'Club des Merles',
      t('feuilles.accueil.table', { table: 2 }),
      t('feuilles.accueil.reserve'),
      t('feuilles.accueil.tableSiege', { table: 4, siege: 5 }),
    ]);
    assert.deepEqual(textesLigneAccueil({ participant: 2, nom: 'Pervenche', prenom: null, organisation: ' ', places: places.slice(1, 2) }, t), [
      'Pervenche',
      '',
      '',
      t('feuilles.accueil.reserve'),
    ]);
  });
});
