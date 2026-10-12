// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
// resumeDuRetenu donne à la liste des événements la différence à la cible
// du retenu, lue dans la même mesure que sa ligne du tableau, sans le
// diagnostic ni les plafonds : la liste en résume chaque événement du
// dossier. premiereDuClassement est la seule définition de la proposition
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
import { cleNormalisee } from '../csv/normalisation.js';
import { constante } from '../geometrie/constantes.js';
import { classer } from '../moteur/classement.js';
import { SANS_GROUPE, STATUT, figerConfiguration, indexerPlan, normaliser } from '../moteur/configuration.js';
import { compilationDe } from '../moteur/criteres.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import { mesurer } from '../moteur/indicateurs.js';
import { ecartsAuPlafondAPriori, minimumAtteint, troisChiffres } from '../moteur/manque.js';
import { rencontresDe } from '../moteur/paires.js';
import { borneDiversite, plafondsRealises } from '../moteur/plafond.js';
import { detailler, planchersParGroupe, profilRencontres } from '../moteur/qualite.js';
import { verifierIndicateurs, verifierInvariants } from '../moteur/verification.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { CIBLE_REDONDANCE_PAR_DEFAUT, cibleRedondance } from '../stockage/document.js';
import { derive, deriveSansRevalider, fautes, planDepuisFichier, planSansRevalider } from '../stockage/placements.js';
import { configurationDe } from './configuration.js';
import { nomAffiche } from './personnes.js';

export { CIBLE_REDONDANCE_PAR_DEFAUT, cibleRedondance };

// Les modes des objectifs, le défaut en tête, et les cases qui font compter
// chaque critère, tels que le registre les tient (contrainte 35) :
// l'interface, qui n'importe pas le moteur, les lit ici.
export { CASES, MODES_OBJECTIFS } from '../moteur/criteres.js';

/**
 * @typedef {Object} LigneEvaluation
 * @property {number} id          celui de la proposition ; retenu.proposition pour le retenu
 * @property {'comparable'|'derive'|'fautif'} statut
 * @property {object[]} raisons   fautif : ses fautes ; derive : ses raisons ; [] sinon
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

// Une ligne qui ne se mesure pas.
const nonMesuree = (id, statut, raisons) => ({
  id,
  statut,
  raisons,
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
    const tableDe = indexerPlan(instance, plan);
    const mesures = mesurer(instance, tableDe);
    const realises = plafondsRealises(instance, tableDe);
    return {
      id,
      statut: 'comparable',
      raisons: [],
      violations: verifierInvariants(instance, plan, { reserveAutorisee: true }).filter(({ code }) => code === 'RESERVATION'),
      mesures,
      plafondsRealises: realises,
      troisChiffres: troisChiffres(instance, mesures, aPriori, realises),
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
  };
}

/**
 * Le résumé du retenu que montre la liste des événements (§ 5.4, § 8.1,
 * § 8.9) : diffRedondance, la valeur absolue de la cible de l'événement
 * (cibleRedondance) moins la somme de redondance Σ r(p) du retenu, celle de
 * mesurer, que la ligne du retenu d'evaluer porte aussi. null sans retenu,
 * pour un retenu fautif ou en dérive, et quand la configuration ne se
 * normalise pas : rien ne s'y mesure, et la liste écrit « — ». Ne modifie
 * pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{diffRedondance: number}|null}
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
  const { totalRedondance } = mesurer(instance, indexerPlan(instance, planDepuisFichier(retenu)));
  return { diffRedondance: Math.abs(cibleRedondance(charge) - totalRedondance) };
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
 * @property {number|null} G        appartenances des présents
 * @property {number[]|null} idsTables      ordre des tables de l'instance
 * @property {number[]|null} numerosTables  le numéro de chacune
 * @property {Array<{id: number, nom: string, appartenance: string|null,
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
 * @property {CourseDetaillee|null} course
 * @property {object[]} refusDessin   verifierIndicateurs à quatre paramètres,
 *           chaque violation complétée de participant (index) et
 *           d'appartenance (groupe)
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
// l'identifiant de son index de personne ; appartenance, le libellé de son
// index de groupe.
function violationNommee(instance, violation) {
  const nommee = { ...violation };
  if (Object.hasOwn(violation, 'index')) nommee.participant = instance.ids[violation.index];
  if (Object.hasOwn(violation, 'groupe')) nommee.appartenance = instance.groupes[violation.groupe];
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

// Le détail d'une source qui ne se compare pas : ses raisons, chaque champ
// de mesure à null.
function nonDetaille(id, statut, raisons) {
  const detail = { id, statut, raisons };
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
 * champ de mesure à null. Sinon : le diagnostic une fois ; les planchers
 * valent sur un plan qui assoit chacun à chaque tour et ne laisse aucune
 * réservation non tenue (D31) ; la borne de diversité ; detailler, en une
 * lecture du plan, la matrice seulement jusqu'à SEUIL_MATRICE_PARTICIPANTS
 * personnes, dans l'ordre du profil ; puis la garde à quatre paramètres,
 * planchers des collisions et des objectifs par tour compris (D42).
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
  const sesFautes = fautes(placement);
  if (sesFautes.length > 0) return nonDetaille(id, 'fautif', sesFautes);
  const raisons = deriveSansRevalider(placement, charge);
  if (raisons.length > 0) return nonDetaille(id, 'derive', raisons);

  const diagnostic = diagnostiquerLa(configuration);
  const aPriori = plafondsAPriori === 'calcul' ? diagnostic.plafondAPriori.parPersonne : null;
  const plan = planSansRevalider(placement);
  const tableDe = indexerPlan(instance, plan);
  const mesures = mesurer(instance, tableDe);
  const realises = plafondsRealises(instance, tableDe);
  const nonTenues = verifierInvariants(instance, plan, { reserveAutorisee: true }).filter(({ code }) => code === 'RESERVATION');
  const planchersValides = nonTenues.length === 0 && mesures.toursAssis.every((assis) => assis === instance.R);
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
  const origine = id === 'retenu' ? origineDuRetenu(charge) : placement;
  const course = origine === null || courseDe === null ? null : courseDe(origine.id);
  const parId = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const numeroDe = new Map(charge.tables.map((table) => [table.id, table.numero]));
  const critere = instance.etatCriteres.find(({ nom }) => nom === CRITERE_OBJECTIFS);

  return {
    id,
    statut: 'comparable',
    raisons: [],
    population: { mesuree: instance.N, exclue: charge.participants.filter(({ exclu }) => exclu).length },
    T: instance.T,
    R: instance.R,
    G: instance.groupes.length,
    idsTables: [...instance.idsTables],
    numerosTables: instance.idsTables.map((table) => numeroDe.get(table)),
    personnes: instance.ids.map((personne, p) => ({
      id: personne,
      nom: nomAffiche(parId.get(personne)),
      appartenance: instance.groupe[p] === SANS_GROUPE ? null : instance.groupes[instance.groupe[p]],
      statut: NOM_DU_STATUT.get(instance.statut[p]),
    })),
    propositionDuRetenu: id === 'retenu' && origine !== null ? origine.id : null,
    ...enIdentifiants(instance, brut, critere),
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
