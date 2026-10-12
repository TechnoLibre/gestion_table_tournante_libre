// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle des vues des collisions d'appartenance (§ 12.4, B13,
// D31) et des appartenances à chaque table (§ 12.11, B20, D35) : chaque
// nombre vient du détail du placement, dans son ordre ; les barres, leur
// pastille, leurs segments et leur jumeau ; la grille de la position, ses
// cases, son infobulle et son jumeau des trois comptes ; les cas qui cèdent
// la place à une phrase. Les détails se mesurent par detaillerQualite sur
// des plans écrits à la main, dont les comptes attendus sont calculés ici à
// la main. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { creerTraduction } from '../../application/traduction.js';
import { capacite, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { teintesAppartenances } from '../appartenances.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { modeleCollisions, modeleTables, sansCollision } from './appartenances.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';

// Une charge de personnes inventées, de tables de capacités données, et une
// proposition, n° 1, écrite à la main : à chaque tour, les listes de chaque
// table dans l'ordre des tables, sièges non attribués ; reserves, les
// personnes en réserve de chaque tour.
function chargeDe({ personnes, capacites, tours, reserves = tours.map(() => []) }) {
  const charge = creerCharge({ id: 'evt-appartenances', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: tours.length });
  charge.participants = personnes.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = capacites.map((sieges, rang) => ({
    id: rang + 1,
    numero: rang + 1,
    sieges,
    forme: 'ronde',
    position: { x: 300 * rang, y: 0 },
  }));
  charge.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: VERSION.affichee,
      siegesAttribues: false,
      tables: charge.tables.map(({ id }) => id),
      capacites: charge.tables.map((table) => capacite(charge, table)),
      tours: tours.length,
      participants: charge.participants.map(({ id }) => id),
      placement: tours.map((listes, r) => ({ sieges: listes, reserve: reserves[r] })),
    },
  ];
  charge.prochainsIds = { participant: personnes.length + 1, table: capacites.length + 1, proposition: 2 };
  charge.evenement.etat = 'propose';
  return charge;
}

// Treize personnes, quatre tables de 5, 4, 4 et 3 places, le même plan aux
// deux tours. Table 1 : un membre de chaque appartenance, trois places
// vides. Table 2 : deux membres de chacune. Table 3 : deux membres d'Aubier
// et deux personnes sans appartenance. Table 4 : trois bénévoles sans
// appartenance. Pour chaque case (c, o, α, δ) : table 1 (5, 2, 2, 2),
// table 2 (4, 4, 4, 2), table 3 (4, 4, 2, 1), table 4 sans affilié. Les
// comptes sièges, assis, doublons : table 1 (3, 0, 0), table 2 (2, 2, 2),
// table 3 (3, 3, 1). Les trois ordres diffèrent : sièges 1, 3, 2, 4 (1 et 3
// à égalité, départagées par l'ordre des tables) ; assis 3, 2, 1, 4 ;
// doublons 2, 3, 1, 4. Aubier : 5 membres, deux paires réunies à chaque
// tour, 4 collisions cumulées sur 2 paires distinctes ; Ressac : 3
// membres, une paire, 2 collisions sur 1 paire.
const PERSONNES_MELANGE = [
  ['Ombrelle', 'Iris', AUBIER],
  ['Lacasse', 'Ondine', RESSAC],
  ['Pervenche', 'Théo', AUBIER],
  ['Quenouille', 'Maëlle', AUBIER],
  ['Tourteau', 'Basile', RESSAC],
  ['Brindille', 'Anselme', RESSAC],
  ['Saule', 'Clothilde', AUBIER],
  ['Galet', 'Eudes', AUBIER],
  ['Mousse', 'Félicie', null],
  ['Ruisseau', 'Gaspard', null],
  ['Lichen', 'Hortense', null],
  ['Chardon', 'Jules', null],
  ['Ronce', 'Léonie', null],
];
const PLAN_MELANGE = [[1, 2], [3, 4, 5, 6], [7, 8, 9, 10], [11, 12, 13]];
const chargeMelange = () =>
  chargeDe({ personnes: PERSONNES_MELANGE, capacites: [5, 4, 4, 3], tours: [PLAN_MELANGE, PLAN_MELANGE] });

