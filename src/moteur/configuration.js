// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Passage de la configuration, forme par identifiants, à l'instance indexée
// que consomme le moteur (§ 4, § 4.5, § 5.2), et conversion d'un plan entre
// ses deux formes (§ 8.9). Les formes sont décrites dans types.js.
//
// L'instance porte aussi la présence de chacun à chaque tour, en masque, avec
// ses comptes et la co-présence que lit le plafond ; les étiquettes de
// chacun, en index, que lit la diversité par animateur ; et ce que les
// critères des objectifs et des animateurs lisent, calculé une fois par
// configuration : l'objectif en vigueur à chaque table et chaque tour, la
// correspondance de chaque personne à chaque objectif distinct, ses couples
// (personne, tour) possibles, les animateurs de chaque table à chaque tour et
// la borne des animateurs de chacun ; puis l'état de chaque critère et la
// liste des priorités complète.
//
// Ce module définit aussi, une seule fois pour tout le moteur (§ 13.2), ce
// que les autres modules lisent de ces formes : les valeurs du contrat —
// STATUT, LIBRE, RESERVE, SANS_GROUPE —, la garde de forme d'un plan indexé,
// le nombre de places d'un tour, et la répartition des personnes entre les
// trois populations du § 5.4. Les autres modules et leurs épreuves les
// importent, sans en redéfinir aucun.
//
// La présence se lit par toursDePresence (presence.js), la seule lecture de
// la règle « champ absent = tous les tours ». Une personne absente à un tour
// n'y a ni table imposée ni couple possible : sa réservation y est suspendue,
// comme celle d'un exclu l'est pour la soirée (§ 4.4), et dans un plan indexé
// elle vaut RESERVE, que seul instance.present distingue de la réserve. Sans
// aucune absence (instance.absences = 0), chaque champ garde la valeur qu'il
// aurait sans le champ presence.
//
// Trois familles de refus :
// - ErreurConfiguration, avec un code, pour ce qu'une saisie, un import ou un
//   plan périmé peut porter : une donnée incohérente avec le reste de la
//   configuration, ou une capacité, un nombre de tours, un tour désigné hors
//   de son domaine ;
// - TypeError, quand la configuration sort de l'une des formes que garantit
//   le code qui la bâtit — stockage, import, interface — et qu'aucune saisie
//   ne produit : un identifiant de participant ou de table qui n'est pas un
//   entier ≥ 1, une organisation ni chaîne ni null, un exclu présent et non
//   booléen, une portée ni « tous » ni « tour », des contraintes qui ne sont
//   pas un objet de quatre booléens, ou dont une case facultative présente
//   n'est pas booléenne, une liste qui n'est pas un tableau, des étiquettes
//   qui ne sont pas une liste de chaînes, une règle d'objectif ni « ou » ni
//   « et », un mode des objectifs inconnu, des tours animés qui ne croissent
//   pas strictement, une présence qui n'est pas une liste strictement
//   croissante. Ces formes sont les seules que normaliser contrôle par
//   TypeError ; une valeur qui en sort est une faute de l'appelant, qu'aucune
//   valeur par défaut ne masque ;
// - RangeError, pour un plan indexé qui n'a pas la forme de l'instance : seul
//   le moteur produit cette forme, et l'écart y est une faute de code.
//
// Les champs que normaliser ne lit pas — nom, prénom, numéro de table — ne
// sont pas examinés, pas plus que les clés des contraintes autres que les six
// qu'il copie : le moteur ne parcourt les clés d'aucun objet. Aucune fonction
// ne modifie ce qu'elle reçoit.
import { correspondA } from './correspondance.js';
import {
  CRITERES,
  MODES_OBJECTIFS,
  PRIORITES_PAR_DEFAUT,
  completerPriorites,
  estCoche,
  valeursQuiClassent,
  verifierPriorites,
} from './criteres.js';
import { ErreurConfiguration } from './erreurs.js';
import { toursDePresence } from './presence.js';

/**
 * Statuts d'un participant (§ 4.2), valeurs de instance.statut. normaliser
 * les dérive des réservations ; aucun n'est déclaré. Un partiellement fixé
 * compte parmi les mobiles dans les populations du § 5.4.
 */
export const STATUT = Object.freeze({ MOBILE: 0, PARTIELLEMENT_FIXE: 1, ANCRE: 2 });

/** Case de instance.fixe sans table imposée. */
export const LIBRE = -1;

/**
 * Case d'un plan indexé : la réserve. Elle vaut LIBRE, et une rangée de
 * instance.fixe se lit ainsi comme le plan qui assied chacun à ses seuls
 * tours fixés et le laisse en réserve aux autres : le diagnostic mesure ce
 * plan, le plafond a priori part de cet itinéraire. Une personne absente à
 * un tour y vaut aussi RESERVE, dans fixe comme dans tout plan indexé.
 */
export const RESERVE = -1;

/** instance.groupe d'un participant sans organisation. */
export const SANS_GROUPE = -1;

/** Case de instance.objectifDe d'une table sans objectif en vigueur au tour. */
export const SANS_OBJECTIF = -1;

/** instance.rangAnimateur d'une personne qui n'anime à aucun tour. */
export const NON_ANIMATEUR = -1;

// Case d'un plan indexé qu'indexerPlan n'a pas encore remplie ; jamais rendue.
const NON_PLACE = -2;

// Plus grand entier que représente un Int32Array : une capacité au-delà s'y
// tronquerait sans bruit.
const ENTIER_32_MAX = 2 ** 31 - 1;

const NOMS_CONTRAINTES = [
  'separerOrganisations',
  'nouveauxVoisins',
  'nouvelleTable',
  'varierOrganisations',
];

// Les deux cases facultatives (A16), absentes à leur défaut : la copie ne les
// porte que quand la configuration les porte.
const CONTRAINTES_FACULTATIVES = ['respecterObjectifs', 'rencontrerAnimateurs'];

// Le mode des objectifs d'une configuration qui n'en porte pas (D20).
const MODE_PAR_DEFAUT = MODES_OBJECTIFS[0];

// Valeur citée dans un message : une chaîne entre guillemets, pour qu'elle
// ne se lise pas comme le nombre qu'elle contient ; toute autre valeur telle
// quelle.
export const decrire = (valeur) => (typeof valeur === 'string' ? JSON.stringify(valeur) : String(valeur));

function exigerListe(valeur, nom) {
  if (!Array.isArray(valeur)) throw new TypeError(`configuration.${nom} : liste attendue`);
}

function exigerIdentifiant(id, quoi) {
  if (!Number.isInteger(id) || id < 1) {
    throw new TypeError(`${quoi} d'identifiant ${decrire(id)} : entier ≥ 1 attendu`);
  }
}

function exigerOrganisation({ id, organisation }) {
  if (organisation !== null && typeof organisation !== 'string') {
    throw new TypeError(
      `participant ${id} : organisation chaîne ou null attendue, reçu ${decrire(organisation)}`,
    );
  }
}

