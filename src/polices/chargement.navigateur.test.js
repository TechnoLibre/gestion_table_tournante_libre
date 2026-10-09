// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le chargement de la police dans la page, sous Vite comme dans la
// construction (§ 14.15) : chargerPolices rend les octets des deux fichiers,
// décodés de l'URL data: que « ?inline » incruste, chacun de la taille et
// de l'empreinte que PROVENANCE déclare. Les octets nourrissent fontkit tels
// quels, et la chaîne témoin y garde la longueur calculée sous node.
import { describe, expect, test } from 'vitest';
import provenance from './PROVENANCE?raw';
import { chargerPolices, decoderDonnees } from './chargement.js';
import { CHAINE_TEMOIN, lireProvenance, longueurTemoin } from '../../test/temoin.js';

const hex = (tampon) => [...new Uint8Array(tampon)].map((o) => o.toString(16).padStart(2, '0')).join('');

describe('polices : le chargement dans la page', () => {
  test('chargerPolices rend deux Uint8Array, de la taille et de l’empreinte SHA-256 que PROVENANCE déclare', async () => {
    const { fichiers } = lireProvenance(provenance);
    const polices = await chargerPolices();
    for (const [graisse, nom] of [['regulier', 'NotoSans-Regular.ttf'], ['gras', 'NotoSans-Bold.ttf']]) {
      const octets = polices[graisse];
      const declare = fichiers.find((f) => f.nom === nom);
      expect(octets, graisse).toBeInstanceOf(Uint8Array);
      expect(octets.length, graisse).toBe(declare.octets);
      expect(hex(await crypto.subtle.digest('SHA-256', octets)), graisse).toBe(declare.sha256);
    }
  });

  test('deux appels rendent des tableaux distincts, de même contenu : un appelant qui écrit dans le sien ne touche pas l’autre', async () => {
    const a = await chargerPolices();
    const b = await chargerPolices();
    expect(a.regulier).not.toBe(b.regulier);
    expect(a.regulier).toEqual(b.regulier);
  });

  test('les octets chargés se lisent par fontkit : la chaîne témoin y a la longueur que les avances donnent', async () => {
    const { regulier, gras } = await chargerPolices();
    expect(longueurTemoin(regulier, 16, CHAINE_TEMOIN)).toBeGreaterThan(0);
    expect(longueurTemoin(gras, 16)).toBeGreaterThan(longueurTemoin(regulier, 16));
  });

  test('decoderDonnees décode une URL data: en base64, et refuse toute autre chaîne sans la rendre telle quelle', () => {
    expect([...decoderDonnees('data:font/ttf;base64,AAEC/w==')]).toEqual([0, 1, 2, 255]);
    expect([...decoderDonnees('data:application/octet-stream;base64,')]).toEqual([]);
    for (const refusee of ['./assets/NotoSans-Regular.ttf', 'data:font/ttf,AAEC', 'AAEC/w==', 42, null]) {
      expect(() => decoderDonnees(refusee), String(refusee)).toThrow(TypeError);
    }
  });
});
