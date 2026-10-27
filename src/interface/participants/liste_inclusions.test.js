// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle pur de la saisie des inclusions d'une personne
// (participants/liste_inclusions.js) : les saisies canoniques des deux
// listes et celle de la grille, leurs lectures, les cibles et leur libellé,
// les choix d'un éditeur et leur bascule, les commandes qu'une saisie
// validée exécute, l'ordre d'affichage et la clé de tri, et la machine de
// champ.js qui reconnaît « rien de changé » à l'égalité de deux saisies.
// Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { cleNormalisee } from '../../application/csv.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { creerMachineChamp } from '../primitives/champ.js';
import { choixDeConflits } from './liste_conflits.js';
import {
  choixDeParticipants,
  ciblesDeParticipants,
  cleTriInclusions,
  commandeDInclusions,
  commandeInclusionsOrganisation,
  commandeInclusionsParticipant,
  lectureInclusions,
  lectureParticipants,
  libelleDeCible,
  nomDeCible,
  participantsInclus,
  partiesDInclusions,
  saisieApresBasculeInclusion,
  saisieApresBasculeParticipant,
  saisieDInclusions,
  saisieDeParticipants,
  saisieInclusionsEnregistree,
  saisieOrganisationsEnregistree,
  saisieParticipantsEnregistree,
} from './liste_inclusions.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const MERLES = 'Club des Merles';
const ALPHA = 'Société Alpha';
const RESSAC = 'Atelier Ressac';

// Un participant ; les champs absents valent null, exclu faux.
const personne = (id, nom, prenom = null, champs = {}) => ({ id, nom, prenom, organisation: null, exclu: false, ...champs });

// Cinq personnes : deux Iris Ombrelle homonymes, une exclue.
const PERSONNES = [
  personne(1, 'Ombrelle', 'Iris'),
  personne(2, 'Pervenche', 'Théo'),
  personne(3, 'Lacasse', 'Ondine', { exclu: true }),
  personne(4, 'Ombrelle', 'Iris'),
  personne(5, 'Écume', 'Basile'),
];
const CIBLES = ciblesDeParticipants(PERSONNES);

describe('les saisies canoniques des inclusions', () => {
  test('une liste de participants : identifiants croissants, sans doublon, en JSON ; deux listes égales ont la même saisie', () => {
    assert.equal(saisieDeParticipants([5, 2, 5, 10]), '[2,5,10]');
    assert.equal(saisieDeParticipants([10, 2]), saisieDeParticipants([2, 10]));
    assert.equal(saisieDeParticipants([]), '[]');
  });

  test('les saisies enregistrées : chaque liste, la liste vide quand le champ manque ; les organisations sous la forme des conflits', () => {
    const iris = { inclusionsOrganisation: [RESSAC, MERLES], inclusionsParticipant: [5, 2] };
    assert.equal(saisieOrganisationsEnregistree(iris), JSON.stringify([RESSAC, MERLES]));
    assert.equal(saisieParticipantsEnregistree(iris), '[2,5]');
    assert.equal(saisieOrganisationsEnregistree({}), '[]');
    assert.equal(saisieParticipantsEnregistree({}), '[]');
  });

  test('la lecture des participants rend la liste, vide comprise, sans jamais refuser', () => {
    assert.deepEqual(lectureParticipants('[2,5]'), { valeur: [2, 5] });
    assert.deepEqual(lectureParticipants('[]'), { valeur: [] });
  });

  test('cocher puis décocher revient à la saisie de départ : la machine de champ ne valide rien', () => {
    const machine = creerMachineChamp({ stockee: saisieDeParticipants([2]), lire: lectureParticipants });
    machine.saisir(saisieApresBasculeParticipant(machine.saisie, 5, true));
    assert.equal(machine.saisie, '[2,5]');
    machine.saisir(saisieApresBasculeParticipant(machine.saisie, 5, false));
    assert.deepEqual(machine.valider(), { action: 'aucune' });
    machine.saisir(saisieApresBasculeParticipant(machine.saisie, 2, false));
    assert.deepEqual(machine.valider(), { action: 'executer', valeur: [] });
    assert.equal(saisieApresBasculeParticipant('[2]', 2, true), '[2]');
    assert.equal(saisieApresBasculeParticipant('[2]', 9, false), '[2]');
  });
});

