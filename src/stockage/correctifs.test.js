// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des correctifs du journal (§ 8.6, § 8.9) : l'aller-retour
// appliquer(a, difference(a, b)) sur des paires de charges tirées, la
// localité sur la grande démonstration, chaque règle de difference, la copie
// que rend appliquer, et ses refus, chacun avec le rang de l'opération
// refusée. Les charges des démonstrations se construisent ici, en forme
// positionnelle, sans le module des placements : la configuration vient du
// catalogue, chaque proposition d'une distribution tournante. Ce module ne
// sert qu'à reconnaître un retenu abîmé, et à examiner un fichier qui en
// porte un comme le dépôt l'ouvre. Les noms des charges tirées et des
// retouches sont inventés.
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { CATALOGUE } from '../demo/catalogue.js';
import { VERSION } from '../version.genere.js';
import { canoniser, serialiser, serialiserCharge } from './canonique.js';
import { appliquer, difference } from './correctifs.js';
import { analyser, creerCharge } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { examiner, fautes } from './placements.js';

// En-tête sous lequel une charge d'épreuve s'écrit pour être relue.
const ENTETE = Object.freeze({ revision: 1, produitVersion: VERSION.affichee });

// Graine et nombre de tirages de la propriété, écrits ici pour que chaque
// exécution tire les mêmes paires (§ 14.12).
const GRAINE = 80_609;
const TIRAGES = 300;

const croissant = (x, y) => x - y;
const copie = (valeur) => structuredClone(valeur);
const octets = (texte) => new TextEncoder().encode(texte).length;

// Chaque objet et chaque liste que porte valeur, elle comprise :
// JSON.stringify présente chacun à la fonction de remplacement avant de
// l'écrire.
function objetsDe(valeur) {
  const objets = new Set();
  JSON.stringify(valeur, (_, enfant) => {
    if (typeof enfant === 'object' && enfant !== null) objets.add(enfant);
    return enfant;
  });
  return objets;
}

// Gèle valeur et tout ce qu'elle porte : une écriture y lève TypeError, le
// module s'exécutant en mode strict.
function geler(valeur) {
  for (const objet of objetsDe(valeur)) Object.freeze(objet);
  return valeur;
}

// Détails du refus CORRECTIF de appliquer(charge, correctif), ou un texte
// qui dit l'écart : une autre erreur, un autre code, aucun refus.
function refusDe(charge, correctif) {
  try {
    appliquer(charge, correctif);
  } catch (erreur) {
    if (!(erreur instanceof ErreurStockage)) {
      return `${erreur?.name} au lieu d'une ErreurStockage : ${erreur?.message}`;
    }
    if (erreur.code !== 'CORRECTIF') return `code ${erreur.code} au lieu de CORRECTIF`;
    return erreur.details;
  }
  return 'aucun refus';
}

// Chaque valeur que porte valeur, elle exclue, { chemin, valeur }, dans
// l'ordre où JSON.stringify les écrit, celui du schéma sur une copie
// canonique : une clé mène au champ d'un objet, un rang à l'élément d'une
// liste. La fonction de remplacement reçoit chaque enfant avec, pour this,
// son porteur, rencontré avant lui ; valeur elle-même a pour porteur l'objet
// qui l'enveloppe, et le chemin vide.
function valeursDe(valeur) {
  const chemins = new Map();
  const releves = [];
  JSON.stringify(valeur, function relever(cle, enfant) {
    const chemin = chemins.has(this) ? [...chemins.get(this), Array.isArray(this) ? Number(cle) : cle] : [];
    if (typeof enfant === 'object' && enfant !== null) chemins.set(enfant, chemin);
    if (chemin.length > 0) releves.push({ chemin, valeur: enfant });
    return enfant;
  });
  return releves;
}

// Chemin de chaque liste que porte valeur, dans l'ordre de valeursDe.
const cheminsDesListes = (valeur) =>
  valeursDe(valeur).flatMap(({ chemin, valeur: enfant }) => (Array.isArray(enfant) ? [chemin] : []));

// --- Les démonstrations, en forme positionnelle ---------------------------

// Les n premiers entiers ≥ 1 premiers avec total, croissants.
function premiersAvec(total, n) {
  const pgcd = (x, y) => (y === 0 ? x : pgcd(y, x % y));
  const rendus = [];
  for (let m = 1; rendus.length < n; m += 1) if (pgcd(m, total) === 1) rendus.push(m);
  return rendus;
}

// Proposition de la configuration en forme positionnelle (§ 8.9), d'une
// distribution tournante. Au tour r, une file range les N identifiants
// croissants par le pas du tour, r-ième entier premier avec N : la place i
// de la file reçoit l'identifiant de rang (i × pas) mod N. La file se
// distribue une personne par table, dans l'ordre des tables et en boucle,
// une table pleine passée ; qui ne trouve plus de siège va à la réserve.
// Sans attribution des sièges, chaque liste de table se trie par
// identifiant ; avec, l'ordre de la distribution fait l'ordre des sièges.
function propositionTournante(configuration, { id, siegesAttribues }) {
  const ids = configuration.participants.map((p) => p.id).sort(croissant);
  const capacites = configuration.tables.map((t) => t.capacite);
  const placement = premiersAvec(ids.length, configuration.tours).map((pas) => {
    const sieges = capacites.map(() => []);
    const reserve = [];
    let table = 0;
    for (let i = 0; i < ids.length; i += 1) {
      let passees = 0;
      while (passees < capacites.length && sieges[table].length === capacites[table]) {
        table = (table + 1) % capacites.length;
        passees += 1;
      }
      if (passees === capacites.length) {
        reserve.push(ids[(i * pas) % ids.length]);
      } else {
        sieges[table].push(ids[(i * pas) % ids.length]);
        table = (table + 1) % capacites.length;
      }
    }
    return {
      sieges: siegesAttribues ? sieges : sieges.map((liste) => liste.sort(croissant)),
      reserve: reserve.sort(croissant),
    };
  });
  return {
    id,
    graine: 48_271 * id,
    arret: 200_000,
    historique: 1_000,
    produitVersion: ENTETE.produitVersion,
    siegesAttribues,
    tables: configuration.tables.map((t) => t.id),
    capacites,
    tours: configuration.tours,
    participants: ids,
    placement,
  };
}

