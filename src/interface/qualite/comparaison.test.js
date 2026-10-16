// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle de la vue de comparaison de la page de qualité
// (§ 12.6, § 12.7, § 12.10.6, § 12.10.7, D56 à D67, D85, C14, C17, C18,
// C20, C21, C29) : les deux placements et la liste « Comparer à : », le
// second placement — la comparée quand elle est candidate, sinon le défaut,
// jamais la source ni le placement identique à elle —, les cas seul, refus,
// populations, phrase et tracé ; un axe commun aux deux courbes, borné par
// la borne haute de la comparaison ; les trois effectifs, la bascule nommée
// au seul changement de signe, la dominance quand elle tient ; le jumeau,
// une ligne par entier ; l'infobulle et le jumeau en comptes. Chaque nombre
// est celui que comparerPlacements porte. Les lignes de la table se forgent
// pour poser des profils de manque exacts ; les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { candidatsDeComparaison, comparerPlacements, evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { nomDe } from '../propositions/modele.js';
import { vueComparaison } from './comparaison.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const outils = { t, format };
const V1 = VERSION.affichee;

// Douze personnes inventées, trois tables de quatre places, trois tours.
const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Tourteau', 'Basile'],
  ['Quenouille', 'Maëlle'],
  ['Varech', 'Sidonie'],
  ['Grésil', 'Lucien'],
  ['Mirabelle', 'Agathe'],
  ['Ardoise', 'Anatole'],
  ['Cardon', 'Noémie'],
  ['Ronce', 'Gaspard'],
  ['Aubépine', 'Clémence'],
];

function chargeDouze() {
  const charge = creerCharge({
    id: 'evt-comparaison',
    nom: 'Atelier Ressac',
    siegesParDefaut: 4,
    tours: 3,
  });
  charge.participants = NOMS.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: rang % 2 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3].map((id) => ({
    id,
    numero: id,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * id, y: 0 },
  }));
  charge.prochainsIds = { participant: 13, table: 4, proposition: 1 };
  return charge;
}

// Fige une valeur et tout ce qu'elle atteint, comme la séance fige sa
// charge.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 5, arret: 30, nombre: 4 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return executer(charge, 'enregistrerGeneration', {
    propositions,
    configuration,
    produitVersion: V1,
  });
}

// Quatre propositions, numérotées 1 à 4.
const quatre = () => figer(generee(chargeDouze()));

// La charge dont le retenu est tiré de la proposition id ; ajusté : deux
// personnes des deux premières tables échangées au premier tour, les listes
// gardées croissantes.
function avecRetenu(charge, id, { ajuste = false } = {}) {
  const retenue = structuredClone(executer(charge, 'retenirProposition', { id }));
  if (ajuste) {
    const [premiere, seconde] = retenue.retenu.placement[0].sieges;
    [premiere[0], seconde[0]] = [seconde[0], premiere[0]];
    for (const liste of [premiere, seconde]) liste.sort((x, y) => x - y);
  }
  return figer(retenue);
}

// La table dont la ligne du placement cle est remplacée par ce que forger
// fait d'une copie d'elle.
function tableForgee(table, cle, forger) {
  const forgee = (ligne) => {
    const copie = structuredClone(ligne);
    forger(copie);
    return copie;
  };
  if (cle === 'retenu') return { ...table, retenu: forgee(table.retenu) };
  return {
    ...table,
    propositions: table.propositions.map((ligne) => (ligne.id === cle ? forgee(ligne) : ligne)),
  };
}

// Pose le manque de chaque personne d'une ligne, dans l'ordre de la
// population, les suivantes à 0 : ses rencontres deviennent son plafond
// réalisé moins ce manque.
const poserManques = (voulus) => (ligne) => {
  ligne.plafondsRealises.forEach((plafond, p) => {
    ligne.mesures.rencontres[p] = plafond - (voulus[p] ?? 0);
  });
};

