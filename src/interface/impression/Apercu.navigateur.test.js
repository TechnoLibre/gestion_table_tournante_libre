// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'aperçu avant impression dans un vrai moteur de rendu (§ 11.7, § 8.4,
// § 8.5, § 14.5, § 18.6) : [data-apercu-impression], que la section de
// l'impression porte sous son titre « Plan », et son document imprimé
// [data-impression], une feuille [data-feuille] par page. Chaque mesure se
// lit sur le style calculé et la boîte rendue, jamais sur une classe : les
// dimensions d'une feuille, son pied de cinq éléments, le filigrane d'un
// brouillon, le masquage sous les médias d'impression émulés, le papier
// clair en thème sombre, la question du papier, l'impression en lecture et
// sur un plan bloqué — aucune écriture de l'événement —, l'aperçu qui tombe
// hors de la section, et la bande mesurée sur la feuille gabarit.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé, au cadre de 1 366 × 700 ; le texte attendu vient de la même
// traduction que celle de l'application, et la règle du brouillon de
// src/application/sorties.js.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { estBrouillon, horodatagePlacement } from '../../application/sorties.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { constante } from '../../geometrie/constantes.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { analyser } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { FICHIER_REGLAGES } from '../../stockage/reglages_locaux.js';
import { VERSION } from '../../version.genere.js';
import { couleurDeJeton } from '../../../test/navigateur/captures.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import {
  attendre,
  chargeBloquee,
  chargePrincipale,
  cliquer,
  cliquerAction,
  creerContexte,
  fichierReglages,
  ouvrirApercu,
  ouvrirEvenement,
} from '../../../test/navigateur/ecrans.js';
import { attenuations, composantes, contraste, sousTheme } from '../../../test/navigateur/rendu.js';
import { creerImprimanteSimulee } from '../../../test/imprimante_simulee.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { MARQUES } from '../marques.js';
import { MM_PAR_PX } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Images attendues au plus par étape : bien au-delà d'une écriture simulée
// et de son rendu, et sous le délai d'une épreuve, pour qu'une étape qui ne
// vient pas se nomme.
const IMAGES = 300;

// Une feuille se mesure au dixième de millimètre (§ 11.7).
const TOLERANCE_MM = 0.1;

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
const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const feuilles = (m) => tous(m, '[data-impression] [data-feuille]');
const mm = (px) => px * MM_PAR_PX;
const plat = (chaine) => chaine.replace(/\s+/g, ' ').trim();
const texte = (element) => plat(element.textContent);

// Ouvre la section de l'impression par la navigation, et attend l'aperçu.
async function ouvrirImpression(m) {
  await cliquer(m, '[data-commande="section"][data-cible="badges"]');
  await attendre("l'aperçu", () => dans(m, '[data-apercu-impression]'), IMAGES);
}

// Quitte la section de l'impression pour le plan, puis y revient : l'aperçu
// repart de son départ, et la vue remesure sa bande.
async function rouvrirImpression(m) {
  await cliquer(m, '[data-commande="section"][data-cible="plan"]');
  await attendre('le plan', () => dans(m, '[data-section="plan"]'), IMAGES);
  await ouvrirImpression(m);
}

// Choisit une vue de l'aperçu par sa commande, et attend son document.
async function choisirVue(m, vue) {
  await cliquer(m, `[data-apercu-impression] [data-commande="vue"][data-cible="${vue}"]`);
  await attendre(`la vue ${vue}`, () => dans(m, `[data-impression][data-vue-impression="${vue}"] [data-feuille]`), IMAGES);
}

// La principale retenue puis bloquée, son retenu daté : un placement
// définitif, que le pied date.
const HORODATAGE = '2026-10-09T19:00:00-04:00';
function chargeBloqueeDatee() {
  const charge = chargeBloquee();
  charge.retenu.horodatage = HORODATAGE;
  return charge;
}

// La principale, sa proposition retenue, puis un tour de plus à la
// soirée : le retenu porte les tours de 1 à R − 1, pas le dernier, sur un
// plan retenu.
function chargeRetenuCourt() {
  const principale = chargePrincipale();
  const retenue = appliquerCommande('retenirProposition', principale, { id: principale.propositions[0].id }).charge;
  return appliquerCommande('changerTours', retenue, { tours: retenue.evenement.tours + 1 }).charge;
}

// Les écritures relevées depuis le rang donné qui touchent l'état ou le
// journal d'un événement.
const ecrituresEvenement = (m, depuis) =>
  m.trace.slice(depuis).filter(([, , chemin]) => [SUFFIXES.etat, SUFFIXES.journal, SUFFIXES.precedent].some((suffixe) => chemin.endsWith(suffixe)));