// Six personnes, deux appartenances de deux, deux tables de trois, deux
// tours : aucun membre ne retrouve l'autre membre de son appartenance.
const PERSONNES_SIX = [
  ['Ombrelle', 'Iris', AUBIER],
  ['Pervenche', 'Théo', AUBIER],
  ['Lacasse', 'Ondine', RESSAC],
  ['Tourteau', 'Basile', RESSAC],
  ['Quenouille', 'Maëlle', null],
  ['Varech', 'Sidonie', null],
];
const chargeSix = (personnes = PERSONNES_SIX) =>
  chargeDe({
    personnes,
    capacites: [3, 3],
    tours: [
      [[1, 3, 5], [2, 4, 6]],
      [[1, 4, 6], [2, 3, 5]],
    ],
  });

// Sept personnes, deux tables de 5 et 4 places, deux tours. Au tour 1, la
// table 1 réunit deux membres d'Aubier, un de Ressac et une personne sans
// appartenance (c, o, α, δ) = (5, 4, 3, 2), comptes (3, 2, 1) ; la table 2,
// trois personnes sans appartenance, sans affilié. Au tour 2, la table 1
// réunit les deux membres d'Aubier et deux personnes sans appartenance
// (5, 4, 2, 1), comptes (4, 3, 1) ; la table 2, le membre de Ressac et deux
// personnes sans appartenance (4, 3, 1, 1), comptes (3, 2, 0). La table 1
// est en tête sous les trois positions, et ses cases les plus hautes
// diffèrent d'une position à l'autre : 4, 3 et 1, chacune hors du tour 1
// sous « sièges » et « assis ».
const chargeSynthese = () =>
  chargeDe({
    personnes: [
      ['Ombrelle', 'Iris', AUBIER],
      ['Pervenche', 'Théo', AUBIER],
      ['Lacasse', 'Ondine', RESSAC],
      ['Mousse', 'Félicie', null],
      ['Ruisseau', 'Gaspard', null],
      ['Lichen', 'Hortense', null],
      ['Chardon', 'Jules', null],
    ],
    capacites: [5, 4],
    tours: [
      [[1, 2, 3, 4], [5, 6, 7]],
      [[1, 2, 4, 5], [3, 6, 7]],
    ],
  });

// Six personnes dont deux seules ont une appartenance, la même : une
// appartenance unique, dont les deux membres se retrouvent aux deux tours,
// 2 collisions cumulées sur une paire.
const chargeUneAppartenance = () =>
  chargeDe({
    personnes: [
      ['Ombrelle', 'Iris', AUBIER],
      ['Pervenche', 'Théo', AUBIER],
      ['Quenouille', 'Maëlle', null],
      ['Varech', 'Sidonie', null],
      ['Mousse', 'Félicie', null],
      ['Ruisseau', 'Gaspard', null],
    ],
    capacites: [3, 3],
    tours: [
      [[1, 2, 3], [4, 5, 6]],
      [[1, 2, 4], [3, 5, 6]],
    ],
  });

const detailDe = (charge) => detaillerQualite(charge, 1);
const teintesDe = (charge) => teintesAppartenances(charge.participants);

