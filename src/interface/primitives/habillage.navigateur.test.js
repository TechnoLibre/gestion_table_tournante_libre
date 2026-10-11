// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'habillage des primitives dans un vrai moteur de rendu (§ 12.7, § 14.5) :
// l'icône, la pastille, la carte, les variantes de la commande, le refus,
// l'infobulle, le champ et la fenêtre à confirmer, montés chacun par mount,
// dans les deux thèmes. Le test interroge le rendu : le style calculé, la
// boîte, le nom accessible, jamais la présence d'une classe (§ 14.2). La
// couleur attendue d'un jeton se relit sur une sonde qui le peint, et le
// contraste d'un texte se mesure sur ce qui est peint sous lui.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, describe, expect, test } from 'vitest';
import { createRawSnippet, flushSync, mount, unmount } from 'svelte';
import '../jetons.css';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { creerTraduction } from '../../application/traduction.js';
import { composantes, contraste, couleurTexte, fondPeintSous, sousTheme, visible } from '../../../test/navigateur/rendu.js';
import { RANGS_APPARTENANCE } from '../appartenances.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Carte from './Carte.svelte';
import Champ from './Champ.svelte';
import Commande from './Commande.svelte';
import Confirmation from './Confirmation.svelte';
import Icone from './Icone.svelte';
import Infobulle from './Infobulle.svelte';
import Pastille from './Pastille.svelte';
import Refus from './Refus.svelte';
import { ICONES, NOMS_ICONES } from './icones.js';
import { ETATS_PASTILLE, TONS_PASTILLE, modelePastille } from './pastille.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const THEMES = ['clair', 'sombre'];
const TRANSPARENT = [0, 0, 0, 0];

// Les composants montés par l'épreuve courante, et leurs conteneurs.
const montes = [];
afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
});

// Monte un composant dans un conteneur neuf, au début du corps, sur le fond
// de la page.
function monter(Composant, props, contexte = new Map([['t', t]])) {
  const cible = document.createElement('div');
  cible.style.backgroundColor = 'var(--couleur-page-fond)';
  cible.style.padding = '8px';
  document.body.prepend(cible);
  const composant = mount(Composant, { target: cible, props, context: contexte });
  flushSync();
  montes.push({ composant, cible });
  return cible;
}

// La couleur qu'un jeton donne dans le thème courant, relue sur une sonde.
function jeton(nom) {
  const sonde = document.createElement('span');
  sonde.style.color = `var(${nom})`;
  document.body.append(sonde);
  const couleur = composantes(getComputedStyle(sonde).color);
  sonde.remove();
  return couleur;
}

const style = (element) => getComputedStyle(element);
const fond = (element) => composantes(style(element).backgroundColor);

// Un texte tient 4,5:1 sur chaque couleur peinte sous lui.
function exigerLisible(element, lieu) {
  const texte = couleurTexte({ element, pseudo: null });
  const fonds = fondPeintSous({ element, pseudo: null });
  expect(fonds.length, `${lieu} : aucun fond opaque`).toBeGreaterThan(0);
  for (const f of fonds) expect(contraste(texte, f), `${lieu} sur ${f}`).toBeGreaterThanOrEqual(4.5);
}

// La couleur d'un signe : celle de son trait pour une icône, de son fond pour
// un point.
const couleurSigne = (signe) => (signe.tagName.toLowerCase() === 'svg' ? composantes(style(signe.querySelector('path')).stroke) : fond(signe));

// Un signe tient 3:1 sur chaque couleur peinte sous lui (§ 14.5). Sous une
// icône, le fond se lit sous le dessin ; un point peint son propre fond, et
// ce qui est sous lui se lit donc sous son conteneur.
function exigerSigneVisible(signe, lieu) {
  const couleur = couleurSigne(signe);
  const fonds = fondPeintSous(signe.tagName.toLowerCase() === 'svg' ? signe : signe.parentElement);
  expect(fonds.length, `${lieu} : aucun fond opaque sous le signe`).toBeGreaterThan(0);
  for (const f of fonds) expect(contraste(couleur, f), `${lieu} : signe sur ${f}`).toBeGreaterThanOrEqual(3);
}

// Bord droit du texte d'un élément : celui de la plus à droite des boîtes de
// ses lignes, lu sur une plage qui couvre son contenu. La boîte de l'élément
// ne le dit pas : un texte qui déborde sort de sa boîte sans l'élargir.
function bordDroitDuTexte(element) {
  const plage = document.createRange();
  plage.selectNodeContents(element);
  return Math.max(...[...plage.getClientRects()].map((r) => r.right));
}

