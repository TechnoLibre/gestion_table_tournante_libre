// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le panneau d'historique dans un vrai moteur de rendu (§ 8.3, § 8.4) : la
// liste des instants, la plus récente d'abord, chacun par son heure, en
// chiffres tabulaires, et son libellé figé ; l'instant courant — la ligne
// la plus récente — et le fil abandonné marqués ; un nom donné à l'instant
// courant qui se montre aussitôt sur sa ligne ; « Revenir à cet instant » ;
// le filtre des instants nommés ; les pages ; l'état sur le disque plus
// récent que le journal, ou sans journal ; la lecture, où la liste se lit
// et chaque commande refuse avec « Modifier ». Chaque épreuve monte App
// par monterApp, sur le système de fichiers simulé, au cadre de
// 1 366 × 700, ouvre le panneau par son bouton et lit le rendu.
//
// Les éléments s'atteignent par leurs attributs data-… :
// data-panneau="historique", le panneau ; data-revision et data-fil, une
// ligne ; data-pastille-instant, une pastille d'une ligne ; data-vide, le
// message d'une liste vide ; data-reprise, l'annonce d'un journal en
// retard. Le texte attendu vient de la même traduction que celle de
// l'application, et les libellés figés du journal relu ; les noms
// d'épreuve sont inventés.
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION, libelle } from '../../application/libelles.js';
import { creerFormat } from '../../application/format.js';
import { creerTraduction } from '../../application/traduction.js';
import { serialiser } from '../../stockage/canonique.js';
import { analyser } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { visible } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { etendueHistorique } from './historique.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);

const NOMS = ['Brindille', 'Cornouille', 'Pimprenelle', 'Saxifrage', 'Tormentille'];
const EVENEMENT = { nom: 'Cercle des Orvets', date: null, siegesParDefaut: 4, tours: 2 };

