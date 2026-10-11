// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle des objectifs de table (§ 4.5, § 5.9, § 10.4, D3, D19) :
// ce que chaque objectif montre — ses étiquettes en texte, sa règle, l'état
// « suit le défaut » ou « règle propre » écrit en mots, ses avis —, les
// choix de règle, les étiquettes connues que la saisie propose, le nom de
// l'export. Les textes viennent de la traduction réelle ; les étiquettes et
// les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { avisDeLObjectif } from '../../application/objectifs.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  OPTIONS_REGLE_PAR_DEFAUT,
  basculerTable,
  etiquettesConnues,
  nomExportObjectifs,
  objectifsDeLaTable,
  optionsRegle,
  regleChoisie,
  regleParDefaut,
  vueObjectif,
} from './objectifs.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const personne = (id, nom, etiquettes) => ({
  id,
  nom,
  prenom: null,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...(etiquettes === undefined ? {} : { etiquettes }),
});

const objectif = (tour, regle, etiquettes) => ({ portee: tour === null ? 'tous' : 'tour', tour, regle, etiquettes });

// Trois personnes, deux tables, trois tours : Iris Ombrelle porte
// « finance » et « Montréal », Théo Pervenche « bénévole », Ondine Lacasse
// rien. La table 1 vise « finance » pour la soirée, règle propre « ou », et
// « bénévole » au tour 2 ; la table 2, numérotée 7, « cuisine » au tour 3,
// en suivant le défaut.
function chargeDe({ regleObjectifs } = {}) {
  const charge = creerCharge({ id: 'evt-objectifs', nom: 'Soirée des Merles', siegesParDefaut: 4, tours: 3 });
  charge.participants = [
    personne(1, 'Ombrelle', ['Montréal', 'finance']),
    personne(2, 'Pervenche', ['bénévole']),
    personne(3, 'Lacasse'),
  ];
  charge.tables = [
    { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 }, objectifs: [objectif(null, 'ou', ['finance']), objectif(2, null, ['bénévole'])] },
    { id: 2, numero: 7, sieges: null, forme: 'carree', position: { x: 300, y: 0 }, objectifs: [objectif(3, null, ['cuisine'])] },
  ];
  if (regleObjectifs !== undefined) charge.reglages.regleObjectifs = regleObjectifs;
  charge.prochainsIds = { participant: 4, table: 3, proposition: 1 };
  return charge;
}

describe('vueObjectif : ce que montre un objectif (§ 4.5, D3)', () => {
  test('l’objectif de la soirée, règle propre « ou » sous le défaut « ou » : son état dit « règle propre », jamais celui du défaut', () => {
    const charge = chargeDe();
    const vue = vueObjectif(charge, charge.tables[0], null);
    assert.equal(vue.cle, '1');
    assert.equal(vue.tour, null);
    assert.equal(vue.existe, true);
    assert.equal(vue.texte, 'finance');
    assert.equal(vue.regle, 'ou');
    assert.equal(vue.etat.cle, 'tables.objectif.reglePropre');
    assert.equal(vue.etat.ton, 'information');
    assert.equal(t(vue.etat.cle), 'Règle propre');
  });

  test('un objectif de tour qui suit le défaut : son état le dit, sa règle se choisit par la valeur vide', () => {
    const charge = chargeDe();
    const vue = vueObjectif(charge, charge.tables[0], 2);
    assert.equal(vue.cle, '1-2');
    assert.equal(vue.tour, 2);
    assert.equal(vue.regle, '');
    assert.equal(vue.etat.cle, 'tables.objectif.suitDefaut');
    assert.equal(vue.etat.ton, 'neutre');
    assert.notEqual(t(vue.etat.cle), t('tables.objectif.reglePropre'));
  });

  test('deux objectifs de même règle effective, l’un propre, l’autre qui suit le défaut : leurs états diffèrent', () => {
    const charge = chargeDe();
    charge.tables[0].objectifs[1].regle = null;
    const propre = vueObjectif(charge, charge.tables[0], null);
    const suit = vueObjectif(charge, charge.tables[0], 2);
    assert.equal(regleParDefaut(charge), 'ou');
    assert.notEqual(propre.etat.cle, suit.etat.cle);
    assert.notEqual(t(propre.etat.cle), t(suit.etat.cle));
  });

  test('un couple sans objectif : champ vide, ni règle ni état ni avis', () => {
    const charge = chargeDe();
    const vue = vueObjectif(charge, charge.tables[0], 3);
    assert.deepEqual(vue, { cle: '1-3', tour: 3, existe: false, texte: '', regle: '', etat: null, avis: [] });
  });

  test('les étiquettes s’écrivent jointes comme l’export, dans l’ordre du fichier ; les avis sont ceux de l’objectif', () => {
    const charge = chargeDe();
    charge.tables[0].objectifs[0].etiquettes = ['Montréal', 'finance'];
    charge.tables[0].objectifs[0].regle = 'et';
    assert.equal(vueObjectif(charge, charge.tables[0], null).texte, 'Montréal, finance');
    const cuisine = vueObjectif(charge, charge.tables[1], 3);
    assert.deepEqual(cuisine.avis, avisDeLObjectif(charge, 2, 3));
    assert.deepEqual(
      cuisine.avis.map(({ code }) => code),
      ['OBJECTIF_SANS_CORRESPONDANT', 'ETIQUETTE_ORPHELINE'],
    );
  });

  test('objectifsDeLaTable : la soirée, puis un objectif par tour de 1 à R, et le nombre de ceux qui existent', () => {
    const charge = chargeDe();
    const { soiree, tours, parTour } = objectifsDeLaTable(charge, charge.tables[0]);
    assert.equal(soiree.cle, '1');
    assert.deepEqual(tours.map(({ cle }) => cle), ['1-1', '1-2', '1-3']);
    assert.deepEqual(tours.map(({ existe }) => existe), [false, true, false]);
    assert.equal(parTour, 1);
    assert.equal(objectifsDeLaTable(charge, charge.tables[1]).soiree.existe, false);
    const sans = { ...charge.tables[1] };
    delete sans.objectifs;
    assert.equal(objectifsDeLaTable(charge, sans).parTour, 0);
  });

  test('vueObjectif ne modifie pas la charge', () => {
    const charge = chargeDe();
    const avant = structuredClone(charge);
    objectifsDeLaTable(charge, charge.tables[0]);
    assert.deepEqual(charge, avant);
  });
});

