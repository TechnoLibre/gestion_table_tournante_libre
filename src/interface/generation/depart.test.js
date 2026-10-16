// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le départ d'une génération dérivée dans la section de la génération
// (§ 5.7, C6) : la carte du départ — son numéro, une case par tour, le
// libellé de « Générer » sous lui — et l'issue d'une génération dérivée,
// lue dans la table d'évaluation, sans tri ni compte. Les tables
// d'évaluation d'épreuve ne portent que ce que l'issue lit : l'ordre du
// classement.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { carteDuDepart, issueDerivee } from './depart.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une charge réduite à ce que la carte lit : le nombre de tours.
const chargeDe = (tours) => ({ evenement: { tours } });

// Une table d'évaluation réduite à l'ordre de son classement.
const tableDe = (ordre) => ({ classement: { ordre } });

// Le rendu d'une génération dérivée depuis la proposition depart.
const rendu = ({ ajoutees, identiques = 0, identiquesAuDepart = 0, depart = 4, toursFiges = [] }) => ({
  ajoutees,
  identiques,
  identiquesAuDepart,
  dureeMs: 0,
  depart: { id: depart, toursFiges },
});

// Le texte qu'une issue écrit.
const texte = (issue) => t(issue.cle, issue.details);

describe('la carte du départ', () => {
  test('sans départ, aucune carte', () => {
    assert.equal(carteDuDepart(chargeDe(3), null), null);
  });

  test('sous un départ : son numéro, une case par tour de la soirée, cochée pour un tour figé, et « Générer depuis n° 4 »', () => {
    const carte = carteDuDepart(chargeDe(3), { id: 4, toursFiges: [2] });
    assert.deepEqual(carte, {
      depart: 4,
      cases: [
        { tour: 1, coche: false },
        { tour: 2, coche: true },
        { tour: 3, coche: false },
      ],
      commande: { cle: 'generation.commande.genererDepuis', nom: 'genererDepuis', details: { depart: 4 } },
    });
    assert.equal(t(carte.commande.cle, carte.commande.details), 'Générer depuis n° 4');
    assert.equal(t('generation.depart.titre', { depart: 4 }), 'Départ : proposition n° 4');
  });

  test('un départ choisi part de cases toutes décochées ; un tour figé au-delà de la soirée n’a pas de case', () => {
    assert.deepEqual(
      carteDuDepart(chargeDe(2), { id: 7, toursFiges: [] }).cases.map(({ coche }) => coche),
      [false, false],
    );
    assert.deepEqual(carteDuDepart(chargeDe(2), { id: 7, toursFiges: [1, 5] }).cases, [
      { tour: 1, coche: true },
      { tour: 2, coche: false },
    ]);
  });

  test('une soirée d’un seul tour a sa case : la cocher fige tous les tours, que le lancement refuse contre les cases', () => {
    assert.deepEqual(carteDuDepart(chargeDe(1), { id: 2, toursFiges: [1] }).cases, [{ tour: 1, coche: true }]);
  });

  test('dix tours, dix cases, chacune son libellé distinct', () => {
    const { cases } = carteDuDepart(chargeDe(10), { id: 3, toursFiges: [] });
    const libelles = cases.map(({ tour }) => t('generation.depart.tour', { tour }));
    assert.equal(new Set(libelles).size, 10);
    assert.equal(libelles[9], 'Tour 10');
  });
});

