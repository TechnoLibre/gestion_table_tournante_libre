// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les fichiers livrés que le catalogue des démonstrations détermine (§ 10.3,
// § 15.5) : le fichier d'état de chaque démonstration, sous
// src/demo/livrees/ ; l'export CSV de la liste des participants de la petite
// et de la grande, et la variante windows-1252 du CSV des cas limites, sous
// exemples/. Le CSV des cas limites s'écrit à la main : le script le lit et
// ne l'écrit jamais.
//
//   node scripts/engendrer_livrables.js [destination]
//
// La destination, la racine du projet par défaut, reçoit les sept fichiers
// sous leurs chemins relatifs, et rien n'est écrit ailleurs ; un chemin
// relatif se lit depuis le répertoire courant. Tout se calcule avant la
// première écriture. Le fichier livré est la source de vérité (§ 15.5,
// point 5) : src/demo/livrees.long.test.js rejoue ce script et compare
// l'empreinte de chaque charge à celle du fichier livré. Lancer le script
// est donc le geste conscient qui change une démonstration : il imprime,
// pour chaque fichier, s'il est créé, inchangé ou réécrit, et l'empreinte de
// la charge de chaque fichier d'état. Ni horloge ni tirage n'y entrent.
//
// Une démonstration livrée est la configuration de son entrée du catalogue,
// mise en charge (§ 4, § 8.8) :
// - l'événement demo:<clé>, au nom du catalogue, sans date, en brouillon et
//   sans filiation ;
// - les sièges par défaut : la capacité la plus fréquente des tables, la
//   plus grande à égalité ; une table d'une autre capacité porte la sienne
//   en surcharge (§ 6.1) ;
// - les tables rondes, rangées en grille dans l'ordre de la configuration,
//   rangée par rangée, leurs rangées espacées de 300 cm ; la grille a la
//   plus petite largeur dont le carré contient toutes les tables, et seule
//   sa dernière rangée est incomplète. Ses colonnes s'écartent assez pour
//   que le bloc de noms d'une table, de toute sa largeur, tienne entre deux
//   colonnes : aucune liste ne passe sur une autre table (§ 7.4) ;
// - les contraintes de la configuration, les sièges non attribués, la
//   génération par défaut de la recherche ;
// - chaque réservation, celle d'un animateur, au siège 1 de sa table pour
//   tous les tours, ce siège titré « animation », et le titre pressenti
//   « animation » porté par l'animateur ;
// - aucune proposition : le placement n'est pas figé (§ 15.5, point 6).
// Son fichier d'état s'écrit à la révision 1, sans journal, sous la version
// de la construction qui écrit (§ 18.6).
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decoder } from '../src/csv/encodage.js';
import { SEPARATEUR, ecrireCsv, exporterParticipants } from '../src/csv/export.js';
import { decouper } from '../src/csv/lecture.js';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { constante } from '../src/geometrie/constantes.js';
import { ECART_LISTE, geometrieTable } from '../src/geometrie/tables.js';
import { serialiser, serialiserCharge } from '../src/stockage/canonique.js';
import { analyser, creerCharge } from '../src/stockage/document.js';
import { VERSION } from '../src/version.genere.js';

const RACINE = resolve(fileURLToPath(new URL('..', import.meta.url)));

// Chemins des livrables, relatifs à la racine, séparés par « / ».
const DOSSIER_LIVREES = 'src/demo/livrees';
const CAS_LIMITES = 'exemples/participants_cas_limites.csv';
const CAS_LIMITES_CP1252 = 'exemples/participants_cas_limites_cp1252.csv';
const csvDeDemonstration = (cle) => `exemples/participants_demo_${cle}.csv`;

// Démonstrations dont la liste des participants est livrée en CSV, dans
// l'ordre du § 10.3.
const DEMONSTRATIONS_EN_CSV = ['petite', 'grande'];

// Séparateur de la variante windows-1252 (§ 10.3).
const VIRGULE = ',';

// Écart entre les centres de deux rangées de la grille, en cm.
const ECART_RANGEES_CM = 300;

// Le siège de l'animateur, et le titre qu'il porte.
const SIEGE_ANIMATEUR = 1;
const ANIMATION = 'animation';

const USAGE = 'usage : node scripts/engendrer_livrables.js [destination]';

