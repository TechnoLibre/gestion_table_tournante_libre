// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'en-tête de la liste des participants : la ligne de comptes de la carte,
// la légende des organisations et celle des étiquettes, chacune lue sur la
// liste entière, exclues comprises — les présences partielles exceptées, qui
// ne comptent que les non-exclues —, et le texte que les libellés en
// composent. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { RANGS_ORGANISATION, teintesOrganisations } from '../organisations.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { comptesEntete, legendeOrganisations, legendeEtiquettes } from './entete.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const personne = (id, organisation, exclu = false) => ({
  id,
  nom: `Brumaille${id}`,
  prenom: null,
  organisation,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu,
});

// Trois organisations, dont une portée par une exclue seule, et une
// personne sans organisation.
const LISTE = [
  personne(1, 'Cercle des Grives'),
  personne(2, 'Atelier Pivoine'),
  personne(3, 'Cercle des Grives', true),
  personne(4, null),
  personne(5, 'Cercle des Grives'),
  personne(6, 'Banc des Loutres', true),
];

describe('comptesEntete : la ligne de comptes de la carte des participants', () => {
  test('personnes, à placer, exclues et organisations distinctes, exclues comprises ; aucune présence partielle', () => {
    assert.deepEqual(comptesEntete(LISTE), { personnes: 6, aPlacer: 4, exclues: 2, organisations: 3, partielles: 0 });
  });

  test('une liste vide : cinq zéros', () => {
    assert.deepEqual(comptesEntete([]), { personnes: 0, aPlacer: 0, exclues: 0, organisations: 0, partielles: 0 });
  });

  test('les présences partielles : les non-exclues qui portent une présence ; celle d’une exclue, suspendue, ne compte pas', () => {
    const liste = [
      { ...personne(1, null), presence: [1, 2] },
      personne(2, null),
      { ...personne(3, null, true), presence: [2] },
      { ...personne(4, null), presence: [3] },
    ];
    assert.equal(comptesEntete(liste).partielles, 2);
    assert.equal(comptesEntete(liste).exclues, 1);
  });

  test('deux orthographes sont deux organisations, comme pour le moteur et les teintes', () => {
    const liste = [personne(1, 'Cercle des Grives'), personne(2, 'cercle des grives')];
    assert.equal(comptesEntete(liste).organisations, 2);
    assert.equal(comptesEntete(liste).organisations, teintesOrganisations(liste).size);
  });

  test('le libellé compose la ligne, accordée au nombre', () => {
    assert.equal(
      t('participants.entete.comptes', { personnes: 13, aPlacer: 12, exclues: 1, organisations: 3 }),
      '13 personnes \u{00B7} 12 à placer \u{00B7} 1 exclue \u{00B7} 3 organisations',
    );
    assert.equal(
      t('participants.entete.comptes', { personnes: 1, aPlacer: 0, exclues: 2, organisations: 1 }),
      '1 personne \u{00B7} 0 à placer \u{00B7} 2 exclues \u{00B7} 1 organisation',
    );
    assert.equal(
      t('participants.entete.comptes', { personnes: 0, aPlacer: 0, exclues: 0, organisations: 0, partielles: 0 }),
      '0 personne \u{00B7} 0 à placer \u{00B7} 0 exclue \u{00B7} 0 organisation',
    );
  });

  test('« n présences partielles » s’ajoute en dernier, seulement quand il y en a', () => {
    const comptes = { personnes: 13, aPlacer: 12, exclues: 1, organisations: 3 };
    assert.equal(
      t('participants.entete.comptes', { ...comptes, partielles: 2 }),
      '13 personnes \u{00B7} 12 à placer \u{00B7} 1 exclue \u{00B7} 3 organisations \u{00B7} 2 présences partielles',
    );
    assert.equal(
      t('participants.entete.comptes', { ...comptes, partielles: 1 }),
      '13 personnes \u{00B7} 12 à placer \u{00B7} 1 exclue \u{00B7} 3 organisations \u{00B7} 1 présence partielle',
    );
    assert.equal(t('participants.entete.comptes', { ...comptes, partielles: 0 }), t('participants.entete.comptes', comptes));
  });
});

