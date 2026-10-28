// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'indicateur d'activité (§ 5.10, § 19.2) : la pastille « Traitement en
// cours… » que primitives/Activite.svelte montre pendant une opération
// longue — ouvrir un événement ou l'une de ses versions de secours, charger
// une démonstration, défaire, refaire, revenir à un instant, appliquer un
// import, la fin d'une génération, l'ouverture de la section de
// l'impression, la planche de badges, écrire ailleurs. Un geste ordinaire du
// plan n'y passe pas.
//
// Le travail long tourne sur le fil du rendu, en blocs synchrones entre
// deux attentes : aucun rappel ne part pendant un bloc, et ce que le DOM
// reçoit pendant le bloc ne se peint qu'à sa fin. L'indicateur se monte
// donc AVANT l'opération : suivre compte l'opération, publie l'activité,
// attend que l'image qui la porte soit peinte, puis seulement lance
// l'opération. Son apparition au bout d'une demi-seconde et la rotation de
// son signe sont des animations CSS d'opacité et de transformation, que le
// compositeur joue hors du fil principal, pendant le bloc même : ni
// minuterie, ni horloge de l'application, que les épreuves pilotent.
//
// Les opérations se comptent : deux opérations qui se chevauchent, ou l'une
// dans l'autre, ne montrent qu'une pastille, retirée à la fin de la
// dernière. Une opération qui échoue la retire aussi, et son erreur remonte
// telle quelle.
//
// L'attente d'image ne change pas l'ordre des appels à la séance : un appel
// fait pendant elle — un geste, un autre retour — n'atteint la file de la
// séance qu'après l'appel que l'opération fait en partant, comme si elle
// était partie au moment de son geste. Les appels qu'une opération fait en
// partant, eux, passent aussitôt. App donne aux composants la séance que
// seanceBarree enveloppe ; au repos, ses appels partent aussitôt, sans
// attente.
//
// La page n'a qu'un fil de rendu : un seul indicateur la sert, activite,
// que les composants atteignent par suivre, sans contexte. L'activité suit
// le contrat des magasins de Svelte : subscribe(fn) appelle fn(active) tout
// de suite, puis à chaque entrée dans l'activité et à chaque sortie.

/**
 * Attend une image peinte : la prochaine image peint ce que le DOM portait
 * avant l'appel et remet ses animations au compositeur, qui les joue dès
 * lors sans le fil principal ; le rappel de l'image d'après n'arrive qu'une
 * fois la première rendue, et un message posté pendant lui n'arrive qu'une
 * fois la seconde rendue aussi. Sans rendu — ni requestAnimationFrame ni
 * document, ou une page cachée, qui ne peint pas —, aucune image n'est à
 * attendre : la promesse se résout aussitôt. Une page qui se cache pendant
 * l'attente la résout aussi : une image qui ne viendrait qu'au retour de la
 * page ne retient pas l'opération.
 *
 * @returns {Promise<void>}
 */
export function imagePeinte() {
  const sansRendu = typeof globalThis.requestAnimationFrame !== 'function' || typeof document === 'undefined';
  if (sansRendu || document.visibilityState === 'hidden') return Promise.resolve();
  return new Promise((reprendre) => {
    let finie = false;
    const finir = () => {
      if (finie) return;
      finie = true;
      document.removeEventListener('visibilitychange', surVisibilite);
      reprendre();
    };
    const surVisibilite = () => {
      if (document.visibilityState === 'hidden') finir();
    };
    document.addEventListener('visibilitychange', surVisibilite);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        const canal = new MessageChannel();
        canal.port1.onmessage = () => {
          canal.port1.close();
          finir();
        };
        canal.port2.postMessage(null);
      }),
    );
  });
}

/**
 * Une activité : le compte des opérations suivies.
 *
 * @param {{attendreImage: () => Promise<void>}} dependances
 *        attendreImage : l'attente d'une image peinte — imagePeinte dans la
 *        page, une attente que l'épreuve tient sous node
 * @returns {{
 *   subscribe: (fn: (active: boolean) => void) => () => void,
 *   readonly active: boolean,
 *   entrer: () => {peinte: Promise<void>, sortir: () => void},
 *   suivre: <T>(operation: () => T|Promise<T>) => Promise<T>,
 *   apresLesDeparts: <T>(appel: () => T) => T|Promise<T>,
 * }}
 *   entrer compte une opération, publie vrai à la première, et rend
 *   l'image attendue et la sortie, qui décompte une fois quel que soit le
 *   nombre de ses appels et publie faux à la dernière ; suivre entre,
 *   attend l'image et le départ des opérations suivies avant elle, lance
 *   l'opération, sort à sa fin, et rend sa valeur ou son rejet — une levée
 *   synchrone de l'opération devient un rejet. apresLesDeparts fait appel
 *   aussitôt, et rend ce qu'il rend, quand aucune opération suivie n'attend
 *   son départ ou quand l'appel vient du départ même d'une opération ;
 *   sinon, il le fait une fois partie la dernière opération attendue, et
 *   rend la promesse de son résultat.
 */
