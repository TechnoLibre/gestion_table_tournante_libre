// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du compagnon des courses (§ 5.10, § 8.9, B31) : son texte, sa
// lecture qui ne lève jamais et n'admet que les courses que confirment les
// propositions de la charge, et l'accès à la course d'une proposition, qui
// ne rend jamais une course contradictoire. Les charges d'épreuve reprennent
// la petite démonstration et son plan parfait ; leurs noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CATALOGUE, PLAN_PARFAIT_PETITE } from '../demo/catalogue.js';
import { VERSION } from '../version.genere.js';
import {
  FORMAT_COURSES,
  avecCourses,
  cleDeCourse,
  courseDe,
  entreeDeCourse,
  entreesPour,
  heriterEmpreintes,
  lireCourses,
  texteDesCourses,
} from './courses.js';
import { creerCharge } from './document.js';
import { courseVersFichier, versFichier } from './placements.js';

const EVENEMENT = 'evt-mesanges';

// La configuration de la petite démonstration (§ 15.3), neuve à chaque appel.
const petite = () => CATALOGUE.find(({ cle }) => cle === 'petite').construire();

// La proposition du moteur d'identifiant id sur plan, le plan parfait de la
// petite démonstration par défaut, à la graine 100 + id, portant une course
// à evalues mouvements : chaque point de relevé reprend les tours du plan
// décalés de son rang.
function propositionDuMoteur(id, evalues = 120, plan = PLAN_PARFAIT_PETITE) {
  const { tours } = plan;
  const releves = [];
  for (let k = 0, mouvements = 1; mouvements < evalues; k += 1, mouvements *= 10) {
    const decales = tours.map((_, r) => tours[(r + k + 1) % tours.length]);
    releves.push({ mouvements, plan: { tables: [1, 2, 3, 4], tours: decales, reserves: decales.map(() => []) } });
  }
  return { id, graine: 100 + id, arret: 20_000, historique: 1_000, plan, evalues, releves };
}

// Le plan parfait de la petite démonstration, ses tours dans l'ordre
// inverse : un autre placement des mêmes tables et des mêmes personnes.
const PLAN_INVERSE = { ...PLAN_PARFAIT_PETITE, tours: [...PLAN_PARFAIT_PETITE.tours].reverse() };

// Une charge de l'événement EVENEMENT portant les propositions de fichier
// des identifiants donnés, sur plan, et l'entrée du compagnon de chacune.
function chargeEtEntrees(ids = [1, 2, 3], plan = PLAN_PARFAIT_PETITE) {
  const charge = creerCharge({ id: EVENEMENT, nom: 'Soirée des Mésanges', siegesParDefaut: 3, tours: 4 });
  const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 };
  const entrees = [];
  charge.propositions = ids.map((id) => {
    const proposition = propositionDuMoteur(id, 120, plan);
    const fichier = versFichier(proposition, petite(), options);
    entrees.push(entreeDeCourse(fichier, courseVersFichier(proposition, fichier, { attribuerSieges: false })));
    return fichier;
  });
  return { charge, entrees };
}

// Le texte du compagnon des entrees, abîmé : abimer reçoit son JSON et le
// modifie.
function texteAbime(entrees, abimer) {
  const lu = JSON.parse(texteDesCourses(EVENEMENT, entrees));
  abimer(lu);
  return JSON.stringify(lu);
}

const cles = (courses) => [...courses.keys()];

// Le nombre d'appels de Math.imul pendant faire(), et ce que faire rend :
// l'empreinte d'un placement est le seul code de src à l'appeler, si bien
// qu'un compte nul dit qu'aucun placement ne s'est haché.
function hachages(faire) {
  const imul = Math.imul;
  let n = 0;
  Math.imul = (a, b) => {
    n += 1;
    return imul(a, b);
  };
  try {
    const rendu = faire();
    return { n, rendu };
  } finally {
    Math.imul = imul;
  }
}

