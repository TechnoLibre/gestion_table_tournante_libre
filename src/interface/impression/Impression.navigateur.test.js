// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'impression réelle de l'aperçu (§ 11.1, § 11.7, § 14.4) : le document de
// l'épreuve passe par le moteur d'impression de Chromium, qui en fait un
// PDF, et la lecture du PDF dit ce qu'une imprimante recevrait. Une page
// par feuille de l'aperçu, chacune à la boîte de média du papier et de
// l'orientation de sa feuille ; « BROUILLON » dans la couche de texte de
// chaque page d'un brouillon et d'aucune page d'un retenu ; l'horodatage du
// placement sur chaque page ; et cela pour le plan découpé comme pour la
// liste d'accueil et la feuille par table, chacune de plusieurs pages.
//
// La commande imprimerEnPdf (test/navigateur/commandes_impression.js)
// imprime, côté node, le document sérialisé du cadre de l'épreuve dans une
// page neuve, et rend ce qu'elle lit du PDF, jamais ses octets. Le même
// module donne l'écart admis entre une page et son papier, que l'essai de
// démarrage applique aussi ; modele.js donne le millimètre en px CSS.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé, au cadre de 1 366 × 700 ; le texte attendu vient de la même
// traduction que celle de l'application. Le projet navigateur emploie
// expect, et test et describe de Vitest (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { commands } from 'vitest/browser';
import { appliquerCommande } from '../../application/commandes.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TOLERANCE_PAGE_MM } from '../../../test/navigateur/commandes_impression.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { attendre, cliquer, creerContexte, ouvrirApercu } from '../../../test/navigateur/ecrans.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { MM_PAR_PX, dimensionsPage } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

// Images attendues au plus par étape : bien au-delà d'un rendu, sous le
// délai d'une épreuve.
const IMAGES = 300;

// L'horodatage posé sur les placements des épreuves de la couche de texte.
const HORODATAGE = '2031-05-17T19:30:00-04:00';

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
const feuilles = (m) => [...m.racine.querySelectorAll('[data-impression] [data-feuille]')];
const sansBlancs = (chaine) => chaine.replace(/\s+/g, '');

// Les dimensions rendues d'une feuille, en mm, et l'orientation qu'elles
// disent.
function dimensionsFeuille(feuille) {
  const { width, height } = feuille.getBoundingClientRect();
  const largeur = width * MM_PAR_PX;
  const hauteur = height * MM_PAR_PX;
  return { largeur, hauteur, orientation: largeur > hauteur ? 'paysage' : 'portrait' };
}

// Change la découpe du plan par son sélecteur, et attend le document.
async function decouper(m, decoupe) {
  const choix = dans(m, '[data-apercu-impression] [data-champ="decoupe"]');
  choix.value = decoupe;
  choix.dispatchEvent(new Event('change', { bubbles: true }));
  await attendre(`la découpe ${decoupe}`, () => m.ui.etat().apercu.decoupe === decoupe && feuilles(m).length > 0, IMAGES);
}

// Choisit une vue de l'aperçu par sa commande, et attend son document.
async function choisirVue(m, vue) {
  await cliquer(m, `[data-apercu-impression] [data-commande="vue"][data-cible="${vue}"]`);
  await attendre(`la vue ${vue}`, () => dans(m, `[data-impression][data-vue-impression="${vue}"] [data-feuille]`), IMAGES);
}

// La grande démonstration et une proposition de la recherche, tirée de la
// graine 1 : 260 personnes, 33 tables, quatre tours ; le plan est proposé.
// Le plan découpé, la liste d'accueil et la feuille par table y passent
// chacun la page.
function grandeProposee() {
  const charge = analyser(texteLivre('grande')).charge;
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 1, nombre: 1, arret: 1, historique: 10 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
}

// La grande proposée, sa proposition retenue, puis le plan bloqué.
function grandeBloquee() {
  const proposee = grandeProposee();
  const retenue = appliquerCommande('retenirProposition', proposee, { id: proposee.propositions[0].id }).charge;
  return appliquerCommande('changerEtat', retenue, { etat: 'bloque' }).charge;
}

