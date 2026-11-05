// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuve de propriété de la dérivée sous la présence par tour (§ 5.7,
// § 5.8) : sur une petite charge, sièges attribués ou non, une proposition
// retenue et des tours figés tirés, des suites tirées de gestes — ajout à
// présence tirée, changement de présence, exclusion, réintégration,
// suppression, réservation de tour ou de siège ; un geste refusé est sauté.
// Après chaque suite, depuis la proposition retenue : le départ n'est
// refusé que pour des places manquantes ; la génération aboutit, sans tour
// figé différent ; chaque dérivée tient les invariants sous ses réserves
// imposées ; chaque personne assise au départ ajusté garde sa chaise à
// chaque tour figé ; le retenu ne dérive par aucun de ses participants. Le
// générateur est congruentiel, à graine fixe ; les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { normaliser, placesManquantesParTour } from '../moteur/configuration.js';
import { rechercher, repartir } from '../moteur/recherche.js';
import { verifierInvariants } from '../moteur/verification.js';
import { configurationDepuisCharge, creerCharge } from '../stockage/document.js';
import { RAISONS_DE_PARTICIPANTS, derive, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { COMMANDES, ErreurCommande } from './commandes.js';
import { departAdapte, departDuMoteur, refusDuDepart } from './depart.js';

const V1 = VERSION.affichee;

const PRENOMS = ['Aurèle', 'Églantine', 'Faustine', 'Gaspard', 'Hortense', 'Anouk', 'Basile', 'Capucine', 'Théo'];
const NOMS = ['Pimprenelle', 'Cormier', 'Lupin', 'Ombrelle', 'Sarcelle', 'Mélèze', 'Grisaille', 'Bruyère', 'Ancolie'];

const TOURS = 3;
const TABLES = 3;
const SIEGES = 3;
const GRAINES = 60;
const SUITES = 3;
const GESTES = 5;

// Un congruentiel linéaire sur 2^32 : tirer(n) rend un entier de 0 à n − 1.
function generateur(graine) {
  let etat = graine >>> 0;
  return (n) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0;
    return Math.floor((etat / 2 ** 32) * n);
  };
}

// Une partie tirée de 1..TOURS, croissante : non vide, ou toute la soirée
// exclue quand propre est vrai.
function tours(tirer, { propre = false } = {}) {
  for (;;) {
    const partie = [];
    for (let tour = 1; tour <= TOURS; tour += 1) if (tirer(2) === 1) partie.push(tour);
    if (partie.length > 0 && !(propre && partie.length === TOURS)) return partie;
  }
}

const executer = (charge, nom, args) => COMMANDES.get(nom)(charge, args).charge;

// La charge rendue par le geste, ou celle reçue quand le geste est refusé.
function tenter(charge, nom, args) {
  try {
    return executer(charge, nom, args);
  } catch (erreur) {
    if (erreur instanceof ErreurCommande) return charge;
    throw erreur;
  }
}

// Sept personnes, trois tables de trois places, trois tours ; la proposition
// n° 1, retenue.
function chargeDeDepart(graine, attribuerSieges) {
  const charge = creerCharge({ id: `evt-presence-${graine}`, nom: 'Soirée des Sarcelles', siegesParDefaut: SIEGES, tours: TOURS });
  charge.participants = Array.from({ length: 7 }, (_, rang) => ({
    id: rang + 1,
    nom: NOMS[rang],
    prenom: PRENOMS[rang],
    organisation: rang % 2 === 0 ? 'Atelier Ressac' : 'Coopérative Aubier',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = Array.from({ length: TABLES }, (_, rang) => ({
    id: rang + 1,
    numero: rang + 1,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * rang, y: 0 },
  }));
  charge.prochainsIds = { participant: 8, table: TABLES + 1, proposition: 1 };
  charge.reglages.attribuerSieges = attribuerSieges;
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine, arret: 60, nombre: 1 });
  const generee = executer(charge, 'enregistrerGeneration', { propositions, configuration, produitVersion: V1 });
  return executer(generee, 'retenirProposition', { id: 1 });
}

// Un geste tiré, appliqué ; refusé, sauté.
function geste(charge, tirer) {
  const personnes = charge.participants;
  const une = (liste) => liste[tirer(liste.length)];
  switch (tirer(6)) {
    case 0: {
      const rang = charge.prochainsIds.participant % NOMS.length;
      const presence = tirer(2) === 0 ? null : tours(tirer);
      return tenter(charge, 'ajouterParticipant', { champs: { nom: NOMS[rang], prenom: PRENOMS[rang] }, presence });
    }
    case 1:
      return tenter(charge, 'changerPresence', { id: une(personnes).id, tours: tirer(3) === 0 ? null : tours(tirer) });
    case 2: {
      const presentes = personnes.filter(({ exclu }) => !exclu);
      return presentes.length === 0 ? charge : tenter(charge, 'exclureParticipant', { id: une(presentes).id });
    }
    case 3: {
      const exclues = personnes.filter(({ exclu }) => exclu);
      return exclues.length === 0 ? charge : tenter(charge, 'reintegrerParticipant', { id: une(exclues).id });
    }
    case 4:
      return tenter(charge, 'supprimerParticipant', { id: une(personnes).id });
    default:
      return reservationTiree(charge, tirer);
  }
}

