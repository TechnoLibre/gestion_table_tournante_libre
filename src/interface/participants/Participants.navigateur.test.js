// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La liste des participants dans un vrai moteur de rendu (§ 4, § 4.2, § 4.4,
// § 5.9, § 7.4, § 10.2) : la saisie par le seul nom, l'appartenance
// collante, la grille au clavier, le tri, le filtre et le compte,
// l'exclusion, le manque de places à l'ajout et à la réintégration, la fiche
// et l'itinéraire, l'export et le collage. Chaque épreuve monte App par
// monterApp, sur le système de fichiers simulé et l'horloge pilotée ; chaque
// écriture se relève (trace) et chaque entrée se compte dans le journal. Les
// gestes passent par des entrées que Chromium traite comme réelles
// (test/navigateur/entrees.js). Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { cdp } from 'vitest/browser';
import { flushSync, tick } from 'svelte';
import { bilanChangementDefaut } from '../../application/bilans.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { apercevoir, decoder, exporterParticipants } from '../../application/csv.js';
import { STATUT, nombrePlacesManquantes, normaliser } from '../../moteur/configuration.js';
import { configurationDepuisCharge } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { formeNommee } from '../../stockage/placements.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { pointer, touche } from '../../../test/navigateur/entrees.js';
import { visible } from '../../../test/navigateur/rendu.js';
import CAS_LIMITES from '../../../exemples/participants_cas_limites.csv?url';
import { TABLES_INTERFACE } from '../libelles.js';
import { COLONNES, cleDeStatut } from './grille.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

const EVENEMENT = 'Soirée des Merles';
const CLUB = 'Club des Merles';

// Des noms inventés, hors du réservoir du générateur.
const NOMS = [
  'Quenouillet',
  'Brindelle',
  'Calvaille',
  'Doucemer',
  'Esquirol',
  'Faverolle',
  'Glanduc',
  'Houblonnet',
  'Isardin',
  'Joncaille',
  'Kerbouet',
  'Lisonnet',
  'Moucheron',
  'Nivelette',
  'Orbelin',
  'Pistachon',
  'Rouvrelle',
];

// Les montages de l'épreuve en cours, démontés après elle ; le collecteur
// n'a rien reçu pendant l'épreuve.
let montes = [];
let erreursAvant = 0;
beforeEach(() => {
  erreursAvant = globalThis.__gttErreurs?.length ?? 0;
});
afterEach(() => {
  for (const m of montes.reverse()) m.demonter();
  montes = [];
  vi.restoreAllMocks();
  const recues = globalThis.__gttErreurs?.slice(erreursAvant) ?? [];
  expect(recues, 'erreurs reçues par le collecteur').toEqual([]);
});

async function rendu() {
  flushSync();
  await tick();
}

// Attend que la file de la séance ait passé ce que le geste y a posé, par
// une lecture admise dans tout mode qui n'écrit rien, puis le rendu.
async function attendreSeance(m) {
  await m.seance.formeNommee(null).catch(() => undefined);
  await rendu();
  await rendu();
}

// Un CSV d'épreuve, séparé par « ; » : nom, prénom, appartenance, exclu,
// titre pressenti, notes.
const csv = (personnes) =>
  [
    'nom;prenom;appartenance;exclu;titre_pressenti;notes',
    ...personnes.map((p) => [p.nom, p.prenom ?? '', p.appartenance ?? '', p.exclu ? 'oui' : '', p.titre ?? '', p.notes ?? ''].join(';')),
  ].join('\n');

// Importe un texte par la commande, comme le ferait l'aperçu (I6).
const importer = (m, texte) => m.seance.executer('importerParticipants', { apercu: apercevoir(texte), mode: 'ajouter' });

// Les octets d'un CSV livré, lus par son adresse.
async function octetsLivres(url) {
  const reponse = await fetch(url);
  return new Uint8Array(await reponse.arrayBuffer());
}

/**
 * Un montage, un événement créé — sieges places par défaut, tours tours,
 * tables tables rondes, personnes importées —, en écriture, la section des
 * participants ouverte.
 */
async function evenementOuvert({ sieges = 8, tours = 2, tables = 0, personnes = [] } = {}) {
  const m = await monterApp();
  montes.push(m);
  await m.seance.creer({ nom: EVENEMENT, date: null, siegesParDefaut: sieges, tours });
  await m.seance.passerEnEcriture();
  for (let i = 0; i < tables; i += 1) await m.seance.executer('creerTable', { forme: 'ronde' });
  if (personnes.length > 0) await importer(m, csv(personnes));
  m.ui.allerA('participants');
  await rendu();
  return m;
}

