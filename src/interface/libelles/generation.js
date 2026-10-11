// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de la génération : meilleure proposition du classement,
// réglages, cœurs de calcul, durée observée, question d'une génération
// longue, avancement et issue (§ 5.4, § 5.7, § 5.10, § 14.6). Chaque
// clé commence par « generation. ». Le libellé d'un réglage porte son unité,
// entre parenthèses : l'étiquette du champ la dit, et le nom accessible du
// champ avec elle. Un nombre et une durée se mettent en forme par
// creerFormat, sur la composition que la traduction passe à l'entrée ; les
// détails reçus sont des nombres.
import { creerFormat } from '../../application/format.js';
import { compte } from '../../application/libelles/aides.js';

// Les cœurs d'un calcul, dits quand il en emploie plus d'un : « , sur
// 4 cœurs » ; rien pour un seul, ou quand le nombre n'est pas donné.
function surCoeurs(coeurs, texte) {
  return typeof coeurs === 'number' && coeurs > 1 ? `, sur ${creerFormat(texte).nombre(coeurs)} cœurs` : '';
}

// Ce que vaut un calcul mesuré : sa durée, puis ses réglages, nombre de
// propositions et compte d'arrêt, dont le produit est le nombre de
// mouvements évalués, puis les cœurs qu'il a employés.
function calculMesure({ dureeMs, nombre, arret, coeurs }, texte) {
  const format = creerFormat(texte);
  return (
    `${format.duree(dureeMs)} pour ${format.nombre(nombre)} \u{00D7} ${format.nombre(arret)} mouvements` +
    surCoeurs(coeurs, texte)
  );
}

