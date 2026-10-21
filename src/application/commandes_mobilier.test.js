// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des commandes du mobilier (§ 4, § 4.3, § 5.9, § 6, § 7.1, § 8.2,
// § 9, § 15.4) : tables, défaut, tours et réglages. Chaque commande acceptée
// rend une charge que l'analyse relit et qui se normalise quand la charge
// reçue se normalisait ; un refus ne change rien. Les gestes qui comptent
// les entrées du journal, ou les avertissements que la séance ajoute,
// passent par seance.executer sur le système de fichiers d'épreuve. Les noms
// d'épreuve sont inventés ; la version vient du module engendré.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fautesBandes as fautesBandesPosees } from '../../test/bandes.js';
import { chargements } from '../../test/chargements.js';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { caseLibre } from '../geometrie/tables.js';
import { STATUT, nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import {
  CASES_FACULTATIVES,
  SIEGES_MAX,
  TOURS_MAX,
  analyser,
  capacite,
  configurationDepuisCharge,
  creerCharge,
  modeObjectifs,
  priorites,
} from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { gelerPropositions } from '../stockage/gel.js';
import { derive, examiner, fautes } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { invariantViole } from './avertissements.js';
import { COMMANDES, appliquerCommande } from './commandes.js';
import { COMMANDES_MOBILIER } from './commandes_mobilier.js';
import { ErreurCommande } from './erreurs.js';
import { libelle } from './libelles.js';
import { etatPlaces } from './places.js';
import { creerSeance } from './seance.js';

const V1 = VERSION.affichee;
const NOM = 'Soirée des Merles';
const DOC = { id: 'documents', chemin: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre' };

const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Grisaille', null],
  ['Bruyère', 'Anouk'],
  ['Sarcelle', 'Capucine'],
  ['Ancolie', 'Amandine'],
  ['Mélèze', 'Basile'],
  ['Quenouille', 'Hortense'],
  ['Pivoine', 'Gaspard'],
];

const personne = (id, autres = {}) => ({
  id,
  nom: NOMS[(id - 1) % NOMS.length][0],
  prenom: NOMS[(id - 1) % NOMS.length][1],
  organisation: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

const resa = (participant, table, siege, tour = null) => ({ participant, table, siege, portee: tour === null ? 'tous' : 'tour', tour });
const suite = (de, a) => Array.from({ length: a - de + 1 }, (_, rang) => de + rang);
const afficherTour = (tour) => ({ geste: 'afficherTour', tour, proposition: null });

// Une charge : les tables données ({id, sieges}, numéro égal à l'identifiant
// sauf indication), n personnes dont les exclus, R tours, un défaut.
function chargeDe({ tables = [], n = 0, exclus = [], tours = 2, defaut = 8, attribuerSieges = false, reservations = [], titres = [] } = {}) {
  const charge = creerCharge({ id: 'evt-mobilier', nom: NOM, siegesParDefaut: defaut, tours });
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.participants = Array.from({ length: n }, (_, rang) => personne(rang + 1, { exclu: exclus.includes(rang + 1) }));
  charge.tables = tables.map(({ id, numero = id, sieges = null }) => ({ id, numero, sieges, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.reservations = reservations;
  charge.titres = titres;
  charge.prochainsIds = { participant: n + 1, table: Math.max(0, ...tables.map(({ id }) => id)) + 1, proposition: 1 };
  return charge;
}

// Ajoute la proposition id, ses listes dans l'ordre de charge.tables, et la
// retient quand retenu est vrai.
function placer(charge, listes, { id, retenu = false }) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id: p }) => p);
  const plan = {
    siegesAttribues: charge.reglages.attribuerSieges,
    tables: charge.tables.map(({ id: t }) => t),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: listes.length,
    participants,
    placement: listes.map((tour) => ({ sieges: tour, reserve: participants.filter((p) => !tour.flat().includes(p)) })),
  };
  charge.propositions.push({ id, graine: id, arret: 40, historique: 1000, produitVersion: V1, ...plan });
  charge.prochainsIds.proposition = id + 1;
  if (retenu) {
    charge.retenu = { proposition: id, ...structuredClone(plan) };
    charge.evenement.etat = 'retenu';
  } else if (charge.evenement.etat === 'brouillon') {
    charge.evenement.etat = 'propose';
  }
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

// La commande nom sur une copie de charge aux propositions figées : la charge
// rendue garde chaque proposition reçue, même objet au même rang, dans une
// liste neuve, et la charge reçue s'écrit comme avant.
function partageLesPropositions(nom, charge, args) {
  const recue = gelerPropositions(structuredClone(charge));
  const texte = JSON.stringify(recue);
  const { charge: rendue } = COMMANDES.get(nom)(recue, args);
  assert.notEqual(rendue.propositions, recue.propositions, nom);
  assert.equal(rendue.propositions.length, recue.propositions.length, nom);
  recue.propositions.forEach((p, rang) => assert.equal(rendue.propositions[rang], p, `${nom} : proposition ${p.id} recopiée`));
  assert.equal(JSON.stringify(recue), texte, nom);
}

// Vrai quand la configuration de la charge se normalise.
function seNormalise(charge) {
  try {
    normaliser(configurationDepuisCharge(charge));
    return true;
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return false;
    throw erreur;
  }
}

// Les fautes « une liste passe sur une autre table » des tables d'une
// charge, chacune à sa capacité (test/bandes.js) ; avec, l'identifiant de la
// table dont seules les paires s'examinent.
const fautesBandes = (charge, options) =>
  fautesBandesPosees(
    charge.tables.map((table) => ({ id: table.id, position: table.position, forme: table.forme, places: capacite(charge, table) })),
    options,
  );

// Une commande acceptée, sur une copie gelée de la charge : la charge rendue
// se relit, et se normalise quand la charge reçue se normalisait.
function accepter(nom, charge, args) {
  const recue = figer(structuredClone(charge));
  const rendu = appliquerCommande(nom, recue, args);
  analyser(serialiser(rendu.charge, { revision: 1, produitVersion: 'essai' }));
  if (seNormalise(recue)) assert.ok(seNormalise(rendu.charge), `${nom} : la charge rendue ne se normalise plus`);
  return rendu;
}

// Le refus d'une ErreurCommande de ce code ; ses détails contiennent ceux
// donnés.
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

// Le même refus, rendu par une promesse.
async function refuseAsync(promesse, code, attendus = {}) {
  let leve = null;
  try {
    await promesse;
  } catch (erreur) {
    leve = erreur;
  }
  return refuse(() => {
    if (leve !== null) throw leve;
  }, code, attendus);
}

// --- La séance d'épreuve ----------------------------------------------------

// Une séance sur le système d'épreuve, l'événement de la charge posé par le
// dépôt, ouvert et passé en écriture. entrees() compte les entrées du
// journal ; ecritures() les écritures du système.
async function seanceSur(charge) {
  const fs = creerFichiersSimules();
  fs.deposerDossier('documents');
  await creerDansLeDepot(fs, DOC, charge, {
    libelle: libelle('ENTREE_CREATION', { nom: NOM }),
    nomJalon: libelle('JALON_CREATION'),
    horodatage: '2031-05-17T07:00:00-04:00',
    produitVersion: V1,
  });
  let tirage = 0;
  const seance = creerSeance({
    fs,
    racine: DOC,
    horloge: { horodatage: () => '2031-05-17T08:00:00-04:00' },
    identifiant: () => {
      tirage += 1;
      return `seance-${tirage}`;
    },
    produitVersion: V1,
    planifier: () => 1,
    annuler: () => {},
  });
  await seance.ouvrir(NOM);
  await seance.passerEnEcriture();
  return {
    seance,
    entrees: () => lireJournal(fs.contenu('documents', `${NOM}${SUFFIXES.journal}`)).entrees.length,
    ecritures: () => fs.compteurs.ecritures,
  };
}

// --- Les épreuves -----------------------------------------------------------

describe('mobilier : le registre (§ 8.2)', () => {
  test('COMMANDES_MOBILIER porte les quatorze commandes du mobilier, réunies dans COMMANDES', () => {
    const noms = [
      'creerTable',
      'supprimerTable',
      'deplacerTable',
      'changerLibelleTable',
      'changerPlacesTable',
      'realignerTable',
      'changerDefaut',
      'changerTours',
      'modifierReglage',
      'poserObjectif',
      'retirerObjectif',
      'changerRegleObjectifs',
      'changerPriorites',
      'retablirPriorites',
    ];
    assert.deepEqual([...COMMANDES_MOBILIER.keys()], noms);
    for (const nom of noms) assert.equal(COMMANDES.get(nom), COMMANDES_MOBILIER.get(nom), nom);
  });

  test('un plan bloqué refuse chacune, PLAN_BLOQUE, remède debloquer', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    charge.evenement.etat = 'bloque';
    const gestes = [
      ['creerTable', { forme: 'ronde' }],
      ['supprimerTable', { id: 1 }],
      ['deplacerTable', { id: 1, position: { x: 5, y: 5 } }],
      ['changerLibelleTable', { id: 1, libelle: 'Honneur' }],
      ['changerPlacesTable', { id: 1, sieges: 6, origine: 'champ' }],
      ['realignerTable', { id: 1 }],
      ['changerDefaut', { sieges: 6, realigner: false }],
      ['changerTours', { tours: 3 }],
      ['modifierReglage', { cle: 'nouveauxVoisins', valeur: false }],
      ['poserObjectif', { table: 1, tour: null, etiquettes: 'finance', regle: null }],
      ['retirerObjectif', { table: 1, tour: null }],
      ['changerRegleObjectifs', { regle: 'et' }],
      ['changerPriorites', { paliers: [] }],
      ['retablirPriorites', {}],
    ];
    assert.equal(gestes.length, COMMANDES_MOBILIER.size);
    for (const [nom, args] of gestes) {
      refuse(() => COMMANDES.get(nom)(charge, args), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
    }
  });

  test('sur une charge aux propositions figées, chaque commande du mobilier les partage sans les écrire', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3, numero: 7 }], n: 6, tours: 3 });
    charge.participants[0].etiquettes = ['finance'];
    charge.participants[1].etiquettes = ['Montréal', 'finance'];
    placer(charge, [[[1, 2], [3, 4], [5, 6]], [[1, 3], [2, 5], [4, 6]], [[1, 4], [2, 6], [3, 5]]], { id: 1, retenu: true });
    placer(charge, [[[1, 6], [2, 3], [4, 5]], [[1, 5], [2, 4], [3, 6]], [[1, 2], [3, 5], [4, 6]]], { id: 2 });
    charge.tables[1].objectifs = [soiree(['finance'])];
    charge.reglages.priorites = COLLISIONS_JOINTES;
    const gestes = [
      ['creerTable', { forme: 'ronde' }],
      ['supprimerTable', { id: 3 }],
      ['deplacerTable', { id: 1, position: { x: 5, y: 5 } }],
      ['changerLibelleTable', { id: 2, libelle: 'Honneur' }],
      ['changerPlacesTable', { id: 2, sieges: 6, origine: 'champ' }],
      ['realignerTable', { id: 1 }],
      ['changerDefaut', { sieges: 6, realigner: false }],
      ['changerTours', { tours: 4 }],
      ['modifierReglage', { cle: 'nouveauxVoisins', valeur: false }],
      ['poserObjectif', { table: 1, tour: null, etiquettes: 'finance', regle: null }],
      ['retirerObjectif', { table: 2, tour: null }],
      ['changerRegleObjectifs', { regle: 'et' }],
      ['changerPriorites', { paliers: HORS_JOINTS }],
      ['retablirPriorites', {}],
    ];
    assert.equal(gestes.length, COMMANDES_MOBILIER.size);
    for (const [nom, args] of gestes) partageLesPropositions(nom, charge, args);
  });
});

