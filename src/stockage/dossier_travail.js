// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La règle du dossier de travail (§ 8.6), que l'application applique une
// fois par séance, au démarrage, sur le système de fichiers qu'elle reçoit
// (§ 13.4). Sous la plateforme web, « à côté de l'exécutable » ne désigne
// rien : le dossier de travail est la racine documents, et PLATEFORME_WEB
// annonce les garanties que la plateforme n'offre pas (§ 8.8). Ailleurs, la
// règle tient en cinq points :
//
//   1. le dossier de l'exécutable est celui que publie le lanceur portable,
//      Emplacements.executable, jamais celui du processus, qu'une archive
//      auto-extractible fait tourner dans un dossier temporaire ; non publié,
//      la règle passe au point 5 (NON_PUBLIE) ;
//   2. sous un emplacement de données applicatives, elle passe au point 5
//      sans sonder data/ (DONNEES_APPLICATIVES) : la sonde y réussirait, et
//      data/ naîtrait là où le § 8.6 l'interdit ;
//   3. sinon, la sonde éprouve l'écriture dans data/, qu'elle crée ;
//   4. réussie, data/ est le dossier de travail : le mode portable ;
//   5. échouée (SONDE_ECHOUEE, avec sa cause) ou interrompue, le dossier de
//      travail est la racine documents.
//
// Le dossier retenu est toujours sondé, et sa sonde le crée : au point 5 et
// sous web, la racine documents naît là, avant la réponse quand la règle
// demande, et aucune écriture de fichier ne la crée ensuite, puisqu'un
// dossier de travail disparu ne se recrée pas en silence. Hors des témoins
// des sondes, la règle ne fait que lire : en mode portable, rien ne s'écrit
// hors de data/ ; sous un emplacement de données applicatives, data/ n'est
// ni sondé ni créé.
//
// Ce qui arrive ensuite (§ 8.6) se lit dans le résultat :
//
//   question        le logiciel demande avant d'ouvrir la liste.
//                   PORTABLE_NON_INSCRIPTIBLE : la sonde de data/ échoue,
//                   et data/ porte des événements, ou ne se lit pas — leur
//                   compte est alors inconnu, null ; passer en silence aux
//                   Documents ouvrirait sur une liste où ils manquent.
//                   DOCUMENTS_NON_INSCRIPTIBLE : la sonde du dossier retenu
//                   échoue, et aucun geste ne s'y écrirait. La première
//                   l'emporte quand les deux tombent : elle seule nomme des
//                   événements qui existent, ou peuvent exister, ailleurs, et
//                   l'échec du dossier retenu se nomme encore à la première
//                   écriture refusée.
//   autre           le dossier retenu est neuf et vide — il ne porte aucune
//                   entrée — quand l'autre emplacement porte des événements :
//                   le logiciel propose de les importer, par copie (§ 8.7).
//                   Un dossier qui a servi, fût-ce pour une corbeille ou des
//                   réglages locaux, ne le propose plus à chaque séance ; un
//                   emplacement qui ne se lit pas ne propose rien.
//   avertissements  PLATEFORME_WEB, puis SUPPORT_AMOVIBLE quand le dossier
//                   retenu est sur un support amovible, où le renommage
//                   par-dessus ne vaut pas celui du volume système (§ 8.8).
//
// Un événement se compte par ses deux fichiers (§ 8.6) : chaque base qui
// porte un état ou un journal à la racine du dossier, un journal sans son
// état compris, dont l'événement se relève (§ 8.8). Le compte lit les noms
// sans ouvrir les fichiers ; l'appariement par identifiant interne reste
// celui de la liste des événements.
//
// Une lecture qui échoue autrement que sur un dossier absent ne vaut pas un
// dossier vide. Sur le dossier retenu, l'échec remonte : la séance n'y
// lirait pas sa liste. Sur l'autre emplacement, qui ne sert qu'à proposer un
// import ou à nommer ce qu'une bascule cacherait, il laisse un compte
// inconnu, et le dossier retenu reste. Un chemin refusé, et ce qui n'est pas
// une ErreurStockage, remontent d'où qu'ils viennent : une faute du code ou
// un processus coupé ne disent rien du disque.
import { ErreurStockage } from './erreurs.js';
import { SUFFIXES } from './noms.js';

