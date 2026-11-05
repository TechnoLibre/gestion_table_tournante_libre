// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Gardes de l'audit par mutation (§ 14.13, § 14.4, § 14.14). L'audit est sa
// propre commande — make mutation, npm run mutation, scripts/mutation/audit.js —,
// hors des séries node et node-long : son coût est d'un autre ordre que leurs
// budgets. Son périmètre est le moteur seul. Ces gardes lisent audit.js, le
// Makefile et package.json comme du texte : aucun module n'importe audit.js,
// celui-ci compris, donc aucune épreuve des séries.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseAst } from 'vite';
import { describe, test } from '../../test/lanceur.js';
import { construireGraphe, grapheDuProjet } from './graphe.js';

const RACINE = fileURLToPath(new URL('../../', import.meta.url));
const AUDIT = 'scripts/mutation/audit.js';

// Le périmètre que déclare le source d'audit.js : les chaînes de
// « export const PERIMETRE = [...] » ou « Object.freeze([...]) ». null quand
// il ne le déclare pas ; lève quand la déclaration n'est pas une liste de
// chaînes littérales, qu'aucune garde ne saurait lire.
function perimetreDeclare(source) {
  for (const noeud of parseAst(source).body) {
    if (noeud.type !== 'ExportNamedDeclaration' || noeud.declaration?.type !== 'VariableDeclaration') continue;
    for (const { id, init } of noeud.declaration.declarations) {
      if (id.type !== 'Identifier' || id.name !== 'PERIMETRE') continue;
      const gele =
        init?.type === 'CallExpression' &&
        init.callee.type === 'MemberExpression' &&
        init.callee.object.name === 'Object' &&
        init.callee.property.name === 'freeze';
      const liste = gele ? init.arguments[0] : init;
      if (liste?.type !== 'ArrayExpression') throw new TypeError('PERIMETRE : liste littérale attendue');
      return liste.elements.map((element) => {
        if (element?.type !== 'Literal' || typeof element.value !== 'string') {
          throw new TypeError('PERIMETRE : chaînes littérales attendues');
        }
        return element.value;
      });
    }
  }
  return null;
}

// Le nom d'un appel ; celui d'enParallele porte sa largeur, son deuxième
// argument : « enParallele(1) » pour un littéral, « enParallele(largeur) »
// pour un identifiant, « enParallele(?) » pour toute autre expression.
function nomAppele({ callee, arguments: args }) {
  if (callee.name !== 'enParallele') return callee.name;
  const largeur = args[1];
  const lue = largeur?.type === 'Literal' ? String(largeur.value) : largeur?.type === 'Identifier' ? largeur.name : '?';
  return `enParallele(${lue})`;
}

// La fonction « nom » déclarée au niveau du module, exportée ou non ;
// undefined quand le source ne la déclare pas.
const declarationDe = (source, nom) =>
  parseAst(source)
    .body.map((noeud) => (noeud.type === 'ExportNamedDeclaration' ? noeud.declaration : noeud))
    .find((noeud) => noeud?.type === 'FunctionDeclaration' && noeud.id?.name === nom);

// Les nœuds de l'arbre syntaxique sous « racine », racine comprise, dans
// l'ordre du texte (un parent avant ses enfants à position égale), et le
// parent de chacun, null pour la racine. Un nœud partagé par deux champs,
// la clé et la valeur d'une propriété raccourcie, ne se compte qu'une fois.
function arbre(racine) {
  const noeuds = [];
  const parents = new Map();
  const parcourir = (noeud, parent) => {
    if (Array.isArray(noeud)) {
      noeud.forEach((element) => parcourir(element, parent));
      return;
    }
    if (typeof noeud !== 'object' || noeud === null || typeof noeud.type !== 'string' || parents.has(noeud)) return;
    parents.set(noeud, parent);
    noeuds.push(noeud);
    for (const cle of Object.keys(noeud).sort()) {
      if (cle !== 'type' && cle !== 'start' && cle !== 'end') parcourir(noeud[cle], noeud);
    }
  };
  parcourir(racine, null);
  return { noeuds: noeuds.sort((a, b) => a.start - b.start), parents };
}

// Les fonctions appelées par leur nom dans le corps de la fonction déclarée
// « nom », fonctions imbriquées comprises, dans l'ordre du texte, chacune
// nommée par nomAppele ; null quand le source ne déclare pas cette fonction
// au niveau du module.
function appelsDans(source, nom) {
  const declaration = declarationDe(source, nom);
  if (declaration === undefined) return null;
  return arbre(declaration.body)
    .noeuds.filter((noeud) => noeud.type === 'CallExpression' && noeud.callee.type === 'Identifier')
    .map(nomAppele);
}

// Les écarts de l'ordre des appels d'auditer : l'en-tête validé avant la
// ligne de base, l'empreinte prise avant elle et reprise après le dernier
// mutant, avant la première écriture. Une liste vide quand l'ordre tient.
function ecartsDeLOrdre(appels) {
  const premier = (nom) => appels.indexOf(nom);
  const dernier = (nom) => appels.lastIndexOf(nom);
  const base = premier('ligneDeBase');
  const ecarts = [];
  if (premier('verifierEntete') === -1 || premier('verifierEntete') > base) ecarts.push('en-tête validé après la ligne de base');
  if (premier('empreinteDe') === -1 || premier('empreinteDe') > base) ecarts.push('empreinte prise après la ligne de base');
  if (premier('empreinteDe') === dernier('empreinteDe') || dernier('empreinteDe') < dernier('executerMutant') || dernier('empreinteDe') > premier('writeFileSync')) {
    ecarts.push('empreinte non reprise entre le dernier mutant et l’écriture');
  }
  return ecarts;
}

