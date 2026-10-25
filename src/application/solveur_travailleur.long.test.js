// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuve lourde du plancher exact (§ 5.6, § 14.12) : sur des charges
// tirées sous une graine écrite — 2 à 5 organisations, 2 à 5 tables de 2 à 6
// places, conflits, réservations, une personne seule en conflit, une
// absence —, le minimum que HiGHS rend pour chaque tour égale celui d'une
// recherche exhaustive par programmation dynamique sur les tables, (A) est
// faux exactement quand la recherche ne trouve aucun placement, et le
// plancher des étoiles (P1), ajouté à la somme par groupe, ne dépasse
// jamais la somme des minimums des tours : l'épreuve croisée des deux
// planchers. La recherche exhaustive ne lit que les unités, les sièges et le
// remplissage des données du tour, jamais leur cause d'infaisabilité.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { normaliser } from '../moteur/configuration.js';
import { creerCharge } from '../stockage/document.js';
import { configurationDe } from './configuration.js';
import { diagnostiquerCharge } from './diagnostic.js';
import { donneesDesTours } from './modele_tour.js';
import { plancherCollisionsTotal, planchersConflits } from './planchers_conflits.js';
import { chargerHighs, issueDuTour } from './solveur_travailleur.js';

// Graine des tirages, écrite ici (§ 14.12).
const GRAINE = 271_828;

const ORGANISATIONS = ['Club des Merles', 'Cercle des Hérons', 'Atelier des Loutres', 'Société des Castors', 'Amicale des Pluviers'];

const highs = await chargerHighs();

// C(x, 2), 0 et non −0 pour x < 2 : l'égalité stricte les distingue.
const paires = (x) => (x < 2 ? 0 : (x * (x - 1)) / 2);

/**
 * Le minimum des collisions du tour parmi ses placements sans conflit, par
 * une recherche exhaustive : table après table, chaque répartition des
 * libres restants de chaque unité dans les sièges libres de la table, rejetée
 * quand deux unités en conflit y siègent — réservés compris ; à la fin, chaque
 * libre assis et assez de sièges laissés pour le remplissage. Infinity quand
 * aucun placement n'existe.
 */
function minimumExhaustif({ T, s, unites, conflits, remplissage }) {
  const U = unites.length;
  const voisins = Array.from({ length: U }, () => new Set());
  for (const [i, j] of conflits) {
    voisins[i].add(j);
    voisins[j].add(i);
  }
  const memo = new Map();
  const minimum = (t, restants, laisses) => {
    if (t === T) return restants.every((reste) => reste === 0) && laisses >= remplissage ? 0 : Infinity;
    const cle = `${t}|${restants.join(',')}|${Math.min(laisses, remplissage)}`;
    if (memo.has(cle)) return memo.get(cle);
    const y = new Array(U).fill(0);
    let meilleur = Infinity;
    const repartir = (u, sieges) => {
      if (u === U) {
        const ici = [];
        for (let v = 0; v < U; v += 1) if (unites[v].a[t] > 0 || y[v] > 0) ici.push(v);
        if (ici.some((v) => ici.some((w) => voisins[v].has(w)))) return;
        let cout = 0;
        for (let v = 0; v < U; v += 1) if (unites[v].groupe >= 0) cout += paires(unites[v].a[t] + y[v]);
        const suite = minimum(t + 1, restants.map((reste, v) => reste - y[v]), laisses + sieges);
        if (cout + suite < meilleur) meilleur = cout + suite;
        return;
      }
      for (let k = 0; k <= Math.min(restants[u], sieges); k += 1) {
        y[u] = k;
        repartir(u + 1, sieges - k);
      }
      y[u] = 0;
    };
    repartir(0, s[t]);
    memo.set(cle, meilleur);
    return meilleur;
  };
  return minimum(0, unites.map(({ m }) => m), 0);
}

// Une charge de deux tours, tirée.
const CHARGE_TIREE = fc.record({
  effectifs: fc.array(fc.integer({ min: 1, max: 5 }), { minLength: 2, maxLength: 5 }),
  capacites: fc.array(fc.integer({ min: 2, max: 6 }), { minLength: 2, maxLength: 5 }),
  sansOrganisation: fc.integer({ min: 0, max: 2 }),
  conflits: fc.array(fc.boolean(), { minLength: 10, maxLength: 10 }),
  seul: fc.option(fc.array(fc.boolean(), { minLength: 5, maxLength: 5 }), { nil: null }),
  reservation: fc.option(fc.record({ rang: fc.nat(40), table: fc.nat(4), aUnTour: fc.boolean() }), { nil: null }),
  absence: fc.option(fc.nat(40), { nil: null }),
  manque: fc.integer({ min: 0, max: 4 }),
});

