// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle de dessin du plan (§ 7.3, § 7.4, § 7.5, § 7.6, § 7.7),
// sans DOM. Le plan lit les conflits de l'état des places, jamais ne les
// recalcule ; l'épreuve, elle, importe le moteur et le stockage pour
// construire ses données et obtenir la valeur attendue (§ 19.1). Les noms
// d'épreuve sont inventés ; la petite démonstration livrée se lit, et sa
// variante se dérive, en mémoire depuis texteLivre.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../../test/lanceur.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { etatPlaces, instanceDe } from '../../application/places.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { constante } from '../../geometrie/constantes.js';
import { regimeCibles } from '../../geometrie/designation.js';
import {
  DEMI_HAUTEUR_GEL,
  ENCRE_BAS_LIGNE,
  ENCRE_HAUT_LIGNE,
  RAYON_PASTILLE as RAYON_PASTILLE_PLATEAU,
  RETRAIT_GEL as RETRAIT_GEL_PLATEAU,
  corpsNumero,
  lignesLibelle,
  placeGel,
  placeNumero,
  placePastille,
} from '../../geometrie/plateau.js';
import { TAILLE_TEXTE_LISTE_CM, replier } from '../../geometrie/texte.js';
import { ECART_LISTE, PLANCHER_DIAMETRE, RAYON_POIGNEE, blocNoms, dessinDepuisPosition, ecarterRangees, geometrieTable } from '../../geometrie/tables.js';
import { indexerPlan } from '../../moteur/configuration.js';
import { conflitsParTable } from '../../moteur/conflits.js';
import { diagnostiquer } from '../../moteur/diagnostic.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { planDepuisFichier, versFichier } from '../../stockage/placements.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { CONFLITS } from '../marques.js';
import { organisationDeCharge, nomDeCharge } from './vue_plan.js';
import {
  ARRET_RETRACE,
  ECART_ANNEAU,
  ECART_DESIGNATION,
  ECART_FOCUS,
  ECART_MISE_EN_EVIDENCE,
  HALO_NUMERO,
  LARGEUR_ECHELLE_PX,
  RAYON_PASTILLE,
  RAYON_SOCLE_PASTILLE,
  RETRAIT_GEL,
  RETRAIT_ORGANISATION,
  TRACE_GEL,
  actionsPersonne,
  actionsPlace,
  ajusterLigne,
  detailConflits,
  executerSurPlace,
  formesTable,
  legendeConflits,
  libelleDessin,
  libelleLongueur,
  ligneListe,
  modeleDessin,
  ordonneesLignes,
  partiesLigne,
  rangeesEcartees,
  rangeesLigne,
  rangeesListe,
  texteLigne,
  textesLigne,
} from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const K_LISTES = constante('K_LISTES');

// --- Les configurations d'épreuve -------------------------------------------

// Douze noms inventés : prénom (null pour un nom seul) et nom.
const NOMS = [
  ['Iris', 'Ombrelle'],
  ['Théo', 'Pervenche'],
  ['Ondine', 'Lacasse'],
  [null, 'Grisaille'],
  ['Basile', 'Tourmaline'],
  ['Capucine', 'Arrosoir'],
  ['Aurèle', 'Cerfeuil'],
  ['Mélisande', 'Bruyère'],
  ['Firmin', 'Galet'],
  ['Clélia', 'Mistral'],
  ['Anatole', 'Houblon'],
  ['Solveig', 'Sarcelle'],
];

const personne = (id, nom, prenom, organisation) => ({
  id,
  nom,
  prenom,
  organisation,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

// Les propositions de rechercher(configuration, {graine, nombre, arret:
// 4000}), passées par versFichier et posées dans la charge ; le compteur
// passe au-delà du dernier identifiant, et le plan est proposé.
function avecPropositions(charge, { graine = 7, nombre = 1 } = {}) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine, nombre, arret: 4000 });
  charge.propositions = propositions.map((p) =>
    versFichier(p, configuration, { produitVersion: 'epreuve', attribuerSieges: false, decalage: 0 }),
  );
  charge.prochainsIds.proposition = nombre + 1;
  charge.evenement.etat = 'propose';
  return charge;
}

/** Douze personnes en deux organisations de six — une seule avec uneSeule —,
 *  quatre tables rondes de 3, quatre tours, séparation active, et une
 *  proposition de rechercher(…, {graine: 7, nombre: 1, arret: 4000}). */
function toutesEnConflit({ uneSeule = false } = {}) {
  const charge = creerCharge({ id: 'epreuve:toutes-en-conflit', nom: 'Toutes en conflit', siegesParDefaut: 3, tours: 4 });
  charge.participants = NOMS.map(([prenom, nom], i) =>
    personne(i + 1, nom, prenom, uneSeule || i % 2 === 0 ? 'Club des Merles' : 'Cercle des Hérons'),
  );
  charge.tables = [1, 2, 3, 4].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * (id - 1), y: 0 } }));
  charge.prochainsIds = { participant: 13, table: 5, proposition: 1 };
  return avecPropositions(charge);
}

const FIXTURE = new URL('../../../test/fixtures/plan/toutes_en_conflit.gtt.json', import.meta.url);

// La petite démonstration livrée, relue en mémoire.
const petite = (cle = 'petite') => analyser(texteLivre(cle)).charge;

// nomDe sur les participants de la charge : le nom affiché, celui que le
// plan reçoit.
const nomsDe = nomDeCharge;

const options = (charge, autres = {}) => ({ k: 1, listes: true, miseEnEvidence: null, nomDe: nomsDe(charge), ...autres });

// Une copie de l'état des places où la table d'identifiant donné est saine.
function avecTableSaine(etat, id) {
  return { ...etat, tables: etat.tables.map((table) => (table.id === id ? { ...table, conflits: { nombre: 0, regles: [] } } : table)) };
}

// --- Les conflits se lisent ---------------------------------------------------

describe('modeleDessin : les conflits se lisent, jamais ne se recalculent (§ 7.5)', () => {
  test('petite démonstration, conflit inévitable : tables signalées et pastilles de chaque tour égalent conflitsParTable', () => {
    const charge = avecPropositions(petite('petite-conflit'));
    const instance = instanceDe(charge);
    const attendus = conflitsParTable(instance, indexerPlan(instance, planDepuisFichier(charge.propositions[0])));
    let signalees = 0;
    for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
      const etat = etatPlaces(charge, { tour, proposition: 1 });
      const modele = modeleDessin(etat, options(charge));
      assert.equal(modele.tables.length, 4);
      const toutes = attendus[tour - 1].every(({ nombre }) => nombre > 0);
      assert.equal(modele.signalerConflits, !toutes, `tour ${tour}`);
      const nombreDe = new Map(attendus[tour - 1].map(({ table, nombre }) => [table, nombre]));
      for (const table of modele.tables) {
        const lu = etat.tables.find(({ id }) => id === table.id).conflits;
        assert.equal(table.pastille, lu.nombre);
        assert.equal(table.pastille, nombreDe.get(table.id), `tour ${tour}, table ${table.id}`);
        assert.equal(table.conflit, lu.nombre > 0);
        if (table.conflit && modele.signalerConflits) signalees += 1;
      }
    }
    assert.ok(signalees > 0, 'la variante conflit signale au moins une table, à un tour où une autre est saine');
  });

  test('conflits null — non évalués — : ni conflit, ni pastille', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const sansEvaluation = { ...etat, evalue: false, tables: etat.tables.map((table) => ({ ...table, conflits: null })) };
    const modele = modeleDessin(sansEvaluation, options(charge));
    assert.equal(modele.tables.length, 4);
    for (const table of modele.tables) {
      assert.equal(table.conflit, false);
      assert.equal(table.pastille, 0);
      assert.deepEqual(table.nomAccessible.details.conflits, null);
    }
    assert.equal(modele.signalerConflits, true);
    assert.deepEqual(modele.bandeau, []);
  });

  test('toutes en conflit : le fichier d\u{2019}épreuve se relit, et le plan cesse de signaler', () => {
    const texte = readFileSync(FIXTURE, 'utf8');
    const attendu = toutesEnConflit();
    assert.equal(texte, serialiser(attendu, { revision: 1, produitVersion: 'epreuve' }), 'le fichier est la configuration construite');
    const { charge } = analyser(texte);
    for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
      const etat = etatPlaces(charge, { tour, proposition: 1 });
      const modele = modeleDessin(etat, options(charge));
      assert.equal(modele.tables.length, 4);
      assert.equal(modele.signalerConflits, false);
      for (const table of modele.tables) {
        assert.ok(table.conflit);
        assert.ok(table.pastille > 0);
        assert.equal(table.pastille, etat.tables.find(({ id }) => id === table.id).conflits.nombre);
      }
      assert.deepEqual(modele.bandeau, [{ cle: 'plan.bandeau.toutesEnConflit', details: {} }]);

      const sain = modeleDessin(avecTableSaine(etat, 2), options(charge));
      assert.equal(sain.signalerConflits, true, 'une table saine rétablit le signalement');
      assert.deepEqual(sain.bandeau, []);
      assert.deepEqual(
        sain.tables.map(({ id, conflit }) => [id, conflit]),
        [
          [1, true],
          [2, false],
          [3, true],
          [4, true],
        ],
      );
    }
  });

  test('aucune table : aucun dessin, un bandeau vide', () => {
    const charge = creerCharge({ id: 'epreuve:vide', nom: 'Vide', siegesParDefaut: 6, tours: 1 });
    const modele = modeleDessin(etatPlaces(charge, { tour: 1 }), options(charge));
    assert.deepEqual(modele.tables, []);
    assert.deepEqual(modele.bandeau, []);
    assert.equal(modele.signalerConflits, true);
  });
});

// --- Le bandeau énonce le diagnostic -------------------------------------------

describe('modeleDessin : le bandeau énonce le diagnostic (§ 7.5)', () => {
  const lire = (charge) => etatPlaces(charge, { tour: 1, proposition: 1 });

  test('deux organisations de six : la phrase, collisionPartout, puis un plancher par groupe, chiffres du moteur', () => {
    const charge = toutesEnConflit();
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge));
    assert.equal(diagnostic.collisionPartout, true);
    assert.equal(diagnostic.uneSeuleOrganisation, false);
    assert.equal(diagnostic.collisions.length, 2);
    const { bandeau } = modeleDessin(lire(charge), options(charge, { diagnostic }));
    assert.deepEqual(bandeau, [
      { cle: 'plan.bandeau.toutesEnConflit', details: {} },
      { cle: 'plan.bandeau.collisionPartout', details: {} },
      ...diagnostic.collisions.map(({ groupe, effectif, plancherCumulees, plancherPairesDistinctes }) => ({
        cle: 'plan.bandeau.plancherGroupe',
        details: { groupe, effectif, plancherCumulees, plancherPairesDistinctes },
      })),
    ]);
    assert.deepEqual(
      bandeau.slice(2).map(({ details }) => details.effectif),
      [6, 6],
    );
    for (const { cle, details } of bandeau) assert.equal(typeof t(cle, details), 'string');
  });

  test('un plancher de groupe nomme ses deux unités : collisions cumulées et paires distinctes (§ 5.4)', () => {
    const plusieurs = { groupe: 'Club des Merles', effectif: 6, plancherCumulees: 8, plancherPairesDistinctes: 2 };
    assert.equal(
      t('plan.bandeau.plancherGroupe', plusieurs),
      '6 personnes, au moins 8 collisions cumulées sur la soirée, portées par au moins 2 paires distinctes',
    );
    const une = { groupe: 'Club des Merles', effectif: 2, plancherCumulees: 1, plancherPairesDistinctes: 1 };
    assert.equal(
      t('plan.bandeau.plancherGroupe', une),
      '2 personnes, au moins 1 collision cumulée sur la soirée, portée par au moins 1 paire distincte',
    );
  });

  test('une seule organisation : l\u{2019}entrée uneSeuleOrganisation, sans plancher par groupe', () => {
    const charge = toutesEnConflit({ uneSeule: true });
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge));
    assert.equal(diagnostic.uneSeuleOrganisation, true);
    const { bandeau, signalerConflits } = modeleDessin(lire(charge), options(charge, { diagnostic }));
    assert.equal(signalerConflits, false);
    assert.deepEqual(
      bandeau.map(({ cle }) => cle),
      [
        'plan.bandeau.toutesEnConflit',
        ...(diagnostic.collisionPartout ? ['plan.bandeau.collisionPartout'] : []),
        'plan.bandeau.uneSeuleOrganisation',
      ],
    );
  });

  test('un diagnostic sans plancher : la phrase, puis l\u{2019}entrée qui le dit', () => {
    const charge = toutesEnConflit();
    const diagnostic = { collisions: [], uneSeuleOrganisation: false, collisionPartout: false };
    const { bandeau } = modeleDessin(lire(charge), options(charge, { diagnostic }));
    assert.deepEqual(bandeau, [
      { cle: 'plan.bandeau.toutesEnConflit', details: {} },
      { cle: 'plan.bandeau.sansPlancher', details: {} },
    ]);
  });

  test('diagnostic null : la phrase seule', () => {
    const charge = toutesEnConflit();
    const { bandeau } = modeleDessin(lire(charge), options(charge, { diagnostic: null }));
    assert.deepEqual(bandeau, [{ cle: 'plan.bandeau.toutesEnConflit', details: {} }]);
  });

  test('la petite démonstration : collisionPartout faux, son entrée absente', () => {
    const diagnostic = diagnostiquer(configurationDepuisCharge(petite()));
    assert.equal(diagnostic.collisionPartout, false);
    const charge = toutesEnConflit();
    const { bandeau } = modeleDessin(lire(charge), options(charge, { diagnostic }));
    assert.equal(bandeau[0].cle, 'plan.bandeau.toutesEnConflit');
    assert.ok(!bandeau.some(({ cle }) => cle === 'plan.bandeau.collisionPartout'));
  });

  test('une table saine : le bandeau reste vide, diagnostic donné ou non', () => {
    const charge = toutesEnConflit();
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge));
    const { bandeau } = modeleDessin(avecTableSaine(lire(charge), 3), options(charge, { diagnostic }));
    assert.deepEqual(bandeau, []);
  });
});

