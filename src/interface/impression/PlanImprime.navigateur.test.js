// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le plan imprimé dans un vrai moteur de rendu (§ 7.4, § 7.7, § 11.7,
// § 13.5) : l'aperçu du plan, une feuille [data-feuille] par page de la
// découpe, chacune portant un <svg> de page dans sa zone de contenu, et hors
// d'elle le cartouche, l'échelle graphique et les mentions. Chaque mesure se
// lit sur la boîte rendue et les attributs, jamais sur une classe : le
// cadrage de chaque <svg> contre la découpe recalculée de la bande et de la
// hauteur de ligne mesurées comme l'aperçu les mesure, la troncature des
// listes contre celle du plan à l'écran, la barre d'échelle, les mentions,
// la bande qui compte le cartouche, l'absence d'identifiant, de poignée et
// de tabulation, et les marques qui se lisent en noir et blanc.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé, au cadre de 1 366 × 700. Le projet navigateur emploie expect, et
// test et describe de Vitest (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { constante } from '../../geometrie/constantes.js';
import { echelleGraphique } from '../../geometrie/echelle.js';
import { TAILLE_TEXTE_LISTE_CM } from '../../geometrie/texte.js';
import { analyser } from '../../stockage/document.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import {
  attendre,
  chargePrincipale,
  cliquer,
  creerContexte,
  fichierReglages,
  ouvrirApercu,
  ouvrirEvenement,
} from '../../../test/navigateur/ecrans.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { CONFLITS } from '../marques.js';
import { hauteurLigne } from '../plan/mesure_texte.js';
import { libelleLongueur, modeleDessin } from '../plan/modele.js';
import { nomDeCharge } from '../plan/vue_plan.js';
import { MM_PAR_PX, bandeDeFeuille, feuilleDe, optionsApercu, sortieApercu } from './modele.js';
import { LARGEUR_ECHELLE_MM, pagesDuPlan, renvois } from './plan.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Images attendues au plus par étape.
const IMAGES = 300;

// Une barre d'échelle se mesure au vingtième de millimètre (§ 7.7).
const TOLERANCE_BARRE_MM = 0.05;
const TOLERANCE_MM = 0.1;

const SVG = 'http://www.w3.org/2000/svg';

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
const feuilles = (m) => tous(m, '[data-impression][data-vue-impression="plan"] [data-feuille]');
const tuileDe = (feuille) => feuille.querySelector(':scope [data-contenu] > svg');
const mm = (px) => px * MM_PAR_PX;
const plat = (chaine) => chaine.replace(/\s+/g, ' ').trim();

// Le viewBox d'un <svg>, lu de son attribut : les nombres tels que la vue
// les a écrits, sans l'arrondi de viewBox.baseVal.
function viewBoxDe(svg) {
  const [x, y, largeur, hauteur] = svg.getAttribute('viewBox').trim().split(/\s+/).map(Number);
  return { x, y, largeur, hauteur };
}

// Les lignes de chaque liste de noms sous racine, par table : le texte de
// chaque rangée, l'en-tête compris.
function listesSous(racine) {
  return [...racine.querySelectorAll('text[data-liste]')].map((liste) => ({
    table: liste.dataset.liste,
    lignes: [...liste.children].map((rangee) => rangee.textContent),
  }));
}

// La bande que l'aperçu a mesurée, relue comme il la mesure : sur la feuille
// gabarit, la seule feuille hors du document imprimé.
function bandeDuGabarit(m) {
  const contenus = tous(m, '[data-ecran="apercu"] [data-contenu]').filter((contenu) => contenu.closest('[data-impression]') === null);
  expect(contenus, 'la feuille gabarit').toHaveLength(1);
  return bandeDeFeuille({
    feuillePx: contenus[0].parentElement.getBoundingClientRect().height,
    contenuPx: contenus[0].getBoundingClientRect().height,
    margeMm: constante('MARGE_PAGE_MM'),
  });
}

// La hauteur de ligne des listes, mesurée comme la vue la mesure : une
// sonde au style des listes, sous le document imprimé.
function hauteurDesListes(m) {
  const svg = document.createElementNS(SVG, 'svg');
  const texte = document.createElementNS(SVG, 'text');
  texte.setAttribute('font-size', String(TAILLE_TEXTE_LISTE_CM));
  texte.style.fontFamily = 'var(--police-interface)';
  svg.append(texte);
  dans(m, '[data-impression]').append(svg);
  try {
    return hauteurLigne(texte);
  } finally {
    svg.remove();
  }
}

