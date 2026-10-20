// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'en-tête chiffré et le profil trié de la page de qualité dans un vrai
// moteur de rendu (§ 12.2, § 12.3, B11, B12, B15, D29, D30, D34, D41, D48,
// D51) : chaque tuile qui a sa colonne écrit la cellule du tableau des
// propositions ; trois tuiles seulement portent un pourcentage, chacun
// suivi de son compte du pire ; les deux graphiques du profil, au même
// ordre de rangs, désignent le même rang pointé ; chaque trait a son motif
// — la borne de diversité en pointillés, le plafond et la règle à 100 % en
// trait mixte — ; le jumeau s'ouvre et se referme au clavier. Les vues se
// montent par mount sur le détail d'une génération, avec les contextes que
// pose App — 't' et 'format' — ; une épreuve monte App entier et lit les
// deux sections. Le texte attendu vient de la même traduction que celle de
// l'application ; les noms d'épreuve sont inventés.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import '../jetons.css';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite, evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { tableau, texteCellule } from '../propositions/modele.js';
import VueEntete from './VueEntete.svelte';
import VueProfil from './VueProfil.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const CONTEXTE = new Map([
  ['t', t],
  ['format', format],
]);
const V1 = VERSION.affichee;

// --- Les charges d'épreuve -------------------------------------------------------

// Six personnes inventées, deux tables de trois places, trois tours ;
// appartenances : deux (les quatre premières), ou aucune ; la première
// table attend « finance », que portent les trois premières, quand
// objectifs est vrai ; reservation ancre la première à la première table.
function chargeSix({ appartenances = true, objectifs = false, reservation = false, reglages = {} } = {}) {
  const charge = creerCharge({ id: 'evt-profil', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 3 });
  const noms = [
    ['Ombrelle', 'Iris', 'Coopérative Aubier'],
    ['Pervenche', 'Théo', 'Coopérative Aubier'],
    ['Lacasse', 'Ondine', 'Atelier Ressac'],
    ['Tourteau', 'Basile', 'Atelier Ressac'],
    ['Quenouille', 'Maëlle', null],
    ['Varech', 'Sidonie', null],
  ];
  charge.participants = noms.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: appartenances ? appartenance : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(objectifs && rang < 3 ? { etiquettes: ['finance'] } : {}),
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  if (objectifs) charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  if (reservation) charge.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  Object.assign(charge.reglages, reglages);
  return charge;
}

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 3, nombre: 2, arret: 200 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// Le contrat de propriétés des vues pour une proposition de la charge.
function vueDe(charge, id = charge.propositions[0].id) {
  const table = evaluer(charge);
  return { detail: detaillerQualite(charge, id), ligne: table.propositions.find((ligne) => ligne.id === id), table };
}

// --- Le montage --------------------------------------------------------------------

const montes = [];
const apps = [];

beforeAll(async () => {
  await fixerCadre(1366, 700);
});

afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
  const erreurs = apps.flatMap((m) => m.erreurs());
  for (const m of apps.splice(0).reverse()) m.demonter();
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// Monte une vue dans un conteneur neuf de 1 000 px, au début du corps, puis
// laisse ses graphiques mesurer leur largeur et leur texte.
async function monter(Vue, props, context = CONTEXTE) {
  const cible = document.createElement('div');
  cible.style.width = '1000px';
  document.body.prepend(cible);
  const composant = mount(Vue, { target: cible, props, context });
  montes.push({ composant, cible });
  for (let tour = 0; tour < 3; tour += 1) {
    flushSync();
    await tick();
  }
  flushSync();
  return cible;
}

// Attend que l'assertion passe, le rendu de Svelte à jour.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// --- Les lectures du rendu ---------------------------------------------------------

// Le texte d'un élément, ses blancs ordinaires réduits : l'espace fine
// insécable du pourcentage reste.
const texteDe = (element) => element.textContent.replace(/[\t\n\r ]+/g, ' ').trim();
const tuileDe = (racine, nom) => racine.querySelector(`[data-tuile="${nom}"]`);
const valeurDe = (tuile) => texteDe(tuile.querySelector('.valeur'));
const svgDe = (racine, nom) => racine.querySelector(`svg[data-graphique="${nom}"]`);
const surfaceDe = (svg) => svg.querySelector(':scope > rect[pointer-events="all"]');
const motif = (element) => getComputedStyle(element).strokeDasharray;

