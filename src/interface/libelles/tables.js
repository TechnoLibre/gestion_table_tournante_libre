// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les libellés des tables et des tours (§ 4, § 6, § 2.1 étapes 4 et 5,
// § 14.6). Chaque clé commence par « tables. ».
//
// L'énoncé d'un changement de défaut se compose de phrases, que rend
// enonceDefaut (tables/modele.js) et que l'écran sépare d'une espace : la
// phrase d'application, puis celle du total — le § 6.1 les écrit ainsi. Une
// baisse refusée n'a qu'une phrase d'en-tête, puis le refus de chaque table,
// composé par texte depuis son code. Les noms de personnes et les numéros de
// table viennent des détails : une fenêtre à confirmer nomme chaque élément
// détruit dans son propre libellé.
import { JOINTURE_ETIQUETTES } from '../../application/csv.js';
import { auxToursNommes, cite, compte, toursNommes } from '../../application/libelles/aides.js';

// Un accord au nombre : le singulier jusqu'à un, comme compte.
const accord = (n, singulier, pluriel) => (n <= 1 ? singulier : pluriel);

// La portée d'une réservation en mots : tous les tours, ou le tour désigné.
const portee = ({ portee: genre, tour }) => (genre === 'tous' ? 'pour tous les tours' : `au tour ${tour}`);

// Les étiquettes d'un objectif, citées et jointes comme l'export les
// joint : aucun « et » ni « ou » entre elles, qui dirait une règle que
// l'objectif ne porte pas forcément.
const etiquettesCitees = (etiquettes) => etiquettes.map(cite).join(JOINTURE_ETIQUETTES);

// Ce qu'une règle exige des étiquettes, en mots (§ 4.5).
const exigence = (regle) => (regle === 'et' ? 'toutes' : 'au moins une');

// La portée d'un objectif en mots : la soirée, ou le tour désigné.
const porteeObjectif = (tour) => (tour === null ? 'de la soirée' : `du tour ${tour}`);

// Des tours nommés après « au lieu » : « du tour 4 », « des tours 1 et 5 ».
const desToursNommes = (tours) => `${tours.length === 1 ? 'du' : 'des'} ${toursNommes(tours)}`;

