// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les deux seuils de la page de qualité (§ 12.5, § 12.6, § 14.1, § 19.10),
// relevés par le banc au cadre de 1 366 × 700, sur le rendu.
//
// LARGEUR_TRONCATURE_NOM_PX : la largeur rendue du nom de référence, fait de
// LONGUEUR_NOM_REFERENCE fois le glyphe le plus large de l'alphabet visé,
// au corps des étiquettes de graphique. App s'ouvre sur la page de qualité
// d'un événement de deux tables dont une organisation porte ce nom ; la vue
// des collisions l'écrit en intitulé d'une ligne de barres. Les glyphes se
// mesurent un à un par le mesureur des graphiques (creerMesureur) sur
// l'intitulé rendu d'une première ouverture, et nomDeReference (seuils.js)
// compose le nom ; une seconde ouverture le rend entier, à la largeur
// mesurée, dans la marge gauche, avant l'axe. La valeur proposée est cette
// largeur arrondie au pixel supérieur. L'alphabet visé : les lettres
// latines de base, celles du supplément Latin-1 — « × » et « ÷ » exclus —,
// et Œ, œ, Ÿ ; jamais un nom de démonstration, que sa régénération change.
//
// SEUIL_MATRICE_PARTICIPANTS : le plus grand nombre n de participants dont
// la matrice « qui a rencontré qui » se dessine, chaque case d'au moins
// CIBLE_MIN_PX de côté, la dernière colonne dans la largeur de la carte de
// la vue des paires, noms en tête compris. L'événement de n personnes a
// ⌈n / 4⌉ tables de quatre places et trois tours ; une génération courte le
// place, puis App s'ouvre sur la page de qualité, sa proposition montrée.
// Une personne porte le nom de référence, les autres un nom court : la
// colonne des intitulés de ligne a la largeur que le registre suppose au
// plus long. Le côté d'une case se lit sur le rendu, de la gauche d'une
// case à celle de sa voisine. plusGrandTenant (seuils.js) tire le seuil par
// dichotomie sur [MIN, MAX], monotonie relue aux voisins ; deux contrôles
// disent que la mesure bascule : MIN tient, MAX non.
//
// Le registre est remplacé pour ce fichier (vi.mock), toute autre constante
// inchangée : SEUIL_MATRICE_PARTICIPANTS à MAX, pour que le détail porte la
// matrice au-delà du seuil de travail, et LARGEUR_TRONCATURE_NOM_PX à une
// largeur qu'aucun nom n'atteint, pour que l'intitulé ne se tronque pas
// avant d'être mesuré.
//
// Chaque texte mesuré doit être rendu en Noto Sans, sa face chargée : sinon
// la mesure se refuse, valeur proposée null et refus nommé, et l'épreuve
// échoue. Les deux mesures sont des géométries : elles se prennent sans
// ralentissement du processeur.
import { flushSync } from 'svelte';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { appliquerCommande } from '../../src/application/commandes.js';
import { CIBLE_MIN_PX } from '../../src/geometrie/cible.js';
import { CONSTANTES, LONGUEUR_NOM_REFERENCE, constante } from '../../src/geometrie/constantes.js';
import { creerMesureur } from '../../src/interface/plan/mesure_texte.js';
import { rechercher } from '../../src/moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../src/stockage/document.js';
import { VERSION } from '../../src/version.genere.js';
import { attendre, creerContexte, ouvrirEvenement } from '../../test/navigateur/ecrans.js';
import { controlerCadre, ecrireSortie } from './navigateur.js';
import { verifierReleve } from './releve.js';
import { nomDeReference, plusGrandTenant } from './seuils.js';

// Les bornes de la dichotomie du seuil de la matrice : deux tables au
// moins, puis bien au-delà de ce qu'une carte de 1 366 px tient.
const MIN = 8;
const MAX = 120;

// Une largeur d'intitulé qu'aucun nom n'atteint, en px.
const SANS_TRONCATURE_PX = 100_000;

vi.mock('../../src/geometrie/constantes.js', async (importOriginal) => {
  const original = await importOriginal();
  const remplacees = new Map([
    ['SEUIL_MATRICE_PARTICIPANTS', 120],
    ['LARGEUR_TRONCATURE_NOM_PX', 100_000],
  ]);
  return { ...original, constante: (nom) => (remplacees.has(nom) ? remplacees.get(nom) : original.constante(nom)) };
});

const FAMILLE = 'Noto Sans';

