// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes de src/stockage (§ 14.6) : le système de fichiers et le
// dépôt, les raisons d'un fichier illisible, les fautes et les raisons de
// dérive d'un placement, ce que l'ouverture annonce, le dossier de travail et
// les réglages locaux. Une raison qu'un texte ne traite pas à part ne lève
// jamais : une phrase générique la nomme, par son texte quand les tables en
// portent un, telle quelle sinon. Une cause que nomme le système, EROFS,
// ENOENT ou TypeMismatchError, n'est pas un code de l'application : les
// textes la citent telle quelle, entre parenthèses.
import {
  auxToursNommes,
  capitale,
  causeEntreParentheses,
  cheminDe,
  cite,
  compte,
  depuisQuand,
  element,
  enumeration,
  numeros,
  ouEcrire,
  phraseDeRaison,
} from './aides.js';

// La raison d'un fichier d'état illisible, en une phrase.
function raisonIllisible({ raison, ...details }, texte) {
  if (raison === 'ABSENT') return "Le fichier d'état manque, à côté de son historique.";
  return phraseDeRaison(raison, details, texte);
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

// La personne d'une raison de dérive, par son nom affiché quand les détails
// le portent ; la table, par son numéro de même.
const laPersonne = ({ participant, personne = null }) => personne ?? `La personne n° ${participant}`;
const laTable = ({ table, numero = null }) => (numero === null ? `La table d'identifiant ${table}` : `La table ${numero}`);

// La phrase de chaque raison de la faute DERIVATION (placements.js), sans
// son point ni son chemin, que le texte ajoute.
const PHRASES_DE_DERIVATION = new Map([
  ['departNonAnterieur', 'Le départ de cette proposition dérivée ne la précède pas'],
  ['tourHorsSoiree', 'Un tour figé de cette proposition dérivée dépasse les tours de sa soirée'],
  ['tousLesTours', "Cette proposition dérivée fige tous ses tours : elle n'en refait aucun"],
  ['sansDepart', 'Cette proposition porte des tours figés sans départ'],
]);
const DERIVATION_GENERIQUE = 'La dérivation de cette proposition se contredit';

export const TABLE = new Map([
  // --- Le système de fichiers et le dépôt (src/stockage/types.js) ------------
  [
    'ABSENT',
    ({ chemin }) =>
      typeof chemin === 'string' ? `Le fichier ${cite(chemin)} est introuvable.` : "Le fichier d'état manque.",
  ],
  ['ECRITURE', (details, texte) => `L'écriture de ${ouEcrire(details, texte)} a échoué ; le fichier d'avant reste intact.`],
  ['LECTURE', (details, texte) => `La lecture de ${ouEcrire(details, texte)} est refusée.`],
  ['EXISTE', ({ chemin }) => `Un fichier ${cite(chemin)} existe déjà.`],
  ['CHEMIN_REFUSE', ({ chemin }) => `Le chemin ${cite(String(chemin))} est refusé.`],
  [
    'ETAT_ILLISIBLE',
    (details, texte) => {
      const sujet = typeof details.base === 'string' ? `Le fichier d'état de ${cite(details.base)}` : 'Le fichier';
      return `${sujet} ne s'ouvre pas. ${raisonIllisible(details, texte)}${secoursDe(details.secours)}`;
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
    ({ depuis, vivant }, texte) => {
      if (vivant === true) {
        return `Une autre séance modifie cet événement${depuisQuand(depuis, texte)} : il reste en lecture ici.`;
      }
      if (vivant === false) {
        return (
          `Une séance interrompue a laissé son verrou${depuisQuand(depuis, texte)}, et il n'a pas pu se reprendre : ` +
          "l'événement reste en lecture."
        );
      }
      return (
        `Un verrou dont la séance ne se laisse pas vérifier — autre poste, verrou illisible, ou séance de ce poste dont la vie ne se prouve pas — tient cet événement${depuisQuand(depuis, texte)} : ` +
        'il reste en lecture ici, et rien ne le reprend seul.'
      );
    },
  ],
  [
    'LECTURE_SEULE',
    ({ raison }, texte) => {
      if (raison === 'BLOQUE') {
        return `${texte('BLOQUE')} Rien ne peut changer ; « Débloquer » le rend de nouveau modifiable.`;
      }
      if (raison === 'FORMAT' || raison === 'FORMAT_PLUS_RECENT') {
        return `${texte(raison)} Il s'ouvre en lecture seule, et aucun geste ne le modifie ici.`;
      }
      if (raison === 'ENCODAGE') {
        return (
          `Le fichier d'état a changé sur le disque. ${texte('ENCODAGE')} ` +
          "L'événement reste en lecture seule ; rouvert par une version de secours, son premier geste " +
          "range ce fichier dans la corbeille avant d'écrire l'état."
        );
      }
      return `${phraseDeRaison(raison, {}, texte)} L'événement reste en lecture seule, et aucun geste ne le modifie ici.`;
    },
  ],
  [
    'ETAT_NON_ECRIT',
    (details, texte) => `Le geste est inscrit à l'historique, mais l'état ${ouEcrire(details, texte)} n'a pas pu s'écrire.`,
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
  ['NON_DISPONIBLE', ({ cause }, texte) => `Cette commande n'est pas offerte ici${causeEntreParentheses(cause, texte)}.`],

  // --- Les raisons d'un fichier illisible ------------------------------------
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

  // --- Les fautes d'un placement, et ses raisons de dérive (§ 8.9, § 9) ------
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
  // La dérivation d'une proposition qui se contredit : une phrase par raison,
  // une phrase générique pour une raison qu'elle ne connaît pas.
  ['DERIVATION', ({ chemin, raison }) => `${PHRASES_DE_DERIVATION.get(raison) ?? DERIVATION_GENERIQUE}${element(chemin)}.`],
  // Une raison de dérive nomme la personne par personne et la table par
  // numero quand ses détails les portent (raisonsNommees, de l'application) ;
  // sinon par leur identifiant.
  ['PARTICIPANT_EXCLU', (details) => `${laPersonne(details)} est exclue depuis.`],
  ['PARTICIPANT_SUPPRIME', (details) => `${laPersonne(details)} a été supprimée depuis.`],
  ['PARTICIPANT_NON_PLACE', (details) => `${laPersonne(details)}, ajoutée ou réintégrée depuis, n'y est pas placée.`],
  // La présence changée depuis le placement : tours, croissants, nomme les
  // tours où il la place alors que la charge la dit absente, ou l'inverse.
  ['PRESENCE_RETIREE', (details) => `${laPersonne(details)} est absente ${auxToursNommes(details.tours)} depuis.`],
  ['PRESENCE_AJOUTEE', (details) => `${laPersonne(details)} est présente ${auxToursNommes(details.tours)} depuis.`],
  ['TABLE_SUPPRIMEE', (details) => `${laTable(details)} a été supprimée depuis.`],
  ['TABLE_AJOUTEE', (details) => `${laTable(details)} a été ajoutée depuis.`],
  [
    'CAPACITE_CHANGEE',
    ({ avant, maintenant, ...details }) => `${laTable(details)} est passée de ${avant} à ${compte(maintenant, 'place', 'places')}.`,
  ],
  ['TOURS_CHANGES', ({ avant, maintenant }) => `Le nombre de tours est passé de ${avant} à ${maintenant}.`],

  // --- Ce que l'ouverture annonce (§ 8.6, § 8.8, § 8.9, § 9) -----------------
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
    ({ raison }, texte) =>
      `L'historique à côté de ce fichier ne se lit pas. ${phraseDeRaison(raison, {}, texte)} ` +
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

  // --- Le dossier de travail, les réglages locaux (§ 8.5, § 8.6, § 8.8) ------
  ['NON_PUBLIE', () => "Le dossier de l'exécutable n'est pas connu : les événements se rangent dans les Documents."],
  [
    'DONNEES_APPLICATIVES',
    () => "L'exécutable est rangé sous les données applicatives : les événements se rangent dans les Documents.",
  ],
  [
    'SONDE_ECHOUEE',
    ({ cause }, texte) =>
      `Le dossier data à côté de l'exécutable refuse l'écriture${causeEntreParentheses(cause, texte)} : ` +
      'les événements se rangent dans les Documents.',
  ],
  // Une cause de la sonde, que les textes citent entre parenthèses.
  ['RELECTURE_DIFFERENTE', () => "le fichier d'essai relu ne porte pas ce qui vient d'y être écrit"],
  // Une cause de l'OPFS : sous des paramètres régionaux qui ne sont pas
  // UTF-8, le navigateur ne nomme pas un dossier ou un fichier hors ASCII.
  [
    'NOM_NON_CONVERTI',
    () =>
      "le navigateur ne sait pas nommer un dossier ou un fichier aux caractères accentués sous les réglages de langue du système",
  ],
  [
    'PORTABLE_NON_INSCRIPTIBLE',
    ({ racine, evenements, cause }, texte) => {
      const porte =
        evenements === null
          ? 'porte peut-être des événements'
          : `porte ${compte(evenements, 'événement', 'événements')}`;
      return `Le dossier ${cite(cheminDe(racine))} ${porte}, mais refuse l'écriture${causeEntreParentheses(cause, texte)}.`;
    },
  ],
  [
    'DOCUMENTS_NON_INSCRIPTIBLE',
    ({ racine, cause }, texte) =>
      `Le dossier de travail ${cite(cheminDe(racine))} refuse l'écriture${causeEntreParentheses(cause, texte)} : ` +
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
    ({ chemin, raison }, texte) => {
      const pourquoi =
        raison === 'JSON' || raison === 'FORME' ? texte(raison) : `La lecture est refusée (${raison}).`;
      return (
        `Les réglages locaux ${cite(chemin)} ne se lisent pas. ${pourquoi} Le fichier reste tel quel : ` +
        'le papier choisi vaut pour cette séance, sans être retenu sur cette machine, ' +
        "et le cadrage n'est pas retenu."
      );
    },
  ],
]);
