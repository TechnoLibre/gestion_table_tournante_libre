// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle pur de la saisie de la présence par tour (participants/presence.js) :
// la saisie canonique d'une liste de tours, sa lecture sous R tours,
// l'aller-retour exhaustif de R = 1 à 6, les cases d'un éditeur et leur
// bascule, l'affichage d'une présence, sa clé de tri et de groupement, la
// case voisine au clavier, la commande d'une cellule, et la machine de
// champ.js qui reconnaît « rien de changé » à l'égalité de deux saisies.
// Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { creerMachineChamp } from '../primitives/champ.js';
import {
  affichagePresence,
  affichagesPresence,
  casesDeSaisie,
  caseSuivante,
  clePresence,
  lecturePresence,
  saisieApresBascule,
  saisieDeTours,
  saisieEnregistree,
  saisiePleine,
} from './presence.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Les parties de 1..R, chacune en liste croissante, de la vide à la pleine.
function parties(R) {
  return Array.from({ length: 2 ** R }, (_, masque) => Array.from({ length: R }, (_, i) => i + 1).filter((tour) => masque & (1 << (tour - 1))));
}

describe('saisieDeTours : la saisie canonique d’une liste de tours', () => {
  test('croissante, sans doublon, jointe par « , » ; vide pour aucun tour', () => {
    assert.equal(saisieDeTours([3, 1, 2]), '1,2,3');
    assert.equal(saisieDeTours([2, 2, 4, 2]), '2,4');
    assert.equal(saisieDeTours([]), '');
    assert.equal(saisieDeTours([10, 9]), '9,10');
  });

  test('deux ensembles égaux donnent la même saisie, et la liste reçue n’est pas touchée', () => {
    const recue = [4, 1, 4];
    assert.equal(saisieDeTours(recue), saisieDeTours([1, 4]));
    assert.deepEqual(recue, [4, 1, 4]);
  });
});

describe('lecturePresence : la lecture d’une saisie sous R tours', () => {
  test('pleine : null, le champ se retire ; partielle : la liste ; vide : [], que la commande refuse', () => {
    const lire = lecturePresence(4);
    assert.deepEqual(lire('1,2,3,4'), { valeur: null });
    assert.deepEqual(lire('1,3'), { valeur: [1, 3] });
    assert.deepEqual(lire('4'), { valeur: [4] });
    assert.deepEqual(lire(''), { valeur: [] });
  });

  test('R = 1 : le seul tour est la soirée entière', () => {
    assert.deepEqual(lecturePresence(1)('1'), { valeur: null });
    assert.deepEqual(lecturePresence(1)(''), { valeur: [] });
  });

  test('ne refuse jamais : aucune lecture ne porte de refus', () => {
    for (const texte of ['', '1', '2,3', '1,2,3']) assert.ok(!Object.hasOwn(lecturePresence(3)(texte), 'refus'), texte);
  });

  test('l’aller-retour exhaustif, R de 1 à 6 : chaque partie de 1..R se relit elle-même, la pleine en null', () => {
    for (let R = 1; R <= 6; R += 1) {
      const lire = lecturePresence(R);
      const toutes = parties(R);
      assert.equal(toutes.length, 2 ** R);
      for (const partie of toutes) {
        const attendue = partie.length === R ? null : partie;
        assert.deepEqual(lire(saisieDeTours(partie)), { valeur: attendue }, `R = ${R}, ${JSON.stringify(partie)}`);
      }
      // Deux parties distinctes ont deux saisies distinctes.
      assert.equal(new Set(toutes.map(saisieDeTours)).size, toutes.length, `R = ${R}`);
    }
  });
});

describe('les cases d’un éditeur et leur bascule', () => {
  test('casesDeSaisie : une case par tour de 1 à R, cochée quand le tour est dans la saisie ; une liste neuve', () => {
    assert.deepEqual(casesDeSaisie('1,3', 4), [
      { tour: 1, coche: true },
      { tour: 2, coche: false },
      { tour: 3, coche: true },
      { tour: 4, coche: false },
    ]);
    assert.deepEqual(casesDeSaisie('', 2), [
      { tour: 1, coche: false },
      { tour: 2, coche: false },
    ]);
    assert.notEqual(casesDeSaisie('1', 1), casesDeSaisie('1', 1));
  });

  test('saisieApresBascule : cocher ajoute le tour à sa place, décocher le retire ; rebasculer rend la saisie d’avant', () => {
    assert.equal(saisieApresBascule('1,3', 2, true), '1,2,3');
    assert.equal(saisieApresBascule('1,3', 3, false), '1');
    assert.equal(saisieApresBascule('1', 1, false), '');
    assert.equal(saisieApresBascule('', 4, true), '4');
    // Cocher un tour déjà coché, décocher un tour qui ne l'est pas : rien ne change.
    assert.equal(saisieApresBascule('1,3', 3, true), '1,3');
    assert.equal(saisieApresBascule('1,3', 2, false), '1,3');
    assert.equal(saisieApresBascule(saisieApresBascule('2,4', 3, true), 3, false), '2,4');
    assert.equal(saisieApresBascule(saisieApresBascule('2,4', 4, false), 4, true), '2,4');
  });

  test('saisiePleine : chaque tour coché', () => {
    assert.equal(saisiePleine(1), '1');
    assert.equal(saisiePleine(4), '1,2,3,4');
    assert.deepEqual(lecturePresence(4)(saisiePleine(4)), { valeur: null });
  });

  test('saisieEnregistree : la présence de la personne, chaque tour pour un champ absent', () => {
    assert.equal(saisieEnregistree({ id: 1, nom: 'Brumaille' }, 3), '1,2,3');
    assert.equal(saisieEnregistree({ id: 2, nom: 'Vergeot', presence: [2, 3] }, 3), '2,3');
    assert.equal(saisieEnregistree({ id: 3, nom: 'Sorbelle', presence: [1], exclu: true }, 2), '1');
  });
});

