// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Gardes des sources de l'interface, lues dans l'arbre d'analyse et non dans
// le texte : chaque composant passe par parse de svelte/compiler, chaque
// module JavaScript par le même analyseur, enveloppé dans un <script module>,
// chaque feuille .css par parseCss. Un commentaire n'est donc jamais relevé :
// la règle porte sur ce que le code fait, et un commentaire qui nomme un
// interdit le documente.
//
// Huit gardes : les chaînes visibles en dur (§ 14.6), les clés littérales de
// t qui n'existent pas, le contenu des tables de traduction (§ 5.5, § 7.6,
// § 7.7, § 12.8, § 12.10.8), les couleurs (§ 12.7, § 13.3, § 13.5), le
// balisage et les fenêtres du navigateur (§ 13.1, § 2.1), le texte comprimé et
// les animations (§ 7.4, § 19.2), le câblage des composants (§ 12.9, § 13.3),
// les sélecteurs que le compilateur élague (§ 13.3). Chaque garde rend un
// relevé « chemin:ligne motif « extrait » », trié, qui nomme d'un coup chaque
// fichier et chaque ligne fautifs ; elle lève sur un balayage vide (§ 14.2).
//
// Le périmètre est le code livré : les épreuves — *.test.js, dont
// *.navigateur.test.js — et test/ portent exprès ce que les gardes refusent,
// et n'en font pas partie. D'autres épreuves font tourner chaque garde sur un
// arbre temporaire qui porte, à plus d'un niveau, les formes refusées et des
// formes voisines admises.
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile, parse, parseCss } from 'svelte/compiler';
import { TABLES_APPLICATION } from '../src/application/libelles.js';
import { creerTraduction } from '../src/application/traduction.js';
import { TABLES_INTERFACE } from '../src/interface/libelles.js';
import { describe, test } from './lanceur.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));

// --- Lecture des sources ------------------------------------------------------

// Une épreuve, node ou navigateur : hors du périmètre de chaque garde.
const EPREUVE = /\.test\.[cm]?js$/;

// Chemins relatifs, en « / », des fichiers des arbres donnés dont le nom finit
// par l'une des extensions, épreuves exclues, triés. Un arbre absent n'en
// fournit aucun ; un répertoire node_modules n'est jamais retenu.
function sources(racine, arbres, extensions) {
  const chemins = [];
  for (const arbre of arbres) {
    let entrees;
    try {
      entrees = readdirSync(join(racine, arbre), { recursive: true, withFileTypes: true });
    } catch (erreur) {
      if (erreur.code === 'ENOENT') continue;
      throw erreur;
    }
    for (const entree of entrees) {
      if (!entree.isFile()) continue;
      const chemin = relative(racine, join(entree.parentPath, entree.name)).split(sep).join('/');
      if (chemin.split('/').includes('node_modules') || EPREUVE.test(chemin)) continue;
      if (extensions.some((extension) => chemin.endsWith(extension))) chemins.push(chemin);
    }
  }
  return chemins.sort();
}

// Lève quand un balayage n'examine aucun fichier (§ 14.2).
function exigerNonVide(chemins, garde) {
  assert.ok(chemins.length > 0, `${garde} : aucun fichier examiné`);
  return chemins;
}

// Numéro, à partir de 1, de la ligne qui porte le caractère d'indice donné.
const ligneDe = (texte, indice) => texte.slice(0, indice).split('\n').length;

// Un extrait lisible d'un texte relevé : blancs réduits, quarante caractères
// au plus.
function extrait(texte) {
  const court = String(texte).replace(/\s+/g, ' ').trim();
  return `« ${court.length > 40 ? `${court.slice(0, 39)}\u{2026}` : court} »`;
}

// Un composant : son arbre moderne, ses positions comptées dans son texte.
function analyserComposant(racine, chemin) {
  const texte = readFileSync(join(racine, chemin), 'utf8');
  try {
    return { texte, ast: parse(texte, { modern: true }) };
  } catch (erreur) {
    throw new Error(`${chemin} : analyse impossible (${erreur.code ?? erreur.name})`, { cause: erreur });
  }
}

// Un module JavaScript, enveloppé dans un <script module> : le préfixe ne
// porte aucun saut de ligne, les numéros de ligne restent ceux du fichier.
function analyserModule(racine, chemin) {
  const texte = `<script module>${readFileSync(join(racine, chemin), 'utf8')}</script>`;
  try {
    return { texte, ast: parse(texte, { modern: true }).module.content };
  } catch (erreur) {
    throw new Error(`${chemin} : analyse impossible (${erreur.code ?? erreur.name})`, { cause: erreur });
  }
}

// Parcourt un arbre d'analyse en profondeur, dans l'ordre des champs : visite
// chaque nœud typé avec la liste de ses ancêtres typés, du plus lointain au
// plus proche. Les champs de service des analyseurs ne sont pas descendus.
const CHAMPS_IGNORES = new Set(['parent', 'loc', 'metadata', 'name_loc', 'range']);
function parcourir(noeud, visiter, ancetres = []) {
  if (noeud === null || typeof noeud !== 'object') return;
  if (Array.isArray(noeud)) {
    for (const enfant of noeud) parcourir(enfant, visiter, ancetres);
    return;
  }
  const type = typeof noeud.type === 'string';
  if (type) visiter(noeud, ancetres);
  const suivants = type ? [...ancetres, noeud] : ancetres;
  for (const [champ, valeur] of Object.entries(noeud)) {
    if (!CHAMPS_IGNORES.has(champ) && valeur !== null && typeof valeur === 'object') {
      parcourir(valeur, visiter, suivants);
    }
  }
}

// Les parties JavaScript et le gabarit d'un composant, sans sa feuille.
const partiesCode = (ast) => [ast.module, ast.instance, ast.fragment];

// Les chaînes littérales qu'une expression peut rendre telle quelle : un
// littéral, les morceaux fixes d'un gabarit de chaîne, les deux branches
// d'une condition, les opérandes d'une concaténation et d'un « || » ou « ?? »,
// le second d'un « && », le dernier terme d'une séquence. Un appel, un
// membre, un identifiant ne rendent aucun littéral : t('cle') n'affiche pas
// sa clé. Rend [{ valeur, debut }].
function litterauxRendus(expression) {
  if (expression === null || typeof expression !== 'object') return [];
  switch (expression.type) {
    case 'Literal':
      return typeof expression.value === 'string' ? [{ valeur: expression.value, debut: expression.start }] : [];
    case 'TemplateLiteral':
      return [
        { valeur: expression.quasis.map((q) => q.value.cooked ?? q.value.raw).join(''), debut: expression.start },
        ...expression.expressions.flatMap(litterauxRendus),
      ];
    case 'ConditionalExpression':
      return [...litterauxRendus(expression.consequent), ...litterauxRendus(expression.alternate)];
    case 'LogicalExpression':
      return expression.operator === '&&'
        ? litterauxRendus(expression.right)
        : [...litterauxRendus(expression.left), ...litterauxRendus(expression.right)];
    case 'BinaryExpression':
      return expression.operator === '+'
        ? [...litterauxRendus(expression.left), ...litterauxRendus(expression.right)]
        : [];
    case 'SequenceExpression':
      return litterauxRendus(expression.expressions.at(-1));
    default:
      return [];
  }
}

// Les morceaux de la valeur d'un attribut du gabarit : { statique, debut }
// pour un texte, { expression } pour une expression. Un attribut sans valeur
// n'en a aucun.
function morceauxAttribut(attribut) {
  const valeur = attribut.value;
  if (valeur === true || valeur === undefined || valeur === null) return [];
  const morceaux = Array.isArray(valeur) ? valeur : [valeur];
  return morceaux.map((m) =>
    m.type === 'Text' ? { statique: m.data, debut: m.start } : { expression: m.expression, debut: m.start },
  );
}

// Le plus proche ancêtre élément d'un nœud du gabarit, ou null.
const ELEMENTS = new Set(['RegularElement', 'SvelteElement', 'Component', 'SvelteComponent', 'SlotElement']);
function elementParent(ancetres) {
  for (let i = ancetres.length - 1; i >= 0; i -= 1) if (ELEMENTS.has(ancetres[i].type)) return ancetres[i];
  return null;
}

// Vrai quand le nœud est dans la valeur d'un attribut ou d'une directive.
const DANS_UN_ATTRIBUT = new Set(['Attribute', 'StyleDirective', 'SpreadAttribute', 'BindDirective', 'ClassDirective']);
const dansUnAttribut = (ancetres) => ancetres.some((a) => DANS_UN_ATTRIBUT.has(a.type));

// --- Garde 1 : les chaînes visibles en dur (§ 14.6) ---------------------------

