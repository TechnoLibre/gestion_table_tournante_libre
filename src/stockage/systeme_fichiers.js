// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le système de fichiers, frontière de plateforme du stockage (§ 13.4). Ce
// module en déclare l'interface, que trois implémentations portent : celle de
// la coquille electron, livrée ; celle de la plateforme web, sur l'OPFS ; celle
// d'épreuve, en mémoire, qui sait tomber en panne (test/fichiers_simules.js).
// Toute fonction du stockage qui touche un fichier reçoit un SystemeFichiers
// en paramètre (§ 14.10) ; la suite de contrat test/contrat_fichiers.js
// éprouve les trois implémentations par les mêmes épreuves.
//
// Une primitive ne reçoit jamais de chemin absolu : une racine, connue par son
// identifiant, et un chemin relatif à elle, aux segments séparés par « / »,
// sans « .. » ni chemin absolu ; '' désigne la racine elle-même. Le chemin
// d'une racine sert à l'affichage, jamais à résoudre un fichier. Toutes les
// primitives sont asynchrones. Un échec lève une ErreurStockage :
//
//   ABSENT         {chemin}                  lecture d'un fichier, ou liste
//                                            d'un dossier, qui n'existe pas
//   ECRITURE       {chemin, dossier, cause}  une écriture, un ajout, un
//                                            renommage refusés ; la cible est
//                                            intacte. chemin est le chemin
//                                            relatif reçu, dossier le chemin
//                                            affichable du dossier qui le
//                                            porte — la racine elle-même pour
//                                            '' —, cause celle que rapporte
//                                            la plateforme (EBUSY, EROFS…)
//   EXISTE         {chemin}                  deplacer vers une cible existante
//   NON_VIDE       {chemin}                  supprimerDossier d'un dossier qui
//                                            porte encore une entrée ; le
//                                            dossier et son contenu restent
//   CHEMIN_REFUSE  {chemin}                  chemin absolu ou remontant, racine
//                                            inconnue, et '' pour
//                                            supprimerDossier
//   LECTURE        {chemin, dossier, cause}  une lecture refusée autrement que
//                                            sur un absent ; cause
//                                            UTF8_INVALIDE pour un fichier dont
//                                            les octets ne sont pas de l'UTF-8,
//                                            que lireTexte ne lit jamais en
//                                            U+FFFD ; les détails portent
//                                            alors aussi octets, une copie
//                                            des octets du fichier
//
// types.js donne la table entière des codes du stockage.
import { ErreurStockage } from './erreurs.js';
import { estHorodatage } from './journal.js';

/**
 * Une racine : un dossier que l'implémentation connaît par son identifiant
 * — portable, documents, ou un dossier choisi.
 *
 * @typedef {Object} Racine
 * @property {string} id
 * @property {string} chemin   chemin absolu, affichable
 */

/**
 * @typedef {Object} Emplacements
 * @property {string|null} executable       dossier publié par le lanceur portable
 * @property {string[]} donneesApplicatives AppData, LocalAppData, temporaire, en absolu
 * @property {boolean} insensibleCasse      les chemins se comparent sans égard à la casse
 * @property {'\\'|'/'} separateur
 */

/**
 * Une entrée d'un dossier.
 *
 * @typedef {Object} Entree
 * @property {string} nom
 * @property {'fichier'|'dossier'} type
 * @property {number} taille   octets du fichier en UTF-8 ; 0 pour un dossier
 * @property {number} modifie  millisecondes, pour l'affichage seulement :
 *           aucune décision ne s'y fonde, puisque recopier un dossier suffit
 *           à les fausser (§ 14.10)
 */

