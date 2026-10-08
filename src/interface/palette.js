// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La palette se valide par calcul (§ 12.7, § 14.5). Le module lit les jetons
// de couleur dans le texte de jetons.css, simule les trois dichromaties,
// mesure le contraste au sens des WCAG et l'écart perçu entre deux
// couleurs, et contrôle les teintes réservées aux conflits. Il est pur : il
// reçoit le texte de la feuille, ne lit aucun fichier et ne touche pas le
// document.
//
// Une couleur est un tableau [r, g, b, a] : composantes sRGB de 0 à 255,
// alpha de 0 à 1.

const THEMES = ['clair', 'sombre'];

// Ordre des simulations dans les fautes rendues : il ne dépend pas de l'ordre
// des clés de SIMULATIONS.
const ORDRE_SIMULATIONS = ['protanopie', 'deuteranopie', 'tritanopie'];

// Une couleur se lit chromatique quand sa plus grande et sa plus petite
// composante s'écartent d'au moins SEUIL_CHROMATIQUE sur 255 ; en deçà, elle
// se lit grise et sa teinte n'a pas de sens. Deux teintes nommées voisines,
// le rouge et l'orange, se tiennent à ECART_TEINTE degrés.
const SEUIL_CHROMATIQUE = 26;
const ECART_TEINTE = 30;

const PREFIXE_COULEUR = '--couleur-';

// Les seuls sélecteurs sous lesquels une couleur se déclare : :root, ce qui
// s'applique sans attribut, et un bloc par thème.
const SELECTEURS_COULEUR = [':root', ...THEMES.map((t) => `:root[data-theme='${t}']`)];

/** Matrices de Machado, Oliveira et Fernandes (2009), sévérité 1, appliquées en
 *  RGB linéaire. Chaque ligne somme à 1 : le blanc et le noir sont des points
 *  fixes, et un gris reste gris. */
export const SIMULATIONS = Object.freeze({
  protanopie: Object.freeze([
    Object.freeze([0.152286, 1.052583, -0.204868]),
    Object.freeze([0.114503, 0.786281, 0.099216]),
    Object.freeze([-0.003882, -0.048116, 1.051998]),
  ]),
  deuteranopie: Object.freeze([
    Object.freeze([0.367322, 0.860646, -0.227968]),
    Object.freeze([0.280085, 0.672501, 0.047413]),
    Object.freeze([-0.01182, 0.04294, 0.968881]),
  ]),
  tritanopie: Object.freeze([
    Object.freeze([1.255528, -0.076749, -0.178779]),
    Object.freeze([-0.078411, 0.930809, 0.147602]),
    Object.freeze([0.004733, 0.691367, 0.3039]),
  ]),
});

/** Les blocs de règles d'une feuille, dans leur ordre : { selecteurs, declarations },
 *  selecteurs la liste des sélecteurs, espaces resserrés et guillemets
 *  d'attribut ramenés à l'apostrophe ; declarations une Map propriété → valeur
 *  brute, la dernière déclaration d'une propriété l'emportant. Les commentaires
 *  sont ôtés. Un bloc imbriqué (@media, @supports) ou non fermé lève : la
 *  feuille de jetons n'en porte aucun, et un thème caché dans une règle
 *  conditionnelle échapperait à la lecture. */
