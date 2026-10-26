// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'import appliqué (§ 10.1, § 14.10) : ajouter, mettre à jour,
// remplacer, et ce que remplacer annonce avant d'agir ; l'import selon l'état
// du plan ; les refus globaux, et celui d'un compteur qui ne suffit pas aux
// personnes créées ; les identifiants jamais réutilisés ; le CSV des lignes
// refusées, sa forme, et la boucle qui le corrige et le réimporte tel quel ;
// la colonne des étiquettes, qu'une personne créée porte rangée et qu'une
// mise à jour remplace sans jamais l'effacer ; la colonne de la présence,
// écrite canonique, gardée par une cellule vide en mise à jour, et refusée
// sous un aperçu calculé pour un autre nombre de tours ; les titres que
// pourvoient les seules personnes présentes ; la marque du nom numéroté, que
// porte la seule personne créée d'une ligne renommée par « Rendre les noms
// uniques ». Les marques combinantes s'écrivent par leur point de code.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { serialiser } from '../stockage/canonique.js';
import { analyser, creerCharge } from '../stockage/document.js';
import { estFigee, gelerPropositions } from '../stockage/gel.js';
import { VERSION } from '../version.genere.js';
import { apercevoir } from './apercu.js';
import { decoder } from './encodage.js';
import { ErreurCsv } from './erreurs.js';
import { exporterParticipants } from './export.js';
import { appliquerImport, bilanRemplacement, exporterRefus, pourvoyeursDesTitres } from './import.js';
import { decouper } from './lecture.js';
import { rendreNomsUniques } from './noms_uniques.js';

const MARQUE = '\u{FEFF}';

// Texte d'un CSV : chaque ligne donnée, terminée par CRLF.
const csv = (...lignes) => lignes.map((ligne) => `${ligne}\r\n`).join('');

// Octets d'un fichier UTF-8 avec marque, de texte donné.
const enUtf8 = (texte) => new TextEncoder().encode(MARQUE + texte);

// Octets windows-1252 d'un texte dont chaque caractère est de Latin-1 hors
// des commandes C1 : windows-1252 y donne à chacun l'octet de son point de
// code.
const enWindows1252 = (texte) => Uint8Array.from(texte, (caractere) => caractere.charCodeAt(0));

// Octets UTF-16 LE avec marque d'un texte.
function enUtf16le(texte) {
  const octets = new Uint8Array(2 + 2 * texte.length);
  octets.set([0xff, 0xfe]);
  for (let i = 0; i < texte.length; i += 1) {
    const unite = texte.charCodeAt(i);
    octets[2 + 2 * i] = unite & 0xff;
    octets[3 + 2 * i] = unite >> 8;
  }
  return octets;
}

// Dix-neuf patronymes inventés : les lignes 2 à 20 d'un texte, la fenêtre où
// se choisit le séparateur. Un enregistrement dont le nombre de champs
// diffère de celui de l'en-tête n'est une ligne refusée qu'au-delà, à partir
// du rang 21 ; dans la fenêtre, il refuse le texte entier.
const REMPLISSAGE = [
  'Aubier', 'Bourgeon', 'Cormier', 'Duvet', 'Églantier', 'Frêne', 'Genêt', 'Houx', 'Ibéris', 'Jasmin',
  'Lierre', 'Mélèze', 'Noisetier', 'Orme', 'Pommier', 'Quenouille', 'Ronce', 'Saule', 'Tilleul',
];

// Participant, ses champs omis vides et non exclu.
const personne = (id, nom, prenom = null, organisation = null, autres = {}) => ({
  id, nom, prenom, organisation, courriel: null, titrePressenti: null, notes: null, exclu: false, ...autres,
});

const table = (id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 250 * (id - 1), y: 0 } });

// Réservation de portée « tous les tours », ou du tour donné.
const reservation = (participant, tableReservee, siege, tour = null) => ({
  participant, table: tableReservee, siege, portee: tour === null ? 'tous' : 'tour', tour,
});

const titre = (tableTitree, siege, libelle = 'animation') => ({ table: tableTitree, siege, libelle });

// Proposition de deux tours sur les tables 1 et 2, qui place les
// participants donnés, triés, en alternance.
function proposition(id, participants) {
  const tour = (decalage) => ({
    sieges: [0, 1].map((rang) => participants.filter((_, i) => (i + decalage) % 2 === rang)),
    reserve: [],
  });
  return {
    id, graine: 48271 + id, arret: 200000, historique: 1000, produitVersion: VERSION.affichee, siegesAttribues: false,
    tables: [1, 2], capacites: [4, 4], tours: 2, participants, placement: [tour(0), tour(1)],
  };
}

// Charge d'un événement de deux tours par défaut, tables de quatre sièges
// par défaut, qui porte ce qu'on lui donne. Le compteur des identifiants de
// participant dépasse par défaut le plus grand donné ; ceux des tables et
// des propositions, toujours.
function chargeDe({
  participants = [], tables = [], reservations = [], titres = [], propositions = [], retenu = null,
  etat = 'brouillon', attribuerSieges = false, prochain, tours = 2,
} = {}) {
  const charge = creerCharge({ id: 'evt-essai', nom: "Soirée d'essai", siegesParDefaut: 4, tours });
  const auDela = (ids) => ids.reduce((plus, id) => Math.max(plus, id), 0) + 1;
  charge.evenement.etat = etat;
  charge.reglages.attribuerSieges = attribuerSieges;
  charge.prochainsIds = {
    participant: prochain ?? auDela(participants.map(({ id }) => id)),
    table: auDela(tables.map(({ id }) => id)),
    proposition: auDela(propositions.map(({ id }) => id)),
  };
  charge.participants = participants;
  charge.tables = tables;
  charge.reservations = reservations;
  charge.titres = titres;
  charge.propositions = propositions;
  charge.retenu = retenu;
  return charge;
}

// Une charge garnie : quatre personnes dont une exclue, deux tables, des
// réservations, des titres, deux propositions et un retenu.
function chargeGarnie(autres = {}) {
  return chargeDe({
    participants: [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles', { courriel: 'iris@exemple.test' }),
      personne(2, 'Grisaille', null, 'Club des Merles', { exclu: true }),
      personne(3, 'Pervenche', 'Théo'),
      personne(4, 'Lacasse', 'Ondine', 'Société Alpha'),
    ],
    tables: [table(1), table(2)],
    reservations: [reservation(1, 1, 1), reservation(2, 1, 2), reservation(3, 2, 1, 2), reservation(4, 2, null)],
    titres: [titre(1, 1), titre(1, 2, 'accueil'), titre(2, 1), titre(2, 2)],
    propositions: [proposition(1, [1, 2, 3, 4]), proposition(2, [1, 3])],
    retenu: retenuDe(proposition(1, [1, 2, 3, 4])),
    prochain: 9,
    ...autres,
  });
}

// Retenu tiré d'une proposition : son identifiant d'origine, puis les
// champs du plan, sans ceux qui ne sont qu'à une proposition.
function retenuDe({ id, siegesAttribues, tables, capacites, tours, participants, placement }) {
  return { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
}

// Aperçu d'un texte contre les participants, les tables et le nombre de
// tours de la charge, comme l'interface le calcule, dans le mode donné, puis
// import dans ce même mode.
function importer(charge, texte, mode, choix = {}) {
  const apercu = apercevoir(texte, {
    participants: charge.participants, tables: charge.tables, choix, mode, tours: charge.evenement.tours,
  });
  return appliquerImport(charge, apercu, mode);
}

// Motif d'épreuve : le code et ses détails en JSON. Il porte guillemets et
// virgules, que le CSV des refus doit citer.
const MOTIF = (code, details) => `${code} ${JSON.stringify(details)}`;

// Valide une ErreurCsv de code et de détails donnés.
const refus = (code, details) => (erreur) => {
  assert.ok(erreur instanceof ErreurCsv, String(erreur));
  assert.equal(erreur.code, code);
  assert.deepEqual(erreur.details, details);
  return true;
};

// Objets et listes d'une donnée JSON : JSON.stringify visite chaque valeur,
// et le remplaçant relève au passage chaque objet et chaque liste.
function objetsDe(valeur) {
  const vus = new Set();
  JSON.stringify(valeur, (_, v) => {
    if (typeof v === 'object' && v !== null) vus.add(v);
    return v;
  });
  return vus;
}

// Résumé d'un import, ses comptes omis à zéro.
const resumeDe = (comptes = {}) => ({
  ajoutes: 0, misAJour: 0, inchanges: 0, retires: 0, reservationsRetirees: 0, logosRetires: 0, refusees: [], derive: false, ...comptes,
});

const MODES = ['ajouter', 'mettreAJour', 'remplacer'];

describe('appliquerImport : ajouter (§ 10.1)', () => {
  test("chaque ligne valide devient un participant, identifiants depuis prochainsIds dans l'ordre du fichier", () => {
    const charge = chargeDe({ participants: [personne(3, 'Lacasse', 'Ondine')], prochain: 5 });
    const { charge: apres, resume } = importer(
      charge,
      csv(
        'nom;prenom;organisation;courriel;titre_pressenti;exclu;notes',
        'Ombrelle;Iris;Club des Merles;iris@exemple.test;animation;non;arrive tôt',
        'Pervenche;Théo;;;;oui;',
        'Sarcelle;;;;;;',
      ),
      'ajouter',
    );
    assert.deepEqual(apres.participants, [
      personne(3, 'Lacasse', 'Ondine'),
      personne(5, 'Ombrelle', 'Iris', 'Club des Merles', {
        courriel: 'iris@exemple.test', titrePressenti: 'animation', notes: 'arrive tôt',
      }),
      personne(6, 'Pervenche', 'Théo', null, { exclu: true }),
      personne(7, 'Sarcelle'),
    ]);
    assert.equal(apres.prochainsIds.participant, 8);
    assert.deepEqual(resume, resumeDe({ ajoutes: 3 }));
  });

  test("sans colonne exclu, ou sa cellule vide, la personne créée n'est pas exclue", () => {
    const { charge: apres } = importer(chargeDe(), csv('nom', 'Ombrelle', 'Pervenche'), 'ajouter');
    assert.deepEqual(apres.participants.map(({ exclu }) => exclu), [false, false]);
  });

  test("ajouter ne fusionne jamais un doublon : la ligne d'un participant existant en crée un second", () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris', 'Club des Merles')] });
    const { charge: apres, resume } = importer(
      charge, csv('nom;prenom;organisation', 'Ombrelle;Iris;Club des Merles', 'ombrelle;IRIS;club des merles'), 'ajouter',
    );
    assert.deepEqual(apres.participants, [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
      personne(2, 'Ombrelle', 'Iris', 'Club des Merles'),
      personne(3, 'ombrelle', 'IRIS', 'Club des Merles'),
    ]);
    assert.equal(resume.ajoutes, 2);
  });

  test("l'organisation prend l'orthographe que l'aperçu affiche ; une organisation de clé vide arrive à null", () => {
    const charge = chargeDe({ participants: [personne(1, 'Lacasse', 'Ondine', 'Club des Merles')] });
    const { charge: apres } = importer(
      charge, csv('nom;prenom;organisation', 'Ombrelle;Iris;CLUB DES  MERLES', 'Pervenche;Théo;\u{0301}\u{0301}'), 'ajouter',
    );
    assert.deepEqual(apres.participants.map(({ organisation }) => organisation), ['Club des Merles', 'Club des Merles', null]);
  });

  test('l’en-tête « appartenance » des anciens fichiers remplit l’organisation, comme « organisation »', () => {
    const ancien = importer(chargeDe(), csv('nom;Appartenance', 'Ombrelle;Club des Merles', 'Pervenche;'), 'ajouter');
    const nouveau = importer(chargeDe(), csv('nom;organisation', 'Ombrelle;Club des Merles', 'Pervenche;'), 'ajouter');
    assert.deepEqual(ancien.charge.participants, [
      personne(1, 'Ombrelle', null, 'Club des Merles'),
      personne(2, 'Pervenche'),
    ]);
    assert.deepEqual(ancien.charge, nouveau.charge);
    assert.deepEqual(ancien.resume, resumeDe({ ajoutes: 2 }));
  });

  test("les lignes refusées de l'aperçu passent au résumé, dans l'ordre des lignes, et ne créent rien", () => {
    const { charge: apres, resume } = importer(
      chargeDe(), csv('nom;prenom;exclu', 'Ombrelle;Iris;', ';Théo;non', 'Sarcelle;Ondine;peut-être'), 'ajouter',
    );
    assert.deepEqual(apres.participants, [personne(1, 'Ombrelle', 'Iris')]);
    assert.deepEqual(resume, resumeDe({
      ajoutes: 1,
      refusees: [
        { ligne: 3, code: 'NOM_ABSENT', valeur: null, brut: ['', 'Théo', 'non'] },
        { ligne: 4, code: 'EXCLU_INCONNU', valeur: 'peut-être', brut: ['Sarcelle', 'Ondine', 'peut-être'] },
      ],
    }));
  });
});

