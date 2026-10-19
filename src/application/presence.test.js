// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la présence par tour côté commandes (§ 4, § 4.4, § 5.8, § 8.2,
// § 9) : changerPresence, ses refus, son libellé figé et ses
// avertissements ; le retenu qui suit qui est là, dans l'entrée du geste,
// pour chaque commande qui change les participants ; la présence d'une
// personne ajoutée ; les rencontres qu'une exclusion ou une suppression
// retire du retenu. Les noms d'épreuve sont inventés ; la version vient du
// module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { creerCharge } from '../stockage/document.js';
import { RAISONS_DE_PARTICIPANTS, ajusterALaPresence, derive, fautes } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { avertissementsApres } from './avertissements.js';
import { COMMANDES, appliquerCommande } from './commandes.js';
import { ErreurCommande } from './erreurs.js';
import { retenuAjuste } from './evaluation.js';
import { COMMANDES_PRESENCE, retenuAuxPresences } from './presence.js';

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
  ['Bruyère', 'Anouk'],
  ['Sarcelle', 'Capucine'],
  ['Ancolie', 'Amandine'],
];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[id - 1][0],
  prenom: NOMS[id - 1][1],
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const table = (id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 400 * id, y: 0 } });

const resa = (participant, idTable, siege, tour = null) => ({
  participant,
  table: idTable,
  siege,
  portee: tour === null ? 'tous' : 'tour',
  tour,
});

// Les listes des quatre tours, tables 1 et 2 de quatre places : 6 est
// assise aux tours 1 et 2 et attend en réserve aux tours 3 et 4 ; 7 attend
// en réserve à chaque tour.
const TOURS = [
  [[1, 2, 3, 6], [4, 5]],
  [[1, 4, 6], [2, 3, 5]],
  [[1, 2, 5], [3, 4]],
  [[1, 3], [2, 4, 5]],
];
const SEPT = [1, 2, 3, 4, 5, 6, 7];

// Sept personnes, deux tables de quatre places, quatre tours. presences
// donne la présence de qui en porte une, exclus les exclues. Avec retenu, la
// proposition 1, écrite sans absence, est retenue, et le retenu est aligné
// sur la présence de chacune (ajusterALaPresence) : il ne dérive pas par
// ses participants.
function chargeDe({ presences = {}, exclus = [], siegesAttribues = true, retenu = true, reservations = [], titres = [] } = {}) {
  const charge = creerCharge({ id: 'evt-presence', nom: 'Soirée des Lucioles', siegesParDefaut: 4, tours: 4 });
  charge.reglages.attribuerSieges = siegesAttribues;
  charge.participants = SEPT.map((id) => {
    const rendue = personne(id, { exclu: exclus.includes(id) });
    if (Object.hasOwn(presences, id)) rendue.presence = presences[id];
    return rendue;
  });
  charge.tables = [table(1), table(2)];
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: 8, table: 3, proposition: 2 };
  if (!retenu) return charge;
  const plan = {
    siegesAttribues,
    tables: [1, 2],
    capacites: [4, 4],
    tours: 4,
    participants: SEPT,
    placement: TOURS.map((listes) => ({ sieges: structuredClone(listes), reserve: SEPT.filter((id) => !listes.flat().includes(id)) })),
  };
  charge.propositions = [{ id: 1, graine: 7, arret: 40, historique: 1000, produitVersion: VERSION.affichee, ...plan }];
  charge.retenu = ajusterALaPresence({ proposition: 1, ...plan }, charge).placement;
  charge.evenement.etat = 'retenu';
  return charge;
}

// Gèle une valeur en profondeur : une commande qui la modifierait lèverait.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

// Le refus attendu : une ErreurCommande de ce code, dont les détails
// contiennent ceux donnés.
function refuse(appel, code, attendus = {}) {
  let leve = null;
  try {
    appel();
  } catch (erreur) {
    leve = erreur;
  }
  assert.ok(leve instanceof ErreurCommande, `ErreurCommande ${code} attendue, reçu ${leve}`);
  assert.equal(leve.code, code, leve.message);
  for (const [cle, valeur] of Object.entries(attendus)) assert.deepEqual(leve.details[cle], valeur, cle);
  return leve;
}

