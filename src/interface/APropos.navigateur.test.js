// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le panneau « À propos » dans un vrai moteur de rendu (§ 18.6) : monté
// seul, sur un presse-papiers d'épreuve qui relève ce qu'on lui remet ou
// refuse, et une façade d'épreuve dont enregistrerSous relève le nom et les
// octets reçus. Le bloc copié est celui qu'on lui passe ; l'ouverture depuis
// le bandeau et la composition du bloc s'éprouvent dans App.navigateur.test.js.
// Les octets du logo et les textes des licences se comparent aux fichiers,
// lus par le disque par la commande readFile du lanceur ; la liste des
// composants tiers aussi, que composantsDesTiers tire de TIERS.txt lu de la
// même façon. Le panneau se monte sous le t de l'écran, celui d'App, dont
// les attendus se tirent. Aucune épreuve ne suit un lien : le navigateur
// d'épreuve n'a pas de réseau (§ 19.2).
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import './jetons.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { commands } from 'vitest/browser';
import { LICENCES } from '../actifs/licences.js';
import { FICHIERS_LOGO } from '../actifs/logo.js';
import { composantsDesTiers } from '../actifs/tiers.js';
import { creerHorlogePilotee } from '../application/horloge.js';
import { couleurDeJeton } from '../../test/navigateur/captures.js';
import { composantes, contraste, couleurTexte, fondPeintSous, sousTheme, traductionEcran } from '../../test/navigateur/rendu.js';
import APropos from './APropos.svelte';
import { LIENS, cleDeLien } from './apropos.js';
import { CATEGORIES, cleDeCategorie, cleDeFonctionnalite } from './fonctionnalites.js';

const { t } = traductionEcran();

// Un bloc inventé, de la forme d'une ligne d'« À propos ».
const BLOC = 'Logiciel témoin \u{00B7} forme d\u{2019}épreuve \u{00B7} plateforme simulée';

const montes = [];
afterEach(() => {
  for (const { composant, conteneur } of montes.splice(0)) {
    unmount(composant);
    conteneur.remove();
  }
});

// Un presse-papiers d'épreuve : relève chaque copie, ou lève refus.
function pressePapiersDEpreuve({ refus = null } = {}) {
  const copies = [];
  return {
    copies,
    async copier(texte) {
      if (refus !== null) throw refus;
      copies.push(texte);
    },
  };
}

// Une façade d'épreuve : enregistrerSous relève chaque nom, ses octets et la
// promesse qu'elle rend, celle du chemin que donne chemin(nom), null pour un
// téléchargement.
function facadeDEpreuve({ chemin = (nom) => `/dossier/${nom}` } = {}) {
  const enregistres = [];
  return {
    enregistres,
    enregistrerSous(nom, octets) {
      const rendu = Promise.resolve(chemin(nom));
      enregistres.push({ nom, octets: [...octets], rendu });
      return rendu;
    },
  };
}

function monter(props, { facade = facadeDEpreuve() } = {}) {
  const conteneur = document.createElement('div');
  document.body.prepend(conteneur);
  const contexte = new Map([
    ['t', t],
    ['horloge', creerHorlogePilotee()],
    ['facade', facade],
  ]);
  const composant = mount(APropos, { target: conteneur, props, context: contexte });
  flushSync();
  montes.push({ composant, conteneur });
  return conteneur;
}

// La carte qui porte un élément : le plus proche ancêtre peint du fond de la
// carte, au rayon de 12 px ; null sans elle.
function carteDe(element) {
  const fond = couleurDeJeton('--couleur-carte-fond').join();
  for (let n = element.parentElement; n !== null; n = n.parentElement) {
    const style = getComputedStyle(n);
    if (composantes(style.backgroundColor).join() === fond && style.borderTopLeftRadius === '12px') return n;
  }
  return null;
}

