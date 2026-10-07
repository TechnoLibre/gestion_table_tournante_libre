// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les modules purs de la liste des participants (§ 4, § 7.4, § 10.2) : les
// lignes de la grille, triées et filtrées, la navigation au clavier,
// l'orthographe d'appartenance à reprendre, l'itinéraire d'une personne dans
// le retenu, ses réservations, et l'ordre des colonnes, celui de l'export.
// Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { cleNormalisee, decoder, exporterParticipants } from '../../application/csv.js';
import {
  COLONNES,
  celluleSuivante,
  cleDeColonne,
  cleDeStatut,
  entreeValide,
  itineraire,
  lignesGrille,
  nomExport,
  orthographeExistante,
  reservationsDe,
} from './grille.js';

// Un participant ; les champs absents valent null, exclu faux.
const personne = (id, nom, champs = {}) => ({
  id,
  nom,
  prenom: null,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...champs,
});

const ids = (lignes) => lignes.map(({ id }) => id);

describe('lignesGrille : tri et filtre (§ 10.2)', () => {
  const participants = [
    personne(4, 'Pervenche', { prenom: 'Théo', appartenance: 'CLUB DES MERLES' }),
    personne(1, 'Ombrelle', { prenom: 'Iris', appartenance: 'Club des Merles' }),
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
    const vides = ['prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes'];
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
    personne(1, 'Ombrelle', { appartenance: 'Club des Merles' }),
    personne(2, 'Pervenche'),
    personne(3, 'Lacasse', { appartenance: 'Atelier Grisaille' }),
  ];

  test('« club des  merles » → « Club des Merles », l’orthographe déjà portée', () => {
    assert.equal(orthographeExistante('club des  merles', participants, cleNormalisee), 'Club des Merles');
    assert.equal(orthographeExistante('CLUB DÉS MERLES', participants, cleNormalisee), 'Club des Merles');
  });

  test('null pour une saisie identique, nouvelle, vide ou null ; une appartenance null ne se compare pas', () => {
    assert.equal(orthographeExistante('Club des Merles', participants, cleNormalisee), null);
    assert.equal(orthographeExistante(' Club des Merles ', participants, cleNormalisee), null);
    assert.equal(orthographeExistante('Cercle des Saules', participants, cleNormalisee), null);
    assert.equal(orthographeExistante('', participants, cleNormalisee), null);
    assert.equal(orthographeExistante('   ', participants, cleNormalisee), null);
    assert.equal(orthographeExistante(null, participants, cleNormalisee), null);
  });

  test('une saisie déjà portée telle quelle par une personne ne propose rien, même quand une autre l’écrit autrement', () => {
    const deux = [...participants, personne(4, 'Grisaille', { appartenance: 'club des merles' })];
    assert.equal(orthographeExistante('club des merles', deux, cleNormalisee), null);
    assert.equal(orthographeExistante('Club Des Merles', deux, cleNormalisee), 'Club des Merles');
  });
});

describe("itineraire : la personne dans le retenu, tour par tour (§ 7.4)", () => {
  // Un état de places écrit à la main, réduit à ce que lit itineraire.
  const etat = (source, siegesAttribues, tables, reserve) => ({ source, siegesAttribues, tables, reserve });
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

describe("l'ordre de la grille est celui de l'export (§ 10.2)", () => {
  test('la cellule de rang i de la ligne exportée égale p[COLONNES[i]], exclu écrit « non »', () => {
    const p = {
      id: 1,
      nom: 'Ombrelle',
      prenom: 'Iris',
      appartenance: 'Club des Merles',
      courriel: 'iris@exemple.test',
      titrePressenti: 'hôtesse',
      notes: 'arrive à neuf heures',
      exclu: false,
    };
    const { texte } = decoder(exporterParticipants([p]));
    const [, ligne] = texte.split('\r\n');
    const cellules = ligne.split(';');
    assert.equal(COLONNES.length, 7);
    assert.equal(cellules.length, COLONNES.length);
    COLONNES.forEach((colonne, i) => {
      assert.equal(cellules[i], colonne === 'exclu' ? 'non' : p[colonne], colonne);
    });
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
