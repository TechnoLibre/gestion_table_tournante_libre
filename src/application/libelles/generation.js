// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Les textes des commandes de la génération et des propositions (§ 5.7,
// § 14.6) : refus et libellés figés, puis les refus du contrôleur de
// génération et de la saisie de ses réglages (§ 5.9, § 5.10, § 15.4). Cette
// table ne porte que des codes. Un nombre et une durée se mettent en forme
// par creerFormat, sur la composition que la traduction passe à l'entrée.
import { creerFormat } from '../format.js';
import { cite, compte, enumeration, phraseDeRaison } from './aides.js';

// Le nom de chaque réglage de génération, celui que la saisie affiche.
const NOMS_DES_REGLAGES = new Map([
  ['graine', 'Graine'],
  ['nombre', 'Propositions par génération'],
  ['arret', 'Mouvements par proposition'],
  ['historique', "Historique d'acceptation"],
]);

// Les cœurs d'un calcul, dits quand il en emploie plus d'un : « , sur
// 4 cœurs » ; rien pour un seul, ou quand le nombre n'est pas donné.
function surCoeurs(coeurs, texte) {
  return typeof coeurs === 'number' && coeurs > 1 ? `, sur ${creerFormat(texte).nombre(coeurs)} cœurs` : '';
}

// L'estimation d'une génération longue, en mots : l'ordre de grandeur et les
// cœurs qu'elle emploierait, puis la mesure dont il vient ; ou le seuil d'une
// génération sans mesure.
function phraseEstimation(estimation, texte) {
  if (estimation.inconnue === true) {
    return (
      "Aucune durée n'est encore mesurée sur ce poste dans cette séance, et ce réglage demande plus de " +
      'dix millions de mouvements par cœur, ralentissement compris'
    );
  }
  const format = creerFormat(texte);
  const { mesure } = estimation;
  const plafond = estimation.auDelaDuPlafond ? ", au-delà du plafond d'usage de trente minutes" : '';
  return (
    `Ce réglage prendrait ${format.ordreDeGrandeur(estimation.secondes)}${surCoeurs(estimation.coeurs, texte)}` +
    `${plafond}, d'après le dernier calcul, ` +
    `${format.duree(mesure.dureeMs)} pour ${format.nombre(mesure.mouvements)} mouvements ` +
    `sur ${compte(mesure.participants, 'participant', 'participants')}${surCoeurs(mesure.coeurs, texte)}`
  );
}

// Une table par son numéro quand les détails le portent, sinon par son
// identifiant.
const laTable = (table, numero) => (numero === null ? `table d'identifiant ${table}` : `table ${numero}`);

