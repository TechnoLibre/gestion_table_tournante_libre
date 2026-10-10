// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le relevé du banc de mesure (§ 19.10, § 14.1) et son accord avec le
// registre des constantes. Le banc écrit un relevé, scripts/banc/releve.json,
// jamais le registre : adopter une valeur est un geste du développeur, qui
// l'écrit dans src/geometrie/constantes.js, passe le statut à « mesuree » et
// fait citer à la configuration de l'entrée le résumé de celle du relevé.
// accordRegistre refuse ensuite toute constante du banc mesurée que le relevé
// ne soutient pas. Le relevé ne nomme pas sa machine : sa configuration est
// une liste fermée de champs — cadre, facteur d'échelle, versions, nombre
// de processeurs logiques, ralentissement, police —, et aucun texte n'y
// porte un chemin de compte ni une date. Une mesure peut porter son propre
// ralentissement, celui sous lequel elle s'est prise : c'est lui que cite
// la configuration de sa constante. Fonctions pures, sans lecture de
// fichier ni horloge.

import { CONSTANTES } from '../../src/geometrie/constantes.js';

/**
 * @typedef {{chemin: string, faute: string}} Faute
 * @typedef {{cadre: {largeur: number, hauteur: number}, facteurEchelle: number,
 *   navigateur: string|null, node: string|null, processeursLogiques: number|null,
 *   ralentissementCpu: number|null, police: string|null}} ConfigurationReleve
 * @typedef {{nom: string, unite: string, valeurProposee: number|null, critere: string,
 *   courbe?: object[], verdict?: 'tenu'|'nonTenu', ralentissementCpu?: number|null}} MesureReleve
 * @typedef {{format: 1, configuration: ConfigurationReleve, mesures: MesureReleve[],
 *   plafondAPriori?: object[], parallele?: object[]}} Releve
 */

// Les champs d'un relevé, et ceux de sa configuration : rien d'autre ne s'y
// écrit, un champ de plus pouvant nommer la machine.
const CHAMPS_RELEVE = ['format', 'configuration', 'mesures', 'plafondAPriori', 'parallele'];
const CHAMPS_CONFIGURATION = [
  'cadre',
  'facteurEchelle',
  'navigateur',
  'node',
  'processeursLogiques',
  'ralentissementCpu',
  'police',
];

// Les noms de champ qui désignent l'hôte, son utilisateur ou un instant,
// refusés à toute profondeur du relevé. Un nom se coupe en mots — au tiret
// bas, au tiret, à l'espace et à chaque majuscule qui suit une minuscule ou
// un chiffre, ou qui ouvre un mot après un sigle (« HOSTName » : host,
// name) —, puis se lit sans accent et en minuscules : « nomHôte »,
// « nom_hote » et « NOM-HOTE » se valent. Il est identifiant quand le nom
// entier, mots recollés, contient un mot de MOT_IDENTIFIANT (hostname,
// nomMachine), quand l'un de ses mots commence par un préfixe de
// PREFIXE_IDENTIFIANT (userName, currentUser, releveDate), ou quand l'un de
// ses mots vaut un nom de NOM_IDENTIFIANT (nomDuPoste, nomCompte). Ces
// derniers ne se lisent qu'entiers, leur début commençant des mots
// ordinaires : compteur, postérieur, instantané. NOM_ADMIS lève le soupçon
// sur un nom entier qui ne désigne personne : userAgent nomme le navigateur.
const MOT_IDENTIFIANT = ['host', 'hote', 'machine', 'computer', 'utilisateur', 'horodatage', 'timestamp'];
const PREFIXE_IDENTIFIANT = ['user', 'date', 'login'];
const NOM_IDENTIFIANT = new Set(['poste', 'compte', 'instant']);
const NOM_ADMIS = new Set(['useragent']);

// Les mots d'un nom de champ, sans accent et en minuscules.
const motsDe = (cle) =>
  cle
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/([\p{Ll}\d])(\p{Lu})/gu, '$1 $2')
    .replace(/(\p{Lu})(\p{Lu}\p{Ll})/gu, '$1 $2')
    .toLowerCase()
    .split(/[\s_-]+/)
    .filter((mot) => mot !== '');

function estChampIdentifiant(cle) {
  const mots = motsDe(cle);
  const nom = mots.join('');
  if (NOM_ADMIS.has(nom)) return false;
  return (
    MOT_IDENTIFIANT.some((mot) => nom.includes(mot)) ||
    mots.some((mot) => PREFIXE_IDENTIFIANT.some((prefixe) => mot.startsWith(prefixe)) || NOM_IDENTIFIANT.has(mot))
  );
}

