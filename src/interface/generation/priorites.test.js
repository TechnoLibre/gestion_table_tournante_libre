// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du modèle de l'éditeur de l'ordre des priorités (§ 5.3, § 5.7,
// A11, A12, D8, D23) : l'ordre du registre et l'ordre par défaut, lus par
// l'application et égaux à ceux du registre ; les quatre gestes, chacun
// sur la liste qu'il écrit, rangée ; les gestes offerts, exactement ceux
// dont la liste est valide sous le mode — jamais l'écart ni les rencontres
// répétées dans un palier partagé, ni les tours hors objectif sous
// « chacun » et « minimum » — ; l'admission par la commande, égale à la
// validation du registre ; l'état des critères, lu dans la table
// d'évaluation, jamais recalculé — la garde des sources qui le tient vit
// dans test/sources_interface.test.js ; l'explication de chaque critère,
// une clé generation.priorites.explication.<nom> par nom complet
// mobilier.critere.<nom>, et réciproquement. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { evaluer } from '../../application/evaluation.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { CRITERES, MODES_OBJECTIFS, PRIORITES_PAR_DEFAUT, verifierPriorites } from '../../moteur/criteres.js';
import { rechercher } from '../../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge, priorites } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  CRITERES_DU_REGISTRE,
  GESTES,
  LISTE_PAR_DEFAUT,
  admissionSous,
  avecPoids,
  etatAffiche,
  etatsDesCriteres,
  gestesOfferts,
  listeApres,
  placeDe,
} from './priorites.js';

const [ECART, EXCEDENT, CUMULEES, HORS_OBJECTIF, REPETEES, ANIMATEURS, REDONDANCE, CONFLITS, INCLUSIONS] = CRITERES;

// Une liste écrite palier par palier : chaque palier, ses critères et leurs
// poids, [nom, poids] ou nom seul au poids 1.
const liste = (...paliers) =>
  paliers.map((palier) => palier.map((e) => (Array.isArray(e) ? { critere: e[0], poids: e[1] } : { critere: e, poids: 1 })));

// La liste par défaut, copiée.
const parDefaut = () => structuredClone(LISTE_PAR_DEFAUT);

// L'admission du registre sous un mode, qui sert d'oracle aux épreuves.
const admiseSous = (mode) => (candidate) => verifierPriorites(candidate, mode) === null;

// Les listes atteintes depuis l'ordre par défaut en au plus profondeur
// gestes admis sous le mode, sans doublon, dans l'ordre de leur découverte.
function atteintes(mode, profondeur) {
  const vues = new Map([[JSON.stringify(parDefaut()), parDefaut()]]);
  let front = [parDefaut()];
  for (let pas = 0; pas < profondeur; pas += 1) {
    const suivant = [];
    for (const courante of front) {
      for (const critere of CRITERES) {
        for (const geste of GESTES) {
          const apres = listeApres(courante, geste, critere);
          if (apres === null || !admiseSous(mode)(apres)) continue;
          const cle = JSON.stringify(apres);
          if (vues.has(cle)) continue;
          vues.set(cle, apres);
          suivant.push(apres);
        }
      }
    }
    front = suivant;
  }
  return [...vues.values()];
}