// Vrai pour un participant exclu ; un champ exclu absent vaut false.
function estExclu({ id, exclu }) {
  if (exclu === undefined) return false;
  if (typeof exclu !== 'boolean') {
    throw new TypeError(`participant ${id} : exclu booléen attendu, reçu ${decrire(exclu)}`);
  }
  return exclu;
}

// Lève TypeError quand valeurs n'est pas une liste de chaînes ; quoi nomme
// la liste dans le message.
function exigerEtiquettes(valeurs, quoi) {
  if (!Array.isArray(valeurs) || !valeurs.every((valeur) => typeof valeur === 'string')) {
    throw new TypeError(`${quoi} : liste de chaînes attendue`);
  }
}

// Copie des quatre contraintes, puis des deux cases facultatives que la
// configuration porte : une modification ultérieure de la configuration
// n'atteint pas l'instance. Aucune autre clé n'est lue.
function copierContraintes(contraintes) {
  if (typeof contraintes !== 'object' || contraintes === null) {
    throw new TypeError('configuration.contraintes : objet attendu');
  }
  const copie = {};
  for (const nom of NOMS_CONTRAINTES) {
    if (typeof contraintes[nom] !== 'boolean') {
      throw new TypeError(`contrainte ${nom} : booléen attendu, reçu ${decrire(contraintes[nom])}`);
    }
    copie[nom] = contraintes[nom];
  }
  for (const nom of CONTRAINTES_FACULTATIVES) {
    if (contraintes[nom] === undefined) continue;
    if (typeof contraintes[nom] !== 'boolean') {
      throw new TypeError(`contrainte ${nom} : booléen attendu, reçu ${decrire(contraintes[nom])}`);
    }
    copie[nom] = contraintes[nom];
  }
  return copie;
}

// Le mode des objectifs : MODE_PAR_DEFAUT quand la configuration n'en porte
// pas ; TypeError pour un mode hors de MODES_OBJECTIFS.
function lireMode(mode) {
  if (mode === undefined) return MODE_PAR_DEFAUT;
  if (!MODES_OBJECTIFS.includes(mode)) {
    throw new TypeError(`configuration.modeObjectifs : ${decrire(mode)}, l'un de ${MODES_OBJECTIFS.join(', ')} attendu`);
  }
  return mode;
}

// Groupe de chaque participant présent, présents triés par identifiant
// croissant : un libellé reçoit le numéro de sa première apparition,
// SANS_GROUPE marque l'absence d'organisation. L'égalité de chaînes fait le
// groupe. La Map ne sert qu'à retrouver un libellé déjà numéroté.
function numeroterGroupes(presents) {
  const groupe = new Int32Array(presents.length);
  const groupes = [];
  const numeroDe = new Map();
  for (let p = 0; p < presents.length; p += 1) {
    const { organisation } = presents[p];
    if (organisation === null) {
      groupe[p] = SANS_GROUPE;
      continue;
    }
    if (!numeroDe.has(organisation)) {
      numeroDe.set(organisation, groupes.length);
      groupes.push(organisation);
    }
    groupe[p] = numeroDe.get(organisation);
  }
  return { groupe, groupes };
}

// Les étiquettes des présents en index (D39). libellesEtiquettes porte les
// étiquettes distinctes que les présents portent, rangées par unités de
// code, sans égard à la langue : l'égalité de chaînes fait l'étiquette,
// comme le groupe. Les étiquettes de la personne p vont, dans etiquettes, de
// debutEtiquettes[p] à debutEtiquettes[p + 1] : leurs index, croissants,
// chacun une fois, même quand sa liste en répète un. Sans étiquette,
// libellesEtiquettes et etiquettes sont vides et debutEtiquettes ne porte que
// des zéros. La Map ne sert qu'à retrouver l'index d'un libellé. Le coût suit
// le nombre total d'étiquettes portées, plus le tri des distinctes.
function indexerEtiquettes(presents) {
  const libellesEtiquettes = [...new Set(presents.flatMap(({ etiquettes = [] }) => etiquettes))].sort();
  const indexDe = new Map(libellesEtiquettes.map((libelle, e) => [libelle, e]));
  const debutEtiquettes = new Int32Array(presents.length + 1);
  const etiquettes = [];
  presents.forEach(({ etiquettes: siennes = [] }, p) => {
    const index = siennes.map((libelle) => indexDe.get(libelle)).sort((a, b) => a - b);
    index.forEach((e, i) => {
      if (i === 0 || e !== index[i - 1]) etiquettes.push(e);
    });
    debutEtiquettes[p + 1] = etiquettes.length;
  });
  return { debutEtiquettes, etiquettes: Int32Array.from(etiquettes), libellesEtiquettes };
}

// Contrôle la présence de chaque participant, exclus compris, dans l'ordre de
// la configuration : un champ absent n'a rien à contrôler ; sinon une liste,
// non vide, de tours entiers de 1 à R, strictement croissants. Lève TypeError
// pour une valeur qui n'est pas une liste ou un ordre qui ne croît pas
// strictement, PRESENCE_VIDE pour une liste vide, PRESENCE_TOUR pour le
// premier tour hors de 1..R, contrôlé avant l'ordre de ce tour.
function exigerPresences(participants, R) {
  for (const { id, presence } of participants) {
    if (presence === undefined) continue;
    if (!Array.isArray(presence)) throw new TypeError(`participant ${id} : présence en liste attendue`);
    if (presence.length === 0) throw new ErreurConfiguration('PRESENCE_VIDE', { participant: id });
    let precedent = 0;
    for (const tour of presence) {
      if (!Number.isInteger(tour) || tour < 1 || tour > R) {
        throw new ErreurConfiguration('PRESENCE_TOUR', { participant: id, tour });
      }
      if (tour <= precedent) throw new TypeError(`participant ${id} : tours de présence strictement croissants attendus`);
      precedent = tour;
    }
  }
}

// Le masque de présence des présents, rangés par index : present[p × R + r]
// vaut 1 quand p est présent au tour r, lu par toursDePresence ;
// toursPresents[p], ses tours de présence, au moins 1 ; presentsParTour[r],
// n_r ; absences, Σ_p (R − toursPresents[p]), qui vaut 0 quand chacun est
// présent à chaque tour.
function masquerPresences(presents, N, R) {
  const present = new Uint8Array(N * R);
  const toursPresents = new Int32Array(N);
  const presentsParTour = new Int32Array(R);
  let absences = 0;
  for (let p = 0; p < N; p += 1) {
    const tours = toursDePresence(presents[p], R);
    for (const tour of tours) {
      present[p * R + tour - 1] = 1;
      presentsParTour[tour - 1] += 1;
    }
    toursPresents[p] = tours.length;
    absences += R - tours.length;
  }
  return { present, toursPresents, presentsParTour, absences };
}

// Nombre de bits à 1 d'un entier de 32 bits.
function bitsA1(mot) {
  let x = mot - ((mot >>> 1) & 0x55555555);
  x = (x & 0x33333333) + ((x >>> 2) & 0x33333333);
  return (Math.imul((x + (x >>> 4)) & 0x0f0f0f0f, 0x01010101) >>> 24);
}

