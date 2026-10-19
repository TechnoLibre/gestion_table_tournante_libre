// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes des places — réservations, titres, pose (§ 5.8,
// § 5.9, § 8.2, § 14.6) : leurs refus, leurs signaux, leurs libellés figés,
// et le libellé de titre proposé à la désignation. Les détails désignent
// tables et personnes par identifiant : un refus se pose sur la place qu'il
// concerne (§ 5.9), et son texte ne les nomme pas, sauf la personne absente
// au tour, que son refus nomme par son nom affiché. Un libellé figé reçoit le
// nom affiché et le numéro de table que la commande lit dans la charge.
// SURRESERVATION garde le texte du moteur (libelles/moteur.js), et
// INVARIANT_VIOLE celui de la séance (libelles/seance.js).
import { cite } from './aides.js';

// La portée d'une réservation dans un libellé figé.
const portee = ({ portee: genre, tour }) => (genre === 'tous' ? 'tous les tours' : `tour ${tour}`);

// Une place nommée par un détail de libellé : la table d'un numéro, ou la
// réserve quand le numéro est null.
const lieu = (numero) => (numero === null ? 'réserve' : `table ${numero}`);

export const TABLE = new Map([
  // --- Les refus d'une pose (§ 5.9) -----------------------------------------
  [
    'SIEGE_INEXISTANT',
    ({ siege, capacite }) => `La table n'a que ${capacite} sièges : le siège ${siege} n'existe pas.`,
  ],
  [
    'DEUX_PLACES_MEME_TOUR',
    ({ tour }) => `Cette personne a déjà une place au tour ${tour} : elle n'en occupe qu'une par tour.`,
  ],
  ['PERSONNE_EXCLUE', () => "Cette personne est exclue : elle n'est placée nulle part tant qu'elle n'est pas réintégrée."],
  // PERSONNE_ABSENTE_AU_TOUR {participant, personne, tour} : une réservation
  // de tour désigné, ou un dépôt dans le retenu, à un tour d'absence.
  [
    'PERSONNE_ABSENTE_AU_TOUR',
    ({ personne, tour }) => `${personne} est absente au tour ${tour} : la marquer présente à ce tour avant de l'y placer.`,
  ],
  [
    'PLACE_RESERVEE',
    ({ siege, tour, portee: genre }) =>
      `Le siège ${siege} est réservé à une autre personne ${genre === 'tous' ? 'à tous les tours' : `au tour ${tour}`} : ` +
      'déplacer sa réservation libère la place.',
  ],
  [
    'RESERVEE_AILLEURS',
    ({ tour }) => `Cette personne est réservée à une autre place au tour ${tour} : sa réservation se déplace d'abord.`,
  ],
  [
    'TABLE_GELEE',
    () => "Toutes les places de cette table sont réservées pour la soirée : la génération n'y placera personne.",
  ],

  // --- Les titres (§ 4, § 4.1) -----------------------------------------------
  ['LIBELLE_VIDE', () => 'Le libellé du titre est vide.'],
  [
    'PLACE_TITREE',
    ({ siege, libelle }) => `Le siège ${siege} porte déjà le titre ${cite(libelle)} : une place porte un seul titre.`,
  ],
  [
    'AUCUN_SIEGE_SANS_TITRE',
    ({ capacite }) => `Les ${capacite} sièges de la table portent déjà un titre.`,
  ],
  ['TITRE_ABSENT', ({ siege }) => `Le siège ${siege} ne porte aucun titre.`],

  // --- Les réservations (§ 4, § 4.2) -----------------------------------------
  ['RESERVATION_ABSENTE', () => "Cette réservation n'existe pas."],
  [
    'CONVERSION_IMPOSSIBLE',
    () =>
      "Il n'y a rien à convertir : ces réservations ne couvrent pas chaque tour à cette table, " +
      "une réservation « tous les tours » l'y tient déjà, ou la personne est exclue.",
  ],

  // --- Le retenu (§ 5.8, § 7.1) ----------------------------------------------
  [
    'PROPOSITION_MONTREE',
    ({ proposition }) =>
      `La proposition n° ${proposition} se montre en vue seule : seul le placement retenu se modifie.`,
  ],
  [
    'SIEGE_OCCUPE',
    ({ siege, tour }) => `Le siège ${siege} est occupé au tour ${tour} : déposer la personne sur l'autre les échange.`,
  ],
  ['TABLE_PLEINE', ({ capacite, tour }) => `La table est pleine au tour ${tour} : ses ${capacite} places sont occupées.`],
  [
    'RESERVATION_TOUS_LES_TOURS',
    () =>
      'Cette personne est réservée ici pour tous les tours : la retirer de cette table pour un seul tour ne retire pas sa réservation. ' +
      '« Retirer la réservation » la retire de tous les tours.',
  ],
  [
    'RESERVATION_CE_TOUR',
    ({ tour }) =>
      `Cette personne est réservée ici au tour ${tour} : le placement retenu l'y assied tant que sa réservation tient. ` +
      '« Retirer la réservation » retire celle de ce tour seulement.',
  ],

  // --- Les libellés figés du journal (§ 8.2) ---------------------------------
  [
    'ENTREE_RESERVER',
    ({ personne, numero, siege, ...reservation }) =>
      `Réservé ${personne} à la table ${numero}${siege === null ? '' : `, siège ${siege}`}, ${portee(reservation)}`,
  ],
  [
    'ENTREE_RETIRER_RESERVATION',
    ({ personne, numero, ...reservation }) => `Réservation retirée : ${personne}, table ${numero}, ${portee(reservation)}`,
  ],
  [
    'ENTREE_DEPLACER_RESERVATION',
    ({ personne, de, vers, siege, ...reservation }) =>
      `Réservation déplacée : ${personne}, de la table ${de} à la table ${vers}` +
      `${siege === null ? '' : `, siège ${siege}`}, ${portee(reservation)}`,
  ],
  [
    'ENTREE_POSER_TITRE',
    ({ libelle, numero, siege }) => `Posé le titre ${cite(libelle)} à la table ${numero}, siège ${siege}`,
  ],
  [
    'ENTREE_RETIRER_TITRE',
    ({ libelle, numero, siege }) => `Retiré le titre ${cite(libelle)} de la table ${numero}, siège ${siege}`,
  ],
  [
    'ENTREE_DESIGNER',
    ({ personne, numero, siege, libelle }) => `Désigné ${personne} à la table ${numero}, siège ${siege} : ${cite(libelle)}`,
  ],
  [
    'ENTREE_CONVERTIR_EN_TOUS',
    ({ personne, numero }) => `Converti en ${cite('tous les tours')} : ${personne}, table ${numero}`,
  ],
  [
    'ENTREE_DEPLACER_DANS_RETENU',
    // siege n'est donné que pour un déplacement dans la même table.
    ({ personne, de, vers, siege, tour }) =>
      siege !== null
        ? `Déplacé ${personne} au siège ${siege} de la table ${vers}, tour ${tour}`
        : `Déplacé ${personne} de la ${lieu(de)} à la table ${vers}, tour ${tour}`,
  ],
  [
    'ENTREE_ECHANGER_DANS_RETENU',
    ({ a, deA, b, deB, tour }) => `Échangé ${a} (${lieu(deA)}) et ${b} (${lieu(deB)}), tour ${tour}`,
  ],
  [
    'ENTREE_RETIRER_DU_TOUR',
    ({ personne, numero, tour }) =>
      numero === null ? `Retiré ${personne} du tour ${tour}` : `Retiré ${personne} de la table ${numero}, tour ${tour}`,
  ],

  // --- Les libellés de l'application ----------------------------------------
  // Le libellé de titre proposé à la désignation quand rien d'autre ne le
  // suggère : il devient une donnée du fichier, en français (§ 8.2).
  ['places.titreParDefaut', 'animateur'],
]);