// Un point du texte est-il sur le fond d'une boîte aux quatre coins arrondis
// d'un même rayon ? Le rayon peint est le rayon calculé, réduit comme le fait
// le moteur quand deux coins voisins se chevaucheraient : au plus la moitié
// du plus petit côté. Seuls les quatre carrés de coin peuvent tomber hors du
// fond.
function surLeFond(boite, rayonCalcule, x, y) {
  const r = Math.min(rayonCalcule, boite.width / 2, boite.height / 2);
  const cx = Math.min(Math.max(x, boite.left + r), boite.right - r);
  const cy = Math.min(Math.max(y, boite.top + r), boite.bottom - r);
  return Math.hypot(x - cx, y - cy) <= r + 0.5;
}

const snippet = (html) => createRawSnippet(() => ({ render: () => html }));

describe('icône (module des primitives)', () => {
  test('chaque icône : un <svg> caché aux technologies d’assistance, au trait de la couleur courante, sans remplissage, un tracé par entrée du module', () => {
    for (const nom of NOMS_ICONES) {
      const cible = monter(Icone, { nom });
      const svg = cible.querySelector('svg');
      expect(svg, nom).not.toBeNull();
      expect(svg.getAttribute('aria-hidden'), nom).toBe('true');
      expect(svg.getAttribute('focusable'), nom).toBe('false');
      expect(svg.getAttribute('viewBox'), nom).toBe('0 0 24 24');
      expect(svg.querySelectorAll('path').length, nom).toBe(ICONES[nom].length);
      const trait = style(svg.querySelector('path'));
      expect(trait.fill, nom).toBe('none');
      expect(trait.stroke, nom).toBe(style(svg).color);
      const boite = svg.getBoundingClientRect();
      expect([boite.width, boite.height], nom).toEqual([16, 16]);
      const dessin = svg.getBBox();
      expect(dessin.width * dessin.height, nom).toBeGreaterThan(0);
      expect(svg.textContent.trim(), nom).toBe('');
    }
  });

  test('la taille se donne en px ; un nom inconnu lève RangeError au montage', () => {
    const cible = monter(Icone, { nom: 'coche', taille: 20 });
    expect(cible.querySelector('svg').getBoundingClientRect().width).toBe(20);
    expect(() => monter(Icone, { nom: 'licorne' })).toThrow(RangeError);
  });
});