// Capacité la plus fréquente parmi les tables, la plus grande à égalité ; le
// résultat ne dépend pas de l'ordre des tables.
function capaciteParDefaut(tables) {
  const effectifs = new Map();
  for (const { capacite } of tables) effectifs.set(capacite, (effectifs.get(capacite) ?? 0) + 1);
  let defaut = null;
  for (const [capacite, effectif] of effectifs) {
    const effectifDuDefaut = effectifs.get(defaut) ?? 0;
    if (effectif > effectifDuDefaut || (effectif === effectifDuDefaut && capacite > defaut)) defaut = capacite;
  }
  return defaut;
}

// Largeur de la grille de nombre tables : la plus petite largeur c telle
// que c × c ≥ nombre.
function colonnesDe(nombre) {
  let colonnes = 1;
  while (colonnes * colonnes < nombre) colonnes += 1;
  return colonnes;
}

// Écart entre les centres de deux colonnes de la grille, en cm entiers : le
// bloc de noms d'une table commence à ECART_LISTE de son emprise et s'étend
// sur LARGEUR_BLOC_NOMS_CM, où toute ligne s'abrège ; il s'achève à
// ECART_LISTE de l'emprise de la colonne suivante, pour la plus grande
// emprise des capacités données. Aucune emprise, d'aucune rangée, ne
// rencontre ainsi la bande du bloc.
function ecartColonnes(capacites) {
  const emprise = Math.max(
    ...capacites.map(
      (places) => geometrieTable({ id: 0, numero: 0, forme: 'ronde', position: { x: 0, y: 0 } }, places).rayonEmprise,
    ),
  );
  return Math.ceil(2 * emprise + 2 * ECART_LISTE + constante('LARGEUR_BLOC_NOMS_CM'));
}

// Plus grand identifiant d'une liste d'enregistrements ; 0 pour une liste
// vide.
const plusGrandId = (enregistrements) => enregistrements.reduce((plus, { id }) => Math.max(plus, id), 0);

// Animateur de chaque table réservée, par identifiant de table, dans l'ordre
// des réservations. Lève quand une réservation ne vaut pas pour tous les
// tours, ou qu'une table en reçoit deux : le siège 1 ne porte qu'un
// animateur, et le script n'écrit que ce que le catalogue produit.
function animateursDe(reservations, cle) {
  const animateurs = new Map();
  for (const { participant, table, portee } of reservations) {
    if (portee !== 'tous' || animateurs.has(table)) {
      throw new Error(
        `démonstration ${cle} : la table ${table} reçoit au plus un animateur, réservé pour tous les tours`,
      );
    }
    animateurs.set(table, participant);
  }
  return animateurs;
}

/**
 * Charge de la démonstration d'une entrée du catalogue, telle que l'en-tête
 * du module la décrit. La configuration est construite une fois ; la charge
 * rendue est faite d'objets neufs.
 *
 * @param {{cle: string, nom: string, construire: () => import('../src/moteur/types.js').Configuration}} entree
 * @returns {import('../src/stockage/types.js').Charge}
 * @throws {Error} quand une réservation ne vaut pas pour tous les tours, ou
 *   qu'une table en reçoit deux
 */
export function chargeDeDemonstration({ cle, nom, construire }) {
  const { participants, tables, tours, reservations, contraintes } = construire();
  const siegesParDefaut = capaciteParDefaut(tables);
  const neuve = creerCharge({ id: `demo:${cle}`, nom, date: null, siegesParDefaut, tours });
  const animateurs = animateursDe(reservations, cle);
  const reserves = new Set(animateurs.values());
  const colonnes = colonnesDe(tables.length);
  const ecart = ecartColonnes(tables.map(({ capacite }) => capacite));
  const { separerAppartenances, nouveauxVoisins, nouvelleTable, varierAppartenances } = contraintes;
  return {
    ...neuve,
    reglages: { ...neuve.reglages, separerAppartenances, nouveauxVoisins, nouvelleTable, varierAppartenances },
    prochainsIds: { participant: plusGrandId(participants) + 1, table: plusGrandId(tables) + 1, proposition: 1 },
    participants: participants.map((participant) => ({
      id: participant.id,
      nom: participant.nom,
      prenom: participant.prenom ?? null,
      appartenance: participant.appartenance,
      courriel: null,
      titrePressenti: reserves.has(participant.id) ? ANIMATION : null,
      notes: null,
      exclu: participant.exclu === true,
    })),
    tables: tables.map(({ id, numero, capacite }, rang) => ({
      id,
      numero,
      sieges: capacite === siegesParDefaut ? null : capacite,
      forme: 'ronde',
      position: { x: (rang % colonnes) * ecart, y: Math.floor(rang / colonnes) * ECART_RANGEES_CM },
    })),
    reservations: [...animateurs].map(([table, participant]) => ({
      participant,
      table,
      siege: SIEGE_ANIMATEUR,
      portee: 'tous',
      tour: null,
    })),
    titres: [...animateurs.keys()].map((table) => ({ table, siege: SIEGE_ANIMATEUR, libelle: ANIMATION })),
  };
}

