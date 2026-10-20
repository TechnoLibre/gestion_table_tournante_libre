// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des seuils du banc (§ 19.10, § 19.4, § 6.2) : la dichotomie du
// plus grand tenant sur des prédicats écrits, dont le seuil se lit à la main ;
// le seuil d'une courbe de temps par image sur des courbes écrites ; la
// tolérance de la chaîne témoin sur des longueurs écrites. Les prédicats
// comptent leurs appels : une dichotomie qui balaierait tout l'intervalle se
// verrait.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { CRITERE_TEMPS_IMAGE_MS, plusGrandTenant, seuilDepuisCourbe, toleranceTemoin } from './seuils.js';

// Un prédicat qui note chaque n reçu, dans l'ordre des appels.
function compte(predicat) {
  const appels = [];
  const enveloppe = (n) => {
    appels.push(n);
    return predicat(n);
  };
  return { enveloppe, appels };
}

describe('le critère du temps par image', () => {
  test('33 ms, le choix de l’utilisateur, écrit ici et non au registre', () => {
    assert.equal(CRITERE_TEMPS_IMAGE_MS, 33);
  });
});

describe('plusGrandTenant : la dichotomie, la monotonie vérifiée', () => {
  test('un seuil connu, 17 sur [2, 200] : rendu tel quel, en treize appels au plus', async () => {
    const { enveloppe, appels } = compte((n) => n <= 17);
    assert.equal(await plusGrandTenant(enveloppe, 2, 200), 17);
    assert.ok(appels.length <= 13, `${appels.length} appels : ${appels.join(' ')}`);
    assert.deepEqual(appels.slice(-3), [16, 17, 18], 'le résultat et ses deux voisins sont relus');
  });

  test('un prédicat asynchrone vaut un prédicat synchrone', async () => {
    assert.equal(await plusGrandTenant(async (n) => n <= 41, 2, 200), 41);
  });

  test('chaque seuil de [2, 40] se retrouve, bornes comprises', async () => {
    for (let seuil = 2; seuil <= 40; seuil += 1) {
      assert.equal(await plusGrandTenant((n) => n <= seuil, 2, 40), seuil, String(seuil));
    }
  });

  test('tenu partout : le maximum', async () => {
    assert.equal(await plusGrandTenant(() => true, 2, 200), 200);
  });

  test('jamais vrai : null', async () => {
    assert.equal(await plusGrandTenant(() => false, 2, 200), null);
  });

  test('un intervalle d’un seul entier : lui, ou null', async () => {
    assert.equal(await plusGrandTenant(() => true, 5, 5), 5);
    assert.equal(await plusGrandTenant(() => false, 5, 5), null);
  });

  test('non monotone sous le résultat : un trou à 19 sous un seuil de 20 lève en nommant le voisin', async () => {
    const trou = (n) => n <= 20 && n !== 19;
    await assert.rejects(plusGrandTenant(trou, 1, 40), { name: 'RangeError', message: /non monotone.*19/ });
  });

  test('non monotone au-dessus du résultat : un prédicat qui change d’avis à la relecture lève', async () => {
    // Le premier appel en 21 répond « tient », le second « ne tient pas » :
    // la dichotomie le croit tenu, la relecture du voisin le dément.
    const vus = new Map();
    const instable = (n) => {
      const fois = (vus.get(n) ?? 0) + 1;
      vus.set(n, fois);
      return n <= 20 || (n === 21 && fois === 1);
    };
    await assert.rejects(plusGrandTenant(instable, 1, 40), { name: 'RangeError', message: /non monotone/ });
  });

  test('croissant plutôt que décroissant : faux au minimum, vrai au maximum, lève', async () => {
    await assert.rejects(plusGrandTenant((n) => n >= 10, 2, 200), { name: 'RangeError', message: /non monotone/ });
  });

  test('un prédicat qui rend autre chose qu’un booléen est refusé', async () => {
    await assert.rejects(plusGrandTenant(() => 1, 2, 10), TypeError);
    await assert.rejects(plusGrandTenant(async () => undefined, 2, 10), TypeError);
  });

  test('des bornes qui ne sont pas des entiers, ou inversées, sont refusées avant tout appel', async () => {
    const { enveloppe, appels } = compte(() => true);
    for (const [min, max] of [[2.5, 10], [2, Number.POSITIVE_INFINITY], [10, 2], ['2', 10]]) {
      await assert.rejects(plusGrandTenant(enveloppe, min, max), RangeError, `${min}, ${max}`);
    }
    await assert.rejects(plusGrandTenant(null, 2, 10), TypeError);
    assert.deepEqual(appels, []);
  });
});

// Une courbe de temps par image : k en px/cm, p95 en ms.
const courbe = (points) => points.map(([k, p95Ms]) => ({ k, p95Ms }));

