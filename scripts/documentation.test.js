// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des régions engendrées de la documentation (§ 19.8, § 19.7) : la
// lecture des marqueurs et ses refus, le remplacement qui ne touche rien hors
// des régions, la vérification qui nomme la région corrigée à la main, les
// sept producteurs lus sur leur source unique, l'arbre des fichiers porteurs
// et l'écart de version, non bloquant au cycle court et bloquant à la
// livraison. L'arbre de test/fixtures/documentation/ porte un document aux
// régions conformes et un manifeste inventé, sans version réelle : chaque
// épreuve qui en a besoin l'écrit dans une copie temporaire.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../test/lanceur.js';
import { versionVoisine } from '../test/version_voisine.js';
import { creerFormat } from '../src/application/format.js';
import { COMMANDES } from '../src/application/commandes.js';
import { TABLES_APPLICATION, libelle } from '../src/application/libelles.js';
import { creerTraduction } from '../src/application/traduction.js';
import { ENTETES_DES_CHAMPS } from '../src/csv/colonnes.js';
import { LIVREES } from '../src/demo/livrees.js';
import { CATALOGUE } from '../src/demo/catalogue.js';
import { CONSTANTES } from '../src/geometrie/constantes.js';
import { REGLAGES_GENERATION } from '../src/interface/generation/reglages.js';
import { TABLES_INTERFACE } from '../src/interface/libelles.js';
import { RACCOURCIS } from '../src/interface/raccourcis.js';
import { diagnostiquer } from '../src/moteur/diagnostic.js';
import { analyser, configurationDepuisCharge } from '../src/stockage/document.js';
import { VERSION } from '../src/version.genere.js';
import {
  ErreurRegions,
  EXEMPLES_COMMANDES,
  PORTEURS,
  PRODUCTEURS,
  engendrerArbre,
  executer,
  lireRegions,
  producteursDe,
  remplacerRegions,
  tableau,
  tableauColonnesCsv,
  tableauCommandes,
  tableauContrastes,
  tableauDemonstrations,
  tableauRaccourcis,
  tableauReglages,
  tableauRegistre,
  verifierArbre,
  verifierRegions,
} from './documentation.js';

const FIXTURE = fileURLToPath(new URL('../test/fixtures/documentation/', import.meta.url));
const SCRIPT = fileURLToPath(new URL('./documentation.js', import.meta.url));
const MANIFESTE = 'doc/captures/manifeste.json';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const { nombre } = creerFormat(t);

// Producteurs inventés, comptés : chaque appel s'inscrit dans appels.
function producteursComptes(textes) {
  const appels = [];
  const producteurs = new Map(
    Object.entries(textes).map(([nom, texte]) => [
      nom,
      () => {
        appels.push(nom);
        return texte;
      },
    ]),
  );
  return { producteurs, appels };
}

const debut = (nom) => `<!-- engendre:debut ${nom} -->`;
const fin = (nom) => `<!-- engendre:fin ${nom} -->`;
const region = (nom, contenu) => `${debut(nom)}${contenu}${fin(nom)}`;

// Les lignes d'un tableau Markdown, sans en-tête ni séparateur : chacune la
// liste de ses cellules, une barre précédée d'une barre oblique inverse
// restant dans sa cellule.
function lignesDuTableau(texte) {
  return texte
    .split('\n')
    .slice(2)
    .map((ligne) =>
      ligne
        .slice(1, -1)
        .split(/(?<!\\)\|/)
        .map((cellule) => cellule.trim()),
    );
}

// Le texte privé du contenu de ses régions : ce qui reste hors des marqueurs,
// marqueurs compris.
function horsRegions(texte) {
  let reste = '';
  let curseur = 0;
  for (const { debut: d, fin: f } of lireRegions(texte)) {
    reste += texte.slice(curseur, d);
    curseur = f;
  }
  return reste + texte.slice(curseur);
}

// Une copie temporaire de l'arbre de fixture, dont chaque capture porte la
// version donnée (aucune version n'est écrite en clair, § 18.5, point 6) ;
// rendue avec la fonction qui l'efface.
function copieDeLArbre(version = VERSION.affichee) {
  const racine = mkdtempSync(join(tmpdir(), 'gtt-documentation-'));
  cpSync(FIXTURE, racine, { recursive: true });
  const chemin = join(racine, MANIFESTE);
  const manifeste = JSON.parse(readFileSync(chemin, 'utf8'));
  for (const capture of manifeste.captures) capture.versionReelle = version;
  writeFileSync(chemin, `${JSON.stringify(manifeste, null, 2)}\n`);
  return { racine, effacer: () => rmSync(racine, { recursive: true, force: true }) };
}

