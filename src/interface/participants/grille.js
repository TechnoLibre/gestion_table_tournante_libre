// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les modules purs de la liste des participants (§ 4, § 7.4, § 10.2), que
// câblent SectionParticipants, Grille, Formulaire et Fiche : les colonnes de
// la grille, ses lignes triées et filtrées, la cellule qu'atteint une
// touche, l'orthographe d'appartenance à reprendre, l'itinéraire d'une
// personne dans le retenu et ses réservations. Aucune fonction ne modifie ce
// qu'elle reçoit ; la clé normalisée vient de l'appelant, qui la tient de
// src/application/csv.js.

/** Les colonnes de la grille, propriétés d'un participant, dans l'ordre des
 *  colonnes de l'export : « l'ordre de la grille » que relit l'import. */
export const COLONNES = Object.freeze(['nom', 'prenom', 'appartenance', 'courriel', 'titrePressenti', 'exclu', 'notes']);

// Les colonnes de texte : toutes, exclu excepté.
const TEXTES = COLONNES.filter((colonne) => colonne !== 'exclu');

// La clé du libellé de chaque colonne, et celle de chaque statut calculé.
const CLES_COLONNES = new Map([
  ['nom', 'participants.colonne.nom'],
  ['prenom', 'participants.colonne.prenom'],
  ['appartenance', 'participants.colonne.appartenance'],
  ['courriel', 'participants.colonne.courriel'],
  ['titrePressenti', 'participants.colonne.titrePressenti'],
  ['exclu', 'participants.colonne.exclu'],
  ['notes', 'participants.colonne.notes'],
]);
const CLES_STATUTS = new Map([
  ['ancre', 'participants.statut.ancre'],
  ['partiel', 'participants.statut.partiel'],
  ['mobile', 'participants.statut.mobile'],
]);

/**
 * La clé du libellé d'une colonne de COLONNES.
 *
 * @param {string} colonne
 * @returns {string}
 * @throws {RangeError} hors de COLONNES
 */
export function cleDeColonne(colonne) {
  const cle = CLES_COLONNES.get(colonne);
  if (cle === undefined) throw new RangeError(`colonne inconnue : ${JSON.stringify(colonne)}`);
  return cle;
}

/**
 * La clé du libellé d'un statut calculé (statuts, src/application/places.js) :
 * 'ancre', 'partiel' ou 'mobile'.
 *
 * @param {string} statut
 * @returns {string}
 * @throws {RangeError} un autre statut
 */
export function cleDeStatut(statut) {
  const cle = CLES_STATUTS.get(statut);
  if (cle === undefined) throw new RangeError(`statut inconnu : ${JSON.stringify(statut)}`);
  return cle;
}

// Deux chaînes, comparées unité UTF-16 par unité.
const comparerTextes = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

const SENS = new Map([
  ['croissant', 1],
  ['decroissant', -1],
]);

/**
 * Les lignes affichées : une ligne reste quand la clé normalisée d'un de ses
 * champs texte non null contient celle du filtre — un champ null n'est
 * jamais passé à cleNormalisee, qui lève sur lui —, puis tri par colonne,
 * croissant ou décroissant, sur la clé normalisée (exclu : faux avant vrai),
 * un champ null après toute valeur dans les deux sens, départagé par
 * identifiant croissant. Sans tri, l'ordre est celui des identifiants
 * croissants ; un filtre dont la clé est vide garde tout.
 *
 * @param {Array<Object>} participants
 * @param {{tri: null|{colonne: string, sens: 'croissant'|'decroissant'}, filtre: string}} vue
 * @param {(texte: string) => string} cleNormalisee
 * @returns {Array<Object>}   les participants reçus, dans l'ordre de la grille
 * @throws {RangeError} une colonne hors de COLONNES, un autre sens
 */
