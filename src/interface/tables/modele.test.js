// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle de la section des tables (§ 4, § 6.1, § 6.2, § 2.1
// étape 5) : l'état d'une table, l'énoncé d'un changement de défaut, et ce
// que les fenêtres et les compléments d'un refus ou d'un avertissement
// nomment. Les bilans viennent des fonctions d'A4 sur des charges
// d'épreuve ; les textes, de la traduction réelle. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { bilanChangementDefaut, bilanSuppressionTable, bilanTours } from '../../application/bilans.js';
import { controlerCapacite } from '../../application/capacite.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  annonceSuppression,
  annonceTours,
  avertissementsNommes,
  cleForme,
  comptesTables,
  elementsSuppression,
  elementsTours,
  enonceDefaut,
  etatTable,
  refusDeCommande,
  refusDuChampDefaut,
  siegesRetiresNommes,
  surchargesPerdues,
  tablesParNumero,
  tonEtatTable,
} from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
];

const personne = (id, exclu = false) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length][0],
  prenom: NOMS[(id - 1) % NOMS.length][1],
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu,
});

const resa = (participant, table, siege, tour = null) => ({ participant, table, siege, portee: tour === null ? 'tous' : 'tour', tour });

// Une charge : les tables données ({id, numero, sieges}), n personnes dont
// les exclus, R tours, un défaut.
function chargeDe({ tables = [], n = 0, exclus = [], tours = 2, defaut = 8, attribuerSieges = false, reservations = [], titres = [] } = {}) {
  const charge = creerCharge({ id: 'evt-tables', nom: 'Soirée des Merles', siegesParDefaut: defaut, tours });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = Array.from({ length: n }, (_, rang) => personne(rang + 1, exclus.includes(rang + 1)));
  charge.tables = tables.map(({ id, numero = id, sieges = null }) => ({ id, numero, sieges, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: n + 1, table: Math.max(0, ...tables.map(({ id }) => id)) + 1, proposition: 1 };
  return charge;
}

// Treize tables : neuf suivent 8, les tables 3, 6, 9 et 12 sont surchargées
// à 7, 7, 6 et 12 ; 120 personnes, dont 2 exclues.
function treizeTables() {
  const surcharges = new Map([[3, 7], [6, 7], [9, 6], [12, 12]]);
  const tables = Array.from({ length: 13 }, (_, rang) => ({ id: rang + 1, sieges: surcharges.get(rang + 1) ?? null }));
  return chargeDe({ tables, n: 120, exclus: [40, 80] });
}

// L'énoncé traduit, ses phrases séparées d'une espace, comme l'écran les pose.
const traduire = (entrees) => entrees.map(({ cle, details }) => t(cle, details)).join(' ');

describe('etatTable : l’état, pas seulement la valeur (§ 6.1)', () => {
  test('une table qui suit le défaut : sa capacité est le défaut, et rien à réaligner', () => {
    assert.deepEqual(etatTable({ id: 1, numero: 1, sieges: null }, 8), { cle: 'tables.etat.suitDefaut', capacite: 8, realignable: false });
    assert.equal(t('tables.etat.suitDefaut'), 'Suit le défaut');
  });

  test('une table surchargée à la valeur du défaut : même capacité, autre état, réalignable', () => {
    const suit = etatTable({ id: 1, numero: 1, sieges: null }, 8);
    const surchargee = etatTable({ id: 2, numero: 2, sieges: 8 }, 8);
    assert.equal(surchargee.capacite, suit.capacite);
    assert.notEqual(t(surchargee.cle), t(suit.cle));
    assert.deepEqual(surchargee, { cle: 'tables.etat.surchargee', capacite: 8, realignable: true });
  });

  test('une surcharge garde sa valeur quand le défaut change', () => {
    assert.equal(etatTable({ id: 1, numero: 1, sieges: 6 }, 10).capacite, 6);
    assert.equal(etatTable({ id: 1, numero: 1, sieges: null }, 10).capacite, 10);
  });

  test('cleForme : une clé par forme, traduite ; une forme inconnue lève', () => {
    assert.deepEqual(['ronde', 'carree'].map((forme) => t(cleForme(forme))), ['Ronde', 'Carrée']);
    assert.throws(() => cleForme('ovale'), RangeError);
  });

  test('tablesParNumero : par numéro croissant, sans toucher la charge', () => {
    const charge = chargeDe({ tables: [{ id: 1, numero: 3 }, { id: 2, numero: 1 }, { id: 3, numero: 2 }] });
    const avant = structuredClone(charge.tables);
    const ordre = tablesParNumero(charge).map(({ numero }) => numero);
    assert.equal(ordre.length, 3);
    assert.deepEqual(ordre, [1, 2, 3]);
    assert.deepEqual(charge.tables, avant);
  });
});

describe('enonceDefaut : la conséquence chiffrée avant l’application (§ 6.1)', () => {
  test('le bilan du § 6.1, traduit, est exactement l’énoncé du spec', () => {
    const charge = treizeTables();
    const entrees = enonceDefaut(bilanChangementDefaut(charge, 10), charge.tables);
    assert.equal(entrees.length, 2);
    assert.equal(
      traduire(entrees),
      '9 tables suivent le défaut et passent de 8 à 10 places ; 4 tables surchargées (7, 7, 6, 12) ne changent pas. ' +
        'Total : 104 \u{2192} 122 sièges pour 118 participants.',
    );
  });

  test('une table seule, aucune surchargée : le singulier', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 1 });
    assert.equal(
      traduire(enonceDefaut(bilanChangementDefaut(charge, 10), charge.tables)),
      '1 table suit le défaut et passe de 8 à 10 places. Total : 8 \u{2192} 10 sièges pour 1 participant.',
    );
  });

  test('une surchargée seule, aucune table qui suit : leur forme', () => {
    const charge = chargeDe({ tables: [{ id: 1, sieges: 6 }], n: 4 });
    assert.equal(
      traduire(enonceDefaut(bilanChangementDefaut(charge, 10), charge.tables)),
      'Aucune table ne suit le défaut ; 1 table surchargée (6) ne change pas. Total : 6 \u{2192} 6 sièges pour 4 participants.',
    );
  });

  test('une baisse de 8 à 6, sans réservation : sa forme', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 10 });
    assert.equal(
      traduire(enonceDefaut(bilanChangementDefaut(charge, 6), charge.tables)),
      '3 tables suivent le défaut et passent de 8 à 6 places. Total : 24 \u{2192} 18 sièges pour 10 participants.',
    );
  });

  test('une baisse refusée : la table 2 nommée par son numéro, avec son refus, et aucune forme d’application', () => {
    const reservations = [1, 2, 3, 4, 5, 6, 7].map((p) => resa(p, 2, null));
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 10, reservations });
    const bilan = bilanChangementDefaut(charge, 6);
    assert.equal(bilan.refus.length, 1);
    const entrees = enonceDefaut(bilan, charge.tables);
    assert.equal(entrees.length, 2);
    assert.deepEqual(entrees[1], {
      cle: 'tables.defaut.refusTable',
      details: { numero: 2, refus: { code: 'SOUS_RESERVATIONS', details: bilan.refus[0].details } },
    });
    assert.equal(bilan.refus[0].details.n, 7);
    const texte = traduire(entrees);
    assert.ok(texte.includes(`Table 2 \u{2014} ${t('SOUS_RESERVATIONS', bilan.refus[0].details)}`), texte);
    assert.ok(texte.includes('7 réservations'), texte);
    for (const cle of entrees.map((entree) => entree.cle)) {
      assert.ok(!['tables.defaut.application', 'tables.defaut.total'].includes(cle), cle);
    }
  });

  test('le numéro affiché nomme la table, non son identifiant ; une table inconnue lève', () => {
    const reservations = [1, 2, 3, 4, 5, 6, 7].map((p) => resa(p, 2, null));
    const charge = chargeDe({ tables: [{ id: 1, numero: 4 }, { id: 2, numero: 9 }], n: 10, reservations });
    const bilan = bilanChangementDefaut(charge, 6);
    assert.equal(enonceDefaut(bilan, charge.tables)[1].details.numero, 9);
    assert.throws(() => enonceDefaut(bilan, []), TypeError);
  });

  test('moins de deux places : un refus de l’événement entier, que le champ porte', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    const bilan = bilanChangementDefaut(charge, 1);
    assert.deepEqual(refusDuChampDefaut(bilan), { code: 'MOINS_DE_DEUX', details: { remede: null } });
    const entrees = enonceDefaut(bilan, charge.tables);
    assert.equal(entrees[1].details.numero, null);
    assert.equal(t(entrees[1].cle, entrees[1].details), t('MOINS_DE_DEUX', {}));
    assert.equal(refusDuChampDefaut(bilanChangementDefaut(charge, 10)), null);
  });

  test('le réalignement refusé : son en-tête, la table 2 nommée avec son refus, et aucune forme d’application', () => {
    const reservations = Array.from({ length: 11 }, (_, rang) => resa(rang + 1, 2, null));
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2, sieges: 12 }], n: 12, reservations });
    assert.equal(bilanChangementDefaut(charge, 10).refus.length, 0);
    const bilan = bilanChangementDefaut(charge, 10, { realigner: true });
    assert.equal(bilan.refus.length, 1);
    const entrees = enonceDefaut(bilan, charge.tables, { realigner: true });
    assert.equal(entrees.length, 2);
    assert.deepEqual(entrees[0], { cle: 'tables.defaut.realignementRefuse', details: { avant: 8, apres: 10 } });
    assert.deepEqual(entrees[1], {
      cle: 'tables.defaut.refusTable',
      details: { numero: 2, refus: { code: 'SOUS_RESERVATIONS', details: bilan.refus[0].details } },
    });
    const texte = traduire(entrees);
    assert.ok(texte.includes(`Table 2 \u{2014} ${t('SOUS_RESERVATIONS', bilan.refus[0].details)}`), texte);
    assert.ok(!texte.includes('Le défaut ne passe pas'), texte);
    assert.equal(enonceDefaut(bilan, charge.tables)[0].cle, 'tables.defaut.refusee');
  });
});