describe('seuilDepuisCourbe : le plus petit k au-delà duquel tout k de la courbe tient', () => {
  test('monotone : le premier k qui tient', () => {
    const c = courbe([[0.2, 48], [0.3, 40], [0.4, 33], [0.5, 25], [0.6, 20]]);
    assert.deepEqual(seuilDepuisCourbe(c, 33), { k: 0.4, tenuPartout: false, jamaisTenu: false });
  });

  test('le critère tient à égalité : un p95 de 33 ms tient 33 ms', () => {
    assert.deepEqual(seuilDepuisCourbe(courbe([[0.2, 33.0001], [0.3, 33]]), 33), { k: 0.3, tenuPartout: false, jamaisTenu: false });
  });

  test('non monotone : le seuil est au-delà du dernier échec, non au premier tenant', () => {
    const c = courbe([[0.2, 40], [0.3, 30], [0.4, 36], [0.5, 31], [0.6, 28]]);
    assert.deepEqual(seuilDepuisCourbe(c, 33), { k: 0.5, tenuPartout: false, jamaisTenu: false });
  });

  test('l’ordre de la courbe reçue est sans effet, et elle n’est pas modifiée', () => {
    const c = courbe([[0.6, 28], [0.3, 30], [0.5, 31], [0.2, 40], [0.4, 36]]);
    const copie = structuredClone(c);
    assert.deepEqual(seuilDepuisCourbe(c, 33), { k: 0.5, tenuPartout: false, jamaisTenu: false });
    assert.deepEqual(c, copie);
  });

  test('tout tenu : le plus petit k de la courbe, tenuPartout', () => {
    const c = courbe([[0.4, 20], [0.18, 30], [1, 12]]);
    assert.deepEqual(seuilDepuisCourbe(c, 33), { k: 0.18, tenuPartout: true, jamaisTenu: false });
  });

  test('rien tenu : k null, jamaisTenu', () => {
    assert.deepEqual(seuilDepuisCourbe(courbe([[0.2, 40], [0.5, 34]]), 33), { k: null, tenuPartout: false, jamaisTenu: true });
  });

  test('un échec au plus grand k : k null, sans être jamais tenu', () => {
    assert.deepEqual(seuilDepuisCourbe(courbe([[0.2, 20], [0.5, 34]]), 33), { k: null, tenuPartout: false, jamaisTenu: false });
  });

  test('une courbe vide est refusée : elle ne prouve rien', () => {
    assert.throws(() => seuilDepuisCourbe([], 33), RangeError);
  });

  test('une courbe malformée, un k en double, un critère invalide sont refusés', () => {
    assert.throws(() => seuilDepuisCourbe(null, 33), TypeError);
    assert.throws(() => seuilDepuisCourbe(courbe([[0.2, Number.NaN]]), 33), RangeError);
    assert.throws(() => seuilDepuisCourbe(courbe([[-1, 20]]), 33), RangeError);
    assert.throws(() => seuilDepuisCourbe(courbe([[0.2, 20], [0.2, 40]]), 33), { name: 'RangeError', message: /0\.2/ });
    assert.throws(() => seuilDepuisCourbe(courbe([[0.2, 20]]), 0), RangeError);
    assert.throws(() => seuilDepuisCourbe([{ k: 0.2 }], 33), RangeError);
  });
});

// Dix mesures identiques d'une longueur.
const dix = (valeur) => Array.from({ length: 10 }, () => valeur);

