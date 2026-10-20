// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Empreintes de référence du moteur (§ 5.7, § 14.10, § 15.5) : ce qui se
// calcule, et le fichier versionné qui en garde la valeur,
// test/fixtures/moteur/empreintes_defaut.json.
//
// Empreinte d'un plan. Le plan indexé tableDe (indexerPlan : une case par
// personne et par tour, dans l'ordre canonique de l'instance, l'index de la
// table ou RESERVE) s'écrit en entiers de 32 bits petit-boutistes, suivis du
// texte JSON des grandeurs nommées, chacune sous son nom, dans l'ordre de
// GRANDEURS ; l'empreinte est le SHA-256 de ces octets, en hexadécimal. Les
// grandeurs sont celles que le classement lit — le plus grand écart au
// plafond a priori, l'excédent de collisions, les collisions cumulées, les
// rencontres répétées choisies, les retours choisis, la redondance —, lues
// dans mesurer et dans manque.js, jamais dans le n-uplet de la recherche :
// une composante toujours nulle qu'on retire ou qu'on ajoute ne change aucune
// empreinte. Le fichier garde aussi les grandeurs en clair, pour que l'échec
// nomme celle qui a changé.
//
// Ce que le fichier porte, chaque section dans cet ordre :
// - reglages : les constantes de ce module sous lesquelles il a été relevé ;
// - plans : pour chaque configuration du catalogue, dans son ordre, et chaque
//   graine de GRAINES, l'empreinte du plan que rend rechercher à ARRET
//   mouvements, une proposition, historique par défaut, quatre cases cochées ;
// - combinaisons : la petite démonstration sous chacune des seize
//   combinaisons des quatre cases, graine 1, mêmes réglages ;
// - bascule : les configurations de BASCULE sous chaque graine de GRAINES, à
//   BASCULE.arret mouvements, assez pour que la meilleure affectation
//   s'améliore encore après la bascule vers l'ordre des contraintes : à
//   ARRET, sur ces configurations, elle ne change plus une fois l'écart
//   annulé, et l'ordre des composantes après la bascule ne laisse aucune
//   trace dans les plans ;
// - classements : pour chaque charge de CLASSEMENT.cles, le classement
//   qu'evaluer rend sous les quatre cases cochées, plafond a priori calculé
//   (connu) puis inconnu, et les grandeurs nommées de chaque proposition.
//
// GTT_EMPREINTES choisit le mode, sur le modèle de GTT_CAPTURES : verifier
// par défaut ; ecrire récrit le fichier, par la seule épreuve
// src/moteur/empreintes.test.js, et seulement sur l'état du moteur que le
// fichier doit garder. Une empreinte qui change est un défaut, jamais une
// régénération : écrire est un geste conscient (§ 15.5, point 5).
//
// Le mode des objectifs (D20) est un paramètre de chaque calcul : 'places',
// le défaut, laisse la configuration et la charge sans mode ; 'chacun' et
// 'minimum' le leur donnent. Sans objectif, les trois rendent les mêmes
// empreintes : le fichier, relevé sans mode, les garde toutes (A21, « le mode
// ne touche pas au défaut »). Le classement se lit en noms : la liste aplatie
// des critères appliqués, palier après palier.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appliquerCommande } from '../src/application/commandes.js';
import { evaluer } from '../src/application/evaluation.js';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { texteLivre } from '../src/demo/livrees.js';
import { indexerPlan, normaliser } from '../src/moteur/configuration.js';
import { MODES_OBJECTIFS } from '../src/moteur/criteres.js';
import { mesurer } from '../src/moteur/indicateurs.js';
import { ecartsAuPlafondAPriori } from '../src/moteur/manque.js';
import { plafondsAPriori } from '../src/moteur/plafond.js';
import { HISTORIQUE_PAR_DEFAUT, rechercher } from '../src/moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../src/stockage/document.js';
import { VERSION } from '../src/version.genere.js';

/** Le fichier des empreintes de référence. */
export const CHEMIN_EMPREINTES = fileURLToPath(new URL('./fixtures/moteur/empreintes_defaut.json', import.meta.url));