// --- La source --------------------------------------------------------------------

describe('modeleDessin : les lignes nomment les occupants de la source (contrat)', () => {
  test('proposition 2 demandée → ses occupants ; sans demande → ceux du retenu, tiré de la proposition 1', () => {
    const charge = avecPropositions(petite(), { graine: 11, nombre: 2 });
    const [premiere] = charge.propositions;
    const { siegesAttribues, tables, capacites, tours, participants, placement } = structuredClone(premiere);
    charge.retenu = { proposition: 1, siegesAttribues, tables, capacites, tours, participants, placement };
    charge.evenement.etat = 'retenu';
    const nomDe = nomsDe(charge);
    // Les noms des lignes de chaque table, dans l'ordre des tables.
    const nomsDesLignes = (etat) => modeleDessin(etat, options(charge)).tables.map(({ lignes }) => lignes.map(({ nom }) => nom));
    // Les noms qu'une proposition assied au tour 1, table par table.
    const nomsDeLaSource = (p) => charge.tables.map(({ id }) => p.placement[0].sieges[p.tables.indexOf(id)].map(nomDe).sort());

    const montree = etatPlaces(charge, { tour: 1, proposition: 2 });
    assert.equal(montree.source, 'proposition');
    const retenu = etatPlaces(charge, { tour: 1 });
    assert.equal(retenu.source, 'retenu');
    const deLaDeux = nomsDesLignes(montree).map((noms) => [...noms].sort());
    const duRetenu = nomsDesLignes(retenu).map((noms) => [...noms].sort());
    assert.deepEqual(deLaDeux, nomsDeLaSource(charge.propositions[1]));
    assert.deepEqual(duRetenu, nomsDeLaSource(charge.retenu));
    assert.notDeepEqual(deLaDeux, duRetenu, 'les deux sources assoient autrement au tour 1');
  });
});

// --- Les lignes de la liste --------------------------------------------------------

// Une chaise de l'état des places, comme etatPlaces la rend.
const chaise = (siege, { occupant = null, reservation = null, titre = null } = {}) => ({
  siege,
  occupant,
  reservation,
  titre,
  remplissage: 'normal',
  marques: [],
});

const NOMS_LIGNES = new Map([
  [1, 'Iris Ombrelle'],
  [2, 'Théo Pervenche'],
  [3, 'Ondine Lacasse'],
  [4, 'Grisaille'],
]);
const nomDeLigne = (id) => NOMS_LIGNES.get(id);
const animateur = (pourvu) => ({ libelle: 'animateur', pourvu });

// Les six formes de la décision : chaise, ligne attendue, texte attendu.
const SIX_FORMES = [
  [
    chaise(1, { occupant: 1, reservation: { participant: 1, portee: 'tous', tour: null }, titre: animateur(true) }),
    { numero: 1, etat: { cle: 'plan.ligne.reserveeTous', details: {} }, titulaire: null, nom: 'Iris Ombrelle', organisation: null, titre: animateur(true) },
    '1. (réservée, tous les tours) Iris Ombrelle \u{2014} animateur',
  ],
  [
    chaise(2, { occupant: 2, reservation: { participant: 2, portee: 'tour', tour: 2 } }),
    { numero: 2, etat: { cle: 'plan.ligne.reserveeTour', details: { tour: 2, nomsTours: undefined } }, titulaire: null, nom: 'Théo Pervenche', organisation: null, titre: null },
    '2. (réservée, tour 2) Théo Pervenche',
  ],
  [chaise(3, { occupant: 3 }), { numero: 3, etat: null, titulaire: null, nom: 'Ondine Lacasse', organisation: null, titre: null }, '3. Ondine Lacasse'],
  [
    chaise(4, { occupant: 4, titre: animateur(false) }),
    { numero: 4, etat: null, titulaire: null, nom: 'Grisaille', organisation: null, titre: animateur(false) },
    '4. Grisaille \u{2014} titre animateur non pourvu',
  ],
  [chaise(5), { numero: 5, etat: { cle: 'plan.ligne.libre', details: {} }, titulaire: null, nom: null, organisation: null, titre: null }, '5. (libre)'],
  [
    chaise(6, { titre: animateur(false) }),
    { numero: 6, etat: { cle: 'plan.ligne.libre', details: {} }, titulaire: null, nom: null, organisation: null, titre: animateur(false) },
    '6. (libre) \u{2014} titre animateur non pourvu',
  ],
];

// Le texte entier d'une ligne : ses parties dans l'ordre, les absentes omises.
const joindre = ({ tete, titulaire, suite, nom, avantOrganisation = null, organisation = null, avantTitre, titre, apresTitre }) =>
  [tete, titulaire, suite, nom, avantOrganisation, organisation, avantTitre, titre, apresTitre].filter((partie) => partie !== null).join('');

describe('ligneListe et textesLigne : les six formes (§ 7.6)', () => {
  test('chaque forme, exactement, titre valant {libelle, pourvu}', () => {
    assert.equal(SIX_FORMES.length, 6);
    for (const [entree, ligne, texte] of SIX_FORMES) {
      assert.deepEqual(ligneListe(entree, nomDeLigne), ligne);
      assert.equal(joindre(textesLigne(ligne, t)), texte);
    }
  });

  test('le titre est sa propre partie, le libellé seul ; le nom aussi', () => {
    const textes = textesLigne(SIX_FORMES[0][1], t);
    assert.equal(textes.nom, 'Iris Ombrelle');
    assert.equal(textes.titre, 'animateur');
    assert.equal(textes.tete, '1. (réservée, tous les tours) ');
    assert.equal(textes.teteSansNom, '1. (réservée, tous les tours)');
    assert.equal(textesLigne(SIX_FORMES[2][1], t).titre, null);
  });
});

// Mesures factices : une unité par unité de code, 1,5 en italique.
const droit = (chaine) => chaine.length;
const italique = (chaine) => 1.5 * chaine.length;
const MARQUE = '\u{2026}';
const largeurDe = (ligne) =>
  droit(
    `${ligne.tete}${ligne.titulaire ?? ''}${ligne.suite ?? ''}${ligne.nom ?? ''}${ligne.avantOrganisation ?? ''}` +
      `${ligne.organisation ?? ''}${ligne.avantTitre ?? ''}`,
  ) +
  italique(ligne.titre ?? '') +
  droit(ligne.apresTitre ?? '');

// --- Une place réservée qu'occupe une autre personne -----------------------------------

describe('ligneListe : la réservation d\u{2019}une autre personne que l\u{2019}occupant (§ 7.6)', () => {
  test('petite démonstration, une réservation posée après la proposition : la ligne nomme sa titulaire, puis l\u{2019}occupant', () => {
    const charge = petite();
    const configuration = configurationDepuisCharge(charge);
    const [proposition] = rechercher(configuration, { graine: 8, nombre: 1, arret: 1000 });
    charge.propositions = [versFichier(proposition, configuration, { produitVersion: 'epreuve', attribuerSieges: false, decalage: 0 })];
    charge.prochainsIds.proposition = 2;
    charge.evenement.etat = 'propose';
    charge.reservations.push({ participant: 1, table: 1, siege: 2, portee: 'tous', tour: null });
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    const chaise2 = etat.tables[0].chaises[1];
    assert.equal(chaise2.reservation.participant, 1);
    assert.equal(etat.tables[0].chaises.some(({ occupant }) => occupant === 1), false, 'la proposition n\u{2019}assied pas la titulaire à la table 1');
    assert.notEqual(chaise2.occupant, null);
    const nomDe = nomsDe(charge);
    const titulaire = nomDe(1);
    const occupant = nomDe(chaise2.occupant);
    const ligne = ligneListe(chaise2, nomDe);
    assert.deepEqual(ligne, {
      numero: 2,
      etat: { cle: 'plan.ligne.reserveeA', details: { portee: 'tous', tour: null, nomsTours: undefined } },
      titulaire,
      nom: occupant,
      organisation: null,
      titre: null,
    });
    assert.deepEqual(modeleDessin(etat, options(charge)).tables[0].lignes[1], ligne);
    const textes = textesLigne(ligne, t);
    assert.equal(joindre(textes), `2. (réservée à ${titulaire}, tous les tours) ${occupant}`);
    // La titulaire et l'occupant occupent chacun leur partie, donc leur tspan.
    const parties = partiesLigne(ajusterLigne(textes, { mesurer: droit, mesurerItalique: italique, largeur: 1000, marque: MARQUE }));
    assert.deepEqual(
      parties.filter(({ partie }) => partie === 'titulaire' || partie === 'nom'),
      [
        { partie: 'titulaire', texte: titulaire },
        { partie: 'nom', texte: occupant },
      ],
    );
  });

  test('un tour que l’événement nomme remplace « tour 3 » dans la ligne : « (réservée, Dessert) », « (réservée à …, Dessert) »', () => {
    const nomsTours = [null, null, 'Dessert'];
    const propre = ligneListe(chaise(2, { occupant: 1, reservation: { participant: 1, portee: 'tour', tour: 3 } }), nomDeLigne, null, nomsTours);
    assert.equal(t(propre.etat.cle, propre.etat.details), '(réservée, Dessert)');
    const autre = ligneListe(chaise(2, { reservation: { participant: 1, portee: 'tour', tour: 3 } }), nomDeLigne, null, nomsTours);
    assert.equal(joindre(textesLigne(autre, t)), '2. (réservée à Iris Ombrelle, Dessert)');
  });

  test('réservée au seul tour 3 pour une autre personne, la place vide : « 2. (réservée à …, tour 3) »', () => {
    const ligne = ligneListe(chaise(2, { reservation: { participant: 1, portee: 'tour', tour: 3 } }), nomDeLigne);
    assert.deepEqual(ligne, {
      numero: 2,
      etat: { cle: 'plan.ligne.reserveeA', details: { portee: 'tour', tour: 3, nomsTours: undefined } },
      titulaire: 'Iris Ombrelle',
      nom: null,
      organisation: null,
      titre: null,
    });
    assert.equal(joindre(textesLigne(ligne, t)), '2. (réservée à Iris Ombrelle, tour 3)');
  });

  test('trop étroite : le nom de l\u{2019}occupant s\u{2019}abrège, puis tombe ; la titulaire s\u{2019}abrège, dans sa partie', () => {
    const entree = textesLigne(
      ligneListe(chaise(2, { occupant: 2, reservation: { participant: 1, portee: 'tous', tour: null } }), nomDeLigne),
      t,
    );
    const pleine = joindre(entree).length;
    const abregee = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur: pleine - 3, marque: MARQUE });
    assert.equal(abregee.titulaire, 'Iris Ombrelle');
    assert.ok(abregee.nom.endsWith(MARQUE));
    assert.ok(largeurDe(abregee) <= pleine - 3);
    const sansNom = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur: 40, marque: MARQUE });
    assert.equal(sansNom.nom, null);
    assert.ok(sansNom.titulaire.endsWith(MARQUE), sansNom.titulaire);
    assert.equal(sansNom.suite, entree.suiteSansNom);
    assert.ok(largeurDe(sansNom) <= 40, `${largeurDe(sansNom)}`);
  });
});

// --- La ligne entière tient dans la largeur du bloc ------------------------------------

