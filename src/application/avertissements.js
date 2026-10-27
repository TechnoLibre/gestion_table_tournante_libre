// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

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
import { LIBRE, normaliser, placesManquantesParTour } from '../moteur/configuration.js';
import { verifierInvariants } from '../moteur/verification.js';
import { capacite } from '../stockage/document.js';
import { examiner, planDepuisFichier } from '../stockage/placements.js';
import { configurationDe } from './configuration.js';
import { organisationsDe } from './conflits_organisation.js';
import { nomAffiche } from './personnes.js';
import { aDesAbsences, placesTenues, presentsAuTour, reservationsCouvrantes } from './places.js';

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

// Deux valeurs de champ de raison égales : le même scalaire, ou deux listes
// de scalaires égales rang pour rang (les tours de PRESENCE_RETIREE et de
// PRESENCE_AJOUTEE), que chaque examen construit à neuf.
const memeValeur = (a, b) =>
  Object.is(a, b) || (Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => Object.is(x, b[i])));

// Deux raisons égales champ pour champ : mêmes clés, mêmes valeurs.
function memesChamps(a, b) {
  const cles = Object.keys(a);
  return cles.length === Object.keys(b).length && cles.every((cle) => Object.hasOwn(b, cle) && memeValeur(a[cle], b[cle]));
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
// tiennent une chaise selon la règle de l'affichage (placesTenues), parmi
// les réservations couvrantes du tour (personne présente à ce tour), dans la
// capacité courante. Par tour, dans l'ordre de retenu.tables, par siège ;
// occupant, la personne présente au tour sur ce siège, null pour une chaise
// vide ou celle d'un absent. Une personne assise à une autre table relève de
// la règle de la table, que verifierInvariants juge.
function siegesNonTenus(charge, retenu, instance) {
  if (!retenu.siegesAttribues) return [];
  const enregistrementDe = new Map(charge.tables.map((enregistrement) => [enregistrement.id, enregistrement]));
  const violations = [];
  const lus = Math.min(retenu.tours, instance.R, retenu.placement.length);
  for (let tour = 1; tour <= lus; tour += 1) {
    const couvrantes = reservationsCouvrantes(charge, tour);
    const ids = presentsAuTour(charge, tour);
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

// Les inclusions qu'un conflit d'organisation contredit dans une instance
// (§ 4, raison 'conflit' de inclusionsHorsAtteinte), chacune sous une clé
// qui dit sa source et sa cible : {participant, cible}, la source par son
// identifiant, la cible telle que l'instance la porte. La clé nomme une
// organisation cible sous son libellé passé par renommes, de → vers, quand
// il y figure : les contradictions d'avant se comparent ainsi à celles
// d'après sous les libellés d'après. Une Map vide sans instance.
function contredites(instance, renommes = new Map()) {
  const parCle = new Map();
  if (instance === null) return parCle;
  for (const { p, cible, raison } of instance.inclusionsHorsAtteinte) {
    if (raison !== 'conflit') continue;
    const participant = instance.ids[p];
    const vers = Object.hasOwn(cible, 'organisation')
      ? `organisation:${renommes.get(cible.organisation) ?? cible.organisation}`
      : `participant:${cible.participant}`;
    parCle.set(`${participant}|${vers}`, { participant, cible });
  }
  return parCle;
}

// Les renommages que les listes d'une charge d'après ont pu suivre
// (suivreOrganisations) : de → vers pour chaque personne qui quittait une
// organisation que la charge d'après ne porte plus, et en porte une autre.
// C'est la condition sous laquelle modifierParticipant fait suivre conflits
// et inclusions. Une Map, vide quand aucune organisation ne disparaît ainsi.
function renommagesSuivis(avant, apres) {
  const presentes = organisationsDe(apres);
  const organisationApres = new Map(apres.participants.map(({ id, organisation }) => [id, organisation]));
  const renommes = new Map();
  for (const { id, organisation } of avant.participants) {
    const vers = organisationApres.get(id) ?? null;
    if (organisation !== null && vers !== null && !presentes.has(organisation)) renommes.set(organisation, vers);
  }
  return renommes;
}

// Les violations du retenu cohérent d'une charge (violationsDuRetenu). []
// sans retenu, pour un retenu fautif, ou sans instance.
function violationsCourantes(charge, examen, instance) {
  if (charge.retenu === null || examen.retenu.fautes.length > 0 || instance === null) return [];
  return violationsDuRetenu(charge, charge.retenu, instance);
}

// Deux index par identifiant, lus en un parcours des charges dans leur
// ordre : personnes, la première personne qui le porte ; numeros, le numéro
// de la première table qui le porte, null ou absent compris. La première
// charge qui porte un identifiant tranche, et en elle sa première entrée :
// ce que trouverait un find par charge. Un identifiant NaN n'entre pas,
// puisque === ne le trouve jamais alors qu'une Map le retrouverait.
function indexDesNoms(charges) {
  const personnes = new Map();
  const numeros = new Map();
  for (const charge of charges) {
    for (const personne of charge.participants) {
      if (!personnes.has(personne.id) && !Number.isNaN(personne.id)) personnes.set(personne.id, personne);
    }
    for (const table of charge.tables) {
      if (!numeros.has(table.id) && !Number.isNaN(table.id)) numeros.set(table.id, table.numero);
    }
  }
  return { personnes, numeros };
}

// Une fonction qui nomme des listes de raisons sur ces charges, comme
// raisonsNommees ; l'index des charges se construit au premier appel qui
// reçoit une raison, puis sert à tous les suivants. Les charges ne doivent
// pas changer entre deux appels.
function nommeurSur(charges) {
  let index = null;
  return (raisons) => {
    if (raisons.length === 0) return [];
    index ??= indexDesNoms(charges);
    const { personnes, numeros } = index;
    return raisons.map((raison) => {
      const nommee = { ...raison };
      if (raison.participant !== undefined && personnes.has(raison.participant)) {
        const personne = nomAffiche(personnes.get(raison.participant));
        if (personne !== null) nommee.personne = personne;
      }
      if (raison.table !== undefined && numeros.has(raison.table)) {
        const numero = numeros.get(raison.table);
        if (numero !== null) nommee.numero = numero;
      }
      return nommee;
    });
  };
}

/**
 * Les raisons de dérive nommées (§ 9) : chacune garde ses champs, et gagne
 * personne, le nom affiché de la personne qu'elle désigne, et numero, le
 * numéro de la table qu'elle désigne, lus dans la première des charges qui
 * les porte, et en elle sur sa première entrée. Un nom affiché ou un numéro
 * null n'ajoute pas de champ, et la lecture ne passe pas à la charge
 * suivante ; une personne ou une table qu'aucune ne porte garde son seul
 * identifiant. Les charges se lisent une fois par appel, en deux index par
 * identifiant (indexDesNoms), quel que soit le nombre de raisons. Rend des
 * objets neufs.
 *
 * @param {Object[]} raisons
 * @param {...import('../stockage/types.js').Charge} charges
 * @returns {Object[]}
 */
export function raisonsNommees(raisons, ...charges) {
  return nommeurSur(charges)(raisons);
}

/**
 * L'examen d'une charge (examiner, S2), ses raisons de dérive nommées sur
 * elle (raisonsNommees) : celles du retenu et de chaque proposition en
 * dérive, sur un seul index de la charge. Un objet neuf ; l'examen reçu ne
 * change pas.
 *
 * @param {import('../stockage/placements.js').Examen} examen
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {import('../stockage/placements.js').Examen}
 */
export function examenNomme(examen, charge) {
  const nommer = nommeurSur([charge]);
  return {
    ...examen,
    derives: examen.derives.map((derive) => ({ ...derive, raisons: nommer(derive.raisons) })),
    retenu: { ...examen.retenu, raisons: nommer(examen.retenu.raisons) },
  };
}

const memeRaison = (code, cle, valeur) => (raison) => raison.code === code && raison[cle] === valeur;
// La raison de présence de ce code qui nomme la personne à ce tour.
const memePresence = (code, participant, tour) => (raison) =>
  raison.code === code && raison.participant === participant && raison.tours.includes(tour);

// La raison de dérive qui nomme déjà la violation, ou undefined : la
// personne exclue, supprimée ou non placée ; sa présence retirée au tour où
// le retenu la place encore, ou ajoutée au tour où il ne la place pas ; la
// table supprimée, ajoutée, ou dont la capacité a changé ; le nombre de
// tours changé.
function raisonQuiLaNomme(violation, raisons) {
  const { code, participant, table, tour, detail } = violation;
  if (code === 'EXCLU_PLACE') return raisons.find(memeRaison('PARTICIPANT_EXCLU', 'participant', participant));
  if (code === 'INCONNU') return raisons.find(memeRaison('PARTICIPANT_SUPPRIME', 'participant', participant));
  if (code === 'ABSENT_PLACE') return raisons.find(memePresence('PRESENCE_RETIREE', participant, tour));
  if (code === 'NON_ASSIS') {
    return (
      raisons.find(memeRaison('PARTICIPANT_NON_PLACE', 'participant', participant)) ??
      raisons.find(memePresence('PRESENCE_AJOUTEE', participant, tour))
    );
  }
  if (code === 'CAPACITE') return raisons.find(memeRaison('CAPACITE_CHANGEE', 'table', table));
  if (code === 'TOURS') return raisons.find((raison) => raison.code === 'TOURS_CHANGES');
  if (code === 'TABLE_INCONNUE' && detail === 'inconnue') return raisons.find(memeRaison('TABLE_SUPPRIMEE', 'table', table));
  if (code === 'TABLE_INCONNUE' && detail === 'absente') return raisons.find(memeRaison('TABLE_AJOUTEE', 'table', table));
  return undefined;
}

/**
 * DERIVE_NOUVELLE {touchees: [{id|'retenu', raisons}]}, ou null quand aucun
 * placement n'en a : par placement, les raisons de l'examen d'après
 * (derives, retenu.raisons) que celui d'avant ne portait pas, comparées
 * champ pour champ, puis nommées sur la charge d'après, ou d'avant pour ce
 * que le geste retire (raisonsNommees, un index pour tout l'appel) ; les
 * propositions par identifiant, puis le retenu, sous id 'retenu'. Une liste
 * de raisons que les deux examens partagent, le même tableau, ne se compare
 * pas : chacune de ses raisons est champ pour champ elle-même, et rien n'y
 * est neuf.
 *
 * @param {import('../stockage/placements.js').Examen} examenAvant   celui d'avant
 * @param {import('../stockage/placements.js').Examen} examenApres   celui d'après
 * @param {import('../stockage/types.js').Charge} apres
 * @param {import('../stockage/types.js').Charge} avant
 * @returns {{code: 'DERIVE_NOUVELLE', details: {touchees: Object[]}}|null}
 */
export function deriveNouvelle(examenAvant, examenApres, apres, avant) {
  const nommer = nommeurSur([apres, avant]);
  const anciennes = raisonsParPlacement(examenAvant);
  const touchees = [];
  for (const [id, raisons] of raisonsParPlacement(examenApres)) {
    const connues = anciennes.get(id) ?? [];
    if (connues === raisons) continue;
    const nouvelles = raisons.filter((raison) => !connues.some((connue) => memesChamps(connue, raison)));
    if (nouvelles.length > 0) touchees.push({ id, raisons: nommer(nouvelles) });
  }
  return touchees.length > 0 ? avertissement('DERIVE_NOUVELLE', { touchees }) : null;
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
 *   PLACES_MANQUANTES {placesManquantes, tours?}   quand un tour voit son
 *     manque (placesManquantesParTour de l'instance d'après) devenir positif
 *     ou grandir : comparé tour à tour à celui d'avant (0 quand avant ne se
 *     normalisait pas) ; un tour qu'avant n'avait pas se compare au plus
 *     grand manque d'avant, si bien que, sans absence, un tour ajouté au
 *     même manque ne dit rien. placesManquantes, le plus grand manque
 *     d'après ; tours, seulement quand une personne non exclue manque un tour
 *     (aDesAbsences), liste chaque tour à manque positif, {tour, manque},
 *     croissants — sans absence, les détails restent {placesManquantes} ;
 *   DERIVE_NOUVELLE {touchees: [{id|'retenu', raisons}]}   par placement, les
 *     raisons d'examiner(apres) — derives, retenu.raisons — qu'examiner(avant)
 *     ne portait pas, comparées champ pour champ, puis nommées sur la charge
 *     d'après, ou d'avant pour ce que le geste retire (deriveNouvelle) ; les
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
 *     (echangerDansRetenu), ou, chaise vide, son déplacement au siège ;
 *   INCLUSION_CONTREDITE {contredites: [{participant, personne, cible}]}
 *     les inclusions qu'un conflit d'organisation contredit dans l'instance
 *     d'après et que celle d'avant ne contredisait pas (aucune quand elle ne
 *     se normalisait pas), quel que soit le geste — une inclusion posée, un
 *     conflit posé, une personne qui change d'organisation ou revient —, dans
 *     l'ordre de l'instance ; personne, le nom affiché de la source ; cible,
 *     {organisation} ou {participant, personne}, lus sur la charge d'après.
 *     Une organisation renommée que les listes suivent garde ses
 *     contradictions : celles d'avant se lisent sous le nouveau libellé.
 *     L'inclusion reste dans sa liste : elle est hors d'atteinte.
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
    const manques = placesManquantesParTour(instance);
    const manquesAvant = instanceAvant === null ? [] : placesManquantesParTour(instanceAvant);
    const plusGrandAvant = Math.max(0, ...manquesAvant);
    const empire = manques.some((manque, rang) => manque > 0 && manque > (manquesAvant[rang] ?? plusGrandAvant));
    if (empire) {
      const placesManquantes = Math.max(...manques);
      const tours = manques.flatMap((manque, rang) => (manque > 0 ? [{ tour: rang + 1, manque }] : []));
      rendus.push(avertissement('PLACES_MANQUANTES', aDesAbsences(apres) ? { placesManquantes, tours } : { placesManquantes }));
    }
  }

  const derive = deriveNouvelle(examenAvant, examenApres, apres, avant);
  if (derive !== null) rendus.push(derive);

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

  const dejaContredites = contredites(instanceAvant, renommagesSuivis(avant, apres));
  const nommer = (id) => nomAffiche(apres.participants.find((personne) => personne.id === id));
  const nouvelles = [...contredites(instance)]
    .filter(([cle]) => !dejaContredites.has(cle))
    .map(([, { participant, cible }]) => ({
      participant,
      personne: nommer(participant),
      cible: Object.hasOwn(cible, 'organisation')
        ? { organisation: cible.organisation }
        : { participant: cible.participant, personne: nommer(cible.participant) },
    }));
  if (nouvelles.length > 0) rendus.push(avertissement('INCLUSION_CONTREDITE', { contredites: nouvelles }));
  return rendus;
}