// Une charge dont le retenu et chaque proposition portent HORODATAGE.
function avecHorodatage(charge) {
  const datee = structuredClone(charge);
  for (const proposition of datee.propositions) proposition.horodatage = HORODATAGE;
  if (datee.retenu !== null) datee.retenu.horodatage = HORODATAGE;
  return datee;
}

// Imprime le document de l'épreuve et vérifie une page par feuille, chacune
// à la boîte de média du papier et de l'orientation de sa feuille, elle-même
// aux dimensions de ce papier. Rend le PDF lu.
async function imprimerEtCompter(m, papier) {
  const lues = feuilles(m).map(dimensionsFeuille);
  expect(lues.length).toBeGreaterThan(0);
  const pdf = await commands.imprimerEnPdf();
  expect(pdf.pages, 'une page par feuille').toBe(lues.length);
  expect(pdf.mediaBox).toHaveLength(lues.length);
  pdf.mediaBox.forEach((boite, rang) => {
    const attendue = dimensionsPage(papier, lues[rang].orientation);
    for (const cote of ['largeur', 'hauteur']) {
      expect(Math.abs(lues[rang][cote] - attendue[cote]), `feuille ${rang + 1}, ${cote}`).toBeLessThanOrEqual(0.01);
      expect(Math.abs(boite[cote] - attendue[cote]), `page ${rang + 1}, ${cote} : ${boite[cote]} mm`).toBeLessThanOrEqual(TOLERANCE_PAGE_MM);
    }
  });
  return pdf;
}

describe('le PDF de Chromium : une page par feuille, au papier de la feuille (§ 11.7)', () => {
  for (const papier of ['A4', 'Lettre']) {
    test(`le plan découpé de la grande démonstration, ${papier} : autant de pages que de feuilles, chacune au papier et à l’orientation de la sienne`, async () => {
      const m = await ouvrirApercu(contexte, analyser(texteLivre('grande')).charge, { papier, section: 'participants' });
      await decouper(m, 'decoupe');
      expect(feuilles(m).length, 'un plan découpé en plusieurs pages').toBeGreaterThan(1);
      await imprimerEtCompter(m, papier);
    });
  }
});

describe('la couche de texte du PDF : filigrane et horodatage sur chaque page (§ 11.7)', () => {
  for (const [cas, chargeDuCas, brouillon] of [
    ['la grande démonstration proposée', grandeProposee, true],
    ['la grande démonstration bloquée', grandeBloquee, false],
  ]) {
    test(`${cas} : plan découpé, accueil et tables en plusieurs pages ; « BROUILLON » ${brouillon ? 'sur chacune' : 'sur aucune'}, l’horodatage sur chacune`, async () => {
      const m = await ouvrirApercu(contexte, avecHorodatage(chargeDuCas()));
      const filigrane = sansBlancs(t('impression.filigrane'));
      const horodatage = sansBlancs(format.horodatage(HORODATAGE));
      for (const vue of ['plan', 'accueil', 'tables']) {
        await choisirVue(m, vue);
        if (vue === 'plan') await decouper(m, 'decoupe');
        expect(feuilles(m).length, `${vue} : plusieurs pages`).toBeGreaterThan(1);
        for (const feuille of feuilles(m)) expect(sansBlancs(feuille.querySelector('[data-pied]').textContent), `${vue} : le pied à l’écran`).toContain(horodatage);
        const pdf = await imprimerEtCompter(m, 'A4');
        pdf.textes.forEach((texte, rang) => {
          const page = sansBlancs(texte);
          expect(page.includes(filigrane), `${vue}, page ${rang + 1} : « ${t('impression.filigrane')} »`).toBe(brouillon);
          expect(page, `${vue}, page ${rang + 1} : l’horodatage du placement`).toContain(horodatage);
        });
      }
    });
  }
});
