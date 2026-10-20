// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du dépôt (§ 8.1, § 8.2, § 8.4, § 8.6, § 8.8, § 8.9, § 14.10), toutes
// sur le système de fichiers d'épreuve, chacune comptant ses écritures : une
// ouverture n'en fait aucune. Un événement se crée, se liste et s'ouvre ; un
// geste donne une entrée puis un état ; une panne à chaque frontière d'un geste
// se reprend à l'ouverture, sans regarder la date des fichiers ; un état
// illisible nomme ses secours, qui s'ouvrent ; le journal s'apparie par
// identifiant, se répare au premier geste qui suit l'ouverture et s'élague ;
// une proposition fautive s'écarte, une périmée se garde ; le verrou ;
// l'écriture ailleurs ; un événement d'un format plus ancien, qui se lit et
// se convertit au premier geste, historique entier. Les noms d'épreuve sont
// inventés ; les versions viennent du module engendré.
import assert from 'node:assert/strict';
import { PanneSimulee, creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { VERSION } from '../version.genere.js';
import { canoniser, serialiser, serialiserCharge } from './canonique.js';
import { appliquer, difference } from './correctifs.js';
import {
  basesPrises,
  creer,
  deverrouiller,
  enregistrer,
  enregistrerAilleurs,
  lister,
  nommer,
  ouvrir,
  ouvrirSecours,
  verrouiller,
} from './depot.js';
import { courseDe, entreeDeCourse, texteDesCourses } from './courses.js';
import { FORMAT, analyser, creerCharge } from './document.js';
import { ErreurStockage } from './erreurs.js';
import { copieDeTravail, estFigee, figer } from './gel.js';
import {
  PLAFOND_ENTREES,
  elaguer,
  estInstantane,
  fil,
  ligneEntree,
  ligneJalon,
  ligneOuverture,
  lireJournal,
  reconstruire,
  texteDuJournal,
} from './journal.js';
import { SUFFIXES } from './noms.js';
import { ajusterALaPresence, examiner } from './placements.js';

const V1 = VERSION.affichee;
const V2 = versionVoisine(V1);

// La racine documents du système d'épreuve, à son chemin par défaut.
const DOCUMENTS = 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre';
const DOC = { id: 'documents', chemin: DOCUMENTS };

const BASE = 'Soirée des Lucioles';
const ETAT = `${BASE}${SUFFIXES.etat}`;
const PRECEDENT = `${BASE}${SUFFIXES.precedent}`;
const JOURNAL = `${BASE}${SUFFIXES.journal}`;
const VERROU = `${BASE}${SUFFIXES.verrou}`;
const COURSES = `${BASE}${SUFFIXES.courses}`;

const REPRISE = "Reprise de l'état trouvé sur le disque";

// Horodatage d'affichage de l'instant n : une minute par instant à partir de
// 8 h, le 17 mai 2031, à l'heure de l'Est.
function heure(n) {
  const minutes = 8 * 60 + n;
  const deux = (valeur) => String(valeur).padStart(2, '0');
  return `2031-05-17T${deux(Math.floor(minutes / 60))}:${deux(minutes % 60)}:00-04:00`;
}

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

// Placement de deux tours sur les tables 1 et 2, deux places chacune ; le
// premier tour est donné, le second fixé.
function placement(id, premierTour) {
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
      { sieges: premierTour, reserve: [] },
      { sieges: [[1, 4], [2, 3]], reserve: [] },
    ],
  };
}

// Retenu repris d'un placement, ses champs d'identification retirés.
function retenuDe({ id, siegesAttribues, tables, capacites, tours, participants, placement: plan }) {
  return { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement: plan };
}

// Charge d'épreuve : quatre personnes, deux tables, une réservation, un titre,
// une proposition cohérente.
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
  charge.propositions = [placement(1, [[1, 3], [2, 4]])];
  return charge;
}

// La charge d'épreuve et une seconde proposition qui se contredit : la
// personne 3 assise deux fois au premier tour, la 4 nulle part. examiner
// l'écarte (§ 8.9, point 3) : la charge ouverte n'est plus celle du fichier,
// ni celle que restitue le journal.
function avecFautive() {
  const charge = chargeEssai();
  charge.propositions.push(placement(2, [[1, 3], [2, 3]]));
  charge.prochainsIds.proposition = 3;
  return charge;
}

// La charge reçue, la note de sa première personne changée : un geste.
function modifier(charge, n) {
  const suivante = structuredClone(charge);
  suivante.participants[0].notes = `note ${n}`;
  return suivante;
}

// La charge reçue, une personne de plus sous le prochain identifiant, le
// compteur relevé : un geste dont le correctif dépend de la charge d'où il
// part. Il pose la personne par son identifiant, ce qui lève sur une charge
// qui la porte déjà ; un correctif calculé depuis un instant d'avant
// l'inscription la pose de nouveau. La personne arrive exclue : aucune
// proposition ne la place, et aucune ne dérive.
function inscrire(charge, n) {
  const suivante = structuredClone(charge);
  const id = suivante.prochainsIds.participant;
  suivante.participants.push({ ...personne(id, 'Brunelle', null, null), notes: `inscrite au geste ${n}`, exclu: true });
  suivante.prochainsIds.participant = id + 1;
  return suivante;
}

// Le geste n sur la charge reçue : une inscription quand n est impair, la
// note changée sinon. Une note se remplace d'où que parte son correctif ;
// une inscription sur deux gestes donne à deux instants voisins des listes
// de personnes différentes, si bien qu'exigerEquivalence voit un correctif
// posé depuis une autre charge que la sienne (§ 14.2).
const gesteSur = (charge, n) => (n % 2 === 1 ? inscrire(charge, n) : modifier(charge, n));

const texteDeCharge = (charge) => serialiserCharge(charge);
const etatTexte = (charge, revision = 1, produitVersion = V1) => serialiser(charge, { revision, produitVersion });

// --- Les disques -----------------------------------------------------------

// Un disque neuf dont la racine documents existe, et son premier processus.
function nouveauDisque(options = {}) {
  const disque = new Map();
  const fs = creerFichiersSimules({ disque, ...options });
  fs.deposerDossier('documents');
  return { disque, fs };
}

// Un disque neuf dont documents porte les fichiers [nom, texte, modifie?].
function disqueAvec(fichiers) {
  const { disque, fs } = nouveauDisque();
  for (const [nom, texte, modifie] of fichiers) fs.deposer('documents', nom, texte, modifie);
  return { disque, fs };
}

// Fichiers de documents, [nom, texte], par nom, lus par un processus à part.
async function fichiersDe(disque) {
  const lecteur = creerFichiersSimules({ disque });
  const entrees = await lecteur.lister(DOC, '');
  return entrees.filter(({ type }) => type === 'fichier').map(({ nom }) => [nom, lecteur.contenu('documents', nom)]);
}

// Les fichiers donnés, le texte de nom remplacé, ou retiré quand il est null.
function remplacer(fichiers, nom, texte) {
  const autres = fichiers.filter(([autre]) => autre !== nom);
  return texte === null ? autres : [...autres, [nom, texte]];
}

const texteDe = (fichiers, nom) => fichiers.find(([autre]) => autre === nom)[1];

// Un disque neuf dont documents porte les fichiers, nom posé en octets.
function disqueAvecOctets(fichiers, nom, octets) {
  const { disque, fs } = disqueAvec(remplacer(fichiers, nom, null));
  fs.deposerOctets('documents', nom, octets);
  return { disque, fs };
}

// Les octets UTF-8 du texte, son premier « é » (C3 A9) remplacé par l'octet
// E9 qu'écrit un éditeur réglé en windows-1252 : une suite qui n'est pas de
// l'UTF-8.
function malEncode(texte) {
  const octets = [...new TextEncoder().encode(texte)];
  const rang = octets.findIndex((octet, i) => octet === 0xc3 && octets[i + 1] === 0xa9);
  assert.ok(rang >= 0, 'aucun « é » à mal encoder');
  octets.splice(rang, 2, 0xe9);
  return new Uint8Array(octets);
}

// Les octets UTF-8 d'un texte de journal, sa ligne de rang donné (0 pour
// l'ouverture) ouverte par l'octet E9 suivi de « { » : une suite qui n'est
// pas de l'UTF-8, sur cette ligne seule.
function ligneMalEncodee(texte, rang) {
  const lignes = texte.split('\n');
  assert.ok(rang < lignes.length - 1, `aucune ligne ${rang}`);
  const avant = new TextEncoder().encode(lignes.slice(0, rang).map((ligne) => `${ligne}\n`).join(''));
  const apres = new TextEncoder().encode(lignes.slice(rang).join('\n'));
  return new Uint8Array([...avant, 0xe9, ...apres]);
}

// Le rang de la ligne d'un texte de journal qui porte l'entrée de révision
// donnée.
const rangDeLEntree = (texte, revision) =>
  texte.split('\n').findIndex((ligne) => ligne.startsWith('{"type":"entree"') && JSON.parse(ligne).revision === revision);

// Ouvre base sur le disque par un processus neuf, en affirmant qu'ouvrir
// n'écrit rien (§ 8.4).
async function rouvrir(disque, base) {
  const fs = creerFichiersSimules({ disque });
  const ouvert = await ouvrir(fs, DOC, base);
  assert.equal(fs.compteurs.ecritures, 0, 'ouvrir écrit');
  return ouvert;
}

// Inscrit, dans l'ordre, chaque appel d'une primitive d'écriture de fichier
// ou de dossier : [primitive, chemin].
function tracer(fs) {
  const trace = [];
  for (const nom of ['ecrireAtomique', 'ajouterLigne', 'creerDossier', 'deplacer', 'supprimer']) {
    const primitive = fs[nom];
    fs[nom] = (racine, chemin, ...reste) => {
      trace.push([nom, chemin]);
      return primitive(racine, chemin, ...reste);
    };
  }
  return trace;
}

// Dès l'écriture du rang-ième .precedent, le premier par défaut, les
// renommages de sa racine sont refusés : l'écriture atomique de l'état qui
// suit échoue sans toucher sa cible (§ 8.8). Rend la fonction qui retire ce
// piège.
function refuserRenommageApresPrecedent(fs, rang = 1) {
  const ecrire = fs.ecrireAtomique;
  let precedents = 0;
  fs.ecrireAtomique = async (racine, chemin, texte) => {
    await ecrire(racine, chemin, texte);
    if (!chemin.endsWith(SUFFIXES.precedent)) return;
    precedents += 1;
    if (precedents >= rang) fs.pannes.renommage(racine.id);
  };
  return () => {
    fs.ecrireAtomique = ecrire;
    fs.pannes.renommage('documents', 0);
  };
}

// Rend la raison du rejet de la promesse ; échoue quand elle se résout, par
// un constat qui se termine sur message quand il est donné.
async function rejet(promesse, message) {
  let raison;
  await assert.rejects(
    promesse,
    (erreur) => {
      raison = erreur;
      return true;
    },
    message,
  );
  return raison;
}

// Attend le rejet d'une ErreurStockage de ce code, et la rend ; message
// nomme le cas d'une boucle dont la promesse se résout.
async function echec(promesse, code, message) {
  const erreur = await rejet(promesse, message);
  assert.ok(erreur instanceof ErreurStockage, String(erreur));
  assert.equal(erreur.code, code, String(erreur));
  return erreur;
}

// Un geste ⇔ une entrée ⇔ un état (§ 8.2) : la dernière entrée du journal
// porte la révision de l'état et restitue exactement sa charge ; le journal se
// lit en entier.
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

// Un événement créé, puis deux gestes, une note puis une inscription
// (gesteSur) : le .precedent porte la révision 2, l'état et le journal la 3,
// et ces deux instants n'ont pas les mêmes personnes. Rend ses fichiers et le
// dernier Ouvert.
async function troisRevisions() {
  const { disque, fs } = nouveauDisque();
  let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
  for (const n of [2, 3]) ouvert = await enregistrer(ouvert, gesteSur(ouvert.charge, n), geste(n));
  return { fichiers: await fichiersDe(disque), ouvert };
}

// Le journal d'un autre événement, créé sur un disque à part : posé sous la
// base, il est JOURNAL_ETRANGER.
async function journalEtranger() {
  const { fs } = nouveauDisque();
  await creer(fs, DOC, chargeEssai({ id: 'evt-gala', nom: "Gala d'automne" }), CREATION);
  return fs.contenu('documents', `Gala d'automne${SUFFIXES.journal}`);
}

// L'Ouvert que rend ouvrirAinsi sur un disque neuf qui porte fichiers, par un
// processus neuf, sans rien écrire, ses avertissements de codes attendus :
// pour exigerChaqueCoupure.
function depuisFichiers(fichiers, ouvrirAinsi, codes) {
  return async () => {
    const { disque, fs } = disqueAvec(fichiers);
    const ouvert = await ouvrirAinsi(fs);
    assert.equal(fs.compteurs.ecritures, 0, 'ouvrir écrit');
    assert.deepEqual(
      ouvert.avertissements.map(({ code }) => code),
      codes,
    );
    return { disque, ouvert };
  };
}

// Chaque coupure du premier geste qui part de l'Ouvert que rend depart, sur un
// disque neuf : après n écritures réussies, de n = 0 jusqu'au geste achevé. Un
// premier passage sans coupure désigne le journal où le geste s'inscrit, par
// la base que rend son Ouvert : celle de l'événement, ou celle que le geste
// dérive quand le journal de la base porte un autre événement. Rouvert après
// la coupure, l'événement rend le geste dès que sa ligne est à ce journal — à
// sa révision, rattrapé en mémoire, sans autre avertissement que
// JOURNAL_REPRIS (§ 8.2) ; achevé, le geste est la dernière entrée de ce
// journal. Rend le nombre de coupures tombées entre la ligne du geste et l'état
// écrit : l'épreuve en exige au moins une.
async function exigerChaqueCoupure(nom, depart) {
  const options = geste(99, { libelleReprise: REPRISE });
  const temoin = await depart();
  const { baseJournal } = await enregistrer(temoin.ouvert, modifier(temoin.ouvert.charge, 99), options);
  const journal = `${baseJournal}${SUFFIXES.journal}`;
  let entreLigneEtEtat = 0;
  for (let n = 0; ; n += 1) {
    const { disque, ouvert } = await depart();
    const apres = modifier(ouvert.charge, 99);
    ouvert.fs.pannes.couperApres(n);
    let acheve = true;
    try {
      await enregistrer(ouvert, apres, options);
    } catch (erreur) {
      assert.ok(erreur instanceof PanneSimulee, `${nom}, coupure après ${n} écritures : ${String(erreur)}`);
      acheve = false;
    }
    const message = `${nom}, coupure après ${n} écritures`;
    const texte = ouvert.fs.contenu('documents', journal);
    const derniere = texte === null ? undefined : lireJournal(texte).entrees.at(-1);
    if (acheve) assert.equal(derniere?.libelle, options.libelle, `${message} : le geste achevé finit ${journal}`);
    if (derniere?.libelle === options.libelle) {
      const rouvert = await rouvrir(disque, BASE);
      assert.equal(texteDeCharge(rouvert.charge), texteDeCharge(apres), message);
      assert.equal(rouvert.revision, derniere.revision, message);
      assert.deepEqual(
        rouvert.avertissements.filter(({ code }) => code !== 'JOURNAL_REPRIS'),
        [],
        message,
      );
      if (!acheve) entreLigneEtEtat += 1;
    }
    if (acheve) return entreLigneEtEtat;
  }
}

