// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle de l'en-tête chiffré de la page de qualité (§ 12.2,
// B11, D29, D34, D48, D52) : une tuile par colonne de mesure du tableau des
// propositions, dans son ordre et sous ses groupes, la cellule même du
// tableau quand la colonne y est ; une tuile sans colonne lit la même
// mesure et dit qu'elle ne classe pas ; un critère sans objet n'a pas de
// tuile ; chaque borne est celle d'une personne nommée, lue dans le détail ;
// trois tuiles seulement portent un pourcentage, suivi du compte du pire.
// Les charges s'écrivent ici ou partent des démonstrations livrées ; leurs
// propositions s'enregistrent par la commande. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { detaillerQualite, evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { COLONNES, GROUPES_COLONNES, explicationDeColonne, lireColonne, tableau, texteCellule } from '../propositions/modele.js';
import { TUILES_A_POURCENTAGE, enteteDe } from './entete.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const outils = { t, format };
const V1 = VERSION.affichee;

// Six personnes inventées, deux appartenances, deux tables de trois places,
// trois tours ; les finance premières portent « finance », que la première
// table attend pour la soirée quand objectifs est vrai ; reservees : les
// deux dernières réservées ensemble à la seconde table pour la soirée.
function chargeSix({ objectifs = false, appartenances = true, reglages = {}, finance = 3, reservees = false } = {}) {
  const charge = creerCharge({ id: 'evt-entete', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 3 });
  const noms = [
    ['Ombrelle', 'Iris', 'Coopérative Aubier'],
    ['Pervenche', 'Théo', 'Coopérative Aubier'],
    ['Lacasse', 'Ondine', 'Atelier Ressac'],
    ['Tourteau', 'Basile', 'Atelier Ressac'],
    ['Quenouille', 'Maëlle', null],
    ['Varech', 'Sidonie', null],
  ];
  charge.participants = noms.map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: appartenances ? appartenance : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(objectifs && rang < finance ? { etiquettes: ['finance'] } : {}),
  }));
  if (reservees) charge.reservations = [5, 6].map((participant) => ({ participant, table: 2, siege: null, portee: 'tous', tour: null }));
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  if (objectifs) charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  Object.assign(charge.reglages, reglages);
  return charge;
}

