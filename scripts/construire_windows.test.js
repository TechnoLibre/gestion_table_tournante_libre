// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le script de construction de l'exécutable Windows (§ 16, § 18.2, § 18.5) :
// ce qu'il refuse avant de construire, la commande qu'il passe au conteneur,
// le contrôle de fin de construction, et ce qu'il laisse quand la
// construction échoue ou qu'un signal l'interrompt.
//
// Chaque épreuve copie le script et les fichiers qu'il lit dans un arbre
// temporaire, et le lance avec, en tête du PATH, un podman et un npm
// factices. Ils consignent leurs arguments. podman écrit chaque nom de
// FAUX_PRODUIT, un par ligne, dans le dossier de l'hôte qu'il reçoit monté
// sur /project/dist-electron, comme electron-builder y écrirait
// l'exécutable ; il y écrit aussi, à chaque lancement, les deux exécutables
// qu'electron-builder pose toujours sous win-unpacked/, aux profondeurs 2
// et 3 ; puis il sort en FAUX_CODE ; sous FAUX_ATTENTE, il s'annonce sur
// sa sortie et attend une ligne sur son entrée avant d'écrire. npm écrit
// www/index.html, sauf sous FAUX_SANS_PAGE, puis sort en FAUX_CODE_NPM.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import {
  accessSync,
  appendFileSync,
  chmodSync,
  constants,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, test } from '../test/lanceur.js';
import { versionVoisine } from '../test/version_voisine.js';
import { deriver } from './version.js';

const RACINE = fileURLToPath(new URL('..', import.meta.url));
const VERSION = JSON.parse(readFileSync(join(RACINE, 'version.json'), 'utf8')).version;
const NOM = deriver(VERSION).nomFichier;
// Le livrable d'une autre version du même jour : il reste dans dist-electron/
// quoi que fasse la construction de la version courante.
const NOM_AUTRE_VERSION = deriver(versionVoisine(VERSION)).nomFichier;

// Délai d'un lancement du script. Il reste sous celui d'une épreuve de
// Vitest, 5 s, qui n'interrompt pas un appel synchrone : un script qui ne
// s'arrête pas fait échouer son épreuve en le disant, au lieu de figer la
// série. Le délai écoulé, le script reçoit KILL : il piège TERM et attend
// la fin de la commande en cours, si bien que TERM n'arrêterait pas un
// script dont un enfant ne finit pas.
const DELAI_MS = 4_000;

// Ce que le script lit, et ce que lit le contrôle de version qu'il lance.
const COPIES = [
  'version.json',
  'package.json',
  'package-lock.json',
  'CHANGELOG.md',
  'README.md',
  'capacitor.config.json',
  'electron-builder.config.cjs',
  'scripts/version.js',
  'scripts/construire_windows.sh',
  'src/version.genere.js',
  'src/main.js',
];

const LANCE = 'podman factice lancé';

const PODMAN_FACTICE = [
  '#!/usr/bin/env bash',
  'printf "%s\\0" "$@" > "$JOURNAL/podman"',
  'echo podman >> "$JOURNAL/ordre"',
  'for argument in "$@"; do',
  '  case "$argument" in',
  '    *:/project/dist-electron) sortie="${argument%:/project/dist-electron}" ;;',
  '  esac',
  'done',
  'if [[ -n "${FAUX_ATTENTE-}" ]]; then',
  `  echo '${LANCE}'`,
  '  read -r _',
  'fi',
  'mkdir -p "$sortie/win-unpacked/resources"',
  'printf MZ > "$sortie/win-unpacked/Gestion table tournante Libre.exe"',
  'printf MZ > "$sortie/win-unpacked/resources/elevate.exe"',
  'while IFS= read -r produit; do',
  '  [[ -z "$produit" ]] || printf MZ > "$sortie/$produit"',
  'done <<< "${FAUX_PRODUIT-}"',
  'exit "${FAUX_CODE:-0}"',
  '',
].join('\n');