// Une réservation d'un tour tirée, que le départ ne contredit pas : pour une
// arrivante — en réserve au départ ajusté —, une table et un siège tirés ;
// pour une personne assise au départ ajusté, sa table et son siège.
function reservationTiree(charge, tirer) {
  const adapte = departAdapte(charge, 1);
  const tour = 1 + tirer(TOURS);
  const { sieges, reserve } = adapte.placement[tour - 1];
  const parSiege = charge.reglages.attribuerSieges;
  if (reserve.length > 0 && tirer(2) === 0) {
    const participant = reserve[tirer(reserve.length)];
    const siege = parSiege && tirer(2) === 0 ? 1 + tirer(SIEGES) : null;
    return tenter(charge, 'reserver', { participant, table: 1 + tirer(TABLES), siege, portee: 'tour', tour });
  }
  const assises = sieges.flatMap((liste, rang) =>
    liste.flatMap((participant, chaise) => (participant === null ? [] : [{ participant, rang, chaise }])),
  );
  if (assises.length === 0) return charge;
  const { participant, rang, chaise } = assises[tirer(assises.length)];
  const siege = parSiege && adapte.siegesAttribues ? chaise + 1 : null;
  return tenter(charge, 'reserver', { participant, table: adapte.tables[rang], siege, portee: 'tour', tour });
}

// Les places manquantes de la charge : vrai quand un tour n'assied pas ses
// présentes. Une configuration que normaliser refuse lève.
const placesManquantes = (charge) => Math.max(...placesManquantesParTour(normaliser(configurationDepuisCharge(charge)))) > 0;

describe('présence par tour : la dérivée d’un départ que les gestes ont fait dériver (§ 5.7, § 5.8)', () => {
  test('après chaque suite tirée de gestes, le départ part, la génération aboutit, chaque dérivée tient ses invariants et garde les chaises du départ ajusté aux tours figés ; le retenu ne dérive par aucun participant', () => {
    const comptes = { generations: 0, imposees: 0, arrivantesFigees: 0, manques: 0 };
    for (let graine = 1; graine <= GRAINES; graine += 1) {
      const tirer = generateur(20261019 + graine);
      const attribuerSieges = graine % 2 === 0;
      const toursFiges = tours(tirer, { propre: true });
      let charge = chargeDeDepart(graine, attribuerSieges);
      for (let suite = 1; suite <= SUITES; suite += 1) {
        const ici = `graine ${graine}, suite ${suite}, figés ${toursFiges}`;
        for (let rang = 0; rang < GESTES; rang += 1) charge = geste(charge, tirer);
        const raisons = derive(charge.retenu, charge).filter(({ code }) => RAISONS_DE_PARTICIPANTS.has(code));
        assert.deepEqual(raisons, [], `${ici} : le retenu dérive par ses participants`);
        if (placesManquantes(charge)) {
          comptes.manques += 1;
          continue;
        }
        assert.equal(refusDuDepart(charge, { id: 1, toursFiges }), null, ici);
        const configuration = configurationDepuisCharge(charge);
        const instance = normaliser(configuration);
        const depart = departDuMoteur(charge, { id: 1, toursFiges });
        const adapte = departAdapte(charge, 1);
        const propositions = repartir(configuration, { graine: graine + suite, nombre: 2, arret: 80 }, depart);
        for (const { plan } of propositions) {
          assert.deepEqual(verifierInvariants(instance, plan, { reservesImposees: depart.reservesImposees }), [], ici);
        }
        const avant = charge.propositions.length;
        charge = executer(charge, 'enregistrerGeneration', {
          propositions,
          configuration,
          produitVersion: V1,
          derivation: { depart: 1, toursFiges },
        });
        comptes.generations += 1;
        comptes.imposees += depart.reservesImposees.length;
        const ordonnee = adapte.siegesAttribues && charge.reglages.attribuerSieges;
        for (const derivee of charge.propositions.slice(avant)) {
          assert.deepEqual(
            verifierInvariants(instance, planDepuisFichier(derivee), { reservesImposees: depart.reservesImposees }),
            [],
            `${ici}, n° ${derivee.id}`,
          );
          for (const tour of toursFiges) {
            comptes.arrivantesFigees += adapte.placement[tour - 1].reserve.length;
            adapte.tables.forEach((table, rang) => {
              const liste = derivee.placement[tour - 1].sieges[derivee.tables.indexOf(table)];
              adapte.placement[tour - 1].sieges[rang].forEach((participant, chaise) => {
                if (participant === null) return;
                const garde = ordonnee ? liste[chaise] === participant : liste.includes(participant);
                assert.ok(garde, `${ici}, n° ${derivee.id}, tour ${tour} : ${participant} quitte sa chaise de la table ${table}`);
              });
            });
          }
        }
      }
    }
    assert.ok(comptes.generations >= GRAINES, JSON.stringify(comptes));
    assert.ok(comptes.imposees > 0, `aucune réserve imposée : ${JSON.stringify(comptes)}`);
    assert.ok(comptes.arrivantesFigees > comptes.imposees, `aucune arrivante assise à un tour figé : ${JSON.stringify(comptes)}`);
  });
});
