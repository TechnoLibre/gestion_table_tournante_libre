// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'horloge de l'application (§ 19.4, § 14.7) : la seule lecture de
// l'horloge du moteur d'exécution, et les seules minuteries. Hors du moteur,
// src/application, src/interface et src/stockage lisent l'heure et arment
// leurs minuteries par l'horloge qu'on leur injecte, jamais autrement :
// creerHorlogeSysteme est le seul code de ces trois couches qui appelle
// new Date, performance.now, setTimeout et clearTimeout. Les épreuves
// injectent l'horloge pilotée, où rien n'avance seul.
//
// Une horloge est quatre fermetures, appelables détachées de leur objet :
//   horodatage()          AAAA-MM-JJTHH:MM:SS±HH:MM, heure locale et décalage
//   instant()             millisecondes, monotone : les durées
//   planifier(fn, ms)     arme une minuterie, rend un identifiant opaque — un
//                         nombre sous le navigateur et sous l'horloge pilotée,
//                         un Timeout sous node —, que l'appelant ne fait que
//                         rendre à annuler
//   annuler(id)           un identifiant inconnu ou déjà parti : sans effet

/**
 * @typedef {Object} Horloge
 * @property {() => string} horodatage
 * @property {() => number} instant
 * @property {(fn: () => void, ms: number) => unknown} planifier
 * @property {(id: unknown) => void} annuler
 */

import { lireHorodatage } from './format.js';

const deux = (n) => String(n).padStart(2, '0');

// Un décalage en minutes à l'est de UTC, écrit ±HH:MM.
function ecrireDecalage(minutes) {
  const absolu = Math.abs(minutes);
  return `${minutes < 0 ? '-' : '+'}${deux(Math.floor(absolu / 60))}:${deux(absolu % 60)}`;
}

// Les contrôles communs aux deux horloges : un rappel qui se lance, un délai
// fini et positif.
function exigerMinuterie(fn, ms) {
  if (typeof fn !== 'function') throw new TypeError('horloge : planifier attend une fonction');
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
    throw new RangeError(`horloge : délai fini et positif attendu, reçu ${String(ms)}`);
  }
}

/**
 * L'horloge du moteur d'exécution : l'heure locale du système, son décalage,
 * le compteur monotone et les minuteries du navigateur ou de node.
 *
 * @returns {Horloge}
 */
export function creerHorlogeSysteme() {
  const horodatage = () => {
    const maintenant = new Date();
    const jour = `${maintenant.getFullYear()}-${deux(maintenant.getMonth() + 1)}-${deux(maintenant.getDate())}`;
    const heure = `${deux(maintenant.getHours())}:${deux(maintenant.getMinutes())}:${deux(maintenant.getSeconds())}`;
    return `${jour}T${heure}${ecrireDecalage(-maintenant.getTimezoneOffset())}`;
  };
  const instant = () => performance.now();
  const planifier = (fn, ms) => {
    exigerMinuterie(fn, ms);
    return setTimeout(fn, ms);
  };
  const annuler = (id) => {
    clearTimeout(id);
  };
  return { horodatage, instant, planifier, annuler };
}

// --- Le calendrier de l'horloge pilotée ---------------------------------------
//
// L'horloge pilotée compte en millisecondes depuis 1970-01-01T00:00:00 UTC et
// convertit par l'arithmétique du calendrier grégorien proleptique, sans lire
// l'horloge du système. Les jours se comptent depuis cette origine.

const MS_PAR_JOUR = 86_400_000;

// Le nombre de jours depuis 1970-01-01 d'une date civile.
function joursDepuisOrigine(annee, mois, jour) {
  const a = mois <= 2 ? annee - 1 : annee;
  const ere = Math.floor(a / 400);
  const anneeDEre = a - ere * 400;
  const jourDAnnee = Math.floor((153 * (mois + (mois > 2 ? -3 : 9)) + 2) / 5) + jour - 1;
  const jourDEre = anneeDEre * 365 + Math.floor(anneeDEre / 4) - Math.floor(anneeDEre / 100) + jourDAnnee;
  return ere * 146_097 + jourDEre - 719_468;
}

// La date civile du jour compté depuis 1970-01-01.
function dateCivile(jours) {
  const z = jours + 719_468;
  const ere = Math.floor(z / 146_097);
  const jourDEre = z - ere * 146_097;
  const anneeDEre = Math.floor(
    (jourDEre - Math.floor(jourDEre / 1460) + Math.floor(jourDEre / 36_524) - Math.floor(jourDEre / 146_096)) / 365,
  );
  const jourDAnnee = jourDEre - (365 * anneeDEre + Math.floor(anneeDEre / 4) - Math.floor(anneeDEre / 100));
  const moisDecale = Math.floor((5 * jourDAnnee + 2) / 153);
  const jour = jourDAnnee - Math.floor((153 * moisDecale + 2) / 5) + 1;
  const mois = moisDecale < 10 ? moisDecale + 3 : moisDecale - 9;
  return { annee: anneeDEre + ere * 400 + (mois <= 2 ? 1 : 0), mois, jour };
}

