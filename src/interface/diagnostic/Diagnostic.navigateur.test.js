// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le diagnostic dans un vrai moteur de rendu (§ 2.1 étape 8, § 5.4, § 5.5,
// § 5.6, § 7.5, § 8.4, § 15.1, § 15.3, § 15.4, § 19.3 capture 10) : le
// panneau compact du plan, lisible dès l'ouverture sans aucun clic ; la
// section complète, vivante en lecture et sur un plan bloqué ; le remède qui
// désactive la séparation, exécuté en écriture et refusé en lecture ; une
// configuration que le moteur refuse ; le bandeau du plan qui énonce le
// diagnostic quand toutes les tables sont en conflit. Chaque épreuve monte
// App par monterApp, au cadre de 1 366 × 700, et lit le rendu : le texte,
// la boîte, les attributs data-… — jamais une classe.
//
// Un énoncé porte data-enonce (sa clé), son texte data-phrase, une
// organisation data-donnee, un remède data-remede. La valeur attendue vient
// de diagnostiquer, sollicité une seconde fois sur la configuration de la
// charge ouverte (§ 19.1) ; le texte, de la même traduction que celle de
// l'application. Les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { diagnostiquer } from '../../moteur/diagnostic.js';
import { ErreurConfiguration } from '../../moteur/erreurs.js';
import { normaliser } from '../../moteur/configuration.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import TEXTE_TOUTES_EN_CONFLIT from '../../../test/fixtures/plan/toutes_en_conflit.gtt.json?raw';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { composantes, visible } from '../../../test/navigateur/rendu.js';
import { teintesOrganisations } from '../organisations.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cartesDiagnostic, enonces, numeroDeCharge } from './phrases.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;

// --- Les charges d'épreuve -------------------------------------------------------

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// Douze personnes inventées, quatre tables de 3, quatre tours ; organisation
// donne celle de la personne de rang p.
function chargeDouze(organisation) {
  const charge = creerCharge({ id: 'evt-diagnostic', nom: 'Soirée des Merles', siegesParDefaut: 3, tours: 4 });
  charge.participants = Array.from({ length: 12 }, (_, p) => ({
    id: p + 1,
    nom: `Pervenche${p + 1}`,
    prenom: 'Théo',
    organisation: organisation(p),
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2, 3, 4].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 13, table: 5, proposition: 1 };
  return charge;
}

// La petite démonstration où quatre personnes portent une réservation de
// portée « tous les tours », sans siège, à la table 1, de 3 places : le
// stockage l'admet, le moteur la refuse (SURRESERVATION).
function quatreReserveesSurTrois() {
  const charge = chargeDemo('petite');
  charge.reservations = [1, 2, 3, 4].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
  return charge;
}

// --- Le montage --------------------------------------------------------------------

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

async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}

// La démonstration de clé donnée, chargée par la façade et ouverte en
// lecture, sur la section qu'ouvre un événement.
async function demonstration(cle) {
  const m = await monter();
  await m.facade.chargerDemonstration(cle);
  flushSync();
  return m;
}

// La charge posée en fichier d'état sous base, ouverte en lecture.
async function ouvrirTexte(texte, base = 'soiree') {
  const m = await monter({ fichiers: [{ racine: 'documents', chemin: `${base}${SUFFIXES.etat}`, texte }] });
  await m.seance.ouvrir(base);
  flushSync();
  return m;
}

const ouvrirCharge = (charge) => ouvrirTexte(serialiser(charge, { revision: 1, produitVersion: V1 }));

// --- Les lectures du rendu ---------------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const section = (m) => dans(m, '[data-section="diagnostic"]');
const panneau = (m) => dans(m, '[data-panneau-diagnostic]');
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const charge = (m) => m.seance.etat().charge;
const revision = (m) => m.seance.etat().evenement.revision;

// L'intitulé de la liste qui porte un énoncé : la liste d'une carte est
// nommée par son titre (aria-labelledby).
const intituleDe = (li) => document.getElementById(li.closest('ul').getAttribute('aria-labelledby'));