// Les pages attendues du plan que l'aperçu montre, recalculées par
// pagesDuPlan sur la même sortie, la même bande et la même hauteur de ligne.
function pagesAttendues(m, charge) {
  const options = optionsApercu(m.ui.etat().apercu, 'A4');
  const { etat, tour } = sortieApercu(charge, options, m.ui.etat().proposition);
  const modele = modeleDessin(etat, { listes: options.listes, nomDe: nomDeCharge(charge), impression: true });
  const pied = feuilleDe({ nom: charge.evenement.nom, date: null, tour, horodatage: null, version: 'epreuve' }, false);
  return pagesDuPlan(
    etat,
    modele.tables.map((table) => table.geometrie),
    options.decoupe,
    { papier: 'A4', bandeMm: bandeDuGabarit(m), listes: options.listes, hauteurLigne: hauteurDesListes(m), pied },
  );
}

// Change la découpe du plan par son sélecteur, et attend le document.
async function decouper(m, decoupe) {
  const choix = dans(m, '[data-ecran="apercu"] [data-champ="decoupe"]');
  choix.value = decoupe;
  choix.dispatchEvent(new Event('change', { bubbles: true }));
  await attendre(`la découpe ${decoupe}`, () => m.ui.etat().apercu.decoupe === decoupe && feuilles(m).length > 0, IMAGES);
}

// La principale, trois personnes d'une même table renommées des noms qui
// cassent une liste : de larges capitales, une ligature, deux cents
// caractères.
const NOMS_LONGS = ['W'.repeat(40), '\u{00C6}'.repeat(40), `Ondine ${'Lacasse'.repeat(28)}`.slice(0, 200)];
function chargeAuxNomsLongs() {
  const charge = chargePrincipale();
  for (const [rang, nom] of NOMS_LONGS.entries()) {
    const personne = charge.participants[rang];
    personne.prenom = null;
    personne.nom = nom;
  }
  return charge;
}

describe('les pages du plan imprimé (§ 11.7)', () => {
  test('un <svg> de page par feuille, autant que de pages ; le viewBox de chacun est le cadrage de sa page, à 1e-9 près', async () => {
    for (const decoupe of ['auto', 'decoupe']) {
      const charge = analyser(texteLivre('grande')).charge;
      const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
      await decouper(m, decoupe);
      const attendues = pagesAttendues(m, charge);
      const lues = feuilles(m);
      expect(lues).toHaveLength(attendues.length);
      expect(tous(m, '[data-impression] [data-contenu] > svg')).toHaveLength(attendues.length);
      for (const [rang, feuille] of lues.entries()) {
        const tuile = tuileDe(feuille);
        expect(tuile, `la tuile de la feuille ${rang}`).not.toBeNull();
        const lu = viewBoxDe(tuile);
        for (const cote of ['x', 'y', 'largeur', 'hauteur']) {
          expect(Math.abs(lu[cote] - attendues[rang].viewBox[cote]), `${decoupe}, page ${rang}, ${cote}`).toBeLessThanOrEqual(1e-9);
        }
        expect(tuile.getAttribute('role')).toBe('img');
        expect(tuile.getAttribute('aria-label')).toBe(t('impression.plan.page', { page: rang + 1, total: attendues.length }));
        expect(tuile.querySelector(':scope > g').getAttribute('aria-hidden')).toBe('true');
      }
      await contexte.defaire();
    }
  });

  test('le cartouche rendu de chaque page, découpée : son repérage, puis un renvoi par page voisine, dans l’ordre haut, droite, bas, gauche, et rien d’autre', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await decouper(m, 'decoupe');
    const attendues = pagesAttendues(m, charge);
    const lues = feuilles(m);
    expect(lues).toHaveLength(attendues.length);
    // La découpe porte des pages voisines de deux côtés au moins : sans
    // elles, un renvoi omis ou mal numéroté passerait inaperçu.
    expect(Math.max(...attendues.map(({ cartouche }) => renvois(cartouche).length)), 'des voisines sur deux côtés au moins').toBeGreaterThanOrEqual(2);
    for (const [rang, feuille] of lues.entries()) {
      const cartouches = [...feuille.querySelectorAll('[data-cartouche]')];
      expect(cartouches, `le cartouche de la feuille ${rang}`).toHaveLength(1);
      const { cartouche } = attendues[rang];
      const reperage = t('impression.plan.cartouche', cartouche);
      const textes = renvois(cartouche).map(({ cle, page }) => t(cle, { page }));
      expect(plat(cartouches[0].textContent), `feuille ${rang}`).toContain(reperage);
      expect([...cartouches[0].children].map((partie) => plat(partie.textContent)), `feuille ${rang}`).toEqual([reperage, ...textes]);
    }
  });

  test('grande démonstration, listes montrées, A4 : découpée par défaut, chaque table sur une page au moins', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const depart = performance.now();
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await attendre('les listes de chaque page', () => tous(m, '[data-impression] [data-liste] tspan').length > 0, IMAGES);
    const duree = performance.now() - depart;
    console.info(`[IM3] ouverture de l'aperçu, grande démonstration, listes montrées, A4 : ${Math.round(duree)} ms`);
    expect(m.ui.etat().apercu.listes).toBe(true);
    expect(m.ui.etat().apercu.decoupe).toBe('auto');
    expect(feuilles(m).length).toBeGreaterThan(1);
    const portees = new Set(tous(m, '[data-impression] [data-table]').map((table) => Number(table.dataset.table)));
    expect([...portees].sort((a, b) => a - b)).toEqual(charge.tables.map(({ id }) => id).sort((a, b) => a - b));
  });
});

