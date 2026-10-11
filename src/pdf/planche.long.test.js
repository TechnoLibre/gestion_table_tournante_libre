// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La production de la planche aux comptes qui séparent troncature et
// arrondi par excès (§ 11.2, § 14.2), sur les deux papiers et les deux
// impositions, relue dans l'ordre des noms de la couche de texte ; la
// planche Lettre pleine, ses badges à plat dans leur zone de silence ; le
// témoin de 257 badges ; une feuille de contrôle plus longue qu'une page.
// Chaque production se chronomètre : la durée de la planche entière est un
// coût que le rapport de la tâche relève, jamais une donnée écrite.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { lirePdf } from '../../test/pdf.js';
import { lirePolices } from '../../test/polices.js';
import { describe, test } from '../../test/lanceur.js';
import { libelle } from '../application/libelles.js';
import { textesControle } from '../application/planche.js';
import { constante } from '../geometrie/constantes.js';
import { PAPIERS } from '../geometrie/papiers.js';
import { VERSION } from '../version.genere.js';
import { cadreUtile, cellules, filets, imposer, nombrePlanches } from './imposition.js';
import { produirePlanche } from './planche.js';

const ZONE = constante('ZONE_SILENCE_MM');
const MARGE = constante('MARGE_PAGE_MM');
const TOLERANCE = 1e-6;
const FILIGRANE = libelle('planche.brouillon');
const polices = lirePolices();
const EVENEMENT = { nom: 'Souper du Club des Merles', date: '2026-10-09' };
const HORODATAGE = '2026-10-09T19:00:00-04:00';

/** Le nom du badge de rang i : « Témoin 001 »… */
const nomTemoin = (i) => `Témoin ${String(i + 1).padStart(3, '0')}`;

/** Un modèle de n badges écrit à la main, chacun à trois tours. */
function modele(n, { brouillon = false, reedition = false } = {}) {
  const ligneHorodatage = libelle('planche.pied.horodatage', { horodatage: HORODATAGE });
  const badges = Array.from({ length: n }, (_, i) => {
    const lignes = [1, 2, 3].map((tour) => ({ tour, table: ((i + tour) % 30) + 1, siege: null, titre: null }));
    return {
      participant: i + 1,
      nom: nomTemoin(i),
      appartenance: i % 3 === 0 ? 'Club des Merles' : null,
      lignes,
      identifiant: null,
      textes: {
        nom: nomTemoin(i),
        lignes: lignes.map((ligne) => libelle('planche.tour', ligne)),
        appartenance: i % 3 === 0 ? 'Club des Merles' : null,
        pied: [libelle('planche.pied.evenement', EVENEMENT), ligneHorodatage],
        piedReduit: [libelle('planche.pied.date', EVENEMENT), ligneHorodatage],
      },
    };
  });
  return {
    badges,
    source: 'retenu',
    proposition: null,
    evenement: EVENEMENT,
    horodatage: HORODATAGE,
    brouillon,
    comptes: { participants: n, exclus: 0, produits: n },
    homonymes: [],
    reedition: reedition ? { ids: badges.map(({ participant }) => participant) } : null,
    version: VERSION.affichee,
  };
}

// Les durées relevées, imprimées par la dernière épreuve.
const durees = [];

/** Une production chronométrée, relue. */
async function produireEtLire(m, papier, imposition) {
  const controle = textesControle(m, { papier, imposition, planches: nombrePlanches(m.badges.length, papier) });
  const debut = performance.now();
  const octets = await produirePlanche({ modele: m, papier, imposition, polices, controle, filigrane: FILIGRANE });
  durees.push({ cas: `${papier} ${imposition} n = ${m.badges.length}`, ms: performance.now() - debut });
  return lirePdf(octets);
}

const centre = ({ x, y, l, h }) => [x + l / 2, y + h / 2];
const dans = ([cx, cy], { x, y, largeur, hauteur }) => cx > x && cx < x + largeur && cy > y && cy < y + hauteur;

// Les noms lus dans chaque cellule de chaque page de planche ; null pour une
// cellule sans nom.
function nomsLus(pages, papier) {
  const toutes = cellules(papier);
  return pages.map((page) =>
    toutes.map((cellule) => {
      const lus = page.textes.filter((t) => t.texte.startsWith('Témoin ') && dans(centre(t), cellule)).map((t) => t.texte);
      assert.ok(lus.length <= 1, lus.join(', '));
      return lus[0] ?? null;
    }),
  );
}

// La distance d'une boîte de texte à un segment parallèle à un axe.
function distance({ x, y, l, h }, { x1, y1, x2, y2 }) {
  const dx = Math.max(0, Math.min(x1, x2) - (x + l), x - Math.max(x1, x2));
  const dy = Math.max(0, Math.min(y1, y2) - (y + h), y - Math.max(y1, y2));
  return Math.hypot(dx, dy);
}

const PAGINATION = [
  ...[1, 4, 5, 259, 261].map((n) => ({ papier: 'A4', n })),
  ...[1, 2, 3, 257].map((n) => ({ papier: 'Lettre', n })),
];

describe('produirePlanche : la pagination aux bords (§ 11.2)', () => {
  for (const { papier, n } of PAGINATION) {
    for (const imposition of ['feuille', 'pile']) {
      test(`${papier}, ${imposition}, n = ${n} : une page de contrôle, puis les planches, les noms dans l'ordre d'imposer`, async () => {
        const lu = await produireEtLire(modele(n), papier, imposition);
        assert.equal(lu.pages.length, 1 + nombrePlanches(n, papier));
        const attendu = imposer(n, papier, imposition).map((planche) => planche.map((i) => (i === null ? null : nomTemoin(i))));
        assert.deepEqual(nomsLus(lu.pages.slice(1), papier), attendu);
      });
    }
  }
});

