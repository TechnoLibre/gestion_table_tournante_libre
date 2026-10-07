// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de la liste des participants : grille, formulaire, fiche (§
// 14.6). Chaque clé commence par « participants. ».
//
// participants.colonne.* nomme chaque colonne de COLONNES (grille.js), dans
// l'en-tête de la grille, l'étiquette d'un champ du formulaire et celle
// d'une valeur de la fiche ; participants.statut.* nomme chaque statut
// calculé (§ 4.2), par cleDeStatut.

// Un nombre suivi de son nom, au singulier pour 0 et 1.
const compte = (n, singulier, pluriel) => `${n} ${n <= 1 ? singulier : pluriel}`;

// La portée d'une réservation : tous les tours, ou le tour désigné.
const portee = ({ portee: genre, tour }) => (genre === 'tous' ? 'tous les tours' : `tour ${tour}`);

export const TABLE = new Map([
  // --- Les colonnes, que la grille, le formulaire et la fiche partagent ------
  ['participants.colonne.nom', 'Nom'],
  ['participants.colonne.prenom', 'Prénom'],
  ['participants.colonne.appartenance', 'Appartenance'],
  ['participants.colonne.courriel', 'Courriel'],
  ['participants.colonne.titrePressenti', 'Titre pressenti'],
  ['participants.colonne.exclu', 'Exclusion'],
  ['participants.colonne.notes', 'Notes'],

  // --- Le formulaire d'ajout (§ 10.2) ---------------------------------------
  ['participants.formulaire.titre', 'Ajouter une personne'],
  ['participants.formulaire.ajouter', 'Ajouter'],
  ['participants.formulaire.orthographe', 'Cette appartenance existe déjà sous l\u{2019}orthographe'],
  ['participants.formulaire.reprendre', 'Reprendre cette orthographe'],

  // --- La grille (§ 10.2) ---------------------------------------------------
  ['participants.grille.titre', 'Liste des participants'],
  ['participants.grille.filtre', 'Filtrer'],
  [
    'participants.grille.compte',
    ({ total, affiches }) =>
      affiches === total ? compte(total, 'participant', 'participants') : `${affiches} sur ${compte(total, 'participant', 'participants')}`,
  ],
  ['participants.grille.croissant', '(croissant)'],
  ['participants.grille.decroissant', '(décroissant)'],
  ['participants.grille.actions', 'Actions'],
  ['participants.grille.exclue', 'exclue'],
  ['participants.grille.presente', 'présente'],
  ['participants.grille.vide', 'Aucun participant. Ajoutez une personne, ou collez une liste dans la grille.'],
  ['participants.grille.aucunResultat', 'Aucune personne ne correspond au filtre.'],

  // --- Les commandes de la section ------------------------------------------
  ['participants.commande.fiche', 'Fiche'],
  ['participants.commande.exclure', 'Exclure'],
  ['participants.commande.reintegrer', 'Réintégrer'],
  ['participants.commande.supprimer', 'Supprimer'],
  ['participants.commande.exporter', 'Exporter la liste'],
  ['participants.commande.fermerFiche', 'Fermer la fiche'],

  // --- La suppression d'une personne qui porte des réservations (§ 2.1) -----
  ['participants.suppression.titre', ({ personne }) => `Supprimer ${personne} et ses réservations ?`],
  [
    'participants.suppression.reservation',
    (details) =>
      `Réservation à la table ${details.numero}${details.siege === null ? '' : `, siège ${details.siege}`}, ${portee(details)}`,
  ],

  // --- La fiche (§ 4, § 4.2, § 7.4) -----------------------------------------
  ['participants.fiche.titre', 'Fiche de la personne'],
  ['participants.fiche.vide', '\u{2014}'],
  ['participants.fiche.statut', 'Statut'],
  ['participants.fiche.statutExclue', 'exclue : ni placée, ni comptée'],
  ['participants.fiche.statutInconnu', 'non calculé : la configuration est incohérente'],
  ['participants.fiche.reservations', 'Réservations'],
  ['participants.fiche.aucuneReservation', 'Aucune réservation.'],
  ['participants.fiche.suspendues', 'Suspendues tant que la personne est exclue.'],
  ['participants.fiche.table', 'Table'],
  ['participants.fiche.siege', 'Siège'],
  ['participants.fiche.portee', 'Portée'],
  ['participants.fiche.sansSiege', 'sans siège'],
  ['participants.fiche.tousLesTours', 'tous les tours'],
  ['participants.fiche.auTour', 'tour'],
  ['participants.fiche.itineraire', 'Placement retenu, tour par tour'],
  ['participants.fiche.tour', 'Tour'],
  ['participants.fiche.enReserve', 'en réserve'],
  ['participants.fiche.siegeNonAttribue', 'non attribué'],
  ['participants.fiche.aucunRetenu', 'Aucun placement retenu ne la nomme.'],

  // --- Les statuts calculés (§ 4.2) -----------------------------------------
  ['participants.statut.ancre', 'ancré'],
  ['participants.statut.partiel', 'partiellement fixé'],
  ['participants.statut.mobile', 'mobile'],
]);
