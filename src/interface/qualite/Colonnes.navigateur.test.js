// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les colonnes côte à côte de la vue de comparaison dans un vrai moteur de
// rendu (§ 12.10.6, § 12.8, D67, D84, C20, C29) : une colonne par
// placement, chaque cellule la tuile de l'en-tête chiffré du même
// placement ; un pourcentage n'est rendu que dans une colonne, suivi de son
// compte du pire — un seul par colonne repli fermé, trois ouvert quand les
// objectifs ont des concernés — ; le signe « % » ne s'écrit nulle part
// ailleurs ; « Tous les indicateurs » est fermé à l'ouverture, s'ouvre et
// se referme au clavier, le focus rendu à sa commande. Les colonnes se
// montent par mount, avec les contextes que pose App — 't', 'format' et la
// séance, dont seule la charge est lue. Les noms d'épreuve sont inventés.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import '../jetons.css';
import { appliquerCommande } from '../../application/commandes.js';
import { comparerPlacements, detaillerQualite, evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, touche } from '../../../test/navigateur/entrees.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { texteFiliation } from '../propositions/filiation.js';
import ColonnesComparaison from './ColonnesComparaison.svelte';
import VueEntete from './VueEntete.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;

// --- Les charges d'épreuve -------------------------------------------------------

// Dix personnes inventées, deux appartenances, trois tables de quatre
// places, trois tours ; avec objectifs, les trois premières portent
// « finance », que la première table attend pour la soirée ; reglages
// s'ajoutent à ceux de la charge.
function chargeDix({ objectifs = false, reglages = {} } = {}) {
  const charge = creerCharge({ id: 'evt-colonnes', nom: 'Atelier Ressac', siegesParDefaut: 4, tours: 3 });
  const noms = [
    ['Ombrelle', 'Iris', 'Coopérative Aubier'],
    ['Pervenche', 'Théo', 'Coopérative Aubier'],
    ['Lacasse', 'Ondine', 'Coopérative Aubier'],
    ['Tourteau', 'Basile', 'Atelier Ressac'],
    ['Quenouille', 'Maëlle', 'Atelier Ressac'],
    ['Varech', 'Sidonie', 'Atelier Ressac'],
    ['Brisant', 'Anatole', null],
    ['Ajonc', 'Clémence', null],
    ['Embrun', 'Gaspard', null],
    ['Saulaie', 'Romane', null],
  ];
  charge.participants = noms.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(objectifs && rang < 3 ? { etiquettes: ['finance'] } : {}),
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  if (objectifs) charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  charge.prochainsIds = { participant: 11, table: 4, proposition: 1 };
  Object.assign(charge.reglages, reglages);
  return charge;
}

// La charge, une génération courte de plus, enregistrée par la commande.
function generee(charge) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 3, nombre: 4, arret: 30 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// La charge, sa table et la comparaison des deux premières du classement.
function comparees(charge) {
  const table = evaluer(charge);
  const [a, b] = table.classement.ordre;
  return { charge, table, a, b, comparaison: comparerPlacements(charge, table, a, b) };
}

// La charge, son retenu tiré de la proposition id, tel quel.
function avecRetenu(charge, id) {
  const copie = structuredClone(charge);
  const { siegesAttribues, tables, capacites, tours, participants, placement } = structuredClone(
    copie.propositions.find((proposition) => proposition.id === id),
  );
  copie.retenu = { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
  copie.evenement.etat = 'retenu';
  return copie;
}

// La séance d'épreuve : un magasin dont seule la charge est lue.
const seanceDe = (charge) => ({
  subscribe(lire) {
    lire({ charge });
    return () => {};
  },
});

// --- Le montage --------------------------------------------------------------------

const montes = [];

beforeAll(async () => {
  await fixerCadre(1366, 700);
});

afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
});

