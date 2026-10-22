// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La rubrique « Rencontres » de la fiche dans un vrai moteur de rendu
// (§ 12.5, B8, B14, D33) : la ligne de la personne dans le placement que le
// plan montre, sous la ligne de source, les plus revues d'abord, égale à sa
// ligne de la matrice de la page de qualité ; une phrase pour une source qui
// ne se mesure pas et pour une personne exclue ; absente sans placement,
// sans phrase ; vivante en lecture et sur un plan bloqué. Puis la rubrique
// « Présence » (§ 10.2) : son résumé et ses cases, un brouillon qui n'écrit
// rien et tient le geste ouvert, « Appliquer » en une entrée et l'étape
// « absente » de l'itinéraire, Entrée et Échap dans les cases, le brouillon
// et le refus vidés au passage à une autre personne, le refus sous les
// cases, et l'écriture venue d'ailleurs. Puis la rubrique « Conflits
// d'organisation » (§ 4, § 10.2) : son résumé et son choix multiple, un
// brouillon qui n'écrit rien, « Appliquer » en une entrée par organisation
// qui change, le clavier, le refus sous les cases et l'écriture venue
// d'ailleurs. Chaque épreuve
// monte App par monterApp, au cadre de 1 366 × 700, ouvre la section des
// participants et la fiche, et lit le rendu par le texte et les attributs
// data-…, jamais par une classe ; la dernière monte la fiche seule, sur
// une séance en lecture simulée, et change la proposition demandée au
// plan. Les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { appliquerCommande } from '../../application/commandes.js';
import { rencontresDePersonne } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { lireJournal } from '../../stockage/journal.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { creerEtatUi } from '../etat_ui.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Fiche from './Fiche.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;
const BASE = 'soiree';

// Douze personnes inventées, quatre tables de trois numérotées 11 à 14, six
// tours ; les deux premières réservées ensemble à la table 11 à chaque tour.
const NOMS = [
  ['Ombrelle', 'Iris'],
  ['Pervenche', 'Théo'],
  ['Lacasse', 'Ondine'],
  ['Tourteau', 'Basile'],
  ['Quenouille', 'Maëlle'],
  ['Varech', 'Sidonie'],
  ['Bruyère', 'Aurèle'],
  ['Embrun', 'Clovis'],
  ['Sablière', 'Noé'],
  ['Goémon', 'Perrine'],
  ['Ajonc', 'Tancrède'],
  ['Fougeraie', 'Ysaline'],
];

