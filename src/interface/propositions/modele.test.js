// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle du tableau des propositions (§ 5.4, § 5.5, § 5.7, § 9,
// § 12.1, § 12.6, § 12.9) : chaque cellule porte la valeur de la table
// d'évaluation et sa clé de mise en forme ; la phrase de l'ordre ; le
// minimum seul des rencontres ; les imposés à part ; le retenu ajusté. Les
// charges partent des démonstrations livrées ou s'écrivent ici ; leurs
// propositions s'enregistrent par la commande. La valeur attendue vient des
// fonctions du moteur, sollicitées une seconde fois (§ 19.1). Les noms
// d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import {
  detaillerQualite,
  evaluer,
  nettoyage,
  retenuAjuste as retenuAjusteDeLEvaluation,
  retenuRetouche as retenuRetoucheDeLEvaluation,
} from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { nomAffiche } from '../../application/personnes.js';
import { creerTraduction } from '../../application/traduction.js';
import { PLAN_PARFAIT_PETITE } from '../../demo/catalogue.js';
import { texteLivre } from '../../demo/livrees.js';
import { CRITERES, classer } from '../../moteur/classement.js';
import { indexerPlan, normaliser } from '../../moteur/configuration.js';
import { CRITERES as REGISTRE, MODES_OBJECTIFS, valeursQuiClassent } from '../../moteur/criteres.js';
import { mesurer } from '../../moteur/indicateurs.js';
import { ecartsAuPlafondAPriori, minimumAtteint, troisChiffres } from '../../moteur/manque.js';
import { plafondsAPriori, plafondsRealises } from '../../moteur/plafond.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { planDepuisFichier } from '../../stockage/placements.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import * as MODELE from './modele.js';
import {
  COLONNES,
  GARDEES_PAR_DEFAUT,
  GROUPES_COLONNES,
  TAILLE_PAGE,
  annonceNettoyage,
  changerDePage,
  colonneDeValeur,
  demandeConfirmation,
  demandeNettoyage,
  evaluation,
  explicationDeColonne,
  lireColonne,
  nomDe,
  nombreDePages,
  lireGardees,
  notePresences,
  pageApresNettoyage,
  pageDe,
  pagine,
  retenuAjuste,
  retenuRetouche,
  suivrePage,
  surlignee,
  tableau,
  texteCellule,
  texteEtendue,
} from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// La charge, une génération du moteur de plus, enregistrée par la commande.
function generee(charge, reglages) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// Une proposition écrite à la main, sièges non attribués, sur les tables de
// la charge dans leur ordre ; ses listes et réserves telles que données.
function propositionDe(charge, id, tours, reserves = tours.map(() => [])) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id: p }) => p);
  return {
    id,
    graine: id,
    arret: 40,
    historique: 1000,
    produitVersion: V1,
    siegesAttribues: false,
    tables: charge.tables.map(({ id: table }) => table),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: tours.length,
    participants,
    placement: tours.map((listes, rang) => ({ sieges: listes.map((liste) => [...liste].sort((a, b) => a - b)), reserve: reserves[rang] })),
  };
}

// La charge, ses propositions remplacées par celles des plans donnés,
// numérotées à partir de 1.
function avecPlans(charge, plans) {
  const suivante = structuredClone(charge);
  suivante.propositions = plans.map(({ tours, reserves }, rang) => propositionDe(suivante, rang + 1, tours, reserves));
  suivante.prochainsIds.proposition = plans.length + 1;
  suivante.evenement.etat = 'propose';
  return suivante;
}

// Six personnes inventées, deux tables de places, quatre tours ; les deux
// premières partagent une appartenance quand collegues est vrai, les autres
// n'en ont aucune.
function chargeSix({ places = 3, collegues = true } = {}) {
  const charge = creerCharge({ id: 'evt-propositions', nom: 'Club des Merles', siegesParDefaut: places, tours: 4 });
  const noms = [['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Grisaille', null], ['Bruyère', 'Anouk'], ['Sarcelle', 'Capucine']];
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: collegues && rang < 2 ? 'Club des Merles' : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  return charge;
}

// Les personnes 1 et 2 ensemble aux quatre tours, les quatre autres tournent.
const DEUX_COLLEGUES = [
  [[1, 2, 3], [4, 5, 6]],
  [[1, 2, 4], [3, 5, 6]],
  [[1, 2, 5], [3, 4, 6]],
  [[1, 2, 6], [3, 4, 5]],
];

// Les colonnes du tableau sans objectif ni case des animateurs, dans l'ordre
// d'affichage : celles que le tableau portait avant le sixième groupe.
const COLONNES_PAR_DEFAUT = [
  'rang',
  'proposition',
  'rencontresTous',
  'rencontresMobiles',
  'rencontresAncres',
  'collisionsCumulees',
  'pairesDistinctes',
  'excedentCollisions',
  'rencontresRepetees',
  'maxRencontresPaire',
  'retoursChoisis',
  'appartenancesVues',
  'totalRedondance',
  'diversite',
  'manqueMax',
  'effectifManque',
  'ecartItineraireMax',
  'ecartAuPlafondAPriori',
  'certificat',
  'imposes',
  'commandes',
];

// Les colonnes du sixième groupe, les objectifs des tables et les
// animateurs, dans l'ordre d'affichage ; les deux premières ne paraissent
// jamais ensemble, chacune sous son mode.
const SIXIEME = ['jamaisServies', 'horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif', 'animateursRencontres', 'animateursNonRencontres'];

// La petite démonstration au conflit inévitable, les personnes 1 à 6
// « finance », la première table attendant « finance » pour la soirée ; les
// réglages donnés s'ajoutent à ceux de la charge.
function petiteAObjectifs(reglages = {}) {
  const charge = structuredClone(chargeDemo('petite-conflit'));
  for (const participant of charge.participants) if (participant.id <= 6) participant.etiquettes = ['finance'];
  const [premiere] = [...charge.tables].sort((a, b) => a.id - b.id);
  premiere.objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  Object.assign(charge.reglages, reglages);
  return charge;
}

// Trois plans de la petite démonstration au conflit inévitable, nommés par
// leurs collisions (cumulées, distinctes), au même plus grand écart au
// plafond a priori : ceux de l'épreuve de la table d'évaluation.
const PLANS_CONFLIT = [
  {
    nom: '(4, 1)',
    tours: [
      [[2, 3, 10], [6, 8, 9], [4, 7, 12], [1, 5, 11]],
      [[2, 7, 10], [4, 6, 8], [3, 11, 12], [1, 5, 9]],
      [[7, 9, 12], [3, 8, 11], [4, 6, 10], [1, 2, 5]],
      [[2, 7, 10], [3, 8, 9], [6, 11, 12], [1, 4, 5]],
    ],
  },
  {
    nom: '(4, 2)',
    tours: [
      [[2, 6, 10], [3, 8, 9], [7, 11, 12], [1, 4, 5]],
      [[4, 7, 10], [2, 6, 8], [1, 5, 11], [3, 9, 12]],
      [[2, 6, 12], [4, 8, 10], [1, 3, 11], [5, 7, 9]],
      [[2, 3, 12], [4, 8, 10], [1, 6, 9], [5, 7, 11]],
    ],
  },
  {
    nom: '(6, 6)',
    tours: [
      [[3, 4, 12], [7, 8, 9], [2, 6, 10], [1, 5, 11]],
      [[4, 6, 12], [2, 8, 10], [1, 7, 11], [3, 5, 9]],
      [[2, 4, 10], [6, 8, 11], [1, 3, 12], [5, 7, 9]],
      [[2, 7, 10], [5, 6, 8], [9, 11, 12], [1, 3, 4]],
    ],
  },
];

// La valeur attendue de chaque colonne de mesure, lue dans une ligne
// comparable de la table d'évaluation : le tableau n'en calcule aucune.
const ATTENDUE = new Map([
  ['rencontresTous', (l) => l.mesures.aggRencontres.tous.min],
  ['rencontresMobiles', (l) => l.mesures.aggRencontres.mobiles.min],
  ['rencontresAncres', (l) => l.mesures.aggRencontres.ancres.min],
  ['collisionsCumulees', (l) => l.mesures.collisionsCumulees],
  ['pairesDistinctes', (l) => l.mesures.pairesDistinctes],
  ['excedentCollisions', (l) => l.mesures.excedentCollisions],
  ['rencontresRepetees', (l) => l.mesures.rencontresRepetees.choisies],
  ['maxRencontresPaire', (l) => l.mesures.maxRencontresPaire],
  ['retoursChoisis', (l) => l.mesures.totalRetoursChoisis],
  ['appartenancesVues', (l) => l.mesures.aggAppartenancesVues.tous.min],
  ['totalRedondance', (l) => l.mesures.totalRedondance],
  ['diversite', (l) => l.mesures.aggDiversite.tous.min],
  ['manqueMax', (l) => l.troisChiffres.manqueMax.tous],
  ['effectifManque', (l) => l.troisChiffres.effectifManque.tous],
  ['ecartItineraireMax', (l) => l.troisChiffres.ecartItineraireMax.tous],
  ['ecartAuPlafondAPriori', (l) => l.ecartAuPlafondAPrioriMax],
  ['certificat', (l) => l.minimumAtteint],
]);

// Les douze chiffres du § 5.4, chacun et la colonne qui le porte.
const DOUZE = [
  ['personnes distinctes rencontrées', 'rencontresTous'],
  ['collisions cumulées', 'collisionsCumulees'],
  ['paires de même appartenance', 'pairesDistinctes'],
  ['excédent de collisions', 'excedentCollisions'],
  ['rencontres répétées', 'rencontresRepetees'],
  ['maximum par paire', 'maxRencontresPaire'],
  ['retours', 'retoursChoisis'],
  ['A(p)', 'appartenancesVues'],
  ['r(p)', 'totalRedondance'],
  ['d(p)', 'diversite'],
  ['manque', 'manqueMax'],
  ["écart d'itinéraire", 'ecartItineraireMax'],
];

const cellule = (ligne, nom) => {
  const trouvee = ligne.cellules.find(({ colonne }) => colonne === nom);
  assert.ok(trouvee !== undefined, `colonne ${nom} absente`);
  return trouvee;
};
const texte = (c) => texteCellule(c, { t, format });
const enTete = (nom) => t(COLONNES.find((colonne) => colonne.nom === nom).cle);

// Les mesures du moteur pour chaque proposition de la charge, et leur
// classement : la valeur attendue, calculée sans la table d'évaluation.
function parLeMoteur(charge) {
  const instance = normaliser(configurationDepuisCharge(charge));
  const aPriori = plafondsAPriori(instance);
  const parId = new Map();
  for (const proposition of charge.propositions) {
    const tableDe = indexerPlan(instance, planDepuisFichier(proposition));
    const mesures = mesurer(instance, tableDe);
    const realises = plafondsRealises(instance, tableDe);
    parId.set(proposition.id, {
      mesures,
      troisChiffres: troisChiffres(instance, mesures, aPriori, realises),
      ecarts: ecartsAuPlafondAPriori(mesures, aPriori),
      minimumAtteint: minimumAtteint(mesures, aPriori),
    });
  }
  const classement = classer(charge.propositions.map(({ id }) => ({ id, mesures: parId.get(id).mesures, plafondsAPriori: aPriori })));
  return { parId, classement };
}

describe('tableau : chaque cellule porte la valeur de la table d’évaluation (§ 5.4, § 12.9)', () => {
  test('chaque cellule égale la valeur de sa ligne ; un nombre se met en forme, null porte la clé de « — »', () => {
    const table = evaluer(generee(chargeDemo('petite-conflit'), { graine: 5, nombre: 3, arret: 400 }));
    const vue = tableau(table);
    assert.deepEqual(vue.colonnes.map(({ nom }) => nom), COLONNES_PAR_DEFAUT);
    for (const colonne of vue.colonnes) assert.ok(COLONNES.includes(colonne), colonne.nom);
    assert.equal(vue.lignes.length, 3);
    assert.deepEqual(vue.lignes.map(({ id }) => id), table.propositions.map(({ id }) => id));
    let vues = 0;
    vue.lignes.forEach((ligne, rang) => {
      const source = table.propositions[rang];
      assert.equal(ligne.cellules.length, ATTENDUE.size);
      for (const [nom, attendue] of ATTENDUE) {
        const c = cellule(ligne, nom);
        assert.deepEqual(c.valeur, attendue(source), nom);
        if (nom === 'certificat') continue;
        assert.equal(c.cle, c.valeur === null ? 'format.vide' : null, nom);
        assert.equal(c.decimales, nom === 'diversite' ? 2 : 0, nom);
        vues += 1;
      }
    });
    assert.equal(vues, 3 * (ATTENDUE.size - 1));
  });

  test('une population vide porte la clé de « — », jamais 0 ; un a priori inconnu, « inconnu »', () => {
    const charge = generee(chargeDemo('petite'), { graine: 2, nombre: 2, arret: 300 });
    const [ligne] = tableau(evaluer(charge)).lignes;
    const ancres = cellule(ligne, 'rencontresAncres');
    assert.deepEqual([ancres.valeur, ancres.cle], [null, 'format.vide']);
    assert.equal(texte(ancres), '\u{2014}');
    const [inconnue] = tableau(evaluer(charge, { plafondsAPriori: null })).lignes;
    for (const nom of ['ecartItineraireMax', 'ecartAuPlafondAPriori']) {
      assert.equal(cellule(inconnue, nom).cle, 'propositions.valeur.inconnu', nom);
      assert.equal(texte(cellule(inconnue, nom)), 'inconnu', nom);
    }
    assert.equal(texte(cellule(inconnue, 'certificat')), 'atteignabilité inconnue');
  });

  test('les générations s’accumulent : 3, puis 2 sous une autre graine, cinq lignes dans l’ordre de classer sur les cinq (§ 5.7)', () => {
    let charge = generee(chargeDemo('petite-conflit'), { graine: 1, nombre: 3, arret: 300 });
    charge = generee(charge, { graine: 2, nombre: 2, arret: 300 });
    const vue = tableau(evaluer(charge));
    assert.equal(vue.lignes.length, 5);
    assert.deepEqual(vue.lignes.map(({ id }) => id), parLeMoteur(charge).classement.ordre);
    assert.deepEqual(vue.lignes.map(({ rang }) => rang), [1, 2, 3, 4, 5]);
    assert.deepEqual(vue.horsClassement, []);
  });
});

