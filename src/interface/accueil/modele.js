// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'accueil, pur (§ 8.1, § 8.6, § 8.8) : ce que les composants
// de la liste des événements affichent, sans arithmétique ni texte. Une
// ligne de la liste (LigneListe de la façade, evenements.js) devient ses six
// informations et ses signalements, mis en forme, puis, son résumé reçu, les
// collisions cumulées de son retenu et l'identifiant de la meilleure
// proposition de son classement ; les lignes de la liste, les tuiles de ses
// filtres par état du plan, le résumé de son en-tête et les groupes de son
// tableau ; une question du dossier de travail, ses réponses ; un état
// illisible, ses secours ; un refus de la façade, le refus affiché sur la
// liste. Chaque clé rendue est écrite ici en entier : aucun composant ne
// compose une clé.

// Les états du plan (§ 9) et la clé de leur nom, dans l'ordre du § 9.
const CLES_ETATS = new Map([
  ['brouillon', 'accueil.etat.brouillon'],
  ['propose', 'accueil.etat.propose'],
  ['retenu', 'accueil.etat.retenu'],
  ['bloque', 'accueil.etat.bloque'],
]);

/** Les états du plan, dans l'ordre du § 9. */
export const ETATS = Object.freeze([...CLES_ETATS.keys()]);

/**
 * La mesure du placement retenu qu'une ligne montre (§ 5.4, § 8.1) : ses
 * collisions cumulées, { colonne, cle, explication } — le nom de sa valeur
 * dans ligneAffichee et son data-colonne, la clé de son intitulé, celle de
 * la colonne du tableau des propositions qui porte la même mesure, et celle
 * de son explication, propre à la liste, que l'infobulle de l'intitulé
 * montre.
 */
export const COLONNES_DU_RETENU = Object.freeze([
  Object.freeze({
    colonne: 'collisionsCumulees',
    cle: 'propositions.colonne.collisionsCumulees',
    explication: 'accueil.explication.collisionsCumulees',
  }),
]);

/**
 * Les clés de la meilleure proposition du classement qu'une ligne montre
 * (§ 5.4, § 5.7) : titre et libellé de l'identifiant, ceux du bloc de la
 * génération, et explication du titre — ce que désigne le rang 1, et quand
 * la ligne écrit « — ». Ses collisions cumulées ne se montrent pas dans la
 * liste.
 */
export const MEILLEURE = Object.freeze({
  titre: 'generation.meilleure.titre',
  explication: 'accueil.explication.meilleure',
  proposition: 'generation.meilleure.proposition',
});

// La clé de la valeur absente, celle de la mise en forme.
const CLE_VIDE = 'format.vide';

// Les réponses de chaque question du dossier de travail, dans l'ordre où
// l'accueil les offre, et la clé de leur libellé : celles qu'admet
// facade.repondre (evenements.js).
const REPONSES = new Map([
  [
    'PORTABLE_NON_INSCRIPTIBLE',
    [
      { choix: 'reessayer', cle: 'accueil.question.reessayer' },
      { choix: 'documents', cle: 'accueil.question.documents' },
    ],
  ],
  [
    'DOCUMENTS_NON_INSCRIPTIBLE',
    [
      { choix: 'reessayer', cle: 'accueil.question.reessayer' },
      { choix: 'continuer', cle: 'accueil.question.continuer' },
    ],
  ],
]);

// Les secours d'un état illisible, dans l'ordre du § 8.8 — la version
// précédente, puis le dernier instant du journal —, et la clé de la commande
// qui l'ouvre.
const SECOURS = [
  { source: 'precedent', cle: 'communs.commande.ouvrirPrecedent' },
  { source: 'journal', cle: 'communs.commande.ouvrirJournal' },
];

/**
 * La clé du nom d'un état du plan ; null, celui d'un état illisible, rend
 * la clé de la valeur absente.
 *
 * @param {string|null} etat
 * @returns {string}
 * @throws {RangeError} un état hors de ETATS
 */