// La table de la charge, les manques de a et de b posés.
const avecManques = (table, [a, manquesA], [b, manquesB]) =>
  tableForgee(tableForgee(table, a, poserManques(manquesA)), b, poserManques(manquesB));

// La source mesurable de la page sur le placement id.
const source = (id) => ({ cas: 'mesurable', id });

// Le nom d'un placement sur la ligne de la vue, et dans ses phrases.
const nom = (cle) =>
  cle === 'retenu' ? t('qualite.comparaison.nom.retenu') : t('qualite.comparaison.nom.proposition', { proposition: cle });
const sujet = (cle) => (cle === 'retenu' ? t('qualite.comparaison.sujet.retenu') : nom(cle));

const codes = (modele) => modele.phrases.map(({ code }) => code);
const phrase = (modele, code) => modele.phrases.find((candidate) => candidate.code === code) ?? null;

describe('vueComparaison : la bascule, la dominance, un axe commun (§ 12.10.6, § 12.10.7, D60, C20, C21)', () => {
  test('rouge : la bascule ne se nomme que quand le signe change une fois, sur un axe commun', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const cas = [
      // Un changement de signe : 1 sert moins bien aux rangs 1 et 2, mieux
      // aux rangs 3 et 4.
      ['une fois', [3, 3, 1, 1], [2, 2, 2, 2]],
      // Deux changements : moins bien, mieux, moins bien.
      ['deux fois', [3, 1, 1], [2, 2]],
      // Aucun : 1 sert mieux ou aussi bien à chaque rang.
      ['aucune', [2, 1], [3, 2, 1]],
    ];
    const modeles = new Map();
    for (const [nomDuCas, manquesA, manquesB] of cas) {
      const forgee = avecManques(table, [1, manquesA], [2, manquesB]);
      const comparaison = comparerPlacements(charge, forgee, 1, 2);
      const modele = vueComparaison(charge, forgee, { source: source(1), comparee: 2 }, outils);
      assert.equal(modele.cas, 'trace', nomDuCas);
      assert.deepEqual(modele.comparaison, comparaison, nomDuCas);
      // Un seul axe : la borne haute de la comparaison, la même pour les
      // deux courbes, jamais le plus grand plafond réalisé.
      assert.equal(modele.borneHaute, comparaison.borneHaute, nomDuCas);
      assert.equal(modele.borneHaute, 3, nomDuCas);
      assert.deepEqual(
        modele.series.map(({ cle, libelle, valeurs }) => ({
          cle,
          libelle,
          valeurs,
        })),
        [
          {
            cle: 'a',
            libelle: nom(1),
            valeurs: comparaison.profils.a.map(({ manque }) => manque),
          },
          {
            cle: 'b',
            libelle: nom(2),
            valeurs: comparaison.profils.b.map(({ manque }) => manque),
          },
        ],
        nomDuCas,
      );
      modeles.set(nomDuCas, modele);
    }

    const uneFois = modeles.get('une fois');
    assert.equal(uneFois.comparaison.rangs.bascule, 3);
    assert.deepEqual(phrase(uneFois, 'bascule'), {
      code: 'bascule',
      texte: t('qualite.comparaison.bascule', {
        rang: 3,
        gagne: sujet(1),
        perd: sujet(2),
      }),
      liste: null,
    });
    assert.equal(phrase(uneFois, 'domine'), null);

    const deuxFois = modeles.get('deux fois');
    assert.equal(deuxFois.comparaison.rangs.bascule, null);
    assert.equal(phrase(deuxFois, 'bascule'), null);
    assert.equal(phrase(deuxFois, 'domine'), null);

    const aucune = modeles.get('aucune');
    assert.equal(aucune.comparaison.rangs.domine, 'a');
    assert.equal(phrase(aucune, 'bascule'), null);
    assert.equal(phrase(aucune, 'domine').texte, t('qualite.comparaison.domine', { proposition: 1 }));

    // Les trois effectifs, dans chaque cas, de la comparaison telle quelle.
    for (const modele of modeles.values()) {
      const { a, b, egalite } = modele.comparaison.rangs;
      assert.equal(
        phrase(modele, 'effectifs').texte,
        t('qualite.comparaison.effectifs', {
          a: sujet(1),
          rangsA: a,
          b: sujet(2),
          rangsB: b,
          egalite,
        }),
      );
    }
  });

  test('la bascule nomme le placement qui sert mieux à partir d’elle, de l’un ou de l’autre côté', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const forgee = avecManques(table, [1, [2, 2, 2, 2]], [2, [3, 3, 1, 1]]);
    const modele = vueComparaison(charge, forgee, { source: source(1), comparee: 2 }, outils);
    assert.equal(modele.comparaison.rangs.bascule, 3);
    assert.equal(
      phrase(modele, 'bascule').texte,
      t('qualite.comparaison.bascule', {
        rang: 3,
        gagne: sujet(2),
        perd: sujet(1),
      }),
    );
  });

  test('la dominance se dit de la proposition n° X ou du placement retenu, et seulement quand elle tient', () => {
    const charge = avecRetenu(quatre(), 3);
    const table = evaluer(charge);
    const retenuDomine = avecManques(table, [1, [2, 2, 1]], ['retenu', [1]]);
    const parRetenu = vueComparaison(charge, retenuDomine, { source: source(1), comparee: 'retenu' }, outils);
    assert.equal(parRetenu.comparaison.rangs.domine, 'b');
    assert.equal(phrase(parRetenu, 'domine').texte, t('qualite.comparaison.dominePlacementRetenu'));
    assert.equal(
      phrase(parRetenu, 'effectifs').texte,
      t('qualite.comparaison.effectifs', {
        a: sujet(1),
        rangsA: 0,
        b: sujet('retenu'),
        rangsB: parRetenu.comparaison.rangs.b,
        egalite: parRetenu.comparaison.rangs.egalite,
      }),
    );
    const depuisRetenu = vueComparaison(charge, retenuDomine, { source: source('retenu'), comparee: 1 }, outils);
    assert.equal(depuisRetenu.comparaison.rangs.domine, 'a');
    assert.equal(phrase(depuisRetenu, 'domine').texte, t('qualite.comparaison.dominePlacementRetenu'));
    const parDeux = vueComparaison(charge, avecManques(table, [1, [2, 2, 1]], [2, [1]]), { source: source(1), comparee: 2 }, outils);
    assert.equal(parDeux.comparaison.rangs.domine, 'b');
    assert.equal(phrase(parDeux, 'domine').texte, t('qualite.comparaison.domine', { proposition: 2 }));
    // Un croisement : ni dominance, ni phrase qui en tienne lieu.
    const croisees = vueComparaison(charge, avecManques(table, [1, [3, 0, 1]], [2, [2, 2]]), { source: source(1), comparee: 2 }, outils);
    assert.equal(croisees.comparaison.rangs.domine, null);
    assert.equal(phrase(croisees, 'domine'), null);
  });

  test('deux profils égaux : indiscernables, départagés par le palier qui diffère, par l’identifiant, ou contre le retenu par rien', () => {
    const charge = avecRetenu(quatre(), 3, { ajuste: true });
    const table = evaluer(charge);
    const egaux = avecManques(table, [1, [2, 1, 1]], [2, [2, 1, 1]]);
    const parPalier = vueComparaison(charge, egaux, { source: source(1), comparee: 2 }, outils);
    const { palier } = parPalier.comparaison.indiscernables;
    assert.notEqual(palier, null);
    assert.equal(phrase(parPalier, 'indiscernables').texte, t('qualite.comparaison.indiscernables.palier', palier));
    assert.equal(phrase(parPalier, 'domine'), null);
    assert.equal(phrase(parPalier, 'bascule'), null);

    // Les mêmes mesures des deux côtés : chaque palier les tient à égalité.
    const memes = tableForgee(egaux, 2, (ligne) => {
      ligne.mesures = structuredClone(egaux.propositions.find(({ id }) => id === 1).mesures);
      ligne.plafondsRealises = [...egaux.propositions.find(({ id }) => id === 1).plafondsRealises];
    });
    const parIdentifiant = vueComparaison(charge, memes, { source: source(1), comparee: 2 }, outils);
    assert.deepEqual(parIdentifiant.comparaison.indiscernables, {
      palier: null,
      retenu: false,
    });
    assert.equal(phrase(parIdentifiant, 'indiscernables').texte, t('qualite.comparaison.indiscernables.identifiant'));

    const contreRetenu = avecManques(table, [1, [2, 1, 1]], ['retenu', [2, 1, 1]]);
    const parRetenu = vueComparaison(charge, contreRetenu, { source: source(1), comparee: 'retenu' }, outils);
    assert.deepEqual(parRetenu.comparaison.indiscernables, {
      palier: null,
      retenu: true,
    });
    assert.equal(phrase(parRetenu, 'indiscernables').texte, t('qualite.comparaison.indiscernables.retenu'));
  });

  test('le rang 1 se nomme quand il ne désigne pas la même personne des deux côtés, et se tait sinon', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const differents = avecManques(table, [1, [3, 1, 1]], [2, [0, 2, 2]]);
    const modele = vueComparaison(charge, differents, { source: source(1), comparee: 2 }, outils);
    const [premierA] = modele.comparaison.profils.a;
    const [premierB] = modele.comparaison.profils.b;
    assert.notEqual(premierA.id, premierB.id);
    assert.deepEqual(phrase(modele, 'rang1'), {
      code: 'rang1',
      texte: t('qualite.comparaison.rang1Different', {
        a: sujet(1),
        nomA: nomDe(charge, premierA.id),
        b: sujet(2),
        nomB: nomDe(charge, premierB.id),
      }),
      liste: null,
    });
    const memes = vueComparaison(charge, avecManques(table, [1, [3, 1, 1]], [2, [2, 0, 1]]), { source: source(1), comparee: 2 }, outils);
    assert.equal(memes.comparaison.profils.a[0].id, memes.comparaison.profils.b[0].id);
    assert.equal(phrase(memes, 'rang1'), null);
  });

  test('le placement retenu, dans la phrase du rang 1, s’écrit avec son article', () => {
    const charge = avecRetenu(quatre(), 3);
    const table = evaluer(charge);
    const modele = vueComparaison(
      charge,
      avecManques(table, [1, [3, 1, 1]], ['retenu', [0, 2, 2]]),
      { source: source(1), comparee: 'retenu' },
      outils,
    );
    const [premierA] = modele.comparaison.profils.a;
    const [premierB] = modele.comparaison.profils.b;
    assert.equal(
      phrase(modele, 'rang1').texte,
      t('qualite.comparaison.rang1Different', {
        a: sujet(1),
        nomA: nomDe(charge, premierA.id),
        b: t('qualite.comparaison.sujet.retenu'),
        nomB: nomDe(charge, premierB.id),
      }),
    );
    assert.ok(phrase(modele, 'rang1').texte.endsWith(` pour le placement retenu.`), phrase(modele, 'rang1').texte);
  });

  test('l’ordre des phrases : le rang 1, les trois effectifs, puis la bascule, la dominance ou l’indiscernabilité', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const modele = vueComparaison(
      charge,
      avecManques(table, [1, [3, 3, 1, 1]], [2, [0, 2, 2, 2, 2]]),
      { source: source(1), comparee: 2 },
      outils,
    );
    assert.deepEqual(codes(modele), ['rang1', 'effectifs', 'bascule']);
  });
});

