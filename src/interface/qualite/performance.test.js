// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle de la vue « Performance du calcul » (§ 12.14, B23,
// D40, D49) : la ligne de tête — mouvements évalués sur le compte, durée,
// cœurs, cadence et nombre de la génération, ou « durée inconnue » sans
// cadence ; « rien à reprendre » sous le compte, « le plan initial » à zéro
// mouvement — ; un petit multiple par valeur, le minimum brut d'abord, sur
// l'abscisse des points de relevé ; la phrase du dernier changement, bornée
// aux mouvements évalués ; le jumeau, points × valeurs, sans durée ; les
// phrases du retenu et de la course absente. Les détails sont écrits à la
// main sur le contrat de detaillerQualite (evaluation.js), sauf la dernière
// épreuve, qui le prend d'une génération du moteur.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher, repartir } from '../../moteur/recherche.js';
import { avecCourses, courseDe } from '../../stockage/courses.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { planDepuisFichier } from '../../stockage/placements.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cleIndicateur, vuePerformance } from './performance.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const ecrire = { t, format };

// Les valeurs d'un point : le minimum brut, l'excédent de collisions, les
// rencontres répétées.
const valeurs = (minimumBrut, excedentCollisions, rencontresRepeteesChoisies) => ({
  minimumBrut,
  excedentCollisions,
  rencontresRepeteesChoisies,
});

// Un détail comparable d'épreuve, sur le contrat de detaillerQualite : la
// proposition 4, sa course de quatre points, une génération de la séance.
function detailDe({ id = 4, propositionDuRetenu = null, course = {}, derivation = null } = {}) {
  const base = {
    source: id === 'retenu' ? 'retenu' : 'proposition',
    propositionDuRetenu: id === 'retenu' ? propositionDuRetenu : null,
    evalues: 200,
    arret: 200,
    indicateurs: ['minimumBrut', 'excedentCollisions', 'rencontresRepeteesChoisies'],
    releves: [
      { mouvements: 1, valeurs: valeurs(1, 6, 9) },
      { mouvements: 10, valeurs: valeurs(2, 4, 7) },
      { mouvements: 100, valeurs: valeurs(3, 2, 5) },
      { mouvements: 200, valeurs: valeurs(3, 2, 5) },
    ],
    dernierChangement: 100,
    generation: { dureeMs: 2500, coeurs: 2, cadence: 1600, nombre: 3 },
  };
  return {
    id,
    statut: 'comparable',
    raisons: [],
    propositionDuRetenu,
    course: course === null ? null : { ...base, ...course },
    derivation,
  };
}

// Les clés des colonnes du jumeau, dans leur ordre.
const clesDuJumeau = (vue) => vue.jumeau.colonnes.map(({ cle }) => cle);

