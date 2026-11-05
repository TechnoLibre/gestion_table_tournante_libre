// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La génération (§ 5.7, § 5.8, § 5.10) : les exécuteurs qui font tourner la
// recherche du moteur, et le contrôleur qui la lance depuis la séance.
//
// Un exécuteur rend, pour une configuration et des réglages, une exécution :
// son résultat, une promesse des propositions de rechercher — de repartir
// sous un départ ; ses
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
// compte en vagues de propositions calculées ensemble, chacune ralentie de
// ρ(W) : un cœur va moins vite quand ses voisins travaillent aussi. ρ croît
// de 1, sur un cœur seul, à RALENTISSEMENT_PLEINE_CHARGE du registre des
// constantes, quand les L processeurs logiques travaillent (ralentissement).
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
// Le départ (§ 5.7, C6, C8). generer reçoit, pour une génération dérivée, le
// départ {id, toursFiges} que l'interface a choisi ; le contrôleur n'en
// garde rien d'une génération à l'autre. Les refus du départ (refusDuDepart)
// se posent après ceux de la séance et de la charge, avant la question de la
// génération longue, dont l'estimation ne distingue pas une dérivée. Un
// départ en dérive par ses seuls participants part : l'exécuteur reçoit le
// départ ajusté à la présence (departDuMoteur) — son plan, par
// identifiants, ses tours figés et les réserves imposées de ses arrivantes
// sans chaise —, et calcule par repartir ; l'enregistrement reçoit la
// dérivation {depart, toursFiges}. Sans départ, ni l'exécuteur ni
// l'enregistrement ne reçoivent de clé de plus : une génération ordinaire
// lance rechercher sur les seuls cœurs. Une dérivée identique à son départ,
// proposition présente sans dérive, est écartée comme toute identique, et
// comptée aussi à part (identiquesAuDepart) ; une dérivée égale au départ
// ajusté d'un départ en dérive est gardée, puisque rien de comparable ne la
// porte encore. L'issue dit si le départ était en dérive, ses écarts
// (ecartsDuDepart) et, quand le retenu vient de ce départ et en diffère à un
// tour figé, l'avertissement DEPART_ECART_AU_RETENU.
//
// La course (§ 5.10). Chaque proposition du moteur porte ses mouvements
// évalués et ses points de relevé ; le contrôleur la confie telle quelle à
// enregistrerGeneration. Ce qui dépend de la machine ne vaut que pour la
// séance et ne s'écrit nulle part : le résumé de chaque génération — la
// durée prise autour du calcul entier, les cœurs employés, la somme des
// mouvements évalués de toutes les propositions calculées, identiques
// écartées comprises, et leur nombre —, rattaché à chaque proposition
// qu'elle a ajoutée, sous la graine, le compte d'arrêt et l'historique que
// celle-ci portait. Aucune proposition n'est datée seule. Ce qui est gardé
// s'oublie quand l'événement se ferme ou qu'un autre s'ouvre ; un
// rechargement de l'application l'oublie avec le contrôleur.
//
// Le compte d'inactivité de la séance est suspendu pendant toute la
// génération (debuterCalcul), et repart à sa fin, quelle qu'elle soit
// (finirCalcul, dans un finally). Passer en lecture, ou fermer l'événement,
// annule la génération en cours (surAnnulation).
import { constante } from '../geometrie/constantes.js';
import { normaliser, placesManquantesParTour } from '../moteur/configuration.js';
import { ErreurAnnulee, ErreurConfiguration } from '../moteur/erreurs.js';
import { rechercher, repartir, verifierReglages } from '../moteur/recherche.js';
import { verifierInvariants } from '../moteur/verification.js';
import { GENERATION_PAR_DEFAUT } from '../stockage/document.js';
import { derive, planDepuisFichier, versFichier } from '../stockage/placements.js';
import { lireEntier } from './capacite.js';
import { configurationDe } from './configuration.js';
import { departDuMoteur as departPourLeMoteur, ecartAuRetenu, ecartsDuDepart, refusDuDepart } from './depart.js';

// src/interface reçoit l'annulation d'ici : elle ne joint pas le moteur.
export { ErreurAnnulee } from '../moteur/erreurs.js';

/** Au-delà de cette durée estimée, en secondes, la génération demande confirmation (§ 5.10). */
export const SEUIL_GENERATION_LONGUE_S = 60;

