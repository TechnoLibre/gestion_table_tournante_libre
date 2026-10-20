// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'import appliqué (§ 10.1) : ce que remplacer détruirait, à annoncer avant
// d'agir ; l'aperçu appliqué à une charge, selon le mode ; le CSV des lignes
// refusées, qui se corrige et se réimporte tel quel.
//
// appliquerImport n'agit que sur un plan qui n'est pas bloqué, sur un
// aperçu dont la présence est lue sous le nombre de tours de l'événement, et
// sans refus global ni ambiguïté. Il rend une charge neuve, qui ne
// partage avec celle qu'il reçoit que ses propositions figées (gel.js) :
// l'import entier tient dans une seule entrée d'historique, que la commande
// d'import écrit (§ 8.2). Les personnes ajoutées prennent leurs
// identifiants à partir de prochainsIds.participant, dans l'ordre du
// fichier, et le compteur ne recule jamais : un identifiant retiré ne revient
// pas (§ 4).
//
// Le CSV des refus reprend chaque ligne refusée telle que découpée, sous
// l'en-tête d'origine, et ajoute deux colonnes, ligne et motif, qu'aucun
// en-tête ne reconnaît : corrigé, il se réimporte sans qu'on en retire rien.
// Réimporté sans correction, il ne fait entrer aucune ligne que l'aperçu a
// refusée : chacune l'est de nouveau pour le même motif, sauf une ligne aux
// champs en trop parmi les vingt premiers enregistrements, qui fait refuser
// le texte entier, à son rang, par le choix du séparateur.

import { estPresentAuTour, presenceCanonique } from '../moteur/presence.js';
import { copieDeTravail } from '../stockage/gel.js';
import { MODES, designer, indexerParNom } from './apercu.js';
import { ErreurCsv } from './erreurs.js';
import { SEPARATEUR, ecrireCsv } from './export.js';
import { enregistrementVide } from './lecture.js';

