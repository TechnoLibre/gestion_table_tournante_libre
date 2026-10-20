// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La meilleure proposition en tête de la section de la génération, dans un
// vrai moteur de rendu (§ 5.4, § 5.7, § 14.5, § 14.6) : un bloc d'information
// qui nomme la proposition au rang 1 du classement et ses collisions
// cumulées, lues dans le tableau des propositions de la même épreuve ; les
// mots quand aucune ne se classe ; l'explication du libellé dans
// l'infobulle ; un bloc qui se lit en lecture, sur un plan bloqué et
// pendant un calcul ; son texte contrasté dans les deux thèmes.
//
// Chaque épreuve monte App par monterApp, sur le système de fichiers
// simulé, et nomme son exécuteur : le direct, ou un exécuteur que l'épreuve
// résout à la main pour garder un calcul en cours. Le rendu se lit par les
// attributs data-… ; le texte attendu vient de la même traduction que celle
// de l'application ; les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { creerFormat } from '../../application/format.js';
import { ErreurAnnulee, creerExecuteurDirect } from '../../application/generation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import {
  attenuations,
  contraste,
  couleurTexte,
  fondPeintSous,
  porteursDeTexte,
  sousTheme,
} from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { COLONNE_ANNONCEE } from './meilleure.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

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

// Un exécuteur que l'épreuve résout à la main : chaque lancer est relevé,
// avec resoudre(propositions).
function executeurAMain() {
  const executions = [];
  const executeur = {
    lancer(configuration, reglages) {
      let resoudre;
      let rejeter;
      const resultat = new Promise((ok, ko) => {
        resoudre = ok;
        rejeter = ko;
      });
      executions.push({ configuration, reglages, resoudre });
      return {
        surAvancement: () => () => undefined,
        resultat,
        annuler: () => rejeter(new ErreurAnnulee()),
      };
    },
  };
  return { executeur, executions };
}

// --- Les lectures du rendu ----------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const section = (m) => dans(m, '[data-section="generation"]');
const bloc = (m) => section(m)?.querySelector('[data-meilleure]') ?? null;
const vide = (m) => bloc(m)?.querySelector('[data-meilleure-vide]') ?? null;
const identifiant = (m) => bloc(m)?.querySelector('[data-meilleure-id]') ?? null;
const collisions = (m) => bloc(m)?.querySelector('[data-meilleure-collisions]') ?? null;
const terme = (m) => bloc(m)?.querySelector(`[data-terme="${COLONNE_ANNONCEE}"]`) ?? null;
const infobulle = (m) => section(m).querySelector('[role="tooltip"]');
const generer = (m) => section(m).querySelector('[data-commande="generer"]');
const charge = (m) => m.seance.etat().charge;

// Attend que l'assertion passe, le rendu de Svelte à jour, image après image.
async function attendre(assertion, images = 600) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= images) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// Attend que la file de la séance ait passé ce qui s'y trouve, puis le rendu.
async function passer(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  await new Promise((resoudre) => requestAnimationFrame(resoudre));
  flushSync();
}

// Le centre de la boîte rendue d'un élément, ramené dans la fenêtre.
function centre(element) {
  element.scrollIntoView({ block: 'center' });
  const { left, top, width, height } = element.getBoundingClientRect();
  return { x: left + width / 2, y: top + height / 2 };
}

// Un clic réel au centre de l'élément, puis la file de la séance passée.
async function cliquer(m, element) {
  expect(element, 'élément à cliquer').not.toBeNull();
  const { x, y } = centre(element);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await passer(m);
}

// Ce que le bloc annonce : l'identifiant et les collisions, tels qu'écrits.
const annonce = (m) => ({ id: identifiant(m).textContent, collisions: collisions(m).textContent });

// Ce que la section des propositions affiche au rang 1, l'en-tête de la
// colonne des collisions cumulées compris ; la section de la génération
// rouverte ensuite.
async function rangUnDuTableau(m) {
  m.ui.allerA('propositions');
  flushSync();
  const lu = await attendre(() => {
    const ligne = dans(m, '[data-section="propositions"] tbody[data-classement] tr[data-proposition]');
    expect(ligne, 'la ligne au rang 1').not.toBeNull();
    expect(ligne.querySelector('[data-colonne="rang"]').textContent).toBe(format.nombre(1));
    return {
      id: ligne.querySelector('[data-colonne="proposition"] .identifiant').textContent,
      collisions: ligne.querySelector('[data-colonne="collisionsCumulees"]').textContent,
      entete: dans(m, '[data-section="propositions"] thead th[data-colonne="collisionsCumulees"]').textContent,
      idAttribut: ligne.getAttribute('data-proposition'),
    };
  });
  m.ui.allerA('generation');
  flushSync();
  return lu;
}

