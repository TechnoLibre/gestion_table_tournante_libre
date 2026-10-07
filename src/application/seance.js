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
// MODE_LECTURE ; le support rompu, SUPPORT_ROMPU. Un état aux octets hors
// UTF-8 ne s'ouvre qu'en secours, dont le premier geste le met de côté dans
// la corbeille (§ 8.8). Sur un plan bloqué, débloquer
// est le seul geste admis : il prend lui-même le verrou, et laisse la séance
// en écriture (§ 8.5). Un geste qui laisse le plan bloqué ramène la séance en
// lecture et rend le verrou.
//
// Le verrou pris — passer en écriture, débloquer —, la séance relit
// l'événement sur le disque : une autre séance a pu l'écrire tant que
// celle-ci le lisait. Un Ouvert de secours se relit par l'état dès que
// l'état a changé depuis l'ouverture ; un .precedent, par le journal dès
// que le journal a reçu une entrée ; et par sa source sinon. Ce qu'elle
// relit devient son Ouvert, et EVENEMENT_CHANGE {revision} le dit quand la
// révision ou la charge diffèrent : une séance n'écrit jamais par-dessus le
// travail d'une autre (§ 8.2, § 8.8). Un événement qui ne se relit plus rend
// le verrou, et le refus de la lecture remonte ; un état devenu illisible par
// ses octets hors UTF-8 se refuse comme un format plus récent,
// LECTURE_SEULE {raison: 'ENCODAGE'}.
//
// Une écriture refusée par le support, ECRITURE ou ETAT_NON_ECRIT — celle
// d'un geste, d'un jalon ou du verrou qu'un passage en écriture pose —, rompt
// l'équivalence du § 8.2 : la séance garde l'Ouvert que le disque porte
// encore — celui d'avant le geste, ou celui que le refus a avancé, son geste
// au journal —, refuse tout geste jusqu'à ce qu'ecrireAilleurs écrive
// l'événement dans un autre dossier, et s'y poursuit (§ 8.6). Le geste refusé
// ne se rejoue pas. Écrire ailleurs refuse un dossier qui porte déjà
// l'événement, celui de la séance compris : deux copies d'un même
// identifiant ne se côtoient jamais dans un dossier (§ 8.6). Tant que le
// support est rompu, l'Ouvert de la séance est la seule copie qu'écrire
// ailleurs peut sauver : ouvrir, ouvrir un secours, créer et fermer se
// refusent SUPPORT_ROMPU_NON_SAUVE, sauf appelés avec {abandonner: true}.
//
// Les avertissements de la séance sont ceux de l'Ouvert courant — ceux de
// l'ouverture, puis ceux que le dépôt recalcule après chaque écriture —,
// puis INVARIANT_VIOLE, tant que le retenu de la charge enfreint une règle
// que la dérive ne nomme pas, puis ceux du dernier geste — ceux d'un passage
// en écriture, ceux de la commande, puis ceux que le geste fait naître
// (avertissementsApres) —, puis RETOUR_AUTOMATIQUE après un retour en
// lecture au terme de l'inactivité, jusqu'au passage en écriture suivant.
//
// Chaque refus porte son remède, details.remede : le geste qui le lève, ou
// null. Le refus qu'un geste modifiant recevrait maintenant se lit dans
// l'état observable, calculé par la même fonction que celle qui refuse
// (exigerEcriture) : aucun composant ne refait ce contrôle.
//
// La séance est observable : etat() rend un instantané figé en profondeur,
// neuf à chaque changement et le même entre deux, et subscribe suit le
// contrat des magasins de Svelte. Le cadrage de l'événement ouvert se range
// hors du fichier, dans reglages_locaux.json, par un écrivain différé
// (§ 8.5) : regarder n'écrit jamais l'événement.
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
import { FORMAT, analyser } from '../stockage/document.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { fil, reconstruire } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { avecCadrage, cadrageDe, creerEcrivainDiffere, ecrireReglages, lireReglages } from '../stockage/reglages_locaux.js';
import { avertissementsApres, examenNomme, invariantViole } from './avertissements.js';
import { appliquerCommande, chargeNeuve, formeNommeeDe } from './commandes.js';
import { libelle } from './libelles.js';

/** Inactivité au terme de laquelle la séance revient seule en lecture (§ 8.4). */
export const INACTIVITE_MS = 10 * 60 * 1000;

/** Délai de l'écriture différée du cadrage dans reglages_locaux.json (§ 8.5). */
export const DELAI_REGLAGES_MS = 1000;

/**
 * Le refus d'un geste par la séance : son code et ses détails, dont le
 * remède, details.remede, null quand les détails n'en donnent pas.
 * VERROU_PRIS et LECTURE_SEULE, codes du contrat du stockage, se lèvent en
 * ErreurStockage. Le texte affiché vient de la table des libellés (§ 14.6).
 */
export class ErreurSeance extends Error {
  /**
   * @param {string} code
   * @param {Object} [details]
   */
  constructor(code, details = {}) {
    const complets = Object.hasOwn(details, 'remede') ? details : { ...details, remede: null };
    super(`${code} ${JSON.stringify(complets)}`);
    this.code = code;
    this.details = complets;
  }
}
ErreurSeance.prototype.name = 'ErreurSeance';

// Un avertissement : il n'empêche rien.
const avertissement = (code, details) => ({ code, details });

const estBloque = (ouvert) => ouvert.charge.evenement.etat === 'bloque';

// Les refus de lecture seule de la séance, et leur remède : aucun pour un
// format plus récent ; débloquer un plan bloqué ; ouvrir le .precedent d'un
// état aux octets hors UTF-8, que son premier geste met de côté (§ 8.8).
const refusFormat = () => new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT', remede: null });
const refusBloque = () => new ErreurStockage('LECTURE_SEULE', { raison: 'BLOQUE', remede: { geste: 'debloquer' } });
const refusEncodage = () =>
  new ErreurStockage('LECTURE_SEULE', { raison: 'ENCODAGE', remede: { geste: 'ouvrirSecours', source: 'precedent' } });

