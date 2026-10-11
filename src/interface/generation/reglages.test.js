// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la définition des réglages de la charge (§ 5.3, § 5.7,
// § 5.10, § 8.9, § 19.8) : sa forme, figée ; l'ordre des écrans ; les
// défauts, ceux d'une charge neuve, GENERATION_PAR_DEFAUT et
// CIBLE_REDONDANCE_PAR_DEFAUT compris ; chaque réglage du schéma du fichier,
// facultatif compris, et lui seul ; les clés que les commandes acceptent et
// les libellés qui existent ; la lecture d'une valeur dans une charge.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { appliquerCommande } from '../../application/commandes.js';
import { creerTraduction } from '../../application/traduction.js';
import { CIBLE_REDONDANCE_PAR_DEFAUT, GENERATION_PAR_DEFAUT, SCHEMA, creerCharge } from '../../stockage/document.js';
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
  ['respecterObjectifs', 'case des objectifs, sans entrée à l’écran de la génération'],
  ['modeObjectifs', 'mode des objectifs, sans entrée à l’écran de la génération'],
  ['rencontrerAnimateurs', 'case des animateurs, sans entrée à l’écran de la génération'],
]);

// La commande qui écrit un réglage de chaque section, et ses arguments.
const ECRITURES = new Map([
  ['generation', (entree, valeur) => ['modifierReglage', { cle: entree.cle, valeur }]],
  ['propositions', (entree, valeur) => ['changerCibleRedondance', { cible: String(valeur) }]],
]);

describe('REGLAGES_GENERATION : la définition que lisent les écrans et la documentation (§ 19.8)', () => {
  test('chaque entrée porte nom, cle, etiquette, unite, defaut, genre et section ; la définition comme chaque entrée sont figées', () => {
    assert.ok(REGLAGES_GENERATION.length > 0, 'définition vide');
    assert.ok(Object.isFrozen(REGLAGES_GENERATION));
    for (const entree of REGLAGES_GENERATION) {
      assert.deepEqual(Object.keys(entree), ['nom', 'cle', 'etiquette', 'unite', 'defaut', 'genre', 'section']);
      assert.ok(Object.isFrozen(entree), entree.nom);
    }
    assert.throws(() => REGLAGES_GENERATION.push({}), TypeError);
  });

  test('l’ordre des écrans : les trois champs de la recherche, les bascules du § 5.3, puis la cible de la section des propositions', () => {
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
        ['generation', 'bascule', 'attribuerSieges'],
        ['propositions', 'champ', 'cibleRedondance'],
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
    assert.equal(bascules.length, 5);
    for (const { nom, cle, etiquette, unite } of bascules) {
      assert.equal(cle, nom);
      assert.equal(etiquette, `generation.contrainte.${nom}`);
      assert.equal(unite, null);
    }
    assert.equal(champs.length + bascules.length, generation.length);
  });

  test('la cible de la somme de redondance : un champ de la section des propositions, à la racine des réglages, sous le libellé de son champ, sans unité', () => {
    assert.deepEqual(reglagesDeSection(REGLAGES_GENERATION, 'propositions'), [
      {
        nom: 'cibleRedondance',
        cle: 'cibleRedondance',
        etiquette: 'propositions.cible.etiquette',
        unite: null,
        defaut: CIBLE_REDONDANCE_PAR_DEFAUT,
        genre: 'champ',
        section: 'propositions',
      },
    ]);
  });

  test('chaque défaut est celui d’une charge neuve : GENERATION_PAR_DEFAUT pour les champs, les bascules de creerCharge, CIBLE_REDONDANCE_PAR_DEFAUT pour la cible absente', () => {
    const { reglages } = chargeNeuveEpreuve();
    assert.equal(Object.hasOwn(reglages, 'cibleRedondance'), false);
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
      [true, true, true, true, false],
    );
  });

  test('chaque réglage du schéma du fichier, facultatif compris, a son entrée, et chaque entrée en désigne un : aucun n’échappe aux écrans ni au tableau, hors des réglages nommés sans entrée', () => {
    const chemins = cheminsDuSchema();
    assert.ok(chemins.includes('cibleRedondance') && chemins.includes('generation.nombre'), chemins.join(', '));
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
      const valeur = entree.genre === 'bascule' ? !entree.defaut : entree.defaut + 1;
      const [commande, args] = ECRITURES.get(entree.section)(entree, valeur);
      charge = appliquerCommande(commande, charge, args).charge;
      assert.equal(valeurDuReglage(charge.reglages, entree), valeur, entree.cle);
      assert.notEqual(t(entree.etiquette), entree.etiquette);
    }
    assert.deepEqual([...new Set(REGLAGES_GENERATION.map(({ section }) => section))], [...ECRITURES.keys()]);
  });
});

describe('valeurDuReglage, reglagesDuGenre et reglagesDeSection', () => {
  test('la valeur d’un réglage se lit au chemin de sa clé : sous generation pour un champ de la génération, à la racine sinon', () => {
    const reglages = { nouvelleTable: false, cibleRedondance: 7, generation: { nombre: 9 } };
    const [nombre] = REGLAGES_GENERATION;
    const nouvelleTable = REGLAGES_GENERATION.find(({ nom }) => nom === 'nouvelleTable');
    const cible = REGLAGES_GENERATION.find(({ nom }) => nom === 'cibleRedondance');
    assert.equal(valeurDuReglage(reglages, nombre), 9);
    assert.equal(valeurDuReglage(reglages, nouvelleTable), false);
    assert.equal(valeurDuReglage(reglages, cible), 7);
  });

  test('un réglage facultatif absent vaut son défaut', () => {
    const cible = REGLAGES_GENERATION.find(({ nom }) => nom === 'cibleRedondance');
    assert.equal(valeurDuReglage({ generation: {} }, cible), CIBLE_REDONDANCE_PAR_DEFAUT);
    assert.equal(valeurDuReglage({ generation: {} }, { ...cible, defaut: 3 }), 3);
  });

  test('un genre inconnu lève, et le nomme', () => {
    assert.throws(() => valeurDuReglage({ generation: {} }, { nom: 'x', cle: 'x', genre: 'curseur' }), { name: 'RangeError', message: /"curseur"/ });
  });

  test('reglagesDuGenre et reglagesDeSection gardent l’ordre de la définition reçue, et une définition vide n’en rend aucun', () => {
    const definition = [...REGLAGES_GENERATION].reverse();
    assert.deepEqual(
      reglagesDuGenre(definition, 'champ').map(({ nom }) => nom),
      ['cibleRedondance', 'historique', 'arret', 'nombre'],
    );
    assert.deepEqual(
      reglagesDeSection(definition, 'generation').slice(0, 2).map(({ nom }) => nom),
      ['attribuerSieges', 'varierAppartenances'],
    );
    assert.deepEqual(reglagesDuGenre([], 'bascule'), []);
    assert.deepEqual(reglagesDeSection([], 'generation'), []);
  });
});