export function lignesGrille(participants, { tri, filtre }, cleNormalisee) {
  const signe = tri === null ? 1 : SENS.get(tri.sens);
  if (tri !== null && (!COLONNES.includes(tri.colonne) || signe === undefined)) {
    throw new RangeError(`tri inconnu : ${JSON.stringify(tri)}`);
  }
  const cherche = cleNormalisee(filtre ?? '');
  const retenues =
    cherche === ''
      ? [...participants]
      : participants.filter((p) => TEXTES.some((colonne) => p[colonne] !== null && cleNormalisee(p[colonne]).includes(cherche)));

  // La valeur de tri de chaque ligne, calculée une fois : null reste null.
  const colonne = tri?.colonne ?? null;
  const valeurDe = (p) => {
    if (colonne === null) return null;
    if (colonne === 'exclu') return p.exclu ? 1 : 0;
    return p[colonne] === null ? null : cleNormalisee(p[colonne]);
  };
  const valeurs = new Map(retenues.map((p) => [p, valeurDe(p)]));
  const comparer = (a, b) => {
    const va = valeurs.get(a);
    const vb = valeurs.get(b);
    if (va !== vb) {
      if (va === null) return 1;
      if (vb === null) return -1;
      const ecart = typeof va === 'number' ? va - vb : comparerTextes(va, vb);
      if (ecart !== 0) return ecart * signe;
    }
    return a.id - b.id;
  };
  return retenues.sort(comparer);
}

/**
 * La cellule qu'atteint une touche depuis la cellule position, dans une
 * grille de lignes × colonnes. Les flèches bougent d'une cellule et restent
 * sur place au bord ; Tab avance dans la ligne puis passe au début de la
 * suivante, Maj+Tab recule de même. Tab après la dernière cellule, Maj+Tab
 * avant la première, rendent null : le focus quitte la grille, et le
 * navigateur le mène à l'élément suivant. Une autre touche ne bouge rien.
 * Une grille sans ligne n'a pas de cellule : null.
 *
 * @param {{ligne: number, colonne: number}} position
 * @param {string} touche   'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
 *   'Tab' ou 'Maj+Tab'
 * @param {{lignes: number, colonnes: number}} taille
 * @returns {{ligne: number, colonne: number}|null}
 */
export function celluleSuivante({ ligne, colonne }, touche, { lignes, colonnes }) {
  if (lignes === 0 || colonnes === 0) return null;
  const borner = (valeur, max) => (valeur < 0 ? 0 : valeur > max ? max : valeur);
  const rang = ligne * colonnes + colonne;
  switch (touche) {
    case 'ArrowUp':
      return { ligne: borner(ligne - 1, lignes - 1), colonne };
    case 'ArrowDown':
      return { ligne: borner(ligne + 1, lignes - 1), colonne };
    case 'ArrowLeft':
      return { ligne, colonne: borner(colonne - 1, colonnes - 1) };
    case 'ArrowRight':
      return { ligne, colonne: borner(colonne + 1, colonnes - 1) };
    case 'Tab':
      return rang + 1 >= lignes * colonnes ? null : { ligne: Math.floor((rang + 1) / colonnes), colonne: (rang + 1) % colonnes };
    case 'Maj+Tab':
      return rang === 0 ? null : { ligne: Math.floor((rang - 1) / colonnes), colonne: (rang - 1) % colonnes };
    default:
      return { ligne, colonne };
  }
}

/**
 * L'orthographe déjà portée par un autre participant pour une appartenance
 * saisie, à proposer sans fusionner : la première, dans l'ordre reçu, dont
 * la clé normalisée égale celle de la saisie. null quand la saisie est
 * nouvelle, vide, ou identique à une appartenance portée — lue comme la
 * saisie l'enregistre, en NFC, sans ses blancs de bord. Une appartenance
 * null ne se compare pas.
 *
 * @param {string|null} saisie
 * @param {Array<{appartenance: string|null}>} participants
 * @param {(texte: string) => string} cleNormalisee
 * @returns {string|null}
 */
