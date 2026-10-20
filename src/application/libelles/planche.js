// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes de la planche de badges (§ 11.3 à § 11.8, contrainte 25) : les
// refus qui la gardent avant de produire, ce qu'un badge imprime — ses lignes
// de tour, son pied — et les lignes de la feuille de contrôle. Le papier les
// lit par libelle, jamais décorés par la langue témoin : un texte imprimé est
// une donnée. Un horodatage et une date se mettent en mots à partir de leur
// seule forme, sans horloge ni langue du système. Le nom d'un papier arrive
// dans les détails : cette table n'en écrit aucun.
import { lireHorodatage } from '../format.js';
import { compte, enumeration, nomDans, ouEcrire, phraseDeRaison } from './aides.js';

// Les impositions de la planche (§ 11.6), comme la feuille de contrôle les
// nomme.
const NOMS_DES_IMPOSITIONS = new Map([
  ['feuille', 'feuille par feuille'],
  ['pile', 'en pile'],
]);

// Une cote en millimètres, la virgule pour décimale.
const cote = (mm) => String(mm).replace('.', ',');

// Deux chiffres, zéro de tête compris.
const deuxChiffres = (n) => String(n).padStart(2, '0');

// Une date AAAA-MM-JJ en lettres, par le texte de la mise en forme.
function dateEnLettres(date, texte) {
  const [annee, mois, jour] = date.split('-').map(Number);
  return texte('format.date', { annee, mois, jour });
}

// La personne d'un refus : son nom affiché quand les détails le portent, son
// identifiant sinon.
const laPersonne = ({ participant, personne }) => personne ?? `la personne n° ${participant}`;

// Où la personne s'assied à une ligne : la table, puis le siège sous sièges
// attribués, puis le titre dont une réservation la fait titulaire ; « pas de
// table » quand elle est en réserve.
function place({ table, siege, titre }, texte) {
  if (table === null) return texte('planche.pasDeTable');
  const auSiege = siege === null ? '' : texte('planche.siege', { siege });
  const avecTitre = titre === null ? '' : texte('planche.titre', { titre });
  return `table ${table}${auSiege}${avecTitre}`;
}