const LETTRE = /\p{L}/u;
// Attributs qu'une technologie d'assistance annonce, ou que la page montre.
const ATTRIBUTS_ANNONCES = new Set(['aria-label', 'aria-roledescription', 'title', 'placeholder', 'alt']);
// Éléments du SVG dont le contenu est un texte : tout contenu statique non
// blanc y est une chaîne visible, ponctuation comprise.
const TEXTES_SVG = new Set(['title', 'desc', 'text', 'tspan']);
// Une chaîne entre guillemets d'une valeur CSS.
const CHAINE_CSS = /(["'])((?:\\.|(?!\1).)*)\1/g;

// Vrai quand un texte placé dans cet élément est une chaîne visible : une
// lettre partout, tout caractère non blanc dans un texte du SVG.
function texteVisible(texte, element) {
  if (element !== null && element.type === 'RegularElement' && TEXTES_SVG.has(element.name)) {
    return texte.trim() !== '';
  }
  return LETTRE.test(texte);
}

// Vrai quand une valeur de « content » porte une lettre dans une chaîne.
const contenuLettre = (valeur) => [...valeur.matchAll(CHAINE_CSS)].some(([, , chaine]) => LETTRE.test(chaine));

// Relevé des chaînes visibles écrites dans les composants de src/interface :
// texte statique, attribut annoncé, contenu d'un texte du SVG, déclaration
// « content » lettrée, littéral que rend une expression du gabarit.
function releverChainesEnDur(racine) {
  const chemins = exigerNonVide(sources(racine, ['src/interface'], ['.svelte']), 'chaînes en dur');
  const releves = [];
  for (const chemin of chemins) {
    const { texte, ast } = analyserComposant(racine, chemin);
    const relever = (debut, motif, valeur) =>
      releves.push({ chemin, ligne: ligneDe(texte, debut), texte: `${motif} ${extrait(valeur)}` });
    parcourir(ast.fragment, (noeud, ancetres) => {
      if (noeud.type === 'Text' && !dansUnAttribut(ancetres)) {
        const element = elementParent(ancetres);
        if (texteVisible(noeud.data, element)) relever(noeud.start, 'texte', noeud.data);
      } else if (noeud.type === 'ExpressionTag' && !dansUnAttribut(ancetres)) {
        const element = elementParent(ancetres);
        for (const { valeur, debut } of litterauxRendus(noeud.expression)) {
          if (texteVisible(valeur, element)) relever(debut, 'expression littérale', valeur);
        }
      } else if (noeud.type === 'Attribute' && ATTRIBUTS_ANNONCES.has(noeud.name)) {
        for (const morceau of morceauxAttribut(noeud)) {
          const valeurs = 'statique' in morceau
            ? [{ valeur: morceau.statique, debut: morceau.debut }]
            : litterauxRendus(morceau.expression);
          for (const { valeur, debut } of valeurs) {
            if (LETTRE.test(valeur)) relever(debut, `attribut ${noeud.name}`, valeur);
          }
        }
      } else if (noeud.type === 'Attribute' && noeud.name === 'style') {
        for (const morceau of morceauxAttribut(noeud)) {
          if ('statique' in morceau && /content\s*:/.test(morceau.statique) && contenuLettre(morceau.statique)) {
            relever(morceau.debut, 'content', morceau.statique);
          }
        }
      }
    });
    parcourir(ast.css, (noeud) => {
      if (noeud.type === 'Declaration' && noeud.property === 'content' && contenuLettre(noeud.value)) {
        relever(noeud.start, 'content', noeud.value);
      }
    });
  }
  return trier(releves);
}

// Relevé trié par chemin, puis par ligne, puis par texte ; rendu en chaînes.
function trier(releves) {
  return releves
    .sort((a, b) =>
      a.chemin < b.chemin ? -1 : a.chemin > b.chemin ? 1 : a.ligne - b.ligne || (a.texte < b.texte ? -1 : a.texte > b.texte ? 1 : 0),
    )
    .map(({ chemin, ligne, texte }) => `${chemin}:${ligne} ${texte}`);
}

// --- Garde 2 : les clés littérales de t existent (§ 14.6, § 19.11) ------------

// Les clés de toutes les tables assemblées, celles qu'App donne à t.
const CLES = new Set(creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]).cles());

// La clé littérale du premier argument d'un appel de t — t(…) ou x.t(…) —, ou
// null : une clé composée à l'exécution échappe à cette garde.
function cleLitterale(appel) {
  const appele = appel.callee;
  const estT =
    (appele.type === 'Identifier' && appele.name === 't') ||
    (appele.type === 'MemberExpression' && !appele.computed && appele.property.name === 't');
  if (!estT) return null;
  const [premier] = appel.arguments;
  if (premier?.type === 'Literal' && typeof premier.value === 'string') return premier.value;
  if (premier?.type === 'TemplateLiteral' && premier.expressions.length === 0) return premier.quasis[0].value.cooked;
  return null;
}

// Relevé des clés littérales passées à t, dans les composants et les modules
// de src/interface, qu'aucune table de cles ne porte. Lève quand aucun fichier
// n'est examiné, et quand aucune clé littérale ne l'est : un accesseur renommé
// ou une forme d'appel que la garde ne reconnaît plus la viderait sans bruit.
function releverClesAbsentes(racine, cles) {
  const chemins = exigerNonVide(sources(racine, ['src/interface'], ['.svelte', '.js']), 'clés de t');
  const releves = [];
  let nbCles = 0;
  for (const chemin of chemins) {
    const { texte, ast } = chemin.endsWith('.svelte') ? analyserComposant(racine, chemin) : analyserModule(racine, chemin);
    const parties = chemin.endsWith('.svelte') ? partiesCode(ast) : [ast];
    parcourir(parties, (noeud) => {
      if (noeud.type !== 'CallExpression') return;
      const cle = cleLitterale(noeud);
      if (cle === null) return;
      nbCles += 1;
      if (!cles.has(cle)) releves.push({ chemin, ligne: ligneDe(texte, noeud.start), texte: `clé absente ${extrait(cle)}` });
    });
  }
  assert.ok(nbCles > 0, 'clés de t : aucune clé examinée');
  return trier(releves);
}

// --- Garde 3 : le contenu des tables de traduction ----------------------------

// Un texte comparé sans égard à la casse ni aux accents ; l'apostrophe
// typographique se lit comme la droite.
const normaliser = (texte) =>
  texte.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[\u{2019}\u{02BC}]/gu, "'");

