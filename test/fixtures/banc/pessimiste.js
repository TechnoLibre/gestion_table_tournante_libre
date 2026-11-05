// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La configuration pessimiste du coût du plafond a priori (§ 17, point 4) :
// la salle de la variante sans exception, 33 tables de 8, et 260 personnes
// qui portent chacune deux tours fixés, sur 10 tours. Le plafond a priori se
// mémoïse par signature — statut, ancrage, multiensemble des tables fixées
// (src/moteur/plafond.js) — : ici chaque personne a la sienne, et la
// programmation dynamique se refait 260 fois, chacune sur 8 tours libres.
// C'est le cas que la mémoïsation ne rattrape pas, là où les démonstrations
// livrées n'ont que quelques signatures.
//
// La personne de rang i, de 0 à 259, est fixée à la table a = i mod 33 au
// tour 1 + (i mod 10), et à la table b = (a + d) mod 33 au tour
// 1 + ((i + 5) mod 10), où d = 1 + ⌊i / 33⌋ va de 1 à 8. La paire {a, b}
// détermine (a, d) tant que d ≤ 16 : les 260 paires sont distinctes, et les
// 260 signatures aussi. Les deux tours d'une personne diffèrent de 5. Aucune
// table ne reçoit plus de 8 personnes fixées au même tour : le moteur la
// normalise sans SURRESERVATION. Personne n'a d'organisation, et les quatre
// contraintes sont actives, comme dans les démonstrations.
//
// Les noms sont forgés : le produit de 20 prénoms et de 13 noms, hors des
// réservoirs de src/demo/noms.js.

/** Les nombres de la configuration, que ses épreuves affirment. */
export const FORME_PESSIMISTE = Object.freeze({ personnes: 260, tables: 33, capacite: 8, tours: 10 });

const PRENOMS = [
  'Iris', 'Théo', 'Ondine', 'Basile', 'Capucine', 'Aurèle', 'Mélisande', 'Firmin', 'Clélia', 'Anselme',
  'Bérénice', 'Cyprien', 'Daphné', 'Eudes', 'Flavie', 'Gaspard', 'Hortense', 'Ignace', 'Jacinthe', 'Lisandre',
];
const NOMS = [
  'Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Tourmaline', 'Arrosoir', 'Cerfeuil',
  'Bruyère', 'Galet', 'Mistral', 'Sarriette', 'Quenouille', 'Vermeil',
];

/**
 * La configuration pessimiste, sous la forme que le moteur reçoit
 * (src/moteur/types.js › Configuration) : un objet neuf à chaque appel.
 * Participants d'identifiants 1 à 260 ; tables d'identifiants et de numéros
 * 1 à 33 ; réservations de portée « tour », deux par personne, dans l'ordre
 * des personnes, la plus petite des deux tours d'abord.
 *
 * @returns {import('../../../src/moteur/types.js').Configuration}
 */
export function configurationPessimiste() {
  const { personnes, tables, capacite, tours } = FORME_PESSIMISTE;
  const participants = [];
  const reservations = [];
  for (let i = 0; i < personnes; i += 1) {
    const id = i + 1;
    participants.push({
      id,
      nom: NOMS[i % NOMS.length],
      prenom: PRENOMS[Math.floor(i / NOMS.length)],
      organisation: null,
    });
    const a = i % tables;
    const b = (a + 1 + Math.floor(i / tables)) % tables;
    const fixations = [
      { table: a + 1, tour: 1 + (i % tours) },
      { table: b + 1, tour: 1 + ((i + 5) % tours) },
    ].sort((x, y) => x.tour - y.tour);
    for (const { table, tour } of fixations) reservations.push({ participant: id, table, portee: 'tour', tour });
  }
  return {
    participants,
    tables: Array.from({ length: tables }, (_, t) => ({ id: t + 1, numero: t + 1, capacite })),
    tours,
    reservations,
    contraintes: {
      separerOrganisations: true,
      nouveauxVoisins: true,
      nouvelleTable: true,
      varierOrganisations: true,
    },
  };
}
