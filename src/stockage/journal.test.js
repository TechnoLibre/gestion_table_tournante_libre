// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du journal (§ 8.2, § 8.3, § 8.6, § 8.8) : le texte exact de chaque
// sorte de ligne et ce que l'écriture refuse ; la cadence des instantanés ;
// chaque instant d'une séance de 120 gestes sur la petite démonstration,
// restitué tel qu'il s'est écrit ; la lecture qui s'arrête à la première
// ligne illisible et compte ce qu'elle écarte ; le fil courant, défaire et
// refaire ; les lignes de l'historique ; la construction notée ; l'élagage,
// par le texte et en mémoire ; le journal d'un format plus ancien, que la
// lecture écarte en entier ; la restitution sur une seule copie, canonique ou
// non, et l'entrée qui rend sa ligne avec la copie canonique de la charge,
// propositions figées comprises ; la restitution de chaque instant de la
// séance, caractérisée octet pour octet. Les journaux s'écrivent comme les
// écrit l'enregistreur, une ligne après l'autre, par les fonctions du module
// ; chaque charge de la séance passe l'analyse du fichier d'état et le
// contrôle des placements. Les noms des personnes ajoutées sont inventés,
// hors des réservoirs des démonstrations ; les versions viennent du module
// engendré, seul à en porter le texte.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { rechercher } from '../moteur/recherche.js';
import { VERSION } from '../version.genere.js';
import { canoniser, canoniserPartagee, serialiser, serialiserCharge } from './canonique.js';
import { appliquer, difference, differenceCanonique } from './correctifs.js';
import { FORMAT, analyser, configurationDepuisCharge, creerCharge, etatDeduit } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { estFigee, figer } from './gel.js';
import {
  INTERVALLE_INSTANTANE,
  PLAFOND_ENTREES,
  PLANCHER_ENTREES,
  decoderJournal,
  elaguer,
  elaguerJournal,
  entreeCanonique,
  estInstantane,
  fil,
  horodatageFinal,
  ligneEntree,
  ligneJalon,
  ligneOuverture,
  lignesHistorique,
  lireJournal,
  reconstruire,
  reconstruireCanonique,
  texteDuJournal,
  versionDe,
} from './journal.js';
import { ajusterALaPresence, examiner, versFichier } from './placements.js';

// L'événement des journaux d'épreuve, et deux constructions : celle du module
// engendré et sa voisine.
const EVENEMENT = 'evt-essai';
const V1 = VERSION.affichee;
const V2 = versionVoisine(V1);

const copie = (valeur) => structuredClone(valeur);
// Valeur calculée au premier appel, puis gardée : une donnée d'épreuve que le
// module construit ne se calcule qu'à l'intérieur d'une épreuve, dont l'échec
// n'empêche pas les autres de s'exécuter.
function memoire(calculer) {
  let calculee = false;
  let valeur;
  return () => {
    if (!calculee) [calculee, valeur] = [true, calculer()];
    return valeur;
  };
}
const texteCanonique = (charge) => serialiserCharge(charge);
// Entiers de a à b inclus, dans le sens qui mène de l'un à l'autre.
const de = (a, b) => Array.from({ length: Math.abs(b - a) + 1 }, (_, i) => (a <= b ? a + i : a - i));
// Lignes d'un texte de journal, sa dernière fin de ligne retirée ; et
// l'inverse, chaque ligne suivie d'une fin de ligne.
const lignesDe = (texte) => texte.replace(/\n$/, '').split('\n');
const texteDe = (lignes) => `${lignes.join('\n')}\n`;

// Horodatage d'affichage de la révision r : une minute par révision à partir
// de 8 h, le 17 mai 2031, à l'heure de l'Est.
function horodatage(r) {
  const minutes = 8 * 60 + r;
  const deux = (n) => String(n).padStart(2, '0');
  return `2031-05-17T${deux(Math.floor(minutes / 60) % 24)}:${deux(minutes % 60)}:00-04:00`;
}

// Champs de l'entrée de l'étape de rang donné, avant excepté, qu'un
// enregistreur fidèle au contrat passe : la révision qui suit, depuis
// premiere ; l'instantané quand la révision ouvre un intervalle ; la
// construction notée à la première entrée et quand elle change. Une étape
// est { apres, sens, retour, version, libelle, jalons } ; seul apres est
// requis, et version vaut V1 quand elle manque.
function champsDe(etapes, rang, premiere = 1) {
  const etape = etapes[rang];
  const revision = premiere + rang;
  const version = etape.version ?? V1;
  const precedente = rang === 0 ? null : (etapes[rang - 1].version ?? V1);
  return {
    revision,
    libelle: etape.libelle ?? `Geste ${revision}`,
    horodatage: horodatage(revision),
    sens: etape.sens ?? null,
    retour: etape.retour ?? null,
    produitVersion: version === precedente ? null : version,
    apres: etape.apres,
    instantane: estInstantane(revision, premiere),
  };
}

// Texte du journal qu'écrit un enregistreur fidèle au contrat : l'ouverture,
// puis chaque étape à la révision suivante (champsDe), en correctif depuis
// la charge de l'étape précédente quand elle ne porte pas d'instantané, et
// les jalons d'une étape après elle.
function journalDe(etapes, { premiere = 1, evenement = EVENEMENT } = {}) {
  const lignes = [ligneOuverture(evenement)];
  etapes.forEach((etape, rang) => {
    const champs = champsDe(etapes, rang, premiere);
    lignes.push(ligneEntree({ ...champs, avant: etapes[rang - 1]?.apres }));
    for (const nom of etape.jalons ?? []) {
      lignes.push(ligneJalon({ revision: champs.revision, nom, horodatage: horodatage(champs.revision) }));
    }
  });
  return texteDe(lignes);
}

// --- Les charges -----------------------------------------------------------

// La charge du contrat sans liste, brouillon.
const chargeVide = () => creerCharge({ id: EVENEMENT, nom: "Soirée d'essai", siegesParDefaut: 2, tours: 2 });

// La même avec Iris Ombrelle, personne 1.
function avecIris() {
  const charge = chargeVide();
  charge.prochainsIds.participant = 2;
  charge.participants.push({
    id: 1,
    nom: 'Ombrelle',
    prenom: 'Iris',
    organisation: 'Club des Merles',
    courriel: null,
    titrePressenti: 'animation',
    notes: null,
    exclu: false,
  });
  return charge;
}

// n étapes ordinaires sur la charge à une personne : l'étape de rang i porte
// la note « note i+1 », si bien que deux étapes ne s'écrivent jamais pareil.
function suite(n) {
  return Array.from({ length: n }, (_, rang) => {
    const apres = avecIris();
    apres.participants[0].notes = `note ${rang + 1}`;
    return { apres };
  });
}

// Charge d'une démonstration du catalogue (§ 15) : ses personnes, ses tables
// au défaut de l'événement, aucune proposition.
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

// --- Les gestes d'une séance -----------------------------------------------
//
// Chaque geste reçoit la charge courante, qu'il ne modifie pas, et un entier
// d'où il tire ses paramètres ; il rend une charge neuve, ou la charge reçue
// quand il n'a pas d'objet.

const NOMS_AJOUTES = ['Ombrelle', 'Grisaille', 'Pervenche', 'Lacasse', 'Mirabelle', 'Quenouille', 'Sarbacane'];
const PRENOMS_AJOUTES = ['Iris', 'Théo', 'Ondine', 'Aurèle', null];
const ORGANISATIONS_AJOUTEES = ['Club des Merles', 'Société Alpha', null];
const REGLAGES = ['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable', 'varierOrganisations', 'attribuerSieges'];
// Compte d'arrêt des générations : court, la recherche n'est pas éprouvée ici.
const ARRET = 200;

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
  const options = { produitVersion: V1, attribuerSieges: suivante.reglages.attribuerSieges, decalage };
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

const CYCLE = [
  ['ajouter', ajouter],
  ['modifier', modifier],
  ['exclure', exclure],
  ['generer', generer],
  ['retenir', retenir],
  ['retoucher', retoucher],
  ['deplacer', deplacer],
  ['regler', regler],
  ['supprimer', supprimer],
  ['generer', generer],
  ['retoucher', retoucher],
  ['effacer', effacer],
];

// Retours de la séance, par révision : [sens, révision visée]. Défaire et
// refaire visent ce que le fil courant désigne à cet instant ; deux d'entre
// eux encadrent l'instantané de la révision 51.
const RETOURS = new Map([
  [30, ['revenir', 20]],
  [52, ['defaire', 50]],
  [53, ['refaire', 51]],
  [99, ['revenir', 60]],
  [102, ['defaire', 100]],
]);

// La séance : la petite démonstration à la révision 1, puis à chaque
// révision jusqu'à 120 le retour que RETOURS y place, ou le geste du cycle.
// Un geste sans effet — retenir sans proposition ou ce qui est déjà retenu,
// retoucher sans retenu, effacer sans proposition — cède la place à un
// réglage basculé : chaque geste change la charge. Un jalon nomme la
// création, et l'instant qui précède chaque génération qui pose (§ 8.3).
function seance() {
  const etapes = [{ apres: chargeDe('petite'), geste: 'creer', jalons: ['Création'] }];
  for (let r = 2; r <= 120; r += 1) {
    const courante = etapes.at(-1).apres;
    if (RETOURS.has(r)) {
      const [sens, retour] = RETOURS.get(r);
      etapes.push({ apres: copie(etapes[retour - 1].apres), geste: sens, sens, retour, jalons: [] });
      continue;
    }
    let [geste, faire] = CYCLE[r % CYCLE.length];
    let apres = faire(courante, r);
    if (texteCanonique(apres) === texteCanonique(courante)) [geste, apres] = ['regler', regler(courante, r)];
    apres.evenement.etat = etatDeduit(apres);
    if (geste === 'generer' && apres.propositions.length > courante.propositions.length) {
      geste = 'poser';
      etapes.at(-1).jalons.push('Avant génération');
    }
    etapes.push({ apres, geste, jalons: [] });
  }
  return etapes;
}

const SEANCE = seance();
const texteSeance = memoire(() => journalDe(SEANCE));

// --- Les lignes ------------------------------------------------------------

// Texte compact de la charge du contrat sans liste, dans l'ordre canonique.
const INSTANTANE_VIDE =
  `{"evenement":{"id":"evt-essai","nom":"Soirée d'essai","date":null,"siegesParDefaut":2,"tours":2,"unite":"cm",` +
  `"etat":"brouillon","filiation":null},"reglages":{"separerOrganisations":true,"nouveauxVoisins":true,` +
  `"nouvelleTable":true,"varierOrganisations":true,"attribuerSieges":false,"generation":{"nombre":20,` +
  `"arret":2000000,"historique":1000}},"prochainsIds":{"participant":1,"table":1,"proposition":1},` +
  `"participants":[],"tables":[],"reservations":[],"titres":[],"propositions":[],"retenu":null}`;

