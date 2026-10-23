// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du logo d'une personne dans le dossier de son événement (§ 8.6,
// § 8.7) : l'empreinte SHA-256 qui le nomme, contre les vecteurs de la norme
// FIPS 180-4 et des longueurs qui encadrent le remplissage d'un bloc ; la
// forme logo/<empreinte>.png ; l'écriture, qui crée logo/ au besoin, rend le
// même chemin pour les mêmes octets sans rien réécrire, garde les autres
// logos et répare un fichier dont le contenu ne répond plus à son nom. Les
// empreintes attendues sont écrites en clair. Les octets d'épreuve sont
// composés ici.
import assert from 'node:assert/strict';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { ErreurStockage } from './erreurs.js';
import { DOSSIER_LOGO, LOGO_SOURCE_MAX_OCTETS, cheminLogo, ecrireLogo, empreinteSha256, estCheminLogo } from './logos.js';
import { vueDossier } from './systeme_fichiers.js';

const DOC = { id: 'documents', chemin: 'C:\\Users\\Exemple\\Documents\\Gestion table tournante Libre\\data' };
const EVENEMENT = 'Gala des Saules';

// Les octets d'un texte en ASCII, et n fois la lettre a.
const ascii = (texte) => new TextEncoder().encode(texte);
const lettresA = (n) => new Uint8Array(n).fill(0x61);

// La signature d'un fichier PNG, puis deux octets : une image d'épreuve qui
// n'a pas besoin d'être lisible, le nommage ne lisant que ses octets.
const IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
const AUTRE_IMAGE = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01]);
const EMPREINTE_SIGNATURE = '4c4b6a3be1314ab86138bef4314dde022e600960d8689a2c8f8631802d20dab6';

// Un système d'épreuve où le dossier de l'événement existe, et la vue sur lui.
function preparer() {
  const fs = creerFichiersSimules();
  fs.deposerDossier('documents', EVENEMENT);
  return { fs, vue: vueDossier(fs, EVENEMENT) };
}

// L'erreur que lève la promesse ; échoue quand elle se résout.
async function rejet(promesse) {
  let raison;
  await assert.rejects(promesse, (erreur) => {
    raison = erreur;
    return true;
  });
  return raison;
}

