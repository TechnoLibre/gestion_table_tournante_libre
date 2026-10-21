// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La question du papier dans un vrai moteur de rendu (§ 8.5, § 11.2) : le
// composant que l'aperçu et la section des badges partagent. Sans papier,
// il pose la question, un choix par papier de PAPIERS ; avec un papier, il
// le montre, « Papier : A4 », et offre de le changer. Choisir passe par
// seance.choisirPapier ; un refus s'affiche sur le choix, la question reste
// et onChoisi n'est pas appelé. Le composant est monté seul, sur une séance
// d'épreuve qui suit le contrat de magasin de la séance et relève ce qu'on
// lui demande ; l'aperçu l'éprouve sur la vraie séance
// (Apercu.navigateur.test.js).
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import '../jetons.css';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { couleurDeJeton } from '../../../test/navigateur/captures.js';
import { attendre } from '../../../test/navigateur/ecrans.js';
import { composantes, couleurTexte, fondPeintSous, sousTheme } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Papier from './Papier.svelte';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une séance d'épreuve : le contrat de magasin, le papier de l'état, et
// choisirPapier, qui relève chaque demande, puis lève refus s'il est donné,
// ou pose le papier et publie.
function seanceDEpreuve(papier, { refus = null } = {}) {
  let etat = Object.freeze({ papier });
  const abonnes = new Set();
  const demandes = [];
  return {
    demandes,
    subscribe(fn) {
      abonnes.add(fn);
      fn(etat);
      return () => abonnes.delete(fn);
    },
    etat: () => etat,
    async choisirPapier(choix) {
      demandes.push(choix);
      if (refus !== null) throw refus;
      etat = Object.freeze({ papier: choix });
      for (const fn of [...abonnes]) fn(etat);
    },
  };
}

const montes = [];
afterEach(() => {
  for (const { composant, conteneur } of montes.splice(0)) {
    unmount(composant);
    conteneur.remove();
  }
});

// Monte Papier dans un conteneur neuf, sur la séance donnée.
function monter(seance, props = {}) {
  const conteneur = document.createElement('div');
  document.body.prepend(conteneur);
  const contexte = new Map([
    ['t', t],
    ['seance', seance],
    ['horloge', creerHorlogePilotee()],
  ]);
  const composant = mount(Papier, { target: conteneur, props, context: contexte });
  flushSync();
  montes.push({ composant, conteneur });
  return conteneur;
}

const texte = (element) => element.textContent.replace(/\s+/g, ' ').trim();
const choix = (conteneur, papier) => conteneur.querySelector(`[data-papier="question"] [data-cible="${papier}"] [data-commande="choisirPapier"]`);

