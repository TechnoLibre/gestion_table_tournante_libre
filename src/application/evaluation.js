// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La table d'évaluation (§ 5.4, § 5.5, § 5.7, § 12.6, § 13.2) : chaque
// proposition et le retenu, mesurés par la mesure qui fait foi, et le
// classement de celles qui se comparent. Le classement, les colonnes et le
// retenu la lisent ; ce module est le seul de l'application qui importe les
// mesures du moteur, et il n'en refait aucune.
//
// Un placement se compare quand il décrit la configuration courante : sans
// faute (fautes, S2) et sans dérive (derive, S2). Fautif ou en dérive, il
// n'est ni mesuré ni classé, et ses raisons disent pourquoi — la partition
// se fait avant classer, qui laisse passer deux populations de même taille.
// Chaque ligne dit en plus si son placement sert de départ (sertDeDepart) :
// comparable, ou en dérive par ses seuls participants, qu'une génération
// dérivée ajuste à la présence.
//
// Les planchers valent sur un placement qui assied chacun à chacun de ses
// tours de présence (assisAChaqueTourPresent) et tient chaque réservation :
// une absence ne sort pas un plan de leur domaine, une présente laissée en
// réserve, réserve imposée comprise, l'en sort.
// evaluer valide chaque placement une fois, par fautes, puis lit le placement
// sans faute par deriveSansRevalider et planSansRevalider, qui ne refont pas
// cette validation : un placement fautif ne les atteint jamais, et c'est ce
// seul appel à fautes qui l'arrête. resumeDuRetenu passe par derive et
// planDepuisFichier, qui la refont et lèvent sur une faute.
//
// La configuration de la charge est figée (figerConfiguration) : le
// diagnostic et la mesure en lisent la même instance, normalisée une fois.
// configurationDe la bâtit neuve, et figer ne touche pas la charge.
//
// Les imposés viennent du diagnostic, les mêmes pour toute ligne ; les
// rencontres répétées imposées dépendent du plan, et chaque ligne les lit
// dans ses mesures, à part des choisies.
//
// resumeDuRetenu donne à la liste des événements les collisions cumulées
// et les rencontres répétées choisies du retenu, lues dans une seule
// mesure, celle de sa ligne du tableau, sans le diagnostic ni les
// plafonds : la liste en résume chaque événement du dossier.
// premiereDuClassement est la seule définition de la proposition
// au rang 1 : la section de la génération la lit dans sa table,
// resumeDuMeilleur en donne l'identifiant à la liste, sur la même table
// d'évaluation, diagnostic compris — le premier critère du classement lit
// le plafond a priori.
//
// Le classement applique la compilation de l'instance (compilationDe) : son
// ordre des priorités, son mode des objectifs, ses cases. La table porte
// aussi l'état de chaque critère tel que normaliser le donne — coché, sans
// objet, ses valeurs —, que l'écran lit au lieu de le recalculer.
//
// Le détail d'un placement (detaillerQualite, § 12.9, D27) se calcule pour
// lui seul, à la demande de la page de qualité, jamais dans evaluer : la
// table se recalcule pour chaque proposition à chaque écriture, le détail
// n'en sert qu'une. Il lit les fonctions du moteur — detailler, la borne de
// diversité, la garde à quatre paramètres — et rend des identifiants et des
// noms, jamais un index. La course d'une proposition ne vient ni de la
// charge ni du moteur : la séance la lit dans le compagnon des courses et
// la passe (courseDe) ; chacun de ses points de relevé se mesure ici, sous
// la configuration de la charge reçue. La génération d'où vient la
// proposition, durée et cœurs, vient de la séance aussi (generationDe) ;
// rien ici ne lit l'horloge.
//
// La comparaison de deux placements (§ 12.10.6, D56 à D67, D83 à D85) lit
// deux lignes de la table, jamais un détail : comparerPlacements ne
// diagnostique ni ne mesure rien, et tient chaque nombre d'une fonction du
// moteur — profils de manque, rangs, escalier, tête des colonnes, planchers,
// palier qui départage. La table porte pour elle deux champs de la
// configuration, calculés une fois par evaluer : le plafond a priori par
// personne et le diagnostic, dont les planchers des colonnes se lisent.
// candidatsDeComparaison donne les placements qu'un second côté peut
// prendre et son défaut, comparaisonOfferte dit s'il en existe deux.
import { cleNormalisee } from '../csv/normalisation.js';
import { constante } from '../geometrie/constantes.js';
import { classer, premierPalierQuiDepartage } from '../moteur/classement.js';
import { SANS_GROUPE, STATUT, figerConfiguration, indexerPlan, normaliser } from '../moteur/configuration.js';
import { compilationDe } from '../moteur/criteres.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import { assisAChaqueTourPresent, mesurer } from '../moteur/indicateurs.js';
import {
  borneHaute,
  comparerProfils,
  ecartsAuPlafondAPriori,
  escalierDuManque,
  manques,
  minimumAtteint,
  profilManque,
  teteDuManque,
  troisChiffres,
  valeursDistinctes,
} from '../moteur/manque.js';
import { rencontresDe } from '../moteur/paires.js';
import { borneDiversite, plafondsRealises } from '../moteur/plafond.js';
import {
  detailler,
  planchersAtteints,
  planchersDesColonnes,
  planchersParGroupe,
  profilRencontres,
  teteDesColonnes,
} from '../moteur/qualite.js';
import { verifierIndicateurs, verifierInvariants } from '../moteur/verification.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import {
  derive,
  deriveSansRevalider,
  fautes,
  planDepuisFichier,
  planSansRevalider,
  raisonsQuiBloquentUnDepart,
} from '../stockage/placements.js';
import { configurationDe } from './configuration.js';
import { derivationDe, ecartAuRetenu } from './depart.js';
import { nomAffiche } from './personnes.js';

// Les modes des objectifs, le défaut en tête, et les cases qui font compter
// chaque critère, tels que le registre les tient (contrainte 35) :
// l'interface, qui n'importe pas le moteur, les lit ici.
export { CASES, MODES_OBJECTIFS } from '../moteur/criteres.js';

/**
 * @typedef {Object} LigneEvaluation
 * @property {number} id          celui de la proposition ; retenu.proposition pour le retenu
 * @property {'comparable'|'derive'|'fautif'} statut
 * @property {object[]} raisons   fautif : ses fautes ; derive : ses raisons ; [] sinon
 * @property {boolean} sertDeDepart   comparable : vrai ; derive : vrai quand
 *           chaque raison vient des participants (raisonsQuiBloquentUnDepart
 *           vide), une génération dérivée l'ajustant à la présence ; fautif :
 *           faux
 * @property {object[]} violations   comparable : les réservations non honorées
 *           (verifierInvariants, RESERVATION) ; [] sinon
 * @property {object|null} mesures   mesurer, telles quelles
 * @property {number[]|null} plafondsRealises
 * @property {object|null} troisChiffres
 * @property {number|null} ecartAuPlafondAPrioriMax   le plus grand de
 *           ecartsAuPlafondAPriori ; null quand l'a priori est inconnu ou la
 *           population vide
 * @property {boolean|null} minimumAtteint
 * @property {object[]} refusDessin   verifierIndicateurs, chaque violation
 *           complétée de participant, l'identifiant de son index ; []
 *
 * @typedef {Object} TableEvaluation
 * @property {number[]} population    identifiants non exclus, croissants
 * @property {LigneEvaluation[]} propositions   comparables dans l'ordre du
 *           classement, puis les autres par identifiant
 * @property {LigneEvaluation|null} retenu
 * @property {{ordre: number[], criteresAppliques: Array<{criteres: Array<{nom: string, valeurs: string[], poids: number}>}>,
 *            critereSaute: string|null, rangSaute: number|null}} classement
 *           classer, tel quel, sur les comparables, sous la compilation de
 *           l'instance
 * @property {Array<{nom: string, coche: boolean, sansObjet: boolean, valeurs: string[]}>} criteres
 *           l'état de chaque critère, instance.etatCriteres, dans l'ordre du
 *           registre
 * @property {{retours: number, ancrages: number}} imposes
 * @property {number[]|null} plafondsAPriori   le plafond a priori de chaque
 *           personne, dans l'ordre de population, une liste ; null quand il
 *           est inconnu
 * @property {import('../moteur/diagnostic.js').Diagnostic} diagnostic
 *           celui de la configuration, d'où se lisent les planchers des
 *           colonnes de la comparaison
 */

