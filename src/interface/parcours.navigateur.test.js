// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le parcours de l'itération (§ 2.1, § 19.3, § 5.9, § 8.4, § 9) : une soirée
// préparée depuis un répertoire neuf, par les gestes de l'opérateur seuls —
// clic d'un bouton désigné par son attribut data-…, frappe réelle dans un
// champ, entrée réelle du pointeur sur le plan —, sur le système de fichiers
// simulé, l'horloge pilotée et l'exécuteur direct de la génération, au cadre
// de 1 366 × 700. Un seul montage porte toutes les épreuves du fichier, qui
// s'exécutent dans l'ordre : chacune part de l'événement que la précédente a
// laissé, affirme sa condition avant la suivante, et finit sur un collecteur
// d'erreurs vide.
//
// Le parcours suit les captures du § 19.3 qui relèvent de l'itération — 01,
// 01b, 02 à 09, 11, 19, 20 —, puis l'ordre de lecture du § 2.1 sur
// l'événement retenu, les fenêtres — aucune pendant un geste non
// destructeur, une qui nomme ce qui part pour chaque geste qui détruit —,
// enfin chaque famille de geste modifiant en lecture puis sur un plan
// bloqué. Les valeurs attendues viennent du moteur, du CSV et du stockage,
// sollicités une seconde fois (§ 19.1), et le texte de la même traduction
// que celle de l'application. Aucun délai fixe : chaque étape attend un
// état du document (§ 19.3).
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterAll, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync } from 'svelte';
import { bilanRemplacement, cleNormalisee } from '../application/csv.js';
import { TABLES_APPLICATION } from '../application/libelles.js';
import { nomAffiche } from '../application/personnes.js';
import { etatPlaces } from '../application/places.js';
import { creerTraduction } from '../application/traduction.js';
import { apercevoir } from '../csv/apercu.js';
import { decoder } from '../csv/encodage.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { echelleGraphique } from '../geometrie/echelle.js';
import { diametre } from '../geometrie/tables.js';
import { vueDepuisTransform } from '../geometrie/vue.js';
import { CRITERES, classer } from '../moteur/classement.js';
import { indexerPlan, nombrePlaces, normaliser } from '../moteur/configuration.js';
import { mesurer } from '../moteur/indicateurs.js';
import { plafondsAPriori } from '../moteur/plafond.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiserCharge } from '../stockage/canonique.js';
import { configurationDepuisCharge } from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { NOM_CAS_LIMITES, attendre, centre, octetsCasLimites } from '../../test/navigateur/ecrans.js';
import { fixerCadre, pointer, touche } from '../../test/navigateur/entrees.js';
import { monterApp } from '../../test/navigateur/montage.js';
import { visible } from '../../test/navigateur/rendu.js';
import { ENCODAGES, SEPARATEURS } from './import/modele.js';
import { TABLES_INTERFACE } from './libelles.js';
import { LARGEUR_ECHELLE_PX } from './plan/modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Le nom de l'événement que le parcours crée ; la graine qu'il écrit et le
// compte réduit de la recherche (§ 5.10).
const NOM_SOIREE = 'Soirée d\u{2019}essai';
const GRAINE = 4242;
const ARRET = 300;

// La personne que l'ordre de lecture ajoute : un nom inventé.
const AJOUTEE = { nom: 'Ombrelle', prenom: 'Iris' };

// Les gestes non destructeurs que les fenêtres surveillent (§ 2.1, § 5.9),
// chacun exécuté au moins une fois par le parcours.
const GESTES_NON_DESTRUCTEURS = Object.freeze([
  'ajouter',
  'modifier',
  'exclure',
  'reintegrer',
  'reserver',
  'titrer',
  'designer',
  'surcharger',
  'appliquerDefaut',
  'ajouterTour',
]);

// Les refus du § 5.9 qui subsistent à la pose, que la capture 09 peut
// photographier (§ 19.3).
const REFUS_DE_POSE = new Set(['SURRESERVATION', 'PERSONNE_EXCLUE', 'DEUX_PLACES_MEME_TOUR', 'PLACE_RESERVEE']);

// Les éléments qu'une fenêtre ouvre : un dialogue annoncé ou un <dialog> ouvert.
const FENETRE = '[role=dialog], [role=alertdialog], dialog[open]';

const PICTOGRAPHIQUE = /\p{Extended_Pictographic}/u;

// La durée accordée à chaque épreuve : une étape du parcours compte des
// dizaines de gestes réels, chacun attendu image après image.
const DUREE = 120_000;

// --- Le montage partagé ---------------------------------------------------------

// Le montage du parcours, que chaque épreuve reprend où la précédente l'a
// laissé ; les relevés des fenêtres.
let m = null;
const gestesSurveilles = new Set();
const fenetresVues = [];
// Ce que les étapes se transmettent : la personne désignée, la table et la
// proposition retenue, la charge d'avant l'ajustement de 19.
const memoire = {};

beforeAll(async () => {
  await fixerCadre(1366, 700);
  m = await monterApp();
});

afterEach(() => {
  expect(m.erreurs(), 'erreurs reçues par le collecteur').toEqual([]);
});

afterAll(async () => {
  m?.demonter();
  window.scrollTo(0, 0);
});

// --- Les lectures --------------------------------------------------------------------

const dans = (selecteur) => m.racine.querySelector(selecteur);
const tous = (selecteur) => [...m.racine.querySelectorAll(selecteur)];
const etat = () => m.seance.etat();
const charge = () => etat().charge;
const revision = () => etat().evenement.revision;
const base = () => etat().evenement.base;
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();

// Le texte de l'état et du journal de l'événement ouvert, et sa révision.
function fichiers() {
  return {
    etat: m.fs.contenu('documents', `${base()}${SUFFIXES.etat}`),
    journal: m.fs.contenu('documents', `${base()}${SUFFIXES.journal}`),
    revision: revision(),
  };
}

// Les entrées du journal relu de révision supérieure à r.
function entreesApres(r) {
  const texte = m.fs.contenu('documents', `${base()}${SUFFIXES.journal}`);
  return texte === null ? [] : lireJournal(texte).entrees.filter((entree) => entree.revision > r);
}

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));
async function images(n = 3) {
  for (let i = 0; i < n; i += 1) await uneImage();
  flushSync();
}

// Attend exactement une entrée après la révision r : la révision de la
// séance à r + 1, une entrée de plus au journal relu ; rend son libellé.
async function uneEntree(r, geste) {
  await attendre(`une entrée pour ${geste}`, () => revision() === r + 1);
  await images(2);
  expect(revision(), geste).toBe(r + 1);
  const entrees = entreesApres(r);
  expect(entrees, geste).toHaveLength(1);
  return entrees[0].libelle;
}

// Rien n'a été écrit depuis avant : l'état, le journal et la révision.
async function rienEcrit(avant, geste) {
  await images(4);
  expect(fichiers(), geste).toEqual(avant);
}

// L'élément que désigne aria-describedby d'un élément.
const decrit = (element) => {
  const id = element?.getAttribute('aria-describedby') ?? null;
  return id === null ? null : document.getElementById(id);
};

// --- Les gestes ------------------------------------------------------------------------

// Un clic HTML sur l'élément, puis le rendu.
async function appuyer(element, quoi) {
  expect(element, quoi).not.toBeNull();
  element.click();
  flushSync();
  await images(2);
}

// Le bouton du montage que désigne le sélecteur, attendu, puis cliqué.
async function cliquer(selecteur) {
  const element = await attendre(selecteur, () => dans(selecteur));
  await appuyer(element, selecteur);
  return element;
}

// Remplace le texte d'un champ par une frappe réelle : le champ prend le
// focus, son texte est sélectionné, puis remplacé par l'insertion du texte.
async function taper(entree, texte) {
  expect(entree, 'champ à saisir').not.toBeNull();
  entree.focus();
  entree.select();
  if (texte === '') await touche('Backspace');
  else await cdp().send('Input.insertText', { text: texte });
  flushSync();
}

// Saisit puis valide par Entrée.
async function saisir(entree, texte) {
  await taper(entree, texte);
  await touche('Enter');
  flushSync();
  await images(2);
}

// Un appui relâché sur place, au centre d'un élément : un clic de pointeur
// réel, sous le seuil de glissement.
async function cliquerPointeur(element) {
  const { x, y } = await centre(element);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  flushSync();
  await images(2);
}

