// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des énoncés du diagnostic (§ 5.4, § 5.5, § 5.6, § 12.10.4,
// § 15.1, § 15.3, § 15.4) : chaque énoncé porte les chiffres que rend
// diagnostiquer, sollicité une seconde fois (§ 19.1), et la clé de son
// remède ; le texte se lit par la même traduction que celle de
// l'application. Les charges partent des démonstrations livrées ou se
// construisent ici, sur des noms inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { diagnostiquerCharge } from '../../application/diagnostic.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { presencesPartielles } from '../../application/places.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { diagnostiquer } from '../../moteur/diagnostic.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cartesDiagnostic, criteresDuDiagnostic, enonces, numeroDeCharge } from './phrases.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const TIRET = '\u{2014}';

// --- Les charges d'épreuve ---------------------------------------------------------

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

/**
 * Une charge construite : une personne par appartenance donnée (null : sans
 * appartenance), d'identifiants 1 à N ; une table par capacité, d'identifiant
 * 1 à T et de numéro numeros[rang] (rang + 1 par défaut) ; les réservations
 * de portée « tous les tours », sans siège, données en [participant, table].
 */
function chargeDe({ appartenances, capacites, tours = 4, ancres = [], separer = true, numeros = null }) {
  const charge = creerCharge({ id: 'evt-diagnostic', nom: 'Soirée des Merles', siegesParDefaut: 3, tours });
  charge.participants = appartenances.map((appartenance, rang) => ({
    id: rang + 1,
    nom: `Ombrelle${rang + 1}`,
    prenom: 'Iris',
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = capacites.map((sieges, rang) => ({
    id: rang + 1,
    numero: numeros === null ? rang + 1 : numeros[rang],
    sieges,
    forme: 'ronde',
    position: { x: 300 * rang, y: 0 },
  }));
  charge.reservations = ancres.map(([participant, table]) => ({ participant, table, siege: null, portee: 'tous', tour: null }));
  charge.reglages.separerAppartenances = separer;
  charge.prochainsIds = { participant: appartenances.length + 1, table: capacites.length + 1, proposition: 1 };
  return charge;
}

const fois = (n, valeur) => Array(n).fill(valeur);

/**
 * Une charge d'objectifs (§ 4.5, A10) : n personnes qui portent
 * « finance », une table 1 de 8 places qui la vise pour la soirée, puis des
 * tables sans objectif aux capacités données, quatre tours. mode : le mode
 * des objectifs, absent au défaut ; respecter faux décoche le critère.
 */
function chargeObjectifs(n, autres, { mode = null, respecter = true } = {}) {
  const charge = chargeDe({ appartenances: fois(n, null), capacites: [8, ...autres] });
  for (const participant of charge.participants) participant.etiquettes = ['finance'];
  charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  if (mode !== null) charge.reglages.modeObjectifs = mode;
  if (!respecter) charge.reglages.respecterObjectifs = false;
  return charge;
}

// Le diagnostic d'une charge, par l'application, et ses énoncés, sous l'état
// des critères que l'écran lit pour les objectifs.
function lire(charge) {
  const { diagnostic, erreur } = diagnostiquerCharge(charge);
  assert.equal(erreur, null);
  const criteres = criteresDuDiagnostic(charge, diagnostic);
  const absentes = presencesPartielles(charge).length;
  return { diagnostic, liste: enonces(diagnostic, { numeroDe: numeroDeCharge(charge), tours: charge.evenement.tours, criteres, absentes }) };
}

const cles = (liste) => liste.map(({ cle }) => cle);
const avecCle = (liste, cle) => liste.filter((enonce) => enonce.cle === cle);
const texte = ({ cle, details }) => t(cle, details);

// Les configurations nommées de l'épreuve.
const CONFIGURATIONS = {
  // 28 personnes en 18 appartenances, dix de 2 et huit de 1, quatre tables
  // de 7, quatre tours : la redondance du remède en tours (M1).
  redondance: () =>
    chargeDe({
      appartenances: [
        ...Array.from({ length: 10 }, (_, g) => fois(2, `Cercle ${g + 1}`)).flat(),
        ...Array.from({ length: 8 }, (_, g) => `Atelier ${g + 1}`),
      ],
      capacites: fois(4, 7),
    }),
  // Quatre tables de 3, quatre tours, un animateur par table, tous du Club
  // des Merles ; les huit autres sans appartenance.
  animateurs: () =>
    chargeDe({
      appartenances: [...fois(4, 'Club des Merles'), ...fois(8, null)],
      capacites: fois(4, 3),
      ancres: [[1, 1], [2, 2], [3, 3], [4, 4]],
    }),
  // Table 1, numérotée 7 : 3 places, 3 ancrés ; table 2, numérotée 8 :
  // 4 places, 2 ancrés ; table 3, numérotée 9 : 4 places, aucun.
  ancrage: () =>
    chargeDe({
      appartenances: fois(10, null),
      capacites: [3, 4, 4],
      numeros: [7, 8, 9],
      ancres: [[1, 1], [2, 1], [3, 1], [4, 2], [5, 2]],
    }),
  // Trois membres d'une appartenance, deux tables de 2, quatre tours.
  excedent: () => chargeDe({ appartenances: fois(3, 'Grisaille'), capacites: [2, 2] }),
  // Deux membres réservés à la même table : aucune table ajoutée ne les
  // sépare.
  memeTable: () =>
    chargeDe({ appartenances: [...fois(2, 'Grisaille'), ...fois(4, null)], capacites: [3, 3], ancres: [[1, 1], [2, 1]] }),
  // Treize personnes, quatre tables de 3.
  manque: () => chargeDe({ appartenances: fois(13, null), capacites: fois(4, 3) }),
  // Douze personnes en deux appartenances de six, quatre tables de 3.
  toutesEnConflit: () =>
    chargeDe({
      appartenances: Array.from({ length: 12 }, (_, p) => (p % 2 === 0 ? 'Club des Merles' : 'Cercle des Hérons')),
      capacites: fois(4, 3),
    }),
  // Douze personnes d'une seule appartenance, séparation active.
  uneSeule: () => chargeDe({ appartenances: fois(12, 'Club des Merles'), capacites: fois(4, 3) }),
  // Huit personnes en deux appartenances de quatre, une table de 8, un tour.
  unTour: () => chargeDe({ appartenances: [...fois(4, 'Grisaille'), ...fois(4, 'Club des Merles')], capacites: [8], tours: 1 }),
  petite: () => chargeDemo('petite'),
  petiteConflit: () => chargeDemo('petite-conflit'),
  grande: () => chargeDemo('grande'),
  grandeSansException: () => chargeDemo('grande-sans-exception'),
  // Dix personnes « finance », une table « finance » de 8, une table de 2
  // sans objectif, quatre tours (A10).
  objectifs: () => chargeObjectifs(10, [2]),
};

// --- Chaque champ, son énoncé ------------------------------------------------------

// Pour chaque champ du diagnostic : ce qui le rend non nul, et les énoncés
// qu'il appelle alors — la clé et les détails exacts, tirés du diagnostic
// même ; numero vient de numeroDe, tours de la charge.
const SEPARATION = {
  cle: 'diagnostic.remede.separation',
  details: {},
  commande: 'modifierReglage',
  arguments: { cle: 'separerAppartenances', valeur: false },
};
const remedeCollisions = ({ tablesManquantes }) =>
  tablesManquantes === null
    ? { cle: 'diagnostic.remede.redistribuer', details: {} }
    : { cle: 'diagnostic.remede.tables', details: { tablesManquantes } };

const CHAMPS = [
  {
    champ: 'uneSeuleAppartenance',
    attendus: (d) => (d.uneSeuleAppartenance ? [{ cle: 'diagnostic.uneSeuleAppartenance', details: {}, remede: SEPARATION }] : []),
  },
  {
    champ: 'collisionPartout',
    attendus: (d) => (d.collisionPartout ? [{ cle: 'diagnostic.collisionPartout', details: {}, remede: SEPARATION }] : []),
  },
  {
    champ: 'collisions',
    attendus: (d, tours) =>
      d.collisions.map((ligne) => ({
        cle: 'diagnostic.collisions',
        details: {
          groupe: ligne.groupe,
          effectif: ligne.effectif,
          plancherCumulees: ligne.plancherCumulees,
          plancherPairesDistinctes: ligne.plancherPairesDistinctes,
          tours,
        },
        remede: remedeCollisions(ligne),
      })),
  },
  {
    champ: 'collisions[].plancherExcedent',
    attendus: (d) =>
      d.collisions
        .filter(({ plancherExcedent }) => plancherExcedent !== null)
        .map((ligne) => ({
          cle: 'diagnostic.excedent',
          details: { groupe: ligne.groupe, plancherExcedent: ligne.plancherExcedent },
          remede: remedeCollisions(ligne),
        })),
  },
  {
    champ: 'redondanceMinimale',
    attendus: (d, tours) =>
      d.redondanceMinimale === null || d.redondanceMinimale === 0
        ? []
        : [
            {
              cle: 'diagnostic.redondance',
              details: { redondanceMinimale: d.redondanceMinimale },
              remede:
                d.remedes.toursSansRedondance === null
                  ? { cle: 'diagnostic.remede.appartenances', details: {} }
                  : { cle: 'diagnostic.remede.tours', details: { toursSansRedondance: d.remedes.toursSansRedondance, tours } },
            },
          ],
  },
  {
    champ: 'animateursMemeAppartenance',
    attendus: (d) =>
      d.animateursMemeAppartenance && d.redondanceImposeeParAnimateurs > 0
        ? [
            {
              cle: 'diagnostic.animateurs',
              details: { redondanceImposeeParAnimateurs: d.redondanceImposeeParAnimateurs },
              remede: { cle: 'diagnostic.remede.animateurs', details: {} },
            },
          ]
        : [],
  },
  {
    champ: 'ancrage',
    attendus: (d, _tours, numeroDe) =>
      d.ancrage
        .filter(({ gelee, moitie }) => gelee || moitie)
        .map(({ table, ancres, capacite, gelee }) => ({
          cle: gelee ? 'diagnostic.ancrage.gelee' : 'diagnostic.ancrage.moitie',
          details: { numero: numeroDe(table), ancres, capacite },
          remede: { cle: 'diagnostic.remede.ancrage', details: {} },
        })),
  },
  {
    champ: 'ecartItineraire',
    attendus: (d) =>
      d.ecartItineraire === null
        ? []
        : [
            {
              cle: 'diagnostic.ecartItineraire',
              details: { plancher: d.ecartItineraire.plancher, mobilesAuMoins: d.ecartItineraire.mobilesAuMoins },
              remede: { cle: 'diagnostic.remede.ecartItineraire', details: {} },
            },
          ],
  },
  {
    champ: 'placesManquantes',
    attendus: (d) =>
      d.placesManquantes > 0
        ? [
            {
              cle: 'diagnostic.placesManquantes',
              details: { placesManquantes: d.placesManquantes },
              remede: { cle: 'diagnostic.remede.places', details: {} },
            },
          ]
        : [],
  },
  {
    // Sous le mode par défaut, « le plus de places servies », le seul
    // plancher que le mode compare : les tours hors objectif.
    champ: 'objectifsInevitables',
    attendus: (d) =>
      d.objectifsInevitables.horsObjectif > 0
        ? [
            {
              cle: 'diagnostic.objectifs.toursHorsObjectif',
              details: { plancher: d.objectifsInevitables.horsObjectif },
              remede: { cle: 'diagnostic.remede.objectifs', details: {} },
              grandeur: 'toursHorsObjectif',
            },
          ]
        : [],
  },
  {
    champ: 'plafondAPriori',
    attendus: (d) =>
      d.plafondAPriori.repartition.length === 0
        ? [{ cle: 'diagnostic.plafondInconnu', details: {}, remede: null }]
        : d.plafondAPriori.repartition.map(({ valeur, ancres, mobiles }) => ({
            cle: 'diagnostic.plafond',
            details: { valeur, ancres, mobiles },
            remede: { cle: 'diagnostic.remede.plafond', details: {} },
          })),
  },
  {
    champ: 'retoursImposes',
    attendus: (d) =>
      d.retoursImposes > 0
        ? [
            {
              cle: 'diagnostic.imposes',
              details: { retoursImposes: d.retoursImposes, ancragesImposantRetours: d.ancragesImposantRetours },
              remede: { cle: 'diagnostic.remede.imposes', details: {} },
            },
          ]
        : [],
  },
];

describe('enonces : chaque champ a son énoncé', () => {
  test('sur la suite des configurations, chaque champ non nul a ses énoncés, dans l\u{2019}ordre, et rien d\u{2019}autre', () => {
    const exerces = new Set();
    for (const [nom, construire] of Object.entries(CONFIGURATIONS)) {
      const charge = construire();
      const { diagnostic, liste } = lire(charge);
      const numeroDe = numeroDeCharge(charge);
      // Le moteur, sollicité une seconde fois, sur la même configuration.
      const moteur = diagnostiquer(configurationDepuisCharge(charge));
      const attendue = CHAMPS.flatMap(({ champ, attendus }) => {
        const lignes = attendus(moteur, charge.evenement.tours, numeroDe);
        if (lignes.length > 0 && !(champ === 'plafondAPriori' && moteur.plafondAPriori.repartition.length === 0)) {
          exerces.add(champ);
        }
        return lignes;
      });
      assert.ok(attendue.length > 0, nom);
      assert.deepEqual(liste, attendue, nom);
      assert.deepEqual(diagnostic, moteur, nom);
      for (const enonce of liste) {
        // Chaque texte existe ; chaque énoncé d'un champ non nul a un remède.
        assert.equal(typeof texte(enonce), 'string');
        if (enonce.cle !== 'diagnostic.plafondInconnu') assert.notEqual(enonce.remede, null, enonce.cle);
        if (enonce.remede !== null) assert.equal(typeof texte(enonce.remede), 'string');
      }
    }
    assert.deepEqual([...exerces].sort(), CHAMPS.map(({ champ }) => champ).sort());
  });

  test('collisionPartout vrai : l\u{2019}énoncé et son remède, exécutable par modifierReglage', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.toutesEnConflit());
    assert.equal(diagnostic.collisionPartout, true);
    assert.deepEqual(avecCle(liste, 'diagnostic.collisionPartout'), [
      {
        cle: 'diagnostic.collisionPartout',
        details: {},
        remede: {
          cle: 'diagnostic.remede.separation',
          details: {},
          commande: 'modifierReglage',
          arguments: { cle: 'separerAppartenances', valeur: false },
        },
      },
    ]);
  });
});

describe('enonces : les phrases du § 5.6', () => {
  test('collisions : la petite au conflit inévitable, le groupe de 5, ses deux planchers et leurs unités', () => {
    const charge = CONFIGURATIONS.petiteConflit();
    const { diagnostic, liste } = lire(charge);
    const [ligne] = diagnostic.collisions;
    assert.equal(diagnostic.collisions.length, 1);
    const [enonce] = avecCle(liste, 'diagnostic.collisions');
    assert.equal(enonce.details.effectif, 5);
    assert.equal(enonce.details.plancherCumulees, ligne.plancherCumulees);
    assert.equal(enonce.details.plancherPairesDistinctes, ligne.plancherPairesDistinctes);
    assert.equal(enonce.details.groupe, ligne.groupe);
    const phrase = texte(enonce);
    assert.ok(phrase.includes('au moins 4 collisions cumulées sur les 4 tours, portées par au moins 1 paire distincte'), phrase);
    assert.ok(phrase.includes('5 personnes'), phrase);
    assert.ok(!phrase.includes(ligne.groupe), 'l\u{2019}appartenance occupe son propre nœud');
    assert.doesNotMatch(phrase, /\b4 paires?\b/);
    // Chaque chiffre nomme son unité.
    const nombres = [...phrase.matchAll(/\d+/g)];
    assert.equal(nombres.length, 4);
    for (const nombre of nombres) {
      assert.match(phrase.slice(nombre.index), /^\d+ (personnes?|collisions? cumulées?|tours?|paires? distinctes?)\b/, phrase);
    }
    // 4 ≤ C(5, 2) : aucun excédent.
    assert.equal(ligne.plancherExcedent, null);
    assert.equal(avecCle(liste, 'diagnostic.excedent').length, 0);
    assert.deepEqual(enonce.remede, { cle: 'diagnostic.remede.tables', details: { tablesManquantes: 1 } });
    assert.ok(texte(enonce.remede).includes('1 table'));
  });

  test('excédent : trois membres, deux tables, quatre tours — « excédent d\u{2019}au moins 1 », jamais un plancher nul', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.excedent());
    assert.equal(diagnostic.collisions[0].plancherExcedent, 1);
    const [enonce] = avecCle(liste, 'diagnostic.excedent');
    const phrase = texte(enonce);
    assert.ok(phrase.includes("excédent d'au moins 1 "), phrase);
    assert.doesNotMatch(phrase, /≥|\b0\b/);
    // Une configuration à excédent porte au moins un énoncé d'excédent, et
    // chacun un plancher positif.
    for (const cle of ['excedent', 'memeTable']) {
      const portes = avecCle(lire(CONFIGURATIONS[cle]()).liste, 'diagnostic.excedent');
      assert.ok(portes.length > 0, cle);
      for (const { details } of portes) assert.ok(details.plancherExcedent > 0, `${cle} : ${details.plancherExcedent}`);
    }
    // Une configuration sans excédent n'en porte aucun énoncé : chaque ligne
    // de collisions y a un plancher d'excédent null, jamais 0. Les deux
    // configurations en conflit ont au moins une ligne, la petite aucune.
    for (const [cle, avecCollisions] of [['petiteConflit', true], ['toutesEnConflit', true], ['petite', false]]) {
      const lu = lire(CONFIGURATIONS[cle]());
      assert.equal(avecCle(lu.liste, 'diagnostic.excedent').length, 0, cle);
      assert.equal(lu.diagnostic.collisions.length > 0, avecCollisions, cle);
      for (const ligne of lu.diagnostic.collisions) assert.equal(ligne.plancherExcedent, null, `${cle} : ${ligne.groupe}`);
    }
  });

  test('deux membres réservés à une même table : le remède redistribue, aucune table ne suffit', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.memeTable());
    assert.equal(diagnostic.collisions[0].tablesManquantes, null);
    const portes = [...avecCle(liste, 'diagnostic.collisions'), ...avecCle(liste, 'diagnostic.excedent')];
    assert.equal(portes.length, 2);
    for (const enonce of portes) {
      assert.deepEqual(enonce.remede, { cle: 'diagnostic.remede.redistribuer', details: {} });
    }
  });

  test('redondance : la configuration de M1 — au moins 6 appartenances recroisées ; avec 3 tours au lieu de 4, aucune', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.redondance());
    assert.equal(diagnostic.redondanceMinimale, 6);
    const [enonce] = avecCle(liste, 'diagnostic.redondance');
    assert.equal(texte(enonce), 'au moins 6 appartenances recroisées par personne');
    assert.equal(texte(enonce.remede), 'avec 3 tours au lieu de 4, aucune ne le serait');
  });

  test('redondance sans remède en tours : un seul tour, toursSansRedondance null', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.unTour());
    assert.ok(diagnostic.redondanceMinimale > 0);
    assert.equal(diagnostic.remedes.toursSansRedondance, null);
    const [enonce] = avecCle(liste, 'diagnostic.redondance');
    assert.deepEqual(enonce.remede, { cle: 'diagnostic.remede.appartenances', details: {} });
    assert.doesNotMatch(texte(enonce.remede), /\d/);
    for (const { remede } of liste) assert.notEqual(remede?.cle, 'diagnostic.remede.tours');
  });

  test('animateurs d\u{2019}une même appartenance : la phrase porte 3 et son remède ; absente de la grande', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.animateurs());
    assert.equal(diagnostic.redondanceImposeeParAnimateurs, 3);
    const [enonce] = avecCle(liste, 'diagnostic.animateurs');
    assert.ok(texte(enonce).includes('au moins 3 redondances'), texte(enonce));
    assert.equal(enonce.remede.cle, 'diagnostic.remede.animateurs');
    assert.ok(texte(enonce.remede).includes('sans appartenance déclarée'));
    assert.equal(avecCle(lire(CONFIGURATIONS.grande()).liste, 'diagnostic.animateurs').length, 0);
  });

  test('ancrage : une table de 3 à 3 ancrés ne tourne plus, par son numéro affiché ; une de 4 à 2 ancrés, 2 sur 4', () => {
    const { liste } = lire(CONFIGURATIONS.ancrage());
    const [gelee] = avecCle(liste, 'diagnostic.ancrage.gelee');
    const [moitie] = avecCle(liste, 'diagnostic.ancrage.moitie');
    assert.equal(avecCle(liste, 'diagnostic.ancrage.gelee').length, 1);
    assert.equal(avecCle(liste, 'diagnostic.ancrage.moitie').length, 1);
    assert.equal(texte(gelee), 'la table 7 ne tourne plus : ses 3 places sont ancrées');
    assert.deepEqual(moitie.details, { numero: 8, ancres: 2, capacite: 4 });
    assert.ok(texte(moitie).startsWith('la table 8 a 2 places ancrées sur 4'), texte(moitie));
  });

  test('écart d\u{2019}itinéraire : la grande, plancher 1, au moins 24 mobiles ; la petite, aucune mention, jamais 0', () => {
    const grande = lire(CONFIGURATIONS.grande());
    const [enonce] = avecCle(grande.liste, 'diagnostic.ecartItineraire');
    assert.deepEqual(enonce.details, grande.diagnostic.ecartItineraire);
    assert.ok(texte(enonce).includes('plancher 1, au moins 24 mobiles'), texte(enonce));
    for (const cle of ['petite', 'petiteConflit', 'grandeSansException']) {
      assert.equal(avecCle(lire(CONFIGURATIONS[cle]()).liste, 'diagnostic.ecartItineraire').length, 0, cle);
    }
  });

  test('manque de places : treize personnes, quatre tables de 3 — 1 place manque à chaque tour', () => {
    const [enonce] = avecCle(lire(CONFIGURATIONS.manque()).liste, 'diagnostic.placesManquantes');
    assert.equal(texte(enonce), '1 place manque à chaque tour');
  });

  test('plafond a priori : la grande, 24 pour les 4 ancrés, 28 pour 29 ancrés et 227 mobiles, depuis repartition', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.grande());
    const plafonds = avecCle(liste, 'diagnostic.plafond');
    assert.deepEqual(
      plafonds.map(({ details }) => details),
      diagnostic.plafondAPriori.repartition,
    );
    assert.deepEqual(diagnostic.plafondAPriori.repartition, [
      { valeur: 24, ancres: 4, mobiles: 0 },
      { valeur: 28, ancres: 29, mobiles: 227 },
    ]);
    assert.equal(texte(plafonds[0]), 'plafond a priori 24 rencontres pour 4 ancrés');
    assert.equal(texte(plafonds[1]), 'plafond a priori 28 rencontres pour 29 ancrés et 227 mobiles');
  });

  test('imposés : la grande, « 99 retours imposés par 33 ancrages »', () => {
    const [enonce] = avecCle(lire(CONFIGURATIONS.grande()).liste, 'diagnostic.imposes');
    assert.equal(texte(enonce), '99 retours imposés par 33 ancrages');
  });

  test('une seule appartenance : la phrase, puis le remède qui désactive la séparation', () => {
    const { liste } = lire(CONFIGURATIONS.uneSeule());
    assert.equal(liste[0].cle, 'diagnostic.uneSeuleAppartenance');
    assert.deepEqual(liste[0].remede, SEPARATION);
  });
});

