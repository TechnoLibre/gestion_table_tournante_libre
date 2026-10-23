// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La planche de badges dans la séance (§ 11.2, § 11.6, § 11.8) : préparer
// l'annonce, produire le PDF et le déposer, l'enregistrer ailleurs ; produire
// de même la liste des badges en CSV. Sortir n'est pas modifier (§ 8.4,
// § 9) : rien ici n'écrit le fichier d'état ni le journal, ne prend de
// verrou ni ne lit le mode de la séance ; la seule écriture est celle du
// PDF — des deux PDF pour Avery 5392, les feuilles de cartes puis la
// feuille de contrôle à part — ou du CSV, dans le dossier de l'événement,
// ou leur téléchargement sous web, où le dossier de travail est invisible à
// l'opérateur (décision 13). Une écriture refusée se dit PLANCHE_NON_ECRITE,
// qui nomme le fichier en cause et le dossier, remède « Enregistrer
// sous… », sans toucher au support de l'événement. Un dossier d'événement
// disparu pendant la séance ne se recrée pas (§ 8.6) : l'écriture, que le
// support refuse sous un dossier absent, se dit PLANCHE_NON_ECRITE de cause
// DOSSIER_EVENEMENT_ABSENT, que le dossier relu à ce moment établit.
//
// La production vit dans src/pdf, chargé par un seul import() différé : le
// paquet n'embarque pdf-lib qu'au premier besoin, et cette couche ne voit
// jamais un objet de pdf-lib, seulement des octets. La police arrive en
// octets, par la fonction que la séance reçoit, chargée une fois ; le logo
// vectoriel du pied TechnoLibre de même, chargé au premier badge qui le
// demande.
//
// Le pied TechnoLibre suit la case de la machine, que la lecture porte : il
// se pose sous le pied des badges, jamais sur la feuille de contrôle, et
// l'annonce compte les badges d'où la mise en page le retire faute de
// place. Son texte vient de libelle, comme le mot du filigrane.
//
// Les cases de ce que le badge imprime suivent aussi la machine, que la
// lecture porte : une case décochée retire sa donnée — l'organisation, le
// nom de l'événement, sa date, l'horodatage du placement, l'identifiant d'un
// homonyme — de chaque badge du PDF, avant la mise en page, qui rend la
// place libérée au reste comme pour une ligne absente. Le pied se recompose
// par libelle, le nom et la date de l'événement en une ligne ou l'un sans
// l'autre ; toutes cochées, le modèle passe tel quel, et les octets ne
// changent pas. La feuille de contrôle nomme les données retirées, d'une
// ligne ; l'annonce nomme toujours les homonymes, et la liste en CSV ne lit
// aucune case.
//
// Le logo d'un participant arrive en octets, lus du dossier de l'événement
// par lireOctets au chemin que porte son badge : chaque chemin distinct se
// lit une fois par étude, dans l'ordre de la pile, et ses octets se
// contrôlent (lirePng). Une lecture réussie se garde pour l'événement de la
// lecture — un chemin nomme son contenu, qui ne change pas —, si bien que
// Produire, qui étudie de nouveau, ne relit rien ; un échec ne se garde
// jamais, et un fichier remis se lit à l'étude suivante. Un logo
// introuvable ou illisible ne refuse rien : l'annonce nomme ses personnes,
// leur badge s'imprime sans lui, et la feuille de contrôle compte, d'une
// ligne de texte, les logos posés, sans place et introuvables, quand un
// badge en désigne un. La liste en CSV ne lit aucun logo.
//
// Une demande désigne la source — le retenu, ou une proposition par son
// identifiant, toujours BROUILLON (Q3) —, l'imposition, l'ordre de la pile
// et, pour une réédition, la sélection. Les refus s'ordonnent : ceux du
// placement (refusPlanche), puis ceux de la mise en page, nommant la
// personne du badge refusé.
//
// Le modèle de badge vient de la lecture, comme le papier, et aucune
// planche ne demande le papier (papierDesBadges). Un modèle qui impose son
// papier — Avery 5392 sur Lettre — le prend, quel que soit celui de la
// machine ; ses cartes suivent la pile, feuille par feuille, quelle que
// soit l'imposition demandée. L'A6 prend le papier de la machine, Lettre
// tant qu'aucun n'est choisi, sans l'écrire.
//
// La liste en CSV se tire du même modèle que la planche (listeBadges) :
// elle subit les refus du placement, jamais ceux de la mise en page, et ne
// charge ni la police ni pdf-lib.
//
// Le nom du fichier (nomPlanche) porte tout ce qui change la pile : la
// source, l'imposition, l'ordre, le placement. Une réédition, une base qui
// finit par un point, ou une planche dont la borne du chemin raccourcit la
// base (nomPlancheExigeListe), ne remplace jamais un fichier du dossier :
// son nom prend le premier rang libre parmi les entrées que le dossier de
// l'événement porte, listées à chaque préparation et à chaque production ;
// la borne du chemin se compte contre ce dossier, racine + séparateur +
// dossier, si bien qu'un nom d'événement long raccourcit plus tôt la base
// d'une planche marquée. Un dossier qui ne se liste pas laisse à l'annonce
// le nom sans dossier, et refuse la production PLANCHE_NON_ECRITE avant
// d'écrire, plutôt que de risquer de remplacer une planche précédente.
import { MODELES_BADGE, PAPIERS, estModeleBadge } from '../geometrie/papiers.js';
import { nombrePlanches } from '../pdf/imposition.js';
import { ErreurPng, lirePng } from '../pdf/png.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { DONNEES_BADGE } from '../stockage/reglages_locaux.js';
import { nomControle, nomCsvBadges, nomCsvBadgesExigeListe, nomPlanche, nomPlancheExigeListe } from '../stockage/noms.js';
import { cheminAffiche } from '../stockage/systeme_fichiers.js';
import { ErreurCommande, refus } from './erreurs.js';
import { libelle } from './libelles.js';
import {
  IMPOSITIONS,
  ORDRES,
  listeBadges,
  modelePlanche,
  papierDesBadges,
  refusPlanche,
  refusProduction,
  textesControle,
} from './planche.js';
import { estBrouillon } from './sorties.js';