export function cleDEtat(etat) {
  if (etat === null) return CLE_VIDE;
  const cle = CLES_ETATS.get(etat);
  if (cle === undefined) throw new RangeError(`état du plan inconnu : ${JSON.stringify(etat)}`);
  return cle;
}

/**
 * Les signalements d'une ligne (§ 8.1, § 8.8), chacun { cle, details,
 * noms } : la traduction compose cle et details, et noms sont les données
 * qu'il nomme hors de son texte, que le composant rend chacune dans son
 * propre nœud (§ 14.6). ETAT_ILLISIBLE pour un état qui ne s'ouvre pas — un
 * journal sans état compris, de raison ABSENT —, avec la base, la raison et
 * les secours lus par la façade, et aucun nom à part ;
 * accueil.signalement.doublon pour un état dont d'autres bases portent
 * l'identifiant, avec leur nombre, et ces bases pour noms, dans l'ordre de la
 * façade. Un verrou présent ne se signale pas : seule la sonde d'une
 * opération dit si sa séance vit. Les détails, leurs secours compris, et les
 * noms sont des copies.
 *
 * @param {Object} ligne  LigneListe (evenements.js)
 * @returns {Array<{cle: string, details: Object, noms: string[]}>}
 */
export function signalementsDe(ligne) {
  const signalements = [];
  if (ligne.illisible !== null) {
    const { secours = null } = ligne.illisible;
    const details = { base: ligne.base, ...ligne.illisible, secours: secours === null ? null : { ...secours } };
    signalements.push({ cle: 'ETAT_ILLISIBLE', details, noms: [] });
  }
  if (ligne.doublonAvec.length > 0) {
    const noms = [...ligne.doublonAvec];
    signalements.push({ cle: 'accueil.signalement.doublon', details: { autres: noms.length }, noms });
  }
  return signalements;
}

/**
 * Les six informations d'une ligne (§ 8.1), les collisions cumulées de son
 * retenu et l'identifiant de la meilleure proposition de son classement,
 * mis en forme, et ses signalements. nom : celui inscrit dans le fichier, ou la base quand l'état
 * ne se lit pas ; date, participants et dernière modification par format,
 * la valeur absente quand ils manquent — la dernière modification est
 * l'horodatage de la dernière entrée du journal, sur l'horloge de
 * l'application, jamais la date du système de fichiers (§ 19.4) ; etat : la
 * clé de son nom, que le composant traduit ; chemin : tel que la façade
 * l'affiche, en entier.
 *
 * Les deux valeurs de résumé lisent resume, ce que facade.resumer a rendu
 * pour la ligne : collisionsCumulees, celles de mesuresDuRetenu, par format,
 * la valeur absente sans retenu mesurable — elles se lisent telles quelles,
 * jamais refaites ; meilleure.id, l'identifiant de meilleureDuClassement, par
 * format, la valeur absente sans proposition classée. Sans resume, la ligne
 * est enAttente : son résumé se calcule encore, et les deux valeurs valent la
 * valeur absente, que le composant remplace par le signe du chargement.
 *
 * @param {Object} ligne   LigneListe (evenements.js)
 * @param {ReturnType<import('../../application/format.js').creerFormat>} format
 * @param {{mesuresDuRetenu: {collisionsCumulees: number}|null,
 *          meilleureDuClassement: {id: number}|null}} [resume]
 * @returns {{nom: string, date: string, etat: string, participants: string,
 *            modification: string, chemin: string, enAttente: boolean,
 *            collisionsCumulees: string, meilleure: {id: string},
 *            signalements: Array<{cle: string, details: Object, noms: string[]}>}}
 */
export function ligneAffichee(ligne, format, resume) {
  return {
    nom: ligne.nom ?? ligne.base,
    date: ligne.date === null ? format.nombre(null) : format.date(ligne.date),
    etat: cleDEtat(ligne.etat),
    participants: format.nombre(ligne.participants),
    modification: ligne.derniereModification === null ? format.nombre(null) : format.horodatage(ligne.derniereModification),
    chemin: ligne.chemin,
    enAttente: resume === undefined,
    collisionsCumulees: format.nombre(resume?.mesuresDuRetenu?.collisionsCumulees ?? null),
    meilleure: { id: format.nombre(resume?.meilleureDuClassement?.id ?? null) },
    signalements: signalementsDe(ligne),
  };
}