describe('dépôt : créer, ouvrir, lister', () => {
  test("créer écrit le journal, puis l'état ; ouvrir rend la même charge à la révision 1 et son journal d'une entrée, sans rien écrire", async () => {
    const { disque, fs } = nouveauDisque();
    const trace = tracer(fs);
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    assert.deepEqual(trace, [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(fs.compteurs.ecritures, 2);
    assert.equal(cree.base, BASE);
    assert.equal(cree.revision, 1);
    const texteEtat = etatTexte(chargeEssai());
    assert.equal(fs.contenu('documents', ETAT), texteEtat);
    assert.equal(cree.texteEtat, texteEtat);

    const journal = lireJournal(fs.contenu('documents', JOURNAL));
    assert.equal(journal.evenement, 'evt-lucioles');
    assert.deepEqual(revisionsEtLibelles(journal), [[1, CREATION.libelle]]);
    assert.equal(journal.entrees[0].produitVersion, V1);
    assert.equal(texteDeCharge(journal.entrees[0].instantane), texteDeCharge(chargeEssai()));
    assert.deepEqual(
      journal.jalons.map(({ revision, nom }) => [revision, nom]),
      [[1, 'Création']],
    );

    const ouvert = await rouvrir(disque, BASE);
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(chargeEssai()));
    assert.equal(ouvert.revision, 1);
    assert.equal(ouvert.base, BASE);
    assert.equal(ouvert.texteEtat, texteEtat);
    assert.equal(ouvert.produitVersion, V1);
    assert.equal(ouvert.formatPlusRecent, false);
    assert.deepEqual(ouvert.journal, journal);
    assert.deepEqual(ouvert.avertissements, []);
    assert.deepEqual(ouvert.examen.fautives, []);
  });

  test("créer dérive la base du nom de l'événement sans reprendre une base du dossier, casse comprise", async () => {
    const { fs } = disqueAvec([['SOIRÉE DES LUCIOLES.gtt.verrou', '{}\n']]);
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    assert.equal(ouvert.base, 'Soirée des Lucioles (2)');
    assert.equal(fs.compteurs.ecritures, 2);
    assert.equal(fs.contenu('documents', 'Soirée des Lucioles (2).gtt.json'), etatTexte(chargeEssai()));
  });

  test("créer refuse, sans rien écrire, une charge hors de sa forme ou dont l'état ne se relirait pas", async () => {
    const { disque, fs } = nouveauDisque();
    await assert.rejects(creer(fs, DOC, { ...chargeEssai(), inconnue: 1 }, CREATION), TypeError);
    const orpheline = chargeEssai();
    orpheline.titres = [{ table: 9, siege: 1, libelle: 'animation' }];
    await assert.rejects(creer(fs, DOC, orpheline, CREATION), /ne se relirait pas/);
    assert.equal(fs.compteurs.ecritures, 0);
    assert.deepEqual(await fichiersDe(disque), []);
  });

  test('lister rend chaque événement du dossier, trié par nom, avec ou sans journal, sans rien écrire', async () => {
    const { disque, fs } = nouveauDisque();
    await creer(fs, DOC, chargeEssai(), CREATION);
    const gala = chargeEssai({ id: 'evt-gala', nom: "Gala d'automne" });
    gala.evenement.date = '2031-10-04';
    fs.deposer('documents', "Gala d'automne.gtt.json", etatTexte(gala, 4), 12345);

    const lecteur = creerFichiersSimules({ disque });
    const entrees = await lecteur.lister(DOC, '');
    const resumes = await lister(lecteur, DOC);
    assert.equal(lecteur.compteurs.ecritures, 0);
    assert.deepEqual(resumes, [
      {
        base: "Gala d'automne",
        id: 'evt-gala',
        nom: "Gala d'automne",
        date: '2031-10-04',
        etat: 'propose',
        participants: 4,
        modifie: 12345,
        journal: null,
        illisible: null,
        doublon: false,
      },
      {
        base: BASE,
        id: 'evt-lucioles',
        nom: BASE,
        date: null,
        etat: 'propose',
        participants: 4,
        modifie: entrees.find(({ nom }) => nom === ETAT).modifie,
        journal: BASE,
        illisible: null,
        doublon: false,
      },
    ]);
  });

  test("lister apparie par l'identifiant, jamais par le nom : journal renommé, état illisible et l'identifiant qui l'apparie, journal sans état, doublon, journal d'un autre", async () => {
    const ouverture = (evenement) => `${ligneOuverture(evenement)}\n`;
    const etat = (id, nom) => etatTexte(chargeEssai({ id, nom }));
    const { fs } = disqueAvec([
      // état lisible, son journal renommé à la main ; une copie de ce journal
      ['Aubepine.gtt.json', etat('evt-a', 'Aubépine'), 1000],
      ['Carnet.gtt-journal.jsonl', ouverture('evt-a'), 1001],
      ['Copie.gtt-journal.jsonl', ouverture('evt-a'), 1002],
      // état illisible, son journal à côté
      ['Bleuet.gtt.json', '', 2000],
      ['Bleuet.gtt-journal.jsonl', ouverture('evt-b'), 2001],
      // journal sans état
      ['Capucine.gtt-journal.jsonl', ouverture('evt-c'), 3000],
      // deux états du même identifiant
      ['Dahlia.gtt.json', etat('evt-d', 'Dahlia'), 4000],
      ['Dahlia bis.gtt.json', etat('evt-d', 'Dahlia'), 4001],
      // état lisible, à côté du journal d'un autre événement
      ['Esquisse.gtt.json', etat('evt-e', 'Esquisse'), 5000],
      ['Esquisse.gtt-journal.jsonl', ouverture('evt-x'), 5001],
      // journal sans état, dont l'ouverture ne se lit pas
      ['Fougere.gtt-journal.jsonl', 'pas du JSON\n', 6000],
      // état illisible dont le journal porte un autre événement, lisible lui
      ['Glycine.gtt.json', '{', 7000],
      ['Glycine.gtt-journal.jsonl', ouverture('evt-h'), 7001],
      ['Hortensia.gtt.json', etat('evt-h', 'Hortensia'), 8000],
      // état illisible, ni .precedent ni journal
      ['Jacinthe.gtt.json', '{"entete":', 8500],
      // état illisible, son .precedent lisible, sans journal
      ['Kalmia.gtt.json', '{', 8600],
      ['Kalmia.gtt.json.precedent', etat('evt-k', 'Kalmia'), 8601],
      // ni état ni journal
      ['notes.txt', 'à lire', 9000],
    ]);
    fs.deposerDossier('documents', 'Iris.gtt.json');
    const lisible = (base, id, nom, modifie, journal, doublon = false) => ({
      base,
      id,
      nom,
      date: null,
      etat: 'propose',
      participants: 4,
      modifie,
      journal,
      illisible: null,
      doublon,
    });
    const illisible = (base, id, modifie, journal, raison) => ({
      base,
      id,
      nom: null,
      date: null,
      etat: null,
      participants: null,
      modifie,
      journal,
      illisible: raison,
      doublon: false,
    });
    assert.deepEqual(await lister(fs, DOC), [
      lisible('Aubepine', 'evt-a', 'Aubépine', 1000, 'Carnet'),
      lisible('Dahlia', 'evt-d', 'Dahlia', 4000, null, true),
      lisible('Dahlia bis', 'evt-d', 'Dahlia', 4001, null, true),
      lisible('Esquisse', 'evt-e', 'Esquisse', 5000, null),
      lisible('Hortensia', 'evt-h', 'Hortensia', 8000, 'Glycine'),
      illisible('Bleuet', 'evt-b', 2000, 'Bleuet', 'VIDE'),
      illisible('Capucine', 'evt-c', 3000, 'Capucine', 'ABSENT'),
      illisible('Fougere', null, 6000, 'Fougere', 'ABSENT'),
      illisible('Glycine', null, 7000, null, 'JSON'),
      illisible('Jacinthe', null, 8500, null, 'JSON'),
      illisible('Kalmia', 'evt-k', 8600, null, 'JSON'),
    ]);
    assert.equal(fs.compteurs.ecritures, 0);
  });
});

describe('dépôt : un geste, une entrée, un état (§ 8.2)', () => {
  test("chaque geste ajoute son entrée au journal, puis écrit le .precedent et l'état : la dernière entrée restitue la charge écrite", async () => {
    const { fs } = nouveauDisque();
    const trace = tracer(fs);
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    for (let n = 2; n <= 5; n += 1) {
      const etatAvant = fs.contenu('documents', ETAT);
      const depart = trace.length;
      // Les gestes alternent note et inscription (gesteSur) ; le dernier
      // revient à l'instant 3 : un retour est une entrée comme une autre, dont
      // la charge est celle de sa cible (§ 8.3).
      const retour = n === 5 ? { sens: 'revenir', retour: 3 } : {};
      const apres = n === 5 ? reconstruire(ouvert.journal, 3) : gesteSur(ouvert.charge, n);
      ouvert = await enregistrer(ouvert, apres, geste(n, retour));
      assert.deepEqual(trace.slice(depart), [
        ['ajouterLigne', JOURNAL],
        ['ecrireAtomique', PRECEDENT],
        ['ecrireAtomique', ETAT],
      ]);
      assert.equal(fs.contenu('documents', PRECEDENT), etatAvant);
      assert.equal(ouvert.revision, n);
      assert.equal(ouvert.texteEtat, fs.contenu('documents', ETAT));
      assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(apres));
      const journal = exigerEquivalence(fs, BASE);
      assert.equal(journal.entrees.length, n);
      assert.deepEqual(ouvert.journal, journal);
    }
    assert.equal(fs.compteurs.ecritures, 2 + 4 * 3);
    const derniere = ouvert.journal.entrees.at(-1);
    assert.deepEqual([derniere.sens, derniere.retour], ['revenir', 3]);
    assert.equal(fil(ouvert.journal).position, 3);
  });

  test("une entrée note la construction quand elle change, et l'état porte celle du dernier geste", async () => {
    const { fs } = nouveauDisque();
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2));
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3, { produitVersion: V2 }));
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { produitVersion: V2 }));
    const { entrees } = lireJournal(fs.contenu('documents', JOURNAL));
    assert.deepEqual(
      entrees.map(({ produitVersion }) => produitVersion),
      [V1, null, V2, null],
    );
    assert.equal(analyser(fs.contenu('documents', ETAT)).entete.produitVersion, V2);
    assert.equal(ouvert.produitVersion, V2);
    assert.equal(fs.compteurs.ecritures, 2 + 3 * 3);
  });

  test("nommer ajoute un jalon sur l'instant courant, sans écrire l'état", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    const etat = fs.contenu('documents', ETAT);
    const trace = tracer(fs);
    const nomme = await nommer(cree, { nom: 'Avant la génération', horodatage: heure(1) });
    assert.deepEqual(trace, [['ajouterLigne', JOURNAL]]);
    assert.equal(fs.contenu('documents', ETAT), etat);
    assert.equal(nomme.revision, 1);
    assert.deepEqual(
      nomme.journal.jalons.map(({ revision, nom }) => [revision, nom]),
      [
        [1, 'Création'],
        [1, 'Avant la génération'],
      ],
    );
    assert.deepEqual((await rouvrir(disque, BASE)).journal, nomme.journal);
  });

  test("un journal effacé entre deux gestes ne reçoit pas d'ajout : le geste suivant le réécrit en entier, ouverture et entrées en mémoire comprises, JOURNAL_RECREE ; un jalon de même ; puis les ajouts reprennent", async () => {
    const { disque, fs } = nouveauDisque();
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    ouvert = await enregistrer(ouvert, gesteSur(ouvert.charge, 2), geste(2));
    await fs.supprimer(DOC, JOURNAL);
    const trace = tracer(fs);
    ouvert = await enregistrer(ouvert, gesteSur(ouvert.charge, 3), geste(3));
    assert.deepEqual(trace.splice(0), [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_RECREE', details: {} }]);
    let journal = exigerEquivalence(fs, BASE);
    assert.equal(journal.evenement, 'evt-lucioles');
    assert.deepEqual(revisionsEtLibelles(journal), [
      [1, CREATION.libelle],
      [2, 'Geste 2'],
      [3, 'Geste 3'],
    ]);

    await fs.supprimer(DOC, JOURNAL);
    trace.splice(0);
    ouvert = await nommer(ouvert, { nom: 'Avant le tirage', horodatage: heure(4) });
    assert.deepEqual(trace.splice(0), [['ecrireAtomique', JOURNAL]]);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_RECREE', details: {} }]);
    journal = exigerEquivalence(fs, BASE);
    assert.deepEqual(
      journal.jalons.map(({ revision, nom }) => [revision, nom]),
      [
        [1, 'Création'],
        [3, 'Avant le tirage'],
      ],
    );

    ouvert = await enregistrer(ouvert, gesteSur(ouvert.charge, 5), geste(5));
    assert.deepEqual(trace.splice(0), [
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    assert.deepEqual(ouvert.avertissements, []);
    assert.equal(exigerEquivalence(fs, BASE).entrees.length, 4);
    assert.deepEqual((await rouvrir(disque, BASE)).avertissements, []);
  });

  test("le journal présent se reconnaît comme le système compare les noms : sans égard à la casse, une base d'une autre casse ajoute en fin ; sensible à la casse, le nom exact", async () => {
    const insensible = nouveauDisque();
    await creer(insensible.fs, DOC, chargeEssai(), CREATION);
    const autreCasse = await ouvrir(insensible.fs, DOC, BASE.toUpperCase());
    const trace = tracer(insensible.fs);
    const suite = await enregistrer(autreCasse, modifier(autreCasse.charge, 2), geste(2));
    assert.deepEqual(trace[0], ['ajouterLigne', `${BASE.toUpperCase()}${SUFFIXES.journal}`]);
    assert.deepEqual(suite.avertissements, []);
    assert.equal(exigerEquivalence(insensible.fs, BASE).entrees.length, 2);

    const sensible = nouveauDisque({ separateur: '/', insensibleCasse: false, documents: '/exemple/Documents' });
    const racine = { id: 'documents', chemin: '/exemple/Documents' };
    let ouvert = await creer(sensible.fs, racine, chargeEssai(), CREATION);
    sensible.fs.deposer('documents', `${BASE.toUpperCase()}${SUFFIXES.journal}`, 'un autre fichier');
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2));
    assert.deepEqual(ouvert.avertissements, []);
    await sensible.fs.supprimer(racine, JOURNAL);
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3));
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_RECREE', details: {} }]);
    assert.equal(sensible.fs.contenu('documents', `${BASE.toUpperCase()}${SUFFIXES.journal}`), 'un autre fichier');
  });

  test("un dossier qui ne se liste plus au moment d'ajouter au journal lève ECRITURE sur le journal, sans rien écrire : ENOENT quand il a disparu, la cause d'une lecture refusée sinon", async () => {
    for (const [nom, refus, cause] of [
      ['disparu', (chemin) => new ErreurStockage('ABSENT', { chemin }), 'ENOENT'],
      ['illisible', (chemin) => new ErreurStockage('LECTURE', { chemin, dossier: DOCUMENTS, cause: 'EACCES' }), 'EACCES'],
    ]) {
      const { disque, fs } = nouveauDisque();
      const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
      const avant = await fichiersDe(disque);
      const ecritures = fs.compteurs.ecritures;
      fs.lister = async (racine, chemin) => {
        throw refus(chemin);
      };
      const erreur = await echec(enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2)), 'ECRITURE', nom);
      assert.deepEqual(erreur.details, { chemin: JOURNAL, dossier: DOCUMENTS, cause }, nom);
      assert.equal(fs.compteurs.ecritures, ecritures, nom);
      assert.deepEqual(await fichiersDe(disque), avant, nom);
    }
  });

  test("un geste refusé n'écrit rien : charge hors de sa forme, état qui ne se relirait pas, version absente, libellé ou nom vides", async () => {
    const { disque, fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const avant = await fichiersDe(disque);
    const ecritures = fs.compteurs.ecritures;
    await assert.rejects(enregistrer(ouvert, { ...ouvert.charge, inconnue: 1 }, geste(2)), TypeError);
    const orpheline = modifier(ouvert.charge, 2);
    orpheline.reservations = [{ participant: 9, table: 1, siege: null, portee: 'tous', tour: null }];
    await assert.rejects(enregistrer(ouvert, orpheline, geste(2)), /ne se relirait pas/);
    const sansVersion = { libelle: 'Geste 2', horodatage: heure(2) };
    await assert.rejects(enregistrer(ouvert, modifier(ouvert.charge, 2), sansVersion), TypeError);
    await assert.rejects(enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2, { libelle: '' })), TypeError);
    await assert.rejects(nommer(ouvert, { nom: '', horodatage: heure(2) }), TypeError);
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(await fichiersDe(disque), avant);
  });
});

// La charge d'épreuve et une seconde proposition cohérente : deux propositions
// que le dépôt fige, et que les gestes partagent.
function deuxPropositions() {
  const charge = chargeEssai();
  charge.propositions.push(placement(2, [[1, 2], [3, 4]]));
  charge.prochainsIds.proposition = 3;
  return charge;
}

// La valeur reçue recopiée, les clés de chaque objet à rebours, à toute
// profondeur.
function clesARebours(valeur) {
  if (Array.isArray(valeur)) return valeur.map(clesARebours);
  if (valeur === null || typeof valeur !== 'object') return valeur;
  return Object.fromEntries(Object.keys(valeur).reverse().map((cle) => [cle, clesARebours(valeur[cle])]));
}

// La charge reçue, à rebours hors de ses propositions : chaque objet recopié,
// ses clés à rebours, et les listes de personnes, de tables et de
// propositions à rebours. Sa copie canonique est celle de la charge reçue ;
// ses propositions sont les mêmes objets.
function aRebours(charge) {
  const { propositions, ...reste } = charge;
  const sortie = clesARebours(reste);
  sortie.participants.reverse();
  sortie.tables.reverse();
  return { propositions: [...propositions].reverse(), ...sortie };
}

// Les objets et les listes que valeur atteint, elle comprise.
function atteints(valeur, vus = new Set()) {
  if (valeur === null || typeof valeur !== 'object' || vus.has(valeur)) return vus;
  vus.add(valeur);
  for (const enfant of Array.isArray(valeur) ? valeur : Object.values(valeur)) atteints(enfant, vus);
  return vus;
}

// Le geste n de la séance d'épreuve, sur une copie de travail de charge, qui
// partage ses propositions figées : aux gestes 3 et 11, une proposition
// neuve, ses clés à rebours ; au geste 7, la première proposition retirée ;
// sinon une table déplacée quand n est multiple de 3, une inscription quand
// il est impair (inscrire), la note de la première personne sinon.
function gesteFige(charge, n) {
  const suivante = copieDeTravail(charge);
  if (n === 3 || n === 11) {
    const id = suivante.prochainsIds.proposition;
    suivante.propositions.push(clesARebours(placement(id, n === 3 ? [[1, 4], [2, 3]] : [[1, 2], [4, 3]])));
    suivante.prochainsIds.proposition = id + 1;
  } else if (n === 7) {
    suivante.propositions.shift();
  } else if (n % 3 === 0) {
    suivante.tables[0].position.x += 10;
  } else if (n % 2 === 1) {
    const id = suivante.prochainsIds.participant;
    suivante.participants.push({ ...personne(id, 'Brunelle', null, null), notes: `inscrite au geste ${n}`, exclu: true });
    suivante.prochainsIds.participant = id + 1;
  } else {
    suivante.participants[0].notes = `note ${n}`;
  }
  return suivante;
}

const GESTES_FIGES = 56;

// La séance d'épreuve des propositions figées : creer, puis GESTES_FIGES
// gestes (gesteFige), chacun à rebours (aRebours), l'événement rouvert du
// disque après le geste 20, le geste 30 un retour à l'instant 12. clone :
// chaque apres passe par structuredClone avant enregistrer, ce qui ne laisse
// rien de figé ni de partagé à aucun cache. Après chaque geste, l'épreuve
// vérifie la ligne et l'état contre ceux que ligneEntree et serialiser
// rendent d'une copie de la valeur écrite, la propriété du dépôt sur les
// propositions d'apres, et qu'aucune valeur atteinte par chargeJournal et
// par apres, la charge ouverte ou son examen ne soit libre ; puis elle gèle
// chargeJournal entier et modifie apres et la charge ouverte hors de leurs
// propositions. Rend les fichiers après chaque geste.
async function seanceFigee({ clone }) {
  let { disque, fs } = nouveauDisque();
  let ouvert = await creer(fs, DOC, deuxPropositions(), CREATION);
  let precedente = deuxPropositions();
  const releves = [];
  for (let n = 1; n <= GESTES_FIGES; n += 1) {
    if (n === 21) {
      fs = creerFichiersSimules({ disque });
      ouvert = await ouvrir(fs, DOC, BASE);
    }
    const retour = n === 30 ? { sens: 'revenir', retour: 12 } : {};
    let apres = aRebours(n === 30 ? reconstruire(ouvert.journal, 12) : gesteFige(ouvert.charge, n));
    if (clone) apres = structuredClone(apres);
    const valeur = structuredClone(apres);
    const revision = n + 1;
    ouvert = await enregistrer(ouvert, apres, geste(n, retour));
    const lignes = fs.contenu('documents', JOURNAL).split('\n');
    const attendue = ligneEntree({
      revision,
      libelle: `Geste ${n}`,
      horodatage: heure(n),
      produitVersion: null,
      sens: retour.sens ?? null,
      retour: retour.retour ?? null,
      avant: precedente,
      apres: valeur,
      instantane: estInstantane(revision, 1),
    });
    assert.equal(lignes.at(-2), attendue, `ligne du geste ${n}`);
    assert.equal(fs.contenu('documents', ETAT), serialiser(valeur, { revision, produitVersion: V1 }), `état du geste ${n}`);
    for (const p of apres.propositions) {
      assert.ok(estFigee(p), `geste ${n} : proposition ${p.id} d'apres figée`);
      assert.throws(() => {
        p.graine = 1;
      }, TypeError);
    }
    const autres = new Set([...atteints(apres), ...atteints(ouvert.charge), ...atteints(ouvert.examen)]);
    for (const objet of atteints(ouvert.chargeJournal)) {
      if (autres.has(objet)) assert.ok(estFigee(objet), `geste ${n} : chargeJournal partage un objet libre`);
    }
    figer(ouvert.chargeJournal);
    apres.participants[0].notes = `modifiée après le geste ${n}`;
    ouvert.charge.evenement.nom = `Soirée modifiée ${n}`;
    ouvert.charge.tables[1].position.y += 5;
    precedente = valeur;
    releves.push(await fichiersDe(disque));
  }
  return releves;
}

describe('dépôt : les propositions figées au dépôt, une copie canonique par geste (§ 8.1, § 8.2, § 8.8)', () => {
  test("après creer, ouvrir et enregistrer, chaque proposition de la charge ouverte et de chargeJournal est figée et refuse l'écriture ; canoniser en rend des copies neuves, et appliquer part de chargeJournal", async () => {
    const { disque, fs } = nouveauDisque();
    const charge = deuxPropositions();
    const cree = await creer(fs, DOC, charge, CREATION);
    for (const p of charge.propositions) {
      assert.ok(!estFigee(p) && !Object.isFrozen(p), 'creer gèle une copie, non la charge reçue');
    }
    const ouvert = await rouvrir(disque, BASE);
    const apres = gesteSur(ouvert.charge, 1);
    const enregistre = await enregistrer(ouvert, apres, geste(1));
    for (const [quoi, o] of [
      ['creer', cree],
      ['ouvrir', ouvert],
      ['enregistrer', enregistre],
    ]) {
      for (const cle of ['charge', 'chargeJournal']) {
        assert.equal(o[cle].propositions.length, 2, `${quoi} ${cle}`);
        for (const p of o[cle].propositions) {
          assert.ok(estFigee(p), `${quoi} : proposition ${p.id} de ${cle} figée`);
          assert.throws(() => {
            p.placement[0].reserve.push(9);
          }, TypeError);
        }
      }
      const copie = canoniser(o.chargeJournal);
      copie.propositions.forEach((p, rang) => {
        assert.notEqual(p, o.chargeJournal.propositions[rang], quoi);
        assert.ok(!estFigee(p) && !Object.isFrozen(p) && !Object.isFrozen(p.placement), quoi);
      });
      const suivante = modifier(o.charge, 9);
      const restituee = appliquer(o.chargeJournal, difference(o.chargeJournal, suivante));
      assert.equal(texteDeCharge(restituee), texteDeCharge(suivante), quoi);
    }
  });

  test("creer, ouvrir et enregistrer figent les propositions avant de les examiner : l'examen de l'Ouvert est celui qu'examiner garde en mémoire, et un nouvel examen rend le même tableau de raisons", async () => {
    // Lacasse exclue : la proposition 1, qui l'assoit, dérive.
    const derivee = () => {
      const charge = chargeEssai();
      charge.participants[3].exclu = true;
      return charge;
    };
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, derivee(), CREATION);
    const ouvert = await rouvrir(disque, BASE);
    const enregistre = await enregistrer(ouvert, modifier(ouvert.charge, 1), geste(1));
    for (const [quoi, o] of [
      ['creer', cree],
      ['ouvrir', ouvert],
      ['enregistrer', enregistre],
    ]) {
      assert.deepEqual(
        o.examen.derives.map(({ id, raisons }) => [id, raisons.map(({ code }) => code)]),
        [[1, ['PARTICIPANT_EXCLU']]],
        quoi,
      );
      assert.equal(examiner(o.charge).derives[0].raisons, o.examen.derives[0].raisons, `${quoi} : raisons gardées en mémoire`);
    }
  });

  test("écrire ailleurs, avec ou sans geste, gèle une copie : la charge du geste reste libre, et les propositions de l'Ouvert là-bas sont figées", async () => {
    const { fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, deuxPropositions(), CREATION);
    const apres = structuredClone(deuxPropositions());
    apres.participants[0].notes = 'renommée';
    const commun = { existantes: [], horodatage: heure(1) };
    const avecGeste = await enregistrerAilleurs(ouvert, DOC, {
      ...commun,
      geste: { apres, libelle: 'Renommage', produitVersion: V1 },
    });
    for (const p of apres.propositions) {
      assert.ok(!estFigee(p) && !Object.isFrozen(p), 'la charge du geste reste libre');
    }
    const sansGeste = await enregistrerAilleurs(ouvert, DOC, commun);
    for (const [quoi, o] of [
      ['avec geste', avecGeste],
      ['sans geste', sansGeste],
    ]) {
      for (const cle of ['charge', 'chargeJournal']) {
        for (const p of o[cle].propositions) assert.ok(estFigee(p), `${quoi} : proposition ${p.id} de ${cle} figée`);
      }
      const autres = new Set([...atteints(o.charge), ...atteints(o.examen), ...atteints(ouvert.charge)]);
      for (const objet of atteints(o.chargeJournal)) {
        if (autres.has(objet)) assert.ok(estFigee(objet), `${quoi} : chargeJournal partage un objet libre`);
      }
    }
  });

  test("un journal dont le dernier correctif sort la charge de l'ordre canonique s'ouvre sur sa copie canonique : le correctif du geste suivant est celui que ligneEntree rend depuis la valeur écrite", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    await enregistrer(cree, modifier(cree.charge, 1), geste(1));
    // L'entrée 2 change l'identifiant de la personne 2 et insère une
    // personne, ses clés à rebours : la liste et l'objet sortent de l'ordre
    // canonique.
    const lignes = fs.contenu('documents', JOURNAL).split('\n');
    const rang = rangDeLEntree(lignes.join('\n'), 2);
    const rompre = [
      { op: 'poser', chemin: ['participants', { id: 2 }, 'id'], valeur: 9 },
      { op: 'poser', chemin: ['participants', { id: 5 }], valeur: clesARebours(personne(5, 'Cormoran', null, null)) },
      { op: 'poser', chemin: ['prochainsIds', 'participant'], valeur: 10 },
    ];
    lignes[rang] = JSON.stringify({ ...JSON.parse(lignes[rang]), correctif: rompre });
    const texteJournal = lignes.join('\n');
    const valeur = reconstruire(lireJournal(texteJournal), 2);
    assert.notEqual(JSON.stringify(valeur), JSON.stringify(canoniser(valeur)), "hors de l'ordre canonique");
    fs.deposer('documents', JOURNAL, texteJournal);
    fs.deposer('documents', ETAT, etatTexte(valeur, 2));
    const ouvert = await rouvrir(disque, BASE);
    assert.equal(JSON.stringify(ouvert.chargeJournal), JSON.stringify(canoniser(valeur)));
    const apres = modifier(ouvert.charge, 3);
    const attendue = ligneEntree({
      revision: 3,
      libelle: 'Geste 3',
      horodatage: heure(3),
      produitVersion: null,
      avant: valeur,
      apres: structuredClone(apres),
      instantane: false,
    });
    await enregistrer(ouvert, apres, geste(3));
    assert.equal(lireJournal(ouvert.fs.contenu('documents', JOURNAL)).ecartees, 0);
    assert.equal(ouvert.fs.contenu('documents', JOURNAL).split('\n').at(-2), attendue);
  });

  test(`${GESTES_FIGES} gestes à rebours, rouverts en chemin, un retour compris : chaque ligne et chaque état sont ceux de ligneEntree et de serialiser sur une copie de la valeur écrite, apres appartient au dépôt, chargeJournal ne partage que du figé et ne change jamais ; sans aucun cache (structuredClone), les mêmes octets`, async () => {
    const partages = await seanceFigee({ clone: false });
    const libres = await seanceFigee({ clone: true });
    assert.equal(partages.length, GESTES_FIGES);
    partages.forEach((fichiers, rang) => assert.deepEqual(fichiers, libres[rang], `geste ${rang + 1}`));
  });
});

