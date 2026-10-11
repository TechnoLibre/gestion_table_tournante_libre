// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La définition des réglages de la charge (§ 5.3, § 5.7, § 5.10, § 8.9,
// § 19.8) : la seule liste des réglages que porte le fichier. Chaque écran
// montre les entrées de sa section, dans leur ordre — Reglages.svelte celles
// de 'generation' —, et le tableau des réglages de la documentation
// s'engendre de toutes : un réglage ajouté ici paraît des deux côtés.
//
// Une entrée est { nom, cle, etiquette, unite, defaut, genre, section }, et
// une entrée du genre 'choix' porte en plus { valeurs, sous, critere } :
//   nom        son nom dans charge.reglages, ou dans charge.reglages.generation
//              pour un champ de la génération ;
//   cle        son chemin dans charge.reglages, que la commande qui l'écrit
//              reçoit et que le champ désigne (data-champ) :
//              generation.<nom> pour un champ de la génération, <nom> sinon ;
//   etiquette  la clé du libellé, qui porte l'unité pour un champ ;
//   unite      ce qu'un champ compte, 'propositions' ou 'mouvements' ; null
//              pour une bascule, un choix, l'ordre, et pour la cible, une
//              somme sans unité ;
//   defaut     la valeur d'une charge neuve, ou celle d'un réglage facultatif
//              que la charge ne porte pas ;
//   genre      'champ', une saisie entière ; 'bascule', une case à cocher ;
//              'choix', une valeur parmi valeurs, en boutons radio ; 'ordre',
//              l'ordre des priorités, une liste de paliers que son éditeur
//              règle (Priorites.svelte) ;
//   section    la section de l'écran qui le montre : 'generation', écrit par
//              modifierReglage — l'ordre par changerPriorites —, ou
//              'propositions', la cible de la somme de redondance, écrite par
//              changerCibleRedondance ;
//   valeurs    les valeurs d'un choix, dans l'ordre de ses boutons ; le
//              libellé de chacune est <etiquette>.<valeur>, son explication
//              <etiquette>.<valeur>.explication ;
//   sous       la clé de la bascule sous laquelle le choix se montre ;
//   critere    le critère dont le choix règle la lecture : son état,
//              « décoché » ou « sans objet », s'écrit à côté du choix.
//
// La graine, saisie de la commande, et les cœurs, réglage du poste, ne sont
// pas au fichier : Reglages.svelte les montre à part.
//
// Les défauts se lisent sur la charge d'un événement neuf, telle que la
// commande de création la pose (chargeNeuve) : creerCharge y copie
// GENERATION_PAR_DEFAUT et y écrit les bascules, et l'interface n'importe
// pas le stockage. La charge lue ici n'est écrite nulle part. Les réglages
// facultatifs n'y sont pas : la cible a pour défaut
// CIBLE_REDONDANCE_PAR_DEFAUT, l'ordre des priorités LISTE_PAR_DEFAUT, lue
// dans le registre par l'application (priorites.js). Le mode prend ses
// valeurs et son défaut, le premier, dans MODES_OBJECTIFS, et son critère
// dans CASES, celui que sa case fait compter : le registre, que
// l'application réexporte (contrainte 35). Les deux cases portent ici le
// défaut que le stockage leur lit (§ 8.9), et les épreuves de
// reglages.test.js les comparent à ses lecteurs.
import { chargeNeuve } from '../../application/commandes.js';
import { CASES, CIBLE_REDONDANCE_PAR_DEFAUT, MODES_OBJECTIFS } from '../../application/evaluation.js';
import { SIEGES_PAR_DEFAUT, TOURS_PAR_DEFAUT } from '../../application/evenements.js';
import { LISTE_PAR_DEFAUT } from './priorites.js';

/** @typedef {'champ'|'bascule'|'choix'|'ordre'} GenreReglage */
/** @typedef {'generation'|'propositions'} SectionReglage */
/**
 * @typedef {Readonly<{nom: string, cle: string, etiquette: string, unite: 'propositions'|'mouvements'|null,
 *                     defaut: number|boolean|string|ReadonlyArray<ReadonlyArray<{critere: string, poids: number}>>,
 *                     genre: GenreReglage, section: SectionReglage,
 *                     valeurs?: ReadonlyArray<string>, sous?: string, critere?: string}>} EntreeReglage
 */

// Les genres que valeurDuReglage lit.
const GENRES = Object.freeze(['champ', 'bascule', 'choix', 'ordre']);

const { reglages: DEFAUTS } = chargeNeuve(
  { nom: 'reglages', siegesParDefaut: SIEGES_PAR_DEFAUT, tours: TOURS_PAR_DEFAUT },
  () => 'reglages',
).charge;