// Un chemin de compte : le dossier personnel sous Linux (/home/x, et
// /var/home/x qui le contient), sous macOS (/Users/x), celui de root, et le
// profil sous Windows (C:\Users\x, C:\Documents and Settings\x), quel que
// soit le séparateur. /opt/homebrew ne s'y lit pas : « home » y est suivi
// d'autre chose qu'un séparateur.
const CHEMIN_DE_COMPTE = /\/(?:home|Users)\/[^/\s]+|\/root(?:\/|$)|[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/][^\\/\s]+/i;

// Une date calendaire dans un texte, seule ou au début d'un horodatage :
// AAAA-MM-JJ, AAAA.MM.JJ ou AAAA/MM/JJ, d'un même séparateur, le mois de 01
// à 12 et le jour de 01 à 31 ; ou JJ/MM/AAAA et JJ.MM.AAAA, jour et mois
// sur un ou deux chiffres, dans un ordre ou dans l'autre (31/12 ou 12/31).
// Aucun chiffre ne la précède ni ne la suit : un nombre plus long ne s'y lit pas.
const DATE =
  /(?<!\d)(?:\d{4}([-./])(?:0[1-9]|1[0-2])\1(?:0[1-9]|[12]\d|3[01])|(?:0?[1-9]|[12]\d|3[01])([/.])(?:0?[1-9]|[12]\d|3[01])\2\d{4})(?!\d)/;

const MESSAGE_IDENTIFIANT = 'un relevé ne nomme pas sa machine : ni hôte, ni utilisateur, ni date';

const estObjet = (valeur) => typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);
const estTexte = (valeur) => typeof valeur === 'string' && valeur.length > 0;
const estPositif = (valeur) => Number.isFinite(valeur) && valeur > 0;
const estEntierPositif = (valeur) => Number.isInteger(valeur) && valeur > 0;

// Les clés d'un objet, triées par unités de code : l'ordre des fautes ne
// dépend pas de l'ordre d'écriture du fichier.
const clesTriees = (objet) => Object.keys(objet).sort();

// Un ralentissement du processeur : un facteur ≥ 1, ou null pour inconnu.
const estRalentissement = (v) => v === null || (Number.isFinite(v) && v >= 1);
const FAUTE_RALENTISSEMENT = 'nombre ≥ 1 ou null attendu';

// Chaque champ de la configuration, avec ce qu'il admet et la faute qu'il
// porte sinon. null vaut « inconnu » pour les champs qui le permettent : un
// relevé qui ne connaît pas encore son navigateur reste vérifiable.
const REGLES_CONFIGURATION = {
  cadre: [
    (v) => estObjet(v) && clesTriees(v).join(',') === 'hauteur,largeur' && estEntierPositif(v.largeur) && estEntierPositif(v.hauteur),
    'largeur et hauteur en px, entiers positifs, et rien d’autre',
  ],
  facteurEchelle: [estPositif, 'nombre positif attendu'],
  navigateur: [(v) => v === null || estTexte(v), 'texte non vide ou null attendu'],
  node: [(v) => v === null || estTexte(v), 'texte non vide ou null attendu'],
  processeursLogiques: [(v) => v === null || estEntierPositif(v), 'entier positif ou null attendu'],
  ralentissementCpu: [estRalentissement, FAUTE_RALENTISSEMENT],
  police: [(v) => v === null || estTexte(v), 'texte non vide ou null attendu'],
};

// Fautes de la configuration : un champ hors de la liste (les champs
// identifiants sont laissés au balayage), puis chaque champ de la liste,
// dans son ordre.
function fautesConfiguration(configuration) {
  if (!estObjet(configuration)) return [{ chemin: 'configuration', faute: 'configuration absente : objet attendu' }];
  const fautes = [];
  for (const cle of clesTriees(configuration)) {
    if (!CHAMPS_CONFIGURATION.includes(cle) && !estChampIdentifiant(cle)) {
      fautes.push({
        chemin: `configuration.${cle}`,
        faute: `champ hors de la configuration admise : ${CHAMPS_CONFIGURATION.join(', ')}`,
      });
    }
  }
  for (const champ of CHAMPS_CONFIGURATION) {
    const chemin = `configuration.${champ}`;
    if (!Object.hasOwn(configuration, champ)) {
      fautes.push({ chemin, faute: 'champ absent' });
      continue;
    }
    const [admet, faute] = REGLES_CONFIGURATION[champ];
    if (!admet(configuration[champ])) fautes.push({ chemin, faute });
  }
  return fautes;
}