describe('l’ordre du registre et l’ordre par défaut, lus par l’application (§ 5.7, D11)', () => {
  test('les critères dans l’ordre du registre, et l’ordre par défaut : chacun seul à son palier, au poids 1, figés', () => {
    assert.deepEqual([...CRITERES_DU_REGISTRE], [...CRITERES]);
    assert.deepEqual(
      LISTE_PAR_DEFAUT,
      liste([CONFLITS], [INCLUSIONS], [EXCEDENT], [REPETEES], [CUMULEES], [ECART], [HORS_OBJECTIF], [ANIMATEURS], [REDONDANCE]),
    );
    assert.deepEqual(LISTE_PAR_DEFAUT, structuredClone(PRIORITES_PAR_DEFAUT));
    assert.deepEqual(LISTE_PAR_DEFAUT, priorites({ reglages: {} }));
    assert.ok(Object.isFrozen(CRITERES_DU_REGISTRE) && Object.isFrozen(LISTE_PAR_DEFAUT));
    assert.ok(LISTE_PAR_DEFAUT.every((palier) => Object.isFrozen(palier) && palier.every(Object.isFrozen)));
  });

  test('placeDe : l’index du palier, le nombre de paliers et les compagnons du critère', () => {
    const l = liste([ECART], [EXCEDENT, [CUMULEES, 3]], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS, REDONDANCE]);
    assert.deepEqual(placeDe(l, CUMULEES), { palier: 1, paliers: 5, avec: [EXCEDENT] });
    assert.deepEqual(placeDe(l, REPETEES), { palier: 3, paliers: 5, avec: [] });
    assert.throws(() => placeDe(l, 'constructor'), RangeError);
  });
});

describe('les quatre gestes : la liste que chacun écrit (§ 5.7, A12)', () => {
  test('monter et descendre échangent le palier du critère avec son voisin, compagnons compris ; aux bords, aucun geste', () => {
    const l = liste([ECART], [EXCEDENT, [CUMULEES, 3]], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [REDONDANCE]);
    assert.deepEqual(
      listeApres(l, 'monterCritere', CUMULEES),
      liste([EXCEDENT, [CUMULEES, 3]], [ECART], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [REDONDANCE]),
    );
    assert.deepEqual(
      listeApres(l, 'descendreCritere', HORS_OBJECTIF),
      liste([ECART], [EXCEDENT, [CUMULEES, 3]], [REPETEES], [HORS_OBJECTIF], [ANIMATEURS], [REDONDANCE]),
    );
    assert.equal(listeApres(l, 'monterCritere', ECART), null);
    assert.equal(listeApres(l, 'descendreCritere', REDONDANCE), null);
  });

  test('joindre : le critère rejoint le palier du dessus, rangé dans l’ordre du registre, au poids 1 ; un palier vidé disparaît', () => {
    const l = parDefaut();
    // La redondance rejoint les animateurs : huit paliers, le dernier rangé.
    assert.deepEqual(
      listeApres(l, 'joindrePalier', REDONDANCE),
      liste([CONFLITS], [INCLUSIONS], [EXCEDENT], [REPETEES], [CUMULEES], [ECART], [HORS_OBJECTIF], [ANIMATEURS, REDONDANCE]),
    );
    // Un critère d'un palier partagé le quitte seul ; son ancien compagnon,
    // seul désormais, revient au poids 1.
    const partage = liste([ECART], [REPETEES], [EXCEDENT], [[CUMULEES, 4], [HORS_OBJECTIF, 7]], [ANIMATEURS], [REDONDANCE]);
    assert.deepEqual(
      listeApres(partage, 'joindrePalier', HORS_OBJECTIF),
      liste([ECART], [REPETEES], [EXCEDENT, HORS_OBJECTIF], [CUMULEES], [ANIMATEURS], [REDONDANCE]),
    );
    // Le palier rejoint se range : le critère joint y prend son rang du
    // registre, devant un critère qui le suit.
    assert.deepEqual(
      listeApres(liste([ECART], [REPETEES], [REDONDANCE], [EXCEDENT], [CUMULEES], [HORS_OBJECTIF], [ANIMATEURS]), 'joindrePalier', EXCEDENT),
      liste([ECART], [REPETEES], [EXCEDENT, REDONDANCE], [CUMULEES], [HORS_OBJECTIF], [ANIMATEURS]),
    );
    assert.equal(listeApres(l, 'joindrePalier', CONFLITS), null);
  });

  test('séparer : le critère quitte son palier partagé pour un palier à lui, juste dessous ; seul, aucun geste', () => {
    const partage = liste([ECART], [[EXCEDENT, 2], [CUMULEES, 5], [HORS_OBJECTIF, 9]], [REPETEES], [ANIMATEURS], [REDONDANCE]);
    assert.deepEqual(
      listeApres(partage, 'separerPalier', CUMULEES),
      liste([ECART], [[EXCEDENT, 2], [HORS_OBJECTIF, 9]], [CUMULEES], [REPETEES], [ANIMATEURS], [REDONDANCE]),
    );
    const deux = liste([CONFLITS], [INCLUSIONS], [EXCEDENT], [REPETEES], [CUMULEES], [ECART], [[HORS_OBJECTIF, 2], [ANIMATEURS, 5]], [REDONDANCE]);
    assert.deepEqual(listeApres(deux, 'separerPalier', ANIMATEURS), parDefaut());
    // Séparé, le premier passe sous son ancien compagnon.
    assert.deepEqual(
      listeApres(deux, 'separerPalier', HORS_OBJECTIF),
      liste([CONFLITS], [INCLUSIONS], [EXCEDENT], [REPETEES], [CUMULEES], [ECART], [ANIMATEURS], [HORS_OBJECTIF], [REDONDANCE]),
    );
    assert.equal(listeApres(parDefaut(), 'separerPalier', EXCEDENT), null);
  });

  test('chaque liste écrite range chaque palier dans l’ordre du registre, poids 1 pour un critère seul ; la liste reçue ne change pas', () => {
    const partage = liste([ECART], [[REDONDANCE, 6], [EXCEDENT, 2]], [CUMULEES], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [CONFLITS], [INCLUSIONS]);
    const avant = structuredClone(partage);
    for (const critere of CRITERES) {
      for (const geste of GESTES) {
        const apres = listeApres(partage, geste, critere);
        if (apres === null) continue;
        for (const palier of apres) {
          const rangs = palier.map(({ critere: nom }) => CRITERES.indexOf(nom));
          assert.deepEqual(rangs, [...rangs].sort((a, b) => a - b), `${geste} ${critere}`);
          if (palier.length === 1) assert.equal(palier[0].poids, 1, `${geste} ${critere}`);
        }
        assert.deepEqual(apres.flat().map(({ critere: nom }) => nom).sort(), [...CRITERES].sort());
      }
    }
    assert.deepEqual(partage, avant);
  });

  test('un geste inconnu ou un critère inconnu lèvent', () => {
    assert.throws(() => listeApres(parDefaut(), 'glisserCritere', EXCEDENT), RangeError);
    assert.throws(() => listeApres(parDefaut(), 'monterCritere', '__proto__'), RangeError);
  });

  test('avecPoids : le poids du seul critère nommé change, la liste reçue non', () => {
    const l = liste([ECART], [EXCEDENT, [CUMULEES, 3]], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [REDONDANCE]);
    const avant = structuredClone(l);
    assert.deepEqual(avecPoids(l, CUMULEES, 40), liste([ECART], [EXCEDENT, [CUMULEES, 40]], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [REDONDANCE]));
    assert.deepEqual(l, avant);
  });
});