/**
 * Les réponses qu'offre une question du dossier de travail (§ 8.6), dans
 * l'ordre : [{ choix, cle }], choix tel que facade.repondre le reçoit.
 *
 * @param {{code: string}} question
 * @returns {Array<{choix: string, cle: string}>}
 * @throws {RangeError} une question inconnue
 */
export function reponsesDe(question) {
  const reponses = REPONSES.get(question.code);
  if (reponses === undefined) throw new RangeError(`question inconnue : ${JSON.stringify(question.code)}`);
  return reponses.map((reponse) => ({ ...reponse }));
}

/**
 * Les secours lisibles d'un état illisible (§ 8.8), dans l'ordre : la
 * version précédente, puis le dernier instant du journal ; chacun { source,
 * cle }, source telle que seance.ouvrirSecours la reçoit. Aucun secours, ou
 * des secours non lus, rendent [].
 *
 * @param {{precedent: number|null, journal: number|null}|null|undefined} secours
 * @returns {Array<{source: 'precedent'|'journal', cle: string}>}
 */
export function secoursOfferts(secours) {
  if (secours === null || secours === undefined) return [];
  return SECOURS.filter(({ source }) => secours[source] !== null && secours[source] !== undefined).map((offert) => ({
    ...offert,
  }));
}

/**
 * Le refus d'un geste de la liste, tel que l'accueil l'affiche : le code et
 * les détails de l'erreur, son remède retiré. Sur la liste, aucun événement
 * n'est ouvert : un remède de la séance — débloquer, modifier, ouvrir un
 * secours — n'y aurait rien sur quoi agir, et le texte du refus dit déjà ce
 * qui le lève. Une erreur sans code n'est pas un refus : null.
 *
 * @param {unknown} erreur
 * @returns {{code: string, details: Object}|null}
 */
export function refusDeLaListe(erreur) {
  if (typeof erreur?.code !== 'string') return null;
  return { code: erreur.code, details: { ...(erreur.details ?? {}), remede: null } };
}

/**
 * Exécute une opération de la liste et rend ce qu'elle rend. Un refus
 * remonte tel que la liste l'affiche (refusDeLaListe) : { code, details },
 * sans remède. Toute autre erreur est une faute ou une panne, et remonte
 * telle quelle.
 *
 * @template T
 * @param {() => T|Promise<T>} operation
 * @returns {Promise<T>}
 */
export async function surLaListe(operation) {
  try {
    return await operation();
  } catch (erreur) {
    const refus = refusDeLaListe(erreur);
    if (refus === null) throw erreur;
    throw refus;
  }
}

// Le champ que désigne chaque refus d'un nom ou d'une date saisis.
const CHAMPS_DES_REFUS = new Map([
  ['NOM_REQUIS', 'nom'],
  ['DATE_INVALIDE', 'date'],
]);

/**
 * Le champ contre lequel un refus se pose : 'nom' pour NOM_REQUIS, 'date'
 * pour DATE_INVALIDE ; null pour tout autre refus, qui se pose contre la
 * commande, et sans refus.
 *
 * @param {{code: string}|null} refus
 * @returns {'nom'|'date'|null}
 */
export function champDuRefus(refus) {
  if (refus === null) return null;
  return CHAMPS_DES_REFUS.get(refus.code) ?? null;
}

// La saisie d'un nom de chaque opération qui en demande un (§ 8.7) : le
// data-champ de l'entrée, la clé de son étiquette, le data-commande et la
// clé du libellé de la commande qui valide.
const CLES_SAISIES = new Map([
  [
    'copier',
    {
      champ: 'nomCopie',
      etiquette: 'accueil.operation.nomCopie',
      commande: 'validerCopie',
      valider: 'accueil.operation.validerCopie',
    },
  ],
  [
    'renommer',
    {
      champ: 'nouveauNom',
      etiquette: 'accueil.operation.nouveauNom',
      commande: 'validerRenommage',
      valider: 'accueil.operation.validerRenommage',
    },
  ],
]);

