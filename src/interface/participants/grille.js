// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les modules purs de la liste des participants (§ 4, § 7.4, § 10.2), que
// câblent SectionParticipants, Grille, Formulaire et Fiche : les colonnes de
// la grille, ses lignes triées et filtrées, la cellule qu'atteint une
// touche, la commande qu'exécute une cellule validée, les groupes,
// imbriqués, de la liste groupée par une colonne ou plusieurs et les lignes
// que laissent voir les groupes repliés, l'orthographe d'organisation à
// reprendre, l'itinéraire d'une personne dans le retenu et ses
// réservations. La présence par tour se lit par presenceSaisie
// (src/application/places.js) et se range par clePresence (presence.js).
// Aucune fonction ne modifie ce qu'elle reçoit ; la clé normalisée vient de
// l'appelant, qui la tient de src/application/csv.js.

import { presenceSaisie } from '../../application/places.js';
import { effetDe } from '../raccourcis.js';
import { affichagePresence, clePresence } from './presence.js';

/** Les colonnes de la grille, propriétés d'un participant. Elles s'associent
 *  à l'export par leur champ (CHAMP_DE_COLONNE), non par leur rang : la
 *  grille ne montre pas les étiquettes, et la présence y suit l'exclusion.
 *  Le collage en bloc suit l'ordre des champs de l'export, non celui-ci. */