describe('ajusterLigne : la ligne entière tient (§ 7.4)', () => {
  const textes = (nom, titre = null, pourvu = true) =>
    textesLigne({ numero: 1, etat: null, nom, titre: titre === null ? null : { libelle: titre, pourvu } }, t);

  test('une ligne qui tient reste entière', () => {
    const entree = textes('Iris Ombrelle', 'animateur');
    const ligne = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur: 100, marque: MARQUE });
    assert.deepEqual(ligne, {
      tete: entree.tete,
      titulaire: null,
      suite: null,
      nom: entree.nom,
      avantOrganisation: null,
      organisation: null,
      avantTitre: entree.avantTitre,
      titre: entree.titre,
      apresTitre: null,
    });
  });

  test('le nom s\u{2019}abrège à la largeur que lui laissent les autres parties, mesurées chacune dans son style', () => {
    const entree = textes('W'.repeat(200), 'animateur');
    // tête « 1. » + espace : 3 ; « — » entouré : 3 ; titre en italique : 13,5.
    const ligne = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur: 40, marque: MARQUE });
    assert.equal(ligne.titre, 'animateur');
    assert.ok(ligne.nom.endsWith(MARQUE));
    assert.ok(largeurDe(ligne) <= 40);
    assert.ok(largeurDe(ligne) > 39, `le nom prend toute la place restante : ${largeurDe(ligne)}`);
  });

  test('sans place pour la marque, le nom tombe et le titre s\u{2019}abrège', () => {
    const entree = textes('Iris Ombrelle', 'a'.repeat(30), false);
    const ligne = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur: 40, marque: MARQUE });
    assert.equal(ligne.nom, null);
    assert.equal(ligne.tete, entree.teteSansNom);
    assert.ok(ligne.titre.endsWith(MARQUE));
    assert.equal(ligne.apresTitre, entree.apresTitre);
    assert.ok(largeurDe(ligne) <= 40);
  });

  test('sans place pour le titre, il tombe avec ce qui l\u{2019}entoure ; une tête trop large s\u{2019}abrège', () => {
    const entree = textesLigne(
      { numero: 1, etat: { cle: 'plan.ligne.reserveeTous', details: {} }, nom: 'Iris Ombrelle', titre: { libelle: 'animateur', pourvu: true } },
      t,
    );
    const etroite = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur: 20, marque: MARQUE });
    assert.deepEqual([etroite.nom, etroite.avantTitre, etroite.titre, etroite.apresTitre], [null, null, null, null]);
    assert.ok(etroite.tete.startsWith('1. (r'));
    assert.ok(etroite.tete.endsWith(MARQUE));
    assert.ok(largeurDe(etroite) <= 20);
  });

  test('chaque ligne d\u{2019}un bloc ajusté tient, quelle que soit la largeur', () => {
    const lignes = SIX_FORMES.map(([, ligne]) => textesLigne(ligne, t));
    assert.equal(lignes.length, 6);
    for (const largeur of [5, 12, 20, 40, 80, 200]) {
      for (const entree of lignes) {
        const ligne = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur, marque: MARQUE });
        assert.ok(largeurDe(ligne) <= largeur, `${joindre(entree)} à ${largeur} : ${largeurDe(ligne)}`);
      }
    }
  });
});

// --- L'organisation à droite du nom ----------------------------------------------------

const ORGANISATIONS_LIGNES = new Map([
  [1, 'Club des Merles'],
  [2, ''],
  [3, 'Cercle des Hérons'],
]);
const organisationDeLigne = (id) => ORGANISATIONS_LIGNES.get(id) ?? null;

describe('l\u{2019}organisation de l\u{2019}occupant, à droite de son nom (§ 7.4, § 7.6)', () => {
  test('ligneListe la lit pour l\u{2019}occupant seul ; null sans organisationDe, sans occupant, ou vide', () => {
    const assise = chaise(1, { occupant: 1, titre: animateur(true) });
    assert.equal(ligneListe(assise, nomDeLigne, organisationDeLigne).organisation, 'Club des Merles');
    assert.equal(ligneListe(assise, nomDeLigne).organisation, null);
    assert.equal(ligneListe(chaise(2, { occupant: 2 }), nomDeLigne, organisationDeLigne).organisation, null);
    assert.equal(ligneListe(chaise(4, { occupant: 4 }), nomDeLigne, organisationDeLigne).organisation, null);
    assert.equal(ligneListe(chaise(5), nomDeLigne, organisationDeLigne).organisation, null);
    // Une titulaire que la chaise n'assied pas n'est nommée que par son nom.
    const tenue = ligneListe(chaise(6, { reservation: { participant: 1, portee: 'tous', tour: null } }), nomDeLigne, organisationDeLigne);
    assert.equal(tenue.titulaire, 'Iris Ombrelle');
    assert.equal(tenue.organisation, null);
    const autre = ligneListe(chaise(7, { occupant: 3, reservation: { participant: 1, portee: 'tous', tour: null } }), nomDeLigne, organisationDeLigne);
    assert.equal(autre.organisation, 'Cercle des Hérons');
  });

  test('textesLigne la pose après le nom, derrière un séparateur fin, avant le titre ; texteLigne et partiesLigne suivent cet ordre', () => {
    const ligne = ligneListe(chaise(3, { occupant: 3, titre: animateur(true) }), nomDeLigne, organisationDeLigne);
    const textes = textesLigne(ligne, t);
    assert.equal(textes.avantOrganisation, ' \u{00B7} ');
    assert.equal(textes.organisation, 'Cercle des Hérons');
    assert.equal(joindre(textes), '3. Ondine Lacasse \u{00B7} Cercle des Hérons \u{2014} animateur');
    assert.equal(texteLigne(ligne, t), joindre(textes));
    const reglage = { mesurer: droit, mesurerItalique: italique, largeur: 1000, marque: MARQUE };
    assert.deepEqual(
      partiesLigne(ajusterLigne(textes, reglage)).map(({ partie }) => partie),
      ['tete', 'nom', 'avantOrganisation', 'organisation', 'avantTitre', 'titre'],
    );
    // Sans nom, ni séparateur ni organisation, même reçue.
    const libre = textesLigne({ numero: 5, etat: { cle: 'plan.ligne.libre', details: {} }, nom: null, organisation: 'Club des Merles', titre: null }, t);
    assert.deepEqual([libre.avantOrganisation, libre.organisation], [null, null]);
  });

  test('ajusterLigne garde l\u{2019}organisation entière quand la ligne entière tient ; sinon elle sort de la ligne, jamais abrégée, et la ligne s\u{2019}ajuste comme sans elle', () => {
    const avec = textesLigne({ numero: 3, etat: null, nom: 'Ondine Lacasse', organisation: 'O'.repeat(60), titre: animateur(true) }, t);
    const sans = textesLigne({ numero: 3, etat: null, nom: 'Ondine Lacasse', organisation: null, titre: animateur(true) }, t);
    const reglage = (largeur) => ({ mesurer: droit, mesurerItalique: italique, largeur, marque: MARQUE });
    const pleine = largeurDe(avec);
    for (const largeur of [pleine, pleine + 10]) {
      const entiere = ajusterLigne(avec, reglage(largeur));
      assert.equal(entiere.organisation, avec.organisation, `à ${largeur}`);
      assert.equal(entiere.avantOrganisation, avec.avantOrganisation);
      assert.equal(entiere.nom, 'Ondine Lacasse');
    }
    for (const largeur of [pleine - 0.5, pleine - 30, largeurDe(sans) + 10, largeurDe(sans), largeurDe(sans) - 5, 12]) {
      assert.deepEqual(ajusterLigne(avec, reglage(largeur)), ajusterLigne(sans, reglage(largeur)), `à ${largeur}`);
    }
  });

  test('rangeesLigne : la ligne seule quand l\u{2019}organisation y tient ; sinon l\u{2019}organisation repliée sous le nom, en retrait, entre ses mots, sans séparateur ni marque', () => {
    const organisation = 'Fédération des jardins partagés du quartier';
    const avec = textesLigne({ numero: 3, etat: null, nom: 'Ondine Lacasse', organisation, titre: animateur(true) }, t);
    const sans = textesLigne({ numero: 3, etat: null, nom: 'Ondine Lacasse', organisation: null, titre: animateur(true) }, t);
    const reglage = (largeur) => ({ mesurer: droit, mesurerItalique: italique, largeur, marque: MARQUE });
    assert.deepEqual(rangeesLigne(avec, reglage(largeurDe(avec))), [{ parties: partiesLigne(ajusterLigne(avec, reglage(largeurDe(avec)))), retrait: false }]);
    assert.deepEqual(rangeesLigne(sans, reglage(40)), [{ parties: partiesLigne(ajusterLigne(sans, reglage(40))), retrait: false }]);

    const largeur = RETRAIT_ORGANISATION + 22;
    const rangees = rangeesLigne(avec, reglage(largeur));
    assert.deepEqual(rangees[0], { parties: partiesLigne(ajusterLigne(sans, reglage(largeur))), retrait: false });
    assert.equal(rangees[0].parties.find(({ partie }) => partie === 'nom').texte, 'Ondine Lacasse');
    const suite = rangees.slice(1);
    assert.deepEqual(
      suite.map(({ parties }) => parties.map(({ texte }) => texte).join('')),
      ['Fédération des jardins', 'partagés du quartier'],
    );
    for (const rangee of suite) {
      assert.equal(rangee.retrait, true);
      assert.deepEqual(rangee.parties.map(({ partie }) => partie), ['organisation']);
      assert.ok(RETRAIT_ORGANISATION + droit(rangee.parties[0].texte) <= largeur);
    }

    // Un mot trop long se coupe entre deux caractères ; rien ne s'abrège.
    const long = textesLigne({ numero: 3, etat: null, nom: 'Ondine Lacasse', organisation: 'O'.repeat(60), titre: null }, t);
    const coupees = rangeesLigne(long, reglage(largeur)).slice(1).map(({ parties }) => parties[0].texte);
    assert.deepEqual(coupees, ['O'.repeat(22), 'O'.repeat(22), 'O'.repeat(16)]);

    // Sans nom sur la ligne, l'organisation ne paraît pas.
    const etroite = rangeesLigne(avec, reglage(12));
    assert.equal(ajusterLigne(avec, reglage(12)).nom, null);
    assert.equal(etroite.length, 1);
  });

  test('chaque rangée tient dans sa largeur, retrait compris ; l\u{2019}organisation n\u{2019}est jamais abrégée, entière sur la ligne ou sous elle', () => {
    const organisation = 'Fédération des jardins partagés';
    const lignes = SIX_FORMES.map(([entree]) => textesLigne(ligneListe(entree, nomDeLigne, () => organisation), t));
    assert.ok(lignes.some((textes) => textes.organisation !== null));
    let repliees = 0;
    for (const largeur of [RETRAIT_ORGANISATION + 6, 30, 40, 60, 80, 200]) {
      for (const entree of lignes) {
        const reglage = { mesurer: droit, mesurerItalique: italique, largeur, marque: MARQUE };
        const rangees = rangeesLigne(entree, reglage);
        const [premiere, ...suite] = rangees;
        const ligne = ajusterLigne(entree, reglage);
        assert.ok(largeurDe(ligne) <= largeur);
        for (const { parties, retrait } of suite) {
          assert.equal(retrait, true);
          assert.ok(RETRAIT_ORGANISATION + droit(parties[0].texte) <= largeur, `${joindre(entree)} à ${largeur}`);
        }
        const sur = premiere.parties.find(({ partie }) => partie === 'organisation')?.texte ?? null;
        // Les blancs omis : un mot trop long se coupe sans espace.
        const sous = suite.map(({ parties }) => parties[0].texte).join('');
        if (entree.organisation !== null && ligne.nom !== null) {
          assert.equal((sur ?? sous).replaceAll(' ', ''), organisation.replaceAll(' ', ''), `${joindre(entree)} à ${largeur}`);
          assert.ok(sur === null || suite.length === 0);
        }
        if (suite.length > 0) repliees += 1;
        assert.ok(rangees.every(({ parties }) => parties.every(({ partie, texte }) => partie !== 'organisation' || !texte.includes(MARQUE))));
      }
    }
    assert.ok(repliees > 0, 'des organisations repliées');
  });

  test('rangeesListe : l\u{2019}en-tête d\u{2019}une table gelée, puis les rangées de chaque ligne dans l\u{2019}ordre des sièges, abrégées de plan.liste.abreviation', () => {
    const organisationDe = (id) => (id === 1 ? 'Fédération des jardins partagés du quartier' : 'Merles');
    const table = {
      enTete: { cle: 'plan.liste.gelee', details: {} },
      lignes: [chaise(1, { occupant: 1 }), chaise(2, { occupant: 2 }), chaise(3)].map((c) => ligneListe(c, nomDeLigne, organisationDe)),
    };
    const mesures = { mesurer: droit, mesurerItalique: italique, largeur: RETRAIT_ORGANISATION + 22 };
    const reglage = { ...mesures, marque: t('plan.liste.abreviation') };
    const rangees = rangeesListe(table, t, mesures);
    const attendues = [
      ...rangeesLigne({ tete: t('plan.liste.gelee'), teteSansNom: t('plan.liste.gelee'), nom: null, avantTitre: null, titre: null, apresTitre: null }, reglage),
      ...table.lignes.flatMap((ligne) => rangeesLigne(textesLigne(ligne, t), reglage)),
    ];
    assert.deepEqual(rangees, attendues);
    assert.deepEqual(rangees.map(({ retrait }) => retrait), [false, false, true, true, false, false]);
    assert.deepEqual(rangeesListe({ ...table, enTete: null }, t, mesures), attendues.slice(1));
  });

  test('chaque ligne, organisation comprise, tient dans sa largeur, quelle qu\u{2019}elle soit', () => {
    const lignes = SIX_FORMES.map(([entree]) => textesLigne(ligneListe(entree, nomDeLigne, () => 'Fédération des jardins partagés'), t));
    assert.ok(lignes.some(({ organisation }) => organisation !== null));
    for (const largeur of [5, 12, 20, 40, 60, 80, 200]) {
      for (const entree of lignes) {
        const ligne = ajusterLigne(entree, { mesurer: droit, mesurerItalique: italique, largeur, marque: MARQUE });
        assert.ok(largeurDe(ligne) <= largeur, `${joindre(entree)} à ${largeur} : ${largeurDe(ligne)}`);
        assert.equal(ligne.organisation === null, ligne.avantOrganisation === null);
      }
    }
  });

  test('chaque partie posée dans son tspan, sa chasse arrondie : la somme des parties rendues tient dans la largeur, quand la suite d\u{2019}un tenant y tenait déjà', () => {
    // Une chasse de 1,1 par unité de code, que chaque mesure arrondit par
    // excès au quart : « 3. » et « Ondine Lacasse » posés à part rendent
    // plus large que leur suite d'un tenant.
    const arrondi = (chaine) => Math.ceil(chaine.length * 1.1 * 4) / 4;
    const rendue = (ligne) =>
      partiesLigne(ligne).reduce((somme, { partie, texte }) => somme + (partie === 'titre' ? italique(texte) : arrondi(texte)), 0);
    const lignes = [
      textesLigne(ligneListe(chaise(3, { occupant: 3, titre: animateur(true) }), nomDeLigne, organisationDeLigne), t),
      textesLigne(ligneListe(chaise(1, { occupant: 1, reservation: { participant: 1, portee: 'tous', tour: null } }), nomDeLigne, organisationDeLigne), t),
      textesLigne(ligneListe(chaise(2, { occupant: 2, reservation: { participant: 1, portee: 'tous', tour: null } }), nomDeLigne), t),
    ];
    let serrees = 0;
    for (const entree of lignes) {
      for (let largeur = 4; largeur <= 90; largeur += 0.125) {
        const ligne = ajusterLigne(entree, { mesurer: arrondi, mesurerItalique: italique, largeur, marque: MARQUE });
        assert.ok(rendue(ligne) <= largeur, `${joindre(ligne)} à ${largeur} : ${rendue(ligne)}`);
        if (rendue(ligne) > largeur - 0.25) serrees += 1;
      }
    }
    assert.ok(serrees > 0, 'des lignes au plus près de leur largeur');
  });

  test('modeleDessin : l\u{2019}organisation de chaque occupant avec l\u{2019}option, aucune sans elle ; TypeError sans organisationDe', () => {
    const charge = avecPropositions(petite());
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    const organisationDe = organisationDeCharge(charge);
    const occupants = etat.tables.flatMap(({ chaises }) => chaises.map(({ occupant }) => occupant));
    assert.ok(occupants.some((id) => id !== null && organisationDe(id) !== null));
    const organisationsDes = (modele) => modele.tables.flatMap(({ lignes }) => lignes.map(({ organisation }) => organisation));
    const attendues = occupants.map((id) => (id === null ? null : organisationDe(id)));
    for (const impression of [false, true]) {
      const base = options(charge, { impression });
      assert.ok(organisationsDes(modeleDessin(etat, base)).every((organisation) => organisation === null));
      assert.deepEqual(organisationsDes(modeleDessin(etat, { ...base, organisations: false, organisationDe })), occupants.map(() => null));
      assert.deepEqual(organisationsDes(modeleDessin(etat, { ...base, organisations: true, organisationDe })), attendues);
    }
    assert.throws(() => modeleDessin(etat, options(charge, { organisations: true })), TypeError);
  });
});