describe('les choix de règle (§ 4.5, D3)', () => {
  test('regleParDefaut : « ou » sans réglage, « et » réglé', () => {
    assert.equal(regleParDefaut(chargeDe()), 'ou');
    assert.equal(regleParDefaut(chargeDe({ regleObjectifs: 'et' })), 'et');
  });

  test('optionsRegle : le réglage général, nommé par la règle qu’il donne, puis « au moins une (OU) » et « toutes (ET) »', () => {
    const textes = (options) => options.map(({ valeur, cle, details }) => [valeur, t(cle, details)]);
    assert.deepEqual(textes(optionsRegle('ou')), [
      ['', 'selon le réglage général (au moins une)'],
      ['ou', 'au moins une (OU)'],
      ['et', 'toutes (ET)'],
    ]);
    assert.equal(t(optionsRegle('et')[0].cle, optionsRegle('et')[0].details), 'selon le réglage général (toutes)');
  });

  test('la règle par défaut se choisit entre « au moins une (OU) » et « toutes (ET) »', () => {
    assert.deepEqual(
      OPTIONS_REGLE_PAR_DEFAUT.map(({ valeur, cle }) => [valeur, t(cle)]),
      [
        ['ou', 'au moins une (OU)'],
        ['et', 'toutes (ET)'],
      ],
    );
  });

  test('regleChoisie : la valeur vide suit le défaut, null ; « ou » et « et » sont des règles propres', () => {
    assert.equal(regleChoisie(''), null);
    assert.equal(regleChoisie('ou'), 'ou');
    assert.equal(regleChoisie('et'), 'et');
    assert.throws(() => regleChoisie('peut-être'), RangeError);
  });
});

describe('ce que la saisie propose, ce que l’export nomme (§ 4.5, § 10.4)', () => {
  test('etiquettesConnues : personnes et objectifs, chacune une fois, par unités de code', () => {
    assert.deepEqual(etiquettesConnues(chargeDe()), ['Montréal', 'bénévole', 'cuisine', 'finance']);
    const vide = creerCharge({ id: 'evt-vide', nom: 'Soirée des Merles', siegesParDefaut: 4, tours: 1 });
    assert.deepEqual(etiquettesConnues(vide), []);
  });

  test('nomExportObjectifs : ‹base›-objectifs.csv, sur le patron de l’export des participants', () => {
    assert.equal(nomExportObjectifs('soiree'), 'soiree-objectifs.csv');
  });

  test('basculerTable : déplie une table repliée, replie une dépliée, sans toucher l’ensemble reçu', () => {
    const vide = new Set();
    const ouverte = basculerTable(vide, 4);
    assert.deepEqual([...ouverte], [4]);
    assert.deepEqual([...vide], []);
    assert.deepEqual([...basculerTable(ouverte, 4)], []);
    assert.deepEqual([...basculerTable(ouverte, 2)], [4, 2]);
  });
});