function chargeDouze() {
  const charge = creerCharge({ id: 'evt-fiche', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 6 });
  charge.participants = NOMS.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: rang % 2 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3, 4].map((id) => ({ id, numero: 10 + id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.reservations = [1, 2].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  charge.prochainsIds = { participant: 13, table: 5, proposition: 1 };
  return charge;
}

function generee(charge) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 5, arret: 60, nombre: 2 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

let montes = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      // Un graphique de la page de qualité que l'assertion lit attend
      // peut-être d'approcher de la zone visible : chacun se dessine, puis
      // elle se relit.
      await dessinerGraphiques(document.body);
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// La charge posée en fichier d'état, ouverte — en écriture sauf mode
// 'lecture' —, la proposition montrer demandée au plan, la section des
// participants et la fiche de la personne ouvertes.
async function ouvrirFiche(charge, personne, { mode = 'ecriture', montrer = null } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  if (montrer !== null) m.ui.montrerProposition(montrer);
  m.ui.allerA('participants');
  m.ui.ouvrirFiche(personne);
  flushSync();
  const fiche = await attendre(() => {
    const trouvee = m.racine.querySelector(`[data-fiche="${personne}"]`);
    expect(trouvee).not.toBeNull();
    return trouvee;
  });
  return { m, fiche };
}

const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const rubrique = (fiche) => fiche.querySelector('[data-rubrique-rencontres]');

// Les lignes de la rubrique : [nom, fois, tours], le nom lu dans le premier
// élément de l'intitulé de ligne, le reste dans le texte de chaque cellule.
const lignesDe = (section) =>
  [...section.querySelectorAll('tbody tr')].map((ligne) => {
    const [intitule, ...cellules] = ligne.querySelectorAll('th, td');
    return [texteDe(intitule.firstElementChild), ...cellules.map(texteDe)];
  });

// Ce que l'intitulé d'une ligne écrit après le nom, un texte par élément :
// l'identifiant d'un homonyme, puis l'organisation.
const secondairesDe = (ligne) => [...ligne.querySelector('th').children].slice(1).map(texteDe);

describe('la rubrique « Rencontres » de la fiche (§ 12.5, D33)', () => {
  const lue = generee(chargeDouze());
  const id = lue.propositions[0].id;

  test('sous la ligne de source, les personnes rencontrées dans la proposition montrée, les plus revues d’abord, leurs tours et tables écrits', async () => {
    const { fiche } = await ouvrirFiche(lue, 1, { montrer: id });
    const section = rubrique(fiche);
    expect(section).not.toBeNull();
    expect(texteDe(section.querySelector('h4'))).toBe(t('participants.fiche.rencontres.titre'));
    expect(texteDe(section)).toContain(
      `${t('participants.fiche.rencontres.intitule')} ${t('participants.fiche.rencontres.proposition', { proposition: id })}`,
    );
    const attendues = rencontresDePersonne(lue, id, 1).lignes.map(({ nom, fois, tours }) => [
      nom,
      String(fois),
      tours.map(({ tour, table }) => t('participants.fiche.rencontres.tour', { tour: tour + 1, table: 10 + table })).join(' ; '),
    ]);
    expect(lignesDe(section)).toEqual(attendues);
    expect(lignesDe(section)[0].slice(0, 2)).toEqual(['Théo Pervenche', '6']);
  });

  test('la ligne de la fiche égale celle de la matrice de la page de qualité, pour chaque personne', async () => {
    const { m } = await ouvrirFiche(lue, 1, { montrer: id });
    m.ui.allerA('qualite');
    const grille = await attendre(() => {
      const trouvee = m.racine.querySelector('[data-vue-qualite="paires"] [data-graphique="matrice"]');
      expect(trouvee?.querySelectorAll('[data-case]')).toHaveLength(144);
      return trouvee;
    });
    // Les intitulés de ligne, « rang. nom », dans l'ordre de la matrice.
    const ordre = [...grille.querySelectorAll('text')].map((texte) => texte.textContent).filter((texte) => /^\d+\. /.test(texte));
    const nomDe = (intitule) => intitule.replace(/^\d+\. /, '');
    const matrice = ordre.map((_, i) =>
      ordre
        .map((intitule, j) => [nomDe(intitule), texteDe(grille.querySelector(`[data-case="${i}:${j}"]`))])
        .filter(([, fois]) => fois !== '' && fois !== '0'),
    );
    for (const [i, intitule] of ordre.entries()) {
      const personne = lue.participants.find(({ nom, prenom }) => `${prenom} ${nom}` === nomDe(intitule)).id;
      m.ui.allerA('participants');
      m.ui.ouvrirFiche(personne);
      const section = await attendre(() => {
        const trouvee = rubrique(m.racine.querySelector(`[data-fiche="${personne}"]`));
        expect(trouvee).not.toBeNull();
        return trouvee;
      });
      const deLaFiche = lignesDe(section).map(([nom, fois]) => [nom, fois]);
      const parNom = (a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
      expect([...deLaFiche].sort(parNom), intitule).toEqual([...matrice[i]].sort(parNom));
    }
  });

  test('sans proposition montrée, le retenu ; vivante en lecture et sur un plan bloqué, sans écriture', async () => {
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[1].id });
    for (const charge of [retenue, executer(retenue, 'changerEtat', { etat: 'bloque' })]) {
      const { m, fiche } = await ouvrirFiche(charge, 3, { mode: 'lecture' });
      const ecritures = m.trace.length;
      const section = rubrique(fiche);
      expect(section).not.toBeNull();
      expect(texteDe(section)).toContain(`${t('participants.fiche.rencontres.intitule')} ${t('participants.fiche.rencontres.retenu')}`);
      expect(lignesDe(section).length).toBe(rencontresDePersonne(charge, 'retenu', 3).lignes.length);
      expect(section.querySelector('button, [data-refus]')).toBeNull();
      expect(m.trace.length).toBe(ecritures);
    }
  });

  test('une proposition demandée au plan l’emporte sur le retenu : la fiche mesure la même source que la page de qualité', async () => {
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[1].id });
    expect(id).not.toBe(lue.propositions[1].id);
    const { fiche } = await ouvrirFiche(retenue, 3, { montrer: id });
    const section = rubrique(fiche);
    expect(texteDe(section)).toContain(
      `${t('participants.fiche.rencontres.intitule')} ${t('participants.fiche.rencontres.proposition', { proposition: id })}`,
    );
    expect(texteDe(section)).not.toContain(t('participants.fiche.rencontres.retenu'));
    const attendues = rencontresDePersonne(retenue, id, 3).lignes.map(({ nom, fois }) => [nom, String(fois)]);
    expect(lignesDe(section).map(([nom, fois]) => [nom, fois])).toEqual(attendues);
  });

  test('une personne exclue : la phrase qui le dit, sans ligne ; une source en dérive : la phrase du placement non mesurable', async () => {
    const exclue = structuredClone(lue);
    exclue.participants[2].exclu = true;
    const { fiche } = await ouvrirFiche(exclue, 3, { montrer: id });
    expect(texteDe(rubrique(fiche))).toContain(t('participants.fiche.rencontres.exclue'));
    expect(rubrique(fiche).querySelector('table')).toBeNull();
    const { fiche: autre } = await ouvrirFiche(exclue, 4, { montrer: id });
    expect(texteDe(rubrique(autre))).toContain(t('participants.fiche.rencontres.nonMesurable'));
    expect(rubrique(autre).querySelector('table')).toBeNull();
  });

  test('deux homonymes rencontrés : chaque ligne écrit, après le nom, l’identifiant puis l’organisation, et les deux lignes diffèrent', async () => {
    // La personne 2, réservée avec la personne 1, prend son nom : qui
    // rencontre l'une rencontre l'autre.
    const homonymes = structuredClone(lue);
    Object.assign(homonymes.participants[1], { nom: 'Ombrelle', prenom: 'Iris' });
    const temoin = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12].find((personne) =>
      rencontresDePersonne(homonymes, id, personne).lignes.some((ligne) => ligne.id === 1),
    );
    const { fiche } = await ouvrirFiche(homonymes, temoin, { montrer: id });
    const rangees = [...rubrique(fiche).querySelectorAll('tbody tr')];
    const deLaPersonne = (personne) =>
      rangees[rencontresDePersonne(homonymes, id, temoin).lignes.findIndex((ligne) => ligne.id === personne)];
    const [une, autre] = [1, 2].map(deLaPersonne);
    expect(texteDe(une.querySelector('th').firstElementChild)).toBe('Iris Ombrelle');
    expect(texteDe(autre.querySelector('th').firstElementChild)).toBe('Iris Ombrelle');
    expect(secondairesDe(une)).toEqual([t('qualite.paires.homonyme', { id: 1 }), 'Coopérative Aubier']);
    expect(secondairesDe(autre)).toEqual([t('qualite.paires.homonyme', { id: 2 }), 'Atelier Ressac']);
    expect(texteDe(une)).not.toBe(texteDe(autre));
    // Les autres : le nom, puis l'organisation seule.
    for (const rangee of rangees.filter((r) => r !== une && r !== autre)) {
      expect(secondairesDe(rangee)).toHaveLength(1);
      expect(secondairesDe(rangee)[0]).not.toMatch(/n°/);
    }
  });

  test('sans placement — ni proposition ni retenu —, la rubrique est absente, sans phrase', async () => {
    const { fiche } = await ouvrirFiche(chargeDouze(), 1);
    expect(rubrique(fiche)).toBeNull();
    for (const cle of ['titre', 'nonMesurable', 'exclue', 'aucune']) {
      expect(texteDe(fiche)).not.toContain(t(`participants.fiche.rencontres.${cle}`));
    }
  });
});