describe("dépôt : une panne à chaque frontière d'un geste (§ 8.8, § 14.10)", () => {
  test("coupure après la ligne de journal : la réouverture rattrape le geste en mémoire sans écrire, et le geste suivant écrit d'abord l'état rattrapé", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    const etatCree = fs.contenu('documents', ETAT);
    fs.pannes.couperApres(1);
    const apres = modifier(cree.charge, 2);
    await assert.rejects(enregistrer(cree, apres, geste(2)), PanneSimulee);
    assert.equal(fs.contenu('documents', ETAT), etatCree);
    assert.equal(fs.contenu('documents', PRECEDENT), null);

    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_REPRIS', details: {} }]);
    assert.equal(ouvert.revision, 2);
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(apres));
    assert.equal(ouvert.texteEtat, etatCree);

    const trace = tracer(ouvert.fs);
    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3));
    // L'état rattrapé s'écrit avant la ligne du geste : une coupure entre elle
    // et l'état ne laisse le journal qu'une entrée en avance (§ 8.2).
    assert.deepEqual(trace, [
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(suite.revision, 3);
    assert.equal(ouvert.fs.contenu('documents', PRECEDENT), etatTexte(apres, 2));
    exigerEquivalence(ouvert.fs, BASE);
    assert.deepEqual((await rouvrir(disque, BASE)).avertissements, []);
  });

  test('coupure après le .precedent : la réouverture rattrape le geste de même', async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    const etatCree = fs.contenu('documents', ETAT);
    fs.pannes.couperApres(2);
    const apres = modifier(cree.charge, 2);
    await assert.rejects(enregistrer(cree, apres, geste(2)), PanneSimulee);
    assert.equal(fs.contenu('documents', PRECEDENT), etatCree);
    assert.equal(fs.contenu('documents', ETAT), etatCree);

    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_REPRIS', details: {} }]);
    assert.equal(ouvert.revision, 2);
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(apres));
  });

  test("renommage de l'état refusé : ETAT_NON_ECRIT nomme l'état et son dossier, l'état reste intact, le .precedent se lit, et l'Ouvert avancé continue", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    const etatCree = fs.contenu('documents', ETAT);
    const retirer = refuserRenommageApresPrecedent(fs);
    const apres = modifier(cree.charge, 2);
    const erreur = await echec(enregistrer(cree, apres, geste(2)), 'ETAT_NON_ECRIT');
    const { ouvert: avance, ...details } = erreur.details;
    assert.deepEqual(details, { chemin: ETAT, dossier: DOCUMENTS, cause: 'EBUSY' });
    assert.ok(!erreur.message.includes('Ombrelle'), "le message de l'erreur ne porte pas l'Ouvert");
    assert.equal(fs.contenu('documents', ETAT), etatCree);
    assert.equal(fs.contenu('documents', `${ETAT}.ecriture`), null);
    assert.equal(analyser(fs.contenu('documents', PRECEDENT)).entete.revision, 1);
    assert.equal(avance.revision, 2);
    assert.equal(avance.texteEtat, etatCree);
    assert.equal(texteDeCharge(avance.charge), texteDeCharge(apres));
    assert.equal(avance.journal.entrees.length, 2);

    retirer();
    const suite = await enregistrer(avance, modifier(avance.charge, 3), geste(3));
    assert.equal(suite.revision, 3);
    // Le geste qui suit écrit d'abord l'état de l'Ouvert avancé, que le
    // renommage refusé n'a pas posé : il est le .precedent.
    assert.equal(fs.contenu('documents', PRECEDENT), etatTexte(apres, 2));
    exigerEquivalence(fs, BASE);
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual([ouvert.revision, ouvert.avertissements], [3, []]);
  });

  test("ajout au journal refusé : ECRITURE nomme le journal et son dossier, et rien n'a changé ; sans base de journal (JOURNAL_ETRANGER), un dossier qui ne se liste plus lève la même ECRITURE, sur le journal de la base", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    const avant = await fichiersDe(disque);
    fs.pannes.ecriture('documents');
    const erreur = await echec(enregistrer(cree, modifier(cree.charge, 2), geste(2)), 'ECRITURE');
    assert.deepEqual(erreur.details, { chemin: JOURNAL, dossier: DOCUMENTS, cause: 'EROFS' });
    assert.equal(fs.compteurs.ecritures, 3);
    assert.deepEqual(await fichiersDe(disque), avant);

    // Le journal de la base porte un autre événement : le geste cherche dans
    // le dossier le journal du sien (§ 8.6). Par cas, ce que devient le
    // dossier pour le processus, et la cause attendue : retiré avec son
    // support, chaque lecture lève ABSENT, sa liste comprise, et la cause est
    // ENOENT ; illisible, sa liste lève LECTURE, comme sous la coquille, dont
    // la cause passe telle quelle.
    const poses = [
      [ETAT, etatTexte(chargeEssai())],
      [JOURNAL, await journalEtranger()],
    ];
    const pannes = [
      [
        'support retiré',
        (lecteur) => {
          const absent = async (racine, chemin) => {
            throw new ErreurStockage('ABSENT', { chemin });
          };
          lecteur.lireTexte = absent;
          lecteur.lister = absent;
        },
        'ENOENT',
      ],
      [
        'dossier illisible',
        (lecteur) => {
          lecteur.lister = async (racine, chemin) => {
            throw new ErreurStockage('LECTURE', { chemin, dossier: DOCUMENTS, cause: 'EACCES' });
          };
        },
        'EACCES',
      ],
      // Le support se retire entre la liste où le geste cherche le journal de
      // l'événement et celle d'où il dérive une base libre.
      [
        'support retiré entre les deux listes',
        (lecteur) => {
          const listerAvant = lecteur.lister;
          let appels = 0;
          lecteur.lister = async (racine, chemin) => {
            appels += 1;
            if (appels > 1) throw new ErreurStockage('ABSENT', { chemin });
            return listerAvant(racine, chemin);
          };
        },
        'ENOENT',
      ],
    ];
    for (const [nom, rompre, cause] of pannes) {
      const etranger = disqueAvec(poses);
      const ouvert = await ouvrir(etranger.fs, DOC, BASE);
      assert.equal(etranger.fs.compteurs.ecritures, 0, `${nom} : ouvrir écrit`);
      assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ETRANGER', details: { evenement: 'evt-gala' } }], nom);
      const posesAvant = await fichiersDe(etranger.disque);
      rompre(etranger.fs);
      const options = geste(2, { libelleReprise: REPRISE });
      const refus = await echec(enregistrer(ouvert, modifier(ouvert.charge, 2), options), 'ECRITURE', nom);
      assert.deepEqual(refus.details, { chemin: JOURNAL, dossier: DOCUMENTS, cause }, nom);
      assert.equal(etranger.fs.compteurs.ecritures, 0, nom);
      assert.deepEqual(await fichiersDe(etranger.disque), posesAvant, nom);
    }
  });

  test('la reprise ne se fonde pas sur la date des fichiers : un dossier recopié, aux dates égales ou inversées, se rattrape pareil', async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    fs.pannes.couperApres(1);
    const apres = modifier(cree.charge, 2);
    await assert.rejects(enregistrer(cree, apres, geste(2)), PanneSimulee);
    const fichiers = await fichiersDe(disque);
    const dates = [() => 0, (nom) => (nom === JOURNAL ? 0 : 9e11)];
    for (const date of dates) {
      const copie = disqueAvec(fichiers.map(([nom, texte]) => [nom, texte, date(nom)]));
      const ouvert = await rouvrir(copie.disque, BASE);
      assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_REPRIS', details: {} }]);
      assert.equal(ouvert.revision, 2);
      assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(apres));
    }
  });

  test('une dernière ligne de journal tronquée, sans fin de ligne, est écartée et comptée ; le premier geste réécrit le journal sans elle', async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    await enregistrer(cree, modifier(cree.charge, 2), geste(2));
    const fichiers = await fichiersDe(disque);
    const journal = texteDe(fichiers, JOURNAL);
    const copie = disqueAvec(remplacer(fichiers, JOURNAL, `${journal}{"type":"entree","revision":3,"lib`));

    const ouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ECARTEES', details: { n: 1 } }]);
    assert.equal(ouvert.revision, 2);
    const trace = tracer(ouvert.fs);
    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3));
    assert.deepEqual(trace, [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    const reecrit = ouvert.fs.contenu('documents', JOURNAL);
    assert.ok(reecrit.startsWith(journal), 'les lignes lues se recopient telles quelles');
    assert.equal(exigerEquivalence(ouvert.fs, BASE).entrees.length, 3);
    assert.deepEqual(suite.avertissements, []);
    assert.deepEqual((await rouvrir(copie.disque, BASE)).avertissements, []);
  });

  test("le rattrapage prend la version de la construction qui a écrit le geste rattrapé : l'Ouvert la porte, l'écriture ailleurs et l'état réaligné l'inscrivent", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    fs.pannes.couperApres(1);
    await assert.rejects(enregistrer(cree, modifier(cree.charge, 2), geste(2, { produitVersion: V2 })), PanneSimulee);

    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_REPRIS', details: {} }]);
    assert.equal(ouvert.produitVersion, V2);
    const ailleurs = await enregistrerAilleurs(ouvert, DOC, { existantes: [] });
    const etatAilleurs = analyser(ouvert.fs.contenu('documents', `${ailleurs.base}${SUFFIXES.etat}`));
    assert.equal(etatAilleurs.entete.produitVersion, V2);
    // Le geste suivant écrit d'abord l'état rattrapé, à la version de son
    // entrée : il est ensuite le .precedent.
    await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3));
    assert.equal(analyser(ouvert.fs.contenu('documents', PRECEDENT)).entete.produitVersion, V2);
    exigerEquivalence(ouvert.fs, BASE);
  });

  test("un refus d'écriture pendant l'alignement lève ECRITURE, le geste hors du journal ; le même Ouvert le réessaie dans le même journal, sans doubler la reprise ni dériver un autre journal", async () => {
    const { fichiers } = await troisRevisions();
    const tete = `${texteDe(fichiers, JOURNAL).split('\n').slice(0, 3).join('\n')}\n`;
    // Par cas : les fichiers posés, l'ouverture, la base du journal de
    // l'événement et ses entrées après le refus. Quand le journal de la base
    // porte un autre événement, la reprise crée celui de l'événement sous une
    // base que son nom dérive : le nouvel essai doit l'y retrouver.
    const cas = [
      [
        'journal incomplet (JOURNAL_INCOMPLET)',
        remplacer(fichiers, JOURNAL, tete),
        (fs) => ouvrir(fs, DOC, BASE),
        BASE,
        [
          [1, CREATION.libelle],
          [2, REPRISE],
        ],
      ],
      [
        'secours .precedent sur un état lisible, le journal de la base à un autre événement (JOURNAL_ETRANGER)',
        remplacer(fichiers, JOURNAL, await journalEtranger()),
        (fs) => ouvrirSecours(fs, DOC, BASE, 'precedent'),
        `${BASE} (2)`,
        [[2, REPRISE]],
      ],
    ];
    for (const [nom, poses, ouvrirAinsi, base, apresRefus] of cas) {
      const { disque, fs } = disqueAvec(poses);
      const ouvert = await ouvrirAinsi(fs);
      assert.equal(fs.compteurs.ecritures, 0, `${nom} : l'ouverture écrit`);
      const journal = `${base}${SUFFIXES.journal}`;
      const retirer = refuserRenommageApresPrecedent(fs);
      const apres = modifier(ouvert.charge, 4);
      const options = geste(4, { libelleReprise: REPRISE });
      const erreur = await echec(enregistrer(ouvert, apres, options), 'ECRITURE');
      assert.deepEqual(erreur.details, { chemin: ETAT, dossier: DOCUMENTS, cause: 'EBUSY' }, nom);
      assert.deepEqual(revisionsEtLibelles(lireJournal(fs.contenu('documents', journal))), apresRefus, nom);
      assert.equal(fs.contenu('documents', ETAT), texteDe(fichiers, ETAT), nom);
      const nomsApresRefus = (await fichiersDe(disque)).map(([fichier]) => fichier);

      retirer();
      const trace = tracer(fs);
      const suite = await enregistrer(ouvert, apres, options);
      assert.deepEqual(
        trace,
        [
          ['ecrireAtomique', journal],
          ['ecrireAtomique', PRECEDENT],
          ['ecrireAtomique', ETAT],
          ['ajouterLigne', journal],
          ['ecrireAtomique', PRECEDENT],
          ['ecrireAtomique', ETAT],
        ],
        nom,
      );
      assert.deepEqual(
        (await fichiersDe(disque)).map(([fichier]) => fichier),
        nomsApresRefus,
        nom,
      );
      assert.deepEqual([suite.revision, suite.baseJournal], [3, base], nom);
      assert.deepEqual(
        revisionsEtLibelles(exigerEquivalence(fs, BASE, { journal: base })),
        [...apresRefus, [3, 'Geste 4']],
        nom,
      );
      const rouvert = await rouvrir(disque, BASE);
      assert.deepEqual([rouvert.revision, rouvert.baseJournal, rouvert.avertissements], [3, base, []], nom);
    }
  });

  // Les ouvertures après lesquelles l'état sur le disque ne porte pas la
  // révision de la dernière entrée du journal. Chacune pose ses fichiers, puis
  // rend la fonction qui rouvre sur un disque neuf l'Ouvert d'où part le
  // premier geste.
  const departsMalAlignes = [
    [
      'journal incomplet de deux entrées (JOURNAL_INCOMPLET)',
      async () => {
        const { fichiers } = await troisRevisions();
        const tete = `${texteDe(fichiers, JOURNAL).split('\n').slice(0, 3).join('\n')}\n`;
        return depuisFichiers(remplacer(fichiers, JOURNAL, tete), (fs) => ouvrir(fs, DOC, BASE), ['JOURNAL_INCOMPLET']);
      },
    ],
    [
      'journal en avance de deux entrées (JOURNAL_EN_AVANCE_DE)',
      async () => {
        const { disque, fs } = nouveauDisque();
        let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
        ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2));
        const etat2 = fs.contenu('documents', ETAT);
        for (const n of [3, 4]) ouvert = await enregistrer(ouvert, modifier(ouvert.charge, n), geste(n));
        const fichiers = remplacer(await fichiersDe(disque), ETAT, etat2);
        return depuisFichiers(fichiers, (lecteur) => ouvrir(lecteur, DOC, BASE), ['JOURNAL_EN_AVANCE_DE']);
      },
    ],
    [
      "journal en avance d'une entrée (JOURNAL_REPRIS)",
      async () => {
        const { disque, fs } = nouveauDisque();
        const cree = await creer(fs, DOC, chargeEssai(), CREATION);
        fs.pannes.couperApres(1);
        await assert.rejects(enregistrer(cree, modifier(cree.charge, 2), geste(2)), PanneSimulee);
        return depuisFichiers(await fichiersDe(disque), (lecteur) => ouvrir(lecteur, DOC, BASE), ['JOURNAL_REPRIS']);
      },
    ],
    [
      'secours .precedent sur un état lisible',
      async () => {
        const { fichiers } = await troisRevisions();
        return depuisFichiers(fichiers, (fs) => ouvrirSecours(fs, DOC, BASE, 'precedent'), ['JOURNAL_EN_AVANCE_DE']);
      },
    ],
    [
      'secours .precedent sur un état lisible, sans journal',
      async () => {
        const { fichiers } = await troisRevisions();
        const sansJournal = remplacer(fichiers, JOURNAL, null);
        return depuisFichiers(sansJournal, (fs) => ouvrirSecours(fs, DOC, BASE, 'precedent'), []);
      },
    ],
    [
      'secours .precedent sur un état lisible, le journal de la base à un autre événement (JOURNAL_ETRANGER)',
      async () => {
        const { fichiers } = await troisRevisions();
        const etranger = remplacer(fichiers, JOURNAL, await journalEtranger());
        return depuisFichiers(etranger, (fs) => ouvrirSecours(fs, DOC, BASE, 'precedent'), ['JOURNAL_ETRANGER']);
      },
    ],
    [
      'secours journal sur un état lisible, le journal incomplet',
      async () => {
        const { fichiers } = await troisRevisions();
        const tete = `${texteDe(fichiers, JOURNAL).split('\n').slice(0, 3).join('\n')}\n`;
        const incomplet = remplacer(fichiers, JOURNAL, tete);
        return depuisFichiers(incomplet, (fs) => ouvrirSecours(fs, DOC, BASE, 'journal'), []);
      },
    ],
    [
      "Ouvert avancé d'un ETAT_NON_ECRIT",
      async () => async () => {
        const { disque, fs } = nouveauDisque();
        const cree = await creer(fs, DOC, chargeEssai(), CREATION);
        const retirer = refuserRenommageApresPrecedent(fs);
        const erreur = await echec(enregistrer(cree, modifier(cree.charge, 2), geste(2)), 'ETAT_NON_ECRIT');
        retirer();
        return { disque, ouvert: erreur.details.ouvert };
      },
    ],
    [
      "Ouvert avancé d'un ETAT_NON_ECRIT tombé après l'alignement d'un journal incomplet",
      async () => {
        const { fichiers } = await troisRevisions();
        const tete = `${texteDe(fichiers, JOURNAL).split('\n').slice(0, 3).join('\n')}\n`;
        const incomplet = remplacer(fichiers, JOURNAL, tete);
        return async () => {
          const { disque, fs } = disqueAvec(incomplet);
          const ouvert = await ouvrir(fs, DOC, BASE);
          assert.equal(fs.compteurs.ecritures, 0, 'ouvrir écrit');
          // Le .precedent de l'alignement passe ; celui du geste arme le refus.
          const retirer = refuserRenommageApresPrecedent(fs, 2);
          const options = geste(4, { libelleReprise: REPRISE });
          const erreur = await echec(enregistrer(ouvert, modifier(ouvert.charge, 4), options), 'ETAT_NON_ECRIT');
          retirer();
          return { disque, ouvert: erreur.details.ouvert };
        };
      },
    ],
  ];
  for (const [nom, poser] of departsMalAlignes) {
    test(`coupure à chaque écriture du premier geste après une ouverture mal alignée, ${nom} : le geste inscrit au journal se rouvre toujours`, async () => {
      assert.ok((await exigerChaqueCoupure(nom, await poser())) > 0, nom);
    });
  }
});

