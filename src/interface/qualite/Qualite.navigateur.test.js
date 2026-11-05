// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La section de la qualité dans un vrai moteur de rendu (§ 12, B9, D24,
// D25, § 8.4) : la page vit en lecture, en écriture et sur un plan bloqué,
// sans refus ni écriture ; elle mesure la source que le plan montre et la
// nomme sur sa ligne de source ; la commande « Qualité » du tableau des
// propositions l'ouvre sur sa proposition ; les quatre cas sans source
// mesurable ne dessinent aucune vue ; une génération qui retire la
// proposition montrée rend la page au plan ; les onze vues d'attente,
// chacune sous son [data-vue-qualite], et la liste qui mène à chacune ;
// aucune règle d'impression ne la vise. Chaque épreuve monte App par
// monterApp, sur le système de fichiers simulé où un fichier d'état
// d'épreuve est posé puis ouvert, au cadre de 1 366 × 700, et lit le rendu :
// le texte, les attributs data-…, l'élément focalisé — jamais une classe.
// Le texte attendu vient de la même traduction que celle de l'application ;
// les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../application/commandes.js';
import { departDuMoteur } from '../../application/depart.js';
import { evaluer, premiereDuClassement } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher, repartir } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { dessinerGraphiques, fixerCadre } from '../../../test/navigateur/entrees.js';
import { actionDe } from '../../../test/navigateur/menus.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import '../impression.css';
import { TABLES_INTERFACE } from '../libelles.js';
import { sourceQualite } from './source.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;
const BASE = 'soiree';

// Les vues de la page, dans leur ordre à l'écran (§ 12, B9).
const VUES = ['entete', 'profil', 'comparaison', 'collisions', 'tables', 'paires', 'inclusions', 'objectifs', 'animateurs', 'diversite', 'performance'];

// --- Les charges d'épreuve -------------------------------------------------------