let montes = [];
async function monter(options) {
  const m = await monterApp(options);
  montes.push(m);
  return m;
}
beforeEach(async () => {
  await fixerCadre(1366, 700);
});
afterEach(() => {
  const erreurs = montes.flatMap((m) => m.erreurs());
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  window.scrollTo(0, 0);
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

// --- Les lectures du rendu ----------------------------------------------------

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const texteDe = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const panneau = (m) => dans(m, '[data-panneau="historique"]');
const bouton = (m) => dans(m, '[data-historique] [data-commande="historique"]');
const lignes = (m) => [...panneau(m).querySelectorAll('li[data-revision]')];
const ligne = (m, revision) => panneau(m).querySelector(`li[data-revision="${revision}"]`);
const revisionsLues = (m) => lignes(m).map((li) => Number(li.dataset.revision));
const libelleDe = (li) => texteDe(li.querySelector('.libelle'));
const pastilles = (li, sorte) => [...li.querySelectorAll(`[data-pastille-instant="${sorte}"]`)].map(texteDe);
const commandeDe = (racine, nom) => racine?.querySelector(`[data-commande="${nom}"]`) ?? null;
const refusPres = (element, code) => element.parentElement.querySelector(`[data-refus="${code}"]`);

// Attend que l'assertion passe, le rendu de Svelte à jour.
async function attendre(assertion) {
  for (let essai = 0; ; essai += 1) {
    flushSync();
    try {
      return assertion();
    } catch (erreur) {
      if (essai >= 200) throw erreur;
      await new Promise((resoudre) => requestAnimationFrame(resoudre));
    }
  }
}

// --- Les événements d'épreuve ---------------------------------------------------

const baseDe = (m) => m.seance.etat().evenement.base;
const journalDe = (m) => lireJournal(m.fs.contenu('documents', `${baseDe(m)}${SUFFIXES.journal}`));
const quandDe = (horodatage) => `${horodatage.slice(0, 10)} ${horodatage.slice(11, 16)}`;

// Un montage où l'événement neuf est ouvert ; en écriture, garni de n
// personnes, quand n est donné.
async function ouvert({ n = 0, ecriture = true } = {}) {
  const m = await monter();
  await m.seance.creer(EVENEMENT);
  if (ecriture) await m.seance.passerEnEcriture();
  for (let rang = 0; rang < n; rang += 1) {
    await m.seance.executer('ajouterParticipant', { champs: { nom: `${NOMS[rang % NOMS.length]} ${rang + 1}` } });
  }
  flushSync();
  return m;
}

// Ouvre le panneau par son bouton.
async function ouvrirPanneau(m) {
  bouton(m).click();
  await attendre(() => expect(panneau(m)).not.toBeNull());
}

// Un clic réel au centre d'un élément : l'appui retire le focus du champ
// qui l'avait, et le champ valide sa saisie avant le clic.
async function cliquer(element) {
  const { left, top, width, height } = element.getBoundingClientRect();
  await pointer('presser', left + width / 2, top + height / 2);
  await pointer('relacher', left + width / 2, top + height / 2);
  flushSync();
}

// Saisit texte dans le champ du nom, la valeur courante remplacée.
async function saisirNom(m, texte) {
  const entree = panneau(m).querySelector('[data-champ="nomInstant"]');
  entree.focus();
  entree.select();
  for (const caractere of texte) await touche(caractere);
  flushSync();
  return entree;
}

// --- Les épreuves -----------------------------------------------------------------

describe('la liste des instants (§ 8.3)', () => {
  test('trois gestes : la plus récente d’abord, chacune par son heure « AAAA-MM-JJ HH:MM » et son libellé figé ; la dernière porte « instant courant » et n’offre pas le retour', async () => {
    const m = await ouvert({ n: 3 });
    await ouvrirPanneau(m);
    const { entrees } = journalDe(m);
    expect(entrees.length).toBe(4);
    expect(revisionsLues(m)).toEqual(entrees.map(({ revision }) => revision).reverse());
    lignes(m).forEach((li, rang) => {
      const entree = entrees[entrees.length - 1 - rang];
      expect(libelleDe(li)).toBe(entree.libelle);
      expect(texteDe(li.querySelector('.quand'))).toBe(quandDe(entree.horodatage));
      expect(texteDe(li.querySelector('.quand'))).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
      expect(getComputedStyle(li.querySelector('.quand')).fontVariantNumeric).toContain('tabular-nums');
      expect(li.dataset.fil).toBe('courant');
    });
    const [premiere, ...autres] = lignes(m);
    expect(pastilles(premiere, 'courant')).toEqual([t('evenement.historique.courant')]);
    expect(commandeDe(premiere, 'revenir')).toBeNull();
    for (const li of autres) {
      expect(pastilles(li, 'courant')).toEqual([]);
      expect(texteDe(commandeDe(li, 'revenir'))).toBe(t('evenement.historique.revenir'));
    }
    // La création porte son jalon automatique.
    expect(pastilles(lignes(m).at(-1), 'jalon')).toEqual([libelle('JALON_CREATION')]);
    // « Revenir » se nomme par son instant : deux lignes ne se confondent pas.
    const noms = autres.map((li) => commandeDe(li, 'revenir').getAttribute('aria-label'));
    expect(new Set(noms).size).toBe(noms.length);
    expect(noms[0]).toContain(libelleDe(autres[0]));
  });

  test('« Défaire » puis un geste : la ligne défaite est d’un fil abandonné, marquée et d’encre secondaire ; elle offre le retour', async () => {
    const m = await ouvert({ n: 2 });
    const defaite = m.seance.etat().evenement.revision;
    await m.seance.defaire();
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Mélilot' } });
    await ouvrirPanneau(m);
    const abandonnee = ligne(m, defaite);
    expect(abandonnee.dataset.fil).toBe('abandonne');
    expect(pastilles(abandonnee, 'abandonne')).toEqual([t('evenement.historique.abandonne')]);
    expect(commandeDe(abandonnee, 'revenir')).not.toBeNull();
    const encre = getComputedStyle(abandonnee.querySelector('.libelle')).color;
    expect(encre).toBe(getComputedStyle(abandonnee.querySelector('.quand')).color);
    expect(encre).not.toBe(getComputedStyle(lignes(m)[0].querySelector('.libelle')).color);
    // Le retour du défaire est sur le fil courant ; aucune autre ligne
    // n'est abandonnée.
    expect(lignes(m).filter((li) => li.dataset.fil === 'abandonne').map((li) => Number(li.dataset.revision))).toEqual([defaite]);
  });

  test('« Revenir à cet instant » ajoute une ligne « Retour à … » en tête, qui devient l’instant courant ; la ligne visée garde « Revenir », refusé comme sans effet ; les instants qui la suivaient sont d’un fil abandonné ; un jalon posé ensuite se montre sur l’instant courant', async () => {
    const m = await ouvert({ n: 3 });
    await ouvrirPanneau(m);
    const [quatrieme, troisieme, visee] = lignes(m);
    const revisionVisee = Number(visee.dataset.revision);
    const libelleVise = libelleDe(visee);
    commandeDe(visee, 'revenir').click();
    await attendre(() => expect(libelleDe(lignes(m)[0])).toBe(libelle('ENTREE_REVENIR', { libelle: libelleVise })));
    const retour = lignes(m)[0];
    expect(retour.dataset.fil).toBe('retour');
    expect(pastilles(retour, 'courant')).toEqual([t('evenement.historique.courant')]);
    expect(pastilles(retour, 'abandonne')).toEqual([]);
    expect(commandeDe(retour, 'revenir')).toBeNull();
    expect(lignes(m).filter((li) => pastilles(li, 'courant').length > 0)).toEqual([retour]);
    for (const avant of [quatrieme, troisieme]) {
      const li = ligne(m, avant.dataset.revision);
      expect(li.dataset.fil).toBe('abandonne');
      expect(pastilles(li, 'abandonne')).toEqual([t('evenement.historique.abandonne')]);
    }
    expect(m.seance.etat().charge.participants).toHaveLength(1);
    // La ligne visée a le contenu courant : son « Revenir » refuse à côté
    // de lui, et rien ne s'écrit.
    const avant = m.trace.length;
    const revenir = commandeDe(ligne(m, revisionVisee), 'revenir');
    expect(pastilles(ligne(m, revisionVisee), 'courant')).toEqual([]);
    revenir.click();
    const refus = await attendre(() => {
      const element = refusPres(revenir, 'SANS_EFFET');
      expect(element).not.toBeNull();
      return element;
    });
    expect(texteDe(refus)).toContain(t('SANS_EFFET', { sens: 'revenir' }));
    expect(m.trace.length).toBe(avant);
    // Un jalon posé ensuite porte la révision du retour : sa pastille se
    // montre sur la ligne du retour, à côté de « instant courant ».
    await m.seance.nommer('Après le retour');
    await attendre(() => expect(pastilles(lignes(m)[0], 'jalon')).toEqual(['Après le retour']));
    expect(pastilles(lignes(m)[0], 'courant')).toEqual([t('evenement.historique.courant')]);
    expect(pastilles(lignes(m)[0], 'abandonne')).toEqual([]);
  });
});

describe('nommer l’instant courant (§ 8.3)', () => {
  test('un nom saisi puis « Nommer » : la pastille du jalon se montre aussitôt sur l’instant courant, et le champ se vide ; la révision ne change pas', async () => {
    const m = await ouvert({ n: 2 });
    await ouvrirPanneau(m);
    const revision = m.seance.etat().evenement.revision;
    await saisirNom(m, 'Avant le tirage');
    await cliquer(commandeDe(panneau(m), 'nommer'));
    await attendre(() => expect(pastilles(ligne(m, revision), 'jalon')).toEqual(['Avant le tirage']));
    expect(m.seance.etat().evenement.revision).toBe(revision);
    expect(panneau(m).querySelector('[data-champ="nomInstant"]').value).toBe('');
    expect(journalDe(m).jalons.at(-1)).toMatchObject({ revision, nom: 'Avant le tirage' });
  });

  test('« Défaire » puis un nom saisi et « Nommer » : la pastille du nom et « instant courant » sont sur la même ligne, la plus récente', async () => {
    const m = await ouvert({ n: 3 });
    await m.seance.defaire();
    await ouvrirPanneau(m);
    await saisirNom(m, 'Essai');
    await cliquer(commandeDe(panneau(m), 'nommer'));
    await attendre(() => expect(panneau(m).querySelectorAll('[data-pastille-instant="jalon"]')).toHaveLength(2));
    const nommee = lignes(m).filter((li) => pastilles(li, 'jalon').includes('Essai'));
    const courantes = lignes(m).filter((li) => pastilles(li, 'courant').length > 0);
    expect(nommee).toEqual([lignes(m)[0]]);
    expect(courantes).toEqual(nommee);
    expect(Number(nommee[0].dataset.revision)).toBe(m.seance.etat().evenement.revision);
  });

  test('« Nommer » sans nom est refusé à côté de lui, et rien ne s’écrit', async () => {
    const m = await ouvert({ n: 1 });
    await ouvrirPanneau(m);
    const avant = m.trace.length;
    const nommer = commandeDe(panneau(m), 'nommer');
    nommer.click();
    await attendre(() => expect(refusPres(nommer, 'NOM_REQUIS')).not.toBeNull());
    expect(m.trace.length).toBe(avant);
  });

  test('un jalon posé par la séance, panneau ouvert, se montre sans que rien d’autre ne change', async () => {
    const m = await ouvert({ n: 1 });
    await ouvrirPanneau(m);
    const revision = m.seance.etat().evenement.revision;
    await m.seance.nommer('Vu de loin');
    await attendre(() => expect(pastilles(ligne(m, revision), 'jalon')).toEqual(['Vu de loin']));
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Orpin' } });
    await attendre(() => expect(revisionsLues(m)[0]).toBe(revision + 1));
  });
});

describe('le filtre des instants nommés', () => {
  test('la case ne garde que les instants nommés ; décochée, toutes les lignes reviennent ; rien ne s’écrit', async () => {
    const m = await ouvert({ n: 3 });
    await m.seance.nommer('Mi-chemin');
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Orpin' } });
    await ouvrirPanneau(m);
    const toutes = revisionsLues(m);
    expect(toutes).toHaveLength(5);
    const avant = m.trace.length;
    const caseJalons = panneau(m).querySelector('[data-jalons-seuls]');
    expect(caseJalons.labels[0].textContent).toBe(t('evenement.historique.jalonsSeuls'));
    caseJalons.click();
    await attendre(() => expect(revisionsLues(m)).toEqual([4, 1]));
    caseJalons.click();
    await attendre(() => expect(revisionsLues(m)).toEqual(toutes));
    expect(m.trace.length).toBe(avant);
  });
});

describe('les pages de l’historique', () => {
  test('105 instants : la page 1 en montre 100 et « Suivants » ; la page 2 les 5 plus anciens, le focus sur l’étendue ; rien ne s’écrit', async () => {
    const m = await ouvert({ n: 104 });
    await ouvrirPanneau(m);
    const revisions = journalDe(m).entrees.map(({ revision }) => revision).reverse();
    expect(revisions).toHaveLength(105);
    expect(revisionsLues(m)).toEqual(revisions.slice(0, 100));
    const nav = (ou) => panneau(m).querySelector(`nav[data-pages="${ou}"]`);
    const etendue = (ou) => nav(ou).querySelector('[data-etendue]');
    const etendueAttendue = (premier, dernier) => etendueHistorique({ premier, dernier, total: 105 }, { t, format });
    expect(nav('haut').getAttribute('aria-label')).toBe(t('evenement.historique.pages.haut'));
    expect(texteDe(etendue('haut'))).toBe(etendueAttendue(1, 100));
    expect(commandeDe(nav('haut'), 'precedentes')).toBeNull();
    expect(texteDe(commandeDe(nav('haut'), 'suivantes'))).toBe(t('evenement.historique.pages.suivants'));
    // Le panneau défile seul : la page dépasse sa boîte, tenue dans la
    // fenêtre ; défilé jusqu'au bout, il montre la navigation du bas dans
    // sa boîte, sans que ni lui, ni la page, ni la surface ne bougent.
    const surface = () => dans(m, '[data-section]').parentElement.getBoundingClientRect().toJSON();
    const surfaceAvant = surface();
    const pageAvant = document.scrollingElement.scrollTop;
    const cadreAvant = panneau(m).getBoundingClientRect().toJSON();
    expect(getComputedStyle(panneau(m)).overflowY).toBe('auto');
    expect(panneau(m).scrollHeight).toBeGreaterThan(panneau(m).clientHeight);
    expect(cadreAvant.bottom).toBeLessThanOrEqual(innerHeight);
    panneau(m).scrollTop = panneau(m).scrollHeight;
    await new Promise((resoudre) => requestAnimationFrame(resoudre));
    expect(panneau(m).scrollTop).toBeGreaterThan(0);
    const cadre = panneau(m).getBoundingClientRect();
    expect(cadre.toJSON()).toEqual(cadreAvant);
    const bas = nav('bas').getBoundingClientRect();
    expect(bas.top).toBeGreaterThanOrEqual(cadre.top);
    expect(bas.bottom).toBeLessThanOrEqual(cadre.bottom);
    expect(nav('bas').contains(document.elementFromPoint(bas.left + bas.width / 2, bas.top + bas.height / 2))).toBe(true);
    expect(document.scrollingElement.scrollTop).toBe(pageAvant);
    expect(surface()).toEqual(surfaceAvant);
    const avant = m.trace.length;
    commandeDe(nav('bas'), 'suivantes').click();
    await attendre(() => expect(revisionsLues(m)).toEqual(revisions.slice(100)));
    await attendre(() => expect(document.activeElement).toBe(etendue('haut')));
    expect(texteDe(etendue('bas'))).toBe(etendueAttendue(101, 105));
    expect(commandeDe(nav('haut'), 'suivantes')).toBeNull();
    expect(texteDe(commandeDe(nav('haut'), 'precedentes'))).toBe(t('evenement.historique.pages.precedents'));
    expect(m.trace.length).toBe(avant);
  });
});

describe('le journal en retard ou absent (§ 8.6)', () => {
  test('le journal et l’état qui ne finissent pas au même instant : l’annonce de la reprise, les lignes du journal, aucune « instant courant »', async () => {
    const m = await ouvert({ n: 2 });
    const base = baseDe(m);
    await m.seance.fermer();
    const chemin = `${base}${SUFFIXES.etat}`;
    const { entete, charge } = analyser(m.fs.contenu('documents', chemin));
    m.fs.deposer('documents', chemin, serialiser(charge, { revision: entete.revision + 1, produitVersion: entete.produitVersion }));
    await m.seance.ouvrir(base);
    flushSync();
    await ouvrirPanneau(m);
    expect(texteDe(panneau(m).querySelector('[data-reprise]'))).toBe(t('evenement.historique.reprise'));
    expect(lignes(m)).toHaveLength(3);
    expect(panneau(m).querySelectorAll('[data-pastille-instant="courant"]')).toHaveLength(0);
    for (const li of lignes(m)) expect(commandeDe(li, 'revenir')).not.toBeNull();
  });

  test('sans journal : l’annonce de la reprise et « Aucun instant enregistré. »', async () => {
    const m = await ouvert({ n: 1 });
    const base = baseDe(m);
    await m.seance.fermer();
    await m.fs.supprimer({ id: 'documents' }, `${base}${SUFFIXES.journal}`);
    await m.seance.ouvrir(base);
    flushSync();
    await ouvrirPanneau(m);
    expect(panneau(m).querySelector('[data-reprise]')).not.toBeNull();
    const vide = panneau(m).querySelector('[data-vide]');
    expect(vide.dataset.vide).toBe('aucunInstant');
    expect(texteDe(vide)).toBe(t('evenement.historique.aucunInstant'));
    expect(panneau(m).querySelector('ol')).toBeNull();
  });
});

describe('en lecture (§ 8.4)', () => {
  test('la liste se lit ; « Revenir » et « Nommer » refusent à côté d’eux avec « Modifier », et rien ne s’écrit', async () => {
    const m = await ouvert({ n: 2 });
    await m.seance.passerEnLecture();
    flushSync();
    const avant = m.trace.length;
    await ouvrirPanneau(m);
    expect(lignes(m)).toHaveLength(3);
    expect(visible(lignes(m)[0])).toBe(true);
    const revenir = commandeDe(lignes(m)[1], 'revenir');
    revenir.click();
    const refus = await attendre(() => {
      const element = refusPres(revenir, 'MODE_LECTURE');
      expect(element).not.toBeNull();
      return element;
    });
    expect(texteDe(commandeDe(refus, 'modifier'))).toBe(t('communs.remede.modifier'));
    const nommer = commandeDe(panneau(m), 'nommer');
    nommer.click();
    await attendre(() => expect(refusPres(nommer, 'MODE_LECTURE')).not.toBeNull());
    expect(m.trace.length).toBe(avant);
    expect(lignes(m)).toHaveLength(3);
  });
});
