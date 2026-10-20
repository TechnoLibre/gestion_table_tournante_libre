// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des modèles des deux vues des animateurs (§ 12.13, B22, D37,
// D38) : le profil trié des animateurs rencontrés, sa borne en repère, sans
// manque ni pourcentage ; la diversité par animateur sur la soirée, en deux
// colonnes juxtaposées, le moins varié en tête, et son jumeau, la soirée
// puis chaque tour animé. Chaque nombre vient du détail du placement
// (detaillerQualite). Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { configurationDe } from '../../application/configuration.js';
import { detaillerQualite } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { rechercher } from '../../moteur/recherche.js';
import { creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { modeleAnimateurs, modeleDiversite } from './animateurs.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;

// Neuf personnes inventées, leurs organisations et leurs étiquettes.
const PERSONNES = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier', []],
  ['Pervenche', 'Théo', 'Atelier Ressac', []],
  ['Lacasse', 'Ondine', 'Atelier Ressac', ['finance']],
  ['Tourteau', 'Basile', 'Coopérative Aubier', ['bénévole']],
  ['Quenouille', 'Maëlle', 'Atelier Ressac', ['finance', 'Montréal']],
  ['Rocaille', 'Anselme', null, ['bénévole']],
  ['Brindille', 'Pélagie', 'Coopérative Aubier', []],
  ['Cassonade', 'Firmin', null, ['Montréal']],
  ['Grésil', 'Ysaline', 'Atelier Ressac', []],
];