// Presse au point depuis et avance par pas jusqu'au point vers, sans relâcher.
async function presserEtBouger(depuis, vers, pas = 10) {
  await pointer('presser', depuis.x, depuis.y);
  for (let i = 1; i <= pas; i += 1) {
    await pointer('bouger', depuis.x + ((vers.x - depuis.x) * i) / pas, depuis.y + ((vers.y - depuis.y) * i) / pas);
    await uneImage();
  }
  flushSync();
}

async function glisserVers(depuis, vers) {
  await presserEtBouger(depuis, vers);
  await pointer('relacher', vers.x, vers.y);
  flushSync();
  await images(3);
}

// Ouvre une section de l'événement par sa navigation.
async function ouvrirSection(nom) {
  await cliquer(`[data-commande="section"][data-cible="${nom}"]`);
  await attendre(`la section ${nom}`, () => dans(`[data-section="${nom}"]`));
}

// Ouvre le plan et l'ajuste au tour montré : toutes les tables dans le cadre.
async function ouvrirPlan() {
  await ouvrirSection('plan');
  await attendre('le plan posé', () => dans('[data-vue]')?.getAttribute('transform') && tous('[data-table]').length === charge().tables.length);
  await cliquer('[data-commande="ajuster"]');
  await images(2);
}

// Un geste non destructeur, sous un MutationObserver qui relève toute
// fenêtre ouverte pendant lui, celles qui y sont déjà comprises ; le geste se
// compte parmi les gestes surveillés.
async function sansFenetre(geste, faire) {
  const vues = await sousObservation(faire);
  gestesSurveilles.add(geste);
  fenetresVues.push(...vues.map((element) => ({ geste, element: element.outerHTML.slice(0, 120) })));
}

// Exécute faire sous l'observateur et rend les fenêtres relevées.
async function sousObservation(faire) {
  const vues = [];
  const relever = (noeud) => {
    if (!(noeud instanceof Element)) return;
    if (noeud.matches(FENETRE)) vues.push(noeud);
    vues.push(...noeud.querySelectorAll(FENETRE));
  };
  const lire = (mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'attributes') relever(mutation.target);
      else for (const noeud of mutation.addedNodes) relever(noeud);
    }
  };
  const observateur = new MutationObserver(lire);
  observateur.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['open', 'role'] });
  relever(document.body);
  try {
    await faire();
    await images(2);
  } finally {
    lire(observateur.takeRecords());
    observateur.disconnect();
  }
  return [...new Set(vues)];
}

// --- Le plan ---------------------------------------------------------------------------

const chaise = (table, siege) => dans(`[data-siege="${table}:${siege}"]`);
const plateau = (table) => dans(`[data-table="${table}"] [data-marque="contourTable"], [data-table="${table}"] [data-marque="contourConflit"]`);
const actionPlace = (action) => dans(`[data-panneau="place"] [data-commande="${action}"]`);

// L'état des places du tour montré, tel que le plan le calcule.
const etatMontre = () => etatPlaces(charge(), { tour: m.ui.etat().tour, proposition: m.ui.etat().proposition });

// Les chaises du tour montré, à plat : {table, siege, occupant, reservation, titre}.
function chaisesMontrees() {
  return etatMontre().tables.flatMap((table) => table.chaises.map((c) => ({ table: table.id, ...c })));
}

// Une chaise libre — ni occupant, ni réservation, ni titre — d'une table, hors des sièges exclus.
function chaiseLibre(table, exclus = []) {
  const trouvee = chaisesMontrees().find(
    (c) => c.table === table && c.occupant === null && c.reservation === null && c.titre === null && !exclus.includes(c.siege),
  );
  expect(trouvee, `une chaise libre à la table ${table}`).toBeDefined();
  return trouvee;
}

// Une chaise occupée d'une table par une personne qu'aucune réservation n'y tient.
function chaiseOccupee(table) {
  const trouvee = chaisesMontrees().find((c) => c.table === table && c.occupant !== null && c.reservation === null);
  expect(trouvee, `une chaise occupée à la table ${table}`).toBeDefined();
  return trouvee;
}

// Avance le zoom jusqu'au régime des sièges : les avertissements de
// l'événement réduisent la hauteur du plan, et au zoom ajusté les tables
// peuvent passer en régime table, sans chaise dessinée.
async function regimeSieges() {
  for (let cran = 0; tous('[data-plan] [data-siege]').length === 0; cran += 1) {
    expect(cran, 'crans de zoom jusqu’aux sièges').toBeLessThan(4);
    await cliquer('[data-commande="zoomer"]');
  }
}

// Vrai quand le centre de l'élément tombe dans le cadre du plan, à 8 px au
// moins de ses bords : le pointeur l'y atteint.
function dansLeCadre(element) {
  if (element === null) return false;
  const cadre = dans('[data-plan]').getBoundingClientRect();
  const b = element.getBoundingClientRect();
  const x = b.left + b.width / 2;
  const y = b.top + b.height / 2;
  return b.width > 0 && x >= cadre.left + 8 && x <= cadre.right - 8 && y >= cadre.top + 8 && y <= cadre.bottom - 8;
}

// La première chaise du tour montré qui répond au prédicat et dont le
// dessin est dans le cadre.
function chaiseVue(predicat) {
  const trouvee = chaisesMontrees().find((c) => predicat(c) && dansLeCadre(chaise(c.table, c.siege)));
  expect(trouvee, 'une chaise dans le cadre').toBeDefined();
  return trouvee;
}

// Choisit une personne dans la réserve visible, ou dans la liste des
// pressentis ; rend son identifiant.
async function choisir(conteneur, participant = null) {
  const boutons = tous(`${conteneur} [data-participant]`);
  expect(boutons.length, `personnes de ${conteneur}`).toBeGreaterThan(0);
  const bouton = participant === null ? boutons[0] : boutons.find((b) => Number(b.dataset.participant) === participant);
  expect(bouton, `personne ${participant} dans ${conteneur}`).toBeDefined();
  const id = Number(bouton.dataset.participant);
  await appuyer(bouton, `choisir ${id}`);
  await attendre('le choix posé', () => m.ui.etat().choix?.participant === id);
  return id;
}

// Oublie le choix en attente, s'il y en a un.
async function oublierChoix() {
  if (m.ui.etat().choix === null) return;
  const oublier = actionPlace('oublierChoix');
  if (oublier !== null) await appuyer(oublier, 'oublier le choix');
  else m.ui.choisir(null);
  await attendre('le choix oublié', () => m.ui.etat().choix === null);
}

// Le refus d'un geste du plan : la pose de l'état de navigation, neuve après
// le geste, porte le code et nomme la place du geste, attendue — {table,
// siege} de la chaise visée, {table} pour une table ou sa poignée ; cette
// place désigne le message par aria-describedby, et le message porte la
// commande du remède.
async function refusSurLePlan(poseAvant, attendue, code, remede, geste) {
  const pose = await attendre(`le refus ${code} du geste ${geste}`, () => {
    const lue = m.ui.etat().pose;
    return lue !== poseAvant && lue?.refus?.code === code ? lue : null;
  });
  const { table, siege = null } = attendue;
  expect({ table: pose.place.table, siege: pose.place.siege ?? null }, `${geste} : la place du refus`).toEqual({ table, siege });
  const place = siege === null ? dans(`[data-table="${table}"]`) : chaise(table, siege);
  const message = await attendre(`le message de ${geste} sur la place`, () => decrit(place));
  const refus = message.querySelector(`[data-refus="${code}"]`);
  expect(refus, geste).not.toBeNull();
  expect(refus.querySelector(`[data-commande="${remede}"]`)?.textContent, geste).toBe(t(`communs.remede.${remede}`));
  expect(dans('[data-plan]').contains(message), geste).toBe(false);
  return message;
}

// Ferme le refus posé sur une place par sa propre commande : posé sur le
// plan, il couvrirait l'élément que vise le geste suivant.
async function fermerLaPose() {
  if (m.ui.etat().pose === null) return;
  const fermer = [...tous('[data-surface] button')].find((bouton) => texteDe(bouton) === t('plan.refus.fermer'));
  if (fermer !== undefined) await appuyer(fermer, 'fermer le refus posé');
  await attendre('la pose fermée', () => m.ui.etat().pose === null);
}

