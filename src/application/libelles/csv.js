// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes de src/csv (§ 10.1, § 14.6) : encodage, séparateur,
// en-tête, refus d'une ligne, refus de la mise à jour.
import { ETIQUETTE_LONGUEUR_MAX, ETIQUETTES_MAX } from '../../stockage/etiquettes.js';
import { cite, enumeration, nomDans } from './aides.js';

// Le remède commun aux refus d'encodage (§ 10.1).
const REMEDE_UTF8 = 'Réenregistrez le fichier en UTF-8 depuis le tableur, puis importez-le de nouveau.';
const refusEncodage = (constat) => () => `${constat} ${REMEDE_UTF8}`;

// Ce qui rend fautive une étiquette, par la raison que rend lireEtiquettes
// (§ 4.5).
const FAUTES_D_ETIQUETTE = new Map([
  ['longueur', `dépasse ${ETIQUETTE_LONGUEUR_MAX} caractères`],
  ['controle', 'porte un caractère de contrôle ou invisible, tabulation comprise'],
]);

export const TABLE = new Map([
  // --- Le CSV (§ 10.1) -------------------------------------------------------
  ['UTF16_SANS_MARQUE', refusEncodage("Le fichier semble encodé en UTF-16, sans la marque qui l'annonce.")],
  ['UTF16_INVALIDE', refusEncodage("Le fichier s'annonce en UTF-16, mais ses octets ne le sont pas.")],
  ['UTF8_INVALIDE', refusEncodage("Le fichier s'annonce en UTF-8, mais ses octets ne le sont pas.")],
  ['CARACTERE_NUL', refusEncodage("Le texte porte un caractère nul, qu'aucune liste ne contient.")],
  ['ENREGISTRER_EN_UTF8', () => REMEDE_UTF8],
  [
    'SEPARATEUR_INTROUVABLE',
    ({ ligne, cause }, texte) => {
      const constat = 'Aucun séparateur ne convient : ni le point-virgule, ni la virgule, ni la tabulation.';
      if (ligne === null || ligne === undefined) return constat;
      const ecart = texte(cause === 'GUILLEMET_OUVERT' ? 'GUILLEMET_OUVERT' : 'NOMBRE_DE_CHAMPS', { ligne });
      return `${constat} ${ecart}`;
    },
  ],
  ['NOMBRE_DE_CHAMPS', ({ ligne }) => `Avec chacun, la ligne ${ligne} n'a pas le nombre de champs de l'en-tête.`],
  [
    'GUILLEMET_OUVERT',
    ({ ligne }) =>
      `Un guillemet ouvert${Number.isInteger(ligne) ? ` à la ligne ${ligne}` : ''} ne se referme pas : ` +
      'tout ce qui le suit tiendrait dans un seul champ.',
  ],
  ['AUCUN_ENTETE', () => "Aucun en-tête n'est reconnu : la première ligne nomme les colonnes, « nom » au moins."],
  ['NOM_NON_ASSOCIE', () => "Aucune colonne ne porte le nom : l'en-tête doit compter une colonne « nom »."],
  ['AUCUNE_LIGNE_VALIDE', () => "Aucune ligne n'est valide : rien n'est importé."],
  ['CHAMPS_EN_TROP', () => "La ligne compte plus de champs que l'en-tête."],
  ['NOM_ABSENT', () => 'Le nom manque.'],
  [
    'EXCLU_INCONNU',
    ({ valeur }) =>
      `La valeur d'« exclu » ${cite(valeur)} n'est pas reconnue : ` +
      'oui, o, vrai, 1 ou x pour exclure ; non, n, faux, 0 ou vide sinon.',
  ],
  [
    'ETIQUETTE_MAL_FORMEE',
    ({ valeur, raison }) =>
      `L'étiquette ${cite(valeur)} ${nomDans(FAUTES_D_ETIQUETTE, raison, 'raison')} : ` +
      'corrigez-la, puis importez la ligne de nouveau.',
  ],
  [
    'ETIQUETTES_TROP_NOMBREUSES',
    ({ nombre }) => `La ligne porte ${nombre} étiquettes : une personne en porte ${ETIQUETTES_MAX} au plus.`,
  ],
  [
    'PLUSIEURS_CORRESPONDENT',
    ({ participants }) =>
      'Plusieurs personnes de la liste correspondent à cette ligne ' +
      `(${enumeration(participants.map((id) => `n° ${id}`))}) : rien n'est fusionné.`,
  ],
  [
    'DEJA_DESIGNE',
    ({ premiereLigne }) => `La ligne ${premiereLigne} désigne déjà cette personne : rien n'est fusionné.`,
  ],
  ['PLAN_BLOQUE', () => 'Le plan est bloqué : « Débloquer » le rend de nouveau modifiable.'],
  [
    'AMBIGUITE',
    ({ champs }) =>
      `Plusieurs colonnes répondent au même champ (${enumeration(champs)}) : choisissez celle qui s'importe.`,
  ],
]);