describe('modèle des collisions (§ 12.4, B13, D31)', () => {
  test('une barre par appartenance dans l’ordre du détail, sa pastille, ses deux segments et ses trois autres chiffres en encre secondaire', () => {
    const charge = chargeMelange();
    const detail = detailDe(charge);
    assert.equal(detail.statut, 'comparable');
    const modele = modeleCollisions(detail, { t, teintes: teintesDe(charge) });
    assert.equal(modele.cas, 'barres');
    assert.equal(modele.phrase, null);
    assert.deepEqual(
      modele.graphique.segments.map(({ genre }) => genre),
      ['prouve', 'reste'],
    );
    assert.deepEqual(
      modele.graphique.segments.map(({ libelle }) => libelle),
      [t('qualite.collisions.segment.prouve'), t('qualite.collisions.segment.reste')],
    );
    // Les comptes calculés à la main ; le plancher, lu au détail.
    assert.deepEqual(
      detail.collisions.lignes.map(({ groupe, effectif, cumulees, pairesDistinctes }) => [groupe, effectif, cumulees, pairesDistinctes]),
      [
        [AUBIER, 5, 4, 2],
        [RESSAC, 3, 2, 1],
      ],
    );
    const teintes = teintesDe(charge);
    assert.deepEqual(
      modele.graphique.lignes,
      detail.collisions.lignes.map((l) => ({
        id: l.groupe,
        nom: l.groupe,
        appartenance: teintes.get(l.groupe),
        valeurs: [l.prouve, l.reste],
        secondaire: t('qualite.collisions.secondaire', { effectif: l.effectif, paires: l.pairesDistinctes, excedent: l.excedent }),
      })),
    );
    assert.deepEqual(
      modele.graphique.lignes.map(({ appartenance }) => appartenance),
      [2, 1],
      'Ressac avant Aubier au comparateur de noms',
    );
    assert.match(modele.graphique.lignes[0].secondaire, /5/);
    assert.equal(modele.graphique.synthese, t('qualite.collisions.synthese', { appartenance: AUBIER, excedent: detail.collisions.lignes[0].excedent }));
  });

  test('le jumeau et l’infobulle portent la même ligne par appartenance, tous ses chiffres, dans l’ordre des barres', () => {
    const charge = chargeMelange();
    const detail = detailDe(charge);
    const modele = modeleCollisions(detail, { t, teintes: teintesDe(charge) });
    const [tableau] = modele.tableaux;
    assert.equal(modele.tableaux.length, 1);
    assert.equal(tableau.nom, t('qualite.collisions.graphique'));
    assert.deepEqual(
      tableau.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['appartenance', 'texte'],
        ['effectif', 'nombre'],
        ['cumulees', 'nombre'],
        ['prouve', 'nombre'],
        ['reste', 'nombre'],
        ['pairesDistinctes', 'nombre'],
        ['excedent', 'nombre'],
      ],
    );
    assert.deepEqual(
      tableau.lignes,
      detail.collisions.lignes.map((l) => ({
        appartenance: l.groupe,
        effectif: l.effectif,
        cumulees: l.cumulees,
        prouve: l.prouve,
        reste: l.reste,
        pairesDistinctes: l.pairesDistinctes,
        excedent: l.excedent,
      })),
    );
    assert.deepEqual(modele.graphique.infobulle, { colonnes: tableau.colonnes, lignes: tableau.lignes });
  });

  test('hors du domaine des planchers : un seul segment, les collisions cumulées, la phrase qui dit pourquoi, ni prouvé ni reste au jumeau', () => {
    const charge = chargeMelange();
    const detail = detailDe(charge);
    const hors = {
      ...detail,
      collisions: {
        planchersValides: false,
        lignes: detail.collisions.lignes.map((l) => ({ ...l, prouve: null, reste: null })),
      },
    };
    const modele = modeleCollisions(hors, { t, teintes: teintesDe(charge) });
    assert.equal(modele.cas, 'barres');
    assert.equal(modele.code, 'collisionsHorsDomaine');
    assert.equal(modele.phrase, t('qualite.collisions.horsDomaine'));
    assert.deepEqual(modele.graphique.segments, [{ genre: 'serie1', libelle: t('qualite.collisions.axe') }]);
    assert.deepEqual(
      modele.graphique.lignes.map(({ valeurs }) => valeurs),
      [[4], [2]],
    );
    assert.deepEqual(
      modele.tableaux[0].colonnes.map(({ cle }) => cle),
      ['appartenance', 'effectif', 'cumulees', 'pairesDistinctes', 'excedent'],
    );
  });

  test('une seule appartenance : ses barres et son jumeau, comme pour plusieurs (B15)', () => {
    const charge = chargeUneAppartenance();
    const detail = detailDe(charge);
    assert.equal(detail.G, 1);
    const modele = modeleCollisions(detail, { t, teintes: teintesDe(charge) });
    assert.equal(modele.cas, 'barres');
    assert.equal(modele.code, 'collisions');
    assert.equal(modele.phrase, null);
    assert.deepEqual(
      modele.graphique.lignes.map(({ id, valeurs }) => [id, valeurs.reduce((a, b) => a + b, 0)]),
      [[AUBIER, 2]],
    );
    assert.equal(modele.tableaux.length, 1);
  });

  test('une seule table, aucune appartenance, aucune collision : la phrase de chaque cas, sans graphique ni jumeau', () => {
    const uneTable = chargeDe({ personnes: PERSONNES_SIX, capacites: [6], tours: [[[1, 2, 3, 4, 5, 6]], [[1, 2, 3, 4, 5, 6]]] });
    const sans = chargeSix(PERSONNES_SIX.map(([nom, prenom]) => [nom, prenom, null]));
    const six = chargeSix();
    const cas = [
      [uneTable, 'uneTable', 'collisionsUneTable', 'qualite.collisions.uneTable'],
      [sans, 'aucuneAppartenance', 'collisionsAucuneAppartenance', 'qualite.collisions.aucuneAppartenance'],
      [six, 'aucune', 'collisionsAucune', 'qualite.collisions.aucune'],
    ];
    for (const [charge, nom, code, cle] of cas) {
      const modele = modeleCollisions(detailDe(charge), { t, teintes: teintesDe(charge) });
      assert.deepEqual(modele, { cas: nom, code, phrase: t(cle), graphique: null, tableaux: [] }, nom);
    }
    assert.equal(sansCollision(detailDe(six)), true);
    assert.equal(sansCollision(detailDe(chargeMelange())), false);
  });
});

