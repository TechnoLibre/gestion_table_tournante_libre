// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les écrans de l'itération, chacun atteint depuis le premier écran de
// l'application montée sur le système simulé (§ 14.5, § 14.6, § 19.11). Un
// écran est { nom, mode, atteindre(contexte) } : atteindre monte App par le
// contexte, pose sur le disque simulé le fichier d'état qu'il lui faut, puis
// mène l'application jusqu'à l'écran par les gestes de l'opérateur — le clic
// d'un bouton désigné par son attribut data-…, une entrée réelle de
// test/navigateur/entrees.js sur le plan, une touche — et rend l'élément qui
// porte l'écran entier, bandeau compris : le conteneur du montage. mode dit
// ce que le bandeau et le cadre en annoncent : null sans événement ouvert,
// 'lecture', 'ecriture' ou 'bloque' sinon.
//
// Aucun délai fixe (§ 19.3) : chaque étape attend une condition du document,
// image après image, et lève en la nommant quand elle ne vient pas. Les
// données sont tirées des démonstrations livrées, d'événements d'épreuve aux
// noms inventés et de commandes de l'application, sans aléa : deux parcours
// rendent le même écran.
//
// Un état s'atteint sans geste de l'opérateur : la question du dossier de
// travail, qui se pose au démarrage, par les options du système simulé.
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../src/application/commandes.js';
import { planDuDepart } from '../../src/application/depart.js';
import { ErreurAnnulee } from '../../src/application/generation.js';
import { texteLivre } from '../../src/demo/livrees.js';
import { SECTIONS } from '../../src/interface/evenement/sections.js';
import { LISTE_PAR_DEFAUT, listeApres } from '../../src/interface/generation/priorites.js';
import { rechercher, repartir } from '../../src/moteur/recherche.js';
import { serialiser } from '../../src/stockage/canonique.js';
import { texteDesCourses } from '../../src/stockage/courses.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../src/stockage/document.js';
import { SUFFIXES } from '../../src/stockage/noms.js';
import { FICHIER_REGLAGES, serialiserReglages } from '../../src/stockage/reglages_locaux.js';
import { VERSION } from '../../src/version.genere.js';
import urlCasLimites from '../../exemples/participants_cas_limites.csv?url';
import { dessinerGraphiques, pointer, touche } from './entrees.js';
import { actionDe } from './menus.js';
import { monterApp } from './montage.js';

/** La base du fichier d'état de chaque événement d'épreuve. */
export const BASE = 'soiree';

/** Le nom du CSV des cas limites que sert le dialogue d'import. */
export const NOM_CAS_LIMITES = 'participants_cas_limites.csv';

/** Les sections d'un événement, dans l'ordre de la navigation : celles
 *  que l'application offre, si bien qu'une section ajoutée se visite à
 *  chaque mode sans retouche ici. */
export const SECTIONS_EVENEMENT = SECTIONS;

// L'exécutable publié du système simulé : son dossier data/ refuse
// l'écriture, et la question du dossier de travail se pose au démarrage.
const PUBLIE = 'E:\\soirees-epreuve';

// Images attendues au plus pour qu'une condition se réalise : bien au-delà
// d'un rendu, d'une écriture simulée et d'une génération de la petite
// démonstration.
const IMAGES_MAX = 900;

// Images attendues au plus pour qu'un résumé de la liste arrive : bien
// au-delà d'une relecture du système simulé et d'un pas par événement, et
// sous le délai d'une épreuve, que IMAGES_MAX atteint à 60 images par
// seconde : un résumé qui ne vient pas se nomme au lieu d'épuiser ce délai.
const IMAGES_RESUME = 300;

// --- L'attente et les gestes -------------------------------------------------

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

/** Attend, image après image, que condition() rende une valeur vraie sans
 *  lever, et la rend ; lève en nommant quoi après images images. */
export async function attendre(quoi, condition, images = IMAGES_MAX) {
  let derniere = null;
  for (let image = 0; image < images; image += 1) {
    flushSync();
    try {
      const valeur = condition();
      if (valeur) return valeur;
    } catch (erreur) {
      derniere = erreur;
    }
    await uneImage();
  }
  throw new Error(`écran : ${quoi} ne vient pas${derniere === null ? '' : ` (${derniere.message})`}`);
}

// Le premier élément du montage qu'atteint le sélecteur, attendu.
const element = (m, selecteur) => attendre(selecteur, () => m.racine.querySelector(selecteur));

/** Clique le bouton du montage que désigne le sélecteur, une fois présent,
 *  par son clic HTML, puis laisse le rendu suivre. */
export async function cliquer(m, selecteur) {
  const bouton = await element(m, selecteur);
  bouton.click();
  flushSync();
  await uneImage();
  return bouton;
}

/** Ouvre le menu « Actions » de la ligne du montage que désigne
 *  selecteurLigne, une fois présente, clique son action nom par son clic
 *  HTML, puis laisse le rendu suivre ; rend l'action. Une action que le
 *  menu n'offre pas lève en la nommant. */
export async function cliquerAction(m, selecteurLigne, nom) {
  const ligne = await element(m, selecteurLigne);
  const action = actionDe(ligne, nom);
  if (action === null) throw new Error(`écran : le menu de ${selecteurLigne} n’offre pas l’action ${nom}`);
  action.click();
  flushSync();
  await uneImage();
  return action;
}

/** Mène le chargement des résumés de la liste à son terme (§ 8.1) : l'horloge
 *  pilotée du montage tient chaque pas du chargement, et avance d'un pas à
 *  chaque image jusqu'à ce qu'aucun signe du chargement ne reste. */
export async function chargerResumes(m) {
  await attendre('les résumés de la liste', () => {
    if (m.racine.querySelector('[data-chargement]') === null) return true;
    m.horloge.avancer(0);
    return false;
  });
}

/** Suit les résumés que la liste du montage reçoit à partir de cet appel :
 *  chaque flux que l'application lance par m.facade.resumer rapporte, en
 *  plus, la clé de chaque ligne dont il pose le résumé. Rend
 *  resumeRecu(base), qui attend, l'horloge pilotée avancée d'un pas à chaque
 *  image, que la liste ait reçu le résumé de l'événement de base, dans le
 *  dossier de cette base, depuis le suivi, le rendu à jour : un résumé posé
 *  avant le suivi, d'une liste plus ancienne, n'y répond pas. */
export function suivreResumes(m) {
  const recues = new Set();
  const resumer = m.facade.resumer;
  m.facade.resumer = (lues, options) =>
    resumer(lues, {
      ...options,
      recevoir(cle, resume) {
        options.recevoir(cle, resume);
        recues.add(cle);
      },
    });
  return (base) =>
    attendre(
      `le résumé de ${base} reçu par la liste`,
      () => {
        if (recues.has(`${base}/${base}`)) return true;
        m.horloge.avancer(0);
        return false;
      },
      IMAGES_RESUME,
    );
}

/** Le centre de la boîte d'un élément, en coordonnées de la fenêtre, une
 *  fois l'élément amené dans la fenêtre. */
export async function centre(cible) {
  const dedans = () => {
    const b = cible.getBoundingClientRect();
    return b.width > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
  };
  if (!dedans()) {
    cible.scrollIntoView({ block: 'center', inline: 'center' });
    await attendre('l’élément dans la fenêtre', dedans);
  }
  const b = cible.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

// Le plateau d'une table, qu'il signale un conflit ou non.
const plateau = (m, table) =>
  m.racine.querySelector(`[data-table="${table}"] [data-marque="contourTable"], [data-table="${table}"] [data-marque="contourConflit"]`);
const chaise = (m, table, siege) => m.racine.querySelector(`[data-siege="${table}:${siege}"]`);

// Un appui relâché sur place, au centre d'un élément : un clic de pointeur
// réel, sous le seuil de glissement.
async function cliquerPointeur(cible) {
  const { x, y } = await centre(cible);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  flushSync();
  await uneImage();
}

// --- Les événements d'épreuve -----------------------------------------------

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;
const demonstration = (cle) => analyser(texteLivre(cle)).charge;

/**
 * La petite démonstration, variante conflit, avec une désignation (la
 * personne 1, « hôte », à la table 1, siège 1), une réservation d'un tour (la
 * personne 2 à la table 2, siège 2, au tour 1), un titre non pourvu
 * (« animateur », table 3, siège 3) et une proposition, tirée de la graine 2
 * : au tour 1, les tables 1 et 2 sont en conflit, les tables 3 et 4 saines.
 */
export function chargePrincipale() {
  return generationPrincipale().charge;
}

/** La principale et les entrées du compagnon des courses que sa génération
 *  rend : { charge, courses }. */
export function generationPrincipale() {
  let charge = demonstration('petite-conflit');
  charge = executer(charge, 'designer', { participant: 1, table: 1, siege: 1, libelle: 'hôte' });
  charge = executer(charge, 'reserver', { participant: 2, table: 2, siege: 2, portee: 'tour', tour: 1 });
  charge = executer(charge, 'poserTitre', { table: 3, siege: 3, libelle: 'animateur' });
  return generee(charge, { graine: 2, nombre: 1, arret: 300 });
}

// La charge, une génération de plus sous les réglages donnés, historique
// 1 000, enregistrée par la commande : { charge, courses }, courses les
// entrées du compagnon que la commande rend, une par proposition.
function generee(charge, reglages) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { historique: 1000, ...reglages });
  const rendu = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee });
  return { charge: rendu.charge, courses: rendu.courses };
}