// Fautes d'une mesure, dans l'ordre de ses champs. Une mesure qui nomme une
// constante du registre appartient au banc et en porte l'unité ; un autre
// nom est une garde du banc (le temps par image), qui porte la sienne.
function fautesMesure(mesure, rang, vus, constantes) {
  const base = `mesures[${rang}]`;
  if (!estObjet(mesure)) return [{ chemin: base, faute: 'objet attendu' }];
  const fautes = [];
  const faute = (champ, texte) => fautes.push({ chemin: `${base}.${champ}`, faute: texte });
  const entree = estTexte(mesure.nom) ? constantes.find((c) => c.nom === mesure.nom) : undefined;
  if (!estTexte(mesure.nom)) faute('nom', 'nom non vide attendu');
  else if (vus.has(mesure.nom)) faute('nom', 'mesure déjà relevée plus haut');
  else if (entree !== undefined && entree.proprietaire !== 'banc') {
    faute('nom', `constante de propriétaire ${entree.proprietaire} : le banc ne la relève pas`);
  }
  if (estTexte(mesure.nom)) vus.add(mesure.nom);
  if (!estTexte(mesure.unite)) faute('unite', 'unité non vide attendue');
  else if (entree !== undefined && entree.unite !== mesure.unite) {
    faute('unite', `unité « ${mesure.unite} », le registre dit « ${entree.unite} »`);
  }
  if (!(mesure.valeurProposee === null || Number.isFinite(mesure.valeurProposee))) {
    faute('valeurProposee', 'nombre fini ou null attendu');
  }
  if (!estTexte(mesure.critere)) faute('critere', 'critère non vide attendu');
  if (Object.hasOwn(mesure, 'courbe') && !Array.isArray(mesure.courbe)) faute('courbe', 'liste attendue');
  if (Object.hasOwn(mesure, 'verdict') && mesure.verdict !== 'tenu' && mesure.verdict !== 'nonTenu') {
    faute('verdict', '« tenu » ou « nonTenu » attendu');
  }
  if (Object.hasOwn(mesure, 'ralentissementCpu') && !estRalentissement(mesure.ralentissementCpu)) {
    faute('ralentissementCpu', FAUTE_RALENTISSEMENT);
  }
  return fautes;
}

// Balayage du relevé entier, clés triées à chaque niveau : un champ
// identifiant, et tout texte qui porte un chemin de compte ou une date.
function fautesIdentifiantes(valeur, chemin, fautes) {
  if (typeof valeur === 'string') {
    if (CHEMIN_DE_COMPTE.test(valeur)) fautes.push({ chemin, faute: 'chemin de compte : un relevé ne nomme pas sa machine' });
    if (DATE.test(valeur)) fautes.push({ chemin, faute: 'date : un relevé ne porte pas l’instant de sa prise' });
  } else if (Array.isArray(valeur)) {
    valeur.forEach((element, rang) => fautesIdentifiantes(element, `${chemin}[${rang}]`, fautes));
  } else if (estObjet(valeur)) {
    for (const cle of clesTriees(valeur)) {
      const sous = chemin === '' ? cle : `${chemin}.${cle}`;
      if (estChampIdentifiant(cle)) fautes.push({ chemin: sous, faute: MESSAGE_IDENTIFIANT });
      fautesIdentifiantes(valeur[cle], sous, fautes);
    }
  }
  return fautes;
}

/**
 * Les fautes d'un relevé, [] quand il est conforme. Dans l'ordre : un champ
 * hors du format ; le format, 1 ; la configuration ; les mesures, une liste
 * non vide — un relevé vide ne prouve rien (§ 14.2) —, chacune nommée une
 * seule fois, et à l'unité du registre quand elle nomme l'une de ses
 * constantes, qui doit alors appartenir au banc ; plafondAPriori et
 * parallele, des listes quand ils sont présents ; puis, à toute profondeur,
 * chaque champ identifiant et chaque texte qui porte un chemin de compte ou
 * une date.
 * @param {Releve} releve
 * @param {ReadonlyArray<import('../../src/geometrie/constantes.js').Constante>} [constantes]
 * @returns {Faute[]}
 */
