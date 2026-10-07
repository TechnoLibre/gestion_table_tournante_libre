// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les placements du fichier d'état, sous leur forme positionnelle (§ 8.9) :
// la proposition du moteur mise en forme de fichier, et le plan du moteur
// qu'on en tire ; le contrôle de cohérence d'une proposition ou du retenu ;
// leur dérive contre la charge courante ; leur forme nommée ; le partage
// d'une charge lue entre propositions gardées et écartées. Les formes sont
// décrites dans types.js et dans ce module.
//
// Fautif et périmé sont deux choses (§ 8.9, point 3). Un placement fautif se
// contredit lui-même : fautes nomme chaque contradiction, et examiner écarte
// la proposition fautive de la charge sans refuser le fichier ; chacune tombe
// seule. examiner compare aussi les identifiants des propositions entre eux
// et à prochainsIds.proposition, que l'analyse du fichier ne lit pas, et
// rend ce compteur relevé au-delà de chaque identifiant lu : aucun ne se
// réattribue. Un placement cohérent qui ne décrit plus la configuration
// courante est périmé : derive dit pourquoi, et examiner le garde (§ 9). Le
// retenu fautif est signalé et gardé : sa reprise par le .precedent
// appartient au dépôt (§ 8.8).
//
// La forme d'une proposition et du retenu suit les règles de SCHEMA, le
// schéma du fichier d'état, dont l'analyse n'applique que celle du
// conteneur : fautes applique les autres, avant toute cohérence, par le
// parcours même de l'analyse, premiereFaute, qui nomme les chemins à sa
// manière. Une liste de table porte null à la place d'une chaise vide
// (§ 8.9) : la règle l'admet à toute place, et fautes ne le garde que sous
// des sièges attribués, avant le dernier occupant, siège 1 compris. Aucune
// fonction ne modifie ce qu'elle reçoit ; aucune ne lit l'horloge ni un
// aléa.
import { SCHEMA, capacite, premiereFaute } from './document.js';
import { ErreurStockage } from './erreurs.js';

/**
 * Une faute d'un placement ; types.js en donne la table des codes. FORME :
 * une valeur sort de sa règle, la déclaration se contredit, ou une chaise
 * vide est mal placée — sans attribution des sièges, ou en fin de liste ; chemin
 * désigne l'élément fautif dans le placement, à la manière de l'analyse du
 * fichier, '' pour le placement lui-même. LONGUEUR : une longueur écrite
 * contredit celle que le placement déclare ; tour et table null désignent le
 * nombre de tours, table null seule le nombre de listes du tour. DOUBLON,
 * INCONNU, MANQUANT : un identifiant écrit plus d'une fois, écrit sans être
 * déclaré, déclaré sans être écrit, dans les listes de table et la réserve
 * d'un tour. Les tours se numérotent à partir de 1, tables et participants
 * par identifiant. Ces quatre codes sont des contradictions internes, que
 * fautes nomme. IDENTIFIANT_REPETE : une proposition cohérente porte
 * l'identifiant d'une proposition gardée avant elle.
 * IDENTIFIANT_HORS_COMPTEUR : une proposition cohérente, ou le retenu par sa
 * proposition d'origine, porte un identifiant qui atteint
 * prochainsIds.proposition. examiner seul nomme ces deux-là, en comparant
 * les propositions entre elles et à la charge.
 *
 * @typedef {{code: 'FORME', chemin: string}
 *   | {code: 'LONGUEUR', tour: number|null, table: number|null, declare: number, ecrit: number}
 *   | {code: 'DOUBLON'|'INCONNU'|'MANQUANT', tour: number, participant: number}
 *   | {code: 'IDENTIFIANT_REPETE'|'IDENTIFIANT_HORS_COMPTEUR'}} Faute
 *
 * Une raison de dérive d'un placement cohérent contre la charge courante.
 *
 * @typedef {{code: 'PARTICIPANT_EXCLU'|'PARTICIPANT_SUPPRIME'|'PARTICIPANT_NON_PLACE', participant: number}
 *   | {code: 'TABLE_SUPPRIMEE'|'TABLE_AJOUTEE', table: number}
 *   | {code: 'CAPACITE_CHANGEE', table: number, avant: number, maintenant: number}
 *   | {code: 'TOURS_CHANGES', avant: number, maintenant: number}} Raison
 *
 * Une ligne de la forme nommée : une personne placée à un tour.
 *
 * @typedef {Object} Ligne
 * @property {number} tour
 * @property {number|null} table     identifiant ; null pour la réserve
 * @property {number|null} numero    numéro affiché de la table dans la
 *                                   charge ; null pour la réserve et pour
 *                                   une table que la charge n'a plus
 * @property {number|null} siege     rang dans la liste, à partir de 1,
 *                                   chaises vides comprises, quand les
 *                                   sièges sont attribués ; null sinon
 * @property {number} participant
 * @property {string|null} nom       null pour une personne que la charge
 *                                   n'a plus
 * @property {string|null} prenom
 * @property {boolean} reserve      vrai pour une personne de la réserve ;
 *                                   une liste écrite au-delà des tables
 *                                   déclarées n'a pas de table et n'est
 *                                   pas la réserve
 *
 * Ce que rend examiner.
 *
 * @typedef {Object} Examen
 * @property {import('./types.js').Charge} charge   sans les propositions
 *           fautives, son compteur des propositions relevé au-delà de chaque
 *           identifiant lu
 * @property {Array<{rang: number, id: number|null, fautes: Faute[]}>} fautives
 *           par rang dans la liste lue ; id null quand il ne se lit pas
 * @property {Array<{id: number, raisons: Raison[]}>} derives   par identifiant
 * @property {{fautes: Faute[], raisons: Raison[]}} retenu
 */

