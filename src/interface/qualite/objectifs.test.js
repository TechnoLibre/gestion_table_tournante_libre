// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle de la vue des objectifs des tables (§ 12.12, B21, D34,
// D36, D52) : les personnes jamais servies, la soirée en texte, une barre
// par tour — le tour au plus grand reste en tête —, le pourcentage de chaque
// tour et ses deux comptes, ses assis sans table possible, et le jumeau.
// Chaque nombre vient du détail du placement (detaillerQualite), recoupé
// contre la ligne d'évaluation de la même proposition et contre le
// diagnostic. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { configurationDe } from '../../application/configuration.js';
import { detaillerQualite, evaluer } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { diagnostiquer } from '../../moteur/diagnostic.js';
import { rechercher } from '../../moteur/recherche.js';
import { creerCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { modeleObjectifs } from './objectifs.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const V1 = VERSION.affichee;

// Neuf personnes inventées : les sept premières portent « finance ».
const PERSONNES = [
  ['Ombrelle', 'Iris', 'Coopérative Aubier'],
  ['Pervenche', 'Théo', 'Coopérative Aubier'],
  ['Lacasse', 'Ondine', 'Atelier Ressac'],
  ['Tourteau', 'Basile', 'Atelier Ressac'],
  ['Quenouille', 'Maëlle', 'Coopérative Aubier'],
  ['Rocaille', 'Anselme', 'Atelier Ressac'],
  ['Brindille', 'Pélagie', null],
  ['Cassonade', 'Firmin', null],
  ['Grésil', 'Ysaline', 'Atelier Ressac'],
];

// n personnes, trois tables de trois places, tours tours ; la table 1 a
// l'objectif « finance » aux tours toursObjectif, aucune autre table n'en a
// — un tour hors de la liste n'a aucun couple possible. Sept personnes pour
// trois places à objectif : à chaque tour, quatre au moins restent hors
// objectif, et une au moins n'est jamais servie.
function chargeObjectifs({ n = 9, tours = 3, toursObjectif = [1, 2], respecter = true, mode = null } = {}) {
  const charge = creerCharge({ id: 'evt-objectifs', nom: 'Atelier Ressac', siegesParDefaut: 3, tours });
  charge.participants = PERSONNES.slice(0, n).map(([nom, prenom, appartenance], rang) => ({
    id: rang + 1,
    nom,
    prenom,
    appartenance,
    courriel: null,
    titrePressenti: null,
    notes: null,
    exclu: false,
    ...(rang < 7 ? { etiquettes: ['finance'] } : {}),
  }));
  charge.tables = [1, 2, 3].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 300 * id, y: 0 } }));
  charge.tables[0].objectifs = toursObjectif.map((tour) => ({ portee: 'tour', tour, regle: null, etiquettes: ['finance'] }));
  charge.prochainsIds = { participant: n + 1, table: 4, proposition: 1 };
  if (!respecter) charge.reglages.respecterObjectifs = false;
  if (mode !== null) charge.reglages.modeObjectifs = mode;
  return charge;
}

// La charge, une génération enregistrée de plus.
function generee(charge, reglages = { graine: 7, nombre: 2, arret: 200 }) {
  const configuration = configurationDe(charge);
  const propositions = rechercher(configuration, reglages);
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
}

// Le détail de la première proposition, et la charge qui le porte.
function detailDe(options) {
  const charge = generee(chargeObjectifs(options));
  const id = charge.propositions[0].id;
  return { charge, id, detail: detaillerQualite(charge, id) };
}

// Le pourcentage du § D52, recalculé ici pour l'épreuve : ⌊100 · n / d⌋,
// borné à 1 et 99 entre les bords, null à dénominateur nul.
function pourcentAttendu(n, d) {
  if (d === 0) return null;
  const brut = Math.floor((100 * n) / d);
  if (n > 0 && n < d) return Math.min(99, Math.max(1, brut));
  return brut;
}

// Le détail de la première proposition, sous une réservation ajoutée après
// la génération que son plan ne tient pas : la personne 8, sans étiquette,
// réservée au tour 1 à une table où le plan ne l'assoit pas. Hors du
// domaine des planchers (§ 12.4).
function detailHorsDomaine() {
  const charge = generee(chargeObjectifs());
  const [proposition] = charge.propositions;
  const rang = proposition.placement[0].sieges.findIndex((sieges) => !sieges.includes(8));
  const apres = structuredClone(charge);
  apres.reservations.push({ participant: 8, table: proposition.tables[rang], siege: null, portee: 'tour', tour: 1 });
  return detaillerQualite(apres, proposition.id);
}