/**
 * Ce que rend verrouiller. pris : true quand l'appel a créé le verrou. Sinon,
 * la séance qui le tient, l'instant de sa prise, et vivant : vrai quand son
 * processus tourne sur cette machine avec l'heure de démarrage inscrite ;
 * faux quand il est mort à coup sûr — aucun processus de ce pid, ou deux
 * heures de démarrage connues qui diffèrent ; null sinon — verrou d'une autre
 * machine, ou vie qui ne se prouve pas. Un verrou qui ne se lit pas rend
 * seance, depuis et vivant à null.
 *
 * @typedef {{pris: true}
 *   | {pris: false, seance: string|null, depuis: string|null, vivant: boolean|null}} Verrou
 */

/**
 * @typedef {Object} SystemeFichiers
 * @property {'electron'|'web'|'epreuve'} nature
 * @property {boolean} renommageAtomique   faux sous web (§ 8.8)
 * @property {boolean} verrouDisponible    faux sous web (§ 8.8) : verrouiller
 *           rend alors { pris: true } à chaque appel, et deverrouiller n'efface rien
 * @property {() => Promise<Emplacements>} emplacements
 * @property {() => Promise<{portable: Racine|null, documents: Racine}>} racines
 *           portable : data/ à côté de l'exécutable publié ; documents :
 *           data/ dans le dossier du produit des Documents (§ 8.6)
 * @property {() => Promise<Racine|null>} choisirDossier       dialogue natif ;
 *           null quand l'opérateur annule
 * @property {(r: Racine) => Promise<{inscriptible: boolean, cause: string|null}>} sonder
 *           crée la racine, parents compris, efface un .gtt-temoin resté
 *           d'une séance précédente, écrit .gtt-temoin, le relit, l'efface
 *           (§ 8.6) ; un échec rend sa cause, sans lever
 * @property {(r: Racine) => Promise<'amovible'|'fixe'|'inconnu'>} typeSupport
 * @property {(r: Racine, chemin: string) => Promise<string>} lireTexte
 *           le texte tel qu'écrit : marque d'ordre d'octets, fins de ligne et
 *           forme de normalisation comprises ; ABSENT pour un fichier absent
 *           ou un dossier. Le décodage est strict : des octets qui ne sont
 *           pas de l'UTF-8 lèvent LECTURE {chemin, dossier, cause:
 *           'UTF8_INVALIDE', octets}, octets étant un Uint8Array, copie des
 *           octets du fichier, que le dépôt décode ligne par ligne
 * @property {(r: Racine, chemin: string, texte: string) => Promise<void>} ecrireAtomique
 *           <chemin>.ecriture, vidé sur le disque, renommé par-dessus ; réessaie
 *           le renommage ; un échec laisse la cible intacte (§ 8.8) ; là où
 *           renommageAtomique est faux, l'écriture va droit sur la cible. Le
 *           dossier qui porte la cible doit exister : un dossier absent lève
 *           ECRITURE, car un dossier de travail disparu — un support retiré —
 *           ne se recrée pas en silence
 * @property {(r: Racine, chemin: string, octets: Uint8Array) => Promise<void>} ecrireOctetsAtomique
 *           les octets tels quels, avec les garanties d'ecrireAtomique : même
 *           fichier .ecriture, même renommage et mêmes réessais, même cible
 *           intacte après un échec, même ECRITURE pour un dossier absent ; là
 *           où renommageAtomique est faux, l'écriture va droit sur la cible.
 *           Le fichier ne garde aucun lien au tableau reçu, que l'appelant peut
 *           réemployer. Des octets d'une autre forme qu'un Uint8Array lèvent
 *           TypeError sans rien écrire (exigerOctets). C'est l'écriture d'un
 *           fichier qui n'est pas un texte : la planche de badges (§ 11.6)
 * @property {(r: Racine, chemin: string, ligne: string) => Promise<void>} ajouterLigne
 *           ajoute la ligne puis une fin de ligne LF après le dernier octet du
 *           fichier, sans rien insérer avant, vidé sur le disque ; crée le
 *           fichier absent, jamais son dossier. La ligne ne porte aucune fin
 *           de ligne
 * @property {(r: Racine, dossier: string) => Promise<Entree[]>} lister
 *           les entrées directes du dossier, triées par nom, unités UTF-16
 *           comparées une à une ; ABSENT pour un dossier absent
 * @property {(r: Racine, chemin: string) => Promise<void>} creerDossier
 *           '' crée la racine elle-même, parents compris ; un autre chemin
 *           crée ce qui lui manque sous la racine, qui doit exister : une
 *           racine absente lève ECRITURE, sans rien créer, car un dossier de
 *           travail disparu ne renaît pas en silence (§ 8.6). Un dossier
 *           existant n'est pas une faute
 * @property {(r: Racine, chemin: string) => Promise<void>} supprimerDossier
 *           retire un dossier vide, et lui seul : aucune primitive ne retire
 *           un dossier avec ce qu'il porte. Un dossier qui porte une entrée,
 *           fût-ce un dossier vide ou un fichier d'échange, lève NON_VIDE et
 *           reste tel ; un fichier à sa place lève ECRITURE ; un dossier
 *           absent, ou sous un parent absent, n'est pas une faute. '', la
 *           racine elle-même, lève CHEMIN_REFUSE avant tout accès
 * @property {(r: Racine, de: string, vers: string) => Promise<void>} deplacer
 *           un fichier ; refuse une cible existante (EXISTE), comparée comme le
 *           système compare les noms, si bien que sans égard à la casse une
 *           autre casse du même nom est une cible existante ; ABSENT pour une
 *           source absente ; le dossier de la cible doit exister
 * @property {(r: Racine, chemin: string) => Promise<void>} supprimer
 *           un fichier ; un fichier absent n'est pas une faute
 * @property {(r: Racine, chemin: string, seance: string, depuis: string) => Promise<Verrou>} verrouiller
 *           création exclusive de {seance, pid, hote, depuis, demarrage} :
 *           un verrou présent n'est jamais repris, fût-il de la même séance.
 *           depuis, l'instant de la prise que donne l'horloge de
 *           l'application, s'inscrit tel quel ; un depuis qui n'a pas la
 *           forme d'un horodatage lève TypeError sans rien créer, là où
 *           verrouDisponible est faux comme ailleurs (exigerDepuis)
 * @property {(r: Racine, chemin: string, seance: string) => Promise<void>} deverrouiller
 *           n'efface que le verrou de cette séance ; un verrou absent n'est
 *           pas une faute
 * @property {(r: Racine, chemin?: string) => Promise<void>} ouvrirDansExplorateur
 *           montre dans l'explorateur du système le dossier que désigne
 *           chemin, '' par défaut : la racine elle-même ; un dossier absent,
 *           ou un fichier, lève ABSENT ; là où il n'y a pas d'explorateur,
 *           NON_DISPONIBLE, une fois le chemin admis
 * @property {() => Promise<{nom: string, octets: Uint8Array}|null>} choisirFichierAImporter
 *           null quand l'opérateur annule
 * @property {(nomPropose: string, octets: Uint8Array) => Promise<string|null>} enregistrerSous
 *           le chemin choisi, ou null quand l'opérateur annule
 */