/**
 * Texte du fichier d'état livré d'une entrée du catalogue : sa charge, en
 * forme canonique, à la révision 1, sous la version de la construction qui
 * écrit.
 *
 * @param {{cle: string, nom: string, construire: Function}} entree
 * @param {{produitVersion?: string}} [options]  version affichée de la
 *   construction, VERSION.affichee par défaut
 * @returns {string}
 */
export function texteDeDemonstration(entree, { produitVersion = VERSION.affichee } = {}) {
  return serialiser(chargeDeDemonstration(entree), { revision: 1, produitVersion });
}

/**
 * Empreinte d'une charge (§ 15.5, point 5) : SHA-256 de son texte canonique
 * seul, en 64 chiffres hexadécimaux minuscules. L'en-tête n'y entre pas : la
 * version de la construction qui écrit ne la change pas.
 *
 * @param {import('../src/stockage/types.js').Charge} charge
 * @returns {string}
 */
export function empreinte(charge) {
  return createHash('sha256').update(serialiserCharge(charge)).digest('hex');
}

// Octet windows-1252 de chaque caractère que ce codage représente, lu dans
// le décodeur windows-1252 lui-même, octet par octet : l'encodage en est
// l'inverse exact. 00 à 7F donnent l'ASCII, A0 à FF les mêmes points de
// code, 80 à 9F les signes propres à windows-1252, dont « € », « œ » et
// l'apostrophe typographique.
const DECODEUR_1252 = new TextDecoder('windows-1252');
const OCTET_1252 = new Map(
  Array.from({ length: 256 }, (_, octet) => [DECODEUR_1252.decode(Uint8Array.of(octet)), octet]),
);

/**
 * Octets windows-1252 d'un texte, un par caractère, sans marque.
 *
 * @param {string} texte
 * @returns {Uint8Array}
 * @throws {RangeError} pour un caractère que windows-1252 ne représente pas,
 *   nommé par son point de code et son rang dans le texte, en unités UTF-16
 */
export function enWindows1252(texte) {
  const octets = [];
  let rang = 0;
  for (const caractere of texte) {
    const octet = OCTET_1252.get(caractere);
    if (octet === undefined) {
      const point = caractere.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      throw new RangeError(`U+${point}, au rang ${rang} : caractère absent de windows-1252`);
    }
    octets.push(octet);
    rang += caractere.length;
  }
  return Uint8Array.from(octets);
}

/**
 * Variante windows-1252 du CSV des cas limites (§ 10.3) : ses
 * enregistrements, découpés sous « ; », réécrits sous « , » par l'écriture
 * unique des CSV, puis encodés en windows-1252, sans marque. Chaque champ
 * garde son texte ; un champ qui porte la virgule, un guillemet ou une fin
 * de ligne s'écrit cité.
 *
 * @param {Uint8Array} octets  le fichier écrit à la main, que decoder lit
 * @returns {Uint8Array}
 * @throws {Error} quand un guillemet reste ouvert à la fin du fichier
 */
export function varianteWindows1252(octets) {
  const { enregistrements, guillemetOuvert } = decouper(decoder(octets).texte, SEPARATEUR);
  if (guillemetOuvert) throw new Error(`${CAS_LIMITES} : un guillemet reste ouvert à la fin du fichier`);
  // ecrireCsv écrit de l'UTF-8 avec marque, que le décodeur UTF-8 retire.
  return enWindows1252(new TextDecoder().decode(ecrireCsv(enregistrements, VIRGULE)));
}

