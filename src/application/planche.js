// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de la planche de badges (§ 11.3 à § 11.8) : ce que chaque badge
// imprime, dans l'ordre de la pile, et les lignes de la feuille de contrôle.
// Le modèle se lit de la charge et rien d'autre — ni horloge, ni disque, ni
// tirage, ni langue du système — : deux appels sur la même charge rendent
// des modèles égaux, et un badge réédité égale celui de la première planche
// tant que le placement n'a pas bougé. Chaque texte se compose par libelle,
// en français, jamais décoré par la langue témoin (contrainte 25) ; la mise
// en page et le PDF (src/pdf) ne composent aucun mot.
//
// La planche imprime une source : le placement retenu, ou une proposition
// désignée par son identifiant (Q3), qui sort toujours en BROUILLON, et que
// la feuille de contrôle nomme. Elle se refuse sans placement, sur un
// placement qui se contredit ou qui ne décrit plus la soirée, avant de
// produire (§ 11.8).
//
// La liste des badges en CSV (listeBadges) se lit du même modèle : mêmes
// badges, même ordre, mêmes lignes de tour, texte pour texte.
//
// Chaque badge porte le chemin du logo de sa personne, relatif au dossier
// de l'événement, ou null : le modèle ne lit pas l'image, la séance la lit
// et la planche la dessine. La liste en CSV ne le porte jamais, et la
// feuille de contrôle ne dit des logos que leurs comptes, quand la séance
// les lui donne.
//
// Le nom que le badge imprime est le nom affiché de sa personne, ou, sous
// l'option cacherNumero, celui d'une personne marquée nomNumerote privé de
// son numéro final (§ 11.4). Tout le reste lit le nom entier : le badge
// lui-même (Badge.nom), l'ordre de la pile, les homonymes, la liste de
// réédition de la feuille de contrôle et la liste en CSV.
import { SEPARATEUR, ecrireCsv } from '../csv/export.js';
import { pourvoyeursDesTitres } from '../csv/import.js';
import { cleNormalisee } from '../csv/normalisation.js';
import { MODELES_BADGE, PAPIERS, PAPIER_BADGES_DEFAUT, estModeleBadge } from '../geometrie/papiers.js';
import { SUFFIXE_NUMERO } from '../stockage/document.js';
import { derive, fautes } from '../stockage/placements.js';
import { raisonsNommees } from './avertissements.js';
import { formeNommeeDe } from './commandes.js';
import { ErreurCommande, refus } from './erreurs.js';
import { libelle } from './libelles.js';
import { nomAffiche } from './personnes.js';
import { estBrouillon, horodatagePlacement } from './sorties.js';
import { versionVisible } from './version.js';

/**
 * @typedef {'feuille'|'pile'} Imposition
 * @typedef {'alphabetique'|'table'} Ordre
 * @typedef {Object} LigneTour
 * @property {number|null} tour     null : « Toute la soirée », un itinéraire
 *                                  constant sur R ≥ 2 tours
 * @property {number|null} table    le numéro affiché ; null : « pas de table »
 * @property {string} [libelleTable]   le libellé de la table, en NFC ;
 *                                  absent quand la table n'en porte pas, ou
 *                                  sans table
 * @property {number|null} siege    sous sièges attribués seulement
 * @property {string|null} titre    le titre dont une réservation fait la
 *                                  personne titulaire à ce tour
 * @property {boolean} absente      vrai à un tour où la personne est
 *                                  absente : table, siège et titre null,
 *                                  tour jamais null
 * @typedef {Object} Badge
 * @property {number} participant
 * @property {string} nom                 le nom affiché, en NFC, entier :
 *                                        numéro final compris
 * @property {string|null} organisation   en NFC ; null : la ligne n'existe pas
 * @property {LigneTour[]} lignes
 * @property {number|null} identifiant    celui d'un homonyme que rien ne sépare
 * @property {string|null} logo           le chemin du logo de la personne,
 *                                        relatif au dossier de l'événement ;
 *                                        null sans logo
 * @property {{nom: string, lignes: string[], abregeables: Array<Array<{debut: number, fin: number}>>,
 *             organisation: string|null, pied: string[], piedReduit: string[]}} textes
 *           nom : celui que le badge imprime (nomImprime) ; abregeables : pour
 *           chaque ligne de tour, les textes libres que la mise en page abrège
 *           au plancher — le libellé de la table, puis le titre —, par leurs
 *           positions en unités UTF-16, dans cet ordre
 * @typedef {Object} ModelePlanche
 * @property {Badge[]} badges             dans l'ordre de la pile
 * @property {'retenu'|'proposition'} source   le placement imprimé
 * @property {number|null} proposition    l'identifiant de la proposition
 *                                        imprimée ; null pour le retenu
 * @property {{nom: string, date: string|null}} evenement
 * @property {string|null} horodatage
 * @property {boolean} brouillon
 * @property {{participants: number, exclus: number, produits: number}} comptes
 * @property {Array<{nom: string, ids: number[]}>} homonymes
 * @property {null|{ids: number[]}} reedition
 * @property {string} version
 */