describe('appliquerImport : mettre à jour (§ 10.1)', () => {
  test('un fichier qui ne porte que des noms ne vide aucun courriel, ni aucun autre champ', () => {
    const existants = [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles', {
        courriel: 'iris@exemple.test', titrePressenti: 'animation', notes: 'arrive tard', exclu: true,
      }),
      personne(2, 'Pervenche', 'Théo', null, { courriel: 'theo@exemple.test' }),
    ];
    const charge = chargeDe({ participants: existants });
    const { charge: apres, resume } = importer(charge, csv('nom;prenom', 'Ombrelle;Iris', 'Pervenche;Théo'), 'mettreAJour');
    assert.deepEqual(apres.participants, existants);
    assert.deepEqual(resume, resumeDe({ inchanges: 2 }));
  });

  test('un champ non vide remplace la valeur, un champ vide la garde ; la ligne désigne sans égard à la casse, aux accents ni aux blancs', () => {
    const charge = chargeDe({
      participants: [personne(1, 'Pervenche', 'Théo', 'Club des Merles', { courriel: 'ancien@exemple.test', notes: 'garde' })],
    });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;prenom;organisation;courriel;notes', ' PERVENCHE ;theo;club des  merles;nouveau@exemple.test;'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants, [
      personne(1, 'PERVENCHE', 'theo', 'Club des Merles', { courriel: 'nouveau@exemple.test', notes: 'garde' }),
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 1 }));
  });

  test('exclu : une cellule vide garde la valeur, non réintègre, oui exclut', () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Ombrelle', null, null, { exclu: true }),
        personne(2, 'Pervenche', null, null, { exclu: true }),
        personne(3, 'Sarcelle'),
      ],
    });
    const { charge: apres, resume } = importer(charge, csv('nom;exclu', 'Ombrelle;', 'Pervenche;non', 'Sarcelle;oui'), 'mettreAJour');
    assert.deepEqual(apres.participants.map(({ exclu }) => exclu), [true, false, true]);
    assert.deepEqual(resume, resumeDe({ misAJour: 2, inchanges: 1 }));
  });

  test("une ligne qui désigne deux participants est refusée PLUSIEURS_CORRESPONDENT, leurs identifiants nommés ; l'organisation de la ligne les départage", () => {
    const existants = [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
      personne(2, 'Ombrelle', 'Iris', 'Chorale du Givre'),
    ];
    const charge = chargeDe({ participants: existants });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;prenom;organisation;courriel', 'Ombrelle;Iris;;iris@exemple.test', 'Ombrelle;Iris;chorale du givre;givre@exemple.test'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants, [existants[0], { ...existants[1], courriel: 'givre@exemple.test' }]);
    assert.deepEqual(resume, resumeDe({
      misAJour: 1,
      refusees: [{
        ligne: 2, code: 'PLUSIEURS_CORRESPONDENT', valeur: null, participants: [1, 2],
        brut: ['Ombrelle', 'Iris', '', 'iris@exemple.test'],
      }],
    }));
  });

  test("une ligne qui ne désigne personne est ajoutée, son identifiant depuis prochainsIds", () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris')], prochain: 4 });
    const { charge: apres, resume } = importer(charge, csv('nom;prenom', 'Ombrelle;Iris', 'Ombrelle;Théo'), 'mettreAJour');
    assert.deepEqual(apres.participants, [personne(1, 'Ombrelle', 'Iris'), personne(4, 'Ombrelle', 'Théo')]);
    assert.equal(apres.prochainsIds.participant, 5);
    assert.deepEqual(resume, resumeDe({ ajoutes: 1, inchanges: 1 }));
  });

  test("l'organisation que porte la ligne compte même devant un seul homonyme : d'une autre organisation, la ligne est ajoutée, et l'homonyme garde ses valeurs", () => {
    const existants = [personne(1, 'Ombrelle', 'Iris', 'Club des Merles', { courriel: 'iris@exemple.test' })];
    const texte = csv('nom;prenom;organisation;courriel', 'Ombrelle;Iris;Chorale du Givre;givre@exemple.test');
    // L'aperçu nomme la ligne qui s'ajoute à côté de l'homonyme.
    assert.deepEqual(apercevoir(texte, { participants: existants, mode: 'mettreAJour' }).homonymes, [
      { ligne: 2, participants: [1] },
    ]);
    const { charge: apres, resume } = importer(chargeDe({ participants: existants }), texte, 'mettreAJour');
    assert.deepEqual(apres.participants, [
      existants[0],
      personne(2, 'Ombrelle', 'Iris', 'Chorale du Givre', { courriel: 'givre@exemple.test' }),
    ]);
    assert.deepEqual(resume, resumeDe({ ajoutes: 1 }));
  });

  test('une ligne sans prénom, ou un fichier sans colonne prénom, désigne le seul participant de ce nom, qui en porte un : il est mis à jour, rien ajouté', () => {
    // Un fichier qui ne porte que les noms et les courriels complète les
    // inscrits ; il ne les double pas.
    const existants = [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
      personne(2, 'Lacasse', 'Ondine', 'Société Alpha'),
      personne(3, 'Pervenche', 'Théo'),
    ];
    const { charge: apres, resume } = importer(
      chargeDe({ participants: existants }),
      csv('nom;courriel', 'Ombrelle;iris@exemple.test', 'Lacasse;ondine@exemple.test'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants, [
      { ...existants[0], courriel: 'iris@exemple.test' },
      { ...existants[1], courriel: 'ondine@exemple.test' },
      existants[2],
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 2 }));
    const vide = importer(chargeDe({ participants: existants }), csv('nom;prenom;exclu', 'Ombrelle;;oui'), 'mettreAJour');
    assert.deepEqual(vide.charge.participants, [{ ...existants[0], exclu: true }, existants[1], existants[2]]);
    assert.deepEqual(vide.resume, resumeDe({ misAJour: 1 }));
  });

  test('une ligne qui porte un prénom désigne le seul participant de ce nom sans prénom : il prend le prénom', () => {
    const existants = [personne(1, 'Grisaille', null, 'Club des Merles')];
    const { charge: apres, resume } = importer(
      chargeDe({ participants: existants }), csv('nom;prenom;exclu', 'Grisaille;Silas;oui'), 'mettreAJour',
    );
    assert.deepEqual(apres.participants, [personne(1, 'Grisaille', 'Silas', 'Club des Merles', { exclu: true })]);
    assert.deepEqual(resume, resumeDe({ misAJour: 1 }));
  });

  test("une ligne qui porte une organisation désigne le participant de ce nom et de ce prénom qui n'en a pas : il la prend, rien n'est ajouté", () => {
    const existants = [
      personne(1, 'Ombrelle', 'Iris'),
      personne(2, 'Lacasse', 'Ondine', null, { courriel: 'ondine@exemple.test' }),
    ];
    const { charge: apres, resume } = importer(
      chargeDe({ participants: existants }),
      csv('nom;prenom;organisation', 'Ombrelle;Iris;Club des Merles', 'Lacasse;Ondine;Société Alpha'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants, [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
      personne(2, 'Lacasse', 'Ondine', 'Société Alpha', { courriel: 'ondine@exemple.test' }),
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 2 }));
  });

  test("le prénom et l'organisation ne départagent que lorsque la ligne et le participant en portent tous deux un : plusieurs homonymes restants sont refusés, jamais un ajout", () => {
    const existants = [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
      personne(2, 'Ombrelle', 'Ondine', null),
      personne(3, 'Ombrelle', null, 'Chorale du Givre'),
      personne(4, 'Givre', 'Silas', 'Club des Merles'),
      personne(5, 'Givre', 'Anouk', 'Club des Merles'),
    ];
    const { charge: apres, resume } = importer(
      chargeDe({ participants: existants }),
      csv(
        'nom;prenom;organisation;courriel',
        // Iris : 1 par le prénom, 3 sans prénom ; Chorale du Givre écarte 1.
        'Ombrelle;Iris;Chorale du Givre;a@exemple.test',
        // Sans prénom ni organisation : les trois Ombrelle.
        'OMBRELLE;;;b@exemple.test',
        // Club des Merles écarte 3 ; Iris écarte 2 : reste 1.
        'Ombrelle;Iris;Club des Merles;c@exemple.test',
        // Sans prénom : deux Givre du même club.
        'Givre;;club des merles;d@exemple.test',
      ),
      'mettreAJour',
    );
    assert.deepEqual(resume.refusees.map(({ ligne, code, participants }) => [ligne, code, participants]), [
      [3, 'PLUSIEURS_CORRESPONDENT', [1, 2, 3]],
      [5, 'PLUSIEURS_CORRESPONDENT', [4, 5]],
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 2, refusees: resume.refusees }));
    assert.deepEqual(apres.participants, [
      { ...existants[0], courriel: 'c@exemple.test' },
      existants[1],
      { ...existants[2], prenom: 'Iris', courriel: 'a@exemple.test' },
      existants[3],
      existants[4],
    ]);
  });

  test("l'organisation se compare par sa clé normalisée, des deux côtés : la ligne désigne l'homonyme qui l'écrit sans accents ou en capitales, et lui pose l'orthographe affichée", () => {
    // L'aperçu donne aux deux lignes l'orthographe du premier existant,
    // « Société Alpha » ; les participants qu'elles désignent en écrivent
    // chacun une autre.
    const existants = [
      personne(1, 'Lacasse', 'Ondine', 'Société Alpha'),
      personne(2, 'Ombrelle', 'Iris', 'Societe Alpha'),
      personne(3, 'Pervenche', 'Théo', 'SOCIÉTÉ ALPHA'),
    ];
    const { charge: apres, resume } = importer(
      chargeDe({ participants: existants }),
      csv(
        'nom;prenom;organisation;courriel',
        'Ombrelle;Iris;société alpha;iris@exemple.test',
        'Pervenche;Théo;Societe alpha;theo@exemple.test',
      ),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants, [
      existants[0],
      personne(2, 'Ombrelle', 'Iris', 'Société Alpha', { courriel: 'iris@exemple.test' }),
      personne(3, 'Pervenche', 'Théo', 'Société Alpha', { courriel: 'theo@exemple.test' }),
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 2 }));
  });

  test('deux lignes qui désignent le même participant : la première le met à jour, la seconde est refusée DEJA_DESIGNE', () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris')] });
    const { charge: apres, resume } = importer(
      charge, csv('nom;prenom;courriel', 'Ombrelle;Iris;a@exemple.test', 'ombrelle;iris;b@exemple.test'), 'mettreAJour',
    );
    assert.deepEqual(apres.participants, [personne(1, 'Ombrelle', 'Iris', null, { courriel: 'a@exemple.test' })]);
    assert.deepEqual(resume, resumeDe({
      misAJour: 1,
      refusees: [{
        ligne: 3, code: 'DEJA_DESIGNE', valeur: null, participants: [1], premiereLigne: 2,
        brut: ['ombrelle', 'iris', 'b@exemple.test'],
      }],
    }));
  });

  test("une ligne désigne parmi les valeurs d'avant l'import : ce qu'une ligne précédente pose ne l'écarte pas, et elle est refusée DEJA_DESIGNE, dans les deux ordres", () => {
    // Ombrelle n'a ni prénom ni organisation : chaque ligne la désigne, quel
    // que soit le prénom ou l'organisation que la précédente lui a donné.
    const existants = [personne(1, 'Ombrelle')];
    const cas = [
      ['nom;prenom', ['Ombrelle;Iris', 'Ombrelle;Théo']],
      ['nom;prenom', ['Ombrelle;Théo', 'Ombrelle;Iris']],
      ['nom;organisation', ['Ombrelle;Club des Merles', 'Ombrelle;Chorale du Givre']],
    ];
    for (const [entete, [premiere, seconde]] of cas) {
      const texte = csv(entete, premiere, seconde);
      const apercu = apercevoir(texte, { participants: existants, mode: 'mettreAJour' });
      const { charge: apres, resume } = appliquerImport(chargeDe({ participants: existants }), apercu, 'mettreAJour');
      const [champ, valeur] = [entete.split(';')[1], premiere.split(';')[1]];
      assert.deepEqual(apres.participants, [{ ...existants[0], [champ]: valeur }], premiere);
      assert.deepEqual(resume, resumeDe({
        misAJour: 1,
        refusees: [{
          ligne: 3, code: 'DEJA_DESIGNE', valeur: null, participants: [1], premiereLigne: 2, brut: seconde.split(';'),
        }],
      }), premiere);
      // L'aperçu, qui lit lui aussi les valeurs d'avant l'import, ne nomme
      // aucun homonyme.
      assert.deepEqual(apercu.homonymes, [], premiere);
    }
  });

  test('une mise à jour dont toutes les lignes sont refusées rend une charge égale à celle reçue ; les identifiants refusés, croissants', () => {
    const charge = chargeDe({
      participants: [personne(2, 'Ombrelle', 'Iris', 'Chorale du Givre'), personne(1, 'Ombrelle', 'Iris', 'Club des Merles')],
    });
    const { charge: apres, resume } = importer(
      charge, csv('nom;prenom;courriel', 'Ombrelle;Iris;a@exemple.test', 'OMBRELLE;iris;'), 'mettreAJour',
    );
    assert.deepEqual(apres, charge);
    assert.deepEqual(resume.refusees.map(({ ligne, code, participants }) => [ligne, code, participants]), [
      [2, 'PLUSIEURS_CORRESPONDENT', [1, 2]],
      [3, 'PLUSIEURS_CORRESPONDENT', [1, 2]],
    ]);
    assert.deepEqual(resume, resumeDe({ refusees: resume.refusees }));
  });

  test("la correspondance porte sur les participants d'avant l'import : deux lignes nouvelles et identiques font deux participants", () => {
    const { charge: apres, resume } = importer(chargeDe(), csv('nom;prenom', 'Ombrelle;Iris', 'Ombrelle;Iris'), 'mettreAJour');
    assert.deepEqual(apres.participants, [personne(1, 'Ombrelle', 'Iris'), personne(2, 'Ombrelle', 'Iris')]);
    assert.deepEqual(resume, resumeDe({ ajoutes: 2 }));
  });
});