describe('mobilier : créer, déplacer et supprimer une table (§ 4, § 6.1, § 9)', () => {
  test('une table créée se pose sur la grille des démonstrations : le pas tient compte des emprises et du bloc de noms, aucune liste ne passe sur une autre table', () => {
    let charge = chargeDe();
    for (let i = 0; i < 5; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    // Rondes de 8 : colonnes à 813 cm, rangées à 300 (ecartsGrille).
    assert.deepEqual(
      charge.tables.map(({ position }) => [position.x, position.y]),
      [[0, 0], [813, 0], [0, 300], [813, 300], [1626, 0]],
    );
    // La bande du bloc de noms de chaque table, de toute sa largeur, ne
    // recoupe l'emprise d'aucune autre.
    assert.deepEqual(fautesBandes(charge), { fautes: [], paires: 5 * 4 });
    // Une table passée à 16 places : le pas devient 966 × 430 ; toute case
    // à moins d'un pas d'une table posée, sur les deux axes, est prise, la
    // suivante est (1932, 430) : la table créée ne porte sa liste sur aucune
    // table, et aucune liste ne passe sur elle. La table 5 agrandie reçoit
    // la liste de sa voisine, la table 2 : l'agrandissement le dit
    // (LISTE_SUR_VOISINE), et la création ne le change pas.
    const agrandie = accepter('changerPlacesTable', charge, { id: 5, sieges: 16, origine: 'champ' });
    assert.deepEqual(agrandie.avertissements.map(({ code, details }) => [code, details.table, details.voisine]), [['LISTE_SUR_VOISINE', 5, 2]]);
    charge = agrandie.charge;
    charge = accepter('creerTable', charge, { forme: 'carree' }).charge;
    assert.deepEqual(charge.tables.at(-1).position, { x: 1932, y: 430 });
    assert.deepEqual(fautesBandes(charge, { avec: charge.tables.at(-1).id }), { fautes: [], paires: 2 * 5 });
  });

  test('dans la grande démonstration, la table 1 passée à 16 places : la table créée au pas 966 × 430 évite toute liste, (2898, 1720)', () => {
    // La case (4830, 0) est à 765 cm de la table (4065, 0), dont la liste,
    // de 4221,4 à 4721,4, couvrirait la table nouvelle, de 4709,6 à 4950,4 :
    // elle est prise, comme toute case à moins d'un pas d'une table posée.
    // La rangée 1720 est à 220 cm de la dernière rangée, de trois tables en
    // 0, 813 et 1626 : la case (2898, 1720) est la première libre. Seules
    // les paires où figure la table créée sont examinées : la table 1
    // agrandie porte sa liste sur sa voisine, ce que la création ne change
    // pas.
    let charge = analyser(texteLivre('grande')).charge;
    const premiere = charge.tables.find(({ numero }) => numero === 1);
    assert.deepEqual(premiere.position, { x: 0, y: 0 });
    const agrandie = accepter('changerPlacesTable', charge, { id: premiere.id, sieges: 16, origine: 'champ' });
    // Chaque voisine que la liste agrandie couvre est nommée, et ce sont
    // celles que l'épreuve des bandes voit.
    const couvertes = agrandie.avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE').map(({ details }) => details.voisine);
    assert.ok(couvertes.length > 0);
    const vues = new Set(
      agrandie.charge.tables
        .filter(({ id }) => id !== premiere.id && fautesBandes(agrandie.charge, { avec: id }).fautes.some((faute) => faute.includes(`table ${premiere.id} `)))
        .map(({ id }) => id),
    );
    assert.deepEqual(couvertes, [...vues]);
    // Les remèdes se suivent : chacun envoie sa voisine sur une case que ni
    // une table posée ni un remède précédent n'occupe, et les appliquer tous
    // dans l'ordre réussit sans qu'une table en recouvre une autre.
    const remedes = agrandie.avertissements
      .filter(({ code }) => code === 'LISTE_SUR_VOISINE')
      .map(({ details }) => details.remede.arguments);
    const cases = remedes.map(({ position }) => `${position.x},${position.y}`);
    assert.equal(new Set(cases).size, remedes.length);
    let suivie = agrandie.charge;
    for (const argumentsRemede of remedes) suivie = accepter('deplacerTable', suivie, argumentsRemede).charge;
    const posees = new Set(suivie.tables.map(({ position }) => `${position.x},${position.y}`));
    assert.equal(posees.size, suivie.tables.length);
    charge = agrandie.charge;
    charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    assert.deepEqual(charge.tables.at(-1).position, { x: 2898, y: 1720 });
    const creee = charge.tables.at(-1).id;
    assert.deepEqual(fautesBandes(charge, { avec: creee }), { fautes: [], paires: 2 * 33 });
  });

  test('agrandie, une table dont la liste couvre la voisine : LISTE_SUR_VOISINE {table, voisine}, remède le déplacement de la voisine vers une case libre, qui lève la faute', () => {
    let charge = chargeDe();
    for (let i = 0; i < 2; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    assert.deepEqual(charge.tables.map(({ position }) => [position.x, position.y]), [[0, 0], [813, 0]]);
    // Ronde de 16 en (0, 0) : sa liste, de 232,8 à 732,8, couvre l'emprise
    // de la voisine, de 692,6 à 933,4.
    const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 1, sieges: 16, origine: 'champ' });
    const autres = apres.tables
      .filter(({ id }) => id !== 2)
      .map((table) => ({ position: table.position, forme: table.forme, places: capacite(apres, table) }));
    const position = caseLibre(autres, { forme: 'ronde', places: 8 });
    assert.deepEqual(avertissements, [
      {
        code: 'LISTE_SUR_VOISINE',
        details: {
          table: 1,
          voisine: 2,
          numero: 1,
          numeroVoisine: 2,
          remede: { commande: 'deplacerTable', arguments: { id: 2, position } },
        },
      },
    ]);
    assert.equal(fautesBandes(apres).fautes.length, 1);
    const { commande, arguments: argumentsDuRemede } = avertissements[0].details.remede;
    const deplacee = accepter(commande, apres, argumentsDuRemede).charge;
    assert.deepEqual(fautesBandes(deplacee), { fautes: [], paires: 2 });
    const texte = libelle('LISTE_SUR_VOISINE', avertissements[0].details);
    assert.match(texte, /table 1\b/);
    assert.match(texte, /table 2\b/);
  });

  test('agrandie sans rien couvrir, ou réduite : aucun LISTE_SUR_VOISINE', () => {
    let charge = chargeDe();
    for (let i = 0; i < 2; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    // La table de droite, à 10 places : sa liste part vers la droite, où il
    // n'y a rien, et son emprise reste hors de la liste de la première.
    const droite = accepter('changerPlacesTable', charge, { id: 2, sieges: 10, origine: 'champ' });
    assert.deepEqual(droite.avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE'), []);
    assert.deepEqual(fautesBandes(droite.charge).fautes, []);
    const reduite = accepter('changerPlacesTable', charge, { id: 1, sieges: 6, origine: 'champ' });
    assert.deepEqual(reduite.avertissements, []);
    // Un recouvrement qui existait avant le geste n'est pas le sien.
    const serree = accepter('deplacerTable', charge, { id: 2, position: { x: 600, y: 0 } }).charge;
    assert.equal(fautesBandes(serree).fautes.length, 1);
    const encore = accepter('changerPlacesTable', serree, { id: 1, sieges: 9, origine: 'champ' });
    assert.deepEqual(encore.avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE'), []);
  });

  test("réalignée sous un défaut plus grand, une table surchargée dont la liste couvre la voisine : LISTE_SUR_VOISINE", () => {
    let charge = chargeDe();
    for (let i = 0; i < 2; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    // Les deux tables surchargées, à 6 et 8 places : le défaut passé à 16 ne
    // touche aucune d'elles, et ne dit rien.
    charge = accepter('changerPlacesTable', charge, { id: 1, sieges: 6, origine: 'champ' }).charge;
    charge = accepter('changerPlacesTable', charge, { id: 2, sieges: 8, origine: 'champ' }).charge;
    const defaut = accepter('changerDefaut', charge, { sieges: 16, realigner: false });
    assert.deepEqual(defaut.avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE'), []);
    // Réalignée, la table 1 passe à 16 places : sa liste couvre la table 2.
    const { charge: apres, avertissements } = accepter('realignerTable', defaut.charge, { id: 1 });
    const autres = apres.tables
      .filter(({ id }) => id !== 2)
      .map((table) => ({ position: table.position, forme: table.forme, places: capacite(apres, table) }));
    const position = caseLibre(autres, { forme: 'ronde', places: 8 });
    assert.deepEqual(
      avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE').map(({ details }) => [details.table, details.voisine, details.remede]),
      [[1, 2, { commande: 'deplacerTable', arguments: { id: 2, position } }]],
    );
  });

  test("le défaut agrandit deux voisines dans le même geste : leur recouvrement n'est dit qu'une fois, sous la table dont la liste couvre l'autre, remède le déplacement de la couverte", () => {
    let charge = chargeDe();
    for (let i = 0; i < 2; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    const { charge: apres, avertissements } = accepter('changerDefaut', charge, { sieges: 16, realigner: false });
    const autres = apres.tables
      .filter(({ id }) => id !== 2)
      .map((table) => ({ position: table.position, forme: table.forme, places: capacite(apres, table) }));
    const position = caseLibre(autres, { forme: 'ronde', places: 16 });
    assert.deepEqual(
      avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE').map(({ details }) => [details.table, details.voisine, details.remede]),
      [[1, 2, { commande: 'deplacerTable', arguments: { id: 2, position } }]],
    );
    // Le remède suivi lève la faute.
    const { commande, arguments: argumentsDuRemede } = avertissements.find(({ code }) => code === 'LISTE_SUR_VOISINE').details.remede;
    assert.deepEqual(fautesBandes(accepter(commande, apres, argumentsDuRemede).charge).fautes, []);
  });

  test("le défaut agrandit deux voisines dont la seconde de la charge porte sa liste sur la première : l'avertissement se dit sous la seconde, remède le déplacement de la première", () => {
    let charge = chargeDe();
    for (let i = 0; i < 2; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    // La table 1 passe à droite de la table 2 : la liste de la 2, tournée
    // vers la droite, va vers elle.
    charge = accepter('deplacerTable', charge, { id: 1, position: { x: 1626, y: 0 } }).charge;
    assert.deepEqual(fautesBandes(charge).fautes, []);
    const { charge: apres, avertissements } = accepter('changerDefaut', charge, { sieges: 16, realigner: false });
    const autres = apres.tables
      .filter(({ id }) => id !== 1)
      .map((table) => ({ position: table.position, forme: table.forme, places: capacite(apres, table) }));
    const position = caseLibre(autres, { forme: 'ronde', places: 16 });
    assert.deepEqual(
      avertissements.filter(({ code }) => code === 'LISTE_SUR_VOISINE').map(({ details }) => [details.table, details.voisine, details.remede]),
      [[2, 1, { commande: 'deplacerTable', arguments: { id: 1, position } }]],
    );
  });

  test('créée dans la grande démonstration, une table se pose sur la case suivante de sa grille, (2439, 1500)', () => {
    // 33 rondes de 8 sur six colonnes à 813 cm et des rangées à 300 cm ; la
    // trente-quatrième case, rang 33, est la colonne 3 de la rangée 5.
    const grande = analyser(texteLivre('grande')).charge;
    assert.equal(grande.tables.length, 33);
    const { charge } = accepter('creerTable', grande, { forme: 'ronde' });
    assert.deepEqual(charge.tables.at(-1).position, { x: 2439, y: 1500 });
  });

  test("les identifiants ne se réutilisent jamais ; le numéro suit le plus grand, et le libellé nomme le numéro", () => {
    let charge = chargeDe();
    for (let i = 0; i < 3; i += 1) charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    assert.deepEqual(charge.tables.map(({ id, numero }) => [id, numero]), [[1, 1], [2, 2], [3, 3]]);
    charge = accepter('supprimerTable', charge, { id: 3 }).charge;
    const cree = accepter('creerTable', charge, { forme: 'carree' });
    assert.equal(cree.libelle, 'Ajouté la table 3');
    assert.deepEqual(cree.charge.tables.at(-1), {
      id: 4,
      numero: 3,
      sieges: null,
      forme: 'carree',
      position: caseLibre(
        charge.tables.map((table) => ({ position: table.position, forme: table.forme, places: capacite(charge, table) })),
        { forme: 'carree', places: charge.evenement.siegesParDefaut },
      ),
    });
    assert.equal(cree.charge.prochainsIds.table, 5);
    const deplace = accepter('deplacerTable', cree.charge, { id: 4, position: { x: 612.4, y: -0.4 } });
    assert.equal(deplace.libelle, 'Déplacé la table 3');
    assert.deepEqual(deplace.charge.tables.at(-1).position, { x: 612, y: 0 });
    assert.ok(Object.is(deplace.charge.tables.at(-1).position.y, 0));
    // Une position que l'arrondi ne change pas : le geste est sans effet.
    refuse(() => appliquerCommande('deplacerTable', deplace.charge, { id: 4, position: { x: 611.6, y: 0.2 } }), 'SANS_EFFET');

    // Supprimer une table du milieu : le numéro suit encore le plus grand,
    // et non le nombre de tables.
    let milieu = chargeDe();
    for (let i = 0; i < 3; i += 1) milieu = accepter('creerTable', milieu, { forme: 'ronde' }).charge;
    milieu = accepter('supprimerTable', milieu, { id: 2 }).charge;
    const apresMilieu = accepter('creerTable', milieu, { forme: 'ronde' });
    assert.equal(apresMilieu.libelle, 'Ajouté la table 4');
    assert.deepEqual(apresMilieu.charge.tables.map(({ id, numero }) => [id, numero]), [[1, 1], [3, 3], [4, 4]]);
  });

  test('une forme inconnue, une table inconnue ou une position non finie sont des fautes du code', () => {
    const charge = chargeDe({ tables: [{ id: 1 }] });
    // Le message nomme la faute : une TypeError levée par une lecture de
    // propriété sur undefined ne passerait pas pour elle.
    assert.throws(() => COMMANDES.get('creerTable')(charge, { forme: 'ovale' }), { name: 'TypeError', message: /^forme : / });
    assert.throws(() => COMMANDES.get('supprimerTable')(charge, { id: 7 }), { name: 'TypeError', message: 'table inconnue : 7' });
    assert.throws(() => COMMANDES.get('deplacerTable')(charge, { id: 7, position: { x: 0, y: 0 } }), {
      name: 'TypeError',
      message: 'table inconnue : 7',
    });
    assert.throws(() => COMMANDES.get('deplacerTable')(charge, { id: 1, position: { x: Number.NaN, y: 0 } }), {
      name: 'TypeError',
      message: /^position : /,
    });
  });

  test('une table créée suit le défaut : sieges null, 8 places sous un défaut de 8, 10 sous un défaut de 10', () => {
    for (const defaut of [8, 10]) {
      const { charge } = accepter('creerTable', chargeDe({ defaut }), { forme: 'ronde' });
      assert.equal(charge.tables[0].sieges, null);
      assert.equal(capacite(charge, charge.tables[0]), defaut);
    }
    const huit = accepter('creerTable', chargeDe(), { forme: 'ronde' }).charge;
    const dix = accepter('changerDefaut', huit, { sieges: 10, realigner: false }).charge;
    assert.equal(capacite(dix, dix.tables[0]), 10);
  });

  test('une table créée se pose au pas de sa propre capacité, le défaut : sous un défaut de 16, à côté d’une ronde de 8, en (966, 0) et non en (813, 0)', () => {
    // Une ronde de 8 posée en (0, 0) : la grille a deux colonnes, et la case
    // (0, 0) est prise. Le pas se calcule sur la plus grande emprise, celle
    // de la table nouvelle à 16 places : 966 cm entre colonnes, là où deux
    // rondes de 8 n'en demandent que 813.
    const charge = chargeDe({ tables: [{ id: 1, sieges: 8 }], defaut: 16 });
    charge.tables[0].position = { x: 0, y: 0 };
    const { charge: apres } = accepter('creerTable', charge, { forme: 'ronde' });
    const creee = apres.tables.at(-1);
    assert.equal(capacite(apres, creee), 16);
    assert.deepEqual(creee.position, { x: 966, y: 0 });
    assert.deepEqual(fautesBandes(apres), { fautes: [], paires: 2 });
  });

  test('une table créée après la retenue entre au retenu, vide à chaque tour ; les propositions dérivent TABLE_AJOUTEE', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 6 });
    const listes = [[[1, 2, 3], [4, 5, 6]], [[1, 4, 5], [2, 3, 6]]];
    placer(charge, listes, { id: 1 });
    placer(charge, listes, { id: 2, retenu: true });
    const { charge: apres, libelle: texte } = accepter('creerTable', charge, { forme: 'ronde' });
    assert.equal(texte, 'Ajouté la table 3');
    assert.deepEqual(apres.retenu.tables, [1, 2, 3]);
    assert.deepEqual(apres.retenu.capacites, [8, 8, 8]);
    for (const { sieges } of apres.retenu.placement) assert.deepEqual(sieges.at(-1), []);
    assert.deepEqual(fautes(apres.retenu), []);
    assert.deepEqual(derive(apres.retenu, apres), []);
    assert.deepEqual(apres.propositions, charge.propositions);
    assert.deepEqual(examiner(apres).derives, [
      { id: 1, raisons: [{ code: 'TABLE_AJOUTEE', table: 3 }] },
      { id: 2, raisons: [{ code: 'TABLE_AJOUTEE', table: 3 }] },
    ]);
    // Un retenu fautif ne se réécrit pas.
    const fautif = structuredClone(charge);
    fautif.retenu.capacites = [8];
    const sansRetouche = accepter('creerTable', fautif, { forme: 'ronde' }).charge;
    assert.deepEqual(sansRetouche.retenu, fautif.retenu);
  });

  test("identifiant contre numéro : supprimer la table 2 laisse la réservation et les listes de la table 3 du retenu", () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 6, reservations: [resa(1, 3, null)] });
    placer(charge, [[[2, 3], [4, 5], [1, 6]], [[4, 6], [2, 3], [1, 5]]], { id: 1, retenu: true });
    const { charge: apres, libelle: texte } = accepter('supprimerTable', charge, { id: 2 });
    assert.equal(texte, 'Supprimé la table 2');
    assert.deepEqual(apres.tables.map(({ id, numero }) => [id, numero]), [[1, 1], [3, 3]]);
    assert.deepEqual(apres.reservations, [resa(1, 3, null)]);
    assert.deepEqual(apres.retenu, charge.retenu);
    assert.ok(examiner(apres).retenu.raisons.some(({ code, table }) => code === 'TABLE_SUPPRIMEE' && table === 2));
  });

  test("supprimer une table garnie retire, dans la même entrée, ses réservations et ses titres", async () => {
    const charge = chargeDe({
      tables: [{ id: 1 }, { id: 2 }],
      n: 4,
      reservations: [resa(2, 2, 2), resa(1, 1, null), resa(3, 2, null, 1)],
      titres: [{ table: 2, siege: 2, libelle: 'animateur' }, { table: 1, siege: 1, libelle: 'accueil' }],
    });
    const { seance, entrees } = await seanceSur(charge);
    const avant = entrees();
    const rendu = await seance.executer('supprimerTable', { id: 2 });
    assert.equal(rendu.libelle, 'Supprimé la table 2 ; retirés : 2 réservations et 1 titre');
    assert.equal(entrees() - avant, 1);
    assert.deepEqual(seance.charge.reservations, [resa(1, 1, null)]);
    assert.deepEqual(seance.charge.titres, [{ table: 1, siege: 1, libelle: 'accueil' }]);
    // Au singulier : une réservation, un titre ; une table nue ne retire rien.
    const seule = await seance.executer('supprimerTable', { id: 1 });
    assert.equal(seule.libelle, 'Supprimé la table 1 ; retirés : 1 réservation et 1 titre');
    const vide = accepter('supprimerTable', chargeDe({ tables: [{ id: 4 }] }), { id: 4 });
    assert.equal(vide.libelle, 'Supprimé la table 4');
  });

  test('le manque : supprimer une table de 8 sous Σ c = N = 16 avertit PLACES_MANQUANTES {8} ; ramener une table à 6, {2}', async () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 16 });
    const un = await seanceSur(charge);
    const rendu = await un.seance.executer('supprimerTable', { id: 2 });
    assert.equal(nombrePlacesManquantes(normaliser(configurationDepuisCharge(un.seance.charge))), 8);
    assert.deepEqual(rendu.avertissements, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 8 } }]);
    const deux = await seanceSur(charge);
    const reduit = await deux.seance.executer('changerPlacesTable', { id: 1, sieges: 6, origine: 'champ' });
    assert.deepEqual(reduit.avertissements, [{ code: 'PLACES_MANQUANTES', details: { placesManquantes: 2 } }]);
  });
});