const NPM_FACTICE = [
  '#!/usr/bin/env bash',
  'printf "%s\\0" "$@" > "$JOURNAL/npm"',
  'echo npm >> "$JOURNAL/ordre"',
  '[[ -n "${FAUX_SANS_PAGE-}" ]] || { mkdir -p www && echo "<!doctype html>" > www/index.html; }',
  'exit "${FAUX_CODE_NPM:-0}"',
  '',
].join('\n');

// node qui se consigne dans l'ordre des lancements, puis passe la main au
// vrai : sert là où le PATH est réduit à bin/.
const NODE_CONSIGNE = [
  '#!/usr/bin/env bash',
  'echo node >> "$JOURNAL/ordre"',
  `exec '${process.execPath}' "$@"`,
  '',
].join('\n');

// Outils que le script appelle, hors podman, npm et node. Un PATH réduit à
// bin/ en reçoit des liens : seul podman y manque.
const OUTILS = ['bash', 'dirname', 'find', 'mkdir', 'rm', 'wc', 'file'];

// La construction se fait sous Linux (§ 16) : le script emploie bash 4 et le
// find de GNU, que ni macOS ni Windows ne livrent. Ces épreuves ne se jouent
// pas ailleurs.
const HORS_LINUX = process.platform !== 'linux';

// Chemin d'un exécutable dans le PATH de l'épreuve, ou null.
function chercher(nom) {
  for (const dossier of (process.env.PATH ?? '').split(delimiter)) {
    try {
      accessSync(join(dossier, nom), constants.X_OK);
      return join(dossier, nom);
    } catch {
      // Absent de ce dossier : le suivant.
    }
  }
  return null;
}

const lireSiPresent = (chemin) => (existsSync(chemin) ? readFileSync(chemin, 'utf8') : '');

// Arguments consignés par un factice, ou null s'il n'a pas été lancé.
function argumentsDe(journal, factice) {
  const texte = lireSiPresent(join(journal, factice));
  return texte === '' ? null : texte.split('\0').slice(0, -1);
}

// Contenu de chaque fichier .exe au premier niveau de dist-electron/.
function executables(projet) {
  const sortie = join(projet, 'dist-electron');
  if (!existsSync(sortie)) return {};
  return Object.fromEntries(
    readdirSync(sortie)
      .filter((nom) => nom.endsWith('.exe'))
      .sort()
      .map((nom) => [nom, readFileSync(join(sortie, nom), 'utf8')]),
  );
}

// Un arbre neuf, prêt au lancement : le projet recopié, bin/ et ses
// factices, le journal, l'environnement du script. produit est un nom ou une
// liste de noms que podman écrit ; page: false et codeNpm règlent npm ;
// attente règle podman. sansPodman réduit le PATH à bin/, qui reçoit les
// OUTILS et NODE_CONSIGNE, sans podman. preparer reçoit la racine du projet.
function preparerArbre({ produit, code, codeNpm, page = true, attente = false, sansPodman = false, preparer } = {}) {
  const base = mkdtempSync(join(tmpdir(), 'construire-windows-'));
  const projet = join(base, 'projet');
  const bin = join(base, 'bin');
  const journal = join(base, 'journal');
  for (const chemin of COPIES) {
    mkdirSync(dirname(join(projet, chemin)), { recursive: true });
    copyFileSync(join(RACINE, chemin), join(projet, chemin));
  }
  mkdirSync(bin);
  mkdirSync(journal);
  const factices = sansPodman
    ? [['npm', NPM_FACTICE], ['node', NODE_CONSIGNE]]
    : [['podman', PODMAN_FACTICE], ['npm', NPM_FACTICE]];
  for (const [nom, contenu] of factices) {
    writeFileSync(join(bin, nom), contenu);
    chmodSync(join(bin, nom), 0o755);
  }
  if (sansPodman) {
    for (const nom of OUTILS) {
      const chemin = chercher(nom);
      if (chemin !== null) symlinkSync(chemin, join(bin, nom));
    }
  }
  preparer?.(projet);

  const environnement = {
    ...process.env,
    PATH: sansPodman ? bin : [bin, dirname(process.execPath), process.env.PATH].join(delimiter),
    JOURNAL: journal,
  };
  for (const cle of ['FAUX_PRODUIT', 'FAUX_CODE', 'FAUX_ATTENTE', 'FAUX_SANS_PAGE', 'FAUX_CODE_NPM']) {
    delete environnement[cle];
  }
  if (produit !== undefined) environnement.FAUX_PRODUIT = [produit].flat().join('\n');
  if (code !== undefined) environnement.FAUX_CODE = String(code);
  if (codeNpm !== undefined) environnement.FAUX_CODE_NPM = String(codeNpm);
  if (!page) environnement.FAUX_SANS_PAGE = '1';
  if (attente) environnement.FAUX_ATTENTE = '1';
  return { base, projet, journal, environnement, script: join(projet, 'scripts', 'construire_windows.sh') };
}