describe('les cibles et leur libellé', () => {
  test('chaque participant, exclus compris, par identifiant : son nom affiché, exclue, homonyme', () => {
    assert.deepEqual([...CIBLES], [
      [1, { nom: 'Iris Ombrelle', exclue: false, homonyme: true }],
      [2, { nom: 'Théo Pervenche', exclue: false, homonyme: false }],
      [3, { nom: 'Ondine Lacasse', exclue: true, homonyme: false }],
      [4, { nom: 'Iris Ombrelle', exclue: false, homonyme: true }],
      [5, { nom: 'Basile Écume', exclue: false, homonyme: false }],
    ]);
    assert.equal(ciblesDeParticipants([personne(7, 'Grisaille')]).get(7).nom, 'Grisaille');
  });

  test('le libellé écrit le nom, l’identifiant d’un homonyme, « (exclue) » ; un identifiant inconnu, seul', () => {
    assert.equal(libelleDeCible(CIBLES, 2, t), 'Théo Pervenche');
    assert.equal(libelleDeCible(CIBLES, 4, t), 'Iris Ombrelle (n° 4)');
    assert.equal(libelleDeCible(CIBLES, 3, t), 'Ondine Lacasse (exclue)');
    const exclueHomonyme = ciblesDeParticipants([personne(1, 'Ombrelle', 'Iris', { exclu: true }), personne(2, 'Ombrelle', 'Iris')]);
    assert.equal(libelleDeCible(exclueHomonyme, 1, t), 'Iris Ombrelle (n° 1) (exclue)');
    assert.equal(libelleDeCible(CIBLES, 42, t), 'n° 42');
  });

  test('le nom que lit la recherche : le nom affiché seul, sans numéro ni « (exclue) » ; vide pour un identifiant inconnu', () => {
    assert.equal(nomDeCible(CIBLES, 4), 'Iris Ombrelle');
    assert.equal(nomDeCible(CIBLES, 3), 'Ondine Lacasse');
    assert.equal(nomDeCible(CIBLES, 42), '');
  });
});

describe("les choix d'un éditeur de participants", () => {
  test('chaque personne hors soi, exclues comprises, rangée par la clé normalisée du nom puis par identifiant, cochée quand la saisie la nomme', () => {
    assert.deepEqual(choixDeParticipants('[3,4]', CIBLES, 2, cleNormalisee), [
      { valeur: 5, coche: false },
      { valeur: 1, coche: false },
      { valeur: 4, coche: true },
      { valeur: 3, coche: true },
    ]);
    assert.deepEqual(
      choixDeParticipants('[]', CIBLES, 1, cleNormalisee).map(({ valeur }) => valeur),
      [5, 4, 3, 2],
    );
  });

  test('un identifiant que la saisie porte et que l’événement n’a plus reste offert, coché, après les autres ; seule, la personne n’a aucun choix', () => {
    assert.deepEqual(choixDeParticipants('[9]', ciblesDeParticipants([personne(1, 'Ombrelle'), personne(2, 'Pervenche')]), 1, cleNormalisee), [
      { valeur: 2, coche: false },
      { valeur: 9, coche: true },
    ]);
    assert.deepEqual(choixDeParticipants('[]', ciblesDeParticipants([personne(1, 'Ombrelle')]), 1, cleNormalisee), []);
  });

  test('l’affichage d’une liste suit le même ordre ; vide sans liste', () => {
    assert.deepEqual(participantsInclus([1, 2, 5, 9, 3], CIBLES, cleNormalisee), [5, 1, 3, 2, 9]);
    assert.deepEqual(participantsInclus(undefined, CIBLES, cleNormalisee), []);
  });
});

describe('les commandes de la fiche', () => {
  test('chacune pose sa liste entière, en une entrée', () => {
    assert.deepEqual(commandeInclusionsOrganisation(4, [MERLES, ALPHA]), {
      nom: 'changerInclusionsOrganisation',
      args: { id: 4, organisations: [MERLES, ALPHA] },
    });
    assert.deepEqual(commandeInclusionsParticipant(4, []), { nom: 'changerInclusionsParticipant', args: { id: 4, participants: [] } });
  });
});

