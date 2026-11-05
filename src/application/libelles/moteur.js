// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes des codes du moteur qui n'ont pas leur table ailleurs, et les
// libellés de ses critères (§ 5, § 5.7, § 14.6) : les codes d'une
// ErreurConfiguration, ceux des violations de verifierInvariants et de
// verifierIndicateurs ; moteur.critere.<nom> pour chacun des neuf critères
// du registre, le nom que la phrase de l'ordre lui donne sous le défaut ;
// moteur.valeur.<valeur> pour chaque valeur qui classe, le nom que la phrase
// donne à la valeur appliquée — « rencontres répétées », ou « retours » sous
// « nouvelle table » seule ; un critère qui en classe deux les nomme l'une
// après l'autre (A11) — ; moteur.palier.*, les mots d'un palier partagé. Le
// nom complet d'un critère, celui de l'éditeur, est mobilier.critere.<nom>.
// Une violation d'indicateur qui porte sur un total ne désigne personne.
// Un code garde un seul texte : CAPACITE et TOURS, que le moteur lève sous
// deux formes de détails — ErreurConfiguration et violation —, se
// distinguent par les détails qu'ils portent. Une réservation que le moteur
// désigne sans identifiant l'est par son rang à partir de 0, que le texte
// affiche à partir de 1 ; une personne qu'une violation d'indicateur désigne
// par son index se nomme par participant quand l'appelant l'a traduit, par
// son rang sinon ; l'organisation d'un reste négatif, de même, par son
// libellé ou par son rang. INCONNU, aux mêmes détails que la faute de
// placement du stockage, a son texte dans libelles/stockage.js.
// PLACES_MANQUANTES et SURRESERVATION, qu'un refus montre aussi à
// l'opérateur, nomment leurs tours sous nomsTours (aides.js) quand l'écran
// les leur donne ; un défaut du moteur, sans eux, garde le numéro seul.
import { auxToursNommes, capitale, compte, enumeration, nomDans, tourDansPhrase } from './aides.js';

// Les cas d'une table que le plan ne rattache pas à l'instance, par detail.
const CAS_DE_TABLE = new Map([
  ['inconnue', (table) => `Le plan déclare la table d'identifiant ${table}, que l'événement n'a pas.`],
  ['doublon', (table) => `Le plan déclare plus d'une fois la table d'identifiant ${table}.`],
  ['absente', (table) => `Le plan ne déclare pas la table d'identifiant ${table}.`],
]);

// La personne d'une violation d'indicateur : son numéro, ou son rang dans
// la population quand l'appelant ne l'a pas traduit.
const personneDe = ({ index, participant }) =>
  participant === undefined || participant === null ? `la personne de rang ${index + 1}` : `la personne n° ${participant}`;

// L'organisation d'un reste négatif : son libellé quand l'appelant l'a
// traduit, son rang dans les organisations sinon, compté à partir de 0 par
// le moteur.
const organisationDe = ({ groupe, organisation }) =>
  organisation === undefined || organisation === null
    ? `l'organisation de rang ${groupe + 1}`
    : `l'organisation « ${organisation} »`;

// Les manques d'une salle trop petite, tour par tour : les tours d'un même
// manque se nomment ensemble, les manques dans l'ordre de leur premier tour.
// La Map ne sert qu'à retrouver un manque déjà rencontré. Les tours se
// nomment sous nomsTours (aides.js).
function manquesParTour(tours, nomsTours) {
  const toursDe = new Map();
  for (const { tour, manque } of tours) toursDe.set(manque, [...(toursDe.get(manque) ?? []), tour]);
  return enumeration([...toursDe].map(([manque, siens]) => `${compte(manque, 'place', 'places')} ${auxToursNommes(siens, nomsTours)}`));
}

// Un rang de réservation, compté à partir de 0 par le moteur.
const reservationDe = (rang) => `la réservation n° ${rang + 1}`;