// Mots que le logiciel n'écrit pas, cherchés dans le texte normalisé. Un
// « écart » nu n'existe pas au glossaire (§ 5.5) : seuls l'écart
// d'itinéraire et l'écart au plafond a priori y figurent ; « écarté », du
// verbe, n'en est pas un.
const MOTS_INTERDITS = [
  ['conforme', /conform/],
  ['écart hors du glossaire', /\becarts?\b(?!\s+(?:d'itineraire|au plafond a priori))/],
  ['satisfaction', /satisfaction/],
  ['écart-type', /\becarts?[\s-]+types?\b/],
  ['variance', /\bvariances?\b/],
  ['équité', /\bequite\b/],
  ['score', /\bscores?\b/],
  ['peut mieux faire', /\bpeut mieux faire\b/],
  ['manque minimal', /\bmanques?\s+minima/],
  ['récupérable', /recuperable/],
  ['évitable', /(?<!in)evitable/],
];
const PICTOGRAMME = /\p{Extended_Pictographic}/u;

// Les exceptions nommées aux mots refusés. Chacune admet une forme exacte du
// texte normalisé, pour un mot de MOTS_INTERDITS, dans les seules valeurs dont
// la clé répond à cles ; tout autre emploi du mot, dans la même valeur
// comprise, reste relevé. Une exception qu'aucune valeur ne sert se relève
// « sans objet ».
//
// Le diagnostic d'un manque énonce ce qui le rendrait évitable (§ 5.6) : ses
// remèdes disent qu'un changement « la rend » ou « la rendent évitable ».
// Ailleurs, « évitable » nommerait le second segment du manque (§ 12.4), que
// le logiciel n'écrit pas.
const EXCEPTIONS_DE_CONTENU = [
  {
    mot: 'évitable',
    cles: /^diagnostic\.remede\./,
    forme: /\bla rend(?:ent)? evitable\b/g,
    nom: 'diagnostic.remede.* « la rend(ent) évitable »',
  },
];

// Une chaîne de forme clé — un code, LECTURE_SEULE, ou un libellé,
// plan.refus.fermer — : une fonction la passe à texte, ou la compare à un
// détail, et ne l'affiche pas.
const FORME_CLE = /^(?:[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*|[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+)$/;

// Le texte d'une fonction de détails qu'un écran peut lire : ses chaînes
// littérales et les morceaux fixes de ses gabarits de chaîne, échappements
// décodés, joints par un blanc ; une chaîne de forme clé n'en est pas. Le nom
// d'une variable n'est pas un texte : une fonction qui nomme « ecart » une
// valeur intermédiaire n'écrit pas le mot. Un texte que l'analyseur refuse se
// lit en entier.
function texteDeFonction(fonction) {
  const source = String(fonction);
  let programme;
  try {
    programme = parse(`<script module>(${source});</script>`, { modern: true }).module.content;
  } catch {
    return source;
  }
  const morceaux = [];
  parcourir(programme, (noeud) => {
    if (noeud.type === 'Literal' && typeof noeud.value === 'string' && !FORME_CLE.test(noeud.value)) morceaux.push(noeud.value);
    if (noeud.type === 'TemplateElement') morceaux.push(noeud.value.cooked ?? noeud.value.raw);
  });
  return morceaux.join(' ');
}

// Relevé « clé : motif « extrait » » des valeurs des tables : chaque chaîne,
// et le texte de chaque fonction de détails (texteDeFonction). localiser(cle),
// quand il est donné, rend { chemin, ligne } de la clé, qui préfixe le relevé
// et l'ordonne ; sans lieu, le relevé s'ordonne par clé. Une forme qu'une
// exception admet est effacée du texte avant que son mot y soit cherché ; suit
// une ligne « exception sans objet : nom » par exception qui n'a rien effacé,
// dans l'ordre de la liste.
function releverContenuTables(tables, localiser = () => null, exceptions = EXCEPTIONS_DE_CONTENU) {
  const entrees = tables.flatMap((table) => [...table]);
  assert.ok(entrees.length > 0, 'contenu des tables : aucune entrée examinée');
  const releves = [];
  const servies = new Set();
  // Le texte normalisé d'une valeur, privé des formes que les exceptions du
  // mot admettent pour cette clé.
  const sansFormesAdmises = (normale, mot, cle) =>
    exceptions
      .filter((exception) => exception.mot === mot && exception.cles.test(cle))
      .reduce((texte, exception) => {
        const reste = texte.replace(exception.forme, ' ');
        if (reste !== texte) servies.add(exception);
        return reste;
      }, normale);
  for (const [cle, entree] of entrees) {
    const valeur = typeof entree === 'function' ? texteDeFonction(entree) : entree;
    const normale = normaliser(valeur);
    const { chemin, ligne } = localiser(cle) ?? { chemin: '', ligne: 0 };
    const relever = (motif) => releves.push({ chemin, ligne, texte: `${cle} : ${motif} ${extrait(valeur)}` });
    for (const [mot, motif] of MOTS_INTERDITS) if (motif.test(sansFormesAdmises(normale, mot, cle))) relever(mot);
    const pictogramme = valeur.match(PICTOGRAMME);
    if (pictogramme !== null) {
      relever(`pictogramme U+${pictogramme[0].codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}`);
    }
  }
  const sansObjet = exceptions.filter((exception) => !servies.has(exception)).map(({ nom }) => `exception sans objet : ${nom}`);
  return [...trier(releves).map((releve) => releve.replace(/^:0 /, '')), ...sansObjet];
}

// { chemin, ligne } de l'entrée [cle, …] dans les tables de libelles/ de
// l'application et des écrans, ou null.
function localisateur(racine) {
  const fichiers = sources(racine, ['src/application/libelles', 'src/interface/libelles'], ['.js']).map((chemin) => ({
    chemin,
    texte: readFileSync(join(racine, chemin), 'utf8'),
  }));
  return (cle) => {
    const motif = new RegExp(`\\[\\s*(['"\`])${RegExp.escape(cle)}\\1\\s*,`);
    for (const { chemin, texte } of fichiers) {
      const trouve = motif.exec(texte);
      if (trouve !== null) return { chemin, ligne: ligneDe(texte, trouve.index) };
    }
    return null;
  };
}

// --- Garde 4 : les couleurs (§ 12.7, § 13.3, § 13.5) --------------------------

const FEUILLE_DES_JETONS = 'src/interface/jetons.css';
// La famille des teintes de conflit (§ 7.5, § 12.7) : --couleur-conflit et
// chaque --couleur-conflit-…, une par règle que le plan localise ; un nom
// qui les prolonge sans tiret n'en est pas.
const JETON_CONFLIT = /--couleur-conflit(?:-[\w-]+)?(?![\w-])/;
const litConflit = (valeur) => JETON_CONFLIT.test(valeur);

// Les couleurs nommées de CSS, et les couleurs du système : chacune est un
// littéral. transparent et currentColor ne portent aucune teinte et restent
// admis.
const COULEURS_NOMMEES = (
  'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown ' +
  'burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan ' +
  'darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid ' +
  'darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet ' +
  'deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ' +
  'ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
  'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow ' +
  'lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray ' +
  'lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine ' +
  'mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise ' +
  'mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab ' +
  'orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru ' +
  'pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown ' +
  'seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan ' +
  'teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen ' +
  'accentcolor accentcolortext activetext buttonborder buttonface buttontext canvas canvastext field ' +
  'fieldtext graytext highlight highlighttext linktext mark marktext selecteditem selecteditemtext visitedtext'
).split(' ');
const COULEUR_NOMMEE = new RegExp(`(?<![\\w-])(?:${COULEURS_NOMMEES.join('|')})(?![\\w-])`, 'i');
const COULEUR_HEX = /#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})(?![\w-])/i;
const COULEUR_FONCTION = /(?<![\w-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark)\s*\(/i;

// Le littéral de couleur que porte une valeur CSS ou d'attribut, ou null. Les
// noms de propriétés personnalisées, les adresses url(…) et les chaînes
// entre guillemets sont retirés avant la recherche.
function couleurLitterale(valeur) {
  const nette = valeur
    .replace(/url\([^)]*\)/gi, ' ')
    .replace(CHAINE_CSS, ' ')
    .replace(/--[\w-]+/g, ' ');
  for (const motif of [COULEUR_HEX, COULEUR_FONCTION, COULEUR_NOMMEE]) {
    const trouve = nette.match(motif);
    if (trouve !== null) return trouve[0];
  }
  return null;
}

// Une chaîne qui est en entier un littéral de couleur : un code hexadécimal,
// une fonction de couleur, un nom de couleur.
const COULEUR_ENTIERE = new RegExp(
  `^(?:#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})|${COULEUR_FONCTION.source}.*\\)|${COULEURS_NOMMEES.join('|')})$`,
  'is',
);

// Attributs du gabarit qui portent une couleur.
const ATTRIBUTS_COULEUR = new Set(['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color']);

// Les déclarations d'une feuille, chacune avec le texte du sélecteur de la
// règle la plus proche et l'arbre de ce sélecteur (null hors de toute règle) :
// { propriete, valeur, debut, selecteur, prelude }.
function declarations(css, texte) {
  const trouvees = [];
  parcourir(css, (noeud, ancetres) => {
    if (noeud.type !== 'Declaration') return;
    const regle = ancetres.findLast((a) => a.type === 'Rule');
    const selecteur = regle === undefined ? '' : texte.slice(regle.prelude.start, regle.prelude.end);
    const prelude = regle === undefined ? null : regle.prelude;
    trouvees.push({ propriete: noeud.property, valeur: noeud.value, debut: noeud.start, selecteur, prelude });
  });
  return trouvees;
}

// Les déclarations d'un attribut style statique : « propriété: valeur » par
// point-virgule, positionnées au début du morceau.
const declarationsEnLigne = (statique, debut) =>
  statique
    .split(';')
    .map((morceau) => /^\s*([\w-]+)\s*:(.*)$/s.exec(morceau))
    .filter((d) => d !== null)
    .map(([, propriete, valeur]) => ({ propriete, valeur, debut }));

// Une classe qui nomme l'état de conflit : « conflit », ou un nom en
// « -conflit » dont aucun segment ne le nie (« sans-conflit », « non-conflit »).
// « conflit-leve » ne finit pas par « -conflit » et ne le nomme pas.
const NEGATIONS = new Set(['sans', 'non', 'hors', 'pas', 'aucun']);
function classeDeConflit(nom) {
  const segments = nom.toLowerCase().split('-');
  return segments.at(-1) === 'conflit' && !segments.some((segment) => NEGATIONS.has(segment));
}

// Vrai quand une déclaration du jeton de conflit est l'une des règles de
// conflit du plan : dans un composant de src/interface/plan/, sous une règle
// dont CHAQUE sélecteur de la liste porte, dans l'un de ses sélecteurs
// composés, une classe de conflit. Seules les classes posées directement sur
// un composé comptent : celles qu'un :not(…), un :is(…) ou un :global(…)
// enveloppe sont des arguments et ne qualifient pas la règle.
function regleDeConflit(chemin, prelude) {
  if (!chemin.startsWith('src/interface/plan/') || prelude?.type !== 'SelectorList') return false;
  return prelude.children.every((complexe) =>
    complexe.children.some((relatif) =>
      relatif.selectors.some((simple) => simple.type === 'ClassSelector' && classeDeConflit(simple.name)),
    ),
  );
}

// Relevé des couleurs : littéral de couleur dans une feuille, un attribut
// style ou de couleur, une directive style:, ou une chaîne du script d'un
// composant ; déclaration de jeton hors de la feuille des jetons ; lecture
// d'une teinte de conflit hors des règles de conflit du plan. Les composants de
// src/interface et les feuilles .css de src/ sont lus, la feuille des jetons
// exceptée.
function releverCouleurs(racine) {
  const chemins = exigerNonVide(
    sources(racine, ['src'], ['.svelte', '.css']).filter((c) => c !== FEUILLE_DES_JETONS && (c.endsWith('.css') || c.startsWith('src/interface/'))),
    'couleurs',
  );
  const releves = [];
  for (const chemin of chemins) {
    let texte;
    let decls;
    const relever = (debut, motif) => releves.push({ chemin, ligne: ligneDe(texte, debut), texte: motif });
    // Une déclaration, d'une feuille ou en ligne ; enLigne : hors de toute règle.
    const examiner = ({ propriete, valeur, debut, selecteur, prelude }, enLigne) => {
      const couleur = couleurLitterale(valeur);
      if (couleur !== null) relever(debut, `couleur ${extrait(couleur)} dans ${propriete}`);
      if (propriete.startsWith('--')) relever(debut, `jeton déclaré ${propriete}`);
      if (litConflit(valeur) && (enLigne || !regleDeConflit(chemin, prelude))) {
        relever(debut, `jeton de conflit hors d'une règle de conflit du plan, ${enLigne ? 'en ligne' : extrait(selecteur)}`);
      }
    };
    if (chemin.endsWith('.css')) {
      texte = readFileSync(join(racine, chemin), 'utf8');
      decls = declarations(parseCss(texte), texte);
      for (const d of decls) examiner(d, false);
    } else {
      const analyse = analyserComposant(racine, chemin);
      texte = analyse.texte;
      for (const d of declarations(analyse.ast.css, texte)) examiner(d, false);
      parcourir(analyse.ast.fragment, (noeud) => {
        if (noeud.type === 'Attribute' && noeud.name.startsWith('--')) relever(noeud.start, `jeton déclaré ${noeud.name}`);
        if (noeud.type === 'StyleDirective') {
          if (noeud.name.startsWith('--')) relever(noeud.start, `jeton déclaré ${noeud.name}`);
          for (const morceau of morceauxAttribut(noeud)) {
            const valeurs = 'statique' in morceau ? [morceau.statique] : litterauxRendus(morceau.expression).map((l) => l.valeur);
            for (const valeur of valeurs) examiner({ propriete: noeud.name.replace(/^--.*/, 'style:'), valeur, debut: noeud.start, selecteur: '' }, true);
          }
        }
        if (noeud.type !== 'Attribute') return;
        for (const morceau of morceauxAttribut(noeud)) {
          if (noeud.name === 'style' && 'statique' in morceau) {
            for (const d of declarationsEnLigne(morceau.statique, morceau.debut)) examiner(d, true);
          } else if (noeud.name === 'style' || ATTRIBUTS_COULEUR.has(noeud.name)) {
            const valeurs = 'statique' in morceau
              ? [{ valeur: morceau.statique, debut: morceau.debut }]
              : litterauxRendus(morceau.expression);
            for (const { valeur, debut } of valeurs) {
              const couleur = couleurLitterale(valeur);
              if (couleur !== null) relever(debut, `couleur ${extrait(couleur)} dans ${noeud.name}`);
              if (litConflit(valeur)) relever(debut, "jeton de conflit hors d'une règle de conflit du plan, en ligne");
            }
          }
        }
      });
      // Une chaîne du script qui est en entier un littéral de couleur, ou qui
      // nomme le jeton de conflit.
      parcourir([analyse.ast.module, analyse.ast.instance], (noeud) => {
        if (noeud.type !== 'Literal' || typeof noeud.value !== 'string') return;
        const valeur = noeud.value.trim();
        if (COULEUR_ENTIERE.test(valeur)) {
          relever(noeud.start, `couleur ${extrait(valeur)} dans le script`);
        }
        if (litConflit(valeur)) relever(noeud.start, "jeton de conflit hors d'une règle de conflit du plan, dans le script");
      });
    }
  }
  return trier(releves);
}

// Relevé des jetons de couleur de la feuille des jetons qu'un des deux thèmes
// ne définit pas : chaque --couleur-…, où qu'il soit déclaré, l'est dans le
// bloc clair et dans le bloc sombre.
function releverThemes(racine) {
  const texte = readFileSync(join(racine, FEUILLE_DES_JETONS), 'utf8');
  const decls = declarations(parseCss(texte), texte).filter((d) => d.propriete.startsWith('--couleur-'));
  assert.ok(decls.length > 0, 'thèmes : aucun jeton de couleur examiné');
  const theme = (nom) => new RegExp(`\\[\\s*data-theme\\s*=\\s*(["'])${nom}\\1\\s*\\]`);
  const blocs = { clair: theme('clair'), sombre: theme('sombre') };
  const releves = [];
  const premiere = new Map();
  for (const d of decls) if (!premiere.has(d.propriete)) premiere.set(d.propriete, d.debut);
  for (const [jeton, debut] of premiere) {
    for (const [nom, motif] of Object.entries(blocs)) {
      if (!decls.some((d) => d.propriete === jeton && motif.test(d.selecteur))) {
        releves.push({ chemin: FEUILLE_DES_JETONS, ligne: ligneDe(texte, debut), texte: `${jeton} absent du thème ${nom}` });
      }
    }
  }
  return trier(releves);
}

// --- Garde 5 : balisage et fenêtres du navigateur (§ 13.1, § 2.1) -------------

const PROPRIETES_BALISAGE = new Set(['innerHTML', 'outerHTML', 'insertAdjacentHTML']);
const FENETRES = new Set(['alert', 'confirm', 'prompt']);
const GLOBAUX = new Set(['window', 'globalThis', 'self']);

// Le nom d'un membre non calculé, ou d'un membre calculé par un littéral.
const nomDeMembre = (membre) =>
  membre.computed ? (membre.property.type === 'Literal' ? String(membre.property.value) : null) : membre.property.name;

// Relevé du balisage injecté, des fenêtres du navigateur, de beforeunload, et,
// sous src/interface, de la lecture de .message d'une erreur. Les composants
// et les modules de src/ sont lus.
function releverBalisageEtFenetres(racine) {
  const chemins = exigerNonVide(sources(racine, ['src'], ['.svelte', '.js']), 'balisage et fenêtres');
  const releves = [];
  for (const chemin of chemins) {
    const composant = chemin.endsWith('.svelte');
    const { texte, ast } = composant ? analyserComposant(racine, chemin) : analyserModule(racine, chemin);
    const relever = (debut, motif) => releves.push({ chemin, ligne: ligneDe(texte, debut), texte: motif });
    const interface_ = chemin.startsWith('src/interface/');
    parcourir(composant ? partiesCode(ast) : [ast], (noeud) => {
      switch (noeud.type) {
        case 'HtmlTag':
          relever(noeud.start, '{@html}');
          break;
        case 'MemberExpression': {
          const nom = nomDeMembre(noeud);
          if (PROPRIETES_BALISAGE.has(nom)) relever(noeud.start, nom);
          if (noeud.object.type === 'Identifier' && noeud.object.name === 'document' && (nom === 'write' || nom === 'writeln')) {
            relever(noeud.start, `document.${nom}`);
          }
          if (interface_ && nom === 'message') relever(noeud.start, '.message');
          break;
        }
        case 'CallExpression': {
          const appele = noeud.callee;
          const nom =
            appele.type === 'Identifier'
              ? appele.name
              : appele.type === 'MemberExpression' && appele.object.type === 'Identifier' && GLOBAUX.has(appele.object.name)
                ? nomDeMembre(appele)
                : null;
          if (FENETRES.has(nom)) relever(noeud.start, `${nom}(`);
          break;
        }
        case 'Literal':
          if (typeof noeud.value === 'string' && /beforeunload/i.test(noeud.value)) relever(noeud.start, 'beforeunload');
          break;
        case 'TemplateElement':
          if (/beforeunload/i.test(noeud.value.raw)) relever(noeud.start, 'beforeunload');
          break;
        case 'Identifier':
          if (/beforeunload/i.test(noeud.name)) relever(noeud.start, 'beforeunload');
          break;
        case 'Attribute':
        case 'OnDirective':
          if (/beforeunload/i.test(noeud.name)) relever(noeud.start, 'beforeunload');
          break;
        default:
      }
    });
  }
  return trier(releves);
}

// --- Garde 6 : texte comprimé et animations (§ 7.4, § 19.2) ------------------

// Le motif qu'un nom ou une chaîne nomme, ou null : un mot entier, que ni
// lettre ni chiffre ne prolonge, sans égard à la casse — getComputedTextLength,
// la mesure du § 7.4, ne nomme pas textLength — ; un nom d'écouteur,
// ontransitionend, nomme son événement.
const nomme = (texte, motifs) =>
  motifs.find((motif) => new RegExp(`(?<![\\p{L}\\p{N}])(?:on)?${motif}(?![\\p{L}\\p{N}])`, 'iu').test(texte)) ?? null;

// Les noms d'un arbre d'analyse — identifiants, attributs, directives,
// chaînes littérales — que les motifs nomment : [{ debut, motif }].
function nomsReleves(parties, motifs) {
  const trouves = [];
  parcourir(parties, (noeud) => {
    let nom = null;
    if (noeud.type === 'Identifier' || noeud.type === 'Attribute' || noeud.type === 'OnDirective') nom = noeud.name;
    else if (noeud.type === 'Literal' && typeof noeud.value === 'string') nom = noeud.value;
    else if (noeud.type === 'TemplateElement') nom = noeud.value.raw;
    const motif = nom === null ? null : nomme(nom, motifs);
    if (motif !== null) trouves.push({ debut: noeud.start, motif });
  });
  return trouves;
}

// Le mot qui ouvre une directive d'animation d'un composant — animate,
// transition, in, out —, ou null pour tout autre nœud.
function nomDeDirective(noeud) {
  if (noeud.type === 'AnimateDirective') return 'animate';
  if (noeud.type !== 'TransitionDirective') return null;
  if (noeud.intro && !noeud.outro) return 'in';
  if (noeud.outro && !noeud.intro) return 'out';
  return 'transition';
}

// Déclarations d'animation admises : celles qui l'éteignent.
const ANIMATION_ETEINTE = /^\s*(?:none|0m?s)\s*$/i;

// Relevé de textLength et lengthAdjust sous src/interface et src/geometrie, de
// transitionend et animationend sous src/interface, et de toute transition
// ou animation de l'interface : déclaration transition…, animation… ou
// @keyframes d'une feuille, directive transition:, in:, out: ou animate:
// d'un composant. Un état qui attendrait la fin d'une transition ne
// s'atteindrait plus sous la feuille qui les annule (§ 19.2).
function releverTexteEtAnimation(racine) {
  const chemins = exigerNonVide(
    sources(racine, ['src/interface', 'src/geometrie'], ['.svelte', '.js', '.css']),
    'texte et animation',
  );
  const releves = [];
  for (const chemin of chemins) {
    const interface_ = chemin.startsWith('src/interface/');
    const motifs = interface_ ? ['textLength', 'lengthAdjust', 'transitionend', 'animationend'] : ['textLength', 'lengthAdjust'];
    let texte;
    let parties = [];
    let css = null;
    if (chemin.endsWith('.css')) {
      texte = readFileSync(join(racine, chemin), 'utf8');
      css = parseCss(texte);
    } else if (chemin.endsWith('.svelte')) {
      const analyse = analyserComposant(racine, chemin);
      texte = analyse.texte;
      parties = partiesCode(analyse.ast);
      css = analyse.ast.css;
    } else {
      const analyse = analyserModule(racine, chemin);
      texte = analyse.texte;
      parties = [analyse.ast];
    }
    const relever = (debut, motif) => releves.push({ chemin, ligne: ligneDe(texte, debut), texte: motif });
    for (const { debut, motif } of nomsReleves(parties, motifs)) relever(debut, motif);
    if (!interface_) continue;
    parcourir(parties, (noeud) => {
      const directive = nomDeDirective(noeud);
      if (directive !== null) relever(noeud.start, `directive ${directive}:${noeud.name}`);
    });
    parcourir(css, (noeud) => {
      const anime = noeud.type === 'Declaration' && /^(?:transition|animation)(?:-|$)/.test(noeud.property);
      if (anime && !ANIMATION_ETEINTE.test(noeud.value)) {
        relever(noeud.start, `${noeud.property}: ${noeud.value}`);
      }
      if (noeud.type === 'Atrule' && /keyframes$/i.test(noeud.name)) relever(noeud.start, `@${noeud.name}`);
    });
  }
  return trier(releves);
}

// --- Garde 7 : le câblage (§ 12.9, § 13.3) ------------------------------------

const TRIS_ET_REDUCTIONS = new Set(['sort', 'toSorted', 'reduce', 'reduceRight']);
// Les mesures de la table d'évaluation, que src/application/evaluation.js
// seul importe (§ 12.9).
const MESURES = new Set([
  'mesurer',
  'plafondsRealises',
  'plafondsAPriori',
  'troisChiffres',
  'manques',
  'ecartsAuPlafondAPriori',
  'minimumAtteint',
]);
const EVALUATION = 'src/application/evaluation.js';

// Relevé des calculs écrits dans un composant de src/interface — Math., un tri,
// une réduction —, et des imports d'une mesure dans un module de
// src/application autre qu'evaluation.js : spécificateur d'import ou de
// réexportation, ou membre d'un espace de noms importé.
function releverCablage(racine) {
  const composants = exigerNonVide(sources(racine, ['src/interface'], ['.svelte']), 'câblage des composants');
  const modules = exigerNonVide(sources(racine, ['src/application'], ['.js']), 'imports des mesures');
  const releves = [];
  for (const chemin of composants) {
    const { texte, ast } = analyserComposant(racine, chemin);
    parcourir(partiesCode(ast), (noeud) => {
      if (noeud.type === 'MemberExpression' && noeud.object.type === 'Identifier' && noeud.object.name === 'Math') {
        releves.push({ chemin, ligne: ligneDe(texte, noeud.start), texte: `Math.${nomDeMembre(noeud) ?? '[…]'}` });
      }
      if (noeud.type === 'CallExpression' && noeud.callee.type === 'MemberExpression') {
        const nom = nomDeMembre(noeud.callee);
        if (TRIS_ET_REDUCTIONS.has(nom)) releves.push({ chemin, ligne: ligneDe(texte, noeud.start), texte: `.${nom}(` });
      }
    });
  }
  for (const chemin of modules) {
    if (chemin === EVALUATION) continue;
    const { texte, ast } = analyserModule(racine, chemin);
    const espaces = new Set();
    parcourir(ast, (noeud, ancetres) => {
      if (noeud.type === 'ImportNamespaceSpecifier') espaces.add(noeud.local.name);
      // Une réexportation porte la source de sa déclaration ; un
      // « export { nom } » d'une valeur locale n'importe rien.
      const reexporte = noeud.type === 'ExportSpecifier' && (ancetres.at(-1)?.source ?? null) !== null;
      const importe = noeud.type === 'ImportSpecifier' ? noeud.imported : reexporte ? noeud.local : null;
      const nom = importe === null ? null : (importe.name ?? importe.value);
      if (MESURES.has(nom)) releves.push({ chemin, ligne: ligneDe(texte, noeud.start), texte: `import de ${nom}` });
    });
    parcourir(ast, (noeud) => {
      if (
        noeud.type === 'MemberExpression' &&
        noeud.object.type === 'Identifier' &&
        espaces.has(noeud.object.name) &&
        MESURES.has(nomDeMembre(noeud))
      ) {
        releves.push({ chemin, ligne: ligneDe(texte, noeud.start), texte: `import de ${nomDeMembre(noeud)}` });
      }
    });
  }
  return trier(releves);
}

// --- Garde 8 : les sélecteurs élagués (§ 13.3, § 14.2) ------------------------

// Relevé des avertissements css_unused_selector de chaque composant de
// src/interface, compilé par compile de svelte/compiler sans greffon : une
// règle que le compilateur élague ne peindrait jamais l'état qu'elle vise.
function releverSelecteursElagues(racine) {
  const chemins = exigerNonVide(sources(racine, ['src/interface'], ['.svelte']), 'sélecteurs élagués');
  const releves = [];
  for (const chemin of chemins) {
    const texte = readFileSync(join(racine, chemin), 'utf8');
    const { warnings } = compile(texte, { filename: chemin, generate: false });
    for (const avertissement of warnings) {
      if (avertissement.code !== 'css_unused_selector') continue;
      const debut = avertissement.start?.character ?? 0;
      releves.push({
        chemin,
        ligne: avertissement.start?.line ?? ligneDe(texte, debut),
        texte: `sélecteur élagué ${extrait(texte.slice(debut, avertissement.end?.character ?? debut))}`,
      });
    }
  }
  return trier(releves);
}

// --- Arbres d'épreuve ---------------------------------------------------------

// Écrit dans un répertoire temporaire l'arbre { chemin relatif: contenu }, le
// passe à examiner, puis l'efface ; rend ce que rend examiner.
function avecArbre(fichiers, examiner) {
  const racine = mkdtempSync(join(tmpdir(), 'sources-interface-'));
  try {
    for (const [chemin, contenu] of Object.entries(fichiers)) {
      mkdirSync(dirname(join(racine, chemin)), { recursive: true });
      writeFileSync(join(racine, chemin), contenu);
    }
    return examiner(racine);
  } finally {
    rmSync(racine, { recursive: true, force: true });
  }
}

// Exige un relevé vide ; le message d'échec en donne chaque ligne.
function exigerVide(releves, garde) {
  assert.ok(releves.length === 0, `${garde} : ${releves.length} relevé(s)\n${releves.join('\n')}`);
}

// Un composant d'épreuve : son script, son gabarit, sa feuille.
const composant = ({ script = '', gabarit = '', style = '' }) =>
  `${script === '' ? '' : `<script>\n${script}\n</script>\n`}${gabarit}\n${style === '' ? '' : `<style>\n${style}\n</style>\n`}`;

// Une feuille des jetons minimale, ses deux thèmes complets.
const JETONS_EPREUVE = [
  ':root, :root[data-theme="clair"] { --couleur-a: #ffffff; --couleur-conflit: #b3261e; --couleur-conflit-voisins: #c0189f; --couleur-conflit-table: #6a9400; }',
  ":root[data-theme='sombre'] { --couleur-a: #000000; --couleur-conflit: #ff8a80; --couleur-conflit-voisins: #c0689c; --couleur-conflit-table: #549c00; }",
  '',
].join('\n');

describe('sources de l’interface : les chaînes visibles en dur (§ 14.6)', () => {
  test('aucun composant de src/interface n’écrit de chaîne visible', () => {
    exigerVide(releverChainesEnDur(RACINE), 'chaînes en dur');
  });

  test('la garde relève un bouton « Modifier » et chaque forme refusée, à toute profondeur, et pas leurs voisines', () => {
    const fichiers = {
      'src/interface/A.svelte': '<button>Modifier</button>\n',
      'src/interface/plan/sous/B.svelte': composant({
        script: "  const t = (cle) => cle;\n  let x = $state(true);",
        gabarit: [
          '<p title="Titre du plan" aria-label={x ? \'Oui\' : t(\'k.non\')}>{t(\'k.titre\')} — {42}</p>',
          '<svg><text>…</text><tspan>{\'·\'}</tspan><desc> </desc><title>{t(\'k.svg\')}</title></svg>',
          '<input placeholder="{x} places" alt={`Image ${x}`} aria-roledescription="table" />',
          '<span>{`${x} places`}</span><span>{x ?? \'Aucun\'}</span><span>{x && \'Plein\'}</span>',
          '<span class="vide" data-x="Nom">{x} / {x}</span><img alt="" />',
          '<span style="content: \'Note\'">.</span>',
          '<!-- Commentaire écrit en dur -->',
        ].join('\n'),
        style: '  .vide::after { content: "Fin"; }\n  .vide::before { content: counter(rang) ". "; }',
      }),
      'src/interface/C.test.js': "export const a = '<button>Modifier</button>';\n",
      'src/interface/D.navigateur.test.js': "export const a = '<button>Modifier</button>';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverChainesEnDur), [
      'src/interface/A.svelte:1 texte « Modifier »',
      'src/interface/plan/sous/B.svelte:5 attribut aria-label « Oui »',
      'src/interface/plan/sous/B.svelte:5 attribut title « Titre du plan »',
      'src/interface/plan/sous/B.svelte:6 expression littérale « · »',
      'src/interface/plan/sous/B.svelte:6 texte « … »',
      'src/interface/plan/sous/B.svelte:7 attribut alt « Image »',
      'src/interface/plan/sous/B.svelte:7 attribut aria-roledescription « table »',
      'src/interface/plan/sous/B.svelte:7 attribut placeholder « places »',
      'src/interface/plan/sous/B.svelte:8 expression littérale « Aucun »',
      'src/interface/plan/sous/B.svelte:8 expression littérale « Plein »',
      'src/interface/plan/sous/B.svelte:8 expression littérale « places »',
      'src/interface/plan/sous/B.svelte:10 content « content: \'Note\' »',
      'src/interface/plan/sous/B.svelte:13 content « "Fin" »',
    ]);
  });

  test('un arbre sans composant fait échouer la garde', () => {
    assert.throws(
      () => avecArbre({ 'src/interface/a.js': 'export const a = 1;\n' }, releverChainesEnDur),
      /chaînes en dur : aucun fichier examiné/,
    );
  });
});

describe('sources de l’interface : les clés littérales de t existent (§ 14.6, § 19.11)', () => {
  test('chaque clé littérale passée à t dans src/interface existe dans les tables assemblées', () => {
    exigerVide(releverClesAbsentes(RACINE, CLES), 'clés de t');
  });

  test('la garde relève une clé absente, dans un composant comme dans un module, et pas une clé présente ni composée', () => {
    const cles = new Set(['k.present']);
    const fichiers = {
      'src/interface/A.svelte': composant({
        script: "  import { getContext } from 'svelte';\n  const t = getContext('t');\n  const a = t('k.absente');",
        gabarit: "<p>{t('k.present')}</p>\n<p>{t(`k.gabarit`)}</p>\n<p>{t(`k.${a}`)}</p>\n<p>{traduction.t(\"k.membre\")}</p>",
      }),
      'src/interface/plan/modele.js': [
        '// t(\'k.commentaire\') ne compte pas.',
        "export const cle = (t) => t('k.module', { n: 1 });",
        "export const autre = (texte) => texte('k.texte');",
        '',
      ].join('\n'),
      'src/interface/plan/modele.test.js': "t('k.epreuve');\n",
    };
    assert.deepEqual(avecArbre(fichiers, (racine) => releverClesAbsentes(racine, cles)), [
      'src/interface/A.svelte:4 clé absente « k.absente »',
      'src/interface/A.svelte:7 clé absente « k.gabarit »',
      'src/interface/A.svelte:9 clé absente « k.membre »',
      'src/interface/plan/modele.js:2 clé absente « k.module »',
    ]);
  });

  test('un arbre sans source d’interface fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/application/a.js': '' }, (r) => releverClesAbsentes(r, CLES)), /aucun fichier examiné/);
  });

  test('des sources d’interface sans aucune clé littérale passée à t font échouer la garde', () => {
    const fichiers = {
      'src/interface/A.svelte': "<p>{tr('k.absente')}</p>\n",
      'src/interface/B.svelte': composant({
        script: "  import { getContext } from 'svelte';\n  const traduire = getContext('t');",
        gabarit: "<p>{traduire('plan.x')}</p>\n<p>{t(cle)}</p>",
      }),
      'src/interface/c.js': "export const d = (t, n) => t(`k.${n}`);\n",
    };
    assert.throws(() => avecArbre(fichiers, (r) => releverClesAbsentes(r, CLES)), /clés de t : aucune clé examinée/);
  });
});

describe('sources de l’interface : le contenu des tables de traduction (§ 5.5, § 7.6, § 7.7, § 12.8)', () => {
  test('aucune valeur des tables assemblées ne porte un mot refusé ni un pictogramme', () => {
    exigerVide(releverContenuTables([...TABLES_APPLICATION, ...TABLES_INTERFACE], localisateur(RACINE)), 'contenu des tables');
  });

  test('la garde relève chaque mot refusé, sans égard à la casse ni aux accents, dans une chaîne et dans une fonction', () => {
    const refusees = new Map([
      ['a.conforme', 'Conforme'],
      ['a.nonConforme', 'Plan non conforme'],
      ['a.conformite', 'CONFORMITÉ'],
      ['a.ecart', ({ n }) => `Un écart de ${n}`],
      ['a.ecartSeul', (details, texte) => texte('a.ecart', details)],
      ['a.ecartType', 'Écart-type'],
      ['a.satisfaction', 'Taux de satisfaction'],
      ['a.variance', 'variance'],
      ['a.equite', 'Équité'],
      ['a.score', 'Score'],
      ['a.mieux', 'Peut mieux faire'],
      ['a.minimal', 'Manque minimal'],
      ['a.recuperable', 'récupérable'],
      ['a.evitable', 'Évitable'],
      ['a.emoji', ({ n }) => `${n} \u{1F512}`],
      ['a.copyright', '\u{00A9} Club des Merles'],
    ]);
    const admises = new Map([
      ['b.itineraire', 'Écart d\u{2019}itinéraire'],
      ['b.itineraires', "écarts d'itinéraire maximal"],
      ['b.plafond', 'Écart au plafond a priori'],
      ['b.inevitable', 'Inévitable'],
      ['b.ecartee', 'Proposition écartée'],
      ['b.fleche', 'Tour 1 \u{2192} tour 2'],
      ['b.nom', 'Iris Ombrelle'],
      ['b.variable', ({ n }) => {
        const ecart = n + 1;
        return `Tour ${ecart}`;
      }],
    ]);
    assert.deepEqual(releverContenuTables([refusees, admises], () => null, []), [
      "a.conforme : conforme « Conforme »",
      'a.conformite : conforme « CONFORMITÉ »',
      'a.copyright : pictogramme U+00A9 « © Club des Merles »',
      'a.ecart : écart hors du glossaire « Un écart de »',
      'a.ecartType : écart hors du glossaire « Écart-type »',
      'a.ecartType : écart-type « Écart-type »',
      'a.emoji : pictogramme U+1F512 « \u{1F512} »',
      'a.equite : équité « Équité »',
      'a.evitable : évitable « Évitable »',
      'a.mieux : peut mieux faire « Peut mieux faire »',
      'a.minimal : manque minimal « Manque minimal »',
      'a.nonConforme : conforme « Plan non conforme »',
      'a.recuperable : récupérable « récupérable »',
      'a.satisfaction : satisfaction « Taux de satisfaction »',
      'a.score : score « Score »',
      'a.variance : variance « variance »',
    ]);
  });

  test('la garde nomme le fichier et la ligne de la clé fautive, et lève sur des tables vides', () => {
    const fichiers = {
      'src/interface/libelles/plan.js': "export const TABLE = new Map([\n  ['plan.a', 'A'],\n  [\n    'plan.b',\n    'Score',\n  ],\n]);\n",
    };
    const releves = avecArbre(fichiers, (racine) =>
      releverContenuTables([new Map([['plan.a', 'A'], ['plan.b', 'Score']])], localisateur(racine), []),
    );
    assert.deepEqual(releves, ['src/interface/libelles/plan.js:3 plan.b : score « Score »']);
    assert.throws(() => releverContenuTables([new Map()]), /aucune entrée examinée/);
  });

  test('une exception nommée n’admet que sa forme, sous ses clés ; tout autre « évitable » se relève, et une exception que rien ne sert est sans objet', () => {
    const tables = new Map([
      ['diagnostic.remede.un', '2 chaises de plus la rend évitable'],
      ['diagnostic.remede.deux', ({ n }) => (n === 1 ? 'une table la rend évitable' : `${n} tables la rendent évitable`)],
      ['diagnostic.remede.reste', 'la rend évitable, part évitable'],
      ['diagnostic.remede.autre', 'la place devient évitable'],
      ['diagnostic.titre', 'un tabouret la rend évitable'],
      ['plan.segment', 'la rend évitable'],
      ['diagnostic.remede.inevitable', 'inévitable'],
    ]);
    assert.deepEqual(releverContenuTables([tables]), [
      'diagnostic.remede.autre : évitable « la place devient évitable »',
      'diagnostic.remede.reste : évitable « la rend évitable, part évitable »',
      'diagnostic.titre : évitable « un tabouret la rend évitable »',
      'plan.segment : évitable « la rend évitable »',
    ]);
    const sansRemede = new Map([['diagnostic.remede.un', 'ajouter une table']]);
    assert.deepEqual(releverContenuTables([sansRemede]), ['exception sans objet : diagnostic.remede.* « la rend(ent) évitable »']);
  });
});

describe('sources de l’interface : les couleurs (§ 12.7, § 13.3, § 13.5)', () => {
  test('aucun littéral de couleur, aucun jeton déclaré hors de jetons.css, le jeton de conflit lu par les seules règles de conflit du plan', () => {
    exigerVide(releverCouleurs(RACINE), 'couleurs');
  });

  test('chaque jeton de couleur est défini dans les deux thèmes', () => {
    exigerVide(releverThemes(RACINE), 'thèmes');
  });

  test('la garde relève stroke: #c00 et chaque littéral, et pas un jeton ni une adresse de motif', () => {
    const fichiers = {
      'src/interface/jetons.css': JETONS_EPREUVE,
      'src/interface/plan/A.svelte': composant({
        gabarit: '<g class="table"><circle r="1" /></g>',
        style: [
          '  .table { stroke: #c00; }',
          '  .table circle { fill: url(#hachure); stroke: var(--couleur-a); }',
          '  circle { color: rgb(1 2 3); background: Tomato; border-color: transparent currentColor; }',
          '  .table { outline-color: var(--couleur-a, white); --rang: 2; }',
        ].join('\n'),
      }),
      'src/interface/accueil/sous/B.svelte': composant({
        script: "  const couleur = '#ABCDEF';\n  const code = 'orange-sanguine';",
        gabarit: '<svg><rect fill="red" stroke={x ? \'hsl(0 0% 0%)\' : \'none\'} style="color: #fff; --ombre: 1px" style:fill="Canvas" /></svg>\n<Bouton --teinte="1" />',
      }),
      'src/interface/autre.css': '.x { color: #123456; }\n',
      'src/interface/C.navigateur.test.js': "const c = 'stroke: #c00';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverCouleurs), [
      'src/interface/accueil/sous/B.svelte:2 couleur « #ABCDEF » dans le script',
      'src/interface/accueil/sous/B.svelte:5 couleur « #fff » dans color',
      'src/interface/accueil/sous/B.svelte:5 couleur « Canvas » dans fill',
      'src/interface/accueil/sous/B.svelte:5 couleur « hsl( » dans stroke',
      'src/interface/accueil/sous/B.svelte:5 couleur « red » dans fill',
      'src/interface/accueil/sous/B.svelte:5 jeton déclaré --ombre',
      'src/interface/accueil/sous/B.svelte:6 jeton déclaré --teinte',
      'src/interface/autre.css:1 couleur « #123456 » dans color',
      'src/interface/plan/A.svelte:3 couleur « #c00 » dans stroke',
      'src/interface/plan/A.svelte:5 couleur « Tomato » dans background',
      'src/interface/plan/A.svelte:5 couleur « rgb( » dans color',
      'src/interface/plan/A.svelte:6 couleur « white » dans outline-color',
      'src/interface/plan/A.svelte:6 jeton déclaré --rang',
    ]);
  });

  test('la garde relève un bouton peint du jeton de conflit, et l’admet dans une règle de conflit du plan', () => {
    const fichiers = {
      'src/interface/jetons.css': JETONS_EPREUVE,
      'src/interface/accueil/Bouton.svelte': composant({
        gabarit: '<button class="danger">x</button>',
        style: '  .danger { color: var(--couleur-conflit); }',
      }),
      'src/interface/plan/Table.svelte': composant({
        gabarit: '<g class:conflit={true} class="table"><rect /></g><span style="color: var(--couleur-conflit)">1</span>',
        style: '  .table.conflit rect { stroke: var(--couleur-conflit); }\n  .table rect { fill: var(--couleur-conflit); }',
      }),
      'src/interface/plan/Trou.svelte': composant({
        gabarit: '<g class="table b"><rect /></g><button class="sans-conflit">x</button><i class="non-conflit a"></i>',
        style: [
          '  .table:not(.conflit) rect { fill: var(--couleur-conflit); }',
          '  .sans-conflit { color: var(--couleur-conflit); }',
          '  .non-conflit { color: var(--couleur-conflit); }',
          '  .a, .b.conflit { fill: var(--couleur-conflit); }',
          '  .conflit-leve { fill: var(--couleur-conflit); }',
          '  .b.conflit, .b .trait-conflit, .plateau-en-conflit { stroke: var(--couleur-conflit); }',
        ].join('\n'),
      }),
    };
    assert.deepEqual(avecArbre(fichiers, releverCouleurs), [
      "src/interface/accueil/Bouton.svelte:3 jeton de conflit hors d'une règle de conflit du plan, « .danger »",
      "src/interface/plan/Table.svelte:1 jeton de conflit hors d'une règle de conflit du plan, en ligne",
      "src/interface/plan/Table.svelte:4 jeton de conflit hors d'une règle de conflit du plan, « .table rect »",
      "src/interface/plan/Trou.svelte:3 jeton de conflit hors d'une règle de conflit du plan, « .table:not(.conflit) rect »",
      "src/interface/plan/Trou.svelte:4 jeton de conflit hors d'une règle de conflit du plan, « .sans-conflit »",
      "src/interface/plan/Trou.svelte:5 jeton de conflit hors d'une règle de conflit du plan, « .non-conflit »",
      "src/interface/plan/Trou.svelte:6 jeton de conflit hors d'une règle de conflit du plan, « .a, .b.conflit »",
      "src/interface/plan/Trou.svelte:7 jeton de conflit hors d'une règle de conflit du plan, « .conflit-leve »",
    ]);
  });

  test('la garde relève chaque teinte de conflit — toute la famille --couleur-conflit-… — lue hors d’une règle de conflit du plan, et l’admet dans une règle de conflit du plan', () => {
    const fichiers = {
      'src/interface/jetons.css': JETONS_EPREUVE,
      'src/interface/accueil/Alerte.svelte': composant({
        script: "  const teinte = 'var(--couleur-conflit-table)';",
        gabarit: '<p class="alerte">x</p>',
        style: '  .alerte { color: var(--couleur-conflit-voisins); }',
      }),
      'src/interface/plan/Motif.svelte': composant({
        gabarit: '<svg><line class="trait voisins-conflit" /><line class="trait table-conflit" /><circle class="trait" style="fill: var(--couleur-conflit-table)" /></svg>',
        style: [
          '  .trait.voisins-conflit { stroke: var(--couleur-conflit-voisins); }',
          '  .trait.table-conflit { stroke: var(--couleur-conflit-table); }',
          '  .trait { fill: var(--couleur-conflit-voisins); }',
          '  .conflit-voisins { fill: var(--couleur-conflit-table); }',
        ].join('\n'),
      }),
    };
    assert.deepEqual(avecArbre(fichiers, releverCouleurs), [
      "src/interface/accueil/Alerte.svelte:2 jeton de conflit hors d'une règle de conflit du plan, dans le script",
      "src/interface/accueil/Alerte.svelte:6 jeton de conflit hors d'une règle de conflit du plan, « .alerte »",
      "src/interface/plan/Motif.svelte:1 jeton de conflit hors d'une règle de conflit du plan, en ligne",
      "src/interface/plan/Motif.svelte:5 jeton de conflit hors d'une règle de conflit du plan, « .trait »",
      "src/interface/plan/Motif.svelte:6 jeton de conflit hors d'une règle de conflit du plan, « .conflit-voisins »",
    ]);
  });

  test('la garde des thèmes relève un jeton qu’un thème ne redéfinit pas', () => {
    const fichiers = {
      'src/interface/jetons.css': [
        ':root { --espace-1: 1px; }',
        ':root, :root[data-theme="clair"] { --couleur-sol: #fff; --couleur-gel: #00f; }',
        ":root[data-theme='sombre'] { --couleur-sol: #000; --couleur-fantome: #0f0; }",
        '',
      ].join('\n'),
    };
    assert.deepEqual(avecArbre(fichiers, releverThemes), [
      'src/interface/jetons.css:2 --couleur-gel absent du thème sombre',
      'src/interface/jetons.css:3 --couleur-fantome absent du thème clair',
    ]);
  });

  test('un arbre sans composant ni feuille fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/interface/jetons.css': JETONS_EPREUVE }, releverCouleurs), /couleurs : aucun fichier examiné/);
  });

  test('une feuille des jetons sans jeton de couleur fait échouer la garde des thèmes', () => {
    const fichiers = { 'src/interface/jetons.css': ':root, :root[data-theme="clair"] { --espace-1: 1px; }\n' };
    assert.throws(() => avecArbre(fichiers, releverThemes), /thèmes : aucun jeton de couleur examiné/);
  });
});