export const TABLE = new Map([
  // --- Les refus de la planche (§ 11.5, § 11.8, Q3) --------------------------
  [
    'PLANCHE_SANS_PLACEMENT',
    () => "Aucun placement à imprimer : retenez une proposition, ou choisissez-en une parmi les propositions.",
  ],
  [
    'PROPOSITION_FAUTIVE',
    ({ id }) =>
      `La proposition n° ${id} se contredit, la planche ne se produit pas : ` +
      'choisissez-en une autre parmi les propositions, ou relancez la génération.',
  ],
  [
    'PLANCHE_DERIVE',
    ({ raisons }, texte) =>
      'Le placement ne décrit plus la soirée, la planche ne se produit pas : ' +
      raisons.map((raison) => phraseDeRaison(raison.code, raison, texte)).join(' '),
  ],
  [
    'PLANCHE_TROP_DE_TOURS',
    ({ tours }) =>
      `Les ${tours} tours ne tiennent pas sur un badge, même sur deux colonnes au plus petit corps : ` +
      "la planche n'est pas produite, plutôt qu'une liste de tours tronquée.",
  ],
  [
    'PLANCHE_NOM_TROP_LONG',
    (details) =>
      `Le nom de ${laPersonne(details)} ne tient pas sur son badge, même replié sur trois lignes au plus petit corps : ` +
      'la planche ne se produit pas, plutôt que de tronquer ses tours.',
  ],

  // --- Les refus de la production (§ 8.5, § 11.6, décision 13) -------------
  [
    'PLANCHE_NON_ECRITE',
    (details, texte) =>
      `La planche n'a pas pu s'écrire : ${ouEcrire(details, texte)}. « Enregistrer sous… » la dépose ailleurs.`,
  ],
  ['PAPIER_REQUIS', () => "Choisissez le papier de l'imprimante avant de produire la planche : l'imposition en dépend."],

  // --- Les lignes de tour d'un badge (§ 11.4, § 11.5) ------------------------
  // Une ligne : le tour, ou « Toute la soirée » pour un itinéraire constant,
  // puis la place de la personne ; « absente » à un tour où elle est
  // absente (ligne.absente vrai), qu'une ligne « Toute la soirée » ne porte
  // jamais.
  [
    'planche.tour',
    (ligne, texte) => `Tour ${ligne.tour} — ${ligne.absente ? texte('planche.absente') : place(ligne, texte)}`,
  ],
  ['planche.touteLaSoiree', (ligne, texte) => `Toute la soirée — ${place(ligne, texte)}`],
  ['planche.pasDeTable', 'pas de table'],
  ['planche.absente', 'absente'],
  ['planche.siege', ({ siege }) => `, siège ${siege}`],
  ['planche.titre', ({ titre }) => ` — ${titre}`],

  // --- Le pied d'un badge, et la marque du brouillon (§ 11.4, § 11.7) -------
  // L'événement et sa date ; la date seule, quand le nom de l'événement
  // quitte un pied trop chargé (décision 8).
  [
    'planche.pied.evenement',
    ({ nom, date }, texte) => (date === null ? nom : `${nom}, ${dateEnLettres(date, texte)}`),
  ],
  ['planche.pied.date', ({ date }, texte) => dateEnLettres(date, texte)],
  // L'horodatage du placement, à la seconde et à l'heure qu'il porte : deux
  // retouches dans la même minute donnent deux pieds différents.
  [
    'planche.pied.horodatage',
    ({ horodatage }, texte) => {
      const { annee, mois, jour, heure, minute, seconde } = lireHorodatage(horodatage);
      const temps = [heure, minute, seconde].map(deuxChiffres).join(':');
      return `Placement du ${texte('format.date', { annee, mois, jour })} à ${temps}`;
    },
  ],
  ['planche.pied.horodatageInconnu', 'Horodatage du placement inconnu'],
  ['planche.pied.identifiant', ({ identifiant }) => `Identifiant n° ${identifiant}`],
  ['planche.brouillon', 'BROUILLON'],

  // --- La feuille de contrôle (§ 11.3, § 11.5, § 11.8) ----------------------
  ['planche.controle.badge', ({ largeur, hauteur }) => `Badge : ${cote(largeur)} × ${cote(hauteur)} mm (A6)`],
  [
    'planche.controle.papier',
    ({ papier, largeur, hauteur }) => `Papier : ${papier}, ${cote(largeur)} × ${cote(hauteur)} mm`,
  ],
  [
    'planche.controle.imposition',
    ({ imposition }) => `Imposition : ${nomDans(NOMS_DES_IMPOSITIONS, imposition, 'imposition')}`,
  ],
  ['planche.controle.planches', ({ planches }) => `Planches : ${planches}`],
  [
    'planche.controle.comptes',
    ({ produits, participants, exclus }) =>
      `${compte(produits, 'badge', 'badges')} pour ${compte(participants, 'participant', 'participants')}` +
      (exclus === 0 ? '' : `, ${compte(exclus, 'exclu', 'exclus')}`),
  ],
  ['planche.controle.evenement', (evenement, texte) => `Événement : ${texte('planche.pied.evenement', evenement)}`],
  // La source imprimée : le placement retenu, ou la proposition par son
  // numéro, que rien d'autre sur la page ne distingue d'une autre proposition
  // de la même génération.
  [
    'planche.controle.source',
    ({ source, proposition }) =>
      source === 'proposition'
        ? `Source : la proposition n° ${proposition}, qui n\u{2019}est pas le placement retenu`
        : 'Source : le placement retenu',
  ],
  ['planche.controle.version', ({ version }) => `Version : ${version}`],
  ['planche.controle.consigne', 'Imprimer en recto seul, à 100 %'],
  ['planche.controle.reedition', ({ n }) => `Réédition : ${compte(n, 'badge', 'badges')}`],
  [
    'planche.controle.absents',
    ({ points }) => `Caractères absents de la police, imprimés sans glyphe : ${enumeration(points)}`,
  ],
]);
