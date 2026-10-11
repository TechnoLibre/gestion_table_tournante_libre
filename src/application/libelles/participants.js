// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes de la liste des participants, de leurs
// étiquettes et de l'import des participants (§ 4.4, § 4.5, § 10.2,
// § 14.6) : leurs refus, leurs avertissements et leurs libellés figés. Cette
// table ne porte que des codes. Un champ ou une raison inconnus lèvent
// RangeError, au lieu de se taire. Les bornes d'une étiquette viennent de la
// règle qui les pose.
import { ETIQUETTES_MAX, ETIQUETTE_LONGUEUR_MAX } from '../../stockage/etiquettes.js';
import { cite, compte, enumeration, nomDans } from './aides.js';

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

// Ce qui rend fautive une étiquette saisie (§ 4.5), raison de
// lireEtiquettes ou saisie vide.
const RAISONS_D_ETIQUETTE = new Map([
  ['vide', () => 'La saisie ne donne aucune étiquette'],
  ['controle', (valeur) => `${cite(valeur)} porte un caractère invisible ou de contrôle, tabulation comprise`],
  ['longueur', (valeur) => `${cite(valeur)} dépasse ${ETIQUETTE_LONGUEUR_MAX} caractères`],
]);

// Des étiquettes citées et énumérées.
const etiquettesCitees = (etiquettes) => enumeration(etiquettes.map(cite));

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
    'ETIQUETTE_INVALIDE',
    ({ valeur, raison }) =>
      `${nomDans(RAISONS_D_ETIQUETTE, raison, "raison d'étiquette")(valeur)} : une étiquette compte de 1 à ` +
      `${ETIQUETTE_LONGUEUR_MAX} caractères visibles, et la virgule, le point-virgule et la barre verticale ` +
      'séparent deux étiquettes.',
  ],
  [
    'ETIQUETTES_EN_TROP',
    ({ nombre }) =>
      `Une personne ou un objectif de table porte au plus ${ETIQUETTES_MAX} étiquettes ; ` +
      `celles-ci en feraient ${nombre}.`,
  ],
  [
    'ORTHOGRAPHE_RETENUE',
    ({ saisie, retenue }) =>
      `${cite(saisie)} est enregistrée sous l'orthographe que l'événement porte déjà : ${cite(retenue)}.`,
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
    'ENTREE_CHANGER_ETIQUETTES',
    ({ personne, ajoutees, retirees }) => {
      const parties = [];
      if (ajoutees.length > 0) parties.push(`ajouté ${etiquettesCitees(ajoutees)}`);
      if (retirees.length > 0) parties.push(`retiré ${etiquettesCitees(retirees)}`);
      return `Étiquettes de ${personne} : ${parties.join(' ; ')}`;
    },
  ],
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
