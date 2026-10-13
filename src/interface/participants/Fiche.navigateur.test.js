// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La rubrique « Rencontres » de la fiche dans un vrai moteur de rendu
// (§ 12.5, B8, B14, D33) : la ligne de la personne dans le placement que le
// plan montre, sous la ligne de source, les plus revues d'abord, égale à sa
// ligne de la matrice de la page de qualité ; une phrase pour une source qui
// ne se mesure pas et pour une personne exclue ; absente sans placement,
// sans phrase ; vivante en lecture et sur un plan bloqué. Chaque épreuve
// monte App par monterApp, au cadre de 1 366 × 700, ouvre la section des
// participants et la fiche, et lit le rendu par le texte et les attributs
// data-…, jamais par une classe ; la dernière monte la fiche seule, sur
// une séance en lecture simulée, et change la proposition demandée au
// plan. Les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import { writable } from 'svelte/store';
import { appliquerCommande } from '../../application/commandes.js';
import { rencontresDePersonne } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre } from '../../../test/navigateur/entrees.js';
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
    appartenance: rang % 2 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
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
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(BASE);
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
// l'identifiant d'un homonyme, puis l'appartenance.
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

  test('deux homonymes rencontrés : chaque ligne écrit, après le nom, l’identifiant puis l’appartenance, et les deux lignes diffèrent', async () => {
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
    // Les autres : le nom, puis l'appartenance seule.
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
