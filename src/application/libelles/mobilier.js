// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes du mobilier — tables, sièges, tours, réglages,
// objectifs des tables, ordre des priorités (§ 4, § 4.5, § 5.7, § 6, § 7.1,
// § 8.2, § 14.6) : les refus d'une capacité, d'un nombre de tours, d'un
// objectif, d'un ordre des priorités et d'un mode des objectifs, leurs
// avertissements, les causes d'un siège retiré, les avis des objectifs, le
// nom complet de chaque critère (mobilier.critere.<nom>) et les libellés
// figés du journal. Les détails désignent tables et personnes par
// identifiant : le refus se pose sur la table qu'il concerne, et son texte ne
// les nomme pas. Un libellé figé reçoit le numéro de table que la commande
// lit dans la charge.
import { POIDS_MAX } from '../../moteur/criteres.js';
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
  ['modeObjectifs', "Objectifs des tables, chercher d'abord"],
]);

// Ce que chaque mode des objectifs cherche d'abord (§ 5.3, A8). Le troisième
// se nomme par ce qu'il compare : le libellé que l'écran lui donne est le
// seul emploi admis de son mot (D22).
const NOMS_DES_MODES = new Map([
  ['places', 'le plus de places servies'],
  ['chacun', 'chacun au moins une fois'],
  ['minimum', 'le minimum, puis le total'],
]);
const nomMode = (mode) => nomDans(NOMS_DES_MODES, mode, 'mode des objectifs');

// Le nom complet d'un critère, cité, que lit sa clé mobilier.critere.<nom>.
const nomCritere = (critere, texte) => cite(texte(`mobilier.critere.${critere}`));

// Un palier, compté à partir de 1 pour l'affichage ; les détails le
// portent à partir de 0, comme verifierPriorites.
const numeroDePalier = (palier) => palier + 1;

// Les fautes d'un ordre des priorités (verifierPriorites), chacune sa
// phrase : la cause seule, le critère nommé quand la faute le désigne.
const FAUTES_DE_PRIORITES = new Map([
  ['forme', () => "L'ordre des priorités n'a pas la forme d'une liste de paliers."],
  ['critereInconnu', ({ critere }) => `L'ordre des priorités nomme un critère inconnu, ${cite(String(critere))}.`],
  [
    'critereRepete',
    ({ critere }, texte) => `L'ordre des priorités nomme ${nomCritere(critere, texte)} deux fois : chaque critère y figure une seule fois.`,
  ],
  [
    'critereAbsent',
    ({ critere }, texte) => `L'ordre des priorités omet ${nomCritere(critere, texte)} : chaque critère y figure une fois, coché ou non.`,
  ],
  ['palierVide', ({ palier }) => `Le palier ${numeroDePalier(palier)} de l'ordre des priorités ne porte aucun critère.`],
  [
    'seulASonPalier',
    ({ critere, palier }, texte) =>
      `${nomCritere(critere, texte)} se range seul à son palier : le palier ${numeroDePalier(palier)} ` +
      'ne peut pas le partager avec un autre critère.',
  ],
  [
    'poids',
    ({ critere, palier }, texte) =>
      `Le poids de ${nomCritere(critere, texte)} au palier ${numeroDePalier(palier)} sort des entiers de 1 à ${POIDS_MAX}.`,
  ],
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

// Un nombre écrit à la française : la virgule décimale.
const nombreEcrit = (valeur) => String(valeur).replace('.', ',');

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

  // --- L'ordre des priorités et le mode des objectifs (§ 5.7, § 5.9, A12) ---
  ['PRIORITES_INVALIDES', (details, texte) => nomDans(FAUTES_DE_PRIORITES, details.faute, 'faute de priorités')(details, texte)],
  [
    'POIDS_HORS_DOMAINE',
    ({ valeur }) =>
      `Un poids est un nombre entier de 1 à ${POIDS_MAX}` + (Number.isFinite(valeur) ? ` : ${nombreEcrit(valeur)} ne l'est pas.` : '.'),
  ],
  [
    'OBJECTIFS_PALIER_PARTAGE',
    ({ mode, palier }, texte) =>
      `Le mode ${cite(nomMode(mode))} compare deux valeurs l'une après l'autre : les ` +
      `${cite(texte('mobilier.critere.toursHorsObjectif'))} s'y rangent seuls à leur palier, et partagent le palier ` +
      `${numeroDePalier(palier)}. Les séparer d'abord dans l'ordre des priorités : le mode reste celui d'avant.`,
  ],
  // Le nom complet de chaque critère de l'ordre, tel que l'éditeur l'écrit
  // (§ 5.7) : la phrase de l'ordre nomme, elle, la valeur qui classe
  // (moteur.critere.<nom>).
  ['mobilier.critere.ecartAuPlafondAPrioriMax', 'écart au plafond a priori'],
  ['mobilier.critere.excedentCollisions', 'excédent de collisions'],
  ['mobilier.critere.collisionsCumulees', 'collisions cumulées'],
  ['mobilier.critere.toursHorsObjectif', 'tours hors objectif'],
  ['mobilier.critere.rencontresRepetees', 'rencontres répétées et retours'],
  ['mobilier.critere.animateursNonRencontres', 'animateurs non rencontrés'],
  ['mobilier.critere.redondance', "redondance d'appartenance"],

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
    ({ cle, valeur }) =>
      `${nomDans(NOMS_DES_REGLAGES, cle, 'réglage')} : ${cle === 'modeObjectifs' ? nomMode(valeur) : valeurDeReglage(valeur)}`,
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
  // Le critère déplacé, ou les critères d'un palier déplacé entier, et le
  // palier où il arrive ; ceux qu'il y rejoint, ou son poids quand le geste
  // ne change que lui.
  [
    'ENTREE_CHANGER_PRIORITES',
    ({ criteres, palier, paliers, avec, poids }, texte) => {
      const noms = enumeration(criteres.map((critere) => nomCritere(critere, texte)));
      const ou = `palier ${numeroDePalier(palier)} sur ${paliers}`;
      if (poids !== null) return `Ordre des priorités : ${noms} au poids ${poids}, ${ou}`;
      const compagnons = avec.length > 0 ? `, avec ${enumeration(avec.map((critere) => nomCritere(critere, texte)))}` : '';
      return `Ordre des priorités : ${noms} au ${ou}${compagnons}`;
    },
  ],
  ['ENTREE_RETABLIR_PRIORITES', () => 'Ordre des priorités : ordre par défaut rétabli'],
]);