/** Les opérations de la liste qui demandent un nom avant d'écrire. */
export const SAISIES = Object.freeze([...CLES_SAISIES.keys()]);

/**
 * La saisie d'un nom pour une opération (§ 8.7) : son champ, ses clés, et le
 * texte de départ — vide pour copier, qui demande un nom neuf plutôt que d'en
 * empiler un « (copie) » ; le nom inscrit pour renommer, vide quand l'état
 * ne se lit pas.
 *
 * @param {'copier'|'renommer'} operation
 * @param {string|null} nom  le nom inscrit dans le fichier
 * @returns {{champ: string, etiquette: string, commande: string, valider: string, texte: string}}
 * @throws {RangeError} une opération hors de SAISIES
 */
export function saisieDe(operation, nom) {
  const cles = CLES_SAISIES.get(operation);
  if (cles === undefined) throw new RangeError(`opération sans saisie : ${JSON.stringify(operation)}`);
  return { ...cles, texte: operation === 'renommer' ? (nom ?? '') : '' };
}

// Les séances dont le dossier de travail a déjà été annoncé.
const ANNONCEES = new WeakSet();

/**
 * Vrai la première fois qu'on le demande pour une séance, faux ensuite
 * (§ 8.6) : l'accueil annonce le dossier de travail — les avis de la
 * détermination — une fois par séance, et non à chaque retour à la liste.
 * La séance est un objet qui vit autant qu'elle, la façade d'App ; rien ne
 * survit à elle.
 *
 * @param {object} seance
 * @returns {boolean}
 * @throws {TypeError} une séance qui n'est pas un objet
 */
export function premiereAnnonce(seance) {
  if (seance === null || typeof seance !== 'object') throw new TypeError('premiereAnnonce : la séance est un objet');
  if (ANNONCEES.has(seance)) return false;
  ANNONCEES.add(seance);
  return true;
}

// --- La vue de la liste : filtres, résumé, groupes (§ 8.1, § 9) ------------------

/**
 * Les filtres de la liste, dans l'ordre de leurs tuiles : tous les
 * événements, puis chaque état du plan, dans l'ordre du § 9.
 */
export const FILTRES = Object.freeze(['tous', ...ETATS]);

// Le groupe des lignes dont l'état ne se lit pas : il suit les quatre états,
// et aucun filtre d'état ne le retient.
const ILLISIBLE = 'illisible';

// La clé du nom et celle de l'aide de chaque tuile ; le nom d'un état est
// celui de la colonne État, l'aide redit sa ligne du tableau du § 9.
const CLES_FILTRES = new Map([
  ['tous', { cle: 'accueil.filtre.tous', aide: 'accueil.filtre.aide.tous' }],
  ['brouillon', { cle: 'accueil.etat.brouillon', aide: 'accueil.filtre.aide.brouillon' }],
  ['propose', { cle: 'accueil.etat.propose', aide: 'accueil.filtre.aide.propose' }],
  ['retenu', { cle: 'accueil.etat.retenu', aide: 'accueil.filtre.aide.retenu' }],
  ['bloque', { cle: 'accueil.etat.bloque', aide: 'accueil.filtre.aide.bloque' }],
]);

// La clé de l'intitulé de chaque groupe par état : le nom de l'état, ou
// celui des états illisibles.
const CLES_GROUPES = new Map([...CLES_ETATS, [ILLISIBLE, 'accueil.groupe.illisible']]);

