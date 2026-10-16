// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les libellés de la génération : meilleure proposition du classement,
// réglages, mode des objectifs, ordre des priorités, cœurs de calcul, durée
// observée, question d'une génération longue, avancement et issue (§ 5.3,
// § 5.4, § 5.7, § 5.10, § 14.6). Chaque
// clé commence par « generation. ». Le libellé d'un réglage porte son unité,
// entre parenthèses : l'étiquette du champ la dit, et le nom accessible du
// champ avec elle. Un nombre et une durée se mettent en forme par
// creerFormat, sur la composition que la traduction passe à l'entrée ; les
// détails reçus sont des nombres, ou le nom d'un critère du registre, que le
// texte écrit sous son nom complet, mobilier.critere.<nom>.
import { creerFormat } from '../../application/format.js';
import { cite, compte, enumeration } from '../../application/libelles/aides.js';

// Le nom complet d'un critère, cité (§ 5.7) : celui que l'application donne
// à mobilier.critere.<nom>, le même que le journal écrit.
const nomCritere = (critere, texte) => cite(texte(`mobilier.critere.${critere}`));

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

// Les placements écartés comme identiques à une proposition présente, dits
// après ce qui est ajouté, précédés d'un point-virgule ; rien pour 0.
function ecartees(identiques) {
  if (identiques === 0) return '';
  return ` ; ${compte(identiques, 'placement identique à une proposition présente, écarté', 'placements identiques à des propositions présentes, écartés')}`;
}