describe('ce que nomment les fenêtres (§ 6.1, § 6.2, § 2.1 étape 5)', () => {
  test('surchargesPerdues : chaque surcharge par numéro de table, celles qu’un réalignement efface', () => {
    const elements = surchargesPerdues(treizeTables());
    assert.equal(elements.length, 4);
    assert.deepEqual(
      elements.map(({ cle, details }) => t(cle, details)),
      ['Table 3 : 7 places', 'Table 6 : 7 places', 'Table 9 : 6 places', 'Table 12 : 12 places'],
    );
  });

  test('elementsTours : les réservations détruites, personnes et tables, puis les placements touchés', () => {
    const charge = chargeDe({
      tables: [{ id: 1, numero: 1 }, { id: 2, numero: 5 }],
      n: 4,
      tours: 4,
      reservations: [resa(1, 2, null, 4), resa(2, 1, null, 4), resa(3, 1, null, 2)],
    });
    charge.propositions = [{ id: 1, tours: 4 }, { id: 2, tours: 4 }];
    charge.retenu = { proposition: 1, tours: 4 };
    const bilan = bilanTours(charge, 3);
    assert.equal(annonceTours(bilan, 4, 3), true);
    const textes = elementsTours(charge, bilan).map(({ cle, details }) => t(cle, details));
    assert.equal(textes.length, 5);
    assert.deepEqual(textes, [
      'Iris Ombrelle : réservation à la table 5 au tour 4, détruite',
      'Théo Pervenche : réservation à la table 1 au tour 4, détruite',
      t('tables.touchee.proposition', { id: 1 }),
      t('tables.touchee.proposition', { id: 2 }),
      t('tables.touchee.retenu'),
    ]);
  });

  test('annonceTours : rien à annoncer sans réservation détruite ni placement touché', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2, tours: 4, reservations: [resa(1, 1, null, 2)] });
    assert.equal(annonceTours(bilanTours(charge, 3), 4, 3), false);
    assert.equal(annonceTours(bilanTours(charge, 4), 4, 4), false);
  });

  test('annonceTours : une hausse ne détruit rien et n’annonce rien ; une baisse annonce les placements qui perdent des tours', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2, tours: 2 });
    charge.propositions = [{ id: 1, tours: 2 }];
    charge.retenu = { proposition: 1, tours: 2 };
    const hausse = bilanTours(charge, 3);
    assert.deepEqual(hausse.propositionsTouchees, [1]);
    assert.equal(hausse.retenuTouche, true);
    assert.equal(annonceTours(hausse, 2, 3), false);
    assert.equal(annonceTours(bilanTours(charge, 1), 2, 1), true);
    charge.retenu = null;
    assert.equal(annonceTours(bilanTours(charge, 1), 2, 1), true);
    assert.equal(annonceTours(bilanTours(charge, 5), 2, 5), false);
  });

  test('elementsSuppression : la réservation d’Iris Ombrelle et le titre « animateur » ; une table nue n’annonce rien', () => {
    const charge = chargeDe({
      tables: [{ id: 1 }, { id: 2 }],
      n: 2,
      attribuerSieges: true,
      reservations: [resa(1, 1, 3)],
      titres: [{ table: 1, siege: 3, libelle: 'animateur' }],
    });
    const bilan = bilanSuppressionTable(charge, 1);
    assert.equal(annonceSuppression(bilan), true);
    const textes = elementsSuppression(charge, bilan).map(({ cle, details }) => t(cle, details));
    assert.equal(textes.length, 2);
    assert.deepEqual(textes, ['Iris Ombrelle : réservation pour tous les tours, siège 3', 'Titre « animateur », siège 3']);
    assert.equal(annonceSuppression(bilanSuppressionTable(charge, 2)), false);
    assert.deepEqual(elementsSuppression(charge, bilanSuppressionTable(charge, 2)), []);
  });
});

