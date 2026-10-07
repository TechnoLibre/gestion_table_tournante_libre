// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des opérations sur les événements (§ 8.6, § 8.7, § 15), toutes sur
// le système de fichiers d'épreuve, chacune traçant ou comptant ses
// écritures : copier, renommer, importer un fichier d'état ou les paires de
// l'autre emplacement, supprimer vers une corbeille datée, la lister, charger
// une démonstration livrée. Une coupure à chaque écriture d'un renommage ou
// d'une suppression laisse le dossier sans perte. Les noms d'épreuve sont
// inventés ; les versions viennent du module engendré.
import assert from 'node:assert/strict';
import { PanneSimulee, creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { VERSION } from '../version.genere.js';
import { serialiser, serialiserCharge } from './canonique.js';
import { creer, enregistrer, lister, ouvrir, ouvrirSecours, verrouiller } from './depot.js';
import { analyser, creerCharge } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { lireJournal, reconstruire } from './journal.js';
import { SUFFIXES, deriverBase } from './noms.js';
import {
  chargerDemonstration,
  copier,
  importer,
  importerDepuis,
  listerCorbeille,
  renommer,
  supprimer,
} from './operations.js';

const V1 = VERSION.affichee;

// La racine documents du système d'épreuve, à son chemin par défaut.
const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };

const BASE = 'Soirée des Lucioles';
const ETAT = `${BASE}${SUFFIXES.etat}`;
const PRECEDENT = `${BASE}${SUFFIXES.precedent}`;
const JOURNAL = `${BASE}${SUFFIXES.journal}`;
const VERROU = `${BASE}${SUFFIXES.verrou}`;

const REPRISE = "Reprise de l'état trouvé sur le disque";
const UTF8 = new TextEncoder();

// Le texte tel que l'écrit un éditeur réglé en Windows-1252 : un octet par
// caractère, « é » donnant E9, qui n'est pas de l'UTF-8. Le texte ne porte
// que des caractères que Windows-1252 code comme ISO 8859-1, sur leur point
// de code.
function enWindows1252(texte) {
  const points = Array.from(texte, (caractere) => caractere.codePointAt(0));
  assert.ok(points.every((point) => point < 0x80 || (point >= 0xa0 && point <= 0xff)));
  return Uint8Array.from(points);
}

// Horodatage d'affichage de l'instant n : une minute par instant à partir de
// 8 h, le 17 mai 2031, à l'heure de l'Est.
function heure(n) {
  const minutes = 8 * 60 + n;
  const deux = (valeur) => String(valeur).padStart(2, '0');
  return `2031-05-17T${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}:00-04:00`;
}

// La suppression tombe à 8 h 30, et son dossier daté.
const HEURE_SUPPRESSION = heure(30);
const DATE = 'corbeille/2031-05-17_08-30-00';

const CREATION = { libelle: "Création de l'événement", nomJalon: 'Création', horodatage: heure(0), produitVersion: V1 };
const geste = (n, plus = {}) => ({ libelle: `Geste ${n}`, horodatage: heure(n), produitVersion: V1, ...plus });

// --- Les charges -----------------------------------------------------------

const personne = (id, nom, prenom, appartenance) => ({
  id,
  nom,
  prenom,
  appartenance,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

const table = (id, x) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x, y: 0 } });

// Une proposition de deux tours sur les tables 1 et 2, deux places chacune.
function proposition(id) {
  return {
    id,
    graine: 48271 + id,
    arret: 200000,
    historique: 1000,
    produitVersion: V1,
    siegesAttribues: false,
    tables: [1, 2],
    capacites: [2, 2],
    tours: 2,
    participants: [1, 2, 3, 4],
    placement: [
      { sieges: [[1, 3], [2, 4]], reserve: [] },
      { sieges: [[1, 4], [2, 3]], reserve: [] },
    ],
  };
}

// Le retenu tiré d'une proposition, ses champs d'identification retirés.
function retenuDe({ id, siegesAttribues, tables, capacites, tours, participants, placement }) {
  return { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
}

// Charge d'épreuve : quatre personnes, deux tables, une réservation, un titre,
// une proposition.
function chargeEssai({ id = 'evt-lucioles', nom = BASE } = {}) {
  const charge = creerCharge({ id, nom, siegesParDefaut: 2, tours: 2 });
  charge.evenement.etat = 'propose';
  charge.prochainsIds = { participant: 5, table: 3, proposition: 2 };
  charge.participants = [
    personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
    personne(2, 'Grisaille', null, 'Club des Merles'),
    personne(3, 'Pervenche', 'Théo', null),
    personne(4, 'Lacasse', 'Ondine', 'Société Alpha'),
  ];
  charge.tables = [table(1, 0), table(2, 250)];
  charge.reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
  charge.titres = [{ table: 1, siege: 1, libelle: 'animation' }];
  charge.propositions = [proposition(1)];
  return charge;
}

// La charge reçue, la note de sa première personne changée : un geste.
function noter(charge, n) {
  const suivante = structuredClone(charge);
  suivante.participants[0].notes = `note ${n}`;
  return suivante;
}

// La charge reçue, son plan bloqué.
function bloquer(charge) {
  const suivante = structuredClone(charge);
  suivante.evenement.etat = 'bloque';
  return suivante;
}

const texteDeCharge = (charge) => serialiserCharge(charge);
const etatTexte = (charge, revision = 1) => serialiser(charge, { revision, produitVersion: V1 });

// Le fichier d'état de charge au format 2 : l'événement porte une clé que le
// format 1 ne connaît pas ; sansNom lui retire son nom.
function formatDeux(charge, { sansNom = false } = {}) {
  const fichier = JSON.parse(etatTexte(charge));
  fichier.entete.format = 2;
  fichier.charge.evenement.couleur = 'ocre';
  if (sansNom) delete fichier.charge.evenement.nom;
  return `${JSON.stringify(fichier, null, 2)}\n`;
}

// --- Les disques -----------------------------------------------------------

// Un disque neuf dont la racine documents existe, et son premier processus.
function nouveauDisque(options = {}) {
  const disque = new Map();
  const fs = creerFichiersSimules({ disque, ...options });
  fs.deposerDossier('documents');
  return { disque, fs };
}

// Un disque neuf dont documents porte les fichiers [nom, texte].
function disqueAvec(fichiers, options = {}) {
  const { disque, fs } = nouveauDisque(options);
  for (const [nom, texte] of fichiers) fs.deposer('documents', nom, texte);
  return { disque, fs };
}

const parChemin = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0);

// Fichiers de racine à toute profondeur, [chemin, texte] triés par chemin,
// lus par un processus à part, que reglages décrit — l'exécutable publié pour
// la racine portable.
async function arbre(disque, racine = DOC, reglages = {}) {
  const lecteur = creerFichiersSimules({ disque, ...reglages });
  const fichiers = [];
  const parcourir = async (dossier) => {
    for (const { nom, type } of await lecteur.lister(racine, dossier)) {
      const chemin = dossier === '' ? nom : `${dossier}/${nom}`;
      if (type === 'dossier') await parcourir(chemin);
      else fichiers.push([chemin, lecteur.contenu(racine.id, chemin)]);
    }
  };
  await parcourir('');
  return fichiers.sort(parChemin);
}

// Ouvre base par un processus neuf, en affirmant qu'ouvrir n'écrit rien.
async function rouvrir(disque, base) {
  const fs = creerFichiersSimules({ disque });
  const ouvert = await ouvrir(fs, DOC, base);
  assert.equal(fs.compteurs.ecritures, 0, 'ouvrir écrit');
  return ouvert;
}

// Inscrit, dans l'ordre, chaque appel d'une primitive d'écriture de fichier ou
// de dossier : [primitive, chemin], ou [primitive, de, vers] pour deplacer.
function tracer(fs) {
  const trace = [];
  for (const nom of ['ecrireAtomique', 'ajouterLigne', 'creerDossier', 'deplacer', 'supprimer']) {
    const primitive = fs[nom];
    fs[nom] = (racine, ...reste) => {
      trace.push([nom, ...reste.slice(0, nom === 'deplacer' ? 2 : 1)]);
      return primitive(racine, ...reste);
    };
  }
  return trace;
}

// Efface du disque le dossier documents et tout ce qu'il porte juste avant
// la primitive d'écriture de rang n du processus, la première pour n = 0,
// comme un dossier de travail supprimé dans l'explorateur, ou retiré par un
// agent de synchronisation, en cours de séance : sa liste lève ensuite
// ABSENT, et une écriture ECRITURE, cause ENOENT. Rend un témoin dont efface
// devient vrai quand l'effacement a lieu.
function effacerDocumentsAvant(disque, fs, n) {
  const temoin = { efface: false };
  const nom = DOCUMENTS.slice(DOCUMENTS.lastIndexOf('\\') + 1);
  let rang = 0;
  for (const primitive of ['ecrireAtomique', 'ajouterLigne', 'creerDossier', 'deplacer', 'supprimer']) {
    const appeler = fs[primitive];
    fs[primitive] = (...parametres) => {
      if (rang === n) {
        const [cle] = [...disque].find(([, noeud]) => noeud.type === 'dossier' && noeud.nom === nom);
        for (const autre of [...disque.keys()]) {
          if (autre === cle || autre.startsWith(`${cle}\\`)) disque.delete(autre);
        }
        temoin.efface = true;
      }
      rang += 1;
      return appeler(...parametres);
    };
  }
  return temoin;
}

// Rend la raison du rejet, une ErreurStockage du code attendu ; message nomme
// le cas d'une boucle.
async function echec(promesse, code, message = '') {
  let raison;
  await assert.rejects(
    promesse,
    (erreur) => {
      raison = erreur;
      return true;
    },
    message,
  );
  assert.ok(raison instanceof ErreurStockage, `${message} ${String(raison)}`);
  assert.equal(raison.code, code, `${message} ${String(raison)}`);
  return raison;
}