// Motif d'un segment que toute implémentation accepte. Un segment vide
// vient d'un chemin absolu (« /x »), d'un séparateur doublé ou final. Un
// segment qui finit par un point ou une espace comprend « . » et « .. », et
// ce que Windows ramène à eux ou à un autre nom en retirant points et espaces
// finaux : « ... », « .. » suivi d'une espace, « soiree. ». La barre oblique
// inverse sépare les segments sous Windows ; le deux-points y désigne un
// lecteur (« C:\x », « C:x ») ou un flux de données secondaire ; le
// caractère nul tronque un chemin là où la plateforme le lit en C.
const SEGMENT_ADMIS = /^[^\\:\u{0}]*[^\\:\u{0}. ]$/u;

/**
 * Segments d'un chemin relatif à une racine : [] pour '', la racine
 * elle-même. Le contrôle ne lit que le texte du chemin ; il ne connaît ni la
 * racine ni les liens, que résout chaque implémentation.
 *
 * @param {string} chemin
 * @returns {string[]}
 * @throws {ErreurStockage} CHEMIN_REFUSE {chemin} : autre chose qu'une chaîne,
 *         ou un segment que SEGMENT_ADMIS refuse
 */
export function exigerCheminRelatif(chemin) {
  if (typeof chemin !== 'string') throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
  if (chemin === '') return [];
  const segments = chemin.split('/');
  if (!segments.every((segment) => SEGMENT_ADMIS.test(segment))) {
    throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
  }
  return segments;
}