const champ = (nom, unite) =>
  Object.freeze({
    nom,
    cle: `generation.${nom}`,
    etiquette: `generation.reglage.${nom}`,
    unite,
    defaut: DEFAUTS.generation[nom],
    genre: 'champ',
    section: 'generation',
  });

// Une bascule ; defaut, pour une case facultative que la charge neuve ne
// porte pas.
const bascule = (nom, defaut = DEFAUTS[nom]) =>
  Object.freeze({
    nom,
    cle: nom,
    etiquette: `generation.contrainte.${nom}`,
    unite: null,
    defaut,
    genre: 'bascule',
    section: 'generation',
  });

// Le mode des objectifs (§ 5.3, A8, D20) : ce que le critère des tours hors
// objectif cherche d'abord. Le défaut, en tête des modes du registre, est le
// plus de places servies, que le fichier n'écrit pas. Le choix se montre
// sous la case des objectifs, et son critère est celui que cette case fait
// compter.
const SOUS_LE_MODE = 'respecterObjectifs';
const MODE_OBJECTIFS = Object.freeze({
  nom: 'modeObjectifs',
  cle: 'modeObjectifs',
  etiquette: 'generation.reglage.modeObjectifs',
  unite: null,
  defaut: MODES_OBJECTIFS[0],
  genre: 'choix',
  section: 'generation',
  valeurs: MODES_OBJECTIFS,
  sous: SOUS_LE_MODE,
  critere: Object.keys(CASES).find((nom) => CASES[nom].includes(SOUS_LE_MODE)),
});

// L'ordre des priorités (§ 5.7, A11) : absent du fichier à l'ordre par défaut.
const PRIORITES = Object.freeze({
  nom: 'priorites',
  cle: 'priorites',
  etiquette: 'generation.reglage.priorites',
  unite: null,
  defaut: LISTE_PAR_DEFAUT,
  genre: 'ordre',
  section: 'generation',
});

const CIBLE = Object.freeze({
  nom: 'cibleRedondance',
  cle: 'cibleRedondance',
  etiquette: 'propositions.cible.etiquette',
  unite: null,
  defaut: CIBLE_REDONDANCE_PAR_DEFAUT,
  genre: 'champ',
  section: 'propositions',
});

/**
 * Les réglages de la charge, dans l'ordre des écrans : les trois champs de
 * la recherche (§ 5.7, § 5.10), puis les six contraintes et l'attribution
 * des sièges, dans l'ordre du § 5.3 ; le mode des objectifs, que l'écran
 * montre sous sa case ; l'ordre des priorités ; enfin la cible de la somme
 * de redondance (§ 8.9), de la section des propositions.
 *
 * @type {ReadonlyArray<EntreeReglage>}
 */
export const REGLAGES_GENERATION = Object.freeze([
  champ('nombre', 'propositions'),
  champ('arret', 'mouvements'),
  champ('historique', 'mouvements'),
  bascule('separerAppartenances'),
  bascule('nouveauxVoisins'),
  bascule('nouvelleTable'),
  bascule('varierAppartenances'),
  bascule('respecterObjectifs', true),
  bascule('rencontrerAnimateurs', false),
  bascule('attribuerSieges'),
  MODE_OBJECTIFS,
  PRIORITES,
  CIBLE,
]);

/**
 * Les entrées d'un genre, dans l'ordre de la définition.
 *
 * @param {ReadonlyArray<EntreeReglage>} definition
 * @param {GenreReglage} genre
 * @returns {EntreeReglage[]}
 */
export function reglagesDuGenre(definition, genre) {
  return definition.filter((entree) => entree.genre === genre);
}

/**
 * Les entrées d'une section, dans l'ordre de la définition.
 *
 * @param {ReadonlyArray<EntreeReglage>} definition
 * @param {SectionReglage} section
 * @returns {EntreeReglage[]}
 */
export function reglagesDeSection(definition, section) {
  return definition.filter((entree) => entree.section === section);
}

/**
 * La valeur qu'une charge porte pour une entrée, lue au chemin de sa clé :
 * reglages.generation[nom] pour un champ de la génération, reglages[nom]
 * sinon — une case, le mode, l'ordre des priorités. Un réglage facultatif
 * absent vaut le défaut de l'entrée. Un ordre se rend tel que la charge le
 * porte : le stockage le valide à l'écriture comme à la lecture (A16).
 *
 * @param {Object} reglages   charge.reglages
 * @param {EntreeReglage} entree
 * @returns {EntreeReglage['defaut']}
 * @throws {RangeError} pour un genre inconnu
 */
export function valeurDuReglage(reglages, entree) {
  if (!GENRES.includes(entree.genre)) {
    throw new RangeError(`genre de réglage inconnu : ${JSON.stringify(entree.genre)}`);
  }
  const valeur = entree.cle.split('.').reduce((objet, nom) => objet?.[nom], reglages);
  return valeur ?? entree.defaut;
}
