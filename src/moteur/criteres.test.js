// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du registre des critères (§ 5.3, § 5.7, D8 à D11, D15, D20, D23) :
// les constantes du registre, la validation d'une liste de priorités faute
// par faute sous chaque mode, son complément, les valeurs qui classent, la
// compilation, celle d'une instance, et la garde de la contrainte 35 : hors
// du registre, aucune source ne recopie une liste des noms de critères ni un
// ordre de comparaison. La compilation de l'ordre par défaut se compare, sous
// les seize combinaisons des quatre cases, à un n-uplet écrit en clair : six
// composantes, celles d'un critère décoché retirées, comparées dans le même
// ordre avant et après l'annulation de l'écart, qu'aucun palier « contrainte »
// ne suit alors.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import {
  CASES,
  COMPOSANTES_DES_MODES,
  CRITERES,
  FAMILLE,
  MODES_OBJECTIFS,
  ORDRE_PAR_DEFAUT,
  POIDS_MAX,
  PRIORITES_PAR_DEFAUT,
  VALEURS_DES_MODES,
  compilationDe,
  compiler,
  completerPriorites,
  composantesDe,
  estCoche,
  seulsASonPalier,
  valeursQuiClassent,
  verifierPriorites,
} from './criteres.js';

// Les quatre cases que porte toute configuration.
const QUATRE_CASES = ['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable', 'varierOrganisations'];

// Les contraintes d'un masque de quatre bits, dans l'ordre de QUATRE_CASES.
const contraintesDu = (masque) =>
  Object.fromEntries(QUATRE_CASES.map((cle, bit) => [cle, (masque & (1 << bit)) !== 0]));

const TOUTES_COCHEES = contraintesDu(0b1111);

// Une entrée de palier.
const e = (critere, poids = 1) => ({ critere, poids });

// La liste canonique : chaque critère seul à son palier, dans l'ordre de
// CRITERES, en entrées fraîches. Elle sert de liste valide quelconque.
const canonique = () => CRITERES.map((nom) => [e(nom)]);

// L'ordre par défaut, écrit en clair, palier par palier, en entrées fraîches.
const parDefaut = () =>
  [
    'conflitsOrganisation',
    'excedentCollisions',
    'rencontresRepetees',
    'collisionsCumulees',
    'ecartAuPlafondAPrioriMax',
    'toursHorsObjectif',
    'animateursNonRencontres',
    'redondance',
  ].map((nom) => [e(nom)]);

// La liste dont le palier d'index i est remplacé par les paliers donnés
// (aucun : le palier est retiré).
const remplacer = (liste, i, ...paliers) => [...liste.slice(0, i), ...paliers, ...liste.slice(i + 1)];

// Le compte qui fait compter les noms donnés, et eux seuls.
const comptant = (...noms) => (nom) => noms.includes(nom);

// Le compte qui fait compter chaque critère sauf le conflit d'organisation,
// sans objet tant qu'aucune personne n'a de liste de conflits.
const horsConflits = (nom) => nom !== 'conflitsOrganisation';

// Le compte des quatre cases : le critère coché, sans conflit, sans objectif
// ni case des animateurs (ni le conflit d'organisation, ni les tours hors
// objectif, ni les animateurs non rencontrés n'ont d'objet).
const compteDesCases = (contraintes) => (nom) =>
  estCoche(nom, contraintes) && horsConflits(nom) && nom !== 'toursHorsObjectif' && nom !== 'animateursNonRencontres';

// Le nom de chaque composante du n-uplet compilé, par rang : la grandeur
// qu'elle descend quand son palier n'a qu'un critère, sinon les critères
// joints par « + ».
function nomsDesComposantes({ paliers, taille }, mode = 'places') {
  const noms = new Array(taille);
  for (const { criteres, composantes } of paliers) {
    const grandeurs = criteres.length === 1
      ? composantesDe(criteres[0].nom, mode)
      : [criteres.map(({ nom }) => nom).join('+')];
    assert.equal(grandeurs.length, composantes.length);
    composantes.forEach((rang, k) => { noms[rang] = grandeurs[k]; });
  }
  return noms;
}

// Les deux ordres compilés, lus en noms de composantes.
function ordresNommes(compilation, mode) {
  const noms = nomsDesComposantes(compilation, mode);
  return {
    score: compilation.ordreScore.map((rang) => noms[rang]),
    contraintes: compilation.ordreContraintes.map((rang) => noms[rang]),
  };
}

// Le n-uplet de l'ordre par défaut sous les quatre cases, sans objectif ni
// case des animateurs : six composantes nommées, et leurs deux ordres de
// comparaison. Les composantes de l'écart ne sont suivies que de la
// redondance, un raffinement : la bascule ne les déplace pas.
const COMPOSANTES_DU_DEFAUT = [
  'excedentCollisions',
  'rencontresRepetees',
  'collisionsCumulees',
  'ecartAuPlafondAPrioriMax',
  'carresEcartsAuPlafondAPriori',
  'redondance',
];
const SCORE_DU_DEFAUT = [0, 1, 2, 3, 4, 5];
const CONTRAINTES_DU_DEFAUT = [0, 1, 2, 3, 4, 5];

// Les composantes que ces contraintes retirent du n-uplet de l'ordre par
// défaut, par rang : celles d'un critère décoché.
const retireesDuDefaut = (c) => [
  !c.separerOrganisations,
  !c.nouveauxVoisins && !c.nouvelleTable,
  !c.separerOrganisations,
  false,
  false,
  !c.varierOrganisations,
];