describe('pastille', () => {
  // La pastille montée : sa racine, son signe — le seul élément caché aux
  // technologies d'assistance —, et l'élément qui porte son libellé.
  function pastille(props) {
    const cible = monter(Pastille, props);
    const racine = cible.firstElementChild;
    const signe = racine.querySelector('[aria-hidden="true"]');
    const libelle = [...racine.querySelectorAll('*')].find((e) => [...e.childNodes].some((n) => n.nodeType === Node.TEXT_NODE && n.textContent.trim() !== '')) ?? racine;
    return { racine, signe, libelle };
  }

  test('un état du plan : le libellé de l’encre de la page sur le fond teinté de l’état, l’icône de l’état dans sa marque, dans les deux thèmes', async () => {
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        for (const etat of ETATS_PASTILLE) {
          const lieu = `${theme} ${etat}`;
          const { racine, signe, libelle } = pastille({ sorte: 'etat', valeur: etat, libelle: `Libellé ${etat}` });
          expect(racine.textContent.trim(), lieu).toBe(`Libellé ${etat}`);
          expect(visible(racine), lieu).toBe(true);
          expect(fond(racine), lieu).toEqual(jeton(`--couleur-etat-${etat}-fond`));
          expect(composantes(style(libelle).color), lieu).toEqual(jeton('--couleur-page-texte'));
          expect(signe.tagName.toLowerCase(), lieu).toBe('svg');
          expect(signe.querySelectorAll('path').length, lieu).toBe(ICONES[modelePastille('etat', etat).icone].length);
          expect(couleurSigne(signe), lieu).toEqual(jeton(`--couleur-etat-${etat}-marque`));
          exigerSigneVisible(signe, lieu);
          exigerLisible(libelle, lieu);
        }
      });
    }
  });

  test('une appartenance : le point de la marque de son rang sur son fond ; au-delà, le neutre ; le libellé reste le nom', async () => {
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        for (const rang of [...Array.from({ length: RANGS_APPARTENANCE }, (_, i) => i + 1), null]) {
          const lieu = `${theme} rang ${rang}`;
          const teinte = rang === null ? 'neutre' : `appartenance-${rang}`;
          const { racine, signe, libelle } = pastille({ sorte: 'appartenance', valeur: rang, libelle: 'Cercle des Aulnes' });
          expect(racine.textContent.trim(), lieu).toBe('Cercle des Aulnes');
          expect(signe.tagName.toLowerCase(), lieu).toBe('span');
          expect(signe.getBoundingClientRect().width, lieu).toBeGreaterThanOrEqual(6);
          expect(fond(racine), lieu).toEqual(jeton(`--couleur-${teinte}-fond`));
          expect(couleurSigne(signe), lieu).toEqual(jeton(`--couleur-${teinte}-marque`));
          exigerSigneVisible(signe, lieu);
          exigerLisible(libelle, lieu);
        }
      });
    }
  });

  test('un statut : le fond de son ton, sans signe ; une icône donnée se dessine dans la marque du ton', async () => {
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        for (const ton of TONS_PASTILLE) {
          const lieu = `${theme} ${ton}`;
          const teinte = modelePastille('statut', ton).teinte;
          const sans = pastille({ sorte: 'statut', valeur: ton, libelle: 'exclue' });
          expect(sans.signe, lieu).toBeNull();
          expect(fond(sans.racine), lieu).toEqual(jeton(`--couleur-${teinte}-fond`));
          exigerLisible(sans.libelle, lieu);
          const avec = pastille({ sorte: 'statut', valeur: ton, libelle: 'exclue', icone: 'croix' });
          expect(avec.signe.querySelectorAll('path').length, lieu).toBe(ICONES.croix.length);
          expect(couleurSigne(avec.signe), lieu).toEqual(jeton(`--couleur-${teinte}-marque`));
          exigerSigneVisible(avec.signe, lieu);
        }
      });
    }
  });

  // Un nom d'appartenance long, inventé : une donnée n'a pas de longueur
  // bornée.
  const LONG = 'Coopérative intercommunale des apiculteurs du littoral';

  test('un libellé long se replie dans la largeur donnée : le texte reste dans la pastille, la pastille dans son conteneur', () => {
    const { racine, libelle } = pastille({ sorte: 'appartenance', valeur: 2, libelle: LONG });
    const conteneur = racine.parentElement;
    conteneur.style.width = '120px';
    const droite = conteneur.getBoundingClientRect().right - parseFloat(style(conteneur).paddingRight);
    expect(racine.textContent.trim()).toBe(LONG);
    expect(bordDroitDuTexte(libelle)).toBeLessThanOrEqual(racine.getBoundingClientRect().right + 0.5);
    expect(racine.getBoundingClientRect().right).toBeLessThanOrEqual(droite + 0.5);
    expect(racine.scrollWidth).toBeLessThanOrEqual(racine.clientWidth + 1);
    // Le libellé replié reste sur le fond teinté, coins arrondis compris :
    // les coins extérieurs de sa première et de sa dernière ligne.
    const plage = document.createRange();
    plage.selectNodeContents(libelle);
    const lignes = [...plage.getClientRects()];
    expect(lignes.length).toBeGreaterThan(1);
    const boite = racine.getBoundingClientRect();
    const rayon = parseFloat(style(racine).borderTopLeftRadius);
    const [premiere, derniere] = [lignes[0], lignes.at(-1)];
    for (const [x, y, coin] of [
      [premiere.left, premiere.top, 'haut gauche'],
      [premiere.right, premiere.top, 'haut droit'],
      [derniere.left, derniere.bottom, 'bas gauche'],
      [derniere.right, derniere.bottom, 'bas droit'],
    ]) {
      expect(surLeFond(boite, rayon, x, y), `coin ${coin} du libellé hors du fond`).toBe(true);
    }
    exigerLisible(libelle, 'libellé replié');
  });

  test('un mot seul plus long que la place se coupe entre deux caractères, sans sortir de la pastille ni du conteneur', () => {
    const mot = 'Apiculteursintercommunauxdulittoral';
    const { racine, libelle } = pastille({ sorte: 'appartenance', valeur: 3, libelle: mot });
    const conteneur = racine.parentElement;
    conteneur.style.width = '120px';
    const droite = conteneur.getBoundingClientRect().right - parseFloat(style(conteneur).paddingRight);
    expect(racine.textContent.trim()).toBe(mot);
    expect(bordDroitDuTexte(libelle)).toBeLessThanOrEqual(racine.getBoundingClientRect().right + 0.5);
    expect(racine.getBoundingClientRect().right).toBeLessThanOrEqual(droite + 0.5);
  });

  test('dans la cellule d’un tableau de pleine largeur, un libellé long n’élargit pas le tableau', () => {
    const cible = document.createElement('div');
    cible.style.width = '300px';
    cible.style.backgroundColor = 'var(--couleur-page-fond)';
    const tableau = document.createElement('table');
    tableau.style.width = '100%';
    const cellule = tableau.insertRow().insertCell();
    cible.append(tableau);
    document.body.prepend(cible);
    const composant = mount(Pastille, { target: cellule, props: { sorte: 'appartenance', valeur: 2, libelle: LONG }, context: new Map([['t', t]]) });
    flushSync();
    montes.push({ composant, cible });
    const racine = cellule.firstElementChild;
    expect(tableau.getBoundingClientRect().width).toBeLessThanOrEqual(300);
    expect(racine.getBoundingClientRect().right).toBeLessThanOrEqual(cellule.getBoundingClientRect().right + 0.5);
  });

  test('un libellé court se tient sur une ligne, sans rognure ; une sorte ou une valeur hors contrat lève au montage', () => {
    const { racine, libelle } = pastille({ sorte: 'etat', valeur: 'propose', libelle: 'Proposé' });
    const plage = document.createRange();
    plage.selectNodeContents(libelle);
    expect(plage.getClientRects().length).toBe(1);
    expect(racine.scrollWidth).toBeLessThanOrEqual(racine.clientWidth + 1);
    expect(() => monter(Pastille, { sorte: 'etat', valeur: 'archive', libelle: 'x' })).toThrow(RangeError);
    expect(() => monter(Pastille, { sorte: 'appartenance', valeur: 9, libelle: 'x' })).toThrow(RangeError);
  });

  test('dans une rangée flexible trop étroite, un libellé court garde sa ligne : la pastille ne rétrécit pas sous son mot', () => {
    for (const largeur of [300, 200, 140]) {
      const cible = document.createElement('div');
      cible.style.cssText = `display:flex;gap:8px;width:${largeur}px`;
      const voisin = document.createElement('button');
      voisin.style.whiteSpace = 'nowrap';
      voisin.textContent = 'Ouvrir les tables et les sièges';
      document.body.prepend(cible);
      const composant = mount(Pastille, { target: cible, props: { sorte: 'etat', valeur: 'brouillon', libelle: 'Brouillon' }, context: new Map([['t', t]]) });
      cible.append(voisin);
      flushSync();
      montes.push({ composant, cible });
      const plage = document.createRange();
      plage.selectNodeContents(cible.querySelector('.libelle'));
      expect(plage.getClientRects().length, `${largeur} px`).toBe(1);
    }
  });

  test('une pastille de statut sans signe, repliée, garde son texte sur le fond aux coins de gauche', () => {
    const { racine, libelle } = pastille({ sorte: 'statut', valeur: 'neutre', libelle: LONG });
    racine.parentElement.style.width = '120px';
    const plage = document.createRange();
    plage.selectNodeContents(libelle);
    const lignes = [...plage.getClientRects()];
    expect(lignes.length).toBeGreaterThan(1);
    const boite = racine.getBoundingClientRect();
    const rayon = parseFloat(style(racine).borderTopLeftRadius);
    expect(surLeFond(boite, rayon, lignes[0].left, lignes[0].top), 'haut gauche').toBe(true);
    expect(surLeFond(boite, rayon, lignes.at(-1).left, lignes.at(-1).bottom), 'bas gauche').toBe(true);
  });
});

