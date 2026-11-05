// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La façade des événements (§ 8.1, § 8.6, § 8.7, § 8.8, § 15) : la
// détermination du dossier de travail, une fois par séance, ses avis et ses
// questions ; la liste des événements ; les opérations de fichiers de la
// liste — créer, charger une démonstration, copier, renommer, supprimer,
// importer — et les dialogues de fichiers, relayés tels quels. Elle est, avec
// la séance, le seul écrivain que l'interface atteint.
//
// La façade ne connaît pas la séance : elle reçoit de quoi savoir quel
// événement est ouvert, l'ouvrir, le fermer, en créer un, lire et poser le
// dossier de travail, et appelle chacun au moment du geste. Un événement s'y
// désigne par sa clé, <dossier>/<base> (cleEvenement), celle de sa ligne :
// chaque événement a son dossier dans le dossier de travail. Une primitive du
// système de fichiers se lit sur fs à l'appel, jamais à la création : une
// épreuve la remplace après le montage.
//
// Lister ne fait que lire, et n'évalue rien : la liste paraît sans attendre
// aucune évaluation. Les deux résumés d'une
// ligne — celui de son retenu (resumeDuRetenu, evaluation.js) et la
// meilleure proposition de son classement (resumeDuMeilleur) — viennent
// ensuite de resumer. Il lit d'abord l'aperçu de chaque événement,
// <base>.gtt-apercu.json (apercu.js), et le rend aussitôt : à jour quand son
// empreinte est celle des textes sur le disque, à vérifier sinon. Puis,
// pour les seuls événements sans aperçu à jour, un après l'autre, il relit
// l'état, examine la charge comme l'ouverture l'examine, la confie à
// l'exécuteur d'aperçu, qui calcule les deux résumés hors du fil de
// l'interface, écrit l'aperçu et rend la main entre deux événements. La
// liste n'écrit que l'aperçu, jamais l'état, le journal ni le verrou, y
// compris pour un événement qu'une autre séance tient : c'est un cache, que
// l'empreinte juge.
//
// Une opération qui écrit dérive ses refus lisibles sans écrire — nom vide,
// plan bloqué, format plus récent — avant toute écriture, sonde de verrou
// comprise. Renommer et supprimer ferment d'abord
// l'événement visé quand il est ouvert : la séance rend son verrou, et la
// façade sonde alors celui du disque sous son propre identifiant de séance,
// tiré une fois à sa création ; une séance vivante, ou dont la vie ne se
// prouve pas, qui tient l'événement le refuse. Un refus qui suit la fermeture
// rouvre l'événement, en lecture, tel qu'il était. Le dossier que
// l'événement quitte — l'ancien dossier d'un renommage, une fois le verrou
// rendu, celui d'un événement supprimé — se retire quand il est vide ; un
// dossier qui ne se vide pas reste, et l'avertissement DOSSIER_NON_RETIRE le
// dit sans défaire l'opération.
//
// Les libellés figés qu'elle écrit au journal — copie, renommage, chargement
// d'une démonstration, jalon de création, reprise — se composent par
// libelle, en français ; aucune autre chaîne visible n'en sort : refus, avis
// et questions sont des codes et leurs détails.
import { lireApercu, texteApercu } from '../stockage/apercu.js';
import {
  deverrouiller,
  empreinteDeLaCharge,
  lister as listerDepot,
  ouvrirAvecEmpreinte,
  ouvrir as ouvrirDepot,
  verrouiller,
} from '../stockage/depot.js';
import { determinerDossierTravail } from '../stockage/dossier_travail.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { decoderJournal, horodatageFinal } from '../stockage/journal.js';
import { SUFFIXES, cleEvenement, decouperCle } from '../stockage/noms.js';
import {
  chargerDemonstration as chargerSurDisque,
  copier as copierSurDisque,
  importer,
  importerDepuis,
  libelleDeLInstant,
  listerCorbeille,
  renommer as renommerSurDisque,
  retirerDossier,
  supprimer as supprimerSurDisque,
} from '../stockage/operations.js';
import { lireReglages } from '../stockage/reglages_locaux.js';
import { vueDossier } from '../stockage/systeme_fichiers.js';
import { refusNomEvenement } from './commandes.js';
import { ErreurCommande, refus } from './erreurs.js';
import { resumeDuMeilleur, resumeDuRetenu } from './evaluation.js';
import { libelle } from './libelles.js';

/** Sièges par défaut et tours d'un événement neuf (§ 2.1, étapes 4 et 5). */
export const SIEGES_PAR_DEFAUT = 8;
export const TOURS_PAR_DEFAUT = 4;

// Les réponses qu'admet chaque question du dossier de travail (§ 8.6).
const REPONSES = new Map([
  ['PORTABLE_NON_INSCRIPTIBLE', ['reessayer', 'documents']],
  ['DOCUMENTS_NON_INSCRIPTIBLE', ['reessayer', 'continuer']],
]);

