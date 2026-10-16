// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du modèle des colonnes côte à côte de la vue de comparaison
// (§ 12.10.6, § 12.8, D67, D84, C20, C29) : deux colonnes, une par
// placement, portent les mêmes chiffres dans le même ordre — en tête la
// place au classement, le minimum brut, le plus grand manque, l'effectif du
// manque et l'écart d'itinéraire maximal ; puis les tuiles de l'en-tête
// chiffré hors de la tête, sous les groupes du tableau des propositions.
// Chaque cellule s'écrit par celluleDeTuile, la fonction de la tuile : la
// même valeur, le même plancher, le même pourcentage suivi du même compte
// du pire — celui de son placement, jamais une moyenne, jamais l'autre
// placement. Trois cellules seulement portent un pourcentage ; aucune ne
// départage les deux. Les charges s'écrivent ici ; leurs propositions
// s'enregistrent par la commande. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { comparerPlacements, detaillerQualite, evaluer } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { texteFiliation } from '../propositions/filiation.js';
import { COLONNES, GROUPES_COLONNES, lireColonne, nomDe, tableau, texteCellule } from '../propositions/modele.js';
import { colonnesComparaison, TETE_DES_COLONNES } from './colonnes.js';
import { TUILES_A_POURCENTAGE, enteteDe } from './entete.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const V1 = VERSION.affichee;