export function creerActivite({ attendreImage }) {
  let ouvertes = 0;
  const abonnes = new Set();
  const publier = () => {
    for (const fn of [...abonnes]) fn(ouvertes > 0);
  };

  function entrer() {
    ouvertes += 1;
    if (ouvertes === 1) publier();
    let sortie = false;
    return {
      peinte: attendreImage(),
      sortir() {
        if (sortie) return;
        sortie = true;
        ouvertes -= 1;
        if (ouvertes === 0) publier();
      },
    };
  }

  // Le départ des opérations suivies : porte se résout quand la dernière
  // opération suivie a été appelée ; attendues compte celles qui ne l'ont
  // pas encore été, departs vaut plus de zéro pendant l'appel d'une
  // opération. Une porte ne se rejette jamais, et ne dépend que de l'image
  // et des portes d'avant, jamais de la fin d'une opération.
  let porte = Promise.resolve();
  let attendues = 0;
  let departs = 0;

  async function suivre(operation) {
    const entree = entrer();
    const avant = porte;
    let ouvrir;
    porte = new Promise((resoudre) => {
      ouvrir = resoudre;
    });
    attendues += 1;
    let partie = false;
    const partir = () => {
      if (partie) return;
      partie = true;
      attendues -= 1;
      ouvrir();
    };
    try {
      await Promise.all([entree.peinte, avant]);
      let resultat;
      departs += 1;
      try {
        resultat = operation();
      } finally {
        departs -= 1;
        partir();
      }
      return await resultat;
    } finally {
      partir();
      entree.sortir();
    }
  }

  function apresLesDeparts(appel) {
    if (attendues === 0 || departs > 0) return appel();
    return porte.then(appel);
  }

  return {
    subscribe(fn) {
      abonnes.add(fn);
      fn(ouvertes > 0);
      return () => {
        abonnes.delete(fn);
      };
    },
    get active() {
      return ouvertes > 0;
    },
    entrer,
    suivre,
    apresLesDeparts,
  };
}

/** L'activité de la page, sur ses images peintes. */
export const activite = creerActivite({ attendreImage: imagePeinte });

/**
 * Suit une opération longue sur l'activité de la page.
 *
 * @template T
 * @param {() => T|Promise<T>} operation
 * @returns {Promise<T>}
 */
export const suivre = (operation) => activite.suivre(operation);

/**
 * Les appels de la séance (src/application/seance.js) qui passent par sa
 * file, et attendre, qui attend la file : ceux que seanceBarree retient
 * pendant l'attente d'image d'une opération suivie.
 */
export const APPELS_EN_FILE = Object.freeze([
  'ouvrir',
  'ouvrirSecours',
  'creer',
  'fermer',
  'changerRacine',
  'passerEnEcriture',
  'reprendreVerrou',
  'passerEnLecture',
  'executer',
  'debloquer',
  'poserLogoParticipant',
  'retirerLogoParticipant',
  'lireLogoParticipant',
  'poserImageBadges',
  'defaire',
  'refaire',
  'revenir',
  'nommer',
  'ecrireAilleurs',
  'formeNommee',
  'preparerPlanche',
  'produirePlanche',
  'enregistrerPlancheSous',
  'produireListeBadges',
  'enregistrerListeBadgesSous',
  'ouvrirDossierEvenement',
  'attendre',
]);
const EN_FILE = new Set(APPELS_EN_FILE);

/**
 * La séance que voient les composants : chaque appel d'APPELS_EN_FILE passe
 * par suivie.apresLesDeparts, de sorte qu'il atteint la file de la séance
 * dans l'ordre des gestes, même pendant l'attente d'image d'une opération
 * suivie ; le reste — etat, subscribe, les accesseurs, les lectures
 * synchrones — se lit sur la séance même. La méthode appelée est celle que
 * la séance porte quand l'enveloppe la lit : une méthode remplacée sur la
 * séance l'est aussi pour l'enveloppe, et une méthode posée sur
 * l'enveloppe l'est sur la séance.
 *
 * @param {Object} seance   la séance de src/application/seance.js
 * @param {{apresLesDeparts: <T>(appel: () => T) => T|Promise<T>}} suivie
 * @returns {Object}
 */
export function seanceBarree(seance, suivie) {
  return new Proxy(seance, {
    get(cible, nom) {
      const valeur = Reflect.get(cible, nom, cible);
      if (!EN_FILE.has(nom) || typeof valeur !== 'function') return valeur;
      return (...args) => suivie.apresLesDeparts(() => valeur.apply(cible, args));
    },
  });
}

/**
 * La fin d'une génération suivie : le tri et l'enregistrement des
 * propositions, que le contrôleur fait sur le fil du rendu une fois le
 * résultat du travailleur reçu. L'exécuteur rendu est celui reçu, dont
 * chaque exécution garde ses membres, sauf resultat : le résultat du
 * travailleur ne se rend au contrôleur qu'une fois l'activité entrée et
 * son image peinte. Un résultat rejeté — annulation, échec — passe tel
 * quel, sans entrer. Pendant la recherche, la génération montre son propre
 * avancement, et l'indicateur n'est pas là. terminer retire l'activité
 * entrée, s'il y en a une : l'appelant l'appelle quand le contrôleur
 * publie la génération finie. fermer la retire de même, et aucune
 * activité n'entre plus : un résultat reçu ensuite passe tel quel.
 * L'appelant l'appelle quand il cesse d'écouter le contrôleur, au
 * démontage, pour qu'une recherche encore en cours ne laisse pas
 * l'indicateur à la page.
 *
 * @param {Object} executeur   l'Executeur de src/application/generation.js
 * @param {{entrer: () => {peinte: Promise<void>, sortir: () => void}}} suivie
 *        l'activité qui suit la fin
 * @returns {{executeur: Object, terminer: () => void, fermer: () => void}}
 */
export function suivreFinDeGeneration(executeur, suivie) {
  let entree = null;
  let fermee = false;
  const terminer = () => {
    entree?.sortir();
    entree = null;
  };
  return {
    executeur: {
      ...executeur,
      lancer(...args) {
        const execution = executeur.lancer(...args);
        const resultat = execution.resultat.then(async (propositions) => {
          terminer();
          if (fermee) return propositions;
          entree = suivie.entrer();
          await entree.peinte;
          return propositions;
        });
        return { ...execution, resultat };
      },
    },
    terminer,
    fermer() {
      fermee = true;
      terminer();
    },
  };
}
