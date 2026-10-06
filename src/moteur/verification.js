// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les deux vérificateurs du moteur (§ 14.12), du code de l'application et non
// du code d'épreuve (§ 14.15) : verifierInvariants juge un plan contre
// l'instance, verifierIndicateurs les mesures et les plafonds de chacun
// (§ 12.3). Aucun des deux ne lève sur un défaut du contenu : chaque défaut
// est une violation de la liste rendue, et la liste vide dit que tout tient.
// Aucun ne modifie ce qu'il reçoit. Les formes reçues sont décrites dans
// types.js.
import { LIBRE } from './configuration.js';

/**
 * @typedef {{code: string, participant?: number, table?: number, tour?: number,
 *            detail?: string}} Violation   ids, tours numérotés à partir de 1
 *
 * @typedef {{code: string, index: number}} ViolationIndicateur
 *          index : rang de la personne dans l'ordre canonique, celui de
 *          instance.ids
 */

// Index de table d'une liste que plan.tables ne rattache à aucune table de
// l'instance. Aucune case de instance.fixe ne le porte : une réservation ne
// s'honore jamais dans une telle liste.
const SANS_TABLE = -2;

// Index de table de chaque position de plan.tables : celui de l'id déclaré
// quand c'est sa première déclaration et une table de l'instance, SANS_TABLE
// sinon. Ajoute à violations, dans l'ordre de plan.tables, un TABLE_INCONNUE
// 'inconnue' à la première déclaration d'un id étranger à l'instance, et un
// 'doublon' à la deuxième déclaration d'un id de l'instance : un id de table
// déclaré plusieurs fois se signale une seule fois, en 'doublon' s'il
// appartient à l'instance, en 'inconnue' sinon. Ajoute ensuite un 'absente'
// par table de l'instance non déclarée, dans l'ordre de l'instance. Les
// ensembles ne servent qu'à retrouver un id déjà vu.
function rattacherListes(tables, { idsTables, indexTableDe }, violations) {
  const tableDeListe = [];
  const declarees = new Set();
  const doublons = new Set();
  for (const id of tables) {
    const t = indexTableDe.get(id);
    if (!declarees.has(id)) {
      declarees.add(id);
      if (t === undefined) violations.push({ code: 'TABLE_INCONNUE', table: id, detail: 'inconnue' });
      tableDeListe.push(t ?? SANS_TABLE);
      continue;
    }
    if (t !== undefined && !doublons.has(id)) {
      doublons.add(id);
      violations.push({ code: 'TABLE_INCONNUE', table: id, detail: 'doublon' });
    }
    tableDeListe.push(SANS_TABLE);
  }
  for (const id of idsTables) {
    if (!declarees.has(id)) violations.push({ code: 'TABLE_INCONNUE', table: id, detail: 'absente' });
  }
  return tableDeListe;
}