export function orthographeExistante(saisie, participants, cleNormalisee) {
  if (saisie === null) return null;
  const texte = saisie.normalize('NFC').trim();
  if (texte === '') return null;
  const portees = participants.map(({ appartenance }) => appartenance).filter((a) => a !== null);
  if (portees.includes(texte)) return null;
  const cle = cleNormalisee(texte);
  return portees.find((appartenance) => cleNormalisee(appartenance) === cle) ?? null;
}

/**
 * L'itinéraire d'une personne dans le retenu, pour la fiche : à chaque
 * tour, de 1 à tours, la table (numéro affiché) et le siège — null quand le
 * retenu n'attribue pas les sièges —, ou la réserve. Lu dans etatDuTour(r)
 * = etatPlaces(charge, {tour: r}), jamais recalculé. Un tour dont la source
 * n'est pas 'retenu' — le retenu gardé à moins de tours que l'événement
 * n'en compte, après une hausse des tours (§ 9) — se dit hors du retenu,
 * et les tours que le retenu porte restent. null quand le tour 1 n'a pas le
 * retenu pour source, ou que la personne n'est, à un tour du retenu, ni
 * assise ni en réserve — une exclue, absente de tout tour.
 *
 * @param {number} id
 * @param {number} tours
 * @param {(tour: number) => Object} etatDuTour   l'EtatPlaces du tour
 * @returns {Array<{tour: number, numero: number, siege: number|null}|{tour: number, reserve: true}|{tour: number, horsRetenu: true}>|null}
 */
export function itineraire(id, tours, etatDuTour) {
  const etapes = [];
  for (let tour = 1; tour <= tours; tour += 1) {
    const etat = etatDuTour(tour);
    if (etat.source !== 'retenu') {
      if (tour === 1) return null;
      etapes.push({ tour, horsRetenu: true });
      continue;
    }
    let etape = null;
    for (const table of etat.tables) {
      const chaise = table.chaises.find(({ occupant }) => occupant === id);
      if (chaise !== undefined) {
        etape = { tour, numero: table.numero, siege: etat.siegesAttribues ? chaise.siege : null };
        break;
      }
    }
    if (etape === null && etat.reserve.includes(id)) etape = { tour, reserve: true };
    if (etape === null) return null;
    etapes.push(etape);
  }
  return etapes;
}

/**
 * Vrai quand Entrée valide la saisie : toujours, sauf Maj+Entrée dans une
 * zone de texte — les notes —, qui y insère un saut de ligne.
 *
 * @param {{maj: boolean, multiligne: boolean}} touche   maj : Maj tenue ;
 *        multiligne : la saisie est une zone de texte
 * @returns {boolean}
 */
export function entreeValide({ maj, multiligne }) {
  return !(maj && multiligne);
}

/**
 * Les réservations d'une personne, pour la fiche et la fenêtre de
 * suppression : dans l'ordre de la charge, chacune avec le numéro affiché
 * de sa table.
 *
 * @param {{tables: Array<{id: number, numero: number}>, reservations: Array<Object>}} charge
 * @param {number} id
 * @returns {Array<{numero: number, siege: number|null, portee: 'tous'|'tour', tour: number|null}>}
 */
export function reservationsDe(charge, id) {
  const numeroDe = new Map(charge.tables.map((table) => [table.id, table.numero]));
  return charge.reservations
    .filter(({ participant }) => participant === id)
    .map(({ table, siege, portee, tour }) => ({ numero: numeroDe.get(table), siege, portee, tour }));
}

/**
 * Le nom proposé à l'enregistrement de l'export de la liste (§ 10.2) :
 * ‹base›-participants.csv, base étant celle de l'événement ouvert.
 *
 * @param {string} base
 * @returns {string}
 */
export const nomExport = (base) => `${base}-participants.csv`;