// La pastille de chaque tuile et de chaque groupe, telle que Pastille la
// reçoit : un état porte la sienne ; tous les événements, un statut
// d'information à l'icône de la liste ; les états illisibles, un avis à
// l'icône du triangle.
const PASTILLES = new Map([
  ['tous', { sorte: 'statut', valeur: 'information', icone: 'liste' }],
  ['brouillon', { sorte: 'etat', valeur: 'brouillon', icone: null }],
  ['propose', { sorte: 'etat', valeur: 'propose', icone: null }],
  ['retenu', { sorte: 'etat', valeur: 'retenu', icone: null }],
  ['bloque', { sorte: 'etat', valeur: 'bloque', icone: null }],
  [ILLISIBLE, { sorte: 'statut', valeur: 'avis', icone: 'triangle' }],
]);

// Les groupements de la liste, dans l'ordre de leur choix, et la clé du
// libellé de chacun.
const CLES_GROUPEMENTS = new Map([
  ['etat', 'accueil.groupement.etat'],
  ['aucun', 'accueil.groupement.aucun'],
]);

/** Les groupements de la liste : par état du plan, ou aucun. */
export const GROUPEMENTS = Object.freeze([...CLES_GROUPEMENTS.keys()]);

function exigerFiltre(filtre) {
  if (!FILTRES.includes(filtre)) throw new RangeError(`filtre de la liste inconnu : ${JSON.stringify(filtre)}`);
}

function exigerGroupement(groupement) {
  if (!CLES_GROUPEMENTS.has(groupement)) throw new RangeError(`groupement de la liste inconnu : ${JSON.stringify(groupement)}`);
}

// Le groupe d'une ligne : son état, ILLISIBLE sans état lu ; un état hors
// du § 9 lève, plutôt que de laisser la ligne hors de tout groupe.
function groupeDe(ligne) {
  if (ligne.etat === null) return ILLISIBLE;
  cleDEtat(ligne.etat);
  return ligne.etat;
}

// Vrai quand le filtre retient la ligne : tous les événements, ou ceux de
// son état. L'état se vérifie sous tout filtre.
function retient(filtre, ligne) {
  const groupe = groupeDe(ligne);
  return filtre === 'tous' || groupe === filtre;
}

/**
 * Les tuiles des filtres de la liste (§ 8.1, § 9), dans l'ordre de FILTRES :
 * chacune { filtre, cle, aide, compte, presse, pastille } — le filtre
 * qu'elle pose, la clé de son nom et celle de son aide, le nombre de lignes
 * qu'il retient, mis en forme, vrai pour la tuile du filtre courant, et sa
 * pastille ({ sorte, valeur, icone }, une copie). Une ligne illisible ne
 * compte que sous « tous ».
 *
 * @param {Object[]} lignes  LigneListe[] (evenements.js)
 * @param {string} filtre    le filtre courant, de FILTRES
 * @param {ReturnType<import('../../application/format.js').creerFormat>} format
 * @returns {Array<{filtre: string, cle: string, aide: string, compte: string, presse: boolean,
 *                  pastille: {sorte: string, valeur: string, icone: string|null}}>}
 * @throws {RangeError} un filtre hors de FILTRES
 */
export function tuilesDeLaListe(lignes, filtre, format) {
  exigerFiltre(filtre);
  return FILTRES.map((tuile) => ({
    filtre: tuile,
    ...CLES_FILTRES.get(tuile),
    compte: format.nombre(lignes.filter((ligne) => retient(tuile, ligne)).length),
    presse: tuile === filtre,
    pastille: { ...PASTILLES.get(tuile) },
  }));
}

/**
 * Le résumé de l'en-tête de la liste (§ 8.1), les détails de la clé
 * accueil.entete.resume : le nombre d'événements listés, et la somme des
 * participants qu'ils portent déjà — une ligne illisible, sans compte, n'en
 * apporte aucun. Rien ne se relit : la somme est celle des lignes reçues.
 *
 * @param {Object[]} lignes  LigneListe[] (evenements.js)
 * @returns {{evenements: number, participants: number}}
 */
export function resumeDeLaListe(lignes) {
  let participants = 0;
  for (const ligne of lignes) if (ligne.participants !== null) participants += ligne.participants;
  return { evenements: lignes.length, participants };
}