describe('qualite/performance : la ligne de tête (§ 12.14, § 5.10, D40)', () => {
  test('une génération de la séance : mouvements sur le compte, durée observée, cœurs, cadence, propositions', () => {
    const vue = vuePerformance(detailDe(), ecrire);
    assert.deepEqual(vue.tete, [
      t('qualite.performance.mouvements', { evalues: '200', arret: '200' }),
      t('qualite.performance.duree', { duree: format.duree(2500) }),
      t('qualite.performance.coeurs', { coeurs: 2 }),
      t('qualite.performance.cadence', { cadence: format.nombre(1600) }),
      t('qualite.performance.propositions', { nombre: 3 }),
    ]);
    assert.equal(vue.tete[1], 'durée observée 2,5 s');
    assert.equal(vue.tete[3], 'cadence 1\u{202F}600 mouvements par seconde');
    assert.deepEqual(vue.phrases, []);
  });

  test('rouge : une durée nulle ou inconnue écrit « durée inconnue », sans aucune cadence, même portée par le détail', () => {
    for (const generation of [
      { dureeMs: null, coeurs: 1, cadence: 950, nombre: 1 },
      { dureeMs: null, coeurs: null, cadence: null, nombre: null },
    ]) {
      const vue = vuePerformance(detailDe({ course: { generation } }), ecrire);
      assert.ok(vue.tete.includes(t('qualite.performance.dureeInconnue')), JSON.stringify(generation));
      assert.equal(vue.tete.filter((morceau) => morceau.includes('cadence')).length, 0, JSON.stringify(generation));
      assert.equal(vue.tete.filter((morceau) => morceau.startsWith('durée observée')).length, 0);
    }
    const inconnue = vuePerformance(detailDe({ course: { generation: { dureeMs: null, coeurs: null, cadence: null, nombre: null } } }), ecrire);
    assert.deepEqual(inconnue.tete, [t('qualite.performance.mouvements', { evalues: '200', arret: '200' }), 'durée inconnue']);
  });

  test("rouge : sous le compte, « rien à reprendre » ; la phrase du dernier changement s'arrête aux mouvements évalués, jamais au compte", () => {
    const releves = [
      { mouvements: 1, valeurs: valeurs(1, 6, 9) },
      { mouvements: 10, valeurs: valeurs(2, 4, 7) },
      { mouvements: 100, valeurs: valeurs(2, 4, 7) },
      { mouvements: 1000, valeurs: valeurs(2, 4, 7) },
      { mouvements: 3412, valeurs: valeurs(2, 4, 7) },
    ];
    const vue = vuePerformance(detailDe({ course: { evalues: 3412, arret: 20000, releves, dernierChangement: 10 } }), ecrire);
    assert.equal(vue.tete[0], 'rien à reprendre après 3\u{202F}412 mouvements sur 20\u{202F}000');
    assert.equal(vue.dernierChangement, t('qualite.performance.dernierChangement', { de: '10', a: '3\u{202F}412' }));
    assert.ok(!vue.dernierChangement.includes('20\u{202F}000'));
    assert.deepEqual(vue.abscisses, [1, 10, 100, 1000, 3412]);
  });

  // Un arrêt avant le compte, sous les réglages de la génération : le
  // n-uplet atteint zéro au dernier mouvement évalué, une valeur y passe donc
  // à zéro, et le dernier changement tombe sur les mouvements évalués.
  test("rouge : un arrêt avant le compte change au dernier point évalué : « rien à reprendre », la phrase du dernier point, jamais celle d'un intervalle", () => {
    const releves = [
      { mouvements: 1, valeurs: valeurs(1, 6, 9) },
      { mouvements: 10, valeurs: valeurs(2, 4, 7) },
      { mouvements: 100, valeurs: valeurs(2, 3, 4) },
      { mouvements: 1000, valeurs: valeurs(2, 1, 2) },
      { mouvements: 3412, valeurs: valeurs(2, 0, 0) },
    ];
    const vue = vuePerformance(detailDe({ course: { evalues: 3412, arret: 20000, releves, dernierChangement: 3412 } }), ecrire);
    assert.equal(vue.tete[0], 'rien à reprendre après 3\u{202F}412 mouvements sur 20\u{202F}000');
    assert.equal(vue.dernierChangement, t('qualite.performance.changeAuDernier', { a: '3\u{202F}412' }));
    assert.notEqual(vue.dernierChangement, t('qualite.performance.dernierChangement', { de: '3\u{202F}412', a: '3\u{202F}412' }));
    assert.deepEqual(vue.jumeau.lignes.at(-1), { mouvements: 3412, ...valeurs(2, 0, 0) });
  });

  test("à zéro mouvement : « le plan initial n'avait rien à reprendre », un seul point, aucun graphique ni phrase de changement", () => {
    const course = { evalues: 0, releves: [{ mouvements: 0, valeurs: valeurs(2, 4, 7) }], dernierChangement: 0 };
    const vue = vuePerformance(detailDe({ course }), ecrire);
    assert.equal(vue.tete[0], "le plan initial n'avait rien à reprendre");
    assert.deepEqual([vue.multiples, vue.abscisses, vue.dernierChangement, vue.synthese], [[], null, null, null]);
    assert.deepEqual(vue.jumeau.lignes, [{ mouvements: 0, ...valeurs(2, 4, 7) }]);
  });

  test('un seul mouvement évalué, au compte 1 : un point, sa phrase, aucun graphique', () => {
    const course = { evalues: 1, arret: 1, releves: [{ mouvements: 1, valeurs: valeurs(2, 4, 7) }], dernierChangement: 1 };
    const vue = vuePerformance(detailDe({ course }), ecrire);
    assert.equal(vue.tete[0], t('qualite.performance.mouvements', { evalues: '1', arret: '1' }));
    assert.equal(vue.tete[0], '1 mouvement évalué sur 1');
    assert.deepEqual(vue.phrases, [{ code: 'unPoint', texte: t('qualite.performance.unPoint') }]);
    assert.deepEqual([vue.multiples, vue.abscisses, vue.dernierChangement], [[], null, null]);
    assert.equal(vue.jumeau.lignes.length, 1);
  });
});