describe('enonces : les planchers des objectifs (§ 5.6, A10, D16, D20)', () => {
  // Les énoncés des objectifs d'une liste : grandeur, plancher et texte.
  const desObjectifs = (liste) =>
    liste.filter(({ cle }) => cle.startsWith('diagnostic.objectifs.')).map((enonce) => [enonce.grandeur, enonce.details.plancher, texte(enonce)]);

  test('dix personnes « finance », une table de 8, quatre tours : 8 tours hors objectif ; les deux autres planchers, nuls, se taisent sous chaque mode', () => {
    const { diagnostic, liste } = lire(chargeObjectifs(10, [2]));
    assert.deepEqual(diagnostic.objectifsInevitables, { horsObjectif: 8, jamaisServies: 0, horsObjectifMax: 1, parTour: [2, 2, 2, 2] });
    assert.deepEqual(desObjectifs(liste), [
      [
        'toursHorsObjectif',
        8,
        "au moins 8 tours hors objectif : les tables qui portent un objectif n'ont pas assez de places libres pour chaque tour possible",
      ],
    ]);
    // Sous « chacun au moins une fois », le plancher des personnes jamais
    // servies, nul, ne s'écrit pas.
    assert.deepEqual(desObjectifs(lire(chargeObjectifs(10, [2], { mode: 'chacun' })).liste).map(([grandeur]) => grandeur), ['toursHorsObjectif']);
    // Sous « l'équité d'abord », le plus de tours hors objectif d'une
    // personne vaut 1 : il s'écrit, avant les tours hors objectif.
    assert.deepEqual(desObjectifs(lire(chargeObjectifs(10, [2], { mode: 'minimum' })).liste), [
      ['horsObjectifMax', 1, 'au moins une personne passe au moins 1 tour hors objectif, quel que soit le placement'],
      [
        'toursHorsObjectif',
        8,
        "au moins 8 tours hors objectif : les tables qui portent un objectif n'ont pas assez de places libres pour chaque tour possible",
      ],
    ]);
  });

  test('quarante personnes « finance » : 128, 8 et 4 ; chaque mode écrit les planchers qu’il compare, dans l’ordre où il les compare, et jamais les autres', () => {
    const autres = fois(4, 8);
    const { diagnostic, liste } = lire(chargeObjectifs(40, autres));
    assert.deepEqual(diagnostic.objectifsInevitables, { horsObjectif: 128, jamaisServies: 8, horsObjectifMax: 4, parTour: [32, 32, 32, 32] });
    const grandeurs = (mode) => desObjectifs(lire(chargeObjectifs(40, autres, { mode })).liste).map(([grandeur, plancher]) => [grandeur, plancher]);
    assert.deepEqual(desObjectifs(liste).map(([grandeur, plancher]) => [grandeur, plancher]), [['toursHorsObjectif', 128]]);
    assert.deepEqual(grandeurs('chacun'), [
      ['jamaisServies', 8],
      ['toursHorsObjectif', 128],
    ]);
    assert.deepEqual(grandeurs('minimum'), [
      ['horsObjectifMax', 4],
      ['toursHorsObjectif', 128],
    ]);
    const [jamais] = desObjectifs(lire(chargeObjectifs(40, autres, { mode: 'chacun' })).liste);
    assert.equal(jamais[2], 'au moins 8 personnes jamais servies par une table à objectif, quel que soit le placement');
    for (const enonce of liste.filter(({ cle }) => cle.startsWith('diagnostic.objectifs.'))) {
      assert.deepEqual(enonce.remede, { cle: 'diagnostic.remede.objectifs', details: {} });
      assert.equal(typeof texte(enonce.remede), 'string');
    }
  });

  test('le critère des objectifs décoché : aucun plancher des objectifs, le diagnostic les calcule toujours', () => {
    const { diagnostic, liste } = lire(chargeObjectifs(40, fois(4, 8), { mode: 'chacun', respecter: false }));
    assert.equal(diagnostic.objectifsInevitables.horsObjectif, 128);
    assert.deepEqual(desObjectifs(liste), []);
  });

  test('criteresDuDiagnostic : sans plancher positif, aucune lecture des critères ; avec, l’état de chaque critère du registre', () => {
    const sans = CONFIGURATIONS.petite();
    assert.deepEqual(criteresDuDiagnostic(sans, diagnostiquerCharge(sans).diagnostic), []);
    const charge = chargeObjectifs(40, fois(4, 8), { mode: 'minimum' });
    const avant = structuredClone(charge);
    const criteres = criteresDuDiagnostic(charge, diagnostiquerCharge(charge).diagnostic);
    const objectifs = criteres.find(({ nom }) => nom === 'toursHorsObjectif');
    assert.deepEqual(objectifs, { nom: 'toursHorsObjectif', coche: true, sansObjet: false, valeurs: ['horsObjectifMax', 'toursHorsObjectif'] });
    assert.deepEqual(charge, avant);
  });

  test('sans état des critères, enonces n’écrit aucun plancher des objectifs', () => {
    const charge = chargeObjectifs(40, fois(4, 8));
    const { diagnostic } = diagnostiquerCharge(charge);
    const liste = enonces(diagnostic, { numeroDe: numeroDeCharge(charge), tours: 4 });
    assert.deepEqual(desObjectifs(liste), []);
  });
});

