// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de la carte « Absentes » du plan (§ 7.1), sans DOM : les
// personnes que l'état des places du tour dit absentes (EtatPlaces.absents :
// non exclues, absentes au tour, croissantes), chacune avec son nom affiché
// et sa présence saisie. Une absente n'a ni chaise ni place en réserve, et
// ne se choisit pas pour être placée : la carte ne mène qu'à sa fiche.
import { presenceSaisie } from '../../application/places.js';
import { nomDeCharge } from './vue_plan.js';

/**
 * Les absentes du tour, dans l'ordre d'etatTour.absents, sans nouveau tri :
 * l'identifiant, le nom affiché (nomDeCharge) et la présence saisie
 * (presenceSaisie : les tours de présence, croissants, ou null pour tous).
 * [] quand le tour n'a pas d'absente. Ni l'état ni la charge ne sont
 * modifiés.
 *
 * @param {{absents: number[]}} etatTour   EtatPlaces du tour montré
 * @param {Object} charge   la charge de la séance
 * @returns {Array<{id: number, nom: string, presence: number[]|null}>}
 */
export function absentesDuTour(etatTour, charge) {
  if (etatTour.absents.length === 0) return [];
  const nomDe = nomDeCharge(charge);
  const personnes = new Map(charge.participants.map((personne) => [personne.id, personne]));
  return etatTour.absents.map((id) => ({ id, nom: nomDe(id), presence: presenceSaisie(personnes.get(id)) }));
}