// Six personnes inventées, deux organisations, deux tables de trois places,
// deux tours, sans proposition ni retenu.
function chargeSix() {
  const charge = creerCharge({ id: 'evt-qualite', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 2 });
  const noms = [
    ['Ombrelle', 'Iris', 'Coopérative Aubier'],
    ['Pervenche', 'Théo', 'Coopérative Aubier'],
    ['Lacasse', 'Ondine', 'Atelier Ressac'],
    ['Tourteau', 'Basile', 'Atelier Ressac'],
    ['Quenouille', 'Maëlle', null],
    ['Varech', 'Sidonie', null],
  ];
  charge.participants = noms.map(([nom, prenom, organisation], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  return charge;
}

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 3, arret: 40, nombre: 3 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// Une copie de la charge, modifiée en place par change.
function avec(charge, change) {
  const copie = structuredClone(charge);
  change(copie);
  return copie;
}

// La charge générée, une proposition retenue, puis le plan bloqué.
const bloquee = () => {
  const charge = generee(chargeSix());
  return executer(executer(charge, 'retenirProposition', { id: charge.propositions[1].id }), 'changerEtat', { etat: 'bloque' });
};

// --- Le montage --------------------------------------------------------------------

// Les montages de l'épreuve, démontés après elle ; le collecteur d'erreurs
// n'a rien reçu pendant l'épreuve.
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

// Attend que l'assertion passe, le rendu de Svelte à jour.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// La charge posée en fichier d'état, ouverte par la séance — en écriture
// sauf mode 'lecture' —, la section donnée ouverte.
async function ouvrir(charge, { mode = 'ecriture', section = 'qualite' } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  m.ui.allerA(section);
  flushSync();
  return m;
}

// --- Les lectures du rendu ---------------------------------------------------------

const page = (m) => m.racine.querySelector('[data-section="qualite"]');
const commande = (racine, nom) => racine.querySelector(`[data-commande="${nom}"]`);
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const vuesRendues = (m) => [...page(m).querySelectorAll('[data-vue-qualite]')].map((vue) => vue.dataset.vueQualite);
const phrases = (m) => [...page(m).querySelectorAll('[data-phrase-qualite]')].map((p) => p.dataset.phraseQualite);
const ligneDeSource = (m) => texteDe(page(m).querySelector('[data-source-qualite]'));
const attendueDeSource = (cle, details = {}) => `${t('qualite.source.intitule')} ${t(cle, details)}`;
const charge = (m) => m.seance.etat().charge;

// Les règles d'impression des feuilles du document : le texte de chaque
// règle @media print, à toute profondeur.
function reglesImpression() {
  const textes = [];
  const parcourir = (regles) => {
    for (const regle of regles) {
      if (regle instanceof CSSMediaRule && /\bprint\b/.test(regle.conditionText)) textes.push(regle.cssText);
      else if (regle.cssRules !== undefined) parcourir(regle.cssRules);
    }
  };
  for (const feuille of document.styleSheets) parcourir(feuille.cssRules);
  return textes;
}

// --- Les épreuves -----------------------------------------------------------------

describe('la section de la qualité dans la navigation (§ 2.1, D24)', () => {
  test('« Qualité » est le cinquième onglet de la phase Placer, après « Propositions » ; il ouvre la section, titrée', async () => {
    const m = await ouvrir(generee(chargeSix()), { section: 'plan' });
    const onglets = [...m.racine.querySelectorAll('[data-commande="section"]')].map((bouton) => bouton.dataset.cible);
    expect(onglets.indexOf('qualite')).toBe(onglets.indexOf('propositions') + 1);
    const onglet = m.racine.querySelector('[data-commande="section"][data-cible="qualite"]');
    expect(texteDe(onglet)).toBe(t('coquille.section.qualite'));
    const groupe = onglet.closest('[role="group"]');
    expect([...groupe.querySelectorAll('[data-commande="section"]')].map((bouton) => bouton.dataset.cible)).toEqual([
      'plan', 'diagnostic', 'generation', 'propositions', 'qualite',
    ]);
    onglet.click();
    await attendre(() => expect(page(m)).not.toBeNull());
    expect(m.ui.etat().section).toBe('qualite');
    expect(texteDe(page(m).querySelector('h2'))).toBe(t('coquille.section.qualite'));
  });
});

describe('vivante en lecture, en écriture et sur un plan bloqué (§ 8.4, B9)', () => {
  for (const [cas, fabrique, mode] of [
    ['en lecture', () => generee(chargeSix()), 'lecture'],
    ['en écriture', () => generee(chargeSix()), 'ecriture'],
    ['sur un plan bloqué', bloquee, 'lecture'],
  ]) {
    test(`${cas} : la page se lit, ses vues sont là, sans refus ni écriture`, async () => {
      const lue = fabrique();
      const m = await ouvrir(lue, { mode });
      const ecritures = m.trace.length;
      if (lue.retenu === null) {
        commande(page(m), 'montrerPremiere').click();
        flushSync();
      }
      await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
      expect(page(m).querySelector('[data-refus]')).toBeNull();
      for (const lien of page(m).querySelectorAll('nav a')) {
        lien.click();
        flushSync();
      }
      expect(page(m).querySelector('[data-refus]')).toBeNull();
      expect(m.trace.length).toBe(ecritures);
    });
  }
});

describe('la commande « Qualité » du tableau des propositions (§ 12, D25)', () => {
  test('en lecture, puis sur un plan bloqué : elle montre sa proposition au plan et ouvre la page, sans refus ni entrée au journal', async () => {
    for (const [lue, mode] of [
      [generee(chargeSix()), 'lecture'],
      [bloquee(), 'lecture'],
    ]) {
      const m = await ouvrir(lue, { mode, section: 'propositions' });
      const ecritures = m.trace.length;
      const id = lue.propositions[2].id;
      const bouton = actionDe(m.racine.querySelector(`[data-proposition="${id}"]`), 'qualite');
      expect(texteDe(bouton)).toBe(t('propositions.commande.qualite'));
      bouton.click();
      await attendre(() => expect(page(m)).not.toBeNull());
      expect(m.ui.etat().proposition).toBe(id);
      expect(m.racine.querySelector('[data-refus]')).toBeNull();
      const cle = lue.retenu === null ? 'plan.source.propositionReservations' : 'plan.source.propositionVueSeule';
      expect(ligneDeSource(m)).toBe(attendueDeSource(cle, { proposition: id }));
      expect(m.trace.length).toBe(ecritures);
    }
  });

  test('la page s’ouvre sur la source que le plan montre : la ligne de source et la barre de vue du plan nomment la même proposition', async () => {
    const m = await ouvrir(generee(chargeSix()), { section: 'propositions' });
    for (const proposition of charge(m).propositions) {
      m.ui.allerA('propositions');
      flushSync();
      actionDe(m.racine.querySelector(`[data-proposition="${proposition.id}"]`), 'qualite').click();
      await attendre(() => expect(page(m)).not.toBeNull());
      expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.propositionReservations', { proposition: proposition.id }));
      m.ui.allerA('plan');
      await attendre(() => expect(m.racine.querySelector('[data-source]')).not.toBeNull());
      expect(texteDe(m.racine.querySelector('[data-source]'))).toContain(t('plan.source.propositionReservations', { proposition: proposition.id }));
    }
  });

  // Une proposition fautive ne se lit pas d'un fichier, l'ouverture l'écarte :
  // la ligne hors classement qu'une séance porte est en dérive. La source
  // fautive demandée est éprouvée sous node (source.test.js).
  test('« Qualité » sur la ligne hors classement d’une proposition en dérive : la page donne ses raisons, sans retenu comme sous un retenu', async () => {
    const generees = generee(chargeSix());
    const id = generees.propositions[0].id;
    const exclue = (c) => (c.participants[5].exclu = true);
    const retenue = executer(generees, 'retenirProposition', { id: generees.propositions[1].id });
    for (const lue of [avec(generees, exclue), avec(retenue, exclue)]) {
      const m = await ouvrir(lue, { mode: 'lecture', section: 'propositions' });
      const ligne = await attendre(() => {
        const trouvee = m.racine.querySelector(`[data-hors-classement] [data-proposition="${id}"]`);
        expect(trouvee).not.toBeNull();
        return trouvee;
      });
      actionDe(ligne, 'qualite').click();
      await attendre(() => expect(page(m)).not.toBeNull());
      expect(m.ui.etat().proposition).toBe(id);
      expect(phrases(m)).toEqual(['derive']);
      const raisons = evaluer(lue).propositions.find((candidate) => candidate.id === id).raisons;
      expect(raisons.length).toBeGreaterThan(0);
      const textes = [...page(m).querySelectorAll('li')].map(texteDe);
      expect(textes.length).toBe(raisons.length);
      raisons.forEach((raison, rang) => expect(textes[rang]).toContain(t(raison.code, raison)));
      expect(vuesRendues(m)).toEqual([]);
    }
  });

  test('un tour ajouté à l’événement : la page mesure le placement entier, en dérive au tour que la proposition ne porte pas comme au premier', async () => {
    const generees = generee(chargeSix());
    const id = generees.propositions[0].id;
    const lue = executer(generees, 'changerTours', { tours: 3 });
    const m = await ouvrir(lue, { mode: 'lecture', section: 'propositions' });
    const ligne = await attendre(() => {
      const trouvee = m.racine.querySelector(`[data-proposition="${id}"]`);
      expect(trouvee).not.toBeNull();
      return trouvee;
    });
    actionDe(ligne, 'qualite').click();
    await attendre(() => expect(page(m)).not.toBeNull());
    const raisons = evaluer(lue).propositions.find((candidate) => candidate.id === id).raisons;
    expect(raisons.length).toBeGreaterThan(0);
    for (const tour of [1, 3]) {
      m.ui.montrerTour(tour);
      flushSync();
      await attendre(() => expect(phrases(m), String(tour)).toEqual(['derive']));
      expect(ligneDeSource(m), String(tour)).toBe(attendueDeSource('plan.source.propositionReservations', { proposition: id }));
      expect(page(m).querySelectorAll('li').length, String(tour)).toBe(raisons.length);
      expect(vuesRendues(m), String(tour)).toEqual([]);
    }
  });

  test('« Qualité » de la ligne du retenu ouvre la page sur le retenu, même après une proposition montrée', async () => {
    const generees = generee(chargeSix());
    const m = await ouvrir(executer(generees, 'retenirProposition', { id: generees.propositions[0].id }), { section: 'propositions' });
    actionDe(m.racine.querySelector(`[data-proposition="${generees.propositions[1].id}"]`), 'qualite').click();
    await attendre(() => expect(page(m)).not.toBeNull());
    m.ui.allerA('propositions');
    flushSync();
    actionDe(m.racine.querySelector('[data-retenu]'), 'qualite').click();
    await attendre(() => expect(page(m)).not.toBeNull());
    expect(m.ui.etat().proposition).toBe(null);
    expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.retenu'));
    expect(vuesRendues(m)).toEqual(VUES);
  });
});

describe('les quatre cas sans source mesurable (§ 12, § 12.6, B9)', () => {
  test('ni proposition ni retenu : le diagnostic préalable et sa phrase, aucune vue, aucun axe', async () => {
    const m = await ouvrir(chargeSix());
    expect(phrases(m)).toEqual(['aucunPlacement']);
    expect(texteDe(page(m).querySelector('[data-phrase-qualite="aucunPlacement"]'))).toBe(t('qualite.phrase.aucunPlacement'));
    expect(texteDe(page(m))).toContain(t('coquille.section.diagnostic'));
    expect(page(m).querySelector('[data-enonce]')).not.toBeNull();
    expect(ligneDeSource(m)).toBe(attendueDeSource('qualite.source.aucun'));
    expect(vuesRendues(m)).toEqual([]);
    expect(page(m).querySelector('svg, nav')).toBeNull();
  });

  test('des propositions, aucune montrée : la commande montre la première comparable du classement, et la page la mesure', async () => {
    const generees = generee(chargeSix());
    // La première proposition par identifiant est fautive : la commande
    // vise la première comparable du classement, jamais elle.
    const lue = avec(generees, (c) => {
      const [premiere, seconde] = c.propositions[0].placement[0].sieges;
      seconde[0] = premiere[0];
    });
    const premiere = premiereDuClassement(evaluer(lue));
    expect(premiere.id).not.toBe(lue.propositions[0].id);
    expect(sourceQualite(lue).premiere).toBe(premiere.id);
    const m = await ouvrir(lue);
    expect(phrases(m)).toEqual(['aucuneMontree']);
    expect(vuesRendues(m)).toEqual([]);
    const montrer = commande(page(m), 'montrerPremiere');
    expect(texteDe(montrer)).toBe(t('qualite.source.montrerPremiere', { proposition: premiere.id }));
    montrer.click();
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    expect(m.ui.etat().proposition).toBe(premiere.id);
    expect(m.ui.etat().section).toBe('qualite');
    expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.propositionReservations', { proposition: premiere.id }));
  });

  test('des propositions dont aucune ne se compare : la phrase seule, sans commande', async () => {
    const m = await ouvrir(avec(generee(chargeSix()), (c) => (c.participants[5].exclu = true)));
    expect(phrases(m)).toEqual(['aucuneMontree', 'aucuneComparable']);
    expect(commande(page(m), 'montrerPremiere')).toBeNull();
    expect(vuesRendues(m)).toEqual([]);
  });

  test('une source en dérive : ses raisons, comme au tableau des propositions, et aucune vue', async () => {
    const lue = avec(generee(chargeSix()), (c) => (c.participants[5].exclu = true));
    const id = lue.propositions[0].id;
    const m = await ouvrir(lue);
    m.ui.montrerProposition(id);
    flushSync();
    await attendre(() => expect(phrases(m)).toEqual(['derive']));
    const raisons = evaluer(lue).propositions.find((ligne) => ligne.id === id).raisons;
    expect(raisons.length).toBeGreaterThan(0);
    const textes = [...page(m).querySelectorAll('li')].map(texteDe);
    expect(textes.length).toBe(raisons.length);
    raisons.forEach((raison, rang) => expect(textes[rang]).toContain(t(raison.code, raison)));
    expect(vuesRendues(m)).toEqual([]);
  });

  test('un retenu fautif : ses fautes, et la ligne de source dit que le retenu ne se lit pas', async () => {
    const generees = generee(chargeSix());
    const lue = avec(executer(generees, 'retenirProposition', { id: generees.propositions[0].id }), (c) => {
      const [premiere, seconde] = c.retenu.placement[0].sieges;
      seconde[0] = premiere[0];
    });
    const m = await ouvrir(lue, { mode: 'lecture' });
    expect(phrases(m)).toEqual(['fautif']);
    expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.retenuFautif'));
    expect(page(m).querySelectorAll('li').length).toBe(evaluer(lue).retenu.raisons.length);
    expect(vuesRendues(m)).toEqual([]);
  });

  test('une configuration qui ne se normalise pas l’emporte, même sur une proposition montrée : son refus, aucune vue', async () => {
    const lue = avec(generee(chargeSix()), (c) => {
      c.reservations.push(
        { participant: 1, table: 1, siege: null, portee: 'tous', tour: null },
        { participant: 1, table: 2, siege: null, portee: 'tour', tour: 1 },
      );
    });
    const m = await ouvrir(lue);
    m.ui.montrerProposition(lue.propositions[0].id);
    flushSync();
    expect(phrases(m)).toEqual(['configuration']);
    expect(page(m).querySelector('[data-refus]')).not.toBeNull();
    expect(vuesRendues(m)).toEqual([]);
  });
});

describe('une source qui disparaît sous la page ouverte (§ 12, B9)', () => {
  test('une génération qui remplace la proposition montrée : la page suit le plan, qui revient aux réservations ; « Revenir » oublie la demande', async () => {
    const m = await ouvrir(generee(chargeSix()));
    const id = charge(m).propositions[0].id;
    m.ui.montrerProposition(id);
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    await m.seance.executer('effacerPropositions', {});
    const configuration = configurationDepuisCharge(charge(m));
    const propositions = rechercher(configuration, { graine: 11, arret: 40, nombre: 2 });
    await m.seance.executer('enregistrerGeneration', { propositions, configuration, produitVersion: V1 });
    await attendre(() => expect(phrases(m)).toEqual(['aucuneMontree']));
    expect(charge(m).propositions.some((proposition) => proposition.id === id)).toBe(false);
    expect(ligneDeSource(m)).toBe(attendueDeSource('qualite.source.aucun'));
    expect(vuesRendues(m)).toEqual([]);
    const revenir = commande(page(m), 'revenir');
    expect(texteDe(revenir)).toBe(t('plan.source.revenirReservations'));
    revenir.click();
    flushSync();
    expect(m.ui.etat().proposition).toBe(null);
    expect(commande(page(m), 'revenir')).toBeNull();
  });

  test('sous un retenu : la page revient au retenu', async () => {
    const generees = generee(chargeSix());
    const m = await ouvrir(executer(generees, 'retenirProposition', { id: generees.propositions[2].id }));
    m.ui.montrerProposition(generees.propositions[0].id);
    flushSync();
    expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.propositionVueSeule', { proposition: generees.propositions[0].id }));
    await m.seance.executer('effacerPropositions', {});
    await attendre(() => expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.retenu')));
    expect(vuesRendues(m)).toEqual(VUES);
  });
});

describe('les vues d’attente et la liste qui y mène (§ 12, B9, B10)', () => {
  test('les onze vues, dans leur ordre : chacune un <div> [data-vue-qualite] qui enveloppe la carte titrée de sa question', async () => {
    const generees = generee(chargeSix());
    const m = await ouvrir(executer(generees, 'retenirProposition', { id: generees.propositions[0].id }));
    expect(vuesRendues(m)).toEqual(VUES);
    for (const nom of VUES) {
      const vue = page(m).querySelector(`[data-vue-qualite="${nom}"]`);
      expect(vue.tagName, nom).toBe('DIV');
      const carte = vue.querySelector('section');
      expect(carte, nom).not.toBeNull();
      expect(texteDe(carte.querySelector('h3')), nom).toBe(t(`qualite.vue.${nom}.titre`));
      expect(texteDe(carte), nom).toContain(t(`qualite.vue.${nom}.question`));
    }
  });

  test('la liste nomme chaque vue dans son ordre, et chaque lien porte le focus sur sa vue sans changer l’adresse', async () => {
    const generees = generee(chargeSix());
    const m = await ouvrir(executer(generees, 'retenirProposition', { id: generees.propositions[0].id }));
    const adresse = window.location.href;
    const liens = [...page(m).querySelectorAll('nav a')];
    expect(liens.map(texteDe)).toEqual(VUES.map((nom) => t(`qualite.vue.${nom}.titre`)));
    for (const [rang, lien] of liens.entries()) {
      lien.click();
      flushSync();
      expect(document.activeElement.querySelector('[data-vue-qualite]')?.dataset.vueQualite).toBe(VUES[rang]);
    }
    expect(window.location.href).toBe(adresse);
  });
});

describe('le poids de la page à son ouverture (E2s)', () => {
  test('la grande, une proposition : sous 1 500 éléments à l’ouverture, chaque vue posée, les graphiques loin de la zone visible en attente ; amenés, chacun se dessine', async () => {
    const m = await ouvrir(generee(analyser(texteLivre('grande')).charge, { graine: 1, arret: 200_000, nombre: 1 }));
    m.ui.montrerProposition(charge(m).propositions[0].id);
    flushSync();
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    for (let n = 0; n < 3; n += 1) await new Promise((resoudre) => requestAnimationFrame(resoudre));
    const elements = page(m).querySelectorAll('*').length + 1;
    expect(elements).toBeLessThan(1500);
    const graphiques = () => [...page(m).querySelectorAll('svg[data-graphique]')];
    const enAttente = graphiques().filter((svg) => svg.hasAttribute('data-dessin-differe'));
    expect(enAttente.length).toBeGreaterThan(0);
    for (const svg of enAttente) expect(svg.querySelector('[data-marque]')).toBeNull();
    expect(await dessinerGraphiques(page(m))).toBeGreaterThan(0);
    for (const svg of graphiques()) {
      expect(svg.hasAttribute('data-dessin-differe'), svg.dataset.graphique).toBe(false);
      expect(svg.querySelector('[data-marque]'), svg.dataset.graphique).not.toBeNull();
    }
  }, 60_000);
});

describe('le dessin différé ne déplace pas la vue montrée (E2s, B9)', () => {
  const image = () => new Promise((resoudre) => requestAnimationFrame(resoudre));
  // Le plus proche ancêtre de l'élément qui défile à la verticale.
  const defileur = (element) => {
    for (let ancetre = element.parentElement; ancetre !== null; ancetre = ancetre.parentElement) {
      if (['auto', 'scroll'].includes(getComputedStyle(ancetre).overflowY)) return ancetre;
    }
    return document.scrollingElement;
  };

  test('la grande : le lien vers la dernière vue, puis le défilement jusqu’au bas, la posent où la page dessinée entière la pose, et 30 images n’y changent rien', async () => {
    const m = await ouvrir(generee(analyser(texteLivre('grande')).charge, { graine: 1, arret: 200_000, nombre: 1 }));
    m.ui.montrerProposition(charge(m).propositions[0].id);
    flushSync();
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    for (let n = 0; n < 3; n += 1) await image();
    const zone = defileur(page(m));
    const lien = page(m).querySelector('nav a[href$="-vue-performance"]');
    const cible = document.getElementById(lien.getAttribute('href').slice(1));
    const haut = () => cible.getBoundingClientRect().top - zone.getBoundingClientRect().top;
    // Le haut de la vue à chacune des 30 images qui suivent le geste.
    async function suite(geste) {
      geste();
      flushSync();
      const hauts = [haut()];
      for (let n = 0; n < 30; n += 1) {
        await image();
        flushSync();
        hauts.push(haut());
      }
      return hauts;
    }
    const parLeLien = () => suite(() => lien.click());
    const jusquAuBas = () => suite(() => zone.scrollTo(0, zone.scrollHeight));

    expect(page(m).querySelectorAll('svg[data-dessin-differe]').length).toBeGreaterThan(0);
    const lienDiffere = await parLeLien();
    expect(document.activeElement).toBe(cible);
    const basDiffere = await jusquAuBas();
    for (const hauts of [lienDiffere, basDiffere]) {
      expect(new Set(hauts).size, hauts.join(', ')).toBe(1);
      expect(hauts[0]).toBeGreaterThanOrEqual(0);
      expect(hauts[0]).toBeLessThan(zone.clientHeight);
    }

    // La même page, chaque graphique dessiné : les mêmes positions.
    zone.scrollTo(0, 0);
    await dessinerGraphiques(page(m));
    expect(page(m).querySelectorAll('svg[data-dessin-differe]')).toHaveLength(0);
    expect(await parLeLien()).toEqual(lienDiffere);
    expect(await jusquAuBas()).toEqual(basDiffere);
  }, 60_000);
});

describe('la page ne s’imprime pas (§ 11.7, B8)', () => {
  test('aucune règle d’impression des feuilles du document ne vise la section de la qualité', async () => {
    const generees = generee(chargeSix());
    await ouvrir(executer(generees, 'retenirProposition', { id: generees.propositions[0].id }));
    const regles = reglesImpression();
    expect(regles.length).toBeGreaterThan(0);
    expect(regles.filter((texte) => /qualite/i.test(texte))).toEqual([]);
  });
});

describe('une source dérivée : sa filiation, et la course partie de son départ (§ 12.6, § 12.14, C17, C23, D76)', () => {
  // Douze personnes inventées, trois tables de quatre places, trois tours.
  function chargeDouze() {
    const charge = creerCharge({ id: 'evt-qualite', nom: 'Atelier Ressac', siegesParDefaut: 4, tours: 3 });
    const noms = [
      ['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Tourteau', 'Basile'],
      ['Quenouille', 'Maëlle'], ['Varech', 'Sidonie'], ['Aubépin', 'Lucien'], ['Bruyère', 'Aglaé'],
      ['Cormier', 'Félix'], ['Dorine', 'Ysé'], ['Escourgeon', 'Paulin'], ['Fenouil', 'Rosalie'],
    ];
    charge.participants = noms.map(([nom, prenom], rang) => ({
      id: rang + 1,
      nom,
      prenom,
      organisation: rang % 3 === 0 ? 'Coopérative Aubier' : 'Atelier Ressac',
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    }));
    charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
    charge.prochainsIds = { participant: 13, table: 4, proposition: 1 };
    return charge;
  }

  const filiation = (m) => page(m).querySelector('[data-filiation]');
  const tete = (m) => [...page(m).querySelectorAll('[data-vue-qualite="performance"] [data-course] li')].map(texteDe);
  const partieDe = (m) => tete(m).filter((morceau) => morceau.startsWith('partie de'));

  // L'événement ouvert, une génération tirée, puis une dérivée de la
  // proposition 1, tour 1 figé, toutes deux par le contrôleur de la séance :
  // leurs courses sont gardées. Rend le montage et l'identifiant de la
  // dérivée.
  async function avecDerivee() {
    const m = await ouvrir(chargeDouze());
    await m.app.generation().generer({ graine: 3, nombre: 1, arret: 1, historique: 1000 });
    const { ajoutees } = await m.app.generation().generer({ graine: 8, nombre: 1, arret: 400, historique: 1000 }, { depart: { id: 1, toursFiges: [1] } });
    expect(ajoutees.length).toBe(1);
    const [derivee] = ajoutees;
    expect(charge(m).propositions.find(({ id }) => id === derivee).depart).toBe(1);
    return { m, derivee };
  }

  test('la source dérivée : sa filiation sous la ligne de source, « partie de la proposition n° 1 » dans la performance ; son départ, ni l’une ni l’autre', async () => {
    const { m, derivee } = await avecDerivee();
    m.ui.montrerProposition(derivee);
    await attendre(() => expect(partieDe(m)).toEqual(['partie de la proposition n° 1']));
    expect(texteDe(filiation(m))).toBe('Dérivée de n° 1, tour 1 figé.');
    expect(filiation(m).closest('[data-source-qualite]')).toBeNull();
    expect(page(m).querySelector('[data-source-qualite]').compareDocumentPosition(filiation(m)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.propositionReservations', { proposition: derivee }));
    m.ui.montrerProposition(1);
    await attendre(() => expect(tete(m).length).toBeGreaterThan(0));
    expect(partieDe(m)).toEqual([]);
    expect(filiation(m)).toBeNull();
  });

  test('un retenu non ajusté venu d’une dérivée : sa ligne de source garde son libellé, sa performance dit d’où part la course ; ajusté, rien', async () => {
    const { m, derivee } = await avecDerivee();
    await m.seance.executer('retenirProposition', { id: derivee });
    m.ui.montrerProposition(null);
    await attendre(() => expect(partieDe(m)).toEqual(['partie de la proposition n° 1']));
    expect(ligneDeSource(m)).toBe(attendueDeSource('plan.source.retenu'));
    expect(filiation(m)).toBeNull();
    const [premierTour] = charge(m).retenu.placement;
    await m.seance.executer('echangerDansRetenu', { tour: 1, a: premierTour.sieges[0][0], b: premierTour.sieges[1][0] });
    await attendre(() => expect(page(m).querySelector('[data-vue-qualite="performance"] [data-phrase-qualite="retenuSansCourse"]')).not.toBeNull());
    expect(partieDe(m)).toEqual([]);
    expect(filiation(m)).toBeNull();
  });

  test('le départ effacé : la ligne de source dit qu’il n’est plus dans la liste, la performance le nomme encore ; en dérive, la filiation reste avec ses raisons', async () => {
    const { m, derivee } = await avecDerivee();
    await m.seance.executer('retenirProposition', { id: derivee });
    await m.seance.executer('effacerPropositions', {});
    m.ui.montrerProposition(derivee);
    await attendre(() => expect(partieDe(m)).toEqual(['partie de la proposition n° 1']));
    expect(texteDe(filiation(m))).toBe("Dérivée de n° 1, qui n'est plus dans la liste.");
    await m.seance.executer('exclureParticipant', { id: 12 });
    await attendre(() => expect(phrases(m)).toEqual(['derive']));
    expect(texteDe(filiation(m))).toBe("Dérivée de n° 1, qui n'est plus dans la liste.");
  });
});

describe('la présence par tour : une absence ne retire que le plancher de l’écart d’itinéraire (§ 12.4, § 12.6)', () => {
  // Cinq membres de la Coopérative Aubier, deux autres sans organisation,
  // une table de trois et une de quatre, où Ondine Ressac est réservée pour
  // la soirée, trois tours : le plancher des collisions tient à chaque tour.
  function chargeSept() {
    const charge = chargeSix();
    charge.evenement.tours = 3;
    for (const personne of charge.participants) personne.organisation = personne.id <= 5 ? 'Coopérative Aubier' : null;
    charge.participants.push({ ...charge.participants[5], id: 7, nom: 'Ressac', prenom: 'Ondine' });
    charge.tables[1].sieges = 4;
    charge.reservations = [{ participant: 7, table: 2, siege: null, portee: 'tous', tour: null }];
    charge.prochainsIds.participant = 8;
    return charge;
  }

  // La page de qualité de la proposition id, montrée au plan, ses
  // graphiques dessinés.
  async function qualiteDe(lue, id) {
    const m = await ouvrir(lue, { mode: 'lecture', section: 'plan' });
    m.ui.montrerProposition(id);
    m.ui.allerA('qualite');
    await attendre(() => expect(vuesRendues(m)).toEqual(VUES));
    await dessinerGraphiques(page(m));
    flushSync();
    return m;
  }
  const collisions = (m) => page(m).querySelector('[data-vue-qualite="collisions"]');

  test('une absence seule : la tuile de l’écart d’itinéraire dit son plancher non prouvé ; les collisions gardent leur segment prouvé, sans phrase de la réserve', async () => {
    const absente = chargeSept();
    absente.participants[5].presence = [1, 2];
    const lue = generee(absente);
    const id = lue.propositions[0].id;
    const m = await qualiteDe(lue, id);
    expect(page(m).querySelectorAll('[data-plancher-non-prouve]')).toHaveLength(1);
    expect(page(m).querySelector('[data-tuile="ecartItineraireMax"] [data-plancher-non-prouve]')).not.toBeNull();
    expect(phrases(m)).not.toContain('collisionsHorsDomaine');
    expect(phrases(m)).not.toContain('objectifsHorsDomaine');
    expect(texteDe(page(m))).not.toContain(t('qualite.collisions.horsDomaine'));
    expect(collisions(m).querySelector('[data-segment="prouve"]')).not.toBeNull();
  });

  test('une réservée pour la soirée : les tuiles des agrégats écrivent « mobiles X · ancrés Y » sous leur borne, celle du minimum brut non', async () => {
    const lue = generee(chargeSept());
    const id = lue.propositions[0].id;
    const ligne = evaluer(lue).propositions.find((candidate) => candidate.id === id);
    const m = await qualiteDe(lue, id);
    const bornesDe = (nom) => [...page(m).querySelectorAll(`[data-tuile="${nom}"] .borne`)].map(texteDe);
    const { manqueMax, effectifManque } = ligne.troisChiffres;
    for (const [nom, valeurs] of [['manqueMax', manqueMax], ['effectifManque', effectifManque]]) {
      const attendue = t('propositions.secondaires', { mobiles: String(valeurs.mobiles), ancres: String(valeurs.ancres) });
      expect(bornesDe(nom), nom).toContain(attendue);
    }
    for (const nom of ['organisationsVues', 'diversite', 'ecartItineraireMax']) {
      expect(bornesDe(nom).filter((borne) => borne.startsWith('mobiles ')), nom).toHaveLength(1);
    }
    for (const nom of ['rencontresTous', 'rencontresMobiles', 'rencontresAncres', 'collisionsCumulees']) {
      expect(bornesDe(nom).filter((borne) => borne.startsWith('mobiles ')), nom).toEqual([]);
    }
  });

  test('une dérivée où l’arrivante d’un tour figé reste en réserve : la phrase de la réserve, comme aujourd’hui, et un seul segment', async () => {
    const lue = generee(chargeSept(), { graine: 3, nombre: 1, arret: 40 });
    // Ondine Ressac part au tour 1 et libère une chaise à sa table ; Iris
    // Pervenche n'y vient qu'au tour 1, réservée à la table 1, pleine.
    const changee = avec(lue, (c) => {
      c.participants[6].presence = [2, 3];
      c.participants.push({ ...c.participants[5], id: 8, nom: 'Pervenche', prenom: 'Iris', presence: [1] });
      c.reservations.push({ participant: 8, table: 1, siege: null, portee: 'tour', tour: 1 });
      c.prochainsIds.participant = 9;
    });
    const depart = { id: lue.propositions[0].id, toursFiges: [1] };
    const duMoteur = departDuMoteur(changee, depart);
    expect(duMoteur.reservesImposees).toEqual([{ participant: 8, tour: 1 }]);
    const configuration = configurationDepuisCharge(changee);
    const propositions = repartir(configuration, { graine: 5, nombre: 1, arret: 40 }, duMoteur);
    const derivee = appliquerCommande('enregistrerGeneration', changee, {
      propositions,
      configuration,
      produitVersion: V1,
      derivation: { depart: depart.id, toursFiges: depart.toursFiges },
    }).charge;
    const id = derivee.propositions.at(-1).id;
    expect(derivee.propositions.at(-1).placement[0].reserve).toEqual([8]);
    const m = await qualiteDe(derivee, id);
    expect(phrases(m)).toContain('collisionsHorsDomaine');
    expect(texteDe(collisions(m).querySelector('[data-phrase-qualite="collisionsHorsDomaine"]'))).toBe(t('qualite.collisions.horsDomaine'));
    expect(collisions(m).querySelector('[data-segment="prouve"]')).toBeNull();
    // Aucune tuile n'écrit de plancher hors du domaine ; l'écart
    // d'itinéraire dit le sien non prouvé, des absences existant.
    expect(page(m).querySelector('[data-tuile="collisionsCumulees"]').textContent).not.toContain('plancher');
    expect(page(m).querySelector('[data-tuile="ecartItineraireMax"] [data-plancher-non-prouve]')).not.toBeNull();
  });
});