// Dix personnes inventées, deux appartenances, trois tables de quatre
// places, trois tours ; avec objectifs, les trois premières portent
// « finance », que la première table attend pour la soirée ; aubier : le
// nombre des premières de la « Coopérative Aubier », les trois suivantes de
// l'« Atelier Ressac » — sept membres d'une appartenance pour trois tables
// en font asseoir deux ensemble, et le diagnostic prouve des planchers ;
// appartenances faux : personne ne porte d'appartenance.
function chargeDix({ objectifs = false, reglages = {}, aubier = 3, appartenances = true } = {}) {
  const charge = creerCharge({ id: 'evt-colonnes', nom: 'Atelier Ressac', siegesParDefaut: 4, tours: 3 });
  const noms = [
    ['Ombrelle', 'Iris'],
    ['Pervenche', 'Théo'],
    ['Lacasse', 'Ondine'],
    ['Tourteau', 'Basile'],
    ['Quenouille', 'Maëlle'],
    ['Varech', 'Sidonie'],
    ['Brisant', 'Anatole'],
    ['Ajonc', 'Clémence'],
    ['Embrun', 'Gaspard'],
    ['Saulaie', 'Romane'],
  ];
  const appartenanceDe = (rang) => {
    if (rang < aubier) return 'Coopérative Aubier';
    return rang < aubier + 3 ? 'Atelier Ressac' : null;
  };
  charge.participants = noms.map(([nom, prenom], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance: appartenances ? appartenanceDe(rang) : null,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(objectifs && rang < 3 ? { etiquettes: ['finance'] } : {}),
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  if (objectifs) charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
  charge.prochainsIds = { participant: 11, table: 4, proposition: 1 };
  Object.assign(charge.reglages, reglages);
  return charge;
}

// La charge, une génération de plus, enregistrée par la commande : une
// recherche courte, dont les propositions diffèrent assez pour que leurs
// rangs 1 ne soient pas la même personne.
function generee(charge, reglages = { graine: 3, nombre: 4, arret: 30 }) {
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// Le retenu tiré de la proposition id ; ajusté : deux personnes des deux
// tables échangées au premier tour, les listes gardées croissantes.
function avecRetenu(charge, id, { ajuste = false } = {}) {
  const copie = structuredClone(charge);
  const { siegesAttribues, tables, capacites, tours, participants, placement } = structuredClone(
    copie.propositions.find((proposition) => proposition.id === id),
  );
  copie.retenu = { proposition: id, siegesAttribues, tables, capacites, tours, participants, placement };
  if (ajuste) {
    const [premiere, seconde] = copie.retenu.placement[0].sieges;
    [premiere[0], seconde[0]] = [seconde[0], premiere[0]];
    for (const liste of [premiere, seconde]) liste.sort((x, y) => x - y);
  }
  copie.evenement.etat = 'retenu';
  return copie;
}

// La comparaison de a et b dans la charge, sa table, et les colonnes.
function comparees(charge, a, b) {
  const table = evaluer(charge);
  const comparaison = comparerPlacements(charge, table, a, b);
  return { table, comparaison, colonnes: colonnesComparaison(comparaison, table, outilsDe(charge)) };
}

const outilsDe = (charge) => ({ t, format, nomDe: (id) => nomDe(charge, id) });

// Les deux premières propositions comparables du classement.
const deuxPremieres = (charge) => evaluer(charge).classement.ordre.slice(0, 2);

// L'en-tête chiffré du placement cle, comme la vue « En-tête » le montre.
function enteteDuPlacement(charge, table, cle) {
  const ligne = cle === 'retenu' ? table.retenu : table.propositions.find(({ id }) => id === cle);
  return enteteDe({ detail: detaillerQualite(charge, cle), ligne, table }, { t, format });
}

const tuilesDe = (entete) => entete.groupes.flatMap(({ tuiles }) => tuiles);
const lignesDe = (colonnes) => [...colonnes.tete, ...colonnes.groupes.flatMap(({ lignes }) => lignes)];
const ligneNommee = (colonnes, nom) => {
  const trouvee = lignesDe(colonnes).find((ligne) => ligne.nom === nom);
  assert.ok(trouvee !== undefined, `ligne ${nom} absente`);
  return trouvee;
};
const valeur = (pourcent) => t('qualite.pourcentage.valeur', { pourcent });
const lignesDePlancher = (bornes) => bornes.filter((ligne) => ligne.startsWith('plancher'));

// Les tuiles dont la borne nomme une personne que la comparaison ne porte
// pas : la colonne n'en écrit que le plancher, et, pour la diversité sans
// appartenance présente, la phrase de la tuile.
const SANS_BORNE_DE_PERSONNE = ['appartenancesVues', 'animateursRencontres'];
const SANS_APPARTENANCE = t('qualite.tuile.sansAppartenance');
const lignesSansPersonne = (bornes) => bornes.filter((ligne) => ligne.startsWith('plancher') || ligne === SANS_APPARTENANCE);

describe('colonnesComparaison : chaque colonne, le pire cas de son placement (§ 12.10.6, D67, C20, C29)', () => {
  test('rouge : chaque colonne porte le pourcentage du pire cas de son placement — deux rangs 1 différents, « minimum 24 sur 27 » et « minimum 14 sur 27 », chacun sous le sien', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison } = comparees(charge, a, b);
    const forgee = structuredClone(comparaison);
    forgee.a.bornes.rang1 = { id: 1, rencontres: 24, plafondRealise: 27, plafondAPriori: 28, pourcent: 89 };
    forgee.b.bornes.rang1 = { id: 4, rencontres: 14, plafondRealise: 27, plafondAPriori: null, pourcent: 52 };
    const colonnes = colonnesComparaison(forgee, table, outilsDe(charge));
    const minimum = ligneNommee(colonnes, 'rencontresTous');
    assert.deepEqual(minimum.a.pourcentage, { texte: valeur(89), compte: t('qualite.tuile.pireRencontres', { rencontres: 24, plafond: 27 }) });
    assert.deepEqual(minimum.b.pourcentage, { texte: valeur(52), compte: t('qualite.tuile.pireRencontres', { rencontres: 14, plafond: 27 }) });
    assert.equal(minimum.a.pourcentage.compte, 'minimum 24 sur 27');
    assert.equal(minimum.b.pourcentage.compte, 'minimum 14 sur 27');
    // Chaque colonne nomme sa personne, jamais celle de l'autre.
    assert.deepEqual(minimum.a.bornes.slice(0, 3), [
      t('qualite.tuile.personne', { nom: 'Iris Ombrelle' }),
      t('qualite.tuile.plafondRealise', { plafond: 27 }),
      t('qualite.tuile.plafondAPriori', { plafond: 28 }),
    ]);
    assert.deepEqual(minimum.b.bornes.slice(0, 2), [
      t('qualite.tuile.personne', { nom: 'Basile Tourteau' }),
      t('qualite.tuile.plafondRealise', { plafond: 27 }),
    ]);
    assert.ok(!minimum.b.bornes.some((ligne) => ligne.startsWith('plafond a priori')), minimum.b.bornes.join(' | '));
  });

  test('sur des placements réels — deux propositions avec ou sans objectifs, sans appartenance présente, le retenu non ajusté ou ajusté —, chaque cellule est celle de la tuile du même placement — valeur, bornes, plancher, pourcentage et compte —, et la cellule du tableau quand le tableau la porte', () => {
    const base = generee(chargeDix({ objectifs: true, aubier: 7 }));
    const [premiere, seconde] = deuxPremieres(base);
    const parDefaut = (charge) => ({ charge, cles: deuxPremieres(charge) });
    const cas = [
      ['sans objectifs', parDefaut(generee(chargeDix())), 16],
      ['avec objectifs', parDefaut(generee(chargeDix({ objectifs: true }))), 20],
      ['sans appartenance', parDefaut(generee(chargeDix({ appartenances: false }))), 16],
      ['retenu', { charge: avecRetenu(base, premiere), cles: ['retenu', seconde] }, 20],
      ['retenu ajusté', { charge: avecRetenu(base, premiere, { ajuste: true }), cles: ['retenu', seconde] }, 20],
    ];
    for (const [nomDuCas, { charge, cles }, tuilesParColonne] of cas) {
      const [a, b] = cles;
      const { table, colonnes } = comparees(charge, a, b);
      const duTableau = tableau(table);
      let nombreDeCellules = 0;
      for (const [cote, cle] of [
        ['a', a],
        ['b', b],
      ]) {
        const entete = enteteDuPlacement(charge, table, cle);
        const ligneDuTableau = cle === 'retenu' ? duTableau.retenu : duTableau.lignes.find(({ id }) => id === cle);
        const celluleDuTableau = new Map(ligneDuTableau.cellules.map((cellule) => [cellule.colonne, cellule]));
        for (const tuile of tuilesDe(entete)) {
          const cellule = ligneNommee(colonnes, tuile.nom)[cote];
          const message = `${nomDuCas} ${cote} ${tuile.nom}`;
          assert.equal(cellule.texte, tuile.texte, message);
          assert.deepEqual(cellule.pourcentage, tuile.pourcentage, message);
          const attendues = SANS_BORNE_DE_PERSONNE.includes(tuile.nom) ? lignesSansPersonne(tuile.bornes) : tuile.bornes;
          assert.deepEqual(cellule.bornes, attendues, message);
          if (celluleDuTableau.has(tuile.nom)) assert.equal(cellule.texte, texteCellule(celluleDuTableau.get(tuile.nom), { t, format }), message);
          nombreDeCellules += 1;
        }
      }
      assert.equal(nombreDeCellules, 2 * tuilesParColonne, `${nomDuCas} : ${nombreDeCellules} cellules comparées`);
      // Sans appartenance présente, chaque colonne de la diversité porte la
      // phrase de la tuile ; avec, aucune.
      const diversite = ligneNommee(colonnes, 'appartenancesVues');
      for (const cote of ['a', 'b']) assert.equal(diversite[cote].bornes.includes(SANS_APPARTENANCE), nomDuCas === 'sans appartenance', `${nomDuCas} ${cote}`);
    }
  });

  test('la colonne de B se lit dans la ligne et la comparaison de B, jamais dans le détail de A : un B dont les chiffres diffèrent de A les garde', () => {
    const charge = generee(chargeDix({ objectifs: true }));
    const table = evaluer(charge);
    const ids = table.classement.ordre;
    // Deux propositions dont les rangs 1 du profil sont deux personnes.
    const paire = ids.flatMap((a) => ids.map((b) => [a, b])).find(([a, b]) => {
      if (a === b) return false;
      const c = comparerPlacements(charge, table, a, b);
      return c.a.bornes.rang1.id !== c.b.bornes.rang1.id;
    });
    assert.ok(paire !== undefined, 'aucune paire de rangs 1 différents');
    const [a, b] = paire;
    const { colonnes } = comparees(charge, a, b);
    const tuileA = tuilesDe(enteteDuPlacement(charge, table, a)).find(({ nom }) => nom === 'rencontresTous');
    const tuileB = tuilesDe(enteteDuPlacement(charge, table, b)).find(({ nom }) => nom === 'rencontresTous');
    assert.notDeepEqual(tuileA.bornes, tuileB.bornes);
    const minimum = ligneNommee(colonnes, 'rencontresTous');
    assert.deepEqual(minimum.a.bornes, tuileA.bornes);
    assert.deepEqual(minimum.b.bornes, tuileB.bornes);
  });

  test('rouge : la cellule du manque maximal écrit l’effectif au manque maximal de son profil, non l’effectif du manque, comme la tuile de son placement', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison, colonnes } = comparees(charge, a, b);
    const manque = ligneNommee(colonnes, 'manqueMax');
    let differents = 0;
    for (const [cote, cle] of [
      ['a', a],
      ['b', b],
    ]) {
      const profil = comparaison.profils[cote];
      const auMaximum = profil.filter(({ manque: valeurDuRang }) => valeurDuRang === profil[0].manque).length;
      const { effectifManque } = (cle === 'retenu' ? table.retenu : table.propositions.find(({ id }) => id === cle)).troisChiffres;
      if (auMaximum !== effectifManque.tous) differents += 1;
      assert.equal(manque[cote].bornes[1], t('qualite.tuile.effectifAuManqueMax', { effectif: auMaximum }), cote);
      const tuile = tuilesDe(enteteDuPlacement(charge, table, cle)).find(({ nom }) => nom === 'manqueMax');
      assert.deepEqual(manque[cote].bornes, tuile.bornes, cote);
    }
    assert.ok(differents > 0, 'aucun côté dont les deux effectifs diffèrent');
  });

  test('un pourcentage vaut celui de la comparaison, jamais une moyenne : une comparaison forgée le fait suivre, soirée et minimum de s(p) compris', () => {
    const charge = generee(chargeDix({ objectifs: true }));
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison } = comparees(charge, a, b);
    const forgee = structuredClone(comparaison);
    forgee.b.bornes.soiree = { servis: 7, possibles: 9, pourcent: 77, jamaisServies: 2 };
    forgee.b.bornes.objectifs = { id: 3, servis: 1, possibles: 3, pourcent: 33 };
    const colonnes = colonnesComparaison(forgee, table, outilsDe(charge));
    assert.deepEqual(ligneNommee(colonnes, 'toursHorsObjectif').b.pourcentage, {
      texte: t('qualite.pourcentage.servis', { pourcent: 77 }),
      compte: t('qualite.tuile.pireJamaisServies', { personnes: 2 }),
    });
    const selon = ligneNommee(colonnes, 'toursSelonObjectif').b;
    assert.deepEqual(selon.pourcentage, { texte: valeur(33), compte: t('qualite.tuile.pireServis', { servis: 1, possibles: 3 }) });
    assert.equal(selon.bornes[0], t('qualite.tuile.personne', { nom: 'Ondine Lacasse' }));
    // La colonne de A ne bouge pas.
    const intacte = colonnesComparaison(comparaison, table, outilsDe(charge));
    assert.deepEqual(ligneNommee(colonnes, 'toursHorsObjectif').a, ligneNommee(intacte, 'toursHorsObjectif').a);
  });
});

