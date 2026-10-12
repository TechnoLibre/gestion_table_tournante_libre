// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le registre des marques porteuses d'information et des textes (§ 14.5,
// § 7.5, § 7.6, § 7.7), et la palette de jetons.css validée par calcul sur
// lui (§ 12.7) : chaque entrée tient son seuil sur chacun de ses fonds, dans
// les deux thèmes, en couleurs d'origine puis sous les trois dichromaties.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { CONFLITS, JETONS_CONFLIT, MARQUES, SEPARATIONS, SIGNES, TEINTES_APPARTENANCE, TEXTES } from './marques.js';
import { lireBlocs, lireJetons, teinte, verifierClartes, verifierPalette, verifierSeparation } from './palette.js';

const JETONS = readFileSync(new URL('./jetons.css', import.meta.url), 'utf8');
const THEMES = ['clair', 'sombre'];

const NOMS_MARQUES = [
  'cadenasFerme', 'cadenasOuvert', 'anneau', 'hachure', 'remplissagePlein',
  'contourConflit', 'trameAppartenance', 'trameVoisins', 'trameTable', 'pastille', 'poignee', 'gel', 'miseEnEvidence',
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
  test('les vingt-deux marques du contrat, noms uniques, seuil 3, au moins un fond chacune', () => {
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
    assert.deepEqual(SEPARATIONS, { entreConflits: 12, autresMarques: 5, entreAppartenances: 10, clarteAppartenances: 10 });
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
  test('page, secondaire, bandeau, refus, avis, listes du plan, pastille, puis les textes des cartes, des étiquettes, de la bande de mode, du bandeau, de l’action et des messages ; seuil 4,5', () => {
    assert.deepEqual(TEXTES.map((t) => t.nom), [
      'page', 'secondaire', 'bandeau', 'refus', 'avis', 'listes', 'pastille',
      'carte', 'secondaireCarte', 'etiquette', 'bandeMode', 'bandeauSecondaire', 'bandeauChoisi', 'action', 'lien', 'information',
    ]);
    assert.ok(TEXTES.every((t) => t.seuil === 4.5 && t.fonds.length > 0));
    assert.equal(new Set(TEXTES.map((t) => t.nom)).size, TEXTES.length);
    assert.deepEqual(parNom(TEXTES, 'listes').fonds, ['--couleur-sol']);
    assert.deepEqual(parNom(TEXTES, 'pastille').fonds, ['--couleur-pastille-fond']);
  });

  test('le texte d’une étiquette est l’encre de la page, sur chaque fond teinté d’une pastille (§ 12.7) ; celui d’un message, l’encre de son message sur son fond', () => {
    const etiquette = parNom(TEXTES, 'etiquette');
    assert.equal(etiquette.jeton, '--couleur-page-texte');
    const fondsTeintes = [
      'neutre', 'etat-brouillon', 'etat-propose', 'etat-retenu', 'etat-bloque', 'avis', 'refus', 'information',
      ...TEINTES_APPARTENANCE.map(({ rang }) => `appartenance-${rang}`),
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
    'appartenance1', 'appartenance2', 'appartenance3', 'appartenance4', 'appartenance5', 'appartenance6',
    'signeAvis', 'signeRefus', 'signeInformation', 'bandeEcriture', 'bandeLecture', 'bandeBloque', 'actionPrincipale',
  ];

  test('le registre des signes : noms uniques, hors de MARQUES, seuil 3, figé', () => {
    assert.deepEqual(SIGNES.map((s) => s.nom), NOMS_SIGNES);
    assert.ok(Object.isFrozen(SIGNES) && SIGNES.every((s) => Object.isFrozen(s) && Object.isFrozen(s.fonds)));
    assert.ok(SIGNES.every((s) => s.seuil === 3 && s.fonds.length > 0));
    const marques = new Set(MARQUES.map((m) => m.nom));
    assert.deepEqual(SIGNES.filter((s) => marques.has(s.nom)).map((s) => s.nom), []);
  });

  test('le signe d’un état, du neutre ou d’une appartenance se mesure sur son fond teinté, la carte, son fond sourd et la page', () => {
    const teintes = [
      ['etatBrouillon', 'etat-brouillon'], ['etatPropose', 'etat-propose'], ['etatRetenu', 'etat-retenu'], ['etatBloque', 'etat-bloque'], ['neutre', 'neutre'],
      ...TEINTES_APPARTENANCE.map(({ rang }) => [`appartenance${rang}`, `appartenance-${rang}`]),
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

describe('la palette des appartenances (listes seulement)', () => {
  test('six teintes au plus, rangées de 1 à n, chacune un fond et une marque', () => {
    assert.ok(TEINTES_APPARTENANCE.length > 0 && TEINTES_APPARTENANCE.length <= 6);
    assert.ok(Object.isFrozen(TEINTES_APPARTENANCE) && TEINTES_APPARTENANCE.every(Object.isFrozen));
    TEINTES_APPARTENANCE.forEach((entree, i) => {
      assert.deepEqual(entree, { rang: i + 1, marque: `--couleur-appartenance-${i + 1}-marque`, fond: `--couleur-appartenance-${i + 1}-fond` });
    });
  });

  const marques = () => TEINTES_APPARTENANCE.map(({ marque }) => marque);

  test('chaque marque est chromatique dans les deux thèmes : la teinte la porte, avec le nom', () => {
    for (const theme of THEMES) {
      const jetons = lireJetons(JETONS, theme);
      for (const nom of marques()) assert.notEqual(teinte(jetons.get(nom)), null, `${theme} : ${nom}`);
    }
  });

  test(`les marques se séparent deux à deux de ${SEPARATIONS.entreAppartenances} au moins (OKLab × 100), dans les deux thèmes, en couleurs d’origine et sous les trois simulations`, () => {
    assert.deepEqual(verifierSeparation(JETONS, marques(), [], SEPARATIONS.entreAppartenances), []);
  });

  test(`deux marques de teintes voisines se distinguent aussi en clarté, de ${SEPARATIONS.clarteAppartenances} au moins (L d’OKLab × 100)`, () => {
    assert.deepEqual(verifierClartes(JETONS, marques(), SEPARATIONS.clarteAppartenances), []);
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
