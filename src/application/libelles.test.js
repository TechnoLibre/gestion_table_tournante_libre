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
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../../test/lanceur.js';
import { CODES, TABLES_APPLICATION, libelle } from './libelles.js';

const RACINE = fileURLToPath(new URL('../..', import.meta.url));

// Les arbres balayés, et les fichiers qui portent une table de codes.
const ARBRES = ['src/stockage', 'src/csv', 'src/application'];
const TABLES = ['src/stockage/types.js', 'src/csv/erreurs.js'];
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

// Relevé de l'arbre réel : par arbre, les codes émis et le fichier qui émet
// chacun en premier ; puis ceux des tables de contrat.
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
  return { parArbre, tables, emetteurs };
}

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

  test('chaque code que src/stockage, src/csv et src/application émettent a son texte', () => {
    const { parArbre, tables, emetteurs } = releverArbre();
    const releves = new Set([...tables, ...ARBRES.flatMap((arbre) => [...parArbre.get(arbre)])]);
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
    const { parArbre, tables } = releverArbre();
    const releves = new Set([...tables, ...ARBRES.flatMap((arbre) => [...parArbre.get(arbre)])]);
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
  test('chaque module de libelles/, aides.js excepté, exporte TABLE, une Map ; TABLES_APPLICATION les assemble, dix, par ordre alphabétique', async () => {
    const tables = await tablesDuDossier();
    assert.equal(tables.length, 10);
    assert.deepEqual(tables.map(({ table }) => table), [
      'csv', 'evenements', 'format', 'generation', 'mobilier', 'moteur', 'participants', 'places', 'seance', 'stockage',
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

  test("chaque texte d'A1 est dans la table du domaine qui l'émet", async () => {
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