describe('la question du papier (§ 8.5, § 11.2)', () => {
  test('sans papier : la question, son explication, un choix par papier de PAPIERS, dans leur ordre, chacun décrit ; rien n’est montré comme choisi', () => {
    const conteneur = monter(seanceDEpreuve(null));
    const question = conteneur.querySelector('[data-papier="question"]');
    expect(question).not.toBeNull();
    expect(texte(question)).toContain(t('impression.papier.question'));
    expect(texte(question)).toContain(t('impression.papier.explication'));
    const offerts = [...question.querySelectorAll('[data-cible]')].map((e) => e.dataset.cible);
    expect(offerts).toEqual(Object.keys(PAPIERS));
    expect(texte(choix(conteneur, 'A4'))).toBe(t('impression.papier.choix.a4'));
    expect(texte(choix(conteneur, 'Lettre'))).toBe(t('impression.papier.choix.lettre'));
    expect(conteneur.querySelector('[data-papier="choisi"]')).toBeNull();
  });

  test('choisir demande le papier à la séance, une fois ; la question cède la place au papier choisi, et onChoisi le reçoit', async () => {
    const seance = seanceDEpreuve(null);
    const onChoisi = vi.fn();
    const conteneur = monter(seance, { onChoisi });
    choix(conteneur, 'Lettre').click();
    await attendre('le papier choisi', () => conteneur.querySelector('[data-papier="choisi"]'));
    // onChoisi suit l'écriture faite : il s'appelle une fois le papier rendu.
    await attendre('onChoisi appelé', () => onChoisi.mock.calls.length > 0);
    expect(seance.demandes).toEqual(['Lettre']);
    expect(onChoisi).toHaveBeenCalledTimes(1);
    expect(onChoisi).toHaveBeenCalledWith('Lettre');
    expect(conteneur.querySelector('[data-papier="question"]')).toBeNull();
    const choisi = texte(conteneur.querySelector('[data-papier="choisi"]'));
    expect(choisi).toContain(t('impression.papier.titre'));
    expect(choisi).toContain(t('impression.papier.nom.lettre'));
  });

  test('avec un papier : « Papier : A4 — Changer » ; changer rouvre la question, et le nouveau choix se demande', async () => {
    const seance = seanceDEpreuve('A4');
    const conteneur = monter(seance);
    expect(conteneur.querySelector('[data-papier="question"]')).toBeNull();
    const choisi = conteneur.querySelector('[data-papier="choisi"]');
    expect(texte(choisi)).toContain(t('impression.papier.nom.a4'));
    const changer = choisi.querySelector('[data-commande="changerPapier"]');
    expect(texte(changer)).toBe(t('impression.papier.changer'));
    changer.click();
    await attendre('la question rouverte', () => conteneur.querySelector('[data-papier="question"]'));
    choix(conteneur, 'Lettre').click();
    await attendre('le papier changé', () => conteneur.querySelector('[data-papier="choisi"]'));
    expect(seance.demandes).toEqual(['Lettre']);
    expect(texte(conteneur.querySelector('[data-papier="choisi"]'))).toContain(t('impression.papier.nom.lettre'));
  });

  test('avec un défaut et sans papier : le défaut se montre, sans question ; « Changer » rouvre la question, et le choix se demande ; un papier de la machine l’emporte', async () => {
    const seance = seanceDEpreuve(null);
    const onChoisi = vi.fn();
    const conteneur = monter(seance, { defaut: 'Lettre', onChoisi });
    expect(conteneur.querySelector('[data-papier="question"]')).toBeNull();
    expect(texte(conteneur.querySelector('[data-papier="choisi"]'))).toContain(t('impression.papier.nom.lettre'));
    expect(seance.demandes).toEqual([]);
    conteneur.querySelector('[data-papier="choisi"] [data-commande="changerPapier"]').click();
    await attendre('la question ouverte', () => conteneur.querySelector('[data-papier="question"]'));
    choix(conteneur, 'A4').click();
    await attendre('onChoisi appelé', () => onChoisi.mock.calls.length > 0);
    expect(seance.demandes).toEqual(['A4']);
    expect(onChoisi).toHaveBeenCalledWith('A4');
    expect(texte(conteneur.querySelector('[data-papier="choisi"]'))).toContain(t('impression.papier.nom.a4'));
  });

  test('un choix refusé : le refus s’affiche sur le choix, la question reste, onChoisi n’est pas appelé', async () => {
    const refus = { code: 'REGLAGES_ILLISIBLES', details: { chemin: 'reglages_locaux.json', raison: 'JSON' } };
    const seance = seanceDEpreuve(null, { refus });
    const onChoisi = vi.fn();
    const conteneur = monter(seance, { onChoisi });
    choix(conteneur, 'A4').click();
    const affiche = await attendre('le refus', () => conteneur.querySelector('[data-cible="A4"] [data-refus="REGLAGES_ILLISIBLES"]'));
    expect(texte(affiche.querySelector('p'))).toBe(t(refus.code, refus.details).replace(/\s+/g, ' ').trim());
    expect(conteneur.querySelector('[data-papier="question"]')).not.toBeNull();
    expect(onChoisi).not.toHaveBeenCalled();
    expect(seance.demandes).toEqual(['A4']);
  });
});

describe('l’habillage de la question du papier', () => {
  test('chaque papier est un choix distinct : une tuile à son filet, qui ne chevauche pas sa voisine, et son bouton la remplit sur 44 px de haut au moins', () => {
    const conteneur = monter(seanceDEpreuve(null));
    const tuiles = [...conteneur.querySelectorAll('[data-papier="question"] [data-cible]')];
    expect(tuiles.map((tuile) => tuile.dataset.cible)).toEqual(Object.keys(PAPIERS));
    const filet = couleurDeJeton('--couleur-carte-filet').join();
    for (const tuile of tuiles) {
      const style = getComputedStyle(tuile);
      expect(style.borderTopWidth, tuile.dataset.cible).toBe('1px');
      expect(composantes(style.borderTopColor).join(), tuile.dataset.cible).toBe(filet);
      expect(Number.parseFloat(style.borderTopLeftRadius), tuile.dataset.cible).toBeGreaterThanOrEqual(8);
      const bouton = tuile.querySelector('[data-commande="choisirPapier"]');
      const b = bouton.getBoundingClientRect();
      expect(b.height, tuile.dataset.cible).toBeGreaterThanOrEqual(44);
      expect(b.width, tuile.dataset.cible).toBeGreaterThanOrEqual(tuile.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight) - 1);
    }
    const [a, b] = tuiles.map((tuile) => tuile.getBoundingClientRect());
    const chevauchent = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(chevauchent).toBe(false);
  });

  test('le papier choisi se montre dans une pastille neutre, son nom de l’encre de la page, dans les deux thèmes', async () => {
    const conteneur = monter(seanceDEpreuve('A4'));
    const choisi = conteneur.querySelector('[data-papier="choisi"]');
    const nom = [...choisi.querySelectorAll('span')].find((span) => texte(span) === t('impression.papier.nom.a4') && span.children.length === 0);
    expect(nom).toBeDefined();
    for (const theme of ['clair', 'sombre']) {
      await sousTheme(theme, async () => {
        const [fond] = fondPeintSous(nom);
        expect(fond.join(), theme).toBe(couleurDeJeton('--couleur-neutre-fond').join());
        expect(couleurTexte(nom).join(), theme).toBe(couleurDeJeton('--couleur-page-texte').join());
      });
    }
  });
});