describe('qualite/performance : les petits multiples et le jumeau (§ 12.14, D49)', () => {
  test('un graphique par valeur, le minimum brut d’abord, dans l’ordre du détail, sur les mouvements de chaque point', () => {
    const vue = vuePerformance(detailDe(), ecrire);
    assert.deepEqual(vue.abscisses, [1, 10, 100, 200]);
    assert.deepEqual(
      vue.multiples.map(({ nom, graphique, libelle, valeurs: v }) => [nom, graphique, libelle, v]),
      [
        ['minimumBrut', 'performance-minimumBrut', 'minimum brut', [1, 2, 3, 3]],
        ['excedentCollisions', 'performance-excedentCollisions', 'excédent de collisions', [6, 4, 2, 2]],
        ['rencontresRepeteesChoisies', 'performance-rencontresRepeteesChoisies', 'rencontres répétées', [9, 7, 5, 5]],
      ],
    );
    const titres = vue.multiples.map(({ titre }) => titre);
    assert.equal(new Set(titres).size, titres.length, 'chaque graphique a son nom');
    assert.equal(titres[0], t('qualite.performance.graphique', { indicateur: 'minimum brut' }));
    assert.equal(vue.multiples[1].synthese, t('qualite.performance.syntheseIndicateur', { indicateur: 'excédent de collisions', premier: '6', dernier: '2' }));
    assert.equal(vue.synthese, t('qualite.performance.synthese'));
  });

  test('rouge : le jumeau porte une ligne par point, ses mouvements puis une colonne par valeur, et aucune durée', () => {
    const vue = vuePerformance(detailDe(), ecrire);
    assert.deepEqual(clesDuJumeau(vue), ['mouvements', 'minimumBrut', 'excedentCollisions', 'rencontresRepeteesChoisies']);
    assert.ok(vue.jumeau.colonnes.every(({ genre }) => genre === 'nombre'));
    assert.deepEqual(
      vue.jumeau.colonnes.map(({ libelle }) => libelle),
      [t('qualite.performance.colonne.mouvements'), 'minimum brut', 'excédent de collisions', 'rencontres répétées'],
    );
    assert.deepEqual(vue.jumeau.lignes, [
      { mouvements: 1, ...valeurs(1, 6, 9) },
      { mouvements: 10, ...valeurs(2, 4, 7) },
      { mouvements: 100, ...valeurs(3, 2, 5) },
      { mouvements: 200, ...valeurs(3, 2, 5) },
    ]);
    assert.equal(vue.jumeau.nom, t('qualite.performance.jumeau'));
    for (const ligne of vue.jumeau.lignes) assert.deepEqual(Object.keys(ligne), clesDuJumeau(vue));
  });

  test('le dernier changement : avant le dernier point, entre lui et les mouvements évalués ; au dernier, sa phrase', () => {
    assert.equal(vuePerformance(detailDe(), ecrire).dernierChangement, t('qualite.performance.dernierChangement', { de: '100', a: '200' }));
    const auDernier = vuePerformance(detailDe({ course: { dernierChangement: 200 } }), ecrire);
    assert.equal(auDernier.dernierChangement, t('qualite.performance.changeAuDernier', { a: '200' }));
  });

  test('une valeur sans aucun point mesuré — un a priori inconnu — garde sa colonne, « — », sans graphique', () => {
    const indicateurs = ['minimumBrut', 'ecartAuPlafondAPrioriMax'];
    const releves = [
      { mouvements: 1, valeurs: { minimumBrut: 1, ecartAuPlafondAPrioriMax: null } },
      { mouvements: 10, valeurs: { minimumBrut: 2, ecartAuPlafondAPrioriMax: null } },
    ];
    const vue = vuePerformance(detailDe({ course: { indicateurs, releves, evalues: 10, arret: 10, dernierChangement: 10 } }), ecrire);
    assert.deepEqual(vue.multiples.map(({ nom }) => nom), ['minimumBrut']);
    assert.deepEqual(clesDuJumeau(vue), ['mouvements', 'minimumBrut', 'ecartAuPlafondAPrioriMax']);
    assert.equal(vue.jumeau.lignes[0].ecartAuPlafondAPrioriMax, null);
  });

  test('la clé du nom de chaque valeur : celle de la page pour le minimum brut, celle du moteur pour une valeur qui classe', () => {
    assert.equal(cleIndicateur('minimumBrut'), 'qualite.performance.minimumBrut');
    assert.equal(cleIndicateur('redondance'), 'moteur.valeur.redondance');
  });
});

