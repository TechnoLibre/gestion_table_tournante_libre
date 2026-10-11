// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'en-tête de la liste des participants : la ligne de comptes de la carte,
// la légende des appartenances et celle des étiquettes, chacune lue sur la
// liste entière, exclues comprises, et le texte que les libellés en
// composent. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { RANGS_APPARTENANCE, teintesAppartenances } from '../appartenances.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { comptesEntete, legendeAppartenances, legendeEtiquettes } from './entete.js';

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

// Une personne qui porte des étiquettes ; sans liste, le champ est absent,
// comme dans la charge.
const etiquetee = (id, etiquettes, exclu = false) => {
  const p = personne(id, null, exclu);
  return etiquettes === undefined ? p : { ...p, etiquettes };
};

describe('legendeEtiquettes : la légende des étiquettes, avec leur compte (§ 10.2)', () => {
  test('chaque étiquette portée, par sa clé normalisée puis par points de code, avec le nombre de personnes qui la portent, exclues comprises', () => {
    const liste = [
      etiquetee(1, ['Montréal', 'finance']),
      etiquetee(2, ['finance']),
      etiquetee(3, ['bénévole', 'finance'], true),
      etiquetee(4, undefined),
      etiquetee(5, ['Finance']),
    ];
    assert.deepEqual(legendeEtiquettes(liste), [
      { nom: 'bénévole', compte: 1 },
      { nom: 'Finance', compte: 1 },
      { nom: 'finance', compte: 3 },
      { nom: 'Montréal', compte: 1 },
    ]);
  });

  test('sans étiquette portée, une légende vide : la section ne la montre pas', () => {
    assert.deepEqual(legendeEtiquettes([]), []);
    assert.deepEqual(legendeEtiquettes([etiquetee(1, undefined), etiquetee(2, undefined, true)]), []);
  });

  test('une étiquette égale au nom d’une appartenance reste une étiquette, et l’appartenance ne s’y compte pas', () => {
    const liste = [{ ...etiquetee(1, ['Atelier Pivoine']), appartenance: 'Atelier Pivoine' }, personne(2, 'Atelier Pivoine')];
    assert.deepEqual(legendeEtiquettes(liste), [{ nom: 'Atelier Pivoine', compte: 1 }]);
    assert.deepEqual(legendeAppartenances(liste, teintesAppartenances(liste)), [{ nom: 'Atelier Pivoine', rang: 1, compte: 2 }]);
  });

  test('l’ordre ne dépend pas de l’ordre de la liste : un filtre ou un tri ne le change pas', () => {
    const liste = [etiquetee(1, ['ressources humaines']), etiquetee(2, ['bénévole', 'Montréal']), etiquetee(3, ['finance'])];
    assert.deepEqual(legendeEtiquettes([...liste].reverse()), legendeEtiquettes(liste));
  });

  test('le titre de la légende des étiquettes ; chaque élément, le nom puis le compte, comme les appartenances', () => {
    assert.equal(t('participants.legendeEtiquettes.titre'), 'Étiquettes');
    assert.notEqual(t('participants.legendeEtiquettes.titre'), t('participants.legende.titre'));
    assert.equal(t('participants.legende.element', { nom: 'finance', compte: 3 }), 'finance \u{00B7} 3');
  });
});