/**
 * Les sept livrables, calculés sans rien écrire : { chemin, octets,
 * empreinte } ; le chemin est relatif à la racine, séparé par « / » ;
 * l'empreinte, celle de la charge d'un fichier d'état, null pour un CSV. Dans
 * l'ordre : le fichier d'état de chaque démonstration, dans l'ordre du
 * catalogue ; l'export de la liste des participants de la petite, puis de la
 * grande, chacun lu dans le texte du fichier d'état de sa démonstration ; la
 * variante windows-1252 du CSV des cas limites.
 *
 * @param {{casLimites: Uint8Array, produitVersion?: string}} options
 *   casLimites : les octets du CSV des cas limites, écrit à la main
 * @returns {Array<{chemin: string, octets: Uint8Array, empreinte: string|null}>}
 */
export function livrables({ casLimites, produitVersion = VERSION.affichee }) {
  const etats = CATALOGUE.map((entree) => {
    const texte = texteDeDemonstration(entree, { produitVersion });
    return { cle: entree.cle, texte, charge: analyser(texte).charge };
  });
  const fichiers = etats.map(({ cle, texte, charge }) => ({
    chemin: `${DOSSIER_LIVREES}/${cle}.gtt.json`,
    octets: new TextEncoder().encode(texte),
    empreinte: empreinte(charge),
  }));
  for (const cle of DEMONSTRATIONS_EN_CSV) {
    const etat = etats.find((candidat) => candidat.cle === cle);
    if (etat === undefined) throw new Error(`aucune démonstration ${cle} au catalogue`);
    fichiers.push({
      chemin: csvDeDemonstration(cle),
      octets: exporterParticipants(etat.charge.participants),
      empreinte: null,
    });
  }
  fichiers.push({ chemin: CAS_LIMITES_CP1252, octets: varianteWindows1252(casLimites), empreinte: null });
  return fichiers;
}

// Octets d'un fichier, ou null quand il n'existe pas.
function lireSiPresent(chemin) {
  try {
    return readFileSync(chemin);
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return null;
    throw erreur;
  }
}

/**
 * Écrit les sept livrables sous destination, après les avoir tous calculés,
 * et rien ailleurs. Le CSV des cas limites se lit sous source. Rend chaque
 * livrable avec son état : « créé » quand le fichier n'existait pas,
 * « inchangé » quand il portait déjà ces octets, « réécrit » sinon.
 *
 * @param {string} destination  racine qui reçoit les fichiers
 * @param {{source?: string, produitVersion?: string}} [options]  source : la
 *   racine du projet par défaut
 * @returns {Array<{chemin: string, octets: Uint8Array, empreinte: string|null, etat: string}>}
 */
export function ecrireLivrables(destination, { source = RACINE, produitVersion } = {}) {
  const casLimites = readFileSync(join(source, ...CAS_LIMITES.split('/')));
  return livrables({ casLimites, produitVersion }).map((fichier) => {
    const cible = join(destination, ...fichier.chemin.split('/'));
    const avant = lireSiPresent(cible);
    mkdirSync(dirname(cible), { recursive: true });
    writeFileSync(cible, fichier.octets);
    const etat = avant === null ? 'créé' : Buffer.compare(avant, fichier.octets) === 0 ? 'inchangé' : 'réécrit';
    return { ...fichier, etat };
  });
}

// Ligne de commande : une destination au plus, la racine par défaut. Sort à
// 0 après l'écriture, à 1 quand un livrable ne se calcule ou ne s'écrit pas,
// à 2 sur un usage fautif.
function executer(arguments_) {
  if (arguments_.length > 1 || arguments_.some((argument) => argument.startsWith('-'))) {
    console.error(USAGE);
    return 2;
  }
  const destination = arguments_.length === 1 ? resolve(arguments_[0]) : RACINE;
  let ecrits;
  try {
    ecrits = ecrireLivrables(destination);
  } catch (erreur) {
    console.error(`Livrables : ${erreur.message}`);
    return 1;
  }
  console.log(`Livrables écrits sous ${destination}, construction ${VERSION.affichee} :`);
  for (const { chemin, octets, empreinte: hachage, etat } of ecrits) {
    const suite = hachage === null ? '' : `, empreinte de la charge ${hachage}`;
    console.log(`  ${etat.padEnd(9)}${chemin} (${octets.length} octets${suite})`);
  }
  return 0;
}

// Vrai quand ce fichier est le script que Node a lancé, et non un module
// importé.
function estLanceDirectement() {
  if (process.argv[1] === undefined) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (estLanceDirectement()) process.exitCode = executer(process.argv.slice(2));
