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
// d'ailleurs. Puis la rubrique « Logo » (§ 8.9, § 10.2) : sa place, la
// vignette, « Logo » qui choisit, convertit et pose l'image, la remplace,
// « Retirer le logo », Défaire, l'adresse blob: de chaque vignette libérée
// au chemin suivant et à la fermeture de la fiche, la vue grande dans la
// fiche avec « Fermer » et Échap, « logo introuvable », les refus posés à
// côté de « Logo » — en lecture et sur un plan bloqué avant que le dialogue
// s'ouvre —, le geste tenu tant que le dialogue est ouvert, le passage à
// une autre personne pendant une conversion, et l'écriture venue
// d'ailleurs ; chaque image se compose dans l'épreuve. Puis les
// informations de la fiche (§ 4, § 10.2) : les six valeurs en lecture,
// « Modifier » et son formulaire prérempli, le focus au nom puis rendu à
// « Modifier », une seule entrée des seuls champs changés, aucune quand
// rien ne change, « Annuler » et Échap, NOM_REQUIS contre le nom,
// l'orthographe d'organisation retenue et son signal, l'avis des conflits
// qui suivent, le refus en lecture et sur un plan bloqué, le formulaire
// refermé au passage à une autre personne, Ctrl+Z, et les conflits
// atteignables pendant la saisie. Chaque épreuve
// monte App par monterApp, au cadre de 1 366 × 700, ouvre la section des
// participants et la fiche, et lit le rendu par le texte et les attributs
// data-…, jamais par une classe ; celle de la rubrique « Rencontres » qui
// suit le plan monte la fiche seule, sur
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
import { lirePng } from '../../pdf/png.js';
import { serialiser } from '../../stockage/canonique.js';
import { ErreurStockage } from '../../stockage/erreurs.js';
import { lireJournal } from '../../stockage/journal.js';
import { convertirLogo } from './image_logo.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { traductionEcran } from '../../../test/navigateur/rendu.js';
import { creerEtatUi } from '../etat_ui.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Fiche from './Fiche.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
// Le t de l'écran, celui qu'App pose au contexte (§ 14.6) : l'attendu d'un
// texte lu tel que l'écran le porte, insécables comprises.
const { t: tEcran } = traductionEcran();
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
// participants et la fiche de la personne ouvertes ; aImporter, ce que rend
// le dialogue de choix d'un fichier, et images, des octets posés dans le
// dossier de l'événement sous leur chemin, avant l'ouverture.
async function ouvrirFiche(charge, personne, { mode = 'ecriture', montrer = null, aImporter = [], images = [] } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const fichiers = [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }];
  const m = await monterApp({ fichiers, aImporter });
  montes.push(m);
  for (const { chemin, octets } of images) m.fs.deposerOctets('documents', `${BASE}/${chemin}`, octets);
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
    // La cellule des tours, lue telle quelle : le t de l'écran tient chaque
    // « ; » à l'étape qu'il suit par une fine insécable.
    const etapes = rencontresDePersonne(lue, id, 1).lignes[0].tours.map(({ tour, table }) => ({ tour: tour + 1, table: 10 + table }));
    const cellule = section.querySelector('tbody tr').querySelectorAll('td')[1];
    expect(cellule.textContent).toBe(tEcran('participants.fiche.rencontres.toursListe', { tours: etapes }));
    expect(cellule.textContent).toContain('\u{202F};');
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

