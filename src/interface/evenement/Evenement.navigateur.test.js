// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'événement ouvert dans un vrai moteur de rendu (§ 2.1, § 8.3 à § 8.9,
// § 9, § 14.5) : aucune section n'en exige une autre ; la place fixe de
// « Modifier », de « Débloquer » et de « Revenir en lecture », plein écran
// compris ; le cadre de mode et son libellé ; l'inactivité ; l'état bloqué
// et son déblocage confirmé en place ; les états du plan ; défaire et
// refaire ; les annonces d'ouverture, du journal et de la dérive ; le verrou
// d'une autre séance et sa reprise ; le support rompu ; le format plus
// récent. Chaque épreuve monte App par monterApp, sur le système de fichiers
// simulé, au cadre de 1 366 × 700, et lit le rendu : la boîte, l'élément
// qu'atteint un point, le style calculé, le texte — jamais une classe.
//
// Les éléments s'atteignent par leurs attributs data-… : data-place-fixe, la
// place fixe du cadre ; data-etat, un état du plan de l'en-tête ;
// data-verrou, le verrou d'une autre séance ; data-support-rompu, le message
// du support rompu. Le texte attendu vient de la même traduction que celle
// de l'application ; les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION, libelle } from '../../application/libelles.js';
import { INACTIVITE_MS } from '../../application/seance.js';
import { creerTraduction } from '../../application/traduction.js';
import { apercevoir } from '../../csv/apercu.js';
import { FLUX, creerPcg32 } from '../../demo/prng.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { FORMAT, analyser, configurationDepuisCharge, etatDeduit } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, molette, pointer } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { visible } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { CONFIRMATION_DEBLOCAGE, DELAI_CONFIRMATION_MS } from '../primitives/commande.js';
import { SECTIONS } from './sections.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const NOMS = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille', 'Merlette', 'Fauvelle'];
const EVENEMENT = { nom: 'Club des Merles', date: null, siegesParDefaut: 3, tours: 2 };
const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';

// Les montages de l'épreuve, démontés après elle ; le collecteur d'erreurs
// n'a rien reçu pendant l'épreuve.
let montes = [];
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// --- Les lectures du rendu ----------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const cadre = (m) => dans(m, '[data-mode]');
const fixe = (m, nom) => dans(m, `[data-place-fixe] [data-commande="${nom}"]`);
const historique = (m, nom) => dans(m, `[data-mode] [data-historique] [data-commande="${nom}"]`);
const boutonEtat = (m, etat) => dans(m, `[data-etat="${etat}"] [data-commande="etat"]`);
const libelleCadre = (m) => dans(m, '[data-mode-libelle="cadre"]');
const libelleBandeau = (m) => dans(m, '[data-mode-libelle="bandeau"]');
const avertissement = (m, code) => dans(m, `[data-avertissement="${code}"]`);
const ecran = (m) => dans(m, '[data-ecran]');

// Le coin haut gauche de la boîte d'un élément.
const coin = (element) => {
  const { left, top } = element.getBoundingClientRect();
  return [left, top];
};

// L'élément qu'atteint le centre de la boîte d'un élément.
const auCentre = (element) => {
  const { left, top, width, height } = element.getBoundingClientRect();
  return document.elementFromPoint(left + width / 2, top + height / 2);
};

// Un appui réel annoncé par Chromium comme le rang-ième clic d'une série
// (clickCount) : son événement click porte detail rang. cible est un élément,
// visé en son centre, ou le point que rend l'appui précédent de la série,
// dans le repère du cadre de l'épreuve.
async function cliquerEnSerie(cible, rang) {
  let { x, y } = cible;
  if (cible instanceof Element) {
    const { left, top, width, height } = cible.getBoundingClientRect();
    [x, y] = [left + width / 2, top + height / 2];
  }
  await pointer('presser', x, y, { clickCount: rang });
  await pointer('relacher', x, y, { clickCount: rang });
  flushSync();
  return { x, y };
}

// Attend que la file de la séance ait passé ce qui s'y trouve, par une
// lecture admise dans tout mode, qui n'écrit rien.
async function viderFile(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  flushSync();
}

// Le refus posé à côté d'un bouton de Commande : dans son conteneur.
const refusPres = (bouton, code) => bouton.parentElement.querySelector(`[data-refus="${code}"]`);

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

// --- Les événements d'épreuve -----------------------------------------------------

const baseDe = (m) => m.seance.etat().evenement.base;
const fichier = (m, suffixe, racine = 'documents') => m.fs.contenu(racine, `${baseDe(m)}${suffixe}`);
const journalDe = (m, racine = 'documents') => lireJournal(fichier(m, SUFFIXES.journal, racine));

// Un montage où l'événement neuf « Club des Merles », zéro participant et
// zéro table, est ouvert en lecture.
async function neuf(options = {}) {
  const m = await monter(options);
  await m.seance.creer(EVENEMENT);
  flushSync();
  return m;
}

// L'événement ouvert en écriture, garni par la séance des six participants
// et de trois tables de trois places.
async function garnir(m) {
  await m.seance.passerEnEcriture();
  for (const nom of NOMS) await m.seance.executer('ajouterParticipant', { champs: { nom } });
  for (let n = 0; n < 3; n += 1) await m.seance.executer('creerTable', { forme: 'ronde' });
  flushSync();
}

// Enregistre deux propositions du moteur, puis, quand retenir le veut, retient
// la première.
async function generer(m, { retenir = true } = {}) {
  const charge = m.seance.etat().charge;
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 7, arret: 40, nombre: 2 });
  await m.seance.executer('enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee });
  if (retenir) await m.seance.executer('retenirProposition', { id: m.seance.etat().charge.propositions[0].id });
  flushSync();
}

// Réécrit l'état d'un événement fermé : change(charge) le modifie en place,
// et l'état se sérialise à sa révision.
function reecrireEtat(m, base, change) {
  const chemin = `${base}${SUFFIXES.etat}`;
  const { entete, charge } = analyser(m.fs.contenu('documents', chemin));
  change(charge);
  m.fs.deposer('documents', chemin, serialiser(charge, { revision: entete.revision, produitVersion: entete.produitVersion }));
}

// --- Les épreuves -----------------------------------------------------------------

describe('aucun assistant (§ 2.1)', () => {
  test('un événement neuf : chaque section s’ouvre depuis la navigation, dans un ordre tiré puis renversé, et rend son titre ; aucune n’est grisée, aucun « Suivant »', async () => {
    const m = await neuf();
    const { charge } = m.seance.etat();
    expect([charge.participants.length, charge.tables.length]).toEqual([0, 0]);
    const ordre = creerPcg32(20261006, FLUX.DEMO).melanger([...SECTIONS]);
    expect(ordre.length).toBe(8);
    for (const nom of [...ordre, ...[...ordre].reverse()]) {
      const bouton = dans(m, `[data-commande="section"][data-cible="${nom}"]`);
      expect(visible(bouton), nom).toBe(true);
      bouton.click();
      flushSync();
      expect(m.ui.etat().section).toBe(nom);
      const section = dans(m, `[data-section="${nom}"]`);
      expect(section, nom).not.toBeNull();
      expect(section.textContent).toContain(t(`coquille.section.${nom}`));
    }
    const boutons = tous(m, '[data-ecran="evenement"] button');
    expect(boutons.length).toBeGreaterThan(0);
    for (const bouton of boutons) {
      expect(bouton.disabled).toBe(false);
      expect(bouton.getAttribute('aria-disabled')).toBeNull();
    }
    expect(ecran(m).textContent).not.toMatch(/suivant/i);
  });
});

