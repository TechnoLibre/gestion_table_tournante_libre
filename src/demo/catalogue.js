// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les quatre démonstrations livrées (§ 15) et le générateur des démonstrations
// tirées. Une démonstration est une configuration (types.js) tirée d'une
// graine écrite dans sa définition (§ 15.5, point 2) : à graine égale,
// construire() rend la même configuration, faite d'objets neufs à chaque
// appel. Le catalogue n'essaie jamais d'autre graine que la sienne.
//
// Chaque construction tire d'un seul générateur, creerPcg32(graine,
// FLUX.DEMO), dans un ordre qui fait partie du contrat (§ 15.5, point 3) :
// insérer, retirer ou déplacer un tirage change tout ce qui le suit. Un
// tirage sans remise de k éléments d'un réservoir de n est le mélange partiel
// de Fisher et Yates sur une copie du réservoir : pour i de 0 à k − 1,
// l'élément i échange sa place avec l'élément i + borne(n − i) ; les k
// premiers sont rendus dans cet ordre.
import { ErreurConfiguration } from '../moteur/erreurs.js';
import { faisabilite, somme, tirerTailles, tourTemoin } from './appartenances.js';
import { NOMS_LONGS, PRENOMS, organisations, patronymes } from './noms.js';
import { FLUX, creerPcg32 } from './prng.js';

// Graine de la grande démonstration, partagée par sa variante.
const GRAINE_GRANDE = 1;
// Graine de la petite démonstration, partagée par sa variante.
const GRAINE_PETITE = 2;

// 33 tables : les 29 premières de 8 sièges, les tables 30 à 33 de 7 (§ 15.1).
// La variante : 33 tables de 8. Les deux tirent 260 membres sur 4 tours.
const CAPACITES_GRANDE = Object.freeze([...Array(29).fill(8), ...Array(4).fill(7)]);
const CAPACITES_SANS_EXCEPTION = Object.freeze(Array(33).fill(8));
const DEFINITION_GRANDE = Object.freeze({ effectif: 260, capacites: CAPACITES_GRANDE, tours: 4 });
const DEFINITION_SANS_EXCEPTION = Object.freeze({
  effectif: 260,
  capacites: CAPACITES_SANS_EXCEPTION,
  tours: 4,
});

// Appartenances A, B et C de la petite démonstration (§ 15.3), puis celles de
// la variante, où la personne 10 passe de C à A.
const GROUPES_PETITE = [[1, 5, 8, 12], [2, 4, 9, 11], [3, 6, 7, 10]];
const GROUPES_PETITE_CONFLIT = [[1, 5, 8, 10, 12], [2, 4, 9, 11], [3, 6, 7]];
const PETITE = { membres: 12, tables: 4, capacite: 3, tours: 4 };

// Les personnes qui portent NOMS_LONGS, par identifiant (§ 15.4).
const NOM_LONG_DE = new Map([[7, NOMS_LONGS[0]], [77, NOMS_LONGS[1]], [177, NOMS_LONGS[2]]]);

// Identifiants de 1 à n, croissants.
const idsJusqua = (n) => Array.from({ length: n }, (_, rang) => rang + 1);

// Les quatre contraintes, toutes actives : un objet neuf à chaque appel.
function contraintesActives() {
  return {
    separerAppartenances: true,
    nouveauxVoisins: true,
    nouvelleTable: true,
    varierAppartenances: true,
  };
}

// k éléments tirés sans remise, par le mélange partiel décrit en tête : un
// borne() par élément tiré.
function tirerSansRemise(rng, reservoir, k) {
  const pile = [...reservoir];
  for (let i = 0; i < k; i += 1) {
    const j = i + rng.borne(pile.length - i);
    const element = pile[j];
    pile[j] = pile[i];
    pile[i] = element;
  }
  return pile.slice(0, k);
}

// Un prénom par personne, avec remise, dans l'ordre des ids : un borne()
// chacun.
function tirerPrenoms(rng, effectif) {
  return Array.from({ length: effectif }, () => PRENOMS[rng.borne(PRENOMS.length)]);
}

// Participants d'ids 1 à N, à partir des listes tirées, indexées par
// id − 1.
function participantsDe(noms, prenoms, appartenances) {
  return noms.map((nom, rang) => ({
    id: rang + 1,
    nom,
    prenom: prenoms[rang],
    appartenance: appartenances[rang],
  }));
}

// Tables d'ids et de numéros 1 à T, dans l'ordre des capacités.
function tablesDe(capacites) {
  return capacites.map((capacite, rang) => ({ id: rang + 1, numero: rang + 1, capacite }));
}

