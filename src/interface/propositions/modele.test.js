// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { nomAffiche } from '../../application/personnes.js';
import { creerTraduction } from '../../application/traduction.js';
import { PLAN_PARFAIT_PETITE } from '../../demo/catalogue.js';
import { texteLivre } from '../../demo/livrees.js';
import { CRITERES, classer } from '../../moteur/classement.js';
import { indexerPlan, normaliser } from '../../moteur/configuration.js';
import { mesurer } from '../../moteur/indicateurs.js';
import { ecartsAuPlafondAPriori, minimumAtteint, troisChiffres } from '../../moteur/manque.js';
import { plafondsAPriori, plafondsRealises } from '../../moteur/plafond.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { planDepuisFichier } from '../../stockage/placements.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { COLONNES, demandeConfirmation, evaluation, nomDe, retenuAjuste, tableau, texteCellule } from './modele.js';

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

// Trois plans de la petite démonstration au conflit inévitable, nommés par
// leurs collisions (cumulées, distinctes), au même plus grand écart au
// plafond a priori : ceux de l'épreuve de la table d'évaluation (A6).
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
    assert.deepEqual(vue.colonnes, COLONNES);
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
  test('la phrase cite les cinq critères dans l’ordre, puis l’identifiant ; les trois plans d’A6 : (6, 6), (4, 2), (4, 1)', () => {
    const charge = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    const vue = tableau(evaluer(charge));
    assert.deepEqual(vue.lignes.map(({ id }) => id), [3, 2, 1]);
    assert.deepEqual(vue.ordre, [{ cle: 'propositions.ordre.criteres', details: { criteres: [...CRITERES] } }]);
    const phrase = t(vue.ordre[0].cle, vue.ordre[0].details);
    const positions = CRITERES.map((nom) => phrase.indexOf(t(`moteur.critere.${nom}`)));
    assert.equal(positions.length, 5);
    assert.ok(positions.every((position, rang) => position >= 0 && (rang === 0 || position > positions[rang - 1])), phrase);
    assert.ok(phrase.indexOf('identifiant') > positions[4], phrase);
  });

  test('a priori inconnu : la phrase nomme le critère sauté et « excédent de collisions » appliqué à sa place', () => {
    const charge = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    const vue = tableau(evaluer(charge, { plafondsAPriori: null }));
    assert.equal(vue.ordre.length, 2);
    assert.deepEqual(vue.ordre[0], {
      cle: 'propositions.ordre.saute',
      details: { saute: 'ecartAuPlafondAPrioriMax', applique: 'excedentCollisions' },
    });
    const saute = t(vue.ordre[0].cle, vue.ordre[0].details);
    assert.ok(saute.indexOf('écart au plafond a priori') >= 0 && saute.indexOf('excédent de collisions') > saute.indexOf('écart au plafond a priori'), saute);
    assert.equal(vue.ordre[1].details.criteres[0], 'excedentCollisions');
    for (const ligne of vue.lignes) assert.equal(texte(cellule(ligne, 'ecartItineraireMax')), 'inconnu');
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
    assert.equal(vue.etendueRaisons, COLONNES.length - 3);
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