describe('dépôt : un état illisible et ses secours (§ 8.8)', () => {
  test("un état vide, tronqué ou aux comptes faux lève ETAT_ILLISIBLE, qui nomme la base, la raison et les secours lisibles, sans rien écrire", async () => {
    const { fichiers } = await troisRevisions();
    const etat = texteDe(fichiers, ETAT);
    const cas = [
      ['', 'VIDE', null],
      [etat.slice(0, Math.floor(etat.length / 2)), 'JSON', null],
      [
        etat.replace(/"comptes":\{"participants":(\d+)/, (_, n) => `"comptes":{"participants":${Number(n) + 1}`),
        'COMPTES',
        'entete.comptes.participants',
      ],
    ];
    for (const [texte, raison, chemin] of cas) {
      const { fs } = disqueAvec(remplacer(fichiers, ETAT, texte));
      const erreur = await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE');
      assert.deepEqual(erreur.details, { base: BASE, raison, chemin, secours: { precedent: 2, journal: 3 } });
      assert.equal(fs.compteurs.ecritures, 0);
    }
  });

  test("ouvrirSecours ouvre le .precedent, puis le dernier instant du journal, sans écrire ni rendre un événement vide", async () => {
    const { fichiers, ouvert: dernier } = await troisRevisions();
    const precedent = analyser(texteDe(fichiers, PRECEDENT));
    const { fs } = disqueAvec(remplacer(fichiers, ETAT, ''));

    const parPrecedent = await ouvrirSecours(fs, DOC, BASE, 'precedent');
    assert.equal(parPrecedent.revision, 2);
    assert.equal(texteDeCharge(parPrecedent.charge), texteDeCharge(precedent.charge));
    assert.equal(parPrecedent.texteEtat, null);
    assert.deepEqual(parPrecedent.avertissements, [{ code: 'JOURNAL_EN_AVANCE_DE', details: { n: 1 } }]);

    const parJournal = await ouvrirSecours(fs, DOC, BASE, 'journal');
    assert.equal(parJournal.revision, 3);
    assert.equal(texteDeCharge(parJournal.charge), texteDeCharge(dernier.charge));
    assert.equal(parJournal.texteEtat, null);
    assert.equal(parJournal.produitVersion, V1);
    assert.deepEqual(parJournal.avertissements, []);

    assert.deepEqual(
      [parPrecedent, parJournal].map(({ charge }) => charge.participants.length),
      [4, 5],
    );
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test("le premier geste après un secours réécrit l'état et ne met pas l'état illisible dans le .precedent", async () => {
    const { fichiers } = await troisRevisions();
    const textePrecedent = texteDe(fichiers, PRECEDENT);

    // Depuis le journal : le geste suit son dernier instant.
    const parJournal = disqueAvec(remplacer(fichiers, ETAT, '{"entete":'));
    const depuisJournal = await ouvrirSecours(parJournal.fs, DOC, BASE, 'journal');
    assert.equal(parJournal.fs.compteurs.ecritures, 0, 'ouvrirSecours écrit');
    const traceJournal = tracer(parJournal.fs);
    const suiteJournal = await enregistrer(depuisJournal, modifier(depuisJournal.charge, 4), geste(4));
    assert.deepEqual(traceJournal, [
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(parJournal.fs.contenu('documents', PRECEDENT), textePrecedent);
    assert.equal(suiteJournal.revision, 4);
    exigerEquivalence(parJournal.fs, BASE);
    assert.deepEqual((await rouvrir(parJournal.disque, BASE)).avertissements, []);

    // Depuis le .precedent : une entrée de reprise restitue sa charge, puis
    // vient le geste. Sans libellé de reprise, le geste est refusé.
    const parPrecedent = disqueAvec(remplacer(fichiers, ETAT, '{"entete":'));
    const depuisPrecedent = await ouvrirSecours(parPrecedent.fs, DOC, BASE, 'precedent');
    assert.equal(parPrecedent.fs.compteurs.ecritures, 0, 'ouvrirSecours écrit');
    await assert.rejects(enregistrer(depuisPrecedent, modifier(depuisPrecedent.charge, 4), geste(4)), TypeError);
    assert.equal(parPrecedent.fs.compteurs.ecritures, 0);
    const tracePrecedent = tracer(parPrecedent.fs);
    const reprise = geste(4, { libelleReprise: REPRISE });
    const suitePrecedent = await enregistrer(depuisPrecedent, modifier(depuisPrecedent.charge, 4), reprise);
    assert.deepEqual(tracePrecedent, [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(parPrecedent.fs.contenu('documents', PRECEDENT), textePrecedent);
    const journal = exigerEquivalence(parPrecedent.fs, BASE);
    assert.deepEqual(revisionsEtLibelles(journal), [
      [1, CREATION.libelle],
      [2, 'Geste 2'],
      [3, 'Geste 3'],
      [4, REPRISE],
      [5, 'Geste 4'],
    ]);
    assert.equal(texteDeCharge(reconstruire(journal, 4)), texteDeCharge(analyser(textePrecedent).charge));
    assert.equal(suitePrecedent.revision, 5);
    assert.deepEqual((await rouvrir(parPrecedent.disque, BASE)).avertissements, []);
  });

  test("un journal sans état lève ETAT_ILLISIBLE, raison ABSENT, secours du journal ; ouvert par lui, le premier geste écrit l'état", async () => {
    const { fichiers } = await troisRevisions();
    const cas = [
      [remplacer(fichiers, ETAT, null), { precedent: 2, journal: 3 }],
      [remplacer(remplacer(fichiers, ETAT, null), PRECEDENT, null), { precedent: null, journal: 3 }],
    ];
    for (const [restants, secours] of cas) {
      const { fs } = disqueAvec(restants);
      const erreur = await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE');
      assert.deepEqual(erreur.details, { base: BASE, raison: 'ABSENT', chemin: null, secours });
      const ouvert = await ouvrirSecours(fs, DOC, BASE, 'journal');
      assert.equal(fs.compteurs.ecritures, 0);
      assert.equal(ouvert.revision, 3);
      await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4));
      exigerEquivalence(fs, BASE);
    }
  });

  test('un .precedent seul lève ETAT_ILLISIBLE ABSENT avec son secours ; un événement sans aucun fichier lève ABSENT', async () => {
    const { fichiers } = await troisRevisions();
    const { fs } = disqueAvec(fichiers.filter(([nom]) => nom === PRECEDENT));
    assert.deepEqual((await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE')).details, {
      base: BASE,
      raison: 'ABSENT',
      chemin: null,
      secours: { precedent: 2, journal: null },
    });
    assert.deepEqual((await echec(ouvrir(fs, DOC, 'Inconnu'), 'ABSENT')).details, { chemin: 'Inconnu.gtt.json' });
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test("ouvrirSecours refuse une source sans instant : .precedent absent ou illisible, journal absent ou sans entrée, source inconnue", async () => {
    const { fs } = disqueAvec([[ETAT, etatTexte(chargeEssai())]]);
    assert.deepEqual((await echec(ouvrirSecours(fs, DOC, BASE, 'precedent'), 'ABSENT')).details, { chemin: PRECEDENT });
    assert.deepEqual((await echec(ouvrirSecours(fs, DOC, BASE, 'journal'), 'ABSENT')).details, { chemin: JOURNAL });
    fs.deposer('documents', PRECEDENT, '{');
    fs.deposer('documents', JOURNAL, `${ligneOuverture('evt-lucioles')}\n`);
    assert.deepEqual((await echec(ouvrirSecours(fs, DOC, BASE, 'precedent'), 'ETAT_ILLISIBLE')).details, {
      raison: 'JSON',
      chemin: null,
    });
    await echec(ouvrirSecours(fs, DOC, BASE, 'journal'), 'ABSENT');
    await assert.rejects(ouvrirSecours(fs, DOC, BASE, 'etat'), RangeError);
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test("ouvrirSecours sur un état lisible : le .precedent s'ouvre ; au premier geste, l'état lisible passe au .precedent et l'état s'aligne sur la reprise, avant le geste ; chaque geste qui suit restitue l'état écrit", async () => {
    // Le cas d'un retenu fautif, dont le secours est le .precedent (§ 8.9).
    // Le .precedent n'a pas la personne que l'état a inscrite (troisRevisions).
    const { fichiers } = await troisRevisions();
    const etat = texteDe(fichiers, ETAT);
    const { fs } = disqueAvec(fichiers);
    const ouvert = await ouvrirSecours(fs, DOC, BASE, 'precedent');
    assert.equal(ouvert.texteEtat, etat);
    assert.equal(ouvert.revision, 2);
    const parJournal = await ouvrirSecours(fs, DOC, BASE, 'journal');
    assert.equal(parJournal.revision, 3);
    assert.equal(fs.compteurs.ecritures, 0);
    const trace = tracer(fs);
    const precedents = [];
    const ecrire = fs.ecrireAtomique;
    fs.ecrireAtomique = async (racine, chemin, texte) => {
      if (chemin === PRECEDENT) precedents.push(texte);
      return ecrire(racine, chemin, texte);
    };
    let suite = await enregistrer(ouvert, gesteSur(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
    assert.deepEqual(trace, [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(precedents[0], etat);
    // Le .precedent final est l'état aligné sur la reprise, d'avant le geste ;
    // l'état lisible reste au journal, à sa révision.
    const precedent = analyser(fs.contenu('documents', PRECEDENT));
    assert.equal(precedent.entete.revision, 4);
    assert.equal(texteDeCharge(precedent.charge), texteDeCharge(ouvert.charge));
    const journal = exigerEquivalence(fs, BASE);
    assert.equal(texteDeCharge(reconstruire(journal, 3)), texteDeCharge(analyser(etat).charge));
    // Les gestes suivants, une inscription puis une note, s'ajoutent.
    for (const n of [5, 6]) {
      suite = await enregistrer(suite, gesteSur(suite.charge, n), geste(n));
      exigerEquivalence(fs, BASE);
    }
    assert.equal(suite.revision, 7);
  });

  test("un état illisible apparie ses secours par l'identifiant de son .precedent, jamais par le nom : le journal de l'événement sous une autre base est proposé et s'ouvre, celui d'un autre événement à la base jamais ; sans .precedent, le journal de la base que porte un état lisible n'est pas le sien", async () => {
    const { fichiers } = await troisRevisions();
    const tronque = (texte) => texte.slice(0, Math.floor(texte.length / 2));
    const libre = `${BASE} (2)`;
    const carnet = `Carnet${SUFFIXES.journal}`;
    // Le journal de la base porte un autre événement : le geste crée celui de
    // l'événement sous une base dérivée, puis l'état devient illisible.
    const etranger = disqueAvec(remplacer(fichiers, JOURNAL, await journalEtranger()));
    const avecEtranger = await ouvrir(etranger.fs, DOC, BASE);
    assert.equal(etranger.fs.compteurs.ecritures, 0, 'ouvrir écrit');
    await enregistrer(avecEtranger, gesteSur(avecEtranger.charge, 4), geste(4, { libelleReprise: REPRISE }));
    const apresGeste = await fichiersDe(etranger.disque);
    const illisibleApresGeste = remplacer(apresGeste, ETAT, tronque(texteDe(apresGeste, ETAT)));
    // Un événement dont le journal a été renommé à la main sous Glycine, à
    // côté d'un état Glycine illisible et sans .precedent.
    const hortensia = nouveauDisque();
    const charge = chargeEssai({ id: 'evt-h', nom: 'Hortensia' });
    await enregistrer(await creer(hortensia.fs, DOC, charge, CREATION), gesteSur(charge, 2), geste(2));
    const glycine = [
      ['Hortensia.gtt.json', hortensia.fs.contenu('documents', 'Hortensia.gtt.json')],
      ['Glycine.gtt.json', '{'],
      ['Glycine.gtt-journal.jsonl', hortensia.fs.contenu('documents', 'Hortensia.gtt-journal.jsonl')],
    ];
    // Par cas : les fichiers posés, la base ouverte, les secours attendus, et
    // la base du journal que le secours ouvre, que lister nomme aussi ; null
    // quand aucun ne s'apparie, et ouvrirSecours('journal') lève ABSENT.
    const cas = [
      [
        "après JOURNAL_ETRANGER, le journal de l'événement sous une base dérivée",
        illisibleApresGeste,
        BASE,
        { precedent: 3, journal: 4 },
        libre,
      ],
      [
        'après JOURNAL_ETRANGER, sans le journal dérivé : celui de la base, étranger, ne se propose pas',
        remplacer(illisibleApresGeste, `${libre}${SUFFIXES.journal}`, null),
        BASE,
        { precedent: 3, journal: null },
        null,
      ],
      [
        'le journal renommé à la main',
        [...remplacer(remplacer(fichiers, JOURNAL, null), ETAT, '{'), [carnet, texteDe(fichiers, JOURNAL)]],
        BASE,
        { precedent: 2, journal: 3 },
        'Carnet',
      ],
      [
        "sans .precedent, le journal de la base porte l'événement d'un état lisible",
        glycine,
        'Glycine',
        { precedent: null, journal: null },
        null,
      ],
    ];
    for (const [nom, poses, base, secours, baseJournal] of cas) {
      const { disque, fs } = disqueAvec(poses);
      const erreur = await echec(ouvrir(fs, DOC, base), 'ETAT_ILLISIBLE');
      assert.deepEqual(erreur.details, { base, raison: 'JSON', chemin: null, secours }, nom);
      const resumes = (await lister(fs, DOC)).filter((autre) => autre.base === base || autre.base === baseJournal);
      assert.deepEqual(
        resumes.map(({ base: autre, journal, illisible }) => [autre, journal, illisible]),
        [[base, baseJournal, 'JSON']],
        nom,
      );
      if (baseJournal === null) {
        const absent = await echec(ouvrirSecours(fs, DOC, base, 'journal'), 'ABSENT');
        assert.deepEqual(absent.details, { chemin: `${base}${SUFFIXES.journal}` }, nom);
        assert.equal(fs.compteurs.ecritures, 0, nom);
        continue;
      }
      const parJournal = await ouvrirSecours(fs, DOC, base, 'journal');
      assert.equal(fs.compteurs.ecritures, 0, nom);
      assert.deepEqual(
        [parJournal.revision, parJournal.baseJournal, parJournal.charge.evenement.id, parJournal.avertissements],
        [secours.journal, baseJournal, 'evt-lucioles', []],
        nom,
      );
      // Le geste suivant s'inscrit au journal de l'événement, et nulle part
      // ailleurs.
      const avant = new Map(await fichiersDe(disque));
      await enregistrer(parJournal, gesteSur(parJournal.charge, 5), geste(5));
      exigerEquivalence(fs, BASE, { journal: baseJournal });
      const changes = (await fichiersDe(disque)).filter(([fichier, texte]) => avant.get(fichier) !== texte);
      assert.deepEqual(
        changes.map(([fichier]) => fichier).sort(),
        [ETAT, `${baseJournal}${SUFFIXES.journal}`].sort(),
        nom,
      );
    }
  });
});

describe('dépôt : des octets hors UTF-8 (§ 8.8)', () => {
  test("un état aux octets hors UTF-8 lève ETAT_ILLISIBLE, raison ENCODAGE, avec ses secours, sans rien écrire ; lister le montre illisible, apparié par son .precedent", async () => {
    const { fichiers } = await troisRevisions();
    const { fs } = disqueAvecOctets(fichiers, ETAT, malEncode(texteDe(fichiers, ETAT)));
    const erreur = await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE');
    assert.deepEqual(erreur.details, {
      base: BASE,
      raison: 'ENCODAGE',
      chemin: null,
      secours: { precedent: 2, journal: 3 },
    });
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base, id, illisible, journal }) => [base, id, illisible, journal]),
      [[BASE, 'evt-lucioles', 'ENCODAGE', BASE]],
    );
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test("ouvert d'un secours, le premier geste met l'état aux octets hors UTF-8 dans un dossier neuf de la corbeille, daté du geste, ses octets intacts, puis écrit le journal et l'état ; un jalon n'écrit que le journal, sans toucher l'état", async () => {
    const { fichiers } = await troisRevisions();
    const octets = malEncode(texteDe(fichiers, ETAT));
    const ecritureDuJournal = { journal: ['ajouterLigne', JOURNAL], precedent: ['ecrireAtomique', JOURNAL] };
    for (const source of ['journal', 'precedent']) {
      const { disque, fs } = disqueAvecOctets(fichiers, ETAT, octets);
      // Le dossier de la même seconde, déjà pris pour le secours .precedent,
      // fait prendre le rang suivant.
      if (source === 'precedent') fs.deposerDossier('documents', 'corbeille/2031-05-17_08-04-00');
      const corbeille = `corbeille/2031-05-17_08-04-00${source === 'precedent' ? '_2' : ''}`;
      const ouvert = await ouvrirSecours(fs, DOC, BASE, source);
      assert.deepEqual([ouvert.etatMalEncode, ouvert.texteEtat], [true, null], source);
      const trace = tracer(fs);
      const suite = await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
      assert.deepEqual(
        trace,
        [['creerDossier', corbeille], ['deplacer', ETAT], ecritureDuJournal[source], ['ecrireAtomique', ETAT]],
        source,
      );
      assert.deepEqual(fs.octets('documents', `${corbeille}/${ETAT}`), octets, source);
      assert.equal(fs.contenu('documents', PRECEDENT), texteDe(fichiers, PRECEDENT), source);
      assert.equal(suite.etatMalEncode, false, source);
      exigerEquivalence(fs, BASE);
      const rouvert = await rouvrir(disque, BASE);
      assert.deepEqual([rouvert.revision, rouvert.avertissements], [suite.revision, []], source);
    }

    const { fs } = disqueAvecOctets(fichiers, ETAT, octets);
    const parJournal = await ouvrirSecours(fs, DOC, BASE, 'journal');
    const trace = tracer(fs);
    const nomme = await nommer(parJournal, { nom: 'Avant la reprise', horodatage: heure(5) });
    assert.deepEqual(trace, [['ajouterLigne', JOURNAL]]);
    assert.equal(nomme.etatMalEncode, true);
    assert.deepEqual(fs.octets('documents', ETAT), octets);
  });

  test("un geste refusé après la mise de côté de l'état aux octets hors UTF-8 se réessaie du même Ouvert sans rien déplacer de nouveau : un seul dossier daté, qui garde les octets", async () => {
    const { fichiers } = await troisRevisions();
    const octets = malEncode(texteDe(fichiers, ETAT));
    const { fs } = disqueAvecOctets(fichiers, ETAT, octets);
    const ouvert = await ouvrirSecours(fs, DOC, BASE, 'journal');
    const ajouter = fs.ajouterLigne;
    fs.ajouterLigne = async (racine, chemin) => {
      fs.ajouterLigne = ajouter;
      throw new ErreurStockage('ECRITURE', { chemin, dossier: racine.chemin, cause: 'EIO' });
    };
    const options = geste(4, { libelleReprise: REPRISE });
    await echec(enregistrer(ouvert, modifier(ouvert.charge, 4), options), 'ECRITURE');
    assert.equal(fs.contenu('documents', JOURNAL), texteDe(fichiers, JOURNAL));
    const trace = tracer(fs);
    await enregistrer(ouvert, modifier(ouvert.charge, 4), options);
    assert.deepEqual(trace, [
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', ETAT],
    ]);
    assert.deepEqual(
      (await fs.lister(DOC, 'corbeille')).map(({ nom }) => nom),
      ['2031-05-17_08-04-00'],
    );
    assert.deepEqual(fs.octets('documents', `corbeille/2031-05-17_08-04-00/${ETAT}`), octets);
    exigerEquivalence(fs, BASE);
  });

  test("une corbeille qui ne se liste plus, au moment de mettre de côté l'état aux octets hors UTF-8, lève ECRITURE sur la corbeille sans rien écrire : l'état reste à sa place", async () => {
    const { fichiers } = await troisRevisions();
    const octets = malEncode(texteDe(fichiers, ETAT));
    const { fs } = disqueAvecOctets(fichiers, ETAT, octets);
    const ouvert = await ouvrirSecours(fs, DOC, BASE, 'journal');
    const lister = fs.lister;
    fs.lister = async (racine, dossier) => {
      if (dossier !== 'corbeille') return lister(racine, dossier);
      throw new ErreurStockage('LECTURE', { chemin: dossier, dossier: racine.chemin, cause: 'EACCES' });
    };
    const ecritures = fs.compteurs.ecritures;
    const erreur = await echec(enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4)), 'ECRITURE');
    assert.deepEqual(erreur.details, { chemin: 'corbeille', dossier: DOCUMENTS, cause: 'EACCES' });
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(fs.octets('documents', ETAT), octets);
  });

  test("un .precedent aux octets hors UTF-8 ne gêne pas l'état lisible ; ouvert en secours, il lève ETAT_ILLISIBLE ENCODAGE ; un état illisible à côté de lui s'apparie par son journal", async () => {
    const { fichiers } = await troisRevisions();
    const { fs } = disqueAvecOctets(fichiers, PRECEDENT, malEncode(texteDe(fichiers, PRECEDENT)));
    const ouvert = await ouvrir(fs, DOC, BASE);
    assert.deepEqual([ouvert.revision, ouvert.etatMalEncode, ouvert.avertissements], [3, false, []]);
    const erreur = await echec(ouvrirSecours(fs, DOC, BASE, 'precedent'), 'ETAT_ILLISIBLE');
    assert.deepEqual(erreur.details, { raison: 'ENCODAGE', chemin: null });
    fs.deposer('documents', ETAT, '');
    const illisible = await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE');
    assert.deepEqual(illisible.details, {
      base: BASE,
      raison: 'VIDE',
      chemin: null,
      secours: { precedent: null, journal: 3 },
    });
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base, id, illisible: raison }) => [base, id, raison]),
      [[BASE, 'evt-lucioles', 'VIDE']],
    );
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test("un journal dont la ligne d'ouverture n'est pas de l'UTF-8 n'empêche pas d'ouvrir l'état : il n'est ni lu, ni apparié, ni remplacé, JOURNAL_ILLISIBLE {raison: ENCODAGE} ; le premier geste écrit l'historique sous une base libre, que la réouverture apparie", async () => {
    const { fichiers } = await troisRevisions();
    const octets = ligneMalEncodee(texteDe(fichiers, JOURNAL), 0);
    const { disque, fs } = disqueAvecOctets(fichiers, JOURNAL, octets);
    const ouvert = await ouvrir(fs, DOC, BASE);
    assert.equal(fs.compteurs.ecritures, 0);
    assert.deepEqual([ouvert.revision, ouvert.journal, ouvert.baseJournal], [3, null, null]);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ILLISIBLE', details: { raison: 'ENCODAGE' } }]);
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base, id, illisible, journal }) => [base, id, illisible, journal]),
      [[BASE, 'evt-lucioles', null, null]],
    );
    const secours = await echec(ouvrirSecours(fs, DOC, BASE, 'journal'), 'ETAT_ILLISIBLE');
    assert.deepEqual(secours.details, { raison: 'ENCODAGE', chemin: JOURNAL });

    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
    assert.notEqual(suite.baseJournal, BASE);
    assert.deepEqual(fs.octets('documents', JOURNAL), octets);
    const journal = exigerEquivalence(fs, BASE, { journal: suite.baseJournal });
    assert.deepEqual(revisionsEtLibelles(journal), [
      [3, REPRISE],
      [4, 'Geste 4'],
    ]);
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual([rouvert.revision, rouvert.baseJournal, rouvert.avertissements], [4, suite.baseJournal, []]);
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base, journal: apparie }) => [base, apparie]),
      [[BASE, suite.baseJournal]],
    );
  });

  test("un journal seul dont la ligne d'ouverture n'est pas de l'UTF-8 se liste sans identifiant, et s'ouvre en ETAT_ILLISIBLE ABSENT sans secours, non en ABSENT : il existe", async () => {
    const { fichiers } = await troisRevisions();
    const { fs } = disqueAvecOctets([], JOURNAL, ligneMalEncodee(texteDe(fichiers, JOURNAL), 0));
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base, id, illisible, journal }) => [base, id, illisible, journal]),
      [[BASE, null, 'ABSENT', BASE]],
    );
    const erreur = await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE');
    assert.deepEqual(erreur.details, {
      base: BASE,
      raison: 'ABSENT',
      chemin: null,
      secours: { precedent: null, journal: null },
    });
    assert.equal(fs.compteurs.ecritures, 0);
  });

  test("une dernière ligne de journal coupée au milieu d'un caractère de deux octets s'écarte comme une ligne illisible, JOURNAL_ECARTEES {n: 1} : le journal reste celui de l'événement, apparié et ouvrable en secours, et le premier geste le réécrit sans elle", async () => {
    const { fichiers } = await troisRevisions();
    const texte = texteDe(fichiers, JOURNAL);
    const coupee = new TextEncoder().encode('{"type":"entree","revision":4,"libelle":"Ajout de Th');
    const octets = new Uint8Array([...new TextEncoder().encode(texte), ...coupee, 0xc3]);
    const { disque, fs } = disqueAvecOctets(fichiers, JOURNAL, octets);
    const ouvert = await ouvrir(fs, DOC, BASE);
    assert.equal(fs.compteurs.ecritures, 0);
    assert.deepEqual([ouvert.revision, ouvert.baseJournal, ouvert.journalAReecrire], [3, BASE, true]);
    assert.deepEqual(revisionsEtLibelles(ouvert.journal), revisionsEtLibelles(lireJournal(texte)));
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ECARTEES', details: { n: 1 } }]);
    assert.deepEqual(
      (await lister(fs, DOC)).map(({ base, id, illisible, journal }) => [base, id, illisible, journal]),
      [[BASE, 'evt-lucioles', null, BASE]],
    );
    assert.equal((await ouvrirSecours(fs, DOC, BASE, 'journal')).revision, 3);
    assert.equal(fs.compteurs.ecritures, 0);

    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4));
    assert.equal(suite.baseJournal, BASE);
    const journal = exigerEquivalence(fs, BASE);
    assert.deepEqual(
      journal.entrees.map(({ revision }) => revision),
      [1, 2, 3, 4],
    );
    assert.deepEqual(
      (await fichiersDe(disque)).map(([nom]) => nom),
      [JOURNAL, ETAT, PRECEDENT],
    );
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual([rouvert.revision, rouvert.avertissements], [4, []]);
  });

  test("un octet hors UTF-8 dans l'entrée 37 d'un journal de 100 entrées arrête la lecture sur elle : 36 entrées retenues, 64 écartées et comptées, le journal toujours apparié", async () => {
    const { disque, fs } = nouveauDisque();
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    for (let n = 2; n <= 100; n += 1) ouvert = await enregistrer(ouvert, modifier(ouvert.charge, n), geste(n));
    const texte = fs.contenu('documents', JOURNAL);
    assert.equal(lireJournal(texte).entrees.length, 100);
    fs.deposerOctets('documents', JOURNAL, ligneMalEncodee(texte, rangDeLEntree(texte, 37)));
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual(
      rouvert.journal.entrees.map(({ revision }) => revision),
      Array.from({ length: 36 }, (_, i) => i + 1),
    );
    assert.equal(rouvert.journal.ecartees, 64);
    assert.equal(rouvert.baseJournal, BASE);
    assert.deepEqual(rouvert.avertissements, [
      { code: 'JOURNAL_INCOMPLET', details: { etat: 100, journal: 36 } },
      { code: 'JOURNAL_ECARTEES', details: { n: 64 } },
    ]);
  });
});