// Une copie modifiable d'un détail.
const copie = (detail) => structuredClone(detail);

// Le détail de la première proposition quand l'objectif tient aux tours 2
// et 3 : le tour 1, sans couple possible, n'a pas de reste, et le tour de
// tête est le tour 2. Les lignes vont alors dans l'ordre [2, 1, 3], que
// l'ordre naturel des tours ne donne pas : une épreuve « dans l'ordre des
// barres » qui le lit échoue dès qu'une liste retrie ses tours.
function detailPireAuTour2() {
  const { detail } = detailDe({ toursObjectif: [2, 3] });
  assert.equal(detail.objectifs.pireTour, 1);
  return detail;
}

describe('objectifs : les cas sans vue', () => {
  test('sans personne concernée, la vue cède la place à sa phrase', () => {
    const { detail } = detailDe({ toursObjectif: [] });
    assert.equal(detail.objectifs, null);
    assert.deepEqual(modeleObjectifs(detail, t), { cas: 'aucunConcerne' });
  });

  test('sans détail mesuré, rien', () => {
    assert.equal(modeleObjectifs(null, t), null);
  });
});

describe('objectifs : les barres par tour (§ 12.12, B21, D36)', () => {
  test('une barre par tour, aucune pour la soirée ; le tour au plus grand reste en tête, les autres dans leur ordre', () => {
    const { detail } = detailDe();
    const modele = modeleObjectifs(detail, t);
    assert.equal(modele.cas, 'objectifs');
    assert.equal(modele.barres.lignes.length, detail.R);
    const restes = detail.objectifs.parTour.map((tour) => (tour.possibles === 0 ? -Infinity : tour.hors - tour.plancher));
    const pire = restes.indexOf(Math.max(...restes));
    assert.equal(detail.objectifs.pireTour, pire);
    const autres = detail.objectifs.parTour.map((_, r) => r + 1).filter((tour) => tour !== pire + 1);
    assert.deepEqual(
      modele.barres.lignes.map(({ id }) => id),
      [pire + 1, ...autres],
    );
    assert.deepEqual(
      modele.barres.lignes.map(({ nom }) => nom),
      [pire + 1, ...autres].map((tour) => t('qualite.objectifs.tour', { tour })),
    );
  });

  test('rouge : la première barre suit pireTour du détail, jamais le premier tour par défaut', () => {
    const { detail } = detailDe();
    const forge = copie(detail);
    forge.objectifs.pireTour = 1;
    assert.deepEqual(
      modeleObjectifs(forge, t).barres.lignes.map(({ id }) => id),
      [2, 1, 3],
    );
    forge.objectifs.pireTour = 2;
    forge.objectifs.parTour[2] = { ...forge.objectifs.parTour[0] };
    assert.deepEqual(
      modeleObjectifs(forge, t).barres.lignes.map(({ id }) => id),
      [3, 1, 2],
    );
  });

  test('deux segments, prouvé inévitable puis reste, le plancher du tour et le reste ; aucune couleur propre à un tour', () => {
    const { detail } = detailDe();
    const modele = modeleObjectifs(detail, t);
    assert.deepEqual(modele.barres.segments, [
      { genre: 'prouve', libelle: t('qualite.objectifs.segment.prouve') },
      { genre: 'reste', libelle: t('qualite.objectifs.segment.reste') },
    ]);
    for (const ligne of modele.barres.lignes) {
      const tour = detail.objectifs.parTour[ligne.id - 1];
      if (tour.possibles === 0) continue;
      assert.equal(tour.reste, tour.hors - tour.plancher, `tour ${ligne.id}`);
      assert.deepEqual(ligne.valeurs, [tour.plancher, tour.reste], `tour ${ligne.id}`);
      assert.equal(Object.hasOwn(ligne, 'appartenance'), false, `tour ${ligne.id} : aucune pastille`);
    }
  });

  test('rouge : le reste d’une barre est celui que le détail porte, lu sans soustraction', () => {
    const detail = structuredClone(detailDe().detail);
    const tour = detail.objectifs.parTour[0];
    tour.reste = tour.hors + 7;
    const ligne = modeleObjectifs(detail, t).barres.lignes.find(({ id }) => id === 1);
    assert.deepEqual(ligne.valeurs, [tour.plancher, tour.hors + 7]);
  });

  test('un tour sans couple possible écrit « — », sans barre ni pourcentage, et garde ses assis sans table possible', () => {
    const { detail } = detailDe();
    const tour3 = detail.objectifs.parTour[2];
    assert.equal(tour3.possibles, 0);
    assert.equal(tour3.sansCouple, 9);
    const modele = modeleObjectifs(detail, t);
    const ligne = modele.barres.lignes.find(({ id }) => id === 3);
    assert.deepEqual(ligne.valeurs, [0, 0]);
    assert.equal(ligne.secondaire, t('qualite.objectifs.secondaireSansCouple', { assis: 9 }));
    assert.ok(ligne.secondaire.startsWith(t('format.vide')), ligne.secondaire);
    const parTour = modele.tours.find(({ tour }) => tour === 3);
    assert.deepEqual(parTour.pourcentage, { texte: null, compte: t('qualite.objectifs.sansCouple') });
  });

  test('chaque ligne écrit ses assis sans table possible, qui égalent sansCouple', () => {
    const { detail } = detailDe();
    const modele = modeleObjectifs(detail, t);
    for (const ligne of modele.barres.lignes) {
      const { possibles, sansCouple } = detail.objectifs.parTour[ligne.id - 1];
      const cle = possibles === 0 ? 'qualite.objectifs.secondaireSansCouple' : 'qualite.objectifs.assisSansTable';
      assert.equal(ligne.secondaire, t(cle, { assis: sansCouple }), `tour ${ligne.id}`);
    }
    assert.deepEqual(
      detail.objectifs.parTour.map(({ sansCouple }) => sansCouple),
      [2, 2, 9],
    );
  });

  test('le pourcentage de chaque tour : ses servis sur ses possibles seuls, suivi de ses deux comptes, dans l’ordre des barres', () => {
    const detail = detailPireAuTour2();
    const modele = modeleObjectifs(detail, t);
    assert.deepEqual(
      modele.barres.lignes.map(({ id }) => id),
      [2, 1, 3],
    );
    assert.deepEqual(
      modele.tours.map(({ tour }) => tour),
      [2, 1, 3],
    );
    for (const { tour, nom, pourcentage } of modele.tours) {
      const { possibles, servis, pourcent } = detail.objectifs.parTour[tour - 1];
      assert.equal(nom, t('qualite.objectifs.tour', { tour }));
      if (possibles === 0) continue;
      assert.equal(pourcent, pourcentAttendu(servis, possibles), `tour ${tour}`);
      assert.deepEqual(pourcentage, {
        texte: t('qualite.pourcentage.valeur', { pourcent }),
        compte: t('qualite.objectifs.comptes', { servis, possibles }),
      });
    }
  });

  test('la phrase de synthèse nomme le tour de tête, son reste, puis ses tours hors objectif', () => {
    const { detail } = detailDe();
    const { pireTour, parTour } = detail.objectifs;
    const { reste, hors } = parTour[pireTour];
    assert.deepEqual([pireTour, reste, hors], [0, 1, 5]);
    const synthese = modeleObjectifs(detail, t).barres.synthese;
    assert.equal(synthese, t('qualite.objectifs.synthese', { tour: 1, reste, hors }));
    assert.equal(synthese, 'En tête, le tour 1, au plus grand reste : 1 au-delà de son plancher, sur 5 tours hors objectif.');
  });

  test('hors du domaine des planchers, la phrase de synthèse ne parle plus de reste', () => {
    const detail = detailHorsDomaine();
    const { pireTour, parTour } = detail.objectifs;
    const synthese = modeleObjectifs(detail, t).barres.synthese;
    assert.equal(synthese, t('qualite.objectifs.syntheseHorsDomaine', { tour: pireTour + 1, hors: parTour[pireTour].hors }));
    assert.doesNotMatch(synthese, /reste|plancher/);
  });
});

