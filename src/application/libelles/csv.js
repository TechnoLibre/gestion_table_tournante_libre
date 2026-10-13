// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes de src/csv (§ 10.1, § 10.4, § 14.6) : encodage,
// séparateur, en-tête, refus d'une ligne, refus de la mise à jour, et ceux du
// CSV des objectifs de table, son import et son libellé d'historique.
import { ETIQUETTE_LONGUEUR_MAX, ETIQUETTES_MAX } from '../../stockage/etiquettes.js';
import { cite, compte, enumeration, nomDans } from './aides.js';

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
  ['AUCUN_ENTETE', () => "Aucun en-tête n'est reconnu : la première ligne nomme les colonnes du fichier."],
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
    ({ nombre }) => `La ligne porte ${nombre} étiquettes : une personne ou un objectif en porte ${ETIQUETTES_MAX} au plus.`,
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
  // --- Le CSV des objectifs de table (§ 10.4) -------------------------------
  ['TABLE_NON_ASSOCIEE', () => "Aucune colonne ne porte le numéro de table : l'en-tête doit compter une colonne « table »."],
  ['OBJECTIF_NON_ASSOCIE', () => "Aucune colonne ne porte l'objectif : l'en-tête doit compter une colonne « objectif »."],
  ['OBJECTIFS_SANS_TABLE', () => "L'événement n'a aucune table : créez les tables avant d'importer leurs objectifs."],
  [
    'OBJECTIFS_NUMEROS_PARTAGES',
    () =>
      'Chaque numéro de table est porté par plusieurs tables : aucune ligne du modèle ne dirait laquelle elle vise. Donnez aux tables des numéros distincts.',
  ],
  ['TABLE_ABSENTE', () => 'Le numéro de table manque.'],
  [
    'TABLE_NON_ENTIERE',
    ({ valeur }) => `${cite(valeur)} n'est pas un numéro de table : un entier, celui que la table affiche sur le plan.`,
  ],
  ['NUMERO_TABLE_INCONNU', ({ valeur }) => `Aucune table ne porte le numéro ${valeur}.`],
  [
    'PLUSIEURS_TABLES',
    ({ valeur }) => `Plusieurs tables portent le numéro ${valeur} : la ligne ne dit pas laquelle elle vise.`,
  ],
  ['TOUR_NON_ENTIER', ({ valeur }) => `${cite(valeur)} n'est pas un numéro de tour : un entier, ou vide pour la soirée.`],
  [
    'TOUR_HORS_SOIREE',
    ({ valeur, tours }) => `La soirée compte ${compte(tours, 'tour', 'tours')} : le tour ${valeur} n'en est pas un.`,
  ],
  ['OBJECTIF_VIDE', () => "L'objectif manque : au moins une étiquette."],
  [
    'REGLE_INCONNUE',
    ({ valeur }) =>
      `La règle ${cite(valeur)} n'est pas reconnue : ou, une, au moins une ; et, toutes ; ` +
      'vide pour suivre la règle par défaut.',
  ],
  [
    'OBJECTIF_EN_DOUBLE',
    ({ premiereLigne, numero, tour }) =>
      `La ligne ${premiereLigne} donne déjà l'objectif de la table ${numero} ` +
      `${tour === null ? 'pour la soirée' : `au tour ${tour}`} : rien n'est fusionné.`,
  ],
  [
    'IMPORT_OBJECTIFS_RECLASSE',
    () =>
      'Le plan est retenu : les objectifs importés peuvent changer le classement des propositions, ' +
      "sans qu'aucune passe en dérive.",
  ],
  [
    'ENTREE_IMPORTER_OBJECTIFS',
    ({ mode, ajoutes, remplaces, retires }) => {
      const ajoutesEtRemplaces = `${compte(ajoutes, 'ajouté', 'ajoutés')}, ${compte(remplaces, 'remplacé', 'remplacés')}`;
      if (mode === 'mettreAJour') return `Mis à jour les objectifs de table par import : ${ajoutesEtRemplaces}`;
      if (mode === 'remplacer') {
        return `Remplacé les objectifs de table par import : ${compte(retires, 'retiré', 'retirés')}, ${ajoutesEtRemplaces}`;
      }
      throw new RangeError(`libelle : mode d'import des objectifs inconnu ${JSON.stringify(mode)}`);
    },
  ],
]);
