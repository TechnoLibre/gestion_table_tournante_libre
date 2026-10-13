// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { ErreurAnnulee } from '../../src/application/generation.js';
import { texteLivre } from '../../src/demo/livrees.js';
import { SECTIONS } from '../../src/interface/evenement/sections.js';
import { LISTE_PAR_DEFAUT, listeApres } from '../../src/interface/generation/priorites.js';
import { rechercher } from '../../src/moteur/recherche.js';
import { serialiser } from '../../src/stockage/canonique.js';
import { texteDesCourses } from '../../src/stockage/courses.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../src/stockage/document.js';
import { SUFFIXES } from '../../src/stockage/noms.js';
import { FICHIER_REGLAGES, serialiserReglages } from '../../src/stockage/reglages_locaux.js';
import { VERSION } from '../../src/version.genere.js';
import urlCasLimites from '../../exemples/participants_cas_limites.csv?url';
import { dessinerGraphiques, pointer, touche } from './entrees.js';
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
 *  plus, chaque base dont il pose le résumé. Rend resumeRecu(base), qui
 *  attend, l'horloge pilotée avancée d'un pas à chaque image, que la liste
 *  ait reçu un résumé de base depuis le suivi, le rendu à jour : un résumé
 *  posé avant le suivi, d'une liste plus ancienne, n'y répond pas. */