describe('objectifs : les personnes jamais servies et la soirée', () => {
  test('les jamais servies, nommées, chacune avec ses tours possibles, dans l’ordre du détail', () => {
    const { detail } = detailDe();
    const modele = modeleObjectifs(detail, t);
    assert.ok(detail.objectifs.jamaisServies.length >= 1);
    assert.deepEqual(
      modele.jamaisServies,
      detail.objectifs.jamaisServies.map(({ id, possibles }) => ({
        id,
        nom: detail.personnes.find((personne) => personne.id === id).nom,
        possibles: t('qualite.objectifs.toursPossibles', { possibles }),
      })),
    );
  });

  test('la soirée : Σ servis sur Σ possibles, suivie des jamais servies, puis ses deux comptes, hors objectif et plancher', () => {
    const { detail } = detailDe();
    const { parTour, soiree, jamaisServies } = detail.objectifs;
    const servis = parTour.reduce((somme, tour) => somme + (tour.servis ?? 0), 0);
    const possibles = parTour.reduce((somme, tour) => somme + tour.possibles, 0);
    assert.deepEqual([soiree.servis, soiree.possibles], [servis, possibles]);
    const modele = modeleObjectifs(detail, t);
    assert.deepEqual(modele.soiree, {
      pourcentage: {
        texte: t('qualite.pourcentage.servis', { pourcent: pourcentAttendu(servis, possibles) }),
        compte: t('qualite.objectifs.pire', { personnes: jamaisServies.length }),
      },
      comptes: t('qualite.objectifs.comptes', { servis, possibles }),
      hors: t('qualite.objectifs.horsObjectif', { hors: soiree.hors, plancher: soiree.plancher }),
    });
  });

  test('R = 1 : aucune ligne de soirée, ni au texte ni au jumeau', () => {
    const { detail } = detailDe({ tours: 1, toursObjectif: [1] });
    assert.equal(detail.R, 1);
    const modele = modeleObjectifs(detail, t);
    assert.equal(modele.soiree, null);
    assert.deepEqual(
      modele.jumeau[0].lignes.map(({ tour }) => tour),
      [t('qualite.objectifs.tour', { tour: 1 })],
    );
  });
});