function manifesteFixture() {
  return JSON.parse(readFileSync(join(FIXTURE, MANIFESTE), 'utf8'));
}

// Une sortie qui retient ses lignes.
function sortieRetenue() {
  const lignes = [];
  return { lignes, ecrire: (ligne) => lignes.push(ligne) };
}

describe('documentation : lire les régions (§ 19.8)', () => {
  test('deux régions, dans leur ordre, chacune son nom, ses bornes et son contenu', () => {
    const texte = `Avant\n${region('reglages', '\nA\n')}\nEntre\n${region('raccourcis', '')}\nAprès\n`;
    const regions = lireRegions(texte);
    assert.deepEqual(
      regions.map(({ nom, contenu }) => ({ nom, contenu })),
      [
        { nom: 'reglages', contenu: '\nA\n' },
        { nom: 'raccourcis', contenu: '' },
      ],
    );
    for (const { debut: d, fin: f, contenu } of regions) assert.equal(texte.slice(d, f), contenu);
    assert.deepEqual(lireRegions('Aucune région ici.\n<!-- un commentaire ordinaire -->\n'), []);
  });

  test('un marqueur sans fin : échec qui nomme la région', () => {
    assert.throws(
      () => lireRegions(`${debut('reglages')}\ncontenu\n`),
      (erreur) => {
        assert.ok(erreur instanceof ErreurRegions);
        assert.deepEqual(erreur.fautes.map((f) => f.region), ['reglages']);
        assert.match(erreur.fautes[0].faute, /sans fin/);
        return true;
      },
    );
  });

  test('une fin sans début, une région ouverte dans une autre, une fin qui en ferme une autre : échecs nommés', () => {
    const cas = [
      [`texte\n${fin('commandes')}\n`, 'commandes', /sans début/],
      [`${debut('reglages')}\n${region('commandes', '')}\n${fin('reglages')}`, 'commandes', /ouverte dans la région « reglages »/],
      [`${debut('reglages')}\n${fin('commandes')}\n`, 'commandes', /ferme la région « reglages »/],
    ];
    for (const [texte, nom, motif] of cas) {
      assert.throws(
        () => lireRegions(texte),
        (erreur) => {
          assert.ok(erreur instanceof ErreurRegions, texte);
          const faute = erreur.fautes.find((f) => f.region === nom);
          assert.ok(faute !== undefined, `${texte} : ${JSON.stringify(erreur.fautes)}`);
          assert.match(faute.faute, motif);
          return true;
        },
      );
    }
  });

  test('une région en double : échec qui la nomme', () => {
    assert.throws(
      () => lireRegions(`${region('raccourcis', '\n')}\n${region('raccourcis', '\n')}\n`),
      (erreur) => {
        assert.ok(erreur instanceof ErreurRegions);
        assert.deepEqual(erreur.fautes.map((f) => [f.region, /en double/.test(f.faute)]), [['raccourcis', true]]);
        return true;
      },
    );
  });

  test('un marqueur illisible — sans nom, nom en capitales, mot inconnu, commentaire jamais fermé — est un échec, jamais un texte ordinaire', () => {
    for (const marqueur of [
      '<!-- engendre:debut -->',
      '<!-- engendre:debut Reglages -->',
      '<!-- engendre:milieu reglages -->',
      '<!-- engendre:debut reglages',
    ]) {
      assert.throws(
        () => lireRegions(`Avant\n${marqueur}\nAprès\n`),
        (erreur) => {
          assert.ok(erreur instanceof ErreurRegions, marqueur);
          assert.match(erreur.fautes[0].faute, /marqueur illisible/);
          return true;
        },
      );
    }
  });
});

