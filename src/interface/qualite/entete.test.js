// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle de l'en-tête chiffré de la page de qualité (§ 12.2,
// B11, D29, D34, D48, D52) : une tuile par colonne de mesure du tableau des
// propositions, dans son ordre et sous ses groupes, la cellule même du
// tableau quand la colonne y est ; une tuile sans colonne lit la même
// mesure et dit qu'elle ne classe pas ; un critère sans objet n'a pas de
// tuile ; chaque borne est celle d'une personne nommée, lue dans le détail,
// et le plancher, là où le diagnostic l'écrit, ne nomme personne ; trois
// tuiles seulement portent un pourcentage, suivi du compte du pire.
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
import { celluleDeTuile } from './entete.js';

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

// Les tuiles qui portent un plancher quand le diagnostic en prouve un.
const TUILES_A_PLANCHER = [
  'collisionsCumulees',
  'pairesDistinctes',
  'excedentCollisions',
  'ecartItineraireMax',
  'jamaisServies',
  'horsObjectifMax',
  'toursHorsObjectif',
];
// La ligne qu'une tuile écrit pour son plancher, et les lignes de plancher
// parmi les bornes d'une tuile.
const ligneDuPlancher = ({ plancher, atteint }) => t(atteint ? 'qualite.tuile.plancherAtteint' : 'qualite.tuile.plancher', { plancher });
const lignesDePlancher = (bornes) => bornes.filter((ligne) => ligne.startsWith('plancher'));

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
    detail.bornes.manque = { id: autre.id, plafondRealise: 41, effectif: 5 };
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
    assert.ok(manque.bornes.includes(t('qualite.tuile.effectifAuManqueMax', { effectif: 5 })), manque.bornes.join(' | '));
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

  test('rouge : le manque maximal porte l’effectif au manque maximal — non l’effectif du manque — et le plafond réalisé de la tête du profil de manque', () => {
    // Une recherche arrêtée au premier pas : sa deuxième proposition laisse
    // à trois personnes un manque, de valeurs différentes.
    const vue = vueDe(generee(chargeSix(), { graine: 3, nombre: 4, arret: 1 }), 2);
    const { manque } = vue.detail.bornes;
    // Les personnes dont le manque égale le plus grand, lues dans la ligne
    // d'évaluation : moins que les personnes à qui il en manque, que
    // l'effectif du manque compte.
    const { mesures, plafondsRealises, troisChiffres } = vue.ligne;
    const auMaximum = plafondsRealises.filter((plafond, p) => plafond - mesures.rencontres[p] === troisChiffres.manqueMax.tous).length;
    assert.notEqual(auMaximum, troisChiffres.effectifManque.tous);
    const entete = enteteDe(vue, outils);
    assert.deepEqual(tuile(entete, 'manqueMax').bornes, [
      t('qualite.tuile.personne', { nom: nomDe(vue.detail, manque.id) }),
      t('qualite.tuile.effectifAuManqueMax', { effectif: auMaximum }),
      t('qualite.tuile.plafondRealise', { plafond: manque.plafondRealise }),
    ]);
    // L'effectif du manque garde sa tuile, sous le libellé de sa colonne.
    const effectif = tuile(entete, 'effectifManque');
    assert.equal(effectif.libelle, t('propositions.colonne.effectifManque'));
    assert.equal(effectif.texte, format.nombre(troisChiffres.effectifManque.tous));
  });

  test('rouge : un manque maximal nul ne compte personne « au manque maximal » ; la personne et son plafond restent', () => {
    // Une ligne forgée à manque maximal nul : chacun y est « au manque
    // maximal » de 0, ce qu'aucune ligne n'écrit.
    const vue = vueDe(generee(chargeSix()));
    const ligne = structuredClone(vue.ligne);
    ligne.troisChiffres.manqueMax = { ...ligne.troisChiffres.manqueMax, tous: 0 };
    const { manque } = vue.detail.bornes;
    const sansManque = tuile(enteteDe({ ...vue, ligne }, outils), 'manqueMax');
    assert.equal(sansManque.texte, format.nombre(0));
    assert.deepEqual(sansManque.bornes, [
      t('qualite.tuile.personne', { nom: nomDe(vue.detail, manque.id) }),
      t('qualite.tuile.plafondRealise', { plafond: manque.plafondRealise }),
    ]);
    // Un manque maximal non nul garde la ligne.
    assert.ok(tuile(enteteDe(vue, outils), 'manqueMax').bornes.includes(t('qualite.tuile.effectifAuManqueMax', { effectif: manque.effectif })));
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

  test('rouge : chaque tuile au plancher prouvé l’écrit sous son chiffre, « atteint » quand il l’est ; aucune autre', () => {
    const vue = vueDe(generee(chargeSix({ objectifs: true })));
    assert.deepEqual(Object.keys(vue.detail.bornes.planchers).sort(), [...TUILES_A_PLANCHER].sort());
    for (const nom of TUILES_A_PLANCHER) {
      for (const atteint of [false, true]) {
        const detail = structuredClone(vue.detail);
        detail.bornes.planchers = Object.fromEntries(TUILES_A_PLANCHER.map((autre) => [autre, null]));
        detail.bornes.planchers[nom] = { plancher: 3, atteint };
        const entete = enteteDe({ ...vue, detail }, outils);
        const attendue = t(atteint ? 'qualite.tuile.plancherAtteint' : 'qualite.tuile.plancher', { plancher: 3 });
        assert.equal(tuile(entete, nom).bornes.at(-1), attendue, nom);
        assert.deepEqual(lignesDePlancher(tuile(entete, nom).bornes), [attendue], nom);
        for (const autre of tuiles(entete)) if (autre.nom !== nom) assert.deepEqual(lignesDePlancher(autre.bornes), [], `${nom} : ${autre.nom}`);
      }
    }
    // Sans plancher prouvé, aucune ligne, jamais « plancher 0 ».
    const detail = structuredClone(vue.detail);
    detail.bornes.planchers = Object.fromEntries(TUILES_A_PLANCHER.map((nom) => [nom, null]));
    for (const autre of tuiles(enteteDe({ ...vue, detail }, outils))) assert.deepEqual(lignesDePlancher(autre.bornes), [], autre.nom);
  });

  test('rouge : cinq membres d’une appartenance pour deux tables de trois : 12 collisions cumulées au moins, atteintes ; chaque plancher du détail écrit', () => {
    const charge = chargeSix();
    for (const personne of charge.participants) personne.appartenance = personne.id <= 5 ? 'Coopérative Aubier' : null;
    const vue = vueDe(generee(charge));
    assert.equal(vue.ligne.mesures.collisionsCumulees, 12);
    assert.deepEqual(vue.detail.bornes.planchers.collisionsCumulees, { plancher: 12, atteint: true });
    const entete = enteteDe(vue, outils);
    assert.deepEqual(tuile(entete, 'collisionsCumulees').bornes, [t('qualite.tuile.plancherAtteint', { plancher: 12 })]);
    for (const nom of TUILES_A_PLANCHER) {
      const plancher = vue.detail.bornes.planchers[nom];
      const ecrites = tuiles(entete).some((candidate) => candidate.nom === nom) ? lignesDePlancher(tuile(entete, nom).bornes) : [];
      assert.deepEqual(ecrites, plancher === null ? [] : [ligneDuPlancher(plancher)], nom);
    }
  });

  test('les tours hors objectif : le plancher de la soirée, sous son pourcentage et le compte du pire', () => {
    // Quatre personnes attendues à une table de trois places, deux autres
    // réservées à l'autre table : au moins trois tours hors objectif.
    const vue = vueDe(generee(chargeSix({ objectifs: true, finance: 4, reservees: true })));
    const plancher = vue.detail.bornes.planchers.toursHorsObjectif;
    assert.ok(plancher !== null && plancher.plancher === vue.detail.objectifs.soiree.plancher, JSON.stringify(plancher));
    const horsObjectif = tuile(enteteDe(vue, outils), 'toursHorsObjectif');
    assert.notEqual(horsObjectif.pourcentage, null);
    assert.deepEqual(horsObjectif.bornes, [ligneDuPlancher(plancher)]);
  });

  test('rouge : les deux lignes du plancher, mot pour mot, ne disent rien que de la mesure de leur tuile', () => {
    assert.equal(t('qualite.tuile.plancher', { plancher: 4 }), 'plancher 4');
    assert.equal(t('qualite.tuile.plancherAtteint', { plancher: 4 }), 'plancher 4, le meilleur atteint');
  });

  test('rouge : une tuile des objectifs qui ne classe pas n’écrit aucun plancher, même prouvé, comme le diagnostic (§ 5.6)', () => {
    // Quatre personnes attendues à une table de trois places : 3 tours hors
    // objectif au moins, et 1 au moins pour une personne.
    const sous = (reglages) => {
      const vue = vueDe(generee(chargeSix({ objectifs: true, finance: 4, reservees: true, reglages })));
      return { vue, entete: enteteDe(vue, outils) };
    };
    const places = sous({});
    assert.equal(tuile(places.entete, 'horsObjectifMax').classe, false);
    assert.deepEqual(lignesDePlancher(tuile(places.entete, 'horsObjectifMax').bornes), []);
    assert.equal(lignesDePlancher(tuile(places.entete, 'toursHorsObjectif').bornes).length, 1);
    const minimum = sous({ modeObjectifs: 'minimum' });
    const auPlus = minimum.vue.detail.bornes.planchers.horsObjectifMax;
    assert.equal(auPlus.plancher, 1);
    assert.equal(tuile(minimum.entete, 'horsObjectifMax').classe, true);
    assert.deepEqual(lignesDePlancher(tuile(minimum.entete, 'horsObjectifMax').bornes), [ligneDuPlancher(auPlus)]);
    // Le critère décoché ne compare rien : ses tuiles restent, sans plancher.
    const decoche = sous({ respecterObjectifs: false });
    for (const nom of ['jamaisServies', 'horsObjectifMax', 'toursHorsObjectif']) {
      assert.equal(tuile(decoche.entete, nom).classe, false, nom);
      assert.deepEqual(lignesDePlancher(tuile(decoche.entete, nom).bornes), [], nom);
    }
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

describe('celluleDeTuile : la tuile et la cellule d’une colonne de la comparaison s’écrivent par une seule fonction (§ 12.10.6, D67, C20)', () => {
  // Le contexte d'une cellule, lu dans la vue d'un placement : ses bornes,
  // sa ligne d'évaluation, la table, et le nom de chaque personne.
  const contexteDe = (vue, bornes = vue.detail.bornes) => ({
    bornes,
    ligne: vue.ligne,
    table: vue.table,
    t,
    format,
    nomDe: (id) => nomDe(vue.detail, id),
  });

  test('chaque tuile d’enteteDe est, valeur, bornes, plancher et pourcentage compris, la cellule que celluleDeTuile écrit de son détail', () => {
    for (const charge of [generee(chargeSix({ objectifs: true })), generee(chargeSix()), generee(chargeSix({ objectifs: true, reservees: true }))]) {
      const vue = vueDe(charge);
      const entete = enteteDe(vue, outils);
      for (const tuileDe of tuiles(entete)) {
        const { texte, bornes, pourcentage } = tuileDe;
        assert.deepEqual(celluleDeTuile(tuileDe.nom, contexteDe(vue)), { texte, bornes, pourcentage }, tuileDe.nom);
      }
    }
  });

  test('une tuile dont le contexte ne porte pas la borne n’écrit aucune ligne de borne ni pourcentage ; son propre plancher reste écrit, en seule ligne', () => {
    const vue = vueDe(generee(chargeSix({ objectifs: true })));
    const { diversite, animateurs, ...portees } = vue.detail.bornes;
    assert.notEqual(diversite, undefined);
    assert.notEqual(animateurs, undefined);
    // Un plancher forgé sur chacune des deux tuiles dont la borne manque.
    const forges = { appartenancesVues: { plancher: 2, atteint: false }, animateursRencontres: { plancher: 1, atteint: true } };
    const planchers = { ...Object.fromEntries(TUILES_A_PLANCHER.map((nom) => [nom, null])), ...forges };
    for (const [nom, plancher] of Object.entries(forges)) {
      const cellule = celluleDeTuile(nom, contexteDe(vue, { ...portees, planchers }));
      assert.deepEqual(cellule.bornes, [ligneDuPlancher(plancher)], nom);
      assert.equal(cellule.pourcentage, null, nom);
      assert.equal(cellule.texte, texteCellule(lireColonne(vue.ligne, nom), outils), nom);
    }
  });
});
