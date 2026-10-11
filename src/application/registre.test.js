// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des commandes, éprouvé en entier (§ 2.1, § 8.2, § 8.3, § 8.4,
// § 9, § 5.8, § 17 point 3, § 14.12, § 14.15) : chaque commande de COMMANDES
// passe par la séance, sur le système de fichiers d'épreuve et l'horloge
// pilotée, et l'épreuve relève ce qui s'écrit.
//
// La table EXEMPLES donne, par commande, un exemple accepté, un exemple
// refusé — un refus du domaine — et un exemple sans effet ; une commande qui
// n'a pas l'un d'eux y nomme sa raison. Un exemple porte ses arguments, ou la
// fonction qui les tire de la charge où il s'exécute, et les gestes qui le
// préparent (avant), exécutés d'abord, chacun une entrée. REMEDE_NUL_ADMIS
// nomme les refus dont le remède est nul, avec la raison : la valeur se
// corrige dans le champ même, ou aucun geste ne lève le refus.
//
// Deux événements servent de départ, construits une fois par la façade et la
// séance, puis copiés fichier pour fichier dans un système neuf pour chaque
// épreuve : un événement vide, créé, et la charge témoin — la petite
// démonstration chargée, « Modifier », une désignation, deux propositions
// générées sur l'exécuteur direct, la seconde retenue. Ni l'un ni l'autre
// n'est un fichier d'épreuve : la démonstration porte des noms du réservoir
// du générateur, et une copie dériverait d'elle.
//
// La trace des écritures enveloppe ajouterLigne et ecrireAtomique du système
// d'épreuve : une ligne d'entrée du journal, ou le journal réécrit entier,
// compte pour l'entrée ; une ligne de jalon ne compte pas. Défaire rend la
// charge d'avant, ses compteurs d'identifiants exceptés : la séance les porte
// au plus grand de leur valeur restituée et de leur valeur courante (§ 8.9),
// et l'épreuve compare la charge d'avant sous les compteurs rendus. Les noms
// d'épreuve sont inventés ; la version vient du module engendré.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { apercevoirObjectifs } from '../csv/objectifs.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { LIVREES } from '../demo/livrees.js';
import { normaliser } from '../moteur/configuration.js';
import { CRITERES } from '../moteur/criteres.js';
import { rechercher } from '../moteur/recherche.js';
import { verifierInvariants } from '../moteur/verification.js';
import { serialiserCharge } from '../stockage/canonique.js';
import { creer as creerDansLeDepot } from '../stockage/depot.js';
import { analyser, configurationDepuisCharge } from '../stockage/document.js';
import { lireJournal, reconstruire } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { derive, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { COMMANDES } from './commandes.js';
import { creerFacade } from './evenements.js';
import { creerControleurGeneration, creerExecuteurDirect } from './generation.js';
import { creerHorlogePilotee } from './horloge.js';
import { libelle } from './libelles.js';
import { nomAffiche } from './personnes.js';
import { creerSeance } from './seance.js';

const V = VERSION.affichee;
const DEPART = '2031-03-14T18:00:00-04:00';
const NOM_VIDE = 'Soirée des Hérons';
const TITRE = 'Animation des Hérons';
const AUTRE_TITRE = 'Accueil des Hérons';

const DEMONSTRATIONS = LIVREES.map(({ cle, texte }) => ({
  cle,
  nom: CATALOGUE.find((entree) => entree.cle === cle).nom,
  texte,
}));

// --- Lectures de la charge ---------------------------------------------------

const participantDe = (charge, id) => charge.participants.find((personne) => personne.id === id);
const tableDe = (charge, id) => charge.tables.find((table) => table.id === id);
const derniereTable = (charge) => Math.max(...charge.tables.map(({ id }) => id));
const croissant = (a, b) => a - b;

// Les personnes que le retenu assied au tour à la table d'identifiant
// idTable, sans réservation, par identifiant croissant.
function libresA(charge, tour, idTable) {
  const reservees = new Set(charge.reservations.map(({ participant }) => participant));
  const rang = charge.retenu.tables.indexOf(idTable);
  return charge.retenu.placement[tour - 1].sieges[rang].filter((id) => id !== null && !reservees.has(id)).sort(croissant);
}

// Les violations de verifierInvariants du retenu de la charge, la réserve
// admise (§ 12.6) ; [] sur une configuration qui ne se normalise pas.
function violationsDuRetenu(charge, { reserveAutorisee = true } = {}) {
  let instance;
  try {
    instance = normaliser(configurationDepuisCharge(charge));
  } catch {
    return [];
  }
  return verifierInvariants(instance, planDepuisFichier(charge.retenu), { reserveAutorisee });
}

// Les violations de apres que avant ne porte pas, comparées champ pour champ.
function violationsNouvelles(avant, apres) {
  const connues = new Set(violationsDuRetenu(avant).map((violation) => JSON.stringify(violation)));
  return violationsDuRetenu(apres).filter((violation) => !connues.has(JSON.stringify(violation)));
}

// --- La table des exemples ---------------------------------------------------

// Les refus admis à remède null, et pourquoi.
const REMEDE_NUL_ADMIS = new Map([
  ['MOINS_DE_DEUX', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  ['NON_ENTIER', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  ['MOINS_D_UN_TOUR', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  ['TROP_DE_PLACES', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  ['TROP_DE_TOURS', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  ['LIBELLE_VIDE', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  ['NOM_REQUIS', 'le nom se saisit dans le champ même'],
  ['PARTICIPANT_INCONNU', "une personne retirée entre-temps : aucun geste ne la rend"],
  ['PROPOSITION_INCONNUE', "une proposition effacée entre-temps : aucun geste ne la rend"],
  ['COMPTEUR_SATURE', "un compteur au bout de sa règle : aucun geste ne le fait reculer"],
  ['PLAN_NON_BLOQUE', 'il ne reste rien à débloquer'],
  ['NOM_NON_ASSOCIE', "un refus du CSV relayé par importerParticipants : il se lève dans le fichier ou l'association des colonnes"],
  ['RESERVATION_ABSENTE', "la réservation visée est absente, aucune commande ne la produit, et l'interface n'offre le retrait que sur une réservation présente"],
  ['TITRE_ABSENT', "le titre visé est absent, aucune commande ne le produit, et l'interface n'offre le retrait que sur un titre présent"],
  ['CONVERSION_IMPOSSIBLE', "les réservations « tour » visées sont absentes, aucune commande ne les produit, et l'interface n'offre la conversion que sur des réservations présentes"],
  ['ETIQUETTE_INVALIDE', 'la saisie se corrige dans le champ même, dont le texte dit la forme attendue'],
  ['ETIQUETTES_EN_TROP', 'la saisie se corrige dans le champ même, dont le texte dit le nombre admis'],
  ['OBJECTIF_HORS_SOIREE', 'le tour se choisit dans le champ même, parmi ceux de la soirée'],
  ['OBJECTIF_SANS_ETIQUETTE', "sur un couple sans objectif, rien à retirer : la saisie se corrige dans le champ même"],
  ['TABLE_DISPARUE', 'une table supprimée entre-temps : aucun geste ne la rend'],
  ['PRIORITES_INVALIDES', "l'éditeur n'offre que des listes valides : le texte nomme le palier et le critère en cause"],
  ['POIDS_HORS_DOMAINE', 'la valeur se corrige dans le champ même, dont le texte dit la valeur attendue'],
  [
    'OBJECTIFS_PALIER_PARTAGE',
    "séparer d'office déplacerait des critères que le choix du mode ne nomme pas (D23) : le texte nomme le palier, que l'opérateur sépare dans l'éditeur",
  ],
]);

// Le geste qui pose deux places de plus à la table 2, par son champ.
const QUATRE_PLACES_A_LA_TABLE_2 = ['changerPlacesTable', { id: 2, sieges: '4', origine: 'champ' }];

// Les arguments d'un import des objectifs qui donne « finance » à la soirée
// de la table d'identifiant 2, désignée par son numéro affiché, lu sur la
// charge où il s'exécute.
const IMPORTER_FINANCE_A_LA_TABLE_2 = (charge) => ({
  apercu: apercevoirObjectifs(`table;objectif\n${tableDe(charge, 2).numero};finance\n`, charge),
  mode: 'mettreAJour',
});

// L'ordre des priorités par défaut, chaque critère seul à son palier ; un
// ordre réglé, où l'excédent et les collisions cumulées partagent le
// deuxième palier ; et le geste qui joint les tours hors objectif à
// l'excédent.
const PRIORITES_DEFAUT = CRITERES.map((critere) => [{ critere, poids: 1 }]);
const COLLISIONS_JOINTES = [
  PRIORITES_DEFAUT[0],
  [{ critere: CRITERES[1], poids: 2 }, { critere: CRITERES[2], poids: 3 }],
  ...PRIORITES_DEFAUT.slice(3),
];
const JOINDRE_LES_TOURS_HORS_OBJECTIF = [
  'changerPriorites',
  {
    paliers: [
      PRIORITES_DEFAUT[0],
      [{ critere: CRITERES[1], poids: 1 }, { critere: CRITERES[3], poids: 3 }],
      PRIORITES_DEFAUT[2],
      ...PRIORITES_DEFAUT.slice(4),
    ],
  },
];

// La personne libre de la table 2 au tour 1, retirée dans la réserve du tour.
const RETIRER_UN_LIBRE_DE_LA_TABLE = (idTable) => [
  'retirerDuTour',
  (charge) => ({ tour: 1, participant: libresA(charge, 1, idTable)[0] }),
];

/**
 * Par commande : accepte, refuse, sansEffet, chacun { args, avant?, sur? }
 * — args, un objet ou une fonction de la charge où l'exemple s'exécute ;
 * avant, des gestes [nom, args] qui le préparent ; sur, 'vide' pour partir
 * de l'événement vide plutôt que de la charge témoin —, ou une chaîne, la
 * raison de son absence. refuse porte code, le refus attendu, et remede,
 * le remède attendu, quand l'exemple le fixe. personne, une
 * fonction des arguments de l'exemple accepté : l'identifiant de la personne
 * que son libellé nomme.
 */
const EXEMPLES = new Map([
  [
    'ajouterParticipant',
    {
      accepte: { args: { champs: { nom: 'Ombrelle', prenom: 'Iris' } } },
      refuse: { args: { champs: { nom: '   ' } }, code: 'NOM_REQUIS' },
      sansEffet: 'ajouter crée toujours une personne, sous un identifiant neuf',
    },
  ],
  [
    'modifierParticipant',
    {
      accepte: { args: { id: 2, champs: { notes: 'Arrive au deuxième tour' } } },
      personne: () => 2,
      refuse: { args: { id: 2, champs: { nom: '' } }, code: 'NOM_REQUIS' },
      sansEffet: { args: (charge) => ({ id: 2, champs: { nom: participantDe(charge, 2).nom } }) },
    },
  ],
  [
    'exclureParticipant',
    {
      accepte: { args: { id: 2 } },
      personne: () => 2,
      refuse: { args: { id: 999 }, code: 'PARTICIPANT_INCONNU' },
      sansEffet: { avant: [['exclureParticipant', { id: 2 }]], args: { id: 2 } },
    },
  ],
  [
    'reintegrerParticipant',
    {
      accepte: { avant: [['exclureParticipant', { id: 2 }]], args: { id: 2 } },
      personne: () => 2,
      refuse: {
        avant: [
          ['exclureParticipant', { id: 1 }],
          ['reserver', { participant: 3, table: 1, siege: 1, portee: 'tous', tour: null }],
        ],
        args: { id: 1 },
        code: 'PLACE_RESERVEE',
      },
      sansEffet: { args: { id: 2 } },
    },
  ],
  [
    'supprimerParticipant',
    {
      accepte: { args: { id: 2 } },
      personne: () => 2,
      refuse: { args: { id: 999 }, code: 'PARTICIPANT_INCONNU' },
      sansEffet: 'supprimer retire toujours une personne ; une personne absente est PARTICIPANT_INCONNU',
    },
  ],
  [
    'importerParticipants',
    {
      accepte: {
        args: (charge) => ({
          apercu: apercevoir('nom;prenom\nPervenche;Théo\n', { participants: charge.participants }),
          mode: 'ajouter',
        }),
      },
      refuse: {
        args: (charge) => ({
          apercu: apercevoir('prenom;courriel\nIris;iris@exemple.test\n', { participants: charge.participants }),
          mode: 'ajouter',
        }),
        code: 'NOM_NON_ASSOCIE',
      },
      sansEffet: {
        args: (charge) => {
          const { nom, prenom } = participantDe(charge, 2);
          const texte = `nom;prenom\n${nom};${prenom ?? ''}\n`;
          return { apercu: apercevoir(texte, { participants: charge.participants, mode: 'mettreAJour' }), mode: 'mettreAJour' };
        },
      },
    },
  ],
  [
    'importerObjectifs',
    {
      accepte: { args: (charge) => IMPORTER_FINANCE_A_LA_TABLE_2(charge) },
      refuse: {
        sur: 'vide',
        args: (charge) => ({ apercu: apercevoirObjectifs('table;objectif\n1;finance\n', charge), mode: 'mettreAJour' }),
        code: 'OBJECTIFS_SANS_TABLE',
        remede: { geste: 'ouvrirSection', section: 'tables' },
      },
      sansEffet: {
        avant: [['poserObjectif', { table: 2, tour: null, etiquettes: 'finance', regle: null }]],
        args: (charge) => IMPORTER_FINANCE_A_LA_TABLE_2(charge),
      },
    },
  ],
  [
    'changerEtat',
    {
      accepte: { args: { etat: 'propose' } },
      refuse: { sur: 'vide', args: { etat: 'propose' }, code: 'AUCUNE_PROPOSITION' },
      sansEffet: { args: { etat: 'retenu' } },
    },
  ],
  [
    'debloquer',
    {
      accepte: 'debloquer passe par seance.debloquer() sur un plan bloqué, éprouvé à part',
      refuse: { args: {}, code: 'PLAN_NON_BLOQUE' },
      sansEffet: "débloquer un plan qui n'est pas bloqué est son refus, PLAN_NON_BLOQUE",
    },
  ],
  [
    'enregistrerGeneration',
    {
      accepte: {
        args: (charge) => {
          const configuration = configurationDepuisCharge(charge);
          const { historique } = charge.reglages.generation;
          const propositions = rechercher(configuration, { graine: 7, nombre: 1, arret: 200, historique });
          return { propositions, configuration, produitVersion: V };
        },
      },
      refuse:
        "ses refus d'avant lancement appartiennent au contrôleur de génération ; la commande ne refuse que " +
        "COMPTEUR_SATURE, un compteur au bout de sa règle, qu'aucune charge témoin n'atteint",
      sansEffet: { args: (charge) => ({ propositions: [], configuration: configurationDepuisCharge(charge), produitVersion: V }) },
    },
  ],
  [
    'retenirProposition',
    {
      accepte: { args: { id: 1 } },
      refuse: { args: { id: 99 }, code: 'PROPOSITION_INCONNUE' },
      sansEffet: { args: { id: 2 } },
    },
  ],
  [
    'effacerPropositions',
    {
      accepte: { args: {} },
      refuse: "effacer ne refuse rien du domaine : une liste réduite à la proposition du retenu est sans effet",
      sansEffet: { avant: [['effacerPropositions', {}]], args: {} },
    },
  ],
  [
    'creerTable',
    {
      accepte: { args: { forme: 'carree' } },
      refuse: "créer une table ne refuse que COMPTEUR_SATURE, un compteur au bout de sa règle, qu'aucune charge témoin n'atteint",
      sansEffet: 'créer ajoute toujours une table, sous un identifiant neuf',
    },
  ],
  [
    'supprimerTable',
    {
      accepte: { args: { id: 4 } },
      refuse: "supprimer une table ne refuse rien du domaine ; une table inconnue est une faute de l'appelant (TypeError)",
      sansEffet: 'supprimer retire toujours une table',
    },
  ],
  [
    'deplacerTable',
    {
      accepte: { args: { id: 2, position: { x: 420, y: -60 } } },
      refuse: 'une table se pose partout : déplacer ne refuse rien du domaine',
      sansEffet: { args: (charge) => ({ id: 2, position: { ...tableDe(charge, 2).position } }) },
    },
  ],
  [
    'changerPlacesTable',
    {
      accepte: { args: QUATRE_PLACES_A_LA_TABLE_2[1] },
      refuse: { args: { id: 2, sieges: '2', origine: 'poignee' }, code: 'SOUS_OCCUPES' },
      sansEffet: { avant: [QUATRE_PLACES_A_LA_TABLE_2], args: QUATRE_PLACES_A_LA_TABLE_2[1] },
    },
  ],
  [
    'realignerTable',
    {
      accepte: { avant: [QUATRE_PLACES_A_LA_TABLE_2], args: { id: 2 } },
      refuse: {
        avant: [QUATRE_PLACES_A_LA_TABLE_2, ['poserTitre', { table: 2, siege: 4, libelle: AUTRE_TITRE }]],
        args: { id: 2 },
        code: 'SIEGES_RETIRES',
      },
      sansEffet: { args: { id: 2 } },
    },
  ],
  [
    'changerDefaut',
    {
      accepte: { args: { sieges: '4', realigner: false } },
      refuse: {
        avant: [['poserTitre', { table: 2, siege: 3, libelle: AUTRE_TITRE }]],
        args: { sieges: '2', realigner: false },
        code: 'SIEGES_RETIRES',
      },
      sansEffet: { args: { sieges: '3', realigner: false } },
    },
  ],
  [
    'changerTours',
    {
      accepte: { args: { tours: '3' } },
      refuse: { args: { tours: '0' }, code: 'MOINS_D_UN_TOUR' },
      sansEffet: { args: { tours: '4' } },
    },
  ],
  [
    'modifierReglage',
    {
      accepte: { args: { cle: 'nouveauxVoisins', valeur: false } },
      refuse: {
        avant: [JOINDRE_LES_TOURS_HORS_OBJECTIF],
        args: { cle: 'modeObjectifs', valeur: 'chacun' },
        code: 'OBJECTIFS_PALIER_PARTAGE',
        remede: null,
      },
      sansEffet: { args: { cle: 'attribuerSieges', valeur: false } },
    },
  ],
  [
    'changerCibleRedondance',
    {
      accepte: { args: { cible: '1200' } },
      refuse: { args: { cible: '-1' }, code: 'NON_ENTIER', remede: null },
      sansEffet: { args: { cible: '1000' } },
    },
  ],
  [
    'changerEtiquettes',
    {
      accepte: { args: { id: 2, ajouter: 'finance, Montréal' } },
      personne: () => 2,
      refuse: { args: { id: 2, ajouter: 'ressources\u{0009}humaines' }, code: 'ETIQUETTE_INVALIDE', remede: null },
      sansEffet: { avant: [['changerEtiquettes', { id: 2, ajouter: 'finance' }]], args: { id: 2, ajouter: 'Finance' } },
    },
  ],
  [
    'poserObjectif',
    {
      accepte: { args: { table: 2, tour: null, etiquettes: 'finance', regle: null } },
      refuse: {
        avant: [['poserObjectif', { table: 2, tour: 3, etiquettes: 'finance', regle: 'et' }]],
        args: { table: 2, tour: 3, etiquettes: ' ; ', regle: null },
        code: 'OBJECTIF_SANS_ETIQUETTE',
        remede: { commande: 'retirerObjectif', arguments: { table: 2, tour: 3 } },
      },
      sansEffet: {
        avant: [['poserObjectif', { table: 2, tour: 1, etiquettes: 'finance, Montréal', regle: 'et' }]],
        args: { table: 2, tour: 1, etiquettes: 'Montréal | finance', regle: 'et' },
      },
    },
  ],
  [
    'retirerObjectif',
    {
      accepte: { avant: [['poserObjectif', { table: 2, tour: 2, etiquettes: 'finance', regle: null }]], args: { table: 2, tour: 2 } },
      refuse: {
        avant: [['poserObjectif', { table: 4, tour: null, etiquettes: 'finance', regle: null }], ['supprimerTable', { id: 4 }]],
        args: { table: 4, tour: null },
        code: 'TABLE_DISPARUE',
        remede: null,
      },
      sansEffet: { args: { table: 2, tour: null } },
    },
  ],
  [
    'changerRegleObjectifs',
    {
      accepte: { args: { regle: 'et' } },
      refuse: "la règle se choisit entre deux valeurs, que l'interface offre seules : changer la règle ne refuse rien du domaine",
      sansEffet: { args: { regle: 'ou' } },
    },
  ],
  [
    'changerPriorites',
    {
      accepte: { args: { paliers: COLLISIONS_JOINTES } },
      refuse: {
        args: { paliers: [[...PRIORITES_DEFAUT[0], ...PRIORITES_DEFAUT[1]], ...PRIORITES_DEFAUT.slice(2)] },
        code: 'PRIORITES_INVALIDES',
        remede: null,
      },
      sansEffet: { args: { paliers: PRIORITES_DEFAUT } },
    },
  ],
  [
    'retablirPriorites',
    {
      accepte: { avant: [['changerPriorites', { paliers: COLLISIONS_JOINTES }]], args: {} },
      refuse: "rétablir l'ordre par défaut ne refuse rien du domaine : sans ordre réglé, le geste est sans effet",
      sansEffet: { args: {} },
    },
  ],
  [
    'reserver',
    {
      accepte: { args: { participant: 5, table: 2, siege: null, portee: 'tour', tour: 2 } },
      personne: () => 5,
      refuse: { args: { participant: 3, table: 1, siege: 1, portee: 'tous', tour: null }, code: 'PLACE_RESERVEE' },
      sansEffet: { args: { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null } },
    },
  ],
  [
    'retirerReservation',
    {
      accepte: { args: { participant: 1, table: 1, portee: 'tous', tour: null } },
      personne: () => 1,
      refuse: { args: { participant: 2, table: 1, portee: 'tous', tour: null }, code: 'RESERVATION_ABSENTE' },
      sansEffet: 'une réservation absente est RESERVATION_ABSENTE ; retirer en retire toujours une',
    },
  ],
  [
    'deplacerReservation',
    {
      accepte: { args: { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 1, siege: 2 } } },
      personne: () => 1,
      refuse: {
        avant: [['reserver', { participant: 5, table: 2, siege: 2, portee: 'tous', tour: null }]],
        args: { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 2, siege: 2 } },
        code: 'PLACE_RESERVEE',
      },
      sansEffet: { args: { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 1, siege: 1 } } },
    },
  ],
  [
    'poserTitre',
    {
      accepte: { args: { table: 2, siege: null, libelle: AUTRE_TITRE } },
      refuse: { args: { table: 1, siege: 1, libelle: AUTRE_TITRE }, code: 'PLACE_TITREE' },
      sansEffet: 'une place déjà titrée refuse PLACE_TITREE : poser ajoute toujours un titre',
    },
  ],
  [
    'retirerTitre',
    {
      accepte: { args: { table: 1, siege: 1 } },
      refuse: { args: { table: 2, siege: 1 }, code: 'TITRE_ABSENT' },
      sansEffet: 'un titre absent est TITRE_ABSENT ; retirer en retire toujours un',
    },
  ],
  [
    'designer',
    {
      accepte: { args: { participant: 5, table: 2, siege: null, libelle: AUTRE_TITRE } },
      personne: () => 5,
      refuse: { args: { participant: 5, table: 1, siege: 1, libelle: AUTRE_TITRE }, code: 'PLACE_RESERVEE' },
      sansEffet: { args: { participant: 1, table: 1, siege: 1, libelle: TITRE } },
    },
  ],
  [
    'convertirEnTous',
    {
      accepte: {
        avant: [1, 2, 3, 4].map((tour) => ['reserver', { participant: 5, table: 2, siege: null, portee: 'tour', tour }]),
        args: { participant: 5, table: 2 },
      },
      personne: () => 5,
      refuse: { args: { participant: 5, table: 2 }, code: 'CONVERSION_IMPOSSIBLE' },
      sansEffet: 'hors des conversions possibles, CONVERSION_IMPOSSIBLE ; convertir remplace toujours les réservations « tour » par une',
    },
  ],
  [
    'deplacerDansRetenu',
    {
      accepte: {
        avant: [['creerTable', { forme: 'ronde' }]],
        args: (charge) => ({ tour: 1, participant: libresA(charge, 1, 2)[0], table: derniereTable(charge), siege: null }),
      },
      personne: (args) => args.participant,
      refuse: { args: (charge) => ({ tour: 1, participant: libresA(charge, 1, 2)[0], table: 3, siege: null }), code: 'TABLE_PLEINE' },
      sansEffet: { args: (charge) => ({ tour: 1, participant: libresA(charge, 1, 2)[0], table: 2, siege: null }) },
    },
  ],
  [
    'echangerDansRetenu',
    {
      accepte: { args: (charge) => ({ tour: 1, a: libresA(charge, 1, 2)[0], b: libresA(charge, 1, 3)[0] }) },
      personne: (args) => args.a,
      refuse: { args: (charge) => ({ tour: 1, a: 1, b: libresA(charge, 1, 2)[0] }), code: 'RESERVEE_AILLEURS' },
      sansEffet: {
        avant: [RETIRER_UN_LIBRE_DE_LA_TABLE(2), RETIRER_UN_LIBRE_DE_LA_TABLE(3)],
        args: (charge) => {
          const [a, b] = charge.retenu.placement[0].reserve;
          return { tour: 1, a, b };
        },
      },
    },
  ],
  [
    'retirerDuTour',
    {
      accepte: { args: (charge) => ({ tour: 1, participant: libresA(charge, 1, 2)[0] }) },
      personne: (args) => args.participant,
      refuse: {
        args: { tour: 1, participant: 1 },
        code: 'INVARIANT_VIOLE',
        remede: { commande: 'retirerReservation', arguments: { participant: 1, table: 1, portee: 'tous', tour: null } },
      },
      sansEffet: {
        avant: [RETIRER_UN_LIBRE_DE_LA_TABLE(2)],
        args: (charge) => ({ tour: 1, participant: charge.retenu.placement[0].reserve[0] }),
      },
    },
  ],
]);

// Les retouches du retenu, que le vérificateur d'invariants juge (§ 14.12).
const RETOUCHES = ['deplacerDansRetenu', 'echangerDansRetenu', 'retirerDuTour'];

// Les arguments d'un exemple sur la charge où il s'exécute.
const argumentsDe = (args, charge) => (typeof args === 'function' ? args(charge) : structuredClone(args));

// --- Le montage --------------------------------------------------------------

function creerIdentifiants(prefixe) {
  let n = 0;
  return () => {
    n += 1;
    return `${prefixe}-${n}`;
  };
}

// La façade sur un système neuf, branchée sur une séance comme App la
// branche : changerRacine crée la séance sur la racine reçue.
function monterFacade() {
  const fs = creerFichiersSimules();
  const horloge = creerHorlogePilotee({ depart: DEPART });
  const identifiant = creerIdentifiants('montage');
  const monte = { fs, horloge, seance: null, racine: null };
  monte.facade = creerFacade({
    fs,
    horloge,
    identifiant,
    produitVersion: V,
    demonstrations: DEMONSTRATIONS,
    ouvert: () => monte.seance?.ouvert?.base ?? null,
    ouvrir: (base) => monte.seance.ouvrir(base),
    fermer: () => monte.seance.fermer(),
    creer: (champs) => monte.seance.creer(champs),
    racine: () => monte.racine,
    changerRacine: async (nouvelle) => {
      monte.racine = nouvelle;
      monte.seance = creerSeance({
        fs,
        racine: nouvelle,
        horloge,
        identifiant,
        produitVersion: V,
        planifier: horloge.planifier,
        annuler: horloge.annuler,
      });
    },
  });
  return monte;
}

// Les fichiers de l'événement base sur le disque : [chemin, texte].
function fichiersDe(fs, racine, base) {
  return [SUFFIXES.etat, SUFFIXES.precedent, SUFFIXES.journal]
    .map((suffixe) => [base + suffixe, fs.contenu(racine.id, base + suffixe)])
    .filter(([, texte]) => texte !== null);
}

let departs = null;

// Les deux événements de départ, construits au premier appel puis partagés :
// { vide, temoin }, chacun { racine, base, fichiers }.
function departsPrets() {
  departs ??= (async () => {
    const monte = monterFacade();
    const { facade, fs, horloge } = monte;
    await facade.demarrer();
    const { base: baseVide } = await facade.creer({ nom: NOM_VIDE });
    const vide = { racine: monte.racine, base: baseVide, fichiers: fichiersDe(fs, monte.racine, baseVide) };

    const { base } = await facade.chargerDemonstration('petite');
    const { seance } = monte;
    await seance.passerEnEcriture();
    await seance.executer('designer', { participant: 1, table: 1, siege: null, libelle: TITRE });
    const controleur = creerControleurGeneration({ seance, executeur: creerExecuteurDirect(), horloge, produitVersion: V });
    const { historique } = seance.charge.reglages.generation;
    await controleur.generer({ graine: 1, nombre: 2, arret: 2000, historique }, { confirmee: true });
    await seance.executer('retenirProposition', { id: 2 });
    await seance.passerEnLecture();

    const { charge } = seance;
    assert.deepEqual(
      charge.propositions.map(({ id }) => id),
      [1, 2],
    );
    assert.equal(charge.retenu.proposition, 2);
    assert.equal(charge.evenement.etat, 'retenu');
    assert.ok(charge.prochainsIds.proposition > Math.max(...charge.propositions.map(({ id }) => id), charge.retenu.proposition));
    assert.deepEqual(violationsDuRetenu(charge), []);
    const temoin = { racine: monte.racine, base, fichiers: fichiersDe(fs, monte.racine, base) };
    return { vide, temoin };
  })();
  return departs;
}

// Une séance neuve, sur un système neuf qui porte une copie des fichiers du
// départ, l'événement ouvert en lecture ; en écriture sur demande.
async function ouvrirCopie(depart, { ecriture = false } = {}) {
  const fs = creerFichiersSimules();
  for (const [chemin, texte] of depart.fichiers) fs.deposer(depart.racine.id, chemin, texte);
  const horloge = creerHorlogePilotee({ depart: DEPART });
  const seance = creerSeance({
    fs,
    racine: depart.racine,
    horloge,
    identifiant: creerIdentifiants('copie'),
    produitVersion: V,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  await seance.ouvrir(depart.base);
  if (ecriture) await seance.passerEnEcriture();
  return { fs, seance, racine: depart.racine, base: depart.base };
}

// Le même dossier rouvert par une autre séance, en lecture : l'avertissement
// d'ouverture se calcule sur le fichier écrit, sans l'état de la première.
async function rouvrir({ fs, racine, base }, prefixe) {
  const horloge = creerHorlogePilotee({ depart: DEPART });
  const seance = creerSeance({
    fs,
    racine,
    horloge,
    identifiant: creerIdentifiants(prefixe),
    produitVersion: V,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  await seance.ouvrir(base);
  return seance;
}

// La même copie, son plan bloqué par changerEtat : la séance revient en
// lecture.
async function ouvrirBloque(depart) {
  const ouvert = await ouvrirCopie(depart, { ecriture: true });
  await ouvert.seance.executer('changerEtat', { etat: 'bloque' });
  assert.equal(ouvert.seance.mode, 'lecture');
  assert.equal(ouvert.seance.charge.evenement.etat, 'bloque');
  return ouvert;
}

// La trace des écritures de l'état et du journal : [primitive, chemin,
// sorte de ligne] ; la sorte, pour une ligne ajoutée au journal.
function tracer(fs) {
  const trace = [];
  const ajouterLigne = fs.ajouterLigne;
  fs.ajouterLigne = (racine, chemin, ligne, ...reste) => {
    trace.push(['ajouterLigne', chemin, JSON.parse(ligne).type]);
    return ajouterLigne(racine, chemin, ligne, ...reste);
  };
  const ecrireAtomique = fs.ecrireAtomique;
  fs.ecrireAtomique = (racine, chemin, ...reste) => {
    trace.push(['ecrireAtomique', chemin, null]);
    return ecrireAtomique(racine, chemin, ...reste);
  };
  return trace;
}

// La trace réduite à ce qui porte l'entrée, le .precedent et l'état, dans
// l'ordre : 'entree' pour une ligne d'entrée ou le journal réécrit entier.
function ordreDesEcritures(trace, base) {
  const sortes = [];
  for (const [primitive, chemin, sorte] of trace) {
    if (chemin === base + SUFFIXES.journal && (primitive === 'ecrireAtomique' || sorte === 'entree')) sortes.push('entree');
    if (chemin === base + SUFFIXES.precedent) sortes.push('precedent');
    if (chemin === base + SUFFIXES.etat) sortes.push('etat');
  }
  return sortes;
}

const journalDe = ({ fs, racine, base }) => lireJournal(fs.contenu(racine.id, base + SUFFIXES.journal));
const chargeEcrite = ({ fs, racine, base }) => analyser(fs.contenu(racine.id, base + SUFFIXES.etat)).charge;

// Le refus que rejette la promesse, null quand elle aboutit.
async function refusDe(promesse) {
  try {
    await promesse;
    return null;
  } catch (erreur) {
    return erreur;
  }
}

// Exécute les gestes qui préparent un exemple, chacun sur la charge courante.
async function preparer(seance, avant = []) {
  for (const [nom, args] of avant) await seance.executer(nom, argumentsDe(args, seance.charge));
}

const invariantsAvertis = (seance) => seance.etat().avertissements.filter(({ code }) => code === 'INVARIANT_VIOLE');

// --- La table ----------------------------------------------------------------

describe('registre : la table des exemples couvre chaque commande', () => {
  test('le registre porte des commandes, et chacune a son entrée, un exemple ou la raison de son absence', () => {
    const noms = [...COMMANDES.keys()];
    assert.ok(noms.length > 0, 'le registre COMMANDES est vide');
    assert.deepEqual(
      noms.filter((nom) => !EXEMPLES.has(nom)),
      [],
      'commandes du registre sans entrée dans la table',
    );
    assert.deepEqual(
      [...EXEMPLES.keys()].filter((nom) => !COMMANDES.has(nom)),
      [],
      'entrées de la table hors du registre',
    );
    const incompletes = [];
    for (const [nom, exemple] of EXEMPLES) {
      for (const cle of ['accepte', 'refuse', 'sansEffet']) {
        const valeur = exemple[cle];
        const donne = typeof valeur === 'string' ? valeur.trim() !== '' : valeur?.args !== undefined;
        if (!donne) incompletes.push(`${nom}.${cle}`);
      }
      if (typeof exemple.refuse === 'object' && typeof exemple.refuse.code !== 'string') incompletes.push(`${nom}.refuse.code`);
    }
    assert.deepEqual(incompletes, []);
  });
});

// --- En lecture, et sur un plan bloqué ------------------------------------------

// Pour chaque commande hors debloquer, le refus que la séance lève et le
// compte des écritures : [nom, problème] pour chaque écart.
async function balayerLesRefus(ouvert, attendu) {
  const ecarts = [];
  const temoin = chargeEcrite(await ouvrirCopie((await departsPrets()).temoin));
  const noms = [...COMMANDES.keys()].filter((nom) => nom !== 'debloquer');
  assert.ok(noms.length > 0);
  for (const nom of noms) {
    const exemple = EXEMPLES.get(nom);
    const source = typeof exemple?.accepte === 'object' ? exemple.accepte : exemple?.refuse;
    let args = {};
    try {
      args = argumentsDe(source?.args ?? {}, temoin);
    } catch {
      args = {};
    }
    const ecritures = ouvert.fs.compteurs.ecritures;
    const erreur = await refusDe(ouvert.seance.executer(nom, args));
    const ecart = attendu(erreur);
    if (ecart !== null) ecarts.push([nom, ecart]);
    if (ouvert.fs.compteurs.ecritures !== ecritures) ecarts.push([nom, `${ouvert.fs.compteurs.ecritures - ecritures} écriture(s)`]);
  }
  return ecarts;
}

const attenduModeLecture = (erreur) => {
  if (erreur === null) return 'accepté en lecture';
  if (erreur.code !== 'MODE_LECTURE') return `refusé ${erreur.code} au lieu de MODE_LECTURE`;
  return JSON.stringify(erreur.details.remede) === JSON.stringify({ geste: 'modifier' }) ? null : 'remède autre que modifier';
};

const attenduBloque = (erreur) => {
  if (erreur === null) return 'accepté sur un plan bloqué';
  if (erreur.code !== 'LECTURE_SEULE' || erreur.details.raison !== 'BLOQUE') {
    return `refusé ${erreur.code} ${JSON.stringify(erreur.details.raison ?? null)} au lieu de LECTURE_SEULE BLOQUE`;
  }
  return JSON.stringify(erreur.details.remede) === JSON.stringify({ geste: 'debloquer' }) ? null : 'remède autre que debloquer';
};

describe('registre : en lecture et sur un plan bloqué, aucune commande n’écrit (§ 2.1, § 8.4, § 9)', () => {
  test('en lecture, sur un événement vide, chaque commande est refusée MODE_LECTURE sans écriture', async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).vide);
    assert.deepEqual(await balayerLesRefus(ouvert, attenduModeLecture), []);
  });

  test('en lecture, sur la charge témoin retenue, chaque commande est refusée MODE_LECTURE sans écriture', async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin);
    assert.deepEqual(await balayerLesRefus(ouvert, attenduModeLecture), []);
  });

  test('sur un plan bloqué vide, toujours en lecture, chaque commande est refusée LECTURE_SEULE BLOQUE sans écriture', async () => {
    const ouvert = await ouvrirBloque((await departsPrets()).vide);
    assert.deepEqual(await balayerLesRefus(ouvert, attenduBloque), []);
  });

  test('sur la charge témoin bloquée, toujours en lecture, chaque commande est refusée LECTURE_SEULE BLOQUE sans écriture', async () => {
    const ouvert = await ouvrirBloque((await departsPrets()).temoin);
    assert.deepEqual(await balayerLesRefus(ouvert, attenduBloque), []);
  });
});

describe('registre : debloquer (§ 8.5, § 9)', () => {
  test('seance.debloquer() sur un plan bloqué prend le verrou, écrit une entrée et un jalon, et laisse la séance en écriture', async () => {
    const ouvert = await ouvrirBloque((await departsPrets()).temoin);
    const { fs, seance, racine, base } = ouvert;
    assert.equal(fs.contenu(racine.id, base + SUFFIXES.verrou), null);
    const journal = journalDe(ouvert);
    const trace = tracer(fs);
    await seance.debloquer();
    const verrou = fs.contenu(racine.id, base + SUFFIXES.verrou);
    assert.notEqual(verrou, null, 'aucun verrou pris');
    assert.equal(JSON.parse(verrou).seance, seance.id);
    const apres = journalDe(ouvert);
    assert.equal(apres.entrees.length, journal.entrees.length + 1);
    assert.equal(apres.jalons.length, journal.jalons.length + 1);
    assert.deepEqual(ordreDesEcritures(trace, base), ['entree', 'precedent', 'etat']);
    assert.equal(seance.mode, 'ecriture');
    assert.equal(chargeEcrite(ouvert).evenement.etat, 'retenu');
  });
});

// --- En écriture : l'exemple accepté -------------------------------------------

describe('registre : en écriture, un exemple accepté écrit une entrée, et défaire la rend (§ 8.2, § 8.3)', () => {
  const acceptes = [...EXEMPLES].filter(([, exemple]) => typeof exemple.accepte === 'object');
  assert.ok(acceptes.length > 0);
  for (const [nom, exemple] of acceptes) {
    test(`${nom} : une entrée, le journal d'abord, l'état reconstruit, puis défaire`, async () => {
      const departsCourants = await departsPrets();
      const ouvert = await ouvrirCopie(exemple.accepte.sur === 'vide' ? departsCourants.vide : departsCourants.temoin, {
        ecriture: true,
      });
      const { fs, seance, base } = ouvert;
      await preparer(seance, exemple.accepte.avant);
      const avant = structuredClone(seance.charge);
      const journalAvant = journalDe(ouvert);
      const args = argumentsDe(exemple.accepte.args, avant);
      const trace = tracer(fs);

      const rendu = await seance.executer(nom, args);
      assert.equal(typeof rendu.libelle, 'string');
      const journal = journalDe(ouvert);
      assert.equal(journal.entrees.length, journalAvant.entrees.length + 1, 'une entrée exactement');
      assert.deepEqual(ordreDesEcritures(trace, base), ['entree', 'precedent', 'etat']);
      const derniere = journal.entrees.at(-1);
      const ecrite = chargeEcrite(ouvert);
      assert.equal(serialiserCharge(reconstruire(journal, derniere.revision)), serialiserCharge(ecrite));
      assert.equal(seance.mode, 'ecriture');

      // Aucune commande ne répartit : les réservations ajoutées tiennent à
      // une seule place (§ 5.8, § 17 point 3).
      const connues = new Set(avant.reservations.map((r) => JSON.stringify(r)));
      const ajoutees = ecrite.reservations.filter((r) => !connues.has(JSON.stringify(r)));
      assert.ok(new Set(ajoutees.map(({ table, siege }) => `${table}:${siege}`)).size <= 1, JSON.stringify(ajoutees));

      // Une retouche n'ajoute aucune violation au retenu reçu (§ 14.12).
      if (RETOUCHES.includes(nom)) assert.deepEqual(violationsNouvelles(avant, ecrite), []);

      await seance.defaire();
      const defait = journalDe(ouvert);
      assert.equal(defait.entrees.length, journal.entrees.length + 1, 'une entrée de retour');
      assert.deepEqual(defait.entrees.slice(0, journal.entrees.length), journal.entrees, 'le journal ne perd aucune entrée');
      assert.equal(defait.entrees.at(-1).sens, 'defaire');
      const rendue = seance.charge;
      for (const cle of ['participant', 'table', 'proposition']) {
        assert.equal(rendue.prochainsIds[cle], Math.max(avant.prochainsIds[cle], ecrite.prochainsIds[cle]), cle);
      }
      assert.equal(serialiserCharge(rendue), serialiserCharge({ ...avant, prochainsIds: rendue.prochainsIds }));

      // Le libellé figé ne suit pas un renommage (§ 8.2).
      if (exemple.personne !== undefined) {
        const id = exemple.personne(args);
        const personne = participantDe(rendue, id);
        assert.ok(derniere.libelle.includes(nomAffiche(personne)), `${derniere.libelle} ne nomme pas ${nomAffiche(personne)}`);
        await seance.executer('modifierParticipant', { id, champs: { nom: 'Grisaille', prenom: 'Ondine' } });
        const renomme = journalDe(ouvert).entrees.find(({ revision }) => revision === derniere.revision);
        assert.equal(renomme.libelle, derniere.libelle);
      }
    });
  }
});

// --- En écriture : l'exemple refusé et l'exemple sans effet ------------------------------

describe('registre : un exemple refusé n’écrit rien et nomme son remède (§ 2.1, garantie 3)', () => {
  const refuses = [...EXEMPLES].filter(([, exemple]) => typeof exemple.refuse === 'object');
  assert.ok(refuses.length > 0);
  for (const [nom, exemple] of refuses) {
    test(`${nom} : refusé ${exemple.refuse.code}, sans écriture`, async () => {
      const departsCourants = await departsPrets();
      const ouvert = await ouvrirCopie(exemple.refuse.sur === 'vide' ? departsCourants.vide : departsCourants.temoin, {
        ecriture: true,
      });
      const { fs, seance } = ouvert;
      await preparer(seance, exemple.refuse.avant);
      const args = argumentsDe(exemple.refuse.args, seance.charge);
      const ecritures = fs.compteurs.ecritures;
      const entrees = journalDe(ouvert).entrees.length;
      const erreur = await refusDe(seance.executer(nom, args));
      assert.notEqual(erreur, null, 'accepté');
      assert.equal(erreur.code, exemple.refuse.code, erreur.message);
      if (erreur.code === 'INVARIANT_VIOLE') {
        // La forme du refus de génération : le retenu nommé, et les seules
        // violations que la retouche ajouterait.
        assert.equal(erreur.details.proposition, seance.charge.retenu.proposition);
        assert.ok(erreur.details.violations.length > 0);
        const connues = new Set(violationsDuRetenu(seance.charge).map((violation) => JSON.stringify(violation)));
        assert.deepEqual(
          erreur.details.violations.filter((violation) => connues.has(JSON.stringify(violation))),
          [],
        );
      }
      if (Object.hasOwn(exemple.refuse, 'remede')) assert.deepEqual(erreur.details.remede, exemple.refuse.remede);
      assert.equal(fs.compteurs.ecritures, ecritures, 'écriture');
      assert.equal(journalDe(ouvert).entrees.length, entrees);
    });
  }

  test('chaque refus du domaine nomme son remède, hors des refus admis à remède null', async () => {
    const ecarts = [];
    for (const [nom, exemple] of refuses) {
      const departsCourants = await departsPrets();
      const { seance } = await ouvrirCopie(exemple.refuse.sur === 'vide' ? departsCourants.vide : departsCourants.temoin, {
        ecriture: true,
      });
      await preparer(seance, exemple.refuse.avant);
      const erreur = await refusDe(seance.executer(nom, argumentsDe(exemple.refuse.args, seance.charge)));
      if (erreur === null) {
        ecarts.push(`${nom} : accepté`);
      } else if (!Object.hasOwn(erreur.details ?? {}, 'remede')) {
        ecarts.push(`${nom} : ${erreur.code} sans details.remede`);
      } else if (erreur.details.remede === null && !REMEDE_NUL_ADMIS.has(erreur.code)) {
        ecarts.push(`${nom} : ${erreur.code} au remède null`);
      }
    }
    assert.deepEqual(ecarts, []);
  });
});

describe('registre : un exemple sans effet est refusé SANS_EFFET {commande}, sans entrée ni état (§ 8.2)', () => {
  const sansEffet = [...EXEMPLES].filter(([, exemple]) => typeof exemple.sansEffet === 'object');
  assert.ok(sansEffet.length > 0);
  for (const [nom, exemple] of sansEffet) {
    test(`${nom} : SANS_EFFET, remède null, rien n'écrit`, async () => {
      const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
      const { fs, seance, racine, base } = ouvert;
      await preparer(seance, exemple.sansEffet.avant);
      const args = argumentsDe(exemple.sansEffet.args, seance.charge);
      const ecritures = fs.compteurs.ecritures;
      const etat = fs.contenu(racine.id, base + SUFFIXES.etat);
      const journal = fs.contenu(racine.id, base + SUFFIXES.journal);
      const erreur = await refusDe(seance.executer(nom, args));
      assert.notEqual(erreur, null, 'accepté');
      assert.equal(erreur.code, 'SANS_EFFET', erreur.message);
      assert.deepEqual(erreur.details, { commande: nom, remede: null });
      assert.equal(fs.compteurs.ecritures, ecritures);
      assert.equal(fs.contenu(racine.id, base + SUFFIXES.etat), etat);
      assert.equal(fs.contenu(racine.id, base + SUFFIXES.journal), journal);
    });
  }
});

// --- Le vérificateur d'invariants -------------------------------------------------

describe('registre : le vérificateur d’invariants juge les retouches et l’ouverture (§ 14.12, § 14.15)', () => {
  test("une retouche que seul le vérificateur refuse : retirer du tour la personne que sa réservation tient à sa table lève INVARIANT_VIOLE, les seules violations nouvelles, sans écriture", async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { fs, seance } = ouvert;
    const { charge } = seance;
    // La personne 1, désignée « tous les tours » à la table 1 : le retenu
    // l'y assied, et le retrait du tour n'a aucun contrôle de pose.
    assert.ok(charge.reservations.some(({ participant, table, portee }) => participant === 1 && table === 1 && portee === 'tous'));
    assert.ok(charge.retenu.placement[0].sieges[charge.retenu.tables.indexOf(1)].includes(1));
    const ecritures = fs.compteurs.ecritures;
    const erreur = await refusDe(seance.executer('retirerDuTour', { tour: 1, participant: 1 }));
    assert.notEqual(erreur, null, 'accepté');
    assert.equal(erreur.code, 'INVARIANT_VIOLE', erreur.message);
    assert.equal(erreur.details.proposition, charge.retenu.proposition);
    const retire = structuredClone(charge);
    const etage = retire.retenu.placement[0];
    etage.sieges = etage.sieges.map((liste) => liste.filter((id) => id !== 1));
    etage.reserve = [...etage.reserve, 1].sort(croissant);
    assert.deepEqual(erreur.details.violations, violationsNouvelles(charge, retire));
    assert.deepEqual(erreur.details.violations, [{ code: 'RESERVATION', participant: 1, table: 1, tour: 1 }]);
    assert.equal(fs.compteurs.ecritures, ecritures);
  });

  test("le dépôt sur une table pleine se refuse au contrôle de pose de la retouche, TABLE_PLEINE et son remède, avant le vérificateur, sans écriture", async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { fs, seance } = ouvert;
    const { charge } = seance;
    const personne = libresA(charge, 1, 2)[0];
    const rang = charge.retenu.tables.indexOf(3);
    const places = tableDe(charge, 3).sieges ?? charge.evenement.siegesParDefaut;
    assert.equal(charge.retenu.placement[0].sieges[rang].length, places);
    const ecritures = fs.compteurs.ecritures;
    const erreur = await refusDe(seance.executer('deplacerDansRetenu', { tour: 1, participant: personne, table: 3, siege: null }));
    assert.notEqual(erreur, null, 'accepté');
    assert.equal(erreur.code, 'TABLE_PLEINE', erreur.message);
    assert.deepEqual(erreur.details.remede, { commande: 'changerPlacesTable', arguments: { id: 3, sieges: places + 1, origine: 'champ' } });
    assert.equal(fs.compteurs.ecritures, ecritures);
  });

  test("retirerDuTour d'une personne non réservée est accepté : une entrée, la personne dans la réserve du tour, aucun INVARIANT_VIOLE", async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { seance } = ouvert;
    const personne = libresA(seance.charge, 1, 2)[0];
    const entrees = journalDe(ouvert).entrees.length;
    await seance.executer('retirerDuTour', { tour: 1, participant: personne });
    assert.equal(journalDe(ouvert).entrees.length, entrees + 1);
    assert.ok(chargeEcrite(ouvert).retenu.placement[0].reserve.includes(personne));
    assert.deepEqual(invariantsAvertis(seance), []);
  });

  test('une violation déjà présente, celle d’une dérive, ne bloque pas les retouches, et INVARIANT_VIOLE la tait à l’ouverture comme après défaire, refaire et revenir', async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { seance } = ouvert;
    await seance.executer('exclureParticipant', { id: libresA(seance.charge, 1, 4)[0] });
    assert.ok(violationsDuRetenu(seance.charge).length > 0, 'la dérive ne laisse aucune violation');
    assert.deepEqual(invariantsAvertis(seance), [], 'après la dérive');
    const revisionDerive = seance.etat().evenement.revision;
    const entrees = journalDe(ouvert).entrees.length;
    const { charge } = seance;
    await seance.executer('echangerDansRetenu', { tour: 1, a: libresA(charge, 1, 2)[0], b: libresA(charge, 1, 3)[0] });
    assert.equal(journalDe(ouvert).entrees.length, entrees + 1);
    assert.deepEqual(invariantsAvertis(seance), [], 'après la retouche');
    await seance.passerEnLecture();

    const autre = await rouvrir(ouvert, 'derive');
    assert.ok(violationsDuRetenu(autre.charge).length > 0, 'la dérive ne survit pas à la réouverture');
    assert.deepEqual(invariantsAvertis(autre), [], "à l'ouverture");
    await autre.passerEnEcriture();
    await autre.defaire();
    assert.ok(violationsDuRetenu(autre.charge).length > 0, 'défaire efface la dérive');
    assert.deepEqual(invariantsAvertis(autre), [], 'après défaire');
    await autre.refaire();
    assert.deepEqual(invariantsAvertis(autre), [], 'après refaire');
    await autre.revenir(revisionDerive);
    assert.ok(violationsDuRetenu(autre.charge).length > 0, 'revenir efface la dérive');
    assert.deepEqual(invariantsAvertis(autre), [], 'après revenir');
  });

  test("un retenu qui laisse une réservation d'un tour non honorée s'ouvre en lecture avec INVARIANT_VIOLE, sans écriture, et le garde après défaire, refaire et revenir", async () => {
    const { temoin } = await departsPrets();
    const source = await ouvrirCopie(temoin);
    const charge = structuredClone(source.seance.charge);
    const personne = libresA(charge, 1, 2)[0];
    const reservation = { participant: personne, table: 3, siege: null, portee: 'tour', tour: 1 };
    charge.reservations.push(reservation);

    const fs = creerFichiersSimules();
    fs.deposerDossier(temoin.racine.id);
    const ecrit = await creerDansLeDepot(fs, temoin.racine, charge, {
      libelle: libelle('ENTREE_CREATION', { nom: charge.evenement.nom }),
      nomJalon: libelle('JALON_CREATION'),
      horodatage: '2031-03-14T17:00:00-04:00',
      produitVersion: V,
    });
    const horloge = creerHorlogePilotee({ depart: DEPART });
    const seance = creerSeance({
      fs,
      racine: temoin.racine,
      horloge,
      identifiant: creerIdentifiants('invariant'),
      produitVersion: V,
      planifier: horloge.planifier,
      annuler: horloge.annuler,
    });
    const ecritures = fs.compteurs.ecritures;
    await seance.ouvrir(ecrit.base);
    assert.equal(fs.compteurs.ecritures, ecritures, 'ouvrir écrit');
    assert.equal(seance.mode, 'lecture');
    const attendu = [
      {
        code: 'INVARIANT_VIOLE',
        details: { proposition: charge.retenu.proposition, violations: [{ code: 'RESERVATION', participant: personne, table: 3, tour: 1 }] },
      },
    ];
    assert.deepEqual(invariantsAvertis(seance), attendu, "à l'ouverture");

    await seance.passerEnEcriture();
    await seance.executer('retirerReservation', { participant: personne, table: 3, portee: 'tour', tour: 1 });
    assert.deepEqual(invariantsAvertis(seance), [], 'la réservation retirée');
    await seance.defaire();
    assert.deepEqual(invariantsAvertis(seance), attendu, 'après défaire');
    await seance.refaire();
    assert.deepEqual(invariantsAvertis(seance), [], 'après refaire');
    await seance.revenir(1);
    assert.deepEqual(invariantsAvertis(seance), attendu, 'après revenir');
  });

  test('un retenu dont changerPlacesTable a versé des surnuméraires en réserve s’ouvre sans INVARIANT_VIOLE, et le reste après défaire et refaire', async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { seance } = ouvert;
    assert.deepEqual(invariantsAvertis(seance), [], "à l'ouverture de la charge témoin");
    await seance.executer('creerTable', { forme: 'ronde' });
    await seance.executer('changerPlacesTable', { id: 2, sieges: '2', origine: 'champ' });
    const reduite = chargeEcrite(ouvert);
    const reserves = reduite.retenu.placement.map(({ reserve }) => reserve.length);
    assert.ok(reserves.every((n) => n > 0), `réserves ${JSON.stringify(reserves)}`);
    assert.ok(
      violationsDuRetenu(reduite, { reserveAutorisee: false }).some(({ code }) => code === 'NON_ASSIS'),
      'la réserve ne porte personne que la règle sans réserve refuserait',
    );
    await seance.passerEnLecture();

    const autre = await rouvrir(ouvert, 'reouverture');
    assert.deepEqual(invariantsAvertis(autre), [], "à l'ouverture");
    await autre.passerEnEcriture();
    await autre.defaire();
    assert.deepEqual(invariantsAvertis(autre), [], 'après défaire');
    await autre.refaire();
    assert.deepEqual(invariantsAvertis(autre), [], 'après refaire');
  });
});

