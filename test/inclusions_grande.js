// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La fixture de mesure des inclusions (§ 4, § 5.4, § 14.10) : des listes
// d'inclusions posées sur la grande démonstration du catalogue, tirées d'un
// générateur de graine fixe et gardées dans
// test/fixtures/moteur/inclusions_grande.json. Le fichier fait foi : les
// empreintes de test/empreintes_moteur.js et les mesures le lisent, et
// tirerInclusions ne sert qu'à dire d'où il vient, ce qu'une épreuve
// vérifie.
//
// Le tirage, sur les participants par identifiant croissant, d'un seul
// creerPcg32(GRAINE, FLUX.DEMO) : une personne sur cinq, à partir de la
// première, porte trois inclusions de personnes, chacune tirée par borne(N)
// jusqu'à en trouver une autre qu'elle et que celles déjà tirées, puis une
// inclusion d'organisation, celle d'une personne tirée par borne(N) jusqu'à
// en trouver une qui porte une organisation autre que la sienne. Puis, sans
// rien tirer : la première cible de chacune des cinq premières porteuses
// l'inclut en retour, une rencontre demandée des deux côtés ; la première
// porteuse nomme en conflit l'organisation de sa première cible d'une autre
// organisation que la sienne, ce qui contredit cette inclusion ; le premier
// ancré inclut le dernier, qu'une autre table assied à chaque tour, ce qui la
// met hors d'atteinte.
//
// Le fichier ne nomme aucune organisation : les noms de la démonstration
// sont forgés, et ne s'écrivent qu'aux fichiers qui en sont engendrés
// (§ 15.6). Une entrée désigne une organisation par une personne qui la
// porte : {id, inclusionsParticipant?, organisationsDe?, conflitsDe?}, les
// deux derniers des identifiants dont les organisations font les inclusions
// d'organisation et les conflits. Chaque liste est rangée, croissante.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { FLUX, creerPcg32 } from '../src/demo/prng.js';

/** Le fichier de la fixture. */
export const CHEMIN_INCLUSIONS = fileURLToPath(new URL('./fixtures/moteur/inclusions_grande.json', import.meta.url));

/** La graine du tirage. */
export const GRAINE = 61;

// Une porteuse sur PAS, et ses lignes de personnes.
const PAS = 5;
const PERSONNES = 3;
// Les porteuses dont la première cible inclut en retour.
const RECIPROQUES = 5;

/**
 * La configuration de la grande démonstration du catalogue, neuve.
 *
 * @returns {import('../src/moteur/types.js').Configuration}
 */
export function grande() {
  return CATALOGUE.find(({ cle }) => cle === 'grande').construire();
}

/**
 * Les entrées que le tirage pose sur une configuration (en-tête du module) :
 * une par personne qui en porte, par identifiant croissant.
 *
 * @param {import('../src/moteur/types.js').Configuration} configuration
 * @param {number} [graine=GRAINE]
 * @returns {Array<{id: number, inclusionsParticipant?: number[], organisationsDe?: number[], conflitsDe?: number[]}>}
 */
export function tirerInclusions(configuration, graine = GRAINE) {
  const rng = creerPcg32(graine, FLUX.DEMO);
  const personnes = [...configuration.participants].sort((a, b) => a.id - b.id);
  const parId = new Map(personnes.map((personne) => [personne.id, personne]));
  const entrees = new Map();
  const entree = (id) => {
    if (!entrees.has(id)) entrees.set(id, { id });
    return entrees.get(id);
  };
  const ajouter = (id, champ, valeur) => {
    const e = entree(id);
    e[champ] = [...new Set([...(e[champ] ?? []), valeur])];
  };
  const porteuses = personnes.filter((_, rang) => rang % PAS === 0);
  const ciblesDe = new Map();
  for (const { id, organisation } of porteuses) {
    const cibles = [];
    while (cibles.length < PERSONNES) {
      const autre = personnes[rng.borne(personnes.length)].id;
      if (autre !== id && !cibles.includes(autre)) cibles.push(autre);
    }
    ciblesDe.set(id, cibles);
    for (const cible of cibles) ajouter(id, 'inclusionsParticipant', cible);
    let membre = id;
    while (parId.get(membre).organisation === null || parId.get(membre).organisation === organisation) {
      membre = personnes[rng.borne(personnes.length)].id;
    }
    ajouter(id, 'organisationsDe', membre);
  }
  for (const { id } of porteuses.slice(0, RECIPROQUES)) ajouter(ciblesDe.get(id)[0], 'inclusionsParticipant', id);
  const [premiere] = porteuses;
  const contredite = ciblesDe.get(premiere.id).find((cible) => {
    const { organisation } = parId.get(cible);
    return organisation !== null && organisation !== premiere.organisation;
  });
  ajouter(premiere.id, 'conflitsDe', contredite);
  const ancres = configuration.reservations.filter(({ portee }) => portee === 'tous').map(({ participant }) => participant).sort((a, b) => a - b);
  ajouter(ancres[0], 'inclusionsParticipant', ancres.at(-1));
  const croissante = (liste) => [...liste].sort((a, b) => a - b);
  return [...entrees.values()]
    .sort((a, b) => a.id - b.id)
    .map((e) => ({
      id: e.id,
      ...(e.inclusionsParticipant === undefined ? {} : { inclusionsParticipant: croissante(e.inclusionsParticipant) }),
      ...(e.organisationsDe === undefined ? {} : { organisationsDe: croissante(e.organisationsDe) }),
      ...(e.conflitsDe === undefined ? {} : { conflitsDe: croissante(e.conflitsDe) }),
    }));
}

/**
 * Les entrées de la fixture, telles que le fichier les garde.
 *
 * @returns {ReturnType<typeof tirerInclusions>}
 */
export function lireInclusions() {
  return JSON.parse(readFileSync(CHEMIN_INCLUSIONS, 'utf8')).participants;
}

/**
 * La grande démonstration portant les listes de la fixture : chaque personne
 * nommée par une entrée reçoit ses inclusions de participant, et, sous les
 * noms de la configuration, les organisations des personnes que désignent
 * ses inclusions d'organisation et ses conflits.
 *
 * @returns {import('../src/moteur/types.js').Configuration}
 */
export function grandeAvecInclusions() {
  const configuration = grande();
  const organisationDe = new Map(configuration.participants.map(({ id, organisation }) => [id, organisation]));
  const organisations = (ids) => [...new Set(ids.map((id) => organisationDe.get(id)))].sort();
  const listes = new Map(
    lireInclusions().map(({ id, inclusionsParticipant, organisationsDe, conflitsDe }) => [
      id,
      {
        ...(inclusionsParticipant === undefined ? {} : { inclusionsParticipant }),
        ...(organisationsDe === undefined ? {} : { inclusionsOrganisation: organisations(organisationsDe) }),
        ...(conflitsDe === undefined ? {} : { conflits: organisations(conflitsDe) }),
      },
    ]),
  );
  configuration.participants = configuration.participants.map((personne) => ({ ...personne, ...(listes.get(personne.id) ?? {}) }));
  return configuration;
}
