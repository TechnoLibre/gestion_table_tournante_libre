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
// d'erreurs vide et sans requête hors de la boucle locale (§ 19.11).
//
// Le parcours est le parcours photographié (§ 19.1, § 19.3) : il suit les
// captures du § 19.3 que l'itération photographie — 01, 01b, 02, 02b, 03,
// 04, 04a, les étiquettes d'une fiche, 05, 05a, les objectifs posés à
// l'écran, 05b, l'aperçu du CSV des objectifs, 06, 07, 07b, 08 à 10, les deux
// 07a sur la grande démonstration que 10 a chargée, 10a, l'ordre des
// priorités réglé, 11, la génération sous ces objectifs et cet ordre (A22,
// D17), 19, 20, puis 22 et 23, l'aperçu avant impression d'une proposition
// et du retenu, puis 24 et 25, la feuille de contrôle et la première planche
// du PDF que la section Badges produit, tramées sous node (§ 19.6) —, ces
// sorties en lecture puis sur un plan bloqué, qui n'écrivent que la planche
// et reglages_locaux.json (§ 11.6), puis l'ordre de lecture du § 2.1 sur
// l'événement retenu, les fenêtres — aucune pendant un geste non
// destructeur, une qui nomme ce qui part pour chaque geste qui détruit —,
// enfin chaque famille de geste modifiant en lecture puis sur un plan
// bloqué. Les valeurs attendues viennent du moteur, du CSV et du stockage,
// sollicités une seconde fois (§ 19.1), et le texte de la même traduction
// que celle de l'application. Aucun délai fixe : chaque étape attend un
// état du document (§ 19.3).
//
// Une épreuve qui porte une capture finit, ses conditions affirmées, par
// photographier (test/navigateur/captures.js), ou, pour une page du PDF de
// la planche, par photographierPdf ; une épreuve qui continue
// au-delà de l'écran photographié se coupe en deux. Rien de la machine
// n'entre dans une région photographiée : la provenance « documentation »
// tient lieu de version (§ 18.6), l'exécuteur direct annonce quatre cœurs,
// l'horloge est pilotée, la feuille qui annule transitions et animations
// est posée (test/navigateur/feuilles.js). La dernière épreuve du fichier
// publie les captures d'un bloc sous make captures (§ 19.5), et les
// compare au manifeste sinon (§ 19.7).
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { cdp, commands } from 'vitest/browser';
import { flushSync } from 'svelte';
import { configurationDe } from '../application/configuration.js';
import { apercevoirObjectifs, bilanRemplacement, cleNormalisee } from '../application/csv.js';
import { creerFormat } from '../application/format.js';
import { creerExecuteurDirect } from '../application/generation.js';
import { TABLES_APPLICATION, libelle } from '../application/libelles.js';
import { nomAffiche } from '../application/personnes.js';
import { etatPlaces } from '../application/places.js';
import { estBrouillon } from '../application/sorties.js';
import { creerTraduction } from '../application/traduction.js';
import { versionVisible } from '../application/version.js';
import { apercevoir } from '../csv/apercu.js';
import { decoder } from '../csv/encodage.js';
import { decouper } from '../csv/lecture.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { regimeCibles } from '../geometrie/designation.js';
import { echelleGraphique } from '../geometrie/echelle.js';
import { diametre, geometrieTable } from '../geometrie/tables.js';
import { vueDepuisTransform } from '../geometrie/vue.js';
import { classer } from '../moteur/classement.js';
import { indexerPlan, nombrePlaces, normaliser } from '../moteur/configuration.js';
import { correspondA } from '../moteur/correspondance.js';
import { PRIORITES_PAR_DEFAUT, compilationDe } from '../moteur/criteres.js';
import { diagnostiquer } from '../moteur/diagnostic.js';
import { mesurer } from '../moteur/indicateurs.js';
import { plafondsAPriori } from '../moteur/plafond.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiserCharge } from '../stockage/canonique.js';
import { configurationDepuisCharge } from '../stockage/document.js';
import { lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { derive, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import urlCp1252 from '../../exemples/participants_cas_limites_cp1252.csv?url';
import urlObjectifs from '../../exemples/objectifs_cas_limites.csv?url';
import {
  CADRE,
  capturesPrises,
  cloreCaptures,
  empreinteEtat,
  entiereDansLaFenetre,
  modeFourni,
  photographier,
  requeteHorsBoucle,
} from '../../test/navigateur/captures.js';
import { NOM_CAS_LIMITES, attendre, centre, octetsCasLimites } from '../../test/navigateur/ecrans.js';
import { fixerCadre, pointer, touche } from '../../test/navigateur/entrees.js';
import { poserFeuille } from '../../test/navigateur/feuilles.js';
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

// L'écart de l'horloge pilotée entre la génération et la retenue : plus
// d'une minute, la précision d'un horodatage mis en forme.
const ECART_RETENUE_MS = 2 * 60 * 1000;

// Le CSV des cas limites enregistré en windows-1252 (§ 10.3, capture 02b).
const NOM_CP1252 = 'participants_cas_limites_cp1252.csv';

// Le CSV des objectifs de table aux cas limites (§ 10.4, capture 05b) : ses
// lignes valides visent les tables 1 et 2 d'une soirée de moins de neuf
// tours, et l'une d'elles écrit en capitales une étiquette des participants.
const NOM_OBJECTIFS = 'objectifs_cas_limites.csv';

// La clé d'une étiquette que l'import des cas limites donne à plusieurs
// personnes, sous deux orthographes qu'il fond en une (§ 10.1) ; une
// orthographe voisine, que la fiche reçoit sous la retenue (capture 04a), et
// que le CSV des objectifs porte aussi (capture 05b).
const CLE_ETIQUETTE = 'finance';
const ORTHOGRAPHE_VOISINE = 'FINANCE';

// Ce qui tient lieu de version dans une construction de documentation.
const MARQUE_PROVENANCE = versionVisible('documentation', VERSION.affichee, t);

// La personne que l'ordre de lecture ajoute : un nom inventé.
const AJOUTEE = { nom: 'Ombrelle', prenom: 'Iris' };

// Les gestes non destructeurs que les fenêtres surveillent (§ 2.1, § 5.9,
// D19), chacun exécuté au moins une fois par le parcours. Les gestes des
// étiquettes, des objectifs et des priorités portent le nom de leur
// commande ; les deux cases et le mode des objectifs passent par
// modifierReglage, que 10a exerce sur chacun d'eux, comme 11 sur le compte
// d'arrêt.
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
  'modifierReglage',
  'changerEtiquettes',
  'poserObjectif',
  'retirerObjectif',
  'changerRegleObjectifs',
  'importerObjectifs',
  'changerPriorites',
  'retablirPriorites',
]);

// Les familles de geste modifiant que la lecture et le plan bloqué refusent
// (§ 8.4, § 9), dans l'ordre où toutesFamilles les tente ; gestes nomme
// ceux de GESTES_NON_DESTRUCTEURS que la famille tente sous ce nom, vide
// pour une famille qui n'en tente aucun. Leur nombre est celui de la
// liste : toutesFamilles affirme qu'elle les a tentées toutes, dans cet
// ordre, et chaque geste des étiquettes, des objectifs et des priorités y
// est tenté. Les deux cases et le mode passent par modifierReglage : la
// famille des réglages de génération les tente.
const FAMILLES_MODIFIANTES = Object.freeze(
  [
    ['glisser une personne', []],
    ['glisser une table', []],
    ['tirer une poignée', []],
    ['poser une réservation', ['reserver']],
    ['titrer', ['titrer']],
    ['désigner', ['designer']],
    ['saisir dans une cellule', ['modifier']],
    ['changer les étiquettes', ['changerEtiquettes']],
    ['coller', []],
    ['importer', []],
    ['importer des objectifs', ['importerObjectifs']],
    ['créer une table', []],
    ['surcharger', ['surcharger']],
    ['changer le défaut', []],
    ['changer les tours', []],
    ['poser ou retirer un objectif', ['poserObjectif', 'retirerObjectif']],
    ['changer la règle par défaut', ['changerRegleObjectifs']],
    ['changer l’état', []],
    ['changer l’ordre des priorités', ['changerPriorites', 'retablirPriorites']],
    ['changer un réglage de génération', ['modifierReglage']],
  ].map(([nom, gestes]) => Object.freeze({ nom, gestes: Object.freeze(gestes) })),
);