// --- Créer et charger par la façade ------------------------------------------------

describe('registre : créer un événement et charger une démonstration écrivent sans passer par « Modifier » (§ 2.1, étape 1)', () => {
  test('créer, par la façade, écrit l’état et son entrée, la séance restant en lecture, sans verrou', async () => {
    const monte = monterFacade();
    await monte.facade.demarrer();
    assert.equal(monte.seance.mode, 'lecture');
    const { base } = await monte.facade.creer({ nom: NOM_VIDE });
    const { fs, racine, seance } = monte;
    assert.equal(seance.mode, 'lecture');
    assert.notEqual(fs.contenu(racine.id, base + SUFFIXES.etat), null);
    assert.equal(lireJournal(fs.contenu(racine.id, base + SUFFIXES.journal)).entrees.length, 1);
    assert.equal(fs.contenu(racine.id, base + SUFFIXES.verrou), null);
  });

  test('charger une démonstration, par la façade, écrit l’état et son entrée, la séance restant en lecture, sans verrou', async () => {
    const monte = monterFacade();
    await monte.facade.demarrer();
    const { base } = await monte.facade.chargerDemonstration('petite');
    const { fs, racine, seance } = monte;
    assert.equal(seance.mode, 'lecture');
    assert.equal(seance.ouvert.base, base);
    assert.notEqual(fs.contenu(racine.id, base + SUFFIXES.etat), null);
    assert.equal(lireJournal(fs.contenu(racine.id, base + SUFFIXES.journal)).entrees.length, 1);
    assert.equal(fs.contenu(racine.id, base + SUFFIXES.verrou), null);
  });
});