describe('le compagnon des courses : son texte (§ 8.9, B31)', () => {
  test("une entrée par ligne, l'identité de la proposition puis sa course ; aucune entrée, une seule ligne ; le texte finit par une fin de ligne", () => {
    const { entrees } = chargeEtEntrees([1, 2]);
    const texte = texteDesCourses(EVENEMENT, entrees);
    const lignes = texte.split('\n');
    assert.equal(lignes[0], `{"format":${FORMAT_COURSES},"evenement":"${EVENEMENT}","courses":[`);
    assert.equal(lignes[1], `${JSON.stringify(entrees[0])},`);
    assert.equal(lignes[2], JSON.stringify(entrees[1]));
    assert.deepEqual(lignes.slice(3), [']}', '']);
    assert.deepEqual(Object.keys(entrees[0]), ['id', 'graine', 'arret', 'historique', 'empreinte', 'course']);
    assert.equal(texteDesCourses(EVENEMENT, []), `{"format":${FORMAT_COURSES},"evenement":"${EVENEMENT}","courses":[]}\n`);
    assert.equal(FORMAT_COURSES, 1);
  });

  test('entreeDeCourse ne partage rien avec la course reçue ; cleDeCourse lit l’identité, l’horodatage et l’empreinte du placement', () => {
    const { charge, entrees } = chargeEtEntrees([1]);
    const [p] = charge.propositions;
    const entree = entreeDeCourse(p, entrees[0].course);
    assert.notEqual(entree.course, entrees[0].course);
    assert.notEqual(entree.course.releves[0].placement, entrees[0].course.releves[0].placement);
    assert.equal(cleDeCourse(p), cleDeCourse(entree));
    assert.notEqual(cleDeCourse({ ...p, graine: p.graine + 1 }), cleDeCourse(p));
    assert.notEqual(cleDeCourse({ ...p, historique: 7 }), cleDeCourse(p));
    assert.notEqual(cleDeCourse({ ...p, arret: 7 }), cleDeCourse(p));
    // La version qui a produit la proposition n'y entre pas ; l'horodatage
    // de sa génération, si.
    assert.equal(cleDeCourse({ ...p, produitVersion: 'x' }), cleDeCourse(p));
    const datee = { ...p, horodatage: '2031-05-17T08:00:00-04:00' };
    assert.notEqual(cleDeCourse(datee), cleDeCourse(p));
    assert.notEqual(cleDeCourse({ ...p, horodatage: '2031-05-17T08:00:01-04:00' }), cleDeCourse(datee));
    assert.equal(Object.hasOwn(entreeDeCourse(p, entrees[0].course), 'horodatage'), false);
    const entreeDatee = entreeDeCourse(datee, entrees[0].course);
    assert.deepEqual(Object.keys(entreeDatee), ['id', 'graine', 'arret', 'historique', 'horodatage', 'empreinte', 'course']);
    assert.equal(cleDeCourse(entreeDatee), cleDeCourse(datee));
  });

  test("l'empreinte est celle du placement canonique : l'ordre d'une liste de table sans sièges attribués ni celui d'une réserve n'y entre pas", () => {
    const { charge } = chargeEtEntrees([1]);
    const [p] = charge.propositions;
    assert.equal(p.siegesAttribues, false);
    const melange = structuredClone(p);
    melange.placement[0].sieges[0].reverse();
    assert.equal(cleDeCourse(melange), cleDeCourse(p));
    assert.notEqual(cleDeCourse({ ...melange, siegesAttribues: true }), cleDeCourse(p));
    assert.ok(Number.isSafeInteger(entreeDeCourse(p, { evalues: 0, releves: [] }).empreinte));
  });
});