describe('l’aperçu de la section de l’impression (§ 11.7)', () => {
  test('la section « Impression » porte « Badges » puis « Plan », l’aperçu sous le second ; l’événement ne porte plus « Imprimer… » ; son document est [data-impression], une feuille par page', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    expect(texte(dans(m, '[data-commande="section"][data-cible="badges"]'))).toBe(t('coquille.section.badges'));
    expect(t('coquille.section.badges')).toBe('Impression');
    const section = dans(m, '[data-ecran="evenement"] [data-section="badges"]');
    expect(texte(section.querySelector('h2'))).toBe(t('coquille.section.badges'));
    const parties = [...section.querySelectorAll('[data-partie-impression]')];
    expect(parties.map((partie) => partie.dataset.partieImpression)).toEqual(['badges', 'plan']);
    expect(parties.map((partie) => texte(partie.querySelector('h3')))).toEqual([t('badges.partie.badges'), t('badges.partie.plan')]);
    expect(parties[0].querySelector('[data-commande="reediter"], [data-champ="reedition"]'), 'la réédition sous « Badges »').not.toBeNull();
    expect(parties[1].getBoundingClientRect().top).toBeGreaterThanOrEqual(parties[0].getBoundingClientRect().bottom);
    expect(tous(m, '[data-apercu-impression]')).toHaveLength(1);
    expect(parties[1].contains(dans(m, '[data-apercu-impression]'))).toBe(true);
    expect(dans(m, '[data-commande="apercu"]'), 'plus de « Imprimer… »').toBeNull();
    expect(tous(m, '[data-apercu-impression] [data-impression]')).toHaveLength(1);
    expect(feuilles(m).length).toBeGreaterThan(0);
    expect(feuilles(m).map((f) => f.dataset.feuille)).toEqual(feuilles(m).map((_, rang) => String(rang)));
    // Aucun identifiant en double dans la page.
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.filter((id, rang) => ids.indexOf(id) !== rang)).toEqual([]);
  });

  test('une feuille A4 portrait mesure 210 × 297 mm, une feuille Lettre 215,9 × 279,4 mm, au dixième de mm', async () => {
    for (const papier of ['A4', 'Lettre']) {
      const m = await ouvrirApercu(contexte, chargePrincipale(), { papier });
      await choisirVue(m, 'accueil');
      const { largeur, hauteur } = PAPIERS[papier];
      for (const feuille of feuilles(m)) {
        const boite = feuille.getBoundingClientRect();
        expect(Math.abs(mm(boite.width) - largeur), `${papier} : largeur ${mm(boite.width)}`).toBeLessThanOrEqual(TOLERANCE_MM);
        expect(Math.abs(mm(boite.height) - hauteur), `${papier} : hauteur ${mm(boite.height)}`).toBeLessThanOrEqual(TOLERANCE_MM);
      }
      await contexte.defaire();
    }
  });

  test('le plan s’imprime dans l’orientation de sa découpe : chaque feuille du plan a les dimensions du papier, couché ou non', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    const choix = dans(m, '[data-apercu-impression] [data-champ="decoupe"]');
    choix.value = 'decoupe';
    choix.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('la découpe demandée', () => m.ui.etat().apercu.decoupe === 'decoupe', IMAGES);
    const { largeur, hauteur } = PAPIERS.A4;
    for (const feuille of feuilles(m)) {
      const boite = feuille.getBoundingClientRect();
      const dims = [mm(boite.width), mm(boite.height)].sort((a, b) => a - b);
      expect(Math.abs(dims[0] - largeur)).toBeLessThanOrEqual(TOLERANCE_MM);
      expect(Math.abs(dims[1] - hauteur)).toBeLessThanOrEqual(TOLERANCE_MM);
    }
  });
});

describe('le pied de chaque feuille (§ 11.7, § 18.6)', () => {
  test('chaque feuille porte son pied, et chaque pied les cinq éléments : nom, date, tour, horodatage du placement, version', async () => {
    const charge = chargeBloqueeDatee();
    const m = await ouvrirApercu(contexte, charge);
    expect(charge.evenement.date).toBeNull();
    expect(feuilles(m).length).toBeGreaterThan(0);
    expect(tous(m, '[data-pied]').filter((pied) => pied.closest('[data-impression]') !== null)).toHaveLength(feuilles(m).length);
    for (const feuille of feuilles(m)) {
      const pieds = feuille.querySelectorAll('[data-pied]');
      expect(pieds).toHaveLength(1);
      const lu = texte(pieds[0]);
      expect(lu).toContain(charge.evenement.nom);
      expect(lu).toContain(t('impression.pied.sansDate'));
      expect(lu).toContain(t('impression.pied.tour', { tour: 1 }));
      expect(lu).toContain(t('impression.pied.placement'));
      expect(lu).toContain(t('format.horodatage', { annee: 2026, mois: 10, jour: 9, heure: 19, minute: 0 }));
      expect(lu).toContain(VERSION.affichee);
    }
    expect(horodatagePlacement(charge, { source: 'retenu' })).toBe(HORODATAGE);
  });

  test('un plan de plusieurs pages, la grande démonstration : chaque feuille porte son propre pied, le même sur chacune', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    expect(feuilles(m).length).toBeGreaterThan(1);
    const pieds = feuilles(m).map((feuille) => feuille.querySelectorAll('[data-pied]'));
    expect(pieds.map((liste) => liste.length)).toEqual(feuilles(m).map(() => 1));
    const lus = pieds.map((liste) => texte(liste[0]));
    expect(new Set(lus).size).toBe(1);
    expect(lus[0]).toContain(charge.evenement.nom);
    expect(lus[0]).toContain(t('impression.pied.tour', { tour: 1 }));
  });

  test('les listes portent « Tous les tours » ; un placement sans horodatage le dit', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    await choisirVue(m, 'accueil');
    for (const feuille of feuilles(m)) {
      const lu = texte(feuille.querySelector('[data-pied]'));
      expect(lu).toContain(t('impression.pied.tousLesTours'));
      expect(lu).toContain(t('impression.pied.placementInconnu'));
    }
  });

  test('dans une construction de documentation, la version devient la marque de provenance', async () => {
    const m = await ouvrirApercu(contexte, chargeBloqueeDatee(), { options: { provenance: 'documentation' } });
    for (const feuille of feuilles(m)) {
      const lu = texte(feuille.querySelector('[data-pied]'));
      expect(lu).toContain(t('sorties.version.documentation'));
      expect(lu).not.toContain(VERSION.affichee);
    }
  });
});

