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
import { nombrePlacesManquantes, normaliser } from '../moteur/configuration.js';
import { verifierInvariants } from '../moteur/verification.js';
import { configurationDepuisCharge } from '../stockage/document.js';
import { examiner, planDepuisFichier } from '../stockage/placements.js';

const avertissement = (code, details) => ({ code, details });

// L'instance de la charge, ou l'ErreurConfiguration qui la refuse :
// { instance } ou { refus }. Une autre erreur remonte.
function instanceDe(charge) {
  try {
    return { instance: normaliser(configurationDepuisCharge(charge)), refus: null };
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

// Les violations du retenu cohérent d'une charge, contre son instance, la
// réserve admise : des surnuméraires versés en réserve ne violent rien.
// [] sans retenu, pour un retenu fautif, ou sans instance.
function violationsDuRetenu(charge, examen, instance) {
  if (charge.retenu === null || examen.retenu.fautes.length > 0 || instance === null) return [];
  return verifierInvariants(instance, planDepuisFichier(charge.retenu), { reserveAutorisee: true });
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
 * ordinaire : la dérive ne compare pas les réservations.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('../stockage/placements.js').Examen} [examen]   celui de la
 *        charge, examiner(charge) quand il manque
 * @returns {{code: 'INVARIANT_VIOLE', details: {proposition: number, violations: object[]}}|null}
 */
export function invariantViole(charge, examen = examiner(charge)) {
  const { instance } = instanceDe(charge);
  const raisons = examen.retenu.raisons;
  const violations = violationsDuRetenu(charge, examen, instance).filter(
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
 *   CONFIGURATION_INCOHERENTE {code, details}   normaliser(configurationDepuisCharge(apres))
 *     lève, et celle d'avant se normalisait ; PLACES_MANQUANTES et
 *     RESERVATION_NON_HONOREE, qui lisent l'instance d'après, ne se calculent
 *     alors pas ;
 *   PLACES_MANQUANTES {placesManquantes}   nombrePlacesManquantes de l'instance
 *     d'après, non nul et plus grand que celui d'avant (0 quand avant ne se
 *     normalisait pas) ;
 *   DERIVE_NOUVELLE {touchees: [{id|'retenu', raisons}]}   par placement, les
 *     raisons d'examiner(apres) — derives, retenu.raisons — qu'examiner(avant)
 *     ne portait pas, comparées champ pour champ ; les propositions par
 *     identifiant, puis le retenu, sous id 'retenu' ;
 *   RESERVATION_NON_HONOREE {participant, table, tour}   chaque violation
 *     RESERVATION de verifierInvariants(instance d'après,
 *     planDepuisFichier(apres.retenu)) absente du même calcul sur avant, qui
 *     n'en compte aucune quand son retenu est nul ou fautif, ou que sa
 *     configuration ne se normalisait pas.
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
    if (nouvelles.length > 0) touchees.push({ id, raisons: nouvelles });
  }
  if (touchees.length > 0) rendus.push(avertissement('DERIVE_NOUVELLE', { touchees }));

  const reservations = (charge, examen, inst) =>
    violationsDuRetenu(charge, examen, inst).filter(({ code }) => code === 'RESERVATION');
  const tenues = reservations(avant, examenAvant, instanceAvant);
  for (const { participant, table, tour } of reservations(apres, examenApres, instance)) {
    const dejaLa = tenues.some((connue) => connue.participant === participant && connue.table === table && connue.tour === tour);
    if (!dejaLa) rendus.push(avertissement('RESERVATION_NON_HONOREE', { participant, table, tour }));
  }
  return rendus;
}