describe('sources de l’interface : balisage et fenêtres du navigateur (§ 13.1, § 2.1)', () => {
  test('aucun balisage injecté, aucune fenêtre du navigateur, aucun beforeunload, aucun .message affiché', () => {
    exigerVide(releverBalisageEtFenetres(RACINE), 'balisage et fenêtres');
  });

  test('la garde relève {@html nom} et chaque forme refusée, et pas leurs voisines ni un commentaire', () => {
    const fichiers = {
      'src/interface/A.svelte': composant({
        script: "  let nom = $state('');\n  // aucun beforeunload, jamais alert(…) ni err.message",
        gabarit: '<p>{@html nom}</p>\n<svelte:window onbeforeunload={() => {}} />',
      }),
      'src/interface/plan/sous/b.js': [
        'export function f(el, erreur, seance) {',
        "  el.innerHTML = '';",
        "  el['outerHTML'] = '';",
        "  el.insertAdjacentHTML('beforeend', '');",
        "  document.write('x');",
        "  window.alert('x'); confirm('x'); globalThis.prompt('x');",
        "  addEventListener('beforeunload', f);",
        '  return erreur.message ?? erreur?.message;',
        '}',
        'export const voisins = (s) => [s.confirmer(), s.alert(), s.textContent, s.code, s.messages];',
        '',
      ].join('\n'),
      'src/application/c.js': "export const m = (e) => e.message;\nexport const h = (el) => { el.innerHTML = ''; };\n",
      'src/interface/A.test.js': "window.confirm('x'); el.innerHTML = '';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverBalisageEtFenetres), [
      'src/application/c.js:2 innerHTML',
      'src/interface/A.svelte:5 {@html}',
      'src/interface/A.svelte:6 beforeunload',
      'src/interface/plan/sous/b.js:2 innerHTML',
      'src/interface/plan/sous/b.js:3 outerHTML',
      'src/interface/plan/sous/b.js:4 insertAdjacentHTML',
      'src/interface/plan/sous/b.js:5 document.write',
      'src/interface/plan/sous/b.js:6 alert(',
      'src/interface/plan/sous/b.js:6 confirm(',
      'src/interface/plan/sous/b.js:6 prompt(',
      'src/interface/plan/sous/b.js:7 beforeunload',
      'src/interface/plan/sous/b.js:8 .message',
      'src/interface/plan/sous/b.js:8 .message',
    ]);
  });

  test('un arbre sans source fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/interface/a.css': '' }, releverBalisageEtFenetres), /aucun fichier examiné/);
  });
});