describe('le filigrane BROUILLON (§ 11.7, § 14.5)', () => {
  // Le filigrane d'une feuille, son texte au trait, et le fond du papier.
  function lireFiligrane(feuille) {
    const filigrane = feuille.querySelector('[data-filigrane]');
    const trait = filigrane?.querySelector('[data-marque="filigrane"]') ?? null;
    return { filigrane, trait, papier: composantes(getComputedStyle(feuille).backgroundColor) };
  }

  test('peint sur chaque feuille d’un brouillon — une proposition montrée —, au trait, sans remplissage, sans opacité ni filtre, à 3:1 sur le papier, dans les deux thèmes', async () => {
    const charge = chargePrincipale();
    expect(estBrouillon(charge, { source: 'proposition', tour: 1 })).toBe(true);
    expect(MARQUES.some(({ nom }) => nom === 'filigrane')).toBe(true);
    const m = await ouvrirApercu(contexte, charge);
    for (const theme of ['clair', 'sombre']) {
      m.ui.choisirTheme(theme);
      await attendre(`le thème ${theme}`, () => document.documentElement.getAttribute('data-theme') === theme, IMAGES);
      for (const feuille of feuilles(m)) {
        const { trait, papier } = lireFiligrane(feuille);
        expect(trait, 'le filigrane').not.toBeNull();
        expect(texte(trait)).toBe(t('impression.filigrane'));
        const style = getComputedStyle(trait);
        expect(style.fill).toBe('none');
        expect(Number.parseFloat(style.strokeWidth)).toBeGreaterThan(0);
        expect(style.pointerEvents === 'none' || getComputedStyle(trait.ownerSVGElement).pointerEvents === 'none').toBe(true);
        expect(attenuations(trait), 'aucune atténuation').toEqual([]);
        const couleur = composantes(style.stroke);
        expect(contraste(couleur, papier), `${theme} : ${style.stroke} sur ${getComputedStyle(feuille).backgroundColor}`).toBeGreaterThanOrEqual(3);
        // Tourné sur l'élément lui-même, par-dessus le contenu.
        expect(style.transform).not.toBe('none');
        const contenu = feuille.querySelector('[data-contenu]');
        expect(contenu.compareDocumentPosition(trait) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      }
    }
  });

  test('absent d’un retenu imprimé sur un plan bloqué, au tour qu’il porte', async () => {
    const charge = chargeBloqueeDatee();
    expect(estBrouillon(charge, { source: 'retenu', tour: 1 })).toBe(false);
    expect(estBrouillon(charge, { source: 'retenu', tour: 'tous' })).toBe(false);
    const m = await ouvrirApercu(contexte, charge);
    for (const vue of ['plan', 'accueil', 'tables']) {
      if (vue !== 'plan') await choisirVue(m, vue);
      expect(feuilles(m).length, vue).toBeGreaterThan(0);
      expect(tous(m, '[data-impression] [data-filigrane]'), vue).toHaveLength(0);
    }
  });

  test('peint sur chaque feuille d’une proposition montrée sur un plan bloqué : l’aperçu imprime la source du plan à l’écran, pas le retenu (Q5 b)', async () => {
    const charge = chargeBloqueeDatee();
    expect(estBrouillon(charge, { source: 'retenu', tour: 1 })).toBe(false);
    expect(estBrouillon(charge, { source: 'proposition', tour: 1 })).toBe(true);
    const m = await ouvrirEvenement(contexte, charge, { section: 'propositions', options: { fichiers: [fichierReglages('A4')] } });
    await cliquerAction(m, '[data-classement] tr[data-proposition]', 'voir');
    await attendre('la proposition montrée', () => m.ui.etat().proposition !== null, IMAGES);
    await ouvrirImpression(m);
    await attendre('le document', () => feuilles(m).length > 0, IMAGES);
    for (const vue of ['plan', 'accueil', 'tables']) {
      if (vue !== 'plan') await choisirVue(m, vue);
      expect(feuilles(m).length, vue).toBeGreaterThan(0);
      for (const feuille of feuilles(m)) expect(feuille.querySelectorAll('[data-filigrane]'), vue).toHaveLength(1);
    }
  });

  test('un retenu plus court que la soirée : le plan d’un tour qu’il porte sans filigrane ; celui du tour qu’il ne porte pas, et les listes de la soirée, avec', async () => {
    const charge = chargeRetenuCourt();
    const R = charge.evenement.tours;
    expect(charge.retenu.tours).toBe(R - 1);
    expect(estBrouillon(charge, { source: 'retenu', tour: 1 })).toBe(false);
    expect(estBrouillon(charge, { source: 'retenu', tour: R })).toBe(true);
    expect(estBrouillon(charge, { source: 'retenu', tour: 'tous' })).toBe(true);
    const m = await ouvrirApercu(contexte, charge);
    expect(m.ui.etat().apercu.tour).toBe(1);
    expect(feuilles(m).length).toBeGreaterThan(0);
    expect(tous(m, '[data-impression] [data-filigrane]'), 'tour 1').toHaveLength(0);

    const choix = dans(m, '[data-apercu-impression] [data-champ="tour"]');
    choix.value = String(R);
    choix.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre(`le tour ${R}`, () => m.ui.etat().apercu.tour === R, IMAGES);
    await attendre(`le filigrane du tour ${R}`, () => feuilles(m).length > 0 && feuilles(m).every((f) => f.querySelector('[data-filigrane]')), IMAGES);
    expect(texte(feuilles(m)[0].querySelector('[data-pied]'))).toContain(t('impression.pied.tour', { tour: R }));

    await choisirVue(m, 'accueil');
    for (const feuille of feuilles(m)) expect(feuille.querySelectorAll('[data-filigrane]'), 'accueil').toHaveLength(1);
  });
});

describe('les médias d’impression (§ 11.7)', () => {
  // Émule les médias d'impression le temps de lire.
  async function sousImpression(lire) {
    await cdp().send('Emulation.setEmulatedMedia', { media: 'print' });
    try {
      return lire();
    } finally {
      await cdp().send('Emulation.setEmulatedMedia', { media: '' });
    }
  }
  const affiche = (element) => getComputedStyle(element).display !== 'none';

  test('sous l’aperçu, le bandeau, la navigation, la partie « Badges », les titres, la barre et la feuille gabarit disparaissent ; chaque feuille reste', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    const bandeau = dans(m, '[data-bandeau]');
    const barre = dans(m, '[data-apercu-impression] [data-commande="imprimer"]');
    const masques = {
      navigation: dans(m, '[data-ecran="evenement"] nav'),
      badges: dans(m, '[data-partie-impression="badges"]'),
      titre: dans(m, '[data-partie-impression="plan"] h3'),
      section: dans(m, '[data-section="badges"] > h2'),
    };
    expect(affiche(bandeau) && affiche(barre)).toBe(true);
    for (const [nom, element] of Object.entries(masques)) expect(element.checkVisibility(), nom).toBe(true);
    await sousImpression(() => {
      expect(affiche(bandeau), 'bandeau').toBe(false);
      expect(barre.checkVisibility(), 'barre').toBe(false);
      for (const [nom, element] of Object.entries(masques)) expect(element.checkVisibility(), nom).toBe(false);
      // La première feuille commence au haut de la page.
      expect(feuilles(m)[0].getBoundingClientRect().top).toBeLessThanOrEqual(1);
      for (const feuille of feuilles(m)) expect(feuille.checkVisibility(), 'feuille').toBe(true);
      const horsDocument = tous(m, '[data-feuille], [data-pied], [data-contenu]').filter((e) => e.closest('[data-impression]') === null);
      for (const element of horsDocument) expect(element.checkVisibility(), 'gabarit').toBe(false);
    });
  });

  test('hors de l’aperçu, rien n’est masqué : l’impression d’un autre écran le rend tel qu’il est', async () => {
    const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'participants' });
    await sousImpression(() => {
      expect(affiche(dans(m, '[data-bandeau]'))).toBe(true);
      expect(dans(m, '[data-ecran="evenement"]').checkVisibility()).toBe(true);
      expect(dans(m, '[data-section="participants"]').checkVisibility()).toBe(true);
    });
  });
});

