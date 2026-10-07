// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des primitives dans un vrai moteur de rendu (§ 2.1, § 5.9, § 8.2,
// § 8.4, § 8.5) : le champ, le refus, la fenêtre à confirmer et la commande,
// montés chacun par mount avec les contextes que pose App — 'seance', 't',
// 'horloge' —, sur une séance créée sur le système de fichiers simulé et
// l'horloge pilotée : rien n'attend le temps réel, et chaque écriture se
// compte. Les gestes passent par des entrées que Chromium traite comme
// réelles (test/navigateur/entrees.js). Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, describe, expect, test, vi } from 'vitest';
import { flushSync, mount, tick, unmount } from 'svelte';
import '../jetons.css';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerHorlogePilotee } from '../../application/horloge.js';
import { INACTIVITE_MS, creerSeance } from '../../application/seance.js';
import { creerTraduction } from '../../application/traduction.js';
import { serialiserCharge } from '../../stockage/canonique.js';
import { lireJournal, reconstruire } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { creerFichiersSimules } from '../../../test/fichiers_simules.js';
import { pointer, touche } from '../../../test/navigateur/entrees.js';
import { visible } from '../../../test/navigateur/rendu.js';
import { TABLES_INTERFACE } from '../libelles.js';
import Champ from './Champ.svelte';
import Commande from './Commande.svelte';
import Confirmation from './Confirmation.svelte';
import { DELAI_CONFIRMATION_MS } from './commande.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const EVENEMENT = 'Soirée des Merles';
const NOM = 'Ombrelle';

// Les composants montés par l'épreuve courante, et leurs conteneurs.
const montes = [];

afterEach(() => {
  for (const { composant, cible } of montes.splice(0)) {
    unmount(composant);
    cible.remove();
  }
  vi.restoreAllMocks();
});

// Une séance sur le système simulé et l'horloge pilotée, un événement créé,
// Iris Ombrelle ajoutée (participant 1) ; puis bloque : plan bloqué, et la
// séance revient seule en lecture ; mode 'lecture' : retour en lecture.
async function preparer({ mode = 'ecriture', bloque = false } = {}) {
  const fs = creerFichiersSimules();
  fs.deposerDossier('documents');
  const { documents } = await fs.racines();
  const horloge = creerHorlogePilotee();
  let tirages = 0;
  const seance = creerSeance({
    fs,
    racine: documents,
    horloge,
    identifiant: () => {
      tirages += 1;
      return `epreuve-${tirages}`;
    },
    produitVersion: VERSION.affichee,
    planifier: horloge.planifier,
    annuler: horloge.annuler,
  });
  await seance.creer({ nom: EVENEMENT, date: null, siegesParDefaut: 6, tours: 2 });
  await seance.passerEnEcriture();
  await seance.executer('ajouterParticipant', { champs: { nom: NOM, prenom: 'Iris' } });
  if (bloque) await seance.executer('changerEtat', { etat: 'bloque' });
  if (mode === 'lecture') await seance.passerEnLecture();
  const base = seance.etat().evenement.base;
  const contexte = new Map([
    ['seance', seance],
    ['t', t],
    ['horloge', horloge],
  ]);
  return { fs, horloge, seance, base, contexte };
}

// Monte un composant dans un conteneur neuf, au début du corps.
function monter(Composant, props, contexte) {
  const cible = document.createElement('div');
  document.body.prepend(cible);
  const composant = mount(Composant, { target: cible, props, context: contexte });
  flushSync();
  montes.push({ composant, cible });
  return cible;
}

// Le champ du nom d'Iris : lire refuse un texte blanc, NOM_REQUIS ; executer
// passe par la séance, et chaque promesse rendue se garde dans attentes.
function monterChamp(montage) {
  const attentes = [];
  const props = {
    cle: 'nom',
    etiquette: 'communs.commande.modifier',
    valeur: NOM,
    lire: (texte) => (texte.trim() === '' ? { refus: { code: 'NOM_REQUIS', details: { remede: null } } } : { valeur: texte.trim() }),
    executer: (valeur) => {
      const promesse = montage.seance.executer('modifierParticipant', { id: 1, champs: { nom: valeur } });
      attentes.push(promesse);
      return promesse;
    },
  };
  const cible = monter(Champ, props, montage.contexte);
  return { cible, entree: cible.querySelector('input[data-champ="nom"]'), attentes };
}

const centre = (element) => {
  const b = element.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};

// Un clic réel au centre de l'élément.
async function cliquer(element) {
  const { x, y } = centre(element);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await tick();
}

// Un clic réel dans le bas de la fenêtre, où rien ne se monte : le champ qui
// a le focus le perd.
async function cliquerAilleurs() {
  await pointer('presser', 4, innerHeight - 4);
  await pointer('relacher', 4, innerHeight - 4);
  await tick();
}

async function taper(texte) {
  for (const caractere of texte) await touche(caractere);
  await tick();
}

// Les lignes du journal de l'événement.
function lignesJournal(montage) {
  return montage.fs.contenu('documents', `${montage.base}${SUFFIXES.journal}`).split('\n').filter((l) => l !== '');
}

// Attend que la file de la séance ait passé tout ce qui s'y trouve — le
// retour automatique qu'une minuterie échue vient d'y poser compris — par
// une lecture admise dans tout mode, qui n'écrit rien et dont le rendu,
// réussi ou refusé, n'importe pas.
async function viderFile(montage) {
  await montage.seance.formeNommee(null).catch(() => undefined);
}

const verrouPresent = (montage) => montage.fs.contenu('documents', `${montage.base}${SUFFIXES.verrou}`) !== null;

