// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le balayage de la typographie de l'écran (§ 14.6). Chaque clé des tables
// de l'application et des écrans, rendue par le t de l'écran — la traduction
// créée avec ecran: true, celle qu'App pose au contexte —, ne laisse aucune
// espace ordinaire devant ; : ? ! » ni après «, ni entre un nombre et son
// unité, après « n° » ou entre le jour et le mois. Les détails d'une clé
// viennent des exemples de test/libelles/ (EXEMPLES et TEXTES), de
// EXEMPLES_ECRAN pour les clés qui lisent des détails typés — un nombre, une
// liste, une clé —, et sinon d'un objet générique, qui rend « ⟨nom⟩ » pour
// chaque détail lu. Chaque clé se rend au moins une fois : une clé qui lève
// sous l'objet générique demande son exemple ici. Le balayage échoue s'il
// est vide (§ 14.2).
//
// En regard, libelle() — le journal, le motif du CSV des refus, le PDF —
// reste brut : aucune de ses sorties ne porte U+00A0, et chacune est le
// texte du t brut. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import * as exemplesCsv from '../../test/libelles/csv.js';
import * as exemplesEvenements from '../../test/libelles/evenements.js';
import * as exemplesFormat from '../../test/libelles/format.js';
import * as exemplesGeneration from '../../test/libelles/generation.js';
import * as exemplesMobilier from '../../test/libelles/mobilier.js';
import * as exemplesMoteur from '../../test/libelles/moteur.js';
import * as exemplesParticipants from '../../test/libelles/participants.js';
import * as exemplesPlaces from '../../test/libelles/places.js';
import * as exemplesPlanche from '../../test/libelles/planche.js';
import * as exemplesSeance from '../../test/libelles/seance.js';
import * as exemplesSorties from '../../test/libelles/sorties.js';
import * as exemplesStockage from '../../test/libelles/stockage.js';
import { TABLES_APPLICATION, libelle } from '../application/libelles.js';
import { creerTraduction } from '../application/traduction.js';
import { typographier } from '../application/typographie.js';
import { TABLES_INTERFACE } from './libelles.js';

const TABLES = [...TABLES_APPLICATION, ...TABLES_INTERFACE];
const ecran = creerTraduction(TABLES, { ecran: true });
const brut = creerTraduction(TABLES);
const CLES_APPLICATION = new Set(creerTraduction(TABLES_APPLICATION).cles());

const MODULES_EXEMPLES = [
  exemplesCsv,
  exemplesEvenements,
  exemplesFormat,
  exemplesGeneration,
  exemplesMobilier,
  exemplesMoteur,
  exemplesParticipants,
  exemplesPlaces,
  exemplesPlanche,
  exemplesSeance,
  exemplesSorties,
  exemplesStockage,
];