// Chaque énoncé rendu sous la racine : sa clé, son organisation — la donnée
// du titre de sa carte —, son texte, et son remède, null quand il n'en porte
// pas.
function lus(racine) {
  return [...racine.querySelectorAll('[data-enonce]')].map((li) => {
    const donnee = intituleDe(li).querySelector('[data-donnee]');
    const remede = li.querySelector('[data-remede]');
    return {
      cle: li.dataset.enonce,
      groupe: donnee === null ? null : texteDe(donnee),
      phrase: texteDe(li.querySelector('[data-phrase]')),
      remede: remede === null ? null : texteDe(remede),
    };
  });
}

// Les énoncés attendus pour la charge, du moteur sollicité une seconde fois ;
// avecRemede : la forme complète, qui écrit le texte du remède.
function attendus(chargeLue, { avecRemede }) {
  const diagnostic = diagnostiquer(configurationDepuisCharge(chargeLue));
  const liste = enonces(diagnostic, { numeroDe: numeroDeCharge(chargeLue), tours: chargeLue.evenement.tours });
  return liste.map(({ cle, details, remede }) => ({
    cle,
    groupe: details.groupe ?? null,
    phrase: t(cle, details),
    remede: avecRemede && remede !== null ? t(remede.cle, remede.details) : null,
  }));
}


// La couleur qu'un jeton donne dans le thème courant, relue sur une sonde.
function jeton(nom) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const couleur = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return couleur;
}

// La carte qui porte un élément : son plus proche ancêtre peint du fond de
// la carte, bordé d'un filet et arrondi.
function carteDe(element) {
  const fond = jeton('--couleur-carte-fond');
  for (let porteur = element.parentElement; porteur !== null; porteur = porteur.parentElement) {
    const style = getComputedStyle(porteur);
    const peinte = composantes(style.backgroundColor).join() === fond.join();
    if (peinte && parseFloat(style.borderTopWidth) > 0 && parseFloat(style.borderTopLeftRadius) > 0) return porteur;
  }
  return null;
}

// Les cartes attendues : genre, groupe et clés de chaque carte, du moteur
// sollicité une seconde fois.
function cartesAttendues(chargeLue) {
  const diagnostic = diagnostiquer(configurationDepuisCharge(chargeLue));
  const liste = enonces(diagnostic, { numeroDe: numeroDeCharge(chargeLue), tours: chargeLue.evenement.tours });
  return cartesDiagnostic(liste).map(({ genre, groupe, enonces: dedans }) => ({ genre, groupe, cles: dedans.map(({ cle }) => cle) }));
}

// Les cartes rendues sous la racine, lues comme cartesAttendues : chaque
// liste d'énoncés et son titre ; groupe, la donnée du titre.
function cartesLues(racine) {
  return [...racine.querySelectorAll('ul')]
    .filter((ul) => ul.querySelector('[data-enonce]') !== null)
    .map((ul) => {
      const donnee = document.getElementById(ul.getAttribute('aria-labelledby')).querySelector('[data-donnee]');
      return {
        groupe: donnee === null ? null : texteDe(donnee),
        cles: [...ul.querySelectorAll('[data-enonce]')].map((li) => li.dataset.enonce),
      };
    });
}

// --- Les épreuves ------------------------------------------------------------------

describe('le diagnostic se lit sans rien demander (§ 2.1 étape 8, § 5.6)', () => {
  test('la petite au conflit inévitable, sans proposition, ouverte : le panneau du plan l\u{2019}énonce, dans la fenêtre ; une table ajoutée le change sans autre geste', async () => {
    const m = await demonstration('petite-conflit');
    expect(m.ui.etat().section).toBe('plan');
    expect(charge(m).propositions.length).toBe(0);
    const avant = attendus(charge(m), { avecRemede: false });
    expect(avant.length).toBeGreaterThan(0);
    expect(avant.map(({ cle }) => cle)).toContain('diagnostic.collisions');
    await attendre(() => expect(lus(panneau(m))).toEqual(avant));
    const premier = panneau(m).querySelector('[data-enonce]');
    expect(visible(premier)).toBe(true);
    expect(visible(premier.querySelector('[data-phrase]'))).toBe(true);
    // Compact : aucun remède, aucune commande dans le panneau.
    expect(panneau(m).querySelectorAll('[data-remede], [data-commande]').length).toBe(0);

    await m.seance.passerEnEcriture();
    await m.seance.executer('creerTable', { forme: 'ronde' });
    const apres = attendus(charge(m), { avecRemede: false });
    expect(apres).not.toEqual(avant);
    expect(apres.map(({ cle }) => cle)).not.toContain('diagnostic.collisions');
    await attendre(() => expect(lus(panneau(m))).toEqual(apres));
  });
});

