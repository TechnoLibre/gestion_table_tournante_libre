// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Rapporteur des durées de Vitest, déclaré dans vitest.config.js à côté du
// rapporteur par défaut (§ 14.14). À la fin de chaque exécution, en série
// simple comme à chaque relance sous surveillance, il imprime la durée
// totale, la durée au mur de chaque projet et les dix épreuves les plus
// lentes. Un projet qui dépasse son plafond fait sortir le lanceur en code 1,
// et l'erreur le nomme.
//
// La durée d'un projet est celle de l'exécution, au mur, moins le temps où
// seuls d'autres projets ont un fichier en cours. Un fichier est en cours du
// moment où un processus de Vitest le prend (onTestModuleQueued) à celui où
// sa dernière épreuve finit (onTestModuleEnd) ; le démarrage du processus
// qui le prend, avant, n'est en cours pour aucun projet, et compte donc à
// chacun. Un projet qui tourne seul dure ainsi toute l'exécution, comme la
// durée qu'affiche Vitest ; avec d'autres, le temps où il attend un
// processus occupé ailleurs ne lui est pas compté, si bien que son plafond
// ne dépend pas des projets lancés avec lui. Un fichier que le rapporteur
// n'a pas vu prendre rend la durée de son projet inconnue, et un projet à
// plafond refuse alors au lieu de passer sans mesure (§ 14.2). Une exécution
// interrompue imprime son bilan sans rien refuser : ses durées sont
// partielles. Le bilan finit sur le mode que la machine a fait retenir
// (test/machine.js) : un développeur sait ainsi sur quelle série sa relance a
// porté.
import { coeursDisponibles, ligneMachine, reglagesSeries } from './machine.js';

// Plafond au mur de chaque projet, en millisecondes, par nom d'exécution du
// projet : celui de vitest.config.js, que Vitest fait suivre du navigateur
// entre parenthèses pour un projet navigateur. Le refus est généreux
// (§ 14.14) : un plafond calé sur la mesure échouerait sur une machine
// chargée, et un test capricieux se désactive.
export const PLAFONDS = new Map([
  // La série node surveillée : trente secondes (§ 14.14). Seule, elle dure
  // 1,8 s au mur sur 16 cœurs et 3,7 s sur 2, où elle se joue en threads
  // (test/machine.js).
  ['node', 30_000],
  // Posé sur la mesure de node-long : seule, 17 s au mur sur 16 cœurs et
  // 28 s sur un seul. Le plafond laisse un facteur 2,1 au cas le plus lent.
  ['node-long', 60_000],
]);

// Nombre d'épreuves que nomme le bilan, des plus lentes.
const PLUS_LENTES = 10;

// Durée en secondes, deux décimales, virgule décimale.
const secondes = (ms) => `${(ms / 1000).toFixed(2).replace('.', ',')} s`;

// Longueur, en millisecondes, de la réunion d'intervalles { debut, fin }
// donnés dans n'importe quel ordre.
export function dureeReunie(intervalles) {
  let total = 0;
  let finReunie = -Infinity;
  for (const { debut, fin } of [...intervalles].sort((a, b) => a.debut - b.debut)) {
    if (fin > finReunie) {
      total += fin - Math.max(debut, finReunie);
      finReunie = fin;
    }
  }
  return total;
}

// Les n épreuves les plus lentes parmi des { duree, projet, fichier, nom },
// de la plus lente à la plus rapide ; à durée égale, par fichier puis par
// nom, comparés par points de code.
export function plusLentes(epreuves, n) {
  const avant = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  return [...epreuves]
    .sort((a, b) => b.duree - a.duree || avant(a.fichier, b.fichier) || avant(a.nom, b.nom))
    .slice(0, n);
}