describe('la place fixe (§ 8.4, § 8.5)', () => {
  test('« Modifier » aux mêmes coordonnées sur les huit sections ; plein écran, il reste visible et atteint ; « Revenir en lecture » puis « Débloquer » au même endroit', async () => {
    const m = await neuf();
    const coins = [];
    for (const nom of SECTIONS) {
      m.ui.allerA(nom);
      flushSync();
      expect(visible(fixe(m, 'modifier')), nom).toBe(true);
      coins.push(coin(fixe(m, 'modifier')));
    }
    expect(coins.length).toBe(8);
    for (const lu of coins) expect(lu).toEqual(coins[0]);
    // Un refus posé à côté d'un état, au-dessus de la surface, ne déplace
    // pas la place fixe, et ne la couvre pas.
    boutonEtat(m, 'bloque').click();
    await attendre(() => expect(dans(m, '[data-etat="bloque"] [data-refus="MODE_LECTURE"]')).not.toBeNull());
    expect(coin(fixe(m, 'modifier'))).toEqual(coins[0]);
    expect(visible(fixe(m, 'modifier'))).toBe(true);
    m.ui.allerA('plan');
    m.ui.basculerPleinEcran();
    flushSync();
    expect(visible(fixe(m, 'modifier'))).toBe(true);
    expect(fixe(m, 'modifier').contains(auCentre(fixe(m, 'modifier')))).toBe(true);
    expect(coin(fixe(m, 'modifier'))).toEqual(coins[0]);
    expect(dans(m, '[data-commande="section"]')).toBeNull();
    m.ui.basculerPleinEcran();
    flushSync();
    await m.seance.passerEnEcriture();
    flushSync();
    expect(fixe(m, 'modifier')).toBeNull();
    expect(fixe(m, 'lecture').textContent).toBe(t('communs.commande.lecture'));
    expect(coin(fixe(m, 'lecture'))).toEqual(coins[0]);
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    expect(fixe(m, 'debloquer').textContent).toBe(t('communs.commande.debloquer'));
    expect(coin(fixe(m, 'debloquer'))).toEqual(coins[0]);
    expect(visible(fixe(m, 'debloquer'))).toBe(true);
  });

  test('un double-clic sur « Modifier » passe en écriture et y reste : le second clic de la série tombe sur « Revenir en lecture », venu à sa place, qui ne l’exécute pas', async () => {
    const m = await neuf();
    const avant = m.trace.length;
    const clics = [];
    m.racine.addEventListener('click', (evenement) => clics.push([evenement.target.dataset.commande, evenement.detail]), true);
    const point = await cliquerEnSerie(fixe(m, 'modifier'), 1);
    await attendre(() => expect(fixe(m, 'lecture')).not.toBeNull());
    await viderFile(m);
    await cliquerEnSerie(point, 2);
    await viderFile(m);
    expect(clics).toEqual([
      ['modifier', 1],
      ['lecture', 2],
    ]);
    expect(m.seance.etat().mode).toBe('ecriture');
    expect(fixe(m, 'lecture')).not.toBeNull();
    const verrous = m.trace.slice(avant).filter(([primitive]) => primitive === 'verrouiller' || primitive === 'deverrouiller');
    expect(verrous.map(([primitive]) => primitive)).toEqual(['verrouiller']);
    expect(fichier(m, SUFFIXES.verrou)).not.toBeNull();
  });
});

describe('un nom long ou de glyphes larges (point d’attention 3)', () => {
  test('deux cents caractères sans espace : la page ne s’élargit pas, et « Modifier » garde sa place', async () => {
    const m = await neuf();
    const place = coin(fixe(m, 'modifier'));
    await m.seance.fermer();
    for (const motif of ['W', 'WW W', '\u{C6}\u{C6}\u{C6}', '\u{D4}jgq']) {
      const nom = motif.repeat(Math.ceil(200 / motif.length)).slice(0, 200);
      expect(nom.length).toBe(200);
      await m.seance.creer({ ...EVENEMENT, nom });
      flushSync();
      const titre = dans(m, '[data-ecran="evenement"] h1');
      expect(titre.textContent).toBe(nom);
      expect(document.documentElement.scrollWidth, motif).toBeLessThanOrEqual(window.innerWidth);
      expect(titre.getBoundingClientRect().right, motif).toBeLessThanOrEqual(window.innerWidth);
      // Ni le titre ni la tête qui le porte ne débordent : la tête défile en
      // hauteur, et un nom qui ne passerait pas à la ligne s'étendrait en
      // largeur sous elle sans élargir la page.
      const tete = titre.closest('header').parentElement;
      expect([titre.scrollWidth, tete.scrollWidth], motif).toEqual([titre.clientWidth, tete.clientWidth]);
      expect(coin(fixe(m, 'modifier')), motif).toEqual(place);
      expect(visible(fixe(m, 'modifier')), motif).toBe(true);
      await m.seance.fermer();
    }
  });
});

describe('passer en écriture (§ 8.4, § 19.3 01b)', () => {
  test('avant « Modifier », « Bloqué » est refusé à côté de l’état avec « Modifier », sans rien écrire ; après, il écrit une entrée, un jalon, et la séance revient en lecture', async () => {
    const m = await neuf();
    const avant = m.trace.length;
    boutonEtat(m, 'bloque').click();
    const refus = await attendre(() => {
      const element = dans(m, '[data-etat="bloque"] [data-refus="MODE_LECTURE"]');
      expect(element).not.toBeNull();
      return element;
    });
    expect(refus.textContent).toContain(t('MODE_LECTURE', {}));
    expect(refus.querySelector('[data-commande="modifier"]').textContent).toBe(t('communs.remede.modifier'));
    expect(visible(refus)).toBe(true);
    expect(m.trace.length).toBe(avant);
    fixe(m, 'modifier').click();
    await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
    expect(fichier(m, SUFFIXES.verrou)).not.toBeNull();
    // Sur un brouillon neuf, seul « Bloqué » pose un état : les autres sont
    // refusés à côté d'eux, sans rien écrire.
    const ecrites = m.trace.length;
    for (const [etat, code] of [
      ['brouillon', 'SANS_EFFET'],
      ['propose', 'AUCUNE_PROPOSITION'],
      ['retenu', 'AUCUN_RETENU'],
    ]) {
      boutonEtat(m, etat).click();
      await attendre(() => expect(refusPres(boutonEtat(m, etat), code)).not.toBeNull());
    }
    expect(m.trace.length).toBe(ecrites);
    const { entrees, jalons } = journalDe(m);
    boutonEtat(m, 'bloque').click();
    await attendre(() => expect(m.seance.etat().evenement.etat).toBe('bloque'));
    await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));
    const apres = journalDe(m);
    expect(apres.entrees.length).toBe(entrees.length + 1);
    expect(apres.jalons.length).toBe(jalons.length + 1);
    expect(fichier(m, SUFFIXES.verrou)).toBeNull();
    expect(fixe(m, 'debloquer')).not.toBeNull();
  });
});