// La charge, une génération de plus, enregistrée par la commande.
function generee(charge, reglages = { graine: 3, nombre: 2, arret: 200 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// La vue d'une proposition de la charge, comme la section la passe : son
// détail, sa ligne d'évaluation et la table d'évaluation.
function vueDe(charge, id = charge.propositions[0].id) {
  const table = evaluer(charge);
  const ligne = table.propositions.find((candidate) => candidate.id === id);
  return { detail: detaillerQualite(charge, id), ligne, table };
}

const tuiles = (entete) => entete.groupes.flatMap(({ tuiles: deGroupe }) => deGroupe);
const tuile = (entete, nom) => {
  const trouvee = tuiles(entete).find((candidate) => candidate.nom === nom);
  assert.ok(trouvee !== undefined, `tuile ${nom} absente`);
  return trouvee;
};
const nomDe = (detail, id) => detail.personnes.find((personne) => personne.id === id).nom;
const valeur = (pourcent) => t('qualite.pourcentage.valeur', { pourcent });

// Les tuiles des objectifs et des animateurs.
const SIXIEME = ['jamaisServies', 'horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif', 'animateursRencontres', 'animateursNonRencontres'];

describe('enteteDe : une tuile par colonne de mesure (§ 12.2, D48)', () => {
  test('chaque tuile qui a sa colonne porte la cellule du tableau, son libellé et son explication, dans l’ordre et sous les groupes de COLONNES', () => {
    const charge = generee(chargeSix({ objectifs: true }));
    const vue = vueDe(charge);
    const entete = enteteDe(vue, outils);
    const lignes = tableau(vue.table).lignes;
    const ligneDuTableau = lignes.find(({ id }) => id === vue.ligne.id);
    const portees = ligneDuTableau.cellules.filter(({ colonne }) => colonne !== 'certificat');
    // Les tuiles des colonnes portées, dans l'ordre du tableau.
    const classees = tuiles(entete).filter(({ classe }) => classe);
    assert.deepEqual(classees.map(({ nom }) => nom), portees.map(({ colonne }) => colonne));
    for (const cellule of portees) {
      const tuileDe = tuile(entete, cellule.colonne);
      assert.equal(tuileDe.texte, texteCellule(cellule, outils), cellule.colonne);
      assert.equal(tuileDe.libelle, t(COLONNES.find(({ nom }) => nom === cellule.colonne).cle), cellule.colonne);
      assert.equal(tuileDe.explication, explicationDeColonne(cellule.colonne), cellule.colonne);
    }
    // Les groupes : ceux de COLONNES, dans leur ordre, chacun de ses tuiles.
    const attendus = GROUPES_COLONNES.filter(({ cle }) => cle !== null);
    assert.deepEqual(entete.groupes.map(({ cle }) => cle), attendus.map(({ cle }) => cle));
    for (const groupe of entete.groupes) {
      assert.equal(groupe.libelle, t(groupe.cle));
      const colonnes = attendus.find(({ cle }) => cle === groupe.cle).colonnes;
      assert.ok(groupe.tuiles.every(({ nom }) => colonnes.includes(nom)), groupe.cle);
    }
    assert.equal(entete.certificat, texteCellule(lireColonne(vue.ligne, 'certificat'), outils));
    assert.equal(entete.population, t('qualite.tuile.population', { mesuree: 6, exclue: 0 }));
  });

  test('un critère décoché : ses tuiles lisent la même mesure sous leur propre libellé, et ne classent pas ; sans objet, aucune tuile', () => {
    const decoche = vueDe(generee(chargeSix({ objectifs: true, reglages: { respecterObjectifs: false, modeObjectifs: 'chacun' } })));
    assert.ok(!tableau(decoche.table).colonnes.some(({ nom }) => SIXIEME.includes(nom)));
    const entete = enteteDe(decoche, outils);
    const objectifs = ['jamaisServies', 'toursHorsObjectif', 'toursSelonObjectif', 'horsObjectifMax'];
    for (const nom of objectifs) {
      const tuileDe = tuile(entete, nom);
      assert.equal(tuileDe.classe, false, nom);
      assert.equal(tuileDe.libelle, t(`qualite.tuile.${nom}`), nom);
      assert.equal(tuileDe.texte, texteCellule(lireColonne(decoche.ligne, nom), outils), nom);
    }
    assert.equal(tuile(entete, 'jamaisServies').texte, format.nombre(decoche.ligne.mesures.objectifs.jamaisServies));
    // Les tuiles du groupe suivent l'ordre de COLONNES.
    const groupe = entete.groupes.find(({ cle }) => cle === 'propositions.groupe.objectifs');
    assert.deepEqual(groupe.tuiles.map(({ nom }) => nom), ['jamaisServies', 'horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif']);
    assert.ok(tuiles(entete).filter(({ classe }) => !classe).every(({ nom }) => objectifs.includes(nom)));

    // Sans objet : ni objectif ni animateur, aucune tuile du sixième groupe.
    const sansObjet = enteteDe(vueDe(generee(chargeSix())), outils);
    assert.ok(!tuiles(sansObjet).some(({ nom }) => SIXIEME.includes(nom)));
    assert.ok(!sansObjet.groupes.some(({ cle }) => cle === 'propositions.groupe.objectifs'));
  });

  test('sous « le plus de places servies », les personnes jamais servies et le plus de tours hors objectif d’une personne ne classent pas ; les deux autres classent', () => {
    const entete = enteteDe(vueDe(generee(chargeSix({ objectifs: true }))), outils);
    assert.deepEqual(
      ['jamaisServies', 'horsObjectifMax', 'toursHorsObjectif', 'toursSelonObjectif'].map((nom) => [nom, tuile(entete, nom).classe]),
      [['jamaisServies', false], ['horsObjectifMax', false], ['toursHorsObjectif', true], ['toursSelonObjectif', true]],
    );
    assert.equal(tuile(entete, 'jamaisServies').neClassePas, t('qualite.tuile.neClassePas'));
    assert.equal(tuile(entete, 'toursHorsObjectif').neClassePas, null);
  });

  test('le taux de diversité au centième, comme au tableau ; une population vide et un a priori inconnu s’écrivent comme au tableau', () => {
    const charge = generee(chargeSix());
    const entete = enteteDe(vueDe(charge), outils);
    const { ligne } = vueDe(charge);
    assert.equal(tuile(entete, 'diversite').texte, format.nombre(ligne.mesures.aggDiversite.tous.min, { decimales: 2 }));
    // Aucun ancré : « — ».
    assert.equal(tuile(entete, 'rencontresAncres').texte, '\u{2014}');
    // Sans a priori, les deux écarts qui en dépendent écrivent « inconnu »,
    // jamais « — » ni un nombre, comme leurs colonnes au tableau.
    const sansAPriori = { ...vueDe(charge), table: evaluer(charge, { plafondsAPriori: null }) };
    sansAPriori.ligne = sansAPriori.table.propositions.find(({ id }) => id === charge.propositions[0].id);
    assert.equal(sansAPriori.ligne.troisChiffres.ecartItineraireMax, null);
    const enteteSansAPriori = enteteDe(sansAPriori, outils);
    for (const nom of ['ecartItineraireMax', 'ecartAuPlafondAPriori']) {
      assert.equal(tuile(enteteSansAPriori, nom).texte, t('propositions.valeur.inconnu'), nom);
      assert.notEqual(tuile(entete, nom).texte, t('propositions.valeur.inconnu'), `${nom}, a priori connu`);
    }
  });

  test('aucune vue sans détail comparable, sans ligne ou sans table', () => {
    const vue = vueDe(generee(chargeSix()));
    assert.equal(enteteDe({ ...vue, detail: null }, outils), null);
    assert.equal(enteteDe({ ...vue, ligne: null }, outils), null);
    assert.equal(enteteDe({ ...vue, table: null }, outils), null);
    assert.equal(enteteDe({ ...vue, detail: { ...vue.detail, statut: 'derive' } }, outils), null);
  });
});

describe('enteteDe : les bornes, chacune d’une personne nommée (§ 12.2, B11, D29)', () => {
  test('le minimum brut : la personne au rang 1 du profil, au minimum, son plafond réalisé, son plafond a priori et son pourcentage, le compte du pire dessous', () => {
    const vue = vueDe(generee(chargeSix()));
    const { rang1 } = vue.detail.bornes;
    assert.equal(rang1.id, vue.detail.profil[0].id);
    assert.equal(rang1.rencontres, vue.ligne.mesures.aggRencontres.tous.min);
    const minimum = tuile(enteteDe(vue, outils), 'rencontresTous');
    assert.deepEqual(minimum.bornes, [
      t('qualite.tuile.personne', { nom: nomDe(vue.detail, rang1.id) }),
      t('qualite.tuile.plafondRealise', { plafond: rang1.plafondRealise }),
      t('qualite.tuile.plafondAPriori', { plafond: rang1.plafondAPriori }),
    ]);
    assert.deepEqual(minimum.pourcentage, {
      texte: valeur(rang1.pourcent),
      compte: t('qualite.tuile.pireRencontres', { rencontres: rang1.rencontres, plafond: rang1.plafondRealise }),
    });
    assert.match(minimum.pourcentage.compte, /^minimum \d+ sur \d+$/);
  });

  test('les bornes et les pourcentages se lisent dans le détail, jamais recomptés : un détail forgé les fait suivre', () => {
    const vue = vueDe(generee(chargeSix()));
    const detail = structuredClone(vue.detail);
    const [, autre] = detail.personnes;
    detail.bornes.rang1 = { ...detail.bornes.rang1, id: autre.id, pourcent: 37, rencontres: 3, plafondRealise: 8, plafondAPriori: null };
    detail.bornes.manque = { id: autre.id, plafondRealise: 41 };
    detail.bornes.diversite = { id: autre.id, aMax: 17 };
    const entete = enteteDe({ ...vue, detail }, outils);
    const minimum = tuile(entete, 'rencontresTous');
    // Le pourcentage de la personne nommée, jamais une moyenne de la
    // population ; sans plafond a priori, aucune ligne pour lui.
    assert.deepEqual(minimum.pourcentage, { texte: valeur(37), compte: 'minimum 3 sur 8' });
    assert.deepEqual(minimum.bornes, [t('qualite.tuile.personne', { nom: autre.nom }), t('qualite.tuile.plafondRealise', { plafond: 8 })]);
    // Le manque maximal : le plafond réalisé de la tête du profil de manque,
    // jamais le plus grand de la population, et aucun pourcentage.
    const manque = tuile(entete, 'manqueMax');
    assert.ok(manque.bornes.includes(t('qualite.tuile.plafondRealise', { plafond: 41 })), manque.bornes.join(' | '));
    assert.ok(manque.bornes.includes(t('qualite.tuile.personne', { nom: autre.nom })));
    assert.equal(manque.pourcentage, null);
    // A(p) : la borne de diversité de la personne nommée, sans pourcentage.
    const diversite = tuile(entete, 'appartenancesVues');
    assert.deepEqual(diversite.bornes, [t('qualite.tuile.personne', { nom: autre.nom }), t('qualite.tuile.borneDiversite', { borne: 17 })]);
    assert.equal(diversite.pourcentage, null);
    assert.ok(!diversite.bornes.some((ligne) => /plafond|%/.test(ligne)), diversite.bornes.join(' | '));
    // Un pourcentage de dénominateur nul : « — », le compte reste écrit.
    detail.bornes.rang1 = { ...detail.bornes.rang1, pourcent: null, rencontres: 0, plafondRealise: 0 };
    assert.deepEqual(tuile(enteteDe({ ...vue, detail }, outils), 'rencontresTous').pourcentage, { texte: null, compte: 'minimum 0 sur 0' });
  });

  test('le manque maximal porte l’effectif au manque maximal et le plafond réalisé de la tête du profil de manque', () => {
    const vue = vueDe(generee(chargeSix()));
    const { manque } = vue.detail.bornes;
    assert.deepEqual(tuile(enteteDe(vue, outils), 'manqueMax').bornes, [
      t('qualite.tuile.personne', { nom: nomDe(vue.detail, manque.id) }),
      t('qualite.tuile.effectifManque', { effectif: vue.ligne.troisChiffres.effectifManque.tous }),
      t('qualite.tuile.plafondRealise', { plafond: manque.plafondRealise }),
    ]);
  });

  test('sans appartenance : la tuile de A(p) le dit, sans borne de diversité', () => {
    const vue = vueDe(generee(chargeSix({ appartenances: false })));
    assert.equal(vue.detail.bornes.diversite, null);
    assert.deepEqual(tuile(enteteDe(vue, outils), 'appartenancesVues').bornes, [t('qualite.tuile.sansAppartenance')]);
  });

  test('les objectifs : la soirée sur les tours hors objectif, la personne au minimum de s(p) et ses tours possibles, chacun suivi du compte du pire', () => {
    const vue = vueDe(generee(chargeSix({ objectifs: true })));
    const { soiree, objectifs } = vue.detail.bornes;
    const entete = enteteDe(vue, outils);
    assert.deepEqual(tuile(entete, 'toursHorsObjectif').pourcentage, {
      texte: soiree.pourcent === null ? null : t('qualite.pourcentage.servis', { pourcent: soiree.pourcent }),
      compte: t('qualite.tuile.pireJamaisServies', { personnes: soiree.jamaisServies }),
    });
    const selon = tuile(entete, 'toursSelonObjectif');
    assert.deepEqual(selon.bornes, [
      t('qualite.tuile.personne', { nom: nomDe(vue.detail, objectifs.id) }),
      t('qualite.tuile.toursPossibles', { possibles: objectifs.possibles }),
    ]);
    assert.deepEqual(selon.pourcentage, {
      texte: valeur(objectifs.pourcent),
      compte: t('qualite.tuile.pireServis', { servis: objectifs.servis, possibles: objectifs.possibles }),
    });
  });

  test('les tours hors objectif : le plancher de la soirée quand le diagnostic en écrit un, sous des planchers valides ; aucun sinon', () => {
    // Quatre personnes attendues à une table de trois places, deux autres
    // réservées à l'autre table : au moins trois tours hors objectif.
    const vue = vueDe(generee(chargeSix({ objectifs: true, finance: 4, reservees: true })));
    const { soiree } = vue.detail.objectifs;
    assert.equal(vue.detail.collisions.planchersValides, true);
    assert.ok(soiree.plancher > 0, `plancher ${soiree.plancher}`);
    const ligneDuPlancher = t('qualite.tuile.plancher', { plancher: soiree.plancher });
    assert.ok(tuile(enteteDe(vue, outils), 'toursHorsObjectif').bornes.includes(ligneDuPlancher));
    // Hors du domaine des planchers, le même plancher ne s'écrit pas.
    const detail = structuredClone(vue.detail);
    detail.collisions.planchersValides = false;
    assert.ok(!tuile(enteteDe({ ...vue, detail }, outils), 'toursHorsObjectif').bornes.some((ligne) => ligne.startsWith('plancher')));
    // Un plancher nul : le diagnostic se tait, aucune ligne.
    detail.collisions.planchersValides = true;
    detail.objectifs.soiree = { ...detail.objectifs.soiree, plancher: 0 };
    assert.ok(!tuile(enteteDe({ ...vue, detail }, outils), 'toursHorsObjectif').bornes.some((ligne) => ligne.startsWith('plancher')));
  });

  test('les rencontres répétées et les retours : les choisis en valeur, les imposés énoncés à part', () => {
    const vue = vueDe(generee(chargeSix({ reservees: true })));
    const { imposees } = vue.ligne.mesures.rencontresRepetees;
    assert.ok(imposees > 0, `imposées ${imposees}`);
    assert.ok(vue.table.imposes.retours > 0, `retours imposés ${vue.table.imposes.retours}`);
    const entete = enteteDe(vue, outils);
    assert.deepEqual(tuile(entete, 'rencontresRepetees').bornes, [t('qualite.tuile.imposees', { imposees })]);
    assert.deepEqual(tuile(entete, 'retoursChoisis').bornes, [t('qualite.tuile.imposes', { imposes: vue.table.imposes.retours })]);
    // Sans réservation, les imposés valent zéro et restent énoncés.
    const libre = enteteDe(vueDe(generee(chargeSix())), outils);
    assert.deepEqual(tuile(libre, 'rencontresRepetees').bornes, [t('qualite.tuile.imposees', { imposees: 0 })]);
    assert.deepEqual(tuile(libre, 'retoursChoisis').bornes, [t('qualite.tuile.imposes', { imposes: 0 })]);
  });

  test('les animateurs : la personne au minimum de m(p) et sa borne des animateurs, sans pourcentage', () => {
    const charge = structuredClone(analyser(texteLivre('grande')).charge);
    charge.reglages.rencontrerAnimateurs = true;
    const vue = vueDe(generee(charge, { graine: 1, nombre: 1, arret: 300 }));
    const { animateurs } = vue.detail.bornes;
    assert.notEqual(animateurs, null);
    const rencontres = tuile(enteteDe(vue, outils), 'animateursRencontres');
    assert.deepEqual(rencontres.bornes, [
      t('qualite.tuile.personne', { nom: nomDe(vue.detail, animateurs.id) }),
      t('qualite.tuile.borneAnimateurs', { borne: animateurs.borne }),
    ]);
    assert.equal(rencontres.pourcentage, null);
  });

  test('trois tuiles seulement portent un pourcentage : le minimum brut, les tours hors objectif, le minimum de s(p)', () => {
    assert.deepEqual([...TUILES_A_POURCENTAGE], ['rencontresTous', 'toursHorsObjectif', 'toursSelonObjectif']);
    for (const charge of [generee(chargeSix({ objectifs: true })), generee(chargeSix({ objectifs: true, reglages: { respecterObjectifs: false } }))]) {
      const avec = tuiles(enteteDe(vueDe(charge), outils)).filter(({ pourcentage }) => pourcentage !== null);
      assert.deepEqual(avec.map(({ nom }) => nom), [...TUILES_A_POURCENTAGE]);
      for (const { pourcentage } of avec) assert.ok(pourcentage.compte.length > 0);
    }
    // Aucun signe du pourcentage hors des trois pourcentages.
    const entete = enteteDe(vueDe(generee(chargeSix({ objectifs: true }))), outils);
    for (const tuileDe of tuiles(entete)) {
      for (const texte of [tuileDe.libelle, tuileDe.texte, ...tuileDe.bornes, tuileDe.pourcentage?.compte ?? '']) {
        assert.ok(!texte.includes('%'), `${tuileDe.nom} : ${texte}`);
      }
    }
  });
});
