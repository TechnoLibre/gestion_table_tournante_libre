// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La section des propositions dans un vrai moteur de rendu (§ 2.1 étapes 10
// et 11, § 5.4, § 5.5, § 5.7, § 8.4, § 9, § 12.6, § 19.3 capture 11) : le
// tableau classé et sa phrase d'ordre, les générations qui s'accumulent,
// retenir, voir sur le plan, effacer, le retenu ajusté et sa fenêtre, les
// refus en lecture et sur un plan bloqué. Chaque épreuve monte App par
// monterApp, sur le système de fichiers simulé où un fichier d'état
// d'épreuve est posé puis ouvert, au cadre de 1 366 × 700, et lit le rendu :
// le texte, le style calculé, les attributs data-… — jamais une classe.
//
// Une ligne classée porte data-proposition, la ligne du retenu data-retenu,
// une cellule data-colonne, la phrase de l'ordre data-ordre. La valeur
// attendue vient des fonctions du moteur, sollicitées une seconde fois
// (§ 19.1), mises en forme par creerFormat ; le texte, de la même traduction
// que celle de l'application. Les noms d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../application/commandes.js';
import { configurationDe } from '../../application/configuration.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { nomAffiche } from '../../application/personnes.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { CRITERES, classer } from '../../moteur/classement.js';
import { indexerPlan, normaliser } from '../../moteur/configuration.js';
import { mesurer } from '../../moteur/indicateurs.js';
import { troisChiffres } from '../../moteur/manque.js';
import { plafondsAPriori, plafondsRealises } from '../../moteur/plafond.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, capacite, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { planDepuisFichier } from '../../stockage/placements.js';
import { VERSION } from '../../version.genere.js';
import { couleurDeJeton } from '../../../test/navigateur/captures.js';
import { centre } from '../../../test/navigateur/ecrans.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { composantes, contraste, couleurTexte, fondPeintSous, sousTheme } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { evaluation, tableau } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;
const BASE = 'soiree';
const TIRET = '\u{2014}';

// --- Les charges d'épreuve -------------------------------------------------------

const chargeDemo = (cle) => analyser(texteLivre(cle)).charge;

// La charge, une génération du moteur de plus, enregistrée par la commande.
function generee(charge, reglages) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;

// Une proposition écrite à la main, sièges non attribués, sur les tables de
// la charge dans leur ordre.
function propositionDe(charge, id, tours) {
  const participants = charge.participants.filter(({ exclu }) => !exclu).map(({ id: p }) => p);
  return {
    id,
    graine: id,
    arret: 40,
    historique: 1000,
    produitVersion: V1,
    siegesAttribues: false,
    tables: charge.tables.map(({ id: table }) => table),
    capacites: charge.tables.map((table) => capacite(charge, table)),
    tours: tours.length,
    participants,
    placement: tours.map((listes) => ({ sieges: listes.map((liste) => [...liste].sort((a, b) => a - b)), reserve: [] })),
  };
}

// La charge, ses propositions remplacées par les plans donnés, numérotés à
// partir de 1.
function avecPlans(charge, plans) {
  const suivante = structuredClone(charge);
  suivante.propositions = plans.map((tours, rang) => propositionDe(suivante, rang + 1, tours));
  suivante.prochainsIds.proposition = plans.length + 1;
  suivante.evenement.etat = 'propose';
  return suivante;
}

// Trois plans de la petite démonstration au conflit inévitable, dans l'ordre
// des identifiants : (4, 1), (4, 2), (6, 6) collisions (cumulées,
// distinctes), au même plus grand écart au plafond a priori.
const PLANS_CONFLIT = [
  [
    [[2, 3, 10], [6, 8, 9], [4, 7, 12], [1, 5, 11]],
    [[2, 7, 10], [4, 6, 8], [3, 11, 12], [1, 5, 9]],
    [[7, 9, 12], [3, 8, 11], [4, 6, 10], [1, 2, 5]],
    [[2, 7, 10], [3, 8, 9], [6, 11, 12], [1, 4, 5]],
  ],
  [
    [[2, 6, 10], [3, 8, 9], [7, 11, 12], [1, 4, 5]],
    [[4, 7, 10], [2, 6, 8], [1, 5, 11], [3, 9, 12]],
    [[2, 6, 12], [4, 8, 10], [1, 3, 11], [5, 7, 9]],
    [[2, 3, 12], [4, 8, 10], [1, 6, 9], [5, 7, 11]],
  ],
  [
    [[3, 4, 12], [7, 8, 9], [2, 6, 10], [1, 5, 11]],
    [[4, 6, 12], [2, 8, 10], [1, 7, 11], [3, 5, 9]],
    [[2, 4, 10], [6, 8, 11], [1, 3, 12], [5, 7, 9]],
    [[2, 7, 10], [5, 6, 8], [9, 11, 12], [1, 3, 4]],
  ],
];