const base = (m) => m.seance.etat().evenement.base;
const texteJournal = (m) => m.fs.contenu('documents', `${base(m)}${SUFFIXES.journal}`);
const entrees = (m) => lireJournal(texteJournal(m)).entrees;
const texteEtat = (m) => m.fs.contenu('documents', `${base(m)}${SUFFIXES.etat}`);
const participants = (m) => m.seance.etat().charge.participants;
const idDe = (m, nom) => participants(m).find((p) => p.nom === nom).id;

const section = (m) => m.racine.querySelector('[data-section="participants"]');
const formulaire = (m) => section(m).querySelector('form');
const champ = (m, cle) => formulaire(m).querySelector(`[data-champ="${cle}"]`);
const grille = (m) => section(m).querySelector('[role="grid"]');
const lignes = (m) => [...grille(m).querySelectorAll('[data-participant]')];
const idsAffiches = (m) => lignes(m).map((ligne) => Number(ligne.dataset.participant));
const ligne = (m, id) => grille(m).querySelector(`[data-participant="${id}"]`);
const cellule = (m, id, colonne) => ligne(m, id).querySelector(`[data-champ="${colonne}"]`);
const commandeDeLigne = (m, id, nom) => ligne(m, id).querySelector(`[data-commande="${nom}"]`);
const fiche = (m) => section(m).querySelector('[data-fiche]');

const centre = (element) => {
  const b = element.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
};

// Un clic réel au centre de l'élément, amené d'abord dans la fenêtre.
async function cliquer(element) {
  element.scrollIntoView({ block: 'center' });
  const { x, y } = centre(element);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  await rendu();
}

// Remplace le texte d'un champ par une saisie réelle : le champ prend le
// focus, son texte est sélectionné, puis remplacé par l'insertion du texte,
// ou effacé.
async function saisir(entree, texte) {
  entree.focus();
  entree.select();
  if (texte === '') await touche('Backspace');
  else await cdp().send('Input.insertText', { text: texte });
  await rendu();
}

// Ajoute une personne par le formulaire : chaque champ donné saisi, puis
// Entrée dans le champ du nom.
async function ajouter(m, champs) {
  for (const [cle, valeur] of Object.entries(champs)) await saisir(champ(m, cle), valeur);
  champ(m, 'nom').focus();
  await touche('Enter');
  await attendreSeance(m);
}

// Maj+Tab réel : touche() ne porte pas de modificateur ; 8 est le masque de
// Maj dans Input.dispatchKeyEvent.
async function majTab() {
  const commun = { key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9, nativeVirtualKeyCode: 9, modifiers: 8 };
  await cdp().send('Input.dispatchKeyEvent', { type: 'rawKeyDown', ...commun });
  await cdp().send('Input.dispatchKeyEvent', { type: 'keyUp', ...commun });
}

// La valeur de la fiche que nomme l'étiquette de clé donnée.
function valeurDeFiche(m, cle) {
  const etiquette = [...fiche(m).querySelectorAll('dt')].find((dt) => dt.textContent === t(cle));
  expect(etiquette, cle).toBeDefined();
  return etiquette.nextElementSibling;
}

// Le tableau de la fiche que titre la légende de clé donnée.
const tableauDeFiche = (m, cle) => [...fiche(m).querySelectorAll('table')].find((tableau) => tableau.caption?.textContent === t(cle));

// L'écart entre deux boîtes : 0 quand elles se touchent ou se chevauchent.
function ecart(a, b) {
  const ba = a.getBoundingClientRect();
  const bb = b.getBoundingClientRect();
  const dx = Math.max(0, ba.left - bb.right, bb.left - ba.right);
  const dy = Math.max(0, ba.top - bb.bottom, bb.top - ba.bottom);
  return Math.max(dx, dy);
}

const aucuneFenetre = () => expect(document.querySelectorAll('dialog[open], [role=dialog], [role=alertdialog]').length).toBe(0);

