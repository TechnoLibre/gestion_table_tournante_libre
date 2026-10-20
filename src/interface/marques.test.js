// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le registre des marques porteuses d'information et des textes (§ 14.5,
// § 7.5, § 7.6, § 7.7), et la palette de jetons.css validée par calcul sur
// lui (§ 12.7) : chaque entrée tient son seuil sur chacun de ses fonds, dans
// les deux thèmes, en couleurs d'origine puis sous les trois dichromaties.
// La famille « graphique » (§ 12.7, § 13.3) a ses listes, versées à la fin
// de MARQUES et de TEXTES, que les écrans de la qualité rendent ; ses fonds
// restent hors de toute mesure.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import {
  CONFLITS,
  ECHELLE_GRAPHIQUE,
  FONDS_GRAPHIQUE,
  JETONS_CONFLIT,
  MARQUES,
  MARQUES_GRAPHIQUE,
  NIVEAUX_GRAPHIQUE,
  SEPARATIONS,
  SIGNES,
  TEINTES_ORGANISATION,
  TEXTES,
  TEXTES_GRAPHIQUE,
} from './marques.js';
import {
  contraste,
  lireBlocs,
  lireJetons,
  simuler,
  teinte,
  verifierClartes,
  verifierPalette,
  verifierSeparation,
  verifierTeintesReservees,
} from './palette.js';

const JETONS = readFileSync(new URL('./jetons.css', import.meta.url), 'utf8');
const THEMES = ['clair', 'sombre'];

const NOMS_MARQUES = [
  'cadenasFerme', 'cadenasOuvert', 'anneau', 'hachure', 'remplissagePlein',
  'contourConflit', 'trameOrganisation', 'trameVoisins', 'trameTable', 'pastille', 'poignee', 'gel', 'miseEnEvidence',
  'selection', 'focus',
  'contourTable', 'contourChaise', 'echelle', 'fantome', 'chargement', 'filigrane', 'retrait',
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
  test('les trente-quatre marques du contrat — les vingt-deux du plan et des écrans, puis les douze de la famille « graphique » —, noms uniques, seuil 3, au moins un fond chacune', () => {
    const noms = [...NOMS_MARQUES, ...NOMS_MARQUES_GRAPHIQUE];
    assert.equal(MARQUES.length, noms.length);
    assert.deepEqual(MARQUES.map((m) => m.nom), noms);
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
    const entrees = [...MARQUES, ...TEXTES, ...SIGNES];
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
        ['separerOrganisations', 'trameOrganisation', '--couleur-conflit-organisation', 'hachuresDescendantes'],
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
    assert.deepEqual(SEPARATIONS, { entreConflits: 12, autresMarques: 5, entreOrganisations: 10, clarteOrganisations: 10 });
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
    const peintes = [...MARQUES, ...TEXTES, ...SIGNES].filter((e) => JETONS_CONFLIT.includes(e.jeton) || e.fonds.some((f) => JETONS_CONFLIT.includes(f)));
    assert.deepEqual(peintes.map((e) => e.nom), CONFLITS.map(({ marque }) => marque));
    // Le contour épaissi d'une table en conflit est commun aux trois règles :
    // il ne porte aucune de leurs teintes.
    assert.ok(!JETONS_CONFLIT.includes(parNom(MARQUES, 'contourConflit').jeton));
  });
});

