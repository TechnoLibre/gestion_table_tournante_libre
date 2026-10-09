// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le témoin de la planche (§ 15.1, § 11.5) : 260 personnes inventées,
// « Témoin 001 » à « Témoin 260 », dont 3 exclues, sur la salle de la grande
// démonstration — 33 tables, 29 de 8 sièges et 4 de 7 —, 4 tours, et un
// placement retenu, daté, sur un plan retenu. Les 257 badges qu'il produit
// donnent 65 planches A4 et 129 planches Lettre (§ 15.1).
//
// Chaque personne porte un courriel, des notes et un titre pressenti, que le
// badge ne doit jamais imprimer (§ 11.4), et une personne sur cinq une
// appartenance. Le plan du tour r range les 257 présentes à partir du rang
// 64 × (r − 1), en boucle, et remplit les tables dans l'ordre de leurs
// identifiants : chaque tour est une partition, les trois sièges libres
// tombent à la dernière table. Aucune réservation, aucun titre. Chaque appel
// rend une charge neuve.
import { creerCharge } from '../../../src/stockage/document.js';
import { H_RETENU, personne, placementDe, table } from './cas.js';

/** Les comptes du témoin, que les épreuves lisent plutôt que de les écrire. */
export const FORME_TEMOIN = Object.freeze({
  participants: 260,
  exclus: 3,
  produits: 257,
  tables: 33,
  tours: 4,
  planchesA4: 65,
  planchesLettre: 129,
});

/** Les identifiants des trois personnes exclues. */
export const EXCLUS_TEMOIN = Object.freeze([50, 150, 250]);

const DECALAGE_PAR_TOUR = 64;

/** Le numéro d'une personne du témoin, sur trois chiffres. */
export const numeroTemoin = (id) => String(id).padStart(3, '0');

/**
 * La charge du témoin, état retenu, retenu daté de H_RETENU.
 *
 * @returns {import('../../../src/stockage/types.js').Charge}
 */
export function chargeTemoin() {
  const { participants, tables, tours } = FORME_TEMOIN;
  const charge = creerCharge({ id: 'evt-temoin', nom: 'Soirée des Lucioles', date: '2031-05-17', siegesParDefaut: 8, tours });
  charge.evenement.etat = 'retenu';
  charge.participants = Array.from({ length: participants }, (_, rang) => {
    const id = rang + 1;
    const n = numeroTemoin(id);
    return personne(id, null, `Témoin ${n}`, {
      appartenance: id % 5 === 0 ? 'Club des Merles' : null,
      courriel: `temoin${n}@exemple.test`,
      titrePressenti: `pressenti ${n}`,
      notes: `note confidentielle ${n}`,
      exclu: EXCLUS_TEMOIN.includes(id),
    });
  });
  charge.tables = Array.from({ length: tables }, (_, rang) => table(rang + 1, rang + 1, rang < 29 ? null : 7));
  const presents = charge.participants.filter(({ exclu }) => !exclu).map(({ id }) => id);
  const plan = Array.from({ length: tours }, (_, r) => {
    const debut = (DECALAGE_PAR_TOUR * r) % presents.length;
    const ordre = [...presents.slice(debut), ...presents.slice(0, debut)];
    let rang = 0;
    const sieges = charge.tables.map((enregistrement) => {
      const liste = ordre.slice(rang, rang + (enregistrement.sieges ?? 8));
      rang += liste.length;
      return liste;
    });
    return { sieges };
  });
  charge.prochainsIds = { participant: participants + 1, table: tables + 1, proposition: 2 };
  charge.retenu = { proposition: 1, ...placementDe(charge, plan), horodatage: H_RETENU };
  return charge;
}
