// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les régions engendrées de la documentation (§ 19.8) et le contrôle de
// version des captures (§ 19.7). Un document porteur délimite chaque région
// par deux marqueurs nommés, seuls à se lire comme tels :
//
//   <!-- engendre:debut <nom> -->
//   <!-- engendre:fin <nom> -->
//
// Le nom, en minuscules, chiffres et traits d'union, désigne un producteur
// de PRODUCTEURS, qui rend le texte de la région depuis sa source unique : la
// définition des réglages, la table des colonnes du CSV, le registre des
// commandes et leurs libellés figés, la table des raccourcis, les
// démonstrations livrées passées au diagnostic, les styles relevés au
// manifeste des captures, le registre des constantes, avec le relevé du
// banc quand il existe (scripts/banc/releve.json). Aucune valeur de ces
// tableaux ne s'écrit ici : elle se lit, ou se compose par la traduction.
// Seul s'écrit ici ce qui appartient au document : les en-têtes de colonnes,
// le nom d'un contexte, d'une touche, d'un statut ou de l'état d'une
// bascule.
//
// engendrer remplace le contenu de chaque région — ce qui sépare la fin du
// marqueur de début du début du marqueur de fin — par deux sauts de ligne,
// le texte du producteur, deux sauts de ligne ; aucun octet hors de ces
// bornes ne change. verifier compare chaque région à ce qu'engendrer y
// écrirait et nomme celle qui diffère : une correction faite à la main dans
// une région fait échouer la vérification au lieu de se perdre au passage
// suivant (§ 14.3). Un marqueur illisible, sans fin, sans début ou qui
// ferme une autre région, une région ouverte dans une autre, un nom en
// double ou inconnu sont des fautes ; un porteur sans région aussi, et une
// liste de porteurs vide : un balayage vide ne passe pas (§ 14.2). Seuls les
// fichiers de PORTEURS se lisent, avec le manifeste et les captures qu'ils
// citent.
//
// verifier mesure aussi l'écart entre la version réelle inscrite au
// manifeste des captures et celle de la construction (ecartDeVersion,
// documentation/manifeste.js) : affiché et non bloquant au cycle court,
// bloquant sous --livraison (§ 19.7). Un manifeste absent ne prouve aucune
// version, et compte pour un écart.
//
// verifier contrôle enfin les images que les porteurs affichent (§ 19.1,
// § 19.7). Toute image citée — image Markdown, en ligne ou par référence,
// balise <img>, lien vers un fichier image — a la forme
// doc/captures/<nom>.png ; toute autre cible est une faute qui la nomme.
// Chaque capture citée a son entrée au manifeste, son fichier sur le disque,
// et ce fichier a l'empreinte et les dimensions que l'entrée inscrit
// (fautesDImage) : un PNG remplacé par une version antérieure, le manifeste
// inchangé, fait échouer la vérification, donc la construction de livraison.
// Réciproquement, chaque capture inscrite au manifeste est citée par un
// porteur : un document privé de ses images ne passe pas sur un balayage
// vide.
//
// Ligne de commande, depuis la racine du projet ou d'ailleurs, par un
// chemin qui traverse ou non un lien symbolique :
//   node scripts/documentation.js engendrer | verifier [--livraison]
//        [--racine <dossier>] [--porteur <chemin>]…
// --racine remplace la racine du projet ; chaque --porteur, relatif à la
// racine, remplace la liste PORTEURS. Code de sortie : 0 sans faute, 1 sur
// une faute ou, sous --livraison, un écart de version, 2 sur des arguments
// illisibles.
import { readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COMMANDES } from '../src/application/commandes.js';
import { configurationDe } from '../src/application/configuration.js';
import { creerFormat } from '../src/application/format.js';
import { TABLES_APPLICATION } from '../src/application/libelles.js';
import { creerTraduction } from '../src/application/traduction.js';
import { ENTETES_DES_CHAMPS } from '../src/csv/colonnes.js';
import { ENTETES_DES_OBJECTIFS } from '../src/csv/objectifs.js';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { LIVREES } from '../src/demo/livrees.js';
import { CONSTANTES } from '../src/geometrie/constantes.js';
import { REGLAGES_GENERATION } from '../src/interface/generation/reglages.js';
import { TABLES_INTERFACE } from '../src/interface/libelles.js';
import { RACCOURCIS } from '../src/interface/raccourcis.js';
import { diagnostiquer } from '../src/moteur/diagnostic.js';
import { analyser } from '../src/stockage/document.js';
import { VERSION } from '../src/version.genere.js';
import { CHEMIN_MANIFESTE, cheminImage, ecartDeVersion, fautesDImage } from './documentation/manifeste.js';
import { tableauConstantes } from './banc/releve.js';

/** @typedef {{nom: string, debut: number, fin: number, contenu: string}} Region
 *  debut et fin bornent le contenu dans le texte : texte.slice(debut, fin). */
/** @typedef {{region: string|null, faute: string}} FauteRegion */
/** @typedef {{chemin: string, faute: string}} Faute   chemin relatif à la racine */

/** La racine du projet. */
export const RACINE = fileURLToPath(new URL('..', import.meta.url));

/**
 * Les fichiers porteurs de régions, relatifs à la racine : la liste fermée
 * des documents que verifier et engendrer lisent. Chacun porte au moins une
 * région : README.md les tableaux de mesure (contrastes, constantes), le
 * guide d'usage ses annexes. GUIDE-WINDOWS.md n'y figure pas : il décrit des
 * écrans qu'aucun scénario ne produit, et ne porte aucune région (§ 16.1).
 * @type {ReadonlyArray<string>}
 */
export const PORTEURS = Object.freeze(['README.md', 'GUIDE-USAGE.md']);

/** Une faute de structure des régions : la liste de ses fautes, par région. */
export class ErreurRegions extends Error {
  /** @param {FauteRegion[]} fautes */
  constructor(fautes) {
    super(fautes.map(({ region, faute }) => (region === null ? faute : `région « ${region} » : ${faute}`)).join(' ; '));
    this.name = 'ErreurRegions';
    this.fautes = fautes;
  }
}

// --- Les marqueurs ---------------------------------------------------------------

// Un commentaire HTML, fermé ou courant jusqu'à la fin du texte.
const COMMENTAIRE = /<!--([\s\S]*?)(-->|$)/g;
// Le corps d'un commentaire qui se veut un marqueur.
const SE_VEUT_MARQUEUR = /^\s*engendre\b/;
// Le corps d'un marqueur lisible : sa sorte et son nom.
const MARQUEUR = /^\s*engendre:(debut|fin)\s+([a-z0-9]+(?:-[a-z0-9]+)*)\s*$/;

// Un extrait d'un marqueur pour un message, sur une ligne.
const extrait = (texte) => JSON.stringify(texte.length > 60 ? `${texte.slice(0, 60)}…` : texte);

