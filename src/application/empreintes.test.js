// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Classement de référence (§ 5.7, § 14.10) : une charge de propositions
// engendrées par rechercher, enregistrées par la commande, s'évalue par
// evaluer sous les quatre cases cochées, plafond a priori calculé puis
// inconnu. L'ordre, les critères appliqués, le critère sauté et les grandeurs
// nommées de chaque proposition se comparent au fichier versionné
// test/fixtures/moteur/empreintes_defaut.json, que seule
// src/moteur/empreintes.test.js récrit, sous GTT_EMPREINTES=ecrire : cette
// épreuve-ci ne fait que relire, et refuse de se jouer sous ce mode. Les
// grandeurs de chaque proposition sont celles qu'une épreuve des seize
// combinaisons relit pour en déduire l'ordre attendu sous chacune.
//
// Un ordre figé ne garde un critère que s'il y décide quelque chose : la
// référence est tenue de faire de chaque critère appliqué, dans un de ses
// classements au moins, le premier qui départage deux propositions voisines,
// et un critère dont le retrait change l'ordre. Sans quoi un comparateur qui
// inverse ou oublie ce critère rend le même ordre que la référence.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import {
  CASES,
  CLASSEMENT,
  chargeDeClassement,
  classementLu,
  empreintesDuClassement,
  exigerVerification,
  lireEmpreintes,
} from '../../test/empreintes_moteur.js';
import { evaluer } from './evaluation.js';

exigerVerification(process.env);
const REFERENCE = lireEmpreintes();

// Les deux classements de chaque charge, sous le nom de leur plafond a priori.
const PLAFONDS = Object.freeze(['connu', 'inconnu']);

// Pour chaque critère du classement, le nom de la grandeur nommée qu'il lit
// dans le fichier.
const GRANDEUR_DU_CRITERE = new Map([
  ['ecartAuPlafondAPrioriMax', 'ecartAuPlafondAPrioriMax'],
  ['excedentCollisions', 'excedentCollisions'],
  ['collisionsCumulees', 'collisionsCumulees'],
  ['rencontresRepetees', 'rencontresRepeteesChoisies'],
  ['redondance', 'redondance'],
]);

// La valeur d'un critère pour la proposition id, lue dans les grandeurs de
// la référence. Lève pour un critère sans grandeur, en le nommant.
function valeur(grandeurs, id, critere) {
  const nom = GRANDEUR_DU_CRITERE.get(critere);
  if (nom === undefined) throw new Error(`critère sans grandeur nommée : ${critere}`);
  return grandeurs[String(id)][nom];
}

// Le premier critère de criteres sur lequel deux propositions diffèrent ;
// null quand elles sont égales sur tous.
function premierQuiDepartage(grandeurs, criteres, a, b) {
  return criteres.find((critere) => valeur(grandeurs, a, critere) !== valeur(grandeurs, b, critere)) ?? null;
}

// Les identifiants ids rangés critère par critère dans l'ordre de criteres,
// chacun croissant, puis par identifiant croissant : le classement du § 5.7,
// refait sur les grandeurs du fichier.
function ordonner(grandeurs, criteres, ids) {
  return [...ids].sort((a, b) => {
    const critere = premierQuiDepartage(grandeurs, criteres, a, b);
    return critere === null ? a - b : valeur(grandeurs, a, critere) - valeur(grandeurs, b, critere);
  });
}

// Chaque classement de la référence, nommé par sa charge et son plafond a
// priori, avec les grandeurs de ses propositions.
function classementsDeReference() {
  return CLASSEMENT.cles.flatMap((cle) =>
    PLAFONDS.map((plafond) => ({
      nom: `${cle}, plafond a priori ${plafond}`,
      ...REFERENCE.classements[cle][plafond],
      grandeurs: REFERENCE.classements[cle].propositions,
    })),
  );
}

describe('classement de référence : evaluer sous les quatre cases cochées (§ 5.7, § 14.10)', () => {
  test(`la référence porte ${CLASSEMENT.cles.join(' et ')}, ${CLASSEMENT.nombre} propositions chacune`, () => {
    assert.deepEqual(Object.keys(REFERENCE.classements), CLASSEMENT.cles);
    for (const cle of CLASSEMENT.cles) {
      const { propositions } = REFERENCE.classements[cle];
      assert.equal(Object.keys(propositions).length, CLASSEMENT.nombre, cle);
    }
  });

  for (const cle of CLASSEMENT.cles) {
    test(`${cle} : l’ordre et les critères appliqués, plafond a priori calculé puis inconnu, sont ceux de la référence`, () => {
      const charge = chargeDeClassement(cle);
      assert.deepEqual(CASES.map((nom) => charge.reglages[nom]), [true, true, true, true], `${cle} : les quatre cases cochées`);
      const attendu = REFERENCE.classements[cle];
      assert.deepEqual(classementLu(evaluer(charge).classement), attendu.connu, `${cle}, plafond a priori calculé`);
      assert.deepEqual(
        classementLu(evaluer(charge, { plafondsAPriori: null }).classement),
        attendu.inconnu,
        `${cle}, plafond a priori inconnu`,
      );
    });

    test(`${cle} : les grandeurs nommées de chaque proposition sont celles de la référence`, () => {
      assert.deepEqual(empreintesDuClassement(cle).propositions, REFERENCE.classements[cle].propositions, cle);
    });
  }
});

describe('classement de référence : chaque critère appliqué y décide (§ 5.7, § 14.10)', () => {
  test('les grandeurs de la référence, rangées sous ses critères appliqués, redonnent son ordre', () => {
    for (const { nom, ordre, criteresAppliques, grandeurs } of classementsDeReference()) {
      assert.deepEqual(ordonner(grandeurs, criteresAppliques, ordre), ordre, nom);
    }
  });

  test('chaque critère appliqué départage le premier deux propositions voisines, et son retrait change l’ordre', () => {
    const classements = classementsDeReference();
    const criteres = [...new Set(classements.flatMap(({ criteresAppliques }) => criteresAppliques))];
    const sansEffet = [];
    for (const critere of criteres) {
      const departage = classements.some(({ ordre, criteresAppliques, grandeurs }) =>
        ordre.slice(1).some((id, rang) => premierQuiDepartage(grandeurs, criteresAppliques, ordre[rang], id) === critere),
      );
      const compte = classements.some(({ ordre, criteresAppliques, grandeurs }) => {
        const sans = criteresAppliques.filter((autre) => autre !== critere);
        return criteresAppliques.includes(critere) && ordonner(grandeurs, sans, ordre).join() !== ordre.join();
      });
      if (!departage) sansEffet.push(`${critere} : ne départage le premier aucune paire voisine`);
      if (!compte) sansEffet.push(`${critere} : son retrait ne change aucun ordre`);
    }
    assert.deepEqual(sansEffet, []);
  });
});
