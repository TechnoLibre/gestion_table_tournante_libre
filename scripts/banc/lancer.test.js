// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'orchestrateur du banc (§ 19.10, § 14.1, § 19.8), sous node
// et sans navigateur : l'assemblage du relevé, qui refuse une mesure
// manquante et range les mesures dans l'ordre du registre ; la
// configuration, liste fermée du contrat, qui ne nomme pas la machine ;
// le jugement qui rend la sortie non nulle ; la région des constantes ; le
// déroulé de executer, sur des effets factices. Les machines, les versions
// et les valeurs sont inventées ; le relevé committé n'est lu que pour sa
// conformité.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CONSTANTES } from '../../src/geometrie/constantes.js';
import { projetBanc } from './projet.js';
import { accordRegistre, verifierReleve } from './releve.js';
import releveCommite from './releve.json' with { type: 'json' };
import {
  ATTENDUES,
  CHEMIN_RELEVE,
  FAMILLE_EMBARQUEE,
  GARDES,
  SORTIES_NAVIGATEUR,
  assembler,
  configurationDuBanc,
  executer,
  jugement,
  regionConstantes,
} from './lancer.js';

// Un système d'exploitation inventé, au nom d'hôte, au dossier personnel, à
// l'utilisateur et au modèle de processeur reconnaissables : aucun ne doit
// atteindre le relevé.
const HOTE_INVENTE = 'poste-quenouille-7';
const UTILISATEUR_INVENTE = 'quenouille';
const DOSSIER_INVENTE = '/home/quenouille';
const MODELE_INVENTE = 'Processeur Quenouille 6 cœurs';
const systemeInvente = () => ({
  hostname: () => HOTE_INVENTE,
  homedir: () => DOSSIER_INVENTE,
  userInfo: () => ({ username: UTILISATEUR_INVENTE, homedir: DOSSIER_INVENTE }),
  type: () => 'Linux',
  arch: () => 'x64',
  cpus: () => Array.from({ length: 6 }, () => ({ model: MODELE_INVENTE })),
  availableParallelism: () => 6,
});

const configuration = () => configurationDuBanc({ systeme: systemeInvente(), node: 'v26.10.0', navigateur: 'Chromium 140.0' });

// Les sorties d'un passage du banc, de valeurs inventées : une mesure par
// constante du banc et par garde, rangées dans un ordre qui n'est pas celui
// du registre. Comme celles du navigateur, les mesures de texte et la garde
// du temps par image portent leur ralentissement ; celles du parallèle n'en
// portent pas, et leur sortie le dit dans sa configuration.
const sorties = () =>
  new Map([
    ['plafond', { plafondAPriori: [{ cle: 'grande', N: 260, T: 33, R: 4, msPlafonds: 0.07, msDiagnostic: 0.9 }] }],
    [
      'parallele',
      {
        format: 1,
        configuration: {
          cadre: { largeur: 1366, hauteur: 700 },
          facteurEchelle: 1,
          navigateur: null,
          node: null,
          processeursLogiques: 6,
          ralentissementCpu: 1,
          police: null,
        },
        mesures: [
          { nom: 'RALENTISSEMENT_PLEINE_CHARGE', unite: '×', valeurProposee: 2.5, critere: 't(L) / t(1)', courbe: [] },
          { nom: 'DUREE_GENERATION_PAR_DEFAUT', unite: 'ms', valeurProposee: 600, critere: 'médiane de 3 générations' },
        ],
        parallele: [{ coeurs: 1, ralentissement: 1 }],
      },
    ],
    [
      'temps_image',
      {
        format: 1,
        mesures: [{ nom: 'TEMPS_IMAGE_LISTES', unite: 'ms', valeurProposee: null, critere: 'p95 sous 33 ms', courbe: [], verdict: 'tenu', ralentissementCpu: 4 }],
      },
    ],
    [
      'temoin',
      {
        format: 1,
        mesures: [{ nom: 'TOLERANCE_CHAINE_TEMOIN', unite: 'rapport', valeurProposee: 0.02, critere: 'quart du repli', police: 'Noto Sans', ralentissementCpu: 1 }],
      },
    ],
    [
      'qualite',
      {
        format: 1,
        mesures: [
          { nom: 'LARGEUR_TRONCATURE_NOM_PX', unite: 'px', valeurProposee: 190, critere: 'nom de référence', police: 'Noto Sans', ralentissementCpu: 1 },
          { nom: 'SEUIL_MATRICE_PARTICIPANTS', unite: 'participants', valeurProposee: 38, critere: 'case de 24 px', police: 'Noto Sans', ralentissementCpu: 1 },
        ],
      },
    ],
    [
      'sieges_lisibles',
      {
        format: 1,
        mesures: [{ nom: 'SEUIL_SIEGES_LISIBLES', unite: 'places', valeurProposee: 17, critere: 'liste dans le plan', police: 'Noto Sans', ralentissementCpu: 1 }],
      },
    ],
    ['harnais', { format: 1, releves: [{ controle: 'cadre' }] }],
  ]);