describe('la troncature des listes, celle de l’écran (§ 7.4)', () => {
  test('les noms « WWW… », « ÆÆÆ… » et de deux cents caractères s’abrègent sur le papier comme à l’écran, ligne pour ligne', async () => {
    const m = await ouvrirEvenement(contexte, chargeAuxNomsLongs(), { section: 'plan', options: { fichiers: [fichierReglages('A4')] } });
    await attendre('les listes du plan', () => tous(m, '[data-plan] [data-liste] tspan').length > 0, IMAGES);
    const ecran = new Map(listesSous(dans(m, '[data-plan]')).map(({ table, lignes }) => [table, lignes]));
    const marque = t('plan.liste.abreviation');
    expect([...ecran.values()].flat().filter((ligne) => ligne.includes(marque)).length, 'des lignes abrégées').toBeGreaterThanOrEqual(NOMS_LONGS.length);
    await cliquer(m, '[data-ecran="evenement"] [data-commande="apercu"]');
    await attendre('les listes imprimées', () => tous(m, '[data-impression] [data-liste] tspan').length > 0, IMAGES);
    const imprimees = listesSous(dans(m, '[data-impression]'));
    expect(new Set(imprimees.map(({ table }) => table))).toEqual(new Set(ecran.keys()));
    for (const { table, lignes } of imprimees) {
      expect(lignes, `table ${table}`).toEqual(ecran.get(table));
    }
  });
});

describe('l’échelle graphique et les mentions de chaque page (§ 7.7)', () => {
  test('la barre de chaque page mesure sa longueur à l’échelle de la page, au vingtième de mm ; sa longueur affichée est celle de libelleLongueur', async () => {
    for (const decoupe of ['auto', 'unePage', 'decoupe']) {
      const m = await ouvrirApercu(contexte, analyser(texteLivre('grande')).charge, { section: 'participants' });
      await decouper(m, decoupe);
      for (const feuille of feuilles(m)) {
        const tuile = tuileDe(feuille);
        const echelle = mm(tuile.getBoundingClientRect().width) / viewBoxDe(tuile).largeur;
        const { longueurCm } = echelleGraphique(echelle, LARGEUR_ECHELLE_MM);
        const barres = [...feuille.querySelectorAll('[data-marque="echelle"]')];
        expect(barres).toHaveLength(1);
        const barre = barres[0];
        expect(barre.closest('[data-contenu]')).toBeNull();
        const largeur = mm(barre.getBoundingClientRect().width);
        expect(Math.abs(largeur - longueurCm * echelle), `${decoupe} : ${largeur} mm pour ${longueurCm} cm`).toBeLessThanOrEqual(TOLERANCE_BARRE_MM);
        const longueur = libelleLongueur(longueurCm);
        const attendu = `${longueur.valeur.toFixed(longueur.decimales).replace('.', ',')} ${t(longueur.cle)}`;
        expect(plat(barre.parentElement.textContent)).toBe(attendu);
      }
      await contexte.defaire();
    }
  });

  test('chaque feuille porte la mention « disposition relative » ; celle des listes, sur chaque page qui en porte, tant que les listes sont montrées', async () => {
    const m = await ouvrirApercu(contexte, analyser(texteLivre('grande')).charge, { section: 'participants' });
    const relatives = tous(m, '[data-impression] [data-mention="relative"]');
    expect(relatives.length).toBeGreaterThan(0);
    expect(relatives).toHaveLength(feuilles(m).length);
    for (const feuille of feuilles(m)) {
      const mentions = feuille.querySelectorAll('[data-mention="relative"]');
      expect(mentions).toHaveLength(1);
      expect(plat(mentions[0].textContent)).toBe(t('plan.echelle.mention'));
      const listes = feuille.querySelectorAll('[data-mention="listes"]');
      const portees = feuille.querySelectorAll('[data-table]').length > 0;
      expect(listes.length, `feuille ${feuille.dataset.feuille}`).toBe(portees ? 1 : 0);
      if (portees) expect(plat(listes[0].textContent)).toBe(t('impression.plan.listes'));
    }
    await cliquer(m, '[data-ecran="apercu"] [data-commande="listes"]');
    await attendre('les listes masquées', () => m.ui.etat().apercu.listes === false && feuilles(m).length > 0, IMAGES);
    await attendre('les mentions des listes retirées', () => tous(m, '[data-impression] [data-mention="listes"]').length === 0, IMAGES);
    expect(tous(m, '[data-impression] [data-liste]')).toHaveLength(0);
    expect(tous(m, '[data-impression] [data-mention="relative"]')).toHaveLength(feuilles(m).length);
  });
});

