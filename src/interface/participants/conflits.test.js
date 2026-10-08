// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les conflits du placement montré dans la liste groupée (§ 7.5, § 10.2) :
// les conflits de chaque groupe, de tout niveau, les règles de chaque
// personne, les lignes de conflit nommées et leurs textes. Les noms
// d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { cleNormalisee } from '../../application/csv.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { REGLES, cleDeRaison, conflitsDesGroupes, lignesDeConflit, reglesParPersonne } from './conflits.js';
import { groupesGrille, lignesGrille } from './grille.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const personne = (id, nom, prenom, appartenance, exclu = false) => ({
  id,
  nom,
  prenom,
  appartenance,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu,
});

// 1 et 2 du Club des Merles, 3 et 4 des Pinsons, 5 sans appartenance.
const PERSONNES = [
  personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
  personne(2, 'Fontaine', 'Noé', 'Club des Merles'),
  personne(3, 'Pervenche', 'Théo', 'Pinsons'),
  personne(4, 'Lacasse', 'Ondine', 'Pinsons'),
  personne(5, 'Grisaille', null, null),
];

const conflit = (tour, table, numero, regle, personnes, deja = []) => ({ tour, table, numero, regle, personnes, deja });

// Une paire de collègues des Merles, une paire revue qui traverse les
// Merles et les Pinsons, une personne revenue sans appartenance.
const C1 = conflit(1, 1, 4, 'separerAppartenances', [1, 2]);
const C2 = conflit(2, 2, 1, 'nouveauxVoisins', [2, 3], [{ tour: 1, numero: 4 }]);
const C3 = conflit(2, 1, 4, 'nouvelleTable', [5], [{ tour: 1, numero: 4 }]);
const CONFLITS = [C1, C2, C3];

const lignes = lignesGrille(PERSONNES, { tri: null, filtre: '' }, cleNormalisee);
const grouper = (colonnes, de = lignes) => groupesGrille(de, colonnes, { tri: null, cleNormalisee, statuts: null });
const cleDe = (groupes, libelle) => groupes.find((g) => (g.libelle ?? g.cleLibelle) === libelle).cle;

describe('conflitsDesGroupes : les conflits de chaque groupe, de tout niveau', () => {
  test('par appartenance : chaque groupe a les conflits qui touchent l’une de ses lignes, dans l’ordre reçu ; un conflit entre deux groupes paraît dans chacun', () => {
    const groupes = grouper(['appartenance']);
    assert.equal(groupes.length, 3);
    const parGroupe = conflitsDesGroupes(groupes, CONFLITS);
    assert.deepEqual(parGroupe.get(cleDe(groupes, 'Club des Merles')), [C1, C2]);
    assert.deepEqual(parGroupe.get(cleDe(groupes, 'Pinsons')), [C2]);
    assert.deepEqual(parGroupe.get(cleDe(groupes, 'participants.groupe.vide')), [C3]);
    assert.equal(parGroupe.size, 3);
  });

  test('imbriqués : un parent compte une fois chaque conflit de ses sous-groupes ; un groupe sans conflit n’a pas d’entrée', () => {
    const groupes = grouper(['appartenance', 'prenom']);
    const merles = groupes.find(({ libelle }) => libelle === 'Club des Merles');
    const parGroupe = conflitsDesGroupes(groupes, CONFLITS);
    assert.deepEqual(parGroupe.get(merles.cle), [C1, C2]);
    const [iris, noe] = ['Iris', 'Noé'].map((prenom) => merles.sousGroupes.find(({ libelle }) => libelle === prenom).cle);
    assert.deepEqual(parGroupe.get(iris), [C1]);
    assert.deepEqual(parGroupe.get(noe), [C1, C2]);
    const pinsons = groupes.find(({ libelle }) => libelle === 'Pinsons');
    const ondine = pinsons.sousGroupes.find(({ libelle }) => libelle === 'Ondine').cle;
    assert.equal(parGroupe.has(ondine), false);
    assert.deepEqual(parGroupe.get(pinsons.cle), [C2]);
  });

  test('le filtre passe d’abord : une personne qui n’est plus listée n’attire pas son conflit dans un groupe', () => {
    const filtrees = lignesGrille(PERSONNES, { tri: null, filtre: 'pinsons' }, cleNormalisee);
    const groupes = grouper(['appartenance'], filtrees);
    assert.equal(groupes.length, 1);
    assert.deepEqual([...conflitsDesGroupes(groupes, CONFLITS)], [[groupes[0].cle, [C2]]]);
  });

  test('aucun conflit, ou null : aucune entrée', () => {
    const groupes = grouper(['appartenance']);
    assert.equal(conflitsDesGroupes(groupes, []).size, 0);
    assert.equal(conflitsDesGroupes(groupes, null).size, 0);
  });
});