// Six personnes inventées, deux tables de quatre places, quatre tours, et
// trois plans à trois par table : une place libre à chaque table.
function chargeSix() {
  const charge = creerCharge({ id: 'evt-propositions', nom: 'Club des Merles', siegesParDefaut: 4, tours: 4 });
  const noms = [['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine'], ['Grisaille', null], ['Bruyère', 'Anouk'], ['Sarcelle', 'Capucine']];
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: rang < 2 ? 'Club des Merles' : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
  }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  return avecPlans(charge, [
    [[[1, 2, 3], [4, 5, 6]], [[1, 2, 4], [3, 5, 6]], [[1, 2, 5], [3, 4, 6]], [[1, 2, 6], [3, 4, 5]]],
    [[[1, 3, 5], [2, 4, 6]], [[1, 4, 6], [2, 3, 5]], [[1, 2, 3], [4, 5, 6]], [[1, 5, 6], [2, 3, 4]]],
    [[[1, 4, 5], [2, 3, 6]], [[1, 3, 6], [2, 4, 5]], [[1, 2, 6], [3, 4, 5]], [[1, 3, 4], [2, 5, 6]]],
  ]);
}

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
// sauf mode 'lecture' —, la section des propositions ouverte.
async function ouvrir(charge, { mode = 'ecriture' } = {}) {
  const texte = serialiser(charge, { revision: 1, produitVersion: V1 });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}${SUFFIXES.etat}`, texte }] });
  montes.push(m);
  await m.seance.ouvrir(BASE);
  if (mode === 'ecriture') await m.seance.passerEnEcriture();
  m.ui.allerA('propositions');
  flushSync();
  return m;
}

// --- Les lectures du rendu ---------------------------------------------------------

const section = (m) => m.racine.querySelector('[data-section="propositions"]');
const lignes = (m) => [...section(m).querySelectorAll('tr[data-proposition]')];
const ids = (m) => lignes(m).map((tr) => Number(tr.dataset.proposition));
const ligne = (m, id) => section(m).querySelector(`tr[data-proposition="${id}"]`);
const ligneRetenu = (m) => section(m).querySelector('tr[data-retenu]');
const commande = (racine, nom) => racine.querySelector(`[data-commande="${nom}"]`);
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const fenetreOuverte = (m) => m.racine.querySelector('dialog[open]');
const charge = (m) => m.seance.etat().charge;
const revision = (m) => m.seance.etat().evenement.revision;
// Le refus posé à côté d'un bouton de Commande : dans son conteneur.
const refusPres = (bouton, code) => bouton.parentElement.querySelector(`[data-refus="${code}"]`);

// Ce que le plan dessiné montre au tour affiché : pour chaque [data-table]
// rendu, les noms de sa liste [data-liste], triés. Rien n'est lu dans l'état
// des places : la valeur vient du rendu même.
function occupantsDessines(m) {
  const plan = m.racine.querySelector('[data-plan]');
  const tables = [...plan.querySelectorAll('[data-table]')];
  return new Map(
    tables.map((groupe) => {
      const noms = [...plan.querySelectorAll(`[data-liste="${groupe.dataset.table}"] [data-partie="nom"]`)];
      return [Number(groupe.dataset.table), noms.map(texteDe).sort()];
    }),
  );
}

// Les noms attendus à chaque table d'un placement, au tour 1, triés.
function occupantsDuPlacement(chargeLue, placement) {
  const nomDe = new Map(chargeLue.participants.map((personne) => [personne.id, nomAffiche(personne)]));
  return new Map(placement.tables.map((table, rang) => [table, placement.placement[0].sieges[rang].filter((id) => id !== null).map((id) => nomDe.get(id)).sort()]));
}

// Le plan dessiné montre, au tour 1, les occupants du placement donné.
async function exigerPlanMontre(m, placement) {
  const attendu = occupantsDuPlacement(charge(m), placement);
  expect(attendu.size).toBeGreaterThan(0);
  await attendre(() => expect(occupantsDessines(m)).toEqual(attendu));
  for (const noms of attendu.values()) expect(noms.length).toBeGreaterThan(0);
}

// Le texte de chaque cellule d'une ligne, par colonne.
function cellules(tr) {
  const lues = [...tr.querySelectorAll('td[data-colonne]')];
  return new Map(lues.map((td) => [td.dataset.colonne, texteDe(td)]));
}

// Les chiffres que rend le moteur pour un placement de la charge, écrits
// comme le tableau les écrit.
function attendus(chargeLue, placement) {
  const instance = normaliser(configurationDepuisCharge(chargeLue));
  const tableDe = indexerPlan(instance, planDepuisFichier(placement));
  const mesures = mesurer(instance, tableDe);
  const trois = troisChiffres(instance, mesures, plafondsAPriori(instance), plafondsRealises(instance, tableDe));
  const ecrit = (valeur, decimales = 0) => (valeur === null ? TIRET : format.nombre(valeur, { decimales }));
  return new Map([
    ['rencontresTous', ecrit(mesures.aggRencontres.tous.min)],
    ['rencontresMobiles', ecrit(mesures.aggRencontres.mobiles.min)],
    ['rencontresAncres', ecrit(mesures.aggRencontres.ancres.min)],
    ['collisionsCumulees', ecrit(mesures.collisionsCumulees)],
    ['pairesDistinctes', ecrit(mesures.pairesDistinctes)],
    ['excedentCollisions', ecrit(mesures.excedentCollisions)],
    ['rencontresRepetees', ecrit(mesures.rencontresRepetees.choisies)],
    ['maxRencontresPaire', ecrit(mesures.maxRencontresPaire)],
    ['retoursChoisis', ecrit(mesures.totalRetoursChoisis)],
    ['appartenancesVues', ecrit(mesures.aggAppartenancesVues.tous.min)],
    ['totalRedondance', ecrit(mesures.totalRedondance)],
    ['diversite', ecrit(mesures.aggDiversite.tous.min, 2)],
    ['manqueMax', ecrit(trois.manqueMax.tous)],
    ['effectifManque', ecrit(trois.effectifManque.tous)],
    ['ecartItineraireMax', ecrit(trois.ecartItineraireMax.tous)],
  ]);
}

// Chaque chiffre attendu se lit dans sa cellule ; aucune cellule ne porte
// le minimum de r(p), qui désignerait la personne la mieux servie.
function exigerChiffres(tr, attendue) {
  const lues = cellules(tr);
  expect(attendue.size).toBe(15);
  expect(lues.has('redondance'), 'minimum de r(p)').toBe(false);
  for (const [colonne, texte] of attendue) expect(lues.get(colonne), colonne).toBe(texte);
}

// --- Le tableau classé (§ 5.4, § 5.7, § 19.3 capture 11) --------------------------

describe('le tableau classé', () => {
  test('les trois plans de PLANS_CONFLIT : (6, 6), (4, 2), (4, 1) ; la phrase cite les cinq critères puis l’identifiant ; chaque chiffre est celui du moteur', async () => {
    const chargeLue = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    const m = await ouvrir(chargeLue);
    expect(ids(m)).toEqual([3, 2, 1]);
    const phrase = texteDe(section(m).querySelector('[data-ordre]'));
    expect(phrase).toBe(t('propositions.ordre.criteres', { criteres: [...CRITERES] }));
    const positions = CRITERES.map((nom) => phrase.indexOf(t(`moteur.critere.${nom}`)));
    expect(positions.every((position, rang) => position >= 0 && (rang === 0 || position > positions[rang - 1]))).toBe(true);
    expect(phrase.indexOf('identifiant')).toBeGreaterThan(positions[4]);
    for (const proposition of chargeLue.propositions) exigerChiffres(ligne(m, proposition.id), attendus(chargeLue, proposition));
  });

  test('le minimum seul : aucun en-tête ni aucune cellule ne porte la moyenne des rencontres ; les unités nommées', async () => {
    const chargeLue = generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 50_000 });
    const m = await ouvrir(chargeLue);
    const entetes = [...section(m).querySelectorAll('th')].map(texteDe);
    expect(entetes.length).toBeGreaterThan(0);
    for (const entete of entetes) expect(entete).not.toMatch(/moyenne/i);
    expect(entetes.some((entete) => /collisions cumulées/i.test(entete))).toBe(true);
    expect(entetes.some((entete) => /paires distinctes/i.test(entete))).toBe(true);
    expect(entetes.some((entete) => /excédent de collisions/i.test(entete))).toBe(true);
    const lues = cellules(ligne(m, 1));
    expect(lues.get('rencontresTous')).toBe('24');
    expect(lues.get('rencontresAncres')).toBe('24');
    expect(Number(lues.get('rencontresMobiles'))).toBeGreaterThan(24);
    const instance = normaliser(configurationDepuisCharge(chargeLue));
    const { aggRencontres } = mesurer(instance, indexerPlan(instance, planDepuisFichier(chargeLue.propositions[0])));
    const moyennes = ['tous', 'mobiles'].map((population) => format.nombre(aggRencontres[population].moyenne, { decimales: 2 }));
    for (const texte of lues.values()) for (const moyenne of moyennes) expect(texte).not.toContain(moyenne);
  });

  test('la grande : « 99 retours imposés par 33 ancrages » à part, la ligne « ancrés » à 24, et « atteignabilité inconnue »', async () => {
    const m = await ouvrir(generee(chargeDemo('grande'), { graine: 1, nombre: 1, arret: 50_000 }));
    const lues = cellules(ligne(m, 1));
    expect(lues.get('imposes')).toContain('99 retours imposés par 33 ancrages.');
    expect(lues.get('imposes')).toMatch(/rencontres? répétées? imposées?|Aucune rencontre répétée imposée/);
    expect(lues.get('certificat')).toBe('atteignabilité inconnue');
  });

  test('la petite sans réservation : la colonne « ancrés » porte « — » à chaque ligne ; le plan parfait porte « minimum atteint »', async () => {
    const chargeLue = generee(chargeDemo('petite'), { graine: 4, nombre: 2, arret: 300 });
    const parfaite = propositionDe(chargeLue, 3, [
      [[1, 2, 3], [4, 5, 6], [7, 8, 9], [10, 11, 12]],
      [[6, 9, 12], [3, 8, 11], [2, 5, 10], [1, 4, 7]],
      [[4, 8, 10], [2, 7, 12], [1, 6, 11], [3, 5, 9]],
      [[5, 7, 11], [1, 9, 10], [3, 4, 12], [2, 6, 8]],
    ]);
    chargeLue.propositions.push(parfaite);
    chargeLue.prochainsIds.proposition = 4;
    const m = await ouvrir(chargeLue);
    expect(lignes(m).length).toBe(3);
    for (const tr of lignes(m)) expect(cellules(tr).get('rencontresAncres')).toBe(TIRET);
    expect(cellules(ligne(m, 3)).get('certificat')).toBe('minimum atteint');
  });

  test('les générations s’accumulent : 3, puis 2 sous une autre graine, cinq lignes dans l’ordre de classer sur les cinq', async () => {
    const m = await ouvrir(generee(chargeDemo('petite-conflit'), { graine: 1, nombre: 3, arret: 300 }));
    expect(lignes(m).length).toBe(3);
    const configuration = configurationDepuisCharge(charge(m));
    const propositions = rechercher(configuration, { graine: 2, nombre: 2, arret: 300 });
    await m.seance.executer('enregistrerGeneration', { propositions, configuration, produitVersion: V1 });
    const instance = normaliser(configuration);
    const aPriori = plafondsAPriori(instance);
    const { ordre } = classer(
      charge(m).propositions.map(({ id, ...p }) => ({ id, mesures: mesurer(instance, indexerPlan(instance, planDepuisFichier({ id, ...p }))), plafondsAPriori: aPriori })),
    );
    await attendre(() => expect(ids(m)).toEqual(ordre));
    expect(ordre.length).toBe(5);
  });
});

// --- Retenir, voir sur le plan (§ 2.1 étape 10, § 9) --------------------------------

describe('retenir, voir sur le plan', () => {
  test('retenir la 3 : l’état affiché est « Retenu », charge.retenu.proposition vaut 3, les trois lignes restent et la 3 est marquée', async () => {
    const m = await ouvrir(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    const avant = revision(m);
    commande(ligne(m, 3), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(3));
    expect(revision(m)).toBe(avant + 1);
    const etat = m.racine.querySelector('[data-etat="retenu"]');
    expect(getComputedStyle(etat).fontWeight).toBe('700');
    expect(texteDe(etat)).toBe(t('evenement.etat.retenu'));
    await attendre(() => expect(lignes(m).length).toBe(3));
    const marquees = lignes(m).filter((tr) => texteDe(tr.querySelector('td[data-colonne="proposition"]')).includes(t('propositions.marque.retenue')));
    expect(marquees.map((tr) => Number(tr.dataset.proposition))).toEqual([3]);
    expect(Number(ligneRetenu(m).dataset.retenu)).toBe(3);
  });

  test('retenir la 3, voir la 1 sur le plan : la section du plan s’ouvre sur la proposition 1, sans écriture ; retenir la 2 rend le plan au retenu', async () => {
    const m = await ouvrir(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    commande(ligne(m, 3), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(3));
    const retenu = structuredClone(charge(m).retenu);
    const ecritures = m.trace.length;
    commande(ligne(m, 1), 'voir').click();
    await attendre(() => expect(m.racine.querySelector('[data-section="plan"]')).not.toBeNull());
    expect(m.ui.etat().proposition).toBe(1);
    const proposition = (id) => charge(m).propositions.find((candidate) => candidate.id === id);
    // Les trois placements diffèrent au tour 1 : le plan montré se distingue
    // du retenu.
    expect(occupantsDuPlacement(charge(m), proposition(1))).not.toEqual(occupantsDuPlacement(charge(m), retenu));
    await exigerPlanMontre(m, proposition(1));
    expect(occupantsDessines(m).size).toBe(4);
    expect(m.trace.length).toBe(ecritures);
    expect(charge(m).retenu).toEqual(retenu);
    m.ui.allerA('propositions');
    flushSync();
    commande(ligne(m, 2), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(2));
    expect(m.ui.etat().proposition).toBe(null);
    m.ui.allerA('plan');
    flushSync();
    await exigerPlanMontre(m, charge(m).retenu);
    expect(occupantsDuPlacement(charge(m), charge(m).retenu)).not.toEqual(occupantsDuPlacement(charge(m), proposition(1)));
  });

  test('la ligne du retenu montre ses violations ; la colonne rang se lit, « Retenu » puis 1 à n dans l’ordre', async () => {
    const base = executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 });
    // Une réservation que le retenu n'honore pas : la personne 1, assise
    // ailleurs qu'à la première table.
    base.reservations = [{ participant: 1, table: base.tables[0].id, siege: 1, portee: 'tous', tour: null }];
    const m = await ouvrir(base);
    const vue = tableau(evaluation(charge(m)).table);
    expect(vue.retenu.violations.length).toBeGreaterThan(0);
    const cellule = ligneRetenu(m).querySelector('td[data-colonne="proposition"]');
    for (const violation of vue.retenu.violations) {
      expect(texteDe(cellule)).toContain(t(violation.cle, violation.details).replace(/\s+/g, ' ').trim());
    }
    expect(texteDe(ligneRetenu(m).querySelector('[data-colonne="rang"]'))).toBe(t('propositions.retenu.titre'));
    expect(lignes(m).map((tr) => texteDe(tr.querySelector('[data-colonne="rang"]')))).toEqual(vue.lignes.map((_, rang) => format.nombre(rang + 1)));
    expect(ids(m)).toEqual(vue.lignes.map(({ id }) => id));
  });

  // Les lignes du texte d'un élément : les boîtes de ses fragments de
  // texte, rangées de haut en bas, dont chacune ouvre une ligne quand elle
  // commence sous le milieu de la ligne courante.
  function lignesDuTexte(element) {
    const boites = [];
    const parcours = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    for (let noeud = parcours.nextNode(); noeud !== null; noeud = parcours.nextNode()) {
      const plage = document.createRange();
      plage.selectNodeContents(noeud);
      boites.push(...[...plage.getClientRects()].filter((r) => r.width > 0 && r.height > 0));
    }
    boites.sort((a, b) => a.top - b.top);
    let lignes = 0;
    let milieu = -Infinity;
    for (const r of boites) {
      if (r.top < milieu) continue;
      lignes += 1;
      milieu = (r.top + r.bottom) / 2;
    }
    return lignes;
  }

  test('à 1 366 px, la cellule de la ligne du retenu tient son numéro et « Tel que la proposition n° 3. » en trois lignes au plus', async () => {
    const m = await ouvrir(executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 }));
    const cellule = await attendre(() => {
      const trouvee = ligneRetenu(m)?.querySelector('td[data-colonne="proposition"]');
      expect(trouvee ?? null).not.toBeNull();
      return trouvee;
    });
    const vue = tableau(evaluation(charge(m)).table);
    const libelle = t(vue.retenu.libelle.cle, vue.retenu.libelle.details);
    expect(libelle).toBe('Tel que la proposition n° 3.');
    expect(texteDe(cellule)).toBe(`${format.nombre(3)} ${libelle}`);
    expect(lignesDuTexte(cellule)).toBeLessThanOrEqual(3);
  });

  test('à 1 366 px, la cellule du retenu ajusté tient son numéro et « Ajusté à la main depuis la proposition n° 2. » en trois lignes au plus', async () => {
    const m = await ouvrir(chargeSix());
    commande(ligne(m, 2), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(2));
    await m.seance.executer('deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    const libelle = t('propositions.retenu.ajuste', { proposition: 2 });
    const cellule = await attendre(() => {
      const trouvee = ligneRetenu(m).querySelector('td[data-colonne="proposition"]');
      expect(texteDe(trouvee)).toBe(`${format.nombre(2)} ${libelle}`);
      return trouvee;
    });
    expect(lignesDuTexte(cellule)).toBeLessThanOrEqual(3);
  });

  test('« Voir » de la ligne du retenu montre le retenu sur le plan, après une proposition demandée, sans écriture', async () => {
    const m = await ouvrir(executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 }));
    m.ui.montrerProposition(1);
    const ecritures = m.trace.length;
    const voir = commande(ligneRetenu(m), 'voir');
    expect(texteDe(voir)).toBe(t('propositions.commande.voir'));
    voir.click();
    await attendre(() => expect(m.racine.querySelector('[data-section="plan"]')).not.toBeNull());
    expect(m.ui.etat().proposition).toBe(null);
    await exigerPlanMontre(m, charge(m).retenu);
    expect(m.trace.length).toBe(ecritures);
  });

  test('les indicateurs suivent l’ajustement : la ligne du retenu égale sa mesure, celle de la proposition 2 n’a pas changé', async () => {
    const m = await ouvrir(chargeSix());
    commande(ligne(m, 2), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(2));
    const avant = cellules(ligne(m, 2));
    await m.seance.executer('deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    const chargeLue = charge(m);
    await attendre(() => exigerChiffres(ligneRetenu(m), attendus(chargeLue, chargeLue.retenu)));
    expect(cellules(ligne(m, 2))).toEqual(avant);
    expect(texteDe(ligneRetenu(m))).toContain(t('propositions.retenu.ajuste', { proposition: 2 }));
  });
});

// --- Le retenu ajusté (§ 2.1, § 5.9) -----------------------------------------------

describe('retenir sur un retenu ajusté', () => {
  test('retenir la 3 ouvre une fenêtre qui nomme le retenu ajusté et la 3 ; Annuler n’écrit rien ; Confirmer retient la 3, une entrée', async () => {
    const m = await ouvrir(chargeSix());
    commande(ligne(m, 2), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(2));
    await m.seance.executer('deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null });
    flushSync();
    const ajuste = structuredClone(charge(m).retenu);
    const ecritures = m.trace.length;
    commande(ligne(m, 3), 'retenir').click();
    const fenetre = await attendre(() => {
      const ouverte = fenetreOuverte(m);
      expect(ouverte).not.toBeNull();
      return ouverte;
    });
    const texte = texteDe(fenetre);
    expect(texte).toContain(t('propositions.confirmation.retenuAjuste', { proposition: 2 }));
    expect(texte).toContain(t('propositions.confirmation.remplacant', { proposition: 3 }));
    commande(fenetre, 'renoncer').click();
    await attendre(() => expect(fenetreOuverte(m)).toBeNull());
    expect(m.trace.length).toBe(ecritures);
    expect(charge(m).retenu).toEqual(ajuste);
    const avant = revision(m);
    commande(ligne(m, 3), 'retenir').click();
    const seconde = await attendre(() => {
      const ouverte = fenetreOuverte(m);
      expect(ouverte).not.toBeNull();
      return ouverte;
    });
    commande(seconde, 'confirmer').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(3));
    await attendre(() => expect(fenetreOuverte(m)).toBeNull());
    expect(revision(m)).toBe(avant + 1);
  });

  test('sans ajustement, retenir une autre proposition n’ouvre aucune fenêtre', async () => {
    const m = await ouvrir(chargeSix());
    commande(ligne(m, 2), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(2));
    commande(ligne(m, 3), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(3));
    expect(fenetreOuverte(m)).toBeNull();
  });
});

// --- Effacer (§ 5.7) ----------------------------------------------------------------

// --- « Qualité », sur chaque ligne (§ 12, D25) ------------------------------------

describe('« Qualité », sur chaque ligne', () => {
  test('chaque ligne — classée, hors classement, celle du retenu — offre « Qualité » après « Voir sur le plan » ; elle montre sa proposition au plan, ou le retenu, et ouvre la page de qualité, sans écriture', async () => {
    let chargeLue = executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 });
    chargeLue = executer(chargeLue, 'exclureParticipant', { id: 12 });
    chargeLue = generee(chargeLue, { graine: 2, nombre: 2, arret: 40 });
    const m = await ouvrir(chargeLue);
    const ecritures = m.trace.length;
    expect(section(m).querySelector('[data-hors-classement] tr[data-proposition]')).not.toBeNull();
    const rangees = [ligneRetenu(m), ...lignes(m)];
    expect(rangees.length).toBe(1 + chargeLue.propositions.length);
    for (const tr of rangees) {
      const noms = [...tr.querySelectorAll('td[data-colonne="commandes"] [data-commande]')].map((bouton) => bouton.dataset.commande);
      expect(noms.slice(0, 2), tr.dataset.proposition ?? 'retenu').toEqual(['voir', 'qualite']);
      expect(texteDe(commande(tr, 'qualite'))).toBe(t('propositions.commande.qualite'));
    }
    for (const id of [...ids(m), null]) {
      m.ui.allerA('propositions');
      flushSync();
      const tr = id === null ? ligneRetenu(m) : ligne(m, id);
      commande(tr, 'qualite').click();
      await attendre(() => expect(m.racine.querySelector('[data-section="qualite"]')).not.toBeNull());
      expect(m.ui.etat().proposition).toBe(id);
      expect(m.racine.querySelector('[data-refus]')).toBeNull();
    }
    expect(m.trace.length).toBe(ecritures);
    expect(charge(m).retenu.proposition).toBe(3);
  });
});

describe('effacer', () => {
  test('retenir la 2, effacer : seule la 2 reste, charge.retenu intact, une entrée', async () => {
    const m = await ouvrir(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    commande(ligne(m, 2), 'retenir').click();
    await attendre(() => expect(charge(m).retenu?.proposition).toBe(2));
    const retenu = structuredClone(charge(m).retenu);
    const avant = revision(m);
    commande(section(m), 'effacer').click();
    await attendre(() => expect(ids(m)).toEqual([2]));
    expect(charge(m).propositions.map(({ id }) => id)).toEqual([2]);
    expect(charge(m).retenu).toEqual(retenu);
    expect(revision(m)).toBe(avant + 1);
  });

  test('sans retenue, la liste se vide et la section le dit', async () => {
    const m = await ouvrir(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT));
    commande(section(m), 'effacer').click();
    await attendre(() => expect(lignes(m).length).toBe(0));
    expect(charge(m).propositions).toEqual([]);
    expect(texteDe(section(m))).toContain(t('propositions.aucune'));
  });
});

// --- Les populations différentes (§ 9, § 12.6) -------------------------------------

describe('les populations différentes', () => {
  test('générer, exclure une personne, générer encore : les premières hors classement, « non comparables », nomment la personne exclue', async () => {
    let chargeLue = generee(chargeDemo('petite'), { graine: 1, nombre: 2, arret: 200 });
    chargeLue = executer(chargeLue, 'exclureParticipant', { id: 4 });
    chargeLue = generee(chargeLue, { graine: 2, nombre: 2, arret: 200 });
    const m = await ouvrir(chargeLue);
    const classees = [...section(m).querySelectorAll('[data-classement] tr[data-proposition]')].map((tr) => Number(tr.dataset.proposition));
    expect(classees.sort()).toEqual([3, 4]);
    const hors = [...section(m).querySelectorAll('[data-hors-classement] tr[data-proposition]')];
    expect(hors.map((tr) => Number(tr.dataset.proposition))).toEqual([1, 2]);
    const nom = nomAffiche(chargeLue.participants.find(({ id }) => id === 4));
    for (const tr of hors) {
      const texte = texteDe(tr);
      expect(texte).toContain(t('propositions.statut.derive'));
      expect(texte).toContain(t('PARTICIPANT_EXCLU', { participant: 4 }));
      expect(texte).toContain(nom);
    }
  });
});

// --- Vivant en lecture (§ 8.4, § 9) -------------------------------------------------

describe('en lecture et sur un plan bloqué', () => {
  test('en lecture : le tableau se lit ; « Retenir » et « Effacer » refusés à côté d’eux, avec « Modifier », sans fenêtre ni écriture', async () => {
    const m = await ouvrir(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), { mode: 'lecture' });
    expect(ids(m)).toEqual([3, 2, 1]);
    const ecritures = m.trace.length;
    const retenir = commande(ligne(m, 3), 'retenir');
    retenir.click();
    const refus = await attendre(() => {
      const pose = refusPres(retenir, 'MODE_LECTURE');
      expect(pose).not.toBeNull();
      return pose;
    });
    expect(commande(refus, 'modifier')).not.toBeNull();
    const effacer = commande(section(m), 'effacer');
    effacer.click();
    await attendre(() => expect(refusPres(effacer, 'MODE_LECTURE')).not.toBeNull());
    expect(fenetreOuverte(m)).toBeNull();
    expect(m.trace.length).toBe(ecritures);
    expect(charge(m).retenu).toBe(null);
  });

  test('sur un plan bloqué, retenu ajusté : « Retenir » refusé avec « Débloquer », sans fenêtre ; « Effacer » aussi', async () => {
    const chargeLue = executer(chargeSix(), 'retenirProposition', { id: 2 });
    const bloquee = executer(executer(chargeLue, 'deplacerDansRetenu', { tour: 1, participant: 1, table: 2, siege: null }), 'changerEtat', { etat: 'bloque' });
    const m = await ouvrir(bloquee, { mode: 'lecture' });
    expect(lignes(m).length).toBe(3);
    const ecritures = m.trace.length;
    const retenir = commande(ligne(m, 3), 'retenir');
    retenir.click();
    const refus = await attendre(() => {
      const pose = refusPres(retenir, 'LECTURE_SEULE');
      expect(pose).not.toBeNull();
      return pose;
    });
    expect(texteDe(refus)).toContain(t('LECTURE_SEULE', { raison: 'BLOQUE' }));
    expect(commande(refus, 'debloquer')).not.toBeNull();
    expect(fenetreOuverte(m)).toBeNull();
    const effacer = commande(section(m), 'effacer');
    effacer.click();
    await attendre(() => expect(refusPres(effacer, 'LECTURE_SEULE')).not.toBeNull());
    expect(m.trace.length).toBe(ecritures);
  });
});

// --- La phrase de l'ordre désigne les colonnes (§ 5.7) ---------------------------

// Chaque nom de la phrase et la colonne qu'il désigne, dans l'ordre de la
// phrase : les cinq critères, puis l'identifiant croissant.
const COLONNE_DESIGNEE = [
  ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPriori'],
  ['excedentCollisions', 'excedentCollisions'],
  ['collisionsCumulees', 'collisionsCumulees'],
  ['rencontresRepetees', 'rencontresRepetees'],
  ['redondance', 'totalRedondance'],
  ['identifiant', 'proposition'],
];

// La couleur calculée d'un jeton, lue sur une sonde posée le temps d'une
// lecture.
function couleurDuJeton(jeton) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${jeton})`;
  document.body.append(sonde);
  try {
    return getComputedStyle(sonde).color;
  } finally {
    sonde.remove();
  }
}

