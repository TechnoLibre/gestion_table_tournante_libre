// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle de la planche de badges (§ 4.1, § 11.4 à § 11.8,
// § 15.1, § 15.5) : ce qu'un badge porte et ne porte pas, l'ordre de la pile
// par points de code, les homonymes que rien ne sépare, la source imprimée
// (le retenu ou une proposition, Q3), les refus avant de produire, le
// filigrane, l'horodatage et la version, la réédition identique, et les
// lignes de la feuille de contrôle. Les noms d'épreuve sont inventés, hors du
// réservoir des démonstrations ; la version vient du module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { H_PROPOSITION, H_RETENU, H_RETOUCHE, personne, placementDe, soiree, table } from '../../test/fixtures/badges/cas.js';
import { EXCLUS_TEMOIN, FORME_TEMOIN, chargeTemoin } from '../../test/fixtures/badges/temoin.js';
import { cleNormalisee } from '../csv/normalisation.js';
import { VERSION } from '../version.genere.js';
import { ErreurCommande } from './erreurs.js';
import { libelle } from './libelles.js';
import {
  comparerPointsDeCode,
  homonymesDe,
  listeBadges,
  modelePlanche,
  papierDesBadges,
  refusPlanche,
  refusProduction,
  textesControle,
} from './planche.js';
import { MARQUE_TEMOIN } from './traduction.js';

const PROVENANCE = 'developpement';
const options = (autres = {}) => ({ provenance: PROVENANCE, version: VERSION.affichee, ...autres });
const modele = (charge, autres) => modelePlanche(charge, options(autres));

const VERS_PROPOSITIONS = { geste: 'ouvrirSection', section: 'propositions' };
const PIED_EVENEMENT = 'Soirée des Lucioles, 17 mai 2031';
const PIED_DATE = '17 mai 2031';
const PIED_HORODATAGE = 'Placement du 17 mai 2031 à 20:15:07';

// Le badge de la personne id dans un modèle.
const badgeDe = (m, id) => m.badges.find(({ participant }) => participant === id);
// Tous les textes d'un badge, à plat.
const textesDe = ({ textes }) => [textes.nom, ...textes.lignes, textes.organisation ?? '', ...textes.pied, ...textes.piedReduit];

// Cinq personnes sur deux tables de deux places, deux tours : chaque tour
// laisse une personne en réserve — Théo au tour 2, Grisaille au tour 1.
function aReserve(autres = {}) {
  return soiree({
    personnes: [
      personne(1, 'Iris', 'Ombrelle'),
      personne(2, 'Théo', 'Pervenche'),
      personne(3, 'Ondine', 'Lacasse'),
      personne(4, 'Émile', 'Ombrelle'),
      personne(5, null, 'Grisaille'),
    ],
    tables: [table(1, 7, 2), table(2, 3, 2)],
    plan: [
      { sieges: [[1, 2], [3, 4]], reserve: [5] },
      { sieges: [[1, 5], [3, 4]], reserve: [2] },
    ],
    ...autres,
  });
}

// Deux personnes à la table 7 (identifiant 1), à chacun des tours.
const deuxATable7 = (tours, autres = {}) =>
  soiree({
    personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
    tables: [table(1, 7, 2)],
    plan: Array.from({ length: tours }, () => ({ sieges: [[1, 2]] })),
    ...autres,
  });

// Trois personnes à la table 7, sièges attribués, deux tours : Iris au
// siège 1 puis 2, Théo au siège 2 puis 1 ; un titre « animateur » au siège 1.
const titree = ({ reservations = [], tour2 = [2, 1, 3] } = {}) =>
  soiree({
    personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse')],
    tables: [table(1, 7, 3)],
    plan: [{ sieges: [[1, 2, 3]] }, { sieges: [tour2] }],
    siegesAttribues: true,
    titres: [{ table: 1, siege: 1, libelle: 'animateur' }],
    reservations,
  });

// Huit personnes sur deux tables de quatre, deux tours : deux « Théo
// Pervenche » sans organisation, deux « Iris Ombrelle » de la même
// organisation écrite autrement, deux « Ondine Lacasse » d'organisations
// différentes, et deux autres.
function homonymes(autres = {}) {
  return soiree({
    personnes: [
      personne(1, 'Théo', 'Pervenche'),
      personne(2, 'Théo', 'Pervenche'),
      personne(3, 'Iris', 'Ombrelle', { organisation: 'Club des Merles' }),
      personne(4, 'iris', 'OMBRELLE', { organisation: ' club  des MERLES ' }),
      personne(5, 'Ondine', 'Lacasse', { organisation: 'Grisaille' }),
      personne(6, 'Ondine', 'Lacasse', { organisation: 'Club des Merles' }),
      personne(7, 'Émile', 'Ombrelle'),
      personne(8, 'Ångel', 'Ombrelle'),
    ],
    tables: [table(1, 1, 4), table(2, 2, 4)],
    plan: [
      { sieges: [[1, 2, 3, 4], [5, 6, 7, 8]] },
      { sieges: [[1, 3, 5, 7], [2, 4, 6, 8]] },
    ],
    ...autres,
  });
}

