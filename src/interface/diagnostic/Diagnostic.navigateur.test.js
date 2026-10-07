// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
// appartenance data-donnee, un remède data-remede. La valeur attendue vient
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
import { visible } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { enonces, numeroDeCharge } from './phrases.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;

// --- Les charges d'épreuve -------------------------------------------------------

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// Douze personnes inventées, quatre tables de 3, quatre tours ; appartenance
// donne celle de la personne de rang p.
function chargeDouze(appartenance) {
  const charge = creerCharge({ id: 'evt-diagnostic', nom: 'Soirée des Merles', siegesParDefaut: 3, tours: 4 });
  charge.participants = Array.from({ length: 12 }, (_, p) => ({
    id: p + 1,
    nom: `Pervenche${p + 1}`,
    prenom: 'Théo',
    appartenance: appartenance(p),
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

// Chaque énoncé rendu sous la racine : sa clé, son appartenance, son texte,
// et son remède, null quand il n'en porte pas.
function lus(racine) {
  return [...racine.querySelectorAll('[data-enonce]')].map((li) => {
    const donnee = li.querySelector('[data-donnee]');
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

describe('une seule appartenance (§ 15.4)', () => {
  test('la phrase et son remède ; en lecture, refusé avec « Modifier » ; en écriture, exécuté en une entrée', async () => {
    const m = await ouvrirCharge(chargeDouze(() => 'Club des Merles'));
    m.ui.allerA('diagnostic');
    flushSync();
    const [premier] = lus(section(m));
    expect(premier).toEqual({
      cle: 'diagnostic.uneSeuleAppartenance',
      groupe: null,
      phrase: t('diagnostic.uneSeuleAppartenance'),
      remede: t('diagnostic.remede.separation'),
    });
    const ligne = section(m).querySelector('[data-enonce="diagnostic.uneSeuleAppartenance"]');
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
    await attendre(() => expect(charge(m).reglages.separerAppartenances).toBe(false));
    expect(revision(m)).toBe(revisionEcriture + 1);
    await attendre(() => expect(section(m).querySelector('[data-enonce="diagnostic.uneSeuleAppartenance"]')).toBeNull());
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
  // Chaque entrée, ses nœuds — l'appartenance, puis le texte — joints par
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
    // appartenance : la table 1 réunit trois appartenances à ce tour.
    const lue = analyser(TEXTE_TOUTES_EN_CONFLIT).charge;
    lue.participants.find(({ id }) => id === 8).appartenance = 'Grisaille';
    expect(lue.propositions[0].placement[0].sieges[0]).toEqual([4, 7, 8]);
    const m = await ouvrirCharge(lue);
    m.ui.montrerProposition(1);
    await attendre(() => expect(m.racine.querySelectorAll('[data-plan] [data-table]').length).toBe(4));
    await attendre(() => expect(bandeau(m)).toBeNull());
    expect(m.racine.textContent).not.toContain(t('plan.bandeau.toutesEnConflit'));
    expect(m.racine.querySelector('[data-surface]').textContent).not.toContain(t('plan.bandeau.collisionPartout'));
  });
});
