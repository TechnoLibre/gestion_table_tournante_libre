// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'audit par mutation du moteur (§ 14.13), sa propre commande : make
// mutation, npm run mutation, node scripts/mutation/audit.js. Hors des séries
// node et node-long, sous aucun budget (§ 14.14) ; aucune épreuve ne
// l'importe (audit.test.js).
//
// Déroulé, chaque étape sous le repli node --test du § 14.8 :
//   0. l'en-tête du rapport — version, périmètre, empreinte des sources, Node —
//      se compose et se juge par verifierEntete avant toute mesure : un
//      en-tête refusé ne jette pas des heures de calcul ;
//   1. ligne de base : la série node du périmètre, non mutée, passe ;
//   2. passe de couverture (--experimental-test-coverage), d'où les lignes
//      couvertes — avant les mutants, pour qu'un audit qui ne mesure pas
//      s'arrête tôt ;
//   3. les mutants des modules du périmètre ; aucun, refus ;
//   4. un mutant témoin, un throw en tête de module, doit être tué : sinon
//      le source muté n'atteint pas les épreuves et chaque mutant
//      survivrait ;
//   5. chaque mutant contre les épreuves node du périmètre qui atteignent son
//      module, os.availableParallelism() à la fois ;
//   6. les survivants rejoués contre les .long.test.js du périmètre qui
//      atteignent leur module, après une ligne de base de ces épreuves ;
//   7. l'empreinte des sources se reprend : différente de celle de l'étape 0,
//      les mutants ont été lus ou joués sur d'autres sources que celles que
//      l'en-tête désigne, et rien ne s'écrit ;
//   8. audit/mutation-moteur.md et .json, par rediger ; les survivants que la
//      série longue tue, et ceux que audit/mutants-equivalents.json déclare
//      équivalents, y sont rangés à part.
//
// Sortie 0 quand le rapport est écrit, survivants compris : l'audit n'est pas
// bloquant. Sortie 2 quand l'audit ne mesure pas — en-tête refusé, ligne de
// base rouge, aucun mutant, témoin non tué, fichier d'équivalents illisible,
// sources changées pendant l'audit, arrêt demandé — et rien n'est écrit. Les durées se lisent à l'horloge réelle et
// ne s'impriment que sur la sortie d'erreur, jamais dans le rapport.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { availableParallelism, tmpdir } from 'node:os';
import { join, relative, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { executerMutant, executerSerie } from './executer.js';
import { grapheDuProjet, testsConcernes } from './graphe.js';
import { mutants } from './mutants.js';
import { equivalentsDe, rediger, verifierEntete } from './rapport.js';

// Les dossiers mutés, et dont les épreuves jugent les mutants : le moteur
// seul (§ 14.13). audit.test.js le lit dans ce source.
export const PERIMETRE = Object.freeze(['src/moteur']);

// Les arbres dont le graphe des imports se construit : une épreuve du
// périmètre peut atteindre un module muté par un module de src/ ou de test/.
const ARBRES_DU_GRAPHE = Object.freeze(['src', 'test']);

const RACINE = fileURLToPath(new URL('../..', import.meta.url));
const SORTIES = Object.freeze({ markdown: 'audit/mutation-moteur.md', json: 'audit/mutation-moteur.json' });
const EQUIVALENTS = 'audit/mutants-equivalents.json';

// Délai d'une ligne de base ; celui d'un mutant vaut FACTEUR_DELAI fois la
// ligne de base qui le juge, DELAI_MIN_MS au moins : une boucle sans fin
// coûte ce délai, et un mutant lent sous la charge de P processus ne se
// confond pas avec elle.
const DELAI_LIGNE_DE_BASE_MS = 30 * 60_000;
const DELAI_MIN_MS = 10_000;
const FACTEUR_DELAI = 4;

export const SORTIE_NE_MESURE_PAS = 2;

class AuditImpossible extends Error {}

const estEpreuveNode = (f) => f.endsWith('.test.js') && !f.endsWith('.long.test.js') && !f.endsWith('.navigateur.test.js');
const estEpreuveLongue = (f) => f.endsWith('.long.test.js');
const estModule = (f) => !f.endsWith('.test.js');
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Les fichiers .js du périmètre, relatifs à la racine, en barres obliques,
// triés.
function fichiersDuPerimetre(racine) {
  return PERIMETRE.flatMap((dossier) =>
    readdirSync(join(racine, dossier), { recursive: true, withFileTypes: true })
      .filter((entree) => entree.isFile() && entree.name.endsWith('.js'))
      .map((entree) => relative(racine, join(entree.parentPath, entree.name)).split(sep).join('/')),
  ).sort(comparer);
}

// SHA-256 des fichiers donnés, chemin et octets de chacun, dans l'ordre reçu.
function empreinteDe(racine, fichiers) {
  const hachage = createHash('sha256');
  for (const fichier of fichiers) {
    hachage.update(`${fichier}\0`);
    hachage.update(readFileSync(join(racine, fichier)));
    hachage.update('\0');
  }
  return hachage.digest('hex');
}

// Les équivalences déclarées, lues par equivalentsDe de rapport.js : chaque
// clé vers sa raison. Fichier absent : aucune. Lève AuditImpossible, qui
// nomme le fichier, sur un texte qu'equivalentsDe refuse.
function lireEquivalents(racine) {
  const chemin = join(racine, EQUIVALENTS);
  if (!existsSync(chemin)) return new Map();
  try {
    return equivalentsDe(readFileSync(chemin, 'utf8'));
  } catch (erreur) {
    throw new AuditImpossible(`${EQUIVALENTS} : ${erreur.message}`);
  }
}

// Les lignes exécutées d'un rapport LCOV, par fichier : DA:<ligne>,<compte>
// avec un compte non nul.
function lignesCouvertes(lcov) {
  const couvertes = new Map();
  let fichier = null;
  for (const ligne of lcov.split('\n')) {
    if (ligne.startsWith('SF:')) {
      fichier = ligne.slice(3).trim().split(sep).join('/');
      if (!couvertes.has(fichier)) couvertes.set(fichier, new Set());
    } else if (ligne.startsWith('DA:') && fichier !== null) {
      const [numero, compte] = ligne.slice(3).split(',');
      if (Number(compte) > 0) couvertes.get(fichier).add(Number(numero));
    } else if (ligne.trim() === 'end_of_record') {
      fichier = null;
    }
  }
  return couvertes;
}

// Les dernières lignes d'une sortie, pour dire pourquoi une ligne de base
// échoue.
const fin = (sortie) => sortie.trimEnd().split('\n').slice(-15).join('\n');

// La ligne de base d'une liste d'épreuves : elles passent, non mutées.
// Rend la durée ; lève AuditImpossible sinon.
async function ligneDeBase(racine, tests, nom) {
  const serie = await executerSerie({ tests, delaiMs: DELAI_LIGNE_DE_BASE_MS, racine });
  if (serie.delai || serie.code !== 0) {
    throw new AuditImpossible(`${nom}, non mutée, échoue sous node --test (code ${serie.code}) :\n${fin(serie.sortie)}`);
  }
  return serie.dureeMs;
}

// Les lignes couvertes par la série node du périmètre, sous
// --experimental-test-coverage, par un rapport LCOV écrit dans un dossier
// temporaire, hors du projet, effacé ensuite.
async function passeDeCouverture(racine, tests) {
  const dossier = mkdtempSync(join(tmpdir(), 'gtt-couverture-'));
  try {
    const lcov = join(dossier, 'lcov.info');
    const serie = await executerSerie({
      tests,
      delaiMs: DELAI_LIGNE_DE_BASE_MS,
      racine,
      argumentsNode: [
        '--experimental-test-coverage',
        ...PERIMETRE.map((d) => `--test-coverage-include=${d}/**`),
        '--test-coverage-exclude=**/*.test.js',
        '--test-reporter=lcov',
        `--test-reporter-destination=${lcov}`,
        '--test-reporter-destination=stdout',
      ],
    });
    if (serie.delai || serie.code !== 0 || !existsSync(lcov)) {
      throw new AuditImpossible(`la passe de couverture échoue (code ${serie.code}) :\n${fin(serie.sortie)}`);
    }
    return lignesCouvertes(readFileSync(lcov, 'utf8'));
  } finally {
    rmSync(dossier, { recursive: true, force: true });
  }
}

// Fait chaque tâche, au plus `largeur` à la fois ; rend les résultats dans
// l'ordre des tâches, quel que soit l'ordre où elles finissent. Plus aucune
// tâche ne part quand arreter() devient vrai : celles en cours finissent.
async function enParallele(taches, largeur, faire, { arreter, signaler }) {
  const resultats = new Array(taches.length);
  let suivante = 0;
  let finies = 0;
  const ouvrier = async () => {
    while (suivante < taches.length && !arreter()) {
      const rang = suivante;
      suivante += 1;
      resultats[rang] = await faire(taches[rang]);
      finies += 1;
      signaler(finies, taches.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(largeur, taches.length) }, ouvrier));
  if (arreter()) throw new AuditImpossible('arrêt demandé avant la fin');
  return resultats;
}

// Un signalement d'avancement tous les vingtièmes, et au dernier.
function avancement(nom, journal) {
  let dernier = -1;
  return (finies, total) => {
    const palier = Math.floor((finies * 20) / total);
    if (palier !== dernier || finies === total) {
      dernier = palier;
      journal(`${nom} : ${finies} / ${total}`);
    }
  };
}

/**
 * L'audit entier, le rapport écrit sous racine/audit/. Lève
 * AuditImpossible quand il ne mesure pas, sans rien écrire.
 * @param {{racine?: string, journal?: (texte: string) => void, arreter?: () => boolean}} [options]
 * @returns {Promise<{bilan: object, dureeMs: number}>}
 */
export async function auditer({ racine = RACINE, journal = (texte) => process.stderr.write(`${texte}\n`), arreter = () => false } = {}) {
  const debut = performance.now();
  const fichiers = fichiersDuPerimetre(racine);
  const epreuvesNode = fichiers.filter(estEpreuveNode);
  const epreuvesLongues = fichiers.filter(estEpreuveLongue);
  if (epreuvesNode.length === 0) throw new AuditImpossible(`aucune épreuve node sous ${PERIMETRE.join(', ')}`);
  const equivalents = lireEquivalents(racine);

  const empreinte = empreinteDe(racine, fichiers);
  let entete;
  try {
    const { version } = JSON.parse(readFileSync(join(racine, 'version.json'), 'utf8'));
    entete = verifierEntete({ version, perimetre: [...PERIMETRE], empreinte, node: process.version });
  } catch (erreur) {
    throw new AuditImpossible(`en-tête du rapport refusé avant toute mesure : ${erreur.message}`);
  }

  journal(`ligne de base : ${epreuvesNode.length} épreuves, sous node --test`);
  const base = await ligneDeBase(racine, epreuvesNode, 'la série node du périmètre');
  journal(`ligne de base : ${(base / 1000).toFixed(1)} s`);
  const couvertes = await passeDeCouverture(racine, epreuvesNode);

  const graphe = grapheDuProjet(racine, ARBRES_DU_GRAPHE);
  const juges = (fichier, estJuge) => testsConcernes(fichier, graphe).filter((t) => fichiers.includes(t) && estJuge(t));
  const taches = fichiers.filter(estModule).flatMap((fichier) => {
    const tests = juges(fichier, estEpreuveNode);
    const longues = juges(fichier, estEpreuveLongue);
    return mutants(readFileSync(join(racine, fichier), 'utf8'), fichier).map((mutant) => ({ mutant, tests, longues }));
  });
  if (taches.length === 0) throw new AuditImpossible(`aucun mutant sous ${PERIMETRE.join(', ')}`);

  const delaiMs = Math.max(DELAI_MIN_MS, FACTEUR_DELAI * base);
  const premier = taches.find(({ tests }) => tests.length > 0);
  if (premier === undefined) throw new AuditImpossible('aucune épreuve node n’atteint un module muté');
  const temoin = {
    cle: 'temoin',
    fichier: premier.mutant.fichier,
    ligne: 1,
    colonne: 1,
    operateur: 'temoin',
    original: '',
    remplacement: "throw new Error('mutant témoin');\n",
    debut: 0,
    fin: 0,
  };
  const issueTemoin = await executerMutant({ mutant: temoin, tests: premier.tests, delaiMs, racine });
  if (issueTemoin.issue !== 'tue') {
    throw new AuditImpossible(`le mutant témoin de ${temoin.fichier} n’est pas tué (${issueTemoin.issue}) : le source muté n’atteint pas les épreuves`);
  }

  const largeur = availableParallelism();
  journal(`${taches.length} mutants, ${largeur} à la fois, délai ${(delaiMs / 1000).toFixed(0)} s`);
  const issues = await enParallele(
    taches,
    largeur,
    async ({ mutant, tests }) => (tests.length === 0 ? 'survivant' : (await executerMutant({ mutant, tests, delaiMs, racine })).issue),
    { arreter, signaler: avancement('mutants', journal) },
  );

  const aRejouer = taches.map((tache, rang) => ({ ...tache, rang })).filter(({ rang, longues }) => issues[rang] === 'survivant' && longues.length > 0);
  const longues = new Array(taches.length).fill(null);
  if (aRejouer.length > 0) {
    const utiles = epreuvesLongues.filter((t) => aRejouer.some((tache) => tache.longues.includes(t)));
    journal(`série longue : ligne de base, ${utiles.length} épreuves`);
    const baseLongue = await ligneDeBase(racine, utiles, 'la série longue du périmètre');
    const delaiLong = Math.max(DELAI_MIN_MS, FACTEUR_DELAI * baseLongue);
    const rejeux = await enParallele(
      aRejouer,
      largeur,
      async ({ mutant, longues: tests }) => (await executerMutant({ mutant, tests, delaiMs: delaiLong, racine })).issue,
      { arreter, signaler: avancement('survivants rejoués', journal) },
    );
    aRejouer.forEach(({ rang }, i) => {
      longues[rang] = rejeux[i];
    });
  }

  const cles = new Set(taches.map(({ mutant }) => mutant.cle));
  for (const cle of [...equivalents.keys()].sort(comparer)) {
    if (!cles.has(cle)) journal(`équivalence sans mutant (source changé ?) : ${cle}`);
  }
  // Une déclaration d'équivalence ne vaut que pour un survivant que la série
  // longue ne tue pas : un mutant qu'une épreuve tue change quelque chose.
  const resultats = taches.map(({ mutant }, rang) => {
    const issue = issues[rang];
    const longue = longues[rang];
    const declare = equivalents.get(mutant.cle) ?? null;
    const survit = issue === 'survivant' && longue !== 'tue';
    if (declare !== null && !survit) journal(`déclaré équivalent, pourtant ${longue === 'tue' ? 'tué par la série longue' : issue} : ${mutant.cle}`);
    return {
      mutant,
      issue,
      couverte: couvertes.get(mutant.fichier)?.has(mutant.ligne) ?? false,
      longue,
      equivalent: survit ? declare : null,
    };
  });

  // Un fichier ajouté ou retiré change aussi l'empreinte : le chemin de
  // chacun y entre.
  if (empreinteDe(racine, fichiersDuPerimetre(racine)) !== empreinte) {
    throw new AuditImpossible(`sources changées pendant l’audit sous ${PERIMETRE.join(', ')} : l’empreinte ne désignerait pas les sources mutées`);
  }
  const { markdown, json } = rediger({ entete, resultats });
  mkdirSync(join(racine, 'audit'), { recursive: true });
  writeFileSync(join(racine, SORTIES.markdown), markdown);
  writeFileSync(join(racine, SORTIES.json), json);
  return { bilan: JSON.parse(json).bilan, dureeMs: performance.now() - debut };
}

// En ligne de commande. Un premier SIGINT ou SIGTERM n'envoie plus de
// mutant et laisse finir ceux en cours, chacun borné par son délai, puis
// sort en 2 sans rien écrire : interrompre l'audit d'un coup laisserait
// vivre les groupes de processus détachés qu'executer.js lance. Un second
// signal sort sur-le-champ.
async function principal() {
  let arret = false;
  const demander = () => {
    if (arret) process.exit(SORTIE_NE_MESURE_PAS);
    arret = true;
    process.stderr.write('arrêt demandé : les mutants en cours finissent, au plus leur délai\n');
  };
  process.on('SIGINT', demander);
  process.on('SIGTERM', demander);
  try {
    const { bilan, dureeMs } = await auditer({ arreter: () => arret });
    process.stderr.write(
      `audit écrit : ${SORTIES.markdown}, ${SORTIES.json} — ${bilan.total} mutants, ${bilan.tues} tués, ` +
        `${bilan.tuesSerieLongue} tués par la série longue, ${bilan.survivants} survivants, ` +
        `${bilan.equivalents} équivalents, ${bilan.delais} délais, ` +
        `${bilan.erreurs} erreurs, en ${(dureeMs / 60_000).toFixed(1)} min\n`,
    );
    process.exitCode = 0;
  } catch (erreur) {
    const raison = erreur instanceof AuditImpossible ? erreur.message : (erreur?.stack ?? String(erreur));
    process.stderr.write(`l’audit ne mesure pas : ${raison}\n`);
    process.exitCode = SORTIE_NE_MESURE_PAS;
  }
}

if (process.argv[1] !== undefined && pathToFileURL(realpathSync(process.argv[1])).href === import.meta.url) {
  await principal();
}