// Des personnes inventées : le prénom et le nom se combinent, chacun
// désigné par son rang, sans homonyme jusqu'à soixante-quatre.
const PRENOMS = ['Iris', 'Théo', 'Ondine', 'Basile', 'Maëlle', 'Sidonie', 'Aurèle', 'Clovis'];
const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Tourteau', 'Quenouille', 'Cormoran', 'Belette', 'Garance'];

// Un événement d'épreuve inventé, sans proposition ni retenu : une
// personne par entrée d'organisations — son organisation, null sans —,
// tables tables rondes de sieges places numérotées de 1 à tables, tours
// tours.
function chargeInventee({ organisations, tables, sieges, tours }) {
  const charge = creerCharge({ id: 'evt-qualite', nom: 'Soirée Pervenche', siegesParDefaut: sieges, tours });
  charge.participants = organisations.map((organisation, rang) => ({
    id: rang + 1,
    nom: NOMS[Math.floor(rang / PRENOMS.length) % NOMS.length],
    prenom: PRENOMS[rang % PRENOMS.length],
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = Array.from({ length: tables }, (_, rang) => ({
    id: rang + 1,
    numero: rang + 1,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * (rang + 1), y: 0 },
  }));
  charge.prochainsIds = { participant: organisations.length + 1, table: tables + 1, proposition: 1 };
  return charge;
}

const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';

/** Douze personnes, quatre tables de trois, six tours (§ 12.5) : chacun
 *  revoit quelqu'un ; les deux premières, réservées ensemble à la table 1
 *  pour tous les tours, forment une paire imposée. Une génération de deux
 *  propositions. */
export function chargePaires() {
  const charge = chargeInventee({ organisations: Array.from({ length: 12 }, (_, rang) => [AUBIER, RESSAC, null][rang % 3]), tables: 4, sieges: 3, tours: 6 });
  charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  return generee(charge, { graine: 5, nombre: 2, arret: 60 }).charge;
}

// Douze personnes, trois tables de quatre, trois tours ; les six premières
// portent l'étiquette « finance », que la table 1 a pour objectif à tous
// les tours. Aucune proposition.
function sousObjectif() {
  const charge = chargeInventee({ organisations: Array.from({ length: 12 }, (_, rang) => [AUBIER, RESSAC, null][rang % 3]), tables: 3, sieges: 4, tours: 3 });
  for (const personne of charge.participants) if (personne.id <= 6) personne.etiquettes = ['finance'];
  charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  return charge;
}

/** Douze personnes, trois tables de quatre, trois tours ; les six premières
 *  portent l'étiquette « finance », que la table 1 a pour objectif à tous
 *  les tours. Une génération d'une proposition, sous cet objectif. */
export function chargeObjectifs() {
  return generee(sousObjectif(), { graine: 3, nombre: 1, arret: 300 }).charge;
}

/** La forme de chargeObjectifs, une génération de deux propositions sous la
 *  graine 4 : la colonne de chacune porte les trois pourcentages — minimum
 *  brut, tours hors objectif, minimum de s(p) —, et les deux diffèrent par
 *  le compte des personnes jamais servies hors objectif comme par le
 *  minimum de s(p). */
export function chargeComparaisonObjectifs() {
  return generee(sousObjectif(), { graine: 4, nombre: 2, arret: 300 }).charge;
}

/** Douze personnes, trois tables de quatre, trois tours ; une génération de
 *  deux propositions, sans retenu. Les profils de manque de la première et
 *  de la seconde prennent quatre valeurs, se tracent, et se croisent une
 *  fois : la vue de comparaison de la première écrit sa bascule. */
export function chargeComparaison() {
  return deuxPropositions(1);
}

// Douze personnes, trois tables de quatre, trois tours ; une génération de
// deux propositions sous la graine donnée, sans retenu.
function deuxPropositions(graine) {
  const charge = chargeInventee({ organisations: Array.from({ length: 12 }, (_, rang) => [AUBIER, RESSAC, null][rang % 3]), tables: 3, sieges: 4, tours: 3 });
  return generee(charge, { graine, nombre: 2, arret: 60 }).charge;
}

/** La forme de chargeComparaison, sous la graine 764 : les profils de
 *  manque des deux propositions réunis ne prennent que deux valeurs, sous
 *  le seuil du tracé ; la vue de la première écrit ses effectifs en une
 *  phrase, et sa dominance. */
export function chargeComparaisonPhrase() {
  return deuxPropositions(764);
}

/** chargeComparaison, sa proposition 1 retenue, puis le retenu ajusté : au
 *  tour 1, la première personne de la table 1 et celle de la table 2
 *  échangées. Le retenu, source de la page, se compare par défaut à sa
 *  proposition d'origine, et se trace contre elle. */
export function chargeRetenuAjuste() {
  const retenue = executer(chargeComparaison(), 'retenirProposition', { id: 1 });
  const [premiere, seconde] = retenue.retenu.placement[0].sieges;
  return executer(retenue, 'echangerDansRetenu', { tour: 1, a: premiere[0], b: seconde[0] });
}

/** chargeComparaison et une génération dérivée de la proposition 1, tour 1
 *  figé, sous la graine 1 : deux dérivées, n° 3 et 4, chacune le tour 1 de
 *  son départ, toutes quatre comparables et classées ensemble. */
export function chargeDerivees() {
  const charge = chargeComparaison();
  const configuration = configurationDepuisCharge(charge);
  const derivation = { depart: 1, toursFiges: [1] };
  const propositions = repartir(configuration, { historique: 1000, graine: 1, nombre: 2, arret: 60 }, { plan: planDuDepart(charge, derivation.depart), toursFiges: derivation.toursFiges });
  return executer(charge, 'enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee, derivation });
}

// Le placement de chargeNiveaux, tours par tours, sièges non attribués.
// Les doublons parmi les affiliés (α − δ) valent 3 à la table 1 à chaque
// tour, 2 et 1 aux tables 2 et 3 du tour 1, 0 ailleurs ; les sièges sans
// organisation nouvelle (c − δ) valent 0 à la table 2 du tour 2, 1 aux
// tables 2 et 3 du tour 3, 2 et 3 ailleurs ; la table 4 du tour 3 n'a aucun
// affilié. Les quatre de la table 1 se voient trois fois, 5 et 6 deux
// fois, 5 et 7 une fois, 1 et 5 jamais.
const NIVEAUX = Object.freeze([
  [[1, 2, 3, 4], [5, 6, 7, 12], [8, 9, 13, 14], [10, 11, 15, 16]],
  [[1, 2, 3, 4], [5, 8, 10, 11], [6, 9, 12, 13], [7, 14, 15, 16]],
  [[1, 2, 3, 4], [5, 6, 9, 10], [7, 8, 11, 12], [13, 14, 15, 16]],
]);

/** Seize personnes inventées, trois tables de quatre et une de cinq, trois
 *  tours : les quatre de la première organisation réservées ensemble à la
 *  table 1 pour tous les tours, et la proposition NIVEAUX, écrite à la
 *  main, où la grille des tables, sous chaque position, et la matrice des
 *  rencontres portent les quatre niveaux de l'échelle (§ 12.7, D33, D35).
 *  La table 4 garde un siège vide à chaque tour : ses sièges et ses assis
 *  diffèrent, et leurs deux pourcentages aussi aux tours 1 et 2. */
export function chargeNiveaux() {
  const organisations = [
    ...Array(4).fill(AUBIER),
    ...Array(3).fill(RESSAC),
    ...Array(2).fill('Collectif Brisant'),
    'Cercle Ormeau',
    'Brigade Sauge',
    ...Array(5).fill(null),
  ];
  let charge = chargeInventee({ organisations, tables: 4, sieges: 4, tours: 3 });
  charge.tables[3].sieges = 5;
  for (const participant of [1, 2, 3, 4]) {
    charge = executer(charge, 'reserver', { participant, table: 1, siege: participant, portee: 'tous', tour: null });
  }
  return avecTours(charge, NIVEAUX);
}

// Le nombre de tours de chargeCollisionsEtroites.
const TOURS_ETROITS = 10;

/** Soixante-quatre personnes inventées, huit tables de huit, TOURS_ETROITS
 *  tours, et une proposition écrite à la main, la même à chaque tour : les
 *  huit de la première organisation réunies à la table 1, vingt-huit
 *  collisions par tour, aucune prouvée ; les huit de la seconde, une par
 *  table sauf deux à la table 2, une collision par tour, dont une seule
 *  prouvée — les deux réservées ensemble à la table 2 au tour 1. Le segment
 *  « prouvé inévitable » de la seconde vaut un sur un axe de 280 : il est
 *  étroit (§ 12.4, B13). Au-delà de SEUIL_MATRICE_PARTICIPANTS, la matrice
 *  ne se dessine pas. */
export function chargeCollisionsEtroites() {
  const organisations = [...Array(8).fill(AUBIER), ...Array(8).fill(RESSAC), ...Array(48).fill(null)];
  const charge = chargeInventee({ organisations, tables: 8, sieges: 8, tours: TOURS_ETROITS });
  charge.reservations = [9, 10].map((participant) => ({ participant, table: 2, siege: null, portee: 'tour', tour: 1 }));
  // Les tables 2 à 8 : la seconde organisation, 9 et 10 à la table 2, puis
  // une de 11 à 16 par table, complétées des personnes sans organisation.
  const sans = Array.from({ length: 48 }, (_, rang) => 17 + rang);
  const autres = [
    [9, 10, ...sans.slice(0, 6)],
    ...[11, 12, 13, 14, 15, 16].map((personne, rang) => [personne, ...sans.slice(6 + 7 * rang, 13 + 7 * rang)]),
  ];
  const tour = [[1, 2, 3, 4, 5, 6, 7, 8], ...autres];
  return avecTours(charge, Array.from({ length: TOURS_ETROITS }, () => tour));
}

/** La petite démonstration dont la table 4 est réservée en entier pour
 *  tous les tours (chargeGelee), sous la proposition TROIS_CONFLITS, écrite
 *  à la main, qui assoit ailleurs les trois personnes réservées : les
 *  rencontres que le plan mesure dépassent les plafonds que les
 *  réservations bornent, et la garde du détail (refusDessin, § 12.3) retire
 *  le dessin de la page de qualité. */
export function chargeRefusDessin() {
  return avecTours(chargeGelee(), TROIS_CONFLITS);
}

/** Le compagnon des courses d'une charge, ses entrées données, posé dans
 *  les Documents sous BASE, dans le dossier de cette base. */
export const fichierCourses = (charge, entrees, base = BASE) => ({
  racine: 'documents',
  chemin: `${base}/${base}${SUFFIXES.courses}`,
  texte: texteDesCourses(charge.evenement.id, entrees),
});

// Un placement de la petite démonstration en conflit, quatre tours de
// quatre tables de trois, sièges non attribués : au tour 3, la table 1 réunit
// une même organisation, des voisins revus et un retour à sa table, la
// table 2 aucun conflit. Écrit tel quel, il ne dépend d'aucun chemin de la
// recherche.
const TROIS_CONFLITS = Object.freeze([
  [[1, 2, 11], [4, 9, 10], [3, 5, 12], [6, 7, 8]],
  [[9, 10, 11], [2, 4, 8], [3, 5, 6], [1, 7, 12]],
  [[4, 5, 10], [6, 11, 12], [1, 7, 9], [2, 3, 8]],
  [[1, 8, 10], [2, 9, 12], [3, 4, 6], [5, 7, 11]],
]);

// La charge reçue et une proposition écrite à la main, la seule : tours,
// par tour, la liste des personnes de chaque table, dans l'ordre des tables
// de la charge, sièges non attribués ; le plan devient proposé.
function avecTours(charge, tours) {
  const suivante = structuredClone(charge);
  suivante.propositions = [
    {
      id: 1,
      graine: 1,
      arret: 300,
      historique: 1000,
      produitVersion: VERSION.affichee,
      siegesAttribues: false,
      tables: suivante.tables.map(({ id }) => id),
      capacites: suivante.tables.map((table) => capacite(suivante, table)),
      tours: tours.length,
      participants: suivante.participants.filter(({ exclu }) => !exclu).map(({ id }) => id),
      placement: tours.map((listes) => ({ sieges: listes.map((liste) => [...liste]), reserve: [] })),
    },
  ];
  suivante.prochainsIds.proposition = 2;
  suivante.evenement.etat = 'propose';
  return suivante;
}

// La petite démonstration en conflit et la proposition TROIS_CONFLITS, où la
// personne 4, sans organisation, nomme celle de la personne 5 : la table 1
// les réunit au tour 3. Sans organisation, la personne 4 n'engage qu'elle :
// une organisation entière en conflit réunirait ses membres et ceux de
// l'autre à chaque table, et le plan, toutes les tables en conflit,
// cesserait de signaler (§ 7.5).
function chargeTroisConflits() {
  const charge = avecTours(demonstration('petite-conflit'), TROIS_CONFLITS);
  const personneDe = (id) => charge.participants.find((personne) => personne.id === id);
  Object.assign(personneDe(4), { organisation: null, conflits: [personneDe(5).organisation] });
  return charge;
}

/** La principale, sa proposition retenue, puis le plan bloqué. */
export function chargeBloquee() {
  const principale = chargePrincipale();
  const charge = executer(principale, 'retenirProposition', { id: principale.propositions[0].id });
  return executer(charge, 'changerEtat', { etat: 'bloque' });
}

// La principale, sa proposition retenue, puis une personne ajoutée : le
// retenu ne la place pas, et l'ouverture avertit de la dérive.
function chargeEnDerive() {
  const principale = chargePrincipale();
  const charge = executer(principale, 'retenirProposition', { id: principale.propositions[0].id });
  return executer(charge, 'ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } });
}

// La petite démonstration, la table 4 réservée en entier pour tous les
// tours : elle est gelée.
function chargeGelee() {
  let charge = demonstration('petite');
  for (const participant of [1, 2, 3]) {
    charge = executer(charge, 'reserver', { participant, table: 4, siege: participant, portee: 'tous', tour: null });
  }
  return charge;
}

/** Le fichier d'état d'une charge, posé dans les Documents sous BASE,
 *  dans le dossier de cette base. */
export const fichierEtat = (charge, base = BASE) => ({
  racine: 'documents',
  chemin: `${base}/${base}${SUFFIXES.etat}`,
  texte: serialiser(charge, { revision: 1, produitVersion: VERSION.affichee }),
});

/** Les réglages locaux de la machine, posés dans les Documents, le
 *  dossier de travail des épreuves : le papier choisi, aucun cadrage, et
 *  le modèle de badge quand il est donné. */
export const fichierReglages = (papier, { modeleBadge = null } = {}) => ({
  racine: 'documents',
  chemin: FICHIER_REGLAGES,
  texte: serialiserReglages({ format: 1, papier, cadrages: [], ...(modeleBadge === null ? {} : { modele_badge: modeleBadge }) }),
});

/** Les octets du CSV des cas limites, tels que le fichier les porte. */
export async function octetsCasLimites() {
  return new Uint8Array(await (await fetch(urlCasLimites)).arrayBuffer());
}

/**
 * Un exécuteur de génération que l'épreuve ne résout pas : la génération
 * reste en cours tant que le montage vit ; annuler la rejette par
 * ErreurAnnulee.
 */
export function executeurSuspendu() {
  return {
    lancer() {
      let rejeter;
      const resultat = new Promise((_, ko) => {
        rejeter = ko;
      });
      return {
        surAvancement: () => () => {},
        resultat,
        annuler() {
          rejeter(new ErreurAnnulee());
        },
      };
    },
  };
}

// --- Les parcours -------------------------------------------------------------

/**
 * Monte App sur la charge, ouvre l'événement depuis la liste, passe en
 * écriture si demandé, montre la première proposition au plan quand la
 * charge n'a pas de retenu, puis ouvre la section. Rend le montage.
 *
 * @param {Object} contexte   celui de creerContexte
 * @param {Object} charge
 * @param {{ecriture?: boolean, section?: string, options?: Object}} [reglages]
 *   options : celles de monterApp, ses fichiers ajoutés à celui de la charge
 */
export async function ouvrirEvenement(contexte, charge, { ecriture = false, section = 'plan', options = {} } = {}) {
  const m = await contexte.monter({ ...options, fichiers: [fichierEtat(charge), ...(options.fichiers ?? [])] });
  await cliquer(m, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
  await element(m, '[data-ecran="evenement"]');
  if (ecriture) {
    await cliquer(m, '[data-place-fixe] [data-commande="modifier"]');
    await element(m, '[data-place-fixe] [data-commande="lecture"]');
  }
  if (charge.retenu === null && charge.propositions.length > 0) {
    await cliquer(m, '[data-commande="section"][data-cible="propositions"]');
    await cliquerAction(m, `[data-proposition="${charge.propositions[0].id}"]`, 'voir');
    await element(m, '[data-section="plan"]');
  }
  await cliquer(m, `[data-commande="section"][data-cible="${section}"]`);
  await element(m, `[data-section="${section}"]`);
  if (section === 'plan') {
    await attendre('le plan posé', () => {
      const vue = m.racine.querySelector('[data-vue]');
      return vue?.getAttribute('transform') && m.racine.querySelectorAll('[data-table]').length === charge.tables.length;
    });
  }
  return m;
}

/**
 * Ouvre l'événement de la charge, sur la section donnée, puis l'aperçu
 * avant impression par la commande « Imprimer… » de sa tête (§ 11.7), et
 * rend le montage. Le papier de la machine est posé avant le montage dans
 * les réglages locaux ; null n'en pose aucun, et l'aperçu s'ouvre sur la
 * question du papier. Avec un papier, l'aperçu rend son document.
 *
 * @param {Object} contexte
 * @param {Object} charge
 * @param {{papier?: 'A4'|'Lettre'|null, ecriture?: boolean, section?: string, options?: Object}} [reglages]
 */
export async function ouvrirApercu(contexte, charge, { papier = 'A4', ecriture = false, section = 'plan', options = {} } = {}) {
  const fichiers = [...(papier === null ? [] : [fichierReglages(papier)]), ...(options.fichiers ?? [])];
  const m = await ouvrirEvenement(contexte, charge, { ecriture, section, options: { ...options, fichiers } });
  await cliquer(m, '[data-ecran="evenement"] [data-commande="apercu"]');
  await element(m, '[data-ecran="apercu"]');
  if (papier !== null) await element(m, '[data-impression] [data-feuille]');
  return m;
}

// Un écran d'événement sur la principale, sur la section donnée, au mode
// donné ; la bloquée pour 'bloque'.
function ecranDeSection(section, mode) {
  return {
    nom: `evenement.${section}.${mode}`,
    mode,
    async atteindre(contexte) {
      const charge = mode === 'bloque' ? chargeBloquee() : chargePrincipale();
      const m = await ouvrirEvenement(contexte, charge, { ecriture: mode === 'ecriture', section });
      // La page de qualité se lit dessinée, chaque graphique amené à son
      // tour : les gardes lisent ses marques sous chaque mode.
      if (section === 'qualite') await qualiteDessinee(m);
      return m.racine;
    },
  };
}

// La principale en écriture, sur le plan.
const planEnEcriture = (contexte, options) => ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'plan', options });

// La page de qualité du montage dessinée : une vue posée au moins, chaque
// graphique de la section amené à son tour dans la zone visible
// (dessinerGraphiques), mesuré et porteur d'une marque au moins.
async function qualiteDessinee(m) {
  await attendre('une vue de la page de qualité', () => m.racine.querySelector('[data-section="qualite"] [data-vue-qualite]'));
  await dessinerGraphiques(m.racine.querySelector('[data-section="qualite"]'));
  await attendre('la page de qualité dessinée', () => {
    const section = m.racine.querySelector('[data-section="qualite"]');
    if (section === null || section.querySelector('[data-vue-qualite]') === null) return false;
    return [...section.querySelectorAll('svg[data-graphique]')].every(
      (svg) => Number(svg.getAttribute('width')) > 0 && svg.querySelector('[data-marque]') !== null,
    );
  });
}

// Ouvre l'événement de la charge sur la page de qualité (ouvrirEvenement),
// puis attend son dessin. Rend le montage.
async function ouvrirQualite(contexte, charge, { ecriture = false, options = {} } = {}) {
  const m = await ouvrirEvenement(contexte, charge, { ecriture, section: 'qualite', options });
  await qualiteDessinee(m);
  return m;
}


// Les commandes qui ouvrent un jumeau, sous le sélecteur donné.
const commandesJumeau = (m, sous) => m.racine.querySelectorAll(`${sous} [data-commande="ouvrirJumeau"]`);

// Ouvre, par sa commande, chaque jumeau sous le sélecteur donné, l'un après
// l'autre — la commande d'un jumeau ouvert devient celle qui le ferme —,
// puis attend que chacun soit rendu. Rend le nombre de jumeaux ouverts.
async function ouvrirJumeaux(m, sous) {
  const total = commandesJumeau(m, sous).length;
  for (let ouverts = 0; ouverts < total; ouverts += 1) {
    const commande = commandesJumeau(m, sous)[0];
    if (commande === undefined) throw new Error(`écran : ${total - ouverts} jumeau(x) de ${sous} sans commande d'ouverture`);
    commande.click();
    flushSync();
    await uneImage();
  }
  await attendre(`les ${total} jumeaux de ${sous} ouverts`, () => commandesJumeau(m, sous).length === 0 && m.racine.querySelectorAll(`${sous} [data-jumeau]`).length >= total);
  return total;
}

// Un jumeau du profil ouvert sur la page de qualité de la charge, au mode
// donné : regarder ne refuse rien et n'écrit rien (§ 8.4) — un refus rendu
// ou une primitive d'écriture appelée depuis l'ouverture de la page fait
// lever l'écran.
async function jumeauSansEcriture(contexte, charge) {
  const m = await ouvrirQualite(contexte, charge);
  await sansEcriture(m, 'l’ouverture d’un jumeau', () => ouvrirJumeaux(m, '[data-vue-qualite="profil"]'));
  return m.racine;
}

// Regarder ne refuse rien et n'écrit rien (§ 8.4, C9, contrainte 57) :
// joue gestes(), puis lève quand un refus est rendu ou qu'une primitive
// d'écriture du système simulé a été appelée depuis, quoi nommant les
// gestes.
async function sansEcriture(m, quoi, gestes) {
  const ecritures = m.trace.length;
  await gestes();
  if (m.racine.querySelector('[data-refus]') !== null) throw new Error(`écran : un refus rendu à ${quoi}`);
  if (m.trace.length !== ecritures) throw new Error(`écran : ${quoi} a écrit ${JSON.stringify(m.trace.slice(ecritures))}`);
}

// Le sélecteur de la vue de comparaison.
const COMPARAISON = '[data-vue-qualite="comparaison"]';

// La vue de comparaison du montage amenée en haut de la zone visible, où
// elle se calcule, puis rendue : sa première phrase écrite — la seule sans
// second placement —, et son tracé, quand elle en porte un, dessiné et
// marqué.
async function comparaisonRendue(m) {
  await attendre('une vue de la page de qualité', () => m.racine.querySelector('[data-section="qualite"] [data-vue-qualite]'));
  (await element(m, COMPARAISON)).scrollIntoView({ block: 'start' });
  await element(m, `${COMPARAISON} [data-phrase-comparaison]`);
  if (m.racine.querySelector(`${COMPARAISON} svg[data-graphique="comparaison"]`) !== null) {
    await dessinerGraphiques(m.racine.querySelector(COMPARAISON));
    await element(m, `${COMPARAISON} [data-graphique="comparaison"] [data-marque]`);
  }
}

// Ouvre l'événement de la charge sur la page de qualité, au mode donné,
// puis rend sa vue de comparaison (comparaisonRendue) : les graphiques des
// autres vues gardent leur dessin différé. Rend le montage.
async function ouvrirComparaison(contexte, charge, { ecriture = false } = {}) {
  const m = await ouvrirEvenement(contexte, charge, { ecriture, section: 'qualite' });
  await comparaisonRendue(m);
  return m;
}

// Le repli « Tous les indicateurs » de la vue de comparaison ouvert par sa
// commande : elle le dit, et son tableau est rendu.
async function ouvrirRepli(m) {
  await cliquer(m, `${COMPARAISON} [data-tous-les-indicateurs]`);
  await attendre('« Tous les indicateurs » ouvert', () => {
    const commande = m.racine.querySelector(`${COMPARAISON} [data-tous-les-indicateurs]`);
    return commande?.getAttribute('aria-expanded') === 'true' && document.getElementById(commande.getAttribute('aria-controls') ?? '')?.querySelector('table');
  });
}

// La vue de comparaison de la charge, au mode de l'événement : la vue
// rendue, puis, sans rien écrire ni rien refuser, le second placement
// changé par la liste « Comparer à : » au clavier, le repli ouvert, et le
// jumeau, quand la vue en porte un. La charge offre plusieurs candidats :
// une liste de moins de deux options lève, comme un second placement que
// la touche ne change pas.
async function comparaisonSansEcriture(contexte, charge) {
  const m = await ouvrirComparaison(contexte, charge);
  await sansEcriture(m, 'la vue de comparaison regardée', async () => {
    const liste = m.racine.querySelector(`${COMPARAISON} select[data-comparer-a]`);
    if (liste === null || liste.options.length < 2) throw new Error(`écran : la liste « Comparer à : » offre ${liste === null ? 'aucune' : liste.options.length} option, deux au moins attendues`);
    const avant = liste.value;
    liste.focus();
    await touche(liste.selectedIndex === liste.options.length - 1 ? 'ArrowUp' : 'ArrowDown');
    await attendre('un autre second placement', () => m.racine.querySelector(`${COMPARAISON} select[data-comparer-a]`)?.value !== avant);
    await comparaisonRendue(m);
    await ouvrirRepli(m);
    await ouvrirJumeaux(m, COMPARAISON);
  });
  return m.racine;
}

// La carte du départ de la section Génération : la ligne de la proposition
// 1 choisie pour départ par « Repartir d'elle », dans son menu « Actions »
// au tableau des propositions, puis la case du tour 1 cochée par un clic, sans rien écrire
// ni rien refuser, à tout mode.
async function departChoisi(contexte, charge, { ecriture = false } = {}) {
  const m = await ouvrirEvenement(contexte, charge, { ecriture, section: 'propositions' });
  await sansEcriture(m, 'le choix d’un départ', async () => {
    await cliquerAction(m, '[data-proposition="1"]', 'repartir');
    await element(m, '[data-section="generation"] [data-depart]');
    await cliquerPointeur(await element(m, '[data-depart] [data-tour-fige="1"]'));
    await attendre('le tour 1 coché', () => m.racine.querySelector('[data-depart] [data-tour-fige="1"]')?.checked === true);
  });
  return m.racine;
}

// La page de qualité de chargeNiveaux, son sélecteur du mélange des tables
// posé sur la position donnée par un clic, et son jumeau ouvert : chaque
// ligne y écrit les trois pourcentages, chacun suivi du compte de sa ligne.
async function tablesSurPosition(contexte, position) {
  const m = await ouvrirQualite(contexte, chargeNiveaux());
  await cliquer(m, `[data-vue-qualite="tables"] [data-position-tables="${position}"]`);
  await attendre(`la position « ${position} » choisie`, () => m.racine.querySelector(`[data-position-tables="${position}"]`)?.checked === true);
  await qualiteDessinee(m);
  await ouvrirJumeaux(m, '[data-vue-qualite="tables"]');
  return m.racine;
}

// Un logo d'épreuve inventé, dessiné sur un canevas hors du document : un
// disque et un bandeau sur fond transparent, 360 × 120 ; ses octets PNG.
async function logoEpreuve() {
  const canevas = new OffscreenCanvas(360, 120);
  const contexte = canevas.getContext('2d');
  contexte.fillStyle = 'rgb(32, 96, 160)';
  contexte.beginPath();
  contexte.arc(60, 60, 48, 0, 2 * Math.PI);
  contexte.fill();
  contexte.fillStyle = 'rgb(232, 140, 40)';
  contexte.fillRect(124, 36, 220, 48);
  const blob = await canevas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
}

// L'image du montage qu'atteint le sélecteur, attendue chargée.
const imageChargee = (m, selecteur) =>
  attendre(`${selecteur} chargée`, () => {
    const image = m.racine.querySelector(selecteur);
    return image?.complete && image.naturalWidth > 0 ? image : null;
  });

// La principale ouverte en écriture sur les participants, la fiche de la
// personne 1 ouverte, et son logo choisi par « Logo » : la vignette chargée
// et « Retirer le logo » offert. Rend le montage.
async function ficheAvecLogo(contexte) {
  const aImporter = [{ nom: 'logo-epreuve.png', octets: await logoEpreuve() }];
  const reglages = { ecriture: true, section: 'participants', options: { aImporter } };
  const m = await ouvrirEvenement(contexte, chargePrincipale(), reglages);
  await cliquer(m, '[data-participant="1"] [data-commande="fiche"]');
  await cliquer(m, '[data-fiche="1"] [data-commande="choisirLogo"]');
  await imageChargee(m, '[data-fiche="1"] [data-logo-vignette] img');
  await element(m, '[data-fiche="1"] [data-commande="retirerLogo"]');
  return m;
}

/**
 * Le contexte d'un parcours : il monte App dans la langue et le thème
 * donnés, garde chaque montage et chaque nettoyage, et défait tout par
 * defaire(), les nettoyages d'abord, dans l'ordre inverse.
 *
 * @param {{langue?: 'fr'|'temoin', theme?: 'clair'|'sombre'}} [reglages]
 */
export function creerContexte({ langue = 'fr', theme = 'clair' } = {}) {
  const montages = [];
  const nettoyages = [];
  return {
    langue,
    montages,
    /** Le dernier montage : celui que l'écran montre. */
    get montage() {
      return montages.at(-1) ?? null;
    },
    async monter(options = {}) {
      const m = await monterApp({ langue, theme, ...options });
      montages.push(m);
      return m;
    },
    nettoyer(fn) {
      nettoyages.push(fn);
    },
    /** Ce que le collecteur a reçu depuis chaque montage. */
    erreurs() {
      return montages.flatMap((m) => m.erreurs());
    },
    async defaire() {
      for (const fn of nettoyages.splice(0).reverse()) await fn();
      for (const m of montages.splice(0).reverse()) m.demonter();
      window.scrollTo(0, 0);
    },
  };
}

/** Les écrans de l'itération. Leur union rend chaque sorte de MARQUES. */
export const ECRANS = Object.freeze([
  {
    nom: 'accueil.liste',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter({ fichiers: [fichierEtat(chargePrincipale()), fichierEtat(chargeGelee(), 'gelee')] });
      await element(m, `[data-evenement="${BASE}/${BASE}"]`);
      await chargerResumes(m);
      return m.racine;
    },
  },
  {
    nom: 'accueil.chargement',
    mode: null,
    async atteindre(contexte) {
      // La liste paraît avant ses résumés : tant que l'horloge pilotée
      // n'avance pas, chaque valeur de résumé porte le signe du chargement :
      // trois par ligne, les deux mesures du retenu et la meilleure
      // proposition. Rien ici ne l'avance : les signes restent pendant les
      // relevés des deux thèmes, où le trait de chacun se mesure comme la
      // marque « chargement ».
      const m = await contexte.monter({ fichiers: [fichierEtat(chargePrincipale()), fichierEtat(chargeGelee(), 'gelee')] });
      await attendre('le signe du chargement dans chaque valeur de résumé', () =>
        [BASE, 'gelee'].every((base) => m.racine.querySelectorAll(`[data-evenement="${base}/${base}"] [aria-busy="true"] [data-chargement]`).length === 3),
      );
      return m.racine;
    },
  },
  {
    nom: 'accueil.mesuresRetenu',
    mode: null,
    async atteindre(contexte) {
      // La principale, sa proposition retenue : la ligne montre les
      // collisions cumulées et les rencontres répétées choisies du retenu et
      // la meilleure proposition du classement, et le pointeur réel sur
      // l'intitulé des collisions — un en-tête de colonne du tableau, une
      // fois pour la liste — ouvre son infobulle.
      const principale = chargePrincipale();
      const charge = executer(principale, 'retenirProposition', { id: principale.propositions[0].id });
      const m = await contexte.monter({ fichiers: [fichierEtat(charge)] });
      const ligne = `[data-evenement="${BASE}/${BASE}"]`;
      await chargerResumes(m);
      await attendre('les mesures du retenu et la meilleure proposition', () =>
        ['[data-colonne="collisionsCumulees"]', '[data-colonne="rencontresRepetees"]', '[data-meilleure-id]'].every((valeur) =>
          /\d/.test(m.racine.querySelector(`${ligne} ${valeur}`)?.textContent ?? ''),
        ),
      );
      const { x, y } = await centre(await element(m, '[data-ecran="accueil"] thead [data-terme="collisionsCumulees"]'));
      await pointer('bouger', x, y);
      await attendre("l'infobulle des collisions", () => {
        const bulle = m.racine.querySelector('[data-ecran="accueil"] [role="tooltip"]');
        return bulle !== null && !bulle.hidden && getComputedStyle(bulle).visibility === 'visible';
      });
      return m.racine;
    },
  },
  {
    nom: 'accueil.vide',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter();
      await element(m, '[data-ecran="accueil"] [data-dossier-travail]');
      return m.racine;
    },
  },
  {
    nom: 'apropos',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter();
      await cliquer(m, '[data-bandeau] [data-commande="apropos"]');
      await element(m, '[data-ecran="apropos"]');
      return m.racine;
    },
  },
  {
    nom: 'parametres',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter();
      await cliquer(m, '[data-bandeau] [data-commande="parametres"]');
      await element(m, '[data-ecran="parametres"]');
      return m.racine;
    },
  },
  {
    nom: 'recuperation',
    mode: null,
    async atteindre(contexte) {
      const sain = fichierEtat(chargePrincipale());
      const tronque = { ...sain, texte: sain.texte.slice(0, Math.floor(sain.texte.length / 2)) };
      const precedent = { ...sain, chemin: `${BASE}/${BASE}${SUFFIXES.precedent}` };
      const m = await contexte.monter({ fichiers: [tronque, precedent] });
      await cliquer(m, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
      await element(m, '[data-ecran="recuperation"]');
      return m.racine;
    },
  },
  {
    nom: 'dossier.question',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter({
        systeme: { executable: PUBLIE, sonde: { portable: 'EACCES' } },
        fichiers: [{ ...fichierEtat(chargePrincipale()), racine: 'portable' }],
      });
      await element(m, '[data-question]');
      return m.racine;
    },
  },
  ...SECTIONS_EVENEMENT.flatMap((section) => ['lecture', 'ecriture', 'bloque'].map((mode) => ecranDeSection(section, mode))),
  {
    nom: 'plan.tableGelee',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargeGelee(), { ecriture: true, section: 'plan' });
      await element(m, '[data-table="4"] [data-marque="gel"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.miseEnEvidence',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(chaise(m, 4, 1));
      await cliquer(m, '[data-panneau="place"] [data-menu] [data-commande="mettreEnEvidence"]');
      await element(m, '[data-siege="4:1"] [data-marque="miseEnEvidence"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.focus',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      (await element(m, '[data-commande="pleinEcran"]')).focus();
      await touche('Tab');
      await element(m, '[data-plan] [data-marque="focus"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.panneauPlace',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(chaise(m, 3, 3));
      await element(m, '[data-panneau="place"]');
      await element(m, '[data-siege="3:3"] [data-marque="selection"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.menuPersonne',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(chaise(m, 4, 1));
      await element(m, '[data-panneau="place"] [data-menu]');
      return m.racine;
    },
  },
  {
    nom: 'plan.panneauTable',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(plateau(m, 3));
      await element(m, '[data-panneau="table"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.infobulle',
    mode: 'ecriture',
    async atteindre(contexte) {
      // Le survol de la première table signalée du tour : l'infobulle ne
      // s'ouvre que sur une table en conflit.
      const m = await planEnEcriture(contexte);
      const { x, y } = await centre(m.racine.querySelector('[data-table] [data-marque="contourConflit"]'));
      await pointer('bouger', x, y);
      await attendre('l’infobulle', () => {
        const infobulle = m.racine.querySelector('[role="tooltip"]');
        return infobulle !== null && !infobulle.hidden && infobulle.getBoundingClientRect().width > 0;
      });
      return m.racine;
    },
  },
  {
    nom: 'plan.glissement',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      const depuis = await centre(chaise(m, 3, 2));
      const vers = await centre(chaise(m, 4, 2));
      await pointer('presser', depuis.x, depuis.y);
      contexte.nettoyer(async () => {
        await touche('Escape');
        await pointer('relacher', vers.x, vers.y);
      });
      for (let pas = 1; pas <= 10; pas += 1) {
        await pointer('bouger', depuis.x + ((vers.x - depuis.x) * pas) / 10, depuis.y + ((vers.y - depuis.y) * pas) / 10);
      }
      await element(m, '[data-fantome] [data-marque="fantome"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.refusPlace',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      const depuis = await centre(chaise(m, 3, 1));
      const vers = await centre(chaise(m, 1, 1));
      await pointer('presser', depuis.x, depuis.y);
      for (let pas = 1; pas <= 10; pas += 1) {
        await pointer('bouger', depuis.x + ((vers.x - depuis.x) * pas) / 10, depuis.y + ((vers.y - depuis.y) * pas) / 10);
      }
      await pointer('relacher', vers.x, vers.y);
      await element(m, '[data-surface] [data-refus="PLACE_RESERVEE"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.troisConflits',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La proposition TROIS_CONFLITS (chargeTroisConflits), écrite à la
      // main, montrée au tour 3, choisi au clavier : la table 1, qui réunit
      // les personnes 4 et 5, viole les quatre règles et superpose leurs
      // trames, la table 2 est saine ; puis la légende des conflits, ouverte
      // par la barre de vue.
      const m = await ouvrirEvenement(contexte, chargeTroisConflits(), { ecriture: true, section: 'plan' });
      const choix = await element(m, '[data-champ="tour"]');
      choix.focus();
      for (let essai = 0; essai < choix.options.length && choix.value !== '3'; essai += 1) {
        await touche('ArrowDown');
        flushSync();
      }
      for (const marque of ['trameEvitement', 'trameOrganisation', 'trameVoisins', 'trameTable']) {
        await element(m, `[data-table="1"] [data-marque="${marque}"]`);
      }
      await cliquer(m, '[data-commande="legende"]');
      await element(m, '[data-legende] [data-legende-regle="nouvelleTable"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.conflitsTable',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La petite démonstration en conflit, sans proposition, où la personne
      // 4, sans organisation, nomme celle de la personne 5 : une réservation
      // de chacune à la table 1 pour la soirée, acceptée, la table signalée ;
      // puis le panneau de la table, ouvert d'un clic, qui nomme la paire.
      let charge = demonstration('petite-conflit');
      const personneDe = (id) => charge.participants.find((personne) => personne.id === id);
      Object.assign(personneDe(4), { organisation: null, conflits: [personneDe(5).organisation] });
      for (const participant of [4, 5]) {
        charge = executer(charge, 'reserver', { participant, table: 1, siege: null, portee: 'tous', tour: null });
      }
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'plan' });
      await element(m, '[data-table="1"] [data-marque="trameEvitement"]');
      await cliquerPointeur(plateau(m, 1));
      await element(m, '[data-panneau="table"] [data-conflits-table] [data-conflit-organisation]');
      return m.racine;
    },
  },
  {
    nom: 'participants.refusChamp',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-section="participants"] [data-commande="ajouter"]');
      await element(m, '[data-section="participants"] [data-refus="NOM_REQUIS"]');
      return m.racine;
    },
  },
  {
    nom: 'participants.fiche',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-participant="1"] [data-commande="fiche"]');
      await element(m, '[data-fiche="1"]');
      return m.racine;
    },
  },
  {
    nom: 'participants.etiquettes',
    mode: 'ecriture',
    async atteindre(contexte) {
      // Deux personnes étiquetées, puis la fiche d'une troisième, où
      // « FINANCE » tapé au clavier s'enregistre sous l'orthographe que
      // l'événement porte : les pastilles neutres et leur croix de retrait, le
      // signal d'orthographe contre le champ, et la légende des étiquettes
      // sous celle des organisations.
      let charge = chargePrincipale();
      charge = executer(charge, 'changerEtiquettes', { id: 1, ajouter: 'finance, Montréal' });
      charge = executer(charge, 'changerEtiquettes', { id: 2, ajouter: 'bénévole' });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-participant="3"] [data-commande="fiche"]');
      const champ = await element(m, '[data-fiche="3"] [data-champ="etiquettes"]');
      champ.focus();
      for (const caractere of 'FINANCE') await touche(caractere);
      await touche('Enter');
      await element(m, '[data-fiche="3"] [data-etiquettes] [data-avertissement="ORTHOGRAPHE_RETENUE"]');
      await element(m, '[data-legende-etiquettes]');
      return m.racine;
    },
  },
  {
    nom: 'participants.logo',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La vignette du logo sur le papier des badges, « Logo » et « Retirer
      // le logo ».
      const m = await ficheAvecLogo(contexte);
      return m.racine;
    },
  },
  {
    nom: 'participants.logoAgrandi',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La vignette cliquée : l'image à la largeur de la fiche, puis
      // « Fermer », qui tient le focus.
      const m = await ficheAvecLogo(contexte);
      await cliquer(m, '[data-fiche="1"] [data-logo-vignette]');
      await imageChargee(m, '[data-fiche="1"] [data-logo-agrandi] img');
      await attendre('le focus sur « Fermer »', () => document.activeElement?.dataset.commande === 'fermerLogo');
      return m.racine;
    },
  },
  {
    nom: 'participants.presence',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La présence par tour dans la grille : la personne 4 présente aux
      // tours 3 et 4, en pastille ; puis les cases de la personne 1 ouvertes
      // au clavier, les tours 3 et 4 décochés, la saisie en cours.
      const charge = executer(chargePrincipale(), 'changerPresence', { id: 4, tours: [3, 4] });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'participants' });
      await element(m, '[data-participant="4"] [data-presence="partielle"]');
      const cellule = await element(m, '[data-section="participants"] [data-participant="1"] [data-champ="presence"]');
      cellule.focus();
      await touche('Enter');
      await element(m, '[data-participant="1"] [data-editeur-presence]');
      for (const cle of ['End', ' ', 'ArrowLeft', ' ']) {
        await touche(cle);
        flushSync();
      }
      await attendre('les tours 3 et 4 décochés', () =>
        [...m.racine.querySelectorAll('[data-participant="1"] [data-presence-tour]')].map((c) => c.checked).join() === 'true,true,false,false',
      );
      return m.racine;
    },
  },
  {
    nom: 'participants.conflitsOrganisation',
    mode: 'ecriture',
    async atteindre(contexte) {
      // Les conflits d'organisation dans la grille : la personne 2 nomme une
      // organisation, en pastille dans sa cellule ; puis les cases de la
      // personne 1 ouvertes au clavier, la première et la dernière cochées,
      // la saisie en cours.
      let charge = chargePrincipale();
      const propre = charge.participants.find(({ id }) => id === 2).organisation;
      const autre = charge.participants.find(({ organisation }) => organisation !== null && organisation !== propre).organisation;
      charge = executer(charge, 'ajouterConflit', { id: 2, organisation: autre });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'participants' });
      await element(m, '[data-participant="2"] [data-champ="conflits"] [data-conflits-personne]');
      const cellule = await element(m, '[data-section="participants"] [data-participant="1"] [data-champ="conflits"]');
      cellule.focus();
      await touche('Enter');
      await element(m, '[data-participant="1"] [data-editeur-choix]');
      for (const cle of [' ', 'End', ' ']) {
        await touche(cle);
        flushSync();
      }
      await attendre('deux organisations cochées', () =>
        [...m.racine.querySelectorAll('[data-participant="1"] [data-choix]')].filter((c) => c.checked).length === 2,
      );
      return m.racine;
    },
  },
  {
    nom: 'participants.groupes',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La liste groupée par organisation, choisie au clavier dans le
      // sélecteur, puis le premier groupe replié.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      const choix = await element(m, '[data-section="participants"] [data-champ="grouper"]');
      choix.focus();
      for (let essai = 0; essai < choix.options.length && choix.value !== 'organisation'; essai += 1) {
        await touche('ArrowDown');
        flushSync();
      }
      await element(m, '[data-groupe] [data-commande="basculerGroupe"]');
      const bouton = await cliquer(m, '[data-groupe] [data-commande="basculerGroupe"]');
      await attendre('un groupe replié', () => bouton.getAttribute('aria-expanded') === 'false' && m.racine.querySelectorAll('[data-groupe]').length > 1);
      return m.racine;
    },
  },
  {
    nom: 'participants.conflits',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La liste groupée par organisation, choisie au clavier, sous la
      // proposition montrée au plan : un groupe en conflit porte sa marque,
      // ses lignes de conflit et celles de ses personnes.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      const choix = await element(m, '[data-section="participants"] [data-champ="grouper"]');
      choix.focus();
      for (let essai = 0; essai < choix.options.length && choix.value !== 'organisation'; essai += 1) {
        await touche('ArrowDown');
        flushSync();
      }
      await element(m, '[data-groupe] [data-groupe-conflits]');
      await element(m, '[data-conflits] [data-conflit]');
      await element(m, '[data-participant] [data-conflit-personne]');
      return m.racine;
    },
  },
  {
    nom: 'import.apercu',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'import' });
      const octets = await octetsCasLimites();
      m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
      await cliquer(m, '[data-commande="choisirFichier"]');
      await element(m, '[data-apercu] [data-refusees]');
      return m.racine;
    },
  },
  {
    nom: 'import.rapport',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'import' });
      const octets = await octetsCasLimites();
      m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
      await cliquer(m, '[data-commande="choisirFichier"]');
      await cliquer(m, '[data-apercu] [data-commande="importer"]');
      await attendre('le rapport, ou la confirmation du remplacement', () =>
        m.racine.querySelector('[data-rapport]') ?? m.racine.querySelector('dialog[open]'),
      );
      if (m.racine.querySelector('[data-rapport]') === null) await cliquer(m, 'dialog[open] [data-commande="confirmer"]');
      await element(m, '[data-rapport]');
      return m.racine;
    },
  },
  {
    nom: 'participants.confirmer',
    mode: 'ecriture',
    async atteindre(contexte) {
      // Supprimer une personne qui tient une réservation se confirme dans
      // une fenêtre, qui nomme la réservation.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-participant="1"] [data-commande="supprimerParticipant"]');
      await element(m, 'dialog[open]');
      return m.racine;
    },
  },
  {
    nom: 'tables.objectifs',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La règle par défaut dans la carte des réglages ; la table 1 vise
      // « finance » pour la soirée sous sa règle propre, et au tour 2 en
      // suivant le défaut, ses objectifs par tour dépliés ; la table 2 vise
      // « cuisine », que personne ne porte : ses avis contre l'objectif.
      let charge = chargePrincipale();
      charge = executer(charge, 'changerEtiquettes', { id: 1, ajouter: 'finance' });
      charge = executer(charge, 'poserObjectif', { table: 1, tour: null, etiquettes: 'finance', regle: 'ou' });
      charge = executer(charge, 'poserObjectif', { table: 1, tour: 2, etiquettes: 'finance', regle: null });
      charge = executer(charge, 'poserObjectif', { table: 2, tour: null, etiquettes: 'cuisine', regle: null });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'tables' });
      await element(m, '[data-regle-objectifs]');
      await cliquer(m, '[data-section="tables"] [data-table="1"] [data-commande="basculerObjectifsTours"]');
      await element(m, '[data-objectif="1-2"][data-portee="tour"]');
      await element(m, '[data-objectif="2"] [data-avertissement="ETIQUETTE_ORPHELINE"]');
      return m.racine;
    },
  },
  {
    nom: 'evenement.avertissements',
    mode: 'lecture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargeEnDerive(), { section: 'plan' });
      await element(m, '[data-ecran="evenement"] [data-avertissement]');
      return m.racine;
    },
  },
  {
    nom: 'generation.enCours',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), {
        ecriture: true,
        section: 'generation',
        options: { executeur: executeurSuspendu() },
      });
      await cliquer(m, '[data-section="generation"] [data-commande="generer"]');
      await attendre('la génération lancée, ou sa question', () =>
        m.racine.querySelector('[data-avancement]') ?? m.racine.querySelector('[data-question="longue"]'),
      );
      if (m.racine.querySelector('[data-avancement]') === null) await cliquer(m, '[data-commande="confirmerGeneration"]');
      await element(m, '[data-avancement]');
      return m.racine;
    },
  },
  {
    nom: 'generation.priorites',
    mode: 'ecriture',
    async atteindre(contexte) {
      // L'éditeur des priorités sur un ordre réglé — les collisions
      // cumulées montées au-dessus des rencontres répétées, puis jointes à
      // l'excédent, chacun son poids —, puis la redondance jointe aux
      // animateurs : l'annonce du geste paraît.
      const montees = listeApres(LISTE_PAR_DEFAUT, 'monterCritere', 'collisionsCumulees');
      const paliers = listeApres(montees, 'joindrePalier', 'collisionsCumulees');
      const charge = executer(chargePrincipale(), 'changerPriorites', { paliers });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'generation' });
      await cliquer(m, '[data-section="generation"] [data-priorite="redondance"] [data-commande="joindrePalier"]');
      await attendre("l'annonce du geste", () => {
        const annonce = m.racine.querySelector('[data-section="generation"] [data-priorites] ~ [role="status"]');
        return (annonce?.textContent.trim() ?? '') !== '';
      });
      return m.racine;
    },
  },
  {
    nom: 'generation.modeObjectifs',
    mode: 'ecriture',
    async atteindre(contexte) {
      // Les tours hors objectif partagent un palier avec les animateurs :
      // choisir « l'équité d'abord » se refuse contre le groupe du mode, le
      // choix revenu.
      const paliers = listeApres(LISTE_PAR_DEFAUT, 'joindrePalier', 'animateursNonRencontres');
      const charge = executer(chargePrincipale(), 'changerPriorites', { paliers });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'generation' });
      await cliquer(m, '[data-section="generation"] [data-mode-objectifs] input[value="minimum"]');
      await element(m, '[data-mode-objectifs] [data-refus="OBJECTIFS_PALIER_PARTAGE"]');
      return m.racine;
    },
  },
  {
    nom: 'generation.depart',
    mode: 'ecriture',
    atteindre: (contexte) => departChoisi(contexte, chargeComparaison(), { ecriture: true }),
  },
  {
    nom: 'generation.depart.lecture',
    mode: 'lecture',
    atteindre: (contexte) => departChoisi(contexte, chargeComparaison()),
  },
  {
    nom: 'generation.depart.bloque',
    mode: 'bloque',
    atteindre: (contexte) => departChoisi(contexte, chargeBloquee()),
  },
  {
    nom: 'propositions.derivees',
    mode: 'lecture',
    async atteindre(contexte) {
      // Les deux dérivées de la proposition 1, chacune sa filiation sous
      // son numéro, classées avec leur départ ; chaque ligne porte son menu
      // « Actions », fermé.
      const m = await ouvrirEvenement(contexte, chargeDerivees(), { section: 'propositions' });
      await attendre('les filiations des deux dérivées', () => m.racine.querySelectorAll('[data-section="propositions"] [data-filiation]').length === 2);
      await element(m, '[data-proposition="4"] [data-menu-actions][aria-expanded="false"]');
      return m.racine;
    },
  },
  {
    nom: 'propositions.actions',
    mode: 'lecture',
    async atteindre(contexte) {
      // Le menu « Actions » de la dérivée n° 4 ouvert par un clic réel sur
      // son bouton : ses cinq actions, « Repartir d'elle » et « Comparer »
      // comprises, le focus sur la première ; rien d'écrit.
      const m = await ouvrirEvenement(contexte, chargeDerivees(), { section: 'propositions' });
      await sansEcriture(m, 'l’ouverture d’un menu « Actions »', async () => {
        await cliquerPointeur(await element(m, '[data-proposition="4"] [data-menu-actions]'));
        await attendre('le menu ouvert, le focus sur sa première action', () => document.activeElement?.matches('[data-proposition="4"] [role="menu"] [role="menuitem"]:first-child'));
      });
      return m.racine;
    },
  },
  {
    nom: 'propositions.conflitsRestants',
    mode: 'lecture',
    async atteindre(contexte) {
      // La proposition TROIS_CONFLITS (chargeTroisConflits), qui réunit une
      // personne et l'organisation qu'elle nomme : « N conflits restants »
      // sous son identifiant.
      const m = await ouvrirEvenement(contexte, chargeTroisConflits(), { section: 'propositions' });
      await element(m, '[data-section="propositions"] [data-proposition="1"] [data-conflits-restants]');
      return m.racine;
    },
  },
  {
    nom: 'propositions.critereSurvole',
    mode: 'lecture',
    async atteindre(contexte) {
      // Le pointeur réel sur un nom de critère de la phrase de l'ordre : la
      // colonne qu'il désigne se surligne, en-tête souligné.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'propositions' });
      const { x, y } = await centre(await element(m, '[data-ordre] [data-critere="excedentCollisions"]'));
      await pointer('bouger', x, y);
      await attendre('la colonne surlignée', () =>
        getComputedStyle(m.racine.querySelector('thead th[data-colonne="excedentCollisions"]')).textDecorationLine.includes('underline'),
      );
      return m.racine;
    },
  },
  {
    nom: 'propositions.infobulleColonne',
    mode: 'lecture',
    async atteindre(contexte) {
      // Le pointeur réel sur un en-tête de colonne : l'infobulle qui
      // l'explique paraît, visible, de largeur non nulle.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'propositions' });
      const { x, y } = await centre(await element(m, 'thead th[data-colonne="excedentCollisions"]'));
      await pointer('bouger', x, y);
      await attendre("l'infobulle de la colonne", () => {
        const bulle = m.racine.querySelector('[data-section="propositions"] [role="tooltip"]');
        return (
          bulle !== null &&
          !bulle.hidden &&
          bulle.getBoundingClientRect().width > 0 &&
          getComputedStyle(bulle).visibility === 'visible'
        );
      });
      return m.racine;
    },
  },
  {
    nom: 'qualite.infobulle',
    mode: 'lecture',
    async atteindre(contexte) {
      // Le pointeur réel au centre de la surface du profil en comptes,
      // amenée au milieu de la fenêtre comme centre() amène toute cible : le
      // rang pointé se désigne, et l'infobulle porte sa ligne du jumeau, son
      // pourcentage suivi du compte de la ligne. Rien ne la place à l'écart
      // du bandeau collant : l'infobulle elle-même reste dans la zone où
      // défile le graphique.
      const m = await ouvrirQualite(contexte, chargePrincipale());
      const { x, y } = await centre(await element(m, '[data-graphique="profilComptes"] > rect[pointer-events="all"]'));
      await pointer('bouger', x, y);
      await attendre("l'infobulle du profil", () => {
        const bulle = m.racine.querySelector('[data-vue-qualite="profil"] [role="tooltip"]');
        return (
          bulle !== null &&
          !bulle.hidden &&
          getComputedStyle(bulle).visibility === 'visible' &&
          bulle.querySelector('[data-pourcentage]') !== null &&
          m.racine.querySelector('[data-graphique="profilComptes"] [data-rang]') !== null
        );
      });
      return m.racine;
    },
  },
  {
    nom: 'qualite.jumeaux',
    mode: 'lecture',
    async atteindre(contexte) {
      // La principale : chaque jumeau de la page ouvert par sa commande. Les
      // écrans des objectifs et de la performance ouvrent les leurs.
      const m = await ouvrirQualite(contexte, chargePrincipale());
      await ouvrirJumeaux(m, '[data-section="qualite"]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.jumeaux.lecture',
    mode: 'lecture',
    atteindre: (contexte) => jumeauSansEcriture(contexte, chargePrincipale()),
  },
  {
    nom: 'qualite.jumeaux.bloque',
    mode: 'bloque',
    atteindre: (contexte) => jumeauSansEcriture(contexte, chargeBloquee()),
  },
  {
    nom: 'qualite.comparaison',
    mode: 'lecture',
    async atteindre(contexte) {
      // La vue de comparaison de chargeComparaison amenée en haut de la
      // zone visible, où elle se calcule ; son tracé dessiné, sa bascule
      // écrite, puis son jumeau, l'escalier du manque, ouvert par sa
      // commande.
      const m = await ouvrirComparaison(contexte, chargeComparaison());
      await element(m, `${COMPARAISON} [data-graphique="comparaison"] [data-marque]`);
      await element(m, `${COMPARAISON} [data-phrase-comparaison="bascule"]`);
      await ouvrirJumeaux(m, COMPARAISON);
      return m.racine;
    },
  },
  {
    nom: 'qualite.comparaison.phrase',
    mode: 'lecture',
    async atteindre(contexte) {
      // Deux valeurs de manque : les effectifs en une phrase, sans tracé, et
      // la dominance ; les colonnes au-dessus.
      const m = await ouvrirComparaison(contexte, chargeComparaisonPhrase());
      await element(m, `${COMPARAISON} [data-phrase-comparaison="peuDeValeurs"]`);
      await element(m, `${COMPARAISON} [data-colonne-comparaison="b"] [data-pourcentage]`);
      return m.racine;
    },
  },
  {
    nom: 'qualite.comparaison.seul',
    mode: 'lecture',
    async atteindre(contexte) {
      // La principale : un seul placement mesurable, la phrase seule.
      const m = await ouvrirComparaison(contexte, chargePrincipale());
      await element(m, `${COMPARAISON} [data-phrase-comparaison="seul"]`);
      return m.racine;
    },
  },
  {
    nom: 'qualite.comparaison.retenu',
    mode: 'lecture',
    async atteindre(contexte) {
      // Le retenu ajusté, source de la page, contre sa proposition
      // d'origine : le tracé des deux, la place « — » du retenu.
      const m = await ouvrirComparaison(contexte, chargeRetenuAjuste());
      await element(m, `${COMPARAISON} svg[data-graphique="comparaison"] [data-serie="b"]`);
      return m.racine;
    },
  },
  {
    nom: 'qualite.comparaison.repli',
    mode: 'lecture',
    async atteindre(contexte) {
      // « Tous les indicateurs » ouvert : les autres tuiles, sous leurs
      // groupes, dans chaque colonne ; sous un objectif qui concerne des
      // personnes, les deux pourcentages du repli s'y ajoutent au minimum
      // brut de la tête.
      const m = await ouvrirComparaison(contexte, chargeComparaisonObjectifs());
      await ouvrirRepli(m);
      return m.racine;
    },
  },
  {
    nom: 'qualite.comparaison.lecture',
    mode: 'lecture',
    atteindre: (contexte) => comparaisonSansEcriture(contexte, chargeDerivees()),
  },
  {
    nom: 'qualite.comparaison.bloque',
    mode: 'bloque',
    atteindre: (contexte) => comparaisonSansEcriture(contexte, executer(chargeRetenuAjuste(), 'changerEtat', { etat: 'bloque' })),
  },
  {
    nom: 'qualite.paires',
    mode: 'lecture',
    async atteindre(contexte) {
      // 12 / 4 × 3 / 6 : les paires choisies et imposées, et la matrice
      // dessinée sous le seuil.
      const m = await ouvrirQualite(contexte, chargePaires());
      await element(m, '[data-vue-qualite="paires"] [data-paire]');
      await element(m, '[data-graphique="matrice"] [data-case]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.objectifs',
    mode: 'lecture',
    async atteindre(contexte) {
      // La charge à objectifs, chaque jumeau de la page ouvert : celui des
      // objectifs porte la ligne de la soirée et celle de chaque table.
      const m = await ouvrirQualite(contexte, chargeObjectifs());
      await element(m, '[data-graphique="objectifs"]');
      await ouvrirJumeaux(m, '[data-section="qualite"]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.performance',
    mode: 'lecture',
    async atteindre(contexte) {
      // La principale et le compagnon des courses que sa génération rend :
      // la ligne de tête de la course et ses points de relevé, chaque
      // jumeau de la page ouvert, celui de la performance compris.
      const { charge, courses } = generationPrincipale();
      const m = await ouvrirQualite(contexte, charge, { options: { fichiers: [fichierCourses(charge, courses)] } });
      await element(m, '[data-vue-qualite="performance"] [data-course]');
      await element(m, '[data-vue-qualite="performance"] [data-point-releve]');
      await ouvrirJumeaux(m, '[data-section="qualite"]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.collisions.etroit',
    mode: 'lecture',
    async atteindre(contexte) {
      // chargeCollisionsEtroites : la barre de la seconde organisation
      // porte un segment « prouvé inévitable » étroit, à côté de son reste.
      const m = await ouvrirQualite(contexte, chargeCollisionsEtroites());
      await element(m, '[data-graphique="collisions"] [data-segment="prouve"]');
      await element(m, '[data-graphique="collisions"] [data-segment="reste"]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.niveaux',
    mode: 'lecture',
    async atteindre(contexte) {
      // La grille des tables, position « sièges », et la matrice portent
      // chacune les quatre niveaux de l'échelle.
      const m = await ouvrirQualite(contexte, chargeNiveaux());
      await element(m, '[data-graphique="tables"] [data-case]');
      await element(m, '[data-graphique="matrice"] [data-case]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.tables.assis',
    mode: 'lecture',
    atteindre: (contexte) => tablesSurPosition(contexte, 'assis'),
  },
  {
    nom: 'qualite.tables.doublons',
    mode: 'lecture',
    atteindre: (contexte) => tablesSurPosition(contexte, 'doublons'),
  },
  {
    nom: 'qualite.sansCourse',
    mode: 'lecture',
    async atteindre(contexte) {
      // La principale sans compagnon des courses : la phrase de la
      // performance.
      const m = await ouvrirQualite(contexte, chargePrincipale());
      await element(m, '[data-vue-qualite="performance"] [data-phrase-qualite="sansCourse"]');
      return m.racine;
    },
  },
  {
    nom: 'qualite.refus',
    mode: 'lecture',
    async atteindre(contexte) {
      // chargeRefusDessin : la garde du détail retire le dessin, la phrase
      // du refus et chaque contradiction nommée.
      const m = await ouvrirEvenement(contexte, chargeRefusDessin(), { section: 'qualite' });
      await element(m, '[data-section="qualite"] [data-phrase-qualite="refusDessin"]');
      return m.racine;
    },
  },
  {
    nom: 'apercu',
    mode: 'lecture',
    async atteindre(contexte) {
      // L'aperçu avant impression du plan de la principale, sa proposition
      // montrée : un brouillon, chaque feuille sous son filigrane.
      const m = await ouvrirApercu(contexte, chargePrincipale(), { section: 'participants' });
      await element(m, '[data-impression] [data-filigrane]');
      return m.racine;
    },
  },
  {
    nom: 'refus.modeLecture',
    mode: 'lecture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'participants' });
      await cliquer(m, '[data-etat="brouillon"] [data-commande="etat"]');
      await element(m, '[data-refus="MODE_LECTURE"]');
      return m.racine;
    },
  },
  {
    nom: 'refus.bloque',
    mode: 'bloque',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargeBloquee(), { section: 'participants' });
      await cliquer(m, '[data-etat="propose"] [data-commande="etat"]');
      await element(m, '[data-refus="LECTURE_SEULE"]');
      return m.racine;
    },
  },
  {
    nom: 'refus.verrou',
    mode: 'lecture',
    async atteindre(contexte) {
      const premier = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      premier.racine.hidden = true;
      const second = await contexte.monter({ systeme: { disque: premier.disque } });
      await cliquer(second, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
      await element(second, '[data-ecran="evenement"]');
      await cliquer(second, '[data-place-fixe] [data-commande="modifier"]');
      await element(second, '[data-refus="VERROU_PRIS"]');
      return second.racine;
    },
  },
]);
