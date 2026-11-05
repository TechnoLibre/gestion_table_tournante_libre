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
// organisation data-donnee, un remède data-remede ; dans la section, son
// explication data-explication et, quand il en a un, son geste data-levier ;
// la carte de la proposition choisie porte data-proposition-choisie, son
// genre, et chacun de ses blocs data-bloc-proposition, son nom ; la ligne du
// calcul exact, data-solveur, son état. Le vrai solveur ne se monte que dans
// les épreuves du plancher exact, qui passent chargerSolveurReel, sauf celle
// de la progression, dont le travailleur factice ne remet un tour qu'à son
// ordre ; les autres montent App sans solveur, sur les planchers instantanés
// seuls. La valeur
// attendue vient de diagnostiquer, sollicité une seconde fois sur la
// configuration de la charge ouverte (§ 19.1), et des planchers des
// conflits en étoile que l'application rend pour elle ; le texte, de la même
// traduction que celle de l'application. Les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { planchersConflits } from '../../application/planchers_conflits.js';
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
import TEXTE_HUIT_TABLES_RETENU from '../../../test/fixtures/plan/huit_tables_retenu.gtt.json?raw';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { chargerSolveurReel } from '../../../test/navigateur/solveur.js';
import { composantes, traductionEcran, visible } from '../../../test/navigateur/rendu.js';
import { teintesOrganisations } from '../organisations.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { cartesDiagnostic, enonces, expliquer, numeroDeCharge, remedeAgit } from './phrases.js';
import { propositionChoisie } from './proposition.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const { t: tEcran } = traductionEcran();
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

// Les montages de l'épreuve, démontés après elle. Le collecteur n'a reçu,
// pendant l'épreuve, que les erreurs qu'elle annonce dans attendues.
let montes = [];
let attendues = [];
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  const annoncees = attendues;
  attendues = [];
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual(annoncees);
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
  const m = await monter({ fichiers: [{ racine: 'documents', chemin: `${base}/${base}${SUFFIXES.etat}`, texte }] });
  await m.seance.ouvrir(`${base}/${base}`);
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

// Les énoncés de la charge, du moteur sollicité une seconde fois, avec les
// planchers des conflits en étoile que l'écran passe.
const enoncesDe = (chargeLue, diagnostic) =>
  enonces(diagnostic, { numeroDe: numeroDeCharge(chargeLue), tours: chargeLue.evenement.tours, conflits: planchersConflits(chargeLue) });

