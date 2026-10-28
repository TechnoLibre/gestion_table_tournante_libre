// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La liste d'accueil et la feuille par table imprimées, dans un vrai moteur
// de rendu (§ 11.7, § 7.4, § 11.4, Q6 c) : un nom de deux cents caractères
// paraît entier et sa ligne replie, aucune marque d'abréviation ; les
// feuilles sont les pages de paginer sur les hauteurs rendues, chacune sous
// son en-tête et son pied, aucune ligne hors de sa zone de contenu ; les
// colonnes de tour de la liste d'accueil à la largeur de leur texte, chaque
// place sur une ligne, des tours trop nombreux pour tenir côte à côte au
// plancher des noms répartis en blocs de tours consécutifs, chacun sous
// l'en-tête qui nomme ses tours, les noms répétés ; un tour d'absence s'y dit
// « absente » ; « Trier par » la range par organisation — par défaut —, par
// nom ou par prénom, sans rien écrire ni changer la hauteur d'une ligne, et
// la dernière ligne de chaque organisation y porte un filet à l'encre du
// texte ; chaque place d'une table listée, une place vide écrite comme telle,
// les titres nommés, « non pourvu » quand rien ne les pourvoit ; « Une
// feuille par tour » donne une feuille par table et par tour, chacune au pied
// et au filigrane de son tour, sans rien écrire, en lecture comme sur un plan
// bloqué (§ 8.4). Sur la feuille par table, une colonne de tour garde la
// largeur de son plus long mot ; une soirée dont les tours n'y tiennent pas,
// ou dont une ligne passerait la hauteur d'une page, se scinde en groupes de
// tours, chaque groupe sous ses têtes de tour, chaque tour une fois par
// table, et aucune ligne ne déborde de sa page. Une ligne plus haute qu'une
// page, sur la feuille par table comme sur la liste d'accueil, se continue
// sur les feuilles suivantes : rien d'elle hors des zones de contenu, ses
// parts mises bout à bout redonnent la ligne entière, chaque texte une fois,
// et sur la liste d'accueil seule sa dernière part porte le filet de fin
// d'organisation.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé, au cadre de 1 366 × 700 ; le texte attendu vient de la même
// traduction que celle de l'application. Les noms d'épreuve sont inventés,
// hors du réservoir des démonstrations.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { appliquerCommande } from '../../application/commandes.js';
import { cleNormalisee } from '../../application/csv.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { nomAffiche } from '../../application/personnes.js';
import { estBrouillon } from '../../application/sorties.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { analyser } from '../../stockage/document.js';
import { couleurDeJeton } from '../../../test/navigateur/captures.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { composantes } from '../../../test/navigateur/rendu.js';
import { attendre, chargeBloquee, chargePrincipale, cliquer, creerContexte, ouvrirApercu } from '../../../test/navigateur/ecrans.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { ECHELLE_TEXTE_MAX, etatsDesTours, feuillesTables, finsOrganisation, lignesAccueil, textesCellule, textesLigneAccueil } from './listes.js';
import { paginer } from './pagination.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Images attendues au plus par étape : bien au-delà d'un rendu, sous le
// délai d'une épreuve.
const IMAGES = 300;

// Un nom de deux cents caractères sans espace : rien ne le coupe qu'un
// repli au caractère.
const NOM_LONG = 'Ombrelle'.repeat(25);

// Un nom long fait de mots courts : le repli entre les mots suffit à la
// largeur, et la hauteur de la ligne croît avec le nombre de mots.
const NOM_LONG_DE_MOTS = 'Ombrelle Pervenche '.repeat(40).trim();

// La marque d'abréviation du plan (§ 7.4), qu'aucune de ces vues ne pose.
const ABREVIATION = '\u{2026}';

// Une ligne rendue dépasse d'au plus ce jeu, en px, le bas de sa zone de
// contenu : l'arrondi des boîtes au pixel.
const JEU_PX = 0.5;