/**
 * Les régions d'un texte, dans leur ordre. Un commentaire dont le corps
 * s'ouvre sur « engendre » est un marqueur : lisible, ou une faute ; tout
 * autre commentaire est du texte.
 *
 * @param {string} texte
 * @returns {Region[]}
 * @throws {ErreurRegions} chaque faute de structure : marqueur illisible,
 *   début dans une région ouverte, fin sans début, fin qui ferme une autre
 *   région, région en double, marqueur sans fin
 */
export function lireRegions(texte) {
  if (typeof texte !== 'string') throw new TypeError('les régions se lisent dans une chaîne');
  const regions = [];
  const fautes = [];
  const vues = new Set();
  let ouverte = null;
  for (const trouve of texte.matchAll(COMMENTAIRE)) {
    const [entier, corps, fermeture] = trouve;
    if (!SE_VEUT_MARQUEUR.test(corps)) continue;
    const lu = fermeture === '-->' ? MARQUEUR.exec(corps) : null;
    if (lu === null) {
      fautes.push({ region: null, faute: `marqueur illisible : ${extrait(entier)}` });
      continue;
    }
    const [, sorte, nom] = lu;
    if (sorte === 'debut') {
      if (ouverte !== null) fautes.push({ region: nom, faute: `ouverte dans la région « ${ouverte.nom} »` });
      else ouverte = { nom, debut: trouve.index + entier.length };
    } else if (ouverte === null) {
      fautes.push({ region: nom, faute: 'fin sans début' });
    } else if (ouverte.nom !== nom) {
      fautes.push({ region: nom, faute: `sa fin ferme la région « ${ouverte.nom} »` });
    } else {
      if (vues.has(nom)) fautes.push({ region: nom, faute: 'région en double' });
      vues.add(nom);
      regions.push({ nom, debut: ouverte.debut, fin: trouve.index, contenu: texte.slice(ouverte.debut, trouve.index) });
      ouverte = null;
    }
  }
  if (ouverte !== null) fautes.push({ region: ouverte.nom, faute: 'marqueur sans fin' });
  if (fautes.length > 0) throw new ErreurRegions(fautes);
  return regions;
}

/**
 * Le contenu d'une région, tel qu'engendrer l'écrit : deux sauts de ligne,
 * le texte produit sans ses sauts de ligne finaux, deux sauts de ligne.
 *
 * @param {string} produit
 * @returns {string}
 */
export function contenuDeRegion(produit) {
  if (typeof produit !== 'string') throw new TypeError('un producteur rend une chaîne');
  return `\n\n${produit.replace(/\n+$/, '')}\n\n`;
}

// Les noms des régions qu'aucun producteur ne porte, en fautes.
function nomsInconnus(regions, producteurs) {
  return regions
    .filter(({ nom }) => !producteurs.has(nom))
    .map(({ nom }) => ({ region: nom, faute: 'nom inconnu : aucun producteur ne le porte' }));
}

/**
 * Le texte dont chaque région porte ce que son producteur rend ; le reste,
 * marqueurs compris, inchangé à l'unité près. Un texte sans région se rend
 * tel quel.
 *
 * @param {string} texte
 * @param {Map<string, () => string>} producteurs   par nom de région
 * @returns {string}
 * @throws {ErreurRegions} une faute de structure, ou un nom inconnu, avant
 *   tout appel d'un producteur
 */
export function remplacerRegions(texte, producteurs) {
  const regions = lireRegions(texte);
  const inconnus = nomsInconnus(regions, producteurs);
  if (inconnus.length > 0) throw new ErreurRegions(inconnus);
  let rendu = '';
  let curseur = 0;
  for (const { nom, debut, fin } of regions) {
    rendu += texte.slice(curseur, debut) + contenuDeRegion(producteurs.get(nom)());
    curseur = fin;
  }
  return rendu + texte.slice(curseur);
}

// La première ligne où deux contenus diffèrent : son rang dans le contenu,
// et la ligne de chacun, null au-delà de sa fin.
function premiereDifference(lu, attendu) {
  const a = lu.split('\n');
  const b = attendu.split('\n');
  let rang = 0;
  while (rang < a.length && rang < b.length && a[rang] === b[rang]) rang += 1;
  return { rang, lue: a[rang] ?? null, attendue: b[rang] ?? null };
}

// Le numéro, à partir de 1, de la ligne du texte où tombe l'indice.
const ligneDe = (texte, indice) => texte.slice(0, indice).split('\n').length;

/**
 * Les fautes des régions d'un texte : de structure, de nom, de producteur,
 * ou de contenu — une région qui diffère de ce qu'engendrer y écrirait,
 * nommée avec la première ligne qui s'écarte. Un texte sans région est une
 * faute.
 *
 * @param {string} texte
 * @param {Map<string, () => string>} producteurs
 * @returns {FauteRegion[]}   vide quand toutes les régions sont conformes
 */
export function verifierRegions(texte, producteurs) {
  let regions;
  try {
    regions = lireRegions(texte);
  } catch (erreur) {
    if (erreur instanceof ErreurRegions) return erreur.fautes;
    throw erreur;
  }
  if (regions.length === 0) return [{ region: null, faute: 'aucune région engendrée : un porteur en a au moins une' }];
  const fautes = nomsInconnus(regions, producteurs);
  for (const { nom, debut, contenu } of regions) {
    if (!producteurs.has(nom)) continue;
    let attendu;
    try {
      attendu = contenuDeRegion(producteurs.get(nom)());
    } catch (erreur) {
      fautes.push({ region: nom, faute: `le producteur échoue : ${erreur.message}` });
      continue;
    }
    if (contenu === attendu) continue;
    const { rang, lue, attendue } = premiereDifference(contenu, attendu);
    const ligne = ligneDe(texte, debut) + rang;
    const cite = (texteLigne) => (texteLigne === null ? 'rien' : `« ${texteLigne} »`);
    fautes.push({
      region: nom,
      faute:
        `diffère de ce que le producteur engendre, ligne ${ligne} : ${cite(lue)} au lieu de ${cite(attendue)} ; ` +
        'une correction à la main se perd au prochain engendrer',
    });
  }
  return fautes;
}

// --- Les tableaux ---------------------------------------------------------------

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const { nombre } = creerFormat(t);
const VIDE = t('format.vide');
// Les clés de l'application : un libellé d'historique y vit.
const CLES_APPLICATION = new Set(creerTraduction(TABLES_APPLICATION).cles());

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Un identifiant, en code.
const code = (texte) => `\`${texte}\``;

// Le nombre de décimales qu'un nombre porte dans son écriture la plus
// courte, celle de String : 0,3 en porte une, 200 000 aucune.
function decimalesDe(valeur) {
  const ecrit = String(valeur);
  if (/e/i.test(ecrit)) throw new RangeError(`documentation : ${ecrit} ne s'écrit pas en chiffres`);
  return (ecrit.split('.')[1] ?? '').length;
}

