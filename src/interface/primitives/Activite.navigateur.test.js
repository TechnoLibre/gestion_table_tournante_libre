// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'indicateur d'activité dans un vrai moteur de rendu (§ 5.10, § 14.5,
// § 19.2) : la pastille « Traitement en cours… », absente au repos, est
// montée et peinte avant que l'opération suivie ne parte — une image qui la
// porte rendue, ses animations en cours —, invisible pendant sa première
// demi-seconde, et retirée à la fin, réussie ou non. Son apparition est une
// animation d'opacité en un seul pas, son signe tourne, sauf sous la
// préférence de mouvement réduit. Montée par App, elle est là quand une
// opération longue part — ouvrir un événement ou une version de secours,
// charger une démonstration, défaire ou refaire, au clavier comme au clic,
// revenir à un instant, appliquer un import, le bilan de « Remplacer »,
// l'ouverture de la section de l'impression, la planche de badges, écrire
// ailleurs, la fin d'une génération —, et jamais pour un geste ordinaire du
// plan. Le curseur d'attente couvre l'application tant qu'elle est là, et
// un geste fait pendant l'attente de sa peinture atteint la séance après
// l'opération qui l'attend.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync, mount, unmount } from 'svelte';
import '../jetons.css';
import { creerExecuteurDirect } from '../../application/generation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { ErreurStockage } from '../../stockage/erreurs.js';
import { SUFFIXES } from '../../stockage/noms.js';
import {
  BASE,
  attendre,
  chargeBloquee,
  chargePrincipale,
  chargeRetenuAjuste,
  chargerResumes,
  cliquer,
  creerContexte,
  fichierEtat,
  fichierReglages,
  ouvrirEvenement,
} from '../../../test/navigateur/ecrans.js';
import { touche } from '../../../test/navigateur/entrees.js';
import { attenuations, composantes, contraste, couleurTexte, fondPeintSous, sousTheme } from '../../../test/navigateur/rendu.js';
import { imagePeinte, suivre } from '../activite.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Activite from './Activite.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const LIBELLE = t('communs.activite');

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

// Une promesse que l'épreuve règle.
function tenue() {
  let resoudre;
  let rejeter;
  const promesse = new Promise((ok, ko) => {
    resoudre = ok;
    rejeter = ko;
  });
  return { promesse, resoudre, rejeter };
}

// Les images rendues depuis le début de l'épreuve, qu'une boucle de
// requestAnimationFrame compte, et, pour chaque pastille montée, le compte
// à son montage, qu'un MutationObserver relève dans la microtâche même de
// l'insertion. Deux rappels d'image après le montage prouvent la première
// image qui la porte rendue : le second rappel n'arrive qu'après elle.
let images = 0;
let boucle = null;
let observateur = null;
const montees = new WeakMap();
beforeEach(() => {
  images = 0;
  const compter = () => {
    images += 1;
    boucle = requestAnimationFrame(compter);
  };
  boucle = requestAnimationFrame(compter);
  observateur = new MutationObserver((mutations) => {
    for (const { addedNodes } of mutations) {
      for (const noeud of addedNodes) {
        if (!(noeud instanceof Element)) continue;
        for (const pastille of [noeud, ...noeud.querySelectorAll('[data-activite]')]) {
          if (pastille.matches('[data-activite]')) montees.set(pastille, images);
        }
      }
    }
  });
  observateur.observe(document.body, { childList: true, subtree: true });
});
afterEach(() => {
  cancelAnimationFrame(boucle);
  observateur.disconnect();
});

// Ce que la pastille montre dans racine, à l'instant de l'appel : sa
// présence, son rôle, son texte, son style calculé, le nombre de ses
// animations en cours, et si une image qui la porte est rendue.
function releverPastille(racine) {
  const pastille = racine.querySelector('[data-activite]');
  if (pastille === null) return { presente: false };
  const style = getComputedStyle(pastille);
  const animations = pastille.getAnimations({ subtree: true }).filter((animation) => animation.playState === 'running');
  return {
    presente: true,
    role: pastille.getAttribute('role'),
    texte: pastille.textContent.trim(),
    opacite: style.opacity,
    delai: style.animationDelay,
    animations: animations.length,
    peinte: montees.has(pastille) && images - montees.get(pastille) >= 2,
  };
}