// Ce que rend la façade d'un verrou présent qui ne se lit pas.
const VERROU_ILLISIBLE = Object.freeze({ seance: null, depuis: null });

/**
 * @typedef {import('../stockage/systeme_fichiers.js').Racine} Racine
 * @typedef {import('../stockage/dossier_travail.js').DossierTravail} DossierTravail
 * @typedef {{code: string, details: Object}} Avis
 */

// Les avis d'une détermination, dans cet ordre : la raison du repli en
// Documents, les avertissements de la règle, puis celui des réglages locaux
// illisibles, quand il y en a un.
function avisDe(dossier, avertissementReglages) {
  const avis = [];
  if (dossier.raison !== null) {
    avis.push({ code: dossier.raison, details: dossier.raison === 'SONDE_ECHOUEE' ? { cause: dossier.cause } : {} });
  }
  for (const code of dossier.avertissements) avis.push({ code, details: {} });
  if (avertissementReglages !== null) avis.push(avertissementReglages);
  return avis;
}

// Un nom saisi pour copier ou renommer : en NFC, ses blancs de bout
// retirés ; vide, NOM_REQUIS ; plus long que NOM_EVENEMENT_MAX caractères,
// NOM_EVENEMENT_TROP_LONG {longueur, maximum}, la règle de la création
// (refusNomEvenement). Ce qui n'est pas une chaîne est une faute du code.
function nomSaisi(nom) {
  if (typeof nom !== 'string') throw new TypeError(`nom : chaîne attendue, reçu ${JSON.stringify(nom)}`);
  const texte = nom.normalize('NFC').trim();
  if (texte === '') throw refus('NOM_REQUIS');
  const tropLong = refusNomEvenement(texte);
  if (tropLong !== null) throw tropLong;
  return texte;
}

// Le chemin affichable, en entier, du chemin relatif d'une racine : ses
// segments joints au séparateur du système.
function cheminAffiche(racine, separateur, relatif) {
  const tete = racine.chemin.endsWith(separateur) ? racine.chemin : racine.chemin + separateur;
  return tete + relatif.split('/').join(separateur);
}

// L'avertissement d'un dossier que l'événement a quitté et qui reste sur le
// disque, d'après ce que rend retirerDossier : son chemin affichable et la
// cause du refus de le retirer.
function dossierNonRetire(racine, separateur, { dossier, cause }) {
  return { code: 'DOSSIER_NON_RETIRE', details: { dossier: cheminAffiche(racine, separateur, dossier), cause } };
}

// Un refus de la couche qui le lève : une erreur dont l'interface lit le
// code et les détails. Toute autre erreur est une faute ou une panne.
const estRefus = (erreur) => erreur instanceof ErreurStockage || erreur instanceof ErreurCommande;

// Le refus d'un événement qu'aucun geste de la liste ne doit réécrire : un
// format plus récent, puis un plan bloqué, que « Débloquer » rend
// modifiable.
function exigerModifiable({ formatPlusRecent, charge }) {
  if (formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT_PLUS_RECENT', remede: null });
  if (charge.evenement.etat === 'bloque') {
    throw new ErreurStockage('LECTURE_SEULE', { raison: 'BLOQUE', remede: { geste: 'debloquer' } });
  }
}

// L'horodatage de la dernière entrée du journal de base, dans le dossier
// que lit fs, tel que l'horloge de l'application qui l'a écrite l'a noté
// (§ 19.4), lu depuis la fin du texte par horodatageFinal, la ligne
// d'ouverture seule lue en tête, sans contrôler la forme des lignes qui
// précèdent l'entrée ni aucun instantané ; null sans journal, sans entrée
// lisible, ou quand le fichier ne se lit pas. Un journal dont une ligne
// n'est pas de l'UTF-8 se lit jusqu'à elle, comme à l'ouverture.
async function derniereModification(fs, racine, base) {
  if (base === null) return null;
  let texte;
  try {
    texte = await fs.lireTexte(racine, base + SUFFIXES.journal);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code !== 'LECTURE' || erreur.details.cause !== 'UTF8_INVALIDE') return null;
    texte = decoderJournal(erreur.details.octets).texte;
  }
  if (texte === null) return null;
  return horodatageFinal(texte);
}

// Les deux résumés d'un événement : mesuresDuRetenu (resumeDuRetenu) et
// meilleureDuClassement (resumeDuMeilleur). AUCUN_RESUME est celui d'un état
// qui ne se lit pas — illisible au relevé du dépôt, ou depuis : la ligne en
// porte déjà la cause, ou la portera à la liste suivante —, et celui que la
// liste montre pour un événement dont le calcul a fauté.
const AUCUN_RESUME = Object.freeze({ mesuresDuRetenu: null, meilleureDuClassement: null });

