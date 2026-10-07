// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La section de la génération dans un vrai moteur de rendu (§ 5.7, § 5.9,
// § 5.10, § 2.1 étape 9 et « ce qui doit avoir eu lieu », § 15.4, § 8.4,
// § 9) : ses réglages, leur libellé et leur unité ; la graine, saisie de la
// commande ; le travailleur, qui rend ce que rend rechercher ; l'application
// vivante pendant le calcul ; l'annulation ; les refus posés à côté de
// « Générer » avec leur remède ; la durée observée ; la génération longue,
// annoncée en place.
//
// Chaque épreuve monte App par monterApp, sur le système de fichiers
// simulé, et nomme son exécuteur : le travailleur — inclus en ligne comme
// src/main.js l'inclut — pour un calcul hors du fil ; un exécuteur que
// l'épreuve résout à la main quand l'horloge pilotée doit avancer pendant
// le calcul ; le direct ailleurs, compté. L'épreuve lit le rendu par les
// attributs data-… du contrat, et ce que la séance a écrit : la révision, le
// journal, l'état sur le disque, le relevé des écritures. Le texte attendu
// vient de la même traduction que celle de l'application ; les noms
// d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { creerExecuteurTravailleur } from '../../application/executeur_travailleur.js';
import { ErreurAnnulee, creerExecuteurDirect } from '../../application/generation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Travailleur from './travailleur.js?worker&inline';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Les champs de la section, dans l'ordre de l'écran.
const CHAMPS = ['graine', 'generation.nombre', 'generation.arret', 'generation.historique'];

// Les montages de l'épreuve, démontés après elle ; le collecteur d'erreurs
// n'a rien reçu pendant l'épreuve.
let montes = [];
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
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

// --- Les exécuteurs ---------------------------------------------------------------

// L'exécuteur du travailleur, celui de src/main.js ; travailleurs compte les
// travailleurs créés.
function executeurTravailleur() {
  const suivi = { travailleurs: 0 };
  const executeur = creerExecuteurTravailleur(() => {
    suivi.travailleurs += 1;
    return new Travailleur();
  });
  return { executeur, suivi };
}

// Un exécuteur dont chaque lancer est relevé : configuration, reglages, et
// ce que rend son résultat. lancements en garde la liste.
function releve(base) {
  const lancements = [];
  const executeur = {
    lancer(configuration, reglages) {
      const execution = base.lancer(configuration, reglages);
      const lancement = { configuration, reglages, propositions: null };
      lancements.push(lancement);
      execution.resultat.then(
        (propositions) => {
          lancement.propositions = propositions;
        },
        () => undefined,
      );
      return execution;
    },
  };
  return { executeur, lancements };
}

// Un exécuteur que l'épreuve résout à la main : chaque lancer est relevé,
// avec resoudre(propositions), avancer(fait, total) et annulee.
function executeurAMain() {
  const executions = [];
  const executeur = {
    lancer(configuration, reglages) {
      const abonnes = new Set();
      let resoudre;
      let rejeter;
      const resultat = new Promise((ok, ko) => {
        resoudre = ok;
        rejeter = ko;
      });
      const execution = {
        configuration,
        reglages,
        resoudre,
        annulee: false,
        avancer: (fait, total) => {
          for (const fn of [...abonnes]) fn(fait, total);
        },
      };
      executions.push(execution);
      return {
        surAvancement(fn) {
          abonnes.add(fn);
          return () => abonnes.delete(fn);
        },
        resultat,
        annuler() {
          execution.annulee = true;
          rejeter(new ErreurAnnulee());
        },
      };
    },
  };
  return { executeur, executions };
}

// --- Les lectures du rendu ----------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const section = (m) => dans(m, '[data-section="generation"]');
const champ = (m, cle) => section(m).querySelector(`input[data-champ="${cle}"]`);
const etiquette = (m, cle) => section(m).querySelector(`label[for="${champ(m, cle).id}"]`);
const generer = (m) => section(m).querySelector('[data-commande="generer"]');
const refusPres = (element, code) => element.parentElement.querySelector(`[data-refus="${code}"]`);
const fenetre = () => document.querySelector('dialog[open]');
const duree = (m) => section(m).querySelector('[data-duree]');
const question = (m) => section(m).querySelector('[data-question="longue"]');
const barre = (m) => section(m)?.querySelector('[data-avancement] [role="progressbar"]') ?? null;