// Le refus posé à côté d'un élément, dans le porteur donné, avec son remède.
async function refusPres(porteur, code, remede, geste) {
  const refus = await attendre(`le refus ${code} de ${geste}`, () => porteur().querySelector(`[data-refus="${code}"]`));
  expect(refus.querySelector(`[data-commande="${remede}"]`)?.textContent, geste).toBe(t(`communs.remede.${remede}`));
  return refus;
}

// --- Le parcours (§ 2.1, § 19.3) ------------------------------------------------------

describe('le parcours, depuis un répertoire neuf, par gestes seulement', { timeout: DUREE }, () => {
  test('01 le répertoire vide : chaque démonstration du catalogue offerte, la version, le chemin ; créer « Soirée d’essai » l’ouvre en lecture', async () => {
    await attendre('le premier écran', () => dans('[data-ecran="accueil"] [data-dossier-travail]'));
    expect(tous('[data-evenement]')).toHaveLength(0);
    const offertes = tous('[data-demonstration]');
    expect(CATALOGUE.length).toBeGreaterThan(0);
    expect(offertes).toHaveLength(CATALOGUE.length);
    offertes.forEach((entree, rang) => {
      expect(texteDe(entree)).toBe(CATALOGUE[rang].nom);
      expect(visible(entree)).toBe(true);
    });
    expect(dans('[data-version]').textContent).toContain(VERSION.affichee);
    expect(dans('[data-bandeau]').textContent).toContain(VERSION.affichee);
    const chemin = dans('[data-dossier-travail]').textContent;
    expect(chemin.length).toBeGreaterThan(0);
    expect(chemin).toBe(etat().racine.chemin);

    await taper(dans('[data-ecran="accueil"] input[data-champ="nom"]'), NOM_SOIREE);
    await cliquer('[data-ecran="accueil"] [data-commande="creer"]');
    await attendre('l’événement ouvert', () => dans('[data-ecran="evenement"]') && etat().evenement !== null);
    expect(etat().evenement.nom).toBe(NOM_SOIREE);
    expect(etat().mode).toBe('lecture');
    expect(charge().participants).toHaveLength(0);
  });

  test('01b une modification refusée avant « Modifier », à côté de son geste ; acceptée après ; le cadre visible', async () => {
    await ouvrirSection('tables');
    const avant = fichiers();
    expect(dans('[data-mode]').dataset.marque).toBe('cadreLecture');
    await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
    await refusPres(() => dans('[data-commande="creerTableRonde"]').parentElement, 'MODE_LECTURE', 'modifier', 'créer une table');
    expect(document.querySelectorAll(FENETRE)).toHaveLength(0);
    await rienEcrit(avant, 'créer une table en lecture');
    expect(charge().tables).toHaveLength(0);

    await cliquer('[data-place-fixe] [data-commande="modifier"]');
    await attendre('l’écriture', () => etat().mode === 'ecriture' && dans('[data-place-fixe] [data-commande="lecture"]'));
    const cadre = dans('[data-mode]');
    expect(cadre.dataset.marque).toBe('cadreEcriture');
    expect(visible(cadre)).toBe(true);
    const libelle = dans('[data-mode-libelle="cadre"]');
    expect(visible(libelle)).toBe(true);
    expect(texteDe(libelle).length).toBeGreaterThan(0);
    expect(texteDe(dans('[data-mode-libelle="bandeau"]'))).toBe(texteDe(libelle));

    const r = revision();
    await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
    await uneEntree(r, 'créer une table');
    expect(charge().tables).toHaveLength(1);
    expect(charge().tables[0].sieges).toBeNull();
  });

  test('02 l’aperçu de l’import des cas limites : encodage et séparateur nommés, ceux de l’analyseur ; un groupe d’orthographes fondu, une ligne refusée', async () => {
    await ouvrirSection('import');
    const octets = await octetsCasLimites();
    m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
    const avant = fichiers();
    await cliquer('[data-section="import"] [data-commande="choisirFichier"]');
    const apercu = await attendre('l’aperçu', () => dans('[data-apercu]'));
    const { texte, encodage } = decoder(octets);
    expect(texteDe(apercu.querySelector('[data-encodage]'))).toBe(t(ENCODAGES.get(encodage)));
    expect(texteDe(apercu.querySelector('[data-separateur]'))).toBe(t(SEPARATEURS.get(apercevoir(texte).separateur)));
    expect(apercu.querySelectorAll('[data-fusion]').length).toBeGreaterThanOrEqual(1);
    expect(apercu.querySelectorAll('[data-refusees] [data-ligne]').length).toBeGreaterThanOrEqual(1);
    expect(apercu.querySelector('[data-commande="importer"]')).not.toBeNull();
    await rienEcrit(avant, 'l’aperçu');
  });

  test('03 le rapport : une entrée, les lignes valides comptées, le groupe fondu et la ligne refusée', async () => {
    const r = revision();
    await cliquer('[data-apercu] [data-commande="importer"]');
    const rapport = await attendre('le rapport', () => dans('[data-rapport]'));
    await uneEntree(r, 'importer');
    const ajoutes = Number(texteDe(rapport.querySelector('[data-compte="ajoutes"] [data-nombre]')));
    expect(ajoutes).toBeGreaterThan(0);
    expect(charge().participants).toHaveLength(ajoutes);
    expect(rapport.querySelectorAll('[data-fusion]').length).toBeGreaterThanOrEqual(1);
    expect(rapport.querySelectorAll('[data-refusees] [data-ligne]').length).toBeGreaterThanOrEqual(1);
    memoire.importes = ajoutes;
  });

  test('04 la grille : le compte égal à l’import, une personne exclue ; trier, filtrer ; modifier, exclure, réintégrer sans fenêtre', async () => {
    await ouvrirSection('participants');
    const section = () => dans('[data-section="participants"]');
    const idsAffiches = () => [...section().querySelectorAll('[role="grid"] [data-participant]')].map((l) => Number(l.dataset.participant));
    const n = memoire.importes;
    expect(idsAffiches()).toHaveLength(n);
    expect(texteDe(section().querySelector('output'))).toBe(t('participants.grille.compte', { total: n, affiches: n }));
    const exclue = charge().participants.find((p) => p.exclu);
    expect(exclue).toBeDefined();
    const celluleExclu = section().querySelector(`[data-participant="${exclue.id}"] [data-champ="exclu"]`);
    expect(texteDe(celluleExclu)).toBe(t('participants.grille.exclue'));

    // Le tri par nom, croissant puis décroissant, sur la clé normalisée,
    // départagé par identifiant ; le filtre ; rien ne s'écrit.
    const avant = fichiers();
    const parNom = (sens) =>
      [...charge().participants]
        .sort((a, b) => {
          const [ka, kb] = [cleNormalisee(a.nom), cleNormalisee(b.nom)];
          return ka === kb ? a.id - b.id : (ka < kb ? -1 : 1) * (sens === 'croissant' ? 1 : -1);
        })
        .map((p) => p.id);
    await cliquer('[data-section="participants"] [data-commande="trier"][data-cible="nom"]');
    expect(idsAffiches()).toEqual(parNom('croissant'));
    await cliquer('[data-section="participants"] [data-commande="trier"][data-cible="nom"]');
    expect(idsAffiches()).toEqual(parNom('decroissant'));
    const filtre = 'Hérons';
    const retenus = charge()
      .participants.filter((p) =>
        ['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'notes'].some(
          (c) => p[c] !== null && cleNormalisee(p[c]).includes(cleNormalisee(filtre)),
        ),
      )
      .map((p) => p.id);
    expect(retenus.length).toBeGreaterThan(0);
    expect(retenus.length).toBeLessThan(n);
    await taper(section().querySelector('[data-champ="filtre"]'), filtre);
    await images(2);
    expect([...idsAffiches()].sort((a, b) => a - b)).toEqual(retenus);
    await taper(section().querySelector('[data-champ="filtre"]'), '');
    await images(2);
    expect(idsAffiches()).toHaveLength(n);
    await rienEcrit(avant, 'trier et filtrer');

    // Modifier une cellule au clavier : une entrée, aucune fenêtre.
    const cible = charge().participants.find((p) => !p.exclu && p.courriel === null);
    await sansFenetre('modifier', async () => {
      const r = revision();
      section().querySelector(`[data-participant="${cible.id}"] [data-champ="courriel"]`).focus();
      await touche('Enter');
      await images(1);
      await cdp().send('Input.insertText', { text: 'ondine@exemple.test' });
      await touche('Enter');
      await uneEntree(r, 'modifier une cellule');
    });
    expect(charge().participants.find((p) => p.id === cible.id).courriel).toBe('ondine@exemple.test');

    // Exclure, puis réintégrer : une entrée chacun, aucune fenêtre.
    await sansFenetre('exclure', async () => {
      const r = revision();
      await cliquer(`[data-participant="${cible.id}"] [data-commande="exclureParticipant"]`);
      await uneEntree(r, 'exclure');
    });
    expect(charge().participants.find((p) => p.id === cible.id).exclu).toBe(true);
    await sansFenetre('reintegrer', async () => {
      const r = revision();
      await cliquer(`[data-participant="${cible.id}"] [data-commande="reintegrerParticipant"]`);
      await uneEntree(r, 'réintégrer');
    });
    expect(charge().participants.find((p) => p.id === cible.id).exclu).toBe(false);
  });

  test('05 deux tables à 8, l’une au défaut, l’autre surchargée à 8 : leurs états diffèrent à valeur égale', async () => {
    await ouvrirSection('tables');
    let r = revision();
    await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
    await uneEntree(r, 'créer la seconde table');
    const [premiere, seconde] = charge().tables;
    const champTable = (id) => dans(`[data-section="tables"] [data-table="${id}"] input[data-champ="sieges-${id}"]`);
    await sansFenetre('surcharger', async () => {
      r = revision();
      await saisir(champTable(seconde.id), '9');
      await uneEntree(r, 'surcharger à 9');
      r = revision();
      await saisir(champTable(seconde.id), '8');
      await uneEntree(r, 'surcharger à 8');
    });
    expect(charge().tables.map(({ sieges }) => sieges)).toEqual([null, 8]);
    expect(champTable(premiere.id).value).toBe('8');
    expect(champTable(seconde.id).value).toBe('8');
    const etatDe = (id) => dans(`[data-section="tables"] [data-table="${id}"] [data-etat-table]`);
    expect(visible(etatDe(premiere.id))).toBe(true);
    expect(visible(etatDe(seconde.id))).toBe(true);
    expect(texteDe(etatDe(premiere.id))).not.toBe(texteDe(etatDe(seconde.id)));
  });

  test('06 l’énoncé d’un changement de défaut, son total égal au moteur ; étape 5, le nombre de tours', async () => {
    const avant = fichiers();
    await saisir(dans('[data-section="tables"] input[data-champ="siegesParDefaut"]'), '10');
    const enonce = await attendre('l’énoncé', () => dans('[data-enonce="defaut"]'));
    expect(visible(enonce)).toBe(true);
    await rienEcrit(avant, 'l’énoncé');
    const phrase = [...enonce.querySelectorAll('[data-phrase]')].map(texteDe).join(' ');
    const total = phrase.match(/(\d+)\s*\u{2192}\s*(\d+)/u);
    expect(total, phrase).not.toBeNull();
    await sansFenetre('appliquerDefaut', async () => {
      const r = revision();
      await cliquer('[data-enonce="defaut"] [data-commande="appliquer"]');
      await uneEntree(r, 'appliquer le défaut');
    });
    const instance = normaliser(configurationDepuisCharge(charge()));
    expect(nombrePlaces(instance)).toBe(Number(total[2]));
    expect(phrase).toContain(String(instance.N));
    expect(charge().evenement.siegesParDefaut).toBe(10);
    expect(charge().tables.map(({ sieges }) => sieges)).toEqual([null, 8]);

    // Étape 5 : trois tours, sans perte, sans fenêtre.
    const vues = await sousObservation(async () => {
      const r = revision();
      await saisir(dans('[data-section="tables"] input[data-champ="tours"]'), '3');
      await uneEntree(r, 'les tours');
    });
    expect(vues).toEqual([]);
    expect(charge().evenement.tours).toBe(3);
  });

  test('07 le plan à l’échelle : chaque plateau mesure son diamètre au zoom lu, l’échelle graphique, la mention « disposition relative »', async () => {
    await ouvrirPlan();
    const { k } = vueDepuisTransform(dans('[data-vue]').getAttribute('transform'));
    expect(k).toBeGreaterThan(0);
    const tables = etatMontre().tables;
    expect(tables).toHaveLength(2);
    for (const table of tables) {
      const largeur = plateau(table.id).getBoundingClientRect().width;
      expect(Math.abs(largeur - diametre(table.capacite) * k), `table ${table.numero}`).toBeLessThan(1.5);
    }
    const barre = dans('[data-surface] [data-marque="echelle"]');
    expect(visible(barre)).toBe(true);
    const { longueurCm, largeurPx } = echelleGraphique(k, LARGEUR_ECHELLE_PX);
    expect(Math.abs(barre.getBoundingClientRect().width - largeurPx)).toBeLessThan(1);
    expect(Math.abs(largeurPx - longueurCm * k)).toBeLessThan(1);
    const mention = [...dans('[data-surface]').querySelectorAll('p')].find((p) => texteDe(p) === t('plan.echelle.mention'));
    expect(mention).toBeDefined();
    expect(visible(mention)).toBe(true);
  });

  test('08 deux animateurs — cadenas fermé et anneau, hachuré et cadenas ouvert —, leurs lignes, les deux listes de travail', async () => {
    const [t1, t2] = charge().tables.map(({ id }) => id);
    // Désigner une personne pressentie à la première table.
    let r = revision();
    await sansFenetre('designer', async () => {
      memoire.designee = await choisir('[data-liste-travail="pressentis"]');
      await cliquerPointeur(chaise(t1, 1));
      await appuyer(actionPlace('designer'), 'désigner');
      await uneEntree(r, 'désigner');
    });
    expect(charge().reservations).toContainEqual(expect.objectContaining({ participant: memoire.designee, table: t1, portee: 'tous' }));
    // Réserver une personne de la réserve à la seconde table, pour ce tour.
    r = revision();
    await sansFenetre('reserver', async () => {
      const id = await choisir('[data-reserve]');
      const libre = chaiseLibre(t2, [1]);
      await cliquerPointeur(chaise(t2, libre.siege));
      await appuyer(actionPlace('reserver'), 'réserver');
      await uneEntree(r, 'réserver');
      memoire.reservee = id;
    });
    expect(charge().reservations).toContainEqual(expect.objectContaining({ participant: memoire.reservee, table: t2, portee: 'tour', tour: 1 }));
    // Un titre que rien ne pourvoit, à la seconde table.
    await oublierChoix();
    r = revision();
    await sansFenetre('titrer', async () => {
      await cliquerPointeur(chaise(t2, 1));
      await appuyer(actionPlace('donnerTitre'), 'titrer');
      await uneEntree(r, 'titrer');
    });
    expect(charge().titres.filter(({ table }) => table === t2)).toHaveLength(1);

    // Les marques sont des éléments SVG : la place désignée porte cadenas
    // fermé et anneau, la place titrée hachure et cadenas ouvert.
    await images(2);
    const sieges = tous('[data-plan] [data-siege]');
    expect(sieges.length).toBeGreaterThan(0);
    const porte = (element, marque) => element.querySelector(`[data-marque="${marque}"]`) !== null;
    const designee = sieges.filter((s) => porte(s, 'cadenasFerme') && porte(s, 'anneau'));
    const titree = sieges.filter((s) => porte(s, 'hachure') && porte(s, 'cadenasOuvert'));
    expect(designee.map((s) => s.dataset.siege.split(':')[0])).toEqual([String(t1)]);
    expect(titree.map((s) => s.dataset.siege.split(':')[0])).toEqual([String(t2)]);
    for (const s of [...designee, ...titree]) expect(s.querySelector('[data-marque="cadenasFerme"], [data-marque="cadenasOuvert"]').namespaceURI).toBe('http://www.w3.org/2000/svg');
    for (const s of sieges) {
      const marques = s.querySelectorAll('[data-marque="cadenasFerme"], [data-marque="cadenasOuvert"], [data-marque="anneau"]');
      expect(marques.length, s.dataset.siege).toBeLessThanOrEqual(2);
    }
    expect(PICTOGRAPHIQUE.test(dans('[data-plan]').textContent)).toBe(false);

    // Les lignes des listes énoncent les deux états en toutes lettres.
    const titre = charge().titres.find(({ table }) => table === t2).libelle;
    const liste = (table) => texteDe(dans(`[data-liste="${table}"]`));
    expect(liste(t1)).toContain(nomAffiche(charge().participants.find((p) => p.id === memoire.designee)));
    expect(liste(t1)).toContain(t('plan.ligne.reserveeTous'));
    expect(liste(t2)).toContain(`${t('plan.ligne.avantTitreNonPourvu').trim()} ${titre}${t('plan.ligne.apresTitreNonPourvu')}`);

    // Les deux listes de travail : le titre non pourvu, les pressentis.
    const titres = tous('[data-liste-travail="titres"] [data-titre]');
    expect(titres.map((b) => b.dataset.titre.split(':')[0])).toEqual([String(t2)]);
    expect(texteDe(titres[0])).toContain(titre);
    expect(tous('[data-liste-travail="pressentis"] [data-participant]').length).toBeGreaterThan(0);
  });

  test('09 un refus sur la place, sa cause et son remède, sans fenêtre ni écriture', async () => {
    const [t1] = charge().tables.map(({ id }) => id);
    const reservee = chaisesMontrees().find((c) => c.reservation?.participant === memoire.designee);
    expect(reservee).toBeDefined();
    const avant = fichiers();
    const poseAvant = m.ui.etat().pose;
    const vues = await sousObservation(async () => {
      await choisir('[data-reserve]');
      await cliquerPointeur(chaise(t1, reservee.siege));
      await appuyer(actionPlace('assigner'), 'assigner sur une place réservée à un autre');
    });
    const pose = await attendre('le refus sur la place', () => (m.ui.etat().pose !== poseAvant ? m.ui.etat().pose : null));
    expect(REFUS_DE_POSE.has(pose.refus.code), pose.refus.code).toBe(true);
    const message = decrit(chaise(t1, reservee.siege));
    expect(message).not.toBeNull();
    const refus = message.querySelector(`[data-refus="${pose.refus.code}"]`);
    expect(refus).not.toBeNull();
    expect(texteDe(refus)).toContain(t(pose.refus.code, pose.refus.details).slice(0, 20));
    expect(refus.querySelector('[data-commande]')).not.toBeNull();
    expect(visible(message)).toBe(true);
    expect(vues).toEqual([]);
    await rienEcrit(avant, 'le refus sur la place');
    await oublierChoix();
  });

  test('11 générer à la graine écrite et au compte réduit : trois propositions au moins, celles du moteur ; l’ordre écrit, celui de la clé du moteur ; les colonnes de diversité ; retenir', async () => {
    await ouvrirSection('generation');
    await taper(dans('[data-section="generation"] input[data-champ="graine"]'), String(GRAINE));
    let r = revision();
    await saisir(dans('[data-section="generation"] input[data-champ="generation.arret"]'), String(ARRET));
    await uneEntree(r, 'le compte réduit');
    expect(charge().reglages.generation.arret).toBe(ARRET);
    const configuration = configurationDepuisCharge(charge());
    const { nombre, historique } = charge().reglages.generation;
    const attendues = rechercher(configuration, { graine: GRAINE, nombre, arret: ARRET, historique });
    expect(attendues.length).toBeGreaterThanOrEqual(3);

    r = revision();
    await cliquer('[data-section="generation"] [data-commande="generer"]');
    await attendre('la génération, ou sa question', () => dans('[data-issue]') ?? dans('[data-question="longue"]'));
    if (dans('[data-issue]') === null) await cliquer('[data-commande="confirmerGeneration"]');
    await attendre('les propositions', () => charge().propositions.length === attendues.length);
    await uneEntree(r, 'générer');
    expect(charge().propositions.map(({ graine }) => graine)).toEqual(attendues.map(({ graine }) => graine));

    await ouvrirSection('propositions');
    const section = dans('[data-section="propositions"]');
    const ids = () => [...section.querySelectorAll('[data-classement] tr[data-proposition]')].map((tr) => Number(tr.dataset.proposition));
    const instance = normaliser(configurationDepuisCharge(charge()));
    const aPriori = plafondsAPriori(instance);
    const { ordre } = classer(
      charge().propositions.map((p) => ({ id: p.id, mesures: mesurer(instance, indexerPlan(instance, planDepuisFichier(p))), plafondsAPriori: aPriori })),
    );
    expect(ordre.length).toBeGreaterThanOrEqual(3);
    await attendre('le tableau classé', () => ids().length === ordre.length);
    expect(ids()).toEqual(ordre);
    expect(texteDe(section.querySelector('[data-ordre]'))).toBe(t('propositions.ordre.criteres', { criteres: [...CRITERES] }));
    const colonnes = [...section.querySelectorAll('th[data-colonne]')].map((th) => th.dataset.colonne);
    for (const colonne of ['appartenancesVues', 'totalRedondance', 'diversite']) expect(colonnes, colonne).toContain(colonne);
    // Le minimum des rencontres seul, jamais la moyenne ; r(p) par sa somme.
    expect(colonnes).not.toContain('redondance');
    for (const th of section.querySelectorAll('th')) expect(texteDe(th)).not.toMatch(/moyenne/i);

    r = revision();
    memoire.retenue = ordre[0];
    const vues = await sousObservation(async () => {
      await cliquer(`[data-proposition="${ordre[0]}"] [data-commande="retenir"]`);
      await uneEntree(r, 'retenir');
    });
    expect(vues).toEqual([]);
    expect(charge().retenu.proposition).toBe(ordre[0]);
    expect(charge().evenement.etat).toBe('retenu');
    await attendre('la ligne du retenu', () => section.querySelector(`tr[data-retenu="${ordre[0]}"]`));
  });

  test('19 un ajustement : le glissement dit lequel des deux gestes est en cours, une entrée, le retenu changé', async () => {
    await ouvrirPlan();
    memoire.avantAjustement = serialiserCharge(charge());
    const [t1, t2] = charge().tables.map(({ id }) => id);
    const depuis = chaiseOccupee(t1);
    const vers = chaiseLibre(t2);
    const r = revision();
    await presserEtBouger(await centre(chaise(t1, depuis.siege)), await centre(chaise(t2, vers.siege)));
    const etatDonnees = await attendre('le libellé de l’état des données', () => dans('[data-fantome] [data-partie="etat"]'));
    expect(texteDe(etatDonnees)).toBe(t('plan.fantome.retenu'));
    const point = await centre(chaise(t2, vers.siege));
    await pointer('relacher', point.x, point.y);
    const libelle = await uneEntree(r, 'ajuster');
    expect(libelle).toContain(nomAffiche(charge().participants.find((p) => p.id === depuis.occupant)));
    expect(serialiserCharge(charge())).not.toBe(memoire.avantAjustement);
    expect(charge().retenu.proposition).toBe(memoire.retenue);
  });

  test('20 la lecture : glisser une personne, une table, tirer une poignée, poser une réservation — empreinte inchangée ; « Défaire » refusé avec « Modifier », puis rend l’état d’avant 19', async () => {
    await cliquer('[data-place-fixe] [data-commande="lecture"]');
    await attendre('la lecture', () => etat().mode === 'lecture');
    expect(dans('[data-mode]').dataset.marque).toBe('cadreLecture');
    expect(visible(dans('[data-mode-libelle="cadre"]'))).toBe(true);
    expect(dans('[data-bandeau]').textContent).toContain(VERSION.affichee);
    const empreinte = serialiserCharge(charge());
    const avant = fichiers();
    const [t1, t2] = charge().tables.map(({ id }) => id);

    await glisserVers(await centre(chaise(t1, chaiseOccupee(t1).siege)), await centre(chaise(t2, chaiseLibre(t2).siege)));
    const table = await centre(plateau(t2));
    await glisserVers(table, { x: table.x + 40, y: table.y + 30 });
    const poignee = await centre(dans(`[data-poignee="${t1}"]`));
    await glisserVers(poignee, { x: poignee.x + 40, y: poignee.y + 40 });
    const poseAvant = m.ui.etat().pose;
    await choisir('[data-liste-travail="pressentis"]');
    const visee = chaiseLibre(t2);
    await cliquerPointeur(chaise(t2, visee.siege));
    await appuyer(actionPlace('reserver'), 'réserver en lecture');
    await refusSurLePlan(poseAvant, { table: t2, siege: visee.siege }, 'MODE_LECTURE', 'modifier', 'réserver en lecture');
    await oublierChoix();

    expect(serialiserCharge(charge())).toBe(empreinte);
    await rienEcrit(avant, 'les quatre gestes en lecture');
    expect(dans(`[data-table="${t2}"]`).getAttribute('transform')).toBeNull();
    for (const t of etatMontre().tables) expect(tous(`[data-siege^="${t.id}:"]`), `table ${t.numero}`).toHaveLength(t.capacite);

    // « Défaire » en lecture : refusé à côté de lui, « Modifier » pour remède.
    const defaire = dans('[data-historique] [data-commande="defaire"]');
    await appuyer(defaire, 'défaire en lecture');
    const refus = await refusPres(() => defaire.parentElement, 'MODE_LECTURE', 'modifier', 'défaire en lecture');
    await rienEcrit(avant, 'défaire en lecture');
    await appuyer(refus.querySelector('[data-commande="modifier"]'), 'le remède');
    await attendre('l’écriture', () => etat().mode === 'ecriture');
    const r = revision();
    await cliquer('[data-historique] [data-commande="defaire"]');
    await uneEntree(r, 'défaire');
    expect(serialiserCharge(charge())).toBe(memoire.avantAjustement);
  });
});

