// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La façade des événements (§ 8.1, § 8.6, § 8.7, § 8.8, § 15) : la
// détermination du dossier de travail, une fois par séance, ses avis et ses
// questions ; la liste des événements ; les opérations de fichiers de la
// liste — créer, charger une démonstration, copier, renommer, supprimer,
// importer — et les dialogues de fichiers, relayés tels quels. Elle est, avec
// la séance, le seul écrivain que l'interface atteint.
//
// La façade ne connaît pas la séance : elle reçoit de quoi savoir quel
// événement est ouvert, l'ouvrir, le fermer, en créer un, lire et poser le
// dossier de travail, et appelle chacun au moment du geste. Une primitive du
// système de fichiers se lit sur fs à l'appel, jamais à la création : une
// épreuve la remplace après le montage.
//
// Lister ne fait que lire, et n'évalue rien : la liste paraît sans attendre
// aucune évaluation. Les deux résumés d'une
// ligne — celui de son retenu (resumeDuRetenu, evaluation.js) et la
// meilleure proposition de son classement (resumeDuMeilleur) — se calculent
// ensuite, un événement après l'autre, par resumer : chacun relit l'état de
// son événement une fois, examine sa charge comme l'ouverture l'examine, et
// rend la main entre deux événements.
//
// Une opération qui écrit dérive ses refus lisibles sans écrire — nom vide,
// plan bloqué, format plus récent — avant toute écriture, sonde de verrou
// comprise. Renommer et supprimer ferment d'abord
// l'événement visé quand il est ouvert : la séance rend son verrou, et la
// façade sonde alors celui du disque sous son propre identifiant de séance,
// tiré une fois à sa création ; une séance vivante, ou dont la vie ne se
// prouve pas, qui tient l'événement le refuse. Un refus qui suit la fermeture
// rouvre l'événement, en lecture, tel qu'il était.
//
// Les libellés figés qu'elle écrit au journal — copie, renommage, chargement
// d'une démonstration, jalon de création, reprise — se composent par
// libelle, en français ; aucune autre chaîne visible n'en sort : refus, avis
// et questions sont des codes et leurs détails.
import { deverrouiller, lister as listerDepot, ouvrir as ouvrirDepot, verrouiller } from '../stockage/depot.js';
import { determinerDossierTravail } from '../stockage/dossier_travail.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { decoderJournal, lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import {
  chargerDemonstration as chargerSurDisque,
  copier as copierSurDisque,
  importer,
  importerDepuis,
  libelleDeLInstant,
  listerCorbeille,
  renommer as renommerSurDisque,
  supprimer as supprimerSurDisque,
} from '../stockage/operations.js';
import { lireReglages } from '../stockage/reglages_locaux.js';
import { refusNomEvenement } from './commandes.js';
import { ErreurCommande, refus } from './erreurs.js';
import { resumeDuMeilleur, resumeDuRetenu } from './evaluation.js';
import { libelle } from './libelles.js';

/** Sièges par défaut et tours d'un événement neuf (§ 2.1, étapes 4 et 5). */
export const SIEGES_PAR_DEFAUT = 8;
export const TOURS_PAR_DEFAUT = 4;

// Les réponses qu'admet chaque question du dossier de travail (§ 8.6).
const REPONSES = new Map([
  ['PORTABLE_NON_INSCRIPTIBLE', ['reessayer', 'documents']],
  ['DOCUMENTS_NON_INSCRIPTIBLE', ['reessayer', 'continuer']],
]);

// Ce que rend la façade d'un verrou présent qui ne se lit pas.
const VERROU_ILLISIBLE = Object.freeze({ seance: null, depuis: null });

/**
 * @typedef {import('../stockage/systeme_fichiers.js').Racine} Racine
 * @typedef {import('../stockage/dossier_travail.js').DossierTravail} DossierTravail
 * @typedef {{code: string, details: Object}} Avis
 */