describe('les lignes du journal : le texte exact, et ce que l’écriture refuse (§ 8.2, § 8.3)', () => {
  test('ouverture, entrée en instantané, entrée en correctif, entrée de retour, jalon : le texte du contrat, sans fin de ligne', () => {
    const vide = chargeVide();
    const iris = avecIris();
    const tard = copie(iris);
    tard.participants[0].notes = 'arrive tard';
    const lignes = [
      ligneOuverture(EVENEMENT),
      ligneEntree({
        revision: 1,
        libelle: "Création de l'événement « Soirée d'essai »",
        horodatage: '2026-10-06T19:02:11-04:00',
        produitVersion: V1,
        apres: vide,
        instantane: true,
      }),
      ligneJalon({ revision: 1, nom: 'Création', horodatage: '2026-10-06T19:02:11-04:00' }),
      ligneEntree({
        revision: 2,
        libelle: 'Ajouté Iris Ombrelle',
        horodatage: '2026-10-06T19:03:40-04:00',
        avant: vide,
        apres: iris,
        instantane: false,
      }),
      ligneEntree({
        revision: 3,
        libelle: 'Modifié Iris Ombrelle',
        horodatage: '2026-10-06T19:04:15-04:00',
        avant: iris,
        apres: tard,
        instantane: false,
      }),
      ligneEntree({
        revision: 4,
        libelle: 'Retour à « Ajouté Iris Ombrelle »',
        horodatage: '2026-10-06T19:05:02-04:00',
        sens: 'revenir',
        retour: 2,
        avant: tard,
        apres: iris,
        instantane: false,
      }),
    ];
    assert.equal(lignes[0], '{"type":"journal","format":3,"evenement":"evt-essai"}');
    assert.equal(
      lignes[1],
      `{"type":"entree","revision":1,"libelle":"Création de l'événement « Soirée d'essai »",` +
        `"horodatage":"2026-10-06T19:02:11-04:00","sens":null,"retour":null,"produitVersion":"${V1}",` +
        `"instantane":${INSTANTANE_VIDE},"correctif":null}`,
    );
    assert.equal(lignes[2], '{"type":"jalon","revision":1,"nom":"Création","horodatage":"2026-10-06T19:02:11-04:00"}');
    assert.equal(
      lignes[3],
      '{"type":"entree","revision":2,"libelle":"Ajouté Iris Ombrelle","horodatage":"2026-10-06T19:03:40-04:00",' +
        '"sens":null,"retour":null,"produitVersion":null,"instantane":null,"correctif":[' +
        '{"op":"poser","chemin":["prochainsIds","participant"],"valeur":2},' +
        '{"op":"poser","chemin":["participants",{"id":1}],"valeur":{"id":1,"nom":"Ombrelle","prenom":"Iris",' +
        '"organisation":"Club des Merles","courriel":null,"titrePressenti":"animation","notes":null,"exclu":false}}]}',
    );
    assert.equal(
      lignes[5],
      '{"type":"entree","revision":4,"libelle":"Retour à « Ajouté Iris Ombrelle »",' +
        '"horodatage":"2026-10-06T19:05:02-04:00","sens":"revenir","retour":2,"produitVersion":null,' +
        '"instantane":null,"correctif":[{"op":"poser","chemin":["participants",{"id":1},"notes"],"valeur":null}]}',
    );
    for (const ligne of lignes) assert.doesNotMatch(ligne, /[\n\r]/);
    for (const charge of [vide, iris, tard]) {
      assert.doesNotThrow(() => analyser(serialiser(charge, { revision: 1, produitVersion: V1 })));
    }

    // Relu : quatre entrées dans l'ordre des lignes, le jalon, rien d'écarté.
    const journal = lireJournal(texteDe(lignes));
    assert.equal(journal.evenement, EVENEMENT);
    assert.deepEqual(
      journal.entrees.map(({ revision, sens, retour }) => [revision, sens, retour]),
      [[1, null, null], [2, null, null], [3, null, null], [4, 'revenir', 2]],
    );
    assert.deepEqual(journal.jalons, [
      { type: 'jalon', revision: 1, nom: 'Création', horodatage: '2026-10-06T19:02:11-04:00' },
    ]);
    assert.equal(journal.ecartees, 0);
    assert.equal(texteCanonique(reconstruire(journal, 4)), texteCanonique(iris));
  });

  test('une entrée ne dépend ni de l’ordre des clés ni de celui des listes de la charge reçue', () => {
    const avant = avecIris();
    const apres = ajouter(avant, 3);
    // La même charge, chaque objet refait clés à rebours, les personnes en ordre inverse.
    const aRebours = (valeur) => {
      if (Array.isArray(valeur)) return valeur.map(aRebours);
      if (typeof valeur !== 'object' || valeur === null) return valeur;
      return Object.fromEntries(Object.keys(valeur).reverse().map((cle) => [cle, aRebours(valeur[cle])]));
    };
    const renversee = aRebours(apres);
    renversee.participants.reverse();
    assert.notEqual(JSON.stringify(renversee), JSON.stringify(apres));
    const options = { revision: 2, libelle: 'Ajouté', horodatage: horodatage(2), avant };
    for (const instantane of [true, false]) {
      assert.equal(
        ligneEntree({ ...options, apres: renversee, instantane }),
        ligneEntree({ ...options, apres, instantane }),
      );
    }
    assert.equal(
      ligneEntree({ ...options, avant: aRebours(avant), apres, instantane: false }),
      ligneEntree({ ...options, apres, instantane: false }),
    );
  });

  test('l’écriture refuse, par TypeError, toute ligne que la lecture refuserait', () => {
    const avant = chargeVide();
    const apres = avecIris();
    const valide = { revision: 2, libelle: 'Ajouté Iris Ombrelle', horodatage: horodatage(2), avant, apres, instantane: false };
    assert.doesNotThrow(() => ligneEntree(valide));
    const nomVide = avecIris();
    nomVide.participants[0].nom = '';
    const sansReglages = avecIris();
    delete sansReglages.reglages;
    const cleInconnue = avecIris();
    cleInconnue.participants[0].auteur = 'Théo';
    // Une proposition de forme admise, puis la même hors de sa règle.
    const avecProposition = avecIris();
    avecProposition.prochainsIds.proposition = 2;
    avecProposition.propositions.push({
      id: 1,
      graine: 7,
      arret: 100,
      historique: 10,
      produitVersion: V1,
      siegesAttribues: false,
      tables: [],
      capacites: [],
      tours: 2,
      participants: [],
      placement: [
        { sieges: [], reserve: [] },
        { sieges: [], reserve: [] },
      ],
    });
    assert.doesNotThrow(() => ligneEntree({ ...valide, apres: avecProposition, instantane: true }));
    const graineNegative = copie(avecProposition);
    graineNegative.propositions[0].graine = -1;
    const refus = [
      ['révision 0', { revision: 0 }],
      ['révision non entière', { revision: 2.5 }],
      ['révision en texte', { revision: '2' }],
      ['libellé vide', { libelle: '' }],
      ['libellé absent', { libelle: undefined }],
      ['horodatage sans fuseau', { horodatage: '2026-10-06T19:03:40' }],
      ['horodatage en temps universel', { horodatage: '2026-10-06T23:03:40Z' }],
      ['horodatage qui n’est pas un texte', { horodatage: 20261006 }],
      ['sens inconnu', { sens: 'annuler', retour: 1 }],
      ['retour sans sens', { retour: 1 }],
      ['sens sans retour', { sens: 'defaire' }],
      ['retour vers sa propre révision', { sens: 'revenir', retour: 2 }],
      ['retour vers la révision 0', { sens: 'revenir', retour: 0 }],
      ['version vide', { produitVersion: '' }],
      ['instantane absent', { instantane: undefined }],
      ['instantane qui n’est pas un booléen', { instantane: 1 }],
      ['charge hors de sa règle, en correctif', { apres: nomVide }],
      ['charge hors de sa règle, en instantané', { apres: nomVide, instantane: true }],
      ['charge sans réglages', { apres: sansReglages }],
      ['charge absente', { apres: undefined }],
      ['clé inconnue dans la charge, en correctif', { apres: cleInconnue }],
      ['clé inconnue dans la charge, en instantané', { apres: cleInconnue, instantane: true }],
      ['proposition hors de sa règle', { apres: graineNegative, instantane: true }],
      ['charge précédente absente, en correctif', { avant: undefined }],
    ];
    for (const [nom, changement] of refus) {
      assert.throws(() => ligneEntree({ ...valide, ...changement }), TypeError, nom);
    }
    for (const changement of [{ revision: 0 }, { nom: '' }, { horodatage: 'hier' }, { revision: undefined }]) {
      const jalon = { revision: 1, nom: 'Création', horodatage: horodatage(1), ...changement };
      assert.throws(() => ligneJalon(jalon), TypeError, JSON.stringify(changement));
    }
    for (const evenement of ['', null, 7, undefined]) {
      assert.throws(() => ligneOuverture(evenement), TypeError, String(evenement));
    }
  });
});

// --- La cadence ------------------------------------------------------------

describe('la cadence des instantanés (§ 8.6)', () => {
  test('constantes : un instantané toutes les 50 révisions, un plancher de 500 entrées, un plafond de 600', () => {
    assert.equal(INTERVALLE_INSTANTANE, 50);
    assert.equal(PLANCHER_ENTREES, 500);
    assert.equal(PLAFOND_ENTREES, 600);
  });

  test('estInstantane : la première révision du journal, puis toutes les 50 comptées depuis elle, jamais avant elle', () => {
    const cas = [
      [1, 1, true],
      [2, 1, false],
      [50, 1, false],
      [51, 1, true],
      [101, 1, true],
      [120, 1, false],
      [151, 151, true],
      [200, 151, false],
      [201, 151, true],
      [101, 151, false],
      [1, 51, false],
      [37, 37, true],
      [87, 37, true],
    ];
    for (const [revision, premiere, attendu] of cas) {
      assert.equal(estInstantane(revision, premiere), attendu, `${revision} depuis ${premiere}`);
    }
  });

  test('120 entrées depuis la révision 1 : instantanés aux révisions 1, 51 et 101, correctifs ailleurs', () => {
    const journal = lireJournal(texteSeance());
    assert.equal(journal.entrees.length, 120);
    assert.deepEqual(
      journal.entrees.filter(({ instantane }) => instantane !== null).map(({ revision }) => revision),
      [1, 51, 101],
    );
    for (const { revision, instantane, correctif } of journal.entrees) {
      assert.equal(Array.isArray(correctif), instantane === null, `révision ${revision}`);
    }
    // Le texte le dit aussi : chaque ligne d'entrée porte l'un ou l'autre.
    const lignes = lignesDe(texteSeance()).filter((ligne) => ligne.startsWith('{"type":"entree"'));
    assert.deepEqual(
      lignes.flatMap((ligne, rang) => (ligne.includes('"instantane":{') ? [rang + 1] : [])),
      [1, 51, 101],
    );
  });
});

// --- La restitution --------------------------------------------------------