describe('appliquerImport : la colonne des étiquettes (§ 10.1, A17)', () => {
  test("une personne créée porte ses étiquettes rangées par unités de code, en dernière clé ; sans étiquette, la clé est absente", () => {
    const { charge: apres, resume } = importer(
      chargeDe(),
      csv('nom;etiquettes', 'Ombrelle;finance, Montréal|bénévole', 'Pervenche;', 'Lacasse;" ; | "'),
      'ajouter',
    );
    assert.deepEqual(apres.participants, [
      personne(1, 'Ombrelle', null, null, { etiquettes: ['Montréal', 'bénévole', 'finance'] }),
      personne(2, 'Pervenche'),
      personne(3, 'Lacasse'),
    ]);
    assert.deepEqual(Object.keys(apres.participants[0]).at(-1), 'etiquettes');
    assert.ok(!Object.hasOwn(apres.participants[1], 'etiquettes'));
    assert.equal(resume.ajoutes, 3);
    // La charge rendue s'enregistre et se relit telle quelle.
    assert.deepEqual(analyser(serialiser(apres, { revision: 1, produitVersion: VERSION.affichee })).charge, apres);
  });

  test("l'orthographe reçue est celle de l'événement : une personne existante, un objectif de table", () => {
    const tableVisee = { ...table(2), objectifs: [{ portee: 'tous', tour: null, regle: null, etiquettes: ['RH'] }] };
    const charge = chargeDe({
      participants: [personne(1, 'Lacasse', null, null, { etiquettes: ['finance'] })],
      tables: [table(1), tableVisee],
    });
    const { charge: apres } = importer(charge, csv('nom;etiquettes', 'Ombrelle;"FINANCE; rh"'), 'ajouter');
    assert.deepEqual(apres.participants[1].etiquettes, ['RH', 'finance']);
    const { charge: remplacee } = importer(charge, csv('nom;etiquettes', 'Ombrelle;"FINANCE; rh"'), 'remplacer');
    assert.deepEqual(remplacee.participants.map(({ etiquettes }) => etiquettes), [['FINANCE', 'RH']]);
    assert.deepEqual(remplacee.tables, charge.tables, 'remplacer garde les objectifs des tables');
  });

  test('en mise à jour, une cellule non vide remplace les étiquettes, une cellule vide les garde', () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Ombrelle', 'Iris', null, { etiquettes: ['finance', 'Montréal'].sort() }),
        personne(2, 'Pervenche', 'Théo', null, { etiquettes: ['bénévole'] }),
        personne(3, 'Lacasse', 'Ondine'),
      ],
    });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;prenom;etiquettes', 'Ombrelle;Iris;ressources humaines', 'Pervenche;Théo;', 'Lacasse;Ondine;" , "'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants.map(({ etiquettes }) => etiquettes), [['ressources humaines'], ['bénévole'], undefined]);
    assert.ok(!Object.hasOwn(apres.participants[2], 'etiquettes'));
    assert.deepEqual(resume, resumeDe({ misAJour: 1, inchanges: 2 }));
  });

  test('en mise à jour, les mêmes étiquettes dans un autre ordre, ou d’une autre orthographe de même clé, ne changent rien', () => {
    const existants = [
      personne(1, 'Ombrelle', 'Iris', null, { etiquettes: ['Montréal', 'finance'] }),
      personne(2, 'Pervenche', 'Théo', null, { etiquettes: ['bénévole'] }),
    ];
    const charge = chargeDe({ participants: existants });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;prenom;etiquettes', 'Ombrelle;Iris;FINANCE | montréal', 'Pervenche;Théo;Bénévole'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants, existants);
    assert.deepEqual(resume, resumeDe({ inchanges: 2 }));
  });

  test('en mise à jour, une étiquette de plus, de moins ou autre compte la personne mise à jour', () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Ombrelle', null, null, { etiquettes: ['Montréal', 'finance'] }),
        personne(2, 'Pervenche', null, null, { etiquettes: ['Montréal', 'finance'] }),
        personne(3, 'Lacasse', null, null, { etiquettes: ['Montréal', 'finance'] }),
        personne(4, 'Sarcelle'),
      ],
    });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;etiquettes', 'Ombrelle;finance, Montréal, RH', 'Pervenche;finance', 'Lacasse;Montréal, atelier', 'Sarcelle;finance'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants.map(({ etiquettes }) => etiquettes), [
      ['Montréal', 'RH', 'finance'], ['finance'], ['Montréal', 'atelier'], ['finance'],
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 4 }));
  });

  test('un export réimporté en mise à jour ne compte aucun modifié', () => {
    const existants = [
      personne(1, 'Ombrelle', 'Iris', 'Club des Merles', { etiquettes: ['=SOMME(A1)', 'Montréal', 'finance'] }),
      personne(2, 'Pervenche', 'Théo', null, { exclu: true }),
    ];
    const charge = chargeDe({ participants: existants });
    const { charge: apres, resume } = importer(charge, decoder(exporterParticipants(existants)).texte, 'mettreAJour');
    assert.deepEqual(apres.participants, existants);
    assert.deepEqual(resume, resumeDe({ inchanges: 2 }));
  });

  test("les étiquettes rendues ne partagent rien avec l'aperçu : le changer après coup ne touche pas la charge", () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle', null, null, { etiquettes: ['finance'] })] });
    const apercu = apercevoir(csv('nom;etiquettes', 'Ombrelle;RH', 'Pervenche;atelier'), {
      participants: charge.participants, mode: 'mettreAJour',
    });
    const { charge: apres } = appliquerImport(charge, apercu, 'mettreAJour');
    for (const { champs } of apercu.lignes) champs.etiquettes.push('ajout');
    assert.deepEqual(apres.participants.map(({ etiquettes }) => etiquettes), [['RH'], ['atelier']]);
  });

  test("le CSV des refus reprend une ligne refusée pour ses étiquettes, motif compris, et se réimporte tel quel", () => {
    const texte = csv('nom;etiquettes', 'Ombrelle;finance', `Pervenche;${'x'.repeat(41)}`);
    const apercu = apercevoir(texte);
    assert.deepEqual(apercu.refusees.map(({ code }) => code), ['ETIQUETTE_MAL_FORMEE']);
    const { texte: refus } = decoder(exporterRefus(apercu, MOTIF));
    const { enregistrements } = decouper(refus, ';');
    assert.deepEqual(enregistrements[1].slice(0, 3), ['Pervenche', 'x'.repeat(41), '3']);
    assert.match(enregistrements[1][3], /^ETIQUETTE_MAL_FORMEE .*"raison":"longueur"/);
    assert.deepEqual(apercevoir(refus).refusees.map(({ code }) => code), ['ETIQUETTE_MAL_FORMEE']);
  });
});