// Champs d'une ligne de l'aperçu, dans l'ordre du participant : ceux que
// porte une personne créée, et que pose une mise à jour quand la cellule
// n'est pas vide. Les étiquettes et la présence, des listes, se posent à
// part (poser).
const CHAMPS_LUS = Object.freeze(['nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'notes', 'exclu']);

// En-têtes des deux colonnes qu'ajoute le CSV des refus, inconnues de
// l'association des colonnes.
const ENTETE_LIGNE = 'ligne';
const ENTETE_MOTIF = 'motif';

/**
 * Une ligne refusée, par l'aperçu ou par la mise à jour (§ 10.1). Le CSV des
 * refus en écrit une par ligne.
 *
 * @typedef {Object} LigneRefusee
 * @property {number} ligne          rang de l'enregistrement, en-tête compris
 * @property {string} code           CHAMPS_EN_TROP, NOM_ABSENT,
 *           EXCLU_INCONNU, ETIQUETTE_MAL_FORMEE, ETIQUETTES_TROP_NOMBREUSES,
 *           PRESENCE_ILLISIBLE ou PRESENCE_HORS_TOURS, de l'aperçu ;
 *           PLUSIEURS_CORRESPONDENT ou DEJA_DESIGNE, de la mise à jour
 * @property {string|null} valeur    la valeur d'« exclu » refusée sous
 *           EXCLU_INCONNU, l'étiquette fautive sous ETIQUETTE_MAL_FORMEE,
 *           la cellule de présence sous PRESENCE_ILLISIBLE et
 *           PRESENCE_HORS_TOURS, null sous tout autre code
 * @property {string} [raison]       ETIQUETTE_MAL_FORMEE : 'controle' ou
 *           'longueur' ; PRESENCE_ILLISIBLE : 'syntaxe', 'intervalle' ou
 *           'date'
 * @property {number} [nombre]       ETIQUETTES_TROP_NOMBREUSES : le nombre
 *           d'étiquettes de la cellule
 * @property {number} [tour]         PRESENCE_HORS_TOURS : le premier tour
 *           fautif de la cellule
 * @property {number} [tours]        PRESENCE_HORS_TOURS : le nombre de
 *           tours de l'aperçu
 * @property {number[]} [participants]  refus de la mise à jour : les
 *           identifiants croissants que la ligne désigne
 * @property {number} [premiereLigne]   DEJA_DESIGNE : la ligne qui désigne
 *           ce participant la première
 * @property {string[]} brut         les champs tels que découpés
 *
 * @typedef {Object} ResumeImport
 * @property {number} ajoutes               participants créés
 * @property {number} misAJour              participants dont une valeur au
 *           moins a changé
 * @property {number} inchanges             participants désignés par une
 *           ligne qui ne change rien
 * @property {number} retires               participants retirés
 * @property {number} reservationsRetirees  leurs réservations
 * @property {LigneRefusee[]} refusees      rangées par ligne
 * @property {boolean} derive               vrai en état retenu
 */

const parLigne = (a, b) => a.ligne - b.ligne;

// L'ordre canonique des réservations, celui du schéma du fichier d'état :
// participant, table, la portée « tous » avant « tour », puis le tour et le
// siège, null en tête. Il départage, partout où la règle des titres et
// l'état des places choisissent entre deux réservations.
const rangDePortee = (portee) => (portee === 'tous' ? 0 : 1);
const nulEnTete = (a, b) => (a === b ? 0 : a === null ? -1 : b === null ? 1 : a - b);
export const ordreDesReservations = (a, b) =>
  a.participant - b.participant ||
  a.table - b.table ||
  rangDePortee(a.portee) - rangDePortee(b.portee) ||
  nulEnTete(a.tour, b.tour) ||
  nulEnTete(a.siege, b.siege);

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Les titres d'une table, par rang dans charge.titres, rangés par siège puis
// par libellé : l'ordre où les réservations sans siège les pourvoient.
function titresParTable(titres) {
  const parTable = new Map();
  titres.forEach((titre, rang) => {
    if (!parTable.has(titre.table)) parTable.set(titre.table, []);
    parTable.get(titre.table).push(rang);
  });
  for (const rangs of parTable.values()) {
    rangs.sort((a, b) => titres[a].siege - titres[b].siege || comparerTextes(titres[a].libelle, titres[b].libelle) || a - b);
  }
  return parTable;
}

// Répartit entre les titres d'une table — rangs, dans leur ordre — les
// réservations couvrantes, déjà rangées dans l'ordre canonique, et rend
// Map rang → réservation qui le pourvoit. D'abord chaque réservation à un
// siège pourvoit les titres de ce siège encore libres. Puis, en mode table
// seulement, chaque personne qu'aucune réservation à un siège de cette table
// ne place pourvoit le premier titre resté libre : celles qui tiennent une
// réservation « tous » d'abord, par identifiant croissant, puis les autres ;
// une personne en pourvoit un au plus. Sous des sièges attribués, une
// réservation sans siège ne pourvoit rien : un titre porte toujours un siège.
function repartirTitres(rangs, titres, couvrantes, attribuerSieges) {
  const pris = new Map();
  const assises = new Set();
  for (const reservation of couvrantes) {
    if (reservation.siege === null) continue;
    assises.add(reservation.participant);
    for (const rang of rangs) {
      if (!pris.has(rang) && titres[rang].siege === reservation.siege) pris.set(rang, reservation);
    }
  }
  if (attribuerSieges) return pris;
  const sansSiege = new Map();
  for (const reservation of couvrantes) {
    if (reservation.siege !== null || assises.has(reservation.participant)) continue;
    const deja = sansSiege.get(reservation.participant);
    if (deja === undefined || (deja.portee !== 'tous' && reservation.portee === 'tous')) {
      sansSiege.set(reservation.participant, reservation);
    }
  }
  const ordre = [...sansSiege.values()].sort(
    (a, b) => rangDePortee(a.portee) - rangDePortee(b.portee) || a.participant - b.participant,
  );
  const libres = rangs.filter((rang) => !pris.has(rang));
  ordre.forEach((reservation, i) => {
    if (i < libres.length) pris.set(libres[i], reservation);
  });
  return pris;
}

// Vrai quand le participant est présent à chacun des tours 1..tours.
function presentATousLesTours(participant, tours) {
  for (let tour = 1; tour <= tours; tour += 1) if (!estPresentAuTour(participant, tour)) return false;
  return true;
}

/**
 * La règle d'un titre pourvu (§ 4.1, § 4.4, § 2.1 étape 6), seule
 * implémentation : bilanRemplacement en compte les titres, l'application en
 * tire ses listes de travail et l'état de ses places. Un titre n'est pourvu
 * que par la réservation d'une personne non exclue — la réservation d'une
 * exclue est suspendue — qui tient sa place : même table, et même siège
 * quand la réservation en porte un. Au tour r, seules pourvoient les
 * réservations des personnes présentes à r : la réservation d'une absente y
 * est suspendue. Sous des sièges attribués, une réservation sans siège ne
 * pourvoit aucun titre. En mode table, une
 * réservation sans siège pourvoit au plus un titre de sa table, dans l'ordre
 * des sièges des titres, après ceux que les réservations à un siège
 * pourvoient (repartirTitres).
 *
 * Rend, rang à rang de charge.titres, { soiree, tours } : soiree, la
 * réservation « tous les tours » qui le pourvoit pour la soirée, null sans
 * elle — la répartition des seules réservations « tous » des personnes
 * présentes à chaque tour, la même à chaque tour ; tours[r − 1], la
 * réservation qui le pourvoit au tour r, parmi toutes celles qui couvrent ce
 * tour et dont la personne y est présente, null sans elle. Une réservation
 * d'un tour désigné pourvoit le titre à ce tour seulement. La charge n'est pas
 * modifiée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {Array<{soiree: Object|null, tours: Array<Object|null>}>}
 */
export function pourvoyeursDesTitres({ evenement, reglages, participants, reservations, titres }) {
  const presents = new Map(participants.filter(({ exclu }) => !exclu).map((personne) => [personne.id, personne]));
  const actives = reservations.filter(({ participant }) => presents.has(participant)).sort(ordreDesReservations);
  const rendus = titres.map(() => ({ soiree: null, tours: Array.from({ length: evenement.tours }, () => null) }));
  for (const [idTable, rangs] of titresParTable(titres)) {
    const aLaTable = actives.filter(({ table }) => table === idTable);
    const tous = aLaTable.filter(
      ({ portee, participant }) => portee === 'tous' && presentATousLesTours(presents.get(participant), evenement.tours),
    );
    for (const [rang, reservation] of repartirTitres(rangs, titres, tous, reglages.attribuerSieges)) {
      rendus[rang].soiree = reservation;
    }
    for (let tour = 1; tour <= evenement.tours; tour += 1) {
      const couvrantes = aLaTable.filter(
        (r) => (r.portee === 'tous' || r.tour === tour) && estPresentAuTour(presents.get(r.participant), tour),
      );
      for (const [rang, reservation] of repartirTitres(rangs, titres, couvrantes, reglages.attribuerSieges)) {
        rendus[rang].tours[tour - 1] = reservation;
      }
    }
  }
  return rendus;
}

// Titres pourvus à un tour au moins (§ 4.1, § 4.4) : ceux qu'un
// remplacement laisserait non pourvus.
const titresPourvus = (charge) =>
  pourvoyeursDesTitres(charge).filter(({ soiree, tours }) => soiree !== null || tours.some((r) => r !== null)).length;

/**
 * Ce que remplacer détruirait, à annoncer avant d'agir (§ 10.1) : « 260
 * personnes seront supprimées » laisse croire qu'on ne perd que des noms.
 * Remplacer retire chaque participant et ses réservations ; il garde les
 * titres, qui appartiennent aux places, et les propositions, qui deviennent
 * périmées (§ 8.9). Le bilan compte :
 * - participants : les participants retirés, exclus compris ;
 * - reservations : leurs réservations, suspendues comprises, soit toutes :
 *   chaque réservation d'une charge que l'analyse admet est celle d'un
 *   participant ;
 * - titresPourvus : les titres qu'une réservation pourvoit à un tour au
 *   moins, et que le remplacement laisse non pourvus, selon la règle de
 *   pourvoyeursDesTitres ;
 * - propositions : les propositions qui placent au moins une personne
 *   retirée. Le retenu n'y entre pas : l'import en état retenu porte
 *   l'avertissement de dérive.
 * La charge n'est pas modifiée.
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @returns {{participants: number, reservations: number, titresPourvus: number, propositions: number}}
 */
export function bilanRemplacement(charge) {
  const retires = new Set(charge.participants.map(({ id }) => id));
  return {
    participants: charge.participants.length,
    reservations: charge.reservations.length,
    titresPourvus: titresPourvus(charge),
    propositions: charge.propositions.filter(({ participants }) => participants.some((id) => retires.has(id))).length,
  };
}

// Les étiquettes d'une ligne telles que le fichier d'état les range : une
// copie, triée par unités de code (§ 8.9), qui ne partage rien avec
// l'aperçu.
const rangees = (etiquettes) => [...etiquettes].sort(comparerTextes);

// Vrai quand deux listes d'étiquettes rangées portent les mêmes chaînes, rang
// à rang : deux listes distinctes de même contenu sont égales.
const memesEtiquettes = (a, b) => a.length === b.length && a.every((motCle, rang) => motCle === b[rang]);

// Vrai quand deux présences canoniques sont la même : undefined (tous les
// tours) des deux côtés, ou les mêmes tours rang à rang.
const memePresence = (a, b) =>
  a === undefined || b === undefined ? a === b : a.length === b.length && a.every((tour, rang) => tour === b[rang]);

// Participant créé d'une ligne de l'aperçu, sous tours tours, ses clés dans
// l'ordre du fichier d'état : un exclu vide vaut non ; les étiquettes,
// rangées, puis la présence canonique, en dernier, chaque clé absente quand
// la ligne n'en porte pas (§ 8.9). Une présence vide ou qui nomme chaque
// tour laisse le champ absent : la personne vient à tous les tours.
function creer(id, { nom, prenom, organisation, courriel, titrePressenti, notes, exclu, etiquettes, presence }, tours) {
  const participant = { id, nom, prenom, organisation, courriel, titrePressenti, notes, exclu: exclu ?? false };
  if (etiquettes !== null) participant.etiquettes = rangees(etiquettes);
  const canonique = presence === null ? undefined : presenceCanonique(presence, tours);
  if (canonique !== undefined) participant.presence = canonique;
  return participant;
}

// Pose sur le participant chaque champ non vide de la ligne, sous tours
// tours : un champ vide garde la valeur (§ 10.1). Une cellule d'étiquettes
// non vide remplace la liste entière, une cellule vide la garde : un CSV
// n'efface pas les étiquettes. De même, une cellule de présence non vide
// remplace la présence, une cellule vide la garde, et « tous » retire le
// champ. Les listes se comparent élément par élément, les étiquettes une
// fois rangées, la présence sous sa forme canonique : un fichier réimporté
// ne compte aucun modifié. Rend vrai quand une valeur a changé.
function poser(participant, champs, tours) {
  let change = false;
  for (const champ of CHAMPS_LUS) {
    if (champs[champ] !== null && champs[champ] !== participant[champ]) {
      participant[champ] = champs[champ];
      change = true;
    }
  }
  if (champs.etiquettes !== null) {
    const etiquettes = rangees(champs.etiquettes);
    if (!memesEtiquettes(etiquettes, participant.etiquettes ?? [])) {
      participant.etiquettes = etiquettes;
      change = true;
    }
  }
  if (champs.presence !== null) {
    const canonique = presenceCanonique(champs.presence, tours);
    if (!memePresence(canonique, participant.presence)) {
      if (canonique === undefined) delete participant.presence;
      else participant.presence = canonique;
      change = true;
    }
  }
  return change;
}

// Met à jour, en place, les participants que désignent les lignes, et rend
// les lignes à ajouter, les refus et les comptes. Chaque ligne désigne par
// designer, contre l'index des participants d'avant l'import : un
// participant ajouté par une ligne n'est désigné par aucune autre, et le
// prénom ou l'organisation qu'une ligne pose n'écarte pas ce participant des
// candidats d'une suivante. Une ligne qui ne désigne personne est à ajouter.
// Une ligne qui en désigne plusieurs est refusée PLUSIEURS_CORRESPONDENT,
// jamais ajoutée. Le participant qu'une ligne désigne seule est mis à jour
// par la première de ces lignes, dans l'ordre du fichier ; chaque suivante
// est refusée DEJA_DESIGNE : deux lignes ne se fondent pas en silence dans
// une même personne. tours est celui de l'événement, sous lequel la
// présence d'une ligne se met en forme.
function mettreAJour(participants, lignes, tours) {
  const index = indexerParNom(participants);
  const parId = new Map(participants.map((participant) => [participant.id, participant]));
  const designes = new Map();
  const nouvelles = [];
  const refusees = [];
  let misAJour = 0;
  let inchanges = 0;
  for (const { ligne, champs, brut } of lignes) {
    const { candidats } = designer(champs, index);
    if (candidats.length === 0) {
      nouvelles.push({ champs });
      continue;
    }
    if (candidats.length > 1) {
      refusees.push({ ligne, code: 'PLUSIEURS_CORRESPONDENT', valeur: null, participants: candidats, brut: [...brut] });
      continue;
    }
    const [id] = candidats;
    if (designes.has(id)) {
      refusees.push({
        ligne, code: 'DEJA_DESIGNE', valeur: null, participants: [id], premiereLigne: designes.get(id),
        brut: [...brut],
      });
      continue;
    }
    designes.set(id, ligne);
    if (poser(parId.get(id), champs, tours)) misAJour += 1;
    else inchanges += 1;
  }
  return { nouvelles, refusees, misAJour, inchanges };
}

/**
 * Applique un aperçu à une charge (§ 10.1), selon le mode :
 * - 'ajouter' : chaque ligne valide devient un participant ; un doublon ne se
 *   fusionne jamais ;
 * - 'mettreAJour' : une ligne désigne, par designer, les participants
 *   d'avant l'import de même nom normalisé ; le prénom et l'organisation
 *   n'en écartent un que lorsque la ligne et lui en portent tous deux un,
 *   de clés normalisées différentes, selon leurs valeurs d'avant l'import.
 *   Une ligne ajoutée à côté d'un participant de même nom est celle que
 *   l'aperçu nomme dans homonymes. Désigné seul, le participant prend chaque champ non vide de
 *   la ligne, nom, prénom et organisation compris, et garde la valeur d'un
 *   champ vide ; exclu vide le garde ; une cellule d'étiquettes non vide
 *   remplace la liste, vide la garde ; une cellule de présence non vide
 *   remplace la présence, vide la garde, et « tous » la retire. Une ligne
 *   qui ne désigne personne est
 *   ajoutée ; qui en désigne plusieurs, refusée PLUSIEURS_CORRESPONDENT ; qui
 *   désigne un participant qu'une ligne précédente désigne déjà, refusée
 *   DEJA_DESIGNE ;
 * - 'remplacer' : les participants et leurs réservations sont retirés,
 *   puis chaque ligne valide ajoutée. Tables, titres, propositions et retenu
 *   restent (bilanRemplacement).
 * Une personne créée prend les champs de sa ligne, exclu vide valant non,
 * ses étiquettes rangées par unités de code, absentes quand la ligne n'en
 * porte pas, sa présence canonique, absente quand la cellule est vide ou
 * nomme chaque tour ; les identifiants partent de prochainsIds.participant,
 * dans l'ordre du fichier, et le compteur avance d'autant. La charge et l'aperçu
 * reçus ne sont pas modifiés ; la charge rendue n'en partage aucun objet, les
 * propositions figées (gel.js) exceptées, qu'elle reprend telles quelles.
 *
 * Le résumé (ResumeImport) compte les participants ajoutés, mis à jour,
 * inchangés et retirés, et les réservations retirées. refusees porte les
 * lignes refusées par l'aperçu, puis par la mise à jour, rangées par ligne :
 * c'est la liste que reçoit exporterRefus. Chaque ligne valide est comptée
 * une fois : ajoutée, mise à jour, inchangée ou refusée. Une mise à jour dont
 * toutes les lignes sont refusées rend une charge égale à celle reçue.
 * derive est vrai en état retenu : l'import y avertit sans bloquer (§ 9).
 *
 * @param {import('../stockage/types.js').Charge} charge
 * @param {import('./apercu.js').Apercu} apercu  calculé contre les
 *   participants de la charge, pour ce mode : hors de remplacer,
 *   l'organisation d'une ligne y prend l'orthographe d'un existant de même
 *   clé ; en remplacer, celle du fichier
 * @param {'ajouter'|'mettreAJour'|'remplacer'} mode
 * @returns {{charge: import('../stockage/types.js').Charge, resume: ResumeImport}}
 * @throws {ErreurCsv} dans cet ordre : PLAN_BLOQUE, détails {}, en état
 *   bloqué ; APERCU_TOURS_CHANGES, détails { tours, toursApercu }, quand la
 *   colonne de la présence est associée et que l'aperçu l'a lue sous un
 *   autre nombre de tours que l'événement — le nombre a changé depuis
 *   l'aperçu, par un Défaire par exemple : c'est un état de la séance, et
 *   relire le fichier refait l'aperçu ; le refus global de l'aperçu, son
 *   code, détails { ligne }, le rang que nomme l'aperçu ou null ;
 *   AMBIGUITE, détails { champs }, les champs
 *   que l'en-tête laisse ambigus, tant que le choix ne les tranche pas
 * @throws {TypeError} pour un mode inconnu, et pour un aperçu calculé pour un
 *   autre mode : l'aperçu montré à l'opérateur est celui que l'import
 *   applique
 */
export function appliquerImport(charge, apercu, mode) {
  if (!MODES.includes(mode)) throw new TypeError(`mode : ${MODES.join(', ')} attendu, reçu ${String(mode)}`);
  if (apercu.mode !== mode) throw new TypeError(`aperçu calculé pour ${String(apercu.mode)}, import en ${mode}`);
  if (charge.evenement.etat === 'bloque') throw new ErreurCsv('PLAN_BLOQUE');
  const { tours } = charge.evenement;
  if (apercu.association.colonnes.presence !== undefined && apercu.tours !== tours) {
    throw new ErreurCsv('APERCU_TOURS_CHANGES', { tours, toursApercu: apercu.tours });
  }
  if (apercu.refusGlobal !== null) throw new ErreurCsv(apercu.refusGlobal, { ligne: apercu.refusGlobalLigne });
  const { ambigus } = apercu.association;
  if (ambigus.length > 0) throw new ErreurCsv('AMBIGUITE', { champs: ambigus.map(({ champ }) => champ) });

  const resultat = copieDeTravail(charge);
  let retires = 0;
  let reservationsRetirees = 0;
  let aAjouter = apercu.lignes;
  let suite = { refusees: [], misAJour: 0, inchanges: 0 };
  if (mode === 'remplacer') {
    retires = resultat.participants.length;
    reservationsRetirees = resultat.reservations.length;
    resultat.participants = [];
    resultat.reservations = [];
  } else if (mode === 'mettreAJour') {
    suite = mettreAJour(resultat.participants, apercu.lignes, tours);
    aAjouter = suite.nouvelles;
  }
  for (const { champs } of aAjouter) {
    resultat.participants.push(creer(resultat.prochainsIds.participant, champs, tours));
    resultat.prochainsIds.participant += 1;
  }
  return {
    charge: resultat,
    resume: {
      ajoutes: aAjouter.length,
      misAJour: suite.misAJour,
      inchanges: suite.inchanges,
      retires,
      reservationsRetirees,
      refusees: [...structuredClone(apercu.refusees), ...suite.refusees].sort(parLigne),
      derive: charge.evenement.etat === 'retenu',
    },
  };
}

/**
 * CSV des lignes refusées (§ 10.1, § 14.10), qui se corrige et se réimporte
 * tel quel. L'en-tête est celui d'origine, tel qu'écrit, suivi de ligne et
 * motif, deux en-têtes qu'aucun champ ne reconnaît. Chaque refus, rangé par
 * ligne, écrit ses cellules d'origine telles que découpées, complétées de
 * cellules vides jusqu'à la largeur de l'en-tête, puis son rang et son
 * motif : ligne et motif restent sous leur en-tête. Des cellules au-delà de
 * l'en-tête ne s'écrivent, après le motif, que lorsque l'une n'est pas
 * blanche — la ligne refusée CHAMPS_EN_TROP — : réimporté sans correction,
 * le fichier ne fait entrer aucune ligne décalée. UTF-8 avec marque, CRLF,
 * séparateur d'origine, « ; » pour un fichier à une colonne, qui n'en a pas ;
 * sans refus, l'en-tête seul.
 *
 * @param {import('./apercu.js').Apercu} apercu  ses en-têtes et son séparateur
 * @param {(code: string, details: Object) => string} motif  le texte d'un
 *   refus, de son code et de ses détails : la LigneRefusee sans code ni
 *   brut — ligne et valeur, plus participants et premiereLigne pour un refus
 *   de la mise à jour
 * @param {LigneRefusee[]} [refusees]  les refus à écrire : par défaut ceux
 *   de l'aperçu, sous un refus global comme sans ; après l'application,
 *   resume.refusees, qui porte aussi ceux de la mise à jour
 * @returns {Uint8Array}
 * @throws {TypeError} quand motif ne rend pas une chaîne
 */
export function exporterRefus(apercu, motif, refusees = apercu.refusees) {
  const largeur = apercu.entetes.length;
  const enregistrements = [[...apercu.entetes, ENTETE_LIGNE, ENTETE_MOTIF]];
  for (const { code, brut, ...details } of [...refusees].sort(parLigne)) {
    const texte = motif(code, details);
    if (typeof texte !== 'string') {
      throw new TypeError(`motif de ${code} : chaîne attendue, reçu ${JSON.stringify(texte) ?? String(texte)}`);
    }
    const cellules = brut.slice(0, largeur);
    while (cellules.length < largeur) cellules.push('');
    const auDela = brut.slice(largeur);
    enregistrements.push([...cellules, String(details.ligne), texte, ...(enregistrementVide(auDela) ? [] : auDela)]);
  }
  return ecrireCsv(enregistrements, apercu.separateur ?? SEPARATEUR);
}