describe('tableau : les douze chiffres, les chiffres du moteur (§ 5.4, § 12.9, § 19.1)', () => {
  test('trois propositions : chaque ligne porte les douze, nombre ou « — », égaux à ce que rend le moteur', () => {
    const charge = generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 3, arret: 500 });
    const vue = tableau(evaluer(charge));
    const { parId } = parLeMoteur(charge);
    assert.equal(vue.lignes.length, 3);
    let lus = 0;
    for (const ligne of vue.lignes) {
      const moteur = parId.get(ligne.id);
      const valeurs = new Map([
        ['rencontresTous', moteur.mesures.aggRencontres.tous.min],
        ['collisionsCumulees', moteur.mesures.collisionsCumulees],
        ['pairesDistinctes', moteur.mesures.pairesDistinctes],
        ['excedentCollisions', moteur.mesures.excedentCollisions],
        ['rencontresRepetees', moteur.mesures.rencontresRepetees.choisies],
        ['maxRencontresPaire', moteur.mesures.maxRencontresPaire],
        ['retoursChoisis', moteur.mesures.totalRetoursChoisis],
        ['appartenancesVues', moteur.mesures.aggAppartenancesVues.tous.min],
        ['totalRedondance', moteur.mesures.totalRedondance],
        ['diversite', moteur.mesures.aggDiversite.tous.min],
        ['manqueMax', moteur.troisChiffres.manqueMax.tous],
        ['ecartItineraireMax', moteur.troisChiffres.ecartItineraireMax.tous],
      ]);
      for (const [chiffre, nom] of DOUZE) {
        const ecrit = texte(cellule(ligne, nom));
        assert.notEqual(ecrit, '', chiffre);
        const attendue = valeurs.get(nom);
        assert.equal(ecrit, attendue === null ? '\u{2014}' : format.nombre(attendue, { decimales: nom === 'diversite' ? 2 : 0 }), chiffre);
        lus += 1;
      }
      assert.equal(cellule(ligne, 'ecartAuPlafondAPriori').valeur, Math.max(...moteur.ecarts));
      assert.equal(cellule(ligne, 'certificat').valeur, moteur.minimumAtteint);
    }
    assert.equal(lus, 36);
  });
});

describe('tableau : les populations (§ 5.4)', () => {
  test('petite sans réservation : « ancrés » porte « — » à chaque ligne ; aucun 0, NaN ni infini pour une population vide', () => {
    const vue = tableau(evaluer(generee(chargeDemo('petite'), { graine: 4, nombre: 3, arret: 300 })));
    assert.equal(vue.lignes.length, 3);
    for (const ligne of vue.lignes) {
      assert.equal(texte(cellule(ligne, 'rencontresAncres')), '\u{2014}');
      assert.equal(cellule(ligne, 'rencontresAncres').valeur, null);
      assert.ok(cellule(ligne, 'rencontresMobiles').valeur > 0);
      for (const c of ligne.cellules) {
        if (typeof c.valeur === 'number') assert.ok(Number.isFinite(c.valeur), c.colonne);
        if (c.valeur === null) assert.notEqual(c.cle, null, c.colonne);
      }
    }
  });

  test('grande : minimum global 24, ancrés 24, mobiles au-dessus', () => {
    const vue = tableau(evaluer(generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 50_000 })));
    const [ligne] = vue.lignes;
    assert.equal(cellule(ligne, 'rencontresTous').valeur, 24);
    assert.equal(cellule(ligne, 'rencontresAncres').valeur, 24);
    assert.ok(cellule(ligne, 'rencontresMobiles').valeur > 24);
  });
});

describe('tableau : le minimum seul des rencontres (§ 5.4, § 12.1)', () => {
  test('les trois minimums ouvrent les colonnes de mesure ; aucune colonne, aucun en-tête, aucune cellule ne porte la moyenne', () => {
    assert.deepEqual(COLONNES.slice(2, 5).map(({ nom }) => nom), ['rencontresTous', 'rencontresMobiles', 'rencontresAncres']);
    for (const nom of ['rencontresTous', 'rencontresMobiles', 'rencontresAncres']) assert.match(enTete(nom), /minimum/);
    assert.ok(COLONNES.length > 0);
    for (const { nom, cle } of COLONNES) {
      assert.doesNotMatch(nom, /moyenne/i, nom);
      assert.doesNotMatch(t(cle), /moyenne/i, cle);
    }
    const table = evaluer(generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 50_000 }));
    const [source] = table.propositions;
    // Les moyennes qu'aucun compte entier ne peut égaler par hasard.
    const moyennes = ['tous', 'mobiles', 'ancres']
      .map((population) => source.mesures.aggRencontres[population].moyenne)
      .filter((moyenne) => !Number.isInteger(moyenne));
    assert.ok(moyennes.length >= 2, 'des moyennes discernables');
    const [ligne] = tableau(table).lignes;
    for (const c of ligne.cellules) assert.ok(!moyennes.includes(c.valeur), c.colonne);
  });
});

describe('tableau : r(p) se lit par sa somme (§ 5.4, § 12.1)', () => {
  test('aucune colonne ne porte le minimum de r(p), qui désigne la personne la mieux servie ; Σ r(p) reste', () => {
    const noms = COLONNES.map(({ nom }) => nom);
    assert.ok(noms.length > 0);
    assert.ok(noms.includes('totalRedondance'));
    assert.ok(!noms.includes('redondance'));
    for (const { cle } of COLONNES) assert.doesNotMatch(t(cle), /r\(p\), minimum/, cle);
    const table = evaluer(generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 2000 }));
    const [source] = table.propositions;
    const [ligne] = tableau(table).lignes;
    assert.equal(cellule(ligne, 'totalRedondance').valeur, source.mesures.totalRedondance);
    // Le minimum de r(p) n'occupe aucune cellule de redondance.
    assert.ok(ligne.cellules.length > 0);
    assert.ok(ligne.cellules.every(({ colonne }) => colonne !== 'redondance'));
  });
});

describe('tableau : les unités (§ 5.4)', () => {
  test('deux mêmes collègues ensemble aux quatre tours : 4 collisions cumulées, 1 paire distincte, excédent 3, chaque en-tête nomme son unité', () => {
    const charge = avecPlans(chargeSix(), [{ tours: DEUX_COLLEGUES }]);
    const [ligne] = tableau(evaluer(charge)).lignes;
    assert.equal(cellule(ligne, 'collisionsCumulees').valeur, 4);
    assert.equal(cellule(ligne, 'pairesDistinctes').valeur, 1);
    assert.equal(cellule(ligne, 'excedentCollisions').valeur, 3);
    assert.match(enTete('collisionsCumulees'), /collisions cumulées/i);
    assert.match(enTete('pairesDistinctes'), /paires distinctes/i);
    assert.match(enTete('excedentCollisions'), /excédent de collisions/i);
  });
});

