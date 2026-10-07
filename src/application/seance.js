// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La séance (§ 8.1, § 8.3, § 8.4, § 8.5, § 8.6, § 8.8) : elle tient un seul
// événement ouvert, ferme le précédent sans question, et l'ouvre toujours en
// lecture ; ouvrir n'écrit rien. Le mode — lecture ou écriture — est une
// posture de la séance, jamais écrite dans le fichier. Passer en écriture
// prend le verrou de l'événement ; revenir en lecture, par la commande ou au
// terme de l'inactivité, le rend.
//
// Un geste est une commande nommée (commandes.js) : la charge qu'elle rend
// s'enregistre par le dépôt, le journal d'abord, l'état ensuite (§ 8.2) ; un
// geste refusé n'écrit rien. Défaire, refaire et revenir restituent un
// instant du journal et l'écrivent comme une entrée de retour, sans jamais
// tronquer le journal (§ 8.3). Les jalons automatiques nomment la création,
// chaque changement d'état, et l'instant qu'une génération quitte.
//
// Ce qui écrirait l'événement se refuse dans cet ordre, sans rien écrire :
// un fichier d'un format plus récent, LECTURE_SEULE {raison: 'FORMAT'} ; un
// plan bloqué, LECTURE_SEULE {raison: 'BLOQUE'} ; le mode lecture,
// MODE_LECTURE ; le support rompu, SUPPORT_ROMPU. Sur un plan bloqué, débloquer
// est le seul geste admis : il prend lui-même le verrou, et laisse la séance
// en écriture (§ 8.5). Un geste qui laisse le plan bloqué ramène la séance en
// lecture et rend le verrou.
//
// Une écriture refusée par le support, ECRITURE ou ETAT_NON_ECRIT — celle
// d'un geste, d'un jalon ou du verrou qu'un passage en écriture pose —, rompt
// l'équivalence du § 8.2 : la séance garde l'Ouvert que le disque porte
// encore — celui d'avant le geste, ou celui que le refus a avancé, son geste
// au journal —, refuse tout geste jusqu'à ce qu'ecrireAilleurs écrive
// l'événement dans un autre dossier, et s'y poursuit (§ 8.6). Le geste refusé
// ne se rejoue pas. Écrire ailleurs refuse un dossier qui porte déjà
// l'événement, celui de la séance compris : deux copies d'un même
// identifiant ne se côtoient jamais dans un dossier (§ 8.6).
//
// Les appels qui lisent ou écrivent l'événement passent l'un après l'autre,
// dans l'ordre de leur appel : chacun part de l'Ouvert que le précédent a
// laissé. L'horloge et les minuteries entrent en paramètre : la séance ne lit
// ni l'heure ni un aléa, et n'arme aucune minuterie elle-même.
import { serialiserCharge } from '../stockage/canonique.js';
import {
  creer as creerSurDisque,
  deverrouiller,
  enregistrer,
  enregistrerAilleurs,
  lister,
  nommer as nommerSurDisque,
  ouvrir as ouvrirSurDisque,
  ouvrirSecours as ouvrirSecoursSurDisque,
  verrouiller,
} from '../stockage/depot.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { fil, reconstruire } from '../stockage/journal.js';
import { appliquerCommande, chargeNeuve } from './commandes.js';
import { libelle } from './libelles.js';

/** Inactivité au terme de laquelle la séance revient seule en lecture (§ 8.4). */
export const INACTIVITE_MS = 10 * 60 * 1000;

/**
 * Le refus d'un geste par la séance : son code et ses détails. VERROU_PRIS
 * et LECTURE_SEULE, codes du contrat du stockage, se lèvent en
 * ErreurStockage. Le texte affiché vient de la table des libellés (§ 14.6).
 */
