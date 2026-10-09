// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Énumération des mutants d'un module, pour l'audit par mutation du moteur
// (§ 14.13). Le source se lit par parseAst de Vite, dont les décalages start
// et end comptent des unités UTF-16 : ceux de String.prototype.slice, ce que
// mutants.test.js épingle sur un commentaire accentué. Un mutant remplace un
// seul intervalle [debut, fin) du source ; appliquer refait ce remplacement.
//
// Rien de ce qui n'est pas du code ne se mute : ni chaîne, ni commentaire (ils
// sont absents de l'arbre, et la recherche d'un opérateur les saute), ni
// gabarit — expressions comprises : elles composent un message —, ni import,
// statique ou dynamique. Un module de définitions de types et les épreuves
// n'ont aucun mutant.
import { createHash } from 'node:crypto';
import { basename } from 'node:path';
import { parseAst } from 'vite';

/**
 * @typedef {Object} Mutant
 * @property {string} cle          fichier:operateur:empreinte:rang — stable quand
 *                                  le reste du source bouge, voir cleDe
 * @property {string} fichier      le chemin reçu, tel quel
 * @property {number} ligne        1 pour la première ligne, du jeton muté
 * @property {number} colonne      1 pour le premier caractère, en unités UTF-16
 * @property {string} operateur    un nom d'OPERATEURS
 * @property {string} original     source.slice(debut, fin)
 * @property {string} remplacement ce qui prend sa place
 * @property {number} debut        décalage en unités UTF-16, inclus
 * @property {number} fin          décalage en unités UTF-16, exclu
 */

// Les opérateurs, dans l'ordre où deux mutants d'un même site se rangent.
//   arithmetique   + ↔ -, * ↔ /, % → *
//   frontiere      < ↔ <=, > ↔ >=
//   negation       === ↔ !==, == ↔ !=, < → >=, <= → >, > → <=, >= → <
//   logique        && ↔ ||, ?? → && — le nœud entier, entre parenthèses
//   retrait-non    !x → x
//   mise-a-jour    ++ ↔ --, += ↔ -=
//   nombre-plus-un n → n + 1 ;  nombre-zero  n → 0 ;  booleen  true ↔ false
//   si-vrai, si-faux             le test d'un if → true, false
//   ternaire-vrai, ternaire-faux le test d'un ternaire → true, false
//   min-max        Math.min ↔ Math.max
//   corps-si       le corps d'un if → {}
export const OPERATEURS = Object.freeze([
  'arithmetique',
  'frontiere',
  'negation',
  'logique',
  'retrait-non',
  'mise-a-jour',
  'nombre-plus-un',
  'nombre-zero',
  'booleen',
  'si-vrai',
  'si-faux',
  'ternaire-vrai',
  'ternaire-faux',
  'min-max',
  'corps-si',
]);

const ARITHMETIQUE = { '+': '-', '-': '+', '*': '/', '/': '*', '%': '*' };
const FRONTIERE = { '<': '<=', '<=': '<', '>': '>=', '>=': '>' };
const NEGATION = { '===': '!==', '!==': '===', '==': '!=', '!=': '==', '<': '>=', '<=': '>', '>': '<=', '>=': '<' };
const LOGIQUE = { '&&': '||', '||': '&&', '??': '&&' };
const MISE_A_JOUR = { '++': '--', '--': '++', '+=': '-=', '-=': '+=' };
const MIN_MAX = { min: 'max', max: 'min' };

// Sous-arbres qui ne portent aucun site : les import, les ré-exportations et
// les gabarits.
const SANS_SITE = new Set([
  'ImportDeclaration',
  'ImportExpression',
  'ExportAllDeclaration',
  'TemplateLiteral',
  'TaggedTemplateExpression',
]);

// Vrai pour un module qui se mute : ni le module des seules définitions de
// types, ni une épreuve (.test.js, dont .long.test.js et .navigateur.test.js).
function seMute(fichier) {
  const nom = basename(fichier);
  return nom !== 'types.js' && !nom.endsWith('.test.js');
}

const estChaine = (noeud) =>
  (noeud.type === 'Literal' && typeof noeud.value === 'string') || noeud.type === 'TemplateLiteral';

// Le décalage du jeton `jeton` entre debut et fin, là où seuls se trouvent des
// blancs, des parenthèses, des commentaires et ce jeton : l'espace entre deux
// opérandes. Lève sur tout autre caractère, ou sans jeton.
function jetonEntre(source, debut, fin, jeton) {
  let i = debut;
  while (i < fin) {
    if (source.startsWith('/*', i)) {
      i = source.indexOf('*/', i + 2) + 2;
    } else if (source.startsWith('//', i)) {
      const saut = source.indexOf('\n', i);
      i = saut === -1 ? fin : saut + 1;
    } else if (/[\s()]/u.test(source[i])) {
      i += 1;
    } else if (source.startsWith(jeton, i)) {
      return i;
    } else {
      break;
    }
  }
  throw new Error(`opérateur ${jeton} introuvable entre ${debut} et ${fin}`);
}