const PEINTE = { presente: true, role: 'status', texte: LIBELLE, opacite: '0', delai: '0.5s', animations: 2, peinte: true };

// --- La pastille seule ------------------------------------------------------------

describe('la pastille d’activité, montée seule (§ 5.10, § 19.2)', () => {
  const montes = [];
  afterEach(() => {
    for (const { composant, cible } of montes.splice(0)) {
      unmount(composant);
      cible.remove();
    }
  });

  function monter() {
    const cible = document.createElement('div');
    document.body.prepend(cible);
    const composant = mount(Activite, { target: cible, context: new Map([['t', t]]) });
    flushSync();
    montes.push({ composant, cible });
    return cible;
  }

  test('au repos, la pastille est absente du DOM', () => {
    const cible = monter();
    expect(cible.querySelector('[data-activite]')).toBeNull();
    expect(cible.textContent).toBe('');
  });

  test('l’opération part pastille peinte : role="status", son libellé, opacité 0 sous un délai de 500 ms, ses deux animations en cours ; retirée à la fin', async () => {
    const cible = monter();
    const fin = tenue();
    let vue = null;
    const operation = suivre(() => {
      vue = releverPastille(cible);
      return fin.promesse;
    });
    try {
      expect(vue).toBeNull();
      await attendre('le départ de l’opération', () => vue !== null);
      expect(vue).toEqual(PEINTE);
      const pastille = cible.querySelector('[data-activite]');
      // Un seul pas, de 0 à 1, au terme du délai : aucune opacité partielle.
      const [apparition] = pastille.getAnimations();
      expect(apparition.effect.getTiming().delay).toBe(500);
      expect(getComputedStyle(pastille).animationTimingFunction).toBe('steps(1)');
      apparition.currentTime = 499;
      expect(getComputedStyle(pastille).opacity).toBe('0');
      apparition.finish();
      expect(getComputedStyle(pastille).opacity).toBe('1');
      // Le signe tourne sans fin.
      const signe = pastille.querySelector('svg');
      const [rotation] = signe.getAnimations();
      expect(rotation.effect.getTiming().iterations).toBe(Infinity);
      expect(getComputedStyle(signe).animationName).not.toBe('none');
    } finally {
      fin.resoudre('rendu');
    }
    expect(await operation).toBe('rendu');
    flushSync();
    expect(cible.querySelector('[data-activite]')).toBeNull();
  });

  test('un échec retire la pastille, et l’erreur remonte telle quelle', async () => {
    const cible = monter();
    const erreur = new Error('panne inventée');
    let vue = null;
    const operation = suivre(() => {
      vue = releverPastille(cible);
      throw erreur;
    });
    await expect(operation).rejects.toBe(erreur);
    expect(vue.presente).toBe(true);
    flushSync();
    expect(cible.querySelector('[data-activite]')).toBeNull();
  });

  test('deux opérations qui se chevauchent : une seule pastille, retirée à la fin de la dernière', async () => {
    const cible = monter();
    const premiere = tenue();
    const seconde = tenue();
    const a = suivre(() => premiere.promesse);
    const b = suivre(() => seconde.promesse);
    try {
      flushSync();
      expect(cible.querySelectorAll('[data-activite]').length).toBe(1);
      premiere.resoudre();
      await a;
      flushSync();
      expect(cible.querySelectorAll('[data-activite]').length).toBe(1);
    } finally {
      premiere.resoudre();
      seconde.resoudre();
    }
    await b;
    flushSync();
    expect(cible.querySelector('[data-activite]')).toBeNull();
  });

  test('sous prefers-reduced-motion: reduce, la pastille apparaît encore au bout du délai, mais son signe ne tourne pas', async () => {
    const cible = monter();
    const fin = tenue();
    await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    let operation = null;
    try {
      expect(matchMedia('(prefers-reduced-motion: reduce)').matches).toBe(true);
      let vue = null;
      operation = suivre(() => {
        vue = releverPastille(cible);
        return fin.promesse;
      });
      await attendre('le départ de l’opération', () => vue !== null);
      expect(vue).toEqual({ ...PEINTE, animations: 1 });
      const signe = cible.querySelector('[data-activite] svg');
      expect(getComputedStyle(signe).animationName).toBe('none');
      expect(signe.getAnimations()).toEqual([]);
    } finally {
      fin.resoudre();
      await operation;
      await cdp().send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: '' }] });
    }
  });

  test('la pastille se lit : son texte tient 4,5:1 et son signe 3:1 sur ce qui est peint dessous, dans les deux thèmes, sans atténuation une fois apparue', async () => {
    const cible = monter();
    const fin = tenue();
    const operation = suivre(() => fin.promesse);
    await attendre('la pastille', () => cible.querySelector('[data-activite]'));
    await uneImage();
    const pastille = cible.querySelector('[data-activite]');
    for (const animation of pastille.getAnimations()) animation.finish();
    const texte = pastille.querySelector('span');
    const trace = pastille.querySelector('path');
    try {
      for (const theme of ['clair', 'sombre']) {
        await sousTheme(theme, async () => {
          expect(attenuations(texte), theme).toEqual([]);
          expect(attenuations(trace), theme).toEqual([]);
          for (const fond of fondPeintSous(texte)) {
            expect(contraste(couleurTexte(texte), fond), `${theme} : texte sur ${fond.join(', ')}`).toBeGreaterThanOrEqual(4.5);
          }
          const couleur = composantes(getComputedStyle(trace).stroke);
          const autour = fondPeintSous(trace.ownerSVGElement);
          expect(autour.length, theme).toBeGreaterThan(0);
          for (const fond of autour) expect(contraste(couleur, fond), `${theme} : signe sur ${fond.join(', ')}`).toBeGreaterThanOrEqual(3);
        });
      }
    } finally {
      fin.resoudre();
      await operation;
    }
  });
});