// --- L'ordre de lecture (§ 2.1) ---------------------------------------------------------

describe('l’ordre de lecture, pas une séquence imposée', { timeout: DUREE }, () => {
  test('sur l’événement retenu, en écriture : ajouter une personne, créer une table, désigner une animatrice, changer le nombre de tours — une entrée chacun, sans « Suivant »', async () => {
    expect(etat().mode).toBe('ecriture');
    expect(charge().retenu).not.toBeNull();

    await ouvrirSection('participants');
    let r = revision();
    await sansFenetre('ajouter', async () => {
      const formulaire = dans('[data-section="participants"] form');
      await taper(formulaire.querySelector('input[data-champ="prenom"]'), AJOUTEE.prenom);
      await taper(formulaire.querySelector('input[data-champ="nom"]'), AJOUTEE.nom);
      await touche('Enter');
      await uneEntree(r, 'ajouter une personne');
    });
    const ajoutee = charge().participants.at(-1);
    expect(ajoutee).toMatchObject(AJOUTEE);
    memoire.ajoutee = ajoutee.id;

    await ouvrirSection('tables');
    r = revision();
    await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
    await uneEntree(r, 'créer une table');
    const nouvelle = charge().tables.at(-1).id;

    await ouvrirPlan();
    r = revision();
    // L'animatrice est assise par le retenu à une autre table : choisie par
    // le menu de sa place, désignée à la nouvelle table.
    await regimeSieges();
    const pressentie = (id) => charge().participants.find((p) => p.id === id).titrePressenti !== null;
    const assise = chaiseVue((c) => c.table !== nouvelle && c.occupant !== null && c.reservation === null && !pressentie(c.occupant));
    const animatrice = charge().participants.find(({ id }) => id === assise.occupant);
    await sansFenetre('designer', async () => {
      await cliquerPointeur(chaise(assise.table, assise.siege));
      await cliquer(`[data-panneau="place"] [data-menu="${animatrice.id}"] [data-commande="deplacer"]`);
      await attendre('le choix posé', () => m.ui.etat().choix?.participant === animatrice.id);
      await cliquerPointeur(chaise(nouvelle, 1));
      await appuyer(actionPlace('designer'), 'désigner l’animatrice');
      await uneEntree(r, 'désigner l’animatrice');
    });
    expect(charge().reservations).toContainEqual(expect.objectContaining({ participant: animatrice.id, table: nouvelle, portee: 'tous' }));
    // Le retenu l'assied ailleurs : l'avertissement la nomme, et la table
    // par son numéro.
    const numero = charge().tables.find(({ id }) => id === nouvelle).numero;
    const nonHonoree = await attendre('l’avertissement de la réservation non honorée', () =>
      dans('[data-avertissement="RESERVATION_NON_HONOREE"]'),
    );
    expect(texteDe(nonHonoree)).toContain(nomAffiche(animatrice));
    expect(texteDe(nonHonoree)).toMatch(new RegExp(`\\b${numero}\\b`));

    await ouvrirSection('tables');
    r = revision();
    await sansFenetre('ajouterTour', async () => {
      await saisir(dans('[data-section="tables"] input[data-champ="tours"]'), '4');
      await uneEntree(r, 'ajouter un tour');
    });
    expect(charge().evenement.tours).toBe(4);

    const suivant = [...m.racine.querySelectorAll('button, a, [role="button"]')].filter(
      (element) => /suivant/i.test(texteDe(element)) || element.dataset.commande === 'suivant',
    );
    expect(suivant).toEqual([]);
  });
});

