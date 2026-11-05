// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes des codes de src/csv (§ 10.1, § 10.4, § 14.6) : encodage,
// séparateur, en-tête, refus d'une ligne, présence comprise, refus de la mise
// à jour, aperçu calculé pour un autre nombre de tours, conflits
// d'organisation et inclusions fautifs, les logos qu'un import « remplacer »
// retire, et ceux du CSV des objectifs de table, son import et son libellé
// d'historique.
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

// Ce qui rend illisible une cellule de présence, par la raison que rend
// lirePresence (§ 10.1) : la suite de la phrase qui cite la cellule. Une
// date dit de mettre la colonne en texte, seul remède à un tableur qui
// convertit « 1-3 ».
const FAUTES_DE_PRESENCE = new Map([
  [
    'syntaxe',
    'ne se lit pas : des tours et des plages, comme « 1-3 », « 2, 3 » ou « tours 1 et 2 », ' +
      '« tous », ou vide pour tous les tours.',
  ],
  ['intervalle', 'porte une plage à rebours : le premier tour vient avant le dernier, comme « 1-3 ».'],
  [
    'date',
    'est une date : un tableur a changé la cellule. ' +
      'Mettez la colonne de la présence au format texte, puis saisissez de nouveau ses tours.',
  ],
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
    'ANIMATION_INCONNUE',
    ({ valeur }) =>
      `La valeur d'« animation réservée » ${cite(valeur)} n'est pas reconnue : ` +
      'oui, o, vrai, 1 ou x pour une personne à désigner animatrice ; non, n, faux, 0 ou vide sinon.',
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
    'PRESENCE_ILLISIBLE',
    ({ valeur, raison }) => `La présence ${cite(valeur)} ${nomDans(FAUTES_DE_PRESENCE, raison, 'raison')}`,
  ],
  [
    'PRESENCE_HORS_TOURS',
    ({ valeur, tour, tours }) =>
      `La présence ${cite(valeur)} nomme le tour ${tour} : la soirée compte ${compte(tours, 'tour', 'tours')}.`,
  ],
  [
    'APERCU_TOURS_CHANGES',
    ({ tours, toursApercu }) =>
      `Le nombre de tours a changé depuis l'aperçu (${toursApercu} → ${tours}) : relire le fichier pour refaire l'aperçu.`,
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
  // Un conflit fautif refuse le fichier entier (§ 10.1) : la cause nomme
  // l'organisation telle que la cellule l'écrit, et la ligne qui la porte.
  [
    'CONFLIT_ORGANISATION_INCONNUE',
    ({ ligne, organisation }) =>
      `L'organisation ${cite(organisation)} n'existe pas (ligne ${ligne}, colonne des conflits). Rien n'est importé.`,
  ],
  [
    'CONFLIT_ORGANISATION_PROPRE',
    ({ ligne, organisation }) =>
      `L'organisation ${cite(organisation)} est celle de la personne (ligne ${ligne}, colonne des conflits) : ` +
      "une personne ne nomme pas la sienne en conflit. Rien n'est importé.",
  ],
  // Une inclusion fautive refuse le fichier entier, comme un conflit
  // (§ 10.1) : la cause nomme l'organisation, ou la personne, telle que la
  // cellule l'écrit, et la ligne qui la porte.
  [
    'INCLUSION_ORGANISATION_INCONNUE',
    ({ ligne, organisation }) =>
      `L'organisation ${cite(organisation)} n'existe pas (ligne ${ligne}, colonne des inclusions d'organisation). ` +
      "Rien n'est importé.",
  ],
  [
    'INCLUSION_ORGANISATION_PROPRE',
    ({ ligne, organisation }) =>
      `L'organisation ${cite(organisation)} est celle de la personne (ligne ${ligne}, colonne des inclusions ` +
      "d'organisation) : une inclusion nomme une autre organisation que la sienne. Rien n'est importé.",
  ],
  [
    'INCLUSION_PARTICIPANT_INCONNU',
    ({ ligne, nom }) =>
      `Aucune personne ne s'appelle ${cite(nom)} (ligne ${ligne}, colonne des inclusions de participant) : ` +
      "une inclusion nomme une personne par son prénom et son nom. Rien n'est importé.",
  ],
  [
    'INCLUSION_PARTICIPANT_AMBIGU',
    ({ ligne, nom }) =>
      `Plusieurs personnes s'appellent ${cite(nom)} (ligne ${ligne}, colonne des inclusions de participant) : ` +
      "le nom ne dit pas laquelle rencontrer. Rien n'est importé.",
  ],
  [
    'INCLUSION_PARTICIPANT_SOI',
    ({ ligne, nom }) =>
      `${cite(nom)} est la personne de la ligne ${ligne} elle-même (colonne des inclusions de participant) : ` +
      "une inclusion nomme une autre personne. Rien n'est importé.",
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
  // Un import « remplacer » retire chaque participant, et le lien de logo
  // de ceux qui en portaient un : logos, leur nombre. Le fichier de l'image
  // reste, et le retour rend les liens (§ 8.3, § 10.1).
  [
    'IMPORT_LOGOS_RETIRES',
    ({ logos }) =>
      `Remplacer la liste a retiré ${compte(logos, 'logo', 'logos')} : le CSV n'en porte pas. ` +
      "Les images restent dans le dossier de l'événement, et « Défaire » rend les logos.",
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