describe('la rubrique « Logo » de la fiche (§ 8.9, § 10.2)', () => {
  const rubriqueLogo = (fiche) => fiche.querySelector('[data-logo-fiche]');
  const commande = (fiche, nom) => rubriqueLogo(fiche).querySelector(`[data-commande="${nom}"]`);
  const vignette = (fiche) => rubriqueLogo(fiche).querySelector('[data-logo-vignette]');
  const ficheDe = (m, id) => m.racine.querySelector(`[data-fiche="${id}"]`);
  const logoDe = (m, id) => m.seance.etat().charge.participants.find((p) => p.id === id).logo;
  // Les entrées de logo du journal, une par geste.
  const libelles = (m) => {
    const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
    const tous = texte === null ? [] : lireJournal(texte).entrees.map(({ libelle }) => libelle);
    return tous.filter((libelle) => libelle.startsWith('Logo de '));
  };

  // Les octets d'une image largeur × hauteur, d'une teinte unie, encodée
  // sous le type donné.
  async function image(largeur, hauteur, teinte = 'rgb(40, 110, 170)', type = 'image/png') {
    const canevas = new OffscreenCanvas(largeur, hauteur);
    const contexte = canevas.getContext('2d');
    contexte.fillStyle = teinte;
    contexte.fillRect(0, 0, largeur, hauteur);
    const blob = await canevas.convertToBlob({ type });
    return new Uint8Array(await blob.arrayBuffer());
  }

  // Le chemin logo/<SHA-256>.png d'octets.
  async function cheminDe(octets) {
    const empreinte = new Uint8Array(await crypto.subtle.digest('SHA-256', octets));
    return `logo/${[...empreinte].map((octet) => octet.toString(16).padStart(2, '0')).join('')}.png`;
  }

  // La vignette chargée, et les dimensions naturelles de son image.
  async function vignetteChargee(m, id) {
    return attendre(() => {
      const image = vignette(ficheDe(m, id))?.querySelector('img');
      expect(image?.complete && image.naturalWidth > 0, 'vignette chargée').toBe(true);
      return { largeur: image.naturalWidth, hauteur: image.naturalHeight };
    });
  }

  // Une charge dont la troisième personne porte le logo d'octets, posés
  // dans le dossier de l'événement.
  async function chargeAvecLogo(octets, charge = chargeDouze()) {
    const chemin = await cheminDe(octets);
    charge.participants[2].logo = chemin;
    return { charge, images: [{ chemin, octets }] };
  }

  // Les adresses blob: créées et libérées tant que la sonde est posée ;
  // lever() rend les fonctions d'origine.
  function sonderAdresses() {
    const { createObjectURL: creer, revokeObjectURL: liberer } = URL;
    const sonde = { creees: [], liberees: [] };
    URL.createObjectURL = (objet) => {
      const adresse = creer.call(URL, objet);
      sonde.creees.push(adresse);
      return adresse;
    };
    URL.revokeObjectURL = (adresse) => {
      sonde.liberees.push(adresse);
      liberer.call(URL, adresse);
    };
    sonde.lever = () => {
      URL.createObjectURL = creer;
      URL.revokeObjectURL = liberer;
    };
    return sonde;
  }

  const aucuneFenetre = () => expect(document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]').length).toBe(0);

  test('entre les valeurs et les étiquettes : son titre, « Aucun logo. », « Logo » ; « Retirer le logo » absent sans logo', async () => {
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3);
    const section = rubriqueLogo(fiche);
    expect(section).not.toBeNull();
    expect(texteDe(section.querySelector('h4'))).toBe(t('participants.fiche.logo'));
    expect(fiche.querySelector('dl').compareDocumentPosition(section) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(section.compareDocumentPosition(fiche.querySelector('[data-etiquettes]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(texteDe(section.querySelector('[data-logo-absent]'))).toBe('Aucun logo.');
    expect(texteDe(commande(fiche, 'choisirLogo'))).toBe('Logo');
    expect(commande(fiche, 'choisirLogo').getAttribute('aria-label')).toBe('Logo de Ondine Lacasse\u{A0}: choisir une image');
    expect(commande(fiche, 'retirerLogo')).toBeNull();
    expect(vignette(fiche)).toBeNull();
    expect(m.choix).toEqual([]);
  });

  test('« Logo » ouvre le dialogue des images, convertit et pose : une entrée « posé », le PNG réduit dans logo/, la vignette ; « Retirer le logo » paraît', async () => {
    const source = await image(3000, 1500);
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3, { aImporter: [{ nom: 'emblème.png', octets: source }] });
    commande(fiche, 'choisirLogo').click();
    await attendre(() => expect(logoDe(m, 3)).toMatch(/^logo\/[0-9a-f]{64}\.png$/));
    expect(m.choix).toEqual([{ genre: 'image' }]);
    const posee = m.fs.octets('documents', `${BASE}/${logoDe(m, 3)}`);
    expect(lirePng(posee)).toEqual({ largeur: 1200, hauteur: 600 });
    expect(logoDe(m, 3)).toBe(await cheminDe(posee));
    expect(libelles(m)).toEqual(['Logo de Ondine Lacasse : posé']);
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 1200, hauteur: 600 });
    const apres = ficheDe(m, 3);
    expect(vignette(apres).getAttribute('aria-label')).toBe('Agrandir le logo de Ondine Lacasse');
    expect(vignette(apres).querySelector('img').getAttribute('alt')).toBe('');
    expect(rubriqueLogo(apres).querySelector('[data-logo-absent]')).toBeNull();
    expect(texteDe(commande(apres, 'retirerLogo'))).toBe('Retirer le logo');
    expect(m.seance.gesteEnCours).toBe(false);
  });

  test('remplacer garde l’ancienne image, Défaire rend l’ancienne vignette ; « Retirer le logo » écrit une entrée, garde les deux images et rend le focus à « Logo »', async () => {
    const premiere = await image(300, 100, 'rgb(200, 60, 60)');
    const seconde = await image(200, 200, 'rgb(60, 160, 60)');
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3, {
      aImporter: [
        { nom: 'premier.png', octets: premiere },
        { nom: 'second.jpg', octets: seconde },
      ],
    });
    commande(fiche, 'choisirLogo').click();
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 300, hauteur: 100 });
    const cheminPremier = logoDe(m, 3);
    commande(ficheDe(m, 3), 'choisirLogo').click();
    await attendre(() => expect(logoDe(m, 3)).not.toBe(cheminPremier));
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 200, hauteur: 200 });
    const cheminSecond = logoDe(m, 3);
    expect(libelles(m)).toEqual(['Logo de Ondine Lacasse : posé', 'Logo de Ondine Lacasse : remplacé']);
    expect(m.fs.octets('documents', `${BASE}/${cheminPremier}`)).not.toBeNull();

    await m.seance.defaire();
    await attendre(() => expect(logoDe(m, 3)).toBe(cheminPremier));
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 300, hauteur: 100 });
    await m.seance.refaire();
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 200, hauteur: 200 });

    commande(ficheDe(m, 3), 'retirerLogo').click();
    await attendre(() => expect(logoDe(m, 3)).toBeUndefined());
    await attendre(() => expect(texteDe(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-absent]'))).toBe('Aucun logo.'));
    expect(libelles(m).at(-1)).toBe('Logo de Ondine Lacasse : retiré');
    expect(commande(ficheDe(m, 3), 'retirerLogo')).toBeNull();
    for (const chemin of [cheminPremier, cheminSecond]) expect(m.fs.octets('documents', `${BASE}/${chemin}`)).not.toBeNull();
    await attendre(() => expect(document.activeElement).toBe(commande(ficheDe(m, 3), 'choisirLogo')));
  });

  test('chaque adresse blob: d’une vignette se libère au chemin suivant — remplacer, Défaire, Refaire — et à la fermeture de la fiche', async () => {
    const premiere = await image(300, 100, 'rgb(200, 60, 60)');
    const seconde = await image(200, 200, 'rgb(60, 160, 60)');
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3, {
      aImporter: [
        { nom: 'premier.png', octets: premiere },
        { nom: 'second.png', octets: seconde },
      ],
    });
    const sonde = sonderAdresses();
    try {
      commande(fiche, 'choisirLogo').click();
      expect(await vignetteChargee(m, 3)).toEqual({ largeur: 300, hauteur: 100 });
      const cheminPremier = logoDe(m, 3);
      commande(ficheDe(m, 3), 'choisirLogo').click();
      await attendre(() => expect(logoDe(m, 3)).not.toBe(cheminPremier));
      expect(await vignetteChargee(m, 3)).toEqual({ largeur: 200, hauteur: 200 });
      await m.seance.defaire();
      await attendre(() => expect(logoDe(m, 3)).toBe(cheminPremier));
      expect(await vignetteChargee(m, 3)).toEqual({ largeur: 300, hauteur: 100 });
      await m.seance.refaire();
      expect(await vignetteChargee(m, 3)).toEqual({ largeur: 200, hauteur: 200 });

      // Deux conversions et quatre vignettes : seule la montrée vit encore.
      const montree = vignette(ficheDe(m, 3)).querySelector('img').getAttribute('src');
      expect(sonde.creees).toContain(montree);
      expect(sonde.creees.length).toBe(6);
      expect([...sonde.liberees].sort()).toEqual(sonde.creees.filter((adresse) => adresse !== montree).sort());

      m.ui.ouvrirFiche(4);
      await attendre(() => expect(ficheDe(m, 4)).not.toBeNull());
      await attendre(() => expect([...sonde.liberees].sort()).toEqual([...sonde.creees].sort()));
    } finally {
      sonde.lever();
    }
  });

  test('la vignette cliquée laisse place à l’image à la largeur de la fiche, avec « Fermer », sans fenêtre ; « Fermer » et Échap rendent la vignette et son focus', async () => {
    const { charge, images } = await chargeAvecLogo(await image(240, 120));
    const { m, fiche } = await ouvrirFiche(charge, 3, { images });
    await vignetteChargee(m, 3);
    vignette(fiche).click();
    const agrandi = await attendre(() => {
      const trouve = rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-agrandi]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    aucuneFenetre();
    expect(vignette(ficheDe(m, 3))).toBeNull();
    const grande = agrandi.querySelector('img');
    expect(grande.getAttribute('alt')).toBe('Logo de Ondine Lacasse');
    await attendre(() => expect(grande.complete && grande.naturalWidth === 240).toBe(true));
    const largeurFiche = rubriqueLogo(ficheDe(m, 3)).getBoundingClientRect().width;
    expect(Math.abs(grande.getBoundingClientRect().width - largeurFiche)).toBeLessThanOrEqual(2);
    const fermer = agrandi.querySelector('[data-commande="fermerLogo"]');
    expect(texteDe(fermer)).toBe('Fermer');
    await attendre(() => expect(document.activeElement).toBe(fermer));
    fermer.click();
    await attendre(() => expect(vignette(ficheDe(m, 3))).not.toBeNull());
    expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-agrandi]')).toBeNull();
    await attendre(() => expect(document.activeElement).toBe(vignette(ficheDe(m, 3))));

    vignette(ficheDe(m, 3)).click();
    await attendre(() => expect(document.activeElement?.dataset.commande).toBe('fermerLogo'));
    // Un vrai clic sur l'image laisse le focus à la vue, où Échap porte.
    const boite = rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-agrandi] img').getBoundingClientRect();
    await pointer('presser', boite.x + boite.width / 2, boite.y + boite.height / 2);
    await pointer('relacher', boite.x + boite.width / 2, boite.y + boite.height / 2);
    await attendre(() => expect(document.activeElement?.hasAttribute('data-logo-agrandi')).toBe(true));
    await touche('Escape');
    await attendre(() => expect(vignette(ficheDe(m, 3))).not.toBeNull());
    await attendre(() => expect(document.activeElement).toBe(vignette(ficheDe(m, 3))));
    // La fiche reste ouverte : Échap ne ferme que la vue grande.
    expect(ficheDe(m, 3)).not.toBeNull();
  });

  test('un autre chemin referme la vue grande : le focus qui y était va à « Logo », le logo suivant se montre en vignette', async () => {
    const { charge, images } = await chargeAvecLogo(await image(240, 120));
    const aImporter = [{ nom: 'neuf.png', octets: await image(90, 30) }];
    const { m, fiche } = await ouvrirFiche(charge, 3, { images, aImporter });
    await vignetteChargee(m, 3);
    vignette(fiche).click();
    await attendre(() => expect(document.activeElement?.dataset.commande).toBe('fermerLogo'));
    await m.seance.retirerLogoParticipant({ id: 3 });
    await attendre(() => expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-absent]')).not.toBeNull());
    expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-agrandi]')).toBeNull();
    await attendre(() => expect(document.activeElement).toBe(commande(ficheDe(m, 3), 'choisirLogo')));
    commande(ficheDe(m, 3), 'choisirLogo').click();
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 90, hauteur: 30 });
    expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-agrandi]'), 'vue grande rouverte sans clic').toBeNull();
  });

  test('en lecture : la vignette et la vue grande restent, « Retirer le logo » est absent, « Logo » refuse avant d’ouvrir le dialogue, avec son remède, sans rien écrire', async () => {
    const { charge, images } = await chargeAvecLogo(await image(240, 120));
    const aImporter = [{ nom: 'autre.png', octets: await image(10, 10) }];
    const { m, fiche } = await ouvrirFiche(charge, 3, { mode: 'lecture', images, aImporter });
    await vignetteChargee(m, 3);
    expect(commande(fiche, 'retirerLogo')).toBeNull();
    const trace = m.trace.length;
    commande(fiche, 'choisirLogo').click();
    const refus = await attendre(() => {
      const trouve = rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus="MODE_LECTURE"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(refus.querySelector('button')).not.toBeNull();
    expect(document.getElementById(commande(ficheDe(m, 3), 'choisirLogo').getAttribute('aria-describedby'))).toBe(refus);
    expect(m.choix).toEqual([]);
    expect(m.trace.length).toBe(trace);
    vignette(ficheDe(m, 3)).click();
    await attendre(() => expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-agrandi]')).not.toBeNull());
  });

  test('sur un plan bloqué, en écriture comme en lecture : « Retirer le logo » absent, « Logo » refuse par le refus de la séance avant le dialogue', async () => {
    const lue = generee(chargeDouze());
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[0].id });
    for (const mode of ['ecriture', 'lecture']) {
      // En écriture, le plan se bloque séance ouverte ; en lecture, il
      // l'est dans le fichier.
      const depart = mode === 'ecriture' ? retenue : executer(retenue, 'changerEtat', { etat: 'bloque' });
      const { charge, images } = await chargeAvecLogo(await image(50, 50), structuredClone(depart));
      const { m } = await ouvrirFiche(charge, 3, { mode, images });
      if (mode === 'ecriture') {
        await vignetteChargee(m, 3);
        expect(commande(ficheDe(m, 3), 'retirerLogo')).not.toBeNull();
        await m.seance.executer('changerEtat', { etat: 'bloque' });
      }
      await vignetteChargee(m, 3);
      const fiche = ficheDe(m, 3);
      expect(commande(fiche, 'retirerLogo'), mode).toBeNull();
      const trace = m.trace.length;
      commande(fiche, 'choisirLogo').click();
      const refus = await attendre(() => {
        const trouve = rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus]');
        expect(trouve).not.toBeNull();
        return trouve;
      });
      expect(refus.dataset.refus).toBe(m.seance.etat().refus.code);
      expect(refus.querySelector('button'), mode).not.toBeNull();
      expect(m.choix, mode).toEqual([]);
      expect(m.trace.length, mode).toBe(trace);
    }
  });

  test('un chemin dont l’image manque ou ne se lit pas : « Logo introuvable », « Logo » et « Retirer le logo » offerts', async () => {
    const charge = chargeDouze();
    charge.participants[2].logo = `logo/${'0123456789abcdef'.repeat(4)}.png`;
    const { m, fiche } = await ouvrirFiche(charge, 3);
    const phrase = await attendre(() => {
      const trouvee = rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-introuvable]');
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(texteDe(phrase)).toBe(t('participants.logo.introuvable'));
    expect(texteDe(phrase)).toMatch(/^Logo introuvable/);
    expect(vignette(fiche)).toBeNull();
    expect(commande(fiche, 'choisirLogo')).not.toBeNull();
    expect(commande(fiche, 'retirerLogo')).not.toBeNull();

    // Une image présente que le moteur ne lit pas se dit introuvable de même.
    const abimee = chargeDouze();
    abimee.participants[2].logo = `logo/${'fedcba9876543210'.repeat(4)}.png`;
    const images = [{ chemin: abimee.participants[2].logo, octets: new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]) }];
    const { m: autre } = await ouvrirFiche(abimee, 3, { images });
    await attendre(() => expect(rubriqueLogo(ficheDe(autre, 3)).querySelector('[data-logo-introuvable]')).not.toBeNull());
    expect(vignette(ficheDe(autre, 3))).toBeNull();
  });

  test('sous « Logo introuvable », choisir de nouveau la même image la remet en place : la vignette paraît, sans refus ni entrée', async () => {
    const source = await image(60, 30);
    const png = await convertirLogo(source, { fichier: 'emblème.png' });
    const charge = chargeDouze();
    charge.participants[2].logo = await cheminDe(png);
    const choisi = { nom: 'emblème.png', octets: source };
    const { m, fiche } = await ouvrirFiche(charge, 3, { aImporter: [choisi, choisi] });
    await attendre(() => expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-introuvable]')).not.toBeNull());
    commande(fiche, 'choisirLogo').click();
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 60, hauteur: 30 });
    expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus]')).toBeNull();
    expect(libelles(m)).toEqual([]);
    expect(logoDe(m, 3)).toBe(charge.participants[2].logo);
    // Le logo présent, le même choix se refuse : il ne change rien.
    commande(ficheDe(m, 3), 'choisirLogo').click();
    await attendre(() => expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus="SANS_EFFET"]')).not.toBeNull());
  });

  test('une image illisible ou trop lourde se refuse à côté de « Logo », sans rien écrire ; un dialogue annulé ne fait rien', async () => {
    const bruit = new Uint8Array(256).map((_, rang) => (rang * 37 + 5) % 256);
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3, { aImporter: [{ nom: 'IMG_0042.HEIC', octets: bruit }] });
    const trace = m.trace.length;
    commande(fiche, 'choisirLogo').click();
    const refus = await attendre(() => {
      const trouve = rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus="LOGO_ILLISIBLE"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(texteDe(refus)).toContain('« IMG_0042.HEIC »');
    expect(texteDe(refus)).toContain('JPEG ou en PNG');
    expect(m.trace.length).toBe(trace);
    expect(logoDe(m, 3)).toBeUndefined();

    m.fs.choisirFichierAImporter = async () => {
      const details = { chemin: 'affiche.png', dossier: 'D:\\images', taille: 30_000_000, max: 26_214_400 };
      throw new ErreurStockage('TROP_VOLUMINEUX', details);
    };
    commande(ficheDe(m, 3), 'choisirLogo').click();
    await attendre(() => expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus="TROP_VOLUMINEUX"]')).not.toBeNull());
    expect(m.trace.length).toBe(trace);

    // Le geste reste ouvert tant que le dialogue l'est ; annulé, il se ferme.
    let annuler;
    m.fs.choisirFichierAImporter = () => new Promise((resoudre) => (annuler = () => resoudre(null)));
    commande(ficheDe(m, 3), 'choisirLogo').click();
    await attendre(() => expect(typeof annuler).toBe('function'));
    expect(m.seance.gesteEnCours, 'geste pendant le choix').toBe(true);
    annuler();
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    await attendre(() => expect(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-refus]')).toBeNull());
    await attendre(() => expect(commande(ficheDe(m, 3), 'choisirLogo').getAttribute('aria-busy')).toBeNull());
    expect(m.trace.length).toBe(trace);
    expect(m.seance.gesteEnCours).toBe(false);
  });

  test('passer à une autre personne pendant le choix : rien ne se pose sur sa fiche ; l’image choisie va à la personne qui l’a demandée, un refus n’est posé nulle part', async () => {
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3);
    let rendre;
    m.fs.choisirFichierAImporter = () => new Promise((resoudre) => (rendre = resoudre));
    commande(fiche, 'choisirLogo').click();
    await attendre(() => expect(typeof rendre).toBe('function'));
    expect(m.seance.gesteEnCours, 'geste pendant le choix').toBe(true);
    m.ui.ouvrirFiche(4);
    await attendre(() => expect(ficheDe(m, 4)).not.toBeNull());
    rendre({ nom: 'bruit.png', octets: new Uint8Array([1, 2, 3, 4]) });
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    expect(m.racine.querySelector('[data-refus]')).toBeNull();
    expect(texteDe(rubriqueLogo(ficheDe(m, 4)).querySelector('[data-logo-absent]'))).toBe('Aucun logo.');

    rendre = null;
    commande(ficheDe(m, 4), 'choisirLogo').click();
    await attendre(() => expect(typeof rendre).toBe('function'));
    m.ui.ouvrirFiche(5);
    await attendre(() => expect(ficheDe(m, 5)).not.toBeNull());
    rendre({ nom: 'emblème.png', octets: await image(64, 32) });
    await attendre(() => expect(logoDe(m, 4)).toMatch(/^logo\//));
    expect(logoDe(m, 5)).toBeUndefined();
    expect(texteDe(rubriqueLogo(ficheDe(m, 5)).querySelector('[data-logo-absent]'))).toBe('Aucun logo.');
    expect(vignette(ficheDe(m, 5))).toBeNull();
  });

  test('une écriture venue d’ailleurs — la séance, puis Défaire — met la vignette à jour', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    await m.seance.poserLogoParticipant({ id: 3, octets: await image(80, 40) });
    expect(await vignetteChargee(m, 3)).toEqual({ largeur: 80, hauteur: 40 });
    await m.seance.defaire();
    await attendre(() => expect(texteDe(rubriqueLogo(ficheDe(m, 3)).querySelector('[data-logo-absent]'))).toBe('Aucun logo.'));
    expect(vignette(ficheDe(m, 3))).toBeNull();
  });
});