export const TABLE = new Map([
  // --- Le défaut (§ 6.1) ------------------------------------------------------
  ['tables.defaut.etiquette', 'Places par défaut'],
  [
    'tables.defaut.application',
    ({ suivent, avant, apres, surchargees }) => {
      const suivi =
        suivent === 0
          ? 'Aucune table ne suit le défaut'
          : `${compte(suivent, 'table suit', 'tables suivent')} le défaut et ` +
            `${accord(suivent, 'passe', 'passent')} de ${avant} à ${compte(apres, 'place', 'places')}`;
      if (surchargees.length === 0) return `${suivi}.`;
      return (
        `${suivi} ; ${compte(surchargees.length, 'table surchargée', 'tables surchargées')} ` +
        `(${surchargees.join(', ')}) ${accord(surchargees.length, 'ne change', 'ne changent')} pas.`
      );
    },
  ],
  // Le total : sous présence partielle (partielle), participants est le plus
  // grand nombre de personnes présentes à un même tour.
  [
    'tables.defaut.total',
    ({ totalAvant, totalApres, participants, partielle = false }) =>
      `Total : ${totalAvant} \u{2192} ${compte(totalApres, 'siège', 'sièges')} ` +
      (partielle
        ? `pour ${compte(participants, 'personne présente', 'personnes présentes')} au plus à un même tour.`
        : `pour ${compte(participants, 'participant', 'participants')}.`),
  ],
  [
    'tables.defaut.refusee',
    ({ avant, apres }) =>
      `Le défaut ne passe pas de ${avant} à ${compte(apres, 'place', 'places')} : ` +
      'une table au moins refuse, et rien ne change.',
  ],
  [
    'tables.defaut.realignementRefuse',
    ({ avant, apres }) =>
      `Le réalignement sur ${compte(apres, 'place', 'places')} est refusé : une table au moins refuse, ` +
      `et rien ne change ; le défaut peut passer de ${avant} à ${apres} sans réaligner.`,
  ],
  // Une table qui refuse le changement : son numéro, puis son refus ; numero
  // null pour un refus de l'événement entier, qui ne nomme aucune table.
  [
    'tables.defaut.refusTable',
    ({ numero, refus }, texte) => {
      const motif = texte(refus.code, refus.details);
      return numero === null ? motif : `Table ${numero} \u{2014} ${motif}`;
    },
  ],
  ['tables.defaut.appliquer', 'Appliquer'],
  [
    'tables.defaut.appliquerRealigner',
    ({ n }) => `Appliquer et réaligner ${n <= 1 ? 'la surchargée' : `les ${n} surchargées`}`,
  ],
  ['tables.defaut.garder', 'Garder le défaut actuel'],
  [
    'tables.defaut.confirmationRealigner',
    ({ n }) =>
      `Réaligner ${n <= 1 ? 'la table surchargée' : `les ${n} tables surchargées`} ? ` +
      `${accord(n, 'Sa surcharge est perdue', 'Leurs surcharges sont perdues')} :`,
  ],
  ['tables.defaut.surchargePerdue', ({ numero, sieges }) => `Table ${numero} : ${compte(sieges, 'place', 'places')}`],

  // --- La liste des tables (§ 4, § 6.1, § 6.2) ----------------------------------
  ['tables.liste.titre', 'Tables'],
  // L'en-tête de la liste : le nombre de tables et le total de leurs sièges
  // (comptesTables), séparés d'un point médian.
  [
    'tables.liste.comptes',
    ({ tables, sieges }) => `${compte(tables, 'table', 'tables')} \u{00B7} ${compte(sieges, 'siège', 'sièges')}`,
  ],
  ['tables.liste.aucune', 'Aucune table : ajoutez-en une, ronde ou carrée.'],
  ['tables.liste.table', 'Table'],
  ['tables.liste.libelle', 'Libellé'],
  ['tables.liste.places', 'Places'],
  ['tables.liste.realigner', 'Réaligner'],
  ['tables.liste.supprimer', 'Supprimer'],
  ['tables.forme.ronde', 'Ronde'],
  ['tables.forme.carree', 'Carrée'],
  ['tables.etat.suitDefaut', 'Suit le défaut'],
  ['tables.etat.surchargee', 'Surchargée'],
  ['tables.creer.ronde', 'Ajouter une table ronde'],
  ['tables.creer.carree', 'Ajouter une table carrée'],

  // --- Les tables qui manquent (§ 6.1) --------------------------------------
  // L'aperçu : les tables à créer et leur taille, puis les places une fois
  // créées (placesApres) et les personnes à asseoir — sous présence
  // partielle (partielle), le plus grand nombre de personnes présentes à un
  // même tour.
  ['tables.manque.ouvrir', 'Créer les tables\u{2026}'],
  ['tables.manque.titre', 'Créer les tables qui manquent'],
  ['tables.manque.places', 'Places par table'],
  [
    'tables.manque.apercu',
    ({ tables, sieges, placesApres, presentes, partielle = false }) =>
      `${compte(tables, 'table', 'tables')} de ${compte(sieges, 'place', 'places')} : ` +
      `${compte(placesApres, 'place', 'places')} pour ` +
      (partielle
        ? `${compte(presentes, 'personne présente', 'personnes présentes')} au plus à un même tour`
        : compte(presentes, 'participant', 'participants')),
  ],
  ['tables.manque.creer', ({ tables }) => (tables <= 1 ? 'Créer la table' : `Créer les ${tables} tables`)],
  ['tables.manque.annuler', 'Annuler'],
  // L'annonce du geste accepté : les tables créées, de premier à dernier.
  [
    'tables.manque.fait',
    ({ premier, dernier }) => {
      if (premier === dernier) return `Table ${premier} ajoutée.`;
      return `Tables ${premier} ${dernier === premier + 1 ? 'et' : 'à'} ${dernier} ajoutées.`;
    },
  ],

  // Ce qu'un refus SIEGES_RETIRES retire, siège par siège : le nom de la
  // personne réservée suit, dans son propre nœud.
  ['tables.siegeRetire.titre', ({ siege, libelle }) => `Siège ${siege} : titre ${cite(libelle)}`],
  [
    'tables.siegeRetire.reserve',
    ({ siege, suspendue }) => `Siège ${siege}${suspendue ? ', réservation suspendue' : ''} :`,
  ],

  // --- La suppression d'une table (§ 6.2) -----------------------------------
  [
    'tables.suppression.confirmation',
    ({ numero }) => `Supprimer la table ${numero} ? Ces saisies partent avec elle :`,
  ],
  [
    'tables.suppression.reservation',
    (reservation) =>
      `${reservation.nom} : réservation ${portee(reservation)}` +
      `${reservation.siege === null ? '' : `, siège ${reservation.siege}`}`,
  ],
  ['tables.suppression.titre', ({ siege, libelle }) => `Titre ${cite(libelle)}, siège ${siege}`],
  [
    'tables.suppression.objectif',
    ({ tour, etiquettes }) => `Objectif ${porteeObjectif(tour)} : ${etiquettesCitees(etiquettes)}`,
  ],

  // --- Les tours (§ 2.1 étape 5, § 4.3) ----------------------------------------
  ['tables.tours.etiquette', 'Nombre de tours'],
  [
    'tables.tours.confirmation',
    ({ avant, apres }) => `Passer de ${avant} à ${compte(apres, 'tour', 'tours')} ? Ce changement emporte :`,
  ],
  [
    'tables.tours.reservation',
    ({ nom, numero, tour }) => `${nom} : réservation à la table ${numero} au tour ${tour}, détruite`,
  ],
  [
    'tables.tours.objectif',
    ({ numero, tour, etiquettes }) => `Table ${numero} : objectif du tour ${tour} (${etiquettesCitees(etiquettes)}), détruit`,
  ],
  // Une présence que la baisse rogne : apres null quand elle couvre
  // désormais tous les tours.
  [
    'tables.tours.presence',
    ({ nom, avant, apres }) => `Présence de ${nom} : ${toursNommes(apres)} au lieu ${desToursNommes(avant)}`,
  ],

  // --- Les personnes présentes par tour (§ 6.1) --------------------------------
  ['tables.presences.titre', 'Personnes présentes par tour'],
  ['tables.presences.colonne.tour', 'Tour'],
  ['tables.presences.colonne.presentes', 'Présentes'],
  ['tables.presences.colonne.places', 'Places'],
  ['tables.presences.colonne.manque', 'Places manquantes'],

  // --- Les animateurs d'une table (§ 2.1 étape 6, § 6.1) ----------------------
  // La rangée « Animateurs » de chaque table, puis la fenêtre d'ajout : sa
  // recherche, son groupement, son titre, le statut de chaque personne et
  // le compte des choisies. Les statuts se disent sans accord de genre : le
  // fichier ne porte aucun genre de personne.
  ['tables.animateurs.titre', 'Animateurs'],
  ['tables.animateurs.aucun', 'Aucun animateur'],
  ['tables.animateurs.ajouter', 'Ajouter\u{2026}'],
  ['tables.animateurs.retirer', ({ nom, numero }) => `Retirer ${nom} des animateurs de la table ${numero}`],
  ['tables.animateurs.fenetre', ({ numero }) => `Ajouter des animateurs à la table ${numero}`],
  ['tables.animateurs.recherche', 'Rechercher (nom, prénom, organisation)'],
  ['tables.animateurs.grouper', 'Grouper par organisation'],
  ['tables.animateurs.sansOrganisation', 'Sans organisation'],
  ['tables.animateurs.libelle', 'Titre'],
  ['tables.animateurs.aucunePersonne', 'Aucune personne ne correspond à la recherche.'],
  [
    'tables.animateurs.compte',
    ({ choisies, libres }) =>
      `${choisies} ${accord(choisies, 'choisie', 'choisies')} \u{00B7} ${compte(libres, 'place libre', 'places libres')} à cette table`,
  ],
  ['tables.animateurs.confirmer', 'Ajouter'],
  ['tables.animateurs.annuler', 'Annuler'],
  ['tables.animateurs.statut.animeCetteTable', ({ libelle }) => `Anime cette table (${cite(libelle)})`],
  ['tables.animateurs.statut.animeAutreTable', ({ numero }) => `Anime la table ${numero}`],
  // Une réservation à la main : sa table, puis son tour ou la soirée.
  [
    'tables.animateurs.statut.reservee',
    ({ reservations }) =>
      `${reservations.length === 1 ? 'Place réservée' : 'Places réservées'} : ` +
      reservations.map(({ numero, portee: genre, tour }) => `table ${numero}, ${genre === 'tous' ? 'toute la soirée' : toursNommes([tour])}`).join(' ; '),
  ],
  ['tables.animateurs.statut.exclue', 'Personne exclue'],
  // Ses tours d'absence, croissants : « Absence au tour 3 », « Absence aux
  // tours 1 et 3 ».
  ['tables.animateurs.statut.absente', ({ tours }) => `Absence ${auxToursNommes(tours)}`],
  [
    'tables.animateurs.statut.placeeAuRetenu',
    ({ placements }) => `Au plan retenu : ${placements.map(({ numero, tours }) => `table ${numero} ${auxToursNommes(tours)}`).join(' ; ')}`,
  ],
  ['tables.animateurs.statut.libre', 'Disponible'],
  ['tables.animateurs.titrePressenti', ({ libelle }) => `Titre pressenti : ${cite(libelle)}`],

  // --- Les objectifs des tables (§ 4.5, § 10.4, D3, D19) ------------------------
  // La règle par défaut de l'événement, réglée avec les places et les tours.
  ['tables.regle.etiquette', 'Règle par défaut des objectifs'],
  ['tables.regle.ou', 'au moins une (OU)'],
  ['tables.regle.et', 'toutes (ET)'],
  // L'objectif d'une table : son champ d'étiquettes, le choix de sa règle —
  // le réglage général, nommé par ce qu'il exige, ou une règle propre —, et
  // son état en mots.
  ['tables.objectif.soiree', 'Objectif de la soirée'],
  ['tables.objectif.tour', ({ tour }) => `Objectif du tour ${tour}`],
  ['tables.objectif.regle', "Règle de l'objectif"],
  ['tables.objectif.regleDefaut', ({ regle }) => `selon le réglage général (${exigence(regle)})`],
  ['tables.objectif.suitDefaut', 'Suit la règle par défaut'],
  ['tables.objectif.reglePropre', 'Règle propre'],
  ['tables.objectif.retirer', "Retirer l'objectif"],
  // Le bouton qui déplie les objectifs par tour, et combien de tours en
  // portent un.
  ['tables.objectifs.parTour', ({ nombre }) => (nombre === 0 ? 'Objectifs par tour' : `Objectifs par tour (${nombre})`)],
  ['tables.objectifs.exporter', 'Exporter les objectifs'],

  // --- Les noms accessibles des commandes de chaque table (§ 14.5) -------------
  // Une commande que chaque table répète se nomme par son texte visible,
  // composé depuis sa propre clé, puis par sa table : le nom commence
  // toujours par ce que l'œil lit, et deux tables ne se confondent pas.
  // tables.nom.table : le texte de la clé cle, sous ses détails, puis la
  // table. tables.nom.objectif : le texte de la clé cle, puis la portée de
  // l'objectif, puis la table — pour ce que l'objectif ne nomme pas déjà.
  ['tables.nom.table', ({ cle, details = {}, numero }, texte) => `${texte(cle, details)}, table ${numero}`],
  [
    'tables.nom.objectif',
    ({ cle, tour, numero }, texte) => `${texte(cle)} ${porteeObjectif(tour)}, table ${numero}`,
  ],

  // Un placement qu'un changement laisse en dérive (§ 9) : il reste, et ne
  // correspond plus à la configuration.
  ['tables.touchee.proposition', ({ id }) => `Proposition n° ${id}, qui ne correspondra plus à la configuration`],
  ['tables.touchee.retenu', 'Placement retenu, qui ne correspondra plus à la configuration'],
]);