// Règle du champ cle d'un objet du schéma.
const regleDuChamp = (regle, cle) => regle.champs.find(([nom]) => nom === cle)[1];
const CHARGE = regleDuChamp(SCHEMA, 'charge');
// Règles d'une proposition et du retenu. Aucune des valeurs qu'elles
// contiennent n'admet null, hors de l'occupant d'une liste de table, la
// chaise vide ; examiner traite le retenu nul, son absence, avant de lire
// le retenu.
const PROPOSITION = regleDuChamp(CHARGE, 'propositions').element;
const RETENU = regleDuChamp(CHARGE, 'retenu');
const IDENTIFIANT = regleDuChamp(PROPOSITION, 'id');

const croissant = (a, b) => a - b;
// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Chemin du second exemplaire du premier identifiant que liste porte deux
// fois, ou null.
function doublon(liste, nom) {
  const vus = new Set();
  for (let rang = 0; rang < liste.length; rang += 1) {
    if (vus.has(liste[rang])) return `${nom}[${rang}]`;
    vus.add(liste[rang]);
  }
  return null;
}

// Chemin de la première contradiction de la déclaration d'un placement de
// forme conforme, ou null, dans l'ordre du schéma : une table déclarée deux
// fois ; des capacités qui ne correspondent pas aux tables rang à rang ; un
// participant déclaré deux fois. D'un doublon, le second est nommé, comme
// l'analyse le fait des identifiants de la charge.
function fauteDeDeclaration({ tables, capacites, participants }) {
  return (
    doublon(tables, 'tables')
    ?? (capacites.length === tables.length ? null : 'capacites')
    ?? doublon(participants, 'participants')
  );
}

// Chemin de la première chaise vide mal placée d'un placement de forme et
// de déclaration conformes, ou null, dans l'ordre des tours, des listes et
// des rangs : un null sous siegesAttribues faux, où l'ordre d'une liste ne
// dit aucun siège, ou au dernier rang d'une liste, qu'une écriture sans
// lui dit pareil. Le chemin suit la convention de premiereFaute.
function fauteDeChaiseVide({ siegesAttribues, placement }) {
  for (let tour = 0; tour < placement.length; tour += 1) {
    const { sieges } = placement[tour];
    for (let table = 0; table < sieges.length; table += 1) {
      const liste = sieges[table];
      const rang = siegesAttribues ? liste.length - 1 : liste.indexOf(null);
      if (rang >= 0 && liste[rang] === null) return `placement[${tour}].sieges[${table}][${rang}]`;
    }
  }
  return null;
}