describe('la saisie de la grille : les deux listes dans une cellule', () => {
  test('la paire [organisations, participants], chacune canonique ; celle des inclusions enregistrées ; sa lecture', () => {
    const saisie = saisieDInclusions([MERLES, RESSAC, MERLES], [5, 2]);
    assert.equal(saisie, JSON.stringify([[RESSAC, MERLES], [2, 5]]));
    assert.equal(saisieInclusionsEnregistree({ inclusionsOrganisation: [RESSAC, MERLES], inclusionsParticipant: [2, 5] }), saisie);
    assert.equal(saisieInclusionsEnregistree({}), '[[],[]]');
    assert.deepEqual(lectureInclusions(saisie), { valeur: { organisations: [RESSAC, MERLES], participants: [2, 5] } });
    assert.deepEqual(partiesDInclusions(saisie), { organisations: JSON.stringify([RESSAC, MERLES]), participants: '[2,5]' });
  });

  test('la bascule d’une liste laisse l’autre ; cocher puis décocher ne valide rien ; une autre sorte lève', () => {
    const depart = saisieDInclusions([MERLES], [2]);
    const machine = creerMachineChamp({ stockee: depart, lire: lectureInclusions });
    machine.saisir(saisieApresBasculeInclusion(machine.saisie, 'organisation', ALPHA, true));
    machine.saisir(saisieApresBasculeInclusion(machine.saisie, 'participant', 5, true));
    assert.equal(machine.saisie, saisieDInclusions([MERLES, ALPHA], [2, 5]));
    machine.saisir(saisieApresBasculeInclusion(machine.saisie, 'organisation', ALPHA, false));
    machine.saisir(saisieApresBasculeInclusion(machine.saisie, 'participant', 5, false));
    assert.deepEqual(machine.valider(), { action: 'aucune' });
    machine.saisir(saisieApresBasculeInclusion(machine.saisie, 'participant', 2, false));
    assert.deepEqual(machine.valider(), { action: 'executer', valeur: { organisations: [MERLES], participants: [] } });
    assert.throws(() => saisieApresBasculeInclusion(depart, 'conflit', ALPHA, true), RangeError);
  });

  test('les choix de chaque liste se lisent dans sa partie', () => {
    const { organisations, participants } = partiesDInclusions(saisieDInclusions([ALPHA], [4]));
    assert.deepEqual(choixDeConflits(organisations, new Set([MERLES, ALPHA, RESSAC]), RESSAC, cleNormalisee), [
      { valeur: MERLES, coche: false },
      { valeur: ALPHA, coche: true },
    ]);
    assert.deepEqual(
      choixDeParticipants(participants, CIBLES, 1, cleNormalisee).filter(({ coche }) => coche),
      [{ valeur: 4, coche: true }],
    );
  });

  test('la commande d’une saisie validée : une seule, changerInclusions, qui porte chaque liste qui change ; une liste que la saisie ne touche pas ne part pas', () => {
    const iris = { id: 1, inclusionsOrganisation: [MERLES], inclusionsParticipant: [2] };
    const initiale = lectureInclusions(saisieInclusionsEnregistree(iris)).valeur;
    assert.deepEqual(commandeDInclusions(iris, initiale, { organisations: [MERLES, ALPHA], participants: [2, 5] }), {
      nom: 'changerInclusions',
      args: { id: 1, organisations: [MERLES, ALPHA], participants: [2, 5] },
    });
    assert.deepEqual(commandeDInclusions(iris, initiale, { organisations: [MERLES], participants: [] }), {
      nom: 'changerInclusions',
      args: { id: 1, participants: [] },
    });
    assert.deepEqual(commandeDInclusions(iris, initiale, { organisations: [], participants: [2] }), {
      nom: 'changerInclusions',
      args: { id: 1, organisations: [] },
    });
  });

  test('une écriture venue d’ailleurs pendant la saisie : la liste que la saisie ne touche pas la garde, celle qu’elle ramène à ce que la personne porte ne part pas', () => {
    const avant = { id: 1, inclusionsOrganisation: [MERLES], inclusionsParticipant: [2] };
    const initiale = lectureInclusions(saisieInclusionsEnregistree(avant)).valeur;
    // Ailleurs, la liste des participants passe à [2, 5] et celle des
    // organisations à [MERLES, ALPHA].
    const apres = { id: 1, inclusionsOrganisation: [MERLES, ALPHA], inclusionsParticipant: [2, 5] };
    assert.equal(commandeDInclusions(apres, initiale, { organisations: [MERLES, ALPHA], participants: [2] }), null);
    assert.deepEqual(commandeDInclusions(apres, initiale, { organisations: [], participants: [2] }), {
      nom: 'changerInclusions',
      args: { id: 1, organisations: [] },
    });
    assert.equal(commandeDInclusions({ id: 1 }, initiale, { organisations: [], participants: [] }), null);
  });
});

describe('la clé de tri des inclusions', () => {
  test('le nombre de lignes, organisations et participants ensemble ; null sans aucune', () => {
    assert.equal(cleTriInclusions({ inclusionsOrganisation: [MERLES, ALPHA], inclusionsParticipant: [3] }), 3);
    assert.equal(cleTriInclusions({ inclusionsParticipant: [3] }), 1);
    assert.equal(cleTriInclusions({}), null);
  });
});