// Un geste ⇔ une entrée ⇔ un état (§ 8.2) : la dernière entrée du journal
// porte la révision de l'état et restitue exactement sa charge.
function exigerEquivalence(fs, base, { racine = 'documents', journal = base } = {}) {
  const etat = analyser(fs.contenu(racine, `${base}${SUFFIXES.etat}`));
  const lu = lireJournal(fs.contenu(racine, `${journal}${SUFFIXES.journal}`));
  const derniere = lu.entrees.at(-1);
  assert.equal(lu.ecartees, 0);
  assert.equal(derniere.revision, etat.entete.revision);
  assert.equal(texteDeCharge(reconstruire(lu, derniere.revision)), texteDeCharge(etat.charge));
  return lu;
}

const revisionsEtLibelles = (journal) => journal.entrees.map(({ revision, libelle }) => [revision, libelle]);

// Un événement de deux révisions sur un disque neuf : créé, puis noté ; le
// .precedent porte la révision 1.
async function deuxRevisions(charge = chargeEssai(), options = {}) {
  const { disque, fs } = nouveauDisque(options);
  let ouvert = await creer(fs, DOC, charge, CREATION);
  ouvert = await enregistrer(ouvert, noter(ouvert.charge, 2), geste(2));
  return { disque, fs, ouvert };
}

// Les textes de l'état et du journal d'un événement de deux révisions, créé
// sur un disque à part.
async function paireDe(charge) {
  const { fs, ouvert } = await deuxRevisions(charge);
  return {
    etat: fs.contenu('documents', `${ouvert.base}${SUFFIXES.etat}`),
    journal: fs.contenu('documents', `${ouvert.base}${SUFFIXES.journal}`),
  };
}

// Chaque événement que lister montre après la coupure d'un renommage de
// BASE en nouvelle, rouvert par un processus neuf, sans rien écrire. depart
// décrit l'ancienne paire : son identifiant, sa révision, ses avertissements,
// et la première révision que la nouvelle garde de son historique. Un
// événement lisible est l'ancienne paire, sous l'ancien nom, à sa révision,
// aux mêmes avertissements — aucun journal neuf ne lui revient, rattrapé ou
// non —, ou la nouvelle, sous le nouveau nom, à la révision qui suit, sans
// avertissement, son journal partant de cette première révision ; le journal
// de chacun restitue sa charge. Ce qui ne se lit pas n'est qu'un journal
// resté sous l'ancienne base, illisible ou d'un autre événement, jamais
// celui-ci sans état. Rend [base, nom, révision] de chaque événement lisible.
async function evenementsApresCoupure(disque, nouvelle, depart, message) {
  const fs = creerFichiersSimules({ disque });
  const lisibles = [];
  for (const { base, id, illisible } of await lister(fs, DOC)) {
    if (illisible !== null) {
      assert.deepEqual([base, illisible], [BASE, 'ABSENT'], `${message} : ${base} ne se lit pas`);
      assert.notEqual(id, depart.id, `${message} : l'événement se liste sans état sous ${base}`);
      continue;
    }
    const ouvert = await ouvrir(fs, DOC, base);
    const ancienne = base === BASE;
    assert.deepEqual(
      [base, ouvert.charge.evenement.nom, ouvert.revision, ouvert.avertissements],
      ancienne ? [BASE, BASE, depart.revision, depart.avertissements] : [nouvelle, nouvelle, depart.revision + 1, []],
      message,
    );
    if (!ancienne) {
      assert.notEqual(ouvert.journal, null, `${message} : ${base} n'a pas de journal`);
      assert.equal(ouvert.journal.entrees[0].revision, depart.premiere, `${message} : ${base} a perdu son historique`);
    }
    if (ouvert.journal !== null) {
      assert.equal(
        texteDeCharge(reconstruire(ouvert.journal, ouvert.revision)),
        texteDeCharge(ouvert.charge),
        `${message} : le journal de ${base} ne restitue pas sa charge`,
      );
    }
    lisibles.push([base, ouvert.charge.evenement.nom, ouvert.revision]);
  }
  assert.equal(fs.compteurs.ecritures, 0, `${message} : lister ou ouvrir écrit`);
  return lisibles;
}

// Les options d'une copie nommée nom.
const optionsCopie = (nom, plus = {}) => ({
  id: 'evt-variante',
  nom,
  libelle: `Créée par copie de ${BASE}`,
  nomJalon: 'Création',
  horodatage: heure(10),
  produitVersion: V1,
  ...plus,
});

// Les options d'un renommage en nom à l'instant n, au libellé « Renommé ».
const renommage = (nom, n, plus = {}) => ({
  nom,
  libelle: 'Renommé',
  horodatage: heure(n),
  produitVersion: V1,
  ...plus,
});

// Les options du chargement d'une démonstration sous l'identifiant id, à
// l'instant n, au libellé « Chargée ».
const chargement = (id, n) => ({
  id,
  libelle: 'Chargée',
  nomJalon: 'Création',
  horodatage: heure(n),
  produitVersion: V1,
});

describe('opérations : copier (§ 8.7)', () => {
  test("copier un plan bloqué : identité et nom reçus, journal d'une entrée en instantané et son jalon, filiation de l'instant copié, état déduit du contenu ; l'original reste octet pour octet", async () => {
    const avecRetenu = chargeEssai();
    avecRetenu.retenu = retenuDe(proposition(1));
    const sansProposition = chargeEssai();
    sansProposition.propositions = [];
    // Par cas : la charge d'origine, que le geste 2 bloque, et l'état que son
    // contenu impose à la copie.
    const cas = [
      ['un retenu', avecRetenu, 'retenu'],
      ['des propositions', chargeEssai(), 'propose'],
      ['ni proposition ni retenu', sansProposition, 'brouillon'],
    ];
    const variante = 'Variante des Lucioles';
    for (const [nom, depart, etat] of cas) {
      const { disque, fs } = nouveauDisque();
      let ouvert = await creer(fs, DOC, depart, CREATION);
      ouvert = await enregistrer(ouvert, bloquer(ouvert.charge), { ...geste(2), libelle: 'Plan bloqué' });
      const avant = await arbre(disque);
      const trace = tracer(fs);
      const options = optionsCopie(variante, { libelle: `Créée par copie de ${BASE}, à l'instant « Plan bloqué »` });
      const copie = await copier(ouvert, options);
      assert.deepEqual(
        trace,
        [
          ['ecrireAtomique', `${variante}${SUFFIXES.journal}`],
          ['ecrireAtomique', `${variante}${SUFFIXES.etat}`],
        ],
        nom,
      );
      assert.deepEqual(
        (await arbre(disque)).filter(([chemin]) => !chemin.startsWith(variante)),
        avant,
        nom,
      );

      const attendue = structuredClone(ouvert.charge);
      attendue.evenement = {
        ...attendue.evenement,
        id: 'evt-variante',
        nom: variante,
        etat,
        filiation: { source: { id: 'evt-lucioles', nom: BASE }, instant: { revision: 2, libelle: 'Plan bloqué' } },
      };
      assert.equal(texteDeCharge(copie.charge), texteDeCharge(attendue), nom);
      assert.deepEqual([copie.base, copie.revision, copie.avertissements], [variante, 1, []], nom);
      const journal = lireJournal(fs.contenu('documents', `${variante}${SUFFIXES.journal}`));
      assert.equal(journal.evenement, 'evt-variante', nom);
      assert.deepEqual(
        journal.entrees.map(({ revision, libelle, instantane }) => [revision, libelle, instantane === null]),
        [[1, options.libelle, false]],
        nom,
      );
      assert.deepEqual(
        journal.jalons.map(({ revision, nom: jalon }) => [revision, jalon]),
        [[1, 'Création']],
        nom,
      );
      exigerEquivalence(fs, variante);
      const rouverte = await rouvrir(disque, variante);
      assert.equal(texteDeCharge(rouverte.charge), texteDeCharge(attendue), nom);
      assert.deepEqual(rouverte.avertissements, [], nom);
    }
  });

  test("la filiation nomme l'instant que l'Ouvert restitue : l'entrée de sa révision, celle d'un secours ; sans entrée, le libellé de reprise, requis avant toute écriture ; une base prise se dérive", async () => {
    const { disque, fs, ouvert } = await deuxRevisions();
    await enregistrer(ouvert, noter(ouvert.charge, 3), geste(3));
    const secours = await ouvrirSecours(fs, DOC, BASE, 'precedent');
    assert.equal(secours.revision, 2);
    const copie = await copier(secours, optionsCopie(BASE));
    assert.deepEqual(copie.charge.evenement.filiation, {
      source: { id: 'evt-lucioles', nom: BASE },
      instant: { revision: 2, libelle: 'Geste 2' },
    });
    assert.equal(copie.charge.participants[0].notes, 'note 2');
    assert.equal(copie.base, `${BASE} (2)`);
    assert.equal(fs.contenu('documents', ETAT), etatTexte(noter(noter(chargeEssai(), 2), 3), 3));
    assert.ok((await arbre(disque)).some(([chemin]) => chemin === `${BASE} (2)${SUFFIXES.journal}`));

    // Un état sans journal, à la révision 4 : son instant n'a pas d'entrée.
    const seul = disqueAvec([[ETAT, etatTexte(chargeEssai(), 4)]]);
    const sansJournal = await rouvrir(seul.disque, BASE);
    await assert.rejects(copier(sansJournal, optionsCopie('Variante des Lucioles')), TypeError);
    await assert.rejects(copier(sansJournal, optionsCopie('', { libelleReprise: REPRISE })), TypeError);
    assert.equal(sansJournal.fs.compteurs.ecritures, 0);
    const reprise = await copier(sansJournal, optionsCopie('Variante des Lucioles', { libelleReprise: REPRISE }));
    assert.deepEqual(reprise.charge.evenement.filiation.instant, { revision: 4, libelle: REPRISE });
  });
});