describe('la rubrique suit le placement que le plan montre (§ 12.5, D25)', () => {
  test('la fiche montée seule : une autre proposition demandée au plan change la source et les lignes ; aucune, et sans retenu, la rubrique disparaît', async () => {
    const lue = generee(chargeDouze());
    const [premiere, seconde] = lue.propositions.map(({ id }) => id);
    const etat = { mode: 'lecture', evenement: { etat: 'brouillon', revision: 1 }, charge: lue };
    const magasin = writable(etat);
    const seance = {
      subscribe: magasin.subscribe,
      etat: () => etat,
      surAnnulation: () => () => {},
      debuterGeste() {},
      finirGeste() {},
      async executer() {
        throw new Error('la rubrique n’écrit rien');
      },
    };
    const ui = creerEtatUi();
    ui.montrerProposition(premiere);
    const cible = document.createElement('div');
    document.body.prepend(cible);
    const composant = mount(Fiche, {
      target: cible,
      props: { participant: lue.participants[4], charge: lue },
      context: new Map([
        ['t', t],
        ['ui', ui],
        ['seance', seance],
      ]),
    });
    try {
      flushSync();
      const lignesAttendues = (id) => rencontresDePersonne(lue, id, 5).lignes.map(({ nom, fois }) => [nom, String(fois)]);
      const source = (id) => `${t('participants.fiche.rencontres.intitule')} ${t('participants.fiche.rencontres.proposition', { proposition: id })}`;
      expect(texteDe(rubrique(cible))).toContain(source(premiere));
      expect(lignesDe(rubrique(cible)).map(([nom, fois]) => [nom, fois])).toEqual(lignesAttendues(premiere));
      ui.montrerProposition(seconde);
      await tick();
      flushSync();
      expect(texteDe(rubrique(cible))).toContain(source(seconde));
      expect(lignesDe(rubrique(cible)).map(([nom, fois]) => [nom, fois])).toEqual(lignesAttendues(seconde));
      ui.montrerProposition(null);
      await tick();
      flushSync();
      expect(rubrique(cible)).toBeNull();
    } finally {
      unmount(composant);
      cible.remove();
    }
  });
});