describe('qualite/performance : le retenu et la course absente (§ 12.6, § 12.14, B15)', () => {
  test('un retenu non ajusté : la vue dit qu’elle mesure une proposition, la nomme et en montre la course', () => {
    const vue = vuePerformance(detailDe({ id: 'retenu', propositionDuRetenu: 2 }), ecrire);
    assert.deepEqual(vue.phrases, [{ code: 'retenu', texte: t('qualite.performance.retenu', { proposition: 2 }) }]);
    assert.equal(vue.multiples.length, 3);
    assert.notEqual(vue.tete, null);
  });

  test('un retenu ajusté, ou dont la proposition est effacée : sa phrase, rien d’autre', () => {
    const vue = vuePerformance(detailDe({ id: 'retenu', propositionDuRetenu: null, course: null }), ecrire);
    assert.deepEqual(vue.phrases, [{ code: 'retenuSansCourse', texte: t('qualite.performance.retenuSansCourse') }]);
    assert.deepEqual([vue.tete, vue.multiples, vue.jumeau, vue.dernierChangement], [null, [], null, null]);
  });

  test('un retenu dont la proposition est dans la liste sans course gardée : il la nomme, et dit sa course non gardée', () => {
    const vue = vuePerformance(detailDe({ id: 'retenu', propositionDuRetenu: 3, course: null }), ecrire);
    assert.deepEqual(vue.phrases, [{ code: 'retenuCourseNonGardee', texte: t('qualite.performance.retenuCourseNonGardee', { proposition: 3 }) }]);
    assert.deepEqual([vue.tete, vue.multiples, vue.jumeau], [null, [], null]);
  });

  test('une proposition sans course gardée : « Sa course n’est pas gardée. », rien d’autre', () => {
    const vue = vuePerformance(detailDe({ course: null }), ecrire);
    assert.deepEqual(vue.phrases, [{ code: 'sansCourse', texte: "Sa course n'est pas gardée." }]);
    assert.deepEqual([vue.tete, vue.multiples, vue.jumeau, vue.synthese], [null, [], null, null]);
  });

  test('sans détail, ou un détail qui ne se compare pas : rien', () => {
    for (const detail of [null, { id: 4, statut: 'derive', raisons: [{ code: 'X' }], course: null, propositionDuRetenu: null }]) {
      assert.deepEqual(vuePerformance(detail, ecrire), {
        phrases: [],
        tete: null,
        synthese: null,
        dernierChangement: null,
        abscisses: null,
        multiples: [],
        jumeau: null,
      });
    }
  });
});

describe('qualite/performance : sur le détail d’une génération du moteur (§ 12.14, D40)', () => {
  // Six personnes inventées, deux appartenances, deux tables de trois
  // places, deux tours.
  function chargeSix() {
    const charge = creerCharge({ id: 'evt-performance', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
    const noms = [
      ['Ombrelle', 'Iris', 'Coopérative Aubier'],
      ['Pervenche', 'Théo', 'Coopérative Aubier'],
      ['Lacasse', 'Ondine', 'Atelier Ressac'],
      ['Tourteau', 'Basile', 'Atelier Ressac'],
      ['Quenouille', 'Maëlle', null],
      ['Varech', 'Sidonie', null],
    ];
    charge.participants = noms.map(([nom, prenom, appartenance], rang) => ({
      id: rang + 1,
      nom,
      prenom,
      appartenance,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    }));
    charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
    charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
    return charge;
  }

  test('le jumeau reprend chaque point du détail, le dernier à ses mouvements évalués ; un graphique par valeur', () => {
    const charge = chargeSix();
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 5, nombre: 1, arret: 300 });
    const rendu = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee });
    const courses = avecCourses(new Map(), rendu.courses);
    const detail = detaillerQualite(rendu.charge, 1, { courseDe: (id) => courseDe({ charge: rendu.charge, courses }, id) });
    const vue = vuePerformance(detail, ecrire);
    assert.deepEqual(
      vue.jumeau.lignes,
      detail.course.releves.map(({ mouvements, valeurs: v }) => ({ mouvements, ...v })),
    );
    assert.equal(vue.jumeau.lignes.at(-1).mouvements, detail.course.evalues);
    assert.deepEqual(clesDuJumeau(vue), ['mouvements', ...detail.course.indicateurs]);
    assert.ok(vue.multiples.length >= 1);
    assert.equal(vue.multiples[0].nom, 'minimumBrut');
    assert.ok(vue.tete.includes('durée inconnue'));
  });
});

