// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des inclusions d'un placement (§ 5.4, § 5.8, § 7.5, § 12.15) :
// le modèle de la vue, la source que la liste de travail, la fiche et la
// grille lisent, ce qui concerne une personne, et les inclusions hors
// d'atteinte de sa fiche. Les détails écrits à la main portent des
// identifiants et des organisations inventés ; la source se lit sur une
// démonstration livrée, ses inclusions posées par les commandes, et son
// plan écrit ici.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { analyser, capacite } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  RAISONS,
  auDelaDuPlafond,
  avisNomme,
  cleDeRaison,
  horsDAtteinteDePersonne,
  inclusionsDePersonne,
  inclusionsDuPlacement,
  modeleInclusions,
} from './inclusions.js';

const NOMS = new Map([
  [1, 'Iris Ombrelle'],
  [2, 'Théo Pervenche'],
  [3, 'Ondine Lacasse'],
  [4, 'Anouk Bruyère'],
]);
const nommer = (id) => NOMS.get(id) ?? null;

// Les inclusions nommées d'une ligne écrite à la main : Iris et Ondine se
// demandent l'une l'autre, sans se rencontrer ; Théo n'a rencontré personne
// du Club des Grèbes ; Anouk, au-delà de son plafond, en satisfait 2 sur 6
// atteignables.
const INCLUSIONS = Object.freeze({
  cible: 5,
  satisfaites: 3,
  avis: 2,
  nonSatisfaites: [
    { participant: 1, cible: { participant: 3 }, partenaire: 3, reciproque: true },
    { participant: 2, cible: { organisation: 'Club des Grèbes' }, partenaire: null, reciproque: false },
  ],
  parPersonne: [
    { participant: 1, actives: 2, besoin: 2, plafond: 8, atteignables: 2, satisfaites: 1, auDelaDuPlafond: false },
    { participant: 2, actives: 1, besoin: 1, plafond: 8, atteignables: 1, satisfaites: 0, auDelaDuPlafond: false },
    { participant: 3, actives: 1, besoin: 1, plafond: 8, atteignables: 1, satisfaites: 0, auDelaDuPlafond: false },
    { participant: 4, actives: 9, besoin: 9, plafond: 5, atteignables: 6, satisfaites: 2, auDelaDuPlafond: true },
  ],
});
const HORS_D_ATTEINTE = Object.freeze([
  { participant: 1, cible: { participant: 4 }, raison: 'sansTourCommun' },
  { participant: 1, cible: { organisation: 'Cercle des Pluviers' }, raison: 'sansPresent' },
  { participant: 2, cible: { participant: 1 }, raison: 'conflit' },
]);

describe('les raisons et les avis nommés (§ 4, § 12.15)', () => {
  test('chaque raison a sa clé ; une autre lève', () => {
    assert.deepEqual(RAISONS, ['exclue', 'sansPresent', 'conflit', 'sansTourCommun', 'tablesImposees', 'pleine']);
    for (const raison of RAISONS) assert.equal(cleDeRaison(raison), `qualite.inclusions.raison.${raison}`);
    assert.throws(() => cleDeRaison('absente'), RangeError);
  });

  test('un avis nomme sa source et sa cible, personne ou organisation', () => {
    assert.deepEqual(avisNomme(INCLUSIONS.nonSatisfaites[0], nommer), {
      source: { id: 1, nom: 'Iris Ombrelle' },
      cible: { sorte: 'participant', id: 3, nom: 'Ondine Lacasse' },
      reciproque: true,
    });
    assert.deepEqual(avisNomme(INCLUSIONS.nonSatisfaites[1], nommer).cible, { sorte: 'organisation', nom: 'Club des Grèbes' });
  });

  test('au-delà du plafond : les seules personnes dont la liste dépasse, et leurs inclusions possibles non atteintes', () => {
    assert.deepEqual(auDelaDuPlafond(INCLUSIONS, nommer), [
      { id: 4, nom: 'Anouk Bruyère', actives: 9, besoin: 9, plafond: 5, atteignables: 6, satisfaites: 2, possibles: 4 },
    ]);
  });
});