describe('le papier est clair dans les deux thèmes (§ 11.7, § 14.5)', () => {
  test('thème sombre : sous [data-impression], le fond du papier, le texte et le remplissage d’un plateau sont les jetons du clair', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    const lireSous = () => {
      const contenu = feuilles(m)[0].querySelector('[data-contenu]');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      const plateau = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      plateau.setAttribute('r', '5');
      plateau.style.fill = 'var(--couleur-table-fond)';
      svg.append(plateau);
      contenu.append(svg);
      try {
        return {
          plateau: getComputedStyle(plateau).fill,
          papier: getComputedStyle(feuilles(m)[0]).backgroundColor,
          texte: getComputedStyle(feuilles(m)[0].querySelector('[data-pied]')).color,
        };
      } finally {
        svg.remove();
      }
    };
    const clair = lireSous();
    m.ui.choisirTheme('sombre');
    await attendre('le thème sombre', () => document.documentElement.getAttribute('data-theme') === 'sombre', IMAGES);
    const sombre = lireSous();
    expect(sombre).toEqual(clair);
    expect(clair.plateau).toBe('rgb(255, 255, 255)');
    // La page, elle, a pris le sombre.
    expect(getComputedStyle(document.body).backgroundColor).not.toBe(clair.papier);
  });
});