describe('chaque instant se reconstruit (§ 8.3, § 14.10)', () => {
  test('la séance : 120 gestes — ajouts, modifications, exclusions, propositions posées, retenues et retouchées, retours —, chaque charge admise, chacune différente de la précédente', () => {
    assert.equal(SEANCE.length, 120);
    const compte = new Map();
    for (const { geste } of SEANCE) compte.set(geste, (compte.get(geste) ?? 0) + 1);
    const planchers = { ajouter: 5, modifier: 5, exclure: 5, poser: 10, retenir: 4, retoucher: 8, supprimer: 5, effacer: 5 };
    for (const [geste, plancher] of Object.entries(planchers)) {
      assert.ok((compte.get(geste) ?? 0) >= plancher, `${geste} : ${compte.get(geste) ?? 0} fois, moins de ${plancher}`);
    }
    assert.deepEqual(['revenir', 'defaire', 'refaire'].map((sens) => compte.get(sens)), [2, 2, 1]);
    SEANCE.forEach(({ apres }, rang) => {
      const revision = rang + 1;
      assert.doesNotThrow(() => analyser(serialiser(apres, { revision, produitVersion: V1 })), `révision ${revision}`);
      const { fautives, retenu } = examiner(apres);
      assert.deepEqual([fautives, retenu.fautes], [[], []], `révision ${revision}`);
      if (rang > 0) assert.notEqual(texteCanonique(apres), texteCanonique(SEANCE[rang - 1].apres), `révision ${revision}`);
    });
    // Défaire et refaire visent ce que le fil courant désigne juste avant eux.
    for (const [revision, [sens, cible]] of RETOURS) {
      if (sens === 'revenir') continue;
      const avant = fil(lireJournal(journalDe(SEANCE.slice(0, revision - 1))));
      assert.equal(sens === 'defaire' ? avant.cibleDefaire : avant.cibleRefaire, cible, `révision ${revision}`);
    }
  });

  test('reconstruire(journal, r) égale, en texte canonique, la charge écrite à la révision r, pour chacune des 120', () => {
    const journal = lireJournal(texteSeance());
    assert.equal(journal.ecartees, 0);
    SEANCE.forEach(({ apres }, rang) => {
      assert.equal(texteCanonique(reconstruire(journal, rang + 1)), texteCanonique(apres), `révision ${rang + 1}`);
    });
  });

  test('le fil courant de la séance remonte ses retours : les gestes que défaire ou revenir ont quittés en sont absents', () => {
    assert.deepEqual(fil(lireJournal(texteSeance())), {
      position: 120,
      pile: [],
      courant: [...de(120, 103), 100, ...de(60, 54), ...de(51, 31), ...de(20, 1)],
      cibleDefaire: 119,
      cibleRefaire: null,
    });
  });

  test('un correctif qui ne s’applique pas lève CORRECTIF de sa révision à l’instantané suivant, et nulle part ailleurs', () => {
    const lignes = lignesDe(texteSeance());
    const rang = lignes.findIndex((ligne) => ligne.startsWith('{"type":"entree","revision":33,'));
    const entree = JSON.parse(lignes[rang]);
    lignes[rang] = JSON.stringify({ ...entree, correctif: [{ op: 'retirer', chemin: ['participants', { id: 999 }] }] });
    const journal = lireJournal(texteDe(lignes));
    assert.equal(journal.entrees.length, 120);
    for (const revision of [33, 34, 49, 50]) {
      assert.throws(
        () => reconstruire(journal, revision),
        (erreur) => erreur instanceof ErreurStockage && erreur.code === 'CORRECTIF' && erreur.details.rang === 0,
        `révision ${revision}`,
      );
    }
    for (const revision of [1, 32, 51, 52, 53, 100, 120]) {
      assert.equal(texteCanonique(reconstruire(journal, revision)), texteCanonique(SEANCE[revision - 1].apres));
    }
  });

  test('un retenu hors de sa règle, que le contrôle des placements garde, traverse le journal tel quel : posé, gardé, libéré, remis', () => {
    // Le retenu porte une clé inconnue et n'a pas de placement : l'analyse
    // l'admet comme conteneur, et canonique.js le recopie hors du schéma.
    const fautif = { proposition: 1, siegesAttribues: false, tables: [1], capacites: [2], tours: 2, participants: [1], auteur: 'Iris' };
    const etapes = suite(5);
    for (const { apres } of etapes) apres.prochainsIds.proposition = 2;
    for (const rang of [1, 2]) etapes[rang].apres.retenu = copie(fautif);
    // Seule la forme du retenu est fautive : l'analyse admet la charge, et le
    // contrôle des placements ne nomme que cette faute.
    assert.doesNotThrow(() => analyser(serialiser(etapes[1].apres, { revision: 2, produitVersion: V1 })));
    assert.deepEqual(examiner(etapes[1].apres).retenu.fautes, [{ code: 'FORME', chemin: 'placement' }]);
    etapes[4] = { apres: etapes[2].apres, sens: 'revenir', retour: 3 };
    for (const premiere of [1, 2]) {
      const liste = etapes.slice(premiere - 1);
      const journal = lireJournal(journalDe(liste, { premiere }));
      assert.deepEqual([journal.entrees.length, journal.ecartees], [liste.length, 0]);
      liste.forEach(({ apres }, rang) => {
        assert.equal(texteCanonique(reconstruire(journal, premiere + rang)), texteCanonique(apres), `révision ${premiere + rang}`);
      });
    }
    assert.match(texteCanonique(reconstruire(lireJournal(journalDe(etapes)), 5)), /"retenu": \{"auteur":"Iris",/);
  });

  test('une révision absente du journal lève RangeError ; la charge rendue ne partage rien avec le journal', () => {
    const journal = lireJournal(texteSeance());
    for (const revision of [0, 121, -1, 2.5, '5', null, undefined]) {
      assert.throws(() => reconstruire(journal, revision), RangeError, String(revision));
    }
    assert.throws(() => reconstruire(lireJournal(''), 1), RangeError);
    for (const revision of [1, 51, 77]) {
      const rendue = reconstruire(journal, revision);
      rendue.participants.length = 0;
      rendue.evenement.nom = 'autre';
      assert.equal(texteCanonique(reconstruire(journal, revision)), texteCanonique(SEANCE[revision - 1].apres));
    }
  });
});

// --- La lecture ------------------------------------------------------------

describe('la lecture s’arrête à la première ligne illisible et compte ce qu’elle écarte (§ 8.6)', () => {
  const cent = memoire(() => journalDe(suite(100)));
  const lignesCent = memoire(() => lignesDe(cent()));
  // Le journal de cent entrées dont la ligne de rang donné — 0 pour
  // l'ouverture, r pour l'entrée r — est remplacée par remplacer(ligne, valeur
  // relue).
  const abime = (rang, remplacer) => {
    const lignes = [...lignesCent()];
    lignes[rang] = remplacer(lignes[rang], JSON.parse(lignes[rang]));
    return texteDe(lignes);
  };
  const retouche = (changer) => (_, valeur) => JSON.stringify(changer(valeur));
  // Le journal de cent entrées où la ligne donnée s'insère au rang donné.
  const insere = (rang, ligne) => texteDe(lignesCent().toSpliced(rang, 0, ligne));
  // Ce que la lecture retient et écarte, en nombres.
  const bilan = (texte) => {
    const { evenement, entrees, jalons, ecartees } = lireJournal(texte);
    return { evenement, entrees: entrees.length, derniere: entrees.at(-1)?.revision ?? null, jalons: jalons.length, ecartees };
  };

  test('journal de 100 entrées, la 37ᵉ abîmée : 36 entrées retenues, 64 annoncées écartées, quelle que soit l’avarie', () => {
    assert.deepEqual(bilan(cent()), { evenement: EVENEMENT, entrees: 100, derniere: 100, jalons: 0, ecartees: 0 });
    const instantane1 = JSON.parse(lignesCent()[1]).instantane;
    const avaries = [
      ['JSON tronqué', (ligne) => ligne.slice(0, -1)],
      ['ligne vide', () => ''],
      ['blancs seuls', () => '   '],
      ['null', () => 'null'],
      ['une liste', () => '[]'],
      ['un nombre', () => '37'],
      ['type inconnu', retouche((valeur) => ({ ...valeur, type: 'entre' }))],
      ['clé inconnue', retouche((valeur) => ({ ...valeur, auteur: 'Iris' }))],
      ['clé __proto__', (ligne) => ligne.replace(/\}$/, ',"__proto__":{}}')],
      ['clé manquante', retouche(({ libelle, ...reste }) => reste)],
      ['révision répétée', retouche((valeur) => ({ ...valeur, revision: 36 }))],
      ['révision sautée', retouche((valeur) => ({ ...valeur, revision: 38 }))],
      ['révision en texte', retouche((valeur) => ({ ...valeur, revision: '37' }))],
      ['libellé vide', retouche((valeur) => ({ ...valeur, libelle: '' }))],
      ['horodatage sans fuseau', retouche((valeur) => ({ ...valeur, horodatage: '2031-05-17T08:37:00' }))],
      ['horodatage qui n’est pas un texte', retouche((valeur) => ({ ...valeur, horodatage: 20310517 }))],
      ['sens inconnu', retouche((valeur) => ({ ...valeur, sens: 'annuler', retour: 3 }))],
      ['retour sans sens', retouche((valeur) => ({ ...valeur, retour: 3 }))],
      ['sens sans retour', retouche((valeur) => ({ ...valeur, sens: 'revenir' }))],
      ['retour vers sa propre révision', retouche((valeur) => ({ ...valeur, sens: 'revenir', retour: 37 }))],
      ['version vide', retouche((valeur) => ({ ...valeur, produitVersion: '' }))],
      ['correctif qui n’est pas une liste', retouche((valeur) => ({ ...valeur, correctif: {} }))],
      ['ni instantané ni correctif', retouche((valeur) => ({ ...valeur, correctif: null }))],
      ['instantané et correctif', retouche((valeur) => ({ ...valeur, instantane: instantane1 }))],
      ['instantané hors de la cadence', retouche((valeur) => ({ ...valeur, instantane: instantane1, correctif: null }))],
    ];
    for (const [nom, remplacer] of avaries) {
      assert.deepEqual(
        bilan(abime(37, remplacer)),
        { evenement: EVENEMENT, entrees: 36, derniere: 36, jalons: 0, ecartees: 64 },
        nom,
      );
    }
  });

  test('une dernière ligne sans fin de ligne est écartée et comptée, même lisible', () => {
    assert.deepEqual(bilan(cent().slice(0, -1)), { evenement: EVENEMENT, entrees: 99, derniere: 99, jalons: 0, ecartees: 1 });
    const coupee = cent().slice(0, cent().lastIndexOf('{"op"'));
    assert.deepEqual(bilan(coupee), { evenement: EVENEMENT, entrees: 99, derniere: 99, jalons: 0, ecartees: 1 });
  });

  test('une révision qui saute arrête la lecture : l’entrée 37 manquante, la 38 et la suite sont écartées', () => {
    const sansLa37 = texteDe(lignesCent().toSpliced(37, 1));
    assert.deepEqual(bilan(sansLa37), { evenement: EVENEMENT, entrees: 36, derniere: 36, jalons: 0, ecartees: 63 });
  });

  test('la première entrée porte sa version et un instantané de forme admise ; la cadence tient depuis elle', () => {
    const toutEcarte = { evenement: EVENEMENT, entrees: 0, derniere: null, jalons: 0, ecartees: 100 };
    const instantaneAvec = (changer) =>
      retouche((valeur) => {
        const instantane = copie(valeur.instantane);
        changer(instantane);
        return { ...valeur, instantane };
      });
    const proposition = {
      id: 1,
      graine: 7,
      arret: 100,
      historique: 10,
      produitVersion: V1,
      siegesAttribues: false,
      tables: [],
      capacites: [],
      tours: 2,
      participants: [],
      placement: [
        { sieges: [], reserve: [] },
        { sieges: [], reserve: [] },
      ],
    };
    const { graine, ...sansGraine } = proposition;
    const avaries = [
      ['sans version', retouche((valeur) => ({ ...valeur, produitVersion: null }))],
      ['en correctif', retouche((valeur) => ({ ...valeur, instantane: null, correctif: [] }))],
      ['instantané qui n’est pas un objet', retouche((valeur) => ({ ...valeur, instantane: 'charge' }))],
      ['instantané dont une personne a un nom vide', instantaneAvec((charge) => { charge.participants[0].nom = ''; })],
      ['instantané sans réglages', instantaneAvec((charge) => { delete charge.reglages; })],
      ['instantané à clé inconnue', instantaneAvec((charge) => { charge.auteur = 'Iris'; })],
      ['instantané dont une proposition sort de sa règle', instantaneAvec((charge) => { charge.propositions.push({ ...proposition, graine: -1 }); })],
      ['instantané dont une proposition manque une clé', instantaneAvec((charge) => { charge.propositions.push(sansGraine); })],
    ];
    for (const [nom, remplacer] of avaries) assert.deepEqual(bilan(abime(1, remplacer)), toutEcarte, nom);
    // Une proposition de forme admise ne l'empêche pas.
    const admise = abime(1, instantaneAvec((charge) => { charge.propositions.push(proposition); }));
    assert.equal(bilan(admise).entrees, 100);
    // La révision 51 ouvre un intervalle : un correctif à sa place arrête la lecture.
    const sans51 = abime(51, retouche((valeur) => ({ ...valeur, instantane: null, correctif: [] })));
    assert.deepEqual(bilan(sans51), { evenement: EVENEMENT, entrees: 50, derniere: 50, jalons: 0, ecartees: 50 });
    // Un journal peut commencer à une révision quelconque : sa cadence part de
    // sa première entrée. Commencé à 137, il porte ses instantanés à 137 et
    // 187 ; un compte depuis la révision 1 en attendrait un à 151, le seul de
    // sa cadence entre 137 et 200, et la lecture s'arrêterait à 151.
    const depuis137 = journalDe(suite(64), { premiere: 137 });
    assert.deepEqual(bilan(depuis137), { evenement: EVENEMENT, entrees: 64, derniere: 200, jalons: 0, ecartees: 0 });
    assert.deepEqual(
      lireJournal(depuis137).entrees.filter(({ instantane }) => instantane !== null).map(({ revision }) => revision),
      [137, 187],
    );
  });

  test('une ouverture illisible écarte tout, et le journal n’a plus d’événement', () => {
    const avaries = [
      ['JSON invalide', (ligne) => ligne.slice(1)],
      ['type inconnu', retouche((valeur) => ({ ...valeur, type: 'jornal' }))],
      ['format plus récent', retouche((valeur) => ({ ...valeur, format: FORMAT + 1 }))],
      ['format 1', retouche((valeur) => ({ ...valeur, format: 1 }))],
      ['format 2', retouche((valeur) => ({ ...valeur, format: 2 }))],
      ['format en texte', retouche((valeur) => ({ ...valeur, format: '1' }))],
      ['format 0', retouche((valeur) => ({ ...valeur, format: 0 }))],
      ['format négatif', retouche((valeur) => ({ ...valeur, format: -1 }))],
      ['format non entier', retouche((valeur) => ({ ...valeur, format: 1.5 }))],
      ['format nul', retouche((valeur) => ({ ...valeur, format: null }))],
      ['format absent', retouche(({ format, ...reste }) => reste)],
      ['événement vide', retouche((valeur) => ({ ...valeur, evenement: '' }))],
      ['événement absent', retouche(({ evenement, ...reste }) => reste)],
      ['clé inconnue', retouche((valeur) => ({ ...valeur, nom: "Soirée d'essai" }))],
      ['une entrée à sa place', () => lignesCent()[1]],
    ];
    for (const [nom, remplacer] of avaries) {
      assert.deepEqual(bilan(abime(0, remplacer)), { evenement: null, entrees: 0, derniere: null, jalons: 0, ecartees: 101 }, nom);
      assert.equal(lireJournal(abime(0, remplacer)).format, null, nom);
    }
  });

  test('un jalon nomme une révision lue : avant toute entrée, à venir, élaguée ou sans nom, il arrête la lecture ; les jalons écartés se comptent comme lignes', () => {
    const jalon = (revision, nom = `Jalon ${revision}`) => ligneJalon({ revision, nom, horodatage: horodatage(revision) });
    assert.deepEqual(bilan(insere(1, jalon(1))), { evenement: EVENEMENT, entrees: 0, derniere: null, jalons: 0, ecartees: 101 });
    assert.deepEqual(bilan(insere(37, jalon(37))), { evenement: EVENEMENT, entrees: 36, derniere: 36, jalons: 0, ecartees: 65 });
    assert.deepEqual(bilan(insere(37, jalon(36))), { evenement: EVENEMENT, entrees: 100, derniere: 100, jalons: 1, ecartees: 0 });
    assert.deepEqual(bilan(insere(37, jalon(1))), { evenement: EVENEMENT, entrees: 100, derniere: 100, jalons: 1, ecartees: 0 });
    const sansNom = insere(37, jalon(36).replace('"nom":"Jalon 36"', '"nom":""'));
    assert.deepEqual(bilan(sansNom), { evenement: EVENEMENT, entrees: 36, derniere: 36, jalons: 0, ecartees: 65 });
    const depuis101 = lignesDe(journalDe(suite(5), { premiere: 101 }));
    assert.deepEqual(bilan(texteDe(depuis101.toSpliced(2, 0, jalon(100)))), {
      evenement: EVENEMENT,
      entrees: 1,
      derniere: 101,
      jalons: 0,
      ecartees: 5,
    });
    // Dix entrées, des jalons aux révisions 2, 5 et 8, la 4ᵉ abîmée : trois
    // entrées et un jalon retenus ; les sept entrées et deux jalons qui
    // suivent, écartés.
    const etapes = suite(10).map((etape, rang) => ({ ...etape, jalons: [2, 5, 8].includes(rang + 1) ? ['Jalon'] : [] }));
    const lignes = lignesDe(journalDe(etapes));
    const rang = lignes.findIndex((ligne) => ligne.startsWith('{"type":"entree","revision":4,'));
    lignes[rang] = lignes[rang].slice(0, 20);
    assert.deepEqual(bilan(texteDe(lignes)), { evenement: EVENEMENT, entrees: 3, derniere: 3, jalons: 1, ecartees: 9 });
  });

  test('texte vide, ouverture seule ou coupée ; marque d’ordre d’octets, fins de ligne CRLF, horloge qui recule', () => {
    assert.deepEqual(lireJournal(''), { evenement: null, format: null, entrees: [], jalons: [], ecartees: 0 });
    assert.deepEqual(lireJournal(texteDe([ligneOuverture(EVENEMENT)])), {
      evenement: EVENEMENT,
      format: FORMAT,
      entrees: [],
      jalons: [],
      ecartees: 0,
    });
    assert.deepEqual(lireJournal(ligneOuverture(EVENEMENT)), { evenement: null, format: null, entrees: [], jalons: [], ecartees: 1 });
    assert.deepEqual(lireJournal('\n'), { evenement: null, format: null, entrees: [], jalons: [], ecartees: 1 });
    assert.deepEqual(lireJournal(`\u{FEFF}${cent()}`), lireJournal(cent()));
    assert.deepEqual(lireJournal(cent().replaceAll('\n', '\r\n')), lireJournal(cent()));
    // L'ordre est celui des lignes : un horodatage qui recule n'y change rien.
    const etapes = suite(5);
    const lignes = [ligneOuverture(EVENEMENT)];
    etapes.forEach(({ apres }, rang) => {
      lignes.push(
        ligneEntree({
          revision: rang + 1,
          libelle: `Geste ${rang + 1}`,
          horodatage: horodatage(100 - rang),
          produitVersion: rang === 0 ? V1 : null,
          avant: etapes[rang - 1]?.apres,
          apres,
          instantane: rang === 0,
        }),
      );
    });
    const journal = lireJournal(texteDe(lignes));
    assert.deepEqual(journal.entrees.map(({ revision }) => revision), [1, 2, 3, 4, 5]);
    assert.equal(fil(journal).position, 5);
    assert.equal(texteCanonique(reconstruire(journal, 5)), texteCanonique(etapes[4].apres));
  });

  test('decoderJournal décode les octets ligne par ligne : la première ligne hors UTF-8 arrête le texte, elle et les suivantes comptées comme lireJournal compte ; une ouverture hors UTF-8 ne laisse aucun texte', () => {
    const octets = (...morceaux) =>
      new Uint8Array(morceaux.flatMap((morceau) => (typeof morceau === 'string' ? [...new TextEncoder().encode(morceau)] : morceau)));
    assert.deepEqual(decoderJournal(octets('a\n\u{E9}\n')), { texte: 'a\n\u{E9}\n', ecartees: 0 });
    assert.deepEqual(decoderJournal(octets('a\nb')), { texte: 'a\nb', ecartees: 0 });
    assert.deepEqual(decoderJournal(octets('\u{FEFF}a\nb', [0xc3])), { texte: '\u{FEFF}a\n', ecartees: 1 });
    assert.deepEqual(decoderJournal(octets('a\nb\n', [0xe9], 'c\nd\ne')), { texte: 'a\nb\n', ecartees: 3 });
    assert.deepEqual(decoderJournal(octets('a\n', [0xe9], '\nd\n')), { texte: 'a\n', ecartees: 2 });
    assert.deepEqual(decoderJournal(octets([0xe9], '\nb\n')), { texte: null, ecartees: 2 });
    assert.deepEqual(decoderJournal(octets([0xc3])), { texte: null, ecartees: 1 });
  });
});

