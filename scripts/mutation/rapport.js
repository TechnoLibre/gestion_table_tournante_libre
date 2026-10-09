// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le résultat écrit de l'audit par mutation (§ 14.13) : rediger compose le
// Markdown et le JSON que audit.js écrit sous audit/, versionnés. Fonction
// pure et déterministe : ni lecture de fichier ni horloge, et la sortie ne
// dépend pas de l'ordre des résultats reçus.
//
// Un rapport ne nomme pas sa machine (§ 19.10) : son en-tête est une liste
// fermée de champs, chacun d'une forme stricte — la version, le périmètre en
// chemins relatifs, l'empreinte des sources, la version de Node —, et rien
// n'y porte un nom d'hôte, un chemin de compte ni une date. Les durées ne
// s'y écrivent pas : elles dépendent de la machine. Un en-tête ou un
// résultat d'une autre forme lève, rien n'est écrit.
//
// Les survivants sur une ligne couverte viennent en tête : une épreuve qui
// exécute la ligne sans que la mutation la fasse échouer exécute sans
// affirmer, ce que l'audit est là pour désigner. Un survivant que
// audit/mutants-equivalents.json déclare équivalent se compte et se liste à
// part, avec sa raison.
import { deriver } from '../version.js';
import { OPERATEURS } from './mutants.js';

/**
 * @typedef {'tue'|'survivant'|'delai'|'erreur'} Issue
 * @typedef {Object} Entete
 * @property {string} version     forme affichée de version.json, que deriver de scripts/version.js admet
 * @property {string[]} perimetre  dossiers mutés, relatifs à la racine
 * @property {string} empreinte   SHA-256 hexadécimal des sources du périmètre et de leurs épreuves
 * @property {string} node        process.version, préversion comprise
 * @typedef {Object} Resultat
 * @property {import('./mutants.js').Mutant} mutant
 * @property {Issue} issue          contre la série du périmètre, sous node --test
 * @property {boolean} couverte     la ligne du mutant est exécutée par cette série
 * @property {Issue|null} longue    issue du rejeu d'un survivant contre les
 *                                  .long.test.js qui atteignent son module ;
 *                                  null quand il n'est pas rejoué
 * @property {string|null} equivalent  la raison, pour un survivant déclaré équivalent
 */

const ISSUES = ['tue', 'survivant', 'delai', 'erreur'];
const CHAMPS_ENTETE = ['version', 'perimetre', 'empreinte', 'node'];

// Les champs d'en-tête qui désignent l'hôte, son utilisateur ou un instant :
// leur présence dit pourquoi l'en-tête est refusé. Un nom se lit en
// minuscules, sans tiret ni tiret bas.
const CHAMP_IDENTIFIANT = /host|hote|machine|computer|poste|user|utilisateur|compte|login|date|instant|horodatage|timestamp/;

// Un chemin de compte : le dossier personnel sous Linux (/home/x), sous macOS
// (/Users/x), celui de root, le profil sous Windows (C:\Users\x).
const CHEMIN_DE_COMPTE = /\/(?:home|Users)\/[^/\s]+|\/root(?:\/|$)|[A-Za-z]:[\\/](?:Users|Documents and Settings)[\\/]/i;

const MACHINE = 'un rapport ne nomme pas sa machine';

// La version de Node admet un suffixe de préversion (-rc.1, -pre) fait de
// lettres, de chiffres et de points : ni blanc ni barre oblique, donc ni hôte
// ni chemin.
const FORMES_ENTETE = {
  empreinte: [/^[0-9a-f]{64}$/, '64 chiffres hexadécimaux'],
  node: [/^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.]+)?$/, 'vX.Y.Z, suivi ou non de -préversion'],
};

// Un chemin relatif, en barres obliques : ni racine, ni lecteur, ni
// segment « .. », ni blanc.
const estRelatif = (chemin) =>
  typeof chemin === 'string' &&
  /^[^/\\\s:][^\\\s:]*$/.test(chemin) &&
  !chemin.split('/').some((segment) => segment === '..' || segment === '' || segment === '.');

// Lève quand le texte porte un chemin de compte.
function sansCompte(texte, champ) {
  if (typeof texte === 'string' && CHEMIN_DE_COMPTE.test(texte)) {
    throw new TypeError(`${MACHINE} : chemin de compte dans ${champ}`);
  }
}