describe('appliquerImport : remplacer, et ce que remplacer annonce (§ 10.1)', () => {
  test("bilanRemplacement compte, avant d'agir, les participants, les réservations, les titres pourvus et les propositions touchées", () => {
    const charge = chargeDe({
      participants: [personne(1, 'Ombrelle', 'Iris'), personne(2, 'Pervenche', 'Théo'), personne(3, 'Sarcelle')],
      tables: [table(1), table(2)],
      reservations: [reservation(1, 1, 1), reservation(2, 2, 3)],
      titres: [titre(1, 1), titre(2, 1)],
      propositions: [proposition(1, [1, 2, 3])],
      attribuerSieges: true,
    });
    assert.deepEqual(bilanRemplacement(charge), { participants: 3, reservations: 2, titresPourvus: 1, propositions: 1 });
  });

  test("le bilan annonce ce que remplacer retire : participants et réservations du résumé, titres et propositions gardés", () => {
    const charge = chargeGarnie();
    const bilan = bilanRemplacement(charge);
    const { charge: apres, resume } = importer(charge, csv('nom;prenom', 'Bruyère;Anouk', 'Sarcelle;Ondine'), 'remplacer');
    assert.equal(resume.retires, bilan.participants);
    assert.equal(resume.reservationsRetirees, bilan.reservations);
    assert.deepEqual(resume, resumeDe({ ajoutes: 2, retires: 4, reservationsRetirees: 4 }));
    assert.deepEqual(apres.participants, [personne(9, 'Bruyère', 'Anouk'), personne(10, 'Sarcelle', 'Ondine')]);
    assert.deepEqual(apres.reservations, []);
    for (const cle of ['evenement', 'reglages', 'tables', 'titres', 'propositions', 'retenu']) {
      assert.deepEqual(apres[cle], charge[cle], cle);
    }
    assert.deepEqual(apres.prochainsIds, { ...charge.prochainsIds, participant: 11 });
  });

  test("lecture par siège : un titre est pourvu par la réservation d'une personne non exclue sur son siège, à un tour au moins", () => {
    // Titre (1, 1) : réservé tous les tours. Titre (1, 2) : réservé par une
    // personne exclue. Titre (2, 1) : réservé au tour 2 seulement. Titre
    // (2, 2) : la réservation de la table 2 ne désigne aucun siège.
    assert.deepEqual(bilanRemplacement(chargeGarnie({ attribuerSieges: true })), {
      participants: 4, reservations: 4, titresPourvus: 2, propositions: 2,
    });
  });

  test('lecture par table : à chaque tour, autant de titres pourvus que de personnes non exclues réservées, les titres de la table au plus ; le tour le mieux pourvu compte', () => {
    const participants = [1, 2, 3, 4, 5, 6, 7, 8].map((id) => personne(id, `Personne ${id}`, null, null, { exclu: id === 7 }));
    const charge = chargeDe({
      participants,
      tables: [table(1), table(2), table(3), table(4)],
      reservations: [
        // Table 1, trois titres : deux personnes tous les tours, et une exclue.
        reservation(1, 1, null), reservation(2, 1, null), reservation(7, 1, null),
        // Table 2, un titre : deux personnes tous les tours.
        reservation(3, 2, null), reservation(4, 2, null),
        // Table 3, deux titres : une personne au tour 1, une autre au tour 2.
        reservation(5, 3, null, 1), reservation(6, 3, null, 2),
        // Table 4, un titre : une personne au tour 1 seulement.
        reservation(8, 4, null, 1),
      ],
      titres: [titre(1, 1), titre(1, 2), titre(1, 3), titre(2, 1), titre(3, 1), titre(3, 2), titre(4, 1)],
    });
    assert.deepEqual(bilanRemplacement(charge), { participants: 8, reservations: 8, titresPourvus: 5, propositions: 0 });
    assert.equal(bilanRemplacement(chargeGarnie()).titresPourvus, 3);
  });

  test('lecture par table : une réservation qui porte un siège ne pourvoit que le titre de ce siège', () => {
    const charge = chargeDe({
      participants: [personne(1, 'Ombrelle', 'Iris'), personne(2, 'Pervenche', 'Théo')],
      tables: [table(1)],
      reservations: [reservation(1, 1, 5)],
      titres: [titre(1, 1)],
    });
    charge.evenement.siegesParDefaut = 6;
    assert.equal(bilanRemplacement(charge).titresPourvus, 0);
    charge.reservations.push(reservation(2, 1, null));
    assert.equal(bilanRemplacement(charge).titresPourvus, 1);
  });

  test('lecture par table, à un tour : les réservations à un siège pourvoient leur titre, puis chaque personne sans siège un des titres restants', () => {
    const charge = chargeDe({
      participants: [personne(1, 'Ombrelle', 'Iris'), personne(2, 'Pervenche', 'Théo'), personne(3, 'Lacasse', 'Ondine')],
      tables: [table(1)],
      reservations: [reservation(1, 1, null), reservation(2, 1, 1, 2)],
      titres: [titre(1, 1), titre(1, 2), titre(1, 3)],
    });
    // Tour 1 : Iris pourvoit le premier titre ; tour 2 : Théo le titre de
    // son siège, Iris le suivant. Deux titres pourvus à un tour au moins.
    assert.deepEqual(pourvoyeursDesTitres(charge).map(({ soiree, tours }) => [soiree?.participant ?? null, tours.map((r) => r?.participant ?? null)]), [
      [1, [1, 2]],
      [null, [null, 1]],
      [null, [null, null]],
    ]);
    assert.equal(bilanRemplacement(charge).titresPourvus, 2);
  });

  test("une proposition qui ne place aucune des personnes de la liste n'est pas touchée", () => {
    const charge = chargeDe({
      participants: [personne(1, 'Ombrelle'), personne(2, 'Pervenche')],
      tables: [table(1), table(2)],
      propositions: [proposition(1, [1, 2]), proposition(2, [7, 8]), proposition(3, [2, 8])],
      prochain: 9,
    });
    assert.equal(bilanRemplacement(charge).propositions, 2);
  });

  test("identifiants jamais réutilisés : retirer, puis importer, attribue au-delà de prochainsIds", () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle'), personne(2, 'Pervenche')], prochain: 6 });
    const remplacee = importer(charge, csv('nom', 'Sarcelle', 'Bruyère'), 'remplacer').charge;
    assert.deepEqual(remplacee.participants.map(({ id }) => id), [6, 7]);
    const ajoutee = importer(remplacee, csv('nom', 'Lacasse'), 'ajouter').charge;
    assert.deepEqual(ajoutee.participants.map(({ id }) => id), [6, 7, 8]);
    assert.equal(ajoutee.prochainsIds.participant, 9);
  });

  test('remplacer compte les liens de logo qu’il retire, une personne qui en porte un chacune ; ajouter et mettre à jour n’en retirent aucun et gardent chaque logo', () => {
    const LOGO = `logo/${'0123456789abcdef'.repeat(4)}.png`;
    const AUTRE = `logo/${'fedcba9876543210'.repeat(4)}.png`;
    const charge = chargeGarnie();
    charge.participants[0].logo = LOGO;
    charge.participants[1].logo = AUTRE;
    charge.participants[3].logo = LOGO;
    const remplacee = importer(charge, csv('nom;prenom', 'Ombrelle;Iris', 'Bruyère;Anouk'), 'remplacer');
    assert.deepEqual(remplacee.resume, resumeDe({ ajoutes: 2, retires: 4, reservationsRetirees: 4, logosRetires: 3 }));
    assert.ok(remplacee.charge.participants.every((participant) => !Object.hasOwn(participant, 'logo')));
    const miseAJour = importer(charge, csv('nom;prenom;notes', 'Ombrelle;Iris;au fond', 'Bruyère;Anouk;'), 'mettreAJour');
    assert.equal(miseAJour.resume.logosRetires, 0);
    assert.deepEqual(miseAJour.charge.participants.slice(0, 4).map(({ logo }) => logo ?? null), [LOGO, AUTRE, null, LOGO]);
    assert.equal(miseAJour.charge.participants[0].notes, 'au fond');
    const ajout = importer(charge, csv('nom', 'Bruyère'), 'ajouter');
    assert.equal(ajout.resume.logosRetires, 0);
    assert.deepEqual(ajout.charge.participants.map(({ logo }) => logo ?? null), [LOGO, AUTRE, null, LOGO, null]);
    // Sans logo dans la charge, remplacer n'en compte aucun.
    assert.equal(importer(chargeGarnie(), csv('nom', 'Bruyère'), 'remplacer').resume.logosRetires, 0);
  });

  test('bilanRemplacement ne modifie pas la charge', () => {
    const charge = chargeGarnie();
    const avant = structuredClone(charge);
    bilanRemplacement(charge);
    assert.deepEqual(charge, avant);
  });
});