let contexte = null;
beforeEach(async () => {
  await fixerCadre(1366, 700);
  contexte = creerContexte();
});
afterEach(async () => {
  const erreurs = contexte.erreurs();
  await contexte.defaire();
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (racine, selecteur) => [...racine.querySelectorAll(selecteur)];
const feuilles = (m) => tous(m.racine, '[data-impression] [data-feuille]');
const plat = (chaine) => chaine.replace(/\s+/g, ' ').trim();
const texte = (element) => plat(element.textContent);
const boite = (element) => element.getBoundingClientRect();

// Choisit une vue de l'aperçu par sa commande, et attend son document.
async function choisirVue(m, vue) {
  await cliquer(m, `[data-apercu-impression] [data-commande="vue"][data-cible="${vue}"]`);
  await attendre(`la vue ${vue}`, () => dans(m, `[data-impression][data-vue-impression="${vue}"] [data-feuille]`), IMAGES);
}

// Bascule « Une feuille par tour » et attend le document qui en suit.
async function basculerParTour(m, voulu) {
  await cliquer(m, '[data-apercu-impression] [data-commande="parTour"]');
  await attendre(`parTour ${voulu}`, () => m.ui.etat().apercu.parTour === voulu, IMAGES);
  await attendre('le document', () => feuilles(m).length > 0, IMAGES);
}

// La principale, la personne 1 renommée d'un nom de deux cents caractères.
function chargeNomLong() {
  return appliquerCommande('modifierParticipant', chargePrincipale(), { id: 1, champs: { nom: NOM_LONG } }).charge;
}

// La principale retenue, puis un tour de plus à la soirée : le retenu porte
// les tours de 1 à R − 1, pas le dernier.
function chargeRetenuCourt() {
  const principale = chargePrincipale();
  const retenue = appliquerCommande('retenirProposition', principale, { id: principale.propositions[0].id }).charge;
  return appliquerCommande('changerTours', retenue, { tours: retenue.evenement.tours + 1 }).charge;
}

// La principale, sa proposition marquée « sièges attribués » : la liste
// d'accueil écrit la table et le siège à chaque tour.
function chargeSiegesAttribues() {
  const charge = structuredClone(chargePrincipale());
  for (const proposition of charge.propositions) proposition.siegesAttribues = true;
  return charge;
}

// Les lignes qu'occupe le texte d'un élément : les hauts distincts des
// boîtes de ses fragments, un par ligne.
function lignesDeTexte(element) {
  const plage = document.createRange();
  plage.selectNodeContents(element);
  return new Set([...plage.getClientRects()].map(({ top }) => Math.round(top))).size;
}

// Les mots du texte d'un élément que le repli coupe sur deux lignes.
function motsCoupes(element) {
  const coupes = [];
  const parcours = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  for (let noeud = parcours.nextNode(); noeud !== null; noeud = parcours.nextNode()) {
    for (const { 0: mot, index } of noeud.data.matchAll(/\S+/g)) {
      const plage = document.createRange();
      plage.setStart(noeud, index);
      plage.setEnd(noeud, index + mot.length);
      if (new Set([...plage.getClientRects()].map(({ top }) => Math.round(top))).size > 1) coupes.push(mot);
    }
  }
  return coupes;
}

// Les cellules des colonnes de tour de la liste d'accueil — en-tête et
// lignes —, sur toutes les feuilles : celles qui suivent nom, prénom et
// organisation.
const cellulesDeTour = (m) =>
  tous(m.racine, '[data-impression] [data-liste-imprimee] tr').flatMap((rangee) => [...rangee.cells].slice(3));

// Ce qu'une feuille imprime : sa liste, ses lignes et leur rang dans la
// liste entière, son en-tête — du haut de la liste au haut du corps —, la
// hauteur de sa zone de contenu.
function lireFeuille(feuille) {
  const liste = feuille.querySelector('[data-liste-imprimee]');
  const corps = liste.querySelector('tbody');
  const lignes = tous(corps, '[data-ligne-imprimee]');
  return {
    liste: Number(liste.dataset.listeImprimee),
    rangs: lignes.map((ligne) => Number(ligne.dataset.ligneImprimee)),
    hauteurs: lignes.map((ligne) => boite(ligne).height),
    entete: boite(corps).top - boite(liste).top,
    contenu: feuille.querySelector('[data-contenu]'),
    lignes,
  };
}

// Vérifie que les feuilles du document sont les pages de paginer sur les
// hauteurs rendues : liste par liste, chaque ligne une fois, dans l'ordre,
// sur les pages que paginer en fait ; chaque feuille sous son en-tête et son
// pied, aucune ligne au-delà de sa zone de contenu. Rend le nombre de
// listes.
function verifierPagination(m) {
  const lues = feuilles(m).map(lireFeuille);
  expect(lues.length).toBeGreaterThan(0);
  const parListe = new Map();
  for (const lue of lues) {
    if (!parListe.has(lue.liste)) parListe.set(lue.liste, []);
    parListe.get(lue.liste).push(lue);
  }
  expect([...parListe.keys()]).toEqual([...parListe.keys()].map((_, rang) => rang));
  for (const [liste, pages] of parListe) {
    const rangs = pages.flatMap(({ rangs: r }) => r);
    expect(rangs, `liste ${liste} : chaque ligne une fois, dans l'ordre`).toEqual(rangs.map((_, rang) => rang));
    const hauteurUtile = boite(pages[0].contenu).height;
    const attendues = paginer(pages.flatMap(({ hauteurs }) => hauteurs), { hauteurUtile, hauteurEntete: pages[0].entete });
    expect(pages.map(({ rangs: r }) => [r[0] ?? 0, (r.at(-1) ?? -1) + 1]), `liste ${liste}`).toEqual(attendues.map(({ debut, fin }) => [debut, fin]));
    for (const page of pages) {
      expect(Math.abs(page.entete - pages[0].entete), `liste ${liste} : en-tête répété`).toBeLessThanOrEqual(JEU_PX);
      const bas = boite(page.contenu).bottom;
      for (const ligne of page.lignes) expect(boite(ligne).bottom, `liste ${liste} : ligne dans sa page`).toBeLessThanOrEqual(bas + JEU_PX);
    }
  }
  for (const feuille of feuilles(m)) {
    expect(feuille.querySelectorAll('[data-pied]'), 'un pied par feuille').toHaveLength(1);
    expect(feuille.querySelectorAll('[data-entete-liste]'), 'un en-tête par feuille').toHaveLength(1);
  }
  return parListe.size;
}

describe('aucune troncature : les listes imprimées replient (§ 7.4)', () => {
  test('la liste d’accueil : un nom de deux cents caractères paraît entier, sa ligne replie ; aucune marque d’abréviation', async () => {
    const m = await ouvrirApercu(contexte, chargeNomLong());
    await choisirVue(m, 'accueil');
    const noms = tous(m.racine, '[data-impression] [data-nom-imprime]');
    const long = noms.find((noeud) => noeud.textContent === NOM_LONG);
    expect(long, 'le nom entier dans son nœud').toBeDefined();
    const ligne = long.closest('[data-ligne-imprimee]');
    const autre = noms.find((noeud) => noeud !== long).closest('[data-ligne-imprimee]');
    expect(boite(ligne).height, 'la ligne du nom long replie').toBeGreaterThan(1.5 * boite(autre).height);
    expect(boite(long).right).toBeLessThanOrEqual(boite(ligne).right + JEU_PX);
    expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
  });

  test('la feuille par table : le nom affiché paraît entier, sa ligne replie ; aucune marque d’abréviation', async () => {
    const charge = chargeNomLong();
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    const attendu = nomAffiche(charge.participants.find(({ id }) => id === 1));
    const noms = tous(m.racine, '[data-impression] [data-nom-imprime]');
    const longs = noms.filter((noeud) => noeud.textContent === attendu);
    expect(longs.length, 'le nom entier à chaque tour où la personne est assise').toBeGreaterThan(0);
    // Le nom long replie sur plus de lignes qu'un nom d'une autre table, que
    // chaque table imprime pourtant à sa propre taille.
    const tableDuNom = longs[0].closest('[data-liste-imprimee]').dataset.table;
    const autre = noms.find((noeud) => noeud.closest('[data-liste-imprimee]').dataset.table !== tableDuNom);
    expect(lignesDeTexte(longs[0]), 'la ligne du nom long replie').toBeGreaterThan(lignesDeTexte(autre) + 1);
    expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
  });
});

describe('la liste d’accueil (§ 11.7)', () => {
  test('une ligne par personne non exclue ; la grande démonstration se pagine : les feuilles sont les pages de paginer sur les hauteurs rendues, chacune sous son en-tête et son pied', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await choisirVue(m, 'accueil');
    expect(feuilles(m).length).toBeGreaterThan(1);
    expect(verifierPagination(m)).toBe(1);
    const presents = charge.participants.filter(({ exclu }) => !exclu).length;
    expect(tous(m.racine, '[data-impression] [data-ligne-imprimee]')).toHaveLength(presents);
    expect(tous(m.racine, '[data-impression] [data-participant]')).toHaveLength(presents);
    for (const feuille of feuilles(m)) {
      const entete = texte(feuille.querySelector('[data-entete-liste]'));
      for (let tour = 1; tour <= charge.evenement.tours; tour += 1) expect(entete).toContain(t('feuilles.tour', { tour }));
      expect(texte(feuille.querySelector('[data-pied]'))).toContain(t('impression.pied.tousLesTours'));
    }
  });
});

describe('la liste d’accueil : le tri (§ 11.7)', () => {
  // La principale, deux personnes sans organisation : la fin de la liste
  // triée par organisation.
  function chargeSansOrganisations() {
    let charge = chargePrincipale();
    for (const id of [3, 7]) charge = appliquerCommande('modifierParticipant', charge, { id, champs: { organisation: null } }).charge;
    return charge;
  }

  // Les lignes des feuilles imprimées, dans l'ordre du document : la feuille
  // de mesure, qui ne porte pas data-feuille, n'en est pas.
  const lignesRendues = (m) => tous(m.racine, '[data-impression] [data-feuille] [data-ligne-imprimee]');
  const ordreRendu = (m) => lignesRendues(m).map((ligne) => Number(ligne.dataset.participant));
  // La hauteur rendue de chaque ligne, par participant.
  const hauteurs = (m) => new Map(lignesRendues(m).map((ligne) => [Number(ligne.dataset.participant), boite(ligne).height]));
  const attendu = (m, charge, tri) =>
    lignesAccueil(charge, etatsDesTours(charge, m.ui.etat().proposition), cleNormalisee, tri).map(({ participant }) => participant);
  const choix = (m) => dans(m, '[data-apercu-impression] [data-champ="tri"]');

  // Choisit un tri par le sélecteur, et attend les lignes dans son ordre.
  async function trier(m, charge, tri) {
    choix(m).value = tri;
    choix(m).dispatchEvent(new Event('change', { bubbles: true }));
    await attendre(`le tri ${tri}`, () => m.ui.etat().apercu.tri === tri && ordreRendu(m).join() === attendu(m, charge, tri).join(), IMAGES);
  }

  test('« Trier par », dans les réglages de la vue : Organisation par défaut, puis Nom, Prénom ; chaque choix réordonne les lignes sans rien écrire, chaque ligne à sa hauteur', async () => {
    const charge = chargeSansOrganisations();
    const m = await ouvrirApercu(contexte, charge);
    const avant = m.trace.length;
    await choisirVue(m, 'accueil');
    const groupe = choix(m).closest('[role="group"]');
    expect(groupe.getAttribute('aria-label')).toBe(t('impression.groupe.reglages'));
    expect(texte(choix(m).closest('label'))).toContain(t('impression.tri.titre'));
    expect([...choix(m).options].map((option) => [option.value, texte(option)])).toEqual([
      ['organisation', t('impression.tri.organisation')],
      ['nom', t('impression.tri.nom')],
      ['prenom', t('impression.tri.prenom')],
    ]);
    expect(choix(m).value).toBe('organisation');
    expect(m.ui.etat().apercu.tri).toBe('organisation');
    expect(ordreRendu(m)).toEqual(attendu(m, charge, 'organisation'));
    expect(ordreRendu(m).slice(-2).sort((a, b) => a - b), 'les personnes sans organisation à la fin').toEqual([3, 7]);
    expect(verifierPagination(m)).toBe(1);
    const depart = hauteurs(m);
    for (const tri of ['nom', 'prenom', 'organisation']) {
      await trier(m, charge, tri);
      expect(verifierPagination(m), tri).toBe(1);
      for (const [participant, hauteur] of hauteurs(m)) {
        expect(Math.abs(hauteur - depart.get(participant)), `${tri} : ligne ${participant}`).toBeLessThanOrEqual(JEU_PX);
      }
    }
    expect(attendu(m, charge, 'nom').join(), 'le tri par nom diffère').not.toBe(attendu(m, charge, 'organisation').join());
    expect(m.trace.slice(avant), 'écritures du système simulé').toEqual([]);
    // Les autres vues n'offrent pas le tri.
    for (const vue of ['plan', 'tables']) {
      await choisirVue(m, vue);
      expect(choix(m), vue).toBeNull();
    }
  });

  test('par organisation, la dernière ligne de chaque organisation porte le filet à l’encre du texte, de même épaisseur ; par nom, aucune', async () => {
    const charge = chargeSansOrganisations();
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'accueil');
    const lignes = lignesAccueil(charge, etatsDesTours(charge, m.ui.etat().proposition), cleNormalisee, 'organisation');
    const fins = [...finsOrganisation(lignes, cleNormalisee)];
    expect(fins.length).toBeGreaterThan(1);
    const marquees = () => tous(m.racine, '[data-impression] [data-feuille] [data-fin-organisation]').map((ligne) => Number(ligne.dataset.participant));
    expect(marquees()).toEqual(fins);
    const texteEncre = couleurDeJeton('--couleur-page-texte', dans(m, '[data-impression]')).join();
    const filet = couleurDeJeton('--couleur-page-filet', dans(m, '[data-impression]')).join();
    expect(texteEncre).not.toBe(filet);
    for (const ligne of lignesRendues(m)) {
      const fin = fins.includes(Number(ligne.dataset.participant));
      for (const cellule of ligne.cells) {
        const style = getComputedStyle(cellule);
        expect(composantes(style.borderBottomColor).join(), `ligne ${ligne.dataset.participant}`).toBe(fin ? texteEncre : filet);
        expect(style.borderBottomWidth).toBe('1px');
      }
    }
    await trier(m, charge, 'nom');
    expect(marquees()).toEqual([]);
  });
});