// Une place au classement, en ordinal abrégé, lettres en exposant : 1re, 2e.
const place = (rang) => (rang === 1 ? '1\u{02B3}\u{1D49}' : `${rang}\u{1D49}`);

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
  ['generation.contrainte.respecterObjectifs', 'Respecter les objectifs des tables'],
  ['generation.contrainte.rencontrerAnimateurs', "Rencontrer le plus d'animateurs différents"],
  ['generation.contrainte.attribuerSieges', 'Attribuer les sièges'],

  // --- Le mode des objectifs, sous sa case (§ 5.3, A8, D20, D22) -----------------
  // Le troisième mode garde le libellé de l'utilisateur : sa clé est le seul
  // emploi admis de son mot (D22) ; son explication dit ce qu'il compare.
  ['generation.reglage.modeObjectifs', "Objectifs des tables : chercher d'abord"],
  ['generation.reglage.modeObjectifs.places', 'le plus de places servies'],
  ['generation.reglage.modeObjectifs.chacun', 'chacun au moins une fois'],
  ['generation.reglage.modeObjectifs.minimum', "l'équité d'abord"],
  [
    'generation.reglage.modeObjectifs.places.explication',
    'Le plus grand total de tours servis : le critère compare les tours hors objectif.',
  ],
  [
    'generation.reglage.modeObjectifs.chacun.explication',
    "D'abord le plus de personnes servies à un tour au moins, puis le plus grand total : le critère compare " +
      'les personnes jamais servies, puis les tours hors objectif.',
  ],
  [
    'generation.reglage.modeObjectifs.minimum.explication',
    "Le minimum d'abord, puis le total : d'abord la personne la plus mal servie, mesurée contre ses propres " +
      'tours possibles, puis le plus grand total. Le critère compare le plus de tours hors objectif ' +
      "d'une personne, puis les tours hors objectif.",
  ],
  // L'état du critère des tours hors objectif, lu dans la table d'évaluation.
  [
    'generation.reglage.modeObjectifs.etat.decoche',
    "Tours hors objectif : critère décoché. Le mode ne change rien tant que la case n'est pas cochée.",
  ],
  [
    'generation.reglage.modeObjectifs.etat.sansObjet',
    "Tours hors objectif : critère sans objet. Aucune table à objectif ne peut servir personne : le mode ne change rien.",
  ],

  // --- L'ordre des priorités (§ 5.7, A11, A12) -------------------------------------
  ['generation.reglage.priorites', 'Ordre des priorités'],
  [
    'generation.priorites.note',
    'Deux propositions se comparent palier par palier : un palier ne départage que des propositions égales sur ' +
      'ceux qui le précèdent. Dans un palier de plusieurs critères, chacun compte selon son poids.',
  ],
  ['generation.priorites.parDefaut', 'Ordre par défaut : chaque critère seul à son palier.'],
  ['generation.priorites.regle', "Ordre réglé pour l'événement."],
  // palier, compté à partir de 1 ; paliers, leur nombre.
  [
    'generation.priorites.palier',
    ({ palier, paliers }, texte) => {
      const { nombre } = creerFormat(texte);
      return `Palier ${nombre(palier)} sur ${nombre(paliers)}`;
    },
  ],
  ['generation.priorites.etat.decoche', 'décoché'],
  ['generation.priorites.etat.sansObjet', 'sans objet'],
  ['generation.priorites.poids', ({ critere }, texte) => `Poids de ${nomCritere(critere, texte)} (nombre entier)`],
  // Les gestes d'un critère, chacun nommant le critère qu'il déplace :
  // chaque bouton de l'éditeur porte ainsi un nom à lui (§ 14.5).
  ['generation.priorites.monter', ({ critere }, texte) => `Monter ${nomCritere(critere, texte)} d'un palier`],
  ['generation.priorites.monterPalier', ({ critere }, texte) => `Monter le palier de ${nomCritere(critere, texte)}`],
  ['generation.priorites.descendre', ({ critere }, texte) => `Descendre ${nomCritere(critere, texte)} d'un palier`],
  ['generation.priorites.descendrePalier', ({ critere }, texte) => `Descendre le palier de ${nomCritere(critere, texte)}`],
  ['generation.priorites.joindre', ({ critere }, texte) => `Joindre ${nomCritere(critere, texte)} au palier du dessus`],
  ['generation.priorites.separer', ({ critere }, texte) => `Séparer ${nomCritere(critere, texte)} en palier propre`],
  ['generation.priorites.retablir', "Rétablir l'ordre par défaut"],
  // L'annonce d'un geste abouti : critere, le critère déplacé ; palier,
  // compté à partir de 1 ; paliers ; avec, ses compagnons de palier.
  [
    'generation.priorites.annonce',
    ({ critere, palier, paliers, avec }, texte) => {
      const { nombre } = creerFormat(texte);
      const compagnons =
        avec.length === 0 ? ', seul' : `, avec ${enumeration(avec.map((autre) => nomCritere(autre, texte)))}`;
      return `${nomCritere(critere, texte)} est au palier ${nombre(palier)} sur ${nombre(paliers)}${compagnons}.`;
    },
  ],
  ['generation.priorites.annonceRetablie', "L'ordre par défaut est rétabli."],

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

  // --- Le départ d'une génération dérivée (§ 5.7, C6) -----------------------------
  // depart : l'identifiant de la proposition choisie, écrit tel quel comme
  // tout numéro de proposition ; tour : le numéro d'un tour.
  ['generation.depart.titre', ({ depart }) => `Départ : proposition n° ${depart}`],
  ['generation.depart.legende', 'Tours à figer'],
  ['generation.depart.tour', ({ tour }) => `Tour ${tour}`],
  [
    'generation.depart.note',
    'Un tour figé est repris tel quel du départ ; la génération ne refait que les autres, et part du plan du départ.',
  ],

  // --- Les commandes ----------------------------------------------------------------
  ['generation.commande.generer', 'Générer'],
  ['generation.commande.genererDepuis', ({ depart }) => `Générer depuis n° ${depart}`],
  ['generation.commande.repartirDeZero', 'Repartir de zéro'],
  ['generation.commande.annuler', 'Annuler la génération'],
  // a : la meilleure proposition dérivée ; depart : son départ.
  ['generation.commande.comparerIssue', ({ a, depart }) => `Comparer n° ${a} à n° ${depart}`],

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
      return `${nouvelles}${ecartees(identiques)}.`;
    },
  ],
  // Une génération dérivée (§ 5.7, D82) : ajoutees, le nombre de propositions
  // enregistrées, premier et dernier leurs identifiants extrêmes ; depart, son
  // départ ; meilleure, la dérivée que le classement range la première, et
  // placeMeilleure sa place ; placeDepart, celle du départ ; chacun null
  // quand le classement ne le range pas, et la phrase le tait ; identiques,
  // comme pour une génération ordinaire.
  [
    'generation.issue.derivee',
    ({ ajoutees, premier, dernier, depart, meilleure, placeMeilleure, placeDepart, identiques }) => {
      const etendue = premier === dernier ? `n° ${premier}` : `n° ${premier} à ${dernier}`;
      const tete = `${compte(ajoutees, 'proposition dérivée', 'propositions dérivées')} de n° ${depart} (${etendue})`;
      let rangs = '';
      if (meilleure !== null) {
        rangs = ajoutees === 1 ? ` ; elle est ${place(placeMeilleure)} du classement` : ` ; la meilleure, n° ${meilleure}, est ${place(placeMeilleure)} du classement`;
      }
      if (placeDepart !== null) rangs += ` ; n° ${depart} est ${place(placeDepart)}${meilleure === null ? ' du classement' : ''}`;
      return `${tete}${rangs}${ecartees(identiques)}.`;
    },
  ],
  // Toutes les propositions calculées égalent leur départ, et sont écartées.
  [
    'generation.issue.departSansReprise',
    ({ depart }) =>
      `La proposition n° ${depart} n'avait rien à reprendre sous ces réglages : ses propositions dérivées ` +
      "l'égalent toutes, et sont écartées.",
  ],
  ['generation.issue.annuleeCommande', "Génération annulée : rien n'est enregistré."],
  ['generation.issue.annuleeSeance', "Génération annulée par le retour en lecture : rien n'est enregistré."],
]);