describe('reglesParPersonne et lignesDeConflit', () => {
  test('les règles de chaque personne en conflit, sans doublon, dans l’ordre de REGLES', () => {
    assert.deepEqual(REGLES, ['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable']);
    const regles = reglesParPersonne([C2, C1, conflit(2, 1, 4, 'nouveauxVoisins', [1, 2]), C3]);
    assert.deepEqual(
      [...regles].sort(([a], [b]) => a - b),
      [
        [1, ['separerAppartenances', 'nouveauxVoisins']],
        [2, ['separerAppartenances', 'nouveauxVoisins']],
        [3, ['nouveauxVoisins']],
        [5, ['nouvelleTable']],
      ],
    );
    assert.equal(reglesParPersonne(null).size, 0);
  });

  test('chaque conflit rend une ligne : clé unique, lieu, personnes et leurs noms affichés dans leur ordre, règle et rencontres antérieures ; null rend null', () => {
    const lignesRendues = lignesDeConflit(CONFLITS, PERSONNES);
    assert.deepEqual(lignesRendues, [
      { cle: '1:1:separerAppartenances:1-2', tour: 1, numero: 4, regle: 'separerAppartenances', personnes: [1, 2], noms: ['Iris Ombrelle', 'Noé Fontaine'], deja: [] },
      {
        cle: '2:2:nouveauxVoisins:2-3',
        tour: 2,
        numero: 1,
        regle: 'nouveauxVoisins',
        personnes: [2, 3],
        noms: ['Noé Fontaine', 'Théo Pervenche'],
        deja: [{ tour: 1, numero: 4 }],
      },
      { cle: '2:1:nouvelleTable:5', tour: 2, numero: 4, regle: 'nouvelleTable', personnes: [5], noms: ['Grisaille'], deja: [{ tour: 1, numero: 4 }] },
    ]);
    assert.equal(lignesDeConflit(null, PERSONNES), null);
    // Les lignes se rangent sous les groupes comme les conflits.
    const groupes = grouper(['appartenance']);
    assert.deepEqual(conflitsDesGroupes(groupes, lignesRendues).get(cleDe(groupes, 'Pinsons')), [lignesRendues[1]]);
  });

  test('la clé de la raison de chaque règle existe ; une autre règle lève', () => {
    for (const regle of REGLES) assert.equal(typeof t(cleDeRaison(regle), { numero: 4, deja: [] }), 'string');
    assert.throws(() => cleDeRaison('varierAppartenances'), RangeError);
  });
});

describe('les textes des conflits', () => {
  test('le lieu, la liaison, les raisons, la marque d’un groupe et celle d’une personne', () => {
    assert.equal(t('participants.conflit.lieu', { tour: 2, numero: 4 }), 'Tour 2, table 4 :');
    assert.equal(t('participants.conflit.et'), 'et');
    assert.equal(t(cleDeRaison('separerAppartenances'), { numero: 4, deja: [] }), '\u{2014} même appartenance');
    assert.equal(t(cleDeRaison('nouveauxVoisins'), { numero: 4, deja: [{ tour: 1, numero: 1 }] }), '\u{2014} se revoient (déjà à la table 1 au tour 1)');
    assert.equal(
      t(cleDeRaison('nouveauxVoisins'), { numero: 4, deja: [{ tour: 1, numero: 1 }, { tour: 3, numero: 2 }] }),
      '\u{2014} se revoient (déjà à la table 1 au tour 1, à la table 2 au tour 3)',
    );
    assert.equal(t(cleDeRaison('nouvelleTable'), { numero: 4, deja: [{ tour: 1, numero: 4 }] }), '\u{2014} revient à la table 4 (déjà au tour 1)');
    assert.equal(
      t(cleDeRaison('nouvelleTable'), { numero: 4, deja: [{ tour: 1, numero: 4 }, { tour: 2, numero: 4 }, { tour: 3, numero: 4 }] }),
      '\u{2014} revient à la table 4 (déjà aux tours 1, 2 et 3)',
    );
    // Sans rencontre antérieure connue, la raison se tait sur elles.
    assert.equal(t(cleDeRaison('nouveauxVoisins'), { numero: 4, deja: [] }), '\u{2014} se revoient');
    assert.equal(t(cleDeRaison('nouvelleTable'), { numero: 4, deja: [] }), '\u{2014} revient à la table 4');
    assert.equal(t('participants.conflit.groupe', { nombre: 1 }), 'en conflit : 1 conflit');
    assert.equal(t('participants.conflit.groupe', { nombre: 3 }), 'en conflit : 3 conflits');
    assert.equal(t('participants.conflit.personne', { regles: ['separerAppartenances'] }), 'en conflit : même appartenance');
    assert.equal(
      t('participants.conflit.personne', { regles: ['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable'] }),
      'en conflit : même appartenance, se revoient, revient à une table',
    );
  });
});
