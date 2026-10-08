// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La génération (§ 5.7, § 5.8, § 5.10) : les exécuteurs qui font tourner la
// recherche du moteur, et le contrôleur qui la lance depuis la séance.
//
// Un exécuteur rend, pour une configuration et des réglages, une exécution :
// son résultat, une promesse des propositions de rechercher ; ses
// avancements ; son annulation, qui rejette le résultat par ErreurAnnulee,
// sans résultat partiel. L'exécuteur direct calcule dans le fil, une
// microtâche après le lancement : il sert les épreuves et le premier
// montage de l'application ; celui du travailleur (I13) calcule hors du fil
// et s'annule par terminate(). Une erreur de la recherche devient la même
// dans les deux, par versErreurGeneration.
//
// Le contrôleur tient aussi le réglage des cœurs de calcul, un réglage du
// poste qui vaut pour la séance de l'application et ne s'écrit nulle part :
// automatique, la génération emploie autant de cœurs que l'exécuteur annonce
// de processeurs logiques (coeursDisponibles, que src/main.js lit de la
// plateforme) ; sinon le nombre saisi, de 1 à ces disponibles. Un lancement
// en emploie min(nombre de propositions, cœurs réglés), et l'estimation
// compte en vagues de propositions calculées ensemble.
//
// Le contrôleur ne numérote rien et ne mesure aucun plan. Il refuse avant
// tout lancement un réglage hors de son domaine (REGLAGE_HORS_DOMAINE), puis
// ce que l'enregistrement refuserait — les refus de la séance, lus dans son
// état observable, dans l'ordre de son contrat —, puis
// ce qui rend la génération vaine ou impossible ; il garde la graine
// proposée et la durée du dernier calcul, en mémoire, pour la séance de
// l'application ; il vérifie les invariants de chaque proposition rendue,
// écarte celles dont le plan est déjà présent, et confie les autres à la
// commande enregistrerGeneration, une seule entrée du journal. Le nombre de
// propositions d'une génération est un réglage, jamais une constante d'ici.
//
// Le compte d'inactivité de la séance est suspendu pendant toute la
// génération (debuterCalcul), et repart à sa fin, quelle qu'elle soit
// (finirCalcul, dans un finally). Passer en lecture, ou fermer l'événement,
// annule la génération en cours (surAnnulation).
import { normaliser, nombrePlacesManquantes } from '../moteur/configuration.js';
import { ErreurAnnulee, ErreurConfiguration } from '../moteur/erreurs.js';
import { rechercher, verifierReglages } from '../moteur/recherche.js';
import { verifierInvariants } from '../moteur/verification.js';
import { GENERATION_PAR_DEFAUT, configurationDepuisCharge } from '../stockage/document.js';
import { derive, planDepuisFichier, versFichier } from '../stockage/placements.js';
import { lireEntier } from './capacite.js';

// src/interface reçoit l'annulation d'ici : elle ne joint pas le moteur.
export { ErreurAnnulee } from '../moteur/erreurs.js';

/** Au-delà de cette durée estimée, en secondes, la génération demande confirmation (§ 5.10). */
export const SEUIL_GENERATION_LONGUE_S = 60;

/** Le plafond d'usage d'une génération, en secondes (§ 5.10) : un repère dit, jamais un refus. */
export const PLAFOND_USAGE_S = 30 * 60;

// Sans durée mesurée, une génération de plus de mouvements que ce compte —
// dix fois le réglage par défaut — demande confirmation.
const MOUVEMENTS_SANS_MESURE = 10 * GENERATION_PAR_DEFAUT.nombre * GENERATION_PAR_DEFAUT.arret;

// La plus grande graine, et le modulo de la suivante.
const GRAINE_MAX = 2 ** 32 - 1;
const GRAINES = 2 ** 32;

// Les champs des réglages, dans l'ordre où leurs refus se rendent, et le
// domaine de chacun ; max null : sans borne.
const CHAMPS = [
  ['graine', 0, GRAINE_MAX],
  ['nombre', 1, null],
  ['arret', 1, null],
  ['historique', 1, null],
];

const versSection = (section) => ({ geste: 'ouvrirSection', section });