describe('documentation : remplacer les régions (§ 19.8)', () => {
  test('chaque région reçoit ce que son producteur rend, entre deux lignes vides ; un second passage ne change rien', () => {
    const { producteurs } = producteursComptes({ reglages: '| a |\n|---|\n| 1 |', raccourcis: 'Texte\n' });
    const texte = `# Titre\n\n${region('reglages', '\nancien\n')}\n\n${region('raccourcis', '')}\n`;
    const rendu = remplacerRegions(texte, producteurs);
    assert.equal(
      rendu,
      `# Titre\n\n${region('reglages', '\n\n| a |\n|---|\n| 1 |\n\n')}\n\n${region('raccourcis', '\n\nTexte\n\n')}\n`,
    );
    assert.equal(remplacerRegions(rendu, producteurs), rendu);
  });

  test("rien ne change hors des marqueurs : marque d'ordre, fins de ligne CRLF, espaces de fin, tabulations, espace insécable, caractère astral", () => {
    const { producteurs } = producteursComptes({ commandes: 'neuf' });
    const avant = `\u{FEFF}Titre\r\nligne  \r\n\tretrait\u{A0}fin \u{1F600}\r\n${region('commandes', 'ancien\r\n')}\r\nqueue\t \r\n`;
    const apres = remplacerRegions(avant, producteurs);
    assert.notEqual(apres, avant);
    assert.equal(Buffer.compare(Buffer.from(horsRegions(apres)), Buffer.from(horsRegions(avant))), 0);
    const [{ debut: d }] = lireRegions(avant);
    assert.equal(apres.slice(0, d), avant.slice(0, d));
    assert.ok(apres.endsWith(`${fin('commandes')}\r\nqueue\t \r\n`));
  });

  test('un nom inconnu lève en le nommant, sans rien rendre', () => {
    const { producteurs, appels } = producteursComptes({ reglages: 'x' });
    assert.throws(
      () => remplacerRegions(`${region('reglages', '')}\n${region('inconnue', '')}\n`, producteurs),
      (erreur) => {
        assert.ok(erreur instanceof ErreurRegions);
        assert.deepEqual(erreur.fautes.map((f) => f.region), ['inconnue']);
        assert.match(erreur.fautes[0].faute, /nom inconnu/);
        return true;
      },
    );
    assert.deepEqual(appels, []);
  });

  test('un texte sans région se rend tel quel', () => {
    const { producteurs, appels } = producteursComptes({ reglages: 'x' });
    assert.equal(remplacerRegions('Rien à engendrer.\n', producteurs), 'Rien à engendrer.\n');
    assert.deepEqual(appels, []);
  });
});

describe('documentation : vérifier les régions (§ 19.8, § 14.3)', () => {
  const { producteurs } = producteursComptes({ reglages: 'R', raccourcis: 'K' });
  const conforme = remplacerRegions(`${region('reglages', '')}\n\n${region('raccourcis', '')}\n`, producteurs);

  test('des régions conformes : aucune faute', () => {
    assert.deepEqual(verifierRegions(conforme, producteurs), []);
  });

  test('une correction à la main dans une région : une faute, qui nomme cette région seule', () => {
    const corrige = conforme.replace('\n\nK\n\n', '\n\nK corrigé à la main\n\n');
    assert.notEqual(corrige, conforme);
    const fautes = verifierRegions(corrige, producteurs);
    assert.deepEqual(fautes.map((f) => f.region), ['raccourcis']);
    assert.match(fautes[0].faute, /diffère de ce que le producteur engendre/);
    assert.match(fautes[0].faute, /K corrigé à la main/);
  });

  test('un nom inconnu, une région en double, un marqueur sans fin : des fautes, pas une exception', () => {
    assert.deepEqual(
      verifierRegions(`${conforme}${region('inconnue', '')}\n`, producteurs).map((f) => [f.region, /nom inconnu/.test(f.faute)]),
      [['inconnue', true]],
    );
    assert.deepEqual(
      verifierRegions(`${conforme}${region('reglages', '\n\nR\n\n')}\n`, producteurs).map((f) => f.region),
      ['reglages'],
    );
    assert.match(verifierRegions(`${conforme}${debut('reglages')}\n`, producteurs)[0].faute, /sans fin/);
  });

  test('zéro région : une faute, un balayage vide ne passe pas (§ 14.2)', () => {
    const fautes = verifierRegions('Un document sans marqueur.\n', producteurs);
    assert.equal(fautes.length, 1);
    assert.equal(fautes[0].region, null);
    assert.match(fautes[0].faute, /aucune région/);
  });

  test("un producteur qui lève : une faute qui nomme sa région et l'erreur", () => {
    const enPanne = new Map([['reglages', () => { throw new Error('source illisible'); }]]);
    const fautes = verifierRegions(`${region('reglages', '')}\n`, enPanne);
    assert.deepEqual(fautes.map((f) => f.region), ['reglages']);
    assert.match(fautes[0].faute, /source illisible/);
  });
});