export const TABLE = new Map([
  // --- La meilleure proposition, en tête de la section (§ 5.4, § 5.7) --------
  // Le libellé de ses collisions cumulées et son explication sont ceux de la
  // colonne du tableau des propositions, sous leurs clés propositions.….
  ['generation.meilleure.titre', 'Meilleure proposition du classement'],
  ['generation.meilleure.proposition', 'Proposition au rang 1'],
  [
    'generation.meilleure.aucune',
    "Aucune proposition classée : sans proposition comparable, le classement n'en désigne aucune.",
  ],

  // --- Les réglages (§ 5.7, § 5.10) ---------------------------------------------
  ['generation.reglages.titre', 'Réglages de la génération'],
  ['generation.reglage.graine', 'Graine (nombre entier, de 0 à 4\u{202F}294\u{202F}967\u{202F}295)'],
  ['generation.reglage.nombre', 'Propositions par génération (nombre de propositions)'],
  ['generation.reglage.arret', "Compte d'arrêt (mouvements évalués par proposition)"],
  ['generation.reglage.historique', "Historique d'acceptation (longueur, en mouvements)"],

  // --- Les contraintes et l'attribution des sièges, sous leur nom du § 5.3 ---
  ['generation.contraintes.titre', 'Contraintes de la génération'],
  ['generation.contrainte.separerAppartenances', 'Séparer les appartenances'],
  ['generation.contrainte.nouveauxVoisins', 'Nouveaux voisins à chaque tour'],
  ['generation.contrainte.nouvelleTable', 'Nouvelle table à chaque tour'],
  ['generation.contrainte.varierAppartenances', 'Varier les appartenances rencontrées'],
  ['generation.contrainte.attribuerSieges', 'Attribuer les sièges'],

  // --- Les cœurs de calcul, un réglage du poste pour la séance (§ 5.10) --------
  // disponibles : les processeurs logiques du poste, hyperthreads compris.
  ['generation.coeurs.titre', 'Cœurs de calcul'],
  ['generation.coeurs.automatique', 'Cœurs automatiques (un par processeur logique du poste)'],
  [
    'generation.coeurs.nombre',
    ({ disponibles }, texte) => `Nombre de cœurs (de 1 à ${creerFormat(texte).nombre(disponibles)})`,
  ],
  [
    'generation.coeurs.disponibles',
    ({ disponibles }, texte) =>
      `Valeur automatique sur ce poste : ${creerFormat(texte).nombre(disponibles)} ` +
      `${disponibles <= 1 ? 'cœur' : 'cœurs'}, un par processeur logique, hyperthreads compris.`,
  ],
  [
    'generation.coeurs.note',
    "Une génération n'emploie jamais plus de cœurs que de propositions demandées. Ce réglage vaut pour cette " +
      "séance du logiciel sur ce poste : il ne s'enregistre pas dans l'événement.",
  ],

  // --- La durée du dernier calcul de cette séance (§ 5.10) --------------------
  [
    'generation.duree.inconnue',
    "Aucun calcul n'est encore mesuré sur ce poste pendant cette séance : la durée d'une génération est inconnue.",
  ],
  ['generation.duree.observee', (details, texte) => `Dernier calcul sur ce poste : ${calculMesure(details, texte)}.`],
  // secondes : l'estimation des réglages courants, d'après le dernier calcul ;
  // coeurs : ceux qu'ils emploieraient.
  [
    'generation.duree.estimee',
    ({ secondes, coeurs }, texte) =>
      `À ces réglages, une génération prendrait ${creerFormat(texte).ordreDeGrandeur(secondes)}${surCoeurs(coeurs, texte)}.`,
  ],

  // --- La génération longue, annoncée avant de partir (§ 5.10) ----------------
  // estimation : celle de CONFIRMATION_REQUISE, { inconnue: true } sans
  // mesure, sinon { secondes, auDelaDuPlafond, mesure: { dureeMs, mouvements,
  // coeurs }, coeurs }.
  [
    'generation.longue.question',
    ({ estimation }, texte) => {
      if (estimation.inconnue === true) {
        return (
          "Aucune durée n'est encore mesurée sur ce poste pendant cette séance, et ce réglage demande plus de dix " +
          'fois le réglage par défaut. La lancer quand même ?'
        );
      }
      const format = creerFormat(texte);
      const { mesure } = estimation;
      const plafond = estimation.auDelaDuPlafond ? ", au-delà du plafond d'usage de trente minutes" : '';
      return (
        `Cette génération prendrait ${format.ordreDeGrandeur(estimation.secondes)} à ce réglage` +
        `${surCoeurs(estimation.coeurs, texte)}${plafond}, ` +
        `d'après le dernier calcul : ${format.duree(mesure.dureeMs)} pour ${format.nombre(mesure.mouvements)} ` +
        `mouvements${surCoeurs(mesure.coeurs, texte)}. La lancer quand même ?`
      );
    },
  ],
  ['generation.longue.confirmer', 'Générer quand même'],
  ['generation.longue.renoncer', 'Ne pas générer'],

  // --- Les commandes ----------------------------------------------------------------
  ['generation.commande.generer', 'Générer'],
  ['generation.commande.annuler', 'Annuler la génération'],

  // --- L'avancement (§ 5.10) --------------------------------------------------------
  ['generation.avancement.barre', 'Avancement de la génération'],
  [
    'generation.avancement.texte',
    ({ fait, total }, texte) => {
      const { nombre } = creerFormat(texte);
      return `Génération en cours : ${nombre(fait)} mouvements évalués sur ${nombre(total)}.`;
    },
  ],

  // --- L'issue d'une génération -------------------------------------------------------
  // ajoutees : le nombre de propositions enregistrées ; identiques : celles
  // que le plan d'une proposition présente a écartées.
  [
    'generation.issue.ajoutees',
    ({ ajoutees, identiques }) => {
      const nouvelles =
        ajoutees === 0 ? 'Aucune proposition nouvelle' : `${compte(ajoutees, 'proposition ajoutée', 'propositions ajoutées')}`;
      const ecartees =
        identiques === 0
          ? ''
          : ` ; ${compte(identiques, 'placement identique à une proposition présente, écarté', 'placements identiques à des propositions présentes, écartés')}`;
      return `${nouvelles}${ecartees}.`;
    },
  ],
  ['generation.issue.annuleeCommande', "Génération annulée : rien n'est enregistré."],
  ['generation.issue.annuleeSeance', "Génération annulée par le retour en lecture : rien n'est enregistré."],
]);