// --- La date de la dernière entrée -----------------------------------------

describe('horodatageFinal : l’horodatage de la dernière entrée, lu depuis la fin du texte (§ 8.1, § 8.6, § 19.4)', () => {
  const cent = memoire(() => journalDe(suite(100)));
  const lignesCent = memoire(() => lignesDe(cent()));
  // La date que rend la lecture entière : l'horodatage de sa dernière entrée,
  // ou null.
  const parLaLecture = (texte) => lireJournal(texte).entrees.at(-1)?.horodatage ?? null;
  // La ligne relue, changée, puis réécrite.
  const retouche = (ligne, changer) => JSON.stringify(changer(JSON.parse(ligne)));
  // Le journal de cent entrées dont la ligne de rang donné — 0 pour
  // l'ouverture, r pour l'entrée r — est remplacée par la ligne donnée.
  const abime = (rang, ligne) => texteDe(lignesCent().toSpliced(rang, 1, ligne));
  // Cinq entrées dont l'horodatage recule d'une minute à chaque révision.
  function horlogeQuiRecule() {
    const etapes = suite(5);
    const lignes = [ligneOuverture(EVENEMENT)];
    etapes.forEach(({ apres }, rang) => {
      lignes.push(
        ligneEntree({
          revision: rang + 1,
          libelle: `Geste ${rang + 1}`,
          horodatage: horodatage(100 - rang),
          produitVersion: rang === 0 ? V1 : null,
          avant: etapes[rang - 1]?.apres,
          apres,
          instantane: rang === 0,
        }),
      );
    });
    return texteDe(lignes);
  }

  test('un journal sain rend la date de la lecture entière : séance, départ à 137, élagué, jalons, CRLF, marque d’ordre d’octets, horloge qui recule', () => {
    const avecJalons = journalDe(suite(10).map((etape, rang) => ({ ...etape, jalons: [4, 9].includes(rang) ? ['Jalon'] : [] })));
    const sains = [
      ['séance de 120 gestes', texteSeance()],
      ['cent entrées', cent()],
      ['départ à la révision 137', journalDe(suite(64), { premiere: 137 })],
      ['élagué', elaguer(journalDe(suite(650)))],
      ['jalons, dont un après la dernière entrée', avecJalons],
      ['fins de ligne CRLF', cent().replaceAll('\n', '\r\n')],
      ['marque d’ordre d’octets', `\u{FEFF}${cent()}`],
      ['horloge qui recule', horlogeQuiRecule()],
      ['une seule entrée', journalDe(suite(1))],
      ['ouverture seule', texteDe([ligneOuverture(EVENEMENT)])],
    ];
    for (const [nom, texte] of sains) {
      assert.equal(lireJournal(texte).ecartees, 0, nom);
      assert.equal(horodatageFinal(texte), parLaLecture(texte), nom);
    }
    assert.equal(horodatageFinal(cent()), horodatage(100));
    assert.equal(horodatageFinal(horlogeQuiRecule()), horodatage(96));
    assert.equal(horodatageFinal(texteDe([ligneOuverture(EVENEMENT)])), null);
  });

  test('l’ouverture et la fin du texte se jugent comme à la lecture entière : ouverture illisible, ligne finale sans fin de ligne, dernières lignes qui ne sont pas des entrées', () => {
    const ouvertures = [
      ['JSON invalide', lignesCent()[0].slice(1)],
      ['type inconnu', retouche(lignesCent()[0], (valeur) => ({ ...valeur, type: 'jornal' }))],
      ['format plus récent', retouche(lignesCent()[0], (valeur) => ({ ...valeur, format: FORMAT + 1 }))],
      ['format plus ancien', retouche(lignesCent()[0], (valeur) => ({ ...valeur, format: FORMAT - 1 }))],
      ['format 0', retouche(lignesCent()[0], (valeur) => ({ ...valeur, format: 0 }))],
      ['événement absent', retouche(lignesCent()[0], ({ evenement, ...reste }) => reste)],
      ['clé inconnue', retouche(lignesCent()[0], (valeur) => ({ ...valeur, nom: "Soirée d'essai" }))],
      ['une entrée à sa place', lignesCent()[1]],
    ];
    for (const [nom, ligne] of ouvertures) {
      assert.equal(horodatageFinal(abime(0, ligne)), null, nom);
      assert.equal(parLaLecture(abime(0, ligne)), null, nom);
    }
    const jalonTardif = ligneJalon({ revision: 100, nom: 'Clôture', horodatage: horodatage(500) });
    const fins = [
      ['texte vide', '', null],
      ['ouverture sans fin de ligne', ligneOuverture(EVENEMENT), null],
      ['une fin de ligne seule', '\n', null],
      ['seule entrée sans fin de ligne', texteDe([ligneOuverture(EVENEMENT)]) + lignesCent()[1], null],
      ['dernière ligne sans fin de ligne', cent().slice(0, -1), horodatage(99)],
      ['dernière ligne coupée', cent().slice(0, cent().lastIndexOf('{"op"')), horodatage(99)],
      ['dernière ligne en JSON tronqué', abime(100, lignesCent()[100].slice(0, -1)), horodatage(99)],
      ['dernière ligne vide', abime(100, ''), horodatage(99)],
      ['dernière ligne d’un type inconnu', abime(100, retouche(lignesCent()[100], (valeur) => ({ ...valeur, type: 'entre' }))), horodatage(99)],
      [
        'dernière entrée à l’horodatage sans fuseau',
        abime(100, retouche(lignesCent()[100], (valeur) => ({ ...valeur, horodatage: '2031-05-17T09:40:00' }))),
        horodatage(99),
      ],
      ['dernière entrée à l’horodatage numérique', abime(100, retouche(lignesCent()[100], (valeur) => ({ ...valeur, horodatage: 20310517 }))), horodatage(99)],
      ['un jalon plus tardif après la dernière entrée', texteDe([...lignesCent(), jalonTardif]), horodatage(100)],
    ];
    for (const [nom, texte, attendu] of fins) {
      assert.equal(horodatageFinal(texte), attendu, nom);
      assert.equal(parLaLecture(texte), attendu, nom);
    }
  });

  test('l’écart accepté : une ligne illisible avant la dernière entrée, ou un instantané hors de sa forme, n’arrête pas la date, que la lecture entière arrête', () => {
    const instantaneFautif = retouche(lignesCent()[1], (valeur) => {
      const instantane = copie(valeur.instantane);
      instantane.participants[0].nom = '';
      return { ...valeur, instantane };
    });
    const ecarts = [
      ['entrée 37 en JSON tronqué', abime(37, lignesCent()[37].slice(0, -1)), horodatage(36)],
      ['entrée 37 à clé inconnue', abime(37, retouche(lignesCent()[37], (valeur) => ({ ...valeur, auteur: 'Iris' }))), horodatage(36)],
      ['entrée 37 manquante', texteDe(lignesCent().toSpliced(37, 1)), horodatage(36)],
      ['première entrée à l’instantané fautif', abime(1, instantaneFautif), null],
      // Seuls le type et l'horodatage de la dernière entrée se contrôlent.
      ['dernière entrée à clé inconnue', abime(100, retouche(lignesCent()[100], (valeur) => ({ ...valeur, auteur: 'Iris' }))), horodatage(99)],
    ];
    for (const [nom, texte, lecture] of ecarts) {
      assert.equal(parLaLecture(texte), lecture, nom);
      assert.equal(horodatageFinal(texte), horodatage(100), nom);
    }
  });
});

// --- Le fil courant --------------------------------------------------------

describe('le fil courant, défaire et refaire (§ 8.3)', () => {
  // Les étapes 1 à 5 sont des gestes ; la 6 défait vers 4, la 7 vers 3, la
  // 8 refait vers 4, la 9 est un geste. Chaque retour porte la charge de sa
  // cible.
  const ETAPES = suite(9);
  ETAPES[5] = { apres: ETAPES[3].apres, sens: 'defaire', retour: 4 };
  ETAPES[6] = { apres: ETAPES[2].apres, sens: 'defaire', retour: 3 };
  ETAPES[7] = { apres: ETAPES[3].apres, sens: 'refaire', retour: 4 };
  const filApres = (n, etapes = ETAPES) => fil(lireJournal(journalDe(etapes.slice(0, n))));

  test('gestes 1 à 5, défaire (6 → 4), défaire (7 → 3), refaire (8 → 4), geste 9 : position 9, pile vide, refaire null, défaire → 4, fil courant [9, 4, 3, 2, 1], le geste 5 hors du fil', () => {
    assert.deepEqual(filApres(9), { position: 9, pile: [], courant: [9, 4, 3, 2, 1], cibleDefaire: 4, cibleRefaire: null });
  });

  test('après l’entrée 7 : défaire → 2, refaire → 4 ; après la 6 et la 8, défaire → 3, refaire → 5', () => {
    assert.deepEqual(filApres(7), { position: 3, pile: [5, 4], courant: [3, 2, 1], cibleDefaire: 2, cibleRefaire: 4 });
    assert.deepEqual(filApres(6), { position: 4, pile: [5], courant: [4, 3, 2, 1], cibleDefaire: 3, cibleRefaire: 5 });
    assert.deepEqual(filApres(8), { position: 4, pile: [5], courant: [4, 3, 2, 1], cibleDefaire: 3, cibleRefaire: 5 });
  });

  test('un revenir vers 2 depuis 5 se défait par refaire vers 5', () => {
    const etapes = suite(7);
    etapes[5] = { apres: etapes[1].apres, sens: 'revenir', retour: 2 };
    etapes[6] = { apres: etapes[4].apres, sens: 'refaire', retour: 5 };
    assert.deepEqual(filApres(6, etapes), { position: 2, pile: [5], courant: [2, 1], cibleDefaire: 1, cibleRefaire: 5 });
    assert.deepEqual(filApres(7, etapes), { position: 5, pile: [], courant: [5, 4, 3, 2, 1], cibleDefaire: 4, cibleRefaire: null });
  });

  test('un retour vers une entrée de retour prend la position de celle-ci', () => {
    const etapes = suite(8);
    etapes[5] = { apres: etapes[1].apres, sens: 'revenir', retour: 2 };
    etapes[7] = { apres: etapes[1].apres, sens: 'revenir', retour: 6 };
    assert.deepEqual(filApres(8, etapes), { position: 2, pile: [7], courant: [2, 1], cibleDefaire: 1, cibleRefaire: 7 });
  });

  test('un journal sans entrée n’a pas de position ; d’une seule entrée, rien à défaire', () => {
    const vide = { position: null, pile: [], courant: [], cibleDefaire: null, cibleRefaire: null };
    assert.deepEqual(fil(lireJournal('')), vide);
    assert.deepEqual(fil(lireJournal(texteDe([ligneOuverture(EVENEMENT)]))), vide);
    assert.deepEqual(filApres(1), { position: 1, pile: [], courant: [1], cibleDefaire: null, cibleRefaire: null });
  });

  test('un retour dont la cible précède le journal est une position sans prédécesseur ; la pile repart de lui', () => {
    // Révisions 101 à 104 : revenir vers 60, un geste, défaire vers 101,
    // refaire vers 102.
    const etapes = suite(4);
    etapes[0] = { ...etapes[0], sens: 'revenir', retour: 60 };
    etapes[2] = { apres: etapes[0].apres, sens: 'defaire', retour: 101 };
    etapes[3] = { apres: etapes[1].apres, sens: 'refaire', retour: 102 };
    const filDepuis101 = (n, liste = etapes) => fil(lireJournal(journalDe(liste.slice(0, n), { premiere: 101 })));
    assert.deepEqual(filDepuis101(1), { position: 101, pile: [], courant: [101], cibleDefaire: null, cibleRefaire: null });
    assert.deepEqual(filDepuis101(3), { position: 101, pile: [102], courant: [101], cibleDefaire: null, cibleRefaire: 102 });
    assert.deepEqual(filDepuis101(4), { position: 102, pile: [], courant: [102, 101], cibleDefaire: 101, cibleRefaire: null });
    // Refaire vers une révision qui précède le journal, pile vide.
    const refaireSansPile = suite(2);
    refaireSansPile[1] = { ...refaireSansPile[1], sens: 'refaire', retour: 98 };
    assert.deepEqual(filDepuis101(2, refaireSansPile), {
      position: 102,
      pile: [],
      courant: [102],
      cibleDefaire: null,
      cibleRefaire: null,
    });
  });
});