// La production du PDF, chargée au premier appel ; le module se garde en
// cache, comme tout module chargé.
const chargerProduction = () => import('../pdf/planche.js');

/**
 * Ce que la séance lit de l'événement ouvert, à son tour dans la file de ses
 * appels.
 *
 * @typedef {Object} LecturePlanche
 * @property {import('../stockage/types.js').Charge} charge
 * @property {string} base       la base des fichiers de l'événement
 * @property {import('../stockage/systeme_fichiers.js').SystemeFichiers} fs
 *           la vue du dossier de l'événement (vueDossier) : '' y désigne
 *           le dossier
 * @property {import('../stockage/systeme_fichiers.js').Racine} racine
 *           la racine du dossier de travail, qui porte le dossier de
 *           l'événement
 * @property {string} dossier    le dossier de l'événement, relatif à la racine
 * @property {'A4'|'Lettre'|null} papier   celui des réglages locaux, null sans choix
 * @property {import('../geometrie/papiers.js').ModeleBadge} [modeleBadge]   celui des
 *           réglages locaux ; 'a6' quand la lecture ne le porte pas
 * @property {boolean} [piedTechnolibre]   la case du pied TechnoLibre des
 *           réglages locaux ; faux quand la lecture ne la porte pas
 * @property {Object<string, boolean>} [donneesBadge]   les cases de ce que le
 *           badge imprime, un booléen par donnée de DONNEES_BADGE ; toutes
 *           cochées quand la lecture ne les porte pas
 *
 * @typedef {Object} DemandePlanche
 * @property {'retenu'|'proposition'} [source]   'retenu' par défaut
 * @property {number|null} [proposition]          l'identifiant de la proposition imprimée
 * @property {'feuille'|'pile'} [imposition]      'feuille' par défaut
 * @property {'alphabetique'|'table'} [ordre]     'alphabetique' par défaut
 * @property {number[]|null} [selection]          les personnes à rééditer ; null : toutes
 *
 * @typedef {Object} Annonce
 * @property {null|{code: string, details: Object}} refus   le premier refus, remède dans les détails
 * @property {import('../geometrie/papiers.js').ModeleBadge} modeleBadge
 * @property {'A4'|'Lettre'} papier   celui de la planche : le papier qu'impose
 *           le modèle, sinon celui de la lecture, Lettre sans choix
 * @property {null|{participants: number, exclus: number, produits: number}} comptes
 * @property {null|Object<string, number>} planches   par papier, le nombre de
 *           planches : les papiers de PAPIERS pour l'A6, le seul papier
 *           imposé pour un modèle qui en impose un
 * @property {Array<{nom: string, ids: number[]}>} homonymes
 * @property {string[]} absents   les caractères sans glyphe, à leur première rencontre
 * @property {boolean} brouillon
 * @property {string|null} nom    le nom du fichier ; null sans modèle
 * @property {string|null} nomControle   le nom de la feuille de contrôle à
 *           part (nomControle) ; null pour l'A6, et sans modèle
 * @property {boolean} piedTechnolibre   la case de la lecture
 * @property {Object<string, boolean>} donneesBadge   les cases de la lecture,
 *           une par donnée de DONNEES_BADGE, dans leur ordre
 * @property {number|null} sansTechnolibre   le nombre de badges d'où le pied
 *           TechnoLibre se retire, faute de place ; null sans la case, et
 *           sans modèle
 * @property {null|{poses: number, sansPlace: number,
 *           introuvables: Array<{participant: number, nom: string, cause: 'ABSENT'|'ILLISIBLE'}>}} logos
 *           les logos des participants : les badges où il se pose, ceux où il
 *           ne trouve pas de place, et, dans l'ordre de la pile, ceux dont le
 *           fichier manque au dossier de l'événement (ABSENT) ou ne se lit pas
 *           comme un PNG (ILLISIBLE) ; null quand aucun badge ne désigne de
 *           logo, et sans modèle
 */