describe('le modèle de la vue « Inclusions » (§ 12.15, § 12.6)', () => {
  test('sans détail, rien ; sans inclusion active, la phrase, et les hors d’atteinte quand les listes en portent', () => {
    assert.equal(modeleInclusions(null, nommer), null);
    assert.deepEqual(modeleInclusions({ inclusions: null, inclusionsHorsDAtteinte: [] }, nommer), { cas: 'aucun', horsDAtteinte: [] });
    const seules = modeleInclusions({ inclusions: null, inclusionsHorsDAtteinte: HORS_D_ATTEINTE.slice(2) }, nommer);
    assert.deepEqual(seules, {
      cas: 'aucun',
      horsDAtteinte: [
        { source: { id: 2, nom: 'Théo Pervenche' }, cible: { sorte: 'participant', id: 1, nom: 'Iris Ombrelle' }, raison: 'conflit' },
      ],
    });
  });

  test('la synthèse, les avis à place fixe dans leur ordre, puis les listes au-delà et les hors d’atteinte', () => {
    const modele = modeleInclusions({ inclusions: INCLUSIONS, inclusionsHorsDAtteinte: HORS_D_ATTEINTE }, nommer);
    assert.equal(modele.cas, 'inclusions');
    assert.deepEqual(modele.synthese, { avis: 2, cible: 5 });
    assert.deepEqual(
      modele.avis.map(({ source, cible }) => [source.id, cible.nom]),
      [
        [1, 'Ondine Lacasse'],
        [2, 'Club des Grèbes'],
      ],
    );
    assert.deepEqual(modele.auDela.map(({ id, possibles }) => [id, possibles]), [[4, 4]]);
    assert.deepEqual(
      modele.horsDAtteinte.map(({ source, cible, raison }) => [source.nom, cible.nom, raison]),
      [
        ['Iris Ombrelle', 'Anouk Bruyère', 'sansTourCommun'],
        ['Iris Ombrelle', 'Cercle des Pluviers', 'sansPresent'],
        ['Théo Pervenche', 'Iris Ombrelle', 'conflit'],
      ],
    );
  });
});

describe('ce que les inclusions disent d’une personne (§ 7.5, § 10.2)', () => {
  test('ses comptes, et chaque avis qui la nomme, qu’elle le porte ou qu’elle soit la personne incluse', () => {
    const iris = inclusionsDePersonne(INCLUSIONS, 1, nommer);
    assert.deepEqual(iris.compte, { actives: 2, satisfaites: 1 });
    assert.equal(iris.auDela, null);
    assert.equal(iris.avis.length, 1);
    assert.deepEqual(iris.autres, [{ sorte: 'participant', id: 3, nom: 'Ondine Lacasse' }]);
    const ondine = inclusionsDePersonne(INCLUSIONS, 3, nommer);
    assert.deepEqual(ondine.avis, iris.avis);
    assert.deepEqual(ondine.autres, [{ sorte: 'participant', id: 1, nom: 'Iris Ombrelle' }]);
    assert.deepEqual(inclusionsDePersonne(INCLUSIONS, 2, nommer).autres, [{ sorte: 'organisation', nom: 'Club des Grèbes' }]);
  });

  test('une rencontre demandée des deux côtés, portée par une ligne d’organisation, paraît chez les deux personnes', () => {
    // Théo inclut le Club des Grèbes, dont Ondine est le seul membre qu'il
    // peut rencontrer, et Ondine inclut Théo : l'avis est porté par la
    // ligne d'organisation de Théo, Ondine en est le partenaire.
    const inclusions = {
      ...INCLUSIONS,
      nonSatisfaites: [{ participant: 2, cible: { organisation: 'Club des Grèbes' }, partenaire: 3, reciproque: true }],
    };
    assert.deepEqual(inclusionsDePersonne(inclusions, 3, nommer).autres, [{ sorte: 'participant', id: 2, nom: 'Théo Pervenche' }]);
    assert.deepEqual(inclusionsDePersonne(inclusions, 2, nommer).autres, [{ sorte: 'organisation', nom: 'Club des Grèbes' }]);
    // Sans réciproque, le seul membre que Théo peut rencontrer ne porte pas
    // l'avis : il ne le demande pas.
    const sansRetour = { ...inclusions, nonSatisfaites: [{ ...inclusions.nonSatisfaites[0], reciproque: false }] };
    assert.deepEqual(inclusionsDePersonne(sansRetour, 3, nommer).avis, []);
  });

  test('au-delà de son plafond : aucun avis, ses inclusions possibles non atteintes ; sans inclusion, rien', () => {
    const anouk = inclusionsDePersonne(INCLUSIONS, 4, nommer);
    assert.deepEqual(anouk.avis, []);
    assert.equal(anouk.auDela.possibles, 4);
    assert.deepEqual(inclusionsDePersonne(INCLUSIONS, 9, nommer), { compte: null, auDela: null, avis: [], autres: [] });
  });

  test('les hors d’atteinte de sa fiche : les siennes, de la sorte demandée, dans l’ordre du diagnostic', () => {
    assert.deepEqual(
      horsDAtteinteDePersonne(HORS_D_ATTEINTE, 1, 'participant', nommer).map(({ cible, raison }) => [cible.nom, raison]),
      [['Anouk Bruyère', 'sansTourCommun']],
    );
    assert.deepEqual(
      horsDAtteinteDePersonne(HORS_D_ATTEINTE, 1, 'organisation', nommer).map(({ cible, raison }) => [cible.nom, raison]),
      [['Cercle des Pluviers', 'sansPresent']],
    );
    assert.deepEqual(horsDAtteinteDePersonne(HORS_D_ATTEINTE, 3, 'participant', nommer), []);
  });
});