// Les sites d'un nœud : { operateur, debut, fin, remplacement, site, texte }.
// site : décalage du jeton muté, qui donne ligne et colonne ; texte : le texte
// du nœud qui entre dans la clé. Parent : le nœud qui contient celui-ci, ou null.
function sitesDe(source, noeud, parent) {
  const texte = (n) => source.slice(n.start, n.end);
  const sites = [];
  const jeton = (operateur, debut, ancien, nouveau, noeudCle = noeud) => {
    sites.push({ operateur, debut, fin: debut + ancien.length, remplacement: nouveau, site: debut, texte: texte(noeudCle) });
  };
  switch (noeud.type) {
    case 'BinaryExpression': {
      const position = () => jetonEntre(source, noeud.left.end, noeud.right.start, noeud.operator);
      const concatene = noeud.operator === '+' && (estChaine(noeud.left) || estChaine(noeud.right));
      if (noeud.operator in ARITHMETIQUE && !concatene) {
        jeton('arithmetique', position(), noeud.operator, ARITHMETIQUE[noeud.operator]);
      }
      if (noeud.operator in FRONTIERE) jeton('frontiere', position(), noeud.operator, FRONTIERE[noeud.operator]);
      if (noeud.operator in NEGATION) jeton('negation', position(), noeud.operator, NEGATION[noeud.operator]);
      break;
    }
    case 'LogicalExpression': {
      // && et || n'ont pas la même priorité, et ?? ne se mêle à aucun des deux
      // sans parenthèses : le nœud entier se réécrit, chaque opérande et le
      // tout entre parenthèses. Le texte de part et d'autre de l'opérateur
      // garde ses commentaires ; une parenthèse ferme après un saut de ligne
      // qui termine un commentaire //.
      const position = jetonEntre(source, noeud.left.end, noeud.right.start, noeud.operator);
      const gauche = source.slice(noeud.start, position);
      const droite = source.slice(position + noeud.operator.length, noeud.end);
      sites.push({
        operateur: 'logique',
        debut: noeud.start,
        fin: noeud.end,
        remplacement: `((${gauche})${LOGIQUE[noeud.operator]}(${droite}))`,
        site: position,
        texte: texte(noeud),
      });
      break;
    }
    case 'UnaryExpression':
      if (noeud.operator === '!' && source[noeud.start] === '!') {
        sites.push({
          operateur: 'retrait-non',
          debut: noeud.start,
          fin: noeud.start + 1,
          remplacement: '',
          site: noeud.start,
          texte: texte(noeud),
        });
      }
      break;
    case 'UpdateExpression': {
      const debut = noeud.prefix ? noeud.start : noeud.end - noeud.operator.length;
      if (source.startsWith(noeud.operator, debut)) {
        jeton('mise-a-jour', debut, noeud.operator, MISE_A_JOUR[noeud.operator]);
      }
      break;
    }
    case 'AssignmentExpression':
      if (noeud.operator in MISE_A_JOUR && !(noeud.operator === '+=' && estChaine(noeud.right))) {
        const debut = jetonEntre(source, noeud.left.end, noeud.right.start, noeud.operator);
        jeton('mise-a-jour', debut, noeud.operator, MISE_A_JOUR[noeud.operator]);
      }
      break;
    case 'Literal': {
      // Une clé de propriété écrite n'est pas une valeur. Le texte d'un
      // littéral seul ne distingue rien : la clé prend celui de son parent.
      const cle = parent && (parent.type === 'Property' || parent.type === 'MethodDefinition' || parent.type === 'PropertyDefinition') && parent.key === noeud && !parent.computed;
      const contexte = parent ?? noeud;
      if (typeof noeud.value === 'number' && !cle) {
        const suivant = noeud.value + 1;
        if (suivant !== noeud.value) jeton('nombre-plus-un', noeud.start, noeud.raw, String(suivant), contexte);
        if (noeud.value !== 0) jeton('nombre-zero', noeud.start, noeud.raw, '0', contexte);
      } else if (typeof noeud.value === 'boolean') {
        jeton('booleen', noeud.start, noeud.raw, String(!noeud.value), contexte);
      }
      break;
    }
    case 'IfStatement':
    case 'ConditionalExpression': {
      const [vrai, faux] = noeud.type === 'IfStatement' ? ['si-vrai', 'si-faux'] : ['ternaire-vrai', 'ternaire-faux'];
      const test = texte(noeud.test);
      if (test !== 'true') jeton(vrai, noeud.test.start, test, 'true', noeud.test);
      if (test !== 'false') jeton(faux, noeud.test.start, test, 'false', noeud.test);
      if (noeud.type === 'IfStatement') {
        const corps = noeud.consequent;
        const vide = corps.type === 'BlockStatement' && corps.body.length === 0;
        if (!vide) jeton('corps-si', corps.start, texte(corps), '{}', corps);
      }
      break;
    }
    case 'CallExpression': {
      const appele = noeud.callee;
      if (
        appele.type === 'MemberExpression' &&
        !appele.computed &&
        appele.object.type === 'Identifier' &&
        appele.object.name === 'Math' &&
        appele.property.type === 'Identifier' &&
        appele.property.name in MIN_MAX
      ) {
        jeton('min-max', appele.property.start, appele.property.name, MIN_MAX[appele.property.name]);
      }
      break;
    }
    default:
      break;
  }
  return sites;
}