const noms = (releve) => releve.mesures.map(({ nom }) => nom);
const DU_BANC = CONSTANTES.filter((c) => c.proprietaire === 'banc').map((c) => c.nom);

describe('lancer : les mesures attendues', () => {
  test('chaque constante du banc du registre est attendue, dans l’ordre du registre, puis les gardes, par ordre de nom', () => {
    assert.ok(DU_BANC.length > 0);
    assert.deepEqual([...ATTENDUES], [...DU_BANC, ...GARDES]);
    assert.deepEqual([...GARDES], ['DUREE_GENERATION_PAR_DEFAUT', 'TEMPS_IMAGE_LISTES']);
    assert.ok(GARDES.every((nom) => !CONSTANTES.some((c) => c.nom === nom)));
  });
});

describe('lancer : assembler (§ 19.10)', () => {
  test('un relevé conforme : les mesures dans l’ordre du registre, puis les gardes ; plafond et parallèle repris', () => {
    const releve = assembler({ configuration: configuration(), sorties: sorties(), attendues: ATTENDUES });
    assert.deepEqual(verifierReleve(releve), []);
    assert.deepEqual(noms(releve), [
      'SEUIL_SIEGES_LISIBLES',
      'TOLERANCE_CHAINE_TEMOIN',
      'RALENTISSEMENT_PLEINE_CHARGE',
      'SEUIL_MATRICE_PARTICIPANTS',
      'LARGEUR_TRONCATURE_NOM_PX',
      'DUREE_GENERATION_PAR_DEFAUT',
      'TEMPS_IMAGE_LISTES',
    ]);
    assert.deepEqual(Object.keys(releve), ['format', 'configuration', 'mesures', 'plafondAPriori', 'parallele']);
    assert.equal(releve.plafondAPriori[0].cle, 'grande');
    assert.deepEqual(releve.parallele, [{ coeurs: 1, ralentissement: 1 }]);
    assert.equal(releve.mesures[0].police, 'Noto Sans');
  });

  test('l’ordre des mesures ne dépend ni de l’ordre des sorties ni de celui des attendues', () => {
    const inverse = new Map([...sorties()].reverse());
    const attendues = [...ATTENDUES].reverse();
    const releve = assembler({ configuration: configuration(), sorties: inverse, attendues });
    assert.deepEqual(noms(releve), [...DU_BANC, ...GARDES]);
  });

  test('l’ordre des mesures est celui du registre reçu : un registre renversé les renverse, les gardes restant après', () => {
    const renverse = [...CONSTANTES].reverse();
    const releve = assembler({ configuration: configuration(), sorties: sorties(), attendues: ATTENDUES, constantes: renverse });
    assert.deepEqual(noms(releve), [...[...DU_BANC].reverse(), ...GARDES]);
  });

  test('chaque mesure porte le ralentissement sous lequel elle s’est prise : le sien, sinon celui de la configuration de sa sortie', () => {
    const recues = sorties();
    const releve = assembler({ configuration: configuration(), sorties: recues, attendues: ATTENDUES });
    assert.deepEqual(
      releve.mesures.map(({ nom, ralentissementCpu }) => [nom, ralentissementCpu]),
      [
        ['SEUIL_SIEGES_LISIBLES', 1],
        ['TOLERANCE_CHAINE_TEMOIN', 1],
        ['RALENTISSEMENT_PLEINE_CHARGE', 1],
        ['SEUIL_MATRICE_PARTICIPANTS', 1],
        ['LARGEUR_TRONCATURE_NOM_PX', 1],
        ['DUREE_GENERATION_PAR_DEFAUT', 1],
        ['TEMPS_IMAGE_LISTES', 4],
      ],
    );
    assert.equal(releve.configuration.ralentissementCpu, 4);
    assert.ok(!Object.hasOwn(recues.get('parallele').mesures[0], 'ralentissementCpu'), 'les sorties reçues restent intactes');
    const sansConfiguration = sorties();
    delete sansConfiguration.get('parallele').configuration;
    const autre = assembler({ configuration: configuration(), sorties: sansConfiguration, attendues: ATTENDUES });
    assert.ok(!Object.hasOwn(autre.mesures[2], 'ralentissementCpu'));
  });

  test('une sortie manquante se refuse en nommant chaque mesure qu’elle portait', () => {
    const manque = sorties();
    manque.delete('parallele');
    assert.throws(
      () => assembler({ configuration: configuration(), sorties: manque, attendues: ATTENDUES }),
      /mesure attendue absente : RALENTISSEMENT_PLEINE_CHARGE, DUREE_GENERATION_PAR_DEFAUT/,
    );
    const vide = new Map();
    assert.throws(() => assembler({ configuration: configuration(), sorties: vide, attendues: ATTENDUES }), /absente : SEUIL_SIEGES_LISIBLES/);
  });

  test('une mesure en double, une mesure inattendue, un champ de sommet deux fois porté se refusent', () => {
    const double = sorties();
    double.set('autre', { mesures: [{ nom: 'SEUIL_SIEGES_LISIBLES', unite: 'places', valeurProposee: 3, critere: 'x' }] });
    assert.throws(() => assembler({ configuration: configuration(), sorties: double, attendues: ATTENDUES }), /en double : SEUIL_SIEGES_LISIBLES/);
    const inattendue = sorties();
    inattendue.set('autre', { mesures: [{ nom: 'TEMPS_INVENTE', unite: 'ms', valeurProposee: 1, critere: 'x' }] });
    assert.throws(() => assembler({ configuration: configuration(), sorties: inattendue, attendues: ATTENDUES }), /inattendue : TEMPS_INVENTE/);
    const deuxParalleles = sorties();
    deuxParalleles.set('autre', { parallele: [] });
    assert.throws(() => assembler({ configuration: configuration(), sorties: deuxParalleles, attendues: ATTENDUES }), /parallele : porté par deux sorties/);
  });

  test('un relevé que verifierReleve refuse ne s’assemble pas : la faute est nommée', () => {
    const fautive = sorties();
    fautive.get('temoin').mesures[0].critere = 'relevé sous /home/quenouille/banc';
    assert.throws(
      () => assembler({ configuration: configuration(), sorties: fautive, attendues: ATTENDUES }),
      /mesures\[1\]\.critere : chemin de compte/,
    );
  });

  test('des sorties qui ne sont pas une table se refusent', () => {
    assert.throws(() => assembler({ configuration: configuration(), sorties: {}, attendues: ATTENDUES }), TypeError);
  });
});