// Le plus grand élément d'une liste ; null pour une liste vide ou absente.
function plusGrand(valeurs) {
  if (valeurs === null || valeurs.length === 0) return null;
  let plus = valeurs[0];
  for (const valeur of valeurs) if (valeur > plus) plus = valeur;
  return plus;
}

// Lève TypeError quand l'option plafondsAPriori de la fonction nommée ne
// vaut ni 'calcul' ni null.
function exigerAPriori(fonction, plafondsAPriori) {
  if (plafondsAPriori !== 'calcul' && plafondsAPriori !== null) {
    throw new TypeError(`${fonction} : plafondsAPriori 'calcul' ou null attendu, reçu ${JSON.stringify(plafondsAPriori)}`);
  }
}

// Vrai quand le placement se compare à la configuration courante : sans
// faute, puis sans dérive — derive lève sur une faute, et ne la reçoit
// jamais.
const seCompare = (placement, charge) => fautes(placement).length === 0 && derive(placement, charge).length === 0;

// La mesure d'un plan indexé que porte sa ligne d'évaluation : mesurer,
// les plafonds réalisés et les trois chiffres sous le plafond a priori
// aPriori, null quand il est inconnu. ligneDe et detaillerQualite la
// prennent ici l'une et l'autre : la tuile écrit la valeur de la ligne, et
// le détail juge un plancher atteint sur la même, sans la recompter
// autrement.
function mesureDuPlan(instance, tableDe, aPriori) {
  const mesures = mesurer(instance, tableDe);
  const realises = plafondsRealises(instance, tableDe);
  return { mesures, realises, chiffres: troisChiffres(instance, mesures, aPriori, realises) };
}

// Une ligne qui ne se mesure pas : en dérive par ses seuls participants,
// elle sert encore de départ.
const nonMesuree = (id, statut, raisons) => ({
  id,
  statut,
  raisons,
  sertDeDepart: statut === 'derive' && raisonsQuiBloquentUnDepart(raisons).length === 0,
  violations: [],
  mesures: null,
  plafondsRealises: null,
  troisChiffres: null,
  ecartAuPlafondAPrioriMax: null,
  minimumAtteint: null,
  refusDessin: [],
});

/**
 * La table d'évaluation d'une charge (contrat de A6). Ne modifie pas la
 * charge. Chaque proposition et le retenu se valident une seule fois, par
 * fautes : fautif, le placement s'arrête là ; sans faute, sa dérive et son
 * plan se lisent sans seconde validation.
 *
 * La table porte deux champs de la configuration, pour la comparaison :
 * plafondsAPriori et le diagnostic qu'evaluer calcule déjà. Les planchers
 * des colonnes ne s'y calculent pas : planchersDesColonnes appartient au
 * détail d'un placement, que la table n'atteint jamais ;
 * comparerPlacements les tire du diagnostic de la table, une fois par
 * appel.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{plafondsAPriori?: 'calcul'|null}} [options]
 *        'calcul' : le plafond a priori par personne du diagnostic, une seule
 *        maximisation ; null : a priori inconnu (§ 17, point 4)
 * @returns {TableEvaluation}
 * @throws {ErreurConfiguration} la configuration de la charge ne se
 *         normalise pas : rien ne se mesure, et la génération refuse la même
 * @throws {TypeError} une autre valeur de plafondsAPriori
 */
export function evaluer(charge, { plafondsAPriori = 'calcul' } = {}) {
  exigerAPriori('evaluer', plafondsAPriori);
  const configuration = figerConfiguration(configurationDe(charge));
  const diagnostic = diagnostiquer(configuration);
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori === 'calcul' ? diagnostic.plafondAPriori.parPersonne : null;

  // La ligne d'un placement, proposition ou retenu, sous l'identifiant id.
  function ligneDe(placement, id) {
    const sesFautes = fautes(placement);
    if (sesFautes.length > 0) return nonMesuree(id, 'fautif', sesFautes);
    const raisons = deriveSansRevalider(placement, charge);
    if (raisons.length > 0) return nonMesuree(id, 'derive', raisons);
    const plan = planSansRevalider(placement);
    const { mesures, realises, chiffres } = mesureDuPlan(instance, indexerPlan(instance, plan), aPriori);
    return {
      id,
      statut: 'comparable',
      raisons: [],
      sertDeDepart: true,
      violations: verifierInvariants(instance, plan, { reserveAutorisee: true }).filter(({ code }) => code === 'RESERVATION'),
      mesures,
      plafondsRealises: realises,
      troisChiffres: chiffres,
      ecartAuPlafondAPrioriMax: plusGrand(ecartsAuPlafondAPriori(mesures, aPriori)),
      minimumAtteint: minimumAtteint(mesures, aPriori),
      refusDessin: verifierIndicateurs(mesures, aPriori, realises).map((violation) => ({
        ...violation,
        participant: instance.ids[violation.index],
      })),
    };
  }

  const lignes = charge.propositions.map((proposition) => ligneDe(proposition, proposition.id));
  const comparables = lignes.filter(({ statut }) => statut === 'comparable');
  const classement = classer(
    comparables.map(({ id, mesures }) => ({ id, mesures, plafondsAPriori: aPriori })),
    compilationDe(instance),
  );
  const rangDe = new Map(classement.ordre.map((id, rang) => [id, rang]));
  const autres = lignes.filter(({ statut }) => statut !== 'comparable').sort((a, b) => a.id - b.id);
  return {
    population: [...instance.ids],
    propositions: [...comparables.sort((a, b) => rangDe.get(a.id) - rangDe.get(b.id)), ...autres],
    retenu: charge.retenu === null ? null : ligneDe(charge.retenu, charge.retenu.proposition),
    classement,
    criteres: instance.etatCriteres,
    imposes: { retours: diagnostic.retoursImposes, ancrages: diagnostic.ancragesImposantRetours },
    plafondsAPriori: aPriori === null ? null : Array.from(aPriori),
    diagnostic,
  };
}

/**
 * Le résumé du retenu que montre la liste des événements (§ 5.4, § 8.1),
 * lu dans un seul appel à mesurer, la mesure que la ligne du retenu
 * d'evaluer porte :
 * - collisionsCumulees, les occurrences (paire, tour) où deux personnes
 *   d'une même organisation partagent une table — la valeur que la colonne
 *   « Collisions cumulées (paire et tour) » du tableau des propositions
 *   écrit ;
 * - rencontresRepetees, les paires réunies à plus d'un tour que le placement
 *   a choisies, sans celles que les réservations imposent
 *   (mesures.rencontresRepetees.choisies) — la valeur que la colonne
 *   « Rencontres répétées choisies (paires) » écrit.
 * null sans retenu, pour un retenu fautif ou en dérive, et quand la
 * configuration ne se normalise pas : rien ne s'y mesure, et la liste écrit
 * « — » dans les deux colonnes. Ne modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{collisionsCumulees: number, rencontresRepetees: number}|null}
 */
export function resumeDuRetenu(charge) {
  const { retenu } = charge;
  if (retenu === null || !seCompare(retenu, charge)) return null;
  let instance;
  try {
    instance = normaliser(configurationDe(charge));
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return null;
    throw erreur;
  }
  const { collisionsCumulees, rencontresRepetees } = mesurer(instance, indexerPlan(instance, planDepuisFichier(retenu)));
  return { collisionsCumulees, rencontresRepetees: rencontresRepetees.choisies };
}