// Un horodatage de départ lu par lireHorodatage (format.js) : l'instant UTC
// en millisecondes et le décalage en minutes à l'est de UTC. Une autre
// forme, ou une date hors du calendrier, lève RangeError.
function lireDepart(depart) {
  const { annee, mois, jour, heure, minute, seconde, decalage } = lireHorodatage(depart);
  const local = joursDepuisOrigine(annee, mois, jour) * MS_PAR_JOUR + ((heure * 60 + minute) * 60 + seconde) * 1000;
  return { utc: local - decalage * 60_000, decalage };
}

/**
 * Une horloge où rien n'avance seul. avancer(ms) est synchrone : il
 * déclenche les minuteries échues dans l'ordre de leur échéance, puis de
 * leur création, chacune à l'instant de son échéance — horodatage() et
 * instant() y rendent cette échéance — ; une minuterie qu'un rappel arme et
 * qui échoit dans la fenêtre part dans le même avancer ; à son retour,
 * l'horloge a avancé de ms exactement. Il n'attend aucune promesse : l'épreuve
 * attend elle-même ce que les rappels lancent. Un rappel qui lève arrête
 * avancer à son échéance, et l'erreur remonte. Un rappel qui appelle avancer
 * lève : instant() ne recule jamais.
 *
 * horodatage() garde le décalage du départ ; instant() part de 0.
 *
 * @param {{depart?: string}} [options]
 * @returns {Horloge & {avancer: (ms: number) => undefined}}
 * @throws {RangeError} un départ hors de sa forme ou du calendrier
 */
export function creerHorlogePilotee({ depart = '2026-10-06T19:00:00-04:00' } = {}) {
  const { utc, decalage } = lireDepart(depart);
  let ecoule = 0;
  let prochainId = 1;
  // Les minuteries en attente, par identifiant : échéance et rappel. Les
  // identifiants croissent avec la création.
  const enAttente = new Map();

  const horodatage = () => {
    const local = utc + ecoule + decalage * 60_000;
    const jours = Math.floor(local / MS_PAR_JOUR);
    const { annee, mois, jour } = dateCivile(jours);
    const secondes = Math.floor((local - jours * MS_PAR_JOUR) / 1000);
    const heure = `${deux(Math.floor(secondes / 3600))}:${deux(Math.floor(secondes / 60) % 60)}:${deux(secondes % 60)}`;
    return `${String(annee).padStart(4, '0')}-${deux(mois)}-${deux(jour)}T${heure}${ecrireDecalage(decalage)}`;
  };
  const instant = () => ecoule;
  const planifier = (fn, ms) => {
    exigerMinuterie(fn, ms);
    const id = prochainId;
    prochainId += 1;
    enAttente.set(id, { echeance: ecoule + ms, fn });
    return id;
  };
  const annuler = (id) => {
    enAttente.delete(id);
  };

  // La prochaine minuterie échue au plus tard à fin : la plus petite
  // échéance, puis le plus petit identifiant ; null quand il n'y en a pas.
  function prochaine(fin) {
    let choisie = null;
    for (const [id, { echeance }] of enAttente) {
      if (echeance > fin) continue;
      if (choisie === null || echeance < choisie.echeance || (echeance === choisie.echeance && id < choisie.id)) {
        choisie = { id, echeance };
      }
    }
    return choisie;
  }

  // Vrai pendant qu'avancer déclenche ses minuteries : un rappel qui
  // avancerait à son tour ferait reculer instant() au retour.
  let enCours = false;

  function avancer(ms) {
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0) {
      throw new RangeError(`horloge : avancer attend un délai fini et positif, reçu ${String(ms)}`);
    }
    if (enCours) throw new Error('horloge : avancer ré-entrant, appelé depuis un rappel');
    enCours = true;
    try {
      const fin = ecoule + ms;
      for (let suivante = prochaine(fin); suivante !== null; suivante = prochaine(fin)) {
        const { fn } = enAttente.get(suivante.id);
        enAttente.delete(suivante.id);
        ecoule = suivante.echeance;
        fn();
      }
      ecoule = fin;
    } finally {
      enCours = false;
    }
    return undefined;
  }

  return { horodatage, instant, planifier, annuler, avancer };
}
