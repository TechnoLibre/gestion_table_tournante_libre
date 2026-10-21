// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de l'éditeur de l'ordre des priorités (§ 5.3, § 5.7, A11, A12),
// pur : Priorites.svelte le câble. Une liste de priorités range les huit
// critères en paliers, du premier au dernier : [[{critere, poids}, …], …].
//
// Les faits du registre des critères (contrainte 35) se lisent par
// l'application, que l'interface atteint seule : l'ordre du registre dans la
// table d'évaluation d'un événement neuf, qui porte l'état de chaque critère
// dans cet ordre ; l'ordre par défaut, que l'application réexporte ; la
// validité d'une liste sous le mode de l'événement dans la commande
// changerPriorites, qui la juge par le registre. Aucune règle du
// registre ne se récrit ici : un geste s'offre quand la commande admettrait
// sa liste, et l'écart au plafond a priori, les rencontres répétées, ou les
// tours hors objectif sous « chacun » et « minimum », ne partagent ainsi
// jamais un palier par l'éditeur.
//
// Quatre gestes, chacun sur un critère (§ 5.7, A12) :
//   monterCritere     son palier passe devant celui du dessus, compagnons
//                     compris ;
//   descendreCritere  son palier passe derrière celui du dessous ;
//   joindrePalier     le critère quitte son palier et rejoint celui du
//                     dessus ; un palier vidé disparaît ;
//   separerPalier     le critère quitte son palier partagé pour un palier à
//                     lui, juste dessous.
// Chaque liste écrite range les critères d'un palier dans l'ordre du
// registre, et donne le poids 1 au critère seul à son palier, que l'écran ne
// montre pas : deux listes de même effet s'écrivent pareil (A16). Un critère
// qui rejoint un palier y entre au poids 1.
//
// L'état « décoché » ou « sans objet » d'un critère se lit dans la table
// d'évaluation (evaluer, criteres), qui le tient de la normalisation du
// moteur : l'éditeur ne le recalcule jamais (§ 13.2). Une charge qui porte
// des placements se lit dans la table que partagent les sections
// (evaluation, propositions/modele.js) : l'éditeur ne mesure rien de
// nouveau (§ 13.3).
import { appliquerCommande, chargeNeuve } from '../../application/commandes.js';
import { PRIORITES_PAR_DEFAUT, evaluer } from '../../application/evaluation.js';
import { SIEGES_PAR_DEFAUT, TOURS_PAR_DEFAUT } from '../../application/evenements.js';
import { evaluation, figeePartout } from '../propositions/modele.js';

/** @typedef {Array<Array<{critere: string, poids: number}>>} ListePriorites */

// Un événement neuf, aux réglages d'une charge neuve : le témoin sur lequel
// se lisent l'ordre du registre et l'admission d'une liste.
const TEMOIN = chargeNeuve(
  { nom: 'priorites', siegesParDefaut: SIEGES_PAR_DEFAUT, tours: TOURS_PAR_DEFAUT },
  () => 'priorites',
).charge;

/** Les noms des critères, dans l'ordre du registre, tels que la table
 *  d'évaluation les porte. */
export const CRITERES_DU_REGISTRE = Object.freeze(evaluer(TEMOIN).criteres.map(({ nom }) => nom));

/** L'ordre par défaut (§ 5.7) : chaque critère seul à son palier, au poids
 *  1, dans l'ordre par défaut du registre, que l'application réexporte, et
 *  non dans l'ordre du registre. */
export const LISTE_PAR_DEFAUT = Object.freeze(
  PRIORITES_PAR_DEFAUT.map((palier) =>
    Object.freeze(palier.map(({ critere, poids }) => Object.freeze({ critere, poids }))),
  ),
);

/** Les gestes de l'éditeur, dans l'ordre de leurs boutons ; chacun est
 *  aussi la désignation de son bouton (data-commande). */
export const GESTES = Object.freeze(['monterCritere', 'descendreCritere', 'joindrePalier', 'separerPalier']);

