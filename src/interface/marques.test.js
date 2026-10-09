// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des marques porteuses d'information et des textes (§ 14.5,
// § 7.5, § 7.6, § 7.7), et la palette de jetons.css validée par calcul sur
// lui (§ 12.7) : chaque entrée tient son seuil sur chacun de ses fonds, dans
// les deux thèmes, en couleurs d'origine puis sous les trois dichromaties.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { CONFLITS, JETONS_CONFLIT, MARQUES, SEPARATIONS, TEXTES } from './marques.js';
import { lireBlocs, lireJetons, verifierPalette, verifierSeparation } from './palette.js';

const JETONS = readFileSync(new URL('./jetons.css', import.meta.url), 'utf8');
const THEMES = ['clair', 'sombre'];

const NOMS_MARQUES = [
  'cadenasFerme', 'cadenasOuvert', 'anneau', 'hachure', 'remplissagePlein',
  'contourConflit', 'trameAppartenance', 'trameVoisins', 'trameTable', 'pastille', 'poignee', 'gel', 'miseEnEvidence',
  'selection', 'cadreLecture', 'cadreEcriture', 'cadreBloque', 'focus',
  'contourTable', 'contourChaise', 'echelle', 'fantome', 'chargement', 'filigrane',
];

// Les remplissages d'une chaise : fond, pleine, et les deux couleurs de la
// hachure — ses traits sur le fond de la chaise.
const REMPLISSAGES_CHAISE = ['--couleur-chaise-fond', '--couleur-chaise-pleine', '--couleur-hachure'];