// La demande lue, ses défauts posés ; une imposition ou un ordre hors de sa
// liste est une faute du code, levée avant tout refus du placement. La
// source et la sélection se contrôlent où elles se lisent (planche.js).
function demandeLue({ source = 'retenu', proposition = null, imposition = 'feuille', ordre = 'alphabetique', selection = null } = {}) {
  if (!IMPOSITIONS.includes(imposition)) {
    throw new TypeError(`imposition : ${IMPOSITIONS.join(' ou ')} attendue, reçu ${JSON.stringify(imposition)}`);
  }
  if (!ORDRES.includes(ordre)) throw new TypeError(`ordre : ${ORDRES.join(' ou ')} attendu, reçu ${JSON.stringify(ordre)}`);
  return { source, proposition, imposition, ordre, selection };
}

// Le nombre de planches de n badges, pour chaque papier : l'annonce de l'A6
// les donne tous deux, celui de la planche marqué (§ 11.2) ; pour le seul
// papier qu'impose un modèle qui en impose un.
function planchesDe(n, modeleBadge) {
  const impose = MODELES_BADGE[modeleBadge].papier;
  const papiers = impose === null ? Object.keys(PAPIERS) : [impose];
  return Object.fromEntries(papiers.map((papier) => [papier, nombrePlanches(n, papier, modeleBadge)]));
}

// Le modèle de badge d'une lecture, contrôlé, 'a6' quand elle ne le porte
// pas ; une valeur hors de MODELES_BADGE est une faute du code.
function modeleDe({ modeleBadge = 'a6' }) {
  if (!estModeleBadge(modeleBadge)) throw new TypeError(`modeleBadge : modèle de badge inconnu ${JSON.stringify(modeleBadge)}`);
  return modeleBadge;
}

// La case du pied TechnoLibre d'une lecture, contrôlée, fausse quand elle
// ne la porte pas ; une valeur qui n'est pas un booléen est une faute du
// code.
function piedDe({ piedTechnolibre = false }) {
  if (typeof piedTechnolibre !== 'boolean') throw new TypeError(`piedTechnolibre : booléen attendu, reçu ${JSON.stringify(piedTechnolibre)}`);
  return piedTechnolibre;
}

// Les cases de ce que le badge imprime d'une lecture, contrôlées : un
// booléen par donnée de DONNEES_BADGE, dans leur ordre, toutes vraies quand
// la lecture ne les porte pas ; un objet qui n'en porte pas exactement un
// booléen par donnée est une faute du code.
function donneesDe({ donneesBadge = null }) {
  if (donneesBadge === null) return Object.fromEntries(DONNEES_BADGE.map((donnee) => [donnee, true]));
  const bien = typeof donneesBadge === 'object' && DONNEES_BADGE.every((donnee) => typeof donneesBadge[donnee] === 'boolean');
  if (!bien) throw new TypeError(`donneesBadge : un booléen par donnée de ${DONNEES_BADGE.join(', ')} attendu, reçu ${JSON.stringify(donneesBadge)}`);
  return Object.fromEntries(DONNEES_BADGE.map((donnee) => [donnee, donneesBadge[donnee]]));
}

// Les données que les cases retirent, dans l'ordre de DONNEES_BADGE.
const retireesDe = (donnees) => DONNEES_BADGE.filter((donnee) => !donnees[donnee]);

// Le modèle tel que le badge l'imprime sous les cases : toutes cochées, le
// modèle reçu ; sinon un modèle neuf dont chaque badge perd, de ses textes,
// l'organisation décochée, et dont le pied se recompose sans les données
// décochées. Le pied porte le nom de l'événement suivi de sa date, l'un ou
// l'autre seul, ou aucun ; puis l'horodatage, puis l'identifiant d'un
// homonyme. Le pied réduit, celui d'un badge qui perd le nom de l'événement
// faute de place, garde la date quand sa case la garde. Les données du
// badge, et tout le reste du modèle, ne changent pas.
function modeleImprime(modele, donnees) {
  if (retireesDe(donnees).length === 0) return modele;
  const { evenement, horodatage } = modele;
  const date = donnees.date ? evenement.date : null;
  const lignesDate = date === null ? [] : [libelle('planche.pied.date', { date })];
  const lignesEvenement = donnees.evenement ? [libelle('planche.pied.evenement', { nom: evenement.nom, date })] : lignesDate;
  const ligneHorodatage = horodatage === null ? libelle('planche.pied.horodatageInconnu') : libelle('planche.pied.horodatage', { horodatage });
  const lignesHorodatage = donnees.horodatage ? [ligneHorodatage] : [];
  const badges = modele.badges.map((badge) => {
    const { identifiant, textes } = badge;
    const lignesIdentifiant = donnees.identifiant && identifiant !== null ? [libelle('planche.pied.identifiant', { identifiant })] : [];
    const fin = [...lignesHorodatage, ...lignesIdentifiant];
    const organisation = donnees.organisation ? textes.organisation : null;
    return { ...badge, textes: { ...textes, organisation, pied: [...lignesEvenement, ...fin], piedReduit: [...lignesDate, ...fin] } };
  });
  return { ...modele, badges };
}