// Fautes de cohérence d'un placement de forme et de déclaration conformes
// (§ 8.9, points 1 et 2). D'abord le nombre de tours écrits contre celui
// déclaré. Puis, tour après tour : le nombre de listes de table contre celui
// des tables déclarées ; la longueur de chaque liste appariée à une table
// déclarée, dans l'ordre déclaré, contre sa capacité, chaises vides
// comprises ; le multiensemble du tour, listes de table et réserve
// comprises, où chaque identifiant déclaré figure exactement une fois —
// doublons, inconnus, puis manquants, chacun nommé une fois par tour, par
// identifiant croissant. Une chaise vide n'y entre pas.
//
// La capacité borne une liste sans la fixer : quand la salle offre plus de
// sièges que de personnes, des tables gardent des places vides, et une liste
// plus courte que sa capacité n'est pas fautive. Un décalage qui remplit une
// table au-delà de sa capacité l'est.
//
// Les occurrences d'un tour se comptent dans un Map ; aucune décision ne
// suit son ordre : doublons et manquants se lisent dans l'ordre des
// identifiants déclarés, triés, et les inconnus se trient avant d'être
// nommés.
function fautesDeCoherence({ tables, capacites, tours, participants, placement }) {
  const liste = [];
  if (placement.length !== tours) {
    liste.push({ code: 'LONGUEUR', tour: null, table: null, declare: tours, ecrit: placement.length });
  }
  const declares = [...participants].sort(croissant);
  const estDeclare = new Set(declares);
  placement.forEach(({ sieges, reserve }, rang) => {
    const tour = rang + 1;
    if (sieges.length !== tables.length) {
      liste.push({ code: 'LONGUEUR', tour, table: null, declare: tables.length, ecrit: sieges.length });
    }
    const appariees = Math.min(sieges.length, tables.length);
    for (let i = 0; i < appariees; i += 1) {
      if (sieges[i].length > capacites[i]) {
        liste.push({ code: 'LONGUEUR', tour, table: tables[i], declare: capacites[i], ecrit: sieges[i].length });
      }
    }
    const occurrences = new Map();
    const inconnus = [];
    for (const ids of [...sieges, reserve]) {
      for (const id of ids) {
        if (id === null) continue;
        const deja = occurrences.get(id) ?? 0;
        occurrences.set(id, deja + 1);
        if (deja === 0 && !estDeclare.has(id)) inconnus.push(id);
      }
    }
    for (const id of declares) {
      if (occurrences.get(id) > 1) liste.push({ code: 'DOUBLON', tour, participant: id });
    }
    for (const id of inconnus.sort(croissant)) liste.push({ code: 'INCONNU', tour, participant: id });
    for (const id of declares) {
      if (!occurrences.has(id)) liste.push({ code: 'MANQUANT', tour, participant: id });
    }
  });
  return liste;
}

// Fautes de valeur sous regle : la première faute de forme, de
// déclaration ou de chaise vide seule, qui rend la cohérence illisible ;
// sinon les fautes de cohérence.
function fautesSelon(valeur, regle) {
  const chemin = premiereFaute(valeur, regle) ?? fauteDeDeclaration(valeur) ?? fauteDeChaiseVide(valeur);
  return chemin === null ? fautesDeCoherence(valeur) : [{ code: 'FORME', chemin }];
}

/**
 * Fautes internes d'un placement, proposition ou retenu (§ 8.9, points 1 et
 * 2) : il se compare à lui-même, jamais à la charge. La règle est celle du
 * retenu quand p porte la clé proposition, celle d'une proposition sinon.
 *
 * La forme se contrôle d'abord, dans l'ordre du schéma, puis la
 * déclaration, puis les chaises vides : null, admis par la règle d'une
 * liste de table, n'y est cohérent que sous des sièges attribués et avant
 * le dernier rang. La première de ces fautes est seule rendue,
 * { code: 'FORME', chemin }. Sinon, dans l'ordre des tours puis des tables :
 * { code: 'LONGUEUR', tour, table, declare, ecrit } — tour null pour le
 * nombre de tours, rendu en premier ; table null pour le nombre de listes
 * d'un tour ; une table pour une liste plus longue que sa capacité — puis,
 * dans chaque tour, { code: 'DOUBLON'|'INCONNU'|'MANQUANT', tour,
 * participant } par identifiant croissant. Rend [] pour un placement
 * cohérent ; ne lève jamais.
 *
 * Une permutation dans une table, ou l'échange du contenu de deux tables de
 * même capacité, gardent longueurs et multiensemble : rien dans le fichier
 * ne les distingue d'un placement légitime, et fautes rend [].
 *
 * @param {*} p
 * @returns {Faute[]}
 */
