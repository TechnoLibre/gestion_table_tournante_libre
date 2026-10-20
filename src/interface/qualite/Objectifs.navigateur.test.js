// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La vue des objectifs des tables dans un vrai moteur de rendu (§ 12.12,
// B21, D34, D36, D52) : les personnes jamais servies, la soirée en texte,
// une barre par tour — le tour au plus grand reste en tête, aucune pour la
// soirée, aucune couleur propre à un tour —, chaque pourcentage suivi de
// son compte, les assis sans table possible de chaque ligne, le jumeau au
// clavier. La vue se monte seule, par mount, avec les contextes que pose App
// — 't' et 'format' —, sur le détail d'une génération faite dans le
// navigateur ; une épreuve monte App entière, pour recouper la vue avec le
// tableau des propositions et la section Diagnostic. Le rendu se lit par
// ses attributs data-… et son texte, jamais par une classe. Les noms
// d'épreuve sont inventés.
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
import { serialiser } from '../../stockage/canonique.js';
import { creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import VueObjectifs from './VueObjectifs.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const CONTEXTE = new Map([
  ['t', t],
  ['format', creerFormat(t)],
]);
const V1 = VERSION.affichee;

// Neuf personnes inventées : les sept premières portent « finance ».
const PERSONNES = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier'],
  ['Pervenche', 'Théo', 'Coopérative Aubier'],
  ['Lacasse', 'Ondine', 'Atelier Ressac'],
  ['Tourteau', 'Basile', 'Atelier Ressac'],
  ['Quenouille', 'Maëlle', 'Coopérative Aubier'],
  ['Rocaille', 'Anselme', 'Atelier Ressac'],
  ['Brindille', 'Pélagie', null],
  ['Cassonade', 'Firmin', null],
  ['Grésil', 'Ysaline', 'Atelier Ressac'],
];

// Trois tables de trois places, tours tours ; la table 1 a l'objectif
// « finance » aux tours toursObjectif — un tour hors de la liste n'a aucun
// couple possible. Sept personnes pour trois places à objectif : à chaque
// tour, quatre au moins restent hors objectif, une au moins n'est jamais
// servie.
function chargeObjectifs({ tours = 3, toursObjectif = [1, 2], respecter = true, mode = null } = {}) {
  const charge = creerCharge({ id: 'evt-objectifs', nom: 'Atelier Ressac', siegesParDefaut: 3, tours });
  charge.participants = PERSONNES.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(rang < 7 ? { etiquettes: ['finance'] } : {}),
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.tables[0].objectifs = toursObjectif.map((tour) => ({ portee: 'tour', tour, regle: null, etiquettes: ['finance'] }));
  charge.prochainsIds = { participant: 10, table: 4, proposition: 1 };
  if (!respecter) charge.reglages.respecterObjectifs = false;
  if (mode !== null) charge.reglages.modeObjectifs = mode;
  return charge;
}