describe('carte', () => {
  test('titrée : une région nommée par son titre, au niveau donné, ses actions dans l’en-tête, son contenu dessous, son sous-titre', () => {
    const cible = monter(Carte, {
      titre: 'Participants',
      sousTitre: '13 personnes',
      niveau: 3,
      actions: snippet('<button type="button">Ajouter</button>'),
      children: snippet('<p>Contenu de la carte</p>'),
    });
    const region = cible.querySelector('section');
    expect(region).not.toBeNull();
    const titre = region.querySelector('h3');
    expect(titre.textContent.trim()).toBe('Participants');
    expect(region.getAttribute('aria-labelledby')).toBe(titre.id);
    expect(document.getElementById(region.getAttribute('aria-labelledby'))).toBe(titre);
    const action = region.querySelector('button');
    const contenu = [...region.querySelectorAll('p')].find((p) => p.textContent === 'Contenu de la carte');
    const sousTitre = [...region.querySelectorAll('p')].find((p) => p.textContent === '13 personnes');
    expect(action.getBoundingClientRect().top).toBeLessThan(contenu.getBoundingClientRect().top);
    expect(sousTitre.getBoundingClientRect().top).toBeGreaterThan(titre.getBoundingClientRect().top);
    expect(sousTitre.getBoundingClientRect().bottom).toBeLessThanOrEqual(contenu.getBoundingClientRect().top);
    expect(titre.compareDocumentPosition(contenu) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  test('l’habillage : fond de la carte, filet, rayon de 12 px, ombre ; titre et sous-titre lisibles, dans les deux thèmes', async () => {
    const cible = monter(Carte, { titre: 'Dossier de travail', sousTitre: 'Le dossier des événements', children: snippet('<p>Texte</p>') });
    const region = cible.querySelector('section');
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(region), theme).toEqual(jeton('--couleur-carte-fond'));
        expect(composantes(style(region).borderTopColor), theme).toEqual(jeton('--couleur-carte-filet'));
        expect(style(region).borderTopWidth, theme).toBe('1px');
        expect(style(region).borderTopLeftRadius, theme).toBe('12px');
        expect(style(region).boxShadow, theme).not.toBe('none');
        for (const texte of region.querySelectorAll('h2, p')) exigerLisible(texte, `${theme} ${texte.textContent}`);
        const sousTitre = [...region.querySelectorAll('p')].find((p) => p.textContent === 'Le dossier des événements');
        expect(composantes(style(sousTitre).color), theme).toEqual(jeton('--couleur-page-texte-secondaire'));
      });
    }
  });

  test('pleine, son contenu touche ses bords ; sinon il s’en écarte ; sans titre, une boîte sans nom ni titre ; une icône se dessine dans le titre', () => {
    const contenu = (props) => {
      const cible = monter(Carte, { ...props, children: snippet('<p>Bord</p>') });
      const p = [...cible.querySelectorAll('p')].find((x) => x.textContent === 'Bord');
      return { cible, gauche: p.getBoundingClientRect().left - cible.firstElementChild.getBoundingClientRect().left };
    };
    const pleine = contenu({ titre: 'Tableau', plein: true });
    const ecartee = contenu({ titre: 'Tableau' });
    expect(pleine.gauche).toBeLessThanOrEqual(1);
    expect(ecartee.gauche).toBeGreaterThanOrEqual(12);
    const sans = contenu({});
    expect(sans.cible.querySelector('section, h1, h2, h3, h4')).toBeNull();
    const avecIcone = monter(Carte, { titre: 'Démonstrations', icone: 'demarrer', children: snippet('<p>x</p>') });
    const svg = avecIcone.querySelector('h2 svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(avecIcone.querySelector('h2').textContent.trim()).toBe('Démonstrations');
  });
});