describe('qualite/performance : la course d’une dérivée part du plan de son départ (§ 12.14, C23, D76)', () => {
  // Une filiation de la forme que rend derivationDe (src/application/depart.js).
  const filiation = (depart, toursFiges = [], departPresent = true) => ({ depart, toursFiges, departPresent });

  test('une dérivée : « partie de la proposition n° 2 » suit les mouvements évalués, en tête de la génération', () => {
    const vue = vuePerformance(detailDe({ derivation: filiation(2, [1]) }), ecrire);
    assert.deepEqual(vue.tete, [
      t('qualite.performance.mouvements', { evalues: '200', arret: '200' }),
      'partie de la proposition n° 2',
      t('qualite.performance.duree', { duree: format.duree(2500) }),
      t('qualite.performance.coeurs', { coeurs: 2 }),
      t('qualite.performance.cadence', { cadence: format.nombre(1600) }),
      t('qualite.performance.propositions', { nombre: 3 }),
    ]);
  });

  test('le départ qui n’est plus dans la liste, sans tour figé, ou à zéro mouvement : la phrase reste, au même numéro', () => {
    assert.equal(vuePerformance(detailDe({ derivation: filiation(7, [], false) }), ecrire).tete[1], 'partie de la proposition n° 7');
    const aZero = vuePerformance(detailDe({ derivation: filiation(7), course: { evalues: 0, releves: [{ mouvements: 0, valeurs: valeurs(1, 6, 9) }] } }), ecrire);
    assert.deepEqual(aZero.tete.slice(0, 2), [t('qualite.performance.planInitial'), 'partie de la proposition n° 7']);
  });

  test('un retenu non ajusté venu d’une dérivée le dit aussi ; sans filiation, la tête est celle d’une proposition tirée', () => {
    const retenu = vuePerformance(detailDe({ id: 'retenu', propositionDuRetenu: 5, course: { propositionDuRetenu: 5 }, derivation: filiation(2) }), ecrire);
    assert.equal(retenu.tete[1], 'partie de la proposition n° 2');
    for (const detail of [detailDe(), detailDe({ id: 'retenu', propositionDuRetenu: 5, course: { propositionDuRetenu: 5 } })]) {
      const tete = vuePerformance(detail, ecrire).tete;
      assert.equal(tete.filter((morceau) => morceau.startsWith('partie de')).length, 0, String(detail.id));
    }
  });

  test('sans course gardée, aucune tête : rien ne dit d’où part une course qui n’est pas montrée', () => {
    const vue = vuePerformance(detailDe({ course: null, derivation: filiation(2) }), ecrire);
    assert.equal(vue.tete, null);
    assert.deepEqual(vue.phrases.map(({ code }) => code), ['sansCourse']);
  });

  test('sur le détail d’une dérivée du moteur, enregistrée sous son départ : la tête le nomme', () => {
    const charge = creerCharge({ id: 'evt-performance', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
    const noms = [
      ['Ombrelle', 'Iris'],
      ['Pervenche', 'Théo'],
      ['Lacasse', 'Ondine'],
      ['Tourteau', 'Basile'],
      ['Quenouille', 'Maëlle'],
      ['Varech', 'Sidonie'],
    ];
    charge.participants = noms.map(([nom, prenom], rang) => ({
      id: rang + 1,
      nom,
      prenom,
      appartenance: rang < 3 ? 'Coopérative Aubier' : null,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    }));
    charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
    charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
    const configuration = configurationDepuisCharge(charge);
    const produitVersion = VERSION.affichee;
    const premiere = appliquerCommande('enregistrerGeneration', charge, {
      propositions: rechercher(configuration, { graine: 5, nombre: 1, arret: 300 }),
      configuration,
      produitVersion,
    });
    const depart = { plan: planDepuisFichier(premiere.charge.propositions[0]), toursFiges: [1] };
    const derivees = appliquerCommande('enregistrerGeneration', premiere.charge, {
      propositions: repartir(configuration, { graine: 9, nombre: 1, arret: 300 }, depart),
      configuration,
      produitVersion,
      derivation: { depart: 1, toursFiges: [1] },
    });
    const courses = avecCourses(avecCourses(new Map(), premiere.courses), derivees.courses);
    const lire = (id) => courseDe({ charge: derivees.charge, courses }, id);
    const detail = detaillerQualite(derivees.charge, 2, { courseDe: lire });
    assert.notEqual(detail.course, null);
    assert.deepEqual(detail.derivation, { depart: 1, toursFiges: [1], departPresent: true });
    assert.equal(vuePerformance(detail, ecrire).tete[1], 'partie de la proposition n° 1');
    const duDepart = vuePerformance(detaillerQualite(derivees.charge, 1, { courseDe: lire }), ecrire);
    assert.equal(duDepart.tete.filter((morceau) => morceau.startsWith('partie de')).length, 0);
  });
});
