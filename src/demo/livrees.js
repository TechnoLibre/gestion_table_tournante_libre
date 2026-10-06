// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les démonstrations livrées (§ 15, § 15.5) : le texte du fichier d'état de
// chaque démonstration du catalogue, tel que scripts/engendrer_livrables.js
// l'a écrit sous livrees/. Le fichier livré est la source de vérité (§ 15.5,
// point 5) : montrer une démonstration lit ce fichier, sans rejouer le
// générateur. Charger une démonstration crée un événement neuf depuis ce
// texte (§ 15) ; le texte, une chaîne, ne se modifie pas, et la
// démonstration d'origine non plus.
//
// Chaque fichier s'importe en module JSON, syntaxe du langage que Node et
// Vite lisent l'un comme l'autre : le module se charge sous Node seul, ce
// qu'exige le repli « node --test » du § 14.8, et un fichier absent casse
// la construction. Un module JSON rend le document, non ses octets : le
// sérialiseur canonique le réécrit sous son propre en-tête. Chaque fichier
// livré est en forme canonique, UTF-8 sans marque, fin de ligne LF ; le
// texte rendu est donc le sien, octet pour octet, ce que livrees.test.js
// exige sous Vitest comme sous Node seul.
//
// Chaque texte décrit l'événement demo:<clé>, à la révision 1, en brouillon,
// sans proposition.
import { serialiser } from '../stockage/canonique.js';
import grande from './livrees/grande.gtt.json' with { type: 'json' };
import grandeSansException from './livrees/grande-sans-exception.gtt.json' with { type: 'json' };
import petite from './livrees/petite.gtt.json' with { type: 'json' };
import petiteConflit from './livrees/petite-conflit.gtt.json' with { type: 'json' };

// Texte canonique d'un fichier d'état lu en module JSON : sa charge, sous la
// révision et la version de son en-tête ; format et comptes se recalculent.
const texteDe = ({ entete, charge }) => serialiser(charge, entete);

/**
 * Les quatre démonstrations livrées, dans l'ordre du catalogue
 * (catalogue.js) : { cle, texte }, figées ; cle est celle de l'entrée du
 * catalogue, texte le fichier d'état livré.
 * @type {ReadonlyArray<Readonly<{cle: string, texte: string}>>}
 */
export const LIVREES = Object.freeze([
  Object.freeze({ cle: 'grande', texte: texteDe(grande) }),
  Object.freeze({ cle: 'grande-sans-exception', texte: texteDe(grandeSansException) }),
  Object.freeze({ cle: 'petite', texte: texteDe(petite) }),
  Object.freeze({ cle: 'petite-conflit', texte: texteDe(petiteConflit) }),
]);

/**
 * Texte livré de la démonstration de clé donnée.
 *
 * @param {string} cle  la clé d'une entrée du catalogue
 * @returns {string}
 * @throws {RangeError} pour une clé qu'aucune démonstration livrée ne porte
 */
export function texteLivre(cle) {
  const livree = LIVREES.find((candidate) => candidate.cle === cle);
  if (livree === undefined) throw new RangeError(`aucune démonstration livrée de clé ${JSON.stringify(cle)}`);
  return livree.texte;
}