describe('mobilier : le libellé d’une table (§ 4, § 8.9)', () => {
  // Soixante points de code, dont des lettres hors du plan de base.
  const SOIXANTE = `Coin ${'\u{1D49C}'.repeat(30)} ${'é'.repeat(24)}`;

  test('le libellé saisi entre en NFC, ses blancs de bord retirés, sur la seule table nommée ; une entrée au libellé figé', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2, numero: 5 }], n: 4 });
    const pose = accepter('changerLibelleTable', charge, { id: 2, libelle: '  Table d\u{2019}honneur\u{0009} ' });
    assert.equal(pose.libelle, 'Table 5 : libellé « Table d\u{2019}honneur »');
    assert.deepEqual(pose.avertissements, []);
    assert.equal(pose.charge.tables[1].libelle, 'Table d\u{2019}honneur');
    assert.equal(Object.hasOwn(pose.charge.tables[0], 'libelle'), false);
    const nfc = accepter('changerLibelleTable', charge, { id: 1, libelle: 'E\u{0301}tage' });
    assert.equal(nfc.charge.tables[0].libelle, '\u{00C9}tage');
    // Un nouveau libellé remplace l'ancien.
    const change = accepter('changerLibelleTable', pose.charge, { id: 2, libelle: 'Coin des invités' });
    assert.equal(change.charge.tables[1].libelle, 'Coin des invités');
    assert.equal(change.libelle, 'Table 5 : libellé « Coin des invités »');
  });

  test('un libellé vide, ou fait de blancs, retire le champ ; retirer un libellé absent, ou reposer le même, est sans effet', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2, numero: 5 }], n: 4 });
    const pose = accepter('changerLibelleTable', charge, { id: 2, libelle: 'Honneur' }).charge;
    const retire = accepter('changerLibelleTable', pose, { id: 2, libelle: ' \u{0009} ' });
    assert.equal(retire.libelle, 'Table 5 : libellé retiré');
    assert.equal(Object.hasOwn(retire.charge.tables[1], 'libelle'), false);
    assert.equal(serialiser(retire.charge, { revision: 1, produitVersion: 'essai' }), serialiser(charge, { revision: 1, produitVersion: 'essai' }));
    refuse(() => appliquerCommande('changerLibelleTable', charge, { id: 2, libelle: '' }), 'SANS_EFFET');
    refuse(() => appliquerCommande('changerLibelleTable', pose, { id: 2, libelle: ' Honneur ' }), 'SANS_EFFET');
  });

  test('au-delà de LIBELLE_TABLE_MAX points de code, comptés après NFC et sans les blancs de bord : LIBELLE_TABLE_TROP_LONG, remède nul', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    assert.equal([...SOIXANTE].length, 60);
    assert.equal(accepter('changerLibelleTable', charge, { id: 1, libelle: ` ${SOIXANTE} ` }).charge.tables[0].libelle, SOIXANTE);
    assert.equal(accepter('changerLibelleTable', charge, { id: 1, libelle: 'e\u{0301}'.repeat(60) }).charge.tables[0].libelle, '\u{00E9}'.repeat(60));
    const leve = refuse(() => COMMANDES.get('changerLibelleTable')(charge, { id: 1, libelle: `${SOIXANTE}x` }), 'LIBELLE_TABLE_TROP_LONG', {
      longueur: 61,
      maximum: 60,
    });
    assert.equal(leve.details.remede, null);
    assert.equal(libelle('LIBELLE_TABLE_TROP_LONG', leve.details), "Le libellé compte 61 caractères : celui d'une table en compte au plus 60.");
  });

  test('une moitié de paire de substitution isolée devient le caractère de remplacement : le fichier reste lisible', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    assert.equal(accepter('changerLibelleTable', charge, { id: 1, libelle: 'Hon\u{D800}neur' }).charge.tables[0].libelle, 'Hon\u{FFFD}neur');
  });

  test('un libellé qui n\u{2019}est pas un texte, ou une table inconnue, sont des fautes du code', () => {
    const charge = chargeDe({ tables: [{ id: 1 }] });
    assert.throws(() => COMMANDES.get('changerLibelleTable')(charge, { id: 1, libelle: null }), { name: 'TypeError', message: /^libelle : / });
    assert.throws(() => COMMANDES.get('changerLibelleTable')(charge, { id: 7, libelle: 'Honneur' }), {
      name: 'TypeError',
      message: 'table inconnue : 7',
    });
  });

  test('ni dérive ni changement de la configuration du moteur : propositions et retenu restent comparables, une entrée au journal', async () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 4, tours: 2 });
    placer(charge, [[[1, 2], [3, 4]], [[1, 3], [2, 4]]], { id: 1, retenu: true });
    placer(charge, [[[1, 4], [2, 3]], [[1, 2], [3, 4]]], { id: 2 });
    const rendu = accepter('changerLibelleTable', charge, { id: 2, libelle: 'Honneur' });
    assert.deepEqual(configurationDepuisCharge(rendu.charge), configurationDepuisCharge(charge));
    for (const placement of [...rendu.charge.propositions, rendu.charge.retenu]) assert.deepEqual(derive(placement, rendu.charge), [], String(placement.id ?? 'retenu'));
    const { seance, entrees } = await seanceSur(charge);
    const avant = entrees();
    await seance.executer('changerLibelleTable', { id: 1, libelle: 'Coin' });
    assert.equal(entrees(), avant + 1);
    assert.equal(seance.charge.tables[0].libelle, 'Coin');
  });
});