// Une cellule : un saut de ligne, et les blancs qui l'entourent, deviennent
// une espace ; une barre s'échappe, qui fermerait la cellule.
const cellule = (texte) => String(texte).replace(/\s*(?:\r\n|\r|\n)\s*/g, ' ').replace(/\|/g, '\\|');

/**
 * Un tableau Markdown : la ligne d'en-tête, le séparateur, une ligne par
 * entrée, sans saut de ligne final.
 *
 * @param {string[]} entetes
 * @param {Array<Array<string>>} lignes
 * @returns {string}
 */
export function tableau(entetes, lignes) {
  const ligne = (cellules) => `| ${cellules.map(cellule).join(' | ')} |`;
  return [ligne(entetes), `|${entetes.map(() => '---').join('|')}|`, ...lignes.map(ligne)].join('\n');
}

/**
 * Le tableau des réglages (§ 19.8) : chaque entrée de la définition, dans
 * son ordre — son libellé, qui porte l'unité d'un champ, l'écran qui la
 * montre, sa valeur par défaut. Celle d'un choix est le libellé de sa valeur,
 * <etiquette>.<valeur> ; celle de l'ordre des priorités, ses paliers dans
 * l'ordre, séparés par « puis », chaque critère sous son nom complet
 * (mobilier.critere.<nom>), ceux d'un palier partagé joints par « avec ».
 *
 * @param {ReadonlyArray<import('../src/interface/generation/reglages.js').EntreeReglage>} [definition]
 * @returns {string}
 */
export function tableauReglages(definition = REGLAGES_GENERATION) {
  const defaut = ({ genre, defaut: valeur, cle, etiquette }) => {
    if (genre === 'champ') return nombre(valeur);
    if (genre === 'bascule') return valeur ? 'cochée' : 'décochée';
    if (genre === 'choix') return t(`${etiquette}.${valeur}`);
    if (genre === 'ordre') {
      return valeur.map((palier) => palier.map(({ critere }) => t(`mobilier.critere.${critere}`)).join(' avec ')).join(', puis ');
    }
    throw new RangeError(`reglages : genre inconnu ${JSON.stringify(genre)} pour ${cle}`);
  };
  return tableau(
    ['Réglage', 'Écran', 'Valeur par défaut'],
    definition.map((entree) => [t(entree.etiquette), t(`coquille.section.${entree.section}`), defaut(entree)]),
  );
}

/**
 * Le tableau des colonnes du CSV (§ 10.1, § 10.4, § 19.8) : chaque champ,
 * dans l'ordre de l'export — son en-tête, puis ses synonymes. La table des
 * participants par défaut ; celle des objectifs de table
 * (ENTETES_DES_OBJECTIFS) pour la région colonnes-objectifs.
 *
 * @param {ReadonlyArray<readonly [string, ReadonlyArray<string>]>} [entetes]
 * @returns {string}
 */
export function tableauColonnesCsv(entetes = ENTETES_DES_CHAMPS) {
  return tableau(
    ['Colonne', 'Synonymes reconnus'],
    entetes.map(([, [entete, ...synonymes]]) => [code(entete), synonymes.length === 0 ? VIDE : synonymes.map(code).join(', ')]),
  );
}

/**
 * Les détails d'exemple du libellé d'historique de chaque commande du
 * registre : les noms sont inventés. Le libellé lui-même se compose par la
 * traduction, de la clé ENTREE_<NOM> de la commande.
 */
export const EXEMPLES_COMMANDES = Object.freeze({
  ajouterParticipant: { personne: 'Iris Ombrelle' },
  modifierParticipant: { personne: 'Ondine Lacasse', champs: ['courriel'], devenu: null },
  exclureParticipant: { personne: 'Théo Pervenche' },
  reintegrerParticipant: { personne: 'Théo Pervenche' },
  supprimerParticipant: { personne: 'Ondine Lacasse' },
  importerParticipants: { mode: 'ajouter', ajoutes: 12, misAJour: 0, retires: 0 },
  importerObjectifs: { mode: 'mettreAJour', ajoutes: 3, remplaces: 1, retires: 0 },
  changerEtat: { etat: 'bloque' },
  debloquer: { etat: 'retenu' },
  enregistrerGeneration: { n: 5, premier: 3, dernier: 7 },
  retenirProposition: { id: 3 },
  effacerPropositions: { n: 4, gardee: 2 },
  garderMeilleures: { n: 10, effacees: 37, gardee: 42 },
  creerTable: { numero: 3 },
  supprimerTable: { numero: 2, reservations: 2, titres: 1 },
  deplacerTable: { numero: 3 },
  changerLibelleTable: { numero: 3, libelle: 'Coin des invités' },
  changerPlacesTable: { numero: 5, sieges: 10 },
  realignerTable: { numero: 5, sieges: 8 },
  changerDefaut: { sieges: 10, realignees: 4 },
  changerTours: { tours: 3, retirees: 2 },
  modifierReglage: { cle: 'separerOrganisations', valeur: false },
  changerEtiquettes: { personne: 'Iris Ombrelle', ajoutees: ['finance'], retirees: [] },
  ajouterConflit: { personne: 'Iris Ombrelle', organisation: 'Atelier Ressac' },
  retirerConflit: { personne: 'Iris Ombrelle', organisation: 'Atelier Ressac' },
  poserObjectif: { numero: 3, tour: null, regle: null, etiquettes: ['finance'] },
  retirerObjectif: { numero: 3, tour: 2 },
  changerRegleObjectifs: { regle: 'et' },
  changerPriorites: { criteres: ['collisionsCumulees'], palier: 1, paliers: 6, avec: ['excedentCollisions'], poids: null },
  retablirPriorites: {},
  reserver: { personne: 'Théo Pervenche', numero: 4, siege: 2, portee: 'tour', tour: 2 },
  retirerReservation: { personne: 'Théo Pervenche', numero: 4, portee: 'tous', tour: null },
  deplacerReservation: { personne: 'Théo Pervenche', de: 4, vers: 7, siege: null, portee: 'tour', tour: 2 },
  poserTitre: { libelle: 'accueil', numero: 3, siege: 1 },
  retirerTitre: { libelle: 'accueil', numero: 3, siege: 1 },
  designer: { personne: 'Iris Ombrelle', numero: 3, siege: 1, libelle: 'accueil' },
  convertirEnTous: { personne: 'Iris Ombrelle', numero: 3 },
  deplacerDansRetenu: { personne: 'Iris Ombrelle', de: 4, vers: 7, siege: null, tour: 2 },
  echangerDansRetenu: { a: 'Iris Ombrelle', deA: 4, b: 'Théo Pervenche', deB: null, tour: 2 },
  retirerDuTour: { personne: 'Iris Ombrelle', numero: 4, tour: 2 },
  changerPresence: { personne: 'Iris Ombrelle', tours: [1, 2], avant: null, retiree: [3, 4], enReserve: [] },
});