describe('le cadre de mode (§ 8.4, § 14.5)', () => {
  test('il contient la surface, sa bordure n’est pas nulle, son libellé se voit ; texte et trait diffèrent en lecture, en écriture et bloqué ; même boîte après défilement', async () => {
    const m = await neuf();
    const releves = [];
    const relever = () => {
      flushSync();
      const boite = cadre(m).getBoundingClientRect();
      const surface = dans(m, '[data-section]').getBoundingClientRect();
      expect(boite.left).toBeLessThanOrEqual(surface.left);
      expect(boite.top).toBeLessThanOrEqual(surface.top);
      expect(boite.right).toBeGreaterThanOrEqual(surface.right);
      expect(boite.bottom).toBeGreaterThanOrEqual(surface.bottom);
      const style = getComputedStyle(cadre(m));
      expect(Number.parseFloat(style.borderTopWidth)).toBeGreaterThan(0);
      expect(style.borderTopStyle).not.toBe('none');
      const libelle = libelleCadre(m);
      expect(libelle.checkVisibility()).toBe(true);
      expect(visible(libelle)).toBe(true);
      expect(libelle.contains(auCentre(libelle))).toBe(true);
      expect(libelle.textContent).toBe(libelleBandeau(m).textContent);
      releves.push({ texte: libelle.textContent, trait: style.borderTopStyle });
    };
    relever();
    await m.seance.passerEnEcriture();
    relever();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    relever();
    expect(releves.map(({ texte }) => texte)).toEqual([
      t('coquille.mode.lecture'),
      t('coquille.mode.ecriture'),
      t('coquille.mode.bloque'),
    ]);
    expect(new Set(releves.map(({ trait }) => trait)).size).toBe(3);
    // Une surface plus haute que la fenêtre : la page et la surface
    // défilées jusqu'en bas, le libellé garde sa boîte.
    const avant = libelleCadre(m).getBoundingClientRect().toJSON();
    const haut = document.createElement('div');
    haut.style.height = '3000px';
    dans(m, '[data-section]').append(haut);
    window.scrollTo(0, document.documentElement.scrollHeight);
    for (let porteur = dans(m, '[data-section]'); porteur !== null; porteur = porteur.parentElement) {
      porteur.scrollTop = porteur.scrollHeight;
    }
    expect(libelleCadre(m).getBoundingClientRect().toJSON()).toEqual(avant);
    expect(visible(libelleCadre(m))).toBe(true);
    expect(visible(fixe(m, 'debloquer'))).toBe(true);
    haut.remove();
  });
});

describe('l’inactivité (§ 8.4, § 19.4)', () => {
  for (const [ouvrir, fermer] of [
    ['debuterGeste', 'finirGeste'],
    ['debuterCalcul', 'finirCalcul'],
  ]) {
    test(`${ouvrir} ouvert, onze minutes ne ramènent pas en lecture ; ${fermer}, dix minutes y ramènent : verrou rendu, cadre, bandeau et avertissement le disent`, async () => {
      const m = await neuf();
      fixe(m, 'modifier').click();
      await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
      m.seance[ouvrir]();
      m.horloge.avancer(11 * 60 * 1000);
      flushSync();
      expect(m.seance.etat().mode).toBe('ecriture');
      m.seance[fermer]();
      m.horloge.avancer(INACTIVITE_MS);
      await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));
      expect(fichier(m, SUFFIXES.verrou)).toBeNull();
      expect(libelleCadre(m).textContent).toBe(t('coquille.mode.lecture'));
      expect(libelleBandeau(m).textContent).toBe(t('coquille.mode.lecture'));
      const annonce = avertissement(m, 'RETOUR_AUTOMATIQUE');
      expect(annonce.textContent).toContain(t('RETOUR_AUTOMATIQUE', {}));
      expect(visible(annonce)).toBe(true);
      expect(fixe(m, 'modifier')).not.toBeNull();
    });
  }
});

describe('bloqué (§ 8.5, § 9)', () => {
  test('« Bloquer » rend le verrou ; une autre séance le lit bloqué ; ni « Modifier », ni « Retenu », ni « Défaire » ne débloquent ; « Débloquer » se confirme en place, puis écrit', async () => {
    const m = await neuf();
    await garnir(m);
    boutonEtat(m, 'bloque').click();
    await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));
    expect(m.seance.etat().evenement.etat).toBe('bloque');
    expect(fichier(m, SUFFIXES.verrou)).toBeNull();
    expect(fixe(m, 'debloquer')).not.toBeNull();
    const base = baseDe(m);
    const autre = await monter({ systeme: { disque: m.disque } });
    await autre.seance.ouvrir(base);
    flushSync();
    expect(autre.seance.etat().evenement.etat).toBe('bloque');
    expect(fixe(autre, 'debloquer').textContent).toBe(t('communs.commande.debloquer'));
    expect(fixe(autre, 'modifier')).toBeNull();

    const avant = m.trace.length;
    expect(fixe(m, 'modifier')).toBeNull();
    boutonEtat(m, 'retenu').click();
    await attendre(() => expect(refusPres(boutonEtat(m, 'retenu'), 'LECTURE_SEULE')).not.toBeNull());
    historique(m, 'defaire').click();
    const refusDefaire = await attendre(() => {
      const element = refusPres(historique(m, 'defaire'), 'LECTURE_SEULE');
      expect(element).not.toBeNull();
      return element;
    });
    expect(refusDefaire.querySelector('[data-commande="debloquer"]').textContent).toBe(t('communs.remede.debloquer'));
    expect(m.seance.etat().evenement.etat).toBe('bloque');
    expect(m.trace.length).toBe(avant);

    // Un clic arme, sans rien écrire ; l'horloge le désarme au terme du délai.
    fixe(m, 'debloquer').click();
    flushSync();
    expect(fixe(m, 'debloquer').textContent).toBe(t(CONFIRMATION_DEBLOCAGE));
    m.horloge.avancer(DELAI_CONFIRMATION_MS);
    flushSync();
    expect(fixe(m, 'debloquer').textContent).toBe(t('communs.commande.debloquer'));
    fixe(m, 'debloquer').click();
    flushSync();
    expect(m.trace.length).toBe(avant);
    expect(m.seance.etat().evenement.etat).toBe('bloque');
    const { entrees, jalons } = journalDe(m);
    fixe(m, 'debloquer').click();
    await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
    const { charge } = m.seance.etat();
    expect(charge.evenement.etat).toBe(etatDeduit(charge));
    expect(journalDe(m).entrees.length).toBe(entrees.length + 1);
    expect(journalDe(m).jalons.length).toBe(jalons.length + 1);
    expect(fixe(m, 'lecture')).not.toBeNull();
  });
});

describe('les états du plan (§ 9)', () => {
  test('avec des propositions et un retenu, « Brouillon » puis « Retenu » : rien d’autre ne change, deux entrées, deux jalons, libellés exacts', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    const avant = m.seance.etat().charge;
    expect(avant.evenement.etat).toBe('retenu');
    const { entrees, jalons } = journalDe(m);
    boutonEtat(m, 'brouillon').click();
    await attendre(() => expect(m.seance.etat().evenement.etat).toBe('brouillon'));
    boutonEtat(m, 'retenu').click();
    await attendre(() => expect(m.seance.etat().evenement.etat).toBe('retenu'));
    const apres = m.seance.etat().charge;
    expect(apres).toEqual(avant);
    const journal = journalDe(m);
    expect(journal.entrees.slice(entrees.length).map((entree) => entree.libelle)).toEqual([
      libelle('ENTREE_CHANGER_ETAT', { etat: 'brouillon' }),
      libelle('ENTREE_CHANGER_ETAT', { etat: 'retenu' }),
    ]);
    expect(journal.jalons.length).toBe(jalons.length + 2);
    expect(journal.jalons.slice(-2).map(({ nom }) => nom)).toEqual([
      libelle('JALON_ETAT', { etat: 'brouillon' }),
      libelle('JALON_ETAT', { etat: 'retenu' }),
    ]);
  });

  test('« Retenu » sans retenu : refusé à côté de l’état, avec la section des propositions pour remède', async () => {
    const m = await neuf();
    fixe(m, 'modifier').click();
    await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
    const avant = m.trace.length;
    boutonEtat(m, 'retenu').click();
    const refus = await attendre(() => {
      const element = refusPres(boutonEtat(m, 'retenu'), 'AUCUN_RETENU');
      expect(element).not.toBeNull();
      return element;
    });
    expect(visible(refus)).toBe(true);
    const remede = refus.querySelector('[data-commande="ouvrirSection"]');
    expect(remede.textContent).toBe(t('communs.remede.ouvrirSection.propositions'));
    remede.click();
    await attendre(() => expect(m.ui.etat().section).toBe('propositions'));
    expect(m.trace.length).toBe(avant);
  });
});

