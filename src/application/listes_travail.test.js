// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des listes de travail (§ 4, § 4.1, § 4.2, § 5.8, § 2.1 étape 6) :
// les titres que rien ne pourvoit, les pressentis non réservés, les
// conversions proposées et les comptes de titres d'une table. Les noms
// d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { appliquerImport, bilanRemplacement } from '../csv/import.js';
import { creerCharge } from '../stockage/document.js';
import { COMMANDES } from './commandes.js';
import { comptesTitres, conversionsPossibles, pressentisNonReserves, titresNonPourvus } from './listes_travail.js';

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);

const personne = (id, nom, prenom = null, autres = {}) => ({
  id,
  nom,
  prenom,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const table = (id, numero = id) => ({ id, numero, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } });

const resa = (participant, idTable, siege, tour = null) => ({
  participant,
  table: idTable,
  siege,
  portee: tour === null ? 'tous' : 'tour',
  tour,
});

// Trois tours, quatre tables de 6 numérotées comme leurs identifiants, cinq
// personnes ; le mode table sauf demande contraire.
function chargeDe({ attribuerSieges = false, reservations = [], titres = [] } = {}) {
  const charge = creerCharge({ id: 'evt-listes', nom: 'Soirée des Lucioles', siegesParDefaut: 6, tours: 3 });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = [
    personne(1, 'Ombrelle', 'Iris'),
    personne(2, 'Pervenche', 'Théo', { titrePressenti: 'animateur' }),
    personne(3, 'Lacasse', 'Ondine', { titrePressenti: 'hôtesse' }),
    personne(4, 'Grisaille'),
    personne(5, 'Bruyère', 'Anouk', { titrePressenti: 'accueil', exclu: true }),
  ];
  charge.tables = [table(1), table(2), table(3), table(4)];
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: 6, table: 5, proposition: 1 };
  return charge;
}

describe('titresNonPourvus et comptesTitres (§ 4.1, § 2.1 étape 6)', () => {
  test('mode table : trois titres à la table 2 et une désignation → trois titres, un pourvu, deux à pourvoir', () => {
    let charge = chargeDe();
    for (const libelle of ['animation', 'accueil', 'veille']) {
      charge = executer('poserTitre', charge, { table: 2, siege: null, libelle }).charge;
    }
    assert.deepEqual(
      charge.titres.map(({ siege }) => siege),
      [1, 2, 3],
    );
    charge = executer('designer', charge, { participant: 1, table: 2, siege: null, libelle: 'animation' }).charge;
    assert.deepEqual(comptesTitres(charge, 2), { titres: 3, pourvus: 1 });
    assert.deepEqual(comptesTitres(charge, 1), { titres: 0, pourvus: 0 });
    const deLaTable = titresNonPourvus(charge).filter(({ table: t }) => t === 2);
    assert.deepEqual(deLaTable, [
      { table: 2, numero: 2, siege: 2, libelle: 'accueil', pourvuAuxTours: [] },
      { table: 2, numero: 2, siege: 3, libelle: 'veille', pourvuAuxTours: [] },
    ]);
  });

  test('une réservation d’un tour désigné pourvoit le titre à ce tour seulement : il reste dans la liste', () => {
    const charge = chargeDe({ reservations: [resa(4, 3, 1, 2)], titres: [{ table: 3, siege: 1, libelle: 'animation' }] });
    assert.deepEqual(titresNonPourvus(charge), [{ table: 3, numero: 3, siege: 1, libelle: 'animation', pourvuAuxTours: [2] }]);
    assert.deepEqual(comptesTitres(charge, 3), { titres: 1, pourvus: 0 });
  });

  test('les titres se rangent par numéro de table, puis par siège', () => {
    const charge = chargeDe({
      titres: [
        { table: 1, siege: 2, libelle: 'accueil' },
        { table: 4, siege: 1, libelle: 'animation' },
        { table: 1, siege: 1, libelle: 'animation' },
      ],
    });
    charge.tables[3].numero = 1;
    charge.tables[0].numero = 4;
    assert.deepEqual(
      titresNonPourvus(charge).map(({ table: t, siege }) => [t, siege]),
      [[4, 1], [1, 1], [1, 2]],
    );
  });

  test('un titre pourvu, une règle : en mode table, une réservation au siège 5 ne pourvoit pas le titre du siège 1', () => {
    const charge = chargeDe({ reservations: [resa(1, 2, 5)], titres: [{ table: 2, siege: 1, libelle: 'animation' }] });
    assert.equal(bilanRemplacement(charge).titresPourvus, 0);
    assert.deepEqual(
      titresNonPourvus(charge).map(({ table: t, siege }) => [t, siege]),
      [[2, 1]],
    );
  });

  test('le titre reste : retirer, déplacer, supprimer ou exclure la personne désignée laisse le titre, non pourvu', () => {
    const designee = executer('designer', chargeDe(), { participant: 1, table: 3, siege: null, libelle: 'animation' }).charge;
    assert.deepEqual(titresNonPourvus(designee), []);
    const variantes = [
      ['retirerReservation', { participant: 1, table: 3, portee: 'tous', tour: null }],
      ['deplacerReservation', { participant: 1, de: { table: 3, portee: 'tous', tour: null }, vers: { table: 4, siege: null } }],
      ['supprimerParticipant', { id: 1 }],
      ['exclureParticipant', { id: 1 }],
    ];
    assert.equal(variantes.length, 4);
    for (const [nom, args] of variantes) {
      const { charge } = executer(nom, designee, args);
      assert.deepEqual(charge.titres, designee.titres, nom);
      assert.deepEqual(
        titresNonPourvus(charge).map(({ table: t }) => t),
        [3],
        nom,
      );
    }
  });
});