describe('ordonneesLignes : une ligne sous la précédente', () => {
  test('la première ligne sous le haut du bloc, d\u{2019}une hauteur de ligne ; puis une hauteur de plus chacune', () => {
    assert.deepEqual(ordonneesLignes(-50, 3, 20), [-30, -10, 10]);
    assert.deepEqual(ordonneesLignes(0, 0, 20), []);
  });
});

// --- Régime, listes, marques, bords ------------------------------------------------------

// Une charge de tables rondes de capacités données, des personnes inventées.
function chargeDeTables(capacites, { tours = 1 } = {}) {
  const charge = creerCharge({ id: 'epreuve:tables', nom: 'Tables', siegesParDefaut: 8, tours });
  charge.tables = capacites.map((sieges, i) => ({
    id: i + 1,
    numero: i + 1,
    sieges,
    forme: i % 2 === 0 ? 'ronde' : 'carree',
    position: { x: 400 * i, y: 0 },
  }));
  charge.participants = NOMS.map(([prenom, nom], i) => personne(i + 1, nom, prenom, null));
  charge.prochainsIds = { participant: 13, table: capacites.length + 1, proposition: 1 };
  return charge;
}

describe('modeleDessin : le dessin d\u{2019}une table (§ 7.3, § 7.6, § 17 point 6)', () => {
  test('géométrie de geometrieTable ; chaises dessinées en régime sièges, aucune en régime table', () => {
    const charge = chargeDeTables([8, 12, 2]);
    const etat = etatPlaces(charge, { tour: 1 });
    for (const k of [0.39, 0.41, 2]) {
      const modele = modeleDessin(etat, options(charge, { k }));
      assert.equal(modele.tables.length, 3);
      for (const table of modele.tables) {
        const enregistrement = charge.tables.find(({ id }) => id === table.id);
        const geometrie = geometrieTable(enregistrement, etat.tables.find(({ id }) => id === table.id).capacite);
        assert.deepEqual(table.geometrie, geometrie);
        assert.equal(table.regime, regimeCibles(k, geometrie));
        if (table.regime === 'table') assert.deepEqual(table.chaises, []);
        else {
          assert.equal(table.chaises.length, geometrie.chaises.length);
          table.chaises.forEach((dessin, i) => {
            const { siege, x, y, rayon } = geometrie.chaises[i];
            assert.deepEqual({ siege: dessin.siege, x: dessin.x, y: dessin.y, rayon: dessin.rayon }, { siege, x, y, rayon });
          });
        }
      }
    }
    const regimes = (k) => modeleDessin(etat, options(charge, { k })).tables.map(({ regime }) => regime);
    assert.deepEqual(regimes(0.39), ['table', 'table', 'sieges']);
    assert.deepEqual(regimes(0.41), ['sieges', 'sieges', 'sieges']);
  });

  test('listes rendues : demandées et k ≥ K_LISTES', () => {
    const charge = chargeDeTables([8]);
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(modeleDessin(etat, options(charge, { k: K_LISTES - 0.01 })).listesRendues, false);
    assert.equal(modeleDessin(etat, options(charge, { k: K_LISTES })).listesRendues, true);
    assert.equal(modeleDessin(etat, options(charge, { k: K_LISTES + 0.01 })).listesRendues, true);
    assert.equal(modeleDessin(etat, options(charge, { k: 5, listes: false })).listesRendues, false);
    assert.equal('largeurListe' in modeleDessin(etat, options(charge)), false, 'la largeur du bloc est celle du registre');
  });

  test('une ligne par siège, de 1 à la capacité, quel que soit le régime', () => {
    const charge = chargeDeTables([8, 2]);
    const etat = etatPlaces(charge, { tour: 1 });
    const modele = modeleDessin(etat, options(charge, { k: 0.1 }));
    assert.deepEqual(
      modele.tables.map(({ lignes }) => lignes.map(({ numero }) => numero)),
      [
        [1, 2, 3, 4, 5, 6, 7, 8],
        [1, 2],
      ],
    );
  });

  test('remplissage, marques et mise en évidence reprennent l\u{2019}état des places, au tour montré', () => {
    const charge = chargeDeTables([8], { tours: 2 });
    charge.reservations = [
      { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null },
      { participant: 2, table: 1, siege: 3, portee: 'tour', tour: 1 },
    ];
    charge.titres = [
      { table: 1, siege: 1, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'animateur' },
    ];
    for (const tour of [1, 2]) {
      const etat = etatPlaces(charge, { tour });
      const modele = modeleDessin(etat, options(charge, { miseEnEvidence: 1 }));
      const [table] = modele.tables;
      assert.equal(table.chaises.length, 8);
      table.chaises.forEach((dessin, i) => {
        const lue = etat.tables[0].chaises[i];
        assert.equal(dessin.remplissage, lue.remplissage);
        assert.deepEqual(dessin.marques, lue.marques);
        assert.equal(dessin.miseEnEvidence, lue.occupant === 1);
      });
      assert.equal(table.chaises.filter(({ miseEnEvidence }) => miseEnEvidence).length, 1);
    }
    const [tour1] = modeleDessin(etatPlaces(charge, { tour: 1 }), options(charge)).tables;
    assert.deepEqual(tour1.chaises.slice(0, 3).map(({ marques }) => marques), [['cadenasFerme', 'anneau'], ['cadenasOuvert'], ['cadenasFerme']]);
    assert.deepEqual(tour1.chaises.slice(0, 3).map(({ remplissage }) => remplissage), ['plein', 'hachure', 'plein']);
    assert.ok(tour1.chaises.every(({ miseEnEvidence }) => miseEnEvidence === false), 'aucune mise en évidence demandée');
  });

  test('chaque table porte le numéro de l’état des places, distinct de son identifiant, à tout zoom', () => {
    const charge = chargeDeTables([2, 3, 8]);
    charge.tables = charge.tables.map((table, rang) => ({ ...table, numero: [14, 3, 27][rang] }));
    const etat = etatPlaces(charge, { tour: 1 });
    for (const k of [K_LISTES / 10, 1, 5]) {
      const tables = modeleDessin(etat, options(charge, { k })).tables;
      assert.deepEqual(tables.map(({ id, numero }) => [id, numero]), [[1, 14], [2, 3], [3, 27]], String(k));
    }
  });

  test('le libellé d\u{2019}une table se dessine dès K_LISTES et à l\u{2019}impression, masqué en dessous ; le nom accessible le porte à tout zoom', () => {
    const charge = chargeDeTables([2, 3, 8]);
    charge.tables[1].libelle = 'Coin des invités';
    const etat = etatPlaces(charge, { tour: 1 });
    const libelles = (opts) => modeleDessin(etat, options(charge, opts)).tables.map(({ libelle }) => libelle);
    assert.deepEqual(libelles({ k: K_LISTES - 0.01 }), [null, null, null]);
    assert.deepEqual(libelles({ k: K_LISTES }), [null, 'Coin des invités', null]);
    assert.deepEqual(libelles({ k: 5 }), [null, 'Coin des invités', null]);
    // Les listes de noms masquées ne masquent pas le libellé : il suit le zoom seul.
    assert.deepEqual(libelles({ k: 5, listes: false }), [null, 'Coin des invités', null]);
    assert.deepEqual(libelles({ impression: true }), [null, 'Coin des invités', null]);
    assert.deepEqual(libelles({ impression: true, listes: false }), [null, 'Coin des invités', null]);
    for (const k of [K_LISTES / 10, K_LISTES - 0.01, 1, 5]) {
      const [, libellee, autre] = modeleDessin(etat, options(charge, { k })).tables;
      assert.equal(libellee.nomAccessible.details.libelle, 'Coin des invités', String(k));
      assert.equal(autre.nomAccessible.details.libelle, null, String(k));
      assert.match(t(libellee.nomAccessible.cle, libellee.nomAccessible.details), /^Table 2 « Coin des invités », 3 places/);
      assert.match(t(autre.nomAccessible.cle, autre.nomAccessible.details), /^Table 3, 8 places/);
    }
  });

  test('une table gelée le dit dans son nom accessible et en tête de sa liste ; une surchargée, dans son nom', () => {
    const charge = chargeDeTables([2, 3]);
    charge.reservations = [
      { participant: 1, table: 1, siege: 1, portee: 'tous', tour: null },
      { participant: 2, table: 1, siege: 2, portee: 'tous', tour: null },
    ];
    charge.evenement.siegesParDefaut = 3;
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(etat.tables[0].gelee, true);
    const [gelee, autre] = modeleDessin(etat, options(charge)).tables;
    assert.equal(gelee.gelee, true);
    assert.deepEqual(gelee.enTete, { cle: 'plan.liste.gelee', details: {} });
    assert.equal(gelee.nomAccessible.cle, 'plan.table.nom');
    assert.match(t(gelee.nomAccessible.cle, gelee.nomAccessible.details), /gelée/);
    assert.match(t(gelee.nomAccessible.cle, gelee.nomAccessible.details), /surchargée/);
    assert.equal(autre.gelee, false);
    assert.equal(autre.enTete, null);
    assert.doesNotMatch(t(autre.nomAccessible.cle, autre.nomAccessible.details), /gelée/);
    assert.match(t(autre.nomAccessible.cle, autre.nomAccessible.details), /^Table 2, 3 places, .*surchargée$/);
  });

  test('sièges non attribués, deux titres et une réservation « tous » sans siège : la réservée au siège 1, pourvue ; « 2. (libre) — titre … non pourvu »', () => {
    const charge = chargeDeTables([4]);
    charge.participants = charge.participants.slice(0, 1);
    charge.prochainsIds.participant = 2;
    charge.reservations = [{ participant: 1, table: 1, siege: null, portee: 'tous', tour: null }];
    charge.titres = [
      { table: 1, siege: 1, libelle: 'animateur' },
      { table: 1, siege: 2, libelle: 'animateur' },
    ];
    const etat = etatPlaces(charge, { tour: 1 });
    const [table] = modeleDessin(etat, options(charge)).tables;
    const textes = table.lignes.map((ligne) => joindre(textesLigne(ligne, t)));
    assert.deepEqual(textes, [
      '1. (réservée, tous les tours) Iris Ombrelle \u{2014} animateur',
      '2. (libre) \u{2014} titre animateur non pourvu',
      '3. (libre)',
      '4. (libre)',
    ]);
  });
});