describe('la bande du plan (HAUTEUR_BANDE_IMPRESSION, § 14.1)', () => {
  // La bande d'une feuille rendue, en mm : la feuille, moins sa zone de
  // contenu, moins une marge à chaque bord.
  const bandeDe = (feuille) =>
    mm(feuille.getBoundingClientRect().height) -
    mm(feuille.querySelector('[data-contenu]').getBoundingClientRect().height) -
    2 * constante('MARGE_PAGE_MM');

  test('la bande compte cartouche, mentions et barre, hors de la zone de contenu : elle dépasse le pied, et tout ce qu’elle porte tient dans la feuille', async () => {
    const m = await ouvrirApercu(contexte, analyser(texteLivre('grande')).charge, { section: 'participants' });
    const marge = constante('MARGE_PAGE_MM');
    for (const feuille of feuilles(m)) {
      for (const selecteur of ['[data-cartouche]', '[data-mention="relative"]', '[data-marque="echelle"]']) {
        const element = feuille.querySelector(selecteur);
        expect(element, selecteur).not.toBeNull();
        expect(element.closest('[data-contenu]'), selecteur).toBeNull();
      }
      const pied = feuille.querySelector('[data-pied]');
      const cartouche = feuille.querySelector('[data-cartouche]');
      const hors = mm(pied.getBoundingClientRect().height) + mm(cartouche.getBoundingClientRect().height);
      expect(bandeDe(feuille), `feuille ${feuille.dataset.feuille}`).toBeGreaterThan(hors);
      // Le pied, dernier de la bande, finit dans la feuille, au-dessus de
      // sa marge.
      const bas = feuille.getBoundingClientRect().bottom;
      expect(mm(bas - pied.getBoundingClientRect().bottom)).toBeGreaterThanOrEqual(marge - TOLERANCE_MM);
    }
  });

  test('un pied grandi de 20 mm grandit la bande d’autant ; la tuile de chaque page a la hauteur de sa zone de contenu, avant comme après : la découpe reçoit la bande mesurée', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    // Chaque feuille : la hauteur de sa tuile, celle de sa zone de contenu,
    // et sa bande. La bande se mesure en portrait, sur la feuille gabarit :
    // elle ne dépend pas de l'orientation que la découpe choisit.
    const mesurer = () =>
      feuilles(m).map((feuille) => ({
        tuile: mm(tuileDe(feuille).getBoundingClientRect().height),
        contenu: mm(feuille.querySelector('[data-contenu]').getBoundingClientRect().height),
        bande: bandeDe(feuille),
      }));
    const avant = mesurer();
    const feuilleDeStyle = document.createElement('style');
    feuilleDeStyle.textContent = '[data-pied] { padding-bottom: 20mm !important; }';
    document.head.append(feuilleDeStyle);
    try {
      await cliquer(m, '[data-ecran="apercu"] [data-commande="fermerApercu"]');
      await cliquer(m, '[data-ecran="evenement"] [data-commande="apercu"]');
      await attendre('le plan', () => feuilles(m).length > 0, IMAGES);
      const apres = mesurer();
      for (const [quand, pages] of [['avant', avant], ['après', apres]]) {
        for (const [rang, page] of pages.entries()) {
          expect(Math.abs(page.tuile - page.contenu), `${quand}, page ${rang} : ${JSON.stringify(page)}`).toBeLessThanOrEqual(TOLERANCE_MM);
        }
      }
      for (const [rang, page] of apres.entries()) {
        expect(Math.abs(page.bande - avant[0].bande - 20), `page ${rang} : ${page.bande} − ${avant[0].bande}`).toBeLessThanOrEqual(TOLERANCE_MM);
      }
    } finally {
      feuilleDeStyle.remove();
    }
  });
});

