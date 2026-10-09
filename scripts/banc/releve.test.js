// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du relevé du banc (§ 19.10, § 14.1, § 19.8) : sa vérification,
// qui refuse un relevé vide, une machine nommée et une unité qui contredit
// le registre ; son accord avec le registre, qui ne juge que les constantes
// du banc déclarées mesurées ; le résumé de sa configuration ; le tableau
// des constantes qu'en tire la documentation. Les relevés d'épreuve sont
// inventés ; le relevé committé n'est lu que pour sa conformité.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CONSTANTES } from '../../src/geometrie/constantes.js';
import { accordRegistre, resumeConfiguration, tableauConstantes, verifierReleve } from './releve.js';
import releveCommite from './releve.json' with { type: 'json' };

// Une configuration de relevé complète, de valeurs inventées.
const configuration = () => ({
  cadre: { largeur: 1366, hauteur: 700 },
  facteurEchelle: 1,
  navigateur: 'Chromium 140.0',
  node: 'v26.10.0',
  processeursLogiques: 8,
  ralentissementCpu: 4,
  police: 'Noto Sans',
});

// Un relevé conforme : deux constantes du banc et une garde hors du
// registre, qui porte sa courbe et son verdict.
const releve = () => ({
  format: 1,
  configuration: configuration(),
  mesures: [
    { nom: 'SEUIL_SIEGES_LISIBLES', unite: 'places', valeurProposee: 18, critere: 'liste dans la hauteur du plan' },
    { nom: 'TOLERANCE_CHAINE_TEMOIN', unite: 'rapport', valeurProposee: 0.02, critere: "quart de l'écart au repli" },
    {
      nom: 'TEMPS_IMAGE',
      unite: 'ms',
      valeurProposee: null,
      critere: 'p95 sous 33 ms à tout k',
      courbe: [{ k: 0.2, p95Ms: 12.5 }, { k: 0.4, p95Ms: 11 }],
      verdict: 'tenu',
    },
  ],
  plafondAPriori: [{ cle: 'grande', N: 260, T: 33, R: 4, msPlafonds: 0.07, msDiagnostic: 0.9 }],
  parallele: [],
});

// Le registre réel en copie modifiable, ramené à l'état d'avant toute
// adoption : chaque constante en défaut de travail hors de l'exécution, et
// les valeurs que les épreuves lisent épinglées. Une adoption dans le
// registre ne change donc rien ici ; son accord avec le relevé committé est
// la garde de src/geometrie/constantes.test.js. avec(nom, champs) rend la
// copie où l'entrée nommée prend ces champs.
const ADOPTIONS_ANNULEES = { SEUIL_SIEGES_LISIBLES: 16, TOLERANCE_CHAINE_TEMOIN: 0.01, RALENTISSEMENT_PLEINE_CHARGE: 2 };
const registre = () =>
  CONSTANTES.map((entree) => ({
    ...entree,
    statut: entree.proprietaire === 'execution' ? 'mesuree' : 'defautDeTravail',
    ...(Object.hasOwn(ADOPTIONS_ANNULEES, entree.nom) ? { valeur: ADOPTIONS_ANNULEES[entree.nom] } : {}),
  }));
const avec = (nom, champs, liste = registre()) => liste.map((e) => (e.nom === nom ? { ...e, ...champs } : e));

const chemins = (fautes) => fautes.map(({ chemin }) => chemin);