/**
 * La proposition au rang 1 du classement d'une table d'évaluation (§ 5.7) :
 * la première de ses propositions quand elle se compare — les comparables
 * ouvrent la liste, dans l'ordre du classement —, null quand aucune ne se
 * classe.
 *
 * @param {TableEvaluation} table
 * @returns {LigneEvaluation|null}
 */
export function premiereDuClassement(table) {
  const [premiere] = table.propositions;
  return premiere !== undefined && premiere.statut === 'comparable' ? premiere : null;
}

/**
 * La meilleure proposition du classement que montre la liste des
 * événements (§ 5.4, § 5.7, § 8.1) : id, l'identifiant de la proposition au
 * rang 1 (premiereDuClassement). null sans proposition, quand aucune ne se
 * compare — toutes fautives ou en dérive —, et quand la configuration ne se
 * normalise pas : la liste écrit alors « — ». Le retenu n'y entre pas. Ne
 * modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{id: number}|null}
 */
export function resumeDuMeilleur(charge) {
  if (charge.propositions.length === 0) return null;
  let table;
  try {
    table = evaluer(charge);
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return null;
    throw erreur;
  }
  const premiere = premiereDuClassement(table);
  return premiere === null ? null : { id: premiere.id };
}

/**
 * Le partage d'un nettoyage des propositions (§ 5.7) : les n premières de
 * la table, dans l'ordre où le tableau des propositions les montre — les
 * comparables dans l'ordre du classement, puis les autres par identifiant
 * —, se gardent, et la proposition d'où vient le retenu avec elles quand
 * elle vient après ; les autres s'effacent. La commande garderMeilleures et
 * la fenêtre qui la confirme lisent ce partage, chacune sur la table de la
 * charge qu'elle tient : aucun ordre ne se refait ailleurs.
 *
 * @param {TableEvaluation} table
 * @param {number} n  entier ≥ 1
 * @returns {{gardees: number[], effacees: number[], origineEnPlus: number|null}}
 *   gardees et effacees : des identifiants, dans l'ordre de la table ;
 *   origineEnPlus : la proposition du retenu gardée au-delà des n premières,
 *   null quand elle en est, sans retenu, et quand la liste ne la porte plus
 * @throws {TypeError} n qui n'est pas un entier ≥ 1
 */
export function nettoyage(table, n) {
  if (!Number.isSafeInteger(n) || n < 1) throw new TypeError(`nettoyage : entier ≥ 1 attendu, reçu ${JSON.stringify(n)}`);
  const ids = table.propositions.map(({ id }) => id);
  const origine = table.retenu?.id ?? null;
  const origineEnPlus = origine !== null && ids.indexOf(origine) >= n ? origine : null;
  const premieres = ids.slice(0, n);
  return {
    gardees: origineEnPlus === null ? premieres : [...premieres, origineEnPlus],
    effacees: ids.slice(n).filter((id) => id !== origineEnPlus),
    origineEnPlus,
  };
}

// --- Le détail d'un placement (§ 12, § 12.9, D27, D29, D40, D42) ------------

/**
 * @typedef {Object} CourseDetaillee
 * @property {'proposition'|'retenu'} source   ce que la page mesure
 * @property {number|null} propositionDuRetenu  la proposition d'où vient le
 *           retenu ; null pour une proposition
 * @property {number} evalues      mouvements évalués de la recherche
 * @property {number} arret        son compte d'arrêt
 * @property {string[]} indicateurs  les noms des valeurs de chaque point, dans
 *           leur ordre : minimumBrut, puis chaque grandeur que les critères
 *           appliqués classent, palier après palier
 * @property {Array<{mouvements: number, valeurs: Object<string, number|null>}>} releves
 *           chaque point de relevé de la course, puis le dernier, à evalues,
 *           le plan de la proposition ; aucune durée
 * @property {number} dernierChangement  les mouvements du dernier point dont
 *           une valeur diffère du point précédent ; ceux du premier point
 *           quand aucune ne change
 * @property {{dureeMs: number|null, coeurs: number|null, cadence: number|null,
 *            nombre: number|null}} generation
 *           la génération de la séance d'où vient la proposition ; dureeMs et
 *           cadence null pour une durée nulle ou inconnue, les quatre null
 *           sans génération connue
 *
 * @typedef {Object} DetailQualite
 * @property {number|'retenu'} id
 * @property {'comparable'|'derive'|'fautif'} statut
 * @property {object[]} raisons     fautif : ses fautes ; derive : ses raisons
 * Les champs qui suivent valent null quand le statut n'est pas comparable.
 * @property {{mesuree: number, exclue: number}|null} population  effectifs
 * @property {number|null} T
 * @property {number|null} R
 * @property {number|null} G        organisations des présents
 * @property {number[]|null} idsTables      ordre des tables de l'instance
 * @property {number[]|null} numerosTables  le numéro de chacune
 * @property {Array<{id: number, nom: string, organisation: string|null,
 *            statut: 'mobile'|'partiel'|'ancre'}>|null} personnes
 *           ordre canonique, identifiants croissants
 * @property {number|null} propositionDuRetenu  pour le retenu, la
 *           proposition dont il porte encore le placement ; null sinon
 * @property {Object|null} bornes, profil, synthese, repartitionRencontres,
 *           collisions, tables, paires, matrice, objectifs, animateurs
 *           ceux de detailler (qualite.js), chaque personne et chaque table
 *           par son identifiant (id, a, b, table), chaque tour par son index
 *           à partir de 0 ; objectifs porte en plus critere, {coche,
 *           sansObjet} du critère des objectifs
 * @property {string[]|null} planchersRetires   ceux du diagnostic : les
 *           planchers que la présence par tour retire, ['ecartItineraire']
 *           dès qu'une personne non exclue manque un tour, [] sinon
 * @property {CourseDetaillee|null} course
 * @property {{depart: number, toursFiges: number[], departPresent: boolean}|null} derivation
 *           la filiation de la proposition dont la course est montrée
 *           (derivationDe) — la proposition mesurée, ou celle d'où vient un
 *           retenu non ajusté —, quel que soit le statut ; null sans elle
 *           (retenu ajusté, ou dont la proposition est effacée) et pour une
 *           proposition sans départ
 * @property {object[]} refusDessin   verifierIndicateurs à quatre paramètres,
 *           chaque violation complétée de participant (index) et
 *           d'organisation (groupe)
 */

// Le nom du statut d'une personne (§ 4.2), par valeur de STATUT. La Map ne
// sert qu'à retrouver un nom.
const NOM_DU_STATUT = new Map([
  [STATUT.MOBILE, 'mobile'],
  [STATUT.PARTIELLEMENT_FIXE, 'partiel'],
  [STATUT.ANCRE, 'ancre'],
]);

// Le critère dont la vue des objectifs lit l'état.
const CRITERE_OBJECTIFS = 'toursHorsObjectif';

// Le seuil de la matrice, nommé dans le registre des constantes mesurées
// (§ 14.1, § 19.10) : un nom de constante, que la table des libellés ne
// connaît pas.
const SEUIL_MATRICE = Object.freeze({ nom: 'SEUIL_MATRICE_PARTICIPANTS' });

// Les champs de mesure d'un détail, null quand la source ne se compare pas.
const CHAMPS_DE_MESURE = [
  'population',
  'T',
  'R',
  'G',
  'idsTables',
  'numerosTables',
  'personnes',
  'propositionDuRetenu',
  'bornes',
  'profil',
  'synthese',
  'repartitionRencontres',
  'collisions',
  'tables',
  'paires',
  'matrice',
  'objectifs',
  'animateurs',
  'planchersRetires',
  'course',
];