// --- Les lignes de l'historique ---------------------------------------------

describe("les lignes de l'historique : le fil de chaque entrée et ses jalons (§ 8.3)", () => {
  // La ligne attendue de l'entrée revision d'un journal de journalDe : son
  // libellé par défaut, son horodatage, et ce que l'épreuve précise.
  const ligne = (revision, fil, { sens = null, retour = null, jalons = [] } = {}) => ({
    revision,
    libelle: `Geste ${revision}`,
    horodatage: horodatage(revision),
    sens,
    retour,
    fil,
    jalons: jalons.map((nom) => ({ nom, horodatage: horodatage(revision) })),
  });

  test('un journal de gestes : chaque entrée sur le fil courant, la position à la dernière, les jalons sur leur révision', () => {
    const etapes = suite(3);
    etapes[0] = { ...etapes[0], jalons: ['Création'] };
    const journal = lireJournal(journalDe(etapes));
    assert.deepEqual(lignesHistorique(journal), {
      position: 3,
      lignes: [ligne(1, 'courant', { jalons: ['Création'] }), ligne(2, 'courant'), ligne(3, 'courant')],
    });
  });

  test('un défaire suivi d’un geste : le geste défait est abandonné, le retour se dit retour, le reste est le fil courant', () => {
    // 1 à 3 des gestes ; 4 défait vers 2 ; 5 un geste.
    const etapes = suite(5);
    etapes[3] = { apres: etapes[1].apres, sens: 'defaire', retour: 2 };
    const journal = lireJournal(journalDe(etapes));
    assert.deepEqual(lignesHistorique(journal), {
      position: 5,
      lignes: [
        ligne(1, 'courant'),
        ligne(2, 'courant'),
        ligne(3, 'abandonne'),
        ligne(4, 'retour', { sens: 'defaire', retour: 2 }),
        ligne(5, 'courant'),
      ],
    });
  });

  test('un retour dont la cible précède le journal est sa propre position : sur le fil courant, ni abandonné ni retour', () => {
    // Révisions 101 et 102 : revenir vers 60, que l'élagage a retirée, puis
    // un geste.
    const etapes = suite(2);
    etapes[0] = { ...etapes[0], sens: 'revenir', retour: 60 };
    const journal = lireJournal(journalDe(etapes, { premiere: 101 }));
    assert.deepEqual(lignesHistorique(journal), {
      position: 102,
      lignes: [ligne(101, 'courant', { sens: 'revenir', retour: 60 }), ligne(102, 'courant')],
    });
    assert.deepEqual(lignesHistorique(lireJournal(journalDe(etapes.slice(0, 1), { premiere: 101 }))), {
      position: 101,
      lignes: [ligne(101, 'courant', { sens: 'revenir', retour: 60 })],
    });
  });

  test('les jalons se groupent sur leur révision dans l’ordre des lignes ; un jalon sans entrée n’apparaît pas', () => {
    const etapes = suite(3);
    etapes[0] = { ...etapes[0], jalons: ['Création'] };
    etapes[1] = { ...etapes[1], jalons: ['Avant le repas', 'Avant la génération'] };
    const lu = lireJournal(journalDe(etapes));
    const orphelin = { type: 'jalon', revision: 9, nom: 'Instant élagué', horodatage: horodatage(9) };
    const journal = { ...lu, jalons: [orphelin, ...lu.jalons, { ...orphelin, revision: 4 }] };
    assert.deepEqual(lignesHistorique(journal).lignes, [
      ligne(1, 'courant', { jalons: ['Création'] }),
      ligne(2, 'courant', { jalons: ['Avant le repas', 'Avant la génération'] }),
      ligne(3, 'courant'),
    ]);
  });

  test('un journal sans entrée : aucune position, aucune ligne', () => {
    for (const texte of ['', texteDe([ligneOuverture(EVENEMENT)])]) {
      assert.deepEqual(lignesHistorique(lireJournal(texte)), { position: null, lignes: [] });
    }
  });

  test('les lignes sont neuves : les changer ne touche pas le journal, et deux lectures ne partagent rien', () => {
    const etapes = suite(2);
    etapes[0] = { ...etapes[0], jalons: ['Création'] };
    const journal = lireJournal(journalDe(etapes));
    const avant = copie(journal);
    const premiere = lignesHistorique(journal);
    premiere.lignes[0].libelle = 'Changé';
    premiere.lignes[0].jalons[0].nom = 'Changé';
    premiere.lignes[1].jalons.push({ nom: 'Ajouté', horodatage: horodatage(2) });
    assert.deepEqual(journal, avant);
    assert.deepEqual(lignesHistorique(journal).lignes.map(({ libelle, jalons }) => [libelle, jalons.length]), [
      ['Geste 1', 1],
      ['Geste 2', 0],
    ]);
  });
});

// --- La construction notée -------------------------------------------------

describe('la construction notée (§ 8.8)', () => {
  test('produitVersion non nulle à la première entrée et au premier geste d’une autre construction, nulle ailleurs ; versionDe rend celle de chaque révision', () => {
    const versions = [...Array(10).fill(V1), ...Array(10).fill(V2), ...Array(5).fill(V1)];
    const etapes = suite(25).map((etape, rang) => ({ ...etape, version: versions[rang] }));
    const journal = lireJournal(journalDe(etapes));
    assert.deepEqual(
      journal.entrees.flatMap(({ revision, produitVersion }) => (produitVersion === null ? [] : [[revision, produitVersion]])),
      [[1, V1], [11, V2], [21, V1]],
    );
    assert.deepEqual(de(1, 25).map((revision) => versionDe(journal, revision)), versions);
    for (const absente of [0, 26, -1, 2.5, '3', null, undefined]) assert.equal(versionDe(journal, absente), null);
    assert.equal(versionDe(lireJournal(''), 1), null);
    // Une seule construction : notée une fois, à la première entrée.
    const seance = lireJournal(texteSeance());
    assert.deepEqual(seance.entrees.filter(({ produitVersion }) => produitVersion !== null).map(({ revision }) => revision), [1]);
    assert.equal(versionDe(seance, 120), V1);
  });
});

// --- L'élagage -------------------------------------------------------------

