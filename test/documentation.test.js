// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des documents livrés, sur les vrais fichiers (§ 16.1, § 19.7 à
// § 19.9) : GUIDE-USAGE.md suit les étapes du parcours et apparie ses images
// au manifeste et au disque ; les régions engendrées de README.md et du guide
// sont telles qu'engendrer les écrirait ; README.md et le guide n'affichent
// que des captures doc/captures/<nom>.png, et chaque PNG publié a
// l'empreinte et les dimensions que le manifeste inscrit, au niveau de
// l'épreuve comme de verifier ; la section sur l'algorithme cite
// des nombres que l'arithmétique et le diagnostic des démonstrations livrées
// recalculent, et ne cite ni code, ni identifiant exporté, ni module ;
// GUIDE-WINDOWS.md, texte seul, cite le gabarit du nom de l'exécutable et la
// règle du dossier de travail avec ses deux issues.
//
// Chaque contrôle est une fonction qui rend ses fautes : appliquée au vrai
// fichier, elle n'en rend aucune ; appliquée à une copie altérée en mémoire
// (une image retirée, un nombre changé, un nom de fonction collé), elle en
// rend une, ce qui montre qu'elle ne passe pas à vide (§ 14.2).
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { describe, test } from './lanceur.js';
import { versionVoisine } from './version_voisine.js';
import configuration from '../vitest.config.js';
import { TABLES_APPLICATION } from '../src/application/libelles.js';
import { creerTraduction } from '../src/application/traduction.js';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { LIVREES } from '../src/demo/livrees.js';
import { TABLES_INTERFACE } from '../src/interface/libelles.js';
import { diagnostiquer } from '../src/moteur/diagnostic.js';
import { analyser, configurationDepuisCharge } from '../src/stockage/document.js';
import { VERSION } from '../src/version.genere.js';
import { CONSTANTES } from '../src/geometrie/constantes.js';
import { tableauConstantes } from '../scripts/banc/releve.js';
import {
  CHEMIN_RELEVE,
  PORTEURS,
  PRODUCTEURS,
  RACINE,
  engendrerArbre,
  executer,
  fautesImagesCitees,
  imagesCitees,
  ligneEcart,
  lireRegions,
  tableauRegistre,
  verifierArbre,
} from '../scripts/documentation.js';
import {
  A_VENIR,
  CAPTURES,
  CHEMIN_MANIFESTE,
  DOSSIER_CAPTURES,
  ETAPES,
  REPORTEES,
  cheminImage,
  cheminsHorsRacine,
  fautesDImage,
  imagesReferencees,
  verifierAppariement,
  verifierOrdre,
} from '../scripts/documentation/manifeste.js';
import { deriver } from '../scripts/version.js';

const GUIDE_USAGE = 'GUIDE-USAGE.md';
const GUIDE_WINDOWS = 'GUIDE-WINDOWS.md';
const README = 'README.md';

const lire = (chemin) => readFileSync(join(RACINE, chemin), 'utf8');
const lireOctets = (chemin) => readFileSync(join(RACINE, chemin));
const lireManifeste = () => JSON.parse(lire(CHEMIN_MANIFESTE));

// Les images PNG du dossier des captures, en chemins relatifs à la racine.
const imagesSurDisque = () =>
  readdirSync(join(RACINE, DOSSIER_CAPTURES))
    .filter((nom) => nom.endsWith('.png'))
    .map((nom) => `${DOSSIER_CAPTURES}/${nom}`);

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// --- Le découpage d'un document Markdown ----------------------------------------