describe("le compagnon des courses : une identité désigne une seule recherche (§ 8.9, B31)", () => {
  // Une génération défaite remet le compteur des propositions en arrière, et
  // la graine proposée repart de la même valeur : après un changement qui
  // laisse la déclaration intacte — une appartenance, une réservation, un
  // réglage —, la recherche suivante porte les mêmes id, graine, arret et
  // historique, et un autre placement.
  test('une proposition régénérée sous la même identité, sur un autre placement, ne reçoit jamais la course de la première', () => {
    const premiere = chargeEtEntrees([1, 2]);
    const seconde = chargeEtEntrees([1, 2], PLAN_INVERSE);
    const [p1] = premiere.charge.propositions;
    const [q1] = seconde.charge.propositions;
    assert.deepEqual([q1.id, q1.graine, q1.arret, q1.historique], [p1.id, p1.graine, p1.arret, p1.historique]);
    assert.notDeepEqual(q1.placement, p1.placement);
    assert.notEqual(cleDeCourse(q1), cleDeCourse(p1));

    // En mémoire, les deux courses coexistent, chacune sous sa proposition.
    const courses = avecCourses(avecCourses(new Map(), premiere.entrees), seconde.entrees);
    assert.equal(courses.size, 4);
    assert.deepEqual(courseDe({ charge: premiere.charge, courses }, 1).releves[0].plan.tours[0], PLAN_PARFAIT_PETITE.tours[1]);
    assert.deepEqual(courseDe({ charge: seconde.charge, courses }, 1).releves[0].plan.tours[0], PLAN_INVERSE.tours[1]);
    // Sans la course de la première, sa proposition n'en a aucune.
    assert.equal(courseDe({ charge: premiere.charge, courses: avecCourses(new Map(), seconde.entrees) }, 1), null);

    // Le compagnon de la seconde ne confirme rien pour la première.
    assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, seconde.entrees), premiere.charge)), []);
    // Ni l'inverse.
    assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, premiere.entrees), seconde.charge)), []);
    // Ce que le compagnon de la première porterait se reconnaît.
    assert.deepEqual(entreesPour(courses, premiere.charge.propositions), premiere.entrees);
  });

  // La recherche suivante peut aussi finir sur le même placement par une
  // autre course : seul l'horodatage de sa génération la départage.
  test("une proposition régénérée sous la même identité, sur le même placement et à un autre instant, ne reçoit jamais la course de la première", () => {
    const dater = ({ charge, entrees }, horodatage) => {
      charge.propositions = charge.propositions.map((p) => ({ ...p, horodatage }));
      const course = (p) => entrees.find(({ id }) => id === p.id).course;
      return { charge, entrees: charge.propositions.map((p) => entreeDeCourse(p, course(p))) };
    };
    const premiere = dater(chargeEtEntrees([1, 2]), '2031-05-17T08:02:00-04:00');
    const seconde = dater(chargeEtEntrees([1, 2]), '2031-05-17T08:05:00-04:00');
    for (const entree of seconde.entrees) entree.course.evalues -= 1;
    const [p1] = premiere.charge.propositions;
    const [q1] = seconde.charge.propositions;
    assert.deepEqual(q1.placement, p1.placement);
    assert.notEqual(cleDeCourse(q1), cleDeCourse(p1));

    const courses = avecCourses(avecCourses(new Map(), premiere.entrees), seconde.entrees);
    assert.equal(courses.size, 4);
    assert.equal(courseDe({ charge: premiere.charge, courses }, 1).evalues, 120);
    assert.equal(courseDe({ charge: seconde.charge, courses }, 1).evalues, 119);
    assert.equal(courseDe({ charge: premiere.charge, courses: avecCourses(new Map(), seconde.entrees) }, 1), null);
    assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, seconde.entrees), premiere.charge)), []);
    assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, premiere.entrees), seconde.charge)), []);

    // Sans horodatage, les deux propositions ont la même clé : l'identité ne
    // les départage plus. Une entrée sans horodatage ne vaut pas pour une
    // proposition datée, ni l'inverse.
    const sansDate = chargeEtEntrees([1, 2]);
    assert.equal(cleDeCourse(sansDate.charge.propositions[0]), cleDeCourse({ ...q1, horodatage: undefined }));
    assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, sansDate.entrees), premiere.charge)), []);
    assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, premiere.entrees), sansDate.charge)), []);
  });
});

