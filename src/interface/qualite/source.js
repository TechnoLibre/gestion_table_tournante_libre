// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La source de la page de qualité (§ 12, B9, D25), pure : SectionQualite.svelte
// la câble.
//
// La page mesure un placement entier, tous ses tours : la proposition
// demandée (ui.proposition) quand elle est dans la liste, sinon le retenu,
// sinon aucun. Le tour que le plan affiche n'y entre pas : un
// placement auquel manque un tour de l'événement est en dérive, à chaque tour
// du plan, et la page en donne les raisons. Une proposition fautive demandée
// reste la source, même quand le plan, qui ne la lit pas, montre le retenu ou
// les réservations à sa place : « Qualité » sur sa ligne en donne les fautes.
//
// La ligne de source reprend le libellé que la barre de vue du plan donne à
// ce placement (sourceMontree, plan/vue_plan.js), sa commande de retour
// comprise, configuration normalisée ou non ; une proposition fautive, que la
// barre ne nomme jamais, a le sien, qui dit que le plan ne la montre pas ;
// sans placement à mesurer, elle n'en nomme aucun, et dit que le plan ne
// montre que les réservations, qui ne se mesurent pas. La ligne
// d'évaluation est celle de la table d'évaluation de la charge (evaluation,
// propositions/modele.js), la même que le tableau des propositions lit :
// rien ne se mesure ici. Sans source mesurable, quatre cas se partagent la
// page sans se recouvrir, éprouvés dans l'ordre de CAS_QUALITE : la
// configuration qui ne se normalise pas l'emporte ; puis ni proposition ni
// retenu ; puis des propositions sans source, avec la première comparable
// du classement (premiereDuClassement) ; puis une source en dérive ou
// fautive, avec ses raisons.
import { formeNommeeDe } from '../../application/commandes.js';
import { diagnostiquerCharge } from '../../application/diagnostic.js';
import { premiereDuClassement } from '../../application/evaluation.js';
import { sourceMontree } from '../plan/vue_plan.js';
import { evaluation } from '../propositions/modele.js';

/** Les cas de la page, dans l'ordre où elle les éprouve : configuration,
 *  la configuration ne se normalise pas ; aucunPlacement, ni proposition
 *  ni retenu ; aucuneMontree, des propositions et aucune montrée ; derive
 *  et fautif, le statut de la source ; mesurable, une source comparable. */
export const CAS_QUALITE = Object.freeze(['configuration', 'aucunPlacement', 'aucuneMontree', 'derive', 'fautif', 'mesurable']);

// Une raison de dérive ou une faute : son code, ses détails, et la personne
// qu'elle nomme, null quand elle n'en nomme aucune — la forme des raisons du
// tableau des propositions.
const raisonDe = (raison) => ({ cle: raison.code, details: raison, participant: raison.participant ?? null });

// Le libellé de la ligne de source et la clé de sa commande de retour pour
// le placement id ('retenu', un identifiant de proposition, ou null) : ceux
// que la barre de vue du plan donne à ce placement, l'état des places
// qu'elle lit étant reconstitué sans tour ; une proposition fautive a le
// sien, et l'absence de placement (id null) aussi, la commande de retour
// restant celle de la barre. Fautif se lit aux fautes du placement
// (formeNommeeDe), comme la barre le lit, et non à la table d'évaluation,
// nulle quand la configuration ne se normalise pas.
function ligneDeSource(charge, demandee, id) {
  const retenu = charge.retenu !== null;
  const cible = id === 'retenu' ? { retenu: true } : { proposition: id };
  const fautif = id !== null && formeNommeeDe(charge, cible).fautes.length > 0;
  let etat;
  if (id === 'retenu') {
    etat = fautif ? { source: 'reservations', refus: { code: 'RETENU_FAUTIF' } } : { source: 'retenu' };
  } else if (id !== null) {
    etat = { source: 'proposition', proposition: id, cible: retenu ? null : 'reservations' };
  } else {
    etat = { source: 'reservations', refus: null };
  }
  const montree = sourceMontree(etat, demandee, retenu);
  if (id === null) return { libelle: { cle: 'qualite.source.aucun', details: {} }, revenir: montree.revenir };
  if (id === 'retenu' || !fautif) return montree;
  return { libelle: { cle: 'qualite.source.propositionFautive', details: { proposition: id } }, revenir: montree.revenir };
}

// Le refus de normaliser la configuration : celui de la table d'évaluation,
// ou, sans placement à évaluer, celui du diagnostic ; null quand elle se
// normalise.
function refusDeConfiguration(charge, evaluee) {
  if (evaluee.refus !== null) return evaluee.refus;
  if (evaluee.table !== null) return null;
  const { erreur } = diagnostiquerCharge(charge);
  return erreur === null ? null : { code: erreur.code, details: erreur.details };
}

/**
 * La source de la page de qualité et le cas qu'elle y fait. Ne modifie pas
 * la charge.
 *
 * @param {Object} charge   la charge de l'état observable de la séance
 * @param {{demandee?: number|null}} [demande]
 *   demandee : la proposition demandée au plan (ui.proposition)
 * @returns {{cas: string, libelle: {cle: string, details: Object},
 *   revenir: string|null, id: number|'retenu'|null, ligne: Object|null,
 *   premiere: number|null, raisons: Object[], refus: Object|null}}
 *   cas : l'un de CAS_QUALITE ; libelle et revenir : la ligne de source et
 *   la clé de sa commande de retour ; id : le placement que la page mesure,
 *   l'identifiant de la proposition ou 'retenu', null sans placement ;
 *   ligne : sa ligne d'évaluation quand il se mesure, null sinon ;
 *   premiere : l'identifiant de la première proposition comparable du
 *   classement, dans le cas aucuneMontree, null sinon ; raisons : celles de
 *   la dérive ou les fautes, chacune {cle, details, participant} ; refus :
 *   {code, details} du refus de normaliser
 */
export function sourceQualite(charge, { demandee = null } = {}) {
  const evaluee = evaluation(charge);
  const { table } = evaluee;
  // Le placement que la page mesure : la proposition demandée qu'a la liste,
  // sinon le retenu ; sa ligne d'évaluation, null quand la configuration ne
  // se normalise pas.
  let id = null;
  if (demandee !== null && charge.propositions.some((proposition) => proposition.id === demandee)) id = demandee;
  else if (charge.retenu !== null) id = 'retenu';
  let ligne = null;
  if (table !== null && id === 'retenu') ligne = table.retenu;
  else if (table !== null && id !== null) ligne = table.propositions.find((candidate) => candidate.id === id) ?? null;

  const { libelle, revenir } = ligneDeSource(charge, demandee, id);
  const resultat = (cas, champs = {}) => ({ cas, libelle, revenir, id: null, ligne: null, premiere: null, raisons: [], refus: null, ...champs });

  const refus = refusDeConfiguration(charge, evaluee);
  if (refus !== null) return resultat('configuration', { refus });
  if (ligne === null) {
    if (charge.propositions.length === 0) return resultat('aucunPlacement');
    return resultat('aucuneMontree', { premiere: premiereDuClassement(table)?.id ?? null });
  }
  if (ligne.statut !== 'comparable') return resultat(ligne.statut, { id, raisons: ligne.raisons.map(raisonDe) });
  return resultat('mesurable', { id, ligne });
}