describe('vivant en lecture (§ 8.4)', () => {
  test('en lecture, la section se lit, remèdes compris, sans rien écrire ; sur un plan bloqué, de même', async () => {
    const m = await demonstration('petite-conflit');
    const ecrituresAvant = m.trace.length;
    m.ui.allerA('diagnostic');
    flushSync();
    expect(m.seance.etat().mode).toBe('lecture');
    const attendue = attendus(charge(m), { avecRemede: true });
    expect(attendue.filter(({ remede }) => remede !== null).length).toBeGreaterThan(0);
    await attendre(() => expect(lus(section(m))).toEqual(attendue));
    expect(visible(section(m).querySelector('[data-phrase]'))).toBe(true);
    expect(m.trace.length).toBe(ecrituresAvant);

    await m.seance.passerEnEcriture();
    await m.seance.executer('changerEtat', { etat: 'bloque' });
    expect(m.seance.etat().refus.code).toBe('LECTURE_SEULE');
    m.ui.allerA('diagnostic');
    await attendre(() => expect(lus(section(m))).toEqual(attendus(charge(m), { avecRemede: true })));
    m.ui.allerA('plan');
    await attendre(() => expect(lus(panneau(m))).toEqual(attendus(charge(m), { avecRemede: false })));
  });
});

describe('la grande démonstration (§ 15.1, § 19.3 capture 10)', () => {
  test('les valeurs affichées égalent celles de diagnostiquer : 24, 99, le plancher de l\u{2019}écart d\u{2019}itinéraire', async () => {
    const m = await demonstration('grande');
    m.ui.allerA('diagnostic');
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge(m)));
    expect(diagnostic.plafondAPriori.repartition[0]).toEqual({ valeur: 24, ancres: 4, mobiles: 0 });
    expect(diagnostic.retoursImposes).toBe(99);
    expect(diagnostic.ecartItineraire).not.toBeNull();
    const attendue = attendus(charge(m), { avecRemede: true });
    await attendre(() => expect(lus(section(m))).toEqual(attendue));
    const phrases = lus(section(m)).map(({ phrase }) => phrase);
    expect(phrases).toContain(t('diagnostic.plafond', diagnostic.plafondAPriori.repartition[0]));
    expect(phrases).toContain(
      t('diagnostic.imposes', { retoursImposes: diagnostic.retoursImposes, ancragesImposantRetours: diagnostic.ancragesImposantRetours }),
    );
    expect(phrases).toContain(t('diagnostic.ecartItineraire', diagnostic.ecartItineraire));
    expect(phrases.join(' ')).toMatch(/\b24 rencontres\b/);
    expect(phrases.join(' ')).toMatch(/\b99 retours imposés\b/);
    expect(phrases.join(' ')).toMatch(new RegExp(`plancher ${diagnostic.ecartItineraire.plancher},`));
  });
});