// --- La pastille dans l'application -------------------------------------------------

describe('la pastille d’activité dans l’application : les opérations longues, et elles seules (§ 5.10)', () => {
  let contexte = null;
  afterEach(async () => {
    const erreurs = contexte?.erreurs() ?? [];
    await contexte?.defaire();
    contexte = null;
    expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
  });

  // Remplace la méthode nom de cible par une enveloppe qui relève la
  // pastille du montage à l'appel, avant le premier bloc de la méthode, puis
  // l'appelle ; rend les relevés et, une fois l'appel réglé, fini.
  function guetter(m, cible, nom) {
    const releves = { vues: [], fini: false };
    const methode = cible[nom];
    cible[nom] = async (...args) => {
      releves.vues.push(releverPastille(m.racine));
      try {
        return await methode.apply(cible, args);
      } finally {
        releves.fini = true;
      }
    };
    return releves;
  }

  // Relève chaque pastille ajoutée sous racine, jusqu'à arreter().
  function observerAjouts(racine) {
    const ajoutees = [];
    const observateur = new MutationObserver((mutations) => {
      for (const { addedNodes } of mutations) {
        for (const noeud of addedNodes) {
          if (noeud instanceof Element && (noeud.matches('[data-activite]') || noeud.querySelector('[data-activite]') !== null)) ajoutees.push(noeud);
        }
      }
    });
    observateur.observe(racine, { childList: true, subtree: true });
    return {
      ajoutees,
      arreter: () => {
        for (const { addedNodes } of observateur.takeRecords()) {
          for (const noeud of addedNodes) if (noeud instanceof Element && noeud.matches('[data-activite]')) ajoutees.push(noeud);
        }
        observateur.disconnect();
      },
    };
  }

  test('ouvrir un événement de la liste : la pastille est peinte quand la séance ouvre, puis retirée sur l’écran de l’événement', async () => {
    contexte = creerContexte();
    const m = await contexte.monter({ fichiers: [fichierEtat(chargePrincipale())] });
    await chargerResumes(m);
    expect(m.racine.querySelector('[data-activite]')).toBeNull();
    const releves = guetter(m, m.seance, 'ouvrir');
    await cliquer(m, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
    await attendre('l’écran de l’événement', () => releves.fini && m.racine.querySelector('[data-ecran="evenement"]'));
    expect(releves.vues).toEqual([PEINTE]);
    flushSync();
    expect(m.racine.querySelector('[data-activite]')).toBeNull();
  });

  test('une ouverture refusée retire la pastille : l’accueil reste, sans elle', async () => {
    contexte = creerContexte();
    const m = await contexte.monter({ fichiers: [fichierEtat(chargePrincipale())] });
    await chargerResumes(m);
    const releves = guetter(m, m.seance, 'ouvrir');
    const lireTexte = m.fs.lireTexte;
    m.fs.lireTexte = (racine, chemin) =>
      chemin === `${BASE}/${BASE}${SUFFIXES.etat}`
        ? Promise.reject(new ErreurStockage('LECTURE', { chemin, cause: 'EIO' }))
        : lireTexte.call(m.fs, racine, chemin);
    try {
      await cliquer(m, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
      await attendre('la fin de l’ouverture', () => releves.fini);
    } finally {
      m.fs.lireTexte = lireTexte;
    }
    expect(releves.vues[0].presente).toBe(true);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
    expect(m.racine.querySelector('[data-ecran="evenement"]')).toBeNull();
  });

  test('ouvrir la version précédente depuis la récupération : la pastille est peinte quand la séance ouvre le secours, puis retirée sur l’écran de l’événement', async () => {
    contexte = creerContexte();
    const sain = fichierEtat(chargePrincipale());
    const tronque = { ...sain, texte: sain.texte.slice(0, Math.floor(sain.texte.length / 2)) };
    const m = await contexte.monter({ fichiers: [tronque, { ...sain, chemin: `${BASE}/${BASE}${SUFFIXES.precedent}` }] });
    await chargerResumes(m);
    await cliquer(m, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
    await attendre('la récupération', () => m.racine.querySelector('[data-ecran="recuperation"]'));
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
    const releves = guetter(m, m.seance, 'ouvrirSecours');
    await cliquer(m, '[data-secours="precedent"] [data-commande]');
    await attendre('l’écran de l’événement', () => releves.fini && m.racine.querySelector('[data-ecran="evenement"]'));
    expect(releves.vues).toEqual([PEINTE]);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
  });

  test('le remède « Ouvrir la version précédente » d’un retenu fautif : la pastille est peinte quand la séance ouvre le secours', async () => {
    contexte = creerContexte();
    const retenue = chargeRetenuAjuste();
    const sain = fichierEtat(retenue);
    retenue.retenu.placement.pop();
    const fichiers = [fichierEtat(retenue), { ...sain, chemin: `${BASE}/${BASE}${SUFFIXES.precedent}` }];
    const m = await contexte.monter({ fichiers });
    await chargerResumes(m);
    await cliquer(m, `[data-evenement="${BASE}/${BASE}"] [data-commande="ouvrir"]`);
    const remede = await attendre('le remède', () => m.racine.querySelector('[data-avertissement="RETENU_FAUTIF"] [data-commande="ouvrirSecours"]'));
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
    const releves = guetter(m, m.seance, 'ouvrirSecours');
    remede.click();
    await attendre('la fin de l’ouverture', () => releves.fini);
    expect(releves.vues).toEqual([PEINTE]);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
  });

  test('charger une démonstration : la pastille est peinte quand la façade charge', async () => {
    contexte = creerContexte();
    const m = await contexte.monter();
    const releves = guetter(m, m.facade, 'chargerDemonstration');
    const bouton = await attendre('une démonstration', () => m.racine.querySelector('[data-demonstration]'));
    bouton.click();
    await attendre('la fin du chargement', () => releves.fini);
    expect(releves.vues).toEqual([PEINTE]);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
  });

  test('Ctrl+Z défait sous la pastille : peinte quand la séance défait, retirée ensuite', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'tables' });
    await m.seance.executer('creerTable', { forme: 'ronde' });
    flushSync();
    const releves = guetter(m, m.seance, 'defaire');
    await touche('z', { ctrl: true });
    await attendre('la fin du retour', () => releves.fini);
    expect(releves.vues).toEqual([PEINTE]);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
  });

  test('en lecture, Ctrl+Z passe aussi sous la pastille : la séance le refuse, le refus s’affiche et la pastille se retire', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'tables' });
    const releves = guetter(m, m.seance, 'defaire');
    const touchePrise = !document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));
    expect(touchePrise).toBe(true);
    await attendre('le refus', () => releves.fini && m.racine.querySelector('[data-historique] [data-refus="MODE_LECTURE"]'));
    expect(releves.vues).toEqual([PEINTE]);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
  });

  // Le nombre de participants et de tables de l'événement ouvert.
  const comptes = (m) => {
    const { participants, tables } = m.seance.etat().charge;
    return { participants: participants.length, tables: tables.length };
  };

  // Attend la fin des opérations suivies, puis de la file de la séance.
  async function apaiser(m) {
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
    await m.seance.attendre();
    flushSync();
  }

  const tableRonde = (m) => m.racine.querySelector('[data-section="tables"] [data-commande="creerTableRonde"]');
  const ctrlZ = () => document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true }));

  test('Ctrl+Z puis, aussitôt, « Table ronde » : le retour défait le geste d’avant, et la table s’ajoute après lui', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'tables' });
    const avant = comptes(m);
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Quillard', prenom: 'Ombeline' } });
    flushSync();
    expect(ctrlZ()).toBe(false);
    tableRonde(m).click();
    await apaiser(m);
    expect(comptes(m)).toEqual({ participants: avant.participants, tables: avant.tables + 1 });
  });

  test('« Revenir » puis, aussitôt, « Table ronde » : l’instant visé revient, et la table s’ajoute après lui', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'tables' });
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Quillard', prenom: 'Ombeline' } });
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Brac', prenom: 'Ysaure' } });
    const avant = comptes(m);
    flushSync();
    m.racine.querySelector('[data-mode] [data-historique] [data-commande="historique"]').click();
    const [, visee] = await attendre('le panneau d’historique', () => {
      const lignes = [...m.racine.querySelectorAll('[data-panneau="historique"] li[data-revision]')];
      return lignes.length >= 2 && lignes;
    });
    const releves = guetter(m, m.seance, 'revenir');
    visee.querySelector('[data-commande="revenir"]').click();
    tableRonde(m).click();
    await apaiser(m);
    expect(releves.vues).toEqual([PEINTE]);
    expect(comptes(m)).toEqual({ participants: avant.participants - 1, tables: avant.tables + 1 });
  });

  // Chaque relevé de releves est la pastille peinte : au moins un appel.
  const peinteAChaqueAppel = (releves) => {
    expect(releves.vues.length).toBeGreaterThan(0);
    expect(releves.vues).toEqual(releves.vues.map(() => PEINTE));
  };

  // Clique le sélecteur sous la racine du montage, sans attendre.
  const clic = (m, selecteur) => m.racine.querySelector(selecteur).click();

  test('pendant une opération suivie, le curseur d’attente couvre l’application et ses éléments ; il s’en va avec elle', async () => {
    contexte = creerContexte();
    const m = await contexte.monter();
    const app = m.racine.querySelector('.app');
    const commande = m.racine.querySelector('[data-commande]');
    expect(getComputedStyle(app).cursor).toBe('auto');
    const fin = tenue();
    const operation = suivre(() => fin.promesse);
    try {
      await attendre('la pastille', () => m.racine.querySelector('[data-activite]'));
      expect(getComputedStyle(app).cursor).toBe('progress');
      expect(getComputedStyle(commande).cursor).toBe('progress');
    } finally {
      fin.resoudre();
    }
    await operation;
    flushSync();
    expect(getComputedStyle(app).cursor).toBe('auto');
  });

  test('« Défaire » puis « Refaire », cliqués : la pastille est peinte quand la séance défait, puis refait', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'tables' });
    await m.seance.executer('creerTable', { forme: 'ronde' });
    flushSync();
    const defaits = guetter(m, m.seance, 'defaire');
    clic(m, '[data-mode] [data-historique] [data-commande="defaire"]');
    await apaiser(m);
    expect(defaits.vues).toEqual([PEINTE]);
    const refaits = guetter(m, m.seance, 'refaire');
    await attendre('« Refaire »', () => m.racine.querySelector('[data-mode] [data-historique] [data-commande="refaire"]'));
    clic(m, '[data-mode] [data-historique] [data-commande="refaire"]');
    await apaiser(m);
    expect(refaits.vues).toEqual([PEINTE]);
  });

  test('l’onglet « Impression » : la pastille est peinte quand la section s’ouvre, l’aperçu monté sous elle', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'tables', options: { fichiers: [fichierReglages('A4')] } });
    const releves = guetter(m, m.ui, 'allerA');
    clic(m, '[data-ecran="evenement"] [data-commande="section"][data-cible="badges"]');
    await attendre('l’aperçu', () => releves.fini && m.racine.querySelector('[data-apercu-impression]'));
    expect(releves.vues).toEqual([PEINTE]);
    await attendre('le retrait de la pastille', () => m.racine.querySelector('[data-activite]') === null);
  });

  test('importer un CSV : la pastille est peinte quand la séance l’applique ; sous « Remplacer », elle se monte aussi pour le bilan d’avant la fenêtre', async () => {
    const csv = (texte) => ({ nom: 'invites.csv', octets: Uint8Array.from([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(texte)]) });
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), {
      ecriture: true,
      section: 'import',
      options: { aImporter: [csv('nom;prenom\r\nQuillard;Ombeline\r\n'), csv('nom;prenom\r\nBrac;Ysaure\r\n')] },
    });
    const apercu = () => m.racine.querySelector('[data-section="import"] [data-apercu] [data-fichier]');
    clic(m, '[data-section="import"] [data-commande="choisirFichier"]');
    await attendre('l’aperçu du premier fichier', apercu);
    const ajout = guetter(m, m.seance, 'executer');
    clic(m, '[data-section="import"] [data-commande="importer"]');
    await attendre('le rapport', () => ajout.fini && m.racine.querySelector('[data-section="import"] [data-rapport]'));
    peinteAChaqueAppel(ajout);
    await apaiser(m);

    clic(m, '[data-section="import"] [data-commande="choisirFichier"]');
    await attendre('l’aperçu du second fichier', apercu);
    clic(m, '[data-section="import"] [data-champ="mode"] input[value="remplacer"]');
    flushSync();
    const observation = observerAjouts(m.racine);
    try {
      clic(m, '[data-section="import"] [data-commande="importer"]');
      await attendre('la fenêtre de « Remplacer »', () => m.racine.querySelector('[data-section="import"] dialog')?.open);
    } finally {
      observation.arreter();
    }
    expect(observation.ajoutees.length).toBe(1);
    const remplacement = guetter(m, m.seance, 'executer');
    clic(m, '[data-section="import"] dialog [data-commande="confirmer"]');
    await attendre('le rapport du remplacement', () => remplacement.fini);
    peinteAChaqueAppel(remplacement);
    await apaiser(m);
  });

  test('la planche de badges : préparer, produire et « Enregistrer sous… » se font pastille peinte', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargeBloquee(), { section: 'badges', options: { fichiers: [fichierReglages('A4')] } });
    const preparees = guetter(m, m.seance, 'preparerPlanche');
    clic(m, '[data-section="badges"] [data-commande="preparerPlanche"]');
    await attendre('l’annonce', () => preparees.fini && m.racine.querySelector('[data-section="badges"] [data-annonce-planche]'));
    peinteAChaqueAppel(preparees);
    await apaiser(m);
    m.fs.pannes.ecriture('documents');
    m.fs.enregistrerSous = async () => '/ailleurs/planche.pdf';
    const produites = guetter(m, m.seance, 'produirePlanche');
    clic(m, '[data-section="badges"] [data-commande="produirePlanche"]');
    await attendre('le refus d’écriture', () => m.racine.querySelector('[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    peinteAChaqueAppel(produites);
    await apaiser(m);
    const enregistrees = guetter(m, m.seance, 'enregistrerPlancheSous');
    clic(m, '[data-refus="PLANCHE_NON_ECRITE"] [data-commande="enregistrerSous"]');
    await attendre('le chemin choisi', () => enregistrees.fini && m.racine.querySelector('[data-chemin-planche]'));
    peinteAChaqueAppel(enregistrees);
    await apaiser(m);
  });

  test('écrire ailleurs, sous un support rompu : « Écrire dans les Documents », « Choisir un dossier… » et le remède du refus de « Liste » se font pastille peinte', async () => {
    contexte = creerContexte();
    const m = await contexte.monter({ systeme: { executable: 'F:\\salles' } });
    await m.seance.creer({ nom: 'Banquet des Tadornes', date: null, siegesParDefaut: 4, tours: 2 });
    await m.seance.passerEnEcriture();
    expect(m.seance.etat().racine.id).toBe('portable');
    m.fs.pannes.ecriture('portable');
    await expect(m.seance.executer('ajouterParticipant', { champs: { nom: 'Quillard' } })).rejects.toMatchObject({ code: 'ECRITURE' });
    flushSync();
    // Les trois issues refusent d'écrire : chaque appel garde le support rompu.
    const ailleurs = guetter(m, m.seance, 'ecrireAilleurs');
    m.fs.pannes.ecriture('documents');
    m.fs.choisirDossier = async () => null;
    for (const nom of ['ecrireDocuments', 'choisirDossier']) {
      const avant = ailleurs.vues.length;
      clic(m, `[data-support-rompu] [data-commande="${nom}"]`);
      await attendre(nom, () => ailleurs.vues.length === avant + 1);
      await apaiser(m);
    }
    clic(m, '[data-bandeau] [data-commande="liste"]');
    const remede = await attendre('le remède du refus', () => m.racine.querySelector('[data-refus="liste"] [data-commande="ecrireAilleurs"]'));
    remede.click();
    await attendre('le remède', () => ailleurs.vues.length === 3);
    await apaiser(m);
    expect(ailleurs.vues).toEqual([PEINTE, PEINTE, PEINTE]);
  });

  test('la fin d’une génération : pas de pastille pendant la recherche ; peinte quand le contrôleur enregistre ; retirée une fois la génération finie', async () => {
    const direct = creerExecuteurDirect();
    const recherche = tenue();
    const executeur = {
      coeursDisponibles: direct.coeursDisponibles,
      lancer(...args) {
        const execution = direct.lancer(...args);
        return { ...execution, resultat: recherche.promesse.then(() => execution.resultat) };
      },
    };
    contexte = creerContexte();
    const m = await contexte.monter({ executeur });
    await m.facade.chargerDemonstration('petite');
    await m.seance.passerEnEcriture();
    m.ui.allerA('generation');
    flushSync();
    const vues = [];
    const executer = m.seance.executer;
    m.seance.executer = (nom, ...args) => {
      if (nom === 'enregistrerGeneration') vues.push(releverPastille(m.racine));
      return executer(nom, ...args);
    };
    await cliquer(m, '[data-section="generation"] [data-commande="generer"]');
    for (let image = 0; image < 3; image += 1) await uneImage();
    expect(m.racine.querySelector('[data-activite]')).toBeNull();
    recherche.resoudre();
    await attendre('l’enregistrement', () => vues.length === 1);
    expect(vues).toEqual([PEINTE]);
    await attendre('la génération finie', () => m.seance.etat().charge.propositions.length > 0 && m.racine.querySelector('[data-activite]') === null);
  });

  test('un geste ordinaire du plan ne monte jamais la pastille : « Table ronde » ajoute sa table sans elle', async () => {
    contexte = creerContexte();
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'tables' });
    const avant = m.seance.etat().charge.tables.length;
    const observation = observerAjouts(m.racine);
    try {
      await cliquer(m, '[data-section="tables"] [data-commande="creerTableRonde"]');
      await attendre('la table ajoutée', () => m.seance.etat().charge.tables.length === avant + 1);
      for (let image = 0; image < 3; image += 1) await uneImage();
    } finally {
      observation.arreter();
    }
    expect(observation.ajoutees).toEqual([]);
    expect(m.racine.querySelector('[data-activite]')).toBeNull();
  });
});