// La charge de l'événement de clé cle telle que l'ouverture la lit, sans rien
// écrire (ouvrir du dépôt, § 8.8) : un journal en avance d'une entrée la
// rattrape en mémoire, par la règle de rattraper, et examiner (§ 8.9, point
// 3) en écarte une proposition fautive, dont l'identifiant se répète ou
// atteint le compteur — le classement lève sur un identifiant répété. La
// liste nomme ainsi la proposition au rang 1 que le bloc de génération de
// l'événement ouvert nomme (§ 8.1). Rend { charge, empreinte }, empreinte
// celle des textes d'où vient cette charge (ouvrirAvecEmpreinte) ; null pour
// un état absent ou qui ne s'ouvre pas.
async function chargeExaminee(fs, racine, cle) {
  try {
    const { ouvert, empreinte } = await ouvrirAvecEmpreinte(fs, racine, cle);
    return { charge: ouvert.charge, empreinte };
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) return null;
    throw erreur;
  }
}

// L'exécuteur d'aperçu sans travailleur : les deux résumés calculés sur le
// fil, par les fonctions d'evaluation.js.
const CALCUL_SUR_LE_FIL = Object.freeze({
  calculer: async (charge) => ({ mesuresDuRetenu: resumeDuRetenu(charge), meilleureDuClassement: resumeDuMeilleur(charge) }),
  terminer() {},
});

// L'aperçu de l'événement de clé cle, dans racine, pour la construction
// produitVersion : { resume, aJour } — resume, ses deux résumés ; aJour,
// vrai quand son empreinte est celle des textes sur le disque
// (empreinteDeLaCharge). null quand l'aperçu manque ou vaut absent
// (lireApercu), ou que sa lecture est refusée : l'empreinte ne se lit alors
// pas. Un refus du stockage pendant la lecture de l'empreinte rend l'aperçu
// à vérifier. Toute autre erreur remonte.
async function apercuLu(fs, racine, cle, produitVersion) {
  let texte;
  try {
    const { dossier, base } = decouperCle(cle);
    texte = await vueDossier(fs, dossier).lireTexte(racine, base + SUFFIXES.apercu);
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) return null;
    throw erreur;
  }
  const apercu = lireApercu(texte, produitVersion);
  if (apercu === null) return null;
  let empreinte;
  try {
    empreinte = await empreinteDeLaCharge(fs, racine, cle);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    empreinte = null;
  }
  const { mesuresDuRetenu, meilleureDuClassement } = apercu;
  return { resume: { mesuresDuRetenu, meilleureDuClassement }, aJour: empreinte !== null && empreinte === apercu.empreinte };
}

// Écrit le texte d'aperçu de l'événement de clé cle dans son dossier, par
// une écriture atomique. Un refus du stockage — dossier en lecture seule,
// support retiré — se tait : l'aperçu n'est qu'un cache. Toute autre erreur
// remonte.
async function ecrireApercu(fs, racine, cle, texte) {
  try {
    const { dossier, base } = decouperCle(cle);
    await vueDossier(fs, dossier).ecrireAtomique(racine, base + SUFFIXES.apercu, texte);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
  }
}

// Pourquoi l'état d'un résumé illisible ne s'ouvre pas : les détails de
// l'ETAT_ILLISIBLE qu'ouvrir lève — raison, chemin, format quand il en nomme
// un, et les secours lisibles —, sans rien écrire. Un état redevenu lisible,
// ou disparu, depuis la liste du dépôt garde la raison du résumé, sans
// secours.
async function illisibleDe(fs, racine, { cle, illisible }) {
  if (illisible === null) return null;
  try {
    await ouvrirDepot(fs, racine, cle);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code === 'ETAT_ILLISIBLE') return { ...erreur.details };
  }
  return { raison: illisible, secours: null };
}

// Le .gtt.verrou de base, dans le dossier que lit fs, lu sans rien écrire :
// sa séance et l'instant de sa prise ; null quand il manque ; seance et
// depuis null quand il ne se lit pas. Seule une sonde, qui écrit, dit si sa
// séance vit.
async function verrouDe(fs, racine, base) {
  let texte;
  try {
    texte = await fs.lireTexte(racine, base + SUFFIXES.verrou);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    return erreur.code === 'ABSENT' ? null : { ...VERROU_ILLISIBLE };
  }
  let contenu;
  try {
    contenu = JSON.parse(texte);
  } catch {
    contenu = null;
  }
  const lu = contenu !== null && typeof contenu === 'object' && typeof contenu.seance === 'string' && typeof contenu.depuis === 'string';
  return lu ? { seance: contenu.seance, depuis: contenu.depuis } : { ...VERROU_ILLISIBLE };
}