// La clé du libellé d'historique d'une commande : ENTREE_ puis son nom, un
// souligné devant chaque capitale, en capitales.
const cleDHistorique = (nom) => `ENTREE_${nom.replace(/[A-Z]/g, (lettre) => `_${lettre}`).toUpperCase()}`;

/**
 * Le tableau des commandes (§ 8.2, § 19.8) : chaque commande du registre,
 * dans son ordre, et un exemple de son libellé d'historique.
 *
 * @param {Map<string, Function>} [commandes]
 * @param {Record<string, Object>} [exemples]
 * @returns {string}
 * @throws {RangeError} une commande sans exemple ou sans libellé
 *   d'historique, un exemple sans commande, chacun nommé
 */
export function tableauCommandes(commandes = COMMANDES, exemples = EXEMPLES_COMMANDES) {
  const noms = [...commandes.keys()];
  const sansCommande = Object.keys(exemples).filter((nom) => !commandes.has(nom)).sort(comparerTextes);
  if (sansCommande.length > 0) throw new RangeError(`commandes : exemple sans commande au registre : ${sansCommande.join(', ')}`);
  return tableau(
    ['Commande', "Libellé d'historique (exemple)"],
    noms.map((nom) => {
      if (!Object.hasOwn(exemples, nom)) throw new RangeError(`commandes : « ${nom} » n'a pas d'exemple (EXEMPLES_COMMANDES)`);
      const cle = cleDHistorique(nom);
      if (!CLES_APPLICATION.has(cle)) throw new RangeError(`commandes : « ${nom} » n'a pas de libellé d'historique ${cle}`);
      return [code(nom), t(cle, exemples[nom])];
    }),
  );
}

// Le nom de chaque contexte de la table des raccourcis, tel que le
// tableau le montre.
const NOMS_CONTEXTES = new Map([
  ['plan', 'Plan'],
  ['grille', 'Grille des participants'],
  ['cases', 'Cases de présence, grille ou fiche'],
  ['champ', 'Champ de saisie'],
  ['commande', 'Bouton de commande'],
  ['boutonMenu', 'Bouton de menu'],
  ['menu', 'Menu ouvert'],
  ['geste', 'Geste en cours'],
  ['evenement', 'Écran de l\u{2019}événement, hors saisie'],
  ['fenetre', 'Panneau ou infobulle'],
]);

// Le nom de chaque touche, par sa valeur de KeyboardEvent.key.
const NOMS_TOUCHES = new Map([
  ['ArrowRight', '\u{2192}'],
  ['ArrowDown', '\u{2193}'],
  ['ArrowLeft', '\u{2190}'],
  ['ArrowUp', '\u{2191}'],
  ['Enter', 'Entrée'],
  [' ', 'Espace'],
  ['Escape', 'Échap'],
  ['Tab', 'Tab'],
  ['Home', 'Début'],
  ['End', 'Fin'],
  ['F2', 'F2'],
]);

// Les modificateurs d'une touche de la table, dans l'ordre où toucheDe les
// écrit (« Ctrl+ » puis « Maj+ »), et la touche qu'ils précèdent.
const MODIFICATEURS = /^((?:Ctrl\+)?(?:Maj\+)?)(.*)$/su;
// Une lettre seule, que toucheDe écrit en majuscule : elle se nomme elle-même.
const LETTRE_MAJUSCULE = /^\p{Lu}$/u;

// Le nom d'une touche : ses modificateurs gardés devant le nom de sa
// touche. Une touche sans nom — absente de NOMS_TOUCHES, une lettre en
// minuscule, des modificateurs dans un autre ordre — lève en nommant la
// touche entière.
function nomDeTouche(touche) {
  const [, modificateurs, base] = MODIFICATEURS.exec(touche);
  const nom = LETTRE_MAJUSCULE.test(base) ? base : NOMS_TOUCHES.get(base);
  if (nom === undefined) throw new RangeError(`raccourcis : touche sans nom ${JSON.stringify(touche)}`);
  return `${modificateurs}${nom}`;
}

/**
 * Le tableau des raccourcis (§ 7.3, § 19.8) : une ligne par contexte et par
 * effet, dans l'ordre de la table — le contexte, ses touches, le libellé de
 * l'effet.
 *
 * @param {ReadonlyArray<{touche: string, contexte: string, effet: string, cle: string}>} [raccourcis]
 * @returns {string}
 * @throws {RangeError} une touche ou un contexte sans nom
 */
export function tableauRaccourcis(raccourcis = RACCOURCIS) {
  const effets = new Map();
  for (const { touche, contexte, effet, cle } of raccourcis) {
    const groupe = `${contexte}.${effet}`;
    if (!effets.has(groupe)) effets.set(groupe, { contexte, cle, touches: [] });
    effets.get(groupe).touches.push(touche);
  }
  return tableau(
    ['Où', 'Touches', 'Effet'],
    [...effets.values()].map(({ contexte, cle, touches }) => {
      const nom = NOMS_CONTEXTES.get(contexte);
      if (nom === undefined) throw new RangeError(`raccourcis : contexte sans nom ${JSON.stringify(contexte)}`);
      return [nom, touches.map(nomDeTouche).join(' ou '), t(cle)];
    }),
  );
}

/**
 * Le tableau des démonstrations (§ 15, § 19.8) : chaque fichier livré, dans
 * l'ordre de LIVREES, lu puis passé au diagnostic — son nom au catalogue,
 * son effectif, ses tables, ses tours, l'étendue de son plafond a priori.
 *
 * @param {ReadonlyArray<{cle: string, texte: string}>} [livrees]
 * @returns {string}
 */
export function tableauDemonstrations(livrees = LIVREES) {
  return tableau(
    ['Démonstration', 'Effectif', 'Tables', 'Tours', 'Plafond a priori, minimum', 'Plafond a priori, maximum'],
    livrees.map(({ cle, texte }) => {
      const entree = CATALOGUE.find((candidate) => candidate.cle === cle);
      if (entree === undefined) throw new RangeError(`demonstrations : « ${cle} » n'est pas au catalogue`);
      const configuration = configurationDe(analyser(texte).charge);
      const { plafondAPriori } = diagnostiquer(configuration);
      return [
        entree.nom,
        nombre(configuration.participants.length),
        nombre(configuration.tables.length),
        nombre(configuration.tours),
        nombre(plafondAPriori.min),
        nombre(plafondAPriori.max),
      ];
    }),
  );
}

const THEMES = Object.freeze(['clair', 'sombre']);