/**
 * Lève TypeError quand depuis, l'instant de prise d'un verrou, n'a pas la
 * forme d'un horodatage (estHorodatage) : chaque implémentation de
 * verrouiller l'appelle avant de rien lire ou créer.
 *
 * @param {unknown} depuis
 * @throws {TypeError}
 */
export function exigerDepuis(depuis) {
  if (!estHorodatage(depuis)) throw new TypeError(`instant de prise : horodatage attendu, reçu ${JSON.stringify(depuis)}`);
}

/**
 * Lève TypeError quand octets n'est pas un Uint8Array — un Buffer de Node en
 * est un — : chaque implémentation d'ecrireOctetsAtomique l'appelle avant de
 * rien écrire, et celle de la coquille avant de passer le pont.
 *
 * @param {unknown} octets
 * @throws {TypeError}
 */
export function exigerOctets(octets) {
  if (!(octets instanceof Uint8Array)) {
    throw new TypeError(`octets : Uint8Array attendu, reçu ${Object.prototype.toString.call(octets)}`);
  }
}

// Les primitives qui ne reçoivent aucun chemin relatif, hors sonder : une
// vue de dossier les relaie telles quelles.
const SANS_CHEMIN = [
  'emplacements',
  'racines',
  'choisirDossier',
  'typeSupport',
  'choisirFichierAImporter',
  'enregistrerSous',
];

// Le témoin qu'écrit la sonde d'une vue de dossier, du nom de celui des
// implémentations.
const TEMOIN = '.gtt-temoin';

// Les primitives dont le second argument est un chemin relatif, le seul
// qu'elles reçoivent ; deplacer, qui en reçoit deux, et supprimerDossier,
// qui refuse '', ont leur relais propre.
const A_UN_CHEMIN = [
  'lireTexte',
  'ecrireAtomique',
  'ecrireOctetsAtomique',
  'ajouterLigne',
  'lister',
  'creerDossier',
  'supprimer',
  'verrouiller',
  'deverrouiller',
];

/**
 * La vue de fs sur un dossier de ses racines (§ 8.6) : un SystemeFichiers
 * dont chaque primitive reçoit un chemin relatif au dossier, celui d'un
 * événement, et le passe à fs préfixé du dossier ; '' y désigne le dossier
 * lui-même. Le dépôt lit et écrit ainsi les fichiers d'un événement sous
 * leurs seuls noms, <base> suivi d'un suffixe, comme dans une racine.
 *
 * Un chemin que le contrat refuse se refuse tel que reçu, avant tout accès,
 * et '' se refuse à supprimerDossier, CHEMIN_REFUSE : la vue ne retire pas
 * son propre dossier. Le chemin des détails d'une ErreurStockage que lève
 * fs redevient relatif au dossier, celui que la vue a reçu ; le dossier
 * d'une ECRITURE ou d'une LECTURE, chemin affichable de celui qui porte le
 * fichier, reste tel quel. sonder éprouve le dossier, par les primitives
 * de fs : il le crée sous la racine, qui doit exister, efface un témoin
 * resté, en écrit un, le relit et l'efface ; un refus rend sa cause, et
 * seul un chemin refusé lève. Les autres primitives sans chemin relatif —
 * racines, type du support, dialogues — passent telles quelles. Chaque
 * primitive se lit sur fs à l'appel, jamais à la création de la vue : une
 * épreuve qui en remplace une après coup est entendue.
 *
 * @param {SystemeFichiers} fs
 * @param {string} dossier   chemin relatif à une racine, non vide
 * @returns {SystemeFichiers & {dossier: string, systeme: SystemeFichiers}}
 *          la vue ; dossier et systeme sont ceux qu'elle prolonge
 * @throws {ErreurStockage} CHEMIN_REFUSE {chemin: dossier} : un dossier vide,
 *         ou que exigerCheminRelatif refuse
 */