/**
 * La façade des événements, branchée par App sur la séance.
 *
 * @param {Object} parametres
 * @param {import('../stockage/systeme_fichiers.js').SystemeFichiers} parametres.fs
 * @param {import('./horloge.js').Horloge} parametres.horloge
 * @param {() => string} parametres.identifiant   tiré une fois à la création,
 *        pour la séance sous laquelle la façade sonde les verrous, puis une
 *        fois par événement qu'elle copie ou charge
 * @param {string} parametres.produitVersion
 * @param {Array<{cle: string, nom: string, texte: string}>} parametres.demonstrations
 * @param {() => string|null} parametres.ouvert          clé de l'événement ouvert
 * @param {(cle: string, annonce?: {avertissements: Array<{code: string, details: Object}>}) => Promise<unknown>} parametres.ouvrir
 *        en lecture ; annonce.avertissements, ceux qu'une opération que le
 *        disque ne garde pas confie à l'ouverture, que la séance annonce
 *        parmi ceux de son dernier geste
 * @param {() => Promise<unknown>} parametres.fermer
 * @param {(champs: Object) => Promise<{cle: string, base: string}>} parametres.creer
 *        celle de la séance, qui juge nom et date et ouvre l'événement créé
 * @param {() => Racine|null} parametres.racine          le dossier de travail
 * @param {(racine: Racine) => Promise<unknown>} parametres.changerRacine
 * @param {{calculer: (charge: Object) => Promise<{mesuresDuRetenu: Object|null, meilleureDuClassement: Object|null}>, terminer: () => void}|null} [parametres.executeurApercu]
 *        calcule les deux résumés d'une charge examinée hors du fil de
 *        l'interface, et rejette par une faute ; terminer appartient à
 *        celui qui l'a créé. Absent ou null, le calcul se fait sur le fil
 */
