// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le résultat écrit de l'audit par mutation (§ 14.13) : rediger compose le
// Markdown et le JSON que audit.js écrit sous audit/, versionnés ; relire
// recompose le Markdown du seul JSON écrit, par la même composition ;
// equivalentsDe lit audit/mutants-equivalents.json. Fonctions pures et
// déterministes : elles reçoivent des textes, ne lisent aucun fichier ni
// horloge, et la sortie de rediger ne dépend pas de l'ordre des résultats
// reçus.
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
// affirmer, ce que l'audit est là pour désigner. Un survivant de la série
// node se rejoue contre les épreuves longues qui atteignent son module avant
// d'être compté : tué par elles, il n'est pas un survivant, et se compte et
// se liste à part, dans sa colonne. Un survivant que
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
  if (equivalent !== null && !(issue === 'survivant' && longue !== 'tue' && typeof equivalent === 'string' && equivalent !== '')) {
    throw new TypeError(`${ici} : équivalent, une raison non vide pour un survivant seul, que la série longue ne tue pas ; null sinon`);
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

// La colonne de comptes où tombe un résultat. Un survivant de la série node
// que la série longue tue n'est pas un survivant (§ 14.13) ; un survivant
// qu'elle laisse vivre, ou qu'elle ne rejoue pas, en reste un, ou un
// équivalent déclaré.
const colonneDe = (r) =>
  r.issue === 'tue'
    ? 'tues'
    : r.issue === 'delai'
      ? 'delais'
      : r.issue === 'erreur'
        ? 'erreurs'
        : r.longue === 'tue'
          ? 'tuesSerieLongue'
          : r.equivalent === null
            ? 'survivants'
            : 'equivalents';

// Les colonnes de comptes, dans l'ordre du JSON et des tableaux.
const COLONNES = ['total', 'tues', 'tuesSerieLongue', 'survivants', 'equivalents', 'delais', 'erreurs'];
const compteVide = () => Object.fromEntries(COLONNES.map((colonne) => [colonne, 0]));

function compter(liste) {
  const compte = compteVide();
  for (const r of liste) {
    compte.total += 1;
    compte[colonneDe(r)] += 1;
  }
  return compte;
}

const ENTETES_COLONNES = '| total | tués | tués par la série longue | survivants | équivalents | délais | erreurs |';
const ALIGNEMENT_COMPTES = COLONNES.map(() => '---:').join('|');
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

// Les champs d'une entrée de la liste des survivants, et de celle des tués
// par la série longue.
const vivantEcrit = (r) => ({ ...mutantEcrit(r), couverte: r.couverte, longue: r.longue });

// Une ligne de liste du Markdown : lieu, opérateur, avant, après, puis les
// cellules propres à la liste.
const ligneDeListe = (r, ...suite) =>
  `| ${lieu(r)} | ${r.operateur} | ${cellule(r.original)} | ${cellule(r.remplacement)} | ${suite.join(' | ')} |`;

// Une section du Markdown : son titre, puis « Aucun. » ou le tableau.
const section = (titre, introduction, liste, entete, ligne) => [
  `## ${titre}`,
  '',
  ...introduction,
  ...(liste.length === 0
    ? ['Aucun.']
    : [`| lieu | opérateur | avant | après | ${entete.join(' | ')} |`, `|---|---|---|---|${entete.map(() => '---').join('|')}|`, ...liste.map(ligne)]),
  '',
];

// Le Markdown d'un audit, composé de ses données, celles que le JSON porte :
// rediger et relire en tirent le même texte.
function composer(donnees) {
  const { entete: tete, bilan, parFichier, parOperateur, survivants, tuesSerieLongue, equivalents, delaisEtErreurs } = donnees;
  const longueLue = (r) => (r.longue === null ? '—' : ISSUE_LUE[r.longue]);
  return [
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
    'Un survivant se rejoue contre les épreuves longues qui atteignent son module avant d’être compté : tué par elles, il se compte à part.',
    'Un survivant sur une ligne couverte désigne une épreuve qui exécute sans affirmer.',
    '',
    '## Bilan',
    '',
    ENTETES_COLONNES.replace('| total', '| mutants'),
    `|${ALIGNEMENT_COMPTES}|`,
    ligneComptes(null, bilan),
    '',
    '## Par fichier',
    '',
    `| fichier ${ENTETES_COLONNES}`,
    `|---|${ALIGNEMENT_COMPTES}|`,
    ...parFichier.map((c) => ligneComptes(`\`${c.fichier}\``, c)),
    '',
    '## Par opérateur',
    '',
    `| opérateur ${ENTETES_COLONNES}`,
    `|---|${ALIGNEMENT_COMPTES}|`,
    ...parOperateur.map((c) => ligneComptes(c.operateur, c)),
    '',
    ...section(`Survivants (${survivants.length}), lignes couvertes d’abord`, [], survivants, ['ligne couverte', 'série longue'], (r) =>
      ligneDeListe(r, r.couverte ? 'oui' : 'non', longueLue(r)),
    ),
    ...section(
      `Tués par la série longue (${tuesSerieLongue.length})`,
      ['Survivants de la série node que les épreuves longues tuent : la série node exécute leur ligne sans l’affirmer.', ''],
      tuesSerieLongue,
      ['ligne couverte'],
      (r) => ligneDeListe(r, r.couverte ? 'oui' : 'non'),
    ),
    ...section(
      `Mutants équivalents (${equivalents.length})`,
      ['Déclarés dans `audit/mutants-equivalents.json`, avec leur raison.', ''],
      equivalents,
      ['raison'],
      (r) => ligneDeListe(r, r.raison.replace(/\s+/g, ' ').replaceAll('|', '\\|')),
    ),
    ...section(`Délais et erreurs (${delaisEtErreurs.length})`, [], delaisEtErreurs, ['issue'], (r) => ligneDeListe(r, ISSUE_LUE[r.issue])),
  ].join('\n');
}

const enJson = (donnees) => `${JSON.stringify(donnees, null, 2)}\n`;

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
  const dans = (colonne) => lus.filter((r) => colonneDe(r) === colonne);

  const donnees = {
    format: 1,
    entete: tete,
    bilan: compter(lus),
    parFichier,
    parOperateur,
    survivants: dans('survivants').map(vivantEcrit),
    tuesSerieLongue: dans('tuesSerieLongue').map(vivantEcrit),
    equivalents: dans('equivalents').map((r) => ({ ...mutantEcrit(r), raison: r.equivalent })),
    delaisEtErreurs: lus.filter((r) => r.issue === 'delai' || r.issue === 'erreur').map((r) => ({ ...mutantEcrit(r), issue: r.issue })),
  };
  return { markdown: composer(donnees), json: enJson(donnees) };
}

