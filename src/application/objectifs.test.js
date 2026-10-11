// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des étiquettes et des objectifs côté application (§ 4.5, § 5.9) :
// les avis d'objectifs — un objectif auquel aucune personne présente ne
// correspond, une étiquette d'objectif que personne ne porte —, et la
// réception d'une saisie d'étiquettes, réconciliée sur l'événement entier.
// Les noms et les étiquettes d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { creerCharge } from '../stockage/document.js';
import { avisDeLObjectif, avisObjectifs, etiquettesDeLEvenement, recevoirEtiquettes } from './objectifs.js';

const personne = (id, nom, etiquettes, autres = {}) => ({
  id,
  nom,
  prenom: null,
  appartenance: null,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...(etiquettes === undefined ? {} : { etiquettes }),
  ...autres,
});

const objectif = (tour, etiquettes, regle = null) => ({ portee: tour === null ? 'tous' : 'tour', tour, regle, etiquettes });

const table = (id, objectifs) => ({
  id,
  numero: id,
  sieges: null,
  forme: 'ronde',
  position: { x: 300 * id, y: 0 },
  ...(objectifs === undefined ? {} : { objectifs }),
});

// Trois personnes : Iris Ombrelle « finance » et « Montréal », Théo
// Pervenche « finance », Ondine Lacasse sans étiquette ; trois tours.
function chargeDe(tables, { participants } = {}) {
  const charge = creerCharge({ id: 'evt-objectifs', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 3 });
  charge.participants = participants ?? [
    personne(1, 'Ombrelle', ['Montréal', 'finance']),
    personne(2, 'Pervenche', ['finance']),
    personne(3, 'Lacasse'),
  ];
  charge.tables = tables;
  charge.prochainsIds = { participant: charge.participants.length + 1, table: 9, proposition: 1 };
  return charge;
}

// Gèle une valeur en profondeur : une fonction qui la modifierait lèverait.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

describe('objectifs : les avis (§ 4.5, § 5.9)', () => {
  test('sans objectif, aucun avis ; un objectif servi, aucun avis', () => {
    assert.deepEqual(avisObjectifs(chargeDe([table(1), table(2)])), []);
    assert.deepEqual(avisObjectifs(chargeDe([table(1, [objectif(null, ['finance'])])])), []);
  });

  test('« toutes » sans personne qui porte chaque étiquette : OBJECTIF_SANS_CORRESPONDANT {table, tour} ; « au moins une », servi', () => {
    const charge = chargeDe([table(1, [objectif(2, ['finance', 'ressources humaines'], 'et')])]);
    charge.participants.push(personne(4, 'Grisaille', ['ressources humaines']));
    assert.deepEqual(avisObjectifs(charge), [{ code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 1, tour: 2 } }]);
    charge.tables[0].objectifs[0].regle = 'ou';
    assert.deepEqual(avisObjectifs(charge), []);
  });

  test('un objectif qui suit le défaut lit la règle de l’événement ; une règle propre ne la suit pas', () => {
    const charge = chargeDe([
      table(1, [objectif(null, ['finance', 'bénévole'])]),
      table(2, [objectif(null, ['finance', 'bénévole'], 'ou')]),
    ]);
    charge.participants.push(personne(4, 'Grisaille', ['bénévole']));
    assert.deepEqual(avisObjectifs(charge), []);
    charge.reglages.regleObjectifs = 'et';
    assert.deepEqual(avisObjectifs(charge), [{ code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 1, tour: null } }]);
  });

  test('une personne exclue ne sert aucun objectif, mais son étiquette n’est pas orpheline', () => {
    // A12 : « une étiquette d'objectif qu'aucune personne ne porte », exclue
    // comprise ; seule la correspondance lit les personnes présentes.
    const charge = chargeDe([table(1, [objectif(null, ['bénévole', 'Voile'])])]);
    charge.participants.push(personne(4, 'Grisaille', ['bénévole', 'voile'], { exclu: true }));
    assert.deepEqual(avisObjectifs(charge), [
      { code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 1, tour: null } },
      { code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'Voile', voisine: 'voile' } },
    ]);
  });

  test('une étiquette d’objectif que personne ne porte : ETIQUETTE_ORPHELINE, avec l’orthographe voisine que porte une personne', () => {
    // « Finance » et « finance » ne se réunissent qu'à l'entrée : un fichier
    // retouché à la main peut les porter toutes deux.
    const charge = chargeDe([table(1, [objectif(null, ['Finance', 'Montréal'])])]);
    assert.deepEqual(avisObjectifs(charge), [{ code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'Finance', voisine: 'finance' } }]);
  });

  test('une étiquette orpheline visée par deux objectifs se dit une fois, à son premier objectif', () => {
    const charge = chargeDe([
      table(2, [objectif(null, ['finance', 'voile']), objectif(1, ['voile'])]),
      table(1, [objectif(3, ['voile', 'Montréal'])]),
    ]);
    assert.deepEqual(avisObjectifs(charge), [
      { code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'voile', voisine: null } },
      { code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 2, tour: 1 } },
    ]);
  });

  test('l’ordre : les tables par identifiant, la soirée puis les tours croissants, quel que soit l’ordre de la charge', () => {
    const charge = chargeDe([
      table(3, [objectif(2, ['voile']), objectif(null, ['escalade'])]),
      table(1, [objectif(1, ['plongée'])]),
    ]);
    assert.deepEqual(
      avisObjectifs(figer(charge)).map(({ code, details }) => [code, details.table ?? details.etiquette, details.tour ?? null]),
      [
        ['OBJECTIF_SANS_CORRESPONDANT', 1, 1],
        ['ETIQUETTE_ORPHELINE', 'plongée', null],
        ['OBJECTIF_SANS_CORRESPONDANT', 3, null],
        ['ETIQUETTE_ORPHELINE', 'escalade', null],
        ['OBJECTIF_SANS_CORRESPONDANT', 3, 2],
        ['ETIQUETTE_ORPHELINE', 'voile', null],
      ],
    );
  });
});