describe('l’élagage : au-delà du plafond, depuis la frontière d’instantané la plus récente qui garde le plancher (§ 8.6)', () => {
  // 700 étapes : la construction V2 de la révision 130 à la 159, V1 ailleurs ;
  // un jalon toutes les 25 révisions.
  const ETAPES = suite(700).map((etape, rang) => ({
    ...etape,
    version: rang + 1 >= 130 && rang + 1 < 160 ? V2 : V1,
    jalons: (rang + 1) % 25 === 0 ? [`Jalon ${rang + 1}`] : [],
  }));
  const lignes700 = memoire(() => lignesDe(journalDe(ETAPES)));
  // Texte du journal des n premières étapes : les lignes qui précèdent l'entrée n + 1.
  const prefixe = (n) => {
    const fin = lignes700().findIndex((ligne) => ligne.startsWith(`{"type":"entree","revision":${n + 1},`));
    return texteDe(lignes700().slice(0, fin === -1 ? lignes700().length : fin));
  };

  test('650 entrées : la première gardée est la révision 151, un instantané, qui porte sa construction ; 500 entrées ; les jalons des entrées retirées partis ; toute autre ligne gardée intacte', () => {
    const texte = prefixe(650);
    const elague = elaguer(texte);
    const journal = lireJournal(elague);
    assert.equal(journal.entrees.length, 500);
    assert.equal(journal.entrees[0].revision, 151);
    assert.notEqual(journal.entrees[0].instantane, null);
    assert.equal(journal.ecartees, 0);
    assert.deepEqual(
      journal.jalons.map(({ revision }) => revision),
      de(151, 650).filter((revision) => revision % 25 === 0),
    );
    // Le texte attendu : l'ouverture, l'entrée 151 qui porte V2, la
    // construction de la révision 130 dont elle hérite, puis les lignes
    // d'origine de révision 151 ou plus, telles quelles.
    const origine = lignesDe(texte);
    const valeurs = origine.map((ligne) => JSON.parse(ligne));
    const rang = valeurs.findIndex(({ type, revision }) => type === 'entree' && revision === 151);
    assert.equal(valeurs[rang].produitVersion, null);
    const attendu = [
      origine[0],
      JSON.stringify({ ...valeurs[rang], produitVersion: V2 }),
      ...origine.slice(rang + 1).filter((_, i) => valeurs[rang + 1 + i].revision >= 151),
    ];
    assert.equal(elague, texteDe(attendu));
    // Chaque instant gardé se restitue comme avant l'élagage, avec sa construction.
    const avant = lireJournal(texte);
    for (const revision of [151, 152, 199, 200, 201, 202, 649, 650]) {
      assert.equal(texteCanonique(reconstruire(journal, revision)), texteCanonique(reconstruire(avant, revision)));
    }
    for (const revision of de(151, 650)) assert.equal(versionDe(journal, revision), versionDe(avant, revision));
    assert.deepEqual(fil(journal), { ...fil(avant), courant: de(650, 151) });
  });

  test('601 entrées : coupe à 101, 501 gardées ; 600 entrées, et 600 avec des jalons en plus : null', () => {
    const journal = lireJournal(elaguer(prefixe(601)));
    assert.equal(journal.entrees.length, 501);
    assert.equal(journal.entrees[0].revision, 101);
    assert.equal(journal.entrees[0].produitVersion, V1);
    assert.equal(elaguer(prefixe(600)), null);
    const jalonne = suite(600).map((etape) => ({ ...etape, jalons: ['Jalon'] }));
    assert.equal(elaguer(journalDe(jalonne)), null);
  });

  test('le plancher l’emporte : de 601 à 700 entrées, la coupe garde de 500 à 549 entrées, depuis un instantané', () => {
    for (const n of [601, 602, 625, 649, 650, 651, 675, 699, 700]) {
      const coupe = 1 + INTERVALLE_INSTANTANE * Math.floor((n - PLANCHER_ENTREES) / INTERVALLE_INSTANTANE);
      const elague = elaguer(prefixe(n));
      const { entrees } = lireJournal(elague);
      assert.equal(entrees[0].revision, coupe, `${n} entrées`);
      assert.equal(entrees.length, n - coupe + 1, `${n} entrées`);
      assert.ok(entrees.length >= PLANCHER_ENTREES && entrees.length < PLANCHER_ENTREES + INTERVALLE_INSTANTANE);
      assert.notEqual(entrees[0].instantane, null);
      assert.equal(elaguer(elague), null);
    }
  });

  test('une première entrée gardée qui porte déjà sa construction garde sa ligne intacte', () => {
    const etapes = suite(650).map((etape, rang) => ({ ...etape, version: rang + 1 >= 151 ? V2 : V1 }));
    const texte = journalDe(etapes);
    const ligne151 = lignesDe(texte).find((ligne) => ligne.startsWith('{"type":"entree","revision":151,'));
    assert.match(ligne151, new RegExp(`"produitVersion":"${V2.replaceAll('.', '\\.')}"`));
    assert.equal(lignesDe(elaguer(texte))[1], ligne151);
  });

  test('un journal déjà élagué s’élague depuis sa première révision ; les lignes écartées se recopient ; la marque d’ordre d’octets ne se recopie pas', () => {
    // Commencé à la révision 137, le journal porte ses instantanés à 137,
    // 187, 237… : la coupe tombe sur 237, le plus récent qui garde le
    // plancher, et non sur 201, qu'un compte depuis la révision 1 désignerait.
    const depuis137 = lireJournal(elaguer(journalDe(suite(601), { premiere: 137 })));
    assert.deepEqual([depuis137.entrees.length, depuis137.entrees.at(0)?.revision, depuis137.ecartees], [501, 237, 0]);
    // Une dernière ligne coupée, puis une ligne illisible suivie d'une autre.
    const coupee = `${prefixe(650)}{"type":"entree","revision":651`;
    const elaguee = elaguer(coupee);
    assert.ok(elaguee.endsWith('\n{"type":"entree","revision":651'));
    assert.deepEqual([lireJournal(elaguee).entrees.length, lireJournal(elaguee).ecartees], [500, 1]);
    const queue = `${prefixe(650)}illisible\n${lignes700().at(-1)}\n`;
    assert.ok(elaguer(queue).endsWith(`\nillisible\n${lignes700().at(-1)}\n`));
    assert.equal(lireJournal(elaguer(queue)).ecartees, 2);
    assert.equal(elaguer(`\u{FEFF}${prefixe(601)}`), elaguer(prefixe(601)));
  });

  test('un retour dont la cible est élaguée devient la racine du fil : il porte la charge de sa cible, et défaire s’arrête à lui', () => {
    const etapes = suite(601);
    etapes[589] = { apres: etapes[59].apres, sens: 'revenir', retour: 60 };
    const texte = journalDe(etapes);
    assert.deepEqual(fil(lireJournal(texte)).courant, [...de(601, 591), ...de(60, 1)]);
    const journal = lireJournal(elaguer(texte));
    assert.equal(journal.entrees[0].revision, 101);
    assert.deepEqual(fil(journal), { position: 601, pile: [], courant: de(601, 590), cibleDefaire: 600, cibleRefaire: null });
    assert.equal(texteCanonique(reconstruire(journal, 590)), texteCanonique(etapes[59].apres));
  });

  // L'élagage en mémoire (elaguerJournal) contre sa référence, le chemin par
  // le texte : texteDuJournal, elaguer, puis lireJournal, null sous le
  // plafond.
  const parLeTexte = (journal) => {
    const texte = elaguer(texteDuJournal(journal));
    return texte === null ? null : { texte, journal: lireJournal(texte) };
  };
  // elaguerJournal rend ce que rend la référence, au JSON près, ordre des clés
  // compris, sans toucher au journal reçu ; le texte du journal se relit en
  // entier, l'hypothèse sous laquelle elaguerJournal ne relit rien.
  function exigerMemeElagage(journal, message) {
    const relu = lireJournal(texteDuJournal(journal));
    assert.deepEqual([relu.ecartees, relu.entrees.length], [0, journal.entrees.length], `${message} : le texte se relit`);
    const avant = JSON.stringify(journal);
    const elague = elaguerJournal(journal);
    assert.equal(JSON.stringify(elague), JSON.stringify(parLeTexte(journal)), message);
    assert.equal(JSON.stringify(journal), avant, `${message} : le journal reçu est intact`);
    return elague;
  }
  const CLES_ENTREE = ['type', 'revision', 'libelle', 'horodatage', 'sens', 'retour', 'produitVersion', 'instantane', 'correctif'];
  // L'entrée, ses clés dans l'ordre inverse de celui qu'écrit ligneEntree.
  const aRebours = (entree) => Object.fromEntries(CLES_ENTREE.toReversed().map((cle) => [cle, entree[cle]]));
  const unJalon = (revision, nom) => ({ type: 'jalon', revision, nom, horodatage: horodatage(revision) });
  // Le journal des 700 étapes, ses jalons dans le désordre : un second jalon
  // de la révision 650 avant le sien, un jalon d'une révision qu'aucune
  // entrée ne porte, ceux de l'ordre des lignes à rebours, un jalon de la
  // révision 3, que l'élagage retire, et un de la révision 201, où tombe la
  // coupe de 700 entrées.
  const SECOND_650 = unJalon(650, 'Second de 650');
  const TROISIEME = unJalon(3, 'Troisième');
  const SUR_LA_COUPE = unJalon(201, 'Sur la coupe');
  const enDesordre = (journal) => ({
    ...journal,
    jalons: [SECOND_650, unJalon(9999, 'Hors du journal'), ...journal.jalons.toReversed(), TROISIEME, SUR_LA_COUPE],
  });

  test('texteDuJournal récrit le texte d’un journal lu ; chaque jalon suit son entrée, dans l’ordre de la liste ; un jalon sans entrée ne s’écrit pas ; l’ouverture porte le format courant', () => {
    const texte = prefixe(650);
    const journal = lireJournal(texte);
    assert.equal(texteDuJournal(journal), texte);
    assert.equal(texteDuJournal({ ...journal, format: 1 }), texte);
    const lignes = lignesDe(texte);
    const rangDe = (debut) => lignes.findIndex((ligne) => ligne.startsWith(debut));
    const attendu = lignes
      .toSpliced(rangDe('{"type":"jalon","revision":650,'), 0, ligneJalon(SECOND_650))
      .toSpliced(rangDe('{"type":"entree","revision":201,') + 1, 0, ligneJalon(SUR_LA_COUPE))
      .toSpliced(rangDe('{"type":"entree","revision":3,') + 1, 0, ligneJalon(TROISIEME));
    assert.equal(texteDuJournal(enDesordre(journal)), texteDe(attendu));
    assert.equal(texteDuJournal(lireJournal(texteDe([ligneOuverture(EVENEMENT)]))), texteDe([ligneOuverture(EVENEMENT)]));
  });

  test('elaguerJournal rend le texte élagué et sa relecture comme le chemin par le texte, de 601 à 700 entrées ; la coupe sans version la reçoit ; les entrées qui la suivent sont celles du journal, non relues', () => {
    for (const n of [601, 602, 625, 649, 650, 651, 675, 699, 700]) {
      const journal = lireJournal(prefixe(n));
      const elague = exigerMemeElagage(journal, `${n} entrées`);
      assert.notEqual(elague, null, `${n} entrées`);
      const rang = journal.entrees.findIndex(({ revision }) => revision === elague.journal.entrees[0].revision);
      assert.equal(journal.entrees[rang].produitVersion, null, `${n} entrées : coupe sans version`);
      assert.equal(elague.journal.entrees[0].produitVersion, versionDe(journal, journal.entrees[rang].revision), `${n} entrées`);
      if (n === 650) assert.equal(elague.journal.entrees[0].produitVersion, V2);
      assert.ok(
        elague.journal.entrees.slice(1).every((entree, i) => entree === journal.entrees[rang + 1 + i]),
        `${n} entrées : entrées partagées`,
      );
    }
  });

  test('elaguerJournal : une coupe qui porte sa version garde sa ligne ; les clés d’une entrée à rebours ; un journal d’un format plus ancien', () => {
    const etapes = suite(650).map((etape, rang) => ({ ...etape, version: rang + 1 >= 151 ? V2 : V1 }));
    const versionnee = lireJournal(journalDe(etapes));
    const ligne151 = lignesDe(journalDe(etapes)).find((ligne) => ligne.startsWith('{"type":"entree","revision":151,'));
    assert.equal(lignesDe(exigerMemeElagage(versionnee, 'coupe versionnée').texte)[1], ligne151);
    for (const [nom, journal] of [
      ['coupe sans version', lireJournal(prefixe(650))],
      ['coupe versionnée', versionnee],
    ]) {
      const elague = exigerMemeElagage({ ...journal, entrees: journal.entrees.map(aRebours) }, `${nom}, à rebours`);
      // La coupe sans version se réécrit dans l'ordre de ligneEntree ; les
      // autres entrées se recopient à rebours.
      assert.equal(lignesDe(elague.texte)[1].startsWith('{"type":"entree"'), nom === 'coupe sans version', nom);
      assert.ok(lignesDe(elague.texte)[2].startsWith('{"correctif":'), nom);
      const ancien = exigerMemeElagage({ ...journal, format: 1 }, `${nom}, format 1`);
      assert.equal(ancien.journal.format, FORMAT);
    }
  });

  test('elaguerJournal : les jalons dans le désordre, d’une révision absente ou d’une entrée retirée', () => {
    const elague = exigerMemeElagage(enDesordre(lireJournal(prefixe(700))), 'jalons dans le désordre');
    assert.equal(elague.journal.entrees[0].revision, 201);
    const jalons = elague.journal.jalons.map(({ revision, nom }) => `${revision} ${nom}`);
    assert.deepEqual(jalons, [
      '201 Sur la coupe',
      ...de(201, 700)
        .filter((revision) => revision % 25 === 0)
        .flatMap((revision) => (revision === 650 ? ['650 Second de 650', '650 Jalon 650'] : [`${revision} Jalon ${revision}`])),
    ]);
  });

  test('elaguerJournal : un journal déjà élagué, de nouveau au-delà du plafond, et un retour dont la cible part ; le journal élagué ne s’élague plus', () => {
    const etapes = suite(601);
    etapes[589] = { apres: etapes[59].apres, sens: 'revenir', retour: 60 };
    for (const [nom, texte] of [
      ['depuis 137', journalDe(suite(601), { premiere: 137 })],
      ['depuis 101', journalDe(suite(700), { premiere: 101 })],
      ['retour', journalDe(etapes)],
    ]) {
      const elague = exigerMemeElagage(lireJournal(texte), nom);
      assert.notEqual(elague, null, nom);
      assert.equal(elaguerJournal(elague.journal), null, nom);
    }
  });

  test('elaguerJournal : sous le plafond, null', () => {
    const jalonne = suite(600).map((etape) => ({ ...etape, jalons: ['Jalon'] }));
    for (const [nom, texte] of [
      ['600 entrées', prefixe(600)],
      ['600 entrées jalonnées', journalDe(jalonne)],
      ['une entrée', prefixe(1)],
      ['ouverture seule', texteDe([ligneOuverture(EVENEMENT)])],
    ]) {
      assert.equal(exigerMemeElagage(lireJournal(texte), nom), null, nom);
    }
    assert.equal(elaguerJournal(lireJournal('')), null);
  });
});

describe('le journal d’un format plus ancien ne se lit pas (§ 8.8)', () => {
  // Le texte d'un journal dont la ligne d'ouverture déclare le format donné,
  // le reste inchangé.
  const auFormat = (texte, format) => {
    const lignes = lignesDe(texte);
    lignes[0] = JSON.stringify({ ...JSON.parse(lignes[0]), format });
    return texteDe(lignes);
  };
  const cent = memoire(() => journalDe(suite(100)));

  test('ligneOuverture écrit FORMAT, et la lecture le rend', () => {
    assert.equal(ligneOuverture(EVENEMENT), `{"type":"journal","format":${FORMAT},"evenement":"${EVENEMENT}"}`);
    assert.equal(lireJournal(cent()).format, FORMAT);
  });

  test('chaque format de 1 à FORMAT − 1 rend l’ouverture illisible : toutes les lignes s’écartent, sans événement ni format, et la date finale ne se lit pas', () => {
    const formats = Array.from({ length: FORMAT - 1 }, (_, rang) => rang + 1);
    assert.deepEqual(formats, [1, 2]);
    for (const format of formats) {
      const texte = auFormat(cent(), format);
      const lu = lireJournal(texte);
      assert.deepEqual([lu.evenement, lu.format, lu.entrees.length, lu.jalons.length, lu.ecartees], [null, null, 0, 0, 101], String(format));
      assert.equal(horodatageFinal(texte), null, String(format));
    }
  });
});

describe('la cible de redondance, un réglage oublié, traverse le journal (§ 8.9)', () => {
  const cent = memoire(() => journalDe(suite(100)));

  test('posée dans un instantané, puis par un correctif, et retirée, elle se lit, et chaque instant se restitue sans elle', () => {
    const courant = lireJournal(cent());
    const lignes = lignesDe(cent()).map((ligne) => JSON.parse(ligne));
    const entree = (revision) => lignes.find((ligne) => ligne.type === 'entree' && ligne.revision === revision);
    entree(1).instantane.reglages.cibleRedondance = 800;
    entree(2).correctif.unshift({ op: 'poser', chemin: ['reglages', 'cibleRedondance'], valeur: 1200 });
    entree(3).correctif.push({ op: 'retirer', chemin: ['reglages', 'cibleRedondance'] });
    entree(4).correctif.push({ op: 'retirer', chemin: ['reglages', 'cibleRedondance'] });
    const lu = lireJournal(texteDe(lignes.map((ligne) => JSON.stringify(ligne))));
    assert.deepEqual([lu.format, lu.ecartees, lu.entrees.length], [FORMAT, 0, courant.entrees.length]);
    for (const revision of [1, 2, 3, 4, 5, 51, 100]) {
      const charge = reconstruire(lu, revision);
      assert.equal(Object.hasOwn(charge.reglages, 'cibleRedondance'), false, String(revision));
      assert.equal(texteCanonique(charge), texteCanonique(reconstruire(courant, revision)), String(revision));
    }
  });
});