describe('la saisie (§ 4, § 10.2)', () => {
  test('seul le nom : « Pervenche » enregistre une personne aux autres champs null, en une entrée ; un nom tapé en NFD est enregistré en NFC', async () => {
    const m = await evenementOuvert();
    const avant = entrees(m).length;
    await ajouter(m, { nom: 'Pervenche' });
    expect(entrees(m)).toHaveLength(avant + 1);
    const [{ id, ...champs }] = participants(m);
    expect(Number.isInteger(id)).toBe(true);
    expect(champs).toEqual({
      nom: 'Pervenche',
      prenom: null,
      appartenance: null,
      courriel: null,
      titrePressenti: null,
      notes: null,
      exclu: false,
    });
    expect(champ(m, 'nom').value).toBe('');

    const decompose = 'Ombre\u{0301}lle';
    expect(decompose.length).toBe(9);
    await ajouter(m, { nom: decompose });
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(participants(m).at(-1).nom).toBe('Ombr\u{00E9}lle');
  });

  test('nom vide : « ␠␠ » pose sur le champ aria-invalid et un message visible qui le jouxte ; aucune fenêtre, zéro écriture', async () => {
    const m = await evenementOuvert();
    const trace = m.trace.length;
    const etat = texteEtat(m);
    await ajouter(m, { nom: '  ' });
    const entree = champ(m, 'nom');
    expect(entree.getAttribute('aria-invalid')).toBe('true');
    const message = document.getElementById(entree.getAttribute('aria-describedby'));
    expect(message).not.toBeNull();
    expect(message.textContent).toContain(t('NOM_REQUIS', {}));
    expect(visible(message)).toBe(true);
    expect(ecart(entree, message)).toBeLessThanOrEqual(16);
    aucuneFenetre();
    expect(m.trace.length).toBe(trace);
    expect(texteEtat(m)).toBe(etat);
    expect(participants(m)).toHaveLength(0);
  });

  test('appartenance collante : trois personnes portent « Club des Merles » ; le champ vidé, la quatrième n’en porte aucune', async () => {
    const m = await evenementOuvert();
    await ajouter(m, { nom: 'Ombrelle', prenom: 'Iris', appartenance: CLUB });
    expect(champ(m, 'appartenance').value).toBe(CLUB);
    expect(champ(m, 'prenom').value).toBe('');
    await ajouter(m, { nom: 'Pervenche' });
    await ajouter(m, { nom: 'Lacasse' });
    expect(participants(m).map((p) => [p.nom, p.prenom, p.appartenance])).toEqual([
      ['Ombrelle', 'Iris', CLUB],
      ['Pervenche', null, CLUB],
      ['Lacasse', null, CLUB],
    ]);
    await saisir(champ(m, 'appartenance'), '');
    await ajouter(m, { nom: 'Grisaille' });
    expect(participants(m).at(-1).appartenance).toBeNull();
  });

  test('une appartenance qui ne diffère d’une existante que par la casse et les blancs est signalée sur le champ, l’orthographe existante à reprendre ; rien ne fusionne seul', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Ombrelle', prenom: 'Iris', appartenance: CLUB }] });
    const trace = m.trace.length;
    await saisir(champ(m, 'appartenance'), 'club des  merles');
    const signal = formulaire(m).querySelector('[data-avertissement]');
    expect(signal).not.toBeNull();
    expect(visible(signal)).toBe(true);
    expect(signal.textContent).toContain(CLUB);
    expect(champ(m, 'appartenance').getAttribute('aria-describedby')).toContain(signal.id);
    expect(champ(m, 'appartenance').value).toBe('club des  merles');
    await cliquer(signal.querySelector('[data-commande="reprendreOrthographe"]'));
    expect(champ(m, 'appartenance').value).toBe(CLUB);
    expect(formulaire(m).querySelector('[data-avertissement]')).toBeNull();
    expect(m.trace.length).toBe(trace);
  });
});