describe('la liste d’accueil : une personne absente à un tour (§ 11.7)', () => {
  test('la case de son tour d\u{2019}absence dit « absente », et non la réserve ; ses autres tours gardent leur table', async () => {
    const principale = chargePrincipale();
    const id = principale.participants.find(({ exclu }) => !exclu).id;
    const charge = appliquerCommande('changerPresence', principale, { id, tours: [1] }).charge;
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'accueil');
    const ligne = dans(m, `[data-impression] [data-ligne-imprimee][data-participant="${id}"]`);
    expect(ligne, 'la ligne de la personne').not.toBeNull();
    const places = [...ligne.cells].slice(3).map(texte);
    expect(places).toHaveLength(charge.evenement.tours);
    expect(places.slice(1)).toEqual(places.slice(1).map(() => t('feuilles.accueil.absente')));
    expect(places[0]).toMatch(/^Table \d+$/);
  });
});

describe('la liste d’accueil : les colonnes de tour à la largeur de leur texte', () => {
  for (const [cas, charge] of [
    ['la grande démonstration, quatre tours', () => analyser(texteLivre('grande')).charge],
    ['la principale portée à six tours', () => appliquerCommande('changerTours', chargePrincipale(), { tours: 6 }).charge],
  ]) {
    test(`${cas} : chaque place et chaque tête de tour tient sur une ligne`, async () => {
      const m = await ouvrirApercu(contexte, charge(), { section: 'participants' });
      await choisirVue(m, 'accueil');
      const cellules = cellulesDeTour(m);
      expect(cellules.length).toBeGreaterThan(0);
      const repliees = cellules.filter((cellule) => lignesDeTexte(cellule) !== 1).map(texte);
      expect(repliees, 'cellules de tour sur plus d’une ligne').toEqual([]);
      verifierPagination(m);
    });
  }

});