describe('« À propos » : l’habillage (§ 18.6)', () => {
  test('le titre au-dessus d’une carte qui porte le bloc, sur le fond sourd, et les commandes ; « Copier » est l’action principale, dans les deux thèmes', async () => {
    const conteneur = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer: () => {} });
    const ecran = conteneur.querySelector('[data-ecran="apropos"]');
    const titre = ecran.querySelector('h1');
    expect(titre.textContent).toBe(t('coquille.apropos.titre'));
    const bloc = ecran.querySelector('[data-bloc]');
    expect(bloc.textContent).toBe(BLOC);
    const carte = carteDe(bloc);
    expect(carte, 'carte du bloc').not.toBeNull();
    expect(ecran.contains(carte)).toBe(true);
    expect(carte.contains(titre)).toBe(false);
    expect(carte.contains(ecran.querySelector('[data-commande="copier"]'))).toBe(true);
    expect(carte.contains(ecran.querySelector('[data-commande="fermerApropos"]'))).toBe(true);
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const [fond] = fondPeintSous(bloc);
        expect(fond.join(), theme).toBe(couleurDeJeton('--couleur-carte-fond-sourd').join());
        expect(contraste(couleurTexte(bloc), fond), theme).toBeGreaterThanOrEqual(4.5);
        const copier = getComputedStyle(ecran.querySelector('[data-commande="copier"]'));
        expect(composantes(copier.backgroundColor).join(), theme).toBe(couleurDeJeton('--couleur-action-fond').join());
      });
    }
  });

  test('« Copier » remet exactement le bloc affiché et le dit ; refusée, la copie le dit dans l’encre du refus', async () => {
    const presse = pressePapiersDEpreuve();
    const conteneur = monter({ bloc: BLOC, pressePapiers: presse, fermer: () => {} });
    conteneur.querySelector('[data-commande="copier"]').click();
    await vi.waitFor(() => expect(presse.copies).toEqual([BLOC]));
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[role="status"]')?.textContent).toBe(t('coquille.apropos.copie'));
    });

    const refuse = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve({ refus: new Error('refusé') }), fermer: () => {} });
    refuse.querySelector('[data-commande="copier"]').click();
    await vi.waitFor(() => {
      flushSync();
      expect(refuse.querySelector('[data-refus="copier"]')?.textContent).toBe(t('coquille.apropos.copieRefusee'));
    });
    const message = refuse.querySelector('[data-refus="copier"]');
    expect(couleurTexte(message).join()).toBe(couleurDeJeton('--couleur-refus').join());
  });

  test('« Fermer » appelle fermer une fois', () => {
    const fermer = vi.fn();
    const conteneur = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer });
    conteneur.querySelector('[data-commande="fermerApropos"]').click();
    expect(fermer).toHaveBeenCalledTimes(1);
  });
});

// Les octets d'un fichier du projet, lus par le disque.
async function octetsDuDisque(chemin) {
  const base64 = await commands.readFile(chemin, 'base64');
  return [...Uint8Array.from(atob(base64), (caractere) => caractere.charCodeAt(0))];
}

const monterSeul = (facade) => monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer: () => {} }, { facade });