describe('lancer : la configuration ne nomme pas la machine (contrainte 27)', () => {
  test('ni le nom d’hôte, ni l’utilisateur, ni le dossier personnel, ni le modèle du processeur injectés n’y paraissent', () => {
    const texte = JSON.stringify(configuration());
    for (const nom of [HOTE_INVENTE, UTILISATEUR_INVENTE, DOSSIER_INVENTE, MODELE_INVENTE]) assert.ok(!texte.includes(nom), nom);
    const releve = assembler({ configuration: configuration(), sorties: sorties(), attendues: ATTENDUES });
    for (const nom of [HOTE_INVENTE, MODELE_INVENTE]) assert.ok(!JSON.stringify(releve).includes(nom), nom);
  });

  test('la liste fermée du contrat : cadre du projet banc, facteur, versions, processeurs logiques, ralenti ×4, police embarquée', () => {
    assert.deepEqual(configuration(), {
      cadre: projetBanc().provide.cadreBanc,
      facteurEchelle: 1,
      navigateur: 'Chromium 140.0',
      node: 'v26.10.0',
      processeursLogiques: 6,
      ralentissementCpu: 4,
      police: FAMILLE_EMBARQUEE,
    });
    assert.equal(FAMILLE_EMBARQUEE, 'Noto Sans');
  });
});

