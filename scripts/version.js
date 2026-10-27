// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La version datée (§ 18). version.json en est l'unique source ; ce script en
// dérive tout le reste et contrôle que rien n'en diverge.
//
// Une version s'écrit sous quatre formes :
//   affichée   AAAA.MM.JJ.NN, quatre champs à longueur fixe, rang de 01 à 99 ;
//              son ordre alphabétique est l'ordre chronologique ;
//   technique  AAAA.(MM×100+JJ).NN, trois entiers sans zéro de tête, la forme
//              qu'exigent package.json et electron-builder ;
//   Windows    la forme technique suivie de « .0 » : les quatre champs de la
//              ressource de version de l'exécutable, de 16 bits chacun ;
//   nom        gestion_table_tournante_libre_v<AAAA>_<MM>_<JJ>_<NN>.exe, les
//              points devenus soulignés, seul point restant celui de
//              l'extension.
// Le jour étant inférieur à 100, MM×100+JJ se redécompose d'une seule façon :
// la dérivation est monotone et bijective.
//
// En ligne de commande, la racine du projet est le parent du répertoire du
// script :
//   node scripts/version.js engendrer   réécrit src/version.genere.js, le
//                                       champ version de package.json et les
//                                       deux champs de version du paquet
//                                       racine de package-lock.json ;
//   node scripts/version.js controler   applique les huit points du § 18.5 à
//                                       la date civile locale de la machine ;
//                                       imprime les échecs et sort en code 1,
//                                       ou sort en code 0.
// Ce script n'appartient ni au moteur ni au générateur de démonstrations, et
// l'interdit de lecture d'horloge du § 14.7 ne le vise pas : dateCivileLocale,
// qu'appelle la commande « controler », lit l'horloge de la machine.
import { mkdirSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Le nom du livrable (§ 18.2) ne s'écrit qu'ici : le produit, « _v », la
// version dont les points deviennent des soulignés, l'extension. nomDuLivrable
// sert à deriver pour une version et au gabarit pour les champs nommés ; le
// point 7 compare chaque nom cité à ce calcul.
const PRODUIT = 'gestion_table_tournante_libre';
const PREFIXE_NOM = `${PRODUIT}_v`;
const EXTENSION = '.exe';
const nomDuLivrable = (version) => `${PREFIXE_NOM}${version.replaceAll('.', '_')}${EXTENSION}`;
const GABARIT_NOM = nomDuLivrable('<AAAA>.<MM>.<JJ>.<NN>');
const UN_JOUR_MS = 86_400_000;

const MOIS = [
  'janvier', 'février', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre',
];

// Forme affichée AAAA.MM.JJ.NN. Le rang s'y lit aussi sur trois chiffres ou
// plus sans zéro de tête : la forme est alors reconnue, et le refus nomme le
// plafond du rang. Un rang « 001 » reste une faute de forme.
const FORME_AFFICHEE = /^(\d{4})\.(\d{2})\.(\d{2})\.(\d{2}|[1-9]\d{2,})$/;
// Trois entiers sans zéro de tête ; MM×100+JJ s'écrit sur trois ou quatre
// chiffres, le rang sur un ou deux.
const FORME_TECHNIQUE = /^(\d{4})\.([1-9]\d{2,3})\.([1-9]\d?)$/;

const deuxChiffres = (n) => String(n).padStart(2, '0');

function estBissextile(annee) {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

function joursDuMois(annee, mois) {
  if (mois === 2) return estBissextile(annee) ? 29 : 28;
  return mois === 4 || mois === 6 || mois === 9 || mois === 11 ? 30 : 31;
}

// Lève quand { annee, mois, jour } n'est pas une date du calendrier
// grégorien dont l'année s'écrit sur quatre chiffres sans zéro de tête — la
// forme technique écrit l'année en entier, et un zéro de tête s'y perdrait.
// « contexte » ouvre le message.
function exigerDate({ annee, mois, jour }, contexte) {
  if (!Number.isInteger(annee) || annee < 1000 || annee > 9999) {
    throw new RangeError(`${contexte} : année ${annee} hors de 1000 à 9999`);
  }
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    throw new RangeError(`${contexte} : mois ${mois} hors de 1 à 12`);
  }
  const dernier = joursDuMois(annee, mois);
  if (!Number.isInteger(jour) || jour < 1 || jour > dernier) {
    throw new RangeError(
      `${contexte} : jour ${jour} hors de 1 à ${dernier} en ${MOIS[mois - 1]} ${annee}`,
    );
  }
}

/**
 * Formes dérivées d'une version affichée AAAA.MM.JJ.NN : { affichee,
 * technique, windows, nomFichier, annee, mois, jour, rang }, les quatre
 * derniers en entiers. Lève sur une forme non conforme, une date civile
 * invalide, un rang hors de 1 à 99.
 */
export function deriver(versionAffichee) {
  if (typeof versionAffichee !== 'string') {
    throw new TypeError(`version attendue sous forme de chaîne, reçu ${typeof versionAffichee}`);
  }
  const contexte = `version « ${versionAffichee} »`;
  const champs = FORME_AFFICHEE.exec(versionAffichee);
  if (champs === null) {
    throw new Error(
      `${contexte} : forme attendue AAAA.MM.JJ.NN, quatre champs à longueur fixe (§ 18.1)`,
    );
  }
  const [annee, mois, jour, rang] = champs.slice(1).map(Number);
  exigerDate({ annee, mois, jour }, contexte);
  if (rang > 99) throw new RangeError(`${contexte} : rang ${rang}, le rang plafonne à 99 (§ 18.1)`);
  if (rang < 1) throw new RangeError(`${contexte} : rang 00 hors de 01 à 99`);
  const technique = `${annee}.${mois * 100 + jour}.${rang}`;
  return {
    affichee: versionAffichee,
    technique,
    windows: `${technique}.0`,
    nomFichier: nomDuLivrable(versionAffichee),
    annee,
    mois,
    jour,
    rang,
  };
}

/**
 * Version affichée d'une version technique AAAA.(MM×100+JJ).NN. Lève quand
 * la chaîne ne désigne pas exactement une version : forme non conforme, zéro
 * de tête, date civile invalide, rang hors de 1 à 99. Sur une chaîne
 * acceptée, deriver(redecomposer(t)).technique === t.
 */
export function redecomposer(versionTechnique) {
  if (typeof versionTechnique !== 'string') {
    throw new TypeError(
      `version technique attendue sous forme de chaîne, reçu ${typeof versionTechnique}`,
    );
  }
  const contexte = `version technique « ${versionTechnique} »`;
  const champs = FORME_TECHNIQUE.exec(versionTechnique);
  if (champs === null) {
    throw new Error(
      `${contexte} : forme attendue AAAA.(MM×100+JJ).NN, trois entiers sans zéro de tête, rang de 1 à 99 (§ 18.1)`,
    );
  }
  const [annee, moisJour, rang] = champs.slice(1).map(Number);
  const mois = Math.floor(moisJour / 100);
  const jour = moisJour % 100;
  exigerDate({ annee, mois, jour }, contexte);
  return `${annee}.${deuxChiffres(mois)}.${deuxChiffres(jour)}.${deuxChiffres(rang)}`;
}

/**
 * Date en toutes lettres du titre d'une section du changelog : « 9 mars
 * 2031 », « 1er janvier 2027 ». Lève sur une date hors du calendrier.
 */
export function dateEnLettres({ annee, mois, jour }) {
  exigerDate({ annee, mois, jour }, 'date');
  return `${jour === 1 ? '1er' : jour} ${MOIS[mois - 1]} ${annee}`;
}

// --- Le module engendré et les recopies ------------------------------------

const MODULE = 'src/version.genere.js';
const CONSEIL_ENGENDRER = 'lancer « node scripts/version.js engendrer »';

const EN_TETE_LICENCE = [
  '// © 2026 TechnoLibre (http://www.technolibre.ca)',
  '// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1',
];

/**
 * Contenu exact de src/version.genere.js pour une version affichée :
 * l'en-tête de licence, une ligne vide, puis la constante VERSION sous ses
 * formes affichée, technique et Windows — celle que le panneau « À propos »
 * met en regard de l'affichée (§ 18.6), sans la recalculer. Le module ne
 * porte que la version ; la provenance de la construction vient du mode de
 * Vite.
 */
export function engendrerModule(versionAffichee) {
  const { affichee, technique, windows } = deriver(versionAffichee);
  return [
    ...EN_TETE_LICENCE,
    '',
    '// Engendré par scripts/version.js depuis version.json — ne pas modifier.',
    'export const VERSION = Object.freeze({',
    `  affichee: '${affichee}',`,
    `  technique: '${technique}',`,
    `  windows: '${windows}',`,
    '});',
    '',
  ].join('\n');
}

// JSON écrit comme npm l'écrit : indentation de deux espaces, saut de ligne
// final.
const enJson = (valeur) => `${JSON.stringify(valeur, null, 2)}\n`;

// Contenu d'un fichier relatif à la racine, ou null s'il n'existe pas.
function lireTexte(racine, chemin) {
  try {
    return readFileSync(join(racine, chemin), 'utf8');
  } catch (erreur) {
    if (erreur.code === 'ENOENT') return null;
    throw erreur;
  }
}

// Valeur JSON d'un fichier relatif à la racine. Lève en nommant le fichier
// quand il est illisible, et quand il manque, avec « raisonSiAbsent » pour
// suite du message.
function lireJson(racine, chemin, raisonSiAbsent) {
  const texte = lireTexte(racine, chemin);
  if (texte === null) throw new Error(`${chemin} absent : ${raisonSiAbsent}`);
  try {
    return JSON.parse(texte);
  } catch (erreur) {
    throw new Error(`${chemin} illisible : ${erreur.message}`);
  }
}

// Version affichée que porte version.json, non vérifiée. Lève sur un
// fichier absent, illisible ou sans champ « version » textuel.
function lireVersion(racine) {
  const donnees = lireJson(racine, 'version.json', "c'est l'unique source de la version (§ 18.3)");
  if (typeof donnees?.version !== 'string') {
    throw new Error('version.json : champ « version » absent ou non textuel');
  }
  return donnees.version;
}

// Formes dérivées de la version de version.json. Chaque refus nomme
// version.json.
function versionDeLaSource(racine) {
  const affichee = lireVersion(racine);
  try {
    return deriver(affichee);
  } catch (erreur) {
    throw new Error(`version.json : ${erreur.message}`, { cause: erreur });
  }
}

// Vrai pour un objet JSON, ni tableau ni null.
const estObjet = (valeur) =>
  typeof valeur === 'object' && valeur !== null && !Array.isArray(valeur);

const RAISON_PAQUET = 'il porte la forme technique de la version (§ 18.3)';
const RAISON_VERROU = `« npm install » le crée, puis ${CONSEIL_ENGENDRER}`;

/**
 * Réécrit, depuis version.json, le module engendré, le champ version de
 * package.json et les champs version et packages[""].version de
 * package-lock.json, en forme technique. Tout est lu et vérifié avant la
 * première écriture : une version non conforme, un package.json ou un verrou
 * absent font lever sans rien écrire. Un fichier déjà à jour n'est pas
 * réécrit. Rend les chemins réécrits, relatifs à la racine.
 */
export function engendrer(racine) {
  const { affichee, technique } = versionDeLaSource(racine);
  const paquet = lireJson(racine, 'package.json', RAISON_PAQUET);
  if (!estObjet(paquet)) throw new Error('package.json : un objet JSON est attendu');
  const verrou = lireJson(racine, 'package-lock.json', RAISON_VERROU);
  if (!estObjet(verrou) || !estObjet(verrou.packages) || !estObjet(verrou.packages[''])) {
    throw new Error('package-lock.json : paquet racine packages[""] absent');
  }
  const cibles = [
    [MODULE, engendrerModule(affichee)],
    ['package.json', enJson({ ...paquet, version: technique })],
    [
      'package-lock.json',
      enJson({
        ...verrou,
        version: technique,
        packages: { ...verrou.packages, '': { ...verrou.packages[''], version: technique } },
      }),
    ],
  ];
  const reecrits = [];
  for (const [chemin, contenu] of cibles) {
    if (lireTexte(racine, chemin) === contenu) continue;
    mkdirSync(dirname(join(racine, chemin)), { recursive: true });
    writeFileSync(join(racine, chemin), contenu);
    reecrits.push(chemin);
  }
  return reecrits;
}

// --- Le contrôle du § 18.5 ------------------------------------------------

// Les deux lignes obligatoires de la section de tête du changelog (§ 18.4) :
// le libellé en gras, les deux-points, puis une réponse.
const LIGNES_OBLIGATOIRES = [
  ['**Version de format des fichiers**', /^\*\*Version de format des fichiers\*\*\s*:\s*\S/],
  ['**En remplaçant**', /^\*\*En remplaçant\*\*\s*:\s*\S/],
];

// Périmètre du balayage du point 6, posé ici et non après coup : les fichiers
// de la racine, et les arbres des sources, des fichiers que la page sert tels
// quels (public/), des scripts, de la coquille et des épreuves. Seuls ces
// arbres sont parcourus : les dépendances et les sorties de construction
// (www/, dist*/, android/) n'en font pas partie, et un répertoire
// node_modules n'est jamais descendu. En sont exclus :
// - version.json, package-lock.json, le module engendré et le changelog, où
//   la version se recopie par construction et que les points 1 à 3
//   contrôlent ;
// - les documents (*.md), dont le point 7 contrôle les noms cités ;
// - les épreuves de la dérivation, qui citent des versions par nécessité ;
// - les données d'épreuve, sous test/fixtures/ ;
// - les démonstrations livrées, sous src/demo/livrees/, données engendrées
//   dont l'en-tête porte la version de la construction qui les a écrites
//   (§ 18.5, § 18.6) : une livraison suivante ne les réécrit pas (§ 15.5,
//   point 5).
// Un répertoire s'exclut par son chemin exact, et rien n'est lu sous lui ;
// un fichier dont le nom commence comme le sien, src/demo/livrees.js, reste
// balayé.
// package.json reste balayé : la forme technique y est à sa place, la forme
// affichée non.
const ARBRES_BALAYES = ['src', 'public', 'scripts', 'electron', 'test'];
const FICHIERS_EXCLUS = new Set([
  'version.json',
  'package-lock.json',
  MODULE,
  'CHANGELOG.md',
  'scripts/version.test.js',
]);
const REPERTOIRES_EXCLUS = new Set(['test/fixtures', 'src/demo/livrees']);
const DOCUMENT = /\.md$/i;
const ARBRE_DES_SOURCES = 'src/';

// Une chaîne de chaque forme, bornée : ni chiffre ni point devant, aucun
// chiffre derrière. La forme Windows contient la forme technique.
const CHAINE_AFFICHEE = /(?<![\d.])\d{4}\.\d{2}\.\d{2}\.\d{2}(?!\d)/g;
const CHAINE_TECHNIQUE = /(?<![\d.])\d{4}\.\d{3,4}\.\d{1,2}(?!\d)/g;

// Documents du point 7, à la racine.
const DOCUMENTS_FIXES = ['README.md', 'CHANGELOG.md'];
const GUIDE = /^GUIDE-.*\.md$/;
const LITTERAL_NON_SUBSTITUE = /#_#/g;
// Un nom d'exécutable cité : depuis le nom du produit jusqu'à la première
// extension, sans blanc ni délimiteur de Markdown ou de code. La casse est
// ignorée à la recherche, pas à la conformité. Le préfixe seul, sans
// extension, désigne une famille de fichiers et n'est pas un nom.
const NOM_CITE = new RegExp(
  `${RegExp.escape(PRODUIT)}[^\\s\`'"()[\\]{}|*]*?${RegExp.escape(EXTENSION)}(?!\\w)`,
  'gi',
);

// Vrai quand le nom cité est le gabarit, ou le nom que deriver calcule pour
// la version dont il porte les chiffres, lus après le préfixe. Tout nom admis
// sort ainsi de deriver, à l'octet.
function nomConforme(nom) {
  if (nom === GABARIT_NOM) return true;
  const chiffres = nom.slice(PREFIXE_NOM.length).match(/\d+/g) ?? [];
  return essayer(() => deriver(chiffres.join('.')).nomFichier) === nom;
}

// Résultat de « calcul », ou null s'il lève.
function essayer(calcul) {
  try {
    return calcul();
  } catch {
    return null;
  }
}

// Ordre de deux versions dérivées, comparées champ par champ comme quatre
// entiers : négatif quand a précède b.
function comparerVersions(a, b) {
  return a.annee - b.annee || a.mois - b.mois || a.jour - b.jour || a.rang - b.rang;
}

// Rang d'une date civile dans le calendrier, en jours : la différence de
// deux rangs compte les jours qui séparent les deux dates.
const numeroDeJour = ({ annee, mois, jour }) => Date.UTC(annee, mois - 1, jour) / UN_JOUR_MS;

// { annee, mois, jour } d'une date civile AAAA-MM-JJ ; lève sur toute autre
// forme et sur une date hors du calendrier.
function lireDateCivile(dateCivile) {
  const champs =
    typeof dateCivile === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateCivile) : null;
  if (champs === null) {
    throw new TypeError(`dateCivile attendue sous la forme AAAA-MM-JJ, reçu ${String(dateCivile)}`);
  }
  const [annee, mois, jour] = champs.slice(1).map(Number);
  exigerDate({ annee, mois, jour }, `dateCivile « ${dateCivile} »`);
  return { annee, mois, jour };
}