describe("mobilier : les places d'une table, par le champ et par la poignée (§ 6.2, § 7.1)", () => {
  test('les saisies : « 1 » et « 0 » refusent MOINS_DE_DEUX ; un texte non entier, NON_ENTIER ; « 2 » passe', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    for (const sieges of ['1', '0']) {
      refuse(() => COMMANDES.get('changerPlacesTable')(charge, { id: 1, sieges, origine: 'champ' }), 'MOINS_DE_DEUX', { remede: null });
    }
    const textes = ['-3', '2.5', '2,5', '8abc', 'huit', ''];
    assert.equal(textes.length, 6);
    for (const sieges of textes) {
      refuse(() => COMMANDES.get('changerPlacesTable')(charge, { id: 1, sieges, origine: 'champ' }), 'NON_ENTIER', { saisie: sieges, remede: null });
    }
    const deux = accepter('changerPlacesTable', charge, { id: 1, sieges: '2', origine: 'champ' });
    assert.equal(deux.charge.tables[0].sieges, 2);
    assert.equal(deux.libelle, 'Table 1 : 2 places');
  });

  test("une surcharge au défaut est une surcharge ; réaligner la retire, et le libellé nomme le défaut", () => {
    const charge = chargeDe({ tables: [{ id: 5, numero: 2 }], n: 2 });
    const surchargee = accepter('changerPlacesTable', charge, { id: 5, sieges: 8, origine: 'champ' });
    assert.equal(surchargee.charge.tables[0].sieges, 8);
    assert.equal(surchargee.libelle, 'Table 2 : 8 places');
    const realignee = accepter('realignerTable', surchargee.charge, { id: 5 });
    assert.equal(realignee.charge.tables[0].sieges, null);
    assert.equal(realignee.libelle, 'Table 2 : suit le défaut (8 places)');
    refuse(() => appliquerCommande('realignerTable', realignee.charge, { id: 5 }), 'SANS_EFFET');
  });

  test("le champ dans le retenu, sièges attribués : les occupants des chaises 7 et 8 passent en réserve, la capacité du retenu suit", () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 18, attribuerSieges: true });
    placer(
      charge,
      [
        [suite(1, 6), suite(7, 12), suite(13, 18)],
        [suite(1, 5), suite(6, 10), [18, 11, 12, 13, 14, 15, 16, 17]],
      ],
      { id: 1, retenu: true },
    );
    const chaises = etatPlaces(charge, { tour: 2 }).tables[2].chaises;
    const personnes = [chaises[6].occupant, chaises[7].occupant];
    assert.deepEqual(personnes, [16, 17]);
    const { charge: apres, avertissements, libelle: texte } = accepter('changerPlacesTable', charge, { id: 3, sieges: 6, origine: 'champ' });
    assert.equal(texte, 'Table 3 : 6 places');
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 3, tour: 2, personnes } }]);
    const etage = apres.retenu.placement[1];
    assert.deepEqual(etage.sieges[2], [18, 11, 12, 13, 14, 15]);
    assert.deepEqual(etage.reserve, [16, 17]);
    assert.deepEqual([...etage.sieges.flat(), ...etage.reserve].sort((a, b) => a - b), suite(1, 18));
    assert.deepEqual(apres.retenu.placement[0], charge.retenu.placement[0]);
    assert.deepEqual(apres.retenu.capacites, [8, 8, 6]);
    assert.deepEqual(fautes(apres.retenu), []);
    assert.deepEqual(derive(apres.retenu, apres), []);
    assert.deepEqual(apres.propositions, charge.propositions);
    assert.deepEqual(derive(apres.propositions[0], apres), [{ code: 'CAPACITE_CHANGEE', table: 3, avant: 8, maintenant: 6 }]);
  });

  test("le champ dans le retenu, sièges non attribués : la personne réservée au siège 2 reste, les deux suivantes partent", () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 18, reservations: [resa(18, 3, 2)] });
    placer(
      charge,
      [
        [suite(1, 6), suite(7, 12), suite(13, 18)],
        [suite(1, 5), suite(6, 10), suite(11, 18)],
      ],
      { id: 1, retenu: true },
    );
    const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 3, sieges: 6, origine: 'champ' });
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 3, tour: 2, personnes: [16, 17] } }]);
    assert.deepEqual(apres.retenu.placement[1].sieges[2], [11, 12, 13, 14, 15, 18]);
    assert.deepEqual(apres.retenu.placement[1].reserve, [16, 17]);
    assert.deepEqual(derive(apres.retenu, apres), []);
    // La personne réservée garde sa place au plan, au siège 2.
    assert.equal(etatPlaces(apres, { tour: 2 }).tables[2].chaises[1].occupant, 18);
  });

  test('sièges attribués : une liste réduite ne finit jamais par une chaise vide ; fautes(retenu) reste vide', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, attribuerSieges: true });
    placer(charge, [[suite(1, 6), [7, 8, 9, 10, 11, null, null, 12]]], { id: 1, retenu: true });
    for (const sieges of [6, 7]) {
      const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 2, sieges, origine: 'champ' });
      assert.deepEqual(apres.retenu.placement[0].sieges[1], [7, 8, 9, 10, 11]);
      assert.deepEqual(apres.retenu.placement[0].reserve, [12]);
      assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 2, tour: 1, personnes: [12] } }]);
      assert.deepEqual(fautes(apres.retenu), []);
    }
  });

  test('la poignée : 8 → 9 accepté, la capacité du retenu suit ; sous l\'occupation, SOUS_OCCUPES et rien ne change', () => {
    const cinq = suite(1, 5);
    const charge = chargeDe({ tables: [{ id: 1 }], n: 7, tours: 4 });
    placer(charge, [cinq, cinq, suite(1, 7), cinq].map((liste) => [liste]), { id: 1, retenu: true });
    const neuf = accepter('changerPlacesTable', charge, { id: 1, sieges: 9, origine: 'poignee' });
    assert.deepEqual(neuf.charge.retenu.capacites, [9]);
    assert.deepEqual(neuf.charge.retenu.placement, charge.retenu.placement);
    assert.deepEqual(neuf.avertissements, []);
    refuse(() => COMMANDES.get('changerPlacesTable')(charge, { id: 1, sieges: 6, origine: 'poignee' }), 'SOUS_OCCUPES', {
      table: 1,
      n: 7,
      tour: 3,
      remede: afficherTour(3),
    });
  });

  test('réaligner une table surchargée à 10 qui en assied dix, sous un défaut de 8 : deux surnuméraires', () => {
    const charge = chargeDe({ tables: [{ id: 1, sieges: 10 }, { id: 2 }], n: 16, tours: 1 });
    placer(charge, [[suite(1, 10), suite(11, 16)]], { id: 1, retenu: true });
    const { charge: apres, avertissements, libelle: texte } = accepter('realignerTable', charge, { id: 1 });
    assert.equal(texte, 'Table 1 : suit le défaut (8 places)');
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [9, 10] } }]);
    assert.deepEqual(apres.retenu.placement[0].reserve, [9, 10]);
    assert.deepEqual(apres.retenu.capacites, [8, 8]);
    assert.deepEqual(derive(apres.retenu, apres), []);
  });

  test("une hausse n'assied personne que le plan ne montrait pas : un retenu déclaré à 10 sur une table de 8", () => {
    // Avec la personne 9 réservée à la table 1 sans siège : sièges attribués,
    // son rang 9 ne se montre pas et la hausse ne l'assied pas ; sans
    // attribution, l'affichage l'élit déjà, et la personne 8 n'est pas montrée.
    // La dérive du retenu masquait la réservation non tenue de la personne 9 ;
    // la capacité rejointe, invariantViole la nomme.
    const nonTenue = { code: 'INVARIANT_VIOLE', details: { proposition: 1, violations: [{ code: 'RESERVATION', participant: 9, table: 1, tour: 1 }] } };
    const cas = [
      { attribuerSieges: true, reservations: [], liste: suite(1, 8), reserve: [9, 10], invariant: null },
      { attribuerSieges: false, reservations: [], liste: suite(1, 8), reserve: [9, 10], invariant: null },
      { attribuerSieges: true, reservations: [resa(9, 1, null)], liste: suite(1, 8), reserve: [9, 10], invariant: nonTenue },
      { attribuerSieges: false, reservations: [resa(9, 1, null)], liste: [1, 2, 3, 4, 5, 6, 7, 9], reserve: [8, 10], invariant: null },
    ];
    for (const { attribuerSieges, reservations, liste, reserve, invariant } of cas) {
      for (const origine of ['champ', 'poignee']) {
        const charge = chargeDe({ tables: [{ id: 1, sieges: 10 }, { id: 2 }], n: 12, tours: 1, attribuerSieges, reservations });
        placer(charge, [[suite(1, 10), [11, 12]]], { id: 1, retenu: true });
        charge.tables[0].sieges = null;
        const montrees = etatPlaces(charge, { tour: 1 }).tables[0].chaises.map(({ occupant }) => occupant);
        const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 1, sieges: 10, origine });
        const nom = `attribuerSieges ${attribuerSieges}, ${reservations.length} réservation, ${origine}`;
        assert.deepEqual(montrees, liste, nom);
        assert.deepEqual(avertissements, [], nom);
        assert.deepEqual(apres.retenu.placement[0].sieges[0], liste, nom);
        assert.deepEqual(apres.retenu.placement[0].reserve, reserve, nom);
        assert.deepEqual(apres.retenu.capacites, [10, 8], nom);
        assert.deepEqual(derive(apres.retenu, apres), [], nom);
        assert.equal(invariantViole(charge), null, nom);
        assert.deepEqual(invariantViole(apres), invariant, nom);
      }
    }
  });

  test('un retenu de plus de tours que la soirée se réduit à chacun de ses tours, sans faute', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: 3, attribuerSieges: true });
    placer(charge, [[suite(1, 6), suite(7, 12)], [suite(1, 6), suite(7, 12)], [suite(1, 4), suite(5, 12)]], { id: 1, retenu: true });
    const deux = accepter('changerTours', charge, { tours: 2 }).charge;
    const { charge: apres, avertissements } = accepter('changerPlacesTable', deux, { id: 2, sieges: 6, origine: 'champ' });
    // Le tour 3 n'est plus de la soirée, mais le retenu le porte encore : ses
    // surnuméraires se nomment comme ceux d'un tour montré.
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 2, tour: 3, personnes: [11, 12] } }]);
    assert.deepEqual(apres.retenu.placement[2].sieges[1], suite(5, 10));
    assert.deepEqual(apres.retenu.placement[2].reserve, [11, 12]);
    assert.deepEqual(fautes(apres.retenu), []);
  });

  test('sans attribution, un tour du retenu que la soirée n\'a plus élit aussi la personne que la table réserve', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: 3, reservations: [resa(12, 2, null)] });
    placer(charge, [[suite(1, 6), suite(7, 12)], [suite(1, 6), suite(7, 12)], [suite(1, 4), suite(5, 12)]], { id: 1, retenu: true });
    const deux = accepter('changerTours', charge, { tours: 2 }).charge;
    const { charge: apres, avertissements } = accepter('changerPlacesTable', deux, { id: 2, sieges: 6, origine: 'champ' });
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 2, tour: 3, personnes: [10, 11] } }]);
    assert.deepEqual(apres.retenu.placement[2].sieges[1], [5, 6, 7, 8, 9, 12]);
    assert.deepEqual(apres.retenu.placement[2].reserve, [10, 11]);
    assert.deepEqual(fautes(apres.retenu), []);
  });

  test("une réduction acceptée garde chaque réservation que le retenu tenait : invariantViole reste null", () => {
    // La personne 8, réservée à la table 1 sans siège, est assise à la chaise 8.
    const gestes = [
      ['changerPlacesTable', { id: 1, sieges: 6, origine: 'champ' }],
      ['changerDefaut', { sieges: 6, realigner: false }],
    ];
    let acceptees = 0;
    for (const attribuerSieges of [true, false]) {
      for (const [nom, args] of gestes) {
        const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: 1, attribuerSieges, reservations: [resa(8, 1, null)] });
        placer(charge, [[suite(1, 8), suite(9, 12)]], { id: 1, retenu: true });
        assert.equal(invariantViole(charge), null);
        const { charge: apres, avertissements } = accepter(nom, charge, args);
        const cas = `${nom}, attribuerSieges ${attribuerSieges}`;
        assert.equal(invariantViole(apres), null, cas);
        // Un non-réservé cède sa chaise : la chaise 6, la plus haute, sous des
        // sièges attribués ; sinon l'affichage élit d'abord la réservée.
        assert.deepEqual(apres.retenu.placement[0].sieges[0], [1, 2, 3, 4, 5, 8], cas);
        assert.deepEqual(apres.retenu.placement[0].reserve, [6, 7], cas);
        assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [6, 7] } }], cas);
        assert.deepEqual(derive(apres.retenu, apres), [], cas);
        acceptees += 1;
      }
    }
    assert.equal(acceptees, 4);

    // Sièges attribués, une chaise vide dans la capacité reçoit la réservée
    // avant qu'un non-réservé ne cède la sienne.
    const vide = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: 1, attribuerSieges: true, reservations: [resa(8, 1, null)] });
    placer(vide, [[[1, 2, 3, null, 5, 6, 7, 8], suite(9, 12)]], { id: 1, retenu: true });
    const { charge: apres, avertissements } = accepter('changerPlacesTable', vide, { id: 1, sieges: 6, origine: 'champ' });
    assert.equal(invariantViole(apres), null);
    assert.deepEqual(apres.retenu.placement[0].sieges[0], [1, 2, 3, 8, 5, 6]);
    assert.deepEqual(apres.retenu.placement[0].reserve, [4, 7]);
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [7] } }]);

    // Réaligner une table surchargée à 10, la personne 10 réservée sans
    // siège, sous des sièges attribués comme sans attribution : la même liste.
    for (const attribuerSieges of [true, false]) {
      const dix = chargeDe({ tables: [{ id: 1, sieges: 10 }, { id: 2 }], n: 14, tours: 1, attribuerSieges, reservations: [resa(10, 1, null)] });
      placer(dix, [[suite(1, 10), suite(11, 14)]], { id: 1, retenu: true });
      const realignee = accepter('realignerTable', dix, { id: 1 });
      const cas = `realignerTable, attribuerSieges ${attribuerSieges}`;
      assert.equal(invariantViole(realignee.charge), null, cas);
      assert.deepEqual(realignee.charge.retenu.placement[0].sieges[0], [1, 2, 3, 4, 5, 6, 7, 10], cas);
      assert.deepEqual(realignee.charge.retenu.placement[0].reserve, [8, 9], cas);
      assert.deepEqual(realignee.avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [8, 9] } }], cas);
    }
  });

  test('sièges attribués, le retour des réservés : siège voulu, chaise libre ou d\'un absent, non-réservé du plus haut rang, ordre des rangs, tour couvert', () => {
    // La table 1, de 8, réduite à 6 par le champ ; les exclus le deviennent
    // après la retenue. Par tour : la liste qui reste, la réserve, et les
    // personnes de SURNUMERAIRES.
    const cas = [
      {
        nom: "une chaise tenue par un absent est libre : la personne 8 la prend, l'absent 2 passe en réserve",
        reservations: [resa(8, 1, null)],
        exclus: [2],
        listes: [[suite(1, 8), suite(9, 12)]],
        attendus: [[[1, 8, 3, 4, 5, 6], [2, 7], [7]]],
      },
      {
        nom: 'le siège réservé, libre, passe avant la première chaise libre',
        reservations: [resa(9, 1, 3), resa(9, 1, 4, 1)],
        listes: [[[1, null, null, null, 5, 6, 7, 9], [2, 3, 4, 8, 10, 11, 12]]],
        attendus: [[[1, null, 9, null, 5, 6], [7], [7]]],
      },
      {
        nom: "le siège réservé est le premier siège non nul des réservations de la personne, dans l'ordre canonique",
        reservations: [resa(9, 1, null), resa(9, 1, 4, 1)],
        listes: [[[1, null, null, null, 5, 6, 7, 9], [2, 3, 4, 8, 10, 11, 12]]],
        attendus: [[[1, null, null, 9, 5, 6], [7], [7]]],
      },
      {
        nom: "un siège réservé tenu par une personne présente n'est pas libre : le non-réservé du plus haut rang cède le sien",
        reservations: [resa(9, 1, 3)],
        listes: [[[1, 2, 3, 4, 5, 6, 7, 9], [8, 10, 11, 12]]],
        attendus: [[[1, 2, 3, 4, 5, 9], [6, 7], [6, 7]]],
      },
      {
        nom: 'une personne réservée ne cède pas sa chaise : la personne 5 part, la 6 reste',
        reservations: [resa(6, 1, null), resa(8, 1, null)],
        listes: [[suite(1, 8), suite(9, 12)]],
        attendus: [[[1, 2, 3, 4, 8, 6], [5, 7], [5, 7]]],
      },
      {
        nom: "dans l'ordre des rangs : la personne 7 prend la chaise vide, la 8 celle du plus haut rang",
        reservations: [resa(7, 1, null), resa(8, 1, null)],
        listes: [[[1, null, 3, 4, 5, 6, 7, 8], [2, 9, 10, 11, 12]]],
        attendus: [[[1, 7, 3, 4, 5, 8], [6], [6]]],
      },
      {
        nom: 'une réservation « tour » ramène sa personne au tour 2 seulement',
        reservations: [resa(8, 1, null, 2)],
        listes: [
          [suite(1, 8), suite(9, 12)],
          [suite(1, 8), suite(9, 12)],
        ],
        attendus: [
          [suite(1, 6), [7, 8], [7, 8]],
          [[1, 2, 3, 4, 5, 8], [6, 7], [6, 7]],
        ],
      },
      {
        nom: 'la réservation suspendue de la personne 8, exclue, ne la ramène pas',
        reservations: [resa(8, 1, null)],
        exclus: [8],
        listes: [[suite(1, 8), suite(9, 12)]],
        attendus: [[suite(1, 6), [7, 8], [7]]],
      },
    ];
    for (const { nom, reservations, exclus = [], listes, attendus } of cas) {
      const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: listes.length, attribuerSieges: true, reservations });
      placer(charge, listes, { id: 1, retenu: true });
      for (const id of exclus) charge.participants[id - 1].exclu = true;
      const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 1, sieges: 6, origine: 'champ' });
      attendus.forEach(([liste, reserve], rang) => {
        assert.deepEqual(apres.retenu.placement[rang].sieges[0], liste, `${nom}, tour ${rang + 1}`);
        assert.deepEqual(apres.retenu.placement[rang].reserve, reserve, `${nom}, tour ${rang + 1}`);
      });
      const surnumeraires = attendus.map(([, , personnes], rang) => ({ code: 'SURNUMERAIRES', details: { table: 1, tour: rang + 1, personnes } }));
      assert.deepEqual(avertissements, surnumeraires, nom);
      // La réduction n'ajoute aucune violation : un siège réservé que le
      // retenu donnait déjà à un autre peut le rester, rien d'autre.
      const violations = (etat) => (invariantViole(etat)?.details.violations ?? []).map((v) => JSON.stringify(v));
      const deja = violations(charge);
      assert.deepEqual(violations(apres).filter((v) => !deja.includes(v)), [], nom);
      // La réduction n'ajoute aucune raison de dérive ; un exclu garde la sienne.
      assert.deepEqual(derive(apres.retenu, apres), derive(charge.retenu, charge), nom);
      assert.deepEqual(fautes(apres.retenu), [], nom);
    }
  });

  test("sièges attribués, un tour du retenu que la soirée n'a plus ramène la personne qu'une réservation « tous » tient", () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: 3, attribuerSieges: true, reservations: [resa(12, 2, null)] });
    placer(charge, [[suite(1, 6), suite(7, 12)], [suite(1, 6), suite(7, 12)], [suite(1, 4), suite(5, 12)]], { id: 1, retenu: true });
    const deux = accepter('changerTours', charge, { tours: 2 }).charge;
    const { charge: apres, avertissements } = accepter('changerPlacesTable', deux, { id: 2, sieges: 6, origine: 'champ' });
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 2, tour: 3, personnes: [10, 11] } }]);
    assert.deepEqual(apres.retenu.placement[2].sieges[1], [5, 6, 7, 8, 9, 12]);
    assert.deepEqual(apres.retenu.placement[2].reserve, [10, 11]);
    assert.deepEqual(fautes(apres.retenu), []);
    assert.equal(invariantViole(apres), null);
  });

  test('une baisse ne ramène pas la personne réservée d\'un rang au-delà de la capacité courante, que le plan ne montrait pas', () => {
    // Le retenu déclare la table 1 à 10, qui n'en a plus que 8 : sièges
    // attribués, la personne 9, réservée sans siège, est au rang 9.
    // Sièges attribués, la réservation que le plan montrait non tenue le reste,
    // et invariantViole la nomme une fois la dérive levée ; sans attribution,
    // l'affichage élisait la personne 9, qui reste.
    const nonTenue = { code: 'INVARIANT_VIOLE', details: { proposition: 1, violations: [{ code: 'RESERVATION', participant: 9, table: 1, tour: 1 }] } };
    const cas = [
      { attribuerSieges: true, liste: suite(1, 6), reserve: [7, 8, 9, 10], personnes: [7, 8], invariant: nonTenue },
      { attribuerSieges: false, liste: [1, 2, 3, 4, 5, 9], reserve: [6, 7, 8, 10], personnes: [6, 7], invariant: null },
    ];
    for (const { attribuerSieges, liste, reserve, personnes, invariant } of cas) {
      const charge = chargeDe({ tables: [{ id: 1, sieges: 10 }, { id: 2 }], n: 12, tours: 1, attribuerSieges, reservations: [resa(9, 1, null)] });
      placer(charge, [[suite(1, 10), [11, 12]]], { id: 1, retenu: true });
      charge.tables[0].sieges = null;
      const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 1, sieges: 6, origine: 'champ' });
      const nom = `attribuerSieges ${attribuerSieges}`;
      assert.deepEqual(apres.retenu.placement[0].sieges[0], liste, nom);
      assert.deepEqual(apres.retenu.placement[0].reserve, reserve, nom);
      assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes } }], nom);
      assert.deepEqual(etatPlaces(charge, { tour: 1 }).reserve.includes(9), attribuerSieges, nom);
      assert.deepEqual(invariantViole(apres), invariant, nom);
    }
  });

  test('sans attribution, une liste qui dépasse encore perd ses absents, le plus petit identifiant d\'abord', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 12, tours: 1 });
    placer(charge, [[suite(1, 8), suite(9, 12)]], { id: 1, retenu: true });
    for (const id of [2, 3]) charge.participants[id - 1].exclu = true;
    const { charge: apres, avertissements } = accepter('changerPlacesTable', charge, { id: 1, sieges: 6, origine: 'champ' });
    // Six présents s'assoient ; les deux absents partent, le plus petit d'abord, jusqu'à six.
    assert.deepEqual(avertissements, []);
    assert.deepEqual(apres.retenu.placement[0].sieges[0], [1, 4, 5, 6, 7, 8]);
    assert.deepEqual(apres.retenu.placement[0].reserve, [2, 3]);
    const sept = accepter('changerPlacesTable', charge, { id: 1, sieges: 7, origine: 'champ' }).charge;
    assert.deepEqual(sept.retenu.placement[0].sieges[0], [1, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(sept.retenu.placement[0].reserve, [2]);
  });

  test('un compteur de tables saturé refuse COMPTEUR_SATURE ; une origine ou un réalignement de forme fausse sont des fautes du code', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    charge.prochainsIds.table = 2 ** 31 - 1;
    refuse(() => COMMANDES.get('creerTable')(charge, { forme: 'ronde' }), 'COMPTEUR_SATURE', { compteur: 'table', remede: null });
    assert.throws(() => COMMANDES.get('changerPlacesTable')(charge, { id: 1, sieges: 6, origine: 'clavier' }), TypeError);
    assert.throws(() => COMMANDES.get('changerDefaut')(charge, { sieges: 6 }), TypeError);
  });
});