/** Les graines des plans de référence, une proposition chacune. */
export const GRAINES = Object.freeze([1, 2, 3]);

/** Le compte d'arrêt réduit des plans de référence. */
export const ARRET = 20_000;

/**
 * Les plans de la section bascule (en-tête du module) : les configurations
 * et le compte d'arrêt, les graines étant celles de GRAINES.
 */
export const BASCULE = Object.freeze({
  cles: Object.freeze(['petite', 'petite-conflit']),
  arret: 50_000,
});

/** Les quatre cases du § 5.3, dans l'ordre où une combinaison les nomme. */
export const CASES = Object.freeze([
  'separerOrganisations',
  'nouveauxVoisins',
  'nouvelleTable',
  'varierOrganisations',
]);

/**
 * Les charges du classement de référence, des démonstrations livrées, et la
 * génération qui leur donne leurs propositions : nombre propositions de
 * graine et arret. Le compte court laisse les propositions inégales sur
 * plusieurs critères, ce dont les seize combinaisons ont besoin pour
 * départager ; le nombre donne à des propositions voisines des égalités
 * jusqu'aux derniers critères. Sous ces grandeurs, chaque critère appliqué
 * est, dans un classement au moins, le premier qui départage deux
 * propositions voisines, et son retrait change l'ordre :
 * src/application/empreintes.test.js le vérifie sur le fichier.
 */
export const CLASSEMENT = Object.freeze({
  cles: Object.freeze(['petite-conflit', 'grande']),
  graine: 7,
  arret: 1_000,
  nombre: 12,
});

const MODES = Object.freeze(['verifier', 'ecrire']);

// Les grandeurs nommées, chacune avec sa lecture dans les mesures d'un plan
// et le plus grand de ses écarts au plafond a priori, null quand ce plafond
// est inconnu.
const LECTURES = Object.freeze([
  ['ecartAuPlafondAPrioriMax', (_mesures, ecartMax) => ecartMax],
  ['excedentCollisions', (mesures) => mesures.excedentCollisions],
  ['collisionsCumulees', (mesures) => mesures.collisionsCumulees],
  ['rencontresRepeteesChoisies', (mesures) => mesures.rencontresRepetees.choisies],
  ['retoursChoisis', (mesures) => mesures.totalRetoursChoisis],
  ['redondance', (mesures) => mesures.totalRedondance],
]);

/** Les noms des grandeurs qu'une empreinte porte, dans leur ordre. */
export const GRANDEURS = Object.freeze(LECTURES.map(([nom]) => nom));

/**
 * Le mode que GTT_EMPREINTES demande : 'verifier' quand la variable est
 * absente ou vide. Seule lecture de cette variable.
 *
 * @param {Record<string, string|undefined>} env
 * @returns {'verifier'|'ecrire'}
 * @throws {Error} une autre valeur, nommée
 */
export function modeEmpreintes(env) {
  const valeur = env.GTT_EMPREINTES ?? '';
  if (valeur === '') return 'verifier';
  if (MODES.includes(valeur)) return valeur;
  throw new Error(`GTT_EMPREINTES : « ${valeur} » n’est ni ${MODES.map((m) => `« ${m} »`).join(' ni ')}`);
}

/**
 * Refuse le mode ecrire : une épreuve qui ne fait que relire le fichier
 * pourrait le lire pendant que src/moteur/empreintes.test.js le récrit.
 *
 * @param {Record<string, string|undefined>} env
 * @throws {Error} sous GTT_EMPREINTES=ecrire, ou une valeur inconnue
 */
export function exigerVerification(env) {
  if (modeEmpreintes(env) === 'ecrire') {
    throw new Error('GTT_EMPREINTES=ecrire se joue sur src/moteur/empreintes.test.js seule ; cette épreuve ne fait que relire');
  }
}

// Le plus grand élément d'une liste ; null pour une liste vide ou absente.
function plusGrand(valeurs) {
  if (valeurs === null || valeurs.length === 0) return null;
  let plus = valeurs[0];
  for (const valeur of valeurs) if (valeur > plus) plus = valeur;
  return plus;
}