describe("dépôt : l'état sans journal, et le journal apparié par identifiant (§ 8.6)", () => {
  test("un état sans journal s'ouvre ; le premier geste crée le journal par une entrée de reprise, instantané de l'état trouvé", async () => {
    const charge = chargeEssai();
    const etat = etatTexte(charge, 7, V2);
    const { disque, fs } = disqueAvec([[ETAT, etat]]);
    const ouvert = await ouvrir(fs, DOC, BASE);
    assert.equal(fs.compteurs.ecritures, 0);
    assert.equal(ouvert.journal, null);
    assert.deepEqual(ouvert.avertissements, []);
    assert.equal(ouvert.revision, 7);

    await assert.rejects(enregistrer(ouvert, modifier(ouvert.charge, 8), geste(8)), TypeError);
    assert.equal(fs.compteurs.ecritures, 0);
    const trace = tracer(fs);
    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 8), geste(8, { libelleReprise: REPRISE }));
    assert.deepEqual(trace, [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    const journal = exigerEquivalence(fs, BASE);
    assert.equal(journal.evenement, 'evt-lucioles');
    assert.deepEqual(
      journal.entrees.map(({ revision, libelle, produitVersion, instantane }) => [
        revision,
        libelle,
        produitVersion,
        instantane !== null,
      ]),
      [
        [7, REPRISE, V2, true],
        [8, 'Geste 8', V1, false],
      ],
    );
    assert.equal(texteDeCharge(reconstruire(journal, 7)), texteDeCharge(charge));
    assert.equal(fs.contenu('documents', PRECEDENT), etat);
    assert.equal(suite.revision, 8);
    assert.deepEqual((await rouvrir(disque, BASE)).avertissements, []);
  });

  test("nommer un état sans journal crée le journal par l'entrée de reprise, puis le jalon, sans écrire l'état", async () => {
    const etat = etatTexte(chargeEssai(), 7);
    const { fs } = disqueAvec([[ETAT, etat]]);
    const ouvert = await ouvrir(fs, DOC, BASE);
    assert.equal(fs.compteurs.ecritures, 0, 'ouvrir écrit');
    const nomme = await nommer(ouvert, { nom: 'Avant la génération', horodatage: heure(8), libelleReprise: REPRISE });
    assert.equal(fs.compteurs.ecritures, 1);
    assert.equal(fs.contenu('documents', ETAT), etat);
    const journal = lireJournal(fs.contenu('documents', JOURNAL));
    assert.deepEqual(revisionsEtLibelles(journal), [[7, REPRISE]]);
    assert.deepEqual(
      journal.jalons.map(({ revision, nom }) => [revision, nom]),
      [[7, 'Avant la génération']],
    );
    assert.equal(nomme.revision, 7);
    assert.deepEqual(nomme.journal, journal);
  });

  test("un journal renommé à la main reste apparié par l'identifiant : ouvrir le lit, le geste l'allonge, lister le nomme", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, chargeEssai(), CREATION);
    await enregistrer(cree, modifier(cree.charge, 2), geste(2));
    const fichiers = await fichiersDe(disque);
    const carnet = `Carnet${SUFFIXES.journal}`;
    const copie = disqueAvec([...remplacer(fichiers, JOURNAL, null), [carnet, texteDe(fichiers, JOURNAL)]]);

    const ouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(ouvert.avertissements, []);
    assert.equal(ouvert.baseJournal, 'Carnet');
    assert.equal(ouvert.journal.entrees.length, 2);
    const trace = tracer(ouvert.fs);
    await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3));
    assert.deepEqual(trace, [
      ['ajouterLigne', carnet],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    exigerEquivalence(ouvert.fs, BASE, { journal: 'Carnet' });
    const ecritures = ouvert.fs.compteurs.ecritures;
    const [resume] = await lister(ouvert.fs, DOC);
    assert.equal(ouvert.fs.compteurs.ecritures, ecritures, 'lister écrit');
    assert.deepEqual([resume.base, resume.journal], [BASE, 'Carnet']);
  });

  test("le journal d'un autre événement sous le nom de la base est JOURNAL_ETRANGER, que l'état de cet événement soit dans le dossier ou non : ni lu, ni touché, ni ouvert en secours ; le premier geste crée le journal sous une base libre ; l'autre événement s'apparie à ce journal par son identifiant, même déplacé sous la base", async () => {
    const { disque, fs } = nouveauDisque();
    const gala = "Gala d'automne";
    const journalGala = `${gala}${SUFFIXES.journal}`;
    await creer(fs, DOC, chargeEssai(), CREATION);
    await creer(fs, DOC, chargeEssai({ id: 'evt-gala', nom: gala }), CREATION);
    const fichiers = await fichiersDe(disque);
    const libre = 'Soirée des Lucioles (2)';
    // Par cas : les fichiers posés — l'état de l'événement à la révision 1,
    // sans .precedent, tel que le laissent creer, enregistrerAilleurs ou
    // l'import d'un état seul, et le journal de Gala sous la base —, la base
    // du journal auquel l'état de Gala s'apparie, null sans cet état, puis ce
    // que lister rend après les gestes, [base, journal]. Sans l'état de Gala,
    // aucun état lisible du dossier ne porte l'identifiant de ce journal, et
    // la règle d'un état illisible (§ 8.6) le prendrait pour celui de la
    // base : seul l'identifiant de l'état lisible l'écarte, au secours comme
    // à l'ouverture. Sans son propre journal, l'état de Gala s'apparie à
    // celui que la main a déplacé sous la base : l'état de cette base porte
    // un autre événement, si bien que ce journal n'appartient pas à sa base.
    const cas = [
      [
        "l'état de Gala dans le dossier",
        remplacer(fichiers, JOURNAL, texteDe(fichiers, journalGala)),
        gala,
        [
          [gala, gala],
          [BASE, libre],
        ],
      ],
      [
        'le journal de Gala seul, sans son état',
        [
          [ETAT, texteDe(fichiers, ETAT)],
          [JOURNAL, await journalEtranger()],
        ],
        null,
        [[BASE, libre]],
      ],
      [
        "l'état de Gala sans son journal, que la main a déplacé sous la base",
        remplacer(remplacer(fichiers, JOURNAL, texteDe(fichiers, journalGala)), journalGala, null),
        BASE,
        [
          [gala, BASE],
          [BASE, libre],
        ],
      ],
    ];
    for (const [nom, poses, baseGala, resumesApres] of cas) {
      const copie = disqueAvec(poses);
      if (baseGala !== null) {
        // Gala s'ouvre sur le journal qui porte son identifiant, et son geste
        // s'y ajoute.
        const apparie = `${baseGala}${SUFFIXES.journal}`;
        const ouvertGala = await rouvrir(copie.disque, gala);
        assert.equal(ouvertGala.baseJournal, baseGala, nom);
        assert.deepEqual(
          [ouvertGala.journal, ouvertGala.avertissements],
          [lireJournal(texteDe(poses, apparie)), []],
          nom,
        );
        const traceGala = tracer(ouvertGala.fs);
        await enregistrer(ouvertGala, modifier(ouvertGala.charge, 2), geste(2));
        assert.deepEqual(
          traceGala,
          [
            ['ajouterLigne', apparie],
            ['ecrireAtomique', `${gala}${SUFFIXES.precedent}`],
            ['ecrireAtomique', `${gala}${SUFFIXES.etat}`],
          ],
          nom,
        );
        exigerEquivalence(ouvertGala.fs, gala, { journal: baseGala });
      }
      const ouvert = await rouvrir(copie.disque, BASE);
      assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ETRANGER', details: { evenement: 'evt-gala' } }], nom);
      assert.equal(ouvert.journal, null, nom);
      assert.equal(ouvert.revision, 1, nom);
      const absent = await echec(ouvrirSecours(ouvert.fs, DOC, BASE, 'journal'), 'ABSENT', nom);
      assert.deepEqual(absent.details, { chemin: JOURNAL }, nom);
      assert.equal(ouvert.fs.compteurs.ecritures, 0, nom);
      const journalDeLaBase = ouvert.fs.contenu('documents', JOURNAL);
      const trace = tracer(ouvert.fs);
      await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2, { libelleReprise: REPRISE }));
      assert.deepEqual(
        trace,
        [
          ['ecrireAtomique', `${libre}${SUFFIXES.journal}`],
          ['ecrireAtomique', PRECEDENT],
          ['ecrireAtomique', ETAT],
        ],
        nom,
      );
      assert.equal(ouvert.fs.contenu('documents', JOURNAL), journalDeLaBase, nom);
      exigerEquivalence(ouvert.fs, BASE, { journal: libre });

      const rouvert = await rouvrir(copie.disque, BASE);
      assert.deepEqual([rouvert.avertissements, rouvert.baseJournal], [[], libre], nom);
      const ecritures = rouvert.fs.compteurs.ecritures;
      const resumes = await lister(rouvert.fs, DOC);
      assert.equal(rouvert.fs.compteurs.ecritures, ecritures, nom);
      assert.deepEqual(
        resumes.map(({ base, journal }) => [base, journal]),
        resumesApres,
        nom,
      );
    }
  });

  test("un état copié à la main dans le dossier, sans son journal, ne s'apparie pas au journal que l'état de l'original, ou à défaut son .precedent, dit sien : la copie crée le sien au premier geste, et l'original n'en voit rien", async () => {
    const { disque, fs } = nouveauDisque();
    let original = await creer(fs, DOC, chargeEssai({ id: 'evt-dahlia', nom: 'Dahlia' }), CREATION);
    original = await enregistrer(original, gesteSur(original.charge, 2), geste(2));
    const etatOriginal = `Dahlia${SUFFIXES.etat}`;
    const journalOriginal = `Dahlia${SUFFIXES.journal}`;
    const copie = 'Dahlia - Copie';
    // Le copier-coller d'un explorateur : l'état seul, sous un autre nom.
    const poses = await fichiersDe(disque);
    const fichiers = [...poses, [`${copie}${SUFFIXES.etat}`, texteDe(poses, etatOriginal)]];
    // Par cas : l'état posé pour l'original, et ce que lister rend, [base,
    // journal, doublon].
    const cas = [
      ["l'original lisible", texteDe(fichiers, etatOriginal), [['Dahlia', 'Dahlia', true], [copie, null, true]]],
      ["l'original illisible, que son .precedent dit sien", '{', [[copie, null, false], ['Dahlia', 'Dahlia', false]]],
    ];
    for (const [nom, etat, resumes] of cas) {
      const dossier = disqueAvec(remplacer(fichiers, etatOriginal, etat));
      assert.deepEqual(
        (await lister(dossier.fs, DOC)).map(({ base, journal, doublon }) => [base, journal, doublon]),
        resumes,
        nom,
      );
      assert.equal(dossier.fs.compteurs.ecritures, 0, nom);
      const ouvert = await rouvrir(dossier.disque, copie);
      assert.deepEqual([ouvert.journal, ouvert.baseJournal, ouvert.avertissements], [null, copie, []], nom);

      // La copie crée son journal par une entrée de reprise ; celui de
      // l'original ne bouge pas.
      await enregistrer(ouvert, gesteSur(ouvert.charge, 3), geste(3, { libelleReprise: REPRISE }));
      assert.equal(ouvert.fs.contenu('documents', journalOriginal), texteDe(fichiers, journalOriginal), nom);
      assert.deepEqual(
        revisionsEtLibelles(exigerEquivalence(ouvert.fs, copie)),
        [
          [2, REPRISE],
          [3, 'Geste 3'],
        ],
        nom,
      );
      if (etat === '{') {
        const lecteur = creerFichiersSimules({ disque: dossier.disque });
        const erreur = await echec(ouvrir(lecteur, DOC, 'Dahlia'), 'ETAT_ILLISIBLE');
        assert.deepEqual(erreur.details.secours, { precedent: 1, journal: 2 }, nom);
        assert.equal(lecteur.compteurs.ecritures, 0, nom);
        continue;
      }
      const rouvert = await rouvrir(dossier.disque, 'Dahlia');
      assert.deepEqual([rouvert.revision, rouvert.avertissements], [2, []], nom);
      assert.equal(texteDeCharge(rouvert.charge), texteDeCharge(original.charge), nom);
    }
  });

  test("un journal en avance de plusieurs entrées laisse l'état tel quel, JOURNAL_EN_AVANCE_DE ; la première écriture, jalon ou geste, inscrit l'entrée de reprise, et chaque geste restitue l'état écrit", async () => {
    // Les gestes 2 à 4 alternent note et inscription (gesteSur) : l'état remis
    // à la révision 2 n'a pas la personne que le journal inscrit ensuite.
    const { disque, fs } = nouveauDisque();
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    ouvert = await enregistrer(ouvert, gesteSur(ouvert.charge, 2), geste(2));
    const etat2 = fs.contenu('documents', ETAT);
    for (const n of [3, 4]) ouvert = await enregistrer(ouvert, gesteSur(ouvert.charge, n), geste(n));
    const fichiers = remplacer(await fichiersDe(disque), ETAT, etat2);
    const copie = disqueAvec(fichiers);

    const rouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(rouvert.avertissements, [{ code: 'JOURNAL_EN_AVANCE_DE', details: { n: 2 } }]);
    assert.equal(rouvert.revision, 2);
    assert.equal(rouvert.texteEtat, etat2);

    // Nommer inscrit la reprise, puis le jalon sur elle ; l'état reste.
    const nomme = await nommer(rouvert, { nom: 'Retour à la sauvegarde', horodatage: heure(5), libelleReprise: REPRISE });
    assert.equal(rouvert.fs.compteurs.ecritures, 1);
    assert.equal(nomme.revision, 5);
    assert.deepEqual(nomme.avertissements, []);
    assert.equal(rouvert.fs.contenu('documents', ETAT), etat2);

    const trace = tracer(rouvert.fs);
    let suite = await enregistrer(nomme, gesteSur(nomme.charge, 6), geste(6));
    assert.equal(suite.revision, 6);
    // L'état s'aligne d'abord sur la reprise que nommer a inscrite : il est
    // ensuite le .precedent.
    assert.deepEqual(trace, [
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(rouvert.fs.contenu('documents', PRECEDENT), etatTexte(analyser(etat2).charge, 5));
    const journal = exigerEquivalence(rouvert.fs, BASE);
    assert.deepEqual(
      revisionsEtLibelles(journal).slice(3),
      [
        [4, 'Geste 4'],
        [5, REPRISE],
        [6, 'Geste 6'],
      ],
    );
    assert.equal(texteDeCharge(reconstruire(journal, 5)), texteDeCharge(analyser(etat2).charge));
    assert.deepEqual(journal.jalons.at(-1).revision, 5);
    // Les gestes suivants, une inscription puis une note, s'ajoutent.
    for (const n of [7, 8]) {
      suite = await enregistrer(suite, gesteSur(suite.charge, n), geste(n));
      exigerEquivalence(rouvert.fs, BASE);
    }

    // Sans jalon, le premier geste inscrit lui-même la reprise, puis s'inscrit.
    const directe = await rouvrir(disqueAvec(fichiers).disque, BASE);
    await enregistrer(directe, gesteSur(directe.charge, 6), geste(6, { libelleReprise: REPRISE }));
    assert.deepEqual(revisionsEtLibelles(exigerEquivalence(directe.fs, BASE)).slice(3), [
      [4, 'Geste 4'],
      [5, REPRISE],
      [6, 'Geste 6'],
    ]);
  });

  test("un état en avance du journal s'ouvre tel quel, JOURNAL_INCOMPLET ; le premier geste inscrit l'entrée de reprise à la suite du journal, aligne l'état sur elle, puis s'inscrit ; chaque geste restitue l'état écrit", async () => {
    const { fichiers, ouvert: dernier } = await troisRevisions();
    // Le journal ne garde que son ouverture, l'entrée 1 et son jalon : il n'a
    // pas la personne que l'état a inscrite (troisRevisions).
    const tete = `${texteDe(fichiers, JOURNAL).split('\n').slice(0, 3).join('\n')}\n`;
    const copie = disqueAvec(remplacer(fichiers, JOURNAL, tete));

    const ouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_INCOMPLET', details: { etat: 3, journal: 1 } }]);
    assert.equal(ouvert.revision, 3);
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(dernier.charge));

    const trace = tracer(ouvert.fs);
    let suite = await enregistrer(ouvert, gesteSur(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
    // La reprise seule, l'état aligné sur elle, puis le geste : une coupure ne
    // laisse le journal qu'une entrée en avance au plus (§ 8.2).
    assert.deepEqual(trace, [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    const journal = exigerEquivalence(ouvert.fs, BASE);
    // La reprise et le geste viennent de la construction de l'entrée 1 : aucun
    // ne note sa version.
    assert.deepEqual(
      journal.entrees.map(({ revision, libelle, produitVersion }) => [revision, libelle, produitVersion]),
      [
        [1, CREATION.libelle, V1],
        [2, REPRISE, null],
        [3, 'Geste 4', null],
      ],
    );
    assert.equal(texteDeCharge(reconstruire(journal, 2)), texteDeCharge(dernier.charge));
    assert.equal(suite.revision, 3);
    // Les gestes suivants, une inscription puis une note, s'ajoutent.
    for (const n of [5, 6]) {
      suite = await enregistrer(suite, gesteSur(suite.charge, n), geste(n));
      exigerEquivalence(ouvert.fs, BASE);
    }
    assert.deepEqual((await rouvrir(copie.disque, BASE)).avertissements, []);
  });

  test("une reprise qui ouvre un intervalle s'écrit en instantané : journal des révisions 1 à 50, état à la 52", async () => {
    const { disque, fs } = nouveauDisque();
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    for (let n = 2; n <= 50; n += 1) ouvert = await enregistrer(ouvert, modifier(ouvert.charge, n), geste(n));
    const fichiers = await fichiersDe(disque);
    const copie = disqueAvec(remplacer(fichiers, ETAT, etatTexte(modifier(ouvert.charge, 52), 52)));

    const rouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(rouvert.avertissements, [{ code: 'JOURNAL_INCOMPLET', details: { etat: 52, journal: 50 } }]);
    await enregistrer(rouvert, modifier(rouvert.charge, 53), geste(53, { libelleReprise: REPRISE }));
    const journal = exigerEquivalence(rouvert.fs, BASE);
    assert.deepEqual(
      journal.entrees.slice(-2).map(({ revision, libelle, instantane }) => [revision, libelle, instantane !== null]),
      [
        [51, REPRISE, true],
        [52, 'Geste 53', false],
      ],
    );
  });

  test("un correctif qui ne s'applique pas écarte son entrée et ce qui la suit ; le premier geste réécrit le journal jusqu'à l'instant restituable", async () => {
    const { fichiers } = await troisRevisions();
    const lignes = texteDe(fichiers, JOURNAL).replace(/\n$/, '').split('\n');
    const rang = lignes.findIndex((ligne) => JSON.parse(ligne).revision === 3);
    const fausse = JSON.parse(lignes[rang]);
    fausse.correctif = [{ op: 'retirer', chemin: ['participants', { id: 99 }] }];
    lignes[rang] = JSON.stringify(fausse);
    lignes.push(ligneJalon({ revision: 3, nom: 'Après le geste 3', horodatage: heure(3) }));
    const copie = disqueAvec(remplacer(fichiers, JOURNAL, `${lignes.join('\n')}\n`));

    const ouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(ouvert.avertissements, [
      { code: 'JOURNAL_INCOMPLET', details: { etat: 3, journal: 2 } },
      { code: 'JOURNAL_ECARTEES', details: { n: 2 } },
    ]);
    assert.equal(ouvert.journal.entrees.length, 2);
    assert.equal(ouvert.revision, 3);

    await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
    assert.equal(ouvert.fs.compteurs.ecritures, 3);
    const journal = exigerEquivalence(ouvert.fs, BASE);
    assert.deepEqual(revisionsEtLibelles(journal).slice(2), [
      [3, REPRISE],
      [4, 'Geste 4'],
    ]);
    assert.ok(!ouvert.fs.contenu('documents', JOURNAL).includes('"id":99'));
    assert.deepEqual((await rouvrir(copie.disque, BASE)).avertissements, []);
  });

  test("un journal dont l'ouverture ne se lit pas est écarté en entier ; le premier geste le remplace par un journal neuf", async () => {
    const { fichiers } = await troisRevisions();
    const copie = disqueAvec(remplacer(fichiers, JOURNAL, 'pas du JSON\n{"type":"entree"}\n'));
    const ouvert = await rouvrir(copie.disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ECARTEES', details: { n: 2 } }]);
    assert.equal(ouvert.journal, null);
    assert.equal(ouvert.baseJournal, BASE);

    const trace = tracer(ouvert.fs);
    await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
    assert.deepEqual(trace.map(([, chemin]) => chemin), [JOURNAL, PRECEDENT, ETAT]);
    const journal = exigerEquivalence(ouvert.fs, BASE);
    assert.deepEqual(revisionsEtLibelles(journal), [
      [3, REPRISE],
      [4, 'Geste 4'],
    ]);
    assert.deepEqual((await rouvrir(copie.disque, BASE)).avertissements, []);
  });
});

describe('dépôt : propositions fautives et périmées, retenu fautif (§ 8.9)', () => {
  test("une proposition qui se contredit est écartée et nommée, PROPOSITIONS_FAUTIVES, et le fichier s'ouvre", async () => {
    const { disque } = disqueAvec([[ETAT, etatTexte(avecFautive())]]);
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'PROPOSITIONS_FAUTIVES', details: { ids: [2] } }]);
    assert.deepEqual(
      ouvert.charge.propositions.map(({ id }) => id),
      [1],
    );
    assert.deepEqual(
      ouvert.examen.fautives.map(({ id, fautes }) => [id, fautes.map(({ code }) => code)]),
      [[2, ['DOUBLON', 'MANQUANT']]],
    );
    assert.equal(ouvert.charge.participants.length, 4);
  });

  test("une proposition que l'en-tête compte sans que la liste la porte s'annonce par leur nombre, PROPOSITIONS_MANQUANTES {n}, et un retenu annoncé absent, RETENU_FAUTIF : le fichier s'ouvre ; rattrapé du journal, ou après un geste, plus rien ne manque", async () => {
    const charge = chargeEssai();
    charge.propositions.push(placement(2, [[1, 2], [3, 4]]));
    charge.prochainsIds.proposition = 3;
    charge.retenu = retenuDe(charge.propositions[0]);
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, charge, CREATION);
    await enregistrer(cree, modifier(cree.charge, 2), geste(2));
    const fichiers = await fichiersDe(disque);
    // L'état perd la proposition 1 et le retenu, ses comptes intacts.
    const tronquer = (texte) => {
      const fichier = JSON.parse(texte);
      fichier.charge.propositions.shift();
      fichier.charge.retenu = null;
      return JSON.stringify(fichier);
    };
    const tronque = tronquer(texteDe(fichiers, ETAT));
    assert.deepEqual(analyser(tronque).manquants, { propositions: 1, retenu: true });

    const sansJournal = disqueAvec([[ETAT, tronque]]);
    const ouvert = await rouvrir(sansJournal.disque, BASE);
    assert.deepEqual(ouvert.avertissements, [
      { code: 'RETENU_FAUTIF', details: {} },
      { code: 'PROPOSITIONS_MANQUANTES', details: { n: 1 } },
    ]);
    assert.deepEqual([ouvert.charge.propositions.map(({ id }) => id), ouvert.charge.retenu], [[2], null]);
    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3, { libelleReprise: REPRISE }));
    assert.deepEqual(suite.avertissements, []);
    const relu = analyser(sansJournal.fs.contenu('documents', ETAT));
    assert.deepEqual(relu.manquants, { propositions: 0, retenu: false });

    // Le journal en avance d'une entrée rend sa charge, qui ne manque de rien.
    const enRetard = tronquer(texteDe(fichiers, PRECEDENT));
    const avecJournal = disqueAvec(remplacer(fichiers, ETAT, enRetard));
    const rattrape = await rouvrir(avecJournal.disque, BASE);
    assert.deepEqual(rattrape.avertissements, [{ code: 'JOURNAL_REPRIS', details: {} }]);
    assert.deepEqual([rattrape.revision, rattrape.charge.propositions.length], [2, 2]);
    assert.notEqual(rattrape.charge.retenu, null);
  });

  test("un en-tête qui annonce 2^40 propositions s'ouvre : PROPOSITIONS_MANQUANTES ne porte que leur nombre, jamais une liste de cette taille, à côté des fautives nommées", async () => {
    const fichier = JSON.parse(etatTexte(avecFautive()));
    fichier.entete.comptes.propositions = 2 ** 40;
    const { disque } = disqueAvec([[ETAT, JSON.stringify(fichier)]]);
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [
      { code: 'PROPOSITIONS_FAUTIVES', details: { ids: [2] } },
      { code: 'PROPOSITIONS_MANQUANTES', details: { n: 2 ** 40 - 2 } },
    ]);
    assert.ok(JSON.stringify(ouvert.avertissements).length < 200);
  });

  test('une proposition et un retenu périmés sont gardés et signalés, DERIVE : personne exclue, table supprimée, capacité réduite, tour retiré, personne ajoutée', async () => {
    // Par péremption, ce qui a changé dans la charge depuis la production de
    // sa proposition : périmées, la proposition et le retenu se gardent et se
    // signalent, sans s'écarter (§ 8.9, point 3 ; § 9).
    const exclure = (charge) => {
      charge.participants[2].exclu = true;
    };
    // Chacune avec la raison de dérive qu'elle donne (examiner).
    const parExclusion = 'PARTICIPANT_EXCLU';
    const peremptions = [
      ['personne exclue', exclure, parExclusion],
      [
        'table supprimée',
        (charge) => {
          charge.tables = charge.tables.filter(({ id }) => id !== 2);
        },
        'TABLE_SUPPRIMEE',
      ],
      [
        // La proposition date d'une table 1 à trois sièges ; elle en a deux,
        // ceux du défaut.
        'capacité réduite',
        (charge) => {
          charge.propositions[0].capacites = [3, 2];
        },
        'CAPACITE_CHANGEE',
      ],
      [
        'tour retiré',
        (charge) => {
          charge.evenement.tours = 1;
        },
        'TOURS_CHANGES',
      ],
      [
        'personne ajoutée',
        (charge) => {
          charge.participants.push(personne(5, 'Brunelle', null, null));
          charge.prochainsIds.participant = 6;
        },
        'PARTICIPANT_NON_PLACE',
      ],
    ];
    // Chaque péremption avec une proposition et le retenu qui la reprend ;
    // l'exclusion aussi avec la proposition seule, et avec le retenu seul.
    const tout = { retenu: true, propositions: true };
    const propositionSeule = { retenu: false, propositions: true };
    const retenuSeul = { retenu: true, propositions: false };
    const cas = [
      ...peremptions.map(([nom, perimer, raison]) => [nom, perimer, raison, tout, { ids: [1], retenu: true }]),
      ['personne exclue, proposition seule', exclure, parExclusion, propositionSeule, { ids: [1], retenu: false }],
      ['personne exclue, retenu seul', exclure, parExclusion, retenuSeul, { ids: [], retenu: true }],
    ];
    for (const [nom, perimer, raison, { retenu, propositions }, details] of cas) {
      const charge = chargeEssai();
      perimer(charge);
      if (retenu) charge.retenu = retenuDe(charge.propositions[0]);
      if (!propositions) charge.propositions = [];
      const { disque } = disqueAvec([[ETAT, etatTexte(charge)]]);
      const ouvert = await rouvrir(disque, BASE);
      assert.deepEqual(ouvert.avertissements, [{ code: 'DERIVE', details }], nom);
      assert.deepEqual(ouvert.charge.propositions, charge.propositions, nom);
      assert.deepEqual(ouvert.charge.retenu, charge.retenu, nom);
      const codes = (raisons) => raisons.map(({ code }) => code);
      assert.deepEqual(
        ouvert.examen.derives.map(({ raisons }) => codes(raisons)),
        propositions ? [[raison]] : [],
        nom,
      );
      assert.deepEqual(codes(ouvert.examen.retenu.raisons), retenu ? [raison] : [], nom);
    }
  });

  test('un retenu qui se contredit donne RETENU_FAUTIF en premier avertissement, et reste', async () => {
    const charge = avecFautive();
    charge.retenu = retenuDe(placement(1, [[1, 3], [2]]));
    const { disque } = disqueAvec([[ETAT, etatTexte(charge)]]);
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(
      ouvert.avertissements.map(({ code }) => code),
      ['RETENU_FAUTIF', 'PROPOSITIONS_FAUTIVES'],
    );
    assert.deepEqual(ouvert.charge.retenu, charge.retenu);
    assert.deepEqual(
      ouvert.examen.retenu.fautes.map(({ code }) => code),
      ['MANQUANT'],
    );
  });

  test("après une proposition écartée, le geste suivant s'inscrit depuis la charge du journal : sa dernière entrée restitue l'état écrit", async () => {
    const { disque, fs } = nouveauDisque();
    const cree = await creer(fs, DOC, avecFautive(), CREATION);
    assert.deepEqual(cree.avertissements, [{ code: 'PROPOSITIONS_FAUTIVES', details: { ids: [2] } }]);
    const ouvert = await rouvrir(disque, BASE);
    const suite = await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2));
    exigerEquivalence(ouvert.fs, BASE);
    assert.deepEqual(
      analyser(ouvert.fs.contenu('documents', ETAT)).charge.propositions.map(({ id }) => id),
      [1],
    );
    assert.deepEqual(suite.avertissements, []);
  });
});