export class ErreurSeance extends Error {
  /**
   * @param {string} code
   * @param {Object} [details]
   */
  constructor(code, details = {}) {
    super(`${code} ${JSON.stringify(details)}`);
    this.code = code;
    this.details = details;
  }
}
ErreurSeance.prototype.name = 'ErreurSeance';

// Un avertissement : il n'empêche rien.
const avertissement = (code, details) => ({ code, details });

const estBloque = (ouvert) => ouvert.charge.evenement.etat === 'bloque';

// Le libellé de l'entrée de révision donnée.
const libelleDeRevision = (journal, revision) => journal.entrees.find((entree) => entree.revision === revision).libelle;

// Le libellé figé d'une entrée de retour, qui nomme l'instant : celui que
// défaire quitte, celui que refaire ou revenir restituent.
function libelleDuRetour(sens, instant) {
  if (sens === 'defaire') return libelle('ENTREE_DEFAIRE', { libelle: instant });
  if (sens === 'refaire') return libelle('ENTREE_REFAIRE', { libelle: instant });
  return libelle('ENTREE_REVENIR', { libelle: instant });
}

/**
 * Une séance sur le dossier de travail racine.
 *
 * @param {Object} parametres
 * @param {import('../stockage/systeme_fichiers.js').SystemeFichiers} parametres.fs
 * @param {import('../stockage/systeme_fichiers.js').Racine} parametres.racine
 *        le dossier de travail que la règle du § 8.6 a déterminé
 * @param {{horodatage: () => string}} parametres.horloge
 *        horodatage rend AAAA-MM-JJTHH:MM:SS±HH:MM
 * @param {() => string} parametres.identifiant   tiré une fois pour le verrou
 *        de la séance, puis une fois par événement qu'elle crée
 * @param {string} parametres.produitVersion      la construction qui écrit
 * @param {(fn: () => unknown, ms: number) => unknown} parametres.planifier
 *        arme une minuterie ; rend ce qu'annuler reçoit
 * @param {(minuterie: unknown) => void} parametres.annuler
 * @param {number} [parametres.inactiviteMs]
 */