/**
 * Refus ou échec d'une génération : son code et ses détails — ceux de la
 * séance, du moteur ou du contrôleur, tels quels. Le texte affiché est celui
 * de son code, nu (§ 14.6) ; le message, code et détails en JSON, sert aux
 * traces.
 */
export class ErreurGeneration extends Error {
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
ErreurGeneration.prototype.name = 'ErreurGeneration';

/**
 * Les réglages d'une génération, contrôlés par la règle de rechercher
 * (verifierReglages) avant tout calcul. Lève, pour le premier réglage hors
 * de son domaine, ErreurGeneration('REGLAGE_HORS_DOMAINE', { reglage,
 * remede: null }), reglage étant son nom — graine, arret, historique ou
 * nombre —, sans le message du moteur ; ne rend rien sinon. Toute autre
 * erreur du contrôle est relevée telle quelle.
 *
 * @param {Object} reglages
 */
export function exigerReglages(reglages) {
  try {
    verifierReglages(reglages);
  } catch (erreur) {
    if (erreur instanceof RangeError && typeof erreur.reglage === 'string') {
      throw new ErreurGeneration('REGLAGE_HORS_DOMAINE', { reglage: erreur.reglage, remede: null });
    }
    throw erreur;
  }
}

/**
 * Le nombre de processeurs logiques d'un poste, tel que la plateforme le
 * donne — hyperthreads compris —, rendu utilisable : un entier d'au moins 1
 * tel quel, 1 pour toute autre valeur, absente comprise.
 *
 * @param {unknown} valeur
 * @returns {number}
 */
export function coeursDe(valeur) {
  return Number.isInteger(valeur) && valeur >= 1 ? valeur : 1;
}

/**
 * L'erreur d'une recherche, la même dans les deux exécuteurs : ErreurAnnulee
 * telle quelle ; une ErreurConfiguration devient ErreurGeneration de son code
 * et de ses détails ; toute autre, RangeError comprise, est rendue telle
 * quelle, pour être relevée. Les réglages sont contrôlés avant le calcul
 * (exigerReglages) : une RangeError qui survient pendant lui vient d'ailleurs,
 * d'un abonné aux avancements par exemple, et ne se dit pas comme un réglage.
 *
 * @param {unknown} erreur
 * @returns {unknown}
 */
export function versErreurGeneration(erreur) {
  if (erreur instanceof ErreurAnnulee) return erreur;
  if (erreur instanceof ErreurConfiguration) return new ErreurGeneration(erreur.code, erreur.details);
  return erreur;
}

/**
 * @typedef {Object} Execution
 * @property {(fn: (fait: number, total: number) => void) => () => void} surAvancement
 *           abonne fn aux avancements ; rend la fonction qui désabonne
 * @property {Promise<import('../moteur/recherche.js').Proposition[]>} resultat
 *           rejetée par ErreurAnnulee à l'annulation, par ErreurGeneration sur
 *           une erreur du moteur ; les propositions par identifiant croissant
 * @property {() => void} annuler   sans résultat partiel
 * @property {number} [coeurs]       les cœurs que le calcul emploie ; 1 s'il
 *           ne le dit pas
 *
 * @typedef {Object} Executeur
 * @property {(configuration: Object, reglages: Object, options?: {coeurs?: number}) => Execution} lancer
 *           options.coeurs : les cœurs que le calcul peut employer, 1 par défaut
 * @property {number} [coeursDisponibles]   les processeurs logiques du poste ;
 *           1 s'il ne le dit pas
 */

/**
 * L'exécuteur direct : rechercher dans le fil, une microtâche après lancer.
 * Rien d'autre ne s'exécute pendant la recherche. annuler(), avant ce départ
 * ou depuis un rappel d'avancement, fait lever ErreurAnnulee à la lecture
 * suivante du signal par le moteur : avant la proposition suivante, au plus
 * 1 000 mouvements plus tard. Chaque avancement est celui du moteur, toutes
 * les 1 000 itérations. Il calcule une proposition après l'autre quel que
 * soit options.coeurs, et chaque exécution dit n'employer qu'un cœur ; il
 * annonce les cœurs qu'on lui donne, par coeursDe, pour qu'une épreuve règle
 * ce que le contrôleur en lit.
 *
 * @param {{coeursDisponibles?: unknown}} [options]
 * @returns {Executeur}
 */
export function creerExecuteurDirect({ coeursDisponibles } = {}) {
  return {
    coeursDisponibles: coeursDe(coeursDisponibles),
    lancer(configuration, reglages) {
      const signal = { aborted: false };
      const abonnes = new Set();
      const progression = (fait, total) => {
        for (const fn of [...abonnes]) fn(fait, total);
      };
      const resultat = Promise.resolve().then(() => {
        exigerReglages(reglages);
        try {
          return rechercher(configuration, reglages, { signal, progression });
        } catch (erreur) {
          throw versErreurGeneration(erreur);
        }
      });
      return {
        surAvancement(fn) {
          abonnes.add(fn);
          return () => {
            abonnes.delete(fn);
          };
        },
        resultat,
        annuler() {
          signal.aborted = true;
        },
        coeurs: 1,
      };
    },
  };
}

// Le plan d'une proposition du moteur, rangé comme planDepuisFichier rend
// celui d'une proposition enregistrée : la même mise en forme, versFichier
// puis planDepuisFichier, pour que deux plans égaux s'écrivent pareil.
function planRange(proposition, configuration, produitVersion) {
  const fichier = versFichier(proposition, configuration, { produitVersion, attribuerSieges: false, decalage: 0 });
  return JSON.stringify(planDepuisFichier(fichier));
}

/**
 * Le contrôleur de génération d'une séance (§ 5.7, § 5.10).
 *
 * @param {Object} parametres
 * @param {Object} parametres.seance        la séance d'A1 et A2 : etat,
 *        subscribe, surAnnulation, executer, debuterCalcul, finirCalcul
 * @param {Executeur} parametres.executeur   coeursDisponibles, qu'il annonce,
 *        borne le réglage des cœurs
 * @param {import('./horloge.js').Horloge} parametres.horloge   instant() mesure
 *        la durée d'un calcul
 * @param {string} parametres.produitVersion
 * @returns {Object} le contrôleur : grainePropose, reglagesProposes, valider,
 *          estimer, derniereGeneration, generer, annuler, coeurs,
 *          reglerCoeurs, subscribe
 */
export function creerControleurGeneration({ seance, executeur, horloge, produitVersion }) {
  // graine : la graine proposée ; base : celle de l'événement ouvert, null
  // sans événement ; mesure : le dernier calcul abouti, null avant lui ;
  // execution : celle en cours, null hors génération ; enCours vaut vrai du
  // lancement à la fin de l'enregistrement.
  // coeurs : le réglage des cœurs de calcul, que l'observable porte —
  // automatique, le nombre saisi (manuel), les disponibles, et nombre, les
  // cœurs réglés.
  let graine = 1;
  let base = null;
  let mesure = null;
  let execution = null;
  const disponibles = coeursDe(executeur.coeursDisponibles);
  let reglageCoeurs = { automatique: true, manuel: disponibles };
  const coeurs = () => ({
    ...reglageCoeurs,
    disponibles,
    nombre: reglageCoeurs.automatique ? disponibles : reglageCoeurs.manuel,
  });
  let observable = { enCours: false, fait: 0, total: 0, annulee: null, coeurs: coeurs() };
  const abonnes = new Set();

  function publier(changements) {
    observable = { ...observable, ...changements };
    for (const fn of [...abonnes]) fn(observable);
  }

  // Une ouverture : l'événement passe de null, ou d'une autre base, à une
  // base ; la graine proposée repart de 1.
  seance.subscribe((etat) => {
    const suivante = etat.evenement?.base ?? null;
    if (suivante !== null && suivante !== base) graine = 1;
    base = suivante;
  });

  // Les réglages de génération de la charge ouverte, ceux d'une charge
  // neuve sans événement.
  const reglagesDeLaCharge = () => seance.etat().charge?.reglages.generation ?? GENERATION_PAR_DEFAUT;

  function annulerAvec(cause) {
    if (execution === null) return;
    const courante = execution;
    publier({ annulee: cause });
    courante.annuler();
  }

  // Les cœurs qu'un lancement de nombre propositions emploie.
  const coeursPour = (nombre) => Math.min(nombre, coeurs().nombre);

  // Les mouvements d'une génération qui se suivent sur un même cœur : arret
  // pour chacune des ⌈nombre / cœurs⌉ vagues de propositions calculées
  // ensemble.
  const mouvementsParCoeur = (nombre, arret, parallele) => Math.ceil(nombre / parallele) * arret;

  // La durée d'une génération, proportionnelle aux mouvements qui se suivent
  // sur un même cœur, ceux de la mesure ramenés aux cœurs qu'elle a employés.
  function estimer({ nombre, arret }) {
    if (mesure === null) return { inconnue: true };
    const parallele = coeursPour(nombre);
    const secondes =
      (mouvementsParCoeur(nombre, arret, parallele) * mesure.dureeMs) /
      (mouvementsParCoeur(mesure.nombre, mesure.arret, mesure.coeurs) * 1000);
    return {
      secondes,
      longue: secondes > SEUIL_GENERATION_LONGUE_S,
      auDelaDuPlafond: secondes > PLAFOND_USAGE_S,
      mesure: { ...mesure },
      coeurs: parallele,
    };
  }

  // Longue : au-delà du seuil estimé, ou, sans mesure, quand les mouvements
  // qui se suivent sur un même cœur dépassent dix fois le réglage par défaut.
  function estLongue(reglages, estimation) {
    if (estimation.inconnue === true) {
      return mouvementsParCoeur(reglages.nombre, reglages.arret, coeursPour(reglages.nombre)) > MOUVEMENTS_SANS_MESURE;
    }
    return estimation.longue;
  }

  // Les refus d'avant lancement : les réglages d'abord, puis l'ordre du
  // contrat ; rend la configuration et son instance quand la génération peut
  // partir.
  function exigerLancement(reglages, confirmee) {
    exigerReglages(reglages);
    const etat = seance.etat();
    if (etat.evenement === null) throw new ErreurGeneration('AUCUN_EVENEMENT', { remede: null });
    if (etat.refus !== null) throw new ErreurGeneration(etat.refus.code, etat.refus.details);
    if (execution !== null || observable.enCours) throw new ErreurGeneration('GENERATION_EN_COURS', { remede: null });
    const { charge } = etat;
    if (!charge.participants.some(({ exclu }) => !exclu)) {
      throw new ErreurGeneration('AUCUN_PARTICIPANT', { remede: versSection('participants') });
    }
    if (charge.tables.length === 0) throw new ErreurGeneration('AUCUNE_TABLE', { remede: versSection('tables') });
    const configuration = configurationDepuisCharge(charge);
    let instance;
    try {
      instance = normaliser(configuration);
    } catch (erreur) {
      if (erreur instanceof ErreurConfiguration) throw new ErreurGeneration(erreur.code, { ...erreur.details, remede: null });
      throw erreur;
    }
    const placesManquantes = nombrePlacesManquantes(instance);
    if (placesManquantes > 0) {
      throw new ErreurGeneration('PLACES_MANQUANTES', { placesManquantes, remede: versSection('tables') });
    }
    const estimation = estimer(reglages);
    if (!confirmee && estLongue(reglages, estimation)) {
      throw new ErreurGeneration('CONFIRMATION_REQUISE', { estimation, remede: null });
    }
    return { configuration, instance };
  }

  // Le calcul confié à l'exécuteur : ses avancements publiés, son annulation
  // par la séance suivie ; rend les propositions et la durée du calcul. Une
  // annulation lève ErreurAnnulee, même quand l'exécuteur a rendu un
  // résultat entre-temps.
  async function calculer(configuration, reglages) {
    const debut = horloge.instant();
    execution = executeur.lancer(configuration, reglages, { coeurs: coeursPour(reglages.nombre) });
    const employes = coeursDe(execution.coeurs);
    const desabonner = execution.surAvancement((fait, total) => publier({ fait, total }));
    const desannuler = seance.surAnnulation(() => annulerAvec('seance'));
    try {
      const propositions = await execution.resultat;
      if (observable.annulee !== null) throw new ErreurAnnulee();
      return { propositions, dureeMs: horloge.instant() - debut, coeurs: employes };
    } finally {
      desabonner();
      desannuler();
      execution = null;
    }
  }

  // Les propositions à enregistrer, par identifiant du moteur croissant :
  // chacune sans violation des invariants, sinon GENERATION_INVARIANT_VIOLE,
  // rang compris — la place de la proposition dans la suite des graines du
  // lancement, qui n'est l'identifiant d'aucune proposition enregistrée ; puis sans
  // celles dont le plan est celui d'une proposition présente sans dérive, ou
  // d'une proposition déjà gardée de ce lancement.
  function trier(propositions, configuration, instance) {
    const ordonnees = [...propositions].sort((a, b) => a.id - b.id);
    for (const proposition of ordonnees) {
      const violations = verifierInvariants(instance, proposition.plan);
      if (violations.length > 0) {
        throw new ErreurGeneration('GENERATION_INVARIANT_VIOLE', { rang: proposition.id, violations, remede: null });
      }
    }
    const charge = seance.etat().charge;
    const presents = new Set(
      charge.propositions.filter((p) => derive(p, charge).length === 0).map((p) => JSON.stringify(planDepuisFichier(p))),
    );
    const gardees = [];
    for (const proposition of ordonnees) {
      const plan = planRange(proposition, configuration, produitVersion);
      if (presents.has(plan)) continue;
      presents.add(plan);
      gardees.push(proposition);
    }
    return { gardees, identiques: ordonnees.length - gardees.length };
  }

  // Les identifiants que l'enregistrement a donnés : ceux des propositions
  // de la charge qui n'étaient pas avant le geste, et qui portent la graine,
  // l'arrêt et l'historique d'une proposition gardée ; croissants.
  function ajouteesDans(charge, avant, gardees) {
    const cles = new Set(gardees.map(({ graine: g, arret, historique }) => `${g}|${arret}|${historique}`));
    return charge.propositions
      .filter(({ id, graine: g, arret, historique }) => !avant.has(id) && cles.has(`${g}|${arret}|${historique}`))
      .map(({ id }) => id)
      .sort((a, b) => a - b);
  }

  async function generer(reglages, { confirmee = false } = {}) {
    const { configuration, instance } = exigerLancement(reglages, confirmee);
    graine = (reglages.graine + 1) % GRAINES;
    publier({ enCours: true, fait: 0, total: reglages.nombre * reglages.arret, annulee: null });
    seance.debuterCalcul();
    try {
      const { propositions, dureeMs, coeurs: employes } = await calculer(configuration, reglages);
      mesure = {
        dureeMs,
        mouvements: reglages.nombre * reglages.arret,
        participants: instance.N,
        nombre: reglages.nombre,
        arret: reglages.arret,
        coeurs: employes,
      };
      const { gardees, identiques } = trier(propositions, configuration, instance);
      if (gardees.length === 0) return { ajoutees: [], identiques, dureeMs };
      const avant = new Set(seance.etat().charge.propositions.map(({ id }) => id));
      await seance.executer('enregistrerGeneration', { propositions: gardees, configuration, produitVersion });
      return { ajoutees: ajouteesDans(seance.etat().charge, avant, gardees), identiques, dureeMs };
    } finally {
      seance.finirCalcul();
      publier({ enCours: false });
    }
  }

  return {
    /** La graine proposée : 1 à chaque ouverture, puis la dernière lancée plus un, modulo 2^32. */
    grainePropose: () => graine,
    /** { graine, nombre, arret, historique } : la graine proposée, les trois autres de la charge. */
    reglagesProposes() {
      const { nombre, arret, historique } = reglagesDeLaCharge();
      return { graine, nombre, arret, historique };
    },
    /**
     * Les saisies des quatre champs, chacune lue par lireEntier (NON_ENTIER
     * {saisie}), puis bornée à son domaine (HORS_DOMAINE {min, max}, max null
     * sans borne) ; un historique non saisi — absent, null ou blanc — vaut
     * celui de la charge. Rend { reglages, refus } : reglages null dès
     * qu'un champ est refusé, refus dans l'ordre des champs.
     */
    valider(saisies) {
      const reglages = {};
      const refus = [];
      for (const [champ, min, max] of CHAMPS) {
        const saisie = saisies[champ];
        if (champ === 'historique' && (saisie === undefined || saisie === null || (typeof saisie === 'string' && saisie.trim() === ''))) {
          reglages.historique = reglagesDeLaCharge().historique;
          continue;
        }
        const lu = lireEntier(saisie);
        if (lu.refus !== undefined) {
          refus.push({ champ, code: lu.refus.code, details: lu.refus.details });
        } else if (lu.valeur < min || (max !== null && lu.valeur > max)) {
          refus.push({ champ, code: 'HORS_DOMAINE', details: { min, max, remede: null } });
        } else {
          reglages[champ] = lu.valeur;
        }
      }
      return { reglages: refus.length === 0 ? reglages : null, refus };
    },
    /**
     * L'estimation des réglages, proportionnelle aux mouvements qui se
     * suivent sur un même cœur — arret × ⌈nombre / cœurs⌉ —, ceux de la
     * dernière mesure ramenés de même aux cœurs qu'elle a employés :
     * { inconnue: true } sans elle, sinon { secondes, longue,
     * auDelaDuPlafond, mesure, coeurs }, coeurs étant ceux que ces réglages
     * emploieraient.
     */
    estimer,
    /**
     * La mesure du dernier calcul abouti de ce contrôleur, en mémoire ; null
     * avant lui : { dureeMs, mouvements, participants, nombre, arret,
     * coeurs }, coeurs étant ceux que l'exécution a employés.
     */
    derniereGeneration: () => (mesure === null ? null : { ...mesure }),
    /**
     * Lance une génération et l'enregistre : { ajoutees, identiques, dureeMs }.
     * Refuse avant tout lancement, par ErreurGeneration, dans cet ordre :
     * REGLAGE_HORS_DOMAINE {reglage} ; AUCUN_EVENEMENT ; le refus courant de
     * la séance ; GENERATION_EN_COURS ;
     * AUCUN_PARTICIPANT ; AUCUNE_TABLE ; le refus de normaliser ;
     * PLACES_MANQUANTES ; CONFIRMATION_REQUISE {estimation}, que
     * confirmee lève. Après la recherche : GENERATION_INVARIANT_VIOLE
     * {rang, violations}, puis ce
     * qu'executer lève, tel quel. Annulée : ErreurAnnulee.
     */
    generer,
    /** Annule la génération en cours, sans résultat partiel ; annulee vaut 'commande'. */
    annuler: () => annulerAvec('commande'),
    /**
     * Le réglage des cœurs de calcul : { automatique, manuel, disponibles,
     * nombre } — automatique vrai à la création ; manuel, le dernier nombre
     * saisi, les disponibles avant toute saisie ; disponibles, ceux
     * qu'annonce l'exécuteur, par coeursDe ; nombre, les cœurs réglés,
     * disponibles en automatique, manuel sinon.
     */
    coeurs,
    /**
     * Règle les cœurs de calcul, pour la séance de l'application : rien ne
     * s'écrit, ni état, ni journal. saisie, quand elle est donnée, se lit
     * par lireEntier (NON_ENTIER {saisie}), puis se borne de 1 aux
     * disponibles (HORS_DOMAINE {min: 1, max}), remède null ; refusée, rien
     * ne change, automatique compris. Rend { refus: null } ou { refus:
     * {code, details} } ; un réglage accepté se publie aux abonnés.
     */
    reglerCoeurs({ automatique, saisie } = {}) {
      const suivant = { ...reglageCoeurs };
      if (saisie !== undefined) {
        const lu = lireEntier(saisie);
        if (lu.refus !== undefined) return { refus: { code: lu.refus.code, details: lu.refus.details } };
        if (lu.valeur < 1 || lu.valeur > disponibles) {
          return { refus: { code: 'HORS_DOMAINE', details: { min: 1, max: disponibles, remede: null } } };
        }
        suivant.manuel = lu.valeur;
      }
      if (automatique !== undefined) suivant.automatique = automatique === true;
      reglageCoeurs = suivant;
      publier({ coeurs: coeurs() });
      return { refus: null };
    },
    /**
     * Le contrat des magasins de Svelte sur { enCours, fait, total, annulee,
     * coeurs } : annulee, la cause de la dernière annulation, 'commande' ou
     * 'seance', null dès le lancement suivant ; coeurs, le réglage des
     * cœurs de calcul, celui que rend coeurs().
     */
    subscribe(fn) {
      abonnes.add(fn);
      fn(observable);
      return () => {
        abonnes.delete(fn);
      };
    },
  };
}