describe('planche : ce que porte un badge (§ 11.4, § 11.5, § 4.1)', () => {
  test('un exclu n’a pas de badge et compte : le témoin donne 257 badges pour 260 participants, 3 exclus', () => {
    const m = modele(chargeTemoin());
    assert.deepEqual(m.comptes, { participants: FORME_TEMOIN.participants, exclus: FORME_TEMOIN.exclus, produits: FORME_TEMOIN.produits });
    assert.equal(m.badges.length, 257);
    for (const id of EXCLUS_TEMOIN) assert.equal(badgeDe(m, id), undefined, `exclu ${id}`);
    assert.equal(new Set(m.badges.map(({ participant }) => participant)).size, 257);
    assert.deepEqual(m.evenement, { nom: 'Soirée des Lucioles', date: '2031-05-17' });
  });

  test('une personne en réserve à un tour lit « pas de table » à ce tour, en toutes lettres', () => {
    const m = modele(aReserve());
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7', 'Tour 2 — pas de table']);
    assert.deepEqual(badgeDe(m, 2).lignes, [
      { tour: 1, table: 7, siege: null, titre: null, absente: false },
      { tour: 2, table: null, siege: null, titre: null, absente: false },
    ]);
    assert.deepEqual(badgeDe(m, 5).textes.lignes, ['Tour 1 — pas de table', 'Tour 2 — table 7']);
  });

  test('une personne en réserve à tous les tours garde une ligne « pas de table » par tour : la réserve n’est pas une table, ni « Toute la soirée »', () => {
    const m = modele(aReserve({ plan: [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 2], [3, 4]], reserve: [5] }] }));
    assert.deepEqual(badgeDe(m, 5).textes.lignes, ['Tour 1 — pas de table', 'Tour 2 — pas de table']);
    assert.deepEqual(badgeDe(m, 5).lignes, [
      { tour: 1, table: null, siege: null, titre: null, absente: false },
      { tour: 2, table: null, siege: null, titre: null, absente: false },
    ]);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Toute la soirée — table 7']);
  });

  test('un itinéraire constant s’écrit en une ligne « Toute la soirée » à R ≥ 2 ; à R = 1, la ligne du tour', () => {
    const quatre = modele(deuxATable7(4));
    assert.deepEqual(badgeDe(quatre, 1).textes.lignes, ['Toute la soirée — table 7']);
    assert.deepEqual(badgeDe(quatre, 1).lignes, [{ tour: null, table: 7, siege: null, titre: null, absente: false }]);
    assert.deepEqual(badgeDe(modele(deuxATable7(1)), 1).textes.lignes, ['Tour 1 — table 7']);
    assert.deepEqual(badgeDe(modele(aReserve()), 3).textes.lignes, ['Toute la soirée — table 3']);
  });

  test('le siège ne s’écrit que sous sièges attribués, compté chaises vides comprises', () => {
    assert.deepEqual(badgeDe(modele(deuxATable7(1, { siegesAttribues: true })), 2).textes.lignes, ['Tour 1 — table 7, siège 2']);
    assert.doesNotMatch(badgeDe(modele(deuxATable7(1)), 2).textes.lignes[0], /siège/);
    const vide = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 3)],
      plan: [{ sieges: [[1, null, 2]] }],
      siegesAttribues: true,
    });
    assert.deepEqual(badgeDe(modele(vide), 2).textes.lignes, ['Tour 1 — table 7, siège 3']);
  });

  test('un titre posé sur un siège occupé sans réservation ne s’imprime pas (§ 4.1)', () => {
    const m = modele(titree());
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7, siège 1', 'Tour 2 — table 7, siège 2']);
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7, siège 2', 'Tour 2 — table 7, siège 1']);
    for (const badge of m.badges) for (const texte of textesDe(badge)) assert.doesNotMatch(texte, /animateur/);
  });

  test('une réservation d’un seul tour qui fait la titulaire met le titre sur la ligne de ce tour, seule', () => {
    const m = modele(titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 }] }));
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7, siège 1 — animateur', 'Tour 2 — table 7, siège 2']);
    assert.deepEqual(badgeDe(m, 1).lignes[0], { tour: 1, table: 7, siege: 1, titre: 'animateur', absente: false });
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7, siège 2', 'Tour 2 — table 7, siège 1']);
    // Assise au même siège aux deux tours, la titulaire d'un seul tour garde
    // deux lignes : le titre change, l'itinéraire n'est pas constant.
    const memeSiege = modele(titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 }], tour2: [1, 2, 3] }));
    assert.deepEqual(badgeDe(memeSiege, 1).textes.lignes, ['Tour 1 — table 7, siège 1 — animateur', 'Tour 2 — table 7, siège 1']);
    assert.deepEqual(badgeDe(memeSiege, 1).lignes, [
      { tour: 1, table: 7, siege: 1, titre: 'animateur', absente: false },
      { tour: 2, table: 7, siege: 1, titre: null, absente: false },
    ]);
  });

  test('une titulaire « tous les tours » que le retenu assied ailleurs à un tour n’y porte pas le titre ; assise au siège à chaque tour, une ligne', () => {
    const tous = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
    assert.deepEqual(badgeDe(modele(titree({ reservations: tous })), 1).textes.lignes, [
      'Tour 1 — table 7, siège 1 — animateur',
      'Tour 2 — table 7, siège 2',
    ]);
    assert.deepEqual(badgeDe(modele(titree({ reservations: tous, tour2: [1, 2, 3] })), 1).textes.lignes, [
      'Toute la soirée — table 7, siège 1 — animateur',
    ]);
  });

  test('sans sièges attribués, une réservation sans siège fait la titulaire ; le tour où le retenu l’assied à une autre table, rien', () => {
    const charge = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse'), personne(4, null, 'Grisaille')],
      tables: [table(1, 7, 2), table(2, 3, 2)],
      plan: [{ sieges: [[1, 2], [3, 4]] }, { sieges: [[2, 3], [1, 4]] }],
      titres: [{ table: 1, siege: 1, libelle: 'animatrice' }],
      reservations: [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }],
    });
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7 — animatrice', 'Tour 2 — table 3']);
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Toute la soirée — table 7']);
  });

  test('aucun texte du badge ne porte le courriel, les notes, le titre pressenti, l’identifiant hors homonymie ni la version', () => {
    const charge = chargeTemoin();
    const m = modele(charge);
    let parcourus = 0;
    for (const badge of m.badges) {
      const { courriel, notes, titrePressenti } = charge.participants.find(({ id }) => id === badge.participant);
      assert.equal(badge.identifiant, null);
      const identifiant = libelle('planche.pied.identifiant', { identifiant: badge.participant });
      for (const texte of textesDe(badge)) {
        parcourus += 1;
        for (const interdit of [courriel, notes, titrePressenti, identifiant, VERSION.affichee]) {
          assert.ok(!texte.includes(interdit), `${badge.participant} : « ${texte} » porte « ${interdit} »`);
        }
      }
    }
    assert.ok(parcourus > 257 * 4, `${parcourus} textes`);
    assert.equal(m.version, VERSION.affichee);
  });

  test('le nom affiché et l’organisation, en NFC ; sans organisation, rien', () => {
    const decomposee = soiree({
      personnes: [personne(1, 'Ze\u{0301}lie', 'Ombrelle', { organisation: 'Cafe\u{0301} des Merles' }), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 2)],
      plan: [{ sieges: [[1, 2]] }],
    });
    const m = modele(decomposee);
    assert.equal(badgeDe(m, 1).nom, 'Z\u{00E9}lie Ombrelle');
    assert.equal(badgeDe(m, 1).textes.nom, 'Z\u{00E9}lie Ombrelle');
    assert.equal(badgeDe(m, 1).organisation, 'Caf\u{00E9} des Merles');
    assert.equal(badgeDe(m, 1).textes.organisation, 'Caf\u{00E9} des Merles');
    assert.equal(badgeDe(m, 2).organisation, null);
    assert.equal(badgeDe(m, 2).textes.organisation, null);
  });

  test('le pied porte l’événement et sa date, puis l’horodatage ; piedReduit retire le nom de l’événement et garde la date', () => {
    const badge = badgeDe(modele(aReserve()), 1);
    assert.deepEqual(badge.textes.pied, [PIED_EVENEMENT, PIED_HORODATAGE]);
    assert.deepEqual(badge.textes.piedReduit, [PIED_DATE, PIED_HORODATAGE]);
    const sansDate = badgeDe(modele(aReserve({ date: null })), 1);
    assert.deepEqual(sansDate.textes.pied, ['Soirée des Lucioles', PIED_HORODATAGE]);
    assert.deepEqual(sansDate.textes.piedReduit, [PIED_HORODATAGE]);
  });
});

// La charge c où la personne id n'est présente qu'aux tours presence : son
// champ presence posé, et le retenu qui la porte aux absents de chacun de
// ses autres tours, déclarée même quand le premier tour ne la liste pas. Le
// plan de c ne l'assied ni ne la réserve à ces tours.
function absenteHors(c, id, presence) {
  c.participants.find((candidate) => candidate.id === id).presence = presence;
  c.retenu.placement.forEach((tour, rang) => {
    if (!presence.includes(rang + 1)) tour.absents = [...(tour.absents ?? []), id].sort((a, b) => a - b);
  });
  if (!c.retenu.participants.includes(id)) c.retenu.participants = [...c.retenu.participants, id].sort((a, b) => a - b);
  return c;
}

describe('planche : une personne absente à un tour (§ 11.4, § 11.5)', () => {
  test('présente aux tours 1, 2 et 4 à la même table : une ligne par tour, « Tour 3 — absente », jamais « Toute la soirée »', () => {
    const charge = absenteHors(
      soiree({
        personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse'), personne(4, null, 'Grisaille')],
        tables: [table(1, 7, 2), table(2, 3, 2)],
        plan: [
          { sieges: [[1, 2], [3, 4]] },
          { sieges: [[1, 2], [3, 4]] },
          { sieges: [[2], [3, 4]] },
          { sieges: [[1, 2], [3, 4]] },
        ],
      }),
      1,
      [1, 2, 4],
    );
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7', 'Tour 2 — table 7', 'Tour 3 — absente', 'Tour 4 — table 7']);
    assert.deepEqual(badgeDe(m, 1).lignes, [
      { tour: 1, table: 7, siege: null, titre: null, absente: false },
      { tour: 2, table: 7, siege: null, titre: null, absente: false },
      { tour: 3, table: null, siege: null, titre: null, absente: true },
      { tour: 4, table: 7, siege: null, titre: null, absente: false },
    ]);
    // Les présentes de la même table gardent leur ligne unique, et la
    // personne absente a son badge : les comptes ne changent pas.
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Toute la soirée — table 7']);
    assert.deepEqual(m.comptes, { participants: 4, exclus: 0, produits: 4 });
  });

  test('en réserve au tour 1, absente au tour 2 : deux lignes, « pas de table » puis « absente », jamais fondues', () => {
    const charge = absenteHors(aReserve({ plan: [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 2], [3, 4]] }] }), 5, [1]);
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 5).textes.lignes, ['Tour 1 — pas de table', 'Tour 2 — absente']);
    assert.deepEqual(badgeDe(m, 5).lignes.map(({ absente }) => absente), [false, true]);
  });

  test('sous sièges attribués, la titulaire « tous les tours » absente au tour 2 n\u{2019}y porte ni table, ni siège, ni titre, et personne ne le porte à sa place', () => {
    const charge = absenteHors(
      titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }], tour2: [null, 2, 3] }),
      1,
      [1],
    );
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7, siège 1 — animateur', 'Tour 2 — absente']);
    assert.deepEqual(badgeDe(m, 1).lignes[1], { tour: 2, table: null, siege: null, titre: null, absente: true });
    for (const id of [2, 3]) for (const texte of textesDe(badgeDe(m, id))) assert.doesNotMatch(texte, /animateur/);
  });

  test('l\u{2019}ordre par table : une absente au tour 1 vient après la réserve de ce tour, quel que soit son nom', () => {
    const charge = absenteHors(
      soiree({
        personnes: [
          personne(1, 'Iris', 'Ombrelle'),
          personne(2, 'Théo', 'Pervenche'),
          personne(3, 'Ondine', 'Lacasse'),
          personne(4, 'Émile', 'Pervenche'),
          personne(5, 'Ångel', 'Grisaille'),
          personne(6, 'Aube', 'Grisaille'),
        ],
        tables: [table(1, 7, 2), table(2, 3, 2)],
        plan: [
          { sieges: [[1, 2], [3]], reserve: [4] },
          { sieges: [[1, 2], [3, 5]], reserve: [4, 6] },
        ],
      }),
      5,
      [2],
    );
    absenteHors(charge, 6, [2]);
    // La table 3 (Lacasse), la table 7 (Ombrelle, Pervenche), la réserve
    // (Émile Pervenche), puis les absentes, entre elles par ordre alphabétique.
    assert.deepEqual(modele(charge, { ordre: 'table' }).badges.map(({ participant }) => participant), [3, 1, 2, 4, 5, 6]);
    assert.deepEqual(modele(charge).badges.map(({ participant }) => participant), [5, 6, 3, 1, 4, 2]);
  });
});