const tous = (m, selecteur) => [...m.racine.querySelectorAll(selecteur)];
const versSection = (m, cible) => dans(m, `[data-commande="section"][data-cible="${cible}"]`);

// La signature de ce que le plan montre : la tête de chaque ligne des
// listes — son rang et ce qui l'occupe, sans le nom, que la largeur mesurée
// abrège —, puis les marques de chaque chaise.
const montre = (m) => ({
  listes: tous(m, '[data-liste]').map((liste) =>
    [...liste.querySelectorAll('[data-partie="tete"]')].map((tete) => tete.textContent),
  ),
  marques: tous(m, '[data-siege]').map((chaise) => [
    chaise.getAttribute('data-siege'),
    [...chaise.querySelectorAll('[data-marque]')].map((marque) => marque.getAttribute('data-marque')),
  ]),
});

// Choisit le tour r dans le sélecteur de la barre de vue du plan.
function choisirTour(m, r) {
  const select = dans(m, '[data-section="plan"] [data-champ="tour"]');
  expect(select, 'sélecteur de tour').not.toBeNull();
  select.value = String(r);
  select.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
}

// Cadre le plan sur ses tables, puis le rapproche, un zoom après l'autre,
// jusqu'à ce que les listes de noms et les chaises paraissent : elles ne se
// rendent qu'au-delà d'un zoom. Partie du même cadrage, la vue atteinte est
// la même à chaque appel.
async function cadrerPourLesListes(m) {
  const commande = (nom) => dans(m, `[data-section="plan"] [data-commande="${nom}"]`);
  commande('ajuster').click();
  flushSync();
  await images(2);
  for (let cran = 0; tous(m, '[data-liste]').length === 0 || tous(m, '[data-siege]').length === 0; cran += 1) {
    expect(cran, 'zooms avant les listes et les chaises').toBeLessThan(30);
    commande('zoomer').click();
    flushSync();
    await images(2);
  }
}

const charge = (m) => m.seance.etat().charge;
const revision = (m) => m.seance.etat().evenement.revision;
const controleur = (m) => m.app.generation();
const baseDe = (m) => m.seance.etat().evenement.base;
const etatSurDisque = (m) => m.fs.contenu('documents', `${baseDe(m)}${SUFFIXES.etat}`);
const journalDe = (m) => lireJournal(m.fs.contenu('documents', `${baseDe(m)}${SUFFIXES.journal}`));

// Attend que l'assertion passe, le rendu de Svelte à jour, image après image ;
// images borne l'attente.
async function attendre(assertion, images = 1200) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= images) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// Laisse passer n images.
async function images(n) {
  for (let i = 0; i < n; i += 1) await new Promise((resoudre) => requestAnimationFrame(resoudre));
}

// Attend que la file de la séance ait passé ce qui s'y trouve, par une
// lecture admise dans tout mode qui n'écrit rien, puis le rendu.
async function passer(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  await images(1);
  flushSync();
}

// Un clic réel au centre de l'élément, puis la file de la séance passée.
async function cliquer(m, element) {
  expect(element, 'élément à cliquer').not.toBeNull();
  element.scrollIntoView({ block: 'center' });
  const { left, top, width, height } = element.getBoundingClientRect();
  await pointer('presser', left + width / 2, top + height / 2);
  await pointer('relacher', left + width / 2, top + height / 2);
  await passer(m);
}

// Saisit texte dans le champ, la valeur courante remplacée, puis le quitte
// par Tab, ou le valide par Entrée.
async function saisir(m, entree, texte, { fin = 'Tab' } = {}) {
  await cliquer(m, entree);
  entree.select();
  for (const caractere of texte) await touche(caractere);
  if (fin !== null) await touche(fin);
  await passer(m);
}

// Vrai tant que le contrôleur publie une génération en cours.
function enCours(m) {
  let lu;
  controleur(m).subscribe((etat) => {
    lu = etat;
  })();
  return lu.enCours;
}

// --- Les événements d'épreuve -----------------------------------------------------