// Les lignes de la feuille de contrôle, celle des données retirées posée
// quand une case au moins est décochée : après la consigne d'impression,
// celle de la feuille à part d'un modèle à cartes et celle des logos,
// avant le reste, dans l'ordre de textesControle.
function controleAvecRetirees(lignes, retirees, { cartes, logos }) {
  if (retirees.length === 0) return lignes;
  const rang = lignes.indexOf(libelle('planche.controle.consigne')) + 1 + (cartes ? 1 : 0) + (logos === null ? 0 : 1);
  return [...lignes.slice(0, rang), libelle('planche.controle.retirees', { donnees: retirees }), ...lignes.slice(rang)];
}

// Vrai pour un modèle à cartes prédécoupées, dont la feuille de contrôle
// est un document à part.
const aCartes = (modeleBadge) => MODELES_BADGE[modeleBadge].grille !== null;

/**
 * Les opérations de la planche d'une séance.
 *
 * @param {Object} parametres
 * @param {(() => Promise<{regulier: Uint8Array, gras: Uint8Array}>)|null} parametres.polices
 *        charge les octets de la police embarquée ; appelée au premier
 *        besoin, puis gardée — un chargement refusé se réessaie au suivant
 * @param {(() => Promise<Uint8Array>)|null} [parametres.logo]   charge les
 *        octets SVG du logo du pied TechnoLibre, comme polices ; null : une
 *        planche qui le demande lève TypeError
 * @param {string|null} parametres.provenance   le mode de construction
 * @param {string} parametres.version           la version affichée
 * @returns {{preparer: (lecture: LecturePlanche, demande?: DemandePlanche) => Promise<Annonce>,
 *   produire: (lecture: LecturePlanche, demande?: DemandePlanche) =>
 *     Promise<{chemin: string|null, nom: string, controle: null|{chemin: string|null, nom: string}}>,
 *   enregistrerSous: (lecture: LecturePlanche, demande?: DemandePlanche) =>
 *     Promise<null|{chemin: string, controle: string|null}>,
 *   produireListe: (lecture: LecturePlanche, demande?: DemandePlanche) => Promise<{chemin: string|null, nom: string}>,
 *   enregistrerListeSous: (lecture: LecturePlanche, demande?: DemandePlanche) => Promise<string|null>}}
 */