describe('opérations : renommer (§ 8.7)', () => {
  test("renommer écrit d'abord la paire complète sous la nouvelle base — l'état d'avant au .precedent, le journal recopié avec l'entrée du renommage, puis l'état —, sans écrire l'ancienne ni créer le dossier, puis supprime l'ancienne : état, .precedent, journal ; le verrou reste à la séance, et le geste suivant continue sous la nouvelle base", async () => {
    const { disque, fs, ouvert } = await deuxRevisions();
    assert.deepEqual(await verrouiller(ouvert, 'seance-a'), { pris: true });
    const verrou = fs.contenu('documents', VERROU);
    const etatAvant = fs.contenu('documents', ETAT);
    const nouvelle = 'Gala des Saules';
    const options = renommage(nouvelle, 3, { libelle: 'Renommé en « Gala des Saules »' });
    const trace = tracer(fs);
    const renomme = await renommer(ouvert, options);
    assert.deepEqual(trace, [
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.precedent}`],
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.journal}`],
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.etat}`],
      ['supprimer', ETAT],
      ['supprimer', PRECEDENT],
      ['supprimer', JOURNAL],
    ]);
    assert.deepEqual(
      (await arbre(disque)).map(([chemin]) => chemin),
      [`${nouvelle}${SUFFIXES.journal}`, `${nouvelle}${SUFFIXES.etat}`, `${nouvelle}${SUFFIXES.precedent}`, VERROU],
    );
    assert.equal(fs.contenu('documents', `${nouvelle}${SUFFIXES.precedent}`), etatAvant);
    assert.equal(fs.contenu('documents', VERROU), verrou);

    const attendue = noter(chargeEssai(), 2);
    attendue.evenement.nom = nouvelle;
    assert.deepEqual(
      [renomme.base, renomme.baseJournal, renomme.revision, renomme.charge.evenement.nom],
      [nouvelle, nouvelle, 3, nouvelle],
    );
    assert.equal(texteDeCharge(renomme.charge), texteDeCharge(attendue));
    const journal = exigerEquivalence(fs, nouvelle);
    assert.equal(journal.evenement, 'evt-lucioles');
    assert.deepEqual(revisionsEtLibelles(journal), [
      [1, CREATION.libelle],
      [2, 'Geste 2'],
      [3, options.libelle],
    ]);
    assert.deepEqual(
      journal.jalons.map(({ revision, nom }) => [revision, nom]),
      [[1, 'Création']],
    );

    const rouvert = await rouvrir(disque, nouvelle);
    assert.deepEqual([rouvert.revision, rouvert.avertissements], [3, []]);
    const lecteur = creerFichiersSimules({ disque });
    assert.deepEqual(
      (await lister(lecteur, DOC)).map(({ base, nom, journal: apparie }) => [base, nom, apparie]),
      [[nouvelle, nouvelle, nouvelle]],
    );

    const suite = await enregistrer(renomme, noter(renomme.charge, 4), geste(4));
    assert.deepEqual([suite.base, suite.revision], [nouvelle, 4]);
    exigerEquivalence(fs, nouvelle);
  });

  test("une coupure à chaque écriture et à chaque suppression laisse au moins une paire, deux dès que la nouvelle est complète, jamais aucune ; l'ancienne garde ses octets et s'ouvre sous l'ancien nom sans jamais s'apparier le journal neuf, que le journal de sa base soit le sien ou non — état importé sans journal, journal d'un autre événement, journal illisible, journal sous une autre base que le nouveau nom précède — ; achevé, une seule paire, sous la nouvelle base", async () => {
    const nouvelle = 'Gala des Saules';
    const etranger = (await paireDe(chargeEssai({ id: 'evt-gala', nom: "Gala d'automne" }))).journal;
    const sien = await paireDe(chargeEssai());
    const registre = `Registre des Lucioles${SUFFIXES.journal}`;
    // Par cas : les fichiers de l'événement de départ, posés sur un disque
    // neuf, et la première révision que le journal de la nouvelle paire garde.
    const cas = [
      [
        'un événement de deux révisions',
        [
          [ETAT, sien.etat],
          [PRECEDENT, etatTexte(chargeEssai())],
          [JOURNAL, sien.journal],
        ],
        1,
      ],
      ['un état importé, sans journal', [[ETAT, etatTexte(chargeEssai(), 4)]], 4],
      ["un journal de la base d'un autre événement", [[ETAT, etatTexte(chargeEssai())], [JOURNAL, etranger]], 1],
      ['un journal de la base illisible', [[ETAT, etatTexte(chargeEssai(), 4)], [JOURNAL, '{"type":"jour']], 4],
      ['un journal sous une autre base, après le nouveau nom', [[ETAT, sien.etat], [registre, sien.journal]], 1],
    ];
    for (const [nom, poses, premiere] of cas) {
      let deuxPaires = 0;
      for (let n = 0; ; n += 1) {
        const { disque, fs } = disqueAvec(poses);
        const ouvert = await ouvrir(fs, DOC, BASE);
        const { revision, avertissements } = ouvert;
        const depart = { id: 'evt-lucioles', revision, avertissements, premiere };
        const avant = new Map(await arbre(disque));
        fs.pannes.couperApres(n);
        let acheve = true;
        try {
          await renommer(ouvert, renommage(nouvelle, 5, { libelleReprise: REPRISE }));
        } catch (erreur) {
          assert.ok(erreur instanceof PanneSimulee, `${nom}, coupure après ${n} écritures : ${String(erreur)}`);
          acheve = false;
        }
        const message = `${nom}, coupure après ${n} écritures`;
        // Rien de ce que le dossier portait ne se réécrit : chaque fichier
        // reste octet pour octet, ou s'en va ; seule la nouvelle base reçoit.
        for (const [chemin, texte] of await arbre(disque)) {
          if (avant.has(chemin)) assert.equal(texte, avant.get(chemin), `${message} : ${chemin} réécrit`);
          else assert.ok(chemin.startsWith(`${nouvelle}.`), `${message} : ${chemin} écrit`);
        }
        const lisibles = await evenementsApresCoupure(disque, nouvelle, depart, message);
        assert.ok(lisibles.length >= 1, `${message} : aucune paire ne s'ouvre`);
        if (lisibles.length === 2) deuxPaires += 1;
        if (acheve) {
          assert.deepEqual(lisibles, [[nouvelle, nouvelle, revision + 1]], message);
          break;
        }
      }
      assert.ok(deuxPaires >= 1, `${nom} : aucune coupure ne laisse les deux paires`);
    }
  });

  test("un refus avant que la nouvelle paire soit complète laisse l'ancienne octet pour octet et l'Ouvert reçu d'où continuer — .precedent, journal ou état neufs refusés —, ce que la recopie a écrit s'effaçant quand le support le permet, le journal d'abord, son .precedent seulement après lui ; un refus pendant la suppression de l'ancienne remonte avec l'Ouvert de la nouvelle", async () => {
    const nouvelle = 'Gala des Saules';
    const journalNeuf = `${nouvelle}${SUFFIXES.journal}`;
    const etatNeuf = `${nouvelle}${SUFFIXES.etat}`;
    const precedentNeuf = `${nouvelle}${SUFFIXES.precedent}`;
    const refus = (chemin) => new ErreurStockage('ECRITURE', { chemin, dossier: DOCUMENTS, cause: 'EBUSY' });
    // Pièges posés sur le processus : l'écriture atomique, ou la suppression,
    // du chemin donné est refusée.
    const refuserEcriture = (fs, chemin) => {
      const ecrire = fs.ecrireAtomique;
      fs.ecrireAtomique = async (racine, cible, texte) => {
        if (cible === chemin) throw refus(cible);
        return ecrire(racine, cible, texte);
      };
    };
    const refuserSuppression = (fs, chemin) => {
      const effacer = fs.supprimer;
      fs.supprimer = async (racine, cible) => {
        if (cible === chemin) throw refus(cible);
        return effacer(racine, cible);
      };
    };
    // Par cas : le piège, le chemin refusé, la base d'où continuer, les
    // fichiers de la nouvelle paire que le dossier porte après le refus, et
    // les bases que lister montre alors, chacune avec son drapeau doublon.
    const cas = [
      [
        'le .precedent neuf refusé',
        (fs) => refuserEcriture(fs, precedentNeuf),
        precedentNeuf,
        BASE,
        [],
        [[BASE, false]],
      ],
      ['le journal neuf refusé', (fs) => refuserEcriture(fs, journalNeuf), journalNeuf, BASE, [], [[BASE, false]]],
      [
        "le journal neuf refusé, et le .precedent neuf qui ne s'efface pas",
        (fs) => {
          refuserEcriture(fs, journalNeuf);
          refuserSuppression(fs, precedentNeuf);
        },
        journalNeuf,
        BASE,
        [precedentNeuf],
        [[BASE, false]],
      ],
      ["l'état neuf refusé", (fs) => refuserEcriture(fs, etatNeuf), etatNeuf, BASE, [], [[BASE, false]]],
      [
        "l'état neuf refusé, et le journal neuf qui ne s'efface pas",
        (fs) => {
          refuserEcriture(fs, etatNeuf);
          refuserSuppression(fs, journalNeuf);
        },
        etatNeuf,
        BASE,
        [journalNeuf, precedentNeuf],
        [[BASE, false]],
      ],
      [
        "l'ancien état qui ne se supprime pas",
        (fs) => refuserSuppression(fs, ETAT),
        ETAT,
        nouvelle,
        [journalNeuf, etatNeuf, precedentNeuf],
        [
          [nouvelle, true],
          [BASE, true],
        ],
      ],
    ];
    for (const [nom, pieger, chemin, base, neufs, listees] of cas) {
      const { disque, fs, ouvert } = await deuxRevisions();
      const avant = await arbre(disque);
      pieger(fs);
      const erreur = await echec(renommer(ouvert, renommage(nouvelle, 3)), 'ECRITURE', nom);
      const { ouvert: suite = ouvert, ...details } = erreur.details;
      assert.deepEqual(details, { chemin, dossier: DOCUMENTS, cause: 'EBUSY' }, nom);
      const apres = await arbre(disque);
      assert.deepEqual(
        apres.filter(([fichier]) => !neufs.includes(fichier)),
        avant,
        nom,
      );
      assert.deepEqual(
        apres.map(([fichier]) => fichier).filter((fichier) => neufs.includes(fichier)),
        neufs,
        nom,
      );
      assert.deepEqual(
        (await lister(creerFichiersSimules({ disque }), DOC)).map((resume) => [resume.base, resume.doublon]),
        listees,
        nom,
      );
      const attendu = base === BASE ? [BASE, BASE, 2] : [nouvelle, nouvelle, 3];
      assert.deepEqual([suite.base, suite.charge.evenement.nom, suite.revision], attendu, nom);
      const avance = await enregistrer(suite, noter(suite.charge, 4), geste(4));
      assert.equal(avance.revision, suite.revision + 1, nom);
      assert.deepEqual(
        revisionsEtLibelles(exigerEquivalence(fs, base)).slice(-2),
        [
          [suite.revision, base === BASE ? 'Geste 2' : 'Renommé'],
          [avance.revision, 'Geste 4'],
        ],
        nom,
      );
      const rouvert = await rouvrir(disque, base);
      assert.deepEqual(
        [rouvert.revision, rouvert.charge.evenement.nom, rouvert.avertissements],
        [avance.revision, attendu[1], []],
        nom,
      );
    }

    // Un état importé, sans journal à sa base : l'état neuf refusé, et le
    // journal neuf qui ne s'efface pas. Son .precedent reste avec lui, si
    // bien que la nouvelle base appartient à l'événement : l'état importé ne
    // s'apparie pas ce journal, et se rouvre sous l'ancien nom, à sa révision.
    const importe = disqueAvec([[ETAT, etatTexte(chargeEssai(), 4)]]);
    const seul = await ouvrir(importe.fs, DOC, BASE);
    refuserEcriture(importe.fs, etatNeuf);
    refuserSuppression(importe.fs, journalNeuf);
    const refusSeul = await echec(renommer(seul, renommage(nouvelle, 3, { libelleReprise: REPRISE })), 'ECRITURE');
    assert.deepEqual(refusSeul.details, { chemin: etatNeuf, dossier: DOCUMENTS, cause: 'EBUSY' });
    assert.deepEqual(
      (await arbre(importe.disque)).map(([fichier]) => fichier),
      [journalNeuf, precedentNeuf, ETAT],
    );
    const rouvertSeul = await rouvrir(importe.disque, BASE);
    assert.deepEqual(
      [rouvertSeul.charge.evenement.nom, rouvertSeul.revision, rouvertSeul.journal, rouvertSeul.avertissements],
      [BASE, 4, null, []],
    );

    // Le processus coupé pendant l'effacement du journal neuf : la panne
    // remonte telle quelle, sans se donner pour un refus d'écriture.
    const coupe = await deuxRevisions();
    const ecrire = coupe.fs.ecrireAtomique;
    coupe.fs.ecrireAtomique = async (racine, cible, texte) => {
      if (cible !== etatNeuf) return ecrire(racine, cible, texte);
      coupe.fs.pannes.couperApres(0);
      throw refus(cible);
    };
    await assert.rejects(renommer(coupe.ouvert, renommage(nouvelle, 3)), PanneSimulee);
  });

  test("un dossier de travail qui disparaît pendant le renommage ne renaît pas : à chaque écriture avant laquelle il disparaît, renommer lève ECRITURE, ENOENT, ou achève, sans jamais créer de dossier", async () => {
    const nouvelle = 'Gala des Saules';
    // Rangs où le dossier a disparu : au moins un par primitive que le
    // renommage appelle — trois écritures, trois suppressions —, sans quoi le
    // balayage n'a rien éprouvé.
    let effacements = 0;
    for (let n = 0; ; n += 1) {
      const { disque, fs, ouvert } = await deuxRevisions();
      const temoin = effacerDocumentsAvant(disque, fs, n);
      const trace = tracer(fs);
      let refus = null;
      try {
        await renommer(ouvert, renommage(nouvelle, 3));
      } catch (erreur) {
        refus = erreur;
      }
      const message = `dossier effacé avant l'écriture de rang ${n}`;
      const enoent = refus instanceof ErreurStockage && refus.code === 'ECRITURE' && refus.details.cause === 'ENOENT';
      assert.ok(refus === null || enoent, `${message} : ${String(refus)}`);
      assert.deepEqual(
        trace.filter(([primitive]) => primitive === 'creerDossier'),
        [],
        message,
      );
      if (!temoin.efface) {
        assert.equal(refus, null, message);
        break;
      }
      effacements += 1;
      await echec(creerFichiersSimules({ disque }).lister(DOC, ''), 'ABSENT', message);
    }
    assert.ok(effacements >= 6, `${effacements} rangs éprouvés, 6 attendus au moins`);
  });

  test("un nom inchangé, aux blancs de bord près, ne touche à rien : aucune écriture — ni entrée, ni recopie, ni suppression — et l'Ouvert reçu revient, même sous une autre base que celle que le nom dérive", async () => {
    const { disque, fs, ouvert } = await deuxRevisions();
    const avant = await arbre(disque);
    const ecritures = fs.compteurs.ecritures;
    const trace = tracer(fs);
    for (const nom of [BASE, `  ${BASE} `, `\t${BASE}\n`]) {
      assert.equal(await renommer(ouvert, renommage(nom, 3)), ouvert, JSON.stringify(nom));
    }
    assert.deepEqual([trace, fs.compteurs.ecritures], [[], ecritures]);
    assert.deepEqual(await arbre(disque), avant);

    // Le nom de la charge porte lui-même des blancs de bord : le même nom
    // sans eux ne change rien non plus.
    const borde = disqueAvec([[ETAT, etatTexte(chargeEssai({ nom: ` ${BASE}  ` }))]]);
    const ouvertBorde = await rouvrir(borde.disque, BASE);
    const traceBorde = tracer(ouvertBorde.fs);
    assert.equal(await renommer(ouvertBorde, renommage(BASE, 3)), ouvertBorde);
    assert.deepEqual(traceBorde, []);

    // Créé quand un autre événement tenait la base de son nom, l'événement a
    // pris « (2) » ; l'autre parti à la corbeille, son nom dériverait la base
    // libérée. Il reste sous « (2) » : seul un geste change un fichier
    // (§ 8.2), et garder son nom n'en est pas un.
    const gala = 'Gala des Saules';
    const deux = `${gala} (2)`;
    const { disque: disqueDeux, fs: second } = nouveauDisque();
    await creer(second, DOC, chargeEssai({ id: 'evt-autre', nom: gala }), CREATION);
    let ouvertDeux = await creer(second, DOC, chargeEssai({ nom: gala }), CREATION);
    ouvertDeux = await enregistrer(ouvertDeux, noter(ouvertDeux.charge, 2), geste(2));
    assert.equal(ouvertDeux.base, deux);
    await supprimer(second, DOC, gala, { horodatage: HEURE_SUPPRESSION });
    const avantDeux = await arbre(disqueDeux);
    const ecrituresDeux = second.compteurs.ecritures;
    const traceDeux = tracer(second);
    assert.equal(await renommer(ouvertDeux, renommage(` ${gala}`, 3)), ouvertDeux);
    assert.deepEqual([traceDeux, second.compteurs.ecritures], [[], ecrituresDeux]);
    assert.deepEqual(await arbre(disqueDeux), avantDeux);

    // Un état sans journal sous « (2) », de même.
    const seul = disqueAvec([[`${deux}${SUFFIXES.etat}`, etatTexte(chargeEssai({ nom: gala }), 2)]]);
    const sansJournal = await rouvrir(seul.disque, deux);
    const traceSeul = tracer(sansJournal.fs);
    assert.equal(await renommer(sansJournal, renommage(gala, 3)), sansJournal);
    assert.deepEqual(traceSeul, []);
    assert.deepEqual(
      (await arbre(seul.disque)).map(([chemin]) => chemin),
      [`${deux}${SUFFIXES.etat}`],
    );
  });

  test("un nouveau nom qui dérive vers la base de l'événement, ses fichiers mis à part, se renomme en place : un seul geste, aucune suppression ; une base prise par un autre fichier se dérive", async () => {
    // Par cas : le nom de l'événement, son nouveau nom, et le nom d'un autre
    // événement créé avant lui, ou null.
    const cas = [
      ['un caractère que Windows refuse', BASE, `${BASE}?`, null],
      ['la casse seule', BASE, 'SOIRÉE DES LUCIOLES', null],
      ['la base « (2) » qu’il occupe déjà', `${BASE}*`, BASE, BASE],
    ];
    for (const [nom, ancien, nouveau, autre] of cas) {
      const { fs } = nouveauDisque();
      if (autre !== null) await creer(fs, DOC, chargeEssai({ id: 'evt-autre', nom: autre }), CREATION);
      const ouvert = await creer(fs, DOC, chargeEssai({ nom: ancien }), CREATION);
      const { base } = ouvert;
      const trace = tracer(fs);
      const renomme = await renommer(ouvert, renommage(nouveau, 2));
      assert.deepEqual(
        trace,
        [
          ['ajouterLigne', `${base}${SUFFIXES.journal}`],
          ['ecrireAtomique', `${base}${SUFFIXES.precedent}`],
          ['ecrireAtomique', `${base}${SUFFIXES.etat}`],
        ],
        nom,
      );
      assert.deepEqual([renomme.base, renomme.charge.evenement.nom, renomme.revision], [base, nouveau, 2], nom);
      exigerEquivalence(fs, base);
    }

    // Une racine de 193 unités laisse quatre unités à la base, aucune au
    // rang « (2) » : le nom qui tombe sur la base de l'événement se renomme
    // encore en place.
    const longue = `C:\\${'x'.repeat(190)}`;
    const borne = nouveauDisque({ documents: longue });
    const racine = { id: 'documents', chemin: longue };
    const gala = await creer(borne.fs, racine, chargeEssai({ nom: 'Gala' }), CREATION);
    const majuscules = await renommer(gala, renommage('GALA', 2));
    assert.deepEqual([gala.base, majuscules.base, majuscules.charge.evenement.nom], ['Gala', 'Gala', 'GALA']);

    // La base du nouveau nom porte déjà un fichier, d'une autre casse.
    const { fs } = disqueAvec([['GALA DES SAULES.gtt.verrou', '{}\n']]);
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const renomme = await renommer(ouvert, renommage('Gala des Saules', 2));
    assert.equal(renomme.base, 'Gala des Saules (2)');
    assert.equal(fs.contenu('documents', 'GALA DES SAULES.gtt.verrou'), '{}\n');
    exigerEquivalence(fs, 'Gala des Saules (2)');
  });

  test("renommer ne supprime jamais le journal d'un autre événement, que porte l'ancienne base, et ne crée de journal que sous la nouvelle, la reprise, requise, avant l'entrée du renommage ; le journal de l'événement sous une autre base part avec l'ancienne paire", async () => {
    const etranger = (await paireDe(chargeEssai({ id: 'evt-gala', nom: "Gala d'automne" }))).journal;
    const { disque } = disqueAvec([
      [ETAT, etatTexte(chargeEssai())],
      [JOURNAL, etranger],
    ]);
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ETRANGER', details: { evenement: 'evt-gala' } }]);
    const nouvelle = 'Bal des Hérons';
    const options = renommage(nouvelle, 2);
    await assert.rejects(renommer(ouvert, options), TypeError);
    assert.equal(ouvert.fs.compteurs.ecritures, 0);

    const trace = tracer(ouvert.fs);
    const renomme = await renommer(ouvert, { ...options, libelleReprise: REPRISE });
    assert.deepEqual(trace, [
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.precedent}`],
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.journal}`],
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.etat}`],
      ['supprimer', ETAT],
      ['supprimer', PRECEDENT],
    ]);
    assert.equal(renomme.base, nouvelle);
    assert.deepEqual(await arbre(disque), [
      [`${nouvelle}${SUFFIXES.journal}`, ouvert.fs.contenu('documents', `${nouvelle}${SUFFIXES.journal}`)],
      [`${nouvelle}${SUFFIXES.etat}`, ouvert.fs.contenu('documents', `${nouvelle}${SUFFIXES.etat}`)],
      [`${nouvelle}${SUFFIXES.precedent}`, etatTexte(chargeEssai())],
      [JOURNAL, etranger],
    ]);
    assert.deepEqual(revisionsEtLibelles(exigerEquivalence(ouvert.fs, nouvelle)), [
      [1, REPRISE],
      [2, 'Renommé'],
    ]);

    // Le journal de l'événement sous une autre base, celui d'un autre sous
    // la sienne : le premier part avec l'ancienne paire, le second reste.
    const sien = await paireDe(chargeEssai());
    const archives = `Archives des Lucioles${SUFFIXES.journal}`;
    const deux = disqueAvec([
      [ETAT, sien.etat],
      [JOURNAL, etranger],
      [archives, sien.journal],
    ]);
    const apparie = await rouvrir(deux.disque, BASE);
    assert.deepEqual([apparie.baseJournal, apparie.avertissements], ['Archives des Lucioles', []]);
    const traceDeux = tracer(apparie.fs);
    await renommer(apparie, renommage(nouvelle, 3));
    assert.deepEqual(traceDeux, [
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.precedent}`],
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.journal}`],
      ['ecrireAtomique', `${nouvelle}${SUFFIXES.etat}`],
      ['supprimer', ETAT],
      ['supprimer', PRECEDENT],
      ['supprimer', archives],
    ]);
    assert.deepEqual(
      (await arbre(deux.disque)).map(([chemin]) => chemin),
      [`${nouvelle}${SUFFIXES.journal}`, `${nouvelle}${SUFFIXES.etat}`, `${nouvelle}${SUFFIXES.precedent}`, JOURNAL],
    );
    assert.equal(apparie.fs.contenu('documents', JOURNAL), etranger);
    assert.deepEqual(revisionsEtLibelles(exigerEquivalence(apparie.fs, nouvelle)), [
      [1, CREATION.libelle],
      [2, 'Geste 2'],
      [3, 'Renommé'],
    ]);
  });
});

describe('opérations : importer un fichier venu d’ailleurs (§ 8.7)', () => {
  test("importer écrit les octets reçus tels quels sous la base que dérive le nom qu'ils portent, sans journal ni conversion — marque d'ordre d'octets, CRLF, mise en page libre et NFD compris ; l'événement s'ouvre ; une base prise se dérive", async () => {
    const charge = chargeEssai({ id: 'evt-herons', nom: 'Bal des He\u{301}rons: été' });
    const texte = `\u{FEFF}${JSON.stringify(JSON.parse(etatTexte(charge)), null, 4).replaceAll('\n', '\r\n')}\r\n`;
    const octets = UTF8.encode(texte);
    const { disque, fs } = nouveauDisque();
    const trace = tracer(fs);
    const { base } = await importer(fs, DOC, octets);
    assert.equal(base, 'Bal des Hérons été');
    assert.deepEqual(trace, [['ecrireAtomique', `${base}${SUFFIXES.etat}`]]);
    assert.deepEqual(UTF8.encode(fs.contenu('documents', `${base}${SUFFIXES.etat}`)), octets);
    const ouvert = await rouvrir(disque, base);
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(charge));
    assert.deepEqual(
      [ouvert.journal, ouvert.revision, ouvert.formatPlusRecent, ouvert.avertissements],
      [null, 1, false, []],
    );

    const autre = UTF8.encode(etatTexte(chargeEssai({ id: 'evt-herons-bis', nom: 'Bal des Hérons été' })));
    assert.deepEqual(await importer(fs, DOC, autre), { base: 'Bal des Hérons été (2)' });
  });

  test("importer refuse ce que la lecture refuse, avec son code et ses détails, sans rien écrire : octets hors UTF-8, dans une chaîne JSON comprise, texte vide, JSON invalide, comptes faux", async () => {
    const comptesFaux = etatTexte(chargeEssai()).replace('"participants":4', '"participants":5');
    // Un état valide en tout, sauf son codage : lu en Windows-1252, il
    // s'analyse ; ses « é » sont des octets E9 à l'intérieur de chaînes JSON.
    const windows1252 = enWindows1252(etatTexte(chargeEssai()));
    assert.ok(windows1252.includes(0xe9));
    assert.equal(analyser(new TextDecoder('windows-1252').decode(windows1252)).charge.evenement.nom, BASE);
    const cas = [
      ['des octets hors UTF-8', Uint8Array.of(0x7b, 0xc3, 0x28, 0x7d), { raison: 'JSON', chemin: null }],
      ['un état écrit en Windows-1252', windows1252, { raison: 'JSON', chemin: null }],
      ['un texte vide', new Uint8Array(0), { raison: 'VIDE', chemin: null }],
      ['du JSON invalide', UTF8.encode('{"entete":'), { raison: 'JSON', chemin: null }],
      ['des comptes faux', UTF8.encode(comptesFaux), { raison: 'COMPTES', chemin: 'entete.comptes.participants' }],
    ];
    for (const [nom, octets, details] of cas) {
      const { disque, fs } = nouveauDisque();
      const erreur = await echec(importer(fs, DOC, octets), 'ETAT_ILLISIBLE', nom);
      assert.deepEqual(erreur.details, details, nom);
      assert.equal(fs.compteurs.ecritures, 0, nom);
      assert.deepEqual(await arbre(disque), [], nom);
    }
    await assert.rejects(importer(nouveauDisque().fs, DOC, etatTexte(chargeEssai())), TypeError);
  });

  test("un identifiant que porte déjà un état lisible du dossier lève IDENTIFIANT_PRESENT {id, base}, quel que soit le nom, sans rien écrire ; ni un état illisible ni un journal sans état ne le portent", async () => {
    const { disque, fs } = nouveauDisque();
    await creer(fs, DOC, chargeEssai(), CREATION);
    const avant = await arbre(disque);
    const ecritures = fs.compteurs.ecritures;
    const octets = UTF8.encode(etatTexte(chargeEssai({ nom: 'Bal des Hérons' })));
    const erreur = await echec(importer(fs, DOC, octets), 'IDENTIFIANT_PRESENT');
    assert.deepEqual(erreur.details, { id: 'evt-lucioles', base: BASE });
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(await arbre(disque), avant);

    const illisible = disqueAvec([[ETAT, '{']]);
    assert.deepEqual(await importer(illisible.fs, DOC, octets), { base: 'Bal des Hérons' });
    const journalSeul = disqueAvec([[JOURNAL, (await paireDe(chargeEssai())).journal]]);
    assert.deepEqual(
      (await lister(journalSeul.fs, DOC)).map(({ base, id, illisible: raison }) => [base, id, raison]),
      [[BASE, 'evt-lucioles', 'ABSENT']],
    );
    assert.deepEqual(await importer(journalSeul.fs, DOC, octets), { base: 'Bal des Hérons' });
  });

  test("un fichier au format 2 s'importe tel quel et s'ouvre en lecture seule ; sans nom lisible, il est refusé avec le code de la lecture", async () => {
    const { disque, fs } = nouveauDisque();
    const texte = formatDeux(chargeEssai());
    assert.deepEqual(await importer(fs, DOC, UTF8.encode(texte)), { base: BASE });
    assert.equal(fs.contenu('documents', ETAT), texte);
    const ouvert = await rouvrir(disque, BASE);
    assert.equal(ouvert.formatPlusRecent, true);
    await echec(enregistrer(ouvert, noter(ouvert.charge, 2), geste(2, { libelleReprise: REPRISE })), 'LECTURE_SEULE');

    const sansNom = nouveauDisque();
    const octets = UTF8.encode(formatDeux(chargeEssai(), { sansNom: true }));
    const erreur = await echec(importer(sansNom.fs, DOC, octets), 'ETAT_ILLISIBLE');
    assert.deepEqual(erreur.details, { raison: 'FORMAT_PLUS_RECENT', chemin: 'charge.evenement.nom', format: 2 });
    assert.equal(sansNom.fs.compteurs.ecritures, 0);
  });
});

describe("opérations : importer depuis l'autre emplacement (§ 8.6)", () => {
  test("importerDepuis copie chaque paire — l'état et le journal qu'ouvrir lui apparie, octets compris — sous une base libre, dans l'ordre des bases reçues ; il recueille chaque refus par base et code, et laisse les originaux", async () => {
    const disque = new Map();
    const PORTABLE = { executable: 'E:\\soirees' };
    const fs = creerFichiersSimules({ disque, ...PORTABLE });
    fs.deposerDossier('portable');
    fs.deposerDossier('documents');
    const { portable, documents } = await fs.racines();
    const lucioles = await paireDe(chargeEssai());
    const saules = await paireDe(chargeEssai({ id: 'evt-saules', nom: 'Fête des Saules' }));
    const herons = etatTexte(chargeEssai({ id: 'evt-herons', nom: 'Bal des Hérons' }), 3);
    // Dans portable : un événement de deux révisions et son .precedent ; un
    // état sans journal ; un état illisible ; un état dont le journal est sous
    // une autre base ; un état dont l'identifiant est déjà dans documents.
    const poses = [
      [ETAT, lucioles.etat],
      [PRECEDENT, etatTexte(chargeEssai())],
      [JOURNAL, lucioles.journal],
      [`Bal des Hérons${SUFFIXES.etat}`, herons],
      [`Gala d'automne${SUFFIXES.etat}`, '{'],
      [`Fête des Saules${SUFFIXES.etat}`, saules.etat],
      [`Archives des Saules${SUFFIXES.journal}`, saules.journal],
      [`Kermesse des Ifs${SUFFIXES.etat}`, etatTexte(chargeEssai({ id: 'evt-ifs', nom: 'Kermesse des Ifs' }))],
    ];
    for (const [nom, texte] of poses) fs.deposer('portable', nom, texte);
    const kermesse = etatTexte(chargeEssai({ id: 'evt-ifs', nom: 'Kermesse' }));
    fs.deposer('documents', `Kermesse${SUFFIXES.etat}`, kermesse);
    const avant = await arbre(disque, portable, PORTABLE);

    const racines = [];
    for (const nom of ['ecrireAtomique', 'ajouterLigne', 'creerDossier', 'deplacer', 'supprimer']) {
      const primitive = fs[nom];
      fs[nom] = (racine, ...reste) => {
        racines.push(racine.id);
        return primitive(racine, ...reste);
      };
    }
    const bases = ['Fête des Saules', "Gala d'automne", BASE, 'Inexistant', 'Kermesse des Ifs', 'Bal des Hérons'];
    assert.deepEqual(await importerDepuis(fs, portable, documents, bases), {
      importes: [
        { base: 'Fête des Saules', nouvelle: 'Fête des Saules' },
        { base: BASE, nouvelle: BASE },
        { base: 'Bal des Hérons', nouvelle: 'Bal des Hérons' },
      ],
      refuses: [
        { base: "Gala d'automne", code: 'ETAT_ILLISIBLE' },
        { base: 'Inexistant', code: 'ABSENT' },
        { base: 'Kermesse des Ifs', code: 'IDENTIFIANT_PRESENT' },
      ],
    });
    assert.ok(racines.length > 0 && racines.every((id) => id === 'documents'), racines.join(' '));
    assert.deepEqual(await arbre(disque, portable, PORTABLE), avant);
    assert.deepEqual(await arbre(disque, documents), [
      [`Bal des Hérons${SUFFIXES.etat}`, herons],
      [`Fête des Saules${SUFFIXES.journal}`, saules.journal],
      [`Fête des Saules${SUFFIXES.etat}`, saules.etat],
      [`Kermesse${SUFFIXES.etat}`, kermesse],
      [JOURNAL, lucioles.journal],
      [ETAT, lucioles.etat],
    ]);
    for (const [base, revision, entrees] of [
      [BASE, 2, 2],
      ['Fête des Saules', 2, 2],
      ['Bal des Hérons', 3, null],
    ]) {
      const ouvert = await rouvrir(disque, base);
      assert.deepEqual(
        [ouvert.revision, ouvert.journal?.entrees.length ?? null, ouvert.avertissements],
        [revision, entrees, []],
        base,
      );
    }
  });

  test("une lecture que le système de fichiers refuse autrement que par l'absence refuse la base par son code, sans rien écrire là-bas", async () => {
    const disque = new Map();
    const PORTABLE = { executable: 'E:\\soirees' };
    const fs = creerFichiersSimules({ disque, ...PORTABLE });
    fs.deposerDossier('portable');
    fs.deposerDossier('documents');
    const { portable, documents } = await fs.racines();
    const lucioles = await paireDe(chargeEssai());
    fs.deposer('portable', ETAT, lucioles.etat);
    fs.deposer('portable', JOURNAL, lucioles.journal);
    // Le support se retire après la lecture d'ouvrir : la recopie du journal
    // échoue.
    const lire = fs.lireTexte;
    let lectures = 0;
    fs.lireTexte = async (racine, chemin) => {
      if (chemin === JOURNAL && (lectures += 1) > 1) {
        throw new ErreurStockage('LECTURE', { chemin, dossier: racine.chemin, cause: 'EIO' });
      }
      return lire(racine, chemin);
    };
    const ecritures = fs.compteurs.ecritures;
    assert.deepEqual(await importerDepuis(fs, portable, documents, [BASE]), {
      importes: [],
      refuses: [{ base: BASE, code: 'LECTURE' }],
    });
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(await arbre(disque, documents), []);
  });
});

