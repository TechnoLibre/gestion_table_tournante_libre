// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le système de fichiers de la plateforme electron, côté page (§ 13.1,
// § 13.4) : l'une des deux exceptions nommées de la frontière des couches,
// qui lit le pont window.gtt. Chaque primitive appelle la fonction du même
// nom que electron/preload.cjs expose sous window.gtt.fichiers ; le
// processus principal l'exécute (electron/fichiers.js) et rend
// { ok: true, valeur }, ou { ok: false, code, details } pour un échec, dont
// une ErreurStockage de ce code et de ces détails prend ici la place : une
// erreur levée ne traverse pas l'IPC. Une faute de la coquille, qu'Electron
// rapporte par son seul message, se lève telle quelle.
//
// L'écriture atomique et le verrou du § 8.8 sont ceux de la coquille.
import { ErreurStockage } from './erreurs.js';

/**
 * Le système de fichiers de la plateforme electron.
 *
 * @param {Object<string, Function>} [pont]  une fonction par primitive, qui
 *        rend la réponse du processus principal ; window.gtt.fichiers par
 *        défaut
 * @returns {import('./systeme_fichiers.js').SystemeFichiers}
 */
export function creerFichiersElectron(pont = window.gtt.fichiers) {
  // La valeur de la réponse ; l'ErreurStockage d'un échec ; une TypeError
  // pour une réponse d'une autre forme.
  async function appeler(primitive, ...parametres) {
    const reponse = await pont[primitive](...parametres);
    if (reponse?.ok === true) return reponse.valeur;
    if (reponse?.ok === false && typeof reponse.code === 'string') {
      throw new ErreurStockage(reponse.code, reponse.details);
    }
    throw new TypeError(`réponse du pont illisible pour ${primitive}`);
  }

  return {
    nature: 'electron',
    renommageAtomique: true,
    verrouDisponible: true,
    emplacements: () => appeler('emplacements'),
    racines: () => appeler('racines'),
    choisirDossier: () => appeler('choisirDossier'),
    sonder: (racine) => appeler('sonder', racine),
    typeSupport: (racine) => appeler('typeSupport', racine),
    lireTexte: (racine, chemin) => appeler('lireTexte', racine, chemin),
    ecrireAtomique: (racine, chemin, texte) => appeler('ecrireAtomique', racine, chemin, texte),
    ajouterLigne: (racine, chemin, ligne) => appeler('ajouterLigne', racine, chemin, ligne),
    lister: (racine, dossier) => appeler('lister', racine, dossier),
    creerDossier: (racine, chemin) => appeler('creerDossier', racine, chemin),
    deplacer: (racine, de, vers) => appeler('deplacer', racine, de, vers),
    supprimer: (racine, chemin) => appeler('supprimer', racine, chemin),
    verrouiller: (racine, chemin, seance) => appeler('verrouiller', racine, chemin, seance),
    deverrouiller: (racine, chemin, seance) => appeler('deverrouiller', racine, chemin, seance),
    ouvrirDansExplorateur: (racine) => appeler('ouvrirDansExplorateur', racine),
    choisirFichierAImporter: () => appeler('choisirFichierAImporter'),
    enregistrerSous: (nomPropose, octets) => appeler('enregistrerSous', nomPropose, octets),
  };
}