describe('la dérivation traverse le journal (§ 8.3, § 8.6, § 8.9, C11, C25, D77)', () => {
  // La petite démonstration, puis deux propositions ordinaires (1 et 2),
  // deux dérivées de la 1, tour 2 figé (3 et 4), l'effacement de leur
  // départ et de la 2, un retour à l'état des dérivées, l'effacement de
  // tout, et une proposition ordinaire de plus (5).
  function etapesDerivees() {
    const base = chargeDe('petite');
    const configuration = configurationDepuisCharge(base);
    const poser = (charge, graine, derivation) => {
      const suivante = copie(charge);
      const decalage = suivante.prochainsIds.proposition - 1;
      const options = { produitVersion: V1, attribuerSieges: false, decalage, derivation };
      const posees = rechercher(configuration, { graine, arret: ARRET, nombre: 2 }).map((p) => versFichier(p, configuration, options));
      suivante.propositions.push(...posees);
      suivante.prochainsIds.proposition = decalage + posees.length + 1;
      suivante.evenement.etat = 'propose';
      return suivante;
    };
    const garder = (charge, ids) => ({ ...copie(charge), propositions: copie(charge.propositions.filter(({ id }) => ids.includes(id))) });
    const ordinaires = poser(base, 3, null);
    const derivees = poser(ordinaires, 4, { depart: 1, toursFiges: [2] });
    const sansDepart = garder(derivees, [3, 4]);
    const vide = garder(derivees, []);
    const suivante = poser(vide, 5, null);
    return [
      { apres: base },
      { apres: ordinaires },
      { apres: derivees },
      { apres: sansDepart },
      { apres: copie(derivees), sens: 'revenir', retour: 3 },
      { apres: vide },
      { apres: { ...suivante, propositions: suivante.propositions.slice(0, 1) } },
    ];
  }

  test('chaque révision se reconstruit, dérivées comprises ; l’effacement du départ garde les dérivées, et le retour rend leur départ', () => {
    const etapes = etapesDerivees();
    const texte = journalDe(etapes);
    const journal = lireJournal(texte);
    assert.equal(journal.ecartees, 0);
    etapes.forEach(({ apres }, rang) => {
      const reconstruite = reconstruire(journal, rang + 1);
      assert.equal(texteCanonique(reconstruite), texteCanonique(apres), `révision ${rang + 1}`);
      assert.deepEqual(examiner(reconstruite).fautives, [], `révision ${rang + 1}`);
    });
    const derivation = (r) => reconstruire(journal, r).propositions.map(({ id, depart, toursFiges }) => [id, depart, toursFiges]);
    assert.deepEqual(derivation(3), [[1, undefined, undefined], [2, undefined, undefined], [3, 1, [2]], [4, 1, [2]]]);
    assert.deepEqual(derivation(4), [[3, 1, [2]], [4, 1, [2]]]);
    assert.deepEqual(derivation(5), derivation(3));
    assert.deepEqual(derivation(7), [[5, undefined, undefined]]);
    // Les révisions 3, 4 et 5 sont des correctifs, qui portent les champs.
    const lignes = lignesDe(texte);
    assert.deepEqual([3, 4, 5].map((r) => estInstantane(r, 1)), [false, false, false]);
    assert.ok(lignes[3].includes('"depart":1,"toursFiges":[2]'), lignes[3]);
    // Le retour de la révision 5 y prend la place de la 3, qu'il rend.
    assert.deepEqual(fil(journal).courant, [7, 6, 3, 2, 1]);
  });
});