/**
 * @typedef {import('./systeme_fichiers.js').Racine} Racine
 * @typedef {import('./systeme_fichiers.js').SystemeFichiers} SystemeFichiers
 */

/**
 * Le dossier de travail d'une séance, et ce que le logiciel doit en dire.
 *
 * @typedef {Object} DossierTravail
 * @property {Racine} racine
 * @property {'portable'|'documents'|'web'} mode
 * @property {null|'NON_PUBLIE'|'DONNEES_APPLICATIVES'|'SONDE_ECHOUEE'} raison
 *           pourquoi le mode n'est pas portable ; null en mode portable et
 *           sous web
 * @property {string|null} cause   cause de l'échec de la sonde de data/
 *           (SONDE_ECHOUEE) ; null sinon
 * @property {null|{code: 'PORTABLE_NON_INSCRIPTIBLE'|'DOCUMENTS_NON_INSCRIPTIBLE',
 *           racine: Racine, evenements: number|null, cause: string|null}} question
 *           le dossier qui refuse l'écriture, ses événements — null quand
 *           data/ ne se lit pas —, la cause de sa sonde : le logiciel
 *           demande avant d'ouvrir la liste
 * @property {null|{racine: Racine, evenements: number}} autre
 *           le dossier retenu est neuf et vide, l'autre emplacement porte
 *           ces événements : le logiciel propose de les importer, par copie
 * @property {Array<'PLATEFORME_WEB'|'SUPPORT_AMOVIBLE'>} avertissements
 *           dans cet ordre
 */

// Les deux fichiers d'un événement (§ 8.6).
const FICHIERS_EVENEMENT = [SUFFIXES.etat, SUFFIXES.journal];

// Un caractère vers sa majuscule quand elle tient en un seul caractère, sans
// regarder le contexte, comme Windows compare deux noms : ß, dont la
// majuscule s'écrit SS, reste lui-même.
function majusculeSimple(caractere) {
  const majuscule = caractere.toUpperCase();
  return Array.from(majuscule).length === 1 ? majuscule : caractere;
}

// Un chemin tel que le système le compare : chaque caractère vers sa
// majuscule simple là où la casse ne compte pas, puis sans ses séparateurs
// finaux.
function comparable(chemin, insensibleCasse, separateur) {
  let texte = insensibleCasse ? Array.from(chemin, majusculeSimple).join('') : chemin;
  while (texte.endsWith(separateur)) texte = texte.slice(0, -1);
  return texte;
}

/**
 * Vrai quand chemin est parent ou se trouve sous lui, sur une frontière de
 * segment : C:\Users\Exemple\AppDataBis n'est pas sous
 * C:\Users\Exemple\AppData. Les deux chemins sont absolus, au séparateur du
 * système, et comparés comme il compare les noms. Un séparateur final ne
 * compte pas, si bien que la racine d'un volume, C:\ ou /, porte tout le
 * volume.
 *
 * @param {string} chemin
 * @param {string} parent
 * @param {{insensibleCasse: boolean, separateur: '\\'|'/'}} systeme
 *        ceux des Emplacements
 * @returns {boolean}
 */
export function estSous(chemin, parent, { insensibleCasse, separateur }) {
  const enfant = comparable(chemin, insensibleCasse, separateur);
  const dossier = comparable(parent, insensibleCasse, separateur);
  return enfant === dossier || enfant.startsWith(dossier + separateur);
}

// Entrées directes de la racine d'un dossier ; aucune pour un dossier
// absent. Tout autre échec de la lecture remonte : une panne n'est pas un
// dossier vide.
async function entrees(fs, racine) {
  try {
    return await fs.lister(racine, '');
  } catch (erreur) {
    if (erreur instanceof ErreurStockage && erreur.code === 'ABSENT') return [];
    throw erreur;
  }
}