// Les énoncés attendus pour la charge ; avecRemede : la forme complète, qui
// écrit le texte du remède.
function attendus(chargeLue, { avecRemede }) {
  const diagnostic = diagnostiquer(configurationDepuisCharge(chargeLue));
  const liste = enoncesDe(chargeLue, diagnostic);
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
  const liste = enoncesDe(chargeLue, diagnostic);
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

describe('les conflits en étoile (§ 5.6)', () => {
  // Six membres du Club des Merles, qui nomme le Cercle des Hérons, quatre
  // membres, et deux personnes sans organisation : quatre tables de 3.
  function chargeEtoile() {
    const etoile = chargeDouze((p) => (p < 6 ? 'Club des Merles' : p < 10 ? 'Cercle des Hérons' : null));
    etoile.participants[0].conflits = ['Cercle des Hérons'];
    return etoile;
  }

  test('une carte « Organisations en conflit » après celle du Club, avant tout l’événement : l’énoncé seul au panneau du plan, expliqué dans la section', async () => {
    const m = await ouvrirCharge(chargeEtoile());
    const conflits = planchersConflits(charge(m));
    expect(conflits.map(({ organisations }) => organisations)).toEqual([['Club des Merles', 'Cercle des Hérons']]);
    const attendues = cartesAttendues(charge(m));
    expect(attendues.map(({ genre }) => genre)).toEqual(['organisation', 'conflits', 'ensemble']);
    const sansGenre = attendues.map(({ groupe, cles }) => ({ groupe, cles }));
    const selecteur = '[data-enonce="diagnostic.conflitsEtoile"]';

    // Le panneau du plan, dès l'ouverture : l'énoncé sous son intertitre,
    // sans explication ni remède.
    await attendre(() => expect(cartesLues(panneau(m))).toEqual(sansGenre));
    expect(lus(panneau(m))).toEqual(attendus(charge(m), { avecRemede: false }));
    const compact = panneau(m).querySelector(selecteur);
    expect(texteDe(intituleDe(compact))).toBe(texteDe({ textContent: tEcran('diagnostic.carte.conflits') }));
    expect(visible(compact.querySelector('[data-phrase]'))).toBe(true);
    expect(compact.querySelectorAll('[data-explication], [data-remede]').length).toBe(0);

    // La section : la carte à elle, l'énoncé, son « Concrètement » et son
    // remède, précédé de « Pour changer cela : ».
    m.ui.allerA('diagnostic');
    await attendre(() => expect(cartesLues(section(m))).toEqual(sansGenre));
    expect(lus(section(m))).toEqual(attendus(charge(m), { avecRemede: true }));
    const li = section(m).querySelector(selecteur);
    const [enonce] = enoncesDe(charge(m), diagnostiquer(configurationDepuisCharge(charge(m)))).filter(({ cle }) => cle === 'diagnostic.conflitsEtoile');
    expect(texteDe(li.querySelector('[data-phrase]'))).toBe(texteDe({ textContent: tEcran(enonce.cle, enonce.details) }));
    expect(texteDe(li.querySelector('[data-explication]'))).toContain('le partage des tables en impose au moins 24 de plus');
    expect(texteDe(li.querySelector('[data-remede]').closest('p'))).toMatch(/^Pour changer cela/);
    li.scrollIntoView({ block: 'center' });
    expect(visible(li.querySelector('[data-explication]'))).toBe(true);
    const collisions = section(m).querySelector('[data-enonce="diagnostic.collisions"]');
    expect(carteDe(li)).not.toBeNull();
    expect(carteDe(li)).not.toBe(carteDe(collisions));
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
    // La personne 4, à la table 2 du tour 1 avec 1 et 2, prend une
    // troisième organisation : la table 2 réunit trois organisations à ce
    // tour.
    const lue = analyser(TEXTE_TOUTES_EN_CONFLIT).charge;
    lue.participants.find(({ id }) => id === 4).organisation = 'Grisaille';
    expect(lue.propositions[0].placement[0].sieges[1]).toEqual([1, 2, 4]);
    const m = await ouvrirCharge(lue);
    m.ui.montrerProposition(1);
    await attendre(() => expect(m.racine.querySelectorAll('[data-plan] [data-table]').length).toBe(4));
    await attendre(() => expect(bandeau(m)).toBeNull());
    expect(m.racine.textContent).not.toContain(t('plan.bandeau.toutesEnConflit'));
    expect(m.racine.querySelector('[data-surface]').textContent).not.toContain(tEcran('plan.bandeau.collisionPartout'));
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

describe('chaque énoncé expliqué, dans la section seulement (§ 5.6)', () => {
  // Ce que la section doit écrire sous chaque énoncé, du moteur sollicité
  // une seconde fois, par la traduction de l'écran : « Concrètement : » et
  // ses phrases, le paragraphe du remède — précédé de « Pour changer cela : »
  // quand il dit un geste —, et le geste propre à l'énoncé, null sans lui.
  const espaces = (texte) => texte.replace(/\s+/g, ' ').trim();
  function explicationsAttendues(chargeLue) {
    const diagnostic = diagnostiquer(configurationDepuisCharge(chargeLue));
    const contexte = { diagnostic, tours: chargeLue.evenement.tours };
    return enoncesDe(chargeLue, diagnostic).map((enonce) => {
      const { concretement, levier } = expliquer(enonce, contexte);
      const remede = enonce.remede === null ? null : tEcran(enonce.remede.cle, enonce.remede.details);
      return {
        cle: enonce.cle,
        explication: espaces([tEcran('diagnostic.amorce.concretement'), ...concretement.map(({ cle, details }) => tEcran(cle, details))].join(' ')),
        remede: remede === null ? null : espaces(remedeAgit(enonce.remede) ? `${tEcran('diagnostic.amorce.pourChanger')} ${remede}` : remede),
        levier: levier === null ? null : espaces(`${tEcran('diagnostic.amorce.pourChanger')} ${tEcran(levier.cle, levier.details)}`),
      };
    });
  }

  // Les mêmes lectures, sur le rendu : le paragraphe qui porte le remède.
  const explicationsLues = (racine) =>
    [...racine.querySelectorAll('[data-enonce]')].map((li) => {
      const explication = li.querySelector('[data-explication]');
      const remede = li.querySelector('[data-remede]');
      const levier = li.querySelector('[data-levier]');
      return {
        cle: li.dataset.enonce,
        explication: explication === null ? null : texteDe(explication),
        remede: remede === null ? null : texteDe(remede.closest('p')),
        levier: levier === null ? null : texteDe(levier),
      };
    });

  test('la petite au conflit inévitable : « Concrètement » sous chaque énoncé, « Pour changer cela » devant les gestes et sous le plafond ; le panneau du plan n\u{2019}en porte aucun', async () => {
    const m = await demonstration('petite-conflit');
    m.ui.allerA('diagnostic');
    const attendue = explicationsAttendues(charge(m));
    expect(attendue.some(({ levier }) => levier !== null)).toBe(true);
    expect(attendue.some(({ remede }) => remede?.startsWith(espaces(tEcran('diagnostic.amorce.pourChanger'))))).toBe(true);
    await attendre(() => expect(explicationsLues(section(m))).toEqual(attendue));
    for (const noeud of section(m).querySelectorAll('[data-explication], [data-levier]')) expect(visible(noeud)).toBe(true);
    m.ui.allerA('plan');
    await attendre(() => expect(panneau(m).querySelectorAll('[data-enonce]').length).toBeGreaterThan(0));
    expect(panneau(m).querySelectorAll('[data-explication], [data-levier]').length).toBe(0);
  });

  test('la grande sans exception, 264 places pour 260 personnes : le plafond de 28 par la table de 8, puis les 4 places vides à chaque tour', async () => {
    const m = await demonstration('grande-sans-exception');
    m.ui.allerA('diagnostic');
    const attendue = explicationsAttendues(charge(m));
    await attendre(() => expect(explicationsLues(section(m))).toEqual(attendue));
    const plafond = section(m).querySelector('[data-enonce="diagnostic.plafond"] [data-explication]');
    expect(texteDe(plafond)).toContain(espaces(tEcran('diagnostic.concretement.placesVides', { placesVides: 4, places: 264, presents: 260 })));
    expect(texteDe(plafond)).toMatch(/à une table de 8, on rencontre 7 personnes par tour/);
  });
});

describe('la proposition choisie, expliquée sous tout l\u{2019}événement (§ 5.5, § 5.6, § 12.10)', () => {
  // Ce que la carte doit écrire, de propositionChoisie sollicitée une
  // seconde fois sur la charge ouverte, par la traduction de l'écran : son
  // genre, puis chaque bloc, laquelle d'abord — la phrase qui la nomme, et
  // celle de son statut —, puis ceux de l'explication, leur titre en tête.
  const espaces = (texte) => texte.replace(/\s+/g, ' ').trim();
  function choisieAttendue(chargeLue, demandee = null) {
    const choisie = propositionChoisie(chargeLue, { demandee });
    const traduire = ({ cle, details }) => espaces(tEcran(cle, details));
    return {
      genre: choisie.genre,
      blocs: [
        { nom: 'laquelle', textes: [choisie.laquelle, ...(choisie.statut === null ? [] : [choisie.statut])].map(traduire) },
        ...choisie.blocs.map(({ nom, titre, phrases }) => ({ nom, textes: [espaces(tEcran(titre)), ...phrases.map(traduire)] })),
      ],
    };
  }

  // Les mêmes lectures, sur le rendu ; null sans carte.
  function choisieLue(racine) {
    const carte = racine.querySelector('[data-proposition-choisie]');
    if (carte === null) return null;
    return {
      genre: carte.dataset.propositionChoisie,
      blocs: [...carte.querySelectorAll('[data-bloc-proposition]')].map((bloc) => ({
        nom: bloc.dataset.blocProposition,
        textes: [...bloc.children].map(texteDe),
      })),
    };
  }

  test('sans proposition, la petite : la carte dit d\u{2019}en générer une, sous la carte de tout l\u{2019}événement ; le panneau du plan ne la porte pas', async () => {
    const m = await demonstration('petite');
    m.ui.allerA('diagnostic');
    const attendue = choisieAttendue(charge(m));
    expect(attendue.genre).toBe('aucune');
    await attendre(() => expect(choisieLue(section(m))).toEqual(attendue));
    const carte = section(m).querySelector('[data-proposition-choisie]');
    carte.scrollIntoView({ block: 'center' });
    expect(visible(carte)).toBe(true);
    // Sous la dernière carte des énoncés, dans une carte à elle.
    const enonces = [...section(m).querySelectorAll('[data-enonce]')];
    const derniere = enonces.at(-1);
    expect(derniere.compareDocumentPosition(carte) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(carteDe(carte)).not.toBeNull();
    expect(carteDe(carte)).not.toBe(carteDe(derniere));
    expect(intituleDe(derniere).textContent).toContain(tEcran('diagnostic.carte.ensemble'));
    m.ui.allerA('plan');
    await attendre(() => expect(panneau(m).querySelectorAll('[data-enonce]').length).toBeGreaterThan(0));
    expect(panneau(m).querySelector('[data-proposition-choisie]')).toBeNull();
  });

  test('toutes en conflit : la meilleure du classement sans demande, puis la proposition montrée au plan, ses blocs titrés et chiffrés', async () => {
    const m = await ouvrirTexte(TEXTE_TOUTES_EN_CONFLIT, 'toutes_en_conflit');
    m.ui.allerA('diagnostic');
    const meilleure = choisieAttendue(charge(m));
    expect(meilleure.genre).toBe('meilleure');
    await attendre(() => expect(choisieLue(section(m))).toEqual(meilleure));
    m.ui.montrerProposition(1);
    const montree = choisieAttendue(charge(m), 1);
    expect(montree.genre).toBe('montree');
    expect(montree.blocs.map(({ nom }) => nom)).toEqual(['laquelle', 'atteint', 'manque', 'tenter']);
    await attendre(() => expect(choisieLue(section(m))).toEqual(montree));
    // Chaque bloc de l'explication s'ouvre sur un intitulé, sous celui de
    // la carte.
    const carte = section(m).querySelector('[data-proposition-choisie]');
    expect(document.getElementById(carte.getAttribute('aria-labelledby')).tagName).toBe('H3');
    for (const bloc of carte.querySelectorAll('[data-bloc-proposition]:not([data-bloc-proposition="laquelle"])')) {
      expect(bloc.firstElementChild.tagName).toBe('H4');
      bloc.scrollIntoView({ block: 'center' });
      expect(visible(bloc.firstElementChild)).toBe(true);
    }
  });

  test('un placement retenu, sans demande : la carte l\u{2019}explique, en lecture, sans rien écrire', async () => {
    const m = await ouvrirTexte(TEXTE_HUIT_TABLES_RETENU, 'huit_tables_retenu');
    const avant = revision(m);
    m.ui.allerA('diagnostic');
    const attendue = choisieAttendue(charge(m));
    expect(attendue.genre).toBe('retenu');
    await attendre(() => expect(choisieLue(section(m))).toEqual(attendue));
    expect(revision(m)).toBe(avant);
  });
});

describe('le plancher exact du solveur (§ 5.6, § 5.10)', () => {
  // Une charge de membres par organisation, sur des tables de capacités
  // données ; conflits, [rang, organisations nommées].
  function chargeOrganisations({ effectifs, capacites, tours, conflits }) {
    const nouvelle = creerCharge({ id: 'evt-exact', nom: 'Soirée des Grèbes', siegesParDefaut: 8, tours });
    nouvelle.participants = effectifs
      .flatMap(([organisation, n]) => Array(n).fill(organisation))
      .map((organisation, rang) => ({
        id: rang + 1,
        nom: `Grèbe${rang + 1}`,
        prenom: 'Iris',
        organisation,
        courriel: null,
        titrePressenti: null,
        notes: null,
        exclu: false,
      }));
    for (const [rang, nommees] of conflits) nouvelle.participants[rang].conflits = nommees;
    nouvelle.tables = capacites.map((sieges, t) => ({ id: t + 1, numero: t + 1, sieges, forme: 'ronde', position: { x: 300 * t, y: 0 } }));
    nouvelle.prochainsIds = { participant: nouvelle.participants.length + 1, table: capacites.length + 1, proposition: 1 };
    return nouvelle;
  }

  // Trois organisations de 12, toutes en conflit, sur 9 tables de 8, quatre
  // tours : le plancher des étoiles se tait, la somme par groupe dit 9 par
  // tour, le solveur 54.
  const triangle = () =>
    chargeOrganisations({
      effectifs: [['Club des Merles', 12], ['Cercle des Hérons', 12], ['Atelier des Loutres', 12]],
      capacites: Array(9).fill(8),
      tours: 4,
      conflits: [[0, ['Cercle des Hérons', 'Atelier des Loutres']], [12, ['Atelier des Loutres']]],
    });

  // Trente-trois personnes, vingt du Club et treize du Cercle, sur des tables
  // de 11, 11, 6 et 5 places, deux tours ; le Club nomme le Cercle, et aucune
  // table ne les mêle sans conflit. Les 33 places sont toutes prises et
  // aucune somme de tables ne vaut 13 : aucun plan n'évite tout conflit.
  const vingtContreTreize = () =>
    chargeOrganisations({
      effectifs: [['Club des Merles', 20], ['Cercle des Hérons', 13]],
      capacites: [11, 11, 6, 5],
      tours: 2,
      conflits: [[0, ['Cercle des Hérons']]],
    });

  // La charge, sa proposition n° 1 posée, écrite à la main : listes[r], les
  // personnes de chaque table au tour r + 1, dans l'ordre des tables.
  function avecProposition(chargeLue, listes) {
    chargeLue.evenement.etat = 'propose';
    chargeLue.propositions = [
      {
        id: 1,
        graine: 1,
        arret: 40,
        historique: 1000,
        produitVersion: V1,
        siegesAttribues: false,
        tables: chargeLue.tables.map(({ id }) => id),
        capacites: chargeLue.tables.map(({ sieges }) => sieges),
        tours: listes.length,
        participants: chargeLue.participants.map(({ id }) => id),
        placement: listes.map((tables) => ({ sieges: tables.map((liste) => [...liste]), reserve: [] })),
      },
    ];
    chargeLue.prochainsIds.proposition = 2;
    return chargeLue;
  }

  // Les identifiants de debut à fin, bornes comprises.
  const ids = (debut, fin) => Array.from({ length: fin - debut + 1 }, (_, rang) => debut + rang);

  // Un solveur factice : son travailleur garde chaque demande reçue et ne
  // répond qu'à l'ordre de l'épreuve, repondre(message), au numéro de la
  // dernière demande.
  function solveurFactice() {
    const demandes = [];
    const etat = { terminaisons: 0 };
    let travailleur = null;
    const charger = async () => ({
      fabrique: () => {
        travailleur = {
          onmessage: null,
          onerror: null,
          postMessage: (message) => demandes.push(message),
          terminate: () => {
            etat.terminaisons += 1;
          },
        };
        return travailleur;
      },
      urlWasm: 'highs-factice.wasm',
    });
    const repondre = (message) => travailleur.onmessage({ data: { numero: demandes.at(-1).numero, ...message } });
    return { charger, demandes, repondre, etat };
  }

  // La charge ouverte en lecture, App monté avec le solveur — le vrai par
  // défaut —, sur la section du diagnostic.
  async function ouvrirAvecSolveur(chargeLue, chargerSolveur = chargerSolveurReel) {
    const texte = serialiser(chargeLue, { revision: 1, produitVersion: V1 });
    const m = await monter({
      fichiers: [{ racine: 'documents', chemin: `soiree/soiree${SUFFIXES.etat}`, texte }],
      chargerSolveur,
    });
    await m.seance.ouvrir('soiree/soiree');
    m.ui.allerA('diagnostic');
    flushSync();
    return m;
  }

  const ligne = (m) => section(m).querySelector('[data-solveur]');
  const enonceDe = (racine, cle) => racine.querySelector(`[data-enonce="${cle}"]`);
  const ecran = (cle, details) => texteDe({ textContent: tEcran(cle, details) });

  // Attend un état de la ligne du calcul, le travailleur répondant hors de
  // toute image : jusqu'à 30 s.
  async function attendreEtat(m, etat) {
    for (let essai = 0; essai < 1800; essai += 1) {
      flushSync();
      if (ligne(m).dataset.solveur === etat) return;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
    expect(ligne(m).dataset.solveur).toBe(etat);
  }

  test('le triangle : rien pendant le délai, puis le calcul en cours — ce qui se calcule, pourquoi, la barre, « Annuler » —, puis la phrase exacte, au panneau comme dans la section', async () => {
    const m = await ouvrirAvecSolveur(triangle());
    expect(planchersConflits(charge(m))).toEqual([]);
    expect(ligne(m).dataset.solveur).toBe('absent');
    expect(texteDe(ligne(m))).toBe('');
    m.horloge.avancer(399);
    flushSync();
    expect(ligne(m).dataset.solveur).toBe('absent');

    m.horloge.avancer(1);
    flushSync();
    expect(ligne(m).dataset.solveur).toBe('enCours');
    const etat = ligne(m).querySelector('[role="status"]');
    expect(etat.getAttribute('aria-live')).toBe('polite');
    expect(texteDe(etat)).toBe(`${ecran('diagnostic.solveur.enCours', { tour: 1, tours: 4 })} ${ecran('diagnostic.solveur.pourquoi')}`);
    ligne(m).scrollIntoView({ block: 'center' });
    expect(visible(etat)).toBe(true);
    const barre = ligne(m).querySelector('[role="progressbar"]');
    expect([barre.getAttribute('aria-valuemin'), barre.getAttribute('aria-valuemax')]).toEqual(['0', '4']);
    expect(barre.getAttribute('aria-label')).toBe(ecran('diagnostic.solveur.barre'));
    const annuler = ligne(m).querySelector('[data-commande="annulerSolveur"]');
    expect(texteDe(annuler)).toBe(ecran('diagnostic.solveur.annuler'));
    expect(enonceDe(section(m), 'diagnostic.collisionsExactes')).toBeNull();

    await attendreEtat(m, 'pret');
    expect(texteDe(ligne(m))).toBe('');
    expect(ligne(m).querySelector('[data-commande]')).toBeNull();
    const attendu = ecran('diagnostic.collisionsExactes', { plancher: 216, tours: 4, parTour: [54, 54, 54, 54] });
    const li = enonceDe(section(m), 'diagnostic.collisionsExactes');
    expect(texteDe(li.querySelector('[data-phrase]'))).toBe(attendu);
    expect(texteDe(li.querySelector('[data-explication]'))).toContain(ecran('diagnostic.concretement.collisionsExactes', {}));
    expect(texteDe(li.querySelector('[data-remede]'))).toBe(ecran('diagnostic.remede.collisionsExactes', {}));

    // Le panneau du plan : la phrase seule, sans ligne du calcul.
    m.ui.allerA('plan');
    await attendre(() => expect(panneau(m)).not.toBeNull());
    const compact = enonceDe(panneau(m), 'diagnostic.collisionsExactes');
    expect(texteDe(compact.querySelector('[data-phrase]'))).toBe(attendu);
    expect(compact.querySelectorAll('[data-explication], [data-remede]').length).toBe(0);
    expect(panneau(m).querySelector('[data-solveur]')).toBeNull();
  }, 60_000);

  test('aucun plan sans conflit : la phrase de l’impossibilité remplace l’étoile des planchers instantanés', async () => {
    const m = await ouvrirAvecSolveur(vingtContreTreize());
    expect(planchersConflits(charge(m)).length).toBe(1);
    await attendre(() => expect(enonceDe(section(m), 'diagnostic.conflitsEtoile')).not.toBeNull());
    m.horloge.avancer(400);
    await attendreEtat(m, 'pret');
    expect(enonceDe(section(m), 'diagnostic.conflitsEtoile')).toBeNull();
    const li = enonceDe(section(m), 'diagnostic.conflitsInevitables');
    expect(texteDe(li.querySelector('[data-phrase]'))).toBe(ecran('diagnostic.conflitsInevitables', { toursSansIssue: [1, 2] }));
    expect(texteDe(intituleDe(li))).toBe(ecran('diagnostic.carte.conflits'));
    expect(texteDe(li.querySelector('[data-remede]').closest('p'))).toMatch(/^Pour changer cela/);
  }, 60_000);

  test('« Annuler » : le calcul s’arrête, la ligne le dit et prend le focus, les planchers instantanés restent, et rien ne relance tant que le modèle ne change pas', async () => {
    const m = await ouvrirAvecSolveur(triangle());
    m.horloge.avancer(400);
    flushSync();
    expect(ligne(m).dataset.solveur).toBe('enCours');
    const avant = lus(section(m));
    ligne(m).querySelector('[data-commande="annulerSolveur"]').click();
    flushSync();
    expect(ligne(m).dataset.solveur).toBe('annule');
    expect(texteDe(ligne(m).querySelector('[role="status"]'))).toBe(ecran('diagnostic.solveur.annule'));
    expect(ligne(m).querySelector('[data-commande]')).toBeNull();
    // La commande disparue, le focus passe à la ligne qui dit l'annulation.
    await new Promise((resoudre) => requestAnimationFrame(resoudre));
    expect(document.activeElement).toBe(ligne(m).querySelector('[role="status"]'));
    m.horloge.avancer(60_000);
    for (let image = 0; image < 30; image += 1) await new Promise((resoudre) => requestAnimationFrame(resoudre));
    flushSync();
    expect(ligne(m).dataset.solveur).toBe('annule');
    expect(enonceDe(section(m), 'diagnostic.collisionsExactes')).toBeNull();
    expect(lus(section(m))).toEqual(avant);
  }, 60_000);

  test('le calcul avance : « tour k sur R », la valeur de la barre et son remplissage suivent chaque tour reçu du travailleur', async () => {
    const factice = solveurFactice();
    const m = await ouvrirAvecSolveur(triangle(), factice.charger);
    m.horloge.avancer(400);
    await attendre(() => expect(factice.demandes.length).toBe(1));
    const { tours } = factice.demandes[0];
    expect(tours.length).toBe(4);
    const issue = { faisable: true, minimum: 54, auMoins: null, cause: null, duree: 1, cache: false };
    const barre = () => ligne(m).querySelector('[role="progressbar"]');
    ligne(m).scrollIntoView({ block: 'center' });
    for (let faits = 0; faits <= 4; faits += 1) {
      if (faits > 0) factice.repondre({ type: 'tour', r: tours[faits - 1].r, issue });
      flushSync();
      expect(ligne(m).dataset.solveur).toBe('enCours');
      expect(texteDe(ligne(m).querySelector('[role="status"]'))).toBe(
        `${ecran('diagnostic.solveur.enCours', { tour: Math.min(faits + 1, 4), tours: 4 })} ${ecran('diagnostic.solveur.pourquoi')}`,
      );
      expect(barre().getAttribute('aria-valuenow')).toBe(String(faits));
      // Le remplissage, premier enfant de la barre, couvre faits quarts de
      // sa largeur intérieure, au pixel près.
      const plein = barre().firstElementChild.getBoundingClientRect().width;
      expect(Math.abs(plein - (barre().clientWidth * faits) / 4)).toBeLessThanOrEqual(1);
    }
    factice.repondre({ type: 'fini' });
    await attendreEtat(m, 'pret');
    const li = enonceDe(section(m), 'diagnostic.collisionsExactes');
    expect(texteDe(li.querySelector('[data-phrase]'))).toBe(ecran('diagnostic.collisionsExactes', { plancher: 216, tours: 4, parTour: [54, 54, 54, 54] }));
  });

  test('App envoie au collecteur la faute de chargement du solveur, qui devient indisponible', async () => {
    const factice = solveurFactice();
    const m = await ouvrirAvecSolveur(triangle(), factice.charger);
    m.horloge.avancer(400);
    await attendre(() => expect(factice.demandes.length).toBe(1));
    const message = 'module WebAssembly refusé par la plateforme';
    factice.repondre({ type: 'faute', etape: 'chargement', message, pile: '' });
    await attendreEtat(m, 'indisponible');
    // Le collecteur reçoit l'erreur rapportée ; le lanceur des épreuves, qui
    // voit un écouteur d'erreurs posé, la recopie en console.error, que le
    // collecteur reçoit aussi. Toute entrée nomme la faute.
    expect(m.erreurs()).toContainEqual({ type: 'error', message: `solveur du plancher exact (chargement) : ${message}` });
    for (const entree of m.erreurs()) expect(entree.message).toContain(message);
    attendues = m.erreurs();
  });

  test('le démontage d’App en plein calcul termine le travailleur du solveur', async () => {
    const factice = solveurFactice();
    const m = await ouvrirAvecSolveur(triangle(), factice.charger);
    m.horloge.avancer(400);
    await attendre(() => expect(factice.demandes.length).toBe(1));
    expect(ligne(m).dataset.solveur).toBe('enCours');
    expect(factice.etat.terminaisons).toBe(0);
    montes = montes.filter((monte) => monte !== m);
    expect(m.erreurs()).toEqual([]);
    m.demonter();
    expect(factice.etat.terminaisons).toBe(1);
  });

  // Les phrases rendues d'un bloc de la carte de la proposition choisie,
  // intitulé exclu ; [] sans ce bloc.
  const phrasesDuBloc = (m, nom) => {
    const bloc = section(m).querySelector(`[data-bloc-proposition="${nom}"]`);
    return bloc === null ? [] : [...bloc.querySelectorAll('p')].map(texteDe);
  };
  // Les phrases d'un bloc de la proposition choisie sur les planchers
  // instantanés seuls, comme propositionChoisie les rend sans exacts.
  const phrasesInstantanees = (m, nom) => propositionChoisie(charge(m), { demandee: null }).blocs.find((bloc) => bloc.nom === nom)?.phrases ?? [];

  test('la carte de la proposition choisie lit le plancher exact : aucun plan sans conflit, la proposition à conflits le dit dans « manque », et « tenter » ne propose plus de repartir', async () => {
    // Quatre du Club, un du Cercle, une personne sans organisation, deux
    // tables de 3, un tour ; le Club nomme le Cercle. Le Club, à quatre, se
    // partage les deux tables, et le Cercle s'assoit avec deux autres :
    // aucun plan n'évite tout conflit. Le plan assoit deux membres du Club
    // avec le Cercle, deux avec la personne sans organisation : 2 conflits,
    // 2 collisions, la somme par groupe ; seuls les conflits restent à
    // reprendre.
    const quatreContreUn = chargeOrganisations({
      effectifs: [['Club des Merles', 4], ['Cercle des Hérons', 1], [null, 1]],
      capacites: [3, 3],
      tours: 1,
      conflits: [[0, ['Cercle des Hérons']]],
    });
    const m = await ouvrirAvecSolveur(avecProposition(quatreContreUn, [[[1, 2, 5], [3, 4, 6]]]));
    m.horloge.avancer(400);
    flushSync();
    // « Repartir d’elle », que les planchers instantanés proposent.
    const relance = phrasesInstantanees(m, 'tenter').find(({ cle }) => cle === 'diagnostic.proposition.tenter.repartir');
    expect(relance).toBeDefined();
    const repartir = ecran(relance.cle, relance.details);
    // Pendant le calcul, les planchers instantanés seuls.
    expect(section(m).querySelector('[data-proposition-choisie]')).not.toBeNull();
    expect(phrasesDuBloc(m, 'manque')).not.toContain(ecran('diagnostic.proposition.conflits.inevitables'));
    expect(phrasesDuBloc(m, 'tenter')).toContain(repartir);

    await attendreEtat(m, 'pret');
    expect(phrasesDuBloc(m, 'manque')[0]).toBe(ecran('diagnostic.proposition.conflits.inevitables'));
    expect(phrasesDuBloc(m, 'tenter')).not.toContain(repartir);
  }, 60_000);

  test('la carte de la proposition choisie lit le plancher exact : le triangle sans conflit, 54 collisions par tour, est au minimum', async () => {
    // Chaque organisation par quatre à trois tables, aux quatre tours :
    // 3 × 3 × 6 = 54 collisions par tour, aucun conflit.
    const tour = Array.from({ length: 9 }, (_, table) => ids(4 * table + 1, 4 * table + 4));
    const m = await ouvrirAvecSolveur(avecProposition(triangle(), [tour, tour, tour, tour]));
    m.horloge.avancer(400);
    flushSync();
    const minimum = ecran('diagnostic.proposition.collisions.minimum');
    expect(phrasesInstantanees(m, 'atteint').map(({ cle }) => cle)).not.toContain('diagnostic.proposition.collisions.minimum');
    expect(phrasesDuBloc(m, 'atteint')).not.toContain(minimum);

    await attendreEtat(m, 'pret');
    expect(phrasesDuBloc(m, 'atteint')).toContain(minimum);
  }, 60_000);

  test('sans chargerSolveur, aucune ligne du calcul exact', async () => {
    const m = await ouvrirCharge(triangle());
    m.ui.allerA('diagnostic');
    flushSync();
    m.horloge.avancer(10_000);
    flushSync();
    expect(section(m).querySelector('[data-solveur]')).toBeNull();
    expect(enonceDe(section(m), 'diagnostic.collisionsExactes')).toBeNull();
  });
});