describe('libelleLongueur : la longueur de la barre en mots (§ 7.7)', () => {
  test('cm sous le mètre, m sous le kilomètre, km au-delà ; décimales d\u{2019}une longueur sous l\u{2019}unité', () => {
    assert.deepEqual(libelleLongueur(50), { valeur: 50, decimales: 0, cle: 'plan.echelle.centimetres' });
    assert.deepEqual(libelleLongueur(200), { valeur: 2, decimales: 0, cle: 'plan.echelle.metres' });
    assert.deepEqual(libelleLongueur(500000), { valeur: 5, decimales: 0, cle: 'plan.echelle.kilometres' });
    assert.deepEqual(libelleLongueur(0.5), { valeur: 0.5, decimales: 1, cle: 'plan.echelle.centimetres' });
    assert.deepEqual(libelleLongueur(0.02), { valeur: 0.02, decimales: 2, cle: 'plan.echelle.centimetres' });
    assert.deepEqual(libelleLongueur(0.1), { valeur: 0.1, decimales: 1, cle: 'plan.echelle.centimetres' });
    assert.deepEqual(libelleLongueur(0.01), { valeur: 0.01, decimales: 2, cle: 'plan.echelle.centimetres' });
    assert.deepEqual(libelleLongueur(1), { valeur: 1, decimales: 0, cle: 'plan.echelle.centimetres' });
    assert.ok(LARGEUR_ECHELLE_PX > 0);
  });
});

describe('formesTable : les formes d\u{2019}une table, en attributs SVG (§ 7.1, § 7.7)', () => {
  test('ronde : disques du plateau et de l\u{2019}emprise ; carrée : carrés aux côtés parallèles aux axes', () => {
    const ronde = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 100, y: -40 } }, 8);
    const formes = formesTable(ronde);
    assert.equal(formes.ronde, true);
    assert.deepEqual(formes.plateau, { cx: 100, cy: -40, r: ronde.demiTaille });
    assert.deepEqual(formes.emprise, { cx: 100, cy: -40, r: ronde.rayonEmprise });
    const carree = geometrieTable({ id: 2, numero: 2, forme: 'carree', position: { x: 0, y: 0 } }, 12);
    const deCarree = formesTable(carree);
    assert.equal(deCarree.ronde, false);
    assert.deepEqual(deCarree.plateau, { x: -90, y: -90, width: 180, height: 180 });
    assert.deepEqual(deCarree.emprise, {
      x: -carree.rayonEmprise,
      y: -carree.rayonEmprise,
      width: 2 * carree.rayonEmprise,
      height: 2 * carree.rayonEmprise,
    });
  });

  test('le numéro au centre du plateau, à son corps ; la pastille en haut à droite, sur le bord ; la marque de gel dans le plateau, au-dessus du numéro', () => {
    for (const forme of ['ronde', 'carree']) {
      for (const places of [2, 8, 16]) {
        const geometrie = geometrieTable({ id: 1, numero: 1, forme, position: { x: 10, y: 20 } }, places);
        const { numero, pastille, gel } = formesTable(geometrie);
        assert.deepEqual(numero, { x: 10, y: 20, corps: corpsNumero(geometrie.demiTaille) });
        assert.deepEqual(numero, placeNumero(geometrie));
        assert.deepEqual(pastille, placePastille(geometrie));
        assert.ok(pastille.x > 10 && pastille.y < 20, `${forme} de ${places} : ${pastille.x}, ${pastille.y}`);
        assert.deepEqual(gel, placeGel(geometrie));
        assert.equal(gel.x, 10);
        assert.ok(gel.y + DEMI_HAUTEUR_GEL <= 20 - numero.corps / 2 && gel.y > 20 - geometrie.demiTaille, `${forme} de ${places} : ${gel.y}`);
      }
    }
    // Le corps suit les chiffres du numéro de la table : trois chiffres le
    // réduisent sur la plus petite ronde.
    const petite = geometrieTable({ id: 1, numero: 888, forme: 'ronde', position: { x: 10, y: 20 } }, 2);
    assert.deepEqual(formesTable(petite).numero, placeNumero(petite));
    assert.ok(formesTable(petite).numero.corps < corpsNumero(petite.demiTaille));
  });

  test('avec un libellé, le numéro monte au-dessus du centre et les lignes du libellé le suivent ; sans libellé, aucune ligne', () => {
    for (const forme of ['ronde', 'carree']) {
      for (const places of [2, 8, 16]) {
        const geometrie = geometrieTable({ id: 1, numero: 12, forme, position: { x: 10, y: 20 } }, places);
        const avec = formesTable(geometrie, { libelle: true });
        assert.deepEqual(avec.numero, placeNumero(geometrie, { libelle: true }));
        assert.ok(avec.numero.y < 20, `${forme} de ${places}`);
        assert.deepEqual(avec.libelle, lignesLibelle(geometrie));
        const sans = formesTable(geometrie, { libelle: false });
        assert.deepEqual(sans, formesTable(geometrie));
        assert.equal(sans.libelle, null);
        assert.deepEqual({ ...avec, numero: sans.numero, libelle: null }, sans);
      }
    }
  });

  test('le retracé du contour suit le bord du plateau et s\u{2019}interrompt sous le disque de la pastille, à ARRET_RETRACE de son centre', () => {
    assert.ok(ARRET_RETRACE > 0 && ARRET_RETRACE < RAYON_PASTILLE);
    const carree = geometrieTable({ id: 2, numero: 2, forme: 'carree', position: { x: 0, y: 0 } }, 12);
    assert.deepEqual(formesTable(carree).pastille, { x: 90, y: -90 });
    assert.equal(formesTable(carree).retrace, `M90,${-90 + ARRET_RETRACE} V90 H-90 V-90 H${90 - ARRET_RETRACE}`);
    const angle = (q, centre) => Math.atan2(q.y - centre.y, q.x - centre.x);
    const ecart = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
    for (const places of [1, 2, 4, 5, 8, 16, 40]) {
      const ronde = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 10, y: 20 } }, places);
      const { centre, demiTaille } = ronde;
      const { pastille, retrace } = formesTable(ronde);
      const trace = /^M(\S+),(\S+) A(\S+),(\S+) 0 1 1 (\S+),(\S+)$/.exec(retrace);
      assert.ok(trace !== null, retrace);
      const [sx, sy, rx, ry, ex, ey] = trace.slice(1).map(Number);
      assert.deepEqual([rx, ry], [demiTaille, demiTaille]);
      const debut = { x: sx, y: sy };
      const fin = { x: ex, y: ey };
      for (const bout of [debut, fin]) {
        assert.ok(Math.abs(Math.hypot(bout.x - centre.x, bout.y - centre.y) - demiTaille) < 1e-9, `${places} : ${retrace}`);
        assert.ok(Math.abs(Math.hypot(bout.x - pastille.x, bout.y - pastille.y) - ARRET_RETRACE) < 1e-9, `${places} : ${retrace}`);
      }
      // L'arc part après la pastille, dans le sens des angles croissants, et
      // la rejoint par le grand tour.
      assert.ok(ecart(angle(debut, centre), angle(pastille, centre)) > 0, `${places} : ${retrace}`);
      assert.ok(ecart(angle(fin, centre), angle(pastille, centre)) < 0, `${places} : ${retrace}`);
    }
  });

  test('le tracé de la marque de gel tient dans le carré de demi-côté DEMI_HAUTEUR_GEL que la place du numéro évite', () => {
    const nombres = TRACE_GEL.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.equal(Math.max(...nombres.map(Math.abs)), DEMI_HAUTEUR_GEL);
    assert.equal(RETRAIT_GEL, RETRAIT_GEL_PLATEAU);
    assert.equal(RAYON_PASTILLE, RAYON_PASTILLE_PLATEAU);
  });
});

describe('les marques autour d\u{2019}une table laissent la liste de noms à découvert (§ 7.4, § 14.5)', () => {
  // Le trait du carré du focus fait 3 px à l'écran (TablePlan) : sa moitié
  // extérieure couvre au plus 1,5 px, soit 1,5 / k cm, et les listes ne se
  // rendent qu'à k ≥ K_LISTES.
  const DEMI_TRAIT_FOCUS_CM = 1.5 / K_LISTES;

  test('le focus, de la table ou de sa chaise la plus à droite, et la poignée finissent avant le bloc de noms', () => {
    for (const forme of ['ronde', 'carree']) {
      for (const places of [2, 3, 5, 8, 12, 16]) {
        const g = geometrieTable({ id: 1, numero: 1, forme, position: { x: 40, y: -70 } }, places);
        const droite = Math.max(...g.chaises.map((chaise) => chaise.x + chaise.rayon));
        const bords = {
          'focus de la table': g.centre.x + g.rayonEmprise + ECART_FOCUS + DEMI_TRAIT_FOCUS_CM,
          'focus de la chaise': droite + ECART_FOCUS + DEMI_TRAIT_FOCUS_CM,
          poignée: g.poignee.x + RAYON_POIGNEE,
        };
        for (const [quoi, bord] of Object.entries(bords)) {
          assert.ok(bord < g.origineListe.x, `${forme} de ${places} : ${quoi} jusqu'à ${bord}, liste dès ${g.origineListe.x}`);
        }
      }
    }
  });

  test('les autres marques d\u{2019}une chaise restent sous le focus ; le socle de la pastille, entre elle et le plus petit plateau', () => {
    for (const ecart of [ECART_ANNEAU, ECART_MISE_EN_EVIDENCE, ECART_DESIGNATION]) assert.ok(ecart < ECART_FOCUS, String(ecart));
    assert.ok(RAYON_PASTILLE < RAYON_SOCLE_PASTILLE);
    assert.ok(RAYON_SOCLE_PASTILLE < PLANCHER_DIAMETRE / 2);
  });
});

describe('partiesLigne : les tspans d\u{2019}une ligne, dans l\u{2019}ordre', () => {
  test('chaque partie présente, nommée ; les absentes omises', () => {
    const ligne = { tete: '1. ', titulaire: null, suite: null, nom: 'Iris Ombrelle', avantTitre: ' \u{2014} ', titre: 'animateur', apresTitre: null };
    assert.deepEqual(partiesLigne(ligne), [
      { partie: 'tete', texte: '1. ' },
      { partie: 'nom', texte: 'Iris Ombrelle' },
      { partie: 'avantTitre', texte: ' \u{2014} ' },
      { partie: 'titre', texte: 'animateur' },
    ]);
    assert.deepEqual(partiesLigne({ tete: '5. (libre)', titulaire: null, suite: null, nom: null, avantTitre: null, titre: null, apresTitre: null }), [
      { partie: 'tete', texte: '5. (libre)' },
    ]);
  });
});

// --- L'option poignee -----------------------------------------------------------

describe('modeleDessin : l\u{2019}option poignee dessine une table au nombre tiré, sans toucher l\u{2019}état (§ 7.1)', () => {
  test('sans option, ou poignee null : chaque table à sa capacité', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const sans = modeleDessin(etat, options(charge));
    assert.deepEqual(modeleDessin(etat, options(charge, { poignee: null })), sans);
    assert.equal(sans.tables.length, 4);
    for (const table of sans.tables) assert.equal(table.lignes.length, etat.tables.find(({ id }) => id === table.id).capacite);
  });

  test('tirée vers plus : la table se dessine à places, chaises 1 à places, celles au-delà de sa capacité libres', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const avant = JSON.stringify(etat);
    const cible = etat.tables[1];
    const capacite = cible.capacite;
    const places = capacite + 3;
    const modele = modeleDessin(etat, options(charge, { poignee: { table: cible.id, places } }));
    assert.equal(JSON.stringify(etat), avant, 'l\u{2019}état des places n\u{2019}est pas touché');
    const tiree = modele.tables[1];
    assert.equal(tiree.id, cible.id);
    assert.deepEqual(tiree.geometrie, geometrieTable(cible, places));
    assert.equal(tiree.chaises.length, places);
    assert.deepEqual(tiree.chaises.map(({ siege }) => siege), Array.from({ length: places }, (_, i) => i + 1));
    for (const chaise of tiree.chaises.slice(capacite)) {
      assert.equal(chaise.remplissage, 'normal');
      assert.deepEqual(chaise.marques, []);
      assert.equal(chaise.miseEnEvidence, false);
    }
    assert.equal(tiree.lignes.length, places);
    for (const ligne of tiree.lignes.slice(capacite)) {
      assert.deepEqual(ligne.etat, { cle: 'plan.ligne.libre', details: {} });
      assert.equal(ligne.nom, null);
    }
    assert.deepEqual(tiree.lignes.slice(0, capacite), cible.chaises.map((chaise) => ligneListe(chaise, nomsDe(charge))));
    assert.equal(tiree.nomAccessible.details.places, places);
    const autres = modeleDessin(etat, options(charge));
    for (const rang of [0, 2, 3]) assert.deepEqual(modele.tables[rang], autres.tables[rang], `table de rang ${rang} inchangée`);
  });

  test('tirée vers moins : chaises et lignes 1 à places ; le régime se lit sur la géométrie tirée', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const cible = etat.tables[0];
    const modele = modeleDessin(etat, options(charge, { poignee: { table: cible.id, places: 2 } }));
    const tiree = modele.tables[0];
    assert.equal(tiree.chaises.length, 2);
    assert.equal(tiree.lignes.length, 2);
    assert.equal(tiree.geometrie.chaises.length, 2);
    for (const k of [0.2, 0.5, 1]) {
      const auZoom = modeleDessin(etat, options(charge, { k, poignee: { table: cible.id, places: 30 } })).tables[0];
      assert.equal(auZoom.regime, regimeCibles(k, geometrieTable(cible, 30)), `k = ${k}`);
    }
  });
});

