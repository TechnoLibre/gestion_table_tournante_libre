// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'exécuteur d'aperçu de production (§ 8.1, § 13.4) : les deux résumés
// qu'une ligne de la liste montre — resumeDuRetenu et resumeDuMeilleur
// (evaluation.js) — se calculent dans un travailleur, hors du fil de
// l'interface, et l'exécuteur adapte son protocole au contrat que
// creerFacade reçoit en executeurApercu (evenements.js). Le module porte
// les deux côtés : creerExecuteurApercu, côté interface, et
// brancherTravailleurApercu, que le point d'entrée du travailleur de la
// génération (src/interface/generation/travailleur.js) branche sur sa
// portée, après la recherche : la page n'inclut qu'un script de
// travailleur, et la liste en fait naître sa propre instance.
//
//   → { type: 'resumer', numero, charge }   la charge examinée, clonée
//   ← { type: 'resumes', numero, mesuresDuRetenu, meilleureDuClassement }
//   ← { type: 'faute', numero, message, pile }   rejette ce calcul par une
//                                                Error, une faute
//   ✕ canal d'erreur du travailleur              rejette chaque calcul en
//                                                cours par une Error
//
// Un seul travailleur sert tous les calculs : il naît au premier calcul — une
// liste dont chaque aperçu est à jour n'en fait naître aucun — et traite ses
// messages l'un après l'autre. numero, propre à chaque calcul, range chaque
// réponse sous sa promesse, quel que soit l'ordre d'arrivée. Le travailleur
// ne garde rien d'un message à l'autre, et son gestionnaire ne lève jamais :
// son canal d'erreur ne porte que l'échec de son script, qui ne se charge
// ou ne se compile pas. Cet échec rejette chaque calcul en cours et termine
// le travailleur ; le calcul suivant en fait naître un neuf.
//
// terminer() termine le travailleur, s'il existe, sans régler les calculs en
// cours : le flux de la liste qui les attend est abandonné avant lui
// (App.svelte, au démontage), et une faute de plus n'irait qu'au collecteur
// de la page. Après terminer(), un calcul rejette par une RangeError, une
// faute de l'appelant. La fabrique est un paramètre : src/main.js la
// construit sur le travailleur inclus dans la page ; une épreuve, sur des
// travailleurs factices. Ce module ne touche aucune plateforme.
import { resumeDuMeilleur, resumeDuRetenu } from './evaluation.js';

/**
 * Branche une portée de travailleur — { onmessage, postMessage } — sur les
 * deux résumés d'une charge, selon les messages de l'en-tête du module. Un
 * message d'un autre type va au gestionnaire que la portée avait avant,
 * celui de la recherche, et rien sans lui ; une erreur du calcul se poste
 * en faute, son texte et sa pile.
 *
 * @param {{onmessage: ((evenement: {data: unknown}) => void)|null, postMessage: (message: Object) => void}} portee
 */
export function brancherTravailleurApercu(portee) {
  const avant = portee.onmessage;
  portee.onmessage = (evenement) => {
    const { data } = evenement;
    if (data === null || typeof data !== 'object' || data.type !== 'resumer') {
      avant?.(evenement);
      return;
    }
    const { numero, charge } = data;
    let resumes;
    try {
      resumes = { mesuresDuRetenu: resumeDuRetenu(charge), meilleureDuClassement: resumeDuMeilleur(charge) };
    } catch (erreur) {
      portee.postMessage({ type: 'faute', numero, message: String(erreur?.message ?? erreur), pile: String(erreur?.stack ?? '') });
      return;
    }
    portee.postMessage({ type: 'resumes', numero, ...resumes });
  };
}

/**
 * L'exécuteur d'aperçu sur un travailleur dédié.
 *
 * @param {() => {postMessage: (message: Object) => void, terminate: () => void,
 *   onmessage: ((evenement: {data: Object}) => void)|null,
 *   onerror?: ((evenement: {message?: string, preventDefault?: () => void}) => void)|null}} fabrique
 *   rend un travailleur neuf à chaque appel
 * @returns {{calculer: (charge: Object) => Promise<{mesuresDuRetenu: Object|null, meilleureDuClassement: Object|null}>,
 *   terminer: () => void}}
 *   calculer(charge) poste la charge, clonée par le navigateur, et se résout
 *   aux deux résumés que le travailleur rend ; une faute du travailleur, un
 *   clonage refusé ou l'échec de son script la rejettent par une Error sans
 *   code. terminer() termine le travailleur une fois, les calculs en cours
 *   laissés sans issue.
 */
export function creerExecuteurApercu(fabrique) {
  // travailleur : celui qui sert les calculs, ou null avant le premier et
  // après un échec ; enCours : numero → { resoudre, rejeter }.
  let travailleur = null;
  let termine = false;
  let numeros = 0;
  const enCours = new Map();

  // Retire les gestionnaires du travailleur et le termine : il ne remet plus
  // rien, même un message déjà en file.
  function arreter(courant) {
    courant.onmessage = null;
    courant.onerror = null;
    courant.terminate();
  }

  function recevoir(data) {
    if (data === null || typeof data !== 'object') return;
    const attente = enCours.get(data.numero);
    if (attente === undefined) return;
    if (data.type === 'resumes') {
      enCours.delete(data.numero);
      attente.resoudre({ mesuresDuRetenu: data.mesuresDuRetenu, meilleureDuClassement: data.meilleureDuClassement });
    } else if (data.type === 'faute') {
      enCours.delete(data.numero);
      const faute = new Error(`travailleur de la vue d'ensemble : ${data.message}`);
      faute.stack = `${faute.stack}\n${data.pile}`;
      attente.rejeter(faute);
    }
  }

  // Le travailleur courant, né au besoin. Son échec rejette chaque calcul
  // en cours, l'événement traité : le navigateur ne le signale pas en plus
  // comme une faute de la page.
  function courant() {
    if (travailleur !== null) return travailleur;
    const neuf = fabrique();
    neuf.onmessage = ({ data }) => recevoir(data);
    neuf.onerror = (evenement) => {
      evenement?.preventDefault?.();
      if (travailleur !== neuf) return;
      travailleur = null;
      arreter(neuf);
      const attentes = [...enCours.values()];
      enCours.clear();
      for (const { rejeter } of attentes) rejeter(new Error("travailleur de la vue d'ensemble en échec : son script ne se charge pas"));
    };
    travailleur = neuf;
    return neuf;
  }

  return {
    calculer(charge) {
      if (termine) return Promise.reject(new RangeError("calculer : l'exécuteur d'aperçu est terminé"));
      numeros += 1;
      const numero = numeros;
      return new Promise((resoudre, rejeter) => {
        const cible = courant();
        enCours.set(numero, { resoudre, rejeter });
        try {
          cible.postMessage({ type: 'resumer', numero, charge });
        } catch (erreur) {
          enCours.delete(numero);
          rejeter(erreur);
        }
      });
    },
    terminer() {
      if (termine) return;
      termine = true;
      enCours.clear();
      if (travailleur !== null) arreter(travailleur);
      travailleur = null;
    },
  };
}