// Sections du changelog : chaque titre « ## », avec son numéro de ligne, son
// texte et les lignes de son corps. Un bloc de code, de la ligne qui l'ouvre
// par ``` ou ~~~ à celle qui le ferme, n'apporte ni titre ni ligne de corps :
// ce qu'il contient s'affiche comme du code, et une ligne obligatoire citée
// là n'est pas écrite.
function sectionsDuChangelog(texte) {
  const sections = [];
  let dansUnBloc = false;
  texte.split(/\r?\n/).forEach((ligne, i) => {
    if (/^\s*(```|~~~)/.test(ligne)) {
      dansUnBloc = !dansUnBloc;
      return;
    }
    if (dansUnBloc) return;
    const titre = /^## (.*)$/.exec(ligne);
    if (titre !== null) {
      sections.push({ ligne: i + 1, titre: titre[1].trim(), corps: [] });
    } else if (sections.length > 0) {
      sections[sections.length - 1].corps.push(ligne);
    }
  });
  return sections;
}

// Chemins relatifs, en « / », des fichiers d'un arbre, sans descendre dans
// node_modules ni dans un répertoire exclu. Un arbre absent n'ajoute rien.
function parcourir(racine, arbre, chemins) {
  let entrees;
  try {
    entrees = readdirSync(join(racine, arbre), { withFileTypes: true });
  } catch (erreur) {
    if (erreur.code === 'ENOENT' || erreur.code === 'ENOTDIR') return;
    throw erreur;
  }
  for (const entree of entrees) {
    const chemin = `${arbre}/${entree.name}`;
    if (entree.isDirectory()) {
      if (entree.name !== 'node_modules' && !REPERTOIRES_EXCLUS.has(chemin)) {
        parcourir(racine, chemin, chemins);
      }
    } else if (entree.isFile()) {
      chemins.push(chemin);
    }
  }
}

// Fichiers de la racine, triés ; un répertoire ou un lien n'en est pas.
function fichiersDeLaRacine(racine) {
  return readdirSync(racine, { withFileTypes: true })
    .filter((entree) => entree.isFile())
    .map((entree) => entree.name)
    .sort();
}

// Fichiers du périmètre du point 6, triés.
function fichiersBalayes(racine) {
  const chemins = fichiersDeLaRacine(racine);
  for (const arbre of ARBRES_BALAYES) parcourir(racine, arbre, chemins);
  return chemins.filter((chemin) => !FICHIERS_EXCLUS.has(chemin) && !DOCUMENT.test(chemin)).sort();
}

// Chaque occurrence du motif dans le texte : { ligne, chaine }.
function occurrences(texte, motif) {
  const trouvees = [];
  texte.split(/\r?\n/).forEach((ligne, i) => {
    for (const [chaine] of ligne.matchAll(motif)) trouvees.push({ ligne: i + 1, chaine });
  });
  return trouvees;
}

// Point 1 : package.json et les deux champs du verrou portent la forme
// technique dérivée de version.json, et elle se redécompose en la version
// affichée.
function controlerRecopies(racine, { affichee, technique }, echec) {
  try {
    const porte = lireJson(racine, 'package.json', RAISON_PAQUET)?.version;
    const retour = essayer(() => redecomposer(porte));
    if (porte !== technique || retour !== affichee) {
      const lue = retour === null ? '' : ` (soit ${retour})`;
      echec(
        1,
        `package.json porte la version ${JSON.stringify(porte)}${lue}, version.json donne ${affichee}, soit ${technique} : ${CONSEIL_ENGENDRER}`,
      );
    }
  } catch (erreur) {
    echec(1, erreur.message);
  }
  try {
    const verrou = lireJson(racine, 'package-lock.json', RAISON_VERROU);
    const champs = [
      ['version', verrou?.version],
      ['packages[""].version', verrou?.packages?.['']?.version],
    ];
    for (const [champ, porte] of champs) {
      if (porte !== technique) {
        echec(
          1,
          `package-lock.json, champ « ${champ} » : ${JSON.stringify(porte)}, version.json donne ${technique} : ${CONSEIL_ENGENDRER}`,
        );
      }
    }
  } catch (erreur) {
    echec(1, erreur.message);
  }
}

// Point 2 : le module engendré reproduit, caractère pour caractère, ce que
// le script engendre ; l'échec cite la première ligne qui diffère.
function controlerModule(racine, { affichee }, echec) {
  const present = lireTexte(racine, MODULE);
  if (present === null) {
    echec(2, `${MODULE} absent : ${CONSEIL_ENGENDRER}`);
    return;
  }
  const attendu = engendrerModule(affichee);
  if (present === attendu) return;
  const lignesPresentes = present.split('\n');
  const lignesAttendues = attendu.split('\n');
  const longueur = Math.max(lignesPresentes.length, lignesAttendues.length);
  let i = 0;
  while (i < longueur && lignesPresentes[i] === lignesAttendues[i]) i += 1;
  const citer = (ligne) => (ligne === undefined ? 'la fin du fichier' : `« ${ligne} »`);
  echec(
    2,
    `${MODULE}, ligne ${i + 1} : ${citer(lignesPresentes[i])} au lieu de ${citer(lignesAttendues[i])}, que le script engendre : ${CONSEIL_ENGENDRER}`,
  );
}

// Point 3 : la section de tête porte la version courante, la date en lettres
// que cette version engendre, et les deux lignes obligatoires. Sans version
// valide, seules la forme du titre et les deux lignes se contrôlent.
function controlerTete(sections, version, echec) {
  const tete = sections[0];
  if (tete === undefined) {
    echec(3, 'CHANGELOG.md : aucune section « ## » ; la section de tête porte la version courante');
    return;
  }
  const lieu = `CHANGELOG.md, ligne ${tete.ligne}`;
  const titre = /^(\S+) — (.+)$/.exec(tete.titre);
  if (titre === null) {
    echec(3, `${lieu} : le titre « ## ${tete.titre} » n'a pas la forme « ## <version> — <date en lettres> »`);
  } else if (version !== null) {
    const [, porte, date] = titre;
    const attendue = dateEnLettres(version);
    if (porte !== version.affichee) {
      echec(
        3,
        `${lieu} : la section de tête porte ${porte}, version.json porte ${version.affichee} ; la section de cette version s'écrit en tête (§ 18.4)`,
      );
    } else if (date !== attendue) {
      echec(3, `${lieu} : la date « ${date} » n'est pas « ${attendue} », que la version ${porte} engendre`);
    }
  }
  for (const [libelle, motif] of LIGNES_OBLIGATOIRES) {
    if (!tete.corps.some((ligne) => motif.test(ligne))) {
      echec(3, `${lieu} : la ligne obligatoire « ${libelle} : … » manque à la section de tête (§ 18.4)`);
    }
  }
}

// Point 4 : chaque titre de section s'ouvre sur une version, aucune version
// n'est portée deux fois, et chaque section porte une version strictement
// antérieure à celle de la section qui la précède.
function controlerOrdre(sections, echec) {
  const vues = new Map();
  let precedente = null;
  for (const section of sections) {
    const version = essayer(() => deriver(section.titre.split(/\s/)[0]));
    if (version === null) {
      echec(
        4,
        `CHANGELOG.md, ligne ${section.ligne} : le titre « ## ${section.titre} » ne s'ouvre pas sur une version AAAA.MM.JJ.NN`,
      );
      continue;
    }
    const deja = vues.get(version.affichee);
    if (deja !== undefined) {
      echec(4, `CHANGELOG.md, lignes ${deja} et ${section.ligne} : deux sections portent la version ${version.affichee}`);
    } else {
      vues.set(version.affichee, section.ligne);
      if (precedente !== null && comparerVersions(version, precedente.version) > 0) {
        echec(
          4,
          `CHANGELOG.md, ligne ${section.ligne} : la section ${version.affichee} suit la section ${precedente.version.affichee} (ligne ${precedente.ligne}) ; les versions vont en ordre strictement décroissant`,
        );
      }
    }
    precedente = { version, ligne: section.ligne };
  }
}

// Point 5 : la date de la version ne dépasse pas de plus d'un jour la date
// civile de la machine. La tolérance absorbe l'écart de fuseau.
function controlerDate(version, civile, echec) {
  const avance = numeroDeJour(version) - numeroDeJour(civile);
  if (avance > 1) {
    echec(
      5,
      `version.json : la version ${version.affichee} est datée du ${dateEnLettres(version)}, ${avance} jours après la date civile de la machine, le ${dateEnLettres(civile)} ; la tolérance est d'un jour`,
    );
  }
}

// Point 6 : aucune chaîne de forme affichée hors de version.json, du module
// engendré et du changelog ; aucune de forme technique hors de package.json
// et du module engendré. Rend le nombre de fichiers de src/ examinés, que
// contrôle le point 8. Un fichier binaire, qui porte un octet nul, n'est pas
// examiné.
function controlerFormes(racine, echec) {
  let sourcesExaminees = 0;
  for (const chemin of fichiersBalayes(racine)) {
    const texte = lireTexte(racine, chemin);
    if (texte === null || texte.includes('\u0000')) continue;
    if (chemin.startsWith(ARBRE_DES_SOURCES)) sourcesExaminees += 1;
    for (const { ligne, chaine } of occurrences(texte, CHAINE_AFFICHEE)) {
      echec(
        6,
        `${chemin}, ligne ${ligne} : « ${chaine} », forme affichée, hors de version.json, du module engendré et du changelog`,
      );
    }
    if (chemin === 'package.json') continue;
    for (const { ligne, chaine } of occurrences(texte, CHAINE_TECHNIQUE)) {
      echec(6, `${chemin}, ligne ${ligne} : « ${chaine} », forme technique, hors de package.json et du module engendré`);
    }
  }
  return sourcesExaminees;
}

// Point 7 : aucun document ne porte le littéral #_# ni ne cite un nom
// d'exécutable hors du gabarit du § 18.2. Rend le nombre de documents
// examinés, que contrôle le point 8.
function controlerDocuments(racine, echec) {
  const documents = fichiersDeLaRacine(racine).filter(
    (nom) => DOCUMENTS_FIXES.includes(nom) || GUIDE.test(nom),
  );
  for (const document of documents) {
    const texte = lireTexte(racine, document);
    for (const { ligne, chaine } of occurrences(texte, LITTERAL_NON_SUBSTITUE)) {
      echec(7, `${document}, ligne ${ligne} : littéral « ${chaine} », un gabarit non substitué`);
    }
    for (const { ligne, chaine } of occurrences(texte, NOM_CITE)) {
      if (!nomConforme(chaine)) {
        echec(7, `${document}, ligne ${ligne} : « ${chaine} » ne se conforme pas au gabarit ${GABARIT_NOM} (§ 18.2)`);
      }
    }
  }
  return documents.length;
}

/**
 * Applique à l'arbre « racine » les huit points du § 18.5, à la date civile
 * « dateCivile » (AAAA-MM-JJ) de la machine qui construit. Rend la liste des
 * échecs, chacun préfixé du numéro de son point (« 1. … ») et nommant
 * l'endroit qui diverge ; liste vide = conforme. Lève sur une dateCivile mal
 * formée.
 */
export function controler(racine, { dateCivile }) {
  const civile = lireDateCivile(dateCivile);
  const echecs = [];
  const echec = (point, texte) => echecs.push(`${point}. ${texte}`);

  let version = null;
  try {
    version = versionDeLaSource(racine);
  } catch (erreur) {
    echec(1, erreur.message);
  }
  if (version !== null) {
    controlerRecopies(racine, version, echec);
    controlerModule(racine, version, echec);
  }
  const changelog = lireTexte(racine, 'CHANGELOG.md');
  if (changelog === null) {
    echec(3, "CHANGELOG.md absent : la section de la version courante s'écrit à la livraison (§ 18.4)");
  } else {
    const sections = sectionsDuChangelog(changelog);
    controlerTete(sections, version, echec);
    controlerOrdre(sections, echec);
  }
  if (version !== null) controlerDate(version, civile, echec);
  const sourcesExaminees = controlerFormes(racine, echec);
  const documentsExamines = controlerDocuments(racine, echec);
  if (sourcesExaminees === 0) {
    echec(8, `le balayage du point 6 n'examine aucun fichier sous ${ARBRE_DES_SOURCES} : zéro fichier examiné n'est pas zéro problème (§ 14.2)`);
  }
  if (documentsExamines === 0) {
    echec(8, 'le balayage du point 7 n\'examine aucun document (README.md, CHANGELOG.md, GUIDE-*.md)');
  }
  return echecs;
}

/**
 * Date civile locale d'un instant, sous la forme AAAA-MM-JJ ; par défaut,
 * celle de la machine au moment de l'appel.
 */
export function dateCivileLocale(instant = new Date()) {
  return `${instant.getFullYear()}-${deuxChiffres(instant.getMonth() + 1)}-${deuxChiffres(instant.getDate())}`;
}

// --- Ligne de commande ------------------------------------------------------

const USAGE = 'usage : node scripts/version.js engendrer | controler';

// Exécute une commande sur l'arbre « racine » et rend le code de sortie : 0
// réussi, 1 échec, 2 commande inconnue.
function executer(commande, racine) {
  if (commande === 'engendrer') {
    try {
      const reecrits = engendrer(racine);
      const version = lireVersion(racine);
      console.log(
        reecrits.length === 0
          ? `Version ${version} : les recopies sont à jour.`
          : `Version ${version} : réécrit ${reecrits.join(', ')}.`,
      );
      return 0;
    } catch (erreur) {
      console.error(`Version : ${erreur.message}`);
      return 1;
    }
  }
  if (commande === 'controler') {
    const echecs = controler(racine, { dateCivile: dateCivileLocale() });
    if (echecs.length === 0) {
      console.log(`Version ${lireVersion(racine)} : conforme aux huit points du § 18.5.`);
      return 0;
    }
    console.error(`Version : ${echecs.length} échec(s) au contrôle du § 18.5.`);
    for (const echec of echecs) console.error(echec);
    return 1;
  }
  console.error(USAGE);
  return 2;
}

// Vrai quand ce fichier est le script que Node a lancé, et non un module
// importé.
function estLanceDirectement() {
  if (process.argv[1] === undefined) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (estLanceDirectement()) {
  process.exitCode = executer(process.argv[2], fileURLToPath(new URL('..', import.meta.url)));
}
