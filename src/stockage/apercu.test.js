// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves de l'aperçu de la liste (§ 8.1, § 8.6) : le texte d'une ligne
// qu'écrit texteApercu, que lireApercu relit pour la même construction et
// tient pour absent sous toute autre forme, et l'empreinte de l'état et de la
// dernière ligne complète du journal, comparée à un FNV-1a 64 bits de
// référence calculé en BigInt sur les octets UTF-8. Les versions viennent du
// module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { versionVoisine } from '../../test/version_voisine.js';
import { VERSION } from '../version.genere.js';
import { FORMAT_APERCU, empreinteApercu, fnv1a64, lireApercu, texteApercu } from './apercu.js';

const V1 = VERSION.affichee;
const V2 = versionVoisine(V1);

// Un aperçu d'épreuve : un retenu mesuré et la proposition 7 au rang 1.
const APERCU = Object.freeze({
  produitVersion: V1,
  empreinte: '0123456789abcdef:fedcba9876543210',
  mesuresDuRetenu: Object.freeze({ collisionsCumulees: 3, rencontresRepetees: 0 }),
  meilleureDuClassement: Object.freeze({ id: 7 }),
});

// FNV-1a 64 bits de référence, en BigInt, sur les octets UTF-8 du texte.
function fnvReference(texte) {
  let empreinte = 0xcbf29ce484222325n;
  for (const octet of new TextEncoder().encode(texte)) {
    empreinte ^= BigInt(octet);
    empreinte = (empreinte * 0x100000001b3n) & 0xffffffffffffffffn;
  }
  return empreinte.toString(16).padStart(16, '0');
}

describe("texteApercu : l'aperçu en une ligne de JSON", () => {
  test('les clés dans un ordre fixe, une seule ligne suivie de sa fin, des nombres et aucun nom', () => {
    assert.equal(FORMAT_APERCU, 1);
    const texte = texteApercu(APERCU);
    assert.equal(
      texte,
      `{"format":1,"produit":${JSON.stringify(V1)},"empreinte":"0123456789abcdef:fedcba9876543210",` +
        '"mesuresDuRetenu":{"collisionsCumulees":3,"rencontresRepetees":0},"meilleureDuClassement":{"id":7}}\n',
    );
    assert.equal(texte.indexOf('\n'), texte.length - 1);
  });

  test('sans retenu mesurable ni proposition classée, les deux résumés valent null', () => {
    const texte = texteApercu({ ...APERCU, mesuresDuRetenu: null, meilleureDuClassement: null });
    assert.ok(texte.endsWith('"mesuresDuRetenu":null,"meilleureDuClassement":null}\n'), texte);
  });

  test('une valeur que lireApercu refuserait lève TypeError : rien d’illisible ne s’écrit', () => {
    const fautifs = [
      { ...APERCU, produitVersion: 7 },
      { ...APERCU, empreinte: null },
      { ...APERCU, mesuresDuRetenu: { collisionsCumulees: -1, rencontresRepetees: 0 } },
      { ...APERCU, mesuresDuRetenu: { collisionsCumulees: 1.5, rencontresRepetees: 0 } },
      { ...APERCU, mesuresDuRetenu: { collisionsCumulees: 1 } },
      { ...APERCU, mesuresDuRetenu: { collisionsCumulees: 1, rencontresRepetees: 0, nom: 'Ancolie' } },
      { ...APERCU, meilleureDuClassement: { id: 0 } },
      { ...APERCU, meilleureDuClassement: { id: '7' } },
      { ...APERCU, meilleureDuClassement: undefined },
    ];
    for (const fautif of fautifs) assert.throws(() => texteApercu(fautif), TypeError, JSON.stringify(fautif));
  });
});

