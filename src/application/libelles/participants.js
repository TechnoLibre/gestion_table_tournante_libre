// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes des commandes de la liste des participants, de leurs
// étiquettes, de leurs conflits d'organisation, de leurs inclusions, de leur
// logo, de leur présence par tour et de l'import des participants (§ 4,
// § 4.4, § 4.5, § 5.8, § 8.9, § 10.2, § 14.6) : leurs refus, leurs
// avertissements et leurs libellés figés. Une personne s'y dit au féminin ;
// les tours se nomment par toursNommes et auxToursNommes (aides.js). Cette
// table ne porte que des codes. Un champ ou une raison inconnus lèvent
// RangeError, au lieu de se taire. Les bornes d'une étiquette viennent de la
// règle qui les pose.
import { ETIQUETTES_MAX, ETIQUETTE_LONGUEUR_MAX } from '../../stockage/etiquettes.js';
import { auxToursNommes, cite, compte, enumeration, nomDans, ouEcrire, toursNommes } from './aides.js';

// Les champs d'un participant qu'une saisie modifie, dans l'ordre du fichier.
const NOMS_DES_CHAMPS = new Map([
  ['nom', 'nom'],
  ['prenom', 'prénom'],
  ['organisation', 'organisation'],
  ['courriel', 'courriel'],
  ['titrePressenti', 'titre pressenti'],
  ['notes', 'notes'],
  ['animationReservee', 'animation réservée'],
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

// Ce qu'un libellé du journal ajoute quand des listes ont suivi le geste
// (suivreOrganisations) : l'organisation renommée, celles qui ont disparu,
// toutes deux rapportées aux listes que nomme listes (« les conflits »),
// puis le compte des propres organisations ôtées, sous ses mots au singulier
// et au pluriel ; rien sans suivi.
function suiviTexte(suivi, listes, propresSingulier, propresPluriel) {
  if (suivi === null || suivi === undefined) return '';
  const { renommee, retirees, propres } = suivi;
  const parties = [];
  if (renommee !== null) parties.push(`${cite(renommee.de)} devient ${cite(renommee.vers)} dans ${listes}`);
  if (retirees.length > 0) {
    parties.push(`${enumeration(retirees.map(cite))} ${retirees.length === 1 ? 'quitte' : 'quittent'} ${listes}`);
  }
  if (propres > 0) parties.push(compte(propres, propresSingulier, propresPluriel));
  return parties.map((partie) => ` ; ${partie}`).join('');
}

// Ce que les listes de conflits ont suivi.
const conflitsTexte = (conflits) =>
  suiviTexte(conflits, 'les conflits', 'conflit avec sa propre organisation retiré', 'conflits avec leur propre organisation retirés');

// Ce que les listes d'inclusions d'organisation ont suivi.
const inclusionsTexte = (inclusions) =>
  suiviTexte(
    inclusions,
    'les inclusions',
    'inclusion de sa propre organisation retirée',
    'inclusions de leur propre organisation retirées',
  );

// Ce qu'un libellé du journal ajoute quand la personne supprimée quitte des
// listes d'inclusions de participant ; rien quand aucune ne la nommait.
const listesDInclusionsTexte = (n) =>
  Number.isInteger(n) && n > 0 ? ` ; retirée de ${compte(n, "liste d'inclusions", "listes d'inclusions")}` : '';

// Les ajouts et les retraits d'une liste, nommés par nommer : « ajouté … ;
// retiré … », chaque partie présente quand sa liste n'est pas vide.
function ajoutsEtRetraits(ajoutees, retirees, nommer) {
  const parties = [];
  if (ajoutees.length > 0) parties.push(`ajouté ${nommer(ajoutees)}`);
  if (retirees.length > 0) parties.push(`retiré ${nommer(retirees)}`);
  return parties.join(' ; ');
}

// Des tours nommés après « au lieu » : « de tous les tours », « du tour 2 »,
// « des tours 1 et 3 ».
const auLieuDe = (tours, nomsTours) => {
  if (tours === null) return 'de tous les tours';
  return `${tours.length === 1 ? 'du' : 'des'} ${toursNommes(tours, nomsTours)}`;
};

// Ce que le retenu fait d'une personne dont la présence change : retirée
// des tours qu'elle perd, mise en réserve à ceux qu'elle gagne ; rien
// quand il ne bouge pas. Les tours se nomment sous nomsTours (aides.js).
function dansLeRetenu(retiree, enReserve, nomsTours) {
  const parties = [];
  if (retiree.length > 0) parties.push(`retirée du placement retenu ${auxToursNommes(retiree, nomsTours)}`);
  if (enReserve.length > 0) parties.push(`mise en réserve ${auxToursNommes(enReserve, nomsTours)}`);
  return parties.length > 0 ? ` ; ${parties.join(', ')}` : '';
}

// Ce que changerLogo fait du logo d'une personne, d'après celui d'avant et
// celui d'après : les trois libellés figés de son entrée.
const EFFETS_DU_LOGO = new Map([
  ['pose', 'posé'],
  ['remplace', 'remplacé'],
  ['retire', 'retiré'],
]);

// Un nombre de pixels : en millions quand il en compte un nombre entier.
const pixels = (n) => (n % 1_000_000 === 0 ? `${n / 1_000_000} millions de pixels` : `${n} pixels`);

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
    'INCLUSION_PROPRE_ORGANISATION',
    ({ personne, organisation }) =>
      `${personne} appartient à ${cite(organisation)} : une inclusion nomme une autre organisation que la sienne.`,
  ],
  ['INCLUSION_DE_SOI', ({ personne }) => `${personne} ne se rencontre pas elle-même : une inclusion nomme une autre personne.`],
  [
    'IMPORT_EN_RETENU',
    () =>
      "L'import change la liste après le choix d'un placement : le placement retenu suit la présence de chacun, " +
      "les arrivées en réserve et les départs laissant leur chaise vide, sans que personne d'autre n'y change de place ; " +
      "à vous de juger s'il convient encore.",
  ],

  // --- Le logo d'une personne (§ 8.9) ---------------------------------------
  // L'image refusée par le disque, avant toute entrée : chemin, le fichier
  // relatif au dossier de l'événement ; dossier, ce dossier ; cause, celle
  // que le système donne, ou null.
  [
    'LOGO_NON_ECRIT',
    (details, texte) =>
      `Le logo de ${details.personne} n'a pas pu s'écrire : ${ouEcrire(details, texte)}. ` +
      "Rien n'est enregistré : la personne garde son logo d'avant, ou aucun.",
  ],
  // L'image choisie pour un logo ou pour les badges que la conversion de
  // l'interface refuse (participants/image_logo.js), avant toute écriture :
  // fichier, le nom du fichier choisi ; largeur, hauteur et max, en pixels.
  [
    'LOGO_ILLISIBLE',
    ({ fichier }) =>
      `Le fichier ${cite(fichier)} ne s'ouvre pas comme une image : un logo ou l'image des badges se lit d'un fichier ` +
      "PNG, JPEG, GIF, WebP, AVIF, BMP, ICO ou SVG. Une photo HEIC ou une image TIFF s'exporte d'abord en JPEG ou en PNG.",
  ],
  [
    'LOGO_TROP_GRAND',
    ({ fichier, largeur, hauteur, max }) =>
      `L'image ${cite(fichier)} compte ${largeur} × ${hauteur} pixels, au-delà des ${pixels(max)} qu'accepte un ` +
      "logo ou l'image des badges : elle n'est pas ouverte. Une image réduite, exportée en JPEG ou en PNG, convient.",
  ],

  // --- La présence par tour (§ 4, § 5.8, § 9) -------------------------------
  [
    'RESERVATIONS_SUSPENDUES_AUX_TOURS',
    ({ personne, reservations, tours, titres, nomsTours }) =>
      `Absence de ${personne} ${auxToursNommes(tours, nomsTours)} : ` +
      `${compte(reservations, 'réservation suspendue', 'réservations suspendues')}, ` +
      `${reservations <= 1 ? 'sa place y revient' : 'ses places y reviennent'} aux autres` +
      `${titresDe(titres, "n'y est plus pourvu", "n'y sont plus pourvus")}.`,
  ],
  [
    'RESERVATIONS_RETABLIES_AUX_TOURS',
    ({ personne, reservations, tours, titres, nomsTours }) =>
      `Présence de ${personne} ${auxToursNommes(tours, nomsTours)} : ` +
      `${compte(reservations, 'réservation rétablie', 'réservations rétablies')}` +
      `${titresDe(titres, 'de nouveau pourvu', 'de nouveau pourvus')}.`,
  ],
  [
    'A_PLACER_DANS_LE_RETENU',
    ({ personne, tours, tousLesTours, nomsTours }) =>
      `${personne} attend en réserve du placement retenu ${auxToursNommes(tours, nomsTours)} : ` +
      'à placer à la main, ou par une proposition dérivée.' +
      (tousLesTours === true ? ' Si elle arrive en cours de soirée, dire à quels tours elle est présente.' : ''),
  ],
  [
    'RENCONTRES_RETIREES_DU_RETENU',
    ({ personne, tours, nomsTours }) =>
      `${personne} était assise ${auxToursNommes(tours, nomsTours)} du placement retenu : ses rencontres de ces tours ` +
      `n'y comptent plus. Pour les garder, défaire, puis la dire présente ${auxToursNommes(tours, nomsTours)} seulement.`,
  ],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['ENTREE_AJOUTER_PARTICIPANT', ({ personne, ajuste }) => `Ajouté ${personne}${ajusteTexte(ajuste)}`],
  [
    'ENTREE_MODIFIER_PARTICIPANT',
    ({ personne, champs, devenu, conflits, inclusions }) => {
      const nouveau = devenu === null || devenu === undefined ? '' : ` (désormais ${devenu})`;
      const suivis = `${conflitsTexte(conflits)}${inclusionsTexte(inclusions)}`;
      return `Modifié ${personne} : ${champs.map(nomChamp).join(', ')}${nouveau}${suivis}`;
    },
  ],
  ['ENTREE_EXCLURE_PARTICIPANT', ({ personne, ajuste }) => `Exclu ${personne}${ajusteTexte(ajuste)}`],
  ['ENTREE_REINTEGRER_PARTICIPANT', ({ personne, ajuste }) => `Réintégré ${personne}${ajusteTexte(ajuste)}`],
  [
    'ENTREE_SUPPRIMER_PARTICIPANT',
    ({ personne, ajuste, conflits, inclusions, listesDInclusions }) =>
      `Supprimé ${personne}${ajusteTexte(ajuste)}${conflitsTexte(conflits)}${inclusionsTexte(inclusions)}` +
      listesDInclusionsTexte(listesDInclusions),
  ],
  [
    'ENTREE_CHANGER_ETIQUETTES',
    ({ personne, ajoutees, retirees }) => `Étiquettes de ${personne} : ${ajoutsEtRetraits(ajoutees, retirees, etiquettesCitees)}`,
  ],
  ['ENTREE_AJOUTER_CONFLIT', ({ personne, organisation }) => `Conflits de ${personne} : ajouté ${cite(organisation)}`],
  ['ENTREE_RETIRER_CONFLIT', ({ personne, organisation }) => `Conflits de ${personne} : retiré ${cite(organisation)}`],
  [
    'ENTREE_CHANGER_CONFLITS',
    ({ personne, ajoutees, retirees }) => `Conflits de ${personne} : ${ajoutsEtRetraits(ajoutees, retirees, etiquettesCitees)}`,
  ],
  [
    'ENTREE_CHANGER_INCLUSIONS_ORGANISATION',
    ({ personne, ajoutees, retirees }) =>
      `Inclusions d'organisation de ${personne} : ${ajoutsEtRetraits(ajoutees, retirees, etiquettesCitees)}`,
  ],
  [
    'ENTREE_CHANGER_INCLUSIONS_PARTICIPANT',
    ({ personne, ajoutees, retirees }) =>
      `Inclusions de participant de ${personne} : ${ajoutsEtRetraits(ajoutees, retirees, enumeration)}`,
  ],
  // organisations et participants : les ajouts et les retraits de chaque
  // liste qui change, null pour une liste qui ne change pas. Une seule liste
  // qui change s'écrit comme dans le libellé de sa commande propre ; les
  // deux, la seconde suit la première sous « inclusions de participant ».
  [
    'ENTREE_CHANGER_INCLUSIONS',
    ({ personne, organisations, participants }) => {
      const parOrganisation = organisations === null ? null : ajoutsEtRetraits(organisations.ajoutees, organisations.retirees, etiquettesCitees);
      const parParticipant = participants === null ? null : ajoutsEtRetraits(participants.ajoutees, participants.retirees, enumeration);
      if (parOrganisation === null) return `Inclusions de participant de ${personne} : ${parParticipant}`;
      const suite = parParticipant === null ? '' : ` ; inclusions de participant : ${parParticipant}`;
      return `Inclusions d'organisation de ${personne} : ${parOrganisation}${suite}`;
    },
  ],
  [
    'ENTREE_CHANGER_LOGO',
    ({ personne, effet }) => `Logo de ${personne} : ${nomDans(EFFETS_DU_LOGO, effet, 'effet du logo')}`,
  ],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    ({ mode, ajoutes, misAJour, retires, ajuste, conflits, inclusions }) => {
      const ajoutesTexte = compte(ajoutes, 'ajouté', 'ajoutés');
      const suite = `${ajusteTexte(ajuste)}${conflitsTexte(conflits)}${inclusionsTexte(inclusions)}`;
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
    ({ personne, tours, avant, retiree, enReserve, nomsTours }) =>
      `Présence de ${personne} : ${toursNommes(tours, nomsTours)}, au lieu ${auLieuDe(avant, nomsTours)}` +
      dansLeRetenu(retiree, enReserve, nomsTours),
  ],
]);