// Vrai pour un style relevé lisible : jeton et rôle nommés, ratio et seuil
// finis.
const styleLisible = (style) =>
  style !== null &&
  typeof style === 'object' &&
  typeof style.jeton === 'string' &&
  style.jeton !== '' &&
  typeof style.role === 'string' &&
  style.role !== '' &&
  Number.isFinite(style.ratio) &&
  Number.isFinite(style.seuil);

/**
 * Le tableau des ratios de contraste (§ 14.5, § 19.8), engendré des styles
 * relevés au pilotage : une ligne par jeton et par rôle, rangée par jeton
 * puis par rôle, unité UTF-16 par unité ; pour chaque thème, le plus petit
 * ratio relevé et la première capture, dans l'ordre du manifeste, où il
 * l'est — rien quand le thème ne relève pas ce jeton dans ce rôle.
 *
 * Un style relevé est { jeton, role, ratio, seuil, … } sous
 * captures[].styles.clair et .sombre ; ses autres champs ne se lisent pas.
 *
 * @param {object|null} manifeste
 * @returns {string}
 * @throws {Error} un manifeste absent, un style illisible, deux seuils pour
 *   un même jeton dans un même rôle, aucun style relevé
 */
export function tableauContrastes(manifeste) {
  if (manifeste === null || typeof manifeste !== 'object' || !Array.isArray(manifeste.captures)) {
    throw new Error(`contrastes : manifeste absent ou sans liste de captures (${CHEMIN_MANIFESTE})`);
  }
  const groupes = new Map();
  for (const capture of manifeste.captures) {
    for (const theme of THEMES) {
      const styles = capture?.styles?.[theme];
      if (!Array.isArray(styles)) throw new Error(`contrastes : ${capture?.fichier} : styles.${theme} n'est pas une liste`);
      for (const style of styles) {
        if (!styleLisible(style)) {
          throw new Error(`contrastes : ${capture.fichier}, thème ${theme} : un style sans jeton, rôle, ratio ou seuil`);
        }
        const { jeton, role, ratio, seuil } = style;
        const cle = JSON.stringify([jeton, role]);
        if (!groupes.has(cle)) groupes.set(cle, { jeton, role, seuil, clair: null, sombre: null });
        const groupe = groupes.get(cle);
        if (groupe.seuil !== seuil) {
          throw new Error(`contrastes : « ${jeton} », rôle ${role} : deux seuils, ${groupe.seuil} et ${seuil} (${capture.fichier})`);
        }
        if (groupe[theme] === null || ratio < groupe[theme].ratio) groupe[theme] = { ratio, capture: capture.fichier };
      }
    }
  }
  if (groupes.size === 0) throw new Error('contrastes : aucun style relevé dans le manifeste');
  const ranges = [...groupes.values()].sort((a, b) => comparerTextes(a.jeton, b.jeton) || comparerTextes(a.role, b.role));
  const releve = (mesure) => (mesure === null ? [VIDE, VIDE] : [nombre(mesure.ratio, { decimales: 2 }), mesure.capture]);
  return tableau(
    ['Jeton', 'Rôle', 'Seuil', 'Thème clair', 'Capture', 'Thème sombre', 'Capture'],
    ranges.map(({ jeton, role, seuil, clair, sombre }) => [
      code(jeton),
      role,
      nombre(seuil, { decimales: decimalesDe(seuil) }),
      ...releve(clair),
      ...releve(sombre),
    ]),
  );
}

const STATUTS = new Map([
  ['mesuree', 'mesurée'],
  ['defautDeTravail', 'défaut de travail'],
]);

/**
 * Le tableau du registre des constantes (§ 14.1, § 19.8), lu seul : chaque
 * constante, dans l'ordre du registre — son nom, sa valeur, son unité, son
 * propriétaire, son statut en toutes lettres, son protocole. Une valeur
 * relevée à l'exécution (null) s'écrit vide.
 *
 * @param {ReadonlyArray<import('../src/geometrie/constantes.js').Constante>} [constantes]
 * @returns {string}
 * @throws {RangeError} un statut inconnu
 */
export function tableauRegistre(constantes = CONSTANTES) {
  return tableau(
    ['Constante', 'Valeur', 'Unité', 'Propriétaire', 'Statut', 'Protocole'],
    constantes.map(({ nom, valeur, unite, proprietaire, statut, protocole }) => {
      const enLettres = STATUTS.get(statut);
      if (enLettres === undefined) throw new RangeError(`constantes : statut inconnu ${JSON.stringify(statut)} pour ${nom}`);
      const ecrite = valeur === null ? VIDE : nombre(valeur, { decimales: decimalesDe(valeur) });
      return [code(nom), ecrite, unite, proprietaire, enLettres, protocole];
    }),
  );
}

// --- Les producteurs --------------------------------------------------------------

/** Le relevé du banc de mesure, relatif à la racine (§ 19.10). */
export const CHEMIN_RELEVE = 'scripts/banc/releve.json';

/**
 * @typedef {{manifeste: () => object|null, releve: () => object|null}} Contexte
 *   manifeste : le manifeste des captures lu, null quand il manque ;
 *   releve : le relevé du banc lu, null quand il manque
 */

const producteur = (nom, produire) => Object.freeze({ nom, produire });

/**
 * Les producteurs, par nom de région, dans l'ordre du § 19.8 : chacun
 * (contexte) → le texte de sa région.
 * @type {ReadonlyArray<Readonly<{nom: string, produire: (contexte: Contexte) => string}>>}
 */
export const PRODUCTEURS = Object.freeze([
  producteur('reglages', () => tableauReglages()),
  producteur('colonnes-csv', () => tableauColonnesCsv()),
  producteur('colonnes-objectifs', () => tableauColonnesCsv(ENTETES_DES_OBJECTIFS)),
  producteur('commandes', () => tableauCommandes()),
  producteur('raccourcis', () => tableauRaccourcis()),
  producteur('demonstrations', () => tableauDemonstrations()),
  producteur('contrastes', (contexte) => tableauContrastes(contexte.manifeste())),
  producteur('constantes', (contexte) => {
    const releve = contexte.releve();
    return releve === null ? tableauRegistre() : tableauConstantes(CONSTANTES, releve);
  }),
]);

/**
 * Les producteurs liés à un contexte, par nom, dans l'ordre de PRODUCTEURS :
 * chacun produit une fois, puis rend le même texte.
 *
 * @param {Contexte} contexte
 * @returns {Map<string, () => string>}
 */
export function producteursDe(contexte) {
  return new Map(
    PRODUCTEURS.map(({ nom, produire }) => {
      let texte = null;
      return [nom, () => (texte ??= produire(contexte))];
    }),
  );
}

// --- Les images que les porteurs affichent (§ 19.1, § 19.7) -----------------------