// Les écarts du rejeu seul des délais déclarés équivalents, dans les appels
// d'auditer : la passe parallèle est le premier enParallele de largeur
// « largeur », le rejeu seul le premier enParallele de largeur 1, la ligne
// de base de la série longue le dernier ligneDeBase, la première étant
// celle de la série node. Le rejeu seul vient après la passe et avant cette ligne de
// base ; les délais à rejouer se choisissent entre la passe et le rejeu, par
// delaisARejouerSeuls ; le rejeu joue executerMutant ; issuesApresRejeu
// reporte les issues rejouées entre le rejeu et cette ligne de base. Une
// liste vide quand tout tient.
function ecartsDuRejeuSeul(appels) {
  const passe = appels.indexOf('enParallele(largeur)');
  const seul = appels.indexOf('enParallele(1)');
  if (seul === -1) return ['aucun rejeu de largeur 1'];
  const choix = appels.indexOf('delaisARejouerSeuls');
  const baseLongue = appels.lastIndexOf('ligneDeBase');
  const ecarts = [];
  if (passe === -1 || seul < passe) ecarts.push('rejeu seul avant la passe parallèle');
  if (choix === -1 || choix < passe || choix > seul) {
    ecarts.push('délais à rejouer non choisis entre la passe et le rejeu seul');
  }
  if (appels[seul + 1] !== 'executerMutant') ecarts.push('rejeu seul sans executerMutant');
  const report = appels.indexOf('issuesApresRejeu');
  if (report === -1 || report < seul || report > baseLongue) {
    ecarts.push('issues rejouées non reportées avant la ligne de base de la série longue');
  }
  if (baseLongue === appels.indexOf('ligneDeBase') || seul > baseLongue) {
    ecarts.push('rejeu seul après la ligne de base de la série longue');
  }
  return ecarts;
}

// Le câblage du rejeu seul dans auditer : chaque appel, le premier que
// nomAppele nomme ainsi, range son résultat dans la constante « recu » et lit,
// aux rangs donnés de ses arguments, les constantes nommées — celles des
// appels qui le précèdent, ou les équivalences déclarées.
const CABLAGE_DU_REJEU = Object.freeze([
  { appel: 'enParallele(largeur)', recu: 'paralleles', lus: [] },
  { appel: 'delaisARejouerSeuls', recu: 'seuls', lus: [[0, 'paralleles'], [1, 'taches'], [2, 'equivalents']] },
  { appel: 'enParallele(1)', recu: 'rejoues', lus: [[0, 'seuls']] },
  { appel: 'issuesApresRejeu', recu: 'issues', lus: [[0, 'paralleles'], [1, 'seuls'], [2, 'rejoues']] },
]);

// Les noms que lie un motif de déclaration ou de paramètre : un identifiant,
// ou ceux d'un motif d'objet ou de liste, valeurs par défaut et restes
// compris.
function liesPar(motif) {
  switch (motif?.type) {
    case 'Identifier':
      return [motif.name];
    case 'ObjectPattern':
      return motif.properties.flatMap((propriete) => liesPar(propriete.type === 'Property' ? propriete.value : propriete));
    case 'ArrayPattern':
      return motif.elements.flatMap(liesPar);
    case 'AssignmentPattern':
      return liesPar(motif.left);
    case 'RestElement':
      return liesPar(motif.argument);
    default:
      return [];
  }
}

const nomLu = (noeud) => (noeud?.type === 'Identifier' ? noeud.name : null);

// Vrai quand l'objet, ou le motif d'objet, porte « nom » en raccourci —
// { nom }, ni { nom: autre }, ni { autre: nom }, ni { nom = defaut }.
const reprendTelQuel = (objet, nom) =>
  objet?.properties?.some((p) => p.type === 'Property' && p.shorthand && p.key.name === nom && nomLu(p.value) === nom) ?? false;

// Un identifiant lu comme valeur : ni le nom que lie un déclarateur, ni le
// nom d'un membre (a.nom), ni la clé d'une propriété non raccourcie.
function estLu(noeud, parent) {
  if (parent?.type === 'VariableDeclarator' && parent.id === noeud) return false;
  if (parent?.type === 'MemberExpression' && parent.property === noeud && !parent.computed) return false;
  return !(parent?.type === 'Property' && parent.key === noeud && !parent.shorthand);
}

