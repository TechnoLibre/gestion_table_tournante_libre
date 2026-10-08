// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la meilleure proposition que la section de la génération
// annonce (§ 5.4, § 5.7) : la première du classement, son identifiant et sa
// cellule des collisions cumulées, celle du tableau des propositions. La
// valeur attendue vient de la table d'évaluation et du tableau, sollicités
// une seconde fois (§ 19.1). Les charges partent de la petite démonstration
// livrée ou s'écrivent ici ; les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { evaluer } from '../../application/evaluation.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { tableau } from '../propositions/modele.js';
import { meilleureProposition } from './meilleure.js';

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;
const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// La charge, une génération du moteur de plus, enregistrée par la commande.
function generee(charge, reglages) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return executer(charge, 'enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee });
}

// Six personnes inventées, deux tables de 3, quatre tours ; les deux
// premières partagent une appartenance.
function chargeSix() {
  const charge = creerCharge({ id: 'evt-meilleure', nom: 'Club des Merles', siegesParDefaut: 3, tours: 4 });
  const noms = [['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Grisaille', null], ['Bruyère', 'Anouk'], ['Sarcelle', 'Capucine']];
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: rang < 2 ? 'Club des Merles' : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  return charge;
}

// Une proposition écrite à la main, sièges non attribués, sur les deux
// tables de la charge ; ses listes données tour par tour.
function propositionDe(charge, id, tours) {
  return {
    id,
    graine: id,
    arret: 40,
    historique: 1000,
    produitVersion: VERSION.affichee,
    siegesAttribues: false,
    tables: charge.tables.map(({ id: table }) => table),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: tours.length,
    participants: charge.participants.map(({ id: p }) => p),
    placement: tours.map((listes) => ({ sieges: listes.map((liste) => [...liste]), reserve: [] })),
  };
}

// Les deux collègues ensemble aux quatre tours : 4 collisions cumulées.
const ENSEMBLE = [
  [[1, 2, 3], [4, 5, 6]],
  [[1, 2, 4], [3, 5, 6]],
  [[1, 2, 5], [3, 4, 6]],
  [[1, 2, 6], [3, 4, 5]],
];
// Les deux collègues séparés à chaque tour : aucune collision.
const SEPARES = [
  [[1, 3, 4], [2, 5, 6]],
  [[1, 5, 6], [2, 3, 4]],
  [[1, 3, 5], [2, 4, 6]],
  [[1, 4, 6], [2, 3, 5]],
];

// La cellule des collisions cumulées de la première ligne du tableau des
// propositions, et son identifiant : ce que la section des propositions
// affiche au rang 1.
function rangUn(charge) {
  const [premiere] = tableau(evaluer(charge)).lignes;
  return { id: premiere.id, cellule: premiere.cellules.find(({ colonne }) => colonne === 'collisionsCumulees') };
}

describe('la meilleure proposition (§ 5.4, § 5.7)', () => {
  test('sans proposition ni retenu : null', () => {
    assert.equal(meilleureProposition(chargeDemo('petite')), null);
    assert.equal(meilleureProposition(chargeSix()), null);
  });

  test('après des générations : le rang 1 du tableau, son identifiant et sa cellule des collisions cumulées', () => {
    let charge = generee(chargeDemo('petite-conflit'), { graine: 4, nombre: 3, arret: 300, historique: 1000 });
    charge = generee(charge, { graine: 9, nombre: 2, arret: 300, historique: 1000 });
    assert.equal(charge.propositions.length, 5);
    const attendu = rangUn(charge);
    const rendu = meilleureProposition(charge);
    assert.deepEqual(rendu, attendu);
    assert.equal(rendu.cellule.colonne, 'collisionsCumulees');
    const ligne = evaluer(charge).propositions[0];
    assert.equal(ligne.statut, 'comparable');
    assert.equal(rendu.id, ligne.id);
    assert.equal(rendu.cellule.valeur, ligne.mesures.collisionsCumulees);
    assert.equal(typeof rendu.cellule.valeur, 'number');
  });

  test('le rang, ni le plus petit identifiant ni le moins de collisions : la 2, à écart au plafond nul, passe devant la 1, qui sépare les collègues', () => {
    // Séparer les deux collègues leur retire une rencontre : la 1 porte un
    // écart au plafond a priori de 1, la 2 aucun ; le premier critère du
    // classement met la 2 en tête, avec ses 4 collisions cumulées.
    const charge = chargeSix();
    charge.propositions = [propositionDe(charge, 1, SEPARES), propositionDe(charge, 2, ENSEMBLE)];
    charge.prochainsIds.proposition = 3;
    const lignes = evaluer(charge).propositions;
    assert.deepEqual(
      lignes.map((ligne) => [ligne.id, ligne.statut, ligne.ecartAuPlafondAPrioriMax, ligne.mesures.collisionsCumulees]),
      [
        [2, 'comparable', 0, 4],
        [1, 'comparable', 1, 0],
      ],
    );
    const rendu = meilleureProposition(charge);
    assert.equal(rendu.id, 2);
    assert.equal(rendu.cellule.valeur, 4);
    assert.deepEqual(rendu, rangUn(charge));
  });

  test('aucune proposition comparable — population changée — : null', () => {
    const charge = generee(chargeDemo('petite'), { graine: 3, nombre: 2, arret: 300, historique: 1000 });
    assert.notEqual(meilleureProposition(charge), null);
    const exclue = executer(charge, 'exclureParticipant', { id: charge.participants[0].id });
    const statuts = evaluer(exclue).propositions.map(({ statut }) => statut);
    assert.equal(statuts.length, 2);
    assert.ok(statuts.every((statut) => statut !== 'comparable'), statuts.join());
    assert.equal(meilleureProposition(exclue), null);
  });
});