// Les clés dont le texte lit un détail typé, et des détails qui le
// composent : un nombre que creerFormat met en forme, une liste de tours,
// une clé composée, un critère du registre. Une clé peut y paraître deux
// fois, pour deux branches de son texte.
const EXEMPLES_ECRAN = [
  // La mise en forme et le pied des badges (application)
  ['format.date', { annee: 2031, mois: 4, jour: 1 }],
  ['format.date', { annee: 2031, mois: 5, jour: 17 }],
  ['format.duree.secondes', { secondes: '12,5' }],
  ['format.duree.minutes', { minutes: 3, secondes: 0 }],
  ['format.duree.minutes', { minutes: 3, secondes: 4 }],
  ['format.duree.heures', { heures: 2, minutes: 0 }],
  ['format.duree.heures', { heures: 2, minutes: 15 }],
  ['format.heure', { heure: 20, minute: 5 }],
  ['format.horodatage', { annee: 2031, mois: 4, jour: 2, heure: 20, minute: 5 }],
  ['planche.controle.absents', { points: ['U+1F33C', 'U+2603'] }],
  ['planche.controle.evenement', { nom: 'Soirée des Ombrelles', date: '2031-04-02' }],
  ['planche.controle.imposition', { imposition: 'pile' }],
  ['planche.pied.date', { date: '2031-04-02' }],
  ['planche.pied.evenement', { nom: 'Soirée des Ombrelles', date: null }],
  ['planche.pied.horodatage', { horodatage: '2031-04-02T21:42:30-04:00' }],
  // L'accueil et l'événement
  ['accueil.entete.resume', { evenements: 3, participants: 1200 }],
  ['accueil.groupe.compte', { evenements: 1 }],
  ['evenement.resume.participants', { participants: 48 }],
  ['evenement.resume.tables', { tables: 6, sieges: 48 }],
  ['evenement.resume.tours', { tours: 4 }],
  ['communs.nom.remede', { cle: 'evenement.historique.nommer', objet: 'Iris Ombrelle' }],
  // Les badges
  ['badges.annonce.absents', { caracteres: [{ caractere: '\u{1F33C}', point: 'U+1F33C' }] }],
  ['badges.annonce.homonymes', { nom: 'Iris Ombrelle', ids: [4, 9] }],
  ['badges.annonce.logosIllisibles', { noms: ['Iris Ombrelle'] }],
  ['badges.annonce.logosIllisibles', { noms: ['Iris Ombrelle', 'Théo Pervenche'] }],
  ['badges.annonce.logosIntrouvables', { noms: ['Iris Ombrelle'] }],
  ['badges.annonce.logosIntrouvables', { noms: ['Iris Ombrelle', 'Théo Pervenche'] }],
  [
    'badges.annonce.planches',
    {
      parPapier: [
        { nom: 'impression.papier.nom.lettre', planches: 3, choisi: true },
        { nom: 'impression.papier.nom.a4', planches: 4, choisi: false },
      ],
    },
  ],
  // Le diagnostic
  ['diagnostic.placesManquantes', { placesManquantes: 2 }],
  [
    'diagnostic.placesManquantes',
    {
      placesManquantes: 3,
      tours: [
        { tour: 1, manque: 2 },
        { tour: 3, manque: 1 },
      ],
    },
  ],
  // La génération
  ['generation.avancement.texte', { fait: 1500, total: 20_000 }],
  ['generation.coeurs.disponibles', { disponibles: 8 }],
  ['generation.coeurs.nombre', { disponibles: 8 }],
  ['generation.depart.aAsseoir', { tours: [2, 3] }],
  ['generation.depart.aAsseoirFige', { tours: [2] }],
  ['generation.depart.rencontresFigees', { tours: [1, 2] }],
  ['generation.depart.retiree', { tours: [3] }],
  ['generation.duree.estimee', { secondes: 90, coeurs: 4 }],
  ['generation.duree.observee', { dureeMs: 12_500, nombre: 20, arret: 5000, coeurs: 4 }],
  ['generation.longue.question', { estimation: { inconnue: true } }],
  [
    'generation.longue.question',
    {
      estimation: {
        inconnue: false,
        secondes: 2400,
        coeurs: 4,
        auDelaDuPlafond: true,
        mesure: { dureeMs: 30_000, mouvements: 100_000, coeurs: 4 },
      },
    },
  ],
  ['generation.priorites.annonce', { critere: 'redondance', palier: 2, paliers: 4, avec: [] }],
  ['generation.priorites.annonce', { critere: 'redondance', palier: 2, paliers: 4, avec: ['collisionsCumulees'] }],
  ['generation.priorites.descendre', { critere: 'redondance' }],
  ['generation.priorites.descendrePalier', { critere: 'redondance' }],
  ['generation.priorites.joindre', { critere: 'redondance' }],
  ['generation.priorites.monter', { critere: 'redondance' }],
  ['generation.priorites.monterPalier', { critere: 'redondance' }],
  ['generation.priorites.palier', { palier: 1, paliers: 3 }],
  ['generation.priorites.poids', { critere: 'redondance' }],
  ['generation.priorites.separer', { critere: 'redondance' }],
  // L'import et les participants
  ['import.apercu.doublonLignes', { lignes: [15, 16, 17] }],
  ['import.presence.tours', { tours: [1, 3] }],
  ['participants.conflit.personne', { regles: ['conflitsOrganisation', 'nouveauxVoisins'] }],
  ['participants.conflit.raison.nouveauxVoisins', { deja: [{ tour: 1, numero: 3 }] }],
  ['participants.conflit.raison.nouvelleTable', { numero: 3, deja: [{ tour: 1 }, { tour: 2 }] }],
  ['participants.presence.tours', { tours: [2, 3, 4] }],
  [
    'participants.fiche.rencontres.toursListe',
    {
      tours: [
        { tour: 1, table: 3 },
        { tour: 2, table: 5 },
      ],
    },
  ],
  // Le plan
  ['plan.absentes.presente', { tours: [1, 2] }],
  ['plan.ligne.tete', { numero: 2, etat: { cle: 'plan.ligne.libre', details: {} }, avecNom: true }],
  ['plan.listesTravail.enReserve', { tours: [2] }],
  ['plan.listesTravail.pourvuAuxTours', { tours: [1, 3] }],
  // Les propositions
  ['propositions.commande.garder', { n: 3 }],
  ['propositions.filiation.deriveeFiges', { depart: 4, tours: [1, 2] }],
  ['propositions.nettoyage.annonce', { effacees: 5 }],
  ['propositions.nettoyage.defaire', { effacees: 1 }],
  ['propositions.nettoyage.defaire', { effacees: 5 }],
  ['propositions.nettoyage.gardees', { n: 3 }],
  ['propositions.nettoyage.titre', { n: 3, effacees: 5 }],
  ['propositions.ordre.criteres', { criteres: ['redondance', 'collisionsCumulees'] }],
  ['propositions.ordre.saute', { saute: 'ecartAuPlafondAPrioriMax', applique: null }],
  [
    'propositions.ordre.saute',
    {
      saute: 'ecartAuPlafondAPrioriMax',
      applique: [
        { nom: 'redondance', poids: 2, valeurs: ['redondance'] },
        { nom: 'collisionsCumulees', poids: 1, valeurs: ['collisionsCumulees'] },
      ],
    },
  ],
  // La qualité
  ['qualite.comparaison.indiscernables.palier', { rang: 2, criteres: ['redondance', 'collisionsCumulees'] }],
  ['qualite.diversite.synthese', { organisations: { moins: 2, auMinimum: 3 }, etiquettes: { moins: 1, auMinimum: 1 } }],
  [
    'qualite.entete.explicationRang1',
    { explication: 'propositions.explication.rencontresTous', nom: 'Iris Ombrelle', tours: [1, 2] },
  ],
  ['qualite.entete.rang1Presence', { tours: [1, 2] }],
  ['qualite.paires.matrice.synthese', { choisies: { paires: 2, fois: 3 }, imposees: { paires: 1, fois: 2 } }],
  // Les tables
  ['tables.animateurs.statut.absente', { tours: [1, 3] }],
  [
    'tables.animateurs.statut.placeeAuRetenu',
    { placements: [{ table: 1, numero: 1, tours: [1, 2, 3] }, { table: 4, numero: 4, tours: [4] }] },
  ],
  [
    'tables.animateurs.statut.reservee',
    { reservations: [{ table: 3, numero: 3, siege: null, portee: 'tour', tour: 2 }, { table: 2, numero: 2, siege: 1, portee: 'tous', tour: null }] },
  ],
  ['tables.defaut.application', { suivent: 3, avant: 8, apres: 10, surchargees: [] }],
  ['tables.defaut.application', { suivent: 3, avant: 8, apres: 10, surchargees: [2, 5] }],
  ['tables.defaut.refusTable', { numero: 3, refus: { code: 'NOM_REQUIS', details: { remede: null } } }],
  ['tables.nom.objectif', { cle: 'tables.objectif.regle', tour: 2, numero: 3 }],
  ['tables.nom.table', { cle: 'tables.objectif.tour', details: { tour: 2 }, numero: 3 }],
  ['tables.suppression.objectif', { tour: null, etiquettes: ['comptabilité', 'bénévole'] }],
  ['tables.tours.objectif', { numero: 3, tour: 2, etiquettes: ['comptabilité'] }],
  ['tables.tours.presence', { nom: 'Iris Ombrelle', avant: [1], apres: [1, 2] }],
];

