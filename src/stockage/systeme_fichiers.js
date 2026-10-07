// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
//   CHEMIN_REFUSE  {chemin}                  chemin absolu ou remontant, racine
//                                            inconnue
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
 * processus tourne sur la même machine, faux quand il y est mort, null quand
 * il tourne sur une autre machine. Un verrou qui ne se lit pas rend seance,
 * depuis et vivant à null.
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
 *           portable : data/ à côté de l'exécutable publié ; documents : le
 *           dossier du produit dans les Documents (§ 8.6)
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
 * @property {(r: Racine, de: string, vers: string) => Promise<void>} deplacer
 *           un fichier ; refuse une cible existante (EXISTE), comparée comme le
 *           système compare les noms, si bien que sans égard à la casse une
 *           autre casse du même nom est une cible existante ; ABSENT pour une
 *           source absente ; le dossier de la cible doit exister
 * @property {(r: Racine, chemin: string) => Promise<void>} supprimer
 *           un fichier ; un fichier absent n'est pas une faute
 * @property {(r: Racine, chemin: string, seance: string) => Promise<Verrou>} verrouiller
 *           création exclusive de {seance, pid, hote, depuis} : un verrou
 *           présent n'est jamais repris, fût-il de la même séance
 * @property {(r: Racine, chemin: string, seance: string) => Promise<void>} deverrouiller
 *           n'efface que le verrou de cette séance ; un verrou absent n'est
 *           pas une faute
 * @property {(r: Racine) => Promise<void>} ouvrirDansExplorateur
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