// Un objectif de table (§ 4.5) : la soirée pour tour null, sinon le tour
// désigné ; regle null suit le défaut.
const objectif = (tour, etiquettes, regle = null) => ({ portee: tour === null ? 'tous' : 'tour', tour, regle, etiquettes });

describe('les objectifs perdus, nommés par les fenêtres (§ 2.1 étape 5, § 4.3, § 6.2, A3, A6, A16)', () => {
  test('elementsTours : les réservations détruites, puis chaque objectif des tours retirés, sa table et ses étiquettes, puis les placements ; l’objectif de la soirée reste', () => {
    const charge = chargeDe({ tables: [{ id: 1, numero: 1 }, { id: 2, numero: 5 }], n: 4, tours: 4, reservations: [resa(1, 2, null, 4)] });
    charge.tables[0].objectifs = [objectif(null, ['finance']), objectif(3, ['Montréal', 'finance'], 'et'), objectif(4, ['bénévole'])];
    charge.tables[1].objectifs = [objectif(4, ['cuisine'])];
    charge.propositions = [{ id: 1, tours: 4 }];
    const bilan = bilanTours(charge, 2);
    assert.equal(annonceTours(bilan, 4, 2), true);
    assert.deepEqual(
      elementsTours(charge, bilan).map(({ cle, details }) => t(cle, details)),
      [
        'Iris Ombrelle : réservation à la table 5 au tour 4, détruite',
        'Table 1 : objectif du tour 3 (« Montréal », « finance »), détruit',
        'Table 1 : objectif du tour 4 (« bénévole »), détruit',
        'Table 5 : objectif du tour 4 (« cuisine »), détruit',
        t('tables.touchee.proposition', { id: 1 }),
      ],
    );
  });

  test('annonceTours : un objectif de tour détruit s’annonce seul, sans réservation ni placement ; celui de la soirée, jamais', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2, tours: 3 });
    charge.tables[0].objectifs = [objectif(null, ['finance'])];
    assert.equal(annonceTours(bilanTours(charge, 1), 3, 1), false);
    charge.tables[0].objectifs.push(objectif(3, ['finance']));
    assert.equal(annonceTours(bilanTours(charge, 2), 3, 2), true);
    assert.equal(annonceTours(bilanTours(charge, 3), 3, 3), false);
  });

  test('elementsSuppression : une table qui ne porte que des objectifs s’annonce, chacun nommé, la soirée d’abord, ses étiquettes séparées d’une virgule, sans « et » qui dirait une règle', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 2, tours: 3 });
    charge.tables[0].objectifs = [objectif(null, ['finance', 'ressources humaines']), objectif(2, ['bénévole'], 'et')];
    const bilan = bilanSuppressionTable(charge, 1);
    assert.equal(annonceSuppression(bilan), true);
    assert.deepEqual(
      elementsSuppression(charge, bilan).map(({ cle, details }) => t(cle, details)),
      ['Objectif de la soirée : « finance », « ressources humaines »', 'Objectif du tour 2 : « bénévole »'],
    );
    assert.equal(annonceSuppression(bilanSuppressionTable(charge, 2)), false);
  });
});

