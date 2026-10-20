// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La clé du libellé de mode (§ 8.4, § 8.5), que lisent le bandeau, la bande
// de mode et la barre de l'événement : aucune sans événement ; le plan
// bloqué avant le mode, qu'il force en lecture ; sinon le mode de la séance. Et la clé de l'annonce de
// format du bandeau (§ 18.6), une par annonce de la séance.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { TABLE as COQUILLE } from './libelles/coquille.js';
import { cleAnnonceFormat, cleDeMode } from './mode.js';

// Un EtatSeance réduit à ce que lit cleDeMode.
const etat = (mode, etatDuPlan, annonceFormat = null) => ({
  mode,
  evenement: etatDuPlan === null ? null : { base: 'bal', id: 'evt-1', nom: 'Bal', etat: etatDuPlan, revision: 1, annonceFormat },
});

describe('cleDeMode (§ 8.4)', () => {
  test('null sans événement, dans les deux modes', () => {
    assert.equal(cleDeMode(etat('lecture', null)), null);
    assert.equal(cleDeMode(etat('ecriture', null)), null);
  });

  test('un plan bloqué rend coquille.mode.bloque, quel que soit le mode', () => {
    assert.equal(cleDeMode(etat('lecture', 'bloque')), 'coquille.mode.bloque');
    assert.equal(cleDeMode(etat('ecriture', 'bloque')), 'coquille.mode.bloque');
  });

  test('sinon le mode de la séance, pour chaque état non bloqué', () => {
    const etats = ['brouillon', 'propose', 'retenu'];
    assert.ok(etats.length > 0);
    for (const etatDuPlan of etats) {
      assert.equal(cleDeMode(etat('lecture', etatDuPlan)), 'coquille.mode.lecture', etatDuPlan);
      assert.equal(cleDeMode(etat('ecriture', etatDuPlan)), 'coquille.mode.ecriture', etatDuPlan);
    }
  });

  test('chaque clé rendue a son texte dans la table de la coquille', () => {
    for (const cle of ['coquille.mode.lecture', 'coquille.mode.ecriture', 'coquille.mode.bloque']) {
      assert.equal(typeof COQUILLE.get(cle), 'string', cle);
    }
  });
});

describe('cleAnnonceFormat (§ 18.6)', () => {
  test('null sans événement, ou au format courant', () => {
    assert.equal(cleAnnonceFormat(etat('lecture', null)), null);
    assert.equal(cleAnnonceFormat(etat('lecture', 'brouillon')), null);
  });

  test('une clé par annonce, chacune avec son texte', () => {
    const cas = [
      ['plusRecent', 'coquille.format.plusRecent'],
      ['plusAncien', 'coquille.format.plusAncien'],
    ];
    for (const [annonce, cle] of cas) {
      assert.equal(cleAnnonceFormat(etat('lecture', 'brouillon', annonce)), cle, annonce);
      assert.equal(typeof COQUILLE.get(cle), 'string', cle);
    }
  });

  test('une annonce inconnue lève RangeError', () => {
    assert.throws(() => cleAnnonceFormat(etat('lecture', 'brouillon', 'plusVieux')), RangeError);
  });
});