describe('objectifs : les avis d’un seul objectif', () => {
  test('avisDeLObjectif dit chaque étiquette orpheline de cet objectif, même déjà dite à un autre ; [] sans objectif au couple', () => {
    const charge = chargeDe([table(1, [objectif(null, ['voile'])]), table(2, [objectif(null, ['finance']), objectif(2, ['voile', 'finance'])])]);
    assert.deepEqual(avisDeLObjectif(charge, 2, 2), [{ code: 'ETIQUETTE_ORPHELINE', details: { etiquette: 'voile', voisine: null } }]);
    assert.deepEqual(avisDeLObjectif(charge, 2, null), []);
    assert.deepEqual(avisDeLObjectif(charge, 2, 1), []);
    assert.deepEqual(avisDeLObjectif(charge, 9, null), []);
  });
});

describe('objectifs : la saisie d’étiquettes (§ 4.5, D1)', () => {
  test('etiquettesDeLEvenement : les étiquettes des personnes, puis celles des objectifs, dans l’ordre de la charge, doublons admis', () => {
    const charge = chargeDe([table(2, [objectif(null, ['voile', 'finance'])]), table(1, [objectif(1, ['Montréal'])])]);
    assert.deepEqual(etiquettesDeLEvenement(charge), ['Montréal', 'finance', 'finance', 'voile', 'finance', 'Montréal']);
  });

  test('une saisie reçoit l’orthographe existante de sa clé, et le dit ; triée par unités de code', () => {
    const recue = recevoirEtiquettes(['finance', 'Montréal'], ' FINANCE ;  voile  | montreal ');
    assert.deepEqual(recue.etiquettes, ['Montréal', 'finance', 'voile']);
    assert.deepEqual(recue.avertissements, [
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'FINANCE', retenue: 'finance' } },
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'montreal', retenue: 'Montréal' } },
    ]);
  });

  test('deux orthographes déjà présentes : la plus petite par points de code est reçue', () => {
    assert.deepEqual(recevoirEtiquettes(['finance', 'Finance'], 'FINANCE').etiquettes, ['Finance']);
  });

  test('deux orthographes d’une clé neuve dans la même saisie se fondent en la plus petite, sans avertissement', () => {
    // L'événement ne porte pas la clé : aucune orthographe n'est « déjà
    // portée », et le doublon se fond en silence (§ 4.5).
    const recue = recevoirEtiquettes([], 'Montréal, MONTRÉAL, Montréal');
    assert.deepEqual(recue.etiquettes, ['MONTRÉAL']);
    assert.deepEqual(recue.avertissements, []);
  });

  test('deux orthographes d’une clé que l’événement porte : chacune reçoit l’existante, et chacune le dit', () => {
    const recue = recevoirEtiquettes(['Montréal'], 'MONTRÉAL, montreal, Montréal');
    assert.deepEqual(recue.etiquettes, ['Montréal']);
    assert.deepEqual(recue.avertissements, [
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'MONTRÉAL', retenue: 'Montréal' } },
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'montreal', retenue: 'Montréal' } },
    ]);
  });

  test('une saisie décomposée entre composée ; les séparateurs seuls ne donnent aucune étiquette', () => {
    assert.deepEqual(recevoirEtiquettes([], 'Montre\u{0301}al').etiquettes, ['Montréal']);
    assert.deepEqual(recevoirEtiquettes([], ' ,; | ').etiquettes, []);
  });

  test('un morceau fautif refuse la saisie entière : ETIQUETTE_INVALIDE {valeur, raison}, remède null', () => {
    assert.throws(
      () => recevoirEtiquettes([], 'finance, a\u{0009}b'),
      (erreur) => {
        assert.equal(erreur.code, 'ETIQUETTE_INVALIDE');
        assert.deepEqual(erreur.details, { valeur: 'a\u{0009}b', raison: 'controle', remede: null });
        return true;
      },
    );
    assert.throws(() => recevoirEtiquettes([], 'x'.repeat(41)), (erreur) => erreur.details.raison === 'longueur');
    assert.deepEqual(recevoirEtiquettes([], 'x'.repeat(40)).etiquettes, ['x'.repeat(40)]);
    assert.throws(() => recevoirEtiquettes([], null), TypeError);
  });
});