// --- Le plan écarté -----------------------------------------------------------

describe('modeleDessin et rangeesEcartees : le plan écarté, quand l\u{2019}organisation allonge les listes (§ 7.4, § 11.7)', () => {
  // La petite démonstration, ses tables posées en une colonne, à 300 cm
  // l'une de l'autre ; chaque occupant porte une organisation qui ne tient
  // pas à côté de son nom dans un bloc étroit, et se replie dessous.
  function enColonne() {
    const charge = petite();
    charge.tables = charge.tables.map((table, rang) => ({ ...table, position: { x: 40, y: 300 * rang } }));
    charge.participants = charge.participants.map((participant) => ({ ...participant, organisation: 'Fédération des jardins partagés du quartier' }));
    return charge;
  }
  const mesures = { mesurer: droit, mesurerItalique: italique, largeur: 60, hauteur: 35 };

  test('sans rangées, ou des rangées vides, chaque table à sa position ; des rangées ne changent que la géométrie et les chaises', () => {
    const charge = enColonne();
    const etat = etatPlaces(charge, { tour: 1 });
    const base = options(charge, { organisations: true, organisationDe: organisationDeCharge(charge) });
    const sans = modeleDessin(etat, base);
    assert.deepEqual(modeleDessin(etat, { ...base, rangees: [] }), sans);
    for (const table of sans.tables) {
      const etatTable = etat.tables.find(({ id }) => id === table.id);
      assert.deepEqual(table.geometrie, geometrieTable(etatTable, etatTable.capacite));
    }
    const rangees = [{ y: 0, decalage: 0 }, { y: 300, decalage: 70 }, { y: 600, decalage: 130 }, { y: 900, decalage: 130 }];
    const ecarte = modeleDessin(etat, { ...base, rangees });
    assert.equal(ecarte.tables.length, sans.tables.length);
    for (const [rang, table] of ecarte.tables.entries()) {
      const etatTable = etat.tables[rang];
      const geometrie = geometrieTable({ ...etatTable, position: dessinDepuisPosition(etatTable.position, rangees) }, etatTable.capacite);
      assert.deepEqual(table.geometrie, geometrie, `table ${table.id}`);
      assert.equal(table.geometrie.centre.y, etatTable.position.y + rangees[rang].decalage);
      assert.deepEqual(table.chaises.map(({ x, y }) => ({ x, y })), geometrie.chaises.map(({ x, y }) => ({ x, y })));
      const { geometrie: _g, chaises, ...reste } = table;
      const { geometrie: _h, chaises: chaisesSans, ...resteSans } = sans.tables[rang];
      assert.deepEqual(reste, resteSans, `table ${table.id} : le reste inchangé`);
      assert.deepEqual(
        chaises.map(({ x: _x, y: _y, ...autres }) => autres),
        chaisesSans.map(({ x: _x, y: _y, ...autres }) => autres),
      );
    }
    const { tables: _t, ...horsTables } = ecarte;
    const { tables: _u, ...horsTablesSans } = sans;
    assert.deepEqual(horsTables, horsTablesSans);
  });

  test('rangeesEcartees : chaque bloc haut de ses rangées plus une, organisations repliées comprises, sa référence de ses rangées sans retrait ; aucun bloc sur celui du dessous', () => {
    const charge = avecPropositions(enColonne());
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    const modele = modeleDessin(etat, options(charge, { organisations: true, organisationDe: organisationDeCharge(charge) }));
    const reglage = { mesurer: droit, mesurerItalique: italique, largeur: mesures.largeur };
    const rangeesDe = new Map(modele.tables.map((table) => [table.id, rangeesListe(table, t, reglage)]));
    assert.ok(
      modele.tables.every((table) => rangeesDe.get(table.id).length > table.lignes.length),
      'chaque table replie des organisations',
    );
    const hauteurDe = (n) => (n + 1) * mesures.hauteur;
    const hauteurs = new Map([...rangeesDe].map(([id, lues]) => [id, hauteurDe(lues.length)]));
    const references = new Map([...rangeesDe].map(([id, lues]) => [id, hauteurDe(lues.filter(({ retrait }) => !retrait).length)]));
    const geometries = modele.tables.map(({ geometrie }) => geometrie);
    const rangees = rangeesEcartees(modele, t, mesures);
    assert.deepEqual(rangees, ecarterRangees(geometries, { largeur: mesures.largeur, hauteurs, references }));
    assert.ok(rangees.at(-1).decalage > 0, 'les rangées s\u{2019}écartent');
    const ecarte = modeleDessin(etat, options(charge, { organisations: true, organisationDe: organisationDeCharge(charge), rangees }));
    const blocs = ecarte.tables.map(({ geometrie }) => blocNoms(geometrie, { largeur: mesures.largeur, hauteurs }));
    const blocsSans = geometries.map((geometrie) => blocNoms(geometrie, { largeur: mesures.largeur, hauteurs: references }));
    for (const [rang, bloc] of blocs.slice(1).entries()) {
      const exige = Math.min(ECART_LISTE, blocsSans[rang + 1].minY - blocsSans[rang].maxY);
      assert.ok(exige > 0, `sans organisation, aucun bloc sur celui du dessous, rang ${rang}`);
      assert.ok(bloc.minY - blocs[rang].maxY >= exige - 1e-9, `sous la table de rang ${rang}`);
    }
    // Sans organisation, les mêmes blocs tiennent dans le pas de 300 cm.
    assert.deepEqual(rangeesEcartees(modeleDessin(etat, options(charge)), t, mesures), []);
  });

  test('rangeesEcartees : une organisation qui tient sur la ligne du nom ne déplace aucune rangée, même entre des blocs plus proches qu\u{2019}ECART_LISTE', () => {
    const charge = avecPropositions(enColonne());
    charge.tables = charge.tables.map((table, rang) => ({ ...table, position: { x: 40, y: 120 * rang } }));
    charge.participants = charge.participants.map((participant) => ({ ...participant, organisation: 'A' }));
    const etat = etatPlaces(charge, { tour: 1, proposition: 1 });
    const large = { ...mesures, largeur: 400 };
    const modele = modeleDessin(etat, options(charge, { organisations: true, organisationDe: organisationDeCharge(charge) }));
    const reglage = { mesurer: droit, mesurerItalique: italique, largeur: large.largeur };
    assert.ok(modele.tables.every((table) => rangeesListe(table, t, reglage).every(({ retrait }) => !retrait)), 'aucune organisation repliée');
    const hauteurs = new Map(modele.tables.map((table) => [table.id, (rangeesListe(table, t, reglage).length + 1) * large.hauteur]));
    assert.notDeepEqual(ecarterRangees(modele.tables.map(({ geometrie }) => geometrie), { largeur: large.largeur, hauteurs }), [], 'sans référence, les blocs s\u{2019}écarteraient');
    assert.deepEqual(rangeesEcartees(modele, t, large), []);
  });
});

// --- La sélection et l'élément actif ---------------------------------------------

describe('modeleDessin : les options selection et actif marquent leur chaise, ou leur table, et elle seule (§ 7.1, § 7.3)', () => {
  // Les porteurs d'une marque : 'table:<id>' ou 'siege:<id>:<siège>'.
  function porteurs(modele, marque) {
    const trouves = [];
    for (const table of modele.tables) {
      if (table[marque]) trouves.push(`table:${table.id}`);
      for (const chaise of table.chaises) if (chaise[marque]) trouves.push(`siege:${table.id}:${chaise.siege}`);
    }
    return trouves;
  }

  test('sans option, ni sélection ni focus ; chaque table et chaque chaise porte les deux drapeaux, faux', () => {
    const charge = petite();
    const modele = modeleDessin(etatPlaces(charge, { tour: 1 }), options(charge));
    assert.equal(modele.tables.length, 4);
    let chaises = 0;
    for (const table of modele.tables) {
      assert.equal(table.selection, false);
      assert.equal(table.focus, false);
      for (const chaise of table.chaises) {
        chaises += 1;
        assert.equal(chaise.selection, false);
        assert.equal(chaise.focus, false);
      }
    }
    assert.ok(chaises > 0);
  });

  test('régime sièges : un siège marque sa chaise, une place sans siège marque sa table', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const [, deuxieme, troisieme] = etat.tables;
    const modele = modeleDessin(etat, options(charge, { selection: { table: deuxieme.id, siege: 2 }, actif: { table: troisieme.id, siege: null } }));
    assert.equal(modele.tables[1].regime, 'sieges');
    assert.deepEqual(porteurs(modele, 'selection'), [`siege:${deuxieme.id}:2`]);
    assert.deepEqual(porteurs(modele, 'focus'), [`table:${troisieme.id}`]);
    const memePlace = modeleDessin(etat, options(charge, { selection: { table: deuxieme.id, siege: 1 }, actif: { table: deuxieme.id, siege: 1 } }));
    assert.deepEqual(porteurs(memePlace, 'selection'), [`siege:${deuxieme.id}:1`]);
    assert.deepEqual(porteurs(memePlace, 'focus'), [`siege:${deuxieme.id}:1`]);
  });

  test('régime table : un siège, que nulle chaise ne dessine, marque sa table', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const cible = etat.tables[0];
    const modele = modeleDessin(etat, options(charge, { k: 0.2, selection: { table: cible.id, siege: 2 }, actif: { table: cible.id, siege: 3 } }));
    assert.equal(modele.tables[0].regime, 'table');
    assert.deepEqual(porteurs(modele, 'selection'), [`table:${cible.id}`]);
    assert.deepEqual(porteurs(modele, 'focus'), [`table:${cible.id}`]);
  });

  test('une place d’une table absente ne marque rien', () => {
    const charge = petite();
    const modele = modeleDessin(etatPlaces(charge, { tour: 1 }), options(charge, { selection: { table: 99, siege: 1 }, actif: { table: 99, siege: null } }));
    assert.deepEqual(porteurs(modele, 'selection'), []);
    assert.deepEqual(porteurs(modele, 'focus'), []);
  });
});

// --- Le détail d'une table en conflit --------------------------------------------

// L'organisation de chaque participant de la charge, par identifiant : celle
// que l'infobulle reçoit.
const organisationsDe = organisationDeCharge;