describe('opérations : supprimer vers la corbeille (§ 8.7)', () => {
  test("supprimer déplace l'état, le .precedent, le journal apparié, le verrou et les écritures restées dans un seul dossier daté, créé d'abord, l'état en dernier ; listerCorbeille le montre ; le reste du dossier ne bouge pas", async () => {
    const { disque, fs, ouvert } = await deuxRevisions();
    await verrouiller(ouvert, 'seance-a');
    fs.deposer('documents', `${ETAT}.ecriture`, 'partiel');
    fs.deposer('documents', `${JOURNAL}.ecriture`, 'partiel aussi');
    await creer(fs, DOC, chargeEssai({ id: 'evt-herons', nom: 'Bal des Hérons' }), CREATION);
    const avant = await arbre(disque);
    const trace = tracer(fs);
    assert.deepEqual(await supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION }), { dossier: DATE });
    const deplaces = [`${JOURNAL}.ecriture`, `${ETAT}.ecriture`, VERROU, JOURNAL, PRECEDENT, ETAT];
    assert.deepEqual(trace, [['creerDossier', DATE], ...deplaces.map((nom) => ['deplacer', nom, `${DATE}/${nom}`])]);
    assert.deepEqual(
      await arbre(disque),
      avant.map(([chemin, texte]) => [deplaces.includes(chemin) ? `${DATE}/${chemin}` : chemin, texte]).sort(parChemin),
    );
    assert.deepEqual(await listerCorbeille(fs, DOC), [
      { dossier: DATE, fichiers: deplaces.map((nom) => [nom]).sort(parChemin).flat() },
    ]);
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base }) => base),
      ['Bal des Hérons'],
    );
  });

  test('deux suppressions dans la même seconde vont dans deux dossiers, le second suffixé _2 ; listerCorbeille les rend par nom de dossier ; aucune opération ne vide la corbeille', async () => {
    const { disque, fs } = nouveauDisque();
    for (const [id, nom] of [
      ['evt-a', 'Bal des Hérons'],
      ['evt-b', 'Gala des Saules'],
      ['evt-c', 'Fête des Ifs'],
      ['evt-d', BASE],
    ]) {
      await creer(fs, DOC, chargeEssai({ id, nom }), CREATION);
    }
    const suppressions = [];
    const primitive = fs.supprimer;
    fs.supprimer = (racine, chemin) => {
      suppressions.push(chemin);
      return primitive(racine, chemin);
    };
    const a = await supprimer(fs, DOC, 'Bal des Hérons', { horodatage: heure(30) });
    const b = await supprimer(fs, DOC, 'Gala des Saules', { horodatage: heure(30) });
    const c = await supprimer(fs, DOC, 'Fête des Ifs', { horodatage: '2031-05-17T08:29:59-04:00' });
    assert.deepEqual(
      [a, b, c],
      [{ dossier: DATE }, { dossier: `${DATE}_2` }, { dossier: 'corbeille/2031-05-17_08-29-59' }],
    );
    const paire = (nom) => [`${nom}${SUFFIXES.journal}`, `${nom}${SUFFIXES.etat}`];
    const corbeille = [
      { dossier: 'corbeille/2031-05-17_08-29-59', fichiers: paire('Fête des Ifs') },
      { dossier: DATE, fichiers: paire('Bal des Hérons') },
      { dossier: `${DATE}_2`, fichiers: paire('Gala des Saules') },
    ];
    assert.deepEqual(await listerCorbeille(fs, DOC), corbeille);

    // Les opérations qui suivent n'en retirent rien.
    const avant = (await arbre(disque)).filter(([chemin]) => chemin.startsWith('corbeille/'));
    const ouvert = await ouvrir(fs, DOC, BASE);
    const renomme = await renommer(ouvert, renommage('Kermesse des Ifs', 31));
    await copier(renomme, optionsCopie('Variante des Ifs'));
    await importer(fs, DOC, UTF8.encode(etatTexte(chargeEssai({ id: 'evt-e', nom: 'Bal des Hérons' }))));
    await supprimer(fs, DOC, 'Kermesse des Ifs', { horodatage: heure(30) });
    const apres = (await arbre(disque)).filter(([chemin]) => chemin.startsWith('corbeille/'));
    assert.deepEqual(
      apres.filter(([chemin]) => !chemin.startsWith(`${DATE}_3/`)),
      avant,
    );
    assert.deepEqual((await listerCorbeille(fs, DOC)).slice(0, 3), corbeille);
    assert.ok(suppressions.length > 0, 'le renommage supprime son ancienne paire');
    assert.deepEqual(
      suppressions.filter((chemin) => chemin.startsWith('corbeille/')),
      [],
    );
  });

  test("supprimer ne déplace jamais le journal d'un autre événement, que la base porte ; le journal de l'événement sous une autre base part avec lui", async () => {
    const etat = etatTexte(chargeEssai());
    const etranger = (await paireDe(chargeEssai({ id: 'evt-gala', nom: "Gala d'automne" }))).journal;
    const sien = (await paireDe(chargeEssai())).journal;
    const archives = `Archives des Lucioles${SUFFIXES.journal}`;
    // Par cas : les fichiers posés, et ceux qui restent à la racine.
    const cas = [
      ["le journal d'un autre événement sous la base", [[ETAT, etat], [JOURNAL, etranger]], [JOURNAL]],
      [
        "le journal de l'événement sous une autre base, celui d'un autre sous la sienne",
        [[ETAT, etat], [JOURNAL, etranger], [archives, sien]],
        [JOURNAL],
      ],
    ];
    for (const [nom, poses, restants] of cas) {
      const { disque, fs } = disqueAvec(poses);
      const { dossier } = await supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION });
      assert.deepEqual(
        await arbre(disque),
        poses
          .map(([chemin, texte]) => [restants.includes(chemin) ? chemin : `${dossier}/${chemin}`, texte])
          .sort(parChemin),
        nom,
      );
    }
  });

  test("un état illisible part avec le .precedent et le journal que son identifiant apparie ; un journal sans état se supprime par sa base", async () => {
    const { etat, journal } = await paireDe(chargeEssai());
    const archives = `Archives des Lucioles${SUFFIXES.journal}`;
    const cas = [
      ['un état illisible', BASE, [[ETAT, '{'], [PRECEDENT, etat], [JOURNAL, journal]]],
      ['un journal sans état', 'Archives des Lucioles', [[archives, journal]]],
    ];
    for (const [nom, base, poses] of cas) {
      const { disque, fs } = disqueAvec(poses);
      assert.deepEqual(
        (await lister(fs, DOC)).map(({ base: listee }) => listee),
        [base],
        nom,
      );
      const { dossier } = await supprimer(fs, DOC, base, { horodatage: HEURE_SUPPRESSION });
      assert.deepEqual(
        await arbre(disque),
        poses.map(([chemin, texte]) => [`${dossier}/${chemin}`, texte]).sort(parChemin),
        nom,
      );
    }
  });

  test("sur un système de fichiers insensible à la casse, supprimer reconnaît les fichiers de l'événement dans une autre casse, comme deriverBase compare les bases, et les déplace sous leur nom sur le disque", async () => {
    const { etat, journal } = await paireDe(chargeEssai());
    // Le verrou est en NFD : seule sa NFC rejoint la base.
    const poses = [
      [ETAT, etat],
      [`SOIRÉE DES LUCIOLES${SUFFIXES.journal}`, journal],
      [`soirée des lucioles${SUFFIXES.precedent}`, etat],
      [`Soire\u0301e Des Lucioles${SUFFIXES.verrou}`, '{}\n'],
      [`SOIRÉE des lucioles${SUFFIXES.etat}.ecriture`, 'partiel'],
    ];
    const { disque, fs } = disqueAvec(poses);
    const trace = tracer(fs);
    const { dossier } = await supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION });
    assert.deepEqual(
      await arbre(disque),
      poses.map(([chemin, texte]) => [`${dossier}/${chemin}`, texte]).sort(parChemin),
    );
    assert.deepEqual(
      trace.filter(([primitive]) => primitive === 'deplacer').map(([, de, vers]) => [de, vers]),
      [4, 3, 1, 2, 0].map((rang) => [poses[rang][0], `${dossier}/${poses[rang][0]}`]),
    );

    // L'événement nommé dans une autre casse que celle de son état part de
    // même.
    const autre = disqueAvec(poses);
    const { dossier: dossierAutre } = await supprimer(autre.fs, DOC, 'SOIRÉE DES LUCIOLES', {
      horodatage: HEURE_SUPPRESSION,
    });
    assert.deepEqual(
      await arbre(autre.disque),
      poses.map(([chemin, texte]) => [`${dossierAutre}/${chemin}`, texte]).sort(parChemin),
    );

    // Un état illisible, nommé dans une autre casse : son résumé se trouve à
    // la clé de sa base, et le journal que son .precedent apparie part avec
    // lui.
    const illisible = [[ETAT, '{'], ...poses.slice(1)];
    const troisieme = disqueAvec(illisible);
    const { dossier: dossierIllisible } = await supprimer(troisieme.fs, DOC, 'soirée des LUCIOLES', {
      horodatage: HEURE_SUPPRESSION,
    });
    assert.deepEqual(
      await arbre(troisieme.disque),
      illisible.map(([chemin, texte]) => [`${dossierIllisible}/${chemin}`, texte]).sort(parChemin),
    );

    // Un sigma qui finit la base, suivi du point d'un suffixe : la majuscule
    // réunit « ς » et « Σ », la minuscule les sépare, car elle n'écrit « ς »
    // qu'en fin de mot et le point n'en finit pas un.
    const lac = 'Χορος της Λιμνης';
    const grecs = [
      [`${lac}${SUFFIXES.etat}`, etatTexte(chargeEssai({ id: 'evt-lac', nom: lac }))],
      [`ΧΟΡΟΣ ΤΗΣ ΛΙΜΝΗΣ${SUFFIXES.verrou}`, '{}\n'],
    ];
    const quatrieme = disqueAvec(grecs);
    const { dossier: dossierLac } = await supprimer(quatrieme.fs, DOC, lac, { horodatage: HEURE_SUPPRESSION });
    assert.deepEqual(
      await arbre(quatrieme.disque),
      grecs.map(([chemin, texte]) => [`${dossierLac}/${chemin}`, texte]).sort(parChemin),
    );
  });

  test("sur un système de fichiers insensible à la casse, supprimer emporte un fichier d'une autre base exactement quand deriverBase tient cette base pour prise par la sienne : NFD, sigma final, ß et SS ; une base distincte reste", async () => {
    // Par cas : la base de l'événement, celle d'un verrou posé à côté, et ce
    // que deriverBase doit en dire quand la règle est fixée (null : la
    // comparaison seule fait foi).
    const cas = [
      ['Soirée des Lucioles', 'SOIRE\u0301E DES LUCIOLES', true],
      ['Χορος της Λιμνης', 'ΧΟΡΟΣ ΤΗΣ ΛΙΜΝΗΣ', true],
      ['Abend in der Gartenstraße', 'ABEND IN DER GARTENSTRASSE', null],
      ['Soirée des Lucioles', 'Soirée des Lucioles bis', false],
    ];
    for (const [base, voisine, attendue] of cas) {
      const prise = deriverBase(base, { racine: DOCUMENTS, separateur: '\\', existantes: [voisine] }) !== base;
      if (attendue !== null) assert.equal(prise, attendue, `deriverBase, ${voisine}`);
      const verrou = `${voisine}${SUFFIXES.verrou}`;
      const poses = [
        [`${base}${SUFFIXES.etat}`, etatTexte(chargeEssai({ id: 'evt-voisine', nom: base }))],
        [verrou, '{}\n'],
      ];
      const { disque, fs } = disqueAvec(poses);
      const { dossier } = await supprimer(fs, DOC, base, { horodatage: HEURE_SUPPRESSION });
      assert.deepEqual(
        await arbre(disque),
        poses
          .map(([chemin, texte]) => [chemin === verrou && !prise ? chemin : `${dossier}/${chemin}`, texte])
          .sort(parChemin),
        voisine,
      );
    }
  });

  test("sur un système de fichiers sensible à la casse, supprimer ne déplace que les fichiers au nom exact de la base : ceux d'une autre casse sont d'autres bases, et restent", async () => {
    const { etat, journal } = await paireDe(chargeEssai());
    const poses = [
      [ETAT, etat],
      [`SOIRÉE DES LUCIOLES${SUFFIXES.journal}`, journal],
      [`soirée des lucioles${SUFFIXES.precedent}`, etat],
      [`Soirée Des Lucioles${SUFFIXES.verrou}`, '{}\n'],
      [`SOIRÉE des lucioles${SUFFIXES.etat}.ecriture`, 'partiel'],
    ];
    const sensible = { insensibleCasse: false };
    const { disque, fs } = disqueAvec(poses, sensible);
    const { dossier } = await supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION });
    // Le journal d'une autre base que son identifiant apparie part avec
    // l'événement (apparier, dans le dépôt) ; le reste ne lui appartient pas.
    const partis = [ETAT, poses[1][0]];
    assert.deepEqual(
      await arbre(disque, DOC, sensible),
      poses
        .map(([chemin, texte]) => [partis.includes(chemin) ? `${dossier}/${chemin}` : chemin, texte])
        .sort(parChemin),
    );
    await echec(
      supprimer(creerFichiersSimules({ disque, ...sensible }), DOC, 'SOIRÉE DES LUCIOLES', {
        horodatage: HEURE_SUPPRESSION,
      }),
      'ABSENT',
    );
  });

  test('une coupure à chaque écriture de la suppression laisse chaque fichier de l’événement à sa place ou dans la corbeille, son texte intact, jamais perdu', async () => {
    for (let n = 0; ; n += 1) {
      const { disque, fs, ouvert } = await deuxRevisions();
      await verrouiller(ouvert, 'seance-a');
      fs.deposer('documents', `${ETAT}.ecriture`, 'partiel');
      const avant = await arbre(disque);
      fs.pannes.couperApres(n);
      let acheve = true;
      try {
        await supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION });
      } catch (erreur) {
        assert.ok(erreur instanceof PanneSimulee, `coupure après ${n} écritures : ${String(erreur)}`);
        acheve = false;
      }
      const message = `coupure après ${n} écritures`;
      const apres = await arbre(disque);
      assert.deepEqual(
        apres.map(([chemin, texte]) => [chemin.replace(`${DATE}/`, ''), texte]).sort(parChemin),
        avant,
        message,
      );
      if (acheve) {
        assert.ok(apres.every(([chemin]) => chemin.startsWith(`${DATE}/`)), message);
        break;
      }
    }
  });

  test("un dossier de travail qui disparaît pendant la suppression ne renaît pas : à chaque écriture avant laquelle il disparaît, supprimer lève ECRITURE, ENOENT, ou ABSENT pour le fichier qui n'est plus là, ou achève, et le dossier reste absent", async () => {
    // Rangs où le dossier a disparu : au moins un par primitive que la
    // suppression appelle — la création du dossier daté, trois déplacements.
    let effacements = 0;
    for (let n = 0; ; n += 1) {
      const { disque, fs } = await deuxRevisions();
      const temoin = effacerDocumentsAvant(disque, fs, n);
      let refus = null;
      try {
        await supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION });
      } catch (erreur) {
        refus = erreur;
      }
      const message = `dossier effacé avant l'écriture de rang ${n}`;
      const enoent = refus?.code === 'ECRITURE' && refus.details.cause === 'ENOENT';
      assert.ok(refus === null || enoent || refus.code === 'ABSENT', `${message} : ${String(refus)}`);
      if (!temoin.efface) {
        assert.equal(refus, null, message);
        break;
      }
      effacements += 1;
      assert.ok(refus instanceof ErreurStockage, `${message} : ${String(refus)}`);
      await echec(creerFichiersSimules({ disque }).lister(DOC, ''), 'ABSENT', message);
    }
    assert.ok(effacements >= 4, `${effacements} rangs éprouvés, 4 attendus au moins`);
  });

  test('supprimer lève, sans rien écrire : ABSENT pour un événement sans fichier, TypeError pour un horodatage hors de sa forme, CORBEILLE_SATUREE quand la seconde a ses cent dossiers', async () => {
    const { disque, fs } = nouveauDisque();
    await creer(fs, DOC, chargeEssai(), CREATION);
    const avant = await arbre(disque);
    const ecritures = fs.compteurs.ecritures;
    const absent = await echec(supprimer(fs, DOC, 'Inexistant', { horodatage: HEURE_SUPPRESSION }), 'ABSENT');
    assert.deepEqual(absent.details, { chemin: `Inexistant${SUFFIXES.etat}` });
    await assert.rejects(supprimer(fs, DOC, BASE, { horodatage: '17 mai 2031' }), TypeError);
    fs.deposerDossier('documents', DATE);
    for (let rang = 2; rang <= 99; rang += 1) fs.deposerDossier('documents', `${DATE}_${rang}`);
    const saturee = await echec(supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION }), 'CORBEILLE_SATUREE');
    assert.deepEqual(saturee.details, { dossier: DATE });
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(await arbre(disque), avant);
    assert.equal((await listerCorbeille(fs, DOC)).length, 99);
  });

  test("une lecture que le système de fichiers refuse autrement que par l'absence remonte telle quelle, sans rien écrire : un chemin refusé, une corbeille illisible", async () => {
    const { fs } = await deuxRevisions();
    const ecritures = fs.compteurs.ecritures;
    await echec(supprimer(fs, DOC, '../ailleurs', { horodatage: HEURE_SUPPRESSION }), 'CHEMIN_REFUSE');
    const lister = fs.lister;
    fs.lister = async (racine, dossier) => {
      if (dossier === 'corbeille') {
        throw new ErreurStockage('LECTURE', { chemin: dossier, dossier: racine.chemin, cause: 'EIO' });
      }
      return lister(racine, dossier);
    };
    await echec(listerCorbeille(fs, DOC), 'LECTURE');
    await echec(supprimer(fs, DOC, BASE, { horodatage: HEURE_SUPPRESSION }), 'LECTURE');
    assert.equal(fs.compteurs.ecritures, ecritures);
  });

  test('une corbeille absente se liste vide ; un fichier posé à même la corbeille ne se liste pas comme un dossier', async () => {
    const { fs } = nouveauDisque();
    assert.deepEqual(await listerCorbeille(fs, DOC), []);
    fs.deposer('documents', 'corbeille/note.txt', 'à garder');
    fs.deposer('documents', `${DATE}/${ETAT}`, '{');
    assert.deepEqual(await listerCorbeille(fs, DOC), [{ dossier: DATE, fichiers: [ETAT] }]);
    assert.equal(fs.compteurs.ecritures, 0);
  });
});