describe('les gestes offerts (§ 5.7, A12, D8, D23)', () => {
  test('rouge : « joindre » n’est jamais offert à l’écart, ni aux rencontres répétées, ni au critère qui suit l’un ou l’autre', () => {
    for (const mode of MODES_OBJECTIFS) {
      const l = parDefaut();
      assert.ok(!gestesOfferts(l, ECART, admiseSous(mode)).includes('joindrePalier'), mode);
      assert.ok(!gestesOfferts(l, REPETEES, admiseSous(mode)).includes('joindrePalier'), mode);
      // Les collisions cumulées suivent les rencontres répétées, les tours
      // hors objectif suivent l'écart : les joindre partagerait le palier de
      // l'un ou de l'autre.
      assert.ok(!gestesOfferts(l, CUMULEES, admiseSous(mode)).includes('joindrePalier'), mode);
      assert.ok(!gestesOfferts(l, HORS_OBJECTIF, admiseSous(mode)).includes('joindrePalier'), mode);
      // La redondance suit les animateurs, qui partagent leur palier.
      assert.ok(gestesOfferts(l, REDONDANCE, admiseSous(mode)).includes('joindrePalier'), mode);
      // Le conflit d'organisation et les inclusions sont seuls à leur
      // palier, et l'excédent les suit : aucun des trois ne se joint.
      assert.ok(!gestesOfferts(l, CONFLITS, admiseSous(mode)).includes('joindrePalier'), mode);
      assert.ok(!gestesOfferts(l, INCLUSIONS, admiseSous(mode)).includes('joindrePalier'), mode);
      assert.ok(!gestesOfferts(l, EXCEDENT, admiseSous(mode)).includes('joindrePalier'), mode);
      assert.ok(gestesOfferts(l, CONFLITS, admiseSous(mode)).includes('descendreCritere'), mode);
      assert.ok(gestesOfferts(l, INCLUSIONS, admiseSous(mode)).includes('monterCritere'), mode);
    }
  });

  test('rouge : « joindre » n’est pas offert aux tours hors objectif sous « chacun » et « minimum », ni au critère qui les suit ; sous « places », il l’est', () => {
    const l = liste([ECART], [EXCEDENT], [CUMULEES], [HORS_OBJECTIF], [ANIMATEURS], [REPETEES], [REDONDANCE], [CONFLITS], [INCLUSIONS]);
    for (const mode of ['chacun', 'minimum']) {
      assert.ok(!gestesOfferts(l, HORS_OBJECTIF, admiseSous(mode)).includes('joindrePalier'), mode);
      assert.ok(!gestesOfferts(l, ANIMATEURS, admiseSous(mode)).includes('joindrePalier'), mode);
    }
    assert.ok(gestesOfferts(l, HORS_OBJECTIF, admiseSous('places')).includes('joindrePalier'));
    assert.ok(gestesOfferts(l, ANIMATEURS, admiseSous('places')).includes('joindrePalier'));
  });

  test('sous chaque mode, sur chaque liste atteinte en trois gestes, un geste est offert exactement quand il s’applique et que sa liste est valide', () => {
    for (const mode of MODES_OBJECTIFS) {
      const admet = admiseSous(mode);
      const listes = atteintes(mode, 3);
      assert.ok(listes.length > 100, `${mode} : ${listes.length} listes`);
      for (const courante of listes) {
        assert.equal(verifierPriorites(courante, mode), null);
        for (const critere of CRITERES) {
          const offerts = gestesOfferts(courante, critere, admet);
          const attendus = GESTES.filter((geste) => {
            const apres = listeApres(courante, geste, critere);
            return apres !== null && verifierPriorites(apres, mode) === null;
          });
          assert.deepEqual(offerts, attendus, `${mode} ${critere} ${JSON.stringify(courante)}`);
        }
      }
    }
  });

  test('sous chaque mode, sur chaque liste atteinte en deux gestes, un geste offert se défait par son inverse, offert, qui rend la liste de départ', () => {
    // L'inverse de chaque geste : monter et descendre l'un de l'autre ;
    // séparer par joindre ; joindre par séparer, pour un critère seul à son
    // palier — joint depuis un palier partagé, il laisse ses compagnons
    // dans un palier à eux, que séparer ne rejoint pas.
    const INVERSES = new Map([
      ['monterCritere', 'descendreCritere'],
      ['descendreCritere', 'monterCritere'],
      ['joindrePalier', 'separerPalier'],
      ['separerPalier', 'joindrePalier'],
    ]);
    let defaits = 0;
    for (const mode of MODES_OBJECTIFS) {
      const admet = admiseSous(mode);
      for (const depart of atteintes(mode, 2)) {
        for (const critere of CRITERES) {
          const seul = placeDe(depart, critere).avec.length === 0;
          for (const geste of gestesOfferts(depart, critere, admet)) {
            if (geste === 'joindrePalier' && !seul) continue;
            const apres = listeApres(depart, geste, critere);
            const inverse = INVERSES.get(geste);
            const message = `${mode} ${geste} ${critere} ${JSON.stringify(depart)}`;
            assert.ok(gestesOfferts(apres, critere, admet).includes(inverse), message);
            assert.deepEqual(listeApres(apres, inverse, critere), depart, message);
            defaits += 1;
          }
        }
      }
    }
    assert.ok(defaits > 1000, `${defaits} gestes défaits`);
    // Un poids réglé se garde quand monter puis descendre déplacent le palier.
    const l = liste([ECART], [EXCEDENT, [CUMULEES, 3]], [HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [REDONDANCE]);
    assert.deepEqual(listeApres(listeApres(l, 'monterCritere', HORS_OBJECTIF), 'descendreCritere', HORS_OBJECTIF), l);
  });
});

describe('l’admission par la commande de l’application (§ 5.9, contrainte 35)', () => {
  // Les réglages d'un événement neuf, sous le mode et l'ordre donnés.
  const reglagesSous = (mode, ordre) => {
    const { reglages } = creerCharge({ id: 'evt-priorites', nom: 'Soirée des Merles', siegesParDefaut: 6, tours: 3 });
    if (mode !== 'places') reglages.modeObjectifs = mode;
    if (ordre !== null) reglages.priorites = ordre;
    return reglages;
  };

  test('sous chaque mode, la commande admet exactement les listes que le registre valide, sur chaque geste de chaque liste atteinte en un geste', () => {
    for (const mode of MODES_OBJECTIFS) {
      for (const courante of atteintes(mode, 1)) {
        const admet = admissionSous(reglagesSous(mode, courante));
        for (const critere of CRITERES) {
          for (const geste of GESTES) {
            const apres = listeApres(courante, geste, critere);
            if (apres === null) continue;
            assert.equal(admet(apres), verifierPriorites(apres, mode) === null, `${mode} ${geste} ${critere}`);
          }
        }
      }
    }
  });

  test('un poids hors domaine n’est pas admis ; la liste courante l’est ; les réglages reçus ne changent pas', () => {
    const reglages = reglagesSous('places', null);
    const avant = structuredClone(reglages);
    const admet = admissionSous(reglages);
    const deux = listeApres(parDefaut(), 'joindrePalier', REDONDANCE);
    assert.equal(admet(avecPoids(deux, REDONDANCE, 0)), false);
    assert.equal(admet(avecPoids(deux, REDONDANCE, 101)), false);
    assert.equal(admet(avecPoids(deux, REDONDANCE, 100)), true);
    assert.equal(admet(parDefaut()), true);
    assert.deepEqual(reglages, avant);
  });
});

describe('l’état des critères, lu dans la table d’évaluation (§ 5.3, A8, D10)', () => {
  // Un événement de trois personnes inventées et une table de six places.
  function chargeTrois() {
    let charge = creerCharge({ id: 'evt-etat', nom: 'Soirée des Merles', siegesParDefaut: 6, tours: 2 });
    for (const [nom, prenom] of [['Ombrelle', 'Iris'], ['Pervenche', 'Théo'], ['Lacasse', 'Ondine']]) {
      charge = appliquerCommande('ajouterParticipant', charge, { champs: { nom, prenom } }).charge;
    }
    return appliquerCommande('creerTable', charge, { forme: 'ronde' }).charge;
  }

  test('etatsDesCriteres rend, par nom, l’état que la table d’évaluation porte, propositions comprises ou non', () => {
    const charge = chargeTrois();
    const etats = etatsDesCriteres(charge);
    assert.deepEqual([...etats.keys()], [...CRITERES]);
    assert.deepEqual([...etats.values()], evaluer(charge).criteres);
    assert.equal(etatAffiche(etats.get(HORS_OBJECTIF)), 'sansObjet');
    assert.equal(etatAffiche(etats.get(ANIMATEURS)), 'decoche');
    assert.equal(etatAffiche(etats.get(EXCEDENT)), null);
    const decochee = appliquerCommande('modifierReglage', charge, { cle: 'respecterObjectifs', valeur: false }).charge;
    assert.equal(etatAffiche(etatsDesCriteres(decochee).get(HORS_OBJECTIF)), 'decoche');
    assert.equal(etatAffiche(undefined), null);
    // Avec des propositions : l'état de la table qui les mesure.
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 3, nombre: 2, arret: 50, historique: 10 });
    const generee = appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
    assert.equal(generee.propositions.length, 2);
    assert.deepEqual([...etatsDesCriteres(generee).values()], evaluer(generee).criteres);
  });

  test('une configuration que la mesure refuse, par un code, ne donne aucun état', () => {
    const charge = chargeTrois();
    charge.reglages.modeObjectifs = 'minimum';
    charge.reglages.priorites = liste([ECART], [EXCEDENT], [CUMULEES, HORS_OBJECTIF], [REPETEES], [ANIMATEURS], [REDONDANCE]);
    assert.equal(etatsDesCriteres(charge), null);
  });
});