// Un montage sur l'exécuteur donné, où la démonstration cle est chargée,
// en écriture sauf ecriture faux, la section de la génération ouverte.
async function demonstration(cle, { executeur, ecriture = true } = {}) {
  const m = await monter({ executeur });
  await m.facade.chargerDemonstration(cle);
  if (ecriture) await m.seance.passerEnEcriture();
  m.ui.allerA('generation');
  flushSync();
  return m;
}

// Les réglages de génération de la charge changés par la séance.
async function regler(m, reglages) {
  for (const [cle, valeur] of Object.entries(reglages)) {
    await m.seance.executer('modifierReglage', { cle: `generation.${cle}`, valeur });
  }
  flushSync();
}

// --- Les épreuves -----------------------------------------------------------------

describe('les réglages (§ 5.7, § 5.10)', () => {
  test('exécuteur direct : quatre champs, chacun son libellé et son unité ; l’historique pré-rempli à 1 000 ; aucun champ de durée', async () => {
    const m = await demonstration('petite', { executeur: creerExecuteurDirect() });
    const entrees = [...section(m).querySelectorAll('input')];
    expect(entrees.length).toBe(4);
    expect(entrees.map((entree) => entree.dataset.champ)).toEqual(CHAMPS);
    for (const cle of CHAMPS) {
      const cleLibelle = `generation.reglage.${cle.replace('generation.', '')}`;
      expect(etiquette(m, cle).textContent).toBe(t(cleLibelle));
    }
    expect(t('generation.reglage.arret')).toContain('mouvements évalués par proposition');
    expect(t('generation.reglage.nombre')).toContain('propositions');
    expect(t('generation.reglage.historique')).toContain('mouvements');
    expect(t('generation.reglage.graine')).toContain('entier');
    expect(champ(m, 'generation.historique').value).toBe('1000');
    expect(champ(m, 'generation.nombre').value).toBe('5');
    expect(champ(m, 'generation.arret').value).toBe('200000');
    for (const entree of entrees) {
      expect(etiquette(m, entree.dataset.champ).textContent).not.toMatch(/durée|seconde|minute/i);
    }
  });

  test('exécuteur direct : changer chaque réglage et quitter le champ — une entrée, ce réglage de la charge changé, les deux autres non', async () => {
    const m = await demonstration('petite', { executeur: creerExecuteurDirect() });
    // Chaque réglage de la charge, et une valeur neuve, distincte de celle
    // de la démonstration.
    const saisies = { nombre: 3, arret: 40000, historique: 500 };
    const noms = Object.keys(saisies);
    expect(noms.length).toBe(3);
    for (const nom of noms) {
      const avant = { ...charge(m).reglages.generation };
      expect(avant[nom], nom).not.toBe(saisies[nom]);
      const r0 = revision(m);
      const entrees = journalDe(m).entrees.length;
      await saisir(m, champ(m, `generation.${nom}`), String(saisies[nom]));
      expect(revision(m), nom).toBe(r0 + 1);
      expect(journalDe(m).entrees.length, nom).toBe(entrees + 1);
      expect(charge(m).reglages.generation, nom).toEqual({ ...avant, [nom]: saisies[nom] });
      expect(champ(m, `generation.${nom}`).value, nom).toBe(String(saisies[nom]));
    }
  });

  test('exécuteur direct : en lecture, la frappe dans un réglage est refusée avec « Modifier » ; la graine se saisit sans rien écrire', async () => {
    const m = await demonstration('petite', { executeur: creerExecuteurDirect(), ecriture: false });
    const ecritures = m.trace.length;
    const arret = champ(m, 'generation.arret');
    await saisir(m, arret, '9', { fin: null });
    expect(arret.value).toBe('200000');
    const refus = refusPres(arret, 'MODE_LECTURE');
    expect(refus).not.toBeNull();
    expect(refus.querySelector('[data-commande="modifier"]').textContent).toBe(t('communs.remede.modifier'));
    await touche('Escape');
    await saisir(m, champ(m, 'graine'), '77');
    expect(champ(m, 'graine').value).toBe('77');
    expect(champ(m, 'graine').parentElement.querySelector('[data-refus]')).toBeNull();
    expect(m.trace.length).toBe(ecritures);
    expect(fenetre()).toBeNull();
  });

  test('exécuteur direct, relevé : la graine vaut 1 à l’ouverture, 2 après une génération lancée à 1', async () => {
    const { executeur, lancements } = releve(creerExecuteurDirect());
    const m = await demonstration('petite', { executeur });
    await regler(m, { nombre: 2, arret: 2000 });
    expect(champ(m, 'graine').value).toBe('1');
    await cliquer(m, generer(m));
    await attendre(() => expect(charge(m).propositions.length).toBe(2));
    expect(lancements.map(({ reglages }) => reglages.graine)).toEqual([1]);
    await attendre(() => expect(champ(m, 'graine').value).toBe('2'));
  });

  test('exécuteur direct, relevé : graine -1, 1,5 ou 2^32 — refus sur le champ, rien n’est lancé ni écrit', async () => {
    const { executeur, lancements } = releve(creerExecuteurDirect());
    const m = await demonstration('petite', { executeur });
    const ecritures = m.trace.length;
    const saisies = ['-1', '1,5', String(2 ** 32)];
    expect(saisies.length).toBe(3);
    for (const saisie of saisies) {
      const attendu = controleur(m).valider({ ...controleur(m).reglagesProposes(), graine: saisie }).refus;
      expect(attendu.map(({ champ: nom }) => nom)).toEqual(['graine']);
      await saisir(m, champ(m, 'graine'), saisie);
      await cliquer(m, generer(m));
      const graine = champ(m, 'graine');
      const refus = refusPres(graine, attendu[0].code);
      expect(refus, saisie).not.toBeNull();
      expect(refus.querySelector('p').textContent).toBe(t(attendu[0].code, attendu[0].details));
      expect(graine.getAttribute('aria-invalid')).toBe('true');
      expect(generer(m).parentElement.querySelector('[data-refus]')).toBeNull();
    }
    expect(lancements).toEqual([]);
    expect(charge(m).propositions).toEqual([]);
    expect(m.trace.length).toBe(ecritures);
    expect(fenetre()).toBeNull();
  });
});