describe('défaire, refaire (§ 8.3)', () => {
  const nombre = (m) => m.seance.etat().charge.participants.length;

  test('trois gestes, « Défaire » rend le deuxième et offre « Refaire » ; « Refaire » rend le troisième ; un geste après « Défaire » retire « Refaire »', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    for (const nom of NOMS.slice(0, 3)) await m.seance.executer('ajouterParticipant', { champs: { nom } });
    flushSync();
    expect(historique(m, 'refaire')).toBeNull();
    historique(m, 'defaire').click();
    await attendre(() => expect(nombre(m)).toBe(2));
    expect(historique(m, 'refaire').textContent).toBe(t('evenement.commande.refaire'));
    historique(m, 'refaire').click();
    await attendre(() => expect(nombre(m)).toBe(3));
    historique(m, 'defaire').click();
    await attendre(() => expect(nombre(m)).toBe(2));
    expect(historique(m, 'refaire')).not.toBeNull();
    await m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[3] } });
    await attendre(() => expect(historique(m, 'refaire')).toBeNull());
  });

  test('un double-clic sur « Défaire » rend un seul geste : le second clic de la série, reçu une fois le premier retour écrit, n’en défait pas un autre', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    for (const nom of NOMS.slice(0, 3)) await m.seance.executer('ajouterParticipant', { champs: { nom } });
    flushSync();
    const { entrees } = journalDe(m);
    const point = await cliquerEnSerie(historique(m, 'defaire'), 1);
    await attendre(() => expect(nombre(m)).toBe(2));
    await viderFile(m);
    expect(historique(m, 'defaire').getAttribute('aria-busy')).toBeNull();
    await cliquerEnSerie(point, 2);
    await viderFile(m);
    expect(nombre(m)).toBe(2);
    expect(journalDe(m).entrees.length).toBe(entrees.length + 1);
    // Un clic simple ensuite défait de nouveau.
    await cliquerEnSerie(historique(m, 'defaire'), 1);
    await attendre(() => expect(nombre(m)).toBe(1));
  });

  test('un retour de 5 à 2, puis « Défaire » : la cible est le prédécesseur de 2 sur le fil, non la ligne précédente', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    for (const nom of NOMS.slice(0, 4)) await m.seance.executer('ajouterParticipant', { champs: { nom } });
    expect(m.seance.etat().evenement.revision).toBe(5);
    await m.seance.revenir(2);
    flushSync();
    expect(nombre(m)).toBe(1);
    historique(m, 'defaire').click();
    await attendre(() => expect(nombre(m)).toBe(0));
  });

  test('en lecture, « Défaire » est refusé à côté de lui avec « Modifier » ; bloqué, avec « Débloquer » ; rien ne s’écrit', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    await m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[0] } });
    await m.seance.passerEnLecture();
    flushSync();
    const avant = m.trace.length;
    historique(m, 'defaire').click();
    const enLecture = await attendre(() => {
      const element = refusPres(historique(m, 'defaire'), 'MODE_LECTURE');
      expect(element).not.toBeNull();
      return element;
    });
    expect(enLecture.querySelector('[data-commande="modifier"]').textContent).toBe(t('communs.remede.modifier'));
    expect(m.trace.length).toBe(avant);
    expect(nombre(m)).toBe(1);
    await m.seance.passerEnEcriture();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    const bloque = m.trace.length;
    historique(m, 'defaire').click();
    const refus = await attendre(() => {
      const element = refusPres(historique(m, 'defaire'), 'LECTURE_SEULE');
      expect(element).not.toBeNull();
      return element;
    });
    expect(refus.querySelector('[data-commande="debloquer"]')).not.toBeNull();
    expect(m.trace.length).toBe(bloque);
  });
});

describe('les annonces d’ouverture (§ 8.9, § 9)', () => {
  test('une proposition de longueur fausse et une périmée : l’écartée nomme son numéro et sa faute ; la dérive nomme la périmée et sa raison, et la charge la garde', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m, { retenir: false });
    const base = baseDe(m);
    const [premiere, seconde] = m.seance.etat().charge.propositions.map(({ id }) => id);
    await m.seance.fermer();
    reecrireEtat(m, base, (charge) => {
      charge.propositions[0].placement.pop();
      charge.participants[0].exclu = true;
    });
    await m.seance.ouvrir(base);
    flushSync();
    const etat = m.seance.etat();
    expect(etat.fautives.length).toBe(1);
    const [fautive] = etat.fautives;
    expect(fautive.id).toBe(premiere);
    const ecartee = avertissement(m, 'PROPOSITIONS_FAUTIVES');
    expect(visible(ecartee)).toBe(true);
    expect(ecartee.textContent).toContain(t('PROPOSITIONS_FAUTIVES', { ids: [fautive.id] }));
    expect(fautive.fautes.length).toBeGreaterThan(0);
    for (const faute of fautive.fautes) expect(ecartee.textContent).toContain(t(faute.code, faute));
    expect(ecartee.querySelector('[data-fautive]').textContent).toContain(String(fautive.id));
    const derive = avertissement(m, 'DERIVE');
    expect(derive.textContent).toContain(t('DERIVE', { ids: [seconde], retenu: false }));
    const [{ raisons }] = etat.examen.derives;
    expect(raisons.length).toBeGreaterThan(0);
    for (const raison of raisons) expect(derive.textContent).toContain(t(raison.code, raison));
    expect(etat.charge.propositions.map(({ id }) => id)).toEqual([seconde]);
    derive.querySelector('[data-commande="ouvrirSection"]').click();
    await attendre(() => expect(m.ui.etat().section).toBe('propositions'));
  });

  test('en plein écran, le remède d’une dérive mène à sa section, et la navigation des sections y revient : le plein écran ne vaut que pour le plan', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    await m.seance.executer('changerTours', { tours: EVENEMENT.tours + 1 });
    m.ui.allerA('plan');
    flushSync();
    expect(tous(m, '[data-commande="section"]')).toHaveLength(SECTIONS.length);
    dans(m, '[data-commande="pleinEcran"]').click();
    flushSync();
    expect(tous(m, '[data-commande="section"]')).toHaveLength(0);
    const remede = await attendre(() => {
      const trouve = dans(m, '[data-annonces] [data-avertissement="DERIVE_NOUVELLE"] [data-commande="ouvrirSection"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    remede.click();
    await attendre(() => expect(m.ui.etat().section).not.toBe('plan'));
    flushSync();
    const navigation = tous(m, '[data-commande="section"]');
    expect(navigation).toHaveLength(SECTIONS.length);
    for (const bouton of navigation) expect(visible(bouton), bouton.dataset.cible).toBe(true);
    navigation.find((bouton) => bouton.dataset.cible === 'tables').click();
    flushSync();
    expect(dans(m, '[data-section]').dataset.section).toBe('tables');
    m.ui.allerA('plan');
    flushSync();
    expect(tous(m, '[data-commande="section"]')).toHaveLength(SECTIONS.length);
  });

  test('un retenu fautif : son message vient en premier et offre « Ouvrir la version précédente », qui l’ouvre en lecture sans rien écrire', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    const base = baseDe(m);
    await m.seance.fermer();
    reecrireEtat(m, base, (charge) => {
      charge.retenu.placement.pop();
    });
    await m.seance.ouvrir(base);
    flushSync();
    const premier = dans(m, '[data-avertissement]');
    expect(premier.dataset.avertissement).toBe('RETENU_FAUTIF');
    expect(premier.textContent).toContain(t('RETENU_FAUTIF', {}));
    const remede = premier.querySelector('[data-commande="ouvrirSecours"]');
    expect(remede.textContent).toBe(t('communs.remede.ouvrirSecours.precedent'));
    const avant = m.trace.length;
    remede.click();
    await attendre(() => expect(m.seance.etat().examen.retenu.fautes).toEqual([]));
    expect(m.seance.etat().mode).toBe('lecture');
    expect(m.seance.etat().charge.retenu).toBeNull();
    expect(avertissement(m, 'RETENU_FAUTIF')).toBeNull();
    expect(m.trace.length).toBe(avant);
  });
});

