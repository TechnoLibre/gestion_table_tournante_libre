// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves longues du journal (§ 14.10, série node-long) : une séance de 160
// gestes sur la grande démonstration, propositions comprises, dont chaque
// instant se restitue tel qu'il s'est écrit ; puis la même égalité sur
// cinquante séances tirées sur la petite démonstration, graine écrite
// (§ 14.12). Une séance s'écrit ligne après ligne comme l'écrit
// l'enregistreur : défaire et refaire visent ce que le fil courant désigne à
// cet instant, revenir une révision précédente. Chaque charge écrite passe
// l'analyse du fichier d'état et le contrôle des placements. Les noms des
// personnes ajoutées sont inventés, hors des réservoirs des démonstrations.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { rechercher } from '../moteur/recherche.js';
import { VERSION } from '../version.genere.js';
import { serialiser, serialiserCharge } from './canonique.js';
import { analyser, configurationDepuisCharge, creerCharge, etatDeduit } from './document.js';
import {
  INTERVALLE_INSTANTANE,
  estInstantane,
  fil,
  ligneEntree,
  ligneJalon,
  ligneOuverture,
  lireJournal,
  reconstruire,
} from './journal.js';
import { examiner, versFichier } from './placements.js';

// Graine et nombre des séances tirées, écrits ici pour que chaque exécution
// tire les mêmes (§ 14.12), et nombre de pas de la plus longue.
const GRAINE = 61_803;
const TIRAGES = 50;
const PAS_MAX = 110;
// Compte d'arrêt des générations : court, la recherche n'est pas éprouvée ici.
const ARRET = 100;

const copie = (valeur) => structuredClone(valeur);
const texteCanonique = (charge) => serialiserCharge(charge);
// Entiers de a à b inclus, croissants.
const de = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Horodatage d'affichage de la révision r : une minute par révision à partir
// de 8 h, le 17 mai 2031, à l'heure de l'Est.
function horodatage(r) {
  const minutes = 8 * 60 + r;
  const deux = (n) => String(n).padStart(2, '0');
  return `2031-05-17T${deux(Math.floor(minutes / 60) % 24)}:${deux(minutes % 60)}:00-04:00`;
}