describe('releve : verifierReleve (§ 19.10, § 14.2)', () => {
  test('un relevé conforme ne porte aucune faute, une garde hors du registre comprise', () => {
    assert.deepEqual(verifierReleve(releve()), []);
    const minimal = { format: 1, configuration: configuration(), mesures: [releve().mesures[0]] };
    assert.deepEqual(verifierReleve(minimal), []);
    const inconnue = { ...configuration(), navigateur: null, node: null, processeursLogiques: null, ralentissementCpu: null, police: null };
    assert.deepEqual(verifierReleve({ ...minimal, configuration: inconnue }), []);
  });

  test('un relevé sans mesure se refuse : un relevé vide ne prouve rien', () => {
    const fautes = verifierReleve({ ...releve(), mesures: [] });
    assert.deepEqual(chemins(fautes), ['mesures']);
    assert.match(fautes[0].faute, /aucune mesure/);
    for (const mesures of [undefined, null, {}, 'SEUIL_SIEGES_LISIBLES']) {
      const autre = verifierReleve({ ...releve(), mesures });
      assert.deepEqual(chemins(autre), ['mesures'], String(mesures));
      assert.match(autre[0].faute, /liste attendue/);
    }
  });

  test('une configuration qui porte un chemin de compte se refuse, sous Linux, macOS et Windows, à toute profondeur', () => {
    const r = releve();
    r.configuration.navigateur = '/home/exemple/.cache/navigateurs/chromium/chrome';
    r.configuration.police = 'C:\\Users\\Exemple\\AppData\\Local\\Fonts\\NotoSans-Regular.ttf';
    r.mesures[2].courbe[1].source = '/Users/exemple/banc/sortie.json';
    r.plafondAPriori[0].cle = 'grande sous /var/home/exemple';
    const fautes = verifierReleve(r);
    assert.deepEqual(chemins(fautes), [
      'configuration.navigateur',
      'configuration.police',
      'mesures[2].courbe[1].source',
      'plafondAPriori[0].cle',
    ]);
    for (const { faute } of fautes) assert.match(faute, /chemin de compte/);
  });

  test('les chemins voisins hors des comptes passent', () => {
    const r = releve();
    r.configuration.navigateur = '/opt/homebrew/chromium/chrome';
    r.configuration.police = '/usr/share/fonts/noto/NotoSans-Regular.ttf';
    r.mesures[0].critere = 'C:\\Program Files\\Chromium : liste dans la hauteur du plan';
    assert.deepEqual(verifierReleve(r), []);
  });

  test('un champ hote se refuse, dans la configuration, au sommet et dans une mesure ; tout champ hors de la configuration admise aussi', () => {
    const r = releve();
    r.configuration.hote = 'poste-exemple';
    r.configuration.systeme = 'linux';
    r.hote = 'poste-exemple';
    r.mesures[1].utilisateur = 'exemple';
    const fautes = verifierReleve(r);
    assert.deepEqual(chemins(fautes), ['configuration.systeme', 'configuration.hote', 'hote', 'mesures[1].utilisateur']);
    assert.match(fautes[0].faute, /hors de la configuration admise/);
    assert.match(fautes[1].faute, /ne nomme pas sa machine/);
    assert.match(fautes[2].faute, /ne nomme pas sa machine/);
    assert.match(fautes[3].faute, /ne nomme pas sa machine/);
    const sommet = verifierReleve({ ...releve(), source: 'banc' });
    assert.deepEqual(chemins(sommet), ['source']);
    assert.match(sommet[0].faute, /hors du format du relevé/);
  });

  test('une date se refuse : un relevé ne porte pas l’instant de sa prise', () => {
    const r = releve();
    r.mesures[0].critere = 'relevé le 1999-12-31';
    r.configuration.node = 'v26.10.0 (1999-12-31)';
    const fautes = verifierReleve(r);
    assert.deepEqual(chemins(fautes), ['configuration.node', 'mesures[0].critere']);
    for (const { faute } of fautes) assert.match(faute, /date/);
  });

  // Les formes d'un champ identifiant : la casse, le tiret bas et le tiret
  // ne changent rien ; l'hôte et son utilisateur se lisent au début ou au
  // milieu du nom, une date au début. Les valeurs sont inventées.
  for (const cle of [
    'Hostname',
    'host_name',
    'HOTE',
    'nom-hote',
    'machine',
    'nomMachine',
    'poste',
    'computerName',
    'USER',
    'user_name',
    'Utilisateur',
    'nomUtilisateur',
    'login',
    'compte',
    'dateReleve',
    'horodatage',
    'timestamp',
    'instant',
  ]) {
    test(`un champ ${cle} se refuse dans une mesure, ouverte par ailleurs`, () => {
      const r = releve();
      r.mesures[0][cle] = cle === 'horodatage' || cle === 'timestamp' ? 915148800000 : 'poste-exemple';
      const fautes = verifierReleve(r);
      assert.deepEqual(chemins(fautes), [`mesures[0].${cle}`]);
      assert.match(fautes[0].faute, /ne nomme pas sa machine/);
    });
  }

  test('les champs voisins qui ne nomment ni hôte, ni utilisateur, ni instant passent', () => {
    const r = releve();
    Object.assign(r.mesures[2].courbe[0], { compteur: 3, posterieur: true, update: 1, mandat: 'aucun' });
    r.plafondAPriori[0].postes = 2;
    assert.deepEqual(verifierReleve(r), []);
  });

  // Les formes d'une date dans un texte : AAAA-MM-JJ, AAAA.MM.JJ et
  // AAAA/MM/JJ, puis JJ/MM/AAAA et JJ.MM.AAAA, jour et mois sur un ou deux
  // chiffres. Les dates sont inventées.
  for (const date of ['1999.12.31', '1999/12/31', '31/12/1999', '31.12.1999', '12/31/1999', '1/2/1999']) {
    test(`une date écrite ${date} se refuse`, () => {
      const r = releve();
      r.mesures[0].critere = `relevé le ${date}`;
      const fautes = verifierReleve(r);
      assert.deepEqual(chemins(fautes), ['mesures[0].critere']);
      assert.match(fautes[0].faute, /date/);
    });
  }

  test('les versions, les rapports et le cadre ne se lisent pas comme des dates', () => {
    const r = releve();
    r.configuration.navigateur = 'Chromium 140.0.7339.80';
    r.configuration.node = 'v26.10.0';
    r.mesures[0].critere = 'liste dans la hauteur du plan, 1/2 de 1366 × 700, 33/16 ms';
    r.mesures[1].critere = 'écart 2024-13-40 hors calendrier, 1999-12.31 aux séparateurs mêlés';
    assert.deepEqual(verifierReleve(r), []);
  });

  test("une unité qui diffère du registre se refuse, et nomme l'une et l'autre", () => {
    const r = releve();
    r.mesures[0].unite = 'px';
    r.mesures[1].unite = 'ms';
    const fautes = verifierReleve(r);
    assert.deepEqual(fautes, [
      { chemin: 'mesures[0].unite', faute: 'unité « px », le registre dit « places »' },
      { chemin: 'mesures[1].unite', faute: 'unité « ms », le registre dit « rapport »' },
    ]);
    // Le registre se reçoit : la même unité contredit un autre registre.
    const autre = avec('SEUIL_SIEGES_LISIBLES', { unite: 'sièges' });
    assert.deepEqual(chemins(verifierReleve(releve(), autre)), ['mesures[0].unite']);
  });

  test('une constante que le banc ne relève pas, une mesure répétée et des champs de mesure mal formés se refusent', () => {
    const r = releve();
    r.mesures.push({ nom: 'K_LISTES', unite: 'px/cm', valeurProposee: 0.25, critere: 'temps par image' });
    r.mesures.push({ ...r.mesures[0] });
    r.mesures.push({ nom: '', unite: '', valeurProposee: Number.NaN, critere: '', courbe: {}, verdict: 'oui' });
    r.mesures.push(null);
    const fautes = verifierReleve(r);
    assert.deepEqual(fautes, [
      { chemin: 'mesures[3].nom', faute: 'constante de propriétaire manuel : le banc ne la relève pas' },
      { chemin: 'mesures[4].nom', faute: 'mesure déjà relevée plus haut' },
      { chemin: 'mesures[5].nom', faute: 'nom non vide attendu' },
      { chemin: 'mesures[5].unite', faute: 'unité non vide attendue' },
      { chemin: 'mesures[5].valeurProposee', faute: 'nombre fini ou null attendu' },
      { chemin: 'mesures[5].critere', faute: 'critère non vide attendu' },
      { chemin: 'mesures[5].courbe', faute: 'liste attendue' },
      { chemin: 'mesures[5].verdict', faute: '« tenu » ou « nonTenu » attendu' },
      { chemin: 'mesures[6]', faute: 'objet attendu' },
    ]);
  });

  test('le format, la configuration et ses champs se vérifient un à un', () => {
    assert.deepEqual(chemins(verifierReleve({ ...releve(), format: 2 })), ['format']);
    assert.deepEqual(chemins(verifierReleve({ ...releve(), configuration: undefined })), ['configuration']);
    const r = releve();
    r.configuration.cadre = { largeur: 1366.5, hauteur: 700 };
    r.configuration.facteurEchelle = 0;
    r.configuration.navigateur = '';
    r.configuration.processeursLogiques = 2.5;
    r.configuration.ralentissementCpu = 0.5;
    delete r.configuration.police;
    r.plafondAPriori = {};
    r.parallele = 'aucun';
    assert.deepEqual(chemins(verifierReleve(r)), [
      'configuration.cadre',
      'configuration.facteurEchelle',
      'configuration.navigateur',
      'configuration.processeursLogiques',
      'configuration.ralentissementCpu',
      'configuration.police',
      'plafondAPriori',
      'parallele',
    ]);
    const cadre = releve();
    cadre.configuration.cadre = { largeur: 1366, hauteur: 700, x: 0 };
    assert.deepEqual(chemins(verifierReleve(cadre)), ['configuration.cadre']);
    assert.deepEqual(chemins(verifierReleve(null)), ['']);
  });

  test('le relevé committé porte la configuration du banc, ne nomme pas la machine, et ne se refuse que faute de mesure', () => {
    const attendues = Array.isArray(releveCommite.mesures) && releveCommite.mesures.length === 0 ? ['mesures'] : [];
    assert.deepEqual(chemins(verifierReleve(releveCommite)), attendues);
    assert.deepEqual(releveCommite.configuration.cadre, { largeur: 1366, hauteur: 700 });
    assert.equal(releveCommite.configuration.facteurEchelle, 1);
  });
});