describe('colonnesComparaison : la tête et les groupes (§ 12.10.6, D84, C20)', () => {
  test('la tête : rang, minimum brut, plus grand manque, effectif du manque, écart d’itinéraire maximal, dans cet ordre, sous les libellés du tableau', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { comparaison, colonnes } = comparees(charge, a, b);
    assert.deepEqual(TETE_DES_COLONNES, ['rang', 'rencontresTous', 'manqueMax', 'effectifManque', 'ecartItineraireMax']);
    assert.deepEqual(
      colonnes.tete.map(({ nom }) => nom),
      TETE_DES_COLONNES,
    );
    for (const ligne of colonnes.tete) {
      assert.equal(ligne.libelle, t(COLONNES.find(({ nom }) => nom === ligne.nom).cle), ligne.nom);
      assert.equal(ligne.neClassePas, null, ligne.nom);
    }
    const [rang] = colonnes.tete;
    assert.deepEqual(rang.a, { texte: format.nombre(comparaison.a.rang), bornes: [], pourcentage: null });
    assert.deepEqual(rang.b, { texte: format.nombre(comparaison.b.rang), bornes: [], pourcentage: null });
    assert.deepEqual([comparaison.a.rang, comparaison.b.rang], [1, 2]);
    // Le plus grand manque nomme la tête du profil de manque de son
    // placement et son plafond réalisé, comme la tuile.
    const manque = ligneNommee(colonnes, 'manqueMax');
    for (const cote of ['a', 'b']) {
      const { id, plafondRealise } = comparaison[cote].bornes.manque;
      assert.equal(manque[cote].bornes[0], t('qualite.tuile.personne', { nom: nomDe(charge, id) }), cote);
      assert.ok(manque[cote].bornes.includes(t('qualite.tuile.plafondRealise', { plafond: plafondRealise })), cote);
    }
  });

  test('les groupes : les tuiles de l’en-tête hors de la tête, sous les groupes du tableau, dans leur ordre, chacune sous son libellé', () => {
    const charge = generee(chargeDix({ objectifs: true }));
    const [a, b] = deuxPremieres(charge);
    const { table, colonnes } = comparees(charge, a, b);
    const entete = enteteDuPlacement(charge, table, a);
    const attendus = entete.groupes
      .map(({ cle, libelle, tuiles }) => ({ cle, libelle, noms: tuiles.map(({ nom }) => nom).filter((nom) => !TETE_DES_COLONNES.includes(nom)) }))
      .filter(({ noms }) => noms.length > 0);
    assert.deepEqual(
      colonnes.groupes.map(({ cle, libelle, lignes }) => ({ cle, libelle, noms: lignes.map(({ nom }) => nom) })),
      attendus,
    );
    const ordre = GROUPES_COLONNES.map(({ cle }) => cle);
    const indices = colonnes.groupes.map(({ cle }) => ordre.indexOf(cle));
    assert.deepEqual(indices, [...indices].sort((x, y) => x - y));
    for (const ligne of lignesDe(colonnes).filter(({ nom }) => nom !== 'rang')) {
      const tuile = tuilesDe(entete).find(({ nom }) => nom === ligne.nom);
      assert.equal(ligne.libelle, tuile.libelle, ligne.nom);
      assert.equal(ligne.neClassePas, tuile.neClassePas, ligne.nom);
    }
    // Aucune ligne n'est écrite deux fois.
    const noms = lignesDe(colonnes).map(({ nom }) => nom);
    assert.equal(new Set(noms).size, noms.length);
  });

  test('critère des objectifs décoché, avec des concernés : les tours hors objectif et le minimum de s(p) restent, « ne classe pas », avec leur pourcentage et leur compte du pire', () => {
    const charge = generee(chargeDix({ objectifs: true, reglages: { respecterObjectifs: false, modeObjectifs: 'chacun' } }));
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison, colonnes } = comparees(charge, a, b);
    assert.ok(!tableau(table).colonnes.some(({ nom }) => nom === 'toursHorsObjectif'));
    for (const nom of ['toursHorsObjectif', 'toursSelonObjectif']) {
      const ligne = ligneNommee(colonnes, nom);
      assert.equal(ligne.neClassePas, t('qualite.tuile.neClassePas'), nom);
      assert.equal(ligne.libelle, t(`qualite.tuile.${nom}`), nom);
      for (const cote of ['a', 'b']) {
        assert.notEqual(ligne[cote].pourcentage, null, `${nom} ${cote}`);
        assert.ok(ligne[cote].pourcentage.compte.length > 0, `${nom} ${cote}`);
      }
    }
    assert.equal(ligneNommee(colonnes, 'toursHorsObjectif').a.pourcentage.texte, t('qualite.pourcentage.servis', { pourcent: comparaison.a.bornes.soiree.pourcent }));
  });

  test('trois pourcentages par colonne quand les objectifs ont des concernés, un seul sinon ; jamais au manque, à l’effectif du manque, à l’écart d’itinéraire ni à la place', () => {
    for (const [objectifs, attendu] of [
      [true, 3],
      [false, 1],
    ]) {
      const charge = generee(chargeDix({ objectifs }));
      const [a, b] = deuxPremieres(charge);
      const { colonnes } = comparees(charge, a, b);
      for (const cote of ['a', 'b']) {
        const portant = lignesDe(colonnes).filter((ligne) => ligne[cote].pourcentage !== null).map(({ nom }) => nom);
        assert.equal(portant.length, attendu, `${objectifs} ${cote} : ${portant.join(', ')}`);
        assert.ok(portant.every((nom) => TUILES_A_POURCENTAGE.includes(nom)), portant.join(', '));
      }
      // En tête, seul le minimum brut.
      assert.deepEqual(
        colonnes.tete.filter((ligne) => ligne.a.pourcentage !== null || ligne.b.pourcentage !== null).map(({ nom }) => nom),
        ['rencontresTous'],
      );
    }
  });

  test('le taux de diversité au centième, comme au tableau et sur la tuile', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { table, colonnes } = comparees(charge, a, b);
    for (const [cote, cle] of [
      ['a', a],
      ['b', b],
    ]) {
      const ligne = table.propositions.find(({ id }) => id === cle);
      assert.equal(ligneNommee(colonnes, 'diversite')[cote].texte, format.nombre(ligne.mesures.aggDiversite.tous.min, { decimales: 2 }), cote);
      assert.equal(ligneNommee(colonnes, 'diversite')[cote].texte, texteCellule(lireColonne(ligne, 'diversite'), { t, format }), cote);
    }
  });
});