describe('l’écran tient dans la fenêtre, avertissements compris (§ 8.4)', () => {
  // Ferme l'événement garni et généré de base, l'abîme, puis le rouvre : une
  // proposition de longueur fausse, une périmée, et une entrée du journal
  // abîmée lui donnent trois avertissements à l'ouverture, au moins.
  async function rouvrirAbime(m, base) {
    await m.seance.fermer();
    reecrireEtat(m, base, (charge) => {
      charge.propositions[0].placement.pop();
      charge.participants[0].exclu = true;
    });
    const chemin = `${base}${SUFFIXES.journal}`;
    const lignes = m.fs.contenu('documents', chemin).split('\n');
    const rang = lignes.findIndex((ligne) => ligne.startsWith('{"type":"entree"') && JSON.parse(ligne).revision === 4);
    expect(rang).toBeGreaterThan(0);
    lignes[rang] = '{"type":"entree", abîmée';
    m.fs.deposer('documents', chemin, lignes.join('\n'));
    await m.seance.ouvrir(base);
    flushSync();
    await new Promise((resoudre) => requestAnimationFrame(resoudre));
  }

  test('à 1 366 × 700, trois avertissements et plus : la page ne défile pas, le plan garde sa hauteur ; les avertissements défilent à la molette, sans rien déplacer', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m, { retenir: false });
    const base = baseDe(m);
    // La hauteur du dessin du plan sans aucune annonce : la mesure de
    // référence de ce que les avertissements peuvent lui prendre.
    m.ui.allerA('plan');
    flushSync();
    expect(dans(m, '[data-annonces]')).toBeNull();
    const hauteurSeule = dans(m, '[data-plan]').getBoundingClientRect().height;
    expect(hauteurSeule).toBeGreaterThan(0);
    await rouvrirAbime(m, base);
    expect(m.ui.etat().section).toBe('plan');
    const montres = tous(m, '[data-avertissement]');
    expect(montres.length).toBeGreaterThanOrEqual(3);
    const boite = (element) => element.getBoundingClientRect().toJSON();
    // La page ne défile pas : le cadre tient dans la fenêtre, et la section
    // du plan dans le cadre, sans que la surface qui la porte ait à défiler.
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(innerHeight);
    expect(cadre(m).getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight);
    const section = dans(m, '[data-section]');
    const porteur = section.parentElement;
    expect(section.getBoundingClientRect().bottom).toBeLessThanOrEqual(porteur.getBoundingClientRect().bottom);
    expect(porteur.scrollHeight).toBeLessThanOrEqual(porteur.clientHeight);
    expect(visible(dans(m, '[data-plan]'))).toBe(true);
    // Le plan reste la surface de travail : les annonces ne prennent pas
    // plus du quart de la hauteur de son dessin.
    expect(dans(m, '[data-plan]').getBoundingClientRect().height).toBeGreaterThanOrEqual(hauteurSeule * 0.75);
    // Les avertissements débordent leur zone, qui défile seule, à la
    // molette, comme sous la main de l'opérateur : le dernier, amené dans la
    // zone, se voit, et ni la page, ni la place fixe, ni la section n'ont
    // bougé.
    const zone = montres[0].closest('[data-annonces]');
    expect(zone).not.toBeNull();
    for (const montre of montres) expect(zone.contains(montre)).toBe(true);
    expect(zone.scrollHeight).toBeGreaterThan(zone.clientHeight);
    expect(['auto', 'scroll']).toContain(getComputedStyle(zone).overflowY);
    expect(visible(montres[0])).toBe(true);
    const place = coin(fixe(m, 'modifier'));
    const avant = boite(section);
    const surZone = zone.getBoundingClientRect();
    await molette(surZone.left + surZone.width / 2, surZone.top + surZone.height / 2, zone.scrollHeight);
    await attendre(() => expect(visible(montres.at(-1))).toBe(true));
    expect(zone.scrollTop).toBeGreaterThan(0);
    expect(window.scrollY).toBe(0);
    expect(coin(fixe(m, 'modifier'))).toEqual(place);
    expect(boite(section)).toEqual(avant);
    // Sur chaque section, la page reste sans défilement, et la zone garde
    // sa boîte.
    const zoneAvant = boite(zone);
    for (const nom of SECTIONS) {
      m.ui.allerA(nom);
      flushSync();
      expect(document.documentElement.scrollHeight, nom).toBeLessThanOrEqual(innerHeight);
      expect(boite(dans(m, '[data-annonces]')), nom).toEqual(zoneAvant);
    }
  });

  test('à 1 366 × 700, les avertissements de dérive se posent à côté de la tête : le plan garde toute sa hauteur, et ses chaises au zoom ajusté', async () => {
    const m = await monter();
    await m.seance.creer({ nom: 'Bal des Grisailles', date: null, siegesParDefaut: 8, tours: 3 });
    await m.seance.passerEnEcriture();
    for (let n = 0; n < 18; n += 1) await m.seance.executer('ajouterParticipant', { champs: { nom: `${NOMS[n % NOMS.length]} ${n + 1}` } });
    for (let n = 0; n < 3; n += 1) await m.seance.executer('creerTable', { forme: 'ronde' });
    await generer(m);
    m.ui.allerA('plan');
    flushSync();
    const ajuster = async () => {
      dans(m, '[data-commande="ajuster"]').click();
      flushSync();
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
      flushSync();
    };
    await ajuster();
    expect(dans(m, '[data-annonces]')).toBeNull();
    const hauteurSeule = dans(m, '[data-plan]').getBoundingClientRect().height;
    expect(hauteurSeule).toBeGreaterThan(0);
    // Trois gestes admis sur le retenu, chacun une dérive annoncée.
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Rouvraie' } });
    await m.seance.executer('creerTable', { forme: 'ronde' });
    await m.seance.executer('changerTours', { tours: 4 });
    flushSync();
    await ajuster();
    const montres = tous(m, '[data-annonces] [data-avertissement]');
    expect(montres.length).toBeGreaterThan(0);
    // La zone se voit, et le premier avertissement s'ouvre dans elle.
    const zone = dans(m, '[data-annonces]');
    expect(visible(zone)).toBe(true);
    const [boiteZone, premier] = [zone.getBoundingClientRect(), montres[0].getBoundingClientRect()];
    expect(premier.top).toBeGreaterThanOrEqual(boiteZone.top);
    expect(premier.top).toBeLessThan(boiteZone.bottom - 16);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(innerHeight);
    expect(dans(m, '[data-plan]').getBoundingClientRect().height).toBeGreaterThanOrEqual(hauteurSeule - 1);
    const tables = tous(m, '[data-plan] [data-table]');
    expect(tables.length).toBe(4);
    expect(tous(m, '[data-plan] [data-siege]').length).toBe(4 * 8);
    // La navigation et la place fixe restent atteintes.
    const navigation = tous(m, '[data-commande="section"]');
    expect(navigation).toHaveLength(SECTIONS.length);
    for (const bouton of navigation) expect(visible(bouton), bouton.dataset.cible).toBe(true);
    expect(fixe(m, 'lecture').contains(auCentre(fixe(m, 'lecture')))).toBe(true);
  });

  test('à 1 366 × 700, un support rompu et trois avertissements et plus : chaque issue du support rompu se voit sans défiler, la page ne défile pas, et les avertissements défilent sous lui', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m, { retenir: false });
    await rouvrirAbime(m, baseDe(m));
    expect(tous(m, '[data-avertissement]').length).toBeGreaterThanOrEqual(3);
    fixe(m, 'modifier').click();
    await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
    m.fs.pannes.ecriture('documents');
    await expect(m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[0] } })).rejects.toMatchObject({ code: 'ECRITURE' });
    flushSync();
    await new Promise((resoudre) => requestAnimationFrame(resoudre));
    expect(m.seance.etat().supportRompu).not.toBeNull();
    const montres = tous(m, '[data-avertissement]');
    expect(montres.length).toBeGreaterThanOrEqual(3);
    expect(document.documentElement.scrollHeight).toBeLessThanOrEqual(innerHeight);
    expect(cadre(m).getBoundingClientRect().bottom).toBeLessThanOrEqual(innerHeight);
    // Les issues du support rompu, seule sortie de l'opérateur, se voient
    // sans que rien ne défile.
    const message = dans(m, '[data-support-rompu]');
    for (const nom of ['choisirDossier', 'abandonner']) {
      const issue = message.querySelector(`[data-commande="${nom}"]`);
      expect(issue, nom).not.toBeNull();
      expect(visible(issue), nom).toBe(true);
    }
    expect(visible(fixe(m, 'lecture'))).toBe(true);
    expect(visible(dans(m, '[data-plan]'))).toBe(true);
    // Les avertissements restent dans la zone, qui défile seule : le
    // dernier, amené à la molette, se voit, et la page n'a pas bougé.
    const zone = message.closest('[data-annonces]');
    expect(zone).not.toBeNull();
    for (const montre of montres) expect(zone.contains(montre)).toBe(true);
    const surZone = zone.getBoundingClientRect();
    await molette(surZone.left + surZone.width / 2, surZone.top + surZone.height / 2, zone.scrollHeight);
    await attendre(() => expect(visible(montres.at(-1))).toBe(true));
    expect(window.scrollY).toBe(0);
  });
});

