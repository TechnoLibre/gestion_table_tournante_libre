// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les actifs chargés à la demande, dans un vrai moteur de rendu : le logo de
// TechnoLibre et les deux textes de licence. Les octets et les textes que
// rendent les chargeurs sont ceux des fichiers, lus par le disque à part,
// par la commande readFile du lanceur, depuis la racine du projet ; l'image
// affichable du logo est celle du SVG.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { commands } from 'vitest/browser';
import { describe, expect, test } from 'vitest';
import { LICENCES, chargerTexteLicence } from './licences.js';
import { FICHIERS_LOGO, chargerLogo } from './logo.js';

// Les octets d'un fichier, lus par le disque, en base64 puis décodés.
async function octetsDuDisque(chemin) {
  const base64 = await commands.readFile(chemin, 'base64');
  return Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0));
}

describe('chargerLogo', () => {
  test('rend les octets exacts du SVG et du PNG de src/actifs, et une image affichable du SVG', async () => {
    const logo = await chargerLogo();
    expect(logo.svg).toBeInstanceOf(Uint8Array);
    expect(logo.png).toBeInstanceOf(Uint8Array);
    expect([...logo.svg]).toEqual([...(await octetsDuDisque(`src/actifs/${FICHIERS_LOGO.svg}`))]);
    expect([...logo.png]).toEqual([...(await octetsDuDisque(`src/actifs/${FICHIERS_LOGO.png}`))]);
    expect(logo.png.length).toBeGreaterThan(1000);
    expect([...logo.png.slice(0, 4)]).toEqual([0x89, 0x50, 0x4e, 0x47]);

    const image = new Image();
    image.src = logo.image;
    await image.decode();
    expect([image.naturalWidth, image.naturalHeight]).toEqual([250, 50]);
    expect(logo.image.startsWith('data:image/svg+xml')).toBe(true);
  });

  test('le nom proposé de chaque forme est celui de son fichier dans src/actifs, gelé', () => {
    expect(FICHIERS_LOGO).toEqual({ svg: 'full_logo_technolibre_2023.svg', png: 'full_logo_technolibre_2023.png' });
    expect(Object.isFrozen(FICHIERS_LOGO)).toBe(true);
  });

  test('chaque appel rend des tableaux neufs : un appelant peut écrire dans les siens', async () => {
    const [a, b] = [await chargerLogo(), await chargerLogo()];
    expect(a.svg).not.toBe(b.svg);
    expect(a.png).not.toBe(b.png);
    a.png[0] = 0;
    expect(b.png[0]).toBe(0x89);
  });
});

describe('chargerTexteLicence', () => {
  test('rend le texte exact de chaque licence de public/licences/ ; un nom inconnu rejette par RangeError', async () => {
    expect(LICENCES.map(({ nom }) => nom)).toEqual(['agpl', 'liliq']);
    for (const { nom, fichier } of LICENCES) {
      const disque = await commands.readFile(`public/licences/${fichier}`);
      expect(await chargerTexteLicence(nom), nom).toBe(disque);
    }
    expect((await chargerTexteLicence('agpl')).includes('GNU AFFERO GENERAL PUBLIC LICENSE')).toBe(true);
    expect((await chargerTexteLicence('liliq')).startsWith('Licence Libre du Québec')).toBe(true);
    await expect(chargerTexteLicence('autre')).rejects.toThrow(RangeError);
    await expect(chargerTexteLicence('toString')).rejects.toThrow(RangeError);
  });
});