// Les détails génériques : chaque détail lu vaut « ⟨nom⟩ ».
const GENERIQUE = new Proxy({}, { get: (_, nom) => (typeof nom === 'symbol' ? undefined : `\u{27E8}${nom}\u{27E9}`) });

// Chaque [clé, détails] à rendre : les exemples, puis l'objet générique pour
// chaque clé qu'aucun exemple ne nomme.
function aRendre() {
  const paires = [
    ...MODULES_EXEMPLES.flatMap(({ EXEMPLES, TEXTES }) => [...EXEMPLES, ...TEXTES.map(([cle, details]) => [cle, details])]),
    ...EXEMPLES_ECRAN,
  ];
  const nommees = new Set(paires.map(([cle]) => cle));
  return [...paires, ...brut.cles().filter((cle) => !nommees.has(cle)).map((cle) => [cle, GENERIQUE])];
}

// Le texte d'une paire par une traduction, ou la faute qui la nomme.
function rendre(t, cle, details) {
  try {
    return { texte: t(cle, details) };
  } catch (erreur) {
    return { faute: `${cle} : ${erreur.message}` };
  }
}

const ESPACE_DEVANT = / [;:?!»]/u;
const ESPACE_APRES = /« /u;
// Une espace ordinaire entre un nombre et son unité, après « n° », ou entre
// le jour et le mois d'une date en lettres. Les fins de mot sont celles de
// typographier : l'unité s'arrête à ce qui n'est ni lettre, ni chiffre, ni
// apostrophe, ni trait d'union, le mois à ce qui n'est ni lettre ni chiffre.
const ESPACE_LIEE =
  /\d (?:[hs]|min|mm|Mo|Mpx|px|po|pt)(?![\p{L}\p{N}'\u{2019}-])|n° \d|\d+ (?:janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)(?![\p{L}\p{N}])/u;

// Des textes où le motif du balayage et typographier doivent s'accorder :
// une plage au trait d'union, une date suivie d'un guillemet simple, un mot
// qui commence par une unité ou un mois sans en être un.
const ACCORDS = [
  'du 3 mai-5 juin',
  'de 20 h 30-22 h 00',
  '17 mai 2031-2032',
  '\u{2018}le 31 mai\u{2019}',
  "3 s'y rangent",
  '3 s\u{2019}y rangent',
  '3 maisons',
  '2 hérons',
];

describe("typographie de l'écran : le balayage des clés (§ 14.6, § 14.2)", () => {
  test('le motif du balayage ne relève aucune sortie de typographier, et relève le brut de ce qu’elle lie', () => {
    for (const texte of ACCORDS) {
      const rendu = typographier(texte);
      assert.equal(ESPACE_LIEE.test(rendu), false, `sortie ${JSON.stringify(rendu)}`);
      assert.equal(ESPACE_LIEE.test(texte), rendu !== texte, `brut ${JSON.stringify(texte)}`);
    }
  });

  test('les exemples de l’écran ne nomment que des clés des tables', () => {
    const cles = new Set(brut.cles());
    assert.ok(EXEMPLES_ECRAN.length > 0);
    assert.deepEqual(
      EXEMPLES_ECRAN.map(([cle]) => cle).filter((cle) => !cles.has(cle)),
      [],
    );
  });

  test("chaque clé se rend par le t de l'écran, sans espace ordinaire devant ; : ? ! » ni après «, ni dans un nombre et son unité, « n° » ou une date", () => {
    const paires = aRendre();
    const rendues = new Set();
    const fautes = [];
    for (const [cle, details] of paires) {
      const { texte, faute } = rendre(ecran.t, cle, details);
      if (faute !== undefined) {
        fautes.push(faute);
        continue;
      }
      rendues.add(cle);
      if (ESPACE_DEVANT.test(texte) || ESPACE_APRES.test(texte) || ESPACE_LIEE.test(texte)) fautes.push(`${cle} : ${JSON.stringify(texte)}`);
    }
    assert.deepEqual(fautes, []);
    assert.ok(rendues.size > 0, 'balayage vide');
    assert.deepEqual(
      brut.cles().filter((cle) => !rendues.has(cle)),
      [],
      'clés jamais rendues',
    );
  });

  test("le balayage porte : des centaines de textes bruts ont l'espace ordinaire que l'écran remplace", () => {
    let changes = 0;
    for (const [cle, details] of aRendre()) {
      const avant = rendre(brut.t, cle, details).texte;
      if (avant === undefined) continue;
      if (ESPACE_DEVANT.test(avant) || ESPACE_APRES.test(avant)) {
        changes += 1;
        assert.notEqual(ecran.t(cle, details), avant, cle);
      }
    }
    assert.ok(changes > 100, `${changes} textes ponctués seulement`);
  });

  test("le balayage porte : des dizaines de textes bruts ont l'espace d'une unité, de « n° » ou d'une date que l'écran lie", () => {
    let changes = 0;
    for (const [cle, details] of aRendre()) {
      const avant = rendre(brut.t, cle, details).texte;
      if (avant === undefined) continue;
      if (ESPACE_LIEE.test(avant)) {
        changes += 1;
        const apres = ecran.t(cle, details);
        assert.notEqual(apres, avant, cle);
        assert.equal(apres.replace(/[\u{00A0}\u{202F}]/gu, ' '), avant.replace(/[\u{00A0}\u{202F}]/gu, ' '), cle);
      }
    }
    assert.ok(changes > 50, `${changes} textes à unité, « n° » ou date seulement`);
  });

  test('la durée, l’heure et la date de la mise en forme : brutes à l’espace, liées sur l’écran', () => {
    assert.equal(brut.t('format.duree.minutes', { minutes: 3, secondes: 4 }), '3 min 4 s');
    assert.equal(ecran.t('format.duree.minutes', { minutes: 3, secondes: 4 }), '3\u{A0}min 4\u{A0}s');
    assert.equal(ecran.t('format.duree.heures', { heures: 2, minutes: 15 }), '2\u{A0}h 15\u{A0}min');
    assert.equal(brut.t('format.heure', { heure: 20, minute: 5 }), '20 h 05');
    assert.equal(ecran.t('format.heure', { heure: 20, minute: 5 }), '20\u{A0}h\u{A0}05');
    assert.equal(brut.t('format.date', { annee: 2031, mois: 5, jour: 1 }), '1er mai 2031');
    assert.equal(ecran.t('format.date', { annee: 2031, mois: 5, jour: 1 }), '1er\u{A0}mai\u{A0}2031');
    assert.equal(ecran.t('PROPOSITION_INCONNUE', { id: 17 }), 'La proposition n°\u{A0}17 n\'est pas dans cet événement.');
  });

  test('l’énumération des tours d’une rencontre se fait dans la table : brute « ; », à fine insécable sur l’écran', () => {
    const tours = [
      { tour: 1, table: 3 },
      { tour: 2, table: 5 },
    ];
    assert.equal(brut.t('participants.fiche.rencontres.toursListe', { tours }), 'tour 1, table 3 ; tour 2, table 5');
    assert.equal(ecran.t('participants.fiche.rencontres.toursListe', { tours }), 'tour 1, table 3\u{202F}; tour 2, table 5');
    assert.equal(ecran.t('participants.fiche.rencontres.toursListe', { tours: [{ tour: 4, table: 1 }] }), 'tour 4, table 1');
  });
});

describe('typographie de l’écran : libelle() reste brut (§ 14.6, § 8.2)', () => {
  test('aucune sortie de libelle() ne porte U+00A0, et chacune est le texte du t brut', () => {
    let comptees = 0;
    const fautes = [];
    for (const [cle, details] of aRendre()) {
      if (!CLES_APPLICATION.has(cle)) continue;
      const attendu = rendre(brut.t, cle, details);
      if (attendu.faute !== undefined) continue;
      const texte = libelle(cle, details);
      comptees += 1;
      if (texte.includes('\u{00A0}')) fautes.push(`${cle} : insécable dans ${JSON.stringify(texte)}`);
      if (texte !== attendu.texte) fautes.push(`${cle} : ${JSON.stringify(texte)} au lieu de ${JSON.stringify(attendu.texte)}`);
    }
    assert.deepEqual(fautes, []);
    assert.ok(comptees > 0, 'aucun libellé de l’application');
  });

  test('un libellé figé ponctué garde son espace ordinaire : le journal et le CSV ne changent pas', () => {
    const texte = libelle('ENTREE_AJOUTER_CONFLIT', { personne: 'Iris Ombrelle', organisation: 'Société Alpha' });
    assert.equal(texte, 'Conflits de Iris Ombrelle : ajouté « Société Alpha »');
    assert.equal(
      ecran.t('ENTREE_AJOUTER_CONFLIT', { personne: 'Iris Ombrelle', organisation: 'Société Alpha' }),
      'Conflits de Iris Ombrelle\u{00A0}: ajouté «\u{00A0}Société Alpha\u{00A0}»',
    );
  });
});