// Trois tables de trois places, trois tours ; un titre au siège 1 des tables
// 1 et 2. Iris Ombrelle, réservée à la table 1 pour la soirée, y anime à
// chaque tour ; Théo Pervenche, réservé à la table 2 au seul tour 2, y anime
// ce tour-là. organisations : false pour une seule organisation ;
// etiquettes : false pour aucune ; titres : false pour aucun animateur.
function chargeAnimateurs({ organisations = true, etiquettes = true, titres = true } = {}) {
  const charge = creerCharge({ id: 'evt-animateurs', nom: 'Atelier Ressac', siegesParDefaut: 3, tours: 3 });
  charge.participants = PERSONNES.map(([nom, prenom, organisation, liste], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    organisation: organisations ? organisation : 'Coopérative Aubier',
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(etiquettes && liste.length > 0 ? { etiquettes: liste } : {}),
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id + 10, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  if (titres) {
    charge.titres = [1, 2].map((table) => ({ table, siege: 1, libelle: 'Animation' }));
    charge.reservations = [
      { participant: 1, table: 1, siege: null, portee: 'tous', tour: null },
      { participant: 2, table: 2, siege: null, portee: 'tour', tour: 2 },
    ];
  }
  charge.reglages.rencontrerAnimateurs = true;
  charge.prochainsIds = { participant: 10, table: 4, proposition: 1 };
  return charge;
}

// Le détail de la première proposition d'une génération.
function detailDe(options) {
  const charge = chargeAnimateurs(options);
  const configuration = configurationDe(charge);
  const propositions = rechercher(configuration, { graine: 11, nombre: 1, arret: 200 });
  const generee = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
  return detaillerQualite(generee, generee.propositions[0].id);
}

// Chaque texte qu'atteint une valeur, chaînes des objets et des listes
// comprises.
function textes(valeur, rendus = []) {
  if (typeof valeur === 'string') rendus.push(valeur);
  else if (valeur !== null && typeof valeur === 'object') for (const element of Object.values(valeur)) textes(element, rendus);
  return rendus;
}

describe('animateurs rencontrés : le profil trié (§ 12.13, B22, D37)', () => {
  test('sans animateur, ou sans personne concernée, la vue cède la place à sa phrase', () => {
    const detail = detailDe({ titres: false });
    assert.equal(detail.animateurs, null);
    assert.deepEqual(modeleAnimateurs(detail, t), { cas: 'aucun' });
    const forge = structuredClone(detailDe());
    forge.animateurs.profil = null;
    forge.animateurs.repartition = null;
    assert.deepEqual(modeleAnimateurs(forge, t), { cas: 'aucun' });
    assert.equal(modeleAnimateurs(null, t), null);
  });

  test('une seule série, m(p) dans l’ordre du profil, et la borne des animateurs en repère pointillé, sous ce nom', () => {
    const detail = detailDe();
    const { profil } = detail.animateurs;
    assert.ok(profil.length >= 2);
    const modele = modeleAnimateurs(detail, t);
    assert.equal(modele.cas, 'animateurs');
    assert.deepEqual(modele.escalier.series, [
      { libelle: t('qualite.animateurs.serie'), valeurs: profil.map(({ rencontres }) => rencontres) },
    ]);
    assert.deepEqual(modele.escalier.reperes, [
      { genre: 'borne', libelle: t('qualite.animateurs.repere.borne'), valeurs: profil.map(({ borne }) => borne) },
    ]);
    assert.equal(modele.escalier.nom, t('qualite.animateurs.graphique'));
  });

  test('la synthèse : le minimum et son effectif, lus à la répartition', () => {
    const detail = detailDe();
    const [premiere] = detail.animateurs.repartition;
    assert.equal(premiere.valeur, detail.animateurs.profil[0].rencontres);
    assert.equal(
      modeleAnimateurs(detail, t).escalier.synthese,
      t('qualite.animateurs.synthese', { minimum: premiere.valeur, effectif: premiere.effectif }),
    );
  });

  test('rouge : ni manque ni pourcentage de la borne, ni « plafond » — le jumeau porte m(p), B(p) et le statut', () => {
    const detail = detailDe();
    const modele = modeleAnimateurs(detail, t);
    const [profil, repartition] = modele.jumeau;
    assert.deepEqual(
      profil.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['nom', 'texte'],
        ['rencontres', 'nombre'],
        ['borne', 'nombre'],
        ['statut', 'texte'],
      ],
    );
    const nomDe = new Map(detail.personnes.map(({ id, nom }) => [id, nom]));
    assert.deepEqual(
      profil.lignes,
      detail.animateurs.profil.map(({ id, rencontres, borne, statut }) => ({
        nom: nomDe.get(id),
        rencontres,
        borne,
        statut: t(`participants.statut.${statut}`),
      })),
    );
    assert.deepEqual(
      repartition.lignes,
      detail.animateurs.repartition.map(({ valeur, effectif }) => ({ valeur, effectif })),
    );
    assert.deepEqual(modele.infobulle, { colonnes: profil.colonnes, lignes: profil.lignes });
    for (const texte of textes(modele)) {
      assert.doesNotMatch(texte, /%/, texte);
      assert.doesNotMatch(texte, /plafond|manque/i, texte);
    }
    assert.equal(
      textes(modele).some((texte) => /pourcent/i.test(texte)),
      false,
    );
    const noms = [modele.escalier.nom, ...modele.jumeau.map(({ nom }) => nom)];
    assert.equal(new Set(noms).size, noms.length, 'noms accessibles distincts');
  });
});

describe('diversité par animateur : la soirée en graphique, chaque tour au jumeau (§ 12.13, B22, D38)', () => {
  test('sans animateur, la vue cède la place à sa phrase', () => {
    assert.deepEqual(modeleDiversite(detailDe({ titres: false }), t), { cas: 'aucunAnimateur' });
    assert.equal(modeleDiversite(null, t), null);
  });

  test('deux colonnes juxtaposées, organisations puis étiquettes, chacune son axe ; les valeurs de la soirée ; le moins varié en tête', () => {
    const detail = detailDe();
    const { colonnes, lignes } = detail.animateurs.diversite;
    assert.deepEqual(colonnes, { organisations: true, etiquettes: true });
    const modele = modeleDiversite(detail, t);
    assert.equal(modele.phrase, null);
    assert.equal(modele.barres.segments, null);
    assert.deepEqual(modele.barres.colonnes, [
      { genre: 'serie1', libelle: t('qualite.diversite.colonne.organisations') },
      { genre: 'serie2', libelle: t('qualite.diversite.colonne.etiquettes') },
    ]);
    assert.deepEqual(
      modele.barres.lignes.map(({ id, valeurs }) => [id, valeurs]),
      lignes.map(({ id, organisations, etiquettes }) => [id, [organisations, etiquettes]]),
    );
    const premiere = modele.barres.lignes[0];
    const minimum = Math.min(...lignes.map(({ organisations }) => organisations));
    assert.equal(premiere.valeurs[0], minimum, 'le moins varié en tête');
    for (const ligne of modele.barres.lignes) {
      const source = lignes.find(({ id }) => id === ligne.id);
      assert.equal(ligne.secondaire, t('qualite.diversite.secondaire', { tours: source.toursAnimes, personnes: source.personnes }));
      assert.equal(Object.hasOwn(ligne, 'organisation'), false);
    }
  });

  test('rouge : le graphique dessine la soirée, une ligne par animateur, jamais une ligne par tour', () => {
    const detail = detailDe();
    const { lignes } = detail.animateurs.diversite;
    assert.ok(lignes.some(({ toursAnimes }) => toursAnimes > 1));
    const modele = modeleDiversite(detail, t);
    assert.equal(modele.barres.lignes.length, lignes.length);
    assert.equal(new Set(modele.barres.lignes.map(({ id }) => id)).size, lignes.length);
  });

  test('au-dessus de chaque colonne, ses trois nombres : le moins varié, le plus varié, au minimum', () => {
    const detail = detailDe();
    const { equite } = detail.animateurs.diversite;
    assert.deepEqual(modeleDiversite(detail, t).equite, [
      { genre: 'organisations', titre: t('qualite.diversite.colonne.organisations'), ...equite.organisations },
      { genre: 'etiquettes', titre: t('qualite.diversite.colonne.etiquettes'), ...equite.etiquettes },
    ]);
  });

  test('rouge : le jumeau porte la soirée de chaque animateur, puis une ligne par tour animé, chacune au plus la soirée', () => {
    const detail = detailDe();
    const { lignes } = detail.animateurs.diversite;
    const modele = modeleDiversite(detail, t);
    const [jumeau] = modele.jumeau;
    assert.deepEqual(
      jumeau.colonnes.map(({ cle }) => cle),
      ['animateur', 'portee', 'toursAnimes', 'personnes', 'organisations', 'etiquettes'],
    );
    const nomDe = new Map(detail.personnes.map(({ id, nom }) => [id, nom]));
    const numeroDe = new Map(detail.idsTables.map((id, rang) => [id, detail.numerosTables[rang]]));
    const attendues = lignes.flatMap((ligne) => [
      {
        animateur: nomDe.get(ligne.id),
        portee: t('qualite.diversite.soiree'),
        toursAnimes: ligne.toursAnimes,
        personnes: ligne.personnes,
        organisations: ligne.organisations,
        etiquettes: ligne.etiquettes,
      },
      ...ligne.parTour.map((tour) => ({
        animateur: nomDe.get(ligne.id),
        portee: t('qualite.diversite.tour', { tour: tour.tour + 1, table: numeroDe.get(tour.table) }),
        toursAnimes: null,
        personnes: tour.personnes,
        organisations: tour.organisations,
        etiquettes: tour.etiquettes,
      })),
    ]);
    assert.deepEqual(jumeau.lignes, attendues);
    assert.equal(
      jumeau.lignes.length,
      lignes.reduce((somme, ligne) => somme + 1 + ligne.toursAnimes, 0),
    );
    for (const ligne of lignes) {
      assert.equal(ligne.parTour.length, ligne.toursAnimes);
      for (const tour of ligne.parTour) {
        for (const cle of ['personnes', 'organisations', 'etiquettes']) assert.ok(tour[cle] <= ligne[cle], `${ligne.id}, ${cle}`);
      }
    }
    assert.ok(attendues.some(({ portee }) => portee === t('qualite.diversite.tour', { tour: 2, table: 12 })));
    assert.deepEqual(modele.infobulle, {
      colonnes: jumeau.colonnes,
      lignes: jumeau.lignes.filter(({ portee }) => portee === t('qualite.diversite.soiree')),
    });
    const noms = [modele.barres.nom, ...modele.jumeau.map(({ nom }) => nom)];
    assert.equal(new Set(noms).size, noms.length, 'noms accessibles distincts');
  });

  test('aucune étiquette : la colonne des organisations seule, et la phrase', () => {
    const detail = detailDe({ etiquettes: false });
    assert.deepEqual(detail.animateurs.diversite.colonnes, { organisations: true, etiquettes: false });
    const modele = modeleDiversite(detail, t);
    assert.equal(modele.phrase, 'sansEtiquette');
    assert.equal(modele.barres.colonnes, null);
    assert.deepEqual(modele.barres.segments, [{ genre: 'serie1', libelle: t('qualite.diversite.colonne.organisations') }]);
    assert.deepEqual(
      modele.barres.lignes.map(({ valeurs }) => valeurs),
      detail.animateurs.diversite.lignes.map(({ organisations }) => [organisations]),
    );
    assert.deepEqual(modele.equite.map(({ genre }) => genre), ['organisations']);
    assert.equal(modele.jumeau[0].colonnes.some(({ cle }) => cle === 'etiquettes'), false);
  });

  test('une seule organisation et des étiquettes : la colonne des étiquettes seule, triée sur E_f, et la phrase', () => {
    const detail = detailDe({ organisations: false });
    assert.deepEqual(detail.animateurs.diversite.colonnes, { organisations: false, etiquettes: true });
    const modele = modeleDiversite(detail, t);
    assert.equal(modele.phrase, 'sansOrganisation');
    assert.deepEqual(modele.barres.segments, [{ genre: 'serie2', libelle: t('qualite.diversite.colonne.etiquettes') }]);
    assert.deepEqual(
      modele.barres.lignes.map(({ id, valeurs }) => [id, valeurs]),
      detail.animateurs.diversite.lignes.map(({ id, etiquettes }) => [id, [etiquettes]]),
    );
    assert.deepEqual(modele.equite.map(({ genre }) => genre), ['etiquettes']);
    assert.equal(modele.jumeau[0].colonnes.some(({ cle }) => cle === 'organisations'), false);
  });

  test('ni étiquette ni plus d’une organisation : la phrase, aucun graphique, le jumeau garde tours animés et personnes', () => {
    const detail = detailDe({ organisations: false, etiquettes: false });
    const modele = modeleDiversite(detail, t);
    assert.equal(modele.phrase, 'rien');
    assert.equal(modele.barres, null);
    assert.equal(modele.infobulle, null);
    assert.deepEqual(modele.equite, []);
    assert.deepEqual(
      modele.jumeau[0].colonnes.map(({ cle }) => cle),
      ['animateur', 'portee', 'toursAnimes', 'personnes'],
    );
  });

  test('aucun « équité », aucun « plafond », aucun pourcentage', () => {
    for (const options of [{}, { etiquettes: false }, { organisations: false }]) {
      for (const texte of textes(modeleDiversite(detailDe(options), t))) {
        assert.doesNotMatch(texte, /équité|equite|plafond|%/i, texte);
      }
    }
  });
});