// --- Les fenêtres (§ 2.1, § 5.9) --------------------------------------------------------

describe('les fenêtres : seul un geste qui détruit de la saisie en ouvre une', { timeout: DUREE }, () => {
  test('aucune fenêtre pendant les gestes non destructeurs du parcours, chacun exécuté', () => {
    expect(GESTES_NON_DESTRUCTEURS.length).toBeGreaterThan(0);
    expect([...gestesSurveilles].sort()).toEqual([...GESTES_NON_DESTRUCTEURS].sort());
    expect(fenetresVues).toEqual([]);
  });

  test('« Remplacer », « Appliquer et réaligner », retirer un tour réservé, supprimer une personne ou une table réservées, « Retenir » sur un retenu ajusté : une fenêtre qui nomme ce qui part ; Annuler n’écrit rien', async () => {
    expect(etat().mode).toBe('ecriture');
    const [t1] = charge().tables.map(({ id }) => id);

    // Préparation : une réservation au tour 4, un ajustement du retenu.
    await ouvrirPlan();
    const selecteurTour = dans('[data-champ="tour"]');
    selecteurTour.value = '4';
    selecteurTour.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('le tour 4 montré', () => m.ui.etat().tour === 4);
    await images(2);
    await regimeSieges();
    let r = revision();
    const auTour4 = await choisir('[data-reserve]');
    const libre4 = chaiseVue((c) => c.occupant === null && c.reservation === null && c.titre === null);
    await cliquerPointeur(chaise(libre4.table, libre4.siege));
    await appuyer(actionPlace('reserver'), 'réserver au tour 4');
    await uneEntree(r, 'réserver au tour 4');
    expect(charge().reservations).toContainEqual(expect.objectContaining({ participant: auTour4, portee: 'tour', tour: 4 }));
    selecteurTour.value = '1';
    selecteurTour.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('le tour 1 montré', () => m.ui.etat().tour === 1);
    await images(2);
    await regimeSieges();
    r = revision();
    const depuis = chaiseVue((c) => c.occupant !== null && c.reservation === null);
    const vers = chaiseVue((c) => c.table !== depuis.table && c.occupant === null && c.reservation === null && c.titre === null);
    await glisserVers(await centre(chaise(depuis.table, depuis.siege)), await centre(chaise(vers.table, vers.siege)));
    await uneEntree(r, 'ajuster le retenu');

    // Chaque geste destructeur : la fenêtre s'ouvre, son titre et ses
    // éléments nomment ce qui part ; Annuler la ferme sans rien écrire.
    // Ce qui part se calcule de la charge, hors des modules qui bâtissent
    // la fenêtre, et se traduit par la même traduction : titre, le texte
    // attendu du titre ; elements, la liste exacte des éléments ; parmi,
    // des éléments que la liste porte, à côté d'autres que le geste emporte.
    const avant = fichiers();
    const ligne = (texte) => texte.replace(/\s+/g, ' ').trim();
    const numeroDe = (table) => charge().tables.find(({ id }) => id === table).numero;
    const nomDe = (participant) => nomAffiche(charge().participants.find(({ id }) => id === participant));
    async function fenetreAnnulee(geste, ouvrir, { titre, elements: exacts = null, parmi = [] }) {
      expect(exacts !== null || parmi.length > 0, `${geste} : ce qui part, attendu`).toBe(true);
      const vues = await sousObservation(ouvrir);
      expect(vues.length, `${geste} : une fenêtre`).toBeGreaterThan(0);
      const fenetre = await attendre(`la fenêtre de ${geste}`, () => dans('dialog[open]'));
      expect(texteDe(fenetre.querySelector('h2')), `${geste} : le titre`).toBe(ligne(titre));
      const elements = [...fenetre.querySelectorAll('li')].map(texteDe);
      if (exacts !== null) {
        expect(exacts.length, geste).toBeGreaterThan(0);
        expect(elements, `${geste} : les éléments`).toEqual(exacts.map(ligne));
      }
      expect(elements, `${geste} : les éléments`).toEqual(expect.arrayContaining(parmi.map(ligne)));
      await appuyer(fenetre.querySelector('[data-commande="renoncer"]'), `annuler ${geste}`);
      await attendre(`la fenêtre de ${geste} fermée`, () => dans('dialog[open]') === null);
      await rienEcrit(avant, geste);
    }

    await ouvrirSection('import');
    const octets = await octetsCasLimites();
    m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
    await cliquer('[data-section="import"] [data-commande="choisirFichier"]');
    await attendre('l’aperçu', () => dans('[data-apercu] [data-champ="mode"]'));
    await appuyer(dans('[data-champ="mode"] input[value="remplacer"]'), 'le mode remplacer');
    // Remplacer : les quatre comptes de ce que la liste remplacée emporte.
    const bilan = bilanRemplacement(charge());
    expect(bilan.participants).toBeGreaterThan(0);
    await fenetreAnnulee('remplacer', () => cliquer('[data-apercu] [data-commande="importer"]'), {
      titre: t('import.remplacer.titre'),
      elements: [
        t('import.remplacer.participants', { n: bilan.participants }),
        t('import.remplacer.reservations', { n: bilan.reservations }),
        t('import.remplacer.titres', { n: bilan.titresPourvus }),
        t('import.remplacer.propositions', { n: bilan.propositions }),
      ],
    });
    await cliquer('[data-apercu] [data-commande="fermerApercu"]');

    await ouvrirSection('tables');
    await saisir(dans('[data-section="tables"] input[data-champ="siegesParDefaut"]'), '9');
    await attendre('l’énoncé', () => dans('[data-enonce="defaut"] [data-commande="appliquerRealigner"]'));
    // Réaligner : chaque table surchargée, par numéro, et sa surcharge perdue.
    const surchargees = charge()
      .tables.filter(({ sieges }) => sieges !== null)
      .sort((a, b) => a.numero - b.numero);
    expect(surchargees.length).toBeGreaterThan(0);
    await fenetreAnnulee('appliquer et réaligner', () => cliquer('[data-enonce="defaut"] [data-commande="appliquerRealigner"]'), {
      titre: t('tables.defaut.confirmationRealigner', { n: surchargees.length }),
      elements: surchargees.map(({ numero, sieges }) => t('tables.defaut.surchargePerdue', { numero, sieges })),
    });
    await cliquer('[data-enonce="defaut"] [data-commande="garder"]');

    // Retirer le tour 4 : la réservation qui y tient, sa personne, sa table.
    const reservation4 = charge().reservations.find(({ participant, tour }) => participant === auTour4 && tour === 4);
    await fenetreAnnulee('retirer un tour réservé', () => saisir(dans('[data-section="tables"] input[data-champ="tours"]'), '3'), {
      titre: t('tables.tours.confirmation', { avant: 4, apres: 3 }),
      parmi: [t('tables.tours.reservation', { nom: nomDe(auTour4), numero: numeroDe(reservation4.table), tour: 4 })],
    });
    expect(dans('[data-section="tables"] input[data-champ="tours"]').value).toBe('4');

    // Supprimer t1 : son numéro, chaque réservation qu'elle tient avec le nom
    // de sa personne, chaque titre posé à ses sièges.
    const deT1 = [
      ...charge()
        .reservations.filter(({ table }) => table === t1)
        .map(({ participant, portee, tour, siege }) => t('tables.suppression.reservation', { nom: nomDe(participant), portee, tour, siege })),
      ...charge()
        .titres.filter(({ table }) => table === t1)
        .map(({ siege, libelle }) => t('tables.suppression.titre', { siege, libelle })),
    ];
    expect(deT1.length).toBeGreaterThan(0);
    await fenetreAnnulee('supprimer une table réservée', () => cliquer(`[data-section="tables"] [data-table="${t1}"] [data-commande="supprimerTable"]`), {
      titre: t('tables.suppression.confirmation', { numero: numeroDe(t1) }),
      parmi: deT1,
    });

    await ouvrirSection('participants');
    const designee = charge().participants.find((p) => p.id === memoire.designee);
    // Supprimer la personne désignée : son nom, chacune de ses réservations.
    const siennes = charge().reservations.filter(({ participant }) => participant === designee.id);
    expect(siennes.length).toBeGreaterThan(0);
    await fenetreAnnulee('supprimer une personne réservée', () => cliquer(`[data-participant="${designee.id}"] [data-commande="supprimerParticipant"]`), {
      titre: t('participants.suppression.titre', { personne: nomAffiche(designee) }),
      elements: siennes.map((reservation) => t('participants.suppression.reservation', { ...reservation, numero: numeroDe(reservation.table) })),
    });

    await ouvrirSection('propositions');
    const autre = charge().propositions.find(({ id }) => id !== charge().retenu.proposition).id;
    // Retenir : le retenu ajusté, par sa proposition d'origine, et celle qui
    // le remplace.
    await fenetreAnnulee('retenir sur un retenu ajusté', () => cliquer(`[data-proposition="${autre}"] [data-commande="retenir"]`), {
      titre: t('propositions.confirmation.titre', { proposition: autre }),
      elements: [
        t('propositions.confirmation.retenuAjuste', { proposition: memoire.retenue }),
        t('propositions.confirmation.remplacant', { proposition: autre }),
      ],
    });
    expect(charge().retenu.proposition).toBe(memoire.retenue);
  });
});