describe('l’issue d’une génération dérivée', () => {
  test('toutes les dérivées égales à leur départ : « n’avait rien à reprendre », sans comparaison', () => {
    const issue = issueDerivee(tableDe([4, 1]), rendu({ ajoutees: [], identiques: 3, identiquesAuDepart: 3 }));
    assert.deepEqual(issue, { cle: 'generation.issue.departSansReprise', details: { depart: 4 }, comparer: null });
    assert.equal(texte(issue), "La proposition n° 4 n'avait rien à reprendre sous ces réglages : ses propositions dérivées l'égalent toutes, et sont écartées.");
  });

  test('toutes écartées, une seule égale à une autre proposition : l’issue d’une génération ordinaire, jamais « rien à reprendre »', () => {
    for (const [identiques, identiquesAuDepart] of [[3, 2], [1, 0]]) {
      const issue = issueDerivee(tableDe([4, 1]), rendu({ ajoutees: [], identiques, identiquesAuDepart }));
      assert.deepEqual(issue, { cle: 'generation.issue.ajoutees', details: { ajoutees: 0, identiques }, comparer: null });
      assert.doesNotMatch(texte(issue), /reprendre/);
    }
  });

  test('cinq dérivées : la meilleure au classement et sa place, la place du départ, les identiques écartées, et la paire à comparer', () => {
    // Le classement range n° 7, puis n° 23, puis le départ n° 4.
    const table = tableDe([7, 23, 4, 21, 1, 25, 22, 24]);
    const issue = issueDerivee(table, rendu({ ajoutees: [21, 22, 23, 24, 25], identiques: 1, identiquesAuDepart: 1 }));
    assert.deepEqual(issue, {
      cle: 'generation.issue.derivee',
      details: { ajoutees: 5, premier: 21, dernier: 25, depart: 4, meilleure: 23, placeMeilleure: 2, placeDepart: 3, identiques: 1 },
      comparer: { a: 23, depart: 4 },
    });
    assert.equal(
      texte(issue),
      '5 propositions dérivées de n° 4 (n° 21 à 25) ; la meilleure, n° 23, est 2\u{1D49} du classement ; n° 4 est 3\u{1D49} ; ' +
        '1 placement identique à une proposition présente, écarté.',
    );
    assert.equal(t('generation.commande.comparerIssue', issue.comparer), 'Comparer n° 23 à n° 4');
  });

  test('une seule dérivée, première du classement : « elle est première », le départ derrière', () => {
    const issue = issueDerivee(tableDe([21, 4]), rendu({ ajoutees: [21] }));
    assert.deepEqual(issue.details, {
      ajoutees: 1,
      premier: 21,
      dernier: 21,
      depart: 4,
      meilleure: 21,
      placeMeilleure: 1,
      placeDepart: 2,
      identiques: 0,
    });
    assert.equal(texte(issue), '1 proposition dérivée de n° 4 (n° 21) ; elle est 1\u{02B3}\u{1D49} du classement ; n° 4 est 2\u{1D49}.');
    assert.deepEqual(issue.comparer, { a: 21, depart: 4 });
  });

  test('le départ devant toutes ses dérivées : il est premier, la meilleure dérivée la suit', () => {
    const issue = issueDerivee(tableDe([4, 9, 8]), rendu({ ajoutees: [8, 9] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart], [9, 2, 1]);
    assert.match(texte(issue), /la meilleure, n° 9, est 2\u{1D49} du classement ; n° 4 est 1\u{02B3}\u{1D49}\.$/u);
  });

  test('le départ hors du classement — effacé entre-temps : aucune place pour lui, rien à comparer', () => {
    const issue = issueDerivee(tableDe([22, 21]), rendu({ ajoutees: [21, 22] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart, issue.comparer], [22, 1, null, null]);
    assert.equal(texte(issue), '2 propositions dérivées de n° 4 (n° 21 à 22) ; la meilleure, n° 22, est 1\u{02B3}\u{1D49} du classement.');
  });

  test('aucune dérivée classée : la place du départ seule, dite « du classement », rien à comparer', () => {
    const issue = issueDerivee(tableDe([4]), rendu({ ajoutees: [30] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart, issue.comparer], [null, null, 1, null]);
    assert.equal(texte(issue), '1 proposition dérivée de n° 4 (n° 30) ; n° 4 est 1\u{02B3}\u{1D49} du classement.');
  });

  test('sans table d’évaluation — une configuration que la mesure refuse : les propositions seules', () => {
    const issue = issueDerivee(null, rendu({ ajoutees: [21, 22] }));
    assert.deepEqual([issue.details.meilleure, issue.details.placeMeilleure, issue.details.placeDepart, issue.comparer], [null, null, null, null]);
    assert.equal(texte(issue), '2 propositions dérivées de n° 4 (n° 21 à 22).');
  });

  test('une génération ordinaire garde l’issue de toujours', () => {
    const ordinaire = { ajoutees: [6, 7], identiques: 1, identiquesAuDepart: 0, dureeMs: 0, depart: null };
    const issue = issueDerivee(tableDe([7, 6]), ordinaire);
    assert.deepEqual(issue, { cle: 'generation.issue.ajoutees', details: { ajoutees: 2, identiques: 1 }, comparer: null });
    assert.equal(texte(issue), '2 propositions ajoutées ; 1 placement identique à une proposition présente, écarté.');
  });

  test('la meilleure dérivée est la première que le classement range, quel que soit l’ordre de ses identifiants', () => {
    for (const ordre of [[25, 21, 4], [21, 25, 4], [4, 23, 21]]) {
      const issue = issueDerivee(tableDe(ordre), rendu({ ajoutees: [21, 23, 25] }));
      assert.equal(issue.details.meilleure, ordre.find((id) => id !== 4), JSON.stringify(ordre));
    }
  });

  test('le module ne trie rien : les places se lisent dans l’ordre du classement de la table', () => {
    const source = readFileSync(new URL('./depart.js', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /\.sort\(|toSorted\(|\.reverse\(/);
  });
});