// L'écart entre deux boîtes : 0 quand elles se touchent ou se chevauchent.
function ecart(a, b) {
  const ba = a.getBoundingClientRect();
  const bb = b.getBoundingClientRect();
  const dx = Math.max(0, ba.left - bb.right, bb.left - ba.right);
  const dy = Math.max(0, ba.top - bb.bottom, bb.top - ba.bottom);
  return Math.max(dx, dy);
}

// Aucune fenêtre ni boîte de dialogue dans le document.
function aucuneFenetre() {
  expect(document.querySelectorAll('[role=dialog], [role=alertdialog], dialog[open]').length).toBe(0);
}

describe('champ : la fin du geste (§ 2.1, § 8.2)', () => {
  test("taper sans quitter le champ n'écrit rien, même 30 min plus tard ; le quitter écrit une ligne, et la dernière entrée reconstruit la charge écrite", async () => {
    const montage = await preparer();
    const { entree, attentes } = monterChamp(montage);
    const ecritures = montage.fs.compteurs.ecritures;
    const lignes = lignesJournal(montage).length;
    const revision = montage.seance.etat().evenement.revision;

    await cliquer(entree);
    await taper(' Lacasse');
    montage.horloge.avancer(30 * 60 * 1000);
    await tick();
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    expect(entree.value).toBe(`${NOM} Lacasse`);
    expect(attentes).toHaveLength(0);

    await cliquerAilleurs();
    expect(attentes).toHaveLength(1);
    await Promise.all(attentes);
    expect(lignesJournal(montage)).toHaveLength(lignes + 1);
    const etat = montage.seance.etat();
    expect(etat.evenement.revision).toBe(revision + 1);
    expect(etat.charge.participants[0].nom).toBe(`${NOM} Lacasse`);
    const journal = lireJournal(montage.fs.contenu('documents', `${montage.base}${SUFFIXES.journal}`));
    const derniere = journal.entrees.at(-1);
    expect(derniere.revision).toBe(revision + 1);
    expect(serialiserCharge(reconstruire(journal, derniere.revision))).toBe(serialiserCharge(etat.charge));
  });

  test('une saisie que lire refuse affiche son refus contre le champ, garde le texte et n’écrit rien ; Échap rend la valeur enregistrée', async () => {
    const montage = await preparer();
    const { cible, entree, attentes } = monterChamp(montage);
    const ecritures = montage.fs.compteurs.ecritures;
    await cliquer(entree);
    for (let i = 0; i < NOM.length; i += 1) await touche('Backspace');
    await cliquerAilleurs();
    const message = cible.querySelector('[data-refus]');
    expect(message).not.toBeNull();
    expect(message.querySelector('p').textContent).toBe(t('NOM_REQUIS', { remede: null }));
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    expect(entree.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.id).not.toBe('');
    expect(entree.value).toBe('');
    expect(attentes).toHaveLength(0);
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    await cliquer(entree);
    await touche('Escape');
    await tick();
    expect(entree.value).toBe(NOM);
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(entree.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('champ : le refus de l’exécution (§ 2.1, § 5.9)', () => {
  test('executer refusé avec un code : le refus se pose contre le champ, la saisie gardée, rien d’écrit ; le refus levé par son remède, le champ rend la valeur enregistrée, et une saisie nouvelle s’écrit', async () => {
    const montage = await preparer();
    const { cible, entree, attentes } = monterChamp(montage);
    const lignes = lignesJournal(montage).length;
    await cliquer(entree);
    await taper(' Lacasse');
    // Le retour en lecture part avant la sortie du champ : la séance passe ses
    // appels dans l'ordre, et modifierParticipant arrive en lecture.
    const retour = montage.seance.passerEnLecture();
    entree.blur();
    expect(attentes).toHaveLength(1);
    await retour;
    const ecritures = montage.fs.compteurs.ecritures;
    await expect(attentes[0]).rejects.toMatchObject({ code: 'MODE_LECTURE' });
    await tick();
    const message = cible.querySelector('[data-refus]');
    expect(message).not.toBeNull();
    expect(message.getAttribute('data-refus')).toBe('MODE_LECTURE');
    expect(message.querySelector('p').textContent).toBe(t('MODE_LECTURE', { remede: { geste: 'modifier' } }));
    expect(visible(message)).toBe(true);
    expect(ecart(message, entree)).toBeLessThanOrEqual(8);
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    expect(entree.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.id).not.toBe('');
    expect(entree.value).toBe(`${NOM} Lacasse`);
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    expect(lignesJournal(montage)).toHaveLength(lignes);
    expect(montage.seance.etat().charge.participants[0].nom).toBe(NOM);
    aucuneFenetre();

    await cliquer(message.querySelector('button[data-commande="modifier"]'));
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('ecriture'));
    await vi.waitFor(() => expect(cible.querySelector('[data-refus]')).toBeNull());
    // Le refus levé, la saisie refusée ne reste pas affichée comme si elle
    // avait été appliquée : le champ rend la valeur enregistrée.
    expect(entree.value).toBe(NOM);
    expect(entree.getAttribute('aria-invalid')).toBeNull();
    await cliquer(entree);
    await touche('Enter');
    await tick();
    expect(attentes).toHaveLength(1);
    await taper(' Lacasse');
    await touche('Enter');
    await tick();
    expect(attentes).toHaveLength(2);
    await attentes[1];
    expect(lignesJournal(montage)).toHaveLength(lignes + 1);
    expect(montage.seance.etat().charge.participants[0].nom).toBe(`${NOM} Lacasse`);
  });

  test('executer refusé par un code de la séance : la séance passée en écriture par un autre chemin que le remède, le refus quitte le champ, qui rend la valeur enregistrée et le compte d’inactivité', async () => {
    const montage = await preparer();
    const { cible, entree, attentes } = monterChamp(montage);
    await cliquer(entree);
    await taper(' Lacasse');
    const retour = montage.seance.passerEnLecture();
    entree.blur();
    await retour;
    await expect(attentes[0]).rejects.toMatchObject({ code: 'MODE_LECTURE' });
    await tick();
    expect(cible.querySelector('[data-refus]')?.getAttribute('data-refus')).toBe('MODE_LECTURE');
    await montage.seance.passerEnEcriture();
    flushSync();
    expect(montage.seance.etat().refus).toBeNull();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(entree.getAttribute('aria-invalid')).toBeNull();
    expect(entree.getAttribute('aria-describedby')).toBeNull();
    expect(entree.value).toBe(NOM);
    // La saisie rendue ne tient plus de geste : l'inactivité ramène la
    // séance en lecture.
    const lignes = lignesJournal(montage).length;
    montage.horloge.avancer(INACTIVITE_MS + 1);
    await viderFile(montage);
    expect(montage.seance.etat().mode).toBe('lecture');
    // Entrée ne relance rien : aucune saisie n'est plus en cours.
    await cliquer(entree);
    await touche('Enter');
    await tick();
    expect(attentes).toHaveLength(1);
    expect(lignesJournal(montage)).toHaveLength(lignes);
    expect(montage.seance.etat().charge.participants[0].nom).toBe(NOM);
  });

  test('executer refusé par un code de la séance que l’état ne tient déjà plus : le refus ne se pose pas, et le champ rend la valeur enregistrée', async () => {
    const montage = await preparer();
    const appels = [];
    // Un refus MODE_LECTURE qui arrive la séance en écriture : il a été levé
    // avant d'arriver.
    const cible = monter(
      Champ,
      {
        cle: 'nom',
        etiquette: 'communs.commande.modifier',
        valeur: NOM,
        lire: (texte) => ({ valeur: texte.trim() }),
        executer: (valeur) => {
          appels.push(valeur);
          return Promise.reject(Object.assign(new Error('refus d’épreuve'), { code: 'MODE_LECTURE', details: { remede: { geste: 'modifier' } } }));
        },
      },
      montage.contexte,
    );
    const entree = cible.querySelector('input[data-champ="nom"]');
    await cliquer(entree);
    await taper(' Lacasse');
    await cliquerAilleurs();
    expect(appels).toEqual([`${NOM} Lacasse`]);
    await vi.waitFor(() => expect(entree.value).toBe(NOM));
    flushSync();
    expect(montage.seance.etat().refus).toBeNull();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(entree.getAttribute('aria-invalid')).toBeNull();
    montage.horloge.avancer(INACTIVITE_MS + 1);
    await viderFile(montage);
    expect(montage.seance.etat().mode).toBe('lecture');
  });

  test('une autre cause remplace le refus de l’exécution : la saisie refusée reste affichée, marquée, tant qu’un refus de la séance la couvre', async () => {
    const montage = await preparer();
    const { cible, entree, attentes } = monterChamp(montage);
    await cliquer(entree);
    await taper(' Lacasse');
    // Le support rompt pendant la saisie : sa validation est refusée
    // SUPPORT_ROMPU, puis le retour en lecture remplace cette cause.
    montage.fs.pannes.ecriture('documents');
    await expect(montage.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche' } })).rejects.toMatchObject({ code: 'ECRITURE' });
    await cliquerAilleurs();
    await expect(attentes[0]).rejects.toMatchObject({ code: 'SUPPORT_ROMPU' });
    await tick();
    expect(cible.querySelector('[data-refus]')?.getAttribute('data-refus')).toBe('SUPPORT_ROMPU');
    expect(entree.value).toBe(`${NOM} Lacasse`);
    await montage.seance.passerEnLecture();
    flushSync();
    const message = cible.querySelector('[data-refus]');
    expect(message?.getAttribute('data-refus')).toBe('MODE_LECTURE');
    expect(entree.value).toBe(`${NOM} Lacasse`);
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    expect(entree.getAttribute('aria-describedby')).toBe(message.id);
  });

  test('le remède d’un refus de la séance ne retire que lui : le refus de lire qu’il couvrait reparaît, la saisie fautive toujours là', async () => {
    const montage = await preparer();
    const { cible, entree } = monterChamp(montage);
    await cliquer(entree);
    for (let i = 0; i < NOM.length; i += 1) await touche('Backspace');
    await cliquerAilleurs();
    expect(cible.querySelector('[data-refus]')?.getAttribute('data-refus')).toBe('NOM_REQUIS');
    await montage.seance.passerEnLecture();
    await cliquer(entree);
    await taper('z');
    const message = cible.querySelector('[data-refus]');
    expect(message.getAttribute('data-refus')).toBe('MODE_LECTURE');
    await cliquer(message.querySelector('button[data-commande="modifier"]'));
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('ecriture'));
    await tick();
    flushSync();
    expect(entree.value).toBe('');
    const reste = cible.querySelector('[data-refus]');
    expect(reste?.getAttribute('data-refus')).toBe('NOM_REQUIS');
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    expect(entree.getAttribute('aria-describedby')).toBe(reste.id);
  });
});

describe('champ : le refus là où il a lieu (§ 2.1, § 5.9)', () => {
  // Tape un caractère dans le champ et rend le message posé contre lui ;
  // vérifie le texte revenu, le message visible et touchant le champ, son
  // texte et son remède, l'absence de toute fenêtre, et les attributs du
  // champ.
  async function refusAuPremierCaractere(montage, remede) {
    const alerte = vi.spyOn(window, 'alert');
    const confirmation = vi.spyOn(window, 'confirm');
    const { cible, entree, attentes } = monterChamp(montage);
    const ecritures = montage.fs.compteurs.ecritures;
    await cliquer(entree);
    await taper('z');
    expect(entree.value).toBe(NOM);
    const message = cible.querySelector('[data-refus]');
    expect(message).not.toBeNull();
    expect(visible(message)).toBe(true);
    expect(ecart(message, entree)).toBeLessThanOrEqual(8);
    const { refus } = montage.seance.etat();
    expect(refus).not.toBeNull();
    expect(message.getAttribute('data-refus')).toBe(refus.code);
    expect(message.querySelector('p').textContent).toBe(t(refus.code, refus.details));
    expect(message.textContent).toContain(remede);
    expect(message.querySelector('button').textContent.trim()).toBe(remede);
    aucuneFenetre();
    expect(alerte).not.toHaveBeenCalled();
    expect(confirmation).not.toHaveBeenCalled();
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    expect(entree.getAttribute('aria-describedby')).toBe(message.id);
    expect(message.id).not.toBe('');
    expect(attentes).toHaveLength(0);
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    return { cible, entree, message };
  }

  test('en lecture, la première frappe est refusée aussitôt : MODE_LECTURE, et « Modifier » contre le champ', async () => {
    const montage = await preparer({ mode: 'lecture' });
    const { refus } = montage.seance.etat();
    expect(refus.code).toBe('MODE_LECTURE');
    await refusAuPremierCaractere(montage, 'Modifier');
  });

  test('plan bloqué : LECTURE_SEULE BLOQUE, et « Débloquer »', async () => {
    const montage = await preparer({ bloque: true });
    expect(montage.seance.etat().refus).toMatchObject({ code: 'LECTURE_SEULE', details: { raison: 'BLOQUE' } });
    await refusAuPremierCaractere(montage, 'Débloquer');
  });

  test('support rompu : SUPPORT_ROMPU, et « Choisir un dossier… » quand le support rompu est celui des Documents', async () => {
    const montage = await preparer();
    montage.fs.pannes.ecriture('documents');
    await expect(montage.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche' } })).rejects.toMatchObject({ code: 'ECRITURE' });
    expect(montage.seance.etat().refus.code).toBe('SUPPORT_ROMPU');
    await refusAuPremierCaractere(montage, 'Choisir un dossier\u{2026}');
  });

  test('le remède « Modifier » passe en écriture, retire le refus, et la frappe suivante se saisit', async () => {
    const montage = await preparer({ mode: 'lecture' });
    const { cible, entree, message } = await refusAuPremierCaractere(montage, 'Modifier');
    await cliquer(message.querySelector('button'));
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('ecriture'));
    await tick();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(entree.getAttribute('aria-invalid')).toBeNull();
    await cliquer(entree);
    await taper('x');
    expect(entree.value).toBe(`${NOM}x`);
  });

  test('le refus de la séance suit la séance : passée en écriture par un autre chemin que son remède, le champ ne garde ni le refus ni aria-invalid', async () => {
    const montage = await preparer({ mode: 'lecture' });
    const { cible, entree } = await refusAuPremierCaractere(montage, 'Modifier');
    await montage.seance.passerEnEcriture();
    flushSync();
    expect(montage.seance.etat().refus).toBeNull();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(entree.getAttribute('aria-invalid')).toBeNull();
    expect(entree.getAttribute('aria-describedby')).toBeNull();
    // De nouveau en lecture : rien ne se pose avant une frappe.
    await montage.seance.passerEnLecture();
    flushSync();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    await montage.seance.passerEnEcriture();
    flushSync();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    await cliquer(entree);
    await taper('x');
    expect(entree.value).toBe(`${NOM}x`);
  });

  test('une autre cause remplace le refus posé : support rompu, puis retour en lecture → MODE_LECTURE et « Modifier » contre le champ', async () => {
    const montage = await preparer();
    montage.fs.pannes.ecriture('documents');
    await expect(montage.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche' } })).rejects.toMatchObject({ code: 'ECRITURE' });
    const { cible, entree } = await refusAuPremierCaractere(montage, 'Choisir un dossier\u{2026}');
    await montage.seance.passerEnLecture();
    flushSync();
    expect(montage.seance.etat().refus.code).toBe('MODE_LECTURE');
    const message = cible.querySelector('[data-refus]');
    expect(message).not.toBeNull();
    expect(message.getAttribute('data-refus')).toBe('MODE_LECTURE');
    expect(message.querySelector('p').textContent).toBe(t('MODE_LECTURE', { remede: { geste: 'modifier' } }));
    expect(message.querySelector('button').textContent.trim()).toBe('Modifier');
    expect(entree.getAttribute('aria-describedby')).toBe(message.id);
  });

  test('plan bloqué, débloqué hors du remède : le refus LECTURE_SEULE quitte le champ', async () => {
    const montage = await preparer({ bloque: true });
    const { cible, entree } = await refusAuPremierCaractere(montage, 'Débloquer');
    await montage.seance.debloquer();
    flushSync();
    expect(montage.seance.etat().refus).toBeNull();
    expect(cible.querySelector('[data-refus]')).toBeNull();
    expect(entree.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('le remède « Débloquer » (§ 8.5)', () => {
  test('un clic arme la commande, sans écrire ; un second débloque, une entrée', async () => {
    const montage = await preparer({ bloque: true });
    const { message } = await refusAuPremierCaractere2(montage);
    const bouton = message.querySelector('button');
    expect(bouton.getAttribute('data-commande')).toBe('debloquer');
    const ecritures = montage.fs.compteurs.ecritures;
    const entrees = lireJournal(montage.fs.contenu('documents', `${montage.base}${SUFFIXES.journal}`)).entrees.length;
    await cliquer(bouton);
    expect(bouton.textContent.trim()).toBe('Confirmer le déblocage');
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    aucuneFenetre();
    await cliquer(bouton);
    await vi.waitFor(() => expect(montage.seance.etat().evenement.etat).not.toBe('bloque'));
    const journal = lireJournal(montage.fs.contenu('documents', `${montage.base}${SUFFIXES.journal}`));
    expect(journal.entrees.length).toBe(entrees + 1);
    expect(montage.seance.etat().mode).toBe('ecriture');
  });

  test('armée, le délai de l’horloge la désarme : elle redit « Débloquer », et le clic suivant n’écrit rien', async () => {
    const montage = await preparer({ bloque: true });
    const { message } = await refusAuPremierCaractere2(montage);
    const bouton = message.querySelector('button');
    const ecritures = montage.fs.compteurs.ecritures;
    await cliquer(bouton);
    expect(bouton.textContent.trim()).toBe('Confirmer le déblocage');
    montage.horloge.avancer(DELAI_CONFIRMATION_MS - 1);
    flushSync();
    expect(bouton.textContent.trim()).toBe('Confirmer le déblocage');
    montage.horloge.avancer(1);
    flushSync();
    expect(bouton.textContent.trim()).toBe('Débloquer');
    await cliquer(bouton);
    expect(bouton.textContent.trim()).toBe('Confirmer le déblocage');
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    expect(montage.seance.etat().evenement.etat).toBe('bloque');
  });

  // Le refus d'un plan bloqué posé contre le champ par une frappe.
  async function refusAuPremierCaractere2(montage) {
    const { cible, entree } = monterChamp(montage);
    await cliquer(entree);
    await taper('z');
    const message = cible.querySelector('[data-refus]');
    expect(message).not.toBeNull();
    return { cible, entree, message };
  }
});

describe('la saisie suspend l’inactivité (§ 8.4)', () => {
  test('une saisie non validée tient la séance en écriture au-delà de l’inactivité ; validée, une entrée, puis le retour en lecture rend le verrou', async () => {
    const montage = await preparer();
    const { entree, attentes } = monterChamp(montage);
    const lignes = lignesJournal(montage).length;
    await cliquer(entree);
    await taper('ine');
    montage.horloge.avancer(INACTIVITE_MS + 1000);
    await tick();
    expect(montage.seance.etat().mode).toBe('ecriture');
    expect(entree.value).toBe(`${NOM}ine`);
    expect(verrouPresent(montage)).toBe(true);
    await touche('Enter');
    await tick();
    expect(attentes).toHaveLength(1);
    await Promise.all(attentes);
    expect(lignesJournal(montage)).toHaveLength(lignes + 1);
    montage.horloge.avancer(INACTIVITE_MS);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
    await vi.waitFor(() => expect(verrouPresent(montage)).toBe(false));
  });

  test('une saisie en cours, la séance renvoyée en lecture puis repassée en écriture sans quitter le champ : la saisie suspend de nouveau l’inactivité', async () => {
    const montage = await preparer();
    const { entree, attentes } = monterChamp(montage);
    await cliquer(entree);
    await taper('ine');
    await montage.seance.passerEnLecture();
    await montage.seance.passerEnEcriture();
    expect(document.activeElement).toBe(entree);
    montage.horloge.avancer(INACTIVITE_MS + 1);
    await viderFile(montage);
    expect(montage.seance.etat().mode).toBe('ecriture');
    await touche('Enter');
    await tick();
    await Promise.all(attentes);
    montage.horloge.avancer(INACTIVITE_MS);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
  });
});

describe('saisie, puis « Revenir en lecture » (§ 8.2, § 8.4)', () => {
  test('par des entrées réelles : la saisie s’écrit, puis la séance revient en lecture et rend le verrou', async () => {
    const montage = await preparer();
    const commande = monter(
      Commande,
      { cle: 'communs.commande.lecture', executer: () => montage.seance.passerEnLecture() },
      montage.contexte,
    );
    const { entree, attentes } = monterChamp(montage);
    const lignes = lignesJournal(montage).length;
    await cliquer(entree);
    await taper(' Lacasse');
    const bouton = commande.querySelector('button[data-commande="lecture"]');
    expect(bouton).not.toBeNull();
    await cliquer(bouton);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
    await Promise.all(attentes);
    expect(attentes).toHaveLength(1);
    expect(lignesJournal(montage)).toHaveLength(lignes + 1);
    expect(montage.seance.etat().charge.participants[0].nom).toBe(`${NOM} Lacasse`);
    expect(verrouPresent(montage)).toBe(false);
  });

  test('la sortie du champ lance l’exécution dans le même tour : un retour en lecture appelé aussitôt après attend son écriture', async () => {
    const montage = await preparer();
    const { entree, attentes } = monterChamp(montage);
    const lignes = lignesJournal(montage).length;
    await cliquer(entree);
    await taper(' Lacasse');
    entree.blur();
    const retour = montage.seance.passerEnLecture();
    expect(attentes).toHaveLength(1);
    await Promise.all([...attentes, retour]);
    expect(lignesJournal(montage)).toHaveLength(lignes + 1);
    expect(montage.seance.etat().mode).toBe('lecture');
    expect(montage.seance.etat().charge.participants[0].nom).toBe(`${NOM} Lacasse`);
  });
});

describe('fenêtre à confirmer (§ 2.1)', () => {
  const ELEMENTS = ['Iris Ombrelle', 'Théo Pervenche', 'Ondine Lacasse'];

  function monterConfirmation(montage) {
    const appels = [];
    const cible = monter(
      Confirmation,
      {
        titre: 'communs.remede.supprimerParticipant',
        elements: ELEMENTS,
        surConfirmer: () => {
          appels.push('confirmer');
          return montage.seance.executer('supprimerParticipant', { id: 1 });
        },
        surAnnuler: () => appels.push('annuler'),
      },
      montage.contexte,
    );
    return { cible, appels, fenetre: cible.querySelector('dialog') };
  }

  test('une fenêtre modale, ouverte, qui nomme chaque élément détruit, chacun dans son nœud, Annuler par défaut', async () => {
    const montage = await preparer();
    const { fenetre } = monterConfirmation(montage);
    expect(fenetre).not.toBeNull();
    expect(fenetre.open).toBe(true);
    expect(fenetre.matches(':modal')).toBe(true);
    const items = [...fenetre.querySelectorAll('li')];
    expect(items).toHaveLength(ELEMENTS.length);
    expect(items.map((li) => li.textContent)).toEqual(ELEMENTS);
    for (const item of items) expect(visible(item)).toBe(true);
    expect(document.activeElement.getAttribute('data-commande')).toBe('renoncer');
    expect(document.activeElement.textContent.trim()).toBe('Annuler');
  });

  test('Annuler → surAnnuler, zéro écriture ; Échap de même', async () => {
    const montage = await preparer();
    const ecritures = montage.fs.compteurs.ecritures;
    const premiere = monterConfirmation(montage);
    await cliquer(premiere.fenetre.querySelector('[data-commande="renoncer"]'));
    expect(premiere.appels).toEqual(['annuler']);
    expect(premiere.fenetre.open).toBe(false);
    const seconde = monterConfirmation(montage);
    await touche('Escape');
    await tick();
    expect(seconde.appels).toEqual(['annuler']);
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
  });

  test('Confirmer → surConfirmer ; abouti, la fenêtre se ferme', async () => {
    const montage = await preparer();
    const { fenetre, appels } = monterConfirmation(montage);
    await cliquer(fenetre.querySelector('[data-commande="confirmer"]'));
    expect(appels).toEqual(['confirmer']);
    await vi.waitFor(() => expect(montage.seance.etat().charge.participants).toHaveLength(0));
    await vi.waitFor(() => expect(fenetre.open).toBe(false));
  });

  test('ouverte, elle suspend l’inactivité (§ 8.4) : au-delà d’INACTIVITE_MS, toujours en écriture, et Confirmer aboutit ; fermée, le compte reprend', async () => {
    const montage = await preparer();
    const { fenetre } = monterConfirmation(montage);
    montage.horloge.avancer(INACTIVITE_MS + 1);
    await tick();
    expect(montage.seance.etat().mode).toBe('ecriture');
    expect(verrouPresent(montage)).toBe(true);
    await cliquer(fenetre.querySelector('[data-commande="confirmer"]'));
    await vi.waitFor(() => expect(montage.seance.etat().charge.participants).toHaveLength(0));
    await vi.waitFor(() => expect(fenetre.open).toBe(false));
    montage.horloge.avancer(INACTIVITE_MS);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
  });

  test('Annuler rend le compte d’inactivité', async () => {
    const montage = await preparer();
    const { fenetre } = monterConfirmation(montage);
    await cliquer(fenetre.querySelector('[data-commande="renoncer"]'));
    montage.horloge.avancer(INACTIVITE_MS);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
  });

  test('Confirmer refusé : le refus se pose dans la fenêtre, qui reste ouverte, rien d’écrit ; son remède levé, Confirmer aboutit et la ferme', async () => {
    const montage = await preparer();
    const { fenetre, appels } = monterConfirmation(montage);
    await montage.seance.passerEnLecture();
    const lignes = lignesJournal(montage).length;
    const ecritures = montage.fs.compteurs.ecritures;
    const confirmer = fenetre.querySelector('[data-commande="confirmer"]');
    await cliquer(confirmer);
    expect(appels).toEqual(['confirmer']);
    await vi.waitFor(() => expect(fenetre.querySelector('[data-refus]')).not.toBeNull());
    const message = fenetre.querySelector('[data-refus]');
    expect(message.getAttribute('data-refus')).toBe('MODE_LECTURE');
    expect(message.querySelector('p').textContent).toBe(t('MODE_LECTURE', { remede: { geste: 'modifier' } }));
    expect(visible(message)).toBe(true);
    expect(fenetre.open).toBe(true);
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    expect(lignesJournal(montage)).toHaveLength(lignes);
    expect(montage.seance.etat().charge.participants).toHaveLength(1);
    await cliquer(message.querySelector('button[data-commande="modifier"]'));
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('ecriture'));
    await vi.waitFor(() => expect(fenetre.querySelector('[data-refus]')).toBeNull());
    // Le retour explicite en lecture a remis à zéro le compte des gestes de
    // la séance : la fenêtre, toujours ouverte, le rouvre au passage en
    // écriture.
    montage.horloge.avancer(INACTIVITE_MS + 1);
    await viderFile(montage);
    expect(montage.seance.etat().mode).toBe('ecriture');
    expect(fenetre.open).toBe(true);
    await cliquer(confirmer);
    await vi.waitFor(() => expect(montage.seance.etat().charge.participants).toHaveLength(0));
    await vi.waitFor(() => expect(fenetre.open).toBe(false));
  });

  // Une promesse que l'épreuve résout ou rejette à la main : l'action
  // confirmée qui dure, celle d'un disque lent.
  function differe() {
    let resoudre;
    let rejeter;
    const promesse = new Promise((oui, non) => {
      resoudre = oui;
      rejeter = non;
    });
    return { promesse, resoudre, rejeter };
  }

  // La fenêtre dont surConfirmer attend attente avant d'exécuter la
  // suppression d'Iris par la séance.
  function monterConfirmationDifferee(montage) {
    const appels = [];
    const attente = differe();
    const cible = monter(
      Confirmation,
      {
        titre: 'communs.remede.supprimerParticipant',
        elements: ELEMENTS,
        surConfirmer: () => {
          appels.push('confirmer');
          return attente.promesse.then(() => montage.seance.executer('supprimerParticipant', { id: 1 }));
        },
        surAnnuler: () => appels.push('annuler'),
      },
      montage.contexte,
    );
    return { cible, appels, attente, fenetre: cible.querySelector('dialog') };
  }

  test('occupée pendant l’action confirmée : Annuler, Échap et un second Confirmer ne font rien, les boutons se montrent désactivés et l’attente se dit ; seule la fin de l’action ferme la fenêtre', async () => {
    const montage = await preparer();
    const { fenetre, appels, attente } = monterConfirmationDifferee(montage);
    const renoncer = fenetre.querySelector('[data-commande="renoncer"]');
    const confirmer = fenetre.querySelector('[data-commande="confirmer"]');
    const styleRepos = getComputedStyle(confirmer).borderTopStyle;
    await cliquer(confirmer);
    expect(appels).toEqual(['confirmer']);
    for (const bouton of [renoncer, confirmer]) {
      expect(bouton.getAttribute('aria-disabled')).toBe('true');
      expect(getComputedStyle(bouton).borderTopStyle).toBe('dashed');
      expect(getComputedStyle(bouton).borderTopStyle).not.toBe(styleRepos);
    }
    const annonce = [...fenetre.querySelectorAll('[role=status]')].find(
      (element) => element.textContent.trim() === t('communs.confirmation.enCours'),
    );
    expect(annonce).toBeDefined();
    expect(visible(annonce)).toBe(true);
    await touche('Escape');
    await tick();
    await cliquer(renoncer);
    await cliquer(confirmer);
    expect(appels).toEqual(['confirmer']);
    expect(fenetre.open).toBe(true);
    expect(montage.seance.etat().charge.participants).toHaveLength(1);
    attente.resoudre();
    await vi.waitFor(() => expect(montage.seance.etat().charge.participants).toHaveLength(0));
    await vi.waitFor(() => expect(fenetre.open).toBe(false));
    expect(appels).toEqual(['confirmer']);
    montage.horloge.avancer(INACTIVITE_MS);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
  });

  test('occupée, Échap ne ferme rien : l’action refusée avec un code, son refus se pose dans la fenêtre restée ouverte, qui redevient active', async () => {
    const montage = await preparer();
    const { fenetre, appels, attente } = monterConfirmationDifferee(montage);
    const confirmer = fenetre.querySelector('[data-commande="confirmer"]');
    await cliquer(confirmer);
    await touche('Escape');
    await tick();
    await montage.seance.passerEnLecture();
    attente.resoudre();
    await vi.waitFor(() => expect(fenetre.querySelector('[data-refus]')).not.toBeNull());
    expect(appels).toEqual(['confirmer']);
    expect(fenetre.open).toBe(true);
    const message = fenetre.querySelector('[data-refus]');
    expect(message.getAttribute('data-refus')).toBe('MODE_LECTURE');
    expect(visible(message)).toBe(true);
    for (const bouton of fenetre.querySelectorAll('.issues button')) expect(bouton.getAttribute('aria-disabled')).toBeNull();
    expect(montage.seance.etat().charge.participants).toHaveLength(1);
    await cliquer(fenetre.querySelector('[data-commande="renoncer"]'));
    expect(appels).toEqual(['confirmer', 'annuler']);
    expect(fenetre.open).toBe(false);
  });

  // La fenêtre occupée tient à toute touche. Chromium n'annule pas deux
  // fois de suite une demande de fermeture sans activation de l'utilisateur
  // entre elles : la seconde Échap ferme le <dialog> sans que cancel puisse
  // l'empêcher. La fenêtre fermée pendant l'attente se rouvre aussitôt,
  // modale et toujours occupée ; la fin de l'action seule décide.
  async function echapEnRafale(fois) {
    for (let i = 0; i < fois; i += 1) await touche('Escape');
    // L'événement close part dans une tâche à lui, après la touche.
    await new Promise((fin) => setTimeout(fin, 0));
    await tick();
  }

  function attendreOccupee(montage, fenetre, appels) {
    expect(appels).toEqual(['confirmer']);
    expect(fenetre.open).toBe(true);
    expect(fenetre.matches(':modal')).toBe(true);
    expect(fenetre.getAttribute('aria-busy')).toBe('true');
    for (const bouton of fenetre.querySelectorAll('.issues button')) expect(bouton.getAttribute('aria-disabled')).toBe('true');
    expect(montage.seance.etat().charge.participants).toHaveLength(1);
  }

  for (const fois of [2, 3]) {
    test(`occupée, ${fois} Échap de suite ne la ferment pas : rouverte modale et occupée, sans surAnnuler ; la fin de l’action la ferme`, async () => {
      const montage = await preparer();
      const { fenetre, appels, attente } = monterConfirmationDifferee(montage);
      await cliquer(fenetre.querySelector('[data-commande="confirmer"]'));
      await echapEnRafale(fois);
      attendreOccupee(montage, fenetre, appels);
      // Une seconde rafale, la fenêtre déjà rouverte une fois.
      await echapEnRafale(fois);
      attendreOccupee(montage, fenetre, appels);
      attente.resoudre();
      await vi.waitFor(() => expect(montage.seance.etat().charge.participants).toHaveLength(0));
      await vi.waitFor(() => expect(fenetre.open).toBe(false));
      expect(appels).toEqual(['confirmer']);
      montage.horloge.avancer(INACTIVITE_MS);
      await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
    });

    test(`occupée, ${fois} Échap de suite, puis l’action refusée avec un code : le refus se pose dans la fenêtre rouverte, qui redevient active`, async () => {
      const montage = await preparer();
      const { fenetre, appels, attente } = monterConfirmationDifferee(montage);
      await cliquer(fenetre.querySelector('[data-commande="confirmer"]'));
      await echapEnRafale(fois);
      attendreOccupee(montage, fenetre, appels);
      await montage.seance.passerEnLecture();
      attente.resoudre();
      await vi.waitFor(() => expect(fenetre.querySelector('[data-refus]')).not.toBeNull());
      expect(fenetre.open).toBe(true);
      expect(fenetre.matches(':modal')).toBe(true);
      expect(fenetre.querySelector('[data-refus]').getAttribute('data-refus')).toBe('MODE_LECTURE');
      expect(fenetre.getAttribute('aria-busy')).toBeNull();
      for (const bouton of fenetre.querySelectorAll('.issues button')) expect(bouton.getAttribute('aria-disabled')).toBeNull();
      expect(appels).toEqual(['confirmer']);
      await cliquer(fenetre.querySelector('[data-commande="renoncer"]'));
      expect(appels).toEqual(['confirmer', 'annuler']);
      expect(fenetre.open).toBe(false);
    });
  }

  test('fermée par le navigateur hors de l’attente, sans passer par Annuler : c’est une annulation, qui rend le compte d’inactivité', async () => {
    const montage = await preparer();
    const { fenetre, appels } = monterConfirmation(montage);
    fenetre.close();
    await vi.waitFor(() => expect(appels).toEqual(['annuler']));
    expect(fenetre.open).toBe(false);
    montage.horloge.avancer(INACTIVITE_MS);
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
  });

  test('une erreur sans code ferme la fenêtre, rend le compte d’inactivité, et remonte', async () => {
    const montage = await preparer();
    const remontees = [];
    const recueillir = (evenement) => {
      evenement.preventDefault();
      remontees.push(evenement.reason);
    };
    window.addEventListener('unhandledrejection', recueillir);
    try {
      const { fenetre, attente } = monterConfirmationDifferee(montage);
      await cliquer(fenetre.querySelector('[data-commande="confirmer"]'));
      const panne = new Error('panne d’épreuve');
      attente.rejeter(panne);
      await vi.waitFor(() => expect(fenetre.open).toBe(false));
      await vi.waitFor(() => expect(remontees).toContain(panne));
      expect(fenetre.querySelector('[data-refus]')).toBeNull();
      montage.horloge.avancer(INACTIVITE_MS);
      await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('lecture'));
    } finally {
      window.removeEventListener('unhandledrejection', recueillir);
    }
  });
});

describe('commande (§ 2.1)', () => {
  test('refusée, elle affiche son refus à côté d’elle, avec son remède, et reste active : jamais un bouton grisé muet', async () => {
    const montage = await preparer({ mode: 'lecture' });
    const ecritures = montage.fs.compteurs.ecritures;
    const cible = monter(
      Commande,
      {
        cle: 'communs.remede.ajouterParticipant',
        executer: () => montage.seance.executer('ajouterParticipant', { champs: { nom: 'Pervenche' } }),
      },
      montage.contexte,
    );
    const bouton = cible.querySelector('button[data-commande="ajouterParticipant"]');
    expect(bouton).not.toBeNull();
    expect(bouton.disabled).toBe(false);
    await cliquer(bouton);
    await vi.waitFor(() => expect(cible.querySelector('[data-refus]')).not.toBeNull());
    const message = cible.querySelector('[data-refus]');
    expect(visible(message)).toBe(true);
    expect(ecart(message, bouton)).toBeLessThanOrEqual(8);
    expect(message.querySelector('p').textContent).toBe(t('MODE_LECTURE', { remede: { geste: 'modifier' } }));
    expect(bouton.disabled).toBe(false);
    expect(bouton.getAttribute('aria-disabled')).toBeNull();
    expect(montage.fs.compteurs.ecritures).toBe(ecritures);
    aucuneFenetre();
    await cliquer(message.querySelector('button[data-commande="modifier"]'));
    await vi.waitFor(() => expect(montage.seance.etat().mode).toBe('ecriture'));
    await vi.waitFor(() => expect(cible.querySelector('[data-refus]')).toBeNull());
    await cliquer(bouton);
    await vi.waitFor(() => expect(montage.seance.etat().charge.participants).toHaveLength(2));
  });

  test('sans refus, son libellé est celui de sa clé, et data-commande le dernier segment de la clé', async () => {
    const montage = await preparer();
    const cible = monter(Commande, { cle: 'communs.commande.lecture', executer: () => undefined }, montage.contexte);
    const bouton = cible.querySelector('button');
    expect(bouton.textContent.trim()).toBe('Revenir en lecture');
    expect(bouton.getAttribute('data-commande')).toBe('lecture');
    expect(bouton.getAttribute('type')).toBe('button');
  });
});