describe('registre des textes', () => {
  test('page, secondaire, bandeau, refus, avis, listes du plan, pastille, numéro et libellé de table, puis les textes des cartes, des étiquettes, de la bande de mode, du bandeau, de l’action et des messages, puis les deux encres des cases de graphique ; seuil 4,5', () => {
    assert.deepEqual(TEXTES.map((t) => t.nom), [
      'page', 'secondaire', 'bandeau', 'refus', 'avis', 'listes', 'pastille', 'numeroTable', 'libelleTable',
      'carte', 'secondaireCarte', 'etiquette', 'bandeMode', 'bandeauSecondaire', 'bandeauChoisi', 'action', 'lien', 'information',
      'graphiqueEncreFoncee', 'graphiqueEncreClaire',
    ]);
    assert.ok(TEXTES.every((t) => t.seuil === 4.5 && t.fonds.length > 0));
    assert.equal(new Set(TEXTES.map((t) => t.nom)).size, TEXTES.length);
    assert.deepEqual(parNom(TEXTES, 'listes').fonds, ['--couleur-sol']);
    assert.deepEqual(parNom(TEXTES, 'pastille').fonds, ['--couleur-pastille-fond']);
  });

  test('le numéro d’une table s’écrit de l’encre des listes sur le fond du plateau, que son halo prolonge sous les trames (§ 7.7)', () => {
    const numero = parNom(TEXTES, 'numeroTable');
    assert.equal(numero.jeton, '--couleur-liste-texte');
    assert.deepEqual(numero.fonds, ['--couleur-table-fond']);
  });

  test('le libellé d’une table s’écrit comme son numéro, de l’encre des listes sur le fond du plateau, que son halo et ses socles prolongent sous les trames (§ 7.7)', () => {
    const libelle = parNom(TEXTES, 'libelleTable');
    assert.equal(libelle.jeton, '--couleur-liste-texte');
    assert.deepEqual(libelle.fonds, ['--couleur-table-fond']);
  });

  test('le texte d’une étiquette est l’encre de la page, sur chaque fond teinté d’une pastille (§ 12.7) ; celui d’un message, l’encre de son message sur son fond', () => {
    const etiquette = parNom(TEXTES, 'etiquette');
    assert.equal(etiquette.jeton, '--couleur-page-texte');
    const fondsTeintes = [
      'neutre', 'etat-brouillon', 'etat-propose', 'etat-retenu', 'etat-bloque', 'avis', 'refus', 'information',
      ...TEINTES_ORGANISATION.map(({ rang }) => `organisation-${rang}`),
    ].map((teinte) => `--couleur-${teinte}-fond`);
    for (const fond of fondsTeintes) assert.ok(etiquette.fonds.includes(fond), fond);
    assert.deepEqual(parNom(TEXTES, 'bandeMode').fonds, ['ecriture', 'lecture', 'bloque'].map((m) => `--couleur-mode-${m}-fond`));
    for (const message of ['refus', 'avis', 'information']) {
      const entree = parNom(TEXTES, message);
      assert.equal(entree.jeton, `--couleur-${message}`, message);
      for (const fond of [`--couleur-${message}-fond`, '--couleur-page-fond', '--couleur-carte-fond']) assert.ok(entree.fonds.includes(fond), `${message} : ${fond}`);
    }
  });
});

