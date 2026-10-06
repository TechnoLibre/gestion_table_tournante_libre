// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Réservoirs de noms des démonstrations (§ 15.6) : des prénoms courants, des
// patronymes forgés par produit d'un préfixe et d'une terminaison, des noms
// d'organisation formés d'une tête, qui dit le genre d'organisation, et d'une
// racine forgée. Les produits se tirent sans remise : chaque personne reçoit
// un patronyme distinct, chaque appartenance un libellé distinct, sans boucle
// de rattrapage. Les fragments sont forgés pour ne désigner personne ;
// catalogue.long.test.js refuse qu'un patronyme complet ou une racine
// apparaisse ailleurs dans le projet, hors des fichiers que
// scripts/engendrer_livrables.js engendre de ces listes et qui les portent
// par construction : les démonstrations livrées et les deux CSV de
// démonstration (§ 15.6).
//
// L'ordre de chaque liste fait partie du contrat des tirages (§ 15.5,
// point 3) : un tirage désigne un rang, et changer un ordre change les
// démonstrations. Les listes sont figées et en NFC.

/** Prénoms courants, tirés avec remise, un par personne. */
export const PRENOMS = Object.freeze([
  'Marie', 'Jean', 'Louise', 'Pierre', 'Camille', 'Luc', 'Julie', 'Marc',
  'Sophie', 'Paul', 'Claire', 'Michel', 'Anne', 'Louis', 'Isabelle', 'François',
  'Catherine', 'Nicolas', 'Nathalie', 'Philippe', 'Émilie', 'Antoine', 'Chantal', 'Simon',
  'Geneviève', 'Gabriel', 'Hélène', 'Olivier', 'Véronique', 'Alexandre', 'Sylvie', 'Guillaume',
  'Caroline', 'Étienne', 'Lucie', 'Félix', 'Manon', 'Samuel', 'Chloé', 'Raphaël',
  'Léa', 'Thomas', 'Zoé', 'Hugo', 'Amina', 'Karim', 'Fatima', 'Youssef',
]);

/** Débuts de patronyme forgés, chacun terminé par une consonne. */
export const PREFIXES = Object.freeze([
  'Abrev', 'Bralm', 'Clov', 'Dulv', 'Esk', 'Fralv', 'Gorz', 'Hulv', 'Ivr', 'Jusv', 'Korv',
  'Lusk', 'Mirv', 'Nesk', 'Obr', 'Pruv', 'Quilm', 'Rozv', 'Selv', 'Tolv', 'Urv', 'Vosk',
]);

/** Fins de patronyme, chacune ouverte par une voyelle. */
export const TERMINAISONS = Object.freeze([
  'oubre', 'ard', 'ière', 'ault', 'ignac', 'eron', 'ouze', 'ivet',
  'esson', 'ande', 'ichon', 'eval', 'otte', 'ançon', 'eux', 'umet',
]);

/** Têtes de nom d'organisation : le mot qui dit qu'il s'agit d'une organisation. */
export const TETES = Object.freeze([
  'Ateliers', 'Coopérative', 'Verrerie', 'Fonderie', 'Imprimerie', 'Brasserie',
  'Menuiserie', 'Papeterie', 'Filature', 'Tannerie', 'Comptoir', 'Fabrique',
]);

/** Racines forgées des noms d'organisation. */
export const RACINES = Object.freeze([
  'Aubrenc', 'Belvarre', 'Cassorgue', 'Dravenne', 'Estrolle', 'Falvigne', 'Gravelune',
  'Hostrenne', 'Ivoranche', 'Jolvane', 'Kalvenne', 'Lavorneau', 'Morvalle', 'Nervanche',
  'Olbrecq', 'Pravette', 'Quimvaux', 'Rossolde', 'Sorbagne', 'Tavrenne', 'Ulvardes',
  'Vaubrenne', 'Wassorel', 'Xandrelle', 'Yzorne', 'Zelvaine',
]);

/**
 * Trois patronymes forgés longs, hors du produit des fragments, qui éprouvent
 * la mise en page d'un nom (§ 11.5, § 15.4) : le premier en capitales larges,
 * M et W ; le deuxième chargé de diacritiques ; le troisième très long.
 */
export const NOMS_LONGS = Object.freeze([
  'WAMMERWOLM-MAWWEMMEL',
  'Bérêçàuvïlle-Dœûmôntëÿ',
  'Vandergrolcquesmirtavelle-Ostrovaubelindigues',
]);

/**
 * Patronymes forgés : le produit PREFIXES × TERMINAISONS, préfixe par
 * préfixe, chaque préfixe suivi de chaque terminaison dans l'ordre. Une liste
 * neuve à chaque appel.
 * @returns {string[]}
 */
export function patronymes() {
  return PREFIXES.flatMap((prefixe) => TERMINAISONS.map((terminaison) => prefixe + terminaison));
}

/**
 * Noms d'organisation : le produit TETES × RACINES, tête par tête, la tête et
 * la racine séparées par une espace. Une liste neuve à chaque appel.
 * @returns {string[]}
 */
export function organisations() {
  return TETES.flatMap((tete) => RACINES.map((racine) => `${tete} ${racine}`));
}