/**
 * Les groupes du tableau de la liste (§ 8.1, § 9), les lignes que le filtre
 * retient, chacune dans l'ordre de la façade : chacun { groupe, cle,
 * pastille, details, lignes }. Groupées par état, un groupe par état du
 * plan dans l'ordre du § 9, puis celui des états illisibles ; un groupe sans
 * ligne n'existe pas ; cle est la clé de son intitulé, details les détails
 * de accueil.groupe.compte. Sans groupement, un seul groupe, sans
 * intitulé : groupe, cle et pastille valent null. Sans ligne retenue, aucun
 * groupe : le composant dit que le filtre ne retient rien.
 *
 * @param {Object[]} lignes  LigneListe[] (evenements.js)
 * @param {string} filtre      de FILTRES
 * @param {string} groupement  de GROUPEMENTS
 * @returns {Array<{groupe: string|null, cle: string|null, pastille: Object|null,
 *                  details: {evenements: number}, lignes: Object[]}>}
 * @throws {RangeError} un filtre, un groupement, ou l'état d'une ligne inconnus
 */
export function groupesDeLaListe(lignes, filtre, groupement) {
  exigerFiltre(filtre);
  exigerGroupement(groupement);
  const retenues = lignes.filter((ligne) => retient(filtre, ligne));
  if (retenues.length === 0) return [];
  if (groupement === 'aucun') {
    return [{ groupe: null, cle: null, pastille: null, details: { evenements: retenues.length }, lignes: retenues }];
  }
  const groupes = [];
  for (const [groupe, cle] of CLES_GROUPES) {
    const siennes = retenues.filter((ligne) => groupeDe(ligne) === groupe);
    if (siennes.length === 0) continue;
    groupes.push({ groupe, cle, pastille: { ...PASTILLES.get(groupe) }, details: { evenements: siennes.length }, lignes: siennes });
  }
  return groupes;
}

/**
 * Les choix du groupement, dans l'ordre de GROUPEMENTS : chacun
 * { groupement, cle }, une copie.
 *
 * @returns {Array<{groupement: string, cle: string}>}
 */
export function choixDeGroupement() {
  return GROUPEMENTS.map((groupement) => ({ groupement, cle: CLES_GROUPEMENTS.get(groupement) }));
}

// La vue de la liste que chaque séance retient, et celle d'une séance qui
// n'en a retenu aucune.
const VUES = new WeakMap();
const VUE_PAR_DEFAUT = Object.freeze({ filtre: 'tous', groupement: 'etat' });

function exigerSeance(seance, quoi) {
  if (seance === null || typeof seance !== 'object') throw new TypeError(`${quoi} : la séance est un objet`);
}

/**
 * La vue de la liste que la séance retient (§ 8.1) : { filtre, groupement },
 * une copie ; tous les événements groupés par état tant qu'elle n'en a
 * retenu aucune. C'est un état d'interface : il survit à un retour à la
 * liste, jamais à la séance, et rien ne l'écrit. La séance est la façade
 * d'App, comme pour premiereAnnonce.
 *
 * @param {object} seance
 * @returns {{filtre: string, groupement: string}}
 * @throws {TypeError} une séance qui n'est pas un objet
 */
export function vueDeLaListe(seance) {
  exigerSeance(seance, 'vueDeLaListe');
  return { ...(VUES.get(seance) ?? VUE_PAR_DEFAUT) };
}

/**
 * Retient la vue de la liste pour la séance ; une copie, que vueDeLaListe
 * rend ensuite.
 *
 * @param {object} seance
 * @param {{filtre: string, groupement: string}} vue
 * @throws {TypeError} une séance qui n'est pas un objet
 * @throws {RangeError} un filtre ou un groupement inconnus ; rien n'est retenu
 */
export function retenirVue(seance, { filtre, groupement }) {
  exigerSeance(seance, 'retenirVue');
  exigerFiltre(filtre);
  exigerGroupement(groupement);
  VUES.set(seance, Object.freeze({ filtre, groupement }));
}