// Parcourt l'arbre en profondeur et appelle visiter(noeud, parent) sur chaque
// nœud hors des sous-arbres SANS_SITE. L'ordre de la visite ne décide de rien :
// mutants trie les sites par leur place dans le source.
function parcourir(noeud, parent, visiter) {
  if (SANS_SITE.has(noeud.type)) return;
  if (noeud.type === 'ExportNamedDeclaration' && noeud.source) return;
  visiter(noeud, parent);
  for (const valeur of Object.values(noeud)) {
    const enfants = Array.isArray(valeur) ? valeur : [valeur];
    for (const enfant of enfants) {
      if (enfant !== null && typeof enfant === 'object' && typeof enfant.type === 'string') {
        parcourir(enfant, noeud, visiter);
      }
    }
  }
}

// Décalages du début de chaque ligne, pour ligne et colonne.
function debutsDeLignes(source) {
  const debuts = [0];
  for (let i = source.indexOf('\n'); i !== -1; i = source.indexOf('\n', i + 1)) debuts.push(i + 1);
  return debuts;
}

// La ligne (1…) du décalage, par dichotomie sur les débuts de lignes.
function ligneDe(debuts, decalage) {
  let bas = 0;
  let haut = debuts.length - 1;
  while (bas < haut) {
    const milieu = (bas + haut + 1) >> 1;
    if (debuts[milieu] <= decalage) bas = milieu;
    else haut = milieu - 1;
  }
  return bas + 1;
}

// L'empreinte du texte d'un nœud, blancs ramenés à une espace : seize
// chiffres hexadécimaux de son SHA-256. Une ligne ajoutée ailleurs ne la
// change pas ; une réindentation non plus.
const empreinte = (texte) => createHash('sha256').update(texte.replace(/\s+/gu, ' ')).digest('hex').slice(0, 16);

/**
 * Les mutants du source, dans l'ordre du source : par décalage du jeton muté,
 * puis dans l'ordre d'OPERATEURS. La clé est fichier:operateur:empreinte:rang,
 * l'empreinte celle du texte du nœud muté (du parent pour un littéral), le
 * rang celui du mutant parmi ceux de même fichier, opérateur et empreinte.
 * Lève sur un source que parseAst refuse.
 * @param {string} source
 * @param {string} fichier  chemin relatif à la racine du projet
 * @returns {Mutant[]}
 */
export function mutants(source, fichier) {
  if (!seMute(fichier)) return [];
  const sites = [];
  parcourir(parseAst(source), null, (noeud, parent) => sites.push(...sitesDe(source, noeud, parent)));
  sites.sort((a, b) => a.site - b.site || OPERATEURS.indexOf(a.operateur) - OPERATEURS.indexOf(b.operateur));
  const debuts = debutsDeLignes(source);
  const rangs = new Map();
  return sites.map(({ operateur, debut, fin, remplacement, site, texte }) => {
    const prefixe = `${fichier}:${operateur}:${empreinte(texte)}`;
    const rang = rangs.get(prefixe) ?? 0;
    rangs.set(prefixe, rang + 1);
    const ligne = ligneDe(debuts, site);
    return {
      cle: `${prefixe}:${rang}`,
      fichier,
      ligne,
      colonne: site - debuts[ligne - 1] + 1,
      operateur,
      original: source.slice(debut, fin),
      remplacement,
      debut,
      fin,
    };
  });
}

/**
 * Le source où l'intervalle du mutant porte son remplacement. Lève quand le
 * source ne porte pas l'original à cette place : le mutant vient d'une autre
 * version du fichier.
 * @param {string} source
 * @param {Mutant} mutant
 * @returns {string}
 */
export function appliquer(source, mutant) {
  const { debut, fin, original, remplacement, cle } = mutant;
  if (source.slice(debut, fin) !== original) {
    throw new Error(`le source ne porte pas l'original du mutant ${cle} en [${debut}, ${fin})`);
  }
  return source.slice(0, debut) + remplacement + source.slice(fin);
}