// La seule forme d'une image affichée : une capture du parcours, en PNG.
const FORME_CAPTURE = /^doc\/captures\/[A-Za-z0-9._-]+\.png$/;
// L'extension d'un fichier image : un lien vers un tel fichier montre une
// image au lecteur, comme une image en ligne.
const EXTENSION_IMAGE = /\.(?:png|jpe?g|gif|svg|webp|avif|bmp|ico|tiff?)$/i;

// La cible d'une image ou d'un lien Markdown : entre chevrons, ou sans blanc
// avec au plus un niveau de parenthèses ; puis un titre facultatif.
const CIBLE = String.raw`\s*(<[^>\n]*>|[^\s()<>]*(?:\([^\s()]*\)[^\s()<>]*)*)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\s*\)`;
// Un caractère du texte entre crochets : un caractère échappé, crochet
// compris, ou tout autre qu'un crochet ; un saut de ligne seul, que ne suit
// pas une ligne vide, car une ligne vide ferme le paragraphe et ni image ni
// lien ne la franchit. Les quatre formes s'excluent : aucun retour en
// arrière ne se multiplie.
const CARACTERE = String.raw`(?:\\[^\n]|\\(?=\n)|[^\[\]\\\n]|\n(?![ \t\r]*\n))`;
// Le texte entre crochets, avec au plus un niveau de crochets imbriqués :
// une image dans un lien, [![…](…)](…), garde ses deux cibles, et le texte
// d'une image, ![Écran [ancien]](…), peut en porter.
const CROCHETS = String.raw`\[((?:${CARACTERE}|\[${CARACTERE}*\])*)\]`;
// Une étiquette de référence : sans crochet non échappé (CommonMark).
const ETIQUETTE = String.raw`\[(${CARACTERE}*)\]`;
const IMAGE_EN_LIGNE = new RegExp(String.raw`!${CROCHETS}\(${CIBLE}`, 'g');
const LIEN_EN_LIGNE = new RegExp(String.raw`(?<!!)${CROCHETS}\(${CIBLE}`, 'g');
// Une définition de référence, en tête de ligne : [étiquette]: cible.
const DEFINITION = /^ {0,3}\[([^\]\n]+)\]:[ \t]*(<[^>\n]*>|\S+)/gm;
// Une image par référence : ![texte][étiquette], ![texte][] ou ![texte],
// pourvu que ce dernier ne s'ouvre pas sur une cible en ligne.
const IMAGE_PAR_REFERENCE = new RegExp(String.raw`!${CROCHETS}(?:${ETIQUETTE}|(?![(\[]))`, 'g');
// Une balise HTML d'image, ou une source d'une balise <picture>.
const BALISE_IMAGE = /<(img|source)\b[^>]*>/gi;
const ATTRIBUT_SRC = /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/i;
const ATTRIBUT_SRCSET = /\bsrcset\s*=/i;

// Une étiquette de référence comparable : sans casse, blancs réduits.
const etiquette = (texte) => texte.trim().replace(/\s+/g, ' ').toLowerCase();
// Une cible sans ses chevrons.
const sansChevrons = (cible) => (cible.startsWith('<') && cible.endsWith('>') ? cible.slice(1, -1) : cible);

/**
 * Les images qu'un document Markdown affiche, dans l'ordre du texte : les
 * images en ligne et par référence, les balises <img> et <source>, les
 * liens dont la cible a une extension d'image. Chaque citation est
 * { cible, sorte, indice } : cible est le chemin cité, null pour une balise
 * sans src lisible ou qui porte un srcset ; sorte est 'image', 'reference',
 * 'lien', 'balise' ou 'srcset' ; indice est la position dans le texte. Un
 * texte de code n'est pas mis à part : un exemple d'image se cite aussi.
 *
 * @param {string} texte
 * @returns {Array<{cible: string|null, sorte: string, indice: number}>}
 */