describe('le journal (§ 8.6, § 8.2)', () => {
  test('cent entrées, la 37ᵉ abîmée : JOURNAL_ECARTEES {n: 64} s’affiche, son texte porte « 64 »', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    for (let n = 2; n <= 100; n += 1) await m.seance.executer('ajouterParticipant', { champs: { nom: `Ombrelle ${n}` } });
    const base = baseDe(m);
    const journal = journalDe(m);
    expect(journal.entrees.length).toBe(100);
    expect(journal.jalons.length).toBe(1);
    await m.seance.fermer();
    const chemin = `${base}${SUFFIXES.journal}`;
    const lignes = m.fs.contenu('documents', chemin).split('\n');
    const rang = lignes.findIndex((ligne) => ligne.startsWith('{"type":"entree"') && JSON.parse(ligne).revision === 37);
    expect(rang).toBeGreaterThan(0);
    lignes[rang] = '{"type":"entree", abîmée';
    m.fs.deposer('documents', chemin, lignes.join('\n'));
    const avant = m.trace.length;
    await m.seance.ouvrir(base);
    flushSync();
    const ecartees = avertissement(m, 'JOURNAL_ECARTEES');
    expect(ecartees.textContent).toContain(t('JOURNAL_ECARTEES', { n: 64 }));
    expect(ecartees.textContent).toContain('64');
    expect(visible(ecartees)).toBe(true);
    expect(m.trace.length).toBe(avant);
  });

  test('un journal en avance d’une entrée : la charge du geste est celle qui s’ouvre, annoncée, sans rien écrire', async () => {
    const m = await neuf();
    await m.seance.passerEnEcriture();
    await m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[0] } });
    await m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[1] } });
    const base = baseDe(m);
    await m.seance.fermer();
    m.fs.deposer('documents', `${base}${SUFFIXES.etat}`, m.fs.contenu('documents', `${base}${SUFFIXES.precedent}`));
    const avant = m.trace.length;
    await m.seance.ouvrir(base);
    flushSync();
    expect(m.seance.etat().charge.participants.map(({ nom }) => nom)).toEqual(NOMS.slice(0, 2));
    expect(m.seance.etat().evenement.revision).toBe(3);
    // L'avertissement se lit comme le reste de l'écran : rendu, et son texte
    // celui de la table.
    const repris = avertissement(m, 'JOURNAL_REPRIS');
    expect(visible(repris)).toBe(true);
    expect(repris.textContent).toContain(t('JOURNAL_REPRIS', {}));
    expect(m.trace.length).toBe(avant);
  });
});

describe('la dérive (§ 9)', () => {
  test('retenu, puis exclure une personne : l’avertissement nomme le retenu et la raison, et le geste suivant reste permis', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    const exclue = m.seance.etat().charge.participants[0].id;
    await m.seance.executer('exclureParticipant', { id: exclue });
    flushSync();
    const nouvelle = m.seance.etat().avertissements.find(({ code }) => code === 'DERIVE_NOUVELLE');
    expect(nouvelle.details.touchees.map(({ id }) => id)).toContain('retenu');
    const element = avertissement(m, 'DERIVE_NOUVELLE');
    expect(element.textContent).toContain(t('DERIVE_NOUVELLE', nouvelle.details));
    // La raison telle que la séance la rend, détails compris : son texte
    // est celui que l'avertissement affiche.
    const { raisons } = nouvelle.details.touchees.find(({ id }) => id === 'retenu');
    const exclusion = raisons.find(({ code }) => code === 'PARTICIPANT_EXCLU');
    expect(exclusion.participant).toBe(exclue);
    expect(element.textContent).toContain(t('PARTICIPANT_EXCLU', exclusion));
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Rouvraie' } });
    expect(m.seance.etat().charge.participants.length).toBe(NOMS.length + 1);
  });

  test('retenu : supprimer une table, réduire une capacité, ajouter une personne, chacun accepté, l’avertissement nommant les propositions touchées ; leur nombre inchangé ; un import, IMPORT_EN_RETENU', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    const propositions = m.seance.etat().charge.propositions.length;
    const [premiere, seconde] = m.seance.etat().charge.tables;
    const gestes = [
      ['supprimerTable', { id: premiere.id }],
      ['changerPlacesTable', { id: seconde.id, sieges: 2, origine: 'champ' }],
      ['ajouterParticipant', { champs: { nom: 'Escarbille' } }],
    ];
    for (const [nom, args] of gestes) {
      await m.seance.executer(nom, args);
      flushSync();
      const nouvelle = m.seance.etat().avertissements.find(({ code }) => code === 'DERIVE_NOUVELLE');
      expect(nouvelle, nom).toBeDefined();
      expect(nouvelle.details.touchees.length, nom).toBeGreaterThan(0);
      expect(avertissement(m, 'DERIVE_NOUVELLE').textContent).toContain(t('DERIVE_NOUVELLE', nouvelle.details));
      expect(m.seance.etat().charge.propositions.length).toBe(propositions);
    }
    const apercu = apercevoir('nom\nTilleraie\n', { participants: m.seance.etat().charge.participants });
    await m.seance.executer('importerParticipants', { apercu, mode: 'ajouter' });
    flushSync();
    expect(avertissement(m, 'IMPORT_EN_RETENU').textContent).toContain(t('IMPORT_EN_RETENU', {}));
  });
});