describe('sources de l’interface : texte comprimé et animations (§ 7.4, § 19.2)', () => {
  test('ni textLength ni lengthAdjust, ni transitionend ni animationend, ni transition ni animation', () => {
    exigerVide(releverTexteEtAnimation(RACINE), 'texte et animation');
  });

  test('la garde relève chaque forme dans son périmètre, et pas hors de lui ni dans un commentaire', () => {
    const fichiers = {
      'src/interface/plan/A.svelte': composant({
        script: "  import { fade } from 'svelte/transition';\n  // ni textLength ni transitionend",
        gabarit: [
          '<text textLength="10" lengthAdjust="spacing">{x}</text>',
          '<div transition:fade ontransitionend={f}></div><p in:fade out:fade></p>',
        ].join('\n'),
        style: '  div { transition: opacity 1s; animation: none; transition-duration: 0s; }\n  @keyframes pulse { to { opacity: 1; } }',
      }),
      'src/geometrie/texte.js': [
        "export const f = (el) => el.setAttribute('textLength', 1);",
        "export const g = 'transitionend';",
        'export const h = (el) => el.getComputedTextLength();',
        "export const i = '[textLength], [lengthAdjust]';",
        '',
      ].join('\n'),
      'src/interface/b.js': "export const f = (el) => el.addEventListener('animationend', f);\n",
      'src/application/c.js': "export const f = 'textLength';\n",
      'src/interface/A.navigateur.test.js': "export const f = '[textLength], [lengthAdjust]';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverTexteEtAnimation), [
      'src/geometrie/texte.js:1 textLength',
      'src/geometrie/texte.js:4 textLength',
      'src/interface/b.js:1 animationend',
      'src/interface/plan/A.svelte:5 lengthAdjust',
      'src/interface/plan/A.svelte:5 textLength',
      'src/interface/plan/A.svelte:6 directive in:fade',
      'src/interface/plan/A.svelte:6 directive out:fade',
      'src/interface/plan/A.svelte:6 directive transition:fade',
      'src/interface/plan/A.svelte:6 transitionend',
      'src/interface/plan/A.svelte:8 transition: opacity 1s',
      'src/interface/plan/A.svelte:9 @keyframes',
    ]);
  });

  test('un arbre sans source fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/application/a.js': '' }, releverTexteEtAnimation), /aucun fichier examiné/);
  });
});