describe('detailConflits : le détail que rend le moteur, nommé (§ 7.1, § 7.3)', () => {
  // Ce que le détail d'une table doit tenir, jugé sans en refaire le calcul :
  // les règles dans l'ordre du moteur, une ligne par règle hors séparer, et,
  // pour séparer, des lignes d'organisations deux à deux distinctes dont la
  // suite des groupes, ligne après ligne, est une permutation stable des
  // paires du moteur, chaque paire sous l'organisation de ses deux personnes.
  function verifierDetail(detail, table, nomDe, organisationDe) {
    assert.equal(detail.numero, table.numero);
    assert.equal(detail.nombre, table.conflits.nombre);
    const regles = [...new Set(detail.lignes.map(({ regle }) => regle))];
    assert.deepEqual(regles, table.conflits.regles.map(({ regle }) => regle));
    for (const regle of table.conflits.regles) {
      const lignes = detail.lignes.filter((ligne) => ligne.regle === regle.regle);
      for (const ligne of lignes) assert.equal(ligne.cle, `plan.infobulle.${regle.regle}`);
      const groupes = (regle.paires ?? regle.personnes.map((id) => [id])).map((groupe) => groupe.map(nomDe));
      if (regle.regle !== 'separerOrganisations') {
        assert.deepEqual(lignes, [{ regle: regle.regle, cle: lignes[0].cle, organisation: null, groupes }]);
        continue;
      }
      const organisations = lignes.map(({ organisation }) => organisation);
      assert.deepEqual(organisations, [...new Set(regle.paires.map(([a]) => organisationDe(a)))]);
      for (const ligne of lignes) {
        const paires = regle.paires.filter(([a]) => organisationDe(a) === ligne.organisation);
        for (const [a, b] of paires) assert.equal(organisationDe(b), ligne.organisation);
        assert.deepEqual(ligne.groupes, paires.map((paire) => paire.map(nomDe)));
      }
      assert.equal(lignes.reduce((n, ligne) => n + ligne.groupes.length, 0), groupes.length);
    }
  }

  test('petite démonstration en conflit : chaque règle violée, ses paires ou ses personnes, dans l’ordre du moteur ; chaque paire réunie nomme son organisation', () => {
    const charge = avecPropositions(petite('petite-conflit'));
    const nomDe = nomsDe(charge);
    const organisationDe = organisationsDe(charge);
    let vus = 0;
    let separees = 0;
    for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
      for (const table of etatPlaces(charge, { tour, proposition: 1 }).tables) {
        const detail = detailConflits(table, nomDe, organisationDe);
        if (table.conflits.nombre === 0) {
          assert.equal(detail, null);
          continue;
        }
        vus += 1;
        verifierDetail(detail, table, nomDe, organisationDe);
        for (const ligne of detail.lignes) {
          assert.ok(typeof t(ligne.cle) === 'string' && t(ligne.cle).length > 0, ligne.cle);
          if (ligne.regle === 'separerOrganisations') {
            separees += 1;
            assert.equal(typeof ligne.organisation, 'string');
          }
        }
      }
    }
    assert.ok(vus > 0, 'au moins une table en conflit');
    assert.ok(separees > 0, 'au moins une paire réunie');
  });

  test('séparer les organisations : une ligne par organisation, ses paires dans l’ordre du moteur ; l’organisation telle que la liste la porte', () => {
    const noms = new Map([[1, 'Iris Ombrelle'], [2, 'Théo Pervenche'], [3, 'Ondine Lacasse'], [4, 'Grisaille'], [5, 'Basile Tourmaline']]);
    const organisations = new Map([[1, 'Club des Merles'], [2, 'cercle des Hérons '], [3, 'Club des Merles'], [4, 'cercle des Hérons '], [5, 'Club des Merles']]);
    const table = {
      numero: 7,
      conflits: {
        nombre: 7,
        regles: [
          { regle: 'conflitsOrganisation', paires: [[1, 4]] },
          { regle: 'separerOrganisations', paires: [[1, 3], [1, 5], [2, 4], [3, 5]] },
          { regle: 'nouveauxVoisins', paires: [[1, 2]] },
          { regle: 'nouvelleTable', personnes: [4] },
        ],
      },
    };
    const detail = detailConflits(table, (id) => noms.get(id), (id) => organisations.get(id));
    assert.deepEqual(detail, {
      numero: 7,
      libelle: null,
      nombre: 7,
      lignes: [
        // Le conflit d'organisation : une ligne, sa paire nommée, sans
        // organisation commune.
        { regle: 'conflitsOrganisation', cle: 'plan.infobulle.conflitsOrganisation', organisation: null, groupes: [['Iris Ombrelle', 'Grisaille']] },
        {
          regle: 'separerOrganisations',
          cle: 'plan.infobulle.separerOrganisations',
          organisation: 'Club des Merles',
          groupes: [['Iris Ombrelle', 'Ondine Lacasse'], ['Iris Ombrelle', 'Basile Tourmaline'], ['Ondine Lacasse', 'Basile Tourmaline']],
        },
        { regle: 'separerOrganisations', cle: 'plan.infobulle.separerOrganisations', organisation: 'cercle des Hérons ', groupes: [['Théo Pervenche', 'Grisaille']] },
        { regle: 'nouveauxVoisins', cle: 'plan.infobulle.nouveauxVoisins', organisation: null, groupes: [['Iris Ombrelle', 'Théo Pervenche']] },
        { regle: 'nouvelleTable', cle: 'plan.infobulle.nouvelleTable', organisation: null, groupes: [['Grisaille']] },
      ],
    });
  });

  test('le détail porte le libellé de la table, null quand elle n\u{2019}en a pas', () => {
    const table = { numero: 7, libelle: 'Coin des invités', conflits: { nombre: 1, regles: [{ regle: 'nouvelleTable', personnes: [4] }] } };
    const nomDe = () => 'Grisaille';
    assert.equal(detailConflits(table, nomDe, () => null).libelle, 'Coin des invités');
    assert.equal(detailConflits({ ...table, libelle: null }, nomDe, () => null).libelle, null);
  });

  test('conflits non évalués, ou nuls : null', () => {
    const charge = petite();
    const [table] = etatPlaces(charge, { tour: 1 }).tables;
    assert.equal(detailConflits({ ...table, conflits: null }, nomsDe(charge), organisationsDe(charge)), null);
    assert.equal(detailConflits({ ...table, conflits: { nombre: 0, regles: [] } }, nomsDe(charge), organisationsDe(charge)), null);
  });
});

// --- Les trois sortes de conflit : trames et légende ----------------------------

describe('les trames de conflit : une par règle violée, sa marque et son jeton (§ 7.5, § 12.7)', () => {
  const PAR_REGLE = new Map(CONFLITS.map((c) => [c.regle, c]));

  test('petite démonstration en conflit, chaque tour : les trames d’une table sont les règles qu’elle viole, dans l’ordre du moteur ; aucune pour une table saine', () => {
    const charge = avecPropositions(petite('petite-conflit'));
    const sortes = new Set();
    let multiples = 0;
    let saines = 0;
    for (let tour = 1; tour <= charge.evenement.tours; tour += 1) {
      const etat = etatPlaces(charge, { tour, proposition: 1 });
      const modele = modeleDessin(etat, options(charge));
      assert.equal(modele.tables.length, etat.tables.length);
      etat.tables.forEach((table, i) => {
        const attendu = table.conflits.regles.map(({ regle }) => ({ ...PAR_REGLE.get(regle) }));
        assert.deepEqual(modele.tables[i].trames, attendu, `tour ${tour}, table ${table.id}`);
        for (const { regle } of attendu) sortes.add(regle);
        if (attendu.length > 1) multiples += 1;
        if (attendu.length === 0) saines += 1;
      });
    }
    assert.deepEqual([...sortes].sort(), ['nouveauxVoisins', 'nouvelleTable', 'separerOrganisations']);
    assert.ok(multiples > 0, 'une table au moins viole plusieurs règles');
    assert.ok(saines > 0, 'une table au moins est saine');
  });

  test('conflits non évalués : aucune trame', () => {
    const charge = petite();
    const etat = etatPlaces(charge, { tour: 1 });
    const modele = modeleDessin({ ...etat, tables: etat.tables.map((table) => ({ ...table, conflits: null })) }, options(charge));
    assert.ok(modele.tables.length > 0);
    assert.ok(modele.tables.every(({ trames, conflit, pastille }) => trames.length === 0 && !conflit && pastille === 0));
  });
});

describe('legendeConflits : les règles actives, leur marque et leur libellé (§ 7.5)', () => {
  const reglages = (actives) => ({
    separerOrganisations: actives.includes('separerOrganisations'),
    nouveauxVoisins: actives.includes('nouveauxVoisins'),
    nouvelleTable: actives.includes('nouvelleTable'),
    varierOrganisations: true,
    attribuerSieges: false,
  });
  const entree = (regle) => {
    const { marque, jeton, forme } = CONFLITS.find((c) => c.regle === regle);
    return { regle, marque, jeton, forme, cle: `plan.legende.${regle}`, cleForme: `plan.legende.forme.${forme}` };
  };

  test('les trois règles de case actives, dans l’ordre du moteur', () => {
    assert.deepEqual(legendeConflits(reglages(['nouvelleTable', 'separerOrganisations', 'nouveauxVoisins'])), [
      entree('separerOrganisations'),
      entree('nouveauxVoisins'),
      entree('nouvelleTable'),
    ]);
  });

  test('une règle inactive n’y paraît pas ; aucune règle active, une légende vide ; varier les organisations ne se localise pas', () => {
    assert.deepEqual(legendeConflits(reglages(['separerOrganisations', 'nouvelleTable'])), [entree('separerOrganisations'), entree('nouvelleTable')]);
    assert.deepEqual(legendeConflits(reglages(['nouveauxVoisins'])), [entree('nouveauxVoisins')]);
    assert.deepEqual(legendeConflits(reglages([])), []);
  });

  test("le conflit d'organisation, sans case, paraît en tête quand l'état de son critère le dit coché et avec un objet", () => {
    const etat = (sansObjet) => [
      { nom: 'separerOrganisations', coche: true, sansObjet: false },
      { nom: 'conflitsOrganisation', coche: true, sansObjet },
    ];
    assert.deepEqual(legendeConflits(reglages(['nouvelleTable']), etat(false)), [entree('conflitsOrganisation'), entree('nouvelleTable')]);
    assert.deepEqual(legendeConflits(reglages(['nouvelleTable']), etat(true)), [entree('nouvelleTable')]);
    // Sans état des critères — aucune table d'évaluation —, il n'y paraît
    // pas ; une clé du même nom dans les réglages n'y change rien.
    assert.deepEqual(legendeConflits({ ...reglages([]), conflitsOrganisation: true }), []);
  });

  test('chaque libellé de la légende existe', () => {
    for (const { regle, forme } of CONFLITS) {
      assert.ok(t(`plan.legende.${regle}`).length > 0, regle);
      assert.ok(t(`plan.legende.forme.${forme}`).length > 0, forme);
    }
    for (const cle of ['plan.legende.titre', 'plan.legende.ouvrir', 'plan.legende.pastille', 'plan.legende.pastilleExemple', 'plan.legende.aucune']) {
      assert.ok(t(cle).length > 0, cle);
    }
  });
});

// --- Le texte entier d'une ligne, et les actions des panneaux --------------------

describe('texteLigne : la ligne d’une chaise en un texte, nom accessible du siège', () => {
  const nomDe = (id) => ({ 1: 'Iris Ombrelle', 2: 'Théo Pervenche' })[id];
  const chaise = (autres) => ({ siege: 3, occupant: null, reservation: null, titre: null, ...autres });

  test('les parties de textesLigne, bout à bout', () => {
    const cas = [
      [chaise({}), '3. (libre)'],
      [chaise({ occupant: 1 }), '3. Iris Ombrelle'],
      [
        chaise({ occupant: 1, reservation: { participant: 1, portee: 'tous', tour: null }, titre: { libelle: 'animateur', pourvu: true } }),
        '3. (réservée, tous les tours) Iris Ombrelle \u{2014} animateur',
      ],
      [chaise({ titre: { libelle: 'hôte', pourvu: false } }), '3. (libre) \u{2014} titre hôte non pourvu'],
      [chaise({ occupant: 2, reservation: { participant: 1, portee: 'tour', tour: 2 } }), '3. (réservée à Iris Ombrelle, tour 2) Théo Pervenche'],
    ];
    for (const [entree, attendu] of cas) assert.equal(texteLigne(ligneListe(entree, nomDe), t), attendu);
  });
});

describe('actionsPlace : ce qu’offre le panneau d’une place (§ 7.1, § 2.1 étape 6)', () => {
  const libre = { siege: 1, occupant: null, reservation: null, titre: null };
  const tenue = { siege: 2, occupant: 1, reservation: { participant: 1, portee: 'tous', tour: null }, titre: { libelle: 'hôte', pourvu: true } };
  const reservation = { genre: 'reservation', participant: 1, depuis: { table: 1, siege: 2 }, de: { table: 1, portee: 'tous', tour: null } };

  test('une place libre : assigner, réserver, donner un titre, désigner — exactement', () => {
    assert.deepEqual(actionsPlace(libre, null), ['assigner', 'reserver', 'donnerTitre', 'designer']);
    assert.deepEqual(actionsPlace(libre, { genre: 'personne', participant: 2, depuis: null }), ['assigner', 'reserver', 'donnerTitre', 'designer']);
  });

  test('une place réservée et titrée : retirer la réservation, retirer le titre ; une personne choisie y ajoute assigner, que la pose refusera', () => {
    assert.deepEqual(actionsPlace(tenue, null), ['retirerReservation', 'retirerTitre']);
    assert.deepEqual(actionsPlace(tenue, reservation), ['retirerReservation', 'retirerTitre', 'deplacerReservationIci']);
    assert.deepEqual(actionsPlace(tenue, { genre: 'personne', participant: 2, depuis: null }), ['assigner', 'retirerReservation', 'retirerTitre']);
  });

  test('une place titrée, non tenue : assigner, réserver, désigner, retirer le titre', () => {
    assert.deepEqual(actionsPlace({ ...libre, titre: { libelle: 'hôte', pourvu: false } }, null), ['assigner', 'reserver', 'designer', 'retirerTitre']);
  });

  test('une réservation choisie ajoute « Déplacer la réservation ici »', () => {
    assert.deepEqual(actionsPlace(libre, reservation), ['assigner', 'reserver', 'donnerTitre', 'designer', 'deplacerReservationIci']);
  });
});