describe('commande : la variante', () => {
  const contexte = () => new Map([['t', t], ['horloge', creerHorlogePilotee()]]);
  const commande = (props) => monter(Commande, { cle: 'communs.commande.modifier', executer: () => undefined, ...props }, contexte()).querySelector('button');

  test('principale : pleine de la teinte de l’action, son texte, 44 px de haut au moins ; secondaire, la défaut : fond de la carte et filet ; discrète : ni fond ni filet visibles', async () => {
    const principale = commande({ variante: 'principale' });
    const secondaire = commande({});
    const discrete = commande({ variante: 'discrete' });
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(principale), theme).toEqual(jeton('--couleur-action-fond'));
        expect(composantes(style(principale).color), theme).toEqual(jeton('--couleur-action-texte'));
        expect(composantes(style(principale).borderTopColor), theme).toEqual(jeton('--couleur-action-fond'));
        expect(principale.getBoundingClientRect().height, theme).toBeGreaterThanOrEqual(44);
        expect(fond(secondaire), theme).toEqual(jeton('--couleur-carte-fond'));
        expect(composantes(style(secondaire).borderTopColor), theme).toEqual(jeton('--couleur-page-filet'));
        expect(composantes(style(secondaire).color), theme).toEqual(jeton('--couleur-page-texte'));
        expect(fond(discrete), theme).toEqual(TRANSPARENT);
        expect(composantes(style(discrete).borderTopColor)[3], theme).toBe(0);
        for (const [nom, bouton] of [['principale', principale], ['secondaire', secondaire], ['discrete', discrete]]) {
          exigerLisible(bouton, `${theme} ${nom}`);
        }
      });
    }
  });

  test('la variante ne change ni le nom accessible, ni la désignation, ni la hauteur d’une secondaire d’aujourd’hui ; une variante inconnue lève au montage', () => {
    const principale = commande({ variante: 'principale' });
    const secondaire = commande({});
    for (const bouton of [principale, secondaire]) {
      expect(bouton.textContent).toBe(t('communs.commande.modifier'));
      expect(bouton.getAttribute('data-commande')).toBe('modifier');
      expect(bouton.getAttribute('type')).toBe('button');
    }
    // Les mesures de la boîte d'une secondaire restent celles d'avant la
    // variante : la cible ne rapetisse pas.
    expect([style(secondaire).paddingTop, style(secondaire).paddingBottom, style(secondaire).borderTopWidth]).toEqual(['4px', '4px', '1px']);
    expect(style(secondaire).fontSize).toBe('16px');
    expect(() => commande({ variante: 'primaire' })).toThrow(RangeError);
  });
});