// Deux racines désignent le même dossier.
const memeRacine = (a, b) => a?.id === b?.id && a?.chemin === b?.chemin;

// Fige un objet et tout ce qu'il atteint. Un objet déjà figé est laissé
// tel quel : l'état observable ne reçoit que des copies neuves
// (structuredClone) ou des objets déjà passés par cette fonction.
function figer(valeur) {
  if (valeur === null || typeof valeur !== 'object' || Object.isFrozen(valeur)) return valeur;
  for (const cle of Object.keys(valeur)) figer(valeur[cle]);
  return Object.freeze(valeur);
}

// Le format qu'annonce l'en-tête de l'état sur le disque, null sans texte :
// texteEtat d'un Ouvert est toujours lisible quand il n'est pas null.
const formatDe = (texteEtat) => (texteEtat === null ? null : analyser(texteEtat).entete.format);

// La révision de la dernière entrée du journal de l'Ouvert, null sans
// journal.
const derniereEntree = ({ journal }) => journal?.entrees.at(-1)?.revision ?? null;

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
 * @param {import('../stockage/systeme_fichiers.js').Racine|null} [parametres.racine]
 *        le dossier de travail que la règle du § 8.6 a déterminé ; null
 *        jusqu'à changerRacine, la séance ne le lisant qu'à ouvrir, créer et
 *        écrire ailleurs
 * @param {{horodatage: () => string}} parametres.horloge
 *        horodatage rend AAAA-MM-JJTHH:MM:SS±HH:MM
 * @param {() => string} parametres.identifiant   tiré une fois pour le verrou
 *        de la séance, puis une fois par événement qu'elle crée
 * @param {string} parametres.produitVersion      la construction qui écrit
 * @param {(fn: () => unknown, ms: number) => unknown} parametres.planifier
 *        arme une minuterie ; rend ce qu'annuler reçoit
 * @param {(minuterie: unknown) => void} parametres.annuler
 * @param {number} [parametres.inactiviteMs]
 * @param {number} [parametres.formatCourant]   le format au-dessous duquel un
 *        fichier ouvert s'annonce plus ancien ; il ne règle que l'annonce : le
 *        stockage n'écrit que FORMAT
 * @param {number} [parametres.delaiReglagesMs]   délai de l'écriture différée
 *        du cadrage
 */