// Lance le script dans un arbre neuf, puis rend ce qu'il a imprimé, ce que
// les factices ont consigné et les exécutables de dist-electron/. Les
// paramètres sont ceux de preparerArbre, plus options, les arguments du
// script, et relever, appelé sur la racine du projet avant son retrait :
// son résultat est rendu sous « releve ».
function construire({ options = [], relever, ...parametres } = {}) {
  const arbre = preparerArbre(parametres);
  try {
    const resultat = spawnSync(arbre.script, options, {
      cwd: arbre.base,
      encoding: 'utf8',
      env: arbre.environnement,
      timeout: DELAI_MS,
      killSignal: 'SIGKILL',
    });
    assert.notEqual(
      resultat.error?.code,
      'ETIMEDOUT',
      `scripts/construire_windows.sh ne s'arrête pas en ${DELAI_MS} ms :\n${resultat.stderr}`,
    );
    return {
      statut: resultat.status,
      sortie: resultat.stdout,
      erreurs: `${resultat.error?.message ?? ''}${resultat.stderr}`,
      projet: arbre.projet,
      ordre: lireSiPresent(join(arbre.journal, 'ordre')).split('\n').filter(Boolean),
      npm: argumentsDe(arbre.journal, 'npm'),
      podman: argumentsDe(arbre.journal, 'podman'),
      executables: executables(arbre.projet),
      releve: relever?.(arbre.projet),
    };
  } finally {
    rmSync(arbre.base, { recursive: true, force: true });
  }
}

const ecrireExecutable = (contenu, nom = NOM) => (projet) => {
  mkdirSync(join(projet, 'dist-electron'), { recursive: true });
  writeFileSync(join(projet, 'dist-electron', nom), contenu);
};

// La configuration recopiée tape le nom du livrable : la ligne ajoutée
// remplace celui qu'elle tient de deriver.
const taperLeNom = (nom) => (projet) =>
  appendFileSync(join(projet, 'electron-builder.config.cjs'), `module.exports.artifactName = ${JSON.stringify(nom)};\n`);

// Une construction réussie, partagée par les épreuves qui la lisent.
let reussie;
const constructionReussie = () => (reussie ??= construire({ produit: NOM }));