describe('objectifs : recoupements avec le tableau des propositions et le diagnostic', () => {
  test('possibles − servis de la soirée = tours hors objectif de la ligne ; jamais servies = sa colonne ; Σ planchers des tours = plancher du diagnostic', () => {
    const { charge, id, detail } = detailDe({ mode: 'chacun' });
    const ligne = evaluer(charge).propositions.find((element) => element.id === id);
    const { soiree, parTour, jamaisServies } = detail.objectifs;
    assert.equal(soiree.possibles - soiree.servis, ligne.mesures.objectifs.horsObjectif);
    assert.equal(jamaisServies.length, ligne.mesures.objectifs.jamaisServies);
    assert.equal(detail.bornes.soiree.jamaisServies, ligne.mesures.objectifs.jamaisServies);
    const diagnostic = diagnostiquer(configurationDe(charge));
    const somme = parTour.reduce((total, tour) => total + (tour.plancher ?? 0), 0);
    assert.equal(somme, diagnostic.objectifsInevitables.horsObjectif);
    assert.equal(somme, 8);
    const modele = modeleObjectifs(detail, t);
    assert.equal(
      modele.soiree.hors,
      t('qualite.objectifs.horsObjectif', { hors: ligne.mesures.objectifs.horsObjectif, plancher: diagnostic.objectifsInevitables.horsObjectif }),
    );
    assert.equal(modele.soiree.pourcentage.compte, t('qualite.objectifs.pire', { personnes: ligne.mesures.objectifs.jamaisServies }));
  });
});

describe('objectifs : le critère décoché et le domaine des planchers (§ 12.4, B15)', () => {
  test('critère décoché : la vue dit qu’il ne classe pas, et les planchers se dessinent quand même', () => {
    const { detail } = detailDe({ respecter: false });
    assert.deepEqual(detail.objectifs.critere, { coche: false, sansObjet: false });
    const modele = modeleObjectifs(detail, t);
    assert.equal(modele.neClassePas, true);
    assert.deepEqual(
      modele.barres.segments.map(({ genre }) => genre),
      ['prouve', 'reste'],
    );
    assert.ok(modele.barres.lignes.some(({ valeurs }) => valeurs[0] > 0));
    assert.equal(modeleObjectifs(detailDe().detail, t).neClassePas, false);
  });

  test('hors du domaine des planchers : un seul segment, les tours hors objectif, et ni plancher ni reste', () => {
    const detail = detailHorsDomaine();
    assert.equal(detail.statut, 'comparable');
    assert.equal(detail.collisions.planchersValides, false);
    const modele = modeleObjectifs(detail, t);
    assert.equal(modele.planchersValides, false);
    assert.deepEqual(modele.barres.segments, [{ genre: 'serie1', libelle: t('qualite.objectifs.segment.hors') }]);
    for (const ligne of modele.barres.lignes) {
      const tour = detail.objectifs.parTour[ligne.id - 1];
      assert.deepEqual(ligne.valeurs, [tour.possibles === 0 ? 0 : tour.hors], `tour ${ligne.id}`);
    }
    assert.equal(modele.soiree.hors, t('qualite.objectifs.hors', { hors: detail.objectifs.soiree.hors }));
    for (const rangee of modele.jumeau[0].lignes) assert.equal(rangee.plancher, null);
  });
});