export function verifierReleve(releve, constantes = CONSTANTES) {
  if (!estObjet(releve)) return [{ chemin: '', faute: 'relevé : objet attendu' }];
  const fautes = [];
  for (const cle of clesTriees(releve)) {
    if (!CHAMPS_RELEVE.includes(cle) && !estChampIdentifiant(cle)) {
      fautes.push({ chemin: cle, faute: 'champ hors du format du relevé' });
    }
  }
  if (releve.format !== 1) fautes.push({ chemin: 'format', faute: `format ${String(releve.format)} : 1 attendu` });
  fautes.push(...fautesConfiguration(releve.configuration));
  if (!Array.isArray(releve.mesures)) {
    fautes.push({ chemin: 'mesures', faute: 'liste attendue' });
  } else if (releve.mesures.length === 0) {
    fautes.push({ chemin: 'mesures', faute: 'aucune mesure : un relevé vide ne prouve rien' });
  } else {
    const vus = new Set();
    releve.mesures.forEach((mesure, rang) => fautes.push(...fautesMesure(mesure, rang, vus, constantes)));
  }
  for (const champ of ['plafondAPriori', 'parallele']) {
    if (Object.hasOwn(releve, champ) && !Array.isArray(releve[champ])) fautes.push({ chemin: champ, faute: 'liste attendue' });
  }
  return fautesIdentifiantes(releve, '', fautes);
}

/**
 * Un nombre écrit à la française : la virgule décimale, les milliers
 * séparés par une espace, comme le registre les écrit (« 1 366 »).
 * @param {number} valeur
 * @returns {string}
 */
export function nombre(valeur) {
  const [entiere, decimale] = String(valeur).split('.');
  const groupee = entiere.replace(/\B(?=(\d{3})+$)/g, ' ');
  return decimale === undefined ? groupee : `${groupee},${decimale}`;
}

/**
 * Le résumé d'une configuration de relevé, celui que la configuration d'une
 * constante adoptée cite : cadre, facteur d'échelle, navigateur, Node,
 * processeurs logiques, ralentissement du processeur et police, dans cet
 * ordre quel que soit celui des champs. Un champ null se dit inconnu.
 * @param {ConfigurationReleve} configuration
 * @returns {string}
 * @throws {TypeError} sur ce qui n'est pas un objet, ou dont le cadre n'est
 *   pas un objet aux largeur et hauteur numériques
 */
export function resumeConfiguration(configuration) {
  if (!estObjet(configuration)) throw new TypeError('configuration de relevé : objet attendu');
  const { cadre, facteurEchelle, navigateur, node } = configuration;
  const { processeursLogiques: p, ralentissementCpu: r, police } = configuration;
  if (!estObjet(cadre) || !Number.isFinite(cadre.largeur) || !Number.isFinite(cadre.hauteur)) {
    throw new TypeError('configuration de relevé : cadre absent ou sans largeur et hauteur numériques');
  }
  const processeurs =
    p === null ? 'processeurs logiques inconnus' : `${nombre(p)} ${p === 1 ? 'processeur logique' : 'processeurs logiques'}`;
  let ralentissement = `processeur ralenti ×${nombre(r)}`;
  if (r === null) ralentissement = 'ralentissement inconnu';
  else if (r === 1) ralentissement = 'processeur non ralenti';
  return [
    `cadre de ${nombre(cadre.largeur)} × ${nombre(cadre.hauteur)} px`,
    `facteur ${nombre(facteurEchelle)}`,
    navigateur ?? 'navigateur inconnu',
    `Node ${node ?? 'inconnu'}`,
    processeurs,
    ralentissement,
    `police ${police ?? 'inconnue'}`,
  ].join(', ');
}

// La mesure que le relevé porte pour une constante, undefined sinon.
const mesureDe = (releve, nom) => (Array.isArray(releve.mesures) ? releve.mesures : []).find((m) => m?.nom === nom);

// Le résumé que cite une constante du banc : celui de la configuration du
// relevé, au ralentissement de sa mesure quand elle en porte un — une
// mesure prise sans ralentissement sous un relevé dont la machine de
// référence est ralentie se dit « non ralenti ». Sans mesure, ou sans
// ralentissement propre, celui de la configuration.
function resumeDeMesure(releve, mesure) {
  if (mesure === undefined || !Object.hasOwn(mesure, 'ralentissementCpu')) return resumeConfiguration(releve.configuration);
  return resumeConfiguration({ ...releve.configuration, ralentissementCpu: mesure.ralentissementCpu });
}