// Les points de code de de à a, en texte.
const lettres = (de, a) => String.fromCodePoint(...Array.from({ length: a - de + 1 }, (_, i) => de + i));

/** L'alphabet visé : A–Z, a–z, les lettres du supplément Latin-1 hors
 *  U+00D7 et U+00F7, puis Œ, œ, Ÿ. */
const ALPHABET =
  lettres(0x41, 0x5a) + lettres(0x61, 0x7a) + lettres(0xc0, 0xd6) + lettres(0xd8, 0xf6) + lettres(0xf8, 0xff) + '\u{152}\u{153}\u{178}';

// Les noms courts des autres personnes de la matrice, inventés ; un numéro
// les rend distincts, sans homonyme.
const PRENOMS = Object.freeze(['Iris', 'Théo', 'Ondine', 'Basile', 'Maëlle']);
const ORGANISATIONS = Object.freeze(['Coopérative Aubier', 'Atelier Ressac']);

const sansGuillemets = (texte) => texte.trim().replace(/^(["'])(.*)\1$/, '$2');

/**
 * Un événement de n personnes, ⌈n / 4⌉ tables de quatre places, tours
 * tours, placé par une génération courte enregistrée par la commande.
 * nomDe(i) donne le nom de la personne d'indice i, sans prénom ;
 * organisationDe(i), son organisation.
 */
function evenementPlace({ id, n, tours, nomDe, organisationDe }) {
  const charge = creerCharge({ id, nom: 'Club des Merles', siegesParDefaut: 4, tours });
  charge.participants = Array.from({ length: n }, (_, i) => ({
    id: i + 1,
    nom: nomDe(i),
    prenom: null,
    organisation: organisationDe(i),
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  const tables = Math.ceil(n / 4);
  charge.tables = Array.from({ length: tables }, (_, i) => ({
    id: i + 1,
    numero: i + 1,
    sieges: null,
    forme: 'ronde',
    position: { x: 300 * i, y: 0 },
  }));
  charge.prochainsIds = { participant: n + 1, table: tables + 1, proposition: 1 };
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 3, arret: 20, nombre: 1 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
}

// Huit personnes, deux tables, deux tours : six de l'organisation nommée,
// qui se rencontrent forcément, et deux d'une autre.
const evenementCollisions = (organisation) =>
  evenementPlace({
    id: 'banc-troncature',
    n: 8,
    tours: 2,
    nomDe: (i) => `${PRENOMS[i % PRENOMS.length]} ${i + 1}`,
    organisationDe: (i) => (i < 6 ? organisation : ORGANISATIONS[0]),
  });

// n personnes, la première au nom de référence.
const evenementMatrice = (n, nomReference) =>
  evenementPlace({
    id: `banc-matrice-${n}`,
    n,
    tours: 3,
    nomDe: (i) => (i === 0 ? nomReference : `${PRENOMS[i % PRENOMS.length]} ${i + 1}`),
    organisationDe: (i) => ORGANISATIONS[i % ORGANISATIONS.length],
  });

// La police d'un texte rendu : la première famille calculée, et la face
// 400 de Noto Sans chargée dans le document.
function policeDe(texte) {
  const premiere = sansGuillemets(getComputedStyle(texte).fontFamily.split(',')[0]);
  const chargee = [...document.fonts].some((face) => sansGuillemets(face.family) === FAMILLE && face.weight === '400' && face.status === 'loaded');
  return { premiere, chargee };
}

// L'intitulé rendu de la ligne de barres de l'organisation donnée, dans la
// vue des collisions ; le graphique et son axe avec lui.
const intituleDe = (m, organisation) =>
  attendre(`l’intitulé de « ${organisation} »`, () => {
    const graphique = m.racine.querySelector('[data-vue-qualite="collisions"] [data-graphique="collisions"]');
    const ligne = [...(graphique?.querySelectorAll('[data-ligne-graphique]') ?? [])].find((l) => l.dataset.ligneGraphique === organisation);
    const texte = ligne?.querySelector(':scope > text') ?? null;
    const axe = graphique?.querySelector('[data-marque="graphiqueAxe"]') ?? null;
    return texte !== null && texte.textContent !== '' && axe !== null ? { texte, axe } : null;
  });

// Les polices de chaque texte mesuré, dans l'ordre des mesures.
const polices = [];
// Les relevés de chaque appel du prédicat de la matrice, dans l'ordre.
const sondes = [];

let reference = null;
let troncature = null;
let seuilMatrice = null;

/**
 * Le prédicat de la matrice : pour n personnes, la grille se dessine-t-elle,
 * chaque case d'au moins CIBLE_MIN_PX, la dernière colonne et l'intitulé du
 * nom de référence dans la carte de la vue ? Monte, mesure, défait. Lève si
 * la vue montre la phrase du seuil : le remplacement du registre n'aurait
 * pas pris.
 */
async function tient(n) {
  const contexte = creerContexte();
  try {
    const m = await ouvrirEvenement(contexte, evenementMatrice(n, reference.nom), { section: 'qualite' });
    const rendu = await attendre(`la matrice de ${n} personnes ou sa phrase`, () => {
      const vue = m.racine.querySelector('[data-vue-qualite="paires"]');
      if (vue === null) return null;
      if (vue.querySelector('[data-phrase-qualite="matriceSeuil"]') !== null) throw new Error('phrase du seuil : le registre de ce fichier n’a pas pris');
      if (vue.querySelector('[data-phrase-qualite="matriceEtroite"]') !== null) return { vue, grille: null };
      const grille = vue.querySelector('[data-graphique="matrice"]');
      return grille !== null && grille.querySelectorAll('[data-case]').length === n * n ? { vue, grille } : null;
    });
    flushSync();
    const carte = rendu.vue.getBoundingClientRect();
    if (rendu.grille === null) {
      sondes.push({ participants: n, dessinee: false, cotePx: null, largeurCartePx: carte.width, tient: false });
      return false;
    }
    // La bordure d'une case de la première ligne : un trait d'un pixel posé
    // au même retrait dans chaque case, si bien que deux bordures voisines
    // sont distantes d'un côté de case.
    const bordure = (colonne) =>
      rendu.grille.querySelector(`[data-case="0:${colonne}"] [data-marque="graphiqueBordureCase"]`).getBoundingClientRect();
    const cote = bordure(1).left - bordure(0).left;
    const droite = bordure(n - 1).right;
    const intitule = [...rendu.grille.querySelectorAll('text')].find((texte) => texte.textContent.endsWith(`. ${reference.nom}`));
    if (intitule === undefined) throw new Error(`matrice de ${n} personnes : l’intitulé du nom de référence n’est pas rendu`);
    polices.push(policeDe(intitule));
    const gauche = intitule.getBoundingClientRect().left;
    const resultat = cote >= CIBLE_MIN_PX && droite <= carte.right && gauche >= carte.left;
    sondes.push({ participants: n, dessinee: true, cotePx: cote, largeurCartePx: carte.width, tient: resultat });
    return resultat;
  } finally {
    await contexte.defaire();
  }
}

beforeAll(async () => {
  await controlerCadre();
});

describe('les deux seuils de la page de qualité (§ 12.5, § 12.6, § 14.1)', () => {
  test('le registre de ce fichier porte les deux seuils remplacés, les autres constantes inchangées', () => {
    expect(constante('SEUIL_MATRICE_PARTICIPANTS')).toBe(MAX);
    expect(constante('LARGEUR_TRONCATURE_NOM_PX')).toBe(SANS_TRONCATURE_PX);
    expect(constante('SEUIL_SIEGES_LISIBLES')).toBe(CONSTANTES.find(({ nom }) => nom === 'SEUIL_SIEGES_LISIBLES').valeur);
  });

  test(`le nom de référence : ${LONGUEUR_NOM_REFERENCE} fois le glyphe le plus large de l’alphabet visé, au corps des étiquettes de graphique`, async () => {
    const contexte = creerContexte();
    try {
      const m = await ouvrirEvenement(contexte, evenementCollisions(ORGANISATIONS[1]), { section: 'qualite' });
      const { texte } = await intituleDe(m, ORGANISATIONS[1]);
      polices.push(policeDe(texte));
      reference = nomDeReference(ALPHABET, LONGUEUR_NOM_REFERENCE, creerMesureur(texte));
    } finally {
      await contexte.defaire();
    }
    expect([...reference.nom]).toHaveLength(LONGUEUR_NOM_REFERENCE);
    expect(ALPHABET).toContain(reference.glyphe);
  });

  test('le nom de référence s’écrit entier dans la marge gauche d’une vue à barres, à la largeur mesurée', async () => {
    expect(reference).not.toBeNull();
    const contexte = creerContexte();
    try {
      const m = await ouvrirEvenement(contexte, evenementCollisions(reference.nom), { section: 'qualite' });
      const { texte, axe } = await intituleDe(m, reference.nom);
      polices.push(policeDe(texte));
      const boite = texte.getBBox();
      const marge = Number(axe.getAttribute('x1'));
      const rendue = texte.getComputedTextLength();
      troncature = { rendue, droite: boite.x + boite.width, marge };
      expect(texte.textContent).toBe(reference.nom);
      expect(Math.abs(rendue - reference.largeur)).toBeLessThan(0.5);
      expect(troncature.droite).toBeLessThanOrEqual(marge);
    } finally {
      await contexte.defaire();
    }
  });

  test(`la matrice : ${MIN} personnes tiennent, ${MAX} non — la mesure bascule`, async () => {
    expect(reference).not.toBeNull();
    expect(await tient(MIN)).toBe(true);
    expect(await tient(MAX)).toBe(false);
  });

  test(`la matrice : le plus grand nombre de personnes dont les cases tiennent ${CIBLE_MIN_PX} px dans la carte, par dichotomie sur [${MIN}, ${MAX}]`, async () => {
    seuilMatrice = await plusGrandTenant(tient, MIN, MAX);
    expect(seuilMatrice).toBeGreaterThanOrEqual(MIN);
    expect(seuilMatrice).toBeLessThan(MAX);
  });

  test('les mesures s’écrivent dans scripts/banc/sorties/qualite.json, relues telles quelles, et se rangent dans un relevé', async () => {
    expect(polices.length).toBeGreaterThan(0);
    const fautive = polices.find(({ premiere, chargee }) => premiere !== FAMILLE || !chargee);
    const police = fautive === undefined ? FAMILLE : null;
    const refus = police === null ? `police des étiquettes ${fautive.premiere}${fautive.chargee ? '' : ', non chargée'} : la mesure se prend sur ${FAMILLE}` : null;
    const matrice = {
      nom: 'SEUIL_MATRICE_PARTICIPANTS',
      unite: 'participants',
      valeurProposee: refus === null && Number.isInteger(seuilMatrice) ? seuilMatrice : null,
      critere:
        `le plus grand nombre de participants dont la matrice se dessine, chaque case d’au moins ${CIBLE_MIN_PX} px, la dernière ` +
        `colonne et les intitulés dans la carte de la vue des paires, un nom de référence en tête ; ` +
        `⌈n / 4⌉ tables de quatre places, trois tours ; dichotomie sur [${MIN}, ${MAX}]`,
      police,
      ralentissementCpu: 1,
      sondes: sondes.map((sonde) => ({ ...sonde })),
      refus,
    };
    const largeur = {
      nom: 'LARGEUR_TRONCATURE_NOM_PX',
      unite: 'px',
      valeurProposee: refus === null && reference !== null && troncature !== null ? reference.valeur : null,
      critere:
        `la largeur rendue de ${LONGUEUR_NOM_REFERENCE} fois le glyphe le plus large de l’alphabet visé — lettres latines de base, ` +
        'supplément Latin-1, Œ, œ, Ÿ —, intitulé entier d’une ligne de la vue des collisions, arrondie au pixel supérieur',
      police,
      ralentissementCpu: 1,
      glyphe: reference?.glyphe ?? null,
      largeurGlyphePx: reference?.largeurGlyphe ?? null,
      nomReference: reference?.nom ?? null,
      largeurNomPx: reference?.largeur ?? null,
      largeurRenduePx: troncature?.rendue ?? null,
      droiteIntitulePx: troncature?.droite ?? null,
      axePx: troncature?.marge ?? null,
      refus,
    };
    const objet = { format: 1, mesures: [matrice, largeur] };
    const releve = {
      format: 1,
      configuration: {
        cadre: { largeur: innerWidth, hauteur: innerHeight },
        facteurEchelle: devicePixelRatio,
        navigateur: null,
        node: null,
        processeursLogiques: null,
        ralentissementCpu: 1,
        police,
      },
      mesures: objet.mesures,
    };
    expect(verifierReleve(releve, CONSTANTES)).toEqual([]);
    await ecrireSortie('qualite', objet);
    expect(JSON.parse(await commands.readFile('scripts/banc/sorties/qualite.json'))).toEqual(objet);
    expect(refus).toBeNull();
    expect(matrice.valeurProposee).not.toBeNull();
    expect(largeur.valeurProposee).not.toBeNull();
  });
});