describe('appliquerImport : la charge rendue', () => {
  test("la charge et l'aperçu reçus ne sont pas modifiés, et la charge rendue n'en partage aucun objet", () => {
    for (const mode of MODES) {
      const charge = chargeGarnie();
      const apercu = apercevoir(csv('nom;prenom;courriel;exclu', 'Ombrelle;Iris;neuf@exemple.test;', 'Pervenche;;;peut-être', 'Bruyère;Anouk;;'), {
        participants: charge.participants,
        mode,
      });
      const avant = structuredClone({ charge, apercu });
      const resultat = appliquerImport(charge, apercu, mode);
      assert.deepEqual({ charge, apercu }, avant, mode);
      const recus = objetsDe({ charge, apercu });
      for (const objet of objetsDe(resultat)) assert.ok(!recus.has(objet), `${mode} : objet partagé ${JSON.stringify(objet)}`);
    }
  });

  test("les propositions figées de la charge reçue passent telles quelles dans la charge rendue, qui n'en partage rien d'autre, et la reçue s'écrit comme avant", () => {
    for (const mode of MODES) {
      const charge = gelerPropositions(chargeGarnie());
      const apercu = apercevoir(csv('nom;prenom;courriel', 'Ombrelle;Iris;neuf@exemple.test', 'Bruyère;Anouk;'), {
        participants: charge.participants,
        mode,
      });
      const texte = JSON.stringify(charge);
      const { charge: rendue } = appliquerImport(charge, apercu, mode);
      assert.notEqual(rendue.propositions, charge.propositions, mode);
      assert.equal(rendue.propositions.length, charge.propositions.length, mode);
      charge.propositions.forEach((p, rang) => assert.equal(rendue.propositions[rang], p, `${mode} : proposition ${p.id} recopiée`));
      assert.equal(JSON.stringify(charge), texte, mode);
      const recus = objetsDe(charge);
      for (const objet of objetsDe(rendue)) {
        if (!estFigee(objet)) assert.ok(!recus.has(objet), `${mode} : objet partagé ${JSON.stringify(objet)}`);
      }
    }
  });

  test("la charge rendue s'écrit et se relit : l'analyse du stockage l'admet, comptes et références compris", () => {
    for (const mode of MODES) {
      const { charge: apres } = importer(chargeGarnie(), csv('nom;prenom;exclu', 'Ombrelle;Iris;oui', 'Bruyère;Anouk;'), mode);
      const relue = analyser(serialiser(apres, { revision: 2, produitVersion: VERSION.affichee })).charge;
      assert.deepEqual(relue.participants, apres.participants, mode);
      assert.equal(relue.prochainsIds.participant, apres.prochainsIds.participant, mode);
    }
  });
});

describe("appliquerImport : selon l'état du plan (§ 9, § 10.1)", () => {
  test('brouillon et proposé : appliqué, sans avertissement de dérive', () => {
    for (const etat of ['brouillon', 'propose']) {
      for (const mode of MODES) {
        const { charge: apres, resume } = importer(chargeGarnie({ etat }), csv('nom', 'Bruyère'), mode);
        assert.equal(resume.derive, false, `${etat} ${mode}`);
        assert.equal(apres.participants.at(-1).nom, 'Bruyère', `${etat} ${mode}`);
      }
    }
  });

  test("retenu : appliqué, avec l'avertissement de dérive", () => {
    for (const mode of MODES) {
      const { charge: apres, resume } = importer(chargeGarnie({ etat: 'retenu' }), csv('nom', 'Bruyère'), mode);
      assert.equal(resume.derive, true, mode);
      assert.equal(apres.participants.at(-1).nom, 'Bruyère', mode);
      assert.equal(apres.evenement.etat, 'retenu', mode);
    }
  });

  test("bloqué : refusé PLAN_BLOQUE dans chaque mode, avant tout autre refus, et rien n'est rendu", () => {
    for (const mode of MODES) {
      const charge = chargeGarnie({ etat: 'bloque' });
      const avant = structuredClone(charge);
      assert.throws(() => importer(charge, csv('nom', 'Bruyère'), mode), refus('PLAN_BLOQUE', {}), mode);
      assert.throws(() => importer(charge, csv('nom;exclu', 'Bruyère;peut-être'), mode), refus('PLAN_BLOQUE', {}), mode);
      assert.deepEqual(charge, avant, mode);
    }
  });
});

describe("appliquerImport : la colonne des conflits d'organisation (§ 10.1)", () => {
  test('une personne créée porte ses conflits rangés par unités de code, en dernière clé, sous la graphie de l\u{2019}événement ; sans conflit, la clé est absente', () => {
    const charge = chargeDe({ participants: [personne(1, 'Houle', null, 'Club des Merles')] });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;organisation;presence;conflit_organisation', 'Ombrelle;;1;Société Alpha | club des merles', 'Pervenche;Société Alpha;;', 'Lacasse;;;'),
      'ajouter',
    );
    assert.deepEqual(apres.participants.slice(1), [
      personne(2, 'Ombrelle', null, null, { presence: [1], conflits: ['Club des Merles', 'Société Alpha'] }),
      personne(3, 'Pervenche', null, 'Société Alpha'),
      personne(4, 'Lacasse'),
    ]);
    assert.equal(Object.keys(apres.participants[1]).at(-1), 'conflits');
    assert.ok(!Object.hasOwn(apres.participants[3], 'conflits'));
    assert.equal(resume.ajoutes, 3);
    assert.deepEqual(analyser(serialiser(apres, { revision: 1, produitVersion: VERSION.affichee })).charge, apres);
  });

  test('en mise à jour, une cellule non vide remplace la liste, une cellule vide la garde ; la même liste ne compte pas la personne modifiée', () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Ombrelle', 'Iris', null, { conflits: ['Club des Merles'] }),
        personne(2, 'Pervenche', 'Théo', null, { conflits: ['Société Alpha'] }),
        personne(3, 'Lacasse', 'Ondine', null, { conflits: ['Club des Merles', 'Société Alpha'] }),
        personne(4, 'Houle', null, 'Club des Merles'),
        personne(5, 'Galet', null, 'Société Alpha'),
      ],
    });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;prenom;conflits', 'Ombrelle;Iris;société alpha', 'Pervenche;Théo;', 'Lacasse;Ondine;"Société Alpha ; Club des Merles"'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants.slice(0, 3).map(({ conflits }) => conflits), [
      ['Société Alpha'],
      ['Société Alpha'],
      ['Club des Merles', 'Société Alpha'],
    ]);
    assert.deepEqual([resume.misAJour, resume.inchanges], [1, 2]);
  });

  test("un aperçu refusé pour un conflit refuse l'import : son code, son rang et l'organisation dans les détails ; la charge reste", () => {
    for (const mode of MODES) {
      const charge = chargeDe({ participants: [personne(1, 'Houle', null, 'Club des Merles')] });
      const avant = structuredClone(charge);
      assert.throws(
        () => importer(charge, csv('nom;organisation;conflits', 'Ombrelle;;Société Gamma'), mode),
        refus('CONFLIT_ORGANISATION_INCONNUE', { ligne: 2, organisation: 'Société Gamma' }),
        mode,
      );
      assert.throws(
        () => importer(charge, csv('nom;organisation;conflits', 'Ombrelle;Atelier Ressac;ATELIER RESSAC'), mode),
        refus('CONFLIT_ORGANISATION_PROPRE', { ligne: 2, organisation: 'ATELIER RESSAC' }),
        mode,
      );
      assert.deepEqual(charge, avant, mode);
    }
  });
});

describe('appliquerImport : la marque du nom numéroté (§ 8.9, § 10.1)', () => {
  // Aperçu du texte dans le mode, ses doublons rendus uniques comme le fait
  // « Rendre les noms uniques », puis import dans ce même mode.
  function importerRendu(charge, texte, mode) {
    const options = { participants: charge.participants, tables: charge.tables, mode, tours: charge.evenement.tours };
    const apercu = apercevoir(texte, options);
    return appliquerImport(charge, apercevoir(texte, { ...options, noms: rendreNomsUniques(apercu, charge.participants) }), mode);
  }
  const relue = (charge) => analyser(serialiser(charge, { revision: 1, produitVersion: VERSION.affichee })).charge;
  const DOUBLONS = csv('nom;prenom', 'Galet;Roger', 'Galet;Roger');

  test('ajouter : chaque personne créée d’une ligne renommée porte la marque, en dernière clé ; les autres non', () => {
    const charge = chargeDe({ participants: [personne(1, 'Galet', 'Roger')] });
    const { charge: apres, resume } = importerRendu(charge, csv('nom;prenom', 'Galet;Roger', 'Houle;Iris', 'Galet;Roger'), 'ajouter');
    assert.deepEqual(apres.participants, [
      personne(1, 'Galet', 'Roger'),
      personne(2, 'Galet 01', 'Roger', null, { nomNumerote: true }),
      personne(3, 'Houle', 'Iris'),
      personne(4, 'Galet 02', 'Roger', null, { nomNumerote: true }),
    ]);
    assert.equal(Object.keys(apres.participants[1]).at(-1), 'nomNumerote');
    assert.deepEqual(resume, resumeDe({ ajoutes: 3 }));
    assert.deepEqual(relue(apres), apres);
  });

  test('mettre à jour : la ligne ajoutée sous un nom rendu porte la marque ; la personne mise à jour ne la reçoit ni ne la perd', () => {
    const charge = chargeDe({
      participants: [personne(1, 'Galet', 'Roger'), personne(2, 'Houle 01', 'Iris', null, { nomNumerote: true })],
    });
    const texte = csv('nom;prenom;courriel', 'Galet;Roger;roger@exemple.test', 'Galet;Roger;', 'HOULE 01;Iris;iris@exemple.test');
    const { charge: apres, resume } = importerRendu(charge, texte, 'mettreAJour');
    assert.deepEqual(apres.participants, [
      personne(1, 'Galet', 'Roger', null, { courriel: 'roger@exemple.test' }),
      personne(2, 'HOULE 01', 'Iris', null, { courriel: 'iris@exemple.test', nomNumerote: true }),
      personne(3, 'Galet 01', 'Roger', null, { nomNumerote: true }),
    ]);
    assert.deepEqual(resume, resumeDe({ ajoutes: 1, misAJour: 2 }));
    assert.deepEqual(relue(apres), apres);
  });

  test('mettre à jour : un nom posé qui ne finit plus par une espace et un numéro fait tomber la marque, et le fichier reste lisible', () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Houle 01', 'Iris', null, { nomNumerote: true }),
        personne(2, 'Galet 02', 'Roger', null, { nomNumerote: true }),
      ],
    });
    const texte = csv('nom;prenom', 'Houle\u{A0}01;Iris', 'Galet 0\u{301}2;Roger');
    const { charge: apres, resume } = importer(charge, texte, 'mettreAJour');
    assert.deepEqual(apres.participants, [personne(1, 'Houle\u{A0}01', 'Iris'), personne(2, 'Galet 0\u{301}2', 'Roger')]);
    assert.deepEqual(resume, resumeDe({ misAJour: 2 }));
    assert.deepEqual(relue(apres), apres);
  });

  test('remplacer : la marque d’une personne retirée part avec elle ; la ligne renommée la porte', () => {
    const charge = chargeDe({ participants: [personne(1, 'Galet 01', 'Roger', null, { nomNumerote: true })] });
    const { charge: apres, resume } = importerRendu(charge, DOUBLONS, 'remplacer');
    assert.deepEqual(apres.participants, [
      personne(2, 'Galet', 'Roger'),
      personne(3, 'Galet 01', 'Roger', null, { nomNumerote: true }),
    ]);
    assert.deepEqual(resume, resumeDe({ ajoutes: 2, retires: 1 }));
    assert.deepEqual(relue(apres), apres);
  });

  test('dans chaque mode, un nom qui finit par un numéro dans sa cellule ne porte pas la marque', () => {
    for (const mode of MODES) {
      const { charge: apres } = importer(chargeDe(), csv('nom;prenom', 'Galet 01;Roger', 'Galet 02;Lise'), mode);
      assert.deepEqual(apres.participants.map((participant) => Object.hasOwn(participant, 'nomNumerote')), [false, false], mode);
    }
  });
});

