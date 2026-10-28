// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes de la planche de badges (§ 11.3 à § 11.8, contrainte 25) : les
// refus qui la gardent avant de produire, ce qu'un badge imprime — ses
// lignes de tour, son pied, le pied TechnoLibre —, les lignes de la feuille
// de contrôle et les en-têtes de la liste des badges en CSV. Le papier et le
// CSV les lisent par libelle, jamais décorés par la langue témoin : un texte
// imprimé est une donnée. Un horodatage et une date se mettent en mots à
// partir de leur seule forme, sans horloge ni langue du système. Le nom
// d'un papier arrive dans les détails : cette table n'en écrit aucun.
import { lireHorodatage } from '../format.js';
import { cite, compte, enumeration, nomDans, nomDuTour, ouEcrire, phraseDeRaison } from './aides.js';

// Les impositions de la planche (§ 11.6), comme la feuille de contrôle les
// nomme.
const NOMS_DES_IMPOSITIONS = new Map([
  ['feuille', 'feuille par feuille'],
  ['pile', 'en pile'],
]);

// Les modèles de badge, comme la feuille de contrôle les nomme.
const NOMS_DES_MODELES = new Map([
  ['a6', 'A6'],
  ['avery5392', 'Avery 5392'],
]);

// Les données qu'une case de la section retire des badges, comme la feuille
// de contrôle les nomme, par leur clé de DONNEES_BADGE.
const NOMS_DES_DONNEES = new Map([
  ['organisation', 'organisation'],
  ['evenement', 'nom de l\u{2019}\u{E9}v\u{E9}nement'],
  ['date', 'date de l\u{2019}\u{E9}v\u{E9}nement'],
  ['horodatage', 'date du placement'],
  ['identifiant', 'identifiant'],
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

// Où la personne s'assied à une ligne : la table, son libellé quand elle en
// porte un, puis le siège sous sièges attribués, puis le titre dont une
// réservation la fait titulaire ; « pas de table » quand elle est en
// réserve.
function place({ table, libelleTable, siege, titre }, texte) {
  if (table === null) return texte('planche.pasDeTable');
  const avecLibelle = libelleTable === undefined ? '' : texte('planche.libelleTable', { libelleTable });
  const auSiege = siege === null ? '' : texte('planche.siege', { siege });
  const avecTitre = titre === null ? '' : texte('planche.titre', { titre });
  return `table ${table}${avecLibelle}${auSiege}${avecTitre}`;
}

// Les fichiers d'une planche qu'une écriture refusée nomme : la planche —
// les cartes pour Avery 5392 —, la feuille de contrôle à part, la liste en
// CSV.
const LES_FICHIERS = new Map([
  ['planche', 'La planche'],
  ['controle', 'La feuille de contrôle'],
  ['liste', 'La liste des badges'],
]);

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
  // lignesLongues : des lignes de tour repliées sous un nom de tour, un
  // libellé de table ou un titre débordent ; le texte nomme alors la
  // personne et ce qui se raccourcit, et non le nombre de tours.
  [
    'PLANCHE_TROP_DE_TOURS',
    (details) =>
      details.lignesLongues
        ? `Les lignes de tour de ${laPersonne(details)}, repliées par un nom de tour, un libellé de table ou un titre long, ` +
          'ne tiennent pas sur son badge, même sur deux colonnes au plus petit corps : raccourcissez ce nom, ce libellé ' +
          "ou ce titre. La planche n'est pas produite, plutôt qu'une liste de tours tronquée."
        : `Les ${details.tours} tours ne tiennent pas sur un badge, même sur deux colonnes au plus petit corps : ` +
          "la planche n'est pas produite, plutôt qu'une liste de tours tronquée.",
  ],
  // organisation : c'est l'organisation, mise en gros à la place du nom,
  // qui ne tient pas ; le texte la nomme et dit qu'une case la remet en
  // petit.
  [
    'PLANCHE_NOM_TROP_LONG',
    (details) =>
      details.organisation === true
        ? `L'organisation de ${laPersonne(details)}, en gros au-dessus du nom, ne tient pas sur son badge, même repliée ` +
          "sur trois lignes au plus petit corps : raccourcissez-la, ou décochez la case qui met l'organisation en gros. " +
          'La planche ne se produit pas, plutôt que de tronquer ses tours.'
        : `Le nom de ${laPersonne(details)} ne tient pas sur son badge, même replié sur trois lignes au plus petit corps : ` +
          'la planche ne se produit pas, plutôt que de tronquer ses tours.',
  ],

  // --- Les refus de la production (§ 8.5, § 11.6, décision 13) -------------
  // fichier : celui qui ne s'est pas écrit ; deposee, le chemin des cartes
  // déjà déposées quand c'est la feuille de contrôle qui manque. La cause
  // DOSSIER_EVENEMENT_ABSENT nomme le dossier de l'événement disparu, sans
  // le fichier, qu'aucun dossier ne porte.
  [
    'PLANCHE_NON_ECRITE',
    (details, texte) => {
      const { fichier, deposee = null } = details;
      const lesCartes = deposee === null ? '' : ` Les cartes, elles, sont déposées : ${deposee}.`;
      const ailleurs = fichier === 'controle' ? 'dépose les deux fichiers ailleurs' : 'la dépose ailleurs';
      const pourquoi =
        details.cause === 'DOSSIER_EVENEMENT_ABSENT'
          ? `le dossier de l'événement ${cite(details.dossier)} est introuvable, et il ne se recrée pas`
          : ouEcrire(details, texte);
      return (
        `${nomDans(LES_FICHIERS, fichier, 'fichier')} n'a pas pu s'écrire : ${pourquoi}.` +
        `${lesCartes} « Enregistrer sous… » ${ailleurs}.`
      );
    },
  ],

  // --- Les lignes de tour d'un badge (§ 11.4, § 11.5) ------------------------
  // Une ligne : le tour, son nom (ligne.nomTour) ou « Tour 3 » sans lui, ou
  // « Toute la soirée » pour un itinéraire constant, puis la place de la
  // personne ; « absente » à un tour où elle est absente (ligne.absente
  // vrai), qu'une ligne « Toute la soirée » ne porte jamais.
  [
    'planche.tour',
    (ligne, texte) =>
      `${ligne.nomTour ?? nomDuTour(ligne.tour)} — ${ligne.absente ? texte('planche.absente') : place(ligne, texte)}`,
  ],
  ['planche.touteLaSoiree', (ligne, texte) => `Toute la soirée — ${place(ligne, texte)}`],
  ['planche.libelleTable', ({ libelleTable }) => ` (${libelleTable})`],
  ['planche.pasDeTable', 'pas de table'],
  ['planche.absente', 'absente'],
  ['planche.siege', ({ siege }) => `, siège ${siege}`],
  ['planche.titre', ({ titre }) => ` — ${titre}`],
  // La place seule, sous la tête de son tour, dans la liste des badges en
  // CSV d'une colonne par tour.
  ['planche.liste.place', (ligne, texte) => (ligne.absente ? texte('planche.absente') : place(ligne, texte))],

  // --- Les en-têtes de la liste des badges en CSV (§ 11.6) ----------------
  ['planche.liste.nom', 'Nom'],
  ['planche.liste.prenom', 'Prénom'],
  ['planche.liste.organisation', 'Organisation'],
  ['planche.liste.tours', 'Tours'],
  // La tête de la colonne d'un tour sans nom ; un tour nommé y pose son nom.
  ['planche.liste.tour', ({ tour }) => nomDuTour(tour)],

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
  // Le pied TechnoLibre, que le logo de l'éditeur suit, sous le pied du
  // badge, quand la case de la section le demande : la phrase d'origine,
  // que remplace le texte que la machine garde quand l'opérateur en choisit
  // un autre (§ 8.5).
  ['planche.technolibre', 'Demander un développement logiciel personnalisé avec https://technolibre.ca pour votre entreprise'],

  // --- La feuille de contrôle (§ 11.3, § 11.5, § 11.8) ----------------------
  // Le badge et son modèle : l'A6 à découper, ou les cartes prédécoupées
  // d'une feuille Avery 5392.
  [
    'planche.controle.badge',
    ({ largeur, hauteur, modeleBadge }) =>
      `Badge : ${cote(largeur)} × ${cote(hauteur)} mm (${nomDans(NOMS_DES_MODELES, modeleBadge, 'modèle de badge')}` +
      `${modeleBadge === 'avery5392' ? ', six cartes prédécoupées par feuille' : ''})`,
  ],
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
  // La feuille de contrôle à part d'un modèle à cartes prédécoupées.
  [
    'planche.controle.cartes',
    ({ modeleBadge }) =>
      `Imprimer cette feuille sur papier ordinaire : posée sur une feuille ${nomDans(NOMS_DES_MODELES, modeleBadge, 'modèle de badge')}, ` +
      'le contour des six cartes tombe sur leurs prédécoupes',
  ],
  // Les logos des participants : posés, sans place sur leur badge, et
  // introuvables ou illisibles dans le dossier de l'événement. La ligne ne
  // s'écrit que quand un badge désigne un logo.
  [
    'planche.controle.logos',
    ({ poses, sansPlace, introuvables }) =>
      `Logos : ${compte(poses, 'posé', 'posés')}, ${sansPlace} sans place, ${compte(introuvables, 'introuvable', 'introuvables')}`,
  ],
  // Les données que les cases de la section retirent des badges, dans
  // l'ordre des cases ; la ligne ne s'écrit que quand une case au moins est
  // décochée.
  [
    'planche.controle.retirees',
    ({ donnees }) => `Données retirées des badges : ${enumeration(donnees.map((donnee) => nomDans(NOMS_DES_DONNEES, donnee, 'donnée du badge')))}`,
  ],
  ['planche.controle.reedition', ({ n }) => `Réédition : ${compte(n, 'badge', 'badges')}`],
  [
    'planche.controle.absents',
    ({ points }) => `Caractères absents de la police, imprimés sans glyphe : ${enumeration(points)}`,
  ],
]);
