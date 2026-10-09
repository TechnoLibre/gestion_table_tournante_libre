// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La définition des réglages de la charge (§ 5.3, § 5.7, § 5.10, § 8.9,
// § 19.8) : la seule liste des réglages que porte le fichier. Chaque écran
// montre les entrées de sa section, dans leur ordre — Reglages.svelte celles
// de 'generation' —, et le tableau des réglages de la documentation
// s'engendre de toutes : un réglage ajouté ici paraît des deux côtés.
//
// Une entrée est { nom, cle, etiquette, unite, defaut, genre, section } :
//   nom        son nom dans charge.reglages, ou dans charge.reglages.generation
//              pour un champ de la génération ;
//   cle        son chemin dans charge.reglages, que la commande qui l'écrit
//              reçoit et que le champ désigne (data-champ) :
//              generation.<nom> pour un champ de la génération, <nom> sinon ;
//   etiquette  la clé du libellé, qui porte l'unité pour un champ ;
//   unite      ce qu'un champ compte, 'propositions' ou 'mouvements' ; null
//              pour une bascule et pour la cible, une somme sans unité ;
//   defaut     la valeur d'une charge neuve, ou celle d'un réglage facultatif
//              que la charge ne porte pas ;
//   genre      'champ', une saisie entière, ou 'bascule', une case à cocher ;
//   section    la section de l'écran qui le montre : 'generation', écrit par
//              modifierReglage, ou 'propositions', la cible de la somme de
//              redondance, écrite par changerCibleRedondance.
//
// La graine, saisie de la commande, et les cœurs, réglage du poste, ne sont
// pas au fichier : Reglages.svelte les montre à part.
//
// Les défauts se lisent sur la charge d'un événement neuf, telle que la
// commande de création la pose (chargeNeuve) : creerCharge y copie
// GENERATION_PAR_DEFAUT et y écrit les bascules, et l'interface n'importe
// pas le stockage. La charge lue ici n'est écrite nulle part. La cible,
// facultative, n'y est pas : son défaut est CIBLE_REDONDANCE_PAR_DEFAUT.
import { chargeNeuve } from '../../application/commandes.js';
import { CIBLE_REDONDANCE_PAR_DEFAUT } from '../../application/evaluation.js';
import { SIEGES_PAR_DEFAUT, TOURS_PAR_DEFAUT } from '../../application/evenements.js';

/** @typedef {'champ'|'bascule'} GenreReglage */
/** @typedef {'generation'|'propositions'} SectionReglage */
/**
 * @typedef {Readonly<{nom: string, cle: string, etiquette: string, unite: 'propositions'|'mouvements'|null,
 *                     defaut: number|boolean, genre: GenreReglage, section: SectionReglage}>} EntreeReglage
 */

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

const bascule = (nom) =>
  Object.freeze({
    nom,
    cle: nom,
    etiquette: `generation.contrainte.${nom}`,
    unite: null,
    defaut: DEFAUTS[nom],
    genre: 'bascule',
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
 * la recherche (§ 5.7, § 5.10), puis les quatre contraintes et l'attribution
 * des sièges, dans l'ordre du § 5.3 ; enfin la cible de la somme de
 * redondance (§ 8.9), de la section des propositions.
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
  bascule('attribuerSieges'),
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
 * sinon. Un réglage facultatif absent vaut le défaut de l'entrée.
 *
 * @param {Object} reglages   charge.reglages
 * @param {EntreeReglage} entree
 * @returns {number|boolean}
 * @throws {RangeError} pour un genre inconnu
 */
export function valeurDuReglage(reglages, entree) {
  if (entree.genre !== 'champ' && entree.genre !== 'bascule') {
    throw new RangeError(`genre de réglage inconnu : ${JSON.stringify(entree.genre)}`);
  }
  const valeur = entree.cle.split('.').reduce((objet, nom) => objet?.[nom], reglages);
  return valeur ?? entree.defaut;
}