// Une cellule porte-t-elle, à gauche et à droite, le filet de 2 px de la
// couleur de sélection ? Un voisin n'en partage qu'un.
function porteFilets(cellule, selection) {
  const style = getComputedStyle(cellule);
  return ['Left', 'Right'].every((cote) => style[`border${cote}Width`] === '2px' && style[`border${cote}Color`] === selection);
}

// Les cellules du tableau, en-têtes compris, que le rendu montre surlignées :
// les deux filets de sélection, et l'en-tête souligné en plus.
function surlignees(m) {
  const selection = couleurDuJeton('--couleur-selection');
  const cellulesLues = [...section(m).querySelectorAll('th[data-colonne], td[data-colonne]')];
  expect(cellulesLues.length).toBeGreaterThan(0);
  return cellulesLues.filter((cellule) => {
    const souligne = cellule.closest('thead') === null || getComputedStyle(cellule).textDecorationLine.includes('underline');
    return porteFilets(cellule, selection) && souligne;
  });
}

// Les éléments du tableau que data-marque désigne : ceux que la garde des
// marques (§ 14.5) mesure.
const marquees = (m) => [...section(m).querySelectorAll('table [data-marque]')];

// Les cellules d'une colonne : son en-tête et chacune de ses cellules.
const colonne = (m, nom) => [...section(m).querySelectorAll(`th[data-colonne="${nom}"], td[data-colonne="${nom}"]`)];