// Les avis d'une détermination, dans cet ordre : la raison du repli en
// Documents, les avertissements de la règle, puis celui des réglages locaux
// illisibles, quand il y en a un.
function avisDe(dossier, avertissementReglages) {
  const avis = [];
  if (dossier.raison !== null) {
    avis.push({ code: dossier.raison, details: dossier.raison === 'SONDE_ECHOUEE' ? { cause: dossier.cause } : {} });
  }
  for (const code of dossier.avertissements) avis.push({ code, details: {} });
  if (avertissementReglages !== null) avis.push(avertissementReglages);
  return avis;
}

// Un nom saisi pour copier ou renommer : en NFC, ses blancs de bout
// retirés ; vide, NOM_REQUIS ; plus long que NOM_EVENEMENT_MAX caractères,
// NOM_EVENEMENT_TROP_LONG {longueur, maximum}, la règle de la création
// (refusNomEvenement). Ce qui n'est pas une chaîne est une faute du code.
function nomSaisi(nom) {
  if (typeof nom !== 'string') throw new TypeError(`nom : chaîne attendue, reçu ${JSON.stringify(nom)}`);
  const texte = nom.normalize('NFC').trim();
  if (texte === '') throw refus('NOM_REQUIS');
  const tropLong = refusNomEvenement(texte);
  if (tropLong !== null) throw tropLong;
  return texte;
}

// Le chemin affichable, en entier, du chemin relatif d'une racine : ses
// segments joints au séparateur du système.
function cheminAffiche(racine, separateur, relatif) {
  const tete = racine.chemin.endsWith(separateur) ? racine.chemin : racine.chemin + separateur;
  return tete + relatif.split('/').join(separateur);
}

// Un refus de la couche qui le lève : une erreur dont l'interface lit le
// code et les détails. Toute autre erreur est une faute ou une panne.
const estRefus = (erreur) => erreur instanceof ErreurStockage || erreur instanceof ErreurCommande;

// Le refus d'un événement qu'aucun geste de la liste ne doit réécrire : un
// format plus récent, puis un plan bloqué, que « Débloquer » rend
// modifiable.
function exigerModifiable({ formatPlusRecent, charge }) {
  if (formatPlusRecent) throw new ErreurStockage('LECTURE_SEULE', { raison: 'FORMAT_PLUS_RECENT', remede: null });
  if (charge.evenement.etat === 'bloque') {
    throw new ErreurStockage('LECTURE_SEULE', { raison: 'BLOQUE', remede: { geste: 'debloquer' } });
  }
}

// L'horodatage de la dernière entrée du journal de base, tel que l'horloge
// de l'application qui l'a écrite l'a noté (§ 19.4) ; null sans journal,
// sans entrée lisible, ou quand le fichier ne se lit pas. Un journal dont une
// ligne n'est pas de l'UTF-8 se lit jusqu'à elle, comme à l'ouverture.
async function derniereModification(fs, racine, base) {
  if (base === null) return null;
  let texte;
  try {
    texte = await fs.lireTexte(racine, base + SUFFIXES.journal);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code !== 'LECTURE' || erreur.details.cause !== 'UTF8_INVALIDE') return null;
    texte = decoderJournal(erreur.details.octets).texte;
  }
  if (texte === null) return null;
  return lireJournal(texte).entrees.at(-1)?.horodatage ?? null;
}

// Les deux résumés d'un événement : mesuresDuRetenu (resumeDuRetenu) et
// meilleureDuClassement (resumeDuMeilleur). AUCUN_RESUME est celui d'un état
// qui ne se lit pas — illisible au relevé du dépôt, ou depuis : la ligne en
// porte déjà la cause, ou la portera à la liste suivante —, et celui que la
// liste montre pour un événement dont le calcul a fauté.
const AUCUN_RESUME = Object.freeze({ mesuresDuRetenu: null, meilleureDuClassement: null });

