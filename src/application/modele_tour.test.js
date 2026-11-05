// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle d'un tour (§ 5.6), sans solveur : les données agrégées
// de chaque tour — unités, remplissage, réservés, personne seule en conflit,
// absence, causes 'reserves' et 'places' — puis le texte LP — noms indexés,
// aucun libellé ni mot-clé, cordes, perspective, cliques, capacité écrite
// seulement quand elle lie, constante, déterminisme à l'octet. Les charges se
// construisent ici, sur des noms inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { normaliser } from '../moteur/configuration.js';
import { creerCharge } from '../stockage/document.js';
import { configurationDe } from './configuration.js';
import { diagnostiquerCharge } from './diagnostic.js';
import { cliquesCouvrantes, donneesDesTours, lpTour } from './modele_tour.js';

const MERLES = 'Club des Merles';
const HERONS = 'Cercle des Hérons';
const LOUTRES = 'Atelier des Loutres';

// Une personne inventée, sans organisation tant qu'on ne lui en donne pas.
const personne = (id, organisation) => ({
  id,
  nom: `Grèbe${id}`,
  prenom: 'Iris',
  organisation,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

/**
 * Une charge construite : effectifs, [organisation, nombre de membres], dans
 * l'ordre où les membres reçoivent leurs identifiants à partir de 1 ;
 * sansOrganisation personnes de plus ; seuls, une personne sans organisation
 * de plus par liste d'organisations qu'elle nomme ; capacites, une table par
 * capacité ; conflits, [organisation, organisations nommées] : le premier
 * membre de la première nomme les autres ; reservations, [participant,
 * table, tour] — tour absent : tous les tours.
 */
function chargeDe({ effectifs, sansOrganisation = 0, seuls = [], capacites, tours = 2, conflits = [], reservations = [], separer = true }) {
  const charge = creerCharge({ id: 'evt-tour', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours });
  const organisations = [...effectifs.flatMap(([organisation, n]) => Array(n).fill(organisation)), ...Array(sansOrganisation).fill(null)];
  charge.participants = organisations.map((organisation, rang) => personne(rang + 1, organisation));
  for (const [organisation, nommees] of conflits) {
    charge.participants.find((membre) => membre.organisation === organisation).conflits = nommees;
  }
  for (const nommees of seuls) charge.participants.push({ ...personne(charge.participants.length + 1, null), conflits: nommees });
  charge.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  charge.reservations = reservations.map(([participant, table, tour = null]) => ({
    participant,
    table,
    siege: null,
    portee: tour === null ? 'tous' : 'tour',
    tour,
  }));
  charge.reglages.separerOrganisations = separer;
  charge.prochainsIds = { participant: charge.participants.length + 1, table: capacites.length + 1, proposition: 1 };
  return charge;
}

const toursDe = (charge) => donneesDesTours(normaliser(configurationDe(charge)));

// Un tour à la main : T tables de s sièges libres, des unités sans réservé.
const tourDe = ({ s, unites, conflits = [] }) => ({
  r: 0,
  T: s.length,
  s,
  unites: unites.map(({ groupe = 0, m = 0, a = s.map(() => 0) }) => ({ groupe, m, a })),
  remplissage: 0,
  conflits,
  infaisable: null,
});

describe('donneesDesTours : les données agrégées de chaque tour', () => {
  test('une unité par organisation présente, dans l’ordre des présents ; les sans-organisation libres forment le remplissage', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 5], [HERONS, 3]], sansOrganisation: 2, capacites: [4, 4, 4], conflits: [[MERLES, [HERONS]]] });
    const tours = toursDe(charge);
    assert.equal(tours.length, 2);
    tours.forEach((tour, r) => {
      assert.deepEqual(tour, {
        r,
        T: 3,
        s: [4, 4, 4],
        unites: [
          { groupe: 0, m: 5, a: [0, 0, 0] },
          { groupe: 1, m: 3, a: [0, 0, 0] },
        ],
        remplissage: 2,
        conflits: [[0, 1]],
        infaisable: null,
      });
    });
  });

  test('un réservé compte dans a à sa table et retire un siège libre ; un sans-organisation réservé ne remplit rien', () => {
    const charge = chargeDe({
      effectifs: [[MERLES, 5], [HERONS, 3]],
      sansOrganisation: 2,
      capacites: [4, 4, 4],
      reservations: [[2, 2], [9, 3, 2]],
    });
    const [premier, second] = toursDe(charge);
    assert.deepEqual(premier.unites[0], { groupe: 0, m: 4, a: [0, 1, 0] });
    assert.deepEqual(premier.s, [4, 3, 4]);
    assert.equal(premier.remplissage, 2);
    assert.deepEqual(premier.conflits, []);
    assert.deepEqual(second.s, [4, 3, 3]);
    assert.equal(second.remplissage, 1);
  });

  test('une personne sans organisation qui nomme une organisation forme son unité, groupe −1, en conflit avec elle', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 4], [HERONS, 3]], seuls: [[HERONS]], capacites: [4, 4] });
    const [tour] = toursDe(charge);
    assert.deepEqual(tour.unites, [
      { groupe: 0, m: 4, a: [0, 0] },
      { groupe: 1, m: 3, a: [0, 0] },
      { groupe: -1, m: 1, a: [0, 0] },
    ]);
    assert.deepEqual(tour.conflits, [[1, 2]]);
    assert.equal(tour.remplissage, 0);
  });

  test('la liste d’un exclu lie encore son organisation', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 4], [HERONS, 3]], capacites: [4, 4] });
    charge.participants[0].exclu = true;
    charge.participants[0].conflits = [HERONS];
    const [tour] = toursDe(charge);
    assert.deepEqual(tour.unites.map(({ m }) => m), [3, 3]);
    assert.deepEqual(tour.conflits, [[0, 1]]);
  });

  test('un absent ne compte pas à son tour d’absence ; une organisation absente n’a pas d’unité', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 4], [HERONS, 3], [LOUTRES, 2]], capacites: [4, 4, 4], conflits: [[MERLES, [LOUTRES]]] });
    charge.participants[1].presence = [1];
    for (const membre of charge.participants.filter(({ organisation }) => organisation === LOUTRES)) membre.presence = [1];
    const [premier, second] = toursDe(charge);
    assert.deepEqual(premier.unites.map(({ groupe, m }) => [groupe, m]), [[0, 4], [1, 3], [2, 2]]);
    assert.deepEqual(premier.conflits, [[0, 2]]);
    assert.deepEqual(second.unites.map(({ groupe, m }) => [groupe, m]), [[0, 3], [1, 3]]);
    assert.deepEqual(second.conflits, []);
  });

  test('deux unités en conflit réservées à une même table d’un tour : « reserves » à ce tour seul', () => {
    const charge = chargeDe({
      effectifs: [[MERLES, 4], [HERONS, 3]],
      capacites: [4, 4],
      conflits: [[MERLES, [HERONS]]],
      reservations: [[1, 1], [5, 1, 1]],
    });
    assert.deepEqual(toursDe(charge).map(({ infaisable }) => infaisable), ['reserves', null]);
  });

  test('« places » au tour qui manque de sièges, exactement là où le diagnostic compte des places manquantes ; elle passe avant « reserves »', () => {
    const charge = chargeDe({
      effectifs: [[MERLES, 5], [HERONS, 4]],
      sansOrganisation: 1,
      capacites: [3, 3, 3],
      conflits: [[MERLES, [HERONS]]],
      reservations: [[1, 1, 1], [6, 1, 1]],
    });
    charge.participants[9].presence = [2];
    charge.participants[8].presence = [1];
    charge.participants[7].presence = [1];
    // Une personne de plus, présente au tour 1 seulement : 10 présents pour
    // 9 places au tour 1, 8 au tour 2.
    charge.participants.push({ ...personne(11, null), presence: [1] });
    charge.prochainsIds.participant = 12;
    const tours = toursDe(charge);
    assert.deepEqual(diagnostiquerCharge(charge).diagnostic.placesManquantesParTour, [1, 0]);
    assert.deepEqual(tours.map(({ infaisable }) => infaisable), ['places', null]);
  });
});