describe('la liste d’accueil : des tours trop nombreux pour la page, en blocs de tours consécutifs (§ 7.4)', () => {
  // Les blocs de la liste rendue, dans l'ordre du document : pour chaque
  // liste, ses têtes de tour, l'en-tête de bloc de chacune de ses feuilles
  // (null sans en-tête), et les participants de ses lignes, ses feuilles
  // réunies.
  function blocsRendus(m) {
    const blocs = new Map();
    for (const liste of tous(m.racine, '[data-impression] [data-liste-imprimee]')) {
      const rang = liste.dataset.listeImprimee;
      if (!blocs.has(rang)) {
        blocs.set(rang, { tours: [...liste.querySelector('[data-entete-liste] tr').cells].slice(3).map(texte), entetes: [], participants: [] });
      }
      const bloc = blocs.get(rang);
      const entete = liste.querySelector('[data-tours-bloc]');
      bloc.entetes.push(entete === null ? null : texte(entete));
      bloc.participants.push(...tous(liste, '[data-participant]').map((ligne) => Number(ligne.dataset.participant)));
    }
    return [...blocs.values()];
  }

  // Vérifie les blocs de la liste rendue : les pages de paginer, bloc par
  // bloc ; chaque tour une fois, dans l'ordre ; des blocs de même taille, le
  // dernier au plus aussi long ; sur chaque feuille d'un bloc, l'en-tête qui
  // nomme ses tours — aucun sous un seul bloc ; dans chaque bloc, chaque
  // personne non exclue, dans l'ordre de la liste ; chaque place et chaque
  // tête de tour sur une ligne ; nom, prénom et organisation sur un tiers au
  // moins de la largeur ; le moins de blocs que ce plancher permet. Rend les
  // blocs.
  function verifierBlocs(m, charge) {
    const blocs = blocsRendus(m);
    expect(verifierPagination(m)).toBe(blocs.length);
    const R = charge.evenement.tours;
    expect(blocs.flatMap(({ tours }) => tours), 'chaque tour une fois, dans l’ordre').toEqual(
      Array.from({ length: R }, (_, rang) => t('feuilles.tour', { tour: rang + 1 })),
    );
    const tailles = blocs.map(({ tours }) => tours.length);
    expect(tailles.slice(0, -1), 'des blocs de même taille').toEqual(tailles.slice(0, -1).map(() => tailles[0]));
    expect(tailles.at(-1), 'le dernier bloc au plus aussi long').toBeLessThanOrEqual(tailles[0]);
    let premier = 1;
    for (const bloc of blocs) {
      const dernier = premier + bloc.tours.length - 1;
      const attendu = blocs.length === 1 ? null : t('feuilles.accueil.tours', { premier, dernier });
      expect(bloc.entetes, `tours ${premier} à ${dernier}`).toEqual(bloc.entetes.map(() => attendu));
      premier = dernier + 1;
    }
    const attendus = lignesAccueil(charge, etatsDesTours(charge, m.ui.etat().proposition), cleNormalisee, m.ui.etat().apercu.tri).map(
      ({ participant }) => participant,
    );
    expect(attendus.length).toBeGreaterThan(0);
    for (const [rang, bloc] of blocs.entries()) expect(bloc.participants, `bloc ${rang} : chaque ligne`).toEqual(attendus);
    expect(cellulesDeTour(m).filter((cellule) => lignesDeTexte(cellule) !== 1).map(texte), 'cellules de tour sur plus d’une ligne').toEqual([]);
    const tableaux = tous(m.racine, '[data-impression] [data-liste-imprimee] table');
    for (const tableau of tableaux) {
      const noms = [...tableau.querySelector('[data-entete-liste] tr').cells].slice(0, 3).reduce((somme, cellule) => somme + boite(cellule).width, 0);
      expect(noms, 'le plancher des noms').toBeGreaterThanOrEqual(boite(tableau).width / 3 - JEU_PX);
    }
    if (blocs.length > 1) {
      // Le moins de blocs possible : en un bloc de moins, le plus long
      // porterait ⌈R / (blocs − 1)⌉ colonnes de tour à la largeur rendue
      // de la plus large, qui passeraient sous le plancher des noms.
      const largeur = Math.max(...tableaux.map((tableau) => boite(tableau).width));
      const colonne = Math.max(...tableaux.flatMap((tableau) => [...tableau.querySelector('[data-entete-liste] tr').cells].slice(3).map((cellule) => boite(cellule).width)));
      expect(Math.ceil(R / (blocs.length - 1)) * colonne, 'un bloc de moins passerait sous le plancher des noms').toBeGreaterThan((largeur * 2) / 3 - JEU_PX);
    }
    expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
    return blocs;
  }

  for (const tours of [30, 31, 60, 100]) {
    test(`${tours} tours, A4 : des blocs de tours consécutifs, chacun sous l’en-tête qui nomme ses tours, les noms répétés ; chaque place sur une ligne`, async () => {
      const charge = appliquerCommande('changerTours', chargePrincipale(), { tours }).charge;
      const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
      await choisirVue(m, 'accueil');
      expect(verifierBlocs(m, charge).length).toBeGreaterThan(1);
      for (const feuille of feuilles(m)) expect(texte(feuille.querySelector('[data-pied]'))).toContain(t('impression.pied.tousLesTours'));
    });
  }

  test('un seul tour : un seul bloc, sans en-tête de bloc', async () => {
    const charge = appliquerCommande('changerTours', chargePrincipale(), { tours: 1 }).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await choisirVue(m, 'accueil');
    expect(verifierBlocs(m, charge)).toHaveLength(1);
    expect(tous(m.racine, '[data-impression] [data-tours-bloc]')).toEqual([]);
  });

  test('des libellés longs, sous sièges attribués : des tours trop larges côte à côte se répartissent en blocs, chaque place entière sur une ligne, aucun mot coupé', async () => {
    const charge = chargeSiegesAttribues();
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await choisirVue(m, 'accueil');
    expect(verifierBlocs(m, charge).length).toBeGreaterThan(1);
    const cellules = cellulesDeTour(m);
    expect(cellules.some((cellule) => texte(cellule).includes(t('feuilles.accueil.tableSiege', { table: 1, siege: 1 })))).toBe(true);
    expect(cellules.flatMap(motsCoupes), 'mots coupés').toEqual([]);
  });
});