describe('documentation : les producteurs, chacun sur sa source unique (§ 19.8)', () => {
  test('les huit producteurs, dans leur ordre ; PORTEURS est une liste figée', () => {
    assert.deepEqual(
      PRODUCTEURS.map(({ nom }) => nom),
      ['reglages', 'colonnes-csv', 'colonnes-objectifs', 'commandes', 'raccourcis', 'demonstrations', 'contrastes', 'constantes'],
    );
    assert.ok(Object.isFrozen(PRODUCTEURS) && Object.isFrozen(PORTEURS));
    assert.deepEqual([...producteursDe({ manifeste: () => null }).keys()], PRODUCTEURS.map(({ nom }) => nom));
  });

  test("tableau : une ligne d'en-tête, un séparateur, une ligne par entrée ; une barre et un saut de ligne ne cassent pas la cellule", () => {
    assert.equal(
      tableau(['A', 'B'], [['x | y', 'deux\nlignes']]),
      '| A | B |\n|---|---|\n| x \\| y | deux lignes |',
    );
  });

  test('reglages : une ligne par entrée de la définition, son libellé, son écran et son défaut ; une entrée ajoutée paraît', () => {
    const lignes = lignesDuTableau(tableauReglages());
    assert.equal(lignes.length, REGLAGES_GENERATION.length);
    // Le défaut écrit de chaque genre : un nombre, une case ; le libellé du
    // mode par défaut et les paliers de l'ordre par défaut, écrits en toutes
    // lettres.
    const ecrit = {
      champ: ({ defaut }) => nombre(defaut),
      bascule: ({ defaut }) => (defaut ? 'cochée' : 'décochée'),
      choix: () => 'le plus de places servies',
      ordre: () =>
        'écart au plafond a priori, puis excédent de collisions, puis collisions cumulées, puis tours hors objectif, ' +
        "puis rencontres répétées et retours, puis animateurs non rencontrés, puis redondance d'organisation",
    };
    REGLAGES_GENERATION.forEach((entree, rang) => {
      assert.deepEqual(lignes[rang], [t(entree.etiquette), t(`coquille.section.${entree.section}`), ecrit[entree.genre](entree)]);
    });
    // Sept bascules, le mode et l'ordre (§ 5.3, § 5.7).
    assert.equal(REGLAGES_GENERATION.filter(({ genre }) => genre === 'bascule').length, 7);
    const ordre = REGLAGES_GENERATION.find(({ genre }) => genre === 'ordre');
    const partage = { ...ordre, defaut: [[{ critere: 'excedentCollisions', poids: 2 }, { critere: 'redondance', poids: 3 }], [{ critere: 'collisionsCumulees', poids: 1 }]] };
    assert.equal(
      lignesDuTableau(tableauReglages([partage]))[0][2],
      `${t('mobilier.critere.excedentCollisions')} avec ${t('mobilier.critere.redondance')}, puis ${t('mobilier.critere.collisionsCumulees')}`,
    );
    const ajoutee = { ...REGLAGES_GENERATION[0], etiquette: 'generation.reglage.graine', defaut: 4_294_967_295 };
    const avecAjout = lignesDuTableau(tableauReglages([...REGLAGES_GENERATION, ajoutee]));
    assert.deepEqual(avecAjout.at(-1), [t('generation.reglage.graine'), t('coquille.section.generation'), '4\u{202F}294\u{202F}967\u{202F}295']);
  });

  test('colonnes-csv : une ligne par champ, son en-tête puis ses synonymes, rien de plus', () => {
    const lignes = lignesDuTableau(tableauColonnesCsv());
    assert.deepEqual(
      lignes,
      ENTETES_DES_CHAMPS.map(([, [entete, ...synonymes]]) => [
        `\`${entete}\``,
        synonymes.length === 0 ? t('format.vide') : synonymes.map((s) => `\`${s}\``).join(', '),
      ]),
    );
    assert.deepEqual(lignes.find(([c]) => c === '`titre_pressenti`'), ['`titre_pressenti`', '`titre`, `rôle`']);
  });

  test('colonnes-objectifs : une ligne par champ du CSV des objectifs, son en-tête puis ses synonymes (§ 10.4)', () => {
    assert.deepEqual(lignesDuTableau(PRODUCTEURS.find(({ nom }) => nom === 'colonnes-objectifs').produire({})), [
      ['`table`', t('format.vide')],
      ['`tour`', t('format.vide')],
      ['`objectif`', '`objectifs`'],
      ['`regle`', '`règle`'],
    ]);
  });

  test("commandes : une ligne par commande du registre, dans son ordre, et son libellé d'historique composé par la traduction", () => {
    const lignes = lignesDuTableau(tableauCommandes());
    assert.deepEqual(lignes.map(([nom]) => nom), [...COMMANDES.keys()].map((nom) => `\`${nom}\``));
    for (const [cellule, exemple] of lignes) {
      const nom = cellule.slice(1, -1);
      const cle = `ENTREE_${nom.replace(/[A-Z]/g, (lettre) => `_${lettre}`).toUpperCase()}`;
      assert.equal(exemple, libelle(cle, EXEMPLES_COMMANDES[nom]), nom);
    }
    assert.ok(lignes.some(([, exemple]) => exemple === 'Ajouté Iris Ombrelle'));
  });

  test("commandes : une commande sans exemple, ou sans libellé d'historique, lève en la nommant", () => {
    const avecNouvelle = new Map([...COMMANDES, ['commandeInventee', () => null]]);
    assert.throws(() => tableauCommandes(avecNouvelle), /commandeInventee/);
    assert.throws(
      () => tableauCommandes(avecNouvelle, { ...EXEMPLES_COMMANDES, commandeInventee: {} }),
      /ENTREE_COMMANDE_INVENTEE/,
    );
  });

  test('raccourcis : une ligne par contexte et par effet, ses touches nommées, son libellé ; chaque entrée de la table y est', () => {
    const lignes = lignesDuTableau(tableauRaccourcis());
    const effets = [...new Set(RACCOURCIS.map(({ contexte, effet }) => `${contexte}.${effet}`))];
    assert.equal(lignes.length, effets.length);
    lignes.forEach(([, , texte], rang) => assert.equal(texte, t(`raccourcis.${effets[rang]}`)));
    const entrer = lignes[effets.indexOf('plan.entrer')];
    assert.equal(entrer[1], 'Entrée ou Espace');
    assert.equal(lignes[effets.indexOf('plan.droite')][1], '\u{2192}');
    assert.equal(lignes[effets.indexOf('grille.precedente')][1], 'Maj+Tab');
    assert.deepEqual(lignes[effets.indexOf('boutonMenu.ouvrirPremier')].slice(0, 2), ['Bouton de menu', 'Entrée ou Espace ou \u{2193}']);
    assert.deepEqual(
      ['menu.premier', 'menu.dernier', 'menu.quitter'].map((effet) => lignes[effets.indexOf(effet)].slice(0, 2)),
      [['Menu ouvert', 'Début'], ['Menu ouvert', 'Fin'], ['Menu ouvert', 'Tab']],
    );
    // Les retours au clavier : Ctrl+ et Maj+ devant la lettre, dans l'ordre
    // que toucheDe écrit ; les deux touches de refaire sur une ligne.
    assert.deepEqual(
      ['evenement.defaire', 'evenement.refaire'].map((effet) => lignes[effets.indexOf(effet)].slice(0, 2)),
      [['Écran de l\u{2019}événement, hors saisie', 'Ctrl+Z'], ['Écran de l\u{2019}événement, hors saisie', 'Ctrl+Maj+Z ou Ctrl+Y']],
    );
    assert.ok(effets.indexOf('evenement.refaire') < effets.indexOf('fenetre.fermer'));
    assert.throws(() => tableauRaccourcis([...RACCOURCIS, { ...RACCOURCIS[0], touche: 'Pause' }]), /Pause/);
    // Une lettre en minuscule, un préfixe hors de l'ordre de toucheDe : la
    // table ne les atteint jamais, le tableau les refuse en les nommant.
    for (const touche of ['Ctrl+z', 'Maj+Ctrl+Z', 'Ctrl+']) {
      assert.throws(() => tableauRaccourcis([...RACCOURCIS, { ...RACCOURCIS[0], touche }]), (erreur) => erreur.message.includes(JSON.stringify(touche)), touche);
    }
  });

  test('demonstrations : effectif, tables, tours et plafond a priori égaux à diagnostiquer sur chaque fichier livré', () => {
    const lignes = lignesDuTableau(tableauDemonstrations());
    assert.equal(lignes.length, LIVREES.length);
    LIVREES.forEach(({ cle, texte }, rang) => {
      const configuration = configurationDepuisCharge(analyser(texte).charge);
      const { plafondAPriori } = diagnostiquer(configuration);
      assert.deepEqual(lignes[rang], [
        CATALOGUE.find((entree) => entree.cle === cle).nom,
        nombre(configuration.participants.length),
        nombre(configuration.tables.length),
        nombre(configuration.tours),
        nombre(plafondAPriori.min),
        nombre(plafondAPriori.max),
      ]);
    });
    assert.deepEqual(lignes[0].slice(1), ['260', '33', '4', '24', '28']);
  });

  test("contrastes : par jeton et rôle, le plus petit ratio de chaque thème et la première capture où il l'est", () => {
    assert.deepEqual(lignesDuTableau(tableauContrastes(manifesteFixture())), [
      ['`encre`', 'marque', '3', t('format.vide'), t('format.vide'), '5,50', '02-import-apercu'],
      ['`encre`', 'texte', '4,5', '9,81', '02-import-apercu', '11,20', '01-premier-ecran'],
      ['`encre-douce`', 'texte', '4,5', '5,20', '01-premier-ecran', '4,62', '02-import-apercu'],
      ['`focus`', 'marque', '3', '3,40', '01-premier-ecran', '3,90', '02-import-apercu'],
    ]);
  });

  test('contrastes : un style sans jeton, ou deux seuils pour un même rôle, lèvent ; aucun style relevé lève', () => {
    const sansJeton = manifesteFixture();
    delete sansJeton.captures[1].styles.sombre[0].jeton;
    assert.throws(() => tableauContrastes(sansJeton), /02-import-apercu/);
    const deuxSeuils = manifesteFixture();
    deuxSeuils.captures[1].styles.clair[0].seuil = 3;
    assert.throws(() => tableauContrastes(deuxSeuils), /seuil/);
    const vide = manifesteFixture();
    for (const capture of vide.captures) capture.styles = { clair: [], sombre: [] };
    assert.throws(() => tableauContrastes(vide), /aucun style/);
    assert.throws(() => tableauContrastes(null), /manifeste/);
  });

  test('constantes : une ligne par constante du registre, sa valeur, son unité, son propriétaire, son statut en toutes lettres et son protocole', () => {
    const lignes = lignesDuTableau(tableauRegistre());
    assert.equal(lignes.length, CONSTANTES.length);
    CONSTANTES.forEach((c, rang) => {
      assert.equal(lignes[rang][0], `\`${c.nom}\``);
      assert.equal(lignes[rang][2], c.unite);
      assert.equal(lignes[rang][3], c.proprietaire);
      assert.equal(lignes[rang][4], c.statut === 'mesuree' ? 'mesurée' : 'défaut de travail');
      assert.equal(lignes[rang][5].replace(/\\\|/g, '|'), c.protocole.replace(/\s*\n\s*/g, ' '));
    });
    const inventees = [
      { ...CONSTANTES[0], nom: 'A', valeur: 0.3, statut: 'mesuree' },
      { ...CONSTANTES[0], nom: 'B', valeur: null },
      { ...CONSTANTES[0], nom: 'C', valeur: 200_000 },
    ];
    assert.deepEqual(
      lignesDuTableau(tableauRegistre(inventees)).map((l) => [l[1], l[4]]),
      [['0,3', 'mesurée'], [t('format.vide'), 'défaut de travail'], ['200\u{202F}000', 'défaut de travail']],
    );
  });
});

