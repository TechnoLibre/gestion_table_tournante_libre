// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du classement des propositions (§ 5.7, A11, A21). Une proposition
// synthétique ne porte que les champs que classer lit, pour trois personnes
// au plafond a priori de 8. Chaque ordre attendu est écrit en clair. Hors des
// épreuves où seul l'identifiant départage, chaque épreuve qui attend un
// ordre non vide en attend au moins un qui diffère de l'ordre des
// identifiants : un classement qui ne lirait aucun critère, et rangerait par
// identifiant, y échoue. Sans compilation, classer applique l'ordre fixe de
// référence ; une compilation (compilationDe, criteres.js) range les paliers
// et pèse leurs critères, et chaque mode des objectifs y compare ses valeurs.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { CRITERES, classer } from './classement.js';
import { premierPalierQuiDepartage } from './classement.js';
import { indexerPlan, normaliser } from './configuration.js';
import { CRITERES as REGISTRE, compilationDe, estCoche, valeursQuiClassent } from './criteres.js';
import { mesurer } from './indicateurs.js';
import EMPREINTES from '../../test/fixtures/moteur/empreintes_defaut.json' with { type: 'json' };

// Les noms des critères appliqués, palier après palier : la liste aplatie,
// égale à CRITERES sous l'ordre fixe de référence.
const aplatir = (criteresAppliques) => criteresAppliques.flatMap(({ criteres }) => criteres.map(({ nom }) => nom));

// Les critères appliqués quand le premier est sauté.
const SANS_A_PRIORI = ['excedentCollisions', 'collisionsCumulees', 'rencontresRepetees', 'redondance'];

// Ce que classer rend, ses critères appliqués lus en noms.
const lu = ({ ordre, criteresAppliques, critereSaute }) => ({ ordre, criteres: aplatir(criteresAppliques), critereSaute });

const QUATRE_CASES = { separerOrganisations: true, nouveauxVoisins: true, nouvelleTable: true, varierOrganisations: true };

// Une entrée de palier.
const e = (critere, poids = 1) => ({ critere, poids });

// La compilation d'un ordre réglé sous ces contraintes et ce mode, comme
// normaliser la donnerait : les tours hors objectif et les animateurs non
// rencontrés ont un objet quand avecObjet les nomme, aucun sinon.
function compilationSous(priorites, { contraintes = QUATRE_CASES, mode = 'places', avecObjet = [] } = {}) {
  const etatCriteres = REGISTRE.map((nom) => ({
    nom,
    coche: estCoche(nom, contraintes),
    sansObjet: (nom === 'toursHorsObjectif' || nom === 'animateursNonRencontres') && !avecObjet.includes(nom),
    valeurs: valeursQuiClassent(nom, contraintes, mode),
  }));
  return compilationDe({ priorites, etatCriteres, modeObjectifs: mode });
}

// L'ordre par défaut, chaque critère seul à son palier.
const PAR_DEFAUT = REGISTRE.map((nom) => [e(nom)]);

// Fige une valeur et, à toute profondeur, les objets et les tableaux qu'elle
// contient : une écriture du module éprouvé y lève TypeError.
function figer(valeur) {
  if (typeof valeur !== 'object' || valeur === null || ArrayBuffer.isView(valeur)) return valeur;
  for (const element of Object.values(valeur)) figer(element);
  return Object.freeze(valeur);
}

// Proposition synthétique de trois personnes. rencontres fixe l'écart au
// plafond a priori de chacun, 8 − rencontres ; collisions est le triplet
// (cumulées, distinctes, excédent) du § 5.4 ; repetees et imposees comptent
// les rencontres répétées que le moteur a choisies et celles qu'imposent les
// réservations ; redondance est Σ_p r(p), le total que mesurer rend sous le
// nom totalRedondance. La liste des r(p) n'y figure pas : classer ne la lit
// pas.
function proposition(
  id,
  {
    rencontres = [8, 8, 8],
    collisions = [0, 0, 0],
    repetees = 0,
    imposees = 0,
    retours = 0,
    redondance = 0,
    objectifs = null,
    nonRencontres = null,
  } = {},
) {
  const [collisionsCumulees, pairesDistinctes, excedentCollisions] = collisions;
  return {
    id,
    mesures: {
      rencontres,
      collisionsCumulees,
      pairesDistinctes,
      excedentCollisions,
      rencontresRepetees: { choisies: repetees, imposees },
      totalRetoursChoisis: retours,
      totalRedondance: redondance,
      objectifs,
      animateurs: nonRencontres === null ? null : { nonRencontres },
    },
    plafondsAPriori: [8, 8, 8],
  };
}

// Les mesures des objectifs que classer lit : les tours hors objectif, les
// personnes jamais servies, le plus de tours hors objectif d'une personne.
const objectifs = (horsObjectif, jamaisServies, horsObjectifMax) => ({ horsObjectif, jamaisServies, horsObjectifMax });

// La même proposition, son plafond a priori inconnu.
const inconnu = (entree) => ({ ...entree, plafondsAPriori: null });

// Les six ordres d'une liste de trois éléments.
const permutations = ([a, b, c]) => [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]];