// L'entrée du compagnon des courses du placement p, à evalues mouvements
// évalués : un point de relevé à chaque puissance de dix strictement sous
// evalues, chacun une copie du placement de p (§ 8.9, B31).
function entreeDe(p, evalues = 100) {
  const releves = [];
  for (let mouvements = 1; mouvements < evalues; mouvements *= 10) {
    releves.push({ mouvements, placement: structuredClone(p.placement) });
  }
  return entreeDeCourse(p, { evalues, releves });
}

// La charge reçue, les propositions 2 et 3 ajoutées et le compteur relevé,
// et les entrées de leurs courses : ce qu'enregistre une génération.
function generation(charge) {
  const apres = structuredClone(charge);
  const nouvelles = [placement(2, [[1, 2], [3, 4]]), placement(3, [[1, 4], [2, 3]])];
  apres.propositions.push(...nouvelles);
  apres.prochainsIds.proposition = 4;
  return { apres, courses: [entreeDe(nouvelles[0]), entreeDe(nouvelles[1], 1_000)] };
}

// Le texte du compagnon des courses de l'événement d'épreuve.
const compagnon = (entrees) => texteDesCourses('evt-lucioles', entrees);

// Le nombre d'appels de Math.imul pendant faire(), et ce que faire rend :
// l'empreinte d'un placement (courses.js) est le seul code de src à
// l'appeler, si bien qu'un compte nul dit qu'aucun placement ne s'est
// haché.
async function hachages(faire) {
  const imul = Math.imul;
  let n = 0;
  Math.imul = (a, b) => {
    n += 1;
    return imul(a, b);
  };
  try {
    const rendu = await faire();
    return { n, rendu };
  } finally {
    Math.imul = imul;
  }
}