// La lecture de chaque valeur d'un point de relevé dans mesurer : le
// minimum brut, puis les grandeurs que les critères classent, sous les noms
// que le classement leur donne (valeursQuiClassent, criteres.js), chacune
// lue comme classer la lit. L'écart au plafond a priori se lit comme
// ligneDe le lit, null sous un a priori inconnu ; une grandeur que les
// mesures ne portent pas — objectifs ou animateurs sans personne
// concernée — vaut null. La Map ne sert qu'à retrouver une lecture.
const LECTURES_DES_VALEURS = new Map([
  ['minimumBrut', (mesures) => mesures.aggRencontres.tous.min],
  ['ecartAuPlafondAPrioriMax', (mesures, aPriori) => plusGrand(ecartsAuPlafondAPriori(mesures, aPriori))],
  ['excedentCollisions', (mesures) => mesures.excedentCollisions],
  ['collisionsCumulees', (mesures) => mesures.collisionsCumulees],
  ['toursHorsObjectif', (mesures) => mesures.objectifs?.horsObjectif ?? null],
  ['jamaisServies', (mesures) => mesures.objectifs?.jamaisServies ?? null],
  ['horsObjectifMax', (mesures) => mesures.objectifs?.horsObjectifMax ?? null],
  ['rencontresRepeteesChoisies', (mesures) => mesures.rencontresRepetees.choisies],
  ['retoursChoisis', (mesures) => mesures.totalRetoursChoisis],
  ['animateursNonRencontres', (mesures) => mesures.animateurs?.nonRencontres ?? null],
  ['redondance', (mesures) => mesures.totalRedondance],
]);

// Les noms des valeurs d'un point de relevé : le minimum brut, puis chaque
// grandeur que les critères appliqués classent, palier après palier — une
// par grandeur, jamais la clé pondérée d'un palier. RangeError pour une
// grandeur qu'aucune lecture ne porte.
function indicateursDe(criteresAppliques) {
  const noms = ['minimumBrut', ...criteresAppliques.flatMap(({ criteres }) => criteres.flatMap(({ valeurs }) => valeurs))];
  for (const nom of noms) {
    if (!LECTURES_DES_VALEURS.has(nom)) throw new RangeError(`valeur d'un point de relevé inconnue : ${nom}`);
  }
  return noms;
}

// Les valeurs d'un point, lues dans ses mesures, dans l'ordre des noms.
function valeursDe(indicateurs, mesures, aPriori) {
  const valeurs = {};
  for (const nom of indicateurs) valeurs[nom] = LECTURES_DES_VALEURS.get(nom)(mesures, aPriori);
  return valeurs;
}

// Égalité en profondeur de deux valeurs d'un placement de fichier :
// nombres, chaînes, booléens, null, listes et objets simples.
function egaux(a, b) {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const clesA = Object.keys(a);
  if (clesA.length !== Object.keys(b).length) return false;
  return clesA.every((cle) => Object.hasOwn(b, cle) && egaux(a[cle], b[cle]));
}

// Ce que le retenu copie de sa proposition d'origine, et que
// retenirProposition remplacerait.
const CHAMPS_DU_PLACEMENT = ['siegesAttribues', 'tables', 'capacites', 'tours', 'participants', 'placement'];

/**
 * Vrai quand un retenu existe et ne porte plus le placement de sa
 * proposition d'origine : un des champs que retenirProposition copie —
 * sièges attribués, tables, capacités, tours, participants, placement —
 * diffère, en profondeur, de celui de la proposition retenu.proposition, ou
 * celle-ci n'est plus dans la liste. Faux sans retenu. La seule définition
 * du retenu ajusté : le tableau des propositions la lit pour demander
 * confirmation, la page de qualité pour taire la course du retenu. Ne
 * modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {boolean}
 */
export function retenuAjuste({ retenu, propositions }) {
  if (retenu === null) return false;
  const origine = propositions.find(({ id }) => id === retenu.proposition);
  if (origine === undefined) return true;
  return !CHAMPS_DU_PLACEMENT.every((champ) => egaux(retenu[champ], origine[champ]));
}

// Ce que retenirProposition copie et que l'ajustement à la présence ne
// touche pas : le mobilier et l'attribution des sièges.
const CHAMPS_DU_MOBILIER = ['siegesAttribues', 'tables', 'capacites', 'tours'];

/**
 * Vrai quand le retenu porte une retouche que retenir de nouveau sa
 * proposition d'origine détruirait (§ 2.1) : retenirProposition copie la
 * proposition puis l'ajuste à la présence (ajusterALaPresence), et le
 * retenu diffère de cette copie ajustée par autre chose que l'ajustement.
 * Faux sans retenu, et pour un retenu non ajusté (retenuAjuste). Pour un
 * retenu ajusté, vrai quand sa proposition n'est plus dans la liste, quand
 * l'un ou l'autre est fautif, ou quand le mobilier — sièges attribués,
 * tables, capacités, tours — diffère ; sinon, vrai quand un tour au moins
 * diffère du départ ajusté, lu par ecartAuRetenu sur chaque tour du retenu.
 * Un geste qui change les participants — présence, ajout, exclusion,
 * réintégration, suppression, import — ajuste le retenu sans le retoucher :
 * le retenu reste ajusté au sens de retenuAjuste, sans retouche. Une
 * personne partie puis revenue attend en réserve au retenu et reste assise
 * au départ ajusté ; ecartAuRetenu ne lit pas cet écart, ni, de même, une
 * personne mise en réserve à la main, sa chaise laissée libre. Ne modifie
 * pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {boolean}
 */
export function retenuRetouche(charge) {
  if (!retenuAjuste(charge)) return false;
  const { retenu } = charge;
  const origine = charge.propositions.find(({ id }) => id === retenu.proposition);
  if (origine === undefined || fautes(retenu).length > 0 || fautes(origine).length > 0) return true;
  if (!CHAMPS_DU_MOBILIER.every((champ) => egaux(retenu[champ], origine[champ]))) return true;
  const tours = Array.from({ length: retenu.tours }, (_, rang) => rang + 1);
  return ecartAuRetenu(charge, { id: origine.id, toursFiges: tours }).length > 0;
}

// La proposition d'où vient le retenu de la charge quand il n'est pas
// ajusté (retenuAjuste) ; null pour un retenu ajusté, ou dont la
// proposition est effacée.
function origineDuRetenu(charge) {
  if (retenuAjuste(charge)) return null;
  return charge.propositions.find(({ id }) => id === charge.retenu.proposition);
}

// La génération d'où vient la proposition, telle que la page la lit :
// resume est ce que generationDe rend, null hors de la séance qui l'a
// produite. La cadence est la somme des mouvements évalués de la génération
// par seconde de sa durée, arrondie à l'entier ; une durée nulle, ou qui
// n'est pas un nombre positif, n'a ni durée ni cadence.
function generationDuDetail(resume) {
  if (resume === null) return { dureeMs: null, coeurs: null, cadence: null, nombre: null };
  const { dureeMs, coeurs, evalues, nombre } = resume;
  const connue = typeof dureeMs === 'number' && dureeMs > 0;
  return {
    dureeMs: connue ? dureeMs : null,
    coeurs,
    cadence: connue ? Math.round((evalues * 1000) / dureeMs) : null,
    nombre,
  };
}

// La course mesurée : chaque point de relevé de course, son plan mesuré
// par mesurer sous l'instance de la charge reçue, puis le dernier point, à
// course.evalues, qui reçoit les valeurs du plan de la proposition, déjà
// mesurées (dernieres). Aucune valeur ne vient du compagnon ni d'une charge
// antérieure.
function courseMesuree({ source, origine, course, instance, aPriori, indicateurs, dernieres, resume }) {
  const releves = course.releves.map(({ mouvements, plan }) => ({
    mouvements,
    valeurs: valeursDe(indicateurs, mesurer(instance, indexerPlan(instance, plan)), aPriori),
  }));
  releves.push({ mouvements: course.evalues, valeurs: dernieres });
  let dernierChangement = releves[0].mouvements;
  for (let i = 1; i < releves.length; i += 1) {
    const avant = releves[i - 1].valeurs;
    const apres = releves[i].valeurs;
    if (indicateurs.some((nom) => avant[nom] !== apres[nom])) dernierChangement = releves[i].mouvements;
  }
  return {
    source,
    propositionDuRetenu: source === 'retenu' ? origine.id : null,
    evalues: course.evalues,
    arret: origine.arret,
    indicateurs: [...indicateurs],
    releves,
    dernierChangement,
    generation: generationDuDetail(resume),
  };
}