export function creerSeance({
  fs,
  racine,
  horloge,
  identifiant,
  produitVersion,
  planifier,
  annuler,
  inactiviteMs = INACTIVITE_MS,
}) {
  const id = identifiant();
  const libelleReprise = libelle('ENTREE_REPRISE');

  // L'état de la séance. ouvert : l'Ouvert courant, null sans événement ;
  // verrouTenu : la séance tient le verrou de cet événement ; refusSupport :
  // l'écriture qui a rompu le support, {echec, chemin, dossier, cause} ;
  // verrouAutre : le verrou d'une autre séance qui a refusé le dernier
  // passage en écriture ; gestes, calculs : ceux qui sont ouverts, qui
  // suspendent le compte d'inactivité ; minuterie : celle qu'il a armée.
  const etat = {
    racine,
    ouvert: null,
    mode: 'lecture',
    verrouTenu: false,
    supportRompu: false,
    refusSupport: null,
    verrouAutre: null,
    avertissementsOuverture: [],
    avertissementsGeste: [],
    gestes: 0,
    calculs: 0,
    minuterie: null,
  };

  // La file des appels qui lisent ou écrivent l'événement : chacun part
  // quand le précédent a fini, réussi ou non.
  let file = Promise.resolve();
  function enFile(travail) {
    const suite = file.then(travail);
    file = suite.then(
      () => undefined,
      () => undefined,
    );
    return suite;
  }

  // --- L'inactivité (§ 8.4) -----------------------------------------------

  function suspendre() {
    if (etat.minuterie === null) return;
    annuler(etat.minuterie);
    etat.minuterie = null;
  }

  // Relance le compte d'inactivité : en écriture, sans geste ni calcul
  // ouvert ; suspendu sinon.
  function armer() {
    suspendre();
    if (etat.mode !== 'ecriture' || etat.gestes > 0 || etat.calculs > 0) return;
    const minuterie = planifier(() => enFile(() => expirer(minuterie)), inactiviteMs);
    etat.minuterie = minuterie;
  }

  // Le terme d'une minuterie, à son tour dans la file : celle qui est
  // toujours armée ramène la séance en lecture, tant que rien n'est ouvert.
  async function expirer(minuterie) {
    if (etat.minuterie !== minuterie) return;
    etat.minuterie = null;
    if (etat.mode !== 'ecriture' || etat.gestes > 0 || etat.calculs > 0) return;
    await quitterEcriture();
  }

  // --- Le verrou (§ 8.8) -----------------------------------------------------

  // Prend le verrou de l'événement de l'Ouvert. Le verrou de cette séance,
  // resté d'un rendu refusé, est le sien. Celui d'une séance morte de ce
  // poste (vivant faux) se rend en son nom, puis se reprend : VERROU_REPRIS.
  // Celui d'une séance vivante, d'un autre poste ou illisible ne se reprend
  // pas : VERROU_PRIS, que verrouAutre garde. Un système sans verrou le rend
  // toujours pris. Un support qui refuse d'écrire le verrou, ou d'effacer
  // celui du mort, rompt le support sous l'échec VERROU_NON_ECRIT, et son
  // ECRITURE remonte (§ 8.6). Rend les avertissements.
  async function prendreVerrou(ouvert) {
    let verrou;
    const avertissements = [];
    try {
      verrou = await verrouiller(ouvert, id);
      if (!verrou.pris && verrou.seance === id) verrou = { pris: true };
      if (!verrou.pris && verrou.vivant === false) {
        const mort = verrou;
        await deverrouiller(ouvert, mort.seance);
        verrou = await verrouiller(ouvert, id);
        if (verrou.pris) {
          avertissements.push(avertissement('VERROU_REPRIS', { seance: mort.seance, depuis: mort.depuis }));
        }
      }
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ECRITURE') rompre(erreur, ouvert, 'VERROU_NON_ECRIT');
      throw erreur;
    }
    if (!verrou.pris) {
      const { seance, depuis, vivant } = verrou;
      etat.verrouAutre = { seance, depuis, vivant };
      throw new ErreurStockage('VERROU_PRIS', { seance, depuis, vivant });
    }
    etat.verrouAutre = null;
    etat.verrouTenu = true;
    return avertissements;
  }

  // Rend le verrou que la séance tient sur l'événement de l'Ouvert. Un refus
  // du système de fichiers ne retient pas la séance : VERROU_NON_RENDU le
  // dit, et le verrou tombe avec ce processus.
  async function rendreVerrou(ouvert) {
    if (!etat.verrouTenu) return [];
    etat.verrouTenu = false;
    try {
      await deverrouiller(ouvert, id);
      return [];
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      return [avertissement('VERROU_NON_RENDU', erreur.details)];
    }
  }

  // Le retour en lecture : le compte s'arrête, et le verrou se rend ; le
  // retour explicite annule en plus le geste ouvert. Les avertissements du
  // rendu s'ajoutent à ceux du dernier geste.
  async function quitterEcriture({ explicite = false } = {}) {
    suspendre();
    if (explicite) etat.gestes = 0;
    etat.mode = 'lecture';
    const avertissements = await rendreVerrou(etat.ouvert);
    etat.avertissementsGeste = [...etat.avertissementsGeste, ...avertissements];
    return avertissements;
  }

  // --- Les refus --------------------------------------------------------------

  function exigerOuvert() {
    if (etat.ouvert === null) throw new ErreurSeance('AUCUN_EVENEMENT');
    return etat.ouvert;
  }

  function exigerSupport() {
    if (etat.supportRompu) throw new ErreurSeance('SUPPORT_ROMPU', { ...etat.refusSupport });
  }

  // L'Ouvert, quand l'événement admet une écriture ; sinon le refus, dans
  // l'ordre de l'en-tête du module.
  function exigerEcriture() {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT' });
    if (estBloque(ouvert)) throw new ErreurStockage('LECTURE_SEULE', { raison: 'BLOQUE' });
    if (etat.mode === 'lecture') throw new ErreurSeance('MODE_LECTURE');
    exigerSupport();
    return ouvert;
  }

  // --- L'écriture d'un geste (§ 8.2, § 8.3, § 8.6) -------------------------------

  // Le support rompu par erreur, ECRITURE ou ETAT_NON_ECRIT : la séance garde
  // ouvert, l'Ouvert que le disque porte, et le refus, dont echec nomme ce
  // que le support n'a pas reçu : par défaut le code de l'erreur, la ligne
  // ou l'état d'un geste ; JALON_NON_ECRIT, le jalon d'un geste enregistré ;
  // VERROU_NON_ECRIT, le verrou d'un passage en écriture.
  function rompre(erreur, ouvert, echec = erreur.code) {
    const { chemin, dossier, cause } = erreur.details;
    etat.ouvert = ouvert;
    etat.supportRompu = true;
    etat.refusSupport = { echec, chemin, dossier, cause };
  }

  // Une écriture du dépôt depuis l'Ouvert reçu ; ce qu'elle rend devient
  // l'Ouvert de la séance. ECRITURE rompt le support en gardant l'Ouvert
  // reçu, que rien n'a changé ; ETAT_NON_ECRIT, en gardant l'Ouvert avancé de
  // ses détails, son geste au journal. Le refus remonte.
  async function ecrire(ouvert, ecriture) {
    try {
      etat.ouvert = await ecriture(ouvert);
      return etat.ouvert;
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ECRITURE') rompre(erreur, ouvert);
      if (erreur instanceof ErreurStockage && erreur.code === 'ETAT_NON_ECRIT') rompre(erreur, erreur.details.ouvert);
      throw erreur;
    }
  }

  // Écrit un geste depuis l'Ouvert depart : le jalon jalonAvant sur l'instant
  // courant quand il est donné, puis l'entrée et l'état, puis, quand l'état
  // du plan change, le jalon qui le nomme (§ 8.3). Un horodatage pour tout
  // le geste. Le jalon d'état qu'un refus empêche laisse le geste
  // enregistré : JALON_NON_ECRIT s'ajoute aux avertissements, et le support
  // est rompu sous ce même échec. Rend le libellé ; les avertissements
  // deviennent ceux du dernier geste.
  async function ecrireGeste(depart, { charge, libelle: texte, avertissements }, options = {}) {
    const { sens = null, retour = null, jalonAvant = null } = options;
    const horodatage = horloge.horodatage();
    const commun = { horodatage, libelleReprise };
    let ouvert = depart;
    if (jalonAvant !== null) ouvert = await ecrire(ouvert, (o) => nommerSurDisque(o, { nom: jalonAvant, ...commun }));
    const entree = { libelle: texte, produitVersion, sens, retour, ...commun };
    ouvert = await ecrire(ouvert, (o) => enregistrer(o, charge, entree));
    const suite = [...avertissements];
    const etatDuPlan = ouvert.charge.evenement.etat;
    if (etatDuPlan !== depart.charge.evenement.etat) {
      const nom = libelle('JALON_ETAT', { etat: etatDuPlan });
      try {
        etat.ouvert = await nommerSurDisque(ouvert, { nom, ...commun });
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage && erreur.code === 'ECRITURE')) throw erreur;
        rompre(erreur, ouvert, 'JALON_NON_ECRIT');
        const { chemin, dossier, cause } = erreur.details;
        suite.push(avertissement('JALON_NON_ECRIT', { chemin, dossier, cause }));
      }
    }
    etat.avertissementsGeste = suite;
    return texte;
  }

  // Après un geste, achevé ou refusé : un plan bloqué ne reste pas en
  // écriture, la séance revient en lecture et rend le verrou ; sinon le
  // compte d'inactivité repart.
  async function apresGeste() {
    if (etat.mode === 'ecriture' && etat.ouvert !== null && estBloque(etat.ouvert)) {
      await quitterEcriture();
      return;
    }
    armer();
  }

  // Débloquer (§ 8.5, § 9) : le seul geste qu'un plan bloqué admet. La
  // commande d'abord, qui ne touche rien ; puis le verrou, que la séance
  // prend en lecture ; puis l'entrée et le jalon de l'état rendu. La séance
  // reste en écriture.
  async function debloquerPlan(ouvert, args) {
    exigerSupport();
    const resultat = appliquerCommande('debloquer', ouvert.charge, args);
    const avertissements = etat.mode === 'ecriture' ? [] : await prendreVerrou(ouvert);
    etat.mode = 'ecriture';
    return ecrireGeste(ouvert, { ...resultat, avertissements: [...avertissements, ...resultat.avertissements] });
  }

  // Un geste nommé, sans son suivi : le refus, ou le libellé et ce que la
  // commande ajoute.
  async function geste(nom, args) {
    const ouvert = exigerOuvert();
    if (nom === 'debloquer' && !ouvert.formatPlusRecent && estBloque(ouvert)) {
      return { libelle: await debloquerPlan(ouvert, args) };
    }
    exigerEcriture();
    const resultat = appliquerCommande(nom, ouvert.charge, args);
    const jalonAvant = nom === 'enregistrerGeneration' ? libelle('JALON_AVANT_GENERATION') : null;
    const texte = await ecrireGeste(ouvert, resultat, { jalonAvant });
    return resultat.resume === undefined ? { libelle: texte } : { libelle: texte, resume: resultat.resume };
  }

  // Un geste et son suivi (apresGeste), qu'il aboutisse ou non : ce qu'il
  // rend, et les avertissements du dernier geste, rendu du verrou compris.
  async function suivi(travail) {
    let rendu;
    try {
      rendu = await travail();
    } finally {
      await apresGeste();
    }
    return { ...rendu, avertissements: [...etat.avertissementsGeste] };
  }

  // --- Les retours (§ 8.3) -----------------------------------------------------

  // Le fil de l'Ouvert : les cibles de défaire et de refaire, null quand
  // elles n'existent pas, et le libellé de l'instant courant. Quand le
  // journal finit sur une autre révision que la charge ouverte, ou manque, la
  // prochaine écriture pose d'abord l'entrée de reprise, une entrée ordinaire
  // qui restitue la charge ouverte : l'instant courant est le sien, défaire
  // vise celui où finit le journal, et rien ne se refait.
  function filDe(ouvert) {
    const { journal } = ouvert;
    if (journal === null || journal.entrees.length === 0) {
      return { cibleDefaire: null, cibleRefaire: null, courant: libelleReprise };
    }
    const lu = fil(journal);
    if (journal.entrees.at(-1).revision !== ouvert.revision) {
      return { cibleDefaire: lu.position, cibleRefaire: null, courant: libelleReprise };
    }
    const courant = libelleDeRevision(journal, lu.position);
    return { cibleDefaire: lu.cibleDefaire, cibleRefaire: lu.cibleRefaire, courant };
  }

  // La charge de l'instant revision du journal de l'Ouvert, ou
  // INSTANT_NON_RESTITUABLE : un instant que l'élagage a retiré, ou qu'un
  // correctif qui ne s'applique pas a perdu.
  function restituer(ouvert, revision) {
    if (!Number.isSafeInteger(revision)) {
      throw new TypeError(`revision : entier attendu, reçu ${JSON.stringify(revision)}`);
    }
    if (ouvert.journal === null) throw new ErreurSeance('INSTANT_NON_RESTITUABLE', { revision });
    try {
      return reconstruire(ouvert.journal, revision);
    } catch (erreur) {
      if (erreur instanceof RangeError || (erreur instanceof ErreurStockage && erreur.code === 'CORRECTIF')) {
        throw new ErreurSeance('INSTANT_NON_RESTITUABLE', { revision });
      }
      throw erreur;
    }
  }

  // Un retour, sans son suivi : défaire vise le prédécesseur de l'instant
  // courant sur le fil, refaire le sommet de sa pile, revenir l'instant
  // donné ; l'entrée porte la charge restituée, son sens et sa cible.
  async function retour(sens, visee) {
    const ouvert = exigerEcriture();
    const { cibleDefaire, cibleRefaire, courant } = filDe(ouvert);
    let cible = visee;
    if (sens === 'defaire') {
      if (cibleDefaire === null) throw new ErreurSeance('RIEN_A_DEFAIRE');
      cible = cibleDefaire;
    }
    if (sens === 'refaire') {
      if (cibleRefaire === null) throw new ErreurSeance('RIEN_A_REFAIRE');
      cible = cibleRefaire;
    }
    const charge = restituer(ouvert, cible);
    if (serialiserCharge(charge) === serialiserCharge(ouvert.charge)) throw new ErreurSeance('SANS_EFFET', { sens });
    const instant = sens === 'defaire' ? courant : libelleDeRevision(ouvert.journal, cible);
    const entree = { charge, libelle: libelleDuRetour(sens, instant), avertissements: [] };
    const texte = await ecrireGeste(ouvert, entree, { sens, retour: cible });
    return { libelle: texte };
  }

  // --- Ouvrir, créer, fermer (§ 8.1, § 8.4) ----------------------------------------

  // Ferme l'événement ouvert : le compte s'arrête, le verrou se rend, et la
  // séance oublie l'événement. Rend les avertissements du rendu.
  async function fermerEvenement() {
    suspendre();
    const avertissements = etat.ouvert === null ? [] : await rendreVerrou(etat.ouvert);
    Object.assign(etat, {
      ouvert: null,
      mode: 'lecture',
      verrouTenu: false,
      supportRompu: false,
      refusSupport: null,
      verrouAutre: null,
      avertissementsOuverture: [],
      avertissementsGeste: [],
      gestes: 0,
      calculs: 0,
    });
    return avertissements;
  }

  // Ouvre en lecture l'Ouvert que rend lire, sans rien écrire, après avoir
  // fermé le précédent.
  async function ouvrirAvec(lire) {
    await fermerEvenement();
    const ouvert = await lire();
    etat.ouvert = ouvert;
    etat.avertissementsOuverture = ouvert.avertissements;
    return { base: ouvert.base, avertissements: ouvert.avertissements };
  }

  // Crée l'événement de ces champs (§ 2.1, étape 1) : la charge neuve
  // (chargeNeuve), dont un champ refusé lève avant que rien ne change —
  // l'événement ouvert reste, son mode et son verrou compris ; puis le
  // précédent se ferme, et s'écrivent l'entrée de création et le jalon
  // « Création », puis l'état. Le nouveau reste ouvert en lecture. Un état
  // que le support refuse d'écrire, le journal écrit, rompt le support.
  async function creerEvenement(champs) {
    const { charge, libelle: texte } = chargeNeuve(champs, identifiant);
    await fermerEvenement();
    const options = {
      libelle: texte,
      nomJalon: libelle('JALON_CREATION'),
      horodatage: horloge.horodatage(),
      produitVersion,
    };
    try {
      etat.ouvert = await creerSurDisque(fs, etat.racine, charge, options);
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ETAT_NON_ECRIT') rompre(erreur, erreur.details.ouvert);
      throw erreur;
    }
    etat.avertissementsOuverture = etat.ouvert.avertissements;
    return { base: etat.ouvert.base };
  }

  // --- Les modes (§ 8.4, § 8.8) -------------------------------------------------------

  async function passerEnEcriture() {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT' });
    if (estBloque(ouvert)) throw new ErreurStockage('LECTURE_SEULE', { raison: 'BLOQUE' });
    if (etat.mode === 'ecriture') return { avertissements: [] };
    exigerSupport();
    const avertissements = await prendreVerrou(ouvert);
    etat.mode = 'ecriture';
    etat.avertissementsGeste = avertissements;
    armer();
    return { avertissements };
  }

  async function passerEnLecture() {
    etat.gestes = 0;
    suspendre();
    if (etat.mode === 'lecture') return { avertissements: [] };
    etat.avertissementsGeste = [];
    return { avertissements: await quitterEcriture({ explicite: true }) };
  }

  // Nomme l'instant courant (§ 8.3) : un jalon, sans entrée ; le nom entre en
  // NFC, ses blancs de bord retirés.
  async function nommer(nom) {
    try {
      const ouvert = exigerEcriture();
      if (typeof nom !== 'string') throw new TypeError(`nom : chaîne attendue, reçu ${JSON.stringify(nom)}`);
      const texte = nom.normalize('NFC').trim();
      if (texte === '') throw new ErreurSeance('NOM_REQUIS');
      await ecrire(ouvert, (o) => nommerSurDisque(o, { nom: texte, horodatage: horloge.horodatage(), libelleReprise }));
    } finally {
      await apresGeste();
    }
    return { revision: etat.ouvert.revision };
  }

  // Le résumé (lister) de l'événement d'identifiant idEvenement quand le
  // dossier de racine le porte déjà : par un état lisible, par un état
  // illisible que son .precedent ou son journal apparie à cet identifiant,
  // ou par un journal sans état ; null sinon, et pour un dossier qui
  // n'existe pas encore. Rien ne s'écrit.
  async function dejaPresent(racine, idEvenement) {
    let resumes;
    try {
      resumes = await lister(fs, racine);
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ABSENT') return null;
      throw erreur;
    }
    return resumes.find((resume) => resume.id === idEvenement) ?? null;
  }

  // Écrit l'événement dans la racine nouvelle, la réponse au support rompu
  // (§ 8.6) : la paire alignée de l'Ouvert gardé (enregistrerAilleurs), puis
  // le verrou rendu là où il était, puis, en écriture, pris là-bas. La séance
  // s'y poursuit, son support rétabli. Un dossier qui porte déjà
  // l'événement (dejaPresent), celui de la séance compris, se refuse
  // IDENTIFIANT_PRESENT, sans rien écrire : la paire s'y poserait sous une
  // seconde base. Un état que le support refuse là-bas, le journal écrit, y
  // transporte la séance : l'Ouvert avancé du refus et la racine nouvelle, en
  // lecture, le support rompu par ce refus, le verrou rendu là où il était ;
  // un nouvel essai y trouve ce journal, et se refuse. Tout autre échec
  // laisse tout en l'état, le support toujours rompu.
  async function ecrireAilleurs(nouvelle) {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT' });
    if (!etat.supportRompu) throw new ErreurSeance('SUPPORT_INTACT');
    const present = await dejaPresent(nouvelle, ouvert.charge.evenement.id);
    if (present !== null) throw new ErreurStockage('IDENTIFIANT_PRESENT', { id: present.id, base: present.base });
    const options = { existantes: [], libelleReprise, horodatage: horloge.horodatage() };
    let ailleurs;
    try {
      ailleurs = await enregistrerAilleurs(ouvert, nouvelle, options);
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ETAT_NON_ECRIT') {
        suspendre();
        etat.mode = 'lecture';
        etat.racine = nouvelle;
        rompre(erreur, erreur.details.ouvert);
        etat.avertissementsGeste = await rendreVerrou(ouvert);
      }
      throw erreur;
    }
    const avertissements = await rendreVerrou(ouvert);
    Object.assign(etat, { ouvert: ailleurs, racine: nouvelle, supportRompu: false, refusSupport: null });
    if (etat.mode === 'ecriture') {
      try {
        avertissements.push(...(await prendreVerrou(ailleurs)));
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage)) throw erreur;
        etat.mode = 'lecture';
        avertissements.push(avertissement(erreur.code, erreur.details));
      }
    }
    etat.avertissementsGeste = avertissements;
    armer();
    return { base: ailleurs.base, avertissements };
  }

  return {
    /** L'identifiant de la séance, qui signe son verrou. */
    get id() {
      return id;
    },
    /** Le dossier de travail, que l'écriture ailleurs remplace. */
    get racine() {
      return etat.racine;
    },
    /** 'lecture' ou 'ecriture' (§ 8.4). */
    get mode() {
      return etat.mode;
    },
    /** L'Ouvert de l'événement (depot.js), null sans événement. */
    get ouvert() {
      return etat.ouvert;
    },
    get charge() {
      return etat.ouvert?.charge ?? null;
    },
    /** Vrai quand une écriture refusée a rompu l'équivalence du § 8.2. */
    get supportRompu() {
      return etat.supportRompu;
    },
    /** {echec, chemin, dossier, cause} de l'écriture qui a rompu le support, ou null. */
    get refusSupport() {
      return etat.refusSupport;
    },
    /** {seance, depuis, vivant} du verrou qui a refusé le dernier passage en écriture, ou null. */
    get verrouAutre() {
      return etat.verrouAutre;
    },
    /** Ceux de l'ouverture, puis ceux du dernier geste. */
    get avertissements() {
      return [...etat.avertissementsOuverture, ...etat.avertissementsGeste];
    },
    /** {defaire, refaire} : les retours qui existent sur le fil courant (§ 8.3). */
    get retours() {
      if (etat.ouvert === null) return { defaire: false, refaire: false };
      const { cibleDefaire, cibleRefaire } = filDe(etat.ouvert);
      return { defaire: cibleDefaire !== null, refaire: cibleRefaire !== null };
    },
    get gesteEnCours() {
      return etat.gestes > 0;
    },
    get calculEnCours() {
      return etat.calculs > 0;
    },

    ouvrir: (base) => enFile(() => ouvrirAvec(() => ouvrirSurDisque(fs, etat.racine, base))),
    ouvrirSecours: (base, source) =>
      enFile(() => ouvrirAvec(() => ouvrirSecoursSurDisque(fs, etat.racine, base, source))),
    creer: (champs) => enFile(() => creerEvenement(champs)),
    fermer: () => enFile(async () => ({ avertissements: await fermerEvenement() })),
    passerEnEcriture: () => enFile(passerEnEcriture),
    passerEnLecture: () => enFile(passerEnLecture),
    executer: (nom, args = {}) => enFile(() => suivi(() => geste(nom, args))),
    debloquer: () => enFile(() => suivi(() => geste('debloquer', {}))),
    defaire: () => enFile(() => suivi(() => retour('defaire', null))),
    refaire: () => enFile(() => suivi(() => retour('refaire', null))),
    revenir: (revision) => enFile(() => suivi(() => retour('revenir', revision))),
    nommer: (nom) => enFile(() => nommer(nom)),
    ecrireAilleurs: (nouvelle) => enFile(() => ecrireAilleurs(nouvelle)),

    // Les gestes et les calculs ouverts suspendent le compte d'inactivité ;
    // ils s'emboîtent, et un fini de trop ne compte pas.
    debuterGeste() {
      etat.gestes += 1;
      suspendre();
    },
    finirGeste() {
      etat.gestes = Math.max(0, etat.gestes - 1);
      armer();
    },
    debuterCalcul() {
      etat.calculs += 1;
      suspendre();
    },
    finirCalcul() {
      etat.calculs = Math.max(0, etat.calculs - 1);
      armer();
    },
  };
}