// Bilan d'une exécution : ses lignes et ses refus. duree est celle de
// l'exécution ; projets associe à chaque nom de projet { duree, nonSuivis },
// nonSuivis listant les fichiers dont la durée manque ; epreuves porte chaque
// épreuve exécutée, { duree, projet, fichier, nom }. Les projets s'impriment
// triés par nom. Un projet refuse quand sa durée dépasse son plafond, ou
// quand il a un plafond et un fichier non suivi.
export function bilan({ duree, projets, epreuves, plafonds = PLAFONDS }) {
  const lignes = [`Durée totale : ${secondes(duree)}`];
  const refus = [];
  for (const nom of [...projets.keys()].sort()) {
    const { duree: dureeProjet, nonSuivis } = projets.get(nom);
    const plafond = plafonds.get(nom);
    const mesure =
      nonSuivis.length === 0
        ? `${secondes(dureeProjet)} au mur`
        : `durée inconnue, ${nonSuivis.length} fichier${nonSuivis.length > 1 ? 's' : ''} non suivi${nonSuivis.length > 1 ? 's' : ''}`;
    lignes.push(`  ${nom} : ${mesure}${plafond === undefined ? '' : `, plafond ${secondes(plafond)}`}`);
    if (plafond === undefined) continue;
    if (nonSuivis.length > 0) {
      refus.push(
        `Le projet ${nom} a un plafond de ${secondes(plafond)}, et sa durée ne se mesure pas : ` +
          `le rapporteur n'a pas suivi ${nonSuivis.join(', ')} (§ 14.14).`,
      );
    } else if (dureeProjet > plafond) {
      refus.push(
        `Le projet ${nom} dure ${secondes(dureeProjet)} au mur, au-delà de son plafond de ${secondes(plafond)} (§ 14.14).`,
      );
    }
  }
  if (epreuves.length === 0) {
    lignes.push('Aucune épreuve exécutée.');
  } else {
    const lentes = plusLentes(epreuves, PLUS_LENTES);
    lignes.push(`Épreuves les plus lentes (${lentes.length} sur ${epreuves.length}) :`);
    for (const { duree: dureeEpreuve, projet, fichier, nom } of lentes) {
      lignes.push(`${String(Math.round(dureeEpreuve)).padStart(8)} ms  ${projet}  ${fichier} > ${nom}`);
    }
  }
  return { lignes, refus };
}

// Le rapporteur que Vitest construit, sans option ; une épreuve lui passe sa
// propre horloge, en millisecondes, et ses propres plafonds.
export default class Rapporteur {
  #horloge;
  #plafonds;
  #journal;
  #debut;
  // Intervalle { debut, fin } de chaque fichier pris pendant l'exécution
  // courante, par identifiant de fichier ; fin reste undefined jusqu'à la
  // fin du fichier.
  #intervalles = new Map();

  constructor({ horloge = () => performance.now(), plafonds = PLAFONDS } = {}) {
    this.#horloge = horloge;
    this.#plafonds = plafonds;
  }

  onInit(vitest) {
    this.#journal = vitest.logger;
  }

  onTestRunStart() {
    this.#debut = this.#horloge();
    this.#intervalles = new Map();
  }

  onTestModuleQueued(module) {
    this.#intervalles.set(module.id, { debut: this.#horloge(), fin: undefined });
  }

  onTestModuleEnd(module) {
    const intervalle = this.#intervalles.get(module.id);
    if (intervalle !== undefined) intervalle.fin = this.#horloge();
  }

  // Un fichier pris et jamais fini est en cours jusqu'à la fin de
  // l'exécution. Le temps où seuls d'autres projets ont un fichier en cours
  // vaut la réunion de tous les fichiers moins celle du projet : la durée
  // du projet est donc celle de l'exécution, moins la première, plus la
  // seconde.
  onTestRunEnd(modules, _erreurs, raison) {
    const fin = this.#horloge();
    const duree = fin - this.#debut;
    const parProjet = new Map();
    const tous = [];
    const epreuves = [];
    for (const module of modules) {
      const projet = module.project.name;
      if (!parProjet.has(projet)) parProjet.set(projet, { intervalles: [], nonSuivis: [] });
      const suivi = parProjet.get(projet);
      const intervalle = this.#intervalles.get(module.id);
      if (intervalle === undefined) {
        suivi.nonSuivis.push(module.relativeModuleId);
      } else {
        const enCours = { debut: intervalle.debut, fin: intervalle.fin ?? fin };
        suivi.intervalles.push(enCours);
        tous.push(enCours);
      }
      for (const epreuve of module.children.allTests()) {
        const diagnostic = epreuve.diagnostic();
        if (diagnostic !== undefined) {
          epreuves.push({ duree: diagnostic.duration, projet, fichier: module.relativeModuleId, nom: epreuve.fullName });
        }
      }
    }
    const horsDeTout = duree - dureeReunie(tous);
    const projets = new Map(
      [...parProjet].map(([projet, { intervalles, nonSuivis }]) => [
        projet,
        { duree: horsDeTout + dureeReunie(intervalles), nonSuivis },
      ]),
    );
    const { lignes, refus } = bilan({ duree, projets, epreuves, plafonds: this.#plafonds });
    for (const ligne of lignes) this.#journal.log(ligne);
    this.#journal.log(ligneMachine(reglagesSeries(coeursDisponibles())));
    if (raison === 'interrupted') return;
    for (const message of refus) this.#journal.error(message);
    if (refus.length > 0) process.exitCode = 1;
  }
}