describe('sources de l’interface : le câblage (§ 12.9, § 13.3)', () => {
  test('aucun composant ne calcule, et seul evaluation.js importe les mesures', () => {
    exigerVide(releverCablage(RACINE), 'câblage');
  });

  test('la garde relève Math., .sort( et .reduce( dans un composant, et l’import d’une mesure hors d’evaluation.js', () => {
    const fichiers = {
      'src/interface/plan/A.svelte': composant({
        script: '  let liste = $state([]);\n  const tries = $derived(liste.toSorted());\n  // Math.max, liste.sort()',
        gabarit: '<p>{Math.round(liste.length)}</p>\n<p>{liste.reduce((s, x) => s + x, 0)}</p>\n<p>{liste.sort().join()}</p>\n<p>{liste.filter(Boolean).length}</p>',
      }),
      'src/interface/b.js': 'export const f = (l) => Math.max(...l.sort());\n',
      'src/application/evaluation.js': "import { mesurer, manques } from '../moteur/indicateurs.js';\nexport { mesurer };\n",
      'src/application/generation.js': [
        "import { troisChiffres as chiffres } from '../moteur/indicateurs.js';",
        "import * as indicateurs from '../moteur/indicateurs.js';",
        "export { minimumAtteint } from '../moteur/indicateurs.js';",
        'export const f = (x) => indicateurs.plafondsRealises(x) + indicateurs.autre(x);',
        "import { evaluer } from './evaluation.js';",
        '',
      ].join('\n'),
      'src/application/generation.test.js': "import { mesurer } from '../moteur/indicateurs.js';\n",
    };
    assert.deepEqual(avecArbre(fichiers, releverCablage), [
      'src/application/generation.js:1 import de troisChiffres',
      'src/application/generation.js:3 import de minimumAtteint',
      'src/application/generation.js:4 import de plafondsRealises',
      'src/interface/plan/A.svelte:3 .toSorted(',
      'src/interface/plan/A.svelte:6 Math.round',
      'src/interface/plan/A.svelte:7 .reduce(',
      'src/interface/plan/A.svelte:8 .sort(',
    ]);
  });

  test('un arbre sans composant fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/application/a.js': '' }, releverCablage), /câblage des composants : aucun fichier examiné/);
  });
});