export function imagesCitees(texte) {
  if (typeof texte !== 'string') throw new TypeError('les images se relèvent dans une chaîne');
  const citees = [];
  for (const trouve of texte.matchAll(IMAGE_EN_LIGNE)) citees.push({ cible: sansChevrons(trouve[2]), sorte: 'image', indice: trouve.index });
  for (const trouve of texte.matchAll(LIEN_EN_LIGNE)) {
    const cible = sansChevrons(trouve[2]);
    if (EXTENSION_IMAGE.test(cible.replace(/[?#].*$/, ''))) citees.push({ cible, sorte: 'lien', indice: trouve.index });
  }
  const definitions = new Map();
  for (const trouve of texte.matchAll(DEFINITION)) {
    const cle = etiquette(trouve[1]);
    if (!definitions.has(cle)) definitions.set(cle, { cible: sansChevrons(trouve[2]), indice: trouve.index, utilisee: false });
  }
  for (const trouve of texte.matchAll(IMAGE_PAR_REFERENCE)) {
    const definition = definitions.get(etiquette(trouve[2] || trouve[1]));
    if (definition === undefined) continue;
    definition.utilisee = true;
    citees.push({ cible: definition.cible, sorte: 'reference', indice: trouve.index });
  }
  // Une définition vers un fichier image sert un lien par référence, ou
  // une image : elle est citée une fois, à sa place, si aucune image ne l'a
  // déjà prise.
  for (const { cible, indice, utilisee } of definitions.values()) {
    if (!utilisee && EXTENSION_IMAGE.test(cible.replace(/[?#].*$/, ''))) citees.push({ cible, sorte: 'lien', indice });
  }
  for (const trouve of texte.matchAll(BALISE_IMAGE)) {
    const balise = trouve[0];
    if (ATTRIBUT_SRCSET.test(balise)) citees.push({ cible: null, sorte: 'srcset', indice: trouve.index });
    const src = ATTRIBUT_SRC.exec(balise);
    if (src !== null) citees.push({ cible: src[1] ?? src[2] ?? src[3], sorte: 'balise', indice: trouve.index });
    else if (trouve[1].toLowerCase() === 'img') citees.push({ cible: null, sorte: 'balise', indice: trouve.index });
  }
  return citees.sort((a, b) => a.indice - b.indice);
}

/** Vrai pour une cible citée qu'un document a le droit d'afficher. */
export const estCapture = (cible) => typeof cible === 'string' && FORME_CAPTURE.test(cible);

/**
 * Les fautes des images d'un document : chaque citation dont la cible n'a
 * pas la forme doc/captures/<nom>.png, nommée avec sa ligne ; une balise
 * sans src lisible ; un srcset, dont les cibles échappent au contrôle.
 *
 * @param {string} chemin   le document, relatif à la racine
 * @param {string} texte
 * @returns {Faute[]}
 */
export function fautesImagesCitees(chemin, texte) {
  const fautes = [];
  for (const { cible, sorte, indice } of imagesCitees(texte)) {
    const ligne = `ligne ${ligneDe(texte, indice)} : `;
    if (sorte === 'srcset') fautes.push({ chemin, faute: `${ligne}image en srcset : seules les captures doc/captures/<nom>.png s’affichent` });
    else if (cible === null) fautes.push({ chemin, faute: `${ligne}balise <img> sans src lisible` });
    else if (!estCapture(cible)) fautes.push({ chemin, faute: `${ligne}image hors de doc/captures : « ${cible} »` });
  }
  return fautes;
}

// Les fautes des captures que les porteurs citent, contre le manifeste et le
// disque : chaque image une fois, dans l'ordre de sa première citation.
// Une image absente du manifeste ne se lit pas ; une image présente se lit
// et passe fautesDImage. Quand tous les porteurs de PORTEURS sont lus
// (complet), suivent, dans l'ordre du manifeste, ses captures que nul
// porteur ne cite : une capture inscrite et jamais montrée n'est pas
// examinée, et zéro capture examinée n'est pas zéro capture périmée (§ 19.7).
// Une vérification restreinte par --porteur ne juge pas les citations des
// porteurs qu'elle ne lit pas.
function fautesDesCaptures(citees, manifeste, lireOctets, complet) {
  const entrees = new Map();
  for (const entree of Array.isArray(manifeste?.captures) ? manifeste.captures : []) {
    const chemin = cheminImage(entree?.fichier);
    if (!entrees.has(chemin)) entrees.set(chemin, entree);
  }
  const fautes = [];
  for (const [image, porteur] of citees) {
    const entree = entrees.get(image);
    if (entree === undefined) {
      fautes.push({ chemin: image, faute: `citée par ${porteur}, absente du manifeste` });
      continue;
    }
    let octets;
    try {
      octets = lireOctets(image);
    } catch (erreur) {
      if (!estAbsent(erreur)) throw erreur;
      fautes.push({ chemin: image, faute: `citée par ${porteur}, absente du disque` });
      continue;
    }
    fautes.push(...fautesDImage(entree, octets));
  }
  for (const image of complet ? entrees.keys() : []) {
    if (!citees.has(image)) fautes.push({ chemin: image, faute: 'inscrite au manifeste, citée par aucun porteur' });
  }
  return fautes;
}

// --- L'arbre ---------------------------------------------------------------------

// Vrai pour l'erreur d'un fichier absent.
const estAbsent = (erreur) => erreur?.code === 'ENOENT';

// Le lecteur par défaut d'une racine : le texte UTF-8 d'un chemin relatif.
const lecteurDe = (racine) => (chemin) => readFileSync(join(racine, chemin), 'utf8');
// Le lecteur d'octets par défaut d'une racine : le contenu d'un chemin
// relatif, en Uint8Array.
const lecteurOctetsDe = (racine) => (chemin) => readFileSync(join(racine, chemin));

// Le lecteur d'un fichier JSON de l'arbre, lu au premier besoin, une fois :
// l'objet lu, ou null quand le fichier manque. Un texte qui n'est pas du
// JSON lève en nommant le chemin.
function lecteurJson(lire, chemin) {
  let lu;
  return () => {
    if (lu !== undefined) return lu;
    let texte;
    try {
      texte = lire(chemin);
    } catch (erreur) {
      if (!estAbsent(erreur)) throw erreur;
      lu = null;
      return lu;
    }
    try {
      lu = JSON.parse(texte);
    } catch {
      throw new Error(`${chemin} : JSON illisible`);
    }
    return lu;
  };
}

// Le contexte d'un arbre : le manifeste des captures et le relevé du banc.
function contexteDe(lire) {
  return { manifeste: lecteurJson(lire, CHEMIN_MANIFESTE), releve: lecteurJson(lire, CHEMIN_RELEVE) };
}

// Une faute de région, au chemin de son porteur.
const auChemin = (chemin) => ({ region, faute }) => ({
  chemin,
  faute: region === null ? faute : `région « ${region} » : ${faute}`,
});

// La faute d'une liste de porteurs vide.
const SANS_PORTEUR = Object.freeze({ chemin: '.', faute: 'aucun fichier porteur : un balayage vide ne passe pas' });

// Le texte d'un porteur, ou la faute qui dit qu'il manque.
function lirePorteur(lire, chemin) {
  try {
    return { texte: lire(chemin), faute: null };
  } catch (erreur) {
    if (!estAbsent(erreur)) throw erreur;
    return { texte: null, faute: { chemin, faute: 'porteur absent' } };
  }
}

/**
 * La vérification d'un arbre : les régions et les images citées de chaque
 * porteur, l'écart de version du manifeste, puis chaque capture citée contre
 * son entrée du manifeste et son fichier, et, quand PORTEURS est lu en
 * entier, chaque entrée du manifeste contre les citations. Se lisent : les porteurs et le
 * manifeste par lire, les seules captures citées par lireOctets.
 *
 * @param {{racine?: string, porteurs?: ReadonlyArray<string>, livraison?: boolean,
 *          version?: string, lire?: (chemin: string) => string,
 *          lireOctets?: (chemin: string) => Uint8Array}} options
 * @returns {{fautes: Faute[], ecart: null|{manifeste: string|null, construction: string},
 *            regions: number, images: number, code: 0|1}}
 *   images : le nombre de captures citées, chacune comptée une fois ; code 1
 *   sur une faute, ou sur un écart sous livraison
 */
export function verifierArbre({
  racine = RACINE,
  porteurs = PORTEURS,
  livraison = false,
  version = VERSION.affichee,
  lire = lecteurDe(racine),
  lireOctets = lecteurOctetsDe(racine),
} = {}) {
  const contexte = contexteDe(lire);
  const producteurs = producteursDe(contexte);
  const fautes = porteurs.length === 0 ? [SANS_PORTEUR] : [];
  let regions = 0;
  // Chaque capture citée, au premier porteur qui la cite.
  const citees = new Map();
  for (const chemin of porteurs) {
    const { texte, faute } = lirePorteur(lire, chemin);
    if (faute !== null) {
      fautes.push(faute);
      continue;
    }
    fautes.push(...verifierRegions(texte, producteurs).map(auChemin(chemin)));
    try {
      regions += lireRegions(texte).length;
    } catch (erreur) {
      if (!(erreur instanceof ErreurRegions)) throw erreur;
    }
    fautes.push(...fautesImagesCitees(chemin, texte));
    for (const { cible } of imagesCitees(texte)) if (estCapture(cible) && !citees.has(cible)) citees.set(cible, chemin);
  }
  let ecart = null;
  try {
    const manifeste = contexte.manifeste();
    ecart = manifeste === null ? { manifeste: null, construction: version } : ecartDeVersion(manifeste, version);
    fautes.push(...fautesDesCaptures(citees, manifeste, lireOctets, PORTEURS.every((porteur) => porteurs.includes(porteur))));
  } catch (erreur) {
    fautes.push({ chemin: CHEMIN_MANIFESTE, faute: erreur.message });
  }
  const code = fautes.length > 0 || (livraison && ecart !== null) ? 1 : 0;
  return { fautes, ecart, regions, images: citees.size, code };
}

/**
 * L'engendrement d'un arbre : chaque porteur reçoit ses régions produites ;
 * seuls ceux qui changent s'écrivent, et rien ne s'écrit quand un porteur
 * est en faute.
 *
 * @param {{racine?: string, porteurs?: ReadonlyArray<string>, lire?: (chemin: string) => string,
 *          ecrire?: (chemin: string, texte: string) => void}} options
 * @returns {{fautes: Faute[], ecrits: string[], code: 0|1}}
 */
export function engendrerArbre({
  racine = RACINE,
  porteurs = PORTEURS,
  lire = lecteurDe(racine),
  ecrire = (chemin, texte) => writeFileSync(join(racine, chemin), texte),
} = {}) {
  const producteurs = producteursDe(contexteDe(lire));
  const fautes = porteurs.length === 0 ? [SANS_PORTEUR] : [];
  const aEcrire = [];
  for (const chemin of porteurs) {
    const { texte, faute } = lirePorteur(lire, chemin);
    if (faute !== null) {
      fautes.push(faute);
      continue;
    }
    try {
      if (lireRegions(texte).length === 0) {
        fautes.push({ chemin, faute: 'aucune région engendrée : un porteur en a au moins une' });
        continue;
      }
      const rendu = remplacerRegions(texte, producteurs);
      if (rendu !== texte) aEcrire.push([chemin, rendu]);
    } catch (erreur) {
      if (erreur instanceof ErreurRegions) fautes.push(...erreur.fautes.map(auChemin(chemin)));
      else fautes.push({ chemin, faute: `le producteur échoue : ${erreur.message}` });
    }
  }
  if (fautes.length > 0) return { fautes, ecrits: [], code: 1 };
  for (const [chemin, rendu] of aEcrire) ecrire(chemin, rendu);
  return { fautes, ecrits: aEcrire.map(([chemin]) => chemin), code: 0 };
}

/**
 * La ligne qui nomme un écart de version (§ 19.7) : sa portée — bloquant
 * sous livraison, non bloquant au cycle court —, la version du manifeste,
 * celle de la construction. La ligne de commande l'imprime, et la série node
 * l'affiche au cycle court (test/documentation.test.js).
 *
 * @param {null|{manifeste: string|null, construction: string}} ecart  celui de verifierArbre
 * @param {{livraison?: boolean}} [options]
 * @returns {string|null}   null sans écart
 */
export function ligneEcart(ecart, { livraison = false } = {}) {
  if (ecart === null) return null;
  const portee = livraison ? 'bloquant' : 'non bloquant';
  const manifeste = ecart.manifeste ?? 'aucune (manifeste absent ou sans capture)';
  return `écart de version (${portee}) : manifeste ${manifeste}, construction ${ecart.construction}`;
}

const USAGE =
  'usage : node scripts/documentation.js engendrer | verifier [--livraison] [--racine <dossier>] [--porteur <chemin>]…';

// Les arguments lus : { mode, livraison, racine, porteurs }, ou null quand
// ils ne se lisent pas.
function lireArguments(argv) {
  const [mode, ...reste] = argv;
  if (mode !== 'engendrer' && mode !== 'verifier') return null;
  const lus = { mode, livraison: false, racine: null, porteurs: [] };
  for (let rang = 0; rang < reste.length; rang += 1) {
    const option = reste[rang];
    if (option === '--livraison' && mode === 'verifier') lus.livraison = true;
    else if ((option === '--racine' || option === '--porteur') && rang + 1 < reste.length) {
      rang += 1;
      if (option === '--racine') lus.racine = resolve(reste[rang]);
      else lus.porteurs.push(reste[rang]);
    } else return null;
  }
  return lus;
}

/**
 * La ligne de commande : lit ses arguments, lance le mode, écrit son bilan
 * ligne à ligne sur la sortie.
 *
 * @param {string[]} argv   sans l'exécutable ni le script
 * @param {{racine?: string, porteurs?: ReadonlyArray<string>, version?: string,
 *          lire?: (chemin: string) => string, lireOctets?: (chemin: string) => Uint8Array,
 *          ecrire?: (chemin: string, texte: string) => void,
 *          sortie?: (ligne: string) => void}} [options]
 * @returns {0|1|2}   2 pour des arguments illisibles, sans rien lire
 */
export function executer(argv, { racine = RACINE, porteurs = PORTEURS, version, lire, lireOctets, ecrire, sortie = (ligne) => process.stdout.write(`${ligne}\n`) } = {}) {
  const lus = lireArguments(argv);
  if (lus === null) {
    sortie(USAGE);
    return 2;
  }
  const options = {
    racine: lus.racine ?? racine,
    porteurs: lus.porteurs.length > 0 ? lus.porteurs : porteurs,
    ...(lire === undefined ? {} : { lire }),
  };
  const ecrireFautes = (fautes) => fautes.forEach(({ chemin, faute }) => sortie(`${chemin} : ${faute}`));
  if (lus.mode === 'engendrer') {
    const bilan = engendrerArbre({ ...options, ...(ecrire === undefined ? {} : { ecrire }) });
    ecrireFautes(bilan.fautes);
    bilan.ecrits.forEach((chemin) => sortie(`engendré : ${chemin}`));
    sortie(`engendrer : ${options.porteurs.length} porteur(s), ${bilan.ecrits.length} réécrit(s), ${bilan.fautes.length} faute(s)`);
    return bilan.code;
  }
  const bilan = verifierArbre({
    ...options,
    livraison: lus.livraison,
    ...(version === undefined ? {} : { version }),
    ...(lireOctets === undefined ? {} : { lireOctets }),
  });
  ecrireFautes(bilan.fautes);
  const ecart = ligneEcart(bilan.ecart, { livraison: lus.livraison });
  if (ecart !== null) sortie(ecart);
  sortie(`verifier : ${options.porteurs.length} porteur(s), ${bilan.regions} région(s), ${bilan.images} image(s), ${bilan.fautes.length} faute(s)`);
  return bilan.code;
}

/**
 * Vrai quand chemin désigne ce module : Node charge le script lancé sous son
 * chemin réel, et un chemin qui traverse un lien symbolique se compare donc
 * par realpathSync. Un chemin absent ou illisible rend faux.
 *
 * @param {string|undefined} [chemin]  le script que Node a lancé
 * @returns {boolean}
 */
export function estLanceDirectement(chemin = process.argv[1]) {
  if (chemin === undefined) return false;
  try {
    return realpathSync(chemin) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (estLanceDirectement()) {
  process.exitCode = executer(process.argv.slice(2));
}
