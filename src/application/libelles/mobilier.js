// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes du mobilier — tables, sièges, tours, réglages,
// objectifs des tables (§ 4, § 4.5, § 6, § 7.1, § 8.2, § 14.6) : les refus
// d'une capacité, d'un nombre de tours et d'un objectif, leurs
// avertissements, les causes d'un siège retiré, les avis des objectifs et
// les libellés figés du journal. Les détails désignent tables et personnes par
// identifiant : le refus se pose sur la table qu'il concerne, et son texte ne
// les nomme pas. Un libellé figé reçoit le numéro de table que la commande
// lit dans la charge.
import { cite, compte, enumeration, nomDans } from './aides.js';

// Le nom de chaque réglage que modifierReglage change, tel que le journal le
// fige (§ 5.3, § 5.10).
const NOMS_DES_REGLAGES = new Map([
  ['separerAppartenances', 'Séparer les appartenances'],
  ['nouveauxVoisins', 'Nouveaux voisins à chaque tour'],
  ['nouvelleTable', 'Nouvelle table à chaque tour'],
  ['varierAppartenances', 'Varier les appartenances rencontrées'],
  ['attribuerSieges', 'Attribuer les sièges'],
  ['generation.nombre', 'Propositions par génération'],
  ['generation.arret', 'Mouvements par proposition'],
  ['generation.historique', "Historique d'acceptation"],
  ['respecterObjectifs', 'Respecter les objectifs des tables'],
  ['rencontrerAnimateurs', "Rencontrer le plus d'animateurs différents"],
]);

// La règle d'un objectif (§ 4.5) : celle de l'événement quand elle est
// nulle.
const NOMS_DES_REGLES = new Map([
  ['ou', 'au moins une étiquette'],
  ['et', 'toutes les étiquettes'],
]);
const nomRegle = (regle) => nomDans(NOMS_DES_REGLES, regle, 'règle');

// Le lieu d'un objectif dans un libellé figé : sa table, et son tour quand
// il n'est pas de la soirée.
const lieuObjectif = (numero, tour) => (tour === null ? `Table ${numero}` : `Table ${numero}, tour ${tour}`);

// Ce qu'un avis ou un refus dit du tour de l'objectif qu'il désigne.
const aCeTour = (tour) => (tour === null ? 'pour la soirée' : `au tour ${tour}`);

// La valeur d'un réglage dans un libellé : activé ou désactivé pour un
// interrupteur, le nombre sinon.
const valeurDeReglage = (valeur) => (typeof valeur === 'boolean' ? (valeur ? 'activé' : 'désactivé') : String(valeur));

// Ce qu'une saisie refusée est : vide, ou un texte qui n'est pas un entier.
const saisieCitee = (saisie) => (String(saisie).trim() === '' ? 'La saisie est vide' : `${cite(String(saisie))} n'est pas un nombre entier`);