export function vueDossier(fs, dossier) {
  if (exigerCheminRelatif(dossier).length === 0) throw new ErreurStockage('CHEMIN_REFUSE', { chemin: dossier });
  const prefixe = `${dossier}/`;
  // Le chemin sous le dossier ; CHEMIN_REFUSE, tel que reçu, pour un chemin
  // que le contrat refuse.
  const dedans = (chemin) => {
    exigerCheminRelatif(chemin);
    return chemin === '' ? dossier : prefixe + chemin;
  };
  // Le chemin relatif au dossier d'un chemin relatif à la racine qui y
  // mène ; tout autre chemin reste tel quel.
  const relatif = (chemin) => {
    if (chemin === dossier) return '';
    return chemin.startsWith(prefixe) ? chemin.slice(prefixe.length) : chemin;
  };
  // L'appel de fs, dont l'ErreurStockage reprend le chemin relatif au
  // dossier ; toute autre erreur remonte telle quelle.
  async function relayer(appel) {
    try {
      return await appel();
    } catch (erreur) {
      if (!(erreur instanceof ErreurStockage) || typeof erreur.details?.chemin !== 'string') throw erreur;
      throw new ErreurStockage(erreur.code, { ...erreur.details, chemin: relatif(erreur.details.chemin) });
    }
  }
  const vue = {
    dossier,
    systeme: fs,
    get nature() {
      return fs.nature;
    },
    get renommageAtomique() {
      return fs.renommageAtomique;
    },
    get verrouDisponible() {
      return fs.verrouDisponible;
    },
    async deplacer(racine, de, vers) {
      const source = dedans(de);
      const cible = dedans(vers);
      return relayer(() => fs.deplacer(racine, source, cible));
    },
    async supprimerDossier(racine, chemin) {
      if (chemin === '') throw new ErreurStockage('CHEMIN_REFUSE', { chemin });
      const plein = dedans(chemin);
      return relayer(() => fs.supprimerDossier(racine, plein));
    },
    async sonder(racine) {
      const temoin = prefixe + TEMOIN;
      try {
        await fs.creerDossier(racine, dossier);
        await fs.supprimer(racine, temoin);
        await fs.ecrireAtomique(racine, temoin, TEMOIN);
        const relu = await fs.lireTexte(racine, temoin);
        await fs.supprimer(racine, temoin);
        if (relu !== TEMOIN) return { inscriptible: false, cause: 'RELECTURE_DIFFERENTE' };
        return { inscriptible: true, cause: null };
      } catch (erreur) {
        if (!(erreur instanceof ErreurStockage) || erreur.code === 'CHEMIN_REFUSE') throw erreur;
        return { inscriptible: false, cause: erreur.details.cause ?? erreur.code };
      }
    },
    async ouvrirDansExplorateur(racine, chemin = '') {
      const plein = dedans(chemin);
      return relayer(() => fs.ouvrirDansExplorateur(racine, plein));
    },
  };
  for (const nom of SANS_CHEMIN) vue[nom] = (...args) => fs[nom](...args);
  for (const nom of A_UN_CHEMIN) {
    vue[nom] = async (racine, chemin, ...reste) => {
      const plein = dedans(chemin);
      return relayer(() => fs[nom](racine, plein, ...reste));
    };
  }
  return vue;
}