export function fautes(p) {
  const retenu = typeof p === 'object' && p !== null && Object.hasOwn(p, 'proposition');
  return fautesSelon(p, retenu ? RETENU : PROPOSITION);
}

// Lève TypeError, au nom de fonction, quand p n'est pas un placement
// cohérent : le lire rendrait sans le dire une lecture fausse.
function exigerCoherent(p, fonction) {
  const [premiere] = fautes(p);
  if (premiere !== undefined) throw new TypeError(`${fonction} : placement fautif ${JSON.stringify(premiere)}`);
}

/**
 * Forme de fichier d'une proposition du moteur (§ 8.9). Son identifiant est
 * decalage + proposition.id : la place de la proposition dans la suite des
 * graines dérivées de sa génération (§ 5.7), que le moteur numérote à partir
 * de 1, décalée au-delà de tout identifiant de proposition jamais attribué.
 * L'appelant passe pour decalage prochainsIds.proposition − 1, ce compteur
 * lu dans la charge qu'examiner rend, puis porte le compteur au-delà du
 * dernier identifiant écrit. examiner le relève au-delà de chaque
 * identifiant que le fichier porte, propositions écartées et origine du
 * retenu comprises : ce compteur dépasse les identifiants de la liste, celui
 * de la proposition d'origine du retenu et ceux qu'un effacement a retirés,
 * et ne recule jamais, même abaissé à la main dans le fichier. Les
 * générations s'accumulent ainsi (§ 5.7) sans répéter ni réattribuer un
 * identifiant, et examiner, qui écarte à l'ouverture la seconde proposition
 * d'un identifiant répété, les garde toutes.
 *
 * Elle porte ensuite graine, arret et historique de la proposition,
 * produitVersion, et siegesAttribues, qui vaut attribuerSieges au moment où
 * elle est produite ; puis ce que la configuration déclare : les tables du
 * plan, dans l'ordre de ses listes, chacune avec sa capacité dans la
 * configuration, lue par identifiant ; le nombre de tours ; les participants
 * non exclus, par identifiant croissant. Le placement reprend le plan tour
 * par tour : sans attribution de sièges, chaque liste de table se trie par
 * identifiant croissant ; avec, elle garde son ordre, celui des sièges, et
 * ses chaises vides, null. La réserve, un ensemble, se trie dans les deux
 * cas. Les clés suivent l'ordre
 * du schéma ; rien n'est partagé avec les arguments, qui ne sont pas
 * modifiés.
 *
 * Lève ErreurStockage('COMPTEUR_SATURE', { compteur: 'proposition' }), sans
 * rien rendre, quand l'identifiant atteint 2^31 − 1, le plus grand
 * qu'admette la règle d'un identifiant, que suit aussi le compteur, qui
 * n'aurait alors aucune valeur au-delà de lui. Un fichier valide y mène — un
 * compteur écrit à la main à 2^31 − 1, ou un identifiant qui l'y relève — et
 * le compteur ne recule jamais : l'appelant lit ce code avant d'écrire la
 * génération. Lève TypeError, sans rien rendre, quand decalage n'est pas un
 * entier ≥ 0, ou quand la forme produite serait fautive : attribuerSieges
 * qui n'est pas un booléen, version vide ou absente, réglage hors de son
 * domaine, plan que la configuration contredit — table inconnue d'elle,
 * nombre de tours, personne non placée, liste au-delà d'une capacité,
 * chaise vide sans attribution ou en fin de liste.
 *
 * @param {import('../moteur/recherche.js').Proposition} proposition
 * @param {import('../moteur/types.js').Configuration} configuration
 * @param {{produitVersion: string, attribuerSieges: boolean, decalage: number}} options
 * @returns {import('./types.js').PropositionFichier}
 */