// Les noms de la phrase qui désignent une colonne, dans leur ordre.
const nomsDesignants = (m) => [...section(m).querySelectorAll('[data-ordre] [data-critere]')];

describe('la phrase de l’ordre désigne les colonnes (§ 5.7)', () => {
  // Le retenu, sur sa ligne, au-dessus des trois propositions classées.
  const chargeRetenue = () => executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 });

  // Le pointeur réel reste où l'épreuve précédente l'a laissé : posé sur un
  // nom de la phrase, il surlignerait sa colonne dès le montage suivant.
  // Chaque épreuve part du coin du cadre, hors de la phrase.
  beforeEach(async () => {
    await pointer('bouger', 0, 0);
  });

  test('survoler chaque nom de critère, au pointeur réel, surligne sa colonne seule — en-tête, retenu et lignes classées — ; le quitter l’efface', async () => {
    const m = await ouvrir(chargeRetenue());
    const noms = nomsDesignants(m);
    expect(noms.map((nom) => nom.dataset.critere)).toEqual(COLONNE_DESIGNEE.map(([critere]) => critere));
    expect(surlignees(m)).toEqual([]);
    for (const [critere, nomColonne] of COLONNE_DESIGNEE) {
      const nom = section(m).querySelector(`[data-ordre] [data-critere="${critere}"]`);
      const { x, y } = await centre(nom);
      await pointer('bouger', x, y);
      const attendues = colonne(m, nomColonne);
      expect(attendues.length, nomColonne).toBe(5);
      await attendre(() => expect(surlignees(m), critere).toEqual(attendues));
      // Chaque cellule surlignée, et elle seule, se désigne comme marque de
      // sélection : la garde transversale mesure son filet à 3:1.
      expect(marquees(m), critere).toEqual(attendues);
      for (const cellule of attendues) expect(cellule.dataset.marque, critere).toBe('selection');
    }
    const titre = section(m).querySelector('h2');
    const { x, y } = await centre(titre);
    await pointer('bouger', x, y);
    await attendre(() => expect(surlignees(m)).toEqual([]));
    expect(marquees(m)).toEqual([]);
  });

  test('avec des propositions hors classement : l’identifiant surligne aussi leur cellule « proposition » ; un critère de mesure ne surligne jamais la cellule de leurs raisons', async () => {
    let chargeLue = generee(chargeDemo('petite'), { graine: 1, nombre: 2, arret: 200 });
    chargeLue = executer(chargeLue, 'exclureParticipant', { id: 4 });
    chargeLue = generee(chargeLue, { graine: 2, nombre: 2, arret: 200 });
    const m = await ouvrir(chargeLue);
    const hors = [...section(m).querySelectorAll('[data-hors-classement] tr[data-proposition]')];
    expect(hors.length).toBe(2);
    const identites = hors.map((tr) => tr.querySelector('td[data-colonne="proposition"]'));
    const raisons = hors.map((tr) => tr.querySelector('td[colspan]'));
    for (const cellule of [...identites, ...raisons]) expect(cellule).not.toBeNull();

    const nomIdentifiant = section(m).querySelector('[data-ordre] [data-critere="identifiant"]');
    let point = await centre(nomIdentifiant);
    await pointer('bouger', point.x, point.y);
    const attendues = colonne(m, 'proposition');
    for (const cellule of identites) expect(attendues).toContain(cellule);
    await attendre(() => expect(surlignees(m)).toEqual(attendues));
    expect(marquees(m)).toEqual(attendues);

    const selection = couleurDuJeton('--couleur-selection');
    for (const [critere, nomColonne] of COLONNE_DESIGNEE.filter(([, nomColonne]) => nomColonne !== 'proposition')) {
      point = await centre(section(m).querySelector(`[data-ordre] [data-critere="${critere}"]`));
      await pointer('bouger', point.x, point.y);
      await attendre(() => expect(surlignees(m), critere).toEqual(colonne(m, nomColonne)));
      for (const cellule of raisons) {
        expect(porteFilets(cellule, selection), critere).toBe(false);
        expect(cellule.dataset.marque, critere).toBeUndefined();
      }
    }
  });

  test('au clavier : chaque nom se focalise (tabindex 0) et surligne sa colonne seule ; Tab passe au suivant ; quitter le dernier l’efface', async () => {
    const m = await ouvrir(chargeRetenue());
    const noms = nomsDesignants(m);
    expect(noms.length).toBe(COLONNE_DESIGNEE.length);
    for (const nom of noms) expect(nom.tabIndex).toBe(0);
    noms[0].focus();
    for (const [rang, [critere, nomColonne]] of COLONNE_DESIGNEE.entries()) {
      if (rang > 0) await touche('Tab');
      await attendre(() => expect(document.activeElement?.dataset?.critere).toBe(critere));
      await attendre(() => expect(surlignees(m), critere).toEqual(colonne(m, nomColonne)));
    }
    await touche('Tab');
    await attendre(() => expect(document.activeElement?.dataset?.critere).toBeUndefined());
    await attendre(() => expect(surlignees(m)).toEqual([]));
  });

  test('le survol et le focus tiennent chacun leur nom : quitter le survolé rend la colonne du focalisé, et le nom actif se souligne plein', async () => {
    const m = await ouvrir(chargeRetenue());
    const nom = (critere) => section(m).querySelector(`[data-ordre] [data-critere="${critere}"]`);
    const [[a, colonneA], [b, colonneB]] = COLONNE_DESIGNEE;
    // Focus sur B, puis survol de A et sortie : B reste surlignée.
    nom(b).focus();
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, colonneB)));
    expect(getComputedStyle(nom(b)).textDecorationStyle).toBe('solid');
    let point = await centre(nom(a));
    await pointer('bouger', point.x, point.y);
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, colonneA)));
    expect(getComputedStyle(nom(a)).textDecorationStyle).toBe('solid');
    expect(getComputedStyle(nom(b)).textDecorationStyle).toBe('dotted');
    await pointer('bouger', 0, 0);
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, colonneB)));
    // Survol de A, puis Tab vers B, puis sortie de A : B reste surlignée.
    nom(b).blur();
    await attendre(() => expect(surlignees(m)).toEqual([]));
    point = await centre(nom(a));
    await pointer('bouger', point.x, point.y);
    nom(a).focus();
    await touche('Tab');
    await attendre(() => expect(document.activeElement).toBe(nom(b)));
    await pointer('bouger', 0, 0);
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, colonneB)));
    // Le focus perdu, plus rien.
    nom(b).blur();
    await attendre(() => expect(surlignees(m)).toEqual([]));
  });

  test('le texte de la phrase reste celui de l’ordre, mot pour mot, et le surlignage ne change aucune couleur de texte', async () => {
    const m = await ouvrir(chargeRetenue());
    // Le texte brut, espaces compris : aucun blanc ne s'ajoute entre deux
    // morceaux.
    expect(section(m).querySelectorAll('[data-ordre] p').length).toBe(1);
    expect(section(m).querySelector('[data-ordre] p').textContent).toBe(
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis excédent de collisions, " +
        "puis collisions cumulées, puis rencontres répétées, puis redondance d'appartenance, puis l'identifiant croissant.",
    );
    const cible = colonne(m, 'excedentCollisions');
    const avant = cible.map((cellule) => [getComputedStyle(cellule).color, getComputedStyle(cellule).backgroundColor]);
    const { x, y } = await centre(section(m).querySelector('[data-ordre] [data-critere="excedentCollisions"]'));
    await pointer('bouger', x, y);
    await attendre(() => expect(surlignees(m)).toEqual(cible));
    expect(cible.map((cellule) => [getComputedStyle(cellule).color, getComputedStyle(cellule).backgroundColor])).toEqual(avant);
  });
});

// --- Les infobulles d'explication (§ 5.4, § 5.5, § 5.7, § 12.7) -------------------

// La clé de l'explication d'une colonne, celle du contrat de modele.js, que
// l'épreuve node du modèle confronte à COLONNES ; t lève sur une clé absente.
const explicationDeColonne = (nom) => `propositions.explication.${nom}`;