// Les clés du JSON écrit, dans son ordre.
const CLES_DONNEES = ['format', 'entete', 'bilan', 'parFichier', 'parOperateur', 'survivants', 'tuesSerieLongue', 'equivalents', 'delaisEtErreurs'];

// Lève quand les comptes d'une ligne ne sont pas ceux de COLONNES, entiers
// positifs ou nuls, dont le total est la somme des autres.
function verifierComptes(compte, ici) {
  const ecarts =
    compte === null ||
    typeof compte !== 'object' ||
    COLONNES.some((c) => !Number.isInteger(compte[c]) || compte[c] < 0) ||
    COLONNES.slice(1).reduce((somme, c) => somme + compte[c], 0) !== compte.total;
  if (ecarts) throw new TypeError(`${ici} : comptes ${COLONNES.join(', ')} attendus, le total égal à la somme des autres`);
}

// Lève quand les lignes ne somment pas, colonne par colonne, au bilan.
function verifierSommes(lignes, bilan, ici) {
  if (!Array.isArray(lignes)) throw new TypeError(`${ici} : liste attendue`);
  lignes.forEach((ligne, rang) => verifierComptes(ligne, `${ici}, ligne ${rang + 1}`));
  for (const colonne of COLONNES) {
    if (lignes.reduce((somme, ligne) => somme + ligne[colonne], 0) !== bilan[colonne]) {
      throw new TypeError(`${ici} : la colonne ${colonne} ne somme pas au bilan`);
    }
  }
}

/**
 * Relit le JSON qu'a écrit rediger et en recompose le Markdown, par la même
 * composition. Lève une TypeError sur un texte que rediger n'écrit pas : une
 * autre mise en forme ou d'autres clés, un en-tête que verifierEntete
 * refuse, des comptes qui contredisent les listes, ou un survivant que la
 * série longue tue, laissé parmi les survivants.
 * @param {string} json  le texte de audit/mutation-moteur.json
 * @returns {{donnees: object, markdown: string}}
 */