// Charge d'une démonstration du catalogue (§ 15) : ses personnes, ses tables
// au défaut de l'événement quand leur capacité y est égale, ses réservations
// sans siège, aucune proposition.
function chargeDe(cle) {
  const entree = CATALOGUE.find((candidate) => candidate.cle === cle);
  const configuration = entree.construire();
  const siegesParDefaut = Math.max(...configuration.tables.map(({ capacite }) => capacite));
  const charge = creerCharge({ id: `evt-${cle}`, nom: entree.nom, siegesParDefaut, tours: configuration.tours });
  charge.participants = configuration.participants.map(({ id, nom, prenom, organisation }) => ({
    id,
    nom,
    prenom,
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = configuration.tables.map(({ id, numero, capacite }, rang) => ({
    id,
    numero,
    sieges: capacite === siegesParDefaut ? null : capacite,
    forme: 'ronde',
    position: { x: 250 * (rang % 6), y: 250 * Math.floor(rang / 6) },
  }));
  charge.reservations = configuration.reservations.map(({ participant, table, portee }) => ({
    participant,
    table,
    siege: null,
    portee,
    tour: null,
  }));
  charge.prochainsIds = { participant: charge.participants.length + 1, table: charge.tables.length + 1, proposition: 1 };
  return charge;
}

// --- Les gestes ------------------------------------------------------------
//
// Chaque geste reçoit la charge courante, qu'il ne modifie pas, et un entier
// d'où il tire ses paramètres ; il rend une charge neuve, ou la charge reçue
// quand il n'a pas d'objet.

const NOMS_AJOUTES = ['Ombrelle', 'Grisaille', 'Pervenche', 'Lacasse', 'Mirabelle', 'Quenouille', 'Sarbacane'];
const PRENOMS_AJOUTES = ['Iris', 'Théo', 'Ondine', 'Aurèle', null];
const ORGANISATIONS_AJOUTEES = ['Club des Merles', 'Société Alpha', null];
const REGLAGES = ['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable', 'varierOrganisations', 'attribuerSieges'];

function ajouter(charge, n) {
  const suivante = copie(charge);
  const id = suivante.prochainsIds.participant;
  suivante.prochainsIds.participant = id + 1;
  suivante.participants.push({
    id,
    nom: NOMS_AJOUTES[n % NOMS_AJOUTES.length],
    prenom: PRENOMS_AJOUTES[n % PRENOMS_AJOUTES.length],
    organisation: ORGANISATIONS_AJOUTEES[n % ORGANISATIONS_AJOUTEES.length],
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  });
  return suivante;
}

function modifier(charge, n) {
  const suivante = copie(charge);
  const personne = suivante.participants[n % suivante.participants.length];
  personne.notes = `note ${n}`;
  personne.courriel = n % 2 === 0 ? `p${n}@exemple.test` : null;
  return suivante;
}

function exclure(charge, n) {
  const suivante = copie(charge);
  const personne = suivante.participants[(3 * n) % suivante.participants.length];
  personne.exclu = !personne.exclu;
  return suivante;
}

function deplacer(charge, n) {
  const suivante = copie(charge);
  const table = suivante.tables[n % suivante.tables.length];
  table.position = { x: table.position.x + 10, y: (n % 7) * 25 };
  return suivante;
}

function regler(charge, n) {
  const suivante = copie(charge);
  const cle = REGLAGES[n % REGLAGES.length];
  suivante.reglages[cle] = !suivante.reglages[cle];
  return suivante;
}

// Pose deux propositions du moteur, numérotées au-delà du compteur ; quand
// les présents dépassent les places, ajoute une table à la place.
function generer(charge, n) {
  const configuration = configurationDepuisCharge(charge);
  const places = configuration.tables.reduce((somme, { capacite }) => somme + capacite, 0);
  const presents = configuration.participants.filter(({ exclu }) => !exclu).length;
  const suivante = copie(charge);
  if (presents > places) {
    const id = suivante.prochainsIds.table;
    suivante.prochainsIds.table = id + 1;
    suivante.tables.push({ id, numero: id, sieges: null, forme: 'carree', position: { x: 0, y: 300 } });
    return suivante;
  }
  const decalage = suivante.prochainsIds.proposition - 1;
  const options = { produitVersion: VERSION.affichee, attribuerSieges: suivante.reglages.attribuerSieges, decalage };
  const posees = rechercher(configuration, { graine: n, arret: ARRET, nombre: 2 }).map((proposition) =>
    versFichier(proposition, configuration, options),
  );
  suivante.propositions.push(...posees);
  suivante.prochainsIds.proposition = decalage + posees.length + 1;
  return suivante;
}

// Retient une proposition : le retenu en reprend le plan.
function retenir(charge, n) {
  if (charge.propositions.length === 0) return charge;
  const { id, siegesAttribues, tables, capacites, tours, participants, placement } = copie(
    charge.propositions[n % charge.propositions.length],
  );
  const suivante = copie(charge);
  suivante.retenu = { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
  return suivante;
}

// Retouche le retenu à la main (§ 5.8) : au tour que n désigne, les
// premières personnes de deux tables voisines échangent leurs tables.
function retoucher(charge, n) {
  if (charge.retenu === null) return charge;
  const suivante = copie(charge);
  const { sieges } = suivante.retenu.placement[n % suivante.retenu.tours];
  const a = n % sieges.length;
  const b = (a + 1) % sieges.length;
  if (a === b || sieges[a].length === 0 || sieges[b].length === 0) return charge;
  [sieges[a][0], sieges[b][0]] = [sieges[b][0], sieges[a][0]];
  return suivante;
}

// Supprime la dernière personne de la liste, et ses réservations.
function supprimer(charge) {
  const suivante = copie(charge);
  const [retiree] = suivante.participants.splice(-1, 1);
  suivante.reservations = suivante.reservations.filter(({ participant }) => participant !== retiree.id);
  return suivante;
}

// Efface les propositions ; le retenu et le compteur restent.
function effacer(charge) {
  if (charge.propositions.length === 0) return charge;
  const suivante = copie(charge);
  suivante.propositions = [];
  return suivante;
}

const GESTES = [
  ['ajouter', ajouter],
  ['modifier', modifier],
  ['exclure', exclure],
  ['generer', generer],
  ['retenir', retenir],
  ['retoucher', retoucher],
  ['deplacer', deplacer],
  ['regler', regler],
  ['supprimer', supprimer],
  ['effacer', effacer],
];
// Les codes qui suivent ceux des gestes sont des retours, dans cet ordre.
const SENS = ['defaire', 'refaire', 'revenir'];
const CODES = GESTES.length + SENS.length;
const code = (nom) => (SENS.includes(nom) ? GESTES.length + SENS.indexOf(nom) : GESTES.findIndex(([geste]) => geste === nom));

// Une séance écrite : la charge de base à la révision 1, puis un pas par
// paire [code, n]. Un code de geste applique son geste, et un geste qui ne
// change pas la charge cède la place à un réglage basculé. Un code de
// retour défait ou refait vers ce que le fil courant désigne, ou revient
// vers la révision 1 + n mod r, r étant la dernière écrite ; quand le fil ne
// désigne rien, le pas applique un geste. Un pas dont n est multiple de 9
// pose un jalon. Rend les charges écrites, révision par révision, le texte
// du journal et le compte de chaque sorte de pas : geste, poser pour une
// génération qui pose des propositions, sens d'un retour.
function ecrireSeance(base, pas) {
  const charges = [];
  const lignes = [ligneOuverture(base.evenement.id)];
  const entrees = [];
  const compte = new Map();
  const ecrire = (apres, sorte, jalon, { sens = null, retour = null } = {}) => {
    const revision = charges.length + 1;
    const ligne = ligneEntree({
      revision,
      libelle: `${sorte} ${revision}`,
      horodatage: horodatage(revision),
      sens,
      retour,
      produitVersion: revision === 1 ? VERSION.affichee : null,
      avant: charges.at(-1),
      apres,
      instantane: estInstantane(revision, 1),
    });
    lignes.push(ligne);
    entrees.push(JSON.parse(ligne));
    charges.push(apres);
    compte.set(sorte, (compte.get(sorte) ?? 0) + 1);
    if (jalon) lignes.push(ligneJalon({ revision, nom: `Jalon ${revision}`, horodatage: horodatage(revision) }));
  };
  ecrire(base, 'creer', true);
  for (const [codeDuPas, n] of pas) {
    const courante = charges.at(-1);
    const jalon = n % 9 === 0;
    if (codeDuPas >= GESTES.length) {
      const sens = SENS[codeDuPas - GESTES.length];
      const { cibleDefaire, cibleRefaire } = fil({ entrees });
      const cible = sens === 'defaire' ? cibleDefaire : sens === 'refaire' ? cibleRefaire : 1 + (n % charges.length);
      if (cible !== null) {
        ecrire(copie(charges[cible - 1]), sens, jalon, { sens, retour: cible });
        continue;
      }
    }
    let [sorte, faire] = GESTES[codeDuPas % GESTES.length];
    let apres = faire(courante, n);
    if (texteCanonique(apres) === texteCanonique(courante)) [sorte, apres] = ['regler', regler(courante, n)];
    if (sorte === 'generer' && apres.propositions.length > courante.propositions.length) sorte = 'poser';
    apres.evenement.etat = etatDeduit(apres);
    ecrire(apres, sorte, jalon);
  }
  return { charges, texte: `${lignes.join('\n')}\n`, compte };
}

// Le fil courant d'un journal sans élagage selon la définition du § 8.3, un
// parcours arrière depuis la dernière entrée : le prédécesseur d'une entrée
// ordinaire est celle qui la précède, celui d'une entrée de retour l'entrée
// qu'elle vise ; le fil est la suite des entrées ordinaires rencontrées. Ce
// parcours ne connaît ni position ni pile : il sert de témoin, par une autre
// définition, au rejeu que fait le module.
function filParcouru(entrees) {
  const parRevision = new Map(entrees.map((entree) => [entree.revision, entree]));
  const courant = [];
  for (let entree = entrees.at(-1); entree !== undefined; ) {
    if (entree.sens === null) courant.push(entree.revision);
    entree = parRevision.get(entree.sens === null ? entree.revision - 1 : entree.retour);
  }
  return courant;
}

// Vérifie le fil de chaque préfixe des entrées : le fil courant et la cible
// de défaire sont ceux du parcours arrière ; la pile compte les défaire et
// revenir qui suivent le dernier geste, moins les refaire (refaire n'existe
// que tant que les dernières entrées sont des retours) ; et après un défaire
// ou un revenir, refaire vise la position qu'il vient de quitter.
function verifierFil(entrees) {
  let enAttente = 0;
  entrees.forEach((entree, rang) => {
    const prefixe = entrees.slice(0, rang + 1);
    const { position, pile, courant, cibleDefaire, cibleRefaire } = fil({ entrees: prefixe });
    const parcouru = filParcouru(prefixe);
    assert.deepEqual([position, courant, cibleDefaire], [parcouru[0], parcouru, parcouru[1] ?? null], `révision ${entree.revision}`);
    enAttente = entree.sens === null ? 0 : enAttente + (entree.sens === 'refaire' ? -1 : 1);
    assert.equal(pile.length, enAttente, `révision ${entree.revision}`);
    if (entree.sens === 'defaire' || entree.sens === 'revenir') {
      assert.equal(cibleRefaire, filParcouru(entrees.slice(0, rang))[0], `révision ${entree.revision}`);
    }
  });
}

// Vérifie une séance écrite : chaque charge admise par l'analyse du fichier
// d'état et par le contrôle des placements ; le journal relu en entier ;
// chaque instant restitué tel qu'il s'est écrit ; la position courante du
// fil porte la dernière charge ; et le fil de chaque préfixe suit le § 8.3.
function verifier({ charges, texte }) {
  charges.forEach((charge, rang) => {
    analyser(serialiser(charge, { revision: rang + 1, produitVersion: VERSION.affichee }));
    const { fautives, retenu } = examiner(charge);
    assert.deepEqual([fautives, retenu.fautes], [[], []], `révision ${rang + 1}`);
  });
  const journal = lireJournal(texte);
  assert.deepEqual([journal.entrees.length, journal.ecartees], [charges.length, 0]);
  charges.forEach((charge, rang) => {
    assert.equal(texteCanonique(reconstruire(journal, rang + 1)), texteCanonique(charge), `révision ${rang + 1}`);
  });
  assert.equal(texteCanonique(reconstruire(journal, fil(journal).position)), texteCanonique(charges.at(-1)));
  verifierFil(journal.entrees);
}

describe('chaque instant d’une longue séance se reconstruit (§ 8.3, § 14.10)', () => {
  test('160 gestes sur la grande démonstration, propositions posées, retenues et retouchées, retours compris : reconstruire(journal, r) égale la charge écrite à la révision r, pour chacune', () => {
    const cycle = [
      'ajouter',
      'modifier',
      'generer',
      'retenir',
      'retoucher',
      'exclure',
      'defaire',
      'refaire',
      'deplacer',
      'generer',
      'retoucher',
      'regler',
      'supprimer',
      'revenir',
      'modifier',
      'effacer',
    ].map(code);
    // Le paramètre d'un pas n'est pas sa révision : revenir vers 1 + r mod (r − 1)
    // viserait toujours la révision 2. 7 919 et 10 007 sont premiers : les
    // paramètres des 159 pas sont distincts.
    const pas = de(2, 160).map((r) => [cycle[r % cycle.length], (r * 7_919) % 10_007]);
    const seance = ecrireSeance(chargeDe('grande'), pas);
    assert.equal(seance.charges.length, 160);
    for (const sorte of ['ajouter', 'modifier', 'exclure', 'poser', 'retenir', 'retoucher', 'defaire', 'refaire', 'revenir']) {
      assert.ok((seance.compte.get(sorte) ?? 0) >= 3, `${sorte} : ${seance.compte.get(sorte) ?? 0} fois`);
    }
    assert.ok(Math.max(...seance.charges.map(({ propositions }) => propositions.length)) >= 4);
    verifier(seance);
  });

  test('50 séances tirées sur la petite démonstration, graine écrite : chaque instant se restitue tel qu’il s’est écrit', () => {
    const bilan = { longues: 0, poser: 0, defaire: 0, refaire: 0, revenir: 0 };
    const pas = fc.array(fc.tuple(fc.nat({ max: CODES - 1 }), fc.nat({ max: 9_999 })), {
      minLength: 1,
      maxLength: PAS_MAX,
      size: 'max',
    });
    fc.assert(
      fc.property(pas, (tires) => {
        const seance = ecrireSeance(chargeDe('petite'), tires);
        verifier(seance);
        if (seance.charges.length > INTERVALLE_INSTANTANE) bilan.longues += 1;
        for (const sorte of ['poser', 'defaire', 'refaire', 'revenir']) bilan[sorte] += seance.compte.get(sorte) ?? 0;
      }),
      { seed: GRAINE, numRuns: TIRAGES },
    );
    // Les séances franchissent des frontières d'instantané, et chaque sorte de
    // pas rare s'y présente.
    assert.ok(bilan.longues >= 15, `${bilan.longues} séances de plus de ${INTERVALLE_INSTANTANE} entrées`);
    for (const sorte of ['poser', 'defaire', 'refaire', 'revenir']) assert.ok(bilan[sorte] >= 20, `${sorte} : ${bilan[sorte]}`);
  });
});
