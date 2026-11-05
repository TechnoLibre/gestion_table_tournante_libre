// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de l'en-tête chiffré de la page de qualité (§ 12.2, B11, D29,
// D34, D48, D52), pur : VueEntete.svelte le câble.
//
// Une tuile par colonne de mesure du tableau des propositions, dans l'ordre
// de COLONNES et sous ses groupes (GROUPES_COLONNES) : la tuile lit sa
// mesure dans la ligne d'évaluation de la source par lireColonne, la
// cellule même que le tableau écrit, mise en forme par texteCellule. Une
// colonne que le tableau porte donne à sa tuile son libellé et son
// explication ; une colonne qu'il ne porte pas — critère décoché, valeur
// que le mode réglé ne compare pas — donne la sienne sous le libellé
// qualite.tuile.<nom>, qui dit qu'elle ne classe pas. Un critère sans objet
// n'a pas de tuile : sa mesure est absente de la ligne (null), seul cas où
// une colonne conditionnelle n'a pas de valeur.
//
// Les bornes des tuiles viennent du détail du placement (detail.bornes),
// chacune celle d'une personne nommée, que la tuile nomme : rien ne s'y
// recompte, rien ne s'y moyenne. Le plancher, lui, ne nomme personne : il
// borne la mesure de la tuile. Chaque tuile dont le détail porte le plancher
// (detail.bornes.planchers, là où le diagnostic du § 5.6 l'écrit) l'écrit
// en dernière ligne, sous son chiffre, et dit « atteint : impossible de
// faire moins » quand le détail le dit atteint ; sans plancher, aucune
// ligne, jamais un 0. Juste avant le plancher, la tuile d'un agrégat du
// § 5.4 écrit ses deux lignes secondaires, mobiles et ancrés
// (lireSecondaires, texteSecondaires), sur une ligne : le minimum de A(p),
// celui de d(p), les trois chiffres du manque, les minimums de s(p) et de
// m(p) ; le minimum brut a les siennes en tuiles. Les rencontres répétées
// et les retours choisis énoncent à part les imposés, lus dans la ligne
// d'évaluation et dans la table. Trois tuiles portent un pourcentage, un
// entier que le détail porte déjà, suivi du compte du pire : le minimum
// brut (la personne au rang 1 du profil), les tours hors objectif (la
// soirée), le minimum de s(p) (la personne à ce minimum). Aucune autre.
//
// Une tuile et une cellule des colonnes de la vue de comparaison
// (colonnes.js, § 12.10.6) s'écrivent par la même fonction, celluleDeTuile,
// qui lit ses bornes dans l'objet qu'elle reçoit — detail.bornes pour une
// tuile, les bornes d'un côté de la comparaison pour une colonne — : une
// seule écriture des chiffres sur toute la page. Une tuile dont cet objet
// ne porte pas le champ de borne — la comparaison ne porte ni la borne de
// diversité ni celle des animateurs — n'écrit ni ligne de borne, personne
// nommée ou phrase, ni pourcentage ; le plancher reste. Un champ présent et
// nul garde le sens qu'il a dans le détail.
// groupesDeTuiles dit quelles tuiles existent, sous quels groupes, et
// enTeteDeTuile leur libellé : l'en-tête et les colonnes en partagent la
// règle.
//
// La présence par tour (§ 12.6) : un plancher que le diagnostic retire
// sous absence (detail.planchersRetires) ne s'écrit pas, et la tuile de sa
// mesure le dit par une phrase, sous son chiffre ; les autres tuiles gardent
// leur plancher. L'infobulle d'une tuile est l'explication de sa colonne ;
// celle du minimum brut y ajoute la présence de la personne au rang 1
// quand elle ne vient pas à chaque tour, lue par presenceDe : cette
// personne est souvent celle qui rencontre le moins de monde parce qu'elle
// manque des tours.
import { presenceSaisie } from '../../application/places.js';
import {
  COLONNES,
  GROUPES_COLONNES,
  explicationDeColonne,
  lireColonne,
  lireSecondaires,
  tableau,
  texteCellule,
  texteSecondaires,
} from '../propositions/modele.js';

/** Les tuiles qui portent un pourcentage (B11, D34), dans l'ordre de
 *  COLONNES : aucune autre n'en porte. */
export const TUILES_A_POURCENTAGE = Object.freeze(['rencontresTous', 'toursHorsObjectif', 'toursSelonObjectif']);

// La clé de l'en-tête de chaque colonne, celle que le tableau écrit.
const EN_TETES = new Map(COLONNES.map(({ nom, cle }) => [nom, cle]));