describe('« À propos » : le logo de TechnoLibre (§ 18.6)', () => {
  test('le logo s’affiche dans un bouton qui ouvre et referme un petit menu de deux téléchargements, SVG et PNG', async () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    expect(bouton.getAttribute('aria-label')).toBe(t('coquille.apropos.logo.menu'));
    await vi.waitFor(() => {
      flushSync();
      expect(bouton.querySelector('img')?.getAttribute('src')?.startsWith('data:image/svg+xml')).toBe(true);
    });
    const image = bouton.querySelector('img');
    await image.decode();
    expect(image.getBoundingClientRect().width).toBeGreaterThan(100);
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    const menu = document.getElementById(bouton.getAttribute('aria-controls'));
    expect(menu.hidden).toBe(true);
    expect(conteneur.querySelector('[data-commande="telechargerSvg"]')).toBeNull();

    bouton.click();
    flushSync();
    expect(bouton.getAttribute('aria-expanded')).toBe('true');
    expect(menu.hidden).toBe(false);
    expect([...menu.querySelectorAll('[data-commande]')].map((c) => [c.dataset.commande, c.textContent.trim()])).toEqual([
      ['telechargerSvg', t('coquille.apropos.logo.telechargerSvg')],
      ['telechargerPng', t('coquille.apropos.logo.telechargerPng')],
    ]);
    bouton.click();
    flushSync();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(menu.hidden).toBe(true);
  });

  test('chaque téléchargement remet à enregistrerSous le nom et les octets exacts du fichier, ferme le menu et dit où le logo est enregistré', async () => {
    const facade = facadeDEpreuve();
    const conteneur = monterSeul(facade);
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    for (const [forme, commande] of [['svg', 'telechargerSvg'], ['png', 'telechargerPng']]) {
      bouton.click();
      flushSync();
      conteneur.querySelector(`[data-commande="${commande}"]`).click();
      await vi.waitFor(() => expect(facade.enregistres.length).toBe(forme === 'svg' ? 1 : 2));
      const { nom, octets } = facade.enregistres.at(-1);
      expect(nom).toBe(FICHIERS_LOGO[forme]);
      expect(octets).toEqual(await octetsDuDisque(`src/actifs/${FICHIERS_LOGO[forme]}`));
      await vi.waitFor(() => {
        flushSync();
        expect(bouton.getAttribute('aria-expanded')).toBe('false');
        expect(conteneur.querySelector('[data-logo-enregistre]')?.textContent).toBe(
          t('coquille.apropos.logo.enregistre', { chemin: `/dossier/${FICHIERS_LOGO[forme]}` }),
        );
      });
      expect(document.activeElement).toBe(bouton);
    }
  });

  test('un téléchargement sans chemin — celui du web — ne dit rien ; Échap ferme le menu et rend le focus au logo', async () => {
    const facade = facadeDEpreuve({ chemin: () => null });
    const conteneur = monterSeul(facade);
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    bouton.click();
    flushSync();
    conteneur.querySelector('[data-commande="telechargerPng"]').click();
    await vi.waitFor(() => expect(facade.enregistres.length).toBe(1));
    // La suite de l'enregistrement s'exécute une microtâche après la
    // promesse rendue.
    await facade.enregistres[0].rendu;
    await Promise.resolve();
    flushSync();
    expect(conteneur.querySelector('[data-logo-enregistre]')).toBeNull();

    bouton.click();
    flushSync();
    const svg = conteneur.querySelector('[data-commande="telechargerSvg"]');
    svg.focus();
    svg.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    flushSync();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bouton);
  });

  test('un enregistrement refusé se dit sous le logo, désigné par le logo, qui garde le focus, sans chemin ; le suivant, abouti, le retire', async () => {
    // Une façade dont enregistrerSous rend un chemin, sauf au deuxième
    // appel : sa promesse attend que l'épreuve la rejette, menu déjà fermé,
    // par un refus codé, comme la coquille un dossier où rien ne s'écrit.
    const details = { chemin: FICHIERS_LOGO.png, dossier: '/dossier', cause: 'EACCES' };
    const enregistres = [];
    let rejeter = null;
    const facade = {
      enregistrerSous(nom) {
        enregistres.push(nom);
        if (enregistres.length !== 2) return Promise.resolve(`/dossier/${nom}`);
        return new Promise((_, rejet) => (rejeter = rejet));
      },
    };
    const conteneur = monterSeul(facade);
    const bouton = conteneur.querySelector('[data-commande="logo"]');
    const telecharger = async (commande, rang) => {
      bouton.click();
      flushSync();
      conteneur.querySelector(`[data-commande="${commande}"]`).click();
      await vi.waitFor(() => expect(enregistres.length).toBe(rang));
    };

    await telecharger('telechargerSvg', 1);
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-logo-enregistre]')).not.toBeNull();
    });

    await telecharger('telechargerPng', 2);
    flushSync();
    expect(conteneur.querySelector('[data-commande="telechargerPng"]')).toBeNull();
    rejeter(Object.assign(new Error('ECRITURE'), { code: 'ECRITURE', details }));
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-refus="ECRITURE"]')).not.toBeNull();
    });
    const refus = conteneur.querySelector('[data-refus="ECRITURE"]');
    expect(refus.textContent).toContain(t('ECRITURE', details));
    expect(refus.closest('.logo')).toBe(bouton.closest('.logo'));
    expect(bouton.getAttribute('aria-describedby')).toBe(refus.id);
    expect(conteneur.querySelector('[data-logo-enregistre]')).toBeNull();
    expect(bouton.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(bouton);

    await telecharger('telechargerSvg', 3);
    await vi.waitFor(() => {
      flushSync();
      expect(conteneur.querySelector('[data-logo-enregistre]')).not.toBeNull();
    });
    expect(conteneur.querySelector('[data-refus]')).toBeNull();
    expect(bouton.hasAttribute('aria-describedby')).toBe(false);
  });
});