// Les gestes des étiquettes, des objectifs — les deux cases et le mode
// compris, par modifierReglage — et des priorités : chacun tenté par une
// famille de FAMILLES_MODIFIANTES.
const GESTES_DES_OBJECTIFS = Object.freeze([
  'modifierReglage',
  'changerEtiquettes',
  'poserObjectif',
  'retirerObjectif',
  'changerRegleObjectifs',
  'importerObjectifs',
  'changerPriorites',
  'retablirPriorites',
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
let retirerFeuille = null;
const gestesSurveilles = new Set();
const fenetresVues = [];
// Les épreuves du fichier qui ont échoué, test ou crochet : la dernière
// épreuve refuse de publier tant qu'une seule y figure.
const epreuvesEnEchec = [];
// Ce que les étapes se transmettent : la personne désignée, la table et la
// proposition retenue, la charge d'avant l'ajustement de 19.
const memoire = {};

// En écriture, le dossier d'attente part vide : le dépôt d'un passage
// interrompu ne se publie jamais avec celui-ci.
beforeAll(async () => {
  await fixerCadre(CADRE.largeur, CADRE.hauteur);
  retirerFeuille = poserFeuille();
  await commands.requetesHorsBoucle();
  if (modeFourni() === 'ecrire') await commands.viderAttente();
  m = await monterApp({ provenance: 'documentation', executeur: creerExecuteurDirect({ coeursDisponibles: 4 }) });
});

// La capture d'un échec prend pour nom de fichier le titre de son groupe et
// celui de l'épreuve, un caractère pour un caractère ; un nom de plus de
// 255 octets lève ENAMETOOLONG, et l'échec perd sa capture. Le titre complet,
// compté en octets UTF-8 — une borne haute du nom —, garde une marge sous
// cette limite.
const TITRE_MAX_OCTETS = 200;

beforeEach(({ task, onTestFailed }) => {
  onTestFailed(() => {
    epreuvesEnEchec.push(task.name);
  });
  const titre = `${task.suite?.name ?? ''} ${task.name}`;
  expect(new TextEncoder().encode(titre).length, titre).toBeLessThanOrEqual(TITRE_MAX_OCTETS);
});

// Chaque épreuve, photographiée ou non, finit sans erreur au collecteur et
// sans requête hors de la boucle locale : celles d'après la dernière capture
// d'écran — les pages du PDF, les sorties, l'ordre de lecture, les fenêtres,
// la lecture et le plan bloqué — se relèvent ici. Les deux causes se
// lisent avant d'échouer et se nomment ensemble, la requête d'abord : une
// requête se nomme dans l'épreuve qui l'a émise, même quand le collecteur a
// aussi reçu une erreur.
afterEach(async () => {
  const requete = await requeteHorsBoucle();
  const erreurs = m.erreurs();
  const fautes = [
    ...(requete === null ? [] : [`requête hors de la boucle locale : ${requete}`]),
    ...(erreurs.length === 0 ? [] : [`erreurs reçues par le collecteur : ${JSON.stringify(erreurs)}`]),
  ];
  if (fautes.length > 0) expect.fail(fautes.join(' ; '));
});

afterAll(async () => {
  m?.demonter();
  retirerFeuille?.();
  window.scrollTo(0, 0);
});

// --- Les lectures --------------------------------------------------------------------

const dans = (selecteur) => m.racine.querySelector(selecteur);
const tous = (selecteur) => [...m.racine.querySelectorAll(selecteur)];
const etat = () => m.seance.etat();
const charge = () => etat().charge;
const revision = () => etat().evenement.revision;
const base = () => etat().evenement.base;
const plat = (texte) => texte.replace(/\s+/g, ' ').trim();
const texteDe = (element) => plat(element.textContent);

// Le mode de l'événement ouvert, sans cadre : la surface de travail est en
// ce mode et ne porte aucun trait ; la bande de mode, visible, et le libellé
// de la barre, à côté de la place fixe, le nomment, comme le bandeau.
function exigerModeSansCadre(mode) {
  const surface = dans('[data-mode]');
  expect(surface.dataset.mode).toBe(mode);
  expect(surface.hasAttribute('data-marque')).toBe(false);
  const style = getComputedStyle(surface);
  for (const cote of ['Top', 'Right', 'Bottom', 'Left']) expect(Number.parseFloat(style[`border${cote}Width`]), cote).toBe(0);
  const bande = dans('[data-ecran="evenement"] > [role="status"]');
  const libelle = dans('[data-mode-libelle="barre"]');
  expect(visible(bande)).toBe(true);
  expect(visible(libelle)).toBe(true);
  expect(texteDe(libelle).length).toBeGreaterThan(0);
  expect(texteDe(bande)).toContain(texteDe(libelle));
  expect(texteDe(dans('[data-mode-libelle="bandeau"]'))).toBe(texteDe(libelle));
}

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

// Avance le pointeur par pas du point depuis au point vers.
async function bouger(depuis, vers, pas = 10) {
  for (let i = 1; i <= pas; i += 1) {
    await pointer('bouger', depuis.x + ((vers.x - depuis.x) * i) / pas, depuis.y + ((vers.y - depuis.y) * i) / pas);
    await uneImage();
  }
  flushSync();
}

// Presse au point depuis et avance par pas jusqu'au point vers, sans relâcher.
async function presserEtBouger(depuis, vers, pas = 10) {
  await pointer('presser', depuis.x, depuis.y);
  await bouger(depuis, vers, pas);
}

async function glisserVers(depuis, vers) {
  await presserEtBouger(depuis, vers);
  await pointer('relacher', vers.x, vers.y);
  flushSync();
  await images(3);
}

// Choisit au clavier la valeur d'un sélecteur, un cran de flèche à la fois,
// la page rendue à chaque cran : chaque cran est un choix, comme au clavier
// de l'opérateur. Au plus autant de crans que d'options.
async function choisirAuClavier(choix, valeur) {
  choix.focus();
  const cible = [...choix.options].findIndex((option) => option.value === valeur);
  expect(cible, `option ${valeur}`).toBeGreaterThanOrEqual(0);
  for (let cran = 0; cran < choix.options.length && choix.selectedIndex !== cible; cran += 1) {
    await touche(choix.selectedIndex < cible ? 'ArrowDown' : 'ArrowUp');
    flushSync();
    await images(2);
  }
  expect(choix.value, `le choix ${valeur}`).toBe(valeur);
}

// Fait défiler le premier ancêtre défilant des éléments jusqu'à centrer la
// réunion de leurs boîtes, qui doit tenir dans sa hauteur visible : l'image
// les montre ensemble. Sans ancêtre défilant, la fenêtre défile.
async function cadrerDansLaSurface(elements) {
  const boites = elements.map((element) => element.getBoundingClientRect());
  const haut = Math.min(...boites.map((b) => b.top));
  const bas = Math.max(...boites.map((b) => b.bottom));
  let porteur = elements[0].parentElement;
  while (porteur !== null && !(porteur.scrollHeight > porteur.clientHeight && /auto|scroll/.test(getComputedStyle(porteur).overflowY))) {
    porteur = porteur.parentElement;
  }
  if (porteur === null) {
    await cadrerSur(elements);
    return;
  }
  const cadre = porteur.getBoundingClientRect();
  const visibleHaut = Math.max(cadre.top + porteur.clientTop, 0);
  const visibleBas = Math.min(cadre.top + porteur.clientTop + porteur.clientHeight, innerHeight);
  expect(bas - haut, 'les éléments à montrer tiennent dans la hauteur visible de leur surface').toBeLessThanOrEqual(visibleBas - visibleHaut);
  porteur.scrollTop += Math.round((haut + bas - visibleHaut - visibleBas) / 2);
  await images(2);
}

// Fait défiler en largeur le premier ancêtre des éléments qui défile ainsi,
// jusqu'à centrer la réunion de leurs boîtes, qui doit tenir dans sa largeur
// visible : l'image les montre ensemble. Un tel ancêtre est exigé.
async function cadrerEnLargeur(elements) {
  const boites = elements.map((element) => element.getBoundingClientRect());
  const gauche = Math.min(...boites.map((b) => b.left));
  const droite = Math.max(...boites.map((b) => b.right));
  let porteur = elements[0].parentElement;
  while (porteur !== null && !(porteur.scrollWidth > porteur.clientWidth && /auto|scroll/.test(getComputedStyle(porteur).overflowX))) {
    porteur = porteur.parentElement;
  }
  expect(porteur, 'un ancêtre qui défile en largeur').not.toBeNull();
  const visibleGauche = porteur.getBoundingClientRect().left + porteur.clientLeft;
  const visibleDroite = visibleGauche + porteur.clientWidth;
  expect(droite - gauche, 'les éléments à montrer tiennent dans la largeur visible de leur ancêtre').toBeLessThanOrEqual(visibleDroite - visibleGauche);
  porteur.scrollLeft += Math.round((gauche + droite - visibleGauche - visibleDroite) / 2);
  await images(2);
}

// Ferme l'aperçu d'import ouvert, puis ouvre celui du fichier donné ; rend
// l'aperçu, son nom de fichier affiché.
async function ouvrirApercu(nom, octets) {
  if (dans('[data-apercu]') !== null) {
    await cliquer('[data-apercu] [data-commande="fermerApercu"]');
    await attendre('l’aperçu fermé', () => dans('[data-apercu]') === null);
  }
  m.fs.choisirFichierAImporter = async () => ({ nom, octets });
  await cliquer('[data-section="import"] [data-commande="choisirFichier"]');
  return attendre(`l’aperçu de ${nom}`, () => dans('[data-apercu] [data-fichier]')?.textContent.trim() === nom && dans('[data-apercu]'));
}

// Les crans de « Zoom + » au-delà du premier zoom où chaque table de la
// grande démonstration passe au régime des sièges (capture 07a). À ce
// premier zoom, une chaise mesure environ 18 px : le trait de la chaise 3,
// d'épaisseur fixe à l'écran, longe celui du plateau qu'elle touche sur une
// bande où tombent la plupart des points que le relevé des marques
// échantillonne (captures.js), et la marque s'y mesure contre un trait de sa
// propre couleur. Deux crans plus haut, la bande ne retient plus qu'une
// minorité de ces points.
const CRANS_AU_DESSUS = 2;

// Le zoom lu sur le groupe de la vue du plan.
const zoomLu = () => vueDepuisTransform(dans('[data-vue]').getAttribute('transform')).k;

// Le régime des cibles de chaque table montrée, au zoom lu.
const regimes = () => etatMontre().tables.map((table) => regimeCibles(zoomLu(), geometrieTable(table, table.capacite)));

// Clique la commande de zoom jusqu'à ce que chaque table soit au régime
// voulu, en au plus crans clics.
async function zoomerJusqua(regime, commande, crans = 40) {
  for (let cran = 0; regimes().some((r) => r !== regime); cran += 1) {
    expect(cran, `crans de ${commande} jusqu’au régime ${regime}`).toBeLessThan(crans);
    await cliquer(`[data-commande="${commande}"]`);
    await images(2);
  }
}

// Ramène en haut chaque ancêtre qui défile d'un élément.
function enHaut(element) {
  for (let ancetre = element.parentElement; ancetre !== null; ancetre = ancetre.parentElement) {
    if (ancetre.scrollHeight > ancetre.clientHeight) ancetre.scrollTop = 0;
  }
}

// L'élément du document qu'atteint le point (x, y) de la fenêtre.
const atteintAuPoint = ({ x, y }) => document.elementFromPoint(x, y);

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

// La marge, en px, que le libellé du fantôme garde au bord droit du plan.
const MARGE_FANTOME_PX = 24;

// Fait glisser la vue de dx px, par un appui sur le sol du plan : un point
// de la bande haute du cadre où le pointeur n'atteint ni table, ni chaise,
// ni poignée.
async function glisserLaVue(dx) {
  const cadre = dans('[data-plan]').getBoundingClientRect();
  const sol = { x: cadre.left + cadre.width / 2, y: cadre.top + 12 };
  const atteint = atteintAuPoint(sol);
  expect(dans('[data-plan]').contains(atteint), 'le sol, dans le plan').toBe(true);
  expect(atteint.closest('[data-table], [data-siege], [data-poignee]'), 'le sol, hors de toute table').toBeNull();
  await glisserVers(sol, { x: sol.x + dx, y: sol.y });
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
  expect(oublier, 'la commande qui oublie le choix').not.toBeNull();
  await appuyer(oublier, 'oublier le choix');
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
  const fermer = dans('[data-surface] [data-commande="fermerPose"]');
  expect(fermer, 'la commande qui ferme la pose').not.toBeNull();
  await appuyer(fermer, 'fermer le refus posé');
  await attendre('la pose fermée', () => m.ui.etat().pose === null);
}

// Le refus posé à côté d'un élément, dans le porteur donné, avec son remède ;
// un refus autre que ancien, qu'un geste précédent a laissé dans le même
// porteur.
async function refusPres(porteur, code, remede, geste, ancien = null) {
  const refus = await attendre(`le refus ${code} de ${geste}`, () => {
    const lu = porteur().querySelector(`[data-refus="${code}"]`);
    return lu !== ancien ? lu : null;
  });
  expect(refus.querySelector(`[data-commande="${remede}"]`)?.textContent, geste).toBe(t(`communs.remede.${remede}`));
  return refus;
}

// --- L'aperçu avant impression ----------------------------------------------------------

// Ce que chaque photographie de l'aperçu affirme de la première feuille :
// le cartouche, l'échelle graphique, le pied qui porte l'horodatage et la
// marque de provenance.
const CONDITIONS_FEUILLE = Object.freeze([
  '[data-impression] [data-feuille] [data-cartouche]',
  '[data-impression] [data-feuille] [data-marque="echelle"]',
  '[data-impression] [data-feuille] [data-pied]',
]);

const format = creerFormat(t);

// Les chemins que les primitives d'écriture ont reçus depuis le rang donné
// de la trace, sans doublon, dans l'ordre du premier appel.
const cheminsEcrits = (rang) => [...new Set(m.trace.slice(rang).map(([, , chemin]) => chemin).filter((chemin) => chemin !== ''))];

// Les feuilles du plan imprimé de la sortie {source, proposition, tour},
// chacune affirmée : son cartouche, son échelle graphique et la mention
// « disposition relative » (§ 7.7) ; son pied — le nom de l'événement, le
// tour, l'horodatage lu sur le placement qui s'imprime, mis en forme comme
// l'application le met, la marque de provenance et jamais la version
// (§ 11.7, § 18.6). Rend les feuilles.
async function feuillesDuPlan(sortie) {
  const placement = sortie.source === 'retenu' ? charge().retenu : charge().propositions.find(({ id }) => id === sortie.proposition);
  const horodatage = placement?.horodatage ?? null;
  expect(horodatage, 'l’horodatage de la sortie').not.toBeNull();
  const feuilles = await attendre('les feuilles du plan', () => {
    const lues = tous('[data-impression][data-vue-impression="plan"] [data-feuille]');
    return lues.length > 0 && lues.every((feuille) => feuille.querySelector('svg[role="img"] [data-table]')) ? lues : null;
  });
  for (const feuille of feuilles) {
    const page = `feuille ${feuille.dataset.feuille}`;
    expect(texteDe(feuille.querySelector('[data-cartouche]')).length, page).toBeGreaterThan(0);
    expect(feuille.querySelector('[data-marque="echelle"]').getBoundingClientRect().width, page).toBeGreaterThan(0);
    expect(texteDe(feuille.querySelector('[data-mention="relative"]')), page).toBe(t('plan.echelle.mention'));
    const pied = texteDe(feuille.querySelector('[data-pied]'));
    expect(pied, page).toContain(charge().evenement.nom);
    expect(pied, page).toContain(t('impression.pied.tour', { tour: sortie.tour }));
    expect(pied, page).toContain(format.horodatage(horodatage));
    expect(pied, page).toContain(MARQUE_PROVENANCE);
    expect(pied, page).not.toContain(VERSION.affichee);
  }
  return feuilles;
}

// Fait défiler la fenêtre jusqu'à centrer la réunion des boîtes des
// éléments, qui doit tenir dans sa hauteur : l'image les montre ensemble.
async function cadrerSur(elements) {
  const boites = elements.map((element) => element.getBoundingClientRect());
  const haut = Math.min(...boites.map((b) => b.top));
  const bas = Math.max(...boites.map((b) => b.bottom));
  expect(bas - haut, 'les éléments à montrer tiennent dans la hauteur de la fenêtre').toBeLessThanOrEqual(innerHeight);
  window.scrollBy(0, Math.round((haut + bas - innerHeight) / 2));
  await images(2);
}

// La barre de l'aperçu — l'enfant de [data-ecran="apercu"] qui porte sa
// commande fermerApercu — est hors de l'image : son bas au bord haut de la
// fenêtre ou au-dessus (§ 19.3, 22 et 23). Une barre collante resterait
// dans la fenêtre au défilement de la feuille.
function barreHorsDeLImage() {
  const ecran = dans('[data-ecran="apercu"]');
  let barre = ecran.querySelector('[data-commande="fermerApercu"]');
  expect(barre, 'la commande fermerApercu de l’aperçu').not.toBeNull();
  while (barre.parentElement !== ecran) barre = barre.parentElement;
  expect(barre.getBoundingClientRect().bottom, 'le bas de la barre de l’aperçu, au-dessus de la fenêtre').toBeLessThanOrEqual(0);
}

// --- La planche de badges photographiée (§ 19.6) --------------------------------------

// Les images de la planche (§ 19.3, § 19.6) : la feuille de contrôle, page 1
// du PDF, et la première planche, page 2.
const PAGE_CONTROLE = Object.freeze({ page: 1, fichier: '24-badges-controle' });
const PAGE_PLANCHE = Object.freeze({ page: 2, fichier: '25-badges-planche' });

// Les images que la production de la planche attend au plus : la police et
// pdf-lib se chargent à la première production.
const IMAGES_PLANCHE = 1800;

// L'écart de l'horloge pilotée entre deux productions de la même planche :
// une date du document tirée de l'horloge, et non du placement, les
// séparerait à la seconde.
const ECART_PRODUCTIONS_MS = 60 * 1000;

// Les captures tramées du PDF que le parcours a menées à leur terme.
const capturesPdf = new Set();

// Le texte base64 d'octets : le PDF traverse ainsi le RPC des commandes,
// qui sérialiserait un Uint8Array en objet.
function enBase64(octets) {
  let binaire = '';
  for (let debut = 0; debut < octets.length; debut += 0x8000) {
    binaire += String.fromCharCode(...octets.subarray(debut, debut + 0x8000));
  }
  return btoa(binaire);
}

// Le SHA-256 hexadécimal d'octets.
async function empreinte(octets) {
  const tampon = await crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(tampon)].map((octet) => octet.toString(16).padStart(2, '0')).join('');
}

// Le texte d'une page de PDF lue, ses fragments joints, blancs réduits.
const texteDePage = (lue) => plat(lue.textes.join(' '));

// Les traits droits d'une page de PDF lue, en mm : les abscisses des
// verticaux et les ordonnées des horizontaux, puis les longueurs des
// horizontaux, au centième, chacune une fois, croissantes.
function axesDe(lue) {
  const centieme = (valeur) => Math.round(valeur * 100) / 100;
  const uniques = (valeurs) => [...new Set(valeurs.map(centieme))].sort((a, b) => a - b);
  const verticaux = lue.segments.filter(({ x1, x2 }) => Math.abs(x1 - x2) < 1e-3);
  const horizontaux = lue.segments.filter(({ y1, y2 }) => Math.abs(y1 - y2) < 1e-3);
  return {
    x: uniques(verticaux.map(({ x1 }) => x1)),
    y: uniques(horizontaux.map(({ y1 }) => y1)),
    longueurs: uniques(horizontaux.map(({ x1, x2 }) => Math.abs(x2 - x1))),
  };
}

// Compare deux textes point de code par point de code, sans tenir compte
// de la langue, comme l'ordre alphabétique de la planche (§ 11.6, § 15.5).
function parPointsDeCode(a, b) {
  const [x, y] = [[...a], [...b]];
  for (let rang = 0; rang < Math.min(x.length, y.length); rang += 1) {
    const ecart = x[rang].codePointAt(0) - y[rang].codePointAt(0);
    if (ecart !== 0) return ecart;
  }
  return x.length - y.length;
}

/**
 * Photographie une page du PDF de la planche (§ 19.6) : tramerPdf la lit
 * d'abord sans rien écrire, conditions(lue) affirme ce qu'elle montre, aucune
 * requête hors de la boucle locale n'attend d'être nommée (§ 19.11), puis,
 * en écriture, la trame en PNG sous le dossier d'attente et dépose l'entrée ;
 * en vérification, compare l'entrée au manifeste. L'entrée porte la source
 * pdf, la taille de la page à 96 ppp pour cadre, la couche de texte de la
 * page pour texte, aucun style — le PDF n'a pas de thème d'écran — et le
 * SHA-256 des octets pour pdf.
 *
 * @param {Uint8Array} octets  le PDF produit
 * @param {{page: number, fichier: string}} quoi
 * @param {(lue: Object) => void} conditions
 */
async function photographierPdf(octets, { page, fichier }, conditions) {
  const { captures } = await commands.declarationsCaptures();
  const declaree = captures.find((capture) => capture.fichier === fichier);
  expect(declaree, `${fichier} déclarée`).toMatchObject({ source: 'pdf' });
  const octetsB64 = enBase64(octets);
  const lu = await commands.tramerPdf({ octetsB64, pages: [{ page, fichier }], ecrire: false });
  expect(lu.pdf).toBe(await empreinte(octets));
  const [lue] = lu.pages;
  conditions(lue);
  const requete = await requeteHorsBoucle();
  if (requete !== null) expect.fail(`capture ${fichier} : requête hors de la boucle locale : ${requete}`);
  const racineNeutre = etat().racine.chemin;
  expect(await commands.cheminsHorsRacine({ texte: lue.textes, racine: racineNeutre }), fichier).toEqual([]);
  const entree = {
    fichier,
    etape: declaree.etape,
    source: 'pdf',
    versionReelle: VERSION.affichee,
    graine: GRAINE,
    cadre: lue.cadre,
    facteurEchelle: 1,
    mode: lu.mode,
    theme: 'clair',
    instant: m.horloge.horodatage(),
    texte: lue.textes,
    styles: { clair: [], sombre: [] },
    etat: await empreinteEtat(m),
    pdf: lu.pdf,
  };
  if (modeFourni() === 'ecrire') {
    const tramee = await commands.tramerPdf({ octetsB64, pages: [{ page, fichier }], ecrire: true });
    expect(tramee.pdf).toBe(lu.pdf);
    await commands.deposerCapture({ fichier, entree, chemin: tramee.pages[0].chemin });
  } else {
    const { ecarts } = await commands.comparerCapture({ fichier, entree });
    expect(ecarts, `capture ${fichier} : écart au manifeste`).toEqual([]);
  }
  capturesPdf.add(fichier);
}

// --- Sortir sans modifier (§ 11.6, § 8.4) ------------------------------------------

// Les sorties d'un événement ouvert : l'aperçu de chaque vue, envoyé à
// l'imprimante d'épreuve ; le papier de la machine changé, puis rendu ;
// la planche de badges produite par la section Badges. Le parcours
// reprend sur le plan. Rend le nom du PDF écrit.
async function sortir() {
  const impressions = m.imprimante.appels().length;
  const rang = m.trace.length;
  await ouvrirSection('plan');
  await cliquer('[data-ecran="evenement"] [data-commande="apercu"]');
  await attendre('le document imprimé', () => dans('[data-impression] [data-feuille]'));
  for (const vue of ['plan', 'accueil', 'tables']) {
    await cliquer(`[data-ecran="apercu"] [data-commande="vue"][data-cible="${vue}"]`);
    await attendre(`la vue ${vue}`, () => dans(`[data-impression][data-vue-impression="${vue}"] [data-feuille]`));
    await cliquer('[data-ecran="apercu"] [data-commande="imprimer"]');
  }
  await attendre('trois impressions', () => m.imprimante.appels().length === impressions + 3);
  for (const papier of ['Lettre', 'A4']) {
    await cliquer('[data-ecran="apercu"] [data-papier="choisi"] [data-commande="changerPapier"]');
    await attendre('la question du papier', () => dans('[data-ecran="apercu"] [data-papier="question"]'));
    await cliquer(`[data-papier="question"] [data-cible="${papier}"] [data-commande="choisirPapier"]`);
    await attendre(`le papier ${papier}`, () => etat().papier === papier && dans('[data-papier="choisi"]') && dans('[data-impression] [data-feuille]'));
  }
  await cliquer('[data-ecran="apercu"] [data-commande="fermerApercu"]');
  await attendre('l’événement, de retour', () => dans('[data-ecran="evenement"]'));
  await ouvrirSection('badges');
  await cliquer('[data-section="badges"] [data-commande="produirePlanche"]');
  await attendre('la planche produite', () => dans('[data-section="badges"] [data-chemin-planche]'), IMAGES_PLANCHE);
  const planches = cheminsEcrits(rang).filter((chemin) => chemin.endsWith('.pdf'));
  expect(planches, 'une planche écrite').toHaveLength(1);
  await ouvrirSection('plan');
  return planches[0];
}

// « Regarder n'écrit jamais » (§ 8.2, § 8.4, § 11.6) : les deux écritures
// que regarder et sortir admettent — reglages_locaux.json, où s'écrivent
// le cadrage différé et le papier de la machine, et la planche de
// l'événement, <base>.badges…pdf. Rien d'autre.
const ecritureAdmise = (chemin) =>
  chemin === 'reglages_locaux.json' || (chemin.startsWith(`${base()}.badges`) && chemin.endsWith('.pdf'));

// Sort, puis affirme que seules les deux écritures admises ont eu lieu,
// chacune au moins une fois : rien de l'événement.
async function sortirSansEcrire(avant, empreinte, geste) {
  const rang = m.trace.length;
  const planche = await sortir();
  const interdites = m.trace.slice(rang).filter(([, , chemin]) => chemin !== '' && !ecritureAdmise(chemin));
  expect(interdites, geste).toEqual([]);
  expect(cheminsEcrits(rang).sort(), geste).toEqual([planche, 'reglages_locaux.json'].sort());
  expect(serialiserCharge(charge())).toBe(empreinte);
  await rienEcrit(avant, geste);
}

// --- Le parcours (§ 2.1, § 19.3) ------------------------------------------------------

describe('le parcours par gestes, depuis un répertoire neuf', { timeout: DUREE }, () => {
  test('01 le répertoire vide : le catalogue offert, la marque de provenance à la place de la version, le chemin', async () => {
    await attendre('le premier écran', () => dans('[data-ecran="accueil"] [data-dossier-travail]'));
    expect(tous('[data-evenement]')).toHaveLength(0);
    const offertes = tous('[data-demonstration]');
    expect(CATALOGUE.length).toBeGreaterThan(0);
    expect(offertes).toHaveLength(CATALOGUE.length);
    offertes.forEach((entree, rang) => {
      expect(texteDe(entree)).toBe(CATALOGUE[rang].nom);
      expect(visible(entree)).toBe(true);
    });
    for (const porteur of ['[data-version]', '[data-bandeau]']) {
      expect(dans(porteur).textContent, porteur).toContain(MARQUE_PROVENANCE);
      expect(dans(porteur).textContent, porteur).not.toContain(VERSION.affichee);
    }
    const chemin = dans('[data-dossier-travail]').textContent;
    expect(chemin.length).toBeGreaterThan(0);
    expect(chemin).toBe(etat().racine.chemin);
    await photographier(m, '01-premier-ecran', { condition: ['[data-dossier-travail]', '[data-version]', '[data-demonstration]'] });
  });

  test('01 « Soirée d’essai » créée s’ouvre en lecture', async () => {
    await taper(dans('[data-ecran="accueil"] input[data-champ="nom"]'), NOM_SOIREE);
    await cliquer('[data-ecran="accueil"] [data-commande="creer"]');
    await attendre('l’événement ouvert', () => dans('[data-ecran="evenement"]') && etat().evenement !== null);
    expect(etat().evenement.nom).toBe(NOM_SOIREE);
    expect(etat().mode).toBe('lecture');
    expect(charge().participants).toHaveLength(0);
  });

  test('01b une modification refusée en lecture, à côté de son geste, avec « Modifier » pour remède ; la lecture, sans cadre', async () => {
    await ouvrirSection('tables');
    const avant = fichiers();
    exigerModeSansCadre('lecture');
    await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
    await refusPres(() => dans('[data-commande="creerTableRonde"]').parentElement, 'MODE_LECTURE', 'modifier', 'créer une table');
    expect(document.querySelectorAll(FENETRE)).toHaveLength(0);
    await rienEcrit(avant, 'créer une table en lecture');
    expect(charge().tables).toHaveLength(0);
    await photographier(m, '01b-passer-en-ecriture', {
      condition: ['[data-place-fixe] [data-commande="modifier"]', '[data-refus="MODE_LECTURE"]', '[data-mode-libelle="barre"]'],
    });
  });

  test('01b « Modifier » : l’écriture, sans cadre ; la même modification passe', async () => {
    await cliquer('[data-place-fixe] [data-commande="modifier"]');
    await attendre('l’écriture', () => etat().mode === 'ecriture' && dans('[data-place-fixe] [data-commande="lecture"]'));
    expect(visible(dans('[data-mode]'))).toBe(true);
    exigerModeSansCadre('ecriture');

    const r = revision();
    await cliquer('[data-section="tables"] [data-commande="creerTableRonde"]');
    await uneEntree(r, 'créer une table');
    expect(charge().tables).toHaveLength(1);
    expect(charge().tables[0].sieges).toBeNull();
  });

  test('02 l’aperçu des cas limites : encodage et séparateur de l’analyseur ; un groupe fondu, une ligne refusée', async () => {
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
    await photographier(m, '02-import-apercu', { condition: ['[data-apercu] [data-encodage]', '[data-apercu] [data-separateur]'] });
  });

  test('02b l’aperçu d’un CSV en windows-1252 : l’encodage nommé, chaque caractère accentué intact', async () => {
    const octets = new Uint8Array(await (await fetch(urlCp1252)).arrayBuffer());
    const avant = fichiers();
    const apercu = await ouvrirApercu(NOM_CP1252, octets);
    const { texte, encodage } = decoder(octets);
    expect(encodage).toBe('windows-1252');
    expect(texteDe(apercu.querySelector('[data-encodage]'))).toBe(t(ENCODAGES.get(encodage)));
    // Les cellules hors ASCII du fichier, décodées par l'analyseur : celles
    // que l'aperçu montre y sont entières ; aucun caractère de remplacement,
    // aucune séquence UTF-8 lue en windows-1252.
    const accentuees = decouper(texte, apercevoir(texte).separateur)
      .enregistrements.flat()
      .map((cellule) => cellule.trim())
      .filter((cellule) => /[^\u{0}-\u{7F}]/u.test(cellule));
    const montrees = accentuees.filter((cellule) => apercu.textContent.includes(cellule));
    expect(montrees.length, accentuees.join(' | ')).toBeGreaterThan(0);
    expect(apercu.textContent).not.toMatch(/\u{FFFD}|\u{C3}[\u{80}-\u{BF}]/u);
    await rienEcrit(avant, 'l’aperçu en windows-1252');
    await photographier(m, '02b-import-cp1252', { condition: ['[data-apercu] [data-encodage]', '[data-apercu] [data-fichier]'] });
  });

  test('03 le rapport : une entrée, les lignes valides comptées, le groupe fondu et la ligne refusée', async () => {
    await ouvrirApercu(NOM_CAS_LIMITES, await octetsCasLimites());
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
    await photographier(m, '03-import-rapport', { condition: ['[data-rapport] [data-compte="ajoutes"]'] });
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
    // La capture montre le haut de la grille, son tri et son filtre : le
    // focus de la dernière cellule saisie part, la grille revient en haut.
    document.activeElement?.blur();
    enHaut(section().querySelector('[role="grid"]'));
    await images(2);
    // L'avertissement des places manquantes, à côté de la tête, se lit en
    // entier, son bouton compris : la zone des annonces ne défile pas, et
    // le bouton tient dans sa boîte visible.
    const zone = dans('[data-annonces]');
    const bouton = zone.querySelector('[data-avertissement="PLACES_MANQUANTES"] button[data-commande]');
    expect(bouton, 'le bouton de l’avertissement').not.toBeNull();
    expect(zone.scrollHeight, 'la zone des annonces ne défile pas').toBeLessThanOrEqual(zone.clientHeight + 1);
    const visibleZone = zone.getBoundingClientRect();
    const boiteBouton = bouton.getBoundingClientRect();
    expect(boiteBouton.top, 'le haut du bouton dans la zone').toBeGreaterThanOrEqual(visibleZone.top + zone.clientTop - 0.5);
    expect(boiteBouton.bottom, 'le bas du bouton dans la zone').toBeLessThanOrEqual(visibleZone.top + zone.clientTop + zone.clientHeight + 0.5);
    await photographier(m, '04-grille-participants', {
      condition: ['[data-section="participants"] [data-champ="filtre"]', '[data-section="participants"] [data-commande="trier"][data-cible="nom"]'],
    });
  });

  // Étape 3 (§ 4.5, § 10.2, A22) : la fiche d'une personne importée avec
  // ses étiquettes. Une saisie d'une orthographe voisine d'une étiquette que
  // d'autres portent reçoit l'existante, et le signal se pose contre le
  // champ ; la légende chiffre chaque étiquette, exclues comprises.
  test('04a la fiche : ses étiquettes en pastilles ; « FINANCE » reçu sous l’orthographe retenue, le signal contre le champ ; la légende chiffrée', async () => {
    const section = () => dans('[data-section="participants"]');
    const portees = (p) => p.etiquettes ?? [];
    // L'orthographe que l'import a retenue pour la clé, une seule, et que
    // plusieurs personnes portent ; la voisine en diffère.
    const retenues = [...new Set(charge().participants.flatMap(portees).filter((motCle) => cleNormalisee(motCle) === CLE_ETIQUETTE))];
    expect(retenues).toHaveLength(1);
    const [existante] = retenues;
    expect(charge().participants.filter((p) => portees(p).includes(existante)).length).toBeGreaterThan(1);
    expect(cleNormalisee(ORTHOGRAPHE_VOISINE)).toBe(CLE_ETIQUETTE);
    expect(ORTHOGRAPHE_VOISINE).not.toBe(existante);
    memoire.etiquette = existante;
    const personne = charge().participants.find((p) => !p.exclu && portees(p).length > 0 && !portees(p).includes(existante));
    expect(personne, 'une personne étiquetée, sans « finance »').toBeDefined();
    await cliquer(`[data-section="participants"] [data-participant="${personne.id}"] [data-commande="fiche"]`);
    const fiche = await attendre('la fiche', () => dans(`[data-fiche="${personne.id}"]`));
    const pastilles = () => [...fiche.querySelectorAll('[data-etiquettes] li')].map((li) => texteDe(li.firstElementChild));
    expect(pastilles()).toEqual(personne.etiquettes);

    await sansFenetre('changerEtiquettes', async () => {
      const r = revision();
      await saisir(fiche.querySelector('input[data-champ="etiquettes"]'), ORTHOGRAPHE_VOISINE);
      await uneEntree(r, 'ajouter une étiquette');
    });
    const apres = charge().participants.find((p) => p.id === personne.id).etiquettes;
    expect(apres).toContain(existante);
    expect(apres).not.toContain(ORTHOGRAPHE_VOISINE);
    expect(pastilles()).toEqual(apres);
    const champ = fiche.querySelector('input[data-champ="etiquettes"]');
    expect(champ.value).toBe('');
    const signal = await attendre('le signal d’orthographe', () => fiche.querySelector('[data-avertissement="ORTHOGRAPHE_RETENUE"]'));
    expect(texteDe(signal)).toBe(plat(t('ORTHOGRAPHE_RETENUE', { saisie: ORTHOGRAPHE_VOISINE, retenue: existante })));
    expect(champ.getAttribute('aria-describedby')).toBe(signal.id);

    // La légende : chaque étiquette de la liste, avec le nombre de personnes
    // qui la portent, exclues comprises.
    const comptes = new Map();
    for (const p of charge().participants) for (const motCle of portees(p)) comptes.set(motCle, (comptes.get(motCle) ?? 0) + 1);
    const legende = section().querySelector('[data-legende-etiquettes]');
    expect(legende).not.toBeNull();
    const lus = [...legende.querySelectorAll('li')].map(texteDe).sort();
    const attendus = [...comptes].map(([nom, compte]) => plat(t('participants.legende.element', { nom, compte }))).sort();
    expect(lus).toEqual(attendus);

    // L'image montre le champ vidé, sans curseur ni anneau de focus. À
    // 1 366 × 700, la fiche s'ouvre sous la grille : la légende, en tête de
    // la section, n'entre pas dans la même fenêtre qu'elle, et 04 la montre.
    document.activeElement?.blur();
    await images(2);
    await photographier(m, '04a-etiquettes', {
      condition: [
        `[data-fiche="${personne.id}"] [data-etiquettes]`,
        `[data-fiche="${personne.id}"] input[data-champ="etiquettes"]`,
        `[data-fiche="${personne.id}"] [data-avertissement="ORTHOGRAPHE_RETENUE"]`,
      ],
    });
  });

  test('05 deux tables à 8, l’une au défaut, l’autre surchargée à 8 : leurs états diffèrent à valeur égale', async () => {
    // La fiche de 04a se ferme : elle reviendrait avec la section.
    if (dans('[data-fiche]') !== null) {
      await cliquer('[data-fiche] [data-commande="fermerFiche"]');
      await attendre('la fiche fermée', () => dans('[data-fiche]') === null);
    }
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
    await photographier(m, '05-tables-etat', {
      condition: [`[data-section="tables"] [data-table="${premiere.id}"] [data-etat-table]`, `[data-section="tables"] [data-table="${seconde.id}"] [data-etat-table]`],
    });
  });

  // Étape 4 (§ 4.5, D3, A22) : la règle par défaut, changée puis rendue ;
  // l'objectif de la soirée de la première table, qui suit cette règle ;
  // celui du tour 1 de la seconde, qui porte la sienne, « toutes », et
  // qu'aucune personne présente ne remplit. La correspondance se juge par
  // correspondA, la fonction du moteur, hors de l'écran (D18). Le choix de
  // règle de l'objectif qui la suit nomme la règle par défaut, et l'image la
  // montre par lui : la carte qui la règle, en tête de la section, n'entre
  // pas dans la même fenêtre que les deux objectifs.
  test('05a la règle par défaut ; la soirée de la table 1 la suit, le tour 1 de la table 2 porte la sienne ; l’objectif sans correspondant le dit', async () => {
    const [premiere, seconde] = charge().tables.map(({ id }) => id);
    const regleDefaut = () => dans('[data-regle-objectifs] select[data-champ="regleObjectifs"]');
    expect(regleDefaut().value).toBe('ou');
    await sansFenetre('changerRegleObjectifs', async () => {
      for (const valeur of ['et', 'ou']) {
        const r = revision();
        await choisirAuClavier(regleDefaut(), valeur);
        await uneEntree(r, `la règle par défaut « ${valeur} »`);
      }
    });
    expect(charge().reglages.regleObjectifs).toBeUndefined();

    const zone = (cle) => dans(`[data-section="tables"] [data-objectif="${cle}"]`);
    const champ = (cle) => zone(cle).querySelector(`input[data-champ="objectif-${cle}"]`);
    // Rangées par unités de code, comme la charge les écrit.
    const visees = ['Montréal', 'bénévole'];
    await sansFenetre('poserObjectif', async () => {
      let r = revision();
      await saisir(champ(String(premiere)), memoire.etiquette);
      await uneEntree(r, 'l’objectif de la soirée');
      await cliquer(`[data-section="tables"] [data-table="${seconde}"] [data-commande="basculerObjectifsTours"]`);
      const cle = `${seconde}-1`;
      await attendre('l’objectif du tour 1', () => zone(cle));
      // La règle d'un objectif neuf se choisit avant ses étiquettes, sans
      // rien écrire.
      r = revision();
      await choisirAuClavier(zone(cle).querySelector(`select[data-champ="regle-${cle}"]`), 'et');
      expect(revision()).toBe(r);
      await saisir(champ(cle), visees.join(', '));
      await uneEntree(r, 'l’objectif du tour 1');
    });
    const objectifsDe = (id) => charge().tables.find((table) => table.id === id).objectifs;
    expect(objectifsDe(premiere)).toEqual([{ portee: 'tous', tour: null, regle: null, etiquettes: [memoire.etiquette] }]);
    expect(objectifsDe(seconde)).toEqual([{ portee: 'tour', tour: 1, regle: 'et', etiquettes: visees }]);

    // Les deux états de règle, en mots, différents.
    const soiree = texteDe(zone(String(premiere)));
    const tour = texteDe(zone(`${seconde}-1`));
    expect(soiree).toContain(t('tables.objectif.suitDefaut'));
    expect(soiree).not.toContain(t('tables.objectif.reglePropre'));
    expect(tour).toContain(t('tables.objectif.reglePropre'));
    expect(tour).not.toContain(t('tables.objectif.suitDefaut'));
    const regleSoiree = zone(String(premiere)).querySelector(`select[data-champ="regle-${premiere}"]`);
    expect(regleSoiree.value).toBe('');
    expect(texteDe(regleSoiree.selectedOptions[0])).toBe(plat(t('tables.objectif.regleDefaut', { regle: 'ou' })));

    // Aucune personne présente ne remplit l'objectif du tour 1 : son signal ;
    // celui de la soirée a les siennes, et se tait.
    const presents = charge().participants.filter(({ exclu }) => !exclu);
    const remplit = (objectif, regle) => presents.some((p) => correspondA(p.etiquettes ?? [], { regle, etiquettes: objectif.etiquettes }));
    expect(remplit(objectifsDe(seconde)[0], 'et')).toBe(false);
    expect(remplit(objectifsDe(premiere)[0], 'ou')).toBe(true);
    expect(zone(`${seconde}-1`).querySelector('[data-avertissement="OBJECTIF_SANS_CORRESPONDANT"]')).not.toBeNull();
    expect(zone(String(premiere)).querySelector('[data-avertissement="OBJECTIF_SANS_CORRESPONDANT"]')).toBeNull();

    document.activeElement?.blur();
    await cadrerDansLaSurface([zone(String(premiere)), zone(`${seconde}-1`)]);
    await photographier(m, '05a-objectifs-tables', {
      condition: [
        `[data-objectif="${premiere}"]`,
        `[data-objectif="${premiere}"] select[data-champ="regle-${premiere}"]`,
        `[data-objectif="${seconde}-1"] select[data-champ="regle-${seconde}-1"]`,
        `[data-objectif="${seconde}-1"] [data-avertissement="OBJECTIF_SANS_CORRESPONDANT"]`,
      ],
    });
  });

  // Le CSV des objectifs aux cas limites (§ 10.4, A20, A22), sur la soirée
  // construite : ses deux tables portent les numéros 1 et 2, et elle compte
  // moins de neuf tours. L'aperçu, sous la nature « Objectifs de table » et
  // le mode « Mettre à jour », se compare à apercevoirObjectifs, que l'écran
  // n'appelle pas : séparateur, lignes refusées, orthographes fondues.
  test('05b l’aperçu des objectifs : la nature nommée, le séparateur, les lignes refusées, « FINANCE » fondue ; tables 1 et 2, moins de 9 tours', async () => {
    expect(charge().tables.map(({ numero }) => numero)).toEqual([1, 2]);
    expect(charge().evenement.tours).toBeLessThan(9);
    await ouvrirSection('import');
    await appuyer(dans('[data-nature-import] input[value="objectifs"]'), 'la nature « Objectifs de table »');
    const octets = new Uint8Array(await (await fetch(urlObjectifs)).arrayBuffer());
    const avant = fichiers();
    const apercu = await ouvrirApercu(NOM_OBJECTIFS, octets);
    const { texte } = decoder(octets);
    const attendu = apercevoirObjectifs(texte, charge(), { mode: 'mettreAJour' });
    expect(attendu.refusGlobal).toBeNull();

    const nature = dans('[data-nature-import] input:checked');
    expect(nature.value).toBe('objectifs');
    expect(texteDe(nature.closest('label'))).toBe(t('import.nature.objectifs'));
    expect(apercu.querySelector('[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    expect(texteDe(apercu.querySelector('[data-separateur]'))).toBe(t(SEPARATEURS.get(attendu.separateur)));
    const refusees = [...apercu.querySelectorAll('[data-refusees] [data-ligne]')];
    expect(refusees.map((ligne) => Number(ligne.dataset.ligne))).toEqual(attendu.refusees.map(({ ligne }) => ligne));
    expect(refusees.length).toBeGreaterThan(0);
    for (const ligne of refusees) expect(texteDe(ligne.querySelector('[data-motif]')).length, ligne.dataset.ligne).toBeGreaterThan(0);
    const fondues = [...apercu.querySelectorAll('[data-fusions-etiquettes] [data-affichee]')].map(texteDe);
    expect(fondues).toEqual(attendu.fusionsEtiquettes.map(({ retenue }) => retenue));
    expect(fondues).toContain(memoire.etiquette);
    expect(texteDe(apercu.querySelector('[data-fusions-etiquettes]'))).toContain(ORTHOGRAPHE_VOISINE);
    memoire.objectifsImportes = attendu.lignes.map(({ champs }) => champs);
    await rienEcrit(avant, 'l’aperçu des objectifs');
    // L'image montre les lignes refusées et la fusion ; la nature cochée et
    // le séparateur, en tête de la section, n'entrent pas dans la même
    // fenêtre qu'elles.
    await cadrerDansLaSurface([apercu.querySelector('[data-refusees]'), apercu.querySelector('[data-fusions-etiquettes]')]);
    await photographier(m, '05b-import-objectifs', {
      condition: ['[data-apercu] [data-refusees]', '[data-apercu] [data-refusees] [data-ligne] [data-motif]', '[data-apercu] [data-fusions-etiquettes]'],
    });
  });

  test('05b « Importer » en « Mettre à jour » : une entrée, sans fenêtre ; les objectifs du fichier posés, celui du tour 1 de la table 2 gardé', async () => {
    const [, seconde] = charge().tables.map(({ id }) => id);
    const garde = charge().tables.find(({ id }) => id === seconde).objectifs.find(({ tour }) => tour === 1);
    expect(garde).toBeDefined();
    await sansFenetre('importerObjectifs', async () => {
      const r = revision();
      await cliquer('[data-apercu] [data-commande="importer"]');
      await uneEntree(r, 'importer les objectifs');
    });
    await attendre('le rapport', () => dans('[data-rapport]'));
    const objectifs = charge().tables.flatMap(({ id, objectifs: siens = [] }) => siens.map((objectif) => ({ table: id, ...objectif })));
    for (const { table, tour, regle, etiquettes } of memoire.objectifsImportes) {
      expect(objectifs, `table ${table}, tour ${tour}`).toContainEqual(expect.objectContaining({ table, tour, regle, etiquettes }));
    }
    expect(objectifs).toContainEqual({ table: seconde, ...garde });
    // La section revient à la nature par défaut : les imports de
    // participants qui suivent la trouvent cochée.
    await appuyer(dans('[data-nature-import] input[value="participants"]'), 'la nature « Participants »');
    expect(dans('[data-nature-import] input:checked').value).toBe('participants');
    await ouvrirSection('tables');
  });

  test('06 l’énoncé d’un changement de défaut, chiffré avant toute application : rien d’écrit', async () => {
    const avant = fichiers();
    await saisir(dans('[data-section="tables"] input[data-champ="siegesParDefaut"]'), '10');
    const enonce = await attendre('l’énoncé', () => dans('[data-enonce="defaut"]'));
    expect(visible(enonce)).toBe(true);
    await rienEcrit(avant, 'l’énoncé');
    memoire.phrase = [...enonce.querySelectorAll('[data-phrase]')].map(texteDe).join(' ');
    expect(memoire.phrase).toMatch(/(\d+)\s*\u{2192}\s*(\d+)/u);
    await photographier(m, '06-defaut-consequence', { condition: ['[data-enonce="defaut"]', '[data-enonce="defaut"] [data-commande="appliquer"]'] });
  });

  test('06 appliquer le défaut : le total annoncé égal au moteur ; étape 5, le nombre de tours', async () => {
    const { phrase } = memoire;
    const total = phrase.match(/(\d+)\s*\u{2192}\s*(\d+)/u);
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

  test('07 le plan à l’échelle : chaque plateau à son diamètre au zoom lu, l’échelle, « disposition relative »', async () => {
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
    await photographier(m, '07-plan-tables', { condition: ['[data-surface] [data-marque="echelle"]', '[data-plan]'] });
  });

  // Étape 5 : retirer un tour qui porte une réservation « tour désigné »
  // l'annonce avant d'écrire ; la réservation posée pour l'annonce part
  // ensuite par « Défaire ».
  test('07b retirer un tour : l’annonce nomme la réservation détruite, avant toute écriture', async () => {
    await ouvrirPlan();
    const selecteurTour = dans('[data-champ="tour"]');
    selecteurTour.value = '3';
    selecteurTour.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('le tour 3 montré', () => m.ui.etat().tour === 3);
    await images(2);
    await regimeSieges();
    const r = revision();
    const reservee = await choisir('[data-reserve]');
    const libre = chaiseVue((c) => c.occupant === null && c.reservation === null && c.titre === null);
    await cliquerPointeur(chaise(libre.table, libre.siege));
    await appuyer(actionPlace('reserver'), 'réserver au tour 3');
    await uneEntree(r, 'réserver au tour 3');
    const avantAnnonce = charge();
    expect(avantAnnonce.reservations).toContainEqual(expect.objectContaining({ participant: reservee, portee: 'tour', tour: 3 }));
    selecteurTour.value = '1';
    selecteurTour.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('le tour 1 montré', () => m.ui.etat().tour === 1);

    await ouvrirSection('tables');
    const avant = fichiers();
    await saisir(dans('[data-section="tables"] input[data-champ="tours"]'), '2');
    const fenetre = await attendre('l’annonce', () => dans('dialog[open]'));
    const numero = avantAnnonce.tables.find(({ id }) => id === libre.table).numero;
    const nom = nomAffiche(avantAnnonce.participants.find(({ id }) => id === reservee));
    expect(texteDe(fenetre.querySelector('h2'))).toBe(plat(t('tables.tours.confirmation', { avant: 3, apres: 2 })));
    expect([...fenetre.querySelectorAll('li')].map(texteDe)).toContain(
      plat(t('tables.tours.reservation', { nom, numero, tour: 3 })),
    );
    await rienEcrit(avant, 'l’annonce');
    memoire.annonce = { fenetre, avant };
    await photographier(m, '07b-nombre-de-tours', { condition: ['dialog[open] h2', 'dialog[open] [data-commande="renoncer"]'] });
  });

  test('07b « Annuler » : rien d’écrit ; « Défaire » retire la réservation posée pour l’annonce', async () => {
    const { fenetre, avant } = memoire.annonce;
    await appuyer(fenetre.querySelector('[data-commande="renoncer"]'), 'renoncer');
    await attendre('l’annonce fermée', () => dans('dialog[open]') === null);
    await rienEcrit(avant, 'renoncer');
    const r = revision();
    await cliquer('[data-historique] [data-commande="defaire"]');
    await uneEntree(r, 'défaire la réservation');
    expect(charge().reservations).toEqual([]);
    expect(charge().evenement.tours).toBe(3);
    await ouvrirPlan();
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
    await photographier(m, '08-animateurs-designes', {
      condition: [`[data-siege="${designee[0].dataset.siege}"]`, `[data-siege="${titree[0].dataset.siege}"]`],
    });
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
    await photographier(m, '09-refus-sur-place', { condition: [`[data-siege="${t1}:${reservee.siege}"]`] });
  });

  // La grande démonstration, chargée depuis le premier écran : l'échelle est
  // le propos (§ 19.3), et le diagnostic se lit avant toute génération.
  test('10 la grande démonstration, chargée depuis le premier écran : 99 retours imposés, plafond 24, plancher d’écart, égaux au moteur', async () => {
    // Le choix que 09 a laissé en attente s'oublie avant de quitter la soirée.
    await oublierChoix();
    memoire.base = base();
    await cliquer('[data-bandeau] [data-commande="liste"]');
    await attendre('le premier écran', () => dans('[data-ecran="accueil"] [data-demonstration="grande"]'));
    await cliquer('[data-demonstration="grande"]');
    await attendre('la grande démonstration ouverte', () => dans('[data-ecran="evenement"]') && etat().evenement !== null && etat().evenement.base !== memoire.base);
    await ouvrirSection('diagnostic');
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge()));
    expect(diagnostic.retoursImposes).toBe(99);
    expect(diagnostic.plafondAPriori.repartition[0]).toEqual({ valeur: 24, ancres: 4, mobiles: 0 });
    expect(diagnostic.ecartItineraire?.plancher).toBe(1);
    const phrases = tous('[data-section="diagnostic"] [data-phrase]').map(texteDe);
    for (const attendue of [
      t('diagnostic.plafond', diagnostic.plafondAPriori.repartition[0]),
      t('diagnostic.imposes', { retoursImposes: diagnostic.retoursImposes, ancragesImposantRetours: diagnostic.ancragesImposantRetours }),
      t('diagnostic.ecartItineraire', diagnostic.ecartItineraire),
    ]) {
      expect(phrases).toContain(plat(attendue));
    }
    await photographier(m, '10-diagnostic', { condition: ['[data-section="diagnostic"] [data-phrase]'] });
  });

  // Le seuil de CIBLE_MIN_PX (§ 7.3, § 19.10), au-dessus puis au-dessous,
  // sur la grande démonstration : au zoom ajusté de la soirée construite, ses
  // tables restent au régime des sièges jusqu'au zoom minimal, la moitié du
  // zoom ajusté. Le point du centre d'une chaise atteint la chaise au
  // régime des sièges, la table au régime de la table.
  test('07a les sièges cibles, sur la grande démonstration : zoomée jusqu’au régime des sièges, le centre d’une chaise atteint la chaise', async () => {
    await ouvrirPlan();
    await zoomerJusqua('sieges', 'zoomer');
    for (let cran = 0; cran < CRANS_AU_DESSUS; cran += 1) await cliquer('[data-commande="zoomer"]');
    await images(2);
    // Une chaise que l'image montre entière : la condition de la capture
    // juge la boîte, pas son seul centre.
    const vue = chaiseVue((c) => chaise(c.table, c.siege) !== null && entiereDansLaFenetre(chaise(c.table, c.siege)));
    const disque = chaise(vue.table, vue.siege).querySelector('circle');
    const point = await centre(disque);
    expect(atteintAuPoint(point)?.closest('[data-siege]'), 'l’élément au centre de la chaise').toBe(chaise(vue.table, vue.siege));
    memoire.centreChaise = { table: vue.table, x: Number(disque.getAttribute('cx')), y: Number(disque.getAttribute('cy')) };
    await photographier(m, '07a-cibles-sieges', { condition: [`[data-siege="${vue.table}:${vue.siege}"]`] });
  });

  test('07a la table cible, sur la grande démonstration : au zoom ajusté, régime de la table, le même point atteint la table, aucune chaise', async () => {
    await cliquer('[data-commande="ajuster"]');
    await images(2);
    expect(regimes().every((regime) => regime === 'table'), regimes().join(' ')).toBe(true);
    expect(tous('[data-plan] [data-siege]')).toHaveLength(0);
    const { table, x, y } = memoire.centreChaise;
    const point = new DOMPoint(x, y).matrixTransform(dans('[data-vue]').getScreenCTM());
    const atteint = atteintAuPoint(point);
    expect(atteint?.closest('[data-siege]') ?? null).toBeNull();
    expect(atteint?.closest('[data-table]')?.dataset.table, 'la table au point de sa chaise').toBe(String(table));
    await photographier(m, '07a-cibles-tables', { condition: [`[data-plan] [data-table="${table}"]`] });
  });

  // Étape 9 (§ 5.3, § 5.7, A11, A22) : la soirée rouverte, l'ordre des
  // priorités se règle à côté de la génération — les tours hors objectif
  // montés au palier de l'excédent de collisions, avec le poids 3 —, sous
  // le mode par défaut et la case des animateurs décochée. Les paliers
  // affichés sont ceux de la charge ; ceux que compile le moteur, ceux-là
  // privés des critères qui ne comptent pas, et 11 les nomme.
  test('10a la soirée rouverte, l’ordre réglé : excédent × 1 et tours hors objectif × 3 en un palier, animateurs décochés, mode par défaut', async () => {
    await cliquer('[data-bandeau] [data-commande="liste"]');
    await cliquer(`[data-evenement="${memoire.base}"] [data-commande="ouvrir"]`);
    await attendre('la soirée rouverte', () => dans('[data-ecran="evenement"]') && etat().evenement?.base === memoire.base);
    await cliquer('[data-place-fixe] [data-commande="modifier"]');
    await attendre('l’écriture', () => etat().mode === 'ecriture');
    await ouvrirSection('generation');
    const editeur = () => dans('[data-section="generation"] [data-priorites]');
    const paliersAffiches = () =>
      [...editeur().querySelectorAll(':scope > [data-palier]')].map((palier) =>
        [...palier.querySelectorAll('[data-priorite]')].map((critere) => critere.dataset.priorite),
      );
    const nomsDe = (liste) => liste.map((palier) => palier.map(({ critere }) => critere));
    expect(paliersAffiches()).toEqual(nomsDe(PRIORITES_PAR_DEFAUT));

    // Les deux cases et le mode, chacun par modifierReglage, une entrée par
    // geste, puis rendus à leur défaut, que la charge n'écrit pas : la case
    // des animateurs cochée puis décochée, celle des objectifs décochée puis
    // cochée, le mode « l'équité d'abord » puis « le plus de places
    // servies ». Le mode se choisit avant que les tours hors objectif
    // partagent un palier, que l'éditeur ne leur offre pas sous un mode qui
    // compare deux valeurs (D23).
    const caseDe = (cle) => dans(`[data-section="generation"] input[type="checkbox"][data-champ="${cle}"]`);
    const choixDuMode = (valeur) => dans(`[data-section="generation"] [data-mode-objectifs] input[value="${valeur}"]`);
    await sansFenetre('modifierReglage', async () => {
      for (const [cle, valeurs] of [
        ['rencontrerAnimateurs', [true, false]],
        ['respecterObjectifs', [false, true]],
      ]) {
        for (const valeur of valeurs) {
          const r = revision();
          await appuyer(caseDe(cle), `la case ${cle} à ${valeur}`);
          await uneEntree(r, `la case ${cle} à ${valeur}`);
          expect(caseDe(cle).checked, cle).toBe(valeur);
        }
      }
      for (const valeur of ['minimum', 'places']) {
        const r = revision();
        await appuyer(choixDuMode(valeur), `le mode ${valeur}`);
        await uneEntree(r, `le mode ${valeur}`);
        expect(choixDuMode(valeur).checked, valeur).toBe(true);
        expect(charge().reglages.modeObjectifs ?? 'places', valeur).toBe(valeur);
      }
    });
    for (const cle of ['rencontrerAnimateurs', 'respecterObjectifs', 'modeObjectifs']) expect(Object.hasOwn(charge().reglages, cle), cle).toBe(false);

    const critere = (nom) => editeur().querySelector(`[data-priorite="${nom}"]`);
    await sansFenetre('changerPriorites', async () => {
      let r = revision();
      await appuyer(critere('toursHorsObjectif').querySelector('[data-commande="monterCritere"]'), 'monter les tours hors objectif');
      await uneEntree(r, 'monter les tours hors objectif');
      r = revision();
      await appuyer(critere('toursHorsObjectif').querySelector('[data-commande="joindrePalier"]'), 'joindre au palier du dessus');
      await uneEntree(r, 'joindre au palier du dessus');
      r = revision();
      await saisir(critere('toursHorsObjectif').querySelector('input[data-champ="poids.toursHorsObjectif"]'), '3');
      await uneEntree(r, 'le poids 3');
    });
    const reglee = [
      [{ critere: 'ecartAuPlafondAPrioriMax', poids: 1 }],
      [{ critere: 'excedentCollisions', poids: 1 }, { critere: 'toursHorsObjectif', poids: 3 }],
      [{ critere: 'collisionsCumulees', poids: 1 }],
      [{ critere: 'rencontresRepetees', poids: 1 }],
      [{ critere: 'animateursNonRencontres', poids: 1 }],
      [{ critere: 'redondance', poids: 1 }],
    ];
    expect(charge().reglages.priorites).toEqual(reglee);
    expect(paliersAffiches()).toEqual(nomsDe(reglee));
    const numeros = [...editeur().querySelectorAll(':scope > [data-palier]')].map((palier) => texteDe(palier.querySelector('p')));
    expect(numeros).toEqual(reglee.map((_, rang) => plat(t('generation.priorites.palier', { palier: rang + 1, paliers: reglee.length }))));

    // Le mode par défaut, la case des objectifs cochée, celle des
    // animateurs décochée, et l'éditeur le dit en mots.
    const section = dans('[data-section="generation"]');
    expect(section.querySelector('[data-mode-objectifs] input[value="places"]').checked).toBe(true);
    expect(section.querySelector('input[data-champ="respecterObjectifs"]').checked).toBe(true);
    expect(section.querySelector('input[data-champ="rencontrerAnimateurs"]').checked).toBe(false);
    expect(texteDe(critere('animateursNonRencontres'))).toContain(t('generation.priorites.etat.decoche'));
    expect(texteDe(critere('toursHorsObjectif'))).not.toContain(t('generation.priorites.etat.sansObjet'));

    // Ce que compile le moteur : la liste de la charge, chaque critère qui ne
    // compte pas retiré.
    const instance = normaliser(configurationDe(charge()));
    const compte = new Set(instance.etatCriteres.filter(({ coche, sansObjet }) => coche && !sansObjet).map(({ nom }) => nom));
    expect(compte.has('animateursNonRencontres')).toBe(false);
    expect(compte.has('toursHorsObjectif')).toBe(true);
    const compilation = compilationDe(instance);
    const appliques = compilation.paliers.map((palier) => palier.criteres.map(({ nom, poids }) => ({ critere: nom, poids })));
    expect(appliques).toEqual(reglee.map((palier) => palier.filter(({ critere }) => compte.has(critere))).filter((palier) => palier.length > 0));
    memoire.paliersRegles = appliques;

    // L'image montre le numéro du palier partagé, ses deux critères et leurs
    // poids, et la ligne des animateurs qui dit « décoché » ; le choix du
    // mode, au-dessus, le premier palier et « Rétablir l'ordre par
    // défaut », au-dessous, n'entrent pas dans la même fenêtre qu'eux.
    document.activeElement?.blur();
    await cadrerDansLaSurface([critere('excedentCollisions'), critere('animateursNonRencontres')]);
    await photographier(m, '10a-ordre-priorites', {
      condition: [
        '[data-priorites] > [data-palier="1"] > p',
        '[data-priorites] [data-priorite="excedentCollisions"]',
        '[data-priorites] input[data-champ="poids.excedentCollisions"]',
        '[data-priorites] [data-priorite="toursHorsObjectif"]',
        '[data-priorites] input[data-champ="poids.toursHorsObjectif"]',
        '[data-priorites] [data-priorite="animateursNonRencontres"] .etat',
      ],
    });
  });

  // Sous l'ordre de 10a, les tours hors objectif partagent un palier : un
  // mode qui compare deux valeurs se refuse contre le choix du mode, nomme
  // ce palier, et le choix revient au mode de la charge (D23).
  test('10a « chacun au moins une fois » sur le palier partagé : refusé contre le choix du mode, rien d’écrit, le mode gardé', async () => {
    const groupe = () => dans('[data-section="generation"] [data-mode-objectifs]');
    const partage = charge().reglages.priorites.findIndex((palier) => palier.some(({ critere }) => critere === 'toursHorsObjectif'));
    expect(charge().reglages.priorites[partage].length).toBeGreaterThan(1);
    const avant = fichiers();
    await sansFenetre('modifierReglage', async () => {
      await appuyer(groupe().querySelector('input[value="chacun"]'), 'le mode « chacun au moins une fois »');
      const refus = await attendre('le refus du mode', () => groupe().querySelector('[data-refus="OBJECTIFS_PALIER_PARTAGE"]'));
      expect(texteDe(refus.querySelector(':scope > p'))).toBe(plat(t('OBJECTIFS_PALIER_PARTAGE', { mode: 'chacun', palier: partage })));
    });
    await rienEcrit(avant, 'le mode refusé');
    expect(groupe().querySelector('input:checked').value).toBe('places');
    expect(Object.hasOwn(charge().reglages, 'modeObjectifs')).toBe(false);
  });

  test('11 générer sous objectifs et ordre réglé, graine écrite, compte réduit : trois propositions du moteur, phrase par paliers ; retenir', async () => {
    await taper(dans('[data-section="generation"] input[data-champ="graine"]'), String(GRAINE));
    let r = revision();
    await sansFenetre('modifierReglage', async () => {
      await saisir(dans('[data-section="generation"] input[data-champ="generation.arret"]'), String(ARRET));
      await uneEntree(r, 'le compte réduit');
    });
    expect(charge().reglages.generation.arret).toBe(ARRET);
    const configuration = configurationDe(charge());
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
    const instance = normaliser(configurationDe(charge()));
    const aPriori = plafondsAPriori(instance);
    const { ordre, criteresAppliques, critereSaute } = classer(
      charge().propositions.map((p) => ({ id: p.id, mesures: mesurer(instance, indexerPlan(instance, planDepuisFichier(p))), plafondsAPriori: aPriori })),
      compilationDe(instance),
    );
    expect(ordre.length).toBeGreaterThanOrEqual(3);
    await attendre('le tableau classé', () => ids().length === ordre.length);
    expect(ids()).toEqual(ordre);
    // Le classement applique les paliers que 10a a réglés, et la phrase les
    // nomme dans cet ordre : chaque valeur appliquée, puis l'identifiant ;
    // le palier partagé, « ensemble », avec ses poids.
    expect(critereSaute).toBeNull();
    expect(criteresAppliques.map((palier) => palier.criteres.map(({ nom, poids }) => ({ critere: nom, poids })))).toEqual(memoire.paliersRegles);
    const phrase = section.querySelector('[data-ordre]');
    const nommes = [...phrase.querySelectorAll('[data-critere]')].map((nom) => nom.dataset.critere);
    const attendus = criteresAppliques.flatMap((palier) => palier.criteres.flatMap(({ nom, valeurs }) => valeurs.map(() => nom)));
    expect(nommes).toEqual([...attendus, 'identifiant']);
    expect(texteDe(phrase)).toContain(plat(t('propositions.ordre.ensemble')));
    for (const poids of [1, 3]) expect(texteDe(phrase)).toContain(plat(t('propositions.ordre.poids', { poids })));
    const colonnes = [...section.querySelectorAll('th[data-colonne]')].map((th) => th.dataset.colonne);
    for (const colonne of ['appartenancesVues', 'totalRedondance', 'diversite']) expect(colonnes, colonne).toContain(colonne);
    // Le sixième groupe : les tours hors objectif, que le mode par défaut
    // classe, et leur minimum ; rien des animateurs, décochés.
    for (const colonne of ['toursHorsObjectif', 'toursSelonObjectif']) expect(colonnes, colonne).toContain(colonne);
    for (const colonne of ['jamaisServies', 'horsObjectifMax', 'animateursRencontres', 'animateursNonRencontres']) {
      expect(colonnes, colonne).not.toContain(colonne);
    }
    // Le minimum des rencontres seul, jamais la moyenne ; r(p) par sa somme.
    expect(colonnes).not.toContain('redondance');
    for (const th of section.querySelectorAll('th')) expect(texteDe(th)).not.toMatch(/moyenne/i);

    // Le retenu se date à l'instant où il est retenu, après la génération :
    // le pied de l'aperçu (étape 12) distingue les deux horodatages.
    m.horloge.avancer(ECART_RETENUE_MS);
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
    // L'image montre la phrase de l'ordre au-dessus du tableau, défilé en
    // largeur des colonnes de la diversité (§ 19.3) jusqu'au sixième groupe,
    // celui des objectifs (D17) : le tableau déborde du cadre, et les
    // colonnes du rang, de la proposition et des rencontres sortent de
    // l'image.
    const enTete = (nom) => section.querySelector(`th[data-colonne="${nom}"]`);
    await cadrerEnLargeur([enTete('appartenancesVues'), enTete('toursSelonObjectif')]);
    await photographier(m, '11-propositions', {
      condition: [
        '[data-section="propositions"] [data-ordre]',
        ...['appartenancesVues', 'diversite', 'toursHorsObjectif', 'toursSelonObjectif'].map((nom) => `[data-section="propositions"] th[data-colonne="${nom}"]`),
      ],
      graine: GRAINE,
    });
  });

  test('19 un ajustement en cours : le glissement dit lequel des deux gestes, celui du placement retenu', async () => {
    await ouvrirPlan();
    memoire.avantAjustement = serialiserCharge(charge());
    const [t1, t2] = charge().tables.map(({ id }) => id);
    const depuis = chaiseOccupee(t1);
    // La chaise libre de t2 la plus à gauche : la plus proche de t1.
    const libres = chaisesMontrees().filter((c) => c.table === t2 && c.occupant === null && c.reservation === null && c.titre === null);
    expect(libres.length).toBeGreaterThan(0);
    const gauche = (c) => chaise(t2, c.siege).getBoundingClientRect().left;
    const vers = libres.reduce((a, b) => (gauche(b) < gauche(a) ? b : a));
    const glisser = async () => presserEtBouger(await centre(chaise(t1, depuis.siege)), await centre(chaise(t2, vers.siege)));
    const libelleEtat = () => dans('[data-fantome] [data-partie="etat"]');

    // Le libellé du fantôme se pose à droite du pointeur, et le panneau du
    // diagnostic borne le plan à droite. Un premier glissement, ramené à sa
    // chaise de départ, mesure ce que le libellé déborde du plan ; la vue
    // glisse ensuite par le sol, vers la gauche, d'autant et d'une marge,
    // pour que l'image le montre entier.
    const r = revision();
    await glisser();
    const deborde = (await attendre('le libellé mesuré', libelleEtat)).getBoundingClientRect().right - dans('[data-plan]').getBoundingClientRect().right;
    // Le libellé que le bord du plan coupe refuse la capture, avant toute
    // image : le parcours ne photographie pas un libellé illisible. Le
    // débordement mesuré est la condition de ce refus, et s'affirme : une
    // disposition où le libellé tient déjà dans le plan rend l'épreuve
    // rouge, au lieu d'en sauter le contrôle.
    expect(deborde, 'le libellé mesuré déborde du plan').toBeGreaterThan(0);
    await expect(photographier(m, '19-ajustement', { condition: '[data-fantome] [data-partie="etat"]', graine: GRAINE })).rejects.toThrow(
      'l’image la coupe',
    );
    const depart = await centre(chaise(t1, depuis.siege));
    await bouger(await centre(chaise(t2, vers.siege)), depart);
    await pointer('relacher', depart.x, depart.y);
    await images(3);
    await attendre('le glissement ramené', () => libelleEtat() === null);
    expect(revision()).toBe(r);
    expect(m.ui.etat().pose).toBeNull();
    await glisserLaVue(-(deborde + MARGE_FANTOME_PX));
    expect(dansLeCadre(chaise(t1, depuis.siege)), 'la chaise de départ, dans le cadre').toBe(true);

    memoire.ajustement = { depuis, vers, revision: revision() };
    await glisser();
    const etatDonnees = await attendre('le libellé de l’état des données', libelleEtat);
    expect(texteDe(etatDonnees)).toBe(t('plan.fantome.retenu'));
    await photographier(m, '19-ajustement', { condition: ['[data-fantome] [data-partie="nom"]', '[data-fantome] [data-partie="etat"]'], graine: GRAINE });
  });

  test('19 le dépôt : une entrée qui nomme la personne, le retenu changé', async () => {
    const [, t2] = charge().tables.map(({ id }) => id);
    const { depuis, vers, revision: r } = memoire.ajustement;
    const point = await centre(chaise(t2, vers.siege));
    await pointer('relacher', point.x, point.y);
    const libelle = await uneEntree(r, 'ajuster');
    expect(libelle).toContain(nomAffiche(charge().participants.find((p) => p.id === depuis.occupant)));
    expect(serialiserCharge(charge())).not.toBe(memoire.avantAjustement);
    expect(charge().retenu.proposition).toBe(memoire.retenue);
    // La vue revient à l'ajustement que les étapes suivantes attendent.
    await cliquer('[data-commande="ajuster"]');
  });

  // Glisser une personne, une table, tirer une poignée, poser une réservation.
  test('20 la lecture : quatre gestes du plan, empreinte inchangée ; la bande, le libellé de mode et le bandeau, sans cadre', async () => {
    await cliquer('[data-place-fixe] [data-commande="lecture"]');
    await attendre('la lecture', () => etat().mode === 'lecture');
    exigerModeSansCadre('lecture');
    expect(dans('[data-bandeau]').textContent).toContain(MARQUE_PROVENANCE);
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
    await photographier(m, '20-mode-lecture', { condition: ['[data-mode-libelle="barre"]', '[data-mode-libelle="bandeau"]'], graine: GRAINE });
  });

  test('20 « Défaire » en lecture : refusé avec « Modifier » ; en écriture, rend l’état d’avant 19', async () => {
    expect(etat().mode).toBe('lecture');
    const avant = fichiers();
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

  // Étape 12 (§ 11.7, § 19.3) : l'aperçu avant impression du plan, d'une
  // proposition que le retenu ne porte pas, puis du retenu. La paire montre
  // la règle du filigrane — présent, puis absent — sur la première page, au
  // même cadrage, de deux placements distincts ; le pied porte l'horodatage
  // de ce qui s'imprime et la marque de provenance à la place de la version.
  test('22 l’aperçu d’une proposition non retenue : le papier demandé une fois, BROUILLON sur chaque feuille, le pied de la proposition', async () => {
    expect(charge().evenement.etat).toBe('retenu');
    const proposition = charge().propositions.find(({ id }) => id !== charge().retenu.proposition).id;
    const avant = fichiers();
    const rang = m.trace.length;
    await ouvrirSection('propositions');
    await cliquer(`[data-proposition="${proposition}"] [data-commande="voir"]`);
    await attendre('la proposition montrée au plan', () => m.ui.etat().proposition === proposition && dans('[data-section="plan"]'));
    await cliquer('[data-ecran="evenement"] [data-commande="apercu"]');
    // Le premier aperçu de la machine pose la question du papier, avant tout
    // document (§ 8.5).
    await attendre('la question du papier', () => dans('[data-ecran="apercu"] [data-papier="question"]'));
    expect(dans('[data-impression]')).toBeNull();
    await cliquer('[data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]');
    await attendre('le document imprimé', () => dans('[data-impression] [data-feuille]') && dans('[data-papier="choisi"]'));
    expect(etat().papier).toBe('A4');
    expect(m.ui.etat().apercu).toMatchObject({ vue: 'plan', tour: 1 });

    const sortie = { source: 'proposition', proposition, tour: 1 };
    expect(estBrouillon(charge(), sortie)).toBe(true);
    memoire.horodatageProposition = charge().propositions.find(({ id }) => id === proposition).horodatage;
    const feuilles = await feuillesDuPlan(sortie);
    for (const feuille of feuilles) {
      const filigranes = feuille.querySelectorAll('[data-filigrane]');
      expect(filigranes, `feuille ${feuille.dataset.feuille}`).toHaveLength(1);
      expect(texteDe(filigranes[0])).toBe(t('impression.filigrane'));
    }
    // Seul le papier de la machine s'écrit ; rien de l'événement.
    expect(cheminsEcrits(rang)).toEqual(['reglages_locaux.json']);
    await rienEcrit(avant, 'l’aperçu d’une proposition');

    // Le cadrage : le filigrane et le pied de la première feuille, ensemble
    // dans la fenêtre.
    const filigrane = dans('[data-impression] [data-feuille] [data-filigrane] [data-marque="filigrane"]');
    await cadrerSur([filigrane, dans('[data-impression] [data-feuille] [data-pied]')]);
    memoire.cadrage = window.scrollY;
    barreHorsDeLImage();
    await photographier(m, '22-plan-brouillon', {
      condition: [
        '[data-impression] [data-feuille] [data-filigrane] [data-marque="filigrane"]',
        ...CONDITIONS_FEUILLE,
      ],
      graine: GRAINE,
    });
  });

  test('23 l’aperçu du retenu : le papier gardé, aucun filigrane, le pied du retenu ; rien d’écrit', async () => {
    await cliquer('[data-ecran="apercu"] [data-commande="fermerApercu"]');
    await attendre('le plan, de retour', () => dans('[data-ecran="evenement"] [data-section="plan"]'));
    await cliquer('[data-commande="quitterProposition"]');
    await attendre('le retenu montré', () => m.ui.etat().proposition === null);
    const avant = fichiers();
    const rang = m.trace.length;
    await cliquer('[data-ecran="evenement"] [data-commande="apercu"]');
    await attendre('le document imprimé', () => dans('[data-impression] [data-feuille]'));
    // Le papier choisi au premier aperçu n'est pas redemandé.
    expect(dans('[data-papier="question"]')).toBeNull();
    expect(dans('[data-papier="choisi"]')).not.toBeNull();

    const sortie = { source: 'retenu', proposition: null, tour: 1 };
    expect(estBrouillon(charge(), sortie)).toBe(false);
    const feuilles = await feuillesDuPlan(sortie);
    // Le pied date le retenu, pas la proposition de 22.
    expect(charge().retenu.horodatage).not.toBe(memoire.horodatageProposition);
    for (const feuille of feuilles) expect(texteDe(feuille.querySelector('[data-pied]'))).not.toContain(format.horodatage(memoire.horodatageProposition));
    expect(tous('[data-impression] [data-filigrane]')).toHaveLength(0);
    expect(cheminsEcrits(rang)).toEqual([]);
    await rienEcrit(avant, 'l’aperçu du retenu');

    // Le cadrage de 22 : la même position de défilement, le placement
    // retenu à la place de la proposition.
    window.scrollTo(0, memoire.cadrage);
    await images(2);
    expect(window.scrollY).toBe(memoire.cadrage);
    barreHorsDeLImage();
    await photographier(m, '23-plan-retenu', { condition: CONDITIONS_FEUILLE, graine: GRAINE });
  });

  // La planche du retenu, produite par la section Badges sur le papier que
  // 22 a choisi, puis tramée sous node (§ 19.6) : la feuille de contrôle,
  // puis la première planche. Produire n'écrit que le PDF ; deux
  // productions sous l'horloge pilotée donnent les mêmes octets, que
  // l'empreinte du manifeste suit.
  test('24 la planche du retenu par la section Badges : seul le PDF s’écrit, deux productions identiques ; la feuille de contrôle', async () => {
    // L'aperçu de 23 se ferme : le plan revient, en haut.
    await cliquer('[data-ecran="apercu"] [data-commande="fermerApercu"]');
    await attendre('le plan, de retour', () => dans('[data-ecran="evenement"] [data-section="plan"]'));
    window.scrollTo(0, 0);
    await images(2);
    expect(charge().evenement.etat).toBe('retenu');
    expect(etat().papier).toBe('A4');
    const avant = fichiers();
    let rang = m.trace.length;
    await ouvrirSection('badges');
    await cliquer('[data-section="badges"] [data-commande="produirePlanche"]');
    const affiche = await attendre('la planche produite', () => dans('[data-section="badges"] [data-chemin-planche]'), IMAGES_PLANCHE);
    const ecrits = cheminsEcrits(rang);
    expect(ecrits).toHaveLength(1);
    const [nom] = ecrits;
    expect(nom.startsWith(`${base()}.badges_A4_feuille_`), nom).toBe(true);
    expect(nom.endsWith('.pdf'), nom).toBe(true);
    const { separateur } = await m.fs.emplacements();
    expect(texteDe(affiche)).toBe(`${etat().racine.chemin}${separateur}${nom}`);
    const premiere = m.fs.octets('documents', nom);
    expect(new TextDecoder().decode(premiere.slice(0, 5))).toBe('%PDF-');

    // Une seconde production, l'horloge avancée : le même fichier, les
    // mêmes octets. L'avance échoit aussi l'écriture différée du cadrage
    // (reglages_locaux.json), que le plan a laissée en attente : elle passe
    // avant que la trace de la seconde production ne commence.
    m.horloge.avancer(ECART_PRODUCTIONS_MS);
    await images(4);
    rang = m.trace.length;
    await cliquer('[data-section="badges"] [data-commande="produirePlanche"]');
    await attendre(
      'la seconde planche',
      () => cheminsEcrits(rang).length > 0 && dans('[data-section="badges"] [data-chemin-planche]'),
      IMAGES_PLANCHE,
    );
    expect(cheminsEcrits(rang)).toEqual([nom]);
    const seconde = m.fs.octets('documents', nom);
    expect(await empreinte(seconde)).toBe(await empreinte(premiere));
    await rienEcrit(avant, 'la production de la planche');
    memoire.planche = seconde;

    // La feuille de contrôle : la règle de 100 mm, les comptes de la
    // soirée, la marque de provenance à la place de la version, aucun
    // BROUILLON sur le retenu.
    const participants = charge().participants.length;
    const exclus = charge().participants.filter(({ exclu }) => exclu).length;
    const produits = participants - exclus;
    const version = versionVisible('documentation', VERSION.affichee, libelle);
    await photographierPdf(seconde, PAGE_CONTROLE, (lue) => {
      const texte = texteDePage(lue);
      expect(axesDe(lue).longueurs).toContain(100);
      expect(texte).toContain(plat(libelle('planche.controle.comptes', { produits, participants, exclus })));
      expect(texte).toContain(plat(libelle('planche.controle.planches', { planches: Math.ceil(produits / 4) })));
      expect(texte).toContain(plat(libelle('planche.controle.version', { version })));
      expect(texte).not.toContain(VERSION.affichee);
      expect(texte).not.toContain(libelle('planche.brouillon'));
    });
  });

  test('25 la première planche : quatre A6, ses trois filets de coupe, les quatre premiers noms dans l’ordre alphabétique', async () => {
    expect(memoire.planche, 'la planche de 24').toBeInstanceOf(Uint8Array);
    const presents = charge().participants.filter(({ exclu }) => !exclu);
    expect(presents.length).toBeGreaterThanOrEqual(4);
    // L'ordre alphabétique de la planche : le nom, puis le prénom, leurs
    // clés normalisées comparées par points de code, puis l'identifiant.
    const cle = (texte) => cleNormalisee(texte ?? '');
    const premiers = [...presents]
      .sort((a, b) => parPointsDeCode(cle(a.nom), cle(b.nom)) || parPointsDeCode(cle(a.prenom), cle(b.prenom)) || a.id - b.id)
      .slice(0, 4)
      .map((personne) => nomAffiche(personne).normalize('NFC'));
    await photographierPdf(memoire.planche, PAGE_PLANCHE, (lue) => {
      // A4, planche pleine : la coupe verticale au milieu, les deux
      // horizontales sous chaque rangée de badges (§ 11.6).
      const { x, y } = axesDe(lue);
      expect(x).toEqual([105]);
      expect(y).toEqual([148, 296]);
      const texte = texteDePage(lue);
      for (const nomBadge of premiers) expect(texte, nomBadge).toContain(plat(nomBadge));
      expect(texte).not.toContain(libelle('planche.brouillon'));
    });
  });

  // Les sorties vivent en lecture et sur un plan bloqué, et n'écrivent que
  // la planche et le papier de la machine (§ 11.6, § 8.4, § 9) ; le plan
  // débloqué, le parcours reprend sur le retenu, en écriture.
  test('lecture, puis bloqué : aperçu, impression, papier et planche ; seuls le PDF et reglages_locaux.json s’écrivent', async () => {
    // Le parcours reprend sur le plan, comme 23 l'a laissé.
    await ouvrirSection('plan');
    expect(charge().evenement.etat).toBe('retenu');
    await cliquer('[data-place-fixe] [data-commande="lecture"]');
    await attendre('la lecture', () => etat().mode === 'lecture');
    await sortirSansEcrire(fichiers(), serialiserCharge(charge()), 'lecture, sortir');

    await cliquer('[data-place-fixe] [data-commande="modifier"]');
    await attendre('l’écriture', () => etat().mode === 'ecriture');
    let r = revision();
    await cliquer('[data-etat="bloque"] [data-commande="etat"]');
    await uneEntree(r, 'bloquer');
    expect(charge().evenement.etat).toBe('bloque');
    await sortirSansEcrire(fichiers(), serialiserCharge(charge()), 'bloqué, sortir');

    r = revision();
    // « Débloquer » se confirme sur place : armée au premier appui, la
    // commande exécute au second.
    await cliquer('[data-place-fixe] [data-commande="debloquer"]');
    await cliquer('[data-place-fixe] [data-commande="debloquer"]');
    await uneEntree(r, 'débloquer');
    expect(charge().evenement.etat).toBe('retenu');
    if (etat().mode !== 'ecriture') {
      await cliquer('[data-place-fixe] [data-commande="modifier"]');
      await attendre('l’écriture', () => etat().mode === 'ecriture');
    }
  });

  // Un échec de 22 aux sorties en lecture laisse l'aperçu ouvert, la
  // proposition montrée, la section Badges ouverte, la fenêtre défilée, le
  // plan bloqué ou en lecture : l'état est rendu ici, pour que les épreuves
  // suivantes jugent leurs propres gardes et non ce reste.
  afterAll(async () => {
    if (dans('[data-ecran="apercu"] [data-commande="fermerApercu"]') !== null) {
      await cliquer('[data-ecran="apercu"] [data-commande="fermerApercu"]');
      await attendre('le plan, de retour', () => dans('[data-ecran="evenement"]'));
    }
    if (etat().mode === 'lecture' && dans('[data-place-fixe] [data-commande="modifier"]') !== null) {
      await cliquer('[data-place-fixe] [data-commande="modifier"]');
      await attendre('l’écriture', () => etat().mode === 'ecriture');
    }
    if (charge().evenement.etat === 'bloque' && dans('[data-place-fixe] [data-commande="debloquer"]') !== null) {
      await cliquer('[data-place-fixe] [data-commande="debloquer"]');
      await cliquer('[data-place-fixe] [data-commande="debloquer"]');
      await attendre('le plan débloqué', () => charge().evenement.etat !== 'bloque');
    }
    if (etat().mode === 'lecture' && dans('[data-place-fixe] [data-commande="modifier"]') !== null) {
      await cliquer('[data-place-fixe] [data-commande="modifier"]');
      await attendre('l’écriture', () => etat().mode === 'ecriture');
    }
    if (m.ui.etat().proposition !== null && dans('[data-commande="quitterProposition"]') !== null) {
      await cliquer('[data-commande="quitterProposition"]');
      await attendre('le retenu montré', () => m.ui.etat().proposition === null);
    }
    if (dans('[data-section="plan"]') === null) await ouvrirSection('plan');
    window.scrollTo(0, 0);
  });
});

// --- L'ordre de lecture (§ 2.1) ---------------------------------------------------------

describe('l’ordre de lecture, pas une séquence imposée', { timeout: DUREE }, () => {
  // Ajouter une personne, créer une table, désigner une animatrice, changer
  // le nombre de tours.
  test('sur le retenu, en écriture : une personne, une table, une animatrice, les tours — une entrée chacun, sans « Suivant »', async () => {
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

  // Retirer un objectif et rétablir l'ordre par défaut détruisent chacun un
  // seul objet, nommé contre sa commande, qu'un retour à l'instant précédent
  // rend : aucune fenêtre (D19), et le retenu ne dérive pas (D13).
  test('sur le retenu : retirer l’objectif du tour 1 de t2, rétablir l’ordre par défaut — une entrée chacun, sans fenêtre, sans dérive', async () => {
    const [, t2] = charge().tables.map(({ id }) => id);
    // Les raisons de dérive du retenu et de chaque proposition, que
    // l'ajout d'une table et d'un tour ont posées : aucun des deux gestes
    // n'en change une.
    const raisons = () => [charge().retenu, ...charge().propositions].map((placement) => derive(placement, charge()));
    const avant = raisons();
    await ouvrirSection('tables');
    await cliquer(`[data-section="tables"] [data-table="${t2}"] [data-commande="basculerObjectifsTours"]`);
    const zone = await attendre('l’objectif du tour 1', () => dans(`[data-section="tables"] [data-objectif="${t2}-1"]`));
    await sansFenetre('retirerObjectif', async () => {
      const r = revision();
      await appuyer(zone.querySelector('[data-commande="retirerObjectif"]'), 'retirer l’objectif du tour 1');
      await uneEntree(r, 'retirer l’objectif');
    });
    expect(charge().tables.find(({ id }) => id === t2).objectifs.some(({ tour }) => tour === 1)).toBe(false);

    await ouvrirSection('generation');
    await sansFenetre('retablirPriorites', async () => {
      const r = revision();
      await cliquer('[data-section="generation"] [data-commande="retablirPriorites"]');
      await uneEntree(r, 'rétablir l’ordre par défaut');
    });
    expect(charge().reglages.priorites).toBeUndefined();
    expect(raisons()).toEqual(avant);
  });
});

// --- Les fenêtres (§ 2.1, § 5.9) --------------------------------------------------------

describe('les fenêtres : seul un geste qui détruit en ouvre une', { timeout: DUREE }, () => {
  test('aucune fenêtre pendant les gestes non destructeurs du parcours, chacun exécuté', () => {
    expect(GESTES_NON_DESTRUCTEURS.length).toBeGreaterThan(0);
    expect([...gestesSurveilles].sort()).toEqual([...GESTES_NON_DESTRUCTEURS].sort());
    expect(fenetresVues).toEqual([]);
  });

  // « Remplacer », « Appliquer et réaligner », retirer un tour réservé qui
  // porte un objectif de tour, supprimer une personne réservée ou une table
  // réservée qui porte des objectifs, « Retenir » sur un retenu ajusté.
  test('cinq gestes destructeurs : une fenêtre qui nomme ce qui part, objectifs compris ; Annuler n’écrit rien', async () => {
    expect(etat().mode).toBe('ecriture');
    const [t1] = charge().tables.map(({ id }) => id);

    // Préparation : un objectif au tour 4 de t1, une réservation au tour 4,
    // un ajustement du retenu.
    await ouvrirSection('tables');
    await cliquer(`[data-section="tables"] [data-table="${t1}"] [data-commande="basculerObjectifsTours"]`);
    const champTour4 = await attendre('l’objectif du tour 4', () => dans(`[data-section="tables"] input[data-champ="objectif-${t1}-4"]`));
    let r = revision();
    await saisir(champTour4, memoire.etiquette);
    await uneEntree(r, 'l’objectif du tour 4');
    const objectif4 = charge().tables.find(({ id }) => id === t1).objectifs.find(({ tour }) => tour === 4);
    expect(objectif4).toMatchObject({ portee: 'tour', etiquettes: [memoire.etiquette] });
    await ouvrirPlan();
    const selecteurTour = dans('[data-champ="tour"]');
    selecteurTour.value = '4';
    selecteurTour.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre('le tour 4 montré', () => m.ui.etat().tour === 4);
    await images(2);
    await regimeSieges();
    r = revision();
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

    // Retirer le tour 4 : la réservation qui y tient, sa personne, sa table ;
    // l'objectif du tour 4 de t1, sa table et ses étiquettes.
    const reservation4 = charge().reservations.find(({ participant, tour }) => participant === auTour4 && tour === 4);
    await fenetreAnnulee('retirer un tour réservé', () => saisir(dans('[data-section="tables"] input[data-champ="tours"]'), '3'), {
      titre: t('tables.tours.confirmation', { avant: 4, apres: 3 }),
      parmi: [
        t('tables.tours.reservation', { nom: nomDe(auTour4), numero: numeroDe(reservation4.table), tour: 4 }),
        t('tables.tours.objectif', { numero: numeroDe(t1), tour: 4, etiquettes: objectif4.etiquettes }),
      ],
    });
    expect(dans('[data-section="tables"] input[data-champ="tours"]').value).toBe('4');

    // Supprimer t1 : son numéro, chaque réservation qu'elle tient avec le nom
    // de sa personne, chaque titre posé à ses sièges, chacun de ses
    // objectifs, de la soirée et des tours.
    const objectifsT1 = charge().tables.find(({ id }) => id === t1).objectifs;
    expect(objectifsT1.length).toBeGreaterThan(1);
    const deT1 = [
      ...charge()
        .reservations.filter(({ table }) => table === t1)
        .map(({ participant, portee, tour, siege }) => t('tables.suppression.reservation', { nom: nomDe(participant), portee, tour, siege })),
      ...charge()
        .titres.filter(({ table }) => table === t1)
        .map(({ siege, libelle }) => t('tables.suppression.titre', { siege, libelle })),
      ...objectifsT1.map(({ tour, etiquettes }) => t('tables.suppression.objectif', { tour, etiquettes })),
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

describe('lecture et bloqué : tout geste modifiant refusé, rien d’écrit', { timeout: DUREE }, () => {
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
    // Une étiquette saisie dans la fiche, envoyée par Entrée : refusée contre
    // le champ, la saisie gardée ; la fiche fermée ensuite.
    await famille('changer les étiquettes', async () => {
      const personne = charge().participants.find((p) => !p.exclu);
      await cliquer(`[data-section="participants"] [data-participant="${personne.id}"] [data-commande="fiche"]`);
      const fiche = await attendre('la fiche', () => dans(`[data-fiche="${personne.id}"]`));
      const champ = fiche.querySelector('input[data-champ="etiquettes"]');
      await saisir(champ, 'bénévole');
      await refusPres(() => fiche.querySelector('form'), code, remede, 'changer les étiquettes');
      expect(champ.value).toBe('bénévole');
      await cliquer('[data-fiche] [data-commande="fermerFiche"]');
      await attendre('la fiche fermée', () => dans('[data-fiche]') === null);
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
    // Le CSV des objectifs, sous sa nature : l'aperçu s'ouvre, « Importer »
    // est refusé à côté de lui ; la nature revient aux participants.
    await famille('importer des objectifs', async () => {
      await appuyer(dans('[data-nature-import] input[value="objectifs"]'), 'la nature « Objectifs de table »');
      const octets = new Uint8Array(await (await fetch(urlObjectifs)).arrayBuffer());
      m.fs.choisirFichierAImporter = async () => ({ nom: NOM_OBJECTIFS, octets });
      await cliquer('[data-section="import"] [data-commande="choisirFichier"]');
      await attendre('l’aperçu des objectifs', () => dans('[data-apercu] [data-commande="importer"]'));
      await cliquer('[data-apercu] [data-commande="importer"]');
      await refusPres(() => dans('[data-apercu] [data-commande="importer"]').parentElement, code, remede, 'importer des objectifs');
      await cliquer('[data-apercu] [data-commande="fermerApercu"]');
      await appuyer(dans('[data-nature-import] input[value="participants"]'), 'la nature « Participants »');
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
    // Une frappe dans l'objectif de la soirée de t2, puis « Retirer
    // l'objectif » : chacun refusé à côté de lui.
    await famille('poser ou retirer un objectif', async () => {
      const zone = () => dans(`[data-section="tables"] [data-objectif="${t2}"]`);
      await frapper(zone().querySelector(`input[data-champ="objectif-${t2}"]`));
      await refusPres(zone, code, remede, 'poser un objectif');
      const retirer = zone().querySelector('[data-commande="retirerObjectif"]');
      expect(retirer, 'la commande qui retire l’objectif de t2').not.toBeNull();
      await appuyer(retirer, 'retirer un objectif');
      await refusPres(() => retirer.parentElement, code, remede, 'retirer un objectif');
    });
    // Un cran de flèche sur la règle par défaut : refusé à côté d'elle, le
    // choix rendu à la règle de la charge.
    await famille('changer la règle par défaut', async () => {
      const choix = dans('[data-regle-objectifs] select[data-champ="regleObjectifs"]');
      const avant = choix.value;
      choix.scrollIntoView({ block: 'center' });
      choix.focus();
      await touche(choix.selectedIndex === 0 ? 'ArrowDown' : 'ArrowUp');
      flushSync();
      await refusPres(() => dans('[data-regle-objectifs]'), code, remede, 'changer la règle par défaut');
      expect(choix.value).toBe(avant);
    });
    await famille('changer l’état', async () => {
      await cliquer('[data-etat="brouillon"] [data-commande="etat"]');
      await refusPres(() => dans('[data-etat="brouillon"]'), code, remede, 'changer l’état');
    });

    // Monter un critère, puis rétablir l'ordre par défaut : chacun refusé
    // contre la liste des priorités, le second par un refus neuf.
    await ouvrirSection('generation');
    await famille('changer l’ordre des priorités', async () => {
      const groupe = () => dans('[data-section="generation"] [data-priorites]').closest('fieldset');
      const monter = dans('[data-priorites] [data-priorite="collisionsCumulees"] [data-commande="monterCritere"]');
      expect(monter, 'monter les collisions cumulées').not.toBeNull();
      await appuyer(monter, 'monter un critère');
      const premier = await refusPres(groupe, code, remede, 'monter un critère');
      await appuyer(dans('[data-section="generation"] [data-commande="retablirPriorites"]'), 'rétablir l’ordre par défaut');
      await refusPres(groupe, code, remede, 'rétablir l’ordre par défaut', premier);
    });
    // Un clic sur la case des objectifs, puis sur un mode : chacun refusé à
    // côté de lui, la case et le choix rendus à la valeur de la charge.
    await famille('changer un réglage de génération', async () => {
      const caseObjectifs = dans('[data-section="generation"] input[type="checkbox"][data-champ="respecterObjectifs"]');
      const cochee = caseObjectifs.checked;
      await appuyer(caseObjectifs, 'la case des objectifs');
      await refusPres(() => caseObjectifs.parentElement, code, remede, 'la case des objectifs');
      expect(caseObjectifs.checked).toBe(cochee);
      const groupe = () => dans('[data-section="generation"] [data-mode-objectifs]');
      const mode = groupe().querySelector('input:checked').value;
      const autre = [...groupe().querySelectorAll('input[type="radio"]')].find((choix) => choix.value !== mode);
      await appuyer(autre, 'un autre mode des objectifs');
      await refusPres(groupe, code, remede, 'un autre mode des objectifs');
      expect(groupe().querySelector('input:checked').value).toBe(mode);
    });
    expect(familles).toEqual(FAMILLES_MODIFIANTES.map(({ nom }) => nom));
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

  // Les écritures relevées depuis le rang donné, hors des deux que
  // regarder admet (ecritureAdmise).
  const ecrituresDepuis = (rang) => m.trace.slice(rang).filter(([, , chemin]) => chemin !== '' && !ecritureAdmise(chemin));

  test('les familles : des noms uniques, des gestes surveillés, chaque geste des étiquettes, des objectifs et des priorités tenté', () => {
    const tentes = FAMILLES_MODIFIANTES.flatMap(({ gestes }) => gestes);
    expect(tentes.filter((geste) => !GESTES_NON_DESTRUCTEURS.includes(geste))).toEqual([]);
    expect(GESTES_DES_OBJECTIFS.filter((geste) => !tentes.includes(geste))).toEqual([]);
    expect(new Set(FAMILLES_MODIFIANTES.map(({ nom }) => nom)).size).toBe(FAMILLES_MODIFIANTES.length);
  });

  test('en lecture : chaque famille modifiante refusée avec « Modifier », rien d’écrit ; tri, filtre, listes de travail vivants', async () => {
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
    expect(ecrituresDepuis(rang)).toEqual([]);
  });

  test('plan bloqué : chaque famille modifiante refusée avec « Débloquer », rien d’écrit ; tri, filtre, listes de travail vivants', async () => {
    await cliquer('[data-place-fixe] [data-commande="modifier"]');
    await attendre('l’écriture', () => etat().mode === 'ecriture');
    const r = revision();
    await cliquer('[data-etat="bloque"] [data-commande="etat"]');
    await uneEntree(r, 'bloquer');
    expect(charge().evenement.etat).toBe('bloque');
    exigerModeSansCadre('bloque');
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
    expect(ecrituresDepuis(rang)).toEqual([]);
  });
});

// --- Les captures d'écran du parcours (§ 19.5, § 19.7) ----------------------------------------

// La dernière épreuve du fichier. Une épreuve du fichier en échec, même
// après sa photographie ou sans capture, la fait échouer en la nommant, et
// rien n'est publié (§ 19.1). En écriture, elle publie d'un bloc : la
// publication refuse quand une étape déclarée n'a rien déposé, et jette le
// dépôt dans tous les cas. En vérification, chaque étape déclarée a été
// comparée à son entrée du manifeste, qui n'en porte aucune autre. Zéro
// capture n'est jamais un succès (§ 19.7).
describe('les captures d’écran du parcours (§ 19.5, § 19.7)', () => {
  test('chaque capture déclarée photographiée : publiées d’un bloc en écriture, conformes au manifeste en vérification', async () => {
    const { declarees } = await cloreCaptures({ echecs: epreuvesEnEchec, racineNeutre: m?.seance.etat().racine?.chemin ?? null });
    expect([...capturesPrises(), ...capturesPdf].sort()).toEqual([...declarees].sort());
  });
});