describe("lireApercu : l'aperçu de la même construction, ou null", () => {
  test('relit ce que texteApercu écrit, marque d’ordre d’octets admise', () => {
    const attendu = {
      empreinte: APERCU.empreinte,
      mesuresDuRetenu: { collisionsCumulees: 3, rencontresRepetees: 0 },
      meilleureDuClassement: { id: 7 },
    };
    assert.deepEqual(lireApercu(texteApercu(APERCU), V1), attendu);
    assert.deepEqual(lireApercu(`\u{FEFF}${texteApercu(APERCU)}`, V1), attendu);
    const vide = { ...APERCU, mesuresDuRetenu: null, meilleureDuClassement: null };
    assert.deepEqual(lireApercu(texteApercu(vide), V1), { ...attendu, mesuresDuRetenu: null, meilleureDuClassement: null });
  });

  test('vaut absent, sans lever : JSON cassé, autre forme, autre format, autre construction', () => {
    const texte = texteApercu(APERCU);
    const objet = JSON.parse(texte);
    const avec = (champs) => JSON.stringify({ ...objet, ...champs });
    const sans = (cle) => JSON.stringify({ ...objet, [cle]: undefined });
    const cas = [
      ['absent', null],
      ['pas un texte', 12],
      ['JSON cassé', texte.slice(0, 30)],
      ['vide', ''],
      ['une liste', '[]'],
      ['null', 'null'],
      ['autre format', avec({ format: 2 })],
      ['format en texte', avec({ format: '1' })],
      ['autre construction', texteApercu({ ...APERCU, produitVersion: V2 })],
      ['empreinte absente', sans('empreinte')],
      ['empreinte non textuelle', avec({ empreinte: 5 })],
      ['clé de plus', avec({ nom: 'Ancolie' })],
      ['produit absent', sans('produit')],
      ['mesures sans un champ', avec({ mesuresDuRetenu: { collisionsCumulees: 3 } })],
      ['mesures négatives', avec({ mesuresDuRetenu: { collisionsCumulees: 3, rencontresRepetees: -2 } })],
      ['mesures en liste', avec({ mesuresDuRetenu: [3, 0] })],
      ['meilleure sans identifiant', avec({ meilleureDuClassement: {} })],
      ['meilleure fractionnaire', avec({ meilleureDuClassement: { id: 2.5 } })],
      ['meilleure absente', sans('meilleureDuClassement')],
    ];
    for (const [libelle, lu] of cas) assert.equal(lireApercu(lu, V1), null, libelle);
  });
});

describe("empreinteApercu : l'état et la dernière ligne complète du journal", () => {
  test('fnv1a64 suit le FNV-1a 64 bits de référence sur les octets UTF-8, accents, paires de substitution et grands textes compris', () => {
    assert.equal(fnv1a64(''), 'cbf29ce484222325');
    assert.equal(fnv1a64('a'), 'af63dc4c8601ec8c');
    assert.equal(fnv1a64('foobar'), '85944171f73967e8');
    const textes = ['Soirée', 'ŒŸ€', '\u{1F33F} feuille', 'a\u{0000}b', `${'x'.repeat(4096)}é`, '{"format":1}\n', 'a\u{D800}b', '\u{DC00}x', '\u{D800}'];
    for (const texte of textes) assert.equal(fnv1a64(texte), fnvReference(texte), texte);
  });

  test('un caractère de l’état, ou la dernière ligne complète du journal, change l’empreinte ; une ligne finale coupée ne la change pas', () => {
    const etat = '{"format":1,"revision":4}';
    const journal = '{"type":"ouverture"}\n{"revision":3}\n{"revision":4}\n';
    const base = empreinteApercu(etat, journal);
    assert.equal(base, `${fnv1a64(etat)}:${fnv1a64('{"revision":4}')}`);
    assert.equal(empreinteApercu(etat, journal), base, 'déterministe');
    assert.notEqual(empreinteApercu(etat.replace('4', '5'), journal), base, "l'état");
    assert.notEqual(empreinteApercu(etat, `${journal}{"revision":5}\n`), base, 'une entrée en avance');
    assert.equal(empreinteApercu(etat, `${journal}{"revision":5`), base, 'une ligne finale sans fin de ligne');
    assert.equal(empreinteApercu(etat, journal.replace('\n', '\r\n')), base, 'une ligne qui précède');
  });

  test('sans journal, ou sans ligne complète, la seconde moitié vaut « - »', () => {
    const etat = '{}';
    assert.equal(empreinteApercu(etat, null), `${fnv1a64(etat)}:-`);
    assert.equal(empreinteApercu(etat, '{"type":"ouverture"}'), `${fnv1a64(etat)}:-`);
    assert.equal(empreinteApercu(etat, '{"type":"ouverture"}\n'), `${fnv1a64(etat)}:${fnv1a64('{"type":"ouverture"}')}`);
  });
});