describe('refus, infobulle, champ et fenêtre à confirmer : habillés des jetons', () => {
  test('le refus : son fond et son filet, son trait de gauche, son icône, son texte lisible, dans les deux thèmes', async () => {
    const cible = monter(Refus, { refus: { code: 'MODE_LECTURE', details: { remede: null } } }, new Map([['t', t], ['seance', null]]));
    const refus = cible.querySelector('[role="status"]');
    const texte = refus.querySelector('p');
    const icone = refus.querySelector('svg');
    expect(icone.getAttribute('aria-hidden')).toBe('true');
    expect(texte.textContent.trim()).toBe(t('MODE_LECTURE', { remede: null }));
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(refus), theme).toEqual(jeton('--couleur-refus-fond'));
        expect(composantes(style(refus).borderLeftColor), theme).toEqual(jeton('--couleur-refus'));
        expect(composantes(style(refus).borderTopColor), theme).toEqual(jeton('--couleur-refus-filet'));
        expect(composantes(style(icone.querySelector('path')).stroke), theme).toEqual(jeton('--couleur-refus-marque'));
        exigerSigneVisible(icone, theme);
        exigerLisible(texte, theme);
      });
    }
  });

  test('l’infobulle : le fond et le filet de la carte, son texte lisible', async () => {
    const ancre = document.createElement('span');
    ancre.textContent = 'terme';
    Object.assign(ancre.style, { position: 'fixed', left: '40px', top: '40px' });
    document.body.append(ancre);
    try {
      const cible = monter(Infobulle, { id: 'infobulle-habillage', ouverte: { ancre, cle: 'propositions.explication.rencontresTous', details: {} }, fermer: () => undefined });
      flushSync();
      const bulle = cible.querySelector('[role="tooltip"]');
      for (const theme of THEMES) {
        await sousTheme(theme, () => {
          expect(fond(bulle), theme).toEqual(jeton('--couleur-carte-fond'));
          expect(composantes(style(bulle).borderTopColor), theme).toEqual(jeton('--couleur-carte-filet'));
          exigerLisible(bulle, theme);
        });
      }
    } finally {
      ancre.remove();
    }
  });

  test('le champ : l’entrée sur le fond de la carte, au filet de la page, arrondie ; la fenêtre à confirmer sur le fond de la carte', async () => {
    const champ = monter(
      Champ,
      { cle: 'nom', etiquette: 'communs.commande.modifier', valeur: 'Ombrelle', lire: (texte) => ({ valeur: texte }), executer: () => undefined },
      new Map([['t', t], ['seance', null]]),
    );
    const entree = champ.querySelector('input');
    const fenetre = monter(
      Confirmation,
      { titre: 'communs.remede.supprimerParticipant', elements: ['Iris Ombrelle'], surConfirmer: () => undefined, surAnnuler: () => undefined },
      new Map([['t', t], ['seance', null], ['horloge', creerHorlogePilotee()]]),
    ).querySelector('dialog');
    for (const theme of THEMES) {
      await sousTheme(theme, () => {
        expect(fond(entree), theme).toEqual(jeton('--couleur-carte-fond'));
        expect(composantes(style(entree).borderTopColor), theme).toEqual(jeton('--couleur-page-filet'));
        expect(style(entree).borderTopLeftRadius, theme).toBe('8px');
        expect(fond(fenetre), theme).toEqual(jeton('--couleur-carte-fond'));
      });
    }
    fenetre.close();
  });
});
