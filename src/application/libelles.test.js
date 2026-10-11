// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves de la table des libellés (§ 14.6, § 14.2). Le balayage relève, dans
// les sources de src/stockage, src/csv et src/application — épreuves et table
// exclues —, chaque code qu'elles émettent : le premier argument littéral d'un
// appel, constructeur d'erreur ou fabrique d'avertissement ; la valeur
// littérale d'une clé code ; celle d'une clé raison, cause ou remede, qui
// nomme un code de détail ; la valeur littérale d'une constante, qui nomme le
// code que le module émet par elle ; et les tables de codes des contrats,
// celle de src/stockage/types.js et celle de src/csv/erreurs.js quand il en
// porte une. Chaque code relevé a son texte, chaque texte a un émetteur, et
// un balayage vide échoue. Chaque texte se compose ensuite de détails
// d'exemple. Les noms d'épreuve sont inventés.
//
// La table se partage en fichiers, un par domaine, sous libelles/ : chacun
// exporte TABLE, une Map, et libelles.js les assemble par ordre alphabétique
// des fichiers ; les tables, comme l'assemblage, sont hors du balayage.
//
// src/moteur se relève à part, épreuves exclues : chaque littéral en
// capitales de ses sources, hors commentaires, y est un code — celui d'une
// ErreurConfiguration ou d'une violation de ses vérificateurs —, que le
// moteur lève par une constante ou par une expression autant que par un
// appel. Une seule exception, nommée : les valeurs de domine dans manque.js,
// qui disent laquelle de deux propositions sert le mieux et ne s'affichent
// pas comme un code.
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { CRITERES } from '../moteur/classement.js';
import { TABLES_INTERFACE } from '../interface/libelles.js';
import { creerTraduction } from './traduction.js';
import { CODES, TABLES_APPLICATION, libelle } from './libelles.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

// Les arbres balayés, et les fichiers qui portent une table de codes : le
// dépôt du plan lève un refus que la commande n'a pas à lever, et son texte
// vit ici, avec ceux des commandes des places.
const ARBRES = ['src/stockage', 'src/csv', 'src/application'];
const TABLES = ['src/stockage/types.js', 'src/csv/erreurs.js', 'src/interface/plan/depot.js'];
// L'assemblage et les tables des textes n'émettent rien : leurs clés sont ce
// qu'on éprouve, et un texte qui en compose un autre le nomme sans l'émettre.
const TABLE_DES_TEXTES = join('src', 'application', 'libelles.js');
const DOSSIER_DES_TABLES = join('src', 'application', 'libelles');
const horsDesTextes = (chemin) => chemin !== TABLE_DES_TEXTES && !chemin.startsWith(DOSSIER_DES_TABLES + sep);

// --- Le balayage ----------------------------------------------------------

// Commentaires et littéraux de chaîne, dans l'ordre où ils s'ouvrent : un
// commentaire se blanchit, sauf ses fins de ligne, et une chaîne reste, si
// bien qu'un « // » dans une chaîne n'ouvre rien.
const JETONS = /\/\*[\s\S]*?\*\/|\/\/[^\n]*|'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\[\s\S]|[^`\\])*`/g;
const sansCommentaires = (texte) =>
  texte.replace(JETONS, (jeton) => (jeton.startsWith('/') ? jeton.replace(/[^\n]/g, ' ') : jeton));

// Un code : des capitales, des chiffres, des soulignés entre deux mots.
const CODE = String.raw`'([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)'`;
const MOTIFS_EMISSION = [
  // Premier argument d'un appel : new ErreurStockage('ABSENT', …),
  // refuser('UTF8_INVALIDE'), ajouter('DERIVE', …), libelle('ENTREE_…', …).
  // normalize reçoit le nom d'une forme Unicode, non un code.
  new RegExp(String.raw`\b(?!normalize\b)[A-Za-z_$][\w$]*\s*\(\s*${CODE}`, 'g'),
  // Un objet qui porte un code : { code: 'NOM_ABSENT', … }.
  new RegExp(String.raw`\bcode\s*:\s*${CODE}`, 'g'),
  // Un code de détail : { raison: 'BLOQUE' }, { cause: 'NOMBRE_DE_CHAMPS' },
  // { remede: 'ENREGISTRER_EN_UTF8' }.
  new RegExp(String.raw`\b(?:raison|cause|remede)\s*:\s*${CODE}`, 'g'),
  // Une constante qui nomme un code, que le module émet ensuite par elle :
  // const RELU = 'RELECTURE_DIFFERENTE', puis { cause: RELU }.
  new RegExp(String.raw`\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*${CODE}`, 'g'),
];

/** Codes qu'un texte source émet, hors commentaires, dans l'ordre du texte. */
function codesEmis(texte) {
  const net = sansCommentaires(texte);
  return MOTIFS_EMISSION.flatMap((motif) => [...net.matchAll(motif)].map((trouve) => ({ indice: trouve.index, code: trouve[1] })))
    .sort((a, b) => a.indice - b.indice)
    .map(({ code }) => code);
}

/**
 * Codes d'une table de contrat : dans un commentaire de documentation qui
 * s'ouvre sur « Codes d… », chaque ligne qui porte, trois espaces après
 * l'astérisque, un code en tête.
 */