// La co-présence de chacun (§ 5.5) : coPresents[p], les autres personnes
// présentes à un tour au moins où p l'est ; mobilesCoPresents[p], parmi
// elles, les non-ancrées. Sans absence, N − 1, et n − 1 pour un non-ancré, n
// pour un ancré. Sinon, un ensemble de N bits par tour porte ses présents ;
// pour chaque motif de présence distinct, la réunion des ensembles de ses
// tours se compte une fois, et la personne s'en retire. Un ancré est présent
// à chaque tour, sa réservation n'étant suspendue à aucun : il est co-présent
// de chacun, et les mobiles co-présents de p sont ses co-présents moins les k
// ancrés, p excepté quand il en est un. Coût : O(K · R · ⌈N/32⌉) pour K
// motifs distincts ; la Map ne sert qu'à retrouver un motif déjà compté.
function coPresences({ N, R, present, absences, statut, k }) {
  const coPresents = new Int32Array(N);
  if (absences === 0) {
    coPresents.fill(N - 1);
  } else {
    const mots = Math.ceil(N / 32);
    const presentsDuTour = new Uint32Array(R * mots);
    for (let p = 0; p < N; p += 1) {
      for (let r = 0; r < R; r += 1) {
        if (present[p * R + r] === 1) presentsDuTour[r * mots + (p >>> 5)] |= 1 << (p & 31);
      }
    }
    const reunion = new Uint32Array(mots);
    const parMotif = new Map();
    for (let p = 0; p < N; p += 1) {
      const motif = present.subarray(p * R, (p + 1) * R).join('');
      let compte = parMotif.get(motif);
      if (compte === undefined) {
        reunion.fill(0);
        for (let r = 0; r < R; r += 1) {
          if (present[p * R + r] === 0) continue;
          for (let m = 0; m < mots; m += 1) reunion[m] |= presentsDuTour[r * mots + m];
        }
        compte = 0;
        for (let m = 0; m < mots; m += 1) compte += bitsA1(reunion[m]);
        parMotif.set(motif, compte);
      }
      coPresents[p] = compte - 1;
    }
  }
  const mobilesCoPresents = new Int32Array(N);
  for (let p = 0; p < N; p += 1) {
    mobilesCoPresents[p] = coPresents[p] - k + (statut[p] === STATUT.ANCRE ? 1 : 0);
  }
  return { coPresents, mobilesCoPresents };
}

// Tables imposées par les réservations : fixe[p * R + r] = index de table,
// LIBRE sinon. Chaque réservation est vérifiée dans sa forme — participant et
// table connus, tour dans 1..R —, exclus compris ; celle d'un exclu s'arrête
// là, suspendue, sans effet (§ 4.4). Celle d'un présent est suspendue de même
// aux tours où il est absent : fixe y reste LIBRE, avant tout conflit. Une
// réservation qui répète la table déjà imposée au même tour ne change rien ;
// une autre table au même tour lève RESERVATION_CONFLIT.
function fixerReservations(reservations, contexte) {
  const { connus, indexDe, indexTableDe, idsTables, N, R, present } = contexte;
  const fixe = new Int32Array(N * R).fill(LIBRE);
  for (let i = 0; i < reservations.length; i += 1) {
    const { participant: id, table: idTable, portee, tour } = reservations[i];
    if (!connus.has(id)) {
      throw new ErreurConfiguration('RESERVATION_INCONNUE', { reservation: i, participant: id });
    }
    const t = indexTableDe.get(idTable);
    if (t === undefined) {
      throw new ErreurConfiguration('RESERVATION_INCONNUE', { reservation: i, table: idTable });
    }
    // Tours couverts, numérotés à partir de 0 : chacun des R tours pour la
    // portée « tous », le tour désigné pour la portée « tour ».
    let premier;
    let dernier;
    if (portee === 'tous') {
      premier = 0;
      dernier = R - 1;
    } else if (portee === 'tour') {
      if (!Number.isInteger(tour) || tour < 1 || tour > R) {
        throw new ErreurConfiguration('RESERVATION_TOUR', { reservation: i, tour });
      }
      premier = tour - 1;
      dernier = tour - 1;
    } else {
      throw new TypeError(
        `réservation ${i} : portée ${decrire(portee)}, « tous » ou « tour » attendue`,
      );
    }
    const p = indexDe.get(id);
    if (p === undefined) continue;
    for (let r = premier; r <= dernier; r += 1) {
      if (present[p * R + r] === 0) continue;
      const imposee = fixe[p * R + r];
      if (imposee === LIBRE) {
        fixe[p * R + r] = t;
      } else if (imposee !== t) {
        throw new ErreurConfiguration('RESERVATION_CONFLIT', {
          participant: id,
          tour: r + 1,
          tables: [idsTables[imposee], idTable],
        });
      }
    }
  }
  return fixe;
}

// Les sièges libres de chaque table à chaque tour, [t × R + r] : sa capacité
// moins les personnes que fixe y assied. Lève SURRESERVATION quand, à un
// tour, une table reçoit plus de personnes fixées que de sièges (§ 5.9). Le
// compte porte sur les personnes, lues dans fixe : une réservation répétée ne
// compte qu'une fois. Les tables se parcourent par index, chacune par tours
// croissants.
function siegesLibresApres(fixe, { N, T, R, capacite, idsTables }) {
  const fixees = new Int32Array(T * R);
  for (let p = 0; p < N; p += 1) {
    for (let r = 0; r < R; r += 1) {
      const t = fixe[p * R + r];
      if (t !== LIBRE) fixees[t * R + r] += 1;
    }
  }
  for (let t = 0; t < T; t += 1) {
    for (let r = 0; r < R; r += 1) {
      if (fixees[t * R + r] > capacite[t]) {
        throw new ErreurConfiguration('SURRESERVATION', {
          table: idsTables[t],
          tour: r + 1,
          reservees: fixees[t * R + r],
          capacite: capacite[t],
        });
      }
      fixees[t * R + r] = capacite[t] - fixees[t * R + r];
    }
  }
  return fixees;
}

// Statut de chaque participant, dérivé de fixe et non de la forme des
// réservations (§ 4.2) : ancré quand la même table est imposée à chacun des R
// tours, mobile quand aucune ne l'est, partiellement fixé sinon. Un ancré
// compte dans k et dans ancresParTable ; un partiellement fixé compte parmi
// les mobiles. fixe étant LIBRE aux tours d'absence, un ancré est présent à
// chacun des R tours : le plafond le suppose, ses ancrés occupant leur table
// à chaque tour.
function deriverStatuts(fixe, N, T, R) {
  const statut = new Uint8Array(N);
  const ancresParTable = new Int32Array(T);
  let k = 0;
  for (let p = 0; p < N; p += 1) {
    const premiere = fixe[p * R];
    let memeTable = true;
    let aucune = true;
    for (let r = 0; r < R; r += 1) {
      const t = fixe[p * R + r];
      if (t !== premiere) memeTable = false;
      if (t !== LIBRE) aucune = false;
    }
    if (aucune) {
      statut[p] = STATUT.MOBILE;
    } else if (memeTable) {
      statut[p] = STATUT.ANCRE;
      ancresParTable[premiere] += 1;
      k += 1;
    } else {
      statut[p] = STATUT.PARTIELLEMENT_FIXE;
    }
  }
  return { statut, ancresParTable, k };
}