// Une violation de la garde complétée de ce qu'elle désigne : participant,
// l'identifiant de son index de personne ; organisation, le libellé de son
// index de groupe.
function violationNommee(instance, violation) {
  const nommee = { ...violation };
  if (Object.hasOwn(violation, 'index')) nommee.participant = instance.ids[violation.index];
  if (Object.hasOwn(violation, 'groupe')) nommee.organisation = instance.groupes[violation.groupe];
  return nommee;
}

// Le détail du moteur (detailler) rendu en identifiants : chaque index de
// personne p, q, a, b devient l'identifiant de la personne, sous id quand
// il désignait la ligne, chaque index de table t devient table,
// l'identifiant de la table ; l'index de groupe g des collisions, que le
// libellé groupe double, se retire. Les tours restent des index, à partir
// de 0.
function enIdentifiants(instance, brut, critere) {
  const { ids, idsTables } = instance;
  const avecId = (element) => {
    if (element === null) return null;
    const { p, ...reste } = element;
    return { id: ids[p], ...reste };
  };
  const toursEnTables = (tours) => tours.map(({ tour, t, ...reste }) => ({ tour, table: idsTables[t], ...reste }));
  const paire = ({ a, b, fois, tours }) => ({ a: ids[a], b: ids[b], fois, tours: toursEnTables(tours) });
  const { bornes, objectifs, animateurs, matrice } = brut;
  return {
    bornes: {
      rang1: avecId(bornes.rang1),
      manque: avecId(bornes.manque),
      diversite: avecId(bornes.diversite),
      animateurs: avecId(bornes.animateurs),
      objectifs: avecId(bornes.objectifs),
      soiree: bornes.soiree,
      planchers: bornes.planchers,
    },
    profil: brut.profil.map(avecId),
    synthese: brut.synthese,
    repartitionRencontres: brut.repartitionRencontres,
    collisions: {
      planchersValides: brut.collisions.planchersValides,
      lignes: brut.collisions.lignes.map(({ g, ...reste }) => reste),
    },
    tables: {
      lignes: brut.tables.lignes.map(({ t, ...reste }) => ({ table: idsTables[t], ...reste })),
      ordres: brut.tables.ordres,
    },
    paires: { choisies: brut.paires.choisies.map(paire), imposees: brut.paires.imposees.map(paire) },
    matrice: matrice === null ? null : { ordre: matrice.ordre.map((p) => ids[p]), comptes: matrice.comptes },
    objectifs:
      objectifs === null
        ? null
        : {
            critere: { coche: critere.coche, sansObjet: critere.sansObjet },
            parTour: objectifs.parTour,
            pireTour: objectifs.pireTour,
            soiree: objectifs.soiree,
            jamaisServies: objectifs.jamaisServies.map(avecId),
            repartition: objectifs.repartition,
          },
    animateurs:
      animateurs === null
        ? null
        : {
            profil: animateurs.profil === null ? null : animateurs.profil.map(avecId),
            repartition: animateurs.repartition,
            diversite: {
              colonnes: animateurs.diversite.colonnes,
              lignes: animateurs.diversite.lignes.map(({ p, parTour, ...reste }) => ({
                id: ids[p],
                ...reste,
                parTour: toursEnTables(parTour),
              })),
              equite: animateurs.diversite.equite,
            },
          },
  };
}

// Le détail d'une source qui ne se compare pas : ses raisons, sa
// filiation, chaque champ de mesure à null.
function nonDetaille(id, statut, raisons, derivation) {
  const detail = { id, statut, raisons, derivation };
  for (const champ of CHAMPS_DE_MESURE) detail[champ] = null;
  detail.refusDessin = [];
  return detail;
}

// Le placement id de la charge : le retenu pour 'retenu', sinon la
// proposition de cet identifiant ; null sans lui.
function placementDe(charge, id) {
  if (id === 'retenu') return charge.retenu;
  return charge.propositions.find((proposition) => proposition.id === id) ?? null;
}

/**
 * Le détail d'un placement pour la page de qualité (§ 12, § 12.9, D27) : la
 * proposition id, ou le retenu pour 'retenu', mesuré pour lui seul.
 *
 * La configuration figée et l'instance sont celles de la charge, comme dans
 * evaluer ; le placement se valide une fois (fautes), puis se lit sans
 * seconde validation. Fautif ou en dérive, il rend ses raisons et chaque
 * champ de mesure à null. Sinon : le diagnostic une fois ; le plan mesuré
 * comme sa ligne d'évaluation le mesure (mesureDuPlan), dont detailler lit
 * les trois chiffres pour juger un plancher atteint ; les planchers
 * valent sur un plan qui assoit chacun à chacun de ses tours de présence
 * et ne laisse aucune réservation non tenue (D31), et les planchers que la
 * présence retire se recopient du diagnostic (planchersRetires) ; la borne
 * de diversité ; detailler, en une
 * lecture du plan, la matrice seulement jusqu'à SEUIL_MATRICE_PARTICIPANTS
 * personnes, dans l'ordre du profil ; puis la garde à quatre paramètres,
 * planchers des collisions et des objectifs par tour compris (D42).
 *
 * La filiation (D76, C23) : derivation, celle de la proposition dont la
 * course est montrée ; un retenu non ajusté venu d'une dérivée porte donc
 * celle de sa proposition d'origine.
 *
 * La course (§ 12.14, D40) : celle de la proposition, ou, pour un retenu,
 * celle de la proposition d'où il vient quand il en porte encore le
 * placement et qu'elle est dans la liste ; aucune pour un retenu ajusté ou
 * dont la proposition est effacée. courseDe(n) la rend pour la proposition
 * n, contrôlée contre elle (seance.courseDe), ou null quand elle n'est pas
 * gardée ; sans courseDe, aucune course. Chaque point de relevé se mesure
 * par mesurer sous l'instance de la charge reçue, le dernier étant le plan
 * de la proposition, au compte de ses mouvements évalués : ses valeurs sont
 * celles de sa ligne d'évaluation. generationDe(n) rend la génération de la
 * séance d'où vient la proposition n (generationDe du contrôleur), null
 * hors d'elle. Ne lit jamais l'horloge, ne modifie pas la charge.
 *
 * borneDiversite et diagnostiquer remplacent, pour une épreuve, la borne
 * de diversité et le diagnostic du moteur, comme diagnostiquer admet ses
 * planchers : ce qu'ils rendent est ce que detailler et la garde lisent.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number|'retenu'} id
 * @param {{courseDe?: ((id: number) => ({evalues: number, releves: Array<{mouvements: number,
 *          plan: import('../moteur/types.js').Plan}>}|null))|null,
 *          generationDe?: ((id: number) => ({dureeMs: number, coeurs: number, evalues: number,
 *          nombre: number}|null))|null,
 *          plafondsAPriori?: 'calcul'|null,
 *          borneDiversite?: typeof borneDiversite,
 *          diagnostiquer?: typeof diagnostiquer}} [options]
 * @returns {DetailQualite|null}  null quand la charge n'a pas ce placement
 * @throws {ErreurConfiguration} la configuration ne se normalise pas
 * @throws {TypeError} une autre valeur de plafondsAPriori
 */