describe('les signes des pastilles, des messages, de la bande de mode et de l’action', () => {
  const NOMS_SIGNES = [
    'etatBrouillon', 'etatPropose', 'etatRetenu', 'etatBloque', 'neutre',
    'organisation1', 'organisation2', 'organisation3', 'organisation4', 'organisation5', 'organisation6',
    'signeAvis', 'signeRefus', 'signeInformation', 'bandeEcriture', 'bandeLecture', 'bandeBloque', 'actionPrincipale',
  ];

  test('le registre des signes : noms uniques, hors de MARQUES, seuil 3, figé', () => {
    assert.deepEqual(SIGNES.map((s) => s.nom), NOMS_SIGNES);
    assert.ok(Object.isFrozen(SIGNES) && SIGNES.every((s) => Object.isFrozen(s) && Object.isFrozen(s.fonds)));
    assert.ok(SIGNES.every((s) => s.seuil === 3 && s.fonds.length > 0));
    const marques = new Set(MARQUES.map((m) => m.nom));
    assert.deepEqual(SIGNES.filter((s) => marques.has(s.nom)).map((s) => s.nom), []);
  });

  test('le signe d’un état, du neutre ou d’une organisation se mesure sur son fond teinté, la carte, son fond sourd et la page', () => {
    const teintes = [
      ['etatBrouillon', 'etat-brouillon'], ['etatPropose', 'etat-propose'], ['etatRetenu', 'etat-retenu'], ['etatBloque', 'etat-bloque'], ['neutre', 'neutre'],
      ...TEINTES_ORGANISATION.map(({ rang }) => [`organisation${rang}`, `organisation-${rang}`]),
    ];
    for (const [nom, teinte] of teintes) {
      const signe = parNom(SIGNES, nom);
      assert.equal(signe.jeton, `--couleur-${teinte}-marque`, nom);
      assert.deepEqual(signe.fonds, [`--couleur-${teinte}-fond`, '--couleur-carte-fond', '--couleur-carte-fond-sourd', '--couleur-page-fond'], nom);
    }
    // L'icône de la bande de mode porte la teinte de son mode, sur le fond de
    // la bande.
    for (const mode of ['Ecriture', 'Lecture', 'Bloque']) {
      const signe = parNom(SIGNES, `bande${mode}`);
      assert.deepEqual([signe.jeton, ...signe.fonds], [`--couleur-mode-${mode.toLowerCase()}`, `--couleur-mode-${mode.toLowerCase()}-fond`]);
    }
  });

  test('chaque signe tient 3:1 sur chacun de ses fonds, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, SIGNES), []);
  });

  test('le focus se mesure aussi sur la carte et son fond sourd', () => {
    for (const fond of ['--couleur-carte-fond', '--couleur-carte-fond-sourd']) assert.ok(parNom(MARQUES, 'focus').fonds.includes(fond), fond);
  });
});

describe('la palette des organisations (listes seulement)', () => {
  test('six teintes au plus, rangées de 1 à n, chacune un fond et une marque', () => {
    assert.ok(TEINTES_ORGANISATION.length > 0 && TEINTES_ORGANISATION.length <= 6);
    assert.ok(Object.isFrozen(TEINTES_ORGANISATION) && TEINTES_ORGANISATION.every(Object.isFrozen));
    TEINTES_ORGANISATION.forEach((entree, i) => {
      assert.deepEqual(entree, { rang: i + 1, marque: `--couleur-organisation-${i + 1}-marque`, fond: `--couleur-organisation-${i + 1}-fond` });
    });
  });

  const marques = () => TEINTES_ORGANISATION.map(({ marque }) => marque);

  test('chaque marque est chromatique dans les deux thèmes : la teinte la porte, avec le nom', () => {
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const nom of marques()) assert.notEqual(teinte(jetons.get(nom)), null, `${theme} : ${nom}`);
    }
  });

  test(`les marques se séparent deux à deux de ${SEPARATIONS.entreOrganisations} au moins (OKLab × 100), dans les deux thèmes, en couleurs d’origine et sous les trois simulations`, () => {
    assert.deepEqual(verifierSeparation(JETONS, marques(), [], SEPARATIONS.entreOrganisations), []);
  });

  test(`deux marques de teintes voisines se distinguent aussi en clarté, de ${SEPARATIONS.clarteOrganisations} au moins (L d’OKLab × 100)`, () => {
    assert.deepEqual(verifierClartes(JETONS, marques(), SEPARATIONS.clarteOrganisations), []);
  });
});

