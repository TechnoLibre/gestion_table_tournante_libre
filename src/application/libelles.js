// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La table des textes de l'application (§ 14.6) : chaque code que lèvent ou
// rendent src/stockage, src/csv et src/application — refus, avertissements,
// raisons, causes et remèdes de leurs détails — et chaque libellé figé d'une
// entrée ou d'un jalon du journal a ici son texte français, qu'une fonction
// compose de ses détails. Un code sans texte lève : l'écran ne montre jamais
// un code brut. Une valeur codée d'un détail — état, champ, mode, échec —
// que la table ne connaît pas lève aussi, au lieu de se taire. Une raison
// qu'un texte ne traite pas à part ne lève jamais : une phrase générique la
// nomme, par son texte quand la table en porte un, telle quelle sinon. Une
// cause que nomme le système, EROFS, ENOENT ou TypeMismatchError, n'est pas
// un code de l'application : les textes la citent telle quelle, entre
// parenthèses ; une cause que la table porte s'y lit par son texte.
//
// Un libellé d'entrée se compose une fois, à l'écriture du geste, et le
// journal en garde le texte, jamais le code (§ 8.2) : changer un texte ici ne
// change aucun libellé déjà écrit.
//
// Les textes ne lisent ni l'horloge ni la langue du système : un horodatage
// se met en mots à partir de sa seule forme, AAAA-MM-JJTHH:MM:SS±HH:MM.

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const NOMS_DES_ETATS = new Map([
  ['brouillon', 'Brouillon'],
  ['propose', 'Proposé'],
  ['retenu', 'Retenu'],
  ['bloque', 'Bloqué'],
]);

// Les champs d'un participant qu'une saisie modifie, dans l'ordre du fichier.
const NOMS_DES_CHAMPS = new Map([
  ['nom', 'nom'],
  ['prenom', 'prénom'],
  ['appartenance', 'appartenance'],
  ['courriel', 'courriel'],
  ['titrePressenti', 'titre pressenti'],
  ['notes', 'notes'],
]);

const MOIS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

// Valeur d'une table de noms, ou RangeError qui la nomme.
function nomDans(table, valeur, quoi) {
  if (!table.has(valeur)) throw new RangeError(`libelle : ${quoi} inconnu ${JSON.stringify(valeur)}`);
  return table.get(valeur);
}
const nomEtat = (etat) => nomDans(NOMS_DES_ETATS, etat, 'état');
const nomChamp = (champ) => nomDans(NOMS_DES_CHAMPS, champ, 'champ');

// Un texte cité entre guillemets français.
const cite = (texte) => `« ${texte} »`;
// Une cause entre parenthèses, rien quand elle manque : son texte quand la
// table en porte un, sinon la cause telle que le système la nomme.
function causeEntreParentheses(cause) {
  if (cause === null || cause === undefined || cause === '') return '';
  return ` (${TEXTES.has(cause) ? texteDe(cause) : cause})`;
}
// Le chemin de l'élément fautif, rien quand il manque ou désigne la racine.
const element = (chemin) => (typeof chemin === 'string' && chemin !== '' ? ` (${chemin})` : '');
// Un compte et son nom, au singulier jusqu'à un, comme le veut le français.
const compte = (n, singulier, pluriel) => `${n} ${n <= 1 ? singulier : pluriel}`;
// Une énumération : « a », « a et b », « a, b et c ».
function enumeration(termes) {
  if (termes.length <= 1) return termes.join('');
  return `${termes.slice(0, -1).join(', ')} et ${termes.at(-1)}`;
}
// Des numéros de proposition, un illisible nommé comme tel.
const numeros = (ids) => enumeration(ids.map((id) => (id === null ? 'sans numéro lisible' : `n° ${id}`)));
// La première lettre en capitale.
const capitale = (texte) => texte.charAt(0).toUpperCase() + texte.slice(1);