describe('la grille (§ 10.2, § 19.3)', () => {
  const TROIS = [
    { nom: 'Ombrelle', prenom: 'Iris', appartenance: CLUB },
    { nom: 'Pervenche', prenom: 'Théo', appartenance: 'CLUB DES MERLES' },
    { nom: 'Lacasse', prenom: 'Ondine' },
    { nom: 'Grisaille' },
  ];

  test('au clavier seul : le courriel d’Ondine Lacasse changé en une entrée ; Échap rend la valeur, valider sans changement n’écrit rien', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const ondine = idDe(m, 'Lacasse');
    const rang = idsAffiches(m).indexOf(ondine);
    const colonne = COLONNES.indexOf('courriel');
    expect(rang).toBeGreaterThan(0);
    expect(colonne).toBeGreaterThan(0);

    const premiere = grille(m).querySelector('[tabindex="0"]');
    expect(premiere).toBe(cellule(m, idsAffiches(m)[0], COLONNES[0]));
    premiere.focus();
    for (let i = 0; i < rang; i += 1) await touche('ArrowDown');
    for (let i = 0; i < colonne; i += 1) await touche('ArrowRight');
    await rendu();
    const cible = cellule(m, ondine, 'courriel');
    expect(document.activeElement).toBe(cible);

    const avant = entrees(m).length;
    await touche('Enter');
    await rendu();
    for (const caractere of 'ondine@exemple.test') await touche(caractere);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(entrees(m).at(-1).libelle).toBe('Modifié Ondine Lacasse : courriel');
    expect(participants(m).find((p) => p.id === ondine).courriel).toBe('ondine@exemple.test');
    expect(cellule(m, ondine, 'courriel').textContent.trim()).toBe('ondine@exemple.test');

    // Échap en cours d'édition : rien ne s'écrit, la valeur d'origine revient.
    const trace = m.trace.length;
    cellule(m, ondine, 'courriel').focus();
    await touche('Enter');
    await rendu();
    for (const caractere of 'zz') await touche(caractere);
    await touche('Escape');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(cellule(m, ondine, 'courriel').querySelector('input')).toBeNull();
    expect(cellule(m, ondine, 'courriel').textContent.trim()).toBe('ondine@exemple.test');

    // Valider sans changement : aucune commande ne part, donc aucun refus
    // SANS_EFFET ne se pose sur la cellule, et rien ne s'écrit.
    const executer = vi.spyOn(m.seance, 'executer');
    cellule(m, ondine, 'courriel').focus();
    await touche('Enter');
    await rendu();
    await touche('Enter');
    await attendreSeance(m);
    expect(executer).not.toHaveBeenCalled();
    expect(cellule(m, ondine, 'courriel').querySelector('[data-refus]')).toBeNull();
    expect(cellule(m, ondine, 'courriel').querySelector('[aria-invalid]')).toBeNull();
    expect(cellule(m, ondine, 'courriel').querySelector('input')).toBeNull();
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(m.trace.length).toBe(trace);
  });

  test('Tab après une saisie qui déplace la ligne au tri mène à la cellule suivante de la même personne', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    const premier = idsAffiches(m)[0];
    expect(participants(m).find((p) => p.id === premier).nom).toBe('Grisaille');

    cellule(m, premier, 'nom').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, premier, 'nom').querySelector('input'), 'Zed');
    await touche('Tab');
    await attendreSeance(m);
    expect(participants(m).find((p) => p.id === premier).nom).toBe('Zed');
    expect(idsAffiches(m).at(-1)).toBe(premier);
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES[1]));
  });

  test('Tab après une saisie qui retire la ligne du filtre mène à la première cellule de la personne qui la suivait', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
    const [premier, second] = idsAffiches(m);
    expect(idsAffiches(m)).toHaveLength(2);

    cellule(m, premier, 'appartenance').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, premier, 'appartenance').querySelector('input'), 'Cercle des Pinsons');
    await touche('Tab');
    await attendreSeance(m);
    expect(idsAffiches(m)).toEqual([second]);
    expect(document.activeElement).toBe(cellule(m, second, COLONNES[0]));
  });

  test('Maj+Tab après une saisie qui retire la ligne du filtre mène à la dernière cellule de la personne qui la précédait', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
    await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
    const [premier, second] = idsAffiches(m);
    expect(idsAffiches(m)).toHaveLength(2);

    cellule(m, second, 'appartenance').focus();
    await touche('Enter');
    await rendu();
    await saisir(cellule(m, second, 'appartenance').querySelector('input'), 'Cercle des Pinsons');
    await majTab();
    await attendreSeance(m);
    expect(idsAffiches(m)).toEqual([premier]);
    expect(document.activeElement).toBe(cellule(m, premier, COLONNES.at(-1)));
  });

  test('une note de deux lignes, retouchée dans la grille, garde son saut de ligne', async () => {
    const m = await evenementOuvert();
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Lacasse', prenom: 'Ondine', notes: 'arrive tard\nrepart tôt' } });
    await rendu();
    const id = idDe(m, 'Lacasse');
    const avant = entrees(m).length;
    cellule(m, id, 'notes').focus();
    await touche('Enter');
    await rendu();
    for (const caractere of ' x') await touche(caractere);
    await touche('Enter');
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).find((p) => p.id === id).notes).toBe('arrive tard\nrepart tôt x');
  });

  test('trier par nom, croissant puis décroissant, filtrer « merles » : l’ordre et les lignes suivent ; rien ne s’écrit, en écriture comme en lecture', async () => {
    const m = await evenementOuvert({ personnes: TROIS });
    const parNom = (sens) =>
      [...participants(m)]
        .sort((a, b) => (a.nom < b.nom ? -1 : a.nom > b.nom ? 1 : a.id - b.id) * (sens === 'croissant' ? 1 : -1))
        .map((p) => p.id);
    const merles = participants(m)
      .filter((p) => p.appartenance !== null)
      .map((p) => p.id);
    expect(merles).toHaveLength(2);

    for (const mode of ['ecriture', 'lecture']) {
      if (mode === 'lecture') {
        await m.seance.passerEnLecture();
        await rendu();
      }
      const journal = texteJournal(m);
      const etat = texteEtat(m);
      const trace = m.trace.length;
      const trier = section(m).querySelector('[data-commande="trier"][data-cible="nom"]');
      await cliquer(trier);
      expect(idsAffiches(m), mode).toEqual(parNom('croissant'));
      await cliquer(section(m).querySelector('[data-commande="trier"][data-cible="nom"]'));
      expect(idsAffiches(m), mode).toEqual(parNom('decroissant'));
      await saisir(section(m).querySelector('[data-champ="filtre"]'), 'merles');
      expect([...idsAffiches(m)].sort((a, b) => a - b), mode).toEqual(merles);
      expect(section(m).querySelector('output').textContent).toBe(t('participants.grille.compte', { total: 4, affiches: 2 }));
      await saisir(section(m).querySelector('[data-champ="filtre"]'), '');
      expect(idsAffiches(m)).toHaveLength(4);
      await attendreSeance(m);
      expect(texteJournal(m), mode).toBe(journal);
      expect(texteEtat(m), mode).toBe(etat);
      expect(m.trace.length, mode).toBe(trace);
    }
  });

  test('après l’import des cas limites, le compte affiché égale le nombre de lignes importées ; une personne exclue reste visible', async () => {
    const m = await evenementOuvert();
    const octets = await octetsLivres(CAS_LIMITES);
    const { resume } = await m.seance.executer('importerParticipants', {
      apercu: apercevoir(decoder(octets).texte),
      mode: 'ajouter',
    });
    await rendu();
    expect(resume.ajoutes).toBeGreaterThan(0);
    expect(participants(m)).toHaveLength(resume.ajoutes);
    expect(lignes(m)).toHaveLength(resume.ajoutes);
    expect(section(m).querySelector('output').textContent).toBe(
      t('participants.grille.compte', { total: resume.ajoutes, affiches: resume.ajoutes }),
    );
    const exclue = participants(m).find((p) => p.exclu);
    expect(exclue).toBeDefined();
    expect(cellule(m, exclue.id, 'exclu').textContent.trim()).toBe(t('participants.grille.exclue'));
  });

  test('exclusion : douze personnes, en exclure une → douze lignes, la sienne porte « exclue » en texte ; le bilan compte onze participants', async () => {
    const m = await evenementOuvert({ personnes: NOMS.slice(0, 12).map((nom) => ({ nom })) });
    const id = idDe(m, NOMS[3]);
    const avant = entrees(m).length;
    await cliquer(commandeDeLigne(m, id, 'exclureParticipant'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(lignes(m)).toHaveLength(12);
    expect(cellule(m, id, 'exclu').textContent.trim()).toBe(t('participants.grille.exclue'));
    const autres = participants(m).filter((p) => p.id !== id);
    expect(autres).toHaveLength(11);
    // La marque est un texte, distinct de celui d'une personne présente.
    for (const p of autres) expect(cellule(m, p.id, 'exclu').textContent.trim()).toBe(t('participants.grille.presente'));
    expect(t('participants.grille.presente')).not.toBe(t('participants.grille.exclue'));
    expect(bilanChangementDefaut(m.seance.etat().charge, 8).participants).toBe(11);
  });

  test('notes jamais interprétées : « <b>x</b> & =1+1 » s’affiche tel quel dans la grille et sur la fiche, sans élément <b>', async () => {
    const m = await evenementOuvert();
    const notes = '<b>x</b> & =1+1';
    await m.seance.executer('ajouterParticipant', { champs: { nom: 'Ombrelle', notes } });
    await rendu();
    const id = idDe(m, 'Ombrelle');
    expect(cellule(m, id, 'notes').textContent.trim()).toBe(notes);
    m.ui.ouvrirFiche(id);
    await rendu();
    expect(valeurDeFiche(m, 'participants.colonne.notes').textContent).toBe(notes);
    expect(section(m).querySelectorAll('b')).toHaveLength(0);
  });

  test('titre pressenti : visible dans la grille et sur la fiche', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Pervenche', prenom: 'Théo', titre: 'hôtesse' }] });
    const id = idDe(m, 'Pervenche');
    expect(cellule(m, id, 'titrePressenti').textContent.trim()).toBe('hôtesse');
    cellule(m, id, 'titrePressenti').scrollIntoView({ block: 'center', inline: 'center' });
    expect(visible(cellule(m, id, 'titrePressenti'))).toBe(true);
    m.ui.ouvrirFiche(id);
    await rendu();
    const valeur = valeurDeFiche(m, 'participants.colonne.titrePressenti');
    expect(valeur.textContent).toBe('hôtesse');
    expect(visible(valeur)).toBe(true);
  });

  test('supprimer sans réservation : aucune fenêtre, une entrée ; avec réservations, la fenêtre les nomme, et Annuler ne détruit rien', async () => {
    const m = await evenementOuvert({ tables: 1, personnes: [{ nom: 'Ombrelle' }, { nom: 'Pervenche' }] });
    const iris = idDe(m, 'Ombrelle');
    const theo = idDe(m, 'Pervenche');
    const table = m.seance.etat().charge.tables[0];
    await m.seance.executer('reserver', { participant: theo, table: table.id, siege: 2, portee: 'tous', tour: null });
    await rendu();
    const avant = entrees(m).length;

    await cliquer(commandeDeLigne(m, iris, 'supprimerParticipant'));
    await attendreSeance(m);
    aucuneFenetre();
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).map((p) => p.id)).toEqual([theo]);

    await cliquer(commandeDeLigne(m, theo, 'supprimerParticipant'));
    const fenetre = document.querySelector('dialog[open]');
    expect(fenetre).not.toBeNull();
    const elements = [...fenetre.querySelectorAll('li')].map((li) => li.textContent);
    expect(elements).toEqual([
      t('participants.suppression.reservation', { numero: table.numero, siege: 2, portee: 'tous', tour: null }),
    ]);
    await cliquer(fenetre.querySelector('[data-commande="renoncer"]'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).map((p) => p.id)).toEqual([theo]);

    await cliquer(commandeDeLigne(m, theo, 'supprimerParticipant'));
    await cliquer(document.querySelector('dialog[open] [data-commande="confirmer"]'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 2);
    expect(participants(m)).toEqual([]);
  });
});

