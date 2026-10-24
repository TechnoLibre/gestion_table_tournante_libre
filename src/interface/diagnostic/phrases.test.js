// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des énoncés du diagnostic (§ 5.4, § 5.5, § 5.6, § 12.10.4,
// § 15.1, § 15.3, § 15.4) : chaque énoncé porte les chiffres que rend
// diagnostiquer, sollicité une seconde fois (§ 19.1), et la clé de son
// remède ; son explication, « Concrètement » et « Pour changer cela », ne
// lit que ces chiffres et les capacités, présents et tours du diagnostic ;
// le texte se lit par la même traduction que celle de l'application. Les
// charges partent des démonstrations livrées ou se construisent ici, sur
// des noms inventés.
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
import { cartesDiagnostic, criteresDuDiagnostic, enonces, expliquer, numeroDeCharge, remedeAgit } from './phrases.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const TIRET = '\u{2014}';

// --- Les charges d'épreuve ---------------------------------------------------------

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

/**
 * Une charge construite : une personne par organisation donnée (null : sans
 * organisation), d'identifiants 1 à N ; une table par capacité, d'identifiant
 * 1 à T et de numéro numeros[rang] (rang + 1 par défaut) ; les réservations
 * de portée « tous les tours », sans siège, données en [participant, table] ;
 * conflits[rang], quand il est donné, la liste des conflits de la personne
 * rang + 1.
 */
function chargeDe({ organisations, capacites, tours = 4, ancres = [], separer = true, numeros = null, conflits = [] }) {
  const charge = creerCharge({ id: 'evt-diagnostic', nom: 'Soirée des Merles', siegesParDefaut: 3, tours });
  charge.participants = organisations.map((organisation, rang) => ({
    id: rang + 1,
    nom: `Ombrelle${rang + 1}`,
    prenom: 'Iris',
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(conflits[rang] ? { conflits: conflits[rang] } : {}),
  }));
  charge.tables = capacites.map((sieges, rang) => ({
    id: rang + 1,
    numero: numeros === null ? rang + 1 : numeros[rang],
    sieges,
    forme: 'ronde',
    position: { x: 300 * rang, y: 0 },
  }));
  charge.reservations = ancres.map(([participant, table]) => ({ participant, table, siege: null, portee: 'tous', tour: null }));
  charge.reglages.separerOrganisations = separer;
  charge.prochainsIds = { participant: organisations.length + 1, table: capacites.length + 1, proposition: 1 };
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
  const charge = chargeDe({ organisations: fois(n, null), capacites: [8, ...autres] });
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
  // 28 personnes en 18 organisations, dix de 2 et huit de 1, quatre tables
  // de 7, quatre tours : la redondance du remède en tours (M1).
  redondance: () =>
    chargeDe({
      organisations: [
        ...Array.from({ length: 10 }, (_, g) => fois(2, `Cercle ${g + 1}`)).flat(),
        ...Array.from({ length: 8 }, (_, g) => `Atelier ${g + 1}`),
      ],
      capacites: fois(4, 7),
    }),
  // Quatre tables de 3, quatre tours, un animateur par table, tous du Club
  // des Merles ; les huit autres sans organisation.
  animateurs: () =>
    chargeDe({
      organisations: [...fois(4, 'Club des Merles'), ...fois(8, null)],
      capacites: fois(4, 3),
      ancres: [[1, 1], [2, 2], [3, 3], [4, 4]],
    }),
  // Table 1, numérotée 7 : 3 places, 3 ancrés ; table 2, numérotée 8 :
  // 4 places, 2 ancrés ; table 3, numérotée 9 : 4 places, aucun.
  ancrage: () =>
    chargeDe({
      organisations: fois(10, null),
      capacites: [3, 4, 4],
      numeros: [7, 8, 9],
      ancres: [[1, 1], [2, 1], [3, 1], [4, 2], [5, 2]],
    }),
  // Trois membres d'une organisation, deux tables de 2, quatre tours.
  excedent: () => chargeDe({ organisations: fois(3, 'Grisaille'), capacites: [2, 2] }),
  // Deux membres réservés à la même table : aucune table ajoutée ne les
  // sépare.
  memeTable: () =>
    chargeDe({ organisations: [...fois(2, 'Grisaille'), ...fois(4, null)], capacites: [3, 3], ancres: [[1, 1], [2, 1]] }),
  // Treize personnes, quatre tables de 3.
  manque: () => chargeDe({ organisations: fois(13, null), capacites: fois(4, 3) }),
  // Douze personnes en deux organisations de six, quatre tables de 3.
  toutesEnConflit: () =>
    chargeDe({
      organisations: Array.from({ length: 12 }, (_, p) => (p % 2 === 0 ? 'Club des Merles' : 'Cercle des Hérons')),
      capacites: fois(4, 3),
    }),
  // Le Club des Merles nomme le Cercle des Hérons ; un membre de chacun est
  // réservé à la table 1 pour la soirée : un conflit imposé à chaque tour.
  conflitsImposes: () =>
    chargeDe({
      organisations: ['Club des Merles', 'Cercle des Hérons', ...fois(4, null)],
      capacites: [3, 3],
      ancres: [[1, 1], [2, 1]],
      conflits: [['Cercle des Hérons']],
    }),
  // Douze personnes d'une seule organisation, séparation active.
  uneSeule: () => chargeDe({ organisations: fois(12, 'Club des Merles'), capacites: fois(4, 3) }),
  // Huit personnes en deux organisations de quatre, une table de 8, un tour.
  unTour: () => chargeDe({ organisations: [...fois(4, 'Grisaille'), ...fois(4, 'Club des Merles')], capacites: [8], tours: 1 }),
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
  arguments: { cle: 'separerOrganisations', valeur: false },
};
const remedeCollisions = ({ tablesManquantes }) =>
  tablesManquantes === null
    ? { cle: 'diagnostic.remede.redistribuer', details: {} }
    : { cle: 'diagnostic.remede.tables', details: { tablesManquantes } };