describe('enonces : aux bords', () => {
  test('un événement neuf, zéro participant, zéro table : aucun plancher, le plafond a priori « — », jamais 0', () => {
    const { liste } = lire(chargeDe({ appartenances: [], capacites: [] }));
    assert.deepEqual(liste, [{ cle: 'diagnostic.plafondInconnu', details: {}, remede: null }]);
    assert.ok(texte(liste[0]).includes(TIRET));
    assert.doesNotMatch(texte(liste[0]), /\d/);
  });

  test('deux personnes sans table : 2 places manquent à chaque tour', () => {
    const [enonce] = avecCle(lire(chargeDe({ appartenances: [null, null], capacites: [] })).liste, 'diagnostic.placesManquantes');
    assert.equal(texte(enonce), '2 places manquent à chaque tour');
  });

  test('aucune appartenance : ni collisions ni redondance', () => {
    const { liste } = lire(chargeDe({ appartenances: fois(12, null), capacites: fois(4, 3) }));
    assert.ok(liste.length > 0);
    for (const cle of ['diagnostic.collisions', 'diagnostic.excedent', 'diagnostic.redondance', 'diagnostic.uneSeuleAppartenance', 'diagnostic.collisionPartout']) {
      assert.equal(avecCle(liste, cle).length, 0, cle);
    }
  });

  test('numeroDeCharge : le numéro affiché d\u{2019}un identifiant de table ; un identifiant inconnu lève', () => {
    const numeroDe = numeroDeCharge(CONFIGURATIONS.ancrage());
    assert.deepEqual([1, 2, 3].map(numeroDe), [7, 8, 9]);
    assert.throws(() => numeroDe(4), RangeError);
  });

  test('enonces ne modifie pas le diagnostic reçu', () => {
    const charge = CONFIGURATIONS.ancrage();
    const { diagnostic } = diagnostiquerCharge(charge);
    const avant = structuredClone(diagnostic);
    enonces(diagnostic, { numeroDe: numeroDeCharge(charge), tours: 4 });
    assert.deepEqual(diagnostic, avant);
  });
});