describe('la rubrique « Présence » de la fiche (§ 10.2)', () => {
  const presence = (fiche) => fiche.querySelector('[data-presence-fiche]');
  const cases = (fiche) => [...presence(fiche).querySelectorAll('[data-presence-tour]')];
  const coches = (fiche) => cases(fiche).map((c) => c.checked);
  const bouton = (fiche, nom) => presence(fiche).querySelector(`[data-commande="${nom}"]`);
  const resume = (fiche) => presence(fiche).querySelector('[data-presence]');
  // Les libellés des entrées du journal de l'événement ; aucun sans journal.
  const libelles = (m) => {
    const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
    return texte === null ? [] : lireJournal(texte).entrees.map(({ libelle }) => libelle);
  };
  // Les entrées de présence du journal : une par « Appliquer » qui écrit.
  const ajouts = (m) => libelles(m).filter((libelle) => libelle.startsWith('Présence de ')).length;
  const presenceDe = (m, id) => m.seance.etat().charge.participants.find((p) => p.id === id).presence;
  const ligneItineraire = (fiche, tour) => fiche.querySelector(`[data-itineraire-tour="${tour}"]`);

  // Bascule une case, puis laisse le rendu suivre.
  async function basculer(fiche, tour) {
    cases(fiche)[tour - 1].click();
    flushSync();
    await tick();
  }

  test('entre les étiquettes et les réservations : son titre, le résumé, une case par tour nommée « Tour r », cochées selon la présence, dans un groupe nommé par la personne ; « Tous les tours » et « Appliquer »', async () => {
    const charge = chargeDouze();
    charge.participants[3].presence = [2, 4];
    const { fiche } = await ouvrirFiche(charge, 3);
    const section = presence(fiche);
    expect(section).not.toBeNull();
    expect(texteDe(section.querySelector('h4'))).toBe(t('participants.fiche.presence'));
    expect(fiche.querySelector('[data-etiquettes]').compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const reservations = [...fiche.querySelectorAll('table')].find((tableau) => tableau.caption?.textContent === t('participants.fiche.reservations'));
    expect(section.compareDocumentPosition(reservations) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(resume(fiche).dataset.presence).toBe('tous');
    expect(texteDe(resume(fiche))).toBe('tous');
    expect(cases(fiche).map((c) => texteDe(c.closest('label')))).toEqual(['Tour 1', 'Tour 2', 'Tour 3', 'Tour 4', 'Tour 5', 'Tour 6']);
    expect(coches(fiche)).toEqual([true, true, true, true, true, true]);
    const groupe = section.querySelector('fieldset');
    expect(groupe.getAttribute('aria-label')).toBe(t('participants.presence.editeur', { nom: 'Ondine Lacasse' }));
    expect(texteDe(groupe.querySelector('legend'))).toBe(t('participants.fiche.presenceLegende'));
    expect(texteDe(bouton(fiche, 'presenceTous'))).toBe(t('participants.presence.tousLesTours'));
    expect(texteDe(bouton(fiche, 'changerPresence'))).toBe(t('participants.presence.appliquer'));

    const { fiche: autre } = await ouvrirFiche(charge, 4);
    expect(resume(autre).dataset.presence).toBe('partielle');
    expect(texteDe(resume(autre))).toBe('tours 2 et 4');
    expect(coches(autre)).toEqual([false, true, false, true, false, false]);
  });

  test('cocher, décocher et « Tous les tours » n’écrivent rien ; « Appliquer » sans changement non plus', async () => {
    const charge = chargeDouze();
    charge.participants[4].presence = [1, 2];
    const { m, fiche } = await ouvrirFiche(charge, 5);
    const trace = m.trace.length;
    await basculer(fiche, 3);
    expect(coches(fiche)).toEqual([true, true, true, false, false, false]);
    bouton(fiche, 'presenceTous').click();
    await attendre(() => expect(coches(fiche)).toEqual([true, true, true, true, true, true]));
    expect(texteDe(resume(fiche))).toBe('tours 1 et 2');
    expect(m.trace.length).toBe(trace);
    // Revenue à l'enregistrée, la saisie n'exécute rien.
    for (const tour of [3, 4, 5, 6]) await basculer(fiche, tour);
    const executer = vi.spyOn(m.seance, 'executer');
    bouton(fiche, 'changerPresence').click();
    await attendre(() => expect(coches(fiche)).toEqual([true, true, false, false, false, false]));
    expect(executer).not.toHaveBeenCalled();
    expect(m.trace.length).toBe(trace);
  });

  test('« Appliquer » donne une entrée ; sur un retenu, l’itinéraire dit « absente » au tour retiré, les autres tours gardent leur table', async () => {
    const lue = generee(chargeDouze());
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[0].id });
    const { m, fiche } = await ouvrirFiche(retenue, 5);
    const avant = ajouts(m);
    expect(texteDe(ligneItineraire(fiche, 2))).not.toContain(t('participants.fiche.absente'));
    await basculer(fiche, 2);
    bouton(fiche, 'changerPresence').click();
    await attendre(() => expect(presenceDe(m, 5)).toEqual([1, 3, 4, 5, 6]));
    await attendre(() => expect(ajouts(m)).toBe(avant + 1));
    expect(libelles(m).at(-1)).toMatch(/^Présence de Maëlle Quenouille : tours 1 et 3 à 6, au lieu de tous les tours/);
    const apres = m.racine.querySelector('[data-fiche="5"]');
    await attendre(() => expect(texteDe(resume(apres))).toBe('tours 1 et 3 à 6'));
    expect(coches(apres)).toEqual([true, false, true, true, true, true]);
    const lignes = [1, 2, 3, 4, 5, 6].map((tour) => ligneItineraire(apres, tour));
    expect(lignes.every((ligne) => ligne !== null)).toBe(true);
    expect([...lignes[1].cells].map(texteDe)).toEqual(['2', t('participants.fiche.absente')]);
    for (const ligne of [lignes[0], ...lignes.slice(2)]) {
      expect(ligne.cells).toHaveLength(3);
      expect(texteDe(ligne.cells[1])).toMatch(/^1[1-4]$/);
    }
    // Rien de plus n'est écrit à la relecture.
    await new Promise((resoudre) => requestAnimationFrame(resoudre));
    expect(ajouts(m)).toBe(avant + 1);
  });

  test('passer à une autre personne vide le brouillon et le refus, et rend le geste ; revenir montre la présence enregistrée', async () => {
    const charge = chargeDouze();
    charge.participants[2].presence = [6];
    const { m, fiche } = await ouvrirFiche(charge, 3);
    expect(m.seance.gesteEnCours).toBe(false);
    await basculer(fiche, 6);
    expect(coches(fiche)[5]).toBe(false);
    // Le brouillon tient le geste ; refusé, il le garde.
    expect(m.seance.gesteEnCours).toBe(true);
    bouton(fiche, 'changerPresence').click();
    await attendre(() => expect(presence(fiche).querySelector('[data-refus="PRESENCE_VIDE"]')).not.toBeNull());
    expect(m.seance.gesteEnCours).toBe(true);
    m.ui.ouvrirFiche(4);
    const quatre = await attendre(() => {
      const trouvee = m.racine.querySelector('[data-fiche="4"]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(coches(quatre)).toEqual([true, true, true, true, true, true]);
    expect(presence(quatre).querySelector('[data-refus]')).toBeNull();
    for (const c of cases(quatre)) expect(c.hasAttribute('aria-invalid')).toBe(false);
    expect(presence(quatre).querySelector('fieldset').hasAttribute('aria-describedby')).toBe(false);
    expect(m.seance.gesteEnCours).toBe(false);
    m.ui.ouvrirFiche(3);
    const trois = await attendre(() => {
      const trouvee = m.racine.querySelector('[data-fiche="3"]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(coches(trois)).toEqual([false, false, false, false, false, true]);
    expect(presence(trois).querySelector('[data-refus]')).toBeNull();
    expect(m.seance.gesteEnCours).toBe(false);
  });

  test('au clavier dans les cases : Échap rend la présence enregistrée sans rien écrire, Entrée applique en une entrée ; le brouillon tient le geste, que l’envoi ou une saisie revenue à l’enregistrée rendent', async () => {
    const charge = chargeDouze();
    charge.participants[4].presence = [1, 2];
    const { m, fiche } = await ouvrirFiche(charge, 5);
    const avant = ajouts(m);
    const trace = m.trace.length;
    const executer = vi.spyOn(m.seance, 'executer');
    expect(m.seance.gesteEnCours).toBe(false);

    cases(fiche)[2].focus();
    await touche(' ');
    await attendre(() => expect(coches(fiche)).toEqual([true, true, true, false, false, false]));
    expect(m.seance.gesteEnCours).toBe(true);
    await touche('Escape');
    await attendre(() => expect(coches(fiche)).toEqual([true, true, false, false, false, false]));
    expect(m.seance.gesteEnCours).toBe(false);
    expect(m.racine.querySelector('[data-fiche="5"]')).toBe(fiche);
    expect(executer).not.toHaveBeenCalled();
    expect(m.trace.length).toBe(trace);

    cases(fiche)[1].focus();
    await touche(' ');
    await attendre(() => expect(coches(fiche)).toEqual([true, false, false, false, false, false]));
    expect(m.seance.gesteEnCours).toBe(true);
    await touche('Enter');
    await attendre(() => expect(presenceDe(m, 5)).toEqual([1]));
    await attendre(() => expect(ajouts(m)).toBe(avant + 1));
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('changerPresence', { id: 5, tours: [1] });
    expect(m.seance.gesteEnCours).toBe(false);

    // Cocher puis décocher le même tour : un brouillon, qui tient le geste ;
    // « Appliquer » le lit comme l'enregistrée, n'exécute rien et le rend.
    const apres = m.racine.querySelector('[data-fiche="5"]');
    await basculer(apres, 4);
    await basculer(apres, 4);
    expect(coches(apres)).toEqual([true, false, false, false, false, false]);
    expect(m.seance.gesteEnCours).toBe(true);
    bouton(apres, 'changerPresence').click();
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    expect(executer).toHaveBeenCalledTimes(1);
    expect(ajouts(m)).toBe(avant + 1);
  });

  test('un refus se pose sous les cases, qu’il décrit : tout décoché, PRESENCE_VIDE sans remède, le brouillon gardé ; en lecture, le refus de la séance et son remède', async () => {
    const charge = chargeDouze();
    charge.participants[2].presence = [6];
    const { m, fiche } = await ouvrirFiche(charge, 3);
    const trace = m.trace.length;
    await basculer(fiche, 6);
    bouton(fiche, 'changerPresence').click();
    const refus = await attendre(() => {
      const trouve = presence(fiche).querySelector('[data-refus="PRESENCE_VIDE"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(refus.querySelector('button')).toBeNull();
    expect(coches(fiche)).toEqual([false, false, false, false, false, false]);
    expect(document.getElementById(presence(fiche).querySelector('fieldset').getAttribute('aria-describedby'))).toBe(refus);
    for (const c of cases(fiche)) expect(c.getAttribute('aria-invalid')).toBe('true');
    expect(m.trace.length).toBe(trace);
    // Une bascule retire le refus.
    await basculer(fiche, 2);
    expect(presence(fiche).querySelector('[data-refus]')).toBeNull();

    const { m: lecture, fiche: lue } = await ouvrirFiche(chargeDouze(), 3, { mode: 'lecture' });
    const ecritures = lecture.trace.length;
    expect(cases(lue)).toHaveLength(6);
    await basculer(lue, 1);
    bouton(lue, 'changerPresence').click();
    const refusLecture = await attendre(() => {
      const trouve = presence(lue).querySelector('[data-refus]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(refusLecture.querySelector('button')).not.toBeNull();
    expect(coches(lue)[0]).toBe(false);
    expect(lecture.trace.length).toBe(ecritures);
  });

  test('une écriture venue d’ailleurs — la grille, puis Défaire — met le résumé et les cases à jour', async () => {
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3);
    await m.seance.executer('changerPresence', { id: 3, tours: [1, 2] });
    await attendre(() => expect(texteDe(resume(fiche))).toBe('tours 1 et 2'));
    expect(coches(fiche)).toEqual([true, true, false, false, false, false]);
    await m.seance.defaire();
    await attendre(() => expect(texteDe(resume(fiche))).toBe('tous'));
    expect(coches(fiche)).toEqual([true, true, true, true, true, true]);
  });
});

describe("la rubrique « Conflits d'organisation » de la fiche (§ 4, § 10.2)", () => {
  const rubriqueConflits = (fiche) => fiche.querySelector('[data-conflits-fiche]');
  const cases = (fiche) => [...rubriqueConflits(fiche).querySelectorAll('[data-choix]')];
  const noms = (fiche) => cases(fiche).map((c) => texteDe(c.closest('label')));
  const coches = (fiche) => cases(fiche).map((c) => c.checked);
  const appliquer = (fiche) => rubriqueConflits(fiche).querySelector('[data-commande="appliquerConflits"]');
  const resume = (fiche) => [...rubriqueConflits(fiche).querySelectorAll('[data-conflits-resume] li')].map(texteDe);
  // Les entrées de conflits du journal, une par geste validé.
  const libelles = (m) => {
    const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
    const tous = texte === null ? [] : lireJournal(texte).entrees.map(({ libelle }) => libelle);
    return tous.filter((libelle) => libelle.startsWith('Conflits de '));
  };
  const conflitsDe = (m, id) => m.seance.etat().charge.participants.find((p) => p.id === id).conflits;

  // Douze personnes, trois organisations : la douzième passe au Club des
  // Merles.
  function chargeTrois() {
    const charge = chargeDouze();
    charge.participants[11].organisation = 'Club des Merles';
    return charge;
  }

  async function basculer(fiche, rang) {
    cases(fiche)[rang].click();
    flushSync();
    await tick();
  }

  test("entre les étiquettes et la présence : son titre, « Aucun conflit d'organisation. », une case par organisation hors la sienne, rangée, dans un groupe nommé par la personne ; « Appliquer »", async () => {
    const { fiche } = await ouvrirFiche(chargeTrois(), 3);
    const section = rubriqueConflits(fiche);
    expect(section).not.toBeNull();
    expect(texteDe(section.querySelector('h4'))).toBe(t('participants.fiche.conflits'));
    expect(fiche.querySelector('[data-etiquettes]').compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(fiche.querySelector('[data-presence-fiche]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(texteDe(section.querySelector('[data-conflits-resume]'))).toBe("Aucun conflit d'organisation.");
    // Ondine Lacasse, de la Coopérative Aubier : les deux autres.
    expect(noms(fiche)).toEqual(['Atelier Ressac', 'Club des Merles']);
    expect(coches(fiche)).toEqual([false, false]);
    expect(cases(fiche).map((c) => c.tabIndex)).toEqual([0, -1]);
    const groupe = section.querySelector('fieldset');
    expect(groupe.getAttribute('aria-label')).toBe("Conflits d'organisation de Ondine Lacasse, une case par organisation");
    expect(texteDe(groupe.querySelector('legend'))).toBe(t('participants.conflits.legende'));
    expect(texteDe(appliquer(fiche))).toBe(t('participants.conflits.appliquer'));
  });

  test('cocher et décocher n’écrivent rien ; « Appliquer » écrit le geste entier en une entrée, qu’un seul Défaire reprend, et le résumé les nomme', async () => {
    const charge = chargeTrois();
    charge.participants[2].conflits = ['Club des Merles'];
    const { m, fiche } = await ouvrirFiche(charge, 3);
    expect(resume(fiche)).toEqual(['Club des Merles']);
    expect(coches(fiche)).toEqual([false, true]);
    const trace = m.trace.length;
    await basculer(fiche, 0);
    await basculer(fiche, 1);
    expect(coches(fiche)).toEqual([true, false]);
    expect(m.seance.gesteEnCours).toBe(true);
    expect(m.trace.length).toBe(trace);
    const avant = libelles(m).length;
    appliquer(fiche).click();
    await attendre(() => expect(conflitsDe(m, 3)).toEqual(['Atelier Ressac']));
    await attendre(() => expect(libelles(m)).toHaveLength(avant + 1));
    expect(libelles(m).at(-1)).toBe('Conflits de Ondine Lacasse : ajouté « Atelier Ressac » ; retiré « Club des Merles »');
    const apres = m.racine.querySelector('[data-fiche="3"]');
    await attendre(() => expect(resume(apres)).toEqual(['Atelier Ressac']));
    expect(coches(apres)).toEqual([true, false]);
    expect(m.seance.gesteEnCours).toBe(false);
    // Cocher puis décocher : « Appliquer » n'exécute rien.
    const executer = vi.spyOn(m.seance, 'executer');
    await basculer(apres, 1);
    await basculer(apres, 1);
    appliquer(apres).click();
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    expect(executer).not.toHaveBeenCalled();
    await m.seance.defaire();
    await attendre(() => expect(conflitsDe(m, 3)).toEqual(['Club des Merles']));
    await attendre(() => expect(resume(m.racine.querySelector('[data-fiche="3"]'))).toEqual(['Club des Merles']));
  });

  test('au clavier : → et Fin passent d’une case à l’autre, l’espace coche, Échap rend la liste enregistrée sans rien écrire, Entrée applique', async () => {
    const { m, fiche } = await ouvrirFiche(chargeTrois(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    cases(fiche)[0].focus();
    await touche('End');
    expect(document.activeElement).toBe(cases(fiche)[1]);
    await touche(' ');
    await attendre(() => expect(coches(fiche)).toEqual([false, true]));
    await touche('Escape');
    await attendre(() => expect(coches(fiche)).toEqual([false, false]));
    expect(executer).not.toHaveBeenCalled();
    await touche('Home');
    expect(document.activeElement).toBe(cases(fiche)[0]);
    await touche(' ');
    await touche('Enter');
    await attendre(() => expect(conflitsDe(m, 3)).toEqual(['Atelier Ressac']));
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('changerConflits', { id: 3, organisations: ['Atelier Ressac'] });
  });

  test('un refus se pose sous les cases, qu’il décrit, le brouillon gardé : sur un plan bloqué, ouvert en lecture, le refus de la séance et son remède', async () => {
    const lue = generee(chargeTrois());
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[0].id });
    const { m, fiche } = await ouvrirFiche(executer(retenue, 'changerEtat', { etat: 'bloque' }), 3, { mode: 'lecture' });
    const trace = m.trace.length;
    await basculer(fiche, 1);
    appliquer(fiche).click();
    const refus = await attendre(() => {
      const trouve = rubriqueConflits(fiche).querySelector('[data-refus]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(refus.dataset.refus).toBe(m.seance.etat().refus.code);
    expect(refus.querySelector('button')).not.toBeNull();
    expect(coches(fiche)).toEqual([false, true]);
    expect(document.getElementById(rubriqueConflits(fiche).querySelector('fieldset').getAttribute('aria-describedby'))).toBe(refus);
    for (const c of cases(fiche)) expect(c.getAttribute('aria-invalid')).toBe('true');
    expect(m.trace.length).toBe(trace);
    // Une bascule retire le refus.
    await basculer(fiche, 0);
    expect(rubriqueConflits(fiche).querySelector('[data-refus]')).toBeNull();
  });

  test('une écriture venue d’ailleurs — une commande, puis Défaire — met le résumé et les cases à jour', async () => {
    const { m, fiche } = await ouvrirFiche(chargeTrois(), 3);
    await m.seance.executer('ajouterConflit', { id: 3, organisation: 'Club des Merles' });
    await attendre(() => expect(resume(fiche)).toEqual(['Club des Merles']));
    expect(coches(fiche)).toEqual([false, true]);
    await m.seance.defaire();
    await attendre(() => expect(texteDe(rubriqueConflits(fiche).querySelector('[data-conflits-resume]'))).toBe("Aucun conflit d'organisation."));
    expect(coches(fiche)).toEqual([false, false]);
  });
});