describe('legendeOrganisations : la légende en pastilles, avec leur compte', () => {
  test('dans l’ordre des teintes, chaque organisation avec son rang et le nombre de personnes qui la portent, exclues comprises', () => {
    assert.deepEqual(legendeOrganisations(LISTE, teintesOrganisations(LISTE)), [
      { nom: 'Atelier Pivoine', rang: 1, compte: 1 },
      { nom: 'Banc des Loutres', rang: 2, compte: 1 },
      { nom: 'Cercle des Grives', rang: 3, compte: 3 },
    ]);
  });

  test('au-delà des rangs de la palette, le rang est null : la pastille est neutre, le compte reste', () => {
    const liste = Array.from({ length: RANGS_ORGANISATION + 2 }, (_, i) => personne(i + 1, `Guilde ${String.fromCodePoint(65 + i)}`));
    liste.push(personne(99, 'Guilde A'));
    const legende = legendeOrganisations(liste, teintesOrganisations(liste));
    assert.equal(legende.length, RANGS_ORGANISATION + 2);
    assert.deepEqual(legende[0], { nom: 'Guilde A', rang: 1, compte: 2 });
    assert.deepEqual(
      legende.map(({ rang }) => rang),
      [...Array.from({ length: RANGS_ORGANISATION }, (_, i) => i + 1), null, null],
    );
  });

  test('sans organisation portée, une légende vide ; une personne sans organisation n’y entre pas', () => {
    const liste = [personne(1, null), personne(2, null, true)];
    assert.deepEqual(legendeOrganisations(liste, teintesOrganisations(liste)), []);
  });

  test('les rangs sont ceux des teintes reçues, jamais recalculés sur une liste filtrée', () => {
    const teintes = teintesOrganisations(LISTE);
    const filtree = LISTE.filter(({ organisation }) => organisation === 'Cercle des Grives');
    assert.deepEqual(legendeOrganisations(filtree, teintes), [{ nom: 'Cercle des Grives', rang: 3, compte: 3 }]);
  });

  test('le libellé d’un élément : le nom, puis le compte', () => {
    assert.equal(t('participants.legende.element', { nom: 'Atelier Pivoine', compte: 4 }), 'Atelier Pivoine \u{00B7} 4');
    assert.equal(t('participants.legende.titre'), 'Organisations');
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

  test('une étiquette égale au nom d’une organisation reste une étiquette, et l’organisation ne s’y compte pas', () => {
    const liste = [{ ...etiquetee(1, ['Atelier Pivoine']), organisation: 'Atelier Pivoine' }, personne(2, 'Atelier Pivoine')];
    assert.deepEqual(legendeEtiquettes(liste), [{ nom: 'Atelier Pivoine', compte: 1 }]);
    assert.deepEqual(legendeOrganisations(liste, teintesOrganisations(liste)), [{ nom: 'Atelier Pivoine', rang: 1, compte: 2 }]);
  });

  test('l’ordre ne dépend pas de l’ordre de la liste : un filtre ou un tri ne le change pas', () => {
    const liste = [etiquetee(1, ['ressources humaines']), etiquetee(2, ['bénévole', 'Montréal']), etiquetee(3, ['finance'])];
    assert.deepEqual(legendeEtiquettes([...liste].reverse()), legendeEtiquettes(liste));
  });

  test('le titre de la légende des étiquettes ; chaque élément, le nom puis le compte, comme les organisations', () => {
    assert.equal(t('participants.legendeEtiquettes.titre'), 'Étiquettes');
    assert.notEqual(t('participants.legendeEtiquettes.titre'), t('participants.legende.titre'));
    assert.equal(t('participants.legende.element', { nom: 'finance', compte: 3 }), 'finance \u{00B7} 3');
  });
});