describe('construction Windows : refus avant de construire', { skip: HORS_LINUX }, () => {
  test('une version sans section au changelog ne se construit pas (§ 16)', () => {
    const r = construire({
      preparer: (projet) =>
        writeFileSync(join(projet, 'CHANGELOG.md'), '# Changelog — Gestion table tournante Libre\n'),
    });
    assert.equal(r.statut, 1, r.erreurs);
    assert.match(r.erreurs, /^3\. CHANGELOG\.md/m);
    assert.match(r.erreurs, /Construction refusée/);
    assert.deepEqual(r.ordre, []);
  });

  test("un exécutable du même nom n'est pas écrasé (§ 18.2)", () => {
    const r = construire({ produit: NOM, preparer: ecrireExecutable('ancien') });
    assert.equal(r.statut, 1, r.erreurs);
    assert.ok(r.erreurs.includes(`dist-electron/${NOM}`), r.erreurs);
    assert.match(r.erreurs, /--reconstruire/);
    assert.deepEqual(r.ordre, []);
    assert.deepEqual(r.executables, { [NOM]: 'ancien' });
  });

  test('une option inconnue sort en 2 et rappelle l’usage', () => {
    const r = construire({ options: ['--forcer'] });
    assert.equal(r.statut, 2, r.erreurs);
    assert.match(r.erreurs, /usage .*--reconstruire/);
    assert.deepEqual(r.ordre, []);
  });

  test('sans podman dans le PATH, refuse avant le contrôle de version', () => {
    const r = construire({ sansPodman: true });
    assert.equal(r.statut, 1, r.erreurs);
    assert.match(r.erreurs, /podman introuvable/);
    assert.deepEqual(r.ordre, []);
  });

  test("une configuration d'electron-builder qui ne se charge pas arrête tout, avant la page", () => {
    const r = construire({
      preparer: (projet) =>
        writeFileSync(join(projet, 'electron-builder.config.cjs'), "throw new Error('configuration illisible');\n"),
    });
    assert.equal(r.statut, 1, r.erreurs);
    assert.match(r.erreurs, /electron-builder\.config\.cjs ne se charge pas/);
    assert.deepEqual(r.ordre, []);
  });

  test('une configuration qui nomme le livrable autrement que deriver depuis version.json arrête tout, avant la page (§ 18.2)', () => {
    // podman produirait le nom tapé : seul le nom calculé depuis version.json
    // distingue cette construction d'une construction conforme.
    const r = construire({ produit: NOM_AUTRE_VERSION, preparer: taperLeNom(NOM_AUTRE_VERSION) });
    assert.equal(r.statut, 1, r.erreurs);
    assert.ok(r.erreurs.includes(NOM_AUTRE_VERSION) && r.erreurs.includes(NOM), r.erreurs);
    assert.deepEqual(r.ordre, []);
    assert.deepEqual(r.executables, {});
  });

  test("--reconstruire n'efface rien quand la configuration nomme le livrable autrement : ni l'exécutable, ni le fichier qu'elle désigne", () => {
    const tape = '../version.json';
    const r = construire({
      options: ['--reconstruire'],
      preparer: (projet) => {
        ecrireExecutable('ancien')(projet);
        taperLeNom(tape)(projet);
      },
      relever: (projet) => existsSync(join(projet, 'version.json')),
    });
    assert.equal(r.statut, 1, r.erreurs);
    assert.ok(r.erreurs.includes(tape) && r.erreurs.includes(NOM), r.erreurs);
    assert.deepEqual(r.ordre, []);
    assert.deepEqual(r.executables, { [NOM]: 'ancien' });
    assert.equal(r.releve, true, 'version.json effacé');
  });
});

describe('construction Windows : la page', { skip: HORS_LINUX }, () => {
  test('une page qui ne se construit pas arrête tout, avant podman', () => {
    const r = construire({ produit: NOM, codeNpm: 1 });
    assert.equal(r.statut, 1, r.erreurs);
    assert.match(r.erreurs, /la construction de la page échoue/);
    assert.deepEqual(r.ordre, ['npm']);
    assert.deepEqual(r.executables, {});
  });

  test('une page absente après sa construction arrête tout, avant podman', () => {
    const r = construire({ produit: NOM, page: false });
    assert.equal(r.statut, 1, r.erreurs);
    assert.match(r.erreurs, /www\/index\.html manque/);
    assert.deepEqual(r.ordre, ['npm']);
    assert.deepEqual(r.executables, {});
  });
});