describe('la question du papier (§ 8.5, § 11.2)', () => {
  test('sans papier, l’aperçu pose la question ; choisir l’écrit, l’aperçu le prend ; un second aperçu, puis un App remonté sur le même système, ne redemandent pas ; « Changer » le modifie', async () => {
    const charge = chargeBloqueeDatee();
    const m = await ouvrirApercu(contexte, charge, { papier: null });
    expect(dans(m, '[data-apercu-impression] [data-papier="question"]')).not.toBeNull();
    expect(dans(m, '[data-impression]')).toBeNull();
    expect(dans(m, '[data-apercu-impression] [data-commande="imprimer"]')).toBeNull();
    const avant = m.trace.length;
    await cliquer(m, '[data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]');
    await attendre('le document sur A4', () => feuilles(m).length > 0, IMAGES);
    expect(m.seance.etat().papier).toBe('A4');
    expect(m.trace.slice(avant).map(([, , chemin]) => chemin)).toContain(FICHIER_REGLAGES);
    expect(ecrituresEvenement(m, avant)).toEqual([]);
    expect(texte(dans(m, '[data-apercu-impression] [data-papier="choisi"]'))).toContain(t('impression.papier.nom.a4'));

    // Un second aperçu ne redemande pas.
    await rouvrirImpression(m);
    await attendre('le document, sans question', () => feuilles(m).length > 0, IMAGES);
    expect(dans(m, '[data-papier="question"]')).toBeNull();

    // Un App remonté sur le même système ne redemande pas.
    m.demonter();
    const second = await contexte.monter({ systeme: { disque: m.disque } });
    await cliquer(second, '[data-evenement="soiree/soiree"] [data-commande="ouvrir"]');
    await attendre("l'événement", () => second.racine.querySelector('[data-ecran="evenement"]'), IMAGES);
    await cliquer(second, '[data-commande="section"][data-cible="badges"]');
    await attendre('le document, sans question', () => second.racine.querySelector('[data-impression] [data-feuille]'), IMAGES);
    expect(second.racine.querySelector('[data-papier="question"]')).toBeNull();

    // « Changer » le modifie.
    await cliquer(second, '[data-papier="choisi"] [data-commande="changerPapier"]');
    await cliquer(second, '[data-papier="question"] [data-cible="Lettre"] [data-commande="choisirPapier"]');
    await attendre('le papier Lettre', () => second.seance.etat().papier === 'Lettre', IMAGES);
    await attendre('la question retirée', () => second.racine.querySelector('[data-papier="question"]') === null, IMAGES);
    const boite = second.racine.querySelector('[data-impression] [data-feuille]').getBoundingClientRect();
    const dims = [mm(boite.width), mm(boite.height)].sort((a, b) => a - b);
    expect(Math.abs(dims[0] - PAPIERS.Lettre.largeur)).toBeLessThanOrEqual(TOLERANCE_MM);
    expect(Math.abs(dims[1] - PAPIERS.Lettre.hauteur)).toBeLessThanOrEqual(TOLERANCE_MM);
  });
});

describe('imprimer en lecture et sur un plan bloqué (§ 8.4, § 2.1 garantie 3)', () => {
  for (const [cas, charge] of [
    ['en lecture', chargePrincipale],
    ['sur un plan bloqué', chargeBloqueeDatee],
  ]) {
    test(`${cas} : l’aperçu s’ouvre, « Imprimer » appelle imprimer une fois avec le papier et l’orientation ; rien de l’événement ne s’écrit`, async () => {
      const imprimante = creerImprimanteSimulee();
      const m = await ouvrirApercu(contexte, charge(), { papier: 'Lettre', options: { imprimante } });
      expect(m.seance.etat().mode).toBe('lecture');
      const avant = m.trace.length;
      await choisirVue(m, 'accueil');
      await cliquer(m, '[data-apercu-impression] [data-commande="imprimer"]');
      await attendre("l'impression demandée", () => imprimante.appels().length === 1, IMAGES);
      expect(imprimante.appels()).toEqual([{ papier: 'Lettre', orientation: 'portrait' }]);
      await choisirVue(m, 'plan');
      await cliquer(m, '[data-apercu-impression] [data-commande="imprimer"]');
      await attendre("la seconde impression demandée", () => imprimante.appels().length === 2, IMAGES);
      const boite = feuilles(m)[0].getBoundingClientRect();
      expect(imprimante.appels()[1]).toEqual({ papier: 'Lettre', orientation: boite.width > boite.height ? 'paysage' : 'portrait' });
      expect(ecrituresEvenement(m, avant)).toEqual([]);
      expect(m.trace.slice(avant)).toEqual([]);
      expect(dans(m, '[data-refus]')).toBeNull();
    });
  }

  test('une impression annulée ne dit rien ; un échec pose IMPRESSION_ECHEC sur la commande « Imprimer », sa cause nommée', async () => {
    const annulee = creerImprimanteSimulee({ issue: 'annule' });
    const m = await ouvrirApercu(contexte, chargePrincipale(), { options: { imprimante: annulee } });
    await cliquer(m, '[data-apercu-impression] [data-commande="imprimer"]');
    await attendre("l'impression demandée", () => annulee.appels().length === 1, IMAGES);
    await attendre('la commande rendue', () => dans(m, '[data-commande="imprimer"]').getAttribute('aria-busy') === null, IMAGES);
    expect(dans(m, '[data-refus]')).toBeNull();
    await contexte.defaire();

    const cause = 'Imprimante hors ligne';
    const enEchec = creerImprimanteSimulee({ issue: 'echec', cause });
    const n = await ouvrirApercu(contexte, chargePrincipale(), { options: { imprimante: enEchec } });
    await cliquer(n, '[data-apercu-impression] [data-commande="imprimer"]');
    const refus = await attendre('le refus sur la commande', () => dans(n, '[data-commande="imprimer"]')?.parentElement.querySelector('[data-refus="IMPRESSION_ECHEC"]'), IMAGES);
    expect(texte(refus.querySelector('p'))).toBe(plat(t('IMPRESSION_ECHEC', { cause })));
    expect(enEchec.appels()).toHaveLength(1);
  });
});

