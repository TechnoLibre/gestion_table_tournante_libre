// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les deux vues des animateurs dans un vrai moteur de rendu (§ 12.13, B22,
// D37, D38) : le profil des animateurs rencontrés, une série et la borne en
// repère pointillé, sans manque ni pourcentage ; la diversité par animateur,
// la soirée en deux colonnes juxtaposées, chacune son axe, le moins varié en
// tête, les trois nombres de chaque colonne, et le jumeau qui porte chaque
// tour animé. Chaque vue se monte seule, par mount, avec les contextes que
// pose App — 't' et 'format' —, sur le détail d'une génération faite dans
// le navigateur. Le rendu se lit par ses attributs data-… et son texte,
// jamais par une classe. Les noms d'épreuve sont inventés.
import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import '../jetons.css';
import { appliquerCommande } from '../../application/commandes.js';
import { configurationDe } from '../../application/configuration.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { TABLES_INTERFACE } from '../libelles.js';
import VueAnimateurs from './VueAnimateurs.svelte';
import VueDiversite from './VueDiversite.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const CONTEXTE = new Map([
  ['t', t],
  ['format', format],
]);
const V1 = VERSION.affichee;

// Neuf personnes inventées, leurs organisations et leurs étiquettes.
const PERSONNES = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier', []],
  ['Pervenche', 'Théo', 'Atelier Ressac', []],
  ['Lacasse', 'Ondine', 'Atelier Ressac', ['finance']],
  ['Tourteau', 'Basile', 'Coopérative Aubier', ['bénévole']],
  ['Quenouille', 'Maëlle', 'Atelier Ressac', ['finance', 'Montréal']],
  ['Rocaille', 'Anselme', null, ['bénévole']],
  ['Brindille', 'Pélagie', 'Coopérative Aubier', []],
  ['Cassonade', 'Firmin', null, ['Montréal']],
  ['Grésil', 'Ysaline', 'Atelier Ressac', []],
];