describe('construction Windows : la construction', { skip: HORS_LINUX }, () => {
  test("construit la page puis l'exécutable, et imprime son chemin, sa taille et son type", () => {
    const r = constructionReussie();
    assert.equal(r.statut, 0, r.erreurs);
    assert.deepEqual(r.ordre, ['npm', 'podman']);
    assert.deepEqual(r.npm, ['run', '--silent', 'build:livraison']);
    assert.deepEqual(r.executables, { [NOM]: 'MZ' });
    assert.ok(r.sortie.includes(join(r.projet, 'dist-electron', NOM)), r.sortie);
    assert.match(r.sortie, /^Taille +: 2 octets$/m);
    assert.match(r.sortie, /^Type +: \S/m);
  });

  test("le conteneur : image épinglée, projet en lecture seule, node_modules de l'hôte masqué, aucune variable de l'hôte, quel que soit containers.conf", () => {
    const { statut, erreurs, projet, podman } = constructionReussie();
    assert.equal(statut, 0, erreurs);
    assert.equal(podman[0], 'run');
    // Tout ce qui suit l'image est la commande du conteneur : les options de
    // podman la précèdent toutes.
    const image = podman.findIndex((a) => /^docker\.io\/electronuserland\/builder@sha256:[0-9a-f]{64}$/.test(a));
    assert.notEqual(image, -1, 'image non épinglée par empreinte');
    assert.deepEqual(podman.slice(image + 1, -1), ['bash', '-c']);
    const options = podman.slice(1, image);
    assert.ok(options.includes('--rm'));
    assert.ok(options.includes(`${projet}:/project:ro`), 'projet non monté en lecture seule');
    assert.ok(options.includes(`${projet}/dist-electron:/project/dist-electron`));
    assert.ok(
      options.some((a) => /^[\w.-]+:\/project\/node_modules$/.test(a)),
      'node_modules non masqué par un volume nommé',
    );
    // Aucune variable passée, et l'environnement de l'hôte refusé sur la ligne
    // de commande : un env_host = true de containers.conf le transmettrait
    // entier, BUILD_NUMBER compris.
    assert.deepEqual(options.filter((a) => a === '-e' || a.startsWith('--env')), ['--env-host=false']);
    const commande = podman.at(-1);
    assert.match(commande, /npm ci --ignore-scripts/);
    assert.match(
      commande,
      /electron-builder --win --publish never --config electron-builder\.config\.cjs/,
    );
  });

  test("accepte le livrable quand dist-electron/ garde celui d'une autre version et les exécutables de win-unpacked/", () => {
    const r = construire({ produit: NOM, preparer: ecrireExecutable('autre', NOM_AUTRE_VERSION) });
    assert.equal(r.statut, 0, r.erreurs);
    assert.deepEqual(r.executables, { [NOM]: 'MZ', [NOM_AUTRE_VERSION]: 'autre' });
  });

  test("--reconstruire remplace un exécutable du même nom", () => {
    const r = construire({ options: ['--reconstruire'], produit: NOM, preparer: ecrireExecutable('ancien') });
    assert.equal(r.statut, 0, r.erreurs);
    assert.deepEqual(r.executables, { [NOM]: 'MZ' });
  });
});

