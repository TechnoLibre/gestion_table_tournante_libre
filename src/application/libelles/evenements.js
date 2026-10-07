// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes de la création d'un événement, de ses états et du déblocage
// (§ 8.1, § 9, § 14.6) : refus et libellés figés. Un état inconnu lève
// RangeError, au lieu de se taire.
import { cite, nomEtat } from './aides.js';

export const TABLE = new Map([
  // --- Les refus de la création, des états et du déblocage (§ 8.1, § 9) -----
  ['PLAN_NON_BLOQUE', () => "Le plan n'est pas bloqué : il n'y a rien à débloquer."],
  ['DATE_INVALIDE', ({ date }) => `La date ${cite(String(date))} n'est pas un jour du calendrier, écrit AAAA-MM-JJ.`],
  ['SIEGES_INVALIDES', () => 'Une table compte au moins deux sièges.'],
  ['TOURS_INVALIDES', () => 'La soirée compte au moins un tour.'],
  ['AUCUNE_PROPOSITION', () => "Aucune proposition n'existe : l'état « Proposé » suit une génération."],
  ['AUCUN_RETENU', () => "Aucun placement n'est retenu : l'état « Retenu » suit le choix d'une proposition."],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['ENTREE_CREATION', ({ nom }) => `Création de l'événement ${cite(nom)}`],
  ['ENTREE_CHANGER_ETAT', ({ etat }) => `Plan passé à l'état ${cite(nomEtat(etat))}`],
  ['ENTREE_DEBLOQUER', ({ etat }) => `Plan débloqué, état ${cite(nomEtat(etat))}`],
]);