export function creerSeance({
  fs,
  racine = null,
  horloge,
  identifiant,
  produitVersion,
  planifier,
  annuler,
  inactiviteMs = INACTIVITE_MS,
  formatCourant = FORMAT,
  delaiReglagesMs = DELAI_REGLAGES_MS,
}) {
  const id = identifiant();
  const libelleReprise = libelle('ENTREE_REPRISE');

  // L'état de la séance. ouvert : l'Ouvert courant, null sans événement ;
  // source : d'où il se relit, null pour l'état, 'precedent' ou 'journal'
  // pour un secours que nul geste n'a encore écrit en état — 'journal' aussi
  // après un jalon qui pose l'entrée de reprise sans écrire l'état ;
  // verrouTenu : la séance tient le verrou de cet événement ; refusSupport :
  // l'écriture qui a rompu le support, {echec, chemin, dossier, cause} ;
  // verrouAutre : le verrou d'une autre séance qui a refusé le dernier
  // passage en écriture ; gestes, calculs : ceux qui sont ouverts, qui
  // suspendent le compte d'inactivité ; minuterie : celle qu'il a armée ;
  // ailleurs : la racine documents à proposer quand le support rompu en est
  // une autre ; fautives : les propositions que l'ouverture a écartées ;
  // formatLu : le format de l'état relu, null dès qu'un geste l'a écrit ;
  // retourAutomatique : le dernier retour en lecture est celui de
  // l'inactivité ; cadrage : celui de l'événement ouvert, lu ou demandé.
  const etat = {
    racine,
    ouvert: null,
    source: null,
    mode: 'lecture',
    verrouTenu: false,
    supportRompu: false,
    refusSupport: null,
    ailleurs: null,
    verrouAutre: null,
    avertissementsGeste: [],
    gestes: 0,
    calculs: 0,
    minuterie: null,
    fautives: [],
    formatLu: null,
    retourAutomatique: false,
    cadrage: null,
  };

  // --- L'observation (A2) -----------------------------------------------------

  // Les abonnés de subscribe, ceux de surAnnulation, et l'instantané rendu
  // depuis le dernier changement, null quand il est à refaire.
  const abonnes = new Set();
  const annulations = new Set();
  let instantane = null;
  // Par Ouvert, sa charge et son examen figés, et INVARIANT_VIOLE : un
  // Ouvert ne change jamais, ses copies se font une fois. L'examen de l'état
  // nomme ses raisons de dérive sur la charge (examenNomme).
  const parOuvert = new WeakMap();

  function figesDe(ouvert) {
    let figes = parOuvert.get(ouvert);
    if (figes === undefined) {
      const copie = structuredClone({ charge: ouvert.charge, examen: examenNomme(ouvert.examen, ouvert.charge) });
      figes = { ...figer(copie), invariant: figer(invariantViole(ouvert.charge, ouvert.examen)) };
      parOuvert.set(ouvert, figes);
    }
    return figes;
  }

  // Le refus qu'un geste modifiant recevrait maintenant : celui
  // qu'exigerEcriture lève, {code, details} ; null sans événement, ou quand
  // le geste passerait.
  function refusCourant() {
    if (etat.ouvert === null) return null;
    try {
      exigerEcriture();
      return null;
    } catch (erreur) {
      return { code: erreur.code, details: erreur.details };
    }
  }

  // L'événement de l'état observable : sa base, son identifiant, son nom, son
  // état, sa révision, et l'annonce du format.
  function evenementDe(ouvert) {
    const { id: idEvenement, nom, etat: etatDuPlan } = ouvert.charge.evenement;
    let annonceFormat = null;
    if (ouvert.formatPlusRecent) annonceFormat = 'plusRecent';
    else if (etat.formatLu !== null && etat.formatLu < formatCourant) annonceFormat = 'plusAncien';
    return { base: ouvert.base, id: idEvenement, nom, etat: etatDuPlan, revision: ouvert.revision, annonceFormat };
  }

  // L'état observable, construit à neuf (contrat EtatSeance).
  function construire() {
    const { ouvert } = etat;
    const figes = ouvert === null ? null : figesDe(ouvert);
    const avertissements = [
      ...(ouvert?.avertissements ?? []),
      ...(figes?.invariant ? [figes.invariant] : []),
      ...etat.avertissementsGeste,
      ...(etat.retourAutomatique ? [avertissement('RETOUR_AUTOMATIQUE', {})] : []),
    ];
    const petit = structuredClone({
      racine: etat.racine,
      mode: etat.mode,
      evenement: ouvert === null ? null : evenementDe(ouvert),
      fautives: etat.fautives,
      avertissements,
      refus: refusCourant(),
      retours: retoursDe(ouvert),
      supportRompu: etat.supportRompu ? { ...etat.refusSupport, ailleurs: etat.ailleurs } : null,
      calculEnCours: etat.calculs > 0,
      verrouAutre: etat.verrouAutre,
    });
    return figer({
      racine: petit.racine,
      mode: petit.mode,
      evenement: petit.evenement,
      charge: figes?.charge ?? null,
      examen: figes?.examen ?? null,
      fautives: petit.fautives,
      avertissements: petit.avertissements,
      refus: petit.refus,
      retours: petit.retours,
      supportRompu: petit.supportRompu,
      calculEnCours: petit.calculEnCours,
      verrouAutre: petit.verrouAutre,
    });
  }

  function lireEtat() {
    if (instantane === null) instantane = construire();
    return instantane;
  }

  // Un changement a pu avoir lieu : l'instantané se refait, et chaque abonné
  // reçoit le nouveau.
  function publier() {
    instantane = null;
    if (abonnes.size === 0) return;
    const courant = lireEtat();
    for (const abonne of [...abonnes]) abonne(courant);
  }

  // Le passage en lecture, explicite ou automatique, et la fermeture :
  // chaque fonction de surAnnulation est appelée, dans l'ordre des
  // abonnements.
  function annoncerAnnulation() {
    for (const fonction of [...annulations]) fonction();
  }

  // --- Le cadrage (§ 8.5) -----------------------------------------------------

  // Écrit le cadrage demandé dans les réglages de sa racine, relus au moment
  // d'écrire : un cadrage qu'une autre séance y a posé entre-temps reste.
  // Des réglages que la lecture ne prend pas (REGLAGES_ILLISIBLES : lecture
  // refusée, JSON ou forme fautifs) ne s'écrasent pas des défauts, qui
  // perdraient le papier et les autres cadrages : le refus lève, et
  // l'écrivain garde le cadrage en attente pour la demande suivante.
  async function ecrireCadrage({ racine: dossier, evenement, cadrage }) {
    const { reglages, avertissement } = await lireReglages(fs, dossier);
    if (avertissement !== null) throw new ErreurSeance(avertissement.code, avertissement.details);
    await ecrireReglages(fs, dossier, avecCadrage(reglages, evenement, cadrage));
  }

  // Le refus d'une écriture lancée par la minuterie se tait : le cadrage
  // n'est qu'une commodité, et l'écrivain le réessaie à la demande suivante.
  const ecrivain = creerEcrivainDiffere({ ecrire: ecrireCadrage, planifier, annuler, delaiMs: delaiReglagesMs });

  // Le cadrage mémorisé de l'événement ouvert, relu dans les réglages de la
  // racine ; null quand ils n'en portent pas, et pour des réglages que la
  // lecture ne prend pas — la façade annonce REGLAGES_ILLISIBLES (A3).
  async function cadrageMemorise(ouvert) {
    try {
      const { reglages } = await lireReglages(fs, ouvert.racine);
      return cadrageDe(reglages, ouvert.charge.evenement.id);
    } catch {
      return null;
    }
  }

  // Écrit aussitôt le cadrage en attente ; un refus se tait.
  async function viderCadrage() {
    try {
      await ecrivain.vider();
    } catch {
      // Le cadrage refusé reste en attente de l'écrivain.
    }
  }

  // La file des appels qui lisent ou écrivent l'événement : chacun part
  // quand le précédent a fini, réussi ou non, et publie l'état qu'il laisse
  // avant que son appelant reprenne la main.
  let file = Promise.resolve();
  function enFile(travail) {
    const suite = file.then(travail).finally(publier);
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
  // Le retour automatique se dit par RETOUR_AUTOMATIQUE, que le passage en
  // écriture suivant retire.
  async function expirer(minuterie) {
    if (etat.minuterie !== minuterie) return;
    etat.minuterie = null;
    if (etat.mode !== 'ecriture' || etat.gestes > 0 || etat.calculs > 0) return;
    await quitterEcriture();
    etat.retourAutomatique = true;
  }

  // --- Le verrou (§ 8.8) -----------------------------------------------------

  // Prend le verrou de l'événement de l'Ouvert. Le verrou de cette séance,
  // resté d'un rendu refusé, est le sien. Celui d'une séance morte de ce
  // poste (vivant faux) se rend en son nom, puis se reprend : VERROU_REPRIS
  // {seance, depuis}. Celui d'une séance vivante, d'un autre poste (vivant
  // null) ou illisible ne se reprend pas : VERROU_PRIS {seance, depuis,
  // vivant}, remède null, que verrouAutre garde. Un système sans verrou le
  // rend toujours pris. Un support qui refuse d'écrire le verrou, ou
  // d'effacer celui qu'il reprend, rompt le support sous l'échec
  // VERROU_NON_ECRIT, et son ECRITURE remonte (§ 8.6). Rend les
  // avertissements.
  //
  // reprise : le verrou que l'opérateur a vu refusé et confirmé reprendre,
  // {seance, depuis} de verrouAutre (reprendreVerrou), null sinon. Un verrou
  // dont la vie ne se prouve pas (vivant null) s'efface alors, puis se prend,
  // sous VERROU_REPRIS {seance, depuis} — mais seulement le verrou même que
  // la reprise nomme, de même séance et de même instant : un verrou posé
  // depuis, que l'opérateur n'a pas vu, se refuse VERROU_PRIS comme sans
  // reprise. Un verrou vivant ne se reprend jamais.
  async function prendreVerrou(ouvert, reprise = null) {
    let verrou;
    const avertissements = [];
    try {
      verrou = await verrouiller(ouvert, id);
      if (!verrou.pris && verrou.seance === id) verrou = { pris: true };
      const confirme =
        !verrou.pris &&
        reprise !== null &&
        verrou.vivant === null &&
        verrou.seance === reprise.seance &&
        verrou.depuis === reprise.depuis;
      if (!verrou.pris && (verrou.vivant === false || confirme)) {
        const ancien = verrou;
        await effacerVerrou(ouvert, ancien.seance);
        verrou = await verrouiller(ouvert, id);
        if (verrou.pris) {
          avertissements.push(avertissement('VERROU_REPRIS', { seance: ancien.seance, depuis: ancien.depuis }));
        }
      }
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ECRITURE') await rompre(erreur, ouvert, 'VERROU_NON_ECRIT');
      throw erreur;
    }
    if (!verrou.pris) {
      const { seance, depuis, vivant } = verrou;
      etat.verrouAutre = { seance, depuis, vivant };
      throw new ErreurStockage('VERROU_PRIS', { seance, depuis, vivant, remede: null });
    }
    etat.verrouAutre = null;
    etat.verrouTenu = true;
    return avertissements;
  }

  // Efface le verrou d'une autre séance, que prendreVerrou reprend : celui
  // de la séance nommée, par deverrouiller, qui n'efface que lui ; un verrou
  // illisible (seance null) n'a pas de séance qui le rende, et son fichier
  // s'efface.
  async function effacerVerrou(ouvert, seance) {
    if (seance !== null) {
      await deverrouiller(ouvert, seance);
      return;
    }
    await ouvert.fs.supprimer(ouvert.racine, ouvert.base + SUFFIXES.verrou);
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

  // L'Ouvert que le disque porte pour l'événement de l'Ouvert reçu, et la
  // source d'où il se relira : { frais, source }. Sans source, par l'état
  // (ouvrir). Un Ouvert de secours se relit par l'état quand celui-ci se lit
  // et que son texte n'est plus celui de l'ouverture : une écriture l'a
  // remplacé, et la source revient à l'état. Sinon — l'état illisible, ou
  // lisible et inchangé, que l'opérateur a écarté pour son secours (§ 8.9,
  // point 3) —, par sa source (ouvrirSecours) ; un .precedent dont le journal
  // lisible a reçu une entrée depuis cède au dernier instant du journal, qui
  // porte cette entrée, et la source devient 'journal'. Un journal qui ne se
  // lit plus — d'un format plus récent, mal encodé — laisse le .precedent,
  // lecture seule comprise. Un refus autre qu'ETAT_ILLISIBLE remonte. Sans
  // source, un état dont les octets ne sont plus de l'UTF-8 garde la séance
  // en lecture, comme un format plus récent : LECTURE_SEULE {raison:
  // 'ENCODAGE'} ; l'opérateur l'écarte en ouvrant un secours.
  async function relire(ouvert) {
    const { fs: systeme, racine: dossier, base, texteEtat } = ouvert;
    if (etat.source === null) {
      try {
        return { frais: await ouvrirSurDisque(systeme, dossier, base), source: null };
      } catch (erreur) {
        const illisible = erreur instanceof ErreurStockage && erreur.code === 'ETAT_ILLISIBLE';
        if (illisible && erreur.details.raison === 'ENCODAGE') throw refusEncodage();
        throw erreur;
      }
    }
    try {
      const parEtat = await ouvrirSurDisque(systeme, dossier, base);
      if (parEtat.texteEtat !== texteEtat) return { frais: parEtat, source: null };
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage && erreur.code === 'ETAT_ILLISIBLE')) throw erreur;
    }
    const parSource = await ouvrirSecoursSurDisque(systeme, dossier, base, etat.source);
    const derniere = derniereEntree(parSource);
    if (etat.source === 'precedent' && derniere !== null && derniere !== derniereEntree(ouvert)) {
      return { frais: await ouvrirSecoursSurDisque(systeme, dossier, base, 'journal'), source: 'journal' };
    }
    return { frais: parSource, source: etat.source };
  }

  // Relit l'événement de l'Ouvert, le verrou de la séance pris (relire). Ce
  // que la lecture rend devient l'Ouvert de la séance, journal et jalons
  // compris ; rend [EVENEMENT_CHANGE {revision}] quand sa révision ou sa
  // charge diffèrent de celles de l'Ouvert, [] sinon. Une entrée d'une autre
  // séance change toujours la révision relue : l'état qu'elle a écrit, ou le
  // dernier instant du journal qu'un .precedent lui cède (relire). Une
  // lecture refusée rend le verrou — ses avertissements deviennent ceux du
  // dernier geste —, et son refus remonte : la séance reste en lecture sur
  // l'Ouvert reçu.
  async function relireSousVerrou(ouvert) {
    let relu;
    try {
      relu = await relire(ouvert);
    } catch (erreur) {
      etat.avertissementsGeste = await rendreVerrou(ouvert);
      throw erreur;
    }
    const { frais, source } = relu;
    etat.ouvert = frais;
    etat.source = source;
    etat.formatLu = formatDe(frais.texteEtat);
    const change =
      frais.revision !== ouvert.revision || serialiserCharge(frais.charge) !== serialiserCharge(ouvert.charge);
    return change ? [avertissement('EVENEMENT_CHANGE', { revision: frais.revision })] : [];
  }

  // Le retour en lecture : le compte s'arrête, le verrou se rend, et
  // surAnnulation l'annonce ; le retour explicite annule en plus le geste
  // ouvert. Les avertissements du rendu s'ajoutent à ceux du dernier geste.
  async function quitterEcriture({ explicite = false } = {}) {
    suspendre();
    if (explicite) etat.gestes = 0;
    etat.mode = 'lecture';
    annoncerAnnulation();
    const avertissements = await rendreVerrou(etat.ouvert);
    etat.avertissementsGeste = [...etat.avertissementsGeste, ...avertissements];
    return avertissements;
  }

  // --- Les refus --------------------------------------------------------------

  function exigerOuvert() {
    if (etat.ouvert === null) throw new ErreurSeance('AUCUN_EVENEMENT');
    return etat.ouvert;
  }

  // Le remède d'un support rompu : écrire ailleurs, dans la racine documents
  // quand le support rompu en est une autre ; null, l'opérateur désigne le
  // dossier.
  const versAilleurs = () => ({ geste: 'ecrireAilleurs', racine: etat.ailleurs });

  function exigerSupport() {
    if (etat.supportRompu) throw new ErreurSeance('SUPPORT_ROMPU', { ...etat.refusSupport, remede: versAilleurs() });
  }

  // Quitter l'événement — ouvrir, créer, fermer, changer de racine — quand
  // le support est rompu perdrait la seule copie qu'écrire ailleurs peut
  // sauver : refusé, sauf sur abandon explicite.
  function exigerSauve({ abandonner = false } = {}) {
    if (etat.supportRompu && abandonner !== true) {
      throw new ErreurSeance('SUPPORT_ROMPU_NON_SAUVE', { ...etat.refusSupport, remede: versAilleurs() });
    }
  }

  // L'Ouvert, quand l'événement admet une écriture ; sinon le refus, dans
  // l'ordre de l'en-tête du module, son remède compris. Le refus courant de
  // l'état observable vient d'ici (refusCourant).
  function exigerEcriture() {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw refusFormat();
    if (estBloque(ouvert)) throw refusBloque();
    if (etat.mode === 'lecture') throw new ErreurSeance('MODE_LECTURE', { remede: { geste: 'modifier' } });
    exigerSupport();
    return ouvert;
  }

  // --- L'écriture d'un geste (§ 8.2, § 8.3, § 8.6) -------------------------------

  // Le support rompu par erreur, ECRITURE ou ETAT_NON_ECRIT : la séance garde
  // ouvert, l'Ouvert que le disque porte, et le refus, dont echec nomme ce
  // que le support n'a pas reçu : par défaut le code de l'erreur, la ligne
  // ou l'état d'un geste ; JALON_NON_ECRIT, le jalon d'un geste enregistré ;
  // VERROU_NON_ECRIT, le verrou d'un passage en écriture.
  // La racine documents, que le remède propose, se demande ensuite au
  // système : null quand le support rompu est elle, ou que le système ne la
  // dit pas.
  async function rompre(erreur, ouvert, echec = erreur.code) {
    const { chemin, dossier, cause } = erreur.details;
    etat.ouvert = ouvert;
    etat.supportRompu = true;
    etat.refusSupport = { echec, chemin, dossier, cause };
    etat.ailleurs = null;
    try {
      const { documents } = await fs.racines();
      etat.ailleurs = memeRacine(documents, ouvert.racine) ? null : documents;
    } catch {
      etat.ailleurs = null;
    }
  }

  // Une écriture du dépôt depuis l'Ouvert reçu ; ce qu'elle rend devient
  // l'Ouvert de la séance. ECRITURE rompt le support en gardant l'Ouvert
  // reçu, que rien n'a changé ; ETAT_NON_ECRIT, en gardant l'Ouvert avancé de
  // ses détails, son geste au journal. Le refus remonte.
  // Une écriture réussie porte l'état au format FORMAT : l'annonce d'un
  // format plus ancien tombe.
  async function ecrire(ouvert, ecriture) {
    try {
      etat.ouvert = await ecriture(ouvert);
      etat.formatLu = null;
      return etat.ouvert;
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'ECRITURE') await rompre(erreur, ouvert);
      if (erreur instanceof ErreurStockage && erreur.code === 'ETAT_NON_ECRIT') await rompre(erreur, erreur.details.ouvert);
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
    etat.source = null;
    const suite = [...avertissements];
    const etatDuPlan = ouvert.charge.evenement.etat;
    if (etatDuPlan !== depart.charge.evenement.etat) {
      const nom = libelle('JALON_ETAT', { etat: etatDuPlan });
      try {
        etat.ouvert = await nommerSurDisque(ouvert, { nom, ...commun });
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage && erreur.code === 'ECRITURE')) throw erreur;
        await rompre(erreur, ouvert, 'JALON_NON_ECRIT');
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
  // commande d'abord, qui ne touche rien ; puis, en lecture, le verrou, que
  // la séance prend, et la relecture de l'événement (relireSousVerrou) ; la
  // commande s'applique alors à ce qui est relu. Celui-ci d'un format plus
  // récent, ou que la commande refuse — une autre séance l'a débloqué —,
  // rend le verrou, la séance restant en lecture sur ce qu'elle a relu, et
  // le refus remonte. Sinon l'entrée et le jalon de l'état rendu s'écrivent,
  // et la séance reste en écriture.
  async function debloquerPlan(ouvert, args) {
    exigerSupport();
    let resultat = appliquerCommande('debloquer', ouvert.charge, args);
    let depart = ouvert;
    const avertissements = [];
    if (etat.mode !== 'ecriture') {
      avertissements.push(...(await prendreVerrou(ouvert)));
      avertissements.push(...(await relireSousVerrou(ouvert)));
      depart = etat.ouvert;
      try {
        if (depart.formatPlusRecent) throw refusFormat();
        resultat = appliquerCommande('debloquer', depart.charge, args);
      } catch (erreur) {
        etat.avertissementsGeste = [...avertissements, ...(await rendreVerrou(depart))];
        throw erreur;
      }
    }
    entrerEnEcriture();
    return ecrireGeste(depart, { ...resultat, avertissements: [...avertissements, ...resultat.avertissements] });
  }

  // La séance passe en écriture : le retour automatique précédent ne se dit
  // plus.
  function entrerEnEcriture() {
    etat.mode = 'ecriture';
    etat.retourAutomatique = false;
  }

  // Un geste nommé, sans son suivi : le refus, ou le libellé et ce que la
  // commande ajoute, puis ce que le geste fait naître, de la charge d'avant à
  // celle qu'il écrit (avertissementsApres). Un rendu au libellé null
  // n'écrit rien : la séance rend son résumé, le libellé null.
  async function geste(nom, args) {
    const ouvert = exigerOuvert();
    if (nom === 'debloquer' && !ouvert.formatPlusRecent && estBloque(ouvert)) {
      return { libelle: await debloquerPlan(ouvert, args) };
    }
    exigerEcriture();
    const resultat = appliquerCommande(nom, ouvert.charge, args);
    if (resultat.libelle === null) {
      etat.avertissementsGeste = [...resultat.avertissements];
      return { libelle: null, resume: resultat.resume };
    }
    const jalonAvant = nom === 'enregistrerGeneration' ? libelle('JALON_AVANT_GENERATION') : null;
    const avertissements = [...resultat.avertissements, ...avertissementsApres(ouvert.charge, resultat.charge)];
    const texte = await ecrireGeste(ouvert, { ...resultat, avertissements }, { jalonAvant });
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

  // {defaire, refaire} : les retours qui existent sur le fil de l'Ouvert ;
  // faux sans événement.
  function retoursDe(ouvert) {
    if (ouvert === null) return { defaire: false, refaire: false };
    const { cibleDefaire, cibleRefaire } = filDe(ouvert);
    return { defaire: cibleDefaire !== null, refaire: cibleRefaire !== null };
  }

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

  // La charge restituée, ses compteurs d'identifiants portés au plus grand
  // de leur valeur restituée et de leur valeur courante : un retour rend le
  // contenu d'un instant, jamais un identifiant déjà donné (§ 8.9) — une
  // génération après un défaire numérote au-delà des propositions défaites,
  // et le retenu d'un fil abandonné garde la proposition qu'il désignait.
  function avecCompteursCourants(charge, courante) {
    const prochainsIds = {};
    for (const cle of ['participant', 'table', 'proposition']) {
      prochainsIds[cle] = Math.max(charge.prochainsIds[cle], courante.prochainsIds[cle]);
    }
    return { ...charge, prochainsIds };
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
    const charge = avecCompteursCourants(restituer(ouvert, cible), ouvert.charge);
    if (serialiserCharge(charge) === serialiserCharge(ouvert.charge)) throw new ErreurSeance('SANS_EFFET', { sens });
    const instant = sens === 'defaire' ? courant : libelleDeRevision(ouvert.journal, cible);
    const entree = { charge, libelle: libelleDuRetour(sens, instant), avertissements: [] };
    const texte = await ecrireGeste(ouvert, entree, { sens, retour: cible });
    return { libelle: texte };
  }

  // --- Ouvrir, créer, fermer (§ 8.1, § 8.4) ----------------------------------------

  // Ferme l'événement ouvert : le compte s'arrête, le cadrage en attente
  // s'écrit, le verrou se rend, surAnnulation l'annonce, et la séance oublie
  // l'événement. Rend les avertissements du rendu.
  async function fermerEvenement() {
    suspendre();
    await viderCadrage();
    const avertissements = etat.ouvert === null ? [] : await rendreVerrou(etat.ouvert);
    if (etat.ouvert !== null) annoncerAnnulation();
    Object.assign(etat, {
      ouvert: null,
      source: null,
      mode: 'lecture',
      verrouTenu: false,
      supportRompu: false,
      refusSupport: null,
      ailleurs: null,
      verrouAutre: null,
      avertissementsGeste: [],
      gestes: 0,
      calculs: 0,
      fautives: [],
      formatLu: null,
      retourAutomatique: false,
      cadrage: null,
    });
    return avertissements;
  }

  // Ouvre en lecture l'Ouvert que rend lire, sans rien écrire, après avoir
  // fermé le précédent ; source dit d'où il se relit (relireSousVerrou).
  // L'ouverture garde les propositions qu'elle écarte, le format de l'état
  // lu et le cadrage mémorisé de l'événement.
  async function ouvrirAvec(lire, source, quitter) {
    exigerSauve(quitter);
    await fermerEvenement();
    const ouvert = await lire();
    etat.ouvert = ouvert;
    etat.source = source;
    etat.fautives = ouvert.examen.fautives;
    etat.formatLu = formatDe(ouvert.texteEtat);
    etat.cadrage = await cadrageMemorise(ouvert);
    return { base: ouvert.base, avertissements: ouvert.avertissements };
  }

  // Crée l'événement de ces champs (§ 2.1, étape 1) : la charge neuve
  // (chargeNeuve), dont un champ refusé lève avant que rien ne change —
  // l'événement ouvert reste, son mode et son verrou compris ; puis le
  // précédent se ferme, et s'écrivent l'entrée de création et le jalon
  // « Création », puis l'état. Le nouveau reste ouvert en lecture. Un état
  // que le support refuse d'écrire, le journal écrit, rompt le support. Le
  // support de l'événement ouvert rompu, refusé sauf abandon (exigerSauve).
  async function creerEvenement(champs, quitter) {
    exigerSauve(quitter);
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
      if (erreur instanceof ErreurStockage && erreur.code === 'ETAT_NON_ECRIT') await rompre(erreur, erreur.details.ouvert);
      throw erreur;
    }
    return { base: etat.ouvert.base };
  }

  // --- Les modes (§ 8.4, § 8.8) -------------------------------------------------------

  // Le verrou pris, l'événement se relit (relireSousVerrou) ; relu d'un
  // format plus récent, ou bloqué par une autre séance, il rend le verrou,
  // et la séance reste en lecture sur ce qu'elle a relu, le refus levé.
  async function passerEnEcriture() {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw refusFormat();
    if (estBloque(ouvert)) throw refusBloque();
    if (etat.mode === 'ecriture') return { avertissements: [] };
    exigerSupport();
    return entrerSousVerrou(ouvert, null);
  }

  // Reprendre le verrou (§ 8.8) : le passage en écriture qui reprend le
  // verrou refusé que verrouAutre garde, une fois que l'opérateur l'a
  // confirmé en voyant sa séance et depuis quand (prendreVerrou). Sans
  // verrou refusé, c'est un passage en écriture. Le refus d'un débloquer
  // admet la reprise : sur un plan bloqué, ou relu bloqué, le verrou repris
  // se rend aussitôt, la séance reste en lecture, et VERROU_REPRIS se lit
  // parmi les avertissements du dernier geste ; débloquer passe ensuite.
  async function reprendreVerrou() {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw refusFormat();
    if (etat.mode === 'ecriture') return { avertissements: [] };
    exigerSupport();
    const reprise = etat.verrouAutre;
    return entrerSousVerrou(ouvert, reprise === null ? null : { seance: reprise.seance, depuis: reprise.depuis }, {
      bloqueAdmis: true,
    });
  }

  // Prend le verrou — en reprenant celui que reprise nomme —, relit
  // l'événement, et passe en écriture. Relu d'un format plus récent, il rend
  // le verrou et lève le refus ; relu bloqué, il rend le verrou, et lève le
  // refus sauf bloqueAdmis, qui rend les avertissements.
  async function entrerSousVerrou(ouvert, reprise, { bloqueAdmis = false } = {}) {
    const avertissements = await prendreVerrou(ouvert, reprise);
    avertissements.push(...(await relireSousVerrou(ouvert)));
    const relu = etat.ouvert;
    let refus = null;
    if (relu.formatPlusRecent) refus = refusFormat();
    else if (estBloque(relu)) refus = refusBloque();
    if (refus !== null) {
      etat.avertissementsGeste = [...avertissements, ...(await rendreVerrou(relu))];
      if (bloqueAdmis && !relu.formatPlusRecent) return { avertissements: [...etat.avertissementsGeste] };
      throw refus;
    }
    entrerEnEcriture();
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
  // NFC, ses blancs de bord retirés. Un jalon qui pose d'abord l'entrée de
  // reprise avance la révision de l'Ouvert sans écrire l'état : le dernier
  // instant du journal porte désormais la charge de la séance, et la source
  // de la relecture devient 'journal'.
  async function nommer(nom) {
    try {
      const ouvert = exigerEcriture();
      if (typeof nom !== 'string') throw new TypeError(`nom : chaîne attendue, reçu ${JSON.stringify(nom)}`);
      const texte = nom.normalize('NFC').trim();
      if (texte === '') throw new ErreurSeance('NOM_REQUIS');
      const nomme = await ecrire(ouvert, (o) =>
        nommerSurDisque(o, { nom: texte, horodatage: horloge.horodatage(), libelleReprise }),
      );
      if (nomme.revision !== ouvert.revision) etat.source = 'journal';
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
  // laisse tout en l'état, le support toujours rompu. Réussi, il demande le
  // type du support de la racine nouvelle, et SUPPORT_AMOVIBLE {dossier}
  // annonce la garantie affaiblie d'un support amovible, comme la règle du
  // dossier de travail au démarrage (§ 8.8).
  //
  // Sans racine, le dossier se demande à l'opérateur par fs.choisirDossier ;
  // son annulation ne change rien, et rend null.
  async function ecrireAilleurs(designee) {
    const ouvert = exigerOuvert();
    if (ouvert.formatPlusRecent) throw refusFormat();
    if (!etat.supportRompu) throw new ErreurSeance('SUPPORT_INTACT');
    const nouvelle = designee ?? (await fs.choisirDossier());
    if (nouvelle === null) return null;
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
        await rompre(erreur, erreur.details.ouvert);
        etat.avertissementsGeste = await rendreVerrou(ouvert);
      }
      throw erreur;
    }
    const avertissements = await rendreVerrou(ouvert);
    Object.assign(etat, {
      ouvert: ailleurs,
      source: null,
      racine: nouvelle,
      supportRompu: false,
      refusSupport: null,
      ailleurs: null,
      formatLu: null,
    });
    if (etat.mode === 'ecriture') {
      try {
        avertissements.push(...(await prendreVerrou(ailleurs)));
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage)) throw erreur;
        etat.mode = 'lecture';
        avertissements.push(avertissement(erreur.code, erreur.details));
      }
    }
    if ((await typeDeSupport(nouvelle)) === 'amovible') {
      avertissements.push(avertissement('SUPPORT_AMOVIBLE', { dossier: nouvelle.chemin }));
    }
    etat.avertissementsGeste = avertissements;
    armer();
    return { base: ailleurs.base, avertissements };
  }

  // Le type du support de la racine (§ 8.8) ; 'inconnu' pour toute faute du
  // système qui le demande — un refus du stockage, une réponse du pont
  // illisible : l'événement y est déjà écrit et la séance transportée, et le
  // type ne sert qu'à un avertissement.
  async function typeDeSupport(dossier) {
    try {
      return await fs.typeSupport(dossier);
    } catch {
      return 'inconnu';
    }
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
    /** Ceux de l'état observable, dans son ordre (etat().avertissements). */
    get avertissements() {
      return [...lireEtat().avertissements];
    },
    /** {defaire, refaire} : les retours qui existent sur le fil courant (§ 8.3). */
    get retours() {
      return retoursDe(etat.ouvert);
    },
    get gesteEnCours() {
      return etat.gestes > 0;
    },
    get calculEnCours() {
      return etat.calculs > 0;
    },

    /**
     * L'état observable (EtatSeance), figé en profondeur : le même objet
     * entre deux changements, un neuf après chacun.
     */
    etat: () => lireEtat(),
    /**
     * Le contrat des magasins de Svelte : fn(etat) tout de suite, puis à
     * chaque changement ; rend la fonction qui désabonne.
     */
    subscribe(fn) {
      abonnes.add(fn);
      fn(lireEtat());
      return () => {
        abonnes.delete(fn);
      };
    },
    /**
     * fn() au passage en lecture, explicite ou automatique, et à la
     * fermeture de l'événement : le geste en cours s'annule. Rend la
     * fonction qui désabonne.
     */
    surAnnulation(fn) {
      annulations.add(fn);
      return () => {
        annulations.delete(fn);
      };
    },
    /** {k, tx, ty} : le cadrage de l'événement ouvert, mémorisé ou demandé ; null sinon. */
    cadrage: () => (etat.cadrage === null ? null : { ...etat.cadrage }),
    /**
     * Demande l'écriture différée du cadrage de l'événement ouvert dans
     * reglages_locaux.json (§ 8.5), vivante dans tout mode : l'état et le
     * journal ne s'écrivent pas. Une vue hors de sa règle — k nul, négatif
     * ou non fini, translation non finie — n'est pas demandée ; sans
     * événement, rien.
     */
    demanderCadrage(vue) {
      if (etat.ouvert === null) return;
      const evenement = etat.ouvert.charge.evenement.id;
      const cadrage = { k: vue?.k, tx: vue?.tx, ty: vue?.ty };
      try {
        avecCadrage({ cadrages: [] }, evenement, cadrage);
      } catch {
        return;
      }
      etat.cadrage = cadrage;
      ecrivain.demander({ racine: etat.ouvert.racine, evenement, cadrage });
    },

    // quitter.abandonner : vrai pour quitter l'événement d'un support rompu
    // (exigerSauve).
    ouvrir: (base, quitter) => enFile(() => ouvrirAvec(() => ouvrirSurDisque(fs, etat.racine, base), null, quitter)),
    ouvrirSecours: (base, source, quitter) =>
      enFile(() => ouvrirAvec(() => ouvrirSecoursSurDisque(fs, etat.racine, base, source), source, quitter)),
    creer: (champs, quitter) => enFile(() => creerEvenement(champs, quitter)),
    fermer: (quitter) =>
      enFile(async () => {
        exigerSauve(quitter);
        return { avertissements: await fermerEvenement() };
      }),
    /**
     * Ferme l'événement ouvert, comme fermer, puis fait de racine le dossier
     * de travail, où la séance ouvre et crée désormais ; rien ne s'écrit
     * sans événement ouvert.
     */
    changerRacine: (nouvelle, quitter) =>
      enFile(async () => {
        exigerSauve(quitter);
        const avertissements = await fermerEvenement();
        etat.racine = nouvelle;
        return { avertissements };
      }),
    passerEnEcriture: () => enFile(passerEnEcriture),
    /**
     * Reprend le verrou que verrouAutre garde, après la confirmation de
     * l'opérateur qui a vu sa séance et depuis quand (§ 8.8) : l'efface,
     * prend celui de la séance et passe en écriture, sous VERROU_REPRIS
     * {seance, depuis}. Un verrou qui a changé depuis le refus se refuse
     * VERROU_PRIS ; un verrou vivant ne se reprend jamais.
     */
    reprendreVerrou: () => enFile(reprendreVerrou),
    passerEnLecture: () => enFile(passerEnLecture),
    executer: (nom, args = {}) => enFile(() => suivi(() => geste(nom, args))),
    debloquer: () => enFile(() => suivi(() => geste('debloquer', {}))),
    defaire: () => enFile(() => suivi(() => retour('defaire', null))),
    refaire: () => enFile(() => suivi(() => retour('refaire', null))),
    revenir: (revision) => enFile(() => suivi(() => retour('revenir', revision))),
    nommer: (nom) => enFile(() => nommer(nom)),
    ecrireAilleurs: (nouvelle) => enFile(() => ecrireAilleurs(nouvelle)),
    /**
     * La forme nommée d'une proposition ou du retenu (formeNommeeDe) : une
     * lecture, admise dans tout mode, qui n'écrit rien.
     */
    formeNommee: (cible) => enFile(async () => formeNommeeDe(exigerOuvert().charge, cible)),
    /**
     * Une promesse résolue quand les appels déjà en file ont fini, réussis
     * ou refusés : ce qu'un lecteur de etat() lit ensuite porte leurs
     * écritures. Rien ne s'écrit ni ne se publie, et rien ne s'ajoute à la
     * file ; elle ne rejette jamais.
     */
    attendre: () => file,

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
      publier();
    },
    finirCalcul() {
      etat.calculs = Math.max(0, etat.calculs - 1);
      armer();
      publier();
    },
  };
}