// Les sections de niveau 2 d'un texte : { titre, debut, texte }, texte allant
// du titre exclu au titre suivant de même niveau ; ce qui précède le premier
// titre n'en est pas une.
function sections(texte) {
  const titres = [...texte.matchAll(/^## (.+)$/gm)];
  return titres.map((trouve, rang) => {
    const debut = trouve.index + trouve[0].length;
    const fin = rang + 1 < titres.length ? titres[rang + 1].index : texte.length;
    return { titre: trouve[1], debut, texte: texte.slice(debut, fin) };
  });
}

// Le titre de la section d'une étape : « Étape <id> — <intitulé> ».
const TITRE_ETAPE = /^Étape (\S+) \u{2014} \S/u;
// Le titre de la section sur l'algorithme (§ 19.9).
const TITRE_ALGORITHME = 'Comment le logiciel cherche';

// Un texte dont chaque suite de blancs, saut de ligne compris, devient une
// espace : une phrase cherchée se trouve quel que soit le retour à la ligne
// du paragraphe qui la porte.
const enLigne = (texte) => texte.replace(/\s+/g, ' ');

// Le texte où la première occurrence d'une phrase est remplacée, quel que
// soit le retour à la ligne entre ses mots ; échoue si la phrase est absente.
function remplacerPhrase(texte, phrase, remplacement) {
  const motif = phrase.split(/\s+/).map((mot) => mot.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('\\s+');
  const remplace = texte.replace(new RegExp(motif, 'u'), remplacement);
  assert.notEqual(remplace, texte, `phrase introuvable : ${phrase}`);
  return remplace;
}

// L'espèce d'une faute : ce qui précède son premier « : ».
const especes = (fautes) => fautes.map((faute) => faute.split(' : ')[0]);

// La section dont le titre est exactement celui donné, ou null.
const sectionNommee = (texte, titre) => sections(texte).find((s) => s.titre === titre) ?? null;

// --- Les étapes et les images du guide d'usage ------------------------------------

/**
 * Les fautes du guide d'usage contre les étapes et le manifeste : une section
 * par étape d'ETAPES, dans leur ordre, et chaque image citée pour la première
 * fois dans la section de l'étape que le manifeste lui déclare.
 */
function fautesEtapes(texte, manifeste) {
  const fautes = [];
  const etapes = sections(texte)
    .map((section) => ({ ...section, etape: TITRE_ETAPE.exec(section.titre)?.[1] ?? null }))
    .filter((section) => section.etape !== null);
  const lues = etapes.map((s) => s.etape);
  if (JSON.stringify(lues) !== JSON.stringify([...ETAPES])) {
    fautes.push(`sections d'étape ${JSON.stringify(lues)}, attendues ${JSON.stringify(ETAPES)}`);
  }
  const etapeDe = new Map(manifeste.captures.map((c) => [cheminImage(c.fichier), c.etape]));
  const premiere = new Map();
  for (const section of etapes) {
    for (const image of imagesReferencees(section.texte)) {
      const vue = texte.indexOf(image);
      if (!premiere.has(image) && vue >= section.debut && vue < section.debut + section.texte.length) {
        premiere.set(image, section.etape);
      }
    }
  }
  for (const image of imagesReferencees(texte)) {
    const attendue = etapeDe.get(image);
    const lue = premiere.get(image) ?? null;
    if (attendue !== undefined && lue !== attendue) {
      fautes.push(`${image} : citée d'abord hors de la section de l'étape ${attendue} (${lue ?? 'hors des étapes'})`);
    }
  }
  return fautes;
}

// Un entier écrit en chiffres comme les documents l'écrivent : des groupes de
// trois séparés par une espace fine insécable.
const enChiffres = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '\u{202F}');

// La graine et le compte d'arrêt que le parcours écrit avant de générer les
// propositions qu'il photographie, lus dans son texte : le guide les donne
// pour que ses écrans se reproduisent (§ 16.1).
function reglagesDuParcours() {
  const texte = lire('src/interface/parcours.navigateur.test.js');
  const graine = /^const GRAINE = (\d+);$/m.exec(texte)?.[1];
  const arret = /^const ARRET = (\d+);$/m.exec(texte)?.[1];
  assert.ok(graine !== undefined && arret !== undefined, 'la graine et le compte d’arrêt du parcours');
  return { graine, arret: BigInt(arret) };
}

// Les références du guide, telles que verifierAppariement les attend : le
// guide d'usage seul porte des images (GUIDE-WINDOWS.md est texte seul).
const referencesDe = (texteGuide) => [{ document: GUIDE_USAGE, images: imagesReferencees(texteGuide) }];

describe('documentation : le guide d’usage suit les étapes et apparie ses images (§ 16.1, § 19.3, § 19.7)', () => {
  test('appariement : chaque image du guide est au manifeste et sur le disque, et réciproquement', () => {
    const fautes = verifierAppariement({ manifeste: lireManifeste(), references: referencesDe(lire(GUIDE_USAGE)), images: imagesSurDisque() });
    assert.deepEqual(fautes, []);
  });

  test('ordre : le manifeste range ses captures et ses reportées selon les étapes, chaque étape couverte', () => {
    assert.deepEqual(verifierOrdre(lireManifeste()), []);
  });

  test('une section par étape, dans l’ordre du parcours ; chaque image citée d’abord sous son étape', () => {
    assert.deepEqual(fautesEtapes(lire(GUIDE_USAGE), lireManifeste()), []);
  });

  test('l’introduction et l’étape 9 donnent la graine et le compte d’arrêt du parcours qui photographie', () => {
    const { graine, arret } = reglagesDuParcours();
    const texte = lire(GUIDE_USAGE);
    const introduction = enLigne(texte.slice(0, texte.indexOf('\n## ')));
    const etape9 = enLigne(sections(texte).find((s) => /^Étape 9 \u{2014}/u.test(s.titre))?.texte ?? '');
    for (const [nom, morceau] of [['introduction', introduction], ['étape 9', etape9]]) {
      // Chaque nombre est borné à droite : un nombre que le guide prolonge
      // ne passe pas pour celui du parcours.
      const suivi = (prefixe) => morceau.split(prefixe).slice(1).some((reste) => !/^[\d\u{202F}]/u.test(reste));
      assert.ok(suivi(`la graine ${graine}`), `${nom} : la graine ${graine}`);
      assert.ok(suivi(enLigne(`un compte d\u{2019}arrêt de ${enChiffres(arret)}`)), `${nom} : le compte d’arrêt ${arret}`);
    }
  });

  test('chaque capture publiée est citée ; une reportée ou à venir ne l’est pas : sans image, elle serait orpheline', () => {
    const citees = new Set(imagesReferencees(lire(GUIDE_USAGE)));
    // Sans reportée ni capture à venir, la première comparaison ne juge
    // rien ; la seconde, sur toutes les captures publiées, juge le guide.
    const absentes = [...REPORTEES.map((r) => r.fichier), ...A_VENIR].map(cheminImage);
    assert.deepEqual(absentes.filter((chemin) => citees.has(chemin)), []);
    // Chaque capture déclarée qui n'est pas à venir est publiée, donc citée.
    const publiees = CAPTURES.filter((c) => !A_VENIR.includes(c.fichier)).map((c) => cheminImage(c.fichier));
    assert.ok(publiees.length > 0);
    assert.deepEqual(publiees.filter((chemin) => !citees.has(chemin)), []);
  });

  test('rouge : une image retirée du guide devient orpheline, au chemin de cette image', () => {
    const texte = lire(GUIDE_USAGE);
    const retiree = cheminImage('05-tables-etat');
    assert.ok(texte.includes(retiree));
    const sans = texte.split('\n').filter((ligne) => !ligne.includes(retiree)).join('\n');
    const fautes = verifierAppariement({ manifeste: lireManifeste(), references: referencesDe(sans), images: imagesSurDisque() });
    assert.deepEqual(fautes.map((f) => f.chemin), [retiree]);
    assert.match(fautes[0].faute, /^orpheline : .*absente de la documentation$/);
  });

  test('rouge : une section d’étape déplacée ou une image citée sous une autre étape se relèvent', () => {
    const texte = lire(GUIDE_USAGE);
    const manifeste = lireManifeste();
    const renommee = texte.replace('## Étape 1b \u{2014}', '## Étape 1c \u{2014}');
    assert.notEqual(renommee, texte);
    const [etapes, image] = fautesEtapes(renommee, manifeste);
    assert.match(etapes, /^sections d'étape \["1","1c","2",/);
    assert.equal(image, `${cheminImage('01b-passer-en-ecriture')} : citée d'abord hors de la section de l'étape 1b (1c)`);
    const deplacee = cheminImage('10-diagnostic');
    const avancee = texte.replace('## Étape 1b \u{2014}', `![](${deplacee})\n\n## Étape 1b \u{2014}`);
    assert.deepEqual(fautesEtapes(avancee, manifeste), [`${deplacee} : citée d'abord hors de la section de l'étape 8 (1)`]);
  });
});

// --- Les images que la documentation affiche (§ 19.1, § 19.7) -----------------------

// Un lecteur de l'arbre réel où un document est remplacé par un texte donné.
const lireAvec = (remplace, texte) => (chemin) => (chemin === remplace ? texte : lire(chemin));

// Un lecteur de l'arbre réel dont le manifeste porte version pour chaque
// version réelle : seules les versions diffèrent, images et empreintes
// restent celles de l'arbre.
const versionDuManifeste = (version) => {
  const manifeste = lireManifeste();
  manifeste.captures = manifeste.captures.map((capture) => ({ ...capture, versionReelle: version }));
  return lireAvec(CHEMIN_MANIFESTE, `${JSON.stringify(manifeste, null, 2)}\n`);
};

describe('documentation : les documents n’affichent que les captures, telles que le manifeste les inscrit (§ 19.1, § 19.7)', () => {
  test('le guide d’usage et README.md ne citent aucune image hors de doc/captures', () => {
    for (const document of [GUIDE_USAGE, README]) assert.deepEqual(fautesImagesCitees(document, lire(document)), [], document);
    // Le relevé n'est pas vide : il voit chaque image que l'appariement voit.
    const cibles = imagesCitees(lire(GUIDE_USAGE)).map((citee) => citee.cible);
    assert.deepEqual([...new Set(cibles)].sort(), [...imagesReferencees(lire(GUIDE_USAGE))].sort());
    assert.equal(new Set(cibles).size, CAPTURES.length);
  });

  test('rouge : une image hors de doc/captures, ou qui n’y est pas un PNG, se relève en mémoire, chacune nommée', () => {
    const texte = lire(GUIDE_USAGE);
    const altere = `${texte}\n![Un ancien écran](images/ancienne.png)\n\n![Un autre](doc/captures/x.jpg)\n`;
    const fautes = fautesImagesCitees(GUIDE_USAGE, altere);
    assert.deepEqual(fautes.map((f) => f.chemin), [GUIDE_USAGE, GUIDE_USAGE]);
    assert.match(fautes[0].faute, /image hors de doc\/captures : « images\/ancienne\.png »/);
    assert.match(fautes[1].faute, /image hors de doc\/captures : « doc\/captures\/x\.jpg »/);
    // La construction refuse aussi : verifier lit les mêmes fautes.
    const bilan = verifierArbre({ lire: lireAvec(GUIDE_USAGE, altere) });
    assert.deepEqual(bilan.fautes, fautes);
    assert.equal(bilan.code, 1);
  });

  test('rouge : les autres formes d’image — balise, référence, lien vers une image — se relèvent dans README.md', () => {
    const texte = lire(README);
    const avec = (ajout) => fautesImagesCitees(README, `${texte}\n${ajout}\n`).map((f) => f.faute.replace(/^ligne \d+ : /, ''));
    assert.deepEqual(avec('<img alt="ancien" src="images/ancienne.png">'), ['image hors de doc/captures : « images/ancienne.png »']);
    assert.deepEqual(avec("<IMG src='doc/captures/01-premier-ecran.png' srcset=\"images/grande.png 2x\">"), [
      'image en srcset : seules les captures doc/captures/<nom>.png s’affichent',
    ]);
    assert.deepEqual(avec('<img alt="sans source">'), ['balise <img> sans src lisible']);
    assert.deepEqual(avec('![Un écran][ancien]\n\n[ancien]: images/ancienne.png'), ['image hors de doc/captures : « images/ancienne.png »']);
    // Une image par référence se relève aussi quand sa cible n'a pas
    // d'extension d'image : c'est la syntaxe qui l'affiche.
    assert.deepEqual(avec('![Un écran][Distante]\n\n[distante]: <https://images.exemple.invalid/ecran>'), [
      'image hors de doc/captures : « https://images.exemple.invalid/ecran »',
    ]);
    assert.deepEqual(avec('Voir [l’ancien écran](images/ancienne.png).'), ['image hors de doc/captures : « images/ancienne.png »']);
    // Un texte entre crochets coupé à la ligne, ou qui porte des crochets,
    // imbriqués ou échappés, n'arrête pas le relevé : CommonMark affiche
    // ces images et ces liens.
    // Une cible sans extension d'image ne se relève que comme image : aucun
    // lien ne la rattrape.
    const distante = 'https://images.exemple.invalid/ecran';
    const formes = [
      ['![Un ancien\nécran](images/ancienne.png)', 'images/ancienne.png'],
      ['![Écran [ancien]](images/ancienne.png)', 'images/ancienne.png'],
      [`![Écran \\[ancien](${distante})`, distante],
      [`![Écran \\]](${distante})`, distante],
      ['Voir [l’ancien\nécran](images/ancienne.png).', 'images/ancienne.png'],
      [`![Un\nécran][Distante]\n\n[distante]: <${distante}>`, distante],
      [`![Un écran][Image\ndistante]\n\n[image distante]: <${distante}>`, distante],
    ];
    assert.deepEqual(
      formes.map(([forme]) => [forme, avec(forme)]),
      formes.map(([forme, cible]) => [forme, [`image hors de doc/captures : « ${cible} »`]]),
    );
    // Une ligne vide ferme le paragraphe : ni image ni lien ne la franchit.
    assert.deepEqual(avec('![Un ancien\n\nécran](images/ancienne.png)'), []);
    assert.deepEqual(avec('![Un écran](doc/captures/01-premier-ecran.png "titre")'), []);
    // Un lien vers un document qui n'est pas une image n'en est pas une.
    assert.deepEqual(avec('Voir [le guide](GUIDE-USAGE.md).'), []);
  });

  test('chaque image du manifeste a sur le disque l’empreinte et les dimensions qu’il inscrit', () => {
    const { captures } = lireManifeste();
    assert.equal(captures.length, CAPTURES.length - A_VENIR.length);
    for (const capture of captures) assert.deepEqual(fautesDImage(capture, lireOctets(cheminImage(capture.fichier))), [], capture.fichier);
  });

  test('rouge : les octets de 04-grille-participants passés pour 05-tables-etat donnent une faute qui nomme 05', () => {
    const entree = lireManifeste().captures.find((c) => c.fichier === '05-tables-etat');
    const fautes = fautesDImage(entree, lireOctets(cheminImage('04-grille-participants')));
    assert.deepEqual(fautes.map((f) => f.chemin), [cheminImage('05-tables-etat')]);
    assert.match(fautes[0].faute, /^image remplacée/);
  });

  test('verifier, sur l’arbre réel : chaque image citée par un porteur est contrôlée, aucune faute', () => {
    const bilan = verifierArbre();
    assert.equal(bilan.images, CAPTURES.length - A_VENIR.length);
    assert.deepEqual(bilan.fautes, []);
    const lignes = [];
    assert.equal(executer(['verifier'], { sortie: (ligne) => lignes.push(ligne) }), 0);
    assert.match(lignes.at(-1), new RegExp(`, ${bilan.images} image\\(s\\), 0 faute\\(s\\)$`));
  });

  test('rouge : une capture du manifeste que nul porteur ne cite est une faute de verifier ; zéro citée n’est pas zéro périmée', () => {
    const fichiers = lireManifeste().captures.map((capture) => cheminImage(capture.fichier));
    const nonCitee = (chemin) => ({ chemin, faute: 'inscrite au manifeste, citée par aucun porteur' });
    // Le guide privé de ses images : seuls ses liens vers une capture restent.
    const sansImages = lire(GUIDE_USAGE)
      .split('\n')
      .filter((ligne) => !/^!\[[^\]]*\]\(doc\/captures\//.test(ligne))
      .join('\n');
    const restantes = new Set(imagesCitees(sansImages).map((citee) => citee.cible));
    assert.ok(restantes.size > 0 && restantes.size < fichiers.length, `${restantes.size}`);
    // Puis privé aussi de ces liens : aucune capture citée.
    const sansCitation = sansImages.replace(/\]\(doc\/captures\/[^)]*\)/g, '](#)');
    assert.deepEqual(imagesCitees(sansCitation), []);
    for (const livraison of [false, true]) {
      const partiel = verifierArbre({ livraison, lire: lireAvec(GUIDE_USAGE, sansImages) });
      assert.deepEqual(partiel.fautes, fichiers.filter((chemin) => !restantes.has(chemin)).map(nonCitee));
      assert.deepEqual([partiel.images, partiel.code], [restantes.size, 1]);
      const vide = verifierArbre({ livraison, lire: lireAvec(GUIDE_USAGE, sansCitation) });
      assert.deepEqual(vide.fautes, fichiers.map(nonCitee));
      assert.deepEqual([vide.images, vide.code], [0, 1]);
    }
    // Restreinte par --porteur, la vérification ne juge pas les citations des
    // porteurs qu'elle ne lit pas : le seul README, sur l'arbre réel, passe.
    const restreinte = verifierArbre({ porteurs: ['README.md'] });
    assert.deepEqual([restreinte.fautes, restreinte.code], [[], 0]);
    assert.equal(executer(['verifier', '--porteur', 'README.md'], { sortie: () => {} }), 0);
  });

  test('rouge : un PNG publié remplacé par un autre, le manifeste inchangé, fait échouer verifier et la livraison', () => {
    const remplacee = cheminImage('05-tables-etat');
    const ancienne = (chemin) => lireOctets(chemin === remplacee ? cheminImage('04-grille-participants') : chemin);
    for (const livraison of [false, true]) {
      const bilan = verifierArbre({ livraison, lireOctets: ancienne });
      assert.deepEqual(bilan.fautes.map((f) => f.chemin), [remplacee]);
      assert.match(bilan.fautes[0].faute, /^image remplacée/);
      assert.equal(bilan.code, 1);
    }
    const lignes = [];
    assert.equal(executer(['verifier', '--livraison'], { lireOctets: ancienne, sortie: (ligne) => lignes.push(ligne) }), 1);
    assert.ok(lignes.some((ligne) => ligne.startsWith(`${remplacee} : image remplacée`)), lignes.join('\n'));
  });

  test('rouge : une image citée absente du disque, ou absente du manifeste, est une faute de verifier', () => {
    const absente = cheminImage('05-tables-etat');
    const sansFichier = (chemin) => {
      if (chemin === absente) throw Object.assign(new Error(`absent : ${chemin}`), { code: 'ENOENT' });
      return lireOctets(chemin);
    };
    const surDisque = verifierArbre({ lireOctets: sansFichier });
    assert.deepEqual(surDisque.fautes, [{ chemin: absente, faute: `citée par ${GUIDE_USAGE}, absente du disque` }]);
    // Un nom inventé, ni au manifeste ni sur le disque : le manifeste suffit à
    // le refuser, aucun octet ne se lit.
    const inventee = cheminImage('05z-table-inventee');
    const lus = [];
    const horsManifeste = verifierArbre({
      lire: lireAvec(GUIDE_USAGE, `${lire(GUIDE_USAGE)}\n![Une table inventée](${inventee})\n`),
      lireOctets: (chemin) => (lus.push(chemin), lireOctets(chemin)),
    });
    assert.deepEqual(horsManifeste.fautes, [{ chemin: inventee, faute: `citée par ${GUIDE_USAGE}, absente du manifeste` }]);
    assert.equal(horsManifeste.code, 1);
    assert.ok(!lus.includes(inventee));
    assert.equal(lus.length, CAPTURES.length - A_VENIR.length);
  });
});

// --- Les régions engendrées ---------------------------------------------------------

describe('documentation : les régions engendrées des documents livrés (§ 19.8)', () => {
  test('PORTEURS nomme README.md et le guide d’usage ; chaque porteur porte les régions qui lui reviennent', () => {
    assert.deepEqual([...PORTEURS], [README, GUIDE_USAGE]);
    assert.deepEqual(lireRegions(lire(README)).map((r) => r.nom), ['contrastes', 'constantes']);
    assert.deepEqual(
      lireRegions(lire(GUIDE_USAGE)).map((r) => r.nom),
      ['reglages', 'colonnes-csv', 'colonnes-objectifs', 'commandes', 'raccourcis', 'demonstrations'],
    );
    // Chaque producteur sert une région, et une seule.
    const servies = PORTEURS.flatMap((chemin) => lireRegions(lire(chemin)).map((r) => r.nom)).sort();
    assert.deepEqual(servies, PRODUCTEURS.map(({ nom }) => nom).sort());
  });

  test('verifier, sur l’arbre réel et la liste par défaut : aucune faute, toutes les régions lues ; l’écart de version affiché, non bloquant', () => {
    // L'arbre réel passe par l'écrivain par défaut, console.warn, que
    // releverConsole relève et transmet : la série surveillée affiche son
    // écart, et l'épreuve en attend la ligne, aucune sans écart.
    const { rendu: { bilan }, recues } = releverConsole(() => verifierEtAfficher(), true);
    assert.deepEqual(recues, bilan.ecart === null ? [] : [ligneEcart(bilan.ecart)]);
    assert.deepEqual(bilan.fautes, []);
    assert.equal(bilan.regions, PRODUCTEURS.length);
    assert.equal(bilan.code, 0);
    // Le même chemin, sur l'arbre réel dont seul le manifeste passe à une
    // version voisine, écrit la ligne de cet écart : l'affichage s'éprouve
    // que l'arbre réel ait un écart ou non. Deux relevés s'emboîtent : la
    // ligne que l'intérieur relève et transmet parvient à l'extérieur, qui
    // la relève sans la transmettre, et la série surveillée ne la montre pas.
    const voisine = versionVoisine(VERSION.affichee);
    const exterieur = releverConsole(() => releverConsole(() => verifierEtAfficher({ lire: versionDuManifeste(voisine) }), true), false);
    const interieur = exterieur.rendu;
    assert.deepEqual([interieur.rendu.bilan.fautes, interieur.rendu.bilan.code], [[], 0]);
    assert.deepEqual(interieur.recues, [ligneEcart({ manifeste: voisine, construction: VERSION.affichee })]);
    assert.deepEqual(exterieur.recues, interieur.recues);
  });

  test('aucun document de la racine hors de PORTEURS ne porte de région : rien n’échappe à la vérification', () => {
    const documents = readdirSync(RACINE).filter((nom) => nom.endsWith('.md'));
    assert.ok(documents.includes(GUIDE_WINDOWS));
    const horsPorteurs = documents.filter((nom) => !PORTEURS.includes(nom));
    assert.deepEqual(horsPorteurs.filter((nom) => lireRegions(lire(nom)).length > 0), []);
  });

  test('la construction de livraison vérifie les régions et la version des captures avant de construire', () => {
    const { scripts } = JSON.parse(lire('package.json'));
    const etapes = scripts['build:livraison'].split('&&').map((etape) => etape.trim());
    const verifier = etapes.indexOf('node scripts/documentation.js verifier --livraison');
    const construire = etapes.findIndex((etape) => etape.startsWith('vite build'));
    assert.ok(verifier >= 0, scripts['build:livraison']);
    assert.ok(construire > verifier, scripts['build:livraison']);
  });

  test('rouge : une cellule corrigée à la main dans une région du guide fait échouer verifier', () => {
    const texte = lire(GUIDE_USAGE);
    const region = lireRegions(texte).find((r) => r.nom === 'reglages');
    const ligne = region.contenu.split('\n').find((l) => l.startsWith('| ') && !l.startsWith('| Réglage'));
    const corrige = texte.slice(0, region.debut) + region.contenu.replace(ligne, `${ligne} corrigé |`) + texte.slice(region.fin);
    const bilan = verifierArbre({ porteurs: [GUIDE_USAGE], lire: (chemin) => (chemin === GUIDE_USAGE ? corrige : lire(chemin)) });
    assert.deepEqual(bilan.fautes.map((f) => f.chemin), [GUIDE_USAGE]);
    assert.match(bilan.fautes[0].faute, /région « reglages » : diffère de ce que le producteur engendre/);
  });
});

// --- L'écart de version, la ligne de commande, la surveillance (§ 19.7, § 14.4) ---------

// Vérifie l'arbre réel au cycle court, par lire quand il est donné, et
// affiche l'écart de version du bilan par ecrire : par défaut console.warn,
// la sortie d'erreur de l'épreuve, que le rapporteur imprime sous le nom de
// l'épreuve sans la faire échouer (§ 19.7). L'épreuve du manifeste voisin
// éprouve les deux écrivains, l'injecté et celui par défaut ; celle de
// l'arbre réel passe par l'écrivain par défaut, relève et transmet son
// propre écart, puis force un écart par le manifeste et en relève la ligne
// sans la transmettre.
// Rend { bilan, ligne } : ligne est la ligne écrite, null sans écart.
function verifierEtAfficher({ lire, ecrire = (ligne) => console.warn(ligne) } = {}) {
  const bilan = verifierArbre({ lire });
  const ligne = ligneEcart(bilan.ecart);
  if (ligne !== null) ecrire(ligne);
  return { bilan, ligne };
}

// Appelle appel, console.warn remplacé par un relevé de chaque ligne, qui la
// transmet au console.warn en place à l'appel quand transmettre est vrai ;
// ce dernier est rétabli au retour, même sur une levée. Rend { rendu,
// recues } : le rendu de l'appel et les lignes relevées, dans leur ordre.
function releverConsole(appel, transmettre) {
  const recues = [];
  const avertir = console.warn;
  console.warn = (...valeurs) => {
    recues.push(valeurs.join(' '));
    if (transmettre) avertir.apply(console, valeurs);
  };
  try {
    return { rendu: appel(), recues };
  } finally {
    console.warn = avertir;
  }
}

// Les épreuves que la série surveillée relance quand chemin change : la
// réunion des motifs de vitest.config.js qui y répondent, comme Vitest la
// calcule.
function relanceesPar(chemin) {
  const motifs = configuration.test.watchTriggerPatterns.filter(({ pattern }) => new RegExp(pattern.source, pattern.flags).test(chemin));
  return new Set(motifs.flatMap(({ testsToRun }) => [testsToRun(chemin) ?? []].flat()));
}

describe('documentation : l’écart de version, la ligne de commande, la surveillance (§ 19.7, § 14.4)', () => {
  test('rouge : un manifeste à une version voisine — au cycle court, l’écart s’affiche, se nomme et ne bloque pas ; à la livraison, il bloque', () => {
    const voisine = versionVoisine(VERSION.affichee);
    const lire = versionDuManifeste(voisine);
    const lignes = [];
    const { bilan: court, ligne } = verifierEtAfficher({ lire, ecrire: (ecrite) => lignes.push(ecrite) });
    assert.deepEqual([court.fautes, court.code], [[], 0]);
    assert.deepEqual(court.ecart, { manifeste: voisine, construction: VERSION.affichee });
    assert.deepEqual(lignes, [`écart de version (non bloquant) : manifeste ${voisine}, construction ${VERSION.affichee}`]);
    assert.equal(ligne, lignes[0]);
    // Sans écrivain, la ligne va à console.warn, remplacé le temps de l'appel.
    const recues = [];
    const avertir = console.warn;
    console.warn = (...valeurs) => recues.push(valeurs.join(' '));
    try {
      verifierEtAfficher({ lire });
    } finally {
      console.warn = avertir;
    }
    assert.deepEqual(recues, lignes);
    const livraison = verifierArbre({ lire, livraison: true });
    assert.equal(livraison.code, 1);
    assert.equal(ligneEcart(livraison.ecart, { livraison: true }), `écart de version (bloquant) : manifeste ${voisine}, construction ${VERSION.affichee}`);
    // La ligne de commande imprime la même ligne, par la même composition.
    for (const [argv, code, portee] of [[['verifier'], 0, 'non bloquant'], [['verifier', '--livraison'], 1, 'bloquant']]) {
      const sortie = [];
      assert.equal(executer(argv, { lire, sortie: (ligne) => sortie.push(ligne) }), code);
      assert.ok(sortie.includes(`écart de version (${portee}) : manifeste ${voisine}, construction ${VERSION.affichee}`), sortie.join('\n'));
    }
    // Sans écart, rien ne s'affiche.
    const accorde = verifierEtAfficher({ lire: versionDuManifeste(VERSION.affichee), ecrire: () => assert.fail('aucune ligne sans écart') });
    assert.equal(accorde.bilan.ecart, null);
    assert.equal(accorde.ligne, null);
  });

  test('un manifeste absent ne prouve aucune version : l’écart le nomme', () => {
    assert.equal(
      ligneEcart({ manifeste: null, construction: VERSION.affichee }),
      `écart de version (non bloquant) : manifeste aucune (manifeste absent ou sans capture), construction ${VERSION.affichee}`,
    );
    assert.equal(ligneEcart(null, { livraison: true }), null);
  });

  // Node charge le script lancé sous son chemin réel : un lancement par un
  // chemin qui traverse un lien symbolique est un lancement direct.
  test('rouge : lancé par un lien symbolique vers son dossier, le script s’exécute — un argument illisible rend l’usage et le code 2', () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gtt-documentation-lien-'));
    try {
      const lien = join(dossier, 'scripts');
      symlinkSync(join(RACINE, 'scripts'), lien, 'junction');
      const lance = spawnSync(process.execPath, [join(lien, 'documentation.js'), 'illisible'], { encoding: 'utf8' });
      assert.equal(lance.status, 2, lance.stderr);
      assert.match(lance.stdout, /^usage : node scripts\/documentation\.js engendrer \| verifier/);
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  // verifier lit par le disque les porteurs, le manifeste, le relevé du banc
  // et les captures citées, qu'aucun graphe d'imports ne relie aux épreuves
  // de la documentation : chacun a son motif de surveillance. Les lectures
  // se relèvent sur l'arbre réel, avant l'appel à chaque lecteur. Les textes
  // relancent les deux épreuves ; une capture relance celle de l'arbre réel,
  // scripts/documentation.test.js ne lisant que ses propres images.
  test('rouge : chaque fichier que verifier lit par le disque relance les épreuves de la documentation qui le lisent', () => {
    const lus = new Set();
    const relever = (lecteur) => (chemin) => {
      lus.add(chemin);
      return lecteur(chemin);
    };
    const bilan = verifierArbre({ lire: relever(lire), lireOctets: relever(lireOctets) });
    const images = [...lus].filter((chemin) => chemin.endsWith('.png'));
    assert.ok(bilan.images > 0, 'aucune capture citée');
    assert.equal(images.length, bilan.images);
    assert.deepEqual([...PORTEURS, CHEMIN_MANIFESTE, CHEMIN_RELEVE].filter((chemin) => !lus.has(chemin)), []);
    const epreuvesDe = (chemin) =>
      chemin.endsWith('.png') ? ['test/documentation.test.js'] : ['test/documentation.test.js', 'scripts/documentation.test.js'];
    const manquent = [...lus].flatMap((chemin) =>
      epreuvesDe(chemin).filter((e) => !relanceesPar(chemin).has(e)).map((e) => `${chemin} ne relance pas ${e}`));
    assert.deepEqual(manquent, []);
  });
});

// --- La région des constantes et le relevé du banc (§ 19.8, § 19.10) ----------------

describe('documentation : la région « constantes » lit le relevé du banc quand il existe (§ 19.10)', () => {
  const RELEVE = 'scripts/banc/releve.json';
  const PORTEUR = 'README.md';
  const TEXTE = '# Essai\n\n<!-- engendre:debut constantes -->\n<!-- engendre:fin constantes -->\n';

  // Un relevé inventé, d'une mesure du banc.
  const releve = {
    format: 1,
    configuration: {
      cadre: { largeur: 1366, hauteur: 700 },
      facteurEchelle: 1,
      navigateur: 'Chromium 140.0',
      node: 'v26.10.0',
      processeursLogiques: 8,
      ralentissementCpu: 4,
      police: 'Noto Sans',
    },
    mesures: [{ nom: 'SEUIL_SIEGES_LISIBLES', unite: 'places', valeurProposee: 17, critere: 'liste dans la hauteur du plan' }],
  };

  // Engendre le porteur d'essai sur un arbre en mémoire où le relevé vaut
  // texteReleve, ou manque quand il vaut null ; rend le bilan et le texte
  // écrit.
  function engendrer(texteReleve) {
    const ecrits = new Map();
    const lire = (chemin) => {
      if (chemin === PORTEUR) return TEXTE;
      if (chemin === RELEVE && texteReleve !== null) return texteReleve;
      throw Object.assign(new Error(`absent : ${chemin}`), { code: 'ENOENT' });
    };
    const bilan = engendrerArbre({ porteurs: [PORTEUR], lire, ecrire: (chemin, texte) => ecrits.set(chemin, texte) });
    return { bilan, ecrit: ecrits.get(PORTEUR) };
  }

  const region = (texte) => lireRegions(texte)[0].contenu.trim();

  test('sans relevé, la région est le tableau du registre seul', () => {
    const { bilan, ecrit } = engendrer(null);
    assert.equal(bilan.code, 0);
    assert.equal(region(ecrit), tableauRegistre());
  });

  test('avec un relevé, la région est le tableau des constantes, la valeur proposée à côté de celle du registre', () => {
    const { bilan, ecrit } = engendrer(JSON.stringify(releve));
    assert.equal(bilan.code, 0);
    assert.equal(region(ecrit), tableauConstantes(CONSTANTES, releve));
    assert.match(region(ecrit), /\| `SEUIL_SIEGES_LISIBLES` \|.*\| 17 places \| cadre de 1 366 × 700 px/);
  });

  test('un relevé illisible fait échouer la production, en nommant son chemin, et rien ne s’écrit', () => {
    const { bilan, ecrit } = engendrer('{ format: 1');
    assert.equal(bilan.code, 1);
    assert.equal(ecrit, undefined);
    assert.match(bilan.fautes[0].faute, /scripts\/banc\/releve\.json : JSON illisible/);
  });
});

// --- La section sur l'algorithme (§ 19.9) ---------------------------------------------

// Les nombres de un à douze, en lettres : la section écrit en lettres tout
// nombre qu'elle ne fait pas recalculer.
const EN_LETTRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf', 'dix', 'onze', 'douze'];
function enLettres(n) {
  if (!Number.isInteger(n) || n < 0 || n >= EN_LETTRES.length) throw new RangeError(`pas de lettres pour ${n}`);
  return EN_LETTRES[n];
}

const EXPOSANTS = new Map([
  ['\u{2070}', 0n], ['\u{B9}', 1n], ['\u{B2}', 2n], ['\u{B3}', 3n], ['\u{2074}', 4n],
  ['\u{2075}', 5n], ['\u{2076}', 6n], ['\u{2077}', 7n], ['\u{2078}', 8n], ['\u{2079}', 9n],
]);
// Un nombre écrit en chiffres : des groupes de trois après une espace fine
// insécable, et un exposant facultatif en chiffres supérieurs.
const NOMBRE = /\d+(?:\u{202F}\d{3})*([\u{2070}\u{B9}\u{B2}\u{B3}\u{2074}-\u{2079}]*)/gu;

// Une puissance de dix écrite comme la section l'écrit : 10 et l'exposant en
// chiffres supérieurs.
const CHIFFRES_SUPERIEURS = [...EXPOSANTS.keys()];
const puissanceDeDix = (exposant) => `10${[...String(exposant)].map((chiffre) => CHIFFRES_SUPERIEURS[Number(chiffre)]).join('')}`;

// La valeur d'un nombre écrit, en BigInt.
function valeurEcrite(ecrit, exposant) {
  const base = BigInt(ecrit.slice(0, ecrit.length - exposant.length).replaceAll('\u{202F}', ''));
  if (exposant === '') return base;
  let puissance = 0n;
  for (const chiffre of exposant) puissance = puissance * 10n + EXPOSANTS.get(chiffre);
  return base ** puissance;
}

// Le texte lisible d'une section : les cibles des liens et des images
// retirées, qui portent des chemins et non des nombres cités.
const sansCibles = (texte) => texte.replace(/\]\([^)]*\)/g, ']');

// Les valeurs des nombres écrits en chiffres, sans doublon, en ordre croissant.
function nombresCites(texte) {
  const valeurs = new Set();
  for (const [ecrit, exposant] of sansCibles(texte).matchAll(NOMBRE)) valeurs.add(valeurEcrite(ecrit, exposant));
  return [...valeurs].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map(String);
}

const factorielle = (n) => (n <= 1n ? 1n : n * factorielle(n - 1n));

// La configuration d'une démonstration livrée, lue de son fichier.
function configurationLivree(cle) {
  const livree = LIVREES.find((l) => l.cle === cle);
  assert.ok(livree, `démonstration livrée ${cle}`);
  return configurationDepuisCharge(analyser(livree.texte).charge);
}

/**
 * Les nombres de la section recalculés sur les fichiers livrés, et les
 * phrases qui les affirment : chaque nombre cité en chiffres y est attaché à
 * la grandeur qu'il mesure et aux nombres en lettres dont il découle, de sorte
 * qu'un nombre déplacé vers une autre grandeur manque sa phrase même quand
 * l'ensemble des nombres cités ne change pas.
 *  - les façons d'asseoir la petite démonstration pour un tour, tables
 *    numérotées : n! divisé par le produit des factorielles des capacités ;
 *  - la plus petite puissance de dix que ce nombre dépasse sur tous les tours ;
 *  - le plafond a priori de la petite, tours × (capacité − 1) ;
 *  - le plafond d'un mobile de la grande, sur les tables de la plus grande capacité ;
 *  - le plafond des animateurs ancrés aux tables de la plus petite capacité.
 */
function attendusAlgorithme() {
  const petite = configurationLivree('petite');
  const n = petite.participants.length;
  const capacites = petite.tables.map((table) => table.capacite);
  assert.equal(capacites.reduce((a, b) => a + b, 0), n, 'la petite démonstration remplit exactement ses tables');
  assert.equal(new Set(capacites).size, 1, 'la petite démonstration a des tables égales');
  const capacite = capacites[0];
  const facons = capacites.reduce((reste, c) => reste / factorielle(BigInt(c)), factorielle(BigInt(n)));
  const surTousLesTours = facons ** BigInt(petite.tours);
  const puissance = BigInt(String(surTousLesTours).length - 1);
  const plafondPetite = diagnostiquer(petite).plafondAPriori;
  assert.equal(plafondPetite.min, plafondPetite.max);
  assert.equal(plafondPetite.max, petite.tours * (capacite - 1));

  const grande = configurationLivree('grande');
  const parCapacite = new Map();
  for (const table of grande.tables) parCapacite.set(table.capacite, [...(parCapacite.get(table.capacite) ?? []), table.id]);
  const grandeCapacite = Math.max(...parCapacite.keys());
  const petiteCapacite = Math.min(...parCapacite.keys());
  const diagnosticGrande = diagnostiquer(grande);
  assert.equal(diagnosticGrande.plafondAPriori.max, grande.tours * (grandeCapacite - 1));
  const tablesAnimees = new Set(parCapacite.get(petiteCapacite));
  const animateurs = grande.reservations
    .filter((r) => r.portee === 'tous' && tablesAnimees.has(r.table))
    .map((r) => r.participant);
  assert.equal(animateurs.length, tablesAnimees.size, 'un animateur par table de la plus petite capacité');
  const rangDe = new Map(grande.participants.map((p, rang) => [p.id, rang]));
  const plafondsAnimateurs = new Set(animateurs.map((id) => diagnosticGrande.plafondAPriori.parPersonne[rangDe.get(id)]));
  assert.equal(plafondsAnimateurs.size, 1);
  const plafondAnimateurs = [...plafondsAnimateurs][0];
  assert.equal(plafondAnimateurs, grande.tours * (petiteCapacite - 1));
  assert.equal(plafondAnimateurs, diagnosticGrande.plafondAPriori.min);

  const nombres = [facons, 10n ** puissance, BigInt(plafondPetite.max), BigInt(diagnosticGrande.plafondAPriori.max), BigInt(plafondAnimateurs)];
  const phrases = [
    `les ${enLettres(n)} personnes de la petite démonstration et ses ${enLettres(capacites.length)} tables numérotées de ${enLettres(capacite)} places`,
    `Pour un seul tour, il y a ${enChiffres(facons)} façons de les répartir`,
    `Sur ${enLettres(petite.tours)} tours, le nombre dépasse ${puissanceDeDix(puissance)}`,
    `chacun a ${enLettres(capacite - 1)} voisins par tour : en ${enLettres(petite.tours)} tours, il rencontre au plus ${enChiffres(plafondPetite.max)} personnes, sur ${enLettres(n - 1)} personnes`,
    `À une table de ${enLettres(grandeCapacite)}, chacun a ${enLettres(grandeCapacite - 1)} voisins : en ${enLettres(grande.tours)} tours, ${enChiffres(diagnosticGrande.plafondAPriori.max)} rencontres au plus`,
    `les ${enLettres(animateurs.length)} animateurs des tables de ${enLettres(petiteCapacite)} restent à leur table toute la soirée, et leur plafond vaut ${enChiffres(plafondAnimateurs)}`,
  ];
  return {
    nombres: [...new Set(nombres)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)).map(String),
    phrases,
    depasse: surTousLesTours > 10n ** puissance,
  };
}

// Les identifiants qu'exporte un module de src/, lus dans son texte.
function exportsDe(texte) {
  const noms = new Set();
  for (const [, nom] of texte.matchAll(/export\s+(?:default\s+)?(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g)) noms.add(nom);
  for (const [, liste] of texte.matchAll(/export\s*\{([^}]*)\}/g)) {
    for (const partie of liste.split(',')) {
      const nom = partie.trim().split(/\s+as\s+/).at(-1);
      if (/^[A-Za-z_$][\w$]*$/.test(nom) && nom !== 'default') noms.add(nom);
    }
  }
  return noms;
}

// Les modules de src/, hors épreuves, en chemins relatifs à la racine.
function modulesSource(dossier = join(RACINE, 'src')) {
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) => {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) return modulesSource(chemin);
    return entree.name.endsWith('.js') && !entree.name.endsWith('.test.js') ? [relative(RACINE, chemin)] : [];
  });
}