describe('planche : l’ordre de la pile (§ 11.6, § 15.5, décision 9)', () => {
  test('comparerPointsDeCode compare par points de code, là où « < » compare des unités UTF-16', () => {
    assert.equal(comparerPointsDeCode('a', 'b'), -1);
    assert.equal(comparerPointsDeCode('b', 'a'), 1);
    assert.equal(comparerPointsDeCode('', ''), 0);
    assert.equal(comparerPointsDeCode('abc', 'abc'), 0);
    assert.equal(comparerPointsDeCode('ab', 'abc'), -1);
    assert.equal(comparerPointsDeCode('abc', 'ab'), 1);
    assert.equal(comparerPointsDeCode('\u{1D49C}b', '\u{1D49C}c'), -1, 'un point astral commun, puis la différence');
    assert.equal(comparerPointsDeCode('\u{1D49C}', '\u{1D49C}'), 0);
    const [pleine, script] = ['\u{FF41}', '\u{1D49C}'];
    assert.equal(pleine < script, false);
    assert.equal(comparerPointsDeCode(pleine, script), -1);
    assert.equal(comparerPointsDeCode(script, pleine), 1);
    for (const intrus of [null, undefined, 3]) assert.throws(() => comparerPointsDeCode(intrus, 'a'), TypeError);
  });

  // Dix personnes à une table, listées dans l'ordre inverse des
  // identifiants : l'ordre rendu ne doit rien à celui de la liste.
  const PERSONNES_ORDRE = [
    personne(1, 'Zélie', 'Ombrelle'),
    personne(2, 'Émile', 'Ombrelle'),
    personne(3, 'Eric', 'Ombrelle'),
    personne(4, 'Ångel', 'Ombrelle'),
    personne(5, 'Iris', 'Pervenche'),
    personne(6, 'Iris', 'Pervenche'),
    personne(7, 'Ondine', 'Lacasse'),
    personne(8, 'Iris', '\u{0152}illet'),
    personne(9, '\u{FF21}da', 'Ombrelle'),
    personne(10, '\u{1D49C}da', 'Ombrelle'),
  ];
  const ordonnee = () =>
    soiree({
      personnes: [...PERSONNES_ORDRE].reverse(),
      tables: [table(1, 1, 10)],
      plan: [{ sieges: [[1, 2, 3, 4, 5, 6, 7, 8, 9, 10]] }],
    });

  test('l’ordre suit la clé normalisée du couple (nom, prénom), par points de code, départagé par identifiant — jamais localeCompare', () => {
    const [cleA, cleScript] = ['\u{FF21}da', '\u{1D49C}da'].map(cleNormalisee);
    assert.equal(cleA < cleScript, false, '« < » range la forme pleine après la lettre mathématique');
    assert.equal(comparerPointsDeCode(cleA, cleScript), -1, 'les points de code la rangent avant');
    // La collation française range « œillet » comme « oeillet », avant
    // « ombrelle » ; l'ordre attendu ici le met après « pervenche ». La
    // locale est nommée : sans elle, la précondition suit la langue du
    // processus, et la collation suédoise range « œ » après « o ».
    assert.ok(cleNormalisee('\u{0152}illet').localeCompare('ombrelle', 'fr') < 0);
    const m = modele(ordonnee());
    assert.deepEqual(m.badges.map(({ participant }) => participant), [7, 4, 2, 3, 1, 9, 10, 5, 6, 8]);
  });

  test('l’ordre par table : la table du tour 1 par numéro, l’ordre alphabétique dans chacune, la réserve du tour 1 en dernier', () => {
    const charge = soiree({
      personnes: [
        personne(1, 'Iris', 'Ombrelle'),
        personne(2, 'Théo', 'Pervenche'),
        personne(3, 'Ondine', 'Lacasse'),
        personne(4, 'Émile', 'Ombrelle'),
        personne(5, 'Ångel', 'Ombrelle'),
      ],
      tables: [table(1, 2, 2), table(2, 1, 2)],
      plan: [{ sieges: [[1, 2], [4, 3]], reserve: [5] }],
    });
    assert.deepEqual(modele(charge, { ordre: 'table' }).badges.map(({ participant }) => participant), [3, 4, 1, 2, 5]);
    assert.deepEqual(modele(charge).badges.map(({ participant }) => participant), [3, 5, 4, 1, 2]);
  });

  test('sans prénom, la clé du prénom est vide : « Grisaille » seule vient avant « Ondine Grisaille », deux sans prénom par identifiant', () => {
    const charge = soiree({
      personnes: [personne(1, 'Ondine', 'Grisaille'), personne(2, null, 'Grisaille'), personne(3, null, 'grisaille')],
      tables: [table(1, 1, 3)],
      plan: [{ sieges: [[1, 2, 3]] }],
    });
    assert.deepEqual(modele(charge).badges.map(({ participant }) => participant), [2, 3, 1]);
  });

  test('par table, deux tables de même numéro se départagent par leur identifiant', () => {
    const charge = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche'), personne(3, 'Ondine', 'Lacasse')],
      tables: [table(1, 4, 2), table(2, 4, 2), table(3, 2, 2)],
      plan: [{ sieges: [[2], [1], [3]] }],
    });
    assert.deepEqual(modele(charge, { ordre: 'table' }).badges.map(({ participant }) => participant), [3, 2, 1]);
  });

  test('un ordre inconnu lève TypeError', () => {
    for (const ordre of ['alpha', 'Table', null]) assert.throws(() => modele(aReserve(), { ordre }), TypeError, String(ordre));
  });
});