/**
 * Violations d'un plan par identifiants (§ 8.9), jugé contre l'instance
 * (§ 14.12). Code de l'application : appelé après une génération, après un
 * retour arrière, au chargement d'un fichier. Rend la liste des violations,
 * vide si le plan tient.
 *
 * Codes :
 * - TOURS : plan.tours ou plan.reserves n'a pas R entrées ;
 * - TABLE_INCONNUE : les tables du plan ne reprennent pas celles de
 *   l'instance. detail précise le cas : 'inconnue', un id de plan.tables
 *   étranger à l'instance ; 'doublon', un id que plan.tables déclare plus
 *   d'une fois ; 'absente', une table de l'instance que plan.tables ne
 *   déclare pas ; ces trois-là portent table. 'listes', un tour qui n'a pas
 *   une liste par table déclarée, porte tour. L'ordre de plan.tables est
 *   libre ;
 * - INCONNU : un id ni participant ni exclu de l'instance, à une table ou en
 *   réserve ;
 * - EXCLU_PLACE : un participant exclu, à une table ou en réserve ;
 * - DOUBLE_PLACE : un participant présent plus d'une fois dans un tour,
 *   réserve comprise ;
 * - NON_ASSIS : un participant absent d'un tour, que la réserve soit permise
 *   ou non, ou présent seulement en réserve quand reserveAutorisee est faux.
 *   La réserve est une liste du plan (§ 8.9) : un participant qui ne figure
 *   ni à une table ni en réserve manque au plan, il n'attend pas ;
 * - CAPACITE : une liste plus longue que la capacité de sa table. Le siège
 *   est la position dans la liste : chaque entrée en occupe un, et le siège
 *   au-delà de la capacité est hors de sa table ;
 * - RESERVATION : un participant que instance.fixe impose à une table à un
 *   tour, placé ailleurs à ce tour, à une autre table ou en réserve ; table
 *   nomme la table imposée. La règle ne dépend pas de reserveAutorisee : le
 *   réservé présent seulement en réserve reçoit RESERVATION que la réserve
 *   soit permise ou non, précédée de NON_ASSIS quand elle est interdite. Ce
 *   sont deux règles enfreintes : l'asseoir à une autre table lèverait la
 *   première et non la seconde. Un participant absent du tour, que le plan
 *   ne place nulle part, ne relève que de NON_ASSIS.
 *
 * Une liste se rattache à la table que plan.tables déclare à sa position,
 * quand cette déclaration est la première d'un id de l'instance. Une liste
 * sans table de l'instance (id étranger, doublon, position au-delà de
 * plan.tables) n'entre dans aucune capacité ; ses occupants sont placés à une
 * table, donc pas NON_ASSIS, et aucune réservation ne s'y honore. Une table
 * déclarée sans liste à un tour est vide à ce tour. Seuls les tours que le
 * plan porte en entier, listes et réserve, et dont le numéro ne dépasse pas R
 * sont lus : un tour manquant ou incomplet n'est signalé que par TOURS.
 *
 * Un id étranger à l'instance se signale une fois par tour où il figure, et
 * DOUBLE_PLACE ne concerne que les participants. Un id de table déclaré
 * plusieurs fois se signale une seule fois : en 'doublon' s'il appartient à
 * l'instance, en 'inconnue' sinon.
 *
 * Les violations se rangent dans l'ordre de lecture : TOURS ; les ids de
 * plan.tables dans leur ordre, puis les tables absentes dans l'ordre de
 * l'instance ; puis chaque tour lu, par ordre croissant : son nombre de
 * listes ; les ids des listes dans l'ordre déclaré puis ceux de la réserve,
 * un id étranger à sa première apparition dans le tour et DOUBLE_PLACE à la
 * seconde ; les capacités, liste par liste ; enfin les participants par id
 * croissant, chacun avec son NON_ASSIS puis sa RESERVATION.
 *
 * @param {import('./types.js').Instance} instance
 * @param {import('./types.js').Plan} plan
 * @param {{reserveAutorisee?: boolean}} [options]  reserveAutorisee, faux par
 *        défaut : un participant présent seulement en réserve est NON_ASSIS
 *        (§ 12.6)
 * @returns {Violation[]}
 */
export function verifierInvariants(instance, plan, { reserveAutorisee = false } = {}) {
  const { N, R, ids, indexDe, exclus, idsTables, capacite, fixe } = instance;
  const violations = [];
  if (plan.tours.length !== R || plan.reserves.length !== R) violations.push({ code: 'TOURS' });
  const tableDeListe = rattacherListes(plan.tables, instance, violations);

  // Par participant, au tour lu : ses présences, réserve comprise ; sa
  // présence à une table ; sa présence à la table que fixe lui impose.
  const presences = new Int32Array(N);
  const aUneTable = new Uint8Array(N);
  const aSaTable = new Uint8Array(N);
  const lus = Math.min(R, plan.tours.length, plan.reserves.length);
  for (let r = 0; r < lus; r += 1) {
    const tour = r + 1;
    const listes = plan.tours[r];
    if (listes.length !== tableDeListe.length) {
      violations.push({ code: 'TABLE_INCONNUE', tour, detail: 'listes' });
    }
    presences.fill(0);
    aUneTable.fill(0);
    aSaTable.fill(0);

    // Compte une présence de id à ce tour et rend son index ; −1 pour un id
    // étranger à l'instance, signalé à sa première apparition dans le tour.
    const etrangers = new Set();
    const compter = (id) => {
      const p = indexDe.get(id);
      if (p === undefined) {
        if (!etrangers.has(id)) {
          etrangers.add(id);
          violations.push({ code: exclus.has(id) ? 'EXCLU_PLACE' : 'INCONNU', participant: id, tour });
        }
        return -1;
      }
      presences[p] += 1;
      if (presences[p] === 2) violations.push({ code: 'DOUBLE_PLACE', participant: id, tour });
      return p;
    };
    for (let i = 0; i < listes.length; i += 1) {
      const t = i < tableDeListe.length ? tableDeListe[i] : SANS_TABLE;
      for (const id of listes[i]) {
        const p = compter(id);
        if (p < 0) continue;
        aUneTable[p] = 1;
        if (fixe[p * R + r] === t) aSaTable[p] = 1;
      }
    }
    for (const id of plan.reserves[r]) compter(id);

    for (let i = 0; i < listes.length && i < tableDeListe.length; i += 1) {
      const t = tableDeListe[i];
      if (t !== SANS_TABLE && listes[i].length > capacite[t]) {
        violations.push({ code: 'CAPACITE', table: idsTables[t], tour });
      }
    }

    for (let p = 0; p < N; p += 1) {
      if (!aUneTable[p] && (presences[p] === 0 || !reserveAutorisee)) {
        violations.push({ code: 'NON_ASSIS', participant: ids[p], tour });
      }
      const imposee = fixe[p * R + r];
      if (imposee !== LIBRE && presences[p] > 0 && !aSaTable[p]) {
        violations.push({ code: 'RESERVATION', participant: ids[p], table: idsTables[imposee], tour });
      }
    }
  }
  return violations;
}