describe('pressentisNonReserves et conversionsPossibles (§ 4, § 4.2, § 5.8)', () => {
  test('les pressentis que rien ne réserve, exclus omis', () => {
    const charge = chargeDe({ reservations: [resa(3, 1, null, 2)] });
    assert.deepEqual(pressentisNonReserves(charge), [{ participant: 2, titrePressenti: 'animateur' }]);
  });

  test('titre pressenti importé : ni réservation ni titre, la liste des titres inchangée, la personne dans les pressentis', () => {
    const charge = chargeDe({ titres: [{ table: 1, siege: 1, libelle: 'animation' }] });
    charge.participants = charge.participants.filter(({ titrePressenti }) => titrePressenti === null);
    const texte = 'nom;prenom;titre_pressenti\nSarcelle;Capucine;animatrice\n';
    const { charge: apres } = appliquerImport(charge, apercevoir(texte, { participants: charge.participants }), 'ajouter');
    assert.deepEqual(apres.reservations, charge.reservations);
    assert.deepEqual(apres.titres, charge.titres);
    assert.deepEqual(titresNonPourvus(apres), titresNonPourvus(charge));
    assert.deepEqual(pressentisNonReserves(apres), [{ participant: 6, titrePressenti: 'animatrice' }]);
  });

  test('la R-ième réservation « tour » à une même table propose la conversion, sans rien changer ; convertirEnTous en fait une seule « tous »', () => {
    const charge = chargeDe({ reservations: [resa(2, 1, null, 1), resa(2, 1, null, 2), resa(3, 1, null, 1), resa(3, 2, null, 2)] });
    assert.deepEqual(conversionsPossibles(charge), []);
    const { charge: troisieme } = executer('reserver', charge, { participant: 2, table: 1, siege: null, portee: 'tour', tour: 3 });
    const avant = structuredClone(troisieme);
    assert.deepEqual(conversionsPossibles(troisieme), [{ participant: 2, table: 1 }]);
    assert.deepEqual(troisieme, avant);
    const { charge: convertie } = executer('convertirEnTous', troisieme, { participant: 2, table: 1 });
    assert.deepEqual(
      convertie.reservations.filter(({ participant }) => participant === 2),
      [resa(2, 1, null)],
    );
    assert.deepEqual(conversionsPossibles(convertie), []);
  });
});