export function versFichier(proposition, configuration, { produitVersion, attribuerSieges, decalage }) {
  // Le décalage se contrôle avant la forme : négatif, il peut rendre un
  // identifiant que la forme admet et qu'une autre proposition porte déjà.
  if (!Number.isSafeInteger(decalage) || decalage < 0) {
    throw new TypeError(`versFichier : décalage entier ≥ 0 attendu, reçu ${JSON.stringify(decalage)}`);
  }
  // Le compteur que l'appelant porte au-delà de l'identifiant écrit suit la
  // règle d'un identifiant : un identifiant qui atteint le plus grand
  // qu'elle admet ne laisserait aucun compteur au-delà de lui.
  const identifiant = decalage + proposition.id;
  if (identifiant >= IDENTIFIANT.max) throw new ErreurStockage('COMPTEUR_SATURE', { compteur: 'proposition' });
  const { plan } = proposition;
  const capaciteDe = new Map(configuration.tables.map(({ id, capacite: places }) => [id, places]));
  const ordonner = (liste) => (attribuerSieges ? [...liste] : [...liste].sort(croissant));
  const fichier = {
    id: identifiant,
    graine: proposition.graine,
    arret: proposition.arret,
    historique: proposition.historique,
    produitVersion,
    siegesAttribues: attribuerSieges,
    tables: [...plan.tables],
    capacites: plan.tables.map((id) => capaciteDe.get(id)),
    tours: configuration.tours,
    participants: configuration.participants
      .filter(({ exclu }) => exclu !== true)
      .map(({ id }) => id)
      .sort(croissant),
    placement: plan.tours.map((listes, rang) => ({
      sieges: listes.map((liste) => ordonner(liste)),
      reserve: [...plan.reserves[rang]].sort(croissant),
    })),
  };
  exigerCoherent(fichier, 'versFichier');
  return fichier;
}

/**
 * Plan du moteur d'un placement de fichier, proposition ou retenu : les
 * tables dans l'ordre déclaré, chaque liste de table sans ses chaises
 * vides, et chaque réserve, par identifiant croissant, comme le moteur les
 * rend ; l'ordre des sièges n'y entre pas. Aucune liste n'est partagée avec p. Lève TypeError quand p
 * n'est pas cohérent (fautes).
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @returns {import('../moteur/types.js').Plan}
 */
export function planDepuisFichier(p) {
  exigerCoherent(p, 'planDepuisFichier');
  return {
    tables: [...p.tables],
    tours: p.placement.map(({ sieges }) => sieges.map((liste) => liste.filter((id) => id !== null).sort(croissant))),
    reserves: p.placement.map(({ reserve }) => [...reserve].sort(croissant)),
  };
}

// Code, comparé unité UTF-16 par unité, puis identifiant du participant ou
// de la table que la raison désigne ; TOURS_CHANGES n'en désigne aucun et
// n'apparaît qu'une fois.
const ordreDesRaisons = (a, b) =>
  comparerTextes(a.code, b.code) || (a.participant ?? a.table ?? 0) - (b.participant ?? b.table ?? 0);

// Raisons de dérive d'un placement cohérent, sans contrôle : derive les
// rend après l'avoir contrôlé, examiner après l'avoir fait lui-même.
function raisonsDeDerive({ tables, capacites, tours, participants }, charge) {
  const raisons = [];
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const places = new Set(participants);
  for (const id of participants) {
    const personne = personneDe.get(id);
    if (personne === undefined) raisons.push({ code: 'PARTICIPANT_SUPPRIME', participant: id });
    else if (personne.exclu) raisons.push({ code: 'PARTICIPANT_EXCLU', participant: id });
  }
  for (const { id, exclu } of charge.participants) {
    if (!exclu && !places.has(id)) raisons.push({ code: 'PARTICIPANT_NON_PLACE', participant: id });
  }
  const tableDe = new Map(charge.tables.map((table) => [table.id, table]));
  tables.forEach((id, rang) => {
    const table = tableDe.get(id);
    if (table === undefined) {
      raisons.push({ code: 'TABLE_SUPPRIMEE', table: id });
      return;
    }
    const maintenant = capacite(charge, table);
    if (maintenant !== capacites[rang]) {
      raisons.push({ code: 'CAPACITE_CHANGEE', table: id, avant: capacites[rang], maintenant });
    }
  });
  const declarees = new Set(tables);
  for (const { id } of charge.tables) {
    if (!declarees.has(id)) raisons.push({ code: 'TABLE_AJOUTEE', table: id });
  }
  if (tours !== charge.evenement.tours) {
    raisons.push({ code: 'TOURS_CHANGES', avant: tours, maintenant: charge.evenement.tours });
  }
  return raisons.sort(ordreDesRaisons);
}