/**
 * @typedef {Object} Tuile
 * @property {string} nom            le nom de sa colonne
 * @property {string} libelle        traduit : celui de la colonne, ou qualite.tuile.<nom>
 * @property {string} explication    la clé de l'explication de la colonne
 * @property {string} texte          la valeur, écrite comme au tableau
 * @property {boolean} classe        vrai quand le tableau porte la colonne
 * @property {string|null} neClassePas   la mention, null quand elle classe
 * @property {string[]} bornes       les lignes de la borne, traduites, puis
 *           celle des lignes secondaires d'un agrégat, et la ligne du
 *           plancher en dernier quand il est prouvé
 * @property {{texte: string|null, compte: string}|null} pourcentage
 *           le pourcentage écrit, null quand son dénominateur est nul, et
 *           le compte du pire ; null hors des trois tuiles
 * @property {string|null} plancherNonProuve  la phrase qui dit le plancher
 *           de la mesure retiré par la présence, null quand il ne l'est pas
 * @property {{cle: string, details: Object}} infobulle  le texte de
 *           l'infobulle du libellé, sous sa clé et ses détails
 */

// Le plancher du diagnostic que la présence retire, par la tuile de sa
// mesure (detail.planchersRetires) : la Map ne sert qu'à retrouver le nom
// d'une tuile.
const PLANCHER_RETIRE_DE_TUILE = new Map([['ecartItineraireMax', 'ecartItineraire']]);

// La phrase du plancher retiré de la tuile nom, ou null.
function plancherNonProuveDe(nom, retires, t) {
  const plancher = PLANCHER_RETIRE_DE_TUILE.get(nom);
  return plancher !== undefined && retires.includes(plancher) ? t('qualite.entete.plancherNonProuve') : null;
}

// L'infobulle du libellé de la tuile nom : l'explication de sa colonne ;
// pour le minimum brut, la présence de la personne au rang 1 s'y ajoute
// quand presenceDe la rend partielle, ses tours nommés sous nomsTours.
function infobulleDe(nom, explication, { rang1, nomDe, presenceDe, nomsTours }) {
  if (nom !== 'rencontresTous' || rang1 === null) return { cle: explication, details: {} };
  const tours = presenceDe(rang1.id);
  if (tours === null) return { cle: explication, details: {} };
  return { cle: 'qualite.entete.explicationRang1', details: { explication, nom: nomDe(rang1.id), tours, nomsTours } };
}

/**
 * La présence saisie de chaque personne d'une charge, par identifiant
 * (presenceSaisie) : null pour une présence à tous les tours, pour une
 * personne que la charge n'a pas, ou sans charge ; sinon une liste neuve.
 *
 * @param {{participants: Array<{id: number, presence?: number[]}>}|null} charge
 *        la charge de la séance
 * @returns {(id: number) => number[]|null}
 */
export function presenceDeCharge(charge) {
  return (id) => {
    const personne = charge?.participants.find((candidate) => candidate.id === id);
    return personne === undefined ? null : presenceSaisie(personne);
  };
}

// La borne que lit chaque tuile qui nomme une personne ou la soirée : le
// champ de detail.bornes, ou des bornes d'un côté de la comparaison. La Map
// ne sert qu'à retrouver le champ d'une tuile.
const BORNE_DE_TUILE = new Map([
  ['rencontresTous', 'rang1'],
  ['manqueMax', 'manque'],
  ['organisationsVues', 'diversite'],
  ['toursHorsObjectif', 'soiree'],
  ['toursSelonObjectif', 'objectifs'],
  ['animateursRencontres', 'animateurs'],
]);