// Le rang d'un critère dans le registre ; un nom inconnu lève.
function rangDe(critere) {
  const rang = CRITERES_DU_REGISTRE.indexOf(critere);
  if (rang < 0) throw new RangeError(`critère inconnu de l'éditeur : ${JSON.stringify(critere)}`);
  return rang;
}

// Une liste rangée : chaque palier dans l'ordre du registre, le poids 1
// pour un critère seul, les paliers vides retirés. Rend une liste neuve.
function ranger(liste) {
  return liste
    .filter((palier) => palier.length > 0)
    .map((palier) => {
      const range = [...palier].sort((a, b) => rangDe(a.critere) - rangDe(b.critere));
      return range.map(({ critere, poids }) => ({ critere, poids: range.length === 1 ? 1 : poids }));
    });
}

// Une copie de la liste, palier par palier, entrée par entrée.
const copier = (liste) => liste.map((palier) => palier.map(({ critere, poids }) => ({ critere, poids })));

// L'index du palier du critère ; un critère que la liste ne porte pas lève.
function palierDe(liste, critere) {
  rangDe(critere);
  const index = liste.findIndex((palier) => palier.some((entree) => entree.critere === critere));
  if (index < 0) throw new RangeError(`critère absent de la liste : ${JSON.stringify(critere)}`);
  return index;
}

/**
 * La place d'un critère : l'index de son palier, à partir de 0, le nombre
 * de paliers et ses compagnons de palier, dans l'ordre de la liste.
 *
 * @param {ListePriorites} liste
 * @param {string} critere
 * @returns {{palier: number, paliers: number, avec: string[]}}
 * @throws {RangeError} un critère inconnu ou absent de la liste
 */
export function placeDe(liste, critere) {
  const palier = palierDe(liste, critere);
  const avec = liste[palier].map((entree) => entree.critere).filter((nom) => nom !== critere);
  return { palier, paliers: liste.length, avec };
}

/**
 * La liste qu'un geste écrit, rangée, ou null quand le geste ne s'applique
 * pas à ce critère : monter ou joindre au premier palier, descendre au
 * dernier, séparer un critère seul. Ne juge pas la validité de la liste
 * sous un mode : gestesOfferts le fait. Ne modifie pas la liste reçue.
 *
 * @param {ListePriorites} liste   une liste complète
 * @param {string} geste           l'un de GESTES
 * @param {string} critere
 * @returns {ListePriorites|null}
 * @throws {RangeError} un geste inconnu, un critère inconnu ou absent
 */
export function listeApres(liste, geste, critere) {
  if (!GESTES.includes(geste)) throw new RangeError(`geste inconnu de l'éditeur : ${JSON.stringify(geste)}`);
  const i = palierDe(liste, critere);
  const copie = copier(liste);
  const echanger = (a, b) => {
    [copie[a], copie[b]] = [copie[b], copie[a]];
    return ranger(copie);
  };
  if (geste === 'monterCritere') return i === 0 ? null : echanger(i - 1, i);
  if (geste === 'descendreCritere') return i === copie.length - 1 ? null : echanger(i, i + 1);
  const sansLui = copie[i].filter((entree) => entree.critere !== critere);
  if (geste === 'joindrePalier') {
    if (i === 0) return null;
    copie[i - 1] = [...copie[i - 1], { critere, poids: 1 }];
    copie[i] = sansLui;
    return ranger(copie);
  }
  if (sansLui.length === 0) return null;
  copie.splice(i, 1, sansLui, [{ critere, poids: 1 }]);
  return ranger(copie);
}

/**
 * Les gestes offerts à un critère, dans l'ordre de GESTES : ceux qui
 * s'appliquent (listeApres) et dont la liste est admise.
 *
 * @param {ListePriorites} liste
 * @param {string} critere
 * @param {(liste: ListePriorites) => boolean} admet   admissionSous, ou une
 *        épreuve qui juge par le registre
 * @returns {string[]}
 */
export function gestesOfferts(liste, critere, admet) {
  return GESTES.filter((geste) => {
    const apres = listeApres(liste, geste, critere);
    return apres !== null && admet(apres);
  });
}