/**
 * Les grandeurs nommées d'un plan mesuré, dans l'ordre de GRANDEURS.
 *
 * @param {import('../src/moteur/indicateurs.js').Mesures} mesures
 * @param {number|null} ecartMax  le plus grand écart au plafond a priori
 * @returns {Record<string, number|null>}
 */
export function grandeursDe(mesures, ecartMax) {
  return Object.fromEntries(LECTURES.map(([nom, lire]) => [nom, lire(mesures, ecartMax)]));
}

/**
 * L'empreinte d'un plan indexé et de ses grandeurs nommées (en-tête du
 * module). Ne lit des grandeurs que celles de GRANDEURS, chacune sous son
 * nom.
 *
 * @param {ArrayLike<number>} tableDe
 * @param {Record<string, number|null>} grandeurs
 * @returns {string}  64 chiffres hexadécimaux
 */
export function empreinteDe(tableDe, grandeurs) {
  const octets = Buffer.alloc(tableDe.length * 4);
  for (let i = 0; i < tableDe.length; i += 1) octets.writeInt32LE(tableDe[i], i * 4);
  const texte = JSON.stringify(GRANDEURS.map((nom) => [nom, grandeurs[nom]]));
  return createHash('sha256').update(octets).update(texte, 'utf8').digest('hex');
}

/**
 * L'empreinte d'un plan et ses grandeurs nommées. Le plafond a priori se
 * calcule quand l'appelant ne le donne pas.
 *
 * @param {import('../src/moteur/types.js').Instance} instance
 * @param {import('../src/moteur/types.js').Plan} plan
 * @param {ArrayLike<number>} [aPriori]
 * @returns {{empreinte: string, grandeurs: Record<string, number|null>}}
 */
export function empreinteDuPlan(instance, plan, aPriori = plafondsAPriori(instance)) {
  const tableDe = indexerPlan(instance, plan);
  const mesures = mesurer(instance, tableDe);
  const grandeurs = grandeursDe(mesures, plusGrand(ecartsAuPlafondAPriori(mesures, aPriori)));
  return { empreinte: empreinteDe(tableDe, grandeurs), grandeurs };
}

// La configuration de la démonstration du catalogue de clé cle.
function configurationDuCatalogue(cle) {
  const entree = CATALOGUE.find((candidate) => candidate.cle === cle);
  if (entree === undefined) throw new RangeError(`configuration inconnue du catalogue : ${cle}`);
  return entree.construire();
}

// Lève RangeError pour un mode hors de MODES_OBJECTIFS (criteres.js).
function exigerMode(mode) {
  if (!MODES_OBJECTIFS.includes(mode)) throw new RangeError(`mode des objectifs inconnu : ${String(mode)}`);
}

// La configuration sous ce mode : telle quelle sous 'places', le mode posé
// sinon.
function sousLeMode(configuration, mode) {
  exigerMode(mode);
  return mode === 'places' ? configuration : { ...configuration, modeObjectifs: mode };
}

// L'empreinte du plan que rechercher rend pour une configuration sous une
// graine, une proposition, à arret mouvements, historique par défaut.
function empreinteRecherchee(configuration, graine, arret = ARRET) {
  const instance = normaliser(configuration);
  const [{ plan }] = rechercher(configuration, { graine, arret, nombre: 1 });
  return empreinteDuPlan(instance, plan);
}

/**
 * Les empreintes des plans d'une configuration du catalogue, une par graine
 * de GRAINES, sous la clé de la graine, à arret mouvements, sous ce mode des
 * objectifs.
 *
 * @param {string} cle
 * @param {number} [arret=ARRET]
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {Record<string, {empreinte: string, grandeurs: object}>}
 */
export function empreintesDesPlans(cle, arret = ARRET, mode = 'places') {
  const configuration = sousLeMode(configurationDuCatalogue(cle), mode);
  return Object.fromEntries(
    GRAINES.map((graine) => [String(graine), empreinteRecherchee(configuration, graine, arret)]),
  );
}

