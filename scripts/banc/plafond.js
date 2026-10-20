// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le relevé du coût du plafond a priori (§ 17, point 4, § 19.10), sous node :
// pour chaque configuration, la médiane de la durée de plafondsAPriori sur
// l'instance normalisée, et celle de diagnostiquer sur la configuration, qui
// rappelle le plafond a priori dans ses sondes. L'horloge est reçue en
// paramètre : le script lancé passe performance.now, les épreuves une
// horloge factice. Le relevé ne porte que la clé, la forme et les médianes :
// ni date, ni nom d'hôte, ni chemin, ni utilisateur.
//
// Lancé, il mesure les configurations du banc et imprime le relevé en JSON,
// les médianes arrondies à la microseconde :
//
//   node scripts/banc/plafond.js [répétitions]      (défaut : 21)
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { configurationPessimiste } from '../../test/fixtures/banc/pessimiste.js';
import { configurationDe } from '../../src/application/configuration.js';
import { LIVREES } from '../../src/demo/livrees.js';
import { normaliser } from '../../src/moteur/configuration.js';
import { diagnostiquer } from '../../src/moteur/diagnostic.js';
import { plafondsAPriori } from '../../src/moteur/plafond.js';
import { analyser } from '../../src/stockage/document.js';

// Les démonstrations livrées que le § 19.10 nomme : la grande et sa variante.
const DEMONSTRATIONS_MESUREES = ['grande', 'grande-sans-exception'];

// Le nombre de répétitions du script lancé : impair, la médiane est une
// durée mesurée.
const REPETITIONS_PAR_DEFAUT = 21;

/**
 * Médiane d'une liste de nombres : l'élément du milieu de la liste triée,
 * ou la moyenne des deux du milieu quand elle est de longueur paire. Ne
 * modifie pas la liste.
 *
 * @param {number[]} valeurs
 * @returns {number}
 * @throws {RangeError} sur une liste vide
 */
export function mediane(valeurs) {
  if (valeurs.length === 0) throw new RangeError('médiane d’une liste vide');
  const triees = [...valeurs].sort((a, b) => a - b);
  const milieu = Math.floor(triees.length / 2);
  return triees.length % 2 === 1 ? triees[milieu] : (triees[milieu - 1] + triees[milieu]) / 2;
}

// Les durées de repetitions appels de mesure, chacune la différence de deux
// lectures de maintenant, l'une juste avant l'appel, l'autre juste après.
function durees(mesure, maintenant, repetitions) {
  const relevees = [];
  for (let i = 0; i < repetitions; i += 1) {
    const debut = maintenant();
    mesure();
    relevees.push(maintenant() - debut);
  }
  return relevees;
}

// Refuse les options avant toute mesure, dans l'ordre : configurations,
// répétitions, horloge, puis chaque entrée.
function exigerOptions({ configurations, maintenant, repetitions }) {
  if (!Array.isArray(configurations)) throw new TypeError('configurations : une liste est attendue');
  if (configurations.length === 0) throw new RangeError('configurations : au moins une configuration');
  if (!Number.isInteger(repetitions) || repetitions < 1) {
    throw new RangeError(`repetitions : un entier ≥ 1 est attendu, reçu ${String(repetitions)}`);
  }
  if (typeof maintenant !== 'function') throw new TypeError('maintenant : une fonction est attendue');
  const vues = new Set();
  for (const { cle } of configurations) {
    if (typeof cle !== 'string' || cle === '') throw new TypeError('cle : une chaîne non vide est attendue');
    if (vues.has(cle)) throw new RangeError(`cle en double : ${cle}`);
    vues.add(cle);
  }
}