describe('le compagnon des courses : sa lecture, qui ne lève jamais (§ 8.9, B31)', () => {
  test('relu, le texte rend chaque entrée sous la clé de sa proposition, dans l’ordre du fichier', () => {
    const { charge, entrees } = chargeEtEntrees();
    const courses = lireCourses(texteDesCourses(EVENEMENT, entrees), charge);
    assert.deepEqual(cles(courses), charge.propositions.map(cleDeCourse));
    assert.deepEqual([...courses.values()], entrees);
    // Une marque d'ordre d'octets en tête ne change rien.
    assert.deepEqual(lireCourses(`\u{FEFF}${texteDesCourses(EVENEMENT, entrees)}`, charge), courses);
  });

  test("absent, vide, hors JSON, d'une autre forme, d'un autre format ou d'un autre événement : aucune course, sans lever", () => {
    const { charge, entrees } = chargeEtEntrees();
    const textes = [
      null,
      '',
      'pas du JSON',
      texteDesCourses(EVENEMENT, entrees).slice(0, -40),
      'null',
      '[]',
      texteAbime(entrees, (lu) => { lu.format = FORMAT_COURSES + 1; }),
      texteAbime(entrees, (lu) => { lu.format = 0; }),
      texteAbime(entrees, (lu) => { delete lu.format; }),
      texteAbime(entrees, (lu) => { lu.evenement = 'evt-autre'; }),
      texteAbime(entrees, (lu) => { lu.courses = {}; }),
      texteAbime(entrees, (lu) => { lu.duree = 3; }),
    ];
    for (const texte of textes) assert.deepEqual(cles(lireCourses(texte, charge)), [], String(texte).slice(0, 60));
  });

  test("une entrée hors de sa règle, sans proposition de son identité, répétée ou dont la course contredit sa proposition s'écarte seule ; les autres restent", () => {
    const { charge, entrees } = chargeEtEntrees();
    const [une, deux, trois] = charge.propositions.map(cleDeCourse);
    const cas = [
      ['une durée dans la course', (lu) => { lu.courses[1].course.releves[0].duree = 3; }, [une, trois]],
      ['un identifiant hors de sa règle', (lu) => { lu.courses[1].id = 0; }, [une, trois]],
      ['une autre graine : une proposition périmée', (lu) => { lu.courses[0].graine += 1; }, [deux, trois]],
      ['un autre historique', (lu) => { lu.courses[2].historique = 7; }, [une, deux]],
      ['une autre empreinte : la course d’un autre placement', (lu) => { lu.courses[1].empreinte += 1; }, [une, trois]],
      ['une empreinte absente', (lu) => { delete lu.courses[0].empreinte; }, [deux, trois]],
      ['une empreinte hors de sa règle', (lu) => { lu.courses[2].empreinte = '7'; }, [une, deux]],
      ['un horodatage que sa proposition ne porte pas', (lu) => {
        lu.courses[0].horodatage = '2031-05-17T08:00:00-04:00';
      }, [deux, trois]],
      ['un horodatage hors de sa règle', (lu) => { lu.courses[1].horodatage = null; }, [une, trois]],
      ['un identifiant absent de la charge', (lu) => { lu.courses[2].id = 9; }, [une, deux]],
      ['evalues au-delà de arret', (lu) => { lu.courses[0].course.evalues = 20_001; }, [deux, trois]],
      ['un doublon dans un placement de relevé', (lu) => {
        lu.courses[1].course.releves[1].placement[0].reserve.push(1);
      }, [une, trois]],
      ['une entrée répétée : la seconde', (lu) => { lu.courses.push(structuredClone(lu.courses[0])); }, [une, deux, trois]],
      ['une entrée qui n’est pas un objet', (lu) => { lu.courses[1] = 3; }, [une, trois]],
    ];
    const ecarts = cas.flatMap(([libelle, abimer, attendues]) => {
      const lues = cles(lireCourses(texteAbime(entrees, abimer), charge));
      return JSON.stringify(lues) === JSON.stringify(attendues) ? [] : [`${libelle} : ${JSON.stringify(lues)}`];
    });
    assert.deepEqual(ecarts, []);
  });
});

