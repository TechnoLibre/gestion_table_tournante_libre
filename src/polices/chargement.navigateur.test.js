// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le chargement de la police dans la page, sous Vite comme dans la
// construction (§ 14.15) : chargerPolices rend les octets des deux fichiers,
// décodés de l'URL data: que « ?inline » incruste, chacun de la taille et
// de l'empreinte que PROVENANCE déclare. Les octets nourrissent fontkit tels
// quels, et la chaîne témoin y garde la longueur calculée sous node.
//
// L'attente des faces de la police d'interface, attendrePolices : sur un
// document simulé, les deux demandes partent ensemble et la promesse ne se
// résout que les deux faces chargées ; sur le document d'un cadre neuf, sans
// @font-face, avec une face introuvable, puis avec les deux fichiers de
// src/polices. Le module ne s'importe pas sous node, « ?inline » étant
// propre à Vite : ces épreuves vivent ici.
import { describe, expect, test } from 'vitest';
import provenance from './PROVENANCE?raw';
import adresseGras from './NotoSans-Bold.ttf?url';
import adresseRegulier from './NotoSans-Regular.ttf?url';
import { attendrePolices, chargerPolices, decoderDonnees, FACES_INTERFACE } from './chargement.js';
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

// Un document dont document.fonts.load rend, pour chaque descripteur, ce que
// reponse(descripteur) donne ; il relève les descripteurs demandés.
function documentSimule(reponse) {
  const demandes = [];
  return {
    demandes,
    fonts: {
      load(descripteur) {
        demandes.push(descripteur);
        return reponse(descripteur);
      },
    },
  };
}

const face = (status) => ({ family: 'Noto Sans', status });

// Le document d'un cadre neuf, ajouté au corps, avec les règles @font-face
// données ; fermer() retire le cadre.
function cadreNeuf(regles) {
  const cadre = document.createElement('iframe');
  document.body.append(cadre);
  const style = cadre.contentDocument.createElement('style');
  style.textContent = regles;
  cadre.contentDocument.head.append(style);
  return { document: cadre.contentDocument, fermer: () => cadre.remove() };
}
const regle = (graisse, adresse) =>
  `@font-face { font-family: 'Noto Sans'; font-weight: ${graisse}; src: url('${new URL(adresse, document.baseURI).href}'); }`;

describe('polices : attendrePolices', () => {
  test('les faces attendues sont Noto Sans 400 et 700, dans cet ordre', () => {
    expect(FACES_INTERFACE).toEqual(['400 16px "Noto Sans"', '700 16px "Noto Sans"']);
    expect(Object.isFrozen(FACES_INTERFACE)).toBe(true);
  });

  test('demande les deux faces avant d’en attendre une, et se résout sans valeur quand chacune est chargée', async () => {
    const resolutions = [];
    const simule = documentSimule(() => new Promise((resoudre) => resolutions.push(() => resoudre([face('loaded')]))));
    const attente = attendrePolices(simule);
    expect(simule.demandes).toEqual([...FACES_INTERFACE]);
    let reglee = false;
    attente.then(() => {
      reglee = true;
    });
    resolutions[0]();
    await Promise.resolve();
    await Promise.resolve();
    expect(reglee, 'résolue avant la seconde face').toBe(false);
    resolutions[1]();
    expect(await attente).toBeUndefined();
  });

  test('une face qu’aucune feuille ne déclare, ou rendue sans être chargée, rejette en la nommant ; un refus du navigateur passe tel quel', async () => {
    const sans700 = documentSimule((descripteur) => Promise.resolve(descripteur.startsWith('700') ? [] : [face('loaded')]));
    await expect(attendrePolices(sans700)).rejects.toThrow(/face non chargée — 700 16px "Noto Sans"$/);
    const enErreur = documentSimule((descripteur) => Promise.resolve([face(descripteur.startsWith('400') ? 'error' : 'loaded')]));
    await expect(attendrePolices(enErreur)).rejects.toThrow(/face non chargée — 400 16px "Noto Sans"$/);
    const refus = new Error('chargement refusé');
    await expect(attendrePolices(documentSimule(() => Promise.reject(refus)))).rejects.toBe(refus);
  });

  test('un document sans ensemble de polices lève TypeError', async () => {
    for (const sansPolices of [null, undefined, {}, { fonts: {} }]) {
      await expect(attendrePolices(sansPolices), String(sansPolices)).rejects.toThrow(TypeError);
    }
  });

  test('dans un cadre neuf : sans @font-face, les deux faces se nomment ; une face introuvable rejette ; les fichiers de src/polices se chargent', async () => {
    const vide = cadreNeuf('');
    try {
      await expect(attendrePolices(vide.document)).rejects.toThrow(
        /face non chargée — 400 16px "Noto Sans" ; 700 16px "Noto Sans"$/,
      );
    } finally {
      vide.fermer();
    }
    const introuvable = cadreNeuf(`${regle(400, adresseRegulier)} ${regle(700, '/polices-introuvables/absente.ttf')}`);
    try {
      await expect(attendrePolices(introuvable.document)).rejects.toThrow();
    } finally {
      introuvable.fermer();
    }
    const complet = cadreNeuf(`${regle(400, adresseRegulier)} ${regle(700, adresseGras)}`);
    try {
      expect([...complet.document.fonts].map((f) => f.status)).toEqual(['unloaded', 'unloaded']);
      await attendrePolices(complet.document);
      expect([...complet.document.fonts].map((f) => [f.weight, f.status])).toEqual([
        ['400', 'loaded'],
        ['700', 'loaded'],
      ]);
    } finally {
      complet.fermer();
    }
  });
});