describe('la feuille par table (§ 11.7, Q6 c)', () => {
  test('une feuille par table occupée, les tours en colonnes : chaque place listée, une place vide écrite comme telle ; une table où personne n’est assis n’a pas de feuille', async () => {
    const creee = appliquerCommande('creerTable', chargePrincipale(), { forme: 'ronde' }).charge;
    const nouvelle = creee.tables.at(-1);
    // La personne du plus grand identifiant exclue, la dernière de sa table
    // et loin des places titrées : sa place s'écrit vide à chaque tour.
    const derniere = Math.max(...creee.participants.map(({ id }) => id));
    const charge = appliquerCommande('exclureParticipant', creee, { id: derniere }).charge;
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    const occupees = charge.tables.filter(({ id }) => id !== nouvelle.id);
    expect(verifierPagination(m)).toBe(occupees.length);
    const blocs = tous(m.racine, '[data-impression] [data-liste-imprimee]');
    expect(blocs.map((bloc) => Number(bloc.dataset.table)).sort((a, b) => a - b)).toEqual(occupees.map(({ id }) => id).sort((a, b) => a - b));
    expect(blocs.some((bloc) => Number(bloc.dataset.table) === nouvelle.id), 'la table vide').toBe(false);
    const vides = tous(dans(m, '[data-impression]'), '[data-place-vide]');
    expect(vides.length).toBeGreaterThanOrEqual(charge.evenement.tours);
    for (const vide of vides) expect(texte(vide)).toBe(t('feuilles.tables.vide'));
    const modele = feuillesTables(charge, etatsDesTours(charge, m.ui.etat().proposition));
    for (const bloc of blocs) {
      const attendue = modele.find(({ table }) => table === Number(bloc.dataset.table));
      expect(tous(bloc, '[data-ligne-imprimee]'), `table ${attendue.numero}`).toHaveLength(attendue.lignes.length);
      expect(texte(bloc)).toContain(t('feuilles.tables.titre', { table: attendue.numero }));
    }
    for (const feuille of feuilles(m)) expect(texte(feuille.querySelector('[data-pied]'))).toContain(t('impression.pied.tousLesTours'));

    // Les titres nommés : « hôte », pourvu, à la table 1, place 1 ;
    // « animateur », non pourvu, à la table 3, place 3 — à chaque tour.
    const cellules = (idTable, place) =>
      [...blocs.find((candidat) => Number(candidat.dataset.table) === idTable).querySelector(`[data-ligne-imprimee="${place - 1}"]`).cells].slice(1).map(texte);
    const hote = cellules(1, 1);
    expect(hote).toHaveLength(charge.evenement.tours);
    for (const cellule of hote) {
      expect(cellule).toContain('hôte');
      expect(cellule).not.toContain(t('feuilles.tables.titreNonPourvu'));
    }
    const animateur = cellules(3, 3);
    expect(animateur).toHaveLength(charge.evenement.tours);
    for (const cellule of animateur) {
      expect(cellule).toContain('animateur');
      expect(cellule).toContain(t('feuilles.tables.titreNonPourvu'));
    }
  });

  test('le titre d\u{2019}une feuille porte le libellé de sa table dans son propre nœud ; un libellé de soixante caractères sans espace replie dans la largeur de la feuille', async () => {
    let charge = chargePrincipale();
    const [premiere, seconde] = charge.tables;
    charge = appliquerCommande('changerLibelleTable', charge, { id: premiere.id, libelle: 'Coin des invités' }).charge;
    charge = appliquerCommande('changerLibelleTable', charge, { id: seconde.id, libelle: 'W'.repeat(60) }).charge;
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    expect(verifierPagination(m)).toBe(charge.tables.length);
    const blocs = tous(m.racine, '[data-impression] [data-liste-imprimee]');
    const titreDe = (id) => blocs.find((bloc) => Number(bloc.dataset.table) === id).firstElementChild;
    const titre = titreDe(premiere.id);
    expect(texte(titre)).toBe(
      `${t('feuilles.tables.titre', { table: premiere.numero })}${t('feuilles.tables.avantLibelle')}Coin des invités`.replace(/\s+/g, ' ').trim(),
    );
    expect([...titre.children].map((e) => e.textContent)).toContain('Coin des invités');
    const long = titreDe(seconde.id);
    expect(texte(long)).toContain('W'.repeat(60));
    expect(long.scrollWidth).toBeLessThanOrEqual(long.clientWidth);
    const autre = charge.tables.find(({ id }) => id !== premiere.id && id !== seconde.id);
    expect(texte(titreDe(autre.id))).toBe(t('feuilles.tables.titre', { table: autre.numero }));
  });

  for (const [cas, chargeDuCas] of [
    ['en lecture', chargePrincipale],
    ['sur un plan bloqué', chargeBloquee],
  ]) {
    test(`« Une feuille par tour », ${cas} : une feuille par table et par tour, au pied de son tour ; la bascule revient aux colonnes ; rien ne s’écrit`, async () => {
      const charge = chargeDuCas();
      const m = await ouvrirApercu(contexte, charge);
      expect(m.seance.etat().mode).toBe('lecture');
      const avant = m.trace.length;
      await choisirVue(m, 'tables');
      const enColonnes = feuilles(m).length;
      await basculerParTour(m, true);
      const R = charge.evenement.tours;
      expect(verifierPagination(m)).toBe(charge.tables.length * R);
      const blocs = tous(m.racine, '[data-impression] [data-liste-imprimee]');
      blocs.forEach((bloc, rang) => {
        const tour = (rang % R) + 1;
        expect(texte(bloc.querySelector('[data-entete-liste]'))).toContain(t('feuilles.tour', { tour }));
        expect(texte(bloc.closest('[data-feuille]').querySelector('[data-pied]'))).toContain(t('impression.pied.tour', { tour }));
      });
      await basculerParTour(m, false);
      expect(feuilles(m)).toHaveLength(enColonnes);
      expect(m.trace.slice(avant), 'écritures du système simulé').toEqual([]);
    });
  }

  test('« Une feuille par tour » sur un retenu plus court que la soirée : les tours qu’il porte sans filigrane, le dernier avec', async () => {
    const charge = chargeRetenuCourt();
    const R = charge.evenement.tours;
    expect(estBrouillon(charge, { source: 'retenu', tour: 1 })).toBe(false);
    expect(estBrouillon(charge, { source: 'retenu', tour: 'tous' })).toBe(true);
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    for (const feuille of feuilles(m)) expect(feuille.querySelectorAll('[data-filigrane]'), 'en colonnes').toHaveLength(1);
    await basculerParTour(m, true);
    const blocs = tous(m.racine, '[data-impression] [data-liste-imprimee]');
    // Une feuille par table et par tour où quelqu'un y est assis : au tour
    // que le retenu ne porte pas, les seules réservations.
    const attendues = feuillesTables(charge, etatsDesTours(charge, null), { parTour: true });
    expect(blocs.map((bloc) => Number(bloc.dataset.table))).toEqual(attendues.map(({ table }) => table));
    expect(attendues.some(({ tours }) => tours[0] === R), `une feuille au tour ${R}`).toBe(true);
    blocs.forEach((bloc, rang) => {
      const [tour] = attendues[rang].tours;
      const feuille = bloc.closest('[data-feuille]');
      expect(feuille.querySelectorAll('[data-filigrane]'), `tour ${tour}`).toHaveLength(tour === R ? 1 : 0);
    });
  });
});