// Les objectifs de la configuration, rangés et numérotés (§ 4.5, A13).
// Chacun se vérifie dans sa forme et dans son ordre : table connue, tour nul
// pour la soirée ou de 1 à R, au plus un objectif par table pour la soirée et
// par tour. Les objectifs distincts — même règle, mêmes étiquettes dans le
// même ordre — reçoivent un seul numéro, de 0 à O − 1, dans l'ordre des
// tables par identifiant croissant, la soirée puis les tours croissants de
// chacune ; la Map ne sert qu'à retrouver un objectif déjà numéroté.
// objectifDe[t × R + r] donne le numéro de l'objectif en vigueur, celui du
// tour quand la table en porte un, sinon celui de la soirée, SANS_OBJECTIF
// sinon : l'objectif du tour remplace celui de la soirée.
function numeroterObjectifs(objectifs, { T, R, idsTables, indexTableDe }) {
  exigerListe(objectifs, 'objectifs');
  // rangDe[t × (R + 1) + k] : rang dans objectifs de l'objectif de la table t
  // pour la soirée (k = 0) ou pour le tour k ; −1 sans objectif.
  const rangDe = new Int32Array(T * (R + 1)).fill(-1);
  objectifs.forEach(({ table, tour, regle, etiquettes }, rang) => {
    const t = indexTableDe.get(table);
    if (t === undefined) throw new ErreurConfiguration('OBJECTIF_INCONNU', { table });
    if (regle !== 'ou' && regle !== 'et') {
      throw new TypeError(`objectif de la table ${table} : règle ${decrire(regle)}, « ou » ou « et » attendue`);
    }
    exigerEtiquettes(etiquettes, `objectif de la table ${table}`);
    const soiree = tour === null || tour === undefined;
    if (!soiree && !(Number.isInteger(tour) && tour >= 1 && tour <= R)) {
      throw new ErreurConfiguration('OBJECTIF_TOUR', { table, tour });
    }
    const k = t * (R + 1) + (soiree ? 0 : tour);
    if (rangDe[k] !== -1) throw new ErreurConfiguration('OBJECTIF_CONFLIT', { table, tour: soiree ? null : tour });
    rangDe[k] = rang;
  });

  const parIdentifiant = Array.from({ length: T }, (_, t) => t).sort((a, b) => idsTables[a] - idsTables[b]);
  const numeroDe = new Int32Array(T * (R + 1)).fill(SANS_OBJECTIF);
  const distincts = [];
  const numeroDeCle = new Map();
  for (const t of parIdentifiant) {
    for (let k = 0; k <= R; k += 1) {
      const rang = rangDe[t * (R + 1) + k];
      if (rang === -1) continue;
      const { regle, etiquettes } = objectifs[rang];
      const cle = JSON.stringify([regle, etiquettes]);
      if (!numeroDeCle.has(cle)) {
        numeroDeCle.set(cle, distincts.length);
        distincts.push({ regle, etiquettes });
      }
      numeroDe[t * (R + 1) + k] = numeroDeCle.get(cle);
    }
  }

  const objectifDe = new Int32Array(T * R);
  for (let t = 0; t < T; t += 1) {
    for (let r = 0; r < R; r += 1) {
      const duTour = numeroDe[t * (R + 1) + r + 1];
      objectifDe[t * R + r] = duTour !== SANS_OBJECTIF ? duTour : numeroDe[t * (R + 1)];
    }
  }
  return { objectifDe, distincts };
}

// Correspondance de chaque personne présente à chaque objectif distinct,
// [p × O + o] = 1 quand correspondA le dit (D18), puis les couples possibles
// (§ 4.5) : (p, r) l'est quand la table fixée de p à ce tour lui correspond,
// ou, p libre à ce tour, quand une table qui garde un siège libre lui
// correspond ; jamais quand p est absent au tour r. Les objectifs qu'offre une table à siège libre se marquent une
// fois par tour. Deux personnes aux mêmes étiquettes, dans le même ordre, ont
// la même rangée : correspondA ne se calcule qu'à la première, que les
// suivantes recopient ; la clé, la liste en JSON, ne confond pas deux listes
// différentes.
function couplesPossibles(presents, distincts, { N, T, R, fixe, siegesLibres, objectifDe, present }) {
  const O = distincts.length;
  const correspond = new Uint8Array(N * O);
  const premiereAvec = new Map();
  for (let p = 0; O > 0 && p < N; p += 1) {
    const etiquettes = presents[p].etiquettes ?? [];
    const cle = JSON.stringify(etiquettes);
    const premiere = premiereAvec.get(cle);
    if (premiere !== undefined) {
      correspond.copyWithin(p * O, premiere * O, premiere * O + O);
      continue;
    }
    premiereAvec.set(cle, p);
    for (let o = 0; o < O; o += 1) correspond[p * O + o] = correspondA(etiquettes, distincts[o]) ? 1 : 0;
  }
  const possible = new Uint8Array(N * R);
  const possibles = new Int32Array(N);
  const offert = new Uint8Array(O);
  for (let r = 0; r < R; r += 1) {
    offert.fill(0);
    for (let t = 0; t < T; t += 1) {
      const o = objectifDe[t * R + r];
      if (o !== SANS_OBJECTIF && siegesLibres[t * R + r] > 0) offert[o] = 1;
    }
    for (let p = 0; p < N; p += 1) {
      if (present[p * R + r] === 0) continue;
      const t = fixe[p * R + r];
      let oui = false;
      if (t !== LIBRE) {
        const o = objectifDe[t * R + r];
        oui = o !== SANS_OBJECTIF && correspond[p * O + o] === 1;
      } else {
        for (let o = 0; o < O && !oui; o += 1) oui = offert[o] === 1 && correspond[p * O + o] === 1;
      }
      if (oui) {
        possible[p * R + r] = 1;
        possibles[p] += 1;
      }
    }
  }
  return { O, correspond, possible, possibles };
}