describe('l’explication de chaque critère, l’infobulle de son nom (§ 5.7, § 14.5)', () => {
  const { t, cles } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
  // Les noms de critère que portent les clés d'un préfixe, triés.
  const nomsSous = (prefixe) =>
    cles()
      .filter((cle) => cle.startsWith(prefixe))
      .map((cle) => cle.slice(prefixe.length))
      .sort();

  test('chaque nom complet mobilier.critere.<nom> a son explication generation.priorites.explication.<nom>, et réciproquement ; ce sont les critères du registre', () => {
    const noms = nomsSous('mobilier.critere.');
    assert.deepEqual(nomsSous('generation.priorites.explication.'), noms);
    assert.deepEqual(noms, [...CRITERES_DU_REGISTRE].sort());
    assert.equal(noms.length, 9);
  });

  test('chaque explication est un texte à elle, de deux phrases au moins, sans le mot que seul le libellé d’un mode porte (D22)', () => {
    const textes = CRITERES_DU_REGISTRE.map((nom) => t(`generation.priorites.explication.${nom}`));
    assert.equal(new Set(textes).size, textes.length);
    textes.forEach((texte, rang) => {
      const nom = CRITERES_DU_REGISTRE[rang];
      assert.equal(typeof texte, 'string', nom);
      assert.ok((texte.match(/[.!?](?:\s|$)/g) ?? []).length >= 2, `${nom} : ${texte}`);
      assert.doesNotMatch(texte, /équité/i, nom);
    });
  });

  // Les colonnes des propositions qui montrent chaque critère : sa propre
  // colonne, sauf l'écart (la colonne de l'écart a priori), la redondance (la
  // colonne de la somme), les tours hors objectif (une colonne par mode des
  // objectifs) et les rencontres répétées (deux colonnes, l'une quand
  // « Nouveaux voisins à chaque tour » est cochée, l'autre sinon).
  const COLONNES_DU_CRITERE = new Map([
    ['ecartAuPlafondAPrioriMax', ['ecartAuPlafondAPriori']],
    ['excedentCollisions', ['excedentCollisions']],
    ['collisionsCumulees', ['collisionsCumulees']],
    ['toursHorsObjectif', ['toursHorsObjectif', 'jamaisServies', 'horsObjectifMax']],
    ['rencontresRepetees', ['rencontresRepetees', 'retoursChoisis']],
    ['animateursNonRencontres', ['animateursNonRencontres']],
    ['redondance', ['totalRedondance']],
    ['conflitsOrganisation', ['conflitsOrganisation']],
    ['inclusionsNonSatisfaites', ['inclusionsNonSatisfaites']],
  ]);

  test('chaque explication nomme, entre guillemets, le libellé courant de la colonne des propositions qui montre le critère', () => {
    assert.deepEqual([...COLONNES_DU_CRITERE.keys()].sort(), [...CRITERES_DU_REGISTRE].sort());
    for (const [nom, colonnes] of COLONNES_DU_CRITERE) {
      const texte = t(`generation.priorites.explication.${nom}`);
      for (const colonne of colonnes) {
        assert.ok(texte.includes(`« ${t(`propositions.colonne.${colonne}`)} »`), `${nom} : colonne ${colonne}`);
      }
    }
  });
});