describe('la feuille par table : des tours nombreux sous un nom long (§ 7.4)', () => {
  // Les groupes de tours de chaque table, dans l'ordre du document : pour
  // chaque table, les têtes de tour de chacune de ses listes, une liste par
  // groupe — une liste plus longue qu'une page reprend ses têtes sur la
  // suivante, sous le même rang.
  function groupesParTable(m) {
    const groupes = new Map();
    const vues = new Set();
    for (const bloc of tous(m.racine, '[data-impression] [data-liste-imprimee]')) {
      if (vues.has(bloc.dataset.listeImprimee)) continue;
      vues.add(bloc.dataset.listeImprimee);
      const table = Number(bloc.dataset.table);
      if (!groupes.has(table)) groupes.set(table, []);
      groupes.get(table).push([...bloc.querySelector('[data-entete-liste] tr').cells].slice(1).map(texte));
    }
    return groupes;
  }

  for (const [cas, nom, tours] of [
    ['un nom de deux cents caractères sans espace, dix tours', NOM_LONG, 10],
    ['un nom de sept cents caractères en mots courts, quinze tours', NOM_LONG_DE_MOTS, 15],
  ]) {
    test(`${cas}, A4 : chaque ligne tient dans sa page ; la table du nom se scinde en groupes de tours, chaque tour une fois`, async () => {
      const charge = appliquerCommande(
        'changerTours',
        appliquerCommande('modifierParticipant', chargePrincipale(), { id: 1, champs: { nom } }).charge,
        { tours },
      ).charge;
      const m = await ouvrirApercu(contexte, charge);
      await choisirVue(m, 'tables');
      verifierPagination(m);
      const attendues = Array.from({ length: tours }, (_, rang) => t('feuilles.tour', { tour: rang + 1 }));
      const groupes = groupesParTable(m);
      expect([...groupes.keys()].sort((a, b) => a - b)).toEqual(charge.tables.map(({ id }) => id).sort((a, b) => a - b));
      for (const [table, suite] of groupes) expect(suite.flat(), `table ${table} : chaque tour une fois, dans l’ordre`).toEqual(attendues);
      const nomAttendu = nomAffiche(charge.participants.find(({ id }) => id === 1));
      const tableDuNom = Number(
        tous(m.racine, '[data-impression] [data-nom-imprime]').find((noeud) => noeud.textContent === nomAttendu).closest('[data-liste-imprimee]').dataset.table,
      );
      expect(groupes.get(tableDuNom).length, 'la table du nom long en plusieurs groupes de tours').toBeGreaterThan(1);
      expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
    });
  }

  test('dix tours et des noms ordinaires : aucun mot coupé dans une colonne de tour, chaque tour une fois par table', async () => {
    const charge = appliquerCommande('changerTours', chargePrincipale(), { tours: 10 }).charge;
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    verifierPagination(m);
    const attendues = Array.from({ length: 10 }, (_, rang) => t('feuilles.tour', { tour: rang + 1 }));
    for (const [table, suite] of groupesParTable(m)) expect(suite.flat(), `table ${table}`).toEqual(attendues);
    const cellules = tous(m.racine, '[data-impression] [data-liste-imprimee] tr').flatMap((rangee) => [...rangee.cells].slice(1));
    expect(cellules.flatMap(motsCoupes), 'mots coupés').toEqual([]);
  });

  test('quatre tours et des noms ordinaires : une seule feuille par table, tous les tours en colonnes', async () => {
    const charge = chargePrincipale();
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    const attendues = Array.from({ length: charge.evenement.tours }, (_, rang) => t('feuilles.tour', { tour: rang + 1 }));
    for (const [table, suite] of groupesParTable(m)) expect(suite, `table ${table}`).toEqual([attendues]);
  });
});

// Les lignes plus hautes qu'une page (§ 7.4) : un nom de milliers de
// caractères en mots courts, que même une colonne à toute la largeur que la
// place laisse ne tient pas sur une page.
const NOM_DE_PAGES = 'Ombrelle Pervenche '.repeat(1500).trim();

// La principale, la personne 1 renommée du nom de pages, à tours tours.
function chargeNomDePages(tours) {
  return appliquerCommande(
    'changerTours',
    appliquerCommande('modifierParticipant', chargePrincipale(), { id: 1, champs: { nom: NOM_DE_PAGES } }).charge,
    { tours },
  ).charge;
}

// Vérifie que rien d'une ligne ne tombe hors de la zone de contenu de sa
// feuille — ni sa boîte, ni aucun fragment de son texte —, et que chaque
// feuille porte un en-tête de liste.
function verifierDansLesZones(m) {
  for (const feuille of feuilles(m)) {
    const zone = boite(feuille.querySelector('[data-contenu]'));
    expect(feuille.querySelectorAll('[data-entete-liste]'), 'un en-tête par feuille').toHaveLength(1);
    for (const ligne of tous(feuille, '[data-ligne-imprimee]')) {
      const plage = document.createRange();
      plage.selectNodeContents(ligne);
      for (const rect of [boite(ligne), ...plage.getClientRects()]) {
        const ou = `feuille ${feuille.dataset.feuille}, ligne ${ligne.dataset.ligneImprimee}`;
        expect(rect.top, ou).toBeGreaterThanOrEqual(zone.top - JEU_PX);
        expect(rect.bottom, ou).toBeLessThanOrEqual(zone.bottom + JEU_PX);
      }
    }
  }
}

// Ce que les cellules de données d'une ligne rendue posent : ses nœuds de
// texte non blancs, dans l'ordre du document, mis bout à bout.
function texteDesDonnees(ligne) {
  return [...ligne.cells]
    .filter((cellule) => cellule.tagName === 'TD')
    .flatMap((cellule) => {
      const lus = [];
      const parcours = document.createTreeWalker(cellule, NodeFilter.SHOW_TEXT);
      for (let noeud = parcours.nextNode(); noeud !== null; noeud = parcours.nextNode()) if (noeud.data.trim() !== '') lus.push(noeud.data);
      return lus;
    })
    .join('');
}

describe('la feuille par table : une ligne plus haute qu’une page sous un seul tour (§ 7.4)', () => {
  test('deux tours, A4 : continuée sous l’en-tête répété, dans les zones ; le nom, puis le titre une fois', async () => {
    const charge = chargeNomDePages(2);
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    const attendu = plat(nomAffiche(charge.participants.find(({ id }) => id === 1)));
    verifierDansLesZones(m);

    // La ligne du nom, à chaque tour : continuée sur plusieurs feuilles, ses
    // morceaux mis bout à bout redonnent le nom entier, sans marque
    // d'abréviation.
    const morceaux = tous(m.racine, '[data-impression] [data-nom-imprime]').filter((noeud) => noeud.textContent.includes('Ombrelle Pervenche Ombrelle'));
    const parListe = new Map();
    for (const morceau of morceaux) {
      const liste = morceau.closest('[data-liste-imprimee]').dataset.listeImprimee;
      if (!parListe.has(liste)) parListe.set(liste, []);
      parListe.get(liste).push(morceau);
    }
    expect(parListe.size, 'la ligne du nom à chacun des deux tours').toBe(2);
    // Ce que la cellule de la ligne continuée pose entière : le nom, le
    // titre de la place, « non pourvu » s'il y a lieu (textesCellule), lu
    // sur la source de l'aperçu.
    const donnees = feuillesTables(charge, etatsDesTours(charge, m.ui.etat().proposition));
    const tours = Array.from({ length: charge.evenement.tours }, (_, rang) => rang + 1);
    for (const [liste, suite] of parListe) {
      const pages = new Set(suite.map((morceau) => morceau.closest('[data-feuille]').dataset.feuille));
      expect(pages.size, `liste ${liste} : la ligne continuée sur plusieurs feuilles`).toBeGreaterThan(1);
      expect(plat(suite.map((morceau) => morceau.textContent).join('')), `liste ${liste} : le nom entier`).toBe(attendu);

      // La même ligne sur chacune de ses feuilles, dans leur ordre : ses
      // parts mises bout à bout redonnent la cellule entière — le titre une
      // seule fois, après le dernier morceau du nom.
      const bloc = suite[0].closest('[data-liste-imprimee]');
      const rang = Number(suite[0].closest('[data-ligne-imprimee]').dataset.ligneImprimee);
      const entete = [...bloc.querySelector('[data-entete-liste] tr').cells].slice(1).map(texte);
      expect(entete, `liste ${liste} : un seul tour`).toHaveLength(1);
      const tour = tours.find((candidat) => t('feuilles.tour', { tour: candidat }) === entete[0]);
      const cellule = donnees.find(({ table }) => table === Number(bloc.dataset.table)).lignes[rang].cellules.find((c) => c.tour === tour);
      expect(cellule.occupant, `liste ${liste}`).toBe(1);
      expect(cellule.titre, `liste ${liste} : la place porte un titre`).not.toBeNull();
      const lignes = tous(m.racine, `[data-impression] [data-liste-imprimee="${liste}"] [data-ligne-imprimee="${rang}"]`);
      expect(lignes.length, `liste ${liste}`).toBe(pages.size);
      expect(lignes.map(texteDesDonnees).join(''), `liste ${liste} : la cellule entière`).toBe(textesCellule(cellule, t).join(''));
    }
    expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
  });
});