describe('« À propos » : les liens (§ 2, § 18.6)', () => {
  test('les quatre liens, chacun vers son adresse, dans un nouvel onglet, sans ouvreur ni référent ; aucun autre lien', () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const liens = [...conteneur.querySelectorAll('a')];
    expect(liens.map((a) => a.dataset.lien).sort()).toEqual(Object.keys(LIENS).sort());
    for (const a of liens) {
      const nom = a.dataset.lien;
      expect(a.getAttribute('href'), nom).toBe(LIENS[nom]);
      expect(a.getAttribute('target'), nom).toBe('_blank');
      expect(a.getAttribute('rel'), nom).toBe('noopener noreferrer');
      expect(a.textContent.trim(), nom).toBe(t(cleDeLien(nom)));
    }
  });

  test('un lien se lit dans les deux thèmes, souligné, au contraste du texte', async () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const lien = conteneur.querySelector('[data-lien="projet"]');
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const [fond] = fondPeintSous(lien);
        expect(contraste(couleurTexte(lien), fond), theme).toBeGreaterThanOrEqual(4.5);
        expect(getComputedStyle(lien).textDecorationLine, theme).toContain('underline');
      });
    }
  });
});

describe('« À propos » : l’attribution et la licence (§ 18.6)', () => {
  test('l’attribution précède la licence, qui dit le choix entre les deux licences, l’identifiant SPDX et ce que demande la licence choisie', () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const licence = [...conteneur.querySelectorAll('section[aria-labelledby]')].find(
      (s) => s.querySelector('h2')?.textContent === t('coquille.apropos.licence.titre'),
    );
    expect(licence, 'carte Licence').toBeDefined();
    const texte = licence.textContent;
    for (const cle of ['choix', 'agpl', 'liliq', 'spdx', 'textes', 'respecter', 'permission', 'contributions']) {
      expect(texte.includes(t(`coquille.apropos.licence.${cle}`)), cle).toBe(true);
    }
    for (const rang of [1, 2, 3, 4, 5]) expect(texte.includes(t(`coquille.apropos.licence.obligation${rang}`)), rang).toBe(true);
    expect(licence.querySelector('code')?.textContent).toBe(t('coquille.apropos.licence.spdxValeur'));
    expect([...licence.querySelectorAll('[data-lien]')].map((a) => a.dataset.lien)).toEqual(['agpl', 'liliq']);
    const attribution = [...conteneur.querySelectorAll('section[aria-labelledby]')].find(
      (s) => s.querySelector('h2')?.textContent === t('coquille.apropos.attribution.titre'),
    );
    expect(attribution?.textContent.includes(t('coquille.apropos.attribution.texte'))).toBe(true);
    expect(attribution.compareDocumentPosition(licence) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('chaque texte complet se lit dans le panneau, à la demande, tel que son fichier ; un seul à la fois, que « Fermer le texte » retire', async () => {
    const conteneur = monterSeul(facadeDEpreuve());
    expect(conteneur.querySelector('[data-texte-licence]')).toBeNull();
    const commandes = { agpl: 'lireAgpl', liliq: 'lireLiliq' };
    for (const { nom, fichier } of LICENCES) {
      conteneur.querySelector(`[data-commande="${commandes[nom]}"]`).click();
      const disque = await commands.readFile(`public/licences/${fichier}`);
      await vi.waitFor(() => {
        flushSync();
        expect(conteneur.querySelector(`[data-texte-licence="${nom}"]`)?.textContent).toBe(disque);
      });
      expect(conteneur.querySelectorAll('[data-texte-licence]').length).toBe(1);
      const pre = conteneur.querySelector('[data-texte-licence]');
      expect(pre.scrollWidth, nom).toBeLessThanOrEqual(pre.clientWidth + 1);
    }
    conteneur.querySelector('[data-commande="fermerTexte"]').click();
    flushSync();
    expect(conteneur.querySelector('[data-texte-licence]')).toBeNull();
  });
});

// La liste attendue des composants tiers : composantsDesTiers sur TIERS.txt
// et NotoSans-OFL.txt lus par le disque.
async function composantsDuDisque() {
  const [tiers, police] = await Promise.all([
    commands.readFile('public/licences/TIERS.txt'),
    commands.readFile('public/licences/NotoSans-OFL.txt'),
  ]);
  return composantsDesTiers(tiers, { 'NotoSans-OFL.txt': police });
}

// La carte des composants tiers, par son titre ; undefined sans elle.
const carteTiers = (conteneur) =>
  [...conteneur.querySelectorAll('section[aria-labelledby]')].find(
    (s) => s.querySelector('h2')?.textContent === t('coquille.apropos.tiers.titre'),
  );

// L'entrée d'un composant, par sa clé, et sa commande « Lire la licence » —
// celle de sa ligne, non celles des œuvres qu'il incorpore.
const entree = (conteneur, cle) => [...conteneur.querySelectorAll('[data-composant]')].find((li) => li.dataset.composant === cle);
const commandeLire = (conteneur, cle) =>
  [...entree(conteneur, cle).querySelectorAll('[data-commande="lireTiers"]')].find((c) => c.closest('[data-composant]').dataset.composant === cle);

// Le panneau monté, sa liste des composants tiers chargée.
async function monterListeChargee(options) {
  const conteneur = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer: () => {}, ...options });
  await vi.waitFor(() => {
    flushSync();
    expect(conteneur.querySelector('[data-composant]')).not.toBeNull();
  });
  return conteneur;
}