describe('appliquerImport : les refus globaux (§ 10.1)', () => {
  test("le refus global de l'aperçu, son rang dans les détails", () => {
    const charge = chargeDe();
    assert.throws(() => importer(charge, csv('nom;exclu', 'Ombrelle;peut-être'), 'ajouter'), refus('AUCUNE_LIGNE_VALIDE', { ligne: null }));
    assert.throws(() => importer(charge, csv('prenom;courriel', 'Iris;'), 'ajouter'), refus('NOM_NON_ASSOCIE', { ligne: null }));
    assert.throws(
      () => importer(charge, csv('nom;notes', 'Ombrelle;"arrive tard', 'Pervenche;'), 'ajouter'),
      refus('GUILLEMET_OUVERT', { ligne: 2 }),
    );
    assert.throws(
      () => importer(charge, csv('nom;notes', 'Ombrelle;arrive tard;vers 20 h', 'Pervenche;'), 'ajouter'),
      refus('SEPARATEUR_INTROUVABLE', { ligne: 2 }),
    );
  });

  test('une ambiguïté qui reste refuse : AMBIGUITE, ses champs nommés ; le choix la lève', () => {
    const texte = csv('nom;organisation;entreprise', 'Ombrelle;Club des Merles;Société Alpha');
    for (const mode of MODES) {
      assert.throws(() => importer(chargeDe(), texte, mode), refus('AMBIGUITE', { champs: ['organisation'] }), mode);
    }
    const { charge: apres } = importer(chargeDe(), texte, 'ajouter', { organisation: 2 });
    assert.deepEqual(apres.participants, [personne(1, 'Ombrelle', null, 'Société Alpha')]);
  });

  test("le refus global de l'aperçu passe avant une ambiguïté : deux colonnes nom refusent NOM_NON_ASSOCIE", () => {
    assert.throws(
      () => importer(chargeDe(), csv('nom;nom;organisation;entreprise', 'Ombrelle;Iris;Club des Merles;Alpha'), 'ajouter'),
      refus('NOM_NON_ASSOCIE', { ligne: null }),
    );
    assert.throws(
      () => importer(chargeDe(), csv('nom;organisation;entreprise', 'Ombrelle;"Club;', 'Pervenche;;'), 'ajouter'),
      refus('GUILLEMET_OUVERT', { ligne: 2 }),
    );
  });

  test("un aperçu calculé pour un autre mode lève TypeError : l'aperçu montré est celui que l'import applique", () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris', 'Club des Merles')] });
    const texte = csv('nom;prenom;organisation', 'Ombrelle;Iris;club des merles');
    for (const vu of MODES) {
      const apercu = apercevoir(texte, { participants: charge.participants, mode: vu });
      for (const mode of MODES.filter((autre) => autre !== vu)) {
        assert.throws(() => appliquerImport(charge, apercu, mode), {
          name: 'TypeError',
          message: `aperçu calculé pour ${vu}, import en ${mode}`,
        });
      }
    }
  });

  test("remplacer pose l'orthographe du fichier, non celle d'un participant retiré : l'aperçu et l'import s'accordent", () => {
    const charge = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris', 'Club des Merles')], prochain: 2 });
    const texte = csv('nom;prenom;organisation', 'Ombrelle;Iris;club des merles');
    const apercu = apercevoir(texte, { participants: charge.participants, mode: 'remplacer' });
    assert.deepEqual(apercu.doublons, []);
    const { charge: apres } = appliquerImport(charge, apercu, 'remplacer');
    assert.deepEqual(apres.participants, [personne(2, 'Ombrelle', 'Iris', 'club des merles')]);
  });

  test("un compteur qui ne suffit pas aux personnes créées refuse l'import entier, COMPTEUR_SATURE, après l'ambiguïté ; 2^31 − 2, le dernier identifiant, s'attribue, et la charge rendue se relit", () => {
    const DERNIER = 2 ** 31 - 2;
    const SATURE = refus('COMPTEUR_SATURE', { compteur: 'participant' });
    for (const mode of MODES) {
      const charge = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris')], prochain: DERNIER });
      const { charge: apres, resume } = importer(charge, csv('nom', 'Bruyère'), mode);
      assert.equal(resume.ajoutes, 1, mode);
      assert.equal(apres.participants.at(-1).id, DERNIER, mode);
      assert.equal(apres.prochainsIds.participant, DERNIER + 1, mode);
      const relue = analyser(serialiser(apres, { revision: 2, produitVersion: VERSION.affichee })).charge;
      assert.deepEqual(relue.participants, apres.participants, mode);
      const avant = structuredClone(charge);
      assert.throws(() => importer(charge, csv('nom', 'Bruyère', 'Lacasse'), mode), SATURE, mode);
      assert.deepEqual(charge, avant, mode);
      const saturee = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris')], prochain: DERNIER + 1 });
      assert.throws(() => importer(saturee, csv('nom', 'Bruyère'), mode), SATURE, mode);
      const ambigu = csv('nom;organisation;entreprise', 'Bruyère;Club des Merles;Société Alpha');
      assert.throws(() => importer(saturee, ambigu, mode), refus('AMBIGUITE', { champs: ['organisation'] }), mode);
    }
    // En mise à jour, seule une ligne qui ne désigne personne demande un
    // identifiant : sous un compteur saturé, la personne désignée change.
    const saturee = chargeDe({ participants: [personne(1, 'Ombrelle', 'Iris')], prochain: DERNIER + 1 });
    const { charge: apres, resume } = importer(saturee, csv('nom;prenom;notes', 'Ombrelle;Iris;au fond'), 'mettreAJour');
    assert.deepEqual(resume, resumeDe({ misAJour: 1 }));
    assert.equal(apres.participants[0].notes, 'au fond');
    assert.throws(() => importer(saturee, csv('nom;prenom', 'Ombrelle;Iris', 'Bruyère;Anouk'), 'mettreAJour'), SATURE);
  });

  test('un mode inconnu lève TypeError', () => {
    const apercu = apercevoir(csv('nom', 'Ombrelle'));
    for (const mode of ['fusionner', 'Ajouter', undefined, null]) {
      assert.throws(() => appliquerImport(chargeDe(), apercu, mode), TypeError, String(mode));
    }
  });
});

describe('exporterRefus : la boucle des refus (§ 10.1, § 14.10)', () => {
  // Un exclu inconnu à la ligne 7, au milieu de lignes valides.
  const FICHIER = csv(
    'nom;prenom;organisation;exclu',
    'Ombrelle;Iris;Club des Merles;non',
    'Pervenche;Théo;;',
    'Sarcelle;Ondine;Chorale du Givre;oui',
    'Bruyère;Anouk;;',
    'Grisaille;Silas;Club des Merles;',
    'Lacasse;Perrine;Société Alpha;peut-être',
    'Ardillon;Maëlle;;non',
  );

  // Le premier import et son CSV des refus.
  function premierImport() {
    const charge = chargeDe();
    const apercu = apercevoir(decoder(enUtf8(FICHIER)).texte, { participants: charge.participants });
    const { charge: apres, resume } = appliquerImport(charge, apercu, 'ajouter');
    return { apres, resume, refusees: exporterRefus(apercu, MOTIF, resume.refusees) };
  }

  test("un exclu inconnu à la ligne 7 revient dans le CSV des refus avec ligne 7 et son motif ; corrigé, le fichier se réimporte tel quel et la ligne entre", () => {
    const { apres, resume, refusees } = premierImport();
    assert.equal(resume.ajoutes, 6);
    assert.deepEqual(resume.refusees.map(({ ligne, code, valeur }) => [ligne, code, valeur]), [[7, 'EXCLU_INCONNU', 'peut-être']]);

    const { texte, encodage } = decoder(refusees);
    assert.equal(encodage, 'utf-8-bom');
    assert.equal(
      texte,
      csv(
        'nom;prenom;organisation;exclu;ligne;motif',
        'Lacasse;Perrine;Société Alpha;peut-être;7;"EXCLU_INCONNU {""ligne"":7,""valeur"":""peut-être""}"',
      ),
    );

    // L'opérateur corrige le champ dans ce fichier, et le réimporte tel quel.
    const corrige = enUtf8(texte.replace(';peut-être;7;', ';oui;7;'));
    const apercu = apercevoir(decoder(corrige).texte, { participants: apres.participants });
    assert.deepEqual(apercu.association.nonReconnues, [4, 5]);
    assert.deepEqual(apercu.refusees, []);
    const fin = appliquerImport(apres, apercu, 'ajouter');
    assert.deepEqual(fin.resume, resumeDe({ ajoutes: 1 }));
    assert.deepEqual(fin.charge.participants.at(-1), personne(7, 'Lacasse', 'Perrine', 'Société Alpha', { exclu: true }));
  });

  test('réimporté sans correction, le CSV des refus refuse la même ligne pour le même motif, et son propre CSV des refus garde les deux rangs', () => {
    const { apres, refusees } = premierImport();
    const apercu = apercevoir(decoder(refusees).texte, { participants: apres.participants });
    assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE');
    assert.deepEqual(apercu.refusees.map(({ ligne, code, valeur }) => [ligne, code, valeur]), [[2, 'EXCLU_INCONNU', 'peut-être']]);
    const { texte } = decoder(exporterRefus(apercu, MOTIF));
    assert.deepEqual(decouper(texte, ';').enregistrements.map((enregistrement) => enregistrement.slice(4)), [
      ['ligne', 'motif', 'ligne', 'motif'],
      ['7', 'EXCLU_INCONNU {"ligne":7,"valeur":"peut-être"}', '2', 'EXCLU_INCONNU {"ligne":2,"valeur":"peut-être"}'],
    ]);
  });
});