export const COLONNES = Object.freeze(['nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'exclu', 'presence', 'notes']);

/** Le champ de l'export CSV (CHAMPS, src/application/csv.js) de chaque
 *  colonne, dans l'ordre de COLONNES : l'en-tête sous lequel l'export écrit
 *  sa cellule. */
export const CHAMP_DE_COLONNE = new Map(COLONNES.map((colonne) => [colonne, colonne === 'titrePressenti' ? 'titre_pressenti' : colonne]));

// Les colonnes de texte : toutes, hors de l'exclusion et de la présence,
// qui ne sont pas des textes saisis : le filtre ne les lit pas.
const TEXTES = COLONNES.filter((colonne) => colonne !== 'exclu' && colonne !== 'presence');

// La clé du libellé de chaque colonne, et celle de chaque statut calculé.
const CLES_COLONNES = new Map([
  ['nom', 'participants.colonne.nom'],
  ['prenom', 'participants.colonne.prenom'],
  ['organisation', 'participants.colonne.organisation'],
  ['courriel', 'participants.colonne.courriel'],
  ['titrePressenti', 'participants.colonne.titrePressenti'],
  ['exclu', 'participants.colonne.exclu'],
  ['presence', 'participants.colonne.presence'],
  ['notes', 'participants.colonne.notes'],
]);
const CLES_STATUTS = new Map([
  ['ancre', 'participants.statut.ancre'],
  ['partiel', 'participants.statut.partiel'],
  ['mobile', 'participants.statut.mobile'],
]);

/**
 * La clé du libellé d'une colonne de COLONNES.
 *
 * @param {string} colonne
 * @returns {string}
 * @throws {RangeError} hors de COLONNES
 */
export function cleDeColonne(colonne) {
  const cle = CLES_COLONNES.get(colonne);
  if (cle === undefined) throw new RangeError(`colonne inconnue : ${JSON.stringify(colonne)}`);
  return cle;
}

/**
 * La clé du libellé d'un statut calculé (statuts, src/application/places.js) :
 * 'ancre', 'partiel' ou 'mobile'.
 *
 * @param {string} statut
 * @returns {string}
 * @throws {RangeError} un autre statut
 */
export function cleDeStatut(statut) {
  const cle = CLES_STATUTS.get(statut);
  if (cle === undefined) throw new RangeError(`statut inconnu : ${JSON.stringify(statut)}`);
  return cle;
}

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const SENS = new Map([
  ['croissant', 1],
  ['decroissant', -1],
]);

/**
 * Les lignes affichées : une ligne reste quand la clé normalisée d'un de ses
 * champs texte non null contient celle du filtre — un champ null n'est
 * jamais passé à cleNormalisee, qui lève sur lui ; l'exclusion et la
 * présence ne sont pas lues —, puis tri par colonne, croissant ou
 * décroissant, sur la clé normalisée (exclu : faux avant vrai ; presence :
 * clePresence, « tous » en tête dans le sens croissant), un champ null
 * après toute valeur dans les deux sens, départagé par
 * identifiant croissant. Sans tri, l'ordre est celui des identifiants
 * croissants ; un filtre dont la clé est vide garde tout.
 *
 * @param {Array<Object>} participants
 * @param {{tri: null|{colonne: string, sens: 'croissant'|'decroissant'}, filtre: string}} vue
 * @param {(texte: string) => string} cleNormalisee
 * @returns {Array<Object>}   les participants reçus, dans l'ordre de la grille
 * @throws {RangeError} une colonne hors de COLONNES, un autre sens
 */
export function lignesGrille(participants, { tri, filtre }, cleNormalisee) {
  const signe = tri === null ? 1 : SENS.get(tri.sens);
  if (tri !== null && (!COLONNES.includes(tri.colonne) || signe === undefined)) {
    throw new RangeError(`tri inconnu : ${JSON.stringify(tri)}`);
  }
  const cherche = cleNormalisee(filtre ?? '');
  const retenues =
    cherche === ''
      ? [...participants]
      : participants.filter((p) => TEXTES.some((colonne) => p[colonne] !== null && cleNormalisee(p[colonne]).includes(cherche)));

  // La valeur de tri de chaque ligne, calculée une fois : null reste null.
  const colonne = tri?.colonne ?? null;
  const valeurDe = (p) => {
    if (colonne === null) return null;
    if (colonne === 'exclu') return p.exclu ? 1 : 0;
    if (colonne === 'presence') return clePresence(presenceSaisie(p));
    return p[colonne] === null ? null : cleNormalisee(p[colonne]);
  };
  const valeurs = new Map(retenues.map((p) => [p, valeurDe(p)]));
  const comparer = (a, b) => {
    const va = valeurs.get(a);
    const vb = valeurs.get(b);
    if (va !== vb) {
      if (va === null) return 1;
      if (vb === null) return -1;
      const ecart = typeof va === 'number' ? va - vb : comparerTextes(va, vb);
      if (ecart !== 0) return ecart * signe;
    }
    return a.id - b.id;
  };
  return retenues.sort(comparer);
}

/** Les colonnes par lesquelles la liste se groupe : celles de la grille,
 *  dans leur ordre, puis le statut calculé (§ 4.2), qui n'est pas une
 *  colonne. */
export const GROUPEMENTS = Object.freeze([...COLONNES, 'statut']);

/**
 * La commande qu'exécute la validation d'une cellule de la grille : celle de
 * la présence, changerPresence de ses tours (null pour tous) ; toute autre,
 * modifierParticipant sur ce seul champ.
 *
 * @param {string} colonne   une colonne de COLONNES, hors exclu, qui se bascule
 * @param {number} id
 * @param {unknown} valeur   la valeur lue de la saisie
 * @returns {{nom: string, args: Object}}
 */
export function commandeDeCellule(colonne, id, valeur) {
  if (colonne === 'presence') return { nom: 'changerPresence', args: { id, tours: valeur } };
  return { nom: 'modifierParticipant', args: { id, champs: { [colonne]: valeur } } };
}

/**
 * La clé du libellé d'une colonne de GROUPEMENTS : celle de sa colonne de
 * la grille, ou celle du statut.
 *
 * @param {string} colonne
 * @returns {string}
 * @throws {RangeError} hors de GROUPEMENTS
 */
export function cleDeGroupement(colonne) {
  return colonne === 'statut' ? 'participants.groupe.statut' : cleDeColonne(colonne);
}

/**
 * Le groupement après le choix de colonne au niveau rang, compté depuis 0 :
 * la liste des colonnes de GROUPEMENTS, la plus large d'abord. La valeur
 * vide retire ce niveau et tous ceux d'après ; une colonne remplace celle
 * du niveau, ou l'ajoute au premier niveau libre, et les niveaux suivants
 * restent, hors celui qui la portait déjà. Rend une nouvelle liste.
 *
 * @param {Array<string>} groupement
 * @param {number} rang      de 0 au nombre de niveaux
 * @param {string} colonne   '' ou une colonne de colonnesOffertes(groupement, rang)
 * @returns {Array<string>}
 * @throws {RangeError} un rang au-delà du premier niveau libre, une colonne
 *         hors de celles offertes à ce rang
 */
export function choisirGroupement(groupement, rang, colonne) {
  if (!Number.isInteger(rang) || rang < 0 || rang > groupement.length) throw new RangeError(`niveau inconnu : ${rang}`);
  const plusLarges = groupement.slice(0, rang);
  if (colonne === '') return plusLarges;
  if (!colonnesOffertes(groupement, rang).includes(colonne)) throw new RangeError(`groupement inconnu : ${JSON.stringify(colonne)}`);
  return [...plusLarges, colonne, ...groupement.slice(rang + 1).filter((suivante) => suivante !== colonne)];
}

/**
 * Les rangs, comptés depuis 0, des niveaux dont le groupement montre le
 * sélecteur : un par colonne choisie, puis celui du niveau suivant tant
 * qu'une colonne de GROUPEMENTS reste libre.
 *
 * @param {Array<string>} groupement
 * @returns {Array<number>}
 */
export function niveauxAffiches(groupement) {
  const nombre = groupement.length < GROUPEMENTS.length ? groupement.length + 1 : groupement.length;
  return Array.from({ length: nombre }, (_, rang) => rang);
}

/**
 * Les colonnes que le niveau rang du groupement peut prendre : celles de
 * GROUPEMENTS, dans leur ordre, hors celles des niveaux plus larges.
 *
 * @param {Array<string>} groupement
 * @param {number} rang   compté depuis 0
 * @returns {Array<string>}
 */
export function colonnesOffertes(groupement, rang) {
  const prises = groupement.slice(0, rang);
  return GROUPEMENTS.filter((colonne) => !prises.includes(colonne));
}

// Les groupes d'un groupement par statut, dans leur ordre, et la clé du
// libellé de chacun : les trois statuts calculés, une personne exclue, qui
// n'en a aucun, puis une personne présente que le calcul ne nomme pas —
// celui d'une configuration incohérente.
const GROUPES_STATUT = new Map([
  ['ancre', 'participants.statut.ancre'],
  ['partiel', 'participants.statut.partiel'],
  ['mobile', 'participants.statut.mobile'],
  ['exclue', 'participants.grille.exclue'],
  ['inconnu', 'participants.groupe.statutInconnu'],
]);
const RANGS_STATUT = new Map([...GROUPES_STATUT.keys()].map((statut, rang) => [statut, rang]));

// Un segment de la clé d'un groupe : « % » et « / » s'y échappent, si
// bien que « / » ne sépare jamais que deux niveaux.
const segment = (texte) => texte.replaceAll('%', '%25').replaceAll('/', '%2F');

/**
 * Les groupes de la liste groupée par une ou plusieurs colonnes, imbriqués
 * dans l'ordre de colonnes : un groupe par valeur distincte de la première
 * parmi les lignes reçues, qui sont celles de lignesGrille — le filtre est
 * déjà passé, et un groupe n'existe que par ses lignes —, puis, dans chaque
 * groupe, un sous-groupe par valeur distincte de la colonne suivante, et
 * ainsi de suite. Chaque groupe garde ses lignes dans l'ordre reçu, celui
 * du tri.
 *
 * Une colonne de texte groupe par la clé normalisée, comme le tri la lit :
 * le groupe se nomme par l'orthographe du plus petit identifiant qu'il
 * compte parmi toutes les lignes (options.toutes, celles d'avant le filtre,
 * les lignes reçues sans elles), que ni le tri, ni l'ordre reçu, ni le
 * filtre ne changent : à chaque niveau, les lignes de toutes qui portent les
 * valeurs du chemin du groupe le nomment. Un champ null forme le
 * groupe vide, après toute valeur dans les deux sens. L'exclusion groupe
 * les présentes avant les exclues. La présence groupe par clePresence,
 * « tous » d'abord dans le sens croissant ; son groupe se nomme par la clé
 * de libellé et les détails d'affichagePresence (presence.js). Le statut
 * groupe par statuts.get(id),
 * dans l'ordre de GROUPES_STATUT : une exclue, absente des statuts
 * calculés, dans son groupe ; une présente qui y manque, dans le groupe non
 * calculé.
 *
 * Les groupes d'un niveau s'ordonnent sur leur valeur dans le sens du tri
 * quand le tri porte sur la colonne de ce niveau, croissants sinon ; l'ordre
 * est total, donc le même quel que soit l'ordre de découverte des valeurs.
 *
 * Un groupe rend sa clé, unique parmi tous les groupes de tous les niveaux
 * et stable tant que les valeurs qui le désignent ne changent pas : celle
 * de son parent, « / », puis le segment de sa valeur — 'texte:<clé
 * normalisée>', où « % » et « / » s'échappent en %25 et %2F, 'vide',
 * 'exclu:non', 'exclu:oui', 'presence:tous', 'presence:<clePresence>',
 * 'statut:<statut>' ; au premier niveau, le seul segment. Il rend aussi son
 * niveau, de 1 au nombre de colonnes, sa colonne, son libellé, qui est soit
 * une donnée (libelle), soit la clé d'un texte de la table de traduction
 * (cleLibelle), l'autre valant null, les détails de cette clé
 * (detailsLibelle : ceux d'une présence partielle, {} pour tous, null pour
 * toute autre colonne), le nombre de ses lignes, ses lignes, et ses
 * sous-groupes : null au dernier niveau, la liste des groupes de la colonne
 * suivante sinon.
 *
 * @param {Array<Object>} lignes   les lignes de la grille, dans leur ordre
 * @param {Array<string>} colonnes  des colonnes de GROUPEMENTS, distinctes,
 *        au moins une, la plus large d'abord
 * @param {{tri: null|{colonne: string, sens: 'croissant'|'decroissant'},
 *          cleNormalisee: (texte: string) => string,
 *          statuts: Map<number, 'ancre'|'partiel'|'mobile'>|null,
 *          toutes?: Array<Object>}} options   toutes : les lignes d'avant le
 *        filtre, qui contiennent celles reçues ; elles ne font que nommer
 * @returns {Array<{cle: string, niveau: number, colonne: string, libelle: string|null,
 *          cleLibelle: string|null, detailsLibelle: Object|null, compte: number, lignes: Array<Object>, sousGroupes: Array<Object>|null}>}
 * @throws {RangeError} colonnes qui n'est pas une liste, vide, répétée ou
 *         hors de GROUPEMENTS
 */
export function groupesGrille(lignes, colonnes, { tri, cleNormalisee, statuts, toutes = lignes }) {
  if (
    !Array.isArray(colonnes) ||
    colonnes.length === 0 ||
    new Set(colonnes).size !== colonnes.length ||
    !colonnes.every((colonne) => GROUPEMENTS.includes(colonne))
  ) {
    throw new RangeError(`groupement inconnu : ${JSON.stringify(colonnes)}`);
  }
  return grouperNiveau(lignes, toutes, colonnes, 1, null, { tri, cleNormalisee, statuts });
}

// Les groupes des lignes sur colonnes[niveau - 1], chacun sous-groupé par
// les colonnes suivantes et nommé par les lignes de toutes qui portent sa
// valeur ; parent est la clé du groupe qui les contient, null au premier
// niveau.
function grouperNiveau(lignes, toutes, colonnes, niveau, parent, options) {
  const { tri, cleNormalisee, statuts } = options;
  const colonne = colonnes[niveau - 1];
  const signe = tri !== null && tri.colonne === colonne ? SENS.get(tri.sens) : 1;

  // La valeur d'une ligne : le segment de sa clé, son rang d'ordre — un
  // nombre, une chaîne, ou null pour le groupe vide — et son libellé, avec
  // les détails de sa clé de libellé.
  const valeurDe = (p) => {
    if (colonne === 'statut') {
      const statut = p.exclu ? 'exclue' : (statuts?.get(p.id) ?? 'inconnu');
      return { segment: `statut:${statut}`, rang: RANGS_STATUT.get(statut), libelle: null, cleLibelle: GROUPES_STATUT.get(statut), detailsLibelle: null };
    }
    if (colonne === 'exclu') {
      return p.exclu
        ? { segment: 'exclu:oui', rang: 1, libelle: null, cleLibelle: 'participants.grille.exclue', detailsLibelle: null }
        : { segment: 'exclu:non', rang: 0, libelle: null, cleLibelle: 'participants.grille.presente', detailsLibelle: null };
    }
    if (colonne === 'presence') {
      const presence = presenceSaisie(p);
      const rang = clePresence(presence);
      const { cle, details } = affichagePresence(presence);
      return { segment: presence === null ? 'presence:tous' : `presence:${rang}`, rang, libelle: null, cleLibelle: cle, detailsLibelle: details };
    }
    if (p[colonne] === null) return { segment: 'vide', rang: null, libelle: null, cleLibelle: 'participants.groupe.vide', detailsLibelle: null };
    const cle = cleNormalisee(p[colonne]);
    return { segment: `texte:${segment(cle)}`, rang: cle, libelle: p[colonne], cleLibelle: null, detailsLibelle: null };
  };

  // Les lignes par segment, chaque segment nommé par son plus petit identifiant.
  const parValeur = (liste) => {
    const parSegment = new Map();
    for (const p of liste) {
      const valeur = valeurDe(p);
      const groupe = parSegment.get(valeur.segment);
      if (groupe === undefined) {
        parSegment.set(valeur.segment, { ...valeur, plusPetitId: p.id, lignes: [p] });
        continue;
      }
      groupe.lignes.push(p);
      if (p.id < groupe.plusPetitId) {
        groupe.plusPetitId = p.id;
        groupe.libelle = valeur.libelle;
      }
    }
    return parSegment;
  };
  const parSegment = parValeur(lignes);
  const nommes = toutes === lignes ? parSegment : parValeur(toutes);

  // Deux groupes ont deux rangs distincts : la comparaison ne rend jamais 0.
  const comparer = (a, b) => {
    if (a.rang === null) return 1;
    if (b.rang === null) return -1;
    const ecart = typeof a.rang === 'number' ? a.rang - b.rang : comparerTextes(a.rang, b.rang);
    return ecart * signe;
  };
  return [...parSegment.values()].sort(comparer).map(({ segment: propre, libelle, cleLibelle, detailsLibelle, lignes: membres }) => {
    const cle = parent === null ? propre : `${parent}/${propre}`;
    const nomme = nommes.get(propre);
    const semblables = nomme === undefined ? membres : nomme.lignes;
    return {
      cle,
      niveau,
      colonne,
      libelle: nomme === undefined ? libelle : nomme.libelle,
      cleLibelle,
      detailsLibelle,
      compte: membres.length,
      lignes: membres,
      sousGroupes: niveau === colonnes.length ? null : grouperNiveau(membres, semblables, colonnes, niveau + 1, cle, options),
    };
  });
}

/**
 * Les lignes que montre la liste groupée : celles de chaque groupe, groupe
 * après groupe, et dans un groupe sous-groupé, sous-groupe après
 * sous-groupe, hors des groupes repliés et de tout ce qu'ils contiennent.
 * La navigation au clavier ne parcourt qu'elles.
 *
 * @param {Array<{cle: string, lignes: Array<Object>, sousGroupes: Array<Object>|null}>} groupes   ceux de groupesGrille
 * @param {Set<string>} replies   les clés des groupes repliés
 * @returns {Array<Object>}
 */
export function lignesVisibles(groupes, replies) {
  return groupes.flatMap(({ cle, lignes, sousGroupes }) => {
    if (replies.has(cle)) return [];
    return sousGroupes === null ? lignes : lignesVisibles(sousGroupes, replies);
  });
}

/**
 * Les groupes repliés après la bascule du groupe cle : replié, il se
 * déplie ; déplié, il se replie. Rend un nouvel ensemble.
 *
 * @param {Set<string>} replies
 * @param {string} cle
 * @returns {Set<string>}
 */
export function basculerGroupe(replies, cle) {
  const suivants = new Set(replies);
  if (suivants.has(cle)) suivants.delete(cle);
  else suivants.add(cle);
  return suivants;
}

/**
 * Les groupes repliés une fois déplié chaque groupe du chemin — celui d'une
 * ligne que la grille doit montrer, de cheminDe. Sans clé repliée sur le
 * chemin, l'ensemble reçu lui-même, que la grille n'a pas à réécrire ; sinon
 * un nouvel ensemble.
 *
 * @param {Set<string>} replies
 * @param {Array<string>} chemin
 * @returns {Set<string>}
 */
export function deplierChemin(replies, chemin) {
  if (!chemin.some((cle) => replies.has(cle))) return replies;
  return new Set([...replies].filter((cle) => !chemin.includes(cle)));
}

/**
 * Le rang de la ligne qui prend la place d'une ligne sortie de la liste —
 * le filtre ne la montre plus —, au rang rangAvant qu'elle occupait : la
 * suivante, qui a glissé à ce rang, ou la dernière quand elle fermait la
 * liste ; null quand la liste, de nombre lignes, est vide.
 *
 * @param {number} rangAvant
 * @param {number} nombre
 * @returns {number|null}
 */
export function ligneVoisine(rangAvant, nombre) {
  if (nombre === 0) return null;
  return Math.min(rangAvant, nombre - 1);
}

/**
 * Les clés des groupes du premier niveau, dans leur ordre : celles que
 * « Tout replier » replie, leurs sous-groupes se cachant avec eux.
 *
 * @param {Array<{cle: string}>} groupes   ceux de groupesGrille
 * @returns {Array<string>}
 */
export function clesPremierNiveau(groupes) {
  return groupes.map(({ cle }) => cle);
}

/**
 * Les clés des groupes qui comptent la personne id, du premier niveau au
 * dernier ; vide quand aucun ne la compte — le filtre l'a retirée.
 *
 * @param {Array<{cle: string, lignes: Array<{id: number}>, sousGroupes: Array<Object>|null}>} groupes
 * @param {number} id
 * @returns {Array<string>}
 */
export function cheminDe(groupes, id) {
  const groupe = groupes.find(({ lignes }) => lignes.some((p) => p.id === id));
  if (groupe === undefined) return [];
  return [groupe.cle, ...(groupe.sousGroupes === null ? [] : cheminDe(groupe.sousGroupes, id))];
}

/**
 * La cellule qu'atteint une touche depuis la cellule position, dans une
 * grille de lignes × colonnes. La touche se lit par effetDe dans le
 * contexte 'grille' de RACCOURCIS. Les flèches — effets haut, bas, gauche,
 * droite — bougent d'une cellule et restent sur place au bord ; Tab (effet
 * suivante) avance dans la ligne puis passe au début de la suivante,
 * Maj+Tab (effet precedente) recule de même. Tab après la dernière cellule,
 * Maj+Tab avant la première, rendent null : le focus quitte la grille, et
 * le navigateur le mène à l'élément suivant. Une autre touche ne bouge
 * rien. Une grille sans ligne n'a pas de cellule : null.
 *
 * @param {{ligne: number, colonne: number}} position
 * @param {string} touche   la touche telle que RACCOURCIS la nomme :
 *   KeyboardEvent.key, « Maj+ » devant quand la majuscule change l'effet
 * @param {{lignes: number, colonnes: number}} taille
 * @returns {{ligne: number, colonne: number}|null}
 */
export function celluleSuivante({ ligne, colonne }, touche, { lignes, colonnes }) {
  if (lignes === 0 || colonnes === 0) return null;
  const borner = (valeur, max) => (valeur < 0 ? 0 : valeur > max ? max : valeur);
  const rang = ligne * colonnes + colonne;
  switch (effetDe('grille', touche)) {
    case 'haut':
      return { ligne: borner(ligne - 1, lignes - 1), colonne };
    case 'bas':
      return { ligne: borner(ligne + 1, lignes - 1), colonne };
    case 'gauche':
      return { ligne, colonne: borner(colonne - 1, colonnes - 1) };
    case 'droite':
      return { ligne, colonne: borner(colonne + 1, colonnes - 1) };
    case 'suivante':
      return rang + 1 >= lignes * colonnes ? null : { ligne: Math.floor((rang + 1) / colonnes), colonne: (rang + 1) % colonnes };
    case 'precedente':
      return rang === 0 ? null : { ligne: Math.floor((rang - 1) / colonnes), colonne: (rang - 1) % colonnes };
    default:
      return { ligne, colonne };
  }
}

/**
 * L'orthographe déjà portée par un autre participant pour une organisation
 * saisie, à proposer sans fusionner : la première, dans l'ordre reçu, dont
 * la clé normalisée égale celle de la saisie. null quand la saisie est
 * nouvelle, vide, ou identique à une organisation portée — lue comme la
 * saisie l'enregistre, en NFC, sans ses blancs de bord. Une organisation
 * null ne se compare pas.
 *
 * @param {string|null} saisie
 * @param {Array<{organisation: string|null}>} participants
 * @param {(texte: string) => string} cleNormalisee
 * @returns {string|null}
 */
export function orthographeExistante(saisie, participants, cleNormalisee) {
  if (saisie === null) return null;
  const texte = saisie.normalize('NFC').trim();
  if (texte === '') return null;
  const portees = participants.map(({ organisation }) => organisation).filter((a) => a !== null);
  if (portees.includes(texte)) return null;
  const cle = cleNormalisee(texte);
  return portees.find((organisation) => cleNormalisee(organisation) === cle) ?? null;
}

/**
 * L'itinéraire d'une personne dans le retenu, pour la fiche : à chaque
 * tour, de 1 à tours, la table (numéro affiché) et le siège — null quand le
 * retenu n'attribue pas les sièges —, la réserve, ou l'absence à ce tour,
 * lue dans etat.absents : une personne absente à un tour garde son
 * itinéraire, qui le dit à ce tour. Lu dans etatDuTour(r)
 * = etatPlaces(charge, {tour: r}), jamais recalculé. Un tour dont la source
 * n'est pas 'retenu' — le retenu gardé à moins de tours que l'événement
 * n'en compte, après une hausse des tours (§ 9) — se dit hors du retenu,
 * et les tours que le retenu porte restent. null quand le tour 1 n'a pas le
 * retenu pour source, ou que la personne n'est, à un tour du retenu, ni
 * assise ni en réserve ni absente — une exclue, qu'aucune liste du tour ne
 * nomme.
 *
 * @param {number} id
 * @param {number} tours
 * @param {(tour: number) => Object} etatDuTour   l'EtatPlaces du tour
 * @returns {Array<{tour: number, numero: number, siege: number|null}|{tour: number, reserve: true}
 *          |{tour: number, absente: true}|{tour: number, horsRetenu: true}>|null}
 */
export function itineraire(id, tours, etatDuTour) {
  const etapes = [];
  for (let tour = 1; tour <= tours; tour += 1) {
    const etat = etatDuTour(tour);
    if (etat.source !== 'retenu') {
      if (tour === 1) return null;
      etapes.push({ tour, horsRetenu: true });
      continue;
    }
    let etape = null;
    for (const table of etat.tables) {
      const chaise = table.chaises.find(({ occupant }) => occupant === id);
      if (chaise !== undefined) {
        etape = { tour, numero: table.numero, siege: etat.siegesAttribues ? chaise.siege : null };
        break;
      }
    }
    if (etape === null && etat.reserve.includes(id)) etape = { tour, reserve: true };
    if (etape === null && etat.absents.includes(id)) etape = { tour, absente: true };
    if (etape === null) return null;
    etapes.push(etape);
  }
  return etapes;
}

/**
 * Vrai quand Entrée valide la saisie : toujours, sauf Maj+Entrée dans une
 * zone de texte — les notes —, qui y insère un saut de ligne.
 *
 * @param {{maj: boolean, multiligne: boolean}} touche   maj : Maj tenue ;
 *        multiligne : la saisie est une zone de texte
 * @returns {boolean}
 */
export function entreeValide({ maj, multiligne }) {
  return !(maj && multiligne);
}

/**
 * Les réservations d'une personne, pour la fiche et la fenêtre de
 * suppression : dans l'ordre de la charge, chacune avec le numéro affiché
 * de sa table.
 *
 * @param {{tables: Array<{id: number, numero: number}>, reservations: Array<Object>}} charge
 * @param {number} id
 * @returns {Array<{numero: number, siege: number|null, portee: 'tous'|'tour', tour: number|null}>}
 */
export function reservationsDe(charge, id) {
  const numeroDe = new Map(charge.tables.map((table) => [table.id, table.numero]));
  return charge.reservations
    .filter(({ participant }) => participant === id)
    .map(({ table, siege, portee, tour }) => ({ numero: numeroDe.get(table), siege, portee, tour }));
}

/**
 * Le nom proposé à l'enregistrement de l'export de la liste (§ 10.2) :
 * ‹base›-participants.csv, base étant celle de l'événement ouvert.
 *
 * @param {string} base
 * @returns {string}
 */
export const nomExport = (base) => `${base}-participants.csv`;