describe('le papier ne reçoit aucun geste (§ 11.7, § 13.5)', () => {
  test('aucun identifiant en double dans le document ; sous [data-impression], aucun id hors des motifs, ni tabindex, ni [data-poignee], ni [data-plan]', async () => {
    const m = await ouvrirApercu(contexte, analyser(texteLivre('grande')).charge, { section: 'participants' });
    await attendre('les sièges imprimés', () => tous(m, '[data-impression] [data-siege]').length > 0, IMAGES);
    expect(feuilles(m).length).toBeGreaterThan(1);
    const ids = [...document.querySelectorAll('[id]')].map((e) => e.id);
    expect(ids.filter((id, rang) => ids.indexOf(id) !== rang)).toEqual([]);
    // Les motifs se référencent par leur identifiant (url(#…)) : chaque page
    // a les siens, dans ses <defs>.
    const horsMotifs = tous(m, '[data-impression] [id]').filter((element) => element.closest('defs') === null);
    expect(horsMotifs.map((element) => element.id)).toEqual([]);
    for (const selecteur of ['[tabindex]', '[data-poignee]', '[data-plan]', '[data-table][role]', '[data-siege][role]', '[aria-activedescendant]']) {
      expect(tous(m, `[data-impression] ${selecteur}`), selecteur).toEqual([]);
    }
  });

  test('régime des sièges : chaque chaise de chaque table imprimée, quel que soit le zoom de l’écran', async () => {
    const charge = analyser(texteLivre('grande')).charge;
    const m = await ouvrirApercu(contexte, charge, { section: 'participants' });
    await decouper(m, 'unePage');
    const sieges = new Set(tous(m, '[data-impression] [data-siege]').map((siege) => siege.dataset.siege));
    const attendus = charge.tables.flatMap(({ id }) => {
      const places = tous(m, `[data-impression] [data-table="${id}"] [data-siege]`).length;
      expect(places, `table ${id}`).toBeGreaterThan(0);
      return Array.from({ length: places }, (_, rang) => `${id}:${rang + 1}`);
    });
    expect(sieges).toEqual(new Set(attendus));
  });

  test('les trames de conflit, les cadenas, l’anneau et la hachure se peignent : le noir et blanc se lit par la forme', async () => {
    // La principale, sa proposition : des tables en conflit, une
    // désignation (anneau, cadenas fermé), un titre non pourvu (hachure,
    // cadenas ouvert).
    const m = await ouvrirApercu(contexte, chargePrincipale());
    await attendre('les sièges imprimés', () => tous(m, '[data-impression] [data-siege]').length > 0, IMAGES);
    const peintes = (marque) =>
      tous(m, `[data-impression] [data-marque="${marque}"]`).filter((forme) => {
        const boite = forme.getBoundingClientRect();
        return boite.width > 0 && boite.height > 0 && getComputedStyle(forme).visibility === 'visible';
      });
    const trames = CONFLITS.flatMap(({ marque }) => peintes(marque));
    expect(trames.length, 'trames de conflit').toBeGreaterThan(0);
    for (const trame of trames) expect(getComputedStyle(trame).fill).toMatch(/^url\(/);
    for (const marque of ['cadenasFerme', 'cadenasOuvert', 'anneau', 'hachure', 'contourConflit', 'pastille']) {
      expect(peintes(marque).length, marque).toBeGreaterThan(0);
    }
  });
});

describe('la commande de la vue', () => {
  test('le plan imprimé reprend le tour de l’écran, et le pied le nomme', async () => {
    const charge = chargePrincipale();
    expect(charge.evenement.tours).toBeGreaterThan(1);
    const m = await ouvrirApercu(contexte, charge);
    const choix = dans(m, '[data-ecran="apercu"] [data-champ="tour"]');
    choix.value = '2';
    choix.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('le tour 2', () => m.ui.etat().apercu.tour === 2 && feuilles(m).length > 0, IMAGES);
    for (const feuille of feuilles(m)) {
      expect(plat(feuille.querySelector('[data-pied]').textContent)).toContain(t('impression.pied.tour', { tour: 2 }));
    }
  });
});