/**
 * Raisons de dérive d'un placement cohérent, proposition ou retenu, contre
 * la charge courante (§ 8.9, point 3 ; § 9) : ce qu'il déclare comparé à la
 * configuration d'aujourd'hui. Une personne qu'il place et que la charge
 * exclut (§ 4.4), ou n'a plus : PARTICIPANT_EXCLU, PARTICIPANT_SUPPRIME
 * {participant}. Une personne non exclue qu'il ne place pas, ajoutée ou
 * réintégrée depuis : PARTICIPANT_NON_PLACE {participant}. Une table qu'il
 * déclare et que la charge n'a plus, ou une table de la charge qu'il ne
 * déclare pas : TABLE_SUPPRIMEE, TABLE_AJOUTEE {table}. Une capacité
 * déclarée qui n'est plus la capacité courante de sa table :
 * CAPACITE_CHANGEE {table, avant, maintenant}. Un nombre de tours qui n'est
 * plus celui de l'événement : TOURS_CHANGES {avant, maintenant}.
 *
 * Triées par code, unité UTF-16 par unité, puis par identifiant ; [] quand
 * le placement décrit la configuration courante : son plan passe alors
 * indexerPlan du moteur sur elle. Noms, appartenances, numéros, positions,
 * formes de table et réglages n'entrent pas dans la dérive. Lève TypeError
 * quand p n'est pas cohérent (fautes).
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @param {import('./types.js').Charge} charge
 * @returns {Raison[]}
 */
export function derive(p, charge) {
  exigerCoherent(p, 'derive');
  return raisonsDeDerive(p, charge);
}

// Ordre d'affichage des tables : numéro croissant, une table absente de la
// charge — numéro null — après les autres ; à numéro égal, identifiant
// croissant.
const ordreDesTables = (a, b) =>
  (a.numero === null) - (b.numero === null) || a.numero - b.numero || a.id - b.id;

/**
 * Forme nommée d'un placement, proposition ou retenu (§ 8.9, point 4) : une
 * ligne par identifiant écrit à un tour, { tour, table, numero, siege,
 * participant, nom, prenom, reserve }, pour la lecture et le signalement
 * d'un défaut. Les lignes se rangent par tour, puis par numéro de table —
 * une table que la charge n'a plus vient après les autres, sans numéro, et
 * l'identifiant départage deux numéros égaux —, puis par rang dans la
 * liste ; la réserve suit les tables de son tour, table et numéro null.
 * siege est le rang à partir de 1 quand le placement attribue les sièges,
 * null sinon et dans la réserve ; une chaise vide, null dans la liste,
 * garde son rang et n'a pas de ligne. Nom et prénom viennent de la charge ; une
 * personne qu'elle n'a plus, ou qu'elle n'a jamais eue, les a null.
 *
 * Un placement incohérent (fautes : LONGUEUR, DOUBLON, INCONNU, MANQUANT)
 * se rend tel qu'il est écrit, pour que son défaut se lise : un identifiant
 * écrit deux fois donne deux lignes, un manquant aucune ; les tours écrits,
 * qu'ils soient plus ou moins nombreux que ceux déclarés ; une table
 * déclarée sans liste n'a pas de ligne, et une liste écrite au-delà des
 * tables déclarées suit les tables de son tour, sans table ni numéro, avant
 * la réserve. Ses fautes se lisent par fautes(p), que l'appelant rend à
 * côté. Lève TypeError quand la forme ou la déclaration de p est fausse
 * (faute FORME) : ses listes ne se lisent pas.
 *
 * @param {import('./types.js').PropositionFichier|import('./types.js').Retenu} p
 * @param {import('./types.js').Charge} charge
 * @returns {Ligne[]}
 */