// Les colonnes du tableau, dans l'ordre d'affichage.
const NOMS_DES_COLONNES = [
  'rang',
  'proposition',
  'rencontresTous',
  'rencontresMobiles',
  'rencontresAncres',
  'collisionsCumulees',
  'pairesDistinctes',
  'excedentCollisions',
  'rencontresRepetees',
  'maxRencontresPaire',
  'retoursChoisis',
  'appartenancesVues',
  'totalRedondance',
  'diversite',
  'manqueMax',
  'effectifManque',
  'ecartItineraireMax',
  'ecartAuPlafondAPriori',
  'certificat',
  'imposes',
  'commandes',
];

// Les infobulles du document : une seule, [role=tooltip], que chaque nom de
// la phrase et chaque en-tête de colonne ouvrent tour à tour.
const infobulles = () => [...document.querySelectorAll('[role="tooltip"]')];

// L'infobulle unique, ouverte sur l'ancre donnée : visible, au texte de la
// clé, désignée par l'aria-describedby de l'ancre et de nulle autre, dans
// la fenêtre, et hors du rectangle de l'ancre.
function exigerInfobulle(ancre, cle) {
  const bulles = infobulles();
  expect(bulles.length).toBe(1);
  const [bulle] = bulles;
  expect(bulle.hidden, cle).toBe(false);
  expect(getComputedStyle(bulle).visibility, cle).toBe('visible');
  expect(texteDe(bulle), cle).toBe(t(cle));
  expect(bulle.id, cle).not.toBe('');
  expect(ancre.getAttribute('aria-describedby'), cle).toBe(bulle.id);
  expect(document.querySelectorAll(`[aria-describedby~="${bulle.id}"]`).length, cle).toBe(1);
  const b = bulle.getBoundingClientRect();
  const a = ancre.getBoundingClientRect();
  expect(b.width, cle).toBeGreaterThan(0);
  expect(b.height, cle).toBeGreaterThan(0);
  const racine = document.documentElement;
  expect(b.left >= 0 && b.top >= 0 && b.right <= racine.clientWidth && b.bottom <= racine.clientHeight, `${cle} dans la fenêtre`).toBe(true);
  const recouvre = b.left < a.right && a.left < b.right && b.top < a.bottom && a.top < b.bottom;
  expect(recouvre, `${cle} sur son ancre`).toBe(false);
}

// L'infobulle fermée : cachée, et aucun élément ne la désigne.
function exigerFermee() {
  const bulles = infobulles();
  expect(bulles.length).toBe(1);
  const [bulle] = bulles;
  expect(bulle.hidden || bulle.getBoundingClientRect().width === 0).toBe(true);
  expect(document.querySelectorAll(`[aria-describedby~="${bulle.id}"]`).length).toBe(0);
}

const enTetes = (m) => [...section(m).querySelectorAll('thead th[data-colonne]')];

describe('les infobulles d’explication : chaque nom de critère, chaque en-tête de colonne', () => {
  const chargeRetenue = () => executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 });

  // Le pointeur réel part du coin du cadre, hors de la phrase et du tableau.
  beforeEach(async () => {
    await pointer('bouger', 0, 0);
  });

  test('survoler chaque nom de critère ouvre l’explication de sa colonne, qui se surligne toujours ; le quitter la ferme', async () => {
    const m = await ouvrir(chargeRetenue());
    exigerFermee();
    expect(nomsDesignants(m).length).toBe(COLONNE_DESIGNEE.length);
    for (const [critere, nomColonne] of COLONNE_DESIGNEE) {
      const nom = section(m).querySelector(`[data-ordre] [data-critere="${critere}"]`);
      const { x, y } = await centre(nom);
      await pointer('bouger', x, y);
      await attendre(() => exigerInfobulle(nom, explicationDeColonne(nomColonne)));
      await attendre(() => expect(surlignees(m), critere).toEqual(colonne(m, nomColonne)));
    }
    const { x, y } = await centre(section(m).querySelector('h2'));
    await pointer('bouger', x, y);
    await attendre(() => exigerFermee());
    await attendre(() => expect(surlignees(m)).toEqual([]));
  });

  test('quitter un terme ne ferme que sa propre explication : survol d’un nom, focus d’un en-tête, puis le pointeur sort du nom — l’en-tête garde la sienne', async () => {
    const m = await ouvrir(chargeRetenue());
    const [[critere, nomColonne]] = COLONNE_DESIGNEE;
    const nom = section(m).querySelector(`[data-ordre] [data-critere="${critere}"]`);
    const th = enTetes(m).find((candidat) => candidat.dataset.colonne !== nomColonne);
    const { x, y } = await centre(nom);
    await pointer('bouger', x, y);
    await attendre(() => exigerInfobulle(nom, explicationDeColonne(nomColonne)));
    th.focus();
    await attendre(() => exigerInfobulle(th, explicationDeColonne(th.dataset.colonne)));
    await pointer('bouger', 0, 0);
    await new Promise((resoudre) => requestAnimationFrame(resoudre));
    flushSync();
    exigerInfobulle(th, explicationDeColonne(th.dataset.colonne));
    th.blur();
    await attendre(() => exigerFermee());
  });

  test('survoler chaque en-tête de colonne ouvre son explication, dans la fenêtre, hors de l’en-tête ; le quitter la ferme', async () => {
    const m = await ouvrir(chargeRetenue());
    const ths = enTetes(m);
    expect(ths.map((th) => th.dataset.colonne)).toEqual(NOMS_DES_COLONNES);
    // Le pointeur quitte le tableau pour le titre de la section : aucun
    // terme n'est plus survolé, l'infobulle se ferme.
    const sortir = async () => {
      const { x, y } = await centre(section(m).querySelector('h2'));
      await pointer('bouger', x, y);
      await attendre(() => exigerFermee());
    };
    for (const th of ths) {
      const { x, y } = await centre(th);
      await pointer('bouger', x, y);
      await attendre(() => exigerInfobulle(th, explicationDeColonne(th.dataset.colonne)));
    }
    await sortir();
    // Le dernier en-tête, collé au bord droit de la fenêtre : l'infobulle
    // recule dans la fenêtre.
    const dernier = ths.at(-1);
    dernier.scrollIntoView({ block: 'nearest', inline: 'end' });
    const b = dernier.getBoundingClientRect();
    await pointer('bouger', b.right - 4, b.top + b.height / 2);
    await attendre(() => exigerInfobulle(dernier, explicationDeColonne(dernier.dataset.colonne)));
    await sortir();
  });

  test('au clavier : Tab focalise chaque nom puis chaque en-tête et ouvre son explication ; Échap la ferme, le focus reste ; sortir la ferme', async () => {
    const m = await ouvrir(chargeRetenue());
    const ancres = [...nomsDesignants(m), ...enTetes(m)];
    expect(ancres.length).toBe(COLONNE_DESIGNEE.length + NOMS_DES_COLONNES.length);
    for (const ancre of ancres) expect(ancre.tabIndex).toBe(0);
    const cleDe = (ancre) =>
      explicationDeColonne(ancre.dataset.critere === undefined ? ancre.dataset.colonne : COLONNE_DESIGNEE.find(([critere]) => critere === ancre.dataset.critere)[1]);
    ancres[0].focus();
    for (const [rang, ancre] of ancres.entries()) {
      if (rang > 0) await touche('Tab');
      await attendre(() => expect(document.activeElement).toBe(ancre));
      await attendre(() => exigerInfobulle(ancre, cleDe(ancre)));
      if (rang === 2 || rang === COLONNE_DESIGNEE.length + 1) {
        await touche('Escape');
        await attendre(() => exigerFermee());
        expect(document.activeElement).toBe(ancre);
      }
    }
    await touche('Tab');
    await attendre(() => expect(ancres).not.toContain(document.activeElement));
    await attendre(() => exigerFermee());
  });

  test('le tableau défile sous un en-tête focalisé : l’infobulle suit son en-tête', async () => {
    const m = await ouvrir(chargeRetenue());
    const th = enTetes(m).find((cellule) => cellule.dataset.colonne === 'retoursChoisis');
    const defilement = th.closest('table').parentElement;
    expect(defilement.scrollWidth).toBeGreaterThan(defilement.clientWidth + 200);
    th.scrollIntoView({ block: 'nearest', inline: 'center' });
    th.focus({ preventScroll: true });
    await attendre(() => exigerInfobulle(th, explicationDeColonne('retoursChoisis')));
    const [bulle] = infobulles();
    const decalage = () => bulle.getBoundingClientRect().left - th.getBoundingClientRect().left;
    expect(decalage()).toBe(0);
    const avant = th.getBoundingClientRect().left;
    defilement.scrollLeft += 150;
    await attendre(() => expect(th.getBoundingClientRect().left).not.toBe(avant));
    await attendre(() => expect(decalage()).toBe(0));
    exigerInfobulle(th, explicationDeColonne('retoursChoisis'));
  });

  test('un nom trop près du bas de la fenêtre : l’infobulle s’ouvre au-dessus de lui', async () => {
    const m = await ouvrir(chargeRetenue());
    const nom = () => section(m).querySelector('[data-ordre] [data-critere="ecartAuPlafondAPrioriMax"]');
    await fixerCadre(1366, Math.ceil(nom().getBoundingClientRect().bottom) + 40);
    await attendre(() => expect(nom().getBoundingClientRect().bottom).toBeLessThanOrEqual(document.documentElement.clientHeight));
    const { x, y } = await centre(nom());
    await pointer('bouger', x, y);
    await attendre(() => exigerInfobulle(nom(), explicationDeColonne('ecartAuPlafondAPriori')));
    const [bulle] = infobulles();
    expect(bulle.getBoundingClientRect().bottom).toBeLessThanOrEqual(nom().getBoundingClientRect().top);
  });

  test('Échap ferme l’infobulle ouverte au survol ; un autre nom survolé la rouvre sur le sien', async () => {
    const m = await ouvrir(chargeRetenue());
    const premier = section(m).querySelector('[data-ordre] [data-critere="excedentCollisions"]');
    const second = enTetes(m).find((th) => th.dataset.colonne === 'pairesDistinctes');
    let point = await centre(premier);
    await pointer('bouger', point.x, point.y);
    await attendre(() => exigerInfobulle(premier, explicationDeColonne('excedentCollisions')));
    await touche('Escape');
    await attendre(() => exigerFermee());
    point = await centre(second);
    await pointer('bouger', point.x, point.y);
    await attendre(() => exigerInfobulle(second, explicationDeColonne('pairesDistinctes')));
  });
});

// --- La cible de la somme de redondance (§ 5.4, § 8.1, § 8.9) ---------------------

