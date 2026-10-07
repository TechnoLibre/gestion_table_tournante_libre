// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La machine d'un champ de saisie (§ 2, § 8.2), pure : Champ.svelte la
// câble. Elle tient le texte de la valeur enregistrée (stockee), le texte
// saisi (saisie), le drapeau d'une saisie non validée (enCours) et le refus
// de la dernière validation (refus). Le texte saisi ne devient une valeur
// qu'à la validation, que la sortie du champ déclenche : jamais pendant la
// frappe, jamais par un minuteur.
//
// lire(texte) rend { valeur } ou { refus: {code, details} } ; la machine ne
// connaît ni la séance ni la commande, qu'exécute le composant.

/**
 * Une machine de champ.
 *
 * @param {{stockee: string, lire: (texte: string) => ({valeur: unknown}|{refus: {code: string, details: Object}})}} options
 * @returns {{
 *   readonly stockee: string, readonly saisie: string, readonly enCours: boolean,
 *   readonly refus: null|{code: string, details: Object},
 *   saisir: (texte: string) => void,
 *   valider: () => ({action: 'aucune'}|{action: 'refus', refus: Object}|{action: 'executer', valeur: unknown}),
 *   abandonner: () => void, echec: (refus: Object) => void, recevoir: (texte: string) => void,
 * }}
 *   valider rend 'aucune' quand rien n'est saisi ou que la saisie se lit
 *   comme la valeur enregistrée — la saisie revient alors à son texte ;
 *   'refus' quand lire refuse, la saisie gardée et toujours en cours ;
 *   'executer' sinon : la saisie devient le texte enregistré, la validation
 *   suivante ne relance rien, et echec(refus) défait ce passage quand
 *   l'exécution est refusée. abandonner (Échap) rend la valeur enregistrée.
 *   recevoir pose une valeur enregistrée nouvelle, venue d'ailleurs : la
 *   saisie la suit hors d'une saisie en cours.
 */
export function creerMachineChamp({ stockee, lire }) {
  let enregistree = stockee;
  let saisie = stockee;
  let enCours = false;
  let refus = null;
  // Le texte enregistré d'avant la dernière exécution, qu'echec restitue.
  let avant = stockee;

  // La valeur que lire donne d'un texte, ou undefined quand il la refuse.
  const valeurDe = (texte) => {
    const lu = lire(texte);
    return Object.hasOwn(lu, 'refus') ? undefined : lu.valeur;
  };

  function terminer() {
    saisie = enregistree;
    enCours = false;
    refus = null;
  }

  return {
    get stockee() {
      return enregistree;
    },
    get saisie() {
      return saisie;
    },
    get enCours() {
      return enCours;
    },
    get refus() {
      return refus;
    },
    saisir(texte) {
      saisie = texte;
      enCours = true;
      refus = null;
    },
    valider() {
      if (!enCours || saisie === enregistree) {
        terminer();
        return { action: 'aucune' };
      }
      const lu = lire(saisie);
      if (Object.hasOwn(lu, 'refus')) {
        refus = lu.refus;
        return { action: 'refus', refus };
      }
      const ancienne = valeurDe(enregistree);
      if (ancienne !== undefined && Object.is(ancienne, lu.valeur)) {
        terminer();
        return { action: 'aucune' };
      }
      avant = enregistree;
      enregistree = saisie;
      enCours = false;
      refus = null;
      return { action: 'executer', valeur: lu.valeur };
    },
    abandonner() {
      terminer();
    },
    echec(refusRecu) {
      enregistree = avant;
      enCours = true;
      refus = refusRecu;
    },
    recevoir(texte) {
      enregistree = texte;
      avant = texte;
      if (!enCours) saisie = texte;
    },
  };
}

// Les codes d'un refus de la séance : ceux de son état, qu'exigerEcriture
// calcule — LECTURE_SEULE, MODE_LECTURE, SUPPORT_ROMPU —, et VERROU_PRIS, le
// passage en écriture refusé. Les raisons de LECTURE_SEULE qu'etat.refus
// porte ; les autres, ENCODAGE et FORMAT_PLUS_RECENT, tiennent le temps de
// la lecture.
const CODES_SEANCE = new Set(['LECTURE_SEULE', 'MODE_LECTURE', 'SUPPORT_ROMPU', 'VERROU_PRIS']);
const RAISONS_ETAT = new Set(['BLOQUE', 'FORMAT']);

/** Vrai pour un refus qui nomme un état de la séance et non la saisie. */
export const estRefusSeance = (refus) => CODES_SEANCE.has(refus.code);

/** Deux refus de même code et de mêmes détails sont le même. */
export const memeRefus = (a, b) => a.code === b.code && JSON.stringify(a.details) === JSON.stringify(b.details);

/**
 * Le refus de la séance qu'un champ affiche, confronté à l'état courant
 * (EtatSeance) : le refus lui-même, le même objet, tant que l'état le
 * tient ; null quand l'état ne le tient plus ; la cause courante quand une
 * autre l'a remplacé. VERROU_PRIS tient tant qu'etat.verrouAutre est
 * relevé ; LECTURE_SEULE d'une raison qu'etat.refus ne porte pas, tant que
 * la séance est en lecture ; les autres suivent etat.refus. Un refus local
 * passe tel quel.
 *
 * @param {{code: string, details: Object}} refus
 * @param {{mode: string, refus: null|{code: string, details: Object}, verrouAutre: Object|null}} etat
 * @returns {null|{code: string, details: Object}}
 */
export function refusSeanceCourant(refus, etat) {
  if (!estRefusSeance(refus)) return refus;
  if (refus.code === 'VERROU_PRIS') return etat.verrouAutre === null ? null : refus;
  if (refus.code === 'LECTURE_SEULE' && !RAISONS_ETAT.has(refus.details?.raison)) {
    return etat.mode === 'lecture' ? refus : null;
  }
  const courant = etat.refus;
  if (courant === null) return null;
  return memeRefus(courant, refus) ? refus : courant;
}