describe('colonnesComparaison : les cas limites d’une colonne (§ 12.6, C17, C20)', () => {
  test('un plafond réalisé nul au rang 1 : le pourcentage s’écrit « — » (texte null), le compte reste écrit, « minimum 0 sur 0 »', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison } = comparees(charge, a, b);
    const forgee = structuredClone(comparaison);
    forgee.b.bornes.rang1 = { id: 5, rencontres: 0, plafondRealise: 0, plafondAPriori: 0, pourcent: null };
    const minimum = ligneNommee(colonnesComparaison(forgee, table, outilsDe(charge)), 'rencontresTous');
    assert.deepEqual(minimum.b.pourcentage, { texte: null, compte: 'minimum 0 sur 0' });
    assert.notEqual(minimum.a.pourcentage.texte, null);
  });

  test('des planchers hors domaine d’un seul côté : cette colonne n’écrit aucun plancher, l’autre écrit les siens', () => {
    const charge = generee(chargeDix({ objectifs: true, aubier: 7 }));
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison, colonnes } = comparees(charge, a, b);
    const prouves = Object.entries(comparaison.a.bornes.planchers).filter(([, plancher]) => plancher !== null);
    assert.ok(prouves.length > 0, 'aucun plancher prouvé');
    const forgee = structuredClone(comparaison);
    forgee.a.bornes.planchers = Object.fromEntries(Object.keys(comparaison.a.bornes.planchers).map((nom) => [nom, null]));
    const horsDomaine = colonnesComparaison(forgee, table, outilsDe(charge));
    for (const [nom, { plancher, atteint }] of prouves) {
      const ligne = t(atteint ? 'qualite.tuile.plancherAtteint' : 'qualite.tuile.plancher', { plancher });
      assert.equal(ligneNommee(colonnes, nom).a.bornes.at(-1), ligne, nom);
      assert.deepEqual(lignesDePlancher(ligneNommee(horsDomaine, nom).a.bornes), [], nom);
      assert.deepEqual(ligneNommee(horsDomaine, nom).b, ligneNommee(colonnes, nom).b, nom);
    }
  });

  test('aucun pourcentage ne départage : l’ordre des lignes ne dépend pas des valeurs, échanger les côtés échange les cellules, et aucun texte hors d’un pourcentage ne porte le signe', () => {
    const charge = generee(chargeDix({ objectifs: true }));
    const [a, b] = deuxPremieres(charge);
    const { colonnes } = comparees(charge, a, b);
    const { colonnes: inverses } = comparees(charge, b, a);
    assert.deepEqual(lignesDe(inverses).map(({ nom }) => nom), lignesDe(colonnes).map(({ nom }) => nom));
    for (const [ligne, inverse] of lignesDe(colonnes).map((l, i) => [l, lignesDe(inverses)[i]])) {
      assert.deepEqual(inverse.a, ligne.b, ligne.nom);
      assert.deepEqual(inverse.b, ligne.a, ligne.nom);
      assert.deepEqual(Object.keys(ligne).sort(), ['a', 'b', 'libelle', 'neClassePas', 'nom'], ligne.nom);
      for (const cote of ['a', 'b']) {
        assert.deepEqual(Object.keys(ligne[cote]).sort(), ['bornes', 'pourcentage', 'texte'], ligne.nom);
        const textes = [ligne[cote].texte, ...ligne[cote].bornes, ligne[cote].pourcentage?.compte ?? ''];
        assert.ok(!textes.some((texte) => texte.includes('%')), `${ligne.nom} ${cote} : ${textes.join(' | ')}`);
      }
    }
    assert.deepEqual(Object.keys(colonnes).sort(), ['groupes', 'placements', 'tete']);
  });
});