describe('mobilier : changer le défaut (§ 6.1, § 6.2)', () => {
  function treizeTables(options = {}) {
    const surcharges = new Map([[3, 7], [6, 7], [9, 6], [12, 12]]);
    const tables = Array.from({ length: 13 }, (_, rang) => ({ id: rang + 1, sieges: surcharges.get(rang + 1) ?? null }));
    return chargeDe({ tables, n: 120, exclus: [40, 80], ...options });
  }
  const capacites = (charge) => charge.tables.map((table) => capacite(charge, table));

  test('appliquer : les quatre surchargées gardent 7, 7, 6 et 12, les neuf autres valent 10, une entrée ; réaligner : les treize suivent 10', async () => {
    const { seance, entrees } = await seanceSur(treizeTables());
    const avant = entrees();
    const rendu = await seance.executer('changerDefaut', { sieges: 10, realigner: false });
    assert.equal(rendu.libelle, 'Sièges par défaut : 10');
    assert.equal(entrees() - avant, 1);
    assert.deepEqual(capacites(seance.charge), [10, 10, 7, 10, 10, 7, 10, 10, 6, 10, 10, 12, 10]);
    assert.deepEqual(seance.charge.tables.filter(({ sieges }) => sieges !== null).map(({ id }) => id), [3, 6, 9, 12]);
    const realigne = await seance.executer('changerDefaut', { sieges: 10, realigner: true });
    assert.equal(realigne.libelle, 'Sièges par défaut : 10 ; 4 tables réalignées');
    assert.equal(entrees() - avant, 2);
    assert.ok(seance.charge.tables.every(({ sieges }) => sieges === null));
    assert.deepEqual(capacites(seance.charge), Array(13).fill(10));
  });

  test('réaligner refusé en bloc : le titre du siège 12 refuse, table et remède compris, et rien ne s\'écrit ; sans réaligner, accepté', async () => {
    const charge = treizeTables({ attribuerSieges: true, titres: [{ table: 12, siege: 12, libelle: 'animateur' }] });
    const { seance, ecritures } = await seanceSur(charge);
    const avant = ecritures();
    const leve = await refuseAsync(seance.executer('changerDefaut', { sieges: 10, realigner: true }), 'SIEGES_RETIRES', {
      table: 12,
      sieges: [{ siege: 12, cause: 'SIEGE_TITRE', libelle: 'animateur' }],
      remede: { commande: 'retirerTitre', arguments: { table: 12, siege: 12 } },
    });
    assert.deepEqual(leve.details.autres, []);
    assert.equal(ecritures(), avant);
    assert.deepEqual(capacites(seance.charge), capacites(charge));
    await seance.executer('changerDefaut', { sieges: 10, realigner: false });
    assert.equal(seance.charge.tables[11].sieges, 12);
  });

  test('baisse refusée en bloc : la table 2 porte 7 réservations ; le défaut 6 refuse, nommant la table 2, et les trois tables restent à 8', async () => {
    const reservations = suite(1, 7).map((id) => resa(id, 2, null));
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 20, reservations });
    const { seance, ecritures } = await seanceSur(charge);
    const avant = ecritures();
    await refuseAsync(seance.executer('changerDefaut', { sieges: 6, realigner: false }), 'SOUS_RESERVATIONS', {
      table: 2,
      n: 7,
      tour: 1,
      remede: afficherTour(1),
    });
    assert.equal(ecritures(), avant);
    assert.equal(seance.charge.evenement.siegesParDefaut, 8);
    assert.deepEqual(capacites(seance.charge), [8, 8, 8]);
    refuse(() => COMMANDES.get('changerDefaut')(charge, { sieges: '1', realigner: false }), 'MOINS_DE_DEUX', { remede: null });
    refuse(() => COMMANDES.get('changerDefaut')(charge, { sieges: 'six', realigner: false }), 'NON_ENTIER');
  });

  test('une baisse sous un retenu occupé : accepté, SURNUMERAIRES, et ces deux personnes dans la réserve du tour 2', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3 }], n: 18 });
    placer(
      charge,
      [
        [suite(1, 6), suite(7, 12), suite(13, 18)],
        [suite(1, 5), suite(6, 10), suite(11, 18)],
      ],
      { id: 1, retenu: true },
    );
    const { charge: apres, avertissements } = accepter('changerDefaut', charge, { sieges: 6, realigner: false });
    assert.deepEqual(avertissements, [{ code: 'SURNUMERAIRES', details: { table: 3, tour: 2, personnes: [17, 18] } }]);
    assert.deepEqual(apres.retenu.placement[1].reserve, [17, 18]);
    assert.deepEqual(apres.retenu.capacites, [6, 6, 6]);
    assert.deepEqual(derive(apres.retenu, apres), []);
  });

  test('un défaut au-delà du seuil de lisibilité avertit une fois', () => {
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 4 });
    const { avertissements } = accepter('changerDefaut', charge, { sieges: 40, realigner: false });
    assert.equal(avertissements.length, 1);
    assert.equal(avertissements[0].code, 'AU_DELA_LISIBLE');
  });
});

describe('mobilier : les tours (§ 2.1 étape 5, § 4.3)', () => {
  test('R = 4 → 3 → 4 : les réservations reviennent telles quelles, et la portée « tous » ancre encore au tour 4', () => {
    const debut = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 4, tours: 4, reservations: [resa(1, 2, null)] });
    const trois = accepter('changerTours', debut, { tours: 3 });
    assert.equal(trois.libelle, 'Nombre de tours : 3');
    const quatre = accepter('changerTours', trois.charge, { tours: '4' }).charge;
    assert.deepEqual(quatre.reservations, debut.reservations);
    const instance = normaliser(configurationDepuisCharge(quatre));
    const p = instance.indexDe.get(1);
    assert.equal(instance.statut[p], STATUT.ANCRE);
    assert.equal(instance.fixe[p * instance.R + 3], instance.indexTableDe.get(2));
  });

  test("retirer le tour 4 détruit ses réservations « tour », garde les autres, et laisse propositions et retenu en dérive", () => {
    const reservations = [resa(1, 1, null, 4), resa(2, 2, null, 4), resa(3, 1, null, 2), resa(4, 2, null)];
    const charge = chargeDe({ tables: [{ id: 1, sieges: 4 }, { id: 2, sieges: 4 }], n: 8, tours: 4, reservations });
    const listes = [[[1, 2, 3, 5], [4, 6, 7, 8]], [[1, 3, 5, 6], [2, 4, 7, 8]], [[1, 5, 6, 7], [2, 3, 4, 8]], [[1, 3, 5, 7], [2, 4, 6, 8]]];
    placer(charge, listes, { id: 1 });
    placer(charge, listes, { id: 2, retenu: true });
    const { charge: apres, libelle: texte } = accepter('changerTours', charge, { tours: 3 });
    assert.equal(texte, 'Nombre de tours : 3 ; 2 réservations retirées');
    assert.deepEqual(apres.reservations, [resa(3, 1, null, 2), resa(4, 2, null)]);
    analyser(serialiser(apres, { revision: 2, produitVersion: 'essai' }));
    assert.deepEqual(apres.propositions, charge.propositions);
    assert.deepEqual(apres.retenu, charge.retenu);
    assert.deepEqual(derive(apres.retenu, apres), [{ code: 'TOURS_CHANGES', avant: 4, maintenant: 3 }]);
  });

  test('3 → 4 : trois réservations « tour » à une table rendent B partiellement fixé ; propositions et retenu gardés, TOURS_CHANGES', () => {
    const b = 5;
    const reservations = [1, 2, 3].map((tour) => resa(b, 1, null, tour));
    const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }], n: 8, tours: 3, reservations });
    const listes = [[[1, 2, 3, 5], [4, 6, 7, 8]], [[4, 5, 6, 7], [1, 2, 3, 8]], [[1, 5, 7, 8], [2, 3, 4, 6]]];
    placer(charge, listes, { id: 1, retenu: true });
    const avant = normaliser(configurationDepuisCharge(charge));
    assert.equal(avant.statut[avant.indexDe.get(b)], STATUT.ANCRE);
    const { charge: apres } = accepter('changerTours', charge, { tours: 4 });
    const instance = normaliser(configurationDepuisCharge(apres));
    assert.equal(instance.statut[instance.indexDe.get(b)], STATUT.PARTIELLEMENT_FIXE);
    assert.deepEqual(apres.propositions, charge.propositions);
    assert.deepEqual(apres.retenu, charge.retenu);
    for (const placement of [apres.propositions[0], apres.retenu]) {
      assert.deepEqual(derive(placement, apres), [{ code: 'TOURS_CHANGES', avant: 3, maintenant: 4 }]);
    }
  });

  test('« 0 » refuse MOINS_D_UN_TOUR {tours: 0}, « 2.5 » et « x » NON_ENTIER, sans écriture', async () => {
    const { seance, ecritures } = await seanceSur(chargeDe({ tables: [{ id: 1 }], n: 2, tours: 2 }));
    const avant = ecritures();
    await refuseAsync(seance.executer('changerTours', { tours: '0' }), 'MOINS_D_UN_TOUR', { tours: 0, remede: null });
    for (const tours of ['2.5', 'x']) {
      await refuseAsync(seance.executer('changerTours', { tours }), 'NON_ENTIER', { saisie: tours, remede: null });
    }
    assert.equal(ecritures(), avant);
    assert.equal(seance.charge.evenement.tours, 2);
  });

  test('au-delà de TOURS_MAX : TROP_DE_TOURS {max}, remède null, sans écriture ; TOURS_MAX passe', async () => {
    const { seance, ecritures } = await seanceSur(chargeDe({ tables: [{ id: 1 }], n: 2, tours: 2 }));
    const avant = ecritures();
    for (const tours of [String(TOURS_MAX + 1), '99999999999']) {
      await refuseAsync(seance.executer('changerTours', { tours }), 'TROP_DE_TOURS', { max: TOURS_MAX, remede: null });
    }
    assert.equal(ecritures(), avant);
    await seance.executer('changerTours', { tours: String(TOURS_MAX) });
    assert.equal(seance.charge.evenement.tours, TOURS_MAX);
  });

  test('au-delà de SIEGES_MAX, le défaut comme une table refusent TROP_DE_PLACES {max}, remède null, sans rien écrire', async () => {
    const { seance, ecritures } = await seanceSur(chargeDe({ tables: [{ id: 1 }], n: 2, tours: 2 }));
    const avant = ecritures();
    await refuseAsync(seance.executer('changerDefaut', { sieges: '1000000', realigner: false }), 'TROP_DE_PLACES', { max: SIEGES_MAX, remede: null });
    await refuseAsync(
      seance.executer('changerPlacesTable', { id: 1, sieges: '99999999999', origine: 'champ' }),
      'TROP_DE_PLACES',
      { max: SIEGES_MAX, remede: null },
    );
    assert.equal(ecritures(), avant);
  });
});