// Vrai pour un identifiant que sa forme désigne comme du code : une capitale
// après une minuscule, un souligné, un chiffre, ou tout en capitales. Un
// identifiant d'un seul mot minuscule (un verbe, un nom) se lit aussi comme
// un mot de la langue : il n'est relevé qu'appelé, suivi d'une parenthèse.
const formeDeCode = (nom) => /[a-z][A-Z]/.test(nom) || /[_\d$]/.test(nom) || /^[A-Z]{2,}$/.test(nom);

// Les familles d'algorithmes et les marques de complexité que la section ne
// nomme pas (§ 19.9), cherchées sans égard à la casse.
const VOCABULAIRE_SAVANT = [
  /heuristique/i, /recuit/i, /tabou/i, /glouton/i, /génétique/i, /recherche locale/i, /local search/i,
  /hill.?climbing/i, /annealing/i, /\bO\(/, /complexité/i, /NP-/,
];

/**
 * Les fautes de la section sur l'algorithme : absente ; pas neuf points ;
 * un nombre écrit en chiffres que l'arithmétique ne recalcule pas, ou un
 * nombre recalculé qu'elle ne cite pas ; une phrase qui affirme un nombre
 * absente ; un
 * bloc de code, un passage en code, un nom de fichier .js ou un chemin de
 * src/ ; un identifiant exporté de src/ ; un mot savant ; ni le diagnostic
 * ni les propositions en image.
 */
function fautesAlgorithme(texteGuide, { attendus, exportes }) {
  const section = sectionNommee(texteGuide, TITRE_ALGORITHME);
  if (section === null) return [`section « ${TITRE_ALGORITHME} » absente`];
  const texte = section.texte;
  const fautes = [];
  const points = [...texte.matchAll(/^### /gm)].length;
  if (points !== 9) fautes.push(`${points} points, le § 19.9 en compte neuf`);
  const cites = nombresCites(texte);
  if (JSON.stringify(cites) !== JSON.stringify(attendus.nombres)) {
    fautes.push(`nombres cités ${cites.join(', ')}, recalculés ${attendus.nombres.join(', ')} ; tout autre nombre s'écrit en lettres`);
  }
  for (const phrase of attendus.phrases) if (!enLigne(texte).includes(enLigne(phrase))) fautes.push(`phrase absente : « ${phrase} »`);
  if (/^(?: {4}|\t)\S/m.test(texte.replace(/^[-*] .*$|^\d+\. .*$/gm, ''))) fautes.push('bloc de code indenté');
  if (/```|~~~/.test(texte)) fautes.push('bloc de code');
  if (/`/.test(texte)) fautes.push('passage en code');
  if (/\.js\b/.test(texte)) fautes.push('nom de fichier .js');
  if (/\bsrc\//.test(texte)) fautes.push('chemin de src/');
  const lisible = sansCibles(texte);
  const releves = new Set();
  for (const [mot] of lisible.matchAll(/[\p{L}\p{N}_$]+/gu)) if (exportes.has(mot) && formeDeCode(mot)) releves.add(mot);
  for (const [, mot] of lisible.matchAll(/([\p{L}\p{N}_$]+)\(/gu)) if (exportes.has(mot)) releves.add(mot);
  for (const mot of [...releves].sort()) fautes.push(`identifiant exporté de src/ : ${mot}`);
  for (const motif of VOCABULAIRE_SAVANT) if (motif.test(lisible)) fautes.push(`vocabulaire savant : ${motif}`);
  const images = imagesReferencees(texte);
  for (const fichier of ['10-diagnostic', '11-propositions']) {
    if (!images.includes(cheminImage(fichier))) fautes.push(`la section ne s'appuie pas sur ${fichier}`);
  }
  return fautes;
}

describe('documentation : la section sur l’algorithme (§ 19.9)', () => {
  const attendus = attendusAlgorithme();
  const exportes = new Set(modulesSource().flatMap((chemin) => [...exportsDe(lire(chemin))]));

  test('les nombres recalculés sur les démonstrations livrées : 369\u{202F}600, 10\u{B2}\u{B2}, 8, 28 et 24, aucun autre', () => {
    assert.ok(attendus.depasse);
    assert.deepEqual(attendus.nombres, ['8', '24', '28', '369600', String(10n ** 22n)]);
    assert.ok(CATALOGUE.some((entree) => entree.cle === 'petite') && CATALOGUE.some((entree) => entree.cle === 'grande'));
  });

  test('la relève des identifiants exportés lit les modules de src/ : elle n’est pas vide', () => {
    assert.ok(exportes.size > 100, `${exportes.size} identifiants`);
    for (const nom of ['diagnostiquer', 'configurationDepuisCharge', 'CATALOGUE']) assert.ok(exportes.has(nom), nom);
  });

  test('la section du guide : neuf points, les nombres recalculés, ni code, ni identifiant, ni module, ni mot savant', () => {
    assert.deepEqual(fautesAlgorithme(lire(GUIDE_USAGE), { attendus, exportes }), []);
  });

  test('rouge : un nombre changé, un nombre de plus en chiffres, une phrase en lettres changée', () => {
    const texte = lire(GUIDE_USAGE);
    const change = texte.replace('369\u{202F}600', '369\u{202F}601');
    assert.notEqual(change, texte);
    assert.match(fautesAlgorithme(change, { attendus, exportes }).join('\n'), /nombres cités 8, 24, 28, 369601,/);
    const section = sectionNommee(texte, TITRE_ALGORITHME);
    const finSection = section.debut + section.texte.length;
    const enPlus = `${texte.slice(0, finSection)}Trois tours suffisent à 12 personnes.\n\n${texte.slice(finSection)}`;
    assert.match(fautesAlgorithme(enPlus, { attendus, exportes }).join('\n'), /nombres cités 8, 12, 24,/);
    const lettres = texte.replace('sept voisins', 'six voisins');
    assert.notEqual(lettres, texte);
    assert.match(fautesAlgorithme(lettres, { attendus, exportes }).join('\n'), /phrase absente : « À une table de huit, chacun a sept voisins/);
  });

  test('rouge : un nombre déplacé vers une autre grandeur, ou un nombre de tours changé à côté d’un nombre cité', () => {
    const texte = lire(GUIDE_USAGE);
    const avec = (change) => especes(fautesAlgorithme(change, { attendus, exportes }));
    // 8 et 24 échangés : l'ensemble des nombres cités ne change pas.
    const echange = remplacerPhrase(remplacerPhrase(texte, 'au plus 8 personnes', 'au plus 24 personnes'), 'leur plafond vaut 24', 'leur plafond vaut 8');
    assert.deepEqual(avec(echange), ['phrase absente', 'phrase absente']);
    assert.deepEqual(avec(remplacerPhrase(texte, 'Sur quatre tours, le nombre dépasse', 'Sur trois tours, le nombre dépasse')), ['phrase absente']);
    assert.deepEqual(avec(remplacerPhrase(texte, 'en quatre tours, 28 rencontres', 'en trois tours, 28 rencontres')), ['phrase absente']);
  });

  test('rouge : un nom de fonction collé, appelé ou en code, un .js, un bloc de code, un mot savant se relèvent', () => {
    const texte = lire(GUIDE_USAGE);
    const section = sectionNommee(texte, TITRE_ALGORITHME);
    const finSection = section.debut + section.texte.length;
    const avec = (ajout) => fautesAlgorithme(`${texte.slice(0, finSection)}${ajout}\n\n${texte.slice(finSection)}`, { attendus, exportes });
    assert.deepEqual(avec('Le logiciel appelle configurationDepuisCharge sur le fichier.'), ['identifiant exporté de src/ : configurationDepuisCharge']);
    assert.deepEqual(avec('Le moteur lance diagnostiquer(configuration) avant tout.'), ['identifiant exporté de src/ : diagnostiquer']);
    assert.deepEqual(avec('Le diagnostic vit dans le fichier diagnostic.js.'), ['nom de fichier .js']);
    assert.deepEqual(avec('```\nfaire tant que mieux\n```'), ['bloc de code', 'passage en code']);
    assert.deepEqual(avec('C’est une heuristique.'), ['vocabulaire savant : /heuristique/i']);
    // Un mot de la langue qu'un module exporte aussi ne se relève pas en prose.
    assert.deepEqual(avec('Le logiciel sait diagnostiquer une configuration.'), []);
  });
});

// --- GUIDE-WINDOWS.md ------------------------------------------------------------------

// Le gabarit du nom de l'exécutable et son préfixe, tirés de la dérivation de
// la version (§ 18.2) : le nom de la construction courante, sa version
// remplacée par les quatre champs nommés.
function gabaritDuNom() {
  const { nomFichier } = deriver(VERSION.affichee);
  const champs = VERSION.affichee.replaceAll('.', '_');
  assert.ok(nomFichier.includes(champs));
  return {
    gabarit: nomFichier.replace(champs, '<AAAA>_<MM>_<JJ>_<NN>'),
    prefixe: nomFichier.slice(0, nomFichier.indexOf(champs)),
  };
}

const NOM_PRODUIT = JSON.parse(lire('package.json')).productName;

// Les éléments de la première liste numérotée d'un texte, blancs normalisés :
// un élément s'ouvre sur « <chiffres>. » en début de ligne et se poursuit sur
// les lignes indentées qui le suivent ; la première ligne qui n'est ni l'un
// ni l'autre, blanche comprise, ferme la liste.
function listeNumerotee(texte) {
  const elements = [];
  for (const ligne of texte.split('\n')) {
    if (/^\d+\. /.test(ligne)) elements.push(ligne.replace(/^\d+\. /, ''));
    else if (elements.length > 0 && /^\s+\S/.test(ligne)) elements[elements.length - 1] += ` ${ligne}`;
    else if (elements.length > 0) break;
  }
  return elements.map(enLigne);
}

/**
 * Les fautes de GUIDE-WINDOWS.md (§ 16.1, § 8.6) : le gabarit et la phrase du
 * préfixe absents ; un nom daté cité ; une image ou une région ; un chemin
 * absolu ; la règle du dossier de travail sans sa liste de deux issues, dans
 * l'ordre du § 8.6 — d'abord le dossier data à côté de l'exécutable, puis le
 * dossier du produit dans les Documents —, ni la commande qui l'ouvre ; ni
 * « À propos » ni son bloc à copier.
 */
function fautesWindows(brut) {
  const { gabarit, prefixe } = gabaritDuNom();
  const texte = enLigne(brut);
  const fautes = [];
  if (!texte.includes(`\`${gabarit}\``)) fautes.push('gabarit du nom absent');
  if (!texte.includes(`le fichier dont le nom commence par \`${prefixe}\``)) fautes.push('phrase du préfixe absente');
  if (new RegExp(`${prefixe}\\d`).test(texte)) fautes.push('nom daté cité');
  if (/!\[|doc\/captures\/|<img/i.test(texte)) fautes.push('image');
  if (lireRegions(brut).length > 0) fautes.push('région engendrée');
  if (cheminsHorsRacine(brut, 'C:\\Racine\\Inventee').length > 0) fautes.push('chemin absolu');
  const dossier = sectionNommee(brut, 'Le dossier de travail');
  if (dossier === null) fautes.push('section « Le dossier de travail » absente');
  else {
    const issues = listeNumerotee(dossier.texte);
    const [portable = '', documents = ''] = issues;
    if (issues.length !== 2) fautes.push(`liste des issues : ${issues.length} élément(s), le § 8.6 en compte deux`);
    if (!portable.includes('`data`') || !portable.includes('à côté de l\u{2019}exécutable')) {
      fautes.push('issue portable absente : le dossier data à côté de l’exécutable');
    }
    if (!documents.includes(`\`Documents\\${NOM_PRODUIT}\\data\``)) fautes.push('issue Documents absente');
    if (!enLigne(dossier.texte).includes(`« ${t('accueil.dossier.explorateur')} »`)) fautes.push('commande qui ouvre le dossier absente');
  }
  const version = sectionNommee(brut, 'Où lire la version');
  const texteVersion = version === null ? '' : enLigne(version.texte);
  if (!texteVersion.includes(`« ${t('coquille.apropos.titre')} »`) || !texteVersion.includes(`« ${t('coquille.apropos.copier')} »`)) {
    fautes.push('« À propos » et son bloc à copier absents');
  }
  return fautes;
}

describe('documentation : GUIDE-WINDOWS.md, texte seul (§ 16.1, § 8.6, § 18.2)', () => {
  test('le gabarit, le préfixe, les deux issues du dossier de travail, la commande, la version', () => {
    assert.deepEqual(fautesWindows(lire(GUIDE_WINDOWS)), []);
  });

  test('les sections que § 16.1 demande, dans son ordre', () => {
    const titres = sections(lire(GUIDE_WINDOWS)).map((s) => s.titre);
    assert.deepEqual(titres, [
      'Obtenir l’exécutable',
      'Le lancer',
      'Le dossier de travail',
      'Sauvegarder',
      'Si l’antivirus bloque',
      'Où lire la version',
      'Signaler un problème',
    ]);
  });

  test('rouge : un nom daté, une issue retirée, une image ajoutée se relèvent', () => {
    const texte = lire(GUIDE_WINDOWS);
    const { prefixe } = gabaritDuNom();
    assert.deepEqual(fautesWindows(`${texte}\nLancer ${prefixe}2026_01_02_03.exe.\n`), ['nom daté cité']);
    assert.deepEqual(fautesWindows(texte.replaceAll('`data`', '`donnees`')), ['issue portable absente : le dossier data à côté de l’exécutable']);
    assert.deepEqual(fautesWindows(`${texte}\n![](doc/captures/01-premier-ecran.png)\n`), ['image']);
  });

  test('rouge : l’issue portable retirée de la liste, la seconde renumérotée, se relève', () => {
    const lignes = lire(GUIDE_WINDOWS).split('\n');
    const premier = lignes.findIndex((ligne) => /^1\. /.test(ligne));
    const second = lignes.findIndex((ligne) => /^2\. /.test(ligne));
    assert.ok(premier >= 0 && second > premier);
    const sans = [...lignes.slice(0, premier), lignes[second].replace(/^2\. /, '1. '), ...lignes.slice(second + 1)].join('\n');
    assert.deepEqual(fautesWindows(sans), [
      'liste des issues : 1 élément(s), le § 8.6 en compte deux',
      'issue portable absente : le dossier data à côté de l’exécutable',
      'issue Documents absente',
    ]);
  });
});