describe('opérations : charger une démonstration (§ 15)', () => {
  test("charger deux fois « Petite démonstration » crée « Petite démonstration 1 » puis « … 2 » : identités reçues, état déduit, journal d'une entrée et son jalon ; le texte livré reste tel quel", async () => {
    const texte = texteLivre('petite');
    const livree = analyser(texte).charge;
    assert.equal(livree.evenement.nom, 'Petite démonstration');
    const { disque, fs } = nouveauDisque();
    const options = (n) => ({
      id: `evt-demo-${n}`,
      libelle: 'Chargée depuis la démonstration',
      nomJalon: 'Création',
      horodatage: heure(n),
      produitVersion: V1,
    });
    const trace = tracer(fs);
    const premiere = await chargerDemonstration(fs, DOC, texte, options(1));
    const seconde = await chargerDemonstration(fs, DOC, texte, options(2));
    for (const [ouvert, n] of [
      [premiere, 1],
      [seconde, 2],
    ]) {
      const nom = `Petite démonstration ${n}`;
      const attendue = { ...livree, evenement: { ...livree.evenement, id: `evt-demo-${n}`, nom, etat: 'brouillon' } };
      assert.deepEqual(
        [ouvert.base, ouvert.charge.evenement.nom, ouvert.revision, ouvert.avertissements],
        [nom, nom, 1, []],
      );
      assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(attendue), nom);
      const journal = exigerEquivalence(fs, nom);
      assert.equal(journal.evenement, `evt-demo-${n}`, nom);
      assert.deepEqual(revisionsEtLibelles(journal), [[1, 'Chargée depuis la démonstration']], nom);
    }
    assert.deepEqual(
      trace,
      ['Petite démonstration 1', 'Petite démonstration 2'].flatMap((nom) => [
        ['ecrireAtomique', `${nom}${SUFFIXES.journal}`],
        ['ecrireAtomique', `${nom}${SUFFIXES.etat}`],
      ]),
    );
    assert.equal(texteLivre('petite'), texte);
    assert.deepEqual(
      (await arbre(disque)).map(([chemin]) => chemin),
      [
        `Petite démonstration 1${SUFFIXES.journal}`,
        `Petite démonstration 1${SUFFIXES.etat}`,
        `Petite démonstration 2${SUFFIXES.journal}`,
        `Petite démonstration 2${SUFFIXES.etat}`,
      ],
    );
  });

  test("le rang est le premier libre parmi les noms des événements lisibles du dossier, comparés en NFC, sans égard à la casse quand le système de fichiers l'ignore ; un état illisible ne prend aucun rang", async () => {
    const texte = texteLivre('petite');
    const livree = analyser(texte).charge;
    const nomme = (id, nom) => etatTexte({ ...livree, evenement: { ...livree.evenement, id, nom } });
    const fichiers = [
      [`petite démonstration 1${SUFFIXES.etat}`, nomme('evt-p1', 'petite démonstration 1')],
      [`Petite démonstration 2${SUFFIXES.etat}`, nomme('evt-p2', 'Petite de\u{301}monstration 2')],
      [`Petite démonstration 3${SUFFIXES.etat}`, '{'],
      [`Petite démonstration 4${SUFFIXES.etat}`, nomme('evt-p4', 'Petite démonstration 4')],
    ];
    const sensible = {
      separateur: '/',
      insensibleCasse: false,
      documents: '/home/exemple/Documents/Gestion table tournante Libre',
    };
    // Par cas : le système de fichiers, puis le nom et la base attendus.
    const cas = [
      ['sans égard à la casse', {}, 'Petite démonstration 3', 'Petite démonstration 3 (2)'],
      ['casse distinguée', sensible, 'Petite démonstration 1', 'Petite démonstration 1 (2)'],
    ];
    for (const [nom, reglages, attendu, base] of cas) {
      const { fs } = disqueAvec(fichiers, reglages);
      const racine = { id: 'documents', chemin: reglages.documents ?? DOCUMENTS };
      const ouvert = await chargerDemonstration(fs, racine, texte, chargement('evt-demo', 1));
      assert.deepEqual([ouvert.charge.evenement.nom, ouvert.base], [attendu, base], nom);
    }
  });
});