// La charge de l'événement base telle que l'ouverture la lit, sans rien
// écrire (ouvrir du dépôt, § 8.8) : un journal en avance d'une entrée la
// rattrape en mémoire, par la règle de rattraper, et examiner (§ 8.9, point
// 3) en écarte une proposition fautive, dont l'identifiant se répète ou
// atteint le compteur — le classement lève sur un identifiant répété. La
// liste nomme ainsi la proposition au rang 1 que le bloc de génération de
// l'événement ouvert nomme (§ 8.1). null pour un état absent ou qui ne
// s'ouvre pas.
async function chargeExaminee(fs, racine, base) {
  try {
    return (await ouvrirDepot(fs, racine, base)).charge;
  } catch (erreur) {
    if (erreur instanceof ErreurStockage) return null;
    throw erreur;
  }
}

// Pourquoi l'état d'un résumé illisible ne s'ouvre pas : les détails de
// l'ETAT_ILLISIBLE qu'ouvrir lève — raison, chemin, format quand il en nomme
// un, et les secours lisibles —, sans rien écrire. Un état redevenu lisible,
// ou disparu, depuis la liste du dépôt garde la raison du résumé, sans
// secours.
async function illisibleDe(fs, racine, { base, illisible }) {
  if (illisible === null) return null;
  try {
    await ouvrirDepot(fs, racine, base);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    if (erreur.code === 'ETAT_ILLISIBLE') return { ...erreur.details };
  }
  return { raison: illisible, secours: null };
}

// Le .gtt.verrou de base, lu sans rien écrire : sa séance et l'instant de sa
// prise ; null quand il manque ; seance et depuis null quand il ne se lit
// pas. Seule une sonde, qui écrit, dit si sa séance vit.
async function verrouDe(fs, racine, base) {
  let texte;
  try {
    texte = await fs.lireTexte(racine, base + SUFFIXES.verrou);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) throw erreur;
    return erreur.code === 'ABSENT' ? null : { ...VERROU_ILLISIBLE };
  }
  let contenu;
  try {
    contenu = JSON.parse(texte);
  } catch {
    contenu = null;
  }
  const lu = contenu !== null && typeof contenu === 'object' && typeof contenu.seance === 'string' && typeof contenu.depuis === 'string';
  return lu ? { seance: contenu.seance, depuis: contenu.depuis } : { ...VERROU_ILLISIBLE };
}

/**
 * La façade des événements, branchée par App sur la séance.
 *
 * @param {Object} parametres
 * @param {import('../stockage/systeme_fichiers.js').SystemeFichiers} parametres.fs
 * @param {import('./horloge.js').Horloge} parametres.horloge
 * @param {() => string} parametres.identifiant   tiré une fois à la création,
 *        pour la séance sous laquelle la façade sonde les verrous, puis une
 *        fois par événement qu'elle copie ou charge
 * @param {string} parametres.produitVersion
 * @param {Array<{cle: string, nom: string, texte: string}>} parametres.demonstrations
 * @param {() => string|null} parametres.ouvert          base de l'événement ouvert
 * @param {(base: string) => Promise<unknown>} parametres.ouvrir   en lecture
 * @param {() => Promise<unknown>} parametres.fermer
 * @param {(champs: Object) => Promise<{base: string}>} parametres.creer
 *        celle de la séance, qui juge nom et date et ouvre l'événement créé
 * @param {() => Racine|null} parametres.racine          le dossier de travail
 * @param {(racine: Racine) => Promise<unknown>} parametres.changerRacine
 */