// Les animateurs (§ 4.5, D6) : participant.anime liste, croissants, les tours
// où la personne présente pourvoit un titre. Chaque tour se vérifie : de 1 à
// R, sinon ANIMATION_NON_FIXEE ; la personne y est présente, sinon
// ANIMATION_ABSENTE, contrôlé d'abord puisque sa réservation y est suspendue ;
// elle y est fixée, sinon ANIMATION_NON_FIXEE ; elle anime alors à sa table
// fixée. Un exclu n'anime pas. Les animateurs reçoivent
// leurs rangs, 0 à A − 1, dans l'ordre des identifiants ; animes porte, ligne
// t × R + r de debutAnimes à la suivante, les rangs de ceux qui animent à la
// table t au tour r, croissants.
function deriverAnimateurs(presents, { N, T, R, fixe, present }) {
  const rangAnimateur = new Int32Array(N).fill(NON_ANIMATEUR);
  const indexDesAnimateurs = [];
  const parLigne = new Int32Array(T * R);
  for (let p = 0; p < N; p += 1) {
    const { id, anime } = presents[p];
    if (anime === undefined) continue;
    if (!Array.isArray(anime)) throw new TypeError(`participant ${id} : tours animés en liste attendus`);
    let precedent = 0;
    for (const tour of anime) {
      const horsDesTours = !Number.isInteger(tour) || tour < 1 || tour > R;
      if (!horsDesTours && present[p * R + tour - 1] === 0) {
        throw new ErreurConfiguration('ANIMATION_ABSENTE', { participant: id, tour });
      }
      if (horsDesTours || fixe[p * R + tour - 1] === LIBRE) {
        throw new ErreurConfiguration('ANIMATION_NON_FIXEE', { participant: id, tour });
      }
      if (tour <= precedent) throw new TypeError(`participant ${id} : tours animés strictement croissants attendus`);
      precedent = tour;
      parLigne[fixe[p * R + tour - 1] * R + tour - 1] += 1;
    }
    if (anime.length === 0) continue;
    rangAnimateur[p] = indexDesAnimateurs.length;
    indexDesAnimateurs.push(p);
  }
  const debutAnimes = new Int32Array(T * R + 1);
  for (let ligne = 0; ligne < T * R; ligne += 1) debutAnimes[ligne + 1] = debutAnimes[ligne] + parLigne[ligne];
  const animes = new Int32Array(debutAnimes[T * R]);
  const rempli = debutAnimes.slice(0, T * R);
  for (const p of indexDesAnimateurs) {
    for (const tour of presents[p].anime) {
      const ligne = fixe[p * R + tour - 1] * R + tour - 1;
      animes[rempli[ligne]] = rangAnimateur[p];
      rempli[ligne] += 1;
    }
  }
  return { A: indexDesAnimateurs.length, rangAnimateur, animateurs: Int32Array.from(indexDesAnimateurs), debutAnimes, animes };
}

// La borne des animateurs B(p) = min(#Φ(p), Σ_r φ_r(p)) (D21). Une table que
// p peut occuper au tour r est sa table fixée, sinon toute table qui garde un
// siège libre. Φ(p) réunit les animateurs autres que p qui animent, à un
// tour, à une table qu'il peut y occuper : un marquage de taille A, daté par
// personne, les compte sans remise à zéro. φ_r(p) est le plus grand nombre
// d'animateurs autres que p à une telle table : pour p fixé, ceux de sa
// table ; pour p libre, qui n'anime pas à ce tour, le plus grand nombre d'une
// table à siège libre, calculé une fois par tour, comme la liste de leurs
// animateurs. Un tour d'absence de p n'entre ni dans Φ(p) ni dans la somme.
// O(N · R · A) au pire.
function bornerAnimateurs({ N, T, R, fixe, siegesLibres, present }, { A, rangAnimateur, debutAnimes, animes }) {
  const borne = new Int32Array(N);
  if (A === 0) return borne;
  const plusGrandLibre = new Int32Array(R);
  const libresDuTour = [];
  for (let r = 0; r < R; r += 1) {
    const rangs = [];
    for (let t = 0; t < T; t += 1) {
      if (siegesLibres[t * R + r] === 0) continue;
      const debut = debutAnimes[t * R + r];
      const fin = debutAnimes[t * R + r + 1];
      for (let k = debut; k < fin; k += 1) rangs.push(animes[k]);
      plusGrandLibre[r] = Math.max(plusGrandLibre[r], fin - debut);
    }
    libresDuTour.push(rangs);
  }
  // marque[f] vaut p quand p a déjà rejoint l'animateur de rang f.
  const marque = new Int32Array(A).fill(-1);
  for (let p = 0; p < N; p += 1) {
    const soi = rangAnimateur[p];
    let rejoints = 0;
    let somme = 0;
    for (let r = 0; r < R; r += 1) {
      if (present[p * R + r] === 0) continue;
      const t = fixe[p * R + r];
      if (t === LIBRE) {
        for (const f of libresDuTour[r]) {
          if (f === soi || marque[f] === p) continue;
          marque[f] = p;
          rejoints += 1;
        }
        somme += plusGrandLibre[r];
        continue;
      }
      let ici = 0;
      for (let k = debutAnimes[t * R + r]; k < debutAnimes[t * R + r + 1]; k += 1) {
        const f = animes[k];
        if (f === soi) continue;
        ici += 1;
        if (marque[f] === p) continue;
        marque[f] = p;
        rejoints += 1;
      }
      somme += ici;
    }
    borne[p] = Math.min(rejoints, somme);
  }
  return borne;
}

// La liste des priorités de la configuration, complète (A16) : une copie de
// l'ordre par défaut quand elle n'en porte pas ; sinon la liste reçue,
// complétée, que verifierPriorites juge sous le mode. Le jugement se fait
// avant le complément, qui suppose la forme d'une liste : verifierPriorites
// ne relève l'absence d'un critère qu'une fois tout le reste trouvé valide, et
// le complément n'ajoute que des paliers d'un critère seul au poids 1, si
// bien qu'une liste dont la seule faute est l'absence se complète en une
// liste valide, et que toute autre faute est celle de la liste complétée.
// Les détails de PRIORITES sont la faute de verifierPriorites.
function lirePriorites(priorites, mode) {
  if (priorites === undefined) return completerPriorites(PRIORITES_PAR_DEFAUT);
  const faute = verifierPriorites(priorites, mode);
  if (faute !== null && faute.faute !== 'critereAbsent') throw new ErreurConfiguration('PRIORITES', faute);
  return completerPriorites(priorites);
}

// L'état de chaque critère, dans l'ordre de CRITERES (§ 5.3, D10) : coché
// selon ses cases, sans objet quand l'événement ne lui donne rien à mesurer —
// aucun couple possible pour les tours hors objectif, aucune borne des
// animateurs non nulle pour les animateurs non rencontrés —, et les valeurs
// qu'il classe sous ces contraintes et ce mode.
function etatDesCriteres(contraintes, mode, possibles, borne) {
  const sansObjet = {
    toursHorsObjectif: possibles.every((n) => n === 0),
    animateursNonRencontres: borne.every((b) => b === 0),
  };
  return CRITERES.map((nom) => ({
    nom,
    coche: estCoche(nom, contraintes),
    sansObjet: sansObjet[nom] ?? false,
    valeurs: valeursQuiClassent(nom, contraintes, mode),
  }));
}

