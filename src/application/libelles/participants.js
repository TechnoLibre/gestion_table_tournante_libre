// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes de la liste des participants et de l'import
// (§ 4.4, § 10.2, § 14.6) : leurs refus, leurs avertissements et leurs
// libellés figés. Cette table ne porte que des codes. Un champ inconnu lève
// RangeError, au lieu de se taire.
import { compte, nomDans } from './aides.js';

// Les champs d'un participant qu'une saisie modifie, dans l'ordre du fichier.
const NOMS_DES_CHAMPS = new Map([
  ['nom', 'nom'],
  ['prenom', 'prénom'],
  ['appartenance', 'appartenance'],
  ['courriel', 'courriel'],
  ['titrePressenti', 'titre pressenti'],
  ['notes', 'notes'],
]);
const nomChamp = (champ) => nomDans(NOMS_DES_CHAMPS, champ, 'champ');

// Les titres de place qu'un geste sur une personne touche, quand il y en a.
const titresDe = (n, singulier, pluriel) =>
  n > 0 ? `, et ${compte(n, 'titre de place', 'titres de place')} ${n <= 1 ? singulier : pluriel}` : '';

export const TABLE = new Map([
  // --- Les refus et les avertissements des commandes (§ 4.4, § 10.2) ---------
  ['NOM_REQUIS', () => 'Le nom est obligatoire.'],
  ['PARTICIPANT_INCONNU', ({ id }) => `La personne n° ${id} n'est pas dans cet événement.`],
  [
    'RESERVATIONS_SUSPENDUES',
    ({ personne, reservations, titres }) =>
      `Exclusion de ${personne} : ${compte(reservations, 'réservation suspendue', 'réservations suspendues')}, ` +
      `ses places reviennent aux autres${titresDe(titres, "n'est plus pourvu", 'ne sont plus pourvus')}.`,
  ],
  [
    'RESERVATIONS_RETABLIES',
    ({ personne, reservations, titres }) =>
      `Réintégration de ${personne} : ${compte(reservations, 'réservation rétablie', 'réservations rétablies')}` +
      `${titresDe(titres, 'de nouveau pourvu', 'de nouveau pourvus')}.`,
  ],
  [
    'RESERVATIONS_RETIREES',
    ({ personne, reservations, titres }) =>
      `Suppression de ${personne} : ${compte(reservations, 'réservation retirée', 'réservations retirées')}` +
      `${titresDe(titres, "n'est plus pourvu", 'ne sont plus pourvus')}.`,
  ],
  [
    'IMPORT_EN_RETENU',
    () =>
      "L'import change la liste après le choix d'un placement : le placement retenu est gardé tel quel, " +
      "et rien n'est effacé ; à vous de juger s'il convient encore.",
  ],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['ENTREE_AJOUTER_PARTICIPANT', ({ personne }) => `Ajouté ${personne}`],
  [
    'ENTREE_MODIFIER_PARTICIPANT',
    ({ personne, champs, devenu }) => {
      const nouveau = devenu === null || devenu === undefined ? '' : ` (désormais ${devenu})`;
      return `Modifié ${personne} : ${champs.map(nomChamp).join(', ')}${nouveau}`;
    },
  ],
  ['ENTREE_EXCLURE_PARTICIPANT', ({ personne }) => `Exclu ${personne}`],
  ['ENTREE_REINTEGRER_PARTICIPANT', ({ personne }) => `Réintégré ${personne}`],
  ['ENTREE_SUPPRIMER_PARTICIPANT', ({ personne }) => `Supprimé ${personne}`],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    ({ mode, ajoutes, misAJour, retires }) => {
      const ajoutesTexte = compte(ajoutes, 'ajouté', 'ajoutés');
      if (mode === 'ajouter') return `Importé ${compte(ajoutes, 'participant', 'participants')}`;
      if (mode === 'mettreAJour') {
        return `Mis à jour la liste par import : ${ajoutesTexte}, ${compte(misAJour, 'modifié', 'modifiés')}`;
      }
      if (mode === 'remplacer') {
        return `Remplacé la liste par import : ${compte(retires, 'retiré', 'retirés')}, ${ajoutesTexte}`;
      }
      throw new RangeError(`libelle : mode d'import inconnu ${JSON.stringify(mode)}`);
    },
  ],
]);