describe('le travailleur (§ 5.7, § 5.10, § 15.5)', () => {
  test('exécuteur du travailleur : petite démonstration, graine écrite — plans, graines dérivées et identifiants égaux à rechercher appelé ici', async () => {
    const { executeur: travailleur, suivi } = executeurTravailleur();
    const { executeur, lancements } = releve(travailleur);
    const m = await demonstration('petite', { executeur });
    await regler(m, { nombre: 3, arret: 20000 });
    const configuration = configurationDepuisCharge(charge(m));
    await saisir(m, champ(m, 'graine'), '4242');
    await cliquer(m, generer(m));
    await attendre(() => expect(lancements[0]?.propositions ?? null).not.toBeNull());
    expect(suivi.travailleurs).toBe(1);
    const reglages = { graine: 4242, nombre: 3, arret: 20000, historique: 1000 };
    expect(lancements[0].reglages).toEqual(reglages);
    const attendues = rechercher(configuration, reglages);
    expect(attendues.length).toBe(3);
    expect(lancements[0].propositions).toEqual(attendues);
    await attendre(() => expect(charge(m).propositions.length).toBe(3));
    expect(charge(m).propositions.map(({ graine }) => graine)).toEqual(attendues.map(({ graine }) => graine));
  }, 60_000);

  test('exécuteur du travailleur : grande démonstration, compte élevé — pendant le calcul, la navigation et le changement du tour affiché mettent le DOM à jour ; l’avancement croît, aria-busy suit le calcul', async () => {
    const { executeur } = executeurTravailleur();
    const m = await demonstration('grande', { executeur });
    await regler(m, { nombre: 4, arret: 400000 });
    // Une réservation du seul tour 1, à un siège : une marque et une ligne
    // qui ne paraissent qu'à ce tour. Le plan de chaque tour est relevé
    // avant le calcul.
    const { participants, reservations } = charge(m);
    const libre = participants.find(({ id }) => !reservations.some(({ participant }) => participant === id));
    await m.seance.executer('reserver', { participant: libre.id, table: 1, siege: 2, portee: 'tour', tour: 1 });
    await cliquer(m, versSection(m, 'plan'));
    await cadrerPourLesListes(m);
    choisirTour(m, 1);
    await images(2);
    const tour1 = montre(m);
    choisirTour(m, 2);
    await images(2);
    const tour2 = montre(m);
    expect(tour1.listes.length).toBeGreaterThan(0);
    expect(tour1.marques.length).toBeGreaterThan(0);
    expect(tour2.listes).not.toEqual(tour1.listes);
    choisirTour(m, 1);
    await cliquer(m, versSection(m, 'generation'));

    expect(section(m).getAttribute('aria-busy')).toBe('false');
    await cliquer(m, generer(m));
    await attendre(() => expect(Number(barre(m)?.getAttribute('aria-valuenow') ?? 0)).toBeGreaterThan(0));
    expect(section(m).getAttribute('aria-busy')).toBe('true');
    const valeurs = [Number(barre(m).getAttribute('aria-valuenow'))];

    // Un geste de navigation pendant le calcul : le DOM change avant la fin.
    await cliquer(m, versSection(m, 'participants'));
    expect(dans(m, '[data-section="participants"]')).not.toBeNull();
    expect(section(m)).toBeNull();
    expect(enCours(m)).toBe(true);

    // Le plan pendant le calcul : il montre le tour 1, puis, le tour
    // changé, les listes et les marques du tour 2, le calcul toujours en
    // cours.
    await cliquer(m, versSection(m, 'plan'));
    await cadrerPourLesListes(m);
    await attendre(() => expect(montre(m)).toEqual(tour1));
    choisirTour(m, 2);
    await attendre(() => expect(montre(m)).toEqual(tour2));
    expect(m.ui.etat().tour).toBe(2);
    expect(enCours(m)).toBe(true);

    await cliquer(m, versSection(m, 'generation'));
    expect(section(m).getAttribute('aria-busy')).toBe('true');

    while (enCours(m)) {
      const lue = barre(m)?.getAttribute('aria-valuenow');
      if (lue !== undefined && Number(lue) !== valeurs.at(-1)) valeurs.push(Number(lue));
      await images(1);
    }
    expect(valeurs.length).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < valeurs.length; i += 1) expect(valeurs[i]).toBeGreaterThan(valeurs[i - 1]);
    await attendre(() => expect(section(m).getAttribute('aria-busy')).toBe('false'));
    expect(barre(m)).toBeNull();
    await attendre(() => expect(charge(m).propositions.length).toBeGreaterThan(0));
  }, 120_000);

  test('exécuteur du travailleur : annuler est immédiat ; plus aucun avancement ; l’état prêt revient ; propositions, journal et état sur le disque inchangés', async () => {
    const { executeur } = executeurTravailleur();
    const m = await demonstration('grande', { executeur });
    await regler(m, { nombre: 4, arret: 400000 });
    const avant = { propositions: charge(m).propositions, journal: journalDe(m), etat: etatSurDisque(m) };
    await cliquer(m, generer(m));
    await attendre(() => expect(Number(barre(m)?.getAttribute('aria-valuenow') ?? 0)).toBeGreaterThan(0));
    const recus = [];
    const desabonner = controleur(m).subscribe(({ fait }) => recus.push(fait));
    await cliquer(m, section(m).querySelector('[data-avancement] [data-commande="annuler"]'));
    expect(enCours(m)).toBe(false);
    expect(section(m).getAttribute('aria-busy')).toBe('false');
    expect(barre(m)).toBeNull();
    expect(generer(m)).not.toBeNull();
    const apresAnnulation = recus.length;
    await images(30);
    expect(recus.length).toBe(apresAnnulation);
    desabonner();
    expect(charge(m).propositions).toEqual(avant.propositions);
    expect(journalDe(m)).toEqual(avant.journal);
    expect(etatSurDisque(m)).toBe(avant.etat);
    expect(fenetre()).toBeNull();
  }, 60_000);
});

