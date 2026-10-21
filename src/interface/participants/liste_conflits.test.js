// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur de la saisie des conflits d'organisation d'une personne
// (participants/liste_conflits.js) : la saisie canonique d'une liste, sa
// lecture, les choix d'un éditeur et leur bascule, la commande qu'une
// saisie validée exécute, l'affichage et la clé de tri d'une liste, et la
// machine de champ.js qui reconnaît « rien de changé » à l'égalité de deux
// saisies. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { cleNormalisee } from '../../application/csv.js';
import { creerMachineChamp } from '../primitives/champ.js';
import {
  choixDeConflits,
  cleTriConflits,
  commandeDeConflits,
  lectureConflits,
  saisieApresBasculeConflit,
  saisieConflitsEnregistree,
  saisieDeConflits,
} from './liste_conflits.js';

const MERLES = 'Club des Merles';
const HERONS = 'cercle des Hérons';
const ALPHA = 'Société Alpha';
const RESSAC = 'Atelier Ressac';

describe('la saisie canonique des conflits', () => {
  test('une liste rangée par unités de code, sans doublon, écrite en JSON : deux listes égales ont la même saisie', () => {
    assert.equal(saisieDeConflits([MERLES, ALPHA, MERLES]), JSON.stringify([MERLES, ALPHA]));
    assert.equal(saisieDeConflits([ALPHA, MERLES]), saisieDeConflits([MERLES, ALPHA]));
    assert.equal(saisieDeConflits([]), '[]');
    // L'unité de code range la majuscule avant la minuscule, sans égard à
    // la langue.
    assert.equal(saisieDeConflits([HERONS, MERLES]), JSON.stringify([MERLES, HERONS]));
  });

  test("la saisie enregistrée d'une personne : sa liste, la liste vide quand le champ manque", () => {
    assert.equal(saisieConflitsEnregistree({ conflits: [RESSAC, MERLES] }), JSON.stringify([RESSAC, MERLES]));
    assert.equal(saisieConflitsEnregistree({}), '[]');
  });

  test('la lecture rend la liste, vide comprise, sans jamais refuser', () => {
    assert.deepEqual(lectureConflits(saisieDeConflits([ALPHA, MERLES])), { valeur: [MERLES, ALPHA] });
    assert.deepEqual(lectureConflits('[]'), { valeur: [] });
  });

  test('cocher puis décocher revient à la saisie de départ : la machine de champ ne valide rien', () => {
    const stockee = saisieDeConflits([MERLES]);
    const machine = creerMachineChamp({ stockee, lire: lectureConflits });
    machine.saisir(saisieApresBasculeConflit(machine.saisie, ALPHA, true));
    assert.equal(machine.saisie, saisieDeConflits([ALPHA, MERLES]));
    machine.saisir(saisieApresBasculeConflit(machine.saisie, ALPHA, false));
    assert.deepEqual(machine.valider(), { action: 'aucune' });
    machine.saisir(saisieApresBasculeConflit(machine.saisie, MERLES, false));
    assert.deepEqual(machine.valider(), { action: 'executer', valeur: [] });
  });

  test('cocher un nom déjà coché, ou décocher un nom absent, ne change rien', () => {
    const saisie = saisieDeConflits([MERLES]);
    assert.equal(saisieApresBasculeConflit(saisie, MERLES, true), saisie);
    assert.equal(saisieApresBasculeConflit(saisie, ALPHA, false), saisie);
  });
});

describe("les choix d'un éditeur", () => {
  test('chaque organisation de l’événement hors la sienne, rangée par clé normalisée, cochée quand la saisie la nomme', () => {
    const organisations = new Set([MERLES, ALPHA, HERONS, RESSAC]);
    assert.deepEqual(choixDeConflits(saisieDeConflits([ALPHA]), organisations, RESSAC, cleNormalisee), [
      { valeur: HERONS, coche: false },
      { valeur: MERLES, coche: false },
      { valeur: ALPHA, coche: true },
    ]);
    assert.deepEqual(
      choixDeConflits('[]', organisations, null, cleNormalisee).map(({ valeur }) => valeur),
      [RESSAC, HERONS, MERLES, ALPHA],
    );
  });

  test("un nom que la saisie porte et que l'événement n'a plus reste offert, coché : il se décoche", () => {
    assert.deepEqual(choixDeConflits(saisieDeConflits([RESSAC]), new Set([MERLES]), null, cleNormalisee), [
      { valeur: RESSAC, coche: true },
      { valeur: MERLES, coche: false },
    ]);
  });

  test('deux graphies de même clé se départagent par unités de code ; aucune organisation, aucun choix', () => {
    assert.deepEqual(
      choixDeConflits('[]', new Set(['club des merles', MERLES]), null, cleNormalisee).map(({ valeur }) => valeur),
      [MERLES, 'club des merles'],
    );
    assert.deepEqual(choixDeConflits('[]', new Set([RESSAC]), RESSAC, cleNormalisee), []);
  });
});

describe('la commande d’une saisie validée', () => {
  test('changerConflits de la liste saisie entière, en une entrée, quel que soit le nombre de noms qui changent', () => {
    assert.deepEqual(commandeDeConflits(4, [HERONS, MERLES, RESSAC]), {
      nom: 'changerConflits',
      args: { id: 4, organisations: [HERONS, MERLES, RESSAC] },
    });
    assert.deepEqual(commandeDeConflits(4, []), { nom: 'changerConflits', args: { id: 4, organisations: [] } });
  });
});

describe('la clé de tri d’une liste', () => {
  test('null sans liste ; sinon ses clés normalisées rangées, jointes par une fin de ligne', () => {
    assert.equal(cleTriConflits(undefined, cleNormalisee), null);
    assert.equal(cleTriConflits([MERLES, ALPHA], cleNormalisee), 'club des merles\nsociete alpha');
    assert.equal(cleTriConflits([ALPHA, MERLES], cleNormalisee), cleTriConflits([MERLES, ALPHA], cleNormalisee));
  });
});