export function creerFacade({
  fs,
  horloge,
  identifiant,
  produitVersion,
  demonstrations,
  ouvert,
  ouvrir,
  fermer,
  creer,
  racine,
  changerRacine,
  executeurApercu = null,
}) {
  const seance = identifiant();
  const calcul = executeurApercu ?? CALCUL_SUR_LE_FIL;
  const libelleReprise = libelle('ENTREE_REPRISE');
  const nomJalon = libelle('JALON_CREATION');

  // resultat : la dernière détermination aboutie, {dossier, avis} ; enCours :
  // la promesse de celle qui se fait, null sinon.
  let resultat = null;
  let enCours = null;

  // La règle du § 8.6, puis les réglages locaux du dossier retenu, lus une
  // fois ; la racine se pose quand aucune question n'attend. Un rejet ne
  // retient rien.
  async function determiner() {
    const dossier = await determinerDossierTravail(fs);
    const { avertissement } = await lireReglages(fs, dossier.racine);
    const issue = { dossier, avis: avisDe(dossier, avertissement) };
    if (dossier.question === null) await changerRacine(dossier.racine);
    resultat = issue;
    return issue;
  }

  function demarrer() {
    if (resultat !== null) return Promise.resolve(resultat);
    if (enCours === null) {
      enCours = determiner().finally(() => {
        enCours = null;
      });
    }
    return enCours;
  }

  // Le dossier de travail d'une opération : la détermination en cours
  // attendue ; QUESTION_EN_ATTENTE tant qu'une question attend sa réponse.
  async function exigerDossier() {
    if (enCours !== null) await enCours.catch(() => undefined);
    const question = resultat?.dossier.question ?? null;
    if (question !== null) throw refus('QUESTION_EN_ATTENTE', { question: question.code });
    const courante = racine();
    if (courante === null) throw new RangeError("façade : aucun dossier de travail, demarrer n'a pas abouti");
    return courante;
  }

  async function repondre(choix) {
    const question = resultat?.dossier.question ?? null;
    if (question === null) throw new RangeError('repondre : aucune question du dossier de travail n’attend');
    if (!REPONSES.get(question.code).includes(choix)) {
      throw new RangeError(`repondre : ${JSON.stringify(choix)} ne répond pas à ${question.code}`);
    }
    if (choix === 'reessayer') {
      resultat = null;
      return demarrer();
    }
    const { dossier, avis } = resultat;
    let importe = null;
    let suite = { ...dossier, question: null };
    if (choix === 'documents') {
      // data/ illisible, compte null : rien à copier.
      const cles = question.evenements === null ? [] : (await listerDepot(fs, question.racine)).map(({ cle }) => cle);
      importe = await importerDepuis(fs, question.racine, dossier.racine, cles);
      suite = { ...suite, autre: null };
    }
    await changerRacine(suite.racine);
    resultat = { dossier: suite, avis };
    return importe === null ? resultat : { ...resultat, importe };
  }

  async function lister() {
    const courante = await exigerDossier();
    const resumes = await listerDepot(fs, courante);
    const { separateur } = await fs.emplacements();
    const lignes = [];
    for (const resume of resumes) {
      const { cle, dossier, base, id, doublon } = resume;
      const local = vueDossier(fs, dossier);
      lignes.push({
        cle,
        base,
        id,
        nom: resume.nom,
        date: resume.date,
        etat: resume.etat,
        participants: resume.participants,
        derniereModification: await derniereModification(local, courante, resume.journal),
        chemin: cheminAffiche(courante, separateur, `${dossier}/${base}${SUFFIXES.etat}`),
        illisible: await illisibleDe(fs, courante, resume),
        journalSeul: resume.illisible === 'ABSENT',
        doublonAvec: doublon
          ? resumes.filter((autre) => autre !== resume && autre.doublon && autre.id === id).map((autre) => autre.cle)
          : [],
        verrou: await verrouDe(local, courante, base),
      });
    }
    return lignes;
  }

  // Les résumés des lignes, dans le dossier de travail de l'appel. Ceux des
  // états illisibles se reçoivent aussitôt, à jour. Puis, après une
  // microtâche, l'aperçu de chaque ligne lisible, dans l'ordre des lignes,
  // sans pas : un aperçu présent se reçoit tout de suite, à jour ou à
  // vérifier. Puis chaque ligne sans aperçu à jour, un pas chacune : le pas
  // attend ceder(), lit la charge et son empreinte, confie la charge à
  // l'exécuteur, compose l'aperçu, l'écrit, puis reçoit le résumé, à jour.
  // Abandonné, le flux ne lit, ne calcule, n'écrit ni ne reçoit plus rien ;
  // le calcul ou l'écriture en cours s'achève sans se recevoir. Une faute
  // d'un événement — lecture, calcul, résumé que l'aperçu refuse — lui donne
  // AUCUN_RESUME, à jour, sans aperçu ; le flux continue, et fin rejette la
  // première une fois le flux arrêté. Une faute de l'écriture laisse le
  // résumé se recevoir.
  // Les flux de resumer en cours, chacun avec l'écriture d'aperçu qu'il
  // attend, ou null. renommer et supprimer les arrêtent (arreterResumes)
  // avant de toucher au disque : un aperçu ne s'écrit jamais dans un dossier
  // que l'opération vide.
  const flux = new Set();

  // Abandonne chaque flux en cours, puis attend l'écriture d'aperçu que
  // chacun a déjà lancée ; une écriture fautive ne retient pas l'opération,
  // le flux la rejette par fin.
  async function arreterResumes() {
    const enCours = [...flux];
    for (const suivi of enCours) suivi.abandonner();
    await Promise.all(enCours.map(({ ecriture }) => ecriture?.catch(() => undefined)));
  }

  function resumer(lignes, { ceder, recevoir }) {
    const courante = racine();
    if (courante === null) throw new RangeError("resumer : aucun dossier de travail, demarrer n'a pas abouti");
    let abandonne = false;
    const suivi = {
      ecriture: null,
      abandonner() {
        abandonne = true;
      },
    };
    flux.add(suivi);
    for (const { cle, illisible } of lignes) if (illisible !== null) recevoir(cle, AUCUN_RESUME, { aJour: true });
    const lisibles = lignes.filter(({ illisible }) => illisible === null).map(({ cle }) => cle);
    async function parcourir() {
      let faute = null;
      // Une microtâche d'abord : un abandon qui suit l'appel ne lit rien.
      await Promise.resolve();
      const aCalculer = [];
      for (const cle of lisibles) {
        if (abandonne) break;
        let lu = null;
        try {
          lu = await apercuLu(fs, courante, cle, produitVersion);
        } catch (erreur) {
          faute ??= erreur;
        }
        if (abandonne) break;
        if (lu !== null) recevoir(cle, lu.resume, { aJour: lu.aJour });
        if (lu === null || !lu.aJour) aCalculer.push(cle);
      }
      for (const cle of abandonne ? [] : aCalculer) {
        await ceder();
        if (abandonne) break;
        let resume = AUCUN_RESUME;
        let texte = null;
        try {
          const lue = await chargeExaminee(fs, courante, cle);
          if (abandonne) break;
          if (lue !== null) {
            const { mesuresDuRetenu, meilleureDuClassement } = await calcul.calculer(lue.charge);
            texte = texteApercu({ produitVersion, empreinte: lue.empreinte, mesuresDuRetenu, meilleureDuClassement });
            resume = { mesuresDuRetenu, meilleureDuClassement };
          }
        } catch (erreur) {
          faute ??= erreur;
        }
        if (abandonne) break;
        if (texte !== null) {
          try {
            suivi.ecriture = ecrireApercu(fs, courante, cle, texte);
            await suivi.ecriture;
          } catch (erreur) {
            faute ??= erreur;
          } finally {
            suivi.ecriture = null;
          }
        }
        if (abandonne) break;
        recevoir(cle, resume, { aJour: true });
      }
      if (faute !== null) throw faute;
    }
    return {
      abandonner: suivi.abandonner,
      fin: parcourir().finally(() => flux.delete(suivi)),
    };
  }

  // Le verrou de l'événement cible pris sous la séance de la façade, daté de
  // l'horloge lue une fois. Le sien, resté d'un rendu refusé, est déjà pris ;
  // celui d'une séance morte (vivant faux) s'efface en son nom, puis se
  // prend ; tout autre lève VERROU_PRIS, sans rien changer.
  async function prendreVerrou(cible) {
    const depuis = horloge.horodatage();
    let verrou = await verrouiller(cible, seance, depuis);
    if (!verrou.pris && verrou.seance === seance) return;
    if (!verrou.pris && verrou.vivant === false) {
      await deverrouiller(cible, verrou.seance);
      verrou = await verrouiller(cible, seance, depuis);
    }
    if (!verrou.pris) {
      const { seance: tenue, depuis, vivant } = verrou;
      throw new ErreurStockage('VERROU_PRIS', { seance: tenue, depuis, vivant, remede: null });
    }
  }

  // Après le refus d'une opération qui a fermé l'événement de clé cle, le
  // rouvre en lecture ; une panne, qui n'est pas un refus, laisse tout. Un
  // échec de cette réouverture ne masque pas le refus.
  async function rouvrirApresRefus(cle, etaitOuvert, erreur) {
    if (etaitOuvert && estRefus(erreur)) await ouvrir(cle).catch(() => undefined);
  }

  async function creerEvenement({ nom, date = null }) {
    await exigerDossier();
    return creer({ nom, date, siegesParDefaut: SIEGES_PAR_DEFAUT, tours: TOURS_PAR_DEFAUT });
  }

  async function chargerDemonstration(cle) {
    const demonstration = demonstrations.find((candidate) => candidate.cle === cle);
    if (demonstration === undefined) throw new RangeError(`aucune démonstration de clé ${JSON.stringify(cle)}`);
    const courante = await exigerDossier();
    const charge = await chargerSurDisque(fs, courante, demonstration.texte, {
      id: identifiant(),
      libelle: libelle('ENTREE_DEMONSTRATION', { nom: demonstration.nom }),
      nomJalon,
      horodatage: horloge.horodatage(),
      produitVersion,
    });
    const chargee = cleEvenement(charge.dossier, charge.base);
    await ouvrir(chargee);
    return { cle: chargee, base: charge.base };
  }

  // Une source d'un format plus récent ne se copie pas : la LECTURE_SEULE du
  // dépôt se relaie avec remede null, comme les refus propres de la façade.
  // Les avertissements rendus sont ceux de la recopie des logos : la copie se
  // rouvre par la séance, qui relit les autres sur le disque, et reçoit
  // ceux-là d'ouvrir, qui les annonce une fois la copie ouverte.
  async function copier(cle, { nom }) {
    const texte = nomSaisi(nom);
    const courante = await exigerDossier();
    const source = await ouvrirDepot(fs, courante, cle);
    // L'instant copié, par la règle même qui l'inscrit à la filiation.
    const instant = libelleDeLInstant(source, libelleReprise);
    let copie;
    try {
      copie = await copierSurDisque(source, {
        id: identifiant(),
        nom: texte,
        libelle: libelle('ENTREE_COPIE', { source: source.charge.evenement.nom, instant }),
        nomJalon,
        horodatage: horloge.horodatage(),
        produitVersion,
        libelleReprise,
      });
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'LECTURE_SEULE') {
        throw new ErreurStockage('LECTURE_SEULE', { ...erreur.details, remede: null });
      }
      throw erreur;
    }
    const cleCopie = cleEvenement(copie.dossier, copie.base);
    const avertissements = copie.avertissements.filter(({ code }) => code === 'LOGOS_NON_COPIES');
    await ouvrir(cleCopie, { avertissements });
    return { cle: cleCopie, base: copie.base, avertissements };
  }

  async function renommer(cle, { nom }) {
    const texte = nomSaisi(nom);
    const courante = await exigerDossier();
    exigerModifiable(await ouvrirDepot(fs, courante, cle));
    await arreterResumes();
    const etaitOuvert = ouvert() === cle;
    if (etaitOuvert) await fermer();
    // Le verrou de l'événement, dans son dossier, par sa vue.
    const { dossier, base } = decouperCle(cle);
    const cible = { fs: vueDossier(fs, dossier), racine: courante, base };
    let renomme;
    try {
      await prendreVerrou(cible);
      try {
        // Relu sous le verrou : une autre séance a pu l'écrire depuis.
        const source = await ouvrirDepot(fs, courante, cle);
        exigerModifiable(source);
        renomme = await renommerSurDisque(source, {
          nom: texte,
          libelle: libelle('ENTREE_RENOMMER', { ancien: source.charge.evenement.nom, nom: texte }),
          horodatage: horloge.horodatage(),
          produitVersion,
          libelleReprise,
        });
      } catch (erreur) {
        await deverrouiller(cible, seance).catch(() => undefined);
        throw erreur;
      }
    } catch (erreur) {
      await rouvrirApresRefus(cle, etaitOuvert, erreur);
      throw erreur;
    }
    // Le renommage fait, un verrou qui ne se rend pas le dit sans le défaire ;
    // puis l'ancien dossier, quand l'événement l'a quitté, se retire, ou le
    // dit.
    const avertissements = [];
    try {
      await deverrouiller(cible, seance);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      avertissements.push({ code: 'VERROU_NON_RENDU', details: erreur.details });
    }
    if (renomme.dossier !== dossier) {
      const reste = await retirerDossier(fs, courante, dossier);
      if (reste !== null) avertissements.push(dossierNonRetire(courante, (await fs.emplacements()).separateur, reste));
    }
    const cleRenomme = cleEvenement(renomme.dossier, renomme.base);
    if (etaitOuvert) await ouvrir(cleRenomme);
    return { cle: cleRenomme, base: renomme.base, avertissements };
  }

  async function supprimer(cle) {
    const courante = await exigerDossier();
    await arreterResumes();
    const etaitOuvert = ouvert() === cle;
    if (etaitOuvert) await fermer();
    try {
      const horodatage = horloge.horodatage();
      const { dossier, nonRetire } = await supprimerSurDisque(fs, courante, cle, { horodatage, seance });
      const { separateur } = await fs.emplacements();
      return { dossier, avertissements: nonRetire === null ? [] : [dossierNonRetire(courante, separateur, nonRetire)] };
    } catch (erreur) {
      await rouvrirApresRefus(cle, etaitOuvert, erreur);
      if (erreur instanceof ErreurStockage && erreur.code === 'VERROU_PRIS') {
        throw new ErreurStockage('VERROU_PRIS', { ...erreur.details, remede: null });
      }
      throw erreur;
    }
  }

  async function corbeille() {
    const courante = await exigerDossier();
    const { separateur } = await fs.emplacements();
    return (await listerCorbeille(fs, courante)).map(({ dossier, fichiers }) => ({
      dossier,
      chemin: cheminAffiche(courante, separateur, dossier),
      fichiers: fichiers.map((fichier) => fichier.split('/').join(separateur)),
    }));
  }

  async function importerFichier() {
    const courante = await exigerDossier();
    const choisi = await fs.choisirFichierAImporter();
    if (choisi === null) return null;
    return importer(fs, courante, choisi.octets);
  }

  async function importerDepuisAutre() {
    const vers = await exigerDossier();
    const autre = resultat.dossier.autre;
    if (autre === null) throw new RangeError("importerDepuisAutre : l'autre emplacement ne propose rien");
    const cles = (await listerDepot(fs, autre.racine)).map(({ cle }) => cle);
    const importe = await importerDepuis(fs, autre.racine, vers, cles);
    resultat = { ...resultat, dossier: { ...resultat.dossier, autre: null } };
    return importe;
  }

  function explorateur() {
    return fs.nature === 'web'
      ? { disponible: false, raison: 'EXPLORATEUR_ABSENT' }
      : { disponible: true, raison: null };
  }

  async function ouvrirExplorateur() {
    if (fs.nature === 'web') throw refus('EXPLORATEUR_ABSENT');
    return fs.ouvrirDansExplorateur(await exigerDossier());
  }

  return {
    /**
     * La détermination du dossier de travail, une fois par séance (§ 8.6) :
     * { dossier, avis }, le même tant qu'aucune réponse ne la refait. Une
     * détermination qui rejette ne retient rien, et l'appel suivant la refait.
     * @returns {Promise<{dossier: DossierTravail, avis: Avis[]}>}
     */
    demarrer,
    /**
     * La réponse à la question du dossier de travail : comme demarrer ;
     * 'documents' rend aussi importe, ce que la copie de data/ a importé,
     * refusé et annoncé (importerDepuis). RangeError sans question, ou pour
     * un choix qu'elle n'admet pas.
     * @param {'reessayer'|'documents'|'continuer'} choix
     */
    repondre,
    /**
     * Les lignes de la liste (§ 8.1), dans l'ordre du dépôt, telles que le
     * relevé du dépôt les donne ; n'écrit rien, et n'évalue rien : leurs
     * résumés viennent de resumer. Chaque ligne porte la clé de son
     * événement, qui l'identifie, sa base, et le chemin affichable de son
     * état, dans son dossier ; doublonAvec, les clés des autres lignes du
     * même identifiant.
     */
    lister,
    /**
     * Les résumés des lignes de lister (§ 8.1) : recevoir(cle, {
     * mesuresDuRetenu, meilleureDuClassement }, { aJour }) — resumeDuRetenu
     * et resumeDuMeilleur de sa charge examinée, chacun null sans retenu
     * mesurable ou sans proposition classée, l'un et l'autre null pour un
     * état illisible. Une ligne illisible reçoit le sien avant le retour, à
     * jour. Chaque ligne lisible dont l'aperçu existe reçoit ensuite le sien
     * sans attendre de pas : aJour vrai quand son empreinte est celle des
     * textes sur le disque, faux sinon — l'ancien chiffre, à vérifier ; sans
     * aperçu, rien avant son pas. Chaque ligne sans aperçu à jour attend
     * ensuite la promesse de ceder(), relit son état, se calcule par
     * l'exécuteur d'aperçu, écrit son aperçu, seule écriture de la liste,
     * puis reçoit son résumé, à jour : une ligne à vérifier reçoit ainsi
     * deux fois. Un aperçu à jour ne se recalcule jamais. Une écriture
     * refusée par le stockage se tait. abandonner() arrête le flux : plus
     * rien ne se lit, ne se calcule, ne s'écrit ni ne se reçoit ; renommer
     * et supprimer arrêtent ainsi chaque flux en cours, et attendent
     * l'écriture déjà lancée, avant de toucher au disque. fin se résout
     * quand le flux s'arrête, et rejette par la première faute : celle d'un
     * calcul, dont la ligne a reçu les deux résumés à null, sans aperçu
     * écrit, ou celle d'une lecture ou d'une écriture d'aperçu, qui ne
     * retient pas le résumé. RangeError sans dossier de travail.
     *
     * @param {Array<{cle: string, illisible: object|null}>} lignes
     * @param {{ceder: () => Promise<unknown>, recevoir: (cle: string, resume: Object, marque: {aJour: boolean}) => void}} rappels
     * @returns {{abandonner: () => void, fin: Promise<void>}}
     */
    resumer,
    /** Crée et ouvre en lecture l'événement { nom, date } (§ 2.1, étape 1). */
    creer: creerEvenement,
    /** Charge la démonstration de clé donnée sous « ‹nom› N », ouverte en lecture → { cle, base } (§ 15). */
    chargerDemonstration,
    /**
     * Copie l'événement de clé cle sous le nom donné, logos compris, et ouvre
     * la copie en lecture → { cle, base, avertissements } (§ 8.7) :
     * LOGOS_NON_COPIES {evenement, logos, personnes, imageBadges} quand un
     * logo ne s'est pas recopié, sans défaire la copie.
     */
    copier,
    /**
     * Renomme l'événement de clé cle ; ouvert, il se rouvre en lecture sous
     * sa nouvelle clé → { cle, base, avertissements } (§ 8.7) :
     * VERROU_NON_RENDU, puis DOSSIER_NON_RETIRE {dossier, cause} quand
     * l'ancien dossier reste, chacun sans défaire le renommage.
     */
    renommer,
    /**
     * Déplace le contenu du dossier de l'événement de clé cle dans la
     * corbeille datée, puis retire le dossier → { dossier, avertissements },
     * DOSSIER_NON_RETIRE {dossier, cause} quand il reste (§ 8.7).
     */
    supprimer,
    /**
     * Le contenu de la corbeille : [{ dossier, chemin, fichiers }], chaque
     * fichier par son chemin relatif à son dossier daté, au séparateur du
     * système (§ 8.7).
     */
    corbeille,
    /**
     * Importe le fichier d'événement que l'opérateur choisit → { cle, base },
     * ou null (§ 8.7) ; un fichier seul n'emporte aucun logo.
     */
    importerFichier,
    /**
     * Copie dans le dossier de travail les événements de l'autre emplacement,
     * logos compris → { importes, refuses, avertissements } (importerDepuis,
     * § 8.6, § 8.7).
     */
    importerDepuisAutre,
    /** Le dialogue de choix d'un fichier, relayé : { nom, octets } ou null. */
    choisirCsv: () => fs.choisirFichierAImporter(),
    /**
     * Le dialogue de choix d'une image, relayé sous le genre image : { nom,
     * octets } ou null ; TROP_VOLUMINEUX, sans rien lire, au-delà de
     * LOGO_SOURCE_MAX_OCTETS (§ 8.6).
     */
    choisirImage: () => fs.choisirFichierAImporter({ genre: 'image' }),
    /** Le dialogue d'enregistrement, relayé : le chemin choisi, ou null. */
    enregistrerSous: (nomPropose, octets) => fs.enregistrerSous(nomPropose, octets),
    /** { disponible, raison } : raison EXPLORATEUR_ABSENT sous web (§ 8.6). */
    explorateur,
    /** Montre le dossier de travail dans l'explorateur du système. */
    ouvrirExplorateur,
  };
}