// La petite démonstration au conflit inévitable : ses personnes 1, 2 et 3
// à la table 1 à chaque tour, les autres tournant, en proposition 1 ; 1 et
// 9 se demandent l'une l'autre, que ce plan ne réunit jamais.
const TRIO = [
  [[1, 2, 3], [6, 9, 10], [7, 11, 12], [4, 5, 8]],
  [[1, 2, 3], [5, 6, 9], [7, 11, 12], [4, 8, 10]],
  [[1, 2, 3], [7, 8, 9], [10, 11, 12], [4, 5, 6]],
  [[1, 2, 3], [7, 8, 9], [6, 10, 11], [4, 5, 12]],
];

function chargeTrio({ inclusions = true, parOrganisation = false } = {}) {
  let charge = analyser(texteLivre('petite-conflit')).charge;
  if (parOrganisation) {
    // 9 seul dans une organisation inventée, que 1 inclut.
    charge = appliquerCommande('modifierParticipant', charge, { id: 9, champs: { organisation: 'Hérons' } }).charge;
    charge = appliquerCommande('changerInclusionsOrganisation', charge, { id: 1, organisations: ['Hérons'] }).charge;
    charge = appliquerCommande('changerInclusionsParticipant', charge, { id: 9, participants: [1] }).charge;
  } else if (inclusions) {
    charge = appliquerCommande('changerInclusionsParticipant', charge, { id: 1, participants: [9] }).charge;
    charge = appliquerCommande('changerInclusionsParticipant', charge, { id: 9, participants: [1] }).charge;
  }
  const copie = structuredClone(charge);
  copie.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 40,
      historique: 1000,
      produitVersion: VERSION.affichee,
      siegesAttribues: false,
      tables: copie.tables.map(({ id }) => id),
      capacites: copie.tables.map((table) => capacite(copie, table)),
      tours: TRIO.length,
      participants: copie.participants.map(({ id }) => id),
      placement: TRIO.map((listes) => ({ sieges: listes.map((liste) => [...liste]), reserve: [] })),
    },
  ];
  copie.prochainsIds.proposition = 2;
  copie.evenement.etat = 'propose';
  return copie;
}

