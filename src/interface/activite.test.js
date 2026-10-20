// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'indicateur d'activité (§ 5.10, § 19.2) : un compte des opérations
// suivies, publié en vrai ou faux ; l'opération ne part qu'une fois l'image
// attendue, et l'indicateur se retire à sa fin, réussie ou non. Une attente
// d'image d'épreuve tient chaque image : rien n'avance seul.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { APPELS_EN_FILE, creerActivite, imagePeinte, seanceBarree, suivreFinDeGeneration } from './activite.js';

// setImmediate rappelle une fois vidées les microtâches : une promesse
// résolue a rappelé ses suites.
const laisser = () => new Promise((resolve) => setImmediate(resolve));

// Une attente d'image d'épreuve : chaque attente se résout à peindre().
function creerImages() {
  const enAttente = [];
  return {
    attendre: () =>
      new Promise((reprendre) => {
        enAttente.push(reprendre);
      }),
    get demandes() {
      return enAttente.length;
    },
    peindre() {
      for (const reprendre of enAttente.splice(0)) reprendre();
    },
  };
}

// Une activité d'épreuve et la suite des états qu'elle publie.
function creer() {
  const images = creerImages();
  const activite = creerActivite({ attendreImage: images.attendre });
  const publies = [];
  activite.subscribe((active) => publies.push(active));
  return { images, activite, publies };
}

// Une opération que l'épreuve termine : elle note son départ, et rend la
// promesse que resoudre ou rejeter règle.
function operationTenue() {
  const suivi = { partie: false };
  let resoudre;
  let rejeter;
  const promesse = new Promise((ok, ko) => {
    resoudre = ok;
    rejeter = ko;
  });
  return {
    suivi,
    operation: () => {
      suivi.partie = true;
      return promesse;
    },
    resoudre: (valeur) => resoudre(valeur),
    rejeter: (erreur) => rejeter(erreur),
  };
}

describe('creerActivite : le compte des opérations suivies (§ 5.10)', () => {
  test('l’abonné reçoit faux tout de suite, vrai à l’entrée, faux à la sortie ; active le lit', async () => {
    const { images, activite, publies } = creer();
    assert.deepEqual(publies, [false]);
    assert.equal(activite.active, false);
    const tenue = operationTenue();
    const fin = activite.suivre(tenue.operation);
    assert.deepEqual(publies, [false, true]);
    assert.equal(activite.active, true);
    images.peindre();
    await laisser();
    tenue.resoudre('rendu');
    assert.equal(await fin, 'rendu');
    assert.deepEqual(publies, [false, true, false]);
    assert.equal(activite.active, false);
  });

  test('l’opération ne part qu’une fois l’image peinte, et l’indicateur est déjà publié', async () => {
    const { images, activite, publies } = creer();
    const tenue = operationTenue();
    const fin = activite.suivre(() => {
      assert.equal(activite.active, true);
      return tenue.operation();
    });
    await laisser();
    assert.equal(tenue.suivi.partie, false);
    assert.equal(images.demandes, 1);
    images.peindre();
    await laisser();
    assert.equal(tenue.suivi.partie, true);
    tenue.resoudre();
    await fin;
    assert.deepEqual(publies, [false, true, false]);
  });

  test('deux opérations qui se chevauchent : une seule entrée publiée, une seule sortie, à la fin de la dernière', async () => {
    const { images, activite, publies } = creer();
    const premiere = operationTenue();
    const seconde = operationTenue();
    const finPremiere = activite.suivre(premiere.operation);
    const finSeconde = activite.suivre(seconde.operation);
    images.peindre();
    await laisser();
    assert.equal(premiere.suivi.partie && seconde.suivi.partie, true);
    premiere.resoudre();
    await finPremiere;
    assert.deepEqual(publies, [false, true]);
    assert.equal(activite.active, true);
    seconde.resoudre();
    await finSeconde;
    assert.deepEqual(publies, [false, true, false]);
  });

  test('une opération imbriquée dans une autre ne retire pas l’indicateur en finissant', async () => {
    const { images, activite, publies } = creer();
    const interne = operationTenue();
    const fin = activite.suivre(async () => {
      const dedans = activite.suivre(interne.operation);
      images.peindre();
      await dedans;
      assert.equal(activite.active, true);
      return 'externe';
    });
    images.peindre();
    await laisser();
    interne.resoudre();
    assert.equal(await fin, 'externe');
    assert.deepEqual(publies, [false, true, false]);
  });

  test('un échec remonte tel quel et retire l’indicateur ; un rejet comme une levée synchrone', async () => {
    const { images, activite, publies } = creer();
    const tenue = operationTenue();
    const erreur = new Error('panne inventée');
    const fin = activite.suivre(tenue.operation);
    images.peindre();
    await laisser();
    tenue.rejeter(erreur);
    await assert.rejects(fin, (recue) => recue === erreur);
    assert.deepEqual(publies, [false, true, false]);
    const refus = { code: 'REFUS_INVENTE' };
    const leve = activite.suivre(() => {
      throw refus;
    });
    images.peindre();
    await assert.rejects(leve, (recu) => recu === refus);
    assert.deepEqual(publies, [false, true, false, true, false]);
    assert.equal(activite.active, false);
  });

  test('entrer rend l’image attendue et une sortie qu’un second appel ne compte pas deux fois', async () => {
    const { images, activite, publies } = creer();
    const a = activite.entrer();
    const b = activite.entrer();
    let peinte = false;
    a.peinte.then(() => {
      peinte = true;
    });
    await laisser();
    assert.equal(peinte, false);
    images.peindre();
    await laisser();
    assert.equal(peinte, true);
    a.sortir();
    a.sortir();
    assert.equal(activite.active, true);
    b.sortir();
    assert.deepEqual(publies, [false, true, false]);
  });

  test('un abonné retiré ne reçoit plus rien', () => {
    const { activite } = creer();
    const recus = [];
    const retirer = activite.subscribe((active) => recus.push(active));
    retirer();
    activite.entrer().sortir();
    assert.deepEqual(recus, [false]);
  });
});

