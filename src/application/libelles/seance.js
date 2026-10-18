// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des codes de la séance (§ 8.3 à § 8.8, § 14.6), et les libellés
// figés que la séance écrit au journal : jalons, reprise, retours. Un libellé
// d'entrée se compose une fois, à l'écriture du geste, et le journal en garde
// le texte, jamais le code (§ 8.2).
import {
  capitale,
  causeEntreParentheses,
  cite,
  compte,
  depuisQuand,
  enumeration,
  nomEtat,
  ouEcrire,
  phraseDeRaison,
} from './aides.js';

// Le placement qu'une dérive touche : le retenu, ou une proposition par son
// numéro.
const nomDuPlacement = (id) => (id === 'retenu' ? 'le placement retenu' : `la proposition n° ${id}`);

// Les raisons d'un placement, chacune par son texte.
const phrasesDe = (raisons, texte) => raisons.map((raison) => phraseDeRaison(raison.code, raison, texte)).join(' ');

// Une violation du retenu : la réservation qu'il ne tient pas par le texte
// de RESERVATION_NON_HONOREE, toute autre par le texte de son code.
const phraseDeViolation = (violation, texte) =>
  violation.code === 'RESERVATION'
    ? texte('RESERVATION_NON_HONOREE', violation)
    : phraseDeRaison(violation.code, violation, texte);

// Les commandes du nettoyage des propositions, dont le refus SANS_EFFET dit
// qu'aucune proposition n'est à effacer.
const NETTOYAGES = new Set(['effacerPropositions', 'garderMeilleures']);

// La touche qui a défait ou refait, entre parenthèses après le verbe ; rien
// sans touche.
const parTouche = (touche) => (touche === undefined ? '' : ` (${touche})`);