describe("opérations : ce qu'une construction plus récente a écrit (§ 8.8)", () => {
  test("copier, renommer et charger refusent un fichier d'un format plus récent, LECTURE_SEULE, sans rien écrire", async () => {
    const { disque } = disqueAvec([[ETAT, formatDeux(chargeEssai())]]);
    const ouvert = await rouvrir(disque, BASE);
    assert.equal(ouvert.formatPlusRecent, true);
    const refus = [
      ['copier', copier(ouvert, optionsCopie('Variante des Lucioles', { libelleReprise: REPRISE }))],
      ['renommer', renommer(ouvert, renommage('Gala des Saules', 2, { libelleReprise: REPRISE }))],
      [
        'charger',
        chargerDemonstration(
          ouvert.fs,
          DOC,
          formatDeux(chargeEssai({ id: 'evt-demo', nom: 'Démonstration' })),
          chargement('evt-demo-1', 2),
        ),
      ],
    ];
    for (const [nom, promesse] of refus) {
      const erreur = await echec(promesse, 'LECTURE_SEULE', nom);
      assert.deepEqual(erreur.details, { raison: 'FORMAT_PLUS_RECENT' }, nom);
    }
    assert.equal(ouvert.fs.compteurs.ecritures, 0);
    await echec(chargerDemonstration(ouvert.fs, DOC, '{', chargement('evt-demo-2', 3)), 'ETAT_ILLISIBLE');
    assert.equal(ouvert.fs.compteurs.ecritures, 0);
  });
});
