// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves du relais CSV de l'application (§ 13.4, § 10.1) : l'interface
// atteint src/csv par ce module, qui réexporte ses fonctions telles quelles
// et lie le motif du CSV des refus au libellé français. Les noms sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import * as apercu from '../csv/apercu.js';
import * as colonnes from '../csv/colonnes.js';
import * as encodage from '../csv/encodage.js';
import * as exportCsv from '../csv/export.js';
import * as importCsv from '../csv/import.js';
import { decouper } from '../csv/lecture.js';
import * as normalisation from '../csv/normalisation.js';
import * as relais from './csv.js';
import { libelle } from './libelles.js';

describe('csv : le relais de src/csv pour l’interface (§ 13.4)', () => {
  test('decoder, apercevoir, exporterParticipants, bilanRemplacement, cleNormalisee et CHAMPS sont ceux de src/csv', () => {
    const attendus = [
      ['decoder', encodage.decoder],
      ['apercevoir', apercu.apercevoir],
      ['exporterParticipants', exportCsv.exporterParticipants],
      ['bilanRemplacement', importCsv.bilanRemplacement],
      ['cleNormalisee', normalisation.cleNormalisee],
    ];
    assert.equal(attendus.length, 5);
    for (const [nom, fonction] of attendus) {
      assert.equal(typeof fonction, 'function', nom);
      assert.equal(relais[nom], fonction, nom);
    }
    assert.equal(relais.CHAMPS, colonnes.CHAMPS);
    assert.deepEqual(Object.keys(relais).sort(), [
      'CHAMPS', 'apercevoir', 'bilanRemplacement', 'cleNormalisee', 'decoder', 'exporterParticipants', 'exporterRefus',
    ]);
  });

  test("exporterRefus écrit sous l'en-tête motif exactement libelle(code, details) d'une ligne refusée NOM_ABSENT", () => {
    const texte = ['nom;prenom', 'Ombrelle;Iris', ';Théo', 'Pervenche;Ondine', ''].join('\r\n');
    const lu = relais.apercevoir(texte);
    assert.equal(lu.refusees.length, 1);
    const [{ code, brut, ...details }] = lu.refusees;
    assert.equal(code, 'NOM_ABSENT');
    const { enregistrements } = decouper(relais.decoder(relais.exporterRefus(lu)).texte, ';');
    assert.equal(enregistrements.length, 2);
    const [entete, ligne] = enregistrements;
    const rang = entete.indexOf('motif');
    assert.ok(rang >= 0, entete.join(';'));
    assert.equal(ligne[rang], libelle('NOM_ABSENT', details));
    assert.equal(ligne[entete.indexOf('ligne')], '3');
    assert.ok(brut.length > 0);
  });

  test('exporterRefus écrit les refus reçus en second argument, à la place de ceux de l’aperçu', () => {
    const lu = relais.apercevoir(['nom;exclu', 'Ombrelle;peut-être', ''].join('\r\n'));
    assert.equal(lu.refusees.length, 1);
    const vide = decouper(relais.decoder(relais.exporterRefus(lu, [])).texte, ';').enregistrements;
    assert.deepEqual(vide, [['nom', 'exclu', 'ligne', 'motif']]);
    const [entete, ligne] = decouper(relais.decoder(relais.exporterRefus(lu, lu.refusees)).texte, ';').enregistrements;
    const [{ code, brut, ...details }] = lu.refusees;
    assert.equal(ligne[entete.indexOf('motif')], libelle(code, details));
    assert.ok(brut.length > 0);
  });
});