describe('la liste d’accueil : une ligne plus haute qu’une page (§ 7.4)', () => {
  test('deux tours, A4 : continuée sous l’en-tête répété, dans les zones ; chaque texte une fois, dans l’ordre ; le filet de fin d’organisation à son dernier morceau seulement', async () => {
    // La personne 1, seule de son organisation, ferme celle-ci sous le tri
    // par organisation, celui de départ.
    const charge = appliquerCommande('modifierParticipant', chargeNomDePages(2), { id: 1, champs: { organisation: 'Atelier Ombrelle' } }).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await choisirVue(m, 'accueil');
    expect(m.ui.etat().apercu.tri).toBe('organisation');
    verifierDansLesZones(m);

    const lignes = tous(m.racine, '[data-impression] [data-participant="1"]');
    const pages = new Set(lignes.map((ligne) => ligne.closest('[data-feuille]').dataset.feuille));
    expect(pages.size, 'la ligne continuée sur plusieurs feuilles').toBeGreaterThan(1);
    expect(lignes.length).toBe(pages.size);
    expect(
      lignes.map((ligne) => ligne.querySelector('[data-nom-imprime]')?.textContent ?? '').join(''),
      'le nom entier',
    ).toBe(NOM_DE_PAGES);
    const ligne = lignesAccueil(charge, etatsDesTours(charge, m.ui.etat().proposition), cleNormalisee, m.ui.etat().apercu.tri).find(
      ({ participant }) => participant === 1,
    );
    expect(lignes.map(texteDesDonnees).join(''), 'la ligne entière').toBe(textesLigneAccueil(ligne, t).join(''));
    expect(
      finsOrganisation(lignesAccueil(charge, etatsDesTours(charge, m.ui.etat().proposition), cleNormalisee, 'organisation'), cleNormalisee).has(1),
      'la personne 1 ferme son organisation',
    ).toBe(true);
    expect(
      lignes.map((rangee) => rangee.hasAttribute('data-fin-organisation')),
      'le filet au dernier morceau seulement',
    ).toEqual(lignes.map((_, rang) => rang === lignes.length - 1));
    // Chaque autre personne garde sa ligne entière, sur une feuille.
    const autres = tous(m.racine, '[data-impression] [data-participant]').filter((autre) => autre.dataset.participant !== '1');
    expect(autres).toHaveLength(charge.participants.filter(({ id, exclu }) => id !== 1 && !exclu).length);
    expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
  });

  test('sept tours, A4 : la ligne se continue dans chaque bloc de tours, le dernier plus court, sous l’en-tête du bloc ; chaque texte du bloc une fois, dans l’ordre', async () => {
    const charge = chargeNomDePages(7);
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await choisirVue(m, 'accueil');
    verifierDansLesZones(m);
    const ligne = lignesAccueil(charge, etatsDesTours(charge, m.ui.etat().proposition), cleNormalisee, m.ui.etat().apercu.tri).find(
      ({ participant }) => participant === 1,
    );
    const parBloc = new Map();
    for (const rangee of tous(m.racine, '[data-impression] [data-participant="1"]')) {
      const liste = rangee.closest('[data-liste-imprimee]');
      if (!parBloc.has(liste.dataset.listeImprimee)) parBloc.set(liste.dataset.listeImprimee, { liste, rangees: [] });
      parBloc.get(liste.dataset.listeImprimee).rangees.push(rangee);
    }
    expect(parBloc.size, 'la ligne dans plusieurs blocs').toBeGreaterThan(1);
    // Sept tours ne se partagent en blocs égaux sous aucune taille de 2 à
    // 6 : le dernier bloc, plus court, pose d'autres textes que le premier,
    // et ses morceaux se mesurent sur sa propre ligne.
    const vus = [];
    const tailles = [];
    for (const [bloc, { liste, rangees }] of parBloc) {
      const pages = new Set(rangees.map((rangee) => rangee.closest('[data-feuille]').dataset.feuille));
      expect(pages.size, `bloc ${bloc} : la ligne continuée sur plusieurs feuilles`).toBeGreaterThan(1);
      expect(rangees.length, `bloc ${bloc}`).toBe(pages.size);
      const tetes = [...liste.querySelector('[data-entete-liste] tr').cells].slice(3).map(texte);
      const places = ligne.places.filter(({ tour }) => tetes.includes(t('feuilles.tour', { tour })));
      expect(places, `bloc ${bloc} : une place par tête de tour`).toHaveLength(tetes.length);
      tailles.push(places.length);
      vus.push(...places.map(({ tour }) => tour));
      expect(rangees.map(texteDesDonnees).join(''), `bloc ${bloc} : la ligne entière`).toBe(textesLigneAccueil({ ...ligne, places }, t).join(''));
      for (const rangee of rangees) {
        const entete = rangee.closest('[data-liste-imprimee]').querySelector('[data-tours-bloc]');
        expect(texte(entete), `bloc ${bloc}`).toBe(t('feuilles.accueil.tours', { premier: places[0].tour, dernier: places.at(-1).tour }));
      }
    }
    expect(vus, 'chaque tour une fois, dans l’ordre').toEqual(Array.from({ length: 7 }, (_, rang) => rang + 1));
    expect(tailles.at(-1), 'le dernier bloc plus court').toBeLessThan(tailles[0]);
    expect(dans(m, '[data-impression]').textContent).not.toContain(ABREVIATION);
  });
});