describe('lpTour : le texte LP d’un tour', () => {
  // Deux organisations en conflit, 3 et 2 membres, deux tables de 3.
  const PETIT = tourDe({ s: [3, 3], unites: [{ groupe: 0, m: 3 }, { groupe: 1, m: 2 }], conflits: [[0, 1]] });

  test('le texte exact du petit tour : cordes en perspective, affectation, capacité, cliques, sections', () => {
    assert.deepEqual(lpTour(PETIT), {
      lp: [
        'Minimize',
        ' obj: c0_0 + c0_1 + c1_0 + c1_1',
        'Subject To',
        ' r0: y0_0 - 3 z0_0 <= 0',
        ' r1: c0_0 - y0_0 + z0_0 >= 0',
        ' r2: c0_0 - 2 y0_0 + 3 z0_0 >= 0',
        ' r3: y0_1 - 3 z0_1 <= 0',
        ' r4: c0_1 - y0_1 + z0_1 >= 0',
        ' r5: c0_1 - 2 y0_1 + 3 z0_1 >= 0',
        ' r6: y1_0 - 2 z1_0 <= 0',
        ' r7: c1_0 - y1_0 + z1_0 >= 0',
        ' r8: y1_1 - 2 z1_1 <= 0',
        ' r9: c1_1 - y1_1 + z1_1 >= 0',
        ' r10: y0_0 + y0_1 = 3',
        ' r11: y1_0 + y1_1 = 2',
        ' r12: y0_0 + y1_0 <= 3',
        ' r13: z0_0 + z1_0 <= 1',
        ' r14: y0_1 + y1_1 <= 3',
        ' r15: z0_1 + z1_1 <= 1',
        'Bounds',
        ' 0 <= y0_0 <= 3',
        ' c0_0 >= 0',
        ' 0 <= y0_1 <= 3',
        ' c0_1 >= 0',
        ' 0 <= y1_0 <= 2',
        ' c1_0 >= 0',
        ' 0 <= y1_1 <= 2',
        ' c1_1 >= 0',
        'General',
        ' y0_0 y0_1 y1_0 y1_1',
        'Binary',
        ' z0_0 z0_1 z1_0 z1_1',
        'End',
        '',
      ].join('\n'),
      constante: 0,
    });
  });

  test('sans conflit, ni z ni perspective : les cordes de C(a + y, 2) au-dessus des réservés, et la constante n’y entre pas', () => {
    const tour = tourDe({ s: [2, 5], unites: [{ groupe: 0, m: 2, a: [2, 0] }] });
    const { lp, constante } = lpTour(tour);
    assert.equal(constante, 0);
    // a = 2, borne 2 à la première table : k = 2 et 3, c ≥ k(2 + y) − k(k + 1)/2.
    assert.match(lp, /^ r0: c0_0 - 2 y0_0 >= 1$/m);
    assert.match(lp, /^ r1: c0_0 - 3 y0_0 >= 0$/m);
    assert.match(lp, /^ c0_0 >= 1$/m);
    assert.doesNotMatch(lp, /z\d/);
    assert.doesNotMatch(lp, /^Binary$/m);
  });

  test('la capacité ne s’écrit que si les bornes des libres la dépassent', () => {
    const large = lpTour(tourDe({ s: [8, 8], unites: [{ groupe: 0, m: 3 }, { groupe: 1, m: 4 }] })).lp;
    assert.doesNotMatch(large, /<= 8$/m);
    const serre = lpTour(tourDe({ s: [5, 8], unites: [{ groupe: 0, m: 3 }, { groupe: 1, m: 4 }] })).lp;
    assert.match(serre, /: y0_0 \+ y1_0 <= 5$/m);
    assert.doesNotMatch(serre, /: y0_1 \+ y1_1 <= 8$/m);
  });

  test('une organisation entièrement réservée n’a aucune variable : ses collisions sont la constante', () => {
    const tour = tourDe({ s: [7, 10], unites: [{ groupe: 0, m: 0, a: [3, 0] }, { groupe: 1, m: 2 }] });
    const { lp, constante } = lpTour(tour);
    assert.equal(constante, 3);
    assert.doesNotMatch(lp, /[yzc]0_/);
  });

  test('un réservé d’une unité en conflit ferme sa table à l’autre unité, qui n’y a ni y ni z ; lui-même n’y a pas de z', () => {
    const tour = tourDe({ s: [3, 4], unites: [{ groupe: 0, m: 2, a: [1, 0] }, { groupe: 1, m: 2 }], conflits: [[0, 1]] });
    const { lp } = lpTour(tour);
    assert.doesNotMatch(lp, /\b[yz]1_0\b/);
    assert.doesNotMatch(lp, /\bz0_0\b/);
    assert.match(lp, /\bz0_1\b/);
    assert.match(lp, /^ 0 <= y0_0 <= 2$/m);
  });

  test('une unité qui n’a plus aucune table possible : « affectation », sans texte', () => {
    const tour = tourDe({ s: [3], unites: [{ groupe: 0, m: 0, a: [1] }, { groupe: -1, m: 1 }], conflits: [[0, 1]] });
    assert.deepEqual(lpTour(tour), { infaisable: 'affectation' });
  });

  test('aucune variable : lp vaut null, et la constante est la réponse', () => {
    const tour = tourDe({ s: [5, 8], unites: [{ groupe: 0, m: 0, a: [3, 0] }, { groupe: 1, m: 0, a: [0, 2] }] });
    assert.deepEqual(lpTour(tour), { lp: null, constante: 4 });
  });

  test('le mode A garde le domaine, sans aucune variable c, objectif nul et constante 0', () => {
    const tour = tourDe({ s: [3, 3], unites: [{ groupe: 0, m: 3 }, { groupe: 1, m: 0, a: [0, 2] }], conflits: [[0, 1]] });
    const ac = lpTour(tour);
    const a = lpTour(tour, { mode: 'A' });
    assert.equal(ac.constante, 1);
    assert.equal(a.constante, 0);
    assert.doesNotMatch(a.lp, /\bc\d/);
    assert.match(a.lp, /^ obj: 0 y0_0$/m);
    // Le domaine : chaque ligne qui ne nomme ni l'objectif ni une variable c,
    // les noms des lignes retirés.
    const domaine = (texte) => texte.split('\n').filter((ligne) => !/c\d|^ obj:/.test(ligne)).map((ligne) => ligne.replace(/^ r\d+:/, ' r:'));
    assert.deepEqual(domaine(a.lp), domaine(ac.lp));
  });

  test('noms par indices seuls : aucun libellé, aucun mot-clé du format LP parmi les noms, aucun chiffre en tête', () => {
    const charge = chargeDe({ effectifs: [['st', 4], ['inf', 3], ['free', 2], ['bin', 2]], capacites: [3, 3, 3, 3], conflits: [['st', ['inf', 'free']], ['bin', ['inf']]] });
    const [tour] = toursDe(charge);
    const { lp } = lpTour(tour);
    const sections = new Set(['Minimize', 'Subject', 'To', 'Bounds', 'General', 'Binary', 'End', 'obj:']);
    for (const mot of lp.split(/\s+/).filter(Boolean)) {
      if (sections.has(mot) || /^(?:[+-]|<=|>=|=|-?\d+)$/.test(mot)) continue;
      assert.match(mot, /^(?:[yzc]\d+_\d+|r\d+:)$/, mot);
    }
  });

  test('une ligne de plus de 24 termes se coupe, et une liste de plus de 24 noms aussi', () => {
    const tour = tourDe({ s: Array(30).fill(2), unites: [{ groupe: 0, m: 30 }] });
    const lignes = lpTour(tour).lp.split('\n');
    const affectation = lignes.findIndex((ligne) => ligne.includes('y0_0 + y0_1'));
    assert.match(lignes[affectation], /y0_23$/);
    assert.match(lignes[affectation + 1], /^ \+ y0_24 \+ .* \+ y0_29 = 30$/);
    const general = lignes.indexOf('General');
    assert.equal(lignes[general + 1].trim().split(' ').length, 24);
    assert.equal(lignes[general + 2].trim().split(' ').length, 6);
    for (const ligne of lignes) assert.ok(ligne.split(/ [+-] /).length <= 24, ligne);
  });

  test('déterministe à l’octet ; deux tours sans absence ni réservation de tour donnent le même texte', () => {
    const charge = chargeDe({ effectifs: [[MERLES, 6], [HERONS, 5], [LOUTRES, 4]], capacites: [4, 4, 3, 3, 2], tours: 3, conflits: [[MERLES, [HERONS, LOUTRES]]] });
    const tours = toursDe(charge);
    const textes = tours.map((tour) => lpTour(tour).lp);
    assert.equal(textes[0], textes[1]);
    assert.equal(textes[1], textes[2]);
    assert.equal(lpTour(structuredClone(tours[0])).lp, textes[0]);
    charge.participants[0].presence = [1, 3];
    assert.notEqual(lpTour(toursDe(charge)[1]).lp, textes[0]);
  });
});

describe('cliquesCouvrantes : une couverture gloutonne des conflits par cliques', () => {
  test('un triangle : une clique ; un chemin : une clique par arête ; chaque arête couverte', () => {
    assert.deepEqual(cliquesCouvrantes(3, [[0, 1], [0, 2], [1, 2]]), [[0, 1, 2]]);
    assert.deepEqual(cliquesCouvrantes(3, [[0, 1], [1, 2]]), [[0, 1], [1, 2]]);
    assert.deepEqual(cliquesCouvrantes(2, []), []);
    // Quatre unités, toutes en conflit sauf 2 et 3 : deux triangles.
    const conflits = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3]];
    const cliques = cliquesCouvrantes(4, conflits);
    assert.deepEqual(cliques, [[0, 1, 2], [0, 1, 3]]);
    for (const [i, j] of conflits) assert.ok(cliques.some((k) => k.includes(i) && k.includes(j)), `${i}-${j}`);
  });
});