describe('les refus à la commande (§ 5.9, § 15.4, § 9)', () => {
  test('exécuteur direct, relevé : 13 participants, 4 tables de 3 — PLACES_MANQUANTES {placesManquantes: 1} près de « Générer », remède vers les tables ; rien de lancé ni d’écrit', async () => {
    const { executeur, lancements } = releve(creerExecuteurDirect());
    const m = await demonstration('petite', { executeur });
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } });
    flushSync();
    expect(charge(m).participants.length).toBe(13);
    expect(charge(m).tables.length).toBe(4);
    const r0 = revision(m);
    const ecritures = m.trace.length;
    await cliquer(m, generer(m));
    const refus = refusPres(generer(m), 'PLACES_MANQUANTES');
    expect(refus).not.toBeNull();
    const message = refus.querySelector('p').textContent;
    expect(message).toBe(t('PLACES_MANQUANTES', { placesManquantes: 1 }));
    expect(message).toContain('1 place');
    const remede = refus.querySelector('[data-commande="ouvrirSection"]');
    expect(remede.textContent).toBe(t('communs.remede.ouvrirSection.tables'));
    expect(fenetre()).toBeNull();
    await cliquer(m, remede);
    expect(m.ui.etat().section).toBe('tables');
    expect(dans(m, '[data-section="tables"]')).not.toBeNull();
    expect(lancements).toEqual([]);
    expect(charge(m).propositions).toEqual([]);
    expect(revision(m)).toBe(r0);
    expect(m.trace.length).toBe(ecritures);
  });

  test('exécuteur direct, relevé : un événement neuf en écriture — AUCUN_PARTICIPANT puis, des participants sans table, AUCUNE_TABLE ; chaque remède ouvre sa section', async () => {
    const { executeur, lancements } = releve(creerExecuteurDirect());
    const m = await monter({ executeur });
    await m.seance.creer({ nom: 'Club des Merles', date: null, siegesParDefaut: 3, tours: 2 });
    await m.seance.passerEnEcriture();
    m.ui.allerA('generation');
    flushSync();
    let ecritures = m.trace.length;
    await cliquer(m, generer(m));
    const sansPersonne = refusPres(generer(m), 'AUCUN_PARTICIPANT');
    expect(sansPersonne).not.toBeNull();
    expect(sansPersonne.querySelector('p').textContent).toBe(t('AUCUN_PARTICIPANT', {}));
    expect(fenetre()).toBeNull();
    expect(m.trace.length).toBe(ecritures);
    await cliquer(m, sansPersonne.querySelector('[data-commande="ouvrirSection"]'));
    expect(m.ui.etat().section).toBe('participants');
    expect(dans(m, '[data-section="participants"]')).not.toBeNull();

    for (const nom of ['Pervenche', 'Lacasse']) await m.seance.executer('ajouterParticipant', { champs: { nom } });
    m.ui.allerA('generation');
    flushSync();
    ecritures = m.trace.length;
    await cliquer(m, generer(m));
    const sansTable = refusPres(generer(m), 'AUCUNE_TABLE');
    expect(sansTable).not.toBeNull();
    expect(sansTable.querySelector('p').textContent).toBe(t('AUCUNE_TABLE', {}));
    expect(fenetre()).toBeNull();
    expect(m.trace.length).toBe(ecritures);
    await cliquer(m, sansTable.querySelector('[data-commande="ouvrirSection"]'));
    expect(m.ui.etat().section).toBe('tables');
    expect(dans(m, '[data-section="tables"]')).not.toBeNull();
    expect(lancements).toEqual([]);
  });

  test('exécuteur direct, relevé : en lecture, « Générer » refusé à côté de lui avec « Modifier » ; sur un plan bloqué, avec « Débloquer » ; aucune fenêtre', async () => {
    const { executeur, lancements } = releve(creerExecuteurDirect());
    const m = await demonstration('petite', { executeur, ecriture: false });
    const ecritures = m.trace.length;
    await cliquer(m, generer(m));
    const lecture = refusPres(generer(m), 'MODE_LECTURE');
    expect(lecture).not.toBeNull();
    expect(lecture.querySelector('[data-commande="modifier"]').textContent).toBe(t('communs.remede.modifier'));
    expect(fenetre()).toBeNull();
    expect(m.trace.length).toBe(ecritures);

    await m.seance.passerEnEcriture();
    const configuration = configurationDepuisCharge(charge(m));
    const propositions = rechercher(configuration, { graine: 7, nombre: 1, arret: 2000 });
    await m.seance.executer('enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee });
    await m.seance.executer('retenirProposition', { id: charge(m).propositions[0].id });
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    flushSync();
    const ecrituresBloque = m.trace.length;
    await cliquer(m, generer(m));
    const bloque = refusPres(generer(m), 'LECTURE_SEULE');
    expect(bloque).not.toBeNull();
    expect(bloque.querySelector('p').textContent).toBe(t('LECTURE_SEULE', m.seance.etat().refus.details));
    expect(bloque.querySelector('[data-commande="debloquer"]').textContent).toBe(t('communs.remede.debloquer'));
    expect(fenetre()).toBeNull();
    expect(m.trace.length).toBe(ecrituresBloque);
    expect(lancements).toEqual([]);
  });
});