export const TABLE = new Map([
  // --- La séance (§ 8.3, § 8.4, § 8.5, § 8.6, § 8.8) -------------------------
  ['AUCUN_EVENEMENT', () => "Aucun événement n'est ouvert."],
  ['MODE_LECTURE', () => "L'événement est ouvert en lecture : « Modifier » permet de le changer."],
  ['FORMAT', (details, texte) => texte('FORMAT_PLUS_RECENT', details)],
  ['BLOQUE', () => 'Le plan est bloqué.'],
  // echec nomme ce que le support n'a pas reçu : la ligne d'un geste
  // (ECRITURE), l'état d'un geste inscrit au journal (ETAT_NON_ECRIT), le
  // jalon d'un geste enregistré (JALON_NON_ECRIT), ou le verrou d'un passage
  // en écriture (VERROU_NON_ECRIT), qui ne perd rien.
  [
    'SUPPORT_ROMPU',
    ({ echec, ...details }, texte) => {
      const refus = `Le support ne prend plus les écritures : ${ouEcrire(details, texte)} n'a pas pu s'écrire`;
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
    ({ depuis }, texte) => `Le verrou qu'une autre séance tenait${depuisQuand(depuis, texte)} est repris.`,
  ],
  [
    'RETOUR_AUTOMATIQUE',
    () =>
      "Faute d'activité, l'événement est revenu seul en lecture ; chaque geste achevé était déjà enregistré. " +
      '« Modifier » permet de reprendre.',
  ],

  // --- Ce qu'un geste fait naître (§ 5.9, § 9, § 14.12) ----------------------
  [
    'DERIVE_NOUVELLE',
    ({ touchees }, texte) => {
      const noms = touchees.map(({ id }) => nomDuPlacement(id));
      const accord = touchees.length > 1 ? 'ne décrivent plus' : 'ne décrit plus';
      const parPlacement = touchees.map(({ id, raisons }) => `${capitale(nomDuPlacement(id))} : ${phrasesDe(raisons, texte)}`);
      return (
        `Après ce geste, ${enumeration(noms)} ${accord} la liste ou les tables actuelles, et rien n'est effacé. ` +
        parPlacement.join(' ')
      );
    },
  ],
  // La personne se nomme par personne, et la table par numero, quand les
  // détails les portent (avertissementsApres les lit sur la charge) ; une
  // violation d'INVARIANT_VIOLE, qui ne les porte pas, garde les identifiants.
  // Au siège, siege et occupant disent la chaise réservée et ce qu'elle
  // porte : la personne est assise à la même table, à un autre siège.
  [
    'RESERVATION_NON_HONOREE',
    ({ participant, table, tour, personne = null, numero = null, siege, occupant = null }) => {
      const qui = personne ?? `la personne n° ${participant}`;
      const ou = numero === null ? `table d'identifiant ${table}` : `table ${numero}`;
      if (siege === undefined) {
        return `Le placement retenu n'honore pas la réservation de ${qui} à la ${ou} au tour ${tour} : il la place ailleurs.`;
      }
      const chaise = occupant === null ? `laisse le siège ${siege} vide` : `donne le siège ${siege} à une autre personne`;
      return (
        `Le placement retenu n'honore pas la réservation de ${qui} au siège ${siege} de la ${ou} au tour ${tour} : ` +
        `il l'assied à un autre siège de cette table, et ${chaise}.`
      );
    },
  ],
  [
    'INVARIANT_VIOLE',
    ({ proposition, violations }, texte) =>
      `Le placement retenu, issu de la proposition n° ${proposition}, enfreint ` +
      `${compte(violations.length, 'règle', 'règles')} que la dérive ne dit pas. ` +
      violations.map((violation) => phraseDeViolation(violation, texte)).join(' '),
  ],
  [
    'CONFIGURATION_INCOHERENTE',
    ({ code, details }, texte) =>
      `Après ce geste, la configuration ne se tient plus : ${phraseDeRaison(code, details, texte)} ` +
      'Le diagnostic et la génération la refusent tant que rien ne la corrige.',
  ],
  [
    'VERROU_NON_RENDU',
    ({ cause }, texte) =>
      `Le verrou de l'événement n'a pas pu être rendu${causeEntreParentheses(cause, texte)} : ` +
      'une autre séance de ce poste le reprendra une fois ce logiciel fermé.',
  ],
  // Le papier choisi que le dossier de travail refuse d'écrire dans les
  // réglages locaux : il vaut pour la séance, en mémoire.
  [
    'REGLAGES_NON_ECRITS',
    (details, texte) =>
      `Les réglages locaux ${ouEcrire(details, texte)} n'ont pas pu s'écrire : ` +
      'le papier choisi vaut pour cette séance, sans être retenu sur cette machine.',
  ],
  ['RIEN_A_DEFAIRE', () => "Rien à défaire : l'historique commence à cet instant."],
  ['RIEN_A_REFAIRE', () => 'Rien à refaire : seul un retour se refait, tant que nul geste ne le suit.'],
  ['INSTANT_NON_RESTITUABLE', ({ revision }) => `L'historique ne restitue plus l'instant ${revision}.`],
  [
    'JALON_NON_ECRIT',
    ({ dossier, cause }, texte) =>
      `Le geste est enregistré, mais le jalon qui le nomme n'a pas pu s'écrire ` +
      `dans le dossier ${cite(dossier)}${causeEntreParentheses(cause, texte)}.`,
  ],
  // Un geste qui ne change rien : revenir à un instant qui a déjà le contenu
  // courant ({sens: 'revenir'}), nettoyer des propositions sans rien à
  // effacer ({commande}), ou tout autre.
  [
    'SANS_EFFET',
    ({ sens, commande }) => {
      if (sens === 'revenir') return "Cet instant a déjà le contenu courant : rien n'est enregistré.";
      if (NETTOYAGES.has(commande)) return "Aucune proposition n'est à effacer : rien n'est enregistré.";
      return "Ce geste ne change rien : rien n'est enregistré.";
    },
  ],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  ['JALON_CREATION', () => 'Création'],
  ['JALON_ETAT', ({ etat }) => `État ${cite(nomEtat(etat))}`],
  ['JALON_AVANT_GENERATION', () => 'Avant la génération'],
  ['ENTREE_REPRISE', () => "Reprise de l'état trouvé sur le disque"],
  // touche, facultative : celle qui a défait ou refait, que la séance
  // contrôle.
  ['ENTREE_DEFAIRE', ({ libelle: instant, touche }) => `Défait${parTouche(touche)} : ${cite(instant)}`],
  ['ENTREE_REFAIRE', ({ libelle: instant, touche }) => `Refait${parTouche(touche)} : ${cite(instant)}`],
  ['ENTREE_REVENIR', ({ libelle: instant }) => `Retour à ${cite(instant)}`],
]);