// La charge d'un tirage : chaque organisation présente nomme, par son
// premier membre, les organisations présentes d'après avec qui le tirage la
// met en conflit. Hors d'un tirage sur cinq (manque à 0), les personnes au-delà
// des places ne viennent pas : les tours sans placement tiennent alors aux
// conflits et aux réservations, non au manque de places.
function chargeDuTirage({ effectifs, capacites, sansOrganisation, conflits, seul, reservation, absence, manque }) {
  const charge = creerCharge({ id: 'evt-oracle', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours: 2 });
  const places = capacites.reduce((somme, c) => somme + c, 0) - (seul === null ? 0 : 1);
  const tous = [...effectifs.flatMap((n, g) => Array(n).fill(ORGANISATIONS[g])), ...Array(sansOrganisation).fill(null)];
  const organisations = manque === 0 ? tous : tous.slice(0, places);
  const G = new Set(organisations.filter((organisation) => organisation !== null)).size;
  charge.participants = organisations.map((organisation, rang) => ({
    id: rang + 1,
    nom: `Grèbe${rang + 1}`,
    prenom: 'Iris',
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  let paire = 0;
  for (let g = 0; g < G; g += 1) {
    const nommees = [];
    for (let h = g + 1; h < 5; h += 1, paire += 1) if (h < G && conflits[paire]) nommees.push(ORGANISATIONS[h]);
    if (nommees.length > 0) charge.participants.find((membre) => membre.organisation === ORGANISATIONS[g]).conflits = nommees;
  }
  const nommeesParLeSeul = seul === null ? [] : ORGANISATIONS.slice(0, G).filter((_, g) => seul[g]);
  if (nommeesParLeSeul.length > 0) {
    const id = charge.participants.length + 1;
    charge.participants.push({ id, nom: `Grèbe${id}`, prenom: 'Iris', organisation: null, courriel: null, titrePressenti: null, notes: null, exclu: false, conflits: nommeesParLeSeul });
  }
  const N = charge.participants.length;
  charge.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
  if (reservation !== null) {
    const { rang, table, aUnTour } = reservation;
    charge.reservations = [{ participant: (rang % N) + 1, table: (table % capacites.length) + 1, siege: null, portee: aUnTour ? 'tour' : 'tous', tour: aUnTour ? 1 : null }];
  }
  if (absence !== null) charge.participants[absence % N].presence = [1];
  charge.reglages.separerOrganisations = true;
  charge.prochainsIds = { participant: N + 1, table: capacites.length + 1, proposition: 1 };
  return charge;
}

describe('le plancher exact contre la recherche exhaustive (§ 5.6)', () => {
  test('sur 500 charges de deux tours tirées : même minimum par tour, (A) faux exactement sans placement, P1 au plus la somme des minimums', () => {
    const comptes = { exacts: 0, parConflit: 0, places: 0, chargesComparees: 0, etoiles: 0 };
    fc.assert(
      fc.property(CHARGE_TIREE, (tirage) => {
        const charge = chargeDuTirage(tirage);
        const tours = donneesDesTours(normaliser(configurationDe(charge)));
        const cache = new Map();
        let somme = 0;
        for (const tour of tours) {
          const attendu = minimumExhaustif(tour);
          const issue = issueDuTour(highs, tour, { cache });
          assert.equal(issue.faisable, attendu !== Infinity, JSON.stringify(tour));
          if (attendu === Infinity) {
            assert.equal(issue.minimum, null);
            comptes[issue.cause === 'places' ? 'places' : 'parConflit'] += 1;
            somme = Infinity;
            continue;
          }
          assert.equal(issue.cause, null);
          assert.equal(issue.minimum, attendu, JSON.stringify(tour));
          comptes.exacts += 1;
          somme += attendu;
        }
        if (somme === Infinity) return;
        const { diagnostic } = diagnostiquerCharge(charge);
        const etoiles = planchersConflits(charge);
        assert.ok(plancherCollisionsTotal(diagnostic.collisions, etoiles) <= somme);
        comptes.chargesComparees += 1;
        if (etoiles.some(({ gain }) => gain > 0)) comptes.etoiles += 1;
      }),
      { seed: GRAINE, numRuns: 500 },
    );
    // Le tirage couvre chaque issue : des minimums, des tours que les conflits
    // ou les réservations privent de tout placement, des manques de places,
    // des charges où P1 se compare, et parmi elles des étoiles à gain, où
    // P1 dépasse la somme par groupe.
    assert.ok(comptes.exacts >= 500, JSON.stringify(comptes));
    assert.ok(comptes.parConflit >= 80, JSON.stringify(comptes));
    assert.ok(comptes.places >= 40, JSON.stringify(comptes));
    assert.ok(comptes.chargesComparees >= 250, JSON.stringify(comptes));
    assert.ok(comptes.etoiles >= 30, JSON.stringify(comptes));
  });
});