describe('toleranceTemoin : le quart de l’écart du repli, au moins trois fois la gigue', () => {
  test('sans gigue : le quart de l’écart relatif du repli, arrondi par excès à deux chiffres', () => {
    // Écart du repli : 40 / 1000 = 0,04 ; son quart, 0,01.
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx: dix(1040) });
    assert.deepEqual(t, { valeur: 0.01, ecartRepli: 0.04, gigue: 0, biais: 0, refus: null });
  });

  test('un repli plus court compte comme un plus long : l’écart est en valeur absolue', () => {
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx: dix(950) });
    assert.equal(t.ecartRepli, 0.05);
    assert.equal(t.valeur, 0.013);
  });

  test('une gigue qui dépasse le quart de l’écart l’emporte : trois fois elle', () => {
    // Gigue : (1004 − 1000) / 1000 = 0,004 ; trois fois, 0,012 > 0,01.
    const embarqueePx = [1000, 1004, 1002, 1001, 1003, 1000, 1002, 1001, 1004, 1003];
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx, repliPx: dix(1040) });
    assert.equal(t.gigue, 0.004);
    assert.equal(t.valeur, 0.012);
    assert.equal(t.refus, null);
  });

  test('la valeur arrondie ne passe jamais sous le plus grand des deux termes', () => {
    const t = toleranceTemoin({ attenduePx: 977, embarqueePx: dix(977), repliPx: dix(1021.3) });
    assert.ok(t.valeur >= t.ecartRepli / 4, `${t.valeur} sous ${t.ecartRepli / 4}`);
    assert.equal(String(t.valeur).replace(/^0\.0*/, '').length <= 2, true, String(t.valeur));
  });

  test('un repli que la gigue couvre est refusé : la tolérance laisserait passer le repli', () => {
    const embarqueePx = [1000, 1010, 1000, 1010, 1000, 1010, 1000, 1010, 1000, 1010];
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx, repliPx: dix(1020) });
    assert.equal(t.valeur, null);
    assert.match(t.refus, /repli/);
  });

  test('un repli rendu à la longueur de la police embarquée est refusé', () => {
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx: dix(1000) });
    assert.equal(t.valeur, null);
    assert.match(t.refus, /repli/);
  });

  test('une police embarquée rendue loin de ses avances est refusée : ce n’est pas elle que l’on mesure', () => {
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1060), repliPx: dix(1200) });
    assert.equal(t.biais, 0.06);
    assert.equal(t.valeur, null);
    assert.match(t.refus, /embarquée/);
  });

  test('neuf mesures sont refusées, dix acceptées, pour chacune des deux polices', () => {
    const neuf = (valeur) => dix(valeur).slice(1);
    assert.throws(() => toleranceTemoin({ attenduePx: 1000, embarqueePx: neuf(1000), repliPx: dix(1040) }), { name: 'RangeError', message: /embarquée.*10/ });
    assert.throws(() => toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx: neuf(1040) }), { name: 'RangeError', message: /repli.*10/ });
    assert.equal(toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx: dix(1040) }).valeur, 0.01);
  });

  test('le biais se lit sur la médiane de la police embarquée : ni son premier élément, ni son min, ni son max', () => {
    // Triées : 1000 1000 1001 1001 1001 | 1003 1003 1003 1003 1009 ; la
    // médiane paire vaut (1001 + 1003) / 2 = 1002, soit un biais de 0,002.
    // Le premier élément donnerait 0,001, le min 0, le max 0,009, le seul
    // élément de droite du milieu 0,003.
    const embarqueePx = [1001, 1009, 1000, 1003, 1001, 1003, 1000, 1003, 1001, 1003];
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx, repliPx: dix(1040) });
    assert.deepEqual(t, { valeur: 0.027, ecartRepli: 0.04, gigue: 0.009, biais: 0.002, refus: null });
  });

  test('l’écart du repli se lit sur sa médiane : une valeur aberrante ne le déplace pas', () => {
    // Triées : 1020 1030 1030 1030 1030 | 1050 1050 1050 1060 2000 ; médiane
    // (1030 + 1050) / 2 = 1040, soit 0,04. Le premier élément donnerait 0,03,
    // le min 0,02, le max 1, le seul élément de droite du milieu 0,05.
    const repliPx = [1030, 1050, 1020, 1050, 1030, 1060, 1030, 1050, 2000, 1030];
    const t = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx });
    assert.deepEqual(t, { valeur: 0.01, ecartRepli: 0.04, gigue: 0, biais: 0, refus: null });
  });

  test('une série de longueur impaire prend l’élément du milieu', () => {
    // Triées : 1020 1030 1030 1030 1030 1040 1050 1050 1050 1060 2000 ; la
    // médiane est 1040, et non (1030 + 1040) / 2.
    const repliPx = [1030, 1050, 1020, 1050, 1030, 1040, 1060, 1030, 1050, 2000, 1030];
    assert.equal(toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx }).ecartRepli, 0.04);
  });

  test('un biais égal à la tolérance est admis, un biais au-dessus refusé', () => {
    const egal = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1010), repliPx: dix(1040) });
    assert.deepEqual(egal, { valeur: 0.01, ecartRepli: 0.04, gigue: 0, biais: 0.01, refus: null });
    const dessus = toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1011), repliPx: dix(1040) });
    assert.equal(dessus.valeur, null);
    assert.match(dessus.refus, /embarquée/);
  });

  test('une tolérance égale à l’écart du repli est refusée, une tolérance juste en dessous admise', () => {
    // Gigue : 0,02 ; trois fois, 0,06, l'écart même du repli rendu à 1060.
    const alterne = Array.from({ length: 10 }, (_, i) => (i % 2 === 0 ? 1000 : 1020));
    const egal = toleranceTemoin({ attenduePx: 1000, embarqueePx: alterne, repliPx: dix(1060) });
    assert.equal(egal.ecartRepli, 0.06);
    assert.equal(egal.valeur, null);
    assert.match(egal.refus, /repli/);
    const dessous = toleranceTemoin({ attenduePx: 1000, embarqueePx: alterne, repliPx: dix(1061) });
    assert.deepEqual(dessous, { valeur: 0.06, ecartRepli: 0.061, gigue: 0.02, biais: 0.01, refus: null });
  });

  test('moins de dix mesures, une longueur non finie ou nulle sont refusées', () => {
    assert.throws(() => toleranceTemoin({ attenduePx: 1000, embarqueePx: [1000, 1000], repliPx: dix(1040) }), RangeError);
    assert.throws(() => toleranceTemoin({ attenduePx: 0, embarqueePx: dix(1000), repliPx: dix(1040) }), RangeError);
    assert.throws(() => toleranceTemoin({ attenduePx: 1000, embarqueePx: dix(1000), repliPx: [...dix(1040).slice(1), Number.NaN] }), RangeError);
  });
});
