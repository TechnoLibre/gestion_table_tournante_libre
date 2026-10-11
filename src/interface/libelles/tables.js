// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { cite, compte } from '../../application/libelles/aides.js';

// Un accord au nombre : le singulier jusqu'à un, comme compte.
const accord = (n, singulier, pluriel) => (n <= 1 ? singulier : pluriel);

// La portée d'une réservation en mots : tous les tours, ou le tour désigné.
const portee = ({ portee: genre, tour }) => (genre === 'tous' ? 'pour tous les tours' : `au tour ${tour}`);

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
  [
    'tables.defaut.total',
    ({ totalAvant, totalApres, participants }) =>
      `Total : ${totalAvant} \u{2192} ${compte(totalApres, 'siège', 'sièges')} ` +
      `pour ${compte(participants, 'participant', 'participants')}.`,
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
  ['tables.liste.places', 'Places'],
  ['tables.liste.realigner', 'Réaligner'],
  ['tables.liste.supprimer', 'Supprimer'],
  ['tables.forme.ronde', 'Ronde'],
  ['tables.forme.carree', 'Carrée'],
  ['tables.etat.suitDefaut', 'Suit le défaut'],
  ['tables.etat.surchargee', 'Surchargée'],
  ['tables.creer.ronde', 'Ajouter une table ronde'],
  ['tables.creer.carree', 'Ajouter une table carrée'],

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

  // Un placement qu'un changement laisse en dérive (§ 9) : il reste, et ne
  // correspond plus à la configuration.
  ['tables.touchee.proposition', ({ id }) => `Proposition n° ${id}, qui ne correspondra plus à la configuration`],
  ['tables.touchee.retenu', 'Placement retenu, qui ne correspondra plus à la configuration'],
]);