describe('criteres : le registre (contrat de données, § 5.7)', () => {
  test("les huit critères, dans l'ordre du tableau du § 5.7, le conflit d'organisation en dernier", () => {
    assert.deepEqual(CRITERES, [
      'ecartAuPlafondAPrioriMax',
      'excedentCollisions',
      'collisionsCumulees',
      'toursHorsObjectif',
      'rencontresRepetees',
      'animateursNonRencontres',
      'redondance',
      'conflitsOrganisation',
    ]);
    assert.ok(Object.isFrozen(CRITERES));
  });

  test('la famille de chaque critère', () => {
    assert.deepEqual(
      CRITERES.map((nom) => FAMILLE[nom]),
      ['rencontres', 'contrainte', 'contrainte', 'contrainte', 'contrainte', 'raffinement', 'raffinement', 'contrainte'],
    );
    assert.ok(Object.isFrozen(FAMILLE));
  });

  test('les cases qui font compter chaque critère (tableau de A8)', () => {
    assert.deepEqual(CRITERES.map((nom) => CASES[nom]), [
      [],
      ['separerOrganisations'],
      ['separerOrganisations'],
      ['respecterObjectifs'],
      ['nouveauxVoisins', 'nouvelleTable'],
      ['rencontrerAnimateurs'],
      ['varierOrganisations'],
      [],
    ]);
    assert.ok(Object.isFrozen(CASES) && CRITERES.every((nom) => Object.isFrozen(CASES[nom])));
  });

  test("l'ordre par défaut : conflits, excédent, rencontres répétées, cumulées, écart, puis objectifs, animateurs, redondance", () => {
    assert.deepEqual(ORDRE_PAR_DEFAUT, parDefaut().map(([{ critere }]) => critere));
    assert.ok(Object.isFrozen(ORDRE_PAR_DEFAUT));
    // Une permutation du registre, qui garde son ordre canonique à part.
    assert.deepEqual([...ORDRE_PAR_DEFAUT].sort(), [...CRITERES].sort());
    assert.notDeepEqual(ORDRE_PAR_DEFAUT, CRITERES);
  });

  test("les priorités par défaut : chaque critère seul à son palier, au poids 1, dans l'ordre par défaut ; le poids au plus 100", () => {
    assert.deepEqual(PRIORITES_PAR_DEFAUT, parDefaut());
    assert.ok(Object.isFrozen(PRIORITES_PAR_DEFAUT));
    assert.ok(PRIORITES_PAR_DEFAUT.every((palier) => Object.isFrozen(palier) && Object.isFrozen(palier[0])));
    assert.equal(POIDS_MAX, 100);
  });

  test('les trois modes, leurs valeurs qui classent et les grandeurs que la recherche descend', () => {
    assert.deepEqual(MODES_OBJECTIFS, ['places', 'chacun', 'minimum']);
    assert.deepEqual(VALEURS_DES_MODES, {
      places: ['toursHorsObjectif'],
      chacun: ['jamaisServies', 'toursHorsObjectif'],
      minimum: ['horsObjectifMax', 'toursHorsObjectif'],
    });
    assert.deepEqual(COMPOSANTES_DES_MODES, {
      places: ['toursHorsObjectif'],
      chacun: ['jamaisServies', 'toursHorsObjectif'],
      minimum: ['horsObjectifMax', 'personnesAuMax', 'toursHorsObjectif'],
    });
    for (const table of [MODES_OBJECTIFS, VALEURS_DES_MODES, COMPOSANTES_DES_MODES]) assert.ok(Object.isFrozen(table));
    for (const mode of MODES_OBJECTIFS) {
      assert.ok(Object.isFrozen(VALEURS_DES_MODES[mode]) && Object.isFrozen(COMPOSANTES_DES_MODES[mode]));
    }
  });

  test('seulsASonPalier : écart, rencontres répétées et conflits ; tours hors objectif sous chacun et minimum (D8, D23)', () => {
    assert.deepEqual(seulsASonPalier('places'), ['ecartAuPlafondAPrioriMax', 'rencontresRepetees', 'conflitsOrganisation']);
    for (const mode of ['chacun', 'minimum']) {
      assert.deepEqual(seulsASonPalier(mode), [
        'ecartAuPlafondAPrioriMax', 'toursHorsObjectif', 'rencontresRepetees', 'conflitsOrganisation',
      ]);
    }
    assert.deepEqual(seulsASonPalier(), seulsASonPalier('places'));
  });

  test("composantesDe : deux pour l'écart, celles du mode pour les tours hors objectif, la grandeur seule ailleurs", () => {
    const autres = [
      'excedentCollisions', 'collisionsCumulees', 'rencontresRepetees', 'animateursNonRencontres', 'redondance', 'conflitsOrganisation',
    ];
    for (const mode of MODES_OBJECTIFS) {
      assert.deepEqual(composantesDe('ecartAuPlafondAPrioriMax', mode), [
        'ecartAuPlafondAPrioriMax',
        'carresEcartsAuPlafondAPriori',
      ]);
      assert.deepEqual(composantesDe('toursHorsObjectif', mode), COMPOSANTES_DES_MODES[mode]);
      for (const nom of autres) assert.deepEqual(composantesDe(nom, mode), [nom]);
    }
    assert.deepEqual(composantesDe('toursHorsObjectif'), ['toursHorsObjectif']);
  });

  test("un nom de critère ou de mode inconnu lève RangeError, même un nom hérité d'Object", () => {
    for (const nom of ['inconnu', '__proto__', 'constructor', 'toString', undefined]) {
      assert.throws(() => estCoche(nom, TOUTES_COCHEES), RangeError, String(nom));
      assert.throws(() => composantesDe(nom), RangeError, String(nom));
      assert.throws(() => valeursQuiClassent(nom, TOUTES_COCHEES), RangeError, String(nom));
    }
    for (const mode of ['tous', '__proto__', 'constructor', null]) {
      assert.throws(() => seulsASonPalier(mode), RangeError, String(mode));
      assert.throws(() => composantesDe('redondance', mode), RangeError, String(mode));
      assert.throws(() => valeursQuiClassent('redondance', TOUTES_COCHEES, mode), RangeError, String(mode));
      assert.throws(() => verifierPriorites(canonique(), mode), RangeError, String(mode));
      assert.throws(() => compiler(canonique(), () => true, mode), RangeError, String(mode));
    }
  });
});

describe('criteres : les cases (§ 5.3, A8)', () => {
  test("l'écart et les conflits comptent toujours ; une case, deux critères de collision ; les rencontres sous l'une ou l'autre case", () => {
    for (let masque = 0; masque < 16; masque += 1) {
      const c = contraintesDu(masque);
      assert.equal(estCoche('ecartAuPlafondAPrioriMax', c), true);
      assert.equal(estCoche('conflitsOrganisation', c), true);
      assert.equal(estCoche('conflitsOrganisation', { ...c, respecterObjectifs: false, rencontrerAnimateurs: true }), true);
      assert.equal(estCoche('excedentCollisions', c), c.separerOrganisations);
      assert.equal(estCoche('collisionsCumulees', c), c.separerOrganisations);
      assert.equal(estCoche('rencontresRepetees', c), c.nouveauxVoisins || c.nouvelleTable);
      assert.equal(estCoche('redondance', c), c.varierOrganisations);
    }
  });

  test('les deux cases facultatives : absentes, les objectifs cochés et les animateurs décochés', () => {
    assert.equal(estCoche('toursHorsObjectif', TOUTES_COCHEES), true);
    assert.equal(estCoche('animateursNonRencontres', TOUTES_COCHEES), false);
    assert.equal(estCoche('toursHorsObjectif', { ...TOUTES_COCHEES, respecterObjectifs: false }), false);
    assert.equal(estCoche('toursHorsObjectif', { ...TOUTES_COCHEES, respecterObjectifs: true }), true);
    assert.equal(estCoche('animateursNonRencontres', { ...TOUTES_COCHEES, rencontrerAnimateurs: true }), true);
    assert.equal(estCoche('animateursNonRencontres', { ...TOUTES_COCHEES, rencontrerAnimateurs: false }), false);
  });
});