export function formeNommee(p, charge) {
  const [premiere] = fautes(p);
  if (premiere?.code === 'FORME') throw new TypeError(`formeNommee : placement fautif ${JSON.stringify(premiere)}`);
  const personneDe = new Map(charge.participants.map((personne) => [personne.id, personne]));
  const numeroDe = new Map(charge.tables.map(({ id, numero }) => [id, numero]));
  const tables = p.tables
    .map((id, rang) => ({ id, rang, numero: numeroDe.get(id) ?? null }))
    .sort(ordreDesTables);
  const lignes = [];
  const ajouter = (tour, table, numero, siege, participant, reserve) => {
    const personne = personneDe.get(participant);
    lignes.push({
      tour,
      table,
      numero,
      siege,
      participant,
      nom: personne?.nom ?? null,
      prenom: personne?.prenom ?? null,
      reserve,
    });
  };
  // Les personnes d'une liste de table, sans table pour une liste écrite
  // au-delà des tables déclarées.
  const ajouterListe = (tour, ids, table, numero) => {
    ids.forEach((participant, position) => {
      if (participant === null) return;
      ajouter(tour, table, numero, p.siegesAttribues ? position + 1 : null, participant, false);
    });
  };
  p.placement.forEach(({ sieges, reserve }, rangDuTour) => {
    const tour = rangDuTour + 1;
    for (const { id, rang, numero } of tables) ajouterListe(tour, sieges[rang] ?? [], id, numero);
    for (const ids of sieges.slice(p.tables.length)) ajouterListe(tour, ids, null, null);
    for (const participant of reserve) ajouter(tour, null, null, null, participant, true);
  });
  return lignes;
}

// valeur quand elle est un identifiant de proposition, null sinon : un
// entier au-delà de 2^31 − 1 n'en est pas un.
const identifiantLisible = (valeur) => (premiereFaute(valeur, IDENTIFIANT) === null ? valeur : null);

// Compteur des propositions de la charge que rend examiner : celui de la
// charge, relevé au-delà de plusGrand, le plus grand identifiant lu, 0 quand
// aucun ne se lit ; il ne recule jamais. Le compteur suit la règle d'un
// identifiant : relevé, il s'arrête au plus grand qu'elle admet, 2^31 − 1,
// et un identifiant de cette valeur reste hors de lui.
const compteurReleve = (charge, plusGrand) =>
  Math.max(charge.prochainsIds.proposition, Math.min(plusGrand + 1, IDENTIFIANT.max));

// Faute d'un identifiant de proposition que la charge a attribué au-delà de
// son compteur, ou [] : prochainsIds.proposition dépasse tout identifiant
// attribué (§ 5.7).
const fautesDuCompteur = (id, charge) =>
  id >= charge.prochainsIds.proposition ? [{ code: 'IDENTIFIANT_HORS_COMPTEUR' }] : [];

// Fautes et raisons du retenu, examiné sous sa propre règle. Un retenu qui
// se contredit n'a que ses fautes ; un retenu cohérent a ses raisons de
// dérive, et la faute d'une proposition d'origine qui atteint le compteur ;
// un retenu nul n'a ni l'un ni l'autre.
function examinerRetenu(charge) {
  const { retenu } = charge;
  if (retenu === null) return { fautes: [], raisons: [] };
  const liste = fautesSelon(retenu, RETENU);
  if (liste.length > 0) return { fautes: liste, raisons: [] };
  return { fautes: fautesDuCompteur(retenu.proposition, charge), raisons: raisonsDeDerive(retenu, charge) };
}