function codesDesTables(texte) {
  const codes = [];
  for (const [bloc] of texte.matchAll(/\/\*\*[\s\S]*?\*\//g)) {
    if (!/^\s*\*\s*Codes d/m.test(bloc)) continue;
    for (const [, code] of bloc.matchAll(/^[ \t]*\*[ \t]{3}([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*)(?=\s|$)/gm)) codes.push(code);
  }
  return codes;
}

// Modules d'un arbre, épreuves et table des textes exclues, triés.
function modulesDe(arbre) {
  return readdirSync(join(RACINE, arbre), { recursive: true })
    .map((nom) => join(arbre, nom))
    .filter((chemin) => chemin.endsWith('.js') && !/\.test\.js$/.test(chemin) && horsDesTextes(chemin))
    .sort();
}

// --- Le relevé du moteur -----------------------------------------------------

const MOTEUR = 'src/moteur';
// Les littéraux en capitales du moteur qui ne sont pas des codes, par module.
const PAS_DES_CODES = new Map([[join(MOTEUR, 'manque.js'), new Set(['A', 'B'])]]);
// Les modules du moteur qui portent des codes.
const MODULES_A_CODES = ['configuration.js', 'plafond.js', 'recherche.js', 'verification.js'].map((nom) => join(MOTEUR, nom));
const LITTERAL_CODE = new RegExp(CODE, 'g');

/** Chaque littéral en capitales d'un texte source, hors commentaires. */
function litterauxEnCapitales(texte) {
  return [...sansCommentaires(texte).matchAll(LITTERAL_CODE)].map((trouve) => trouve[1]);
}

// Relevé du moteur : chaque code de ses modules, hors exceptions nommées,
// le module qui émet chacun en premier, et les modules qui en portent.
function releverMoteur() {
  const codes = new Set();
  const emetteurs = new Map();
  const porteurs = [];
  for (const chemin of modulesDe(MOTEUR)) {
    const exclus = PAS_DES_CODES.get(chemin) ?? new Set();
    const trouves = litterauxEnCapitales(readFileSync(join(RACINE, chemin), 'utf8')).filter((code) => !exclus.has(code));
    if (trouves.length > 0) porteurs.push(chemin);
    for (const code of trouves) {
      codes.add(code);
      if (!emetteurs.has(code)) emetteurs.set(code, chemin);
    }
  }
  return { codes, emetteurs, porteurs };
}

// Relevé de l'arbre réel : par arbre, les codes émis et le fichier qui émet
// chacun en premier ; puis ceux des tables de contrat ; puis ceux du moteur.
function releverArbre() {
  const parArbre = new Map();
  const emetteurs = new Map();
  for (const arbre of ARBRES) {
    const codes = new Set();
    for (const chemin of modulesDe(arbre)) {
      for (const code of codesEmis(readFileSync(join(RACINE, chemin), 'utf8'))) {
        codes.add(code);
        if (!emetteurs.has(code)) emetteurs.set(code, relative('.', chemin));
      }
    }
    parArbre.set(arbre, codes);
  }
  const tables = new Set(TABLES.flatMap((chemin) => codesDesTables(readFileSync(join(RACINE, chemin), 'utf8'))));
  for (const code of tables) if (!emetteurs.has(code)) emetteurs.set(code, 'table de contrat');
  const moteur = releverMoteur();
  for (const [code, chemin] of moteur.emetteurs) if (!emetteurs.has(code)) emetteurs.set(code, chemin);
  parArbre.set(MOTEUR, moteur.codes);
  return { parArbre, tables, emetteurs };
}

// Tous les codes relevés : tables de contrat, arbres balayés et moteur.
const tousReleves = ({ parArbre, tables }) => new Set([...tables, ...[...parArbre.values()].flatMap((codes) => [...codes])]);

describe('libellés : le balayage des codes (§ 14.6, § 14.2)', () => {
  test("le relevé lit le premier argument d'un appel, une clé code, un code de détail, et rien d'un commentaire", () => {
    const source = [
      "// throw new ErreurStockage('DANS_UN_COMMENTAIRE');",
      "/** refuser('DANS_UN_BLOC') */",
      "throw new ErreurStockage('ABSENT', { chemin });",
      "const refus = refuser(\n  'UTF8_INVALIDE');",
      "avertissements.push({ code: 'DERIVE', details });",
      "throw new ErreurStockage('LECTURE_SEULE', { raison: 'BLOQUE' });",
      "const texte = brut.normalize('NFC');",
      "const url = 'http://exemple.test'; ajouter('APRES_UNE_ADRESSE');",
      "if (erreur.code === 'ECARTE') return 'PAS_UN_APPEL';",
      "const minuscule = verifier('minuscule');",
      "const RELU = 'CONSTANTE_CODE'; const motif = raisonLue ?? 'PAS_UNE_CONSTANTE';",
    ].join('\n');
    assert.deepEqual(codesEmis(source), [
      'ABSENT',
      'UTF8_INVALIDE',
      'DERIVE',
      'LECTURE_SEULE',
      'BLOQUE',
      'APRES_UNE_ADRESSE',
      'CONSTANTE_CODE',
    ]);
  });

  test("le relevé des tables lit chaque ligne de code d'un bloc « Codes d… », et ignore les autres blocs", () => {
    const source = [
      '/**',
      " * Codes d'une erreur d'essai :",
      ' *',
      ' *   PREMIER        {chemin}      un premier code',
      ' *                                qui continue ici',
      ' *   SECOND_CODE',
      ' *                  {}            un second',
      ' */',
      '/**',
      ' * Autre chose :',
      ' *   IGNORE         {}',
      ' */',
    ].join('\n');
    assert.deepEqual(codesDesTables(source), ['PREMIER', 'SECOND_CODE']);
  });

  test("un motif de lecture seule ou d'illisibilité ne fait jamais lever le texte ni n'y laisse « undefined », quel que soit le code qui le porte", () => {
    assert.ok(CODES.length > 0, 'table vide');
    for (const code of ['LECTURE_SEULE', 'ETAT_ILLISIBLE', 'JOURNAL_ILLISIBLE']) {
      for (const raison of [...CODES, 'RAISON_INVENTEE']) {
        const texte = libelle(code, { raison, base: 'Soirée des Lucioles', chemin: null });
        assert.equal(typeof texte, 'string', `${code} / ${raison}`);
        assert.ok(!texte.includes('undefined'), `${code} / ${raison} : ${texte}`);
      }
    }
  });

  test("le balayage exclut l'assemblage et chaque table de libelles/, et garde les autres modules de l'application", () => {
    const tables = readdirSync(join(RACINE, DOSSIER_DES_TABLES)).filter((nom) => nom.endsWith('.js'));
    assert.ok(tables.length >= 10, `${DOSSIER_DES_TABLES} : ${tables.length} modules`);
    const balayes = modulesDe('src/application');
    assert.ok(balayes.length > 0, 'src/application : aucun module balayé');
    const dossier = join('src', 'application', 'libelles');
    assert.deepEqual(balayes.filter((chemin) => chemin === `${dossier}.js` || chemin.startsWith(dossier + sep)), []);
    for (const garde of ['commandes.js', 'seance.js']) assert.ok(balayes.includes(join('src', 'application', garde)), garde);
  });

  test('chaque arbre émet des codes, et la table de contrat du stockage en porte', () => {
    const { parArbre, tables } = releverArbre();
    for (const arbre of ARBRES) assert.ok(parArbre.get(arbre).size > 0, `${arbre} : balayage vide`);
    assert.ok(tables.size > 0, 'tables de contrat : balayage vide');
    assert.ok(tables.has('VERROU_PRIS') && tables.has('IDENTIFIANT_HORS_COMPTEUR'));
  });

  test('chaque code que src/stockage, src/csv, src/application et src/moteur émettent a son texte', () => {
    const releve = releverArbre();
    const { emetteurs } = releve;
    const releves = tousReleves(releve);
    assert.ok(releves.size > 0, 'balayage vide');
    const connus = new Set(CODES);
    const sansTexte = [...releves].filter((code) => !connus.has(code)).sort();
    assert.deepEqual(
      sansTexte.map((code) => `${code} (${emetteurs.get(code)})`),
      [],
      'codes émis sans texte dans src/application/libelles.js',
    );
  });

  test('chaque texte de la table a un émetteur : aucune entrée morte', () => {
    const releves = tousReleves(releverArbre());
    assert.ok(CODES.length > 0, 'table vide');
    assert.deepEqual(CODES.filter((code) => !releves.has(code)), [], 'textes sans émetteur');
  });
});

// --- Les textes -----------------------------------------------------------

// Détails d'exemple de chaque code de la table : chaque texte s'y compose une
// fois. Un code ajouté à la table sans exemple fait échouer l'épreuve.
const EXEMPLES = new Map([
  // Système de fichiers et dépôt
  ['ABSENT', { chemin: 'Soirée des Lucioles.gtt.json' }],
  ['ECRITURE', { chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EROFS' }],
  ['LECTURE', { chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EACCES' }],
  ['EXISTE', { chemin: 'Soirée des Lucioles.gtt.json' }],
  ['CHEMIN_REFUSE', { chemin: '../ailleurs.gtt.json' }],
  ['ETAT_ILLISIBLE', { base: 'Soirée des Lucioles', raison: 'JSON', chemin: null, secours: { precedent: 4, journal: 5 } }],
  ['CORRECTIF', { rang: 2 }],
  ['CHEMIN_TROP_LONG', { racine: 'E:\\un\\dossier\\profond' }],
  ['IDENTIFIANT_PRESENT', { id: 'evt-lucioles', base: 'Soirée des Lucioles' }],
  ['VERROU_PRIS', { seance: 'seance-autre', depuis: '2031-05-17T08:05:00-04:00', vivant: true }],
  ['LECTURE_SEULE', { raison: 'BLOQUE' }],
  ['ETAT_NON_ECRIT', { chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EIO' }],
  ['CORBEILLE_SATUREE', { dossier: 'corbeille/2031-05-17_08-05-00_99' }],
  ['COMPTEUR_SATURE', { compteur: 'proposition' }],
  ['NON_DISPONIBLE', { primitive: 'ouvrirDansExplorateur' }],
  // Raisons d'un état illisible
  ['VIDE', {}],
  ['JSON', {}],
  ['FORME', { chemin: 'charge.participants[2].nom' }],
  ['COMPTES', { chemin: 'entete.comptes.tables' }],
  ['REFERENCE', { chemin: 'charge.reservations[0].table' }],
  ['FORMAT_INCONNU', { chemin: 'entete.format' }],
  ['FORMAT_PLUS_RECENT', { format: 2 }],
  ['ENCODAGE', {}],
  // Fautes d'un placement
  ['LONGUEUR', { tour: 2, table: 4, declare: 8, ecrit: 9 }],
  ['DOUBLON', { tour: 1, participant: 3 }],
  ['INCONNU', { tour: 1, participant: 12 }],
  ['MANQUANT', { tour: 2, participant: 7 }],
  ['IDENTIFIANT_REPETE', {}],
  ['IDENTIFIANT_HORS_COMPTEUR', {}],
  // Raisons de dérive
  ['PARTICIPANT_EXCLU', { participant: 3 }],
  ['PARTICIPANT_SUPPRIME', { participant: 4 }],
  ['PARTICIPANT_NON_PLACE', { participant: 9 }],
  ['TABLE_SUPPRIMEE', { table: 2 }],
  ['TABLE_AJOUTEE', { table: 5 }],
  ['CAPACITE_CHANGEE', { table: 1, avant: 8, maintenant: 6 }],
  ['TOURS_CHANGES', { avant: 4, maintenant: 3 }],
  // Avertissements de l'ouverture
  ['RETENU_FAUTIF', {}],
  ['JOURNAL_REPRIS', {}],
  ['JOURNAL_EN_AVANCE_DE', { n: 3 }],
  ['JOURNAL_INCOMPLET', { etat: 9, journal: 6 }],
  ['JOURNAL_ECARTEES', { n: 64 }],
  ['JOURNAL_RECREE', {}],
  ['JOURNAL_FORMAT_PLUS_RECENT', { format: 2 }],
  ['JOURNAL_ILLISIBLE', { raison: 'ENCODAGE' }],
  ['JOURNAL_ETRANGER', { evenement: 'evt-autre' }],
  ['PROPOSITIONS_FAUTIVES', { ids: [3, null] }],
  ['PROPOSITIONS_MANQUANTES', { n: 2 }],
  ['DERIVE', { ids: [1, 2], retenu: true }],
  // Dossier de travail et réglages locaux
  ['NON_PUBLIE', {}],
  ['DONNEES_APPLICATIVES', {}],
  ['SONDE_ECHOUEE', { cause: 'EROFS' }],
  ['RELECTURE_DIFFERENTE', {}],
  ['NOM_NON_CONVERTI', {}],
  ['PORTABLE_NON_INSCRIPTIBLE', { racine: { id: 'portable', chemin: 'E:\\data' }, evenements: 3, cause: 'EROFS' }],
  ['DOCUMENTS_NON_INSCRIPTIBLE', { racine: { id: 'documents', chemin: 'C:\\Documents\\Table' }, evenements: 0, cause: 'EACCES' }],
  ['PLATEFORME_WEB', {}],
  ['SUPPORT_AMOVIBLE', {}],
  ['REGLAGES_ILLISIBLES', { chemin: 'reglages_locaux.json', raison: 'FORME' }],
  // CSV
  ['UTF16_SANS_MARQUE', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['UTF16_INVALIDE', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['UTF8_INVALIDE', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['CARACTERE_NUL', { remede: 'ENREGISTRER_EN_UTF8' }],
  ['ENREGISTRER_EN_UTF8', {}],
  ['SEPARATEUR_INTROUVABLE', { separateur: ';', ligne: 3, cause: 'NOMBRE_DE_CHAMPS' }],
  ['NOMBRE_DE_CHAMPS', { ligne: 3 }],
  ['GUILLEMET_OUVERT', { ligne: 2 }],
  ['AUCUN_ENTETE', {}],
  ['NOM_NON_ASSOCIE', {}],
  ['AUCUNE_LIGNE_VALIDE', {}],
  ['CHAMPS_EN_TROP', { ligne: 4, valeur: null }],
  ['NOM_ABSENT', { ligne: 5, valeur: null }],
  ['EXCLU_INCONNU', { ligne: 6, valeur: 'peut-être' }],
  ['PLUSIEURS_CORRESPONDENT', { ligne: 7, valeur: null, participants: [3, 8] }],
  ['DEJA_DESIGNE', { ligne: 9, valeur: null, participants: [3], premiereLigne: 4 }],
  ['PLAN_BLOQUE', { remede: { geste: 'debloquer' } }],
  ['AMBIGUITE', { champs: ['appartenance', 'courriel'] }],
  // Séance
  ['AUCUN_EVENEMENT', {}],
  ['MODE_LECTURE', {}],
  ['FORMAT', {}],
  ['BLOQUE', {}],
  ['SUPPORT_ROMPU', { echec: 'ECRITURE', chemin: 'Soirée des Lucioles.gtt-journal.jsonl', dossier: 'E:\\data', cause: 'EROFS' }],
  ['SUPPORT_INTACT', {}],
  ['SUPPORT_ROMPU_NON_SAUVE', { echec: 'ETAT_NON_ECRIT', chemin: 'Soirée des Lucioles.gtt.json', dossier: 'E:\\data', cause: 'EIO' }],
  ['EVENEMENT_CHANGE', { revision: 7 }],
  ['VERROU_REPRIS', { seance: 'seance-morte', depuis: '2031-05-01T21:40:00-04:00' }],
  ['VERROU_NON_RENDU', { chemin: 'Soirée des Lucioles.gtt.verrou', dossier: 'E:\\data', cause: 'EROFS' }],
  ['RIEN_A_DEFAIRE', {}],
  ['RIEN_A_REFAIRE', {}],
  ['INSTANT_NON_RESTITUABLE', { revision: 3 }],
  ['PLAN_NON_BLOQUE', { remede: null }],
  ['JALON_NON_ECRIT', { chemin: 'Soirée des Lucioles.gtt-journal.jsonl', dossier: 'E:\\data', cause: 'EROFS' }],
  ['SANS_EFFET', { commande: 'modifierParticipant', remede: null }],
  ['RETOUR_AUTOMATIQUE', {}],
  [
    'DERIVE_NOUVELLE',
    {
      touchees: [
        { id: 'retenu', raisons: [{ code: 'TABLE_SUPPRIMEE', table: 2 }] },
        { id: 3, raisons: [{ code: 'CAPACITE_CHANGEE', table: 1, avant: 8, maintenant: 6 }] },
      ],
    },
  ],
  ['RESERVATION_NON_HONOREE', { participant: 4, table: 5, tour: 1 }],
  [
    'INVARIANT_VIOLE',
    {
      proposition: 1,
      violations: [
        { code: 'RESERVATION', participant: 4, table: 5, tour: 1 },
        { code: 'CAPACITE', table: 5, tour: 2 },
      ],
      remede: null,
    },
  ],
  ['CONFIGURATION_INCOHERENTE', { code: 'SURRESERVATION', details: { table: 2, tour: 1, reservees: 9, capacite: 8 } }],
  // Moteur
  ['PLACES_MANQUANTES', { placesManquantes: 3 }],
  ['SURRESERVATION', { table: 2, tour: 1, reservees: 9, capacite: 8, remede: null }],
  ['CAPACITE', { table: 2, capacite: 1 }],
  ['TOURS', { tours: 0 }],
  ['PARTICIPANT_DOUBLON', { participant: 4 }],
  ['TABLE_DOUBLON', { table: 3 }],
  ['RESERVATION_INCONNUE', { reservation: 0, participant: 42 }],
  ['RESERVATION_TOUR', { reservation: 2, tour: 5 }],
  ['RESERVATION_CONFLIT', { participant: 4, tour: 2, tables: [1, 3] }],
  ['ENUMERATION_TROP_GRANDE', { participant: 7, tablesAdmissibles: 40, toursLibres: 9, limite: 1000000 }],
  ['PLAN_TOURS', { attendu: 4, tours: 3, reserves: 3 }],
  ['PLAN_TABLE_INCONNUE', { table: 9 }],
  ['PLAN_TABLE_DOUBLON', { table: 2 }],
  ['PLAN_TABLE_ABSENTE', { table: 5 }],
  ['PLAN_LISTES', { tour: 2, listes: 3, tables: 4 }],
  ['PLAN_INCONNU', { participant: 42, tour: 1 }],
  ['PLAN_EXCLU_PLACE', { participant: 3, tour: 2 }],
  ['PLAN_DOUBLE_PLACE', { participant: 5, tour: 3 }],
  ['PLAN_NON_ASSIS', { participant: 6, tour: 4 }],
  ['TABLE_INCONNUE', { table: 9, detail: 'inconnue' }],
  ['DOUBLE_PLACE', { participant: 5, tour: 3 }],
  ['EXCLU_PLACE', { participant: 3, tour: 2 }],
  ['NON_ASSIS', { participant: 6, tour: 4 }],
  ['RESERVATION', { participant: 4, table: 5, tour: 1 }],
  ['PLAFOND_A_PRIORI', { index: 2, participant: 3 }],
  ['ORDRE_PLAFONDS', { index: 2, participant: 3 }],
  ['PLAFOND_REALISE', { index: 0, participant: 1 }],
  ['DEPASSEMENT', { index: 4, participant: 9 }],
  // Génération
  ['GENERATION_EN_COURS', { remede: null }],
  ['TRAVAILLEUR_EN_ECHEC', { remede: null }],
  ['AUCUN_PARTICIPANT', { remede: { geste: 'ouvrirSection', section: 'participants' } }],
  ['AUCUNE_TABLE', { remede: { geste: 'ouvrirSection', section: 'tables' } }],
  [
    'CONFIRMATION_REQUISE',
    {
      estimation: {
        secondes: 1200,
        longue: true,
        auDelaDuPlafond: false,
        mesure: { dureeMs: 2000, mouvements: 1000000, participants: 260, nombre: 5, arret: 200000 },
      },
      remede: null,
    },
  ],
  ['HORS_DOMAINE', { min: 1, max: null, remede: null }],
  ['REGLAGE_HORS_DOMAINE', { reglage: 'arret', remede: null }],
  [
    'GENERATION_INVARIANT_VIOLE',
    {
      rang: 2,
      violations: [
        { code: 'RESERVATION', participant: 4, table: 5, tour: 1 },
        { code: 'CAPACITE', table: 5, tour: 2 },
      ],
      remede: null,
    },
  ],
  // Refus et avertissements des commandes
  ['NOM_REQUIS', { remede: null }],
  ['DATE_INVALIDE', { date: '2031-02-30', remede: null }],
  ['SIEGES_INVALIDES', { sieges: 1, remede: null }],
  ['TOURS_INVALIDES', { tours: 0, remede: null }],
  ['PARTICIPANT_INCONNU', { id: 42, remede: null }],
  ['PROPOSITION_INCONNUE', { id: 17, remede: null }],
  ['AUCUNE_PROPOSITION', { remede: { geste: 'ouvrirSection', section: 'generation' } }],
  ['AUCUN_RETENU', { remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  ['RESERVATIONS_SUSPENDUES', { participant: 1, personne: 'Iris Ombrelle', reservations: 2, titres: 1 }],
  ['RESERVATIONS_RETABLIES', { participant: 1, personne: 'Iris Ombrelle', reservations: 2, titres: 1 }],
  ['RESERVATIONS_RETIREES', { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 }],
  ['IMPORT_EN_RETENU', {}],
  // Façade des événements
  ['QUESTION_EN_ATTENTE', { question: 'PORTABLE_NON_INSCRIPTIBLE', remede: null }],
  ['EXPLORATEUR_ABSENT', { remede: null }],
  // Libellés figés du journal
  ['ENTREE_CREATION', { nom: "Soirée d'essai" }],
  ['JALON_CREATION', {}],
  ['JALON_ETAT', { etat: 'retenu' }],
  ['JALON_AVANT_GENERATION', {}],
  ['ENTREE_REPRISE', {}],
  ['ENTREE_DEFAIRE', { libelle: 'Ajouté Théo Pervenche' }],
  ['ENTREE_REFAIRE', { libelle: 'Ajouté Théo Pervenche' }],
  ['ENTREE_REVENIR', { libelle: 'Ajouté Iris Ombrelle' }],
  ['ENTREE_AJOUTER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_MODIFIER_PARTICIPANT', { personne: 'Iris Ombrelle', champs: ['courriel'], devenu: null }],
  ['ENTREE_EXCLURE_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_REINTEGRER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_SUPPRIMER_PARTICIPANT', { personne: 'Iris Ombrelle' }],
  ['ENTREE_IMPORTER_PARTICIPANTS', { mode: 'ajouter', ajoutes: 12, misAJour: 0, retires: 0 }],
  ['ENTREE_CHANGER_ETAT', { etat: 'bloque' }],
  ['ENTREE_DEBLOQUER', { etat: 'retenu' }],
  ['ENTREE_COPIE', { source: 'Soirée des Lucioles', instant: "Création de l'événement « Soirée des Lucioles »" }],
  ['ENTREE_RENOMMER', { ancien: 'Soirée des Lucioles', nom: 'Soirée des Cerfs' }],
  ['ENTREE_DEMONSTRATION', { nom: 'Petite démonstration' }],
  ['ENTREE_ENREGISTRER_GENERATION', { n: 5, premier: 3, dernier: 7 }],
  ['ENTREE_RETENIR_PROPOSITION', { id: 3 }],
  ['ENTREE_EFFACER_PROPOSITIONS', { n: 4, gardee: 2 }],
  // Places : refus d'une pose, titres, réservations, retenu
  ['SIEGE_INEXISTANT', { table: 2, siege: 9, capacite: 8, remede: null }],
  ['DEUX_PLACES_MEME_TOUR', { participant: 1, tour: 2, autre: { table: 1, siege: null, portee: 'tous', tour: null }, remede: null }],
  ['PERSONNE_EXCLUE', { participant: 3, remede: null }],
  ['PLACE_RESERVEE', { table: 2, siege: 3, tour: 2, titulaire: 2, portee: 'tour', remede: null }],
  ['RESERVEE_AILLEURS', { participant: 1, tour: 2, reservation: { table: 1, siege: null, portee: 'tous', tour: null }, remede: null }],
  ['TABLE_GELEE', { table: 1 }],
  ['LIBELLE_VIDE', { remede: null }],
  ['PLACE_TITREE', { table: 3, siege: 1, libelle: 'accueil', remede: null }],
  ['AUCUN_SIEGE_SANS_TITRE', { table: 1, capacite: 2, remede: null }],
  ['TITRE_ABSENT', { table: 3, siege: 1, remede: null }],
  ['RESERVATION_ABSENTE', { participant: 1, table: 3, portee: 'tour', tour: 2, remede: null }],
  ['CONVERSION_IMPOSSIBLE', { participant: 1, table: 3, remede: null }],
  ['PROPOSITION_MONTREE', { proposition: 4, remede: null }],
  ['SIEGE_OCCUPE', { table: 5, siege: 2, tour: 1, occupant: 2, remede: null }],
  ['TABLE_PLEINE', { table: 5, tour: 1, capacite: 6, remede: null }],
  ['RESERVATION_TOUS_LES_TOURS', { participant: 1, table: 3, remede: null }],
  ['ENTREE_RESERVER', { personne: 'Théo Pervenche', numero: 4, siege: 2, portee: 'tour', tour: 2 }],
  ['ENTREE_RETIRER_RESERVATION', { personne: 'Théo Pervenche', numero: 4, portee: 'tous', tour: null }],
  ['ENTREE_DEPLACER_RESERVATION', { personne: 'Théo Pervenche', de: 4, vers: 7, siege: null, portee: 'tour', tour: 2 }],
  ['ENTREE_POSER_TITRE', { libelle: 'accueil', numero: 3, siege: 1 }],
  ['ENTREE_RETIRER_TITRE', { libelle: 'accueil', numero: 3, siege: 1 }],
  ['ENTREE_DESIGNER', { personne: 'Iris Ombrelle', numero: 3, siege: 1, libelle: 'accueil' }],
  ['ENTREE_CONVERTIR_EN_TOUS', { personne: 'Iris Ombrelle', numero: 3 }],
  ['ENTREE_DEPLACER_DANS_RETENU', { personne: 'Iris Ombrelle', de: 4, vers: 7, siege: null, tour: 2 }],
  ['ENTREE_ECHANGER_DANS_RETENU', { a: 'Iris Ombrelle', deA: 4, b: 'Théo Pervenche', deB: null, tour: 2 }],
  ['ENTREE_RETIRER_DU_TOUR', { personne: 'Iris Ombrelle', numero: 4, tour: 2 }],
  // Mobilier : saisies, capacité, sièges retirés, libellés figés
  ['NON_ENTIER', { saisie: '8abc', remede: null }],
  ['MOINS_DE_DEUX', { remede: null }],
  ['MOINS_D_UN_TOUR', { tours: 0, remede: null }],
  ['TROP_DE_PLACES', { max: 1000, remede: null }],
  ['TROP_DE_TOURS', { max: 100, remede: null }],
  ['SOUS_RESERVATIONS', { table: 2, n: 7, tour: 1, remede: { geste: 'afficherTour', tour: 1, proposition: null } }],
  ['SOUS_OCCUPES', { table: 2, n: 7, tour: 3, remede: { geste: 'afficherTour', tour: 3, proposition: null } }],
  [
    'SIEGES_RETIRES',
    {
      table: 2,
      sieges: [
        { siege: 8, cause: 'SIEGE_TITRE', libelle: 'animateur' },
        { siege: 7, cause: 'SIEGE_RESERVE', participant: 1, suspendue: true },
      ],
      remede: { commande: 'retirerTitre', arguments: { table: 2, siege: 8 } },
    },
  ],
  ['SIEGE_RESERVE', { siege: 7, participant: 1, suspendue: false }],
  ['SIEGE_TITRE', { siege: 8, libelle: 'animateur' }],
  ['SURNUMERAIRES', { table: 3, tour: 2, personnes: [16, 17] }],
  ['AU_DELA_LISIBLE', { seuil: 16 }],
  ['LISTE_SUR_VOISINE', { table: 4, voisine: 7, numero: 3, numeroVoisine: 5, remede: { commande: 'deplacerTable', arguments: { id: 7, position: { x: 1626, y: 0 } } } }],
  ['ENTREE_CREER_TABLE', { numero: 3 }],
  ['ENTREE_SUPPRIMER_TABLE', { numero: 2, reservations: 2, titres: 1 }],
  ['ENTREE_DEPLACER_TABLE', { numero: 3 }],
  ['ENTREE_CHANGER_PLACES_TABLE', { numero: 5, sieges: 10 }],
  ['ENTREE_REALIGNER_TABLE', { numero: 5, sieges: 8 }],
  ['ENTREE_CHANGER_DEFAUT', { sieges: 10, realignees: 4 }],
  ['ENTREE_CHANGER_TOURS', { tours: 3, retirees: 2 }],
  ['ENTREE_MODIFIER_REGLAGE', { cle: 'separerAppartenances', valeur: false }],
  ['ENTREE_CHANGER_CIBLE_REDONDANCE', { cible: 1200 }],
  // Planche de badges
  ['PLANCHE_SANS_PLACEMENT', { remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  ['PROPOSITION_FAUTIVE', { id: 2, remede: { geste: 'ouvrirSection', section: 'propositions' } }],
  [
    'PLANCHE_DERIVE',
    {
      raisons: [{ code: 'PARTICIPANT_NON_PLACE', participant: 6, personne: 'Ondine Grisaille' }],
      remede: { geste: 'ouvrirSection', section: 'propositions' },
    },
  ],
  ['PLANCHE_TROP_DE_TOURS', { tours: 40, remede: null }],
  ['PLANCHE_NOM_TROP_LONG', { participant: 3, personne: 'Ondine Lacasse', remede: { geste: 'ouvrirSection', section: 'participants' } }],
  ['PLANCHE_NON_ECRITE', { chemin: 'Soirée des Lucioles.badges_A4_feuille_2031-05-17_20-15-07.pdf', dossier: 'E:\\data', cause: 'EROFS', remede: { geste: 'enregistrerSous' } }],
  ['PAPIER_REQUIS', { remede: { geste: 'choisirPapier' } }],
  // Sorties
  ['IMPRESSION_ECHEC', { cause: 'failed', remede: null }],
]);

// Un texte composé ne laisse paraître ni valeur absente, ni booléen, ni
// objet : chaque trace est un mot entier, « nulle part » n'en est pas une.
const TRACES = [/\bundefined\b/, /\bnull\b/, /\bNaN\b/, /\b(?:true|false)\b/, /\[object /];

describe('libellés : les textes (§ 14.6, § 8.2)', () => {
  test('un code inconnu lève, et le message nomme le code', () => {
    assert.throws(() => libelle('CODE_QUI_N_EXISTE_PAS', {}), (erreur) => {
      assert.ok(erreur instanceof RangeError);
      assert.match(erreur.message, /CODE_QUI_N_EXISTE_PAS/);
      return true;
    });
    assert.throws(() => libelle(undefined), RangeError);
  });

  test("chaque texte de la table se compose de ses détails d'exemple", () => {
    assert.ok(CODES.length > 0, 'table vide');
    assert.deepEqual(CODES.filter((code) => !EXEMPLES.has(code)), [], "codes de la table sans détails d'exemple");
    assert.deepEqual([...EXEMPLES.keys()].filter((code) => !CODES.includes(code)), [], 'exemples sans code dans la table');
    for (const code of CODES) {
      const texte = libelle(code, EXEMPLES.get(code));
      assert.equal(typeof texte, 'string', code);
      assert.ok(texte.trim().length > 0, `${code} : texte vide`);
      assert.notEqual(texte, code, `${code} : le code brut tient lieu de texte`);
      for (const trace of TRACES) assert.doesNotMatch(texte, trace, `${code} : « ${texte} »`);
    }
  });

  test("RESERVATION_TOUS_LES_TOURS ne nomme aucun geste : le même refus suit un dépôt sur le sol et « Retirer du tour », où rien ne se dépose", () => {
    const texte = libelle('RESERVATION_TOUS_LES_TOURS', { participant: 1, table: 3, remede: null });
    assert.doesNotMatch(texte, /d[ée]pos/i);
    assert.match(texte, /tous les tours/);
    assert.match(texte, /« Retirer la réservation »/);
  });

  test('CONVERSION_IMPOSSIBLE nomme chacune de ses raisons : des tours non couverts, une réservation « tous les tours » déjà là, une personne exclue', () => {
    const texte = libelle('CONVERSION_IMPOSSIBLE', { participant: 1, table: 3, remede: null });
    for (const motif of [/chaque tour/, /« tous les tours »/, /exclue/]) assert.match(texte, motif);
  });

  test('la table est triée, sans doublon, et figée', () => {
    assert.deepEqual([...CODES], [...new Set(CODES)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
    assert.ok(Object.isFrozen(CODES));
  });

  test('les libellés figés des exemples du contrat, détails interpolés', () => {
    assert.equal(libelle('ENTREE_CREATION', { nom: "Soirée d'essai" }), "Création de l'événement « Soirée d'essai »");
    assert.equal(libelle('JALON_CREATION'), 'Création');
    assert.equal(libelle('ENTREE_AJOUTER_PARTICIPANT', { personne: 'Iris Ombrelle' }), 'Ajouté Iris Ombrelle');
    assert.equal(
      libelle('ENTREE_MODIFIER_PARTICIPANT', { personne: 'Ondine Lacasse', champs: ['courriel'], devenu: null }),
      'Modifié Ondine Lacasse : courriel',
    );
    assert.equal(
      libelle('ENTREE_MODIFIER_PARTICIPANT', { personne: 'Iris Ombrelle', champs: ['nom', 'titrePressenti'], devenu: 'Iris Parasol' }),
      'Modifié Iris Ombrelle : nom, titre pressenti (désormais Iris Parasol)',
    );
    assert.equal(libelle('ENTREE_REVENIR', { libelle: 'Ajouté Iris Ombrelle' }), 'Retour à « Ajouté Iris Ombrelle »');
    assert.equal(libelle('ENTREE_DEFAIRE', { libelle: 'Ajouté Théo Pervenche' }), 'Défait : « Ajouté Théo Pervenche »');
    assert.equal(libelle('ENTREE_REFAIRE', { libelle: 'Ajouté Théo Pervenche' }), 'Refait : « Ajouté Théo Pervenche »');
    assert.equal(libelle('ENTREE_REPRISE'), "Reprise de l'état trouvé sur le disque");
    assert.equal(libelle('JALON_ETAT', { etat: 'propose' }), 'État « Proposé »');
    assert.equal(libelle('ENTREE_CHANGER_ETAT', { etat: 'bloque' }), "Plan passé à l'état « Bloqué »");
    assert.equal(libelle('ENTREE_ENREGISTRER_GENERATION', { n: 5, premier: 3, dernier: 7 }), 'Généré 5 propositions (n° 3 à 7)');
    assert.equal(libelle('ENTREE_ENREGISTRER_GENERATION', { n: 1, premier: 4, dernier: 4 }), 'Généré 1 proposition (n° 4)');
    assert.equal(libelle('ENTREE_IMPORTER_PARTICIPANTS', { mode: 'ajouter', ajoutes: 1, misAJour: 0, retires: 0 }), 'Importé 1 participant');
    assert.equal(
      libelle('ENTREE_IMPORTER_PARTICIPANTS', { mode: 'remplacer', ajoutes: 250, misAJour: 0, retires: 260 }),
      'Remplacé la liste par import : 260 retirés, 250 ajoutés',
    );
  });

  test('RESERVATION_NON_HONOREE nomme la personne et le numéro de la table quand ils sont donnés, sinon leurs identifiants', () => {
    assert.equal(
      libelle('RESERVATION_NON_HONOREE', { participant: 4, table: 5, tour: 1, personne: 'Iris Ombrelle', numero: 3 }),
      "Le placement retenu n'honore pas la réservation de Iris Ombrelle à la table 3 au tour 1 : il la place ailleurs.",
    );
    assert.equal(
      libelle('RESERVATION_NON_HONOREE', { participant: 4, table: 5, tour: 1 }),
      "Le placement retenu n'honore pas la réservation de la personne n° 4 à la table d'identifiant 5 au tour 1 : il la place ailleurs.",
    );
  });

  test('RESERVATION_NON_HONOREE au siège nomme le siège et ce qu’il porte', () => {
    assert.equal(
      libelle('RESERVATION_NON_HONOREE', { participant: 4, table: 5, tour: 1, personne: 'Iris Ombrelle', numero: 3, siege: 2, occupant: 7 }),
      "Le placement retenu n'honore pas la réservation de Iris Ombrelle au siège 2 de la table 3 au tour 1 : " +
        "il l'assied à un autre siège de cette table, et donne le siège 2 à une autre personne.",
    );
    assert.equal(
      libelle('RESERVATION_NON_HONOREE', { participant: 4, table: 5, tour: 1, siege: 2, occupant: null }),
      "Le placement retenu n'honore pas la réservation de la personne n° 4 au siège 2 de la table d'identifiant 5 au tour 1 : " +
        "il l'assied à un autre siège de cette table, et laisse le siège 2 vide.",
    );
  });

  test('une raison de dérive nomme la personne et la table quand ses détails les portent, sinon leurs identifiants', () => {
    const nommees = [
      ['PARTICIPANT_EXCLU', { participant: 14, personne: 'Iris Ombrelle' }, 'Iris Ombrelle est exclue depuis.'],
      ['PARTICIPANT_SUPPRIME', { participant: 14, personne: 'Iris Ombrelle' }, 'Iris Ombrelle a été supprimée depuis.'],
      [
        'PARTICIPANT_NON_PLACE',
        { participant: 14, personne: 'Iris Ombrelle' },
        "Iris Ombrelle, ajoutée ou réintégrée depuis, n'y est pas placée.",
      ],
      ['TABLE_SUPPRIMEE', { table: 9, numero: 3 }, 'La table 3 a été supprimée depuis.'],
      ['TABLE_AJOUTEE', { table: 9, numero: 3 }, 'La table 3 a été ajoutée depuis.'],
      ['CAPACITE_CHANGEE', { table: 9, numero: 3, avant: 8, maintenant: 6 }, 'La table 3 est passée de 8 à 6 places.'],
    ];
    assert.equal(nommees.length, 6);
    for (const [code, details, attendu] of nommees) {
      assert.equal(libelle(code, details), attendu, code);
      const { personne, numero, ...nus } = details;
      assert.doesNotMatch(libelle(code, nus), /Iris|table 3/, code);
      assert.match(libelle(code, nus), personne === undefined ? /identifiant 9/ : /n° 14/, code);
      void numero;
    }
  });

  test('le séparateur introuvable nomme la ligne et la cause ; le guillemet ouvert tombe dès la ligne 2', () => {
    const nombre = libelle('SEPARATEUR_INTROUVABLE', { separateur: ';', ligne: 3, cause: 'NOMBRE_DE_CHAMPS' });
    assert.match(nombre, /la ligne 3 n'a pas le nombre de champs de l'en-tête/);
    assert.match(libelle('SEPARATEUR_INTROUVABLE', { ligne: 3 }), /la ligne 3 n'a pas le nombre de champs de l'en-tête/);
    assert.match(libelle('SEPARATEUR_INTROUVABLE', { separateur: ',', ligne: 2, cause: 'GUILLEMET_OUVERT' }), /ligne 2/);
    assert.match(libelle('GUILLEMET_OUVERT', { ligne: 2 }), /ligne 2/);
    assert.doesNotMatch(libelle('SEPARATEUR_INTROUVABLE', {}), /ligne/);
  });

  test("les quatre refus d'encodage nomment le même remède : réenregistrer en UTF-8", () => {
    const remede = libelle('ENREGISTRER_EN_UTF8');
    assert.match(remede, /UTF-8/);
    for (const code of ['UTF16_SANS_MARQUE', 'UTF16_INVALIDE', 'UTF8_INVALIDE', 'CARACTERE_NUL']) {
      const texte = libelle(code, { remede: 'ENREGISTRER_EN_UTF8' });
      assert.ok(texte.endsWith(remede), `${code} : « ${texte} »`);
    }
  });

  test("le support amovible nomme le dossier quand il est donné ; l'événement changé nomme la révision adoptée", () => {
    assert.doesNotMatch(libelle('SUPPORT_AMOVIBLE', {}), /«/);
    assert.match(libelle('SUPPORT_AMOVIBLE', { dossier: 'F:\\soirees' }), /« F:\\soirees »/);
    assert.match(libelle('EVENEMENT_CHANGE', { revision: 7 }), /\b7\b/);
  });

  test("quitter un événement au support rompu nomme « Écrire ailleurs », et ce qui serait perdu", () => {
    const details = { chemin: 'Soirée des Lucioles.gtt-journal.jsonl', dossier: 'E:\\data', cause: 'EROFS' };
    for (const echec of ['ECRITURE', 'ETAT_NON_ECRIT', 'JALON_NON_ECRIT', 'VERROU_NON_ECRIT']) {
      assert.match(libelle('SUPPORT_ROMPU_NON_SAUVE', { echec, ...details }), /« Écrire ailleurs »/, echec);
    }
  });

  test('le plan bloqué nomme « Débloquer », le mode lecture nomme « Modifier »', () => {
    assert.match(libelle('LECTURE_SEULE', { raison: 'BLOQUE' }), /« Débloquer »/);
    assert.match(libelle('PLAN_BLOQUE', { remede: { geste: 'debloquer' } }), /« Débloquer »/);
    assert.match(libelle('MODE_LECTURE'), /« Modifier »/);
    assert.doesNotMatch(libelle('LECTURE_SEULE', { raison: 'FORMAT' }), /Débloquer/);
    for (const trace of TRACES) assert.doesNotMatch(libelle('LECTURE_SEULE', { raison: 'FORMAT' }), trace);
    assert.equal(libelle('LECTURE_SEULE', { raison: 'FORMAT' }), libelle('LECTURE_SEULE', { raison: 'FORMAT_PLUS_RECENT' }));
  });

  test("un état illisible nomme sa raison et ses secours ; chaque raison du contrat a son texte", () => {
    const texte = libelle('ETAT_ILLISIBLE', { base: 'Soirée des Lucioles', raison: 'VIDE', chemin: null, secours: { precedent: 4, journal: null } });
    assert.match(texte, /« Soirée des Lucioles »/);
    assert.match(texte, new RegExp(libelle('VIDE')));
    assert.match(texte, /révision 4/);
    const sansSecours = libelle('ETAT_ILLISIBLE', { base: 'Soirée des Lucioles', raison: 'JSON', chemin: null, secours: { precedent: null, journal: null } });
    assert.match(sansSecours, /Aucune version de secours/);
    for (const raison of ['ABSENT', 'VIDE', 'JSON', 'FORME', 'COMPTES', 'REFERENCE', 'FORMAT_INCONNU', 'FORMAT_PLUS_RECENT']) {
      const details = { base: 'Soirée des Lucioles', raison, chemin: raison === 'FORME' ? 'charge.tables[0].forme' : null, secours: { precedent: null, journal: 2 } };
      assert.match(libelle('ETAT_ILLISIBLE', details), /révision 2/, raison);
    }
    const encodage = libelle('ETAT_ILLISIBLE', { base: 'Soirée des Lucioles', raison: 'ENCODAGE', chemin: null, secours: { precedent: 4, journal: null } });
    assert.ok(encodage.includes(libelle('ENCODAGE')), encodage);
  });

  test("une raison qu'un texte ne connaît pas ne lève jamais : une phrase générique la nomme, par son texte quand la table en porte un, telle quelle sinon", () => {
    const inventee = libelle('ETAT_ILLISIBLE', { base: 'x', raison: 'RAISON_INVENTEE', chemin: null });
    assert.match(inventee, /« RAISON_INVENTEE »/);
    const seule = libelle('LECTURE_SEULE', { raison: 'RAISON_INVENTEE' });
    assert.match(seule, /« RAISON_INVENTEE »/);
    assert.match(seule, /lecture seule/);
    const parSonTexte = libelle('LECTURE_SEULE', { raison: 'VIDE' });
    assert.ok(parSonTexte.includes(libelle('VIDE')), parSonTexte);
    assert.doesNotMatch(parSonTexte, /VIDE/);
    assert.match(libelle('JOURNAL_ILLISIBLE', { raison: 'RAISON_INVENTEE' }), /« RAISON_INVENTEE »/);
    for (const texte of [inventee, seule, parSonTexte]) for (const trace of TRACES) assert.doesNotMatch(texte, trace);
  });

  test("un état aux octets hors UTF-8 se dit par son encodage : en lecture seule, il nomme le secours qui le met de côté ; le journal illisible, l'historique laissé tel quel", () => {
    const seule = libelle('LECTURE_SEULE', { raison: 'ENCODAGE' });
    assert.ok(seule.includes(libelle('ENCODAGE')), seule);
    assert.match(seule, /secours/);
    assert.match(seule, /corbeille/);
    assert.notEqual(seule, libelle('LECTURE_SEULE', { raison: 'FORMAT' }));
    const journal = libelle('JOURNAL_ILLISIBLE', { raison: 'ENCODAGE' });
    assert.ok(journal.includes(libelle('ENCODAGE')), journal);
    assert.match(libelle('JOURNAL_RECREE'), /historique/);
  });

  test('les propositions manquantes se disent par leur nombre, au singulier comme au pluriel, sans jamais les énumérer', () => {
    assert.match(libelle('PROPOSITIONS_MANQUANTES', { n: 1 }), /^1 proposition que l'en-tête annonce manque/);
    const enorme = libelle('PROPOSITIONS_MANQUANTES', { n: 2 ** 40 });
    assert.match(enorme, new RegExp(`^${2 ** 40} propositions que l'en-tête annonce manquent`));
    assert.ok(enorme.length < 200, enorme);
  });

  test("une cause que la table porte se lit par son texte ; une cause du système s'affiche comme il la nomme", () => {
    const avecCause = CODES.filter((code) => Object.hasOwn(EXEMPLES.get(code) ?? {}, 'cause'));
    assert.ok(avecCause.length > 0, 'aucun texte ne reçoit de cause');
    for (const code of avecCause) {
      const texte = libelle(code, { ...EXEMPLES.get(code), cause: 'RELECTURE_DIFFERENTE' });
      assert.doesNotMatch(texte, /RELECTURE_DIFFERENTE/, `${code} : « ${texte} »`);
    }
    const relue = libelle('RELECTURE_DIFFERENTE');
    for (const code of ['ECRITURE', 'SONDE_ECHOUEE', 'PORTABLE_NON_INSCRIPTIBLE', 'DOCUMENTS_NON_INSCRIPTIBLE']) {
      const details = EXEMPLES.get(code);
      assert.ok(libelle(code, { ...details, cause: 'RELECTURE_DIFFERENTE' }).includes(`(${relue})`), code);
      assert.ok(libelle(code, { ...details, cause: 'TypeMismatchError' }).includes('(TypeMismatchError)'), code);
    }
  });

  test("le support rompu dit ce que l'écriture refusée laisse sur le disque ; un échec inconnu lève", () => {
    const refus = { chemin: 'Soirée des Lucioles.gtt-journal.jsonl', dossier: 'E:\\data', cause: 'EROFS' };
    const textes = ['ECRITURE', 'ETAT_NON_ECRIT', 'JALON_NON_ECRIT', 'VERROU_NON_ECRIT'].map((echec) =>
      libelle('SUPPORT_ROMPU', { echec, ...refus }),
    );
    for (const texte of textes) {
      assert.ok(texte.includes('« Soirée des Lucioles.gtt-journal.jsonl » dans le dossier « E:\\data » (EROFS)'), texte);
      assert.match(texte, /« Écrire ailleurs »/);
    }
    assert.equal(new Set(textes).size, 4);
    const [ecriture, etat, jalon, verrou] = textes;
    assert.match(ecriture, /le dernier geste n'est pas enregistré/);
    assert.match(etat, /le dernier geste est inscrit à l'historique, mais pas dans l'état/);
    assert.match(jalon, /le dernier geste est enregistré, mais pas le jalon qui le nomme/i);
    for (const texte of [jalon, verrou]) assert.doesNotMatch(texte, /n'est pas enregistré|ne se correspondent plus/);
    assert.throws(() => libelle('SUPPORT_ROMPU', { echec: 'ECHEC_INVENTE', ...refus }), RangeError);
  });

  test('un verrou pris dit depuis quand, et distingue la séance vivante, inconnue ou morte', () => {
    const vivant = libelle('VERROU_PRIS', { seance: 's', depuis: '2031-05-01T21:40:00-04:00', vivant: true });
    assert.match(vivant, /1er mai 2031 à 21 h 40/);
    const inconnu = libelle('VERROU_PRIS', { seance: null, depuis: null, vivant: null });
    assert.notEqual(inconnu, vivant);
    assert.notEqual(libelle('VERROU_PRIS', { seance: 's', depuis: '2031-05-01T21:40:00-04:00', vivant: false }), vivant);
  });

  test('un état, un champ, un mode inconnus lèvent au lieu de se taire', () => {
    assert.throws(() => libelle('JALON_ETAT', { etat: 'archive' }), RangeError);
    assert.throws(() => libelle('ENTREE_MODIFIER_PARTICIPANT', { personne: 'x', champs: ['age'], devenu: null }), RangeError);
    assert.throws(() => libelle('ENTREE_IMPORTER_PARTICIPANTS', { mode: 'fusionner', ajoutes: 1, misAJour: 0, retires: 0 }), RangeError);
  });

  test('les comptes accordent le singulier et le pluriel', () => {
    assert.match(libelle('JOURNAL_ECARTEES', { n: 1 }), /^1 entrée de l'historique est écartée/);
    assert.match(libelle('JOURNAL_ECARTEES', { n: 64 }), /^64 entrées de l'historique sont écartées/);
    assert.equal(libelle('DERIVE', { ids: [], retenu: true }).startsWith('Le placement retenu ne décrit plus'), true);
    assert.match(libelle('DERIVE', { ids: [1, 2], retenu: true }), /^Le placement retenu et les propositions n° 1 et 2 ne décrivent plus/);
    assert.match(libelle('PROPOSITIONS_FAUTIVES', { ids: [3, null] }), /n° 3/);
  });
});

// --- Les tables par domaine ---------------------------------------------------

// Les deux formes de clé du contrat : un code, nu ; un libellé, préfixé du nom
// de sa table, en camelCase.
const FORME_CODE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/;
const formeLibelle = (table) => new RegExp(`^${table}(?:\\.[a-z][A-Za-z0-9]*)+$`);

// Les modules de table du dossier, aides et épreuves exceptées, par ordre
// alphabétique, et ce que chacun exporte.
async function tablesDuDossier() {
  const noms = readdirSync(join(RACINE, DOSSIER_DES_TABLES))
    .filter((nom) => nom.endsWith('.js') && !nom.endsWith('.test.js') && nom !== 'aides.js')
    .sort();
  return Promise.all(noms.map(async (nom) => ({ table: nom.slice(0, -3), module: await import(`./libelles/${nom}`) })));
}

describe('libellés : les tables par domaine (§ 14.6)', () => {
  test('chaque module de libelles/, aides.js excepté, exporte TABLE, une Map ; TABLES_APPLICATION les assemble, douze, par ordre alphabétique', async () => {
    const tables = await tablesDuDossier();
    assert.equal(tables.length, 12);
    assert.deepEqual(tables.map(({ table }) => table), [
      'csv', 'evenements', 'format', 'generation', 'mobilier', 'moteur', 'participants', 'places', 'planche', 'seance', 'sorties', 'stockage',
    ]);
    for (const { table, module } of tables) assert.ok(module.TABLE instanceof Map, table);
    assert.equal(TABLES_APPLICATION.length, tables.length);
    tables.forEach(({ table, module }, rang) => assert.equal(TABLES_APPLICATION[rang], module.TABLE, table));
  });

  test("chaque clé a l'une des deux formes ; un libellé commence par le nom de sa table ; participants et generation ne portent que des codes", async () => {
    const tables = await tablesDuDossier();
    let comptees = 0;
    for (const { table, module } of tables) {
      for (const cle of module.TABLE.keys()) {
        comptees += 1;
        const code = FORME_CODE.test(cle);
        assert.ok(code || formeLibelle(table).test(cle), `${table} : clé ${JSON.stringify(cle)}`);
        if (table === 'participants' || table === 'generation') assert.ok(code, `${table} : ${cle} n'est pas un code`);
      }
    }
    assert.ok(comptees >= CODES.length, `${comptees} clés`);
  });

  test("chaque texte est dans la table du domaine qui l'émet", async () => {
    const parTable = new Map((await tablesDuDossier()).map(({ table, module }) => [table, module.TABLE]));
    const ATTENDUS = [
      ['stockage', ['ABSENT', 'VERROU_PRIS', 'LECTURE_SEULE', 'DERIVE', 'RELECTURE_DIFFERENTE', 'COMPTEUR_SATURE']],
      ['csv', ['NOM_ABSENT', 'UTF8_INVALIDE', 'ENREGISTRER_EN_UTF8', 'PLAN_BLOQUE', 'AMBIGUITE']],
      ['seance', ['MODE_LECTURE', 'SUPPORT_ROMPU', 'SANS_EFFET', 'ENTREE_DEFAIRE', 'JALON_CREATION']],
      ['participants', ['NOM_REQUIS', 'PARTICIPANT_INCONNU', 'RESERVATIONS_SUSPENDUES', 'IMPORT_EN_RETENU', 'ENTREE_AJOUTER_PARTICIPANT']],
      ['evenements', ['ENTREE_CREATION', 'DATE_INVALIDE', 'AUCUN_RETENU', 'PLAN_NON_BLOQUE', 'ENTREE_DEBLOQUER']],
      ['generation', ['PROPOSITION_INCONNUE', 'ENTREE_ENREGISTRER_GENERATION', 'ENTREE_EFFACER_PROPOSITIONS']],
      ['format', ['format.vide', 'format.duree.vingtMinutes']],
    ];
    assert.equal(ATTENDUS.length, 7);
    for (const [table, cles] of ATTENDUS) for (const cle of cles) assert.ok(parTable.get(table).has(cle), `${cle} hors de ${table}.js`);
  });

  test("CODES ne compte que les clés de forme code ; libelle lit aussi un libellé de l'application", () => {
    assert.ok(CODES.length > 0);
    assert.deepEqual(CODES.filter((cle) => !FORME_CODE.test(cle)), []);
    assert.ok(!CODES.includes('format.vide'));
    assert.equal(libelle('format.vide'), '\u{2014}');
    const toutes = TABLES_APPLICATION.flatMap((table) => [...table.keys()]).filter((cle) => FORME_CODE.test(cle));
    assert.deepEqual([...CODES], [...toutes].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
  });
});

// --- Le moteur et la génération ----------------------------------------------

describe('libellés : les codes du moteur et de la génération (§ 14.6, § 5.7)', () => {
  test('le relevé du moteur porte des codes, dans ses quatre modules à codes, et rien des valeurs de domine', () => {
    const { codes, porteurs } = releverMoteur();
    assert.ok(codes.size >= 20, `${codes.size} codes relevés`);
    assert.deepEqual(porteurs, MODULES_A_CODES);
    assert.ok(!codes.has('A') && !codes.has('B'));
    for (const code of ['PLAN_EXCLU_PLACE', 'PLAN_INCONNU', 'ENUMERATION_TROP_GRANDE', 'PLACES_MANQUANTES', 'RESERVATION']) {
      assert.ok(codes.has(code), code);
    }
    assert.deepEqual(litterauxEnCapitales("// 'DANS_UN_COMMENTAIRE'\nconst x = a ? 'PREMIER' : 'SECOND';"), ['PREMIER', 'SECOND']);
  });

  test("chaque code du moteur a sa clé, une seule ; un code que seul le moteur lève l'a dans libelles/moteur.js, aux exceptions nommées près", async () => {
    const { codes } = releverMoteur();
    const releve = releverArbre();
    const ailleurs = new Set([...releve.tables, ...ARBRES.flatMap((arbre) => [...releve.parArbre.get(arbre)])]);
    const { TABLE: MOTEUR_TABLE } = await import('./libelles/moteur.js');
    const { TABLE: STOCKAGE_TABLE } = await import('./libelles/stockage.js');
    // INCONNU est déjà une clé de la table du stockage, une faute de
    // placement aux mêmes détails ; PLACES_MANQUANTES et SURRESERVATION,
    // que la séance émet aussi, sont dans libelles/moteur.js, et ne s'y
    // redéfinissent pas.
    const EXCEPTIONS = new Map([['INCONNU', STOCKAGE_TABLE]]);
    let comptes = 0;
    for (const code of codes) {
      comptes += 1;
      const porteuses = TABLES_APPLICATION.filter((table) => table.has(code));
      assert.equal(porteuses.length, 1, `${code} : ${porteuses.length} tables`);
      if (EXCEPTIONS.has(code)) assert.equal(porteuses[0], EXCEPTIONS.get(code), code);
      else if (!ailleurs.has(code)) assert.equal(porteuses[0], MOTEUR_TABLE, `${code} hors de libelles/moteur.js`);
    }
    assert.ok(comptes > 0);
    for (const code of ['PLACES_MANQUANTES', 'SURRESERVATION']) assert.ok(MOTEUR_TABLE.has(code), code);
  });

  test('chaque critère de CRITERES a son libellé moteur.critere.<nom>', () => {
    assert.ok(CRITERES.length > 0);
    for (const critere of CRITERES) {
      const texte = libelle(`moteur.critere.${critere}`);
      assert.ok(texte.length > 0, critere);
      for (const trace of TRACES) assert.doesNotMatch(texte, trace);
    }
    assert.equal(new Set(CRITERES.map((critere) => libelle(`moteur.critere.${critere}`))).size, CRITERES.length);
  });

  test("les tables de l'application et des écrans s'assemblent sans clé en double", () => {
    assert.ok(TABLES_INTERFACE.length > 0);
    assert.doesNotThrow(() => creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]));
  });

  test('CAPACITE et TOURS, levés sous deux formes, ont un seul texte qui les distingue par leurs détails', () => {
    const configuration = libelle('CAPACITE', { table: 2, capacite: 1 });
    const violation = libelle('CAPACITE', { table: 2, tour: 3 });
    assert.notEqual(configuration, violation);
    assert.match(configuration, /\b1\b/);
    assert.match(violation, /tour 3/);
    const tours = libelle('TOURS', { tours: 0 });
    const toursViolation = libelle('TOURS', {});
    assert.notEqual(tours, toursViolation);
    for (const texte of [configuration, violation, tours, toursViolation]) for (const trace of TRACES) assert.doesNotMatch(texte, trace, texte);
  });

  test("une violation d'indicateur nomme la personne quand l'appelant la traduit, son rang sinon ; un détail de table inconnu lève", () => {
    assert.match(libelle('DEPASSEMENT', { index: 4, participant: 9 }), /n° 9/);
    assert.match(libelle('DEPASSEMENT', { index: 4 }), /rang 5/);
    for (const detail of ['inconnue', 'doublon', 'absente']) assert.match(libelle('TABLE_INCONNUE', { table: 9, detail }), /9/);
    assert.match(libelle('TABLE_INCONNUE', { tour: 2, detail: 'listes' }), /tour 2/);
    assert.throws(() => libelle('TABLE_INCONNUE', { table: 9, detail: 'inventee' }), RangeError);
  });

  test('chaque refus de valider et de generer a son texte, dans la table de son domaine', async () => {
    const parTable = new Map((await tablesDuDossier()).map(({ table, module }) => [table, module.TABLE]));
    // Les refus que lèvent les épreuves de valider et de generer
    // (generation.test.js), et la table qui porte chacun. Ceux de la séance,
    // du stockage, du mobilier et du moteur sont relayés tels quels ;
    // GENERATION_INVARIANT_VIOLE, propre à la génération, se distingue
    // d'INVARIANT_VIOLE, la violation du retenu, que la séance porte.
    const REFUS = [
      ['NON_ENTIER', 'mobilier'],
      ['HORS_DOMAINE', 'generation'],
      ['AUCUN_EVENEMENT', 'seance'],
      ['LECTURE_SEULE', 'stockage'],
      ['MODE_LECTURE', 'seance'],
      ['SUPPORT_ROMPU', 'seance'],
      ['GENERATION_EN_COURS', 'generation'],
      ['TRAVAILLEUR_EN_ECHEC', 'generation'],
      ['AUCUN_PARTICIPANT', 'generation'],
      ['AUCUNE_TABLE', 'generation'],
      ['SURRESERVATION', 'moteur'],
      ['PLACES_MANQUANTES', 'moteur'],
      ['CONFIRMATION_REQUISE', 'generation'],
      ['REGLAGE_HORS_DOMAINE', 'generation'],
      ['GENERATION_INVARIANT_VIOLE', 'generation'],
      ['COMPTEUR_SATURE', 'stockage'],
    ];
    assert.equal(REFUS.length, 16);
    for (const [code, table] of REFUS) {
      assert.ok(parTable.get(table).has(code), `${code} hors de ${table}.js`);
      assert.ok(libelle(code, EXEMPLES.get(code)).length > 0, code);
    }
  });

  test("la confirmation d'une génération longue dit l'ordre de grandeur, la mesure, le plafond ; sans mesure, le seuil", () => {
    const mesure = { dureeMs: 2000, mouvements: 1000000, participants: 260, nombre: 5, arret: 200000 };
    const longue = libelle('CONFIRMATION_REQUISE', { estimation: { secondes: 1200, longue: true, auDelaDuPlafond: false, mesure }, remede: null });
    assert.match(longue, /environ vingt minutes/);
    assert.match(longue, /260 participants/);
    assert.doesNotMatch(longue, /trente minutes/);
    const plafond = libelle('CONFIRMATION_REQUISE', { estimation: { secondes: 7200, longue: true, auDelaDuPlafond: true, mesure }, remede: null });
    assert.match(plafond, /trente minutes/);
    const inconnue = libelle('CONFIRMATION_REQUISE', { estimation: { inconnue: true }, remede: null });
    assert.match(inconnue, /dix fois le réglage par défaut/);
    for (const texte of [longue, plafond, inconnue]) for (const trace of TRACES) assert.doesNotMatch(texte, trace, texte);
  });

  test("une violation d'invariant rendue par la génération nomme son rang et chaque règle, sans retenu ni dérive", () => {
    const details = {
      rang: 2,
      violations: [
        { code: 'RESERVATION', participant: 4, table: 5, tour: 1 },
        { code: 'CAPACITE', table: 5, tour: 2 },
      ],
      remede: null,
    };
    const texte = libelle('GENERATION_INVARIANT_VIOLE', details);
    assert.match(texte, /rang 2\b/);
    assert.match(texte, /2 règles/);
    assert.ok(texte.includes(libelle('RESERVATION', details.violations[0])), texte);
    assert.ok(texte.includes(libelle('CAPACITE', details.violations[1])), texte);
    assert.doesNotMatch(texte, /retenu|dérive|proposition n°/);
    assert.match(libelle('GENERATION_INVARIANT_VIOLE', { ...details, violations: details.violations.slice(0, 1) }), /1 règle\b/);
  });

  test('un domaine borné nomme ses deux bornes, un domaine ouvert son minimum', () => {
    assert.match(libelle('HORS_DOMAINE', { min: 0, max: 4294967295, remede: null }), /0 et 4\u{202F}294\u{202F}967\u{202F}295/u);
    assert.match(libelle('HORS_DOMAINE', { min: 1, max: null, remede: null }), /au moins 1\b/);
  });
});
