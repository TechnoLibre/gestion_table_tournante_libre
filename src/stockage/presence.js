// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La présence par tour côté fichier (§ 8.9) : les absents de chaque tour
// qu'un placement écrit, et la présence d'une charge quand le nombre de tours
// change. La règle « champ presence absent = présente à tous les tours » se
// lit dans src/moteur/presence.js, et nulle part ici. Une exclue garde sa
// présence, suspendue : aucun absent ne la nomme, mais un changement du
// nombre de tours la rogne comme les autres. Aucune fonction ne modifie ce
// qu'elle reçoit ; aucune ne lit l'horloge ni un aléa.
import { estPresentAuTour, presenceCanonique } from '../moteur/presence.js';

const croissant = (a, b) => a - b;

/**
 * Les absents de chaque tour parmi des participants : absents[r − 1] porte
 * les identifiants des participants non exclus absents au tour r, croissants,
 * quel que soit l'ordre des participants ou de leur présence. Une liste par
 * tour, vide sans absent. Sert versFichier, qui écrit absents dans le
 * placement d'une proposition. Les listes rendues sont neuves.
 *
 * @param {ReadonlyArray<{id: number, exclu?: boolean, presence?: readonly number[]}>} participants
 * @param {number} tours  le nombre de tours de la soirée
 * @returns {number[][]}
 */
export function absentsParTour(participants, tours) {
  const comptes = participants.filter(({ exclu }) => exclu !== true);
  return Array.from({ length: tours }, (_, rang) =>
    comptes
      .filter((participant) => !estPresentAuTour(participant, rang + 1))
      .map(({ id }) => id)
      .sort(croissant),
  );
}

/**
 * La présence des participants après le passage à tours tours :
 * { participants, rognees, videes }. Chaque liste de présence se tronque à
 * 1..tours et se rend canonique (presenceCanonique), exclues comprises : une
 * liste qui couvre alors tous les tours perd le champ. rognees nomme chaque
 * présence qui change, { participant, avant, apres }, avant la liste reçue,
 * apres la liste rendue ou null quand le champ part, par identifiant
 * croissant. videes porte les identifiants, croissants, des NON exclues dont
 * la liste deviendrait vide : le geste qui change les tours la refuse, et
 * leur présence reste celle reçue, hors de rognees. Une exclue dont la liste
 * se viderait perd le champ, sans refus : sa présence est suspendue, sans
 * lecteur, et elle figure dans rognees avec apres null. Au même nombre de
 * tours ou au-delà, rien ne change : une présence énumérée ne s'étend pas
 * aux tours ajoutés.
 *
 * participants est une liste neuve, dans l'ordre reçu ; un participant dont
 * la présence change est un objet neuf, un autre est celui reçu. Pure : rien
 * de ce qui est reçu n'est modifié, et les listes de rognees sont neuves.
 * Lève TypeError quand tours n'est pas un entier ≥ 1.
 *
 * @template {{id: number, exclu: boolean, presence?: number[]}} P
 * @param {ReadonlyArray<P>} participants
 * @param {number} tours
 * @returns {{participants: P[], rognees: Array<{participant: number, avant: number[], apres: number[]|null}>,
 *            videes: number[]}}
 */
export function presencesSousTours(participants, tours) {
  if (!Number.isInteger(tours) || tours < 1) {
    throw new TypeError(`presencesSousTours : nombre de tours entier ≥ 1 attendu, reçu ${JSON.stringify(tours)}`);
  }
  const rognees = [];
  const videes = [];
  const rendus = participants.map((participant) => {
    const { presence } = participant;
    if (presence === undefined) return participant;
    const gardee = presence.filter((tour) => tour <= tours);
    if (gardee.length === 0 && participant.exclu !== true) {
      videes.push(participant.id);
      return participant;
    }
    const apres = gardee.length === 0 ? undefined : presenceCanonique(gardee, tours);
    if (apres !== undefined && apres.length === presence.length) return participant;
    rognees.push({ participant: participant.id, avant: [...presence], apres: apres ?? null });
    const rendu = { ...participant };
    if (apres === undefined) delete rendu.presence;
    else rendu.presence = apres;
    return rendu;
  });
  rognees.sort((a, b) => a.participant - b.participant);
  return { participants: rendus, rognees, videes: videes.sort(croissant) };
}