const CHAMPS = [
  {
    champ: 'uneSeuleOrganisation',
    attendus: (d) => (d.uneSeuleOrganisation ? [{ cle: 'diagnostic.uneSeuleOrganisation', details: {}, remede: SEPARATION }] : []),
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
                  ? { cle: 'diagnostic.remede.organisations', details: {} }
                  : { cle: 'diagnostic.remede.tours', details: { toursSansRedondance: d.remedes.toursSansRedondance, tours } },
            },
          ],
  },
  {
    champ: 'animateursMemeOrganisation',
    attendus: (d) =>
      d.animateursMemeOrganisation && d.redondanceImposeeParAnimateurs > 0
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
  {
    champ: 'conflitsImposes',
    attendus: (d) =>
      d.conflitsImposes > 0
        ? [
            {
              cle: 'diagnostic.conflitsImposes',
              details: { conflits: d.conflitsImposes },
              remede: { cle: 'diagnostic.remede.conflitsImposes', details: {} },
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
          arguments: { cle: 'separerOrganisations', valeur: false },
        },
      },
    ]);
  });
});

describe('enonces : les phrases du § 5.6', () => {
  test("conflits imposés : un par tour, l'énoncé les compte et dit le remède ; sans liste, aucun", () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.conflitsImposes());
    assert.equal(diagnostic.conflitsImposes, 4);
    const [enonce] = avecCle(liste, 'diagnostic.conflitsImposes');
    assert.equal(texte(enonce), "4 conflits d'organisation imposés par les réservations");
    assert.match(texte(enonce.remede), /déplacer ou retirer/);
    assert.equal(cles(liste).at(-1), 'diagnostic.conflitsImposes');
    const sansListe = CONFIGURATIONS.conflitsImposes();
    delete sansListe.participants[0].conflits;
    assert.deepEqual(avecCle(lire(sansListe).liste, 'diagnostic.conflitsImposes'), []);
  });

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
    assert.ok(!phrase.includes(ligne.groupe), 'l\u{2019}organisation occupe son propre nœud');
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

  test('redondance : la configuration de M1 — au moins 6 organisations recroisées ; avec 3 tours au lieu de 4, aucune', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.redondance());
    assert.equal(diagnostic.redondanceMinimale, 6);
    const [enonce] = avecCle(liste, 'diagnostic.redondance');
    assert.equal(texte(enonce), 'au moins 6 organisations recroisées par personne');
    assert.equal(texte(enonce.remede), 'avec 3 tours au lieu de 4, aucune ne le serait');
  });

  test('redondance sans remède en tours : un seul tour, toursSansRedondance null', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.unTour());
    assert.ok(diagnostic.redondanceMinimale > 0);
    assert.equal(diagnostic.remedes.toursSansRedondance, null);
    const [enonce] = avecCle(liste, 'diagnostic.redondance');
    assert.deepEqual(enonce.remede, { cle: 'diagnostic.remede.organisations', details: {} });
    assert.doesNotMatch(texte(enonce.remede), /\d/);
    for (const { remede } of liste) assert.notEqual(remede?.cle, 'diagnostic.remede.tours');
  });

  test('animateurs d\u{2019}une même organisation : la phrase porte 3 et son remède ; absente de la grande', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.animateurs());
    assert.equal(diagnostic.redondanceImposeeParAnimateurs, 3);
    const [enonce] = avecCle(liste, 'diagnostic.animateurs');
    assert.ok(texte(enonce).includes('au moins 3 redondances'), texte(enonce));
    assert.equal(enonce.remede.cle, 'diagnostic.remede.animateurs');
    assert.ok(texte(enonce.remede).includes('sans organisation déclarée'));
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

  test('une seule organisation : la phrase, puis le remède qui désactive la séparation', () => {
    const { liste } = lire(CONFIGURATIONS.uneSeule());
    assert.equal(liste[0].cle, 'diagnostic.uneSeuleOrganisation');
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
    const { liste } = lire(chargeDe({ organisations: [], capacites: [] }));
    assert.deepEqual(liste, [{ cle: 'diagnostic.plafondInconnu', details: {}, remede: null }]);
    assert.ok(texte(liste[0]).includes(TIRET));
    assert.doesNotMatch(texte(liste[0]), /\d/);
  });

  test('deux personnes sans table : 2 places manquent à chaque tour', () => {
    const [enonce] = avecCle(lire(chargeDe({ organisations: [null, null], capacites: [] })).liste, 'diagnostic.placesManquantes');
    assert.equal(texte(enonce), '2 places manquent à chaque tour');
  });

  test('aucune organisation : ni collisions ni redondance', () => {
    const { liste } = lire(chargeDe({ organisations: fois(12, null), capacites: fois(4, 3) }));
    assert.ok(liste.length > 0);
    for (const cle of ['diagnostic.collisions', 'diagnostic.excedent', 'diagnostic.redondance', 'diagnostic.uneSeuleOrganisation', 'diagnostic.collisionPartout']) {
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

describe('cartesDiagnostic : une carte par organisation (§ 5.6, § 12.7)', () => {
  // La forme lisible d'une suite de cartes : genre, groupe, clés.
  const formes = (cartes) => cartes.map(({ genre, groupe, enonces: liste }) => [genre, groupe, cles(liste)]);

  test('deux organisations en collision partout : la séparation, une carte par groupe, puis le reste de l\u{2019}événement', () => {
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
        'organisation',
        groupe,
        cles(liste.filter(({ details }) => details.groupe === groupe)),
      ]),
      ['ensemble', null, reste],
    ]);
  });

  test('l\u{2019}excédent suit les collisions de son groupe, dans la même carte', () => {
    const { liste } = lire(CONFIGURATIONS.excedent());
    const [carte] = cartesDiagnostic(liste).filter(({ genre }) => genre === 'organisation');
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

  test('sans organisation, une seule carte, celle de l\u{2019}événement ; aucun énoncé, aucune carte ; la liste reçue n\u{2019}est pas modifiée', () => {
    const { liste } = lire(CONFIGURATIONS.manque());
    const copie = structuredClone(liste);
    assert.deepEqual(formes(cartesDiagnostic(liste)), [['ensemble', null, cles(liste)]]);
    assert.deepEqual(liste, copie);
    assert.deepEqual(cartesDiagnostic([]), []);
  });

  test('une seule organisation : sa phrase ouvre la carte de la séparation', () => {
    const { liste } = lire(CONFIGURATIONS.uneSeule());
    const [premiere] = cartesDiagnostic(liste);
    assert.equal(premiere.genre, 'separation');
    assert.equal(premiere.enonces[0].cle, 'diagnostic.uneSeuleOrganisation');
  });
});

describe('enonces : la présence par tour', () => {
  // Douze personnes, cinq d'une même organisation, quatre tables de 3,
  // quatre tours ; presences : [rang, présence] des personnes partielles.
  function chargePresences(presences, { personnes = 12 } = {}) {
    const charge = chargeDe({ organisations: [...fois(5, 'Grisaille'), ...fois(personnes - 5, null)], capacites: fois(4, 3) });
    for (const [rang, presence] of presences) charge.participants[rang].presence = presence;
    return charge;
  }

  test('deux présences partielles : l’énoncé ouvre la carte de l’événement, sans remède ; l’écart d’itinéraire ne s’énonce pas', () => {
    const { diagnostic, liste } = lire(chargePresences([[10, [1, 2]], [11, [3]]]));
    assert.deepEqual(diagnostic.planchersRetires, ['ecartItineraire']);
    const enonce = { cle: 'diagnostic.planchersRetires', details: { absentes: 2 }, remede: null };
    const rang = liste.findIndex(({ cle }) => cle === 'diagnostic.planchersRetires');
    assert.deepEqual(liste[rang], enonce);
    // Il suit les collisions de chaque organisation et ouvre le reste.
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

describe('expliquer : « Concrètement » et « Pour changer cela » (§ 5.6)', () => {
  // Le diagnostic d'une charge, ses énoncés et l'explication de chacun.
  function explique(charge) {
    const { diagnostic, liste } = lire(charge);
    const contexte = { diagnostic, tours: charge.evenement.tours };
    return { diagnostic, liste, explications: liste.map((enonce) => expliquer(enonce, contexte)) };
  }
  // L'explication du premier énoncé de clé donnée.
  const explicationDe = ({ liste, explications }, cle) => explications[liste.findIndex((enonce) => enonce.cle === cle)];

  // 157 personnes inventées, 20 tables de 8, une personne ancrée à chaque
  // table pour la soirée, quatre tours : 160 places.
  const soireeDeCentCinquanteSept = () =>
    chargeDe({
      organisations: fois(157, null),
      capacites: fois(20, 8),
      ancres: Array.from({ length: 20 }, (_, t) => [t + 1, t + 1]),
    });

  // Dix personnes, quatre tables de 3, quatre tours ; la neuvième vient aux
  // tours 1 et 2, la dixième au tour 1 : 10, 9, 8 et 8 présentes.
  function chargeAbsences() {
    const charge = chargeDe({ organisations: fois(10, null), capacites: fois(4, 3) });
    charge.participants[8].presence = [1, 2];
    charge.participants[9].presence = [1];
    return charge;
  }

  // Six personnes, deux tables de 3, la première réservée à la table 1 aux
  // tours 1 et 2 seulement : un retour imposé, par une personne.
  function chargeRetourPartiel() {
    const charge = chargeDe({ organisations: fois(6, null), capacites: [3, 3] });
    charge.reservations = [1, 2].map((tour) => ({ participant: 1, table: 1, siege: null, portee: 'tour', tour }));
    return charge;
  }

  test('157 personnes pour 160 places, tables de 8, quatre tours : le plafond par la table, les places vides, le geste ; les retours des ancrés', () => {
    const lu = explique(soireeDeCentCinquanteSept());
    assert.deepEqual(lu.diagnostic.plafondAPriori.repartition, [{ valeur: 28, ancres: 20, mobiles: 137 }]);
    const plafond = explicationDe(lu, 'diagnostic.plafond');
    assert.deepEqual(plafond, {
      concretement: [
        { cle: 'diagnostic.concretement.plafond.tables', details: { capacite: 8, parTour: 7, valeur: 28, tours: 4 } },
        { cle: 'diagnostic.concretement.placesVides', details: { placesVides: 3, places: 160, presents: 157 } },
      ],
      levier: { cle: 'diagnostic.levier.plafond', details: {} },
    });
    assert.equal(
      texte(plafond.concretement[0]),
      "à une table de 8, on rencontre 7 personnes par tour ; sur les 4 tours, 28 personnes différentes au plus, et seulement sans jamais revoir quelqu'un.",
    );
    assert.equal(
      texte(plafond.concretement[1]),
      '3 places restent vides à chaque tour, 157 personnes pour 160 places : une personne assise à une table incomplète y rencontre ' +
        'une personne de moins par place vide, et ce plafond, compté sur des tables pleines, peut alors lui échapper.',
    );
    assert.equal(texte(plafond.levier), 'des tables plus grandes, ou un tour de plus.');
    const imposes = explicationDe(lu, 'diagnostic.imposes');
    assert.deepEqual(imposes, {
      concretement: [{ cle: 'diagnostic.concretement.imposes.ancres', details: { personnes: 20, tours: 4, retours: 3 } }],
      levier: null,
    });
    assert.equal(
      texte(imposes.concretement[0]),
      'chacune des 20 personnes réservées à une table y reste aux 4 tours, et y revient donc 3 fois ; ' +
        'ces retours sont voulus par les réservations et ne comptent pas contre les propositions.',
    );
  });

  test('la grande : tables de 7 et de 8, le plafond par les capacités, sans geste ; l\u{2019}écart d\u{2019}itinéraire, 24 mobiles et 1 rencontre', () => {
    const lu = explique(CONFIGURATIONS.grande());
    const plafonds = lu.explications.filter((_, rang) => lu.liste[rang].cle === 'diagnostic.plafond');
    assert.deepEqual(plafonds, [
      { concretement: [{ cle: 'diagnostic.concretement.plafond.capacites', details: { valeur: 24, tours: 4, ancres: true } }], levier: null },
      { concretement: [{ cle: 'diagnostic.concretement.plafond.capacites', details: { valeur: 28, tours: 4, ancres: true } }], levier: null },
    ]);
    assert.match(texte(plafonds[0].concretement[0]), /ancrés des autres tables/);
    assert.deepEqual(explicationDe(lu, 'diagnostic.ecartItineraire').concretement, [
      { cle: 'diagnostic.concretement.ecartItineraire', details: { plancher: 1, mobilesAuMoins: 24 } },
    ]);
    assert.match(texte(explicationDe(lu, 'diagnostic.ecartItineraire').concretement[0]), /au moins 24 mobiles .* au moins 1 rencontre sous/);
    assert.deepEqual(explicationDe(lu, 'diagnostic.imposes').concretement[0].details, { personnes: 33, tours: 4, retours: 3 });
  });

  test('la petite : tables de 3, plafond 8 sous les 11 autres, le geste ; six personnes à deux tables de 3 : toutes les autres, sans geste', () => {
    const petite = explicationDe(explique(CONFIGURATIONS.petite()), 'diagnostic.plafond');
    assert.deepEqual(petite, {
      concretement: [{ cle: 'diagnostic.concretement.plafond.tables', details: { capacite: 3, parTour: 2, valeur: 8, tours: 4 } }],
      levier: { cle: 'diagnostic.levier.plafond', details: {} },
    });
    const six = explicationDe(explique(chargeDe({ organisations: fois(6, null), capacites: [3, 3] })), 'diagnostic.plafond');
    assert.deepEqual(six, { concretement: [{ cle: 'diagnostic.concretement.plafond.tous', details: { valeur: 5 } }], levier: null });
    assert.match(texte(six.concretement[0]), /toutes les autres personnes présentes/);
  });

  test('sous absence : les places vides selon le tour, sur la première ligne du plafond seule ; les présents de 8 à 10', () => {
    const lu = explique(chargeAbsences());
    const lignes = lu.explications.filter((_, rang) => lu.liste[rang].cle === 'diagnostic.plafond');
    assert.ok(lignes.length > 1);
    assert.deepEqual(lignes[0].concretement.at(-1), { cle: 'diagnostic.concretement.placesVidesSelonTour', details: { placesVides: 4 } });
    // Sous absence, une valeur sous N − 1 peut venir des places comme des
    // présents : la phrase nomme les deux bornes sans trancher.
    assert.deepEqual(
      lignes.map(({ concretement }) => concretement[0]),
      [
        { cle: 'diagnostic.concretement.plafond.presence', details: { valeur: 2, ancres: false } },
        { cle: 'diagnostic.concretement.plafond.presence', details: { valeur: 4, ancres: false } },
        { cle: 'diagnostic.concretement.plafond.tables', details: { capacite: 3, parTour: 2, valeur: 8, tours: 4 } },
      ],
    );
    assert.equal(
      texte(lignes[0].concretement[0]),
      "2 personnes différentes au plus, en ne revoyant jamais personne : chaque tour où l'on est présent n'ajoute au plus " +
        "que les autres personnes de la table où l'on s'assoit, selon sa capacité, et parmi celles qui sont présentes à ce tour seulement.",
    );
    assert.doesNotMatch(texte(lignes[0].concretement[0]), /ancrés des autres tables/);
    for (const ligne of lignes.slice(1)) {
      assert.ok(ligne.concretement.every(({ cle }) => !cle.startsWith('diagnostic.concretement.placesVides')));
    }
    assert.ok(lignes.every(({ levier }) => levier === null));
    assert.deepEqual(explicationDe(lu, 'diagnostic.planchersRetires'), {
      concretement: [{ cle: 'diagnostic.concretement.planchersRetires', details: { moins: 8, plus: 10 } }],
      levier: null,
    });
    assert.equal(texte(lignes[0].concretement.at(-1)).startsWith("Jusqu'à 4 places restent vides"), true);
    assert.equal(
      texte(explicationDe(lu, 'diagnostic.planchersRetires').concretement[0]),
      "de 8 à 10 personnes sont présentes selon le tour : une personne absente à un tour n'y rencontre personne, " +
        'et son plafond a priori ne compte que ses tours de présence.',
    );
  });

  test('sous absence, une valeur égale aux N \u{2212} 1 autres personnes : toutes les autres, sans geste ni capacité', () => {
    // Six personnes, deux tables de 3, la sixième présente aux tours 2 à 4 :
    // les places permettraient 4 × 2 = 8 rencontres, la population en borne 5.
    const charge = chargeDe({ organisations: fois(6, null), capacites: [3, 3] });
    charge.participants[5].presence = [2, 3, 4];
    const lu = explique(charge);
    assert.deepEqual(lu.diagnostic.plafondAPriori.repartition, [{ valeur: 5, ancres: 0, mobiles: 6 }]);
    const plafond = explicationDe(lu, 'diagnostic.plafond');
    assert.deepEqual(plafond, {
      concretement: [
        { cle: 'diagnostic.concretement.plafond.tous', details: { valeur: 5 } },
        { cle: 'diagnostic.concretement.placesVidesSelonTour', details: { placesVides: 1 } },
      ],
      levier: null,
    });
    assert.doesNotMatch(texte(plafond.concretement[0]), /capacité/);
  });

  test('sans absence ni ancré, des tables de 4 et de 5 : le plafond par les capacités, sans ancrés', () => {
    // Vingt personnes, quatre tables de 4 et une de 5, deux tours : au plus
    // 2 × 4 = 8 rencontres, sous les 19 autres.
    const lu = explique(chargeDe({ organisations: fois(20, null), capacites: [4, 4, 4, 4, 5], tours: 2 }));
    const plafonds = lu.explications.filter((_, rang) => lu.liste[rang].cle === 'diagnostic.plafond');
    assert.ok(plafonds.length > 0);
    for (const { concretement } of plafonds) {
      assert.equal(concretement[0].cle, 'diagnostic.concretement.plafond.capacites');
      assert.equal(concretement[0].details.ancres, false);
      assert.doesNotMatch(texte(concretement[0]), /ancrés des autres tables/);
    }
  });

  test('neuf personnes à trois tables de 3, quatre tours : 8 est à la fois les autres et 4 × 2 — toutes les autres, sans geste', () => {
    // Ni des tables plus grandes ni un tour de plus ne relèvent un plafond
    // que la population borne déjà.
    const plafond = explicationDe(explique(chargeDe({ organisations: fois(9, null), capacites: [3, 3, 3] })), 'diagnostic.plafond');
    assert.deepEqual(plafond, { concretement: [{ cle: 'diagnostic.concretement.plafond.tous', details: { valeur: 8 } }], levier: null });
  });

  test('une table de 5 dont 3 places sont ancrées : à moitié ancrée, 2 places seulement changent d\u{2019}occupant', () => {
    const lu = explique(chargeDe({ organisations: fois(10, null), capacites: [5, 5], ancres: [[1, 1], [2, 1], [3, 1]] }));
    const moitie = explicationDe(lu, 'diagnostic.ancrage.moitie');
    assert.deepEqual(moitie.concretement, [
      { cle: 'diagnostic.concretement.ancrage.moitie', details: { numero: 1, ancres: 3, capacite: 5, libres: 2 } },
    ]);
    assert.match(texte(moitie.concretement[0]), /3 des 5 places de la table 1 .* seules 2 places y reçoivent/);
  });

  test('onze personnes présentes à chaque tour, pas toujours les mêmes : le plancher retiré le dit', () => {
    // Douze personnes, quatre tables de 3 ; chacune des quatre dernières
    // manque un tour différent : 11 présentes à chaque tour.
    const charge = chargeDe({ organisations: fois(12, null), capacites: fois(4, 3) });
    [[2, 3, 4], [1, 3, 4], [1, 2, 4], [1, 2, 3]].forEach((presence, rang) => {
      charge.participants[11 - rang].presence = presence;
    });
    const planchers = explicationDe(explique(charge), 'diagnostic.planchersRetires');
    assert.deepEqual(planchers.concretement, [{ cle: 'diagnostic.concretement.planchersRetires', details: { moins: 11, plus: 11 } }]);
    assert.equal(
      texte(planchers.concretement[0]),
      "11 personnes sont présentes à chaque tour, pas toujours les mêmes : une personne absente à un tour n'y rencontre " +
        'personne, et son plafond a priori ne compte que ses tours de présence.',
    );
  });

  test('les collisions par le manque de tables, ou par les réservations ; l\u{2019}excédent ; les tables gelée et à moitié ancrée ; les animateurs', () => {
    const conflit = explique(CONFIGURATIONS.petiteConflit());
    const enonce = avecCle(conflit.liste, 'diagnostic.collisions')[0];
    const { groupe, ...chiffres } = enonce.details;
    assert.equal(typeof groupe, 'string');
    assert.deepEqual(explicationDe(conflit, 'diagnostic.collisions'), {
      concretement: [{ cle: 'diagnostic.concretement.collisions', details: { ...chiffres, parReservations: false } }],
      levier: null,
    });
    assert.match(texte(explicationDe(conflit, 'diagnostic.collisions').concretement[0]), /les tables ne suffisent pas/);
    const memeTable = explicationDe(explique(CONFIGURATIONS.memeTable()), 'diagnostic.collisions');
    assert.equal(memeTable.concretement[0].details.parReservations, true);
    assert.match(texte(memeTable.concretement[0]), /des réservations assoient/);

    const excedent = explique(CONFIGURATIONS.excedent());
    assert.deepEqual(explicationDe(excedent, 'diagnostic.excedent').concretement, [
      { cle: 'diagnostic.concretement.excedent', details: { plancherExcedent: avecCle(excedent.liste, 'diagnostic.excedent')[0].details.plancherExcedent } },
    ]);

    const ancrage = explique(CONFIGURATIONS.ancrage());
    assert.deepEqual(explicationDe(ancrage, 'diagnostic.ancrage.gelee').concretement, [
      { cle: 'diagnostic.concretement.ancrage.gelee', details: { numero: 7, capacite: 3, autres: 2, tours: 4 } },
    ]);
    assert.deepEqual(explicationDe(ancrage, 'diagnostic.ancrage.moitie').concretement, [
      { cle: 'diagnostic.concretement.ancrage.moitie', details: { numero: 8, ancres: 2, capacite: 4, libres: 2 } },
    ]);
    assert.equal(
      t('diagnostic.concretement.ancrage.gelee', { numero: 2, capacite: 1, autres: 0, tours: 4 }),
      'la personne ancrée à la table 2 y reste seule aux 4 tours : elle ne rencontre personne.',
    );

    assert.deepEqual(explicationDe(explique(CONFIGURATIONS.animateurs()), 'diagnostic.animateurs').concretement, [
      { cle: 'diagnostic.concretement.animateurs', details: { redondances: 3, tables: 4 } },
    ]);
  });

  test('le manque de places, les retours imposés d\u{2019}une réservation partielle', () => {
    assert.deepEqual(explicationDe(explique(CONFIGURATIONS.manque()), 'diagnostic.placesManquantes').concretement, [
      { cle: 'diagnostic.concretement.placesManquantes', details: { places: 12, presents: 13, varie: false } },
    ]);
    assert.match(texte(explicationDe(explique(CONFIGURATIONS.manque()), 'diagnostic.placesManquantes').concretement[0]), /^13 personnes pour 12 places à chaque tour : /);
    // Treize personnes, quatre tables de 3, la treizième aux tours 2 et 3
    // seulement : le manque varie, le tour le plus chargé n'est pas le premier.
    const variable = chargeDe({ organisations: fois(13, null), capacites: fois(4, 3) });
    variable.participants[12].presence = [2, 3];
    const manque = explicationDe(explique(variable), 'diagnostic.placesManquantes');
    assert.deepEqual(manque.concretement, [{ cle: 'diagnostic.concretement.placesManquantes', details: { places: 12, presents: 13, varie: true } }]);
    assert.equal(
      texte(manque.concretement[0]),
      "au tour le plus chargé, 13 personnes pour 12 places : il faudrait asseoir plus de personnes qu'il n'y a de places, " +
        'et aucune proposition ne se génère avant que chacune ait la sienne.',
    );
    const partiel = explicationDe(explique(chargeRetourPartiel()), 'diagnostic.imposes');
    assert.deepEqual(partiel.concretement, [{ cle: 'diagnostic.concretement.imposes', details: { personnes: 1, retoursImposes: 1 } }]);
  });

  test('sur toutes les configurations, chaque énoncé a son « Concrètement », chaque texte se compose, et chaque clé d\u{2019}explication sert', () => {
    const cles = new Set(
      creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE])
        .cles()
        .filter((cle) => cle.startsWith('diagnostic.concretement.') || cle.startsWith('diagnostic.levier.')),
    );
    assert.ok(cles.size > 0);
    const servies = new Set();
    const charges = [
      ...Object.values(CONFIGURATIONS).map((construire) => construire()),
      soireeDeCentCinquanteSept(),
      chargeAbsences(),
      chargeRetourPartiel(),
      chargeDe({ organisations: fois(6, null), capacites: [3, 3] }),
      chargeDe({ organisations: [], capacites: [] }),
      chargeObjectifs(40, fois(4, 8), { mode: 'chacun' }),
      chargeObjectifs(40, fois(4, 8), { mode: 'minimum' }),
    ];
    for (const charge of charges) {
      const { liste, explications } = explique(charge);
      liste.forEach((enonce, rang) => {
        const { concretement, levier } = explications[rang];
        assert.ok(concretement.length > 0, enonce.cle);
        for (const phrase of [...concretement, ...(levier === null ? [] : [levier])]) {
          servies.add(phrase.cle);
          const rendu = texte(phrase);
          assert.equal(typeof rendu, 'string', phrase.cle);
          assert.doesNotMatch(rendu, /undefined|NaN|null/, phrase.cle);
          assert.match(rendu, /\.$/, phrase.cle);
        }
      });
    }
    assert.deepEqual([...cles].filter((cle) => !servies.has(cle)), []);
  });

  test('remedeAgit : vrai pour un remède qui dit un geste, faux pour un constat ou l\u{2019}absence de remède', () => {
    for (const cle of [
      'diagnostic.remede.separation',
      'diagnostic.remede.tables',
      'diagnostic.remede.redistribuer',
      'diagnostic.remede.tours',
      'diagnostic.remede.animateurs',
      'diagnostic.remede.ancrage',
      'diagnostic.remede.places',
      'diagnostic.remede.objectifs',
      'diagnostic.remede.conflitsImposes',
    ]) {
      assert.equal(remedeAgit({ cle, details: {} }), true, cle);
    }
    for (const cle of ['diagnostic.remede.organisations', 'diagnostic.remede.ecartItineraire', 'diagnostic.remede.plafond', 'diagnostic.remede.imposes']) {
      assert.equal(remedeAgit({ cle, details: {} }), false, cle);
    }
    assert.equal(remedeAgit(null), false);
  });

  test('expliquer ne modifie ni l\u{2019}énoncé ni le diagnostic', () => {
    const { diagnostic, liste } = lire(CONFIGURATIONS.grande());
    const avant = structuredClone({ diagnostic, liste });
    for (const enonce of liste) expliquer(enonce, { diagnostic, tours: 4 });
    assert.deepEqual({ diagnostic, liste }, avant);
  });
});