describe("le compagnon des courses : la course d'une proposition (§ 8.9, B31)", () => {
  test('courseDe rend la course en plans par identifiants, ou null : proposition absente, course inconnue ou d’une autre identité', () => {
    const { charge, entrees } = chargeEtEntrees();
    const courses = avecCourses(new Map(), entrees.slice(0, 2));
    const course = courseDe({ charge, courses }, 2);
    assert.equal(course.evalues, 120);
    assert.deepEqual(course.releves.map(({ mouvements }) => mouvements), [1, 10, 100]);
    assert.deepEqual(course.releves[0].plan.tables, [1, 2, 3, 4]);
    assert.equal(courseDe({ charge, courses }, 3), null);
    assert.equal(courseDe({ charge, courses }, 9), null);
    const autreGraine = structuredClone(charge);
    autreGraine.propositions[1].graine += 1;
    assert.equal(courseDe({ charge: autreGraine, courses }, 2), null);
  });

  test("une course contradictoire n'atteint jamais le détail : courseDe la relit et rend null, d'où qu'elle vienne", () => {
    const { charge, entrees } = chargeEtEntrees();
    const forgee = structuredClone(entrees[0]);
    forgee.course.releves[2].placement[3].reserve.push(1);
    assert.equal(courseDe({ charge, courses: avecCourses(new Map(), [forgee]) }, 1), null);
  });

  test("avecCourses rend une table neuve, la plus récente de deux entrées d'une même clé gardée ; entreesPour rend les entrées des propositions données, dans leur ordre, sans celles qu'elle ne connaît pas", () => {
    const { charge, entrees } = chargeEtEntrees();
    const avant = avecCourses(new Map(), entrees.slice(0, 1));
    const apres = avecCourses(avant, entrees.slice(1));
    assert.notEqual(apres, avant);
    assert.deepEqual(cles(avant), [cleDeCourse(entrees[0])]);
    assert.deepEqual(cles(apres), entrees.map(cleDeCourse));
    const remplacee = { ...entrees[0], course: { evalues: 0, releves: [] } };
    assert.equal(avecCourses(apres, [remplacee]).get(cleDeCourse(remplacee)), remplacee);
    const inverses = [...charge.propositions].reverse();
    assert.deepEqual(entreesPour(apres, inverses), [...entrees].reverse());
    assert.deepEqual(entreesPour(avant, charge.propositions), [entrees[0]]);
    assert.deepEqual(entreesPour(apres, []), []);
  });
});

