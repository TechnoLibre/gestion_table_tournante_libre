// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes du moteur qui n'ont pas leur table ailleurs, et les
// libellés de ses critères (§ 5, § 14.6).
import { compte } from './aides.js';

export const TABLE = new Map([
  // Une salle trop petite : avertissement d'un geste qui fait croître le
  // manque (A2), refus de la génération (A6) ; un seul texte pour les deux.
  [
    'PLACES_MANQUANTES',
    ({ placesManquantes }) =>
      `Il manque ${compte(placesManquantes, 'place', 'places')} à chaque tour pour asseoir toutes les personnes : ` +
      'ajouter des tables ou des sièges, ou exclure des personnes, rend la génération possible.',
  ],
  [
    'SURRESERVATION',
    ({ table, tour, reservees, capacite }) =>
      `La table d'identifiant ${table} reçoit ${compte(reservees, 'personne réservée', 'personnes réservées')} ` +
      `au tour ${tour}, pour ${compte(capacite, 'place', 'places')}.`,
  ],
]);