describe('vueComparaison : les deux placements, la liste « Comparer à : », le second placement (D56, D58, D85, C14, C20)', () => {
  test('B est la comparée quand elle est candidate, sinon le défaut — jamais la source, ni un placement absent', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const { candidats, defaut } = candidatsDeComparaison(charge, table, 1);
    assert.notEqual(defaut, null);
    for (const [comparee, attendue] of [
      [null, defaut],
      [3, 3],
      [4, 4],
      [1, defaut],
      [99, defaut],
      ['retenu', defaut],
    ]) {
      const modele = vueComparaison(charge, table, { source: source(1), comparee }, outils);
      assert.equal(modele.choisi, attendue, String(comparee));
      assert.notEqual(modele.choisi, 1, String(comparee));
      assert.deepEqual(
        modele.placements,
        {
          a: { cle: 1, nom: nom(1) },
          b: { cle: attendue, nom: nom(attendue) },
        },
        String(comparee),
      );
      assert.deepEqual(modele.comparaison, comparerPlacements(charge, table, 1, attendue), String(comparee));
    }
    // La liste porte exactement les candidats, dans leur ordre, chacun sous
    // son numéro et son rang.
    const modele = vueComparaison(charge, table, { source: source(1), comparee: null }, outils);
    assert.deepEqual(
      modele.liste,
      candidats.map(({ cle, rang }) => ({
        cle,
        texte: t('qualite.comparaison.candidat', { nom: nom(cle), rang }),
      })),
    );
    assert.ok(!modele.liste.some(({ cle }) => cle === 1));
  });

  test('un retenu non ajusté et sa proposition ne se comparent pas l’un à l’autre ; un retenu ajusté se compare, hors classement', () => {
    const nonAjuste = avecRetenu(quatre(), 1);
    const tableNonAjuste = evaluer(nonAjuste);
    const depuisUn = vueComparaison(nonAjuste, tableNonAjuste, { source: source(1), comparee: 'retenu' }, outils);
    assert.notEqual(depuisUn.choisi, 'retenu');
    assert.ok(!depuisUn.liste.some(({ cle }) => cle === 'retenu' || cle === 1));
    const depuisRetenu = vueComparaison(nonAjuste, tableNonAjuste, { source: source('retenu'), comparee: 1 }, outils);
    assert.notEqual(depuisRetenu.choisi, 1);
    assert.equal(depuisRetenu.placements.a.nom, t('qualite.comparaison.nom.retenu'));

    const ajuste = avecRetenu(quatre(), 1, { ajuste: true });
    const tableAjuste = evaluer(ajuste);
    // Le défaut d'un retenu ajusté : sa proposition d'origine.
    const depuisAjuste = vueComparaison(ajuste, tableAjuste, { source: source('retenu'), comparee: null }, outils);
    assert.equal(depuisAjuste.choisi, 1);
    const depuisProposition = vueComparaison(ajuste, tableAjuste, { source: source(2), comparee: 'retenu' }, outils);
    assert.equal(depuisProposition.choisi, 'retenu');
    assert.deepEqual(depuisProposition.liste[0], {
      cle: 'retenu',
      texte: t('qualite.comparaison.candidatHorsClassement', {
        nom: t('qualite.comparaison.nom.retenu'),
      }),
    });
  });

  test('un seul placement mesurable : la phrase seule, sans liste ni comparaison ; une source non mesurable : aucun modèle', () => {
    const une = figer(generee(chargeDouze(), { graine: 5, arret: 30, nombre: 1 }));
    const tableUne = evaluer(une);
    assert.deepEqual(vueComparaison(une, tableUne, { source: source(1), comparee: null }, outils), {
      cas: 'seul',
      placements: null,
      liste: [],
      choisi: null,
      comparaison: null,
      borneHaute: null,
      graphique: null,
      series: null,
      infobulle: null,
      escalier: null,
      phrases: [{ code: 'seul', texte: t('qualite.comparaison.seul'), liste: null }],
    });
    // Le retenu non ajusté et sa proposition : un seul placement.
    const retenue = avecRetenu(une, 1);
    assert.equal(vueComparaison(retenue, evaluer(retenue), { source: source('retenu'), comparee: 1 }, outils).cas, 'seul');
    for (const cas of ['configuration', 'aucunPlacement', 'aucuneMontree', 'derive', 'fautif']) {
      assert.equal(vueComparaison(une, tableUne, { source: { cas, id: null }, comparee: null }, outils), null, cas);
    }
    assert.equal(vueComparaison(une, tableUne, { source: null, comparee: null }, outils), null);
  });
});