/**
 * La liste où le critère porte ce poids, les autres inchangés. Le poids
 * n'est pas jugé ici : la commande refuse un poids hors de son domaine.
 *
 * @param {ListePriorites} liste
 * @param {string} critere
 * @param {number} poids
 * @returns {ListePriorites}
 */
export function avecPoids(liste, critere, poids) {
  palierDe(liste, critere);
  return liste.map((palier) =>
    palier.map((entree) => ({ critere: entree.critere, poids: entree.critere === critere ? poids : entree.poids })),
  );
}

/**
 * L'admission d'une liste sous les réglages d'un événement : vrai quand la
 * commande changerPriorites l'écrirait — ou la trouverait égale à l'ordre
 * courant —, faux quand elle la refuse par PRIORITES_INVALIDES ou
 * POIDS_HORS_DOMAINE. La commande s'applique au témoin, un événement neuf
 * qui porte une copie de ces réglages : elle juge la liste par le registre,
 * sous le mode des objectifs de l'événement, sans toucher à rien d'autre.
 * Tout autre refus remonte.
 *
 * @param {Object} reglages   charge.reglages
 * @returns {(liste: ListePriorites) => boolean}
 */
export function admissionSous(reglages) {
  const temoin = { ...TEMOIN, reglages: structuredClone(reglages) };
  return (liste) => {
    try {
      appliquerCommande('changerPriorites', temoin, { paliers: liste });
      return true;
    } catch (erreur) {
      if (erreur?.code === 'PRIORITES_INVALIDES' || erreur?.code === 'POIDS_HORS_DOMAINE') return false;
      if (erreur?.code === 'SANS_EFFET') return true;
      throw erreur;
    }
  };
}

// Les états d'une table, par nom.
const parNom = (criteres) => new Map(criteres.map((etat) => [etat.nom, etat]));

// Les états des charges sans placement déjà lus, par charge : une charge
// figée partout (figeePartout, la règle du cache de la table partagée) ne
// change plus, et revenir à la section ne la relit pas.
const lus = new WeakMap();

// Les états d'une charge sans placement, ou null sur un refus qui porte un
// code.
function etatsSansPlacement(charge) {
  try {
    return parNom(evaluer({ ...charge, propositions: [], retenu: null }, { plafondsAPriori: null }).criteres);
  } catch (erreur) {
    if (typeof erreur?.code !== 'string') throw erreur;
    return null;
  }
}

/**
 * L'état de chaque critère de la charge, par nom, tel que la table
 * d'évaluation le porte ({nom, coche, sansObjet, valeurs}). Une charge qui
 * porte des placements le lit dans la table partagée des sections, mesurée
 * une fois ; une charge sans placement, qui n'en a pas, s'évalue sans
 * plafond a priori, aucun placement n'étant à mesurer — une fois pour une
 * charge figée partout, celle que publie la séance. null quand la
 * configuration ne se normalise pas — un refus qui porte un code — : aucun
 * état ne s'écrit alors. Toute autre erreur remonte.
 *
 * @param {Object} charge
 * @returns {Map<string, {nom: string, coche: boolean, sansObjet: boolean, valeurs: string[]}>|null}
 */
export function etatsDesCriteres(charge) {
  const { table, refus } = evaluation(charge);
  if (table !== null) return parNom(table.criteres);
  if (refus !== null) return null;
  if (lus.has(charge)) return lus.get(charge);
  const etats = etatsSansPlacement(charge);
  if (figeePartout(charge)) lus.set(charge, etats);
  return etats;
}

/**
 * Ce que l'écran écrit d'un état : 'decoche' pour un critère que ses cases
 * ne cochent pas, 'sansObjet' pour un critère coché que l'événement ne lui
 * donne rien à mesurer, null pour un critère qui compte ou un état inconnu.
 *
 * @param {{coche: boolean, sansObjet: boolean}|undefined} etat
 * @returns {'decoche'|'sansObjet'|null}
 */
export function etatAffiche(etat) {
  if (etat === undefined) return null;
  if (!etat.coche) return 'decoche';
  return etat.sansObjet ? 'sansObjet' : null;
}