describe('les planchers des objectifs (§ 5.6, A10, D16, D20)', () => {
  // Quarante personnes inventées qui portent « finance », une table de 8 qui
  // la vise pour la soirée, quatre tables de 8 sans objectif, quatre tours :
  // les planchers valent 128, 8 et 4 (A10). mode : celui des objectifs,
  // absent au défaut.
  function quaranteFinance(mode = null) {
    const charge = creerCharge({ id: 'evt-objectifs', nom: 'Soirée des Merles', siegesParDefaut: 8, tours: 4 });
    charge.participants = Array.from({ length: 40 }, (_, p) => ({
      id: p + 1,
      nom: `Lacasse${p + 1}`,
      prenom: 'Ondine',
      organisation: null,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
      etiquettes: ['finance'],
    }));
    charge.tables = [1, 2, 3, 4, 5].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
    charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    if (mode !== null) charge.reglages.modeObjectifs = mode;
    charge.prochainsIds = { participant: 41, table: 6, proposition: 1 };
    return charge;
  }

  // Les énoncés des objectifs rendus sous la racine : la valeur que porte
  // data-plancher-objectifs, et la phrase.
  const planchers = (racine) =>
    [...racine.querySelectorAll('[data-plancher-objectifs]')].map((li) => [li.dataset.plancherObjectifs, texteDe(li.querySelector('[data-phrase]'))]);

  test('sous « le plus de places servies », le seul plancher des tours hors objectif, avec son remède, dans la section et le panneau du plan', async () => {
    const m = await ouvrirCharge(quaranteFinance());
    m.ui.allerA('diagnostic');
    expect(diagnostiquer(configurationDepuisCharge(charge(m))).objectifsInevitables).toEqual({ horsObjectif: 128, jamaisServies: 8, horsObjectifMax: 4, parTour: [32, 32, 32, 32] });
    await attendre(() =>
      expect(planchers(section(m))).toEqual([['toursHorsObjectif', t('diagnostic.objectifs.toursHorsObjectif', { plancher: 128 })]]),
    );
    const ligne = section(m).querySelector('[data-plancher-objectifs]');
    expect(ligne.dataset.enonce).toBe('diagnostic.objectifs.toursHorsObjectif');
    expect(texteDe(ligne.querySelector('[data-remede]'))).toBe(t('diagnostic.remede.objectifs'));
    expect(visible(ligne.querySelector('[data-phrase]'))).toBe(true);
    m.ui.allerA('plan');
    await attendre(() => expect(planchers(panneau(m)).map(([grandeur]) => grandeur)).toEqual(['toursHorsObjectif']));
  });

  test('sous « chacun au moins une fois », les personnes jamais servies d’abord, puis les tours hors objectif', async () => {
    const autre = await ouvrirCharge(quaranteFinance('chacun'));
    autre.ui.allerA('diagnostic');
    await attendre(() =>
      expect(planchers(section(autre))).toEqual([
        ['jamaisServies', t('diagnostic.objectifs.jamaisServies', { plancher: 8 })],
        ['toursHorsObjectif', t('diagnostic.objectifs.toursHorsObjectif', { plancher: 128 })],
      ]),
    );
  });

  test('sans objectif, aucun plancher des objectifs ne s’écrit', async () => {
    const m = await demonstration('petite-conflit');
    m.ui.allerA('diagnostic');
    await attendre(() => expect(section(m).querySelectorAll('[data-enonce]').length).toBeGreaterThan(0));
    expect(section(m).querySelectorAll('[data-plancher-objectifs]')).toHaveLength(0);
  });
});