describe('releve : accordRegistre (§ 19.10, § 14.1)', () => {
  test('un registre sans constante du banc mesurée s’accorde avec tout relevé', () => {
    assert.ok(registre().some((c) => c.proprietaire === 'banc'));
    assert.deepEqual(accordRegistre(registre(), releve()), []);
    assert.deepEqual(accordRegistre(registre(), { ...releve(), mesures: [] }), []);
  });

  test('une constante du banc mesurée dont le relevé propose une autre valeur : valeur', () => {
    const cite = `banc de mesure, ${resumeConfiguration(configuration())}`;
    const registre = avec('SEUIL_SIEGES_LISIBLES', { statut: 'mesuree', valeur: 16, configuration: cite });
    assert.deepEqual(accordRegistre(registre, releve()), [{ nom: 'SEUIL_SIEGES_LISIBLES', faute: 'valeur' }]);
    const adoptee = avec('SEUIL_SIEGES_LISIBLES', { statut: 'mesuree', valeur: 18, configuration: cite });
    assert.deepEqual(accordRegistre(adoptee, releve()), []);
  });

  test('une constante du banc mesurée que le relevé ne porte pas, ou dont il ne propose rien : absente', () => {
    const cite = resumeConfiguration(configuration());
    const registre = avec('RALENTISSEMENT_PLEINE_CHARGE', { statut: 'mesuree', configuration: cite });
    assert.deepEqual(accordRegistre(registre, releve()), [{ nom: 'RALENTISSEMENT_PLEINE_CHARGE', faute: 'absente' }]);
    const r = releve();
    r.mesures[0].valeurProposee = null;
    const seuil = avec('SEUIL_SIEGES_LISIBLES', { statut: 'mesuree', valeur: 18, configuration: cite });
    assert.deepEqual(accordRegistre(seuil, r), [{ nom: 'SEUIL_SIEGES_LISIBLES', faute: 'absente' }]);
    assert.deepEqual(accordRegistre(seuil, { ...releve(), mesures: [] }), [{ nom: 'SEUIL_SIEGES_LISIBLES', faute: 'absente' }]);
  });

  test('une constante du banc mesurée dont la configuration ne cite pas celle du relevé : configuration', () => {
    const registre = avec('TOLERANCE_CHAINE_TEMOIN', { statut: 'mesuree', valeur: 0.02 });
    assert.deepEqual(accordRegistre(registre, releve()), [{ nom: 'TOLERANCE_CHAINE_TEMOIN', faute: 'configuration' }]);
    const deux = avec('TOLERANCE_CHAINE_TEMOIN', { statut: 'mesuree', valeur: 0.03 });
    assert.deepEqual(accordRegistre(deux, releve()), [
      { nom: 'TOLERANCE_CHAINE_TEMOIN', faute: 'valeur' },
      { nom: 'TOLERANCE_CHAINE_TEMOIN', faute: 'configuration' },
    ]);
  });

  test('ni une constante défaut de travail, ni une constante mesurée hors du banc ne produisent de faute ; les fautes suivent le registre', () => {
    const r = releve();
    assert.deepEqual(accordRegistre(avec('SEUIL_SIEGES_LISIBLES', { valeur: 12 }), r), []);
    assert.deepEqual(accordRegistre(avec('K_LISTES', { statut: 'mesuree', valeur: 0.25 }), r), []);
    let registre = avec('RALENTISSEMENT_PLEINE_CHARGE', { statut: 'mesuree' });
    registre = avec('SEUIL_SIEGES_LISIBLES', { statut: 'mesuree' }, registre);
    assert.deepEqual(accordRegistre(registre, r), [
      { nom: 'SEUIL_SIEGES_LISIBLES', faute: 'valeur' },
      { nom: 'SEUIL_SIEGES_LISIBLES', faute: 'configuration' },
      { nom: 'RALENTISSEMENT_PLEINE_CHARGE', faute: 'absente' },
    ]);
  });
});