describe('un nom d’événement au-delà de la borne de la saisie (§ 8.1, § 11.7)', () => {
  test('lu d’un fichier, un nom de 8 000 caractères : l’aperçu ne met aucune page en forme et pose NOM_EVENEMENT_TROP_LONG sur « Imprimer », remède « Renommer », sans lever', async () => {
    const charge = structuredClone(chargePrincipale());
    charge.evenement.nom = 'Gala des Grèbes '.repeat(500);
    expect(charge.evenement.nom).toHaveLength(8000);
    const imprimante = creerImprimanteSimulee();
    const m = await ouvrirEvenement(contexte, charge, { options: { imprimante, fichiers: [fichierReglages('A4')] } });
    await ouvrirImpression(m);
    const refus = await attendre(
      'le refus sur « Imprimer »',
      () => dans(m, '[data-apercu-impression] [data-commande="imprimer"]')?.parentElement.querySelector('[data-refus="NOM_EVENEMENT_TROP_LONG"]'),
      IMAGES,
    );
    expect(texte(refus.querySelector('p'))).toBe(plat(t('NOM_EVENEMENT_TROP_LONG', { longueur: 7999, maximum: 68 })));
    const remede = refus.querySelector('[data-commande="renommer"]');
    expect(remede, 'le remède « Renommer »').not.toBeNull();
    expect(texte(remede)).toBe(t('communs.remede.renommer'));
    expect(dans(m, '[data-apercu-impression] [data-commande="imprimer"]').getAttribute('aria-describedby')).toBe(refus.id);
    // Ni gabarit ni document : aucune page n'est mise en forme.
    expect(dans(m, '[data-apercu-impression] [data-feuille]')).toBeNull();
    expect(dans(m, '[data-impression]')).toBeNull();
    // « Imprimer » n'imprime pas : le refus reste, l'imprimante n'est pas appelée.
    await cliquer(m, '[data-apercu-impression] [data-commande="imprimer"]');
    await attendre('la commande rendue', () => dans(m, '[data-commande="imprimer"]').getAttribute('aria-busy') === null, IMAGES);
    expect(imprimante.appels()).toEqual([]);
    expect(dans(m, '[data-commande="imprimer"]').parentElement.querySelector('[data-refus="NOM_EVENEMENT_TROP_LONG"]')).not.toBeNull();
    // La vue des listes et celle des feuilles de tables se refusent de même.
    for (const vue of ['accueil', 'tables']) {
      await cliquer(m, `[data-apercu-impression] [data-commande="vue"][data-cible="${vue}"]`);
      expect(dans(m, '[data-apercu-impression] [data-feuille]'), vue).toBeNull();
      expect(dans(m, '[data-commande="imprimer"]').parentElement.querySelector('[data-refus="NOM_EVENEMENT_TROP_LONG"]'), vue).not.toBeNull();
    }
    // Le remède ferme l'événement : la liste, où chacun porte « Renommer ».
    await cliquer(m, '[data-apercu-impression] [data-refus="NOM_EVENEMENT_TROP_LONG"] [data-commande="renommer"]');
    await attendre('la liste des événements', () => dans(m, '[data-ecran="accueil"]'), IMAGES);
    expect(dans(m, '[data-apercu-impression]')).toBeNull();
  });
});

describe('quitter la section de l’impression (§ 11.7)', () => {
  test('une autre section retire l’aperçu ; revenir le rend sur le plan, au tour que le plan montre', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    await choisirVue(m, 'accueil');
    await cliquer(m, '[data-commande="section"][data-cible="participants"]');
    await attendre('les participants', () => dans(m, '[data-section="participants"]'), IMAGES);
    expect(dans(m, '[data-apercu-impression]')).toBeNull();
    expect(m.ui.etat().apercu).toBeNull();
    m.ui.montrerTour(2);
    await ouvrirImpression(m);
    await attendre('le plan', () => dans(m, '[data-impression][data-vue-impression="plan"] [data-feuille]'), IMAGES);
    expect(m.ui.etat().apercu.tour).toBe(2);
    expect(dans(m, '[data-apercu-impression] [data-champ="tour"]').value).toBe('2');
  });
});