function exigerReservoir(reservoir, demandes, disponibles) {
  if (demandes > disponibles) {
    throw new ErreurConfiguration('DEMO_RESERVOIR', { reservoir, demandes, disponibles });
  }
}

// Refuse des tailles de groupe fixées dont l'une n'est pas un entier ≥ 1 ;
// l'erreur nomme la première par son rang.
function exigerTailles(tailles) {
  const rang = tailles.findIndex((taille) => !Number.isInteger(taille) || taille < 1);
  if (rang !== -1) {
    throw new RangeError(`tailles[${rang}] : entier ≥ 1 attendu, reçu ${String(tailles[rang])}`);
  }
}

/**
 * Démonstration tirée (§ 15.1, § 15.2) : des groupes de taille tirée, une
 * personne par membre, et un animateur ancré à chaque table.
 *
 * Tirages, dans l'ordre du contrat :
 * 1. les tailles de groupe, tirerTailles(rng, effectif), sauf quand la
 *    définition les fixe ;
 * 2. un patronyme par personne, sans remise ; les ids 7, 77 et 177 portent
 *    ensuite NOMS_LONGS, dans cet ordre, à la place du leur, sans autre
 *    tirage ;
 * 3. un prénom par personne, ids croissants, un borne() chacun ;
 * 4. un libellé d'organisation par groupe, sans remise, dans l'ordre des
 *    groupes ;
 * 5. un mélange des ids 1 à N : ses tailles[0] premiers forment le premier
 *    groupe, les suivants le deuxième, et ainsi de suite ;
 * 6. un mélange des ids 1 à N : ses T premiers sont les animateurs, le rang
 *    i réservé à la table i + 1 pour tous les tours, sans égard à son
 *    appartenance (§ 15.1).
 *
 * Après le tirage 1, et avant tout autre, la définition est refusée par
 * ErreurConfiguration, contrôlée dans cet ordre : DEMO_SANS_PARTICIPANT
 * (aucun membre), DEMO_SANS_TABLE (aucune table), DEMO_RESERVOIR (plus de
 * personnes que de patronymes, ou plus de groupes que d'organisations ;
 * détails reservoir, demandes, disponibles), DEMO_SANS_TOUR_TEMOIN (aucun
 * tour ne sépare toutes les appartenances ; détails graine et raison : la
 * première inégalité rompue de faisabilite, ou CONSTRUCTION quand les deux
 * tiennent et que tourTemoin ne trouve aucun tour). Le tour témoin porte sur
 * les tailles et les capacités ; les animateurs n'y entrent pas.
 *
 * @param {Object} definition
 * @param {number} definition.graine  entier de 0 à 2^32 − 1
 * @param {number[]} definition.capacites  sièges de chaque table ; la table
 *   de rang i reçoit l'id et le numéro i + 1
 * @param {number} definition.tours
 * @param {number} [definition.effectif]  membres, dont les groupes se tirent
 * @param {number[]} [definition.tailles]  tailles de groupe fixées, entiers
 *   ≥ 1, à la place du tirage 1 ; exclusives d'effectif
 * @returns {import('../moteur/types.js').Configuration}
 * @throws {TypeError} effectif et tailles donnés ensemble
 * @throws {RangeError} moins de membres que de tables, quand chaque table
 *   reçoit un animateur ; effectif qui n'est pas un entier ≥ 0 ; taille fixée
 *   qui n'est pas un entier ≥ 1 ; graine hors de son intervalle
 */