// Monte un composant dans un conteneur neuf de 1 000 px, au début du corps.
async function monter(Composant, props, charge) {
  const cible = document.createElement('div');
  cible.style.width = '1000px';
  document.body.prepend(cible);
  const context = new Map([
    ['t', t],
    ['format', format],
    ['seance', seanceDe(charge)],
  ]);
  const composant = mount(Composant, { target: cible, props, context });
  montes.push({ composant, cible });
  flushSync();
  await tick();
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
const celluleDe = (racine, nom, cote) => racine.querySelector(`tr[data-colonne="${nom}"] td[data-colonne-comparaison="${cote}"]`);
const pourcentagesDe = (racine, cote) => racine.querySelectorAll(`[data-colonne-comparaison="${cote}"] [data-pourcentage]`);
const commandeDe = (racine) => racine.querySelector('[data-tous-les-indicateurs]');
const lignesDe = (element, classe) => [...element.querySelectorAll(`:scope > .${classe}`)].map(texteDe);

// Les tuiles dont la borne nomme une personne que la comparaison ne porte
// pas : la cellule n'en rend que le plancher, et la phrase de la diversité
// sans appartenance présente.
const SANS_BORNE_DE_PERSONNE = ['appartenancesVues', 'animateursRencontres'];
const lignesSansPersonne = (lignes) => lignes.filter((ligne) => ligne.startsWith('plancher') || ligne === t('qualite.tuile.sansAppartenance'));
const signes = (texte) => [...texte].filter((caractere) => caractere === '%').length;

async function ouvrir(cible) {
  commandeDe(cible).focus();
  await touche('Enter');
  await attendre(() => expect(commandeDe(cible).getAttribute('aria-expanded')).toBe('true'));
}

describe('les colonnes côte à côte (§ 12.10.6, D67, D84, C20, C29)', () => {
  test('rouge : « Tous les indicateurs » est fermé au montage — un pourcentage par colonne, le minimum brut, suivi de son compte du pire', async () => {
    const { charge, table, comparaison } = comparees(generee(chargeDix({ objectifs: true })));
    const cible = await monter(ColonnesComparaison, { comparaison, table }, charge);
    const commande = commandeDe(cible);
    expect(commande.getAttribute('aria-expanded')).toBe('false');
    expect(commande.hasAttribute('aria-controls')).toBe(false);
    expect(texteDe(commande)).toBe(t('qualite.colonnes.tousLesIndicateurs'));
    expect(cible.querySelectorAll('table')).toHaveLength(1);
    for (const cote of ['a', 'b']) {
      const rendus = pourcentagesDe(cible, cote);
      expect(rendus).toHaveLength(1);
      expect(rendus[0].closest('tr').dataset.colonne).toBe('rencontresTous');
      expect(rendus[0].nextElementSibling.matches('[data-compte-pire]')).toBe(true);
      const { rencontres, plafondRealise } = comparaison[cote].bornes.rang1;
      expect(texteDe(rendus[0].nextElementSibling)).toBe(t('qualite.tuile.pireRencontres', { rencontres, plafond: plafondRealise }));
    }
  });

  test('ouvert au clavier : trois pourcentages par colonne quand les objectifs ont des concernés, un seul sinon ; refermé, le tableau quitte le DOM et le focus reste sur la commande', async () => {
    for (const [objectifs, attendu] of [
      [true, 3],
      [false, 1],
    ]) {
      const { charge, table, comparaison } = comparees(generee(chargeDix({ objectifs })));
      const cible = await monter(ColonnesComparaison, { comparaison, table }, charge);
      await ouvrir(cible);
      const controle = commandeDe(cible).getAttribute('aria-controls');
      expect(document.getElementById(controle)).not.toBeNull();
      expect(cible.querySelectorAll('table')).toHaveLength(2);
      for (const cote of ['a', 'b']) {
        expect(pourcentagesDe(cible, cote), `${objectifs} ${cote}`).toHaveLength(attendu);
        for (const rendu of pourcentagesDe(cible, cote)) expect(rendu.nextElementSibling.matches('[data-compte-pire]')).toBe(true);
      }
      await touche('Enter');
      await attendre(() => expect(cible.querySelectorAll('table')).toHaveLength(1));
      expect(commandeDe(cible).getAttribute('aria-expanded')).toBe('false');
      expect(document.activeElement).toBe(commandeDe(cible));
    }
  });

  test('chaque cellule rend la tuile du même placement : sa valeur, son pourcentage et son compte, ses bornes', async () => {
    const { charge, table, a, b, comparaison } = comparees(generee(chargeDix({ objectifs: true })));
    const cible = await monter(ColonnesComparaison, { comparaison, table }, charge);
    await ouvrir(cible);
    let comptees = 0;
    for (const [cote, cle] of [
      ['a', a],
      ['b', b],
    ]) {
      const ligne = table.propositions.find(({ id }) => id === cle);
      const entete = await monter(VueEntete, { detail: detaillerQualite(charge, cle), ligne, table }, charge);
      for (const tuile of entete.querySelectorAll('[data-tuile]')) {
        const nom = tuile.dataset.tuile;
        const cellule = celluleDe(cible, nom, cote);
        expect(cellule, nom).not.toBeNull();
        expect(texteDe(cellule.querySelector('.valeur')), `${cote} ${nom}`).toBe(texteDe(tuile.querySelector('.valeur')));
        const pourcentage = tuile.querySelector('[data-pourcentage]');
        if (pourcentage === null) expect(cellule.querySelector('[data-pourcentage]'), `${cote} ${nom}`).toBeNull();
        else {
          expect(texteDe(cellule.querySelector('[data-pourcentage]'))).toBe(texteDe(pourcentage));
          expect(texteDe(cellule.querySelector('[data-compte-pire]'))).toBe(texteDe(tuile.querySelector('[data-compte-pire]')));
        }
        const bornes = lignesDe(tuile, 'borne');
        expect(lignesDe(cellule, 'secondaire'), `${cote} ${nom}`).toEqual(SANS_BORNE_DE_PERSONNE.includes(nom) ? lignesSansPersonne(bornes) : bornes);
        comptees += 1;
      }
    }
    expect(comptees).toBe(2 * 20);
    // Une cellule au moins rend plusieurs lignes : leur ordre s'observe.
    const rendues = [...cible.querySelectorAll('td[data-colonne-comparaison]')].map((cellule) => lignesDe(cellule, 'secondaire'));
    expect(rendues.some((lignes) => lignes.length >= 2)).toBe(true);
  });

  test('critère des objectifs décoché, avec des concernés : les tours hors objectif et le minimum de s(p) rendent « ne classe pas » à côté de leur libellé, et leur pourcentage', async () => {
    const reglages = { respecterObjectifs: false, modeObjectifs: 'chacun' };
    const { charge, table, comparaison } = comparees(generee(chargeDix({ objectifs: true, reglages })));
    const cible = await monter(ColonnesComparaison, { comparaison, table }, charge);
    await ouvrir(cible);
    for (const nom of ['toursHorsObjectif', 'toursSelonObjectif']) {
      const entete = cible.querySelector(`tr[data-colonne="${nom}"] th`);
      expect(entete, nom).not.toBeNull();
      expect(texteDe(entete), nom).toBe(`${t(`qualite.tuile.${nom}`)} ${t('qualite.tuile.neClassePas')}`);
      for (const cote of ['a', 'b']) expect(celluleDe(cible, nom, cote).querySelector('[data-pourcentage]'), `${nom} ${cote}`).not.toBeNull();
    }
    // Une ligne que le tableau porte ne le dit pas.
    expect(cible.querySelector('tr[data-colonne="rencontresTous"] th .ne-classe-pas')).toBeNull();
  });

  test('le retenu : son nom, puis la proposition d’où il vient, dans l’en-tête de sa colonne', async () => {
    const base = generee(chargeDix());
    const [premiere, seconde] = evaluer(base).classement.ordre;
    const charge = avecRetenu(base, premiere);
    const table = evaluer(charge);
    const comparaison = comparerPlacements(charge, table, 'retenu', seconde);
    const cible = await monter(ColonnesComparaison, { comparaison, table }, charge);
    const [enteteA, enteteB] = ['a', 'b'].map((cote) => cible.querySelector(`th[data-colonne-comparaison="${cote}"]`));
    expect(lignesDe(enteteA, 'nom')).toEqual([t('qualite.comparaison.nom.retenu')]);
    expect(lignesDe(enteteA, 'secondaire')).toEqual([t('propositions.retenu.origine', { proposition: premiere })]);
    expect(texteDe(enteteB)).toBe(t('qualite.comparaison.nom.proposition', { proposition: seconde }));
  });

  test('le signe « % » ne s’écrit que dans un pourcentage, et chaque pourcentage dans une colonne ; aucune cellule n’est mise en avant', async () => {
    const { charge, table, comparaison } = comparees(generee(chargeDix({ objectifs: true })));
    const cible = await monter(ColonnesComparaison, { comparaison, table }, charge);
    await ouvrir(cible);
    const rendus = [...cible.querySelectorAll('[data-pourcentage]')];
    expect(rendus).toHaveLength(6);
    expect(rendus.every((rendu) => rendu.closest('[data-colonne-comparaison]') !== null)).toBe(true);
    expect(signes(cible.textContent)).toBe(rendus.reduce((somme, rendu) => somme + signes(rendu.textContent), 0));
    expect(signes(cible.textContent)).toBe(6);
    // Les deux cellules d'une ligne se rendent du même poids et de la même
    // couleur : aucune n'est marquée comme la plus haute.
    for (const ligne of cible.querySelectorAll('tr[data-colonne]')) {
      const [gauche, droite] = ['a', 'b'].map((cote) => getComputedStyle(ligne.querySelector(`td[data-colonne-comparaison="${cote}"] .valeur`)));
      expect([droite.fontWeight, droite.color, droite.backgroundColor]).toEqual([gauche.fontWeight, gauche.color, gauche.backgroundColor]);
    }
  });

  test('un plafond réalisé nul au rang 1 : « — » à la place du pourcentage, le compte écrit dessous', async () => {
    const { charge, table, comparaison } = comparees(generee(chargeDix()));
    const forgee = structuredClone(comparaison);
    forgee.b.bornes.rang1 = { id: 5, rencontres: 0, plafondRealise: 0, plafondAPriori: 0, pourcent: null };
    const cible = await monter(ColonnesComparaison, { comparaison: forgee, table }, charge);
    const cellule = celluleDe(cible, 'rencontresTous', 'b');
    expect(texteDe(cellule.querySelector('[data-pourcentage]'))).toBe(t('format.vide'));
    expect(texteDe(cellule.querySelector('[data-compte-pire]'))).toBe('minimum 0 sur 0');
    expect(texteDe(cellule)).toContain(t('qualite.tuile.personne', { nom: 'Maëlle Quenouille' }));
  });

  test('les en-têtes : le numéro de chaque proposition, la filiation d’une dérivée ; la place au classement en tête', async () => {
    const { charge, table, a, b, comparaison } = comparees(generee(chargeDix()));
    const forgee = structuredClone(comparaison);
    forgee.a.derivation = { depart: b, toursFiges: [2], departPresent: true };
    const cible = await monter(ColonnesComparaison, { comparaison: forgee, table }, charge);
    const [enteteA, enteteB] = ['a', 'b'].map((cote) => cible.querySelector(`th[data-colonne-comparaison="${cote}"]`));
    expect(texteDe(enteteA)).toContain(t('qualite.comparaison.nom.proposition', { proposition: a }));
    expect(texteDe(enteteA)).toContain(texteFiliation(forgee.a.derivation, { t, format }));
    expect(texteDe(enteteB)).toBe(t('qualite.comparaison.nom.proposition', { proposition: b }));
    expect(texteDe(celluleDe(cible, 'rang', 'a'))).toBe(format.nombre(1));
    expect(texteDe(celluleDe(cible, 'rang', 'b'))).toBe(format.nombre(2));
    expect([...cible.querySelectorAll('tbody tr[data-colonne]')].map((ligne) => ligne.dataset.colonne)).toEqual([
      'rang',
      'rencontresTous',
      'manqueMax',
      'effectifManque',
      'ecartItineraireMax',
    ]);
  });

  test('sans comparaison ou sans table, rien ne se rend', async () => {
    const { charge, table, comparaison } = comparees(generee(chargeDix()));
    expect((await monter(ColonnesComparaison, { comparaison: null, table }, charge)).children).toHaveLength(0);
    expect((await monter(ColonnesComparaison, { comparaison, table: null }, charge)).children).toHaveLength(0);
  });
});