/**
 * L'en-tête validé, recopié dans l'ordre de CHAMPS_ENTETE. Lève une
 * TypeError sur un en-tête qui nomme la machine ou n'a pas la forme de
 * Entete ; la version se juge par deriver de scripts/version.js, seule
 * autorité de sa forme (§ 13.2). audit.js l'appelle avant de mesurer, rediger
 * à nouveau avant d'écrire.
 * @param {Entete} entete
 * @returns {Entete}
 */
export function verifierEntete(entete) {
  if (typeof entete !== 'object' || entete === null || Array.isArray(entete)) {
    throw new TypeError('en-tête attendu : { version, perimetre, empreinte, node }');
  }
  const cles = Object.keys(entete).sort();
  for (const cle of cles) {
    if (CHAMP_IDENTIFIANT.test(cle.toLowerCase().replace(/[-_]/g, ''))) {
      throw new TypeError(`${MACHINE} : champ ${cle} refusé`);
    }
  }
  for (const cle of cles) {
    if (!CHAMPS_ENTETE.includes(cle)) {
      throw new TypeError(`${MACHINE} : champ ${cle} hors de l'en-tête (${CHAMPS_ENTETE.join(', ')})`);
    }
  }
  const { perimetre } = entete;
  if (!Array.isArray(perimetre) || perimetre.length === 0) {
    throw new TypeError('en-tête : perimetre, liste non vide de chemins relatifs attendue');
  }
  for (const dossier of perimetre) {
    sansCompte(dossier, 'perimetre');
    if (!estRelatif(dossier)) throw new TypeError(`en-tête : perimetre, chemin relatif attendu, reçu ${String(dossier)}`);
  }
  sansCompte(entete.version, 'version');
  try {
    deriver(entete.version);
  } catch (erreur) {
    throw new TypeError(`en-tête : version, ${erreur.message} ; ${MACHINE}, aucun autre texte n'y entre`);
  }
  for (const [champ, [forme, attendu]] of Object.entries(FORMES_ENTETE)) {
    const valeur = entete[champ];
    sansCompte(valeur, champ);
    if (typeof valeur !== 'string' || !forme.test(valeur)) {
      throw new TypeError(`en-tête : ${champ}, ${attendu} attendu ; ${MACHINE}, aucun autre texte n'y entre`);
    }
  }
  return { version: entete.version, perimetre: [...perimetre], empreinte: entete.empreinte, node: entete.node };
}

const estEntierPositif = (n) => Number.isInteger(n) && n > 0;

// Le résultat validé, réduit à ce que le rapport écrit.
function verifierResultat(resultat, rang) {
  const ici = `résultat ${rang}`;
  if (typeof resultat !== 'object' || resultat === null) throw new TypeError(`${ici} : objet attendu`);
  const { mutant, issue, couverte, longue, equivalent } = resultat;
  if (typeof mutant !== 'object' || mutant === null) throw new TypeError(`${ici} : mutant attendu`);
  const { cle, fichier, ligne, colonne, operateur, original, remplacement } = mutant;
  if (typeof cle !== 'string' || cle === '') throw new TypeError(`${ici} : clé non vide attendue`);
  sansCompte(fichier, `${ici}, fichier`);
  sansCompte(cle, `${ici}, clé`);
  if (!estRelatif(fichier)) throw new TypeError(`${ici} : chemin relatif attendu, reçu ${String(fichier)}`);
  if (!estEntierPositif(ligne)) throw new TypeError(`${ici} : ligne, entier ≥ 1 attendu`);
  if (!estEntierPositif(colonne)) throw new TypeError(`${ici} : colonne, entier ≥ 1 attendu`);
  if (!OPERATEURS.includes(operateur)) throw new TypeError(`${ici} : opérateur inconnu ${String(operateur)}`);
  if (typeof original !== 'string' || typeof remplacement !== 'string') {
    throw new TypeError(`${ici} : original et remplacement, deux chaînes attendues`);
  }
  if (!ISSUES.includes(issue)) throw new TypeError(`${ici} : issue inconnue ${String(issue)}`);
  if (typeof couverte !== 'boolean') throw new TypeError(`${ici} : couverte, booléen attendu`);
  if (longue !== null && !(issue === 'survivant' && ISSUES.includes(longue))) {
    throw new TypeError(`${ici} : série longue, une issue pour un survivant seul, null sinon`);
  }
  if (equivalent !== null && !(issue === 'survivant' && typeof equivalent === 'string' && equivalent !== '')) {
    throw new TypeError(`${ici} : équivalent, une raison non vide pour un survivant seul, null sinon`);
  }
  sansCompte(equivalent, `${ici}, équivalent`);
  return { cle, fichier, ligne, colonne, operateur, original, remplacement, issue, couverte, longue, equivalent };
}

