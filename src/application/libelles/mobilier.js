// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes du mobilier — tables, sièges, tours, réglages
// (§ 4, § 6, § 7.1, § 8.2, § 14.6) : les refus d'une capacité et d'un nombre
// de tours, leurs avertissements, les causes d'un siège retiré et les
// libellés figés du journal. Les détails désignent tables et personnes par
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
]);

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

  // --- Les libellés figés du journal (§ 8.2) ---------------------------------
  ['ENTREE_CREER_TABLE', ({ numero }) => `Ajouté la table ${numero}`],
  [
    'ENTREE_SUPPRIMER_TABLE',
    ({ numero, reservations, titres }) => {
      const retires = [];
      if (reservations > 0) retires.push(compte(reservations, 'réservation', 'réservations'));
      if (titres > 0) retires.push(compte(titres, 'titre', 'titres'));
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
    ({ tours, retirees }) =>
      `Nombre de tours : ${tours}${retirees > 0 ? ` ; ${compte(retirees, 'réservation retirée', 'réservations retirées')}` : ''}`,
  ],
  [
    'ENTREE_MODIFIER_REGLAGE',
    ({ cle, valeur }) => `${nomDans(NOMS_DES_REGLAGES, cle, 'réglage')} : ${valeurDeReglage(valeur)}`,
  ],
  ['ENTREE_CHANGER_CIBLE_REDONDANCE', ({ cible }) => `Cible de la somme de redondance : ${cible}`],
]);