describe('objectifs : le jumeau et l’infobulle (§ 12.7, B21)', () => {
  test('une ligne par tour dans l’ordre des barres, puis la soirée ; possibles, servis, pourcentage suivi du compte de la ligne, hors, plancher, assis', () => {
    const detail = detailPireAuTour2();
    const modele = modeleObjectifs(detail, t);
    const [tours, jamais, repartition] = modele.jumeau;
    assert.deepEqual(
      tours.colonnes.map(({ cle, genre }) => [cle, genre]),
      [
        ['tour', 'texte'],
        ['possibles', 'nombre'],
        ['servis', 'nombre'],
        ['pourcent', 'pourcentage'],
        ['hors', 'nombre'],
        ['plancher', 'nombre'],
        ['assis', 'nombre'],
      ],
    );
    const ordre = modele.barres.lignes.map(({ id }) => id);
    assert.deepEqual(ordre, [2, 1, 3]);
    assert.deepEqual(
      tours.lignes.map(({ tour }) => tour),
      [...ordre.map((tour) => t('qualite.objectifs.tour', { tour })), t('qualite.objectifs.soiree')],
    );
    ordre.forEach((numero, i) => {
      const tour = detail.objectifs.parTour[numero - 1];
      const rangee = tours.lignes[i];
      assert.deepEqual(
        [rangee.possibles, rangee.servis, rangee.hors, rangee.plancher, rangee.assis],
        [tour.possibles, tour.servis, tour.hors, tour.plancher, tour.sansCouple],
      );
      assert.deepEqual(rangee.pourcent, modele.tours[i].pourcentage);
    });
    const { soiree } = detail.objectifs;
    const derniere = tours.lignes.at(-1);
    assert.deepEqual(
      [derniere.possibles, derniere.servis, derniere.hors, derniere.plancher, derniere.assis],
      [soiree.possibles, soiree.servis, soiree.hors, soiree.plancher, null],
    );
    assert.deepEqual(derniere.pourcent, {
      texte: t('qualite.pourcentage.valeur', { pourcent: soiree.pourcent }),
      compte: t('qualite.objectifs.comptes', { servis: soiree.servis, possibles: soiree.possibles }),
    });
    assert.deepEqual(
      jamais.lignes.map(({ nom, possibles }) => [nom, possibles]),
      modele.jamaisServies.map(({ id }) => [
        detail.personnes.find((personne) => personne.id === id).nom,
        detail.objectifs.jamaisServies.find((element) => element.id === id).possibles,
      ]),
    );
    assert.deepEqual(
      repartition.lignes,
      detail.objectifs.repartition.map(({ valeur, effectif }) => ({ valeur, effectif })),
    );
    const noms = modele.jumeau.map(({ nom }) => nom);
    assert.equal(new Set([...noms, modele.barres.nom]).size, noms.length + 1, 'noms accessibles distincts');
  });

  test('l’infobulle porte la ligne du jumeau de chaque barre, dans l’ordre des barres', () => {
    const detail = detailPireAuTour2();
    const modele = modeleObjectifs(detail, t);
    assert.deepEqual(modele.infobulle.colonnes, modele.jumeau[0].colonnes);
    assert.deepEqual(
      modele.infobulle.lignes.map(({ tour }) => tour),
      [2, 1, 3].map((tour) => t('qualite.objectifs.tour', { tour })),
    );
    assert.deepEqual(modele.infobulle.lignes, modele.jumeau[0].lignes.slice(0, detail.R));
  });

  test('aucune personne jamais servie : le jumeau n’a pas de table vide pour elles', () => {
    const { detail } = detailDe();
    const forge = copie(detail);
    forge.objectifs.jamaisServies = [];
    const modele = modeleObjectifs(forge, t);
    assert.deepEqual(modele.jamaisServies, []);
    assert.deepEqual(
      modele.jumeau.map(({ nom }) => nom),
      [t('qualite.objectifs.jumeau.tours'), t('qualite.objectifs.repartition.titre')],
    );
  });
});