describe('classer : les critères et leur ordre (§ 5.7)', () => {
  test("CRITERES nomme les cinq critères de l'ordre fixe de référence dans leur ordre, et ne se modifie pas", () => {
    assert.deepEqual(CRITERES, [
      'ecartAuPlafondAPrioriMax',
      'excedentCollisions',
      'collisionsCumulees',
      'rencontresRepetees',
      'redondance',
    ]);
    assert.ok(Object.isFrozen(CRITERES));
  });

  test("l'ordre de l'opérateur (§ 5.4) : l'excédent d'abord, le volume ensuite", () => {
    // Les trois plans du § 5.4, au même écart au plafond a priori, en
    // (cumulées, distinctes, excédent) : un collègue retrouvé quatre fois,
    // deux collègues retrouvés deux fois chacun, six collègues retrouvés une
    // fois chacun. Les rencontres répétées suivent : une paire réunie quatre
    // fois, deux paires réunies deux fois, aucune.
    const concentre = proposition(1, { collisions: [4, 1, 3], repetees: 1 });
    const deuxFois = proposition(2, { collisions: [4, 2, 2], repetees: 2 });
    const reparti = proposition(3, { collisions: [6, 6, 0] });
    const entrees = [concentre, deuxFois, reparti];
    for (const ordreRecu of permutations(entrees)) {
      assert.deepEqual(classer(ordreRecu).ordre, [3, 2, 1]);
    }
    // La raison de la clé : un tri sur les seules collisions cumulées, ou sur
    // les seules paires distinctes, met le plan réparti en dernier.
    const triSur = (champ) =>
      [...entrees].sort((a, b) => a.mesures[champ] - b.mesures[champ] || a.id - b.id).map(({ id }) => id);
    assert.equal(triSur('collisionsCumulees').at(-1), 3);
    assert.equal(triSur('pairesDistinctes').at(-1), 3);
  });

  test('chaque critère départage à son rang, avant tous les suivants', () => {
    // Chaque proposition perd sur un seul critère et gagne sur tous les
    // autres ; la proposition qui la suit perd sur le critère suivant. Seul
    // l'ordre des critères les range, à l'envers de leurs identifiants.
    const entrees = [
      proposition(1, { rencontres: [7, 8, 8] }), // écart au plafond a priori 1
      proposition(2, { collisions: [2, 1, 1], repetees: 1 }), // excédent 1
      proposition(3, { collisions: [3, 3, 0] }), // 3 cumulées, excédent 0
      proposition(4, { repetees: 1 }), // une rencontre répétée
      proposition(5, { redondance: 1 }), // redondance 1
      proposition(6),
    ];
    assert.deepEqual(lu(classer(figer(entrees))), {
      ordre: [6, 5, 4, 3, 2, 1],
      criteres: [...CRITERES],
      critereSaute: null,
    });
  });

  test('le premier critère est le plus grand écart au plafond a priori, ni sa somme ni son minimum', () => {
    // Écarts au plafond a priori, personne par personne :
    // 1 : 2, 0, 0 ; le plus grand 2, la somme 2, le minimum 0.
    // 2 : 1, 1, 1 ; le plus grand 1, la somme 3, le minimum 1.
    const entrees = [proposition(1, { rencontres: [6, 8, 8] }), proposition(2, { rencontres: [7, 7, 7] })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test("le plus grand écart se lit sur toute la liste, non sur sa première valeur non nulle", () => {
    // Écarts au plafond a priori, personne par personne :
    // 1 : 1, 3, 0 ; le plus grand 3, la première valeur non nulle 1.
    // 2 : 2, 2, 2 ; le plus grand 2.
    const entrees = [proposition(1, { rencontres: [7, 5, 8] }), proposition(2, { rencontres: [6, 6, 6] })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test('seules les rencontres répétées que le moteur a choisies comptent (§ 5.4)', () => {
    // 1 : une répétition choisie ; 2 : cinq qu'imposent les réservations.
    const entrees = [proposition(1, { repetees: 1 }), proposition(2, { imposees: 5 })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test('la redondance se lit sur totalRedondance, la somme que mesurer rend', () => {
    // 1 : r(p) vaut 1, 1, 1, somme 3 et plus grand 1 ; 2 : r(p) vaut 2, 0,
    // 0, somme 2 et plus grand 2. La somme range 2 devant 1, le plus grand
    // ferait l'inverse.
    const entrees = [proposition(1, { redondance: 3 }), proposition(2, { redondance: 2 })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });
});

describe('classer : le critère sauté (§ 5.7, § 12.6)', () => {
  test('un plafond a priori inconnu saute le premier critère pour toutes, et classer le nomme', () => {
    // 1 : écart au plafond a priori 0, excédent 2.
    // 2 : écart au plafond a priori 1, excédent 0.
    const premiere = proposition(1, { collisions: [4, 2, 2], repetees: 2 });
    const seconde = proposition(2, { rencontres: [7, 8, 8] });
    assert.deepEqual(lu(classer([premiere, seconde])), {
      ordre: [1, 2],
      criteres: [...CRITERES],
      critereSaute: null,
    });
    // Un seul a priori inconnu suffit : l'excédent ouvre alors le classement
    // de toutes, y compris de celle dont l'a priori est connu.
    const attendu = { ordre: [2, 1], criteres: SANS_A_PRIORI, critereSaute: 'ecartAuPlafondAPrioriMax' };
    assert.deepEqual(lu(classer([premiere, inconnu(seconde)])), attendu);
    assert.deepEqual(lu(classer([inconnu(premiere), seconde])), attendu);
    assert.deepEqual(lu(classer([inconnu(premiere), inconnu(seconde)])), attendu);
  });
});

describe('classer : le départage par identifiant (§ 15.5, point 4)', () => {
  test("à égalité sur les cinq critères, l'identifiant croissant, quel que soit l'ordre reçu", () => {
    const egales = [7, 3, 5].map((id) =>
      proposition(id, { rencontres: [7, 8, 8], collisions: [2, 1, 1], repetees: 1, redondance: 1 }),
    );
    for (const ordreRecu of permutations(egales)) {
      assert.deepEqual(classer(ordreRecu).ordre, [3, 5, 7]);
    }
  });
});

// Un plan de la variante « conflit inévitable » (§ 15.3), où A = {1, 5, 8,
// 10, 12}, B = {2, 4, 9, 11} et C = {3, 6, 7}. 1 et 5 restent ensemble aux
// quatre tours, avec un membre de B ; chaque autre table réunit un membre de
// A, de B et de C. Quatre collisions cumulées sur une seule paire.
const CONCENTRE = {
  tables: [1, 2, 3, 4],
  tours: [
    [[1, 2, 5], [3, 4, 8], [6, 9, 10], [7, 11, 12]],
    [[1, 4, 5], [6, 8, 9], [7, 10, 11], [2, 3, 12]],
    [[1, 5, 9], [7, 8, 11], [2, 3, 10], [4, 6, 12]],
    [[1, 5, 11], [2, 6, 8], [3, 4, 10], [7, 9, 12]],
  ],
  reserves: [[], [], [], []],
};

describe('classer : petite démonstration, conflit inévitable (§ 14.10, § 15.3)', () => {
  test('le plan qui répartit ses quatre collisions passe devant celui qui les concentre', () => {
    const instance = normaliser(CATALOGUE.find(({ cle }) => cle === 'petite-conflit').construire());
    const mesures = (plan) => mesurer(instance, indexerPlan(instance, plan));
    const collisions = (m) => [m.collisionsCumulees, m.pairesDistinctes, m.excedentCollisions];
    // Le plan parfait de la petite démonstration répartit les siennes : 10
    // rencontre 12 au tour 1, 5 au tour 2, 8 au tour 3 et 1 au tour 4.
    const concentre = mesures(CONCENTRE);
    const reparti = mesures(PLAN_PARFAIT_PETITE);
    assert.deepEqual(collisions(concentre), [4, 1, 3]);
    assert.deepEqual(collisions(reparti), [4, 4, 0]);
    // Nul ne rencontre plus de 8 personnes sur 11 (§ 15.3).
    const huit = new Array(12).fill(8);
    const entrees = [
      { id: 1, mesures: concentre, plafondsAPriori: huit },
      { id: 2, mesures: reparti, plafondsAPriori: huit },
    ];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
    // Le plafond a priori inconnu, l'excédent décide seul : 0 contre 3.
    assert.deepEqual(lu(classer(entrees.map(inconnu))), {
      ordre: [2, 1],
      criteres: SANS_A_PRIORI,
      critereSaute: 'ecartAuPlafondAPrioriMax',
    });
  });
});

describe('classer : les entrées reçues', () => {
  test("une liste vide rend un ordre vide, tous les critères appliqués", () => {
    assert.deepEqual(lu(classer([])), { ordre: [], criteres: [...CRITERES], critereSaute: null });
  });

  test("population vide, plafond a priori connu : le premier critère s'applique, sans rien départager", () => {
    // Une population vide n'a pas de plus grand écart au plafond a priori ;
    // ce n'est pas un plafond a priori inconnu, et rien n'est sauté.
    const vide = (id) => ({ ...proposition(id, { rencontres: [] }), plafondsAPriori: [] });
    assert.deepEqual(lu(classer([vide(2), vide(1)])), {
      ordre: [1, 2],
      criteres: [...CRITERES],
      critereSaute: null,
    });
  });

  test('un identifiant répété lève RangeError ; un identifiant non entier, TypeError', () => {
    assert.throws(() => classer([proposition(1), proposition(2), proposition(1)]), RangeError);
    assert.throws(() => classer([proposition('1')]), TypeError);
    assert.throws(() => classer([proposition(1.5)]), TypeError);
  });

  test("un plafond a priori undefined lève TypeError ; d'une autre longueur que les rencontres, RangeError", () => {
    const sansAPriori = { ...proposition(2), plafondsAPriori: undefined };
    assert.throws(() => classer([proposition(1), sansAPriori]), TypeError);
    assert.throws(() => classer([{ ...proposition(1), plafondsAPriori: [8, 8] }]), RangeError);
  });

  test('des mesures de populations de tailles différentes lèvent RangeError', () => {
    const quatre = {
      ...proposition(2, { rencontres: [8, 8, 8, 8] }),
      plafondsAPriori: [8, 8, 8, 8],
    };
    assert.throws(() => classer([proposition(1), quatre]), RangeError);
  });
});

describe('classer : la forme des critères appliqués (contrat du classement)', () => {
  test("sans compilation : l'ordre fixe de référence, un palier par critère, ses valeurs et son poids", () => {
    assert.deepEqual(classer([proposition(1)]).criteresAppliques, [
      { criteres: [{ nom: 'ecartAuPlafondAPrioriMax', valeurs: ['ecartAuPlafondAPrioriMax'], poids: 1 }] },
      { criteres: [{ nom: 'excedentCollisions', valeurs: ['excedentCollisions'], poids: 1 }] },
      { criteres: [{ nom: 'collisionsCumulees', valeurs: ['collisionsCumulees'], poids: 1 }] },
      { criteres: [{ nom: 'rencontresRepetees', valeurs: ['rencontresRepeteesChoisies'], poids: 1 }] },
      { criteres: [{ nom: 'redondance', valeurs: ['redondance'], poids: 1 }] },
    ]);
  });

  test("l'ordre par défaut compilé sous les quatre cases, sans objectif ni animateurs, rend le même classement que sans compilation", () => {
    const entrees = [
      proposition(1, { rencontres: [7, 8, 8] }),
      proposition(2, { collisions: [2, 1, 1], repetees: 1 }),
      proposition(3, { redondance: 1 }),
    ];
    assert.deepEqual(classer(entrees, compilationSous(PAR_DEFAUT)), classer(entrees));
    for (const mode of ['chacun', 'minimum']) {
      assert.deepEqual(classer(entrees, compilationSous(PAR_DEFAUT, { mode })), classer(entrees), mode);
    }
  });

  test('les critères appliqués sont des copies : les modifier ne touche ni la compilation ni le classement suivant', () => {
    const compilation = compilationSous(PAR_DEFAUT);
    const { criteresAppliques } = classer([proposition(1)], compilation);
    criteresAppliques[0].criteres[0].valeurs.push('autre');
    assert.deepEqual(compilation.paliers[0].criteres[0].valeurs, ['ecartAuPlafondAPrioriMax']);
    assert.deepEqual(aplatir(classer([proposition(1)], compilation).criteresAppliques), [...CRITERES]);
  });

  test("une valeur qu'aucune lecture ne porte lève RangeError, qui la nomme", () => {
    const compilation = compilationSous(PAR_DEFAUT);
    const palier = compilation.paliers.find(({ criteres }) => criteres[0].nom === 'redondance');
    palier.criteres[0].valeurs = ['redondanceInventee'];
    assert.throws(() => classer([proposition(1)], compilation), (erreur) => {
      assert.ok(erreur instanceof RangeError, String(erreur));
      assert.equal(erreur.message, 'valeur de classement inconnue : redondanceInventee');
      return true;
    });
  });

  test('un critère à deux valeurs dans un palier partagé lève RangeError, qui le nomme', () => {
    const partage = [[e('ecartAuPlafondAPrioriMax')], [e('excedentCollisions'), e('collisionsCumulees', 3)], ...PAR_DEFAUT.slice(3)];
    const compilation = compilationSous(partage);
    const palier = compilation.paliers.find(({ criteres }) => criteres.length === 2);
    palier.criteres[1].valeurs = ['collisionsCumulees', 'excedentCollisions'];
    assert.throws(() => classer([proposition(1)], compilation), (erreur) => {
      assert.ok(erreur instanceof RangeError, String(erreur));
      assert.equal(erreur.message, 'critère collisionsCumulees : 2 valeurs dans un palier partagé');
      return true;
    });
  });
});

describe('classer : un palier pondéré classe par sa somme (A11, A21)', () => {
  test('deux propositions égales sur la somme du palier : le suivant les départage ; la troisième, moins bonne sur ce palier, reste derrière', () => {
    // Palier 2 : { excédent × 2, redondance × 1 }, puis les collisions
    // cumulées. 1 : 2 × 1 + 3 = 5 ; 2 : 2 × 2 + 1 = 5 ; 3 : 2 × 0 + 6 = 6.
    // Lu critère par critère, l'excédent nul de 3 la mettrait en tête.
    const liste = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions', 2), e('redondance')],
      [e('collisionsCumulees')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const entrees = [
      proposition(1, { collisions: [5, 4, 1], redondance: 3 }),
      proposition(2, { collisions: [4, 2, 2], redondance: 1 }),
      proposition(3, { collisions: [0, 0, 0], redondance: 6 }),
    ];
    const classement = classer(entrees, compilationSous(liste));
    assert.deepEqual(classement.ordre, [2, 1, 3]);
    assert.deepEqual(classement.criteresAppliques[1], {
      criteres: [
        { nom: 'excedentCollisions', valeurs: ['excedentCollisions'], poids: 2 },
        { nom: 'redondance', valeurs: ['redondance'], poids: 1 },
      ],
    });
  });

  test('le poids renverse l’ordre de la somme brute : le palier compare Σ poids × valeur, non Σ valeur', () => {
    // Palier 2 : { excédent × 2, redondance × 1 }, les collisions cumulées
    // égales. 2 : 2 × 1 + 4 = 6, brut 1 + 4 = 5 ; 1 : 2 × 3 + 1 = 7, brut
    // 3 + 1 = 4. Pondérée, la somme met 2 en tête ; brute, elle y mettrait 1.
    const liste = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions', 2), e('redondance')],
      [e('collisionsCumulees')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const entrees = [
      proposition(1, { collisions: [4, 1, 3], redondance: 1 }),
      proposition(2, { collisions: [4, 3, 1], redondance: 4 }),
    ];
    assert.deepEqual(classer(entrees, compilationSous(liste)).ordre, [2, 1]);
  });

  test("le poids d'un critère seul à son palier multiplie sa valeur sans changer l'ordre qu'il donne", () => {
    const liste = [[e('ecartAuPlafondAPrioriMax')], [e('excedentCollisions', 7)], ...PAR_DEFAUT.slice(2)];
    const entrees = [proposition(1, { collisions: [2, 1, 1] }), proposition(2)];
    assert.deepEqual(classer(entrees, compilationSous(liste)).ordre, [2, 1]);
  });
});

describe('classer : les cases et les critères qui ne comptent pas (§ 5.3, D10, Q4)', () => {
  test('un critère décoché ne classe pas : séparer les organisations décochée, l’excédent ne départage plus', () => {
    const entrees = [proposition(1, { collisions: [2, 1, 1] }), proposition(2, { repetees: 1 })];
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
    const contraintes = { ...QUATRE_CASES, separerOrganisations: false };
    const classement = classer(entrees, compilationSous(PAR_DEFAUT, { contraintes }));
    assert.deepEqual(lu(classement), {
      ordre: [1, 2],
      criteres: ['ecartAuPlafondAPrioriMax', 'rencontresRepetees', 'redondance'],
      critereSaute: null,
    });
  });

  test('« nouvelle table » seule : les retours choisis classent à la place des rencontres répétées', () => {
    // 1 : une rencontre répétée, aucun retour ; 2 : deux retours.
    const entrees = [proposition(1, { repetees: 1 }), proposition(2, { retours: 2 })];
    const contraintes = { ...QUATRE_CASES, nouveauxVoisins: false };
    const classement = classer(entrees, compilationSous(PAR_DEFAUT, { contraintes }));
    assert.deepEqual(classement.ordre, [1, 2]);
    assert.deepEqual(classement.criteresAppliques[3].criteres, [{ nom: 'rencontresRepetees', valeurs: ['retoursChoisis'], poids: 1 }]);
    assert.deepEqual(classer(entrees).ordre, [2, 1]);
  });

  test('les animateurs cochés et avec un objet classent sur les animateurs non rencontrés, avant la redondance', () => {
    const entrees = [proposition(1, { nonRencontres: 3 }), proposition(2, { nonRencontres: 1, redondance: 4 })];
    const contraintes = { ...QUATRE_CASES, rencontrerAnimateurs: true };
    const classement = classer(entrees, compilationSous(PAR_DEFAUT, { contraintes, avecObjet: ['animateursNonRencontres'] }));
    assert.deepEqual(classement.ordre, [2, 1]);
    assert.deepEqual(aplatir(classement.criteresAppliques).slice(-2), ['animateursNonRencontres', 'redondance']);
  });

  test("le critère sauté sort avec son palier, où qu'il soit rangé ; critereSaute le nomme, rangSaute dit son rang", () => {
    const liste = [[e('excedentCollisions')], [e('collisionsCumulees')], [e('ecartAuPlafondAPrioriMax')], ...PAR_DEFAUT.slice(3)];
    const entrees = [inconnu(proposition(1, { repetees: 2 })), inconnu(proposition(2, { rencontres: [1, 1, 1], repetees: 1 }))];
    const classement = classer(entrees, compilationSous(liste));
    assert.deepEqual(lu(classement), {
      ordre: [2, 1],
      criteres: ['excedentCollisions', 'collisionsCumulees', 'rencontresRepetees', 'redondance'],
      critereSaute: 'ecartAuPlafondAPrioriMax',
    });
    // Le palier des rencontres répétées prend le rang 2, celui de l'écart.
    assert.equal(classement.rangSaute, 2);
    assert.equal(classement.criteresAppliques[2].criteres[0].nom, 'rencontresRepetees');
    assert.equal(classer(entrees).rangSaute, 0);
    assert.equal(classer([proposition(1)]).rangSaute, null);
  });

  test('les quatre cases décochées, sans objectif : le palier sauté était le seul, aucun ne prend sa place', () => {
    const contraintes = { separerOrganisations: false, nouveauxVoisins: false, nouvelleTable: false, varierOrganisations: false };
    const entrees = [inconnu(proposition(2)), inconnu(proposition(1, { repetees: 3 }))];
    const classement = classer(entrees, compilationSous(PAR_DEFAUT, { contraintes }));
    assert.deepEqual(classement.criteresAppliques, []);
    assert.equal(classement.critereSaute, 'ecartAuPlafondAPrioriMax');
    assert.equal(classement.rangSaute, 0);
    assert.deepEqual(classement.ordre, [1, 2]);
  });
});

describe('classer : un critère à deux valeurs, seul à son palier, compare la première puis la seconde (D20)', () => {
  // 1 : jamais servies 1, tours hors objectif 2, le plus d'une personne 2 ;
  // 2 : 0, 5, 3 ; 3 : 0, 3, 1 ; 4 : 0, 4, 1.
  const entrees = () => [
    proposition(1, { objectifs: objectifs(2, 1, 2) }),
    proposition(2, { objectifs: objectifs(5, 0, 3) }),
    proposition(3, { objectifs: objectifs(3, 0, 1) }),
    proposition(4, { objectifs: objectifs(4, 0, 1) }),
  ];
  const sous = (mode) => compilationSous(PAR_DEFAUT, { mode, avecObjet: ['toursHorsObjectif'] });

  test('places : les tours hors objectif seuls', () => {
    assert.deepEqual(classer(entrees(), sous('places')).ordre, [1, 3, 4, 2]);
  });

  test('chacun : les personnes jamais servies, puis les tours hors objectif', () => {
    const classement = classer(entrees(), sous('chacun'));
    assert.deepEqual(classement.ordre, [3, 4, 2, 1]);
    assert.deepEqual(classement.criteresAppliques[3].criteres, [
      { nom: 'toursHorsObjectif', valeurs: ['jamaisServies', 'toursHorsObjectif'], poids: 1 },
    ]);
  });

  test("minimum : le plus de tours hors objectif d'une personne, puis les tours hors objectif", () => {
    assert.deepEqual(classer(entrees(), sous('minimum')).ordre, [3, 4, 1, 2]);
  });
});

// Dix personnes « finance », une table « finance » de huit places et une
// table sans objectif de deux, quatre tours : chaque plan sert 32 places.
// Seuls les objectifs comptent (les quatre cases décochées) ; le plafond a
// priori, inconnu, fait sauter l'écart.
function soireeFinance(mode) {
  return normaliser({
    participants: Array.from({ length: 10 }, (_, rang) => ({ id: rang + 1, organisation: null, etiquettes: ['finance'] })),
    tables: [{ id: 1, capacite: 8 }, { id: 2, capacite: 2 }],
    tours: 4,
    reservations: [],
    contraintes: { separerOrganisations: false, nouveauxVoisins: false, nouvelleTable: false, varierOrganisations: false },
    objectifs: [{ table: 1, tour: null, regle: 'ou', etiquettes: ['finance'] }],
    ...(mode === 'places' ? {} : { modeObjectifs: mode }),
  });
}

// Le plan dont la table de deux reçoit, au tour r, la paire paires[r].
function planFinance(paires) {
  return {
    tables: [1, 2],
    tours: paires.map((paire) => [Array.from({ length: 10 }, (_, rang) => rang + 1).filter((id) => !paire.includes(id)), paire]),
    reserves: [[], [], [], []],
  };
}

// L'un laisse 10 sans tour servi ; l'autre sert chacun une fois au moins,
// 9 et 10 une fois seulement ; le dernier sert chacun trois tours au moins.
const PLANS_FINANCE = [
  planFinance([[9, 10], [8, 10], [7, 10], [6, 10]]),
  planFinance([[9, 10], [9, 10], [9, 10], [7, 8]]),
  planFinance([[1, 2], [3, 4], [5, 6], [7, 8]]),
];

describe('classer : chaque mode des objectifs compare ce qu’il dit (A21)', () => {
  // Les trois plans mesurés et classés sous ce mode.
  function classerFinance(mode) {
    const instance = soireeFinance(mode);
    const entrees = PLANS_FINANCE.map((plan, rang) => ({
      id: rang + 1,
      mesures: mesurer(instance, indexerPlan(instance, plan)),
      plafondsAPriori: null,
    }));
    return { entrees, classement: classer(entrees, compilationDe(instance)) };
  }

  test('les trois plans servent 32 places : les mêmes tours hors objectif ; jamais servies 1, 0, 0 ; le plus d’une personne 4, 3, 1', () => {
    const { entrees } = classerFinance('places');
    assert.deepEqual(
      entrees.map(({ mesures }) => [mesures.objectifs.horsObjectif, mesures.objectifs.jamaisServies, mesures.objectifs.horsObjectifMax]),
      [[8, 1, 4], [8, 0, 3], [8, 0, 1]],
    );
  });

  test('le plus de places servies : les trois égaux sur le critère, rangés par identifiant', () => {
    const { classement } = classerFinance('places');
    assert.deepEqual(lu(classement), { ordre: [1, 2, 3], criteres: ['toursHorsObjectif'], critereSaute: 'ecartAuPlafondAPrioriMax' });
  });

  test('chacun au moins une fois : le premier passe derrière les deux autres', () => {
    assert.deepEqual(classerFinance('chacun').classement.ordre, [2, 3, 1]);
  });

  test("l'équité d'abord : le dernier passe devant les deux autres", () => {
    assert.deepEqual(classerFinance('minimum').classement.ordre, [3, 2, 1]);
  });
});

// Les classements de référence de l'étape 1 (test/fixtures/moteur/
// empreintes_defaut.json) : pour chaque charge, douze propositions et leurs
// grandeurs nommées, l'ordre et les critères appliqués sous l'ordre par
// défaut, plafond a priori connu puis inconnu. Chaque critère appliqué y
// départage le premier une paire voisine au moins
// (src/application/empreintes.test.js) : le fichier est lu tel quel, jamais
// récrit ici. Importé, il entre au graphe de l'épreuve, qui se relance
// quand il change.

// La grandeur nommée que lit chaque critère de l'ordre par défaut.
const GRANDEUR_DU_CRITERE = new Map([
  ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPrioriMax'],
  ['excedentCollisions', 'excedentCollisions'],
  ['collisionsCumulees', 'collisionsCumulees'],
  ['rencontresRepetees', 'rencontresRepeteesChoisies'],
  ['redondance', 'redondance'],
]);

// L'entrée de classer d'une proposition de la référence, refaite de ses
// grandeurs : une personne, dont l'écart au plafond a priori est le plus
// grand de la proposition (0 rencontre, plafond a priori égal à cet écart),
// ou un plafond a priori inconnu ; les autres grandeurs telles quelles.
function entreeDeReference(id, grandeurs, connu) {
  return {
    id,
    mesures: {
      rencontres: [0],
      collisionsCumulees: grandeurs.collisionsCumulees,
      excedentCollisions: grandeurs.excedentCollisions,
      rencontresRepetees: { choisies: grandeurs.rencontresRepeteesChoisies, imposees: 0 },
      totalRetoursChoisis: grandeurs.retoursChoisis,
      totalRedondance: grandeurs.redondance,
      objectifs: null,
      animateurs: null,
    },
    plafondsAPriori: connu ? [grandeurs.ecartAuPlafondAPrioriMax] : null,
  };
}

// Chaque classement de la référence : son nom, ses entrées refaites, son
// ordre, ses critères appliqués et les grandeurs de ses propositions.
const CLASSEMENTS_DE_REFERENCE = Object.keys(EMPREINTES.classements).flatMap((cle) =>
  ['connu', 'inconnu'].map((plafond) => {
    const { propositions } = EMPREINTES.classements[cle];
    const { ordre, criteresAppliques } = EMPREINTES.classements[cle][plafond];
    return {
      nom: `${cle}, plafond a priori ${plafond}`,
      entrees: new Map(ordre.map((id) => [id, entreeDeReference(id, propositions[String(id)], plafond === 'connu')])),
      ordre,
      criteresAppliques,
      grandeurs: propositions,
    };
  }),
);

// La grandeur qu'un critère de l'ordre par défaut lit pour la proposition id.
const grandeur = (grandeurs, id, critere) => grandeurs[String(id)][GRANDEUR_DU_CRITERE.get(critere)];

describe('premierPalierQuiDepartage (§ 12.6, § 5.7, D63, C17)', () => {
  test('les entrées refaites des grandeurs de la référence redonnent son ordre et ses critères : l’épreuve suivante lit les mêmes clés que classer', () => {
    assert.equal(CLASSEMENTS_DE_REFERENCE.length, 4);
    for (const { nom, entrees, ordre, criteresAppliques } of CLASSEMENTS_DE_REFERENCE) {
      assert.equal(ordre.length, 12, nom);
      const classement = classer([...entrees.values()]);
      assert.deepEqual(classement.ordre, ordre, nom);
      assert.deepEqual(aplatir(classement.criteresAppliques), criteresAppliques, nom);
    }
  });

  test('rouge : chaque paire voisine de la référence : le premier palier appliqué où leurs clés diffèrent, compté de 1, l’ordre des deux suivant classer', () => {
    const vus = new Set();
    let egales = 0;
    for (const { nom, entrees, ordre, criteresAppliques, grandeurs } of CLASSEMENTS_DE_REFERENCE) {
      for (let i = 1; i < ordre.length; i += 1) {
        const [avant, apres] = [ordre[i - 1], ordre[i]];
        const paire = `${nom}, n° ${avant} et n° ${apres}`;
        const rang = criteresAppliques.findIndex((critere) => grandeur(grandeurs, avant, critere) !== grandeur(grandeurs, apres, critere));
        const palier = premierPalierQuiDepartage(entrees.get(avant), entrees.get(apres));
        if (rang === -1) {
          egales += 1;
          assert.equal(palier, null, paire);
          continue;
        }
        const critere = criteresAppliques[rang];
        assert.deepEqual(palier, { rang: rang + 1, criteres: [critere] }, paire);
        // L'ordre des deux suit classer : la première porte la plus petite
        // valeur sur ce palier, et classer, reçu dans l'autre ordre, les
        // rend ainsi.
        assert.ok(grandeur(grandeurs, avant, critere) < grandeur(grandeurs, apres, critere), paire);
        assert.deepEqual(classer([entrees.get(apres), entrees.get(avant)]).ordre, [avant, apres], paire);
        // Le palier ne dépend pas de l'ordre des deux arguments.
        assert.deepEqual(premierPalierQuiDepartage(entrees.get(apres), entrees.get(avant)), palier, paire);
        vus.add(`${critere}@${rang + 1}`);
      }
    }
    // L'épreuve refuse de passer sans avoir vu chaque critère appliqué
    // départager une paire, sous l'un et l'autre plafond a priori : le
    // premier, l'écart au plafond a priori, au rang 1 quand il est connu,
    // chacun des autres au rang qu'il prend quand il est sauté.
    assert.deepEqual([...vus].sort(), [
      'collisionsCumulees@2',
      'collisionsCumulees@3',
      'ecartAuPlafondAPrioriMax@1',
      'excedentCollisions@1',
      'excedentCollisions@2',
      'rencontresRepetees@3',
      'rencontresRepetees@4',
      'redondance@4',
      'redondance@5',
    ].sort());
    assert.equal(egales, 0);
  });

  test('rouge : deux propositions égales sur toutes les clés : null, l’identifiant départage', () => {
    const { entrees, ordre } = CLASSEMENTS_DE_REFERENCE[0];
    const modele = entrees.get(ordre[0]);
    const jumelle = { ...modele, id: 99 };
    assert.equal(premierPalierQuiDepartage(modele, jumelle), null);
    assert.equal(premierPalierQuiDepartage(proposition(3, { repetees: 1 }), proposition(5, { repetees: 1 })), null);
  });

  test('rouge : le palier sauté, a priori inconnu d’un seul côté, ne compte pas : le premier palier appliqué est alors l’excédent', () => {
    // Écart au plafond a priori 1 contre 0, excédent 1 contre 0 : connu des
    // deux côtés, le premier palier les départage ; inconnu d'un côté, il
    // est sauté, et l'excédent devient le palier 1.
    const premiere = proposition(1, { rencontres: [7, 8, 8], collisions: [1, 0, 1] });
    const seconde = proposition(2);
    assert.deepEqual(premierPalierQuiDepartage(premiere, seconde), { rang: 1, criteres: ['ecartAuPlafondAPrioriMax'] });
    for (const [a, b] of [[inconnu(premiere), seconde], [premiere, inconnu(seconde)], [inconnu(premiere), inconnu(seconde)]]) {
      assert.deepEqual(premierPalierQuiDepartage(a, b), { rang: 1, criteres: ['excedentCollisions'] });
    }
    // Égales hors de l'écart au plafond a priori : sautées, rien ne les
    // départage.
    assert.equal(premierPalierQuiDepartage(inconnu(proposition(1, { rencontres: [7, 8, 8] })), proposition(2)), null);
  });

  test('rouge : un palier compte une fois, quelles que soient les valeurs qu’il compare : le rang est celui du palier, non de la composante', () => {
    // Sous « chacun au moins une fois », le critère des objectifs compare
    // deux valeurs dans un seul palier, le deuxième. L'excédent, au
    // troisième palier, départage deux propositions égales sur les deux.
    const liste = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('toursHorsObjectif')],
      [e('excedentCollisions')],
      [e('collisionsCumulees')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
      [e('redondance')],
    ];
    const compilation = compilationSous(liste, { mode: 'chacun', avecObjet: ['toursHorsObjectif'] });
    assert.deepEqual(
      compilation.paliers.slice(0, 3).map(({ criteres }) => criteres.map(({ nom, valeurs }) => [nom, valeurs.length])),
      [[['ecartAuPlafondAPrioriMax', 1]], [['toursHorsObjectif', 2]], [['excedentCollisions', 1]]],
    );
    const premiere = proposition(1, { collisions: [1, 0, 1], objectifs: objectifs(3, 1, 2) });
    const seconde = proposition(2, { objectifs: objectifs(3, 1, 2) });
    assert.deepEqual(premierPalierQuiDepartage(premiere, seconde, compilation), { rang: 3, criteres: ['excedentCollisions'] });
    // La seconde valeur du palier des objectifs départage : toujours le
    // palier 2.
    const moinsServie = proposition(3, { objectifs: objectifs(4, 1, 2) });
    assert.deepEqual(premierPalierQuiDepartage(seconde, moinsServie, compilation), { rang: 2, criteres: ['toursHorsObjectif'] });
    assert.deepEqual(classer([moinsServie, seconde], compilation).ordre, [2, 3]);
  });

  test('rouge : un palier partagé compare la somme pondérée, comme classer : deux sommes égales ne le départagent pas, et il nomme tous ses critères', () => {
    const liste = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions', 2), e('redondance')],
      [e('collisionsCumulees')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const compilation = compilationSous(liste);
    // 2 × 1 + 0 = 2 contre 2 × 0 + 2 = 2 : le palier 2 ne départage pas ;
    // les collisions cumulées, 3 contre 0, au palier 3.
    const egalesAuPalier = [proposition(1, { collisions: [3, 2, 1] }), proposition(2, { redondance: 2 })];
    assert.deepEqual(premierPalierQuiDepartage(...egalesAuPalier, compilation), { rang: 3, criteres: ['collisionsCumulees'] });
    assert.deepEqual(classer(egalesAuPalier, compilation).ordre, [2, 1]);
    // 2 × 1 + 0 = 2 contre 2 × 0 + 3 = 3 : le palier 2, ses deux critères.
    assert.deepEqual(premierPalierQuiDepartage(proposition(1, { collisions: [1, 0, 1] }), proposition(2, { redondance: 3 }), compilation), {
      rang: 2,
      criteres: ['excedentCollisions', 'redondance'],
    });
  });

  test('ne modifie pas les entrées ; un identifiant répété, des populations de tailles différentes lèvent RangeError', () => {
    const premiere = figer(proposition(1, { collisions: [1, 0, 1] }));
    const seconde = figer(proposition(2));
    assert.deepEqual(premierPalierQuiDepartage(premiere, seconde), { rang: 2, criteres: ['excedentCollisions'] });
    assert.throws(() => premierPalierQuiDepartage(proposition(1), proposition(1)), RangeError);
    const courte = { ...proposition(2), mesures: { ...proposition(2).mesures, rencontres: [8, 8] }, plafondsAPriori: [8, 8] };
    assert.throws(() => premierPalierQuiDepartage(proposition(1), courte), RangeError);
  });
});
