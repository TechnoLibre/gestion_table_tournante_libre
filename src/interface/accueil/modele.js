// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'accueil, pur (§ 8.1, § 8.6, § 8.8) : ce que les composants
// de la liste des événements affichent, sans arithmétique ni texte. Une
// ligne de la liste (LigneListe de la façade, evenements.js) devient ses six
// informations et ses signalements, mis en forme, puis, son résumé reçu, les
// deux mesures de son retenu et la meilleure proposition de son
// classement ; une question du dossier de travail, ses réponses ; un état
// illisible, ses secours ; un refus de la façade, le refus affiché sur la
// liste. Chaque clé rendue est écrite ici en entier : aucun composant ne
// compose une clé.
import { COLONNE_ANNONCEE } from '../generation/meilleure.js';
import { COLONNES } from '../propositions/modele.js';

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
 * Les deux mesures du placement retenu qu'une ligne montre (§ 5.4, § 8.9),
 * dans l'ordre d'affichage : chacune { colonne, cle, explication } — le nom
 * de sa valeur dans ligneAffichee et son data-colonne, la clé de son
 * intitulé, celle de son explication, que l'infobulle de l'intitulé montre.
 */
export const COLONNES_DU_RETENU = Object.freeze(
  ['collisionsCumulees', 'diffRedondance'].map((colonne) =>
    Object.freeze({ colonne, cle: `accueil.colonne.${colonne}`, explication: `accueil.explication.${colonne}` }),
  ),
);

// La colonne du tableau des propositions que le bloc de la génération
// annonce : son intitulé et son explication.
const COLONNE_MEILLEURE = COLONNES.find(({ nom }) => nom === COLONNE_ANNONCEE);

/**
 * Les clés du bloc de la meilleure proposition du classement qu'une ligne
 * montre (§ 5.4, § 5.7), celles du bloc de la génération : titre,
 * explication du titre — ce que désigne le rang 1, et quand le bloc écrit
 * « — » —, libellé de l'identifiant, intitulé des collisions cumulées et
 * leur explication, celles de la colonne du tableau des propositions.
 */
export const MEILLEURE = Object.freeze({
  titre: 'generation.meilleure.titre',
  explication: 'accueil.explication.meilleure',
  proposition: 'generation.meilleure.proposition',
  collisions: COLONNE_MEILLEURE.cle,
  explicationCollisions: COLONNE_MEILLEURE.explication,
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
 * Les six informations d'une ligne (§ 8.1), les deux mesures de son retenu
 * et la meilleure proposition de son classement, mises en forme, et ses
 * signalements. nom : celui inscrit dans le fichier, ou la base quand l'état
 * ne se lit pas ; date, participants et dernière modification par format,
 * la valeur absente quand ils manquent — la dernière modification est
 * l'horodatage de la dernière entrée du journal, sur l'horloge de
 * l'application, jamais la date du système de fichiers (§ 19.4) ; etat : la
 * clé de son nom, que le composant traduit ; chemin : tel que la façade
 * l'affiche, en entier.
 *
 * Les quatre valeurs de résumé lisent resume, ce que facade.resumer a rendu
 * pour la ligne : collisionsCumulees et diffRedondance celles de
 * mesuresDuRetenu, par format, la valeur absente sans retenu mesurable — la
 * différence se lit telle quelle, jamais refaite ; meilleure, l'identifiant
 * et les collisions cumulées de meilleureDuClassement, par format, la valeur
 * absente l'un et l'autre sans proposition classée. Sans resume, la ligne
 * est enAttente : son résumé se calcule encore, et les quatre valeurs
 * valent la valeur absente, que le composant remplace par le signe du
 * chargement.
 *
 * @param {Object} ligne   LigneListe (evenements.js)
 * @param {ReturnType<import('../../application/format.js').creerFormat>} format
 * @param {{mesuresDuRetenu: Object|null, meilleureDuClassement: Object|null}} [resume]
 * @returns {{nom: string, date: string, etat: string, participants: string,
 *            modification: string, chemin: string, enAttente: boolean,
 *            collisionsCumulees: string, diffRedondance: string,
 *            meilleure: {id: string, collisions: string},
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
    diffRedondance: format.nombre(resume?.mesuresDuRetenu?.diffRedondance ?? null),
    meilleure: {
      id: format.nombre(resume?.meilleureDuClassement?.id ?? null),
      collisions: format.nombre(resume?.meilleureDuClassement?.collisionsCumulees ?? null),
    },
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