// Fonds minimaux des marques de désignation et du fantôme. « chaise » vaut
// chacun des remplissages d'une chaise : la marque se pose sur une chaise
// vide, pourvue ou à pourvoir.
const c = (nom) => `--couleur-${nom}`;
const FONDS_REQUIS = {
  focus: [...['page-fond', 'bandeau-fond', 'sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
  selection: [...['page-fond', 'sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
  miseEnEvidence: [...['page-fond', 'sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
  fantome: [...['sol', 'table-fond'].map(c), ...REMPLISSAGES_CHAISE],
};

const parNom = (registre, nom) => registre.find((e) => e.nom === nom);

describe('registre des marques', () => {
  test('les vingt-quatre marques du contrat, noms uniques, seuil 3, au moins un fond chacune', () => {
    assert.equal(MARQUES.length, NOMS_MARQUES.length);
    assert.deepEqual(MARQUES.map((m) => m.nom), NOMS_MARQUES);
    assert.equal(new Set(MARQUES.map((m) => m.nom)).size, MARQUES.length);
    for (const marque of MARQUES) {
      assert.deepEqual(Object.keys(marque).sort(), ['fonds', 'jeton', 'nom', 'seuil'], marque.nom);
      assert.equal(marque.seuil, 3, marque.nom);
      assert.ok(marque.fonds.length > 0, marque.nom);
      assert.equal(new Set(marque.fonds).size, marque.fonds.length, `${marque.nom} : fond en double`);
    }
  });

  test('le registre est figé', () => {
    assert.ok(Object.isFrozen(MARQUES) && Object.isFrozen(TEXTES));
    assert.ok(MARQUES.every((m) => Object.isFrozen(m) && Object.isFrozen(m.fonds)));
    assert.ok(TEXTES.every((m) => Object.isFrozen(m) && Object.isFrozen(m.fonds)));
  });

  test('le focus, la sélection, la mise en évidence et le fantôme se mesurent sur chaque fond où ils se peignent, chaque remplissage de chaise compris', () => {
    for (const nom of ['focus', 'selection', 'miseEnEvidence', 'fantome']) {
      const marque = parNom(MARQUES, nom);
      assert.notEqual(marque, undefined, nom);
      for (const fond of FONDS_REQUIS[nom]) {
        assert.ok(marque.fonds.includes(fond), `${nom} : ${fond}`);
      }
    }
  });

  test('une marque posée sur une chaise se mesure sur chacun de ses remplissages', () => {
    const surChaise = ['cadenasFerme', 'cadenasOuvert', 'anneau'];
    for (const nom of surChaise) {
      for (const fond of REMPLISSAGES_CHAISE) {
        assert.ok(parNom(MARQUES, nom).fonds.includes(fond), `${nom} : ${fond}`);
      }
    }
    assert.deepEqual(parNom(MARQUES, 'hachure').fonds, ['--couleur-chaise-fond']);
  });

  test('chaque jeton et chaque fond du registre existe dans les deux thèmes', () => {
    const entrees = [...MARQUES, ...TEXTES];
    assert.ok(entrees.length > 20);
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const entree of entrees) {
        for (const nom of [entree.jeton, ...entree.fonds]) {
          assert.ok(jetons.has(nom), `${theme} : ${entree.nom} → ${nom}`);
        }
      }
    }
  });
});

describe('le filigrane BROUILLON sur le papier (§ 11.7, § 14.5)', () => {
  test('une marque du registre, peinte de --couleur-filigrane sur le papier, à 3:1', () => {
    const filigrane = parNom(MARQUES, 'filigrane');
    assert.deepEqual({ ...filigrane, fonds: [...filigrane.fonds] }, {
      nom: 'filigrane',
      jeton: '--couleur-filigrane',
      fonds: ['--couleur-papier'],
      seuil: 3,
    });
  });

  test('le papier est clair dans les deux thèmes : le filigrane et le papier gardent leur valeur d’un thème à l’autre, et le papier est celle du clair', () => {
    const [clair, sombre] = THEMES.map((theme) => lireJetons(JETONS, theme));
    for (const nom of ['--couleur-filigrane', '--couleur-papier']) {
      assert.notEqual(clair.get(nom), undefined, nom);
      assert.deepEqual(sombre.get(nom), clair.get(nom), nom);
    }
    assert.deepEqual(clair.get('--couleur-papier'), [255, 255, 255, 1]);
  });
});

describe('les trois sortes de conflit (§ 7.5, § 12.7)', () => {
  test('une par règle localisable, dans l’ordre du moteur : sa règle, la marque de sa trame, le jeton de sa teinte, la forme de son motif', () => {
    assert.deepEqual(
      CONFLITS.map((c) => [c.regle, c.marque, c.jeton, c.forme]),
      [
        ['separerAppartenances', 'trameAppartenance', '--couleur-conflit-appartenance', 'hachuresDescendantes'],
        ['nouveauxVoisins', 'trameVoisins', '--couleur-conflit-voisins', 'hachuresMontantes'],
        ['nouvelleTable', 'trameTable', '--couleur-conflit-table', 'points'],
      ],
    );
    assert.ok(CONFLITS.every((c) => Object.keys(c).sort().join() === 'forme,jeton,marque,regle'));
    assert.ok(Object.isFrozen(CONFLITS) && CONFLITS.every((c) => Object.isFrozen(c)));
    assert.deepEqual(JETONS_CONFLIT, CONFLITS.map(({ jeton }) => jeton));
    assert.ok(Object.isFrozen(JETONS_CONFLIT));
    // Les seuils d'écart perçu : entre deux teintes de conflit, et d'une
    // teinte de conflit à une autre marque du plan.
    assert.deepEqual(SEPARATIONS, { entreConflits: 12, autresMarques: 5 });
    assert.ok(Object.isFrozen(SEPARATIONS));
  });

  test('chaque trame est au registre, peinte de son jeton sur le fond du plateau', () => {
    for (const { marque, jeton } of CONFLITS) {
      const entree = parNom(MARQUES, marque);
      assert.notEqual(entree, undefined, marque);
      assert.equal(entree.jeton, jeton, marque);
      assert.deepEqual(entree.fonds, ['--couleur-table-fond'], marque);
    }
  });

  test('teinte réservée au registre : une teinte de conflit ne peint que sa trame, aucune autre marque ni aucun texte', () => {
    const peintes = [...MARQUES, ...TEXTES].filter((e) => JETONS_CONFLIT.includes(e.jeton) || e.fonds.some((f) => JETONS_CONFLIT.includes(f)));
    assert.deepEqual(peintes.map((e) => e.nom), CONFLITS.map(({ marque }) => marque));
    // Le contour épaissi d'une table en conflit est commun aux trois règles :
    // il ne porte aucune de leurs teintes.
    assert.ok(!JETONS_CONFLIT.includes(parNom(MARQUES, 'contourConflit').jeton));
  });
});

describe('registre des textes', () => {
  test('page, secondaire, bandeau, refus, avis, listes du plan, pastille ; seuil 4,5', () => {
    assert.deepEqual(TEXTES.map((t) => t.nom), ['page', 'secondaire', 'bandeau', 'refus', 'avis', 'listes', 'pastille']);
    assert.ok(TEXTES.every((t) => t.seuil === 4.5 && t.fonds.length > 0));
    assert.deepEqual(parNom(TEXTES, 'listes').fonds, ['--couleur-sol']);
    assert.deepEqual(parNom(TEXTES, 'pastille').fonds, ['--couleur-pastille-fond']);
  });
});

describe('palette de jetons.css validée par calcul (§ 12.7, § 14.5)', () => {
  test('aucun jeton de texte ou de marque, ni aucun de leurs fonds, n’a de canal alpha', () => {
    const noms = new Set([...MARQUES, ...TEXTES].flatMap((e) => [e.jeton, ...e.fonds]));
    assert.ok(noms.size > 20);
    const blocs = lireBlocs(JETONS);
    for (const theme of THEMES) {
      const selecteur = `:root[data-theme='${theme}']`;
      const brutes = new Map(
        blocs.filter((b) => b.selecteurs.includes(selecteur)).flatMap((b) => [...b.declarations]),
      );
      const jetons = lireJetons(JETONS, theme);
      for (const nom of noms) {
        assert.equal(jetons.get(nom)[3], 1, `${theme} : ${nom}`);
        assert.doesNotMatch(
          brutes.get(nom),
          /rgba|hsla|transparent|#[0-9a-f]{8}\b|#[0-9a-f]{4}\b|\/\s*[\d.]+%?\s*\)/i,
          `${theme} : ${nom}`,
        );
      }
    }
  });

  test('chaque marque tient 3:1 sur chacun de ses fonds, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, MARQUES), []);
  });

  test('chaque texte tient 4,5:1 sur chacun de ses fonds, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, TEXTES), []);
  });

  // Les autres marques du plan : celles qui se peignent sur le sol, le
  // plateau ou une chaise, trames de conflit exceptées, chaque jeton une fois.
  const FONDS_DU_PLAN = new Set(['--couleur-sol', '--couleur-table-fond', ...REMPLISSAGES_CHAISE]);
  const autresMarquesDuPlan = () => [
    ...new Set(MARQUES.filter((m) => !JETONS_CONFLIT.includes(m.jeton) && m.fonds.some((f) => FONDS_DU_PLAN.has(f))).map((m) => m.jeton)),
  ];

  test(`les trois teintes de conflit se séparent deux à deux de ${SEPARATIONS.entreConflits} au moins (OKLab × 100), dans les deux thèmes, en couleurs d’origine et sous les trois simulations`, () => {
    assert.equal(JETONS_CONFLIT.length, 3);
    assert.deepEqual(verifierSeparation(JETONS, JETONS_CONFLIT, [], SEPARATIONS.entreConflits), []);
  });

  test(`chaque teinte de conflit se sépare de ${SEPARATIONS.autresMarques} au moins de chaque autre marque du plan, dans les deux thèmes, sous les trois simulations`, () => {
    const autres = autresMarquesDuPlan();
    assert.ok(autres.length >= 10, `${autres.length} autres marques`);
    for (const jeton of ['--couleur-gel', '--couleur-mise-en-evidence', '--couleur-selection', '--couleur-focus', '--couleur-fantome', '--couleur-pastille-fond']) {
      assert.ok(autres.includes(jeton), jeton);
    }
    assert.deepEqual(verifierSeparation(JETONS, JETONS_CONFLIT, autres, SEPARATIONS.autresMarques), []);
  });
});