export const TABLE = new Map([
  // --- Les saisies (§ 6.2) ---------------------------------------------------
  [
    'NON_ENTIER',
    ({ saisie }) => `${saisieCitee(saisie)} : un nombre entier, sans signe ni décimale, est attendu.`,
  ],
  [
    'MOINS_DE_DEUX',
    () => "Une table compte au moins 2 places : seule à sa table, une personne ne rencontrerait personne.",
  ],
  ['MOINS_D_UN_TOUR', () => 'Une soirée compte au moins un tour.'],
  ['TROP_DE_PLACES', ({ max }) => `Une table compte au plus ${max} places : le plan ne dessinerait pas plus de chaises.`],
  ['TROP_DE_TOURS', ({ max }) => `Une soirée compte au plus ${max} tours.`],

  // --- Les refus d'une capacité (§ 6.2, § 7.1) -------------------------------
  [
    'SOUS_RESERVATIONS',
    ({ n, tour }) =>
      `La table porte ${compte(n, 'réservation', 'réservations')} au tour ${tour} : ` +
      `elle ne descend pas sous ${compte(n, 'place', 'places')}.`,
  ],
  [
    'SOUS_OCCUPES',
    ({ n, tour }) =>
      `Au tour ${tour}, la table occupe ${compte(n, 'place', 'places')} : la poignée ne descend pas en deçà.`,
  ],
  [
    'SIEGES_RETIRES',
    // Sièges non attribués (titres présent), un titre se compte : son siège
    // est une place d'affichage, que l'opérateur n'a pas choisie.
    ({ sieges, titres }, texte) => {
      const listes = titres === undefined ? sieges : sieges.filter(({ cause }) => cause !== 'SIEGE_TITRE');
      const termes = listes.map((siege) => texte(siege.cause, siege));
      if (titres !== undefined && titres > 0) termes.push(compte(titres, 'siège porte un titre', 'sièges portent un titre'));
      return `Réduire la table retire des sièges qui portent une saisie : ${enumeration(termes)}.`;
    },
  ],
  [
    'SIEGE_RESERVE',
    ({ siege, suspendue }) => `le siège ${siege} est réservé${suspendue ? ', par une réservation suspendue' : ''}`,
  ],
  ['SIEGE_TITRE', ({ siege, libelle }) => `le siège ${siege} porte le titre ${cite(libelle)}`],

  // --- Les avertissements d'une capacité (§ 6.2) -----------------------------
  [
    'SURNUMERAIRES',
    ({ tour, personnes }) =>
      `Au tour ${tour}, ${compte(personnes.length, 'personne passe', 'personnes passent')} dans la réserve : ` +
      `la table n'a plus de chaise pour ${personnes.length <= 1 ? 'elle' : 'elles'}.`,
  ],
  [
    'AU_DELA_LISIBLE',
    ({ seuil }) => `Au-delà de ${seuil} places, la liste des noms de la table cesse d'être lisible sur le plan.`,
  ],
  [
    'LISTE_SUR_VOISINE',
    ({ numero, numeroVoisine }) =>
      `Agrandie, la table ${numero} et la table ${numeroVoisine} se chevauchent sur le plan : ` +
      `une liste de noms passe sur l'autre table. Déplacer la table ${numeroVoisine} la pose sur une case libre.`,
  ],

  // --- Les objectifs des tables (§ 4.5, § 5.9) -------------------------------
  ['OBJECTIF_HORS_SOIREE', ({ tour }) => `La soirée n'a pas de tour ${tour} : un objectif vise la soirée ou l'un de ses tours.`],
  // Le geste « Retirer l'objectif » ne se dit qu'avec son remède : un couple
  // sans objectif n'a rien à retirer, et le refus nomme sa cause seule (§ 5.9).
  [
    'OBJECTIF_SANS_ETIQUETTE',
    ({ tour, remede }) =>
      `Un objectif ${aCeTour(tour)} vise au moins une étiquette.` +
      (remede === null || remede === undefined
        ? ''
        : " Pour que la table n'attende plus personne, « Retirer l'objectif »."),
  ],
  ['TABLE_DISPARUE', ({ table }) => `La table d'identifiant ${table} n'est plus dans cet événement.`],
  [
    'OBJECTIF_SANS_CORRESPONDANT',
    ({ tour }) =>
      `Aucune personne présente ne correspond à l'objectif ${aCeTour(tour)} : la table ne servira personne à ce titre.`,
  ],
  [
    'ETIQUETTE_ORPHELINE',
    ({ etiquette: motCle, voisine }) =>
      `Aucune personne ne porte l'étiquette ${cite(motCle)}` +
      (voisine === null || voisine === undefined ? '.' : ` ; une personne porte ${cite(voisine)}.`),
  ],

  // --- Les libellés figés du journal (§ 8.2) ---------------------------------
  ['ENTREE_CREER_TABLE', ({ numero }) => `Ajouté la table ${numero}`],
  [
    'ENTREE_SUPPRIMER_TABLE',
    ({ numero, reservations, titres, objectifs = 0 }) => {
      const retires = [];
      if (reservations > 0) retires.push(compte(reservations, 'réservation', 'réservations'));
      if (titres > 0) retires.push(compte(titres, 'titre', 'titres'));
      if (objectifs > 0) retires.push(compte(objectifs, 'objectif', 'objectifs'));
      return `Supprimé la table ${numero}${retires.length > 0 ? ` ; retirés : ${enumeration(retires)}` : ''}`;
    },
  ],
  ['ENTREE_DEPLACER_TABLE', ({ numero }) => `Déplacé la table ${numero}`],
  ['ENTREE_CHANGER_PLACES_TABLE', ({ numero, sieges }) => `Table ${numero} : ${compte(sieges, 'place', 'places')}`],
  ['ENTREE_REALIGNER_TABLE', ({ numero, sieges }) => `Table ${numero} : suit le défaut (${compte(sieges, 'place', 'places')})`],
  [
    'ENTREE_CHANGER_DEFAUT',
    ({ sieges, realignees }) =>
      `Sièges par défaut : ${sieges}${realignees > 0 ? ` ; ${compte(realignees, 'table réalignée', 'tables réalignées')}` : ''}`,
  ],
  [
    'ENTREE_CHANGER_TOURS',
    ({ tours, retirees, objectifsRetires = 0 }) => {
      const retires = [];
      if (retirees > 0) retires.push(compte(retirees, 'réservation retirée', 'réservations retirées'));
      if (objectifsRetires > 0) retires.push(compte(objectifsRetires, 'objectif retiré', 'objectifs retirés'));
      return `Nombre de tours : ${tours}${retires.length > 0 ? ` ; ${retires.join(', ')}` : ''}`;
    },
  ],
  [
    'ENTREE_MODIFIER_REGLAGE',
    ({ cle, valeur }) => `${nomDans(NOMS_DES_REGLAGES, cle, 'réglage')} : ${valeurDeReglage(valeur)}`,
  ],
  ['ENTREE_CHANGER_CIBLE_REDONDANCE', ({ cible }) => `Cible de la somme de redondance : ${cible}`],
  [
    'ENTREE_POSER_OBJECTIF',
    ({ numero, tour, regle, etiquettes }) =>
      `${lieuObjectif(numero, tour)} : objectif${tour === null ? ' de la soirée' : ''} ` +
      `${enumeration(etiquettes.map(cite))}, ${regle === null ? 'règle par défaut' : nomRegle(regle)}`,
  ],
  [
    'ENTREE_RETIRER_OBJECTIF',
    ({ numero, tour }) => `${lieuObjectif(numero, tour)} : objectif${tour === null ? ' de la soirée' : ''} retiré`,
  ],
  ['ENTREE_CHANGER_REGLE_OBJECTIFS', ({ regle }) => `Règle par défaut des objectifs : ${nomRegle(regle)}`],
]);