// Comparaison par unités de code : l'ordre ne dépend d'aucune locale.
const comparer = (a, b) => (a < b ? -1 : a > b ? 1 : 0);

// Survivants couverts d'abord, puis fichier, ligne, colonne, rang de
// l'opérateur, clé : un ordre total, la clé étant unique.
function comparerLieux(a, b) {
  return (
    Number(b.couverte) - Number(a.couverte) ||
    comparer(a.fichier, b.fichier) ||
    a.ligne - b.ligne ||
    a.colonne - b.colonne ||
    OPERATEURS.indexOf(a.operateur) - OPERATEURS.indexOf(b.operateur) ||
    comparer(a.cle, b.cle)
  );
}

// La colonne de comptes où tombe un résultat.
const colonneDe = (r) =>
  r.issue === 'tue'
    ? 'tues'
    : r.issue === 'delai'
      ? 'delais'
      : r.issue === 'erreur'
        ? 'erreurs'
        : r.equivalent === null
          ? 'survivants'
          : 'equivalents';

const compteVide = () => ({ total: 0, tues: 0, survivants: 0, equivalents: 0, delais: 0, erreurs: 0 });

function compter(liste) {
  const compte = compteVide();
  for (const r of liste) {
    compte.total += 1;
    compte[colonneDe(r)] += 1;
  }
  return compte;
}

const COLONNES = ['total', 'tues', 'survivants', 'equivalents', 'delais', 'erreurs'];
const ENTETES_COLONNES = '| total | tués | survivants | équivalents | délais | erreurs |';
const ligneComptes = (tete, compte) => `| ${tete === null ? '' : `${tete} | `}${COLONNES.map((c) => compte[c]).join(' | ')} |`;