describe('un retour pendant l’aperçu (§ 8.3, § 11.7)', () => {
  test('défaire l’ajout d’un tour quand l’aperçu montre ce tour : le choix et le pied passent au dernier tour qui reste, parmi les options offertes', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale(), { ecriture: true });
    const R = m.seance.etat().charge.evenement.tours;
    await m.seance.executer('changerTours', { tours: R + 1 });
    const choix = () => dans(m, '[data-apercu-impression] [data-champ="tour"]');
    await attendre(`l’option du tour ${R + 1}`, () => choix().options.length === R + 1, IMAGES);
    choix().value = String(R + 1);
    choix().dispatchEvent(new Event('change', { bubbles: true }));
    await attendre(`le tour ${R + 1}`, () => m.ui.etat().apercu.tour === R + 1, IMAGES);
    await m.seance.defaire();
    await attendre(`les ${R} tours`, () => choix().options.length === R, IMAGES);
    expect(choix().value).toBe(String(R));
    expect([...choix().options].map((option) => option.value)).toContain(choix().value);
    await attendre(`le pied du tour ${R}`, () => feuilles(m).length > 0 && texte(feuilles(m)[0].querySelector('[data-pied]')).includes(t('impression.pied.tour', { tour: R })), IMAGES);
  });
});

describe('la bande mesurée (HAUTEUR_BANDE_IMPRESSION, § 14.1)', () => {
  // La hauteur de la zone de contenu de la première feuille, en mm.
  const contenuMm = (m) => mm(feuilles(m)[0].querySelector('[data-contenu]').getBoundingClientRect().height);

  test('un pied grandi de 20 mm par l’épreuve grandit la bande d’autant : la zone de contenu de chaque feuille perd 20 mm, au dixième', async () => {
    const m = await ouvrirApercu(contexte, chargeBloqueeDatee());
    await choisirVue(m, 'accueil');
    const avant = contenuMm(m);
    const marge = constante('MARGE_PAGE_MM');
    expect(avant).toBeLessThan(PAPIERS.A4.hauteur - 2 * marge);
    const feuille = document.createElement('style');
    feuille.textContent = '[data-pied] { padding-bottom: 20mm !important; }';
    document.head.append(feuille);
    try {
      await rouvrirImpression(m);
      await attendre('le document', () => feuilles(m).length > 0, IMAGES);
      await choisirVue(m, 'accueil');
      const apres = contenuMm(m);
      expect(Math.abs(avant - apres - 20), `${avant} − ${apres}`).toBeLessThanOrEqual(TOLERANCE_MM);
      // La feuille garde sa taille : la bande prend sur le contenu.
      expect(Math.abs(mm(feuilles(m)[0].getBoundingClientRect().height) - PAPIERS.A4.hauteur)).toBeLessThanOrEqual(TOLERANCE_MM);
    } finally {
      feuille.remove();
    }
  });

  // Chaque feuille du plan, en mm : sa tuile — le <svg> de la page, que la
  // vue rend à la taille que la découpe donne à la surface utile —, sa
  // feuille et sa zone de contenu.
  const tuiles = (m) =>
    tous(m, '[data-impression][data-vue-impression="plan"] [data-feuille]').map((feuille) => {
      const tuile = feuille.querySelector('[data-contenu] > svg');
      expect(tuile, `la tuile de la feuille ${feuille.dataset.feuille}`).not.toBeNull();
      const boite = tuile.getBoundingClientRect();
      const page = feuille.getBoundingClientRect();
      return {
        largeur: mm(boite.width),
        hauteur: mm(boite.height),
        pageLargeur: mm(page.width),
        paysage: page.width > page.height,
        contenu: mm(feuille.querySelector('[data-contenu]').getBoundingClientRect().height),
      };
    });

  test('la découpe du plan reçoit la même bande : la tuile de chaque page a la hauteur de la zone de contenu, et perd 20 mm quand le pied en gagne 20, au dixième', async () => {
    const marge = constante('MARGE_PAGE_MM');
    const m = await ouvrirApercu(contexte, chargeBloqueeDatee());
    const avant = tuiles(m);
    expect(avant.length).toBeGreaterThan(0);
    for (const tuile of avant) {
      expect(Math.abs(tuile.hauteur - tuile.contenu), JSON.stringify(tuile)).toBeLessThanOrEqual(TOLERANCE_MM);
      expect(Math.abs(tuile.largeur - (tuile.pageLargeur - 2 * marge)), JSON.stringify(tuile)).toBeLessThanOrEqual(TOLERANCE_MM);
    }
    const feuille = document.createElement('style');
    feuille.textContent = '[data-pied] { padding-bottom: 20mm !important; }';
    document.head.append(feuille);
    try {
      await rouvrirImpression(m);
      await attendre('le plan', () => dans(m, '[data-impression][data-vue-impression="plan"] [data-feuille]'), IMAGES);
      const apres = tuiles(m);
      // La même orientation : la différence ne tient qu'à la bande.
      expect(apres.map(({ paysage }) => paysage)).toEqual(avant.map(({ paysage }) => paysage));
      for (const [rang, tuile] of apres.entries()) {
        expect(Math.abs(tuile.hauteur - tuile.contenu), JSON.stringify(tuile)).toBeLessThanOrEqual(TOLERANCE_MM);
        expect(Math.abs(avant[rang].hauteur - tuile.hauteur - 20), `${avant[rang].hauteur} − ${tuile.hauteur}`).toBeLessThanOrEqual(TOLERANCE_MM);
      }
    } finally {
      feuille.remove();
    }
  });
});