// Les lignes de borne et le pourcentage d'une tuile, lus dans bornes.
// nommer(id) rend la ligne qui nomme la personne id ; ligne et table, la
// ligne d'évaluation et la table, qui portent les imposés. Le manque
// maximal écrit l'effectif au manque maximal de bornes.manque, le nombre
// de personnes dont le manque l'égale, que la synthèse du tracé de la
// comparaison écrit aussi, sauf quand ce manque vaut 0 : personne n'y manque
// de rien, et la ligne se tait ; l'effectif du manque, les personnes à qui il
// en manque au moins 1, est la valeur de sa propre tuile. Une tuile dont
// bornes ne porte pas le champ n'a ni ligne de borne ni pourcentage.
function bornesDe(nom, { bornes, ligne, table, t, nommer }) {
  const champ = BORNE_DE_TUILE.get(nom);
  if (champ !== undefined && !Object.hasOwn(bornes, champ)) return { bornes: [], pourcentage: null };
  const pourcent = (valeur) => (valeur === null ? null : t('qualite.pourcentage.valeur', { pourcent: valeur }));
  const rendu = (lignes, pourcentage = null) => ({ bornes: lignes, pourcentage });
  switch (nom) {
    case 'rencontresTous': {
      const { rang1 } = bornes;
      if (rang1 === null) return rendu([]);
      const lignes = [nommer(rang1.id), t('qualite.tuile.plafondRealise', { plafond: rang1.plafondRealise })];
      if (rang1.plafondAPriori !== null) lignes.push(t('qualite.tuile.plafondAPriori', { plafond: rang1.plafondAPriori }));
      return rendu(lignes, {
        texte: pourcent(rang1.pourcent),
        compte: t('qualite.tuile.pireRencontres', { rencontres: rang1.rencontres, plafond: rang1.plafondRealise }),
      });
    }
    case 'manqueMax': {
      const { manque } = bornes;
      if (manque === null) return rendu([]);
      const nul = lireColonne(ligne, 'manqueMax').valeur === 0;
      return rendu([
        nommer(manque.id),
        ...(nul ? [] : [t('qualite.tuile.effectifAuManqueMax', { effectif: manque.effectif })]),
        t('qualite.tuile.plafondRealise', { plafond: manque.plafondRealise }),
      ]);
    }
    case 'organisationsVues': {
      const { diversite } = bornes;
      if (diversite === null) return rendu([t('qualite.tuile.sansOrganisation')]);
      return rendu([nommer(diversite.id), t('qualite.tuile.borneDiversite', { borne: diversite.aMax })]);
    }
    case 'toursHorsObjectif': {
      const { soiree } = bornes;
      if (soiree === null) return rendu([]);
      return rendu([], {
        texte: soiree.pourcent === null ? null : t('qualite.pourcentage.servis', { pourcent: soiree.pourcent }),
        compte: t('qualite.tuile.pireJamaisServies', { personnes: soiree.jamaisServies }),
      });
    }
    case 'toursSelonObjectif': {
      const { objectifs } = bornes;
      if (objectifs === null) return rendu([]);
      return rendu([nommer(objectifs.id), t('qualite.tuile.toursPossibles', { possibles: objectifs.possibles })], {
        texte: pourcent(objectifs.pourcent),
        compte: t('qualite.tuile.pireServis', { servis: objectifs.servis, possibles: objectifs.possibles }),
      });
    }
    case 'rencontresRepetees':
      return rendu([t('qualite.tuile.imposees', { imposees: ligne.mesures.rencontresRepetees.imposees })]);
    case 'retoursChoisis':
      return rendu([t('qualite.tuile.imposes', { imposes: table.imposes.retours })]);
    case 'animateursRencontres': {
      const { animateurs } = bornes;
      if (animateurs === null) return rendu([]);
      return rendu([nommer(animateurs.id), t('qualite.tuile.borneAnimateurs', { borne: animateurs.borne })]);
    }
    default:
      return rendu([]);
  }
}

// La ligne du plancher de la tuile nom, lue dans bornes.planchers :
// {plancher, atteint} ou null, que le moteur ne rend que prouvé et non nul.
// Une liste d'une ligne, ou vide.
function plancherDe(nom, { bornes, t }) {
  const { planchers } = bornes;
  const lu = Object.hasOwn(planchers, nom) ? planchers[nom] : null;
  if (lu === null) return [];
  const { plancher, atteint } = lu;
  return [t(atteint ? 'qualite.tuile.plancherAtteint' : 'qualite.tuile.plancher', { plancher })];
}

/**
 * La cellule d'une tuile : la valeur de sa colonne écrite comme au tableau,
 * les lignes de sa borne, ses lignes secondaires, son plancher en dernier,
 * et son pourcentage. La tuile de l'en-tête chiffré et la cellule d'une
 * colonne de la comparaison s'écrivent par elle.
 *
 * @param {string} nom  le nom d'une colonne de mesure de COLONNES
 * @param {{bornes: Object, ligne: Object, table: Object, t: Function,
 *   format: {nombre: Function}, nomDe: (id: number) => string}} contexte
 *   bornes : detail.bornes, ou les bornes d'un côté de la comparaison, de
 *   même forme, personnes sous id ; ligne : la ligne d'évaluation
 *   comparable du placement ; table : la table d'évaluation ; nomDe(id) :
 *   le nom affiché de la personne id
 * @returns {{texte: string, bornes: string[], pourcentage: {texte: string|null, compte: string}|null}}
 */
export function celluleDeTuile(nom, { bornes, ligne, table, t, format, nomDe }) {
  const contexte = {
    bornes,
    ligne,
    table,
    t,
    nommer: (id) => t('qualite.tuile.personne', { nom: nomDe(id) }),
  };
  const { bornes: lignes, pourcentage } = bornesDe(nom, contexte);
  const secondaires = lireSecondaires(ligne, nom);
  return {
    texte: texteCellule(lireColonne(ligne, nom), { t, format }),
    bornes: [...lignes, ...(secondaires === null ? [] : [texteSecondaires(secondaires, { t, format })]), ...plancherDe(nom, contexte)],
    pourcentage,
  };
}