describe('tableau : l’ordre écrit (§ 5.7, § 17 point 4)', () => {
  // La phrase de l'ordre telle qu'elle s'affiche : chaque morceau traduit,
  // bout à bout.
  const phraseDe = (morceaux) => morceaux.map(({ cle, details }) => t(cle, details)).join('');
  // Les morceaux qui désignent une colonne : leur critère et leur colonne.
  const designes = (morceaux) => morceaux.filter(({ colonne }) => colonne !== null).map(({ critere, colonne }) => [critere, colonne]);

  test('la phrase cite les cinq critères dans l’ordre, puis l’identifiant, mot pour mot ; les trois plans de PLANS_CONFLIT : (6, 6), (4, 2), (4, 1)', () => {
    const charge = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    const vue = tableau(evaluer(charge));
    assert.deepEqual(vue.lignes.map(({ id }) => id), [3, 2, 1]);
    assert.equal(vue.ordre.length, 1);
    const phrase = phraseDe(vue.ordre[0]);
    assert.equal(
      phrase,
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis excédent de collisions, " +
        "puis collisions cumulées, puis rencontres répétées, puis redondance d'appartenance, puis l'identifiant croissant.",
    );
    assert.equal(phrase, t('propositions.ordre.criteres', { criteres: [...CRITERES] }));
    const positions = CRITERES.map((nom) => phrase.indexOf(t(`moteur.critere.${nom}`)));
    assert.equal(positions.length, 5);
    assert.ok(positions.every((position, rang) => position >= 0 && (rang === 0 || position > positions[rang - 1])), phrase);
    assert.ok(phrase.indexOf('identifiant') > positions[4], phrase);
  });

  test('chaque nom de critère, et l’identifiant croissant, désigne sa colonne du tableau, dans l’ordre de la phrase', () => {
    const vue = tableau(evaluer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT)));
    assert.deepEqual(designes(vue.ordre[0]), [
      ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPriori'],
      ['excedentCollisions', 'excedentCollisions'],
      ['collisionsCumulees', 'collisionsCumulees'],
      ['rencontresRepetees', 'rencontresRepetees'],
      ['redondance', 'totalRedondance'],
      ['identifiant', 'proposition'],
    ]);
    for (const morceau of vue.ordre[0]) {
      if (morceau.colonne === null) {
        assert.equal(morceau.critere, null, morceau.cle);
        assert.equal(morceau.valeur, null, morceau.cle);
        continue;
      }
      // Sous le défaut, la valeur appliquée porte le nom du critère.
      const attendu = morceau.critere === 'identifiant' ? "l'identifiant croissant" : t(`moteur.critere.${morceau.critere}`);
      assert.equal(t(morceau.cle, morceau.details), attendu);
      if (morceau.critere !== 'identifiant') assert.equal(morceau.cle, `moteur.valeur.${morceau.valeur}`);
    }
  });

  test('colonneDeValeur : chaque valeur qui classe, sous tout mode et toute combinaison des cases, désigne une colonne de COLONNES ; une valeur inconnue lève', () => {
    const noms = new Set(COLONNES.map(({ nom }) => nom));
    const valeurs = new Set();
    for (const mode of MODES_OBJECTIFS) {
      for (let masque = 0; masque < 16; masque += 1) {
        const contraintes = {
          separerAppartenances: (masque & 1) !== 0,
          nouveauxVoisins: (masque & 2) !== 0,
          nouvelleTable: (masque & 4) !== 0,
          varierAppartenances: (masque & 8) !== 0,
        };
        for (const nom of REGISTRE) for (const valeur of valeursQuiClassent(nom, contraintes, mode)) valeurs.add(valeur);
      }
    }
    assert.equal(valeurs.size, 10);
    for (const valeur of valeurs) assert.ok(noms.has(colonneDeValeur(valeur)), valeur);
    assert.equal(colonneDeValeur('rencontresRepeteesChoisies'), 'rencontresRepetees');
    assert.equal(colonneDeValeur('retoursChoisis'), 'retoursChoisis');
    assert.equal(colonneDeValeur('redondance'), 'totalRedondance');
    assert.equal(colonneDeValeur('identifiant'), 'proposition');
    assert.throws(() => colonneDeValeur('moyenneRencontres'), TypeError);
    assert.throws(() => colonneDeValeur('rencontresRepetees'), TypeError);
  });

  test('a priori inconnu : la phrase nomme le critère sauté et « excédent de collisions » appliqué à sa place ; les critères appliqués désignent toujours leur colonne', () => {
    const charge = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    const vue = tableau(evaluer(charge, { plafondsAPriori: null }));
    assert.equal(vue.ordre.length, 2);
    assert.deepEqual(vue.ordre[0], [
      {
        cle: 'propositions.ordre.saute',
        details: { saute: 'ecartAuPlafondAPrioriMax', applique: [{ nom: 'excedentCollisions', poids: 1, valeurs: ['excedentCollisions'] }] },
        critere: null,
        valeur: null,
        colonne: null,
      },
    ]);
    assert.equal(
      phraseDe(vue.ordre[0]),
      'Critère sauté, faute de plafond a priori par personne : écart au plafond a priori. ' +
        'Appliqué à sa place : excédent de collisions.',
    );
    assert.equal(
      phraseDe(vue.ordre[1]),
      "Ordre du classement, chaque critère au plus faible d'abord : excédent de collisions, " +
        "puis collisions cumulées, puis rencontres répétées, puis redondance d'appartenance, puis l'identifiant croissant.",
    );
    assert.deepEqual(designes(vue.ordre[1]), [
      ['excedentCollisions', 'excedentCollisions'],
      ['collisionsCumulees', 'collisionsCumulees'],
      ['rencontresRepetees', 'rencontresRepetees'],
      ['redondance', 'totalRedondance'],
      ['identifiant', 'proposition'],
    ]);
    for (const ligne of vue.lignes) assert.equal(texte(cellule(ligne, 'ecartItineraireMax')), 'inconnu');
  });

  test('a priori inconnu, aucun palier après l’écart : la phrase nomme le critère sauté et ne nomme rien à sa place', () => {
    // Les quatre cases décochées, sans objectif : l'écart forme le seul
    // palier, et le classement n'applique plus que l'identifiant.
    const charge = structuredClone(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    for (const cle of ['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable', 'varierAppartenances']) charge.reglages[cle] = false;
    const table = evaluer(charge, { plafondsAPriori: null });
    assert.deepEqual(table.classement.criteresAppliques, []);
    const vue = tableau(table);
    assert.deepEqual(vue.ordre[0][0].details, { saute: 'ecartAuPlafondAPrioriMax', applique: null });
    assert.equal(phraseDe(vue.ordre[0]), 'Critère sauté, faute de plafond a priori par personne : écart au plafond a priori.');
    assert.equal(phraseDe(vue.ordre[1]), "Ordre du classement, chaque critère au plus faible d'abord : l'identifiant croissant.");
  });

  // La petite démonstration au conflit inévitable, 1 à 6 « finance », la
  // première table attendant « finance » pour la soirée, l'ordre des
  // priorités donné quand il l'est.
  function aObjectifs(priorites) {
    const charge = structuredClone(chargeDemo('petite-conflit'));
    for (const participant of charge.participants) if (participant.id <= 6) participant.etiquettes = ['finance'];
    const [premiere] = [...charge.tables].sort((a, b) => a.id - b.id);
    premiere.objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    if (priorites !== undefined) charge.reglages.priorites = priorites;
    return charge;
  }
  const e = (critere, poids = 1) => ({ critere, poids });

  test('une case décochée retire son critère de la phrase : « varier » décochée, la redondance ne s’y nomme plus (Q4)', () => {
    const charge = structuredClone(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    charge.reglages.varierAppartenances = false;
    const phrase = phraseDe(tableau(evaluer(charge)).ordre[0]);
    assert.equal(
      phrase,
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis excédent de collisions, " +
        "puis collisions cumulées, puis rencontres répétées, puis l'identifiant croissant.",
    );
  });

  test('les objectifs comptés se nomment à leur palier et désignent la colonne des tours hors objectif', () => {
    const vue = tableau(evaluer(generee(aObjectifs(), { graine: 3, nombre: 2, arret: 200 })));
    assert.equal(
      phraseDe(vue.ordre[0]),
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis excédent de collisions, " +
        "puis collisions cumulées, puis tours hors objectif, puis rencontres répétées, puis redondance d'appartenance, " +
        "puis l'identifiant croissant.",
    );
    const horsObjectif = vue.ordre[0].find(({ critere }) => critere === 'toursHorsObjectif');
    assert.deepEqual(horsObjectif, {
      cle: 'moteur.valeur.toursHorsObjectif',
      details: {},
      critere: 'toursHorsObjectif',
      valeur: 'toursHorsObjectif',
      colonne: 'toursHorsObjectif',
    });
  });

  test('sous un ordre réglé, la phrase dit les paliers ; a priori inconnu, le palier qui suit l’écart prend sa place, nommé en entier', () => {
    const priorites = [
      [e('toursHorsObjectif')],
      [e('collisionsCumulees')],
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions'), e('redondance', 2)],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const charge = generee(aObjectifs(priorites), { graine: 3, nombre: 2, arret: 200 });
    assert.equal(
      phraseDe(tableau(evaluer(charge)).ordre[0]),
      "Ordre du classement, chaque critère au plus faible d'abord : tours hors objectif, puis collisions cumulées, " +
        "puis écart au plafond a priori, puis ensemble, excédent de collisions (poids 1), redondance d'appartenance (poids 2), " +
        "puis rencontres répétées, puis l'identifiant croissant.",
    );
    const inconnu = tableau(evaluer(charge, { plafondsAPriori: null }));
    assert.deepEqual(inconnu.ordre[0][0].details, {
      saute: 'ecartAuPlafondAPrioriMax',
      applique: [
        { nom: 'excedentCollisions', poids: 1, valeurs: ['excedentCollisions'] },
        { nom: 'redondance', poids: 2, valeurs: ['redondance'] },
      ],
    });
    assert.equal(
      phraseDe(inconnu.ordre[0]),
      'Critère sauté, faute de plafond a priori par personne : écart au plafond a priori. ' +
        "Appliqué à sa place : ensemble, excédent de collisions (poids 1), redondance d'appartenance (poids 2).",
    );
    assert.ok(!phraseDe(inconnu.ordre[1]).includes('écart au plafond a priori'));
  });
});

describe('tableau : la phrase dit les paliers et les valeurs appliquées (§ 5.7, A11)', () => {
  const phraseDe = (morceaux) => morceaux.map(({ cle, details }) => t(cle, details)).join('');
  const designes = (morceaux) => morceaux.filter(({ colonne }) => colonne !== null).map(({ critere, valeur, colonne }) => [critere, valeur, colonne]);
  const e = (critere, poids = 1) => ({ critere, poids });
  const DEBUT = "Ordre du classement, chaque critère au plus faible d'abord : ";

  test('« nouvelle table » cochée seule : le palier des rencontres répétées se nomme « retours » et désigne la colonne des retours choisis', () => {
    const charge = structuredClone(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    for (const cle of ['separerAppartenances', 'nouveauxVoisins', 'varierAppartenances']) charge.reglages[cle] = false;
    const vue = tableau(evaluer(charge));
    assert.equal(phraseDe(vue.ordre[0]), `${DEBUT}écart au plafond a priori, puis retours, puis l'identifiant croissant.`);
    assert.deepEqual(designes(vue.ordre[0]), [
      ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPriori'],
      ['rencontresRepetees', 'retoursChoisis', 'retoursChoisis'],
      ['identifiant', 'identifiant', 'proposition'],
    ]);
  });

  test('a priori inconnu, le critère sauté : le palier appliqué à sa place se nomme par ses valeurs — « retours » sous « nouvelle table » seule, les deux valeurs sous « chacun au moins une fois »', () => {
    const PHRASE = 'Critère sauté, faute de plafond a priori par personne : écart au plafond a priori. Appliqué à sa place : ';
    const seule = structuredClone(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    for (const cle of ['separerAppartenances', 'nouveauxVoisins', 'varierAppartenances']) seule.reglages[cle] = false;
    const [saute] = tableau(evaluer(seule, { plafondsAPriori: null })).ordre[0];
    assert.equal(t(saute.cle, saute.details), `${PHRASE}retours.`);
    const priorites = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('toursHorsObjectif')],
      [e('excedentCollisions')],
      [e('collisionsCumulees')],
      [e('rencontresRepetees')],
      [e('redondance')],
      [e('animateursNonRencontres')],
    ];
    const chacun = generee(petiteAObjectifs({ modeObjectifs: 'chacun', priorites }), { graine: 3, nombre: 2, arret: 200 });
    const [sauteChacun] = tableau(evaluer(chacun, { plafondsAPriori: null })).ordre[0];
    assert.equal(t(sauteChacun.cle, sauteChacun.details), `${PHRASE}personnes jamais servies, puis tours hors objectif.`);
  });

  test('« chacun au moins une fois » : « personnes jamais servies, puis tours hors objectif », deux noms du même critère, chacun sa colonne', () => {
    const vue = tableau(evaluer(generee(petiteAObjectifs({ modeObjectifs: 'chacun' }), { graine: 3, nombre: 2, arret: 200 })));
    assert.equal(
      phraseDe(vue.ordre[0]),
      `${DEBUT}écart au plafond a priori, puis excédent de collisions, puis collisions cumulées, ` +
        "puis personnes jamais servies, puis tours hors objectif, puis rencontres répétées, puis redondance d'appartenance, " +
        "puis l'identifiant croissant.",
    );
    assert.deepEqual(
      designes(vue.ordre[0]).filter(([critere]) => critere === 'toursHorsObjectif'),
      [
        ['toursHorsObjectif', 'jamaisServies', 'jamaisServies'],
        ['toursHorsObjectif', 'toursHorsObjectif', 'toursHorsObjectif'],
      ],
    );
  });

  test('« l’équité d’abord » : « plus de tours hors objectif d’une personne, puis tours hors objectif », chacun sa colonne', () => {
    const vue = tableau(evaluer(generee(petiteAObjectifs({ modeObjectifs: 'minimum' }), { graine: 3, nombre: 2, arret: 200 })));
    assert.ok(
      phraseDe(vue.ordre[0]).includes("puis collisions cumulées, puis plus de tours hors objectif d'une personne, puis tours hors objectif, puis rencontres répétées"),
      phraseDe(vue.ordre[0]),
    );
    assert.deepEqual(
      designes(vue.ordre[0]).filter(([critere]) => critere === 'toursHorsObjectif'),
      [
        ['toursHorsObjectif', 'horsObjectifMax', 'horsObjectifMax'],
        ['toursHorsObjectif', 'toursHorsObjectif', 'toursHorsObjectif'],
      ],
    );
  });

  test('un palier partagé : « ensemble, », puis chaque nom suivi de son poids ; chaque nom désigne sa colonne, les poids restent du texte', () => {
    const charge = structuredClone(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    charge.reglages.priorites = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions', 3), e('redondance', 2)],
      [e('collisionsCumulees')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const [morceaux] = tableau(evaluer(charge)).ordre;
    assert.equal(
      phraseDe(morceaux),
      `${DEBUT}écart au plafond a priori, puis ensemble, excédent de collisions (poids 3), redondance d'appartenance (poids 2), ` +
        "puis collisions cumulées, puis rencontres répétées, puis l'identifiant croissant.",
    );
    const debut = morceaux.findIndex(({ cle }) => cle === 'propositions.ordre.ensemble');
    assert.deepEqual(morceaux.slice(debut, debut + 5), [
      { cle: 'propositions.ordre.ensemble', details: {}, critere: null, valeur: null, colonne: null },
      { cle: 'moteur.valeur.excedentCollisions', details: {}, critere: 'excedentCollisions', valeur: 'excedentCollisions', colonne: 'excedentCollisions' },
      { cle: 'propositions.ordre.poids', details: { poids: 3 }, critere: null, valeur: null, colonne: null },
      { cle: 'propositions.ordre.virgule', details: {}, critere: null, valeur: null, colonne: null },
      { cle: 'moteur.valeur.redondance', details: {}, critere: 'redondance', valeur: 'redondance', colonne: 'totalRedondance' },
    ]);
  });

  test('les animateurs comptés : « animateurs non rencontrés » à leur palier, qui désigne sa colonne', () => {
    const charge = structuredClone(chargeDemo('grande'));
    charge.reglages.rencontrerAnimateurs = true;
    const vue = tableau(evaluer(generee(charge, { graine: 1, nombre: 1, arret: 2000 })));
    assert.ok(phraseDe(vue.ordre[0]).includes("puis rencontres répétées, puis animateurs non rencontrés, puis redondance d'appartenance"), phraseDe(vue.ordre[0]));
    assert.deepEqual(
      designes(vue.ordre[0]).filter(([critere]) => critere === 'animateursNonRencontres'),
      [['animateursNonRencontres', 'animateursNonRencontres', 'animateursNonRencontres']],
    );
  });

  test('chaque nom de la phrase désigne une colonne présente du tableau, et un seul : sous chaque mode, chaque combinaison des cases, a priori connu ou inconnu', () => {
    const base = avecPlans(petiteAObjectifs(), PLANS_CONFLIT);
    let vues = 0;
    for (const mode of MODES_OBJECTIFS) {
      for (let masque = 0; masque < 16; masque += 1) {
        const charge = structuredClone(base);
        if (mode !== 'places') charge.reglages.modeObjectifs = mode;
        ['separerAppartenances', 'nouveauxVoisins', 'nouvelleTable', 'varierAppartenances'].forEach((cle, rang) => {
          charge.reglages[cle] = (masque & (1 << rang)) !== 0;
        });
        for (const options of [{}, { plafondsAPriori: null }]) {
          const vue = tableau(evaluer(charge, options));
          const presentes = new Set(vue.colonnes.map(({ nom }) => nom));
          const designees = vue.ordre.flat().filter(({ colonne }) => colonne !== null);
          assert.ok(designees.length >= 1);
          for (const { valeur, colonne } of designees) assert.ok(presentes.has(colonne), `${mode} ${masque} ${valeur} → ${colonne}`);
          assert.equal(new Set(designees.map(({ colonne }) => colonne)).size, designees.length, `${mode} ${masque}`);
          vues += 1;
        }
      }
    }
    assert.equal(vues, 96);
  });
});

describe('tableau : le sixième groupe, les objectifs des tables et les animateurs (A9, A11)', () => {
  const noms = (vue) => vue.colonnes.map(({ nom }) => nom);
  const duGroupe = (vue) => vue.groupes.find(({ cle }) => cle === 'propositions.groupe.objectifs')?.colonnes ?? null;
  const sansSixieme = (vue) => SIXIEME.every((nom) => !noms(vue).includes(nom));

  // Les colonnes de chaque ligne comparable et du retenu suivent celles de la
  // vue : les mesures seules, sans le rang, la proposition, les imposés ni
  // les commandes.
  function exigerCellulesAlignees(vue) {
    const mesures = noms(vue).filter((nom) => !['rang', 'proposition', 'imposes', 'commandes'].includes(nom));
    assert.equal(vue.etendueRaisons, mesures.length + 1);
    for (const ligne of [...vue.lignes, ...(vue.retenu?.comparable ? [vue.retenu] : [])]) {
      assert.deepEqual(ligne.cellules.map(({ colonne }) => colonne), mesures, String(ligne.id));
    }
  }

  test('sans objectif ni case des animateurs : aucune colonne du groupe ; les vingt et une colonnes et les cinq groupes d’avant', () => {
    const vue = tableau(evaluer(generee(chargeDemo('petite-conflit'), { graine: 3, nombre: 2, arret: 200 })));
    assert.deepEqual(noms(vue), COLONNES_PAR_DEFAUT);
    assert.equal(duGroupe(vue), null);
    assert.deepEqual(
      vue.groupes.filter(({ cle }) => cle !== null).map(({ cle }) => cle),
      ['rencontres', 'collisions', 'repetitions', 'diversite', 'manque'].map((nom) => `propositions.groupe.${nom}`),
    );
    assert.deepEqual(vue.groupes, GROUPES_COLONNES.filter(({ colonnes }) => !SIXIEME.includes(colonnes[0])));
    assert.equal(vue.etendueRaisons, 18);
    exigerCellulesAlignees(vue);
  });

  test('« le plus de places servies » : les tours hors objectif et le minimum des tours selon l’objectif, après le manque et avant le certificat ; ni les personnes jamais servies ni le plus de tours hors objectif d’une personne', () => {
    let charge = generee(petiteAObjectifs(), { graine: 3, nombre: 2, arret: 200 });
    charge = executer(charge, 'retenirProposition', { id: 2 });
    const table = evaluer(charge);
    const vue = tableau(table);
    assert.deepEqual(duGroupe(vue), ['toursHorsObjectif', 'toursSelonObjectif']);
    assert.ok(!noms(vue).includes('jamaisServies'));
    assert.ok(!noms(vue).includes('horsObjectifMax'));
    assert.deepEqual(noms(vue).slice(16, 21), ['ecartItineraireMax', 'ecartAuPlafondAPriori', 'toursHorsObjectif', 'toursSelonObjectif', 'certificat']);
    exigerCellulesAlignees(vue);
    const lignes = [...vue.lignes.map((ligne, rang) => [ligne, table.propositions[rang]]), [vue.retenu, table.retenu]];
    for (const [ligne, source] of lignes) {
      assert.equal(cellule(ligne, 'toursHorsObjectif').valeur, source.mesures.objectifs.horsObjectif);
      assert.equal(cellule(ligne, 'toursSelonObjectif').valeur, source.mesures.objectifs.agregat.tous.min);
      assert.equal(cellule(ligne, 'toursHorsObjectif').cle, null);
    }
  });

  test('« chacun au moins une fois » : les personnes jamais servies devant les deux ; « l’équité d’abord » : le plus de tours hors objectif d’une personne', () => {
    for (const [mode, premiere, lire] of [
      ['chacun', 'jamaisServies', (objectifs) => objectifs.jamaisServies],
      ['minimum', 'horsObjectifMax', (objectifs) => objectifs.horsObjectifMax],
    ]) {
      const table = evaluer(generee(petiteAObjectifs({ modeObjectifs: mode }), { graine: 3, nombre: 2, arret: 200 }));
      const vue = tableau(table);
      assert.deepEqual(duGroupe(vue), [premiere, 'toursHorsObjectif', 'toursSelonObjectif'], mode);
      exigerCellulesAlignees(vue);
      vue.lignes.forEach((ligne, rang) => assert.equal(cellule(ligne, premiere).valeur, lire(table.propositions[rang].mesures.objectifs), mode));
    }
  });

  test('critère décoché, ou sans objet faute de personne qui corresponde : aucune colonne du groupe', () => {
    const decoche = tableau(evaluer(generee(petiteAObjectifs({ respecterObjectifs: false, modeObjectifs: 'chacun' }), { graine: 3, nombre: 2, arret: 200 })));
    assert.ok(sansSixieme(decoche), noms(decoche).join(', '));
    assert.equal(duGroupe(decoche), null);
    exigerCellulesAlignees(decoche);
    const orpheline = petiteAObjectifs({ modeObjectifs: 'chacun' });
    for (const participant of orpheline.participants) delete participant.etiquettes;
    const table = evaluer(generee(orpheline, { graine: 3, nombre: 2, arret: 200 }));
    assert.equal(table.criteres.find(({ nom }) => nom === 'toursHorsObjectif').sansObjet, true);
    const vue = tableau(table);
    assert.ok(sansSixieme(vue), noms(vue).join(', '));
    assert.deepEqual(noms(vue), COLONNES_PAR_DEFAUT);
  });

  test('la case des animateurs cochée sur la grande : le minimum des animateurs rencontrés et les animateurs non rencontrés ; décochée, rien', () => {
    const charge = structuredClone(chargeDemo('grande'));
    charge.reglages.rencontrerAnimateurs = true;
    const table = structuredClone(evaluer(generee(charge, { graine: 1, nombre: 1, arret: 2000 })));
    // Trois minimums distincts : la colonne lit celui de toutes les
    // personnes qui peuvent rencontrer un animateur, jamais celui d'une
    // population.
    const { animateurs } = table.propositions[0].mesures;
    animateurs.agregat = { tous: { min: 0 }, mobiles: { min: 2 }, ancres: { min: 1 } };
    const vue = tableau(table);
    assert.deepEqual(duGroupe(vue), ['animateursRencontres', 'animateursNonRencontres']);
    exigerCellulesAlignees(vue);
    const [ligne] = vue.lignes;
    assert.equal(cellule(ligne, 'animateursRencontres').valeur, 0);
    assert.equal(cellule(ligne, 'animateursNonRencontres').valeur, animateurs.nonRencontres);
    const sans = tableau(evaluer(generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 2000 })));
    assert.ok(sansSixieme(sans));
  });

  test('le mode se lit dans les valeurs de l’état des critères, jamais recalculé ; une mesure absente s’écrit « — » (A9)', () => {
    const table = structuredClone(evaluer(generee(petiteAObjectifs(), { graine: 3, nombre: 2, arret: 200 })));
    table.criteres.find(({ nom }) => nom === 'toursHorsObjectif').valeurs = ['horsObjectifMax', 'toursHorsObjectif'];
    table.propositions[0].mesures.objectifs = null;
    // Trois minimums distincts sur la seconde : la colonne lit celui de
    // toutes les personnes concernées, jamais celui d'une population.
    const servie = table.propositions[1];
    servie.mesures.objectifs.agregat = { tous: { min: 0 }, mobiles: { min: 2 }, ancres: { min: 1 } };
    const vue = tableau(table);
    assert.equal(cellule(vue.lignes.find(({ id }) => id === servie.id), 'toursSelonObjectif').valeur, 0);
    assert.deepEqual(duGroupe(vue), ['horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif']);
    for (const nom of ['horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif']) {
      const vide = cellule(vue.lignes[0], nom);
      assert.deepEqual([vide.valeur, vide.cle], [null, 'format.vide'], nom);
      assert.equal(texte(vide), '\u{2014}', nom);
      assert.equal(typeof cellule(vue.lignes[1], nom).valeur, 'number', nom);
    }
  });
});

describe('tableau : la diversité en colonne (§ 5.7)', () => {
  test('chaque ligne porte A(p), Σ r(p), d(p) et les paires distinctes ; sans affilié rencontré, d(p) s’écrit « — »', () => {
    const vue = tableau(evaluer(generee(chargeDemo('petite'), { graine: 6, nombre: 2, arret: 300 })));
    assert.equal(vue.lignes.length, 2);
    for (const ligne of vue.lignes) {
      for (const nom of ['appartenancesVues', 'totalRedondance', 'diversite', 'pairesDistinctes']) {
        assert.equal(typeof cellule(ligne, nom).valeur, 'number', nom);
      }
    }
    const sans = avecPlans(chargeSix({ collegues: false }), [{ tours: DEUX_COLLEGUES }]);
    const [ligne] = tableau(evaluer(sans)).lignes;
    assert.equal(cellule(ligne, 'diversite').valeur, null);
    assert.equal(texte(cellule(ligne, 'diversite')), '\u{2014}');
  });
});

describe('tableau : le certificat (§ 5.5, § 15.3)', () => {
  test('le plan parfait de la petite, enregistré comme proposition : « minimum atteint »', () => {
    const charge = avecPlans(chargeDemo('petite'), [{ tours: PLAN_PARFAIT_PETITE.tours }]);
    const [ligne] = tableau(evaluer(charge)).lignes;
    assert.equal(cellule(ligne, 'certificat').valeur, true);
    assert.equal(texte(cellule(ligne, 'certificat')), 'minimum atteint');
  });

  test('grande : jamais ; l’écart au plafond a priori et « atteignabilité inconnue »', () => {
    const [ligne] = tableau(evaluer(generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 50_000 }))).lignes;
    assert.equal(texte(cellule(ligne, 'certificat')), 'atteignabilité inconnue');
    assert.ok(cellule(ligne, 'ecartAuPlafondAPriori').valeur >= 1);
  });

  test('manque nul sur des itinéraires bas, une personne en réserve trois tours sur quatre : pas de certificat', () => {
    const tours = [
      [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      [[6, 9, 12], [3, 8, 11], [2, 5], [1, 4, 7]],
      [[4, 8], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
      [[5, 7, 11], [1, 9], [3, 4, 12], [2, 6, 8]],
    ];
    const charge = avecPlans(chargeDemo('petite'), [{ tours, reserves: [[], [10], [10], [10]] }]);
    const [ligne] = tableau(evaluer(charge)).lignes;
    assert.equal(cellule(ligne, 'manqueMax').valeur, 0);
    assert.equal(cellule(ligne, 'certificat').valeur, false);
    assert.equal(texte(cellule(ligne, 'certificat')), 'atteignabilité inconnue');
    assert.ok(cellule(ligne, 'ecartItineraireMax').valeur > 0);
  });
});

describe('tableau : le manque contre le plafond réalisé (§ 5.5)', () => {
  test('le plus grand manque et son effectif égalent troisChiffres sur plafondsRealises ; aucune colonne ne recompose un plafond', () => {
    const charge = generee(chargeDemo('petite-conflit'), { graine: 8, nombre: 3, arret: 300 });
    const vue = tableau(evaluer(charge));
    const instance = normaliser(configurationDepuisCharge(charge));
    const aPriori = plafondsAPriori(instance);
    assert.equal(vue.lignes.length, 3);
    for (const ligne of vue.lignes) {
      const tableDe = indexerPlan(instance, planDepuisFichier(charge.propositions.find(({ id }) => id === ligne.id)));
      const mesures = mesurer(instance, tableDe);
      const trois = troisChiffres(instance, mesures, aPriori, plafondsRealises(instance, tableDe));
      assert.equal(cellule(ligne, 'manqueMax').valeur, trois.manqueMax.tous);
      assert.equal(cellule(ligne, 'effectifManque').valeur, trois.effectifManque.tous);
      assert.equal(cellule(ligne, 'rencontresTous').valeur, mesures.aggRencontres.tous.min);
    }
    for (const { nom } of COLONNES) assert.doesNotMatch(nom, /plafond(?!APriori)/i, nom);
  });
});

describe('tableau : le retenu et les placements hors classement (§ 9, § 12.6)', () => {
  test('le retenu se mesure sur sa propre ligne ; la proposition d’origine est marquée', () => {
    let charge = generee(chargeDemo('petite'), { graine: 3, nombre: 3, arret: 300 });
    charge = executer(charge, 'retenirProposition', { id: 2 });
    const table = evaluer(charge);
    const vue = tableau(table);
    assert.equal(vue.retenu.id, 2);
    assert.equal(vue.retenu.comparable, true);
    assert.deepEqual(vue.retenu.libelle, { cle: 'propositions.retenu.origine', details: { proposition: 2 } });
    assert.deepEqual(tableau(table, { ajuste: true }).retenu.libelle, { cle: 'propositions.retenu.ajuste', details: { proposition: 2 } });
    assert.equal(vue.lignes.filter(({ libelle }) => libelle !== undefined).length, 0);
    for (const [nom, attendue] of ATTENDUE) assert.deepEqual(cellule(vue.retenu, nom).valeur, attendue(table.retenu), nom);
    assert.deepEqual(vue.lignes.filter(({ retenue }) => retenue).map(({ id }) => id), [2]);
  });

  test('générer, exclure une personne, générer encore : les premières hors classement, non comparables, leurs raisons nomment la personne', () => {
    let charge = generee(chargeDemo('petite'), { graine: 1, nombre: 2, arret: 200 });
    charge = executer(charge, 'exclureParticipant', { id: 4 });
    charge = generee(charge, { graine: 2, nombre: 2, arret: 200 });
    const vue = tableau(evaluer(charge));
    assert.deepEqual(vue.lignes.map(({ id }) => id).sort(), [3, 4]);
    assert.deepEqual(vue.horsClassement.map(({ id }) => id), [1, 2]);
    for (const ligne of vue.horsClassement) {
      assert.equal(ligne.rang, null);
      assert.equal(ligne.statut, 'propositions.statut.derive');
      assert.deepEqual(ligne.raisons, [{ cle: 'PARTICIPANT_EXCLU', details: { code: 'PARTICIPANT_EXCLU', participant: 4 }, participant: 4 }]);
      assert.match(t(ligne.raisons[0].cle, ligne.raisons[0].details), /4/);
    }
    assert.equal(nomDe(charge, 4), nomAffiche(charge.participants.find(({ id }) => id === 4)));
    assert.equal(nomDe(charge, 999), null);
    assert.equal(nomDe(charge, null), null);
    // La cellule des raisons couvre les colonnes de mesure et celle des
    // imposés d'une ligne comparable.
    const [comparable] = vue.lignes;
    assert.equal(vue.etendueRaisons, comparable.cellules.length + 1);
    assert.equal(vue.etendueRaisons, vue.colonnes.length - 3);
  });

  test('une exclusion et un ajout, à effectif égal : hors classement aussi', () => {
    let charge = generee(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 200 });
    charge = executer(charge, 'exclureParticipant', { id: 4 });
    charge = executer(charge, 'ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris', appartenance: 'Club des Merles' } });
    const vue = tableau(evaluer(charge));
    assert.deepEqual(vue.lignes, []);
    assert.deepEqual(vue.horsClassement.map(({ id }) => id), [1]);
    assert.deepEqual(vue.horsClassement[0].raisons.map(({ cle }) => cle), ['PARTICIPANT_EXCLU', 'PARTICIPANT_NON_PLACE']);
    // Chaque raison porte la personne qu'elle nomme, null quand elle n'en
    // nomme aucune.
    assert.deepEqual(
      vue.horsClassement[0].raisons.map(({ participant }) => participant),
      vue.horsClassement[0].raisons.map(({ details }) => details.participant ?? null),
    );
    assert.ok(vue.horsClassement[0].raisons.every(({ participant }) => participant !== undefined));
  });
});

