// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'en-tête de la liste des participants : la ligne de comptes de la carte
// et la légende des appartenances, chacune lue sur la liste entière, exclues
// comprises, et le texte que les libellés en composent. Les noms d'épreuve
// sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { RANGS_APPARTENANCE, teintesAppartenances } from '../appartenances.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { comptesEntete, legendeAppartenances } from './entete.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const personne = (id, appartenance, exclu = false) => ({
  id,
  nom: `Brumaille${id}`,
  prenom: null,
  appartenance,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu,
});

// Trois appartenances, dont une portée par une exclue seule, et une
// personne sans appartenance.
const LISTE = [
  personne(1, 'Cercle des Grives'),
  personne(2, 'Atelier Pivoine'),
  personne(3, 'Cercle des Grives', true),
  personne(4, null),
  personne(5, 'Cercle des Grives'),
  personne(6, 'Banc des Loutres', true),
];

describe('comptesEntete : la ligne de comptes de la carte des participants', () => {
  test('personnes, à placer, exclues et appartenances distinctes, exclues comprises', () => {
    assert.deepEqual(comptesEntete(LISTE), { personnes: 6, aPlacer: 4, exclues: 2, appartenances: 3 });
  });

  test('une liste vide : quatre zéros', () => {
    assert.deepEqual(comptesEntete([]), { personnes: 0, aPlacer: 0, exclues: 0, appartenances: 0 });
  });

  test('deux orthographes sont deux appartenances, comme pour le moteur et les teintes', () => {
    const liste = [personne(1, 'Cercle des Grives'), personne(2, 'cercle des grives')];
    assert.equal(comptesEntete(liste).appartenances, 2);
    assert.equal(comptesEntete(liste).appartenances, teintesAppartenances(liste).size);
  });

  test('le libellé compose la ligne, accordée au nombre', () => {
    assert.equal(
      t('participants.entete.comptes', { personnes: 13, aPlacer: 12, exclues: 1, appartenances: 3 }),
      '13 personnes \u{00B7} 12 à placer \u{00B7} 1 exclue \u{00B7} 3 appartenances',
    );
    assert.equal(
      t('participants.entete.comptes', { personnes: 1, aPlacer: 0, exclues: 2, appartenances: 1 }),
      '1 personne \u{00B7} 0 à placer \u{00B7} 2 exclues \u{00B7} 1 appartenance',
    );
    assert.equal(
      t('participants.entete.comptes', { personnes: 0, aPlacer: 0, exclues: 0, appartenances: 0 }),
      '0 personne \u{00B7} 0 à placer \u{00B7} 0 exclue \u{00B7} 0 appartenance',
    );
  });
});

describe('legendeAppartenances : la légende en pastilles, avec leur compte', () => {
  test('dans l’ordre des teintes, chaque appartenance avec son rang et le nombre de personnes qui la portent, exclues comprises', () => {
    assert.deepEqual(legendeAppartenances(LISTE, teintesAppartenances(LISTE)), [
      { nom: 'Atelier Pivoine', rang: 1, compte: 1 },
      { nom: 'Banc des Loutres', rang: 2, compte: 1 },
      { nom: 'Cercle des Grives', rang: 3, compte: 3 },
    ]);
  });

  test('au-delà des rangs de la palette, le rang est null : la pastille est neutre, le compte reste', () => {
    const liste = Array.from({ length: RANGS_APPARTENANCE + 2 }, (_, i) => personne(i + 1, `Guilde ${String.fromCodePoint(65 + i)}`));
    liste.push(personne(99, 'Guilde A'));
    const legende = legendeAppartenances(liste, teintesAppartenances(liste));
    assert.equal(legende.length, RANGS_APPARTENANCE + 2);
    assert.deepEqual(legende[0], { nom: 'Guilde A', rang: 1, compte: 2 });
    assert.deepEqual(
      legende.map(({ rang }) => rang),
      [...Array.from({ length: RANGS_APPARTENANCE }, (_, i) => i + 1), null, null],
    );
  });

  test('sans appartenance portée, une légende vide ; une personne sans appartenance n’y entre pas', () => {
    const liste = [personne(1, null), personne(2, null, true)];
    assert.deepEqual(legendeAppartenances(liste, teintesAppartenances(liste)), []);
  });

  test('les rangs sont ceux des teintes reçues, jamais recalculés sur une liste filtrée', () => {
    const teintes = teintesAppartenances(LISTE);
    const filtree = LISTE.filter(({ appartenance }) => appartenance === 'Cercle des Grives');
    assert.deepEqual(legendeAppartenances(filtree, teintes), [{ nom: 'Cercle des Grives', rang: 3, compte: 3 }]);
  });

  test('le libellé d’un élément : le nom, puis le compte', () => {
    assert.equal(t('participants.legende.element', { nom: 'Atelier Pivoine', compte: 4 }), 'Atelier Pivoine \u{00B7} 4');
    assert.equal(t('participants.legende.titre'), 'Appartenances');
  });
});