describe('planche : les homonymes que rien ne sépare (§ 11.4, décision 7)', () => {
  test('même nom normalisé, sans organisation ou de même organisation normalisée : nommés ; d’organisations différentes, non', () => {
    assert.deepEqual(homonymesDe(homonymes()), [
      { nom: 'Iris Ombrelle', ids: [3, 4] },
      { nom: 'Théo Pervenche', ids: [1, 2] },
    ]);
    const m = modele(homonymes());
    assert.deepEqual(m.homonymes, homonymesDe(homonymes()));
    for (const id of [1, 2, 3, 4]) {
      const badge = badgeDe(m, id);
      assert.equal(badge.identifiant, id);
      assert.equal(badge.textes.pied.at(-1), `Identifiant n° ${id}`);
      assert.equal(badge.textes.piedReduit.at(-1), `Identifiant n° ${id}`);
    }
    for (const id of [5, 6, 7, 8]) {
      assert.equal(badgeDe(m, id).identifiant, null);
      assert.equal(badgeDe(m, id).textes.pied.length, 2);
    }
  });

  test('le nom imprimé décide : « Théo Pervenche » sans prénom rejoint « Théo » « Pervenche » ; un exclu ne compte pas', () => {
    const charge = homonymes();
    // L'exclu porte le nom et l'organisation du groupe [3, 4] : compté, il
    // le rejoindrait.
    charge.participants.push(
      personne(9, null, 'Théo Pervenche'),
      personne(10, 'Iris', 'Ombrelle', { organisation: 'Club des Merles', exclu: true }),
    );
    charge.retenu = { proposition: 1, ...placementDe(charge, [{ sieges: [[1, 2, 3, 4], [5, 6, 7, 8, 9]] }, { sieges: [[1, 3, 5, 7, 9], [2, 4, 6, 8]] }]) };
    charge.tables[1].sieges = 5;
    charge.retenu.capacites = [4, 5];
    assert.deepEqual(homonymesDe(charge), [
      { nom: 'Iris Ombrelle', ids: [3, 4] },
      { nom: 'Théo Pervenche', ids: [1, 2, 9] },
    ]);
  });

  test('un présent seul de son nom à côté d’un homonyme exclu n’a pas d’identifiant au pied', () => {
    const charge = soiree({
      personnes: [
        personne(1, 'Théo', 'Pervenche'),
        personne(2, 'Théo', 'Pervenche', { exclu: true }),
        personne(3, 'Iris', 'Ombrelle'),
      ],
      tables: [table(1, 7, 2)],
      plan: [{ sieges: [[1, 3]] }],
    });
    assert.deepEqual(homonymesDe(charge), []);
    const m = modele(charge);
    assert.deepEqual(m.homonymes, []);
    assert.equal(badgeDe(m, 1).identifiant, null);
    assert.deepEqual(badgeDe(m, 1).textes.pied, [PIED_EVENEMENT, PIED_HORODATAGE]);
    assert.deepEqual(badgeDe(m, 1).textes.piedReduit, [PIED_DATE, PIED_HORODATAGE]);
  });

  test('deux collisions du même nom, d’organisations différentes : deux groupes, rangés par organisation normalisée', () => {
    const charge = soiree({
      personnes: [
        personne(1, 'Ondine', 'Lacasse', { organisation: 'Grisaille' }),
        personne(2, 'Ondine', 'Lacasse', { organisation: 'Club des Merles' }),
        personne(3, 'Ondine', 'Lacasse', { organisation: 'grisaille' }),
        personne(4, 'Ondine', 'Lacasse', { organisation: 'Club des merles' }),
      ],
      tables: [table(1, 1, 4)],
      plan: [{ sieges: [[1, 2, 3, 4]] }],
    });
    assert.deepEqual(homonymesDe(charge), [
      { nom: 'Ondine Lacasse', ids: [2, 4] },
      { nom: 'Ondine Lacasse', ids: [1, 3] },
    ]);
  });

  test('sans homonyme, une liste vide', () => {
    assert.deepEqual(homonymesDe(aReserve()), []);
    assert.deepEqual(modele(aReserve()).homonymes, []);
  });
});

describe('planche : la source imprimée, le retenu ou une proposition (Q3)', () => {
  // Le retenu de aReserve, et la proposition 2 qui permute les tables au
  // tour 2.
  const avecProposition = (autres) =>
    aReserve({
      propositions: [
        [2, [
          { sieges: [[1, 2], [3, 4]], reserve: [5] },
          { sieges: [[3, 4], [1, 5]], reserve: [2] },
        ]],
      ],
      ...autres,
    });

  test('une proposition désignée donne ses badges, BROUILLON même sous l’état retenu, et son horodatage', () => {
    const charge = avecProposition();
    const retenu = modele(charge);
    const tiree = modele(charge, { source: 'proposition', proposition: 2 });
    assert.equal(retenu.brouillon, false);
    assert.equal(tiree.brouillon, true);
    assert.equal(retenu.horodatage, H_RETENU);
    assert.equal(tiree.horodatage, H_PROPOSITION);
    assert.deepEqual(badgeDe(tiree, 1).textes.lignes, ['Tour 1 — table 7', 'Tour 2 — table 3']);
    assert.deepEqual(badgeDe(retenu, 1).textes.lignes, ['Toute la soirée — table 7']);
    assert.notDeepEqual(tiree, retenu);
    assert.deepEqual([retenu.source, retenu.proposition], ['retenu', null]);
    assert.deepEqual([tiree.source, tiree.proposition], ['proposition', 2]);
    const sansChamp = avecProposition();
    delete sansChamp.propositions[0].horodatage;
    assert.equal(modele(sansChamp, { source: 'proposition', proposition: 2 }).horodatage, null);
    for (const etat of ['bloque', 'brouillon']) {
      assert.equal(modele(avecProposition({ etat }), { source: 'proposition', proposition: 2 }).brouillon, true, etat);
    }
  });

  test('une planche se tire d’une proposition sans retenu ; un identifiant inconnu lève PROPOSITION_INCONNUE ; une autre source, TypeError', () => {
    const sansRetenu = avecProposition({ plan: null, etat: 'propose' });
    assert.equal(modele(sansRetenu, { source: 'proposition', proposition: 2 }).badges.length, 5);
    assert.throws(
      () => modele(avecProposition(), { source: 'proposition', proposition: 9 }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PROPOSITION_INCONNUE' && erreur.details.id === 9,
    );
    for (const source of ['reservations', 'plan', null]) {
      assert.throws(() => modele(avecProposition(), { source }), TypeError, String(source));
      assert.throws(() => refusPlanche(avecProposition(), { source }), TypeError, String(source));
    }
    assert.throws(() => modele(avecProposition(), { source: 'proposition', proposition: '2' }), TypeError);
  });
});

describe('planche : les refus avant de produire (§ 11.8, Q3)', () => {
  test('ni retenu ni proposition désignée : PLANCHE_SANS_PLACEMENT, remède les propositions', () => {
    const attendu = { code: 'PLANCHE_SANS_PLACEMENT', details: { remede: VERS_PROPOSITIONS } };
    assert.deepEqual(refusPlanche(aReserve({ plan: null })), attendu);
    assert.deepEqual(refusPlanche(aReserve(), { source: 'proposition', proposition: null }), attendu);
    assert.throws(
      () => modele(aReserve({ plan: null })),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === attendu.code && assert.deepEqual(erreur.details, attendu.details) === undefined,
    );
  });

  test('un retenu qui se contredit : RETENU_FAUTIF, tel que le relaient les places, remède la version précédente du fichier', () => {
    const attendu = { code: 'RETENU_FAUTIF', details: { remede: { geste: 'ouvrirSecours', source: 'precedent' } } };
    const fautif = aReserve();
    fautif.retenu.placement[0].sieges[1] = [3, 3];
    assert.deepEqual(refusPlanche(fautif), attendu);
    assert.throws(() => modele(fautif), (erreur) => erreur instanceof ErreurCommande && erreur.code === 'RETENU_FAUTIF');
  });

  test('une proposition qui se contredit : PROPOSITION_FAUTIVE la nomme, remède les propositions ; le retenu sain se produit, et ne la juge pas', () => {
    const proposee = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 5], [3, 4]], reserve: [2] }]]] });
    proposee.propositions[0].placement[1].reserve = [];
    const attendu = { code: 'PROPOSITION_FAUTIVE', details: { id: 2, remede: VERS_PROPOSITIONS } };
    assert.deepEqual(refusPlanche(proposee, { source: 'proposition', proposition: 2 }), attendu);
    assert.throws(
      () => modele(proposee, { source: 'proposition', proposition: 2 }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PROPOSITION_FAUTIVE' && erreur.details.id === 2,
    );
    assert.equal(refusPlanche(proposee), null);
    const texte = libelle(attendu.code, attendu.details);
    assert.match(texte, /proposition n° 2\b/);
    assert.doesNotMatch(texte, /retenu|version précédente/);
    // Un retenu fautif n'empêche pas d'imprimer une proposition saine.
    const retenuFautif = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 5], [3, 4]], reserve: [2] }]]] });
    retenuFautif.retenu.placement[0].sieges[1] = [3, 3];
    assert.equal(refusPlanche(retenuFautif, { source: 'proposition', proposition: 2 }), null);
  });

  test('une source en dérive — une personne ajoutée depuis — : PLANCHE_DERIVE, qui la nomme avant de produire', () => {
    const charge = aReserve();
    charge.participants.push(personne(6, 'Ondine', 'Grisaille'));
    const refus = refusPlanche(charge);
    assert.deepEqual(refus, {
      code: 'PLANCHE_DERIVE',
      details: { raisons: [{ code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Ondine Grisaille' }], remede: VERS_PROPOSITIONS },
    });
    assert.match(libelle(refus.code, refus.details), /Ondine Grisaille/);
    assert.throws(
      () => modele(charge),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PLANCHE_DERIVE' && erreur.details.raisons[0].personne === 'Ondine Grisaille',
    );
  });

  test('un retenu à 3 tours sur une soirée de 4 : PLANCHE_DERIVE, le nombre de tours nommé', () => {
    const charge = deuxATable7(3);
    charge.evenement.tours = 4;
    assert.deepEqual(refusPlanche(charge)?.details.raisons, [{ code: 'TOURS_CHANGES', avant: 3, maintenant: 4 }]);
  });

  test('l’ordre des refus est épinglé : sans placement, puis fautif, puis dérive', () => {
    const fautifEtDerive = aReserve();
    fautifEtDerive.retenu.placement[0].sieges[1] = [3, 3];
    fautifEtDerive.participants.push(personne(6, 'Ondine', 'Grisaille'));
    assert.equal(refusPlanche(fautifEtDerive).code, 'RETENU_FAUTIF');
    const fautiveEtDerive = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[1, 5], [3, 4]], reserve: [2] }]]] });
    fautiveEtDerive.propositions[0].placement[1].reserve = [];
    fautiveEtDerive.participants.push(personne(6, 'Ondine', 'Grisaille'));
    assert.equal(refusPlanche(fautiveEtDerive, { source: 'proposition', proposition: 2 }).code, 'PROPOSITION_FAUTIVE');
    const sansPlacementEtDerive = aReserve({ plan: null });
    sansPlacementEtDerive.participants.push(personne(6, 'Ondine', 'Grisaille'));
    assert.equal(refusPlanche(sansPlacementEtDerive).code, 'PLANCHE_SANS_PLACEMENT');
    assert.equal(refusPlanche(aReserve()), null);
  });
});