// --- Lecture et bloqué, toutes familles (§ 8.4, § 9, § 19.3 20) -------------------------

describe('lecture et bloqué : chaque famille de geste modifiant refusée, rien d’écrit', { timeout: DUREE }, () => {
  // Chaque famille, tentée par son geste : le refus se pose là où le geste
  // a eu lieu, avec le remède attendu.
  async function toutesFamilles(code, remede) {
    const [, t2] = charge().tables.map(({ id }) => id);
    const familles = [];
    const famille = async (nom, faire) => {
      await fermerLaPose();
      await faire();
      familles.push(nom);
    };

    // Les avertissements de dérive réduisent la hauteur du plan : au zoom
    // ajusté, les tables passent en régime table. Le zoom s'avance jusqu'au
    // régime des sièges, et chaque geste vise un élément dont le centre
    // reste dans le cadre.
    await ouvrirPlan();
    await regimeSieges();
    await famille('glisser une personne', async () => {
      const poseAvant = m.ui.etat().pose;
      const depuis = chaiseVue((c) => c.occupant !== null && c.reservation === null);
      const vers = chaiseVue((c) => c.table !== depuis.table && c.occupant === null && c.reservation === null && c.titre === null);
      await glisserVers(await centre(chaise(depuis.table, depuis.siege)), await centre(chaise(vers.table, vers.siege)));
      await refusSurLePlan(poseAvant, { table: vers.table, siege: vers.siege }, code, remede, 'glisser une personne');
    });
    await famille('glisser une table', async () => {
      const poseAvant = m.ui.etat().pose;
      const table = charge().tables.find(({ id }) => dansLeCadre(plateau(id)));
      expect(table, 'une table dans le cadre').toBeDefined();
      const point = await centre(plateau(table.id));
      await glisserVers(point, { x: point.x + 20, y: point.y + 15 });
      await refusSurLePlan(poseAvant, { table: table.id }, code, remede, 'glisser une table');
    });
    await famille('tirer une poignée', async () => {
      const poseAvant = m.ui.etat().pose;
      const poignee = tous('[data-poignee]').find(dansLeCadre);
      expect(poignee, 'une poignée dans le cadre').toBeDefined();
      const point = await centre(poignee);
      await glisserVers(point, { x: point.x + 40, y: point.y + 40 });
      await refusSurLePlan(poseAvant, { table: Number(poignee.dataset.poignee) }, code, remede, 'tirer une poignée');
    });
    const libreVue = () => chaiseVue((c) => c.occupant === null && c.reservation === null && c.titre === null);
    await famille('poser une réservation', async () => {
      const poseAvant = m.ui.etat().pose;
      await choisir('[data-reserve]');
      const libre = libreVue();
      await cliquerPointeur(chaise(libre.table, libre.siege));
      await appuyer(actionPlace('reserver'), 'réserver');
      await refusSurLePlan(poseAvant, { table: libre.table, siege: libre.siege }, code, remede, 'poser une réservation');
      await oublierChoix();
    });
    await famille('titrer', async () => {
      const poseAvant = m.ui.etat().pose;
      const libre = libreVue();
      await cliquerPointeur(chaise(libre.table, libre.siege));
      await appuyer(actionPlace('donnerTitre'), 'titrer');
      await refusSurLePlan(poseAvant, { table: libre.table, siege: libre.siege }, code, remede, 'titrer');
    });
    await famille('désigner', async () => {
      const poseAvant = m.ui.etat().pose;
      await choisir('[data-reserve]');
      const libre = libreVue();
      await cliquerPointeur(chaise(libre.table, libre.siege));
      await appuyer(actionPlace('designer'), 'désigner');
      await refusSurLePlan(poseAvant, { table: libre.table, siege: libre.siege }, code, remede, 'désigner');
      await oublierChoix();
    });
    // Les objets reviennent : aucune table déplacée, chaque table à sa capacité.
    const tables = tous('[data-plan] [data-table]');
    expect(tables.length).toBeGreaterThan(0);
    for (const table of tables) expect(table.getAttribute('transform'), `table ${table.dataset.table}`).toBeNull();
    for (const table of etatMontre().tables) expect(tous(`[data-siege^="${table.id}:"]`), `table ${table.numero}`).toHaveLength(table.capacite);

    await ouvrirSection('participants');
    await famille('saisir dans une cellule', async () => {
      const personne = charge().participants.find((p) => !p.exclu);
      const cellule = () => dans(`[data-section="participants"] [data-participant="${personne.id}"] [data-champ="courriel"]`);
      cellule().focus();
      await touche('Enter');
      await refusPres(cellule, code, remede, 'saisir dans une cellule');
    });
    await famille('coller', async () => {
      const cellule = dans('[data-section="participants"] [role="grid"] [tabindex="0"]');
      cellule.focus();
      const presse = new DataTransfer();
      presse.setData('text/plain', 'nom;prenom\r\nPervenche;Théo\r\n');
      cellule.dispatchEvent(new ClipboardEvent('paste', { clipboardData: presse, bubbles: true, cancelable: true }));
      await attendre('l’aperçu du collage', () => dans('[data-apercu] [data-commande="importer"]'));
      await cliquer('[data-apercu] [data-commande="importer"]');
      await refusPres(() => dans('[data-apercu] [data-commande="importer"]').parentElement, code, remede, 'coller');
      await cliquer('[data-apercu] [data-commande="fermerApercu"]');
    });
    await famille('importer', async () => {
      const octets = await octetsCasLimites();
      m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
      await cliquer('[data-section="import"] [data-commande="choisirFichier"]');
      await attendre('l’aperçu', () => dans('[data-apercu] [data-commande="importer"]'));
      await cliquer('[data-apercu] [data-commande="importer"]');
      await refusPres(() => dans('[data-apercu] [data-commande="importer"]').parentElement, code, remede, 'importer');
      await cliquer('[data-apercu] [data-commande="fermerApercu"]');
    });

    await ouvrirSection('tables');
    await famille('créer une table', async () => {
      await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
      await refusPres(() => dans('[data-commande="creerTableRonde"]').parentElement, code, remede, 'créer une table');
    });
    // Une frappe réelle dans un champ, amené d'abord au milieu de la zone
    // qui défile : sous l'en-tête de l'événement, un champ défilé hors de
    // vue reste dans la fenêtre, mais le pointeur atteint l'en-tête.
    const frapper = async (entree) => {
      entree.scrollIntoView({ block: 'center' });
      await cliquerPointeur(entree);
      expect(document.activeElement).toBe(entree);
      await touche('7');
      flushSync();
      await images(2);
    };
    await famille('surcharger', async () => {
      await frapper(dans(`[data-section="tables"] [data-table="${t2}"] input[data-champ="sieges-${t2}"]`));
      await refusPres(() => dans(`[data-section="tables"] [data-table="${t2}"]`), code, remede, 'surcharger');
    });
    await famille('changer le défaut', async () => {
      await frapper(dans('[data-section="tables"] input[data-champ="siegesParDefaut"]'));
      await refusPres(() => dans('[data-defaut]'), code, remede, 'changer le défaut');
    });
    await famille('changer les tours', async () => {
      await frapper(dans('[data-section="tables"] input[data-champ="tours"]'));
      await refusPres(() => dans('[data-tours]'), code, remede, 'changer les tours');
    });
    await famille('changer l’état', async () => {
      await cliquer('[data-etat="brouillon"] [data-commande="etat"]');
      await refusPres(() => dans('[data-etat="brouillon"]'), code, remede, 'changer l’état');
    });
    expect(familles).toHaveLength(14);
  }

  // Le tri, le filtre et les listes de travail restent vivants.
  async function regarderReste() {
    await ouvrirSection('participants');
    const section = () => dans('[data-section="participants"]');
    const idsAffiches = () => [...section().querySelectorAll('[role="grid"] [data-participant]')].map((l) => Number(l.dataset.participant));
    const tri = () => section().querySelector('[data-commande="trier"][data-cible="prenom"]').closest('th').getAttribute('aria-sort');
    await cliquer('[data-section="participants"] [data-commande="trier"][data-cible="prenom"]');
    expect(tri()).toBe('ascending');
    const n = idsAffiches().length;
    await taper(section().querySelector('[data-champ="filtre"]'), AJOUTEE.nom);
    await images(2);
    expect(idsAffiches()).toEqual([memoire.ajoutee]);
    await taper(section().querySelector('[data-champ="filtre"]'), '');
    await images(2);
    expect(idsAffiches()).toHaveLength(n);
    await ouvrirPlan();
    const id = await choisir('[data-liste-travail="pressentis"]');
    expect(dans(`[data-liste-travail="pressentis"] [data-participant="${id}"]`).getAttribute('aria-pressed')).toBe('true');
    await oublierChoix();
  }

  // Les écritures relevées depuis le rang donné, hors du cadrage qui s'écrit
  // différé dans reglages_locaux.json (contrainte 4).
  const ecrituresDepuis = (rang) => m.trace.slice(rang).filter(([, , chemin]) => chemin !== '' && !chemin.endsWith('reglages_locaux.json'));

  test('en lecture : quatorze familles refusées avec « Modifier », la charge et les fichiers inchangés ; le tri, le filtre, les listes de travail vivants', async () => {
    await cliquer('[data-place-fixe] [data-commande="lecture"]');
    await attendre('la lecture', () => etat().mode === 'lecture');
    const empreinte = serialiserCharge(charge());
    const avant = fichiers();
    const rang = m.trace.length;
    await toutesFamilles('MODE_LECTURE', 'modifier');
    expect(serialiserCharge(charge())).toBe(empreinte);
    await rienEcrit(avant, 'lecture');
    expect(ecrituresDepuis(rang)).toEqual([]);
    await regarderReste();
    expect(serialiserCharge(charge())).toBe(empreinte);
    await rienEcrit(avant, 'lecture, regarder');
  });

  test('sur un plan bloqué : quatorze familles refusées avec « Débloquer », la charge et les fichiers inchangés ; le tri, le filtre, les listes de travail vivants', async () => {
    await cliquer('[data-place-fixe] [data-commande="modifier"]');
    await attendre('l’écriture', () => etat().mode === 'ecriture');
    const r = revision();
    await cliquer('[data-etat="bloque"] [data-commande="etat"]');
    await uneEntree(r, 'bloquer');
    expect(charge().evenement.etat).toBe('bloque');
    expect(dans('[data-mode]').dataset.marque).toBe('cadreBloque');
    const empreinte = serialiserCharge(charge());
    const avant = fichiers();
    const rang = m.trace.length;
    await toutesFamilles('LECTURE_SEULE', 'debloquer');
    expect(serialiserCharge(charge())).toBe(empreinte);
    await rienEcrit(avant, 'bloqué');
    expect(ecrituresDepuis(rang)).toEqual([]);
    await regarderReste();
    expect(serialiserCharge(charge())).toBe(empreinte);
    await rienEcrit(avant, 'bloqué, regarder');
  });
});