/** Le plafond d'usage d'une génération, en secondes (§ 5.10) : un repère dit, jamais un refus. */
export const PLAFOND_USAGE_S = 30 * 60;

// Sans durée mesurée, une génération dont le coût — les mouvements qui se
// suivent sur un même cœur, ralentissement compris — dépasse ce compte
// demande confirmation (§ 5.10). Le compte s'écrit en clair et ne suit pas
// les réglages d'une charge neuve : leurs vingt propositions de 2 000 000
// mouvements le dépassent sur un poste de moins de dix processeurs logiques,
// et la première génération d'une séance, sans mesure, y demande alors
// confirmation.
const MOUVEMENTS_SANS_MESURE = 10_000_000;

// Le ralentissement d'un cœur quand tous les processeurs logiques
// travaillent, nommé dans le registre des constantes mesurées (§ 14.1) : un
// nom de constante, que la table des libellés ne connaît pas.
const RALENTISSEMENT = Object.freeze({ nom: 'RALENTISSEMENT_PLEINE_CHARGE' });

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
 * Le ralentissement d'un cœur quand W cœurs travaillent ensemble sur un
 * poste de L processeurs logiques : le rapport de la durée d'une même
 * proposition sur l'un d'eux à sa durée sur un cœur seul. Il croît en ligne
 * droite de 1, à W = 1, à rhoMax, à W = L : 1 + (rhoMax − 1)(W − 1)/(L − 1).
 * Un poste d'un seul processeur logique n'a aucun ralentissement : 1.
 *
 * @param {number} W   les cœurs employés, de 1 à L
 * @param {number} L   les processeurs logiques du poste, au moins 1
 * @param {number} rhoMax   le ralentissement à pleine charge, W = L
 * @returns {number}
 */