describe("le compagnon des courses : l'empreinte d'un placement copié (§ 8.9)", () => {
  test("heriterEmpreintes : la copie d'un placement déjà haché reçoit son empreinte sans rien hacher ; un autre placement sous la même identité, ou un autre drapeau siegesAttribues, se hache de nouveau", () => {
    const { charge } = chargeEtEntrees([1, 2]);
    const inverse = chargeEtEntrees([1, 2], PLAN_INVERSE).charge.propositions[1];
    const avant = charge.propositions.map(cleDeCourse);
    const copies = structuredClone(charge.propositions);
    copies[1].placement = structuredClone(inverse.placement);
    const copieSansAttribution = structuredClone(charge.propositions[0]);

    const report = hachages(() => heriterEmpreintes(charge.propositions, [...copies, copieSansAttribution]));
    assert.equal(report.n, 0, 'le report ne hache rien');
    const gardee = hachages(() => cleDeCourse(copies[0]));
    assert.equal(gardee.n, 0, 'la copie du même placement ne se hache pas');
    assert.equal(gardee.rendu, avant[0]);

    // Même identifiant, graine, arrêt et historique, autre placement : la
    // clé suit le placement, jamais l'empreinte de l'original.
    const changee = hachages(() => cleDeCourse(copies[1]));
    assert.ok(changee.n > 0, 'un autre placement se hache');
    assert.notEqual(changee.rendu, avant[1]);
    assert.equal(changee.rendu, cleDeCourse(inverse));

    // L'empreinte reportée porte le drapeau de l'original.
    copieSansAttribution.siegesAttribues = true;
    assert.ok(hachages(() => cleDeCourse(copieSansAttribution)).n > 0);
  });

  // Chaque liste que lit le texte canonique compte : une copie dont une
  // seule liste diffère n'hérite de rien, se hache, et prend la clé d'un
  // clone neuf, qui ne porte aucune empreinte.
  for (const [quoi, changer] of [
    ['seule une réserve change', (placement) => placement[0].reserve.push(99)],
    [
      'seul le dernier tour change',
      (placement) => {
        const { sieges } = placement.at(-1);
        [sieges[0][0], sieges[1][0]] = [sieges[1][0], sieges[0][0]];
      },
    ],
    ['un tour compte une liste de sièges de plus', (placement) => placement[0].sieges.push([])],
    [
      'seule la deuxième liste de sièges change',
      (placement) => {
        const { sieges } = placement[0];
        [sieges[1][0], sieges[2][0]] = [sieges[2][0], sieges[1][0]];
      },
    ],
    [
      'seuls deux occupants après le premier de leur liste changent',
      (placement) => {
        const { sieges } = placement[0];
        [sieges[0][1], sieges[1][1]] = [sieges[1][1], sieges[0][1]];
      },
    ],
    ['le placement compte un tour de plus', (placement) => placement.push(structuredClone(placement.at(-1)))],
  ]) {
    test(`heriterEmpreintes : ${quoi}, sous la même identité — la copie se hache et prend la clé d'un clone neuf`, () => {
      const { charge } = chargeEtEntrees([1, 2]);
      const avant = charge.propositions.map(cleDeCourse);
      const copies = structuredClone(charge.propositions);
      changer(copies[0].placement);
      const neuve = structuredClone(copies[0]);

      assert.equal(hachages(() => heriterEmpreintes(charge.propositions, copies)).n, 0, 'le report ne hache rien');
      const changee = hachages(() => cleDeCourse(copies[0]));
      assert.ok(changee.n > 0, 'le placement changé se hache');
      assert.equal(changee.rendu, cleDeCourse(neuve));
      assert.notEqual(changee.rendu, avant[0]);
      const gardee = hachages(() => cleDeCourse(copies[1]));
      assert.deepEqual(gardee, { n: 0, rendu: avant[1] }, 'la proposition inchangée hérite');
    });
  }

  test("entreesPour ne hache que les propositions dont l'identité est celle d'une entrée ; sans aucune course, elle ne hache rien", () => {
    const { charge, entrees } = chargeEtEntrees([1, 2, 3]);
    const copies = structuredClone(charge.propositions);
    const courses = avecCourses(new Map(), [entrees[1]]);
    assert.deepEqual(hachages(() => entreesPour(new Map(), copies)), { n: 0, rendu: [] });
    const une = hachages(() => entreesPour(courses, copies));
    assert.deepEqual(une.rendu, [entrees[1]]);
    const seule = hachages(() => cleDeCourse(structuredClone(charge.propositions[1])));
    assert.equal(une.n, seule.n, "seule la proposition 2 s'est hachée");
  });
});