describe('imagePeinte : l’attente d’une image (§ 19.2)', () => {
  test('sans rendu — ni requestAnimationFrame ni document —, aucune image n’est à attendre : la promesse se résout', async () => {
    assert.equal(typeof globalThis.requestAnimationFrame, 'undefined');
    let resolue = false;
    imagePeinte().then(() => {
      resolue = true;
    });
    await laisser();
    assert.equal(resolue, true);
  });
});

// Un exécuteur d'épreuve : chaque lancer rend une exécution que l'épreuve
// résout ou rejette, et garde ses arguments.
function executeurTenu() {
  const lances = [];
  return {
    coeursDisponibles: 3,
    lances,
    lancer(...args) {
      let resoudre;
      let rejeter;
      const resultat = new Promise((ok, ko) => {
        resoudre = ok;
        rejeter = ko;
      });
      const execution = { surAvancement: () => () => {}, resultat, annuler: () => {}, coeurs: 2 };
      lances.push({ args, execution, resoudre, rejeter });
      return execution;
    },
  };
}

describe('suivreFinDeGeneration : la fin d’une génération, après le travailleur (§ 5.10)', () => {
  test('le résultat du travailleur ne se rend qu’une fois l’indicateur entré et l’image peinte ; terminer le retire', async () => {
    const { images, activite, publies } = creer();
    const base = executeurTenu();
    const fin = suivreFinDeGeneration(base, activite);
    assert.equal(fin.executeur.coeursDisponibles, 3);
    const execution = fin.executeur.lancer('configuration', 'reglages', { coeurs: 2 });
    assert.deepEqual(base.lances[0].args, ['configuration', 'reglages', { coeurs: 2 }]);
    assert.equal(execution.surAvancement, base.lances[0].execution.surAvancement);
    assert.equal(execution.annuler, base.lances[0].execution.annuler);
    assert.equal(execution.coeurs, 2);
    let rendues = null;
    execution.resultat.then((propositions) => {
      rendues = propositions;
    });
    await laisser();
    assert.deepEqual(publies, [false]);
    const propositions = [{ id: 1 }];
    base.lances[0].resoudre(propositions);
    await laisser();
    assert.deepEqual(publies, [false, true]);
    assert.equal(rendues, null);
    images.peindre();
    await laisser();
    assert.equal(rendues, propositions);
    assert.equal(activite.active, true);
    fin.terminer();
    fin.terminer();
    assert.deepEqual(publies, [false, true, false]);
  });

  test('un résultat rejeté — annulation, échec — n’entre pas : le rejet passe tel quel', async () => {
    const { activite, publies } = creer();
    const base = executeurTenu();
    const fin = suivreFinDeGeneration(base, activite);
    const execution = fin.executeur.lancer();
    const erreur = new Error('annulée pour l’épreuve');
    base.lances[0].rejeter(erreur);
    await assert.rejects(execution.resultat, (recue) => recue === erreur);
    fin.terminer();
    assert.deepEqual(publies, [false]);
  });

  test('fermée pendant la recherche, la fin n’entre plus : le résultat arrivé après passe tel quel, et l’activité reste au repos', async () => {
    const { activite, publies } = creer();
    const base = executeurTenu();
    const fin = suivreFinDeGeneration(base, activite);
    const execution = fin.executeur.lancer();
    fin.fermer();
    const propositions = [{ id: 1 }];
    base.lances[0].resoudre(propositions);
    assert.equal(await execution.resultat, propositions);
    assert.equal(activite.active, false);
    assert.deepEqual(publies, [false]);
  });

  test('fermée pendant l’attente d’image, la fin retire l’activité entrée', async () => {
    const { images, activite, publies } = creer();
    const base = executeurTenu();
    const fin = suivreFinDeGeneration(base, activite);
    const execution = fin.executeur.lancer();
    base.lances[0].resoudre([]);
    await laisser();
    assert.equal(activite.active, true);
    fin.fermer();
    assert.equal(activite.active, false);
    images.peindre();
    await execution.resultat;
    assert.equal(activite.active, false);
    assert.deepEqual(publies, [false, true, false]);
  });
});