// La charge, une génération enregistrée de plus.
function generee(charge) {
  const configuration = configurationDe(charge);
  const propositions = rechercher(configuration, { graine: 7, nombre: 2, arret: 200 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// Le détail de la première proposition d'une génération.
function detailDe(options) {
  const charge = generee(chargeObjectifs(options));
  return detaillerQualite(charge, charge.propositions[0].id);
}

// Le détail de la première proposition, sous une réservation ajoutée après
// la génération que son plan ne tient pas : la personne 8, sans étiquette,
// réservée au tour 1 à une table où le plan ne l'assoit pas. Hors du
// domaine des planchers (§ 12.4).
function detailHorsDomaine() {
  const charge = generee(chargeObjectifs());
  const [proposition] = charge.propositions;
  const rang = proposition.placement[0].sieges.findIndex((sieges) => !sieges.includes(8));
  const apres = structuredClone(charge);
  apres.reservations.push({ participant: 8, table: proposition.tables[rang], siege: null, portee: 'tour', tour: 1 });
  return detaillerQualite(apres, proposition.id);
}

const montes = [];

beforeAll(async () => {
  await fixerCadre(1366, 700);
});

afterEach(() => {
  for (const monte of montes.splice(0)) monte.defaire();
});

// Monte la vue sur un détail, dans un conteneur de 900 px au début du
// corps, puis laisse ses graphiques mesurer leur largeur et leur texte.
async function monter(detail) {
  const cible = document.createElement('div');
  cible.style.width = '900px';
  document.body.prepend(cible);
  const composant = mount(VueObjectifs, { target: cible, props: { detail, ligne: null, table: null }, context: CONTEXTE });
  montes.push({
    defaire: () => {
      unmount(composant);
      cible.remove();
    },
  });
  for (let i = 0; i < 3; i += 1) {
    flushSync();
    await tick();
  }
  return cible.querySelector('[data-vue-qualite="objectifs"]');
}

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

const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const lignesDuGraphique = (vue) => [...vue.querySelectorAll('svg[data-graphique="objectifs"] [data-ligne-graphique]')];

// Le compte qui suit chaque [data-pourcentage] de la racine, son voisin
// immédiat, et le pourcentage, chacun en son texte exact, espace fine
// comprise ; lève quand un pourcentage n'en a pas.
function comptesQuiSuivent(racine) {
  return [...racine.querySelectorAll('[data-pourcentage]')].map((pourcentage) => {
    const compte = pourcentage.nextElementSibling;
    expect(compte?.hasAttribute('data-compte-pire'), texteDe(pourcentage)).toBe(true);
    expect(texteDe(compte)).not.toBe('');
    return { pourcentage: pourcentage.textContent.trim(), compte: compte.textContent.trim() };
  });
}

// Le pourcentage du § D52, recalculé ici pour l'épreuve.
function pourcentAttendu(n, d) {
  if (d === 0) return null;
  const brut = Math.floor((100 * n) / d);
  return n > 0 && n < d ? Math.min(99, Math.max(1, brut)) : brut;
}

describe('objectifs : la vue rendue (§ 12.12, B21, D36)', () => {
  test('les jamais servies d’abord, nommées avec leurs tours possibles ; la soirée en texte, son pourcentage suivi des jamais servies', async () => {
    const detail = detailDe();
    const vue = await monter(detail);
    const { jamaisServies, parTour } = detail.objectifs;
    const liste = vue.querySelector('[data-jamais-servies]');
    const nomDe = (id) => detail.personnes.find((personne) => personne.id === id).nom;
    expect([...liste.querySelectorAll('li')].map(texteDe)).toEqual(
      jamaisServies.map(({ id, possibles }) => `${nomDe(id)}${t('qualite.objectifs.toursPossibles', { possibles })}`),
    );
    const servis = parTour.reduce((somme, tour) => somme + (tour.servis ?? 0), 0);
    const possibles = parTour.reduce((somme, tour) => somme + tour.possibles, 0);
    const soiree = vue.querySelector('[data-soiree-objectifs]');
    expect(comptesQuiSuivent(soiree)).toEqual([
      {
        pourcentage: t('qualite.pourcentage.servis', { pourcent: pourcentAttendu(servis, possibles) }),
        compte: t('qualite.objectifs.pire', { personnes: jamaisServies.length }),
      },
    ]);
    expect(texteDe(soiree)).toContain(t('qualite.objectifs.comptes', { servis, possibles }));
    // Ses tours hors objectif, Σ possibles − Σ servis, et leur plancher, Σ des planchers des tours.
    const plancher = parTour.reduce((somme, tour) => somme + (tour.plancher ?? 0), 0);
    expect(texteDe(soiree)).toContain(t('qualite.objectifs.horsObjectif', { hors: possibles - servis, plancher }));
    // La liste des jamais servies vient avant la soirée, la soirée avant le graphique.
    const graphique = vue.querySelector('svg[data-graphique="objectifs"]');
    expect(liste.compareDocumentPosition(soiree) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(soiree.compareDocumentPosition(graphique) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('rouge : une barre par tour, aucune pour la soirée, la première au plus grand reste ; aucune couleur propre à un tour', async () => {
    const detail = structuredClone(detailDe());
    detail.objectifs.pireTour = 1;
    const vue = await monter(detail);
    const lignes = lignesDuGraphique(vue);
    expect(lignes.map((ligne) => ligne.dataset.ligneGraphique)).toEqual(['2', '1', '3']);
    expect(texteDe(lignes[0])).toContain(t('qualite.objectifs.tour', { tour: 2 }));
    for (const genre of ['prouve', 'reste']) {
      const remplissages = new Set(
        [...vue.querySelectorAll(`svg[data-graphique="objectifs"] rect[data-segment="${genre}"]`)].map((rect) => getComputedStyle(rect).fill),
      );
      expect(remplissages.size, genre).toBe(1);
    }
    for (const ligne of lignes) expect(ligne.querySelectorAll('rect:not([data-segment]), circle').length).toBe(0);
  });

  test('chaque ligne écrit ses assis sans table possible ; un tour sans couple écrit « — », sans barre ni pourcentage', async () => {
    // L'objectif aux tours 2 et 3 : le tour 2 est en tête, et l'ordre des
    // barres, [2, 1, 3], n'est pas celui des tours.
    const detail = detailDe({ toursObjectif: [2, 3] });
    expect(detail.objectifs.pireTour).toBe(1);
    const vue = await monter(detail);
    expect(lignesDuGraphique(vue).map((ligne) => ligne.dataset.ligneGraphique)).toEqual(['2', '1', '3']);
    for (const ligne of lignesDuGraphique(vue)) {
      const tour = Number(ligne.dataset.ligneGraphique);
      const { possibles, sansCouple } = detail.objectifs.parTour[tour - 1];
      expect(texteDe(ligne)).toContain(t('qualite.objectifs.assisSansTable', { assis: sansCouple }));
      if (possibles === 0) {
        expect(texteDe(ligne)).toContain(t('format.vide'));
        expect(ligne.querySelectorAll('rect[data-segment]').length).toBe(0);
      } else {
        expect(ligne.querySelectorAll('rect[data-segment]').length).toBeGreaterThan(0);
      }
    }
    const parTour = [...vue.querySelectorAll('ol li')];
    expect(parTour.map((li) => texteDe(li.firstElementChild))).toEqual([2, 1, 3].map((tour) => t('qualite.objectifs.tour', { tour })));
    const sansCouple = parTour.find((li) => texteDe(li.firstElementChild) === t('qualite.objectifs.tour', { tour: 1 }));
    expect(comptesQuiSuivent(sansCouple)).toEqual([{ pourcentage: t('format.vide'), compte: t('qualite.objectifs.sansCouple') }]);
    expect(texteDe(sansCouple)).not.toMatch(/%/);
  });

  test('rouge : chaque pourcentage de tour sur ses seuls possibles, suivi de ses servis sur ses possibles', async () => {
    const detail = detailDe();
    const vue = await monter(detail);
    const lis = [...vue.querySelectorAll('ol li')];
    expect(lis.length).toBe(detail.R);
    for (const li of lis) {
      const tour = Number(texteDe(li.firstElementChild).replace(/\D/g, ''));
      const { possibles, servis } = detail.objectifs.parTour[tour - 1];
      if (possibles === 0) continue;
      expect(comptesQuiSuivent(li)).toEqual([
        {
          pourcentage: t('qualite.pourcentage.valeur', { pourcent: pourcentAttendu(servis, possibles) }),
          compte: t('qualite.objectifs.comptes', { servis, possibles }),
        },
      ]);
    }
  });

  test('aucune personne jamais servie : la phrase prend la place de la liste, sans aucun nom', async () => {
    const detail = structuredClone(detailDe());
    detail.objectifs.jamaisServies = [];
    const vue = await monter(detail);
    const jamais = vue.querySelectorAll('[data-jamais-servies]');
    expect(jamais.length).toBe(1);
    expect(texteDe(jamais[0])).toBe(t('qualite.objectifs.aucuneJamaisServie'));
    expect(jamais[0].tagName).toBe('P');
    expect(jamais[0].querySelectorAll('li').length).toBe(0);
  });

  test('R = 1 : aucune ligne de soirée', async () => {
    const vue = await monter(detailDe({ tours: 1, toursObjectif: [1] }));
    expect(vue.querySelector('[data-soiree-objectifs]')).toBeNull();
    expect(lignesDuGraphique(vue).length).toBe(1);
  });

  test('critère décoché : la phrase dit qu’il ne classe pas, les planchers se dessinent quand même', async () => {
    const vue = await monter(detailDe({ respecter: false }));
    expect(vue.querySelector('[data-phrase-qualite="objectifs.critereDecoche"]')).not.toBeNull();
    expect(vue.querySelectorAll('rect[data-segment="prouve"]').length).toBeGreaterThan(0);
  });

  test('hors du domaine des planchers : la phrase, un seul segment par barre, les tours hors objectif, et aucun prouvé inévitable', async () => {
    const detail = detailHorsDomaine();
    expect(detail.collisions.planchersValides).toBe(false);
    const vue = await monter(detail);
    expect(texteDe(vue.querySelector('[data-phrase-qualite="objectifs.horsDomaine"]'))).toBe(t('qualite.objectifs.horsDomaine'));
    const genres = new Set([...vue.querySelectorAll('svg[data-graphique="objectifs"] rect[data-segment]')].map((rect) => rect.dataset.segment));
    expect([...genres]).toEqual(['serie1']);
    expect(vue.querySelector('rect[data-segment="prouve"]')).toBeNull();
    expect(texteDe(vue.querySelector('[data-soiree-objectifs]'))).toContain(t('qualite.objectifs.hors', { hors: detail.objectifs.soiree.hors }));
  });

  test('sans personne concernée : la phrase, aucun graphique', async () => {
    const vue = await monter(detailDe({ toursObjectif: [] }));
    expect(texteDe(vue.querySelector('[data-phrase-qualite="objectifs.aucunConcerne"]'))).toBe(t('qualite.objectifs.aucunConcerne'));
    expect(vue.querySelector('svg')).toBeNull();
    expect(vue.querySelector('[data-commande="ouvrirJumeau"]')).toBeNull();
  });

  test('le jumeau s’ouvre au clavier : chaque tour, la soirée, les jamais servies, la répartition ; chaque pourcentage suivi du compte de sa ligne', async () => {
    const detail = detailDe();
    const vue = await monter(detail);
    const commande = vue.querySelector('[data-commande="ouvrirJumeau"]');
    commande.focus();
    await touche('Enter');
    await attendre(() => expect(vue.querySelectorAll('[data-jumeau]').length).toBe(3));
    const [tours, jamais, repartition] = vue.querySelectorAll('[data-jumeau]');
    expect(tours.querySelectorAll('tbody tr').length).toBe(detail.R + 1);
    expect(jamais.querySelectorAll('tbody tr').length).toBe(detail.objectifs.jamaisServies.length);
    expect(repartition.querySelectorAll('tbody tr').length).toBe(detail.objectifs.repartition.length);
    const { soiree } = detail.objectifs;
    expect(comptesQuiSuivent(tours).at(-1)).toEqual({
      pourcentage: t('qualite.pourcentage.valeur', { pourcent: soiree.pourcent }),
      compte: t('qualite.objectifs.comptes', soiree),
    });
    const noms = [...vue.querySelectorAll('[data-jumeau]')].map((table) => table.getAttribute('aria-label'));
    expect(new Set([...noms, t('qualite.objectifs.graphique')]).size).toBe(4);
    const fermer = vue.querySelector('[data-commande="fermerJumeau"]');
    expect(document.activeElement).toBe(fermer);
    await touche('Enter');
    await attendre(() => expect(vue.querySelector('[data-jumeau]')).toBeNull());
    expect(document.activeElement).toBe(vue.querySelector('[data-commande="ouvrirJumeau"]'));
  });
});

describe('objectifs : recoupements dans l’application (§ 12.12, § 5.6)', () => {
  test('jamais servies = colonne du tableau des propositions ; possibles − servis de la soirée = tours hors objectif ; Σ planchers des tours = plancher de la section Diagnostic', async () => {
    const lue = generee(chargeObjectifs({ mode: 'chacun' }));
    const texte = serialiser(lue, { revision: 1, produitVersion: V1 });
    const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `soiree${SUFFIXES.etat}`, texte }] });
    montes.push({ defaire: () => m.demonter() });
    await m.seance.ouvrir('soiree');
    const id = lue.propositions[0].id;
    m.ui.montrerProposition(id);
    m.ui.allerA('qualite');
    const vue = await attendre(() => {
      const trouvee = m.racine.querySelector('[data-vue-qualite="objectifs"]');
      expect(trouvee?.querySelector('[data-soiree-objectifs]')).not.toBeNull();
      return trouvee;
    });
    const jamais = vue.querySelectorAll('[data-jamais-servies] li').length;
    vue.querySelector('[data-commande="ouvrirJumeau"]').click();
    const tours = await attendre(() => {
      const table = vue.querySelector('[data-jumeau="0"]');
      expect(table).not.toBeNull();
      return table;
    });
    const nombre = (cellule) => Number(texteDe(cellule).replace(/\D/g, ''));
    const rangees = [...tours.querySelectorAll('tbody tr')];
    const soiree = rangees.at(-1);
    const horsDeLaSoiree =
      nombre(soiree.querySelector('[data-colonne="possibles"]')) - nombre(soiree.querySelector('[data-colonne="servis"]'));
    const planchers = rangees
      .slice(0, -1)
      .map((rangee) => texteDe(rangee.querySelector('[data-colonne="plancher"]')))
      .filter((texte) => texte !== t('format.vide'))
      .map(Number);
    const somme = planchers.reduce((total, plancher) => total + plancher, 0);
    expect(planchers.length).toBe(2);

    m.ui.allerA('propositions');
    const ligne = await attendre(() => {
      const trouvee = m.racine.querySelector(`[data-proposition="${id}"]`);
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(nombre(ligne.querySelector('[data-colonne="jamaisServies"]'))).toBe(jamais);
    expect(nombre(ligne.querySelector('[data-colonne="toursHorsObjectif"]'))).toBe(horsDeLaSoiree);

    m.ui.allerA('diagnostic');
    const enonce = await attendre(() => {
      const trouve = m.racine.querySelector('[data-plancher-objectifs="toursHorsObjectif"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(texteDe(enonce)).toContain(t('diagnostic.objectifs.toursHorsObjectif', { plancher: somme }));
    expect(m.erreurs()).toEqual([]);
  });
});
