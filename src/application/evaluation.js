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
import { classer } from '../moteur/classement.js';
import { indexerPlan, normaliser } from '../moteur/configuration.js';
import { compilationDe } from '../moteur/criteres.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import { mesurer } from '../moteur/indicateurs.js';
import { ecartsAuPlafondAPriori, minimumAtteint, troisChiffres } from '../moteur/manque.js';
import { plafondsRealises } from '../moteur/plafond.js';
import { verifierIndicateurs, verifierInvariants } from '../moteur/verification.js';
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { CIBLE_REDONDANCE_PAR_DEFAUT, cibleRedondance } from '../stockage/document.js';
import { derive, deriveSansRevalider, fautes, planDepuisFichier, planSansRevalider } from '../stockage/placements.js';
import { configurationDe } from './configuration.js';

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
  if (plafondsAPriori !== 'calcul' && plafondsAPriori !== null) {
    throw new TypeError(`evaluer : plafondsAPriori 'calcul' ou null attendu, reçu ${JSON.stringify(plafondsAPriori)}`);
  }
  const configuration = configurationDe(charge);
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
