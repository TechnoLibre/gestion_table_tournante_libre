// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les modules purs de la liste des participants (§ 4, § 7.4, § 10.2) : les
// lignes de la grille, triées et filtrées, la navigation au clavier,
// l'orthographe d'organisation à reprendre, l'itinéraire d'une personne dans
// le retenu, ses réservations, l'ordre des colonnes, celui de l'export, et
// les groupes de la liste groupée par une colonne ou plusieurs, imbriqués,
// la présence par tour comprise — sa cellule exportée, son tri, ses groupes,
// l'étape « absente » de l'itinéraire — et la commande d'une cellule.
// Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { cleNormalisee, decoder, exporterParticipants } from '../../application/csv.js';
import { ecrirePresence } from '../../csv/presence.js';
import {
  CHAMP_DE_COLONNE,
  COLONNES,
  GROUPEMENTS,
  basculerGroupe,
  celluleSuivante,
  cheminDe,
  choisirGroupement,
  cleDeColonne,
  cleDeGroupement,
  cleDeStatut,
  clesPremierNiveau,
  colonnesOffertes,
  commandeDeCellule,
  deplierChemin,
  entreeValide,
  groupesGrille,
  itineraire,
  lignesGrille,
  lignesVisibles,
  ligneVoisine,
  niveauxAffiches,
  nomExport,
  orthographeExistante,
  reservationsDe,
} from './grille.js';

// Un participant ; les champs absents valent null, exclu faux.
const personne = (id, nom, champs = {}) => ({
  id,
  nom,
  prenom: null,
  organisation: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...champs,
});

const ids = (lignes) => lignes.map(({ id }) => id);