/**
 * Instance indexée d'une configuration (§ 4, § 5.2). Les participants exclus
 * en sont absents (§ 4.4) : ni index ni groupe, et leurs réservations,
 * suspendues, ne fixent rien et ne prennent aucun siège. Une personne
 * absente à un tour (participant.presence) y est hors de tout : sa
 * réservation y est suspendue, aucun couple n'y est possible, aucun
 * animateur n'y est rejoint, et elle ne compte pas parmi les présents du
 * tour ; une présence qui couvre chaque tour donne l'instance du champ
 * absent.
 *
 * Lève ErreurConfiguration sur la première règle enfreinte — participants,
 * puis tables, nombre de tours, présences, réservations une à une,
 * surréservation : PARTICIPANT_DOUBLON, TABLE_DOUBLON, CAPACITE (non entière,
 * < 2, ou au-delà d'un Int32Array), TOURS (R non entier ou < 1),
 * PRESENCE_VIDE {participant} (une présence vide), PRESENCE_TOUR
 * {participant, tour} (un tour de présence hors de 1..R, exclus compris),
 * RESERVATION_INCONNUE
 * (participant ou table), RESERVATION_TOUR (tour absent ou hors de 1..R),
 * RESERVATION_CONFLIT (une personne à deux tables d'un même tour),
 * SURRESERVATION (plus de personnes fixées que de sièges à une table, à un
 * tour) ; puis objectifs un à un, tours animés, priorités : OBJECTIF_INCONNU
 * {table} (une table absente), OBJECTIF_TOUR {table, tour} (ni nul ni de
 * 1..R), OBJECTIF_CONFLIT {table, tour} (deux objectifs d'une table pour la
 * soirée, tour nul, ou pour un même tour), ANIMATION_ABSENTE {participant,
 * tour} (un tour animé où la personne est absente), ANIMATION_NON_FIXEE
 * {participant, tour} (un tour animé hors de 1..R, ou où la personne n'est
 * pas fixée),
 * PRIORITES {faute, critere?, palier?} (la faute de verifierPriorites sous le
 * mode, après complément). Une salle trop petite n'est pas refusée :
 * nombrePlacesManquantes la chiffre, et la recherche la refuse (§ 5.9). Les
 * détails désignent participants et tables par identifiant, les tours par
 * leur numéro à partir de 1, et la réservation fautive par son rang dans
 * configuration.reservations, à partir de 0.
 *
 * Lève TypeError sur les seules formes qu'énumère l'en-tête du module :
 * identifiants de participant et de table, organisation, exclu, portée,
 * contraintes, listes, étiquettes, règle d'un objectif, mode, ordre des
 * tours animés, présence qui n'est pas une liste strictement croissante. Une
 * capacité, un nombre de tours, un tour désigné, le tour d'un objectif, un
 * tour animé ou un tour de présence hors de leur forme lèvent CAPACITE,
 * TOURS, RESERVATION_TOUR, OBJECTIF_TOUR, ANIMATION_NON_FIXEE ou
 * PRESENCE_TOUR ; une réservation ou
 * un objectif qui désignent un participant ou une table absents de la
 * configuration lèvent RESERVATION_INCONNUE ou OBJECTIF_INCONNU, quelle que
 * soit la forme de la valeur qui les désigne.
 *
 * Les champs facultatifs absents prennent leur défaut : aucun objectif, aucune
 * étiquette, personne n'anime, le mode « places », l'ordre par défaut ; les
 * deux cases facultatives restent absentes de instance.contraintes, où
 * estCoche (criteres.js) leur donne leur valeur par défaut.
 *
 * Une configuration passée par figerConfiguration ne se normalise qu'une
 * fois : les appels suivants rendent la même instance, que l'appelant lit
 * sans la modifier, comme tout le moteur.
 *
 * @param {import('./types.js').Configuration} configuration
 * @returns {import('./types.js').Instance}
 */
export function normaliser(configuration) {
  const connue = figees.get(configuration);
  if (connue) return connue;
  const instance = instanceDe(configuration);
  if (connue === null) figees.set(configuration, instance);
  return instance;
}

// Les configurations que figerConfiguration a figées, chacune avec son
// instance, null tant qu'aucune normalisation n'a réussi : une
// configuration refusée lève à chaque appel. La clé est l'objet même ; ce
// que normaliser en lit, figé, ne change plus sous la même identité, et
// l'instance tirée au premier appel vaut pour les suivants. Une
// configuration que plus rien ne retient quitte la table avec son instance.
const figees = new WeakMap();

// Fige liste, quand c'en est une, après chacun de ses éléments par
// figerElement.
function figerListe(liste, figerElement) {
  if (!Array.isArray(liste)) return;
  for (const element of liste) figerElement(element);
  Object.freeze(liste);
}

// Fige valeur quand c'est un objet ; une autre valeur reste telle quelle.
function figerObjet(valeur) {
  if (valeur !== null && typeof valeur === 'object') Object.freeze(valeur);
}

/**
 * Fige ce que normaliser lit de la configuration et la rend : l'objet, ses
 * participants avec leurs étiquettes, leurs tours animés et leur présence,
 * ses tables, ses
 * réservations, ses contraintes, ses objectifs avec leurs étiquettes, ses
 * priorités, palier par palier. normaliser ne la calcule alors plus qu'une
 * fois, et chaque appel suivant rend la même instance : un appelant qui la
 * passe à plusieurs fonctions du moteur — diagnostiquer, puis normaliser
 * pour mesurer — ne paie qu'une normalisation. Ce qu'elle atteint devient
 * immuable : elle ne doit rien partager avec une valeur que son
 * propriétaire modifie encore. Les champs sont nommés, et non parcourus :
 * l'instance ne dépend que d'eux.
 *
 * @param {import('./types.js').Configuration} configuration
 * @returns {import('./types.js').Configuration} la même, figée
 */
export function figerConfiguration(configuration) {
  figerListe(configuration.participants, (participant) => {
    figerObjet(participant);
    figerListe(participant?.etiquettes, figerObjet);
    figerListe(participant?.anime, figerObjet);
    figerListe(participant?.presence, figerObjet);
  });
  figerListe(configuration.tables, figerObjet);
  figerListe(configuration.reservations, figerObjet);
  figerObjet(configuration.contraintes);
  figerListe(configuration.objectifs, (objectif) => {
    figerObjet(objectif);
    figerListe(objectif?.etiquettes, figerObjet);
  });
  figerListe(configuration.priorites, (palier) => figerListe(palier, figerObjet));
  Object.freeze(configuration);
  if (!figees.has(configuration)) figees.set(configuration, null);
  return configuration;
}