describe('planche : brouillon, horodatage, version, réédition (§ 11.4, § 11.7, § 11.8)', () => {
  test('brouillon selon estBrouillon : faux sous l’état retenu ou bloqué, vrai sous brouillon ou proposé avec un retenu', () => {
    const lus = ['brouillon', 'propose', 'retenu', 'bloque'].map((etat) => [etat, modele(aReserve({ etat })).brouillon]);
    assert.deepEqual(lus, [
      ['brouillon', true],
      ['propose', true],
      ['retenu', false],
      ['bloque', false],
    ]);
  });

  test('l’horodatage est celui du retenu ; sans le champ, null, et le pied dit l’horodatage inconnu', () => {
    assert.equal(modele(aReserve()).horodatage, H_RETENU);
    const ancien = modele(aReserve({ horodatage: null }));
    assert.equal(ancien.horodatage, null);
    assert.deepEqual(badgeDe(ancien, 1).textes.pied, [PIED_EVENEMENT, 'Horodatage du placement inconnu']);
  });

  test('la version visible, la marque de documentation dans une construction de documentation ; jamais sur un badge', () => {
    assert.equal(modele(aReserve()).version, VERSION.affichee);
    const documentation = modelePlanche(aReserve(), { provenance: 'documentation', version: VERSION.affichee });
    assert.equal(documentation.version, libelle('sorties.version.documentation'));
    for (const badge of documentation.badges) for (const texte of textesDe(badge)) assert.ok(!texte.includes(documentation.version));
    assert.throws(() => modelePlanche(aReserve(), { provenance: PROVENANCE }), TypeError);
    assert.throws(() => modelePlanche(aReserve(), { version: VERSION.affichee }), TypeError);
  });

  test('une réédition de trois personnes : reedition.ids, trois badges en ordre alphabétique, les comptes de la soirée gardés', () => {
    const m = modele(aReserve(), { selection: [2, 5, 4] });
    assert.deepEqual(m.badges.map(({ participant }) => participant), [5, 4, 2]);
    assert.deepEqual(m.reedition, { ids: [5, 4, 2] });
    assert.deepEqual(m.comptes, { participants: 5, exclus: 0, produits: 3 });
    assert.equal(modele(aReserve()).reedition, null);
  });

  test('une sélection vide, en double, d’identifiants non entiers lève TypeError ; une personne inconnue ou exclue, son refus', () => {
    for (const selection of [[], [2, 2], [1.5], 'tous', [null]]) {
      assert.throws(() => modele(aReserve(), { selection }), TypeError, JSON.stringify(selection));
    }
    assert.throws(
      () => modele(aReserve(), { selection: [1, 42] }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PARTICIPANT_INCONNU' && erreur.details.id === 42,
    );
    const charge = chargeTemoin();
    assert.throws(
      () => modele(charge, { selection: [EXCLUS_TEMOIN[0]] }),
      (erreur) => erreur instanceof ErreurCommande && erreur.code === 'PERSONNE_EXCLUE' && erreur.details.participant === EXCLUS_TEMOIN[0],
    );
  });

  test('deux appels sur la même charge rendent des modèles égaux, sans la modifier', () => {
    const charge = homonymes();
    const avant = structuredClone(charge);
    assert.deepStrictEqual(modele(charge), modele(charge));
    assert.deepStrictEqual(modele(charge, { selection: [6, 1] }), modele(charge, { selection: [1, 6] }));
    assert.deepStrictEqual(charge, avant);
  });
});

describe('planche : la réédition identique (§ 11.8)', () => {
  test('les textes d’un badge réédité égalent ceux du modèle complet, identifiant d’homonyme compris', () => {
    const complet = modele(homonymes());
    const reedite = modele(homonymes(), { selection: [2, 5, 7] });
    assert.equal(badgeDe(reedite, 2).identifiant, 2);
    for (const badge of reedite.badges) assert.deepStrictEqual(badge, badgeDe(complet, badge.participant), String(badge.participant));
    assert.deepEqual(reedite.homonymes, complet.homonymes);
  });

  test('après une retouche du retenu, le pied diffère par l’horodatage, le reste est égal', () => {
    const avant = modele(homonymes(), { selection: [2, 5, 7] });
    const retouchee = homonymes();
    retouchee.retenu.horodatage = H_RETOUCHE;
    const tour2 = retouchee.retenu.placement[1].sieges;
    [tour2[0][1], tour2[1][3]] = [8, 3];
    tour2[0].sort((a, b) => a - b);
    tour2[1].sort((a, b) => a - b);
    const apres = modele(retouchee, { selection: [2, 5, 7] });
    assert.notEqual(badgeDe(modele(retouchee), 3).textes.lignes.join(), badgeDe(modele(homonymes()), 3).textes.lignes.join());
    for (const badge of apres.badges) {
      const ancien = badgeDe(avant, badge.participant);
      const { pied, piedReduit, ...reste } = badge.textes;
      const { pied: piedAncien, piedReduit: reduitAncien, ...resteAncien } = ancien.textes;
      assert.deepStrictEqual(reste, resteAncien);
      assert.deepEqual(pied.filter((ligne, rang) => ligne !== piedAncien[rang]), ['Placement du 17 mai 2031 à 21:42:30']);
      assert.deepEqual(piedReduit.filter((ligne, rang) => ligne !== reduitAncien[rang]), ['Placement du 17 mai 2031 à 21:42:30']);
    }
  });
});

describe('planche : la feuille de contrôle (§ 11.3, § 11.5, § 11.8)', () => {
  const sansInsecable = (lignes) => lignes.map((ligne) => ligne.replace(/[\u{00A0}\u{202F}]/gu, ' '));

  test('dimensions, papier, imposition, planches, comptes, événement, horodatage, version, consigne d’impression', () => {
    const m = modele(chargeTemoin());
    const lignes = sansInsecable(textesControle(m, { papier: 'A4', imposition: 'feuille', planches: FORME_TEMOIN.planchesA4 }));
    for (const attendue of [
      'Badge : 105 × 148 mm (A6)',
      'Papier : A4, 210 × 297 mm',
      'Imposition : feuille par feuille',
      'Planches : 65',
      '257 badges pour 260 participants, 3 exclus',
      `Événement : ${PIED_EVENEMENT}`,
      PIED_HORODATAGE,
      `Version : ${VERSION.affichee}`,
      'Imprimer en recto seul, à 100 %',
    ]) {
      assert.ok(lignes.includes(attendue), `« ${attendue} » absente de ${JSON.stringify(lignes)}`);
    }
    assert.ok(!lignes.includes('BROUILLON'));
    for (const ligne of lignes) {
      assert.doesNotMatch(ligne, /\bundefined\b|\bnull\b|\bNaN\b/);
      assert.ok(!ligne.includes(MARQUE_TEMOIN.ouverture), ligne);
    }
  });

  test('l’autre papier et l’autre imposition se nomment ; un brouillon porte BROUILLON ; l’horodatage inconnu se dit', () => {
    const m = modele(aReserve({ etat: 'brouillon', horodatage: null, date: null }));
    const autre = Object.keys({ Lettre: 0 })[0];
    const lignes = sansInsecable(textesControle(m, { papier: autre, imposition: 'pile', planches: 3 }));
    for (const attendue of [
      `Papier : ${autre}, 215,9 × 279,4 mm`,
      'Imposition : en pile',
      'Planches : 3',
      '5 badges pour 5 participants',
      'Événement : Soirée des Lucioles',
      'Horodatage du placement inconnu',
      'BROUILLON',
    ]) {
      assert.ok(lignes.includes(attendue), `« ${attendue} » absente de ${JSON.stringify(lignes)}`);
    }
  });

  test('la source se nomme : le placement retenu, ou la proposition par son numéro, avant l’horodatage du placement', () => {
    const charge = aReserve({ propositions: [[2, [{ sieges: [[1, 2], [3, 4]], reserve: [5] }, { sieges: [[3, 4], [1, 5]], reserve: [2] }]]] });
    const options = { papier: 'A4', imposition: 'feuille', planches: 2 };
    const retenu = textesControle(modele(charge), options);
    const tiree = textesControle(modele(charge, { source: 'proposition', proposition: 2 }), options);
    assert.ok(retenu.includes('Source : le placement retenu'), JSON.stringify(retenu));
    const ligne = 'Source : la proposition n° 2, qui n\u{2019}est pas le placement retenu';
    assert.ok(tiree.includes(ligne), JSON.stringify(tiree));
    assert.equal(tiree.indexOf(ligne) + 1, tiree.indexOf(libelle('planche.pied.horodatage', { horodatage: H_PROPOSITION })));
    assert.ok(!retenu.some((texte) => texte.includes('proposition')), JSON.stringify(retenu));
    // Une source hors de son domaine lève.
    const m = modele(charge);
    for (const mauvaise of [{ source: undefined }, { source: 'plan' }, { source: 'proposition', proposition: null }, { source: 'retenu', proposition: 2 }]) {
      assert.throws(() => textesControle({ ...m, ...mauvaise }, options), TypeError, JSON.stringify(mauvaise));
    }
  });

  test('une réédition s’annonce, « Réédition : 3 badges », puis nomme les trois dans l’ordre de la pile', () => {
    const m = modele(aReserve(), { selection: [2, 5, 4] });
    const lignes = textesControle(m, { papier: 'A4', imposition: 'feuille', planches: 1 });
    const debut = lignes.indexOf('Réédition : 3 badges');
    assert.ok(debut >= 0, JSON.stringify(lignes));
    assert.deepEqual(lignes.slice(debut + 1, debut + 4), ['Grisaille', 'Émile Ombrelle', 'Théo Pervenche']);
    assert.ok(lignes.includes('3 badges pour 5 participants'));
    assert.equal(modele(aReserve(), { selection: [1] }).comptes.produits, 1);
    assert.ok(textesControle(modele(aReserve(), { selection: [1] }), { papier: 'A4', imposition: 'feuille', planches: 1 }).includes('Réédition : 1 badge'));
  });

  test('chaque glyphe absent s’écrit « U+674E », point de code par point de code, et jamais tel quel', () => {
    const charge = soiree({
      personnes: [personne(1, '\u{674E}', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [table(1, 7, 2)],
      plan: [{ sieges: [[1, 2]] }],
      nom: 'Soirée \u{20000}',
    });
    const m = modele(charge, { selection: [1] });
    const lignes = textesControle(m, { papier: 'A4', imposition: 'feuille', planches: 1, absents: ['\u{674E}', '\u{20000}', '\u{674E}'] });
    for (const ligne of lignes) {
      assert.ok(!ligne.includes('\u{674E}'), ligne);
      assert.ok(!ligne.includes('\u{20000}'), ligne);
    }
    assert.ok(lignes.includes('U+674E Ombrelle'), JSON.stringify(lignes));
    assert.ok(lignes.some((ligne) => ligne.startsWith('Événement : Soirée U+20000')), JSON.stringify(lignes));
    const annonce = lignes.find((ligne) => ligne.startsWith('Caractères absents'));
    assert.match(annonce, /U\+674E et U\+20000$/);
    assert.ok(!textesControle(m, { papier: 'A4', imposition: 'feuille', planches: 1 }).some((ligne) => ligne.startsWith('Caractères absents')));
  });

  test('Avery 5392 : la carte et ses cotes, six par feuille, le papier Lettre, aucune imposition ; la consigne de la feuille à part', () => {
    const m = modele(chargeTemoin());
    const options = { papier: 'Lettre', imposition: 'feuille', planches: 43, modeleBadge: 'avery5392' };
    const lignes = sansInsecable(textesControle(m, options));
    for (const attendue of [
      'Badge : 101,6 × 76,2 mm (Avery 5392, six cartes prédécoupées par feuille)',
      'Papier : Lettre, 215,9 × 279,4 mm',
      'Planches : 43',
      'Imprimer en recto seul, à 100 %',
      'Imprimer cette feuille sur papier ordinaire : posée sur une feuille Avery 5392, le contour des six cartes tombe sur leurs prédécoupes',
    ]) {
      assert.ok(lignes.includes(attendue), `« ${attendue} » absente de ${JSON.stringify(lignes)}`);
    }
    assert.ok(!lignes.some((ligne) => ligne.startsWith('Imposition')), JSON.stringify(lignes));
    assert.ok(!lignes.some((ligne) => ligne.includes('(A6)')), JSON.stringify(lignes));
    // L'A6 garde ses lignes, le modèle donné ou non.
    const a6 = { papier: 'A4', imposition: 'feuille', planches: 65 };
    assert.deepEqual(textesControle(m, { ...a6, modeleBadge: 'a6' }), textesControle(m, a6));
  });

  test('Avery 5392 ne se pose que sur Lettre ; un modèle inconnu lève TypeError', () => {
    const m = modele(aReserve());
    for (const mauvais of [{ papier: 'A4', modeleBadge: 'avery5392' }, { modeleBadge: 'A6' }, { modeleBadge: null }]) {
      assert.throws(() => textesControle(m, { papier: 'Lettre', imposition: 'feuille', planches: 1, ...mauvais }), TypeError, JSON.stringify(mauvais));
    }
  });

  test('un papier, une imposition, un nombre de planches ou des absents hors de leur domaine lèvent TypeError', () => {
    const m = modele(aReserve());
    const bon = { papier: 'A4', imposition: 'feuille', planches: 2 };
    for (const mauvais of [{ papier: 'A5' }, { papier: 'toString' }, { imposition: 'rame' }, { planches: -1 }, { planches: 1.5 }, { absents: 'x' }, { absents: [3] }]) {
      assert.throws(() => textesControle(m, { ...bon, ...mauvais }), TypeError, JSON.stringify(mauvais));
    }
  });
});

describe('planche : les refus de la production et leurs textes (§ 11.5, § 11.8)', () => {
  test('refusProduction relaie un refus de la mise en page avec le remède du contrat ; un autre code lève TypeError', () => {
    assert.deepEqual(refusProduction('PLANCHE_TROP_DE_TOURS', { tours: 40 }), {
      code: 'PLANCHE_TROP_DE_TOURS',
      details: { tours: 40, remede: null },
    });
    assert.deepEqual(refusProduction('PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse' }), {
      code: 'PLANCHE_NOM_TROP_LONG',
      details: { participant: 3, personne: 'Ondine Lacasse', remede: { geste: 'ouvrirSection', section: 'participants' } },
    });
    for (const code of ['PLANCHE_DERIVE', 'RETENU_FAUTIF', 'toString', null]) {
      assert.throws(() => refusProduction(code, {}), TypeError, String(code));
    }
  });

  test('chaque refus de la planche se dit : le nombre de tours, la personne au nom trop long, chaque raison de la dérive', () => {
    assert.match(libelle('PLANCHE_TROP_DE_TOURS', { tours: 40, remede: null }), /\b40 tours\b/);
    assert.match(libelle('PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse' }), /Ondine Lacasse/);
    assert.match(libelle('PLANCHE_NOM_TROP_LONG', { participant: 3 }), /n° 3\b/);
    const derive = libelle('PLANCHE_DERIVE', {
      raisons: [
        { code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Ondine Grisaille' },
        { code: 'TOURS_CHANGES', avant: 3, maintenant: 4 },
      ],
      remede: VERS_PROPOSITIONS,
    });
    assert.match(derive, /Ondine Grisaille/);
    assert.match(derive, /de 3 à 4/);
    assert.ok(libelle('PLANCHE_SANS_PLACEMENT', { remede: VERS_PROPOSITIONS }).length > 0);
  });
});

describe('planche : le papier des badges (§ 11.2)', () => {
  test('Avery 5392 impose Lettre, quel que soit le papier de la machine ; l’A6 prend celui de la machine, Lettre sans choix ; un modèle inconnu lève TypeError', () => {
    for (const papier of [null, 'A4', 'Lettre']) assert.equal(papierDesBadges('avery5392', papier), 'Lettre');
    assert.deepEqual([null, 'A4', 'Lettre'].map((papier) => papierDesBadges('a6', papier)), ['Lettre', 'A4', 'Lettre']);
    for (const modele of ['A6', null, 'toString']) assert.throws(() => papierDesBadges(modele, 'A4'), TypeError, String(modele));
  });
});

// Une table et son libellé.
const libellee = (id, numero, sieges, libelle) => ({ ...table(id, numero, sieges), libelle });

// Le texte de chaque morceau abrégeable des lignes d'un badge, ligne par
// ligne : ce que ses positions découpent dans le texte de la ligne.
const morceauxDe = ({ textes }) =>
  textes.lignes.map((ligne, rang) => textes.abregeables[rang].map(({ debut, fin }) => ligne.slice(debut, fin)));

describe('planche : le libellé de la table sur les lignes de tour (§ 11.4, § 11.5)', () => {
  test('entre parenthèses après le numéro, dans « Tour » comme dans « Toute la soirée » ; une table sans libellé laisse la ligne telle quelle', () => {
    const charge = aReserve({ tables: [libellee(1, 7, 2, 'Terrasse'), table(2, 3, 2)] });
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Toute la soirée — table 7 (Terrasse)']);
    assert.deepEqual(badgeDe(m, 1).lignes, [{ tour: null, table: 7, libelleTable: 'Terrasse', siege: null, titre: null, absente: false }]);
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7 (Terrasse)', 'Tour 2 — pas de table']);
    assert.deepEqual(badgeDe(m, 5).textes.lignes, ['Tour 1 — pas de table', 'Tour 2 — table 7 (Terrasse)']);
    // La table 3 n'a pas de libellé : ses lignes, et leur description, sont
    // celles d'un événement sans libellé.
    assert.deepEqual(badgeDe(m, 3).textes.lignes, ['Toute la soirée — table 3']);
    assert.deepEqual(badgeDe(m, 3).lignes, [{ tour: null, table: 3, siege: null, titre: null, absente: false }]);
    assert.deepEqual(badgeDe(m, 3), badgeDe(modele(aReserve()), 3));
  });

  test('un saut de ligne ou une tabulation dans le libellé devient une espace : la ligne de tour en reste une, au PDF comme au CSV', () => {
    const charge = aReserve({ tables: [libellee(1, 7, 2, 'Terrasse\n\tNord\u2028'), table(2, 3, 2)] });
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 2).textes.lignes, ['Tour 1 — table 7 (Terrasse Nord)', 'Tour 2 — pas de table']);
    const cellules = texteCsv(listeBadges(m, charge)).split('\r\n').filter((l) => l.includes('Terrasse'));
    assert.ok(cellules.some((l) => l.includes('Tour 1 — table 7 (Terrasse Nord)')), JSON.stringify(cellules));
    assert.ok(cellules.every((l) => !/Terrasse[\s\S]*\n[\s\S]*Nord/.test(l)), JSON.stringify(cellules));
  });

  test('avec le siège et le titre : « Tour 1 — table 7 (Terrasse), siège 1 — animateur » ; absente, ni table ni libellé', () => {
    const reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 }];
    const charge = titree({ reservations });
    charge.tables = [libellee(1, 7, 3, 'Terrasse')];
    const m = modele(charge);
    assert.deepEqual(badgeDe(m, 1).textes.lignes, ['Tour 1 — table 7 (Terrasse), siège 1 — animateur', 'Tour 2 — table 7 (Terrasse), siège 2']);
    const absente = absenteHors(titree({ reservations, tour2: [null, 1, 3] }), 2, [1]);
    absente.tables = [libellee(1, 7, 3, 'Terrasse')];
    assert.deepEqual(badgeDe(modele(absente), 2).textes.lignes, ['Tour 1 — table 7 (Terrasse), siège 2', 'Tour 2 — absente']);
  });

  test('deux tables de même numéro et de libellés différents ne font pas un itinéraire constant', () => {
    const charge = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [libellee(1, 7, 2, 'Terrasse'), libellee(2, 7, 2, 'Verrière')],
      plan: [{ sieges: [[1], [2]] }, { sieges: [[2], [1]] }],
    });
    assert.deepEqual(badgeDe(modele(charge), 1).textes.lignes, ['Tour 1 — table 7 (Terrasse)', 'Tour 2 — table 7 (Verrière)']);
  });

  test('les morceaux abrégeables : le libellé, puis le titre, par leur position dans la ligne ; aucun sans eux', () => {
    const charge = titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tour', tour: 1 }] });
    charge.tables = [libellee(1, 7, 3, 'Coin (nord) — fenêtre')];
    const m = modele(charge);
    const badge = badgeDe(m, 1);
    assert.deepEqual(morceauxDe(badge), [['Coin (nord) — fenêtre', 'animateur'], ['Coin (nord) — fenêtre']]);
    assert.deepEqual(badge.textes.abregeables[0], [
      { debut: 'Tour 1 — table 7 ('.length, fin: 'Tour 1 — table 7 (Coin (nord) — fenêtre'.length },
      { debut: 'Tour 1 — table 7 (Coin (nord) — fenêtre), siège 1 — '.length, fin: badge.textes.lignes[0].length },
    ]);
    const sans = modele(aReserve());
    for (const b of sans.badges) assert.deepEqual(b.textes.abregeables, b.textes.lignes.map(() => []));
    assert.deepEqual(morceauxDe(badgeDe(modele(titree({ reservations: [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }], tour2: [1, 2, 3] })), 1)), [['animateur']]);
  });
});