/**
 * Partage les placements d'une charge lue (§ 8.9, point 3). L'analyse du
 * fichier admet toute proposition et tout retenu ; examiner les contrôle.
 *
 * Chaque élément de la liste est examiné dans son ordre, sous la règle
 * d'une proposition, même quand il porte la clé d'un retenu : fautif, il
 * est écarté et nommé dans fautives, { rang, id, fautes }, rang étant sa
 * place dans la liste et id son identifiant, null quand il n'en est pas un ;
 * cohérente, elle est gardée, et ses raisons de dérive, s'il y en a, vont
 * dans derives, { id, raisons }, rangées par identifiant. Une proposition
 * cohérente qui porte l'identifiant d'une proposition déjà gardée est
 * fautive, { code: 'IDENTIFIANT_REPETE' } ; celle dont l'identifiant atteint
 * prochainsIds.proposition aussi, { code: 'IDENTIFIANT_HORS_COMPTEUR' } :
 * l'identifiant d'une proposition est unique dans la charge rendue, et sous
 * le compteur, et le fichier s'ouvre sans elle. Un compteur abaissé écarte
 * ainsi les propositions qu'il ne couvre plus, qui se recalculent, sans
 * fermer la saisie. Une proposition écartée n'en écarte aucune autre : une
 * cohérente qui porte l'identifiant d'une fautive n'est pas une répétition,
 * et une fautive se nomme par ses propres fautes.
 *
 * Le retenu n'est jamais retiré : retenu porte ses fautes, sous la règle du
 * retenu. Cohérent, il porte aussi ses raisons de dérive, et pour faute
 * { code: 'IDENTIFIANT_HORS_COMPTEUR' } quand sa proposition d'origine
 * atteint prochainsIds.proposition. Un retenu nul n'a ni l'un ni l'autre.
 *
 * Ces fautes se jugent contre le compteur reçu. La charge rendue porte le
 * compteur relevé au-delà de chaque identifiant lu : prochainsIds.proposition
 * y vaut le plus grand du compteur reçu et du plus grand identifiant lu plus
 * un — celui de chaque élément de la liste, gardé ou écarté, quelle que soit
 * sa faute, et la proposition d'origine du retenu, fautif ou non ; une
 * valeur qui n'est pas un identifiant, un entier au-delà de 2^31 − 1
 * compris, n'y entre pas : la proposition qui la porte est fautive, FORME,
 * le retenu aussi. Le compteur ne recule donc jamais, et une génération
 * numérotée depuis lui, comme le dit versFichier, ne réattribue ni
 * l'identifiant d'une proposition écartée ni celui de l'origine du retenu :
 * le retenu ne désigne jamais une autre proposition que la sienne. Le
 * compteur suit la règle d'un identifiant, qui s'arrête à 2^31 − 1 ; un
 * identifiant de cette valeur reste hors de lui, et
 * IDENTIFIANT_HORS_COMPTEUR le nomme tant que le fichier le porte. Un
 * compteur à 2^31 − 1 ne numérote plus aucune génération : versFichier lève
 * COMPTEUR_SATURE.
 *
 * Rend une charge neuve, dont propositions ne porte que les gardées, dans
 * l'ordre de la liste, et prochainsIds un objet neuf, son compteur des
 * propositions relevé ; tout le reste, propositions gardées et retenu
 * compris, est celui de la charge reçue, qui n'est pas modifiée. Cette
 * charge s'écrit et se compare telle quelle : chaque proposition y suit sa
 * règle, et un retenu qui ne suit pas la sienne, canonique.js le recopie
 * hors du schéma (retenuHorsDeSaRegle).
 *
 * @param {import('./types.js').Charge} charge
 * @returns {Examen}
 */
export function examiner(charge) {
  const gardees = [];
  const fautives = [];
  const derives = [];
  const identifiants = new Set();
  let plusGrand = identifiantLisible(charge.retenu?.proposition) ?? 0;
  charge.propositions.forEach((proposition, rang) => {
    const id = identifiantLisible(proposition?.id);
    plusGrand = Math.max(plusGrand, id ?? 0);
    let liste = fautesSelon(proposition, PROPOSITION);
    if (liste.length === 0 && identifiants.has(proposition.id)) liste = [{ code: 'IDENTIFIANT_REPETE' }];
    if (liste.length === 0) liste = fautesDuCompteur(proposition.id, charge);
    if (liste.length > 0) {
      fautives.push({ rang, id, fautes: liste });
      return;
    }
    identifiants.add(proposition.id);
    gardees.push(proposition);
    const raisons = raisonsDeDerive(proposition, charge);
    if (raisons.length > 0) derives.push({ id: proposition.id, raisons });
  });
  derives.sort((a, b) => a.id - b.id);
  const prochainsIds = { ...charge.prochainsIds, proposition: compteurReleve(charge, plusGrand) };
  return {
    charge: { ...charge, prochainsIds, propositions: gardees },
    fautives,
    derives,
    retenu: examinerRetenu(charge),
  };
}
