// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes du moteur qui n'ont pas leur table ailleurs, et les
// libellés de ses critères (§ 5, § 5.7, § 14.6) : les codes d'une
// ErreurConfiguration, ceux des violations de verifierInvariants et de
// verifierIndicateurs ; moteur.critere.<nom> pour chacun des sept critères
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
// son rang sinon. INCONNU, aux mêmes détails que la faute de placement du
// stockage, a son texte dans libelles/stockage.js.
import { capitale, compte, nomDans } from './aides.js';

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
  [
    'PLACES_MANQUANTES',
    ({ placesManquantes }) =>
      `Il manque ${compte(placesManquantes, 'place', 'places')} à chaque tour pour asseoir toutes les personnes : ` +
      'ajouter des tables ou des sièges, ou exclure des personnes, rend la génération possible.',
  ],
  [
    'SURRESERVATION',
    ({ table, tour, reservees, capacite }) =>
      `La table d'identifiant ${table} reçoit ${compte(reservees, 'personne réservée', 'personnes réservées')} ` +
      `au tour ${tour}, pour ${compte(capacite, 'place', 'places')}.`,
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

  // --- Les critères du classement (§ 5.7) -----------------------------------------
  ['moteur.critere.ecartAuPlafondAPrioriMax', 'écart au plafond a priori'],
  ['moteur.critere.excedentCollisions', 'excédent de collisions'],
  ['moteur.critere.collisionsCumulees', 'collisions cumulées'],
  ['moteur.critere.toursHorsObjectif', 'tours hors objectif'],
  ['moteur.critere.rencontresRepetees', 'rencontres répétées'],
  ['moteur.critere.animateursNonRencontres', 'animateurs non rencontrés'],
  ['moteur.critere.redondance', "redondance d'appartenance"],

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
  ['moteur.valeur.redondance', "redondance d'appartenance"],

  // --- Un palier partagé (§ 5.7, A11) : « ensemble, », puis chaque critère
  // suivi de son poids.
  ['moteur.palier.ensemble', 'ensemble'],
  ['moteur.palier.poids', ({ poids }) => `poids ${poids}`],
]);
