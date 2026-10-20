// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de la définition des réglages de la charge (§ 5.3, § 5.7,
// § 5.10, § 8.9, § 19.8) : sa forme, figée ; l'ordre des écrans ; les
// défauts, ceux d'une charge neuve, GENERATION_PAR_DEFAUT compris, et ceux
// que les lecteurs du stockage
// donnent aux réglages facultatifs — les deux cases, le mode des objectifs,
// l'ordre des priorités ; chaque réglage du schéma du fichier, facultatif
// compris, et lui seul ; les clés que les commandes acceptent et les
// libellés qui existent ; la lecture d'une valeur dans une charge.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { appliquerCommande } from '../../application/commandes.js';
import { creerTraduction } from '../../application/traduction.js';
import { MODES_OBJECTIFS } from '../../moteur/criteres.js';
import {
  GENERATION_PAR_DEFAUT,
  SCHEMA,
  creerCharge,
  critereCoche,
  modeObjectifs,
  priorites,
} from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { REGLAGES_GENERATION, reglagesDeSection, reglagesDuGenre, valeurDuReglage } from './reglages.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une charge neuve, telle que creerCharge la pose.
const chargeNeuveEpreuve = () => creerCharge({ id: 'epreuve', nom: 'Soirée des Merles', siegesParDefaut: 6, tours: 2 });

// La règle du champ cle d'une règle objet du schéma.
const champDe = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];

// Les chemins des réglages que le schéma du fichier décrit, dans son ordre :
// <cle> pour une valeur à la racine des réglages, <objet>.<cle> pour une
// valeur d'un objet imbriqué ; un champ facultatif compte comme un autre.
function cheminsDuSchema() {
  const chemins = [];
  const parcourir = (regle, prefixe) => {
    for (const [cle, sous] of regle.champs) {
      if (sous.genre === 'objet') parcourir(sous, `${prefixe}${cle}.`);
      else chemins.push(`${prefixe}${cle}`);
    }
  };
  parcourir(champDe(champDe(SCHEMA, 'charge'), 'reglages'), '');
  return chemins;
}

// Les réglages du schéma qu'aucune entrée de REGLAGES_GENERATION ne porte,
// chacun avec sa raison. Un réglage nommé ici doit exister au schéma et
// n'avoir aucune entrée : l'entrée qui s'ajoute l'en retire.
const SANS_ENTREE = new Map([
  ['regleObjectifs', 'la règle par défaut des objectifs s’écrit depuis les tables, non depuis la génération'],
]);

// La commande qui écrit un réglage de chaque section, et ses arguments :
// l'ordre des priorités par changerPriorites, les autres réglages de la
// génération par modifierReglage.
const ECRITURES = new Map([
  [
    'generation',
    (entree, valeur) =>
      entree.genre === 'ordre' ? ['changerPriorites', { paliers: valeur }] : ['modifierReglage', { cle: entree.cle, valeur }],
  ],
]);

// Une valeur autre que le défaut de l'entrée : la case contraire, un mode
// voisin, un entier de plus, l'ordre par défaut aux deux derniers paliers
// joints.
function autreValeur({ genre, defaut, valeurs }) {
  if (genre === 'bascule') return !defaut;
  if (genre === 'choix') return valeurs.find((valeur) => valeur !== defaut);
  if (genre === 'ordre') return [...defaut.slice(0, -2), [...defaut.at(-2), ...defaut.at(-1)]];
  return defaut + 1;
}

// Les clés de chaque entrée, et celles qu'une entrée du genre choix porte en
// plus : ses valeurs, la bascule sous laquelle elle se montre, le critère
// dont elle règle la lecture.
const CLES_D_ENTREE = ['nom', 'cle', 'etiquette', 'unite', 'defaut', 'genre', 'section'];
const CLES_DU_CHOIX = ['valeurs', 'sous', 'critere'];

