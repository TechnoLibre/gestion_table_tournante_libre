// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

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
import { geometrieTable } from '../../geometrie/tables.js';
import { indexerPlan } from '../../moteur/configuration.js';
import { conflitsParTable } from '../../moteur/conflits.js';
import { diagnostiquer } from '../../moteur/diagnostic.js';
import { rechercher } from '../../moteur/recherche.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { planDepuisFichier, versFichier } from '../../stockage/placements.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  LARGEUR_ECHELLE_PX,
  ajusterLigne,
  formesTable,
  libelleLongueur,
  ligneListe,
  modeleDessin,
  ordonneesLignes,
  partiesLigne,
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

const personne = (id, nom, prenom, appartenance) => ({
  id,
  nom,
  prenom,
  appartenance,
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

/** Douze personnes en deux appartenances de six — une seule avec uneSeule —,
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

// nomDe sur les participants de la charge : prénom et nom, ou le nom seul.
const nomsDe = (charge) => {
  const noms = new Map(charge.participants.map(({ id, nom, prenom }) => [id, prenom === null ? nom : `${prenom} ${nom}`]));
  return (id) => noms.get(id);
};

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

  test('deux appartenances de six : la phrase, collisionPartout, puis un plancher par groupe, chiffres du moteur', () => {
    const charge = toutesEnConflit();
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge));
    assert.equal(diagnostic.collisionPartout, true);
    assert.equal(diagnostic.uneSeuleAppartenance, false);
    assert.equal(diagnostic.collisions.length, 2);
    const { bandeau } = modeleDessin(lire(charge), options(charge, { diagnostic }));
    assert.deepEqual(bandeau, [
      { cle: 'plan.bandeau.toutesEnConflit', details: {} },
      { cle: 'plan.bandeau.collisionPartout', details: {} },
      ...diagnostic.collisions.map(({ groupe, effectif, plancherCumulees }) => ({
        cle: 'plan.bandeau.plancherGroupe',
        details: { groupe, effectif, plancherCumulees },
      })),
    ]);
    assert.deepEqual(
      bandeau.slice(2).map(({ details }) => details.effectif),
      [6, 6],
    );
    for (const { cle, details } of bandeau) assert.equal(typeof t(cle, details), 'string');
  });

  test('une seule appartenance : l\u{2019}entrée uneSeuleAppartenance, sans plancher par groupe', () => {
    const charge = toutesEnConflit({ uneSeule: true });
    const diagnostic = diagnostiquer(configurationDepuisCharge(charge));
    assert.equal(diagnostic.uneSeuleAppartenance, true);
    const { bandeau, signalerConflits } = modeleDessin(lire(charge), options(charge, { diagnostic }));
    assert.equal(signalerConflits, false);
    assert.deepEqual(
      bandeau.map(({ cle }) => cle),
      [
        'plan.bandeau.toutesEnConflit',
        ...(diagnostic.collisionPartout ? ['plan.bandeau.collisionPartout'] : []),
        'plan.bandeau.uneSeuleAppartenance',
      ],
    );
  });

  test('un diagnostic sans plancher : la phrase, puis l\u{2019}entrée qui le dit', () => {
    const charge = toutesEnConflit();
    const diagnostic = { collisions: [], uneSeuleAppartenance: false, collisionPartout: false };
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
    { numero: 1, etat: { cle: 'plan.ligne.reserveeTous', details: {} }, titulaire: null, nom: 'Iris Ombrelle', titre: animateur(true) },
    '1. (réservée, tous les tours) Iris Ombrelle \u{2014} animateur',
  ],
  [
    chaise(2, { occupant: 2, reservation: { participant: 2, portee: 'tour', tour: 2 } }),
    { numero: 2, etat: { cle: 'plan.ligne.reserveeTour', details: { tour: 2 } }, titulaire: null, nom: 'Théo Pervenche', titre: null },
    '2. (réservée, tour 2) Théo Pervenche',
  ],
  [chaise(3, { occupant: 3 }), { numero: 3, etat: null, titulaire: null, nom: 'Ondine Lacasse', titre: null }, '3. Ondine Lacasse'],
  [
    chaise(4, { occupant: 4, titre: animateur(false) }),
    { numero: 4, etat: null, titulaire: null, nom: 'Grisaille', titre: animateur(false) },
    '4. Grisaille \u{2014} titre animateur non pourvu',
  ],
  [chaise(5), { numero: 5, etat: { cle: 'plan.ligne.libre', details: {} }, titulaire: null, nom: null, titre: null }, '5. (libre)'],
  [
    chaise(6, { titre: animateur(false) }),
    { numero: 6, etat: { cle: 'plan.ligne.libre', details: {} }, titulaire: null, nom: null, titre: animateur(false) },
    '6. (libre) \u{2014} titre animateur non pourvu',
  ],
];

// Le texte entier d'une ligne : ses parties dans l'ordre, les absentes omises.
const joindre = ({ tete, titulaire, suite, nom, avantTitre, titre, apresTitre }) =>
  [tete, titulaire, suite, nom, avantTitre, titre, apresTitre].filter((partie) => partie !== null).join('');

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
  droit(`${ligne.tete}${ligne.titulaire ?? ''}${ligne.suite ?? ''}${ligne.nom ?? ''}${ligne.avantTitre ?? ''}`) +
  italique(ligne.titre ?? '') +
  droit(ligne.apresTitre ?? '');

// --- Une place réservée qu'occupe une autre personne -----------------------------------

describe('ligneListe : la réservation d\u{2019}une autre personne que l\u{2019}occupant (§ 7.6)', () => {
  test('petite démonstration, une réservation posée après la proposition : la ligne nomme sa titulaire, puis l\u{2019}occupant', () => {
    const charge = petite();
    const configuration = configurationDepuisCharge(charge);
    const [proposition] = rechercher(configuration, { graine: 7, nombre: 1, arret: 1000 });
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
      etat: { cle: 'plan.ligne.reserveeA', details: { portee: 'tous', tour: null } },
      titulaire,
      nom: occupant,
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

  test('réservée au seul tour 3 pour une autre personne, la place vide : « 2. (réservée à …, tour 3) »', () => {
    const ligne = ligneListe(chaise(2, { reservation: { participant: 1, portee: 'tour', tour: 3 } }), nomDeLigne);
    assert.deepEqual(ligne, {
      numero: 2,
      etat: { cle: 'plan.ligne.reserveeA', details: { portee: 'tour', tour: 3 } },
      titulaire: 'Iris Ombrelle',
      nom: null,
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

  test('la pastille au centre du plateau ; la marque de gel dans le plateau, au-dessus de la pastille', () => {
    for (const places of [2, 8, 16]) {
      const geometrie = geometrieTable({ id: 1, numero: 1, forme: 'ronde', position: { x: 10, y: 20 } }, places);
      const { pastille, gel } = formesTable(geometrie);
      assert.deepEqual(pastille, { x: 10, y: 20 });
      assert.equal(gel.x, 10);
      assert.ok(gel.y < 20 && gel.y > 20 - geometrie.demiTaille, `${places} places : ${gel.y}`);
    }
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