describe('le manque de places (§ 5.9, § 4.4)', () => {
  test('deux tables de 8 et seize personnes : la dix-septième est acceptée, une entrée, et avertit PLACES_MANQUANTES de 1', async () => {
    const m = await evenementOuvert({ tables: 2, personnes: NOMS.slice(0, 16).map((nom) => ({ nom })) });
    const executer = vi.spyOn(m.seance, 'executer');
    const avant = entrees(m).length;
    await ajouter(m, { nom: NOMS[16] });
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m)).toHaveLength(17);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer.mock.calls[0][0]).toBe('ajouterParticipant');
    const rendus = await executer.mock.results[0].value;
    const attendu = nombrePlacesManquantes(normaliser(configurationDepuisCharge(m.seance.etat().charge)));
    expect(attendu).toBe(1);
    const manque = rendus.avertissements.find(({ code }) => code === 'PLACES_MANQUANTES');
    expect(manque?.details.placesManquantes).toBe(attendu);
    const etat = m.seance.etat().avertissements.find(({ code }) => code === 'PLACES_MANQUANTES');
    expect(etat?.details.placesManquantes).toBe(attendu);
  });

  test('deux tables de 8, dix-sept personnes dont une exclue : la réintégrer est accepté, une entrée, et avertit PLACES_MANQUANTES de 1', async () => {
    const personnes = NOMS.slice(0, 17).map((nom, rang) => ({ nom, exclu: rang === 5 }));
    const m = await evenementOuvert({ tables: 2, personnes });
    const id = idDe(m, NOMS[5]);
    const executer = vi.spyOn(m.seance, 'executer');
    const avant = entrees(m).length;
    await cliquer(commandeDeLigne(m, id, 'reintegrerParticipant'));
    await attendreSeance(m);
    expect(entrees(m)).toHaveLength(avant + 1);
    expect(participants(m).find((p) => p.id === id).exclu).toBe(false);
    expect(executer).toHaveBeenCalledTimes(1);
    expect(executer.mock.calls[0]).toEqual(['reintegrerParticipant', { id }]);
    const rendus = await executer.mock.results[0].value;
    const attendu = nombrePlacesManquantes(normaliser(configurationDepuisCharge(m.seance.etat().charge)));
    expect(attendu).toBe(1);
    expect(rendus.avertissements.find(({ code }) => code === 'PLACES_MANQUANTES')?.details.placesManquantes).toBe(attendu);
    expect(m.seance.etat().avertissements.find(({ code }) => code === 'PLACES_MANQUANTES')?.details.placesManquantes).toBe(
      attendu,
    );
  });
});