describe('criteres : verifierPriorites, faute par faute (D8, A12, A16)', () => {
  test("l'ordre par défaut et la liste canonique sont valides sous chaque mode ; le mode par défaut est places", () => {
    for (const mode of MODES_OBJECTIFS) {
      assert.equal(verifierPriorites(parDefaut(), mode), null, mode);
      assert.equal(verifierPriorites(canonique(), mode), null, mode);
    }
    assert.equal(verifierPriorites(PRIORITES_PAR_DEFAUT), null);
  });

  test('un palier partagé, des poids de 1 à 100, un ordre réglé sont valides', () => {
    const liste = [
      [e('excedentCollisions', 100), e('collisionsCumulees', 3)],
      [e('ecartAuPlafondAPrioriMax')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres', 2), e('redondance', 7)],
      [e('toursHorsObjectif')],
      [e('conflitsOrganisation')],
    ];
    for (const mode of MODES_OBJECTIFS) assert.equal(verifierPriorites(liste, mode), null, mode);
  });

  test("forme : dans un palier, les critères hors de l'ordre du tableau du § 5.7 (A16)", () => {
    for (const mode of MODES_OBJECTIFS) {
      const inverses = remplacer(remplacer(canonique(), 2), 1, [e('collisionsCumulees', 3), e('excedentCollisions', 100)]);
      assert.deepEqual(verifierPriorites(inverses, mode), {
        faute: 'forme', critere: 'excedentCollisions', palier: 1,
      }, mode);
      // Le premier critère rangé avant celui qui le précède est nommé, même
      // quand les deux autres suivent l'ordre.
      const troisieme = remplacer(remplacer(remplacer(canonique(), 6), 5), 2, [
        e('collisionsCumulees'), e('redondance'), e('animateursNonRencontres'),
      ]);
      assert.deepEqual(verifierPriorites(troisieme, mode), {
        faute: 'forme', critere: 'animateursNonRencontres', palier: 2,
      }, mode);
      assert.throws(
        () => compiler(inverses, () => true, mode),
        (erreur) => erreur instanceof RangeError && /"forme"/.test(erreur.message),
      );
    }
    // Sous places, où les tours hors objectif partagent un palier, un
    // raffinement rangé devant eux fait une faute de forme.
    const raffinementEnTete = remplacer(remplacer(canonique(), 6), 3, [e('redondance'), e('toursHorsObjectif', 2)]);
    assert.deepEqual(verifierPriorites(raffinementEnTete, 'places'), {
      faute: 'forme', critere: 'toursHorsObjectif', palier: 3,
    });
  });

  test("forme : une liste, un palier ou une entrée qui n'ont pas la forme attendue", () => {
    for (const mode of MODES_OBJECTIFS) {
      for (const liste of [undefined, null, 'ecart', {}, { length: 0 }]) {
        assert.deepEqual(verifierPriorites(liste, mode), { faute: 'forme' }, `${mode} ${String(liste)}`);
      }
      for (const palier of [null, e('redondance'), 'redondance']) {
        assert.deepEqual(verifierPriorites(remplacer(canonique(), 6, palier), mode), { faute: 'forme', palier: 6 });
      }
      const entrees = [
        null,
        'redondance',
        ['redondance', 1],
        { poids: 1 },
        { critere: 'collisionsCumulees' },
        { critere: 3, poids: 1 },
        Object.create({ critere: 'collisionsCumulees', poids: 1 }),
      ];
      for (const entree of entrees) {
        assert.deepEqual(verifierPriorites(remplacer(canonique(), 2, [entree]), mode), { faute: 'forme', palier: 2 });
      }
    }
  });

  test('palierVide : un palier sans critère', () => {
    for (const mode of MODES_OBJECTIFS) {
      const liste = [...canonique().slice(0, 3), [], ...canonique().slice(3)];
      assert.deepEqual(verifierPriorites(liste, mode), { faute: 'palierVide', palier: 3 });
    }
  });

  test("critereInconnu : un nom hors du registre, même hérité d'Object", () => {
    for (const mode of MODES_OBJECTIFS) {
      for (const nom of ['ecart', 'Redondance', '__proto__', 'constructor', 'hasOwnProperty', '']) {
        const liste = [...canonique(), [e(nom)]];
        assert.deepEqual(verifierPriorites(liste, mode), { faute: 'critereInconnu', critere: nom, palier: 8 });
      }
    }
  });

  test('critereRepete : un critère nommé deux fois, dans deux paliers ou dans le même', () => {
    for (const mode of MODES_OBJECTIFS) {
      assert.deepEqual(verifierPriorites([...canonique(), [e('redondance')]], mode), {
        faute: 'critereRepete', critere: 'redondance', palier: 8,
      });
      assert.deepEqual(verifierPriorites(remplacer(canonique(), 6, [e('redondance'), e('redondance', 2)]), mode), {
        faute: 'critereRepete', critere: 'redondance', palier: 6,
      });
    }
  });

  test("critereAbsent : la liste est complète ; le premier absent dans l'ordre du registre est nommé", () => {
    for (const mode of MODES_OBJECTIFS) {
      assert.deepEqual(verifierPriorites(remplacer(canonique(), 5), mode), {
        faute: 'critereAbsent', critere: 'animateursNonRencontres',
      });
      assert.deepEqual(verifierPriorites(remplacer(remplacer(canonique(), 5), 1), mode), {
        faute: 'critereAbsent', critere: 'excedentCollisions',
      });
      assert.deepEqual(verifierPriorites([], mode), { faute: 'critereAbsent', critere: 'ecartAuPlafondAPrioriMax' });
      assert.deepEqual(verifierPriorites(remplacer(canonique(), 7), mode), {
        faute: 'critereAbsent', critere: 'conflitsOrganisation',
      });
    }
  });

  test("poids : hors de 1 à 100, non entier ou non nombre ; différent de 1 pour l'écart et les rencontres répétées", () => {
    for (const mode of MODES_OBJECTIFS) {
      for (const poids of [0, -1, 101, 1.5, Number.NaN, Infinity, '2', null, undefined]) {
        assert.deepEqual(verifierPriorites(remplacer(canonique(), 6, [{ critere: 'redondance', poids }]), mode), {
          faute: 'poids', critere: 'redondance', palier: 6,
        }, `${mode} ${String(poids)}`);
      }
      for (const [rang, nom] of [[0, 'ecartAuPlafondAPrioriMax'], [4, 'rencontresRepetees'], [7, 'conflitsOrganisation']]) {
        assert.deepEqual(verifierPriorites(remplacer(canonique(), rang, [e(nom, 2)]), mode), {
          faute: 'poids', critere: nom, palier: rang,
        });
      }
      assert.equal(verifierPriorites(remplacer(canonique(), 6, [e('redondance', 100)]), mode), null);
    }
  });

  test('poids : les tours hors objectif seuls à leur palier au poids 1 sous chacun et minimum, de 1 à 100 sous places (A16, D8)', () => {
    for (const poids of [2, 7, 100]) {
      const liste = remplacer(canonique(), 3, [e('toursHorsObjectif', poids)]);
      assert.equal(verifierPriorites(liste, 'places'), null, String(poids));
      for (const mode of ['chacun', 'minimum']) {
        assert.deepEqual(verifierPriorites(liste, mode), {
          faute: 'poids', critere: 'toursHorsObjectif', palier: 3,
        }, `${mode} ${poids}`);
        assert.throws(() => compiler(liste, horsConflits, mode), (erreur) => erreur instanceof RangeError && /"poids"/.test(erreur.message));
      }
    }
  });

  test('un critère seul à son palier, joint et pondéré : le partage se juge avant le poids 1 et avant l’ordre, sous chaque mode', () => {
    for (const mode of MODES_OBJECTIFS) {
      // Rangé après l'excédent, contre l'ordre du tableau : le partage prime.
      const ecartJoint = remplacer(remplacer(canonique(), 1), 0, [e('excedentCollisions'), e('ecartAuPlafondAPrioriMax', 2)]);
      assert.deepEqual(verifierPriorites(ecartJoint, mode), {
        faute: 'seulASonPalier', critere: 'ecartAuPlafondAPrioriMax', palier: 0,
      }, mode);
      // Un poids hors du domaine se relève à la lecture de l'entrée, avant le
      // partage du palier.
      const horsDomaine = remplacer(remplacer(canonique(), 1), 0, [e('ecartAuPlafondAPrioriMax', 101), e('excedentCollisions')]);
      assert.deepEqual(verifierPriorites(horsDomaine, mode), {
        faute: 'poids', critere: 'ecartAuPlafondAPrioriMax', palier: 0,
      }, mode);
    }
    for (const mode of ['chacun', 'minimum']) {
      const toursJoints = remplacer(remplacer(canonique(), 3), 1, [e('excedentCollisions', 5), e('toursHorsObjectif', 9)]);
      assert.deepEqual(verifierPriorites(toursJoints, mode), {
        faute: 'seulASonPalier', critere: 'toursHorsObjectif', palier: 1,
      }, mode);
    }
  });

  test('seulASonPalier : écart ou rencontres répétées joints à un autre critère, sous chaque mode', () => {
    for (const mode of MODES_OBJECTIFS) {
      const ecartJoint = remplacer(remplacer(canonique(), 1), 0, [e('ecartAuPlafondAPrioriMax'), e('excedentCollisions')]);
      assert.deepEqual(verifierPriorites(ecartJoint, mode), {
        faute: 'seulASonPalier', critere: 'ecartAuPlafondAPrioriMax', palier: 0,
      });
      const repeteesJointes = remplacer(remplacer(canonique(), 6), 4, [e('rencontresRepetees'), e('redondance')]);
      assert.deepEqual(verifierPriorites(repeteesJointes, mode), {
        faute: 'seulASonPalier', critere: 'rencontresRepetees', palier: 4,
      });
      // Joint par un critère rangé avant lui dans le palier.
      const repeteesApres = remplacer(remplacer(canonique(), 4), 2, [e('collisionsCumulees'), e('rencontresRepetees')]);
      assert.deepEqual(verifierPriorites(repeteesApres, mode), {
        faute: 'seulASonPalier', critere: 'rencontresRepetees', palier: 2,
      });
      // Le conflit d'organisation joint à l'excédent, au poids 1 comme au
      // poids 5.
      for (const poids of [1, 5]) {
        const conflitsJoints = remplacer(remplacer(canonique(), 7), 1, [e('excedentCollisions'), e('conflitsOrganisation', poids)]);
        assert.deepEqual(verifierPriorites(conflitsJoints, mode), {
          faute: 'seulASonPalier', critere: 'conflitsOrganisation', palier: 1,
        });
      }
    }
  });

  test('seulASonPalier : tours hors objectif joints, refusés sous chacun et minimum, admis sous places (D23)', () => {
    const joints = remplacer(remplacer(canonique(), 3), 1, [e('excedentCollisions'), e('toursHorsObjectif', 2)]);
    const enTete = remplacer(remplacer(canonique(), 6), 3, [e('toursHorsObjectif', 2), e('redondance')]);
    assert.equal(verifierPriorites(joints, 'places'), null);
    assert.equal(verifierPriorites(enTete, 'places'), null);
    for (const mode of ['chacun', 'minimum']) {
      assert.deepEqual(verifierPriorites(joints, mode), { faute: 'seulASonPalier', critere: 'toursHorsObjectif', palier: 1 });
      assert.deepEqual(verifierPriorites(enTete, mode), { faute: 'seulASonPalier', critere: 'toursHorsObjectif', palier: 3 });
    }
  });

  test("la première faute dans l'ordre de la liste est rendue", () => {
    const liste = [[e('inconnu')], [], ...canonique()];
    assert.deepEqual(verifierPriorites(liste), { faute: 'critereInconnu', critere: 'inconnu', palier: 0 });
  });
});

describe('criteres : completerPriorites (A16)', () => {
  test('une liste complète se rend égale, en copie', () => {
    const liste = [[e('excedentCollisions', 4), e('collisionsCumulees', 3)], ...remplacer(remplacer(canonique(), 2), 1)];
    const complete = completerPriorites(liste);
    assert.deepEqual(complete, liste);
    assert.notEqual(complete, liste);
    assert.notEqual(complete[0], liste[0]);
    assert.notEqual(complete[0][0], liste[0][0]);
  });

  test("un critère absent prend sa place de l'ordre par défaut, seul à son palier, au poids 1", () => {
    const ancienne = [
      [e('excedentCollisions')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('collisionsCumulees', 2), e('redondance', 5)],
      [e('rencontresRepetees')],
    ];
    // Le conflit d'organisation, premier de l'ordre par défaut, se place en
    // tête ; les tours hors objectif suivent l'écart, qui les précède dans
    // l'ordre par défaut ; les animateurs suivent les tours hors objectif.
    assert.deepEqual(completerPriorites(Object.freeze(ancienne.map((p) => Object.freeze(p)))), [
      [e('conflitsOrganisation')],
      [e('excedentCollisions')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('toursHorsObjectif')],
      [e('animateursNonRencontres')],
      [e('collisionsCumulees', 2), e('redondance', 5)],
      [e('rencontresRepetees')],
    ]);
    assert.equal(verifierPriorites(completerPriorites(ancienne)), null);
  });

  test("le premier critère de l'ordre par défaut, absent, se place en tête ; une liste vide devient l'ordre par défaut", () => {
    assert.deepEqual(completerPriorites([[e('redondance')], [e('rencontresRepetees')]]), [
      [e('conflitsOrganisation')],
      [e('excedentCollisions')],
      [e('redondance')],
      [e('rencontresRepetees')],
      [e('collisionsCumulees')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('toursHorsObjectif')],
      [e('animateursNonRencontres')],
    ]);
    assert.deepEqual(completerPriorites([]), parDefaut());
  });
});

describe('criteres : valeursQuiClassent (D9, D20)', () => {
  test('les rencontres répétées sous les quatre combinaisons des deux cases de voisinage', () => {
    for (const nouveauxVoisins of [false, true]) {
      for (const nouvelleTable of [false, true]) {
        const c = { ...TOUTES_COCHEES, nouveauxVoisins, nouvelleTable };
        for (const mode of MODES_OBJECTIFS) {
          assert.deepEqual(
            valeursQuiClassent('rencontresRepetees', c, mode),
            nouveauxVoisins ? ['rencontresRepeteesChoisies'] : ['retoursChoisis'],
            `${nouveauxVoisins} ${nouvelleTable} ${mode}`,
          );
        }
      }
    }
  });

  test('les tours hors objectif selon le mode ; les autres critères, leur grandeur seule', () => {
    const autres = ['ecartAuPlafondAPrioriMax', 'excedentCollisions', 'collisionsCumulees', 'animateursNonRencontres', 'redondance'];
    for (const mode of MODES_OBJECTIFS) {
      assert.deepEqual(valeursQuiClassent('toursHorsObjectif', TOUTES_COCHEES, mode), VALEURS_DES_MODES[mode]);
      for (const nom of autres) assert.deepEqual(valeursQuiClassent(nom, TOUTES_COCHEES, mode), [nom]);
    }
    assert.deepEqual(valeursQuiClassent('toursHorsObjectif', TOUTES_COCHEES), ['toursHorsObjectif']);
  });

  test('la liste rendue est une copie : la modifier ne touche pas le registre', () => {
    const valeurs = valeursQuiClassent('toursHorsObjectif', TOUTES_COCHEES, 'chacun');
    valeurs.push('autre');
    assert.deepEqual(VALEURS_DES_MODES.chacun, ['jamaisServies', 'toursHorsObjectif']);
  });
});

describe("criteres : compiler, l'ordre par défaut sous les seize combinaisons des cases (D11)", () => {
  test("sous les seize combinaisons et chaque mode, composantes et ordres égalent [0..5] et [0..5] aux composantes retirées près ; l'écart suit les contraintes cochées", () => {
    for (let masque = 0; masque < 16; masque += 1) {
      const c = contraintesDu(masque);
      const retirees = retireesDuDefaut(c);
      const attendus = (ordre) => ordre.filter((k) => !retirees[k]).map((k) => COMPOSANTES_DU_DEFAUT[k]);
      for (const mode of MODES_OBJECTIFS) {
        const compilation = compiler(PRIORITES_PAR_DEFAUT, compteDesCases(c), mode);
        const { score, contraintes } = ordresNommes(compilation, mode);
        const message = `masque ${masque.toString(2).padStart(4, '0')}, ${mode}`;
        assert.deepEqual(score, attendus(SCORE_DU_DEFAUT), message);
        assert.deepEqual(contraintes, attendus(CONTRAINTES_DU_DEFAUT), message);
        assert.equal(compilation.taille, score.length, message);
        assert.deepEqual(compilation.ordreScore, [...Array(compilation.taille).keys()], message);
        assert.equal(compilation.rangEcart, retirees.slice(0, 3).filter((retiree) => !retiree).length, message);
      }
    }
  });

  test("sous les quatre cases cochées : cinq paliers d'un critère, de poids 1, dans l'ordre fixe de référence", () => {
    const { paliers, taille, rangEcart } = compiler(PRIORITES_PAR_DEFAUT, compteDesCases(TOUTES_COCHEES), 'places');
    assert.deepEqual(paliers, [
      { famille: 'contrainte', criteres: [{ nom: 'excedentCollisions', poids: 1 }], composantes: [0] },
      { famille: 'contrainte', criteres: [{ nom: 'rencontresRepetees', poids: 1 }], composantes: [1] },
      { famille: 'contrainte', criteres: [{ nom: 'collisionsCumulees', poids: 1 }], composantes: [2] },
      { famille: 'rencontres', criteres: [{ nom: 'ecartAuPlafondAPrioriMax', poids: 1 }], composantes: [3, 4] },
      { famille: 'raffinement', criteres: [{ nom: 'redondance', poids: 1 }], composantes: [5] },
    ]);
    assert.equal(taille, 6);
    assert.equal(rangEcart, 3);
  });

  test('sans objectif, les trois modes compilent la même chose, sous chaque combinaison des cases', () => {
    for (let masque = 0; masque < 16; masque += 1) {
      const compte = compteDesCases(contraintesDu(masque));
      const reference = compiler(PRIORITES_PAR_DEFAUT, compte, 'places');
      for (const mode of ['chacun', 'minimum']) assert.deepEqual(compiler(PRIORITES_PAR_DEFAUT, compte, mode), reference);
    }
  });
});

describe('criteres : compiler, les paliers et la bascule (A11, D15)', () => {
  test("l'écart déplacé en troisième : la bascule le range avant le premier palier raffinement qui le suit", () => {
    const liste = [
      [e('excedentCollisions')],
      [e('collisionsCumulees')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
      [e('redondance')],
      [e('conflitsOrganisation')],
    ];
    const compilation = compiler(liste, compteDesCases(TOUTES_COCHEES));
    assert.equal(compilation.rangEcart, 2);
    assert.deepEqual(ordresNommes(compilation), {
      score: ['excedentCollisions', 'collisionsCumulees', 'ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori', 'rencontresRepetees', 'redondance'],
      contraintes: ['excedentCollisions', 'collisionsCumulees', 'rencontresRepetees', 'ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori', 'redondance'],
    });
    assert.deepEqual(compilation.ordreContraintes, [0, 1, 4, 2, 3, 5]);
  });

  test("tours hors objectif avant l'écart : rangEcart est le rang de la composante du plus grand écart, non celui de son palier", () => {
    const liste = [
      [e('toursHorsObjectif')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions')],
      [e('collisionsCumulees')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
      [e('redondance')],
      [e('conflitsOrganisation')],
    ];
    const attendus = {
      places: { rangEcart: 1, ordreContraintes: [0, 3, 4, 5, 1, 2, 6, 7] },
      chacun: { rangEcart: 2, ordreContraintes: [0, 1, 4, 5, 6, 2, 3, 7, 8] },
      minimum: { rangEcart: 3, ordreContraintes: [0, 1, 2, 5, 6, 7, 3, 4, 8, 9] },
    };
    for (const mode of MODES_OBJECTIFS) {
      const { rangEcart, ordreContraintes, ordreScore, taille } = compiler(liste, horsConflits, mode);
      assert.deepEqual({ rangEcart, ordreContraintes }, attendus[mode], mode);
      assert.deepEqual(ordreScore, [...Array(taille).keys()], mode);
    }
    const compilation = compiler(liste, horsConflits, 'minimum');
    assert.deepEqual(ordresNommes(compilation, 'minimum').contraintes, [
      'horsObjectifMax', 'personnesAuMax', 'toursHorsObjectif',
      'excedentCollisions', 'collisionsCumulees', 'rencontresRepetees',
      'ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori',
      'animateursNonRencontres', 'redondance',
    ]);
  });

  test("l'écart en dernier : les deux ordres sont ceux du score", () => {
    const liste = [...canonique().slice(1), [e('ecartAuPlafondAPrioriMax')]];
    const compilation = compiler(liste, horsConflits);
    assert.equal(compilation.rangEcart, 6);
    assert.deepEqual(compilation.ordreContraintes, compilation.ordreScore);
  });

  test("aucun raffinement après l'écart : l'écart passe à la fin", () => {
    const liste = [
      [e('animateursNonRencontres')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions')],
      [e('collisionsCumulees'), e('redondance')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('conflitsOrganisation')],
    ];
    const compilation = compiler(liste, horsConflits);
    assert.deepEqual(
      compilation.paliers.map(({ famille }) => famille),
      ['raffinement', 'rencontres', 'contrainte', 'contrainte', 'contrainte', 'contrainte'],
    );
    assert.equal(compilation.rangEcart, 1);
    assert.deepEqual(compilation.ordreContraintes, [0, 3, 4, 5, 6, 1, 2]);
  });

  test('palier mixte { tours hors objectif × 2, redondance × 1 } : contrainte, une composante', () => {
    const liste = remplacer(remplacer(canonique(), 6), 3, [e('toursHorsObjectif', 2), e('redondance')]);
    const compilation = compiler(liste, horsConflits, 'places');
    assert.deepEqual(compilation.paliers[3], {
      famille: 'contrainte',
      criteres: [{ nom: 'toursHorsObjectif', poids: 2 }, { nom: 'redondance', poids: 1 }],
      composantes: [4],
    });
    assert.equal(compilation.taille, 7);
    // La bascule ne s'arrête pas au palier mixte : le premier raffinement
    // qui suit l'écart est celui des animateurs.
    assert.deepEqual(ordresNommes(compilation).contraintes.slice(2, 5), [
      'toursHorsObjectif+redondance',
      'rencontresRepetees',
      'ecartAuPlafondAPrioriMax',
    ]);
  });

  test("palier de deux raffinements : raffinement, une composante, où la bascule s'arrête", () => {
    const liste = remplacer(remplacer(canonique(), 6), 5, [e('animateursNonRencontres', 3), e('redondance', 2)]);
    const compilation = compiler(liste, horsConflits);
    assert.deepEqual(compilation.paliers.at(-1), {
      famille: 'raffinement',
      criteres: [{ nom: 'animateursNonRencontres', poids: 3 }, { nom: 'redondance', poids: 2 }],
      composantes: [6],
    });
    assert.deepEqual(compilation.ordreContraintes, [2, 3, 4, 5, 0, 1, 6]);
  });

  test("objectifs et animateurs comptés : un palier chacun, aux rangs de l'ordre par défaut", () => {
    const compilation = compiler(PRIORITES_PAR_DEFAUT, horsConflits, 'places');
    // L'écart annulé, les tours hors objectif, une contrainte, passent devant
    // lui : la bascule le range avant les animateurs.
    assert.deepEqual(ordresNommes(compilation), {
      score: [
        'excedentCollisions', 'rencontresRepetees', 'collisionsCumulees', 'ecartAuPlafondAPrioriMax',
        'carresEcartsAuPlafondAPriori', 'toursHorsObjectif', 'animateursNonRencontres', 'redondance',
      ],
      contraintes: [
        'excedentCollisions', 'rencontresRepetees', 'collisionsCumulees', 'toursHorsObjectif',
        'ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori', 'animateursNonRencontres', 'redondance',
      ],
    });
    assert.equal(compilation.taille, 8);
    assert.equal(compilation.rangEcart, 3);
  });

  test("l'écart seul monté en tête de l'ordre par défaut : la bascule rend les contraintes du défaut ; le registre les range autrement", () => {
    const ecartEnTete = [
      [e('ecartAuPlafondAPrioriMax')],
      ...PRIORITES_PAR_DEFAUT.filter(([{ critere }]) => critere !== 'ecartAuPlafondAPrioriMax'),
    ];
    const defaut = ordresNommes(compiler(PRIORITES_PAR_DEFAUT, horsConflits));
    const monte = ordresNommes(compiler(ecartEnTete, horsConflits));
    assert.notDeepEqual(monte.score, defaut.score);
    assert.deepEqual(monte.contraintes, defaut.contraintes);
    // Sous l'ordre du registre, les collisions et les tours hors objectif
    // passent devant les rencontres répétées après la bascule.
    assert.deepEqual(ordresNommes(compiler(canonique(), horsConflits)).contraintes, [
      'excedentCollisions', 'collisionsCumulees', 'toursHorsObjectif', 'rencontresRepetees',
      'ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori', 'animateursNonRencontres', 'redondance',
    ]);
  });

  test('un palier dont aucun critère ne compte disparaît ; un critère qui ne compte pas sort de son palier', () => {
    const liste = remplacer(remplacer(canonique(), 6), 5, [e('animateursNonRencontres', 3), e('redondance', 2)]);
    const compilation = compiler(liste, comptant('ecartAuPlafondAPrioriMax', 'collisionsCumulees', 'redondance'));
    assert.deepEqual(compilation.paliers, [
      { famille: 'rencontres', criteres: [{ nom: 'ecartAuPlafondAPrioriMax', poids: 1 }], composantes: [0, 1] },
      { famille: 'contrainte', criteres: [{ nom: 'collisionsCumulees', poids: 1 }], composantes: [2] },
      { famille: 'raffinement', criteres: [{ nom: 'redondance', poids: 2 }], composantes: [3] },
    ]);
    assert.deepEqual(compilation.ordreContraintes, [2, 0, 1, 3]);
  });

  test('un palier mixte dont seul le raffinement compte devient raffinement', () => {
    const liste = remplacer(remplacer(canonique(), 6), 3, [e('toursHorsObjectif', 2), e('redondance')]);
    const compilation = compiler(liste, (nom) => horsConflits(nom) && nom !== 'toursHorsObjectif');
    assert.deepEqual(compilation.paliers[3], {
      famille: 'raffinement', criteres: [{ nom: 'redondance', poids: 1 }], composantes: [4],
    });
    assert.deepEqual(compilation.ordreContraintes, [2, 3, 0, 1, 4, 5, 6]);
  });

  test("l'écart qui ne compte pas (plafond a priori inconnu) : aucune bascule, rangEcart nul", () => {
    const compilation = compiler(PRIORITES_PAR_DEFAUT, (nom) => horsConflits(nom) && nom !== 'ecartAuPlafondAPrioriMax');
    assert.equal(compilation.rangEcart, null);
    assert.deepEqual(compilation.ordreContraintes, compilation.ordreScore);
    // Deux listes distinctes : permuter l'une ne touche pas l'autre.
    assert.notEqual(compilation.ordreContraintes, compilation.ordreScore);
    assert.deepEqual(compilation.paliers.map(({ criteres: [{ nom }] }) => nom), [
      'excedentCollisions',
      'rencontresRepetees',
      'collisionsCumulees',
      'toursHorsObjectif',
      'animateursNonRencontres',
      'redondance',
    ]);
  });

  test("le conflit d'organisation qui compte : seul en tête du défaut, une composante, contrainte ; déplacé, il garde sa place", () => {
    const avecConflits = (nom) => nom === 'conflitsOrganisation' || compteDesCases(TOUTES_COCHEES)(nom);
    const compilation = compiler(PRIORITES_PAR_DEFAUT, avecConflits);
    assert.deepEqual(compilation.paliers[0], {
      famille: 'contrainte', criteres: [{ nom: 'conflitsOrganisation', poids: 1 }], composantes: [0],
    });
    assert.deepEqual(ordresNommes(compilation), {
      score: ['conflitsOrganisation', ...COMPOSANTES_DU_DEFAUT],
      contraintes: ['conflitsOrganisation', ...COMPOSANTES_DU_DEFAUT],
    });
    assert.equal(compilation.rangEcart, 4);
    // Rangé en dernier, après la redondance : le palier « raffinement » où
    // la bascule s'arrête le précède, et l'écart ne passe pas derrière lui.
    const enDernier = [...PRIORITES_PAR_DEFAUT.slice(1), [e('conflitsOrganisation')]];
    assert.equal(verifierPriorites(enDernier), null);
    assert.deepEqual(ordresNommes(compiler(enDernier, avecConflits)), {
      score: [...COMPOSANTES_DU_DEFAUT, 'conflitsOrganisation'],
      contraintes: [...COMPOSANTES_DU_DEFAUT, 'conflitsOrganisation'],
    });
    // Sans objet, il sort de la compilation, qui est celle de l'ordre fixe
    // de référence.
    assert.deepEqual(compiler(PRIORITES_PAR_DEFAUT, compteDesCases(TOUTES_COCHEES)).taille, COMPOSANTES_DU_DEFAUT.length);
  });

  test('aucun critère qui compte : un n-uplet vide', () => {
    assert.deepEqual(compiler(PRIORITES_PAR_DEFAUT, () => false, 'minimum'), {
      paliers: [], ordreScore: [], ordreContraintes: [], rangEcart: null, taille: 0,
    });
  });

  test('compte est lu une fois par critère, par son nom, dans l’ordre de la liste', () => {
    const lus = [];
    compiler(PRIORITES_PAR_DEFAUT, (nom) => { lus.push(nom); return true; });
    assert.deepEqual(lus, parDefaut().map(([{ critere }]) => critere));
  });

  test('une liste invalide lève RangeError, qui nomme la faute', () => {
    assert.throws(() => compiler([], () => true), (erreur) => erreur instanceof RangeError && /critereAbsent/.test(erreur.message));
    const joints = remplacer(remplacer(canonique(), 3), 1, [e('excedentCollisions'), e('toursHorsObjectif')]);
    assert.throws(() => compiler(joints, horsConflits, 'chacun'), (erreur) => erreur instanceof RangeError && /seulASonPalier/.test(erreur.message));
    assert.equal(compiler(joints, horsConflits, 'places').taille, 7);
  });
});

describe('criteres : compiler, les composantes des tours hors objectif selon le mode (D20)', () => {
  test('une, deux et trois composantes consécutives, dans leur palier ; la bascule les garde ensemble', () => {
    const attendues = {
      places: ['toursHorsObjectif'],
      chacun: ['jamaisServies', 'toursHorsObjectif'],
      minimum: ['horsObjectifMax', 'personnesAuMax', 'toursHorsObjectif'],
    };
    for (const mode of MODES_OBJECTIFS) {
      // Sous l'ordre par défaut, les tours hors objectif suivent l'écart, au
      // cinquième palier ; la bascule les passe devant lui.
      const compilation = compiler(PRIORITES_PAR_DEFAUT, horsConflits, mode);
      const largeur = attendues[mode].length;
      assert.deepEqual(compilation.paliers[4].composantes, [...Array(largeur).keys()].map((k) => 5 + k), mode);
      assert.equal(compilation.taille, 7 + largeur, mode);
      const { score, contraintes } = ordresNommes(compilation, mode);
      assert.deepEqual(score.slice(5, 5 + largeur), attendues[mode], mode);
      assert.deepEqual(contraintes.slice(3, 3 + largeur), attendues[mode], mode);
      assert.deepEqual(
        contraintes.slice(3 + largeur, 3 + largeur + 2),
        ['ecartAuPlafondAPrioriMax', 'carresEcartsAuPlafondAPriori'],
        mode,
      );
    }
  });

  test('aucune composante quand les tours hors objectif ne comptent pas, quel que soit le mode', () => {
    for (const mode of MODES_OBJECTIFS) {
      const compilation = compiler(PRIORITES_PAR_DEFAUT, (nom) => horsConflits(nom) && nom !== 'toursHorsObjectif', mode);
      assert.equal(compilation.taille, 7, mode);
      const noms = nomsDesComposantes(compilation, mode);
      assert.ok(!noms.some((nom) => COMPOSANTES_DES_MODES[mode].includes(nom)), mode);
    }
  });

  test('la taille ne dépasse pas onze, atteinte sous minimum avec tout compté, le conflit compris', () => {
    assert.equal(compiler(PRIORITES_PAR_DEFAUT, () => true, 'minimum').taille, 11);
    assert.equal(compiler(PRIORITES_PAR_DEFAUT, horsConflits, 'minimum').taille, 10);
  });
});

describe('criteres : la source du registre', () => {
  test("aucune Map, aucun parcours de clés d'objet, aucun code de faute en capitales", () => {
    const source = readFileSync(new URL('./criteres.js', import.meta.url), 'utf8');
    for (const motif of [/new Map\b/, /Object\.(keys|values|entries)\(/, /\bfor\s*\([^)]*\bin\b/, /faute: '[A-Z]/]) {
      assert.doesNotMatch(source, motif);
    }
  });
});

// L'état des critères que normaliser rendrait sous ces contraintes et ce
// mode : les tours hors objectif, les animateurs non rencontrés et le conflit
// d'organisation sont sans objet, sauf ceux que avecObjet nomme.
const etatSous = (contraintes, mode, ...avecObjet) => CRITERES.map((nom) => ({
  nom,
  coche: estCoche(nom, contraintes),
  sansObjet: ['toursHorsObjectif', 'animateursNonRencontres', 'conflitsOrganisation'].includes(nom) && !avecObjet.includes(nom),
  valeurs: valeursQuiClassent(nom, contraintes, mode),
}));

describe('criteres : compilationDe, la compilation d’une instance (D10, contrat du classement)', () => {
  test('un critère compte quand il est coché et a un objet ; chacun porte ses valeurs qui classent', () => {
    const compilation = compilationDe({
      priorites: PRIORITES_PAR_DEFAUT,
      etatCriteres: etatSous(TOUTES_COCHEES, 'places'),
      modeObjectifs: 'places',
    });
    assert.deepEqual(compilation.paliers.map(({ criteres }) => criteres), [
      [{ nom: 'excedentCollisions', poids: 1, valeurs: ['excedentCollisions'] }],
      [{ nom: 'rencontresRepetees', poids: 1, valeurs: ['rencontresRepeteesChoisies'] }],
      [{ nom: 'collisionsCumulees', poids: 1, valeurs: ['collisionsCumulees'] }],
      [{ nom: 'ecartAuPlafondAPrioriMax', poids: 1, valeurs: ['ecartAuPlafondAPrioriMax'] }],
      [{ nom: 'redondance', poids: 1, valeurs: ['redondance'] }],
    ]);
    const { paliers, ...reste } = compiler(PRIORITES_PAR_DEFAUT, compteDesCases(TOUTES_COCHEES), 'places');
    assert.deepEqual({ ...compilation, paliers: undefined }, { ...reste, paliers: undefined });
  });

  test('sous chacun, les objectifs ayant un objet : un palier de deux valeurs, « nouvelle table » seule fait classer les retours', () => {
    const contraintes = { ...contraintesDu(0b0100), respecterObjectifs: true };
    const compilation = compilationDe({
      priorites: PRIORITES_PAR_DEFAUT,
      etatCriteres: etatSous(contraintes, 'chacun', 'toursHorsObjectif'),
      modeObjectifs: 'chacun',
    });
    assert.deepEqual(compilation.paliers.map(({ criteres }) => criteres.map(({ nom, valeurs }) => [nom, valeurs])), [
      [['rencontresRepetees', ['retoursChoisis']]],
      [['ecartAuPlafondAPrioriMax', ['ecartAuPlafondAPrioriMax']]],
      [['toursHorsObjectif', ['jamaisServies', 'toursHorsObjectif']]],
    ]);
    assert.equal(compilation.taille, 5);
  });

  test('un critère décoché ne compte pas, même avec un objet ; un critère sans objet non plus, même coché', () => {
    const decoche = compilationDe({
      priorites: PRIORITES_PAR_DEFAUT,
      etatCriteres: etatSous({ ...TOUTES_COCHEES, respecterObjectifs: false }, 'places', 'toursHorsObjectif', 'animateursNonRencontres'),
      modeObjectifs: 'places',
    });
    const sansObjet = compilationDe({
      priorites: PRIORITES_PAR_DEFAUT,
      etatCriteres: etatSous({ ...TOUTES_COCHEES, rencontrerAnimateurs: true }, 'places'),
      modeObjectifs: 'places',
    });
    for (const compilation of [decoche, sansObjet]) {
      const noms = compilation.paliers.flatMap(({ criteres }) => criteres.map(({ nom }) => nom));
      assert.deepEqual(noms, ['excedentCollisions', 'rencontresRepetees', 'collisionsCumulees', 'ecartAuPlafondAPrioriMax', 'redondance']);
    }
  });

  test('un état des critères trop court ou hors de l’ordre du registre lève RangeError', () => {
    const etat = etatSous(TOUTES_COCHEES, 'places');
    const [premier, second, ...suite] = etat;
    for (const etatCriteres of [etat.slice(0, -1), [second, premier, ...suite]]) {
      assert.throws(() => compilationDe({ priorites: PRIORITES_PAR_DEFAUT, etatCriteres, modeObjectifs: 'places' }), RangeError);
    }
  });
});

// Les modules JavaScript et les composants de src/, hors épreuves, chemins
// relatifs à src/, dans l'ordre alphabétique. Lisant les composants par le
// disque, cette épreuve se relance à chaque composant changé
// (RELANCES_D_UN_COMPOSANT, vitest.config.js).
function sourcesDeSrc() {
  const racine = new URL('../', import.meta.url);
  return readdirSync(racine, { recursive: true })
    .map((chemin) => String(chemin).split('\\').join('/'))
    .filter((chemin) => /\.(js|svelte)$/.test(chemin) && !/\.test\.js$/.test(chemin))
    .sort();
}

// Ce que la garde relève dans un texte source : chaque suite de deux noms
// de critères distincts, écrits en chaînes littérales et séparés par une
// seule virgule — le début d'une liste littérale —, et chaque constante
// ORDRE_ déclarée sur une liste littérale de rangs, un ordre de comparaison
// des composantes écrit en dur. Une constante ORDRE_ d'une autre nature —
// l'ordre des simulations de la palette — ne compare aucun critère.
function relevesDeLaGarde(source) {
  const noms = CRITERES.join('|');
  const liste = new RegExp(`(['"\`])(${noms})\\1\\s*,\\s*(['"\`])(?!\\2\\3)(${noms})\\3`, 'g');
  return [
    ...[...source.matchAll(liste)].map((trouve) => trouve[0]),
    ...[...source.matchAll(/\b(?:const|let|var)\s+(ORDRE_[A-Z_]*)\s*=\s*(?:Object\.freeze\(\s*)?\[\s*\d/g)].map((trouve) => trouve[1]),
  ];
}

describe('criteres : la garde de la contrainte 35 (registre unique)', () => {
  test('la garde relève une liste littérale de noms et une constante ORDRE_, sur des sources inventées', () => {
    assert.deepEqual(relevesDeLaGarde("const X = ['excedentCollisions', 'redondance'];"), ["'excedentCollisions', 'redondance'"]);
    assert.deepEqual(relevesDeLaGarde('const ORDRE_SCORE = Object.freeze([0, 1]);'), ['ORDRE_SCORE']);
    assert.deepEqual(relevesDeLaGarde('const ORDRE_CONTRAINTES = [2, 3, 4, 0, 1, 5];'), ['ORDRE_CONTRAINTES']);
    assert.deepEqual(relevesDeLaGarde("const ORDRE_TEINTES = ['rouge', 'vert'];"), []);
    assert.equal(relevesDeLaGarde('export const CRITERES = Object.freeze([\n  "ecartAuPlafondAPrioriMax",\n  "toursHorsObjectif",\n]);').length, 1);
    // Un nom seul, une clé de libellé ou une paire nom → même nom ne font pas
    // une liste.
    assert.deepEqual(relevesDeLaGarde("['redondance', 'totalRedondance'], ['moteur.critere.redondance', 'x']"), []);
    assert.deepEqual(relevesDeLaGarde("['excedentCollisions', 'excedentCollisions']"), []);
  });

  test('hors de criteres.js, aucun module de src/ ne porte une liste littérale des noms de critères ni une constante ORDRE_', () => {
    const sources = sourcesDeSrc();
    assert.ok(sources.includes('moteur/recherche.js') && sources.includes('moteur/classement.js'));
    assert.ok(sources.includes('interface/propositions/SectionPropositions.svelte'));
    const releves = sources
      .filter((chemin) => chemin !== 'moteur/criteres.js')
      .flatMap((chemin) => relevesDeLaGarde(readFileSync(new URL(`../${chemin}`, import.meta.url), 'utf8')).map((r) => `${chemin} : ${r}`));
    assert.deepEqual(releves, []);
    // Le registre, lui, en porte : la garde le lirait si elle ne l'écartait.
    assert.ok(relevesDeLaGarde(readFileSync(new URL('./criteres.js', import.meta.url), 'utf8')).length > 0);
  });
});