export const TABLE = new Map([
  // --- Les refus des propositions (§ 5.7) ------------------------------------
  ['PROPOSITION_INCONNUE', ({ id }) => `La proposition n° ${id} n'est pas dans cet événement.`],

  // --- Les libellés figés du journal (§ 8.2, § 8.3) --------------------------
  [
    'ENTREE_ENREGISTRER_GENERATION',
    ({ n, premier, dernier }) =>
      `Généré ${compte(n, 'proposition', 'propositions')} ` +
      `(n° ${premier === dernier ? premier : `${premier} à ${dernier}`})`,
  ],
  // Une génération dérivée (§ 5.7, D77) : depart, le numéro du départ, figé à
  // l'écriture comme toute la phrase ; toursFiges, croissants, [] sans tour
  // figé, qui tait alors la fin.
  [
    'ENTREE_ENREGISTRER_GENERATION_DERIVEE',
    ({ n, premier, dernier, depart, toursFiges }) =>
      `Généré ${compte(n, 'proposition dérivée', 'propositions dérivées')} de n° ${depart} ` +
      `(n° ${premier === dernier ? premier : `${premier} à ${dernier}`})` +
      (toursFiges.length === 0
        ? ''
        : `, ${toursFiges.length === 1 ? 'tour' : 'tours'} ${enumeration(toursFiges.map(String))} ` +
          `${toursFiges.length === 1 ? 'figé' : 'figés'}`),
  ],
  // ajuste : la copie retenue a suivi la présence de chacun.
  ['ENTREE_RETENIR_PROPOSITION', ({ id, ajuste }) => `Retenu la proposition n° ${id}${ajuste === true ? ' ; ajusté à la présence' : ''}`],
  [
    'ENTREE_EFFACER_PROPOSITIONS',
    ({ n, gardee }) =>
      `Effacé ${compte(n, 'proposition', 'propositions')}` +
      `${gardee === null || gardee === undefined ? '' : `, gardé la retenue (n° ${gardee})`}`,
  ],
  // n : les premières du classement gardées ; effacees : le nombre
  // d'effacées ; gardee : la proposition du retenu, gardée en plus, ou null.
  [
    'ENTREE_GARDER_MEILLEURES',
    ({ n, effacees, gardee }) =>
      `Gardé ${n <= 1 ? 'la meilleure proposition' : `les ${n} meilleures propositions`}, ` +
      `effacé ${compte(effacees, 'proposition', 'propositions')}` +
      `${gardee === null || gardee === undefined ? '' : `, gardé aussi la retenue (n° ${gardee})`}`,
  ],
  // nonClassees : les propositions qui servent encore de départ sans se
  // comparer, la présence de chacun ayant changé depuis elles ; n, les
  // premières que le geste garderait.
  [
    'NETTOYAGE_SANS_CLASSEMENT',
    ({ n, nonClassees }) =>
      `${compte(nonClassees, 'proposition', 'propositions')} ${nonClassees <= 1 ? "n'est pas classée" : 'ne sont pas classées'} ` +
      'depuis le changement de participants : ' +
      `garder ${n <= 1 ? 'la meilleure' : `les ${n} meilleures`} ` +
      `${nonClassees <= 1 ? "l'effacerait sans l'avoir comparée" : 'les effacerait sans les avoir comparées'}. ` +
      "Générer d'abord une dérivée.",
  ],

  // --- Le départ d'une génération dérivée (§ 5.7) -----------------------------
  // Les refus que le lancement pose avant tout calcul (application/depart.js).
  // depart : l'identifiant choisi ; une valeur qui n'est pas un identifiant
  // de proposition ne se nomme pas par un numéro.
  [
    'DEPART_ABSENT',
    ({ depart }) =>
      Number.isInteger(depart)
        ? `La proposition n° ${depart} n'est plus dans la liste : elle ne peut pas servir de départ.`
        : "Seule une proposition de la liste sert de départ, et ce placement n'en est pas une.",
  ],
  // statut 'derive' : le mobilier — tables, places, tours — a changé, et
  // chaque raison se dit par son texte ; un changement de participants ne
  // refuse pas un départ, qui s'ajuste à la présence. 'fautif' : les fautes
  // ne se détaillent pas, comme pour toute proposition qui se contredit.
  [
    'DEPART_NON_COMPARABLE',
    ({ depart, statut, raisons }, texte) =>
      statut === 'fautif'
        ? `La proposition n° ${depart} se contredit : elle ne peut pas servir de départ.`
        : `La proposition n° ${depart} ne décrit plus la soirée : le mobilier a changé depuis elle, ` +
          'et elle ne peut plus servir de départ.' +
          raisons.map((raison) => ` ${phraseDeRaison(raison.code, raison, texte)}`).join(''),
  ],
  ['TOUR_FIGE_HORS_SOIREE', ({ tour, tours }) => `Le tour ${tour} est figé, mais la soirée compte ${compte(tours, 'tour', 'tours')} : ce tour n'existe pas.`],
  [
    'TOURS_FIGES_TOUS',
    ({ tours }) =>
      tours <= 1
        ? 'Le seul tour de la soirée est figé : il ne reste rien à refaire.'
        : `Les ${tours} tours sont tous figés : il ne reste rien à refaire. Décocher au moins un tour.`,
  ],
  // personne et numero nomment la personne et la table quand les détails les
  // portent ; sinon leurs identifiants.
  [
    'DEPART_RESERVATION_NON_TENUE',
    ({ depart, participant, table, tour, personne = null, numero = null }) =>
      `La proposition n° ${depart} n'assied pas ${personne ?? `la personne n° ${participant}`} ` +
      `à la ${laTable(table, numero)} au tour ${tour}, où une réservation la fixe : elle ne peut plus servir de départ.`,
  ],
  // Le remède offert décoche le tour ; le texte nomme aussi l'autre issue.
  [
    'DEPART_SIEGE_NON_TENU',
    ({ depart, participant, table, siege, tour, personne = null, numero = null }) =>
      `La proposition n° ${depart} n'assied pas ${personne ?? `la personne n° ${participant}`} ` +
      `au siège ${siege} de la ${laTable(table, numero)} au tour ${tour}, où une réservation la fixe : ` +
      `un tour figé garde les sièges du départ. Ne plus figer ce tour, ou ${cite('Repartir de zéro')}.`,
  ],

  // Avant d'enregistrer une génération dérivée, un tour figé qui diffère de
  // celui du départ : une violation d'invariant, qu'aucun geste ne déclenche
  // (§ 14.12). rang : la place du placement dans la suite des graines du
  // lancement, comme pour GENERATION_INVARIANT_VIOLE.
  [
    'TOUR_FIGE_DIFFERENT',
    ({ rang, tour }) =>
      `Le placement que la génération a rendu au rang ${rang} de ce lancement ne reprend pas tel quel le tour ${tour} ` +
      "de son départ, que ce tour figé doit garder ; rien n'est enregistré.",
  ],

  // L'issue d'une génération dérivée dont le retenu a été retenu du départ et
  // en diffère à des tours figés : la dérivée reprend ces tours du départ,
  // sans les retouches faites depuis au retenu. tours, croissants.
  [
    'DEPART_ECART_AU_RETENU',
    ({ depart, tours }) =>
      tours.length === 1
        ? `Le tour figé ${tours[0]} vient de la proposition n° ${depart} : les retouches du placement retenu à ce tour n'y sont pas.`
        : `Les tours figés ${enumeration(tours.map(String))} viennent de la proposition n° ${depart} : ` +
          "les retouches du placement retenu à ces tours n'y sont pas.",
  ],

  // --- Le contrôleur de génération (§ 5.9, § 5.10, § 15.4) -------------------
  ['GENERATION_EN_COURS', () => "Une génération est déjà en cours : l'annuler, ou attendre qu'elle s'achève."],
  [
    'AUCUN_PARTICIPANT',
    () => "Aucune personne à placer : la liste des participants est vide, ou chacun en est exclu.",
  ],
  ['AUCUNE_TABLE', () => "Aucune table : la génération place les personnes autour des tables de l'événement."],
  // Le travailleur de génération n'a pas démarré, ou s'est arrêté sans
  // résultat : rien n'est enregistré, et aucun geste de la page ne le relance.
  [
    'TRAVAILLEUR_EN_ECHEC',
    () =>
      "Le calcul hors de la page n'a pas pu se faire : le navigateur n'a pas démarré le travailleur de génération, " +
      "ou l'a arrêté sans résultat. Rien n'est enregistré ; relancer le logiciel le recharge.",
  ],
  [
    'CONFIRMATION_REQUISE',
    ({ estimation }, texte) =>
      `${phraseEstimation(estimation, texte)}. Confirmer « Générer » lance quand même la génération.`,
  ],
  [
    'REGLAGE_HORS_DOMAINE',
    ({ reglage }) =>
      `Le réglage ${cite(NOMS_DES_REGLAGES.get(reglage) ?? String(reglage))} sort de son domaine : ` +
      "la génération n'a pas eu lieu.",
  ],
  // rang : la place du placement dans la suite des graines du lancement,
  // jamais un numéro de proposition, puisque rien n'est enregistré ; chaque
  // violation se dit par le texte de son code (libelles/moteur.js).
  [
    'GENERATION_INVARIANT_VIOLE',
    ({ rang, violations }, texte) =>
      `Le placement que la génération a rendu au rang ${rang} de ce lancement enfreint ` +
      `${compte(violations.length, 'règle', 'règles')} ; rien n'est enregistré. ` +
      violations.map((violation) => phraseDeRaison(violation.code, violation, texte)).join(' '),
  ],

  // --- La saisie des réglages (§ 5.7) -----------------------------------------
  // max null : le domaine n'a pas de borne supérieure.
  [
    'HORS_DOMAINE',
    ({ min, max }, texte) => {
      const { nombre } = creerFormat(texte);
      return max === null || max === undefined
        ? `La valeur doit être d'au moins ${nombre(min)}.`
        : `La valeur doit être comprise entre ${nombre(min)} et ${nombre(max)}.`;
    },
  ],
]);