// L'instance d'une configuration, calculée à neuf (normaliser).
function instanceDe(configuration) {
  const { participants, tables, tours: R, reservations } = configuration;
  exigerListe(participants, 'participants');
  exigerListe(tables, 'tables');
  exigerListe(reservations, 'reservations');
  const contraintes = copierContraintes(configuration.contraintes);
  const modeObjectifs = lireMode(configuration.modeObjectifs);

  // connus porte tous les identifiants, exclus compris : un doublon reste un
  // doublon, et la réservation d'un exclu n'est pas inconnue.
  const connus = new Set();
  const presents = [];
  const exclus = [];
  for (const participant of participants) {
    exigerIdentifiant(participant.id, 'participant');
    if (connus.has(participant.id)) {
      throw new ErreurConfiguration('PARTICIPANT_DOUBLON', { participant: participant.id });
    }
    connus.add(participant.id);
    exigerOrganisation(participant);
    if (participant.etiquettes !== undefined) exigerEtiquettes(participant.etiquettes, `participant ${participant.id}, étiquettes`);
    if (estExclu(participant)) exclus.push(participant.id);
    else presents.push(participant);
  }
  presents.sort((a, b) => a.id - b.id);
  exclus.sort((a, b) => a - b);

  const T = tables.length;
  const idsTables = [];
  const indexTableDe = new Map();
  const capacite = new Int32Array(T);
  for (let t = 0; t < T; t += 1) {
    const { id, capacite: places } = tables[t];
    exigerIdentifiant(id, 'table');
    if (indexTableDe.has(id)) throw new ErreurConfiguration('TABLE_DOUBLON', { table: id });
    if (!Number.isInteger(places) || places < 2 || places > ENTIER_32_MAX) {
      throw new ErreurConfiguration('CAPACITE', { table: id, capacite: places });
    }
    idsTables.push(id);
    indexTableDe.set(id, t);
    capacite[t] = places;
  }

  if (!Number.isInteger(R) || R < 1) throw new ErreurConfiguration('TOURS', { tours: R });
  exigerPresences(participants, R);

  const N = presents.length;
  const ids = presents.map((participant) => participant.id);
  const indexDe = new Map(ids.map((id, p) => [id, p]));
  const { groupe, groupes } = numeroterGroupes(presents);
  const { debutEtiquettes, etiquettes, libellesEtiquettes } = indexerEtiquettes(presents);
  const presence = masquerPresences(presents, N, R);
  const { present } = presence;
  const fixe = fixerReservations(reservations, { connus, indexDe, indexTableDe, idsTables, N, R, present });
  const siegesLibres = siegesLibresApres(fixe, { N, T, R, capacite, idsTables });
  const { statut, ancresParTable, k } = deriverStatuts(fixe, N, T, R);
  const { coPresents, mobilesCoPresents } = coPresences({ N, R, present, absences: presence.absences, statut, k });
  const { objectifDe, distincts } = numeroterObjectifs(configuration.objectifs ?? [], { T, R, idsTables, indexTableDe });
  const objectifs = couplesPossibles(presents, distincts, { N, T, R, fixe, siegesLibres, objectifDe, present });
  const animation = deriverAnimateurs(presents, { N, T, R, fixe, present });
  const borneAnimateurs = bornerAnimateurs({ N, T, R, fixe, siegesLibres, present }, animation);
  const priorites = lirePriorites(configuration.priorites, modeObjectifs);

  return {
    N,
    T,
    R,
    ids,
    indexDe,
    exclus: new Set(exclus),
    idsTables,
    indexTableDe,
    capacite,
    groupe,
    groupes,
    debutEtiquettes,
    etiquettes,
    libellesEtiquettes,
    fixe,
    statut,
    ancresParTable,
    k,
    n: N - k,
    present,
    toursPresents: presence.toursPresents,
    presentsParTour: presence.presentsParTour,
    absences: presence.absences,
    coPresents,
    mobilesCoPresents,
    contraintes,
    siegesLibres,
    O: objectifs.O,
    objectifDe,
    correspond: objectifs.correspond,
    possible: objectifs.possible,
    possibles: objectifs.possibles,
    modeObjectifs,
    A: animation.A,
    rangAnimateur: animation.rangAnimateur,
    animateurs: animation.animateurs,
    debutAnimes: animation.debutAnimes,
    animes: animation.animes,
    borneAnimateurs,
    etatCriteres: etatDesCriteres(contraintes, modeObjectifs, objectifs.possibles, borneAnimateurs),
    priorites,
  };
}

/**
 * Plan indexé d'un plan par identifiants : tableDe[p * R + r] = index de
 * table, −1 pour la réserve. plan.tables déclare chaque table de l'instance
 * une fois, et chaque liste se rattache à sa table par l'identifiant déclaré
 * à la même position ; l'ordre des tables et celui des ids dans une liste
 * sont indifférents. Un plan accepté revient donc de planDepuisIndex à
 * l'identique, à ces deux ordres près.
 *
 * La forme indexée n'a pas de case pour un participant absent d'un tour,
 * placé deux fois ou étranger à l'instance, ni pour une table que le plan ne
 * déclare pas : au lieu de perdre l'écart, indexerPlan lève
 * ErreurConfiguration — PLAN_TOURS (tours ou réserves en nombre ≠ R),
 * PLAN_TABLE_INCONNUE, PLAN_TABLE_DOUBLON, PLAN_TABLE_ABSENTE (une table de
 * l'instance que plan.tables ne déclare pas), PLAN_LISTES (un tour sans
 * exactement une liste par table déclarée), PLAN_INCONNU, PLAN_EXCLU_PLACE
 * (participant exclu de l'instance), PLAN_ABSENT_PLACE (à une table ou en
 * réserve à un tour où il est absent, levé là où le placement se lit, listes
 * des tables puis réserve), PLAN_DOUBLE_PLACE (deux fois dans un tour,
 * réserve comprise), PLAN_NON_ASSIS (un présent ni à une table ni en réserve
 * à un tour). Un absent que le plan ne place pas au tour vaut RESERVE. Les
 * capacités et les réservations ne sont pas examinées.
 *
 * @param {import('./types.js').Instance} instance
 * @param {import('./types.js').Plan} plan
 * @returns {Int32Array}
 */
export function indexerPlan(instance, plan) {
  const { N, T, R, ids, idsTables, indexDe, indexTableDe, exclus, present } = instance;
  if (plan.tours.length !== R || plan.reserves.length !== R) {
    throw new ErreurConfiguration('PLAN_TOURS', {
      attendu: R,
      tours: plan.tours.length,
      reserves: plan.reserves.length,
    });
  }
  // Index de table de chaque liste, par position dans plan.tables.
  const tableDeListe = [];
  const declarees = new Set();
  for (const id of plan.tables) {
    const t = indexTableDe.get(id);
    if (t === undefined) throw new ErreurConfiguration('PLAN_TABLE_INCONNUE', { table: id });
    if (declarees.has(id)) throw new ErreurConfiguration('PLAN_TABLE_DOUBLON', { table: id });
    declarees.add(id);
    tableDeListe.push(t);
  }
  // Sans id inconnu ni doublon, une table manque exactement quand le plan en
  // déclare moins que l'instance ; la première absente, dans l'ordre de
  // l'instance, est nommée.
  if (tableDeListe.length !== T) {
    const absente = idsTables.find((id) => !declarees.has(id));
    throw new ErreurConfiguration('PLAN_TABLE_ABSENTE', { table: absente });
  }

  const tableDe = new Int32Array(N * R).fill(NON_PLACE);
  const placer = (id, r, t) => {
    const p = indexDe.get(id);
    if (p === undefined) {
      const code = exclus.has(id) ? 'PLAN_EXCLU_PLACE' : 'PLAN_INCONNU';
      throw new ErreurConfiguration(code, { participant: id, tour: r + 1 });
    }
    if (present[p * R + r] === 0) {
      throw new ErreurConfiguration('PLAN_ABSENT_PLACE', { participant: id, tour: r + 1 });
    }
    if (tableDe[p * R + r] !== NON_PLACE) {
      throw new ErreurConfiguration('PLAN_DOUBLE_PLACE', { participant: id, tour: r + 1 });
    }
    tableDe[p * R + r] = t;
  };
  for (let r = 0; r < R; r += 1) {
    const listes = plan.tours[r];
    if (listes.length !== tableDeListe.length) {
      throw new ErreurConfiguration('PLAN_LISTES', {
        tour: r + 1,
        listes: listes.length,
        tables: tableDeListe.length,
      });
    }
    for (let i = 0; i < listes.length; i += 1) {
      for (const id of listes[i]) placer(id, r, tableDeListe[i]);
    }
    for (const id of plan.reserves[r]) placer(id, r, RESERVE);
    for (let p = 0; p < N; p += 1) {
      if (tableDe[p * R + r] !== NON_PLACE) continue;
      if (present[p * R + r] === 0) tableDe[p * R + r] = RESERVE;
      else throw new ErreurConfiguration('PLAN_NON_ASSIS', { participant: ids[p], tour: r + 1 });
    }
  }
  return tableDe;
}