describe('lancer : le jugement qui rend la sortie non nulle', () => {
  const releve = () => assembler({ configuration: configuration(), sorties: sorties(), attendues: ATTENDUES });

  test('un relevé tenu sous la police embarquée : aucun motif', () => {
    assert.deepEqual(jugement(releve()), { bloquants: [], nonTenus: [] });
  });

  test('une mesure de texte sous une autre police, ou sans police nommée : motif bloquant', () => {
    const r = releve();
    r.mesures[0].police = 'DejaVu Sans';
    delete r.mesures[1].police;
    assert.deepEqual(jugement(r).bloquants, [
      'SEUIL_SIEGES_LISIBLES mesurée sous la police « DejaVu Sans », et non sous Noto Sans',
      'TOLERANCE_CHAINE_TEMOIN mesurée sous la police « inconnue », et non sous Noto Sans',
    ]);
  });

  test('les deux seuils de la page de qualité sont des mesures de texte : sans police nommée ou sous une autre, motif bloquant', () => {
    const r = releve();
    delete r.mesures.find(({ nom }) => nom === 'SEUIL_MATRICE_PARTICIPANTS').police;
    r.mesures.find(({ nom }) => nom === 'LARGEUR_TRONCATURE_NOM_PX').police = 'DejaVu Sans';
    assert.deepEqual(jugement(r).bloquants, [
      'SEUIL_MATRICE_PARTICIPANTS mesurée sous la police « inconnue », et non sous Noto Sans',
      'LARGEUR_TRONCATURE_NOM_PX mesurée sous la police « DejaVu Sans », et non sous Noto Sans',
    ]);
  });

  test('un verdict non tenu : motif non bloquant, qui nomme la mesure et son critère', () => {
    const r = releve();
    r.mesures.find(({ nom }) => nom === 'TEMPS_IMAGE_LISTES').verdict = 'nonTenu';
    assert.deepEqual(jugement(r), { bloquants: [], nonTenus: ['TEMPS_IMAGE_LISTES : verdict non tenu — p95 sous 33 ms'] });
  });
});

describe('lancer : la région des constantes (§ 19.8)', () => {
  test('autant de lignes que le registre, sous un en-tête et son séparateur', () => {
    const lignes = regionConstantes().split('\n');
    assert.equal(lignes.length, CONSTANTES.length + 2);
    CONSTANTES.forEach((c, i) => assert.ok(lignes[i + 2].startsWith(`| \`${c.nom}\` |`), c.nom));
  });

  test('elle lit le relevé reçu : la valeur proposée paraît', () => {
    const releve = assembler({ configuration: configuration(), sorties: sorties(), attendues: ATTENDUES });
    const ligne = regionConstantes({ releve }).split('\n').find((l) => l.startsWith('| `SEUIL_SIEGES_LISIBLES` |'));
    assert.match(ligne, /\| 17 places \|/);
  });

  test('chaque constante du banc cite le ralentissement de sa mesure : à ×1, « processeur non ralenti », jamais ×4', () => {
    const releve = assembler({ configuration: configuration(), sorties: sorties(), attendues: ATTENDUES });
    const lignes = regionConstantes({ releve }).split('\n');
    for (const nom of DU_BANC) {
      const ligne = lignes.find((l) => l.startsWith(`| \`${nom}\` |`));
      assert.match(ligne, /, processeur non ralenti, police Noto Sans \|$/, nom);
      assert.doesNotMatch(ligne, /ralenti ×4/, nom);
    }
  });
});