/**
 * Mesure le coût du plafond a priori sur chaque configuration, dans l'ordre
 * reçu. Pour chacune : normaliser, hors mesure ; un appel de chauffe de
 * plafondsAPriori et de diagnostiquer, hors mesure, sans lire l'horloge ;
 * puis repetitions appels mesurés de plafondsAPriori(instance), puis
 * repetitions de diagnostiquer(configuration). L'horloge se lit deux fois par
 * appel mesuré, et jamais ailleurs.
 *
 * @param {Object} options
 * @param {Array<{cle: string, configuration: import('../../src/moteur/types.js').Configuration}>} options.configurations
 *   au moins une ; des clés non vides et distinctes
 * @param {() => number} options.maintenant  l'horloge, en millisecondes
 * @param {number} options.repetitions  entier ≥ 1
 * @returns {Array<{cle: string, N: number, T: number, R: number, msPlafonds: number, msDiagnostic: number}>}
 *   N, T, R de l'instance normalisée ; les médianes des durées, en millisecondes
 * @throws {TypeError} configurations qui n'est pas une liste, maintenant qui
 *   n'est pas une fonction, une clé vide ou qui n'est pas une chaîne
 * @throws {RangeError} une liste vide, repetitions qui n'est pas un entier
 *   ≥ 1, une clé en double ; et ce que normaliser lève
 */
export function mesurerPlafondAPriori({ configurations, maintenant, repetitions }) {
  exigerOptions({ configurations, maintenant, repetitions });
  return configurations.map(({ cle, configuration }) => {
    const instance = normaliser(configuration);
    plafondsAPriori(instance);
    diagnostiquer(configuration);
    const plafonds = durees(() => plafondsAPriori(instance), maintenant, repetitions);
    const diagnostic = durees(() => diagnostiquer(configuration), maintenant, repetitions);
    return {
      cle,
      N: instance.N,
      T: instance.T,
      R: instance.R,
      msPlafonds: mediane(plafonds),
      msDiagnostic: mediane(diagnostic),
    };
  });
}

/**
 * Les configurations du banc, dans l'ordre du relevé : la grande
 * démonstration et sa variante, lues dans leur fichier livré (src/demo/
 * livrees.js) comme l'opérateur les ouvre, par configurationDe, animateurs
 * compris, puis la configuration pessimiste
 * (test/fixtures/banc/pessimiste.js). Des objets neufs à chaque appel.
 *
 * @returns {Array<{cle: string, configuration: import('../../src/moteur/types.js').Configuration}>}
 */
export function configurationsDuBanc() {
  const livrees = DEMONSTRATIONS_MESUREES.map((cle) => ({
    cle,
    configuration: configurationDe(analyser(LIVREES.find((livree) => livree.cle === cle).texte).charge),
  }));
  return [...livrees, { cle: 'pessimiste', configuration: configurationPessimiste() }];
}

// Le nombre de répétitions lu en argument, ou null s'il n'est pas un entier
// décimal ≥ 1.
function repetitionsLues(argument) {
  if (argument === undefined) return REPETITIONS_PAR_DEFAUT;
  if (!/^[1-9]\d*$/.test(argument)) return null;
  return Number(argument);
}

// Lance le relevé et l'imprime ; rend le code de sortie : 0, ou 2 sur un
// argument refusé, sans rien imprimer sur la sortie standard.
function executer(argumentsRecus) {
  const repetitions = repetitionsLues(argumentsRecus[0]);
  if (repetitions === null || argumentsRecus.length > 1) {
    process.stderr.write('usage : node scripts/banc/plafond.js [répétitions, entier ≥ 1]\n');
    return 2;
  }
  const releve = mesurerPlafondAPriori({
    configurations: configurationsDuBanc(),
    maintenant: () => performance.now(),
    repetitions,
  });
  const arrondi = (duree) => Math.round(duree * 1000) / 1000;
  const imprime = releve.map((entree) => ({
    ...entree,
    msPlafonds: arrondi(entree.msPlafonds),
    msDiagnostic: arrondi(entree.msDiagnostic),
  }));
  process.stdout.write(`${JSON.stringify(imprime, null, 2)}\n`);
  return 0;
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

if (estLanceDirectement()) process.exitCode = executer(process.argv.slice(2));