/** Les sources d'une planche (Q3). */
export const SOURCES_PLANCHE = Object.freeze(['retenu', 'proposition']);
/** Les ordres de la pile (§ 11.6, décision 9). */
export const ORDRES = Object.freeze(['alphabetique', 'table']);
/** Les impositions de la planche (§ 11.6). */
export const IMPOSITIONS = Object.freeze(['feuille', 'pile']);

/**
 * Le papier des badges d'un modèle (§ 11.2) : celui qu'il impose — Lettre
 * pour Avery 5392 —, sinon celui de la machine, PAPIER_BADGES_DEFAUT tant
 * qu'aucun n'est choisi. Le défaut ne vaut que pour les badges : il ne
 * devient pas le papier de la machine, que l'aperçu d'impression demande.
 *
 * @param {import('../geometrie/papiers.js').ModeleBadge} modeleBadge
 * @param {null|import('../geometrie/papiers.js').Papier} papier   celui de la machine
 * @returns {import('../geometrie/papiers.js').Papier}
 * @throws {TypeError} un modèle hors de MODELES_BADGE
 */
export function papierDesBadges(modeleBadge, papier) {
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`modeleBadge : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
  return MODELES_BADGE[modeleBadge].papier ?? papier ?? PAPIER_BADGES_DEFAUT;
}

// Les refus de la mise en page, que la production relaie (refusProduction).
const TROP_DE_TOURS = 'PLANCHE_TROP_DE_TOURS';
const NOM_TROP_LONG = 'PLANCHE_NOM_TROP_LONG';

// Le remède des refus qui renvoient aux propositions : en choisir une, ou en
// produire de nouvelles. Un objet neuf à chaque refus.
const versPropositions = () => ({ geste: 'ouvrirSection', section: 'propositions' });

/**
 * Compare deux chaînes point de code par point de code : -1, 0 ou 1. « < »
 * compare des unités UTF-16, et range une lettre du plan astral — codée
 * par une paire de substitution, de U+D800 à U+DFFF — avant un caractère de
 * U+E000 à U+FFFF : l'ordre de la pile en dépendrait. Une chaîne qui en
 * prolonge une autre vient après elle.
 *
 * @param {string} a
 * @param {string} b
 * @returns {-1|0|1}
 * @throws {TypeError} un argument qui n'est pas une chaîne
 */
export function comparerPointsDeCode(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') {
    throw new TypeError(`comparerPointsDeCode : deux chaînes attendues, reçu ${typeof a} et ${typeof b}`);
  }
  // codePointAt lit, à l'indice d'une unité haute, le point de code entier :
  // deux chaînes qui diffèrent par une paire se départagent là. À l'indice
  // d'une unité basse, il ne se lit qu'après une unité haute égale, et deux
  // unités basses se comparent alors comme leurs points de code.
  for (let i = 0; i < a.length && i < b.length; i += 1) {
    const [pa, pb] = [a.codePointAt(i), b.codePointAt(i)];
    if (pa !== pb) return pa < pb ? -1 : 1;
  }
  if (a.length === b.length) return 0;
  return a.length < b.length ? -1 : 1;
}

// La clé d'organisation d'une personne : la clé normalisée, vide sans
// organisation ou pour une organisation faite de blancs.
const cleOrganisation = ({ organisation }) => cleNormalisee(organisation ?? '');

/**
 * Les homonymes que rien ne sépare sur un badge (§ 11.4, décision 7) : les
 * personnes non exclues de même nom affiché normalisé et de même
 * organisation normalisée, ou toutes deux sans organisation. Un groupe par
 * collision : nom, le nom affiché en NFC de sa personne d'identifiant le
 * plus petit ; ids, croissants. Les groupes se rangent par clé de nom, puis
 * d'organisation, par points de code. Le calcul porte sur toute la soirée,
 * jamais sur une sélection : un badge réédité garde son identifiant.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{nom: string, ids: number[]}>}
 */
export function homonymesDe(charge) {
  const groupes = new Map();
  const triees = charge.participants.filter(({ exclu }) => !exclu).sort((a, b) => a.id - b.id);
  for (const personne of triees) {
    const cles = [cleNormalisee(nomAffiche(personne)), cleOrganisation(personne)];
    const cle = JSON.stringify(cles);
    if (!groupes.has(cle)) groupes.set(cle, { cles, nom: nomAffiche(personne).normalize('NFC'), ids: [] });
    groupes.get(cle).ids.push(personne.id);
  }
  return [...groupes.values()]
    .filter(({ ids }) => ids.length > 1)
    .sort((a, b) => comparerPointsDeCode(a.cles[0], b.cles[0]) || comparerPointsDeCode(a.cles[1], b.cles[1]))
    .map(({ nom, ids }) => ({ nom, ids }));
}

// La source contrôlée et le placement qu'elle désigne : le retenu, null sans
// lui ; la proposition d'identifiant proposition, null quand aucune n'est
// désignée.
function placementDeSource(charge, source, proposition) {
  if (!SOURCES_PLANCHE.includes(source)) {
    throw new TypeError(`source : ${SOURCES_PLANCHE.join(' ou ')} attendue, reçu ${JSON.stringify(source)}`);
  }
  if (source === 'retenu') return charge.retenu;
  if (proposition === null) return null;
  if (!Number.isSafeInteger(proposition)) {
    throw new TypeError(`proposition : identifiant entier ou null attendu, reçu ${JSON.stringify(proposition)}`);
  }
  const designee = charge.propositions.find(({ id }) => id === proposition);
  if (designee === undefined) throw refus('PROPOSITION_INCONNUE', { id: proposition });
  return designee;
}

/**
 * Le refus qui garde la planche avant de produire (§ 11.8, Q3), le premier
 * dans cet ordre : PLANCHE_SANS_PLACEMENT {} — la source retenu sans retenu,
 * ou la source proposition sans proposition désignée ; quand le placement
 * de la source se contredit, RETENU_FAUTIF {}, relayé tel que les places le
 * lèvent, remède la version précédente du fichier, pour le retenu, et
 * PROPOSITION_FAUTIVE {id}, remède les propositions, pour une proposition —
 * le retenu, sain, ne se reprend pas pour elle ; PLANCHE_DERIVE {raisons},
 * les raisons de dérive de la source nommées (raisonsNommees) quand elle ne
 * décrit plus la soirée. null quand la planche se produit. Les détails
 * portent le remède.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {{source?: 'retenu'|'proposition', proposition?: number|null}} [options]
 * @returns {null|{code: string, details: Object}}
 * @throws {TypeError} une source inconnue, un identifiant qui n'est ni un
 *         entier ni null
 * @throws {ErreurCommande} PROPOSITION_INCONNUE {id}
 */
export function refusPlanche(charge, { source = 'retenu', proposition = null } = {}) {
  const placement = placementDeSource(charge, source, proposition);
  if (placement === null) return { code: 'PLANCHE_SANS_PLACEMENT', details: { remede: versPropositions() } };
  if (fautes(placement).length > 0) {
    if (source === 'proposition') return { code: 'PROPOSITION_FAUTIVE', details: { id: proposition, remede: versPropositions() } };
    return { code: 'RETENU_FAUTIF', details: { remede: { geste: 'ouvrirSecours', source: 'precedent' } } };
  }
  const raisons = derive(placement, charge);
  if (raisons.length > 0) {
    return { code: 'PLANCHE_DERIVE', details: { raisons: raisonsNommees(raisons, charge), remede: versPropositions() } };
  }
  return null;
}

/**
 * Un refus de la mise en page (§ 11.5), que la production relaie avec le
 * remède du contrat : PLANCHE_TROP_DE_TOURS {tours}, sans remède ;
 * PLANCHE_NOM_TROP_LONG {participant}, vers la liste des participants, où
 * le nom se corrige. Les détails reçus restent, personne comprise quand
 * l'appelant la nomme.
 *
 * @param {string} code
 * @param {Object} details
 * @returns {{code: string, details: Object}}
 * @throws {TypeError} un autre code
 */
export function refusProduction(code, details) {
  if (code === TROP_DE_TOURS) return { code, details: { ...details, remede: null } };
  if (code === NOM_TROP_LONG) {
    return { code, details: { ...details, remede: { geste: 'ouvrirSection', section: 'participants' } } };
  }
  throw new TypeError(`refusProduction : ${TROP_DE_TOURS} ou ${NOM_TROP_LONG} attendu, reçu ${JSON.stringify(code)}`);
}

// Un libellé de table imprimé tient sur la ligne de son tour : ses sauts de
// ligne, tabulations et autres caractères de contrôle deviennent des
// espaces, et les espaces qui se suivent n'en font qu'une. Une ligne du PDF
// reste une ligne, et la cellule des tours du CSV garde une ligne par tour.
// null sans libellé, ou quand il ne reste rien.
function surUneLigne(texte) {
  if (texte == null) return null;
  const ligne = texte
    .normalize('NFC')
    .replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ')
    .replace(/ {2,}/g, ' ')
    .trim();
  return ligne === '' ? null : ligne;
}

// Où chaque personne s'assied à chaque tour du placement, lu de sa forme
// nommée : Map participant → tableau par tour de { absente, table
// (identifiant), numero, libelle, siege } ; table et numero null dans la
// réserve comme à un tour d'absence, qu'absente seul distingue
// (Ligne.absent) ; libelle, celui de la table en NFC sur une seule ligne,
// null sans lui.
function placesParTour(charge, cible, tours) {
  const libelles = new Map(charge.tables.map(({ id, libelle: texte }) => [id, surUneLigne(texte)]));
  const places = new Map();
  for (const { tour, table, numero, siege, participant, absent } of formeNommeeDe(charge, cible).lignes) {
    if (!places.has(participant)) places.set(participant, Array.from({ length: tours }, () => null));
    places.get(participant)[tour - 1] = absent
      ? { absente: true, table: null, numero: null, libelle: null, siege: null }
      : { absente: false, table, numero, libelle: table === null ? null : (libelles.get(table) ?? null), siege };
  }
  return places;
}

// Les titres imprimés (§ 4.1, § 11.4, décision 11) : Map « participant/tour »
// → libellés, pour chaque titre dont une réservation fait la personne
// titulaire à ce tour (pourvoyeursDesTitres) ET que le placement assied à la
// table du titre — et à son siège quand il attribue les sièges. Un titre
// posé sur une chaise que le placement fait seulement occuper ne s'imprime
// pas : ce serait désigner le titulaire par tirage.
function titresImprimes(charge, places, siegesAttribues) {
  const titres = new Map();
  pourvoyeursDesTitres(charge).forEach(({ tours }, rang) => {
    const titre = charge.titres[rang];
    tours.forEach((reservation, indice) => {
      if (reservation === null) return;
      // La réservation d'une personne non exclue et présente à ce tour, que
      // le placement cohérent et sans dérive y assied ou y réserve : une
      // place de la réserve n'a pas de table, et ne porte aucun titre.
      const place = places.get(reservation.participant)[indice];
      if (place.table !== titre.table) return;
      if (siegesAttribues && place.siege !== titre.siege) return;
      const cle = `${reservation.participant}/${indice + 1}`;
      titres.set(cle, [...(titres.get(cle) ?? []), titre.libelle.normalize('NFC')]);
    });
  });
  return titres;
}

// Les lignes de tour d'une personne : une par tour, ou une seule « Toute la
// soirée » quand R ≥ 2, que table, libellé, siège et titre ne changent pas
// et que la personne est assise à une table à chaque tour. Une ligne de
// réserve ou d'absence garde son tour : « pas de table » et « absente » ont
// la même table null, la réserve n'est pas une table, et la réserve d'un
// tour ne se fond ni avec celle d'un autre ni avec l'absence d'un autre.
// Une ligne ne porte libelleTable que quand sa table a un libellé.
function lignesDe(id, places, titres) {
  const lignes = places.get(id).map((place, indice) => ({
    tour: indice + 1,
    table: place.numero,
    ...(place.libelle === null ? {} : { libelleTable: place.libelle }),
    siege: place.siege,
    titre: titres.get(`${id}/${indice + 1}`)?.join(', ') ?? null,
    absente: place.absente,
  }));
  const [premiere] = lignes;
  const constante = lignes.every(
    ({ table, libelleTable, siege, titre, absente }) =>
      !absente &&
      table !== null &&
      table === premiere.table &&
      libelleTable === premiere.libelleTable &&
      siege === premiere.siege &&
      titre === premiere.titre,
  );
  if (lignes.length >= 2 && constante) return [{ ...premiere, tour: null }];
  return lignes;
}

// Les caractères qui tiennent la place des textes libres d'une ligne de
// tour pendant qu'elle se compose : deux points de code d'usage privé, que
// les libellés de la planche n'écrivent jamais. Les textes libres — le
// libellé de la table, le titre — ne s'insèrent qu'ensuite : leur contenu,
// quel qu'il soit, ne se lit jamais comme une place à remplir.
const TENANT_LIBELLE = '\u{E000}';
const TENANT_TITRE = '\u{E001}';

// Une ligne de tour composée par libelle, et ses morceaux abrégeables : les
// positions du libellé de la table puis du titre dans le texte, dans l'ordre
// où la ligne les porte, celui où la mise en page les abrège (§ 11.5).
function ligneComposee(ligne) {
  const tenue = { ...ligne, titre: ligne.titre === null ? null : TENANT_TITRE };
  if (ligne.libelleTable !== undefined) tenue.libelleTable = TENANT_LIBELLE;
  const gabarit = libelle(ligne.tour === null ? 'planche.touteLaSoiree' : 'planche.tour', tenue);
  const libres = new Map([
    [TENANT_LIBELLE, ligne.libelleTable],
    [TENANT_TITRE, ligne.titre],
  ]);
  let texte = '';
  const morceaux = [];
  for (const caractere of gabarit) {
    const libre = libres.get(caractere);
    if (typeof libre !== 'string') {
      texte += caractere;
      continue;
    }
    morceaux.push({ debut: texte.length, fin: texte.length + libre.length });
    texte += libre;
  }
  return { texte, morceaux };
}

// Les textes d'un badge (§ 11.4, décision 8), composés par libelle : le pied
// porte l'événement et sa date, l'horodatage, puis l'identifiant d'un
// homonyme ; piedReduit, le même sans le nom de l'événement, date gardée.
// Aucun ne porte la version, ni le tour.
function textesDe({ nom, organisation, lignes, identifiant }, evenement, horodatage) {
  const ligneHorodatage =
    horodatage === null ? libelle('planche.pied.horodatageInconnu') : libelle('planche.pied.horodatage', { horodatage });
  const ligneIdentifiant = identifiant === null ? [] : [libelle('planche.pied.identifiant', { identifiant })];
  const ligneDate = evenement.date === null ? [] : [libelle('planche.pied.date', { date: evenement.date })];
  const composees = lignes.map(ligneComposee);
  return {
    nom,
    lignes: composees.map(({ texte }) => texte),
    abregeables: composees.map(({ morceaux }) => morceaux),
    organisation,
    pied: [libelle('planche.pied.evenement', evenement), ligneHorodatage, ...ligneIdentifiant],
    piedReduit: [...ligneDate, ligneHorodatage, ...ligneIdentifiant],
  };
}

// Le nom que le badge d'une personne imprime (§ 11.4), en NFC : son nom
// affiché ; sous cacherNumero, celui d'une personne marquée nomNumerote
// perd le numéro final de son nom (SUFFIXE_NUMERO), un seul :
// « Galet 01 01 » imprime « Galet 01 ». Un nom que le retrait laisserait
// vide ou blanc s'imprime entier.
function nomImprime(personne, cacherNumero) {
  if (!cacherNumero || personne.nomNumerote !== true) return nomAffiche(personne).normalize('NFC');
  const nom = personne.nom.replace(SUFFIXE_NUMERO, '');
  return nomAffiche({ ...personne, nom: nom.trim() === '' ? personne.nom : nom }).normalize('NFC');
}

// L'ordre alphabétique de la pile (§ 11.6, § 15.5) : la clé normalisée du
// nom, puis celle du prénom, par points de code, puis l'identifiant.
const ordreAlphabetique = (a, b) =>
  comparerPointsDeCode(cleNormalisee(a.personne.nom), cleNormalisee(b.personne.nom)) ||
  comparerPointsDeCode(cleNormalisee(a.personne.prenom ?? ''), cleNormalisee(b.personne.prenom ?? '')) ||
  a.personne.id - b.personne.id;

// Le rang d'une place du tour 1 dans l'ordre par table : 0 à une table, 1
// dans la réserve, 2 absente.
const rangHorsTable = ({ absente, table }) => (absente ? 2 : table === null ? 1 : 0);

// L'ordre par table (décision 9) : le numéro de la table du tour 1, puis la
// réserve de ce tour, puis les absentes de ce tour, l'identifiant de table
// pour deux numéros égaux, puis l'ordre alphabétique.
function ordreParTable(a, b) {
  const [pa, pb] = [a.places[0], b.places[0]];
  const horsTable = rangHorsTable(pa) - rangHorsTable(pb);
  if (horsTable !== 0) return horsTable;
  if (pa.table !== null && pa.table !== pb.table) return pa.numero - pb.numero || pa.table - pb.table;
  return ordreAlphabetique(a, b);
}

// La sélection d'une réédition, contrôlée : null, ou des identifiants
// entiers, au moins un, sans doublon, chacun d'une personne non exclue.
function selectionLue(charge, selection) {
  if (selection === null) return null;
  const forme =
    Array.isArray(selection) &&
    selection.length > 0 &&
    selection.every(Number.isSafeInteger) &&
    new Set(selection).size === selection.length;
  if (!forme) throw new TypeError(`selection : null ou identifiants entiers distincts attendus, reçu ${JSON.stringify(selection)}`);
  for (const id of selection) {
    const personne = charge.participants.find((candidate) => candidate.id === id);
    if (personne === undefined) throw refus('PARTICIPANT_INCONNU', { id });
    if (personne.exclu) {
      throw refus('PERSONNE_EXCLUE', { participant: id }, { commande: 'reintegrerParticipant', arguments: { id } });
    }
  }
  return new Set(selection);
}

/**
 * Le modèle de la planche (§ 11.4 à § 11.8) : un badge par personne non
 * exclue — ou par personne de la sélection, pour une réédition —, dans
 * l'ordre demandé, ses lignes de tour lues du placement de la source, ses
 * textes composés. source et proposition : le placement imprimé, que la
 * feuille de contrôle nomme ; horodatage : horodatagePlacement de la source ;
 * brouillon : estBrouillon sur toute la soirée, toujours vrai pour une
 * proposition ; version : versionVisible, que la feuille de contrôle
 * imprime et le badge jamais. cacherNumero, faux par défaut, retire des
 * textes de chaque badge le numéro final d'un nom marqué nomNumerote
 * (nomImprime) ; le badge garde son nom entier, et l'ordre de la pile et les
 * homonymes se lisent sur lui. Les comptes sont ceux de la soirée, produits
 * celui des badges du modèle. La charge n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {Object} options
 * @param {'retenu'|'proposition'} [options.source]
 * @param {number|null} [options.proposition]   la proposition imprimée
 * @param {Ordre} [options.ordre]
 * @param {number[]|null} [options.selection]   les personnes à rééditer
 * @param {boolean} [options.cacherNumero]      le numéro des doublons caché
 * @param {string} options.provenance           le mode de construction
 * @param {string} options.version              la version affichée
 * @returns {ModelePlanche}
 * @throws {TypeError} une option hors de son domaine
 * @throws {ErreurCommande} le refus de refusPlanche ; PROPOSITION_INCONNUE
 *         {id} ; PARTICIPANT_INCONNU {id} ou PERSONNE_EXCLUE {participant}
 *         pour une personne de la sélection
 */
export function modelePlanche(
  charge,
  { source = 'retenu', proposition = null, ordre = 'alphabetique', selection = null, cacherNumero = false, provenance, version },
) {
  if (!ORDRES.includes(ordre)) throw new TypeError(`ordre : ${ORDRES.join(' ou ')} attendu, reçu ${JSON.stringify(ordre)}`);
  if (typeof cacherNumero !== 'boolean') throw new TypeError(`cacherNumero : booléen attendu, reçu ${JSON.stringify(cacherNumero)}`);
  if (typeof provenance !== 'string' || typeof version !== 'string') {
    throw new TypeError('modelePlanche : provenance et version, deux chaînes, attendues');
  }
  const rejet = refusPlanche(charge, { source, proposition });
  if (rejet !== null) throw new ErreurCommande(rejet.code, rejet.details);
  const choisies = selectionLue(charge, selection);

  const placement = placementDeSource(charge, source, proposition);
  const cible = source === 'retenu' ? { retenu: true } : { proposition };
  const places = placesParTour(charge, cible, placement.tours);
  const titres = titresImprimes(charge, places, placement.siegesAttribues);
  const homonymes = homonymesDe(charge);
  const identifiants = new Set(homonymes.flatMap(({ ids }) => ids));
  const evenement = { nom: charge.evenement.nom.normalize('NFC'), date: charge.evenement.date };
  const horodatage = horodatagePlacement(charge, { source, proposition });

  const retenues = charge.participants
    .filter(({ exclu, id }) => !exclu && (choisies === null || choisies.has(id)))
    .map((personne) => ({ personne, places: places.get(personne.id) }))
    .sort(ordre === 'table' ? ordreParTable : ordreAlphabetique);
  const badges = retenues.map(({ personne }) => {
    const organisation = cleOrganisation(personne) === '' ? null : personne.organisation.normalize('NFC');
    const badge = {
      participant: personne.id,
      nom: nomAffiche(personne).normalize('NFC'),
      organisation,
      lignes: lignesDe(personne.id, places, titres),
      identifiant: identifiants.has(personne.id) ? personne.id : null,
    };
    const textes = textesDe({ ...badge, nom: nomImprime(personne, cacherNumero) }, evenement, horodatage);
    return { ...badge, logo: personne.logo ?? null, textes };
  });

  const exclus = charge.participants.filter(({ exclu }) => exclu).length;
  return {
    badges,
    source,
    proposition: source === 'proposition' ? proposition : null,
    evenement,
    horodatage,
    brouillon: estBrouillon(charge, { source, tour: 'tous' }),
    comptes: { participants: charge.participants.length, exclus, produits: badges.length },
    homonymes,
    reedition: choisies === null ? null : { ids: badges.map(({ participant }) => participant) },
    version: versionVisible(provenance, version, libelle),
  };
}

// Le point de code d'un caractère, écrit U+XXXX, quatre chiffres au moins.
const pointDeCode = (caractere) => `U+${caractere.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`;

// Un texte dont chaque caractère absent de la police s'écrit par son point
// de code : la police le dessinerait comme une case vide.
const sansAbsents = (texte, absents) => [...texte].map((c) => (absents.has(c) ? pointDeCode(c) : c)).join('');

/**
 * Les lignes de la feuille de contrôle (§ 11.3, § 11.5, § 11.8), page 1 de la
 * planche de l'A6, document à part pour Avery 5392 : les cotes du badge et
 * son modèle, le papier et ses cotes, l'imposition — l'A6 seulement, les
 * cartes suivant la pile —, le nombre de planches, le compte produit et le
 * compte attendu, l'événement et sa date, la source — le placement retenu, ou
 * la proposition par son numéro —, l'horodatage du placement, la version, la
 * consigne d'impression, puis, pour Avery 5392, celle de la feuille à part,
 * sur papier ordinaire ; quand logos est donné, les comptes des logos des
 * participants, posés, sans place et introuvables ; BROUILLON s'il y a
 * lieu ; pour une réédition, son compte puis les noms réédités, entiers
 * (Badge.nom), dans l'ordre de la pile ; les caractères absents de la
 * police, quand il y en a, par leur point de code. Dans toutes les lignes,
 * un caractère absent s'écrit « U+674E », jamais tel quel.
 *
 * @param {ModelePlanche} modele
 * @param {Object} options
 * @param {import('../geometrie/papiers.js').Papier} options.papier
 * @param {Imposition} options.imposition
 * @param {number} options.planches        entier ≥ 0
 * @param {string[]} [options.absents]     un caractère chacun, doublons admis
 * @param {import('../geometrie/papiers.js').ModeleBadge} [options.modeleBadge]   'a6' par défaut
 * @param {null|{poses: number, sansPlace: number, introuvables: number}} [options.logos]   les
 *        comptes des logos des badges, entiers ≥ 0 ; null par défaut, quand
 *        aucun badge ne désigne de logo : la ligne n'existe pas
 * @returns {string[]}
 * @throws {TypeError} une option hors de son domaine, un papier que le
 *         modèle de badge n'admet pas, une source du modèle hors de la sienne
 */
export function textesControle(modele, { papier, imposition, planches, absents = [], modeleBadge = 'a6', logos = null }) {
  if (typeof papier !== 'string' || !Object.hasOwn(PAPIERS, papier)) {
    throw new TypeError(`papier : clé de PAPIERS attendue, reçu ${JSON.stringify(papier)}`);
  }
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`modeleBadge : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
  const badgeDuModele = MODELES_BADGE[modeleBadge];
  if (badgeDuModele.papier !== null && badgeDuModele.papier !== papier) {
    throw new TypeError(`papier : le modèle ${modeleBadge} se pose sur ${badgeDuModele.papier}, reçu ${papier}`);
  }
  const cartes = badgeDuModele.grille !== null;
  if (!IMPOSITIONS.includes(imposition)) {
    throw new TypeError(`imposition : ${IMPOSITIONS.join(' ou ')} attendue, reçu ${JSON.stringify(imposition)}`);
  }
  if (!Number.isSafeInteger(planches) || planches < 0) {
    throw new TypeError(`planches : entier ≥ 0 attendu, reçu ${JSON.stringify(planches)}`);
  }
  const unCaractere = (c) => typeof c === 'string' && [...c].length === 1;
  if (!Array.isArray(absents) || !absents.every(unCaractere)) {
    throw new TypeError(`absents : caractères attendus, reçu ${JSON.stringify(absents)}`);
  }
  const compteLogos = (n) => Number.isSafeInteger(n) && n >= 0;
  const logosBienFormes = logos === null || [logos?.poses, logos?.sansPlace, logos?.introuvables].every(compteLogos);
  if (!logosBienFormes) throw new TypeError(`logos : null ou trois comptes entiers ≥ 0 attendus, reçu ${JSON.stringify(logos)}`);
  const { badges, source, proposition, evenement, horodatage, brouillon, comptes, reedition, version } = modele;
  const sourceBienFormee =
    (source === 'retenu' && proposition === null) || (source === 'proposition' && Number.isSafeInteger(proposition));
  if (!sourceBienFormee) {
    throw new TypeError(`modele : source et proposition attendues, reçu ${JSON.stringify({ source, proposition })}`);
  }
  const { largeur, hauteur } = badgeDuModele;
  const lignes = [
    libelle('planche.controle.badge', { largeur, hauteur, modeleBadge }),
    libelle('planche.controle.papier', { papier, ...PAPIERS[papier] }),
    ...(cartes ? [] : [libelle('planche.controle.imposition', { imposition })]),
    libelle('planche.controle.planches', { planches }),
    libelle('planche.controle.comptes', comptes),
    libelle('planche.controle.evenement', evenement),
    libelle('planche.controle.source', { source, proposition }),
    horodatage === null ? libelle('planche.pied.horodatageInconnu') : libelle('planche.pied.horodatage', { horodatage }),
    libelle('planche.controle.version', { version }),
    libelle('planche.controle.consigne'),
    ...(cartes ? [libelle('planche.controle.cartes', { modeleBadge })] : []),
    ...(logos === null ? [] : [libelle('planche.controle.logos', logos)]),
  ];
  if (brouillon) lignes.push(libelle('planche.brouillon'));
  if (reedition !== null) {
    lignes.push(libelle('planche.controle.reedition', { n: reedition.ids.length }), ...badges.map(({ nom }) => nom));
  }
  const uniques = new Set(absents);
  const ecrites = lignes.map((ligne) => sansAbsents(ligne, uniques));
  if (uniques.size > 0) ecrites.push(libelle('planche.controle.absents', { points: [...uniques].map(pointDeCode) }));
  return ecrites;
}

// La fin de ligne dans la cellule des tours : un saut de ligne, qui force la
// citation du champ (ecrireCsv) ; les enregistrements, eux, finissent par
// CRLF.
const SAUT_DANS_LA_CELLULE = '\n';

// Les en-têtes de la liste, dans l'ordre de ses colonnes.
const ENTETES_LISTE = Object.freeze([
  'planche.liste.nom',
  'planche.liste.prenom',
  'planche.liste.organisation',
  'planche.liste.tours',
]);

/**
 * La liste des badges d'un modèle, en CSV (§ 11.6) : l'en-tête « Nom;Prénom;
 * Organisation;Tours », puis un enregistrement par badge, dans l'ordre de la
 * pile — celui du modèle, sélection d'une réédition comprise, les exclus
 * absents. Nom et prénom sont ceux de la personne, en NFC, le prénom vide
 * quand il manque ; l'organisation, celle du badge, vide quand le badge n'en
 * porte pas ; Tours, les lignes de tour du badge, texte pour texte, jointes
 * par un saut de ligne dans la cellule. Écrite par ecrireCsv : UTF-8 avec
 * marque d'ordre d'octets, « ; », CRLF, citation RFC 4180. Mêmes entrées,
 * mêmes octets.
 *
 * @param {ModelePlanche} modele      celui de modelePlanche sur cette charge
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Uint8Array}
 * @throws {TypeError} un badge dont la personne manque à la charge
 */
export function listeBadges(modele, charge) {
  const personnes = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const enregistrements = modele.badges.map(({ participant, organisation, textes }) => {
    const personne = personnes.get(participant);
    if (personne === undefined) throw new TypeError(`listeBadges : participant ${participant} absent de la charge`);
    return [
      personne.nom.normalize('NFC'),
      (personne.prenom ?? '').normalize('NFC'),
      organisation ?? '',
      textes.lignes.join(SAUT_DANS_LA_CELLULE),
    ];
  });
  return ecrireCsv([ENTETES_LISTE.map((cle) => libelle(cle)), ...enregistrements], SEPARATEUR);
}