// Le texte d'un CSV : ses octets en UTF-8, marque d'ordre d'octets gardée.
const texteCsv = (octets) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(octets);

describe('planche : la liste des badges en CSV (§ 11.6)', () => {
  test('Nom;Prénom;Organisation;Tours, une ligne par badge dans l’ordre de la pile ; Prénom vide quand il manque ; les lignes de tour dans une cellule citée', () => {
    const charge = aReserve({ tables: [libellee(1, 7, 2, 'Terrasse'), table(2, 3, 2)] });
    charge.participants[0].organisation = 'Club des Merles';
    charge.participants[1].organisation = 'Atelier « la Sarcelle »; Nord';
    const m = modele(charge);
    const attendu =
      '\u{FEFF}Nom;Prénom;Organisation;Tours\r\n' +
      'Grisaille;;;"Tour 1 — pas de table\nTour 2 — table 7 (Terrasse)"\r\n' +
      'Lacasse;Ondine;;Toute la soirée — table 3\r\n' +
      'Ombrelle;Émile;;Toute la soirée — table 3\r\n' +
      'Ombrelle;Iris;Club des Merles;Toute la soirée — table 7 (Terrasse)\r\n' +
      'Pervenche;Théo;"Atelier « la Sarcelle »; Nord";"Tour 1 — table 7 (Terrasse)\nTour 2 — pas de table"\r\n';
    assert.equal(texteCsv(listeBadges(m, charge)), attendu);
    // Mêmes entrées, mêmes octets.
    assert.deepEqual(listeBadges(modele(charge), charge), listeBadges(m, charge));
  });

  test('les cellules suivent la pile : l’ordre par table, une réédition, une proposition ; un exclu n’a pas de ligne', () => {
    const charge = aReserve();
    charge.participants[3].exclu = true;
    charge.retenu.placement = charge.retenu.placement.map(({ sieges, reserve }) => ({
      sieges: sieges.map((liste) => liste.map((id) => (id === 4 ? null : id)).filter((id) => id !== null)),
      reserve,
    }));
    charge.retenu.participants = charge.retenu.participants.filter((id) => id !== 4);
    const noms = (octets) => texteCsv(octets).split('\r\n').slice(1, -1).map((ligne) => ligne.split(';').slice(0, 2).join(' '));
    assert.deepEqual(noms(listeBadges(modele(charge), charge)), ['Grisaille ', 'Lacasse Ondine', 'Ombrelle Iris', 'Pervenche Théo']);
    assert.deepEqual(noms(listeBadges(modele(charge, { ordre: 'table' }), charge)), ['Lacasse Ondine', 'Ombrelle Iris', 'Pervenche Théo', 'Grisaille ']);
    assert.deepEqual(noms(listeBadges(modele(charge, { selection: [3, 1] }), charge)), ['Lacasse Ondine', 'Ombrelle Iris']);
  });

  test('la liste d’une proposition porte ses lignes à elle', () => {
    const charge = soiree({
      personnes: [personne(1, 'Iris', 'Ombrelle'), personne(2, 'Théo', 'Pervenche')],
      tables: [libellee(1, 7, 2, 'Terrasse'), table(2, 3, 2)],
      plan: [{ sieges: [[1], [2]] }],
      propositions: [
        [1, [{ sieges: [[1], [2]] }]],
        [2, [{ sieges: [[2], [1]] }]],
      ],
    });
    const m = modele(charge, { source: 'proposition', proposition: 2 });
    assert.equal(
      texteCsv(listeBadges(m, charge)),
      '\u{FEFF}Nom;Prénom;Organisation;Tours\r\nOmbrelle;Iris;;Tour 1 — table 3\r\nPervenche;Théo;;Tour 1 — table 7 (Terrasse)\r\n',
    );
  });
});