// L'élément le plus profond de racine dont le texte est texte ; null sans
// lui.
const porteur = (racine, texte) =>
  [...racine.querySelectorAll('*')].reverse().find((e) => e.textContent.trim() === texte) ?? null;

const designationDe = ({ nom, version }) => t('coquille.apropos.tiers.designation', { nom, version });

describe('« À propos » : les composants tiers et leurs licences (§ 18.6)', () => {
  test('la carte suit la licence et dit pourquoi ; chaque composant de TIERS.txt, les œuvres incorporées en retrait sous leur paquet', async () => {
    const conteneur = await monterListeChargee();
    const composants = await composantsDuDisque();
    const titres = [...conteneur.querySelectorAll('section[aria-labelledby] h2')].map((h) => h.textContent);
    expect(titres.slice(0, 4)).toEqual([
      t('coquille.apropos.attribution.titre'),
      t('coquille.apropos.licence.titre'),
      t('coquille.apropos.tiers.titre'),
      t('coquille.apropos.fonctionnalites.titre'),
    ]);
    const carte = carteTiers(conteneur);
    expect(carte.textContent).toContain(t('coquille.apropos.tiers.explication'));
    expect(t('coquille.apropos.tiers.explication').endsWith('.')).toBe(true);

    // Les paquets au premier niveau, dans l'ordre de l'index ; sous chacun,
    // les œuvres qu'il incorpore, dans le même ordre.
    const liste = carte.querySelector('ul');
    const paquets = composants.filter((c) => c.hote === null);
    expect([...liste.children].map((li) => [li.tagName, li.dataset.composant])).toEqual(paquets.map((p) => ['LI', p.cle]));
    expect([...carte.querySelectorAll('[data-composant]')].map((li) => li.dataset.composant)).toEqual(
      paquets.flatMap((p) => [p.cle, ...composants.filter((c) => c.hote === p.nom).map((c) => c.cle)]),
    );
    for (const hote of ['highs', '@pdf-lib/fontkit']) {
      const incorpores = composants.filter((c) => c.hote === hote);
      const sousListe = entree(conteneur, hote).querySelector(':scope > ul');
      expect(sousListe.dataset.incorpores, hote).toBe(hote);
      expect([...sousListe.children].map((li) => li.dataset.composant), hote).toEqual(incorpores.map((c) => c.cle));
      const intitule = document.getElementById(sousListe.getAttribute('aria-labelledby'));
      expect(intitule?.textContent, hote).toBe(t('coquille.apropos.tiers.incorpores', { hote }));
    }

    // Une entrée de chaque sorte : sa désignation, sa licence et sa commande,
    // nommée avec le composant ; l'œuvre incorporée en retrait du paquet.
    const svelte = composants.find((c) => c.cle === 'svelte');
    const highs = composants.find((c) => c.cle === 'highs : HiGHS');
    for (const composant of [svelte, highs]) {
      const ligne = entree(conteneur, composant.cle);
      expect(designationDe(composant), composant.cle).toContain(composant.version);
      expect(ligne.textContent, composant.cle).toContain(designationDe(composant));
      expect(ligne.textContent, composant.cle).toContain(t('coquille.apropos.tiers.licence', { licence: composant.licence }));
      const commande = commandeLire(conteneur, composant.cle);
      expect(commande.textContent.trim(), composant.cle).toBe(t('coquille.apropos.tiers.lire'));
      expect(commande.getAttribute('aria-label'), composant.cle).toBe(t('coquille.apropos.tiers.lireNomme', { composant: designationDe(composant) }));
    }
    // Une œuvre sans version se désigne par son seul nom, à l'écran comme
    // dans le nom de sa commande.
    const sansVersion = composants.filter((c) => c.version === null);
    expect(sansVersion.map((c) => c.cle)).toContain('highs : cuPDLP-C');
    for (const composant of sansVersion) {
      const ligne = entree(conteneur, composant.cle);
      expect(ligne.querySelector('.designation').textContent, composant.cle).toBe(composant.nom);
      expect(ligne.textContent, composant.cle).not.toContain('null');
      const commande = commandeLire(conteneur, composant.cle);
      expect(commande.getAttribute('aria-label'), composant.cle).toBe(t('coquille.apropos.tiers.lireNomme', { composant: composant.nom }));
    }
    const gauche = (cle) => commandeLire(conteneur, cle).closest('[data-composant]').getBoundingClientRect().left;
    expect(gauche('highs : HiGHS')).toBeGreaterThan(gauche('highs') + 8);
    expect(conteneur.querySelector('[data-chargement-tiers]')).toBeNull();
  });

  test('« Lire la licence » montre le texte de la section sous l’entrée, un seul à la fois ; « Fermer le texte » rend le focus', async () => {
    const conteneur = await monterListeChargee();
    const composants = await composantsDuDisque();
    const textes = () => [...conteneur.querySelectorAll('[data-texte-licence]')];

    commandeLire(conteneur, 'svelte').click();
    flushSync();
    expect(textes().map((pre) => pre.dataset.texteLicence)).toEqual(['svelte']);
    const [svelte] = textes();
    expect(svelte.tagName).toBe('PRE');
    expect(getComputedStyle(svelte).whiteSpace).toBe('pre-wrap');
    expect(svelte.textContent).toBe(composants.find((c) => c.cle === 'svelte').texte);
    expect(svelte.textContent.trim()).toBe((await commands.readFile('node_modules/svelte/LICENSE.md')).trim());
    expect(svelte.closest('[data-composant]').dataset.composant).toBe('svelte');

    commandeLire(conteneur, 'Noto Sans').click();
    flushSync();
    expect(textes().map((pre) => pre.dataset.texteLicence)).toEqual(['Noto Sans']);
    expect(textes()[0].textContent).toBe(await commands.readFile('public/licences/NotoSans-OFL.txt'));

    // Une licence du logiciel remplace le texte d'un tiers, et l'inverse.
    conteneur.querySelector('[data-commande="lireAgpl"]').click();
    await vi.waitFor(() => {
      flushSync();
      expect(textes().map((pre) => pre.dataset.texteLicence)).toEqual(['agpl']);
    });
    const cle = 'highs : HiGHS';
    commandeLire(conteneur, cle).click();
    flushSync();
    expect(textes().map((pre) => pre.dataset.texteLicence)).toEqual([cle]);
    const [highs] = textes();
    expect(highs.textContent).toBe(composants.find((c) => c.cle === cle).texte);
    expect(highs.textContent.startsWith('MIT License')).toBe(true);
    expect(highs.closest('[data-composant]').dataset.composant).toBe(cle);
    expect(highs.scrollWidth).toBeLessThanOrEqual(highs.clientWidth + 1);

    const fermer = conteneur.querySelectorAll('[data-commande="fermerTexte"]');
    expect(fermer.length).toBe(1);
    expect(fermer[0].closest('[data-composant]')?.dataset.composant).toBe(cle);
    fermer[0].click();
    flushSync();
    expect(textes()).toEqual([]);
    expect(conteneur.querySelector('[data-commande="fermerTexte"]')).toBeNull();
    expect(document.activeElement).toBe(commandeLire(conteneur, cle));
  });

  test('le chargement se dit ; un morceau qui ne se charge pas se dit à la place de la liste, dans l’encre du refus, et va au collecteur', async () => {
    let rejeter = null;
    const appels = [];
    const chargerTiers = () => {
      appels.push(1);
      return new Promise((_, rejet) => (rejeter = rejet));
    };
    const conteneur = monter({ bloc: BLOC, pressePapiers: pressePapiersDEpreuve(), fermer: () => {}, chargerTiers });
    expect(appels.length).toBe(1);
    const carte = carteTiers(conteneur);
    const attente = carte.querySelector('[data-chargement-tiers]');
    expect(attente?.getAttribute('role')).toBe('status');
    expect(attente.textContent).toBe(t('coquille.apropos.tiers.chargement'));
    expect(carte.querySelector('[data-composant]')).toBeNull();

    // Le rejet est rapporté par reportError, qui le lève sur la fenêtre.
    const panne = new Error('morceau des textes introuvable');
    const rapportees = [];
    const ecouter = (evenement) => rapportees.push(evenement.error);
    window.addEventListener('error', ecouter);
    rejeter(panne);
    try {
      await vi.waitFor(() => {
        flushSync();
        expect(carte.querySelector('[data-echec-tiers]')).not.toBeNull();
      });
    } finally {
      window.removeEventListener('error', ecouter);
    }
    expect(rapportees).toEqual([panne]);
    const echec = carte.querySelector('[data-echec-tiers]');
    expect(echec.getAttribute('role')).toBe('status');
    expect(echec.textContent).toBe(t('coquille.apropos.tiers.echec'));
    expect(t('coquille.apropos.tiers.echec').endsWith('.')).toBe(true);
    expect(couleurTexte(echec).join()).toBe(couleurDeJeton('--couleur-refus').join());
    expect(carte.querySelector('[data-chargement-tiers]')).toBeNull();
    expect(carte.querySelector('[data-composant]')).toBeNull();
    expect(appels.length).toBe(1);
  });

  test('à 320 px, dans les deux thèmes : tout tient dans la largeur, lisible, licence et intitulés dans l’encre secondaire', async () => {
    const conteneur = await monterListeChargee();
    const composants = await composantsDuDisque();
    conteneur.style.width = '320px';
    // Le texte de LLVM, qui trace ses propres filets, par sa clé du disque.
    const llvm = composants.find((c) => c.hote === 'highs' && c.nom.startsWith('libc++'));
    commandeLire(conteneur, llvm.cle).click();
    flushSync();
    const carte = carteTiers(conteneur);
    const pre = carte.querySelector('[data-texte-licence]');
    expect(pre).not.toBeNull();
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        expect(carte.scrollWidth, theme).toBeLessThanOrEqual(carte.clientWidth + 1);
        expect(carte.getBoundingClientRect().width, theme).toBeLessThanOrEqual(321);
        expect(pre.scrollWidth, theme).toBeLessThanOrEqual(pre.clientWidth + 1);
        for (const element of carte.querySelectorAll('[data-composant]')) {
          expect(element.getBoundingClientRect().right, theme).toBeLessThanOrEqual(carte.getBoundingClientRect().right + 1);
        }
        const ligne = entree(conteneur, 'highs');
        const highs = composants.find((c) => c.cle === 'highs');
        // Le fond peint se lit au centre d'un élément, dans la fenêtre.
        const designation = porteur(ligne, designationDe(highs));
        designation.scrollIntoView({ block: 'center' });
        const [fond] = fondPeintSous(designation);
        expect(contraste(couleurTexte(designation), fond), theme).toBeGreaterThanOrEqual(4.5);
        const intitule = document.getElementById(ligne.querySelector(':scope > ul').getAttribute('aria-labelledby'));
        for (const secondaire of [porteur(ligne, t('coquille.apropos.tiers.licence', { licence: highs.licence })), intitule]) {
          secondaire.scrollIntoView({ block: 'center' });
          expect(couleurTexte(secondaire).join(), theme).toBe(couleurDeJeton('--couleur-page-texte-secondaire').join());
          expect(contraste(couleurTexte(secondaire), fondPeintSous(secondaire)[0]), theme).toBeGreaterThanOrEqual(4.5);
        }
      });
    }
  });
});