describe('exporterRefus : la forme du CSV des refus (§ 10.1)', () => {
  test("UTF-8 avec marque, CRLF, les en-têtes d'origine tels qu'écrits, puis ligne et motif", () => {
    const apercu = apercevoir(csv(' Nom ;Prénom;Équipe;Exclu', 'Ombrelle;Iris;Club des Merles;peut-être', 'Pervenche;Théo;;non'));
    const octets = exporterRefus(apercu, MOTIF);
    assert.ok(octets instanceof Uint8Array);
    assert.deepEqual([...octets.subarray(0, 3)], [0xef, 0xbb, 0xbf]);
    assert.equal(
      new TextDecoder('utf-8', { ignoreBOM: true }).decode(octets),
      MARQUE +
        csv(
          ' Nom ;Prénom;Équipe;Exclu;ligne;motif',
          'Ombrelle;Iris;Club des Merles;peut-être;2;"EXCLU_INCONNU {""ligne"":2,""valeur"":""peut-être""}"',
        ),
    );
  });

  test("le séparateur d'origine : la virgule, la tabulation", () => {
    const virgule = apercevoir(csv('nom,prenom,exclu', 'Ombrelle,Iris,peut-être', 'Pervenche,Théo,non'));
    assert.equal(
      decoder(exporterRefus(virgule, MOTIF)).texte,
      csv('nom,prenom,exclu,ligne,motif', 'Ombrelle,Iris,peut-être,2,"EXCLU_INCONNU {""ligne"":2,""valeur"":""peut-être""}"'),
    );
    const tabulation = apercevoir(csv('nom\tprenom\texclu', 'Ombrelle\tIris\tpeut-être', 'Pervenche\tThéo\tnon'));
    assert.equal(
      decoder(exporterRefus(tabulation, MOTIF)).texte,
      csv('nom\tprenom\texclu\tligne\tmotif', 'Ombrelle\tIris\tpeut-être\t2\t"EXCLU_INCONNU {""ligne"":2,""valeur"":""peut-être""}"'),
    );
  });

  test("un fichier à une colonne, sans séparateur établi : le CSV des refus prend « ; », et se relit à trois colonnes", () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Ombrelle', null, 'Club des Merles'),
        personne(2, 'Ombrelle', null, 'Chorale du Givre'),
        personne(3, 'Pervenche'),
      ],
    });
    const apercu = apercevoir(csv('nom', 'Ombrelle', 'Pervenche'), { participants: charge.participants, mode: 'mettreAJour' });
    assert.equal(apercu.separateur, null);
    const { resume } = appliquerImport(charge, apercu, 'mettreAJour');
    const { texte } = decoder(exporterRefus(apercu, MOTIF, resume.refusees));
    assert.equal(
      texte,
      csv('nom;ligne;motif', 'Ombrelle;2;"PLUSIEURS_CORRESPONDENT {""ligne"":2,""valeur"":null,""participants"":[1,2]}"'),
    );
    const relu = apercevoir(texte);
    assert.equal(relu.separateur, ';');
    assert.deepEqual(relu.lignes.map(({ champs }) => champs.nom), ['Ombrelle']);
  });

  test('un champ qui porte le séparateur, un guillemet ou une fin de ligne s\'écrit cité : chaque cellule se relit telle que découpée', () => {
    const apercu = apercevoir(csv(
      'nom;prenom;notes;exclu',
      '"Ombrelle ""dite Iris""";Iris;"premier ; second',
      'troisième";peut-être',
      'Pervenche;Théo;;non',
    ));
    const { brut } = apercu.refusees[0];
    assert.deepEqual(brut, ['Ombrelle "dite Iris"', 'Iris', 'premier ; second\r\ntroisième', 'peut-être']);
    const { enregistrements } = decouper(decoder(exporterRefus(apercu, MOTIF)).texte, ';');
    assert.deepEqual(enregistrements[1], [...brut, '2', MOTIF('EXCLU_INCONNU', { ligne: 2, valeur: 'peut-être' })]);
  });

  test("une ligne trop courte se complète de cellules vides, des cellules blanches au-delà de l'en-tête ne s'écrivent pas : ligne et motif restent sous leur en-tête", () => {
    const apercu = apercevoir(csv(
      'nom;prenom;notes',
      ...REMPLISSAGE.map((nom) => `${nom};;`),
      ';Théo',
      '   ;Anouk;;; ',
    ));
    assert.deepEqual(apercu.refusees.map(({ ligne, code, brut }) => [ligne, code, brut]), [
      [21, 'NOM_ABSENT', ['', 'Théo']],
      [22, 'NOM_ABSENT', ['   ', 'Anouk', '', '', ' ']],
    ]);
    assert.equal(
      decoder(exporterRefus(apercu, MOTIF)).texte,
      csv(
        'nom;prenom;notes;ligne;motif',
        ';Théo;;21;"NOM_ABSENT {""ligne"":21,""valeur"":null}"',
        '   ;Anouk;;22;"NOM_ABSENT {""ligne"":22,""valeur"":null}"',
      ),
    );
  });

  test("une ligne aux champs en trop garde ses cellules au-delà de ligne et motif : réimporté sans correction, le CSV ne fait entrer aucune ligne décalée ; corrigé, il se réimporte", () => {
    const apercu = apercevoir(csv('nom;prenom;notes', ...REMPLISSAGE.map((nom) => `${nom};;`), 'Ombrelle;Iris;arrive tard;vers 20 h'));
    assert.deepEqual(apercu.refusees.map(({ ligne, code }) => [ligne, code]), [[21, 'CHAMPS_EN_TROP']]);
    const { texte } = decoder(exporterRefus(apercu, MOTIF));
    assert.equal(
      texte,
      csv('nom;prenom;notes;ligne;motif', 'Ombrelle;Iris;arrive tard;21;"CHAMPS_EN_TROP {""ligne"":21,""valeur"":null}";vers 20 h'),
    );

    const charge = chargeDe();
    assert.throws(() => importer(charge, texte, 'ajouter'), refus('SEPARATEUR_INTROUVABLE', { ligne: 2 }));

    const corrige = texte.replace('arrive tard;21;', 'arrive tard, vers 20 h;21;').replace(';vers 20 h\r\n', '\r\n');
    const { charge: apres } = importer(charge, corrige, 'ajouter');
    assert.deepEqual(apres.participants, [personne(1, 'Ombrelle', 'Iris', null, { notes: 'arrive tard, vers 20 h' })]);
  });

  test("réimporté sans correction, le CSV des refus ne fait entrer aucune ligne : chacune est refusée de nouveau pour le même motif, champs en trop compris au-delà de la fenêtre", () => {
    // Dix-neuf noms absents, puis des champs en trop et un exclu inconnu :
    // dans le CSV des refus, la ligne aux champs en trop tombe au rang 21,
    // hors de la fenêtre du séparateur.
    const apercu = apercevoir(csv(
      'nom;prenom;exclu',
      ...REMPLISSAGE.map((nom) => `${nom};;`),
      ...REMPLISSAGE.map((prenom) => `;${prenom};`),
      'Ombrelle;Iris;non;en trop',
      'Pervenche;Théo;peut-être',
    ));
    const codes = (refusees) => refusees.map(({ code, valeur }) => [code, valeur]);
    assert.deepEqual(codes(apercu.refusees), [
      ...REMPLISSAGE.map(() => ['NOM_ABSENT', null]), ['CHAMPS_EN_TROP', null], ['EXCLU_INCONNU', 'peut-être'],
    ]);
    const relu = apercevoir(decoder(exporterRefus(apercu, MOTIF)).texte);
    assert.equal(relu.separateur, ';');
    assert.equal(relu.refusGlobal, 'AUCUNE_LIGNE_VALIDE');
    assert.deepEqual(codes(relu.refusees), codes(apercu.refusees));
    assert.deepEqual(relu.refusees.map(({ ligne }) => ligne).slice(-2), [21, 22]);
  });

  test("les refus de l'application, passés en troisième argument, entrent dans le CSV avec ceux de l'aperçu, rangés par ligne", () => {
    const charge = chargeDe({
      participants: [
        personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
        personne(2, 'Ombrelle', 'Iris', 'Chorale du Givre'),
        personne(3, 'Pervenche', 'Théo'),
      ],
    });
    const apercu = apercevoir(
      csv(
        'nom;prenom;courriel;exclu',
        'Ombrelle;Iris;iris@exemple.test;',
        'Pervenche;Théo;theo@exemple.test;',
        ';Anouk;;',
        'pervenche;theo;autre@exemple.test;',
        'Sarcelle;Ondine;;peut-être',
      ),
      { participants: charge.participants, mode: 'mettreAJour' },
    );
    const { resume } = appliquerImport(charge, apercu, 'mettreAJour');
    assert.deepEqual(resume.refusees.map(({ ligne, code }) => [ligne, code]), [
      [2, 'PLUSIEURS_CORRESPONDENT'], [4, 'NOM_ABSENT'], [5, 'DEJA_DESIGNE'], [6, 'EXCLU_INCONNU'],
    ]);
    assert.deepEqual(resume, resumeDe({ misAJour: 1, refusees: resume.refusees }));
    assert.equal(
      decoder(exporterRefus(apercu, MOTIF, resume.refusees)).texte,
      csv(
        'nom;prenom;courriel;exclu;ligne;motif',
        'Ombrelle;Iris;iris@exemple.test;;2;"PLUSIEURS_CORRESPONDENT {""ligne"":2,""valeur"":null,""participants"":[1,2]}"',
        ';Anouk;;;4;"NOM_ABSENT {""ligne"":4,""valeur"":null}"',
        'pervenche;theo;autre@exemple.test;;5;"DEJA_DESIGNE {""ligne"":5,""valeur"":null,""participants"":[3],""premiereLigne"":3}"',
        'Sarcelle;Ondine;;peut-être;6;"EXCLU_INCONNU {""ligne"":6,""valeur"":""peut-être""}"',
      ),
    );
    assert.deepEqual(
      exporterRefus(apercu, MOTIF, [...resume.refusees].reverse()),
      exporterRefus(apercu, MOTIF, resume.refusees),
    );
  });

  test("les lignes refusées d'un aperçu sans ligne valide s'exportent depuis l'aperçu seul", () => {
    const apercu = apercevoir(csv('nom;exclu', 'Ombrelle;peut-être', ';non'));
    assert.equal(apercu.refusGlobal, 'AUCUNE_LIGNE_VALIDE');
    assert.equal(
      decoder(exporterRefus(apercu, MOTIF)).texte,
      csv(
        'nom;exclu;ligne;motif',
        'Ombrelle;peut-être;2;"EXCLU_INCONNU {""ligne"":2,""valeur"":""peut-être""}"',
        ';non;3;"NOM_ABSENT {""ligne"":3,""valeur"":null}"',
      ),
    );
  });

  test("motif reçoit le code et les détails de chaque refus ; un motif qui ne rend pas une chaîne lève TypeError", () => {
    const apercu = apercevoir(csv('nom;exclu', 'Ombrelle;peut-être', ';non', 'Pervenche;'));
    const appels = [];
    exporterRefus(apercu, (code, details) => {
      appels.push([code, details]);
      return code;
    });
    assert.deepEqual(appels, [
      ['EXCLU_INCONNU', { ligne: 2, valeur: 'peut-être' }],
      ['NOM_ABSENT', { ligne: 3, valeur: null }],
    ]);
    for (const [rendu, recu] of [[undefined, 'undefined'], [7, '7'], [['a'], '["a"]']]) {
      assert.throws(() => exporterRefus(apercu, () => rendu), {
        name: 'TypeError',
        message: `motif de EXCLU_INCONNU : chaîne attendue, reçu ${recu}`,
      });
    }
  });

  test("un fichier en windows-1252 ou en UTF-16 : le CSV des refus s'écrit en UTF-8 avec marque, ses accents intacts", () => {
    const texte = csv('nom;prenom;exclu', 'Pervenche;Théo;peut-être', 'Ombrelle;Iris;non');
    const attendu = csv('nom;prenom;exclu;ligne;motif', 'Pervenche;Théo;peut-être;2;"EXCLU_INCONNU {""ligne"":2,""valeur"":""peut-être""}"');
    for (const [octets, encodageLu] of [[enWindows1252(texte), 'windows-1252'], [enUtf16le(texte), 'utf-16le']]) {
      const lu = decoder(octets);
      assert.equal(lu.encodage, encodageLu);
      const refusees = decoder(exporterRefus(apercevoir(lu.texte), MOTIF));
      assert.deepEqual(refusees, { texte: attendu, encodage: 'utf-8-bom' }, encodageLu);
    }
  });
});