export function ralentissement(W, L, rhoMax) {
  if (L === 1) return 1;
  return 1 + ((rhoMax - 1) * (W - 1)) / (L - 1);
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
 * @property {(configuration: Object, reglages: Object, options?: {coeurs?: number,
 *           depart?: import('../moteur/recherche.js').DepartRecherche|null}) => Execution} lancer
 *           options.coeurs : les cœurs que le calcul peut employer, 1 par
 *           défaut ; options.depart : le départ d'une génération dérivée, le
 *           plan par identifiants et les tours figés, que repartir reçoit ;
 *           null ou absent, une génération ordinaire, par rechercher
 * @property {number} [coeursDisponibles]   les processeurs logiques du poste ;
 *           1 s'il ne le dit pas
 */

/**
 * L'exécuteur direct : rechercher dans le fil, une microtâche après lancer ;
 * repartir sous un départ (options.depart non null), qui lui donne le plan et
 * les tours figés tels quels.
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
    lancer(configuration, reglages, { depart = null } = {}) {
      const signal = { aborted: false };
      const abonnes = new Set();
      const progression = (fait, total) => {
        for (const fn of [...abonnes]) fn(fait, total);
      };
      const resultat = Promise.resolve().then(() => {
        exigerReglages(reglages);
        try {
          if (depart === null) return rechercher(configuration, reglages, { signal, progression });
          return repartir(configuration, reglages, depart, { signal, progression });
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
 * @param {(nom: string) => number|null} [parametres.constante]   la lecture
 *        du registre des constantes, constante de constantes.js par défaut ;
 *        le contrôleur y lit RALENTISSEMENT_PLEINE_CHARGE à chaque
 *        estimation, sans en garder la valeur
 * @returns {Object} le contrôleur : grainePropose, reglagesProposes, valider,
 *          estimer, derniereGeneration, generationDe, generer, annuler,
 *          coeurs, reglerCoeurs, subscribe
 */
export function creerControleurGeneration({ seance, executeur, horloge, produitVersion, constante: lireConstante = constante }) {
  // graine : la graine proposée ; cle : la clé de l'événement ouvert
  // (cleEvenement), null sans événement ; mesure : le dernier calcul abouti,
  // null avant lui ; execution : celle en cours, null hors génération ;
  // enCours vaut vrai du lancement à la fin de l'enregistrement.
  // coeurs : le réglage des cœurs de calcul, que l'observable porte —
  // automatique, le nombre saisi (manuel), les disponibles, et nombre, les
  // cœurs réglés.
  // generations : par identifiant d'une proposition ajoutée ici, { graine,
  // arret, historique, resume }, ce qu'elle portait à l'ajout et le résumé
  // de sa génération ; vidé quand cle change.
  let graine = 1;
  let cle = null;
  let mesure = null;
  let execution = null;
  const generations = new Map();
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

  // Une ouverture : l'événement passe de null, ou d'une autre clé, à une
  // clé (cleEvenement) ; la graine proposée repart de 1.
  // Une fermeture, ou l'ouverture d'un autre événement, oublie les
  // générations gardées.
  seance.subscribe((etat) => {
    const suivante = etat.evenement?.cle ?? null;
    if (suivante !== null && suivante !== cle) graine = 1;
    if (suivante !== cle) generations.clear();
    cle = suivante;
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

  // Le coût d'une génération sur parallele cœurs, en mouvements d'un cœur
  // seul : ceux qui se suivent sur un même cœur, ralentis de ρ(parallele)
  // sur les processeurs logiques du poste. ρ à pleine charge se lit au
  // registre à chaque appel.
  const cout = (nombre, arret, parallele) =>
    mouvementsParCoeur(nombre, arret, parallele) * ralentissement(parallele, disponibles, lireConstante(RALENTISSEMENT.nom));

  // La durée d'une génération, proportionnelle à son coût, celui de la
  // mesure ramené aux cœurs qu'elle a employés : à cœurs égaux, le
  // ralentissement se simplifie.
  function estimer({ nombre, arret }) {
    if (mesure === null) return { inconnue: true };
    const parallele = coeursPour(nombre);
    const secondes =
      (cout(nombre, arret, parallele) * mesure.dureeMs) / (cout(mesure.nombre, mesure.arret, mesure.coeurs) * 1000);
    return {
      secondes,
      longue: secondes > SEUIL_GENERATION_LONGUE_S,
      auDelaDuPlafond: secondes > PLAFOND_USAGE_S,
      mesure: { ...mesure },
      coeurs: parallele,
    };
  }

  // Longue : au-delà du seuil estimé, ou, sans mesure, quand le coût — les
  // mouvements qui se suivent sur un même cœur, ralentis de ρ — dépasse
  // MOUVEMENTS_SANS_MESURE.
  function estLongue(reglages, estimation) {
    if (estimation.inconnue === true) {
      return cout(reglages.nombre, reglages.arret, coeursPour(reglages.nombre)) > MOUVEMENTS_SANS_MESURE;
    }
    return estimation.longue;
  }

  // Les refus d'avant lancement : les réglages d'abord, puis l'ordre du
  // contrat, le refus du départ après les places manquantes et avant la
  // confirmation ; rend la configuration, son instance, le départ du moteur
  // — plan du départ ajusté, copie des tours figés et réserves imposées,
  // null sans départ — et ce que l'issue dit du départ, quand la génération
  // peut partir. Les places manquantes se jugent tour par tour : leurs
  // détails portent tours dès qu'une personne non exclue manque un tour,
  // chaque tour à manque positif, comme le moteur les lève.
  function exigerLancement(reglages, confirmee, depart) {
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
    const configuration = configurationDe(charge);
    let instance;
    try {
      instance = normaliser(configuration);
    } catch (erreur) {
      if (erreur instanceof ErreurConfiguration) throw new ErreurGeneration(erreur.code, { ...erreur.details, remede: null });
      throw erreur;
    }
    const manques = placesManquantesParTour(instance);
    const placesManquantes = Math.max(...manques);
    if (placesManquantes > 0) {
      const tours = manques.flatMap((manque, rang) => (manque > 0 ? [{ tour: rang + 1, manque }] : []));
      throw new ErreurGeneration(
        'PLACES_MANQUANTES',
        instance.absences === 0
          ? { placesManquantes, remede: versSection('tables') }
          : { placesManquantes, tours, remede: versSection('tables') },
      );
    }
    let departDuMoteur = null;
    // Ce que l'issue dit du départ : rien pour une génération ordinaire.
    let duDepart = { departEnDerive: false, ecarts: [], avertissements: [] };
    if (depart !== null) {
      const refusDepart = refusDuDepart(charge, depart);
      if (refusDepart !== null) throw new ErreurGeneration(refusDepart.code, refusDepart.details);
      departDuMoteur = departPourLeMoteur(charge, depart);
      const tours = ecartAuRetenu(charge, depart);
      duDepart = {
        departEnDerive: derive(charge.propositions.find(({ id }) => id === depart.id), charge).length > 0,
        ecarts: ecartsDuDepart(charge, depart),
        avertissements: tours.length === 0 ? [] : [{ code: 'DEPART_ECART_AU_RETENU', details: { depart: depart.id, tours } }],
      };
    }
    const estimation = estimer(reglages);
    if (!confirmee && estLongue(reglages, estimation)) {
      throw new ErreurGeneration('CONFIRMATION_REQUISE', { estimation, remede: null });
    }
    return { configuration, instance, departDuMoteur, duDepart };
  }

  // Le calcul confié à l'exécuteur : ses avancements publiés, son annulation
  // par la séance suivie ; rend les propositions et la durée du calcul. Une
  // annulation lève ErreurAnnulee, même quand l'exécuteur a rendu un
  // résultat entre-temps. Sans départ, les options du lancer n'ont que coeurs.
  async function calculer(configuration, reglages, departDuMoteur) {
    const debut = horloge.instant();
    const options = { coeurs: coeursPour(reglages.nombre) };
    if (departDuMoteur !== null) options.depart = departDuMoteur;
    execution = executeur.lancer(configuration, reglages, options);
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
  // chacune sans violation des invariants, réserves imposées du départ
  // admises, sinon GENERATION_INVARIANT_VIOLE,
  // rang compris — la place de la proposition dans la suite des graines du
  // lancement, qui n'est l'identifiant d'aucune proposition enregistrée ; puis sans
  // celles dont le plan est celui d'une proposition présente sans dérive, ou
  // d'une proposition déjà gardée de ce lancement. auDepart compte, parmi
  // les écartées, celles dont le plan est celui du départ ; 0 sans départ,
  // planDuDepartLu valant alors null.
  function trier(propositions, configuration, instance, departDuMoteur) {
    const ordonnees = [...propositions].sort((a, b) => a.id - b.id);
    const reservesImposees = departDuMoteur === null ? [] : departDuMoteur.reservesImposees;
    for (const proposition of ordonnees) {
      const violations = verifierInvariants(instance, proposition.plan, { reservesImposees });
      if (violations.length > 0) {
        throw new ErreurGeneration('GENERATION_INVARIANT_VIOLE', { rang: proposition.id, violations, remede: null });
      }
    }
    const charge = seance.etat().charge;
    const presents = new Set(
      charge.propositions.filter((p) => derive(p, charge).length === 0).map((p) => JSON.stringify(planDepuisFichier(p))),
    );
    const planDuDepartLu = departDuMoteur === null ? null : JSON.stringify(departDuMoteur.plan);
    const gardees = [];
    let auDepart = 0;
    for (const proposition of ordonnees) {
      const plan = planRange(proposition, configuration, produitVersion);
      if (presents.has(plan)) {
        if (plan === planDuDepartLu) auDepart += 1;
        continue;
      }
      presents.add(plan);
      gardees.push(proposition);
    }
    return { gardees, identiques: ordonnees.length - gardees.length, identiquesAuDepart: auDepart };
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

  // Rattache le résumé d'une génération à chaque proposition ajoutée de la
  // charge, sous la graine, le compte d'arrêt et l'historique qu'elle porte.
  function garder(charge, ajoutees, resume) {
    for (const id of ajoutees) {
      const { graine: g, arret, historique } = charge.propositions.find((proposition) => proposition.id === id);
      generations.set(id, { graine: g, arret, historique, resume });
    }
  }

  async function generer(reglages, { confirmee = false, depart = null } = {}) {
    const { configuration, instance, departDuMoteur, duDepart } = exigerLancement(reglages, confirmee, depart);
    // Le départ rendu et la dérivation enregistrée : une copie de ce qui est
    // reçu, prise une fois les refus passés.
    const departRendu = depart === null ? null : { id: depart.id, toursFiges: [...departDuMoteur.toursFiges] };
    graine = (reglages.graine + 1) % GRAINES;
    publier({ enCours: true, fait: 0, total: reglages.nombre * reglages.arret, annulee: null });
    seance.debuterCalcul();
    try {
      const { propositions, dureeMs, coeurs: employes } = await calculer(configuration, reglages, departDuMoteur);
      mesure = {
        dureeMs,
        mouvements: reglages.nombre * reglages.arret,
        participants: instance.N,
        nombre: reglages.nombre,
        arret: reglages.arret,
        coeurs: employes,
      };
      const { gardees, identiques, identiquesAuDepart } = trier(propositions, configuration, instance, departDuMoteur);
      const issue = { identiques, identiquesAuDepart, dureeMs, depart: departRendu, ...duDepart };
      if (gardees.length === 0) return { ajoutees: [], ...issue };
      const avant = new Set(seance.etat().charge.propositions.map(({ id }) => id));
      const enregistrement = { propositions: gardees, configuration, produitVersion };
      if (departRendu !== null) {
        enregistrement.derivation = { depart: departRendu.id, toursFiges: [...departRendu.toursFiges] };
      }
      await seance.executer('enregistrerGeneration', enregistrement);
      const charge = seance.etat().charge;
      const ajoutees = ajouteesDans(charge, avant, gardees);
      let evalues = 0;
      for (const proposition of propositions) evalues += proposition.evalues;
      garder(charge, ajoutees, Object.freeze({ dureeMs, coeurs: employes, evalues, nombre: propositions.length }));
      return { ajoutees, ...issue };
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
     * suivent sur un même cœur — arret × ⌈nombre / cœurs⌉ — ralentis de
     * ρ(cœurs) (ralentissement), ceux de la dernière mesure ramenés de même
     * aux cœurs qu'elle a employés :
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
     * La génération de cette séance d'où vient la proposition id de la
     * charge ouverte : { dureeMs, coeurs, evalues, nombre }, une copie —
     * la durée prise autour du calcul entier, les cœurs employés, la somme
     * des mouvements évalués de toutes les propositions calculées, identiques
     * écartées comprises, leur nombre. null quand aucune génération de la
     * séance ne l'a ajoutée, quand la charge n'a pas de proposition id, ou
     * quand celle-ci ne porte plus la graine, le compte d'arrêt et
     * l'historique gardés pour elle.
     */
    generationDe(id) {
      const gardee = generations.get(id);
      if (gardee === undefined) return null;
      const proposition = seance.etat().charge?.propositions.find((candidate) => candidate.id === id);
      if (
        proposition === undefined
        || proposition.graine !== gardee.graine
        || proposition.arret !== gardee.arret
        || proposition.historique !== gardee.historique
      ) {
        return null;
      }
      return { ...gardee.resume };
    },
    /**
     * Lance une génération et l'enregistre : { ajoutees, identiques,
     * identiquesAuDepart, dureeMs, depart, departEnDerive, ecarts,
     * avertissements }. Options : confirmee ; depart,
     * {id, toursFiges} — l'identifiant d'une proposition de la charge et ses
     * tours figés, une liste d'entiers ≥ 1 strictement croissante —, ou null
     * pour une génération ordinaire. Un tour figé au-delà de la soirée est
     * le refus TOUR_FIGE_HORS_SOIREE de refusDuDepart ; une autre forme de
     * toursFiges, absente comprise, lève la TypeError de refusDuDepart, au
     * rang de son refus dans l'ordre ci-dessous, sans lancement ni écriture.
     * identiquesAuDepart : les propositions calculées égales au plan du
     * départ, écartées et comptées aussi dans identiques ; 0 sans départ.
     * depart : une copie du départ reçu, null sans lui. departEnDerive : vrai
     * quand le départ dérive par ses participants, et que le moteur est
     * parti du départ ajusté ; ecarts : ceux d'ecartsDuDepart ;
     * avertissements : DEPART_ECART_AU_RETENU {depart, tours} quand le
     * retenu, retenu de ce départ, en diffère à un tour figé, [] sinon. Sans
     * départ : faux, [] et [].
     * Refuse avant tout lancement, par ErreurGeneration, dans cet ordre :
     * REGLAGE_HORS_DOMAINE {reglage} ; AUCUN_EVENEMENT ; le refus courant de
     * la séance ; GENERATION_EN_COURS ;
     * AUCUN_PARTICIPANT ; AUCUNE_TABLE ; le refus de normaliser ;
     * PLACES_MANQUANTES {placesManquantes, tours?} ; sous un départ, le refus de refusDuDepart, son code
     * et ses détails, remède compris ; CONFIRMATION_REQUISE {estimation}, que
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