/**
 * Les tuiles que portent des lignes d'évaluation d'une même table, sous
 * les groupes de GROUPES_COLONNES, dans leur ordre : une colonne de mesure
 * d'un groupe a sa tuile quand le tableau la porte, ou, sinon, quand l'une
 * des lignes en a une valeur — un critère sans objet n'a pas de tuile. Un
 * groupe sans tuile n'est pas rendu.
 *
 * @param {Object} table   la table d'évaluation
 * @param {Object[]} lignes  des lignes comparables de cette table
 * @param {Function} t
 * @returns {Array<{cle: string, libelle: string, tuiles: Array<{nom: string, classe: boolean}>}>}
 *   classe : vrai quand le tableau porte la colonne
 */
export function groupesDeTuiles(table, lignes, t) {
  const portees = new Set(tableau(table).colonnes.map(({ nom }) => nom));
  const groupes = [];
  for (const { cle, colonnes } of GROUPES_COLONNES) {
    if (cle === null) continue;
    const deGroupe = [];
    for (const nom of colonnes) {
      const classe = portees.has(nom);
      if (classe || lignes.some((ligne) => lireColonne(ligne, nom).valeur !== null)) deGroupe.push({ nom, classe });
    }
    if (deGroupe.length > 0) groupes.push({ cle, libelle: t(cle), tuiles: deGroupe });
  }
  return groupes;
}

/**
 * Le libellé d'une tuile, celui de sa colonne quand le tableau la porte,
 * qualite.tuile.<nom> sinon ; la clé de son explication ; et la mention
 * « ne classe pas », null quand elle classe.
 *
 * @param {string} nom
 * @param {boolean} classe  vrai quand le tableau porte la colonne
 * @param {Function} t
 * @returns {{libelle: string, explication: string, neClassePas: string|null}}
 */
export function enTeteDeTuile(nom, classe, t) {
  return {
    libelle: t(classe ? EN_TETES.get(nom) : `qualite.tuile.${nom}`),
    explication: explicationDeColonne(nom),
    neClassePas: classe ? null : t('qualite.tuile.neClassePas'),
  };
}

/**
 * L'en-tête chiffré d'une source mesurée, sous le contrat de propriétés des
 * vues : null sans détail comparable, sans ligne ou sans table.
 *
 * @param {{detail: Object|null, ligne: Object|null, table: Object|null}} vue
 *        le détail du placement (detaillerQualite), sa ligne d'évaluation
 *        et la table d'évaluation de la charge
 * @param {{t: Function, format: {nombre: Function},
 *          presenceDe?: (id: number) => number[]|null, nomsTours?: Array<string|null>}} outils
 *        presenceDe : la présence saisie d'une personne (presenceDeCharge),
 *        null pour tous les tours ; par défaut, chacune vient à chaque tour ;
 *        nomsTours : les noms des tours de l'événement (nomsDesTours)
 * @returns {null|{population: string, groupes: Array<{cle: string,
 *   libelle: string, tuiles: Tuile[]}>, certificat: string}}
 *   population : la mention de la population mesurée ; groupes : ceux de
 *   GROUPES_COLONNES qui portent une tuile au moins, dans leur ordre ;
 *   certificat : « minimum atteint » ou « atteignabilité inconnue », qui
 *   suit les tuiles
 */
export function enteteDe({ detail, ligne, table }, { t, format, presenceDe = () => null, nomsTours = undefined }) {
  if (detail === null || detail.statut !== 'comparable' || ligne === null || table === null) return null;
  const noms = new Map(detail.personnes.map(({ id, nom }) => [id, nom]));
  const nomDe = (id) => noms.get(id);
  const contexte = { bornes: detail.bornes, ligne, table, t, format, nomDe };
  const retires = detail.planchersRetires ?? [];
  const lecture = { rang1: detail.bornes.rang1, nomDe, presenceDe, nomsTours };
  const groupes = groupesDeTuiles(table, [ligne], t).map(({ cle, libelle, tuiles }) => ({
    cle,
    libelle,
    tuiles: tuiles.map(({ nom, classe }) => {
      const { libelle: libelleDeTuile, explication, neClassePas } = enTeteDeTuile(nom, classe, t);
      const { texte, bornes, pourcentage } = celluleDeTuile(nom, contexte);
      return {
        nom,
        libelle: libelleDeTuile,
        explication,
        texte,
        classe,
        neClassePas,
        bornes,
        pourcentage,
        plancherNonProuve: plancherNonProuveDe(nom, retires, t),
        infobulle: infobulleDe(nom, explication, lecture),
      };
    }),
  }));
  return {
    population: t('qualite.tuile.population', detail.population),
    groupes,
    certificat: texteCellule(lireColonne(ligne, 'certificat'), { t, format }),
  };
}