// Le geste sur une copie gelée de la charge, par appliquerCommande : la
// charge reçue ne change pas.
const executer = (nom, charge, args) => appliquerCommande(nom, figer(structuredClone(charge)), args);
const changer = (charge, id, tours) => executer('changerPresence', charge, { id, tours });

const etage = (charge, tour) => charge.retenu.placement[tour - 1];
const raisonsDePersonnes = (charge) => derive(charge.retenu, charge).filter(({ code }) => RAISONS_DE_PARTICIPANTS.has(code));

describe('changerPresence : la commande (§ 4, § 8.2)', () => {
  test('le registre de la présence porte changerPresence, réuni dans COMMANDES', () => {
    assert.deepEqual([...COMMANDES_PRESENCE.keys()], ['changerPresence']);
    assert.equal(COMMANDES.get('changerPresence'), COMMANDES_PRESENCE.get('changerPresence'));
  });

  test('la présence s’écrit canonique : une liste partielle telle quelle, tous les tours retirent le champ, null aussi', () => {
    const charge = chargeDe({ retenu: false });
    const partielle = changer(charge, 2, [1, 3]).charge;
    assert.deepEqual(partielle.participants[1], personne(2, { presence: [1, 3] }));
    for (const tours of [[1, 2, 3, 4], null]) {
      const pleine = changer(partielle, 2, tours).charge;
      assert.deepEqual(pleine.participants[1], personne(2));
      assert.ok(!Object.hasOwn(pleine.participants[1], 'presence'));
    }
  });

  test('une présence égale est SANS_EFFET : null sur un champ absent, tous les tours, la même liste', () => {
    const charge = chargeDe({ presences: { 2: [1, 3] } });
    for (const [id, tours] of [
      [1, null],
      [1, [1, 2, 3, 4]],
      [2, [1, 3]],
    ]) {
      refuse(() => changer(charge, id, tours), 'SANS_EFFET', { commande: 'changerPresence', remede: null });
      // La commande seule, hors de la garde générique d'appliquerCommande :
      // le refus vient de sa propre comparaison des présences.
      refuse(() => COMMANDES.get('changerPresence')(figer(structuredClone(charge)), { id, tours }), 'SANS_EFFET', {
        commande: 'changerPresence',
      });
    }
  });

  test('aucun tour : PRESENCE_VIDE {participant, personne}, remède null ; le texte nomme l’exclusion', () => {
    const leve = refuse(() => changer(chargeDe(), 3, []), 'PRESENCE_VIDE');
    assert.deepEqual(leve.details, { participant: 3, personne: 'Ondine Lacasse', remede: null });
  });

  test('les refus dans leur ordre : PLAN_BLOQUE, un id de forme fausse, PARTICIPANT_INCONNU, des tours de forme fausse', () => {
    const bloquee = chargeDe();
    bloquee.evenement.etat = 'bloque';
    refuse(() => changer(bloquee, 'x', 'y'), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
    for (const id of ['2', 2.5, null, undefined]) assert.throws(() => changer(chargeDe(), id, [1]), TypeError, String(id));
    refuse(() => changer(chargeDe(), 99, 'y'), 'PARTICIPANT_INCONNU', { id: 99, remede: null });
    for (const tours of [[0], [5], [2, 1], [1, 1], [1.5], ['1'], 'tous', undefined, {}, 3]) {
      assert.throws(() => changer(chargeDe(), 2, tours), TypeError, JSON.stringify(tours));
    }
  });

  test('une exclue reçoit une présence, sans contrôle, sans avertissement, et le retenu ne bouge pas', () => {
    // 3, exclue, garde sa réservation suspendue au siège 1 de la table 1, que
    // 1 réserve aussi : réintégrée, elle ne passerait pas ; sa présence se
    // change quand même.
    const charge = chargeDe({ exclus: [3], reservations: [resa(1, 1, 1), resa(3, 1, 1)] });
    const rendu = changer(charge, 3, [2, 3]);
    assert.deepEqual(rendu.charge.participants[2], personne(3, { exclu: true, presence: [2, 3] }));
    assert.deepEqual(rendu.charge.retenu, charge.retenu);
    assert.deepEqual(rendu.charge.reservations, charge.reservations);
    assert.deepEqual(rendu.avertissements, []);
    assert.equal(rendu.libelle, 'Présence de Ondine Lacasse : tours 2 et 3, au lieu de tous les tours');
  });

  test('une présence qui s’étend sur une table pleine de réservations : SURRESERVATION, remède changerPlacesTable, et rien ne s’écrit', () => {
    // Quatre réservations « tous » sur la table 1 de quatre places, dont
    // celle de 4, absente au tour 3 ; 5 réservée au tour 3 seulement.
    const reservations = [resa(1, 1, null), resa(2, 1, null), resa(3, 1, null), resa(4, 1, null), resa(5, 1, null, 3)];
    const charge = figer(chargeDe({ retenu: false, presences: { 4: [1, 2, 4] }, reservations }));
    const leve = refuse(() => COMMANDES.get('changerPresence')(charge, { id: 4, tours: null }), 'SURRESERVATION', {
      table: 1,
      tour: 3,
      reservees: 5,
      capacite: 4,
      remede: { commande: 'changerPlacesTable', arguments: { id: 1, sieges: 5, origine: 'champ' } },
    });
    assert.deepEqual(leve.details.autres, []);
    assert.deepEqual(charge.participants[3].presence, [1, 2, 4]);
  });
});

describe('changerPresence : le retenu suit qui est là, dans la même entrée (§ 5.8)', () => {
  test('partante, sièges attribués : ses chaises deviennent vides aux tours d’absence, absents les porte, rien d’autre ne change', () => {
    const charge = chargeDe();
    const rendu = changer(charge, 3, [1, 2]);
    assert.equal(rendu.libelle, 'Présence de Ondine Lacasse : tours 1 et 2, au lieu de tous les tours ; retirée du placement retenu aux tours 3 et 4');
    const { placement } = rendu.charge.retenu;
    assert.deepEqual(placement.slice(0, 2), charge.retenu.placement.slice(0, 2));
    assert.deepEqual(placement[2], { sieges: [[1, 2, 5], [null, 4]], reserve: [6, 7], absents: [3] });
    assert.deepEqual(placement[3], { sieges: [[1], [2, 4, 5]], reserve: [6, 7], absents: [3] });
    assert.deepEqual(rendu.avertissements, []);
    assert.deepEqual(raisonsDePersonnes(rendu.charge), []);
  });

  test('arrivante : en réserve aux seuls tours gagnés, sortie des absents, et A_PLACER_DANS_LE_RETENU nomme ces tours', () => {
    const charge = chargeDe({ presences: { 3: [3, 4] } });
    assert.deepEqual(etage(charge, 1), { sieges: [[1, 2, null, 6], [4, 5]], reserve: [7], absents: [3] });
    const rendu = changer(charge, 3, [2, 3, 4]);
    assert.equal(rendu.libelle, 'Présence de Ondine Lacasse : tours 2 à 4, au lieu des tours 3 et 4 ; mise en réserve au tour 2');
    assert.deepEqual(etage(rendu.charge, 1), etage(charge, 1));
    assert.deepEqual(etage(rendu.charge, 2), { sieges: [[1, 4, 6], [2, null, 5]], reserve: [3, 7] });
    assert.deepEqual(rendu.charge.retenu.placement.slice(2), charge.retenu.placement.slice(2));
    assert.deepEqual(rendu.avertissements, [
      {
        code: 'A_PLACER_DANS_LE_RETENU',
        details: {
          participant: 3,
          personne: 'Ondine Lacasse',
          tours: [2],
          tousLesTours: false,
          remede: { geste: 'afficherTour', tour: 2 },
        },
      },
    ]);
  });

  test('glissement des tours 1 et 2 aux tours 2 et 3 : retirée au tour 1, en réserve au tour 3, en place au tour 2', () => {
    const charge = chargeDe({ presences: { 3: [1, 2] } });
    const rendu = changer(charge, 3, [2, 3]);
    assert.equal(
      rendu.libelle,
      'Présence de Ondine Lacasse : tours 2 et 3, au lieu des tours 1 et 2 ; retirée du placement retenu au tour 1, mise en réserve au tour 3',
    );
    assert.deepEqual(etage(rendu.charge, 1), { sieges: [[1, 2, null, 6], [4, 5]], reserve: [7], absents: [3] });
    assert.deepEqual(etage(rendu.charge, 2), etage(charge, 2));
    assert.deepEqual(etage(rendu.charge, 3), { sieges: [[1, 2, 5], [null, 4]], reserve: [3, 6, 7] });
    assert.deepEqual(etage(rendu.charge, 4), etage(charge, 4));
    assert.deepEqual(raisonsDePersonnes(rendu.charge), []);
  });

  test('revenue à tous les tours : en réserve à chacun des tours gagnés ; A_PLACER_DANS_LE_RETENU dit tousLesTours', () => {
    const rendu = changer(chargeDe({ presences: { 3: [1] } }), 3, null);
    assert.equal(rendu.libelle, 'Présence de Ondine Lacasse : tous les tours, au lieu du tour 1 ; mise en réserve aux tours 2 à 4');
    assert.deepEqual(rendu.avertissements.map(({ code, details }) => [code, details.tours, details.tousLesTours, details.remede]), [
      ['A_PLACER_DANS_LE_RETENU', [2, 3, 4], true, { geste: 'afficherTour', tour: 2 }],
    ]);
  });

  test('sans attribution des sièges : la liste se resserre, triée', () => {
    const charge = chargeDe({ siegesAttribues: false });
    const rendu = changer(charge, 3, [1, 2]);
    assert.equal(rendu.libelle, 'Présence de Ondine Lacasse : tours 1 et 2, au lieu de tous les tours ; retirée du placement retenu aux tours 3 et 4');
    assert.deepEqual(etage(rendu.charge, 3), { sieges: [[1, 2, 5], [4]], reserve: [6, 7], absents: [3] });
    assert.deepEqual(etage(rendu.charge, 4), { sieges: [[1], [2, 4, 5]], reserve: [6, 7], absents: [3] });
  });

  test('un retenu fautif reste intact ; sans retenu, la présence seule change', () => {
    const fautive = chargeDe();
    fautive.retenu.placement[0].sieges[1] = [4, 5, 4];
    assert.notDeepEqual(fautes(fautive.retenu), []);
    const rendu = changer(fautive, 3, [1, 2]);
    assert.deepEqual(rendu.charge.retenu, fautive.retenu);
    assert.equal(rendu.libelle, 'Présence de Ondine Lacasse : tours 1 et 2, au lieu de tous les tours');
    const sans = changer(chargeDe({ retenu: false, presences: { 3: [1] } }), 3, null);
    assert.equal(sans.charge.retenu, null);
    assert.equal(sans.libelle, 'Présence de Ondine Lacasse : tous les tours, au lieu du tour 1');
    assert.deepEqual(sans.avertissements, []);
  });

  test('une seule entrée : la présence et le retenu changent ensemble, et le retenu prend l’horodatage du geste', () => {
    const charge = chargeDe();
    const horodatage = '2031-03-14T19:00:00-04:00';
    const rendu = appliquerCommande('changerPresence', figer(structuredClone(charge)), { id: 3, tours: [1, 2] }, { horodatage });
    assert.equal(typeof rendu.libelle, 'string');
    assert.deepEqual(rendu.charge.participants[2].presence, [1, 2]);
    assert.equal(rendu.charge.retenu.horodatage, horodatage);
    assert.deepEqual(rendu.charge.propositions, charge.propositions);
  });

  test('le retenu ajusté est comparable — aucune raison de dérive — et ajusté au sens de retenuAjuste', () => {
    const charge = chargeDe();
    assert.equal(retenuAjuste(charge), false);
    const { charge: apres } = changer(charge, 3, [1, 2]);
    assert.deepEqual(derive(apres.retenu, apres), []);
    assert.equal(retenuAjuste(apres), true);
  });

  test('retenuAuxPresences : seules les personnes dont la présence par tour change ; null sans retenu ; une charge sans changement rend le retenu tel quel', () => {
    const avant = chargeDe();
    // 6, présente aux tours 1 et 2 par une donnée que le retenu ne suit pas
    // encore, attend en réserve aux tours 3 et 4 : un retenu en dérive par
    // elle. Le geste ne nomme que 3, et le retenu garde 6 où elle est.
    avant.participants[5].presence = [1, 2];
    const apres = structuredClone(avant);
    apres.participants[2].presence = [1, 2];
    const rendu = retenuAuxPresences(avant, apres);
    assert.deepEqual(rendu.retenu.placement[2].reserve, [6, 7]);
    assert.deepEqual(rendu.partis, [{ participant: 3, tours: [3, 4] }]);
    assert.deepEqual([rendu.arrives, rendu.retires], [[], []]);
    assert.deepEqual(retenuAuxPresences(avant, avant), { retenu: avant.retenu, partis: [], arrives: [], retires: [] });
    const sans = chargeDe({ retenu: false });
    assert.deepEqual(retenuAuxPresences(sans, sans), { retenu: null, partis: [], arrives: [], retires: [] });
  });
});

describe('changerPresence : les réservations et les titres suspendus ou rétablis (§ 4.1, § 4.4)', () => {
  // 3 réservée « tous » au siège 2 de la table 2, qui porte le titre
  // « accueil » ; 5 réservée au tour 2 seulement à la table 1 ; 1 réservée
  // au tour 4 seulement à la table 1.
  const reservees = (presences = {}) =>
    chargeDe({
      retenu: false,
      presences,
      reservations: [resa(3, 2, 2), resa(5, 1, null, 2), resa(1, 1, null, 4)],
      titres: [{ table: 2, siege: 2, libelle: 'accueil' }],
    });

  test('absente aux tours 3 et 4 : RESERVATIONS_SUSPENDUES_AUX_TOURS compte ses réservations de ces tours et le titre qui n’y est plus pourvu', () => {
    const rendu = changer(reservees(), 3, [1, 2]);
    assert.deepEqual(rendu.avertissements, [
      {
        code: 'RESERVATIONS_SUSPENDUES_AUX_TOURS',
        details: { participant: 3, personne: 'Ondine Lacasse', reservations: 1, tours: [3, 4], titres: 1 },
      },
    ]);
    assert.deepEqual(rendu.charge.reservations, reservees().reservations);
  });

  test('tours nomme les seuls tours d’absence que ses réservations couvrent ; titres, ceux qu’elles cessent d’y pourvoir', () => {
    const quatre = changer(reservees(), 3, [1, 2, 3]);
    assert.deepEqual(quatre.avertissements.map(({ code, details }) => [code, details.reservations, details.tours, details.titres]), [
      ['RESERVATIONS_SUSPENDUES_AUX_TOURS', 1, [4], 1],
    ]);
    const tourDeux = changer(reservees(), 5, [3]);
    assert.deepEqual(tourDeux.avertissements.map(({ code, details }) => [code, details.reservations, details.tours, details.titres]), [
      ['RESERVATIONS_SUSPENDUES_AUX_TOURS', 1, [2], 0],
    ]);
    assert.deepEqual(changer(reservees(), 5, [1, 3, 4]).avertissements.map(({ details }) => details.tours), [[2]]);
  });

  test('de retour aux tours 3 et 4 : RESERVATIONS_RETABLIES_AUX_TOURS, le titre de nouveau pourvu', () => {
    const rendu = changer(reservees({ 3: [1, 2] }), 3, null);
    assert.deepEqual(rendu.avertissements, [
      {
        code: 'RESERVATIONS_RETABLIES_AUX_TOURS',
        details: { participant: 3, personne: 'Ondine Lacasse', reservations: 1, tours: [3, 4], titres: 1 },
      },
    ]);
  });

  test('un glissement dit les deux, suspendues d’abord ; une personne sans réservation ne dit rien', () => {
    const rendu = changer(reservees({ 3: [1, 2] }), 3, [2, 3]);
    assert.deepEqual(rendu.avertissements.map(({ code, details }) => [code, details.tours]), [
      ['RESERVATIONS_SUSPENDUES_AUX_TOURS', [1]],
      ['RESERVATIONS_RETABLIES_AUX_TOURS', [3]],
    ]);
    assert.deepEqual(changer(reservees(), 6, [1]).avertissements, []);
  });

  test('une réservation au siège de l’arrivante, au tour gagné : accepté, et avertissementsApres dit RESERVATION_NON_HONOREE', () => {
    // 3, présente au tour 1, réservée au siège 4 de la table 2 au tour 2 :
    // la réservation est suspendue tant qu'elle est absente.
    const charge = chargeDe({ presences: { 3: [1] }, reservations: [resa(3, 2, 4, 2)] });
    const rendu = changer(charge, 3, [1, 2]);
    assert.deepEqual(etage(rendu.charge, 2).reserve, [3, 7]);
    const avis = avertissementsApres(charge, rendu.charge).filter(({ code }) => code === 'RESERVATION_NON_HONOREE');
    assert.deepEqual(avis.map(({ details: { participant, table: t, tour } }) => ({ participant, table: t, tour })), [
      { participant: 3, table: 2, tour: 2 },
    ]);
  });
});

describe('le retenu ne dérive jamais par ses participants après un geste qui les change (§ 9)', () => {
  // Une charge où 3 est présente aux tours 1 et 2, 5 aux tours 2 à 4, et 7
  // exclue, présente au tour 2.
  const depart = () => chargeDe({ presences: { 3: [1, 2], 5: [2, 3, 4], 7: [2] }, exclus: [7] });
  const csv = (texte, charge, mode) => ({ apercu: apercevoir(texte, { participants: charge.participants, mode, tours: 4 }), mode });
  const GESTES = [
    ['changerPresence', () => ({ id: 3, tours: null })],
    ['changerPresence', () => ({ id: 3, tours: [4] })],
    ['changerPresence', () => ({ id: 5, tours: [1] })],
    ['changerPresence', () => ({ id: 2, tours: [1, 4] })],
    ['ajouterParticipant', () => ({ champs: { nom: 'Quenouille' } })],
    ['ajouterParticipant', () => ({ champs: { nom: 'Pivoine' }, presence: [3, 4] })],
    ['exclureParticipant', () => ({ id: 1 })],
    ['exclureParticipant', () => ({ id: 3 })],
    ['reintegrerParticipant', () => ({ id: 7 })],
    ['supprimerParticipant', () => ({ id: 4 })],
    ['supprimerParticipant', () => ({ id: 3 })],
    ['importerParticipants', (charge) => csv('nom;presence\nQuenouille;2-3\n', charge, 'ajouter')],
    ['importerParticipants', (charge) => csv('nom;prenom;presence\nLacasse;Ondine;tous\nBruyère;Anouk;1\n', charge, 'mettreAJour')],
    ['importerParticipants', (charge) => csv('nom;prenom;exclu\nPervenche;Théo;oui\nAncolie;Amandine;non\n', charge, 'mettreAJour')],
    ['importerParticipants', (charge) => csv('nom;presence\nQuenouille;\nPivoine;1, 4\n', charge, 'remplacer')],
  ];

  test('chaque geste de la liste, sur un retenu qui ne dérive pas, rend un retenu sans raison de RAISONS_DE_PARTICIPANTS, et le libellé le dit', () => {
    const charge = depart();
    assert.deepEqual(derive(charge.retenu, charge), []);
    for (const [nom, args] of GESTES) {
      const rendu = executer(nom, charge, args(charge));
      const titre = `${nom} ${JSON.stringify(args(charge).id ?? args(charge).champs ?? args(charge).mode)}`;
      assert.deepEqual(raisonsDePersonnes(rendu.charge), [], titre);
      assert.notDeepEqual(rendu.charge.retenu, charge.retenu, titre);
      if (nom !== 'changerPresence') assert.ok(rendu.libelle.endsWith(' ; placement retenu ajusté'), `${titre} : ${rendu.libelle}`);
    }
  });

  test('un geste qui ne change la présence de personne laisse le retenu et le libellé tels quels', () => {
    const charge = depart();
    const exclue = executer('ajouterParticipant', charge, { champs: { nom: 'Quenouille', exclu: true } });
    assert.equal(exclue.libelle, 'Ajouté Quenouille');
    assert.deepEqual(exclue.charge.retenu, charge.retenu);
    const modifiee = executer('importerParticipants', charge, csv('nom;prenom;courriel\nLacasse;Ondine;o@exemple.test\n', charge, 'mettreAJour'));
    assert.equal(modifiee.libelle, 'Mis à jour la liste par import : 0 ajouté, 1 modifié');
    assert.deepEqual(modifiee.charge.retenu, charge.retenu);
  });
});

describe('ajouterParticipant : la présence de la personne neuve (§ 4)', () => {
  const ajouter = (charge, presence) => executer('ajouterParticipant', charge, { champs: { nom: 'Quenouille', prenom: 'Hortense' }, ...presence });

  test('absente, null ou tous les tours : pas de champ ; une liste se range canonique', () => {
    const charge = chargeDe({ retenu: false });
    for (const presence of [{}, { presence: null }, { presence: [1, 2, 3, 4] }]) {
      const ajoutee = ajouter(charge, presence).charge.participants.at(-1);
      assert.ok(!Object.hasOwn(ajoutee, 'presence'), JSON.stringify(presence));
    }
    assert.deepEqual(ajouter(charge, { presence: [2, 3] }).charge.participants.at(-1).presence, [2, 3]);
  });

  test('aucun tour : PRESENCE_VIDE, remède null ; un tour hors de 1..R ou une liste non croissante : TypeError', () => {
    const charge = chargeDe({ retenu: false });
    const leve = refuse(() => ajouter(charge, { presence: [] }), 'PRESENCE_VIDE');
    assert.deepEqual(leve.details, { participant: 8, personne: 'Hortense Quenouille', remede: null });
    for (const presence of [[0], [5], [3, 2], [2, 2], 'tous']) assert.throws(() => ajouter(charge, { presence }), TypeError, JSON.stringify(presence));
    refuse(() => executer('ajouterParticipant', charge, { champs: { nom: ' ' }, presence: [] }), 'NOM_REQUIS');
  });

  test('sous un retenu : en réserve à ses tours de présence, absente ailleurs ; A_PLACER_DANS_LE_RETENU, tousLesTours selon sa présence', () => {
    const charge = chargeDe();
    const partielle = ajouter(charge, { presence: [3, 4] });
    assert.equal(partielle.libelle, 'Ajouté Hortense Quenouille ; placement retenu ajusté');
    assert.deepEqual(partielle.charge.retenu.participants, [...SEPT, 8]);
    assert.deepEqual(partielle.charge.retenu.placement.map(({ reserve, absents = [] }) => [reserve.includes(8), absents.includes(8)]), [
      [false, true],
      [false, true],
      [true, false],
      [true, false],
    ]);
    assert.deepEqual(partielle.avertissements.map(({ code, details }) => [code, details.participant, details.tours, details.tousLesTours]), [
      ['A_PLACER_DANS_LE_RETENU', 8, [3, 4], false],
    ]);
    const entiere = ajouter(charge, {});
    assert.deepEqual(entiere.avertissements.map(({ details }) => [details.tours, details.tousLesTours, details.remede]), [
      [[1, 2, 3, 4], true, { geste: 'afficherTour', tour: 1 }],
    ]);
  });
});

describe('exclure, supprimer : les rencontres retirées du retenu (§ 4.4, § 9)', () => {
  test('exclure une personne assise aux tours 1 et 2 : elle quitte le retenu, RENCONTRES_RETIREES_DU_RETENU {tours: [1, 2]}', () => {
    const charge = chargeDe();
    const rendu = executer('exclureParticipant', charge, { id: 6 });
    assert.equal(rendu.libelle, 'Exclu Capucine Sarcelle ; placement retenu ajusté');
    assert.deepEqual(rendu.avertissements, [
      { code: 'RENCONTRES_RETIREES_DU_RETENU', details: { participant: 6, personne: 'Capucine Sarcelle', tours: [1, 2], remede: null } },
    ]);
    assert.ok(!rendu.charge.retenu.participants.includes(6));
    assert.deepEqual(etage(rendu.charge, 1).sieges, [[1, 2, 3], [4, 5]]);
    assert.deepEqual(etage(rendu.charge, 2).sieges, [[1, 4], [2, 3, 5]]);
  });

  test('la supprimer : le même avertissement, après celui de ses réservations', () => {
    const charge = chargeDe({ reservations: [resa(6, 1, 4)] });
    const rendu = executer('supprimerParticipant', charge, { id: 6 });
    assert.equal(rendu.libelle, 'Supprimé Capucine Sarcelle ; placement retenu ajusté');
    assert.deepEqual(rendu.avertissements.map(({ code, details }) => [code, details.tours ?? null]), [
      ['RESERVATIONS_RETIREES', null],
      ['RENCONTRES_RETIREES_DU_RETENU', [1, 2]],
    ]);
  });

  test('une personne en réserve à chaque tour : aucune rencontre retirée, le retenu ajusté quand même', () => {
    for (const nom of ['exclureParticipant', 'supprimerParticipant']) {
      const rendu = executer(nom, chargeDe(), { id: 7 });
      assert.deepEqual(rendu.avertissements, [], nom);
      assert.ok(!rendu.charge.retenu.participants.includes(7), nom);
    }
  });
});

describe('réintégrer et importer : une présence qui s’étend se contrôle (§ 5.9)', () => {
  test('la réintégration d’une exclue présente aux tours 1 et 2 ne se contrôle que sur ces tours ; présente partout, PLACE_RESERVEE', () => {
    // 3, exclue, réservée « tous » au siège 1 de la table 1 ; 4 réservée au
    // même siège au tour 3 seulement.
    const reservations = [resa(3, 1, 1), resa(4, 1, 1, 3)];
    const partielle = executer('reintegrerParticipant', chargeDe({ exclus: [3], presences: { 3: [1, 2] }, reservations }), { id: 3 });
    assert.equal(partielle.charge.participants[2].exclu, false);
    assert.deepEqual(partielle.avertissements.map(({ code, details }) => [code, details.tours ?? null]), [
      ['RESERVATIONS_RETABLIES', null],
      ['A_PLACER_DANS_LE_RETENU', [1, 2]],
    ]);
    refuse(() => executer('reintegrerParticipant', chargeDe({ exclus: [3], reservations }), { id: 3 }), 'PLACE_RESERVEE', { tour: 3 });
  });

  test('un import qui étend une présence sur une table pleine de réservations est refusé entier, remède null', () => {
    const reservations = [resa(1, 1, null), resa(2, 1, null), resa(3, 1, null), resa(4, 1, null), resa(5, 1, null, 3)];
    const charge = chargeDe({ retenu: false, presences: { 4: [1, 2, 4] }, reservations });
    const texte = 'nom;prenom;presence\nGrisaille;;tous\nSarcelle;Capucine;2\n';
    const args = { apercu: apercevoir(texte, { participants: charge.participants, mode: 'mettreAJour', tours: 4 }), mode: 'mettreAJour' };
    const leve = refuse(() => executer('importerParticipants', charge, args), 'SURRESERVATION', { table: 1, tour: 3, remede: null });
    assert.deepEqual(leve.details.autres, []);
  });
});