describe('construction Windows : contrôle de fin de construction (§ 18.5)', { skip: HORS_LINUX }, () => {
  test("refuse un exécutable dont le nom ne dérive pas de version.json", () => {
    const autre = 'Gestion table tournante Libre.exe';
    const r = construire({ produit: autre });
    assert.equal(r.statut, 1, r.sortie);
    assert.ok(r.erreurs.includes(autre) && r.erreurs.includes(NOM), r.erreurs);
    assert.doesNotMatch(r.sortie, /^Taille/m);
  });

  test("refuse quand aucun exécutable n'apparaît", () => {
    const r = construire();
    assert.equal(r.statut, 1, r.sortie);
    assert.match(r.erreurs, /aucun exécutable/);
  });

  test("un échec sous podman ne laisse aucun exécutable sous ce nom, même avec --reconstruire", () => {
    const r = construire({ options: ['--reconstruire'], code: 7, preparer: ecrireExecutable('ancien') });
    assert.equal(r.statut, 1, r.sortie);
    assert.match(r.erreurs, /podman.*7/);
    assert.deepEqual(r.executables, {});
  });

  test("un échec sous podman retire ce qu'electron-builder a déjà écrit sous ce nom, et rien d'autre", () => {
    const r = construire({ produit: NOM, code: 7, preparer: ecrireExecutable('autre', NOM_AUTRE_VERSION) });
    assert.equal(r.statut, 1, r.sortie);
    assert.match(r.erreurs, /podman.*7/);
    assert.ok(r.erreurs.includes(`dist-electron/${NOM} retiré`), r.erreurs);
    assert.deepEqual(r.executables, { [NOM_AUTRE_VERSION]: 'autre' });
  });

  test("deux exécutables apparus : refusé, et celui qui porte le nom attendu est retiré", () => {
    const autre = 'Gestion table tournante Libre.exe';
    const r = construire({ produit: [NOM, autre] });
    assert.equal(r.statut, 1, r.sortie);
    assert.ok(r.erreurs.includes(autre) && r.erreurs.includes(NOM), r.erreurs);
    assert.ok(r.erreurs.includes(`dist-electron/${NOM} retiré`), r.erreurs);
    assert.equal(r.executables[NOM], undefined, `dist-electron/${NOM} reste après un refus`);
    assert.doesNotMatch(r.sortie, /^Taille/m);
  });
});

describe('construction Windows : interruption', { skip: HORS_LINUX }, () => {
  // Le signal ne vise que le shell, comme un kill depuis un autre terminal.
  // podman écrit après l'avoir reçu, comme electron-builder qui achève son
  // travail : l'épreuve ne réagit qu'à des événements, l'annonce du podman
  // factice puis la fin du script, et le délai ne fait que les borner.
  for (const [signal, code] of [['SIGTERM', 143], ['SIGINT', 130]]) {
    test(`${signal} reçu pendant podman : le script attend sa fin, retire ce qu'il a écrit et sort en ${code}`, async () => {
      const arbre = preparerArbre({ produit: NOM, attente: true });
      const script = spawn(arbre.script, [], { cwd: arbre.base, env: arbre.environnement });
      script.stdin.on('error', () => {});
      let sortie = '';
      let erreurs = '';
      script.stderr.setEncoding('utf8').on('data', (morceau) => (erreurs += morceau));
      const lance = new Promise((resoudre) => {
        script.stdout.setEncoding('utf8').on('data', (morceau) => {
          sortie += morceau;
          if (sortie.includes(LANCE)) resoudre();
        });
      });
      const fin = once(script, 'close', { signal: AbortSignal.timeout(DELAI_MS) }).catch((erreur) => {
        throw new Error(`scripts/construire_windows.sh ne s'arrête pas en ${DELAI_MS} ms (${erreur.name})\n${erreurs}`);
      });
      fin.catch(() => {});
      try {
        await Promise.race([lance, fin]);
        assert.ok(sortie.includes(LANCE), `podman factice jamais lancé\n${erreurs}`);
        script.kill(signal);
        script.stdin.end('\n');
        const [statut, signalDeFin] = await fin;
        assert.deepEqual({ statut, signalDeFin }, { statut: code, signalDeFin: null }, erreurs);
        assert.ok(erreurs.includes(`dist-electron/${NOM} retiré`), erreurs);
        assert.deepEqual(executables(arbre.projet), {});
      } finally {
        script.stdin.destroy();
        script.kill('SIGKILL');
        rmSync(arbre.base, { recursive: true, force: true });
      }
    });
  }
});