export function creerFacade({
  fs,
  horloge,
  identifiant,
  produitVersion,
  demonstrations,
  ouvert,
  ouvrir,
  fermer,
  creer,
  racine,
  changerRacine,
}) {
  const seance = identifiant();
  const libelleReprise = libelle('ENTREE_REPRISE');
  const nomJalon = libelle('JALON_CREATION');

  // resultat : la dernière détermination aboutie, {dossier, avis} ; enCours :
  // la promesse de celle qui se fait, null sinon.
  let resultat = null;
  let enCours = null;

  // La règle du § 8.6, puis les réglages locaux du dossier retenu, lus une
  // fois ; la racine se pose quand aucune question n'attend. Un rejet ne
  // retient rien.
  async function determiner() {
    const dossier = await determinerDossierTravail(fs);
    const { avertissement } = await lireReglages(fs, dossier.racine);
    const issue = { dossier, avis: avisDe(dossier, avertissement) };
    if (dossier.question === null) await changerRacine(dossier.racine);
    resultat = issue;
    return issue;
  }

  function demarrer() {
    if (resultat !== null) return Promise.resolve(resultat);
    if (enCours === null) {
      enCours = determiner().finally(() => {
        enCours = null;
      });
    }
    return enCours;
  }

  // Le dossier de travail d'une opération : la détermination en cours
  // attendue ; QUESTION_EN_ATTENTE tant qu'une question attend sa réponse.
  async function exigerDossier() {
    if (enCours !== null) await enCours.catch(() => undefined);
    const question = resultat?.dossier.question ?? null;
    if (question !== null) throw refus('QUESTION_EN_ATTENTE', { question: question.code });
    const courante = racine();
    if (courante === null) throw new RangeError("façade : aucun dossier de travail, demarrer n'a pas abouti");
    return courante;
  }

  async function repondre(choix) {
    const question = resultat?.dossier.question ?? null;
    if (question === null) throw new RangeError('repondre : aucune question du dossier de travail n’attend');
    if (!REPONSES.get(question.code).includes(choix)) {
      throw new RangeError(`repondre : ${JSON.stringify(choix)} ne répond pas à ${question.code}`);
    }
    if (choix === 'reessayer') {
      resultat = null;
      return demarrer();
    }
    const { dossier, avis } = resultat;
    let importe = null;
    let suite = { ...dossier, question: null };
    if (choix === 'documents') {
      // data/ illisible, compte null : rien à copier.
      const bases = question.evenements === null ? [] : (await listerDepot(fs, question.racine)).map(({ base }) => base);
      importe = await importerDepuis(fs, question.racine, dossier.racine, bases);
      suite = { ...suite, autre: null };
    }
    await changerRacine(suite.racine);
    resultat = { dossier: suite, avis };
    return importe === null ? resultat : { ...resultat, importe };
  }

  async function lister() {
    const courante = await exigerDossier();
    const resumes = await listerDepot(fs, courante);
    const { separateur } = await fs.emplacements();
    const lignes = [];
    for (const resume of resumes) {
      const { base, id, doublon } = resume;
      lignes.push({
        base,
        id,
        nom: resume.nom,
        date: resume.date,
        etat: resume.etat,
        participants: resume.participants,
        derniereModification: await derniereModification(fs, courante, resume.journal),
        chemin: cheminAffiche(courante, separateur, base + SUFFIXES.etat),
        illisible: await illisibleDe(fs, courante, resume),
        journalSeul: resume.illisible === 'ABSENT',
        doublonAvec: doublon
          ? resumes.filter((autre) => autre !== resume && autre.doublon && autre.id === id).map((autre) => autre.base)
          : [],
        verrou: await verrouDe(fs, courante, base),
      });
    }
    return lignes;
  }

  // Les résumés des lignes, dans le dossier de travail de l'appel : ceux des
  // états illisibles aussitôt, puis un événement lisible par pas, dans
  // l'ordre des lignes. Chaque pas attend ceder(), lit l'état, puis calcule ;
  // abandonné, le flux ne lit ni ne calcule plus rien, et le calcul en cours
  // ne se reçoit pas. Une faute d'un événement lui donne AUCUN_RESUME, le
  // flux continue, et fin la rejette une fois le flux arrêté.
  function resumer(lignes, { ceder, recevoir }) {
    const courante = racine();
    if (courante === null) throw new RangeError("resumer : aucun dossier de travail, demarrer n'a pas abouti");
    let abandonne = false;
    for (const { base, illisible } of lignes) if (illisible !== null) recevoir(base, AUCUN_RESUME);
    const lisibles = lignes.filter(({ illisible }) => illisible === null).map(({ base }) => base);
    async function parcourir() {
      let faute = null;
      for (const base of lisibles) {
        await ceder();
        if (abandonne) break;
        let resume = AUCUN_RESUME;
        try {
          const charge = await chargeExaminee(fs, courante, base);
          if (!abandonne && charge !== null) {
            resume = { mesuresDuRetenu: resumeDuRetenu(charge), meilleureDuClassement: resumeDuMeilleur(charge) };
          }
        } catch (erreur) {
          faute ??= erreur;
        }
        if (abandonne) break;
        recevoir(base, resume);
      }
      if (faute !== null) throw faute;
    }
    return {
      abandonner() {
        abandonne = true;
      },
      fin: parcourir(),
    };
  }

  // Le verrou de l'événement cible pris sous la séance de la façade, daté de
  // l'horloge lue une fois. Le sien, resté d'un rendu refusé, est déjà pris ;
  // celui d'une séance morte (vivant faux) s'efface en son nom, puis se
  // prend ; tout autre lève VERROU_PRIS, sans rien changer.
  async function prendreVerrou(cible) {
    const depuis = horloge.horodatage();
    let verrou = await verrouiller(cible, seance, depuis);
    if (!verrou.pris && verrou.seance === seance) return;
    if (!verrou.pris && verrou.vivant === false) {
      await deverrouiller(cible, verrou.seance);
      verrou = await verrouiller(cible, seance, depuis);
    }
    if (!verrou.pris) {
      const { seance: tenue, depuis, vivant } = verrou;
      throw new ErreurStockage('VERROU_PRIS', { seance: tenue, depuis, vivant, remede: null });
    }
  }

  // Après le refus d'une opération qui a fermé l'événement base, le rouvre en
  // lecture ; une panne, qui n'est pas un refus, laisse tout. Un échec de
  // cette réouverture ne masque pas le refus.
  async function rouvrirApresRefus(base, etaitOuvert, erreur) {
    if (etaitOuvert && estRefus(erreur)) await ouvrir(base).catch(() => undefined);
  }

  async function creerEvenement({ nom, date = null }) {
    await exigerDossier();
    return creer({ nom, date, siegesParDefaut: SIEGES_PAR_DEFAUT, tours: TOURS_PAR_DEFAUT });
  }

  async function chargerDemonstration(cle) {
    const demonstration = demonstrations.find((candidate) => candidate.cle === cle);
    if (demonstration === undefined) throw new RangeError(`aucune démonstration de clé ${JSON.stringify(cle)}`);
    const courante = await exigerDossier();
    const charge = await chargerSurDisque(fs, courante, demonstration.texte, {
      id: identifiant(),
      libelle: libelle('ENTREE_DEMONSTRATION', { nom: demonstration.nom }),
      nomJalon,
      horodatage: horloge.horodatage(),
      produitVersion,
    });
    await ouvrir(charge.base);
    return { base: charge.base };
  }

  // Une source d'un format plus récent ne se copie pas : la LECTURE_SEULE du
  // dépôt se relaie avec remede null, comme les refus propres de la façade.
  async function copier(base, { nom }) {
    const texte = nomSaisi(nom);
    const courante = await exigerDossier();
    const source = await ouvrirDepot(fs, courante, base);
    // L'instant copié, par la règle même qui l'inscrit à la filiation.
    const instant = libelleDeLInstant(source, libelleReprise);
    let copie;
    try {
      copie = await copierSurDisque(source, {
        id: identifiant(),
        nom: texte,
        libelle: libelle('ENTREE_COPIE', { source: source.charge.evenement.nom, instant }),
        nomJalon,
        horodatage: horloge.horodatage(),
        produitVersion,
        libelleReprise,
      });
    } catch (erreur) {
      if (erreur instanceof ErreurStockage && erreur.code === 'LECTURE_SEULE') {
        throw new ErreurStockage('LECTURE_SEULE', { ...erreur.details, remede: null });
      }
      throw erreur;
    }
    await ouvrir(copie.base);
    return { base: copie.base };
  }

  async function renommer(base, { nom }) {
    const texte = nomSaisi(nom);
    const courante = await exigerDossier();
    exigerModifiable(await ouvrirDepot(fs, courante, base));
    const etaitOuvert = ouvert() === base;
    if (etaitOuvert) await fermer();
    const cible = { fs, racine: courante, base };
    let renomme;
    try {
      await prendreVerrou(cible);
      try {
        // Relu sous le verrou : une autre séance a pu l'écrire depuis.
        const source = await ouvrirDepot(fs, courante, base);
        exigerModifiable(source);
        renomme = await renommerSurDisque(source, {
          nom: texte,
          libelle: libelle('ENTREE_RENOMMER', { ancien: source.charge.evenement.nom, nom: texte }),
          horodatage: horloge.horodatage(),
          produitVersion,
          libelleReprise,
        });
      } catch (erreur) {
        await deverrouiller(cible, seance).catch(() => undefined);
        throw erreur;
      }
    } catch (erreur) {
      await rouvrirApresRefus(base, etaitOuvert, erreur);
      throw erreur;
    }
    // Le renommage fait, un verrou qui ne se rend pas le dit sans le défaire.
    const avertissements = [];
    try {
      await deverrouiller(cible, seance);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage)) throw erreur;
      avertissements.push({ code: 'VERROU_NON_RENDU', details: erreur.details });
    }
    if (etaitOuvert) await ouvrir(renomme.base);
    return { base: renomme.base, avertissements };
  }

  async function supprimer(base) {
    const courante = await exigerDossier();
    const etaitOuvert = ouvert() === base;
    if (etaitOuvert) await fermer();
    try {
      return await supprimerSurDisque(fs, courante, base, { horodatage: horloge.horodatage(), seance });
    } catch (erreur) {
      await rouvrirApresRefus(base, etaitOuvert, erreur);
      if (erreur instanceof ErreurStockage && erreur.code === 'VERROU_PRIS') {
        throw new ErreurStockage('VERROU_PRIS', { ...erreur.details, remede: null });
      }
      throw erreur;
    }
  }

  async function corbeille() {
    const courante = await exigerDossier();
    const { separateur } = await fs.emplacements();
    return (await listerCorbeille(fs, courante)).map(({ dossier, fichiers }) => ({
      dossier,
      chemin: cheminAffiche(courante, separateur, dossier),
      fichiers,
    }));
  }

  async function importerFichier() {
    const courante = await exigerDossier();
    const choisi = await fs.choisirFichierAImporter();
    if (choisi === null) return null;
    return importer(fs, courante, choisi.octets);
  }

  async function importerDepuisAutre() {
    const vers = await exigerDossier();
    const autre = resultat.dossier.autre;
    if (autre === null) throw new RangeError("importerDepuisAutre : l'autre emplacement ne propose rien");
    const bases = (await listerDepot(fs, autre.racine)).map(({ base }) => base);
    const importe = await importerDepuis(fs, autre.racine, vers, bases);
    resultat = { ...resultat, dossier: { ...resultat.dossier, autre: null } };
    return importe;
  }

  function explorateur() {
    return fs.nature === 'web'
      ? { disponible: false, raison: 'EXPLORATEUR_ABSENT' }
      : { disponible: true, raison: null };
  }

  async function ouvrirExplorateur() {
    if (fs.nature === 'web') throw refus('EXPLORATEUR_ABSENT');
    return fs.ouvrirDansExplorateur(await exigerDossier());
  }

  return {
    /**
     * La détermination du dossier de travail, une fois par séance (§ 8.6) :
     * { dossier, avis }, le même tant qu'aucune réponse ne la refait. Une
     * détermination qui rejette ne retient rien, et l'appel suivant la refait.
     * @returns {Promise<{dossier: DossierTravail, avis: Avis[]}>}
     */
    demarrer,
    /**
     * La réponse à la question du dossier de travail : comme demarrer ;
     * 'documents' rend aussi importe, ce que la copie de data/ a importé et
     * refusé (importerDepuis). RangeError sans question, ou pour un choix
     * qu'elle n'admet pas.
     * @param {'reessayer'|'documents'|'continuer'} choix
     */
    repondre,
    /**
     * Les lignes de la liste (§ 8.1), dans l'ordre du dépôt, telles que le
     * relevé du dépôt les donne ; n'écrit rien, et n'évalue rien : leurs
     * résumés viennent de resumer.
     */
    lister,
    /**
     * Les résumés des lignes de lister (§ 8.1), un événement après l'autre,
     * sans rien écrire : recevoir(base, { mesuresDuRetenu,
     * meilleureDuClassement }) une fois par ligne — resumeDuRetenu et
     * resumeDuMeilleur de sa charge examinée, chacun null sans retenu
     * mesurable ou sans proposition classée, l'un et l'autre null pour un
     * état illisible. Une ligne illisible reçoit le sien avant le retour ;
     * chaque ligne lisible attend la promesse de ceder(), puis relit son
     * état et se calcule. abandonner() arrête le flux : plus rien ne se lit,
     * ne se calcule ni ne se reçoit. fin se résout quand le flux s'arrête, et
     * rejette par la première faute d'un calcul, dont la ligne a reçu les
     * deux résumés à null. RangeError sans dossier de travail.
     *
     * @param {Array<{base: string, illisible: object|null}>} lignes
     * @param {{ceder: () => Promise<unknown>, recevoir: (base: string, resume: Object) => void}} rappels
     * @returns {{abandonner: () => void, fin: Promise<void>}}
     */
    resumer,
    /** Crée et ouvre en lecture l'événement { nom, date } (§ 2.1, étape 1). */
    creer: creerEvenement,
    /** Charge la démonstration de clé donnée sous « ‹nom› N », ouverte en lecture (§ 15). */
    chargerDemonstration,
    /** Copie l'événement base sous le nom donné, et ouvre la copie en lecture (§ 8.7). */
    copier,
    /** Renomme l'événement base ; ouvert, il se rouvre en lecture sous sa nouvelle base (§ 8.7). */
    renommer,
    /** Déplace les fichiers de l'événement base dans la corbeille datée (§ 8.7). */
    supprimer,
    /** Le contenu de la corbeille : [{ dossier, chemin, fichiers }] (§ 8.7). */
    corbeille,
    /** Importe le fichier d'événement que l'opérateur choisit → { base }, ou null (§ 8.7). */
    importerFichier,
    /** Copie dans le dossier de travail les événements de l'autre emplacement (§ 8.6). */
    importerDepuisAutre,
    /** Le dialogue de choix d'un fichier, relayé : { nom, octets } ou null. */
    choisirCsv: () => fs.choisirFichierAImporter(),
    /** Le dialogue d'enregistrement, relayé : le chemin choisi, ou null. */
    enregistrerSous: (nomPropose, octets) => fs.enregistrerSous(nomPropose, octets),
    /** { disponible, raison } : raison EXPLORATEUR_ABSENT sous web (§ 8.6). */
    explorateur,
    /** Montre le dossier de travail dans l'explorateur du système. */
    ouvrirExplorateur,
  };
}