describe('sources de l’interface : les sélecteurs élagués (§ 13.3, § 14.2)', () => {
  test('aucun composant ne porte une règle que le compilateur élague', () => {
    exigerVide(releverSelecteursElagues(RACINE), 'sélecteurs élagués');
  });

  test('la garde relève une règle .conflit qui vise un élément sans classe dynamique, et admet class:conflit', () => {
    const fichiers = {
      'src/interface/plan/sous/Table.svelte': composant({
        gabarit: '<g class="table"><rect /></g>',
        style: '  .table { stroke-width: 1; }\n  .table.conflit rect { stroke-width: 3; }',
      }),
      'src/interface/plan/Table2.svelte': composant({
        script: '  let { conflit } = $props();',
        gabarit: '<g class="table" class:conflit><rect /></g>',
        style: '  .table.conflit rect { stroke-width: 3; }',
      }),
    };
    assert.deepEqual(avecArbre(fichiers, releverSelecteursElagues), [
      'src/interface/plan/sous/Table.svelte:4 sélecteur élagué « .table.conflit rect »',
    ]);
  });

  test('un arbre sans composant fait échouer la garde', () => {
    assert.throws(() => avecArbre({ 'src/interface/a.js': '' }, releverSelecteursElagues), /aucun fichier examiné/);
  });
});