export function relire(json) {
  let donnees;
  try {
    donnees = JSON.parse(json);
  } catch (erreur) {
    throw new TypeError(`JSON illisible : ${erreur.message}`);
  }
  if (typeof donnees !== 'object' || donnees === null || enJson(donnees) !== json || Object.keys(donnees).join() !== CLES_DONNEES.join()) {
    throw new TypeError(`autre forme que celle que rediger écrit : ${CLES_DONNEES.join(', ')}, indentées de deux espaces`);
  }
  if (donnees.format !== 1) throw new TypeError(`format ${String(donnees.format)} : 1 attendu`);
  const tete = verifierEntete(donnees.entete);
  if (enJson(tete) !== enJson(donnees.entete)) throw new TypeError('en-tête : autres champs ou autre ordre que ceux de verifierEntete');
  const { bilan, survivants, tuesSerieLongue, equivalents, delaisEtErreurs } = donnees;
  verifierComptes(bilan, 'bilan');
  verifierSommes(donnees.parFichier, bilan, 'par fichier');
  verifierSommes(donnees.parOperateur, bilan, 'par opérateur');
  const listes = [
    ['survivants', survivants, bilan.survivants],
    ['tuesSerieLongue', tuesSerieLongue, bilan.tuesSerieLongue],
    ['equivalents', equivalents, bilan.equivalents],
    ['delaisEtErreurs', delaisEtErreurs, bilan.delais + bilan.erreurs],
  ];
  for (const [nom, liste, compte] of listes) {
    if (!Array.isArray(liste) || liste.length !== compte) throw new TypeError(`bilan : ${compte} attendus dans ${nom}`);
  }
  const lieuLu = (r) => `${r.fichier}:${r.ligne}:${r.colonne}`;
  const tueParLaLongue = survivants.find((r) => r.longue === 'tue');
  if (tueParLaLongue !== undefined) {
    throw new TypeError(`un survivant que la série longue tue, laissé parmi les survivants : ${lieuLu(tueParLaLongue)}`);
  }
  const autre = tuesSerieLongue.find((r) => r.longue !== 'tue');
  if (autre !== undefined) throw new TypeError(`tuesSerieLongue : un mutant que la série longue ne tue pas, ${lieuLu(autre)}`);
  return { donnees, markdown: composer(donnees) };
}

const FORME_EQUIVALENTS = 'liste de { cle, raison }';

/**
 * Les équivalences déclarées dans audit/mutants-equivalents.json : chaque
 * clé vers sa raison, dans l'ordre du fichier. Lève une TypeError sur un
 * texte illisible, une autre forme qu'une liste de { cle, raison } — deux
 * chaînes non vides —, une clé en double, et une raison qui porte un chemin
 * de compte, que rediger refuserait après l'audit entier.
 * @param {string} texte
 * @returns {Map<string, string>}
 */
export function equivalentsDe(texte) {
  let liste;
  try {
    liste = JSON.parse(texte);
  } catch (erreur) {
    throw new TypeError(`illisible : ${erreur.message}`);
  }
  if (!Array.isArray(liste)) throw new TypeError(`${FORME_EQUIVALENTS} attendue`);
  const equivalents = new Map();
  liste.forEach((entree, rang) => {
    if (typeof entree !== 'object' || entree === null || Array.isArray(entree)) throw new TypeError(`${FORME_EQUIVALENTS} attendue, rang ${rang + 1}`);
    const { cle, raison } = entree;
    if (typeof cle !== 'string' || cle === '') throw new TypeError(`${FORME_EQUIVALENTS}, clé vide ou absente au rang ${rang + 1}`);
    if (typeof raison !== 'string' || raison === '') throw new TypeError(`${FORME_EQUIVALENTS}, raison vide pour ${cle}`);
    if (equivalents.has(cle)) throw new TypeError(`${FORME_EQUIVALENTS}, clé en double : ${cle}`);
    sansCompte(raison, `la raison de ${cle}`);
    equivalents.set(cle, raison);
  });
  return equivalents;
}