export function suivreResumes(m) {
  const recues = new Set();
  const resumer = m.facade.resumer;
  m.facade.resumer = (lues, options) =>
    resumer(lues, {
      ...options,
      recevoir(base, resume) {
        options.recevoir(base, resume);
        recues.add(base);
      },
    });
  return (base) =>
    attendre(
      `le résumé de ${base} reçu par la liste`,
      () => {
        if (recues.has(base)) return true;
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
// personne par entrée d'appartenances — son appartenance, null sans —,
// tables tables rondes de sieges places numérotées de 1 à tables, tours
// tours.
function chargeInventee({ appartenances, tables, sieges, tours }) {
  const charge = creerCharge({ id: 'evt-qualite', nom: 'Soirée Pervenche', siegesParDefaut: sieges, tours });
  charge.participants = appartenances.map((appartenance, rang) => ({
    id: rang + 1,
    nom: NOMS[Math.floor(rang / PRENOMS.length) % NOMS.length],
    prenom: PRENOMS[rang % PRENOMS.length],
    appartenance,
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
  charge.prochainsIds = { participant: appartenances.length + 1, table: tables + 1, proposition: 1 };
  return charge;
}

const AUBIER = 'Coopérative Aubier';
const RESSAC = 'Atelier Ressac';

/** Douze personnes, quatre tables de trois, six tours (§ 12.5) : chacun
 *  revoit quelqu'un ; les deux premières, réservées ensemble à la table 1
 *  pour tous les tours, forment une paire imposée. Une génération de deux
 *  propositions. */
export function chargePaires() {
  const charge = chargeInventee({ appartenances: Array.from({ length: 12 }, (_, rang) => [AUBIER, RESSAC, null][rang % 3]), tables: 4, sieges: 3, tours: 6 });
  charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  return generee(charge, { graine: 5, nombre: 2, arret: 60 }).charge;
}

/** Douze personnes, trois tables de quatre, trois tours ; les six premières
 *  portent l'étiquette « finance », que la table 1 a pour objectif à tous
 *  les tours. Une génération d'une proposition, sous cet objectif. */
export function chargeObjectifs() {
  const charge = chargeInventee({ appartenances: Array.from({ length: 12 }, (_, rang) => [AUBIER, RESSAC, null][rang % 3]), tables: 3, sieges: 4, tours: 3 });
  for (const personne of charge.participants) if (personne.id <= 6) personne.etiquettes = ['finance'];
  charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  return generee(charge, { graine: 3, nombre: 1, arret: 300 }).charge;
}

// Le placement de chargeNiveaux, tours par tours, sièges non attribués.
// Les doublons parmi les affiliés (α − δ) valent 3 à la table 1 à chaque
// tour, 2 et 1 aux tables 2 et 3 du tour 1, 0 ailleurs ; les sièges sans
// appartenance nouvelle (c − δ) valent 0 à la table 2 du tour 2, 1 aux
// tables 2 et 3 du tour 3, 2 et 3 ailleurs ; la table 4 du tour 3 n'a aucun
// affilié. Les quatre de la table 1 se voient trois fois, 5 et 6 deux
// fois, 5 et 7 une fois, 1 et 5 jamais.
const NIVEAUX = Object.freeze([
  [[1, 2, 3, 4], [5, 6, 7, 12], [8, 9, 13, 14], [10, 11, 15, 16]],
  [[1, 2, 3, 4], [5, 8, 10, 11], [6, 9, 12, 13], [7, 14, 15, 16]],
  [[1, 2, 3, 4], [5, 6, 9, 10], [7, 8, 11, 12], [13, 14, 15, 16]],
]);

/** Seize personnes inventées, trois tables de quatre et une de cinq, trois
 *  tours : les quatre de la première appartenance réservées ensemble à la
 *  table 1 pour tous les tours, et la proposition NIVEAUX, écrite à la
 *  main, où la grille des tables, sous chaque position, et la matrice des
 *  rencontres portent les quatre niveaux de l'échelle (§ 12.7, D33, D35).
 *  La table 4 garde un siège vide à chaque tour : ses sièges et ses assis
 *  diffèrent, et leurs deux pourcentages aussi aux tours 1 et 2. */
export function chargeNiveaux() {
  const appartenances = [
    ...Array(4).fill(AUBIER),
    ...Array(3).fill(RESSAC),
    ...Array(2).fill('Collectif Brisant'),
    'Cercle Ormeau',
    'Brigade Sauge',
    ...Array(5).fill(null),
  ];
  let charge = chargeInventee({ appartenances, tables: 4, sieges: 4, tours: 3 });
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
 *  huit de la première appartenance réunies à la table 1, vingt-huit
 *  collisions par tour, aucune prouvée ; les huit de la seconde, une par
 *  table sauf deux à la table 2, une collision par tour, dont une seule
 *  prouvée — les deux réservées ensemble à la table 2 au tour 1. Le segment
 *  « prouvé inévitable » de la seconde vaut un sur un axe de 280 : il est
 *  étroit (§ 12.4, B13). Au-delà de SEUIL_MATRICE_PARTICIPANTS, la matrice
 *  ne se dessine pas. */
export function chargeCollisionsEtroites() {
  const appartenances = [...Array(8).fill(AUBIER), ...Array(8).fill(RESSAC), ...Array(48).fill(null)];
  const charge = chargeInventee({ appartenances, tables: 8, sieges: 8, tours: TOURS_ETROITS });
  charge.reservations = [9, 10].map((participant) => ({ participant, table: 2, siege: null, portee: 'tour', tour: 1 }));
  // Les tables 2 à 8 : la seconde appartenance, 9 et 10 à la table 2, puis
  // une de 11 à 16 par table, complétées des personnes sans appartenance.
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
 *  les Documents sous BASE. */
export const fichierCourses = (charge, entrees, base = BASE) => ({
  racine: 'documents',
  chemin: `${base}${SUFFIXES.courses}`,
  texte: texteDesCourses(charge.evenement.id, entrees),
});

// Un placement de la petite démonstration en conflit, quatre tours de
// quatre tables de trois, sièges non attribués : au tour 3, la table 1 réunit
// une même appartenance, des voisins revus et un retour à sa table, la
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

/** Le fichier d'état d'une charge, posé dans les Documents sous BASE. */
export const fichierEtat = (charge, base = BASE) => ({
  racine: 'documents',
  chemin: `${base}${SUFFIXES.etat}`,
  texte: serialiser(charge, { revision: 1, produitVersion: VERSION.affichee }),
});

/** Les réglages locaux de la machine, posés dans les Documents, le
 *  dossier de travail des épreuves : le papier choisi, aucun cadrage. */
export const fichierReglages = (papier) => ({
  racine: 'documents',
  chemin: FICHIER_REGLAGES,
  texte: serialiserReglages({ format: 1, papier, cadrages: [] }),
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
  await cliquer(m, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
  await element(m, '[data-ecran="evenement"]');
  if (ecriture) {
    await cliquer(m, '[data-place-fixe] [data-commande="modifier"]');
    await element(m, '[data-place-fixe] [data-commande="lecture"]');
  }
  if (charge.retenu === null && charge.propositions.length > 0) {
    await cliquer(m, '[data-commande="section"][data-cible="propositions"]');
    await cliquer(m, `[data-proposition="${charge.propositions[0].id}"] [data-commande="voir"]`);
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
  const ecritures = m.trace.length;
  await ouvrirJumeaux(m, '[data-vue-qualite="profil"]');
  if (m.racine.querySelector('[data-refus]') !== null) throw new Error('écran : un refus rendu à l’ouverture d’un jumeau');
  if (m.trace.length !== ecritures) throw new Error(`écran : l’ouverture d’un jumeau a écrit ${JSON.stringify(m.trace.slice(ecritures))}`);
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
      await element(m, `[data-evenement="${BASE}"]`);
      await chargerResumes(m);
      return m.racine;
    },
  },
  {
    nom: 'accueil.chargement',
    mode: null,
    async atteindre(contexte) {
      // La liste paraît avant ses résumés : tant que l'horloge pilotée
      // n'avance pas, chaque valeur de résumé porte le signe du chargement.
      // Rien ici ne l'avance : les signes restent pendant les relevés des
      // deux thèmes, où le trait de chacun se mesure comme la marque
      // « chargement ».
      const m = await contexte.monter({ fichiers: [fichierEtat(chargePrincipale()), fichierEtat(chargeGelee(), 'gelee')] });
      await attendre('le signe du chargement dans chaque valeur de résumé', () =>
        [BASE, 'gelee'].every((base) => m.racine.querySelectorAll(`[data-evenement="${base}"] [aria-busy="true"] [data-chargement]`).length === 2),
      );
      return m.racine;
    },
  },
  {
    nom: 'accueil.mesuresRetenu',
    mode: null,
    async atteindre(contexte) {
      // La principale, sa proposition retenue : la ligne montre la
      // différence du retenu et la meilleure proposition du classement, et le
      // pointeur réel sur l'intitulé de la différence — un en-tête de
      // colonne du tableau, une fois pour la liste — ouvre son infobulle.
      const principale = chargePrincipale();
      const charge = executer(principale, 'retenirProposition', { id: principale.propositions[0].id });
      const m = await contexte.monter({ fichiers: [fichierEtat(charge)] });
      const ligne = `[data-evenement="${BASE}"]`;
      await chargerResumes(m);
      await attendre('la différence du retenu et la meilleure proposition', () =>
        ['[data-colonne="diffRedondance"]', '[data-meilleure-id]'].every((valeur) => /\d/.test(m.racine.querySelector(`${ligne} ${valeur}`)?.textContent ?? '')),
      );
      const { x, y } = await centre(await element(m, '[data-ecran="accueil"] thead [data-terme="diffRedondance"]'));
      await pointer('bouger', x, y);
      await attendre("l'infobulle de la différence", () => {
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
    nom: 'recuperation',
    mode: null,
    async atteindre(contexte) {
      const sain = fichierEtat(chargePrincipale());
      const tronque = { ...sain, texte: sain.texte.slice(0, Math.floor(sain.texte.length / 2)) };
      const precedent = { ...sain, chemin: `${BASE}${SUFFIXES.precedent}` };
      const m = await contexte.monter({ fichiers: [tronque, precedent] });
      await cliquer(m, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
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
      const m = await planEnEcriture(contexte);
      const { x, y } = await centre(plateau(m, 1));
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
      // La petite démonstration en conflit et la proposition TROIS_CONFLITS,
      // écrite à la main, montrée au tour 3, choisi au clavier : la table 1
      // viole les trois règles et superpose leurs trames, la table 2 est
      // saine ; puis la légende des conflits, ouverte par la barre de vue.
      const charge = avecTours(demonstration('petite-conflit'), TROIS_CONFLITS);
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'plan' });
      const choix = await element(m, '[data-champ="tour"]');
      choix.focus();
      for (let essai = 0; essai < choix.options.length && choix.value !== '3'; essai += 1) {
        await touche('ArrowDown');
        flushSync();
      }
      for (const marque of ['trameAppartenance', 'trameVoisins', 'trameTable']) await element(m, `[data-table="1"] [data-marque="${marque}"]`);
      await cliquer(m, '[data-commande="legende"]');
      await element(m, '[data-legende] [data-legende-regle="nouvelleTable"]');
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
      // sous celle des appartenances.
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
    nom: 'participants.groupes',
    mode: 'ecriture',
    async atteindre(contexte) {
      // La liste groupée par appartenance, choisie au clavier dans le
      // sélecteur, puis le premier groupe replié.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      const choix = await element(m, '[data-section="participants"] [data-champ="grouper"]');
      choix.focus();
      for (let essai = 0; essai < choix.options.length && choix.value !== 'appartenance'; essai += 1) {
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
      // La liste groupée par appartenance, choisie au clavier, sous la
      // proposition montrée au plan : un groupe en conflit porte sa marque,
      // ses lignes de conflit et celles de ses personnes.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      const choix = await element(m, '[data-section="participants"] [data-champ="grouper"]');
      choix.focus();
      for (let essai = 0; essai < choix.options.length && choix.value !== 'appartenance'; essai += 1) {
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
      // L'éditeur des priorités sur un ordre réglé — l'excédent et les
      // collisions cumulées au même palier, chacun son poids —, puis la
      // redondance jointe aux animateurs : l'annonce du geste paraît.
      const paliers = listeApres(LISTE_PAR_DEFAUT, 'joindrePalier', 'collisionsCumulees');
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
      // Les tours hors objectif partagent un palier : choisir « l'équité
      // d'abord » se refuse contre le groupe du mode, le choix revenu.
      const paliers = listeApres(LISTE_PAR_DEFAUT, 'joindrePalier', 'toursHorsObjectif');
      const charge = executer(chargePrincipale(), 'changerPriorites', { paliers });
      const m = await ouvrirEvenement(contexte, charge, { ecriture: true, section: 'generation' });
      await cliquer(m, '[data-section="generation"] [data-mode-objectifs] input[value="minimum"]');
      await element(m, '[data-mode-objectifs] [data-refus="OBJECTIFS_PALIER_PARTAGE"]');
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
      // chargeCollisionsEtroites : la barre de la seconde appartenance
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
      await cliquer(second, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
      await element(second, '[data-ecran="evenement"]');
      await cliquer(second, '[data-place-fixe] [data-commande="modifier"]');
      await element(second, '[data-refus="VERROU_PRIS"]');
      return second.racine;
    },
  },
]);