// Les fautes d'une liste de priorités (verifierPriorites), par faute.
const FAUTES_DE_PRIORITES = new Map([
  ['forme', "sa forme n'est pas celle d'une liste de paliers"],
  ['critereInconnu', 'elle nomme un critère inconnu'],
  ['critereRepete', 'elle nomme deux fois un même critère'],
  ['critereAbsent', 'elle omet un critère'],
  ['palierVide', 'un palier est vide'],
  ['seulASonPalier', 'un critère qui se range seul partage son palier'],
  ['poids', 'un poids sort des entiers de 1 à 100'],
]);

export const TABLE = new Map([
  // Une salle trop petite : avertissement d'un geste qui fait croître le
  // manque (A2), refus de la génération (A6) ; un seul texte pour les deux.
  // Sans tours, chaque tour manque des mêmes places, et le texte le dit ;
  // tours, que portent les détails dès qu'une présence est partielle, liste
  // chaque tour à manque positif, que le texte nomme.
  [
    'PLACES_MANQUANTES',
    ({ placesManquantes, tours, nomsTours }) =>
      tours === undefined
        ? `Il manque ${compte(placesManquantes, 'place', 'places')} à chaque tour pour asseoir toutes les personnes : ` +
          'ajouter des tables ou des sièges, ou exclure des personnes, rend la génération possible.'
        : `Il manque ${manquesParTour(tours, nomsTours)} pour asseoir les personnes présentes : ` +
          'ajouter des tables ou des sièges, ou changer des présences, rend la génération possible.',
  ],
  [
    'SURRESERVATION',
    ({ table, tour, reservees, capacite, nomsTours }) =>
      `La table d'identifiant ${table} reçoit ${compte(reservees, 'personne réservée', 'personnes réservées')} ` +
      `au ${tourDansPhrase(tour, nomsTours)}, pour ${compte(capacite, 'place', 'places')}.`,
  ],

  // --- La configuration (normaliser, § 4, § 5.2) ------------------------------
  // CAPACITE {table, capacite} : une capacité refusée ; {table, tour} : une
  // liste du plan plus longue que sa table.
  [
    'CAPACITE',
    ({ table, capacite, tour }) =>
      capacite === undefined
        ? `Au tour ${tour}, la table d'identifiant ${table} reçoit plus de personnes qu'elle n'a de places.`
        : `La table d'identifiant ${table} a une capacité de ${capacite} : une table compte au moins 2 places.`,
  ],
  // TOURS {tours} : un nombre de tours refusé ; {} : un plan qui n'a pas un
  // tour par tour de l'événement.
  [
    'TOURS',
    ({ tours }) =>
      tours === undefined
        ? "Le plan ne porte pas autant de tours que l'événement."
        : `Le nombre de tours, ${tours}, n'est pas un entier d'au moins 1.`,
  ],
  ['PARTICIPANT_DOUBLON', ({ participant }) => `La personne n° ${participant} figure plus d'une fois dans la liste.`],
  // PRESENCE_VIDE {participant, personne?} : le moteur ne nomme la personne
  // que par son numéro, la commande par son nom.
  [
    'PRESENCE_TOUR',
    ({ participant, tour }) => `La présence de la personne n° ${participant} désigne le tour ${tour}, que l'événement n'a pas.`,
  ],
  [
    'PRESENCE_VIDE',
    ({ participant, personne }) =>
      `${personne ?? `La personne n° ${participant}`} ne serait présente à aucun tour : ` +
      "pour l'écarter de toute la soirée, l'exclure.",
  ],
  ['TABLE_DOUBLON', ({ table }) => `La table d'identifiant ${table} figure plus d'une fois.`],
  [
    'RESERVATION_INCONNUE',
    ({ reservation, participant, table }) =>
      participant === undefined
        ? `${capitale(reservationDe(reservation))} désigne la table d'identifiant ${table}, que l'événement n'a pas.`
        : `${capitale(reservationDe(reservation))} désigne la personne n° ${participant}, que la liste n'a pas.`,
  ],
  [
    'RESERVATION_TOUR',
    ({ reservation, tour }) => `${capitale(reservationDe(reservation))} désigne le tour ${tour}, que l'événement n'a pas.`,
  ],
  [
    'RESERVATION_CONFLIT',
    ({ participant, tour, tables }) =>
      `La personne n° ${participant} est réservée au tour ${tour} à deux tables, ` +
      `d'identifiants ${tables[0]} et ${tables[1]}.`,
  ],
  [
    'OBJECTIF_INCONNU',
    ({ table }) => `Un objectif désigne la table d'identifiant ${table}, que l'événement n'a pas.`,
  ],
  [
    'OBJECTIF_TOUR',
    ({ table, tour }) => `L'objectif de la table d'identifiant ${table} désigne le tour ${tour}, que l'événement n'a pas.`,
  ],
  // OBJECTIF_CONFLIT {table, tour} : tour null pour deux objectifs de soirée.
  [
    'OBJECTIF_CONFLIT',
    ({ table, tour }) =>
      `La table d'identifiant ${table} porte deux objectifs ${tour === null ? 'pour la soirée' : `pour le tour ${tour}`}.`,
  ],
  [
    'PRIORITES',
    ({ faute, palier }) =>
      `L'ordre des priorités est refusé : ${nomDans(FAUTES_DE_PRIORITES, faute, 'faute de priorités')}` +
      `${palier === undefined ? '' : ` (palier ${palier + 1})`}.`,
  ],
  [
    'ANIMATION_NON_FIXEE',
    ({ participant, tour }) =>
      `La personne n° ${participant} anime au tour ${tour}, où aucune réservation ne la place à une table.`,
  ],
  [
    'ANIMATION_ABSENTE',
    ({ participant, tour }) => `La personne n° ${participant} anime au tour ${tour}, où elle n'est pas présente.`,
  ],
  [
    'ENUMERATION_TROP_GRANDE',
    ({ participant, limite }) =>
      `Le plafond a priori de la personne n° ${participant} demanderait d'énumérer plus de ${limite} itinéraires.`,
  ],

  // --- Le plan confronté à la configuration (indexerPlan) -------------------------
  [
    'PLAN_TOURS',
    ({ attendu, tours, reserves }) =>
      `Le plan porte ${compte(tours, 'tour', 'tours')} et ${compte(reserves, 'réserve', 'réserves')}, ` +
      `pour ${compte(attendu, 'tour', 'tours')} dans l'événement.`,
  ],
  ['PLAN_TABLE_INCONNUE', ({ table }) => `Le plan déclare la table d'identifiant ${table}, que l'événement n'a pas.`],
  ['PLAN_TABLE_DOUBLON', ({ table }) => `Le plan déclare plus d'une fois la table d'identifiant ${table}.`],
  ['PLAN_TABLE_ABSENTE', ({ table }) => `Le plan ne déclare pas la table d'identifiant ${table}.`],
  [
    'PLAN_LISTES',
    ({ tour, listes, tables }) =>
      `Au tour ${tour}, le plan porte ${compte(listes, 'liste', 'listes')} pour ${compte(tables, 'table', 'tables')}.`,
  ],
  ['PLAN_INCONNU', ({ participant, tour }) => `Au tour ${tour}, le plan place la personne n° ${participant}, que la liste n'a pas.`],
  ['PLAN_EXCLU_PLACE', ({ participant, tour }) => `Au tour ${tour}, le plan place la personne n° ${participant}, qui est exclue.`],
  ['PLAN_DOUBLE_PLACE', ({ participant, tour }) => `Au tour ${tour}, le plan place plus d'une fois la personne n° ${participant}.`],
  ['PLAN_NON_ASSIS', ({ participant, tour }) => `Au tour ${tour}, le plan ne place nulle part la personne n° ${participant}.`],
  [
    'PLAN_ABSENT_PLACE',
    ({ participant, tour }) => `Au tour ${tour}, le plan place la personne n° ${participant}, qui n'est pas présente à ce tour.`,
  ],

  // --- Le départ d'une génération dérivée (repartir, regenerer, § 5.7) ------------
  // DEPART_INCOMPATIBLE {tour, table, participant} : la garde du moteur, que
  // les refus du lancement précèdent ; table et participant, chacun null
  // quand l'écart ne le désigne pas.
  [
    'DEPART_INCOMPATIBLE',
    ({ tour, table = null, participant = null }) => {
      const designes = [
        participant === null ? null : `la personne n° ${participant}`,
        table === null ? null : `la table d'identifiant ${table}`,
      ].filter((designe) => designe !== null);
      return `Au tour ${tour}, le plan du départ ne s'assied pas tel quel dans l'événement` +
        `${designes.length === 0 ? '' : ` (${designes.join(', ')})`} : la génération ne part d'aucun autre placement.`;
    },
  ],

  // --- Les violations de verifierInvariants (§ 14.12) -----------------------------
  [
    'TABLE_INCONNUE',
    ({ table, tour, detail }) =>
      detail === 'listes'
        ? `Au tour ${tour}, le plan n'a pas une liste par table déclarée.`
        : nomDans(CAS_DE_TABLE, detail, 'cas de table')(table),
  ],
  ['DOUBLE_PLACE', ({ participant, tour }) => `Au tour ${tour}, la personne n° ${participant} est placée plus d'une fois.`],
  ['EXCLU_PLACE', ({ participant, tour }) => `Au tour ${tour}, la personne n° ${participant} est placée alors qu'elle est exclue.`],
  ['NON_ASSIS', ({ participant, tour }) => `Au tour ${tour}, la personne n° ${participant} n'est assise à aucune table.`],
  [
    'ABSENT_PLACE',
    ({ participant, tour }) => `Au tour ${tour}, la personne n° ${participant} est placée alors qu'elle n'est pas présente à ce tour.`,
  ],
  [
    'RESERVATION',
    ({ participant, table, tour }) =>
      `Au tour ${tour}, la personne n° ${participant}, réservée à la table d'identifiant ${table}, est placée ailleurs.`,
  ],

  // --- Les violations de verifierIndicateurs (§ 12.3) -----------------------------
  [
    'PLAFOND_A_PRIORI',
    (details) => `Le plafond a priori de ${personneDe(details)} dépasse le nombre des autres personnes : le calcul est faux.`,
  ],
  [
    'ORDRE_PLAFONDS',
    (details) => `Le plafond réalisé de ${personneDe(details)} dépasse son plafond a priori : le calcul est faux.`,
  ],
  [
    'PLAFOND_REALISE',
    (details) => `Le plafond réalisé de ${personneDe(details)} dépasse le nombre des autres personnes : le calcul est faux.`,
  ],
  [
    'DEPASSEMENT',
    (details) => `Les rencontres de ${personneDe(details)} dépassent son plafond réalisé : le calcul est faux.`,
  ],
  [
    'TOURS_SERVIS',
    (details) => `Les tours selon l'objectif de ${personneDe(details)} dépassent ses tours possibles : le calcul est faux.`,
  ],
  [
    'TOURS_SERVIS_NON_ASSIS',
    (details) => `Les tours selon l'objectif de ${personneDe(details)} dépassent ses tours assis : le calcul est faux.`,
  ],
  [
    'ANIMATEURS_RENCONTRES',
    (details) => `Les animateurs rencontrés par ${personneDe(details)} dépassent sa borne des animateurs : le calcul est faux.`,
  ],
  ['JAMAIS_SERVIES', () => 'Les personnes jamais servies dépassent les personnes concernées : le calcul est faux.'],
  [
    'HORS_OBJECTIF_MAX',
    () => "Le plus de tours hors objectif d'une personne dépasse le plus de tours possibles : le calcul est faux.",
  ],
  [
    'INCLUSIONS_SATISFAITES',
    (details) =>
      `Les inclusions satisfaites de ${personneDe(details)} dépassent ses inclusions atteignables : le calcul est faux.`,
  ],
  [
    'INCLUSIONS_AVIS',
    () =>
      'Les inclusions non satisfaites ne valent pas les inclusions demandées moins les satisfaites : le calcul est faux.',
  ],
  [
    'RESTE_NEGATIF',
    (details) =>
      `Les collisions cumulées de ${organisationDe(details)} passent sous la part prouvée inévitable : le reste est négatif, le calcul est faux.`,
  ],
  [
    'RESTE_OBJECTIFS_NEGATIF',
    ({ tour }) =>
      `Au tour ${tour}, les tours hors objectif passent sous la part prouvée inévitable : le reste est négatif, le calcul est faux.`,
  ],
  [
    'RESTE_CONFLITS_NEGATIF',
    () =>
      "Les conflits d'organisation passent sous ceux que les réservations imposent : le reste est négatif, le calcul est faux.",
  ],
  [
    'DIVERSITE_RENCONTRES',
    (details) => `Les organisations rencontrées par ${personneDe(details)} dépassent ses rencontres : le calcul est faux.`,
  ],
  [
    'DIVERSITE_AFFILIES',
    (details) =>
      `Les organisations rencontrées par ${personneDe(details)} dépassent les personnes affiliées qu'elle rencontre : le calcul est faux.`,
  ],
  [
    'AFFILIES_PLAFOND',
    (details) =>
      `Les personnes affiliées que rencontre ${personneDe(details)} dépassent son plafond réalisé des affiliés : le calcul est faux.`,
  ],
  [
    'BORNE_DIVERSITE',
    (details) => `Les organisations rencontrées par ${personneDe(details)} dépassent sa borne de diversité : le calcul est faux.`,
  ],

  // --- Les critères du classement (§ 5.7) -----------------------------------------
  ['moteur.critere.ecartAuPlafondAPrioriMax', 'écart au plafond a priori'],
  ['moteur.critere.excedentCollisions', 'excédent de collisions'],
  ['moteur.critere.collisionsCumulees', 'collisions cumulées'],
  ['moteur.critere.toursHorsObjectif', 'tours hors objectif'],
  ['moteur.critere.rencontresRepetees', 'rencontres répétées'],
  ['moteur.critere.animateursNonRencontres', 'animateurs non rencontrés'],
  ['moteur.critere.redondance', "redondance d'organisation"],
  ['moteur.critere.conflitsOrganisation', "conflits d'organisation"],
  ['moteur.critere.inclusionsNonSatisfaites', 'inclusions non satisfaites'],

  // --- Les valeurs qui classent (§ 5.7, A11, D9, D20) ------------------------------
  ['moteur.valeur.ecartAuPlafondAPrioriMax', 'écart au plafond a priori'],
  ['moteur.valeur.excedentCollisions', 'excédent de collisions'],
  ['moteur.valeur.collisionsCumulees', 'collisions cumulées'],
  ['moteur.valeur.jamaisServies', 'personnes jamais servies'],
  ['moteur.valeur.horsObjectifMax', "plus de tours hors objectif d'une personne"],
  ['moteur.valeur.toursHorsObjectif', 'tours hors objectif'],
  ['moteur.valeur.rencontresRepeteesChoisies', 'rencontres répétées'],
  ['moteur.valeur.retoursChoisis', 'retours'],
  ['moteur.valeur.animateursNonRencontres', 'animateurs non rencontrés'],
  ['moteur.valeur.redondance', "redondance d'organisation"],
  ['moteur.valeur.conflitsOrganisation', "conflits d'organisation"],
  ['moteur.valeur.inclusionsNonSatisfaites', 'inclusions non satisfaites'],

  // --- Un palier partagé (§ 5.7, A11) : « ensemble, », puis chaque critère
  // suivi de son poids.
  ['moteur.palier.ensemble', 'ensemble'],
  ['moteur.palier.poids', ({ poids }) => `poids ${poids}`],
]);