export function lireBlocs(texteCss) {
  const texte = texteCss.replace(/\/\*[\s\S]*?\*\//g, '');
  const blocs = [];
  let debut = 0;
  for (;;) {
    const ouvrant = texte.indexOf('{', debut);
    if (ouvrant === -1) {
      if (texte.slice(debut).includes('}')) {
        throw new Error('accolade fermante sans bloc ouvert');
      }
      break;
    }
    const fermant = texte.indexOf('}', ouvrant);
    if (fermant === -1) {
      throw new Error(`bloc non fermé : ${texte.slice(debut, ouvrant).trim()}`);
    }
    const imbrique = texte.indexOf('{', ouvrant + 1);
    if (imbrique !== -1 && imbrique < fermant) {
      throw new Error(`bloc imbriqué non lu : ${texte.slice(debut, ouvrant).trim()}`);
    }
    const selecteurs = texte
      .slice(debut, ouvrant)
      .split(',')
      .map((s) => s.trim().replace(/\s+/g, ' ').replace(/"/g, "'"));
    const declarations = new Map();
    for (const declaration of texte.slice(ouvrant + 1, fermant).split(';')) {
      const deuxPoints = declaration.indexOf(':');
      if (deuxPoints === -1) continue;
      const nom = declaration.slice(0, deuxPoints).trim();
      const valeur = declaration.slice(deuxPoints + 1).trim();
      if (nom !== '') declarations.set(nom, valeur);
    }
    blocs.push({ selecteurs, declarations });
    debut = fermant + 1;
  }
  return blocs;
}

// [r, g, b, a] d'une valeur de couleur littérale, ou null pour une forme que le
// module ne lit pas. Formes lues : #rgb, #rgba, #rrggbb, #rrggbbaa,
// rgb()/rgba() à virgules ou à espaces, alpha en nombre ou en pourcentage,
// transparent.
function couleurLitterale(valeur) {
  const v = valeur.trim().toLowerCase();
  if (v === 'transparent') return [0, 0, 0, 0];
  const h = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.exec(v);
  if (h !== null) {
    const chiffres = h[1].length <= 4 ? [...h[1]].map((c) => c + c) : h[1].match(/../g);
    const [r, g, b, a = 'ff'] = chiffres;
    return [...[r, g, b].map((x) => Number.parseInt(x, 16)), a === 'ff' ? 1 : Number.parseInt(a, 16) / 255];
  }
  const f = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)\s*(?:[,/]\s*([\d.]+)(%?)\s*)?\)$/.exec(v);
  if (f !== null) {
    const alpha = f[4] === undefined ? 1 : Number(f[4]) / (f[5] === '%' ? 100 : 1);
    return [Number(f[1]), Number(f[2]), Number(f[3]), alpha];
  }
  return null;
}

/** Couleurs d'un thème lues dans le texte de jetons.css : Map nom → [r, g, b, a],
 *  dans l'ordre des déclarations. Un jeton de couleur est une propriété
 *  --couleur-… ; il vaut une couleur littérale ou var(--couleur-…) d'un autre
 *  jeton du même thème. theme 'clair' ou 'sombre' : les blocs dont un sélecteur
 *  est :root[data-theme='<theme>'] ; theme null : les blocs dont un sélecteur
 *  est :root seul, ce qui s'applique sans attribut. Lève sur un thème sans
 *  bloc, une valeur illisible, un renvoi sans cible ou circulaire, et sur un
 *  bloc qui déclare une couleur sous un autre sélecteur que :root et
 *  :root[data-theme='clair' | 'sombre'] : dans le navigateur, il masquerait
 *  le jeton que la lecture mesure. */
export function lireJetons(texteCss, theme) {
  const tous = lireBlocs(texteCss);
  for (const bloc of tous) {
    const autres = bloc.selecteurs.filter((s) => !SELECTEURS_COULEUR.includes(s));
    const couleur = [...bloc.declarations.keys()].find((n) => n.startsWith(PREFIXE_COULEUR));
    if (autres.length > 0 && couleur !== undefined) {
      throw new Error(`couleur ${couleur} déclarée sous un sélecteur non lu : ${autres.join(', ')}`);
    }
  }
  const selecteur = theme === null ? ':root' : `:root[data-theme='${theme}']`;
  const blocs = tous.filter((b) => b.selecteurs.includes(selecteur));
  if (blocs.length === 0) {
    throw new Error(`aucun bloc pour le thème ${theme}`);
  }
  const brutes = new Map();
  for (const bloc of blocs) {
    for (const [nom, valeur] of bloc.declarations) {
      if (nom.startsWith(PREFIXE_COULEUR)) brutes.set(nom, valeur);
    }
  }
  const resolues = new Map();
  const resoudre = (nom, chemin) => {
    if (resolues.has(nom)) return resolues.get(nom);
    if (chemin.includes(nom)) {
      throw new Error(`renvoi circulaire : ${[...chemin, nom].join(' → ')}`);
    }
    if (!brutes.has(nom)) {
      throw new Error(`jeton absent du thème ${theme} : ${nom}${chemin.length ? ` (lu par ${chemin.at(-1)})` : ''}`);
    }
    const valeur = brutes.get(nom);
    const renvoi = /^var\(\s*(--[\w-]+)\s*\)$/.exec(valeur);
    const couleur = renvoi !== null ? resoudre(renvoi[1], [...chemin, nom]) : couleurLitterale(valeur);
    if (couleur === null) {
      throw new Error(`couleur illisible, thème ${theme} : ${nom}: ${valeur}`);
    }
    resolues.set(nom, couleur);
    return couleur;
  };
  const jetons = new Map();
  for (const nom of brutes.keys()) {
    jetons.set(nom, resoudre(nom, []));
  }
  return jetons;
}

const versLineaire = (c) => {
  const s = c / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

const versSrgb = (l) => {
  const borne = Math.min(1, Math.max(0, l));
  const s = borne <= 0.0031308 ? borne * 12.92 : 1.055 * borne ** (1 / 2.4) - 0.055;
  return s * 255;
};

/** La couleur que voit une personne atteinte de la dichromatie nommée : la
 *  matrice s'applique aux composantes linéaires, le résultat est borné à
 *  [0, 1] puis rendu en sRGB, sans arrondi. Alpha inchangé. */
export function simuler(couleur, nomSimulation) {
  if (!Object.hasOwn(SIMULATIONS, nomSimulation)) {
    throw new Error(`simulation inconnue : ${nomSimulation}`);
  }
  const matrice = SIMULATIONS[nomSimulation];
  const lineaire = couleur.slice(0, 3).map(versLineaire);
  const simulee = matrice.map((ligne) => versSrgb(ligne[0] * lineaire[0] + ligne[1] * lineaire[1] + ligne[2] * lineaire[2]));
  return [...simulee, couleur[3] ?? 1];
}

function luminance(couleur) {
  const [r, g, b] = couleur.map(versLineaire);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Rapport de contraste des WCAG entre deux couleurs opaques, de 1 à 21,
 *  symétrique. La seule implémentation du dépôt (contrainte 1) :
 *  App.navigateur.test.js l'importe, test/navigateur/rendu.js la réexporte.
 *  Une couleur dont l'alpha est donné et différent de 1 lève : le ratio d'une
 *  couleur composée avec ce qui est dessous n'est pas celui de ses
 *  composantes. */
export function contraste(a, b) {
  for (const couleur of [a, b]) {
    if (couleur[3] !== undefined && couleur[3] !== 1) {
      throw new Error(`contraste d'une couleur à canal alpha ${couleur[3]} : [${couleur.join(', ')}]`);
    }
  }
  const la = luminance(a.slice(0, 3));
  const lb = luminance(b.slice(0, 3));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Chaque entrée tient son seuil sur chacun de ses fonds, sur les couleurs
 *  d'origine puis sous chaque simulation, dans les deux thèmes. entrees :
 *  [{jeton, fonds, seuil}], noms de jetons --couleur-…. Rend les fautes
 *  [{theme, simulation, jeton, fond, ratio, seuil}], simulation valant
 *  'origine' pour les couleurs d'origine, dans l'ordre thème, simulation,
 *  entrée, fond ; [] quand tout tient. Un jeton absent d'un thème lève. */
export function verifierPalette(texteCss, entrees) {
  const fautes = [];
  for (const theme of THEMES) {
    const jetons = lireJetons(texteCss, theme);
    const lire = (nom) => {
      if (!jetons.has(nom)) throw new Error(`jeton absent du thème ${theme} : ${nom}`);
      return jetons.get(nom);
    };
    for (const simulation of ['origine', ...ORDRE_SIMULATIONS]) {
      const vue = (c) => (simulation === 'origine' ? c : simuler(c, simulation));
      for (const { jeton, fonds, seuil } of entrees) {
        const couleur = vue(lire(jeton));
        for (const fond of fonds) {
          const ratio = contraste(couleur, vue(lire(fond)));
          if (ratio < seuil) fautes.push({ theme, simulation, jeton, fond, ratio, seuil });
        }
      }
    }
  }
  return fautes;
}

/** Teinte HSL d'une couleur en degrés, dans [0, 360), ou null quand sa plus
 *  grande et sa plus petite composante s'écartent de moins de
 *  SEUIL_CHROMATIQUE : la couleur se lit grise. */
export function teinte(couleur) {
  const [r, g, b] = couleur;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const etendue = max - min;
  if (etendue < SEUIL_CHROMATIQUE) return null;
  let h;
  if (max === r) h = ((g - b) / etendue) % 6;
  else if (max === g) h = (b - r) / etendue + 2;
  else h = (r - g) / etendue + 4;
  const degres = h * 60;
  return degres < 0 ? degres + 360 : degres;
}

/** § 12.7 : chaque teinte réservée — celles des conflits — est chromatique,
 *  et la teinte de chaque autre jeton chromatique se tient à ECART_TEINTE
 *  degrés au moins de chacune, dans chaque thème. Les teintes réservées ne
 *  se mesurent pas entre elles : verifierSeparation les distingue. Rend les
 *  fautes [{theme, reservee, jeton, ecart}], ecart en degrés sur le cercle,
 *  dans l'ordre thème, teinte réservée, jeton ; une teinte réservée
 *  achromatique est elle-même une faute, jeton égal à reservee et ecart
 *  null — aucune teinte n'est alors réservée. Un jeton réservé absent d'un
 *  thème lève. */
export function verifierTeintesReservees(texteCss, reservees) {
  const fautes = [];
  for (const theme of THEMES) {
    const jetons = lireJetons(texteCss, theme);
    for (const reservee of reservees) {
      if (!jetons.has(reservee)) throw new Error(`jeton absent du thème ${theme} : ${reservee}`);
      const reference = teinte(jetons.get(reservee));
      if (reference === null) {
        fautes.push({ theme, reservee, jeton: reservee, ecart: null });
        continue;
      }
      for (const [nom, couleur] of jetons) {
        if (reservees.includes(nom)) continue;
        const h = teinte(couleur);
        if (h === null) continue;
        const brut = Math.abs(h - reference);
        const ecart = Math.min(brut, 360 - brut);
        if (ecart < ECART_TEINTE) fautes.push({ theme, reservee, jeton: nom, ecart });
      }
    }
  }
  return fautes;
}

/** Les coordonnées OKLab [L, a, b] d'une couleur sRGB (Ottosson) : L vaut 0
 *  pour le noir et 1 pour le blanc, a et b sont nuls pour un gris. Les
 *  composantes passent en RGB linéaire, puis dans l'espace LMS, dont la
 *  racine cubique se recompose en L, a, b. Alpha ignoré. */
export function oklab(couleur) {
  const [r, g, b] = couleur.slice(0, 3).map(versLineaire);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

/** L'écart perçu entre deux couleurs : la distance euclidienne de leurs
 *  coordonnées OKLab, multipliée par 100 — 100 du noir au blanc, 0 d'une
 *  couleur à elle-même. Symétrique. Sous une dichromatie, il se mesure sur
 *  les couleurs simulées (§ 12.7 : simuler d'abord, puis mesurer). */
export function ecartPercu(a, b) {
  const [la, aa, ba] = oklab(a);
  const [lb, ab, bb] = oklab(b);
  return 100 * Math.hypot(la - lb, aa - ab, ba - bb);
}

/** Les jetons se distinguent, sur les couleurs d'origine puis sous chaque
 *  simulation, dans les deux thèmes : chaque paire de jetons, puis chaque
 *  jeton contre chacun des autres, tient un écart perçu (ecartPercu) d'au
 *  moins seuil ; les autres ne se mesurent pas entre eux. Rend les fautes
 *  [{theme, simulation, jeton, autre, ecart, seuil}], simulation valant
 *  'origine' pour les couleurs d'origine, dans l'ordre thème, simulation,
 *  paires de jetons, puis jetons contre autres ; [] quand tout tient. Un
 *  jeton absent d'un thème lève. */
export function verifierSeparation(texteCss, jetons, autres, seuil) {
  const paires = [];
  jetons.forEach((jeton, i) => {
    for (const autre of jetons.slice(i + 1)) paires.push([jeton, autre]);
  });
  for (const jeton of jetons) for (const autre of autres) paires.push([jeton, autre]);
  const fautes = [];
  for (const theme of THEMES) {
    const lus = lireJetons(texteCss, theme);
    const lire = (nom) => {
      if (!lus.has(nom)) throw new Error(`jeton absent du thème ${theme} : ${nom}`);
      return lus.get(nom);
    };
    for (const simulation of ['origine', ...ORDRE_SIMULATIONS]) {
      const vue = (c) => (simulation === 'origine' ? c : simuler(c, simulation));
      for (const [jeton, autre] of paires) {
        const ecart = ecartPercu(vue(lire(jeton)), vue(lire(autre)));
        if (ecart < seuil) fautes.push({ theme, simulation, jeton, autre, ecart, seuil });
      }
    }
  }
  return fautes;
}
