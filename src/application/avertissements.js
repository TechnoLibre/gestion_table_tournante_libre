// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les avertissements qu'un geste fait naître (§ 5.9, § 9, § 14.12), calculés
// de la charge d'avant à celle d'après, et les violations du retenu que la
// séance montre tant que la charge les porte. Un avertissement n'empêche
// rien : il dit ce que le geste a changé, avec le nombre.
//
// Aucun calcul ne lève sur un placement. Les raisons de dérive se lisent sur
// examiner (S2), qui les rend pour tout placement cohérent, dérivé compris ;
// le retenu ne se juge contre l'instance par verifierInvariants que quand
// examiner ne lui trouve aucune faute, et que la configuration se normalise.
// Ni indexerPlan ni derive n'entrent ici : le premier lève sur un plan qui ne
// décrit plus la configuration, le second sur un placement fautif.
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { LIBRE, nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { verifierInvariants } from '../moteur/verification.js';
import { capacite } from '../stockage/document.js';
import { examiner, planDepuisFichier } from '../stockage/placements.js';
import { configurationDe } from './configuration.js';
import { nomAffiche } from './personnes.js';
import { couvre, placesTenues, presents, reservationsActives } from './places.js';

const avertissement = (code, details) => ({ code, details });

// L'instance de la charge, ou l'ErreurConfiguration qui la refuse :
// { instance } ou { refus }. Une autre erreur remonte.
function instanceDe(charge) {
  try {
    return { instance: normaliser(configurationDe(charge)), refus: null };
  } catch (erreur) {
    if (!(erreur instanceof ErreurConfiguration)) throw erreur;
    return { instance: null, refus: erreur };
  }
}

// Deux objets plats égaux champ pour champ : mêmes clés, mêmes valeurs.
function memesChamps(a, b) {
  const cles = Object.keys(a);
  return cles.length === Object.keys(b).length && cles.every((cle) => Object.hasOwn(b, cle) && Object.is(a[cle], b[cle]));
}

// Les raisons de dérive de chaque placement d'un examen : les propositions
// par identifiant croissant, puis le retenu sous la clé 'retenu'.
function raisonsParPlacement(examen) {
  const raisons = new Map(examen.derives.map(({ id, raisons: liste }) => [id, liste]));
  raisons.set('retenu', examen.retenu.raisons);
  return raisons;
}

// Les réservations au siège que le retenu, sièges attribués, ne tient pas à
// ce siège alors que sa personne est assise à la même table : celles qui
// tiennent une chaise selon la règle de l'affichage (placesTenues), dans la
// capacité courante. Par tour, dans l'ordre de retenu.tables, par siège ;
// occupant, la personne présente sur ce siège, null pour une chaise vide ou
// celle d'un absent. Une personne assise à une autre table relève de la
// règle de la table, que verifierInvariants juge.
function siegesNonTenus(charge, retenu, instance) {
  if (!retenu.siegesAttribues) return [];
  const actives = reservationsActives(charge);
  const ids = presents(charge);
  const enregistrementDe = new Map(charge.tables.map((enregistrement) => [enregistrement.id, enregistrement]));
  const violations = [];
  const lus = Math.min(retenu.tours, instance.R, retenu.placement.length);
  for (let tour = 1; tour <= lus; tour += 1) {
    const couvrantes = actives.filter((reservation) => couvre(reservation, tour));
    retenu.tables.forEach((idTable, rang) => {
      const enregistrement = enregistrementDe.get(idTable);
      if (enregistrement === undefined || retenu.tables.indexOf(idTable) !== rang) return;
      const liste = retenu.placement[tour - 1].sieges[rang] ?? [];
      const { tenu } = placesTenues(
        couvrantes.filter(({ table }) => table === idTable),
        capacite(charge, enregistrement),
      );
      for (const siege of [...tenu.keys()].sort((a, b) => a - b)) {
        const { participant } = tenu.get(siege);
        const assis = liste[siege - 1] ?? null;
        if (assis === participant || !liste.includes(participant)) continue;
        const occupant = assis !== null && ids.has(assis) ? assis : null;
        violations.push({ code: 'RESERVATION', participant, table: idTable, tour, siege, occupant });
      }
    });
  }
  return violations;
}

/**
 * Les violations d'un retenu lisible (fautes vide) contre l'instance de la
 * charge (§ 14.12) : celles de verifierInvariants, la réserve admise — des
 * surnuméraires versés en réserve ne violent rien —, complétées de deux
 * réservations non tenues qu'il ne relève pas. Une personne que le retenu
 * ne place pas à un tour, et qu'une réservation impose à une table à ce
 * tour, reçoit RESERVATION {participant, table, tour} juste après son
 * NON_ASSIS : ajoutée ou réintégrée depuis la retenue, elle n'est honorée
 * nulle part. Sièges attribués, une réservation au siège que le retenu
 * donne à un autre, sa personne assise à la même table, reçoit RESERVATION
 * {participant, table, tour, siege, occupant} (siegesNonTenus), après les
 * autres. Le retenu se juge tel quel, sans retouche (§ 5.8).
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('../stockage/types.js').Retenu} retenu
 * @param {import('../moteur/types.js').Instance} instance   celle de la charge
 * @returns {Object[]}   les violations, dans cet ordre
 */
export function violationsDuRetenu(charge, retenu, instance) {
  const { R, indexDe, idsTables, fixe } = instance;
  const violations = [];
  for (const violation of verifierInvariants(instance, planDepuisFichier(retenu), { reserveAutorisee: true })) {
    violations.push(violation);
    if (violation.code !== 'NON_ASSIS' || violation.tour > R) continue;
    const imposee = fixe[indexDe.get(violation.participant) * R + violation.tour - 1];
    if (imposee !== LIBRE) {
      violations.push({ code: 'RESERVATION', participant: violation.participant, table: idsTables[imposee], tour: violation.tour });
    }
  }
  return [...violations, ...siegesNonTenus(charge, retenu, instance)];
}

// Les violations du retenu cohérent d'une charge (violationsDuRetenu). []
// sans retenu, pour un retenu fautif, ou sans instance.
function violationsCourantes(charge, examen, instance) {
  if (charge.retenu === null || examen.retenu.fautes.length > 0 || instance === null) return [];
  return violationsDuRetenu(charge, charge.retenu, instance);
}

// Le nom affiché de la personne id dans la première charge qui la porte,
// ou null ; le numéro de la table id de même.
const nomDans = (id, charges) => {
  for (const charge of charges) {
    const trouvee = charge.participants.find((candidate) => candidate.id === id);
    if (trouvee !== undefined) return nomAffiche(trouvee);
  }
  return null;
};
const numeroDans = (id, charges) => {
  for (const charge of charges) {
    const trouvee = charge.tables.find((candidate) => candidate.id === id);
    if (trouvee !== undefined) return trouvee.numero;
  }
  return null;
};

/**
 * Les raisons de dérive nommées (§ 9) : chacune garde ses champs, et gagne
 * personne, le nom affiché de la personne qu'elle désigne, et numero, le
 * numéro de la table qu'elle désigne, lus dans la première des charges qui
 * les porte ; une personne ou une table qu'aucune ne porte garde son seul
 * identifiant. Rend des objets neufs.
 *
 * @param {Object[]} raisons
 * @param {...import('../stockage/types.js').Charge} charges
 * @returns {Object[]}
 */
export function raisonsNommees(raisons, ...charges) {
  return raisons.map((raison) => {
    const nommee = { ...raison };
    if (raison.participant !== undefined) {
      const personne = nomDans(raison.participant, charges);
      if (personne !== null) nommee.personne = personne;
    }
    if (raison.table !== undefined) {
      const numero = numeroDans(raison.table, charges);
      if (numero !== null) nommee.numero = numero;
    }
    return nommee;
  });
}

/**
 * L'examen d'une charge (examiner, S2), ses raisons de dérive nommées sur
 * elle (raisonsNommees) : celles du retenu et de chaque proposition en
 * dérive. Un objet neuf ; l'examen reçu ne change pas.
 *
 * @param {import('../stockage/placements.js').Examen} examen
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {import('../stockage/placements.js').Examen}
 */
export function examenNomme(examen, charge) {
  return {
    ...examen,
    derives: examen.derives.map((derive) => ({ ...derive, raisons: raisonsNommees(derive.raisons, charge) })),
    retenu: { ...examen.retenu, raisons: raisonsNommees(examen.retenu.raisons, charge) },
  };
}

const memeRaison = (code, cle, valeur) => (raison) => raison.code === code && raison[cle] === valeur;

// La raison de dérive qui nomme déjà la violation, ou undefined : la
// personne exclue, supprimée ou non placée ; la table supprimée, ajoutée, ou
// dont la capacité a changé ; le nombre de tours changé.
function raisonQuiLaNomme(violation, raisons) {
  const { code, participant, table, detail } = violation;
  if (code === 'EXCLU_PLACE') return raisons.find(memeRaison('PARTICIPANT_EXCLU', 'participant', participant));
  if (code === 'INCONNU') return raisons.find(memeRaison('PARTICIPANT_SUPPRIME', 'participant', participant));
  if (code === 'NON_ASSIS') return raisons.find(memeRaison('PARTICIPANT_NON_PLACE', 'participant', participant));
  if (code === 'CAPACITE') return raisons.find(memeRaison('CAPACITE_CHANGEE', 'table', table));
  if (code === 'TOURS') return raisons.find((raison) => raison.code === 'TOURS_CHANGES');
  if (code === 'TABLE_INCONNUE' && detail === 'inconnue') return raisons.find(memeRaison('TABLE_SUPPRIMEE', 'table', table));
  if (code === 'TABLE_INCONNUE' && detail === 'absente') return raisons.find(memeRaison('TABLE_AJOUTEE', 'table', table));
  return undefined;
}

/**
 * Les violations du retenu de la charge que la dérive ne nomme pas déjà
 * (§ 14.12, § 14.15) : INVARIANT_VIOLE {proposition, violations}, la
 * proposition d'origine du retenu et les violations de verifierInvariants
 * dans leur ordre, réserve admise ; null quand il n'en reste aucune, sans
 * retenu, pour un retenu fautif, ou sur une configuration qui ne se
 * normalise pas. Une réservation que le retenu ne tient pas en est le cas
 * ordinaire, à sa table ou à son siège, sa personne placée ou non
 * (violationsDuRetenu) : la dérive ne compare pas les réservations.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('../stockage/placements.js').Examen} [examen]   celui de la
 *        charge, examiner(charge) quand il manque
 * @returns {{code: 'INVARIANT_VIOLE', details: {proposition: number, violations: object[]}}|null}
 */
export function invariantViole(charge, examen = examiner(charge)) {
  const { instance } = instanceDe(charge);
  const raisons = examen.retenu.raisons;
  const violations = violationsCourantes(charge, examen, instance).filter(
    (violation) => raisonQuiLaNomme(violation, raisons) === undefined,
  );
  if (violations.length === 0) return null;
  return avertissement('INVARIANT_VIOLE', { proposition: charge.retenu.proposition, violations });
}

/**
 * Avertissements d'un geste, de la charge d'avant à celle d'après (§ 5.9,
 * § 9), dans cet ordre. Aucun ne lève sur un placement : les raisons se
 * lisent sur examiner(avant) et examiner(apres) (S2), et planDepuisFichier
 * ne reçoit le retenu que quand examiner(…).retenu.fautes est vide.
 *
 *   CONFIGURATION_INCOHERENTE {code, details}   normaliser(configurationDe(apres))
 *     lève, et celle d'avant se normalisait ; PLACES_MANQUANTES et
 *     RESERVATION_NON_HONOREE, qui lisent l'instance d'après, ne se calculent
 *     alors pas ;
 *   PLACES_MANQUANTES {placesManquantes}   nombrePlacesManquantes de l'instance
 *     d'après, non nul et plus grand que celui d'avant (0 quand avant ne se
 *     normalisait pas) ;
 *   DERIVE_NOUVELLE {touchees: [{id|'retenu', raisons}]}   par placement, les
 *     raisons d'examiner(apres) — derives, retenu.raisons — qu'examiner(avant)
 *     ne portait pas, comparées champ pour champ, puis nommées sur la charge
 *     d'après, ou d'avant pour ce que le geste retire (raisonsNommees) ; les
 *     propositions par identifiant, puis le retenu, sous id 'retenu' ;
 *   RESERVATION_NON_HONOREE {participant, table, tour, personne, numero}
 *     chaque violation RESERVATION de violationsDuRetenu(apres, apres.retenu,
 *     instance d'après) absente du même calcul sur avant, qui n'en compte
 *     aucune quand son retenu est nul ou fautif, ou que sa configuration ne
 *     se normalisait pas ; personne est le nom affiché du participant,
 *     numero celui de la table, lus sur la charge d'après, qui porte l'une et
 *     l'autre puisque l'instance qui les viole en vient. Au siège, les
 *     détails portent en plus siege et occupant, ceux de la violation : le
 *     geste qui la lève est l'échange de la personne avec l'occupant
 *     (echangerDansRetenu), ou, chaise vide, son déplacement au siège.
 *
 * @param {import('../stockage/types.js').Charge} avant
 * @param {import('../stockage/types.js').Charge} apres
 * @returns {Array<{code: string, details: Object}>}
 */
export function avertissementsApres(avant, apres) {
  const rendus = [];
  const examenAvant = examiner(avant);
  const examenApres = examiner(apres);
  const instanceAvant = instanceDe(avant).instance;
  const { instance, refus } = instanceDe(apres);

  if (refus !== null && instanceAvant !== null) {
    rendus.push(avertissement('CONFIGURATION_INCOHERENTE', { code: refus.code, details: refus.details }));
  }
  if (instance !== null) {
    const manque = nombrePlacesManquantes(instance);
    const manqueAvant = instanceAvant === null ? 0 : nombrePlacesManquantes(instanceAvant);
    if (manque > 0 && manque > manqueAvant) rendus.push(avertissement('PLACES_MANQUANTES', { placesManquantes: manque }));
  }

  const anciennes = raisonsParPlacement(examenAvant);
  const touchees = [];
  for (const [id, raisons] of raisonsParPlacement(examenApres)) {
    const connues = anciennes.get(id) ?? [];
    const nouvelles = raisons.filter((raison) => !connues.some((connue) => memesChamps(connue, raison)));
    if (nouvelles.length > 0) touchees.push({ id, raisons: raisonsNommees(nouvelles, apres, avant) });
  }
  if (touchees.length > 0) rendus.push(avertissement('DERIVE_NOUVELLE', { touchees }));

  const reservations = (charge, examen, inst) =>
    violationsCourantes(charge, examen, inst).filter(({ code }) => code === 'RESERVATION');
  const tenues = reservations(avant, examenAvant, instanceAvant);
  for (const violation of reservations(apres, examenApres, instance)) {
    const { participant, table, tour, siege = null } = violation;
    const dejaLa = tenues.some(
      (connue) =>
        connue.participant === participant && connue.table === table && connue.tour === tour && (connue.siege ?? null) === siege,
    );
    if (dejaLa) continue;
    const personne = nomAffiche(apres.participants.find(({ id }) => id === participant));
    const { numero } = apres.tables.find(({ id }) => id === table);
    const auSiege = siege === null ? {} : { siege, occupant: violation.occupant };
    rendus.push(avertissement('RESERVATION_NON_HONOREE', { participant, table, tour, personne, numero, ...auSiege }));
  }
  return rendus;
}