describe('cartesDiagnostic : une carte par appartenance (§ 5.6, § 12.7)', () => {
  // La forme lisible d'une suite de cartes : genre, groupe, clés.
  const formes = (cartes) => cartes.map(({ genre, groupe, enonces: liste }) => [genre, groupe, cles(liste)]);

  test('deux appartenances en collision partout : la séparation, une carte par groupe, puis le reste de l\u{2019}événement', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.toutesEnConflit());
    assert.equal(diagnostic.collisionPartout, true);
    const cartes = cartesDiagnostic(liste);
    const groupes = diagnostic.collisions.map(({ groupe }) => groupe);
    assert.equal(groupes.length, 2);
    const reste = cles(liste).filter((cle) => !['diagnostic.collisionPartout', 'diagnostic.collisions', 'diagnostic.excedent'].includes(cle));
    assert.ok(reste.length > 0);
    assert.deepEqual(formes(cartes), [
      ['separation', null, ['diagnostic.collisionPartout']],
      ...groupes.map((groupe) => [
        'appartenance',
        groupe,
        cles(liste.filter(({ details }) => details.groupe === groupe)),
      ]),
      ['ensemble', null, reste],
    ]);
  });

  test('l\u{2019}excédent suit les collisions de son groupe, dans la même carte', () => {
    const { liste } = lire(CONFIGURATIONS.excedent());
    const [carte] = cartesDiagnostic(liste).filter(({ genre }) => genre === 'appartenance');
    assert.deepEqual([carte.groupe, cles(carte.enonces)], ['Grisaille', ['diagnostic.collisions', 'diagnostic.excedent']]);
  });

  test('l\u{2019}ordre des énoncés est celui d\u{2019}enonces, carte après carte, et chaque énoncé est le même objet', () => {
    for (const [nom, fabrique] of Object.entries(CONFIGURATIONS)) {
      const { liste } = lire(fabrique());
      const cartes = cartesDiagnostic(liste);
      const aplati = cartes.flatMap((carte) => carte.enonces);
      assert.equal(aplati.length, liste.length, nom);
      aplati.forEach((enonce, rang) => assert.equal(enonce, liste[rang], `${nom} : énoncé ${rang}`));
      // Deux cartes voisines ne se confondent pas.
      for (let rang = 1; rang < cartes.length; rang += 1) {
        const [a, b] = [cartes[rang - 1], cartes[rang]];
        assert.ok(a.genre !== b.genre || a.groupe !== b.groupe, `${nom} : cartes ${rang - 1} et ${rang}`);
      }
      for (const carte of cartes) assert.ok(carte.enonces.length > 0, nom);
    }
  });

  test('sans appartenance, une seule carte, celle de l\u{2019}événement ; aucun énoncé, aucune carte ; la liste reçue n\u{2019}est pas modifiée', () => {
    const { liste } = lire(CONFIGURATIONS.manque());
    const copie = structuredClone(liste);
    assert.deepEqual(formes(cartesDiagnostic(liste)), [['ensemble', null, cles(liste)]]);
    assert.deepEqual(liste, copie);
    assert.deepEqual(cartesDiagnostic([]), []);
  });

  test('une seule appartenance : sa phrase ouvre la carte de la séparation', () => {
    const { liste } = lire(CONFIGURATIONS.uneSeule());
    const [premiere] = cartesDiagnostic(liste);
    assert.equal(premiere.genre, 'separation');
    assert.equal(premiere.enonces[0].cle, 'diagnostic.uneSeuleAppartenance');
  });
});