describe('la tête reste en place quand les annonces vont et viennent (§ 2.1, § 8.4)', () => {
  test('une dérive affichée, l’écriture refusée : « Bloqué » cliqué reste le même élément, et porte à côté de lui le refus ECRITURE', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    await m.seance.executer('changerTours', { tours: EVENEMENT.tours + 1 });
    flushSync();
    expect(avertissement(m, 'DERIVE_NOUVELLE')).not.toBeNull();
    m.fs.pannes.ecriture('documents');
    const avant = boutonEtat(m, 'bloque');
    avant.click();
    await attendre(() => expect(m.seance.etat().supportRompu).not.toBeNull());
    await viderFile(m);
    // Le support rompu fait passer les annonces sous la tête : le bouton du
    // geste reste celui qu'a reçu le clic, et le refus se pose à côté de lui.
    expect(boutonEtat(m, 'bloque')).toBe(avant);
    expect(avant.isConnected).toBe(true);
    await attendre(() => expect(refusPres(avant, 'ECRITURE')).not.toBeNull());
    expect(visible(refusPres(avant, 'ECRITURE'))).toBe(true);
  });

  test('le premier avertissement venu, le focus du clavier reste sur le bouton de la tête qui le portait', async () => {
    const m = await neuf();
    await garnir(m);
    await generer(m);
    expect(dans(m, '[data-annonces]')).toBeNull();
    const bouton = dans(m, '[data-commande="section"][data-cible="plan"]');
    bouton.focus();
    expect(document.activeElement).toBe(bouton);
    await m.seance.executer('changerTours', { tours: EVENEMENT.tours + 1 });
    flushSync();
    expect(avertissement(m, 'DERIVE_NOUVELLE')).not.toBeNull();
    expect(dans(m, '[data-commande="section"][data-cible="plan"]')).toBe(bouton);
    expect(document.activeElement).toBe(bouton);
  });
});

describe('le verrou d’une autre séance (§ 8.8)', () => {
  test('le second montage ouvre en lecture ; son « Modifier » est refusé, la séance et l’instant affichés ; le premier coupé, il reprend le verrou du mort', async () => {
    const premier = await neuf();
    await premier.seance.passerEnEcriture();
    const base = baseDe(premier);
    const tenu = JSON.parse(fichier(premier, SUFFIXES.verrou));
    const second = await monter({ systeme: { disque: premier.disque } });
    // Les deux montages s'empilent dans la page : le premier se cache, et
    // le second occupe la fenêtre.
    premier.racine.hidden = true;
    await second.seance.ouvrir(base);
    flushSync();
    expect(second.seance.etat().mode).toBe('lecture');
    expect(dans(second, '[data-refus]')).toBeNull();
    fixe(second, 'modifier').click();
    const refus = await attendre(() => {
      const element = refusPres(fixe(second, 'modifier'), 'VERROU_PRIS');
      expect(element).not.toBeNull();
      return element;
    });
    const pris = second.seance.etat().verrouAutre;
    expect(pris).toEqual({ seance: tenu.seance, depuis: tenu.depuis, vivant: true });
    expect(refus.textContent).toContain(t('VERROU_PRIS', { ...pris, remede: null }));
    const verrou = dans(second, '[data-verrou]');
    expect(visible(verrou)).toBe(true);
    expect(dans(second, '[data-verrou-seance]').textContent).toBe(tenu.seance);
    expect(dans(second, '[data-verrou-depuis]').textContent).toBe(tenu.depuis);
    expect(verrou.querySelector('[data-commande="reprendreVerrou"]')).toBeNull();
    premier.fs.pannes.couperApres(0);
    fixe(second, 'modifier').click();
    await attendre(() => expect(second.seance.etat().mode).toBe('ecriture'));
    const repris = avertissement(second, 'VERROU_REPRIS');
    expect(repris.textContent).toContain(t('VERROU_REPRIS', { seance: tenu.seance, depuis: tenu.depuis }));
    expect(JSON.parse(fichier(second, SUFFIXES.verrou)).seance).toBe(second.seance.id);
    expect(dans(second, '[data-verrou]')).toBeNull();
  });

  test('le verrou d’un autre poste : la reprise s’offre à côté du refus, se confirme en place en nommant la séance et l’instant, puis le reprend', async () => {
    const premier = await neuf();
    await premier.seance.passerEnEcriture();
    const base = baseDe(premier);
    const tenu = JSON.parse(fichier(premier, SUFFIXES.verrou));
    const second = await monter({ systeme: { disque: premier.disque, hote: 'poste-voisin' } });
    premier.racine.hidden = true;
    await second.seance.ouvrir(base);
    flushSync();
    fixe(second, 'modifier').click();
    await attendre(() => expect(refusPres(fixe(second, 'modifier'), 'VERROU_PRIS')).not.toBeNull());
    expect(second.seance.etat().verrouAutre.vivant).toBeNull();
    const verrou = dans(second, '[data-verrou]');
    expect(dans(second, '[data-verrou-seance]').textContent).toBe(tenu.seance);
    expect(dans(second, '[data-verrou-depuis]').textContent).toBe(tenu.depuis);
    const reprendre = () => dans(second, '[data-verrou] [data-commande="reprendreVerrou"]');
    expect(reprendre().textContent).toBe(t('communs.remede.reprendreVerrou'));
    expect(visible(reprendre())).toBe(true);
    const avant = second.trace.length;
    reprendre().click();
    flushSync();
    expect(reprendre().textContent).toBe(t('evenement.verrou.confirmerReprise'));
    expect(verrou.contains(reprendre())).toBe(true);
    expect(second.trace.length).toBe(avant);
    expect(second.seance.etat().mode).toBe('lecture');
    reprendre().click();
    await attendre(() => expect(second.seance.etat().mode).toBe('ecriture'));
    expect(JSON.parse(fichier(second, SUFFIXES.verrou)).seance).toBe(second.seance.id);
    expect(avertissement(second, 'VERROU_REPRIS').textContent).toContain(
      t('VERROU_REPRIS', { seance: tenu.seance, depuis: tenu.depuis }),
    );
    expect(dans(second, '[data-verrou]')).toBeNull();
  });
});