describe('la cible de la somme de redondance : un champ de la section', () => {
  const champCible = (m) => section(m).querySelector('[data-champ="cibleRedondance"]');

  // Saisit un texte dans le champ, comme une frappe, puis quitte le champ :
  // la sortie valide la saisie (Champ).
  async function saisirCible(m, texte) {
    const entree = champCible(m);
    entree.focus();
    entree.value = texte;
    entree.dispatchEvent(new Event('input', { bubbles: true }));
    flushSync();
    entree.blur();
    flushSync();
  }

  test('le champ montre 1000 sans réglage ; 25 saisi écrit une entrée, la cible 25 ; défaire rend 1000', async () => {
    const m = await ouvrir(chargeDemo('petite'));
    const entree = champCible(m);
    expect(entree).not.toBeNull();
    expect(entree.value).toBe('1000');
    expect(texteDe(entree.closest('label') ?? section(m))).toContain(t('propositions.cible.etiquette'));
    const avant = revision(m);
    await saisirCible(m, '25');
    await attendre(() => expect(charge(m).reglages.cibleRedondance).toBe(25));
    expect(revision(m)).toBe(avant + 1);
    await m.seance.defaire();
    await attendre(() => expect(champCible(m).value).toBe('1000'));
    expect(Object.hasOwn(charge(m).reglages, 'cibleRedondance')).toBe(false);
  });

  test('en lecture, la saisie est refusée MODE_LECTURE contre le champ, rien n’écrit ; une saisie négative, NON_ENTIER', async () => {
    const lecture = await ouvrir(chargeDemo('petite'), { mode: 'lecture' });
    const avant = revision(lecture);
    await saisirCible(lecture, '25');
    await attendre(() => expect(section(lecture).querySelector('[data-refus="MODE_LECTURE"]')).not.toBeNull());
    expect(revision(lecture)).toBe(avant);
    expect(Object.hasOwn(charge(lecture).reglages, 'cibleRedondance')).toBe(false);

    const ecriture = await ouvrir(chargeDemo('petite'));
    const revisionEcriture = revision(ecriture);
    await saisirCible(ecriture, '-3');
    await attendre(() => expect(section(ecriture).querySelector('[data-refus="NON_ENTIER"]')).not.toBeNull());
    expect(revision(ecriture)).toBe(revisionEcriture);
  });
});

// --- L'habillage : carte, en-têtes groupés, ligne du retenu (§ 5.7, § 12.7) -------

// La carte qui porte un élément : le plus proche ancêtre peint du fond de la
// carte, au rayon de 12 px ; null sans elle.
function carteDe(element) {
  const fond = couleurDeJeton('--couleur-carte-fond').join();
  for (let n = element.parentElement; n !== null; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (composantes(style.backgroundColor).join() === fond && style.borderTopLeftRadius === '12px') return n;
  }
  return null;
}

// Les colonnes de nombres : le rang et chaque mesure, sauf le certificat.
const COLONNES_NOMBRES = NOMS_DES_COLONNES.filter((nom) => !['proposition', 'certificat', 'imposes', 'commandes'].includes(nom));

describe('l’habillage du tableau des propositions', () => {
  const chargeRetenue = () => executer(avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT), 'retenirProposition', { id: 3 });

  test('le tableau vit dans une carte de la section, et son conteneur défilant reste dans la carte', async () => {
    const m = await ouvrir(chargeRetenue());
    const table = section(m).querySelector('table');
    const carte = carteDe(table);
    expect(carte, 'carte du tableau').not.toBeNull();
    expect(section(m).contains(carte)).toBe(true);
    const defilement = table.parentElement;
    const b = carte.getBoundingClientRect();
    const d = defilement.getBoundingClientRect();
    expect(d.left).toBeGreaterThanOrEqual(b.left);
    expect(d.right).toBeLessThanOrEqual(b.right);
  });

  test('deux rangées d’en-têtes : chaque groupe, scope colgroup, couvre exactement ses colonnes ; les en-têtes de colonne restent dans la seconde', async () => {
    const m = await ouvrir(chargeRetenue());
    const thead = section(m).querySelector('thead');
    expect(thead.rows.length).toBe(2);
    const groupes = [...thead.rows[0].querySelectorAll('th')];
    // Sans objectif ni case des animateurs, les cinq groupes du tableau.
    const segments = tableau(evaluation(charge(m)).table).groupes;
    const attendus = segments.filter(({ cle }) => cle !== null);
    expect(attendus.length).toBe(5);
    expect(groupes.map(texteDe)).toEqual(attendus.map(({ cle }) => t(cle)));
    expect(thead.rows[0].querySelectorAll('[data-colonne]').length).toBe(0);
    expect([...thead.rows[1].querySelectorAll('th[data-colonne]')].map((th) => th.dataset.colonne)).toEqual(NOMS_DES_COLONNES);
    for (const [rang, groupe] of groupes.entries()) {
      const { colonnes } = attendus[rang];
      expect(groupe.getAttribute('scope')).toBe('colgroup');
      const premiere = thead.querySelector(`th[data-colonne="${colonnes[0]}"]`).getBoundingClientRect();
      const derniere = thead.querySelector(`th[data-colonne="${colonnes.at(-1)}"]`).getBoundingClientRect();
      const g = groupe.getBoundingClientRect();
      expect(Math.abs(g.left - premiere.left), texteDe(groupe)).toBeLessThanOrEqual(1);
      expect(Math.abs(g.right - derniere.right), texteDe(groupe)).toBeLessThanOrEqual(1);
      expect(g.bottom).toBeLessThanOrEqual(premiere.top + 1);
    }
    const colgroups = [...section(m).querySelectorAll('table > colgroup')];
    expect(colgroups.map((colgroup) => colgroup.span)).toEqual(segments.map(({ etendue }) => etendue));
  });

  test('les nombres, en-têtes compris, s’alignent à droite en chiffres tabulaires', async () => {
    const m = await ouvrir(chargeRetenue());
    for (const nom of COLONNES_NOMBRES) {
      const cellulesLues = [...section(m).querySelectorAll(`tbody[data-classement] td[data-colonne="${nom}"], thead th[data-colonne="${nom}"]`)];
      expect(cellulesLues.length, nom).toBe(4);
      for (const cellule of cellulesLues) {
        const style = getComputedStyle(cellule);
        expect(style.textAlign, nom).toBe('right');
        expect(style.fontVariantNumeric, nom).toContain('tabular-nums');
      }
    }
  });

  test('la ligne du retenu sur la teinte de Retenu, son texte à 4,5:1, dans les deux thèmes ; les autres lignes sur la carte', async () => {
    const m = await ouvrir(chargeRetenue());
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        flushSync();
        const teinte = couleurDeJeton('--couleur-etat-retenu-fond');
        const carte = couleurDeJeton('--couleur-carte-fond');
        for (const cellule of ligneRetenu(m).children) {
          cellule.scrollIntoView({ block: 'center', inline: 'center' });
          const [fond] = fondPeintSous(cellule);
          expect(fond.join(), `${theme} ${cellule.dataset.colonne}`).toBe(teinte.join());
        }
        const titre = ligneRetenu(m).querySelector('[data-colonne="rang"]');
        expect(contraste(couleurTexte(titre), teinte), theme).toBeGreaterThanOrEqual(4.5);
        for (const cellule of ligne(m, 1).querySelectorAll('td[data-colonne]')) {
          cellule.scrollIntoView({ block: 'center', inline: 'center' });
          const [fond] = fondPeintSous(cellule);
          expect(fond.join(), `${theme} ligne 1 ${cellule.dataset.colonne}`).toBe(carte.join());
        }
      });
    }
  });

  test('la proposition retenue porte la pastille « retenue » : fond de Retenu, signe à 3:1, texte de l’encre de la page', async () => {
    const m = await ouvrir(chargeRetenue());
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        flushSync();
        const cellule = ligne(m, 3).querySelector('td[data-colonne="proposition"]');
        const libelle = [...cellule.querySelectorAll('span')].find((span) => texteDe(span) === t('propositions.marque.retenue') && span.children.length === 0);
        expect(libelle, theme).toBeDefined();
        libelle.scrollIntoView({ block: 'center', inline: 'center' });
        const [fond] = fondPeintSous(libelle);
        expect(fond.join(), theme).toBe(couleurDeJeton('--couleur-etat-retenu-fond').join());
        expect(couleurTexte(libelle).join(), theme).toBe(couleurDeJeton('--couleur-page-texte').join());
        const signe = libelle.parentElement.querySelector('svg');
        expect(signe, theme).not.toBeNull();
        expect(composantes(getComputedStyle(signe).color).join(), theme).toBe(couleurDeJeton('--couleur-etat-retenu-marque').join());
        expect(contraste(composantes(getComputedStyle(signe).color), fond), theme).toBeGreaterThanOrEqual(3);
        for (const autre of [1, 2]) expect(texteDe(ligne(m, autre))).not.toContain(t('propositions.marque.retenue'));
      });
    }
  });
});

// --- Le sixième groupe et la phrase par paliers (§ 5.7, A9, A11) ------------------

// La petite démonstration au conflit inévitable et les trois plans de
// PLANS_CONFLIT, les personnes 1 à 6 « finance », la première table attendant
// « finance » pour la soirée ; les réglages donnés s'ajoutent à ceux de la
// charge.
function petiteAObjectifs(reglages = {}) {
  const chargeLue = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
  for (const participant of chargeLue.participants) if (participant.id <= 6) participant.etiquettes = ['finance'];
  const [premiere] = [...chargeLue.tables].sort((a, b) => a.id - b.id);
  premiere.objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  Object.assign(chargeLue.reglages, reglages);
  return chargeLue;
}