describe('colonnesComparaison : un côté sans ligne comparable', () => {
  test('lève RangeError pour un côté que la table ne porte pas, ou dont la ligne ne se compare pas', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison } = comparees(charge, a, b);
    const absent = structuredClone(comparaison);
    absent.b.cle = 99;
    assert.throws(() => colonnesComparaison(absent, table, outilsDe(charge)), (erreur) => erreur instanceof RangeError && /pas de ligne comparable/.test(erreur.message));
    const sansRetenu = structuredClone(comparaison);
    sansRetenu.a.cle = 'retenu';
    assert.throws(() => colonnesComparaison(sansRetenu, { ...table, retenu: null }, outilsDe(charge)), (erreur) => erreur instanceof RangeError && /pas de ligne comparable/.test(erreur.message));
    const enDerive = {
      ...table,
      propositions: table.propositions.map((ligne) => (ligne.id === b ? { ...ligne, statut: 'derive' } : ligne)),
    };
    assert.throws(() => colonnesComparaison(comparaison, enDerive, outilsDe(charge)), (erreur) => erreur instanceof RangeError && /pas de ligne comparable/.test(erreur.message));
  });
});

describe('colonnesComparaison : les en-têtes des deux colonnes (§ 12.10.6, D58, D76, C20)', () => {
  test('une proposition se nomme par son numéro ; une dérivée porte sa filiation sous son nom', () => {
    const charge = generee(chargeDix());
    const [a, b] = deuxPremieres(charge);
    const { table, comparaison, colonnes } = comparees(charge, a, b);
    assert.deepEqual(colonnes.placements, {
      a: { nom: t('qualite.comparaison.nom.proposition', { proposition: a }), origine: null, filiation: null },
      b: { nom: t('qualite.comparaison.nom.proposition', { proposition: b }), origine: null, filiation: null },
    });
    const forgee = structuredClone(comparaison);
    forgee.a.derivation = { depart: b, toursFiges: [1, 2], departPresent: true };
    forgee.b.derivation = { depart: 9, toursFiges: [], departPresent: false };
    const derivees = colonnesComparaison(forgee, table, outilsDe(charge));
    assert.equal(derivees.placements.a.filiation, texteFiliation(forgee.a.derivation, { t, format }));
    assert.equal(derivees.placements.b.filiation, texteFiliation(forgee.b.derivation, { t, format }));
    assert.notEqual(derivees.placements.a.filiation, null);
  });

  test('le retenu : « placement retenu », sa proposition d’origine, et sa place — celle de sa proposition non ajusté, « — » et « ne se classe pas » ajusté', () => {
    const base = generee(chargeDix());
    const [premiere, seconde] = deuxPremieres(base);
    const tel = avecRetenu(base, premiere);
    const { comparaison, colonnes } = comparees(tel, 'retenu', seconde);
    assert.deepEqual(colonnes.placements.a, {
      nom: t('qualite.comparaison.nom.retenu'),
      origine: t('propositions.retenu.origine', { proposition: premiere }),
      filiation: null,
    });
    assert.equal(comparaison.a.rang, 1);
    assert.deepEqual(colonnes.tete[0].a, { texte: format.nombre(1), bornes: [], pourcentage: null });

    const ajuste = avecRetenu(base, premiere, { ajuste: true });
    const { comparaison: c2, colonnes: k2 } = comparees(ajuste, seconde, 'retenu');
    assert.equal(c2.b.rang, null);
    assert.equal(k2.placements.b.origine, t('propositions.retenu.ajuste', { proposition: premiere }));
    assert.deepEqual(k2.tete[0].b, { texte: t('format.vide'), bornes: [t('qualite.colonnes.rangRetenu')], pourcentage: null });
  });
});