describe('tableau : les imposés à part (§ 5.4)', () => {
  test('grande : chaque ligne énonce « 99 retours imposés par 33 ancrages », à part des retours choisis', () => {
    const table = evaluer(generee(chargeDemo('grande'), { graine: 1, nombre: 2, arret: 20_000 }));
    const vue = tableau(table);
    assert.equal(vue.lignes.length, 2);
    vue.lignes.forEach((ligne, rang) => {
      const [retours] = ligne.imposes;
      assert.deepEqual(retours, { cle: 'propositions.imposes.retours', details: { retours: 99, ancrages: 33 } });
      assert.equal(t(retours.cle, retours.details), '99 retours imposés par 33 ancrages.');
      assert.equal(cellule(ligne, 'retoursChoisis').valeur, table.propositions[rang].mesures.totalRetoursChoisis);
    });
  });

  test('deux personnes réservées ensemble : les rencontres répétées imposées à part des choisies, jamais additionnées', () => {
    const charge = structuredClone(chargeDemo('petite'));
    charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    const table = evaluer(generee(charge, { graine: 6, nombre: 3, arret: 500 }));
    const vue = tableau(table);
    assert.equal(vue.lignes.length, 3);
    vue.lignes.forEach((ligne, rang) => {
      const { choisies, imposees } = table.propositions[rang].mesures.rencontresRepetees;
      assert.equal(imposees, 1);
      assert.equal(cellule(ligne, 'rencontresRepetees').valeur, choisies);
      assert.deepEqual(ligne.imposes[1], { cle: 'propositions.imposes.repetees', details: { repetees: 1 } });
      assert.equal(t(ligne.imposes[1].cle, ligne.imposes[1].details), '1 rencontre répétée imposée.');
    });
  });
});