describe('vueComparaison : refus, populations, peu de valeurs, jumeau et infobulle (§ 12.6, § 12.7, C17, C18, C29)', () => {
  test('un refus de dessin d’un côté : la vue nomme ce placement et ses contradictions, et ne trace rien', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const violations = [{ code: 'DEPASSEMENT', index: 0, participant: table.population[0] }];
    const refusee = tableForgee(table, 2, (ligne) => {
      ligne.refusDessin = structuredClone(violations);
    });
    const modele = vueComparaison(charge, refusee, { source: source(1), comparee: 2 }, outils);
    assert.equal(modele.cas, 'refus');
    assert.deepEqual(modele.phrases, [
      {
        code: 'refus',
        texte: t('qualite.comparaison.refus', { nom: sujet(2) }),
        liste: [
          {
            texte: t('DEPASSEMENT', violations[0]),
            nom: nomDe(charge, table.population[0]),
          },
        ],
      },
    ]);
    assert.deepEqual(
      [modele.series, modele.infobulle, modele.escalier, modele.borneHaute, modele.graphique],
      [null, null, null, null, null],
    );
    assert.equal(modele.choisi, 2);
    assert.equal(modele.liste.length, 3);
    // Sur la ligne de la source, la vue nomme la source.
    const refuseeA = tableForgee(table, 1, (ligne) => {
      ligne.refusDessin = structuredClone(violations);
    });
    const parA = vueComparaison(charge, refuseeA, { source: source(1), comparee: 2 }, outils);
    assert.equal(parA.phrases[0].texte, t('qualite.comparaison.refus', { nom: sujet(1) }));
  });

  test('un refus de dessin sur la ligne du placement retenu le nomme avec son article', () => {
    const charge = avecRetenu(quatre(), 3);
    const table = evaluer(charge);
    const violations = [{ code: 'DEPASSEMENT', index: 0, participant: table.population[0] }];
    const refusee = tableForgee(table, 'retenu', (ligne) => {
      ligne.refusDessin = structuredClone(violations);
    });
    const modele = vueComparaison(charge, refusee, { source: source(1), comparee: 'retenu' }, outils);
    assert.equal(modele.cas, 'refus');
    assert.equal(modele.phrases[0].texte, t('qualite.comparaison.refus', { nom: t('qualite.comparaison.sujet.retenu') }));
    assert.ok(modele.phrases[0].texte.includes(' le placement retenu'), modele.phrases[0].texte);
  });

  test('des populations différentes avec le placement retenu : ses phrases le nomment avec son article', () => {
    const charge = structuredClone(avecRetenu(quatre(), 3));
    const table = evaluer(charge);
    charge.retenu.participants = charge.retenu.participants.map((id) => (id === 12 ? 99 : id));
    figer(charge);
    const modele = vueComparaison(charge, table, { source: source(1), comparee: 'retenu' }, outils);
    assert.equal(modele.cas, 'populations');
    const textes = modele.phrases.map(({ texte }) => texte);
    assert.equal(textes[0], t('qualite.comparaison.populations', { a: sujet(1), b: sujet('retenu') }));
    assert.equal(textes[2], t('qualite.comparaison.populationsSeulement', { nom: sujet('retenu') }));
    for (const texte of [textes[0], textes[2]]) assert.ok(texte.includes('le placement retenu'), texte);
  });

  test('des populations différentes : non comparable, les personnes mesurées d’un seul côté nommées, une inconnue par son numéro', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const falsifiee = structuredClone(charge);
    const deux = falsifiee.propositions.find(({ id }) => id === 2);
    deux.participants = deux.participants.map((id) => (id === 12 ? 99 : id));
    figer(falsifiee);
    const modele = vueComparaison(falsifiee, table, { source: source(1), comparee: 2 }, outils);
    assert.equal(modele.cas, 'populations');
    assert.deepEqual(modele.comparaison.populations, {
      seulementA: [12],
      seulementB: [99],
    });
    assert.deepEqual(modele.phrases, [
      {
        code: 'populations',
        texte: t('qualite.comparaison.populations', { a: sujet(1), b: sujet(2) }),
        liste: null,
      },
      {
        code: 'populations',
        texte: t('qualite.comparaison.populationsSeulement', { nom: sujet(1) }),
        liste: [{ texte: nomDe(falsifiee, 12), nom: null }],
      },
      {
        code: 'populations',
        texte: t('qualite.comparaison.populationsSeulement', { nom: sujet(2) }),
        liste: [
          {
            texte: t('qualite.comparaison.personneInconnue', { id: 99 }),
            nom: null,
          },
        ],
      },
    ]);
    assert.deepEqual([modele.series, modele.escalier], [null, null]);
  });

  test('rouge : peu de valeurs, une phrase par valeur puis les trois effectifs ; ni tracé ni infobulle ; le jumeau reste', () => {
    const charge = quatre();
    const table = evaluer(charge);
    // Deux valeurs réunies, 3 et 0 : sous le seuil de trois.
    const forgee = avecManques(table, [1, [3, 3]], [2, [3]]);
    const modele = vueComparaison(charge, forgee, { source: source(1), comparee: 2 }, outils);
    assert.equal(modele.comparaison.trace, false);
    assert.equal(modele.cas, 'phrase');
    assert.deepEqual([modele.series, modele.infobulle, modele.borneHaute, modele.graphique], [null, null, null, null]);
    assert.notEqual(modele.escalier, null);
    assert.equal(modele.escalier.lignes.length, 4);
    // Les valeurs prises, de la plus grande à 0 : 3 et 0, pas 2 ni 1.
    assert.deepEqual(modele.phrases[0], {
      code: 'peuDeValeurs',
      texte: t('qualite.comparaison.peuDeValeurs.phrase'),
      liste: [
        {
          texte: t('qualite.comparaison.peuDeValeurs.valeur', {
            valeur: 3,
            a: sujet(1),
            effectifA: 2,
            b: sujet(2),
            effectifB: 1,
          }),
          nom: null,
        },
        {
          texte: t('qualite.comparaison.peuDeValeurs.valeur', {
            valeur: 0,
            a: sujet(1),
            effectifA: 10,
            b: sujet(2),
            effectifB: 11,
          }),
          nom: null,
        },
      ],
    });
    assert.deepEqual(codes(modele).slice(1, 2), ['effectifs']);
  });

  test('rouge : peu de valeurs et deux rangs 1 différents — les effectifs par valeur, les trois effectifs de rangs, puis le rang 1 (C20)', () => {
    const charge = quatre();
    const table = evaluer(charge);
    // Deux valeurs réunies, 1 et 0 : le manque de 1 tient à la première
    // personne d'un côté, à la deuxième de l'autre.
    const modele = vueComparaison(charge, avecManques(table, [1, [1, 0]], [2, [0, 1]]), { source: source(1), comparee: 2 }, outils);
    assert.equal(modele.cas, 'phrase');
    assert.notEqual(modele.comparaison.profils.a[0].id, modele.comparaison.profils.b[0].id);
    assert.deepEqual(codes(modele), ['peuDeValeurs', 'effectifs', 'rang1', 'indiscernables']);
  });

  test('rouge : le jumeau porte une ligne par entier, de la plus grande valeur à 0, présente ou non, effectif et cumulé par placement, en comptes', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const forgee = avecManques(table, [1, [4, 1]], [2, [1, 1]]);
    const modele = vueComparaison(charge, forgee, { source: source(1), comparee: 2 }, outils);
    assert.equal(modele.cas, 'trace');
    const { escalier } = modele;
    assert.equal(escalier.nom, t('qualite.comparaison.escalier.titre'));
    assert.deepEqual(escalier.colonnes, [
      {
        cle: 'valeur',
        libelle: t('qualite.comparaison.escalier.valeur'),
        genre: 'nombre',
      },
      {
        cle: 'effectifA',
        libelle: t('qualite.comparaison.escalier.effectif', { nom: nom(1) }),
        genre: 'nombre',
      },
      {
        cle: 'cumulA',
        libelle: t('qualite.comparaison.escalier.cumul', { nom: nom(1) }),
        genre: 'nombre',
      },
      {
        cle: 'effectifB',
        libelle: t('qualite.comparaison.escalier.effectif', { nom: nom(2) }),
        genre: 'nombre',
      },
      {
        cle: 'cumulB',
        libelle: t('qualite.comparaison.escalier.cumul', { nom: nom(2) }),
        genre: 'nombre',
      },
    ]);
    assert.deepEqual(
      escalier.lignes.map(({ valeur }) => valeur),
      [4, 3, 2, 1, 0],
    );
    assert.deepEqual(
      escalier.lignes,
      modele.comparaison.escalier.map(({ valeur, a, b }) => ({
        valeur,
        effectifA: a.effectif,
        cumulA: a.cumul,
        effectifB: b.effectif,
        cumulB: b.cumul,
      })),
    );
    assert.deepEqual(escalier.lignes[1], {
      valeur: 3,
      effectifA: 0,
      cumulA: 1,
      effectifB: 0,
      cumulB: 0,
    });
  });

  test('l’infobulle d’un rang : une ligne par placement, en comptes, chaque série sous le nom de sa courbe ; la synthèse et le zéro libellé', () => {
    const charge = quatre();
    const table = evaluer(charge);
    const forgee = avecManques(table, [1, [3, 2, 1]], [2, [2, 2, 2, 2]]);
    const modele = vueComparaison(charge, forgee, { source: source(1), comparee: 2 }, outils);
    const { infobulle, comparaison } = modele;
    assert.deepEqual(
      infobulle.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['nom', 'texte'],
        ['manque', 'nombre'],
        ['rencontres', 'nombre'],
        ['plafondRealise', 'nombre'],
        ['plafondAPriori', 'nombre'],
        ['total', 'nombre'],
      ],
    );
    for (const colonne of infobulle.colonnes) assert.equal(colonne.libelle, t(`qualite.comparaison.colonne.${colonne.cle}`));
    assert.deepEqual(
      infobulle.series.map(({ nom: nomSerie }) => nomSerie),
      modele.series.map(({ libelle }) => libelle),
    );
    for (const cote of ['a', 'b']) {
      const serie = infobulle.series[cote === 'a' ? 0 : 1];
      assert.deepEqual(
        serie.lignes,
        comparaison.profils[cote].map(({ id, manque, rencontres, plafondRealise, plafondAPriori }) => ({
          nom: nomDe(charge, id),
          manque,
          rencontres,
          plafondRealise,
          plafondAPriori,
          total: comparaison.total,
        })),
      );
    }
    // Le « N au total » du § 12.10.3 : les autres personnes de la
    // population, sur chaque ligne des deux séries.
    assert.equal(comparaison.total, table.population.length - 1);
    const { graduer, ...graphique } = modele.graphique;
    assert.deepEqual(graphique, {
      nom: t('qualite.comparaison.graphique'),
      titreX: t('qualite.comparaison.axe'),
      synthese: t('qualite.comparaison.synthese', {
        a: sujet(1),
        manqueA: 3,
        effectifA: 1,
        b: sujet(2),
        manqueB: 2,
        effectifB: 4,
      }),
    });
    // Le zéro porte son libellé ; toute autre graduation, son nombre.
    assert.equal(graduer(0), t('qualite.comparaison.zero'));
    assert.equal(graduer(2), format.nombre(2));
    assert.equal(graduer(1200), format.nombre(1200));
  });
});