describe('releve : resumeConfiguration', () => {
  test('le résumé que le registre cite : cadre, facteur, navigateur, Node, processeurs, ralentissement, police', () => {
    assert.equal(
      resumeConfiguration(configuration()),
      'cadre de 1 366 × 700 px, facteur 1, Chromium 140.0, Node v26.10.0, 8 processeurs logiques, ' +
        'processeur ralenti ×4, police Noto Sans',
    );
  });

  test('un champ inconnu se dit inconnu ; un ralentissement de 1 est l’absence de ralentissement ; les décimales prennent la virgule', () => {
    const inconnue = { ...configuration(), navigateur: null, node: null, processeursLogiques: null, ralentissementCpu: null, police: null };
    assert.equal(
      resumeConfiguration(inconnue),
      'cadre de 1 366 × 700 px, facteur 1, navigateur inconnu, Node inconnu, processeurs logiques inconnus, ' +
        'ralentissement inconnu, police inconnue',
    );
    const autre = { ...configuration(), cadre: { largeur: 800, hauteur: 600 }, facteurEchelle: 1.25, ralentissementCpu: 1, processeursLogiques: 1 };
    assert.match(resumeConfiguration(autre), /^cadre de 800 × 600 px, facteur 1,25, .*, 1 processeur logique, processeur non ralenti, /);
  });

  test("le résumé ne dépend pas de l'ordre des champs, et refuse ce qui n'est pas une configuration", () => {
    const { police, cadre, ...reste } = configuration();
    assert.equal(resumeConfiguration({ police, ...reste, cadre }), resumeConfiguration(configuration()));
    assert.throws(() => resumeConfiguration(null), TypeError);
  });
});