describe('REGLAGES_GENERATION : la définition que lisent les écrans et la documentation (§ 19.8)', () => {
  test('chaque entrée porte nom, cle, etiquette, unite, defaut, genre et section, un choix ses valeurs, sa bascule et son critère ; la définition comme chaque entrée sont figées', () => {
    assert.ok(REGLAGES_GENERATION.length > 0, 'définition vide');
    assert.ok(Object.isFrozen(REGLAGES_GENERATION));
    for (const entree of REGLAGES_GENERATION) {
      assert.deepEqual(Object.keys(entree), entree.genre === 'choix' ? [...CLES_D_ENTREE, ...CLES_DU_CHOIX] : CLES_D_ENTREE);
      assert.ok(Object.isFrozen(entree), entree.nom);
    }
    assert.throws(() => REGLAGES_GENERATION.push({}), TypeError);
  });

  test('l’ordre des écrans : les trois champs de la recherche, les bascules du § 5.3, le mode des objectifs, l’ordre des priorités ; aucun réglage hors de la génération', () => {
    assert.deepEqual(
      REGLAGES_GENERATION.map(({ nom, genre, section }) => [section, genre, nom]),
      [
        ['generation', 'champ', 'nombre'],
        ['generation', 'champ', 'arret'],
        ['generation', 'champ', 'historique'],
        ['generation', 'bascule', 'separerAppartenances'],
        ['generation', 'bascule', 'nouveauxVoisins'],
        ['generation', 'bascule', 'nouvelleTable'],
        ['generation', 'bascule', 'varierAppartenances'],
        ['generation', 'bascule', 'respecterObjectifs'],
        ['generation', 'bascule', 'rencontrerAnimateurs'],
        ['generation', 'bascule', 'attribuerSieges'],
        ['generation', 'choix', 'modeObjectifs'],
        ['generation', 'ordre', 'priorites'],
      ],
    );
  });

  test('un champ de la génération : clé generation.<nom>, libellé generation.reglage.<nom>, une unité ; une bascule : clé <nom>, libellé generation.contrainte.<nom>, sans unité', () => {
    const generation = reglagesDeSection(REGLAGES_GENERATION, 'generation');
    const champs = reglagesDuGenre(generation, 'champ');
    assert.equal(champs.length, 3);
    for (const { nom, cle, etiquette } of champs) {
      assert.equal(cle, `generation.${nom}`);
      assert.equal(etiquette, `generation.reglage.${nom}`);
    }
    assert.deepEqual(champs.map(({ unite }) => unite), ['propositions', 'mouvements', 'mouvements']);
    const bascules = reglagesDuGenre(generation, 'bascule');
    assert.equal(bascules.length, 7);
    for (const { nom, cle, etiquette, unite } of bascules) {
      assert.equal(cle, nom);
      assert.equal(etiquette, `generation.contrainte.${nom}`);
      assert.equal(unite, null);
    }
    const choix = reglagesDuGenre(generation, 'choix');
    const ordres = reglagesDuGenre(generation, 'ordre');
    assert.equal(champs.length + bascules.length + choix.length + ordres.length, generation.length);
  });

  test('le mode des objectifs : un choix à la racine des réglages, ses trois valeurs celles du registre, le plus de places servies par défaut, sous la case des objectifs, réglant les tours hors objectif', () => {
    const choix = reglagesDuGenre(REGLAGES_GENERATION, 'choix');
    assert.deepEqual(choix, [
      {
        nom: 'modeObjectifs',
        cle: 'modeObjectifs',
        etiquette: 'generation.reglage.modeObjectifs',
        unite: null,
        defaut: 'places',
        genre: 'choix',
        section: 'generation',
        valeurs: [...MODES_OBJECTIFS],
        sous: 'respecterObjectifs',
        critere: 'toursHorsObjectif',
      },
    ]);
    assert.ok(Object.isFrozen(choix[0].valeurs));
    assert.equal(choix[0].defaut, modeObjectifs({ reglages: {} }));
    assert.ok(reglagesDuGenre(REGLAGES_GENERATION, 'bascule').some(({ cle }) => cle === choix[0].sous));
    for (const valeur of choix[0].valeurs) {
      assert.notEqual(t(`${choix[0].etiquette}.${valeur}`), `${choix[0].etiquette}.${valeur}`, valeur);
      assert.notEqual(t(`${choix[0].etiquette}.${valeur}.explication`), `${choix[0].etiquette}.${valeur}.explication`, valeur);
    }
  });

  test('l’ordre des priorités : une entrée à la racine des réglages, sans unité, l’ordre par défaut que lit le stockage', () => {
    const [ordre] = reglagesDuGenre(REGLAGES_GENERATION, 'ordre');
    assert.deepEqual({ ...ordre, defaut: null }, {
      nom: 'priorites',
      cle: 'priorites',
      etiquette: 'generation.reglage.priorites',
      unite: null,
      defaut: null,
      genre: 'ordre',
      section: 'generation',
    });
    assert.deepEqual(ordre.defaut, priorites({ reglages: {} }));
    assert.ok(Object.isFrozen(ordre.defaut));
  });

  test('la cible de la somme de redondance n’est plus un réglage : ni entrée, ni section des propositions', () => {
    assert.equal(REGLAGES_GENERATION.some(({ nom, cle }) => nom === 'cibleRedondance' || cle === 'cibleRedondance'), false);
    assert.deepEqual(reglagesDeSection(REGLAGES_GENERATION, 'propositions'), []);
  });

  test('chaque défaut est celui d’une charge neuve : GENERATION_PAR_DEFAUT pour les champs, les bascules de creerCharge', () => {
    const { reglages } = chargeNeuveEpreuve();
    for (const entree of REGLAGES_GENERATION) {
      assert.equal(entree.defaut, valeurDuReglage(reglages, entree), entree.nom);
    }
    const generation = reglagesDeSection(REGLAGES_GENERATION, 'generation');
    assert.deepEqual(
      Object.fromEntries(reglagesDuGenre(generation, 'champ').map(({ nom, defaut }) => [nom, defaut])),
      { ...GENERATION_PAR_DEFAUT },
    );
    assert.deepEqual(
      reglagesDuGenre(generation, 'bascule').map(({ defaut }) => defaut),
      [true, true, true, true, true, false, false],
    );
    // Les cases facultatives, absentes d'une charge neuve : leur défaut est
    // celui que le stockage leur lit.
    for (const cle of ['respecterObjectifs', 'rencontrerAnimateurs']) {
      assert.equal(Object.hasOwn(reglages, cle), false, cle);
      assert.equal(REGLAGES_GENERATION.find((entree) => entree.cle === cle).defaut, critereCoche({ reglages: {} }, cle), cle);
    }
    assert.equal(Object.hasOwn(reglages, 'modeObjectifs') || Object.hasOwn(reglages, 'priorites'), false);
  });

  test('chaque réglage du schéma du fichier, facultatif compris, a son entrée, et chaque entrée en désigne un : aucun n’échappe aux écrans ni au tableau, hors des réglages nommés sans entrée', () => {
    const chemins = cheminsDuSchema();
    assert.ok(chemins.includes('generation.nombre') && !chemins.includes('cibleRedondance'), chemins.join(', '));
    const cles = REGLAGES_GENERATION.map(({ cle }) => cle);
    for (const cle of SANS_ENTREE.keys()) {
      assert.ok(chemins.includes(cle), `${cle} : absent du schéma, à retirer de SANS_ENTREE`);
      assert.ok(!cles.includes(cle), `${cle} : a son entrée, à retirer de SANS_ENTREE`);
    }
    assert.deepEqual([...cles].sort(), chemins.filter((cle) => !SANS_ENTREE.has(cle)).sort());
  });

  test('chaque entrée s’écrit par la commande de sa section, et chaque libellé existe', () => {
    let charge = chargeNeuveEpreuve();
    for (const entree of REGLAGES_GENERATION) {
      const valeur = autreValeur(entree);
      const [commande, args] = ECRITURES.get(entree.section)(entree, valeur);
      charge = appliquerCommande(commande, charge, args).charge;
      assert.deepEqual(valeurDuReglage(charge.reglages, entree), valeur, entree.cle);
      assert.notEqual(t(entree.etiquette), entree.etiquette);
    }
    assert.deepEqual([...new Set(REGLAGES_GENERATION.map(({ section }) => section))], [...ECRITURES.keys()]);
  });
});