describe('le compagnon des courses : la course d’une dérivée, sous la clé de toute proposition (§ 8.6, § 8.9, C10, D78)', () => {
  const HORODATAGE = '2031-05-17T08:02:00-04:00';
  const options = { produitVersion: VERSION.affichee, attribuerSieges: false, decalage: 0 };

  // La proposition 4 du moteur sur plan, mise en fichier avec derivation
  // (null : ordinaire), datée de HORODATAGE, et son entrée.
  function fichierEtEntree(plan, derivation) {
    const proposition = propositionDuMoteur(4, 120, plan);
    const fichier = { ...versFichier(proposition, petite(), { ...options, derivation }), horodatage: HORODATAGE };
    return { fichier, entree: entreeDeCourse(fichier, courseVersFichier(proposition, fichier, { attribuerSieges: false })) };
  }

  test('l’entrée d’une dérivée a les clés d’une proposition ordinaire, sans depart ni toursFiges, et sa clé la forme id|graine|arret|historique|horodatage|empreinte', () => {
    for (const derivation of [{ depart: 1, toursFiges: [] }, { depart: 1, toursFiges: [2, 3] }]) {
      // Une dérivée porte un identifiant au-delà de son départ.
      const proposition = propositionDuMoteur(4);
      const fichier = { ...versFichier(proposition, petite(), { ...options, derivation }), horodatage: HORODATAGE };
      const entree = entreeDeCourse(fichier, courseVersFichier(proposition, fichier, { attribuerSieges: false }));
      assert.deepEqual(Object.keys(entree), ['id', 'graine', 'arret', 'historique', 'horodatage', 'empreinte', 'course']);
      const cle = cleDeCourse(fichier);
      assert.match(cle, /^4\|104\|20000\|1000\|2031-05-17T08:02:00-04:00\|\d+$/);
      assert.equal(cleDeCourse(entree), cle);
      // Sa clé est celle de la même proposition sans dérivation.
      const { depart, toursFiges, ...ordinaire } = fichier;
      assert.equal(cleDeCourse(ordinaire), cle);
      // Le compagnon la relit sous cette clé.
      const charge = creerCharge({ id: EVENEMENT, nom: 'Soirée des Mésanges', siegesParDefaut: 3, tours: 4 });
      charge.propositions = [fichier];
      assert.deepEqual(cles(lireCourses(texteDesCourses(EVENEMENT, [entree]), charge)), [cle]);
    }
  });

  // Deux états de part et d'autre d'un retour : la même génération,
  // ordinaire dans l'un, dérivée de la 1 dans l'autre, a donné la
  // proposition 4 au même triplet et au même horodatage, sur deux
  // placements.
  test('deux propositions de même identifiant, même triplet et même horodatage, l’une ordinaire, l’autre dérivée, de placements différents : deux clés que seule l’empreinte sépare', () => {
    const ordinaire = fichierEtEntree(PLAN_PARFAIT_PETITE, null);
    const derivee = fichierEtEntree(PLAN_INVERSE, { depart: 1, toursFiges: [2] });
    assert.deepEqual(
      [ordinaire.fichier.id, ordinaire.fichier.graine, ordinaire.fichier.arret, ordinaire.fichier.historique, ordinaire.fichier.horodatage],
      [derivee.fichier.id, derivee.fichier.graine, derivee.fichier.arret, derivee.fichier.historique, derivee.fichier.horodatage],
    );
    const [a, b] = [cleDeCourse(ordinaire.fichier), cleDeCourse(derivee.fichier)];
    assert.notEqual(a, b);
    const sansEmpreinte = (cle) => cle.slice(0, cle.lastIndexOf('|'));
    assert.equal(sansEmpreinte(a), sansEmpreinte(b));
    // Chaque état ne relit que sa propre course.
    const chargeDe = (fichier) => {
      const charge = creerCharge({ id: EVENEMENT, nom: 'Soirée des Mésanges', siegesParDefaut: 3, tours: 4 });
      charge.propositions = [fichier];
      return charge;
    };
    const texte = texteDesCourses(EVENEMENT, [ordinaire.entree, derivee.entree]);
    assert.deepEqual(cles(lireCourses(texte, chargeDe(ordinaire.fichier))), [a]);
    assert.deepEqual(cles(lireCourses(texte, chargeDe(derivee.fichier))), [b]);
  });
});