describe('la présence par tour traverse le journal (§ 8.3, § 8.6, § 8.9)', () => {
  // La petite démonstration, son plan parfait proposé et retenu, puis des
  // gestes de présence, chacun avec le retenu ajusté dans la même étape :
  // une arrivée au tour 2, un départ après le tour 2, un retour à tous les
  // tours, une exclusion, une réintégration aux tours 3 et 4.
  function etapesPresence() {
    const base = chargeDe('petite');
    const configuration = configurationDepuisCharge(base);
    const proposition = versFichier(
      { id: 1, graine: 48_271, arret: 20_000, historique: 1_000, plan: PLAN_PARFAIT_PETITE },
      configuration,
      { produitVersion: V1, attribuerSieges: false, decalage: 0 },
    );
    base.propositions = [proposition];
    base.prochainsIds.proposition = 2;
    const { id, siegesAttribues, tables, capacites, tours, participants, placement } = copie(proposition);
    base.retenu = { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
    base.evenement.etat = 'retenu';
    // La charge reçue, la personne id changée par changer, le retenu ajusté.
    const geste = (charge, idPersonne, changer) => {
      const suivante = copie(charge);
      changer(suivante.participants.find((p) => p.id === idPersonne));
      suivante.retenu = ajusterALaPresence(suivante.retenu, suivante, [idPersonne]).placement;
      return suivante;
    };
    const etapes = [base];
    const suivre = (idPersonne, changer) => etapes.push(geste(etapes.at(-1), idPersonne, changer));
    suivre(5, (p) => { p.presence = [2, 3, 4]; });
    suivre(12, (p) => { p.presence = [1, 2]; });
    suivre(5, (p) => { delete p.presence; });
    suivre(3, (p) => { p.exclu = true; });
    suivre(3, (p) => { p.exclu = false; p.presence = [3, 4]; });
    return etapes.map((apres) => ({ apres }));
  }

  test('chaque instant se reconstruit, par le correctif depuis l’instant d’avant comme par l’instantané ; le retenu ne dérive jamais par ses participants', () => {
    const etapes = etapesPresence();
    for (const { apres } of etapes) {
      assert.deepEqual(examiner(apres).retenu, { fautes: [], raisons: [] });
      assert.doesNotThrow(() => analyser(serialiser(apres, { revision: 1, produitVersion: V1 })));
    }
    assert.ok(etapes.at(-1).apres.retenu.placement[0].absents.includes(3));
    for (let debut = 0; debut < etapes.length; debut += 1) {
      const suite = etapes.slice(debut);
      const texte = journalDe(suite, { premiere: debut + 1 });
      const lignes = lignesDe(texte);
      assert.ok(lignes[1].startsWith('{"type":"entree"'), lignes[1]);
      const journal = lireJournal(texte);
      assert.equal(journal.ecartees, 0);
      suite.forEach(({ apres }, rang) => {
        const revision = debut + rang + 1;
        assert.equal(texteCanonique(reconstruire(journal, revision)), texteCanonique(apres), `révision ${revision}, début ${debut + 1}`);
      });
    }
    // Le correctif de l'arrivée pose la présence et touche la liste absents du
    // tour 1 du retenu.
    const correctif = lignesDe(journalDe(etapes))[2];
    assert.ok(correctif.includes('"presence"') && correctif.includes('"absents"'), correctif);
  });
});

// --- Une seule copie -------------------------------------------------------

// Chaque objet et chaque liste que valeur atteint, elle comprise.
function objetsDe(valeur, vus = new Set()) {
  if (valeur === null || typeof valeur !== 'object' || vus.has(valeur)) return vus;
  vus.add(valeur);
  for (const enfant of Array.isArray(valeur) ? valeur : Object.values(valeur)) objetsDe(enfant, vus);
  return vus;
}
// Les objets et les listes que a et b atteignent l'un et l'autre.
function partages(a, b) {
  const deA = objetsDe(a);
  return [...objetsDe(b)].filter((objet) => deA.has(objet));
}

// La ligne d'une entrée par la composition directe : la copie canonique de
// apres par canoniser pour un instantané, difference(avant, apres) pour un
// correctif, chaque clé dans l'ordre du texte. Elle sert d'oracle, sans
// passer par le module.
function ligneDirecte(champs, avant) {
  const { revision, libelle, sens, retour, produitVersion, apres, instantane } = champs;
  return JSON.stringify({
    type: 'entree',
    revision,
    libelle,
    horodatage: champs.horodatage,
    sens,
    retour,
    produitVersion,
    instantane: instantane ? canoniser(apres) : null,
    correctif: instantane ? null : difference(avant, apres),
  });
}

// La séance aux propositions figées : chaque charge recopiée, chaque
// proposition figée, et la même que celle de l'étape précédente quand elle
// s'y écrit pareil, partagée d'une charge à la suivante.
const seanceFigee = memoire(() => {
  let precedentes = [];
  return SEANCE.map((etape) => {
    const apres = copie(etape.apres);
    apres.propositions = apres.propositions.map(
      (proposition) =>
        precedentes.find((figee) => JSON.stringify(figee) === JSON.stringify(proposition)) ?? figer(proposition),
    );
    precedentes = apres.propositions;
    return { ...etape, apres };
  });
});

// Une valeur dont toute lecture lève : rien ne la touche avant le refus
// attendu.
const intouchable = () =>
  new Proxy(
    {},
    new Proxy(
      {},
      {
        get: () => () => {
          throw new Error('valeur lue');
        },
      },
    ),
  );

// L'erreur que lève appel, ou null.
function erreurDe(appel) {
  try {
    appel();
  } catch (erreur) {
    return erreur;
  }
  return null;
}

// Une proposition derrière un compteur de lectures : chaque clé lue sur elle
// compte, et rien de ce qu'elle atteint.
function sousCompteur(proposition) {
  const lus = { n: 0 };
  const lue = new Proxy(proposition, {
    get(cible, cle, recepteur) {
      lus.n += 1;
      return Reflect.get(cible, cle, recepteur);
    },
  });
  return { lue, lus };
}

describe('la restitution sur une seule copie, et l’entrée qui rend sa copie canonique (§ 8.2, § 8.6, § 8.8)', () => {
  test('reconstruireCanonique(journal, r) égale canoniser(reconstruire(journal, r)), ordre des clés compris, pour chacune des 120 révisions ; ses refus sont ceux de reconstruire', () => {
    const journal = lireJournal(texteSeance());
    for (let revision = 1; revision <= SEANCE.length; revision += 1) {
      const rendue = reconstruire(journal, revision);
      const canonique = reconstruireCanonique(journal, revision);
      assert.equal(JSON.stringify(canonique), JSON.stringify(canoniser(rendue)), `révision ${revision}`);
      assert.equal(texteCanonique(canonique), texteCanonique(SEANCE[revision - 1].apres), `révision ${revision}`);
      assert.deepEqual(partages(canonique, rendue), [], `révision ${revision}`);
    }
    for (const revision of [0, 121, '5', null]) {
      assert.throws(() => reconstruireCanonique(journal, revision), RangeError, String(revision));
    }
    const lignes = lignesDe(texteSeance());
    const rang = lignes.findIndex((ligne) => ligne.startsWith('{"type":"entree","revision":33,'));
    const retirerAbsent = [{ op: 'retirer', chemin: ['participants', { id: 999 }] }];
    lignes[rang] = JSON.stringify({ ...JSON.parse(lignes[rang]), correctif: retirerAbsent });
    const abime = lireJournal(texteDe(lignes));
    for (const revision of [33, 50]) {
      assert.throws(
        () => reconstruireCanonique(abime, revision),
        (erreur) => erreur instanceof ErreurStockage && erreur.code === 'CORRECTIF' && erreur.details.rang === 0,
        `révision ${revision}`,
      );
    }
    assert.equal(texteCanonique(reconstruireCanonique(abime, 51)), texteCanonique(SEANCE[50].apres));
  });

  test('un dernier correctif qui rompt l’ordre canonique laisse reconstruire hors de l’ordre, comme la chaîne des appliquer ; le correctif suivant le range ; reconstruireCanonique le range toujours', () => {
    const etapes = suite(4);
    const lignes = lignesDe(journalDe(etapes));
    // L'entrée 3 change l'identifiant de la personne 1 et insère une
    // personne, ses clés à rebours : la liste et l'objet sortent de l'ordre
    // canonique, que l'entrée 4 rétablit en posant une note.
    const inseree = {
      exclu: false,
      notes: null,
      titrePressenti: null,
      courriel: null,
      organisation: null,
      prenom: null,
      nom: 'Cormoran',
      id: 4,
    };
    const rompre = [
      { op: 'poser', chemin: ['participants', { id: 1 }, 'id'], valeur: 9 },
      { op: 'poser', chemin: ['participants', { id: 4 }], valeur: inseree },
      { op: 'poser', chemin: ['prochainsIds', 'participant'], valeur: 10 },
    ];
    const noter = [{ op: 'poser', chemin: ['participants', { id: 9 }, 'notes'], valeur: 'au fond' }];
    lignes[3] = JSON.stringify({ ...JSON.parse(lignes[3]), correctif: rompre });
    lignes[4] = JSON.stringify({ ...JSON.parse(lignes[4]), correctif: noter });
    const journal = lireJournal(texteDe(lignes));
    assert.deepEqual([journal.entrees.length, journal.ecartees], [4, 0]);
    const chaine = [canoniser(journal.entrees[0].instantane)];
    for (const { correctif } of journal.entrees.slice(1)) chaine.push(appliquer(chaine.at(-1), correctif));
    for (let revision = 1; revision <= 4; revision += 1) {
      const rendue = reconstruire(journal, revision);
      assert.equal(JSON.stringify(rendue), JSON.stringify(chaine[revision - 1]), `révision ${revision}`);
      const canonique = reconstruireCanonique(journal, revision);
      assert.equal(JSON.stringify(canonique), JSON.stringify(canoniser(chaine[revision - 1])), `révision ${revision}`);
    }
    const troisieme = reconstruire(journal, 3);
    assert.notEqual(JSON.stringify(troisieme), JSON.stringify(canoniser(troisieme)));
    assert.deepEqual(troisieme.participants.map(({ id }) => id), [4, 9]);
    assert.equal(Object.keys(troisieme.participants[0])[0], 'exclu');
    const quatrieme = reconstruire(journal, 4);
    assert.equal(JSON.stringify(quatrieme), JSON.stringify(canoniser(quatrieme)));
    assert.deepEqual(quatrieme.participants.map(({ id }) => id), [4, 9]);
    assert.equal(Object.keys(quatrieme.participants[0])[0], 'id');
  });

  test('un journal figé en profondeur se restitue sans lever ; la charge rendue, canonique ou non, ne partage rien avec lui, et la modifier ne change pas la restitution suivante', () => {
    const libre = lireJournal(texteSeance());
    const fige = figer(lireJournal(texteSeance()));
    assert.ok(estFigee(fige.entrees[0].instantane) && Object.isFrozen(fige.entrees[1].correctif));
    for (const journal of [libre, fige]) {
      const duJournal = objetsDe(journal);
      for (const revision of [1, 2, 50, 51, 77, 101, 120]) {
        for (const restituer of [reconstruire, reconstruireCanonique]) {
          const rendue = restituer(journal, revision);
          assert.ok(
            [...objetsDe(rendue)].every((objet) => !duJournal.has(objet)),
            `${restituer.name}, révision ${revision}`,
          );
          rendue.participants.length = 0;
          rendue.evenement.nom = 'autre';
          for (const proposition of rendue.propositions) proposition.graine += 1;
          const relue = restituer(journal, revision);
          assert.equal(texteCanonique(relue), texteCanonique(SEANCE[revision - 1].apres), `révision ${revision}`);
        }
      }
    }
  });

  test('entreeCanonique, sur les 120 gestes de la séance, propositions libres ou figées et partagées, avant canonique ou non : la ligne de la composition directe, et la copie canonique de apres, qui ne partage que des objets figés', () => {
    for (const [nom, etapes] of [
      ['libres', SEANCE],
      ['figées', seanceFigee()],
    ]) {
      let precedente;
      let reprises = 0;
      etapes.forEach((etape, rang) => {
        const champs = champsDe(etapes, rang);
        const avant = etapes[rang - 1]?.apres;
        const intactes = [JSON.stringify(etape.apres), JSON.stringify(avant)];
        const attendue = ligneDirecte(champs, avant);
        const quoi = `${nom}, révision ${champs.revision}`;
        const direct = entreeCanonique(champs, avant);
        const parCanonique = entreeCanonique(champs, precedente, { avantCanonique: true });
        assert.equal(direct.ligne, attendue, quoi);
        assert.equal(parCanonique.ligne, attendue, quoi);
        assert.equal(ligneEntree({ ...champs, avant }), attendue, quoi);
        for (const { canonique } of [direct, parCanonique]) {
          assert.equal(JSON.stringify(canonique), JSON.stringify(canoniser(etape.apres)), quoi);
          for (const autre of [etape.apres, avant, precedente]) {
            assert.ok(partages(canonique, autre).every(estFigee), quoi);
          }
        }
        assert.deepEqual([JSON.stringify(etape.apres), JSON.stringify(avant)], intactes, quoi);
        if (precedente?.propositions.some((proposition) => parCanonique.canonique.propositions.includes(proposition))) {
          reprises += 1;
        }
        precedente = parCanonique.canonique;
      });
      // Figées, les propositions qu'une charge garde de la précédente
      // prêtent la même copie canonique d'une entrée à la suivante.
      if (nom === 'libres') assert.equal(reprises, 0);
      else assert.ok(reprises >= 40, `reprises : ${reprises}`);
    }
  });

  test('entreeCanonique refuse ce que refuse ligneEntree, par la même TypeError ; une charge mal formée ou un instantane qui n’est pas un booléen lèvent avant toute lecture de avant', () => {
    const avant = chargeVide();
    const apres = avecIris();
    const valide = { revision: 2, libelle: 'Ajouté Iris Ombrelle', horodatage: horodatage(2), apres, instantane: false };
    const nomVide = avecIris();
    nomVide.participants[0].nom = '';
    const sansReglages = avecIris();
    delete sansReglages.reglages;
    const cleInconnue = avecIris();
    cleInconnue.participants[0].auteur = 'Théo';
    const avecProposition = avecIris();
    avecProposition.prochainsIds.proposition = 2;
    avecProposition.propositions.push(copie(SEANCE.find((e) => e.apres.propositions.length > 0).apres.propositions[0]));
    avecProposition.propositions[0].id = 1;
    const graineNegative = copie(avecProposition);
    graineNegative.propositions[0].graine = -1;
    const figeeFautive = copie(avecProposition);
    figeeFautive.propositions[0] = figer(copie(graineNegative.propositions[0]));
    const fautesDeApres = [
      ['charge hors de sa règle, en correctif', { apres: nomVide }],
      ['charge hors de sa règle, en instantané', { apres: nomVide, instantane: true }],
      ['charge sans réglages', { apres: sansReglages }],
      ['charge absente', { apres: undefined }],
      ['clé inconnue dans la charge', { apres: cleInconnue }],
      ['proposition hors de sa règle', { apres: graineNegative, instantane: true }],
      ['proposition figée hors de sa règle', { apres: figeeFautive }],
      ['instantane absent', { instantane: undefined, apres: intouchable() }],
      ['instantane qui n’est pas un booléen', { instantane: 1, apres: intouchable() }],
    ];
    const autres = [
      ['révision 0', { revision: 0 }],
      ['libellé vide', { libelle: '' }],
      ['horodatage sans fuseau', { horodatage: '2026-10-06T19:03:40' }],
      ['retour sans sens', { retour: 1 }],
      ['version vide', { produitVersion: '' }],
      ['charge précédente absente, en correctif', { avant: undefined }],
    ];
    const memeTypeError = (attendue, recue, quoi) => {
      assert.ok(attendue instanceof TypeError, quoi);
      assert.ok(recue instanceof TypeError, `${quoi} : ${recue}`);
      assert.equal(recue.message.replace(/^entreeCanonique :/, 'ligneEntree :'), attendue.message, quoi);
    };
    for (const [quoi, { avant: autreAvant, ...changement }] of autres) {
      const precedente = quoi.startsWith('charge précédente absente') ? autreAvant : avant;
      const champs = { ...valide, ...changement };
      const attendue = erreurDe(() => ligneEntree({ ...champs, avant: precedente }));
      memeTypeError(attendue, erreurDe(() => entreeCanonique(champs, precedente)), quoi);
    }
    for (const [quoi, changement] of fautesDeApres) {
      const champs = { ...valide, ...changement };
      const attendue = erreurDe(() => ligneEntree({ ...champs, avant }));
      memeTypeError(attendue, erreurDe(() => ligneEntree({ ...champs, avant: intouchable() })), quoi);
      memeTypeError(attendue, erreurDe(() => entreeCanonique(champs, intouchable())), quoi);
      memeTypeError(attendue, erreurDe(() => entreeCanonique(champs, intouchable(), { avantCanonique: true })), quoi);
    }
    // Une proposition figée hors de sa règle lève à chaque appel, et le
    // chemin nomme son rang du moment.
    const deux = copie(avecProposition);
    deux.prochainsIds.proposition = 3;
    deux.propositions = [figer(copie(avecProposition.propositions[0])), figeeFautive.propositions[0]];
    for (let fois = 0; fois < 2; fois += 1) {
      assert.throws(() => entreeCanonique({ ...valide, apres: deux }, avant), /charge\.propositions\[1\]\.graine/);
    }
    deux.propositions.reverse();
    assert.throws(() => entreeCanonique({ ...valide, apres: deux }, avant), /charge\.propositions\[0\]\.graine/);
  });

  test('une proposition figée conforme ne se contrôle et ne se copie qu’une fois ; une proposition libre, ou gelée en surface seulement, se relit à chaque entrée', () => {
    const avecPropositions = SEANCE.find((e) => e.apres.propositions.length > 0).apres;
    const proposition = avecPropositions.propositions[0];
    const chargeAvec = (lue) => ({ ...copie(avecPropositions), propositions: [lue] });
    const gestes = (charge) => [
      () => entreeCanonique(champsDe([{ apres: charge }], 0), undefined),
      () => entreeCanonique({ ...champsDe([{ apres: charge }, { apres: charge }], 1) }, charge),
      () => ligneEntree({ ...champsDe([{ apres: charge }], 0) }),
      () => ligneEntree({ ...champsDe([{ apres: charge }, { apres: charge }], 1), avant: charge }),
    ];

    const figee = sousCompteur(copie(proposition));
    figer(figee.lue);
    const chargeFigee = chargeAvec(figee.lue);
    for (const geste of gestes(chargeFigee)) geste();
    assert.ok(figee.lus.n > 0);
    figee.lus.n = 0;
    for (let fois = 0; fois < 3; fois += 1) for (const geste of gestes(chargeFigee)) geste();
    assert.equal(figee.lus.n, 0, 'proposition figée relue');

    for (const [quoi, geler] of [
      ['libre', (lue) => lue],
      ['gelée en surface', (lue) => Object.freeze(lue)],
    ]) {
      const compte = sousCompteur(copie(proposition));
      geler(compte.lue);
      const charge = chargeAvec(compte.lue);
      for (const geste of gestes(charge)) {
        compte.lus.n = 0;
        geste();
        const premiere = compte.lus.n;
        compte.lus.n = 0;
        geste();
        assert.ok(premiere > 0 && compte.lus.n === premiere, `${quoi} : ${premiere} puis ${compte.lus.n}`);
      }
      // Modifiée en place, plus bas que sa surface, elle est refusée.
      compte.lue.placement[0].sieges.push(['x']);
      for (const geste of gestes(charge)) assert.throws(geste, /charge\.propositions\[0\]\.placement/, quoi);
    }
  });

  test('apres ne se copie qu’une fois, et le correctif se calcule sur cette copie ; avant canonique se lit tel quel, sans copie, quand avantCanonique le dit', () => {
    const avecPropositions = SEANCE.find((e) => e.apres.propositions.length > 0).apres;
    const chargeAvec = (lue) => ({ ...copie(avecPropositions), propositions: [lue] });
    const enInstantane = (apres) => champsDe([{ apres }], 0);
    const enCorrectif = (apres) => champsDe([{ apres: chargeVide() }, { apres }], 1);
    const lecturesDe = (lus, appel) => {
      lus.n = 0;
      appel();
      return lus.n;
    };

    // Une proposition libre de apres : le contrôle de forme, puis une seule
    // copie, que le correctif compare sans relire apres.
    const deApres = sousCompteur(copie(avecPropositions.propositions[0]));
    const apres = chargeAvec(deApres.lue);
    const controle = lecturesDe(deApres.lus, () => entreeCanonique(enInstantane(apres), undefined));
    const uneCopie = lecturesDe(deApres.lus, () => canoniserPartagee(apres));
    // Le contrôle de forme seul : une seconde proposition fautive le fait
    // lever après qu'il a lu la première en entier, avant toute copie.
    const fautive = { ...copie(avecPropositions.propositions[0]), graine: -1 };
    const forme = lecturesDe(deApres.lus, () =>
      assert.throws(() => entreeCanonique(enInstantane({ ...apres, propositions: [deApres.lue, fautive] }), undefined)),
    );
    assert.ok(uneCopie > 0 && forme > 0, `${forme}, ${uneCopie}`);
    assert.equal(controle, forme + uneCopie, `${controle} = ${forme} pour la forme + ${uneCopie} pour la copie`);
    for (const [quoi, avant, options] of [
      ['avant brut', copie(avecPropositions), {}],
      ['avant canonique', canoniser(avecPropositions), { avantCanonique: true }],
    ]) {
      const lues = lecturesDe(deApres.lus, () => entreeCanonique(enCorrectif(apres), avant, options));
      assert.equal(lues, controle, quoi);
      const parLigne = lecturesDe(deApres.lus, () => ligneEntree({ ...enCorrectif(apres), avant }));
      assert.equal(parLigne, controle, `ligneEntree, ${quoi}`);
    }

    // Une proposition libre d'un avant canonique : avec avantCanonique, seul
    // le correctif la lit ; sans, elle se recopie d'abord, et le correctif lit
    // la copie.
    const avant = canoniser(avecPropositions);
    const deAvant = sousCompteur(avant.propositions[0]);
    avant.propositions[0] = deAvant.lue;
    const suivante = copie(avecPropositions);
    suivante.propositions[0].graine += 1;
    const parCorrectif = lecturesDe(deAvant.lus, () => differenceCanonique(avant, canoniser(suivante)));
    const parCopie = lecturesDe(deAvant.lus, () => canoniserPartagee(avant));
    const telQuel = lecturesDe(deAvant.lus, () =>
      entreeCanonique(enCorrectif(suivante), avant, { avantCanonique: true }),
    );
    const recopie = lecturesDe(deAvant.lus, () => entreeCanonique(enCorrectif(suivante), avant));
    assert.ok(parCorrectif > 0 && parCopie > 0, `${parCorrectif}, ${parCopie}`);
    assert.equal(telQuel, parCorrectif, 'avant canonique lu tel quel');
    assert.equal(recopie, parCopie, 'avant brut recopié, puis la copie comparée');
    assert.ok(telQuel < recopie, `${telQuel} puis ${recopie}`);
    assert.equal(
      entreeCanonique(enCorrectif(suivante), avant, { avantCanonique: true }).ligne,
      ligneDirecte(enCorrectif(suivante), avant),
    );
  });
});

// --- Caractérisation -------------------------------------------------------

// Empreinte dorée de la restitution (§ 8.3, § 14.2, § 15.5) : le JSON de
// reconstruire(journal, r) pour chaque révision r de la séance de 120 gestes,
// ordre des clés compris, une révision par ligne. Les deux versions se
// remplacent par des marqueurs avant l'empreinte : une livraison, qui change
// la version, ne la change pas.
const EMPREINTE_RESTITUTION = '6a5e8db022aada85d2916ee8a1150ea5bc6ccf7d7cf83f03587b00d5873ae25a';

describe('caractérisation : la restitution de chaque instant, octet pour octet (§ 8.3, § 14.2)', () => {
  test("reconstruire(journal, r) s'écrit en JSON comme la chaîne d'appliquer refaite d'entrée en entrée, pour chacune des 120 révisions, et leur empreinte est celle de la référence", () => {
    const journal = lireJournal(texteSeance());
    assert.equal(journal.entrees.length, 120);
    // La chaîne : la copie canonique de chaque instantané, puis appliquer de
    // chaque correctif à la charge de l'entrée qui précède.
    let chaine = null;
    let instantanes = 0;
    const textes = journal.entrees.map(({ revision, instantane, correctif }) => {
      if (instantane === null) {
        chaine = appliquer(chaine, correctif);
      } else {
        chaine = canoniser(instantane);
        instantanes += 1;
      }
      const texte = JSON.stringify(reconstruire(journal, revision));
      assert.equal(texte, JSON.stringify(chaine), `révision ${revision}`);
      return texte;
    });
    assert.equal(instantanes, 3);
    const texte = [V1, V2].reduce(
      (courant, version, rang) => courant.replaceAll(version, `‹version ${rang + 1}›`),
      textes.join('\n'),
    );
    assert.equal(createHash('sha256').update(texte).digest('hex'), EMPREINTE_RESTITUTION);
  });
});
