// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le pont de la charge vers le moteur (§ 4.5, § 5.2, D6) : la configuration
// que lit le stockage, plus qui anime à chaque tour. Le stockage n'importe
// pas la règle des titres pourvus, qui vit dans l'analyseur CSV
// (pourvoyeursDesTitres) : l'application la lit ici, sans la recopier. Sous
// src/application, ce module est le seul appelant de
// configurationDepuisCharge, et configurationDe la seule configuration du
// moteur tirée d'une charge.
//
// Une personne anime au tour r quand elle pourvoit un titre de place à ce
// tour, quels que soient le libellé du titre et la forme de ses
// réservations : une réservation « tous les tours » sur la place titrée fait
// animer à chaque tour, R réservations de tour désigné aussi, une seule
// réservation de tour désigné à son seul tour. La règle des titres pourvus
// écarte les exclus, et chaque personne à ses tours d'absence : une
// animatrice absente au tour 3 n'y pourvoit rien, n'y anime pas, et la place
// titrée revient à qui la réserve à ce tour. Elle lit le réglage « Attribuer
// les sièges » : sans sièges attribués, une réservation sans siège à une
// table titrée pourvoit un titre de cette table ; avec, seule une réservation
// à la place titrée le pourvoit.
import { pourvoyeursDesTitres } from '../csv/import.js';
import { configurationDepuisCharge } from '../stockage/document.js';

/**
 * Les animateurs de la charge (D6), par identifiant croissant : chaque
 * personne qui pourvoit un titre de place à un tour au moins, avec ses tours
 * animés, de 1 à R, croissants et sans doublon — l'union, sur ses titres,
 * des tours où elle les pourvoit. Lu sur pourvoyeursDesTitres, tour par
 * tour : l'entrée tours[r − 1] d'un titre nomme qui le pourvoit au tour r ;
 * la répartition de la soirée seule n'y entre pas, elle ne voit pas les
 * réservations de tour désigné. Ne modifie pas la charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{id: number, tours: number[]}>}
 */
export function animateursDe(charge) {
  const R = charge.evenement.tours;
  // Par identifiant, un drapeau par tour : un titre pourvu deux fois au même
  // tour par la même personne ne compte qu'une fois.
  const anime = new Map();
  for (const { tours } of pourvoyeursDesTitres(charge)) {
    tours.forEach((reservation, rang) => {
      if (reservation === null) return;
      const { participant } = reservation;
      if (!anime.has(participant)) anime.set(participant, new Array(R).fill(false));
      anime.get(participant)[rang] = true;
    });
  }
  return [...anime.keys()]
    .sort((a, b) => a - b)
    .map((id) => ({ id, tours: anime.get(id).flatMap((drapeau, rang) => (drapeau ? [rang + 1] : [])) }));
}

/**
 * La configuration du moteur tirée d'une charge (contrat de données) : celle
 * de configurationDepuisCharge, où chaque animateur porte en plus anime, ses
 * tours animés (animateursDe), après ses autres clés. Les autres participants
 * n'en portent pas : une charge sans titre pourvu rend la configuration du
 * stockage telle quelle. Chaque liste de tours est neuve ; ne modifie pas la
 * charge.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {import('../moteur/types.js').Configuration}
 */
export function configurationDe(charge) {
  const configuration = configurationDepuisCharge(charge);
  const toursDe = new Map(animateursDe(charge).map(({ id, tours }) => [id, tours]));
  for (const participant of configuration.participants) {
    const tours = toursDe.get(participant.id);
    if (tours !== undefined) participant.anime = tours;
  }
  return configuration;
}