describe('modèle des appartenances à chaque table (§ 12.11, B20, D35)', () => {
  // Le numéro de table de chaque ligne de la grille, dans l'ordre rendu.
  const numeros = (modele) => modele.grille.lignes.map(({ libelle }) => libelle);
  const tables = (...n) => n.map((numero) => t('qualite.tables.table', { numero }));

  test('sous chaque position, les lignes suivent l’ordre de la position, la pire table en tête, la table sans affilié en dernier', () => {
    const detail = detailDe(chargeMelange());
    const attendus = { sieges: [1, 3, 2, 4], assis: [3, 2, 1, 4], doublons: [2, 3, 1, 4] };
    for (const [position, ordre] of Object.entries(attendus)) {
      const modele = modeleTables(detail, position, { t });
      assert.equal(modele.cas, 'grille', position);
      assert.equal(modele.selecteur, true);
      assert.deepEqual(numeros(modele), tables(...ordre), position);
      assert.deepEqual(
        detail.tables.ordres[position].map((i) => detail.numerosTables[i]),
        ordre,
        position,
      );
    }
  });

  test('chaque case écrit le compte de la position, null pour « — » ; une colonne par tour', () => {
    const detail = detailDe(chargeMelange());
    const valeurs = {
      sieges: [3, 3, 3, 3, 2, 2, null, null],
      assis: [3, 3, 2, 2, 0, 0, null, null],
      doublons: [2, 2, 1, 1, 0, 0, null, null],
    };
    for (const [position, attendues] of Object.entries(valeurs)) {
      const { grille } = modeleTables(detail, position, { t });
      assert.deepEqual(grille.valeurs, attendues, position);
      assert.deepEqual(
        grille.colonnes,
        [1, 2].map((tour) => ({ libelle: t('qualite.tables.tour', { tour }) })),
      );
      assert.equal(grille.nom, t('qualite.tables.graphique'));
      assert.equal(grille.phrase, t('qualite.tables.tropLarge'));
    }
  });

  test('l’infobulle d’une case : sa table, son tour, le compte, le pourcentage de la position suivi de ses deux comptes, occupants, affiliés, capacité', () => {
    const detail = detailDe(chargeMelange());
    const pour = (pourcent) => t('qualite.pourcentage.valeur', { pourcent });
    const sieges = modeleTables(detail, 'sieges', { t }).grille.infobulle;
    assert.deepEqual(
      sieges.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['table', 'texte'],
        ['tour', 'texte'],
        ['compte', 'nombre'],
        ['pourcent', 'pourcentage'],
        ['occupants', 'nombre'],
        ['affilies', 'nombre'],
        ['capacite', 'nombre'],
      ],
    );
    // Table 1, tour 1 : δ = 2 sur 5 sièges, 40 %.
    assert.deepEqual(sieges.lignes[0], {
      table: t('qualite.tables.table', { numero: 1 }),
      tour: t('qualite.tables.tour', { tour: 1 }),
      compte: 3,
      pourcent: { texte: pour(40), compte: t('qualite.tables.ligne.sieges', { appartenances: 2, sieges: 5 }) },
      occupants: 2,
      affilies: 2,
      capacite: 5,
    });
    assert.equal(pour(40), '40\u{202F}%');
    assert.equal(sieges.lignes[0].pourcent.compte, '2 appartenances pour 5 sièges');
    // Table 3, tour 2, sous « assis » : δ = 1 pour 4 assis, 25 %.
    const assis = modeleTables(detail, 'assis', { t }).grille.infobulle;
    assert.deepEqual(assis.lignes[1].pourcent, { texte: pour(25), compte: '1 appartenance pour 4 assis' });
    // Table 2, sous « doublons » : δ = 2 pour 4 affiliés, 50 %.
    const doublons = modeleTables(detail, 'doublons', { t }).grille.infobulle;
    assert.deepEqual(doublons.lignes[0].pourcent, { texte: pour(50), compte: '2 appartenances pour 4 affiliés' });
    // Le compte de chaque case est celui de la position : la table 1 en
    // compte 3 sous « sièges », 0 sous « assis » et « doublons » ; la
    // table 3, 3 sous « assis », 1 sous « doublons ».
    const comptes = (infobulle) => infobulle.lignes.map(({ table, compte }) => [table, compte]);
    const table = (numero) => t('qualite.tables.table', { numero });
    const parCase = (liste) => liste.flatMap(([numero, compte]) => [[table(numero), compte], [table(numero), compte]]);
    assert.deepEqual(comptes(sieges), parCase([[1, 3], [3, 3], [2, 2], [4, null]]));
    assert.deepEqual(comptes(assis), parCase([[3, 3], [2, 2], [1, 0], [4, null]]));
    assert.deepEqual(comptes(doublons), parCase([[2, 2], [3, 1], [1, 0], [4, null]]));
    // Table 4, sans affilié : « — », sans compte inventé, sous les trois.
    for (const infobulle of [sieges, assis, doublons]) {
      assert.deepEqual(infobulle.lignes.slice(-2), [1, 2].map((tour) => ({
        table: t('qualite.tables.table', { numero: 4 }),
        tour: t('qualite.tables.tour', { tour }),
        compte: null,
        pourcent: { texte: null, compte: t('qualite.tables.sansAffilie') },
        occupants: null,
        affilies: null,
        capacite: 3,
      })));
    }
  });

  test('le jumeau : par table et tour, dans l’ordre de la position, les trois comptes et leurs trois pourcentages, chacun suivi du compte de sa ligne', () => {
    const detail = detailDe(chargeMelange());
    const pour = (pourcent) => t('qualite.pourcentage.valeur', { pourcent });
    const { tableaux } = modeleTables(detail, 'doublons', { t });
    assert.equal(tableaux.length, 1);
    const [tableau] = tableaux;
    assert.equal(tableau.nom, t('qualite.tables.graphique'));
    assert.deepEqual(
      tableau.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['table', 'texte'],
        ['tour', 'texte'],
        ['sieges', 'nombre'],
        ['pourcentSieges', 'pourcentage'],
        ['assis', 'nombre'],
        ['pourcentAssis', 'pourcentage'],
        ['doublons', 'nombre'],
        ['pourcentDoublons', 'pourcentage'],
        ['occupants', 'nombre'],
        ['affilies', 'nombre'],
        ['capacite', 'nombre'],
      ],
    );
    assert.deepEqual(
      tableau.lignes.map(({ table }) => table),
      tables(2, 2, 3, 3, 1, 1, 4, 4),
    );
    // Table 3, tour 1 : (c, o, α, δ) = (4, 4, 2, 1).
    assert.deepEqual(tableau.lignes[2], {
      table: t('qualite.tables.table', { numero: 3 }),
      tour: t('qualite.tables.tour', { tour: 1 }),
      sieges: 3,
      pourcentSieges: { texte: pour(25), compte: '1 appartenance pour 4 sièges' },
      assis: 3,
      pourcentAssis: { texte: pour(25), compte: '1 appartenance pour 4 assis' },
      doublons: 1,
      pourcentDoublons: { texte: pour(50), compte: '1 appartenance pour 2 affiliés' },
      occupants: 4,
      affilies: 2,
      capacite: 4,
    });
    assert.deepEqual(tableau.lignes[7].pourcentDoublons, { texte: null, compte: t('qualite.tables.sansAffilie') });
    assert.equal(tableau.lignes[7].doublons, null);
  });

  test('la synthèse nomme la pire table de la position et sa case la plus haute', () => {
    const detail = detailDe(chargeMelange());
    assert.equal(modeleTables(detail, 'sieges', { t }).grille.synthese, t('qualite.tables.synthese', { numero: 1, valeur: 3 }));
    assert.equal(modeleTables(detail, 'assis', { t }).grille.synthese, t('qualite.tables.synthese', { numero: 3, valeur: 3 }));
    assert.equal(modeleTables(detail, 'doublons', { t }).grille.synthese, t('qualite.tables.synthese', { numero: 2, valeur: 2 }));
  });

  test('la synthèse prend la case la plus haute de la pire table sous la position choisie, non sous une autre', () => {
    const detail = detailDe(chargeSynthese());
    assert.deepEqual(detail.tables.lignes[0].pire, { sieges: 4, assis: 3, doublons: 1 });
    for (const [position, valeur] of [['sieges', 4], ['assis', 3], ['doublons', 1]]) {
      const modele = modeleTables(detail, position, { t });
      assert.deepEqual(numeros(modele), tables(1, 2), position);
      assert.equal(modele.grille.synthese, t('qualite.tables.synthese', { numero: 1, valeur }), position);
    }
  });

  test('une seule appartenance : la grille sous les trois positions, le sélecteur et le jumeau (B15)', () => {
    const detail = detailDe(chargeUneAppartenance());
    assert.equal(detail.G, 1);
    for (const position of ['sieges', 'assis', 'doublons']) {
      const modele = modeleTables(detail, position, { t });
      assert.equal(modele.cas, 'grille', position);
      assert.equal(modele.selecteur, true, position);
      assert.equal(modele.tableaux.length, 1, position);
      assert.deepEqual(modele.grille.valeurs, { sieges: [2, 2, null, null], assis: [2, 2, null, null], doublons: [1, 1, null, null] }[position], position);
    }
  });

  test('sans collision : sous « doublons » seulement, la phrase des collisions, le sélecteur et le jumeau restent ; sous « sièges » et « assis », la grille', () => {
    const detail = detailDe(chargeSix());
    const doublons = modeleTables(detail, 'doublons', { t });
    assert.equal(doublons.cas, 'sansCollision');
    assert.equal(doublons.code, 'tablesSansCollision');
    assert.equal(doublons.phrase, t('qualite.collisions.aucune'));
    assert.equal(doublons.selecteur, true);
    assert.equal(doublons.grille, null);
    assert.equal(doublons.tableaux.length, 1);
    for (const position of ['sieges', 'assis']) {
      const modele = modeleTables(detail, position, { t });
      assert.equal(modele.cas, 'grille', position);
      assert.deepEqual(modele.grille.valeurs, [1, 1, 1, 1], position);
    }
  });

  test('une seule table, aucune appartenance : la phrase sous les trois positions, sans sélecteur, grille ni jumeau', () => {
    const uneTable = chargeDe({ personnes: PERSONNES_SIX, capacites: [6], tours: [[[1, 2, 3, 4, 5, 6]], [[1, 2, 3, 4, 5, 6]]] });
    const sans = chargeSix(PERSONNES_SIX.map(([nom, prenom]) => [nom, prenom, null]));
    for (const position of ['sieges', 'assis', 'doublons']) {
      assert.deepEqual(modeleTables(detailDe(uneTable), position, { t }), {
        cas: 'uneTable',
        code: 'tablesUneTable',
        phrase: t('qualite.tables.uneTable'),
        selecteur: false,
        grille: null,
        tableaux: [],
      });
      assert.deepEqual(modeleTables(detailDe(sans), position, { t }), {
        cas: 'aucuneAppartenance',
        code: 'tablesAucuneAppartenance',
        phrase: t('qualite.tables.aucuneAppartenance'),
        selecteur: false,
        grille: null,
        tableaux: [],
      });
    }
  });

  test('une position hors des trois lève RangeError', () => {
    const detail = detailDe(chargeMelange());
    for (const faute of ['Sieges', 'tous', null, undefined]) {
      assert.throws(() => modeleTables(detail, faute, { t }), RangeError, String(faute));
    }
  });
});