describe('enonces : la présence par tour', () => {
  // Douze personnes, cinq d'une même appartenance, quatre tables de 3,
  // quatre tours ; presences : [rang, présence] des personnes partielles.
  function chargePresences(presences, { personnes = 12 } = {}) {
    const charge = chargeDe({ appartenances: [...fois(5, 'Grisaille'), ...fois(personnes - 5, null)], capacites: fois(4, 3) });
    for (const [rang, presence] of presences) charge.participants[rang].presence = presence;
    return charge;
  }

  test('deux présences partielles : l’énoncé ouvre la carte de l’événement, sans remède ; l’écart d’itinéraire ne s’énonce pas', () => {
    const { diagnostic, liste } = lire(chargePresences([[10, [1, 2]], [11, [3]]]));
    assert.deepEqual(diagnostic.planchersRetires, ['ecartItineraire']);
    const enonce = { cle: 'diagnostic.planchersRetires', details: { absentes: 2 }, remede: null };
    const rang = liste.findIndex(({ cle }) => cle === 'diagnostic.planchersRetires');
    assert.deepEqual(liste[rang], enonce);
    // Il suit les collisions de chaque appartenance et ouvre le reste.
    assert.ok(liste.slice(0, rang).every(({ details }) => details.groupe !== undefined), cles(liste).join(' | '));
    assert.ok(rang > 0);
    const cartes = cartesDiagnostic(liste);
    assert.equal(cartes.at(-1).genre, 'ensemble');
    assert.equal(cartes.at(-1).enonces[0], liste[rang]);
    assert.equal(cartes.filter(({ genre }) => genre === 'ensemble').length, 1);
    assert.equal(avecCle(liste, 'diagnostic.ecartItineraire').length, 0);
    assert.equal(
      texte(enonce),
      "2 personnes ne sont pas présentes à chaque tour : l'écart d'itinéraire n'a pas de plancher prouvé, et chaque chiffre se lit sur les tours de présence.",
    );
    assert.equal(
      t('diagnostic.planchersRetires', { absentes: 1 }),
      "1 personne n'est pas présente à chaque tour : l'écart d'itinéraire n'a pas de plancher prouvé, et chaque chiffre se lit sur les tours de présence.",
    );
  });

  test('sans présence partielle, ou sans compte reçu, aucun énoncé des planchers retirés', () => {
    const charge = chargePresences([]);
    assert.equal(avecCle(lire(charge).liste, 'diagnostic.planchersRetires').length, 0);
    const { diagnostic } = diagnostiquerCharge(chargePresences([[10, [1, 2]]]));
    assert.equal(avecCle(enonces(diagnostic, { numeroDe: numeroDeCharge(charge), tours: 4 }), 'diagnostic.planchersRetires').length, 0);
  });

  test('le manque de places : égal à chaque tour, le texte d’aujourd’hui ; deux tours égaux sur quatre, nommés ; deux manques, chacun ses tours', () => {
    // Treize personnes : une aux tours 1 et 2, une aux tours 3 et 4 — treize
    // présentes à chaque tour, 1 place manque partout.
    const egal = chargePresences([[11, [1, 2]]], { personnes: 13 });
    egal.participants.push({ ...egal.participants[12], id: 14, nom: 'Ombrelle14', presence: [3, 4] });
    egal.prochainsIds.participant = 15;
    const [partout] = avecCle(lire(egal).liste, 'diagnostic.placesManquantes');
    assert.deepEqual(partout.details, { placesManquantes: 1 });
    assert.equal(texte(partout), '1 place manque à chaque tour');
    // Quatorze personnes, deux aux tours 3 et 4 seulement.
    const [deux] = avecCle(lire(chargePresences([[12, [3, 4]], [13, [3, 4]]], { personnes: 14 })).liste, 'diagnostic.placesManquantes');
    assert.deepEqual(deux.details, { placesManquantes: 2, tours: [{ tour: 3, manque: 2 }, { tour: 4, manque: 2 }] });
    assert.equal(texte(deux), '2 places manquent aux tours 3 et 4');
    assert.deepEqual(deux.remede, { cle: 'diagnostic.remede.places', details: {} });
    // Quatorze personnes, une aux tours 3 et 4, une au tour 4.
    const [varie] = avecCle(lire(chargePresences([[12, [3, 4]], [13, [4]]], { personnes: 14 })).liste, 'diagnostic.placesManquantes');
    assert.deepEqual(varie.details, { placesManquantes: 2, tours: [{ tour: 3, manque: 1 }, { tour: 4, manque: 2 }] });
    assert.equal(texte(varie), '1 place manque au tour 3 et 2 places manquent au tour 4');
    // Quatorze personnes, une aux tours 2 à 4 : le manque varie sans jamais
    // tomber à zéro, chaque tour est nommé.
    const [positif] = avecCle(lire(chargePresences([[13, [2, 3, 4]]], { personnes: 14 })).liste, 'diagnostic.placesManquantes');
    assert.deepEqual(positif.details, {
      placesManquantes: 2,
      tours: [{ tour: 1, manque: 1 }, { tour: 2, manque: 2 }, { tour: 3, manque: 2 }, { tour: 4, manque: 2 }],
    });
    assert.equal(texte(positif), '1 place manque au tour 1 et 2 places manquent aux tours 2 à 4');
    assert.equal(
      t('diagnostic.placesManquantes', { placesManquantes: 2, tours: [{ tour: 1, manque: 2 }, { tour: 2, manque: 1 }, { tour: 4, manque: 2 }] }),
      '2 places manquent aux tours 1 et 4 et 1 place manque au tour 2',
    );
  });
});