describe('imagePeinte sur une page cachée, qui ne peint pas (§ 5.10)', () => {
  // Pose document.visibilityState à valeur le temps de faire, puis rend à
  // document la propriété de son prototype.
  async function sousVisibilite(valeur, faire) {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => valeur });
    try {
      return await faire();
    } finally {
      delete document.visibilityState;
    }
  }

  // Vrai quand la promesse est résolue après quelques microtâches, avant
  // toute image.
  async function resolueSansImage(promesse) {
    let resolue = false;
    promesse.then(() => {
      resolue = true;
    });
    for (let i = 0; i < 5; i += 1) await Promise.resolve();
    return resolue;
  }

  test('une page déjà cachée n’attend aucune image : la promesse se résout aussitôt', async () => {
    const resolue = await sousVisibilite('hidden', () => resolueSansImage(imagePeinte()));
    expect(resolue).toBe(true);
  });

  test('une page qui se cache pendant l’attente la résout, sans attendre l’image', async () => {
    const attente = imagePeinte();
    const resolue = await sousVisibilite('hidden', () => {
      document.dispatchEvent(new Event('visibilitychange'));
      return resolueSansImage(attente);
    });
    expect(resolue).toBe(true);
  });

  test('une page visible attend l’image : la promesse ne se résout pas en quelques microtâches', async () => {
    const attente = imagePeinte();
    expect(await resolueSansImage(attente)).toBe(false);
    await attente;
  });
});