// Les écarts du câblage du rejeu seul dans auditer : CABLAGE_DU_REJEU tenu ;
// les issues de la passe parallèle lues seulement par le choix des délais et
// par le report ; le rejeu, une fonction d'un rang, reprend de taches[rang]
// le mutant et ses épreuves, passe à executerMutant ce mutant, ces épreuves
// et delaiMs, le délai de la passe, en raccourci, sans redéclarer aucun des
// trois ; le rejeu reçoit arreter tel quel et signale par avancement, comme
// la passe ; la ligne de journal qui compte les rejoués seuls ne s'imprime
// que sous « if (seuls.length > 0) ». Une liste vide quand tout tient.
function ecartsDuCablageDuRejeu(source) {
  const { noeuds, parents } = arbre(declarationDe(source, 'auditer').body);
  const premier = (nom) =>
    noeuds.find((n) => n.type === 'CallExpression' && n.callee.type === 'Identifier' && nomAppele(n) === nom);
  // La constante qui reçoit le résultat d'un appel, sous await ou non ; null
  // quand ce résultat ne va pas à une déclaration.
  const recuPar = (appel) => {
    const valeur = parents.get(appel)?.type === 'AwaitExpression' ? parents.get(appel) : appel;
    const declarateur = parents.get(valeur);
    return declarateur?.type === 'VariableDeclarator' && declarateur.init === valeur ? nomLu(declarateur.id) : null;
  };
  const ecarts = [];
  for (const { appel, recu, lus } of CABLAGE_DU_REJEU) {
    const noeud = premier(appel);
    if (noeud === undefined) {
      ecarts.push(`${appel} absent`);
      continue;
    }
    if (recuPar(noeud) !== recu) ecarts.push(`${appel} : reçu ailleurs que dans ${recu}`);
    for (const [rang, nom] of lus) {
      if (nomLu(noeud.arguments[rang]) !== nom) ecarts.push(`${appel} : argument ${rang + 1} autre que ${nom}`);
    }
  }
  const permises = new Set(['delaisARejouerSeuls', 'issuesApresRejeu'].map((nom) => premier(nom)?.arguments[0]));
  const lectures = noeuds.filter((n) => n.type === 'Identifier' && n.name === 'paralleles' && estLu(n, parents.get(n)));
  if (lectures.some((n) => !permises.has(n))) {
    ecarts.push('paralleles lu ailleurs qu’au choix des délais et au report des issues');
  }

  const options = premier('enParallele(1)')?.arguments[3];
  if (!reprendTelQuel(options, 'arreter')) ecarts.push('rejeu seul : arreter non passé tel quel à enParallele');
  const signaler = options?.properties?.find((p) => p.type === 'Property' && !p.computed && p.key.name === 'signaler');
  if (signaler?.value.type !== 'CallExpression' || nomLu(signaler.value.callee) !== 'avancement') {
    ecarts.push('rejeu seul : avancement non signalé');
  }
  const compte = noeuds.find(
    (n) =>
      n.type === 'CallExpression' &&
      nomLu(n.callee) === 'journal' &&
      n.arguments[0]?.type === 'TemplateLiteral' &&
      n.arguments[0].quasis.some((q) => q.value.cooked.includes('rejoués seuls')),
  );
  const instruction = compte && parents.get(compte);
  const condition = instruction && parents.get(instruction);
  const test = condition?.type === 'IfStatement' && condition.consequent === instruction ? condition.test : null;
  const sousSeuls =
    test?.type === 'BinaryExpression' &&
    test.operator === '>' &&
    test.left.type === 'MemberExpression' &&
    nomLu(test.left.object) === 'seuls' &&
    test.left.property.name === 'length' &&
    test.right.type === 'Literal' &&
    test.right.value === 0;
  if (!sousSeuls) ecarts.push('rejeu seul : compte des rejoués imprimé hors de « if (seuls.length > 0) »');

  const rejeu = premier('enParallele(1)')?.arguments[2];
  if (rejeu?.type !== 'ArrowFunctionExpression' && rejeu?.type !== 'FunctionExpression') {
    ecarts.push('rejeu seul : aucune fonction de rejeu');
    return ecarts;
  }
  const rang = nomLu(rejeu.params[0]);
  const interieur = arbre(rejeu.body).noeuds;
  const execution = interieur.find((n) => n.type === 'CallExpression' && nomLu(n.callee) === 'executerMutant');
  const reprise = interieur.find(
    (n) =>
      n.type === 'VariableDeclarator' &&
      n.init?.type === 'MemberExpression' &&
      n.init.computed &&
      nomLu(n.init.object) === 'taches' &&
      rang !== null &&
      nomLu(n.init.property) === rang,
  );
  const lies = [
    ...rejeu.params.flatMap(liesPar),
    ...interieur.flatMap((n) =>
      n.type === 'VariableDeclarator' ? liesPar(n.id) : /Function/.test(n.type) ? n.params.flatMap(liesPar) : [],
    ),
  ];
  for (const nom of ['mutant', 'tests', 'delaiMs']) {
    if (!reprendTelQuel(execution?.arguments[0], nom)) ecarts.push(`rejeu seul : ${nom} non passé tel quel à executerMutant`);
  }
  for (const nom of ['mutant', 'tests']) {
    if (!reprendTelQuel(reprise?.id, nom)) ecarts.push(`rejeu seul : ${nom} non repris de la tâche de son rang`);
  }
  for (const nom of ['mutant', 'tests', 'delaiMs']) {
    const permis = nom === 'delaiMs' ? 0 : 1;
    if (lies.filter((lie) => lie === nom).length > permis) ecarts.push(`rejeu seul : ${nom} redéclaré dans le rejeu`);
  }
  return ecarts;
}

// La cible nommée d'un Makefile : sa ligne de documentation (« ## … »), ses
// commandes (les lignes de recette qui la suivent, tabulation retirée) et sa
// déclaration .PHONY ; null quand le Makefile ne la porte pas.
function cibleDuMakefile(texte, nom) {
  const lignes = texte.split('\n');
  const rang = lignes.findIndex((ligne) => ligne.startsWith(`${nom}:`));
  if (rang === -1) return null;
  const documentation = /##\s*(.*)$/.exec(lignes[rang])?.[1] ?? null;
  const commandes = [];
  for (let i = rang + 1; i < lignes.length && lignes[i].startsWith('\t'); i += 1) commandes.push(lignes[i].slice(1));
  const factice = lignes.some((ligne) => /^\.PHONY:/.test(ligne) && ligne.slice('.PHONY:'.length).trim().split(/\s+/).includes(nom));
  return { documentation, commandes, factice };
}

// Les recettes de toutes les cibles d'un Makefile, { cible, commande }, dans
// l'ordre du texte.
function recettes(texte) {
  const sortie = [];
  let cible = null;
  for (const ligne of texte.split('\n')) {
    const tete = /^([A-Za-z0-9_.-]+):/.exec(ligne);
    if (tete !== null) cible = tete[1];
    else if (ligne.startsWith('\t') && cible !== null) sortie.push({ cible, commande: ligne.slice(1) });
  }
  return sortie;
}

// Écarts entre la couverture et l'audit : la mesure de la couverture garde
// une seule commande, npm run couverture lancé par make couverture, et la
// passe de couverture de l'audit, interne à audit.js, n'en devient pas une
// seconde. Relevés dans l'ordre : chaque script de package.json autre que
// couverture qui mesure (--coverage, --experimental-test-coverage), le script
// mutation qui ne lance pas audit.js seul ; chaque recette du Makefile hors de
// la cible couverture qui lance la mesure ou une passe de couverture.
function ecartsDeLaCouverture({ scripts, makefile }) {
  const ecarts = [];
  const MESURE = /--(?:experimental-test-)?coverage\b/;
  for (const nom of Object.keys(scripts).sort()) {
    if (nom !== 'couverture' && MESURE.test(scripts[nom])) ecarts.push(`npm run ${nom} : mesure la couverture`);
  }
  if (scripts.mutation !== 'node scripts/mutation/audit.js') ecarts.push('npm run mutation : ne lance pas audit.js seul');
  for (const { cible, commande } of recettes(makefile)) {
    if (cible !== 'couverture' && (MESURE.test(commande) || /npm run couverture\b/.test(commande))) {
      ecarts.push(`make ${cible} : lance une mesure de couverture`);
    }
  }
  return ecarts;
}