// Événements d'une liste d'entrées : les bases distinctes de ses fichiers
// d'état et de journal. Un dossier ne compte pas, fût-il nommé comme eux.
function compterEvenements(liste) {
  const bases = new Set();
  for (const { nom, type } of liste) {
    const suffixe = FICHIERS_EVENEMENT.find((fin) => nom.endsWith(fin));
    if (type === 'fichier' && suffixe !== undefined) bases.add(nom.slice(0, -suffixe.length));
  }
  return bases.size;
}

// Événements de l'autre emplacement ; null, compte inconnu, quand sa lecture
// échoue sur une ErreurStockage autre qu'un dossier absent ou un chemin
// refusé.
async function compterAilleurs(fs, ailleurs) {
  try {
    return compterEvenements(await entrees(fs, ailleurs));
  } catch (erreur) {
    if (erreur instanceof ErreurStockage && erreur.code !== 'CHEMIN_REFUSE') return null;
    throw erreur;
  }
}

// Les points 1 à 5 : le mode, le dossier retenu, l'autre emplacement — null
// quand il n'y en a pas —, pourquoi data/ n'est pas retenu, et la sonde du
// dossier retenu quand elle a déjà eu lieu, null sinon.
async function appliquerRegle(fs, { portable, documents }) {
  const repli = (raison, cause) => ({ mode: 'documents', racine: documents, ailleurs: portable, raison, cause, sonde: null });
  if (fs.nature === 'web') {
    return { mode: 'web', racine: documents, ailleurs: null, raison: null, cause: null, sonde: null };
  }
  const emplacements = await fs.emplacements();
  if (emplacements.executable === null) return repli('NON_PUBLIE', null);
  if (emplacements.donneesApplicatives.some((dossier) => estSous(emplacements.executable, dossier, emplacements))) {
    return repli('DONNEES_APPLICATIVES', null);
  }
  const sonde = await fs.sonder(portable);
  if (!sonde.inscriptible) return repli('SONDE_ECHOUEE', sonde.cause);
  return { mode: 'portable', racine: portable, ailleurs: documents, raison: null, cause: null, sonde };
}

/**
 * Applique la règle du dossier de travail (§ 8.6), une fois par séance ; la
 * perte d'inscriptibilité en cours de séance se traite à l'écriture qui
 * échoue, non ici. N'écrit que les témoins des sondes : celle de data/, aux
 * points 3 et 4, et celle du dossier retenu, qui le crée.
 *
 * @param {SystemeFichiers} fs
 * @returns {Promise<DossierTravail>}
 * @throws ce que lève une primitive, hors d'un dossier absent à la lecture
 *         et, à celle de l'autre emplacement, d'une ErreurStockage autre que
 *         CHEMIN_REFUSE
 */
export async function determinerDossierTravail(fs) {
  const issue = await appliquerRegle(fs, await fs.racines());
  const { mode, racine, ailleurs, raison, cause } = issue;
  const sonde = issue.sonde ?? (await fs.sonder(racine));
  const ici = await entrees(fs, racine);
  const evenementsAilleurs = ailleurs === null ? 0 : await compterAilleurs(fs, ailleurs);

  // SONDE_ECHOUEE est la seule raison née d'une sonde de data/, qui est
  // alors l'autre emplacement. Un compte inconnu demande comme un compte non
  // nul : data/ peut porter ce qu'une bascule cacherait.
  let question = null;
  if (raison === 'SONDE_ECHOUEE' && evenementsAilleurs !== 0) {
    question = { code: 'PORTABLE_NON_INSCRIPTIBLE', racine: ailleurs, evenements: evenementsAilleurs, cause };
  } else if (!sonde.inscriptible) {
    question = { code: 'DOCUMENTS_NON_INSCRIPTIBLE', racine, evenements: compterEvenements(ici), cause: sonde.cause };
  }
  // Un compte inconnu, null, ne propose rien : null n'est pas supérieur à 0.
  const autre = ici.length === 0 && evenementsAilleurs > 0 ? { racine: ailleurs, evenements: evenementsAilleurs } : null;

  const avertissements = [];
  if (mode === 'web') avertissements.push('PLATEFORME_WEB');
  if ((await fs.typeSupport(racine)) === 'amovible') avertissements.push('SUPPORT_AMOVIBLE');
  return { racine, mode, raison, cause, question, autre, avertissements };
}
