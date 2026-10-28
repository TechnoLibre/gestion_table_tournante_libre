// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes des commandes des places — réservations, titres, pose (§ 5.8,
// § 5.9, § 8.2, § 14.6) : leurs refus, leurs signaux, leurs libellés figés,
// et le libellé de titre proposé à la désignation. Les détails désignent
// tables et personnes par identifiant : un refus se pose sur la place qu'il
// concerne (§ 5.9), et son texte ne les nomme pas, sauf la personne absente
// au tour, que son refus nomme par son nom affiché. Un libellé figé reçoit le
// nom affiché et le numéro de table que la commande lit dans la charge.
// SURRESERVATION garde le texte du moteur (libelles/moteur.js), et
// INVARIANT_VIOLE celui de la séance (libelles/seance.js). Un tour se nomme
// sous nomsTours, les noms des tours de l'événement (aides.js) : la
// commande les donne à un libellé figé, l'écran à un refus.
import { cite, tourDansPhrase, tourOuNom } from './aides.js';

// La portée d'une réservation dans un libellé figé.
const portee = ({ portee: genre, tour, nomsTours }) => (genre === 'tous' ? 'tous les tours' : tourOuNom(tour, nomsTours));

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
    ({ tour, nomsTours }) => `Cette personne a déjà une place au ${tourDansPhrase(tour, nomsTours)} : elle n'en occupe qu'une par tour.`,
  ],
  ['PERSONNE_EXCLUE', () => "Cette personne est exclue : elle n'est placée nulle part tant qu'elle n'est pas réintégrée."],
  // PERSONNE_ABSENTE_AU_TOUR {participant, personne, tour} : une réservation
  // de tour désigné, ou un dépôt dans le retenu, à un tour d'absence.
  [
    'PERSONNE_ABSENTE_AU_TOUR',
    ({ personne, tour, nomsTours }) =>
      `${personne} est absente au ${tourDansPhrase(tour, nomsTours)} : la marquer présente à ce tour avant de l'y placer.`,
  ],
  [
    'PLACE_RESERVEE',
    ({ siege, tour, portee: genre, nomsTours }) =>
      `Le siège ${siege} est réservé à une autre personne ${genre === 'tous' ? 'à tous les tours' : `au ${tourDansPhrase(tour, nomsTours)}`} : ` +
      'déplacer sa réservation libère la place.',
  ],
  [
    'RESERVEE_AILLEURS',
    ({ tour, nomsTours }) =>
      `Cette personne est réservée à une autre place au ${tourDansPhrase(tour, nomsTours)} : sa réservation se déplace d'abord.`,
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

  // --- Les animateurs (§ 2.1 étape 6) ---------------------------------------
  // ABSENT_AU_TOUR {participant, personne, tour} : la cause du refus d'une
  // personne d'un lot de designerAnimateurs qui n'est pas présente à chaque
  // tour, tour son premier tour d'absence.
  [
    'ABSENT_AU_TOUR',
    ({ tour, nomsTours }) =>
      `Cette personne n'est pas présente au ${tourDansPhrase(tour, nomsTours)} : ` +
      "une table ne s'anime que par une personne présente à tous les tours.",
  ],
  // ANIMATEUR_REFUSE {participant, personne, refus: {code, details}} : le
  // refus d'une personne d'un lot de designerAnimateurs, que son nom affiché
  // nomme, suivi du texte de sa cause, à qui passent les noms des tours que
  // le refus reçoit.
  [
    'ANIMATEUR_REFUSE',
    ({ personne, refus, nomsTours }, texte) =>
      `Refus pour ${personne}, aucun animateur n'est désigné. ${texte(refus.code, { nomsTours, ...refus.details })}`,
  ],

  // --- Le retenu (§ 5.8, § 7.1) ----------------------------------------------
  [
    'PROPOSITION_MONTREE',
    ({ proposition }) =>
      `La proposition n° ${proposition} se montre en vue seule : seul le placement retenu se modifie.`,
  ],
  [
    'SIEGE_OCCUPE',
    ({ siege, tour, nomsTours }) => `Le siège ${siege} est occupé au ${tourDansPhrase(tour, nomsTours)} : déposer la personne sur l'autre les échange.`,
  ],
  [
    'TABLE_PLEINE',
    ({ capacite, tour, nomsTours }) => `La table est pleine au ${tourDansPhrase(tour, nomsTours)} : ses ${capacite} places sont occupées.`,
  ],
  [
    'RESERVATION_TOUS_LES_TOURS',
    () =>
      'Cette personne est réservée ici pour tous les tours : la retirer de cette table pour un seul tour ne retire pas sa réservation. ' +
      '« Retirer la réservation » la retire de tous les tours.',
  ],
  [
    'RESERVATION_CE_TOUR',
    ({ tour, nomsTours }) =>
      `Cette personne est réservée ici au ${tourDansPhrase(tour, nomsTours)} : le placement retenu l'y assied tant que sa réservation tient. ` +
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
    'ENTREE_DESIGNER_ANIMATEURS',
    ({ numero, personnes }) =>
      `Désigné ${personnes.length} ${personnes.length === 1 ? 'animateur' : 'animateurs'} à la table ${numero} : ` +
      personnes.join(', '),
  ],
  [
    'ENTREE_RETIRER_ANIMATEUR',
    ({ personne, numero }) => `Retiré l'animateur ${personne} de la table ${numero}`,
  ],
  [
    'ENTREE_CONVERTIR_EN_TOUS',
    ({ personne, numero }) => `Converti en ${cite('tous les tours')} : ${personne}, table ${numero}`,
  ],
  [
    'ENTREE_DEPLACER_DANS_RETENU',
    // siege n'est donné que pour un déplacement dans la même table.
    ({ personne, de, vers, siege, tour, nomsTours }) =>
      siege !== null
        ? `Déplacé ${personne} au siège ${siege} de la table ${vers}, ${tourOuNom(tour, nomsTours)}`
        : `Déplacé ${personne} de la ${lieu(de)} à la table ${vers}, ${tourOuNom(tour, nomsTours)}`,
  ],
  [
    'ENTREE_ECHANGER_DANS_RETENU',
    ({ a, deA, b, deB, tour, nomsTours }) => `Échangé ${a} (${lieu(deA)}) et ${b} (${lieu(deB)}), ${tourOuNom(tour, nomsTours)}`,
  ],
  [
    'ENTREE_RETIRER_DU_TOUR',
    ({ personne, numero, tour, nomsTours }) =>
      numero === null
        ? `Retiré ${personne} du ${tourDansPhrase(tour, nomsTours)}`
        : `Retiré ${personne} de la table ${numero}, ${tourOuNom(tour, nomsTours)}`,
  ],

  // --- Les libellés de l'application ----------------------------------------
  // Le libellé de titre proposé à la désignation quand rien d'autre ne le
  // suggère : il devient une donnée du fichier, en français (§ 8.2).
  ['places.titreParDefaut', 'animateur'],
]);
