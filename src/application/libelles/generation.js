// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les textes des commandes de la génération et des propositions (§ 5.7,
// § 14.6) : refus et libellés figés, puis les refus du contrôleur de
// génération et de la saisie de ses réglages (§ 5.9, § 5.10, § 15.4). Cette
// table ne porte que des codes. Un nombre et une durée se mettent en forme
// par creerFormat, sur la composition que la traduction passe à l'entrée.
import { creerFormat } from '../format.js';
import { cite, compte, phraseDeRaison } from './aides.js';

// Le nom de chaque réglage de génération, celui que la saisie affiche.
const NOMS_DES_REGLAGES = new Map([
  ['graine', 'Graine'],
  ['nombre', 'Propositions par génération'],
  ['arret', 'Mouvements par proposition'],
  ['historique', "Historique d'acceptation"],
]);

// L'estimation d'une génération longue, en mots : l'ordre de grandeur et la
// mesure dont il vient, ou le seuil d'une génération sans mesure.
function phraseEstimation(estimation, texte) {
  if (estimation.inconnue === true) {
    return (
      "Aucune durée n'est encore mesurée sur ce poste dans cette séance, et ce réglage demande plus de " +
      'dix fois le réglage par défaut'
    );
  }
  const format = creerFormat(texte);
  const { mesure } = estimation;
  const plafond = estimation.auDelaDuPlafond ? ", au-delà du plafond d'usage de trente minutes" : '';
  return (
    `Ce réglage prendrait ${format.ordreDeGrandeur(estimation.secondes)}${plafond}, d'après le dernier calcul, ` +
    `${format.duree(mesure.dureeMs)} pour ${format.nombre(mesure.mouvements)} mouvements ` +
    `sur ${compte(mesure.participants, 'participant', 'participants')}`
  );
}

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
  ['ENTREE_RETENIR_PROPOSITION', ({ id }) => `Retenu la proposition n° ${id}`],
  [
    'ENTREE_EFFACER_PROPOSITIONS',
    ({ n, gardee }) =>
      `Effacé ${compte(n, 'proposition', 'propositions')}` +
      `${gardee === null || gardee === undefined ? '' : `, gardé la retenue (n° ${gardee})`}`,
  ],

  // --- Le contrôleur de génération (§ 5.9, § 5.10, § 15.4) -------------------
  ['GENERATION_EN_COURS', () => "Une génération est déjà en cours : l'annuler, ou attendre qu'elle s'achève."],
  [
    'AUCUN_PARTICIPANT',
    () => "Aucune personne à placer : la liste des participants est vide, ou chacun en est exclu.",
  ],
  ['AUCUNE_TABLE', () => "Aucune table : la génération place les personnes autour des tables de l'événement."],
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