export function detaillerQualite(charge, id, options = {}) {
  const { courseDe = null, generationDe = null, plafondsAPriori = 'calcul' } = options;
  const { borneDiversite: borner = borneDiversite, diagnostiquer: diagnostiquerLa = diagnostiquer } = options;
  exigerAPriori('detaillerQualite', plafondsAPriori);
  const placement = placementDe(charge, id);
  if (placement === null) return null;
  const configuration = figerConfiguration(configurationDe(charge));
  const instance = normaliser(configuration);
  const origine = id === 'retenu' ? origineDuRetenu(charge) : placement;
  const derivation = origine === null ? null : derivationDe(charge, origine.id);
  const sesFautes = fautes(placement);
  if (sesFautes.length > 0) return nonDetaille(id, 'fautif', sesFautes, derivation);
  const raisons = deriveSansRevalider(placement, charge);
  if (raisons.length > 0) return nonDetaille(id, 'derive', raisons, derivation);

  const diagnostic = diagnostiquerLa(configuration);
  const aPriori = plafondsAPriori === 'calcul' ? diagnostic.plafondAPriori.parPersonne : null;
  const plan = planSansRevalider(placement);
  const tableDe = indexerPlan(instance, plan);
  const { mesures, realises, chiffres } = mesureDuPlan(instance, tableDe, aPriori);
  const nonTenues = verifierInvariants(instance, plan, { reserveAutorisee: true }).filter(({ code }) => code === 'RESERVATION');
  const planchersValides = nonTenues.length === 0 && assisAChaqueTourPresent(instance, mesures.toursAssis);
  const { phiAffilies, aMax } = borner(instance, tableDe);
  const ordreMatrice =
    instance.N <= constante(SEUIL_MATRICE.nom)
      ? profilRencontres(instance, mesures, realises, aPriori, aMax).map(({ p }) => p)
      : null;
  const brut = detailler(instance, tableDe, {
    diagnostic,
    mesures,
    plafondsRealises: realises,
    plafondsAPriori: aPriori,
    troisChiffres: chiffres,
    planchersValides,
    cle: cleNormalisee,
    ordreMatrice,
    aMax,
  });
  const refusDessin = verifierIndicateurs(mesures, aPriori, realises, {
    planchersValides,
    planchersCollisions: planchersParGroupe(instance, diagnostic.collisions),
    objectifsParTour: brut.objectifs === null ? null : brut.objectifs.parTour.map(({ hors, plancher }) => ({ hors, plancher })),
    phiAffilies,
    aMax,
  }).map((violation) => violationNommee(instance, violation));

  const { criteresAppliques } = classer([{ id: 1, mesures, plafondsAPriori: aPriori }], compilationDe(instance));
  const indicateurs = indicateursDe(criteresAppliques);
  const course = origine === null || courseDe === null ? null : courseDe(origine.id);
  const parId = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const numeroDe = new Map(charge.tables.map((table) => [table.id, table.numero]));
  const critere = instance.etatCriteres.find(({ nom }) => nom === CRITERE_OBJECTIFS);

  return {
    id,
    statut: 'comparable',
    raisons: [],
    derivation,
    population: { mesuree: instance.N, exclue: charge.participants.filter(({ exclu }) => exclu).length },
    T: instance.T,
    R: instance.R,
    G: instance.groupes.length,
    idsTables: [...instance.idsTables],
    numerosTables: instance.idsTables.map((table) => numeroDe.get(table)),
    personnes: instance.ids.map((personne, p) => ({
      id: personne,
      nom: nomAffiche(parId.get(personne)),
      organisation: instance.groupe[p] === SANS_GROUPE ? null : instance.groupes[instance.groupe[p]],
      statut: NOM_DU_STATUT.get(instance.statut[p]),
    })),
    propositionDuRetenu: id === 'retenu' && origine !== null ? origine.id : null,
    ...enIdentifiants(instance, brut, critere),
    planchersRetires: [...diagnostic.planchersRetires],
    course:
      course === null
        ? null
        : courseMesuree({
            source: id === 'retenu' ? 'retenu' : 'proposition',
            origine,
            course,
            instance,
            aPriori,
            indicateurs,
            dernieres: valeursDe(indicateurs, mesures, aPriori),
            resume: generationDe === null ? null : generationDe(origine.id),
          }),
    refusDessin,
  };
}

/**
 * La ligne d'une personne pour la rubrique « Rencontres » de sa fiche
 * (§ 12.5, D33) : chaque personne qu'elle rencontre dans le placement id —
 * une proposition, ou le retenu pour 'retenu', la source de la page de
 * qualité —, avec le nombre de fois et les tours, les plus revues d'abord,
 * puis par identifiant (rencontresDe). source est id ; statut :
 * - sansPlacement : id null, ou la charge n'a pas ce placement ;
 * - exclue : la personne est exclue (§ 4.4) ;
 * - nonMesurable : le placement est fautif ou en dérive, ou la
 *   configuration ne se normalise pas ;
 * - mesuree : lignes porte chaque rencontre, {id, nom, fois, tours: [{tour,
 *   table}]}, tour l'index du tour à partir de 0, table l'identifiant de la
 *   table.
 * Hors de mesuree, lignes est vide. Ne modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {number|'retenu'|null} id
 * @param {number} personne   l'identifiant d'une personne de la charge
 * @returns {{source: number|'retenu'|null, statut: 'mesuree'|'nonMesurable'|'exclue'|'sansPlacement',
 *            lignes: Array<{id: number, nom: string, fois: number, tours: Array<{tour: number, table: number}>}>}}
 * @throws {RangeError} une personne que la charge n'a pas
 */
export function rencontresDePersonne(charge, id, personne) {
  const fiche = charge.participants.find((candidate) => candidate.id === personne);
  if (fiche === undefined) throw new RangeError(`rencontresDePersonne : personne ${personne} absente de la charge`);
  const rendu = (statut, lignes = []) => ({ source: id, statut, lignes });
  const placement = id === null ? null : placementDe(charge, id);
  if (placement === null) return rendu('sansPlacement');
  if (fiche.exclu) return rendu('exclue');
  if (fautes(placement).length > 0 || deriveSansRevalider(placement, charge).length > 0) return rendu('nonMesurable');
  let instance;
  try {
    instance = normaliser(configurationDe(charge));
  } catch (erreur) {
    if (erreur instanceof ErreurConfiguration) return rendu('nonMesurable');
    throw erreur;
  }
  const tableDe = indexerPlan(instance, planSansRevalider(placement));
  const parId = new Map(charge.participants.map((element) => [element.id, element]));
  const lignes = rencontresDe(instance, tableDe, instance.indexDe.get(personne)).map(({ q, fois, tours }) => ({
    id: instance.ids[q],
    nom: nomAffiche(parId.get(instance.ids[q])),
    fois,
    tours: tours.map(({ tour, t }) => ({ tour, table: instance.idsTables[t] })),
  }));
  return rendu('mesuree', lignes);
}

// --- La comparaison de deux placements (§ 12.10.6, D56 à D67, D83 à D85) ---