// Le numéro des doublons caché (§ 11.4, § 11.6) : sous cacherNumero, le
// badge d'une personne marquée nomNumerote imprime son nom sans le numéro
// final ; le badge garde le nom entier, que lisent l'ordre de la pile, les
// homonymes, la liste de réédition et la liste en CSV.
describe('planche : le numéro des doublons caché (§ 11.4, § 11.6)', () => {
  // Deux « Roger Galet » numérotés par l'import, une « Zoé Galet », un
  // « Louis Arc 14 » dont le numéro est saisi à la main, sans marque, et
  // une personne sans prénom numérotée deux fois, « Galet 01 01 ».
  const numerotes = () =>
    soiree({
      personnes: [
        personne(1, 'Roger', 'Galet 01', { nomNumerote: true }),
        personne(2, 'Roger', 'Galet 02', { nomNumerote: true }),
        personne(3, 'Zoé', 'Galet'),
        personne(4, 'Louis', 'Arc 14'),
        personne(5, null, 'Galet 01 01', { nomNumerote: true }),
      ],
      tables: [table(1, 1, 3), table(2, 2, 3)],
      plan: [{ sieges: [[1, 2, 3], [4, 5]] }],
    });
  const cache = (charge, autres = {}) => modele(charge, { cacherNumero: true, ...autres });

  test('le badge d’une personne marquée imprime son nom sans le numéro final, un seul ; le badge garde le nom entier ; un numéro saisi sans marque reste', () => {
    const m = cache(numerotes());
    assert.deepEqual(
      m.badges.map(({ participant, nom, textes }) => [participant, nom, textes.nom]),
      [
        [4, 'Louis Arc 14', 'Louis Arc 14'],
        [3, 'Zoé Galet', 'Zoé Galet'],
        [1, 'Roger Galet 01', 'Roger Galet'],
        [5, 'Galet 01 01', 'Galet 01'],
        [2, 'Roger Galet 02', 'Roger Galet'],
      ],
    );
  });

  test('par défaut, et sans personne marquée, le modèle est celui d’avant : le nom imprimé est le nom entier', () => {
    const charge = numerotes();
    assert.deepEqual(modele(charge, { cacherNumero: false }), modele(charge));
    for (const { nom, textes } of modele(charge).badges) assert.equal(textes.nom, nom);
    for (const sans of [aReserve(), homonymes()]) assert.deepEqual(cache(sans), modele(sans));
  });

  test('l’ordre de la pile et les homonymes se lisent sur le nom entier : aucun identifiant au pied de deux badges « Roger Galet »', () => {
    const charge = numerotes();
    const m = cache(charge);
    assert.deepEqual(
      m.badges.map(({ participant }) => participant),
      modele(charge).badges.map(({ participant }) => participant),
    );
    assert.deepEqual(m.homonymes, []);
    assert.deepEqual(homonymesDe(charge), []);
    for (const badge of m.badges) {
      assert.equal(badge.identifiant, null);
      assert.ok(!badge.textes.pied.some((ligne) => ligne.startsWith('Identifiant')), badge.nom);
    }
    assert.deepEqual(
      cache(charge, { ordre: 'table' }).badges.map(({ participant }) => participant),
      modele(charge, { ordre: 'table' }).badges.map(({ participant }) => participant),
    );
  });

  test('la liste de réédition de la feuille de contrôle et la liste en CSV gardent le nom entier', () => {
    const charge = numerotes();
    const reedite = cache(charge, { selection: [2, 1] });
    assert.deepEqual(reedite.badges.map(({ textes }) => textes.nom), ['Roger Galet', 'Roger Galet']);
    const lignes = textesControle(reedite, { papier: 'A4', imposition: 'feuille', planches: 1 });
    assert.deepEqual(lignes.slice(-2), ['Roger Galet 01', 'Roger Galet 02']);
    assert.ok(!lignes.includes('Roger Galet'));
    assert.deepEqual(listeBadges(cache(charge), charge), listeBadges(modele(charge), charge));
    assert.match(texteCsv(listeBadges(cache(charge), charge)), /\r\nGalet 01;Roger;/);
  });

  test('un nom que le retrait laisserait vide ou blanc s’imprime entier ; une option qui n’est pas un booléen lève TypeError', () => {
    const charge = numerotes();
    charge.participants[4].nom = ' 01';
    charge.participants[0].nom = '  07';
    const m = cache(charge);
    assert.equal(badgeDe(m, 5).textes.nom, ' 01');
    assert.equal(badgeDe(m, 1).textes.nom, 'Roger   07');
    for (const mauvais of ['oui', 1, null]) assert.throws(() => cache(charge, { cacherNumero: mauvais }), TypeError, String(mauvais));
  });
});