// --- L'habillage de l'écran : la barre d'outils groupée ---------------------------

describe('la barre d’outils de l’aperçu', () => {
  const barre = (m) => dans(m, `[data-apercu-impression] [role="group"][aria-label="${t('impression.barre')}"]`);

  // La carte qui porte un élément : le plus proche ancêtre peint du fond de
  // la carte, au rayon de 12 px ; null sans elle.
  function carteDe(element) {
    const fond = couleurDeJeton('--couleur-carte-fond').join();
    for (let n = element.parentElement; n !== null; n = n.parentElement) {
      const style = getComputedStyle(n);
      if (composantes(style.backgroundColor).join() === fond && style.borderTopLeftRadius === '12px') return n;
    }
    return null;
  }

  test('sans papier, la question se pose dans une carte sous la barre, dans les deux thèmes', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale(), { papier: null });
    const question = dans(m, '[data-apercu-impression] [data-papier="question"]');
    expect(question, 'la question du papier').not.toBeNull();
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const carte = carteDe(question);
        expect(carte, `${theme} : carte de la question`).not.toBeNull();
        expect(carte.contains(barre(m)), theme).toBe(false);
        expect(barre(m).contains(carte), theme).toBe(false);
        expect(carte.getBoundingClientRect().top, theme).toBeGreaterThanOrEqual(barre(m).getBoundingClientRect().bottom);
      });
    }
    expect(dans(m, '[data-commande="fermerApercu"]'), 'aucune fermeture').toBeNull();
  });

  test('une carte, ses commandes en groupes nommés côte à côte : vue, réglages de la vue, papier et impression', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    const style = getComputedStyle(barre(m));
    expect(composantes(style.backgroundColor).join()).toBe(couleurDeJeton('--couleur-carte-fond').join());
    expect(style.borderTopLeftRadius).toBe('12px');
    const groupes = [...barre(m).querySelectorAll('[role="group"]')];
    expect(groupes.map((groupe) => groupe.getAttribute('aria-label'))).toEqual([
      t('impression.vue.titre'),
      t('impression.groupe.reglages'),
      t('impression.groupe.sortie'),
    ]);
    const boites = groupes.map((groupe) => groupe.getBoundingClientRect());
    for (const [rang, a] of boites.entries()) {
      expect(a.width * a.height, groupes[rang].getAttribute('aria-label')).toBeGreaterThan(0);
      for (const b of boites.slice(rang + 1)) {
        const chevauchent = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        expect(chevauchent).toBe(false);
      }
    }
    const [, reglages, sortie] = groupes;
    expect(reglages.querySelector('[data-champ="tour"]')).not.toBeNull();
    expect(sortie.querySelector('[data-papier="choisi"]')).not.toBeNull();
    expect(sortie.querySelector('[data-commande="imprimer"]')).not.toBeNull();
  });

  test('la vue retenue se lit enfoncée — teinte de l’action, gras, texte à 4,5:1 — et « Imprimer » est l’action principale, dans les deux thèmes', async () => {
    const m = await ouvrirApercu(contexte, chargePrincipale());
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const vues = tous(m, '[data-apercu-impression] [data-commande="vue"]');
        const enfoncee = vues.find((vue) => vue.getAttribute('aria-pressed') === 'true');
        const style = getComputedStyle(enfoncee);
        const fond = composantes(style.backgroundColor);
        expect(fond.join(), theme).toBe(couleurDeJeton('--couleur-action-teinte').join());
        expect(style.fontWeight, theme).toBe('700');
        expect(contraste(composantes(style.color), fond), theme).toBeGreaterThanOrEqual(4.5);
        for (const vue of vues.filter((autre) => autre !== enfoncee)) {
          expect(composantes(getComputedStyle(vue).backgroundColor).join(), theme).not.toBe(fond.join());
        }
        const imprimer = getComputedStyle(dans(m, '[data-apercu-impression] [data-commande="imprimer"]'));
        expect(composantes(imprimer.backgroundColor).join(), theme).toBe(couleurDeJeton('--couleur-action-fond').join());
      });
    }
  });

  test('à 1 024 px de large, la barre tient dans la fenêtre sans défilement interne', async () => {
    await fixerCadre(1024, 700);
    const m = await ouvrirApercu(contexte, chargePrincipale());
    const b = barre(m).getBoundingClientRect();
    expect(b.left).toBeGreaterThanOrEqual(0);
    expect(b.right).toBeLessThanOrEqual(document.documentElement.clientWidth);
    expect(barre(m).scrollWidth).toBeLessThanOrEqual(barre(m).clientWidth);
    for (const enfant of barre(m).querySelectorAll('button, select')) {
      expect(enfant.getBoundingClientRect().right, enfant.textContent).toBeLessThanOrEqual(b.right);
    }
  });
});