/**
 * @typedef {number|'retenu'} ClePlacement  l'identifiant d'une proposition,
 *          ou 'retenu'
 *
 * @typedef {Object} LigneManque  un rang du profil de manque d'un côté
 * @property {number} id
 * @property {number} manque
 * @property {number} rencontres
 * @property {number} plafondRealise
 * @property {number|null} plafondAPriori  null quand il est inconnu
 *
 * @typedef {Object} Cote  un des deux placements comparés
 * @property {ClePlacement} cle
 * @property {number|null} rang   sa place au classement, à partir de 1 ;
 *           celle de sa proposition pour un retenu non ajusté, null pour un
 *           retenu ajusté
 * @property {boolean} ajuste     vrai pour un retenu ajusté
 * @property {boolean} retouche   vrai pour un retenu qui porte une retouche à
 *           la main (retenuRetouche), faux pour un retenu ajusté aux seuls
 *           participants
 * @property {{depart: number, toursFiges: number[], departPresent: boolean}|null} derivation
 *           sa filiation : celle de la proposition, ou de la proposition
 *           d'origine d'un retenu non ajusté ; null sinon
 * @property {{rang1: {id: number, rencontres: number, plafondRealise: number,
 *            plafondAPriori: number|null, pourcent: number|null}|null,
 *            manque: {id: number, plafondRealise: number, effectif: number}|null,
 *            objectifs: {id: number, servis: number, possibles: number, pourcent: number|null}|null,
 *            soiree: {servis: number, possibles: number, pourcent: number|null, jamaisServies: number}|null,
 *            planchers: Record<string, {plancher: number, atteint: boolean}|null>}} bornes
 *           ces champs de detail.bornes, de même forme et de mêmes valeurs
 *
 * @typedef {Object} ComparaisonPlacements
 * @property {Cote} a
 * @property {Cote} b
 * @property {number} total   les autres personnes de l'instance, N − 1,
 *           communes aux deux côtés et sous chaque statut : le « N au
 *           total » d'une ligne de l'infobulle d'un rang (§ 12.10.3, D66)
 * @property {'comparable'|'refusDessin'|'populationsDifferentes'} statut
 * @property {{cote: 'a'|'b', violations: object[]}|null} refusDessin
 *           le premier côté dont la ligne porte un refus de dessin
 * @property {{seulementA: number[], seulementB: number[]}|null} populations
 *           sous 'populationsDifferentes', les personnes d'un seul côté,
 *           croissantes
 * Les champs qui suivent valent null — trace faux — hors de 'comparable'.
 * @property {{a: LigneManque[], b: LigneManque[]}|null} profils
 * @property {{a: number, b: number, egalite: number, bascule: number|null,
 *            domine: 'a'|'b'|null}|null} rangs
 * @property {number|null} borneHaute
 * @property {number|null} valeursDistinctes
 * @property {boolean} trace   valeursDistinctes ≥ VALEURS_MANQUE_COURBE
 * @property {Array<{valeur: number, a: {effectif: number, cumul: number},
 *            b: {effectif: number, cumul: number}}>|null} escalier
 * @property {{palier: {rang: number, criteres: string[]}|null, retenu: boolean}|null} indiscernables
 *           quand les deux profils sont égaux rang pour rang
 */

const croissant = (x, y) => x - y;

// Le seuil de valeurs distinctes sous lequel la comparaison écrit une phrase
// au lieu de tracer, nommé dans le registre des constantes (§ 12.6,
// § 19.10, D62) : un nom de constante, que la table des libellés ne connaît
// pas.
const VALEURS_COURBE = Object.freeze({ nom: 'VALEURS_MANQUE_COURBE' });

// Le côté que nomme la domination de comparerProfils.
const COTE_QUI_DOMINE = new Map([
  ['A', 'a'],
  ['B', 'b'],
]);

// La ligne de la table du placement cle : celle du retenu pour 'retenu',
// celle de la proposition de cet identifiant sinon ; null sans elle.
function ligneDuPlacement(table, cle) {
  if (cle === 'retenu') return table.retenu;
  return table.propositions.find(({ id }) => id === cle) ?? null;
}

// Le placement identique à cle : la proposition d'origine d'un retenu non
// ajusté pour 'retenu', le retenu non ajusté pour sa proposition d'origine ;
// null sinon. ajuste est retenuAjuste(charge).
function identiqueA(charge, cle, ajuste) {
  if (charge.retenu === null || ajuste) return null;
  if (cle === 'retenu') return charge.retenu.proposition;
  return cle === charge.retenu.proposition ? 'retenu' : null;
}

// La filiation du placement cle : celle de la proposition, ou de la
// proposition d'origine d'un retenu non ajusté ; null pour un retenu
// ajusté, et pour 'retenu' sans retenu. ajuste est retenuAjuste(charge).
function filiationDe(charge, cle, ajuste) {
  if (cle !== 'retenu') return derivationDe(charge, cle);
  return charge.retenu === null || ajuste ? null : derivationDe(charge, charge.retenu.proposition);
}

// La place au classement du placement cle, à partir de 1 : celle de sa
// proposition pour un retenu non ajusté ; null pour un retenu ajusté et
// hors du classement.
function rangDe(charge, table, cle, ajuste) {
  if (cle === 'retenu' && ajuste) return null;
  const rang = table.classement.ordre.indexOf(cle === 'retenu' ? charge.retenu.proposition : cle);
  return rang < 0 ? null : rang + 1;
}

/**
 * Vrai quand la page de qualité a deux placements mesurables et distincts à
 * comparer (§ 12, § 12.10.6, D85, C14) : parmi les propositions comparables
 * et le retenu dont la ligne se compare, un retenu non ajusté et sa
 * proposition d'origine comptent pour un. La commande « Comparer » d'une
 * ligne ne s'offre qu'à cette condition. Ne modifie rien.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {TableEvaluation} table   evaluer(charge)
 * @returns {boolean}
 */
export function comparaisonOfferte(charge, table) {
  const comparables = table.propositions.filter(({ statut }) => statut === 'comparable').map(({ id }) => id);
  const retenu = table.retenu !== null && table.retenu.statut === 'comparable';
  const distincts = comparables.length + (retenu && !comparables.includes(identiqueA(charge, 'retenu', retenuAjuste(charge))) ? 1 : 0);
  return distincts >= 2;
}

/**
 * Les placements que le second côté de la comparaison peut prendre quand le
 * premier est a (§ 12.10.6, D56, D58, C20) : le retenu d'abord, quand sa
 * ligne se compare, puis les propositions comparables dans l'ordre du
 * classement, chacune avec sa place (rangDe), moins a et moins le placement
 * identique à a — un retenu non ajusté et sa proposition d'origine ne se
 * comparent pas l'un à l'autre. a qui n'est pas un placement mesurable ne
 * retire que lui-même.
 *
 * defaut est le premier de ces candidats qui existe parmi : le départ de a
 * quand a est une dérivée — un retenu non ajusté a la filiation de sa
 * proposition —, la proposition d'origine de a quand a est un retenu
 * ajusté, la première proposition candidate du classement, le retenu ; null
 * sans candidat. Ne modifie rien.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {TableEvaluation} table   evaluer(charge)
 * @param {ClePlacement} a
 * @returns {{candidats: Array<{cle: ClePlacement, rang: number|null}>, defaut: ClePlacement|null}}
 */
export function candidatsDeComparaison(charge, table, a) {
  const ajuste = retenuAjuste(charge);
  const identique = identiqueA(charge, a, ajuste);
  const exclu = (cle) => cle === a || cle === identique;
  const candidats = [];
  if (table.retenu !== null && table.retenu.statut === 'comparable' && !exclu('retenu')) {
    candidats.push({ cle: 'retenu', rang: rangDe(charge, table, 'retenu', ajuste) });
  }
  for (const { id, statut } of table.propositions) {
    if (statut === 'comparable' && !exclu(id)) candidats.push({ cle: id, rang: rangDe(charge, table, id, ajuste) });
  }
  const estCandidat = (cle) => candidats.some((candidat) => candidat.cle === cle);
  const depart = filiationDe(charge, a, ajuste)?.depart ?? null;
  const origine = a === 'retenu' && ajuste && charge.retenu !== null ? charge.retenu.proposition : null;
  const premiere = candidats.find(({ cle }) => cle !== 'retenu')?.cle ?? null;
  const defaut = [depart, origine, premiere, 'retenu'].find((cle) => cle !== null && estCandidat(cle)) ?? null;
  return { candidats, defaut };
}