// Une séance d'épreuve : chaque appel de la file note son nom et ses
// arguments dans appels, dans l'ordre où il atteint la séance, et rend une
// promesse résolue de son nom ; etat et mode se lisent.
function seanceTenue() {
  const appels = [];
  const seance = {
    appels,
    get mode() {
      return 'ecriture';
    },
    etat: () => ({ mode: 'ecriture' }),
    subscribe(fn) {
      fn({ mode: 'ecriture' });
      return () => {};
    },
  };
  for (const nom of APPELS_EN_FILE) {
    seance[nom] = (...args) => {
      appels.push([nom, ...args]);
      return Promise.resolve(nom);
    };
  }
  return seance;
}

describe('seanceBarree : l’ordre des appels à la séance autour d’une opération suivie (§ 5.10)', () => {
  test('au repos, un appel de la file atteint la séance aussitôt et rend ce qu’elle rend ; une méthode remplacée après coup est celle appelée', () => {
    const { activite } = creer();
    const seance = seanceTenue();
    const barree = seanceBarree(seance, activite);
    const rendue = Promise.resolve('propre');
    seance.executer = (...args) => {
      seance.appels.push(['remplacee', ...args]);
      return rendue;
    };
    assert.equal(barree.executer('ajouterParticipant', { nom: 'Quillard', prenom: 'Ombeline' }), rendue);
    assert.deepEqual(seance.appels, [['remplacee', 'ajouterParticipant', { nom: 'Quillard', prenom: 'Ombeline' }]]);
  });

  test('un appel fait pendant l’attente d’image d’une opération suivie n’atteint la séance qu’après l’appel de l’opération', async () => {
    const { images, activite } = creer();
    const seance = seanceTenue();
    const barree = seanceBarree(seance, activite);
    const retour = activite.suivre(() => barree.defaire({ touche: 'Ctrl+Z' }));
    const geste = barree.executer('creerTable', { forme: 'ronde' });
    await laisser();
    assert.deepEqual(seance.appels, []);
    images.peindre();
    assert.equal(await geste, 'executer');
    assert.equal(await retour, 'defaire');
    assert.deepEqual(seance.appels, [['defaire', { touche: 'Ctrl+Z' }], ['executer', 'creerTable', { forme: 'ronde' }]]);
  });

  test('deux opérations suivies et deux gestes entremêlés atteignent la séance dans l’ordre où ils sont faits', async () => {
    const { images, activite } = creer();
    const seance = seanceTenue();
    const barree = seanceBarree(seance, activite);
    const fins = [
      activite.suivre(() => barree.defaire({ rang: 1 })),
      barree.executer('premier'),
      activite.suivre(() => barree.revenir(7)),
      barree.attendre(),
    ];
    for (let image = 0; image < 3; image += 1) {
      images.peindre();
      await laisser();
    }
    await Promise.all(fins);
    assert.deepEqual(seance.appels, [['defaire', { rang: 1 }], ['executer', 'premier'], ['revenir', 7], ['attendre']]);
  });

  test('une fois l’opération partie, les appels passent aussitôt, même avant sa fin', async () => {
    const { images, activite } = creer();
    const seance = seanceTenue();
    const barree = seanceBarree(seance, activite);
    const tenue = operationTenue();
    const fin = activite.suivre(tenue.operation);
    images.peindre();
    await laisser();
    assert.equal(tenue.suivi.partie, true);
    barree.executer('pendant');
    assert.deepEqual(seance.appels, [['executer', 'pendant']]);
    tenue.resoudre();
    await fin;
  });

  test('une opération qui échoue en partant laisse passer les appels qui l’attendaient', async () => {
    const { images, activite } = creer();
    const seance = seanceTenue();
    const barree = seanceBarree(seance, activite);
    const erreur = new Error('panne inventée');
    const fin = activite.suivre(() => {
      throw erreur;
    });
    const geste = barree.executer('apres');
    images.peindre();
    await assert.rejects(fin, (recue) => recue === erreur);
    assert.equal(await geste, 'executer');
    assert.deepEqual(seance.appels, [['executer', 'apres']]);
  });

  test('les lectures ne sont pas barrées : etat, subscribe et les accesseurs répondent pendant l’attente', () => {
    const { activite } = creer();
    const seance = seanceTenue();
    const barree = seanceBarree(seance, activite);
    activite.suivre(() => undefined);
    assert.deepEqual(barree.etat(), { mode: 'ecriture' });
    assert.equal(barree.mode, 'ecriture');
    const recus = [];
    barree.subscribe((etat) => recus.push(etat.mode));
    assert.deepEqual(recus, ['ecriture']);
  });

  test('les appels barrés sont ceux que la séance met dans sa file, et attendre, qui attend la file', () => {
    const source = readFileSync(new URL('../application/seance.js', import.meta.url), 'utf8');
    const enFile = [...source.matchAll(/^ {4}(\w+): \([^)]*\) =>\s*enFile\(/gm)].map(([, nom]) => nom);
    assert.ok(enFile.length > 10, 'les méthodes en file de seance.js se relèvent');
    assert.deepEqual([...APPELS_EN_FILE].sort(), [...enFile, 'attendre'].sort());
  });
});