describe('mobilier : les tours et la présence de chacun (§ 2.1 étape 5, § 4.3)', () => {
  // Six personnes, quatre tours : 2 présente aux tours 2 et 4, 3 aux tours 1
  // à 3, 4 aux tours 1 et 2, 5 exclue, présente au tour 4.
  const presentes = () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 6, tours: 4, exclus: [5] });
    const presences = { 2: [2, 4], 3: [1, 2, 3], 4: [1, 2], 5: [4] };
    for (const p of charge.participants) if (Object.hasOwn(presences, p.id)) p.presence = presences[p.id];
    return charge;
  };

  test('4 → 3 : chaque présence se rogne, canonique, exclues comprises ; une exclue dont la présence se vide perd le champ ; le libellé les compte', () => {
    const { charge: apres, libelle: texte, avertissements } = accepter('changerTours', presentes(), { tours: 3 });
    assert.deepEqual(
      apres.participants.map(({ id, presence = null }) => [id, presence]),
      [
        [1, null],
        [2, [2]],
        [3, null],
        [4, [1, 2]],
        [5, null],
        [6, null],
      ],
    );
    assert.ok(!Object.hasOwn(apres.participants[4], 'presence'));
    assert.equal(apres.participants[4].exclu, true);
    assert.equal(texte, 'Nombre de tours : 3 ; 3 présences rognées');
    assert.deepEqual(avertissements, []);
  });

  test('4 → 3 sur une personne présente au seul tour 4 : PRESENCE_VIDEE_PAR_TOURS la nomme, remède la section des participants, et rien ne change', () => {
    const charge = presentes();
    charge.participants[5].presence = [4];
    charge.participants[0].presence = [3, 4];
    const recue = figer(structuredClone(charge));
    refuse(() => appliquerCommande('changerTours', recue, { tours: 3 }), 'PRESENCE_VIDEE_PAR_TOURS', {
      participants: [{ participant: 6, personne: 'Capucine Sarcelle' }],
      tours: 3,
      remede: { geste: 'ouvrirSection', section: 'participants' },
    });
    refuse(() => appliquerCommande('changerTours', recue, { tours: 2 }), 'PRESENCE_VIDEE_PAR_TOURS', {
      participants: [
        { participant: 1, personne: 'Iris Ombrelle' },
        { participant: 6, personne: 'Capucine Sarcelle' },
      ],
      tours: 2,
    });
  });

  test('3 → 5 : une présence qui nomme ses tours ne s’étend pas ; PRESENCE_TOURS_AJOUTES nomme les non-exclues qui en portent une', () => {
    const charge = accepter('changerTours', presentes(), { tours: 3 }).charge;
    const { charge: apres, libelle: texte, avertissements } = accepter('changerTours', charge, { tours: 5 });
    assert.deepEqual(apres.participants, charge.participants);
    assert.equal(texte, 'Nombre de tours : 5');
    assert.deepEqual(avertissements, [
      {
        code: 'PRESENCE_TOURS_AJOUTES',
        details: {
          personnes: [
            { participant: 2, personne: 'Théo Pervenche' },
            { participant: 4, personne: 'Grisaille' },
          ],
        },
      },
    ]);
    // Sans présence énumérée, un tour de plus ne dit rien.
    assert.deepEqual(accepter('changerTours', chargeDe({ tables: [{ id: 1 }], n: 3, tours: 2 }), { tours: 3 }).avertissements, []);
  });
});

describe('mobilier : les réglages (§ 5.3, § 15.4)', () => {
  test('« Séparer les organisations : désactivé », une entrée', async () => {
    const { seance, entrees } = await seanceSur(chargeDe({ tables: [{ id: 1 }], n: 2 }));
    const avant = entrees();
    const rendu = await seance.executer('modifierReglage', { cle: 'separerOrganisations', valeur: false });
    assert.equal(rendu.libelle, 'Séparer les organisations : désactivé');
    assert.equal(entrees() - avant, 1);
    assert.equal(seance.charge.reglages.separerOrganisations, false);
  });

  test('chaque réglage nommé se change ; une clé inconnue ou une valeur de forme fausse est une faute du code', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    const attendus = [
      ['nouveauxVoisins', false, 'Nouveaux voisins à chaque tour : désactivé'],
      ['nouvelleTable', false, 'Nouvelle table à chaque tour : désactivé'],
      ['varierOrganisations', false, 'Varier les organisations rencontrées : désactivé'],
      ['attribuerSieges', true, 'Attribuer les sièges : activé'],
      ['generation.nombre', 8, 'Propositions par génération : 8'],
      ['generation.arret', 300000, 'Mouvements par proposition : 300000'],
      ['generation.historique', 500, "Historique d'acceptation : 500"],
    ];
    for (const [cle, valeur, texte] of attendus) {
      const rendu = accepter('modifierReglage', charge, { cle, valeur });
      assert.equal(rendu.libelle, texte);
      const [tete, queue] = cle.split('.');
      assert.equal(queue === undefined ? rendu.charge.reglages[tete] : rendu.charge.reglages[tete][queue], valeur);
    }
    assert.throws(() => COMMANDES.get('modifierReglage')(charge, { cle: 'couleur', valeur: true }), TypeError);
    assert.throws(() => COMMANDES.get('modifierReglage')(charge, { cle: 'nouveauxVoisins', valeur: 'non' }), TypeError);
    assert.throws(() => COMMANDES.get('modifierReglage')(charge, { cle: 'generation.nombre', valeur: 0 }), TypeError);
    refuse(() => appliquerCommande('modifierReglage', charge, { cle: 'nouveauxVoisins', valeur: true }), 'SANS_EFFET');
  });
});

describe('mobilier : la cible de la somme de redondance n’est plus un réglage (§ 8.9)', () => {
  test('aucune commande ne la pose : ni changerCibleRedondance au registre, ni modifierReglage sous sa clé', () => {
    assert.equal(COMMANDES.has('changerCibleRedondance'), false);
    assert.equal(COMMANDES_MOBILIER.has('changerCibleRedondance'), false);
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    assert.throws(() => COMMANDES.get('modifierReglage')(charge, { cle: 'cibleRedondance', valeur: 1200 }), TypeError);
  });

  test('une charge qui la porte encore se modifie par les autres commandes, et s’écrit sans elle', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    const ancienne = structuredClone(charge);
    ancienne.reglages.cibleRedondance = 1200;
    const rendu = accepter('modifierReglage', ancienne, { cle: 'nouveauxVoisins', valeur: false });
    const attendu = accepter('modifierReglage', charge, { cle: 'nouveauxVoisins', valeur: false });
    const texte = serialiser(rendu.charge, { revision: 1, produitVersion: V1 });
    assert.equal(texte.includes('cibleRedondance'), false);
    assert.equal(texte, serialiser(attendu.charge, { revision: 1, produitVersion: V1 }));
  });
});

// --- Les objectifs des tables, leur règle et les deux cases (§ 4.5, § 5.3, § 8.9) ---

// Une charge de trois tables et quatre personnes sur trois tours : Iris
// Ombrelle « finance », Théo Pervenche « finance » et « Montréal », Ondine
// Lacasse « ressources humaines », la quatrième sans étiquette.
function chargeEtiquetee() {
  const charge = chargeDe({ tables: [{ id: 1 }, { id: 2 }, { id: 3, numero: 7 }], n: 4, tours: 3 });
  charge.participants[0].etiquettes = ['finance'];
  charge.participants[1].etiquettes = ['Montréal', 'finance'];
  charge.participants[2].etiquettes = ['ressources humaines'];
  return charge;
}
const objectifsDe = (charge, id) => charge.tables.find((table) => table.id === id).objectifs;
const soiree = (etiquettes, regle = null) => ({ portee: 'tous', tour: null, regle, etiquettes });
const auTour = (tour, etiquettes, regle = null) => ({ portee: 'tour', tour, regle, etiquettes });

describe('mobilier : poser et retirer un objectif de table (§ 4.5, § 5.9, A2, A12)', () => {
  test('poser un objectif de soirée : sa règle suit le défaut, ses étiquettes triées, le champ en dernier ; le libellé nomme la table par son numéro', () => {
    const rendu = accepter('poserObjectif', chargeEtiquetee(), { table: 3, tour: null, etiquettes: 'finance ; Montréal', regle: null });
    assert.deepEqual(objectifsDe(rendu.charge, 3), [soiree(['Montréal', 'finance'])]);
    assert.equal(Object.keys(rendu.charge.tables[2]).at(-1), 'objectifs');
    assert.equal(rendu.libelle, 'Table 7 : objectif de la soirée « Montréal » et « finance », règle par défaut');
    assert.deepEqual(rendu.avertissements, []);
    assert.equal(Object.hasOwn(rendu.charge.tables[0], 'objectifs'), false);
  });

  test("les objectifs d'une table s'écrivent la soirée d'abord, puis les tours croissants, quel que soit l'ordre des gestes", () => {
    let une = chargeEtiquetee();
    for (const [tour, etiquettes] of [[3, 'Montréal'], [null, 'finance'], [1, 'ressources humaines']]) {
      une = accepter('poserObjectif', une, { table: 1, tour, etiquettes, regle: 'ou' }).charge;
    }
    let autre = chargeEtiquetee();
    for (const [tour, etiquettes] of [[1, 'ressources humaines'], [3, 'Montréal'], [null, 'finance']]) {
      autre = accepter('poserObjectif', autre, { table: 1, tour, etiquettes, regle: 'ou' }).charge;
    }
    const attendus = [soiree(['finance'], 'ou'), auTour(1, ['ressources humaines'], 'ou'), auTour(3, ['Montréal'], 'ou')];
    assert.deepEqual(objectifsDe(une, 1), attendus);
    assert.deepEqual(objectifsDe(autre, 1), attendus);
    assert.equal(serialiser(une, { revision: 1, produitVersion: V1 }), serialiser(autre, { revision: 1, produitVersion: V1 }));
  });

  test("poser sur un couple qui en porte un le remplace, la règle seule aussi ; la même liste sous un autre ordre est SANS_EFFET, comparée en ensemble", () => {
    const posee = accepter('poserObjectif', chargeEtiquetee(), { table: 2, tour: 2, etiquettes: 'finance, Montréal', regle: 'et' }).charge;
    const remplacee = accepter('poserObjectif', posee, { table: 2, tour: 2, etiquettes: 'ressources humaines', regle: null });
    assert.deepEqual(objectifsDe(remplacee.charge, 2), [auTour(2, ['ressources humaines'])]);
    assert.equal(remplacee.libelle, 'Table 2, tour 2 : objectif « ressources humaines », règle par défaut');
    refuse(() => COMMANDES.get('poserObjectif')(posee, { table: 2, tour: 2, etiquettes: 'Montréal | finance', regle: 'et' }), 'SANS_EFFET', {
      commande: 'poserObjectif',
      remede: null,
    });
    refuse(() => COMMANDES.get('poserObjectif')(posee, { table: 2, tour: 2, etiquettes: 'FINANCE, montreal', regle: 'et' }), 'SANS_EFFET');
    // Les mêmes étiquettes sous une autre règle : le défaut cède à une règle
    // propre, qui en change ensuite, et le libellé nomme la règle posée (D3).
    const charge = chargeEtiquetee();
    charge.tables[1].objectifs = [auTour(1, ['finance'])];
    const propre = accepter('poserObjectif', charge, { table: 2, tour: 1, etiquettes: 'finance', regle: 'et' });
    assert.deepEqual(objectifsDe(propre.charge, 2), [auTour(1, ['finance'], 'et')]);
    assert.equal(propre.libelle, 'Table 2, tour 1 : objectif « finance », toutes les étiquettes');
    const autre = accepter('poserObjectif', propre.charge, { table: 2, tour: 1, etiquettes: 'finance', regle: 'ou' });
    assert.deepEqual(objectifsDe(autre.charge, 2), [auTour(1, ['finance'], 'ou')]);
    assert.equal(autre.libelle, 'Table 2, tour 1 : objectif « finance », au moins une étiquette');
    const defaut = accepter('poserObjectif', autre.charge, { table: 2, tour: 1, etiquettes: 'finance', regle: null });
    assert.deepEqual(objectifsDe(defaut.charge, 2), [auTour(1, ['finance'])]);
  });

  test("la saisie se réconcilie sur l'événement entier, personnes et objectifs ; l'objectif remplacé ne s'impose pas", () => {
    const charge = chargeEtiquetee();
    charge.tables[0].objectifs = [soiree(['voile'])];
    const rendu = accepter('poserObjectif', charge, { table: 2, tour: null, etiquettes: 'VOILE, Finance', regle: null });
    assert.deepEqual(objectifsDe(rendu.charge, 2), [soiree(['finance', 'voile'])]);
    assert.deepEqual(
      rendu.avertissements.filter(({ code }) => code === 'ORTHOGRAPHE_RETENUE'),
      [
        { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'VOILE', retenue: 'voile' } },
        { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'Finance', retenue: 'finance' } },
      ],
    );
    // Seul à porter « voile », l'objectif de la table 1 change d'orthographe
    // en se reposant.
    const renomme = accepter('poserObjectif', charge, { table: 1, tour: null, etiquettes: 'Voile', regle: null });
    assert.deepEqual(objectifsDe(renomme.charge, 1), [soiree(['Voile'])]);
    assert.deepEqual(renomme.avertissements, [
      { code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 1, tour: null } },
      { code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'Voile', voisine: null } },
    ]);
  });

  test("les avis de l'objectif posé, et de lui seul : OBJECTIF_SANS_CORRESPONDANT, puis ETIQUETTE_ORPHELINE ; acceptés", () => {
    const charge = chargeEtiquetee();
    charge.tables[1].objectifs = [soiree(['plongée'])];
    const rendu = accepter('poserObjectif', charge, { table: 1, tour: 2, etiquettes: 'ressources humaines, Montréal', regle: 'et' });
    assert.deepEqual(rendu.avertissements, [{ code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 1, tour: 2 } }]);
    const orpheline = accepter('poserObjectif', charge, { table: 1, tour: null, etiquettes: 'plongée, escalade, finance', regle: null });
    assert.deepEqual(orpheline.avertissements, [
      { code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'escalade', voisine: null } },
      { code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'plongée', voisine: null } },
    ]);
    // Une orthographe qu'une personne porte est reçue : l'étiquette n'est pas
    // orpheline.
    charge.participants[3].etiquettes = ['Escalade'];
    const recue = accepter('poserObjectif', charge, { table: 1, tour: null, etiquettes: 'escalade', regle: null });
    assert.deepEqual(recue.avertissements, [{ code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'escalade', retenue: 'Escalade' } }]);
  });

  test('un tour hors de la soirée : OBJECTIF_HORS_SOIREE {tour}, remède null ; un tour non entier est une faute du code', () => {
    const charge = chargeEtiquetee();
    for (const tour of [0, 4]) {
      refuse(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour, etiquettes: 'finance', regle: null }), 'OBJECTIF_HORS_SOIREE', {
        tour,
        remede: null,
      });
    }
    for (const tour of [2.5, '2', undefined]) {
      assert.throws(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour, etiquettes: 'finance', regle: null }), TypeError);
    }
    for (const regle of ['OU', 'toutes', undefined]) {
      assert.throws(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour: null, etiquettes: 'finance', regle }), TypeError);
    }
  });

  test("une saisie sans étiquette : OBJECTIF_SANS_ETIQUETTE {table, tour}, remède « Retirer l'objectif » quand il existe", () => {
    const charge = chargeEtiquetee();
    refuse(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour: 2, etiquettes: ' ;, ', regle: null }), 'OBJECTIF_SANS_ETIQUETTE', {
      table: 1,
      tour: 2,
      remede: null,
    });
    charge.tables[0].objectifs = [auTour(2, ['finance'])];
    refuse(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour: 2, etiquettes: '', regle: null }), 'OBJECTIF_SANS_ETIQUETTE', {
      table: 1,
      tour: 2,
      remede: { commande: 'retirerObjectif', arguments: { table: 1, tour: 2 } },
    });
  });

  test('étiquette mal formée, vingt-et-unième étiquette : les refus de la saisie, remède null', () => {
    const charge = chargeEtiquetee();
    refuse(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour: null, etiquettes: 'finance, x\u{200B}y', regle: null }), 'ETIQUETTE_INVALIDE', {
      valeur: 'x\u{200B}y',
      raison: 'controle',
      remede: null,
    });
    const vingt = Array.from({ length: 20 }, (_, rang) => `e${rang}`).join(', ');
    assert.equal(objectifsDe(accepter('poserObjectif', charge, { table: 1, tour: null, etiquettes: vingt, regle: null }).charge, 1)[0].etiquettes.length, 20);
    refuse(() => COMMANDES.get('poserObjectif')(charge, { table: 1, tour: null, etiquettes: `${vingt}, e20`, regle: null }), 'ETIQUETTES_EN_TROP', {
      nombre: 21,
      remede: null,
    });
  });

  test("retirer : le dernier objectif retiré retire le champ ; un objectif absent est SANS_EFFET ; libellé par numéro", () => {
    const charge = chargeEtiquetee();
    charge.tables[2].objectifs = [soiree(['finance']), auTour(2, ['Montréal'], 'et')];
    const tour = accepter('retirerObjectif', charge, { table: 3, tour: 2 });
    assert.deepEqual(objectifsDe(tour.charge, 3), [soiree(['finance'])]);
    assert.equal(tour.libelle, "Table 7, tour 2 : objectif retiré");
    const tout = accepter('retirerObjectif', tour.charge, { table: 3, tour: null });
    assert.equal(Object.hasOwn(tout.charge.tables[2], 'objectifs'), false);
    assert.equal(tout.libelle, 'Table 7 : objectif de la soirée retiré');
    assert.equal(serialiser(tout.charge, { revision: 1, produitVersion: V1 }), serialiser(chargeEtiquetee(), { revision: 1, produitVersion: V1 }));
    refuse(() => COMMANDES.get('retirerObjectif')(charge, { table: 3, tour: 1 }), 'SANS_EFFET', { commande: 'retirerObjectif', remede: null });
    assert.throws(() => COMMANDES.get('retirerObjectif')(charge, { table: 3, tour: '2' }), TypeError);
  });

  test('une table disparue : TABLE_DISPARUE {table}, remède null, pour poser comme pour retirer', () => {
    const charge = chargeEtiquetee();
    refuse(() => COMMANDES.get('poserObjectif')(charge, { table: 9, tour: null, etiquettes: 'finance', regle: null }), 'TABLE_DISPARUE', {
      table: 9,
      remede: null,
    });
    refuse(() => COMMANDES.get('retirerObjectif')(charge, { table: 9, tour: null }), 'TABLE_DISPARUE', { table: 9, remede: null });
  });

  test("supprimer une table emporte ses objectifs, que le libellé compte", () => {
    const charge = chargeEtiquetee();
    charge.tables[1].objectifs = [soiree(['finance']), auTour(1, ['Montréal'])];
    const rendu = accepter('supprimerTable', charge, { id: 2 });
    assert.equal(rendu.libelle, 'Supprimé la table 2 ; retirés : 2 objectifs');
  });
});