// Un horodatage AAAA-MM-JJTHH:MM:SS±HH:MM en mots, « le 17 mai 2031 à 8 h 05 »,
// à l'heure qu'il porte ; une autre forme se cite telle quelle.
const HORODATAGE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}[+-]\d{2}:\d{2}$/;
function moment(horodatage) {
  const morceaux = HORODATAGE.exec(String(horodatage));
  if (morceaux === null) return String(horodatage);
  const [annee, mois, jour, heure, minute] = morceaux.slice(1).map(Number);
  if (mois < 1 || mois > 12) return String(horodatage);
  const quantieme = jour === 1 ? '1er' : String(jour);
  return `le ${quantieme} ${MOIS[mois - 1]} ${annee} à ${heure} h ${String(minute).padStart(2, '0')}`;
}
const depuisQuand = (depuis) => (depuis === null || depuis === undefined ? '' : ` depuis ${moment(depuis)}`);

// Le chemin affichable d'une racine, reçue entière ou par son seul chemin.
const cheminDe = (racine) => (typeof racine === 'string' ? racine : racine?.chemin);

// Le remède commun aux refus d'encodage (§ 10.1).
const REMEDE_UTF8 = 'Réenregistrez le fichier en UTF-8 depuis le tableur, puis importez-le de nouveau.';
const refusEncodage = (constat) => () => `${constat} ${REMEDE_UTF8}`;

// Une raison codée en une phrase : son texte quand la table en porte un et
// que les détails reçus lui suffisent ; sinon une phrase générique qui la
// cite telle quelle. Un texte qui attend ses propres détails lève ou rend
// « undefined » sans eux : la phrase générique le remplace alors.
function phraseDeRaison(raison, details = {}) {
  const generique = `La raison donnée est ${cite(String(raison))}.`;
  if (!TEXTES.has(raison)) return generique;
  try {
    const texte = texteDe(raison, details);
    return typeof texte === 'string' && !texte.includes('undefined') ? texte : generique;
  } catch {
    return generique;
  }
}

// La raison d'un fichier d'état illisible, en une phrase.
function raisonIllisible({ raison, ...details }) {
  if (raison === 'ABSENT') return "Le fichier d'état manque, à côté de son historique.";
  return phraseDeRaison(raison, details);
}

// Les secours d'un fichier d'état illisible, quand l'erreur les nomme.
function secoursDe(secours) {
  if (secours === undefined || secours === null) return '';
  const offerts = [];
  if (secours.precedent !== null) offerts.push(`la version précédente du fichier (révision ${secours.precedent})`);
  if (secours.journal !== null) offerts.push(`le dernier instant de l'historique (révision ${secours.journal})`);
  if (offerts.length === 0) return ' Aucune version de secours ne se lit.';
  return ` ${capitale(enumeration(offerts))} ${offerts.length === 1 ? 'peut' : 'peuvent'} se rouvrir.`;
}

// Ce qu'une dérive touche, du retenu aux propositions, et l'accord du verbe.
function touchees({ ids, retenu }) {
  const parties = [];
  if (retenu) parties.push('le placement retenu');
  if (ids.length === 1) parties.push(`la proposition n° ${ids[0]}`);
  if (ids.length > 1) parties.push(`les propositions n° ${enumeration(ids.map(String))}`);
  return { texte: capitale(enumeration(parties)), pluriel: (retenu ? 1 : 0) + ids.length > 1 };
}

// Les titres de place qu'un geste sur une personne touche, quand il y en a.
const titresDe = (n, singulier, pluriel) =>
  n > 0 ? `, et ${compte(n, 'titre de place', 'titres de place')} ${n <= 1 ? singulier : pluriel}` : '';

// Ce qu'un refus d'écriture nomme : le fichier, son dossier, la cause.
const ouEcrire = ({ chemin, dossier, cause }) =>
  `${cite(chemin)} dans le dossier ${cite(dossier)}${causeEntreParentheses(cause)}`;