// Le logo du participant (§ 11.4, § 11.6) : le badge porte le chemin du logo
// de sa personne, que la séance lit et que la planche dessine ; la liste en
// CSV ne le porte jamais, et la feuille de contrôle compte les logos d'une
// ligne de texte, seulement quand un badge en désigne un.
describe('planche : le logo du participant', () => {
  const LOGO_A = `logo/${'0123456789abcdef'.repeat(4)}.png`;
  const LOGO_B = `logo/${'fedcba9876543210'.repeat(4)}.png`;
  const avecLogos = () => {
    const charge = aReserve();
    charge.participants[0].logo = LOGO_A;
    charge.participants[2].logo = LOGO_B;
    charge.participants[3].logo = LOGO_A;
    return charge;
  };

  test('chaque badge porte le chemin du logo de sa personne, null sans logo ; ses textes n’en changent pas', () => {
    const avec = modele(avecLogos());
    const sans = modele(aReserve());
    assert.deepEqual(avec.badges.map(({ participant, logo }) => [participant, logo]), [
      [5, null],
      [3, LOGO_B],
      [4, LOGO_A],
      [1, LOGO_A],
      [2, null],
    ]);
    assert.ok(sans.badges.every(({ logo }) => logo === null));
    assert.deepEqual(avec.badges.map(({ textes }) => textes), sans.badges.map(({ textes }) => textes));
  });

  test('la liste en CSV a les mêmes octets avec et sans logos', () => {
    const avec = avecLogos();
    const sans = aReserve();
    assert.deepEqual(listeBadges(modele(avec), avec), listeBadges(modele(sans), sans));
    assert.ok(!texteCsv(listeBadges(modele(avec), avec)).includes('logo/'));
  });

  test('la feuille de contrôle compte les logos d’une ligne, avant BROUILLON, quand logos est donné ; sans lui, les lignes d’avant', () => {
    const m = modele(avecLogos(), { selection: [1, 3] });
    const options = { papier: 'A4', imposition: 'feuille', planches: 1 };
    const avant = textesControle(m, options);
    assert.deepEqual(textesControle(m, { ...options, logos: null }), avant);
    assert.ok(!avant.some((ligne) => ligne.startsWith('Logos')), JSON.stringify(avant));
    const lignes = textesControle(m, { ...options, logos: { poses: 2, sansPlace: 1, introuvables: 3 } });
    const rang = lignes.indexOf('Logos : 2 posés, 1 sans place, 3 introuvables');
    assert.ok(rang > 0, JSON.stringify(lignes));
    assert.deepEqual([...lignes.slice(0, rang), ...lignes.slice(rang + 1)], avant);
    assert.equal(lignes[rang - 1], 'Imprimer en recto seul, à 100 %');
    assert.ok(textesControle(m, { ...options, logos: { poses: 1, sansPlace: 0, introuvables: 1 } }).includes('Logos : 1 posé, 0 sans place, 1 introuvable'));
    for (const logos of [{}, { poses: -1, sansPlace: 0, introuvables: 0 }, { poses: 1, sansPlace: 0 }, { poses: 1.5, sansPlace: 0, introuvables: 0 }, 'deux']) {
      assert.throws(() => textesControle(m, { ...options, logos }), TypeError, JSON.stringify(logos));
    }
  });
});