describe('les compléments d’un refus et d’un avertissement (§ 6.2)', () => {
  test('siegesRetiresNommes : le siège 8 et son titre, puis le siège 7 et Iris Ombrelle, dans cet ordre', () => {
    const charge = chargeDe({
      tables: [{ id: 1 }],
      n: 2,
      attribuerSieges: true,
      reservations: [resa(1, 1, 7)],
      titres: [{ table: 1, siege: 8, libelle: 'animateur' }],
    });
    const { refus } = controlerCapacite(charge, 1, 6, { origine: 'champ' });
    assert.equal(refus.code, 'SIEGES_RETIRES');
    const lignes = siegesRetiresNommes(charge, refus);
    assert.equal(lignes.length, 2);
    assert.deepEqual(
      lignes.map(({ cle, details, nom }) => [t(cle, details), nom]),
      [
        ['Siège 8 : titre « animateur »', null],
        ['Siège 7 :', 'Iris Ombrelle'],
      ],
    );
    const sept = siegesRetiresNommes(charge, controlerCapacite(charge, 1, 7, { origine: 'champ' }).refus);
    assert.deepEqual(sept.map(({ details }) => details.siege), [8]);
  });

  test('siegesRetiresNommes : rien pour un autre refus', () => {
    assert.deepEqual(siegesRetiresNommes(chargeDe(), { code: 'MOINS_DE_DEUX', details: { remede: null } }), []);
  });

  test('avertissementsNommes : SURNUMERAIRES nomme ses personnes, dans l’ordre reçu, et sa table par son numéro', () => {
    const charge = chargeDe({ tables: [{ id: 3, numero: 7 }], n: 4 });
    const nommes = avertissementsNommes(charge, [
      { code: 'SURNUMERAIRES', details: { table: 3, tour: 2, personnes: [4, 2] } },
      { code: 'AU_DELA_LISIBLE', details: { seuil: 16 } },
    ]);
    assert.equal(nommes.length, 2);
    assert.deepEqual(nommes[0], {
      code: 'SURNUMERAIRES',
      details: { table: 3, tour: 2, personnes: [4, 2] },
      numero: 7,
      noms: ['Grisaille', 'Théo Pervenche'],
    });
    assert.deepEqual(nommes[1], { code: 'AU_DELA_LISIBLE', details: { seuil: 16 }, numero: null, noms: [] });
  });
});

