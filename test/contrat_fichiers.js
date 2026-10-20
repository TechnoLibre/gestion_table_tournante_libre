// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Suite de contrat du système de fichiers (§ 13.4, § 14.10) : ce que les trois
// implémentations de l'interface de src/stockage/systeme_fichiers.js —
// electron, web et celle d'épreuve — promettent pareillement au stockage. La
// suite ne connaît que l'interface, et reçoit de l'appelant son lanceur et
// ses assertions : elle se joue sous node avec node:assert comme dans le
// navigateur avec expect.
//
//   describe(nom, corps), test(nom, corps)  ceux du lanceur de l'appelant
//   egal(reel, attendu, message?)           égalité profonde et stricte
//   vrai(valeur, message?)                  valeur vraie
//   rejette(promesse, message?)             échoue quand la promesse se
//                                           résout ; rend la raison du rejet
//
// Chaque épreuve demande à fabrique() un système neuf et une racine qui
// existe et ne porte rien : aucune ne voit ce qu'une autre a écrit. Les
// pannes — renommage refusé, support qui refuse l'écriture, processus coupé —
// ne se provoquent que sur l'implémentation d'épreuve, et s'éprouvent à côté
// d'elle (test/fichiers_simules.test.js). Là où verrouDisponible est faux, la
// suite exige du verrou ce que la plateforme promet à la place : verrouiller
// rend { pris: true } à chaque appel, et deverrouiller ne lève pas. Partout,
// l'instant de prise que verrouiller reçoit a la forme d'un horodatage.
import { ErreurStockage } from '../src/stockage/erreurs.js';

// Les primitives de l'interface, dans l'ordre où elle les déclare.
const PRIMITIVES = [
  'emplacements',
  'racines',
  'choisirDossier',
  'sonder',
  'typeSupport',
  'lireTexte',
  'ecrireAtomique',
  'ecrireOctetsAtomique',
  'ajouterLigne',
  'lister',
  'creerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
  'ouvrirDansExplorateur',
  'choisirFichierAImporter',
  'enregistrerSous',
];

// Instants de prise d'un verrou, de la forme qu'écrit l'horloge de
// l'application : le verrou les inscrit tels quels, décalage compris.
const DEPUIS = '2031-05-17T19:42:07-04:00';
const DEPUIS_LOINTAIN = '2031-05-18T06:12:00+05:30';

// Des valeurs qui n'ont pas la forme d'un horodatage : absente, vide, sans
// décalage, en temps universel, un instant en millisecondes, une date seule.
const DEPUIS_FAUTIFS = [undefined, null, '', '2031-05-17 19:42:07', '2031-05-17T19:42:07Z', 1_950_000_000_000, '2031-05-17'];

// Octets d'un fichier binaire : l'en-tête d'un PDF, dont la ligne de
// commentaire porte des octets hors UTF-8, puis un nul, un 0xFF et un CRLF.
// Les octets d'un texte en UTF-8, accent et fin de ligne CRLF compris.
const OCTETS_BINAIRES = Object.freeze([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a, 0x00, 0xff, 0x0d, 0x0a,
]);
const TEXTE_EN_OCTETS = 'Soir\u{E9}e\r\n';

// Des octets d'une autre forme qu'un Uint8Array : un texte, un tableau de
// nombres, un tampon nu, rien.
const OCTETS_FAUTIFS = [() => 'texte', () => [0x25, 0x50], () => new ArrayBuffer(2), () => null, () => undefined];

// Chemins qu'aucune implémentation n'accepte : remontant, absolu sous Unix,
// absolu sous Windows, remontant après un détour.
const CHEMINS_REFUSES = ['../x', '/x', 'C:\\x', 'a/../../x'];

// Les primitives qui reçoivent un chemin, chacune appelée avec le chemin
// donné à la place qu'elle éprouve. deplacer s'éprouve par sa source, vers
// une cible absente, puis par sa cible, depuis ici.txt, que l'épreuve pose :
// seul le chemin éprouvé peut alors faire échouer l'appel.
const APPELS_A_CHEMIN = [
  ['lireTexte', (fs, racine, chemin) => fs.lireTexte(racine, chemin)],
  ['ecrireAtomique', (fs, racine, chemin) => fs.ecrireAtomique(racine, chemin, 'texte')],
  ['ecrireOctetsAtomique', (fs, racine, chemin) => fs.ecrireOctetsAtomique(racine, chemin, new Uint8Array([0x25]))],
  ['ajouterLigne', (fs, racine, chemin) => fs.ajouterLigne(racine, chemin, 'ligne')],
  ['lister', (fs, racine, chemin) => fs.lister(racine, chemin)],
  ['creerDossier', (fs, racine, chemin) => fs.creerDossier(racine, chemin)],
  ['deplacer, source', (fs, racine, chemin) => fs.deplacer(racine, chemin, 'ailleurs.txt')],
  ['deplacer, cible', (fs, racine, chemin) => fs.deplacer(racine, 'ici.txt', chemin)],
  ['supprimer', (fs, racine, chemin) => fs.supprimer(racine, chemin)],
  ['verrouiller', (fs, racine, chemin) => fs.verrouiller(racine, chemin, 'seance-a', DEPUIS)],
  ['deverrouiller', (fs, racine, chemin) => fs.deverrouiller(racine, chemin, 'seance-a')],
];

