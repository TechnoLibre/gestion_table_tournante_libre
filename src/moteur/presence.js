// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La présence d'une personne par tour : la seule lecture de la règle « champ
// presence absent = présente à tous les tours ». Le moteur, le stockage, le
// CSV et l'application la lisent ici ; aucun autre module ne la redit.
//
// presence, quand le champ existe, est une liste non vide de tours de 1 à R,
// strictement croissante. Le contrôle de cette forme appartient à qui la
// reçoit (la normalisation du moteur, l'analyse du fichier) : les deux
// lectures ci-dessous ne contrôlent rien. presenceCanonique, elle, met en
// forme une saisie et refuse ce qui ne peut pas s'écrire. Le champ exclu
// n'est lu par aucune d'elles : une exclue garde sa présence, suspendue.

/**
 * Les tours de présence du participant, de 1 à R, croissants : sa présence
 * telle quelle, ou 1..R quand le champ manque (vaut undefined). Ne contrôle
 * rien ; la liste rendue est neuve, rien n'est partagé avec le participant.
 *
 * @param {{presence?: readonly number[]}} participant
 * @param {number} R  le nombre de tours de la soirée
 * @returns {number[]}
 */
export function toursDePresence(participant, R) {
  const { presence } = participant;
  if (presence === undefined) return Array.from({ length: R }, (_, rang) => rang + 1);
  return [...presence];
}

/**
 * Vrai quand le participant est présent au tour : toujours quand le champ
 * manque, sinon quand sa présence porte ce tour.
 *
 * @param {{presence?: readonly number[]}} participant
 * @param {number} tour  de 1 à R
 * @returns {boolean}
 */
export function estPresentAuTour(participant, tour) {
  const { presence } = participant;
  return presence === undefined || presence.includes(tour);
}

/**
 * La forme canonique d'une saisie de tours : triée, sans doublon, ou
 * undefined quand elle couvre 1..R, puisque le champ s'écrit alors absent.
 * Lève RangeError pour une liste vide, ou pour un tour qui n'est pas un
 * entier de 1 à R. La saisie n'est pas modifiée ; la liste rendue est neuve.
 *
 * @param {readonly number[]} liste
 * @param {number} R
 * @returns {number[] | undefined}
 */
export function presenceCanonique(liste, R) {
  if (liste.length === 0) throw new RangeError('présence vide : un tour au moins est attendu');
  for (const tour of liste) {
    if (!Number.isInteger(tour) || tour < 1 || tour > R) {
      throw new RangeError(`présence : tour ${JSON.stringify(tour)} hors des tours 1 à ${R}`);
    }
  }
  const triee = [...new Set(liste)].sort((a, b) => a - b);
  return triee.length === R ? undefined : triee;
}