/**
 * L'accord du registre avec un relevé : pour chaque constante du banc
 * déclarée mesurée, dans l'ordre du registre, « absente » quand le relevé ne
 * la porte pas ou n'en propose aucune valeur ; sinon « valeur » quand le
 * registre porte une autre valeur que la proposée, puis « configuration »
 * quand la configuration de l'entrée ne cite pas le résumé de celle du
 * relevé, au ralentissement propre de la mesure quand elle en porte un. Une constante défaut de travail, ou d'un autre propriétaire, ne
 * produit rien : le relevé ne la soutient ni ne la contredit.
 * @param {ReadonlyArray<import('../../src/geometrie/constantes.js').Constante>} constantes
 * @param {Releve} releve
 * @returns {Array<{nom: string, faute: 'absente'|'valeur'|'configuration'}>}
 */
export function accordRegistre(constantes, releve) {
  // Une configuration que le résumé refuse lève d'emblée, qu'une constante
  // la cite ou non.
  resumeConfiguration(releve.configuration);
  const fautes = [];
  for (const { nom, valeur, configuration, proprietaire, statut } of constantes) {
    if (proprietaire !== 'banc' || statut !== 'mesuree') continue;
    const mesure = mesureDe(releve, nom);
    if (mesure === undefined || mesure.valeurProposee === null) {
      fautes.push({ nom, faute: 'absente' });
      continue;
    }
    if (mesure.valeurProposee !== valeur) fautes.push({ nom, faute: 'valeur' });
    if (!configuration.includes(resumeDeMesure(releve, mesure))) fautes.push({ nom, faute: 'configuration' });
  }
  return fautes;
}

// Les libellés du statut et du propriétaire, tels que le tableau les écrit.
const STATUTS = { mesuree: 'mesurée', defautDeTravail: 'défaut de travail' };
const PROPRIETAIRES = { banc: 'banc', node: 'node', manuel: 'manuel', execution: 'exécution' };

const ENTETE = [
  'Constante',
  'Ce qu’elle mesure',
  'Valeur',
  'Statut',
  'Propriétaire',
  'Protocole',
  'Valeur proposée par le banc',
  'Configuration du relevé',
];

// Une cellule de tableau Markdown : une barre verticale s'échappe, un saut
// de ligne devient une espace.
const cellule = (texte) => String(texte).replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ');
const ligne = (cellules) => `| ${cellules.map(cellule).join(' | ')} |`;

const avecUnite = (valeur, unite) => `${nombre(valeur)} ${unite}`;

// La valeur que le relevé propose pour une constante : avec son unité ;
// « non relevée » pour une constante du banc qu'il ne mesure pas ou dont il
// ne propose rien ; « — » hors du banc, qui ne la relève pas.
function valeurProposee(constante, releve) {
  if (constante.proprietaire !== 'banc') return '—';
  const mesure = mesureDe(releve, constante.nom);
  return mesure === undefined || mesure.valeurProposee === null ? 'non relevée' : avecUnite(mesure.valeurProposee, constante.unite);
}

/**
 * Le tableau des constantes mesurées (§ 19.10, § 19.8), contenu de la région
 * engendrée « constantes » : un en-tête, son séparateur, puis une ligne par
 * constante du registre, dans son ordre — ce qu'elle mesure, sa valeur
 * (« relevée à l'exécution » sans valeur), son statut en toutes lettres, son
 * propriétaire, son protocole, la valeur que le relevé propose, et la
 * configuration : pour une constante du banc, le résumé de celle du relevé
 * au ralentissement propre de sa mesure quand elle en porte un ; celle du
 * registre pour les autres. Lignes jointes par un saut de ligne,
 * sans saut final.
 * @param {ReadonlyArray<import('../../src/geometrie/constantes.js').Constante>} constantes
 * @param {Releve} releve
 * @returns {string}
 * @throws {RangeError} sur un registre vide : un tableau sans ligne ne prouve rien
 */
export function tableauConstantes(constantes, releve) {
  if (constantes.length === 0) throw new RangeError('tableau des constantes : registre vide');
  // Une configuration que le résumé refuse lève d'emblée, qu'une constante
  // la cite ou non.
  resumeConfiguration(releve.configuration);
  const lignes = constantes.map((c) =>
    ligne([
      `\`${c.nom}\``,
      c.mesure,
      c.valeur === null ? 'relevée à l’exécution' : avecUnite(c.valeur, c.unite),
      STATUTS[c.statut],
      PROPRIETAIRES[c.proprietaire],
      c.protocole,
      valeurProposee(c, releve),
      c.proprietaire === 'banc' ? resumeDeMesure(releve, mesureDe(releve, c.nom)) : c.configuration,
    ]),
  );
  return [ligne(ENTETE), ligne(ENTETE.map(() => '---')), ...lignes].join('\n');
}