// Chaque [data-pourcentage] de la racine, suivi de son [data-compte-pire]
// non vide, son voisin immédiat.
function exigerComptes(racine) {
  const pourcentages = [...racine.querySelectorAll('[data-pourcentage]')];
  for (const valeur of pourcentages) {
    const compte = valeur.nextElementSibling;
    expect(compte?.hasAttribute('data-compte-pire'), texteDe(valeur)).toBe(true);
    expect(texteDe(compte)).not.toBe('');
  }
  return pourcentages;
}

// --- L'en-tête chiffré -------------------------------------------------------------

describe('l’en-tête chiffré (§ 12.2, B11, D48)', () => {
  test('chaque tuile qui a sa colonne écrit la cellule du tableau, sous les groupes du tableau ; la population et le certificat', async () => {
    const vue = vueDe(generee(chargeSix({ objectifs: true })));
    const cible = await monter(VueEntete, vue);
    const ligneDuTableau = tableau(vue.table).lignes.find(({ id }) => id === vue.ligne.id);
    let comparees = 0;
    for (const cellule of ligneDuTableau.cellules) {
      if (cellule.colonne === 'certificat') continue;
      const tuile = tuileDe(cible, cellule.colonne);
      expect(tuile, cellule.colonne).not.toBeNull();
      expect(valeurDe(tuile), cellule.colonne).toBe(texteCellule(cellule, { t, format }));
      expect(texteDe(tuile)).not.toContain(t('qualite.tuile.neClassePas'));
      comparees += 1;
    }
    expect(comparees).toBeGreaterThan(15);
    const vueQualite = cible.querySelector('[data-vue-qualite="entete"]');
    expect(texteDe(vueQualite)).toContain(t('qualite.tuile.population', { mesuree: 6, exclue: 0 }));
    expect([...vueQualite.querySelectorAll('h4')].map(texteDe)).toEqual(
      ['rencontres', 'collisions', 'repetitions', 'diversite', 'manque', 'objectifs'].map((nom) => t(`propositions.groupe.${nom}`)),
    );
  });

  test('un critère décoché : sa tuile lit la même mesure et dit « ne classe pas »', async () => {
    const vue = vueDe(generee(chargeSix({ objectifs: true, reglages: { respecterObjectifs: false } })));
    const cible = await monter(VueEntete, vue);
    const tuile = tuileDe(cible, 'toursHorsObjectif');
    expect(texteDe(tuile)).toContain(t('qualite.tuile.toursHorsObjectif'));
    expect(texteDe(tuile)).toContain(t('qualite.tuile.neClassePas'));
    expect(valeurDe(tuile)).toBe(format.nombre(vue.ligne.mesures.objectifs.horsObjectif));
  });

  test('le minimum brut nomme la personne au rang 1, son plafond réalisé, son plafond a priori et son pourcentage, le compte du pire dessous', async () => {
    const vue = vueDe(generee(chargeSix()));
    const cible = await monter(VueEntete, vue);
    const { rang1 } = vue.detail.bornes;
    const nom = vue.detail.personnes.find(({ id }) => id === rang1.id).nom;
    const tuile = tuileDe(cible, 'rencontresTous');
    expect(texteDe(tuile)).toContain(t('qualite.tuile.personne', { nom }));
    expect(texteDe(tuile)).toContain(t('qualite.tuile.plafondRealise', { plafond: rang1.plafondRealise }));
    expect(texteDe(tuile)).toContain(t('qualite.tuile.plafondAPriori', { plafond: rang1.plafondAPriori }));
    expect(texteDe(tuile.querySelector('[data-pourcentage]'))).toBe(t('qualite.pourcentage.valeur', { pourcent: rang1.pourcent }));
    expect(texteDe(tuile.querySelector('[data-compte-pire]'))).toBe(`minimum ${rang1.rencontres} sur ${rang1.plafondRealise}`);
  });

  test('trois pourcentages, chacun suivi de son compte du pire ; aucun signe du pourcentage ailleurs dans l’en-tête', async () => {
    const cible = await monter(VueEntete, vueDe(generee(chargeSix({ objectifs: true }))));
    const pourcentages = exigerComptes(cible);
    expect(pourcentages.map((valeur) => valeur.closest('[data-tuile]').dataset.tuile)).toEqual([
      'rencontresTous',
      'toursHorsObjectif',
      'toursSelonObjectif',
    ]);
    // Le texte de l'en-tête, les pourcentages retirés, ne porte aucun « % ».
    const copie = cible.cloneNode(true);
    for (const valeur of copie.querySelectorAll('[data-pourcentage]')) valeur.remove();
    expect(copie.textContent).not.toContain('%');
  });

  test('rouge : un plancher prouvé s’écrit dans le texte de sa tuile, sous son chiffre, rendu et lu par l’assistance', async () => {
    // Cinq de la Coopérative Aubier pour deux tables de trois : au moins
    // quatre collisions par tour, douze sur trois tours, que tout plan
    // atteint.
    const charge = chargeSix();
    for (const personne of charge.participants) personne.appartenance = personne.id <= 5 ? 'Coopérative Aubier' : null;
    const cible = await monter(VueEntete, vueDe(generee(charge)));
    const tuile = tuileDe(cible, 'collisionsCumulees');
    const ligne = t('qualite.tuile.plancherAtteint', { plancher: 12 });
    const porteuse = [...tuile.querySelectorAll('.borne')].find((element) => texteDe(element) === ligne);
    expect(porteuse, texteDe(tuile)).toBeDefined();
    expect(porteuse.compareDocumentPosition(tuile.querySelector('.valeur')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(porteuse.closest('[aria-hidden="true"], [hidden]')).toBeNull();
    expect(porteuse.checkVisibility({ visibilityProperty: true })).toBe(true);
  });

  test('le libellé d’une tuile s’explique au focus du clavier : l’infobulle porte l’explication de la colonne', async () => {
    const cible = await monter(VueEntete, vueDe(generee(chargeSix())));
    const terme = tuileDe(cible, 'manqueMax').querySelector('[data-terme]');
    terme.focus();
    flushSync();
    const bulle = cible.querySelector('[role="tooltip"]');
    await attendre(() => expect(bulle.hidden).toBe(false));
    expect(texteDe(bulle)).toBe(t('propositions.explication.manqueMax').replace(/\s+/g, ' ').trim());
    expect(terme.getAttribute('aria-describedby')).toBe(bulle.id);
  });
});

// --- La présence par tour ----------------------------------------------------------

// Les contextes que pose App, la séance comprise : un magasin dont l'état
// porte la charge.
const contexteDe = (charge) =>
  new Map([
    ...CONTEXTE,
    [
      'seance',
      {
        subscribe(lire) {
          lire({ charge });
          return () => {};
        },
      },
    ],
  ]);

// Cinq membres de la Coopérative Aubier pour deux tables de trois, et la
// présence de Sidonie Varech, sans appartenance.
function chargeAbsente(presence) {
  const charge = chargeSix();
  for (const personne of charge.participants) personne.appartenance = personne.id <= 5 ? 'Coopérative Aubier' : null;
  charge.participants[5].presence = presence;
  return charge;
}

describe('la présence par tour, dans l’en-tête et le profil (§ 12.2, § 12.3, § 12.6)', () => {
  test('une absence : la tuile de l’écart d’itinéraire écrit, sous son chiffre, que son plancher n’est pas prouvé ; les autres gardent le leur', async () => {
    const charge = generee(chargeAbsente([1, 2]));
    const cible = await monter(VueEntete, vueDe(charge), contexteDe(charge));
    const phrases = [...cible.querySelectorAll('[data-plancher-non-prouve]')];
    expect(phrases).toHaveLength(1);
    const [phrase] = phrases;
    const tuile = tuileDe(cible, 'ecartItineraireMax');
    expect(tuile.contains(phrase)).toBe(true);
    expect(texteDe(phrase)).toBe(t('qualite.entete.plancherNonProuve'));
    expect(phrase.compareDocumentPosition(tuile.querySelector('.valeur')) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    expect(phrase.checkVisibility({ visibilityProperty: true })).toBe(true);
    const collisions = tuileDe(cible, 'collisionsCumulees');
    expect(texteDe(collisions)).toContain(t('qualite.tuile.plancherAtteint', { plancher: 12 }));
  });

  test('sans absence, aucune tuile ne l’écrit', async () => {
    const charge = generee(chargeSix());
    const cible = await monter(VueEntete, vueDe(charge), contexteDe(charge));
    expect(cible.querySelector('[data-tuile]')).not.toBeNull();
    expect(cible.querySelector('[data-plancher-non-prouve]')).toBeNull();
  });

  test('la personne au rang 1 présente à un seul tour : l’infobulle de la tuile du minimum brut ajoute sa présence à l’explication', async () => {
    const charge = generee(chargeAbsente([2]));
    const vue = vueDe(charge);
    expect(vue.detail.bornes.rang1.id).toBe(6);
    const cible = await monter(VueEntete, vue, contexteDe(charge));
    const terme = tuileDe(cible, 'rencontresTous').querySelector('[data-terme]');
    terme.focus();
    flushSync();
    const bulle = cible.querySelector('[role="tooltip"]');
    await attendre(() => expect(bulle.hidden).toBe(false));
    const explication = t('propositions.explication.rencontresTous').replace(/\s+/g, ' ').trim();
    expect(texteDe(bulle)).toBe(`${explication} Sidonie Varech, au rang 1, est présente au tour 2.`);
    // Une autre tuile garde l'explication de sa colonne, seule.
    const autre = tuileDe(cible, 'manqueMax').querySelector('[data-terme]');
    autre.focus();
    flushSync();
    await attendre(() => expect(texteDe(bulle)).toBe(t('propositions.explication.manqueMax').replace(/\s+/g, ' ').trim()));
  });

  test('le profil : le rang d’une absente porte le losange dans les deux graphiques ; son infobulle dit « absente à n tours »', async () => {
    const charge = generee(chargeAbsente([2]));
    const vue = vueDe(charge);
    expect(vue.detail.profil[0]).toMatchObject({ id: 6, marque: 'absente', toursAbsents: 2 });
    const cible = await monter(VueProfil, vue, contexteDe(charge));
    const losange = /^M [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ L [\d.]+ [\d.]+ Z$/;
    for (const nom of ['profilComptes', 'profilPourcentages']) {
      const signes = [...svgDe(cible, nom).querySelectorAll('[data-marque="graphiqueMarque"]')];
      expect(signes.filter((signe) => losange.test(signe.getAttribute('d'))), nom).toHaveLength(1);
    }
    expect(texteDe(cible)).toContain(t('graphiques.signe.absente'));
    const comptes = svgDe(cible, 'profilComptes');
    const focalisable = document.createElement('button');
    cible.append(focalisable);
    focalisable.focus({ preventScroll: true });
    const boite = surfaceDe(comptes).getBoundingClientRect();
    await pointer('bouger', boite.left + 2, boite.top + boite.height / 2);
    flushSync();
    const bulles = [...cible.querySelectorAll('[role="tooltip"]')].filter((bulle) => !bulle.hidden);
    expect(bulles).toHaveLength(1);
    expect(texteDe(bulles[0])).toContain('Sidonie Varech');
    expect(texteDe(bulles[0])).toContain(t('qualite.profil.absences', { n: 2 }));
    expect(texteDe(bulles[0])).toContain(t('qualite.profil.marque.absente'));
  });
});

// --- Le profil trié -------------------------------------------------------------------

describe('le profil trié, deux graphiques au même ordre (§ 12.3, B12, D30, D41, D51)', () => {
  test('le premier : deux séries et deux repères, la borne de diversité en pointillés, distincte des tirets ; le plafond en trait mixte, distinct du plein', async () => {
    const cible = await monter(VueProfil, vueDe(generee(chargeSix({ reservation: true }))));
    const svg = svgDe(cible, 'profilComptes');
    const trace = (attribut, genre) => svg.querySelector(`path[${attribut}="${genre}"]`);
    const borne = trace('data-repere', 'borne');
    const plafond = trace('data-repere', 'plafond');
    const plein = trace('data-serie', 'serie1');
    const tirets = trace('data-serie', 'serie2');
    for (const element of [borne, plafond, plein, tirets]) expect(element).not.toBeNull();
    expect(motif(plein)).toBe('none');
    expect(motif(tirets)).not.toBe('none');
    expect(motif(borne)).not.toBe(motif(tirets));
    expect(motif(borne)).not.toBe(motif(plafond));
    expect(motif(plafond)).not.toBe(motif(plein));
    expect(motif(plafond)).not.toBe(motif(tirets));
    // Chaque repère est nommé sur le tracé, la borne jamais « plafond ».
    expect(texteDe(svg.querySelector('text[data-repere="borne"]'))).toBe('borne de diversité');
    expect(texteDe(svg.querySelector('text[data-repere="plafond"]'))).toBe(t('qualite.profil.repere.plafond'));
    // Le rang ancré porte son signe ; la phrase de synthèse, dessous.
    expect(svg.querySelectorAll('[data-marque="graphiqueMarque"]').length).toBeGreaterThan(0);
    const { detail } = vueDe(generee(chargeSix({ reservation: true })));
    expect(texteDe(cible)).toContain(t('qualite.profil.synthese', detail.synthese));
  });

  test('le second : une série en pourcentages, la règle à 100 % du motif du plafond, libellée « 100 % », l’axe de 0 à 100 %', async () => {
    const vue = vueDe(generee(chargeSix()));
    const cible = await monter(VueProfil, vue);
    const svg = svgDe(cible, 'profilPourcentages');
    expect(svg.querySelectorAll('path[data-serie]')).toHaveLength(1);
    const cent = svg.querySelector('path[data-repere="cent"]');
    expect(motif(cent)).toBe(motif(svgDe(cible, 'profilComptes').querySelector('path[data-repere="plafond"]')));
    expect(texteDe(svg.querySelector('text[data-repere="cent"]'))).toBe(t('qualite.pourcentage.cent'));
    const graduations = [...svg.querySelectorAll('text')].map(texteDe);
    expect(graduations).toContain(t('qualite.pourcentage.axe', { valeur: '0' }));
    expect(graduations).toContain(t('qualite.pourcentage.axe', { valeur: '100' }));
    // Deux noms distincts, une phrase de synthèse qui porte le pire en compte.
    expect(svg.getAttribute('aria-labelledby')).not.toBe(svgDe(cible, 'profilComptes').getAttribute('aria-labelledby'));
    const nomDe = (graphique) => texteDe(document.getElementById(graphique.getAttribute('aria-labelledby')));
    expect(nomDe(svg)).toBe(t('qualite.profil.graphique.pourcentages'));
    expect(nomDe(svgDe(cible, 'profilComptes'))).toBe(t('qualite.profil.graphique.comptes'));
    const synthese = document.getElementById(svg.getAttribute('aria-describedby'));
    const { rang1 } = vue.detail.bornes;
    expect(texteDe(synthese.querySelector('[data-compte-pire]'))).toBe(`minimum ${rang1.rencontres} sur ${rang1.plafondRealise}`);
    exigerComptes(cible);
  });

  test('le rang pointé est le même dans les deux graphiques : le rang 1, la personne au minimum ; l’infobulle porte sa ligne, le pourcentage suivi de « r sur p »', async () => {
    const vue = vueDe(generee(chargeSix()));
    const cible = await monter(VueProfil, vue);
    const comptes = svgDe(cible, 'profilComptes');
    // Le document a le focus, comme quand l'opérateur survole puis tape :
    // une touche n'atteint que le document focalisé. Le focus fait défiler
    // la page : la surface se mesure après lui.
    const focalisable = document.createElement('button');
    cible.append(focalisable);
    focalisable.focus({ preventScroll: true });
    const boite = surfaceDe(comptes).getBoundingClientRect();
    await pointer('bouger', boite.left + 2, boite.top + boite.height / 2);
    flushSync();
    expect(comptes.querySelector('[data-rang]')?.getAttribute('data-rang')).toBe('1');
    expect(svgDe(cible, 'profilPourcentages').querySelector('[data-rang]')?.getAttribute('data-rang')).toBe('1');
    // Les abscisses s'alignent rang contre rang : la même zone de tracé.
    const zones = ['profilComptes', 'profilPourcentages'].map((nom) => ['x', 'width'].map((a) => surfaceDe(svgDe(cible, nom)).getAttribute(a)));
    expect(zones[1]).toEqual(zones[0]);
    const [premier] = vue.detail.profil;
    expect(premier.rencontres).toBe(vue.ligne.mesures.aggRencontres.tous.min);
    const nom = vue.detail.personnes.find(({ id }) => id === premier.id).nom;
    const bulles = [...cible.querySelectorAll('[role="tooltip"]')].filter((bulle) => !bulle.hidden);
    expect(bulles).toHaveLength(1);
    expect(texteDe(bulles[0])).toContain(nom);
    expect(texteDe(bulles[0].querySelector('[data-compte-pire]'))).toBe(`${premier.rencontres} sur ${premier.plafondRealise}`);
    await touche('Escape');
    flushSync();
    expect([...cible.querySelectorAll('[role="tooltip"]')].every((bulle) => bulle.hidden)).toBe(true);
  });

  test('le jumeau s’ouvre au clavier : une ligne par personne, puis la répartition ; refermé, le focus reste sur sa commande', async () => {
    const vue = vueDe(generee(chargeSix()));
    const cible = await monter(VueProfil, vue);
    const commande = cible.querySelector('[data-commande="ouvrirJumeau"]');
    commande.focus();
    await touche('Enter');
    await attendre(() => expect(cible.querySelector('[data-jumeau="0"]')).not.toBeNull());
    const lignes = cible.querySelectorAll('[data-jumeau="0"] tbody tr');
    expect(lignes).toHaveLength(6);
    expect(cible.querySelectorAll('[data-jumeau="1"] tbody tr')).toHaveLength(vue.detail.repartitionRencontres.length);
    const nomDuPremier = vue.detail.personnes.find(({ id }) => id === vue.detail.profil[0].id).nom;
    expect(texteDe(lignes[0].querySelector('[data-colonne="nom"]'))).toBe(nomDuPremier);
    expect(lignes[0].querySelector('[data-colonne="pourcent"] [data-pourcentage] + [data-compte-pire]')).not.toBeNull();
    exigerComptes(cible);
    const fermer = cible.querySelector('[data-commande="fermerJumeau"]');
    fermer.focus();
    await touche('Enter');
    await attendre(() => expect(cible.querySelector('[data-jumeau]')).toBeNull());
    expect(document.activeElement?.dataset.commande).toBe('ouvrirJumeau');
  });

  test('un rang au plafond réalisé nul : son signe dans les deux graphiques, au même rang ; aucun point au second, où le tracé s’interrompt', async () => {
    const vue = vueDe(generee(chargeSix()));
    const detail = structuredClone(vue.detail);
    Object.assign(detail.profil[3], { rencontres: 0, plafondRealise: 0, pourcent: null, marque: 'plafondNul' });
    const cible = await monter(VueProfil, { ...vue, detail });
    const marques = detail.profil.filter(({ marque }) => marque !== null).length;
    // L'abscisse du centre de chaque signe, au pixel : les deux graphiques
    // alignent leurs rangs, un même rang y a la même abscisse.
    const abscisses = (svg) =>
      [...svg.querySelectorAll('[data-marque="graphiqueMarque"]')].map((signe) => {
        const boite = signe.getBoundingClientRect();
        return Math.round(boite.left + boite.width / 2);
      });
    const comptes = svgDe(cible, 'profilComptes');
    const pourcentages = svgDe(cible, 'profilPourcentages');
    expect(abscisses(comptes)).toHaveLength(marques);
    expect(abscisses(pourcentages)).toEqual(abscisses(comptes));
    const serie = pourcentages.querySelector('path[data-serie="serie1"]');
    // Deux morceaux : le tracé s'interrompt au rang sans valeur.
    expect(serie.getAttribute('d').match(/M/g)).toHaveLength(2);
  });

  test('la personne au rang 1 au plafond réalisé nul : la synthèse du second graphique, une phrase entière, sans pourcentage ni compte', async () => {
    const vue = vueDe(generee(chargeSix()));
    const detail = structuredClone(vue.detail);
    Object.assign(detail.profil[0], { rencontres: 0, plafondRealise: 0, pourcent: null, marque: 'plafondNul' });
    Object.assign(detail.bornes.rang1, { id: detail.profil[0].id, rencontres: 0, plafondRealise: 0, pourcent: null });
    const cible = await monter(VueProfil, { ...vue, detail });
    const svg = svgDe(cible, 'profilPourcentages');
    const synthese = document.getElementById(svg.getAttribute('aria-describedby'));
    const nom = detail.personnes.find(({ id }) => id === detail.profil[0].id).nom;
    expect(texteDe(synthese)).toBe(t('qualite.profil.plafondNul', { nom }));
    expect(synthese.querySelector('[data-pourcentage]')).toBeNull();
    expect(synthese.querySelector('[data-compte-pire]')).toBeNull();
  });

  test('aucune appartenance : une seule série, ni borne de diversité, et la phrase ; une seule table : la phrase seule', async () => {
    const cible = await monter(VueProfil, vueDe(generee(chargeSix({ appartenances: false }))));
    const svg = svgDe(cible, 'profilComptes');
    expect(svg.querySelectorAll('path[data-serie]')).toHaveLength(1);
    expect(svg.querySelector('[data-repere="borne"]')).toBeNull();
    expect(texteDe(cible.querySelector('[data-phrase-qualite="aucuneAppartenance"]'))).toBe(t('qualite.profil.aucuneAppartenance'));

    const seule = chargeSix();
    seule.tables = [{ id: 1, numero: 1, sieges: 6, forme: 'ronde', position: { x: 300, y: 0 } }];
    const uneTable = await monter(VueProfil, vueDe(generee(seule)));
    expect(uneTable.querySelector('[data-phrase-qualite="uneTable"]')).not.toBeNull();
    expect(uneTable.querySelector('svg[data-graphique]')).toBeNull();
  });
});

// --- La grande démonstration, et l'application entière ------------------------------

describe('l’en-tête et le profil dans la page (§ 12, § 19.4)', () => {
  test('sur la grande : le nombre de nœuds des deux vues, jumeau fermé, sous le budget de la page', async () => {
    const charge = generee(analyser(texteLivre('grande')).charge, { graine: 1, nombre: 1, arret: 300 });
    const vue = vueDe(charge);
    const entete = await monter(VueEntete, vue);
    const profil = await monter(VueProfil, vue);
    const noeuds = entete.querySelectorAll('*').length + profil.querySelectorAll('*').length;
    // Le relevé que le rapport de la tâche cite.
    console.info(`noeuds en-tête et profil, grande : ${entete.querySelectorAll('*').length} + ${profil.querySelectorAll('*').length} = ${noeuds}`);
    expect(noeuds).toBeLessThan(1500);
    expect(svgDe(profil, 'profilComptes').querySelector('path[data-serie="serie1"]')).not.toBeNull();
  });

  test('dans l’application : la page de qualité de la proposition demandée écrit, en tuiles, les cellules de sa ligne au tableau des propositions', async () => {
    const charge = generee(chargeSix({ objectifs: true }));
    const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
    const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `soiree${SUFFIXES.etat}`, texte }] });
    apps.push(m);
    await m.seance.ouvrir('soiree');
    const id = charge.propositions[1].id;
    m.ui.allerA('propositions');
    const cellules = await attendre(() => {
      const ligne = m.racine.querySelector(`[data-proposition="${id}"]`);
      expect(ligne).not.toBeNull();
      return new Map([...ligne.querySelectorAll('td[data-colonne]')].map((td) => [td.dataset.colonne, texteDe(td)]));
    });
    m.ui.montrerProposition(id);
    m.ui.allerA('qualite');
    const page = await attendre(() => {
      const section = m.racine.querySelector('[data-section="qualite"]');
      expect(section.querySelector('[data-tuile]')).not.toBeNull();
      expect(svgDe(section, 'profilComptes')).not.toBeNull();
      return section;
    });
    let lues = 0;
    for (const tuile of page.querySelectorAll('[data-tuile]')) {
      if (!cellules.has(tuile.dataset.tuile)) continue;
      expect(valeurDe(tuile), tuile.dataset.tuile).toBe(cellules.get(tuile.dataset.tuile));
      lues += 1;
    }
    expect(lues).toBeGreaterThan(15);
  });
});
