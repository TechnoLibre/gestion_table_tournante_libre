// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes de la génération et des propositions (§ 5.7,
// § 14.6) : refus et libellés figés. Cette table ne porte que des codes.
import { compte } from './aides.js';

export const TABLE = new Map([
  // --- Les refus des propositions (§ 5.7) ------------------------------------
  ['PROPOSITION_INCONNUE', ({ id }) => `La proposition n° ${id} n'est pas dans cet événement.`],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  [
    'ENTREE_ENREGISTRER_GENERATION',
    ({ n, premier, dernier }) =>
      `Généré ${compte(n, 'proposition', 'propositions')} ` +
      `(n° ${premier === dernier ? premier : `${premier} à ${dernier}`})`,
  ],
  ['ENTREE_RETENIR_PROPOSITION', ({ id }) => `Retenu la proposition n° ${id}`],
  [
    'ENTREE_EFFACER_PROPOSITIONS',
    ({ n, gardee }) =>
      `Effacé ${compte(n, 'proposition', 'propositions')}` +
      `${gardee === null || gardee === undefined ? '' : `, gardé la retenue (n° ${gardee})`}`,
  ],
]);