describe("mobilier : la règle par défaut des objectifs (§ 4.5, D3)", () => {
  test("« toutes » se pose dans les réglages ; « au moins une » retire le champ ; la même règle est SANS_EFFET", () => {
    const charge = chargeEtiquetee();
    const et = accepter('changerRegleObjectifs', charge, { regle: 'et' });
    assert.equal(et.charge.reglages.regleObjectifs, 'et');
    assert.equal(et.libelle, 'Règle par défaut des objectifs : toutes les étiquettes');
    const ou = accepter('changerRegleObjectifs', et.charge, { regle: 'ou' });
    assert.equal(Object.hasOwn(ou.charge.reglages, 'regleObjectifs'), false);
    assert.equal(ou.libelle, 'Règle par défaut des objectifs : au moins une étiquette');
    assert.equal(serialiser(ou.charge, { revision: 1, produitVersion: V1 }), serialiser(charge, { revision: 1, produitVersion: V1 }));
    refuse(() => COMMANDES.get('changerRegleObjectifs')(charge, { regle: 'ou' }), 'SANS_EFFET', { commande: 'changerRegleObjectifs', remede: null });
    refuse(() => COMMANDES.get('changerRegleObjectifs')(et.charge, { regle: 'et' }), 'SANS_EFFET');
    for (const regle of ['ET', null, undefined]) assert.throws(() => COMMANDES.get('changerRegleObjectifs')(charge, { regle }), TypeError);
  });

  test("changer le défaut ne touche aucune règle propre, et dit les objectifs qui le suivent et ne servent plus personne", () => {
    const charge = chargeEtiquetee();
    charge.tables[0].objectifs = [soiree(['finance', 'ressources humaines'])];
    charge.tables[1].objectifs = [soiree(['finance', 'ressources humaines'], 'ou')];
    // La table 7 porte déjà ses avis avant le changement : ils ne se redisent
    // pas, seuls ceux que le changement fait naître sont rendus.
    charge.tables[2].objectifs = [soiree(['plongée'])];
    const rendu = accepter('changerRegleObjectifs', charge, { regle: 'et' });
    assert.deepEqual(objectifsDe(rendu.charge, 1), objectifsDe(charge, 1));
    assert.deepEqual(objectifsDe(rendu.charge, 2), objectifsDe(charge, 2));
    assert.deepEqual(rendu.avertissements, [{ code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 1, tour: null } }]);
    assert.deepEqual(accepter('changerRegleObjectifs', rendu.charge, { regle: 'ou' }).avertissements, []);
  });
});

describe('mobilier : les cases des objectifs et des animateurs (§ 5.3, § 8.9)', () => {
  test('chaque case ne s’écrit que hors de son défaut, et revenir au défaut retire le champ', () => {
    const charge = chargeEtiquetee();
    const decochee = accepter('modifierReglage', charge, { cle: 'respecterObjectifs', valeur: false });
    assert.equal(decochee.charge.reglages.respecterObjectifs, false);
    assert.equal(decochee.libelle, 'Respecter les objectifs des tables : désactivé');
    const recochee = accepter('modifierReglage', decochee.charge, { cle: 'respecterObjectifs', valeur: true });
    assert.equal(Object.hasOwn(recochee.charge.reglages, 'respecterObjectifs'), false);
    const cochee = accepter('modifierReglage', charge, { cle: 'rencontrerAnimateurs', valeur: true });
    assert.equal(cochee.charge.reglages.rencontrerAnimateurs, true);
    assert.equal(cochee.libelle, "Rencontrer le plus d'animateurs différents : activé");
    const decocheeAnim = accepter('modifierReglage', cochee.charge, { cle: 'rencontrerAnimateurs', valeur: false });
    assert.equal(Object.hasOwn(decocheeAnim.charge.reglages, 'rencontrerAnimateurs'), false);
    for (const fin of [recochee.charge, decocheeAnim.charge]) {
      assert.equal(serialiser(fin, { revision: 1, produitVersion: V1 }), serialiser(charge, { revision: 1, produitVersion: V1 }));
    }
  });

  test('une case à sa valeur courante est SANS_EFFET, sans écrire son défaut ; une valeur non booléenne est une faute du code', () => {
    const charge = chargeEtiquetee();
    for (const [cle, valeur] of [['respecterObjectifs', true], ['rencontrerAnimateurs', false]]) {
      refuse(() => COMMANDES.get('modifierReglage')(charge, { cle, valeur }), 'SANS_EFFET', { commande: 'modifierReglage', remede: null });
      assert.throws(() => COMMANDES.get('modifierReglage')(charge, { cle, valeur: 'oui' }), TypeError);
    }
  });

  test('les cases écrites hors de leur défaut sont celles de CASES_FACULTATIVES, que le registre importe du stockage sans la redéclarer', () => {
    const charge = chargeEtiquetee();
    for (const [cle, defaut] of CASES_FACULTATIVES) {
      const ecrite = accepter('modifierReglage', charge, { cle, valeur: !defaut });
      assert.equal(ecrite.charge.reglages[cle], !defaut, cle);
      const revenue = accepter('modifierReglage', ecrite.charge, { cle, valeur: defaut });
      assert.equal(Object.hasOwn(revenue.charge.reglages, cle), false, cle);
    }
    // Le registre charge le stockage, lu par l'analyseur même des gardes : la
    // boucle ci-dessus suit les cases et leurs défauts de l'export du stockage.
    const source = readFileSync(new URL('./commandes_mobilier.js', import.meta.url), 'utf8');
    assert.ok(chargements(source).some(({ specificateur }) => specificateur === '../stockage/document.js'));
  });
});

describe('mobilier : retirer des tours détruit leurs objectifs (§ 2.1 étape 5, A3)', () => {
  test('3 → 2 : les objectifs du tour 3 partent, ceux de la soirée et des tours restants demeurent ; le libellé les compte avec les réservations', () => {
    const charge = chargeEtiquetee();
    charge.tables[0].objectifs = [soiree(['finance']), auTour(3, ['Montréal'])];
    charge.tables[1].objectifs = [auTour(3, ['finance'])];
    charge.tables[2].objectifs = [auTour(2, ['finance'])];
    charge.reservations = [resa(1, 1, null, 3)];
    const rendu = accepter('changerTours', charge, { tours: 2 });
    assert.deepEqual(objectifsDe(rendu.charge, 1), [soiree(['finance'])]);
    assert.equal(Object.hasOwn(rendu.charge.tables[1], 'objectifs'), false);
    assert.deepEqual(objectifsDe(rendu.charge, 3), [auTour(2, ['finance'])]);
    assert.equal(rendu.libelle, 'Nombre de tours : 2 ; 1 réservation retirée, 2 objectifs retirés');
    // Remettre le tour ne rend pas ses objectifs : ils sont détruits.
    const remis = accepter('changerTours', rendu.charge, { tours: 3 }).charge;
    assert.deepEqual(objectifsDe(remis, 1), [soiree(['finance'])]);
    assert.equal(accepter('changerTours', charge, { tours: 4 }).libelle, 'Nombre de tours : 4');
  });
});

// --- L'ordre des priorités et le mode des objectifs (§ 5.3, § 5.7, § 5.9, A11, A12, D19, D23) ---

const ECART = 'ecartAuPlafondAPrioriMax';
const EXCEDENT = 'excedentCollisions';
const CUMULEES = 'collisionsCumulees';
const HORS = 'toursHorsObjectif';
const REPETEES = 'rencontresRepetees';
const ANIMATEURS = 'animateursNonRencontres';
const REDONDANCE = 'redondance';

// Une liste de priorités : chaque palier, un nom seul au poids 1, ou une
// liste de [nom, poids].
const ordre = (...paliers) =>
  paliers.map((palier) =>
    typeof palier === 'string' ? [{ critere: palier, poids: 1 }] : palier.map(([critere, poids]) => ({ critere, poids })),
  );
// L'ordre par défaut, écrit en clair.
const DEFAUT = ordre(EXCEDENT, REPETEES, CUMULEES, ECART, HORS, ANIMATEURS, REDONDANCE);
// L'excédent et les collisions cumulées ensemble, pondérés, au palier 1.
const COLLISIONS_JOINTES = ordre([[EXCEDENT, 2], [CUMULEES, 3]], REPETEES, ECART, HORS, ANIMATEURS, REDONDANCE);
// Les tours hors objectif joints à l'excédent, au palier 2.
const HORS_JOINTS = ordre(ECART, [[EXCEDENT, 1], [HORS, 3]], CUMULEES, REPETEES, ANIMATEURS, REDONDANCE);

const texteDe = (charge) => serialiser(charge, { revision: 1, produitVersion: V1 });