describe('le sixième groupe et la phrase par paliers (§ 5.7, A9, A11)', () => {
  // Le pointeur réel part du coin du cadre, hors de la phrase et du tableau.
  beforeEach(async () => {
    await pointer('bouger', 0, 0);
  });

  const enTetesDesColonnes = (m) => [...section(m).querySelector('thead').rows[1].querySelectorAll('th[data-colonne]')].map((th) => th.dataset.colonne);
  const enTeteDuGroupe = (m) =>
    [...section(m).querySelector('thead').rows[0].querySelectorAll('th')].find((th) => texteDe(th) === t('propositions.groupe.objectifs')) ?? null;
  // Les colonnes du défaut, celles du groupe des objectifs et des animateurs
  // insérées après l'écart au plafond a priori, avant le certificat.
  const avecSixieme = (...noms) => [...NOMS_DES_COLONNES.slice(0, 18), ...noms, ...NOMS_DES_COLONNES.slice(18)];

  test('« chacun au moins une fois » : le groupe « Objectifs des tables et animateurs » couvre ses trois colonnes, chiffres du moteur ; la phrase nomme « personnes jamais servies, puis tours hors objectif »', async () => {
    const chargeLue = executer(petiteAObjectifs({ modeObjectifs: 'chacun' }), 'retenirProposition', { id: 3 });
    const m = await ouvrir(chargeLue);
    expect(enTetesDesColonnes(m)).toEqual(avecSixieme('jamaisServies', 'toursHorsObjectif', 'toursSelonObjectif'));
    const groupe = enTeteDuGroupe(m);
    expect(groupe).not.toBeNull();
    expect(groupe.getAttribute('scope')).toBe('colgroup');
    expect(groupe.colSpan).toBe(3);
    const g = groupe.getBoundingClientRect();
    const thead = section(m).querySelector('thead');
    expect(Math.abs(g.left - thead.querySelector('th[data-colonne="jamaisServies"]').getBoundingClientRect().left)).toBeLessThanOrEqual(1);
    expect(Math.abs(g.right - thead.querySelector('th[data-colonne="toursSelonObjectif"]').getBoundingClientRect().right)).toBeLessThanOrEqual(1);
    const instance = normaliser(configurationDe(chargeLue));
    for (const proposition of chargeLue.propositions) {
      const { objectifs } = mesurer(instance, indexerPlan(instance, planDepuisFichier(proposition)));
      const lues = cellules(ligne(m, proposition.id));
      expect(lues.get('jamaisServies')).toBe(format.nombre(objectifs.jamaisServies));
      expect(lues.get('toursHorsObjectif')).toBe(format.nombre(objectifs.horsObjectif));
      expect(lues.get('toursSelonObjectif')).toBe(format.nombre(objectifs.agregat.tous.min));
    }
    expect(cellules(ligneRetenu(m)).has('toursHorsObjectif')).toBe(true);
    expect(section(m).querySelector('[data-ordre] p').textContent).toBe(
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis excédent de collisions, " +
        'puis collisions cumulées, puis personnes jamais servies, puis tours hors objectif, puis rencontres répétées, ' +
        "puis redondance d'appartenance, puis l'identifiant croissant.",
    );
  });

  test('les deux noms du critère des objectifs, au clavier : chacun surligne sa colonne seule et ouvre son explication, qu’il est seul à désigner', async () => {
    const m = await ouvrir(executer(petiteAObjectifs({ modeObjectifs: 'chacun' }), 'retenirProposition', { id: 3 }));
    const noms = [...section(m).querySelectorAll('[data-ordre] [data-critere="toursHorsObjectif"]')];
    expect(noms.map(texteDe)).toEqual(['personnes jamais servies', 'tours hors objectif']);
    for (const [nom, nomColonne] of [
      [noms[0], 'jamaisServies'],
      [noms[1], 'toursHorsObjectif'],
    ]) {
      expect(nom.tabIndex).toBe(0);
      nom.focus();
      expect(colonne(m, nomColonne).length).toBe(5);
      await attendre(() => expect(surlignees(m), nomColonne).toEqual(colonne(m, nomColonne)));
      await attendre(() => exigerInfobulle(nom, explicationDeColonne(nomColonne)));
      nom.blur();
      await attendre(() => expect(surlignees(m)).toEqual([]));
    }
  });

  test('« nouvelle table » cochée seule : le nom « retours » surligne la colonne des retours choisis, jamais celle des rencontres répétées', async () => {
    const chargeLue = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    for (const cle of ['separerAppartenances', 'nouveauxVoisins', 'varierAppartenances']) chargeLue.reglages[cle] = false;
    const m = await ouvrir(chargeLue);
    expect(texteDe(section(m).querySelector('[data-ordre]'))).toBe(
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis retours, puis l'identifiant croissant.",
    );
    const nom = section(m).querySelector('[data-ordre] [data-critere="rencontresRepetees"]');
    expect(texteDe(nom)).toBe('retours');
    const { x, y } = await centre(nom);
    await pointer('bouger', x, y);
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, 'retoursChoisis')));
    for (const cellule of colonne(m, 'rencontresRepetees')) expect(cellule.dataset.marque).toBeUndefined();
    await attendre(() => exigerInfobulle(nom, explicationDeColonne('retoursChoisis')));
  });

  test('un palier partagé : « ensemble, », chaque nom suivi de son poids ; seuls les noms se focalisent, les poids restent du texte', async () => {
    const chargeLue = avecPlans(chargeDemo('petite-conflit'), PLANS_CONFLIT);
    const e = (critere, poids = 1) => ({ critere, poids });
    chargeLue.reglages.priorites = [
      [e('ecartAuPlafondAPrioriMax')],
      [e('excedentCollisions', 3), e('redondance', 2)],
      [e('collisionsCumulees')],
      [e('toursHorsObjectif')],
      [e('rencontresRepetees')],
      [e('animateursNonRencontres')],
    ];
    const m = await ouvrir(chargeLue);
    expect(section(m).querySelector('[data-ordre] p').textContent).toBe(
      "Ordre du classement, chaque critère au plus faible d'abord : écart au plafond a priori, puis ensemble, " +
        "excédent de collisions (poids 3), redondance d'appartenance (poids 2), puis collisions cumulées, " +
        "puis rencontres répétées, puis l'identifiant croissant.",
    );
    const noms = nomsDesignants(m);
    expect(noms.map((nom) => nom.dataset.critere)).toEqual([
      'ecartAuPlafondAPrioriMax',
      'excedentCollisions',
      'redondance',
      'collisionsCumulees',
      'rencontresRepetees',
      'identifiant',
    ]);
    for (const nom of noms) expect(texteDe(nom)).not.toMatch(/poids|ensemble/);
    const redondance = section(m).querySelector('[data-ordre] [data-critere="redondance"]');
    redondance.focus();
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, 'totalRedondance')));
  });

  test('chaque en-tête du sixième groupe se focalise, ouvre son explication, aligne ses nombres à droite en chiffres tabulaires ; ses textes à 4,5:1 dans les deux thèmes', async () => {
    const m = await ouvrir(petiteAObjectifs({ modeObjectifs: 'minimum' }));
    const noms = ['horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif'];
    expect(enTetesDesColonnes(m)).toEqual(avecSixieme(...noms));
    for (const nom of noms) {
      const th = enTetes(m).find((candidat) => candidat.dataset.colonne === nom);
      expect(th.tabIndex).toBe(0);
      th.focus();
      await attendre(() => exigerInfobulle(th, explicationDeColonne(nom)));
      for (const cellule of colonne(m, nom)) {
        const style = getComputedStyle(cellule);
        expect(style.textAlign, nom).toBe('right');
        expect(style.fontVariantNumeric, nom).toContain('tabular-nums');
      }
      th.blur();
    }
    await attendre(() => exigerFermee());
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        flushSync();
        for (const element of [enTeteDuGroupe(m), ...noms.flatMap((nom) => colonne(m, nom))]) {
          element.scrollIntoView({ block: 'center', inline: 'center' });
          const [fond] = fondPeintSous(element);
          expect(contraste(couleurTexte(element), fond), `${theme} ${element.dataset.colonne ?? 'groupe'}`).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });

  test('la case des animateurs cochée sur la grande : le groupe couvre le minimum des animateurs rencontrés et les animateurs non rencontrés, chiffres du moteur', async () => {
    const depart = structuredClone(chargeDemo('grande'));
    depart.reglages.rencontrerAnimateurs = true;
    const chargeLue = generee(depart, { graine: 1, nombre: 1, arret: 2000 });
    const m = await ouvrir(chargeLue);
    expect(enTetesDesColonnes(m)).toEqual(avecSixieme('animateursRencontres', 'animateursNonRencontres'));
    expect(enTeteDuGroupe(m).colSpan).toBe(2);
    const instance = normaliser(configurationDe(chargeLue));
    const { animateurs } = mesurer(instance, indexerPlan(instance, planDepuisFichier(chargeLue.propositions[0])));
    const lues = cellules(ligne(m, 1));
    expect(lues.get('animateursRencontres')).toBe(format.nombre(animateurs.agregat.tous.min));
    expect(lues.get('animateursNonRencontres')).toBe(format.nombre(animateurs.nonRencontres));
    const nom = section(m).querySelector('[data-ordre] [data-critere="animateursNonRencontres"]');
    expect(texteDe(nom)).toBe('animateurs non rencontrés');
    nom.focus();
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, 'animateursNonRencontres')));
  });

  test('le critère des objectifs décoché : ni groupe ni colonne des objectifs, et la phrase ne le nomme pas', async () => {
    const m = await ouvrir(petiteAObjectifs({ respecterObjectifs: false, modeObjectifs: 'chacun' }));
    expect(enTetesDesColonnes(m)).toEqual(NOMS_DES_COLONNES);
    expect(enTeteDuGroupe(m)).toBeNull();
    expect(section(m).querySelector('[data-ordre] [data-critere="toursHorsObjectif"]')).toBeNull();
    expect(texteDe(section(m).querySelector('[data-ordre]'))).toBe(t('propositions.ordre.criteres', { criteres: [...CRITERES] }));
  });
});

// --- Les pages du classement (§ 5.7, § 2.1 étapes 9 et 10, § 8.4) ---------------

// La grande démonstration et 237 propositions (graine 7, arrêt 50) : brute,
// sans retenu ; retenue, la 150e du classement retenue ; encore, cent
// propositions de plus sous la graine 8, que l'épreuve enregistre. ordre :
// les identifiants dans l'ordre que rend le moteur, sollicité une seconde
// fois (§ 19.1). Calculées une fois, pour toutes les épreuves des pages.
let calculees = null;
function pagesDEpreuve() {
  if (calculees !== null) return calculees;
  const brute = generee(chargeDemo('grande'), { graine: 7, nombre: 237, arret: 50, historique: 1000 });
  const configuration = configurationDepuisCharge(brute);
  const instance = normaliser(configuration);
  const aPriori = plafondsAPriori(instance);
  const { ordre } = classer(
    brute.propositions.map((p) => ({ id: p.id, mesures: mesurer(instance, indexerPlan(instance, planDepuisFichier(p))), plafondsAPriori: aPriori })),
  );
  const retenue = executer(brute, 'retenirProposition', { id: ordre[149] });
  const encore = rechercher(configuration, { graine: 8, nombre: 100, arret: 50, historique: 1000 });
  calculees = { brute, retenue, ordre, idRetenue: ordre[149], encore, configuration };
  return calculees;
}

// La charge brute réduite à ses n premières propositions par identifiant.
function premieres(n) {
  const reduite = structuredClone(pagesDEpreuve().brute);
  reduite.propositions = reduite.propositions.filter(({ id }) => id <= n);
  return reduite;
}