describe('la source des inclusions du placement montré (§ 5.8, § 7.5)', () => {
  test('la proposition demandée, sa ligne d’évaluation : un avis pour la rencontre que les deux demandent', () => {
    const { statut, source, inclusions } = inclusionsDuPlacement(chargeTrio(), 1);
    assert.equal(statut, 'mesuree');
    assert.equal(source, 1);
    assert.deepEqual(inclusions.nonSatisfaites, [{ participant: 1, cible: { participant: 9 }, partenaire: 9, reciproque: true }]);
  });

  test('la même rencontre, demandée par 1 à l’organisation dont 9 est le seul membre : un avis, chez les deux personnes', () => {
    const { inclusions } = inclusionsDuPlacement(chargeTrio({ parOrganisation: true }), 1);
    assert.deepEqual(inclusions.nonSatisfaites, [{ participant: 1, cible: { organisation: 'Hérons' }, partenaire: 9, reciproque: true }]);
    const nommer9 = (id) => `personne ${id}`;
    const neuf = inclusionsDePersonne(inclusions, 9, nommer9);
    assert.deepEqual(neuf.compte, { actives: 1, satisfaites: 0 });
    assert.deepEqual(neuf.autres, [{ sorte: 'participant', id: 1, nom: 'personne 1' }]);
    assert.deepEqual(inclusionsDePersonne(inclusions, 1, nommer9).autres, [{ sorte: 'organisation', nom: 'Hérons' }]);
  });

  test('ni proposition demandée que la liste porte, ni retenu : sans placement ; sans inclusion active : sans objet', () => {
    assert.deepEqual(inclusionsDuPlacement(chargeTrio(), null), { statut: 'sansPlacement', source: null, inclusions: null });
    assert.deepEqual(inclusionsDuPlacement(chargeTrio(), 7), { statut: 'sansPlacement', source: null, inclusions: null });
    assert.deepEqual(inclusionsDuPlacement(chargeTrio({ inclusions: false }), 1), { statut: 'sansObjet', source: 1, inclusions: null });
  });

  test('une proposition en dérive ne se mesure pas', () => {
    const charge = chargeTrio();
    charge.participants.find(({ id }) => id === 12).exclu = true;
    assert.deepEqual(inclusionsDuPlacement(charge, 1), { statut: 'nonMesurable', source: 1, inclusions: null });
  });
});

// Les textes des inclusions aux comptes qui changent leur tournure : une
// seule rencontre demandée, aucune (chaque liste au-delà du plafond), une
// seule inclusion atteignable, et aucune inclusion encore possible laissée.
describe('les textes des inclusions aux cas limites (§ 5.6, § 7.5, § 12.15)', () => {
  const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

  test('la synthèse de la vue : une rencontre, aucune, plusieurs', () => {
    assert.equal(t('qualite.inclusions.synthese', { avis: 0, cible: 1 }), 'La rencontre demandée se fait.');
    assert.equal(t('qualite.inclusions.synthese', { avis: 0, cible: 3 }), 'Chacune des 3 rencontres demandées se fait.');
    assert.equal(t('qualite.inclusions.synthese', { avis: 1, cible: 1 }), '1 inclusion non satisfaite sur 1 rencontre demandée.');
    assert.equal(
      t('qualite.inclusions.synthese', { avis: 0, cible: 0 }),
      "Aucune rencontre demandée ne fait d'avis : chaque liste dépasse ce que sa personne peut rencontrer.",
    );
  });

  test('au-delà du plafond, au singulier et sans inclusion encore possible laissée', () => {
    const ligne = { satisfaites: 1, actives: 3, atteignables: 1, possibles: 0 };
    assert.equal(
      t('qualite.inclusions.auDela.ligne', ligne),
      ' : 1 inclusion satisfaite sur 3, au plus 1 possible ; toutes ses inclusions encore possibles sont atteintes',
    );
    assert.equal(
      t('participants.fiche.inclusionsPlacement.auDela', ligne),
      "Sa liste dépasse ce qu'elle peut rencontrer : 1 de ses inclusions au plus peut être satisfaite, et toutes ses inclusions " +
        "encore possibles sont atteintes. Ce n'est pas un avis.",
    );
    assert.equal(
      t('diagnostic.inclusionsAuDela', { personne: 'Iris Ombrelle', actives: 2, besoin: 2, plafond: 1, atteignables: 1 }),
      'Iris Ombrelle : 2 inclusions demandent 2 personnes ; la soirée lui en fait rencontrer au plus 1, donc au plus 1 satisfaite, ' +
        'et 1 reste hors de portée',
    );
    assert.match(t('diagnostic.concretement.inclusionsAuDela', { actives: 1, atteignables: 0 }), /ne pas satisfaire son inclusion n'est pas/);
  });
});