describe('palette de jetons.css validée par calcul (§ 12.7, § 14.5)', () => {
  test('aucun jeton de texte ou de marque, ni aucun de leurs fonds, n’a de canal alpha', () => {
    const noms = new Set([...MARQUES, ...TEXTES, ...SIGNES].flatMap((e) => [e.jeton, ...e.fonds]));
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

// --- La famille « graphique » (§ 12.7, § 13.3, D30, D43) ---------------------

const g = (nom) => `--couleur-graphique-${nom}`;

// Les seize jetons de la famille, dans l'ordre du contrat.
const JETONS_GRAPHIQUE = [
  'serie-1', 'serie-2', 'repere', 'borne', 'axe', 'grille', 'prouve', 'reste',
  'niveau-0', 'niveau-1', 'niveau-2', 'niveau-3', 'encre-claire', 'encre-foncee', 'bordure-case', 'marque',
].map(g);

const NOMS_MARQUES_GRAPHIQUE = [
  'graphiqueSerie1', 'graphiqueSerie2', 'graphiqueRepere', 'graphiqueBorne', 'graphiqueAxe',
  'graphiqueProuve', 'graphiqueReste', 'graphiqueNiveau1', 'graphiqueNiveau2', 'graphiqueNiveau3',
  'graphiqueBordureCase', 'graphiqueMarque',
];

const CARTE = '--couleur-carte-fond';
const PAGE = '--couleur-page-fond';
const SIMULATIONS_ET_ORIGINE = ['origine', 'protanopie', 'deuteranopie', 'tritanopie'];

describe('la famille « graphique » : ses listes, versées dans MARQUES et TEXTES, ses fonds hors de toute mesure', () => {
  test('les seize jetons du contrat existent dans les deux thèmes, et aucun autre jeton ne porte le préfixe de la famille', () => {
    for (const theme of THEMES) {
      const famille = [...lireJetons(JETONS, theme).keys()].filter((n) => n.startsWith('--couleur-graphique-'));
      assert.deepEqual([...famille].sort(), [...JETONS_GRAPHIQUE].sort(), theme);
    }
  });

  test('MARQUES_GRAPHIQUE : douze marques, seuil 3, figées, chacune peinte de son jeton de la famille ; le repère d’un plafond et celui d’une borne ont chacun le leur', () => {
    assert.deepEqual(MARQUES_GRAPHIQUE.map((m) => m.nom), NOMS_MARQUES_GRAPHIQUE);
    assert.ok(Object.isFrozen(MARQUES_GRAPHIQUE) && MARQUES_GRAPHIQUE.every((m) => Object.isFrozen(m) && Object.isFrozen(m.fonds)));
    for (const marque of MARQUES_GRAPHIQUE) {
      assert.deepEqual(Object.keys(marque).sort(), ['fonds', 'jeton', 'nom', 'seuil'], marque.nom);
      assert.equal(marque.seuil, 3, marque.nom);
      assert.ok(marque.jeton.startsWith('--couleur-graphique-'), marque.nom);
      assert.ok(marque.fonds.includes(CARTE), `${marque.nom} : ${CARTE}`);
    }
    assert.equal(parNom(MARQUES_GRAPHIQUE, 'graphiqueRepere').jeton, g('repere'));
    assert.equal(parNom(MARQUES_GRAPHIQUE, 'graphiqueBorne').jeton, g('borne'));
    for (const nom of ['graphiqueSerie1', 'graphiqueSerie2']) {
      assert.ok(parNom(MARQUES_GRAPHIQUE, nom).fonds.includes(PAGE), `${nom} : ${PAGE}`);
    }
  });

  test('MARQUES_GRAPHIQUE et TEXTES_GRAPHIQUE sont versées à la fin de MARQUES et de TEXTES, les mêmes entrées dans le même ordre ; aucune autre entrée des registres ne porte un jeton de la famille', () => {
    assert.deepEqual(MARQUES.slice(NOMS_MARQUES.length), [...MARQUES_GRAPHIQUE]);
    assert.ok(MARQUES.slice(NOMS_MARQUES.length).every((e, i) => e === MARQUES_GRAPHIQUE[i]));
    assert.deepEqual(TEXTES.slice(-TEXTES_GRAPHIQUE.length), [...TEXTES_GRAPHIQUE]);
    assert.ok(TEXTES.slice(-TEXTES_GRAPHIQUE.length).every((e, i) => e === TEXTES_GRAPHIQUE[i]));
    const nomsGraphique = [...MARQUES_GRAPHIQUE, ...TEXTES_GRAPHIQUE, ...FONDS_GRAPHIQUE].map((e) => e.nom);
    assert.equal(new Set(nomsGraphique).size, nomsGraphique.length);
    const famille = new Set([...MARQUES_GRAPHIQUE, ...TEXTES_GRAPHIQUE]);
    assert.deepEqual([...MARQUES, ...TEXTES, ...SIGNES].filter((e) => e.jeton.startsWith('--couleur-graphique-') && !famille.has(e)).map((e) => e.nom), []);
    assert.deepEqual(SIGNES.filter((e) => nomsGraphique.includes(e.nom)).map((e) => e.nom), []);
  });

  test('les fonds de la famille — la grille et le niveau 0 — restent hors de MARQUES, de TEXTES et de SIGNES : ni leur nom, ni leur jeton comme jeton d’une entrée', () => {
    const registres = [...MARQUES, ...TEXTES, ...SIGNES];
    for (const { nom, jeton } of FONDS_GRAPHIQUE) {
      assert.deepEqual(registres.filter((e) => e.nom === nom).map((e) => e.nom), [], nom);
      assert.deepEqual(registres.filter((e) => e.jeton === jeton).map((e) => e.nom), [], jeton);
    }
  });

  test('l’échelle : quatre niveaux, 0 à 3, chacun son jeton et l’encre de son compte ; deux encres au plus ; figée', () => {
    assert.deepEqual(
      NIVEAUX_GRAPHIQUE.map(({ niveau, jeton }) => [niveau, jeton]),
      [0, 1, 2, 3].map((k) => [k, g(`niveau-${k}`)]),
    );
    assert.ok(Object.isFrozen(NIVEAUX_GRAPHIQUE) && NIVEAUX_GRAPHIQUE.every(Object.isFrozen));
    const encres = [...new Set(NIVEAUX_GRAPHIQUE.map(({ encre }) => encre))];
    assert.ok(encres.length >= 1 && encres.length <= 2, `${encres.length} encres`);
    for (const encre of encres) assert.ok([g('encre-claire'), g('encre-foncee')].includes(encre), encre);
    assert.deepEqual(Object.keys(ECHELLE_GRAPHIQUE).sort(), ['clarte', 'ecartTeinte']);
    assert.ok(Object.isFrozen(ECHELLE_GRAPHIQUE));
  });

  test('TEXTES_GRAPHIQUE : une entrée par encre, seuil 4,5, mesurée sur chaque niveau que NIVEAUX_GRAPHIQUE lui donne et sur aucun autre', () => {
    const encres = [...new Set(NIVEAUX_GRAPHIQUE.map(({ encre }) => encre))];
    assert.deepEqual(TEXTES_GRAPHIQUE.map((t) => t.jeton), encres);
    assert.ok(Object.isFrozen(TEXTES_GRAPHIQUE) && TEXTES_GRAPHIQUE.every((t) => Object.isFrozen(t) && Object.isFrozen(t.fonds)));
    for (const texte of TEXTES_GRAPHIQUE) {
      assert.equal(texte.seuil, 4.5, texte.nom);
      assert.deepEqual([...texte.fonds], NIVEAUX_GRAPHIQUE.filter((n) => n.encre === texte.jeton).map((n) => n.jeton), texte.nom);
    }
  });

  test('FONDS_GRAPHIQUE : la grille et le niveau 0, sans seuil, hors de la mesure 3:1 ; les niveaux 1 à 3 sont des marques, mesurées sur la carte', () => {
    assert.deepEqual(FONDS_GRAPHIQUE.map((f) => [f.nom, f.jeton]), [['graphiqueGrille', g('grille')], ['graphiqueNiveau0', g('niveau-0')]]);
    assert.ok(Object.isFrozen(FONDS_GRAPHIQUE) && FONDS_GRAPHIQUE.every(Object.isFrozen));
    assert.ok(FONDS_GRAPHIQUE.every((f) => !('seuil' in f)));
    const jetonsMarques = MARQUES_GRAPHIQUE.map((m) => m.jeton);
    for (const { jeton } of FONDS_GRAPHIQUE) assert.ok(!jetonsMarques.includes(jeton), jeton);
    for (const k of [1, 2, 3]) assert.deepEqual([...parNom(MARQUES_GRAPHIQUE, `graphiqueNiveau${k}`).fonds], [CARTE], `niveau ${k}`);
  });

  test('chaque jeton et chaque fond des listes de la famille existe dans les deux thèmes, sans canal alpha', () => {
    const noms = new Set([
      ...[...MARQUES_GRAPHIQUE, ...TEXTES_GRAPHIQUE].flatMap((e) => [e.jeton, ...e.fonds]),
      ...FONDS_GRAPHIQUE.map((f) => f.jeton),
    ]);
    for (const nom of JETONS_GRAPHIQUE) assert.ok(noms.has(nom), nom);
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const nom of noms) {
        assert.ok(jetons.has(nom), `${theme} : ${nom}`);
        assert.equal(jetons.get(nom)[3], 1, `${theme} : ${nom}`);
      }
    }
  });
});

describe('la famille « graphique » validée par calcul (§ 12.7, § 14.5, D43)', () => {
  const series = [g('serie-1'), g('serie-2')];
  const organisations = () => TEINTES_ORGANISATION.map(({ marque }) => marque);

  test('chaque marque de la famille tient 3:1 sur chacun de ses fonds — séries sur la carte et la page, repère et borne sur la carte —, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, MARQUES_GRAPHIQUE), []);
  });

  test('chaque encre tient 4,5:1 sur chaque niveau qu’elle sert, dans les deux thèmes, sous les trois simulations', () => {
    assert.deepEqual(verifierPalette(JETONS, TEXTES_GRAPHIQUE), []);
  });

  test(`les deux séries se séparent l’une de l’autre et des six teintes d’organisation de ${SEPARATIONS.autresMarques} au moins (OKLab × 100), sous les trois simulations`, () => {
    assert.deepEqual(verifierSeparation(JETONS, series, organisations(), SEPARATIONS.autresMarques), []);
  });

  test(`« prouvé inévitable » et « reste » se séparent l’un de l’autre de ${SEPARATIONS.autresMarques} au moins, et « reste », chromatique, des teintes d’organisation, sous les trois simulations`, () => {
    assert.deepEqual(verifierSeparation(JETONS, [g('prouve'), g('reste')], [], SEPARATIONS.autresMarques), []);
    assert.deepEqual(verifierSeparation(JETONS, [g('reste')], organisations(), SEPARATIONS.autresMarques), []);
  });

  test('aucun jeton de la famille n’est à moins de 30° d’une teinte de conflit, ni ne porte la valeur d’une teinte de conflit, d’organisation ou du retrait', () => {
    const fautes = verifierTeintesReservees(JETONS, JETONS_CONFLIT).filter((f) => f.jeton.startsWith('--couleur-graphique-'));
    assert.deepEqual(fautes, []);
    const reservees = [...JETONS_CONFLIT, ...organisations(), '--couleur-retrait'];
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      const valeurs = new Set(reservees.map((n) => String(jetons.get(n))));
      assert.deepEqual(JETONS_GRAPHIQUE.filter((n) => valeurs.has(String(jetons.get(n)))), [], theme);
    }
  });

  test('le repère, la borne, l’axe et les deux encres sont neutres dans les deux thèmes : sans teinte', () => {
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const nom of ['repere', 'borne', 'axe', 'encre-claire', 'encre-foncee'].map(g)) {
        assert.equal(teinte(jetons.get(nom)), null, `${theme} : ${nom}`);
      }
    }
  });

  test('la bordure des cases tient 3:1 sur la carte ; le niveau 0 et la grille ne sont pas mesurés : le niveau 0 se tient sous 3:1, au plus près du fond', () => {
    assert.deepEqual([...parNom(MARQUES_GRAPHIQUE, 'graphiqueBordureCase').fonds], [CARTE]);
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const simulation of SIMULATIONS_ET_ORIGINE) {
        const vue = (c) => (simulation === 'origine' ? c : simuler(c, simulation));
        assert.ok(contraste(vue(jetons.get(g('niveau-0'))), vue(jetons.get(CARTE))) < 3, `${theme} ${simulation}`);
      }
    }
  });
});