describe('releve : tableauConstantes (§ 19.8, § 19.10)', () => {
  // Les cellules d'une ligne de tableau Markdown, sans les barres de bord ;
  // une barre précédée d'une barre oblique inverse appartient à la cellule.
  const cellules = (ligne) => ligne.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim());
  const liste = registre();

  test('une ligne par constante du registre, sous un en-tête et son séparateur', () => {
    const lignes = tableauConstantes(liste, releve()).split('\n');
    assert.ok(liste.length > 0);
    assert.equal(lignes.length, liste.length + 2);
    const entete = cellules(lignes[0]);
    assert.deepEqual(entete, [
      'Constante',
      'Ce qu’elle mesure',
      'Valeur',
      'Statut',
      'Propriétaire',
      'Protocole',
      'Valeur proposée par le banc',
      'Configuration du relevé',
    ]);
    assert.ok(cellules(lignes[1]).every((c) => /^-{3,}$/.test(c)));
    liste.forEach((c, i) => {
      const ligne = cellules(lignes[i + 2]);
      assert.equal(ligne.length, entete.length, c.nom);
      assert.equal(ligne[0], `\`${c.nom}\``);
      assert.equal(ligne[1], c.mesure);
      assert.equal(ligne[5], c.protocole);
    });
  });

  test('« défaut de travail » en toutes lettres, la valeur proposée à côté de celle du registre', () => {
    const lignes = tableauConstantes(liste, releve()).split('\n').slice(2).map(cellules);
    const ligne = (nom) => lignes.find((l) => l[0] === `\`${nom}\``);
    const defauts = liste.filter((c) => c.statut === 'defautDeTravail').length;
    assert.ok(defauts > 0);
    assert.equal(lignes.filter((l) => l[3] === 'défaut de travail').length, defauts);
    assert.deepEqual(ligne('SEUIL_SIEGES_LISIBLES').slice(2, 7).filter((_, i) => i !== 3), ['16 places', 'défaut de travail', 'banc', '18 places']);
    assert.equal(ligne('TOLERANCE_CHAINE_TEMOIN')[2], '0,01 rapport');
    assert.equal(ligne('TOLERANCE_CHAINE_TEMOIN')[6], '0,02 rapport');
    assert.equal(ligne('RALENTISSEMENT_PLEINE_CHARGE')[6], 'non relevée');
    assert.equal(ligne('K_LISTES')[6], '—');
    assert.deepEqual(ligne('HAUTEUR_LIGNE').slice(2, 5), ['relevée à l’exécution', 'mesurée', 'exécution']);
  });

  test('chaque ligne porte la configuration : celle du relevé pour le banc, celle du registre ailleurs', () => {
    const resume = resumeConfiguration(configuration());
    const lignes = tableauConstantes(liste, releve()).split('\n').slice(2).map(cellules);
    const banc = liste.filter((c) => c.proprietaire === 'banc').length;
    assert.ok(banc > 0);
    assert.equal(lignes.filter((l) => l[7] === resume).length, banc);
    liste.forEach((c, i) => {
      assert.equal(lignes[i][7], c.proprietaire === 'banc' ? resume : c.configuration, c.nom);
      assert.ok(lignes[i][7].length > 0, c.nom);
    });
  });

  test('une barre verticale ou un saut de ligne dans un texte ne cassent pas le tableau ; un registre vide se refuse', () => {
    const registre = avec('K_LISTES', { mesure: 'échelle | zoom\nde la vue' });
    const rang = registre.findIndex((c) => c.nom === 'K_LISTES');
    const ligne = tableauConstantes(registre, releve()).split('\n')[2 + rang];
    assert.equal(cellules(ligne)[1], 'échelle \\| zoom de la vue');
    assert.throws(() => tableauConstantes([], releve()), RangeError);
  });
});
