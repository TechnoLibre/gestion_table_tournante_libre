// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes de la création d'un événement, de ses états et du déblocage
// (§ 8.1, § 9, § 14.6), et ceux de la façade des événements (§ 8.6, § 8.7,
// § 15) : refus et libellés figés. Un état inconnu lève RangeError, au lieu
// de se taire.
import { causeEntreParentheses, cite, nomEtat } from './aides.js';

export const TABLE = new Map([
  // --- Les refus de la création, des états et du déblocage (§ 8.1, § 9) -----
  ['PLAN_NON_BLOQUE', () => "Le plan n'est pas bloqué : il n'y a rien à débloquer."],
  // longueur : les caractères du nom saisi ; maximum : NOM_EVENEMENT_MAX.
  [
    'NOM_EVENEMENT_TROP_LONG',
    ({ longueur, maximum }) => `Le nom compte ${longueur} caractères : celui d'un événement en compte au plus ${maximum}.`,
  ],
  ['DATE_INVALIDE', ({ date }) => `La date ${cite(String(date))} n'est pas un jour du calendrier, écrit AAAA-MM-JJ.`],
  ['SIEGES_INVALIDES', () => 'Une table compte au moins deux sièges.'],
  ['TOURS_INVALIDES', () => 'La soirée compte au moins un tour.'],
  ['AUCUNE_PROPOSITION', () => "Aucune proposition n'existe : l'état « Proposé » suit une génération."],
  ['AUCUN_RETENU', () => "Aucun placement n'est retenu : l'état « Retenu » suit le choix d'une proposition."],

  // --- La façade des événements (§ 8.6) --------------------------------------
  // question nomme le code de la question du dossier de travail qui attend.
  [
    'QUESTION_EN_ATTENTE',
    () => "Le dossier de travail attend une réponse : la liste des événements s'ouvre une fois la question répondue.",
  ],
  // dossier : le chemin affichable du dossier que l'événement a quitté, au
  // renommage ou à la suppression ; cause : NON_VIDE quand il porte encore
  // une entrée, sinon la cause du refus de le retirer (§ 8.7).
  [
    'DOSSIER_NON_RETIRE',
    ({ dossier, cause }, texte) =>
      cause === 'NON_VIDE'
        ? `L'événement a quitté le dossier ${cite(dossier)}, qui reste sur le disque : ` +
          "il porte encore un fichier que l'opération n'a pas emporté. Rien ne s'y est perdu."
        : `L'événement a quitté le dossier ${cite(dossier)}, qui n'a pas pu être retiré` +
          `${causeEntreParentheses(cause, texte)} : il reste sur le disque.`,
  ],
  [
    'EXPLORATEUR_ABSENT',
    () => "Sous la plateforme web, aucun explorateur de fichiers ne montre le dossier de travail : il vit dans le navigateur.",
  ],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['ENTREE_CREATION', ({ nom }) => `Création de l'événement ${cite(nom)}`],
  ['ENTREE_CHANGER_ETAT', ({ etat }) => `Plan passé à l'état ${cite(nomEtat(etat))}`],
  ['ENTREE_DEBLOQUER', ({ etat }) => `Plan débloqué, état ${cite(nomEtat(etat))}`],
  // source : le nom de l'événement copié ; instant : le libellé de l'instant
  // copié (§ 8.7).
  ['ENTREE_COPIE', ({ source, instant }) => `Créée par copie de ${cite(source)}, à l'instant ${cite(instant)}`],
  ['ENTREE_RENOMMER', ({ ancien, nom }) => `Renommé de ${cite(ancien)} en ${cite(nom)}`],
  // nom : celui de la démonstration au catalogue, sans rang (§ 15).
  ['ENTREE_DEMONSTRATION', ({ nom }) => `Chargement de la démonstration ${cite(nom)}`],
]);