describe("mobilier : l'ordre des priorités (§ 5.7, § 5.9, A11, A12, D19)", () => {
  test("un ordre réglé s'écrit, chaque palier rangé dans l'ordre du registre ; le défaut écrit retire le champ ; l'ordre courant est SANS_EFFET", () => {
    const charge = chargeEtiquetee();
    const melange = ordre([[CUMULEES, 3], [EXCEDENT, 2]], REPETEES, ECART, HORS, ANIMATEURS, REDONDANCE);
    const regle = accepter('changerPriorites', charge, { paliers: melange });
    assert.deepEqual(regle.charge.reglages.priorites, COLLISIONS_JOINTES);
    assert.equal(regle.libelle, 'Ordre des priorités : « collisions cumulées » au palier 1 sur 6, avec « excédent de collisions »');
    assert.deepEqual(regle.avertissements, []);
    assert.equal(texteDe(accepter('changerPriorites', charge, { paliers: COLLISIONS_JOINTES }).charge), texteDe(regle.charge));

    const defaut = accepter('changerPriorites', regle.charge, { paliers: DEFAUT });
    assert.equal(Object.hasOwn(defaut.charge.reglages, 'priorites'), false);
    assert.equal(texteDe(defaut.charge), texteDe(charge));
    assert.equal(defaut.libelle, 'Ordre des priorités : « collisions cumulées » au palier 3 sur 7');

    refuse(() => COMMANDES.get('changerPriorites')(charge, { paliers: DEFAUT }), 'SANS_EFFET', { commande: 'changerPriorites', remede: null });
    refuse(() => COMMANDES.get('changerPriorites')(regle.charge, { paliers: melange }), 'SANS_EFFET');
  });

  test("le libellé figé nomme le critère déplacé et son palier, ou son poids : monter, joindre, séparer, pondérer, déplacer un palier entier", () => {
    const charge = chargeEtiquetee();
    const libelleDe = (avant, paliers) => accepter('changerPriorites', avant, { paliers }).libelle;
    // Monter d'un palier : le critère qui monte est nommé, celui qu'il
    // passe ne l'est pas.
    assert.equal(
      libelleDe(charge, ordre(EXCEDENT, REPETEES, CUMULEES, HORS, ECART, ANIMATEURS, REDONDANCE)),
      'Ordre des priorités : « tours hors objectif » au palier 4 sur 7',
    );
    // Un palier porté d'un bout à l'autre.
    assert.equal(
      libelleDe(charge, ordre(REDONDANCE, EXCEDENT, REPETEES, CUMULEES, ECART, HORS, ANIMATEURS)),
      "Ordre des priorités : « redondance d'organisation » au palier 1 sur 7",
    );
    assert.equal(
      libelleDe(charge, ordre(EXCEDENT, REPETEES, CUMULEES, ECART, HORS, REDONDANCE, ANIMATEURS)),
      "Ordre des priorités : « redondance d'organisation » au palier 6 sur 7",
    );
    const jointe = accepter('changerPriorites', charge, { paliers: COLLISIONS_JOINTES }).charge;
    // Le poids d'un critère d'un palier partagé.
    assert.equal(
      libelleDe(jointe, ordre([[EXCEDENT, 2], [CUMULEES, 5]], REPETEES, ECART, HORS, ANIMATEURS, REDONDANCE)),
      'Ordre des priorités : « collisions cumulées » au poids 5, palier 1 sur 6',
    );
    // Un palier partagé, déplacé entier : ses critères sont nommés ensemble.
    assert.equal(
      libelleDe(jointe, ordre(REPETEES, ECART, HORS, [[EXCEDENT, 2], [CUMULEES, 3]], ANIMATEURS, REDONDANCE)),
      'Ordre des priorités : « excédent de collisions » et « collisions cumulées » au palier 4 sur 6',
    );
    // Joindre un palier partagé : le critère seul qui le rejoint est nommé,
    // avec ceux qu'il rejoint.
    assert.equal(
      libelleDe(jointe, ordre([[EXCEDENT, 2], [CUMULEES, 3], [HORS, 1]], REPETEES, ECART, ANIMATEURS, REDONDANCE)),
      'Ordre des priorités : « tours hors objectif » au palier 1 sur 5, avec « excédent de collisions » et « collisions cumulées »',
    );
  });

  test("le poids d'un critère seul à son palier s'écrit 1 : il ne départage rien", () => {
    const jointe = accepter('changerPriorites', chargeEtiquetee(), { paliers: COLLISIONS_JOINTES }).charge;
    const separee = accepter('changerPriorites', jointe, {
      paliers: ordre([[EXCEDENT, 2]], REPETEES, [[CUMULEES, 3]], ECART, [[HORS, 40]], ANIMATEURS, REDONDANCE),
    });
    assert.equal(Object.hasOwn(separee.charge.reglages, 'priorites'), false);
    // Un poids seul, au défaut près, ne change rien.
    refuse(
      () => COMMANDES.get('changerPriorites')(chargeEtiquetee(), { paliers: ordre([[EXCEDENT, 7]], REPETEES, CUMULEES, ECART, HORS, ANIMATEURS, REDONDANCE) }),
      'SANS_EFFET',
    );
  });

  test('une liste invalide est PRIORITES_INVALIDES {faute, critere, palier}, remède null : écart joint, rencontres répétées jointes, critère absent, répété, inconnu, palier vide', () => {
    const charge = figer(chargeEtiquetee());
    const cas = [
      [ordre([[ECART, 1], [EXCEDENT, 1]], CUMULEES, HORS, REPETEES, ANIMATEURS, REDONDANCE), { faute: 'seulASonPalier', critere: ECART, palier: 0 }],
      [ordre(ECART, EXCEDENT, CUMULEES, HORS, [[REPETEES, 1], [REDONDANCE, 4]], ANIMATEURS), { faute: 'seulASonPalier', critere: REPETEES, palier: 4 }],
      [ordre(ECART, EXCEDENT, CUMULEES, HORS, REPETEES, ANIMATEURS), { faute: 'critereAbsent', critere: REDONDANCE }],
      [ordre(ECART, EXCEDENT, CUMULEES, HORS, REPETEES, ANIMATEURS, REDONDANCE, EXCEDENT), { faute: 'critereRepete', critere: EXCEDENT, palier: 7 }],
      [ordre(ECART, EXCEDENT, CUMULEES, HORS, REPETEES, ANIMATEURS, REDONDANCE, 'constructor'), { faute: 'critereInconnu', critere: 'constructor', palier: 7 }],
      [[...DEFAUT.slice(0, 3), [], ...DEFAUT.slice(3)], { faute: 'palierVide', palier: 3 }],
    ];
    for (const [paliers, details] of cas) {
      const erreur = refuse(() => COMMANDES.get('changerPriorites')(charge, { paliers }), 'PRIORITES_INVALIDES');
      assert.deepEqual(erreur.details, { ...details, remede: null }, JSON.stringify(details));
    }
    // Sous le mode par défaut, les tours hors objectif se pondèrent avec
    // d'autres.
    assert.deepEqual(accepter('changerPriorites', charge, { paliers: HORS_JOINTS }).charge.reglages.priorites, HORS_JOINTS);
  });

  test("sous « chacun » et « minimum », les tours hors objectif joints sont PRIORITES_INVALIDES : la liste se lit sous le mode de l'événement (D23)", () => {
    for (const mode of ['chacun', 'minimum']) {
      const charge = chargeEtiquetee();
      charge.reglages.modeObjectifs = mode;
      const erreur = refuse(() => COMMANDES.get('changerPriorites')(figer(charge), { paliers: HORS_JOINTS }), 'PRIORITES_INVALIDES');
      assert.deepEqual(erreur.details, { faute: 'seulASonPalier', critere: HORS, palier: 1, remede: null }, mode);
      // Seuls, ils se déplacent.
      const monte = accepter('changerPriorites', charge, { paliers: ordre(EXCEDENT, REPETEES, CUMULEES, HORS, ECART, ANIMATEURS, REDONDANCE) });
      assert.equal(monte.libelle, 'Ordre des priorités : « tours hors objectif » au palier 4 sur 7');
    }
  });

  test('un poids hors des entiers de 1 à 100 est POIDS_HORS_DOMAINE {valeur}, remède null, seul ou dans un palier partagé', () => {
    const charge = figer(chargeEtiquetee());
    for (const poids of [0, -1, 101, 2.5, Number.NaN, Infinity]) {
      for (const paliers of [
        ordre(ECART, [[EXCEDENT, 2], [CUMULEES, poids]], HORS, REPETEES, ANIMATEURS, REDONDANCE),
        ordre(ECART, [[EXCEDENT, poids]], CUMULEES, HORS, REPETEES, ANIMATEURS, REDONDANCE),
      ]) {
        const erreur = refuse(() => COMMANDES.get('changerPriorites')(charge, { paliers }), 'POIDS_HORS_DOMAINE');
        assert.deepEqual(erreur.details, { valeur: poids, remede: null }, String(poids));
      }
    }
    for (const poids of [1, 100]) {
      const paliers = ordre(ECART, [[EXCEDENT, 2], [CUMULEES, poids]], HORS, REPETEES, ANIMATEURS, REDONDANCE);
      assert.deepEqual(accepter('changerPriorites', charge, { paliers }).charge.reglages.priorites, paliers);
    }
  });

  test('une liste de forme fausse est une faute du code : TypeError', () => {
    const charge = chargeEtiquetee();
    assert.equal(typeof COMMANDES.get('changerPriorites'), 'function');
    for (const paliers of [
      undefined,
      null,
      'defaut',
      { 0: DEFAUT[0] },
      [...DEFAUT.slice(1), 'redondance'],
      [...DEFAUT.slice(1), [null]],
      [...DEFAUT.slice(1), [[REDONDANCE, 1]]],
      [...DEFAUT.slice(1), [{ critere: 7, poids: 1 }]],
      [...DEFAUT.slice(1), [{ critere: ECART, poids: '1' }]],
      [...DEFAUT.slice(1), [{ critere: ECART }]],
    ]) {
      assert.throws(() => COMMANDES.get('changerPriorites')(charge, { paliers }), TypeError, JSON.stringify(paliers));
    }
  });

  test("retablirPriorites retire l'ordre réglé, sans fenêtre (D19) ; sans ordre réglé, SANS_EFFET", () => {
    const charge = chargeEtiquetee();
    const regle = accepter('changerPriorites', charge, { paliers: COLLISIONS_JOINTES }).charge;
    const retabli = accepter('retablirPriorites', regle, {});
    assert.equal(Object.hasOwn(retabli.charge.reglages, 'priorites'), false);
    assert.equal(retabli.libelle, 'Ordre des priorités : ordre par défaut rétabli');
    assert.deepEqual(retabli.avertissements, []);
    assert.equal(texteDe(retabli.charge), texteDe(charge));
    refuse(() => COMMANDES.get('retablirPriorites')(charge, {}), 'SANS_EFFET', { commande: 'retablirPriorites', remede: null });
  });
});

describe('mobilier : le mode des objectifs (§ 5.3, § 8.9, A8, A12, D23)', () => {
  test("« chacun » et « minimum » s'écrivent ; « places » retire le champ ; le mode courant est SANS_EFFET", () => {
    const charge = chargeEtiquetee();
    const chacun = accepter('modifierReglage', charge, { cle: 'modeObjectifs', valeur: 'chacun' });
    assert.equal(chacun.charge.reglages.modeObjectifs, 'chacun');
    assert.equal(chacun.libelle, "Objectifs des tables, chercher d'abord : chacun au moins une fois");
    const minimum = accepter('modifierReglage', chacun.charge, { cle: 'modeObjectifs', valeur: 'minimum' });
    assert.equal(minimum.charge.reglages.modeObjectifs, 'minimum');
    assert.equal(minimum.libelle, "Objectifs des tables, chercher d'abord : le minimum, puis le total");
    const places = accepter('modifierReglage', minimum.charge, { cle: 'modeObjectifs', valeur: 'places' });
    assert.equal(Object.hasOwn(places.charge.reglages, 'modeObjectifs'), false);
    assert.equal(places.libelle, "Objectifs des tables, chercher d'abord : le plus de places servies");
    assert.equal(texteDe(places.charge), texteDe(charge));
    refuse(() => COMMANDES.get('modifierReglage')(charge, { cle: 'modeObjectifs', valeur: 'places' }), 'SANS_EFFET', { commande: 'modifierReglage', remede: null });
    refuse(() => COMMANDES.get('modifierReglage')(chacun.charge, { cle: 'modeObjectifs', valeur: 'chacun' }), 'SANS_EFFET');
  });

  test('une valeur hors des trois modes est une faute du code : TypeError', () => {
    const charge = chargeEtiquetee();
    assert.equal(accepter('modifierReglage', charge, { cle: 'modeObjectifs', valeur: 'minimum' }).charge.reglages.modeObjectifs, 'minimum');
    for (const valeur of ['pondere', 'PLACES', 'constructor', null, undefined, true, 1]) {
      assert.throws(() => COMMANDES.get('modifierReglage')(charge, { cle: 'modeObjectifs', valeur }), TypeError, String(valeur));
    }
  });

  test('un mode qui compare deux valeurs se refuse quand les tours hors objectif partagent un palier : OBJECTIFS_PALIER_PARTAGE {mode, palier}, le mode et l’ordre inchangés', () => {
    const charge = accepter('changerPriorites', chargeEtiquetee(), { paliers: HORS_JOINTS }).charge;
    figer(charge);
    for (const mode of ['chacun', 'minimum']) {
      const erreur = refuse(() => COMMANDES.get('modifierReglage')(charge, { cle: 'modeObjectifs', valeur: mode }), 'OBJECTIFS_PALIER_PARTAGE');
      assert.deepEqual(erreur.details, { mode, palier: 1, remede: null });
    }
    assert.equal(modeObjectifs(charge), 'places');
    assert.deepEqual(priorites(charge), HORS_JOINTS);
    // Le palier partagé loin du premier : le détail en donne l'index.
    const loin = ordre(ECART, EXCEDENT, CUMULEES, REPETEES, [[HORS, 1], [ANIMATEURS, 2]], REDONDANCE);
    const chargeLoin = accepter('changerPriorites', chargeEtiquetee(), { paliers: loin }).charge;
    figer(chargeLoin);
    for (const mode of ['chacun', 'minimum']) {
      const erreur = refuse(() => COMMANDES.get('modifierReglage')(chargeLoin, { cle: 'modeObjectifs', valeur: mode }), 'OBJECTIFS_PALIER_PARTAGE');
      assert.deepEqual(erreur.details, { mode, palier: 4, remede: null });
    }
    assert.equal(modeObjectifs(chargeLoin), 'places');
    assert.deepEqual(priorites(chargeLoin), loin);
  });

  test("changer de mode ne déplace aucun critère ; un poids écrit d'un critère seul, que le mode ne pondère pas, revient à 1", () => {
    const jointe = accepter('changerPriorites', chargeEtiquetee(), { paliers: COLLISIONS_JOINTES }).charge;
    const minimum = accepter('modifierReglage', jointe, { cle: 'modeObjectifs', valeur: 'minimum' }).charge;
    assert.deepEqual(minimum.reglages.priorites, COLLISIONS_JOINTES);
    // Un fichier écrit ailleurs : les tours hors objectif seuls, au poids 7,
    // que le mode par défaut admet.
    const ailleurs = chargeEtiquetee();
    ailleurs.reglages.priorites = ordre([[EXCEDENT, 2], [CUMULEES, 3]], REPETEES, ECART, [[HORS, 7]], ANIMATEURS, REDONDANCE);
    for (const mode of ['chacun', 'minimum']) {
      const rendu = accepter('modifierReglage', ailleurs, { cle: 'modeObjectifs', valeur: mode }).charge;
      assert.deepEqual(rendu.reglages.priorites, COLLISIONS_JOINTES, mode);
      assert.equal(rendu.reglages.modeObjectifs, mode);
    }
    const seulAuPoids = chargeEtiquetee();
    seulAuPoids.reglages.priorites = ordre(EXCEDENT, REPETEES, CUMULEES, ECART, [[HORS, 7]], ANIMATEURS, REDONDANCE);
    assert.equal(Object.hasOwn(accepter('modifierReglage', seulAuPoids, { cle: 'modeObjectifs', valeur: 'chacun' }).charge.reglages, 'priorites'), false);
  });
});

describe("mobilier : l'ordre et le mode ne mettent aucun placement en dérive (D13)", () => {
  test('changerPriorites, retablirPriorites et le mode laissent les raisons de dérive telles quelles', () => {
    const charge = chargeEtiquetee();
    const listes = [[[1, 2], [3, 4], []], [[1, 3], [2, 4], []], [[1, 4], [2, 3], []]];
    placer(charge, listes, { id: 1 });
    placer(charge, listes, { id: 2, retenu: true });
    const raisons = (apres) => [...charge.propositions, charge.retenu].map((placement) => derive(placement, apres));
    const depart = raisons(charge);
    let courante = charge;
    for (const [nom, args] of [
      ['changerPriorites', { paliers: HORS_JOINTS }],
      ['changerPriorites', { paliers: COLLISIONS_JOINTES }],
      ['modifierReglage', { cle: 'modeObjectifs', valeur: 'minimum' }],
      ['retablirPriorites', {}],
      ['modifierReglage', { cle: 'modeObjectifs', valeur: 'places' }],
    ]) {
      courante = accepter(nom, courante, args).charge;
      assert.deepEqual(raisons(courante), depart, nom);
      assert.deepEqual(courante.propositions, charge.propositions, nom);
      assert.deepEqual(courante.retenu, charge.retenu, nom);
    }
  });
});