// Un côté de la comparaison, lu dans sa ligne de la table : ses personnes,
// les identifiants que son placement déclare, croissants — ceux de la
// population sur un état sain, dans l'ordre de ses mesures ; son profil de
// manque complété des rencontres et du plafond a priori de chacun ; ses
// bornes. RangeError quand cle ne désigne pas un placement mesurable ; et,
// par manques et profilManque, qui exigent une case par personne des
// rencontres et des plafonds réalisés, quand la ligne n'a pas une case par
// personne du placement.
function coteDe({ charge, table, instance, planchers, ajuste, retouche }, cle) {
  const ligne = ligneDuPlacement(table, cle);
  const placement = placementDe(charge, cle);
  if (ligne === null || ligne.statut !== 'comparable' || placement === null) {
    throw new RangeError(`comparerPlacements : ${JSON.stringify(cle)} n'est pas un placement mesurable`);
  }
  const { mesures, plafondsRealises: realises, troisChiffres: chiffres, violations } = ligne;
  const ids = [...placement.participants].sort(croissant);
  const personnes = { N: ids.length, ids };
  const aPriori = table.plafondsAPriori;
  const indexDe = new Map(ids.map((id, p) => [id, p]));
  const profil = profilManque(personnes, manques(realises, mesures.rencontres), realises).map(({ id, manque, plafondRealise }) => {
    const p = indexDe.get(id);
    return { id, manque, rencontres: mesures.rencontres[p], plafondRealise, plafondAPriori: aPriori === null ? null : aPriori[p] };
  });
  const tete = teteDesColonnes(personnes, mesures, realises);
  const planchersValides = violations.length === 0 && assisAChaqueTourPresent(instance, mesures.toursAssis);
  return {
    ligne,
    ids,
    profil,
    cote: {
      cle,
      rang: rangDe(charge, table, cle, ajuste),
      ajuste: cle === 'retenu' && ajuste,
      retouche: cle === 'retenu' && retouche,
      derivation: filiationDe(charge, cle, ajuste),
      bornes: {
        rang1:
          tete.rang1 === null
            ? null
            : {
                id: ids[tete.rang1.p],
                rencontres: tete.rang1.rencontres,
                plafondRealise: tete.rang1.plafondRealise,
                plafondAPriori: aPriori === null ? null : aPriori[tete.rang1.p],
                pourcent: tete.rang1.pourcent,
              },
        manque: teteDuManque(profil),
        objectifs:
          tete.objectifs === null
            ? null
            : { id: ids[tete.objectifs.p], servis: tete.objectifs.servis, possibles: tete.objectifs.possibles, pourcent: tete.objectifs.pourcent },
        soiree: tete.soiree,
        planchers: planchersAtteints(planchers, { mesures, troisChiffres: chiffres, planchersValides }),
      },
    },
  };
}

/**
 * La comparaison de deux placements de la charge (§ 12.10.6, § 12.10.7,
 * D60 à D67, D83, C17, C20, C22, C29) : a, la source de la page, et b, le
 * second placement, chacun une proposition ou le retenu.
 *
 * Les deux lignes se lisent dans table, telles qu'evaluer les a mesurées :
 * ni diagnostic, ni mesure, ni détail, ni cache. L'instance et la
 * compilation se refont à chaque appel, par normaliser(configurationDe) et
 * compilationDe ; les planchers des colonnes, par planchersDesColonnes sur
 * table.diagnostic, une fois par appel et communs aux deux côtés — la
 * table porte le diagnostic et non les planchers, qu'evaluer ne calcule
 * pas. Chaque côté porte ses bornes — teteDesColonnes pour le rang 1, les
 * objectifs et la soirée, le pire cas de son placement et jamais une
 * moyenne ; la tête de son profil de manque et l'effectif au manque
 * maximal (teteDuManque) ; planchersAtteints sur sa ligne —, personnes
 * sous id.
 *
 * Le statut se décide dans cet ordre :
 * - refusDessin, quand la ligne de l'un des deux porte un refus de dessin
 *   (§ 12.10.5, D65) : les deux se jugent sur le même test, et le premier
 *   côté qui le porte est nommé ;
 * - populationsDifferentes, quand comparerProfils rend comparable faux :
 *   les deux placements ne déclarent pas les mêmes personnes (D64) ;
 * - comparable : profils (profilManque), rangs (comparerProfils, domine
 *   traduit en côté), borneHaute, valeursDistinctes, trace (au moins
 *   VALEURS_MANQUE_COURBE valeurs réunies), escalier (escalierDuManque) ;
 *   indiscernables quand les deux profils sont égaux rang pour rang — entre
 *   deux propositions, le premier palier qui les départage
 *   (premierPalierQuiDepartage, null : l'identifiant) ; avec le retenu, qui
 *   ne se classe pas, palier null et retenu vrai (D63).
 * Ne modifie rien.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {TableEvaluation} table   evaluer(charge)
 * @param {ClePlacement} a
 * @param {ClePlacement} b
 * @returns {ComparaisonPlacements}
 * @throws {RangeError} a égal à b, ou un côté qui n'est pas un placement
 *         mesurable ; jamais pour deux placements identiques, un retenu non
 *         ajusté et sa proposition
 * @throws {ErreurConfiguration} la configuration ne se normalise pas
 */
export function comparerPlacements(charge, table, a, b) {
  if (a === b) throw new RangeError(`comparerPlacements : deux fois le placement ${JSON.stringify(a)}`);
  const instance = normaliser(configurationDe(charge));
  const contexte = {
    charge,
    table,
    instance,
    planchers: planchersDesColonnes(instance, table.diagnostic),
    ajuste: retenuAjuste(charge),
    retouche: retenuRetouche(charge),
  };
  const cotes = [coteDe(contexte, a), coteDe(contexte, b)];
  const [lu, autre] = cotes;
  // N vient de normaliser (src/moteur) ; aucune personne ne se rencontre
  // elle-même.
  const total = instance.N - 1;
  const sansTrace = {
    refusDessin: null,
    populations: null,
    profils: null,
    rangs: null,
    borneHaute: null,
    valeursDistinctes: null,
    trace: false,
    escalier: null,
    indiscernables: null,
  };
  const refuse = cotes.findIndex(({ ligne }) => ligne.refusDessin.length > 0);
  if (refuse >= 0) {
    return {
      a: lu.cote,
      b: autre.cote,
      total,
      statut: 'refusDessin',
      ...sansTrace,
      refusDessin: { cote: refuse === 0 ? 'a' : 'b', violations: [...cotes[refuse].ligne.refusDessin] },
    };
  }
  const rangs = comparerProfils(lu.profil, autre.profil);
  if (!rangs.comparable) {
    const seulement = (ids, autres) => ids.filter((id) => !autres.includes(id));
    return {
      a: lu.cote,
      b: autre.cote,
      total,
      statut: 'populationsDifferentes',
      ...sansTrace,
      populations: { seulementA: seulement(lu.ids, autre.ids), seulementB: seulement(autre.ids, lu.ids) },
    };
  }
  const distinctes = valeursDistinctes(lu.profil, autre.profil);
  let indiscernables = null;
  if (rangs.rangsA === 0 && rangs.rangsB === 0) {
    const entree = ({ ligne }, id) => ({ id, mesures: ligne.mesures, plafondsAPriori: table.plafondsAPriori });
    indiscernables =
      a === 'retenu' || b === 'retenu'
        ? { palier: null, retenu: true }
        : { palier: premierPalierQuiDepartage(entree(lu, a), entree(autre, b), compilationDe(instance)), retenu: false };
  }
  return {
    a: lu.cote,
    b: autre.cote,
    total,
    statut: 'comparable',
    refusDessin: null,
    populations: null,
    profils: { a: lu.profil, b: autre.profil },
    rangs: {
      a: rangs.rangsA,
      b: rangs.rangsB,
      egalite: rangs.egalite,
      bascule: rangs.rangBascule,
      domine: COTE_QUI_DOMINE.get(rangs.domine) ?? null,
    },
    borneHaute: borneHaute(lu.profil, autre.profil),
    valeursDistinctes: distinctes,
    trace: distinctes >= constante(VALEURS_COURBE.nom),
    escalier: escalierDuManque(lu.profil, autre.profil),
    indiscernables,
  };
}