/**
 * Les seize combinaisons des quatre cases, la première toutes cochées, la
 * dernière aucune, chacune nommée par ses cases cochées jointes par « + »,
 * ou « aucune ».
 *
 * @returns {{cle: string, contraintes: Record<string, boolean>}[]}
 */
export function combinaisons() {
  const toutes = [];
  for (let masque = 2 ** CASES.length - 1; masque >= 0; masque -= 1) {
    const contraintes = Object.fromEntries(
      CASES.map((nom, rang) => [nom, ((masque >> (CASES.length - 1 - rang)) & 1) === 1]),
    );
    const cochees = CASES.filter((nom) => contraintes[nom]);
    toutes.push({ cle: cochees.length === 0 ? 'aucune' : cochees.join('+'), contraintes });
  }
  return toutes;
}

/**
 * Les empreintes des plans de la petite démonstration sous chacune des seize
 * combinaisons, graine 1, sous la clé de la combinaison, sous ce mode des
 * objectifs.
 *
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {Record<string, {empreinte: string, grandeurs: object}>}
 */
export function empreintesDesCombinaisons(mode = 'places') {
  return Object.fromEntries(
    combinaisons().map(({ cle, contraintes }) => [
      cle,
      empreinteRecherchee(sousLeMode({ ...configurationDuCatalogue('petite'), contraintes }, mode), GRAINES[0]),
    ]),
  );
}

/**
 * La charge du classement de référence : la démonstration livrée de clé
 * cle, sous ce mode des objectifs — le réglage absent sous 'places' —, et la
 * génération de CLASSEMENT enregistrée par la commande.
 *
 * @param {string} cle
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {import('../src/stockage/types.js').Charge}
 */
export function chargeDeClassement(cle, mode = 'places') {
  exigerMode(mode);
  const charge = analyser(texteLivre(cle)).charge;
  if (mode !== 'places') charge.reglages.modeObjectifs = mode;
  const configuration = configurationDepuisCharge(charge);
  const { graine, arret, nombre } = CLASSEMENT;
  const propositions = rechercher(configuration, { graine, arret, nombre });
  return appliquerCommande('enregistrerGeneration', charge, {
    propositions,
    configuration,
    produitVersion: VERSION.affichee,
  }).charge;
}

/**
 * Ce que l'empreinte garde d'un classement : l'ordre, les noms des critères
 * appliqués dans leur ordre — la liste aplatie, palier après palier —, le
 * critère sauté.
 *
 * @param {{ordre: number[], criteresAppliques: Array<{criteres: Array<{nom: string}>}>, critereSaute: string|null}} classement
 * @returns {{ordre: number[], criteresAppliques: string[], critereSaute: string|null}}
 */
export function classementLu({ ordre, criteresAppliques, critereSaute }) {
  return {
    ordre: [...ordre],
    criteresAppliques: criteresAppliques.flatMap(({ criteres }) => criteres.map(({ nom }) => nom)),
    critereSaute,
  };
}

/**
 * Le classement de référence d'une charge de CLASSEMENT.cles, sous ce mode
 * des objectifs : connu et inconnu, ses classements par evaluer, plafond a
 * priori calculé puis inconnu ; propositions, les grandeurs nommées de
 * chacune, plafond a priori calculé, par identifiant croissant.
 *
 * @param {string} cle
 * @param {'places'|'chacun'|'minimum'} [mode='places']
 * @returns {{connu: object, inconnu: object, propositions: Record<string, Record<string, number|null>>}}
 * @throws {Error} une proposition qui ne se compare pas : elle n'a pas de
 *         grandeurs
 */