// Vrai pour la description d'une racine : un identifiant et un chemin
// affichable, chaînes non vides.
const estRacine = (racine) =>
  racine !== null &&
  typeof racine === 'object' &&
  typeof racine.id === 'string' &&
  racine.id !== '' &&
  typeof racine.chemin === 'string' &&
  racine.chemin !== '';

// Noms des entrées d'un dossier, dans l'ordre rendu.
const noms = (entrees) => entrees.map((entree) => entree.nom);

/**
 * Enregistre la suite de contrat d'une implémentation.
 *
 * @param {string} nom  nom de l'implémentation, repris dans celui de la suite
 * @param {() => Promise<{fs: import('../src/stockage/systeme_fichiers.js').SystemeFichiers,
 *                         racine: import('../src/stockage/systeme_fichiers.js').Racine}>} fabrique
 *        rend à chaque appel un système neuf, et une racine qui existe et ne
 *        porte rien
 * @param {Object} outils  describe, test, egal, vrai, rejette, décrits en tête
 */
export function eprouverContrat(nom, fabrique, { describe, test, egal, vrai, rejette }) {
  // Attend le rejet d'une ErreurStockage de ce code et, quand ils sont
  // donnés, de ces détails exactement ; rend l'erreur.
  async function echoue(promesse, code, details, message = code) {
    const erreur = await rejette(promesse, message);
    vrai(erreur instanceof ErreurStockage, `${message} : ${erreur}`);
    egal(erreur.code, code, message);
    if (details !== undefined) egal(erreur.details, details, message);
    return erreur;
  }

  // Attend un refus d'écriture : ECRITURE, dont les détails nomment l'un des
  // chemins admis, le dossier et la cause, chaînes non vides.
  async function refuseEcriture(promesse, ...chemins) {
    const { details } = await echoue(promesse, 'ECRITURE', undefined, chemins[0]);
    vrai(chemins.includes(details.chemin), `chemin ${details.chemin}`);
    vrai(typeof details.dossier === 'string' && details.dossier !== '', `dossier ${details.dossier}`);
    vrai(typeof details.cause === 'string' && details.cause !== '', `cause ${details.cause}`);
  }

  describe(`contrat du système de fichiers : ${nom}`, () => {
    test("l'interface porte sa nature, ses deux garanties et ses dix-huit primitives, et décrit ses emplacements et ses racines", async () => {
      const { fs, racine } = await fabrique();
      vrai(['electron', 'web', 'epreuve'].includes(fs.nature), `nature ${fs.nature}`);
      egal(typeof fs.renommageAtomique, 'boolean', 'renommageAtomique');
      egal(typeof fs.verrouDisponible, 'boolean', 'verrouDisponible');
      for (const primitive of PRIMITIVES) egal(typeof fs[primitive], 'function', primitive);

      const emplacements = await fs.emplacements();
      vrai(emplacements.executable === null || typeof emplacements.executable === 'string', 'executable');
      vrai(
        Array.isArray(emplacements.donneesApplicatives) &&
          emplacements.donneesApplicatives.every((chemin) => typeof chemin === 'string'),
        'donneesApplicatives',
      );
      egal(typeof emplacements.insensibleCasse, 'boolean', 'insensibleCasse');
      vrai(emplacements.separateur === '\\' || emplacements.separateur === '/', 'separateur');

      const racines = await fs.racines();
      vrai(estRacine(racines.documents), 'racine documents');
      vrai(racines.portable === null || estRacine(racines.portable), 'racine portable');
      vrai(['amovible', 'fixe', 'inconnu'].includes(await fs.typeSupport(racine)), 'typeSupport');
    });

    test("lireTexte rend le texte écrit tel quel : marque d'ordre d'octets, accents composés ou non, CRLF, caractère hors du plan de base", async () => {
      const { fs, racine } = await fabrique();
      const texte = '\u{FEFF}Soir\u{E9}e d\u{2019}\u{E9}t\u{E9}\r\n\u{C9}lan \u{AB} \u{F4} \u{BB} e\u{301}\rfin\n\u{1D11E}';
      const chemin = 'Soir\u{E9}e d\u{2019}\u{E9}t\u{E9}.txt';
      await fs.ecrireAtomique(racine, chemin, texte);
      egal(await fs.lireTexte(racine, chemin), texte);
    });

    test('ecrireAtomique remplace le contenu entier et ne laisse aucun fichier .ecriture', async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'etat.json', 'premier contenu, le plus long des deux');
      await fs.ecrireAtomique(racine, 'etat.json', 'second');
      egal(await fs.lireTexte(racine, 'etat.json'), 'second');
      egal(noms(await fs.lister(racine, '')), ['etat.json']);
    });

    test("ecrireOctetsAtomique écrit les octets tels quels : relus, ce sont les mêmes, hors UTF-8 compris ; il remplace le contenu entier, ne garde pas le tableau reçu et ne laisse aucun fichier .ecriture", async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireOctetsAtomique(racine, 'planche.pdf', new Uint8Array(64).fill(0x41));
      const octets = new Uint8Array(OCTETS_BINAIRES);
      await fs.ecrireOctetsAtomique(racine, 'planche.pdf', octets);
      // L'appelant réemploie son tableau : le fichier n'en dépend plus.
      octets.fill(0);
      // Des octets hors UTF-8 se relisent par le refus de lireTexte, qui en
      // porte une copie.
      const { details } = await echoue(fs.lireTexte(racine, 'planche.pdf'), 'LECTURE');
      egal(details.cause, 'UTF8_INVALIDE');
      egal(details.chemin, 'planche.pdf');
      egal([...details.octets], [...OCTETS_BINAIRES]);
      egal(
        (await fs.lister(racine, '')).map(({ nom: nomEntree, type, taille }) => ({ nom: nomEntree, type, taille })),
        [{ nom: 'planche.pdf', type: 'fichier', taille: OCTETS_BINAIRES.length }],
      );

      // Des octets d'UTF-8 se relisent en texte, tels qu'écrits.
      await fs.ecrireOctetsAtomique(racine, 'liste.csv', new TextEncoder().encode(TEXTE_EN_OCTETS));
      egal(await fs.lireTexte(racine, 'liste.csv'), TEXTE_EN_OCTETS);
      egal(noms(await fs.lister(racine, '')), ['liste.csv', 'planche.pdf']);
    });

    test('ecrireOctetsAtomique dans un dossier absent lève ECRITURE, sans créer le dossier ni toucher aux autres fichiers', async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'ici.txt', 'ici');
      await refuseEcriture(fs.ecrireOctetsAtomique(racine, 'disparu/planche.pdf', new Uint8Array(OCTETS_BINAIRES)), 'disparu/planche.pdf');
      egal(noms(await fs.lister(racine, '')), ['ici.txt']);
      egal(await fs.lireTexte(racine, 'ici.txt'), 'ici');
    });

    test("ecrireOctetsAtomique refuse des octets d'une autre forme qu'un Uint8Array : TypeError, et rien ne s'écrit", async () => {
      const { fs, racine } = await fabrique();
      for (const fautifs of OCTETS_FAUTIFS) {
        const raison = await rejette(fs.ecrireOctetsAtomique(racine, 'planche.pdf', fautifs()), String(fautifs));
        vrai(raison instanceof TypeError, `${String(fautifs)} : ${raison}`);
      }
      egal(await fs.lister(racine, ''), []);
    });

    test('ajouterLigne ajoute la ligne et une fin de ligne LF après le dernier octet, et crée le fichier absent', async () => {
      const { fs, racine } = await fabrique();
      await fs.ajouterLigne(racine, 'journal.jsonl', '{"type":"journal"}');
      egal(await fs.lireTexte(racine, 'journal.jsonl'), '{"type":"journal"}\n');
      await fs.ajouterLigne(racine, 'journal.jsonl', '{"revision":1}');
      egal(await fs.lireTexte(racine, 'journal.jsonl'), '{"type":"journal"}\n{"revision":1}\n');

      // Une dernière ligne sans fin de ligne reste telle : l'ajout la prolonge.
      await fs.ecrireAtomique(racine, 'tronque.jsonl', '{"type":"jour');
      await fs.ajouterLigne(racine, 'tronque.jsonl', 'nal"}');
      egal(await fs.lireTexte(racine, 'tronque.jsonl'), '{"type":"journal"}\n');
    });

    test("lister rend les entrées directes du dossier, triées par unités UTF-16, typées, la taille d'un fichier en octets UTF-8 et 0 pour un dossier", async () => {
      const { fs, racine } = await fabrique();
      await fs.creerDossier(racine, 'dossier');
      await fs.ecrireAtomique(racine, 'dossier/interne.txt', 'x');
      await fs.ecrireAtomique(racine, 'b.txt', 'bb');
      await fs.ecrireAtomique(racine, '\u{E9}.txt', '\u{E9}');
      await fs.ecrireAtomique(racine, 'a.txt', '');
      await fs.ecrireAtomique(racine, 'Z.txt', '\u{1D11E}');

      const entrees = await fs.lister(racine, '');
      egal(
        entrees.map(({ nom: nomEntree, type, taille }) => ({ nom: nomEntree, type, taille })),
        [
          { nom: 'Z.txt', type: 'fichier', taille: 4 },
          { nom: 'a.txt', type: 'fichier', taille: 0 },
          { nom: 'b.txt', type: 'fichier', taille: 2 },
          { nom: 'dossier', type: 'dossier', taille: 0 },
          { nom: '\u{E9}.txt', type: 'fichier', taille: 2 },
        ],
      );
      vrai(entrees.every((entree) => Number.isFinite(entree.modifie)), 'modifie');
      egal(noms(await fs.lister(racine, 'dossier')), ['interne.txt']);
    });

    test("creerDossier crée les dossiers parents, et un dossier existant n'est pas une faute", async () => {
      const { fs, racine } = await fabrique();
      await fs.creerDossier(racine, 'corbeille/2026-01-02_03-04-05');
      egal(
        (await fs.lister(racine, '')).map(({ nom: nomEntree, type }) => ({ nom: nomEntree, type })),
        [{ nom: 'corbeille', type: 'dossier' }],
      );
      egal(
        (await fs.lister(racine, 'corbeille')).map(({ nom: nomEntree, type }) => ({ nom: nomEntree, type })),
        [{ nom: '2026-01-02_03-04-05', type: 'dossier' }],
      );
      egal(await fs.lister(racine, 'corbeille/2026-01-02_03-04-05'), []);
      await fs.creerDossier(racine, 'corbeille');
      egal(noms(await fs.lister(racine, 'corbeille')), ['2026-01-02_03-04-05']);
    });

    test("deplacer porte le fichier sous son nouveau chemin et retire l'ancien", async () => {
      const { fs, racine } = await fabrique();
      await fs.creerDossier(racine, 'corbeille');
      await fs.ecrireAtomique(racine, 'soiree.gtt.json', '\u{E9}tat');
      await fs.deplacer(racine, 'soiree.gtt.json', 'corbeille/soiree.gtt.json');
      egal(await fs.lireTexte(racine, 'corbeille/soiree.gtt.json'), '\u{E9}tat');
      egal(noms(await fs.lister(racine, '')), ['corbeille']);
    });

    test('deplacer refuse une cible existante (EXISTE) et laisse les deux fichiers intacts', async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'source.txt', 'source');
      await fs.ecrireAtomique(racine, 'cible.txt', 'cible');
      await echoue(fs.deplacer(racine, 'source.txt', 'cible.txt'), 'EXISTE', { chemin: 'cible.txt' });
      egal(await fs.lireTexte(racine, 'source.txt'), 'source');
      egal(await fs.lireTexte(racine, 'cible.txt'), 'cible');
    });

    test('deplacer une source absente lève ABSENT', async () => {
      const { fs, racine } = await fabrique();
      await echoue(fs.deplacer(racine, 'absent.txt', 'ailleurs.txt'), 'ABSENT', { chemin: 'absent.txt' });
      egal(await fs.lister(racine, ''), []);
    });

    test("lireTexte d'un fichier absent et lister d'un dossier absent lèvent ABSENT", async () => {
      const { fs, racine } = await fabrique();
      await echoue(fs.lireTexte(racine, 'absent.gtt.json'), 'ABSENT', { chemin: 'absent.gtt.json' });
      await echoue(fs.lister(racine, 'absent'), 'ABSENT', { chemin: 'absent' });
    });

    test('écrire, ajouter ou déplacer dans un dossier absent lève ECRITURE, sans créer le dossier', async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'ici.txt', 'ici');
      await refuseEcriture(fs.ecrireAtomique(racine, 'disparu/etat.json', 'x'), 'disparu/etat.json');
      await refuseEcriture(fs.ajouterLigne(racine, 'disparu/journal.jsonl', 'x'), 'disparu/journal.jsonl');
      await refuseEcriture(fs.deplacer(racine, 'ici.txt', 'disparu/ici.txt'), 'disparu/ici.txt', 'ici.txt');
      egal(noms(await fs.lister(racine, '')), ['ici.txt']);
      egal(await fs.lireTexte(racine, 'ici.txt'), 'ici');
    });

    test("supprimer retire le fichier, et supprimer un absent n'est pas une faute", async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'garde.txt', 'garde');
      await fs.ecrireAtomique(racine, 'retire.txt', 'retire');
      await fs.supprimer(racine, 'retire.txt');
      await echoue(fs.lireTexte(racine, 'retire.txt'), 'ABSENT', { chemin: 'retire.txt' });
      await fs.supprimer(racine, 'retire.txt');
      egal(noms(await fs.lister(racine, '')), ['garde.txt']);
    });

    test('un chemin absolu ou remontant lève CHEMIN_REFUSE {chemin} à chaque primitive, sans rien écrire', async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'ici.txt', 'ici');
      for (const chemin of CHEMINS_REFUSES) {
        for (const [primitive, appel] of APPELS_A_CHEMIN) {
          await echoue(appel(fs, racine, chemin), 'CHEMIN_REFUSE', { chemin }, `${primitive} ${chemin}`);
        }
      }
      egal(noms(await fs.lister(racine, '')), ['ici.txt']);
      egal(await fs.lireTexte(racine, 'ici.txt'), 'ici');
    });

    test("une racine inconnue lève CHEMIN_REFUSE, même sous le chemin d'une racine connue", async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'ici.txt', 'ici');
      const inconnue = { id: 'racine-inconnue', chemin: racine.chemin };
      for (const [primitive, appel] of APPELS_A_CHEMIN) {
        await echoue(appel(fs, inconnue, 'ici.txt'), 'CHEMIN_REFUSE', undefined, primitive);
      }
      await echoue(fs.sonder(inconnue), 'CHEMIN_REFUSE', undefined, 'sonder');
      egal(noms(await fs.lister(racine, '')), ['ici.txt']);
      egal(await fs.lireTexte(racine, 'ici.txt'), 'ici');
    });

    test("verrouiller est exclusif : un second appel rend la séance du premier, vivante, et l'instant qu'il a reçu, tel quel", async () => {
      const { fs, racine } = await fabrique();
      egal(await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-a', DEPUIS_LOINTAIN), { pris: true });
      const second = await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-b', DEPUIS);
      if (!fs.verrouDisponible) {
        egal(second, { pris: true });
        return;
      }
      egal(second, { pris: false, seance: 'seance-a', depuis: DEPUIS_LOINTAIN, vivant: true });
    });

    test("verrouiller refuse un instant qui n'a pas la forme d'un horodatage : TypeError, et rien ne se crée", async () => {
      const { fs, racine } = await fabrique();
      for (const depuis of DEPUIS_FAUTIFS) {
        const raison = await rejette(fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-a', depuis), String(depuis));
        vrai(raison instanceof TypeError, `${String(depuis)} : ${raison}`);
      }
      egal(noms(await fs.lister(racine, '')), []);
      egal(await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-a', DEPUIS), { pris: true });
    });

    test("deverrouiller n'efface que le verrou de sa séance, et un verrou absent n'est pas une faute", async () => {
      const { fs, racine } = await fabrique();
      await fs.deverrouiller(racine, 'soiree.gtt.verrou', 'seance-a');
      await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-a', DEPUIS);
      await fs.deverrouiller(racine, 'soiree.gtt.verrou', 'seance-b');
      if (!fs.verrouDisponible) {
        egal(await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-c', DEPUIS), { pris: true });
        return;
      }
      const tenu = await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-c', DEPUIS_LOINTAIN);
      egal([tenu.pris, tenu.seance, tenu.depuis], [false, 'seance-a', DEPUIS]);
      await fs.deverrouiller(racine, 'soiree.gtt.verrou', 'seance-a');
      egal(await fs.verrouiller(racine, 'soiree.gtt.verrou', 'seance-c', DEPUIS), { pris: true });
    });

    test('sonder rend inscriptible, efface le témoin resté et laisse les autres fichiers', async () => {
      const { fs, racine } = await fabrique();
      await fs.ecrireAtomique(racine, 'garde.txt', 'garde');
      await fs.ecrireAtomique(racine, '.gtt-temoin', 'resté d\u{2019}une séance précédente');
      egal(await fs.sonder(racine), { inscriptible: true, cause: null });
      egal(noms(await fs.lister(racine, '')), ['garde.txt']);
      egal(await fs.lireTexte(racine, 'garde.txt'), 'garde');
    });
  });
}