describe('valeurDuReglage, reglagesDuGenre et reglagesDeSection', () => {
  test('la valeur d’un réglage se lit au chemin de sa clé : sous generation pour un champ de la génération, à la racine sinon', () => {
    const reglages = { nouvelleTable: false, modeObjectifs: 'minimum', generation: { nombre: 9 } };
    const [nombre] = REGLAGES_GENERATION;
    const nouvelleTable = REGLAGES_GENERATION.find(({ nom }) => nom === 'nouvelleTable');
    const mode = REGLAGES_GENERATION.find(({ nom }) => nom === 'modeObjectifs');
    assert.equal(valeurDuReglage(reglages, nombre), 9);
    assert.equal(valeurDuReglage(reglages, nouvelleTable), false);
    assert.equal(valeurDuReglage(reglages, mode), 'minimum');
  });

  test('un réglage facultatif absent vaut son défaut', () => {
    const mode = REGLAGES_GENERATION.find(({ nom }) => nom === 'modeObjectifs');
    assert.equal(valeurDuReglage({ generation: {} }, { ...mode, defaut: 'chacun' }), 'chacun');
    for (const entree of REGLAGES_GENERATION.filter(({ genre }) => genre !== 'champ')) {
      assert.equal(valeurDuReglage({ generation: {} }, entree), entree.defaut, entree.cle);
    }
  });

  test('le mode et l’ordre se lisent à la racine des réglages, comme les cases facultatives', () => {
    const lire = (nom, reglages) => valeurDuReglage(reglages, REGLAGES_GENERATION.find((entree) => entree.nom === nom));
    const ordre = [[{ critere: 'redondance', poids: 1 }]];
    assert.equal(lire('modeObjectifs', { modeObjectifs: 'minimum' }), 'minimum');
    assert.equal(lire('priorites', { priorites: ordre }), ordre);
    assert.equal(lire('respecterObjectifs', { respecterObjectifs: false }), false);
    assert.equal(lire('rencontrerAnimateurs', { rencontrerAnimateurs: true }), true);
  });

  test('un genre inconnu lève, et le nomme', () => {
    assert.throws(() => valeurDuReglage({ generation: {} }, { nom: 'x', cle: 'x', genre: 'curseur' }), { name: 'RangeError', message: /"curseur"/ });
  });

  test('reglagesDuGenre et reglagesDeSection gardent l’ordre de la définition reçue, et une définition vide n’en rend aucun', () => {
    const definition = [...REGLAGES_GENERATION].reverse();
    assert.deepEqual(
      reglagesDuGenre(definition, 'champ').map(({ nom }) => nom),
      ['historique', 'arret', 'nombre'],
    );
    assert.deepEqual(
      reglagesDeSection(definition, 'generation').slice(0, 2).map(({ nom }) => nom),
      ['priorites', 'modeObjectifs'],
    );
    assert.deepEqual(reglagesDuGenre([], 'bascule'), []);
    assert.deepEqual(reglagesDeSection([], 'generation'), []);
  });
});