export function empreintesDuClassement(cle, mode = 'places') {
  const charge = chargeDeClassement(cle, mode);
  const connu = evaluer(charge);
  const inconnu = evaluer(charge, { plafondsAPriori: null });
  const ligneDe = new Map(connu.propositions.map((ligne) => [ligne.id, ligne]));
  const propositions = [...charge.propositions]
    .sort((a, b) => a.id - b.id)
    .map(({ id }) => {
      const ligne = ligneDe.get(id);
      if (ligne.statut !== 'comparable') throw new Error(`${cle}, proposition ${id} : ${ligne.statut}`);
      return [String(id), grandeursDe(ligne.mesures, ligne.ecartAuPlafondAPrioriMax)];
    });
  return {
    connu: classementLu(connu.classement),
    inconnu: classementLu(inconnu.classement),
    propositions: Object.fromEntries(propositions),
  };
}

/**
 * Tout le contenu du fichier des empreintes, recalculé (en-tête du module).
 *
 * @returns {object}
 */
export function calculerEmpreintes() {
  return {
    reglages: {
      graines: [...GRAINES],
      arret: ARRET,
      historique: HISTORIQUE_PAR_DEFAUT,
      cases: [...CASES],
      classement: { ...CLASSEMENT, cles: [...CLASSEMENT.cles] },
      bascule: { ...BASCULE, cles: [...BASCULE.cles] },
    },
    plans: Object.fromEntries(CATALOGUE.map(({ cle }) => [cle, empreintesDesPlans(cle)])),
    combinaisons: empreintesDesCombinaisons(),
    bascule: Object.fromEntries(BASCULE.cles.map((cle) => [cle, empreintesDesPlans(cle, BASCULE.arret)])),
    classements: Object.fromEntries(CLASSEMENT.cles.map((cle) => [cle, empreintesDuClassement(cle)])),
  };
}

/** Le fichier des empreintes, tel qu'il est versionné. */
export function lireEmpreintes() {
  return JSON.parse(readFileSync(CHEMIN_EMPREINTES, 'utf8'));
}

/**
 * Récrit le fichier des empreintes à partir du moteur courant : un fichier
 * voisin, puis un renommage, pour qu'aucune lecture ne trouve un fichier à
 * demi écrit.
 */
export function ecrireEmpreintes() {
  const texte = `${JSON.stringify(calculerEmpreintes(), null, 2)}\n`;
  mkdirSync(dirname(CHEMIN_EMPREINTES), { recursive: true });
  const provisoire = `${CHEMIN_EMPREINTES}.ecriture`;
  writeFileSync(provisoire, texte);
  renameSync(provisoire, CHEMIN_EMPREINTES);
}

/**
 * Ce qui sépare des empreintes recalculées de celles de la référence, une
 * ligne par écart, chacune ouverte par la configuration et la clé : une clé
 * absente de la référence, une clé de la référence non recalculée, les
 * grandeurs changées, ou un plan changé sous des grandeurs égales. [] quand
 * rien ne les sépare.
 *
 * @param {string} cle
 * @param {Record<string, {empreinte: string, grandeurs: object}>} calcule
 * @param {Record<string, {empreinte: string, grandeurs: object}>} [attendu]
 * @returns {string[]}
 */
export function differences(cle, calcule, attendu = {}) {
  const nomsCalcules = Object.keys(calcule);
  const nomsAttendus = Object.keys(attendu);
  const lignes = [
    ...nomsCalcules.filter((nom) => !nomsAttendus.includes(nom)).map((nom) => `${cle}, ${nom} : absente de la référence`),
    ...nomsAttendus.filter((nom) => !nomsCalcules.includes(nom)).map((nom) => `${cle}, ${nom} : référence non recalculée`),
  ];
  for (const nom of nomsCalcules.filter((n) => nomsAttendus.includes(n))) {
    const avant = attendu[nom];
    const apres = calcule[nom];
    const changees = GRANDEURS.filter((g) => apres.grandeurs[g] !== avant.grandeurs[g]).map(
      (g) => `${g} ${avant.grandeurs[g]} → ${apres.grandeurs[g]}`,
    );
    if (changees.length > 0) lignes.push(`${cle}, ${nom} : ${changees.join(', ')}`);
    else if (apres.empreinte !== avant.empreinte) lignes.push(`${cle}, ${nom} : plan changé, grandeurs égales`);
  }
  return lignes;
}