const TEXTES = new Map([
  // --- Le système de fichiers et le dépôt (src/stockage/types.js) ---------
  [
    'ABSENT',
    ({ chemin }) =>
      typeof chemin === 'string' ? `Le fichier ${cite(chemin)} est introuvable.` : "Le fichier d'état manque.",
  ],
  ['ECRITURE', (details) => `L'écriture de ${ouEcrire(details)} a échoué ; le fichier d'avant reste intact.`],
  ['LECTURE', (details) => `La lecture de ${ouEcrire(details)} est refusée.`],
  ['EXISTE', ({ chemin }) => `Un fichier ${cite(chemin)} existe déjà.`],
  ['CHEMIN_REFUSE', ({ chemin }) => `Le chemin ${cite(String(chemin))} est refusé.`],
  [
    'ETAT_ILLISIBLE',
    (details) => {
      const sujet = typeof details.base === 'string' ? `Le fichier d'état de ${cite(details.base)}` : 'Le fichier';
      return `${sujet} ne s'ouvre pas. ${raisonIllisible(details)}${secoursDe(details.secours)}`;
    },
  ],
  ['CORRECTIF', ({ rang }) => `Un correctif de l'historique ne s'applique pas (opération ${rang}).`],
  [
    'CHEMIN_TROP_LONG',
    ({ racine }) =>
      `Le dossier ${cite(cheminDe(racine))} est trop profond : aucun nom de fichier n'y tient ` +
      'sous la longueur de chemin que Windows accepte.',
  ],
  [
    'IDENTIFIANT_PRESENT',
    ({ base }) =>
      `Cet événement est déjà dans ce dossier, sous ${cite(base)} : ` +
      "l'y placer une seconde fois en ferait deux copies de même identifiant.",
  ],
  [
    'VERROU_PRIS',
    ({ depuis, vivant }) => {
      if (vivant === true) {
        return `Une autre séance modifie cet événement${depuisQuand(depuis)} : il reste en lecture ici.`;
      }
      if (vivant === false) {
        return (
          `Une séance interrompue a laissé son verrou${depuisQuand(depuis)}, et il n'a pas pu se reprendre : ` +
          "l'événement reste en lecture."
        );
      }
      return (
        `Un verrou d'un autre poste, ou illisible, tient cet événement${depuisQuand(depuis)} : ` +
        'il reste en lecture ici, et rien ne le reprend seul.'
      );
    },
  ],
  [
    'LECTURE_SEULE',
    ({ raison }) => {
      if (raison === 'BLOQUE') {
        return `${texteDe('BLOQUE')} Rien ne peut changer ; « Débloquer » le rend de nouveau modifiable.`;
      }
      if (raison === 'FORMAT' || raison === 'FORMAT_PLUS_RECENT') {
        return `${texteDe(raison)} Il s'ouvre en lecture seule, et aucun geste ne le modifie ici.`;
      }
      if (raison === 'ENCODAGE') {
        return (
          `Le fichier d'état a changé sur le disque. ${texteDe('ENCODAGE')} ` +
          "L'événement reste en lecture seule ; rouvert par une version de secours, son premier geste " +
          "range ce fichier dans la corbeille avant d'écrire l'état."
        );
      }
      return `${phraseDeRaison(raison)} L'événement reste en lecture seule, et aucun geste ne le modifie ici.`;
    },
  ],
  [
    'ETAT_NON_ECRIT',
    (details) => `Le geste est inscrit à l'historique, mais l'état ${ouEcrire(details)} n'a pas pu s'écrire.`,
  ],
  [
    'CORBEILLE_SATUREE',
    ({ dossier }) =>
      `La corbeille ${cite(dossier)} a reçu trop de suppressions dans la même seconde : ` +
      'la suppression se refait une seconde plus tard.',
  ],
  [
    'COMPTEUR_SATURE',
    ({ compteur }) =>
      `Les numéros ${compteur === 'proposition' ? 'de proposition' : `du compteur ${cite(compteur)}`} sont épuisés : ` +
      'rien de neuf ne se numérote plus dans cet événement.',
  ],
  ['NON_DISPONIBLE', ({ cause }) => `Cette commande n'est pas offerte ici${causeEntreParentheses(cause)}.`],

  // --- Les raisons d'un fichier illisible ----------------------------------
  ['VIDE', () => 'Le fichier est vide.'],
  ['JSON', () => "Le texte n'est pas du JSON valide."],
  ['FORME', ({ chemin }) => `Une valeur sort de sa règle${element(chemin)}.`],
  ['COMPTES', ({ chemin }) => `Un compte de l'en-tête contredit sa liste${element(chemin)}.`],
  ['REFERENCE', ({ chemin }) => `Une réservation ou un titre désigne ce qui n'existe pas${element(chemin)}.`],
  ['FORMAT_INCONNU', () => "Le format du fichier n'est pas reconnu."],
  [
    'FORMAT_PLUS_RECENT',
    ({ format }) => {
      const quel = Number.isInteger(format) ? ` (format ${format})` : '';
      return `Ce fichier vient d'une version plus récente du logiciel${quel}.`;
    },
  ],
  [
    'ENCODAGE',
    () => "Ses octets ne sont pas de l'UTF-8 : un éditeur l'a sans doute réenregistré dans un autre encodage.",
  ],

  // --- Les fautes d'un placement, et ses raisons de dérive (§ 8.9, § 9) ----
  [
    'LONGUEUR',
    ({ tour, table, declare, ecrit }) => {
      if (tour === null) return `Le placement déclare ${compte(declare, 'tour', 'tours')} et en porte ${ecrit}.`;
      if (table === null) {
        return `Au tour ${tour}, le placement déclare ${compte(declare, 'table', 'tables')} et en porte ${ecrit}.`;
      }
      return (
        `Au tour ${tour}, la table ${table} reçoit ${compte(ecrit, 'personne', 'personnes')} ` +
        `pour ${compte(declare, 'place', 'places')}.`
      );
    },
  ],
  ['DOUBLON', ({ tour, participant }) => `Au tour ${tour}, la personne n° ${participant} est placée plus d'une fois.`],
  [
    'INCONNU',
    ({ tour, participant }) => `Au tour ${tour}, la personne n° ${participant} est placée sans être déclarée.`,
  ],
  ['MANQUANT', ({ tour, participant }) => `Au tour ${tour}, la personne n° ${participant} n'est placée nulle part.`],
  ['IDENTIFIANT_REPETE', () => 'Une autre proposition porte déjà ce numéro.'],
  ['IDENTIFIANT_HORS_COMPTEUR', () => 'Ce numéro de proposition dépasse le compteur du fichier.'],
  ['PARTICIPANT_EXCLU', ({ participant }) => `La personne n° ${participant} est exclue depuis.`],
  ['PARTICIPANT_SUPPRIME', ({ participant }) => `La personne n° ${participant} a été supprimée depuis.`],
  [
    'PARTICIPANT_NON_PLACE',
    ({ participant }) => `La personne n° ${participant}, ajoutée ou réintégrée depuis, n'y est pas placée.`,
  ],
  ['TABLE_SUPPRIMEE', ({ table }) => `La table d'identifiant ${table} a été supprimée depuis.`],
  ['TABLE_AJOUTEE', ({ table }) => `La table d'identifiant ${table} a été ajoutée depuis.`],
  [
    'CAPACITE_CHANGEE',
    ({ table, avant, maintenant }) =>
      `La table d'identifiant ${table} est passée de ${avant} à ${compte(maintenant, 'place', 'places')}.`,
  ],
  ['TOURS_CHANGES', ({ avant, maintenant }) => `Le nombre de tours est passé de ${avant} à ${maintenant}.`],

  // --- Ce que l'ouverture annonce (§ 8.6, § 8.8, § 8.9, § 9) ---------------
  ['RETENU_FAUTIF', () => 'Le placement retenu se contredit : la version précédente du fichier peut le reprendre.'],
  ['JOURNAL_REPRIS', () => "Le dernier geste, inscrit à l'historique mais pas dans l'état, est repris."],
  [
    'JOURNAL_EN_AVANCE_DE',
    ({ n }) =>
      `L'historique compte ${compte(n, 'geste', 'gestes')} de plus que l'état : ` +
      "l'état du disque est affiché, et le prochain geste inscrit une reprise.",
  ],
  [
    'JOURNAL_INCOMPLET',
    ({ etat, journal }) =>
      `L'historique s'arrête à la révision ${journal}, l'état est à la révision ${etat} : ` +
      'le prochain geste inscrit une reprise.',
  ],
  [
    'JOURNAL_ECARTEES',
    ({ n }) =>
      `${compte(n, 'entrée', 'entrées')} de l'historique ${n <= 1 ? 'est écartée' : 'sont écartées'}, ` +
      'à partir de la première ligne illisible.',
  ],
  [
    'JOURNAL_RECREE',
    () =>
      "Le fichier de l'historique avait disparu du dossier : il est réécrit en entier, " +
      'tel que la séance le connaissait.',
  ],
  [
    'JOURNAL_FORMAT_PLUS_RECENT',
    ({ format }) =>
      `L'historique vient d'une version plus récente du logiciel (format ${format}) : ` +
      "il ne se lit pas, et l'événement reste en lecture seule.",
  ],
  [
    'JOURNAL_ILLISIBLE',
    ({ raison }) =>
      `L'historique à côté de ce fichier ne se lit pas. ${phraseDeRaison(raison)} ` +
      "Il est laissé tel quel, et le prochain geste commence l'historique dans un nouveau fichier.",
  ],
  [
    'JOURNAL_ETRANGER',
    ({ evenement }) =>
      `L'historique à côté de ce fichier appartient à un autre événement (${evenement}) : il est ignoré.`,
  ],
  [
    'PROPOSITIONS_FAUTIVES',
    ({ ids }) =>
      ids.length <= 1
        ? `Une proposition incohérente est écartée (${numeros(ids)}).`
        : `${ids.length} propositions incohérentes sont écartées (${numeros(ids)}).`,
  ],
  [
    'PROPOSITIONS_MANQUANTES',
    ({ n }) =>
      `${compte(n, "proposition que l'en-tête annonce manque", "propositions que l'en-tête annonce manquent")} ` +
      'dans le fichier : celles qu\'il porte sont gardées.',
  ],
  [
    'DERIVE',
    (details) => {
      const { texte, pluriel } = touchees(details);
      return pluriel
        ? `${texte} ne décrivent plus la liste ou les tables actuelles : ils sont gardés, et rien n'est effacé.`
        : `${texte} ne décrit plus la liste ou les tables actuelles : il est gardé, et rien n'est effacé.`;
    },
  ],

  // --- Le dossier de travail, les réglages locaux (§ 8.5, § 8.6, § 8.8) ----
  ['NON_PUBLIE', () => "Le dossier de l'exécutable n'est pas connu : les événements se rangent dans les Documents."],
  [
    'DONNEES_APPLICATIVES',
    () => "L'exécutable est rangé sous les données applicatives : les événements se rangent dans les Documents.",
  ],
  [
    'SONDE_ECHOUEE',
    ({ cause }) =>
      `Le dossier data à côté de l'exécutable refuse l'écriture${causeEntreParentheses(cause)} : ` +
      'les événements se rangent dans les Documents.',
  ],
  // Une cause de la sonde, que les textes citent entre parenthèses.
  ['RELECTURE_DIFFERENTE', () => "le fichier d'essai relu ne porte pas ce qui vient d'y être écrit"],
  [
    'PORTABLE_NON_INSCRIPTIBLE',
    ({ racine, evenements, cause }) => {
      const porte =
        evenements === null
          ? 'porte peut-être des événements'
          : `porte ${compte(evenements, 'événement', 'événements')}`;
      return `Le dossier ${cite(cheminDe(racine))} ${porte}, mais refuse l'écriture${causeEntreParentheses(cause)}.`;
    },
  ],
  [
    'DOCUMENTS_NON_INSCRIPTIBLE',
    ({ racine, cause }) =>
      `Le dossier de travail ${cite(cheminDe(racine))} refuse l'écriture${causeEntreParentheses(cause)} : ` +
      "aucun geste ne s'y enregistrerait.",
  ],
  [
    'PLATEFORME_WEB',
    () =>
      "Sous la plateforme web, ni le renommage atomique ni le verrou n'existent : " +
      'une panne peut laisser un fichier incomplet, et deux onglets peuvent écrire le même événement.',
  ],
  // dossier, quand il est donné, nomme le dossier où la séance écrit
  // désormais (ecrireAilleurs) ; sans lui, le dossier de travail.
  [
    'SUPPORT_AMOVIBLE',
    ({ dossier }) =>
      `${typeof dossier === 'string' ? `Le dossier ${cite(dossier)}` : 'Le dossier de travail'} ` +
      'est sur un support amovible : retirer le support pendant une écriture peut la laisser incomplète.',
  ],
  [
    'REGLAGES_ILLISIBLES',
    ({ chemin, raison }) => {
      const pourquoi =
        raison === 'JSON' || raison === 'FORME' ? texteDe(raison) : `La lecture est refusée (${raison}).`;
      return `Les réglages locaux ${cite(chemin)} ne se lisent pas. ${pourquoi} Les valeurs par défaut s'appliquent.`;
    },
  ],

  // --- Le CSV (§ 10.1) -------------------------------------------------------
  ['UTF16_SANS_MARQUE', refusEncodage("Le fichier semble encodé en UTF-16, sans la marque qui l'annonce.")],
  ['UTF16_INVALIDE', refusEncodage("Le fichier s'annonce en UTF-16, mais ses octets ne le sont pas.")],
  ['UTF8_INVALIDE', refusEncodage("Le fichier s'annonce en UTF-8, mais ses octets ne le sont pas.")],
  ['CARACTERE_NUL', refusEncodage("Le texte porte un caractère nul, qu'aucune liste ne contient.")],
  ['ENREGISTRER_EN_UTF8', () => REMEDE_UTF8],
  [
    'SEPARATEUR_INTROUVABLE',
    ({ ligne, cause }) => {
      const constat = 'Aucun séparateur ne convient : ni le point-virgule, ni la virgule, ni la tabulation.';
      if (ligne === null || ligne === undefined) return constat;
      const ecart = texteDe(cause === 'GUILLEMET_OUVERT' ? 'GUILLEMET_OUVERT' : 'NOMBRE_DE_CHAMPS', { ligne });
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

  // --- La séance (§ 8.3, § 8.4, § 8.5, § 8.6, § 8.8) -------------------------
  ['AUCUN_EVENEMENT', () => "Aucun événement n'est ouvert."],
  ['MODE_LECTURE', () => "L'événement est ouvert en lecture : « Modifier » permet de le changer."],
  ['FORMAT', (details) => texteDe('FORMAT_PLUS_RECENT', details)],
  ['BLOQUE', () => 'Le plan est bloqué.'],
  // echec nomme ce que le support n'a pas reçu : la ligne d'un geste
  // (ECRITURE), l'état d'un geste inscrit au journal (ETAT_NON_ECRIT), le
  // jalon d'un geste enregistré (JALON_NON_ECRIT), ou le verrou d'un passage
  // en écriture (VERROU_NON_ECRIT), qui ne perd rien.
  [
    'SUPPORT_ROMPU',
    ({ echec, ...details }) => {
      const refus = `Le support ne prend plus les écritures : ${ouEcrire(details)} n'a pas pu s'écrire`;
      const ailleurs = "« Écrire ailleurs » enregistre l'événement dans un autre dossier.";
      if (echec === 'ECRITURE' || echec === 'ETAT_NON_ECRIT') {
        const perte =
          echec === 'ETAT_NON_ECRIT'
            ? "le dernier geste est inscrit à l'historique, mais pas dans l'état"
            : "le dernier geste n'est pas enregistré";
        return `${refus}, et ${perte}. Sur ce support, l'historique et l'état ne se correspondent plus ; ${ailleurs}`;
      }
      if (echec === 'JALON_NON_ECRIT') {
        return (
          `${refus}. Le dernier geste est enregistré, mais pas le jalon qui le nomme, ` +
          `et aucun geste ne s'y enregistrerait plus ; ${ailleurs}`
        );
      }
      if (echec === 'VERROU_NON_ECRIT') {
        return (
          `${refus}. L'événement y reste tel qu'il s'affiche, ` +
          `mais aucun geste ne s'y enregistrerait ; ${ailleurs}`
        );
      }
      throw new RangeError(`libelle : échec du support inconnu ${JSON.stringify(echec)}`);
    },
  ],
  ['SUPPORT_INTACT', () => "Le support prend encore les écritures : l'événement reste où il est."],
  // Quitter l'événement d'un support rompu : la séance tient la seule copie
  // que l'écriture ailleurs peut encore sauver ; ETAT_NON_ECRIT dit que son
  // dernier geste n'est qu'à l'historique de ce support.
  [
    'SUPPORT_ROMPU_NON_SAUVE',
    ({ echec, dossier }) => {
      const geste =
        echec === 'ETAT_NON_ECRIT' ? ", et son dernier geste n'y est inscrit qu'à l'historique" : '';
      return (
        `Le support ${cite(dossier)} ne prend plus les écritures${geste} : ` +
        "l'événement ouvert n'est sauvé dans aucun autre dossier. " +
        "« Écrire ailleurs » l'enregistre d'abord ; le quitter maintenant l'abandonne à ce support."
      );
    },
  ],
  [
    'EVENEMENT_CHANGE',
    ({ revision }) =>
      `Une autre séance a modifié cet événement depuis son ouverture : il s'affiche tel qu'elle l'a laissé, ` +
      `à la révision ${revision}, et les gestes suivants s'y ajoutent.`,
  ],
  [
    'VERROU_REPRIS',
    ({ depuis }) => `Le verrou qu'une séance interrompue de ce poste avait laissé${depuisQuand(depuis)} est repris.`,
  ],
  [
    'VERROU_NON_RENDU',
    ({ cause }) =>
      `Le verrou de l'événement n'a pas pu être rendu${causeEntreParentheses(cause)} : ` +
      'une autre séance de ce poste le reprendra une fois ce logiciel fermé.',
  ],
  ['RIEN_A_DEFAIRE', () => "Rien à défaire : l'historique commence à cet instant."],
  ['RIEN_A_REFAIRE', () => 'Rien à refaire : seul un retour se refait, tant que nul geste ne le suit.'],
  ['INSTANT_NON_RESTITUABLE', ({ revision }) => `L'historique ne restitue plus l'instant ${revision}.`],
  ['PLAN_NON_BLOQUE', () => "Le plan n'est pas bloqué : il n'y a rien à débloquer."],
  [
    'JALON_NON_ECRIT',
    ({ dossier, cause }) =>
      `Le geste est enregistré, mais le jalon qui le nomme n'a pas pu s'écrire ` +
      `dans le dossier ${cite(dossier)}${causeEntreParentheses(cause)}.`,
  ],
  ['SANS_EFFET', () => "Ce geste ne change rien : rien n'est enregistré."],

  // --- Les refus et les avertissements des commandes (§ 4.4, § 9, § 10.2) ---
  ['NOM_REQUIS', () => 'Le nom est obligatoire.'],
  ['DATE_INVALIDE', ({ date }) => `La date ${cite(String(date))} n'est pas un jour du calendrier, écrit AAAA-MM-JJ.`],
  ['SIEGES_INVALIDES', () => 'Une table compte au moins deux sièges.'],
  ['TOURS_INVALIDES', () => 'La soirée compte au moins un tour.'],
  ['PARTICIPANT_INCONNU', ({ id }) => `La personne n° ${id} n'est pas dans cet événement.`],
  ['PROPOSITION_INCONNUE', ({ id }) => `La proposition n° ${id} n'est pas dans cet événement.`],
  ['AUCUNE_PROPOSITION', () => "Aucune proposition n'existe : l'état « Proposé » suit une génération."],
  ['AUCUN_RETENU', () => "Aucun placement n'est retenu : l'état « Retenu » suit le choix d'une proposition."],
  [
    'RESERVATIONS_SUSPENDUES',
    ({ personne, reservations, titres }) =>
      `Exclusion de ${personne} : ${compte(reservations, 'réservation suspendue', 'réservations suspendues')}, ` +
      `ses places reviennent aux autres${titresDe(titres, "n'est plus pourvu", 'ne sont plus pourvus')}.`,
  ],
  [
    'RESERVATIONS_RETABLIES',
    ({ personne, reservations, titres }) =>
      `Réintégration de ${personne} : ${compte(reservations, 'réservation rétablie', 'réservations rétablies')}` +
      `${titresDe(titres, 'de nouveau pourvu', 'de nouveau pourvus')}.`,
  ],
  [
    'RESERVATIONS_RETIREES',
    ({ personne, reservations, titres }) =>
      `Suppression de ${personne} : ${compte(reservations, 'réservation retirée', 'réservations retirées')}` +
      `${titresDe(titres, "n'est plus pourvu", 'ne sont plus pourvus')}.`,
  ],
  [
    'IMPORT_EN_RETENU',
    () =>
      "L'import change la liste après le choix d'un placement : le placement retenu est gardé tel quel, " +
      "et rien n'est effacé ; à vous de juger s'il convient encore.",
  ],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['ENTREE_CREATION', ({ nom }) => `Création de l'événement ${cite(nom)}`],
  ['JALON_CREATION', () => 'Création'],
  ['JALON_ETAT', ({ etat }) => `État ${cite(nomEtat(etat))}`],
  ['JALON_AVANT_GENERATION', () => 'Avant la génération'],
  ['ENTREE_REPRISE', () => "Reprise de l'état trouvé sur le disque"],
  ['ENTREE_DEFAIRE', ({ libelle: instant }) => `Défait : ${cite(instant)}`],
  ['ENTREE_REFAIRE', ({ libelle: instant }) => `Refait : ${cite(instant)}`],
  ['ENTREE_REVENIR', ({ libelle: instant }) => `Retour à ${cite(instant)}`],
  ['ENTREE_AJOUTER_PARTICIPANT', ({ personne }) => `Ajouté ${personne}`],
  [
    'ENTREE_MODIFIER_PARTICIPANT',
    ({ personne, champs, devenu }) => {
      const nouveau = devenu === null || devenu === undefined ? '' : ` (désormais ${devenu})`;
      return `Modifié ${personne} : ${champs.map(nomChamp).join(', ')}${nouveau}`;
    },
  ],
  ['ENTREE_EXCLURE_PARTICIPANT', ({ personne }) => `Exclu ${personne}`],
  ['ENTREE_REINTEGRER_PARTICIPANT', ({ personne }) => `Réintégré ${personne}`],
  ['ENTREE_SUPPRIMER_PARTICIPANT', ({ personne }) => `Supprimé ${personne}`],
  [
    'ENTREE_IMPORTER_PARTICIPANTS',
    ({ mode, ajoutes, misAJour, retires }) => {
      const ajoutesTexte = compte(ajoutes, 'ajouté', 'ajoutés');
      if (mode === 'ajouter') return `Importé ${compte(ajoutes, 'participant', 'participants')}`;
      if (mode === 'mettreAJour') {
        return `Mis à jour la liste par import : ${ajoutesTexte}, ${compte(misAJour, 'modifié', 'modifiés')}`;
      }
      if (mode === 'remplacer') {
        return `Remplacé la liste par import : ${compte(retires, 'retiré', 'retirés')}, ${ajoutesTexte}`;
      }
      throw new RangeError(`libelle : mode d'import inconnu ${JSON.stringify(mode)}`);
    },
  ],
  ['ENTREE_CHANGER_ETAT', ({ etat }) => `Plan passé à l'état ${cite(nomEtat(etat))}`],
  ['ENTREE_DEBLOQUER', ({ etat }) => `Plan débloqué, état ${cite(nomEtat(etat))}`],
  [
    'ENTREE_ENREGISTRER_GENERATION',
    ({ n, premier, dernier }) =>
      `Généré ${compte(n, 'proposition', 'propositions')} ` +
      `(n° ${premier === dernier ? premier : `${premier} à ${dernier}`})`,
  ],
  ['ENTREE_RETENIR_PROPOSITION', ({ id }) => `Retenu la proposition n° ${id}`],
  [
    'ENTREE_EFFACER_PROPOSITIONS',
    ({ n, gardee }) =>
      `Effacé ${compte(n, 'proposition', 'propositions')}` +
      `${gardee === null || gardee === undefined ? '' : `, gardé la retenue (n° ${gardee})`}`,
  ],
]);

// Le texte d'un code de la table, ou RangeError qui le nomme.
function texteDe(code, details = {}) {
  const texte = TEXTES.get(code);
  if (texte === undefined) throw new RangeError(`libelle : code inconnu ${JSON.stringify(code)}`);
  return texte(details ?? {});
}

/** Les codes qui ont un texte, triés par unités UTF-16 croissantes. */
export const CODES = Object.freeze([...TEXTES.keys()].sort(comparerTextes));

/**
 * Le texte français d'un code et de ses détails (§ 14.6) : un refus, un
 * avertissement, une raison, ou le libellé figé d'une entrée ou d'un jalon.
 *
 * @param {string} code
 * @param {Object} [details]
 * @returns {string}
 * @throws {RangeError} un code sans texte, ou une valeur codée de ses détails
 *         — état, champ, mode, échec — que la table ne connaît pas ; jamais
 *         une raison, qu'une phrase générique nomme
 */
export function libelle(code, details = {}) {
  return texteDe(code, details);
}
