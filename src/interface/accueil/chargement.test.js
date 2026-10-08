// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le pas du chargement des résumés de la liste (§ 8.1, § 19.4) : le premier
// attend une image, puis la minuterie de l'horloge ; les suivants, la seule
// minuterie. L'horloge pilotée et une demande d'image d'épreuve tiennent
// chaque attente : rien n'avance seul.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { creerPas } from './chargement.js';

// setImmediate rappelle une fois vidées les microtâches : une promesse
// résolue a rappelé ses suites.
const laisser = () => new Promise((resolve) => setImmediate(resolve));

// Une demande d'image d'épreuve : chaque rappel attend peindre().
function creerImages() {
  const enAttente = [];
  return {
    demander: (rappel) => {
      enAttente.push(rappel);
    },
    get demandes() {
      return enAttente.length;
    },
    peindre() {
      for (const rappel of enAttente.splice(0)) rappel();
    },
  };
}

// Suit une promesse : vrai une fois résolue.
function suivre(promesse) {
  const suivi = { resolue: false };
  promesse.then(() => {
    suivi.resolue = true;
  });
  return suivi;
}

describe('creerPas : le pas du chargement des résumés (§ 8.1)', () => {
  test('le premier pas attend une image, puis la minuterie : ni l’une ni l’autre seule ne le libère', async () => {
    const horloge = creerHorlogePilotee();
    const images = creerImages();
    const pas = creerPas(horloge, images.demander);
    const premier = suivre(pas());
    assert.equal(images.demandes, 1);
    horloge.avancer(0);
    await laisser();
    assert.equal(premier.resolue, false, 'la minuterie ne part qu’après l’image');
    images.peindre();
    await laisser();
    assert.equal(premier.resolue, false, 'l’image seule ne libère pas le pas');
    horloge.avancer(0);
    await laisser();
    assert.equal(premier.resolue, true);
  });

  test('les pas suivants n’attendent que la minuterie, sans demander d’image', async () => {
    const horloge = creerHorlogePilotee();
    const images = creerImages();
    const pas = creerPas(horloge, images.demander);
    const premier = suivre(pas());
    images.peindre();
    horloge.avancer(0);
    await laisser();
    assert.equal(premier.resolue, true);
    for (let rang = 2; rang <= 3; rang += 1) {
      const suivant = suivre(pas());
      await laisser();
      assert.equal(suivant.resolue, false, `pas ${rang} avant la minuterie`);
      horloge.avancer(0);
      await laisser();
      assert.equal(suivant.resolue, true, `pas ${rang}`);
    }
    assert.equal(images.demandes, 0);
  });

  test('deux pas créés séparément ont chacun leur premier pas', () => {
    const horloge = creerHorlogePilotee();
    const images = creerImages();
    creerPas(horloge, images.demander)();
    creerPas(horloge, images.demander)();
    assert.equal(images.demandes, 2);
  });
});