// Les modules du graphe qui importent la cible, triés. audit.js est un point
// d'entrée en ligne de commande : qu'aucun module ne l'importe garantit
// qu'aucune épreuve, de quelque série qu'elle soit, ne l'atteint par un
// module intermédiaire.
const importateursDe = (cible, graphe) =>
  [...graphe.keys()].filter((fichier) => graphe.get(fichier).includes(cible)).sort();

describe('audit par mutation : sa commande (§ 14.13)', () => {
  const { scripts = {} } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
  const makefile = readFileSync(join(RACINE, 'Makefile'), 'utf8');

  test('npm run mutation lance scripts/mutation/audit.js, et aucun autre script ne touche à l’audit', () => {
    assert.equal(scripts.mutation, 'node scripts/mutation/audit.js');
    const autres = Object.keys(scripts)
      .sort()
      .filter((nom) => nom !== 'mutation' && /mutation|audit\.js/.test(scripts[nom]));
    assert.deepEqual(autres, []);
  });

  test('make mutation lance npm run mutation, cible factice documentée', () => {
    assert.deepEqual(cibleDuMakefile(makefile, 'mutation'), {
      documentation: 'Audit par mutation du moteur, avant une livraison (§ 14.13)',
      commandes: ['$(AVEC_NODE) npm run mutation'],
      factice: true,
    });
  });

  test('la lecture du Makefile relève une cible absente, une recette autre, une cible non factice', () => {
    assert.equal(cibleDuMakefile('.PHONY: banc\nbanc:\n\t$(AVEC_NODE) npm run banc\n', 'mutation'), null);
    assert.deepEqual(cibleDuMakefile('.PHONY: test\nmutation: ## Audit\n\tnode scripts/mutation/audit.js\n\nx:\n\techo\n', 'mutation'), {
      documentation: 'Audit',
      commandes: ['node scripts/mutation/audit.js'],
      factice: false,
    });
  });
});

describe('audit par mutation : son périmètre, le moteur seul', () => {
  test('audit.js déclare exactement [src/moteur]', () => {
    assert.deepEqual(perimetreDeclare(readFileSync(join(RACINE, AUDIT), 'utf8')), ['src/moteur']);
  });

  test('la lecture du périmètre rend une liste élargie telle quelle, null sans déclaration, et refuse un calcul', () => {
    assert.deepEqual(perimetreDeclare("export const PERIMETRE = Object.freeze(['src/moteur', 'src/application']);\n"), [
      'src/moteur',
      'src/application',
    ]);
    assert.deepEqual(perimetreDeclare("export const PERIMETRE = ['src/verger'];\n"), ['src/verger']);
    assert.equal(perimetreDeclare("const PERIMETRE = ['src/moteur'];\nexport const AUTRE = 1;\n"), null);
    assert.throws(() => perimetreDeclare("const d = 'src';\nexport const PERIMETRE = [`${d}/moteur`];\n"), /chaînes littérales/);
    assert.throws(() => perimetreDeclare('export const PERIMETRE = lister();\n'), /liste littérale/);
  });
});

describe('audit par mutation : ce qu’il mesure est ce qu’il écrit', () => {
  test('auditer valide l’en-tête avant la ligne de base, et reprend l’empreinte des sources avant d’écrire', () => {
    const appels = appelsDans(readFileSync(join(RACINE, AUDIT), 'utf8'), 'auditer');
    assert.ok(appels.includes('ligneDeBase') && appels.includes('writeFileSync'), appels.join(', '));
    assert.deepEqual(ecartsDeLOrdre(appels), []);
  });

  test('la lecture des appels suit le texte, fonctions imbriquées comprises ; la garde relève chaque écart', () => {
    const source = 'export async function auditer() { a(); await b(c()); const f = () => d(); }\nfunction autre() { e(); }\n';
    assert.deepEqual(appelsDans(source, 'auditer'), ['a', 'b', 'c', 'd']);
    assert.equal(appelsDans(source, 'absente'), null);
    assert.deepEqual(ecartsDeLOrdre(['ligneDeBase', 'executerMutant', 'empreinteDe', 'verifierEntete', 'writeFileSync']), [
      'en-tête validé après la ligne de base',
      'empreinte prise après la ligne de base',
      'empreinte non reprise entre le dernier mutant et l’écriture',
    ]);
    assert.deepEqual(
      ecartsDeLOrdre(['empreinteDe', 'verifierEntete', 'ligneDeBase', 'executerMutant', 'writeFileSync', 'empreinteDe']),
      ['empreinte non reprise entre le dernier mutant et l’écriture'],
    );
    assert.deepEqual(
      ecartsDeLOrdre(['empreinteDe', 'verifierEntete', 'ligneDeBase', 'executerMutant', 'empreinteDe', 'writeFileSync']),
      [],
    );
  });
});