// Vrai quand gauche ≥ droite et que les deux sont des nombres : NaN, ou une
// valeur d'un autre type, fait tomber l'inégalité au lieu d'y être convertie.
const tient = (gauche, droite) =>
  typeof gauche === 'number' && typeof droite === 'number' && gauche >= droite;

// Lève TypeError quand valeurs n'a pas de longueur, n'étant pas une liste,
// et RangeError quand elle n'a pas N cases. attendu nomme ce que le paramètre
// nom admet.
function exigerLongueur(valeurs, N, nom, attendu) {
  if (typeof valeurs?.length !== 'number') throw new TypeError(`${nom} : ${attendu} attendue`);
  if (valeurs.length !== N) {
    throw new RangeError(`${nom} : ${valeurs.length} cases, ${N} attendues comme mesures.rencontres`);
  }
}

/**
 * Garde du § 12.3 : éprouve, pour chacun, la ligne de décomposition du
 * § 12.10.5, N − 1 ≥ plafond a priori ≥ plafond réalisé ≥ rencontres, une
 * inégalité entre deux termes voisins à la fois ; ensemble, elles ordonnent
 * toute la ligne. Une violation désigne un calcul faux, sur lequel le profil
 * ne se dessine pas.
 *
 * Les trois listes suivent l'ordre canonique, celui de instance.ids, et N est
 * la longueur de mesures.rencontres. plafondsAPriori vaut null quand le
 * plafond a priori est inconnu (§ 12.6) : la ligne perd ce terme, et seule la
 * chaîne N − 1 ≥ réalisé ≥ rencontres est éprouvée. Une inégalité ne tient
 * qu'entre deux nombres : NaN, ou une valeur d'un autre type, la fait tomber
 * au lieu d'y être convertie.
 *
 * Codes : PLAFOND_A_PRIORI (a priori > N − 1), ORDRE_PLAFONDS (a priori <
 * réalisé), PLAFOND_REALISE (réalisé > N − 1, a priori inconnu), DEPASSEMENT
 * (rencontres > réalisé). La fonction ne reçoit pas les identifiants : une
 * violation désigne la personne par index, son rang dans l'ordre canonique,
 * que instance.ids[index] traduit. Les violations se rangent par index
 * croissant, puis de gauche à droite sur la ligne.
 *
 * Lève RangeError quand une liste de plafonds n'a pas N cases : elle décrit
 * une autre population, et l'écart est une faute de code. Lève TypeError
 * quand plafondsRealises n'est pas une liste, ou plafondsAPriori ni une liste
 * ni null : seul null dit l'a priori inconnu. undefined, la valeur d'un champ
 * manquant, ne passe pas pour lui : il ôterait deux inégalités à la garde
 * sans rien signaler.
 *
 * @param {{rencontres: ArrayLike<number>}} mesures  les mesures d'un plan ;
 *        seule la liste rencontres est lue
 * @param {ArrayLike<number>|null} plafondsAPriori
 * @param {ArrayLike<number>} plafondsRealises
 * @returns {ViolationIndicateur[]}
 */
export function verifierIndicateurs(mesures, plafondsAPriori, plafondsRealises) {
  const { rencontres } = mesures;
  const N = rencontres.length;
  exigerLongueur(plafondsRealises, N, 'plafondsRealises', 'liste');
  if (plafondsAPriori !== null) exigerLongueur(plafondsAPriori, N, 'plafondsAPriori', 'liste ou null');
  const violations = [];
  for (let p = 0; p < N; p += 1) {
    const realise = plafondsRealises[p];
    if (plafondsAPriori === null) {
      if (!tient(N - 1, realise)) violations.push({ code: 'PLAFOND_REALISE', index: p });
    } else {
      const aPriori = plafondsAPriori[p];
      if (!tient(N - 1, aPriori)) violations.push({ code: 'PLAFOND_A_PRIORI', index: p });
      if (!tient(aPriori, realise)) violations.push({ code: 'ORDRE_PLAFONDS', index: p });
    }
    if (!tient(realise, rencontres[p])) violations.push({ code: 'DEPASSEMENT', index: p });
  }
  return violations;
}