// La petite démonstration chargée, en écriture sauf ecriture faux, la
// section de la génération ouverte.
async function demonstration(cle, { executeur = creerExecuteurDirect(), ecriture = true } = {}) {
  const m = await monter({ executeur });
  await m.facade.chargerDemonstration(cle);
  if (ecriture) await m.seance.passerEnEcriture();
  m.ui.allerA('generation');
  flushSync();
  return m;
}

// Une génération du moteur de plus, enregistrée par la séance.
async function enregistrer(m, reglages) {
  const configuration = configurationDepuisCharge(charge(m));
  const propositions = rechercher(configuration, { historique: 1000, ...reglages });
  await m.seance.executer('enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee });
  flushSync();
}

// --- Les épreuves -----------------------------------------------------------------

describe('la meilleure proposition, en tête de la génération (§ 5.4, § 5.7)', () => {
  test('événement sans proposition : un bloc titré en tête de la section dit en mots qu’aucune proposition n’est classée', async () => {
    const m = await demonstration('petite');
    expect(charge(m).propositions).toEqual([]);
    const region = bloc(m);
    expect(region).not.toBeNull();
    // En tête : avant tout réglage et avant « Générer ».
    const premierChamp = section(m).querySelector('input');
    expect(premierChamp).not.toBeNull();
    expect(region.compareDocumentPosition(premierChamp) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region.compareDocumentPosition(generer(m)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(region.getBoundingClientRect().bottom).toBeLessThanOrEqual(premierChamp.getBoundingClientRect().top);
    // Une région nommée par son titre.
    const titre = document.getElementById(region.getAttribute('aria-labelledby'));
    expect(titre?.textContent).toBe(t('generation.meilleure.titre'));
    expect(region.contains(titre)).toBe(true);
    expect(vide(m)?.textContent).toBe(t('generation.meilleure.aucune'));
    expect(identifiant(m)).toBeNull();
    expect(collisions(m)).toBeNull();
    expect(region.textContent).not.toContain(t('format.vide'));
  });

  test('après une génération : la proposition et ses collisions cumulées égalent le rang 1 du tableau des propositions ; une génération de plus les relit', async () => {
    const m = await demonstration('petite-conflit');
    expect(vide(m)).not.toBeNull();
    await m.seance.executer('modifierReglage', { cle: 'generation.nombre', valeur: 3 });
    await m.seance.executer('modifierReglage', { cle: 'generation.arret', valeur: 300 });
    flushSync();
    await cliquer(m, generer(m));
    await attendre(() => expect(charge(m).propositions.length).toBe(3));
    await attendre(() => expect(collisions(m)).not.toBeNull());
    expect(vide(m)).toBeNull();
    const premiere = annonce(m);
    const tableau = await rangUnDuTableau(m);
    expect(premiere).toEqual({ id: tableau.id, collisions: tableau.collisions });
    expect(premiere.id).toBe(format.nombre(Number(tableau.idAttribut)));
    expect(premiere.collisions).toMatch(/\d/);
    // Le libellé est l'en-tête de la colonne du tableau.
    expect(terme(m).textContent).toBe(tableau.entete);
    expect(COLONNE_ANNONCEE).toBe('collisionsCumulees');
    expect(terme(m).textContent).toBe(t('propositions.colonne.collisionsCumulees'));
    expect(bloc(m).querySelector('[data-meilleure-libelle-id]').textContent).toBe(t('generation.meilleure.proposition'));

    // Une seconde génération, sous la graine suivante : six propositions,
    // et le bloc relit le rang 1 du nouveau classement.
    await cliquer(m, generer(m));
    await attendre(() => expect(charge(m).propositions.length).toBe(6));
    const seconde = await attendre(() => annonce(m));
    const tableau2 = await rangUnDuTableau(m);
    expect(seconde).toEqual({ id: tableau2.id, collisions: tableau2.collisions });
  });

  test('effacer les propositions ramène les mots ; le rang 1 se relit à chaque charge écrite', async () => {
    const m = await demonstration('petite-conflit');
    await enregistrer(m, { graine: 5, nombre: 2, arret: 300 });
    await attendre(() => expect(collisions(m)).not.toBeNull());
    const tableau = await rangUnDuTableau(m);
    expect(annonce(m)).toEqual({ id: tableau.id, collisions: tableau.collisions });
    await m.seance.executer('effacerPropositions', {});
    flushSync();
    expect(charge(m).propositions).toEqual([]);
    await attendre(() => expect(vide(m)?.textContent).toBe(t('generation.meilleure.aucune')));
    expect(collisions(m)).toBeNull();
    expect(identifiant(m)).toBeNull();
  });

  test('aucune comparable — une personne exclue après la génération — : les mots, comme sans proposition', async () => {
    const m = await demonstration('petite');
    await enregistrer(m, { graine: 3, nombre: 2, arret: 300 });
    await attendre(() => expect(collisions(m)).not.toBeNull());
    await m.seance.executer('exclureParticipant', { id: charge(m).participants[0].id });
    flushSync();
    expect(charge(m).propositions.length).toBe(2);
    await attendre(() => expect(vide(m)?.textContent).toBe(t('generation.meilleure.aucune')));
    expect(collisions(m)).toBeNull();
  });

  test('l’infobulle du libellé : au survol réel et au focus du clavier, l’explication de la colonne du tableau ; Échap et la sortie la referment', async () => {
    const m = await demonstration('petite-conflit');
    await enregistrer(m, { graine: 5, nombre: 1, arret: 300 });
    const libelle = await attendre(() => {
      expect(terme(m)).not.toBeNull();
      return terme(m);
    });
    const bulle = infobulle(m);
    expect(bulle).not.toBeNull();
    expect(bulle.hidden).toBe(true);
    expect(libelle.hasAttribute('aria-describedby')).toBe(false);

    const { x, y } = centre(libelle);
    await pointer('bouger', x, y);
    await attendre(() => {
      expect(bulle.hidden).toBe(false);
      expect(getComputedStyle(bulle).visibility).toBe('visible');
      expect(bulle.getBoundingClientRect().width).toBeGreaterThan(0);
    });
    expect(bulle.textContent).toBe(t('propositions.explication.collisionsCumulees'));
    expect(libelle.getAttribute('aria-describedby')).toBe(bulle.id);
    // L'infobulle ne couvre pas le terme qu'elle explique.
    const a = libelle.getBoundingClientRect();
    const b = bulle.getBoundingClientRect();
    expect(b.top >= a.bottom || b.bottom <= a.top).toBe(true);

    await pointer('bouger', 2, 2);
    await attendre(() => expect(bulle.hidden).toBe(true));
    expect(libelle.hasAttribute('aria-describedby')).toBe(false);

    // Au clavier : le terme se focalise, l'infobulle s'ouvre ; Échap la
    // referme, le focus restant sur le terme.
    libelle.focus();
    flushSync();
    expect(document.activeElement).toBe(libelle);
    await attendre(() => expect(bulle.hidden).toBe(false));
    expect(bulle.textContent).toBe(t('propositions.explication.collisionsCumulees'));
    await touche('Escape');
    await attendre(() => expect(bulle.hidden).toBe(true));
    expect(document.activeElement).toBe(libelle);
  });

  test('en lecture, sur un plan bloqué et pendant un calcul : le bloc se lit, et rien ne s’écrit pour lui', async () => {
    const { executeur, executions } = executeurAMain();
    const m = await demonstration('petite-conflit', { executeur });
    await enregistrer(m, { graine: 5, nombre: 2, arret: 300 });
    const attendu = await rangUnDuTableau(m);
    const lu = () => ({ id: attendu.id, collisions: attendu.collisions });

    await m.seance.passerEnLecture();
    flushSync();
    expect(m.seance.etat().mode).toBe('lecture');
    const ecritures = m.trace.length;
    await attendre(() => expect(annonce(m)).toEqual(lu()));
    expect(m.trace.length).toBe(ecritures);

    await m.seance.passerEnEcriture();
    await m.seance.executer('retenirProposition', { id: charge(m).propositions[1].id });
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    expect(m.seance.etat().refus?.details.raison).toBe('BLOQUE');
    await attendre(() => expect(annonce(m)).toEqual(lu()));

    // Pendant un calcul : le classement tel qu'il est.
    await m.seance.debloquer();
    flushSync();
    expect(m.seance.etat().refus).toBeNull();
    await cliquer(m, generer(m));
    await attendre(() => expect(executions.length).toBe(1));
    expect(section(m).getAttribute('aria-busy')).toBe('true');
    expect(annonce(m)).toEqual(lu());
    m.app.generation().annuler();
    await attendre(() => expect(section(m).getAttribute('aria-busy')).toBe('false'));
  });

  test('le texte du bloc tient 4,5:1 sur son fond, sans atténuation, dans les deux thèmes, avec et sans proposition', async () => {
    const m = await demonstration('petite-conflit');
    const mesurer = async (etat) => {
      for (const theme of ['clair', 'sombre']) {
        await sousTheme(theme, async () => {
          flushSync();
          bloc(m).scrollIntoView({ block: 'center' });
          const porteurs = porteursDeTexte(bloc(m));
          expect(porteurs.length, `${etat}, ${theme} : porteurs de texte`).toBeGreaterThan(0);
          for (const porteur of porteurs) {
            expect(attenuations(porteur), `${etat}, ${theme}`).toEqual([]);
            const couleur = couleurTexte(porteur);
            const fonds = fondPeintSous(porteur);
            expect(fonds.length, `${etat}, ${theme} : fond`).toBeGreaterThan(0);
            for (const fond of fonds) expect(contraste(couleur, fond), `${etat}, ${theme}`).toBeGreaterThanOrEqual(4.5);
          }
        });
      }
    };
    await mesurer('sans proposition');
    await enregistrer(m, { graine: 5, nombre: 1, arret: 300 });
    await attendre(() => expect(collisions(m)).not.toBeNull());
    await mesurer('avec proposition');
  });
});