describe('une seule organisation (§ 15.4)', () => {
  test('la phrase et son remède ; en lecture, refusé avec « Modifier » ; en écriture, exécuté en une entrée', async () => {
    const m = await ouvrirCharge(chargeDouze(() => 'Club des Merles'));
    m.ui.allerA('diagnostic');
    flushSync();
    const [premier] = lus(section(m));
    expect(premier).toEqual({
      cle: 'diagnostic.uneSeuleOrganisation',
      groupe: null,
      phrase: t('diagnostic.uneSeuleOrganisation'),
      remede: t('diagnostic.remede.separation'),
    });
    const ligne = section(m).querySelector('[data-enonce="diagnostic.uneSeuleOrganisation"]');
    const bouton = ligne.querySelector('[data-commande="modifierReglage"]');
    expect(bouton).not.toBeNull();
    expect(texteDe(bouton)).toBe(t('communs.remede.modifierReglage'));
    expect(visible(bouton)).toBe(true);

    // En lecture : refusé, le refus posé à côté, avec « Modifier » ; rien d'écrit.
    const ecrituresAvant = m.trace.length;
    const revisionAvant = revision(m);
    bouton.click();
    const refus = await attendre(() => {
      const trouve = ligne.querySelector('[data-refus="MODE_LECTURE"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    const modifier = refus.querySelector('[data-commande="modifier"]');
    expect(modifier).not.toBeNull();
    expect(texteDe(modifier)).toBe(t('communs.remede.modifier'));
    expect(revision(m)).toBe(revisionAvant);
    expect(m.trace.length).toBe(ecrituresAvant);

    // « Modifier » passe en écriture ; le remède s'exécute, une entrée.
    modifier.click();
    await attendre(() => expect(m.seance.etat().mode).toBe('ecriture'));
    const revisionEcriture = revision(m);
    ligne.querySelector('[data-commande="modifierReglage"]').click();
    await attendre(() => expect(charge(m).reglages.separerOrganisations).toBe(false));
    expect(revision(m)).toBe(revisionEcriture + 1);
    await attendre(() => expect(section(m).querySelector('[data-enonce="diagnostic.uneSeuleOrganisation"]')).toBeNull());
  });
});

describe('la configuration refusée (§ 5.6, § 5.9)', () => {
  test('quatre réservées sur une table de 3 : le code traduit, aucun énoncé, aucun message brut ; les autres sections vivent', async () => {
    const chargeRefusee = quatreReserveesSurTrois();
    let refusMoteur = null;
    try {
      normaliser(configurationDepuisCharge(chargeRefusee));
    } catch (erreur) {
      expect(erreur).toBeInstanceOf(ErreurConfiguration);
      refusMoteur = erreur;
    }
    expect(refusMoteur?.code).toBe('SURRESERVATION');
    const m = await ouvrirCharge(chargeRefusee);
    const message = t('SURRESERVATION', refusMoteur.details);

    // Le panneau du plan, ouvert d'emblée.
    await attendre(() => expect(panneau(m).querySelector('[data-refus="SURRESERVATION"]')).not.toBeNull());
    for (const racine of [panneau(m)]) {
      expect(texteDe(racine.querySelector('[data-refus="SURRESERVATION"]'))).toBe(message);
      expect(racine.querySelectorAll('[data-enonce]').length).toBe(0);
      expect(racine.textContent).not.toContain(refusMoteur.message);
    }

    // La section.
    m.ui.allerA('diagnostic');
    await attendre(() => expect(section(m)).not.toBeNull());
    const porteur = section(m).querySelector('[data-refus="SURRESERVATION"]');
    expect(texteDe(porteur)).toBe(message);
    expect(visible(porteur)).toBe(true);
    expect(texteDe(section(m))).toContain(t('diagnostic.nonCalcule'));
    expect(section(m).querySelectorAll('[data-enonce]').length).toBe(0);
    expect(section(m).textContent).not.toContain(refusMoteur.message);

    // Les participants se lisent toujours.
    m.ui.allerA('participants');
    await attendre(() => expect(m.racine.querySelectorAll('[data-section="participants"] [data-participant]').length).toBe(12));
  });
});


describe('le diagnostic en cartes (§ 5.6, § 12.7)', () => {
  test('toutes en conflit : la section pose une carte par organisation, titrée de sa pastille, de la teinte de son rang ; le panneau compact titre chaque groupe de même', async () => {
    const m = await ouvrirTexte(TEXTE_TOUTES_EN_CONFLIT, 'toutes_en_conflit');
    const rangs = teintesOrganisations(charge(m).participants);
    const attendues = cartesAttendues(charge(m));
    const organisations = attendues.filter(({ genre }) => genre === 'organisation');
    expect(organisations.length).toBe(2);
    const sansGenre = attendues.map(({ groupe, cles }) => ({ groupe, cles }));

    for (const [nom, racine] of [
      ['panneau', () => panneau(m)],
      ['section', () => (m.ui.allerA('diagnostic'), section(m))],
    ]) {
      await attendre(() => expect(cartesLues(racine())).toEqual(sansGenre));
      const listes = [...racine().querySelectorAll('ul')].filter((ul) => ul.querySelector('[data-enonce]') !== null);
      for (const { groupe } of organisations) {
        const ul = listes.find((liste) => document.getElementById(liste.getAttribute('aria-labelledby')).textContent.includes(groupe));
        const titre = document.getElementById(ul.getAttribute('aria-labelledby'));
        expect(/^H[2-6]$/.test(titre.tagName), `${nom} ${groupe} : un intitulé`).toBe(true);
        const donnee = titre.querySelector('[data-donnee]');
        expect(texteDe(donnee)).toBe(groupe);
        // La pastille : un point de la marque du rang, le nom de l'encre de la page.
        const point = donnee.querySelector('[aria-hidden="true"]');
        expect(point, `${nom} ${groupe} : le point de la pastille`).not.toBeNull();
        const rang = rangs.get(groupe);
        expect(composantes(getComputedStyle(point).backgroundColor)).toEqual(jeton(`--couleur-organisation-${rang}-marque`));
        expect(visible(donnee)).toBe(true);
      }
      if (nom === 'section') {
        // Chaque liste a sa propre carte.
        const cartes = listes.map(carteDe);
        expect(cartes.every((carte) => carte !== null)).toBe(true);
        expect(new Set(cartes).size).toBe(listes.length);
      }
    }
  });
});

describe('le rang de teinte d’une carte se compte sur tous les participants, exclus compris (§ 12.7)', () => {
  test('une personne exclue dont l’organisation se range avant les autres décale les deux cartes aux rangs 2 et 3', async () => {
    // La charge « toutes en conflit » et une treizième personne, exclue,
    // d'une organisation qui se range avant les deux autres : le moteur ne
    // la voit pas, les collisions restent celles des deux groupes.
    const chargeAvecExclue = analyser(TEXTE_TOUTES_EN_CONFLIT).charge;
    chargeAvecExclue.participants.push({
      id: 13,
      nom: 'Varech',
      prenom: null,
      organisation: 'Atelier des Alisiers',
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: true,
    });
    chargeAvecExclue.prochainsIds = { ...chargeAvecExclue.prochainsIds, participant: 14 };
    const m = await ouvrirCharge(chargeAvecExclue);
    const attendues = cartesAttendues(charge(m)).filter(({ genre }) => genre === 'organisation');
    expect(attendues.map(({ groupe }) => groupe).sort()).toEqual(['Cercle des Hérons', 'Club des Merles']);

    for (const [nom, racine] of [
      ['panneau', () => panneau(m)],
      ['section', () => (m.ui.allerA('diagnostic'), section(m))],
    ]) {
      await attendre(() => expect(racine().querySelectorAll('[data-donnee]').length).toBe(2));
      for (const [groupe, rang] of [
        ['Cercle des Hérons', 2],
        ['Club des Merles', 3],
      ]) {
        const donnee = [...racine().querySelectorAll('[data-donnee]')].find((d) => texteDe(d) === groupe);
        expect(donnee, `${nom} ${groupe} : la pastille`).not.toBeUndefined();
        const point = donnee.querySelector('[aria-hidden="true"]');
        expect(composantes(getComputedStyle(point).backgroundColor), `${nom} ${groupe} : la marque du rang ${rang}`).toEqual(
          jeton(`--couleur-organisation-${rang}-marque`),
        );
      }
    }
  });
});

describe('le bandeau du plan énonce le diagnostic (§ 7.5)', () => {
  // Les entrées attendues du bandeau, du moteur sollicité une seconde fois :
  // la phrase, collisionPartout, puis chaque plancher de groupe.
  function bandeauAttendu(chargeLue) {
    const diagnostic = diagnostiquer(configurationDepuisCharge(chargeLue));
    expect(diagnostic.collisionPartout).toBe(true);
    expect(diagnostic.collisions.length).toBe(2);
    return [
      t('plan.bandeau.toutesEnConflit'),
      t('plan.bandeau.collisionPartout'),
      ...diagnostic.collisions.map(
        ({ groupe, effectif, plancherCumulees }) => `${groupe} ${t('plan.bandeau.plancherGroupe', { groupe, effectif, plancherCumulees })}`,
      ),
    ];
  }

  const bandeau = (m) => dans(m, '[data-bandeau-plan]');
  // Chaque entrée, ses nœuds — l'organisation, puis le texte — joints par
  // une espace.
  const entrees = (m) => [...bandeau(m).querySelectorAll('li')].map((li) => [...li.children].map(texteDe).join(' '));

  test('toutes en conflit, la proposition montrée : la phrase, collisionPartout, puis les planchers de chaque groupe', async () => {
    const m = await ouvrirTexte(TEXTE_TOUTES_EN_CONFLIT, 'toutes_en_conflit');
    m.ui.montrerProposition(1);
    const attendu = bandeauAttendu(charge(m));
    await attendre(() => expect(bandeau(m)).not.toBeNull());
    await attendre(() => expect(entrees(m)).toEqual(attendu));
    expect(visible(bandeau(m).querySelector('li'))).toBe(true);
    // Les chiffres du moteur, au chiffre près, dans le rendu.
    const { collisions } = diagnostiquer(configurationDepuisCharge(charge(m)));
    for (const { groupe, plancherCumulees } of collisions) {
      const ligne = [...bandeau(m).querySelectorAll('li')].find((li) => li.textContent.startsWith(groupe));
      expect(ligne.textContent).toContain(`${plancherCumulees} collisions`);
    }
  });

  test('une table rendue saine au tour montré : ni phrase ni plancher', async () => {
    // La personne 8, à la table 1 du tour 1 avec 4 et 7, prend une troisième
    // organisation : la table 1 réunit trois organisations à ce tour.
    const lue = analyser(TEXTE_TOUTES_EN_CONFLIT).charge;
    lue.participants.find(({ id }) => id === 8).organisation = 'Grisaille';
    expect(lue.propositions[0].placement[0].sieges[0]).toEqual([4, 7, 8]);
    const m = await ouvrirCharge(lue);
    m.ui.montrerProposition(1);
    await attendre(() => expect(m.racine.querySelectorAll('[data-plan] [data-table]').length).toBe(4));
    await attendre(() => expect(bandeau(m)).toBeNull());
    expect(m.racine.textContent).not.toContain(t('plan.bandeau.toutesEnConflit'));
    expect(m.racine.querySelector('[data-surface]').textContent).not.toContain(t('plan.bandeau.collisionPartout'));
  });
});

describe('la présence par tour (§ 5.6)', () => {
  // Douze personnes, cinq de la Grisaille, quatre tables de 3 : la
  // personne de rang 10 vient aux tours 1 et 2, celle de rang 11 au tour 3 ;
  // celle de rang 9, exclue, garde une présence suspendue.
  function chargePresences() {
    const charge = chargeDouze((p) => (p < 5 ? 'Grisaille' : null));
    charge.participants[10].presence = [1, 2];
    charge.participants[11].presence = [3];
    Object.assign(charge.participants[9], { exclu: true, presence: [4] });
    return charge;
  }

  test('deux présences partielles, une exclue à part : l’énoncé ouvre la carte de l’événement, sans remède, dans la section et le panneau du plan', async () => {
    const m = await ouvrirCharge(chargePresences());
    const phrase = t('diagnostic.planchersRetires', { absentes: 2 });
    m.ui.allerA('diagnostic');
    const li = await attendre(() => {
      const trouve = section(m).querySelector('[data-enonce="diagnostic.planchersRetires"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(texteDe(li.querySelector('[data-phrase]'))).toBe(phrase);
    expect(li.querySelector('[data-remede]')).toBeNull();
    expect(texteDe(intituleDe(li))).toBe(t('diagnostic.carte.ensemble'));
    expect(li.closest('ul').querySelector('[data-enonce]')).toBe(li);
    expect(section(m).querySelector('[data-enonce="diagnostic.ecartItineraire"]')).toBeNull();
    m.ui.allerA('plan');
    await attendre(() => expect(texteDe(panneau(m).querySelector('[data-enonce="diagnostic.planchersRetires"]'))).toBe(phrase));
  });

  test('le manque de places qui varie se dit tour par tour ; sans présence partielle, aucun énoncé des planchers retirés', async () => {
    const charge = chargeDouze((p) => (p < 5 ? 'Grisaille' : null));
    // Deux personnes de plus, aux tours 3 et 4 seulement : 2 places y
    // manquent, aucune aux tours 1 et 2.
    for (const id of [13, 14]) charge.participants.push({ ...charge.participants[11], id, nom: `Pervenche${id}`, presence: [3, 4] });
    charge.prochainsIds.participant = 15;
    const m = await ouvrirCharge(charge);
    m.ui.allerA('diagnostic');
    const li = await attendre(() => {
      const trouve = section(m).querySelector('[data-enonce="diagnostic.placesManquantes"]');
      expect(trouve).not.toBeNull();
      return trouve;
    });
    expect(texteDe(li.querySelector('[data-phrase]'))).toBe('2 places manquent aux tours 3 et 4');
    expect(section(m).querySelector('[data-enonce="diagnostic.planchersRetires"]')).not.toBeNull();
    const sans = await ouvrirCharge(chargeDouze((p) => (p < 5 ? 'Grisaille' : null)));
    sans.ui.allerA('diagnostic');
    await attendre(() => expect(section(sans).querySelector('[data-enonce]')).not.toBeNull());
    expect(section(sans).querySelector('[data-enonce="diagnostic.planchersRetires"]')).toBeNull();
  });
});