describe('appliquerImport : la colonne de la présence (§ 10.1)', () => {
  test('une personne créée porte sa présence canonique, après ses étiquettes ; une cellule vide ou qui nomme chaque tour laisse le champ absent', () => {
    const { charge: apres, resume } = importer(
      chargeDe({ tours: 4 }),
      csv('nom;etiquettes;presence', 'Ombrelle;finance;"3, 1, 3"', 'Pervenche;;', 'Lacasse;;tous', 'Sarcelle;;1-4', 'Bruyère;;tours 2 à 4'),
      'ajouter',
    );
    assert.equal(resume.ajoutes, 5);
    assert.deepEqual(apres.participants.map(({ nom, presence }) => [nom, presence]), [
      ['Ombrelle', [1, 3]], ['Pervenche', undefined], ['Lacasse', undefined], ['Sarcelle', undefined], ['Bruyère', [2, 3, 4]],
    ]);
    assert.deepEqual(Object.keys(apres.participants[0]).slice(-2), ['etiquettes', 'presence']);
    for (const participant of apres.participants.slice(1, 4)) assert.ok(!Object.hasOwn(participant, 'presence'), participant.nom);
  });

  test('en mise à jour : une cellule non vide remplace, une cellule vide garde, « tous » retire le champ', () => {
    const charge = chargeDe({
      tours: 4,
      participants: [
        personne(1, 'Ombrelle', 'Iris', null, { presence: [1, 2] }),
        personne(2, 'Pervenche', 'Théo', null, { presence: [3] }),
        personne(3, 'Lacasse', 'Ondine', null, { presence: [2, 4] }),
        personne(4, 'Sarcelle', null, null),
        personne(5, 'Bruyère', 'Anouk', null, { presence: [1, 2] }),
      ],
    });
    const { charge: apres, resume } = importer(
      charge,
      csv('nom;presence', 'Ombrelle;2-4', 'Pervenche;', 'Lacasse;Tous', 'Sarcelle;1', 'Bruyère;"3, 4"'),
      'mettreAJour',
    );
    assert.deepEqual(apres.participants.map(({ presence }) => presence), [[2, 3, 4], [3], undefined, [1], [3, 4]]);
    assert.ok(!Object.hasOwn(apres.participants[2], 'presence'));
    assert.deepEqual(resume, resumeDe({ misAJour: 4, inchanges: 1 }), 'une présence de même longueur, aux tours autres, compte un modifié');
  });

  test('la comparaison se fait sur la forme canonique : un export réimporté, ou la même présence écrite autrement, ne compte aucun modifié', () => {
    const charge = chargeDe({
      tours: 4,
      participants: [
        personne(1, 'Ombrelle', 'Iris', null, { presence: [1, 3] }),
        personne(2, 'Pervenche', 'Théo', null, { presence: [2, 3, 4] }),
        personne(3, 'Lacasse', 'Ondine'),
      ],
    });
    const exporte = decoder(exporterParticipants(charge.participants)).texte;
    assert.deepEqual(importer(charge, exporte, 'mettreAJour').resume, resumeDe({ inchanges: 3 }));
    const autrement = csv('nom;présence', 'Ombrelle;tours 3 et 1', 'Pervenche;2 à 4', 'Lacasse;1-4');
    const { charge: apres, resume } = importer(charge, autrement, 'mettreAJour');
    assert.deepEqual(resume, resumeDe({ inchanges: 3 }));
    assert.deepEqual(apres.participants, charge.participants);
  });

  test("un aperçu calculé pour un autre nombre de tours, la colonne associée : APERCU_TOURS_CHANGES, après PLAN_BLOQUE, avant le refus global de l'aperçu", () => {
    const charge = chargeDe({ tours: 2 });
    for (const mode of MODES) {
      const apercu = apercevoir(csv('nom;presence', 'Ombrelle;3'), { mode, tours: 4 });
      assert.throws(() => appliquerImport(charge, apercu, mode), refus('APERCU_TOURS_CHANGES', { tours: 2, toursApercu: 4 }), mode);
      const refuse = apercevoir(csv('nom;presence', ';3'), { mode, tours: 4 });
      assert.equal(refuse.refusGlobal, 'AUCUNE_LIGNE_VALIDE');
      assert.throws(() => appliquerImport(charge, refuse, mode), refus('APERCU_TOURS_CHANGES', { tours: 2, toursApercu: 4 }), mode);
      const bloquee = chargeDe({ tours: 2, etat: 'bloque' });
      assert.throws(() => appliquerImport(bloquee, apercu, mode), refus('PLAN_BLOQUE', {}), mode);
    }
  });

  test("sans colonne de présence, aucun refus pour un autre nombre de tours : l'aperçu par défaut s'applique", () => {
    const charge = chargeDe({ tours: 3 });
    for (const mode of MODES) {
      const apercu = apercevoir(csv('nom;prenom', 'Ombrelle;Iris'), { mode });
      assert.notEqual(apercu.tours, charge.evenement.tours);
      assert.equal(appliquerImport(charge, apercu, mode).resume.ajoutes, 1, mode);
    }
  });

  test('le CSV des refus reprend une ligne refusée pour sa présence, motif compris ; corrigée, elle se réimporte, sinon elle est refusée de nouveau', () => {
    const charge = chargeDe({ tours: 2 });
    const apercu = apercevoir(csv('nom;presence', 'Ombrelle;1', 'Pervenche;0-2', 'Lacasse;1/2'), { tours: 2 });
    const { charge: apres, resume } = appliquerImport(charge, apercu, 'ajouter');
    assert.deepEqual(resume.refusees.map(({ ligne, code }) => [ligne, code]), [[3, 'PRESENCE_HORS_TOURS'], [4, 'PRESENCE_ILLISIBLE']]);
    const { texte } = decoder(exporterRefus(apercu, MOTIF, resume.refusees));
    const { enregistrements } = decouper(texte, ';');
    assert.deepEqual(enregistrements[1].slice(0, 3), ['Pervenche', '0-2', '3']);
    assert.match(enregistrements[1][3], /^PRESENCE_HORS_TOURS .*"tour":0,"tours":2/);
    assert.match(enregistrements[2][3], /^PRESENCE_ILLISIBLE .*"raison":"date"/);

    const tel = apercevoir(texte, { participants: apres.participants, tours: 2 });
    assert.deepEqual(tel.refusees.map(({ code }) => code), ['PRESENCE_HORS_TOURS', 'PRESENCE_ILLISIBLE']);
    const corrige = texte.replace(';0-2;3;', ';2;3;').replace(';1/2;4;', ';1, 2;4;');
    const relu = apercevoir(corrige, { participants: apres.participants, tours: 2 });
    assert.deepEqual(relu.refusees, []);
    const fin = appliquerImport(apres, relu, 'ajouter');
    assert.deepEqual(fin.charge.participants.slice(-2).map(({ nom, presence }) => [nom, presence]), [['Pervenche', [2]], ['Lacasse', undefined]]);
  });

  test("la charge rendue, présences comprises, s'écrit et se relit : l'analyse du stockage l'admet", () => {
    const charge = chargeDe({ tours: 4, participants: [personne(1, 'Ombrelle', 'Iris', null, { presence: [4] })] });
    for (const mode of MODES) {
      const { charge: apres } = importer(charge, csv('nom;prenom;presence', 'Ombrelle;Iris;1-3', 'Bruyère;Anouk;2, 4'), mode);
      const relue = analyser(serialiser(apres, { revision: 2, produitVersion: VERSION.affichee })).charge;
      assert.deepEqual(relue.participants, apres.participants, mode);
      assert.ok(apres.participants.some(({ presence }) => presence !== undefined), mode);
    }
  });
});

describe('pourvoyeursDesTitres : seules pourvoient les personnes présentes (§ 4.1, § 4.4)', () => {
  // Le pourvoyeur de chaque titre, par identifiant : la soirée, puis chaque tour.
  const pourvoyeurs = (charge) =>
    pourvoyeursDesTitres(charge).map(({ soiree, tours }) => [soiree?.participant ?? null, tours.map((r) => r?.participant ?? null)]);

  test("une réservation ne pourvoit pas un tour d'absence ; une réservation « tous » d'une présence partielle ne pourvoit pas la soirée", () => {
    const charge = chargeDe({
      tours: 3,
      participants: [
        personne(1, 'Ombrelle', 'Iris', null, { presence: [1, 3] }),
        personne(2, 'Pervenche', 'Théo', null, { presence: [2] }),
        personne(3, 'Lacasse', 'Ondine'),
      ],
      tables: [table(1), table(2)],
      reservations: [reservation(1, 1, 1), reservation(2, 1, 1, 2), reservation(2, 2, 1, 3), reservation(3, 2, 2)],
      titres: [titre(1, 1), titre(2, 1), titre(2, 2)],
      attribuerSieges: true,
    });
    assert.deepEqual(pourvoyeurs(charge), [
      [null, [1, 2, 1]],
      [null, [null, null, null]],
      [3, [3, 3, 3]],
    ]);
    assert.equal(bilanRemplacement(charge).titresPourvus, 2);
  });

  test('en mode table, une présente pourvoit le titre que l’absente laisse à ce tour', () => {
    const charge = chargeDe({
      tours: 2,
      participants: [personne(1, 'Ombrelle', 'Iris', null, { presence: [2] }), personne(2, 'Pervenche', 'Théo')],
      tables: [table(1)],
      reservations: [reservation(1, 1, null), reservation(2, 1, null)],
      titres: [titre(1, 1)],
    });
    assert.deepEqual(pourvoyeurs(charge), [[2, [2, 1]]]);
  });

  test('sans présence, rien ne change : la soirée et chaque tour comme avant', () => {
    const charge = chargeDe({
      participants: [personne(1, 'Ombrelle', 'Iris'), personne(2, 'Pervenche', 'Théo')],
      tables: [table(1)],
      reservations: [reservation(1, 1, 1), reservation(2, 1, 2, 2)],
      titres: [titre(1, 1), titre(1, 2)],
      attribuerSieges: true,
    });
    assert.deepEqual(pourvoyeurs(charge), [[1, [1, 1]], [null, [null, 2]]]);
  });
});