const navDes = (m, ou) => section(m).querySelector(`nav[data-pages="${ou}"]`);
const etendue = (m, ou = 'haut') => navDes(m, ou)?.querySelector('[data-etendue]') ?? null;
const rangsLus = (m) => lignes(m).map((tr) => texteDe(tr.querySelector('td[data-colonne="rang"]')));
const rangsDe = (premier, dernier) => Array.from({ length: dernier - premier + 1 }, (_, place) => format.nombre(premier + place));
const texteEtendue = (premier, dernier, total) =>
  t('propositions.pages.etendue', { premier: format.nombre(premier), dernier: format.nombre(dernier), total: format.nombre(total), nombre: dernier - premier + 1 });

// La page montrée : les identifiants de ses lignes, et l'étendue que disent
// les deux nav.
async function exigerPage(m, ordre, premier, dernier, total) {
  await attendre(() => expect(ids(m)).toEqual(ordre.slice(premier - 1, dernier)));
  expect(rangsLus(m)).toEqual(rangsDe(premier, dernier));
  for (const ou of ['haut', 'bas']) expect(texteDe(etendue(m, ou)), ou).toBe(texteEtendue(premier, dernier, total));
}

// Une commande de page d'une nav, null quand elle n'y est pas.
const commandePage = (m, ou, nom) => commande(navDes(m, ou), nom);

describe('les pages du classement (§ 5.7)', () => {
  beforeEach(async () => {
    await pointer('bouger', 0, 0);
  });

  test('237 propositions, la page 1 : les rangs 1 à 100 dans l’ordre du moteur, le retenu en tête ; une nav nommée au-dessus du tableau et une sous lui, « Suivantes » sans « Précédentes »', async () => {
    const { retenue, ordre, idRetenue } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    await exigerPage(m, ordre, 1, 100, 237);
    const table = section(m).querySelector('table');
    const haut = navDes(m, 'haut');
    const bas = navDes(m, 'bas');
    expect(haut.getAttribute('aria-label')).toBe(t('propositions.pages.haut'));
    expect(bas.getAttribute('aria-label')).toBe(t('propositions.pages.bas'));
    expect(haut.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(bas.compareDocumentPosition(table) & Node.DOCUMENT_POSITION_PRECEDING).toBeTruthy();
    for (const ou of ['haut', 'bas']) {
      expect(commandePage(m, ou, 'precedentes'), ou).toBeNull();
      expect(texteDe(commandePage(m, ou, 'suivantes')), ou).toBe(t('propositions.pages.suivantes'));
    }
    expect(etendue(m, 'haut').getAttribute('role')).toBe('status');
    expect(etendue(m, 'bas').getAttribute('role')).toBeNull();
    expect(ligneRetenu(m)).not.toBeNull();
    expect(ligneRetenu(m).compareDocumentPosition(lignes(m)[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(ligne(m, idRetenue)).toBeNull();
  });

  test('« Suivantes » : la page 2 aux rangs globaux 101 à 200, le focus sur l’étendue annoncée ; puis la 3, 37 lignes, sans « Suivantes » ; « Précédentes » rend la 2 ; rien ne s’écrit', async () => {
    const { retenue, ordre, idRetenue } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    const ecritures = m.trace.length;
    const revisionAvant = revision(m);
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    await attendre(() => expect(document.activeElement).toBe(etendue(m, 'haut')));
    expect(ligneRetenu(m)).not.toBeNull();
    expect(texteDe(ligne(m, idRetenue))).toContain(t('propositions.marque.retenue'));
    for (const ou of ['haut', 'bas']) {
      expect(commandePage(m, ou, 'precedentes'), ou).not.toBeNull();
      expect(commandePage(m, ou, 'suivantes'), ou).not.toBeNull();
    }
    commandePage(m, 'bas', 'suivantes').click();
    await exigerPage(m, ordre, 201, 237, 237);
    await attendre(() => expect(document.activeElement).toBe(etendue(m, 'haut')));
    for (const ou of ['haut', 'bas']) expect(commandePage(m, ou, 'suivantes'), ou).toBeNull();
    commandePage(m, 'bas', 'precedentes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    await attendre(() => expect(document.activeElement).toBe(etendue(m, 'haut')));
    expect(m.trace.length).toBe(ecritures);
    expect(revision(m)).toBe(revisionAvant);
  });

  test('en mode lecture, « Suivantes » montre la page 2 et rien ne s’écrit (§ 8.4)', async () => {
    const { retenue, ordre } = pagesDEpreuve();
    const m = await ouvrir(retenue, { mode: 'lecture' });
    await exigerPage(m, ordre, 1, 100, 237);
    const ecritures = m.trace.length;
    const revisionAvant = revision(m);
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    expect(m.trace.length).toBe(ecritures);
    expect(revision(m)).toBe(revisionAvant);
  });

  test('la page survit au plan : « Voir sur le plan » depuis la page 2, retour sur la 2 ; changer de page garde la proposition demandée au plan, et la page choisie reste', async () => {
    const { retenue, ordre } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    const montree = ordre[120];
    commande(ligne(m, montree), 'voir').click();
    await attendre(() => expect(m.racine.querySelector('[data-section="plan"]')).not.toBeNull());
    expect(m.ui.etat().proposition).toBe(montree);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 101, 200, 237);
    commandePage(m, 'haut', 'precedentes').click();
    await exigerPage(m, ordre, 1, 100, 237);
    expect(m.ui.etat().proposition).toBe(montree);
    m.ui.allerA('plan');
    flushSync();
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 1, 100, 237);
  });

  test('une proposition visée depuis ailleurs amène la page qui la porte : au retour sur la section, et section ouverte', async () => {
    const { retenue, ordre } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    await exigerPage(m, ordre, 1, 100, 237);
    m.ui.allerA('plan');
    flushSync();
    m.ui.montrerProposition(ordre[220]);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 201, 237, 237);
    expect(ligne(m, ordre[220])).not.toBeNull();
    m.ui.montrerProposition(ordre[150]);
    await exigerPage(m, ordre, 101, 200, 237);
  });

  test('la même proposition visée de nouveau depuis le plan, après un retour à aucune ou sans lui, amène encore sa page', async () => {
    const { retenue, ordre } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    m.ui.allerA('plan');
    flushSync();
    m.ui.montrerProposition(ordre[220]);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 201, 237, 237);
    commandePage(m, 'haut', 'precedentes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    m.ui.allerA('plan');
    flushSync();
    m.ui.montrerProposition(null);
    flushSync();
    m.ui.montrerProposition(ordre[220]);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 201, 237, 237);
    commandePage(m, 'haut', 'precedentes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    m.ui.allerA('plan');
    flushSync();
    m.ui.montrerProposition(ordre[220]);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 201, 237, 237);
  });

  test('une génération ramène à la page 1 ; « Défaire », qui la retire, borne la page à la dernière qui reste', async () => {
    const { retenue, ordre, encore, configuration } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    commandePage(m, 'haut', 'suivantes').click();
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 201, 237, 237);
    await m.seance.executer('enregistrerGeneration', { propositions: encore, configuration, produitVersion: V1 });
    await attendre(() => expect(texteDe(etendue(m))).toBe(texteEtendue(1, 100, 337)));
    expect(rangsLus(m)).toEqual(rangsDe(1, 100));
    for (let page = 2; page <= 4; page += 1) {
      commandePage(m, 'haut', 'suivantes').click();
      await attendre(() => expect(texteDe(etendue(m))).toBe(texteEtendue((page - 1) * 100 + 1, Math.min(page * 100, 337), 337)));
    }
    await m.seance.defaire();
    await exigerPage(m, ordre, 201, 237, 237);
  });

  test('un autre événement s’ouvre sur la page 1', async () => {
    const { retenue, ordre } = pagesDEpreuve();
    const texte = serialiser(retenue, { revision: 1, produitVersion: V1 });
    const m = await monterApp({
      fichiers: [BASE, 'autre-soiree'].map((base) => ({ racine: 'documents', chemin: `${base}${SUFFIXES.etat}`, texte })),
    });
    montes.push(m);
    await m.seance.ouvrir(BASE);
    m.ui.allerA('propositions');
    flushSync();
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    await m.seance.ouvrir('autre-soiree');
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 1, 100, 237);
  });

  test('chaque ouverture repart de la page 1 : le premier événement rouvert après un autre que la section n’a pas vu, puis rouvert après sa fermeture', async () => {
    const { retenue, ordre } = pagesDEpreuve();
    const texte = serialiser(retenue, { revision: 1, produitVersion: V1 });
    const m = await monterApp({
      fichiers: [BASE, 'autre-soiree'].map((base) => ({ racine: 'documents', chemin: `${base}${SUFFIXES.etat}`, texte })),
    });
    montes.push(m);
    await m.seance.ouvrir(BASE);
    m.ui.allerA('propositions');
    flushSync();
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    await m.seance.ouvrir('autre-soiree');
    flushSync();
    await m.seance.ouvrir(BASE);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 1, 100, 237);
    commandePage(m, 'haut', 'suivantes').click();
    await exigerPage(m, ordre, 101, 200, 237);
    await m.seance.fermer();
    flushSync();
    await m.seance.ouvrir(BASE);
    m.ui.allerA('propositions');
    await exigerPage(m, ordre, 1, 100, 237);
  });

  test('à 100 propositions, ni nav ni commande de page ; à 101, la page 2 ne porte que la 101e : « Proposition 101 sur 101 »', async () => {
    const cent = await ouvrir(premieres(100));
    await attendre(() => expect(lignes(cent).length).toBe(100));
    expect(section(cent).querySelector('nav')).toBeNull();
    expect(section(cent).querySelector('[data-etendue]')).toBeNull();
    for (const nom of ['precedentes', 'suivantes']) expect(commande(section(cent), nom), nom).toBeNull();
    const centUn = await ouvrir(premieres(101));
    await attendre(() => expect(texteDe(etendue(centUn))).toBe(texteEtendue(1, 100, 101)));
    expect(lignes(centUn).length).toBe(100);
    commandePage(centUn, 'bas', 'suivantes').click();
    await attendre(() => expect(lignes(centUn).length).toBe(1));
    expect(texteDe(etendue(centUn))).toBe('Proposition 101 sur 101');
    expect(rangsLus(centUn)).toEqual([format.nombre(101)]);
  });

  test('la colonne que désigne un nom survolé reste surlignée sur la page suivante', async () => {
    const { retenue } = pagesDEpreuve();
    const m = await ouvrir(retenue);
    const nom = section(m).querySelector('[data-ordre] [data-critere="excedentCollisions"]');
    const { x, y } = await centre(nom);
    await pointer('bouger', x, y);
    await attendre(() => expect(surlignees(m)).toEqual(colonne(m, 'excedentCollisions')));
    commandePage(m, 'haut', 'suivantes').click();
    await attendre(() => expect(texteDe(etendue(m))).toBe(texteEtendue(101, 200, 237)));
    const attendues = colonne(m, 'excedentCollisions');
    expect(attendues.length).toBe(102);
    await attendre(() => expect(surlignees(m)).toEqual(attendues));
  });
});