describe('refusDeCommande : la commande essayée sans rien écrire', () => {
  test('zéro tour : le code que la commande donne à moins d’un tour ; trois tours : aucun refus', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2, tours: 4 });
    const zero = refusDeCommande(charge, 'changerTours', { tours: 0 });
    assert.equal(zero.code, 'MOINS_D_UN_TOUR');
    assert.equal(zero.details.remede, null);
    assert.equal(refusDeCommande(charge, 'changerTours', { tours: 3 }), null);
    assert.equal(charge.evenement.tours, 4);
  });
});

describe('comptesTables et tonEtatTable : l’en-tête et la pastille de la liste des tables', () => {
  test('le nombre de tables et le total de leurs sièges, défaut et surcharges compris', () => {
    assert.deepEqual(comptesTables(treizeTables()), { tables: 13, sieges: 9 * 8 + 7 + 7 + 6 + 12 });
    assert.deepEqual(comptesTables(chargeDe({ tables: [{ id: 1 }, { id: 2, sieges: 3 }], defaut: 6 })), { tables: 2, sieges: 9 });
  });

  test('sans table : deux zéros', () => {
    assert.deepEqual(comptesTables(chargeDe()), { tables: 0, sieges: 0 });
  });

  test('le libellé compose la ligne, accordée au nombre', () => {
    assert.equal(t('tables.liste.comptes', { tables: 13, sieges: 104 }), '13 tables \u{00B7} 104 sièges');
    assert.equal(t('tables.liste.comptes', { tables: 1, sieges: 1 }), '1 table \u{00B7} 1 siège');
    assert.equal(t('tables.liste.comptes', { tables: 0, sieges: 0 }), '0 table \u{00B7} 0 siège');
  });

  test('la pastille de l’état : neutre pour une table qui suit le défaut, information pour une surchargée', () => {
    assert.equal(tonEtatTable(etatTable({ sieges: null }, 8)), 'neutre');
    assert.equal(tonEtatTable(etatTable({ sieges: 5 }, 8)), 'information');
    assert.equal(tonEtatTable(etatTable({ sieges: 8 }, 8)), 'information');
  });
});