/**
 * La garde de forme d'un plan indexé, la seule du moteur : planDepuisIndex,
 * mesurer et plafondsRealises l'appellent avant de lire une case. Lève
 * RangeError quand tableDe n'a pas N × R cases, qu'une case n'est ni
 * RESERVE ni un index de table entier de 0 à T − 1, ou qu'une case où la
 * personne est absente n'est pas RESERVE. Le message nomme alors le
 * participant, par identifiant, le tour et la valeur de la première case
 * fautive dans l'ordre des cases, p × R + r croissant ; une chaîne s'y cite
 * entre guillemets, pour ne pas se lire comme le nombre qu'elle contient.
 * Sans absence, le masque n'est pas lu.
 *
 * Sans elle, une case de trop serait ignorée, et une chaîne numérique comme
 * "0" assiérait la personne à la table qu'elle désigne là où une
 * comparaison stricte à instance.fixe n'y reconnaîtrait pas sa réservation.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 */
export function exigerPlanIndexe({ N, T, R, ids, present, absences }, tableDe) {
  if (tableDe.length !== N * R) {
    throw new RangeError(`plan indexé de ${tableDe.length} cases, N × R = ${N * R} attendues`);
  }
  const avecAbsences = absences > 0;
  for (let i = 0; i < tableDe.length; i += 1) {
    const t = tableDe[i];
    if (t === RESERVE) continue;
    if (!(Number.isInteger(t) && t >= 0 && t < T)) {
      throw new RangeError(
        `plan indexé : participant ${ids[Math.floor(i / R)]}, tour ${(i % R) + 1}, `
          + `index de table ${decrire(t)} hors de −1..${T - 1}`,
      );
    }
    if (avecAbsences && present[i] === 0) {
      throw new RangeError(`plan indexé : participant ${ids[Math.floor(i / R)]}, absent au tour ${(i % R) + 1}, à la table ${t}`);
    }
  }
}

/**
 * Plan par identifiants d'un plan indexé : les tables dans l'ordre de
 * l'instance, chaque liste de table et chaque réserve en ids croissants
 * (§ 8.9). La réserve d'un tour ne porte que ses présents : un absent n'est
 * listé nulle part. Lève ce que lève exigerPlanIndexe.
 *
 * @param {import('./types.js').Instance} instance
 * @param {ArrayLike<number>} tableDe
 * @returns {import('./types.js').Plan}
 */
export function planDepuisIndex(instance, tableDe) {
  exigerPlanIndexe(instance, tableDe);
  const { N, T, R, ids, idsTables, present } = instance;
  const tours = [];
  const reserves = [];
  for (let r = 0; r < R; r += 1) {
    const listes = Array.from({ length: T }, () => []);
    const reserve = [];
    // Les ids croissent avec l'index : parcourir les participants par index
    // range chaque liste en ids croissants, sans tri.
    for (let p = 0; p < N; p += 1) {
      const t = tableDe[p * R + r];
      if (t !== RESERVE) listes[t].push(ids[p]);
      else if (present[p * R + r] === 1) reserve.push(ids[p]);
    }
    tours.push(listes);
    reserves.push(reserve);
  }
  return { tables: [...idsTables], tours, reserves };
}

/**
 * Places qu'offre chaque tour : Σ c_t, la somme des capacités. Ni les
 * participants ni les réservations n'y entrent. Le nombre de places
 * manquantes et le diagnostic d'une salle tendue la lisent ici.
 *
 * @param {import('./types.js').Instance} instance  T et capacite sont lus
 * @returns {number}
 */
export function nombrePlaces({ T, capacite }) {
  let places = 0;
  for (let t = 0; t < T; t += 1) places += capacite[t];
  return places;
}

/**
 * Places qui manquent à chaque tour pour asseoir ses présents :
 * max(0, n_r − Σ c_t), R cases, dans l'ordre des tours. Ni les réservations
 * ni les absents n'y entrent (§ 5.9) : un ancré, présent à chaque tour,
 * retire une personne des mobiles et un siège de la capacité libre, un
 * partiellement fixé reste parmi les mobiles et ne retire rien. Sans
 * absence, chaque case vaut max(0, N − Σ c_t).
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number[]}
 */
export function placesManquantesParTour(instance) {
  const places = nombrePlaces(instance);
  return Array.from(instance.presentsParTour, (presents) => Math.max(0, presents - places));
}

/**
 * Le plus grand des manques de placesManquantesParTour : les places qu'il
 * faut ajouter pour que chaque tour assoie ses présents. Sans absence,
 * max(0, N − Σ c_t).
 *
 * @param {import('./types.js').Instance} instance
 * @returns {number}
 */
export function nombrePlacesManquantes(instance) {
  return Math.max(...placesManquantesParTour(instance));
}

/**
 * Replie valeurs[p] sur les trois populations du § 5.4, en un passage, dans
 * l'ordre canonique : chacun compte dans « tous », puis parmi les ancrés, ou
 * parmi les mobiles, partiellement fixés compris. C'est le seul endroit qui
 * range une personne dans sa population : les agrégats des indicateurs et
 * les chiffres du manque le lisent tous deux.
 *
 * replier(cumul, valeur) rend le cumul suivant sans jamais modifier
 * initial : les trois populations partent de lui, et une population sans
 * membre le garde. Un cumul que replier a lui-même rendu n'appartient qu'à
 * sa population, et replier peut le compléter en place.
 *
 * @template C
 * @param {ArrayLike<*>} valeurs  une par personne, dans l'ordre de instance.ids
 * @param {ArrayLike<number>} statut  instance.statut
 * @param {C} initial
 * @param {function(C, *): C} replier
 * @returns {{tous: C, mobiles: C, ancres: C}}
 */
export function replierParPopulation(valeurs, statut, initial, replier) {
  let tous = initial;
  let mobiles = initial;
  let ancres = initial;
  for (let p = 0; p < valeurs.length; p += 1) {
    const valeur = valeurs[p];
    tous = replier(tous, valeur);
    if (statut[p] === STATUT.ANCRE) ancres = replier(ancres, valeur);
    else mobiles = replier(mobiles, valeur);
  }
  return { tous, mobiles, ancres };
}