export function engendrer({ graine, capacites, tours, effectif, tailles: taillesFixees }) {
  if (effectif !== undefined && taillesFixees !== undefined) {
    throw new TypeError("définition : effectif et tailles s'excluent");
  }
  const rng = creerPcg32(graine, FLUX.DEMO);
  if (taillesFixees !== undefined) exigerTailles(taillesFixees);
  const tailles = taillesFixees ?? tirerTailles(rng, effectif);
  const N = somme(tailles);
  const T = capacites.length;
  if (N === 0) throw new ErreurConfiguration('DEMO_SANS_PARTICIPANT');
  if (T === 0) throw new ErreurConfiguration('DEMO_SANS_TABLE');
  if (N < T) throw new RangeError(`${N} membres pour ${T} tables : un animateur par table`);
  const reservoirNoms = patronymes();
  const reservoirOrganisations = organisations();
  exigerReservoir('patronymes', N, reservoirNoms.length);
  exigerReservoir('organisations', tailles.length, reservoirOrganisations.length);
  const verdict = faisabilite(tailles, capacites);
  if (!verdict.ok) {
    throw new ErreurConfiguration('DEMO_SANS_TOUR_TEMOIN', { graine, raison: verdict.raison });
  }
  if (tourTemoin(tailles, capacites) === null) {
    throw new ErreurConfiguration('DEMO_SANS_TOUR_TEMOIN', { graine, raison: 'CONSTRUCTION' });
  }

  const noms = tirerSansRemise(rng, reservoirNoms, N)
    .map((nom, rang) => NOM_LONG_DE.get(rang + 1) ?? nom);
  const prenoms = tirerPrenoms(rng, N);
  const libelles = tirerSansRemise(rng, reservoirOrganisations, tailles.length);
  const ordre = rng.melanger(idsJusqua(N));
  const animateurs = rng.melanger(idsJusqua(N));

  const appartenances = new Array(N);
  let rang = 0;
  for (let g = 0; g < tailles.length; g += 1) {
    for (let m = 0; m < tailles[g]; m += 1, rang += 1) appartenances[ordre[rang] - 1] = libelles[g];
  }
  return {
    participants: participantsDe(noms, prenoms, appartenances),
    tables: tablesDe(capacites),
    tours,
    reservations: capacites.map((_, t) => ({
      participant: animateurs[t],
      table: t + 1,
      portee: 'tous',
    })),
    contraintes: contraintesActives(),
  };
}

// Petite démonstration (§ 15.3) : 12 personnes en appartenances fixées à la
// main, 4 tables de 3, 4 tours, aucune réservation. Tirages, dans l'ordre :
// un patronyme par personne, sans remise ; un prénom par personne, ids
// croissants, un borne() chacun ; un libellé d'organisation par groupe, sans
// remise, dans l'ordre des groupes.
function construirePetite(graine, groupes) {
  const rng = creerPcg32(graine, FLUX.DEMO);
  const noms = tirerSansRemise(rng, patronymes(), PETITE.membres);
  const prenoms = tirerPrenoms(rng, PETITE.membres);
  const libelles = tirerSansRemise(rng, organisations(), groupes.length);
  const appartenances = new Array(PETITE.membres);
  groupes.forEach((ids, g) => {
    for (const id of ids) appartenances[id - 1] = libelles[g];
  });
  return {
    participants: participantsDe(noms, prenoms, appartenances),
    tables: tablesDe(Array(PETITE.tables).fill(PETITE.capacite)),
    tours: PETITE.tours,
    reservations: [],
    contraintes: contraintesActives(),
  };
}

// Entrée figée du catalogue ; construire() tire avec la graine de l'entrée.
function entree(cle, nom, graine, construire) {
  return Object.freeze({ cle, nom, graine, construire: () => construire(graine) });
}

/**
 * Les quatre démonstrations livrées (§ 15), dans l'ordre de présentation :
 * { cle, nom, graine, construire() }. Les quatre activent toutes les
 * contraintes. La variante sans exception reprend les tirages de la grande
 * avec 33 tables de 8 ; la variante conflit reprend ceux de la petite, la
 * personne 10 passée de C à A.
 */
export const CATALOGUE = Object.freeze([
  entree('grande', 'Grande démonstration', GRAINE_GRANDE,
    (graine) => engendrer({ graine, ...DEFINITION_GRANDE })),
  entree('grande-sans-exception', 'Grande démonstration sans exception', GRAINE_GRANDE,
    (graine) => engendrer({ graine, ...DEFINITION_SANS_EXCEPTION })),
  entree('petite', 'Petite démonstration', GRAINE_PETITE,
    (graine) => construirePetite(graine, GROUPES_PETITE)),
  entree('petite-conflit', 'Petite démonstration, conflit inévitable', GRAINE_PETITE,
    (graine) => construirePetite(graine, GROUPES_PETITE_CONFLIT)),
]);

// Fige un tableau et, à toute profondeur, les tableaux qu'il contient.
function figer(tableau) {
  for (const element of tableau) if (Array.isArray(element)) figer(element);
  return Object.freeze(tableau);
}

/**
 * Le plan parfait de la petite démonstration (§ 15.3), en identifiants
 * (§ 8.9) : à chaque tour, chaque table réunit un membre de A, de B et de C,
 * et aucune paire ne se retrouve. Figé à toute profondeur.
 * @type {import('../moteur/types.js').Plan}
 */
export const PLAN_PARFAIT_PETITE = Object.freeze({
  tables: figer([1, 2, 3, 4]),
  tours: figer([
    [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
    [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
    [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
    [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]],
  ]),
  reserves: figer([[], [], [], []]),
});