describe('la durée du calcul (§ 5.10, § 19.4)', () => {
  test('exécuteur résolu à la main : sans mesure, le panneau le dit sans écrire 0 ; 1 800 ms d’horloge pilotée pour 5 × 200 000 mouvements, durée et réglages affichés', async () => {
    const { executeur, executions } = executeurAMain();
    const m = await demonstration('petite', { executeur });
    expect(duree(m).textContent).toBe(t('generation.duree.inconnue'));
    expect(duree(m).textContent).not.toMatch(/\b0\b/);
    await cliquer(m, generer(m));
    expect(executions.length).toBe(1);
    expect(executions[0].reglages).toEqual({ graine: 1, nombre: 5, arret: 200000, historique: 1000 });
    expect(section(m).getAttribute('aria-busy')).toBe('true');
    m.horloge.avancer(1800);
    const propositions = rechercher(executions[0].configuration, { graine: 1, nombre: 5, arret: 2000 });
    executions[0].resoudre(propositions);
    await attendre(() => expect(section(m).getAttribute('aria-busy')).toBe('false'));
    await attendre(() => expect(charge(m).propositions.length).toBe(5));
    const attendu = t('generation.duree.observee', { dureeMs: 1800, nombre: 5, arret: 200000 });
    expect(duree(m).textContent).toBe(attendu);
    expect(attendu).toContain('1,8 s');
    expect(attendu).toContain('5 \u{00D7} 200\u{202F}000');
  });

  test('exécuteur résolu à la main : 10^6 mouvements en 2 s ; 6 × 10^8 annoncés en place, « environ vingt minutes à ce réglage » ; renoncer n’écrit rien, confirmer lance ; sous le seuil, sans question', async () => {
    const { executeur, executions } = executeurAMain();
    const m = await demonstration('petite', { executeur });
    await cliquer(m, generer(m));
    expect(executions.length).toBe(1);
    m.horloge.avancer(2000);
    executions[0].resoudre([]);
    await attendre(() => expect(enCours(m)).toBe(false));
    expect(controleur(m).derniereGeneration()).toMatchObject({ dureeMs: 2000, mouvements: 1_000_000 });

    await saisir(m, champ(m, 'generation.arret'), '120000000');
    expect(charge(m).reglages.generation).toMatchObject({ nombre: 5, arret: 120_000_000 });
    const journal = journalDe(m);
    const ecritures = m.trace.length;
    await cliquer(m, generer(m));
    expect(executions.length).toBe(1);
    expect(question(m)).not.toBeNull();
    expect(question(m).textContent).toContain('environ vingt minutes à ce réglage');
    expect(fenetre()).toBeNull();

    await cliquer(m, question(m).querySelector('[data-commande="renoncerGeneration"]'));
    expect(question(m)).toBeNull();
    expect(executions.length).toBe(1);
    expect(journalDe(m)).toEqual(journal);
    expect(m.trace.length).toBe(ecritures);

    await cliquer(m, generer(m));
    await cliquer(m, question(m).querySelector('[data-commande="confirmerGeneration"]'));
    expect(executions.length).toBe(2);
    expect(executions[1].reglages).toMatchObject({ nombre: 5, arret: 120_000_000 });
    expect(question(m)).toBeNull();
    expect(section(m).getAttribute('aria-busy')).toBe('true');
    await cliquer(m, section(m).querySelector('[data-avancement] [data-commande="annuler"]'));
    expect(executions[1].annulee).toBe(true);
    await attendre(() => expect(enCours(m)).toBe(false));

    await regler(m, { arret: 200000 });
    await cliquer(m, generer(m));
    expect(question(m)).toBeNull();
    expect(executions.length).toBe(3);
    executions[2].resoudre([]);
    await attendre(() => expect(enCours(m)).toBe(false));
  });
});