describe('le support rompu (§ 8.6, § 8.2)', () => {
  const message = (m) => dans(m, '[data-support-rompu]');
  const commandeListe = (m) => dans(m, '[data-bandeau] [data-commande="liste"]');

  // Le message offre exactement les issues noms, et chacune se voit au cadre
  // de l'épreuve : c'est la seule sortie de l'opérateur d'un support rompu.
  function issuesVisibles(m, noms) {
    const offertes = [...message(m).querySelectorAll('[data-commande]')].map((issue) => issue.dataset.commande);
    expect(offertes).toEqual(noms);
    for (const nom of noms) expect(visible(message(m).querySelector(`[data-commande="${nom}"]`)), nom).toBe(true);
  }

  // L'événement ouvert en écriture, puis le support de racine refuse
  // l'écriture d'un geste.
  async function rompre(m, racine) {
    fixe(m, 'modifier').click();
    await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
    m.fs.pannes.ecriture(racine);
    await expect(m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[0] } })).rejects.toMatchObject({ code: 'ECRITURE' });
    flushSync();
  }

  test('publié : le message nomme le fichier, le dossier et la rupture ; « Liste » est refusée ; « Écrire dans les Documents » y écrit, et la séance s’y poursuit', async () => {
    const m = await neuf({ systeme: { executable: 'E:\\soirees' } });
    expect(m.seance.etat().racine.id).toBe('portable');
    const base = baseDe(m);
    await rompre(m, 'portable');
    const rompu = m.seance.etat().supportRompu;
    expect(rompu.ailleurs).toEqual({ id: 'documents', chemin: DOCUMENTS });
    expect(visible(message(m))).toBe(true);
    const { ailleurs, ...details } = rompu;
    expect(message(m).textContent).toContain(t('SUPPORT_ROMPU', details));
    expect(message(m).textContent).toContain(rompu.chemin);
    expect(message(m).textContent).toContain(rompu.dossier);
    await expect(m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[1] } })).rejects.toMatchObject({
      code: 'SUPPORT_ROMPU',
    });
    // Le refus posé dans le bandeau ne déplace pas la place fixe, et ne la
    // couvre pas.
    const place = coin(fixe(m, 'lecture'));
    commandeListe(m).click();
    await attendre(() => expect(dans(m, '[data-refus="liste"] [data-refus="SUPPORT_ROMPU_NON_SAUVE"]')).not.toBeNull());
    expect(coin(fixe(m, 'lecture'))).toEqual(place);
    expect(visible(fixe(m, 'lecture'))).toBe(true);
    expect(visible(dans(m, '[data-refus="liste"]'))).toBe(true);
    // Le refus est un bloc : aucun <span> ne le contient (HTML valide).
    expect(dans(m, '[data-bandeau] span [data-refus="liste"]')).toBeNull();
    expect(m.seance.etat().evenement.base).toBe(base);
    issuesVisibles(m, ['ecrireDocuments', 'choisirDossier', 'abandonner']);
    message(m).querySelector('[data-commande="ecrireDocuments"]').click();
    await attendre(() => expect(m.seance.etat().supportRompu).toBeNull());
    // Le refus de « Liste » valait pour l'état d'avant : le changement
    // suivant de la séance l'efface.
    flushSync();
    expect(dans(m, '[data-refus="liste"]')).toBeNull();
    const nouvelle = baseDe(m);
    expect(m.fs.contenu('documents', `${nouvelle}${SUFFIXES.etat}`)).not.toBeNull();
    const entrees = journalDe(m, 'documents').entrees.length;
    await m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[2] } });
    expect(journalDe(m, 'documents').entrees.length).toBe(entrees + 1);
    expect(message(m)).toBeNull();
    commandeListe(m).click();
    await attendre(() => expect(ecran(m).dataset.ecran).toBe('accueil'));
    expect(m.seance.etat().racine.id).toBe('documents');
    await attendre(() => expect(dans(m, `[data-evenement="${nouvelle}"]`)).not.toBeNull());
    const dossier = dans(m, '[data-dossier-travail]');
    expect(dossier.textContent).toBe(DOCUMENTS);
    // La liste défile : le dossier de travail s'amène dans la fenêtre.
    dossier.scrollIntoView({ block: 'center' });
    expect(visible(dossier)).toBe(true);
  });

  test('non publié : le message n’offre que « Choisir un dossier… » ; le dialogue annulé ne change rien', async () => {
    const m = await neuf();
    await rompre(m, 'documents');
    expect(m.seance.etat().supportRompu.ailleurs).toBeNull();
    issuesVisibles(m, ['choisirDossier', 'abandonner']);
    const choisir = message(m).querySelector('[data-commande="choisirDossier"]');
    expect(choisir.textContent).toBe(t('communs.commande.choisirDossier'));
    const rompu = m.seance.etat().supportRompu;
    const avant = m.trace.length;
    choisir.click();
    flushSync();
    // Le geste commence, puis s'achève sur le dialogue annulé : on attend sa
    // fin avant de juger que rien n'a changé.
    expect(choisir.getAttribute('aria-busy')).toBe('true');
    await attendre(() => expect(choisir.hasAttribute('aria-busy')).toBe(false));
    expect(m.seance.etat().supportRompu).toEqual(rompu);
    expect(m.trace.length).toBe(avant);
    expect(visible(message(m))).toBe(true);
  });

  test('non publié, « Fermer sans écrire ailleurs », confirmé en place : la liste revient, sans aucune écriture', async () => {
    const m = await neuf();
    await rompre(m, 'documents');
    issuesVisibles(m, ['choisirDossier', 'abandonner']);
    const avant = m.trace.length;
    const abandonner = () => message(m).querySelector('[data-commande="abandonner"]');
    expect(abandonner().textContent).toBe(t('evenement.supportRompu.abandonner'));
    abandonner().click();
    flushSync();
    expect(abandonner().textContent).toBe(t('evenement.supportRompu.confirmerAbandon'));
    expect(m.seance.etat().evenement).not.toBeNull();
    abandonner().click();
    await attendre(() => expect(ecran(m).dataset.ecran).toBe('accueil'));
    expect(m.seance.etat().evenement).toBeNull();
    expect(m.trace.slice(avant).filter(([primitive]) => primitive !== 'deverrouiller')).toEqual([]);
  });

  test('non publié, un dossier choisi : état et journal y sont écrits, le geste suivant aussi, et la liste le suit', async () => {
    const m = await neuf({ systeme: { dossiersChoisis: ['D:\\Secours'] } });
    await rompre(m, 'documents');
    issuesVisibles(m, ['choisirDossier', 'abandonner']);
    message(m).querySelector('[data-commande="choisirDossier"]').click();
    await attendre(() => expect(m.seance.etat().supportRompu).toBeNull());
    expect(m.seance.etat().racine).toEqual({ id: 'choisi-1', chemin: 'D:\\Secours' });
    const base = baseDe(m);
    expect(m.fs.contenu('choisi-1', `${base}${SUFFIXES.etat}`)).not.toBeNull();
    const entrees = journalDe(m, 'choisi-1').entrees.length;
    await m.seance.executer('ajouterParticipant', { champs: { nom: NOMS[3] } });
    expect(journalDe(m, 'choisi-1').entrees.length).toBe(entrees + 1);
    commandeListe(m).click();
    await attendre(() => expect(ecran(m).dataset.ecran).toBe('accueil'));
    await attendre(() => expect(dans(m, `[data-evenement="${base}"]`)).not.toBeNull());
  });
});

describe('le format plus récent (§ 8.8)', () => {
  test('« Modifier » est remplacé par l’explication, et aucune commande de l’événement ne passe en écriture', async () => {
    const m = await neuf();
    const base = baseDe(m);
    await m.seance.fermer();
    const chemin = `${base}${SUFFIXES.etat}`;
    const texte = m.fs.contenu('documents', chemin);
    m.fs.deposer('documents', chemin, texte.replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`));
    await m.seance.ouvrir(base);
    flushSync();
    expect(fixe(m, 'modifier')).toBeNull();
    const explication = dans(m, '[data-place-fixe] [data-refus="LECTURE_SEULE"]');
    expect(explication.textContent).toContain(t('LECTURE_SEULE', { raison: 'FORMAT', remede: null }));
    expect(visible(explication)).toBe(true);
    // La bande sous le bandeau ne nomme aucune commande que la place fixe
    // n'offre pas.
    const bande = dans(m, '[data-ecran="evenement"] > [role="status"]');
    expect(bande).not.toBeNull();
    expect(bande.textContent).toContain(t('evenement.bande.lectureSeule'));
    for (const cle of ['communs.commande.modifier', 'communs.commande.debloquer']) expect(bande.textContent).not.toContain(t(cle));
    const avant = m.trace.length;
    const boutons = tous(m, '[data-ecran="evenement"] button').filter((bouton) => bouton.dataset.commande !== 'section');
    expect(boutons.length).toBeGreaterThan(0);
    for (const bouton of boutons) {
      if (!bouton.isConnected) continue;
      bouton.click();
      bouton.click();
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
    await attendre(() => expect(m.seance.etat().mode).toBe('lecture'));
    expect(m.trace.length).toBe(avant);
  });
});
