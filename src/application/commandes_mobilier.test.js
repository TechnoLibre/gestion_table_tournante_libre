// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des commandes du mobilier (§ 4, § 4.3, § 5.9, § 6, § 7.1, § 8.2,
// § 9, § 15.4) : tables, défaut, tours et réglages. Chaque commande acceptée
// rend une charge que l'analyse relit et qui se normalise quand la charge
// reçue se normalisait ; un refus ne change rien. Les gestes qui comptent
// les entrées du journal, ou les avertissements que la séance ajoute,
// passent par seance.executer sur le système de fichiers d'épreuve. Les noms
// d'épreuve sont inventés ; la version vient du module engendré.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { constante } from '../geometrie/constantes.js';
import { caseLibre, geometrieTable } from '../geometrie/tables.js';
import { TAILLE_TEXTE_LISTE_CM } from '../geometrie/texte.js';
import { STATUT, nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { serialiser } from '../stockage/canonique.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
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
  appartenance: null,
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

// Hauteur de ligne d'une liste que suppose l'épreuve des bandes : 1,25 corps,
// au-dessus de la hauteur d'encre du gabarit sur les polices courantes ; le
// dessin la mesure au navigateur.
const HAUTEUR_LIGNE_SUPPOSEE = 1.25 * TAILLE_TEXTE_LISTE_CM;

// Les fautes « une liste passe sur une autre table » d'une charge : pour
// chaque paire ordonnée de tables, la bande du bloc de noms de la première —
// LARGEUR_BLOC_NOMS_CM de large depuis origineListe, capacité + 1 lignes de
// haut, en-tête d'une table gelée compris — recoupe le carré d'emprise de la
// seconde, bords exclus. Avec avec, seules les paires où figure la table
// d'identifiant avec sont examinées. Rend les fautes et le nombre de paires
// examinées.
function fautesBandes(charge, { avec = null } = {}) {
  const largeur = constante('LARGEUR_BLOC_NOMS_CM');
  const geometries = charge.tables.map((table) => ({ g: geometrieTable(table, capacite(charge, table)), places: capacite(charge, table) }));
  const fautes = [];
  let paires = 0;
  for (const { g, places } of geometries) {
    const bande = {
      gauche: g.origineListe.x,
      droite: g.origineListe.x + largeur,
      haut: g.origineListe.y,
      bas: g.origineListe.y + (places + 1) * HAUTEUR_LIGNE_SUPPOSEE,
    };
    for (const { g: autre } of geometries) {
      if (autre === g || (avec !== null && g.id !== avec && autre.id !== avec)) continue;
      paires += 1;
      const e = autre.rayonEmprise;
      const recoupe =
        autre.centre.x + e > bande.gauche &&
        autre.centre.x - e < bande.droite &&
        autre.centre.y + e > bande.haut &&
        autre.centre.y - e < bande.bas;
      if (recoupe) fautes.push(`bloc de la table ${g.id} (${g.centre.x}, ${g.centre.y}) sur la table ${autre.id} (${autre.centre.x}, ${autre.centre.y})`);
    }
  }
  return { fautes, paires };
}

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
  test('COMMANDES_MOBILIER porte les huit commandes du mobilier, réunies dans COMMANDES', () => {
    const noms = ['creerTable', 'supprimerTable', 'deplacerTable', 'changerPlacesTable', 'realignerTable', 'changerDefaut', 'changerTours', 'modifierReglage'];
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
      ['changerPlacesTable', { id: 1, sieges: 6, origine: 'champ' }],
      ['realignerTable', { id: 1 }],
      ['changerDefaut', { sieges: 6, realigner: false }],
      ['changerTours', { tours: 3 }],
      ['modifierReglage', { cle: 'nouveauxVoisins', valeur: false }],
    ];
    assert.equal(gestes.length, COMMANDES_MOBILIER.size);
    for (const [nom, args] of gestes) {
      refuse(() => COMMANDES.get(nom)(charge, args), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
    }
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
    // la liste de sa voisine, ce que la création ne change pas.
    charge = accepter('changerPlacesTable', charge, { id: 5, sieges: 16, origine: 'champ' }).charge;
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
    charge = accepter('changerPlacesTable', charge, { id: premiere.id, sieges: 16, origine: 'champ' }).charge;
    charge = accepter('creerTable', charge, { forme: 'ronde' }).charge;
    assert.deepEqual(charge.tables.at(-1).position, { x: 2898, y: 1720 });
    const creee = charge.tables.at(-1).id;
    assert.deepEqual(fautesBandes(charge, { avec: creee }), { fautes: [], paires: 2 * 33 });
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
    assert.throws(() => COMMANDES.get('creerTable')(charge, { forme: 'ovale' }), TypeError);
    assert.throws(() => COMMANDES.get('supprimerTable')(charge, { id: 7 }), TypeError);
    assert.throws(() => COMMANDES.get('deplacerTable')(charge, { id: 1, position: { x: Number.NaN, y: 0 } }), TypeError);
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

    // Réaligner une table surchargée à 10, la personne 10 réservée sans siège.
    const dix = chargeDe({ tables: [{ id: 1, sieges: 10 }, { id: 2 }], n: 14, tours: 1, attribuerSieges: true, reservations: [resa(10, 1, null)] });
    placer(dix, [[suite(1, 10), suite(11, 14)]], { id: 1, retenu: true });
    const realignee = accepter('realignerTable', dix, { id: 1 });
    assert.equal(invariantViole(realignee.charge), null);
    assert.deepEqual(realignee.charge.retenu.placement[0].sieges[0], [1, 2, 3, 4, 5, 6, 7, 10]);
    assert.deepEqual(realignee.avertissements, [{ code: 'SURNUMERAIRES', details: { table: 1, tour: 1, personnes: [8, 9] } }]);
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
      assert.equal(invariantViole(apres), null, nom);
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
});

describe('mobilier : les réglages (§ 5.3, § 15.4)', () => {
  test('« Séparer les appartenances : désactivé », une entrée', async () => {
    const { seance, entrees } = await seanceSur(chargeDe({ tables: [{ id: 1 }], n: 2 }));
    const avant = entrees();
    const rendu = await seance.executer('modifierReglage', { cle: 'separerAppartenances', valeur: false });
    assert.equal(rendu.libelle, 'Séparer les appartenances : désactivé');
    assert.equal(entrees() - avant, 1);
    assert.equal(seance.charge.reglages.separerAppartenances, false);
  });

  test('chaque réglage nommé se change ; une clé inconnue ou une valeur de forme fausse est une faute du code', () => {
    const charge = chargeDe({ tables: [{ id: 1 }], n: 2 });
    const attendus = [
      ['nouveauxVoisins', false, 'Nouveaux voisins à chaque tour : désactivé'],
      ['nouvelleTable', false, 'Nouvelle table à chaque tour : désactivé'],
      ['varierAppartenances', false, 'Varier les appartenances rencontrées : désactivé'],
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
