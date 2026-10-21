// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes des commandes de la liste des participants, de leurs
// étiquettes, de leurs conflits d'organisation, de leur présence par tour et
// de l'import des participants (§ 4, § 4.4, § 4.5, § 5.8, § 10.2, § 14.6) : leurs refus, leurs avertissements
// et leurs libellés figés. Une personne s'y dit au féminin ; les tours se
// nomment par toursNommes et auxToursNommes (aides.js). Cette
// table ne porte que des codes. Un champ ou une raison inconnus lèvent
// RangeError, au lieu de se taire. Les bornes d'une étiquette viennent de la
// règle qui les pose.
import { ETIQUETTES_MAX, ETIQUETTE_LONGUEUR_MAX } from '../../stockage/etiquettes.js';
import { auxToursNommes, cite, compte, enumeration, nomDans, toursNommes } from './aides.js';

// Les champs d'un participant qu'une saisie modifie, dans l'ordre du fichier.
const NOMS_DES_CHAMPS = new Map([
  ['nom', 'nom'],
  ['prenom', 'prénom'],
  ['organisation', 'organisation'],
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

// Ce qu'un libellé du journal ajoute quand le geste a ajusté le retenu.
const ajusteTexte = (ajuste) => (ajuste === true ? ' ; placement retenu ajusté' : '');

// Ce qu'un libellé du journal ajoute quand les listes de conflits ont suivi
// le geste (suivreOrganisations) : l'organisation renommée, celles qui ont
// disparu, les propres organisations ôtées ; rien sans suivi.
function conflitsTexte(conflits) {
  if (conflits === null || conflits === undefined) return '';
  const { renommee, retirees, propres } = conflits;
  const parties = [];
  if (renommee !== null) parties.push(`${cite(renommee.de)} devient ${cite(renommee.vers)} dans les conflits`);
  if (retirees.length > 0) {
    parties.push(`${enumeration(retirees.map(cite))} ${retirees.length === 1 ? 'quitte' : 'quittent'} les conflits`);
  }
  if (propres > 0) {
    parties.push(`${compte(propres, 'conflit avec sa propre organisation retiré', 'conflits avec leur propre organisation retirés')}`);
  }
  return parties.map((partie) => ` ; ${partie}`).join('');
}

// Des tours nommés après « au lieu » : « de tous les tours », « du tour 2 »,
// « des tours 1 et 3 ».
const auLieuDe = (tours) => {
  if (tours === null) return 'de tous les tours';
  return `${tours.length === 1 ? 'du' : 'des'} ${toursNommes(tours)}`;
};

// Ce que le retenu fait d'une personne dont la présence change : retirée
// des tours qu'elle perd, mise en réserve à ceux qu'elle gagne ; rien
// quand il ne bouge pas.
function dansLeRetenu(retiree, enReserve) {
  const parties = [];
  if (retiree.length > 0) parties.push(`retirée du placement retenu ${auxToursNommes(retiree)}`);
  if (enReserve.length > 0) parties.push(`mise en réserve ${auxToursNommes(enReserve)}`);
  return parties.length > 0 ? ` ; ${parties.join(', ')}` : '';
}

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
    'ORGANISATION_INCONNUE',
    ({ organisation }) => `L'organisation ${cite(organisation)} n'existe pas : aucune personne de l'événement ne la porte.`,
  ],
  [
    'CONFLIT_PROPRE_ORGANISATION',
    ({ personne, organisation }) =>
      `${personne} appartient à ${cite(organisation)} : une organisation n'est pas en conflit avec elle-même.`,
  ],
  [
    'IMPORT_EN_RETENU',
    () =>
      "L'import change la liste après le choix d'un placement : le placement retenu suit la présence de chacun, " +
      "les arrivées en réserve et les départs laissant leur chaise vide, sans que personne d'autre n'y change de place ; " +
      "à vous de juger s'il convient encore.",
  ],

  // --- La présence par tour (§ 4, § 5.8, § 9) -------------------------------
  [
    'RESERVATIONS_SUSPENDUES_AUX_TOURS',
    ({ personne, reservations, tours, titres }) =>
      `Absence de ${personne} ${auxToursNommes(tours)} : ` +
      `${compte(reservations, 'réservation suspendue', 'réservations suspendues')}, ` +
      `${reservations <= 1 ? 'sa place y revient' : 'ses places y reviennent'} aux autres` +
      `${titresDe(titres, "n'y est plus pourvu", "n'y sont plus pourvus")}.`,
  ],
  [
    'RESERVATIONS_RETABLIES_AUX_TOURS',
    ({ personne, reservations, tours, titres }) =>
      `Présence de ${personne} ${auxToursNommes(tours)} : ` +
      `${compte(reservations, 'réservation rétablie', 'réservations rétablies')}` +
      `${titresDe(titres, 'de nouveau pourvu', 'de nouveau pourvus')}.`,
  ],
  [
    'A_PLACER_DANS_LE_RETENU',
    ({ personne, tours, tousLesTours }) =>
      `${personne} attend en réserve du placement retenu ${auxToursNommes(tours)} : ` +
      'à placer à la main, ou par une proposition dérivée.' +
      (tousLesTours === true ? ' Si elle arrive en cours de soirée, dire à quels tours elle est présente.' : ''),
  ],
  [
    'RENCONTRES_RETIREES_DU_RETENU',
    ({ personne, tours }) =>
      `${personne} était assise ${auxToursNommes(tours)} du placement retenu : ses rencontres de ces tours ` +
      `n'y comptent plus. Pour les garder, défaire, puis la dire présente ${auxToursNommes(tours)} seulement.`,
  ],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['ENTREE_AJOUTER_PARTICIPANT', ({ personne, ajuste }) => `Ajouté ${personne}${ajusteTexte(ajuste)}`],
  [
    'ENTREE_MODIFIER_PARTICIPANT',
    ({ personne, champs, devenu, conflits }) => {
      const nouveau = devenu === null || devenu === undefined ? '' : ` (désormais ${devenu})`;
      return `Modifié ${personne} : ${champs.map(nomChamp).join(', ')}${nouveau}${conflitsTexte(conflits)}`;
    },
  ],
  ['ENTREE_EXCLURE_PARTICIPANT', ({ personne, ajuste }) => `Exclu ${personne}${ajusteTexte(ajuste)}`],
  ['ENTREE_REINTEGRER_PARTICIPANT', ({ personne, ajuste }) => `Réintégré ${personne}${ajusteTexte(ajuste)}`],
  [
    'ENTREE_SUPPRIMER_PARTICIPANT',
    ({ personne, ajuste, conflits }) => `Supprimé ${personne}${ajusteTexte(ajuste)}${conflitsTexte(conflits)}`,
  ],
  [
    'ENTREE_CHANGER_ETIQUETTES',
    ({ personne, ajoutees, retirees }) => {
      const parties = [];
      if (ajoutees.length > 0) parties.push(`ajouté ${etiquettesCitees(ajoutees)}`);
      if (retirees.length > 0) parties.push(`retiré ${etiquettesCitees(retirees)}`);
      return `Étiquettes de ${personne} : ${parties.join(' ; ')}`;
    },
  ],
  ['ENTREE_AJOUTER_CONFLIT', ({ personne, organisation }) => `Conflits de ${personne} : ajouté ${cite(organisation)}`],
  ['ENTREE_RETIRER_CONFLIT', ({ personne, organisation }) => `Conflits de ${personne} : retiré ${cite(organisation)}`],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    ({ mode, ajoutes, misAJour, retires, ajuste, conflits }) => {
      const ajoutesTexte = compte(ajoutes, 'ajouté', 'ajoutés');
      const suite = `${ajusteTexte(ajuste)}${conflitsTexte(conflits)}`;
      if (mode === 'ajouter') return `Importé ${compte(ajoutes, 'participant', 'participants')}${suite}`;
      if (mode === 'mettreAJour') {
        return `Mis à jour la liste par import : ${ajoutesTexte}, ${compte(misAJour, 'modifié', 'modifiés')}${suite}`;
      }
      if (mode === 'remplacer') {
        return `Remplacé la liste par import : ${compte(retires, 'retiré', 'retirés')}, ${ajoutesTexte}${suite}`;
      }
      throw new RangeError(`libelle : mode d'import inconnu ${JSON.stringify(mode)}`);
    },
  ],
  [
    'ENTREE_CHANGER_PRESENCE',
    ({ personne, tours, avant, retiree, enReserve }) =>
      `Présence de ${personne} : ${toursNommes(tours)}, au lieu ${auLieuDe(avant)}${dansLeRetenu(retiree, enReserve)}`,
  ],
]);
