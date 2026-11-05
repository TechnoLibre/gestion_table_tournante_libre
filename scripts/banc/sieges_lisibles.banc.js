// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le nombre de sièges lisibles (§ 6.2, § 14.1, § 19.10), relevé par le
// banc : le plus grand nombre de places d'une table seule dont la liste de
// noms tient dans la hauteur du plan, au zoom ajusté, sur le cadre de
// 1 366 × 700. La liste a une ligne par siège, à la hauteur de ligne mesurée
// sur la police rendue ; elle part du haut de la table, à sa droite, et
// l'ajustement ne cadre que la table : passé un nombre de places, le bas de
// la liste sort du <svg data-plan>.
//
// Le prédicat monte App sur un événement d'une seule table de n places,
// ronde puis carrée, ouvre le plan, et compare le bas de la boîte de
// [data-liste] à celui du <svg data-plan>. plusGrandTenant (seuils.js) en
// tire le seuil par dichotomie sur [2, 200], monotonie relue aux voisins ;
// la valeur proposée est le plus petit des deux seuils. Deux contrôles
// disent que la mesure bascule : n = 2 tient, n = 200 ne tient pas.
//
// Les listes se dessinent à tout zoom : le registre est remplacé pour ce
// fichier, K_LISTES à 0 (vi.mock), toute autre constante inchangée. Le seuil
// de places est une géométrie, qui ne dépend pas du zoom où le plan retire
// ses listes, constante manuelle (Q12) ; sans le remplacement, une table de
// 200 places s'ajuste sous K_LISTES et n'a plus de liste à mesurer.
//
// La famille calculée des listes doit être Noto Sans, et sa face chargée
// (C8) : sinon la mesure se refuse, valeur proposée null et refus nommé, et
// l'épreuve échoue. Une mesure de texte prise sur une police de repli
// donnerait deux valeurs sur deux hôtes.
import { flushSync } from 'svelte';
import { beforeAll, describe, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { CONSTANTES, constante } from '../../src/geometrie/constantes.js';
import { creerCharge } from '../../src/stockage/document.js';
import { creerContexte, ouvrirEvenement } from '../../test/navigateur/ecrans.js';
import { controlerCadre, ecrireSortie } from './navigateur.js';
import { verifierReleve } from './releve.js';
import { plusGrandTenant } from './seuils.js';

vi.mock('../../src/geometrie/constantes.js', async (importOriginal) => {
  const original = await importOriginal();
  return { ...original, constante: (nom) => (nom === 'K_LISTES' ? 0 : original.constante(nom)) };
});

const FAMILLE = 'Noto Sans';
const NOM = 'SEUIL_SIEGES_LISIBLES';
const MIN = 2;
const MAX = 200;
const FORMES = Object.freeze(['ronde', 'carree']);

// Le nombre d'images qu'une liste a pour paraître, complète, après
// l'ouverture du plan.
const IMAGES_MAX = 120;

const sansGuillemets = (texte) => texte.trim().replace(/^(["'])(.*)\1$/, '$2');
const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

/**
 * Un événement d'une seule table de places sièges, de la forme donnée, au
 * centre du dessin, sans participant ; un tour.
 * @param {number} places
 * @param {'ronde'|'carree'} forme
 */
function tableSeule(places, forme) {
  const charge = creerCharge({ id: `banc-sieges-${forme}-${places}`, nom: 'Club des Merles', siegesParDefaut: 8, tours: 1 });
  charge.tables = [{ id: 1, numero: 1, sieges: places, forme, position: { x: 0, y: 0 } }];
  charge.prochainsIds.table = 2;
  return charge;
}

// La liste de la table 1, complète : une ligne <tspan x y> par siège. Rend
// null tant qu'elle n'a pas toutes ses lignes.
function listeComplete(racine, places) {
  const liste = racine.querySelector('[data-liste="1"]');
  if (liste === null) return null;
  return liste.querySelectorAll(':scope > tspan').length === places ? liste : null;
}

// La police des listes : la première famille calculée, et la face 400 de
// Noto Sans chargée dans le document.
function policeDe(liste) {
  const premiere = sansGuillemets(getComputedStyle(liste).fontFamily.split(',')[0]);
  const chargee = [...document.fonts].some((face) => sansGuillemets(face.family) === FAMILLE && face.weight === '400' && face.status === 'loaded');
  return { premiere, chargee };
}

// Les relevés de chaque appel du prédicat, dans l'ordre des appels.
const releves = [];
const polices = [];

/**
 * Le prédicat d'une forme : la liste d'une table seule de n places tient-elle
 * dans la hauteur du plan, au zoom ajusté ? Monte, mesure, défait. Lève si la
 * liste ne paraît pas complète : sans elle, la mesure ne juge rien.
 * @param {'ronde'|'carree'} forme
 */
function tient(forme) {
  return async (places) => {
    const contexte = creerContexte();
    try {
      const m = await ouvrirEvenement(contexte, tableSeule(places, forme), { section: 'plan' });
      let liste = null;
      for (let image = 0; liste === null; image += 1) {
        if (image >= IMAGES_MAX) throw new Error(`table ${forme} de ${places} places : liste absente ou incomplète au zoom ajusté`);
        flushSync();
        liste = listeComplete(m.racine, places);
        if (liste === null) await uneImage();
      }
      await uneImage();
      const basListe = liste.getBoundingClientRect().bottom;
      const basPlan = m.racine.querySelector('svg[data-plan]').getBoundingClientRect().bottom;
      polices.push(policeDe(liste));
      const resultat = basListe <= basPlan;
      releves.push({ forme, places, basListePx: basListe, basPlanPx: basPlan, tient: resultat });
      return resultat;
    } finally {
      await contexte.defaire();
    }
  };
}

const seuils = {};
let mesure = null;

beforeAll(async () => {
  await controlerCadre();
});

describe('le nombre de sièges lisibles (§ 6.2)', () => {
  test('le registre de ce fichier porte K_LISTES à 0, les autres constantes inchangées', () => {
    expect(constante('K_LISTES')).toBe(0);
    expect(constante('SEUIL_SIEGES_LISIBLES')).toBe(CONSTANTES.find(({ nom }) => nom === 'SEUIL_SIEGES_LISIBLES').valeur);
  });

  for (const forme of FORMES) {
    test(`table ${forme} : ${MIN} places tiennent, ${MAX} non — la mesure bascule`, async () => {
      expect(await tient(forme)(MIN)).toBe(true);
      expect(await tient(forme)(MAX)).toBe(false);
    });

    test(`table ${forme} : le plus grand nombre de places dont la liste tient, par dichotomie sur [${MIN}, ${MAX}]`, async () => {
      seuils[forme] = await plusGrandTenant(tient(forme), MIN, MAX);
      expect(seuils[forme]).toBeGreaterThanOrEqual(MIN);
      expect(seuils[forme]).toBeLessThan(MAX);
    });
  }

  test('chaque liste mesurée est rendue en Noto Sans, sa face chargée', () => {
    expect(polices.length).toBeGreaterThan(0);
    const police = polices.every(({ premiere, chargee }) => premiere === FAMILLE && chargee) ? FAMILLE : null;
    const valeur = Math.min(...FORMES.map((forme) => seuils[forme] ?? Number.NaN));
    const refus = police === null ? `police des listes ${polices.find(({ premiere }) => premiere !== FAMILLE)?.premiere ?? 'non chargée'} : la mesure se prend sur ${FAMILLE}` : null;
    mesure = {
      nom: NOM,
      unite: 'places',
      valeurProposee: refus === null && Number.isInteger(valeur) ? valeur : null,
      critere:
        `le plus grand nombre de places d’une table seule, ronde puis carrée, dont le bas de la liste de noms reste dans ` +
        `la hauteur du <svg data-plan> au zoom ajusté ; le plus petit des deux, dichotomie sur [${MIN}, ${MAX}]`,
      police,
      ralentissementCpu: 1,
      formes: FORMES.map((forme) => ({ forme, seuil: seuils[forme] ?? null })),
      sondes: releves.map((releve) => ({ ...releve })),
      refus,
    };
    expect(refus).toBeNull();
    expect(mesure.valeurProposee).not.toBeNull();
  });

  test('la mesure s’écrit dans scripts/banc/sorties/sieges_lisibles.json, relue telle quelle, et se range dans un relevé', async () => {
    expect(mesure).not.toBeNull();
    const objet = { format: 1, mesures: [mesure] };
    const releve = {
      format: 1,
      configuration: {
        cadre: { largeur: innerWidth, hauteur: innerHeight },
        facteurEchelle: devicePixelRatio,
        navigateur: null,
        node: null,
        processeursLogiques: null,
        ralentissementCpu: 1,
        police: mesure.police,
      },
      mesures: [mesure],
    };
    expect(verifierReleve(releve, CONSTANTES)).toEqual([]);
    await ecrireSortie('sieges_lisibles', objet);
    expect(JSON.parse(await commands.readFile('scripts/banc/sorties/sieges_lisibles.json'))).toEqual(objet);
    expect(mesure.refus).toBeNull();
  });
});