describe('les informations de la fiche et « Modifier » (§ 4, § 10.2)', () => {
  const bloc = (fiche) => fiche.querySelector('[data-informations-fiche]');
  const formulaire = (fiche) => bloc(fiche).querySelector('form');
  const champ = (fiche, cle) => formulaire(fiche).querySelector(`[data-champ="${cle}"]`);
  const modifier = (fiche) => bloc(fiche).querySelector('[data-commande="modifierInformations"]');
  const enregistrer = (fiche) => formulaire(fiche).querySelector('[data-commande="enregistrerInformations"]');
  const annuler = (fiche) => formulaire(fiche).querySelector('[data-commande="annulerInformations"]');
  const ficheDe = (m, id) => m.racine.querySelector(`[data-fiche="${id}"]`);
  const personneDe = (m, id) => m.seance.etat().charge.participants.find((p) => p.id === id);
  // Les valeurs du bloc en lecture : [intitulé, valeur] par ligne.
  const valeurs = (fiche) => [...bloc(fiche).querySelectorAll('dt')].map((dt) => [texteDe(dt), texteDe(dt.nextElementSibling)]);
  // Les entrées « Modifié … » du journal, une par « Enregistrer » qui écrit.
  const libelles = (m) => {
    const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
    const tous = texte === null ? [] : lireJournal(texte).entrees.map(({ libelle }) => libelle);
    return tous.filter((libelle) => libelle.startsWith('Modifié '));
  };

  // Tape texte dans le champ, comme une saisie : la valeur, puis l'événement
  // que suit la liaison.
  function remplir(element, texte) {
    element.value = texte;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
  }

  // Ouvre le formulaire par « Modifier », et rend la fiche, le focus posé.
  async function ouvrirFormulaire(m, id) {
    modifier(ficheDe(m, id)).click();
    await attendre(() => expect(formulaire(ficheDe(m, id))).not.toBeNull());
    return ficheDe(m, id);
  }

  // Douze personnes, trois organisations : la douzième, seule au Club des
  // Merles, que la liste d'Ondine Lacasse nomme.
  function chargeConflit() {
    const charge = chargeDouze();
    charge.participants[11].organisation = 'Club des Merles';
    charge.participants[2].conflits = ['Club des Merles'];
    return charge;
  }

  test('en lecture, les six valeurs sous leur intitulé, « — » quand vide, puis le statut ; « Modifier », nommée par la personne, avant le logo', async () => {
    const charge = chargeDouze();
    Object.assign(charge.participants[2], { courriel: 'ondine@exemple.invalid', notes: 'Arrive tard\nAllergie aux noix' });
    const { fiche } = await ouvrirFiche(charge, 3);
    expect(bloc(fiche)).not.toBeNull();
    expect(valeurs(fiche)).toEqual([
      [t('participants.colonne.nom'), 'Lacasse'],
      [t('participants.colonne.prenom'), 'Ondine'],
      [t('participants.colonne.organisation'), 'Coopérative Aubier'],
      [t('participants.colonne.courriel'), 'ondine@exemple.invalid'],
      [t('participants.colonne.titrePressenti'), '\u{2014}'],
      [t('participants.colonne.notes'), 'Arrive tard Allergie aux noix'],
      [t('participants.fiche.statut'), expect.any(String)],
    ]);
    expect([...bloc(fiche).querySelectorAll('dd')][5].textContent).toBe('Arrive tard\nAllergie aux noix');
    expect(texteDe(modifier(fiche))).toBe(t('participants.informations.modifier'));
    expect(modifier(fiche).getAttribute('aria-label')).toBe(tEcran('participants.informations.modifierNomme', { nom: 'Ondine Lacasse' }));
    expect(formulaire(fiche)).toBeNull();
    expect(bloc(fiche).compareDocumentPosition(fiche.querySelector('[data-logo-fiche]')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('« Modifier » ouvre à la place du bloc un formulaire prérempli, les notes en zone de texte, le focus sur le nom ; rien ne s’écrit', async () => {
    const charge = chargeDouze();
    charge.participants[2].notes = 'Arrive tard';
    const { m } = await ouvrirFiche(charge, 3);
    const trace = m.trace.length;
    const fiche = await ouvrirFormulaire(m, 3);
    expect(bloc(fiche).querySelector('dl')).toBeNull();
    expect(modifier(fiche)).toBeNull();
    expect(formulaire(fiche).getAttribute('aria-label')).toBe(tEcran('participants.informations.formulaire', { nom: 'Ondine Lacasse' }));
    const cles = ['nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'notes'];
    expect(cles.map((cle) => champ(fiche, cle).value)).toEqual(['Lacasse', 'Ondine', 'Coopérative Aubier', '', '', 'Arrive tard']);
    expect(cles.map((cle) => texteDe(formulaire(fiche).querySelector(`label[for="${champ(fiche, cle).id}"]`)))).toEqual(
      cles.map((cle) => t(`participants.colonne.${cle}`)),
    );
    expect(champ(fiche, 'notes').localName).toBe('textarea');
    // Les organisations de l'événement, proposées au champ.
    const liste = document.getElementById(champ(fiche, 'organisation').getAttribute('list'));
    expect([...liste.querySelectorAll('option')].map((option) => option.value)).toEqual(['Atelier Ressac', 'Coopérative Aubier']);
    await attendre(() => expect(document.activeElement).toBe(champ(fiche, 'nom')));
    expect(texteDe(enregistrer(fiche))).toBe(t('participants.informations.enregistrer'));
    expect(texteDe(annuler(fiche))).toBe(t('participants.informations.annuler'));
    expect(m.seance.gesteEnCours).toBe(false);
    expect(m.trace.length).toBe(trace);
  });

  test('changer le nom et l’organisation : une seule entrée qui nomme les deux champs, le bloc montre les nouvelles valeurs, le focus revient à « Modifier » ; Ctrl+Z défait l’entrée', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'nom'), 'Lacasse-Varech');
    remplir(champ(fiche, 'organisation'), 'Fonds Grisaille');
    expect(m.seance.gesteEnCours).toBe(true);
    enregistrer(fiche).click();
    await attendre(() => expect(personneDe(m, 3).organisation).toBe('Fonds Grisaille'));
    await attendre(() => expect(libelles(m)).toHaveLength(1));
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('modifierParticipant', { id: 3, champs: { nom: 'Lacasse-Varech', organisation: 'Fonds Grisaille' } });
    expect(libelles(m)[0]).toBe('Modifié Ondine Lacasse : nom, organisation (désormais Ondine Lacasse-Varech)');
    const apres = await attendre(() => {
      const trouvee = ficheDe(m, 3);
      expect(formulaire(trouvee)).toBeNull();
      return trouvee;
    });
    expect(valeurs(apres).slice(0, 3).map(([, valeur]) => valeur)).toEqual(['Lacasse-Varech', 'Ondine', 'Fonds Grisaille']);
    await attendre(() => expect(document.activeElement).toBe(modifier(apres)));
    expect(m.seance.gesteEnCours).toBe(false);
    expect(bloc(apres).querySelector('[data-avertissement]')).toBeNull();

    await touche('z', { ctrl: true });
    await attendre(() => expect(personneDe(m, 3).nom).toBe('Lacasse'));
    expect(personneDe(m, 3).organisation).toBe('Coopérative Aubier');
    await attendre(() => expect(valeurs(ficheDe(m, 3)).slice(0, 3).map(([, valeur]) => valeur)).toEqual(['Lacasse', 'Ondine', 'Coopérative Aubier']));
    expect(executer).toHaveBeenCalledTimes(1);
  });

  test('rien de changé, ou des blancs de bord seulement : « Enregistrer » referme sans écrire ni refuser, le focus à « Modifier »', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const trace = m.trace.length;
    let fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'prenom'), '  Ondine ');
    expect(m.seance.gesteEnCours).toBe(false);
    enregistrer(fiche).click();
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    await attendre(() => expect(document.activeElement).toBe(modifier(ficheDe(m, 3))));
    fiche = await ouvrirFormulaire(m, 3);
    await touche('Enter');
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    expect(executer).not.toHaveBeenCalled();
    expect(m.racine.querySelector('[data-refus]')).toBeNull();
    expect(m.trace.length).toBe(trace);
  });

  test('une organisation voisine de celle d’une autre, que la saisie ne touche pas : « Enregistrer » sans changement n’écrit rien, les notes seules ne font partir qu’elles', async () => {
    const charge = chargeDouze();
    charge.participants[2].organisation = 'atelier ressac';
    const { m } = await ouvrirFiche(charge, 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const trace = m.trace.length;
    let fiche = await ouvrirFormulaire(m, 3);
    expect(m.seance.gesteEnCours).toBe(false);
    enregistrer(fiche).click();
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    expect(executer).not.toHaveBeenCalled();
    expect(m.trace.length).toBe(trace);

    fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'notes'), 'arrive tard');
    enregistrer(fiche).click();
    await attendre(() => expect(personneDe(m, 3).notes).toBe('arrive tard'));
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('modifierParticipant', { id: 3, champs: { notes: 'arrive tard' } });
    expect(personneDe(m, 3).organisation).toBe('atelier ressac');
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    expect(bloc(ficheDe(m, 3)).querySelector('[data-avertissement]')).toBeNull();
  });

  test('une écriture venue d’ailleurs pendant la saisie ne tient pas le geste, et « Enregistrer » ne la défait pas : seuls les champs saisis partent', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    await ouvrirFormulaire(m, 3);
    await m.seance.executer('modifierParticipant', { id: 3, champs: { prenom: 'Zoé' } });
    flushSync();
    expect(formulaire(ficheDe(m, 3))).not.toBeNull();
    const tenuSansFrappe = m.seance.gesteEnCours;
    const executer = vi.spyOn(m.seance, 'executer');
    remplir(champ(ficheDe(m, 3), 'notes'), 'arrive tard');
    expect(m.seance.gesteEnCours).toBe(true);
    enregistrer(ficheDe(m, 3)).click();
    await attendre(() => expect(personneDe(m, 3).notes).toBe('arrive tard'));
    expect(personneDe(m, 3).prenom).toBe('Zoé');
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('modifierParticipant', { id: 3, champs: { notes: 'arrive tard' } });
    await attendre(() => expect(valeurs(ficheDe(m, 3))[1][1]).toBe('Zoé'));
    expect(tenuSansFrappe, 'le geste tenu sans frappe').toBe(false);
  });

  test('dans les notes, Maj+Entrée garde un saut de ligne sans rien écrire ; Entrée envoie le formulaire, les notes avec leur saut de ligne', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const fiche = await ouvrirFormulaire(m, 3);
    // Le focus que « Modifier » pose au nom d'abord, puis aux notes.
    await attendre(() => expect(document.activeElement).toBe(champ(fiche, 'nom')));
    const notes = champ(fiche, 'notes');
    notes.focus();
    remplir(notes, 'Arrive tard');
    notes.setSelectionRange(notes.value.length, notes.value.length);
    await touche('Enter', { maj: true });
    for (const lettre of 'noix') await touche(lettre);
    flushSync();
    expect(champ(ficheDe(m, 3), 'notes').value).toBe('Arrive tard\nnoix');
    expect(formulaire(ficheDe(m, 3))).not.toBeNull();
    expect(executer).not.toHaveBeenCalled();
    await touche('Enter');
    await attendre(() => expect(personneDe(m, 3).notes).toBe('Arrive tard\nnoix'));
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer).toHaveBeenCalledWith('modifierParticipant', { id: 3, champs: { notes: 'Arrive tard\nnoix' } });
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    expect(libelles(m)).toHaveLength(1);
  });

  test('un refus de la séance à l’envoi — le plan bloqué pendant la saisie — se pose sous « Enregistrer », avec son remède, hors du nom ; le formulaire reste ouvert avec la saisie, rien ne s’écrit', async () => {
    const lue = generee(chargeDouze());
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[0].id });
    const { m } = await ouvrirFiche(structuredClone(retenue), 3);
    const fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'prenom'), 'Ondine-Rose');
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    const ecritures = m.trace.length;
    enregistrer(ficheDe(m, 3)).click();
    const refus = await attendre(() => {
      const trouve = formulaire(ficheDe(m, 3)).querySelector('[data-refus]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    // Le refus de la séance sur un plan bloqué, et son remède, « Débloquer ».
    expect(refus.dataset.refus).toBe(m.seance.etat().refus.code);
    expect(refus.dataset.refus).not.toBe('NOM_REQUIS');
    expect(texteDe(refus.querySelector('button'))).toBe(tEcran('communs.remede.debloquer'));
    expect(enregistrer(ficheDe(m, 3)).compareDocumentPosition(refus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const nom = champ(ficheDe(m, 3), 'nom');
    expect(nom.hasAttribute('aria-invalid')).toBe(false);
    expect(nom.hasAttribute('aria-describedby')).toBe(false);
    expect(champ(ficheDe(m, 3), 'prenom').value).toBe('Ondine-Rose');
    expect(m.trace.length).toBe(ecritures);
    expect(personneDe(m, 3).prenom).toBe('Ondine');
  });

  test('« Annuler » et Échap referment sans rien écrire et rendent le focus à « Modifier » ; une saisie tient le geste, que la fermeture rend', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const trace = m.trace.length;
    let fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'courriel'), 'ondine@exemple.invalid');
    expect(m.seance.gesteEnCours).toBe(true);
    annuler(fiche).click();
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    await attendre(() => expect(document.activeElement).toBe(modifier(ficheDe(m, 3))));
    expect(m.seance.gesteEnCours).toBe(false);
    expect(valeurs(ficheDe(m, 3))[3][1]).toBe('\u{2014}');

    fiche = await ouvrirFormulaire(m, 3);
    expect(champ(fiche, 'courriel').value).toBe('');
    remplir(champ(fiche, 'notes'), 'végétarienne');
    champ(fiche, 'notes').focus();
    await touche('Escape');
    await attendre(() => expect(formulaire(ficheDe(m, 3))).toBeNull());
    await attendre(() => expect(document.activeElement).toBe(modifier(ficheDe(m, 3))));
    expect(executer).not.toHaveBeenCalled();
    expect(m.trace.length).toBe(trace);
    expect(m.seance.gesteEnCours).toBe(false);
  });

  test('le nom vidé : NOM_REQUIS se pose contre le nom, qu’il décrit, le formulaire reste ouvert avec la saisie ; une frappe retire le refus', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const trace = m.trace.length;
    const fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'nom'), '   ');
    remplir(champ(fiche, 'prenom'), 'Ondine-Rose');
    enregistrer(fiche).click();
    const refus = await attendre(() => {
      const trouve = formulaire(ficheDe(m, 3)).querySelector('[data-refus="NOM_REQUIS"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    const nom = champ(ficheDe(m, 3), 'nom');
    expect(nom.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(nom.getAttribute('aria-describedby'))).toBe(refus);
    expect(nom.compareDocumentPosition(refus) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(refus.compareDocumentPosition(champ(ficheDe(m, 3), 'prenom')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(champ(ficheDe(m, 3), 'prenom').value).toBe('Ondine-Rose');
    expect(m.trace.length).toBe(trace);
    expect(personneDe(m, 3).prenom).toBe('Ondine');
    remplir(nom, 'L');
    expect(formulaire(ficheDe(m, 3)).querySelector('[data-refus]')).toBeNull();
    expect(nom.hasAttribute('aria-invalid')).toBe(false);
  });

  test('une organisation qui ne diffère d’une autre que par la casse et les blancs s’enregistre sous son orthographe, et le signal le dit sous le bloc ; Défaire le retire', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'organisation'), ' atelier  ressac ');
    enregistrer(fiche).click();
    await attendre(() => expect(personneDe(m, 3).organisation).toBe('Atelier Ressac'));
    expect(executer).toHaveBeenCalledWith('modifierParticipant', { id: 3, champs: { organisation: 'Atelier Ressac' } });
    const signal = await attendre(() => {
      const trouve = bloc(ficheDe(m, 3)).querySelector('[data-avertissement="ORTHOGRAPHE_RETENUE"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(signal.getAttribute('role')).toBe('status');
    expect(signal.querySelector('p').textContent).toBe(tEcran('ORTHOGRAPHE_RETENUE', { saisie: 'atelier  ressac', retenue: 'Atelier Ressac' }));
    expect(modifier(ficheDe(m, 3)).getAttribute('aria-describedby')).toBe(null);
    await m.seance.defaire();
    await attendre(() => expect(bloc(ficheDe(m, 3)).querySelector('[data-avertissement]')).toBeNull());
    expect(personneDe(m, 3).organisation).toBe('Coopérative Aubier');
  });

  test('la dernière personne d’une organisation en change : la liste qui la nommait suit, et l’avis le dit sous le bloc', async () => {
    const { m } = await ouvrirFiche(chargeConflit(), 12);
    const fiche = await ouvrirFormulaire(m, 12);
    remplir(champ(fiche, 'organisation'), 'Club des Grives');
    enregistrer(fiche).click();
    await attendre(() => expect(personneDe(m, 3).conflits).toEqual(['Club des Grives']));
    expect(libelles(m).at(-1)).toBe(
      'Modifié Ysaline Fougeraie : organisation ; « Club des Merles » devient « Club des Grives » dans les conflits',
    );
    const avis = await attendre(() => {
      const trouve = bloc(ficheDe(m, 12)).querySelector('[data-avertissement="conflitsSuivis"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(avis.getAttribute('role')).toBe('status');
    expect(avis.querySelector('p').textContent).toBe(
      tEcran('participants.informations.conflitsSuivis', { renommee: { de: 'Club des Merles', vers: 'Club des Grives' }, retirees: [], propres: 0 }),
    );
    // Une autre personne : l'avis ne la suit pas.
    m.ui.ouvrirFiche(3);
    await attendre(() => expect(ficheDe(m, 3)).not.toBeNull());
    expect(bloc(ficheDe(m, 3)).querySelector('[data-avertissement]')).toBeNull();
  });

  test('en lecture, et sur un plan bloqué en écriture comme en lecture : « Modifier » refuse à côté du bouton, avec son remède, sans ouvrir le formulaire ni rien écrire', async () => {
    const { m, fiche } = await ouvrirFiche(chargeDouze(), 3, { mode: 'lecture' });
    const trace = m.trace.length;
    modifier(fiche).click();
    const refus = await attendre(() => {
      const trouve = bloc(ficheDe(m, 3)).querySelector('[data-refus="MODE_LECTURE"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(refus.querySelector('button')).not.toBeNull();
    expect(document.getElementById(modifier(ficheDe(m, 3)).getAttribute('aria-describedby'))).toBe(refus);
    expect(formulaire(ficheDe(m, 3))).toBeNull();
    expect(m.trace.length).toBe(trace);

    const lue = generee(chargeDouze());
    const retenue = executer(lue, 'retenirProposition', { id: lue.propositions[0].id });
    for (const mode of ['ecriture', 'lecture']) {
      const depart = mode === 'ecriture' ? retenue : executer(retenue, 'changerEtat', { etat: 'bloque' });
      const { m: bloque } = await ouvrirFiche(structuredClone(depart), 3, { mode });
      if (mode === 'ecriture') await bloque.seance.executer('changerEtat', { etat: 'bloque' });
      const ecritures = bloque.trace.length;
      await attendre(() => expect(modifier(ficheDe(bloque, 3))).not.toBeNull());
      modifier(ficheDe(bloque, 3)).click();
      const refusBloque = await attendre(() => {
        const trouve = bloc(ficheDe(bloque, 3)).querySelector('[data-refus]');
        expect(trouve).not.toBeNull();
        return trouve;
      });
      expect(refusBloque.dataset.refus, mode).toBe(bloque.seance.etat().refus.code);
      expect(refusBloque.querySelector('button'), mode).not.toBeNull();
      expect(formulaire(ficheDe(bloque, 3)), mode).toBeNull();
      expect(bloque.trace.length, mode).toBe(ecritures);
    }
  });

  test('la fiche ouverte sur une autre personne pendant la saisie : le formulaire se referme sans écrire, le geste rendu ; revenir montre le bloc en lecture', async () => {
    const { m } = await ouvrirFiche(chargeDouze(), 3);
    const executer = vi.spyOn(m.seance, 'executer');
    const trace = m.trace.length;
    const fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'nom'), 'Lacasse-Varech');
    expect(m.seance.gesteEnCours).toBe(true);
    m.ui.ouvrirFiche(4);
    const quatre = await attendre(() => {
      const trouvee = ficheDe(m, 4);
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(formulaire(quatre)).toBeNull();
    expect(valeurs(quatre)[0][1]).toBe('Tourteau');
    await attendre(() => expect(m.seance.gesteEnCours).toBe(false));
    m.ui.ouvrirFiche(3);
    const trois = await attendre(() => {
      const trouvee = ficheDe(m, 3);
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    expect(formulaire(trois)).toBeNull();
    expect(valeurs(trois)[0][1]).toBe('Lacasse');
    expect(executer).not.toHaveBeenCalled();
    expect(m.trace.length).toBe(trace);
  });

  test('les conflits restent atteignables pendant la saisie : « Appliquer » écrit sa propre entrée, le formulaire reste ouvert avec la saisie', async () => {
    const charge = chargeDouze();
    charge.participants[11].organisation = 'Club des Merles';
    const { m } = await ouvrirFiche(charge, 3);
    const fiche = await ouvrirFormulaire(m, 3);
    remplir(champ(fiche, 'prenom'), 'Ondine-Rose');
    const conflits = fiche.querySelector('[data-conflits-fiche]');
    conflits.querySelectorAll('[data-choix]')[1].click();
    flushSync();
    conflits.querySelector('[data-commande="appliquerConflits"]').click();
    await attendre(() => expect(personneDe(m, 3).conflits).toEqual(['Club des Merles']));
    expect(formulaire(ficheDe(m, 3))).not.toBeNull();
    expect(champ(ficheDe(m, 3), 'prenom').value).toBe('Ondine-Rose');
    expect(libelles(m)).toHaveLength(0);
  });
});