describe('affichagePresence et clePresence : la cellule, le groupe et le tri', () => {
  test('null : « tous », sans détails ; une liste : ses tours nommés, sorte partielle', () => {
    assert.deepEqual(affichagePresence(null), { cle: 'participants.presence.tous', details: {}, sorte: 'tous' });
    assert.deepEqual(affichagePresence([1, 2, 3, 5]), { cle: 'participants.presence.tours', details: { tours: [1, 2, 3, 5] }, sorte: 'partielle' });
    assert.equal(t('participants.presence.tous'), 'tous');
    const { cle, details } = affichagePresence([1, 2, 3, 5]);
    assert.equal(t(cle, details), 'tours 1 à 3 et 5');
    assert.equal(t('participants.presence.tours', { tours: [2] }), 'tour 2');
  });

  test('les détails ne partagent rien avec la liste reçue', () => {
    const presence = [1, 3];
    const { details } = affichagePresence(presence);
    details.tours.push(4);
    assert.deepEqual(presence, [1, 3]);
  });

  test('affichagesPresence : l’affichage de chaque personne, par identifiant', () => {
    const vues = affichagesPresence([
      { id: 4, nom: 'Brumaille' },
      { id: 9, nom: 'Vergeot', presence: [2] },
    ]);
    assert.deepEqual([...vues.keys()], [4, 9]);
    assert.equal(vues.get(4).sorte, 'tous');
    assert.deepEqual(vues.get(9), affichagePresence([2]));
  });

  test('clePresence : « » pour tous, sinon chaque tour sur trois chiffres ; l’ordre est total, « tous » en tête, [1,2] < [1,3] < [2]', () => {
    assert.equal(clePresence(null), '');
    assert.equal(clePresence([1, 12]), '001,012');
    const ordre = [null, [1], [1, 2], [1, 2, 4], [1, 3], [2], [2, 3], [10]].map(clePresence);
    assert.deepEqual([...ordre].sort(), ordre);
    assert.equal(new Set(ordre).size, ordre.length);
    // Sur trois chiffres : le tour 10 vient après le tour 9, non avant le 2.
    assert.ok(clePresence([9]) < clePresence([10]));
    assert.ok(clePresence([2]) < clePresence([10]));
  });
});

describe('caseSuivante : la case voisine selon l’effet du contexte « cases »', () => {
  test('précédente et suivante restent sur place au bord ; première et dernière vont aux bouts', () => {
    assert.equal(caseSuivante(2, 'precedente', 4), 1);
    assert.equal(caseSuivante(1, 'precedente', 4), 1);
    assert.equal(caseSuivante(3, 'suivante', 4), 4);
    assert.equal(caseSuivante(4, 'suivante', 4), 4);
    assert.equal(caseSuivante(3, 'premiere', 4), 1);
    assert.equal(caseSuivante(2, 'derniere', 4), 4);
    assert.equal(caseSuivante(1, 'suivante', 1), 1);
  });

  test('un autre effet, ou aucun : null', () => {
    assert.equal(caseSuivante(2, null, 4), null);
    assert.equal(caseSuivante(2, 'valider', 4), null);
    assert.equal(caseSuivante(2, 'haut', 4), null);
  });
});

describe('la machine de champ.js, sur la lecture de la présence', () => {
  const machine = (presence, R) => creerMachineChamp({ stockee: saisieEnregistree({ id: 1, nom: 'Brumaille', presence }, R), lire: lecturePresence(R) });

  test('cocher puis décocher le même tour, puis valider : aucune', () => {
    const m = machine([1, 2], 4);
    m.saisir(saisieApresBascule(m.saisie, 3, true));
    m.saisir(saisieApresBascule(m.saisie, 3, false));
    assert.equal(m.enCours, true);
    assert.deepEqual(m.valider(), { action: 'aucune' });
    assert.equal(m.saisie, '1,2');
  });

  test('décocher puis recocher, sous une présence pleine : aucune', () => {
    const m = machine(undefined, 3);
    m.saisir(saisieApresBascule(m.saisie, 2, false));
    m.saisir(saisieApresBascule(m.saisie, 2, true));
    assert.deepEqual(m.valider(), { action: 'aucune' });
  });

  test('une saisie changée exécute sa valeur : la liste, null pour tous, [] pour aucun', () => {
    const partielle = machine(undefined, 3);
    partielle.saisir(saisieApresBascule(partielle.saisie, 3, false));
    assert.deepEqual(partielle.valider(), { action: 'executer', valeur: [1, 2] });
    const pleine = machine([2], 3);
    pleine.saisir(saisiePleine(3));
    assert.deepEqual(pleine.valider(), { action: 'executer', valeur: null });
    const vide = machine([2], 3);
    vide.saisir(saisieApresBascule(vide.saisie, 2, false));
    assert.deepEqual(vide.valider(), { action: 'executer', valeur: [] });
  });
});