describe('la présence par tour dans les tables (§ 6.1, § 2.1 étape 5)', () => {
  // La charge, chaque présence donnée posée sur sa personne.
  const avecPresences = (charge, presences) => {
    for (const [id, presence] of Object.entries(presences)) charge.participants[Number(id) - 1].presence = presence;
    return charge;
  };

  test('elementsTours : une ligne par présence rognée, exclues comprises, après les objectifs et avant les placements', () => {
    const charge = avecPresences(
      chargeDe({ tables: [{ id: 1, numero: 1 }, { id: 2, numero: 5 }], n: 4, tours: 5, exclus: [4], reservations: [resa(3, 2, null, 5)] }),
      { 1: [1, 2, 5], 2: [1, 2, 3, 5], 4: [4] },
    );
    charge.tables[0].objectifs = [objectif(4, ['bénévole'])];
    charge.propositions = [{ id: 1, tours: 5 }];
    const bilan = bilanTours(charge, 3);
    assert.equal(bilan.presencesRognees.length, 3);
    assert.deepEqual(
      elementsTours(charge, bilan).map(({ cle, details }) => t(cle, details)),
      [
        'Ondine Lacasse : réservation à la table 5 au tour 5, détruite',
        'Table 1 : objectif du tour 4 (« bénévole »), détruit',
        'Présence de Iris Ombrelle : tours 1 et 2 au lieu des tours 1, 2 et 5',
        'Présence de Théo Pervenche : tous les tours au lieu des tours 1 à 3 et 5',
        'Présence de Grisaille : tous les tours au lieu du tour 4',
        t('tables.touchee.proposition', { id: 1 }),
      ],
    );
  });

  test('annonceTours : une présence rognée s’annonce seule, sans réservation, objectif ni placement', () => {
    const charge = avecPresences(chargeDe({ tables: [{ id: 1 }], n: 3, tours: 4 }), { 2: [1, 4] });
    assert.equal(annonceTours(bilanTours(charge, 3), 4, 3), true);
    assert.equal(annonceTours(bilanTours(charge, 5), 4, 5), false);
    delete charge.participants[1].presence;
    assert.equal(annonceTours(bilanTours(charge, 3), 4, 3), false);
  });

  test('enonceDefaut : sous présence partielle, le total compte les personnes présentes au plus à un même tour ; sans, le texte d’aujourd’hui', () => {
    const charge = avecPresences(chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 6, tours: 3, defaut: 8 }), { 1: [1, 2], 2: [2, 3] });
    const bilan = bilanChangementDefaut(charge, 10);
    assert.equal(bilan.participants, 6);
    const [, total] = enonceDefaut(bilan, charge.tables, { partielle: true });
    assert.equal(t(total.cle, total.details), 'Total : 16 \u{2192} 20 sièges pour 6 personnes présentes au plus à un même tour.');
    assert.equal(
      traduire(enonceDefaut(bilan, charge.tables)),
      '2 tables suivent le défaut et passent de 8 à 10 places. Total : 16 \u{2192} 20 sièges pour 6 participants.',
    );
    assert.equal(
      t('tables.defaut.total', { totalAvant: 2, totalApres: 2, participants: 1, partielle: true }),
      'Total : 2 \u{2192} 2 sièges pour 1 personne présente au plus à un même tour.',
    );
  });

  test('enonceDefaut : un refus n’a pas de total, partielle ou non', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 3, tours: 2, reservations: [1, 2, 3].map((p) => resa(p, 1, null)) });
    const bilan = bilanChangementDefaut(charge, 2);
    assert.ok(bilan.refus.length > 0);
    assert.deepEqual(enonceDefaut(bilan, charge.tables, { partielle: true }), enonceDefaut(bilan, charge.tables));
  });
});
