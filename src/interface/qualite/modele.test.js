// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle de la page de qualité (§ 12.9, D27, D40) : le détail
// d'un placement, gardé par charge puis par identifiant, tant que la charge
// ne change pas ; une charge changée a le sien, mesuré à sa première
// demande ; la séance fournit la course et la génération. Les noms
// d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { rechercher } from '../../moteur/recherche.js';
import { avecCourses, courseDe } from '../../stockage/courses.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { detailDe } from './modele.js';

const V1 = VERSION.affichee;

// Six personnes inventées, deux appartenances, deux tables de trois places,
// deux tours, sans proposition ni retenu.
function chargeSix() {
  const charge = creerCharge({ id: 'evt-modele-qualite', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
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

// Fige une valeur et tout ce qu'elle atteint, comme la séance fige la
// charge de son état observable.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    for (const element of Object.values(valeur)) figer(element);
    Object.freeze(valeur);
  }
  return valeur;
}

// Vrai quand chaque objet atteint depuis la valeur est figé.
const figeePartout = (valeur) =>
  valeur === null || typeof valeur !== 'object' || (Object.isFrozen(valeur) && Object.values(valeur).every(figeePartout));

// La charge figée d'une génération, et la lecture de ses courses telle que
// la séance la fait.
function generee(charge = chargeSix()) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 3, nombre: 2, arret: 200 });
  const rendu = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 });
  return { charge: figer(rendu.charge), courses: avecCourses(new Map(), rendu.courses) };
}

// La séance d'épreuve : courseDe et generationDe, qui comptent leurs appels.
function seanceSur(charge, courses, resume = { dureeMs: 4000, coeurs: 2, evalues: 6000, nombre: 2 }) {
  const appels = { course: [], generation: [] };
  return {
    appels,
    options: {
      courseDe: (id) => {
        appels.course.push(id);
        return courseDe({ charge, courses }, id);
      },
      generationDe: (id) => {
        appels.generation.push(id);
        return resume;
      },
    },
  };
}

describe('qualite/modele : le détail gardé par charge et par identifiant (§ 12.9, D27, D40)', () => {
  test('une charge figée : le même détail, figé, à chaque demande, mesuré une fois ; la course et la génération de la séance passées', () => {
    const { charge, courses } = generee();
    const { appels, options } = seanceSur(charge, courses);
    const detail = detailDe(charge, 1, options);
    assert.equal(detailDe(charge, 1, options), detail);
    assert.ok(figeePartout(detail));
    assert.deepEqual(appels, { course: [1], generation: [1] });
    assert.deepEqual(detail.course.generation, { dureeMs: 4000, coeurs: 2, cadence: 1500, nombre: 2 });
    assert.deepEqual(detail, detaillerQualite(charge, 1, options));
  });

  test('chaque identifiant a son détail : une proposition, une autre, le retenu', () => {
    const { charge, courses } = generee();
    const retenue = figer(appliquerCommande('retenirProposition', charge, { id: 2 }).charge);
    const { options } = seanceSur(retenue, courses);
    const [un, deux, retenu] = [1, 2, 'retenu'].map((id) => detailDe(retenue, id, options));
    assert.deepEqual([un.id, deux.id, retenu.id], [1, 2, 'retenu']);
    assert.notEqual(un, deux);
    assert.equal(retenu.propositionDuRetenu, 2);
    assert.equal(detailDe(retenue, 'retenu', options), retenu);
    assert.equal(detailDe(retenue, 99, options), null);
  });

  test("une charge changée — l'ordre des priorités — a son propre détail, remesuré ; jamais celui de l'ancienne charge", () => {
    const { charge, courses } = generee();
    const avant = detailDe(charge, 1, seanceSur(charge, courses).options);
    const paliers = [
      [{ critere: 'ecartAuPlafondAPrioriMax', poids: 1 }],
      [{ critere: 'redondance', poids: 1 }],
      [{ critere: 'excedentCollisions', poids: 1 }],
      [{ critere: 'collisionsCumulees', poids: 1 }],
      [{ critere: 'toursHorsObjectif', poids: 1 }],
      [{ critere: 'rencontresRepetees', poids: 1 }],
      [{ critere: 'animateursNonRencontres', poids: 1 }],
    ];
    const reglee = figer(appliquerCommande('changerPriorites', charge, { paliers }).charge);
    const { appels, options } = seanceSur(reglee, courses);
    const apres = detailDe(reglee, 1, options);
    assert.notEqual(apres, avant);
    assert.deepEqual(appels.course, [1]);
    assert.deepEqual(apres, detaillerQualite(reglee, 1, options));
    assert.notDeepEqual(apres.course.indicateurs, avant.course.indicateurs);
    assert.equal(apres.course.indicateurs[1], 'ecartAuPlafondAPrioriMax');
    assert.equal(apres.course.indicateurs[2], 'redondance');
    assert.equal(detailDe(charge, 1, seanceSur(charge, courses).options), avant);
  });

  test("une charge qui n'est pas figée partout se mesure à chaque demande", () => {
    const { charge, courses } = generee();
    const libre = structuredClone(charge);
    const { appels, options } = seanceSur(libre, courses);
    const premier = detailDe(libre, 1, options);
    const second = detailDe(libre, 1, options);
    assert.notEqual(premier, second);
    assert.deepEqual(premier, second);
    assert.deepEqual(appels.generation, [1, 1]);
  });

  test('sans séance : ni course ni génération', () => {
    const { charge } = generee();
    const detail = detailDe(charge, 2);
    assert.equal(detail.course, null);
    assert.equal(detail.statut, 'comparable');
  });
});