export function creerPlanches({ polices, logo = null, provenance, version }) {
  // Un chargement gardé : la promesse de son premier appel, que les appels
  // suivants reprennent ; une promesse rejetée ne se garde pas, et l'appel
  // suivant réessaie.
  function garde(charger) {
    let promesse = null;
    return () => {
      if (promesse === null) {
        promesse = Promise.resolve().then(charger);
        promesse.catch(() => {
          promesse = null;
        });
      }
      return promesse;
    };
  }
  const policesGardees = garde(() => polices());
  const logoGarde = garde(() => logo());

  // Les octets de la police, chargés une fois.
  function lesPolices() {
    if (typeof polices !== 'function') throw new TypeError('polices : la fonction qui charge la police embarquée attendue');
    return policesGardees();
  }

  // Les logos lus avec succès, par chemin, pour l'événement que désignent
  // la racine et le dossier de la dernière étude : une étude d'un autre
  // événement repart d'une garde vide.
  let logosGardes = { cle: null, octets: new Map() };

  // Les logos des badges d'un modèle : octets, par chemin, ceux qui se lisent
  // et se contrôlent comme un PNG, dans l'ordre de la pile ; echecs, par
  // chemin, la cause de ceux qui ne se lisent pas — ABSENT, le fichier
  // manque ; ILLISIBLE, il ne se lit pas, ou n'est pas un PNG. Un chemin
  // gardé ne se relit pas ; la garde ne retient ensuite que les chemins
  // lus de ce modèle. Une erreur d'une autre nature remonte.
  async function logosDe({ fs, racine, dossier }, modele) {
    const cle = JSON.stringify([racine?.id ?? null, racine?.chemin ?? null, dossier ?? null]);
    const gardes = logosGardes.cle === cle ? logosGardes.octets : new Map();
    const octets = new Map();
    const echecs = new Map();
    for (const { logo } of modele.badges) {
      if (logo === null || octets.has(logo) || echecs.has(logo)) continue;
      if (gardes.has(logo)) {
        octets.set(logo, gardes.get(logo));
        continue;
      }
      try {
        const lus = await fs.lireOctets(racine, logo);
        lirePng(lus);
        octets.set(logo, lus);
      } catch (erreur) {
        if (erreur instanceof ErreurStockage) echecs.set(logo, erreur.code === 'ABSENT' ? 'ABSENT' : 'ILLISIBLE');
        else if (erreur instanceof ErreurPng) echecs.set(logo, 'ILLISIBLE');
        else throw erreur;
      }
    }
    logosGardes = { cle, octets };
    return { octets, echecs };
  }

  // Le pied TechnoLibre d'une planche qui le demande : son texte et les
  // octets du logo, chargés une fois ; null sans la case.
  async function technolibreDe(pied) {
    if (!pied) return null;
    if (typeof logo !== 'function') throw new TypeError('logo : la fonction qui charge le logo du pied TechnoLibre attendue');
    return { texte: libelle('planche.technolibre'), logo: await logoGarde() };
  }

  // L'étude d'une demande : le refus du placement, ou le modèle, ses logos
  // lus, son analyse par la mise en page et le refus qu'elle porte. Un refus
  // de mise en page reçoit la personne du badge refusé, que src/pdf ne
  // connaît pas. logos : null quand aucun badge ne désigne de logo, sinon
  // les comptes de l'annonce. Rien ne s'écrit.
  async function etudier(lecture, demande) {
    const { charge } = lecture;
    const lue = demandeLue(demande);
    const { source, proposition, ordre, selection } = lue;
    const modeleBadge = modeleDe(lecture);
    const pied = piedDe(lecture);
    const donnees = donneesDe(lecture);
    const papier = papierDesBadges(modeleBadge, lecture.papier);
    const imposition = aCartes(modeleBadge) ? 'feuille' : lue.imposition;
    const rejet = refusPlanche(charge, { source, proposition });
    if (rejet !== null) return { refus: rejet, modele: null, absents: [], papier, imposition, ordre, source, modeleBadge, pied, donnees };
    if (typeof provenance !== 'string') throw new TypeError('provenance : le mode de construction attendu');
    const modele = modeleImprime(modelePlanche(charge, { source, proposition, ordre, selection, provenance, version }), donnees);
    const octets = await lesPolices();
    const technolibre = await technolibreDe(pied);
    const { octets: logosParticipants, echecs } = await logosDe(lecture, modele);
    const { analyserPlanche } = await chargerProduction();
    const analyse = await analyserPlanche({ modele, polices: octets, modeleBadge, technolibre, logosParticipants });
    let leRefus = null;
    if (analyse.refus !== null) {
      const { code, details, rang } = analyse.refus;
      const badge = modele.badges[rang];
      const personne = code === 'PLANCHE_NOM_TROP_LONG' ? { participant: badge.participant, personne: badge.nom } : {};
      leRefus = refusProduction(code, { ...details, ...personne });
    }
    const introuvables = modele.badges
      .filter(({ logo }) => echecs.has(logo))
      .map(({ participant, nom, logo }) => ({ participant, nom, cause: echecs.get(logo) }));
    const logos = modele.badges.some(({ logo }) => logo !== null) ? { ...analyse.logosParticipants, introuvables } : null;
    return {
      refus: leRefus,
      modele,
      absents: analyse.absents,
      papier,
      imposition,
      ordre,
      source,
      modeleBadge,
      pied,
      donnees,
      technolibre,
      sansTechnolibre: pied ? analyse.sansTechnolibre : null,
      logosParticipants,
      logos,
    };
  }

  // Les options de nomPlanche pour une étude, sous le dossier donné.
  const optionsDe = ({ modele, papier, imposition, ordre, modeleBadge }, dossier) => ({
    papier,
    imposition,
    ordre,
    horodatage: modele.horodatage,
    reedition: modele.reedition,
    proposition: modele.proposition,
    modeleBadge,
    dossier,
  });

  // Le nom du fichier d'une étude, sous le dossier donné (nomPlanche).
  const nomDe = (base, etude, dossier) => nomPlanche(base, optionsDe(etude, dossier));

  // Le nom de la feuille de contrôle à part d'une étude, sous le dossier
  // donné (nomControle) ; null pour l'A6.
  const nomControleDe = (base, etude, dossier) => (aCartes(etude.modeleBadge) ? nomControle(base, optionsDe(etude, dossier)) : null);

  // Le chemin du dossier de l'événement tel que l'opérateur le lit, racine,
  // séparateur, dossier, et ce séparateur.
  async function lieuDe({ fs, racine, dossier }) {
    const { separateur } = await fs.emplacements();
    return { chemin: cheminAffiche(racine, separateur, dossier), separateur };
  }

  // Le dossier où un fichier se dépose, tel que nomPlanche ou nomCsvBadges
  // le lit : le chemin du dossier de l'événement, son séparateur et, quand
  // exigeListe le dit sous ce dossier, les noms qu'il porte ; null sous web,
  // où le fichier se télécharge. Un dossier qui ne se liste pas lève
  // l'ErreurStockage de la liste.
  async function dossierSelon(lecture, exigeListe) {
    if (lecture.fs.nature === 'web') return null;
    const { chemin, separateur } = await lieuDe(lecture);
    const sansListe = { racine: chemin, separateur, existants: [] };
    if (!exigeListe(sansListe)) return sansListe;
    const existants = (await lecture.fs.lister(lecture.racine, '')).map(({ nom }) => nom);
    return { ...sansListe, existants };
  }

  // Vrai quand le dossier de l'événement ne se trouve plus : sa liste lève
  // ABSENT. Toute autre issue de la liste le dit présent.
  async function dossierAbsent({ fs, racine }) {
    try {
      await fs.lister(racine, '');
      return false;
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      return erreur.code === 'ABSENT';
    }
  }

  // Le refus d'un fichier dont le dossier ne se liste pas, avant d'écrire :
  // nom, le nom sans dossier ; la cause, DOSSIER_EVENEMENT_ABSENT pour un
  // dossier qui ne se trouve plus.
  async function nonListe(lecture, erreur, nom, fichier) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    const cause = erreur.code === 'ABSENT' ? 'DOSSIER_EVENEMENT_ABSENT' : (erreur.details?.cause ?? erreur.code);
    return nonEcrite({ chemin: nom, dossier: (await lieuDe(lecture)).chemin, cause }, fichier);
  }

  // Le dossier où la planche d'une étude se dépose (nomPlancheExigeListe).
  const dossierDe = (lecture, etude) => dossierSelon(lecture, (dossier) => nomPlancheExigeListe(lecture.base, optionsDe(etude, dossier)));

  // Le refus d'un fichier qui ne se dépose pas : le nom, le dossier, la
  // cause, le fichier en cause — planche, controle ou liste — et, pour la
  // feuille de contrôle, le chemin des cartes déjà déposées ; remède
  // « Enregistrer sous… ». Le support de l'événement n'en est pas rompu.
  const nonEcrite = ({ chemin, dossier, cause }, fichier, deposee = null) =>
    refus(
      'PLANCHE_NON_ECRITE',
      { chemin, dossier, cause: cause ?? null, fichier, ...(deposee === null ? {} : { deposee }) },
      { geste: 'enregistrerSous' },
    );

  // Dépose un fichier dans le dossier de l'événement et rend son chemin,
  // ou le télécharge sous web et rend null. Une écriture refusée lève
  // PLANCHE_NON_ECRITE pour ce fichier ; quand le dossier ne se trouve plus,
  // de cause DOSSIER_EVENEMENT_ABSENT, le dossier nommé, sans deposee : ce
  // qui s'y était déposé est parti avec lui.
  async function deposer(lecture, nomFichier, octetsFichier, fichier, deposee = null) {
    const { fs, racine } = lecture;
    if (fs.nature === 'web') {
      await fs.enregistrerSous(nomFichier, octetsFichier);
      return null;
    }
    try {
      await fs.ecrireOctetsAtomique(racine, nomFichier, octetsFichier);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage && erreur.code === 'ECRITURE')) throw erreur;
      if (!(await dossierAbsent(lecture))) throw nonEcrite(erreur.details, fichier, deposee);
      const { chemin } = await lieuDe(lecture);
      throw nonEcrite({ chemin: nomFichier, dossier: chemin, cause: 'DOSSIER_EVENEMENT_ABSENT' }, fichier);
    }
    const { chemin, separateur } = await lieuDe(lecture);
    return chemin + separateur + nomFichier;
  }

  // Les octets de la liste d'une demande et son nom, sous le dossier de la
  // lecture quand avecDossier est vrai, sans dossier sinon. Le refus du
  // placement lève, ErreurCommande, avant que rien ne se produise ; une
  // liste refusée du dossier lève PLANCHE_NON_ECRITE sans rien écrire.
  async function listeDe(lecture, demande, { avecDossier }) {
    const { charge, base } = lecture;
    const { source, proposition, ordre, selection } = demandeLue(demande);
    const rejet = refusPlanche(charge, { source, proposition });
    if (rejet !== null) throw new ErreurCommande(rejet.code, rejet.details);
    if (typeof provenance !== 'string') throw new TypeError('provenance : le mode de construction attendu');
    const modele = modelePlanche(charge, { source, proposition, ordre, selection, provenance, version });
    const options = {
      horodatage: modele.horodatage,
      reedition: modele.reedition,
      proposition: modele.proposition,
      ordre,
      brouillon: modele.brouillon,
    };
    let dossier = null;
    if (avecDossier) {
      try {
        dossier = await dossierSelon(lecture, (sous) => nomCsvBadgesExigeListe(base, { ...options, dossier: sous }));
      } catch (erreur) {
        throw await nonListe(lecture, erreur, nomCsvBadges(base, options), 'liste');
      }
    }
    return { octets: listeBadges(modele, charge), nom: nomCsvBadges(base, { ...options, dossier }) };
  }

  // Les octets de la planche d'une demande, et son nom : sous le dossier de
  // la lecture quand avecDossier est vrai, sans dossier sinon ; controle,
  // ceux de la feuille de contrôle à part et son nom, null pour l'A6 ; le
  // pied TechnoLibre et les logos vont aux badges, jamais à la feuille de
  // contrôle, qui ne compte que les logos. Le refus de l'étude lève,
  // ErreurCommande, avant que rien ne se produise. Le dossier se lit avant
  // de produire : une liste refusée lève PLANCHE_NON_ECRITE sans rien
  // produire ni écrire.
  async function octetsDe(lecture, demande, { avecDossier }) {
    const etude = await etudier(lecture, demande);
    if (etude.refus !== null) throw new ErreurCommande(etude.refus.code, etude.refus.details);
    let dossier = null;
    if (avecDossier) {
      try {
        dossier = await dossierDe(lecture, etude);
      } catch (erreur) {
        throw await nonListe(lecture, erreur, nomDe(lecture.base, etude, null), 'planche');
      }
    }
    const nom = nomDe(lecture.base, etude, dossier);
    const { modele, papier, imposition, absents, modeleBadge, technolibre, logosParticipants } = etude;
    const planches = nombrePlanches(modele.badges.length, papier, modeleBadge);
    const logos = etude.logos === null ? null : { ...etude.logos, introuvables: etude.logos.introuvables.length };
    const controle = controleAvecRetirees(
      textesControle(modele, { papier, imposition, planches, absents, modeleBadge, logos }),
      retireesDe(etude.donnees),
      { cartes: aCartes(modeleBadge), logos },
    );
    const { produireControle, produirePlanche } = await chargerProduction();
    const entrees = {
      modele,
      papier,
      imposition,
      polices: await lesPolices(),
      controle,
      filigrane: libelle('planche.brouillon'),
      modeleBadge,
    };
    const octets = await produirePlanche({ ...entrees, technolibre, logosParticipants });
    if (!aCartes(modeleBadge)) return { octets, nom, controle: null };
    return { octets, nom, controle: { octets: await produireControle(entrees), nom: nomControleDe(lecture.base, etude, dossier) } };
  }

  return {
    /**
     * L'annonce de la planche, avant de produire (§ 11.2, § 11.5, § 11.8,
     * décision 12). Un refus du placement rend l'annonce sans modèle : comptes,
     * planches et noms null, ni homonymes ni absents, le brouillon de la
     * source. Pour l'A6, les planches des deux papiers sont données ; aucune
     * annonce ne demande le papier. La case du pied TechnoLibre de la lecture
     * s'y lit, et, quand elle est cochée et le modèle présent, le nombre de
     * badges d'où il se retire ; les cases de ce que le badge imprime s'y
     * lisent de même. Les logos des participants s'y comptent quand
     * un badge en désigne un, les introuvables nommés ; aucun ne refuse la
     * planche. Le nom est celui que la production donnerait, rang compris ;
     * sans dossier, donc sans rang, quand le dossier ne se liste pas. Rien ne
     * s'écrit.
     *
     * @throws {TypeError} une demande hors de son domaine, une séance sans
     *         polices ou sans provenance, une case cochée sans le chargement
     *         du logo
     * @throws {ErreurCommande} PROPOSITION_INCONNUE, PARTICIPANT_INCONNU,
     *         PERSONNE_EXCLUE (modelePlanche)
     */
    async preparer(lecture, demande) {
      const etude = await etudier(lecture, demande);
      const { charge } = lecture;
      const { papier, modeleBadge } = etude;
      if (etude.modele === null) {
        return {
          refus: etude.refus,
          modeleBadge,
          papier,
          comptes: null,
          planches: null,
          homonymes: [],
          absents: [],
          brouillon: estBrouillon(charge, { source: etude.source, tour: 'tous' }),
          nom: null,
          nomControle: null,
          piedTechnolibre: etude.pied,
          donneesBadge: etude.donnees,
          sansTechnolibre: null,
          logos: null,
        };
      }
      const { modele } = etude;
      let dossier = null;
      try {
        dossier = await dossierDe(lecture, etude);
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage)) throw erreur;
      }
      return {
        refus: etude.refus,
        modeleBadge,
        papier,
        comptes: modele.comptes,
        planches: planchesDe(modele.badges.length, modeleBadge),
        homonymes: modele.homonymes,
        absents: etude.absents,
        brouillon: modele.brouillon,
        nom: nomDe(lecture.base, etude, dossier),
        nomControle: nomControleDe(lecture.base, etude, dossier),
        piedTechnolibre: etude.pied,
        donneesBadge: etude.donnees,
        sansTechnolibre: etude.sansTechnolibre,
        logos: etude.logos,
      };
    },

    /**
     * Produit la planche et la dépose (§ 11.6) : dans le dossier de
     * l'événement, par une écriture atomique, sous electron et sur le
     * système d'épreuve, et rend son chemin en entier, racine, dossier,
     * nom ; sous web, par enregistrerSous, le téléchargement, et chemin
     * null. Pour Avery 5392, la feuille de contrôle à part se dépose
     * ensuite de la même façon, et controle rend son chemin et son nom ;
     * null pour l'A6. Le refus de l'annonce lève, sans rien écrire. Une
     * écriture refusée par le support, ou un dossier qui ne se liste pas
     * quand le nom se choisit parmi ses entrées, lève PLANCHE_NON_ECRITE
     * {chemin, dossier, cause, fichier}, remède « Enregistrer sous… » : le
     * support de l'événement n'en est pas rompu. dossier est le chemin du
     * dossier de l'événement ; cause vaut DOSSIER_EVENEMENT_ABSENT quand il
     * ne se trouve plus, et rien ne le recrée. fichier dit lequel manque :
     * 'planche', ou 'controle' quand la feuille de contrôle se refuse après
     * les cartes, deposee portant alors le chemin des cartes, déjà écrites,
     * sauf quand le dossier ne se trouve plus : elles sont parties avec lui.
     *
     * @throws {ErreurCommande} le refus de l'annonce ; PLANCHE_NON_ECRITE
     */
    async produire(lecture, demande) {
      const { octets, nom, controle } = await octetsDe(lecture, demande, { avecDossier: true });
      const chemin = await deposer(lecture, nom, octets, 'planche');
      if (controle === null) return { chemin, nom, controle: null };
      const cheminControle = await deposer(lecture, controle.nom, controle.octets, 'controle', chemin);
      return { chemin, nom, controle: { chemin: cheminControle, nom: controle.nom } };
    },

    /**
     * Produit la planche et la confie au dialogue d'enregistrement de la
     * plateforme, sous le nom de la planche sans rang ni coupe, que
     * l'opérateur garde ou change avec le dossier : le remède d'une écriture
     * refusée. Pour Avery 5392, un second dialogue suit pour la feuille de
     * contrôle à part, sous son propre nom, sauf quand l'opérateur a annulé
     * le premier. Rend null quand l'opérateur annule le premier dialogue ;
     * sinon {chemin, controle} : le chemin choisi pour la planche, et celui
     * de la feuille de contrôle, null pour l'A6 ou quand le second dialogue
     * est annulé. La feuille de contrôle refusée d'écriture après les
     * cartes lève PLANCHE_NON_ECRITE, fichier 'controle', deposee portant
     * le chemin des cartes, déjà écrites ; un refus des cartes remonte tel
     * que le support le lève, rien n'étant écrit.
     *
     * @throws {ErreurCommande} le refus de l'annonce ; PLANCHE_NON_ECRITE
     */
    async enregistrerSous(lecture, demande) {
      const { octets, nom, controle } = await octetsDe(lecture, demande, { avecDossier: false });
      const chemin = await lecture.fs.enregistrerSous(nom, octets);
      if (chemin === null) return null;
      if (controle === null) return { chemin, controle: null };
      try {
        return { chemin, controle: await lecture.fs.enregistrerSous(controle.nom, controle.octets) };
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage && erreur.code === 'ECRITURE')) throw erreur;
        throw nonEcrite(erreur.details, 'controle', chemin);
      }
    },

    /**
     * Produit la liste des badges en CSV (listeBadges) et la dépose comme la
     * planche : dans le dossier de l'événement, sous le nom de
     * nomCsvBadges, et rend {chemin, nom} ; sous web, téléchargée, chemin
     * null. La demande est celle de la planche — source, ordre, sélection ;
     * l'imposition n'y change rien. Seuls les refus du placement la gardent
     * (refusPlanche) ; une écriture refusée lève PLANCHE_NON_ECRITE, fichier
     * 'liste', remède « Enregistrer sous… », comme pour la planche.
     *
     * @throws {ErreurCommande} le refus du placement ; PLANCHE_NON_ECRITE ;
     *         PROPOSITION_INCONNUE, PARTICIPANT_INCONNU, PERSONNE_EXCLUE
     */
    async produireListe(lecture, demande) {
      const { octets, nom } = await listeDe(lecture, demande, { avecDossier: true });
      return { chemin: await deposer(lecture, nom, octets, 'liste'), nom };
    },

    /**
     * Produit la liste des badges et la confie au dialogue d'enregistrement,
     * sous son nom sans rang ni coupe : le remède d'une écriture refusée.
     * Rend le chemin choisi, null quand l'opérateur annule.
     *
     * @throws {ErreurCommande} le refus du placement
     */
    async enregistrerListeSous(lecture, demande) {
      const { octets, nom } = await listeDe(lecture, demande, { avecDossier: false });
      return lecture.fs.enregistrerSous(nom, octets);
    },
  };
}