describe('la feuille par table : l’organisation, une page par table, le texte ajusté, le dessin (§ 11.7)', () => {
  // La feuille par table de la principale, sur le papier donné.
  async function feuillesDeTables(papier = 'A4') {
    const charge = chargePrincipale();
    const m = await ouvrirApercu(contexte, charge, { papier });
    await choisirVue(m, 'tables');
    return { m, charge, modele: feuillesTables(charge, etatsDesTours(charge, m.ui.etat().proposition)) };
  }

  // Vérifie que chaque liste tient dans sa page, à sa taille : son corps
  // de tableau au-dessus du bas de la zone de contenu, aucun mot coupé ni
  // aucune cellule plus large que sa colonne.
  function verifierTaille(m) {
    for (const feuille of feuilles(m)) {
      const liste = feuille.querySelector('[data-liste-imprimee]');
      const bas = boite(feuille.querySelector('[data-contenu]')).bottom;
      expect(boite(liste.querySelector('tbody')).bottom, `liste ${liste.dataset.listeImprimee}`).toBeLessThanOrEqual(bas + JEU_PX);
      for (const cellule of tous(liste, 'td, th')) {
        expect(motsCoupes(cellule), `liste ${liste.dataset.listeImprimee} : ${texte(cellule)}`).toEqual([]);
        expect(cellule.scrollWidth, texte(cellule)).toBeLessThanOrEqual(cellule.clientWidth);
      }
    }
  }

  test('chaque occupant porte son organisation après son nom, à l’encre secondaire, séparée d’un tiret ; aucune sans organisation', async () => {
    const { m, modele } = await feuillesDeTables();
    const secondaire = couleurDeJeton('--couleur-page-texte-secondaire', dans(m, '[data-impression]')).join();
    let vues = 0;
    for (const bloc of tous(m.racine, '[data-impression] [data-liste-imprimee]')) {
      const feuille = modele.find(({ table }) => table === Number(bloc.dataset.table));
      for (const ligne of tous(bloc, '[data-ligne-imprimee]')) {
        const cellules = [...ligne.cells].slice(1);
        feuille.lignes[Number(ligne.dataset.ligneImprimee)].cellules.forEach((donnee, rang) => {
          const organisation = cellules[rang].querySelector('[data-organisation-imprimee]');
          if (donnee.organisation === null) {
            expect(organisation, `${donnee.nom}`).toBeNull();
            return;
          }
          vues += 1;
          expect(organisation.textContent).toBe(`${t('feuilles.tables.avantOrganisation')}${donnee.organisation}`);
          expect(organisation.previousElementSibling?.hasAttribute('data-nom-imprime')).toBe(true);
          expect(composantes(getComputedStyle(organisation).color).join()).toBe(secondaire);
          expect(getComputedStyle(organisation).fontWeight).not.toBe('700');
        });
      }
    }
    expect(vues, 'des organisations imprimées').toBeGreaterThan(0);
  });

  for (const papier of ['A4', 'Lettre']) {
    test(`${papier} : une table par page, son texte grandi au-delà du plancher et au plus de moitié, sans rien qui déborde ni mot coupé`, async () => {
      const { m, modele } = await feuillesDeTables(papier);
      const listes = tous(m.racine, '[data-impression] [data-liste-imprimee]');
      expect(feuilles(m)).toHaveLength(modele.length);
      expect(listes.map((liste) => Number(liste.dataset.table))).toEqual(modele.map(({ table }) => table));
      for (const feuille of feuilles(m)) expect(feuille.querySelectorAll('[data-liste-imprimee]')).toHaveLength(1);
      for (const liste of listes) {
        const echelle = Number(liste.dataset.echelle);
        expect(echelle, `table ${liste.dataset.table}`).toBeGreaterThan(1);
        expect(echelle).toBeLessThanOrEqual(ECHELLE_TEXTE_MAX);
        const corps = Number.parseFloat(getComputedStyle(liste.querySelector('td')).fontSize);
        expect(Math.abs(corps - 16 * echelle), `table ${liste.dataset.table}`).toBeLessThan(0.01);
        const titre = Number.parseFloat(getComputedStyle(liste.querySelector('.titre, p')).fontSize);
        expect(Math.abs(titre - 20 * echelle), `titre de la table ${liste.dataset.table}`).toBeLessThan(0.01);
      }
      verifierTaille(m);
    });
  }

  test('une table dont une ligne passe une page garde le plancher ; les autres grandissent chacune à sa taille', async () => {
    const charge = chargeNomDePages(2);
    const m = await ouvrirApercu(contexte, charge);
    await choisirVue(m, 'tables');
    const listes = tous(m.racine, '[data-impression] [data-liste-imprimee]');
    const tableDuNom = tous(m.racine, '[data-impression] [data-nom-imprime]')
      .find((noeud) => noeud.textContent.includes('Ombrelle Pervenche Ombrelle'))
      .closest('[data-liste-imprimee]').dataset.table;
    for (const liste of listes) {
      const echelle = Number(liste.dataset.echelle);
      if (liste.dataset.table === tableDuNom) expect(echelle, 'la table du nom').toBe(1);
      else expect(echelle, `table ${liste.dataset.table}`).toBeGreaterThan(1);
    }
    verifierDansLesZones(m);
  });

  test('« Dessiner la table », décochée par défaut : cochée, chaque page porte en tête le dessin de sa table au lieu du titre, une image nommée ; le texte se règle sur ce qui reste, sans rien écrire', async () => {
    const { m, charge, modele } = await feuillesDeTables();
    const bouton = () => dans(m, '[data-apercu-impression] [data-commande="dessinTable"]');
    expect(texte(bouton())).toBe(t('impression.dessinTable'));
    expect(bouton().getAttribute('aria-pressed')).toBe('false');
    expect(dans(m, '[data-impression] [data-dessin-table]')).toBeNull();
    const sans = new Map(tous(m.racine, '[data-impression] [data-liste-imprimee]').map((liste) => [liste.dataset.table, Number(liste.dataset.echelle)]));
    const avant = m.trace.length;
    await cliquer(m, '[data-apercu-impression] [data-commande="dessinTable"]');
    await attendre('les dessins', () => feuilles(m).length > 0 && dans(m, '[data-impression] [data-dessin-table]'), IMAGES);
    expect(m.ui.etat().apercu.dessinTable).toBe(true);
    expect(bouton().getAttribute('aria-pressed')).toBe('true');
    const listes = tous(m.racine, '[data-impression] [data-liste-imprimee]');
    expect(listes.map((liste) => Number(liste.dataset.table))).toEqual(modele.map(({ table }) => table));
    for (const liste of listes) {
      const numero = charge.tables.find(({ id }) => id === Number(liste.dataset.table)).numero;
      const dessin = liste.querySelector('[data-dessin-table]');
      expect(dessin, `table ${numero}`).not.toBeNull();
      expect(liste.firstElementChild).toBe(dessin);
      expect(dessin.getAttribute('role')).toBe('img');
      expect(dessin.getAttribute('aria-label')).toContain(t('feuilles.tables.titre', { table: numero }));
      expect(liste.querySelector('p'), 'plus de titre').toBeNull();
      expect(dessin.querySelectorAll('[data-chaise], circle, rect').length, `table ${numero} : son dessin`).toBeGreaterThan(0);
      expect(boite(dessin).height).toBeGreaterThan(0);
      expect(Number(liste.dataset.echelle)).toBeLessThanOrEqual(sans.get(liste.dataset.table));
    }
    verifierTaille(m);
    expect(m.trace.slice(avant)).toEqual([]);
    // Hors de la feuille par table, la commande n'est pas offerte.
    await choisirVue(m, 'accueil');
    expect(bouton()).toBeNull();
  });
});