describe('la fiche (§ 4.2, § 7.4)', () => {
  test('statuts : A, B, C, D → ancré, ancré, partiellement fixé, mobile, égaux au statut du moteur ; aucun contrôle de saisie de statut', async () => {
    const m = await evenementOuvert({
      sieges: 4,
      tours: 3,
      tables: 2,
      personnes: [
        { nom: 'Ombrelle', prenom: 'Iris' },
        { nom: 'Pervenche', prenom: 'Théo' },
        { nom: 'Lacasse', prenom: 'Ondine' },
        { nom: 'Grisaille' },
      ],
    });
    const [t1, t2] = m.seance.etat().charge.tables.map(({ id }) => id);
    const [a, b, c, d] = ['Ombrelle', 'Pervenche', 'Lacasse', 'Grisaille'].map((nom) => idDe(m, nom));
    const reserver = (participant, table, portee, tour = null) =>
      m.seance.executer('reserver', { participant, table, siege: null, portee, tour });
    await reserver(a, t1, 'tous');
    for (const tour of [1, 2, 3]) await reserver(b, t1, 'tour', tour);
    await reserver(c, t1, 'tour', 1);
    await reserver(c, t2, 'tour', 2);
    await rendu();

    const instance = normaliser(configurationDepuisCharge(m.seance.etat().charge));
    const NOMS_STATUTS = new Map([
      [STATUT.ANCRE, 'ancre'],
      [STATUT.PARTIELLEMENT_FIXE, 'partiel'],
      [STATUT.MOBILE, 'mobile'],
    ]);
    const attendus = [
      [a, 'ancre'],
      [b, 'ancre'],
      [c, 'partiel'],
      [d, 'mobile'],
    ];
    for (const [id, statut] of attendus) {
      expect(NOMS_STATUTS.get(instance.statut[instance.indexDe.get(id)])).toBe(statut);
      m.ui.ouvrirFiche(id);
      await rendu();
      expect(fiche(m).dataset.fiche).toBe(String(id));
      expect(valeurDeFiche(m, 'participants.fiche.statut').textContent).toBe(t(cleDeStatut(statut)));
      expect(fiche(m).querySelectorAll('input, select, textarea')).toHaveLength(0);
    }
  });

  test('ouverte depuis sa ligne, puis par ui.ouvrirFiche : visible ; sur un retenu, son itinéraire égale, tour par tour, la forme nommée', async () => {
    const m = await evenementOuvert({ sieges: 4, tours: 3, tables: 2, personnes: NOMS.slice(0, 7).map((nom) => ({ nom })) });
    await m.seance.executer('modifierReglage', { cle: 'attribuerSieges', valeur: true });
    await m.app.generation().generer({ graine: 1, nombre: 1, arret: 50, historique: 1000 });
    const [proposition] = m.seance.etat().charge.propositions;
    await m.seance.executer('retenirProposition', { id: proposition.id });
    // Une personne quitte sa table au tour 2 : la réserve figure à l'itinéraire.
    await m.seance.executer('retirerDuTour', { tour: 2, participant: idDe(m, NOMS[2]) });
    await rendu();
    const charge = m.seance.etat().charge;
    const forme = formeNommee(charge.retenu, charge);
    expect(forme.some((ligneForme) => ligneForme.reserve)).toBe(true);

    const id = idDe(m, NOMS[2]);
    await cliquer(commandeDeLigne(m, id, 'fiche'));
    expect(m.ui.etat().fiche).toBe(id);
    expect(fiche(m).dataset.fiche).toBe(String(id));
    expect(visible(fiche(m))).toBe(true);
    await cliquer(fiche(m).querySelector('[data-commande="fermerFiche"]'));
    expect(fiche(m)).toBeNull();
    expect(m.ui.etat().section).toBe('participants');

    // Chaque personne : l'itinéraire de la fiche, ligne par ligne.
    expect(charge.participants).toHaveLength(7);
    for (const { id: personne } of charge.participants) {
      m.ui.ouvrirFiche(personne);
      await rendu();
      expect(visible(fiche(m))).toBe(true);
      const tableau = tableauDeFiche(m, 'participants.fiche.itineraire');
      expect(tableau).toBeDefined();
      const lus = [...tableau.tBodies[0].rows].map((rangee) => [...rangee.cells].map((c) => c.textContent.trim()));
      const attendus = forme
        .filter((l) => l.participant === personne)
        .map((l) => (l.reserve ? [String(l.tour), t('participants.fiche.enReserve')] : [String(l.tour), String(l.numero), String(l.siege)]));
      expect(attendus).toHaveLength(3);
      expect(lus).toEqual(attendus);
    }
  });

  test('un nom de deux cents caractères se lit entier sur la fiche, replié, sans marque ni débordement', async () => {
    const long = 'Ombrelle'.repeat(25);
    expect(long).toHaveLength(200);
    const m = await evenementOuvert();
    await m.seance.executer('ajouterParticipant', { champs: { nom: long } });
    const id = idDe(m, long);
    m.ui.ouvrirFiche(id);
    await rendu();
    const porteur = fiche(m);
    const valeur = valeurDeFiche(m, 'participants.colonne.nom');
    expect(valeur.textContent).toBe(long);
    expect(porteur.textContent).not.toContain('\u{2026}');
    expect(porteur.scrollWidth).toBeLessThanOrEqual(porteur.clientWidth);
    expect(valeur.scrollWidth).toBeLessThanOrEqual(valeur.clientWidth);
    const interligne = Number.parseFloat(getComputedStyle(valeur).lineHeight);
    expect(interligne).toBeGreaterThan(0);
    expect(valeur.getBoundingClientRect().height).toBeGreaterThanOrEqual(2 * interligne);
  });
});