// --- Les étiquettes, les objectifs, leur règle et les cases ne font aucune dérive ---

describe('registre : étiquettes, objectifs, règle et cases ne mettent aucun placement en dérive (§ 8.9, D13)', () => {
  // Les raisons de dérive de chaque proposition, puis du retenu.
  const raisons = (charge) => [...charge.propositions, charge.retenu].map((placement) => derive(placement, charge));

  test('sur la charge témoin, chaque geste écrit une entrée et laisse les raisons de dérive telles quelles', async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { seance } = ouvert;
    const gestes = [
      ['changerEtiquettes', { id: 2, ajouter: 'finance' }],
      ['changerEtiquettes', { id: 3, ajouter: 'Montréal' }],
      ['poserObjectif', { table: 2, tour: null, etiquettes: 'finance', regle: null }],
      ['poserObjectif', { table: 3, tour: 2, etiquettes: 'finance, montreal', regle: 'et' }],
      ['changerRegleObjectifs', { regle: 'et' }],
      ['modifierReglage', { cle: 'respecterObjectifs', valeur: false }],
      ['modifierReglage', { cle: 'rencontrerAnimateurs', valeur: true }],
      ['retirerObjectif', { table: 2, tour: null }],
      ['changerEtiquettes', { id: 2, retirer: 'finance' }],
      ['changerPriorites', { paliers: COLLISIONS_JOINTES }],
      ['modifierReglage', { cle: 'modeObjectifs', valeur: 'minimum' }],
      ['retablirPriorites', {}],
      ['modifierReglage', { cle: 'modeObjectifs', valeur: 'places' }],
    ];
    const depart = raisons(seance.charge);
    for (const [nom, args] of gestes) {
      const entrees = journalDe(ouvert).entrees.length;
      await seance.executer(nom, args);
      assert.equal(journalDe(ouvert).entrees.length, entrees + 1, nom);
      assert.deepEqual(raisons(seance.charge), depart, nom);
    }
    const ecrite = chargeEcrite(ouvert);
    assert.deepEqual(raisons(ecrite), depart);
    assert.deepEqual(ecrite.tables.find(({ id }) => id === 3).objectifs, [
      { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal', 'finance'] },
    ]);
  });

  test("sur la charge témoin retenue, importer des objectifs écrit une entrée, avertit IMPORT_OBJECTIFS_RECLASSE et laisse les raisons de dérive telles quelles (§ 10.4)", async () => {
    const ouvert = await ouvrirCopie((await departsPrets()).temoin, { ecriture: true });
    const { seance } = ouvert;
    assert.equal(seance.charge.evenement.etat, 'retenu');
    const depart = raisons(seance.charge);
    const entrees = journalDe(ouvert).entrees.length;
    const { charge } = seance;
    const texte = `table;tour;objectif;regle\n${tableDe(charge, 2).numero};;finance;\n${tableDe(charge, 3).numero};2;finance, Montréal;et\n`;
    const rendu = await seance.executer('importerObjectifs', { apercu: apercevoirObjectifs(texte, charge), mode: 'mettreAJour' });
    assert.equal(rendu.avertissements[0].code, 'IMPORT_OBJECTIFS_RECLASSE');
    assert.equal(journalDe(ouvert).entrees.length, entrees + 1);
    assert.deepEqual(raisons(seance.charge), depart);
    const ecrite = chargeEcrite(ouvert);
    assert.deepEqual(raisons(ecrite), depart);
    assert.deepEqual(ecrite.tables.find(({ id }) => id === 3).objectifs, [
      { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal', 'finance'] },
    ]);
  });
});