describe('« À propos » : le sommaire des fonctionnalités (§ 2.2)', () => {
  test('chaque catégorie, dans l’ordre, sous son libellé, puis chacune de ses fonctionnalités, son numéro avant son intitulé', () => {
    const conteneur = monterSeul(facadeDEpreuve());
    const blocs = [...conteneur.querySelectorAll('[data-categorie]')];
    expect(blocs.map((b) => b.dataset.categorie)).toEqual(CATEGORIES.map(({ code }) => code));
    for (const { code, fonctionnalites } of CATEGORIES) {
      const bloc = conteneur.querySelector(`[data-categorie="${code}"]`);
      expect(bloc.querySelector('h3')?.textContent, code).toBe(t(cleDeCategorie(code)));
      const lignes = [...bloc.querySelectorAll('[data-fonctionnalite]')];
      expect(lignes.map((l) => l.dataset.fonctionnalite), code).toEqual(fonctionnalites.map(({ numero }) => numero));
      for (const ligne of lignes) {
        const numero = ligne.dataset.fonctionnalite;
        // Les blancs se comparent réduits à une espace, des deux côtés : le t
        // de l'écran pose des espaces insécables.
        const blancs = (texte) => texte.replace(/\s+/gu, ' ').trim();
        expect(blancs(ligne.textContent), numero).toBe(blancs(`${numero} ${t(cleDeFonctionnalite(numero))}`));
      }
    }
  });
});