// Trois tables de trois places, trois tours ; un titre au siège 1 des tables
// 1 et 2. Iris Ombrelle, réservée à la table 1 pour la soirée, y anime à
// chaque tour ; Théo Pervenche, réservé à la table 2 au seul tour 2, y anime
// ce tour-là, avec Ondine Lacasse et Ysaline Grésil, réservées à sa table à
// ce tour : une organisation et une étiquette, moins qu'Iris Ombrelle sur sa
// soirée, de sorte que le moins varié et le plus varié diffèrent dans chaque
// colonne. organisations : false pour une seule organisation ; etiquettes :
// false pour aucune ; titres : false pour aucun animateur.
function chargeAnimateurs({ organisations = true, etiquettes = true, titres = true } = {}) {
  const charge = creerCharge({ id: 'evt-animateurs', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 3 });
  charge.participants = PERSONNES.map(([nom, prenom, organisation, liste], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: organisations ? organisation : 'Coopérative Aubier',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(etiquettes && liste.length > 0 ? { etiquettes: liste } : {}),
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id + 10, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  if (titres) {
    charge.titres = [1, 2].map((table) => ({ table, siege: 1, libelle: 'Animation' }));
    charge.reservations = [
      { participant: 1, table: 1, siege: null, portee: 'tous', tour: null },
      { participant: 2, table: 2, siege: null, portee: 'tour', tour: 2 },
      { participant: 3, table: 2, siege: null, portee: 'tour', tour: 2 },
      { participant: 9, table: 2, siege: null, portee: 'tour', tour: 2 },
    ];
  }
  charge.reglages.rencontrerAnimateurs = true;
  charge.prochainsIds = { participant: 10, table: 4, proposition: 1 };
  return charge;
}

// Le détail de la première proposition d'une génération.
function detailDe(options) {
  const charge = chargeAnimateurs(options);
  const configuration = configurationDe(charge);
  const propositions = rechercher(configuration, { graine: 11, nombre: 1, arret: 200 });
  const generee = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
  return detaillerQualite(generee, generee.propositions[0].id);
}

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

// Monte une vue sur un détail, dans un conteneur de 900 px au début du
// corps, puis laisse son graphique mesurer sa largeur et son texte ; rend
// l'élément [data-vue-qualite] de la vue.
async function monter(Vue, detail) {
  const cible = document.createElement('div');
  cible.style.width = '900px';
  document.body.prepend(cible);
  const composant = mount(Vue, { target: cible, props: { detail, ligne: null, table: null }, context: CONTEXTE });
  montes.push({ composant, cible });
  for (let i = 0; i < 3; i += 1) {
    flushSync();
    await tick();
  }
  return cible.querySelector('[data-vue-qualite]');
}

// Ouvre le jumeau de la vue par sa commande ; rend ses tableaux.
async function ouvrirJumeau(vue) {
  vue.querySelector('[data-commande="ouvrirJumeau"]').click();
  flushSync();
  await tick();
  return [...vue.querySelectorAll('[data-jumeau]')];
}

const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const nombre = (texte) => Number(texte.replace(/\D/g, ''));

// Les cellules d'une rangée de tableau, par la clé de leur colonne.
const cellules = (rangee) => Object.fromEntries([...rangee.children].map((cellule) => [cellule.dataset.colonne, texteDe(cellule)]));

describe('animateurs rencontrés : le profil (§ 12.13, D37)', () => {
  test('une seule série et la borne des animateurs en repère pointillé ; la synthèse au minimum ; le jumeau, une ligne par personne concernée', async () => {
    const detail = detailDe();
    const vue = await monter(VueAnimateurs, detail);
    const svg = vue.querySelector('svg[data-graphique="animateurs"]');
    expect(svg.querySelectorAll('path[data-serie]').length).toBe(1);
    expect(svg.querySelector('path[data-serie]').dataset.serie).toBe('serie1');
    expect([...svg.querySelectorAll('path[data-repere]')].map((trace) => trace.dataset.repere)).toEqual(['borne']);
    const [premiere] = detail.animateurs.repartition;
    expect(texteDe(vue)).toContain(t('qualite.animateurs.synthese', { minimum: premiere.valeur, effectif: premiere.effectif }));
    const [profil, repartition] = await ouvrirJumeau(vue);
    expect(profil.querySelectorAll('tbody tr').length).toBe(detail.animateurs.profil.length);
    expect(repartition.querySelectorAll('tbody tr').length).toBe(detail.animateurs.repartition.length);
    expect(
      [...profil.querySelectorAll('thead th')].map((th) => th.dataset.colonne),
    ).toEqual(['nom', 'rencontres', 'borne', 'statut']);
  });

  test('rouge : ni pourcentage de la borne, ni manque, ni « plafond », le jumeau ouvert compris', async () => {
    const vue = await monter(VueAnimateurs, detailDe());
    await ouvrirJumeau(vue);
    expect(vue.querySelector('[data-pourcentage]')).toBeNull();
    expect(texteDe(vue)).not.toMatch(/%|plafond|manque/i);
  });

  test('sans animateur : la phrase, aucun graphique', async () => {
    const vue = await monter(VueAnimateurs, detailDe({ titres: false }));
    expect(texteDe(vue.querySelector('[data-phrase-qualite="animateurs.aucun"]'))).toBe(t('qualite.animateurs.aucun'));
    expect(vue.querySelector('svg')).toBeNull();
  });
});

describe('diversité par animateur (§ 12.13, D38)', () => {
  test('rouge : deux colonnes juxtaposées, chacune son axe, jamais empilées ; la soirée, le moins varié en tête', async () => {
    const detail = detailDe();
    const { lignes } = detail.animateurs.diversite;
    const vue = await monter(VueDiversite, detail);
    const svg = vue.querySelector('svg[data-graphique="diversite"]');
    expect(svg.querySelectorAll('line[data-marque="graphiqueAxe"]').length).toBe(2);
    const barres = [...svg.querySelectorAll('[data-ligne-graphique]')];
    expect(barres.map((ligne) => Number(ligne.dataset.ligneGraphique))).toEqual(lignes.map(({ id }) => id));
    expect(lignes[0].organisations).toBeLessThan(lignes[1].organisations);
    const fins = [...svg.querySelectorAll('rect[data-segment="serie1"]')].map((rect) => rect.x.baseVal.value + rect.width.baseVal.value);
    const debuts = [...svg.querySelectorAll('rect[data-segment="serie2"]')].map((rect) => rect.x.baseVal.value);
    expect(fins.length).toBeGreaterThan(0);
    expect(debuts.length).toBeGreaterThan(0);
    expect(Math.min(...debuts)).toBeGreaterThan(Math.max(...fins));
    barres.forEach((ligne, rang) => {
      const { toursAnimes, personnes } = lignes[rang];
      expect(texteDe(ligne)).toContain(t('qualite.diversite.secondaire', { tours: toursAnimes, personnes }));
    });
  });

  test('au-dessus de chaque colonne, ses trois nombres : le moins varié, le plus varié, au minimum', async () => {
    const detail = detailDe();
    const vue = await monter(VueDiversite, detail);
    const { equite } = detail.animateurs.diversite;
    for (const genre of ['organisations', 'etiquettes']) {
      // Les deux animateurs diffèrent : chaque nombre se lit à sa place.
      expect(equite[genre].moins, genre).toBeLessThan(equite[genre].plus);
      const bloc = vue.querySelector(`[data-equite="${genre}"]`);
      expect([...bloc.querySelectorAll('dt')].map(texteDe)).toEqual([
        t('qualite.diversite.moins'),
        t('qualite.diversite.plus'),
        t('qualite.diversite.auMinimum'),
      ]);
      expect([...bloc.querySelectorAll('dd')].map(texteDe)).toEqual(
        [equite[genre].moins, equite[genre].plus, equite[genre].auMinimum].map((valeur) => format.nombre(valeur)),
      );
    }
    // Au-dessus : chaque bloc précède le graphique dans le document. Dans
    // l'ordre des colonnes : organisations, la série 1 à gauche du dessin,
    // puis étiquettes, la série 2 à sa droite, à l'écran comme au document.
    const svg = vue.querySelector('svg[data-graphique="diversite"]');
    const blocs = [...vue.querySelectorAll('[data-equite]')];
    expect(blocs.map((bloc) => bloc.dataset.equite)).toEqual(['organisations', 'etiquettes']);
    for (const bloc of blocs) {
      expect(bloc.compareDocumentPosition(svg) & Node.DOCUMENT_POSITION_FOLLOWING, bloc.dataset.equite).toBeTruthy();
      expect(bloc.getBoundingClientRect().bottom, bloc.dataset.equite).toBeLessThanOrEqual(svg.getBoundingClientRect().top);
    }
    const [gauche, droite] = blocs.map((bloc) => bloc.getBoundingClientRect().left);
    expect(gauche).toBeLessThan(droite);
  });

  test('rouge : le jumeau porte la soirée de chaque animateur puis une ligne par tour animé, chacune au plus la soirée', async () => {
    const detail = detailDe();
    const { lignes } = detail.animateurs.diversite;
    const vue = await monter(VueDiversite, detail);
    const [jumeau] = await ouvrirJumeau(vue);
    const rangees = [...jumeau.querySelectorAll('tbody tr')].map(cellules);
    expect(rangees.length).toBe(lignes.reduce((somme, ligne) => somme + 1 + ligne.toursAnimes, 0));
    let rang = 0;
    for (const ligne of lignes) {
      const soiree = rangees[rang];
      expect(soiree.portee).toBe(t('qualite.diversite.soiree'));
      expect(nombre(soiree.toursAnimes)).toBe(ligne.toursAnimes);
      for (let k = 1; k <= ligne.toursAnimes; k += 1) {
        const tour = rangees[rang + k];
        expect(tour.animateur).toBe(soiree.animateur);
        expect(tour.portee).not.toBe(t('qualite.diversite.soiree'));
        for (const cle of ['personnes', 'organisations', 'etiquettes']) {
          expect(nombre(tour[cle]), `${tour.animateur}, ${tour.portee}, ${cle}`).toBeLessThanOrEqual(nombre(soiree[cle]));
        }
      }
      rang += 1 + ligne.toursAnimes;
    }
    expect(texteDe(vue)).not.toMatch(/équité|plafond|%/i);
  });

  test('une seule organisation et des étiquettes : la colonne des étiquettes seule, et la phrase', async () => {
    const detail = detailDe({ organisations: false });
    const vue = await monter(VueDiversite, detail);
    expect(vue.querySelector('[data-phrase-qualite="diversite.sansOrganisation"]')).not.toBeNull();
    expect(vue.querySelector('[data-equite="organisations"]')).toBeNull();
    expect(vue.querySelector('[data-equite="etiquettes"]')).not.toBeNull();
    const svg = vue.querySelector('svg[data-graphique="diversite"]');
    expect(svg.querySelectorAll('line[data-marque="graphiqueAxe"]').length).toBe(1);
    expect(svg.querySelectorAll('rect[data-segment="serie1"]').length).toBe(0);
    expect(svg.querySelectorAll('rect[data-segment="serie2"]').length).toBeGreaterThan(0);
  });

  test('aucune étiquette : la colonne des organisations seule, et la phrase', async () => {
    const vue = await monter(VueDiversite, detailDe({ etiquettes: false }));
    expect(vue.querySelector('[data-phrase-qualite="diversite.sansEtiquette"]')).not.toBeNull();
    expect(vue.querySelector('[data-equite="etiquettes"]')).toBeNull();
    expect(vue.querySelectorAll('svg rect[data-segment="serie2"]').length).toBe(0);
  });

  test('ni étiquette ni plus d’une organisation : la phrase, aucun graphique, le jumeau garde tours animés et personnes', async () => {
    const vue = await monter(VueDiversite, detailDe({ organisations: false, etiquettes: false }));
    expect(vue.querySelector('[data-phrase-qualite="diversite.rien"]')).not.toBeNull();
    expect(vue.querySelector('svg')).toBeNull();
    expect(vue.querySelector('[data-equite]')).toBeNull();
    const [jumeau] = await ouvrirJumeau(vue);
    expect([...jumeau.querySelectorAll('thead th')].map((th) => th.dataset.colonne)).toEqual([
      'animateur',
      'portee',
      'toursAnimes',
      'personnes',
    ]);
  });

  test('sans animateur : la phrase seule', async () => {
    const vue = await monter(VueDiversite, detailDe({ titres: false }));
    expect(vue.querySelector('[data-phrase-qualite="diversite.aucunAnimateur"]')).not.toBeNull();
    expect(vue.querySelector('[data-commande="ouvrirJumeau"]')).toBeNull();
  });
});