describe('dépôt : le compagnon des courses (§ 8.6, § 8.9, B31)', () => {
  test("une génération écrit le compagnon après l'état ; un geste qui garde les mêmes propositions ne l'écrit pas ; rouvert, l'événement retrouve chaque course", async () => {
    const { disque, fs } = nouveauDisque();
    const trace = tracer(fs);
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    assert.equal(fs.contenu('documents', COURSES), null, 'une création sans course connue écrit un compagnon');
    assert.equal(courseDe(ouvert, 1), null);

    trace.length = 0;
    const { apres, courses } = generation(ouvert.charge);
    const genere = await enregistrer(ouvert, apres, geste(2, { courses }));
    assert.deepEqual(trace.slice(-2), [['ecrireAtomique', ETAT], ['ecrireAtomique', COURSES]]);
    assert.equal(fs.contenu('documents', COURSES), compagnon(courses));
    assert.equal(courseDe(genere, 3).evalues, 1_000);
    assert.equal(courseDe(genere, 1), null);
    // Le fichier d'état et le journal ne portent aucune course.
    assert.equal(fs.contenu('documents', ETAT).includes('evalues'), false);
    assert.equal(fs.contenu('documents', JOURNAL).includes('evalues'), false);

    trace.length = 0;
    let suite = genere;
    for (const n of [3, 4, 5]) suite = await enregistrer(suite, gesteSur(suite.charge, n), geste(n));
    suite = await nommer(suite, { nom: 'Après trois gestes', horodatage: heure(6) });
    assert.deepEqual(trace.filter(([, chemin]) => chemin === COURSES), []);
    assert.equal(courseDe(suite, 2).evalues, 100);

    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual(courseDe(rouvert, 3), courseDe(genere, 3));
    assert.deepEqual(courseDe(rouvert, 2), courseDe(genere, 2));
  });

  test("un geste qui garde les mêmes placements n'en hache aucun ; un placement changé sous la même identité se hache, et le compagnon se réécrit sans sa course", async () => {
    const { fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const { apres, courses } = generation(ouvert.charge);
    const genere = await enregistrer(ouvert, apres, geste(2, { courses }));

    const trace = tracer(fs);
    let suite = genere;
    for (const n of [3, 4]) {
      const charge = gesteSur(suite.charge, n);
      const ordinaire = await hachages(() => enregistrer(suite, charge, geste(n)));
      assert.equal(ordinaire.n, 0, `le geste ${n} ne hache aucun placement`);
      suite = ordinaire.rendu;
    }
    assert.deepEqual(trace.filter(([, chemin]) => chemin === COURSES), []);
    assert.equal(courseDe(suite, 2).evalues, 100);

    // La proposition 2 garde son identifiant, sa graine, son arrêt et son
    // historique, sur un autre premier tour.
    const changee = structuredClone(suite.charge);
    changee.propositions[1].placement[0].sieges = [[1, 4], [2, 3]];
    const geste5 = await hachages(() => enregistrer(suite, changee, geste(5)));
    assert.ok(geste5.n > 0, 'le placement changé se hache');
    assert.equal(fs.contenu('documents', COURSES), compagnon([courses[1]]));
    assert.equal(courseDe(geste5.rendu, 2), null);
    assert.equal(courseDe(geste5.rendu, 3).evalues, 1_000);
  });

  test("effacer puis défaire : le compagnon se réécrit sans les courses effacées, l'Ouvert les garde en mémoire, et le retour les réécrit ; après une réouverture, elles ne sont plus connues", async () => {
    const { disque, fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const { apres, courses } = generation(ouvert.charge);
    const genere = await enregistrer(ouvert, apres, geste(2, { courses }));

    const vide = structuredClone(genere.charge);
    vide.propositions = [];
    const efface = await enregistrer(genere, vide, geste(3));
    assert.equal(fs.contenu('documents', COURSES), compagnon([]));
    assert.equal(courseDe(efface, 2), null);

    const restituee = reconstruire(efface.journal, 2);
    const defait = await enregistrer(efface, restituee, geste(4, { sens: 'defaire', retour: 2 }));
    assert.equal(fs.contenu('documents', COURSES), compagnon(courses));
    assert.deepEqual(courseDe(defait, 3), courseDe(genere, 3));

    // Rouvert après l'effacement, l'événement ne connaît plus ces courses :
    // le retour rend les propositions, sans course, et le compagnon reste
    // vide.
    const efface2 = await enregistrer(defait, vide, geste(5));
    const rouvert = await rouvrir(disque, BASE);
    const trace = tracer(rouvert.fs);
    const revient = await enregistrer(rouvert, reconstruire(rouvert.journal, 4), geste(6, { sens: 'revenir', retour: 4 }));
    assert.equal(efface2.charge.propositions.length, 0);
    assert.equal(revient.charge.propositions.length, 3);
    assert.equal(courseDe(revient, 3), null);
    assert.deepEqual(trace.filter(([, chemin]) => chemin === COURSES), []);
    assert.equal(fs.contenu('documents', COURSES), compagnon([]));
  });

  test("un compagnon absent, illisible, hors UTF-8, d'un autre événement ou contradictoire n'empêche ni l'ouverture ni l'écriture : ses courses sont inconnues, et un geste qui garde les mêmes propositions ne le touche pas", async () => {
    const charge = chargeEssai();
    const [p] = charge.propositions;
    const valide = texteDesCourses('evt-lucioles', [entreeDe(p)]);
    const contredite = entreeDe(p);
    contredite.course.evalues = p.arret + 1;
    const cas = [
      ['absent', null],
      ['hors JSON', 'pas du JSON'],
      ["d'un autre événement", texteDesCourses('evt-autre', [entreeDe(p)])],
      ['contradictoire', texteDesCourses('evt-lucioles', [contredite])],
      ['hors UTF-8', malEncode(valide.replace('{"format"', '{"é":0,"format"'))],
    ];
    for (const [libelle, contenu] of cas) {
      const { disque, fs } = disqueAvec([[ETAT, etatTexte(charge)]]);
      if (typeof contenu === 'string') fs.deposer('documents', COURSES, contenu);
      if (contenu instanceof Uint8Array) fs.deposerOctets('documents', COURSES, contenu);
      const avant = contenu === null ? null : [...fs.octets('documents', COURSES)];
      const ouvert = await rouvrir(disque, BASE);
      assert.deepEqual(ouvert.avertissements, [], libelle);
      assert.equal(courseDe(ouvert, 1), null, libelle);
      await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2, { libelleReprise: REPRISE }));
      const apres = contenu === null ? null : [...fs.octets('documents', COURSES)];
      assert.deepEqual(apres, avant, libelle);
    }
    const { disque, fs } = disqueAvec([[ETAT, etatTexte(charge)], [COURSES, valide]]);
    assert.equal(courseDe(await rouvrir(disque, BASE), 1).evalues, 100);
    assert.equal(fs.contenu('documents', COURSES), valide);
  });

  test("une lecture du compagnon que le système refuse n'empêche pas l'ouverture : ses courses sont inconnues ; une erreur qui ne vient pas du stockage remonte telle quelle", async () => {
    const charge = chargeEssai();
    const [p] = charge.propositions;
    const { disque } = disqueAvec([[ETAT, etatTexte(charge)], [COURSES, texteDesCourses('evt-lucioles', [entreeDe(p)])]]);
    // Un lecteur du disque dont la lecture du compagnon rejette l'erreur
    // que rend erreurDe(chemin), les autres fichiers lus comme d'ordinaire.
    const refusant = (erreurDe) => {
      const fs = creerFichiersSimules({ disque });
      const lire = fs.lireTexte;
      fs.lireTexte = (racine, chemin) => (chemin === COURSES ? Promise.reject(erreurDe(chemin)) : lire(racine, chemin));
      return fs;
    };
    assert.equal(courseDe(await rouvrir(disque, BASE), 1).evalues, 100);
    const refuse = await ouvrir(refusant((chemin) => new ErreurStockage('LECTURE', { chemin, dossier: DOCUMENTS, cause: 'EACCES' })), DOC, BASE);
    assert.deepEqual(refuse.avertissements, []);
    assert.equal(courseDe(refuse, 1), null);
    const panne = new TypeError('lecteur en panne');
    await assert.rejects(ouvrir(refusant(() => panne), DOC, BASE), (erreur) => erreur === panne);
  });

  test("un refus d'écrire le compagnon n'empêche pas le geste : journal et état écrits, la course connue de l'Ouvert pour la séance ; le geste qui change ensuite les propositions le réécrit", async () => {
    const { fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const ecrire = fs.ecrireAtomique;
    let refuser = true;
    fs.ecrireAtomique = (racine, chemin, texte) => {
      if (refuser && chemin.endsWith(SUFFIXES.courses)) {
        return Promise.reject(new ErreurStockage('ECRITURE', { chemin, dossier: DOCUMENTS, cause: 'EACCES' }));
      }
      return ecrire(racine, chemin, texte);
    };
    const { apres, courses } = generation(ouvert.charge);
    const genere = await enregistrer(ouvert, apres, geste(2, { courses }));
    assert.equal(genere.revision, 2);
    assert.equal(analyser(fs.contenu('documents', ETAT)).entete.revision, 2);
    assert.equal(fs.contenu('documents', COURSES), null);
    assert.equal(courseDe(genere, 3).evalues, 1_000);
    refuser = false;
    const vide = structuredClone(genere.charge);
    vide.propositions = vide.propositions.filter(({ id }) => id !== 2);
    await enregistrer(genere, vide, geste(3));
    assert.equal(fs.contenu('documents', COURSES), compagnon([courses[1]]));
  });

  test("écrit ailleurs, l'événement porte son compagnon sous sa nouvelle base ; un dossier où seul un compagnon porte une base ne la laisse pas libre", async () => {
    const { fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const { apres, courses } = generation(ouvert.charge);
    const genere = await enregistrer(ouvert, apres, geste(2, { courses }));
    const ailleurs = await enregistrerAilleurs(genere, DOC, { existantes: [] });
    assert.notEqual(ailleurs.base, BASE);
    assert.equal(fs.contenu('documents', `${ailleurs.base}${SUFFIXES.courses}`), compagnon(courses));
    assert.deepEqual(courseDe(ailleurs, 2), courseDe(genere, 2));

    const seul = nouveauDisque();
    seul.fs.deposer('documents', COURSES, compagnon(courses));
    assert.deepEqual(await basesPrises(seul.fs, DOC), [BASE]);
  });
});

describe('dépôt : format plus récent, élagage', () => {
  test("un fichier d'un format plus récent s'ouvre en lecture seule : enregistrer, nommer et enregistrerAilleurs refusent LECTURE_SEULE sans rien écrire", async () => {
    const texte = etatTexte(chargeEssai()).replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`);
    const { disque } = disqueAvec([[ETAT, texte]]);
    const ouvert = await rouvrir(disque, BASE);
    assert.equal(ouvert.formatPlusRecent, true);
    assert.deepEqual(ouvert.avertissements, []);
    const refus = { raison: 'FORMAT_PLUS_RECENT' };
    const enregistrement = await echec(enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2)), 'LECTURE_SEULE');
    assert.deepEqual(enregistrement.details, refus);
    const nom = await echec(nommer(ouvert, { nom: 'Jalon', horodatage: heure(2) }), 'LECTURE_SEULE');
    assert.deepEqual(nom.details, refus);
    const ailleurs = await echec(enregistrerAilleurs(ouvert, DOC, { existantes: [] }), 'LECTURE_SEULE');
    assert.deepEqual(ailleurs.details, refus);
    assert.equal(ouvert.fs.compteurs.ecritures, 0);
  });

  test("ce qu'une construction plus récente laisse garde en lecture seule chaque ouverture, secours compris : un état ou un journal d'un format plus récent ne se réécrit jamais ; le journal de la base se reconnaît plus récent avant toute copie du dossier, et un journal plus récent ne se dit jamais absent", async () => {
    const { fichiers } = await troisRevisions();
    const recent = (texte) => texte.replace(`"format":${FORMAT}`, `"format":${FORMAT + 1}`);
    // L'état d'un format plus récent, d'une forme que ce code ne connaît pas :
    // illisible, FORMAT_PLUS_RECENT. Le .precedent reste l'état au format
    // courant qu'il remplace.
    const etatForme = recent(texteDe(fichiers, ETAT)).replace('"sieges":null', '"sieges":{"n":3}');
    const journalRecent = recent(texteDe(fichiers, JOURNAL));
    const plusRecent = { code: 'JOURNAL_FORMAT_PLUS_RECENT', details: { format: FORMAT + 1 } };
    const enAvance = { code: 'JOURNAL_EN_AVANCE_DE', details: { n: 1 } };
    const illisible = (journal, format = FORMAT + 1) => ({
      code: 'ETAT_ILLISIBLE',
      details: {
        base: BASE,
        raison: 'FORMAT_PLUS_RECENT',
        chemin: 'charge.tables[0].sieges',
        format,
        secours: { precedent: 2, journal },
      },
    });
    // Le secours d'un journal plus récent est refusé : il n'est pas absent.
    const journalPlusRecent = {
      code: 'ETAT_ILLISIBLE',
      details: { raison: 'FORMAT_PLUS_RECENT', chemin: JOURNAL, format: FORMAT + 1 },
    };
    // L'état manque à côté d'un journal plus récent : son refus ne nomme
    // aucun format, celui du journal s'y ajoute.
    const sansEtat = (precedent) => ({
      code: 'ETAT_ILLISIBLE',
      details: { base: BASE, raison: 'ABSENT', chemin: null, format: FORMAT + 1, secours: { precedent, journal: null } },
    });
    const sansPrecedent = { code: 'ABSENT', details: { chemin: PRECEDENT } };
    const copieALaMain = `${BASE} - Copie${SUFFIXES.journal}`;
    // Par cas : l'état et le journal posés (null : celui des trois révisions),
    // puis ce que rendent ouvrir, ouvrirSecours('precedent') et
    // ouvrirSecours('journal') — les avertissements d'un Ouvert, ou l'erreur
    // —, et ce que la main change ensuite aux fichiers posés.
    const cas = [
      ['état et journal plus récents', etatForme, journalRecent, [illisible(null), [plusRecent], journalPlusRecent]],
      ['état plus récent, journal resté au format courant', etatForme, null, [illisible(3), [enAvance], []]],
      // Le refus de l'état nomme son propre format, que celui du journal ne
      // remplace pas.
      [
        'état deux formats plus loin, journal un format plus loin',
        etatForme.replace(`"format":${FORMAT + 1}`, `"format":${FORMAT + 2}`),
        journalRecent,
        [illisible(null, FORMAT + 2), [plusRecent], journalPlusRecent],
      ],
      ['état plus récent lisible', recent(texteDe(fichiers, ETAT)), null, [[], [enAvance], []]],
      ['journal seul plus récent', null, journalRecent, [[plusRecent], [plusRecent], journalPlusRecent]],
      [
        "journal seul plus récent, marque d'ordre d'octets en tête",
        null,
        `\u{FEFF}${journalRecent}`,
        [[plusRecent], [plusRecent], journalPlusRecent],
      ],
      [
        'journal plus récent, sa copie à la main au format courant sous une autre base',
        null,
        journalRecent,
        [[plusRecent], [plusRecent], journalPlusRecent],
        (poses) => [...poses, [copieALaMain, texteDe(fichiers, JOURNAL)]],
      ],
      [
        'journal plus récent sans état',
        null,
        journalRecent,
        [sansEtat(2), [plusRecent], journalPlusRecent],
        (poses) => remplacer(poses, ETAT, null),
      ],
      [
        'journal plus récent sans état ni .precedent',
        null,
        journalRecent,
        [sansEtat(null), sansPrecedent, journalPlusRecent],
        (poses) => remplacer(remplacer(poses, ETAT, null), PRECEDENT, null),
      ],
    ];
    let enLectureSeule = 0;
    for (const [nom, etat, journal, attendus, retoucher = (poses) => poses] of cas) {
      const avecEtat = remplacer(fichiers, ETAT, etat ?? texteDe(fichiers, ETAT));
      const restants = retoucher(remplacer(avecEtat, JOURNAL, journal ?? texteDe(fichiers, JOURNAL)));
      const { disque, fs } = disqueAvec(restants);
      const avant = await fichiersDe(disque);
      const ouvertures = [
        ['ouvrir', () => ouvrir(fs, DOC, BASE)],
        ['secours precedent', () => ouvrirSecours(fs, DOC, BASE, 'precedent')],
        ['secours journal', () => ouvrirSecours(fs, DOC, BASE, 'journal')],
      ];
      for (const [rang, [ouverture, ouvrirAinsi]] of ouvertures.entries()) {
        const message = `${nom}, ${ouverture}`;
        const attendu = attendus[rang];
        if (!Array.isArray(attendu)) {
          const erreur = await echec(ouvrirAinsi(), attendu.code);
          assert.deepEqual(erreur.details, attendu.details, message);
          continue;
        }
        const ouvert = await ouvrirAinsi();
        assert.equal(ouvert.formatPlusRecent, true, message);
        assert.deepEqual(ouvert.avertissements, attendu, message);
        const ecritures = [
          () => enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE })),
          () => nommer(ouvert, { nom: 'Jalon', horodatage: heure(4), libelleReprise: REPRISE }),
          () => enregistrerAilleurs(ouvert, DOC, { existantes: [] }),
        ];
        for (const ecrire of ecritures) {
          assert.deepEqual((await echec(ecrire(), 'LECTURE_SEULE')).details, { raison: 'FORMAT_PLUS_RECENT' }, message);
        }
        enLectureSeule += 1;
      }
      // La liste nomme le journal qu'ouvrir lit : celui de la base, qu'il soit
      // plus récent ou non, jamais sa copie au format courant.
      const ligne = (await lister(fs, DOC)).find(({ base }) => base === BASE);
      assert.equal(ligne.journal, BASE, `${nom}, lister`);
      assert.equal(fs.compteurs.ecritures, 0, nom);
      assert.deepEqual(await fichiersDe(disque), avant, nom);
    }
    assert.equal(enLectureSeule, 14);
  });

  test("une ouverture de journal dont le format n'est pas un entier ≥ 1 ne se lit pas : écartée, puis remplacée au premier geste", async () => {
    const { fichiers } = await troisRevisions();
    const journal = texteDe(fichiers, JOURNAL);
    const ouverture = journal.slice(0, journal.indexOf('\n'));
    const fausses = [
      ouverture.replace(`"format":${FORMAT}`, `"format":"${FORMAT + 1}"`),
      ouverture.replace(`"format":${FORMAT}`, '"format":0'),
      ouverture.replace(`"format":${FORMAT}`, '"format":-1'),
      ouverture.replace(`"format":${FORMAT}`, '"format":1.5'),
      ouverture.replace(`"format":${FORMAT}`, '"format":null'),
      ouverture.replace(/\}$/, ',"inconnue":1}'),
    ];
    for (const fausse of fausses) {
      const copie = disqueAvec(remplacer(fichiers, JOURNAL, journal.replace(ouverture, fausse)));
      const ouvert = await rouvrir(copie.disque, BASE);
      assert.equal(ouvert.formatPlusRecent, false, fausse);
      assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_ECARTEES', details: { n: 5 } }], fausse);
      await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
      assert.deepEqual(
        revisionsEtLibelles(exigerEquivalence(ouvert.fs, BASE)),
        [
          [3, REPRISE],
          [4, 'Geste 4'],
        ],
        fausse,
      );
    }
  });

  test("au-delà de PLAFOND_ENTREES, le journal s'élague sur une frontière d'instantané qui garde au moins 500 entrées, au geste qui le dépasse comme à l'écriture ailleurs ; relu, il est la version élaguée, et le journal en mémoire récrit le fichier", async () => {
    const { disque, fs } = nouveauDisque();
    const trace = tracer(fs);
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    assert.equal(fs.contenu('documents', JOURNAL), texteDuJournal(ouvert.journal));
    // Un jalon d'une entrée que l'élagage retire, deux d'une entrée qu'il garde.
    const jalonsDe = { 50: ['Retiré'], 550: ['Gardé', 'Gardé aussi'] };
    for (let n = 2; n <= PLAFOND_ENTREES; n += 1) {
      ouvert = await enregistrer(ouvert, modifier(ouvert.charge, n), geste(n));
      for (const nom of jalonsDe[n] ?? []) ouvert = await nommer(ouvert, { nom, horodatage: heure(n) });
    }
    const avant = fs.contenu('documents', JOURNAL);
    assert.equal(lireJournal(avant).entrees.length, PLAFOND_ENTREES);
    // Jusqu'au plafond compris, chaque geste s'ajoute en fin de journal.
    const ecrituresDuJournal = trace.filter(([, chemin]) => chemin === JOURNAL).map(([primitive]) => primitive);
    assert.deepEqual(new Set(ecrituresDuJournal.slice(1)), new Set(['ajouterLigne']));

    // Le secours .precedent écrit ailleurs : son journal de PLAFOND_ENTREES
    // entrées reçoit la reprise, et s'élague comme au geste qui le dépasse.
    const lecteur = creerFichiersSimules({ disque });
    const secours = await ouvrirSecours(lecteur, DOC, BASE, 'precedent');
    assert.equal(lecteur.compteurs.ecritures, 0, 'ouvrirSecours écrit');
    const options = { existantes: [], libelleReprise: REPRISE, horodatage: heure(601) };
    const copie = await enregistrerAilleurs(secours, DOC, options);
    const copieRelue = exigerEquivalence(lecteur, copie.base);
    assert.deepEqual(
      [copie.base, copieRelue.entrees[0].revision, copieRelue.entrees.length, copieRelue.entrees.at(-1).libelle],
      [`${BASE} (2)`, 101, 501, REPRISE],
    );
    assert.deepEqual(copie.journal, copieRelue);

    const depart = trace.length;
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 601), geste(601));
    assert.deepEqual(trace.slice(depart), [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    const apres = fs.contenu('documents', JOURNAL);
    const derniere = apres.slice(apres.lastIndexOf('\n', apres.length - 2) + 1);
    assert.equal(apres, elaguer(avant + derniere));
    assert.equal(apres, texteDuJournal(ouvert.journal));
    const relu = exigerEquivalence(fs, BASE);
    assert.equal(relu.entrees[0].revision, 101);
    assert.equal(relu.entrees.length, 501);
    assert.deepEqual(
      relu.jalons.map(({ revision, nom }) => [revision, nom]),
      [
        [550, 'Gardé'],
        [550, 'Gardé aussi'],
      ],
    );
    assert.deepEqual(ouvert.journal, relu);
    assert.equal(JSON.stringify(ouvert.journal), JSON.stringify(relu));

    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 602), geste(602));
    assert.deepEqual(trace.at(-3), ['ajouterLigne', JOURNAL]);
    exigerEquivalence(fs, BASE);
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual([rouvert.revision, rouvert.avertissements, rouvert.journal.entrees.length], [602, [], 502]);
  });
});

describe('dépôt : le verrou, et écrire ailleurs (§ 8.6, § 8.8)', () => {
  test("le verrou de la séance se prend à l'instant qu'elle donne, se refuse à une autre séance avec ce que le système en dit, et se rend", async () => {
    const { disque, fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    const depuis = '2031-05-17T08:30:00-04:00';
    assert.deepEqual(await verrouiller(ouvert, 'seance-a', depuis), { pris: true });
    const texte = fs.contenu('documents', VERROU);
    assert.equal(JSON.parse(texte).depuis, depuis);

    const voisin = await rouvrir(disque, BASE);
    const plusTard = '2031-05-17T08:31:00-04:00';
    assert.deepEqual(await verrouiller(voisin, 'seance-b', plusTard), { pris: false, seance: 'seance-a', depuis, vivant: true });
    const lointain = await ouvrir(creerFichiersSimules({ disque, hote: 'autre-poste' }), DOC, BASE);
    assert.equal(lointain.fs.compteurs.ecritures, 0, 'ouvrir écrit');
    assert.deepEqual(await verrouiller(lointain, 'seance-c', plusTard), {
      pris: false,
      seance: 'seance-a',
      depuis,
      vivant: null,
    });

    await deverrouiller(voisin, 'seance-b');
    assert.equal(fs.contenu('documents', VERROU), texte);
    await deverrouiller(ouvert, 'seance-a');
    assert.equal(fs.contenu('documents', VERROU), null);

    assert.deepEqual(await verrouiller(voisin, 'seance-b', plusTard), { pris: true });
    voisin.fs.pannes.couperApres(0);
    const vuDApres = await verrouiller(ouvert, 'seance-a', plusTard);
    assert.deepEqual([vuDApres.pris, vuDApres.seance, vuDApres.vivant], [false, 'seance-b', false]);
  });

  test("après un refus d'écriture, enregistrerAilleurs crée la racine visée, puis y écrit le journal entier et l'état ; une base déjà prise là-bas se dérive ; le geste reprend là", async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque, executable: 'E:\\soirees' });
    fs.deposerDossier('portable');
    const { portable, documents } = await fs.racines();
    let ouvert = await creer(fs, portable, chargeEssai(), CREATION);
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2));
    fs.pannes.ecriture('portable');
    const erreur = await echec(enregistrer(ouvert, modifier(ouvert.charge, 3), geste(3)), 'ECRITURE');
    assert.deepEqual(erreur.details, { chemin: JOURNAL, dossier: 'E:\\soirees\\data', cause: 'EROFS' });

    // En mode portable, rien n'a sondé ni créé documents : l'opérateur l'a
    // choisi, l'écriture le crée.
    const ecritures = fs.compteurs.ecritures;
    const trace = tracer(fs);
    const ailleurs = await enregistrerAilleurs(ouvert, documents, { existantes: [] });
    assert.deepEqual(trace, [
      ['creerDossier', ''],
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', ETAT],
    ]);
    assert.equal(fs.compteurs.ecritures - ecritures, 3);
    assert.deepEqual([ailleurs.racine, ailleurs.base, ailleurs.revision], [documents, BASE, 2]);
    assert.equal(fs.contenu('documents', JOURNAL), fs.contenu('portable', JOURNAL));
    assert.equal(fs.contenu('documents', PRECEDENT), null);
    exigerEquivalence(fs, BASE);

    // Écrit de nouveau là-bas, l'événement y trouve sa base prise, absente
    // des bases reçues : la dérivation la voit dans le dossier.
    trace.length = 0;
    const libre = 'Soirée des Lucioles (2)';
    const seconde = await enregistrerAilleurs(ouvert, documents, { existantes: [] });
    assert.deepEqual(trace, [
      ['creerDossier', ''],
      ['ecrireAtomique', `${libre}${SUFFIXES.journal}`],
      ['ecrireAtomique', `${libre}${SUFFIXES.etat}`],
    ]);
    assert.equal(seconde.base, libre);
    exigerEquivalence(fs, libre);

    const suite = await enregistrer(ailleurs, modifier(ailleurs.charge, 3), geste(3));
    assert.equal(suite.revision, 3);
    exigerEquivalence(fs, BASE);
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual([rouvert.revision, rouvert.avertissements], [3, []]);
  });

  test("ETAT_NON_ECRIT : l'Ouvert avancé de ses détails s'écrit ailleurs, son geste compris, sous une base libre parmi celles reçues", async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque, executable: 'E:\\soirees' });
    fs.deposerDossier('portable');
    fs.deposerDossier('documents');
    const { portable, documents } = await fs.racines();
    const cree = await creer(fs, portable, chargeEssai(), CREATION);
    refuserRenommageApresPrecedent(fs);
    const apres = modifier(cree.charge, 2);
    const erreur = await echec(enregistrer(cree, apres, geste(2)), 'ETAT_NON_ECRIT');

    const ailleurs = await enregistrerAilleurs(erreur.details.ouvert, documents, { existantes: [BASE] });
    assert.deepEqual([ailleurs.base, ailleurs.revision], ['Soirée des Lucioles (2)', 2]);
    // creer : journal, état ; le geste : ligne, .precedent, état refusé ;
    // ailleurs : la racine, qui existe déjà, le journal, l'état.
    assert.equal(fs.compteurs.ecritures, 2 + 3 + 3);
    exigerEquivalence(fs, ailleurs.base);
    assert.equal(texteDeCharge(analyser(fs.contenu('documents', `${ailleurs.base}${SUFFIXES.etat}`)).charge), texteDeCharge(apres));
  });

  // Un événement du disque portable : créé, puis deux gestes, les notes 2 et
  // 3 ; son état remplacé par etat quand il est donné. Le secours .precedent
  // l'ouvre, sans rien écrire, à la note 2 et à la révision 2 ; puis portable
  // refuse toute écriture, et le premier geste lève ECRITURE. Rend le disque,
  // son processus, la racine documents et l'Ouvert du secours, à écrire
  // ailleurs.
  async function secoursRefuse(etat) {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque, executable: 'E:\\soirees' });
    fs.deposerDossier('portable');
    const { portable, documents } = await fs.racines();
    let ouvert = await creer(fs, portable, chargeEssai(), CREATION);
    for (const n of [2, 3]) ouvert = await enregistrer(ouvert, modifier(ouvert.charge, n), geste(n));
    if (etat !== null) fs.deposer('portable', ETAT, etat);
    const ecritures = fs.compteurs.ecritures;
    const secours = await ouvrirSecours(fs, portable, BASE, 'precedent');
    assert.equal(fs.compteurs.ecritures, ecritures, 'ouvrirSecours écrit');
    assert.deepEqual([secours.revision, secours.charge.participants[0].notes], [2, 'note 2']);
    fs.pannes.ecriture('portable');
    await echec(enregistrer(secours, modifier(secours.charge, 4), geste(4, { libelleReprise: REPRISE })), 'ECRITURE');
    return { disque, fs, documents, secours };
  }

  // L'état que le secours laisse sur le disque de départ : lisible, à la
  // révision 3, ou illisible.
  const etatsDuSecours = [
    ['état lisible', null],
    ['état illisible', '{"entete":'],
  ];

  test("un secours .precedent s'écrit ailleurs en paire alignée — son journal, une entrée de reprise qui restitue sa charge, puis l'état à la révision de la reprise — : rouvert là-bas, il rend la charge du secours sans rien rattraper", async () => {
    for (const [nom, etat] of etatsDuSecours) {
      const { disque, fs, documents, secours } = await secoursRefuse(etat);
      const trace = tracer(fs);
      const options = { existantes: [], libelleReprise: REPRISE, horodatage: heure(4) };
      const ailleurs = await enregistrerAilleurs(secours, documents, options);
      assert.deepEqual(
        trace,
        [
          ['creerDossier', ''],
          ['ecrireAtomique', JOURNAL],
          ['ecrireAtomique', ETAT],
        ],
        nom,
      );
      const rouvert = await rouvrir(disque, BASE);
      assert.deepEqual(
        [rouvert.revision, rouvert.avertissements, rouvert.charge.participants[0].notes],
        [4, [], 'note 2'],
        nom,
      );
      assert.equal(texteDeCharge(rouvert.charge), texteDeCharge(secours.charge), nom);
      const journal = exigerEquivalence(fs, BASE);
      assert.deepEqual(
        revisionsEtLibelles(journal),
        [
          [1, CREATION.libelle],
          [2, 'Geste 2'],
          [3, 'Geste 3'],
          [4, REPRISE],
        ],
        nom,
      );
      assert.deepEqual([ailleurs.revision, ailleurs.journal, ailleurs.avertissements], [4, journal, []], nom);
      // Un geste depuis l'Ouvert rendu, qui remet la note 3 : son correctif
      // part de la charge écrite là-bas, que porte chargeJournal. Parti de la
      // note 3, il ne changerait rien, et sa dernière entrée ne restituerait
      // pas l'état écrit.
      await enregistrer(ailleurs, modifier(ailleurs.charge, 3), geste(5));
      assert.deepEqual(
        revisionsEtLibelles(exigerEquivalence(fs, BASE)).slice(-2),
        [
          [4, REPRISE],
          [5, 'Geste 5'],
        ],
        nom,
      );
    }
  });

  test('écrit ailleurs sans libellé de reprise, un secours .precedent lève TypeError avant toute écriture : la racine ne se crée pas', async () => {
    for (const [nom, etat] of etatsDuSecours) {
      const { fs, documents, secours } = await secoursRefuse(etat);
      const trace = tracer(fs);
      const sansLibelle = { existantes: [], horodatage: heure(4) };
      await assert.rejects(enregistrerAilleurs(secours, documents, sansLibelle), TypeError, nom);
      assert.deepEqual(trace, [], nom);
    }
  });

  test("un Ouvert aligné s'écrit ailleurs avec la charge que restitue la dernière entrée de son journal, proposition fautive comprise, sous la version qui l'a produite ; l'Ouvert rendu porte la charge examinée", async () => {
    const fautives = [{ code: 'PROPOSITIONS_FAUTIVES', details: { ids: [2] } }];
    // Par cas : la version que la main pose dans l'en-tête de l'état créé, à
    // la révision du journal, ou null. Retouché, l'en-tête nomme une autre
    // construction que l'entrée qui a produit la charge : l'état écrit
    // ailleurs prend celle du journal.
    const cas = [
      ["l'Ouvert de creer", null],
      ['un en-tête retouché à la main', V2],
    ];
    for (const [nom, version] of cas) {
      const disque = new Map();
      const fs = creerFichiersSimules({ disque, executable: 'E:\\soirees' });
      fs.deposerDossier('portable');
      const { portable, documents } = await fs.racines();
      let ouvert = await creer(fs, portable, avecFautive(), CREATION);
      if (version !== null) {
        fs.deposer('portable', ETAT, etatTexte(avecFautive(), 1, version));
        const ecritures = fs.compteurs.ecritures;
        ouvert = await ouvrir(fs, portable, BASE);
        assert.equal(fs.compteurs.ecritures, ecritures, `${nom} : ouvrir écrit`);
        assert.deepEqual([ouvert.revision, ouvert.produitVersion, ouvert.avertissements], [1, version, fautives], nom);
      }
      assert.notEqual(texteDeCharge(ouvert.charge), texteDeCharge(ouvert.chargeJournal), nom);
      const ailleurs = await enregistrerAilleurs(ouvert, documents, { existantes: [] });
      const ecrit = analyser(fs.contenu('documents', ETAT));
      assert.deepEqual([ecrit.entete.revision, ecrit.entete.produitVersion], [1, V1], nom);
      assert.equal(texteDeCharge(ecrit.charge), texteDeCharge(avecFautive()), nom);
      exigerEquivalence(fs, BASE);
      assert.equal(texteDeCharge(ailleurs.chargeJournal), texteDeCharge(avecFautive()), nom);
      assert.deepEqual(
        [ailleurs.produitVersion, ailleurs.charge.propositions.map(({ id }) => id), ailleurs.avertissements],
        [V1, [1], fautives],
        nom,
      );
      assert.deepEqual((await rouvrir(disque, BASE)).avertissements, fautives, nom);
    }
  });

  test("un événement sans journal s'écrit ailleurs par son seul état ; là où l'écriture est refusée, un journal lève ECRITURE, un état seul ETAT_NON_ECRIT, et une racine qui ne se crée pas ECRITURE, sans rien écrire", async () => {
    const disque = new Map();
    const fs = creerFichiersSimules({ disque, executable: 'E:\\soirees' });
    fs.deposerDossier('documents');
    fs.deposer('portable', ETAT, etatTexte(chargeEssai(), 4));
    const { portable, documents } = await fs.racines();
    const sansJournal = await ouvrir(fs, portable, BASE);
    assert.equal(fs.compteurs.ecritures, 0, 'ouvrir écrit');
    const trace = tracer(fs);
    const ailleurs = await enregistrerAilleurs(sansJournal, documents, { existantes: [] });
    assert.deepEqual(trace, [
      ['creerDossier', ''],
      ['ecrireAtomique', ETAT],
    ]);
    assert.deepEqual(
      [ailleurs.journal, ailleurs.revision, ailleurs.texteEtat],
      [null, 4, fs.contenu('documents', ETAT)],
    );

    // Les renommages de documents refusés : chaque écriture atomique échoue,
    // le dossier existant passe.
    const avecJournal = await creer(fs, portable, chargeEssai({ id: 'evt-gala', nom: "Gala d'automne" }), CREATION);
    fs.pannes.renommage('documents');
    const refusJournal = await echec(enregistrerAilleurs(avecJournal, documents, { existantes: [] }), 'ECRITURE');
    assert.deepEqual(refusJournal.details, {
      chemin: "Gala d'automne.gtt-journal.jsonl",
      dossier: DOCUMENTS,
      cause: 'EBUSY',
    });
    assert.equal(fs.contenu('documents', "Gala d'automne.gtt.json"), null);

    const refusEtat = await echec(enregistrerAilleurs(sansJournal, documents, { existantes: [] }), 'ETAT_NON_ECRIT');
    const { ouvert: refuse, ...details } = refusEtat.details;
    assert.deepEqual(details, { chemin: 'Soirée des Lucioles (2).gtt.json', dossier: DOCUMENTS, cause: 'EBUSY' });
    assert.deepEqual([refuse.base, refuse.texteEtat, refuse.revision], ['Soirée des Lucioles (2)', null, 4]);

    // Sur un disque où documents n'a jamais été créé, et qui en refuse toute
    // écriture : creerDossier, seule primitive appelée, lève ECRITURE sur la
    // racine elle-même ; documents n'existe toujours pas, et rien ne s'écrit.
    const neuf = new Map();
    const sansDocuments = creerFichiersSimules({ disque: neuf, executable: 'E:\\soirees' });
    sansDocuments.deposer('portable', ETAT, etatTexte(chargeEssai(), 4));
    const seul = await ouvrir(sansDocuments, portable, BASE);
    assert.equal(sansDocuments.compteurs.ecritures, 0, 'ouvrir écrit');
    sansDocuments.pannes.ecriture('documents');
    const traceRacine = tracer(sansDocuments);
    const refusRacine = await echec(enregistrerAilleurs(seul, documents, { existantes: [] }), 'ECRITURE');
    assert.deepEqual(refusRacine.details, { chemin: '', dossier: DOCUMENTS, cause: 'EROFS' });
    assert.deepEqual(traceRacine, [['creerDossier', '']]);
    await echec(creerFichiersSimules({ disque: neuf }).lister(DOC, ''), 'ABSENT');
    assert.equal(sansDocuments.contenu('portable', ETAT), etatTexte(chargeEssai(), 4));
  });

  test("enregistrerAilleurs avec un geste, sans créer la racine : sous la base que dérive le nom du geste, l'état d'avant le geste au .precedent — le texte sur le disque, sinon la charge ouverte —, puis le journal recopié — reprise comprise quand il le faut — suivi de l'entrée du geste, puis l'état du geste ; la paire de l'Ouvert ne s'écrit pas et ne s'apparie pas le journal neuf, et une racine absente ne se crée pas", async () => {
    const { disque, fs } = nouveauDisque();
    let ouvert = await creer(fs, DOC, chargeEssai(), CREATION);
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 2), geste(2));
    const avant = await fichiersDe(disque);
    const nouvelle = 'Gala des Saules';
    const renommee = (charge) => ({ ...charge, evenement: { ...charge.evenement, nom: nouvelle } });
    const options = {
      existantes: [],
      horodatage: heure(3),
      geste: { apres: renommee(ouvert.charge), libelle: 'Renommé', produitVersion: V2 },
      creerRacine: false,
    };
    const ecritsSous = (base) => [
      ['ecrireAtomique', `${base}${SUFFIXES.precedent}`],
      ['ecrireAtomique', `${base}${SUFFIXES.journal}`],
      ['ecrireAtomique', `${base}${SUFFIXES.etat}`],
    ];
    const trace = tracer(fs);
    const ailleurs = await enregistrerAilleurs(ouvert, DOC, options);
    assert.deepEqual(trace, ecritsSous(nouvelle));
    assert.equal(fs.contenu('documents', `${nouvelle}${SUFFIXES.precedent}`), texteDe(avant, ETAT));
    assert.deepEqual(
      (await fichiersDe(disque)).filter(([nom]) => !nom.startsWith(nouvelle)),
      avant,
    );
    assert.deepEqual(
      [ailleurs.racine, ailleurs.base, ailleurs.baseJournal, ailleurs.revision, ailleurs.produitVersion],
      [DOC, nouvelle, nouvelle, 3, V2],
    );
    assert.equal(texteDeCharge(ailleurs.charge), texteDeCharge(renommee(modifier(chargeEssai(), 2))));
    const journal = exigerEquivalence(fs, nouvelle);
    assert.deepEqual(revisionsEtLibelles(journal), [
      [1, CREATION.libelle],
      [2, 'Geste 2'],
      [3, 'Renommé'],
    ]);
    assert.deepEqual(
      journal.entrees.map(({ produitVersion }) => produitVersion),
      [V1, null, V2],
    );
    assert.equal(analyser(fs.contenu('documents', `${nouvelle}${SUFFIXES.etat}`)).entete.produitVersion, V2);
    const rouvert = await rouvrir(disque, nouvelle);
    assert.deepEqual([rouvert.revision, rouvert.charge.evenement.nom, rouvert.avertissements], [3, nouvelle, []]);
    const suite = await enregistrer(ailleurs, modifier(ailleurs.charge, 4), geste(4, { produitVersion: V2 }));
    assert.deepEqual([suite.base, suite.revision], [nouvelle, 4]);
    exigerEquivalence(fs, nouvelle);

    // Un état sans journal, à la mise en page d'un autre outil : l'entrée de
    // reprise, au libellé reçu, précède celle du geste ; sans ce libellé,
    // TypeError avant toute écriture. Le .precedent neuf porte ses octets.
    const enQuatre = JSON.stringify(JSON.parse(etatTexte(chargeEssai(), 4)), null, 4);
    const importe = `${enQuatre.replaceAll('\n', '\r\n')}\r\n`;
    const seul = disqueAvec([[ETAT, importe]]);
    const sansJournal = await rouvrir(seul.disque, BASE);
    const gesteSeul = { ...options, geste: { ...options.geste, apres: renommee(sansJournal.charge), produitVersion: V1 } };
    await assert.rejects(enregistrerAilleurs(sansJournal, DOC, gesteSeul), TypeError);
    assert.equal(sansJournal.fs.compteurs.ecritures, 0);
    const repris = await enregistrerAilleurs(sansJournal, DOC, { ...gesteSeul, libelleReprise: REPRISE });
    assert.deepEqual([repris.base, repris.revision], [nouvelle, 5]);
    assert.deepEqual(revisionsEtLibelles(exigerEquivalence(sansJournal.fs, nouvelle)), [
      [4, REPRISE],
      [5, 'Renommé'],
    ]);
    assert.equal(sansJournal.fs.contenu('documents', ETAT), importe);
    assert.equal(sansJournal.fs.contenu('documents', `${nouvelle}${SUFFIXES.precedent}`), importe);

    // Coupée juste après le journal neuf, l'écriture laisse la nouvelle base
    // à l'événement par son .precedent : l'état de l'Ouvert, qu'aucun journal
    // de sa base ne suit, ne se l'apparie pas, et s'ouvre tel qu'il était ;
    // la liste ne montre que lui.
    const coupe = disqueAvec([[ETAT, etatTexte(chargeEssai(), 4)]]);
    const avantCoupure = await rouvrir(coupe.disque, BASE);
    const ecrire = avantCoupure.fs.ecrireAtomique;
    avantCoupure.fs.ecrireAtomique = async (racine, chemin, texte) => {
      await ecrire(racine, chemin, texte);
      if (chemin === `${nouvelle}${SUFFIXES.journal}`) avantCoupure.fs.pannes.couperApres(0);
    };
    await assert.rejects(
      enregistrerAilleurs(avantCoupure, DOC, { ...gesteSeul, libelleReprise: REPRISE }),
      PanneSimulee,
    );
    const apresCoupure = await rouvrir(coupe.disque, BASE);
    assert.deepEqual(
      [apresCoupure.revision, apresCoupure.charge.evenement.nom, apresCoupure.journal, apresCoupure.avertissements],
      [4, BASE, null, []],
    );
    assert.deepEqual(
      (await lister(creerFichiersSimules({ disque: coupe.disque }), DOC)).map(({ base, journal }) => [base, journal]),
      [[BASE, null]],
    );

    // Un Ouvert de secours, l'état sur le disque illisible : le .precedent
    // de la nouvelle base reçoit la charge ouverte, à sa révision.
    const secours = disqueAvec([
      [ETAT, '{'],
      [PRECEDENT, etatTexte(chargeEssai(), 4)],
    ]);
    const depuisPrecedent = await ouvrirSecours(secours.fs, DOC, BASE, 'precedent');
    assert.equal(depuisPrecedent.texteEtat, null);
    const traceSecours = tracer(secours.fs);
    const gesteSecours = { ...gesteSeul.geste, apres: renommee(depuisPrecedent.charge) };
    const renommeSecours = await enregistrerAilleurs(depuisPrecedent, DOC, {
      ...gesteSeul,
      geste: gesteSecours,
      libelleReprise: REPRISE,
    });
    assert.deepEqual(traceSecours, ecritsSous(nouvelle));
    assert.equal(secours.fs.contenu('documents', `${nouvelle}${SUFFIXES.precedent}`), etatTexte(chargeEssai(), 4));
    assert.deepEqual([renommeSecours.base, renommeSecours.revision], [nouvelle, 5]);
    assert.deepEqual(
      [ETAT, PRECEDENT].map((nom) => secours.fs.contenu('documents', nom)),
      ['{', etatTexte(chargeEssai(), 4)],
    );

    // Sur un disque où documents n'existe pas : creerRacine faux ne le crée
    // pas, et sa liste lève ABSENT avant toute écriture.
    const neuf = new Map();
    const sansDocuments = creerFichiersSimules({ disque: neuf, executable: 'E:\\soirees' });
    sansDocuments.deposer('portable', ETAT, etatTexte(chargeEssai(), 4));
    const { portable, documents } = await sansDocuments.racines();
    const portableSeul = await ouvrir(sansDocuments, portable, BASE);
    const traceRacine = tracer(sansDocuments);
    const absente = await echec(
      enregistrerAilleurs(portableSeul, documents, { existantes: [], creerRacine: false }),
      'ABSENT',
    );
    assert.deepEqual(absente.details, { chemin: '' });
    assert.deepEqual(traceRacine, []);
    await echec(creerFichiersSimules({ disque: neuf }).lister(DOC, ''), 'ABSENT');
  });

  test("basesPrises rend, sans rien écrire, la base de chaque fichier d'événement du dossier — état, .precedent, journal, verrou —, dans l'ordre de sa liste ; ABSENT quand la racine manque", async () => {
    const { fs } = disqueAvec([
      [ETAT, '{'],
      [PRECEDENT, '{'],
      ['Archives des Lucioles.gtt-journal.jsonl', '{'],
      ['GALA DES SAULES.gtt.verrou', '{}\n'],
      ['notes.txt', 'à garder'],
      ['reglages_locaux.json', '{}\n'],
    ]);
    fs.deposerDossier('documents', 'corbeille');
    assert.deepEqual(await basesPrises(fs, DOC), ['Archives des Lucioles', 'GALA DES SAULES', BASE, BASE]);
    assert.equal(fs.compteurs.ecritures, 0);
    await echec(basesPrises(creerFichiersSimules({ disque: new Map() }), DOC), 'ABSENT');
  });

  test("une lecture qui échoue autrement que sur un fichier absent ou mal encodé remonte telle quelle : un chemin refusé lève CHEMIN_REFUSE, une lecture refusée LECTURE", async () => {
    const { fs } = nouveauDisque();
    await echec(ouvrir(fs, DOC, '../ailleurs'), 'CHEMIN_REFUSE');
    await creer(fs, DOC, chargeEssai(), CREATION);
    const ecritures = fs.compteurs.ecritures;
    fs.lireTexte = async (racine, chemin) => {
      throw new ErreurStockage('LECTURE', { chemin, dossier: DOCUMENTS, cause: 'EACCES' });
    };
    assert.deepEqual((await echec(ouvrir(fs, DOC, BASE), 'LECTURE')).details, {
      chemin: ETAT,
      dossier: DOCUMENTS,
      cause: 'EACCES',
    });
    assert.equal(fs.compteurs.ecritures, ecritures);
  });
});

// --- Un événement du format 1 (§ 8.8, A15) ---------------------------------

// Le texte d'état au format 1 : ce qu'une construction du format 1 écrit
// pour la même charge, le format 2 n'ajoutant que des champs facultatifs.
function etatAuFormat1(texte) {
  const avant = `"entete": {"format":${FORMAT},`;
  assert.equal(texte.split(avant).length, 2, 'en-tête au format courant attendu');
  return texte.replace(avant, '"entete": {"format":1,');
}

// Le texte de journal au format 1 : son ouverture déclare le format 1, le
// reste tel quel.
function journalAuFormat1(texte) {
  const fin = texte.indexOf('\n');
  const ouverture = JSON.parse(texte.slice(0, fin));
  assert.equal(ouverture.format, FORMAT);
  return JSON.stringify({ ...ouverture, format: 1 }) + texte.slice(fin);
}

// Les fichiers de troisRevisions écrits par une construction du format 1 :
// l'état à la révision 3, le .precedent à la 2, le journal de trois
// entrées et un jalon.
async function troisRevisionsAuFormat1() {
  const { fichiers, ouvert } = await troisRevisions();
  const auFormat1 = fichiers.map(([nom, texte]) => [
    nom,
    nom === JOURNAL ? journalAuFormat1(texte) : nom === ETAT || nom === PRECEDENT ? etatAuFormat1(texte) : texte,
  ]);
  return { fichiers: auFormat1, courants: fichiers, ouvert };
}

const lignesDe = (texte) => texte.replace(/\n$/, '').split('\n');
const formatDeLEtat = (texte) => analyser(texte).entete.format;
const formatDuJournal = (texte) => lireJournal(texte).format;

describe('dépôt : un événement du format 1 se lit, et se convertit au premier geste (§ 8.8, A15)', () => {
  test('ouvrir, lister et verrouiller lisent l’état et le journal du format 1 sans rien réécrire : ni conversion à l’ouverture, ni au passage en écriture', async () => {
    const { fichiers, ouvert: temoin } = await troisRevisionsAuFormat1();
    const { disque, fs } = disqueAvec(fichiers);
    const ouvert = await rouvrir(disque, BASE);
    assert.equal(ouvert.formatPlusRecent, false);
    assert.deepEqual(ouvert.avertissements, []);
    assert.equal(ouvert.revision, 3);
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(temoin.charge));
    assert.equal(ouvert.journal.format, 1);
    assert.equal(ouvert.journal.entrees.length, 3);
    assert.equal(ouvert.journalAReecrire, true);
    const [resume] = await lister(fs, DOC);
    assert.deepEqual([resume.base, resume.journal, resume.illisible], [BASE, BASE, null]);
    await verrouiller(ouvert, 'seance-a', heure(9));
    for (const nom of [ETAT, PRECEDENT, JOURNAL]) assert.equal(fs.contenu('documents', nom), texteDe(fichiers, nom), nom);
  });

  test('le premier geste réécrit le journal entier au format courant, chaque ligne d’historique intacte, puis le .precedent et l’état ; le suivant s’ajoute en fin', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    const { disque } = disqueAvec(fichiers);
    const ouvert = await rouvrir(disque, BASE);
    const { fs } = ouvert;
    const trace = tracer(fs);
    const apres = modifier(ouvert.charge, 4);
    const suite = await enregistrer(ouvert, apres, geste(4));
    assert.deepEqual(trace.splice(0), [
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    const journal = fs.contenu('documents', JOURNAL);
    const anciennes = lignesDe(texteDe(fichiers, JOURNAL));
    const nouvelles = lignesDe(journal);
    assert.equal(nouvelles[0], ligneOuverture('evt-lucioles'));
    assert.equal(formatDuJournal(journal), FORMAT);
    assert.deepEqual(nouvelles.slice(1, -1), anciennes.slice(1));
    assert.equal(nouvelles.length, anciennes.length + 1);
    assert.equal(formatDeLEtat(fs.contenu('documents', ETAT)), FORMAT);
    assert.equal(fs.contenu('documents', PRECEDENT), texteDe(fichiers, ETAT));
    const relu = exigerEquivalence(fs, BASE);
    assert.deepEqual(revisionsEtLibelles(relu), [
      [1, CREATION.libelle],
      [2, 'Geste 2'],
      [3, 'Geste 3'],
      [4, 'Geste 4'],
    ]);
    assert.deepEqual(relu.jalons.map(({ revision, nom }) => [revision, nom]), [[1, 'Création']]);
    // Chaque instant d'avant la conversion se restitue comme le journal du
    // format 1 le restituait.
    const avant = lireJournal(texteDe(fichiers, JOURNAL));
    for (const revision of [1, 2, 3]) {
      assert.equal(texteDeCharge(reconstruire(relu, revision)), texteDeCharge(reconstruire(avant, revision)), String(revision));
    }
    assert.equal(suite.journalAReecrire, false);
    assert.equal(suite.journal.format, FORMAT);
    await enregistrer(suite, modifier(suite.charge, 5), geste(5));
    assert.deepEqual(trace.splice(0), [
      ['ajouterLigne', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual([rouvert.journalAReecrire, rouvert.journal.format, rouvert.revision], [false, FORMAT, 5]);
  });

  test('défaire après la conversion revient à l’instant d’avant elle, puis à celui d’avant encore : l’historique du format 1 reste entier', async () => {
    const { fichiers, ouvert: temoin } = await troisRevisionsAuFormat1();
    const { disque } = disqueAvec(fichiers);
    let ouvert = await rouvrir(disque, BASE);
    ouvert = await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4));
    const { cibleDefaire } = fil(ouvert.journal);
    assert.equal(cibleDefaire, 3);
    ouvert = await enregistrer(ouvert, reconstruire(ouvert.journal, 3), geste(5, { sens: 'defaire', retour: 3 }));
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(temoin.charge));
    assert.equal(fil(ouvert.journal).cibleDefaire, 2);
    ouvert = await enregistrer(ouvert, reconstruire(ouvert.journal, 2), geste(6, { sens: 'defaire', retour: 2 }));
    const precedent = analyser(texteDe(fichiers, PRECEDENT)).charge;
    assert.equal(texteDeCharge(ouvert.charge), texteDeCharge(precedent));
    const rouvert = await rouvrir(disque, BASE);
    assert.equal(texteDeCharge(rouvert.charge), texteDeCharge(precedent));
    assert.deepEqual(fil(rouvert.journal).courant, [2, 1]);
    assert.equal(fil(rouvert.journal).cibleRefaire, 3);
    exigerEquivalence(rouvert.fs, BASE);
  });

  test('un jalon posé en premier convertit le journal seul ; l’état reste au format 1, se relit, et se convertit au geste suivant', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    const { disque } = disqueAvec(fichiers);
    const ouvert = await rouvrir(disque, BASE);
    const { fs } = ouvert;
    const trace = tracer(fs);
    const nomme = await nommer(ouvert, { nom: 'Avant la génération', horodatage: heure(4) });
    assert.deepEqual(trace.splice(0), [['ecrireAtomique', JOURNAL]]);
    assert.equal(formatDuJournal(fs.contenu('documents', JOURNAL)), FORMAT);
    assert.equal(fs.contenu('documents', ETAT), texteDe(fichiers, ETAT));
    assert.equal(nomme.journalAReecrire, false);
    const rouvert = await rouvrir(disque, BASE);
    assert.deepEqual([rouvert.journalAReecrire, rouvert.revision, rouvert.journal.jalons.length], [false, 3, 2]);
    await enregistrer(rouvert, modifier(rouvert.charge, 4), geste(4));
    assert.equal(formatDeLEtat(fs.contenu('documents', ETAT)), FORMAT);
    exigerEquivalence(fs, BASE);
  });

  test('un journal du format 1 en avance d’une entrée sur l’état se rattrape, puis se réécrit en entier au premier geste', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    // L'état et son .precedent d'une révision plus tôt : le geste 3 est au
    // journal, l'état non.
    const poses = remplacer(fichiers, ETAT, texteDe(fichiers, PRECEDENT));
    const { disque } = disqueAvec(poses);
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual(ouvert.avertissements, [{ code: 'JOURNAL_REPRIS', details: {} }]);
    assert.deepEqual([ouvert.revision, ouvert.journalAReecrire], [3, true]);
    const { fs } = ouvert;
    const trace = tracer(fs);
    await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4));
    // L'état rattrapé s'écrit d'abord à la révision 3, puis le journal
    // entier, puis l'état du geste (§ 8.2).
    assert.deepEqual(trace, [
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
      ['ecrireAtomique', JOURNAL],
      ['ecrireAtomique', PRECEDENT],
      ['ecrireAtomique', ETAT],
    ]);
    assert.deepEqual(revisionsEtLibelles(exigerEquivalence(fs, BASE)).map(([revision]) => revision), [1, 2, 3, 4]);
    assert.equal(formatDuJournal(fs.contenu('documents', JOURNAL)), FORMAT);
  });

  test('un journal du format 1 en retard sur l’état reçoit la reprise, et se réécrit au format courant ; une ligne finale coupée s’écarte de même', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    const journal = texteDe(fichiers, JOURNAL);
    const sansLa3 = `${lignesDe(journal).slice(0, -1).join('\n')}\n`;
    const coupe = journal.slice(0, -10);
    for (const [nom, texte, avertissements, revisions] of [
      ['en retard', sansLa3, [{ code: 'JOURNAL_INCOMPLET', details: { etat: 3, journal: 2 } }], [1, 2, 3, 4]],
      ['coupé', coupe, [{ code: 'JOURNAL_INCOMPLET', details: { etat: 3, journal: 2 } }, { code: 'JOURNAL_ECARTEES', details: { n: 1 } }], [1, 2, 3, 4]],
    ]) {
      const { disque, fs } = disqueAvec(remplacer(fichiers, JOURNAL, texte));
      const ouvert = await rouvrir(disque, BASE);
      assert.deepEqual(ouvert.avertissements, avertissements, nom);
      assert.equal(ouvert.journal.format, 1, nom);
      await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
      const relu = exigerEquivalence(fs, BASE);
      assert.deepEqual(revisionsEtLibelles(relu).map(([revision]) => revision), revisions, nom);
      assert.equal(relu.entrees[2].libelle, REPRISE, nom);
      assert.equal(relu.format, FORMAT, nom);
    }
  });

  test('chaque coupure du premier geste laisse une paire qui se rouvre sur le geste dès que sa ligne est au journal', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    const entreLigneEtEtat = await exigerChaqueCoupure(
      'format 1',
      depuisFichiers(fichiers, (fs) => ouvrir(fs, DOC, BASE), []),
    );
    assert.ok(entreLigneEtEtat >= 1, String(entreLigneEtEtat));
  });

  test('un état illisible à côté d’un .precedent et d’un journal du format 1 nomme ses secours ; chacun s’ouvre, et son premier geste convertit le journal', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    const poses = remplacer(fichiers, ETAT, '{"entete":');
    const { fs } = disqueAvec(poses);
    const erreur = await echec(ouvrir(fs, DOC, BASE), 'ETAT_ILLISIBLE');
    assert.deepEqual(erreur.details.secours, { precedent: 2, journal: 3 });
    for (const source of ['precedent', 'journal']) {
      const disque = disqueAvec(poses);
      const ouvert = await ouvrirSecours(disque.fs, DOC, BASE, source);
      assert.equal(disque.fs.compteurs.ecritures, 0, source);
      assert.deepEqual([ouvert.formatPlusRecent, ouvert.journalAReecrire, ouvert.journal.format], [false, true, 1], source);
      await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4, { libelleReprise: REPRISE }));
      const relu = exigerEquivalence(disque.fs, BASE);
      assert.equal(relu.format, FORMAT, source);
      assert.deepEqual(relu.entrees.slice(0, 3).map(({ libelle }) => libelle), [CREATION.libelle, 'Geste 2', 'Geste 3'], source);
      assert.equal(formatDeLEtat(disque.fs.contenu('documents', ETAT)), FORMAT, source);
    }
  });

  test('un état au format courant à côté d’un journal resté au format 1 se lit ; le premier geste réécrit le journal', async () => {
    const { fichiers, courants } = await troisRevisionsAuFormat1();
    const { disque } = disqueAvec(remplacer(fichiers, ETAT, texteDe(courants, ETAT)));
    const ouvert = await rouvrir(disque, BASE);
    assert.deepEqual([ouvert.avertissements, ouvert.journalAReecrire], [[], true]);
    const { fs } = ouvert;
    const trace = tracer(fs);
    await enregistrer(ouvert, modifier(ouvert.charge, 4), geste(4));
    assert.deepEqual(trace[0], ['ecrireAtomique', JOURNAL]);
    assert.equal(formatDuJournal(fs.contenu('documents', JOURNAL)), FORMAT);
  });

  test('écrit ailleurs, un événement du format 1 pose une paire au format courant, historique entier', async () => {
    const { fichiers } = await troisRevisionsAuFormat1();
    const { disque, fs } = disqueAvec(fichiers);
    const ouvert = await rouvrir(disque, BASE);
    const AUTRE = { id: 'documents', chemin: DOCUMENTS };
    const copie = await enregistrerAilleurs(ouvert, AUTRE, { existantes: [BASE] });
    assert.equal(copie.base, `${BASE} (2)`);
    const journal = fs.contenu('documents', `${copie.base}${SUFFIXES.journal}`);
    assert.equal(formatDuJournal(journal), FORMAT);
    assert.deepEqual(lignesDe(journal).slice(1), lignesDe(texteDe(fichiers, JOURNAL)).slice(1));
    assert.equal(formatDeLEtat(fs.contenu('documents', `${copie.base}${SUFFIXES.etat}`)), FORMAT);
    for (const nom of [ETAT, PRECEDENT, JOURNAL]) assert.equal(fs.contenu('documents', nom), texteDe(fichiers, nom), nom);
  });
});

describe('dépôt : la présence par tour (§ 8.8, § 8.9)', () => {
  // La charge d'épreuve où Lacasse, personne 4, n'arrive qu'au tour 2 : la
  // proposition 1 la dit absente au tour 1.
  function chargePresence() {
    const charge = chargeEssai();
    charge.participants[3].presence = [2];
    charge.propositions[0].placement[0] = { sieges: [[1, 3], [2]], reserve: [], absents: [4] };
    return charge;
  }

  test("un événement à présence partielle, propositions, retenu et course compris, s'enregistre et se relit égal ; rien n'est écarté ni en dérive", async () => {
    const { disque, fs } = nouveauDisque();
    const ouvert = await creer(fs, DOC, chargePresence(), CREATION);
    const apres = structuredClone(ouvert.charge);
    const p2 = placement(2, [[1, 2], [3]]);
    p2.placement[0].absents = [4];
    apres.propositions.push(p2);
    apres.prochainsIds.proposition = 3;
    apres.retenu = retenuDe(p2);
    apres.evenement.etat = 'retenu';
    const courses = [entreeDe(p2)];
    const genere = await enregistrer(ouvert, apres, geste(2, { courses }));
    assert.deepEqual(genere.avertissements, []);
    const texte = fs.contenu('documents', ETAT);
    assert.ok(texte.includes('"exclu":false,"presence":[2]}'), texte);
    assert.equal(texte.split('"absents":[4]').length, 4, texte);

    const rouvert = await rouvrir(disque, BASE);
    assert.equal(serialiserCharge(rouvert.charge), serialiserCharge(apres));
    assert.deepEqual(rouvert.examen.fautives, []);
    assert.deepEqual(rouvert.examen.derives, []);
    assert.deepEqual(rouvert.examen.retenu, { fautes: [], raisons: [] });
    assert.deepEqual(courseDe(rouvert, 2), courseDe(genere, 2));
    assert.deepEqual(courseDe(rouvert, 2).releves[0].plan.tours[0], [[1, 2], [3]]);
    assert.ok(fs.contenu('documents', COURSES).includes('"absents":[4]'), 'le compagnon porte les absents de chaque relevé');
    exigerEquivalence(rouvert.fs, BASE);
  });

  test("un geste de présence qui ajuste le retenu s'inscrit et se relit : le retenu suit, les propositions dérivent et sont gardées", async () => {
    const { disque, fs } = nouveauDisque();
    const charge = chargePresence();
    charge.retenu = retenuDe(charge.propositions[0]);
    charge.evenement.etat = 'retenu';
    const ouvert = await creer(fs, DOC, charge, CREATION);
    const apres = structuredClone(ouvert.charge);
    delete apres.participants[3].presence;
    apres.retenu = ajusterALaPresence(apres.retenu, apres, [4]).placement;
    assert.deepEqual(apres.retenu.placement[0], { sieges: [[1, 3], [2]], reserve: [4] });
    const suite = await enregistrer(ouvert, apres, geste(2));
    assert.deepEqual(suite.avertissements, [{ code: 'DERIVE', details: { ids: [1], retenu: false } }]);

    const rouvert = await rouvrir(disque, BASE);
    assert.equal(serialiserCharge(rouvert.charge), serialiserCharge(apres));
    assert.deepEqual(rouvert.examen.derives, [{ id: 1, raisons: [{ code: 'PRESENCE_AJOUTEE', participant: 4, tours: [1] }] }]);
    assert.deepEqual(rouvert.examen.retenu, { fautes: [], raisons: [] });
    assert.equal(serialiserCharge(reconstruire(rouvert.journal, 1)), serialiserCharge(ouvert.charge));
    exigerEquivalence(rouvert.fs, BASE);
  });
});