describe('audit par mutation : un délai déclaré équivalent se rejoue seul', () => {
  const source = readFileSync(join(RACINE, AUDIT), 'utf8');
  // Le bloc du rejeu seul, de son commentaire au remplacement des issues,
  // retiré du source puis replacé avant le marqueur donné.
  const deplace = (marqueur) => {
    const debut = source.indexOf('  // Un délai déclaré équivalent');
    const fin = source.indexOf('\n', source.indexOf('const issues = issuesApresRejeu(')) + 1;
    assert.ok(debut > 0 && fin > debut, 'bloc du rejeu seul trouvé');
    const reste = source.slice(0, debut) + source.slice(fin);
    assert.ok(reste.includes(marqueur), marqueur);
    return reste.replace(marqueur, `${source.slice(debut, fin)}${marqueur}`);
  };
  const ecartsDe = (texte) => {
    assert.notEqual(texte, source);
    return ecartsDuRejeuSeul(appelsDans(texte, 'auditer'));
  };

  test('auditer rejoue seuls les délais déclarés, largeur 1, après la passe parallèle et avant la ligne de base de la série longue', () => {
    const appels = appelsDans(source, 'auditer');
    assert.ok(appels.includes('enParallele(largeur)') && appels.includes('enParallele(1)'), appels.join(', '));
    assert.deepEqual(ecartsDuRejeuSeul(appels), []);
  });

  test('la lecture des appels porte la largeur d’enParallele', () => {
    const texte = 'export async function auditer() { enParallele(t, 1, f); enParallele(t, largeur, f); enParallele(t, n + 1, () => g()); }\n';
    assert.deepEqual(appelsDans(texte, 'auditer'), ['enParallele(1)', 'enParallele(largeur)', 'enParallele(?)', 'g']);
  });

  test('la garde relève, sur le source modifié en mémoire, une largeur autre, un choix absent, un autre exécutant, un report absent, un rejeu déplacé', () => {
    // Élargi, le rejeu seul des délais laisse pour premier enParallele(1)
    // celui de la série longue, qui suit sa ligne de base.
    assert.deepEqual(ecartsDe(source.replace(/(enParallele\(\s*seuls,\s*)1,/, '$1largeur,')), [
      'issues rejouées non reportées avant la ligne de base de la série longue',
      'rejeu seul après la ligne de base de la série longue',
    ]);
    assert.deepEqual(ecartsDe(source.replace('delaisARejouerSeuls(paralleles', 'rangsDe(paralleles')), [
      'délais à rejouer non choisis entre la passe et le rejeu seul',
    ]);
    assert.deepEqual(ecartsDe(source.replace(/(enParallele\(\s*seuls,[^]*?)executerMutant\(/, '$1executerSerie(')), [
      'rejeu seul sans executerMutant',
    ]);
    assert.deepEqual(ecartsDe(source.replace('issuesApresRejeu(paralleles', 'Array.of(paralleles')), [
      'issues rejouées non reportées avant la ligne de base de la série longue',
    ]);
    assert.deepEqual(ecartsDe(deplace('  const rejeux = await enParallele(')), [
      'issues rejouées non reportées avant la ligne de base de la série longue',
      'rejeu seul après la ligne de base de la série longue',
    ]);
    assert.deepEqual(ecartsDe(deplace('  const largeur = availableParallelism();')), [
      'rejeu seul avant la passe parallèle',
      'délais à rejouer non choisis entre la passe et le rejeu seul',
    ]);
  });

  test('auditer câble le rejeu seul : les issues de la passe ne vont qu’au choix et au report, le rejeu reprend les épreuves et le délai de la passe', () => {
    assert.deepEqual(ecartsDuCablageDuRejeu(source), []);
  });

  test('la garde du câblage relève, sur le source modifié en mémoire, un argument autre, un résultat ignoré, une lecture de la passe hors du report', () => {
    const modifie = (avant, apres) => {
      assert.ok(source.includes(avant), avant);
      return ecartsDuCablageDuRejeu(source.replace(avant, () => apres));
    };
    const LU_AILLEURS = 'paralleles lu ailleurs qu’au choix des délais et au report des issues';
    assert.deepEqual(modifie('issuesApresRejeu(paralleles, seuls, rejoues)', 'issuesApresRejeu(paralleles, [], [])'), [
      'issuesApresRejeu : argument 2 autre que seuls',
      'issuesApresRejeu : argument 3 autre que rejoues',
    ]);
    assert.deepEqual(modifie('paralleles, taches, equivalents)', 'paralleles, taches, new Map())'), [
      'delaisARejouerSeuls : argument 3 autre que equivalents',
    ]);
    assert.deepEqual(modifie('paralleles, taches, equivalents)', 'paralleles, taches.slice(1), equivalents)'), [
      'delaisARejouerSeuls : argument 2 autre que taches',
    ]);
    assert.deepEqual(modifie('paralleles, taches, equivalents)', 'paralleles, [...taches].reverse(), equivalents)'), [
      'delaisARejouerSeuls : argument 2 autre que taches',
    ]);
    assert.deepEqual(modifie("issues[rang] === 'survivant'", "paralleles[rang] === 'survivant'"), [LU_AILLEURS]);
    assert.deepEqual(modifie('const issue = issues[rang];', 'const issue = paralleles[rang];'), [LU_AILLEURS]);
    assert.deepEqual(modifie('const issue = issues[rang];', 'const issue = { paralleles: issues }.paralleles[rang];'), []);
    assert.deepEqual(modifie('const issue = issues[rang];', 'const issue = issues[rang] ?? seuls[paralleles];'), [LU_AILLEURS]);
    assert.deepEqual(modifie('const paralleles = await enParallele(', 'const passe = await enParallele('), [
      'enParallele(largeur) : reçu ailleurs que dans paralleles',
    ]);
    assert.deepEqual(modifie('enParallele(\n    seuls,', 'enParallele(\n    paralleles,'), [
      'enParallele(1) : argument 1 autre que seuls',
      LU_AILLEURS,
    ]);
    assert.deepEqual(
      modifie(
        'const issues = issuesApresRejeu(paralleles, seuls, rejoues);',
        'issuesApresRejeu(paralleles, seuls, rejoues);\n  const issues = paralleles;',
      ),
      ['issuesApresRejeu : reçu ailleurs que dans issues', LU_AILLEURS],
    );
  });

  test('la garde du câblage relève un rejeu qui ne reprend pas les épreuves, le mutant ou le délai de la passe', () => {
    const modifie = (avant, apres) => {
      assert.ok(source.includes(avant), avant);
      return ecartsDuCablageDuRejeu(source.replace(avant, () => apres));
    };
    const REPRISE = 'const { mutant, tests } = taches[rang];';
    assert.deepEqual(modifie(REPRISE, 'const { mutant, longues: tests } = taches[rang];'), [
      'rejeu seul : tests non repris de la tâche de son rang',
    ]);
    assert.deepEqual(modifie(REPRISE, 'const { mutant, tests } = taches[0];'), [
      'rejeu seul : mutant non repris de la tâche de son rang',
      'rejeu seul : tests non repris de la tâche de son rang',
    ]);
    assert.deepEqual(modifie(REPRISE, 'const { mutant, tests } = taches.rang;'), [
      'rejeu seul : mutant non repris de la tâche de son rang',
      'rejeu seul : tests non repris de la tâche de son rang',
    ]);
    assert.deepEqual(modifie(REPRISE, `${REPRISE}\n      const delaiMs = 1;`), ['rejeu seul : delaiMs redéclaré dans le rejeu']);
    const EXECUTION = 'return (await executerMutant({ mutant, tests, delaiMs, racine })).issue;';
    assert.deepEqual(modifie(EXECUTION, `{\n        const [tests] = [[]];\n        ${EXECUTION}\n      }`), [
      'rejeu seul : tests redéclaré dans le rejeu',
    ]);
    const DOUBLE = 'return (await executerMutant({ mutant, tests, delaiMs: delaiMs * 2, racine })).issue;';
    assert.deepEqual(modifie(EXECUTION, DOUBLE), [
      'rejeu seul : delaiMs non passé tel quel à executerMutant',
    ]);
    assert.deepEqual(modifie(EXECUTION, 'return (await executerMutant({ mutant, tests: [], delaiMs, racine })).issue;'), [
      'rejeu seul : tests non passé tel quel à executerMutant',
    ]);
  });

  test('la garde du câblage relève un rejeu sourd à l’arrêt, sans avancement, ou un compte imprimé sans condition', () => {
    const modifie = (avant, apres) => {
      assert.ok(source.includes(avant), avant);
      return ecartsDuCablageDuRejeu(source.replace(avant, () => apres));
    };
    const OPTIONS = "{ arreter, signaler: avancement('délais rejoués seuls', journal) }";
    assert.deepEqual(modifie(OPTIONS, "{ signaler: avancement('délais rejoués seuls', journal) }"), [
      'rejeu seul : arreter non passé tel quel à enParallele',
    ]);
    assert.deepEqual(modifie(OPTIONS, "{ arreter: () => false, signaler: avancement('délais rejoués seuls', journal) }"), [
      'rejeu seul : arreter non passé tel quel à enParallele',
    ]);
    assert.deepEqual(modifie(OPTIONS, '{ arreter }'), ['rejeu seul : avancement non signalé']);
    assert.deepEqual(modifie(OPTIONS, '{ arreter, signaler: journal }'), ['rejeu seul : avancement non signalé']);
    const SANS_CONDITION = 'rejeu seul : compte des rejoués imprimé hors de « if (seuls.length > 0) »';
    assert.deepEqual(modifie('if (seuls.length > 0) journal(', 'if (true) journal('), [SANS_CONDITION]);
    assert.deepEqual(modifie('if (seuls.length > 0) journal(', 'if (seuls.length >= 0) journal('), [SANS_CONDITION]);
    assert.deepEqual(modifie('if (seuls.length > 0) journal(', 'journal('), [SANS_CONDITION]);
  });

  test('la garde du câblage relève un nom redéclaré par un paramètre, une fonction imbriquée ou une valeur par défaut', () => {
    const modifie = (avant, apres) => {
      assert.ok(source.includes(avant), avant);
      return ecartsDuCablageDuRejeu(source.replace(avant, () => apres));
    };
    assert.deepEqual(modifie('async (rang) => {', 'async (rang, delaiMs) => {'), ['rejeu seul : delaiMs redéclaré dans le rejeu']);
    const EXECUTION = 'return (await executerMutant({ mutant, tests, delaiMs, racine })).issue;';
    assert.deepEqual(modifie(EXECUTION, `return ((tests) => executerMutant({ mutant, tests, delaiMs, racine }))([]).then((r) => r.issue);`), [
      'rejeu seul : tests redéclaré dans le rejeu',
    ]);
    assert.deepEqual(modifie(EXECUTION, `{\n        const { tests = [] } = {};\n        ${EXECUTION}\n      }`), [
      'rejeu seul : tests redéclaré dans le rejeu',
    ]);
  });

  test('la garde du câblage relève chaque appel absent', () => {
    assert.deepEqual(ecartsDuCablageDuRejeu('export async function auditer() { await enParallele(t, 1, rejeu); }\n'), [
      'enParallele(largeur) absent',
      'delaisARejouerSeuls absent',
      'enParallele(1) : reçu ailleurs que dans rejoues',
      'enParallele(1) : argument 1 autre que seuls',
      'issuesApresRejeu absent',
      'rejeu seul : arreter non passé tel quel à enParallele',
      'rejeu seul : avancement non signalé',
      'rejeu seul : compte des rejoués imprimé hors de « if (seuls.length > 0) »',
      'rejeu seul : aucune fonction de rejeu',
    ]);
  });
});

// Les écarts du rejeu seul des équivalents déclarés que la série longue tue,
// dans auditer : la ligne de base de la série longue est le dernier
// ligneDeBase, son rejeu parallèle le dernier enParallele(largeur), le rejeu
// seul le dernier enParallele(1). Le rejeu seul vient après le rejeu
// parallèle ; les rangs se choisissent entre les deux par
// tuesLongsARejouerSeuls, sur les issues longues, les tâches et les
// équivalences ; le rejeu joue executerMutant sous delaiLong, le délai de la
// série longue, contre les épreuves longues de la tâche. Une liste vide quand
// tout tient. Le câblage aussi : le choix va dans longsSeuls, le rejeu seul
// joue longsSeuls, reçoit arreter tel quel et range ses issues dans
// longsRejoues, que « longues[rang] = longsRejoues[i] » reporte dans les
// issues longues après le rejeu et avant le calcul des résultats.
function ecartsDuRejeuLongSeul(source) {
  const appels = appelsDans(source, 'auditer');
  const baseLongue = appels.lastIndexOf('ligneDeBase');
  const parallele = appels.lastIndexOf('enParallele(largeur)');
  const seul = appels.lastIndexOf('enParallele(1)');
  const choix = appels.indexOf('tuesLongsARejouerSeuls');
  const ecarts = [];
  if (parallele < baseLongue) ecarts.push('aucun rejeu parallèle après la ligne de base de la série longue');
  if (seul < parallele) ecarts.push('aucun rejeu seul après le rejeu parallèle de la série longue');
  if (choix === -1 || choix < parallele || choix > seul) {
    ecarts.push('tués à rejouer non choisis entre le rejeu parallèle et le rejeu seul');
  }
  if (appels[seul + 1] !== 'executerMutant') ecarts.push('rejeu long seul sans executerMutant');

  const { noeuds, parents } = arbre(declarationDe(source, 'auditer').body);
  const appel = (nom, rang) =>
    noeuds.filter((n) => n.type === 'CallExpression' && n.callee.type === 'Identifier' && nomAppele(n) === nom).at(rang);
  const arguments_ = appel('tuesLongsARejouerSeuls', 0)?.arguments.map(nomLu) ?? [];
  if (arguments_.join(', ') !== 'longues, taches, equivalents') {
    ecarts.push(`tuesLongsARejouerSeuls(${arguments_.join(', ')}) : longues, taches, equivalents attendus`);
  }
  const rejeu = appel('enParallele(1)', -1)?.arguments[2];
  const interieur = rejeu ? arbre(rejeu.body).noeuds : [];
  const execution = interieur.find((n) => n.type === 'CallExpression' && nomLu(n.callee) === 'executerMutant');
  const delai = execution?.arguments[0]?.properties?.find((p) => p.type === 'Property' && p.key.name === 'delaiMs');
  if (nomLu(delai?.value) !== 'delaiLong') ecarts.push('rejeu long seul : delaiMs autre que delaiLong');
  const reprise = interieur.find((n) => n.type === 'VariableDeclarator' && nomLu(n.init?.object) === 'taches');
  const epreuves = reprise?.id.properties?.find((p) => p.type === 'Property' && p.key.name === 'longues');
  if (nomLu(epreuves?.value) !== 'tests') ecarts.push('rejeu long seul : épreuves autres que les longues de la tâche');

  const recuPar = (noeud) => {
    const valeur = parents.get(noeud)?.type === 'AwaitExpression' ? parents.get(noeud) : noeud;
    const declarateur = parents.get(valeur);
    return declarateur?.type === 'VariableDeclarator' && declarateur.init === valeur ? nomLu(declarateur.id) : null;
  };
  const choisi = appel('tuesLongsARejouerSeuls', 0);
  if (choisi && recuPar(choisi) !== 'longsSeuls') ecarts.push('tuesLongsARejouerSeuls : reçu ailleurs que dans longsSeuls');
  const replay = appel('enParallele(1)', -1);
  if (nomLu(replay?.arguments[0]) !== 'longsSeuls') ecarts.push('rejeu long seul : autre liste que longsSeuls');
  if (!reprendTelQuel(replay?.arguments[3], 'arreter')) ecarts.push('rejeu long seul : arreter non passé tel quel à enParallele');
  if (replay && recuPar(replay) !== 'longsRejoues') ecarts.push('rejeu long seul : issues reçues ailleurs que dans longsRejoues');
  const resultats = noeuds.find((n) => n.type === 'VariableDeclarator' && nomLu(n.id) === 'resultats');
  const report = noeuds.find(
    (n) =>
      n.type === 'AssignmentExpression' &&
      n.operator === '=' &&
      n.left.type === 'MemberExpression' &&
      n.left.computed &&
      nomLu(n.left.object) === 'longues' &&
      n.right.type === 'MemberExpression' &&
      n.right.computed &&
      nomLu(n.right.object) === 'longsRejoues',
  );
  if (report === undefined || replay === undefined || report.start < replay.end || resultats === undefined || report.start > resultats.start) {
    ecarts.push('issues rejouées seules non reportées dans longues avant les résultats');
  }
  return ecarts;
}

describe('audit par mutation : un équivalent déclaré que la série longue tue se rejoue seul', () => {
  const source = readFileSync(join(RACINE, AUDIT), 'utf8');
  const modifie = (avant, apres) => {
    assert.ok(source.includes(avant), avant);
    return ecartsDuRejeuLongSeul(source.replace(avant, () => apres));
  };

  test('auditer rejoue seuls, largeur 1, sous le délai de la série longue, les équivalents déclarés qu’elle a tués en parallèle', () => {
    assert.deepEqual(ecartsDuRejeuLongSeul(source), []);
  });

  test('la garde relève un rejeu long seul élargi, choisi ailleurs, sourd à l’arrêt, sous un autre délai, contre d’autres épreuves, ou dont l’issue ne se reporte pas', () => {
    assert.deepEqual(modifie('      longsSeuls,\n      1,', '      longsSeuls,\n      largeur,'), [
      'aucun rejeu seul après le rejeu parallèle de la série longue',
      'tués à rejouer non choisis entre le rejeu parallèle et le rejeu seul',
      'rejeu long seul : delaiMs autre que delaiLong',
      'rejeu long seul : épreuves autres que les longues de la tâche',
      'rejeu long seul : autre liste que longsSeuls',
      'rejeu long seul : issues reçues ailleurs que dans longsRejoues',
    ]);
    assert.deepEqual(modifie('tuesLongsARejouerSeuls(longues, taches, equivalents)', 'delaisARejouerSeuls(longues, taches, equivalents)'), [
      'tués à rejouer non choisis entre le rejeu parallèle et le rejeu seul',
      'tuesLongsARejouerSeuls() : longues, taches, equivalents attendus',
    ]);
    assert.deepEqual(modifie('tuesLongsARejouerSeuls(longues, taches, equivalents)', 'tuesLongsARejouerSeuls(longues, taches, new Map())'), [
      'tuesLongsARejouerSeuls(longues, taches, ) : longues, taches, equivalents attendus',
    ]);
    assert.deepEqual(modifie('return (await executerMutant({ mutant, tests, delaiMs: delaiLong, racine })).issue;\n      },', 'return (await executerMutant({ mutant, tests, delaiMs, racine })).issue;\n      },'), [
      'rejeu long seul : delaiMs autre que delaiLong',
    ]);
    assert.deepEqual(modifie('const { mutant, longues: tests } = taches[rang];', 'const { mutant, tests } = taches[rang];'), [
      'rejeu long seul : épreuves autres que les longues de la tâche',
    ]);
 
    assert.deepEqual(modifie('longues[rang] = longsRejoues[i];', 'void longsRejoues[i];'), [
      'issues rejouées seules non reportées dans longues avant les résultats',
    ]);
    assert.deepEqual(modifie('      longsSeuls,\n      1,', '      seuls,\n      1,'), ['rejeu long seul : autre liste que longsSeuls']);
    assert.deepEqual(modifie("{ arreter, signaler: avancement('tués par", "{ arreter: () => false, signaler: avancement('tués par"), [
      'rejeu long seul : arreter non passé tel quel à enParallele',
    ]);
    assert.deepEqual(modifie('const longsRejoues = await enParallele(', 'await enParallele('), [
      'rejeu long seul : issues reçues ailleurs que dans longsRejoues',
    ]);
    assert.deepEqual(modifie('    longsSeuls.forEach((rang, i) => {\n      longues[rang] = longsRejoues[i];\n    });\n', ''), [
      'issues rejouées seules non reportées dans longues avant les résultats',
    ]);
    assert.deepEqual(modifie('const longsSeuls = tuesLongsARejouerSeuls(', 'const longsSeuls = [];\n    tuesLongsARejouerSeuls('), [
      'tuesLongsARejouerSeuls : reçu ailleurs que dans longsSeuls',
    ]);
  });
});

describe('audit par mutation : hors des séries (§ 14.4, § 14.14)', () => {
  test('aucun module de src/, scripts/, test/ ni electron/ n’importe audit.js : aucune épreuve des séries node et node-long ne l’atteint', () => {
    const graphe = grapheDuProjet(RACINE, ['src', 'scripts', 'test', 'electron']);
    assert.ok(graphe.has(AUDIT), 'audit.js est dans le graphe');
    assert.ok(graphe.get('scripts/mutation/audit.test.js').includes('scripts/mutation/graphe.js'), 'le graphe lit les imports');
    assert.ok(graphe.size > 200, `${graphe.size} modules lus`);
    assert.deepEqual(importateursDe(AUDIT, graphe), []);
  });

  test('la garde relève un module qui l’importe, statiquement, par une ré-exportation ou par import()', () => {
    const textes = new Map([
      ['scripts/mutation/audit.js', "import { rediger } from './rapport.js';\n"],
      ['scripts/mutation/rapport.js', ''],
      ['scripts/mutation/rapport.test.js', "import { rediger } from './rapport.js';\n"],
      ['scripts/mutation/aide.js', "export { PERIMETRE } from './audit.js';\n"],
      ['src/verger/pommes.test.js', "import { PERIMETRE } from '../../scripts/mutation/aide.js';\n"],
      ['src/verger/poires.long.test.js', "const audit = await import('../../scripts/mutation/audit.js');\n"],
      ['src/verger/vue.navigateur.test.js', "import '../../scripts/mutation/audit.js';\n"],
    ]);
    const graphe = construireGraphe([...textes.keys()], (chemin) => textes.get(chemin));
    assert.deepEqual(importateursDe(AUDIT, graphe), [
      'scripts/mutation/aide.js',
      'src/verger/poires.long.test.js',
      'src/verger/vue.navigateur.test.js',
    ]);
  });
});

describe('audit par mutation : la couverture garde sa commande (§ 14.13)', () => {
  test('la mesure reste npm run couverture, lancée par make couverture seule ; l’audit n’en est pas une seconde', () => {
    const { scripts = {} } = JSON.parse(readFileSync(join(RACINE, 'package.json'), 'utf8'));
    const makefile = readFileSync(join(RACINE, 'Makefile'), 'utf8');
    assert.match(scripts.couverture, /--coverage\b/);
    assert.deepEqual(cibleDuMakefile(makefile, 'couverture')?.commandes, ['$(AVEC_NODE) npm run couverture']);
    assert.deepEqual(ecartsDeLaCouverture({ scripts, makefile }), []);
  });

  test('la garde relève une passe de couverture sortie d’audit.js, et un audit qui lance autre chose', () => {
    const scripts = {
      couverture: 'vitest run --project node --coverage',
      mutation: 'node --experimental-test-coverage scripts/mutation/audit.js',
      test: 'vitest run --project node --coverage',
    };
    const makefile = [
      '.PHONY: couverture mutation',
      'couverture: ## Mesure',
      '\t$(AVEC_NODE) npm run couverture',
      'mutation: ## Audit',
      '\t$(AVEC_NODE) npm run couverture',
      '\tnode --test --experimental-test-coverage src/moteur',
      '',
    ].join('\n');
    assert.deepEqual(ecartsDeLaCouverture({ scripts, makefile }), [
      'npm run mutation : mesure la couverture',
      'npm run test : mesure la couverture',
      'npm run mutation : ne lance pas audit.js seul',
      'make mutation : lance une mesure de couverture',
      'make mutation : lance une mesure de couverture',
    ]);
  });
});