describe('empreinteSha256 : le SHA-256 des octets, en 64 chiffres hexadécimaux minuscules', () => {
  test('les vecteurs de FIPS 180-4 : vide, « abc », 448 bits, 896 bits, un million de « a »', () => {
    const vecteurs = [
      [new Uint8Array(0), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
      [ascii('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
      [
        ascii('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq'),
        '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
      ],
      [
        ascii(
          'abcdefghbcdefghicdefghijdefghijkefghijklfghijklmghijklmnhijklmnoijklmnopjklmnopqklmnopqrlmnopqrsmnopqrstnopqrstu',
        ),
        'cf5b16a778af8380036ce59e7b0492370b249b11e8f07a51afac45037afee9d1',
      ],
      [lettresA(1_000_000), 'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0'],
    ];
    assert.ok(vecteurs.length > 0, 'aucun vecteur');
    for (const [octets, attendu] of vecteurs) assert.equal(empreinteSha256(octets), attendu, `${octets.length} octets`);
  });

  test("les longueurs qui encadrent le remplissage : 55 octets tiennent avec la longueur dans un bloc, 56 en demandent deux ; 63, 64, 65, 119 et 120 de même ; les 256 valeurs d'un octet", () => {
    const attendues = [
      [55, '9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318'],
      [56, 'b35439a4ac6f0948b6d6f9e3c6af0f5f590ce20f1bde7090ef7970686ec6738a'],
      [63, '7d3e74a05d7db15bce4ad9ec0658ea98e3f06eeecf16b4c6fff2da457ddc2f34'],
      [64, 'ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb'],
      [65, '635361c48bb9eab14198e76ea8ab7f1a41685d6ad62aa9146d301d4f17eb0ae0'],
      [119, '31eba51c313a5c08226adf18d4a359cfdfd8d2e816b13f4af952f7ea6584dcfb'],
      [120, '2f3d335432c70b580af0e8e1b3674a7c020d683aa5f73aaaedfdc55af904c21c'],
    ];
    assert.ok(attendues.length > 0, 'aucune longueur');
    for (const [n, attendu] of attendues) assert.equal(empreinteSha256(lettresA(n)), attendu, `${n} octets`);
    const toutes = Uint8Array.from({ length: 256 }, (_, i) => i);
    assert.equal(empreinteSha256(toutes), '40aff2e9d2d8922e47afd4648e6967497158785fbd1da870e7110266bf944880');
  });

  test("seuls comptent les octets de la vue : un Uint8Array pris dans un tampon plus grand, ou un Buffer, se hache comme ses octets ; la vue reçue reste telle", () => {
    const tampon = new Uint8Array([0xaa, ...IMAGE.subarray(0, 8), 0xbb]);
    const vue = tampon.subarray(1, 9);
    assert.equal(empreinteSha256(vue), EMPREINTE_SIGNATURE);
    assert.equal(empreinteSha256(Buffer.from(IMAGE.subarray(0, 8))), EMPREINTE_SIGNATURE);
    assert.deepEqual([...tampon], [0xaa, ...IMAGE.subarray(0, 8), 0xbb]);
  });

  test("des octets d'une autre forme qu'un Uint8Array lèvent TypeError", () => {
    for (const fautifs of ['abc', [0x61], new ArrayBuffer(1), null, undefined]) {
      assert.throws(() => empreinteSha256(fautifs), TypeError, String(fautifs));
    }
  });
});

describe('cheminLogo et estCheminLogo : la forme logo/<empreinte>.png', () => {
  test("cheminLogo place l'empreinte sous logo/, extension .png ; DOSSIER_LOGO est logo", () => {
    assert.equal(DOSSIER_LOGO, 'logo');
    assert.equal(cheminLogo(EMPREINTE_SIGNATURE), `logo/${EMPREINTE_SIGNATURE}.png`);
    assert.equal(cheminLogo(EMPREINTE_SIGNATURE).length, 73);
  });

  test("cheminLogo refuse par TypeError ce qui n'est pas 64 chiffres hexadécimaux minuscules", () => {
    const fautives = [
      EMPREINTE_SIGNATURE.toUpperCase(),
      EMPREINTE_SIGNATURE.slice(1),
      `${EMPREINTE_SIGNATURE}0`,
      `${EMPREINTE_SIGNATURE.slice(1)}g`,
      `../${EMPREINTE_SIGNATURE.slice(3)}`,
      '',
      null,
      42,
    ];
    for (const empreinte of fautives) assert.throws(() => cheminLogo(empreinte), TypeError, String(empreinte));
  });

  test("estCheminLogo ne reconnaît que logo/ suivi de 64 chiffres hexadécimaux minuscules et de .png, rien avant ni après", () => {
    assert.equal(estCheminLogo(`logo/${EMPREINTE_SIGNATURE}.png`), true);
    const autres = [
      `logo/${EMPREINTE_SIGNATURE.toUpperCase()}.png`,
      `Logo/${EMPREINTE_SIGNATURE}.png`,
      `logo/${EMPREINTE_SIGNATURE}.PNG`,
      `logo/${EMPREINTE_SIGNATURE}.jpg`,
      `logo/${EMPREINTE_SIGNATURE.slice(1)}.png`,
      `logo/${EMPREINTE_SIGNATURE}0.png`,
      `./logo/${EMPREINTE_SIGNATURE}.png`,
      `../logo/${EMPREINTE_SIGNATURE}.png`,
      `logo/../${EMPREINTE_SIGNATURE}.png`,
      `logo/${EMPREINTE_SIGNATURE}.png\n`,
      `logo/${EMPREINTE_SIGNATURE}.png/x`,
      `x/logo/${EMPREINTE_SIGNATURE}.png`,
      `logo\\${EMPREINTE_SIGNATURE}.png`,
      `${EMPREINTE_SIGNATURE}.png`,
      'Gala des Saules.gtt.json',
      '',
      null,
      undefined,
      ['logo', `${EMPREINTE_SIGNATURE}.png`],
    ];
    for (const chemin of autres) assert.equal(estCheminLogo(chemin), false, JSON.stringify(chemin));
  });
});

describe("ecrireLogo : l'écriture d'un logo, nommé par son contenu", () => {
  test("rend logo/<empreinte>.png, crée logo/ dans le dossier de l'événement et y écrit les octets tels quels", async () => {
    const { fs, vue } = preparer();
    const chemin = await ecrireLogo(vue, DOC, IMAGE);
    assert.equal(chemin, cheminLogo(empreinteSha256(IMAGE)));
    assert.ok(estCheminLogo(chemin), chemin);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${chemin}`), IMAGE);
    assert.deepEqual((await fs.lister(DOC, EVENEMENT)).map(({ nom, type }) => [nom, type]), [['logo', 'dossier']]);
    assert.deepEqual((await fs.lister(DOC, `${EVENEMENT}/logo`)).map(({ nom }) => nom), [chemin.slice(5)]);
  });

  test('les mêmes octets rendent le même chemin, et le second appel ne réécrit rien', async () => {
    const { fs, vue } = preparer();
    const premier = await ecrireLogo(vue, DOC, IMAGE);
    const [avant] = await fs.lister(DOC, `${EVENEMENT}/logo`);
    const ecritures = fs.compteurs.ecritures;
    const second = await ecrireLogo(vue, DOC, new Uint8Array(IMAGE));
    assert.equal(second, premier);
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(await fs.lister(DOC, `${EVENEMENT}/logo`), [avant]);
  });

  test("d'autres octets donnent un autre chemin, et le premier logo reste", async () => {
    const { fs, vue } = preparer();
    const premier = await ecrireLogo(vue, DOC, IMAGE);
    const second = await ecrireLogo(vue, DOC, AUTRE_IMAGE);
    assert.notEqual(second, premier);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${premier}`), IMAGE);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${second}`), AUTRE_IMAGE);
  });

  test('un fichier présent sous ce nom dont les octets diffèrent — une écriture interrompue sans renommage atomique — se réécrit', async () => {
    const { fs, vue } = preparer();
    const chemin = cheminLogo(empreinteSha256(IMAGE));
    fs.deposerOctets('documents', `${EVENEMENT}/${chemin}`, IMAGE.subarray(0, 4));
    assert.equal(await ecrireLogo(vue, DOC, IMAGE), chemin);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${chemin}`), IMAGE);
    // De même longueur, un seul octet changé : le contenu se compare entier.
    const altere = new Uint8Array(IMAGE);
    altere[IMAGE.length - 1] = 0x00;
    fs.deposerOctets('documents', `${EVENEMENT}/${chemin}`, altere);
    assert.equal(await ecrireLogo(vue, DOC, IMAGE), chemin);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${chemin}`), IMAGE);
  });

  test("le tableau que l'appelant réemploie ensuite ne change pas le fichier", async () => {
    const { fs, vue } = preparer();
    const octets = new Uint8Array(IMAGE);
    const chemin = await ecrireLogo(vue, DOC, octets);
    octets.fill(0);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${chemin}`), IMAGE);
  });

  test("un refus d'écrire se lève tel que le système le rend, et un fichier logo en travers du dossier lève ECRITURE ; rien d'autre ne s'écrit", async () => {
    const { fs, vue } = preparer();
    fs.deposer('documents', `${EVENEMENT}/logo`, 'un fichier, pas un dossier');
    const enTravers = await rejet(ecrireLogo(vue, DOC, IMAGE));
    assert.ok(enTravers instanceof ErreurStockage, String(enTravers));
    assert.equal(enTravers.code, 'ECRITURE');
    assert.equal(fs.contenu('documents', `${EVENEMENT}/logo`), 'un fichier, pas un dossier');

    const second = preparer();
    second.fs.pannes.ecriture('documents', 'EROFS');
    const refus = await rejet(ecrireLogo(second.vue, DOC, IMAGE));
    assert.ok(refus instanceof ErreurStockage, String(refus));
    assert.deepEqual([refus.code, refus.details.cause], ['ECRITURE', 'EROFS']);
    assert.deepEqual(await second.fs.lister(DOC, EVENEMENT), []);
  });

  test("un fichier présent qui ne se lit pas lève LECTURE tel quel, sans rien écrire par-dessus", async () => {
    const { fs, vue } = preparer();
    const chemin = cheminLogo(empreinteSha256(IMAGE));
    fs.deposerOctets('documents', `${EVENEMENT}/${chemin}`, IMAGE.subarray(0, 4));
    const illisible = new ErreurStockage('LECTURE', { chemin, cause: 'EACCES' });
    const refusante = { ...vue, lireOctets: async () => Promise.reject(illisible) };
    const ecritures = fs.compteurs.ecritures;
    assert.equal(await rejet(ecrireLogo(refusante, DOC, IMAGE)), illisible);
    assert.equal(fs.compteurs.ecritures, ecritures);
    assert.deepEqual(fs.octets('documents', `${EVENEMENT}/${chemin}`), IMAGE.subarray(0, 4));
  });

  test("des octets d'une autre forme qu'un Uint8Array lèvent TypeError, sans rien lire ni écrire", async () => {
    const { fs, vue } = preparer();
    for (const fautifs of ['image', [0x89], new ArrayBuffer(1), null]) {
      await assert.rejects(ecrireLogo(vue, DOC, fautifs), TypeError, String(fautifs));
    }
    assert.deepEqual(fs.compteurs, { ecritures: 0, lectures: 0 });
  });
});

describe('LOGO_SOURCE_MAX_OCTETS : le plafond d\u{2019}une image source', () => {
  test('vaut 25 Mo, comptés en mébioctets comme les affiche l\u{2019}explorateur de Windows', () => {
    assert.equal(LOGO_SOURCE_MAX_OCTETS, 25 * 1024 * 1024);
  });
});