// Le texte d'un nœud dans une cellule : blancs ramenés à une espace, au plus
// LONGUEUR_CELLULE points de code, « | » échappé pour le tableau, entre des
// accents graves plus nombreux que la plus longue suite qu'il contient.
const LONGUEUR_CELLULE = 60;
function cellule(code) {
  const plat = code.replace(/\s+/g, ' ').trim();
  if (plat === '') return '(vide)';
  const points = [...plat];
  const court = points.length > LONGUEUR_CELLULE ? `${points.slice(0, LONGUEUR_CELLULE - 1).join('')}…` : plat;
  const echappe = court.replaceAll('|', '\\|');
  const suite = Math.max(0, ...[...echappe.matchAll(/`+/g)].map(([s]) => s.length));
  const garde = '`'.repeat(suite + 1);
  return suite === 0 ? `${garde}${echappe}${garde}` : `${garde} ${echappe} ${garde}`;
}

const lieu = (r) => `\`${r.fichier}:${r.ligne}:${r.colonne}\``;
const ISSUE_LUE = { tue: 'tué', survivant: 'survit', delai: 'délai', erreur: 'erreur' };

// Chaque élément d'une liste du JSON, dans l'ordre de ses champs.
const mutantEcrit = (r) => ({
  cle: r.cle,
  fichier: r.fichier,
  ligne: r.ligne,
  colonne: r.colonne,
  operateur: r.operateur,
  original: r.original,
  remplacement: r.remplacement,
});

/**
 * Le rapport d'un audit, en Markdown et en JSON, déterministe.
 * Lève sur des résultats vides — un audit qui n'a rien mesuré n'a rien à
 * écrire (§ 14.2) —, sur un en-tête qui nomme la machine ou n'a pas la forme
 * de Entete, et sur un résultat d'une autre forme que Resultat ou dont la
 * clé revient.
 * @param {{entete: Entete, resultats: Resultat[]}} demande
 * @returns {{markdown: string, json: string}}
 */
export function rediger({ entete, resultats } = {}) {
  if (!Array.isArray(resultats) || resultats.length === 0) {
    throw new RangeError('aucun résultat : un audit qui ne mesure rien ne s’écrit pas');
  }
  const tete = verifierEntete(entete);
  const lus = resultats.map(verifierResultat).sort(comparerLieux);
  const cles = new Set();
  for (const r of lus) {
    if (cles.has(r.cle)) throw new TypeError(`clé en double : ${r.cle}`);
    cles.add(r.cle);
  }

  const fichiers = [...new Set(lus.map((r) => r.fichier))].sort(comparer);
  const parFichier = fichiers.map((fichier) => ({ fichier, ...compter(lus.filter((r) => r.fichier === fichier)) }));
  const parOperateur = OPERATEURS.filter((op) => lus.some((r) => r.operateur === op)).map((operateur) => ({
    operateur,
    ...compter(lus.filter((r) => r.operateur === operateur)),
  }));
  const bilan = compter(lus);
  const survivants = lus.filter((r) => colonneDe(r) === 'survivants');
  const equivalents = lus.filter((r) => colonneDe(r) === 'equivalents');
  const delaisEtErreurs = lus.filter((r) => r.issue === 'delai' || r.issue === 'erreur');

  const donnees = {
    format: 1,
    entete: tete,
    bilan,
    parFichier,
    parOperateur,
    survivants: survivants.map((r) => ({ ...mutantEcrit(r), couverte: r.couverte, longue: r.longue })),
    equivalents: equivalents.map((r) => ({ ...mutantEcrit(r), raison: r.equivalent })),
    delaisEtErreurs: delaisEtErreurs.map((r) => ({ ...mutantEcrit(r), issue: r.issue })),
  };

  const md = [
    '# Audit par mutation du moteur',
    '',
    'Écrit par `make mutation` (`scripts/mutation/audit.js`, § 14.13) ; ne se modifie pas à la main.',
    '',
    '| | |',
    '|---|---|',
    `| version | ${tete.version} |`,
    `| périmètre | ${tete.perimetre.map((d) => `\`${d}\``).join(', ')} |`,
    `| sources et épreuves du périmètre (SHA-256) | \`${tete.empreinte}\` |`,
    `| Node | ${tete.node} |`,
    '',
    'Chaque mutant se joue contre les épreuves de la série node qui atteignent son module, sous `node --test`.',
    'Un survivant sur une ligne couverte désigne une épreuve qui exécute sans affirmer.',
    '',
    '## Bilan',
    '',
    ENTETES_COLONNES.replace('| total', '| mutants'),
    '|---:|---:|---:|---:|---:|---:|',
    ligneComptes(null, bilan),
    '',
    '## Par fichier',
    '',
    `| fichier ${ENTETES_COLONNES}`,
    '|---|---:|---:|---:|---:|---:|---:|',
    ...parFichier.map((c) => ligneComptes(`\`${c.fichier}\``, c)),
    '',
    '## Par opérateur',
    '',
    `| opérateur ${ENTETES_COLONNES}`,
    '|---|---:|---:|---:|---:|---:|---:|',
    ...parOperateur.map((c) => ligneComptes(c.operateur, c)),
    '',
    `## Survivants (${survivants.length}), lignes couvertes d’abord`,
    '',
    ...(survivants.length === 0
      ? ['Aucun.']
      : [
          '| lieu | opérateur | avant | après | ligne couverte | série longue |',
          '|---|---|---|---|---|---|',
          ...survivants.map(
            (r) =>
              `| ${lieu(r)} | ${r.operateur} | ${cellule(r.original)} | ${cellule(r.remplacement)} | ${
                r.couverte ? 'oui' : 'non'
              } | ${r.longue === null ? '—' : ISSUE_LUE[r.longue]} |`,
          ),
        ]),
    '',
    `## Mutants équivalents (${equivalents.length})`,
    '',
    'Déclarés dans `audit/mutants-equivalents.json`, avec leur raison.',
    '',
    ...(equivalents.length === 0
      ? ['Aucun.']
      : [
          '| lieu | opérateur | avant | après | raison |',
          '|---|---|---|---|---|',
          ...equivalents.map(
            (r) =>
              `| ${lieu(r)} | ${r.operateur} | ${cellule(r.original)} | ${cellule(r.remplacement)} | ${r.equivalent
                .replace(/\s+/g, ' ')
                .replaceAll('|', '\\|')} |`,
          ),
        ]),
    '',
    `## Délais et erreurs (${delaisEtErreurs.length})`,
    '',
    ...(delaisEtErreurs.length === 0
      ? ['Aucun.']
      : [
          '| lieu | opérateur | avant | après | issue |',
          '|---|---|---|---|---|',
          ...delaisEtErreurs.map(
            (r) => `| ${lieu(r)} | ${r.operateur} | ${cellule(r.original)} | ${cellule(r.remplacement)} | ${ISSUE_LUE[r.issue]} |`,
          ),
        ]),
    '',
  ];

  return { markdown: md.join('\n'), json: `${JSON.stringify(donnees, null, 2)}\n` };
}