describe('export et collage (§ 10.2)', () => {
  test('« Exporter la liste » remet les octets d’exporterParticipants ; réimportés dans un événement neuf, ils rendent les mêmes participants, exclu compris', async () => {
    const m = await evenementOuvert();
    const octets = await octetsLivres(CAS_LIMITES);
    await m.seance.executer('importerParticipants', { apercu: apercevoir(decoder(octets).texte), mode: 'ajouter' });
    await rendu();
    const releves = [];
    m.fs.enregistrerSous = async (nomPropose, contenu) => {
      releves.push({ nomPropose, octets: contenu });
      return nomPropose;
    };
    const avant = participants(m);
    expect(avant.some((p) => p.exclu)).toBe(true);
    const trace = m.trace.length;
    await cliquer(section(m).querySelector('[data-commande="exporter"]'));
    await attendreSeance(m);
    expect(releves).toHaveLength(1);
    expect(releves[0].nomPropose).toBe(`${base(m)}-participants.csv`);
    expect([...releves[0].octets]).toEqual([...exporterParticipants(avant)]);
    expect(m.trace.length).toBe(trace);

    await m.seance.fermer();
    await m.seance.creer({ nom: 'Soirée des Grisailles', date: null, siegesParDefaut: 8, tours: 2 });
    await m.seance.passerEnEcriture();
    await m.seance.executer('importerParticipants', { apercu: apercevoir(decoder(releves[0].octets).texte), mode: 'ajouter' });
    const sansId = (liste) => liste.map(({ id, ...champs }) => champs);
    expect(avant.length).toBeGreaterThan(0);
    expect(sansId(participants(m))).toEqual(sansId(avant));
  });

  test('un collage sur la grille ouvre l’aperçu d’import : importEnAttente porte le texte intact, origine collage, et la section import ; zéro écriture', async () => {
    const m = await evenementOuvert({ personnes: [{ nom: 'Ombrelle' }] });
    const etats = [];
    const desabonner = m.ui.subscribe((etat) => etats.push(etat));
    const trace = m.trace.length;
    const texte = 'nom;prénom\r\nPervenche;Théo\n"Lacasse; Ondine";\u{00A0}x\t';
    grille(m).querySelector('[tabindex="0"]').focus();
    const presse = new DataTransfer();
    presse.setData('text/plain', texte);
    grille(m).querySelector('[tabindex="0"]').dispatchEvent(
      new ClipboardEvent('paste', { clipboardData: presse, bubbles: true, cancelable: true }),
    );
    await rendu();
    desabonner();
    expect(etats.some((etat) => etat.importEnAttente?.texte === texte && etat.importEnAttente.origine === 'collage' && etat.section === 'import')).toBe(
      true,
    );
    expect(m.ui.etat().section).toBe('import');
    await attendreSeance(m);
    expect(m.trace.length).toBe(trace);
  });
});