describe('actionsPersonne : le menu d’une personne (§ 7.1)', () => {
  const assise = { siege: 2, occupant: 4, reservation: null, titre: null };
  const retrait = { commande: 'retirerDuTour', arguments: { tour: 1, participant: 4 } };

  test('assise, non réservée : déplacer, échanger, retirer du tour, réserver ici, exclure, mettre en évidence, ouvrir la fiche', () => {
    assert.deepEqual(actionsPersonne({ exclu: false, chaise: assise, retrait, enEvidence: false }), [
      'deplacer',
      'echanger',
      'retirerDuTour',
      'reserverIci',
      'exclure',
      'mettreEnEvidence',
      'ouvrirFiche',
    ]);
  });

  test('assise sur sa réservation : déplacer sa réservation, plus de « réserver ici » ; sans retrait possible, pas de « retirer du tour »', () => {
    const tenue = { ...assise, reservation: { participant: 4, portee: 'tous', tour: null } };
    assert.deepEqual(actionsPersonne({ exclu: false, chaise: tenue, retrait: null, enEvidence: false }), [
      'deplacer',
      'echanger',
      'deplacerReservation',
      'exclure',
      'mettreEnEvidence',
      'ouvrirFiche',
    ]);
  });

  test('hors du dessin — réserve, exclue — : déplacer, puis exclure ou réintégrer, la mise en évidence et la fiche', () => {
    assert.deepEqual(actionsPersonne({ exclu: false, chaise: null, retrait: null, enEvidence: false }), ['deplacer', 'exclure', 'mettreEnEvidence', 'ouvrirFiche']);
    assert.deepEqual(actionsPersonne({ exclu: true, chaise: null, retrait: null, enEvidence: false }), ['deplacer', 'reintegrer', 'mettreEnEvidence', 'ouvrirFiche']);
  });

  test('mise en évidence (§ 8.4) : la personne mise en évidence offre de l\u{2019}ôter, à la même place, et rien d\u{2019}autre ne change', () => {
    for (const [chaise, sonRetrait] of [[assise, retrait], [null, null]]) {
      const sans = actionsPersonne({ exclu: false, chaise, retrait: sonRetrait, enEvidence: false });
      const avec = actionsPersonne({ exclu: false, chaise, retrait: sonRetrait, enEvidence: true });
      assert.equal(sans.filter((action) => action === 'mettreEnEvidence').length, 1);
      assert.deepEqual(avec, sans.map((action) => (action === 'mettreEnEvidence' ? 'oterEvidence' : action)));
    }
  });
});

describe('executerSurPlace : la commande d’un panneau, son refus posé sur la place (§ 5.9)', () => {
  // Une séance et un état de navigation d'épreuve, qui relèvent leurs appels.
  function dependances(executer) {
    const appels = [];
    return {
      appels,
      seance: { executer: async (nom, args) => (appels.push(['executer', nom, args]), executer(nom, args)) },
      ui: {
        choisir: (choix) => appels.push(['choisir', choix]),
        poserSurPlace: (pose) => appels.push(['poserSurPlace', pose]),
      },
    };
  }
  const refus = (code, details = {}) => Object.assign(new Error(code), { code, details });
  const place = { table: 2, siege: 3 };

  test('réussie : rend le rendu de la séance, oublie le choix en attente et retire la pose', async () => {
    const d = dependances(() => ({ libelle: 'ok', avertissements: [] }));
    assert.deepEqual(await executerSurPlace(d, place, 'reserver', { participant: 1 }), { libelle: 'ok', avertissements: [] });
    assert.deepEqual(d.appels, [['executer', 'reserver', { participant: 1 }], ['choisir', null], ['poserSurPlace', null]]);
  });

  test('refusée : le refus, code et détails, posé sur la place ; rien d’autre ; null', async () => {
    const d = dependances(() => {
      throw refus('PLACE_RESERVEE', { table: 2, siege: 3 });
    });
    assert.equal(await executerSurPlace(d, place, 'reserver', {}), null);
    assert.deepEqual(d.appels.slice(1), [
      ['poserSurPlace', { place, refus: { code: 'PLACE_RESERVEE', details: { table: 2, siege: 3 } }, avertissements: [] }],
    ]);
  });

  test('un code local, une place absente, ou une erreur sans code remontent à l’appelant', async () => {
    for (const [lieu, erreur, options] of [
      [place, refus('LIBELLE_VIDE'), { locaux: ['LIBELLE_VIDE'] }],
      [null, refus('SANS_EFFET'), {}],
      [place, new TypeError('défaut'), {}],
    ]) {
      const d = dependances(() => {
        throw erreur;
      });
      await assert.rejects(executerSurPlace(d, lieu, 'poserTitre', {}, options), (recue) => recue === erreur);
      assert.deepEqual(d.appels.map(([nom]) => nom), ['executer']);
    }
  });
});

describe('les clés que les panneaux composent existent (§ 14.6)', () => {
  test('plan.action.<action>, plan.menu.<action>, plan.infobulle.<règle> : chaque valeur possible a sa clé', () => {
    const tenue = { siege: 1, occupant: 1, reservation: { participant: 1, portee: 'tous', tour: null }, titre: { libelle: 'hôte', pourvu: true } };
    const libre = { siege: 1, occupant: null, reservation: null, titre: null };
    const reservation = { genre: 'reservation', participant: 1, depuis: null, de: { table: 1, portee: 'tous', tour: null } };
    const actions = new Set([...actionsPlace(libre, reservation), ...actionsPlace(tenue, { genre: 'personne', participant: 2, depuis: null })]);
    const menu = new Set([
      ...actionsPersonne({ exclu: false, chaise: { ...libre, occupant: 4 }, retrait: {}, enEvidence: false }),
      ...actionsPersonne({ exclu: true, chaise: tenue, retrait: {}, enEvidence: true }),
    ]);
    assert.equal(actions.size, 7);
    assert.equal(menu.size, 10);
    for (const action of actions) assert.equal(typeof t(`plan.action.${action}`), 'string', action);
    for (const action of menu) assert.equal(typeof t(`plan.menu.${action}`), 'string', action);
    for (const regle of ['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable']) assert.equal(typeof t(`plan.infobulle.${regle}`), 'string');
    assert.equal(typeof t('plan.infobulle.finOrganisation'), 'string');
  });

  test('plan.infobulle.<règle> : chaque ligne de l’infobulle s’ouvre sur une capitale, la même casse pour toutes', () => {
    for (const regle of ['separerOrganisations', 'nouveauxVoisins', 'nouvelleTable']) {
      assert.match(t(`plan.infobulle.${regle}`), /^\p{Lu}/u, regle);
    }
  });
});

describe('modeleDessin, option impression : le plan imprimé (§ 11.7, § 13.5)', () => {
  // La grande démonstration au tour 1, sa proposition montrée : des tables
  // de toutes tailles, dont le régime à l'écran dépend de k.
  const grande = () => analyser(texteLivre('grande')).charge;

  test('régime des sièges pour chaque table, quel que soit k ; chaque chaise dessinée, de 1 à la capacité', () => {
    const charge = grande();
    const etat = etatPlaces(charge, { tour: 1 });
    // À l'écran, au plus petit zoom, aucune chaise ne se dessine.
    const ecran = modeleDessin(etat, options(charge, { k: 0.01 }));
    assert.ok(ecran.tables.every(({ regime }) => regime === 'table'));
    for (const k of [undefined, 0.01, 5]) {
      const modele = modeleDessin(etat, options(charge, { k, impression: true }));
      assert.equal(modele.tables.length, etat.tables.length);
      for (const [rang, table] of modele.tables.entries()) {
        assert.equal(table.regime, 'sieges', `table ${table.id}, k = ${String(k)}`);
        assert.deepEqual(
          table.chaises.map(({ siege }) => siege),
          etat.tables[rang].chaises.map(({ siege }) => siege),
        );
      }
    }
  });

  test('ni sélection, ni focus, ni mise en évidence : les options de l’écran sont sans effet', () => {
    const charge = avecPropositions(petite());
    const etat = etatPlaces(charge, { tour: 1, proposition: charge.propositions[0].id });
    const [premiere, deuxieme] = etat.tables;
    const occupant = premiere.chaises.find((chaise) => chaise.occupant !== null).occupant;
    const ecran = {
      selection: { table: premiere.id, siege: 1 },
      actif: { table: deuxieme.id, siege: null },
      miseEnEvidence: occupant,
      poignee: { table: premiere.id, places: 1 },
    };
    // À l'écran, ces options marquent leur porteur.
    const marque = modeleDessin(etat, options(charge, { k: 5, ...ecran }));
    assert.ok(marque.tables.some((table) => table.focus || table.chaises.some((chaise) => chaise.selection || chaise.miseEnEvidence)));
    const modele = modeleDessin(etat, options(charge, { impression: true, ...ecran }));
    for (const table of modele.tables) {
      assert.equal(table.selection, false);
      assert.equal(table.focus, false);
      for (const chaise of table.chaises) {
        assert.deepEqual([chaise.selection, chaise.focus, chaise.miseEnEvidence], [false, false, false], `table ${table.id}`);
      }
    }
    // La poignée ne retire aucune chaise au papier : la table tenue garde sa capacité.
    assert.deepEqual(
      modele.tables[0].chaises.map(({ siege }) => siege),
      Array.from({ length: premiere.capacite }, (_, rang) => rang + 1),
    );
  });

  test('les listes se rendent quand elles sont demandées, sans égard à K_LISTES', () => {
    const charge = avecPropositions(petite());
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(modeleDessin(etat, options(charge, { k: K_LISTES - 0.01, impression: true })).listesRendues, true);
    assert.equal(modeleDessin(etat, options(charge, { impression: true })).listesRendues, true);
    assert.equal(modeleDessin(etat, options(charge, { impression: true, listes: false })).listesRendues, false);
  });

  test('le modèle se dit imprimé, et l’écran ne l’est pas : le dessin y lit l’absence de poignée, d’identifiant et de cible', () => {
    const charge = avecPropositions(petite());
    const etat = etatPlaces(charge, { tour: 1 });
    assert.equal(modeleDessin(etat, options(charge, { impression: true })).impression, true);
    assert.equal(modeleDessin(etat, options(charge)).impression, false);
  });

  test('les numéros, les conflits, les pastilles, les marques et les lignes sont ceux de l’écran', () => {
    const charge = avecPropositions(petite('petite-conflit'));
    const etat = etatPlaces(charge, { tour: 1, proposition: charge.propositions[0].id });
    const ecran = modeleDessin(etat, options(charge, { k: 5 }));
    const imprime = modeleDessin(etat, options(charge, { impression: true }));
    assert.ok(imprime.tables.some(({ conflit }) => conflit), 'une table en conflit au moins');
    assert.equal(imprime.signalerConflits, ecran.signalerConflits);
    for (const [rang, table] of imprime.tables.entries()) {
      const voisine = ecran.tables[rang];
      assert.deepEqual(
        [table.numero, table.conflit, table.pastille, table.trames, table.lignes, table.enTete],
        [voisine.numero, voisine.conflit, voisine.pastille, voisine.trames, voisine.lignes, voisine.enTete],
      );
      assert.deepEqual(
        table.chaises.map(({ remplissage, marques }) => [remplissage, marques]),
        voisine.chaises.map(({ remplissage, marques }) => [remplissage, marques]),
      );
    }
  });
});

describe('libelleDessin : les lignes du libellé d\u{2019}une table, repliées dans son plateau (§ 7.4, § 7.7)', () => {
  // Une mesure par glyphe, en cm de dessin au corps des listes : 9 cm le
  // glyphe, la marque comprise.
  const mesurer = (chaine) => [...chaine].length * 9;
  const marque = '\u{2026}';

  test('le libellé se replie dans les lignes de lignesLibelle, chacune à son ancre ; son socle couvre son encre et son halo', () => {
    for (const forme of ['ronde', 'carree']) {
      for (const places of [2, 8]) {
        const geometrie = geometrieTable({ id: 1, numero: 4, forme, position: { x: 30, y: -15 } }, places);
        const texte = 'Table d\u{2019}honneur des invités venus de loin';
        const { corps, lignes } = libelleDessin(geometrie, texte, { mesurer, marque });
        const emplacements = lignesLibelle(geometrie).lignes;
        assert.equal(corps, TAILLE_TEXTE_LISTE_CM);
        const attendues = replier(texte, emplacements.map(({ largeur }) => largeur), mesurer, marque);
        assert.deepEqual(lignes.map(({ texte: ligne }) => ligne), attendues, `${forme} de ${places}`);
        lignes.forEach((ligne, rang) => {
          const { x, y, largeur } = emplacements[rang];
          assert.deepEqual([ligne.x, ligne.y], [x, y]);
          assert.ok(mesurer(ligne.texte) <= largeur);
          const halo = HALO_NUMERO * corps;
          assert.deepEqual(ligne.socle, {
            x: x - (mesurer(ligne.texte) + halo) / 2,
            y: y - ENCRE_HAUT_LIGNE * corps,
            width: mesurer(ligne.texte) + halo,
            height: (ENCRE_HAUT_LIGNE + ENCRE_BAS_LIGNE) * corps,
          });
        });
      }
    }
  });

  test('la plus petite ronde abrège un libellé long sur sa seule ligne ; une grande ronde le replie sur plusieurs', () => {
    const petite = geometrieTable({ id: 1, numero: 4, forme: 'ronde', position: { x: 0, y: 0 } }, 2);
    const court = libelleDessin(petite, 'Coin des invités', { mesurer, marque }).lignes;
    assert.equal(court.length, 1);
    assert.ok(court[0].texte.endsWith(marque), court[0].texte);
    const grande = geometrieTable({ id: 1, numero: 4, forme: 'ronde', position: { x: 0, y: 0 } }, 8);
    const replie = libelleDessin(grande, 'Coin des invités venus de loin', { mesurer, marque }).lignes;
    assert.ok(replie.length >= 2, JSON.stringify(replie));
    assert.ok(!replie.at(-1).texte.endsWith(marque), JSON.stringify(replie));
  });
});