describe('produirePlanche : la géométrie du Lettre et le témoin (§ 11.2, § 11.3)', () => {
  test('Lettre pleine, brouillon : badges à plat, cinq axes, chaque texte dans le cadre utile de sa cellule et hors de la zone de silence', async () => {
    const lu = await produireEtLire(modele(2, { brouillon: true }), 'Lettre', 'feuille');
    const [planche] = lu.pages.slice(1);
    assert.equal(filets('Lettre', [true, true]).length, 5);
    assert.equal(planche.segments.length, 5);
    const lesCellules = cellules('Lettre');
    const { largeur: W, hauteur: H } = PAPIERS.Lettre;
    const axes = [
      ...filets('Lettre', [true, true]),
      { x1: 0, y1: 0, x2: W, y2: 0 },
      { x1: 0, y1: H, x2: W, y2: H },
      { x1: 0, y1: 0, x2: 0, y2: H },
      { x1: W, y1: 0, x2: W, y2: H },
    ];
    for (const fragment of planche.textes) {
      const cellule = lesCellules.find((c) => dans(centre(fragment), c));
      assert.ok(cellule !== undefined && cellule.aPlat, JSON.stringify(fragment));
      const cadre = cadreUtile(cellule);
      const dedans =
        fragment.x >= cadre.x - TOLERANCE &&
        fragment.y >= cadre.y - TOLERANCE &&
        fragment.x + fragment.l <= cadre.x + cadre.largeur + TOLERANCE &&
        fragment.y + fragment.h <= cadre.y + cadre.hauteur + TOLERANCE;
      assert.ok(dedans, `« ${fragment.texte} » ${JSON.stringify(fragment)} hors de ${JSON.stringify(cadre)}`);
      assert.ok(Math.min(...axes.map((axe) => distance(fragment, axe))) >= ZONE - TOLERANCE, fragment.texte);
    }
    // À plat, un texte droit monte : sa boîte est plus haute que large.
    for (const nom of planche.textes.filter(({ texte }) => texte.startsWith('Témoin '))) assert.ok(nom.h > nom.l);
    assert.equal(planche.textes.filter(({ texte }) => texte === FILIGRANE).length, 2);
  });

  test('témoin de 257 badges : 66 pages en A4, 130 en Lettre, feuille de contrôle comprise', async () => {
    const temoin = modele(257);
    assert.equal((await produireEtLire(temoin, 'A4', 'feuille')).pages.length, 66);
    assert.equal((await produireEtLire(temoin, 'Lettre', 'pile')).pages.length, 130);
  });
});

describe('produirePlanche : une feuille de contrôle plus longue qu\u{2019}une page (§ 11.3)', () => {
  test('les lignes qui débordent continuent sur une page de contrôle sans règle ni filet, avant les planches, chaque page remplie dans ses marges', async () => {
    const m = modele(150, { brouillon: true, reedition: true });
    const controle = textesControle(m, { papier: 'A4', imposition: 'feuille', planches: nombrePlanches(150, 'A4') });
    const lu = await produireEtLire(m, 'A4', 'feuille');
    const planches = nombrePlanches(150, 'A4');
    const pagesControle = lu.pages.length - planches;
    assert.ok(pagesControle >= 2, `${pagesControle} page(s) de contrôle`);
    // Le filigrane se reconnaît à sa boîte : tourné, il est plus haut
    // qu'aucune ligne de contrôle.
    const estFiligrane = ({ texte, h }) => texte === FILIGRANE && h > 20;
    const controleLu = lu.pages
      .slice(0, pagesControle)
      .flatMap(({ textes }) => textes.filter((t) => !estFiligrane(t)).map(({ texte }) => texte));
    // Chaque ligne une fois, dans l'ordre, après les chiffres de la règle.
    assert.deepEqual(controleLu, ['0', '50', '100', ...controle]);
    for (const page of lu.pages.slice(0, pagesControle)) assert.equal(page.textes.filter(estFiligrane).length, 1);
    for (const page of lu.pages.slice(1, pagesControle)) assert.deepEqual(page.segments, []);
    // Chaque texte des pages de contrôle dans les quatre marges : la page
    // de suite commence sous la marge haute, et une page ne se remplit que
    // jusqu'à la marge basse — la ligne qui la passerait part à la suivante.
    const { largeur: W, hauteur: H } = PAPIERS.A4;
    lu.pages.slice(0, pagesControle).forEach((page, rang) => {
      for (const { texte, x, y, l, h } of page.textes) {
        const dedans = x >= MARGE - TOLERANCE && y >= MARGE - TOLERANCE && x + l <= W - MARGE + TOLERANCE && y + h <= H - MARGE + TOLERANCE;
        assert.ok(dedans, `page ${rang + 1} : « ${texte} » en ${JSON.stringify({ x, y, l, h })}`);
      }
    });
    const attendu = imposer(150, 'A4', 'feuille').map((planche) => planche.map((i) => (i === null ? null : nomTemoin(i))));
    assert.deepEqual(nomsLus(lu.pages.slice(pagesControle), 'A4'), attendu);
  });
});

describe('produirePlanche : les durées', () => {
  test('chaque production relevée a sa durée', () => {
    assert.ok(durees.length > 0);
    console.log(durees.map(({ cas, ms }) => `${cas} : ${Math.round(ms)} ms`).join('\n'));
  });
});
