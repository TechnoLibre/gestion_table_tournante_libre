// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La section de la qualité, chargée à part, dans un vrai moteur de rendu :
// une fonction qui rend une promesse montre d'abord l'état de chargement —
// la région [data-chargement-section], titrée par la section, et sa phrase
// d'attente —, puis la page ; la page chargée revient ensuite sans état
// intermédiaire, et le chargement ne se refait pas. Un rejet dit, à la
// place de la page, qu'elle ne s'est pas chargée, porte l'erreur au
// collecteur, et le retour à la section la redemande. Le montage par défaut
// des épreuves rend le composant importé d'emblée : la page est là au rendu
// même qui l'ouvre. Chaque épreuve monte App par monterApp, sur le système
// de fichiers simulé où un fichier d'état d'épreuve est posé puis ouvert, et
// lit le rendu par ses attributs data-… et son texte. Le texte attendu vient
// de la même traduction que celle de l'application ; les noms d'épreuve
// sont inventés.
import { afterEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { serialiser } from '../../stockage/canonique.js';
import { creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import SectionQualite from '../qualite/SectionQualite.svelte';
import { cleDeSection } from './sections.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const BASE = 'atelier';

// Les montages de l'épreuve, démontés après elle. Le collecteur n'a reçu,
// pendant l'épreuve, que les erreurs qu'elle annonce dans attendues.
let montes = [];
let attendues = [];
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  const annoncees = attendues;
  attendues = [];
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual(annoncees);
});

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

// Monte App sur le chargement donné de la section de la qualité, pose un
// événement vide et l'ouvre, sur la section du plan.
async function ouvrir(sectionQualite) {
  const charge = creerCharge({ id: 'evt-differe', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
  const texte = serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
  const m = await monterApp({
    fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }],
    ...(sectionQualite === undefined ? {} : { sectionQualite }),
  });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  flushSync();
  return m;
}

// Un chargement qui rend, à chaque appel, une promesse neuve que l'épreuve
// règle elle-même : appels compte les appels, reglages garde les règlements.
function chargementPilote() {
  const pilote = { appels: 0, reglages: [] };
  pilote.charger = () => {
    pilote.appels += 1;
    return new Promise((resoudre, rejeter) => pilote.reglages.push({ resoudre, rejeter }));
  };
  return pilote;
}

const page = (m) => m.racine.querySelector('[data-section="qualite"]');
const attente = (m) => m.racine.querySelector('[data-chargement-section="qualite"]');
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const aller = (m, section) => {
  m.ui.allerA(section);
  flushSync();
};

describe('la section de la qualité chargée à part (Evenement.svelte, differe.js)', () => {
  test('l’état de chargement, titré par la section, puis la page ; revenue, la page est là sans attente ni second chargement', async () => {
    const pilote = chargementPilote();
    const m = await ouvrir(pilote.charger);
    expect(pilote.appels).toBe(0);
    aller(m, 'qualite');
    expect(pilote.appels).toBe(1);
    expect(page(m)).toBeNull();
    expect(texteDe(attente(m).querySelector('h2'))).toBe(t(cleDeSection('qualite')));
    expect(texteDe(attente(m).querySelector('[role="status"]'))).toBe(t('evenement.section.chargement'));
    expect(attente(m).getAttribute('aria-busy')).toBe('true');

    pilote.reglages[0].resoudre(SectionQualite);
    await attendre(() => expect(page(m)).not.toBeNull());
    expect(attente(m)).toBeNull();

    aller(m, 'plan');
    expect(page(m)).toBeNull();
    aller(m, 'qualite');
    expect(page(m)).not.toBeNull();
    expect(attente(m)).toBeNull();
    expect(pilote.appels).toBe(1);
  });

  test('un rejet : la région dit que la section ne s’est pas chargée, l’erreur va au collecteur, et le retour la redemande', async () => {
    const pilote = chargementPilote();
    const panne = new Error('morceau de la qualité introuvable');
    const m = await ouvrir(pilote.charger);
    aller(m, 'qualite');
    pilote.reglages[0].rejeter(panne);
    await attendre(() => expect(attente(m).querySelector('[data-echec-section="qualite"]')).not.toBeNull());
    expect(texteDe(attente(m).querySelector('[data-echec-section="qualite"]'))).toBe(t('evenement.section.echec'));
    expect(attente(m).getAttribute('aria-busy')).toBe('false');
    expect(page(m)).toBeNull();
    // Le collecteur reçoit l'erreur rapportée ; le lanceur des épreuves, qui
    // voit un écouteur d'erreurs posé, la recopie en console.error, que le
    // collecteur reçoit aussi. Toute entrée nomme la panne.
    expect(m.erreurs()).toContainEqual({ type: 'error', message: panne.message });
    for (const { message } of m.erreurs()) expect(message).toContain(panne.message);
    attendues = m.erreurs();

    aller(m, 'plan');
    aller(m, 'qualite');
    expect(pilote.appels).toBe(2);
    expect(attente(m).querySelector('[data-echec-section]')).toBeNull();
    pilote.reglages[1].resoudre(SectionQualite);
    await attendre(() => expect(page(m)).not.toBeNull());
  });

  test('le montage par défaut des épreuves rend le composant importé d’emblée : la page est là au rendu qui l’ouvre', async () => {
    const m = await ouvrir(undefined);
    aller(m, 'qualite');
    expect(page(m)).not.toBeNull();
    expect(attente(m)).toBeNull();
  });
});