describe("documentation : l'arbre des porteurs et l'écart de version (§ 19.7, § 19.8)", () => {
  test("l'arbre de fixture, à la version de la construction : conforme, code zéro, livraison comprise", () => {
    const { racine, effacer } = copieDeLArbre();
    try {
      for (const livraison of [false, true]) {
        const bilan = verifierArbre({ racine, porteurs: ['README.md'], livraison });
        assert.deepEqual(bilan.fautes, []);
        assert.equal(bilan.ecart, null);
        assert.equal(bilan.code, 0);
      }
    } finally {
      effacer();
    }
  });

  test("seul l'écart de version change le code de sortie : affiché sans --livraison, bloquant avec", () => {
    const voisine = versionVoisine(VERSION.affichee);
    const { racine, effacer } = copieDeLArbre(voisine);
    try {
      const court = verifierArbre({ racine, porteurs: ['README.md'], livraison: false });
      const livraison = verifierArbre({ racine, porteurs: ['README.md'], livraison: true });
      assert.deepEqual(court.ecart, { manifeste: voisine, construction: VERSION.affichee });
      assert.deepEqual(livraison.ecart, court.ecart);
      assert.deepEqual([court.fautes, livraison.fautes], [[], []]);
      assert.deepEqual([court.code, livraison.code], [0, 1]);
      const sortie = sortieRetenue();
      assert.equal(executer(['verifier', '--racine', racine, '--porteur', 'README.md'], { sortie: sortie.ecrire }), 0);
      assert.ok(sortie.lignes.some((l) => /écart de version \(non bloquant\)/.test(l) && l.includes(voisine)), sortie.lignes.join('\n'));
      const bloquee = sortieRetenue();
      assert.equal(executer(['verifier', '--livraison', '--racine', racine, '--porteur', 'README.md'], { sortie: bloquee.ecrire }), 1);
      assert.ok(bloquee.lignes.some((l) => /écart de version \(bloquant\)/.test(l)), bloquee.lignes.join('\n'));
    } finally {
      effacer();
    }
  });

  test('la ligne de commande, en processus : --livraison sort non nul pour le seul écart, zéro sans lui', () => {
    const lancer = (racine, ...options) =>
      spawnSync(process.execPath, [SCRIPT, 'verifier', ...options, '--racine', racine, '--porteur', 'README.md'], { encoding: 'utf8' });
    const avecEcart = copieDeLArbre(versionVoisine(VERSION.affichee));
    const sansEcart = copieDeLArbre();
    try {
      assert.equal(lancer(avecEcart.racine, '--livraison').status, 1);
      assert.equal(lancer(avecEcart.racine).status, 0);
      const conforme = lancer(sansEcart.racine, '--livraison');
      assert.equal(conforme.status, 0, conforme.stdout + conforme.stderr);
      assert.equal(spawnSync(process.execPath, [SCRIPT, 'publier'], { encoding: 'utf8' }).status, 2);
    } finally {
      avecEcart.effacer();
      sansEcart.effacer();
    }
  });

  test("un manifeste absent est un écart : l'arbre ne prouve aucune version", () => {
    const { racine, effacer } = copieDeLArbre();
    try {
      rmSync(join(racine, MANIFESTE));
      writeFileSync(join(racine, 'SANS-CONTRASTES.md'), `${region('colonnes-csv', `\n\n${tableauColonnesCsv()}\n\n`)}\n`);
      const bilan = verifierArbre({ racine, porteurs: ['SANS-CONTRASTES.md'], livraison: true });
      assert.deepEqual(bilan.fautes, []);
      assert.deepEqual(bilan.ecart, { manifeste: null, construction: VERSION.affichee });
      assert.equal(bilan.code, 1);
    } finally {
      effacer();
    }
  });

  test("un fichier hors de PORTEURS n'est pas lu : seuls le porteur et le manifeste le sont", () => {
    const { racine, effacer } = copieDeLArbre();
    try {
      const lus = [];
      const lire = (chemin) => {
        lus.push(chemin);
        return readFileSync(join(racine, chemin), 'utf8');
      };
      assert.equal(verifierArbre({ racine, porteurs: ['README.md'], lire }).code, 0);
      assert.deepEqual(lus, ['README.md', MANIFESTE]);
      const avecHors = verifierArbre({ racine, porteurs: ['README.md', 'HORS-PORTEURS.md'] });
      assert.deepEqual(avecHors.fautes.map((f) => f.chemin), ['HORS-PORTEURS.md']);
      assert.match(avecHors.fautes[0].faute, /sans fin/);
    } finally {
      effacer();
    }
  });

  test('zéro région dans un porteur, un porteur absent, aucun porteur : des fautes, code non nul', () => {
    const { racine, effacer } = copieDeLArbre();
    try {
      writeFileSync(join(racine, 'VIDE.md'), '# Rien\n');
      const bilan = verifierArbre({ racine, porteurs: ['README.md', 'VIDE.md', 'ABSENT.md'] });
      assert.deepEqual(bilan.fautes.map((f) => f.chemin), ['VIDE.md', 'ABSENT.md']);
      assert.match(bilan.fautes[0].faute, /aucune région/);
      assert.match(bilan.fautes[1].faute, /absent/);
      assert.equal(bilan.code, 1);
      const sansPorteur = verifierArbre({ racine, porteurs: [] });
      assert.equal(sansPorteur.code, 1);
      assert.match(sansPorteur.fautes[0].faute, /aucun fichier porteur/);
    } finally {
      effacer();
    }
  });

  test("sans liste donnée, verifier, engendrer et la ligne de commande s'en tiennent à PORTEURS : mêmes lectures, mêmes écritures, même bilan qu'avec PORTEURS en clair", () => {
    const { racine, effacer } = copieDeLArbre();
    // Un lancement espionné : ce qu'il lit, ce qu'il écrirait, ce qu'il
    // affiche et ce qu'il rend, la liste de porteurs donnée ou non.
    const espionne = (lancer, options) => {
      const lus = [];
      const ecrits = [];
      const sortie = sortieRetenue();
      const lire = (chemin) => {
        lus.push(chemin);
        return readFileSync(join(racine, chemin), 'utf8');
      };
      const rendu = lancer({ ...options, lire, ecrire: (chemin) => ecrits.push(chemin), sortie: sortie.ecrire });
      return { rendu, lus, ecrits, lignes: sortie.lignes };
    };
    const lanceurs = [
      ['verifierArbre', (options) => verifierArbre({ racine, ...options })],
      ['engendrerArbre', (options) => engendrerArbre({ racine, ...options })],
      ['executer verifier', (options) => executer(['verifier', '--racine', racine], options)],
      ['executer engendrer', (options) => executer(['engendrer', '--racine', racine], options)],
    ];
    try {
      for (const [nom, lancer] of lanceurs) {
        const implicite = espionne(lancer, {});
        assert.deepEqual(implicite, espionne(lancer, { porteurs: PORTEURS }), nom);
        assert.deepEqual(implicite.lus.filter((chemin) => chemin !== MANIFESTE), [...PORTEURS], nom);
      }
    } finally {
      effacer();
    }
  });

  test('engendrer réécrit les seules régions, octets du reste identiques ; vérifier passe ensuite, et un second passage n’écrit rien', () => {
    const { racine, effacer } = copieDeLArbre();
    try {
      const noms = PRODUCTEURS.map(({ nom }) => nom);
      const avant = `\u{FEFF}# Annexe\r\n\r\n${noms.map((nom) => `## ${nom}  \r\n${region(nom, '\nà refaire\n')}\r\n`).join('\t\r\n')}fin\u{A0}\r\n`;
      writeFileSync(join(racine, 'ANNEXE.md'), avant);
      const porteurs = ['README.md', 'ANNEXE.md'];
      assert.notEqual(verifierArbre({ racine, porteurs }).code, 0);
      const premier = engendrerArbre({ racine, porteurs });
      assert.deepEqual([premier.fautes, premier.ecrits, premier.code], [[], ['ANNEXE.md'], 0]);
      const apres = readFileSync(join(racine, 'ANNEXE.md'), 'utf8');
      assert.equal(Buffer.compare(Buffer.from(horsRegions(apres)), Buffer.from(horsRegions(avant))), 0);
      assert.deepEqual(lireRegions(apres).map((r) => r.nom), noms);
      assert.deepEqual(verifierArbre({ racine, porteurs, livraison: true }).code, 0);
      assert.deepEqual(engendrerArbre({ racine, porteurs }).ecrits, []);
      assert.equal(readFileSync(join(racine, 'README.md'), 'utf8'), readFileSync(join(FIXTURE, 'README.md'), 'utf8'));
    } finally {
      effacer();
    }
  });

  test("engendrer n'écrit rien quand un porteur est en faute", () => {
    const { racine, effacer } = copieDeLArbre();
    try {
      writeFileSync(join(racine, 'A.md'), `${region('reglages', '')}\n`);
      writeFileSync(join(racine, 'B.md'), `${debut('commandes')}\n`);
      const ecrits = [];
      const bilan = engendrerArbre({ racine, porteurs: ['A.md', 'B.md'], ecrire: (chemin) => ecrits.push(chemin) });
      assert.equal(bilan.code, 1);
      assert.deepEqual(bilan.fautes.map((f) => f.chemin), ['B.md']);
      assert.deepEqual([bilan.ecrits, ecrits], [[], []]);
      assert.equal(readFileSync(join(racine, 'A.md'), 'utf8'), `${region('reglages', '')}\n`);
    } finally {
      effacer();
    }
  });

  test("le README de l'arbre de fixture est tel qu'engendré : sa région de contrastes est celle du manifeste de fixture", () => {
    const [{ nom, contenu }] = lireRegions(readFileSync(join(FIXTURE, 'README.md'), 'utf8'));
    assert.equal(nom, 'contrastes');
    assert.equal(contenu, `\n\n${tableauContrastes(manifesteFixture())}\n\n`);
  });

  test("la ligne de commande refuse un mode inconnu, --livraison hors de verifier et une option sans valeur, code 2, sans rien lire", () => {
    for (const argv of [[], ['publier'], ['engendrer', '--livraison'], ['verifier', '--racine'], ['verifier', '--inconnue']]) {
      const sortie = sortieRetenue();
      const lus = [];
      assert.equal(executer(argv, { sortie: sortie.ecrire, lire: (chemin) => lus.push(chemin) }), 2, argv.join(' '));
      assert.deepEqual(lus, []);
      assert.ok(sortie.lignes.some((l) => /engendrer \| verifier/.test(l)), argv.join(' '));
    }
  });
});
