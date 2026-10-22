// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La planche de badges dans la séance (§ 11.2, § 11.6, § 11.8) : préparer
// l'annonce, produire le PDF et le déposer, l'enregistrer ailleurs ; produire
// de même la liste des badges en CSV. Sortir n'est pas modifier (§ 8.4,
// § 9) : rien ici n'écrit le fichier d'état ni le journal, ne prend de
// verrou ni ne lit le mode de la séance ; la seule écriture est celle du
// PDF — des deux PDF pour Avery 5392, les feuilles de cartes puis la
// feuille de contrôle à part — ou du CSV, à côté des fichiers d'événement,
// ou leur téléchargement sous web, où le dossier de travail est invisible à
// l'opérateur (décision 13). Une écriture refusée se dit PLANCHE_NON_ECRITE,
// qui nomme le fichier en cause, remède « Enregistrer sous… », sans toucher
// au support de l'événement.
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
// son nom prend le premier rang libre parmi les entrées que le dossier
// porte, listées à chaque préparation et à chaque production. Un dossier
// qui ne se liste pas laisse à l'annonce le nom sans dossier, et refuse la
// production PLANCHE_NON_ECRITE avant d'écrire, plutôt que de risquer de
// remplacer une planche précédente.
import { MODELES_BADGE, PAPIERS, estModeleBadge } from '../geometrie/papiers.js';
import { nombrePlanches } from '../pdf/imposition.js';
import { ErreurStockage } from '../stockage/erreurs.js';
import { nomControle, nomCsvBadges, nomCsvBadgesExigeListe, nomPlanche, nomPlancheExigeListe } from '../stockage/noms.js';
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
 * @property {import('../stockage/systeme_fichiers.js').Racine} racine   celle des fichiers de l'événement
 * @property {'A4'|'Lettre'|null} papier   celui des réglages locaux, null sans choix
 * @property {import('../geometrie/papiers.js').ModeleBadge} [modeleBadge]   celui des
 *           réglages locaux ; 'a6' quand la lecture ne le porte pas
 * @property {boolean} [piedTechnolibre]   la case du pied TechnoLibre des
 *           réglages locaux ; faux quand la lecture ne la porte pas
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
 * @property {number|null} sansTechnolibre   le nombre de badges d'où le pied
 *           TechnoLibre se retire, faute de place ; null sans la case, et
 *           sans modèle
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

  // Le pied TechnoLibre d'une planche qui le demande : son texte et les
  // octets du logo, chargés une fois ; null sans la case.
  async function technolibreDe(pied) {
    if (!pied) return null;
    if (typeof logo !== 'function') throw new TypeError('logo : la fonction qui charge le logo du pied TechnoLibre attendue');
    return { texte: libelle('planche.technolibre'), logo: await logoGarde() };
  }

  // L'étude d'une demande : le refus du placement, ou le modèle, son
  // analyse par la mise en page et le refus qu'elle porte. Un refus de mise
  // en page reçoit la personne du badge refusé, que src/pdf ne connaît pas.
  // Rien ne s'écrit.
  async function etudier(lecture, demande) {
    const { charge } = lecture;
    const lue = demandeLue(demande);
    const { source, proposition, ordre, selection } = lue;
    const modeleBadge = modeleDe(lecture);
    const pied = piedDe(lecture);
    const papier = papierDesBadges(modeleBadge, lecture.papier);
    const imposition = aCartes(modeleBadge) ? 'feuille' : lue.imposition;
    const rejet = refusPlanche(charge, { source, proposition });
    if (rejet !== null) return { refus: rejet, modele: null, absents: [], papier, imposition, ordre, source, modeleBadge, pied };
    if (typeof provenance !== 'string') throw new TypeError('provenance : le mode de construction attendu');
    const modele = modelePlanche(charge, { source, proposition, ordre, selection, provenance, version });
    const octets = await lesPolices();
    const technolibre = await technolibreDe(pied);
    const { analyserPlanche } = await chargerProduction();
    const analyse = await analyserPlanche({ modele, polices: octets, modeleBadge, technolibre });
    let leRefus = null;
    if (analyse.refus !== null) {
      const { code, details, rang } = analyse.refus;
      const badge = modele.badges[rang];
      const personne = code === 'PLANCHE_NOM_TROP_LONG' ? { participant: badge.participant, personne: badge.nom } : {};
      leRefus = refusProduction(code, { ...details, ...personne });
    }
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
      technolibre,
      sansTechnolibre: pied ? analyse.sansTechnolibre : null,
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

  // Le dossier où un fichier se dépose, tel que nomPlanche ou nomCsvBadges
  // le lit : sa racine, son séparateur et, quand exigeListe le dit sous ce
  // dossier, les noms qu'il porte ; null sous web, où le fichier se
  // télécharge. Un dossier qui ne se liste pas lève l'ErreurStockage de la
  // liste.
  async function dossierSelon({ fs, racine }, exigeListe) {
    if (fs.nature === 'web') return null;
    const { separateur } = await fs.emplacements();
    const sansListe = { racine: racine.chemin, separateur, existants: [] };
    if (!exigeListe(sansListe)) return sansListe;
    const existants = (await fs.lister(racine, '')).map(({ nom }) => nom);
    return { ...sansListe, existants };
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

  // Dépose un fichier à côté de l'événement et rend son chemin, ou le
  // télécharge sous web et rend null. Une écriture refusée lève
  // PLANCHE_NON_ECRITE pour ce fichier.
  async function deposer({ fs, racine }, nomFichier, octetsFichier, fichier, deposee = null) {
    if (fs.nature === 'web') {
      await fs.enregistrerSous(nomFichier, octetsFichier);
      return null;
    }
    try {
      await fs.ecrireOctetsAtomique(racine, nomFichier, octetsFichier);
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage && erreur.code === 'ECRITURE')) throw erreur;
      throw nonEcrite(erreur.details, fichier, deposee);
    }
    const { separateur } = await fs.emplacements();
    const tete = racine.chemin.endsWith(separateur) ? racine.chemin : racine.chemin + separateur;
    return tete + nomFichier;
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
        if (!(erreur instanceof ErreurStockage)) throw erreur;
        const cause = erreur.details?.cause ?? erreur.code;
        throw nonEcrite({ chemin: nomCsvBadges(base, options), dossier: lecture.racine.chemin, cause }, 'liste');
      }
    }
    return { octets: listeBadges(modele, charge), nom: nomCsvBadges(base, { ...options, dossier }) };
  }

  // Les octets de la planche d'une demande, et son nom : sous le dossier de
  // la lecture quand avecDossier est vrai, sans dossier sinon ; controle,
  // ceux de la feuille de contrôle à part et son nom, null pour l'A6 ; le
  // pied TechnoLibre va aux badges, jamais à la feuille de contrôle. Le
  // refus de l'étude lève, ErreurCommande, avant que rien ne se produise. Le
  // dossier se lit avant de produire : une liste refusée lève
  // PLANCHE_NON_ECRITE sans rien produire ni écrire.
  async function octetsDe(lecture, demande, { avecDossier }) {
    const etude = await etudier(lecture, demande);
    if (etude.refus !== null) throw new ErreurCommande(etude.refus.code, etude.refus.details);
    let dossier = null;
    if (avecDossier) {
      try {
        dossier = await dossierDe(lecture, etude);
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage)) throw erreur;
        const cause = erreur.details?.cause ?? erreur.code;
        throw nonEcrite({ chemin: nomDe(lecture.base, etude, null), dossier: lecture.racine.chemin, cause }, 'planche');
      }
    }
    const nom = nomDe(lecture.base, etude, dossier);
    const { modele, papier, imposition, absents, modeleBadge, technolibre } = etude;
    const planches = nombrePlanches(modele.badges.length, papier, modeleBadge);
    const controle = textesControle(modele, { papier, imposition, planches, absents, modeleBadge });
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
    const octets = await produirePlanche({ ...entrees, technolibre });
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
     * badges d'où il se retire. Le nom est celui que la production donnerait,
     * rang compris ; sans dossier, donc sans rang, quand le dossier ne se liste
     * pas. Rien ne s'écrit.
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
          sansTechnolibre: null,
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
        sansTechnolibre: etude.sansTechnolibre,
      };
    },

    /**
     * Produit la planche et la dépose (§ 11.6) : à côté des fichiers
     * d'événement, par une écriture atomique, sous electron et sur le
     * système d'épreuve, et rend son chemin en entier ; sous web, par
     * enregistrerSous, le téléchargement, et chemin null. Pour Avery 5392,
     * la feuille de contrôle à part se dépose ensuite de la même façon, et
     * controle rend son chemin et son nom ; null pour l'A6. Le refus de
     * l'annonce lève, sans rien écrire. Une écriture refusée par le
     * support, ou un dossier qui ne se liste pas quand le nom se choisit
     * parmi ses entrées, lève PLANCHE_NON_ECRITE {chemin, dossier, cause,
     * fichier}, remède « Enregistrer sous… » : le support de l'événement
     * n'en est pas rompu. fichier dit lequel manque : 'planche', ou
     * 'controle' quand la feuille de contrôle se refuse après les cartes,
     * deposee portant alors le chemin des cartes, déjà écrites.
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
     * planche : à côté des fichiers d'événement, sous le nom de
     * nomCsvBadges, et rend {chemin, nom} ; sous web, téléchargée, chemin
     * null. La demande est celle de la planche — source, ordre, sélection ;
     * l'imposition n'y change rien. Seuls les refus du placement la gardent
     * (refusPlanche) ; une écriture refusée lève PLANCHE_NON_ECRITE, fichier
     * 'liste', remède « Enregistrer sous… ».
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