// Charge d'une démonstration du catalogue (§ 15) : sa configuration en
// champs nommés, chaque table au défaut de l'événement quand sa capacité y
// est égale, ses réservations sans siège, et une proposition tournante par
// demande { id, siegesAttribues }. Une charge neuve à chaque appel.
function chargeDe(cle, demandes) {
  const entree = CATALOGUE.find((candidate) => candidate.cle === cle);
  const configuration = entree.construire();
  const siegesParDefaut = Math.max(...configuration.tables.map((t) => t.capacite));
  const charge = creerCharge({ id: `demo-${cle}`, nom: entree.nom, siegesParDefaut, tours: configuration.tours });
  charge.evenement.etat = 'propose';
  charge.prochainsIds = {
    participant: Math.max(...configuration.participants.map((p) => p.id)) + 1,
    table: Math.max(...configuration.tables.map((t) => t.id)) + 1,
    proposition: Math.max(0, ...demandes.map(({ id }) => id)) + 1,
  };
  charge.participants = configuration.participants.map(({ id, nom, prenom, appartenance }) => ({
    id,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = configuration.tables.map(({ id, numero, capacite }, rang) => ({
    id,
    numero,
    sieges: capacite === siegesParDefaut ? null : capacite,
    forme: 'ronde',
    position: { x: 250 * (rang % 6), y: 250 * Math.floor(rang / 6) },
  }));
  charge.reservations = configuration.reservations.map(({ participant, table, portee, tour = null }) => ({
    participant,
    table,
    siege: null,
    portee,
    tour,
  }));
  charge.propositions = demandes.map((demande) => propositionTournante(configuration, demande));
  return charge;
}

// La grande démonstration (§ 15.1) : 260 personnes à 33 tables pleines,
// 4 tours, et trois propositions dont les identifiants ne sont pas leurs
// rangs ; la proposition 7 a ses sièges attribués.
const grande = () =>
  chargeDe('grande', [
    { id: 4, siegesAttribues: false },
    { id: 7, siegesAttribues: true },
    { id: 9, siegesAttribues: false },
  ]);

// La petite démonstration (§ 15.3) : 12 personnes, 4 tables de 3, aucune
// réservation, une proposition sans attribution des sièges.
const petite = () => chargeDe('petite', [{ id: 1, siegesAttribues: false }]);

// Identifiant de la première personne sans réservation d'une charge.
function sansReservation(charge, aPartirDe = 1) {
  const reserves = new Set(charge.reservations.map((r) => r.participant));
  return charge.participants.find((p) => p.id >= aPartirDe && !reserves.has(p.id)).id;
}

// --- Les paires tirées ----------------------------------------------------

const IDS_PARTICIPANTS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const IDS_TABLES = [1, 2, 3, 4, 5];
// Plus grand identifiant de proposition tiré.
const ID_PROPOSITION_MAX = 3;
const NOMS_INVENTES = ['Brindille', 'Calembour', 'Dentelle', 'Escarbille', 'Falbala', 'Girouette'];
const PRENOMS_INVENTES = ['Azur', 'Céladon', 'Nacre', 'Opale'];
const APPARTENANCES = ['Cercle du Héron', 'Club Lanterne', 'Atelier Boussole'];
const LIBELLES = ['animation', 'accueil', 'secrétariat'];

// Une valeur ou null : fast-check tire null une fois sur freq, ici une fois
// sur deux.
const ouNul = (arbitraire) => fc.option(arbitraire, { nil: null, freq: 2 });
// Deux tirages indépendants d'un même arbitraire : les deux variantes d'un
// élément du vivier.
const deuxFois = (arbitraire) => fc.tuple(arbitraire, arbitraire);

// Les champs de saisie se tirent parmi peu de valeurs : deux variantes d'un
// même enregistrement coïncident souvent champ par champ.
const unParticipant = (id) =>
  fc.record({
    id: fc.constant(id),
    nom: fc.constantFrom(...NOMS_INVENTES),
    prenom: ouNul(fc.constantFrom(...PRENOMS_INVENTES)),
    appartenance: ouNul(fc.constantFrom(...APPARTENANCES)),
    courriel: ouNul(fc.constantFrom('a@exemple.test', 'b@exemple.test')),
    titrePressenti: ouNul(fc.constantFrom(...LIBELLES)),
    notes: ouNul(fc.constantFrom('arrive tard', 'part tôt')),
    exclu: fc.boolean(),
  });

const coordonnee = fc.oneof(fc.integer({ min: -400, max: 400 }), fc.double({ min: -1e4, max: 1e4, noNaN: true }));

const uneTable = (id) =>
  fc.record({
    id: fc.constant(id),
    numero: fc.integer({ min: 1, max: 9 }),
    sieges: ouNul(fc.integer({ min: 2, max: 5 })),
    forme: fc.constantFrom('ronde', 'carree'),
    position: fc.record({ x: coordonnee, y: coordonnee }),
  });

const unEvenement = fc.record({
  id: fc.constantFrom('evt-heron', 'evt-lanterne'),
  nom: fc.constantFrom('Soirée des Hérons', 'Banquet Lanterne'),
  date: ouNul(fc.constantFrom('2031-05-17', '2032-02-29')),
  siegesParDefaut: fc.integer({ min: 2, max: 4 }),
  tours: fc.integer({ min: 1, max: 3 }),
  unite: fc.constant('cm'),
  etat: fc.constantFrom('brouillon', 'propose', 'retenu', 'bloque'),
  filiation: ouNul(
    fc.record({
      source: fc.record({ id: fc.constant('evt-source'), nom: fc.constant('Soirée source') }),
      instant: fc.record({
        revision: fc.integer({ min: 1, max: 60 }),
        libelle: fc.constantFrom('Création', 'Ajouté Azur Brindille'),
      }),
    }),
  ),
});

const desReglages = fc.record({
  separerAppartenances: fc.boolean(),
  nouveauxVoisins: fc.boolean(),
  nouvelleTable: fc.boolean(),
  varierAppartenances: fc.boolean(),
  attribuerSieges: fc.boolean(),
  generation: fc.record({
    nombre: fc.integer({ min: 1, max: 20 }),
    arret: fc.constantFrom(20_000, 200_000),
    historique: fc.constantFrom(500, 1_000),
  }),
});

// Réservations et titres candidats : une charge garde ceux dont la
// personne, la table et le siège y existent, et le tour y tient.
const uneReservation = fc
  .record({
    participant: fc.constantFrom(...IDS_PARTICIPANTS),
    table: fc.constantFrom(...IDS_TABLES),
    siege: ouNul(fc.integer({ min: 1, max: 5 })),
    portee: fc.constantFrom('tous', 'tour'),
    tour: fc.integer({ min: 1, max: 3 }),
  })
  .map((reservation) => (reservation.portee === 'tous' ? { ...reservation, tour: null } : reservation));

const unTitre = fc.record({
  table: fc.constantFrom(...IDS_TABLES),
  siege: fc.integer({ min: 1, max: 5 }),
  libelle: fc.constantFrom(...LIBELLES),
});

// Un tour : chaque participant, dans l'ordre d'une file mélangée, va à l'une
// des tables ou, au rang nombreDeTables, à la réserve. Les listes gardent
// l'ordre de la file, qui n'est pas l'ordre canonique.
const unTour = (participants, nombreDeTables) =>
  fc
    .tuple(
      fc.shuffledSubarray(participants, { minLength: participants.length, maxLength: participants.length }),
      fc.array(fc.integer({ min: 0, max: nombreDeTables }), {
        minLength: participants.length,
        maxLength: participants.length,
      }),
    )
    .map(([file, places]) => {
      const sieges = Array.from({ length: nombreDeTables }, () => []);
      const reserve = [];
      file.forEach((personne, rang) => {
        (places[rang] === nombreDeTables ? reserve : sieges[places[rang]]).push(personne);
      });
      return { sieges, reserve };
    });

// Une proposition de une à quatre tables du vivier, qui place une partie
// des participants du vivier, sans égard aux capacités : le contrôle des
// placements l'examine à part (§ 8.9), et l'analyse ne regarde que la
// liste. Les identifiants se tirent de 1 à ID_PROPOSITION_MAX : deux
// propositions d'une charge peuvent partager le leur, ce que la lecture
// admet, et prochainsIds.proposition reste au-delà de chacun.
const uneProposition = fc
  .record({
    id: fc.integer({ min: 1, max: ID_PROPOSITION_MAX }),
    graine: fc.integer({ min: 0, max: 2 ** 32 - 1 }),
    arret: fc.constantFrom(20_000, 200_000),
    historique: fc.constantFrom(500, 1_000),
    produitVersion: fc.constantFrom(VERSION.affichee, versionVoisine(VERSION.affichee)),
    siegesAttribues: fc.boolean(),
    tables: fc.uniqueArray(fc.constantFrom(...IDS_TABLES), { minLength: 1, maxLength: 4 }),
    tours: fc.integer({ min: 1, max: 3 }),
    participants: fc.uniqueArray(fc.constantFrom(...IDS_PARTICIPANTS), { minLength: 1, maxLength: 8 }),
  })
  .chain((tete) =>
    fc
      .record({
        capacites: fc.array(fc.integer({ min: 2, max: 5 }), {
          minLength: tete.tables.length,
          maxLength: tete.tables.length,
        }),
        placement: fc.array(unTour(tete.participants, tete.tables.length), {
          minLength: tete.tours,
          maxLength: tete.tours,
        }),
      })
      .map((suite) => ({ ...tete, ...suite })),
  );

// La seconde variante d'une proposition retouche la première d'un geste :
// échanger deux places d'un tour, déplacer une personne vers une autre
// table ou la réserve, basculer l'attribution des sièges, changer la graine.
function retoucher(proposition, { geste, tour, de, vers }) {
  const variante = copie(proposition);
  const { sieges, reserve } = variante.placement[tour % variante.placement.length];
  const places = sieges.flatMap((liste, table) => liste.map((_, rang) => [table, rang]));
  if (geste === 'attribution') variante.siegesAttribues = !variante.siegesAttribues;
  if (geste === 'graine') variante.graine = (variante.graine + 1) % 2 ** 32;
  if (geste === 'echanger' && places.length > 0) {
    const [t1, r1] = places[de % places.length];
    const [t2, r2] = places[vers % places.length];
    [sieges[t1][r1], sieges[t2][r2]] = [sieges[t2][r2], sieges[t1][r1]];
  }
  if (geste === 'deplacer' && places.length > 0) {
    const [table, rang] = places[de % places.length];
    const [personne] = sieges[table].splice(rang, 1);
    const cible = vers % (sieges.length + 1);
    (cible === sieges.length ? reserve : sieges[cible]).push(personne);
  }
  return variante;
}

const unePropositionEtSaRetouche = uneProposition.chain((proposition) =>
  fc
    .record({
      geste: fc.constantFrom('echanger', 'deplacer', 'attribution', 'graine'),
      tour: fc.nat(),
      de: fc.nat(),
      vers: fc.nat(),
    })
    .map((retouche) => [proposition, retoucher(proposition, retouche)]),
);

// Le vivier d'une paire : deux variantes de l'événement, des réglages, de
// chaque participant et de chaque table ; des réservations et des titres
// candidats ; trois propositions et leur retouche.
const unVivier = fc.record({
  evenements: deuxFois(unEvenement),
  reglages: deuxFois(desReglages),
  participants: fc.tuple(...IDS_PARTICIPANTS.map((id) => deuxFois(unParticipant(id)))),
  tables: fc.tuple(...IDS_TABLES.map((id) => deuxFois(uneTable(id)))),
  reservations: fc.array(uneReservation, { minLength: 6, maxLength: 6 }),
  titres: fc.array(unTitre, { minLength: 4, maxLength: 4 }),
  propositions: fc.array(unePropositionEtSaRetouche, { minLength: 3, maxLength: 3 }),
});

// Le retenu tiré d'une proposition : ses champs de plan, sous son id.
const retenuDe = ({ id, siegesAttribues, tables, capacites, tours, participants, placement }) =>
  copie({ proposition: id, siegesAttribues, tables, capacites, tours, participants, placement });

// Façons d'abîmer un retenu, chacune en place : sa règle le refuse, et
// l'analyse, qui n'en lit que le conteneur, l'admet ; examiner le garde en
// le signalant (§ 8.9, point 3).
const ABIMER_LE_RETENU = [
  ['« tours » renommé « toura »', (r) => {
    r.toura = r.tours;
    delete r.tours;
  }],
  ['un placement objet', (r) => { r.placement = {}; }],
  ['des capacités nombre', (r) => { r.capacites = 2; }],
  ['un tour devenu la liste de ses tables', (r) => { r.placement[0] = r.placement[0].sieges; }],
  ['une clé inconnue', (r) => { r.note = 'à revoir'; }],
  ['tours à 0', (r) => { r.tours = 0; }],
];

// Vrai quand la charge porte un retenu que sa règle refuse.
const porteUnRetenuAbime = (charge) =>
  charge.retenu !== null && fautes(charge.retenu).some(({ code }) => code === 'FORME');

// Charge tirée du vivier selon choisir(cle, rang) : 0 écarte un
// enregistrement, 1 et 2 en prennent la variante ; un booléen garde un
// candidat. Les réservations et les titres qui ne tiennent plus dans la
// charge s'écartent, comme la commande qui retire leur personne ou leur
// table : la charge reste un fichier que l'analyse admet. Une à trois
// propositions ; le retenu, null ou le plan d'une proposition, abîmé d'une
// des façons d'ABIMER_LE_RETENU quand abime en désigne une. Renversées, les
// collections arrivent hors de l'ordre canonique.
function construire(vivier, choisir) {
  const evenement = copie(vivier.evenements[choisir('evenement')]);
  const variantes = (cle) =>
    vivier[cle].flatMap((deux, rang) => (choisir(cle, rang) === 0 ? [] : [copie(deux[choisir(cle, rang) - 1])]));
  const participants = variantes('participants');
  const tables = variantes('tables');
  const capaciteDe = new Map(tables.map((t) => [t.id, t.sieges ?? evenement.siegesParDefaut]));
  const presents = new Set(participants.map((p) => p.id));
  const tient = (table, siege) => capaciteDe.has(table) && (siege === null || siege <= capaciteDe.get(table));
  const reservations = vivier.reservations
    .filter(
      (r, rang) =>
        choisir('reservations', rang) &&
        presents.has(r.participant) &&
        tient(r.table, r.siege) &&
        (r.tour === null || r.tour <= evenement.tours),
    )
    .map(copie);
  const titres = vivier.titres.filter((t, rang) => choisir('titres', rang) && tient(t.table, t.siege)).map(copie);
  const propositions = variantes('propositions');
  if (propositions.length === 0) propositions.push(copie(vivier.propositions[0][0]));
  const retenu = choisir('retenu') < 3 ? null : retenuDe(vivier.propositions[choisir('retenu') - 3][0]);
  if (retenu !== null && choisir('abime') !== null) ABIMER_LE_RETENU[choisir('abime')][1](retenu);
  const charge = {
    evenement,
    reglages: copie(vivier.reglages[choisir('reglages')]),
    prochainsIds: {
      participant: IDS_PARTICIPANTS.length + 1 + choisir('prochains'),
      table: IDS_TABLES.length + 1 + choisir('prochains'),
      proposition: ID_PROPOSITION_MAX + 1 + choisir('prochains'),
    },
    participants,
    tables,
    reservations,
    titres,
    propositions,
    retenu,
  };
  if (choisir('renverser')) {
    for (const cle of ['participants', 'tables', 'reservations', 'titres', 'propositions']) charge[cle].reverse();
  }
  return charge;
}

// Les choix de longueur éléments : pour chacun, un tirage pour a, un pour
// b, et un dé de 0 à 3.
const desChoix = (element, longueur) =>
  fc.array(fc.tuple(element, element, fc.integer({ min: 0, max: 3 })), { minLength: longueur, maxLength: longueur });

// Une paire de charges tirées d'un même vivier. b reprend le choix de a
// sauf quand le dé passe sous l'écart de la paire : l'écart 0 rend deux
// charges égales, 1 à 3 deux charges voisines, 4 deux charges aux choix
// indépendants.
const unePaire = fc
  .record({
    vivier: unVivier,
    ecart: fc.integer({ min: 0, max: 4 }),
    choix: fc.record({
      evenement: desChoix(fc.integer({ min: 0, max: 1 }), 1),
      reglages: desChoix(fc.integer({ min: 0, max: 1 }), 1),
      prochains: desChoix(fc.integer({ min: 0, max: 2 }), 1),
      participants: desChoix(fc.integer({ min: 0, max: 2 }), IDS_PARTICIPANTS.length),
      tables: desChoix(fc.integer({ min: 0, max: 2 }), IDS_TABLES.length),
      reservations: desChoix(fc.boolean(), 6),
      titres: desChoix(fc.boolean(), 4),
      propositions: desChoix(fc.integer({ min: 0, max: 2 }), 3),
      retenu: desChoix(fc.integer({ min: 0, max: 5 }), 1),
      renverser: desChoix(fc.boolean(), 1),
      abime: desChoix(ouNul(fc.integer({ min: 0, max: ABIMER_LE_RETENU.length - 1 })), 1),
    }),
  })
  .map(({ vivier, ecart, choix }) => ({
    a: construire(vivier, (cle, rang = 0) => choix[cle][rang][0]),
    b: construire(vivier, (cle, rang = 0) => {
      const [pourA, pourB, de] = choix[cle][rang];
      return de < ecart ? pourB : pourA;
    }),
  }));

// Vrai quand deux propositions de la charge partagent un identifiant.
const identifiantsRepetes = (charge) => new Set(charge.propositions.map((p) => p.id)).size < charge.propositions.length;
const derniere = ({ chemin }) => chemin[chemin.length - 1];

describe('difference et appliquer : aller-retour sur des paires tirées (§ 8.6)', () => {
  test(`${TIRAGES} paires : appliquer(a, difference(a, b)) s'écrit comme b, et ni a ni b ne changent`, () => {
    const bilan = {
      tirages: 0,
      vides: 0,
      retraits: 0,
      insertions: 0,
      communsCompares: 0,
      parRang: 0,
      listesEntieres: 0,
      identifiantsRepetes: 0,
      propositionsParRang: 0,
      retenuBascule: 0,
      retenuAbime: 0,
      retenuAbimePose: 0,
    };
    fc.assert(
      fc.property(unePaire, ({ a, b }) => {
        // Les deux charges tirées sont des fichiers que l'analyse admet.
        for (const charge of [a, b]) assert.equal(analyser(serialiser(charge, ENTETE)).formatPlusRecent, false);
        const [texteA, texteB] = [JSON.stringify(a), JSON.stringify(b)];
        geler(a);
        geler(b);
        const correctif = difference(a, b);
        const rendu = appliquer(a, correctif);
        assert.equal(serialiserCharge(rendu), serialiserCharge(b));
        // Le résultat est la copie canonique de b, ordre des clés compris.
        assert.equal(JSON.stringify(rendu), JSON.stringify(canoniser(b)));
        // Le journal porte le correctif en JSON : relu, il s'applique pareil.
        assert.equal(serialiserCharge(appliquer(a, JSON.parse(JSON.stringify(correctif)))), serialiserCharge(b));
        // Égales à l'ordre près, deux charges n'ont rien à corriger.
        assert.deepEqual(difference(b, canoniser(b)), []);
        assert.equal(JSON.stringify(a), texteA);
        assert.equal(JSON.stringify(b), texteB);

        bilan.tirages += 1;
        if (correctif.length === 0) bilan.vides += 1;
        if (correctif.some(({ op }) => op === 'retirer')) bilan.retraits += 1;
        if (correctif.some((o) => o.op === 'poser' && typeof derniere(o) === 'object')) bilan.insertions += 1;
        if (correctif.some(({ chemin }) => chemin.slice(0, -1).some((etape) => typeof etape === 'object'))) {
          bilan.communsCompares += 1;
        }
        if (correctif.some(({ chemin }) => chemin.some((etape) => typeof etape === 'number'))) bilan.parRang += 1;
        if (correctif.some((o) => o.op === 'poser' && Array.isArray(o.valeur))) bilan.listesEntieres += 1;
        if (identifiantsRepetes(a) || identifiantsRepetes(b)) bilan.identifiantsRepetes += 1;
        if (correctif.some(({ chemin }) => chemin[0] === 'propositions' && typeof chemin[1] === 'number')) {
          bilan.propositionsParRang += 1;
        }
        if ((a.retenu === null) !== (b.retenu === null)) bilan.retenuBascule += 1;
        if (porteUnRetenuAbime(a) || porteUnRetenuAbime(b)) {
          bilan.retenuAbime += 1;
          if (correctif.some(({ chemin }) => chemin.length === 1 && chemin[0] === 'retenu')) bilan.retenuAbimePose += 1;
        }
      }),
      { seed: GRAINE, numRuns: TIRAGES },
    );
    // Un générateur qui n'engendre pas les cas difficiles rend la propriété
    // vraie sans rien éprouver : chaque famille de cas a son plancher. Les
    // propositions comparées par rang, faute d'identifiants distincts de
    // part et d'autre et à longueur égale, sont les plus rares.
    assert.equal(bilan.tirages, TIRAGES);
    const planchers = [
      ['vides', 30],
      ['retraits', 30],
      ['insertions', 30],
      ['communsCompares', 30],
      ['parRang', 30],
      ['listesEntieres', 30],
      ['identifiantsRepetes', 30],
      ['propositionsParRang', 10],
      ['retenuBascule', 30],
      ['retenuAbime', 30],
      ['retenuAbimePose', 10],
    ];
    for (const [famille, plancher] of planchers) {
      assert.ok(bilan[famille] >= plancher, `${famille} : ${bilan[famille]} tirages sur ${TIRAGES}`);
    }
  });
});

describe('difference : localité sur la grande démonstration (§ 8.9)', () => {
  // Chemin des listes de table du tour 2 (rang 1) de la proposition id.
  const listesDuTour2 = (id) => ['propositions', { id }, 'placement', 1, 'sieges'];

  test("la charge d'épreuve se relit, et chaque tour de ses propositions place chaque participant une fois", () => {
    const charge = grande();
    assert.equal(analyser(serialiser(charge, ENTETE)).formatPlusRecent, false);
    const ids = charge.participants.map((p) => p.id);
    assert.equal(ids.length, 260);
    for (const proposition of charge.propositions) {
      for (const { sieges, reserve } of proposition.placement) {
        assert.deepEqual([...sieges.flat(), ...reserve].sort(croissant), ids);
        assert.deepEqual(
          sieges.map((liste) => liste.length),
          proposition.capacites,
        );
      }
    }
  });

  test("au tour 2 d'une proposition à sièges attribués, déplacer une personne vers une autre table, pleine, l'échange avec l'occupant : deux opérations, une entrée de chacune des deux listes, moins de 200 octets", () => {
    const avant = grande();
    const apres = copie(avant);
    const { sieges } = apres.propositions.find((p) => p.id === 7).placement[1];
    const [personne, occupant] = [sieges[4][2], sieges[30][6]];
    sieges[4][2] = occupant;
    sieges[30][6] = personne;
    const correctif = difference(avant, apres);
    assert.deepEqual(correctif, [
      { op: 'poser', chemin: [...listesDuTour2(7), 4, 2], valeur: occupant },
      { op: 'poser', chemin: [...listesDuTour2(7), 30, 6], valeur: personne },
    ]);
    const taille = octets(JSON.stringify(correctif));
    assert.ok(taille < 200, `${taille} octets`);
    assert.equal(serialiserCharge(appliquer(avant, correctif)), serialiserCharge(apres));
  });

  test("sans attribution des sièges, le même échange entre deux identifiants consécutifs laisse à chacun le rang de l'autre : deux opérations, moins de 200 octets", () => {
    const avant = grande();
    const apres = copie(avant);
    const { sieges } = apres.propositions.find((p) => p.id === 4).placement[1];
    const personne = sieges[4][2];
    const voisin = personne + 1;
    const tableDuVoisin = sieges.findIndex((liste) => liste.includes(voisin));
    const rangDuVoisin = sieges[tableDuVoisin].indexOf(voisin);
    assert.notEqual(tableDuVoisin, 4);
    sieges[4][2] = voisin;
    sieges[tableDuVoisin][rangDuVoisin] = personne;
    const correctif = difference(avant, apres);
    const attendu = [
      { op: 'poser', chemin: [...listesDuTour2(4), 4, 2], valeur: voisin },
      { op: 'poser', chemin: [...listesDuTour2(4), tableDuVoisin, rangDuVoisin], valeur: personne },
    ].sort((x, y) => x.chemin[5] - y.chemin[5]);
    assert.deepEqual(correctif, attendu);
    const taille = octets(JSON.stringify(correctif));
    assert.ok(taille < 200, `${taille} octets`);
  });

  test('sans attribution, un échange qui décale les rangs dans les listes triées ne touche que ces deux listes, une entrée par rang changé', () => {
    const avant = grande();
    const apres = copie(avant);
    const { sieges } = apres.propositions.find((p) => p.id === 4).placement[1];
    // La plus petite personne de la table de rang 4 contre la plus grande de
    // celle de rang 30 : chacune entre vers un bout de l'autre liste, et les
    // entrées qu'elle franchit se décalent d'un rang.
    const [premiere, seconde] = [sieges[4], sieges[30]];
    const [plusPetit, plusGrand] = [premiere[0], seconde[seconde.length - 1]];
    sieges[4] = [...premiere.slice(1), plusGrand].sort(croissant);
    sieges[30] = [plusPetit, ...seconde.slice(0, -1)].sort(croissant);
    const changes = (avantEchange, apresEchange) => avantEchange.filter((id, rang) => apresEchange[rang] !== id).length;
    const correctif = difference(avant, apres);
    assert.ok(correctif.length > 2, `${correctif.length} opérations`);
    assert.equal(correctif.length, changes(premiere, sieges[4]) + changes(seconde, sieges[30]));
    for (const { op, chemin } of correctif) {
      assert.equal(op, 'poser');
      assert.deepEqual(chemin.slice(0, 5), listesDuTour2(4));
      assert.ok(chemin.length === 7 && (chemin[5] === 4 || chemin[5] === 30), JSON.stringify(chemin));
    }
    assert.equal(serialiserCharge(appliquer(avant, correctif)), serialiserCharge(apres));
  });

  test('ajouter un participant donne une opération poser à { id }, et prochainsIds avance', () => {
    const avant = grande();
    const apres = copie(avant);
    const id = avant.prochainsIds.participant;
    const nouveau = {
      id,
      nom: 'Brindille',
      prenom: 'Azur',
      appartenance: 'Club Lanterne',
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    };
    apres.participants.push(nouveau);
    apres.prochainsIds.participant = id + 1;
    assert.deepEqual(difference(avant, apres), [
      { op: 'poser', chemin: ['prochainsIds', 'participant'], valeur: id + 1 },
      { op: 'poser', chemin: ['participants', { id }], valeur: nouveau },
    ]);
  });

  test('retirer un participant donne retirer à { id }, plus ses réservations ; les propositions le gardent (§ 8.9, dérive)', () => {
    const avant = grande();
    const sans = (id) => {
      const charge = copie(avant);
      charge.participants = charge.participants.filter((p) => p.id !== id);
      charge.reservations = charge.reservations.filter((r) => r.participant !== id);
      return charge;
    };
    const libre = sansReservation(avant);
    assert.deepEqual(difference(avant, sans(libre)), [{ op: 'retirer', chemin: ['participants', { id: libre }] }]);
    // Un animateur emporte sa réservation : la liste, plus courte, est posée
    // entière, dans l'ordre canonique, par personne.
    const animateur = avant.reservations[0].participant;
    const apres = sans(animateur);
    assert.deepEqual(difference(avant, apres), [
      { op: 'retirer', chemin: ['participants', { id: animateur }] },
      {
        op: 'poser',
        chemin: ['reservations'],
        valeur: [...apres.reservations].sort((x, y) => x.participant - y.participant),
      },
    ]);
  });

  test("revenir à l'instant d'avant un retrait remet la personne entre ses voisins : l'insertion par { id } garde l'ordre des identifiants", () => {
    const avec = grande();
    const id = sansReservation(avec, 100);
    const sans = copie(avec);
    sans.participants = sans.participants.filter((p) => p.id !== id);
    const correctif = difference(sans, avec);
    assert.deepEqual(correctif, [
      { op: 'poser', chemin: ['participants', { id }], valeur: avec.participants.find((p) => p.id === id) },
    ]);
    const rendu = appliquer(sans, correctif);
    assert.deepEqual(
      rendu.participants.map((p) => p.id),
      avec.participants.map((p) => p.id),
    );
    assert.equal(serialiserCharge(rendu), serialiserCharge(avec));
  });
});

describe('difference : les règles (§ 8.6)', () => {
  test("deux charges égales à l'ordre près donnent [] : ordre des clés, des collections, et des tables d'une proposition sans attribution", () => {
    const a = petite();
    const b = copie(a);
    const { id, nom, date, siegesParDefaut, tours, unite, etat, filiation } = a.evenement;
    b.evenement = { filiation, etat, unite, tours, siegesParDefaut, date, nom, id };
    b.participants.reverse();
    b.tables.reverse();
    b.propositions[0].participants.reverse();
    b.propositions[0].placement[1].sieges[0].reverse();
    assert.notEqual(JSON.stringify(b), JSON.stringify(a));
    assert.deepEqual(difference(a, b), []);
    assert.deepEqual(difference(a, a), []);
  });

  test("les objets se comparent clé par clé dans l'ordre du schéma, quel que soit l'ordre des retouches ; un scalaire différent est posé", () => {
    const a = petite();
    const b = copie(a);
    b.tables[2].position.x = 900;
    b.reglages.generation.arret = 50_000;
    b.reglages.attribuerSieges = true;
    b.evenement.date = '2031-05-17';
    b.evenement.nom = 'Petite soirée des Hérons';
    assert.deepEqual(difference(a, b), [
      { op: 'poser', chemin: ['evenement', 'nom'], valeur: 'Petite soirée des Hérons' },
      { op: 'poser', chemin: ['evenement', 'date'], valeur: '2031-05-17' },
      { op: 'poser', chemin: ['reglages', 'attribuerSieges'], valeur: true },
      { op: 'poser', chemin: ['reglages', 'generation', 'arret'], valeur: 50_000 },
      { op: 'poser', chemin: ['tables', { id: 3 }, 'position', 'x'], valeur: 900 },
    ]);
  });

  test('les listes à identifiant se comparent par identifiant croissant : retirés, posés entiers, communs comparés', () => {
    const a = chargeDe('petite', [
      { id: 1, siegesAttribues: false },
      { id: 4, siegesAttribues: false },
    ]);
    const b = copie(a);
    const nouvelle = { id: 5, numero: 5, sieges: 4, forme: 'carree', position: { x: 1000, y: 0 } };
    b.tables = [nouvelle, ...b.tables.filter((t) => t.id !== 2)];
    b.tables.find((t) => t.id === 3).numero = 7;
    b.prochainsIds.table = 6;
    const troisieme = { ...copie(a.propositions[0]), id: 3, graine: 11 };
    b.propositions = [troisieme, { ...b.propositions[0], graine: 12 }];
    assert.deepEqual(difference(a, b), [
      { op: 'poser', chemin: ['prochainsIds', 'table'], valeur: 6 },
      { op: 'retirer', chemin: ['tables', { id: 2 }] },
      { op: 'poser', chemin: ['tables', { id: 3 }, 'numero'], valeur: 7 },
      { op: 'poser', chemin: ['tables', { id: 5 }], valeur: nouvelle },
      { op: 'poser', chemin: ['propositions', { id: 1 }, 'graine'], valeur: 12 },
      { op: 'poser', chemin: ['propositions', { id: 3 }], valeur: troisieme },
      { op: 'retirer', chemin: ['propositions', { id: 4 }] },
    ]);
    const rendu = appliquer(a, difference(a, b));
    assert.deepEqual(
      rendu.tables.map((t) => t.id),
      [1, 3, 4, 5],
    );
    assert.deepEqual(
      rendu.propositions.map((p) => p.id),
      [1, 3],
    );
  });

  test("d'une charge neuve, le premier participant, la première table et la première proposition se posent par { id } ; le dernier participant et la dernière proposition se retirent par { id } ; chaque correctif rend sa cible", () => {
    const c0 = creerCharge({ id: 'evt-sonde', nom: 'Soirée sonde', siegesParDefaut: 4, tours: 2 });
    const personne = {
      id: 1,
      nom: 'Brindille',
      prenom: 'Azur',
      appartenance: null,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    };
    const tableNeuve = { id: 1, numero: 1, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } };
    const proposition = {
      id: 1,
      graine: 7,
      arret: 20_000,
      historique: 1_000,
      produitVersion: ENTETE.produitVersion,
      siegesAttribues: false,
      tables: [1],
      capacites: [4],
      tours: 2,
      participants: [1],
      placement: [
        { sieges: [[1]], reserve: [] },
        { sieges: [[1]], reserve: [] },
      ],
    };
    const suivante = (charge, modifier) => {
      const nouvelle = copie(charge);
      modifier(nouvelle);
      return nouvelle;
    };
    const c1 = suivante(c0, (c) => {
      c.participants.push(personne);
      c.prochainsIds.participant = 2;
    });
    const c2 = suivante(c1, (c) => {
      c.tables.push(tableNeuve);
      c.prochainsIds.table = 2;
    });
    const c3 = suivante(c2, (c) => {
      c.propositions.push(proposition);
      c.prochainsIds.proposition = 2;
    });
    const c4 = suivante(c3, (c) => {
      c.participants = [];
    });
    const c5 = suivante(c4, (c) => {
      c.propositions = [];
    });
    const etapes = [
      [c0, c1, [
        { op: 'poser', chemin: ['prochainsIds', 'participant'], valeur: 2 },
        { op: 'poser', chemin: ['participants', { id: 1 }], valeur: personne },
      ]],
      [c1, c2, [
        { op: 'poser', chemin: ['prochainsIds', 'table'], valeur: 2 },
        { op: 'poser', chemin: ['tables', { id: 1 }], valeur: tableNeuve },
      ]],
      [c2, c3, [
        { op: 'poser', chemin: ['prochainsIds', 'proposition'], valeur: 2 },
        { op: 'poser', chemin: ['propositions', { id: 1 }], valeur: proposition },
      ]],
      [c3, c4, [{ op: 'retirer', chemin: ['participants', { id: 1 }] }]],
      [c4, c5, [{ op: 'retirer', chemin: ['propositions', { id: 1 }] }]],
    ];
    for (const [avant, apres, attendu] of etapes) {
      // Chaque charge est un fichier que l'analyse admet.
      assert.equal(analyser(serialiser(apres, ENTETE)).formatPlusRecent, false);
      assert.deepEqual(difference(avant, apres), attendu);
      assert.equal(serialiserCharge(appliquer(avant, attendu)), serialiserCharge(apres));
    }
  });

  test('les autres listes : de même longueur, rang par rang ; de longueurs différentes, posées entières', () => {
    const a = petite();
    a.reservations = [
      { participant: 2, table: 1, siege: 1, portee: 'tous', tour: null },
      { participant: 5, table: 2, siege: null, portee: 'tour', tour: 3 },
    ];
    a.titres = [{ table: 1, siege: 1, libelle: 'animation' }];
    const b = copie(a);
    b.reservations[1].siege = 2;
    b.titres.push({ table: 2, siege: 3, libelle: 'accueil' });
    // Au tour 1, la première personne de la table de rang 0 passe à la réserve.
    const tour1 = b.propositions[0].placement[0];
    const [personne, ...restants] = tour1.sieges[0];
    tour1.sieges[0] = restants;
    tour1.reserve = [personne];
    assert.deepEqual(difference(a, b), [
      { op: 'poser', chemin: ['reservations', 1, 'siege'], valeur: 2 },
      {
        op: 'poser',
        chemin: ['titres'],
        valeur: [
          { table: 1, siege: 1, libelle: 'animation' },
          { table: 2, siege: 3, libelle: 'accueil' },
        ],
      },
      { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', 0, 'sieges', 0], valeur: restants },
      { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', 0, 'reserve'], valeur: [personne] },
    ]);
  });

  test('null contre une valeur : la valeur posée entière, et null posé au retour ; deux valeurs non nulles se comparent', () => {
    const a = petite();
    const b = copie(a);
    b.retenu = retenuDe(a.propositions[0]);
    b.evenement.filiation = {
      source: { id: 'evt-source', nom: 'Soirée source' },
      instant: { revision: 12, libelle: 'Ajouté Azur Brindille' },
    };
    assert.deepEqual(difference(a, b), [
      { op: 'poser', chemin: ['evenement', 'filiation'], valeur: b.evenement.filiation },
      { op: 'poser', chemin: ['retenu'], valeur: b.retenu },
    ]);
    assert.deepEqual(difference(b, a), [
      { op: 'poser', chemin: ['evenement', 'filiation'], valeur: null },
      { op: 'poser', chemin: ['retenu'], valeur: null },
    ]);
    const c = copie(b);
    c.retenu.capacites[2] = 4;
    c.evenement.filiation.instant.revision = 13;
    assert.deepEqual(difference(b, c), [
      { op: 'poser', chemin: ['evenement', 'filiation', 'instant', 'revision'], valeur: 13 },
      { op: 'poser', chemin: ['retenu', 'capacites', 2], valeur: 4 },
    ]);
  });

  test("un retenu hors de sa règle, que l'analyse admet et qu'examiner garde : le fichier relu s'écrit et se rend par appliquer(·, []) ; difference le pose entier quand il change — libéré, remis, remplacé, abîmé autrement — et ne produit rien pour lui quand seule la saisie change (§ 8.9, point 3)", () => {
    // Le fichier de la petite démonstration, son retenu abîmé à la main,
    // relu puis examiné : la charge qu'ouvre le dépôt.
    const base = petite();
    base.retenu = retenuDe(base.propositions[0]);
    base.evenement.etat = 'retenu';
    const ouvrir = (abimer) => {
      const ecrit = JSON.parse(serialiser(base, ENTETE));
      abimer(ecrit.charge.retenu);
      return examiner(analyser(JSON.stringify(ecrit)).charge);
    };
    const pose = (valeur) => [{ op: 'poser', chemin: ['retenu'], valeur }];
    // Le correctif de a vers b est attendu, et il rend b, relu par JSON.
    const verifier = (a, b, attendu) => {
      const correctif = difference(a, b);
      assert.deepEqual(correctif, attendu);
      assert.equal(serialiserCharge(appliquer(a, JSON.parse(JSON.stringify(correctif)))), serialiserCharge(b));
    };
    assert.ok(ABIMER_LE_RETENU.length > 1, 'moins de deux façons examinées');
    const ecarts = ABIMER_LE_RETENU.flatMap(([libelle, abimer], rang) => {
      try {
        const examen = ouvrir(abimer);
        assert.equal(examen.retenu.fautes[0].code, 'FORME');
        const ouverte = examen.charge;
        const texte = serialiser(ouverte, ENTETE);
        assert.deepEqual(analyser(texte).charge.retenu, ouverte.retenu);
        assert.equal(serialiserCharge(appliquer(ouverte, [])), serialiserCharge(ouverte));
        const liberee = { ...ouverte, retenu: null };
        verifier(ouverte, liberee, pose(null));
        verifier(liberee, ouverte, pose(canoniser(ouverte).retenu));
        const renommee = copie(ouverte);
        renommee.participants[0].nom = 'Brindille';
        verifier(ouverte, renommee, [{ op: 'poser', chemin: ['participants', { id: 1 }, 'nom'], valeur: 'Brindille' }]);
        verifier(ouverte, base, pose(canoniser(base).retenu));
        verifier(base, ouverte, pose(canoniser(ouverte).retenu));
        const autre = ouvrir(ABIMER_LE_RETENU[(rang + 1) % ABIMER_LE_RETENU.length][1]).charge;
        verifier(ouverte, autre, pose(canoniser(autre).retenu));
        return [];
      } catch (erreur) {
        return [`${libelle} : ${erreur.name} ${erreur.message.split('\n')[0]}`];
      }
    });
    assert.deepEqual(ecarts, []);
  });

  test("deux propositions de même identifiant : la liste se compare par rang dans l'ordre canonique, ou se pose entière", () => {
    const a = petite();
    a.propositions.push({ ...copie(a.propositions[0]), graine: 7 });
    const b = copie(a);
    b.propositions.find((p) => p.graine !== 7).arret = 50_000;
    // L'ordre canonique range la graine 7 avant l'autre, au rang 0.
    assert.deepEqual(difference(a, b), [{ op: 'poser', chemin: ['propositions', 1, 'arret'], valeur: 50_000 }]);
    assert.equal(serialiserCharge(appliquer(a, difference(a, b))), serialiserCharge(b));
    const c = copie(a);
    c.propositions = c.propositions.filter((p) => p.graine === 7);
    assert.deepEqual(difference(a, c), [{ op: 'poser', chemin: ['propositions'], valeur: c.propositions }]);
    assert.equal(serialiserCharge(appliquer(a, difference(a, c))), serialiserCharge(c));
  });

  test("le drapeau de la proposition décide : sans attribution, l'ordre dans une table ne porte rien ; avec, il est celui des sièges", () => {
    const a = chargeDe('petite', [
      { id: 1, siegesAttribues: false },
      { id: 2, siegesAttribues: true },
    ]);
    const b = copie(a);
    for (const proposition of b.propositions) proposition.placement[0].sieges[0].reverse();
    const [premier, , dernier] = a.propositions[1].placement[0].sieges[0];
    assert.deepEqual(difference(a, b), [
      { op: 'poser', chemin: ['propositions', { id: 2 }, 'placement', 0, 'sieges', 0, 0], valeur: dernier },
      { op: 'poser', chemin: ['propositions', { id: 2 }, 'placement', 0, 'sieges', 0, 2], valeur: premier },
    ]);
  });
});

describe('appliquer : une copie canonique, sans partage (§ 8.6)', () => {
  test('ni a ni le correctif ne changent, et le résultat ne partage aucun objet avec eux', () => {
    const a = geler(grande());
    const b = copie(a);
    // Une opération de chaque sorte : retrait et insertion par { id }, objet
    // et liste posés entiers, scalaires posés.
    b.participants.shift();
    b.tables.push({ id: b.prochainsIds.table, numero: 34, sieges: null, forme: 'carree', position: { x: 0, y: 1500 } });
    b.prochainsIds.table += 1;
    b.tables[0].position.y = 75;
    b.propositions.find((p) => p.id === 7).placement[3].sieges[0].reverse();
    const tour1 = b.propositions.find((p) => p.id === 9).placement[0];
    tour1.reserve = [tour1.sieges[0].pop()];
    b.retenu = retenuDe(b.propositions[0]);
    const correctif = geler(difference(a, b));
    // Sorte d'une opération : son op, la sorte de sa dernière étape, celle
    // de sa valeur.
    const sorte = (operation) => `${operation.op} ${typeof operation.chemin.at(-1)} ${typeof operation.valeur}`;
    assert.deepEqual([...new Set(correctif.map(sorte))].sort(), [
      'poser number number',
      'poser number object',
      'poser object object',
      'poser string number',
      'poser string object',
      'retirer object undefined',
    ]);
    const rendu = appliquer(a, correctif);
    assert.equal(serialiserCharge(rendu), serialiserCharge(b));
    const ailleurs = new Set([...objetsDe(a), ...objetsDe(correctif)]);
    const partages = [...objetsDe(rendu)].filter((objet) => ailleurs.has(objet));
    assert.equal(partages.length, 0);
  });

  test('un correctif vide rend la copie canonique de a, et non a', () => {
    const a = petite();
    a.participants.reverse();
    a.propositions[0].placement[0].sieges[0].reverse();
    const rendu = appliquer(a, []);
    assert.notEqual(rendu, a);
    assert.equal(JSON.stringify(rendu), JSON.stringify(canoniser(a)));
  });
});

describe("appliquer : un correctif qui ne s'applique pas lève CORRECTIF avec le rang de l'opération (§ 8.6)", () => {
  test("appliqué à une autre charge que la sienne, le correctif est refusé à la première opération qui n'y trouve pas sa place", () => {
    const a = grande();
    const b = copie(a);
    const absent = sansReservation(a);
    b.evenement.nom = 'Grande soirée des Hérons';
    b.reglages.attribuerSieges = true;
    b.participants = b.participants.filter((p) => p.id !== absent);
    const correctif = difference(a, b);
    assert.deepEqual(
      correctif.map(({ op }) => op),
      ['poser', 'poser', 'retirer'],
    );
    // Rejoué sur la charge qu'il a produite : les deux poses trouvent leur
    // place, le retrait ne trouve plus la personne.
    assert.deepEqual(refusDe(geler(b), correctif), { rang: 2 });
    // Sur la petite démonstration, la proposition 7 n'existe pas.
    const echange = copie(a);
    const { sieges } = echange.propositions.find((p) => p.id === 7).placement[1];
    [sieges[0][0], sieges[1][0]] = [sieges[1][0], sieges[0][0]];
    assert.deepEqual(refusDe(geler(petite()), difference(a, echange)), { rang: 0 });
  });

  test('chaque opération qui ne désigne pas une place de la charge est refusée à son rang, et la charge reste intacte', () => {
    const base = petite();
    const troisieme = copie(base.participants[2]);
    // La petite démonstration, et la même avec deux propositions d'id 1.
    const jumelles = petite();
    jumelles.propositions.push({ ...copie(jumelles.propositions[0]), graine: 7 });
    // Chaque cas suit, au rang 0, une pose qu'appliquer admet : POSE, ou
    // celle que le cas nomme après son opération.
    const POSE = { op: 'poser', chemin: ['evenement', 'nom'], valeur: 'Soirée renommée' };
    const cas = [
      ['retirer un identifiant absent', base, { op: 'retirer', chemin: ['participants', { id: 99 }] }],
      [
        'poser par { id } un identifiant présent',
        base,
        { op: 'poser', chemin: ['participants', { id: 3 }], valeur: troisieme },
      ],
      [
        "poser par { id } l'enregistrement d'un autre identifiant",
        base,
        { op: 'poser', chemin: ['participants', { id: 13 }], valeur: { ...troisieme, id: 14 } },
      ],
      [
        "poser par { id } autre chose qu'un enregistrement",
        base,
        { op: 'poser', chemin: ['participants', { id: 13 }], valeur: 13 },
      ],
      ['poser par { id } la valeur null', base, { op: 'poser', chemin: ['participants', { id: 13 }], valeur: null }],
      [
        'poser par un { id } qui est un texte',
        base,
        { op: 'poser', chemin: ['participants', { id: '13' }], valeur: { ...troisieme, id: '13' } },
      ],
      [
        "poser par { id } dans une liste d'entiers",
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'participants', { id: 13 }], valeur: { id: 13 } },
      ],
      [
        "poser par { id } dans une liste d'objets sans identifiant",
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', { id: 1 }], valeur: { id: 1 } },
      ],
      [
        'poser par { id } dans une réserve vide',
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', 0, 'reserve', { id: 3 }], valeur: { id: 3 } },
      ],
      [
        'poser par { id } dans des réservations vides',
        base,
        { op: 'poser', chemin: ['reservations', { id: 1 }], valeur: { id: 1 } },
      ],
      [
        "poser au-delà de la fin d'une liste",
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', 0, 'sieges', 0, 3], valeur: 4 },
      ],
      ['poser dans une valeur nulle', base, { op: 'poser', chemin: ['retenu', 'tours'], valeur: 2 }],
      [
        'traverser une valeur nulle',
        base,
        { op: 'poser', chemin: ['evenement', 'filiation', 'source', 'id'], valeur: 'evt-source' },
      ],
      ['poser à une clé absente', base, { op: 'poser', chemin: ['evenement', 'lieu'], valeur: 'Salle des fêtes' }],
      ['descendre par une clé absente', base, { op: 'poser', chemin: ['evenement', 'lieu', 'nom'], valeur: 'x' }],
      // Une clé héritée du prototype commun des objets n'est pas une clé de
      // la charge : l'admettre écrirait dans ce prototype, pour tout le
      // processus.
      ['descendre par __proto__', base, { op: 'poser', chemin: ['evenement', '__proto__', 'toString'], valeur: 1 }],
      ['poser à une clé héritée', base, { op: 'poser', chemin: ['evenement', 'constructor'], valeur: 1 }],
      ['poser à __proto__ de la charge', base, { op: 'poser', chemin: ['__proto__'], valeur: {} }],
      ['un rang dans un objet', base, { op: 'poser', chemin: ['evenement', 0], valeur: 'x' }],
      ['un rang dans une chaîne', base, { op: 'poser', chemin: ['evenement', 'nom', 0], valeur: 'x' }],
      ['une clé dans une liste', base, { op: 'poser', chemin: ['participants', 'length'], valeur: 0 }],
      ['une clé dans une chaîne', base, { op: 'poser', chemin: ['evenement', 'nom', 'length'], valeur: 1 }],
      ['un { id } dans un objet', base, { op: 'poser', chemin: ['evenement', { id: 1 }], valeur: { id: 1 } }],
      [
        'descendre par un { id } dans un objet',
        base,
        { op: 'poser', chemin: ['evenement', { id: 1 }, 'nom'], valeur: 'x' },
      ],
      [
        "un { id } dans une liste d'objets sans identifiant",
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', { id: 1 }, 'reserve'], valeur: [] },
      ],
      [
        "un { id } dans une liste d'entiers",
        base,
        { op: 'retirer', chemin: ['propositions', { id: 1 }, 'participants', { id: 3 }] },
      ],
      [
        'un { id } que portent deux enregistrements',
        jumelles,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'arret'], valeur: 5 },
      ],
      [
        'retirer un { id } que portent deux enregistrements',
        jumelles,
        { op: 'retirer', chemin: ['propositions', { id: 1 }] },
      ],
      ['retirer une clé', base, { op: 'retirer', chemin: ['evenement', 'date'] }],
      ['retirer un rang', base, { op: 'retirer', chemin: ['participants', 0] }],
      ['une opération inconnue', base, { op: 'deplacer', chemin: ['evenement', 'nom'], valeur: 'x' }],
      ['un chemin vide', base, { op: 'poser', chemin: [], valeur: {} }],
      ['un chemin qui est un texte', base, { op: 'poser', chemin: 'evenement.nom', valeur: 'x' }],
      ['un chemin qui est un objet', base, { op: 'poser', chemin: { evenement: 'nom' }, valeur: 'x' }],
      ['poser sans valeur', base, { op: 'poser', chemin: ['evenement', 'nom'] }],
      ['une opération nulle', base, null],
      ['une opération qui est un texte', base, 'poser'],
      ['une opération qui est une liste', base, ['poser', ['evenement', 'nom'], 'x']],
      ['un rang négatif', base, { op: 'poser', chemin: ['participants', -1], valeur: troisieme }],
      ['un rang non entier', base, { op: 'poser', chemin: ['participants', 0.5], valeur: troisieme }],
      ['descendre par un rang négatif', base, { op: 'poser', chemin: ['participants', -1, 'nom'], valeur: 'x' }],
      ['une étape booléenne', base, { op: 'poser', chemin: ['participants', true], valeur: troisieme }],
      ['une étape nulle', base, { op: 'poser', chemin: [null], valeur: 'x' }],
      ['une étape qui est une liste', base, { op: 'retirer', chemin: ['participants', [3]] }],
      ['un { id } qui est un texte', base, { op: 'retirer', chemin: ['participants', { id: '3' }] }],
      ['une étape objet sans id', base, { op: 'retirer', chemin: ['participants', {}] }],
      // Une valeur posée est une valeur que l'analyse admet à sa place : hors
      // des propositions et du retenu, sa forme entière ; à leur place, leur
      // conteneur. Un cas par genre de règle.
      ["poser un nombre à la place d'un objet", base, { op: 'poser', chemin: ['evenement'], valeur: 5 }],
      ['poser un objet sans les clés de sa règle', base, { op: 'poser', chemin: ['evenement'], valeur: {} }],
      [
        'poser un objet à clé inconnue',
        base,
        { op: 'poser', chemin: ['reglages', 'generation'], valeur: { nombre: 5, arret: 200_000, historique: 1_000, x: 1 } },
      ],
      ["poser un objet à la place d'une liste", base, { op: 'poser', chemin: ['tables'], valeur: {} }],
      ['poser une chaîne vide', base, { op: 'poser', chemin: ['evenement', 'nom'], valeur: '' }],
      [
        "poser un nombre à la place d'une chaîne",
        base,
        { op: 'poser', chemin: ['participants', { id: 3 }, 'prenom'], valeur: 5 },
      ],
      ['poser un entier sous son minimum', base, { op: 'poser', chemin: ['evenement', 'siegesParDefaut'], valeur: 1 }],
      ["poser un entier qui n'en est pas un", base, { op: 'poser', chemin: ['evenement', 'tours'], valeur: 1.5 }],
      [
        'poser un entier au-delà des entiers exacts',
        base,
        { op: 'poser', chemin: ['prochainsIds', 'participant'], valeur: 2 ** 53 },
      ],
      ['poser un nombre infini', base, { op: 'poser', chemin: ['tables', { id: 2 }, 'position', 'x'], valeur: Infinity }],
      ["poser un texte à la place d'un nombre", base, { op: 'poser', chemin: ['tables', { id: 2 }, 'position', 'y'], valeur: '0' }],
      ["poser un texte à la place d'un booléen", base, { op: 'poser', chemin: ['reglages', 'attribuerSieges'], valeur: 'non' }],
      ['poser une valeur hors de celles que la règle énumère', base, { op: 'poser', chemin: ['evenement', 'etat'], valeur: 'archive' }],
      ['poser une date hors du calendrier', base, { op: 'poser', chemin: ['evenement', 'date'], valeur: '2026-02-30' }],
      ["poser null là où la règle ne l'admet pas", base, { op: 'poser', chemin: ['evenement', 'nom'], valeur: null }],
      [
        'poser par { id } un participant de forme fausse',
        base,
        { op: 'poser', chemin: ['participants', { id: 13 }], valeur: { ...troisieme, id: 13, nom: '' } },
      ],
      ['poser un objet à la place des propositions', base, { op: 'poser', chemin: ['propositions'], valeur: {} }],
      ['poser un nombre à la place du retenu', base, { op: 'poser', chemin: ['retenu'], valeur: 5 }],
      ['poser une liste à la place du retenu', base, { op: 'poser', chemin: ['retenu'], valeur: [] }],
      // L'analyse n'entre ni dans les propositions ni dans le retenu : une
      // valeur posée plus bas ne s'examine pas, et peut donner à une liste
      // une forme qui n'est pas la sienne. { id } n'y vaut toujours que dans
      // une liste d'enregistrements du schéma, et sur des enregistrements.
      [
        "descendre par { id } dans un placement qu'une pose a doté d'identifiants",
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', { id: 1 }, 'reserve'], valeur: [] },
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement'], valeur: [{ id: 1, sieges: [], reserve: [] }] },
      ],
      [
        "poser par { id } dans une liste vide qu'une pose a ajoutée sous une clé hors du schéma",
        base,
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', 0, 'x', { id: 1 }], valeur: { id: 1 } },
        { op: 'poser', chemin: ['propositions', { id: 1 }, 'placement', 0], valeur: { sieges: [], reserve: [], x: [] } },
      ],
      [
        "poser par { id } dans des propositions qu'une pose a faites liste d'entiers",
        base,
        { op: 'poser', chemin: ['propositions', { id: 13 }], valeur: { ...base.propositions[0], id: 13 } },
        { op: 'poser', chemin: ['propositions'], valeur: [12] },
      ],
      ['poser par { id } la valeur null dans les propositions', base, { op: 'poser', chemin: ['propositions', { id: 13 }], valeur: null }],
    ];
    const texteBase = JSON.stringify(base);
    geler(base);
    geler(jumelles);
    const ecarts = cas.flatMap(([libelle, charge, operation, prealable = POSE]) => {
      const refus = refusDe(charge, geler([prealable, operation]));
      return JSON.stringify(refus) === JSON.stringify({ rang: 1 }) ? [] : [`${libelle} : ${JSON.stringify(refus)}`];
    });
    assert.deepEqual(ecarts, []);
    assert.equal(JSON.stringify(base), texteBase);
  });

  test("une insertion par { id } ne vaut que dans les participants, les tables et les propositions : toute autre liste de la charge la refuse, vide ou non", () => {
    // La petite démonstration, avec une réservation, un titre et un retenu :
    // chaque liste du schéma y figure, à chaque profondeur.
    const charge = petite();
    charge.reservations = [{ participant: 2, table: 1, siege: null, portee: 'tous', tour: null }];
    charge.titres = [{ table: 1, siege: 1, libelle: 'animation' }];
    charge.retenu = retenuDe(charge.propositions[0]);
    const canonique = canoniser(charge);
    const listes = cheminsDesListes(canonique);
    // Le relevé descend jusqu'aux réserves et aux listes de table, retenu
    // compris : il n'est pas vide (§ 14.2).
    const profondes = [
      ['titres'],
      ['propositions', 0, 'placement', 3, 'reserve'],
      ['retenu', 'placement', 0, 'sieges', 3],
    ];
    for (const attendue of profondes) {
      assert.ok(listes.some((chemin) => JSON.stringify(chemin) === JSON.stringify(attendue)), JSON.stringify(attendue));
    }
    // L'enregistrement 99 de chaque liste d'enregistrements, de la forme de
    // ses voisins ; ailleurs, l'objet { id: 99 }.
    const ENREGISTREMENTS = new Map(
      ['participants', 'tables', 'propositions'].map((cle) => [cle, { ...canonique[cle][0], id: 99 }]),
    );
    const ecarts = listes.flatMap((chemin) =>
      ['telle quelle', 'vidée'].flatMap((etat) => {
        const variante = copie(canonique);
        if (etat === 'vidée') chemin.reduce((valeur, etape) => valeur[etape], variante).length = 0;
        const enregistrement = chemin.length === 1 && ENREGISTREMENTS.has(chemin[0]);
        const valeur = enregistrement ? ENREGISTREMENTS.get(chemin[0]) : { id: 99 };
        const insertion = { op: 'poser', chemin: [...chemin, { id: 99 }], valeur };
        const attendu = enregistrement ? 'aucun refus' : { rang: 0 };
        const refus = JSON.stringify(refusDe(geler(variante), [insertion]));
        return refus === JSON.stringify(attendu) ? [] : [`${JSON.stringify(chemin)} ${etat} : ${refus}`];
      }),
    );
    assert.deepEqual(ecarts, []);
  });

  test("une valeur posée passe la forme que l'analyse donne à sa place : hors des propositions et du retenu, à chaque place, une valeur d'une autre sorte est refusée et la sienne admise ; plus bas, aucune ne s'examine", () => {
    // La petite démonstration, avec une date, une filiation, une
    // réservation, un titre et un retenu : chaque règle du schéma y a une
    // valeur à éprouver.
    const charge = petite();
    charge.evenement.date = '2031-05-17';
    charge.evenement.filiation = {
      source: { id: 'evt-source', nom: 'Soirée source' },
      instant: { revision: 3, libelle: 'Création' },
    };
    charge.reservations = [{ participant: 2, table: 1, siege: 1, portee: 'tour', tour: 2 }];
    charge.titres = [{ table: 1, siege: 1, libelle: 'animation' }];
    charge.retenu = retenuDe(charge.propositions[0]);
    const canonique = geler(canoniser(charge));
    const valeurs = valeursDe(canonique);
    // Le relevé descend jusqu'aux feuilles, celles du retenu comprises : il
    // n'est pas vide (§ 14.2).
    const profonds = [
      ['evenement', 'filiation', 'instant', 'libelle'],
      ['reservations', 0, 'tour'],
      ['retenu', 'placement', 1, 'sieges', 2, 0],
    ];
    for (const attendu of profonds) {
      assert.ok(valeurs.some(({ chemin }) => JSON.stringify(chemin) === JSON.stringify(attendu)), JSON.stringify(attendu));
    }
    // Un retenu que l'analyse admet et que le contrôle des placements juge
    // fautif se pose à sa place comme elle le lit : une entrée de journal
    // qui le remet en place se rejoue.
    const retenuFautif = { ...retenuDe(charge.propositions[0]), tours: 0 };
    assert.equal(refusDe(canonique, [{ op: 'poser', chemin: ['retenu'], valeur: retenuFautif }]), 'aucun refus');
    const sousAPart = (chemin) => chemin.length > 1 && (chemin[0] === 'propositions' || chemin[0] === 'retenu');
    const ecarts = valeurs.flatMap(({ chemin, valeur }) => {
      const autre = Array.isArray(valeur) ? {} : [];
      return [
        ['sa valeur', valeur, 'aucun refus'],
        ["une valeur d'une autre sorte", autre, sousAPart(chemin) ? 'aucun refus' : { rang: 0 }],
      ].flatMap(([cas, posee, attendu]) => {
        const refus = JSON.stringify(refusDe(canonique, [{ op: 'poser', chemin, valeur: posee }]));
        return refus === JSON.stringify(attendu) ? [] : [`${JSON.stringify(chemin)}, ${cas} : ${refus}`];
      });
    });
    assert.deepEqual(ecarts, []);
  });

  test("les opérations s'appliquent dans l'ordre : celle qu'une précédente rend caduque est refusée à son rang", () => {
    const charge = geler(petite());
    const retrait = { op: 'retirer', chemin: ['participants', { id: 3 }] };
    assert.deepEqual(
      refusDe(charge, [retrait, { op: 'poser', chemin: ['participants', { id: 3 }, 'nom'], valeur: 'Brindille' }]),
      { rang: 1 },
    );
    assert.deepEqual(refusDe(charge, [retrait, retrait]), { rang: 1 });
    // Retirer puis reposer le même identifiant s'applique, à la même place.
    const remplacant = { ...copie(charge.participants[2]), nom: 'Brindille' };
    const repose = { op: 'poser', chemin: ['participants', { id: 3 }], valeur: remplacant };
    const rendu = appliquer(charge, [retrait, repose]);
    assert.deepEqual(rendu.participants[2], remplacant);
  });

  test("un correctif qui n'est pas une liste d'opérations lève TypeError, ensemble d'opérations compris", () => {
    const operation = { op: 'poser', chemin: ['evenement', 'nom'], valeur: 'x' };
    for (const correctif of [null, undefined, operation, 'poser', new Set([operation])]) {
      assert.throws(() => appliquer(petite(), correctif), TypeError);
    }
  });
});