describe('lancer : executer, sur des effets factices', () => {
  // Un passage factice : chaque effet se note dans journal, dans l'ordre.
  // fichiers tient les sorties que le navigateur aurait écrites.
  function passage({ codeVitest = 0, fichiers = sorties(), plafond = sorties().get('plafond').plafondAPriori } = {}) {
    const journal = [];
    const ecrits = new Map();
    const lignes = [];
    const effets = {
      mesurerPlafond: () => {
        journal.push('plafond');
        return plafond;
      },
      lancerVitest: () => {
        journal.push('vitest');
        return codeVitest;
      },
      lireNavigateur: async () => 'Chromium 140.0',
      systeme: systemeInvente(),
      node: 'v26.10.0',
      effacer: (chemin) => journal.push(`effacer ${chemin}`),
      lire: (chemin) => {
        const nom = /^scripts\/banc\/sorties\/([a-z_]+)\.json$/.exec(chemin)?.[1];
        if (nom === undefined || !fichiers.has(nom)) throw Object.assign(new Error(`absent : ${chemin}`), { code: 'ENOENT' });
        return JSON.stringify(fichiers.get(nom));
      },
      ecrire: (chemin, texte) => ecrits.set(chemin, texte),
      sortie: (ligne) => lignes.push(ligne),
    };
    return { effets, journal, ecrits, lignes };
  }

  test('le déroulé : sorties effacées, mesures node, banc navigateur ; le relevé écrit, le tableau et les écarts imprimés ; code 0', async () => {
    const p = passage();
    assert.equal(await executer(p.effets), 0);
    assert.deepEqual(p.journal, [...SORTIES_NAVIGATEUR.map((nom) => `effacer scripts/banc/sorties/${nom}.json`), 'plafond', 'vitest']);
    assert.deepEqual([...p.ecrits.keys()], [CHEMIN_RELEVE]);
    const ecrit = p.ecrits.get(CHEMIN_RELEVE);
    assert.ok(ecrit.endsWith('}\n'));
    const releve = JSON.parse(ecrit);
    assert.deepEqual(verifierReleve(releve), []);
    assert.deepEqual(noms(releve), [...ATTENDUES]);
    const texte = p.lignes.join('\n');
    assert.ok(texte.includes(regionConstantes({ releve })));
    // Les valeurs du registre se lisent au registre : une adoption ne change
    // pas ce que l'épreuve éprouve.
    const registre = (nom) => CONSTANTES.find((c) => c.nom === nom).valeur;
    assert.ok(texte.includes(`SEUIL_SIEGES_LISIBLES : registre ${registre('SEUIL_SIEGES_LISIBLES')} places, relevé 17 places — à adopter`));
    assert.match(
      texte,
      /RALENTISSEMENT_PLEINE_CHARGE : registre 2 ×, relevé 2,5 × — relevé, non adopté : défaut de travail sous la machine de référence/,
    );
    assert.doesNotMatch(texte, /RALENTISSEMENT_PLEINE_CHARGE : .*à adopter/);
    // L'accord imprimé est celui du registre avec le relevé écrit : une
    // constante adoptée que ce relevé inventé contredit y est nommée.
    const ecarts = accordRegistre(CONSTANTES, releve);
    const accord = ecarts.length === 0
      ? 'Accord du registre avec le relevé : aucun écart.'
      : ['Accord du registre avec le relevé :', ...ecarts.map(({ nom, faute }) => `- ${nom} : ${faute}`)].join('\n');
    assert.ok(texte.includes(accord), accord);
  });

  test('une constante du banc relevée sans valeur ne se dit pas « à adopter » : rien à adopter', async () => {
    const fichiers = sorties();
    const qualite = fichiers.get('qualite');
    qualite.mesures = qualite.mesures.map((mesure) =>
      mesure.nom === 'SEUIL_MATRICE_PARTICIPANTS' ? { ...mesure, valeurProposee: null } : mesure,
    );
    const p = passage({ fichiers });
    await executer(p.effets);
    const ligne = p.lignes.find((texte) => texte.startsWith('- SEUIL_MATRICE_PARTICIPANTS : '));
    assert.notEqual(ligne, undefined);
    assert.match(ligne, /, relevé aucune valeur — rien à adopter$/);
    // Les autres constantes gardent leur suite : une valeur relevée reste
    // à adopter.
    assert.ok(p.lignes.some((texte) => /^- SEUIL_SIEGES_LISIBLES : .*relevé 17 places — à adopter$/.test(texte)));
  });

  test('une constante relevée sans adoption et sans valeur : rien à adopter prime sur « relevé, non adopté »', async () => {
    const fichiers = sorties();
    const parallele = fichiers.get('parallele');
    parallele.mesures = parallele.mesures.map((mesure) =>
      mesure.nom === 'RALENTISSEMENT_PLEINE_CHARGE' ? { ...mesure, valeurProposee: null } : mesure,
    );
    const p = passage({ fichiers });
    await executer(p.effets);
    const ligne = p.lignes.find((texte) => texte.startsWith('- RALENTISSEMENT_PLEINE_CHARGE : '));
    assert.notEqual(ligne, undefined);
    // Sans valeur relevée, rien n'est relevé : la suite ne le prétend pas.
    assert.match(ligne, /, relevé aucune valeur — rien à adopter$/);
    assert.doesNotMatch(ligne, /non adopté/);
  });

  test('une épreuve du banc tombée (un contrôle du harnais) : code 1, aucun relevé écrit', async () => {
    const p = passage({ codeVitest: 1 });
    assert.equal(await executer(p.effets), 1);
    assert.equal(p.ecrits.size, 0);
    assert.match(p.lignes.join('\n'), /épreuve du banc est tombée/);
  });

  test('une sortie manquante : code 1, aucun relevé écrit, la mesure nommée', async () => {
    const fichiers = sorties();
    fichiers.delete('temoin');
    const p = passage({ fichiers });
    assert.equal(await executer(p.effets), 1);
    assert.equal(p.ecrits.size, 0);
    assert.match(p.lignes.join('\n'), /absente : TOLERANCE_CHAINE_TEMOIN/);
  });

  test('un verdict non tenu : le relevé s’écrit, qui le porte, et le code vaut 1', async () => {
    const fichiers = sorties();
    fichiers.get('temps_image').mesures[0].verdict = 'nonTenu';
    const p = passage({ fichiers });
    assert.equal(await executer(p.effets), 1);
    assert.equal(JSON.parse(p.ecrits.get(CHEMIN_RELEVE)).mesures.find(({ nom }) => nom === 'TEMPS_IMAGE_LISTES').verdict, 'nonTenu');
    assert.match(p.lignes.join('\n'), /TEMPS_IMAGE_LISTES : verdict non tenu/);
  });

  test('une mesure de texte hors de la police embarquée : code 1, aucun relevé écrit', async () => {
    const fichiers = sorties();
    fichiers.get('temoin').mesures[0].police = 'DejaVu Sans';
    const p = passage({ fichiers });
    assert.equal(await executer(p.effets), 1);
    assert.equal(p.ecrits.size, 0);
    assert.match(p.lignes.join('\n'), /sous la police « DejaVu Sans »/);
  });
});

describe('lancer : le relevé committé', () => {
  test('il est conforme, et porte chaque mesure attendue dans l’ordre du registre', () => {
    assert.deepEqual(verifierReleve(releveCommite), []);
    assert.deepEqual(noms(releveCommite), [...ATTENDUES]);
    for (const champ of ['navigateur', 'node', 'processeursLogiques']) {
      assert.notEqual(releveCommite.configuration[champ] ?? null, null, champ);
    }
    assert.deepEqual(Object.keys(releveCommite.configuration), [
      'cadre',
      'facteurEchelle',
      'navigateur',
      'node',
      'processeursLogiques',
      'ralentissementCpu',
      'police',
    ]);
    for (const mesure of releveCommite.mesures) assert.ok(Number.isFinite(mesure.ralentissementCpu), mesure.nom);
  });
});