describe('retenuAjuste (§ 2.1, § 5.9)', () => {
  // La charge à six personnes, deux tables de quatre, une proposition.
  const deTables = () => avecPlans(chargeSix({ places: 4 }), [{ tours: DEUX_COLLEGUES }]);

  test('faux sans retenu, et pour un retenu tel que retenu', () => {
    const charge = deTables();
    assert.equal(retenuAjuste(charge), false);
    assert.equal(retenuAjuste(executer(charge, 'retenirProposition', { id: 1 })), false);
  });

  test('vrai après un deplacerDansRetenu, vrai quand la proposition d’origine n’est plus dans la liste', () => {
    const retenue = executer(deTables(), 'retenirProposition', { id: 1 });
    const deplacee = executer(retenue, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    assert.equal(retenuAjuste(deplacee), true);
    const sansOrigine = structuredClone(retenue);
    sansOrigine.propositions = [];
    assert.equal(retenuAjuste(sansOrigine), true);
  });

  test("le tableau et la page de qualité lisent la même définition : tel que retenu, ajusté, sa proposition effacée, la page ne montre la course que d'un retenu non ajusté", () => {
    const retenue = executer(deTables(), 'retenirProposition', { id: 1 });
    const deplacee = executer(retenue, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    const sansOrigine = structuredClone(retenue);
    sansOrigine.propositions = [];
    assert.equal(retenuAjuste, retenuAjusteDeLEvaluation);
    const lus = [retenue, deplacee, sansOrigine].map((charge) => {
      const detail = detaillerQualite(charge, 'retenu', { courseDe: () => ({ evalues: 0, releves: [] }) });
      return [detail.statut, retenuAjuste(charge), detail.propositionDuRetenu === null, detail.course === null];
    });
    assert.deepEqual(lus, [
      ['comparable', false, false, false],
      ['comparable', true, true, true],
      ['comparable', true, true, true],
    ]);
  });
});

describe('retenuRetouche et le libellé du retenu (§ 2.1, § 5.9)', () => {
  const deTables = () => avecPlans(chargeSix({ places: 4 }), [{ tours: DEUX_COLLEGUES }]);
  const libelle = (charge) => {
    const { cle, details } = tableau(evaluation(charge).table, { ajuste: retenuAjuste(charge), retouche: retenuRetouche(charge) }).retenu.libelle;
    return t(cle, details);
  };

  test('la définition est celle de l’évaluation', () => {
    assert.equal(retenuRetouche, retenuRetoucheDeLEvaluation);
  });

  test('tel que retenu, ajusté aux participants par un changement de présence, retouché à la main ensuite', () => {
    const retenue = executer(deTables(), 'retenirProposition', { id: 1 });
    const presence = executer(retenue, 'changerPresence', { id: 1, tours: [1, 2] });
    const deplacee = executer(presence, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    assert.deepEqual(
      [retenue, presence, deplacee].map((charge) => [retenuAjuste(charge), retenuRetouche(charge)]),
      [
        [false, false],
        [true, false],
        [true, true],
      ],
    );
    assert.deepEqual(
      [retenue, presence, deplacee].map(libelle),
      [
        'Tel que la proposition n° 1.',
        'Tel que la proposition n° 1, ajusté aux participants.',
        'Ajusté à la main depuis la proposition n° 1.',
      ],
    );
  });

  test('sans retouche donnée, le libellé suit ajuste', () => {
    const presence = executer(executer(deTables(), 'retenirProposition', { id: 1 }), 'changerPresence', { id: 1, tours: [1, 2] });
    const table = evaluation(presence).table;
    assert.equal(tableau(table, { ajuste: true }).retenu.libelle.cle, 'propositions.retenu.ajuste');
    assert.equal(tableau(table, { ajuste: true, retouche: false }).retenu.libelle.cle, 'propositions.retenu.presence');
    assert.equal(tableau(table).retenu.libelle.cle, 'propositions.retenu.origine');
  });
});

describe('demandeConfirmation (§ 2.1)', () => {
  const deTables = () => avecPlans(chargeSix({ places: 4 }), [{ tours: DEUX_COLLEGUES }, { tours: DEUX_COLLEGUES }]);

  test('null sans retenu ajusté, sans charge, ou quand la séance refuserait le geste', () => {
    const charge = deTables();
    assert.equal(demandeConfirmation({ refus: null, charge }, 2), null);
    assert.equal(demandeConfirmation({ refus: null, charge: null }, 2), null);
    const retenue = executer(charge, 'retenirProposition', { id: 1 });
    assert.equal(demandeConfirmation({ refus: null, charge: retenue }, 2), null);
    const deplacee = executer(retenue, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    const refus = { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE' } };
    assert.equal(demandeConfirmation({ refus, charge: deplacee }, 2), null);
  });

  test('un retenu ajusté que la séance laisserait remplacer : la fenêtre nomme le retenu ajusté et la proposition qui le remplace', () => {
    const retenue = executer(deTables(), 'retenirProposition', { id: 1 });
    const deplacee = executer(retenue, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    assert.deepEqual(demandeConfirmation({ refus: null, charge: deplacee }, 2), {
      id: 2,
      titre: { cle: 'propositions.confirmation.titre', details: { proposition: 2 } },
      elements: [
        { cle: 'propositions.confirmation.retenuAjuste', details: { proposition: 1 } },
        { cle: 'propositions.confirmation.remplacant', details: { proposition: 2 } },
      ],
    });
    // Re-retenir l'origine détruit aussi les ajustements.
    assert.equal(demandeConfirmation({ refus: null, charge: deplacee }, 1).id, 1);
  });

  test('un retenu ajusté par les seuls changements de participants n’ouvre pas de fenêtre : retenir le réajuste de même ; une retouche ensuite en ouvre une', () => {
    const retenue = executer(deTables(), 'retenirProposition', { id: 1 });
    for (const [nom, args] of [
      ['changerPresence', { id: 1, tours: [1, 2] }],
      ['ajouterParticipant', { champs: { nom: 'Quenouille' }, presence: [3, 4] }],
      ['exclureParticipant', { id: 2 }],
    ]) {
      const ajustee = executer(retenue, nom, args);
      assert.equal(retenuAjuste(ajustee), true, nom);
      assert.equal(demandeConfirmation({ refus: null, charge: ajustee }, 2), null, nom);
      assert.equal(demandeConfirmation({ refus: null, charge: ajustee }, 1), null, nom);
    }
    const presence = executer(retenue, 'changerPresence', { id: 1, tours: [1, 2] });
    const deplacee = executer(presence, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    assert.equal(demandeConfirmation({ refus: null, charge: deplacee }, 2).id, 2);
  });
});

describe('garder les meilleures (§ 5.7) : la saisie, la fenêtre, l’annonce, la page', () => {
  // Les trois plans de la petite démonstration au conflit inévitable, que
  // le classement range 3, 2, 1 ; la charge figée, comme celle de l'état
  // observable de la séance.
  const conflit = () => avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
  const figee = (charge) => Object.freeze(structuredClone(charge));

  test('dix au départ ; la saisie se lit en entier ≥ 1, blancs de bord admis ; sinon son refus, remède nul', () => {
    assert.equal(GARDEES_PAR_DEFAUT, 10);
    assert.deepEqual(lireGardees('10'), { valeur: 10 });
    assert.deepEqual(lireGardees(' 3 '), { valeur: 3 });
    assert.deepEqual(lireGardees('0'), { refus: { code: 'HORS_DOMAINE', details: { min: 1, max: null, remede: null } } });
    for (const saisie of ['', 'dix', '2,5', '-1', '1e3']) {
      assert.deepEqual(lireGardees(saisie), { refus: { code: 'NON_ENTIER', details: { saisie, remede: null } } }, saisie);
    }
    assert.equal(t('HORS_DOMAINE', { min: 1, max: null }), "La valeur doit être d'au moins 1.");
  });

  test('la fenêtre dit combien s’effacent et combien restent, sur la table que le tableau montre ; aucun ordre refait', () => {
    const charge = figee(conflit());
    const table = evaluation(charge).table;
    assert.deepEqual(table.propositions.map(({ id }) => id), [3, 2, 1]);
    const demande = demandeNettoyage({ refus: null, charge }, 1);
    assert.deepEqual(demande, {
      n: 1,
      effacees: 2,
      titre: { cle: 'propositions.nettoyage.titre', details: { n: 1, effacees: 2 } },
      elements: [
        { cle: 'propositions.nettoyage.gardees', details: { n: 1 } },
        { cle: 'propositions.nettoyage.defaire', details: { effacees: 2 } },
      ],
    });
    assert.equal(demande.effacees, nettoyage(table, 1).effacees.length);
    assert.equal(t(demande.titre.cle, demande.titre.details), 'Effacer 2 propositions et garder la meilleure ?');
    assert.deepEqual(
      demande.elements.map(({ cle, details }) => t(cle, details)),
      ['La première proposition du classement reste.', '« Défaire » rend les 2 propositions effacées.'],
    );
  });

  test('la proposition du retenu, au-delà des n premières, reste aussi, et la fenêtre le dit', () => {
    const charge = figee(executer(conflit(), 'retenirProposition', { id: 1 }));
    const demande = demandeNettoyage({ refus: null, charge }, 1);
    assert.equal(demande.effacees, 1);
    assert.deepEqual(demande.elements, [
      { cle: 'propositions.nettoyage.gardees', details: { n: 1 } },
      { cle: 'propositions.nettoyage.origine', details: { proposition: 1 } },
      { cle: 'propositions.nettoyage.defaire', details: { effacees: 1 } },
    ]);
    assert.equal(t(demande.titre.cle, demande.titre.details), 'Effacer 1 proposition et garder la meilleure ?');
    assert.deepEqual(
      demande.elements.map(({ cle, details }) => t(cle, details)),
      [
        'La première proposition du classement reste.',
        'La proposition n° 1 reste aussi : le placement retenu en vient.',
        '« Défaire » rend la proposition effacée.',
      ],
    );
  });

  test('sans fenêtre : la séance refuserait, rien à effacer, ou rien à classer — le geste part, et son refus se pose', () => {
    const charge = figee(conflit());
    const refus = { code: 'MODE_LECTURE', details: { remede: { geste: 'modifier' } } };
    assert.equal(demandeNettoyage({ refus, charge }, 1), null);
    assert.equal(demandeNettoyage({ refus: null, charge }, 3), null);
    assert.equal(demandeNettoyage({ refus: null, charge }, 12), null);
    assert.equal(demandeNettoyage({ refus: null, charge: null }, 1), null);
    const retenue = figee(executer(conflit(), 'retenirProposition', { id: 1 }));
    assert.equal(demandeNettoyage({ refus: null, charge: retenue }, 2), null);
    const surreservee = structuredClone(conflit());
    surreservee.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    assert.equal(evaluation(figee(surreservee)).table, null);
    assert.equal(demandeNettoyage({ refus: null, charge: figee(surreservee) }, 1), null);
  });

  test('les libellés : le bouton nomme N, la fenêtre et l’annonce accordent leurs nombres, mis en forme', () => {
    const fine = '\u{202F}';
    assert.equal(t('propositions.commande.garder', { n: 10 }), 'Garder les 10 meilleures');
    assert.equal(t('propositions.commande.garder', { n: 1 }), 'Garder la meilleure');
    assert.equal(t('propositions.commande.garder', { n: 1500 }), `Garder les 1${fine}500 meilleures`);
    assert.equal(t('propositions.nettoyage.titre', { n: 10, effacees: 37 }), 'Effacer 37 propositions et garder les 10 meilleures ?');
    assert.equal(t('propositions.nettoyage.gardees', { n: 10 }), 'Les 10 premières propositions du classement restent.');
    assert.equal(t('propositions.nettoyage.champ'), 'Propositions à garder');
    assert.deepEqual(annonceNettoyage(37), { cle: 'propositions.nettoyage.annonce', details: { effacees: 37 } });
    assert.equal(t('propositions.nettoyage.annonce', { effacees: 37 }), '37 propositions effacées.');
    assert.equal(t('propositions.nettoyage.annonce', { effacees: 1 }), '1 proposition effacée.');
  });

  test('après le nettoyage, la page qui n’existe plus ramène à la première ; une page qui existe encore reste', () => {
    const avant = changerDePage(suivrePage(null, observee(vueDe(450))), 4);
    assert.equal(avant.page, 4);
    const apres = suivrePage(avant, observee(vueDe(250)));
    assert.equal(apres.page, 3);
    const premiere = pageApresNettoyage(apres, 4);
    assert.deepEqual([premiere.page, premiere.pages, premiere.cles], [1, 3, apres.cles]);
    assert.ok(Object.isFrozen(premiere));
    const deuxieme = changerDePage(suivrePage(null, observee(vueDe(450))), 2);
    const garde = suivrePage(deuxieme, observee(vueDe(250)));
    assert.equal(pageApresNettoyage(garde, 2), garde);
    assert.equal(pageApresNettoyage(null, 2), null);
  });
});

describe('evaluation : la table d’une charge, ou ce qui l’empêche', () => {
  test('sans proposition ni retenu, rien à évaluer ; une configuration qui ne se normalise pas rend son refus', () => {
    assert.deepEqual(evaluation(chargeDemo('petite')), { table: null, refus: null });
    const avec = generee(chargeDemo('petite'), { graine: 1, nombre: 1, arret: 100 });
    assert.deepEqual(evaluation(avec), { table: evaluer(avec), refus: null });
    const charge = structuredClone(avec);
    charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    const { table, refus } = evaluation(charge);
    assert.equal(table, null);
    assert.equal(refus.code, 'SURRESERVATION');
  });
});

// Fige en profondeur, comme la séance fige la charge de son état
// observable : chaque objet atteint, puis l'objet lui-même.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    for (const element of Object.values(valeur)) figer(element);
    Object.freeze(valeur);
  }
  return valeur;
}

// Vrai quand chaque objet atteint depuis valeur est figé.
const figeePartout = (valeur) =>
  valeur === null || typeof valeur !== 'object' || (Object.isFrozen(valeur) && Object.values(valeur).every(figeePartout));

describe('evaluation : une table par charge figée, relue tant que la charge ne change pas (§ 13.3)', () => {
  test('une même charge figée rend deux fois la même table, figée en profondeur et égale à celle d’evaluer', () => {
    const charge = figer(generee(chargeDemo('petite'), { graine: 1, nombre: 3, arret: 100 }));
    const premiere = evaluation(charge);
    assert.equal(evaluation(charge), premiere);
    assert.deepEqual(premiere, { table: evaluer(charge), refus: null });
    assert.ok(figeePartout(premiere));
    const refusee = structuredClone(charge);
    refusee.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    figer(refusee);
    assert.equal(evaluation(refusee), evaluation(refusee));
    assert.equal(evaluation(refusee).refus.code, 'SURRESERVATION');
  });

  test('chaque écriture rend une charge neuve, dont la table se mesure à neuf ; la charge d’avant garde la sienne', () => {
    const avant = figer(generee(chargeDemo('petite'), { graine: 1, nombre: 3, arret: 100 }));
    const deAvant = evaluation(avant);
    const exclue = figer(executer(avant, 'exclureParticipant', { id: avant.participants[0].id }));
    assert.deepEqual(evaluation(exclue), { table: evaluer(exclue), refus: null });
    assert.ok(evaluation(exclue).table.propositions.every(({ statut }) => statut === 'derive'));
    const plus = figer(generee(avant, { graine: 2, nombre: 2, arret: 100 }));
    assert.deepEqual(evaluation(plus), { table: evaluer(plus), refus: null });
    assert.equal(evaluation(plus).table.propositions.length, 5);
    const retenue = figer(executer(plus, 'retenirProposition', { id: plus.propositions[4].id }));
    assert.deepEqual(evaluation(retenue), { table: evaluer(retenue), refus: null });
    assert.equal(evaluation(retenue).table.retenu.id, plus.propositions[4].id);
    const effacee = figer(executer(retenue, 'effacerPropositions', {}));
    assert.deepEqual(evaluation(effacee), { table: evaluer(effacee), refus: null });
    assert.deepEqual(evaluation(effacee).table.propositions.map(({ id }) => id), [plus.propositions[4].id]);
    assert.equal(evaluation(avant), deAvant);
  });

  test('une charge neuve qui reprend les objets figés de la précédente — propositions comprises — se mesure à neuf', () => {
    const avant = figer(generee(chargeDemo('petite'), { graine: 1, nombre: 3, arret: 100 }));
    const deAvant = evaluation(avant);
    const [premiere, ...autres] = avant.participants;
    const partagee = figer({ ...avant, participants: [{ ...premiere, exclu: true }, ...autres] });
    assert.equal(partagee.propositions, avant.propositions);
    assert.equal(partagee.tables, avant.tables);
    assert.deepEqual(evaluation(partagee), { table: evaluer(partagee), refus: null });
    assert.ok(evaluation(partagee).table.propositions.every(({ statut }) => statut === 'derive'));
    assert.equal(evaluation(avant), deAvant);
  });

  test('une charge qui n’est pas figée partout se mesure à chaque appel : modifiée en place, sa table suit', () => {
    const charge = generee(chargeDemo('petite'), { graine: 1, nombre: 3, arret: 100 });
    assert.notEqual(evaluation(charge), evaluation(charge));
    Object.freeze(charge);
    const premiere = evaluation(charge);
    charge.propositions.pop();
    charge.participants[0].exclu = true;
    assert.notDeepEqual(evaluation(charge), premiere);
    assert.deepEqual(evaluation(charge), { table: evaluer(charge), refus: null });
    assert.ok(evaluation(charge).table.propositions.every(({ statut }) => statut === 'derive'));
  });
});

describe('les explications des colonnes et des critères (infobulles, § 5.4, § 5.5, § 5.7)', () => {
  // Le sens de chaque colonne : 'bas' quand la plus faible valeur sert le
  // mieux, 'grand' quand c'est la plus forte ; null quand l'explication ne
  // dit aucun sens — le rang, le numéro, les paires distinctes, que l'ordre
  // ne lit pas et dont le compte le plus faible n'est pas le meilleur
  // (§ 5.4), le certificat, les imposés et les commandes.
  const SENS = new Map([
    ['rang', null],
    ['proposition', null],
    ['rencontresTous', 'grand'],
    ['rencontresMobiles', 'grand'],
    ['rencontresAncres', 'grand'],
    ['collisionsCumulees', 'bas'],
    ['pairesDistinctes', null],
    ['excedentCollisions', 'bas'],
    ['rencontresRepetees', 'bas'],
    ['maxRencontresPaire', 'bas'],
    ['retoursChoisis', 'bas'],
    ['appartenancesVues', 'grand'],
    ['totalRedondance', 'bas'],
    ['diversite', 'grand'],
    ['manqueMax', 'bas'],
    ['effectifManque', 'bas'],
    ['ecartItineraireMax', 'bas'],
    ['ecartAuPlafondAPriori', 'bas'],
    ['jamaisServies', 'bas'],
    ['horsObjectifMax', 'bas'],
    ['toursHorsObjectif', 'bas'],
    ['toursSelonObjectif', 'grand'],
    ['animateursRencontres', 'grand'],
    ['animateursNonRencontres', 'bas'],
    ['certificat', null],
    ['imposes', null],
    ['commandes', null],
  ]);
  const MIEUX = new Map([
    ['bas', /Plus (?:il|elle) est (?:bas|basse), mieux c'est\./],
    ['grand', /Plus (?:il|elle) est (?:grand|grande), mieux c'est\./],
  ]);
  // Les phrases d'un texte : un point, puis un blanc, puis une capitale ou
  // un guillemet ouvrant.
  const phrases = (texte) => texte.split(/(?<=\.)\s+(?=[\p{Lu}\u{00AB}])/u);

  test('chaque colonne de COLONNES, sans exception, porte la clé de son explication : elle existe, compte une à trois phrases, et diffère de l’en-tête et des autres explications', () => {
    assert.equal(COLONNES.length, 27);
    assert.deepEqual(COLONNES.map(({ nom }) => nom), [...SENS.keys()]);
    const textes = new Set();
    for (const { nom, cle, explication } of COLONNES) {
      assert.equal(explication, `propositions.explication.${nom}`, nom);
      assert.equal(explicationDeColonne(nom), explication, nom);
      const texte = t(explication);
      const nombre = phrases(texte).length;
      assert.ok(nombre >= 1 && nombre <= 3, `${nom} : ${nombre} phrases`);
      assert.ok(texte.length <= 420, `${nom} : ${texte.length} caractères`);
      assert.notEqual(texte, t(cle), nom);
      textes.add(texte);
    }
    assert.equal(textes.size, COLONNES.length);
  });

  test('chaque explication dit dans quel sens la colonne sert le mieux, et seulement quand ce sens existe', () => {
    assert.ok(SENS.size > 0);
    for (const [nom, sens] of SENS) {
      const texte = t(explicationDeColonne(nom));
      for (const [autre, motif] of MIEUX) {
        if (autre === sens) assert.match(texte, motif, nom);
        else assert.doesNotMatch(texte, motif, nom);
      }
      if (sens === null) assert.doesNotMatch(texte, /mieux c'est/, nom);
    }
  });

  test('chaque valeur qui classe, et l’identifiant croissant, partage l’explication de la colonne qu’elle désigne ; seule l’explication d’une valeur qui classe la dit critère du classement', () => {
    const valeurs = ['ecartAuPlafondAPrioriMax', 'excedentCollisions', 'collisionsCumulees', 'jamaisServies', 'horsObjectifMax']
      .concat(['toursHorsObjectif', 'rencontresRepeteesChoisies', 'retoursChoisis', 'animateursNonRencontres', 'redondance']);
    const criteres = new Set(valeurs.map(colonneDeValeur));
    assert.equal(criteres.size, 10);
    for (const { nom } of COLONNES) {
      const texte = t(explicationDeColonne(nom));
      if (criteres.has(nom)) assert.match(texte, /critère du classement/i, nom);
      else assert.doesNotMatch(texte, /(?<!pas un )critère du classement/i, nom);
    }
    assert.match(t(explicationDeColonne(colonneDeValeur('identifiant'))), /départage/, 'identifiant');
    for (const options of [{}, { plafondsAPriori: null }]) {
      const vue = tableau(evaluer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), options));
      const designants = vue.ordre.flat().filter(({ colonne }) => colonne !== null);
      assert.ok(designants.length >= 5);
      for (const { valeur, colonne } of designants) {
        assert.equal(explicationDeColonne(colonne), explicationDeColonne(colonneDeValeur(valeur)), valeur);
        assert.ok(t(explicationDeColonne(colonne)).length > 0, valeur);
      }
    }
  });

  test('l’explication d’une colonne que désigne une valeur qui classe ne fixe aucun rang : la place vient de l’ordre écrit au-dessus du tableau', () => {
    const valeurs = new Set();
    for (const mode of MODES_OBJECTIFS) {
      for (const nouveauxVoisins of [true, false]) {
        for (const nom of REGISTRE) for (const valeur of valeursQuiClassent(nom, { nouveauxVoisins }, mode)) valeurs.add(valeur);
      }
    }
    assert.equal(valeurs.size, 10);
    for (const valeur of valeurs) {
      const texte = t(explicationDeColonne(colonneDeValeur(valeur)));
      assert.doesNotMatch(texte, /critère du classement (?:après|avant)|(?:premier|dernier) critère/i, valeur);
      assert.match(texte, /l'ordre écrit au-dessus du tableau/, valeur);
    }
  });

  test('l’excédent de collisions dit son rang par défaut et pourquoi : passer la soirée avec le même collègue est pire que croiser six collègues une fois (§ 5.4)', () => {
    const texte = t(explicationDeColonne('excedentCollisions'));
    assert.match(texte, /par défaut avant les collisions cumulées/);
    assert.match(texte, /le même collègue est pire que croiser six collègues une fois/);
  });

  test('explicationDeColonne lève pour un nom qui n’est pas une colonne', () => {
    assert.equal(explicationDeColonne('rang'), 'propositions.explication.rang');
    assert.throws(() => explicationDeColonne('redondance'), TypeError);
    assert.throws(() => explicationDeColonne('moyenneRencontres'), TypeError);
  });
});

describe('surlignee : la colonne surlignée, du survol et du focus (§ 5.7)', () => {
  test('le nom survolé l’emporte ; sans survol, celui qui a le focus ; ni l’un ni l’autre, rien', () => {
    assert.equal(surlignee('excedentCollisions', 'proposition'), 'excedentCollisions');
    assert.equal(surlignee(null, 'proposition'), 'proposition');
    assert.equal(surlignee('excedentCollisions', null), 'excedentCollisions');
    assert.equal(surlignee(null, null), null);
  });
});

describe('GROUPES_COLONNES : les en-têtes groupés du tableau', () => {
  const noms = COLONNES.map(({ nom }) => nom);

  test('les segments couvrent chaque colonne une fois, dans l’ordre de COLONNES ; chaque étendue est le compte de ses colonnes', () => {
    assert.ok(GROUPES_COLONNES.length > 0);
    assert.deepEqual(GROUPES_COLONNES.flatMap(({ colonnes }) => colonnes), noms);
    for (const segment of GROUPES_COLONNES) assert.equal(segment.etendue, segment.colonnes.length, JSON.stringify(segment));
    assert.ok(Object.isFrozen(GROUPES_COLONNES));
    for (const segment of GROUPES_COLONNES) {
      assert.ok(Object.isFrozen(segment));
      assert.ok(Object.isFrozen(segment.colonnes));
    }
  });

  test('le rang, la proposition, le certificat, les imposés et les commandes restent hors groupe, une colonne par segment sans clé', () => {
    const seules = GROUPES_COLONNES.filter(({ cle }) => cle === null);
    assert.deepEqual(seules.map(({ colonnes }) => colonnes), [['rang'], ['proposition'], ['certificat'], ['imposes'], ['commandes']]);
  });

  test('six groupes de mesures voisines, chacun sous une clé « propositions.groupe. » qui a son texte, distinct des en-têtes de colonne', () => {
    const groupes = GROUPES_COLONNES.filter(({ cle }) => cle !== null);
    assert.deepEqual(
      groupes.map(({ colonnes }) => colonnes),
      [
        ['rencontresTous', 'rencontresMobiles', 'rencontresAncres'],
        ['collisionsCumulees', 'pairesDistinctes', 'excedentCollisions'],
        ['rencontresRepetees', 'maxRencontresPaire', 'retoursChoisis'],
        ['appartenancesVues', 'totalRedondance', 'diversite'],
        ['manqueMax', 'effectifManque', 'ecartItineraireMax', 'ecartAuPlafondAPriori'],
        SIXIEME,
      ],
    );
    assert.equal(groupes.at(-1).cle, 'propositions.groupe.objectifs');
    const enTetes = new Set(COLONNES.map(({ cle }) => t(cle)));
    for (const { cle } of groupes) {
      assert.match(cle, /^propositions\.groupe\.[a-z]+$/u);
      const texte = t(cle);
      assert.ok(texte.length > 0, cle);
      assert.ok(!enTetes.has(texte), cle);
      assert.doesNotMatch(texte, /moyenne/i, cle);
    }
    assert.equal(new Set(groupes.map(({ cle }) => cle)).size, groupes.length);
  });
});

describe('COLONNES : les colonnes de nombres', () => {
  test('nombre est vrai pour le rang et chaque mesure chiffrée ; faux pour la proposition, le certificat en mots, les imposés et les commandes', () => {
    const textes = new Set(['proposition', 'certificat', 'imposes', 'commandes']);
    for (const colonne of COLONNES) assert.equal(colonne.nombre, !textes.has(colonne.nom), colonne.nom);
  });
});

// --- La pagination du classement (§ 5.7, § 2.1 étapes 9 et 10, § 8.4) ---------

// Une vue réduite à ce que la pagination lit : comparables lignes classées,
// rangs 1 à comparables, identifiants 1000 + rang ; puis hors propositions
// hors classement, identifiants 1 à hors.
function vueDe(comparables, hors = 0) {
  return {
    lignes: Array.from({ length: comparables }, (_, place) => ({ id: 1000 + place + 1, rang: place + 1, comparable: true })),
    horsClassement: Array.from({ length: hors }, (_, place) => ({ id: place + 1, rang: null, comparable: false })),
    retenu: null,
  };
}

// Les propositions d'une charge, réduites à ce qui les distingue : chaque
// identifiant reçoit sa graine, son arrêt et son historique.
const propositionsDe = (ids, { graine = 0, arret = 40, historique = 1000 } = {}) =>
  ids.map((id) => ({ id, graine: graine + id, arret, historique }));

// Ce que la section observe d'une vue : la vue, les propositions de sa
// charge — une par ligne —, la proposition visée et le numéro de sa visée.
function observee(vue, { vise = null, visee = 0, graine = 0, arret = 40, historique = 1000 } = {}) {
  const ids = [...vue.lignes, ...vue.horsClassement].map(({ id }) => id);
  return { vue, propositions: propositionsDe(ids, { graine, arret, historique }), vise, visee };
}

describe('pagination : le classement unique se découpe en pages de cent (§ 5.7, § 2.1 étape 9)', () => {
  test('TAILLE_PAGE vaut 100 ; nombreDePages compte une page au moins', () => {
    assert.equal(TAILLE_PAGE, 100);
    assert.deepEqual([0, 1, 100, 101, 200, 201, 237].map(nombreDePages), [1, 1, 1, 2, 2, 3, 3]);
  });

  test('aux bornes 0, 1, 100, 101, 200, 201 : les pages mises bout à bout rendent le classement entier, dans son ordre, chaque rang une fois', () => {
    for (const n of [0, 1, 100, 101, 200, 201]) {
      const vue = vueDe(n);
      const pages = nombreDePages(n);
      const lues = [];
      for (let page = 1; page <= pages; page += 1) {
        const decoupe = pagine(vue, page);
        assert.equal(decoupe.page, page, `${n} : page ${page}`);
        assert.equal(decoupe.pages, pages, `${n}`);
        assert.equal(decoupe.total, n, `${n}`);
        assert.equal(decoupe.paginee, n > 100, `${n}`);
        assert.ok(decoupe.lignes.length <= TAILLE_PAGE, `${n} : page ${page}`);
        assert.equal(decoupe.premier, n === 0 ? 0 : (page - 1) * TAILLE_PAGE + 1, `${n} : page ${page}`);
        assert.equal(decoupe.dernier, Math.min(page * TAILLE_PAGE, n), `${n} : page ${page}`);
        assert.equal(decoupe.dernier - decoupe.premier + (n === 0 ? 0 : 1), decoupe.lignes.length, `${n} : page ${page}`);
        lues.push(...decoupe.lignes);
      }
      assert.deepEqual(lues, vue.lignes, `${n}`);
    }
  });

  test('à cent propositions ou moins, la page unique rend la vue telle quelle ; à 201, la page 3 ne porte que le rang 201', () => {
    const cent = vueDe(100, 0);
    assert.deepEqual(pagine(cent, 1).lignes, cent.lignes);
    const troisPages = pagine(vueDe(201), 3);
    assert.deepEqual(troisPages.lignes.map(({ rang }) => rang), [201]);
    assert.deepEqual([troisPages.premier, troisPages.dernier, troisPages.total], [201, 201, 201]);
  });

  test('une ligne de la page 2 garde son rang global : 101 à 200, jamais 1', () => {
    const decoupe = pagine(vueDe(237), 2);
    assert.deepEqual(decoupe.lignes.map(({ rang }) => rang), Array.from({ length: 100 }, (_, place) => 101 + place));
    assert.deepEqual([decoupe.premier, decoupe.dernier, decoupe.total], [101, 200, 237]);
  });

  test('une page hors des pages existantes se borne : 0 et moins à la première, au-delà à la dernière', () => {
    const vue = vueDe(237);
    assert.equal(pagine(vue, 0).page, 1);
    assert.equal(pagine(vue, -4).page, 1);
    assert.equal(pagine(vue, 4).page, 3);
    assert.equal(pagine(vue, 99).page, 3);
    assert.equal(pagine(vueDe(0), 2).page, 1);
  });

  test('les propositions hors classement suivent les classées dans le compte : 150 classées et 60 hors, la page 2 porte 50 et 50, la page 3 les 10 dernières hors', () => {
    const vue = vueDe(150, 60);
    const deux = pagine(vue, 2);
    assert.deepEqual(deux.lignes.map(({ rang }) => rang), Array.from({ length: 50 }, (_, place) => 101 + place));
    assert.deepEqual(deux.horsClassement.map(({ id }) => id), Array.from({ length: 50 }, (_, place) => place + 1));
    assert.deepEqual([deux.premier, deux.dernier, deux.total, deux.pages], [101, 200, 210, 3]);
    const trois = pagine(vue, 3);
    assert.deepEqual(trois.lignes, []);
    assert.deepEqual(trois.horsClassement.map(({ id }) => id), [51, 52, 53, 54, 55, 56, 57, 58, 59, 60]);
    assert.deepEqual(pagine(vue, 1).horsClassement, []);
  });

  test('la grande et 237 propositions : la page découpe le classement de evaluer, sans tri local — la page 2 commence au 101e de l’ordre du moteur', () => {
    const charge = generee(chargeDemo('grande'), { graine: 7, nombre: 237, arret: 50, historique: 1000 });
    const table = evaluer(charge);
    const vue = tableau(table);
    const ordre = parLeMoteur(charge).classement.ordre;
    assert.equal(ordre.length, 237);
    const pages = [1, 2, 3].map((page) => pagine(vue, page));
    assert.deepEqual(pages.flatMap(({ lignes }) => lignes.map(({ id }) => id)), ordre);
    assert.deepEqual(pages[1].lignes.map(({ id }) => id), ordre.slice(100, 200));
    assert.deepEqual(pages.map(({ lignes }) => lignes.length), [100, 100, 37]);
    assert.notDeepEqual(
      pages[1].lignes.map(({ id }) => id),
      [...pages[1].lignes.map(({ id }) => id)].sort((a, b) => a - b),
      'l’ordre du classement n’est pas celui des identifiants',
    );
  });

  test('pageDe rend la page d’une proposition, classée ou hors classement ; null pour une proposition absente', () => {
    const vue = vueDe(150, 60);
    assert.equal(pageDe(vue, 1001), 1);
    assert.equal(pageDe(vue, 1100), 1);
    assert.equal(pageDe(vue, 1101), 2);
    assert.equal(pageDe(vue, 1150), 2);
    assert.equal(pageDe(vue, 50), 2);
    assert.equal(pageDe(vue, 51), 3);
    assert.equal(pageDe(vue, 999), null);
    assert.equal(pageDe(vue, null), null);
  });
});

describe('pagination : la page suit l’état de navigation, jamais le fichier (§ 8.4)', () => {
  test('sans page retenue, la première ; la page choisie se garde tant que rien ne change', () => {
    const vue = vueDe(237);
    const depart = suivrePage(null, observee(vue));
    assert.equal(depart.page, 1);
    const choisie = changerDePage(depart, 3);
    assert.equal(choisie.page, 3);
    assert.equal(suivrePage(choisie, observee(vue)).page, 3);
  });

  test('changerDePage se borne aux pages existantes', () => {
    const suivi = suivrePage(null, observee(vueDe(237)));
    assert.equal(changerDePage(suivi, 0).page, 1);
    assert.equal(changerDePage(suivi, 7).page, 3);
    assert.equal(changerDePage(suivi, 2).page, 2);
  });

  test('rien de changé — mêmes propositions, même visée — : le suivi retenu lui-même, que l’état de navigation ne republie pas', () => {
    const vue = vueDe(237);
    const choisie = changerDePage(suivrePage(null, observee(vue, { vise: 1150, visee: 4 })), 3);
    assert.equal(suivrePage(choisie, observee(vue, { vise: 1150, visee: 4 })), choisie);
    assert.ok(Object.isFrozen(choisie));
    assert.notEqual(suivrePage(choisie, observee(vueDe(150), { vise: 1150, visee: 4 })), choisie);
  });

  test('moins de propositions, sans aucune nouvelle — un effacement, un retour : la page se borne à la dernière', () => {
    const choisie = changerDePage(suivrePage(null, observee(vueDe(237))), 3);
    const apres = suivrePage(choisie, observee(vueDe(150)));
    assert.equal(apres.page, 2);
    assert.equal(suivrePage(choisie, observee(vueDe(1))).page, 1);
    assert.equal(suivrePage(choisie, observee(vueDe(201))).page, 3);
  });

  test('une proposition nouvelle — une génération — ramène à la première page, même quand le compte baisse', () => {
    const choisie = changerDePage(suivrePage(null, observee(vueDe(237))), 2);
    assert.equal(suivrePage(choisie, observee(vueDe(300))).page, 1);
    const moins = suivrePage(choisie, observee(vueDe(150)));
    assert.equal(moins.page, 2);
    // Un retour qui retire des propositions, puis une génération qui réattribue
    // leurs identifiants sous d'autres graines : des identifiants déjà vus,
    // des propositions nouvelles, donc la première.
    assert.equal(suivrePage(choisie, observee(vueDe(150), { graine: 5000 })).page, 1);
    assert.equal(suivrePage(choisie, observee(vueDe(150), { arret: 41 })).page, 1);
    assert.equal(suivrePage(choisie, observee(vueDe(150), { historique: 1001 })).page, 1);
  });

  test('des clés qui changent sans changer le compte de pages sont retenues : le retour des propositions retirées ramène à la première page', () => {
    const choisie = changerDePage(suivrePage(null, observee(vueDe(250))), 2);
    const apres = suivrePage(choisie, observee(vueDe(220)));
    assert.deepEqual([apres.page, apres.cles.length], [2, 220]);
    assert.equal(suivrePage(apres, observee(vueDe(250))).page, 1);
  });

  test('une proposition visée depuis ailleurs, sur une autre page, amène sa page ; même numéro de visée, la page choisie reste', () => {
    const vue = vueDe(237);
    const choisie = changerDePage(suivrePage(null, observee(vue)), 3);
    const visee = suivrePage(choisie, observee(vue, { vise: 1150, visee: 1 }));
    assert.equal(visee.page, 2);
    const ailleurs = changerDePage(visee, 3);
    assert.equal(suivrePage(ailleurs, observee(vue, { vise: 1150, visee: 1 })).page, 3);
    assert.equal(suivrePage(ailleurs, observee(vue, { vise: null, visee: 1 })).page, 3);
    assert.equal(suivrePage(ailleurs, observee(vue, { vise: 999, visee: 2 })).page, 3, 'une proposition absente n’amène rien');
    assert.equal(suivrePage(null, observee(vue, { vise: 1201, visee: 1 })).page, 3);
  });

  test('la même proposition visée de nouveau — un autre numéro de visée — amène encore sa page ; une visée retirée n’amène rien', () => {
    const vue = vueDe(237);
    const ailleurs = changerDePage(suivrePage(null, observee(vue, { vise: 1150, visee: 1 })), 3);
    assert.equal(ailleurs.page, 3);
    assert.equal(suivrePage(ailleurs, observee(vue, { vise: 1150, visee: 2 })).page, 2);
    assert.equal(suivrePage(ailleurs, observee(vue, { vise: 1150, visee: 7 })).page, 2);
    assert.equal(suivrePage(ailleurs, observee(vue, { vise: null, visee: 2 })).page, 3);
  });
});

describe('pagination : le texte de l’étendue (libelles/propositions.js)', () => {
  test('« Propositions 101 à 200 sur 237 », au singulier pour une page d’une seule proposition ; des chiffres déjà mis en forme', () => {
    const etendue = (premier, dernier, total) =>
      t('propositions.pages.etendue', {
        premier: format.nombre(premier),
        dernier: format.nombre(dernier),
        total: format.nombre(total),
        nombre: dernier - premier + 1,
      });
    assert.equal(etendue(101, 200, 237), 'Propositions 101 à 200 sur 237');
    assert.equal(etendue(201, 201, 201), 'Proposition 201 sur 201');
    assert.equal(etendue(1, 100, 1500), `Propositions 1 à 100 sur ${format.nombre(1500)}`);
    assert.equal(t('propositions.pages.precedentes'), 'Précédentes');
    assert.equal(t('propositions.pages.suivantes'), 'Suivantes');
    assert.notEqual(t('propositions.pages.haut'), t('propositions.pages.bas'));
  });

  test('texteEtendue met en forme les nombres de la page par format.nombre : la page 11 de 1 500, « Propositions 1 001 à 1 100 sur 1 500 »', () => {
    const fine = '\u{202F}';
    assert.equal(texteEtendue(pagine(vueDe(1500), 11), { t, format }), `Propositions 1${fine}001 à 1${fine}100 sur 1${fine}500`);
    assert.equal(texteEtendue(pagine(vueDe(1101), 12), { t, format }), `Proposition 1${fine}101 sur 1${fine}101`);
    assert.equal(texteEtendue(pagine(vueDe(237), 2), { t, format }), 'Propositions 101 à 200 sur 237');
  });
});

describe('lireColonne : la mesure d’une ligne par le nom de sa colonne (§ 12.2, D48)', () => {
  // Les colonnes de mesure, dans l'ordre de COLONNES : celles qu'un groupe
  // d'en-têtes couvre, puis le certificat.
  const MESURES = [...GROUPES_COLONNES.filter(({ cle }) => cle !== null).flatMap(({ colonnes }) => colonnes), 'certificat'];

  test('chaque colonne que le tableau porte : la cellule même du tableau, valeur, clé et décimales ; le retenu aussi', () => {
    let charge = generee(petiteAObjectifs(), { graine: 3, nombre: 2, arret: 200 });
    charge = executer(charge, 'retenirProposition', { id: 2 });
    const table = evaluer(charge);
    const vue = tableau(table);
    const lignes = [...vue.lignes.map((ligne, rang) => [ligne, table.propositions[rang]]), [vue.retenu, table.retenu]];
    let lues = 0;
    for (const [ligne, source] of lignes) {
      for (const attendue of ligne.cellules) {
        assert.deepEqual(lireColonne(source, attendue.colonne), attendue, attendue.colonne);
        lues += 1;
      }
    }
    assert.equal(lues, 3 * (COLONNES_PAR_DEFAUT.length - 4 + 2));
  });

  test('une colonne que le tableau ne porte pas, critère décoché : la même mesure, lue dans la ligne', () => {
    const table = evaluer(generee(petiteAObjectifs({ respecterObjectifs: false, modeObjectifs: 'chacun' }), { graine: 3, nombre: 2, arret: 200 }));
    const [source] = table.propositions;
    assert.ok(!tableau(table).colonnes.some(({ nom }) => SIXIEME.includes(nom)));
    const { objectifs } = source.mesures;
    assert.deepEqual(lireColonne(source, 'jamaisServies'), { colonne: 'jamaisServies', valeur: objectifs.jamaisServies, cle: null, decimales: 0 });
    assert.equal(lireColonne(source, 'horsObjectifMax').valeur, objectifs.horsObjectifMax);
    assert.equal(lireColonne(source, 'toursHorsObjectif').valeur, objectifs.horsObjectif);
    assert.equal(lireColonne(source, 'toursSelonObjectif').valeur, objectifs.agregat.tous.min);
    // Sans personne concernée par les animateurs, la mesure manque : « — ».
    assert.deepEqual(lireColonne(source, 'animateursRencontres'), { colonne: 'animateursRencontres', valeur: null, cle: 'format.vide', decimales: 0 });
  });

  test('a priori inconnu : « inconnu » sous les deux colonnes de l’a priori, comme au tableau ; le taux de diversité au centième', () => {
    const charge = generee(chargeDemo('petite'), { graine: 2, nombre: 1, arret: 300 });
    const table = evaluer(charge, { plafondsAPriori: null });
    const [ligne] = tableau(table).lignes;
    const [source] = table.propositions;
    for (const nom of ['ecartItineraireMax', 'ecartAuPlafondAPriori']) {
      assert.deepEqual(lireColonne(source, nom), cellule(ligne, nom), nom);
      assert.equal(lireColonne(source, nom).cle, 'propositions.valeur.inconnu', nom);
    }
    assert.equal(lireColonne(source, 'diversite').decimales, 2);
    assert.equal(texte(lireColonne(source, 'certificat')), 'atteignabilité inconnue');
  });

  test('chaque colonne de mesure se lit ; une colonne qui n’est pas une mesure, ou inconnue, lève ; la table des lectures reste privée', () => {
    const [source] = evaluer(generee(chargeSix(), { graine: 1, nombre: 1, arret: 100 })).propositions;
    for (const nom of MESURES) assert.equal(lireColonne(source, nom).colonne, nom);
    for (const nom of ['rang', 'proposition', 'imposes', 'commandes', 'inconnue']) {
      assert.throws(() => lireColonne(source, nom), TypeError, nom);
    }
    assert.equal(Object.hasOwn(MODELE, 'LECTURES'), false);
  });
});

// --- Les présences partielles et les lignes qui servent de départ ------------------

describe('tableau : chaque ligne dit si elle sert de départ (§ 5.7, § 9)', () => {
  const conflit = () => avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);

  test('sertDeDepart recopié de la table : comparable, vrai ; en dérive par les seuls participants, vrai ; en dérive par le mobilier ou fautive, faux', () => {
    const comparables = tableau(evaluer(conflit()));
    assert.deepEqual(comparables.lignes.map(({ id, sertDeDepart }) => [id, sertDeDepart]), [[3, true], [2, true], [1, true]]);

    const absente = executer(conflit(), 'changerPresence', { id: 1, tours: [1, 2] });
    const parPresence = tableau(evaluer(absente));
    assert.deepEqual(parPresence.lignes, []);
    assert.deepEqual(parPresence.horsClassement.map(({ id, comparable, sertDeDepart }) => [id, comparable, sertDeDepart]), [[1, false, true], [2, false, true], [3, false, true]]);
    assert.deepEqual(parPresence.horsClassement[0].raisons.map(({ cle }) => cle), ['PRESENCE_RETIREE']);

    const exclue = tableau(evaluer(executer(conflit(), 'exclureParticipant', { id: 4 })));
    assert.ok(exclue.horsClassement.every(({ sertDeDepart }) => sertDeDepart));

    const table = [...conflit().tables].sort((a, b) => a.id - b.id)[0];
    const meublee = executer(absente, 'changerPlacesTable', { id: table.id, sieges: '4', origine: 'champ' });
    const parMobilier = tableau(evaluer(meublee));
    assert.deepEqual(parMobilier.horsClassement.map(({ sertDeDepart }) => sertDeDepart), [false, false, false]);

    const fautive = structuredClone(conflit());
    fautive.propositions[0].placement[0].sieges[0] = [2, 2, 10];
    const lignes = tableau(evaluer(fautive)).horsClassement;
    assert.deepEqual(lignes.map(({ id, statut, sertDeDepart }) => [id, statut, sertDeDepart]), [[1, 'propositions.statut.fautif', false]]);
  });
});

describe('notePresences : la note des présences partielles, au-dessus du tableau (§ 5.7)', () => {
  const conflit = () => avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
  const note = (charge) => notePresences(charge, tableau(evaluer(charge)));
  const textes = (phrases) => phrases.map(({ cle, details }) => t(cle, details));

  test('sans présence partielle, et sans tableau, rien', () => {
    assert.deepEqual(note(conflit()), []);
    assert.deepEqual(notePresences(conflit(), null), []);
  });

  test('une présence partielle, toutes les lignes en dérive par elle : le compte, puis « Aucune proposition n’est classée », qui nomme « Repartir d’elle »', () => {
    const charge = executer(conflit(), 'changerPresence', { id: 1, tours: [1, 2] });
    assert.deepEqual(note(charge), [
      { cle: 'propositions.presences.note', details: { absentes: 1 } },
      { cle: 'propositions.presences.toutesEnDerive', details: {} },
    ]);
    assert.deepEqual(textes(note(charge)), [
      "1 personne n'est pas présente à chaque tour : chaque chiffre se lit sur ses tours de présence.",
      "Aucune proposition n'est classée : les participants ont changé depuis leur calcul. « Repartir d'elle », " +
        "dans le menu d'une ligne, en génère des propositions dérivées qui suivent la soirée telle qu'elle est.",
    ]);
  });

  test('deux présences partielles et une proposition classée depuis : le compte seul, au pluriel ; une exclue ne compte pas', () => {
    let charge = executer(conflit(), 'changerPresence', { id: 1, tours: [1, 2] });
    charge = executer(charge, 'changerPresence', { id: 2, tours: [3, 4] });
    charge = executer(executer(charge, 'changerPresence', { id: 3, tours: [4] }), 'exclureParticipant', { id: 3 });
    charge = generee(charge, { graine: 1, nombre: 1, arret: 200 });
    assert.deepEqual(note(charge), [{ cle: 'propositions.presences.note', details: { absentes: 2 } }]);
    assert.deepEqual(textes(note(charge)), [
      '2 personnes ne sont pas présentes à chaque tour : chaque chiffre se lit sur leurs tours de présence.',
    ]);
  });

  test('toutes les lignes en dérive, aucune ne servant de départ — le mobilier a changé — : rien ; une exclusion sans présence partielle : la seconde phrase seule', () => {
    const table = [...conflit().tables].sort((a, b) => a.id - b.id)[0];
    assert.deepEqual(note(executer(conflit(), 'changerPlacesTable', { id: table.id, sieges: '4', origine: 'champ' })), []);
    assert.deepEqual(note(executer(conflit(), 'exclureParticipant', { id: 4 })), [{ cle: 'propositions.presences.toutesEnDerive', details: {} }]);
  });
});

describe('les explications des colonnes de l’itinéraire : la présence (§ 5.5)', () => {
  test('l’écart d’itinéraire et l’écart au plafond a priori se lisent sur les tours de présence', () => {
    for (const nom of ['ecartItineraireMax', 'ecartAuPlafondAPriori']) {
      const texte = t(explicationDeColonne(nom));
      assert.match(texte, /sur ses tours de présence ; un tour d'absence n'y compte pas/, nom);
    }
  });
});

describe('garder les meilleures sans classement (§ 5.7)', () => {
  const conflit = () => avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
  const figee = (charge) => Object.freeze(structuredClone(charge));
  // Le refus de garderMeilleures {n} sur la charge, null quand il aboutit.
  function refusDuGeste(charge, n) {
    try {
      appliquerCommande('garderMeilleures', charge, { n });
      return null;
    } catch (erreur) {
      return erreur.code;
    }
  }

  test('toutes les lignes déclassées par la présence : NETTOYAGE_SANS_CLASSEMENT, et le geste part sans fenêtre, son refus posé à côté du bouton', () => {
    const charge = figee(executer(conflit(), 'changerPresence', { id: 1, tours: [1, 2] }));
    assert.equal(refusDuGeste(charge, 1), 'NETTOYAGE_SANS_CLASSEMENT');
    assert.equal(demandeNettoyage({ refus: null, charge }, 1), null);
  });

  test('la fenêtre s’ouvre exactement quand le geste aboutirait, sur des tables classées, déclassées, mêlées, et sous un retenu', () => {
    const absente = executer(conflit(), 'changerPresence', { id: 1, tours: [1, 2] });
    const charges = [
      conflit(),
      absente,
      generee(absente, { graine: 1, nombre: 2, arret: 200 }),
      executer(executer(conflit(), 'retenirProposition', { id: 1 }), 'changerPresence', { id: 2, tours: [3, 4] }),
      executer(conflit(), 'exclureParticipant', { id: 4 }),
    ];
    let fenetres = 0;
    let refusSansClassement = 0;
    for (const [rang, charge] of charges.entries()) {
      for (let n = 1; n <= 5; n += 1) {
        const refus = refusDuGeste(charge, n);
        const demande = demandeNettoyage({ refus: null, charge: figee(charge) }, n);
        assert.equal(demande === null, refus !== null, `charge ${rang}, n = ${n} : ${refus}`);
        if (demande !== null) fenetres += 1;
        if (refus === 'NETTOYAGE_SANS_CLASSEMENT') refusSansClassement += 1;
      }
    }
    assert.ok(fenetres >= 3, `${fenetres} fenêtres`);
    assert.ok(refusSansClassement >= 3, `${refusSansClassement} refus sans classement`);
  });
});
