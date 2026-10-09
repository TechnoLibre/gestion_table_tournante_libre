// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'assemblage des textes des écrans (§ 14.6). Un composant n'écrit aucune
// chaîne visible en dur : il les lit par la traduction, dont les tables
// d'écran sont sous libelles/, une par écran, réunies ici dans l'ordre
// alphabétique de leurs fichiers ; aucune table n'importe cet assemblage.
//
// libelleProvenance, aUnLibelle et titreAvecVersion lisent en français la
// table de la coquille : le bandeau, le titre de la fenêtre, l'essai de
// démarrage et le livrable les appellent sans connaître la traduction.
import { creerTraduction } from '../application/traduction.js';
import { TABLE as ACCUEIL } from './libelles/accueil.js';
import { TABLE as COMMUNS } from './libelles/communs.js';
import { TABLE as COQUILLE } from './libelles/coquille.js';
import { TABLE as DIAGNOSTIC } from './libelles/diagnostic.js';
import { TABLE as EVENEMENT } from './libelles/evenement.js';
import { TABLE as GENERATION } from './libelles/generation.js';
import { TABLE as IMPORT } from './libelles/import.js';
import { TABLE as IMPRESSION } from './libelles/impression.js';
import { TABLE as PARTICIPANTS } from './libelles/participants.js';
import { TABLE as PLAN } from './libelles/plan.js';
import { TABLE as PROPOSITIONS } from './libelles/propositions.js';
import { TABLE as RACCOURCIS } from './libelles/raccourcis.js';
import { TABLE as TABLES } from './libelles/tables.js';

/** Les tables de libelles/, dans l'ordre alphabétique de leurs fichiers. */
export const TABLES_INTERFACE = Object.freeze([
  ACCUEIL,
  COMMUNS,
  COQUILLE,
  DIAGNOSTIC,
  EVENEMENT,
  GENERATION,
  IMPORT,
  IMPRESSION,
  PARTICIPANTS,
  PLAN,
  PROPOSITIONS,
  RACCOURCIS,
  TABLES,
]);

const { t } = creerTraduction(TABLES_INTERFACE);

// La clé de la provenance d'un mode de Vite (§ 18.6). La table est une Map :
// elle ne répond qu'aux clés qu'on y a posées, et un mode nommé comme une
// propriété héritée d'Object n'en trouve aucune.
const cleProvenance = (mode) => `coquille.provenance.${mode}`;

// Vrai quand le mode a un libellé déclaré. Comparer libelleProvenance(mode) à
// mode ne le dit pas : « livraison » et « documentation » ont un libellé
// identique à leur nom.
export function aUnLibelle(mode) {
  return COQUILLE.has(cleProvenance(mode));
}

// Libellé de la provenance pour un mode de Vite. Un mode sans libellé, comme
// celui d'un « vite build » lancé sans --mode, s'affiche sous son propre nom.
export function libelleProvenance(mode) {
  return aUnLibelle(mode) ? t(cleProvenance(mode)) : mode;
}

// Nom de l'application suivi de la version affichée : texte du bandeau et
// titre de la fenêtre (§ 18.6).
export function titreAvecVersion(version) {
  return t('coquille.titre', { version });
}