describe('lignesGrille : tri et filtre (§ 10.2)', () => {
  const participants = [
    personne(4, 'Pervenche', { prenom: 'Théo', organisation: 'CLUB DES MERLES' }),
    personne(1, 'Ombrelle', { prenom: 'Iris', organisation: 'Club des Merles' }),
    personne(3, 'Lacasse', { prenom: 'Ondine' }),
    personne(2, 'Ombrelle', { prenom: 'Anselme' }),
    personne(5, 'Grisaille', { exclu: true }),
  ];

  test('sans tri ni filtre, par identifiant croissant', () => {
    assert.deepEqual(ids(lignesGrille(participants, { tri: null, filtre: '' }, cleNormalisee)), [1, 2, 3, 4, 5]);
  });

  test('par nom, croissant puis décroissant ; deux noms égaux se départagent par identifiant croissant', () => {
    const croissant = lignesGrille(participants, { tri: { colonne: 'nom', sens: 'croissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(croissant), [5, 3, 1, 2, 4]);
    const decroissant = lignesGrille(participants, { tri: { colonne: 'nom', sens: 'decroissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(decroissant), [4, 1, 2, 3, 5]);
  });

  test('la clé normalisée trie : casse et accents ignorés', () => {
    const liste = [personne(1, 'Émeraude'), personne(2, 'elan'), personne(3, 'Ezra')];
    const lignes = lignesGrille(liste, { tri: { colonne: 'nom', sens: 'croissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(lignes), [2, 1, 3]);
  });

  test('exclu : faux avant vrai en croissant, vrai avant faux en décroissant', () => {
    const croissant = lignesGrille(participants, { tri: { colonne: 'exclu', sens: 'croissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(croissant), [1, 2, 3, 4, 5]);
    const decroissant = lignesGrille(participants, { tri: { colonne: 'exclu', sens: 'decroissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(decroissant), [5, 1, 2, 3, 4]);
  });

  test('filtre « merles » : « Club des Merles » et « CLUB DES MERLES » restent, la clé normalisée du filtre comprise', () => {
    for (const filtre of ['merles', 'MERLES', ' Mérles ']) {
      assert.deepEqual(ids(lignesGrille(participants, { tri: null, filtre }, cleNormalisee)), [1, 4], filtre);
    }
  });

  test('le filtre lit chaque champ texte : prénom, courriel, titre pressenti, notes', () => {
    const liste = [
      personne(1, 'Ombrelle', { courriel: 'iris@exemple.test' }),
      personne(2, 'Pervenche', { titrePressenti: 'hôtesse' }),
      personne(3, 'Lacasse', { notes: 'arrive tard' }),
      personne(4, 'Grisaille', { prenom: 'Hôtesse' }),
    ];
    assert.deepEqual(ids(lignesGrille(liste, { tri: null, filtre: 'exemple' }, cleNormalisee)), [1]);
    assert.deepEqual(ids(lignesGrille(liste, { tri: null, filtre: 'hotesse' }, cleNormalisee)), [2, 4]);
    assert.deepEqual(ids(lignesGrille(liste, { tri: null, filtre: 'tard' }, cleNormalisee)), [3]);
    assert.deepEqual(ids(lignesGrille(liste, { tri: null, filtre: 'absent' }, cleNormalisee)), []);
  });

  test('des champs null : le filtre ne lève pas, et le tri les range après toute valeur, croissant comme décroissant', () => {
    const vides = ['prenom', 'organisation', 'courriel', 'titrePressenti', 'notes'];
    // 1 et 3 portent chaque champ, 2 et 4 aucun : les null viennent après,
    // par identifiant croissant, dans les deux sens.
    const liste = [
      personne(4, 'Grisaille'),
      personne(3, 'Lacasse', Object.fromEntries(vides.map((champ) => [champ, 'zinnia']))),
      personne(2, 'Pervenche'),
      personne(1, 'Ombrelle', Object.fromEntries(vides.map((champ) => [champ, 'acacia']))),
    ];
    assert.doesNotThrow(() => lignesGrille(liste, { tri: null, filtre: 'acacia' }, cleNormalisee));
    assert.deepEqual(ids(lignesGrille(liste, { tri: null, filtre: 'acacia' }, cleNormalisee)), [1]);
    assert.ok(vides.length > 0);
    for (const colonne of vides) {
      const croissant = lignesGrille(liste, { tri: { colonne, sens: 'croissant' }, filtre: '' }, cleNormalisee);
      assert.deepEqual(ids(croissant), [1, 3, 2, 4], `${colonne} croissant`);
      const decroissant = lignesGrille(liste, { tri: { colonne, sens: 'decroissant' }, filtre: '' }, cleNormalisee);
      assert.deepEqual(ids(decroissant), [3, 1, 2, 4], `${colonne} décroissant`);
    }
  });

  test('cleNormalisee ne reçoit jamais null', () => {
    const recus = [];
    const espion = (texte) => {
      recus.push(texte);
      return cleNormalisee(texte);
    };
    const liste = [personne(1, 'Ombrelle'), personne(2, 'Pervenche', { notes: 'x' })];
    lignesGrille(liste, { tri: { colonne: 'notes', sens: 'croissant' }, filtre: 'o' }, espion);
    assert.ok(recus.length > 0);
    assert.ok(recus.every((texte) => typeof texte === 'string'));
  });

  test('ne modifie pas la liste reçue', () => {
    const copie = structuredClone(participants);
    lignesGrille(participants, { tri: { colonne: 'nom', sens: 'decroissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(participants, copie);
  });

  test('une colonne de tri inconnue, un sens inconnu : RangeError', () => {
    assert.throws(() => lignesGrille(participants, { tri: { colonne: 'id', sens: 'croissant' }, filtre: '' }, cleNormalisee), RangeError);
    assert.throws(() => lignesGrille(participants, { tri: { colonne: 'nom', sens: 'haut' }, filtre: '' }, cleNormalisee), RangeError);
  });
});

describe('la colonne de la présence : filtre, tri, groupes, commande', () => {
  const liste = [
    personne(1, 'Ombrelle', { presence: [2] }),
    personne(2, 'Pervenche'),
    personne(3, 'Lacasse', { presence: [1, 3] }),
    personne(4, 'Grisaille', { presence: [1, 2] }),
    personne(5, 'Lisonnet', { exclu: true }),
    personne(6, 'Brindelle', { presence: [1, 3] }),
  ];

  test('le filtre ne lit pas la présence, et ne lève pas sur sa liste', () => {
    const lus = [];
    const espion = (texte) => {
      lus.push(texte);
      return cleNormalisee(texte);
    };
    for (const filtre of ['1', 'tour', 'tous', '3']) {
      assert.doesNotThrow(() => lignesGrille(liste, { tri: null, filtre }, espion), filtre);
      assert.deepEqual(ids(lignesGrille(liste, { tri: null, filtre }, cleNormalisee)), [], filtre);
    }
    assert.ok(lus.every((texte) => typeof texte === 'string'));
  });

  test('le tri : « tous » en tête en croissant, puis [1,2] < [1,3] < [2] ; l’inverse en décroissant ; deux présences égales par identifiant croissant', () => {
    const croissant = lignesGrille(liste, { tri: { colonne: 'presence', sens: 'croissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(croissant), [2, 5, 4, 3, 6, 1]);
    const decroissant = lignesGrille(liste, { tri: { colonne: 'presence', sens: 'decroissant' }, filtre: '' }, cleNormalisee);
    assert.deepEqual(ids(decroissant), [1, 3, 6, 4, 2, 5]);
  });

  test('les groupes : « tous » d’abord, puis chaque présence, nommée par ses tours dans les détails du libellé ; le sens suit le tri de la colonne', () => {
    const lignes = lignesGrille(liste, { tri: null, filtre: '' }, cleNormalisee);
    const groupes = groupesGrille(lignes, ['presence'], { tri: null, cleNormalisee, statuts: null });
    assert.deepEqual(
      groupes.map(({ cle, libelle, cleLibelle, detailsLibelle, compte, lignes: l }) => ({ cle, libelle, cleLibelle, detailsLibelle, compte, ids: ids(l) })),
      [
        { cle: 'presence:tous', libelle: null, cleLibelle: 'participants.presence.tous', detailsLibelle: {}, compte: 2, ids: [2, 5] },
        { cle: 'presence:001,002', libelle: null, cleLibelle: 'participants.presence.tours', detailsLibelle: { tours: [1, 2] }, compte: 1, ids: [4] },
        { cle: 'presence:001,003', libelle: null, cleLibelle: 'participants.presence.tours', detailsLibelle: { tours: [1, 3] }, compte: 2, ids: [3, 6] },
        { cle: 'presence:002', libelle: null, cleLibelle: 'participants.presence.tours', detailsLibelle: { tours: [2] }, compte: 1, ids: [1] },
      ],
    );
    const tri = { colonne: 'presence', sens: 'decroissant' };
    const inverses = groupesGrille(lignesGrille(liste, { tri, filtre: '' }, cleNormalisee), ['presence'], { tri, cleNormalisee, statuts: null });
    assert.deepEqual(inverses.map(({ cle }) => cle), ['presence:002', 'presence:001,003', 'presence:001,002', 'presence:tous']);
  });

  test('le nom d’un groupe de présence est stable : le filtre et l’ordre reçu ne le changent pas ; les autres colonnes n’ont pas de détails', () => {
    const toutes = lignesGrille(liste, { tri: null, filtre: '' }, cleNormalisee);
    const filtrees = lignesGrille(liste, { tri: null, filtre: 'brindelle' }, cleNormalisee);
    const [seul] = groupesGrille(filtrees, ['presence'], { tri: null, cleNormalisee, statuts: null, toutes });
    assert.deepEqual([seul.cle, seul.cleLibelle, seul.detailsLibelle, ids(seul.lignes)], ['presence:001,003', 'participants.presence.tours', { tours: [1, 3] }, [6]]);
    const renverses = groupesGrille([...toutes].reverse(), ['presence'], { tri: null, cleNormalisee, statuts: null });
    assert.deepEqual(renverses.map(({ cle }) => cle), groupesGrille(toutes, ['presence'], { tri: null, cleNormalisee, statuts: null }).map(({ cle }) => cle));
    for (const colonne of GROUPEMENTS.filter((c) => c !== 'presence')) {
      for (const groupe of groupesGrille(toutes, [colonne], { tri: null, cleNormalisee, statuts: new Map() })) assert.equal(groupe.detailsLibelle, null, colonne);
    }
  });

  test('sous-groupée par la présence, une organisation garde ses lignes ; GROUPEMENTS offre la présence', () => {
    assert.ok(GROUPEMENTS.includes('presence'));
    assert.equal(cleDeGroupement('presence'), 'participants.colonne.presence');
    const lignes = lignesGrille(liste, { tri: null, filtre: '' }, cleNormalisee);
    const [groupe] = groupesGrille(lignes, ['exclu', 'presence'], { tri: null, cleNormalisee, statuts: null });
    assert.deepEqual(groupe.sousGroupes.map(({ cle }) => cle), ['exclu:non/presence:tous', 'exclu:non/presence:001,002', 'exclu:non/presence:001,003', 'exclu:non/presence:002']);
  });

  test('commandeDeCellule : changerPresence pour la présence, modifierParticipant sur ce seul champ sinon', () => {
    assert.deepEqual(commandeDeCellule('presence', 4, [1, 3]), { nom: 'changerPresence', args: { id: 4, tours: [1, 3] } });
    assert.deepEqual(commandeDeCellule('presence', 4, null), { nom: 'changerPresence', args: { id: 4, tours: null } });
    assert.deepEqual(commandeDeCellule('courriel', 2, 'iris@exemple.test'), {
      nom: 'modifierParticipant',
      args: { id: 2, champs: { courriel: 'iris@exemple.test' } },
    });
    assert.deepEqual(commandeDeCellule('notes', 9, ''), { nom: 'modifierParticipant', args: { id: 9, champs: { notes: '' } } });
  });
});

describe('celluleSuivante : flèches, Tab, Maj+Tab (§ 10.2)', () => {
  const taille = { lignes: 3, colonnes: 4 };

  test('les flèches bougent d’une cellule et restent sur place au bord', () => {
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 1 }, 'ArrowDown', taille), { ligne: 2, colonne: 1 });
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 1 }, 'ArrowUp', taille), { ligne: 0, colonne: 1 });
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 1 }, 'ArrowRight', taille), { ligne: 1, colonne: 2 });
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 1 }, 'ArrowLeft', taille), { ligne: 1, colonne: 0 });
    assert.deepEqual(celluleSuivante({ ligne: 0, colonne: 0 }, 'ArrowUp', taille), { ligne: 0, colonne: 0 });
    assert.deepEqual(celluleSuivante({ ligne: 0, colonne: 0 }, 'ArrowLeft', taille), { ligne: 0, colonne: 0 });
    assert.deepEqual(celluleSuivante({ ligne: 2, colonne: 3 }, 'ArrowDown', taille), { ligne: 2, colonne: 3 });
    assert.deepEqual(celluleSuivante({ ligne: 2, colonne: 3 }, 'ArrowRight', taille), { ligne: 2, colonne: 3 });
  });

  test('Tab avance dans la ligne puis passe au début de la suivante ; Maj+Tab recule de même', () => {
    assert.deepEqual(celluleSuivante({ ligne: 0, colonne: 2 }, 'Tab', taille), { ligne: 0, colonne: 3 });
    assert.deepEqual(celluleSuivante({ ligne: 0, colonne: 3 }, 'Tab', taille), { ligne: 1, colonne: 0 });
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 0 }, 'Maj+Tab', taille), { ligne: 0, colonne: 3 });
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 2 }, 'Maj+Tab', taille), { ligne: 1, colonne: 1 });
  });

  test('Tab après la dernière cellule, Maj+Tab avant la première : null, le focus quitte la grille', () => {
    assert.equal(celluleSuivante({ ligne: 2, colonne: 3 }, 'Tab', taille), null);
    assert.equal(celluleSuivante({ ligne: 0, colonne: 0 }, 'Maj+Tab', taille), null);
  });

  test('une autre touche ne bouge rien ; une grille vide n’a pas de cellule', () => {
    assert.deepEqual(celluleSuivante({ ligne: 1, colonne: 1 }, 'Enter', taille), { ligne: 1, colonne: 1 });
    assert.equal(celluleSuivante({ ligne: 0, colonne: 0 }, 'ArrowDown', { lignes: 0, colonnes: 4 }), null);
  });
});

describe('orthographeExistante (§ 10.1, § 10.2)', () => {
  const participants = [
    personne(1, 'Ombrelle', { organisation: 'Club des Merles' }),
    personne(2, 'Pervenche'),
    personne(3, 'Lacasse', { organisation: 'Atelier Grisaille' }),
  ];

  test('« club des  merles » → « Club des Merles », l’orthographe déjà portée', () => {
    assert.equal(orthographeExistante('club des  merles', participants, cleNormalisee), 'Club des Merles');
    assert.equal(orthographeExistante('CLUB DÉS MERLES', participants, cleNormalisee), 'Club des Merles');
  });

  test('null pour une saisie identique, nouvelle, vide ou null ; une organisation null ne se compare pas', () => {
    assert.equal(orthographeExistante('Club des Merles', participants, cleNormalisee), null);
    assert.equal(orthographeExistante(' Club des Merles ', participants, cleNormalisee), null);
    assert.equal(orthographeExistante('Cercle des Saules', participants, cleNormalisee), null);
    assert.equal(orthographeExistante('', participants, cleNormalisee), null);
    assert.equal(orthographeExistante('   ', participants, cleNormalisee), null);
    assert.equal(orthographeExistante(null, participants, cleNormalisee), null);
  });

  test('une saisie déjà portée telle quelle par une personne ne propose rien, même quand une autre l’écrit autrement', () => {
    const deux = [...participants, personne(4, 'Grisaille', { organisation: 'club des merles' })];
    assert.equal(orthographeExistante('club des merles', deux, cleNormalisee), null);
    assert.equal(orthographeExistante('Club Des Merles', deux, cleNormalisee), 'Club des Merles');
  });
});

describe("itineraire : la personne dans le retenu, tour par tour (§ 7.4)", () => {
  // Un état de places écrit à la main, réduit à ce que lit itineraire.
  const etat = (source, siegesAttribues, tables, reserve, absents = []) => ({ source, siegesAttribues, tables, reserve, absents });
  const tableDe = (numero, occupants) => ({
    id: numero * 10,
    numero,
    chaises: occupants.map((occupant, rang) => ({ siege: rang + 1, occupant })),
  });

  test('à la table 4, siège 2, au tour 1, en réserve au tour 2', () => {
    const etats = new Map([
      [1, etat('retenu', true, [tableDe(3, [1, 2]), tableDe(4, [5, 7])], [])],
      [2, etat('retenu', true, [tableDe(3, [1, 2]), tableDe(4, [5, null])], [7])],
    ]);
    assert.deepEqual(itineraire(7, 2, (r) => etats.get(r)), [
      { tour: 1, numero: 4, siege: 2 },
      { tour: 2, reserve: true },
    ]);
  });

  test('sièges non attribués : siège null', () => {
    const etats = new Map([[1, etat('retenu', false, [tableDe(4, [5, 7])], [])]]);
    assert.deepEqual(itineraire(7, 1, (r) => etats.get(r)), [{ tour: 1, numero: 4, siege: null }]);
  });

  test('un tour que le retenu ne porte pas — tours haussés après la retenue — se dit hors du retenu ; les tours du retenu restent (§ 9)', () => {
    const retenu = etat('retenu', true, [tableDe(4, [7])], []);
    for (const source of ['reservations', 'proposition']) {
      const etats = new Map([
        [1, retenu],
        [2, retenu],
        [3, etat('retenu', true, [tableDe(4, [5])], [7])],
        [4, etat(source, true, [tableDe(4, [7])], [])],
      ]);
      assert.deepEqual(
        itineraire(7, 4, (r) => etats.get(r)),
        [
          { tour: 1, numero: 4, siege: 1 },
          { tour: 2, numero: 4, siege: 1 },
          { tour: 3, reserve: true },
          { tour: 4, horsRetenu: true },
        ],
        source,
      );
    }
  });

  test('sans retenu au tour 1 : null, quelle que soit la source des tours suivants', () => {
    const etats = new Map([
      [1, etat('reservations', true, [tableDe(4, [7])], [])],
      [2, etat('retenu', true, [tableDe(4, [7])], [])],
    ]);
    assert.equal(itineraire(7, 2, (r) => etats.get(r)), null);
  });

  test("une personne qu'aucune chaise ne reçoit et qui n'attend pas — exclue — : null", () => {
    const etats = new Map([[1, etat('retenu', true, [tableDe(4, [5])], [6])]]);
    assert.equal(itineraire(7, 1, (r) => etats.get(r)), null);
  });

  test('une personne absente à un tour : l’étape « absente », et l’itinéraire reste ; avant le test « ni assise ni en réserve »', () => {
    const etats = new Map([
      [1, etat('retenu', true, [tableDe(4, [5, null])], [], [7])],
      [2, etat('retenu', true, [tableDe(4, [5, null])], [], [7])],
      [3, etat('retenu', true, [tableDe(4, [5, 7])], [], [])],
      [4, etat('retenu', true, [tableDe(4, [5, null])], [7], [])],
    ]);
    assert.deepEqual(itineraire(7, 4, (r) => etats.get(r)), [
      { tour: 1, absente: true },
      { tour: 2, absente: true },
      { tour: 3, numero: 4, siege: 2 },
      { tour: 4, reserve: true },
    ]);
    // Absente à chaque tour : l'itinéraire le dit tour par tour.
    const partout = new Map([[1, etat('retenu', false, [tableDe(4, [5])], [], [7])]]);
    assert.deepEqual(itineraire(7, 1, (r) => partout.get(r)), [{ tour: 1, absente: true }]);
    // L'absence d'une autre ne change rien à la sienne.
    const autre = new Map([[1, etat('retenu', true, [tableDe(4, [5])], [], [6])]]);
    assert.equal(itineraire(7, 1, (r) => autre.get(r)), null);
  });

  test('lit chaque tour de 1 à tours, une fois', () => {
    const lus = [];
    itineraire(7, 3, (r) => {
      lus.push(r);
      return etat('retenu', true, [tableDe(1, [7])], []);
    });
    assert.deepEqual(lus, [1, 2, 3]);
  });
});

describe('reservationsDe : les réservations d’une personne, pour la fiche (§ 4)', () => {
  test('les siennes, dans l’ordre de la charge, la table par son numéro affiché', () => {
    const charge = {
      tables: [
        { id: 1, numero: 3 },
        { id: 2, numero: 1 },
      ],
      reservations: [
        { participant: 7, table: 2, siege: null, portee: 'tous', tour: null },
        { participant: 8, table: 1, siege: 1, portee: 'tous', tour: null },
        { participant: 7, table: 1, siege: 4, portee: 'tour', tour: 2 },
      ],
    };
    assert.deepEqual(reservationsDe(charge, 7), [
      { numero: 1, siege: null, portee: 'tous', tour: null },
      { numero: 3, siege: 4, portee: 'tour', tour: 2 },
    ]);
    assert.deepEqual(reservationsDe(charge, 9), []);
  });
});

describe("les colonnes de la grille s'associent à l'export par leur champ (§ 10.2)", () => {
  test('huit colonnes, la présence juste après l’exclusion ; chacune a son champ d’export, sous son en-tête', () => {
    assert.deepEqual(COLONNES, ['nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'exclu', 'presence', 'notes']);
    assert.ok(Object.isFrozen(COLONNES));
    assert.deepEqual([...CHAMP_DE_COLONNE.keys()], COLONNES);
    assert.equal(CHAMP_DE_COLONNE.get('titrePressenti'), 'titre_pressenti');
    for (const colonne of COLONNES.filter((c) => c !== 'titrePressenti')) assert.equal(CHAMP_DE_COLONNE.get(colonne), colonne);
  });

  test('la cellule exportée sous l’en-tête du champ de chaque colonne égale celle de la grille : exclu écrit « non », la présence écrite par ecrirePresence', () => {
    const base = {
      id: 1,
      nom: 'Ombrelle',
      prenom: 'Iris',
      organisation: 'Club des Merles',
      courriel: 'iris@exemple.test',
      titrePressenti: 'hôtesse',
      notes: 'arrive à neuf heures',
      exclu: false,
      etiquettes: ['Montréal', 'finance'],
    };
    for (const presence of [[2, 3], [1, 2, 3, 5], undefined]) {
      const p = presence === undefined ? base : { ...base, presence };
      const { texte } = decoder(exporterParticipants([p]));
      const [entete, ligne] = texte.split('\r\n');
      const colonnesExport = entete.split(';');
      const cellules = ligne.split(';');
      for (const colonne of COLONNES) {
        const rang = colonnesExport.indexOf(CHAMP_DE_COLONNE.get(colonne));
        assert.ok(rang >= 0, colonne);
        const attendue = colonne === 'exclu' ? 'non' : colonne === 'presence' ? ecrirePresence(p.presence) : p[colonne];
        assert.equal(cellules[rang], attendue, `${colonne} ${JSON.stringify(presence)}`);
      }
    }
    assert.equal(ecrirePresence([1, 2, 3, 5]), '1-3, 5');
    assert.equal(ecrirePresence(undefined), '');
  });

  test('l’export compte une colonne de plus que la grille, les étiquettes, qu’elle ne montre pas ; la présence l’y suit, en dernier', () => {
    const p = {
      id: 1,
      nom: 'Ombrelle',
      prenom: 'Iris',
      organisation: null,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
      etiquettes: ['Montréal', 'finance'],
      presence: [2, 3],
    };
    const { texte } = decoder(exporterParticipants([p]));
    const [entete, ligne] = texte.split('\r\n');
    const cellules = ligne.split(';');
    assert.equal(cellules.length, COLONNES.length + 1);
    assert.deepEqual(entete.split(';').slice(-2), ['etiquettes', 'presence']);
    assert.deepEqual(cellules.slice(-2), ['Montréal, finance', '2, 3']);
    assert.ok(!COLONNES.includes('etiquettes'));
  });

  test('le nom proposé à l’enregistrement : ‹base›-participants.csv', () => {
    assert.equal(nomExport('soiree-des-merles'), 'soiree-des-merles-participants.csv');
  });

  test('chaque colonne et chaque statut ont leur clé de libellé', () => {
    assert.deepEqual(
      COLONNES.map(cleDeColonne),
      COLONNES.map((colonne) => `participants.colonne.${colonne}`),
    );
    assert.equal(cleDeStatut('ancre'), 'participants.statut.ancre');
    assert.equal(cleDeStatut('partiel'), 'participants.statut.partiel');
    assert.equal(cleDeStatut('mobile'), 'participants.statut.mobile');
    assert.throws(() => cleDeColonne('id'), RangeError);
    assert.throws(() => cleDeStatut('exclu'), RangeError);
  });
});

describe('entreeValide : Entrée valide, Maj+Entrée garde le saut de ligne des notes (§ 10.2, § 10.3)', () => {
  test('Entrée seule valide, dans un champ d’une ligne comme dans une zone de texte', () => {
    assert.equal(entreeValide({ maj: false, multiligne: false }), true);
    assert.equal(entreeValide({ maj: false, multiligne: true }), true);
  });

  test('Maj+Entrée ne valide pas une zone de texte : elle y insère un saut de ligne', () => {
    assert.equal(entreeValide({ maj: true, multiligne: true }), false);
  });

  test('Maj+Entrée valide un champ d’une ligne, qui n’a pas de saut de ligne', () => {
    assert.equal(entreeValide({ maj: true, multiligne: false }), true);
  });
});

describe('groupesGrille : la liste groupée par une colonne', () => {
  // Les lignes de la grille, triées et filtrées comme la section les rend.
  const lignesDe = (liste, { tri = null, filtre = '' } = {}) => lignesGrille(liste, { tri, filtre }, cleNormalisee);
  const grouper = (lignes, colonne, { tri = null, statuts = null } = {}) => groupesGrille(lignes, [colonne], { tri, cleNormalisee, statuts });
  // Chaque groupe réduit à sa clé, son libellé, son compte et ses lignes.
  const resume = (groupes) =>
    groupes.map(({ cle, libelle, cleLibelle, compte, lignes }) => ({ cle, libelle, cleLibelle, compte, ids: ids(lignes) }));

  const membres = [
    personne(5, 'Lisonnet', { organisation: 'club des  merles' }),
    personne(4, 'Grisaille'),
    personne(3, 'Ombrelle', { organisation: 'Club des Merles' }),
    personne(2, 'Lacasse', { organisation: 'Cercle des Pinsons' }),
    personne(1, 'Pervenche', { organisation: 'CLUB DES MERLES' }),
  ];

  test('les colonnes groupables : celles de la grille, puis le statut calculé, chacune avec sa clé de libellé', () => {
    assert.deepEqual(GROUPEMENTS, [...COLONNES, 'statut']);
    assert.ok(GROUPEMENTS.length > 0);
    for (const colonne of COLONNES) assert.equal(cleDeGroupement(colonne), cleDeColonne(colonne), colonne);
    assert.equal(cleDeGroupement('statut'), 'participants.groupe.statut');
    assert.throws(() => cleDeGroupement('id'), RangeError);
  });

  test('par organisation : un groupe par clé normalisée, nommé par l’orthographe du plus petit identifiant ; le groupe vide en dernier', () => {
    assert.deepEqual(resume(grouper(lignesDe(membres), 'organisation')), [
      { cle: 'texte:cercle des pinsons', libelle: 'Cercle des Pinsons', cleLibelle: null, compte: 1, ids: [2] },
      { cle: 'texte:club des merles', libelle: 'CLUB DES MERLES', cleLibelle: null, compte: 3, ids: [1, 3, 5] },
      { cle: 'vide', libelle: null, cleLibelle: 'participants.groupe.vide', compte: 1, ids: [4] },
    ]);
  });

  test('le libellé ne dépend pas du tri : le plus petit identifiant le donne, croissant comme décroissant', () => {
    for (const sens of ['croissant', 'decroissant']) {
      const lignes = lignesDe(membres, { tri: { colonne: 'nom', sens } });
      const merles = grouper(lignes, 'organisation').find(({ cle }) => cle === 'texte:club des merles');
      assert.equal(merles.libelle, 'CLUB DES MERLES', sens);
    }
  });

  test('le libellé ne dépend pas du filtre : toutes les lignes, avant le filtre, nomment chaque groupe, à chaque niveau', () => {
    // Le filtre ne garde qu'une personne du groupe, qui n'en est pas le plus petit identifiant.
    const filtrees = lignesDe(membres, { filtre: 'ombrelle' });
    assert.deepEqual(ids(filtrees), [3]);
    assert.equal(grouper(filtrees, 'organisation')[0].libelle, 'Club des Merles');
    const toutes = lignesDe(membres);
    const options = { tri: null, cleNormalisee, statuts: null, toutes };
    assert.deepEqual(resume(groupesGrille(filtrees, ['organisation'], options)), [
      { cle: 'texte:club des merles', libelle: 'CLUB DES MERLES', cleLibelle: null, compte: 1, ids: [3] },
    ]);
    const [present] = groupesGrille(filtrees, ['exclu', 'organisation'], options);
    assert.deepEqual(resume(present.sousGroupes), [
      { cle: 'exclu:non/texte:club des merles', libelle: 'CLUB DES MERLES', cleLibelle: null, compte: 1, ids: [3] },
    ]);
    // Sans filtre, les mêmes groupes que sans l'option.
    assert.deepEqual(groupesGrille(toutes, ['organisation'], options), grouper(toutes, 'organisation'));
  });

  test('trié par la colonne groupée, les groupes suivent son sens ; le groupe vide reste après toute valeur', () => {
    const tri = { colonne: 'organisation', sens: 'decroissant' };
    const groupes = grouper(lignesDe(membres, { tri }), 'organisation', { tri });
    assert.deepEqual(
      groupes.map(({ cle }) => cle),
      ['texte:club des merles', 'texte:cercle des pinsons', 'vide'],
    );
  });

  test('trié par une autre colonne, les groupes sont croissants et chaque groupe garde l’ordre du tri', () => {
    const tri = { colonne: 'nom', sens: 'decroissant' };
    const groupes = grouper(lignesDe(membres, { tri }), 'organisation', { tri });
    assert.deepEqual(resume(groupes).map(({ cle, ids: suite }) => [cle, suite]), [
      ['texte:cercle des pinsons', [2]],
      ['texte:club des merles', [1, 3, 5]],
      ['vide', [4]],
    ]);
    const parNom = grouper(lignesDe(membres, { tri: { colonne: 'nom', sens: 'croissant' } }), 'organisation');
    assert.deepEqual(parNom[1].lignes.map(({ nom }) => nom), ['Lisonnet', 'Ombrelle', 'Pervenche']);
  });

  test('le filtre passe d’abord : un groupe sans ligne disparaît, et chaque compte est celui des lignes montrées', () => {
    const groupes = grouper(lignesDe(membres, { filtre: 'merles' }), 'organisation');
    assert.deepEqual(resume(groupes), [
      { cle: 'texte:club des merles', libelle: 'CLUB DES MERLES', cleLibelle: null, compte: 3, ids: [1, 3, 5] },
    ]);
    const aucun = grouper(lignesDe(membres, { filtre: 'absent' }), 'organisation');
    assert.deepEqual(aucun, []);
  });

  test('chaque colonne de texte groupe par sa clé normalisée, le vide après toute valeur, dans les deux sens', () => {
    const textes = COLONNES.filter((colonne) => !['exclu', 'presence', 'nom'].includes(colonne));
    assert.ok(textes.length > 0);
    for (const colonne of textes) {
      const liste = [
        personne(1, 'Ombrelle', { [colonne]: 'Zinnia' }),
        personne(2, 'Pervenche'),
        personne(3, 'Lacasse', { [colonne]: 'acacia' }),
        personne(4, 'Grisaille', { [colonne]: 'ZINNIA' }),
      ];
      for (const sens of ['croissant', 'decroissant']) {
        const tri = { colonne, sens };
        const groupes = grouper(lignesDe(liste, { tri }), colonne, { tri });
        const attendues = sens === 'croissant' ? ['texte:acacia', 'texte:zinnia', 'vide'] : ['texte:zinnia', 'texte:acacia', 'vide'];
        assert.deepEqual(groupes.map(({ cle }) => cle), attendues, `${colonne} ${sens}`);
        assert.equal(groupes.find(({ cle }) => cle === 'texte:zinnia').libelle, 'Zinnia', `${colonne} ${sens}`);
      }
    }
    // Le nom n'est jamais null : deux homonymes forment un groupe.
    const homonymes = grouper(lignesDe([personne(2, 'Ombrelle'), personne(1, 'OMBRELLE'), personne(3, 'Lacasse')]), 'nom');
    assert.deepEqual(resume(homonymes).map(({ libelle, ids: suite }) => [libelle, suite]), [
      ['Lacasse', [3]],
      ['OMBRELLE', [1, 2]],
    ]);
  });

  test('par exclusion : présentes avant exclues, exclues d’abord quand l’exclusion est triée décroissante', () => {
    const liste = [personne(1, 'Ombrelle', { exclu: true }), personne(2, 'Pervenche'), personne(3, 'Lacasse')];
    assert.deepEqual(resume(grouper(lignesDe(liste), 'exclu')), [
      { cle: 'exclu:non', libelle: null, cleLibelle: 'participants.grille.presente', compte: 2, ids: [2, 3] },
      { cle: 'exclu:oui', libelle: null, cleLibelle: 'participants.grille.exclue', compte: 1, ids: [1] },
    ]);
    const tri = { colonne: 'exclu', sens: 'decroissant' };
    assert.deepEqual(
      grouper(lignesDe(liste, { tri }), 'exclu', { tri }).map(({ cle }) => cle),
      ['exclu:oui', 'exclu:non'],
    );
  });

  test('par statut : ancré, partiellement fixé, mobile, puis exclue, puis non calculé, quel que soit le tri', () => {
    const liste = [
      personne(1, 'Ombrelle'),
      personne(2, 'Pervenche'),
      personne(3, 'Lacasse'),
      personne(4, 'Grisaille', { exclu: true }),
      personne(5, 'Lisonnet'),
      personne(6, 'Brindelle'),
    ];
    // 5 manque aux statuts calculés : une configuration incohérente le
    // laisse non calculé.
    const statuts = new Map([
      [1, 'mobile'],
      [2, 'ancre'],
      [3, 'partiel'],
      [6, 'ancre'],
    ]);
    const attendu = [
      { cle: 'statut:ancre', libelle: null, cleLibelle: 'participants.statut.ancre', compte: 2, ids: [2, 6] },
      { cle: 'statut:partiel', libelle: null, cleLibelle: 'participants.statut.partiel', compte: 1, ids: [3] },
      { cle: 'statut:mobile', libelle: null, cleLibelle: 'participants.statut.mobile', compte: 1, ids: [1] },
      { cle: 'statut:exclue', libelle: null, cleLibelle: 'participants.grille.exclue', compte: 1, ids: [4] },
      { cle: 'statut:inconnu', libelle: null, cleLibelle: 'participants.groupe.statutInconnu', compte: 1, ids: [5] },
    ];
    assert.deepEqual(resume(grouper(lignesDe(liste), 'statut', { statuts })), attendu);
    const tri = { colonne: 'nom', sens: 'decroissant' };
    const triees = grouper(lignesDe(liste, { tri }), 'statut', { tri, statuts });
    assert.deepEqual(triees.map(({ cle }) => cle), attendu.map(({ cle }) => cle));
    assert.deepEqual(ids(triees[0].lignes), [2, 6]);
    // Sans statuts calculés, toute personne présente est non calculée.
    assert.deepEqual(
      grouper(lignesDe(liste), 'statut').map(({ cle, compte }) => [cle, compte]),
      [
        ['statut:exclue', 1],
        ['statut:inconnu', 5],
      ],
    );
  });

  test('l’ordre reçu des participants ne change rien : mêmes groupes, mêmes lignes', () => {
    const renverse = [...membres].reverse();
    const tri = { colonne: 'organisation', sens: 'croissant' };
    assert.deepEqual(resume(grouper(lignesDe(renverse, { tri }), 'organisation', { tri })), resume(grouper(lignesDe(membres, { tri }), 'organisation', { tri })));
  });

  test('chaque ligne dans un seul groupe, aucune perdue ; la liste reçue reste intacte', () => {
    const lignes = lignesDe(membres);
    const copie = structuredClone(lignes);
    assert.ok(GROUPEMENTS.length > 0);
    for (const colonne of GROUPEMENTS) {
      const groupes = grouper(lignes, colonne, { statuts: new Map() });
      const toutes = groupes.flatMap(({ lignes: l }) => ids(l)).sort((a, b) => a - b);
      assert.deepEqual(toutes, [1, 2, 3, 4, 5], colonne);
      assert.ok(groupes.every(({ compte, lignes: l }) => compte === l.length && compte > 0), colonne);
      assert.equal(new Set(groupes.map(({ cle }) => cle)).size, groupes.length, colonne);
    }
    assert.deepEqual(lignes, copie);
  });

  test('une colonne inconnue : RangeError', () => {
    assert.throws(() => grouper(lignesDe(membres), 'id'), RangeError);
  });

  test('un seul niveau : chaque groupe est une feuille, de niveau 1, qui nomme sa colonne', () => {
    const groupes = grouper(lignesDe(membres), 'organisation');
    assert.ok(groupes.length > 0);
    for (const groupe of groupes) {
      assert.equal(groupe.sousGroupes, null, groupe.cle);
      assert.equal(groupe.niveau, 1, groupe.cle);
      assert.equal(groupe.colonne, 'organisation', groupe.cle);
    }
  });
});

describe('groupesGrille sur plusieurs colonnes : des groupes imbriqués', () => {
  const lignesDe = (liste, { tri = null, filtre = '' } = {}) => lignesGrille(liste, { tri, filtre }, cleNormalisee);
  const grouper = (lignes, colonnes, { tri = null, statuts = null } = {}) => groupesGrille(lignes, colonnes, { tri, cleNormalisee, statuts });
  // L'arbre réduit à ce qui se lit : clé, niveau, colonne, libellé,
  // compte, puis les sous-groupes, ou les lignes d'une feuille.
  const arbre = (groupes) =>
    groupes.map(({ cle, niveau, colonne, libelle, cleLibelle, compte, lignes, sousGroupes }) => ({
      cle,
      niveau,
      colonne,
      libelle,
      cleLibelle,
      compte,
      ...(sousGroupes === null ? { ids: ids(lignes) } : { sous: arbre(sousGroupes) }),
    }));
  const feuilles = (groupes) => groupes.flatMap((g) => (g.sousGroupes === null ? [g] : feuilles(g.sousGroupes)));
  const tous = (groupes) => groupes.flatMap((g) => [g, ...(g.sousGroupes === null ? [] : tous(g.sousGroupes))]);

  const liste = [
    personne(5, 'Lisonnet', { organisation: 'club des merles' }),
    personne(4, 'Grisaille'),
    personne(3, 'Lacasse', { organisation: 'Cercle des Pinsons' }),
    personne(2, 'Pervenche', { organisation: 'CLUB DES MERLES', exclu: true }),
    personne(1, 'Ombrelle', { organisation: 'Club des Merles' }),
  ];
  const statuts = new Map([
    [1, 'ancre'],
    [3, 'mobile'],
    [4, 'mobile'],
    [5, 'mobile'],
  ]);

  test('organisation puis statut : chaque groupe d’organisation porte ses groupes de statut, la clé d’un sous-groupe prolonge celle de son parent', () => {
    const merles = 'texte:club des merles';
    const pinsons = 'texte:cercle des pinsons';
    assert.deepEqual(arbre(grouper(lignesDe(liste), ['organisation', 'statut'], { statuts })), [
      {
        cle: pinsons,
        niveau: 1,
        colonne: 'organisation',
        libelle: 'Cercle des Pinsons',
        cleLibelle: null,
        compte: 1,
        sous: [{ cle: `${pinsons}/statut:mobile`, niveau: 2, colonne: 'statut', libelle: null, cleLibelle: 'participants.statut.mobile', compte: 1, ids: [3] }],
      },
      {
        cle: merles,
        niveau: 1,
        colonne: 'organisation',
        libelle: 'Club des Merles',
        cleLibelle: null,
        compte: 3,
        sous: [
          { cle: `${merles}/statut:ancre`, niveau: 2, colonne: 'statut', libelle: null, cleLibelle: 'participants.statut.ancre', compte: 1, ids: [1] },
          { cle: `${merles}/statut:mobile`, niveau: 2, colonne: 'statut', libelle: null, cleLibelle: 'participants.statut.mobile', compte: 1, ids: [5] },
          { cle: `${merles}/statut:exclue`, niveau: 2, colonne: 'statut', libelle: null, cleLibelle: 'participants.grille.exclue', compte: 1, ids: [2] },
        ],
      },
      {
        cle: 'vide',
        niveau: 1,
        colonne: 'organisation',
        libelle: null,
        cleLibelle: 'participants.groupe.vide',
        compte: 1,
        sous: [{ cle: 'vide/statut:mobile', niveau: 2, colonne: 'statut', libelle: null, cleLibelle: 'participants.statut.mobile', compte: 1, ids: [4] }],
      },
    ]);
  });

  test('un groupe parent garde toutes ses lignes dans l’ordre reçu ; son compte est la somme de ceux de ses sous-groupes', () => {
    const groupes = grouper(lignesDe(liste), ['organisation', 'statut'], { statuts });
    const merles = groupes.find(({ cle }) => cle === 'texte:club des merles');
    assert.deepEqual(ids(merles.lignes), [1, 2, 5]);
    for (const groupe of tous(groupes)) {
      if (groupe.sousGroupes === null) continue;
      assert.equal(groupe.compte, groupe.sousGroupes.reduce((somme, { compte }) => somme + compte, 0), groupe.cle);
    }
  });

  test('chaque niveau s’ordonne sur sa colonne : dans le sens du tri quand il la trie, croissant sinon', () => {
    const tri = { colonne: 'organisation', sens: 'decroissant' };
    const groupes = grouper(lignesDe(liste, { tri }), ['statut', 'organisation'], { tri, statuts });
    assert.deepEqual(
      groupes.map(({ cle }) => cle),
      ['statut:ancre', 'statut:mobile', 'statut:exclue'],
    );
    assert.deepEqual(
      groupes[1].sousGroupes.map(({ cle }) => cle),
      ['statut:mobile/texte:club des merles', 'statut:mobile/texte:cercle des pinsons', 'statut:mobile/vide'],
    );
    const croissants = grouper(lignesDe(liste), ['statut', 'organisation'], { statuts });
    assert.deepEqual(
      croissants[1].sousGroupes.map(({ cle }) => cle),
      ['statut:mobile/texte:cercle des pinsons', 'statut:mobile/texte:club des merles', 'statut:mobile/vide'],
    );
  });

  test('toute paire de colonnes : chaque ligne dans une seule feuille, aucune perdue, des clés uniques à tout niveau, d’autant de segments que le niveau', () => {
    const lignes = lignesDe(liste);
    const copie = structuredClone(lignes);
    let paires = 0;
    for (const premiere of GROUPEMENTS) {
      for (const seconde of GROUPEMENTS) {
        if (premiere === seconde) continue;
        paires += 1;
        const groupes = grouper(lignes, [premiere, seconde], { statuts });
        const cas = `${premiere} puis ${seconde}`;
        assert.deepEqual(feuilles(groupes).flatMap(({ lignes: l }) => ids(l)).sort((a, b) => a - b), [1, 2, 3, 4, 5], cas);
        const cles = tous(groupes).map(({ cle }) => cle);
        assert.equal(new Set(cles).size, cles.length, cas);
        for (const groupe of tous(groupes)) assert.equal(groupe.cle.split('/').length, groupe.niveau, `${cas} ${groupe.cle}`);
        assert.ok(feuilles(groupes).every(({ niveau, colonne }) => niveau === 2 && colonne === seconde), cas);
      }
    }
    assert.equal(paires, GROUPEMENTS.length * (GROUPEMENTS.length - 1));
    assert.deepEqual(lignes, copie);
  });

  test('une valeur qui porte « / » ou « % » ne se lit jamais comme un séparateur : sa clé les échappe', () => {
    const portees = [
      personne(1, 'Ombrelle', { organisation: 'Nord/Sud', prenom: 'Iris' }),
      personne(2, 'Pervenche', { organisation: 'Nord', prenom: 'Sud/Iris' }),
      personne(3, 'Lacasse', { organisation: '100%', prenom: 'Iris' }),
    ];
    const groupes = grouper(lignesDe(portees), ['organisation', 'prenom']);
    assert.deepEqual(
      tous(groupes).map(({ cle }) => cle),
      ['texte:100%25', 'texte:100%25/texte:iris', 'texte:nord', 'texte:nord/texte:sud%2Firis', 'texte:nord%2Fsud', 'texte:nord%2Fsud/texte:iris'],
    );
  });

  test('aucune colonne, une colonne répétée, une colonne inconnue, une colonne seule hors d’une liste : RangeError', () => {
    const lignes = lignesDe(liste);
    assert.throws(() => grouper(lignes, []), RangeError);
    assert.throws(() => grouper(lignes, ['statut', 'statut'], { statuts }), RangeError);
    assert.throws(() => grouper(lignes, ['organisation', 'id']), RangeError);
    assert.throws(() => grouper(lignes, 'organisation'), RangeError);
  });
});

describe('lignesVisibles, cheminDe : les groupes repliés et la navigation', () => {
  const liste = [
    personne(1, 'Ombrelle', { organisation: 'Club des Merles' }),
    personne(2, 'Pervenche', { organisation: 'Cercle des Pinsons' }),
    personne(3, 'Lacasse', { organisation: 'Club des Merles' }),
    personne(4, 'Grisaille'),
    personne(5, 'Lisonnet', { organisation: 'Atelier des Grives' }),
  ];
  const groupes = groupesGrille(lignesGrille(liste, { tri: null, filtre: '' }, cleNormalisee), ['organisation'], {
    tri: null,
    cleNormalisee,
    statuts: null,
  });

  test('sans groupe replié, les lignes de chaque groupe, groupe après groupe', () => {
    assert.deepEqual(ids(lignesVisibles(groupes, new Set())), [5, 2, 1, 3, 4]);
  });

  test('un groupe replié retire exactement ses lignes ; tout replier n’en laisse aucune', () => {
    assert.deepEqual(ids(lignesVisibles(groupes, new Set(['texte:cercle des pinsons']))), [5, 1, 3, 4]);
    assert.deepEqual(ids(lignesVisibles(groupes, new Set(['texte:club des merles', 'vide']))), [5, 2]);
    assert.deepEqual(lignesVisibles(groupes, new Set(groupes.map(({ cle }) => cle))), []);
    // Une clé sans groupe ne retire rien.
    assert.deepEqual(ids(lignesVisibles(groupes, new Set(['texte:absent']))), [5, 2, 1, 3, 4]);
  });

  test('celluleSuivante sur les lignes visibles passe par-dessus un groupe replié', () => {
    const visibles = lignesVisibles(groupes, new Set(['texte:cercle des pinsons']));
    const taille = { lignes: visibles.length, colonnes: COLONNES.length };
    const depuis = { ligne: ids(visibles).indexOf(5), colonne: 2 };
    const arrivee = celluleSuivante(depuis, 'ArrowDown', taille);
    assert.equal(visibles[arrivee.ligne].id, 1);
    const fin = celluleSuivante({ ligne: visibles.length - 1, colonne: COLONNES.length - 1 }, 'Tab', taille);
    assert.equal(fin, null);
  });

  test('basculerGroupe : replie un groupe déplié, déplie un groupe replié, sans toucher l’ensemble reçu', () => {
    const replies = new Set(['vide']);
    assert.deepEqual([...basculerGroupe(replies, 'texte:club des merles')], ['vide', 'texte:club des merles']);
    assert.deepEqual([...basculerGroupe(replies, 'vide')], []);
    assert.deepEqual([...replies], ['vide']);
  });

  test('deplierChemin : retire des repliés chaque clé du chemin ; sans clé repliée sur le chemin, l’ensemble reçu lui-même', () => {
    const replies = new Set(['vide', 'texte:club des merles', 'texte:cercle des pinsons']);
    const deplies = deplierChemin(replies, cheminDe(groupes, 3));
    assert.deepEqual([...deplies], ['vide', 'texte:cercle des pinsons']);
    assert.deepEqual([...replies], ['vide', 'texte:club des merles', 'texte:cercle des pinsons']);
    // Rien à déplier : le même ensemble, que la grille ne réécrit pas.
    assert.equal(deplierChemin(deplies, cheminDe(groupes, 3)), deplies);
    assert.equal(deplierChemin(replies, []), replies);
  });

  test('clesPremierNiveau : les clés des groupes du premier niveau, dans leur ordre, sans leurs sous-groupes', () => {
    assert.deepEqual(clesPremierNiveau(groupes), groupes.map(({ cle }) => cle));
    assert.deepEqual(clesPremierNiveau([]), []);
  });

  test('ligneVoisine : le rang qu’une ligne sortie de la liste laisse à sa suivante, la dernière quand elle fermait la liste ; null sur une liste vide', () => {
    assert.equal(ligneVoisine(0, 3), 0);
    assert.equal(ligneVoisine(2, 3), 2);
    assert.equal(ligneVoisine(3, 3), 2);
    assert.equal(ligneVoisine(5, 1), 0);
    assert.equal(ligneVoisine(0, 0), null);
  });

  test('cheminDe : la clé du groupe d’une personne, vide hors de tout groupe', () => {
    assert.deepEqual(cheminDe(groupes, 3), ['texte:club des merles']);
    assert.deepEqual(cheminDe(groupes, 4), ['vide']);
    assert.deepEqual(cheminDe(groupes, 99), []);
  });

  // Les mêmes personnes groupées par organisation puis par prénom.
  const imbriques = groupesGrille(
    lignesGrille(
      liste.map((p) => ({ ...p, prenom: p.id % 2 === 0 ? 'Iris' : 'Théo' })),
      { tri: null, filtre: '' },
      cleNormalisee,
    ),
    ['organisation', 'prenom'],
    { tri: null, cleNormalisee, statuts: null },
  );
  const MERLES = 'texte:club des merles';

  test('imbriqués : clesPremierNiveau ne rend aucun sous-groupe ; deplierChemin déplie chaque niveau du chemin', () => {
    const premiers = clesPremierNiveau(imbriques);
    assert.deepEqual(premiers, imbriques.map(({ cle }) => cle));
    assert.ok(premiers.every((cle) => !cle.includes('/')));
    const chemin = cheminDe(imbriques, 3);
    assert.equal(chemin.length, 2);
    assert.deepEqual([...deplierChemin(new Set([...chemin, 'vide']), chemin)], ['vide']);
  });

  test('imbriqués : les lignes visibles suivent les sous-groupes ; replier un sous-groupe ne retire que les siennes, replier son parent retire tout le parent', () => {
    assert.deepEqual(ids(lignesVisibles(imbriques, new Set())), [5, 2, 1, 3, 4]);
    assert.deepEqual(ids(lignesVisibles(imbriques, new Set([`${MERLES}/texte:theo`]))), [5, 2, 4]);
    assert.deepEqual(ids(lignesVisibles(imbriques, new Set([MERLES]))), [5, 2, 4]);
    // Un sous-groupe déplié sous un parent replié reste caché.
    assert.deepEqual(ids(lignesVisibles(imbriques, new Set([MERLES, 'vide/texte:iris']))), [5, 2]);
  });

  test('cheminDe imbriqué : les clés de chaque groupe qui compte la personne, du plus large au plus étroit', () => {
    assert.deepEqual(cheminDe(imbriques, 3), [MERLES, `${MERLES}/texte:theo`]);
    assert.deepEqual(cheminDe(imbriques, 4), ['vide', 'vide/texte:iris']);
    assert.deepEqual(cheminDe(imbriques, 99), []);
  });
});

describe('choisirGroupement, niveauxAffiches, colonnesOffertes : les niveaux du groupement', () => {
  test('choisir une colonne au premier niveau libre l’ajoute ; la valeur vide à un niveau le retire, lui et ceux d’après', () => {
    assert.deepEqual(choisirGroupement([], 0, 'organisation'), ['organisation']);
    assert.deepEqual(choisirGroupement(['organisation'], 1, 'statut'), ['organisation', 'statut']);
    assert.deepEqual(choisirGroupement(['organisation', 'statut', 'nom'], 1, ''), ['organisation']);
    assert.deepEqual(choisirGroupement(['organisation', 'statut'], 0, ''), []);
  });

  test('changer la colonne d’un niveau garde les suivants, hors celle qui y était déjà', () => {
    assert.deepEqual(choisirGroupement(['organisation', 'statut', 'nom'], 0, 'prenom'), ['prenom', 'statut', 'nom']);
    assert.deepEqual(choisirGroupement(['organisation', 'statut', 'nom'], 0, 'statut'), ['statut', 'nom']);
    assert.deepEqual(choisirGroupement(['organisation', 'statut', 'nom'], 1, 'nom'), ['organisation', 'nom']);
  });

  test('ne modifie pas le groupement reçu ; une colonne inconnue, une prise plus haut, un niveau au-delà du premier libre : RangeError', () => {
    const groupement = Object.freeze(['organisation', 'statut']);
    choisirGroupement(groupement, 1, 'nom');
    assert.deepEqual(groupement, ['organisation', 'statut']);
    assert.throws(() => choisirGroupement(groupement, 1, 'id'), RangeError);
    assert.throws(() => choisirGroupement(groupement, 1, 'organisation'), RangeError);
    assert.throws(() => choisirGroupement(groupement, 3, 'nom'), RangeError);
    assert.throws(() => choisirGroupement(groupement, -1, 'nom'), RangeError);
  });

  test('les niveaux affichés : un par colonne choisie, puis le suivant tant qu’une colonne reste libre', () => {
    assert.deepEqual(niveauxAffiches([]), [0]);
    assert.deepEqual(niveauxAffiches(['organisation', 'statut']), [0, 1, 2]);
    assert.deepEqual(niveauxAffiches(GROUPEMENTS.slice(0, -1)), GROUPEMENTS.map((_, rang) => rang));
    assert.deepEqual(niveauxAffiches(GROUPEMENTS), GROUPEMENTS.map((_, rang) => rang));
  });

  test('les colonnes offertes à un niveau : celles de GROUPEMENTS, dans leur ordre, hors celles des niveaux plus larges', () => {
    assert.deepEqual(colonnesOffertes([], 0), GROUPEMENTS);
    assert.deepEqual(colonnesOffertes(['organisation', 'statut'], 0), GROUPEMENTS);
    assert.deepEqual(colonnesOffertes(['organisation', 'statut'], 1), GROUPEMENTS.filter((c) => c !== 'organisation'));
    assert.deepEqual(colonnesOffertes(['organisation', 'statut'], 2), GROUPEMENTS.filter((c) => c !== 'organisation' && c !== 'statut'));
  });
});
