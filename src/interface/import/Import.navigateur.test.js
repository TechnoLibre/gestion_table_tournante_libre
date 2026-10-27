// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// L'import des participants et des objectifs de table dans un vrai moteur de
// rendu (§ 10.1, § 10.2, § 10.3, § 10.4, § 2.1 étape 2, § 9) : la nature
// choisie, jamais devinée, l'aperçu obligatoire, l'encodage et le
// séparateur nommés, l'association par en-tête, l'ambiguïté, les refus
// d'une ligne et les refus globaux, les étiquettes en pastilles et leurs
// fusions à part, le rapport, le CSV des refus, les modes, l'import selon
// l'état, le collage, le modèle à télécharger et le guide de l'import, la
// colonne de la présence, les doublons nommés et « Rendre les noms
// uniques ».
// Chaque épreuve monte App par
// monterApp, sur le système de fichiers simulé, ouvre un événement et sa
// section d'import ; le dialogue de choix sert, dans l'ordre, les fichiers
// que l'épreuve prépare, et le dialogue d'enregistrement relève ce qu'il
// reçoit (contrat de données, « Les dialogues de fichiers »).
//
// Les octets de chaque cas se construisent ici ; seuls les CSV livrés se
// lisent, par leur adresse (?url) et fetch : ?raw les lirait en UTF-8 et
// détruirait la variante windows-1252. Les valeurs attendues viennent des
// mêmes implémentations que l'écran sollicite — decoder, apercevoir,
// exporterRefus et libelle, bilanRemplacement —, appelées ici une seconde
// fois (§ 19.1). Les noms d'épreuve sont inventés.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { flushSync } from 'svelte';
import { TABLES_APPLICATION, libelle } from '../../application/libelles.js';
import { creerFormat } from '../../application/format.js';
import { creerTraduction } from '../../application/traduction.js';
import { apercevoir } from '../../csv/apercu.js';
import { ENTETES_DES_CHAMPS } from '../../csv/colonnes.js';
import { decoder } from '../../csv/encodage.js';
import { bilanRemplacement, exporterRefus as exporterRefusCsv } from '../../csv/import.js';
import { decouper } from '../../csv/lecture.js';
import { modeleParticipants } from '../../csv/export.js';
import { ENTETES_DES_OBJECTIFS, apercevoirObjectifs, bilanRemplacementObjectifs, modeleObjectifs } from '../../csv/objectifs.js';
import { serialiser } from '../../stockage/canonique.js';
import { creerCharge } from '../../stockage/document.js';
import { lireJournal } from '../../stockage/journal.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { VERSION } from '../../version.genere.js';
import { fixerCadre, pointer, touche } from '../../../test/navigateur/entrees.js';
import { monterApp } from '../../../test/navigateur/montage.js';
import { composantes, rangeesDeTexte, traductionEcran, visible } from '../../../test/navigateur/rendu.js';
import urlCasLimites from '../../../exemples/participants_cas_limites.csv?url';
import urlCasLimites1252 from '../../../exemples/participants_cas_limites_cp1252.csv?url';
import urlGrande from '../../../exemples/participants_demo_grande.csv?url';
import urlObjectifs from '../../../exemples/objectifs_cas_limites.csv?url';
import { TABLES_INTERFACE } from '../libelles.js';
import { traceIcone } from '../primitives/icones.js';
import { ENCODAGES, SEPARATEURS } from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
// Le t de l'écran, celui qu'App pose au contexte (§ 14.6) : l'attendu d'un
// texte lu tel que l'écran le porte, insécables comprises.
const { t: tEcran } = traductionEcran();
const format = creerFormat(t);

const BASE = 'soiree';
const MARQUE_UTF8 = [0xef, 0xbb, 0xbf];
const OUVERTURE_TEMOIN = '\u{2045}';
const FERMETURE_TEMOIN = '\u{2046}';

// Les octets d'un CSV livré, tels que le fichier les porte.
const lireLivre = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());

// Un texte en UTF-8 avec marque, en UTF-16 LE ou BE avec marque.
const enUtf8 = (texte) => Uint8Array.from([...MARQUE_UTF8, ...new TextEncoder().encode(texte)]);
function enUtf16(texte, ordre) {
  const octets = [ordre === 'le' ? 0xff : 0xfe, ordre === 'le' ? 0xfe : 0xff];
  for (let i = 0; i < texte.length; i += 1) {
    const unite = texte.charCodeAt(i);
    const fort = unite >> 8;
    const faible = unite & 0xff;
    octets.push(...(ordre === 'le' ? [faible, fort] : [fort, faible]));
  }
  return Uint8Array.from(octets);
}

// Un participant de la charge d'épreuve.
const personne = (id, nom, prenom = null, autres = {}) => ({
  id, nom, prenom, organisation: null, courriel: null, titrePressenti: null, notes: null, exclu: false, ...autres,
});

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
  expect(globalThis.__gttErreurs?.slice(erreursAvant) ?? [], 'erreurs reçues par le collecteur').toEqual([]);
});

/**
 * Un montage dont l'événement « Soirée des Merles », de deux tours sauf
 * demande, est ouvert sur sa section d'import : les participants donnés,
 * en écriture sauf demande,
 * préparé par prepare(seance, generation) avant que l'espion se pose. Le
 * dialogue de choix sert aServir dans l'ordre ; l'enregistreur relève
 * enregistres et rend le nom proposé.
 */
async function ouvrir({
  participants = [], tables = [], ecriture = true, langue = 'fr', siegesParDefaut = 6, prepare = null, tours = 2,
} = {}) {
  const charge = creerCharge({ id: 'epreuve-import', nom: 'Soirée des Merles', siegesParDefaut, tours });
  charge.participants = participants;
  charge.prochainsIds.participant = participants.length + 1;
  charge.tables = tables;
  charge.prochainsIds.table = tables.length + 1;
  const texte = serialiser(charge, { revision: 1, produitVersion: VERSION.affichee });
  const m = await monterApp({ fichiers: [{ racine: 'documents', chemin: `${BASE}/${BASE}.gtt.json`, texte }], langue });
  montes.push(m);
  await m.seance.ouvrir(`${BASE}/${BASE}`);
  await m.seance.passerEnEcriture();
  if (prepare !== null) await prepare(m.seance, m.app.generation());
  if (!ecriture && m.seance.etat().mode === 'ecriture') await m.seance.passerEnLecture();
  m.ui.allerA('import');
  flushSync();
  const aServir = [];
  const enregistres = [];
  m.fs.choisirFichierAImporter = async () => aServir.shift() ?? null;
  m.fs.enregistrerSous = async (nomPropose, octets) => {
    enregistres.push({ nomPropose, octets });
    return nomPropose;
  };
  const espion = vi.spyOn(m.seance, 'executer');
  return { m, aServir, enregistres, espion };
}

const section = ({ m }) => m.racine.querySelector('[data-section="import"]');
const dans = (e, selecteur) => section(e).querySelector(selecteur);
const tous = (e, selecteur) => [...section(e).querySelectorAll(selecteur)];
const commande = (e, nom) => dans(e, `[data-commande="${nom}"]`);
const enLigne = (texte) => texte.replace(/\s+/g, ' ').trim();
const texteDe = (element) => enLigne(element.textContent);
const ecritures = ({ m }) => m.trace.length;
const imports = ({ espion }, nom = 'importerParticipants') => espion.mock.calls.filter(([appel]) => appel === nom);

// Sert un fichier au dialogue et le choisit : l'aperçu s'ouvre sur lui.
async function choisir(e, nom, octets) {
  e.aServir.push({ nom, octets });
  commande(e, 'choisirFichier').click();
  await vi.waitFor(() => expect(dans(e, '[data-apercu] [data-fichier]')?.textContent).toBe(nom));
}

// Remet un texte comme le collage de la grille : ui.ouvrirImport,
// puis ui.allerA('import').
async function coller(e, texte) {
  e.m.ui.ouvrirImport({ texte, origine: 'collage' });
  e.m.ui.allerA('import');
  await vi.waitFor(() => expect(dans(e, '[data-apercu] [data-collage]')).not.toBeNull());
}

// Choisit un mode d'import.
function choisirMode(e, mode) {
  dans(e, `[data-champ="mode"] input[value="${mode}"]`).click();
  flushSync();
}

// Clique « Importer » et attend la fin de l'appel à la séance qu'il fait,
// la commande nom : rend ce que rend seance.executer, ou le refus.
async function importer(e, nom = 'importerParticipants') {
  const avant = imports(e, nom).length;
  commande(e, 'importer').click();
  await vi.waitFor(() => expect(imports(e, nom).length).toBe(avant + 1));
  const resultat = e.espion.mock.results.filter((_, rang) => e.espion.mock.calls[rang][0] === nom).at(-1);
  try {
    const rendu = await resultat.value;
    await vi.waitFor(() => expect(dans(e, '[data-rapport]')).not.toBeNull());
    return { rendu, refus: null };
  } catch (erreur) {
    await vi.waitFor(() => expect(dans(e, `[data-refus="${erreur.code}"]`)).not.toBeNull());
    return { rendu: null, refus: erreur };
  }
}

// Les lignes valides montrées sous un conteneur : le texte de chaque
// cellule, dans l'ordre. Une cellule d'étiquettes se lit pastille par
// pastille, chacune par son libellé, sans l'espace que la Pastille pose
// entre son icône et lui.
const texteCellule = (cellule) => {
  const pastilles = [...cellule.querySelectorAll('li')];
  return pastilles.length === 0 ? cellule.textContent : pastilles.map(texteDe).join('');
};
const lignesMontrees = (conteneur) =>
  [...conteneur.querySelectorAll('[data-lignes] [data-ligne]')].map((ligne) =>
    [...ligne.querySelectorAll('[data-cellule]')].map(texteCellule));
const cellule = (conteneur, ligne, champ) =>
  texteCellule(conteneur.querySelector(`[data-lignes] [data-ligne="${ligne}"] [data-cellule="${champ}"]`));
const refusee = (conteneur, ligne) => conteneur.querySelector(`[data-refusees] [data-ligne="${ligne}"]`);
const association = (conteneur) =>
  [...conteneur.querySelectorAll('[data-colonne]')].map((colonne) => [
    colonne.querySelector('[data-entete]').textContent,
    colonne.querySelector('[data-devient]').textContent,
  ]);
const participantsDe = ({ m }) => m.seance.etat().charge.participants;

// Les entrées du journal de l'événement, 0 avant le premier geste.
function entrees({ m }) {
  const texte = m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`);
  return texte === null ? 0 : lireJournal(texte).entrees.length;
}

// Les comptes du rapport, chacun lu à son [data-compte] — le nombre, puis
// son libellé — ; et ceux qu'il doit afficher : le résumé que rend
// seance.executer, par format.nombre, et le libellé accordé au nombre.
const COMPTES_DU_RAPPORT = ['ajoutes', 'misAJour', 'inchanges', 'retires', 'reservationsRetirees'];
const comptesAffiches = (e) =>
  COMPTES_DU_RAPPORT.map((nom) => {
    const compte = dans(e, `[data-rapport] [data-compte="${nom}"]`);
    return [nom, compte.querySelector('[data-nombre]').textContent, compte.querySelector('[data-nombre] + span').textContent];
  });
const comptesDu = (resume) => COMPTES_DU_RAPPORT.map((nom) => [nom, format.nombre(resume[nom]), t(`import.rapport.${nom}`, { n: resume[nom] })]);

// Un glissement sur la fenêtre, portant un fichier ou un texte seul : rend
// l'événement distribué, dont defaultPrevented dit s'il a été accepté.
function glisser({ fichier = null, texte = null }) {
  const transfert = new DataTransfer();
  if (fichier !== null) transfert.items.add(fichier);
  if (texte !== null) transfert.setData('text/plain', texte);
  const evenement = new DragEvent('dragover', { dataTransfer: transfert, bubbles: true, cancelable: true });
  document.body.dispatchEvent(evenement);
  return evenement;
}

// Amène un élément dans la fenêtre, puis dit s'il y est rendu visible
// (test/navigateur/rendu.js).
function vu(element) {
  element.scrollIntoView({ block: 'center' });
  return visible(element);
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
const fondDe = (element) => composantes(getComputedStyle(element).backgroundColor);

describe('l’aperçu est obligatoire (§ 10.1)', () => {
  test('choisir les cas limites ouvre l’aperçu, sans rien écrire ; déposer un fichier sur la fenêtre ouvre son aperçu ; aucun contrôle hors de l’import n’importe', async () => {
    const e = await ouvrir();
    const avant = ecritures(e);
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    expect(vu(dans(e, '[data-apercu] h3'))).toBe(true);
    expect(ecritures(e)).toBe(avant);

    const octets = enUtf8('nom;prenom\r\nOmbrelle;Iris\r\n;Théo\r\n');
    const deposee = new File([octets], 'deposee.csv', { type: 'text/csv' });
    // Le survol qui porte un fichier est accepté, sans quoi le navigateur ne
    // remet pas le dépôt et ouvre le fichier à la place de l'application ;
    // un survol sans fichier ne l'est pas.
    expect(glisser({ fichier: deposee }).defaultPrevented).toBe(true);
    expect(glisser({ texte: 'Ombrelle' }).defaultPrevented).toBe(false);
    const transfert = new DataTransfer();
    transfert.items.add(deposee);
    document.body.dispatchEvent(new DragEvent('drop', { dataTransfer: transfert, bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(dans(e, '[data-apercu] [data-fichier]')?.textContent).toBe('deposee.csv'));

    const controles = tous(e, '[data-apercu] button, [data-apercu] input').filter(
      (element) => element.dataset.commande !== 'importer' && element.dataset.commande !== 'fermerApercu',
    );
    expect(controles.length).toBeGreaterThan(0);
    for (const controle of controles) {
      controle.click();
      flushSync();
    }
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    expect(imports(e)).toEqual([]);
    expect(ecritures(e)).toBe(avant);
  });
});

describe('encodage et séparateur nommés (§ 10.1, § 19.3)', () => {
  test('les cas limites, puis leur variante windows-1252 : encodage et séparateur de decoder et de l’aperçu, « Héloïse » intacte, mêmes lignes', async () => {
    const e = await ouvrir();
    const vus = [];
    for (const [nom, url] of [['participants_cas_limites.csv', urlCasLimites], ['participants_cas_limites_cp1252.csv', urlCasLimites1252]]) {
      const octets = await lireLivre(url);
      await choisir(e, nom, octets);
      const { texte, encodage } = decoder(octets);
      expect(dans(e, '[data-encodage]').textContent).toBe(t(ENCODAGES.get(encodage)));
      expect(dans(e, '[data-separateur]').textContent).toBe(t(SEPARATEURS.get(apercevoir(texte).separateur)));
      const apercu = dans(e, '[data-apercu]');
      expect(apercu.textContent).toContain('Héloïse');
      expect(apercu.textContent).not.toContain('HÃ©loÃ¯se');
      vus.push({ encodage, lignes: lignesMontrees(apercu) });
    }
    expect(vus.map(({ encodage }) => encodage)).toEqual(['utf-8-bom', 'windows-1252']);
    expect(dans(e, '[data-separateur]').textContent).toBe(t('import.separateur.virgule'));
    expect(vus[0].lignes.length).toBe(13);
    expect(vus[1].lignes).toEqual(vus[0].lignes);
  });

  test('un même texte en UTF-16 LE puis BE, à marque : chacun nommé, mêmes lignes', async () => {
    const e = await ouvrir();
    const texte = 'nom;prenom;organisation\r\nOmbrelle;Iris;Club des Merles\r\nPervenche;Benoît;Grisaille\r\n';
    const vus = [];
    for (const ordre of ['le', 'be']) {
      await choisir(e, `liste-${ordre}.csv`, enUtf16(texte, ordre));
      expect(dans(e, '[data-encodage]').textContent).toBe(t(ENCODAGES.get(`utf-16${ordre}`)));
      vus.push(lignesMontrees(dans(e, '[data-apercu]')));
    }
    expect(vus[0].length).toBe(2);
    expect(vus[1]).toEqual(vus[0]);
    expect(vus[0][1].slice(0, 3)).toEqual(['Pervenche', 'Benoît', 'Grisaille']);
  });

  test('un fichier d’une seule colonne, en-tête « nom » : « une seule colonne », « Ombrelle, Iris » entière', async () => {
    const e = await ouvrir();
    await choisir(e, 'noms.csv', enUtf8('nom\r\nPervenche\r\nOmbrelle, Iris\r\nLacasse\r\n'));
    expect(dans(e, '[data-separateur]').textContent).toBe('une seule colonne');
    expect(cellule(dans(e, '[data-apercu]'), 3, 'nom')).toBe('Ombrelle, Iris');
  });
});

describe('les colonnes s’associent par leur en-tête (§ 10.1)', () => {
  test('deux fichiers aux colonnes permutées, « NOM », « Équipe », « Rôle » : même association, mêmes participants ; « Allergies » non reconnue', async () => {
    const e = await ouvrir();
    const premier = 'NOM;Équipe;Rôle;Allergies\r\nOmbrelle;Club des Merles;animation;noix\r\nPervenche;Grisaille;;\r\n';
    const second = 'Allergies;Rôle;Équipe;NOM\r\nnoix;animation;Club des Merles;Ombrelle\r\n;;Grisaille;Pervenche\r\n';
    const vus = [];
    for (const [nom, texte] of [['premier.csv', premier], ['second.csv', second]]) {
      await choisir(e, nom, enUtf8(texte));
      const apercu = dans(e, '[data-apercu]');
      vus.push({ association: new Map(association(apercu)), lignes: lignesMontrees(apercu) });
    }
    expect(vus[0].association.size).toBe(4);
    expect(vus[1].association).toEqual(vus[0].association);
    expect(vus[0].association.get('NOM')).toBe(t('import.champ.nom'));
    expect(vus[0].association.get('Équipe')).toBe(t('import.champ.organisation'));
    expect(vus[0].association.get('Rôle')).toBe(t('import.champ.titrePressenti'));
    expect(vus[0].association.get('Allergies')).toBe(tEcran('import.colonne.nonReconnue'));
    expect(vus[1].lignes).toEqual(vus[0].lignes);
    expect(vus[0].lignes.length).toBe(2);
  });

  test('« appartenance » et « entreprise » : l’aperçu demande laquelle vaut organisation ; importer est refusé à côté de la commande tant qu’elle demeure ; le choix l’associe, et l’import passe', async () => {
    const e = await ouvrir();
    await choisir(e, 'ambigu.csv', enUtf8('nom;appartenance;entreprise\r\nOmbrelle;Club des Merles;Grisaille\r\n'));
    const question = dans(e, '[data-champ="choix-organisation"]');
    expect(vu(question)).toBe(true);
    expect(texteDe(question)).toContain('appartenance');
    expect(texteDe(question)).toContain('entreprise');
    const avant = ecritures(e);
    const { refus } = await importer(e);
    expect(refus.code).toBe('AMBIGUITE');
    const posee = dans(e, '[data-refus="AMBIGUITE"]');
    expect(commande(e, 'importer').parentElement.contains(posee)).toBe(true);
    expect(ecritures(e)).toBe(avant);

    question.querySelector('input[value="2"]').click();
    flushSync();
    expect(new Map(association(dans(e, '[data-apercu]'))).get('entreprise')).toBe(t('import.champ.organisation'));
    expect(dans(e, '[data-champ="choix-organisation"]')).toBeNull();
    // Le refus valait pour l'ambiguïté : tranchée, il ne reste pas affiché.
    expect(dans(e, '[data-refus="AMBIGUITE"]')).toBeNull();
    const { rendu } = await importer(e);
    expect(rendu.resume.ajoutes).toBe(1);
    expect(participantsDe(e).map(({ nom, organisation }) => [nom, organisation])).toEqual([['Ombrelle', 'Grisaille']]);
  });

  test('sous « Remplacer », l’ambiguïté refuse l’import à côté de la commande, sans ouvrir la fenêtre ; le choix fait, la fenêtre s’ouvre', async () => {
    const e = await ouvrir({ participants: QUATRE() });
    await choisir(e, 'ambigu.csv', enUtf8('nom;organisation;entreprise\r\nOmbrelle;Club des Merles;Grisaille\r\n'));
    choisirMode(e, 'remplacer');
    const avant = ecritures(e);
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, '[data-refus="AMBIGUITE"]')).not.toBeNull());
    expect(commande(e, 'importer').parentElement.contains(dans(e, '[data-refus="AMBIGUITE"]'))).toBe(true);
    expect(dans(e, 'dialog')).toBeNull();
    expect(imports(e)).toEqual([]);
    expect(ecritures(e)).toBe(avant);

    dans(e, '[data-champ="choix-organisation"] input[value="1"]').click();
    flushSync();
    expect(dans(e, '[data-refus="AMBIGUITE"]')).toBeNull();
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')?.open).toBe(true));
    dans(e, 'dialog [data-commande="renoncer"]').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')).toBeNull());
    expect(imports(e)).toEqual([]);
    expect(ecritures(e)).toBe(avant);
  });
});

describe('exclu : une liste fermée (§ 10.1)', () => {
  test('« Oui », « X », « 0 » et vide acceptés ; « peut-être » refuse sa ligne, le motif citant la valeur ; les autres s’importent', async () => {
    const e = await ouvrir();
    await choisir(
      e,
      'exclus.csv',
      enUtf8('nom;exclu\r\nOmbrelle;Oui\r\nPervenche;X\r\nLacasse;0\r\nFauvelle;\r\nMorillon;peut-être\r\n'),
    );
    const apercu = dans(e, '[data-apercu]');
    expect(lignesMontrees(apercu).length).toBe(4);
    expect(tous(e, '[data-apercu] [data-refusees] [data-ligne]').length).toBe(1);
    expect(texteDe(refusee(apercu, 6))).toContain('« peut-être »');
    await importer(e);
    expect(participantsDe(e).map(({ nom, exclu }) => [nom, exclu])).toEqual([
      ['Ombrelle', true], ['Pervenche', true], ['Lacasse', false], ['Fauvelle', false],
    ]);
  });
});

// Un fichier par refus global, ses octets, et la clé du remède attendue.
const REFUS_GLOBAUX = [
  ['AUCUN_ENTETE', enUtf8('alpha;beta\r\nOmbrelle;Iris\r\n'), 'import.remede.aucunEntete'],
  ['NOM_NON_ASSOCIE', enUtf8('prenom;notes\r\nIris;x\r\n'), 'import.remede.nomNonAssocie'],
  ['AUCUNE_LIGNE_VALIDE', enUtf8('nom;prenom\r\n;Iris\r\n'), 'import.remede.aucuneLigneValide'],
  ['UTF16_SANS_MARQUE', Uint8Array.from([0x6e, 0x00, 0x6f, 0x00, 0x6d, 0x00]), 'ENREGISTRER_EN_UTF8'],
  ['UTF16_INVALIDE', Uint8Array.from([0xff, 0xfe, 0x6e, 0x00, 0x6f]), 'ENREGISTRER_EN_UTF8'],
  ['UTF8_INVALIDE', Uint8Array.from([...MARQUE_UTF8, 0x6e, 0x6f, 0xe9, 0x6d]), 'ENREGISTRER_EN_UTF8'],
  ['CARACTERE_NUL', enUtf8('nom\r\nOmbrelle\u{0}\r\n'), 'ENREGISTRER_EN_UTF8'],
  ['GUILLEMET_OUVERT', enUtf8('nom;prenom\r\n"Ombrelle;Iris\r\n'), 'import.remede.guillemetOuvert'],
  ['SEPARATEUR_INTROUVABLE', enUtf8('nom;prenom\r\nOmbrelle;Iris;x\r\nPervenche\r\n'), 'import.remede.separateurIntrouvable'],
];

describe('les refus globaux (§ 10.1)', () => {
  test('un fichier par cas : la cause et le remède de la table affichés, aucune commande d’import, rien d’écrit', async () => {
    const e = await ouvrir();
    expect(REFUS_GLOBAUX.length).toBe(9);
    const avant = ecritures(e);
    for (const [code, octets, remede] of REFUS_GLOBAUX) {
      await choisir(e, `${code}.csv`, octets);
      const pose = dans(e, `[data-apercu] [data-refus="${code}"]`);
      expect(pose, code).not.toBeNull();
      expect(vu(pose), code).toBe(true);
      const texte = pose.textContent;
      expect(texte, code).toContain(tEcran(remede, { ligne: 2 }));
      expect(texte.length, code).toBeGreaterThan(t(remede, { ligne: 2 }).length);
      expect(commande(e, 'importer'), code).toBeNull();
    }
    expect(ecritures(e)).toBe(avant);
  });

  test('un collage qui porte le caractère nul : la cause et le remède du collage', async () => {
    const e = await ouvrir();
    const avant = ecritures(e);
    await coller(e, 'nom\nOmbrelle\u{0}\n');
    const pose = dans(e, '[data-apercu] [data-refus="CARACTERE_NUL"]');
    expect(pose.textContent).toContain(t('CARACTERE_NUL'));
    expect(pose.textContent).toContain(t('import.remede.caractereNulCollage'));
    expect(commande(e, 'importer')).toBeNull();
    expect(dans(e, '[data-encodage]')).toBeNull();
    expect(ecritures(e)).toBe(avant);
  });
});

describe("un conflit d'organisation fautif refuse le fichier entier (§ 10.1)", () => {
  test("une organisation inconnue : cause, ligne et invitation à réimporter, rien d'écrit ; corrigé, le fichier s'importe", async () => {
    // Aucune ligne ni commande d'import sous le refus ; l'organisation que
    // le fichier corrigé crée compte.
    const e = await ouvrir({ participants: [personne(1, 'Houle', null, { organisation: 'Club des Merles' })] });
    const avant = ecritures(e);
    await choisir(e, 'conflits.csv', enUtf8('nom;organisation;conflit organisation\r\nOmbrelle;Atelier Ressac;club des merles\r\nPervenche;;Société Gamma\r\n'));
    const pose = dans(e, '[data-apercu] [data-refus="CONFLIT_ORGANISATION_INCONNUE"]');
    expect(pose).not.toBeNull();
    expect(vu(pose)).toBe(true);
    const textes = [...pose.querySelectorAll('p')].map(texteDe);
    expect(textes).toContain("L'organisation « Société Gamma » n'existe pas (ligne 3, colonne des conflits). Rien n'est importé.");
    expect(textes).toContain(t('import.remede.conflitOrganisation', { ligne: 3 }));
    expect(t('import.remede.conflitOrganisation', { ligne: 3 })).toMatch(/importez le fichier de nouveau/);
    expect(dans(e, '[data-apercu] [data-lignes]')).toBeNull();
    expect(commande(e, 'importer')).toBeNull();
    expect(ecritures(e)).toBe(avant);

    await choisir(e, 'conflits-corrige.csv', enUtf8('nom;organisation;conflit organisation\r\nOmbrelle;Atelier Ressac;club des merles\r\nPervenche;;Société Gamma | Atelier Ressac\r\nLacasse;Société Gamma;\r\n'));
    expect(dans(e, '[data-apercu] [data-refus]')).toBeNull();
    const pastilles = [...dans(e, '[data-lignes] [data-ligne="3"] [data-cellule="conflit_organisation"]').querySelectorAll('li')].map(texteDe);
    expect(pastilles).toEqual(['Société Gamma', 'Atelier Ressac']);
    expect(cellule(section(e), 2, 'conflit_organisation')).toBe('Club des Merles');
    const { rendu, refus } = await importer(e);
    expect(refus).toBeNull();
    expect(rendu.resume.ajoutes).toBe(3);
    expect(participantsDe(e).map(({ conflits }) => conflits)).toEqual([undefined, ['Club des Merles'], ['Atelier Ressac', 'Société Gamma'], undefined]);
    // Le premier geste pose le journal, son entrée de reprise et la sienne.
    expect(lireJournal(e.m.fs.contenu('documents', `${BASE}/${BASE}${SUFFIXES.journal}`)).entrees.at(-1).libelle).toBe('Mis à jour la liste par import : 3 ajoutés, 0 modifié');
  });

  test('sa propre organisation : la cause et son propre remède, rien d’écrit', async () => {
    const e = await ouvrir();
    const avant = ecritures(e);
    await choisir(e, 'propre.csv', enUtf8('nom;organisation;conflits\r\nOmbrelle;Atelier Ressac;ATELIER RESSAC\r\n'));
    const pose = dans(e, '[data-apercu] [data-refus="CONFLIT_ORGANISATION_PROPRE"]');
    expect(pose).not.toBeNull();
    expect(texteDe(pose)).toContain(t('import.remede.conflitPropre', { ligne: 2 }));
    expect(texteDe(pose)).toContain("L'organisation « ATELIER RESSAC » est celle de la personne (ligne 2");
    expect(commande(e, 'importer')).toBeNull();
    expect(ecritures(e)).toBe(avant);
  });
});

describe('une ligne fausse n’arrête pas le reste (§ 10.1, § 2.1)', () => {
  test('la grande démonstration, « peut-être » à l’enregistrement 213 : 259 lignes valides, la ligne 213 et sa valeur ; l’import en ajoute 259', async () => {
    const e = await ouvrir();
    const { texte } = decoder(await lireLivre(urlGrande));
    const enregistrements = texte.split('\r\n');
    expect(enregistrements[212]).toMatch(/;non;;;$/);
    enregistrements[212] = enregistrements[212].replace(/;non;;;$/, ';peut-être;;;');
    await choisir(e, 'grande.csv', enUtf8(enregistrements.join('\r\n')));
    const apercu = dans(e, '[data-apercu]');
    expect(dans(e, '[data-valides] [data-nombre]').textContent).toBe('259');
    expect(tous(e, '[data-apercu] [data-refusees] [data-ligne]').map((ligne) => ligne.dataset.ligne)).toEqual(['213']);
    expect(texteDe(refusee(apercu, 213))).toContain('213');
    expect(texteDe(refusee(apercu, 213))).toContain(t('EXCLU_INCONNU', { valeur: 'peut-être' }));
    const { rendu } = await importer(e);
    expect(rendu.resume.ajoutes).toBe(259);
    expect(participantsDe(e).length).toBe(259);
  });

  test('le rang : la ligne refusée des cas limites, sans nom, s’affiche 13, son enregistrement, et non 14, sa ligne de texte', async () => {
    const e = await ouvrir();
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    const apercu = dans(e, '[data-apercu]');
    expect(tous(e, '[data-apercu] [data-refusees] [data-ligne]').map((ligne) => ligne.dataset.ligne)).toEqual(['13', '16']);
    expect(texteDe(refusee(apercu, 13))).toContain('13');
    expect(texteDe(refusee(apercu, 13))).toContain(t('NOM_ABSENT'));
    expect(refusee(apercu, 14)).toBeNull();
  });
});

describe('le rapport (§ 10.1, § 19.3)', () => {
  test('« Coopérative Bleue » existante, « cooperative  bleue » et « COOPÉRATIVE BLEUE » lues : un groupe affiché, ses trois orthographes et leurs comptes, dans l’aperçu puis le rapport', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Ombrelle', 'Iris', { organisation: 'Coopérative Bleue' })] });
    await choisir(
      e,
      'bleue.csv',
      enUtf8('nom;prenom;organisation\r\nPervenche;Théo;cooperative  bleue\r\nLacasse;Ondine;COOPÉRATIVE BLEUE\r\nFauvelle;;\r\n'),
    );
    const attendu = [['Coopérative Bleue', '0'], ['cooperative  bleue', '1'], ['COOPÉRATIVE BLEUE', '1']];
    const groupes = (conteneur) =>
      [...conteneur.querySelectorAll('[data-fusion]')].map((fusion) => ({
        affichee: fusion.querySelector('[data-affichee]').textContent,
        orthographes: [...fusion.querySelectorAll('[data-orthographe]')].map((o) => [
          o.querySelector('[data-texte]').textContent,
          o.querySelector('[data-nombre]').textContent,
        ]),
      }));
    expect(groupes(dans(e, '[data-apercu]'))).toEqual([{ affichee: 'Coopérative Bleue', orthographes: attendu }]);
    await importer(e);
    const rapport = dans(e, '[data-rapport]');
    expect(vu(rapport.querySelector('h3'))).toBe(true);
    expect(groupes(rapport)).toEqual([{ affichee: 'Coopérative Bleue', orthographes: attendu }]);
    for (const texte of tous(e, '[data-orthographe] [data-texte]')) expect(texte.textContent.trim()).not.toBe('');
  });

  test('les cas limites : au moins un groupe et une ligne refusée, dans l’aperçu puis le rapport ; aucune organisation vide listée', async () => {
    const e = await ouvrir();
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    for (const conteneur of ['[data-apercu]', null]) {
      if (conteneur === null) await importer(e);
      const ici = dans(e, conteneur ?? '[data-rapport]');
      expect(ici.querySelectorAll('[data-fusion]').length).toBeGreaterThanOrEqual(1);
      expect(ici.querySelectorAll('[data-refusees] [data-ligne]').length).toBeGreaterThanOrEqual(1);
      const orthographes = [...ici.querySelectorAll('[data-orthographe] [data-texte]')];
      expect(orthographes.length).toBeGreaterThan(0);
      for (const texte of orthographes) expect(texte.textContent.trim()).not.toBe('');
    }
  });
});

describe('le CSV des lignes refusées (§ 10.1)', () => {
  test('« Enregistrer les lignes refusées » remet les octets d’exporterRefus de src/csv, motif de libelle ; corrigé et réimporté, la ligne entre, ligne et motif non reconnues', async () => {
    const e = await ouvrir();
    const octets = await lireLivre(urlCasLimites);
    await choisir(e, 'participants_cas_limites.csv', octets);
    commande(e, 'enregistrerRefus').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    const apercu = apercevoir(decoder(octets).texte, { participants: [], mode: 'ajouter', tours: 2 });
    expect(e.enregistres[0].nomPropose).toBe(`${BASE}-refus.csv`);
    expect([...e.enregistres[0].octets]).toEqual([...exporterRefusCsv(apercu, libelle)]);

    const corrige = decoder(e.enregistres[0].octets)
      .texte.replace('\r\n;Clotilde;', '\r\nRavenelle;Clotilde;')
      .replace(';0-2;555-0115;', ';2;555-0115;');
    expect(corrige).toContain('Ravenelle;Clotilde;');
    await choisir(e, 'corrige.csv', enUtf8(corrige));
    const vu = new Map(association(dans(e, '[data-apercu]')));
    expect(vu.get('ligne')).toBe(tEcran('import.colonne.nonReconnue'));
    expect(vu.get('motif')).toBe(tEcran('import.colonne.nonReconnue'));
    await importer(e);
    expect(participantsDe(e).map(({ nom, prenom, presence }) => [nom, prenom, presence])).toEqual([
      ['Ravenelle', 'Clotilde', undefined],
      ['Quenouillet', 'Aurèle', [2]],
    ]);
  });

  test('après une mise à jour qui refuse des lignes, le rapport remet exporterRefus(apercu, libelle, resume.refusees), refus de la mise à jour compris', async () => {
    const e = await ouvrir({
      participants: [personne(1, 'Lacasse', 'Ondine'), personne(2, 'Lacasse', 'Odile'), personne(3, 'Ombrelle', 'Iris')],
    });
    await choisir(e, 'maj.csv', enUtf8('nom;prenom\r\nLacasse;\r\nOmbrelle;Irène\r\n;Théo\r\n'));
    const { rendu } = await importer(e);
    const { apercu } = imports(e).at(-1)[1];
    expect(rendu.resume.refusees.map(({ code }) => code)).toEqual(['PLUSIEURS_CORRESPONDENT', 'NOM_ABSENT']);
    commande(e, 'enregistrerRefus').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    expect([...e.enregistres[0].octets]).toEqual([...exporterRefusCsv(apercu, libelle, rendu.resume.refusees)]);
  });

  test('en langue témoin, le motif affiché porte les marques, la colonne motif du CSV aucune', async () => {
    const e = await ouvrir({ langue: 'temoin' });
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    const motif = refusee(dans(e, '[data-apercu]'), 13).querySelector('[data-motif]').textContent;
    expect(motif.startsWith(OUVERTURE_TEMOIN) && motif.endsWith(FERMETURE_TEMOIN)).toBe(true);
    commande(e, 'enregistrerRefus').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    const { texte } = decoder(e.enregistres[0].octets);
    const [entete, ...refus] = decouper(texte, ';').enregistrements;
    const rang = entete.indexOf('motif');
    expect(rang).toBeGreaterThan(0);
    expect(refus.map((ligne) => ligne[entete.indexOf('ligne')])).toEqual(['13', '16']);
    expect(refus[0][rang]).toBe(libelle('NOM_ABSENT', { ligne: 13, valeur: null }));
    expect(refus[1][rang]).toBe(libelle('PRESENCE_HORS_TOURS', { ligne: 16, valeur: '0-2', tour: 0, tours: 2 }));
    expect(texte).not.toContain(OUVERTURE_TEMOIN);
    expect(texte).not.toContain(FERMETURE_TEMOIN);
  });
});

describe('une seule entrée, des doublons signalés, une mise à jour qui n’efface pas (§ 10.1)', () => {
  test('les 260 lignes de la grande démonstration : une entrée du journal, un état écrit', async () => {
    // Un premier geste pose le journal, et l'entrée de reprise qui l'ouvre.
    const e = await ouvrir({ prepare: (seance) => seance.executer('creerTable', { forme: 'ronde' }) });
    expect(entrees(e)).toBeGreaterThan(0);
    await choisir(e, 'participants_demo_grande.csv', await lireLivre(urlGrande));
    const avant = ecritures(e);
    const entreesAvant = entrees(e);
    const { rendu } = await importer(e);
    expect(rendu.resume.ajoutes).toBe(260);
    expect(entrees(e)).toBe(entreesAvant + 1);
    const etats = e.m.trace.slice(avant).filter(([primitive, , chemin]) => primitive === 'ecrireAtomique' && chemin === `${BASE}/${BASE}${SUFFIXES.etat}`);
    expect(etats.length).toBe(1);
  });

  test('deux clics réels sur « Importer » pendant l’écriture d’un support lent : la liste s’importe une fois, une entrée du journal', async () => {
    const e = await ouvrir({ prepare: (seance) => seance.executer('creerTable', { forme: 'ronde' }) });
    await coller(e, 'nom;prenom\nOmbrelle;Iris\nPervenche;Théo\nLacasse;Ondine');
    dans(e, '[data-champ="mode"] input[value="ajouter"]').click();
    flushSync();
    const entreesAvant = entrees(e);
    // Le journal du système simulé retient ses ajouts de ligne jusqu'à
    // liberer() : l'import reste en cours d'écriture.
    const ajouterLigne = e.m.fs.ajouterLigne;
    let liberer;
    const porte = new Promise((resoudre) => {
      liberer = resoudre;
    });
    e.m.fs.ajouterLigne = async (...parametres) => {
      await porte;
      return ajouterLigne.apply(e.m.fs, parametres);
    };
    const bouton = commande(e, 'importer');
    bouton.scrollIntoView({ block: 'center' });
    const boite = bouton.getBoundingClientRect();
    const [x, y] = [boite.left + boite.width / 2, boite.top + boite.height / 2];
    for (let clic = 0; clic < 2; clic += 1) {
      await pointer('presser', x, y);
      await pointer('relacher', x, y);
      flushSync();
    }
    await vi.waitFor(() => expect(imports(e).length).toBeGreaterThan(0));
    expect(imports(e)).toHaveLength(1);
    liberer();
    await vi.waitFor(() => expect(dans(e, '[data-rapport]')).not.toBeNull());
    await e.m.seance.formeNommee(null).catch(() => undefined);
    expect(e.m.seance.etat().charge.participants.map(({ nom }) => nom)).toEqual(['Ombrelle', 'Pervenche', 'Lacasse']);
    expect(entrees(e)).toBe(entreesAvant + 1);
  });

  test('deux lignes au même triplet et une égale à un existant : deux doublons ; en mode Ajouter, choisi, trois personnes de plus, d’identifiants distincts', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Ombrelle', 'Iris', { organisation: 'Grisaille' })] });
    await choisir(
      e,
      'doublons.csv',
      enUtf8('nom;prenom;organisation\r\nPervenche;Théo;Club des Merles\r\npervenche;THÉO;club des merles\r\nOmbrelle;Iris;Grisaille\r\n'),
    );
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    choisirMode(e, 'ajouter');
    expect(tous(e, '[data-apercu] [data-doublon]').length).toBe(2);
    const { rendu } = await importer(e);
    expect(rendu.resume.ajoutes).toBe(3);
    const ids = participantsDe(e).map(({ id }) => id);
    expect(ids.length).toBe(4);
    expect(new Set(ids).size).toBe(4);
  });

  test('une étiquette qui ne diffère d’un objectif de table que par la casse : la personne importée reçoit l’orthographe de l’objectif', async () => {
    // Aucune personne ne porte l'étiquette : seul l'objectif de la table la
    // donne, et l'aperçu de l'écran doit le lire, sans quoi le moteur, qui
    // compare les chaînes, ne rapprocherait jamais la personne de l'objectif.
    const e = await ouvrir({
      prepare: async (seance) => {
        await seance.executer('creerTable', { forme: 'ronde' });
        const [{ id }] = seance.etat().charge.tables;
        await seance.executer('poserObjectif', { table: id, tour: null, etiquettes: 'finance', regle: null });
      },
    });
    await coller(e, 'nom;etiquettes\nOmbrelle;Finance');
    choisirMode(e, 'ajouter');
    await importer(e);
    expect(participantsDe(e).map(({ nom, etiquettes }) => [nom, etiquettes])).toEqual([['Ombrelle', ['finance']]]);
  });

  test('mettre à jour : aucun courriel vidé ; une ligne qui désigne deux personnes, refusée, les deux nommées ; une seconde ligne pour la même personne, refusée, la première nommée', async () => {
    const e = await ouvrir({
      participants: [
        personne(1, 'Ombrelle', 'Iris', { courriel: 'iris@exemple.test' }),
        personne(2, 'Lacasse', 'Ondine', { courriel: 'ondine@exemple.test' }),
        personne(3, 'Lacasse', 'Odile'),
        personne(4, 'Pervenche', 'Théo', { courriel: 'theo@exemple.test' }),
      ],
    });
    await choisir(
      e,
      'noms_prenoms.csv',
      enUtf8('nom;prenom;organisation\r\nOmbrelle;Iris;Club des Merles\r\nLacasse;;\r\nPervenche;Théo;\r\nPervenche;;\r\nMorillon;Aurèle;\r\n'),
    );
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    const { rendu } = await importer(e);
    // Iris reçoit une organisation : une mise à jour ; Théo, sans valeur
    // nouvelle, reste inchangé.
    expect(rendu.resume).toMatchObject({ ajoutes: 1, misAJour: 1, inchanges: 1, retires: 0, reservationsRetirees: 0 });
    expect(comptesAffiches(e)).toEqual(comptesDu(rendu.resume));
    expect(participantsDe(e).find(({ id }) => id === 1).organisation).toBe('Club des Merles');
    const courriels = new Map(participantsDe(e).map(({ id, courriel }) => [id, courriel]));
    expect([courriels.get(1), courriels.get(2), courriels.get(4)]).toEqual(['iris@exemple.test', 'ondine@exemple.test', 'theo@exemple.test']);
    const rapport = dans(e, '[data-rapport]');
    const plusieurs = refusee(rapport, 3);
    expect(texteDe(plusieurs)).toContain(t('PLUSIEURS_CORRESPONDENT', { participants: [2, 3] }));
    expect([...plusieurs.querySelectorAll('[data-participant]')].map((p) => [p.dataset.participant, texteDe(p)])).toEqual([
      ['2', 'Ondine Lacasse'],
      ['3', 'Odile Lacasse'],
    ]);
    const deja = refusee(rapport, 5);
    expect(texteDe(deja)).toContain(t('DEJA_DESIGNE', { premiereLigne: 4 }));
  });
});

describe('les doublons nommés, et « Rendre les noms uniques » (§ 10.1)', () => {
  // Le compte du bloc des noms rendus uniques d'un conteneur, lu au
  // paragraphe du bloc que son titre nomme ; null sans ce bloc.
  const compteRenommes = (conteneur) => {
    const titre = enLigne(tEcran('import.apercu.renommes'));
    const intitule = [...conteneur.querySelectorAll('h4')].find((h4) => texteDe(h4) === titre);
    return intitule === undefined ? null : texteDe(intitule.closest('section').querySelector('p'));
  };

  test('le doublon nomme la personne et ses lignes ; « Rendre les noms uniques » suffixe les noms, le bloc disparaît, l’import et le rapport suivent', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Galet', 'Roger'), personne(2, 'GALET', 'Roger')] });
    await choisir(e, 'homonymes.csv', enUtf8('nom;prenom\r\nGalet;Roger\r\nGalet 01;Aurèle\r\nGALET;roger\r\n'));
    choisirMode(e, 'ajouter');
    const lignes = tEcran('import.apercu.doublonLignes', { lignes: [2, 4] });
    const deja = tEcran('import.apercu.doublonExistants');
    expect(tous(e, '[data-apercu] [data-doublon]').map(texteDe)).toEqual([enLigne(`Roger Galet — ${lignes} — ${deja} Roger Galet, Roger GALET`)]);
    const bouton = commande(e, 'rendreNomsUniques');
    expect(bouton.closest('section')).toBe(dans(e, '[data-apercu] [data-doublons]').closest('section'));
    expect(texteDe(bouton)).toBe(enLigne(tEcran('import.commande.rendreNomsUniques')));
    expect(compteRenommes(dans(e, '[data-apercu]'))).toBeNull();

    bouton.click();
    flushSync();
    await vi.waitFor(() => expect(dans(e, '[data-apercu] [data-doublons]')).toBeNull());
    expect(lignesMontrees(dans(e, '[data-apercu]')).map(([nom]) => nom)).toEqual(['Galet 02', 'Galet 01', 'GALET 03']);
    const compte = enLigne(`2 ${tEcran('import.apercu.nomsRendusUniques', { n: 2 })}`);
    expect(compteRenommes(dans(e, '[data-apercu]'))).toBe(compte);
    expect(commande(e, 'rendreNomsUniques')).toBeNull();
    // Le bouton parti, le focus va à la phrase des noms rendus uniques.
    await vi.waitFor(() => expect(document.activeElement).toBe(dans(e, '[data-apercu] .renommes')));

    const { rendu } = await importer(e);
    expect(rendu.resume.ajoutes).toBe(3);
    expect(participantsDe(e).map(({ nom, prenom }) => [nom, prenom])).toEqual([
      ['Galet', 'Roger'], ['GALET', 'Roger'], ['Galet 02', 'Roger'], ['Galet 01', 'Aurèle'], ['GALET 03', 'roger'],
    ]);
    expect(compteRenommes(dans(e, '[data-rapport]'))).toBe(compte);
    expect(dans(e, '[data-rapport] [data-doublons]')).toBeNull();
    expect(e.enregistres).toEqual([]);
  });

  test('une mise à jour qui ne fait que mettre à jour sa personne : le doublon se montre, sans commande ; en Ajouter, la commande s’offre', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Galet', 'Roger')] });
    await choisir(e, 'mise_a_jour.csv', enUtf8('nom;prenom\r\nGalet;Roger\r\n'));
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    expect(tous(e, '[data-apercu] [data-doublon]').length).toBe(1);
    expect(commande(e, 'rendreNomsUniques')).toBeNull();
    choisirMode(e, 'ajouter');
    expect(commande(e, 'rendreNomsUniques')).not.toBeNull();
  });

  // Le choix vaut pour le texte ouvert sous sa nature : rendus, les noms
  // de « Galet » ne disent rien du fichier suivant ni de la nature suivante.
  const PREMIER = enUtf8('nom;prenom\r\nGalet;Roger\r\nGalet;Roger\r\n');
  async function rendusUniques(e) {
    await choisir(e, 'premier.csv', PREMIER);
    commande(e, 'rendreNomsUniques').click();
    flushSync();
    await vi.waitFor(() => expect(dans(e, '[data-apercu] [data-doublons]')).toBeNull());
    expect(lignesMontrees(dans(e, '[data-apercu]')).map(([nom]) => nom)).toEqual(['Galet', 'Galet 01']);
  }
  // L'aperçu d'un texte lu tel qu'il est écrit : le doublon montré, la
  // commande offerte, aucun nom rendu unique.
  function telQuEcrit(e, noms) {
    expect(tous(e, '[data-apercu] [data-doublon]').length).toBe(1);
    expect(commande(e, 'rendreNomsUniques')).not.toBeNull();
    expect(compteRenommes(dans(e, '[data-apercu]'))).toBeNull();
    expect(lignesMontrees(dans(e, '[data-apercu]')).map(([nom]) => nom)).toEqual(noms);
  }

  test('un autre fichier à doublons, après « Rendre les noms uniques » : son aperçu et son import gardent les noms écrits, la commande de nouveau offerte', async () => {
    const e = await ouvrir();
    await rendusUniques(e);
    await choisir(e, 'second.csv', enUtf8('nom;prenom\r\nPlume;Iris\r\nPlume;Iris\r\n'));
    telQuEcrit(e, ['Plume', 'Plume']);
    await importer(e);
    expect(participantsDe(e).map(({ nom, prenom }) => [nom, prenom])).toEqual([['Plume', 'Iris'], ['Plume', 'Iris']]);
  });

  test('une autre nature, puis de nouveau Participants, après « Rendre les noms uniques » : le même texte se relit tel qu’il est écrit', async () => {
    const e = await ouvrir();
    await rendusUniques(e);
    choisirNature(e, 'objectifs');
    expect(dans(e, '[data-apercu] [data-doublons]')).toBeNull();
    expect(commande(e, 'rendreNomsUniques')).toBeNull();
    choisirNature(e, 'participants');
    telQuEcrit(e, ['Galet', 'Galet']);
  });
});

// Deux tables de trois places, puis une génération enregistrée jusqu'à
// compter nombre propositions.
async function avecPropositions(seance, generation, nombre) {
  await seance.executer('creerTable', { forme: 'ronde' });
  await seance.executer('creerTable', { forme: 'ronde' });
  for (let essai = 0; essai < 5 && seance.etat().charge.propositions.length < nombre; essai += 1) {
    await generation.generer({ ...generation.reglagesProposes(), nombre, arret: 500 });
  }
  expect(seance.etat().charge.propositions.length).toBeGreaterThanOrEqual(nombre);
}

const QUATRE = () => [
  personne(1, 'Ombrelle', 'Iris', { organisation: 'Coopérative Bleue' }),
  personne(2, 'Pervenche', 'Théo', { organisation: 'Grisaille' }),
  personne(3, 'Lacasse', 'Ondine', { organisation: 'Club des Merles' }),
  personne(4, 'Fauvelle', 'Aurèle'),
];

describe('remplacer annonce ce qu’il détruit (§ 10.1)', () => {
  test('l’aperçu se recalcule sous remplacer, la fenêtre porte les quatre comptes ; Annuler n’écrit rien ; Confirmer, une entrée, des identifiants neufs', async () => {
    const e = await ouvrir({
      participants: QUATRE(),
      siegesParDefaut: 3,
      prepare: async (seance, generation) => {
        await avecPropositions(seance, generation, 2);
        const [table] = seance.etat().charge.tables;
        await seance.executer('reserver', { participant: 1, table: table.id, siege: null, portee: 'tous', tour: null });
        await seance.executer('designer', { participant: 2, table: table.id, siege: null, libelle: 'Animation' });
      },
    });
    await choisir(e, 'remplace.csv', enUtf8('nom;prenom;organisation\r\nTisserin;Basilie;cooperative bleue\r\nMorillon;Aurèle;\r\n'));
    expect(tous(e, '[data-apercu] [data-fusion]').length).toBe(1);
    choisirMode(e, 'remplacer');
    expect(tous(e, '[data-apercu] [data-fusion]').length).toBe(0);
    expect(tous(e, '[data-apercu] [data-doublon]').length).toBe(0);
    expect(cellule(dans(e, '[data-apercu]'), 2, 'organisation')).toBe('cooperative bleue');

    const charge = e.m.seance.etat().charge;
    const bilan = bilanRemplacement(charge);
    expect(bilan.reservations).toBeGreaterThan(0);
    expect(bilan.titresPourvus).toBeGreaterThan(0);
    expect(bilan.propositions).toBeGreaterThanOrEqual(2);
    const attendus = [
      t('import.remplacer.participants', { n: bilan.participants }),
      t('import.remplacer.reservations', { n: bilan.reservations }),
      t('import.remplacer.titres', { n: bilan.titresPourvus }),
      t('import.remplacer.propositions', { n: bilan.propositions }),
    ];
    const avant = ecritures(e);
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')?.open).toBe(true));
    expect([...dans(e, 'dialog').querySelectorAll('li')].map((li) => li.textContent)).toEqual(attendus);
    dans(e, 'dialog [data-commande="renoncer"]').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')).toBeNull());
    expect(imports(e)).toEqual([]);
    expect(ecritures(e)).toBe(avant);

    const prochain = charge.prochainsIds.participant;
    const entreesAvant = entrees(e);
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')?.open).toBe(true));
    dans(e, 'dialog [data-commande="confirmer"]').click();
    await vi.waitFor(() => expect(dans(e, '[data-rapport]')).not.toBeNull());
    expect(imports(e).length).toBe(1);
    expect(imports(e)[0][1].mode).toBe('remplacer');
    expect(entrees(e)).toBe(entreesAvant + 1);
    const { resume } = await e.espion.mock.results.at(-1).value;
    expect(resume).toMatchObject({ ajoutes: 2, misAJour: 0, inchanges: 0, retires: 4, reservationsRetirees: 2 });
    expect(comptesAffiches(e)).toEqual(comptesDu(resume));
    const apres = participantsDe(e);
    expect(apres.map(({ nom, organisation }) => [nom, organisation])).toEqual([['Tisserin', 'cooperative bleue'], ['Morillon', null]]);
    for (const { id } of apres) expect(id).toBeGreaterThanOrEqual(prochain);
  });
});

describe('remplacer annonce les logos qu’il retire (§ 10.1, § 8.9)', () => {
  // Deux chemins de logo de la forme du schéma, logo/<empreinte>.png, que
  // rien ne dépose : seul le lien compte ici.
  const LOGO_A = `logo/${'a1'.repeat(32)}.png`;
  const LOGO_B = `logo/${'b2'.repeat(32)}.png`;

  test('deux personnes à logo : la fenêtre dit « 2 logos seront retirés » après les quatre comptes ; l’avis d’après le geste reste', async () => {
    const e = await ouvrir({
      participants: [
        personne(1, 'Ombrelle', 'Iris', { logo: LOGO_A }),
        personne(2, 'Pervenche', 'Théo', { logo: LOGO_B }),
        personne(3, 'Lacasse', 'Ondine'),
      ],
    });
    await choisir(e, 'remplace.csv', enUtf8('nom;prenom\r\nTisserin;Basilie\r\n'));
    choisirMode(e, 'remplacer');
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')?.open).toBe(true));
    const elements = [...dans(e, 'dialog').querySelectorAll('li')].map((li) => li.textContent);
    expect(elements).toHaveLength(5);
    expect(elements.at(-1)).toBe(t('import.remplacer.logos', { n: 2 }));
    expect(elements.at(-1)).toBe('2 logos seront retirés');
    dans(e, 'dialog [data-commande="confirmer"]').click();
    await vi.waitFor(() => expect(dans(e, '[data-rapport]')).not.toBeNull());
    const { avertissements } = await e.espion.mock.results.at(-1).value;
    expect(avertissements).toContainEqual({ code: 'IMPORT_LOGOS_RETIRES', details: { logos: 2 } });
  });
});

describe('importer selon l’état (§ 10.1, § 9)', () => {
  const FICHIER = 'nom;prenom\r\nMorillon;Aurèle\r\n';

  test('brouillon et proposé sans avertissement ; retenu avec IMPORT_EN_RETENU dans le rendu de seance.executer', async () => {
    const preparations = [
      ['brouillon', null],
      ['propose', (seance, generation) => avecPropositions(seance, generation, 1)],
      [
        'retenu',
        async (seance, generation) => {
          await avecPropositions(seance, generation, 1);
          await seance.executer('retenirProposition', { id: seance.etat().charge.propositions[0].id });
        },
      ],
    ];
    for (const [etat, prepare] of preparations) {
      const e = await ouvrir({ participants: QUATRE(), siegesParDefaut: 3, prepare });
      expect(e.m.seance.etat().charge.evenement.etat).toBe(etat);
      await choisir(e, 'tardif.csv', enUtf8(FICHIER));
      const { rendu } = await importer(e);
      const codes = rendu.avertissements.map(({ code }) => code);
      if (etat === 'retenu') expect(codes, etat).toContain('IMPORT_EN_RETENU');
      else expect(codes, etat).not.toContain('IMPORT_EN_RETENU');
      expect(participantsDe(e).length, etat).toBe(5);
    }
  });

  test('bloqué : l’aperçu s’ouvre, l’import est refusé à côté de la commande, le message portant « Débloquer », rien d’écrit', async () => {
    const e = await ouvrir({
      participants: QUATRE(),
      prepare: (seance) => seance.executer('changerEtat', { etat: 'bloque' }),
    });
    const avant = ecritures(e);
    await choisir(e, 'tardif.csv', enUtf8(FICHIER));
    expect(vu(dans(e, '[data-apercu] h3'))).toBe(true);
    const { refus } = await importer(e);
    expect(refus.code).toBe('LECTURE_SEULE');
    const pose = dans(e, '[data-refus="LECTURE_SEULE"]');
    expect(commande(e, 'importer').parentElement.contains(pose)).toBe(true);
    expect(texteDe(pose)).toContain('Débloquer');
    expect(ecritures(e)).toBe(avant);
    expect(participantsDe(e).length).toBe(4);
  });

  test('en lecture : l’aperçu s’ouvre, l’import est refusé avec « Modifier », rien d’écrit', async () => {
    const e = await ouvrir({ ecriture: false });
    expect(e.m.seance.etat().mode).toBe('lecture');
    const avant = ecritures(e);
    await choisir(e, 'tardif.csv', enUtf8(FICHIER));
    expect(vu(dans(e, '[data-apercu] h3'))).toBe(true);
    const { refus } = await importer(e);
    expect(refus.code).toBe('MODE_LECTURE');
    const pose = dans(e, '[data-refus="MODE_LECTURE"]');
    expect(pose.querySelector('[data-commande="modifier"]').textContent).toBe(t('communs.remede.modifier'));
    expect(ecritures(e)).toBe(avant);
  });

  test('sous « Remplacer », bloqué puis en lecture : le refus à côté de la commande, avec son remède, aucune fenêtre, rien d’écrit', async () => {
    const cas = [
      ['LECTURE_SEULE', 'debloquer', { prepare: (seance) => seance.executer('changerEtat', { etat: 'bloque' }) }],
      ['MODE_LECTURE', 'modifier', { ecriture: false }],
    ];
    for (const [code, remede, options] of cas) {
      const e = await ouvrir({ participants: QUATRE(), ...options });
      expect(e.m.seance.etat().refus?.code, code).toBe(code);
      const avant = ecritures(e);
      await choisir(e, 'tardif.csv', enUtf8(FICHIER));
      choisirMode(e, 'remplacer');
      commande(e, 'importer').click();
      await vi.waitFor(() => expect(dans(e, `[data-refus="${code}"]`), code).not.toBeNull());
      const pose = dans(e, `[data-refus="${code}"]`);
      expect(commande(e, 'importer').parentElement.contains(pose), code).toBe(true);
      expect(pose.querySelector(`[data-commande="${remede}"]`)?.textContent, code).toBe(t(`communs.remede.${remede}`));
      expect(vu(pose), code).toBe(true);
      expect(dans(e, 'dialog'), code).toBeNull();
      expect(imports(e), code).toEqual([]);
      expect(ecritures(e), code).toBe(avant);
      expect(participantsDe(e).length, code).toBe(4);
    }
  });
});

describe('le collage en bloc passe par le même analyseur (§ 10.2, § 14.10)', () => {
  const TEXTE = [
    ['nom', 'prenom', 'organisation'],
    ['Ombrelle', 'Iris', '"Club\tdes ""Merles"""'],
    ['Pervenche', 'Benoît', 'Grisaille'],
  ].map((champs) => champs.join('\t')).join('\n');

  test('un texte à tabulations collé : un aperçu sans encodage ; l’import rend les mêmes participants, champ par champ, que le même texte servi en fichier', async () => {
    const collage = await ouvrir();
    await coller(collage, TEXTE);
    expect(dans(collage, '[data-encodage]')).toBeNull();
    expect(dans(collage, '[data-separateur]').textContent).toBe(t('import.separateur.tabulation'));
    await importer(collage);
    const fichier = await ouvrir();
    await choisir(fichier, 'colle.csv', enUtf8(TEXTE));
    await importer(fichier);
    expect(participantsDe(collage).length).toBe(2);
    expect(participantsDe(collage)[0].organisation).toBe('Club\tdes "Merles"');
    expect(participantsDe(collage)[1].prenom).toBe('Benoît');
    expect(participantsDe(collage)).toEqual(participantsDe(fichier));
  });

  test('sans sa ligne d’en-tête : AUCUN_ENTETE, puis « Lire les colonnes dans l’ordre de la grille » en fait nom, prénom et organisation', async () => {
    const e = await ouvrir();
    await coller(e, TEXTE.split('\n').slice(1).join('\n'));
    const pose = dans(e, '[data-refus="AUCUN_ENTETE"]');
    expect(pose.textContent).toContain(t('import.remede.aucunEnteteCollage'));
    commande(e, 'ordreDeLaGrille').click();
    await vi.waitFor(() => expect(dans(e, '[data-refus]')).toBeNull());
    expect(association(dans(e, '[data-apercu]')).map(([, devient]) => devient)).toEqual([
      t('import.champ.nom'), t('import.champ.prenom'), t('import.champ.organisation'),
    ]);
    expect(tous(e, '[data-apercu] [data-lignes] [data-ligne]').map((ligne) => ligne.dataset.ligne)).toEqual(['2', '3']);
    await importer(e);
    expect(participantsDe(e).map(({ nom, prenom }) => [nom, prenom])).toEqual([['Ombrelle', 'Iris'], ['Pervenche', 'Benoît']]);
  });

  test('une liste de noms d’une colonne : SEPARATEUR_INTROUVABLE, la même offre, chaque ligne entière en nom', async () => {
    const e = await ouvrir();
    await coller(e, 'Ombrelle\nLacasse, Ondine\nPervenche');
    const pose = dans(e, '[data-refus="SEPARATEUR_INTROUVABLE"]');
    expect(pose.textContent).toContain(tEcran('import.remede.separateurIntrouvableCollage'));
    commande(e, 'ordreDeLaGrille').click();
    await vi.waitFor(() => expect(dans(e, '[data-refus]')).toBeNull());
    expect(lignesMontrees(dans(e, '[data-apercu]')).map(([nom]) => nom)).toEqual(['Ombrelle', 'Lacasse, Ondine', 'Pervenche']);
  });
});

describe('les cas du § 10.3', () => {
  // Chacun des neuf cas, lu dans un conteneur : l'aperçu, puis le rapport.
  function neufCas(conteneur) {
    const colonnes = new Map(association(conteneur));
    expect(colonnes.get('Téléphone'), 'colonne non reconnue').toBe(tEcran('import.colonne.nonReconnue'));
    expect(cellule(conteneur, 6, 'organisation'), 'sans organisation').toBe('');
    expect(cellule(conteneur, 7, 'exclu'), 'exclusion').toBe(t('import.exclu.oui'));
    expect(cellule(conteneur, 8, 'notes'), 'champ cité avec le séparateur').toBe('végétarien; sans noix, ni arachides');
    expect(cellule(conteneur, 9, 'notes'), 'champ cité sur deux lignes').toMatch(/premier tour\r?\nrepart/);
    // Le doublon se lit d'un trait : la personne, puis ses lignes, jamais
    // « 210 » pour les lignes 2 et 10.
    const doublons = [...conteneur.querySelectorAll('[data-doublon]')].map(texteDe);
    expect(doublons, 'doublon').toEqual([enLigne(`Basile Lanterneau — ${tEcran('import.apercu.doublonLignes', { lignes: [2, 10] })}`)]);
    expect(cellule(conteneur, 11, 'prenom'), 'sans prénom').toBe('');
    const fusions = [...conteneur.querySelectorAll('[data-fusion] [data-orthographe] [data-texte]')].map((o) => o.textContent);
    expect(fusions, 'paire d’orthographes').toEqual(['Société des Hérons', 'Societe des herons']);
    expect(refusee(conteneur, 13), 'ligne refusée').not.toBeNull();
  }

  test('l’aperçu et le rapport des cas limites montrent chacun des neuf cas', async () => {
    const e = await ouvrir();
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    neufCas(dans(e, '[data-apercu]'));
    await importer(e);
    neufCas(dans(e, '[data-rapport]'));
  });

  test('la variante windows-1252 nomme windows-1252 et la virgule, et rend les mêmes participants', async () => {
    const parVariante = [];
    for (const [nom, url] of [['participants_cas_limites.csv', urlCasLimites], ['participants_cas_limites_cp1252.csv', urlCasLimites1252]]) {
      const e = await ouvrir();
      await choisir(e, nom, await lireLivre(url));
      parVariante.push({ encodage: dans(e, '[data-encodage]').textContent, separateur: dans(e, '[data-separateur]').textContent });
      await importer(e);
      parVariante.at(-1).participants = participantsDe(e);
    }
    expect(parVariante[1].encodage).toBe(t('import.encodage.windows1252'));
    expect(parVariante[1].separateur).toBe(t('import.separateur.virgule'));
    expect(parVariante[0].participants.length).toBe(13);
    expect(parVariante[1].participants).toEqual(parVariante[0].participants);
  });
});

describe('l’habillage : cartes et messages classés en refus, avis ou information', () => {
  const nomDe = (region) => texteDe(document.getElementById(region.getAttribute('aria-labelledby')));

  // La classe d'un message, lue dans son bloc : la pastille dont le texte
  // nomme la sorte, sa teinte et son signe.
  function exigerSorte(bloc, sorte, lieu) {
    expect(bloc, lieu).not.toBeNull();
    const libelle = t(`import.sorte.${sorte}`);
    const pastille = [...bloc.querySelectorAll('*')].find((e) => fondDe(e)[3] > 0 && texteDe(e) === libelle);
    expect(pastille, `${lieu} : pastille « ${libelle} »`).toBeDefined();
    expect(fondDe(pastille), lieu).toEqual(jeton(`--couleur-${sorte}-fond`));
    expect(pastille.querySelector('svg'), lieu).not.toBeNull();
    expect(composantes(getComputedStyle(pastille).color), lieu).toEqual(jeton('--couleur-page-texte'));
  }

  // Chaque bloc de messages d'un conteneur, et la sorte qu'il doit porter.
  function exigerBlocs(conteneur, lieu) {
    const bloc = (selecteur) => conteneur.querySelector(selecteur)?.closest('section') ?? null;
    exigerSorte(bloc('[data-refusees]'), 'refus', `${lieu}, lignes refusées`);
    exigerSorte(bloc('[data-doublons]'), 'avis', `${lieu}, doublons`);
    exigerSorte(bloc('[data-fusions]'), 'information', `${lieu}, orthographes fondues`);
    exigerSorte(bloc('[data-fusions-etiquettes]'), 'information', `${lieu}, étiquettes fondues`);
    expect(bloc('[data-fusions-etiquettes]'), lieu).not.toBe(bloc('[data-fusions]'));
  }

  test('les cas limites : refusées en refus, doublons en avis, fusions d’organisations et d’étiquettes en information, chacune son bloc, dans l’aperçu puis le rapport', async () => {
    const e = await ouvrir();
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    exigerBlocs(dans(e, '[data-apercu]'), 'aperçu');
    await importer(e);
    exigerBlocs(dans(e, '[data-rapport]'), 'rapport');
  });

  test('une mise à jour : homonymes et cellule sur deux lignes qui porte le séparateur en avis, dans l’aperçu puis le rapport', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Ombrelle', 'Iris')] });
    await choisir(e, 'homonymes.csv', enUtf8('nom;prenom;notes\r\nOmbrelle;Aurèle;\r\nPervenche;Théo;"végétarien;\r\nsans noix"\r\n'));
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    for (const lieu of ['aperçu', 'rapport']) {
      const conteneur = dans(e, lieu === 'aperçu' ? '[data-apercu]' : '[data-rapport]');
      exigerSorte(conteneur.querySelector('[data-homonyme="2"]')?.closest('section') ?? null, 'avis', `${lieu}, homonymes`);
      exigerSorte(conteneur.querySelector('[data-multiligne="3"]')?.closest('section') ?? null, 'avis', `${lieu}, cellules sur plusieurs lignes`);
      if (lieu === 'aperçu') await importer(e);
    }
  });

  // Un import n'écrit rien quand la charge ne change pas et qu'il refuse
  // des lignes : ici, une personne déjà là, et une ligne sans nom.
  test('un import qui n’a rien écrit le dit en information', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Ombrelle', 'Iris')] });
    await choisir(e, 'inchange.csv', enUtf8('nom;prenom\r\nOmbrelle;Iris\r\n;Théo\r\n'));
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    const { rendu } = await importer(e);
    expect(rendu.libelle).toBeNull();
    const rapport = dans(e, '[data-rapport]');
    const rien = [...rapport.querySelectorAll('section')].find((bloc) => texteDe(bloc).includes(t('import.rapport.rienEcrit'))) ?? null;
    exigerSorte(rien, 'information', 'rapport, rien d’écrit');
  });

  // Un import d'objectifs n'écrit rien quand chaque couple du fichier porte
  // déjà son objectif et qu'il refuse des lignes : ici, la table 1 porte
  // déjà « finance », et aucune table n'affiche le numéro 9.
  test('un import d’objectifs qui n’a rien écrit le dit en information, avec le texte des objectifs', async () => {
    const e = await ouvrir({ tables: [table(1, 1, [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }]), table(2, 2)] });
    choisirNature(e, 'objectifs');
    await choisir(e, 'inchange.csv', enUtf8('table;objectif\r\n1;finance\r\n9;finance\r\n'));
    const { rendu } = await importer(e, 'importerObjectifs');
    expect(rendu.libelle).toBeNull();
    const rapport = dans(e, '[data-rapport]');
    const rien = [...rapport.querySelectorAll('section')].find((bloc) => texteDe(bloc).includes(t('import.rapport.rienEcritObjectifs'))) ?? null;
    exigerSorte(rien, 'information', 'rapport des objectifs, rien d’écrit');
    expect(texteDe(rapport)).not.toContain(t('import.rapport.rienEcrit'));
  });

  test('un refus global porte la pastille du refus, sa cause et son remède', async () => {
    const e = await ouvrir();
    await coller(e, 'Ombrelle\tIris\nPervenche\tThéo');
    const pose = dans(e, '[data-apercu] [data-refus="AUCUN_ENTETE"]');
    exigerSorte(pose, 'refus', 'refus global');
    expect(pose.textContent).toContain(t('import.remede.aucunEnteteCollage'));
  });

  test('la section, l’aperçu et le rapport sont des cartes titrées ; « Choisir un fichier » est l’action principale de la section', async () => {
    const e = await ouvrir();
    const regions = () => tous(e, 'section[aria-labelledby]').map(nomDe);
    expect(regions()).toEqual([t('coquille.section.import')]);
    const choisirUn = commande(e, 'choisirFichier');
    expect(fondDe(choisirUn)).toEqual(jeton('--couleur-action-fond'));
    await choisir(e, 'participants_cas_limites.csv', await lireLivre(urlCasLimites));
    expect(regions().slice(0, 2)).toEqual([t('coquille.section.import'), t('import.apercu.titre')]);
    await importer(e);
    expect(regions()).toContain(t('import.rapport.titre'));
    expect(regions()).not.toContain(t('import.apercu.titre'));
  });
});

// --- La nature du fichier, les objectifs de table, les étiquettes (§ 10.1, § 10.4) ---

// Une table de la charge d'épreuve, ses objectifs donnés.
const table = (id, numero, objectifs = null) => ({
  id, numero, sieges: null, forme: 'ronde', position: { x: 0, y: 0 }, ...(objectifs === null ? {} : { objectifs }),
});
// Neuf tables numérotées 1, 2, 3, 3, puis 4 à 8 : deux portent le numéro 3.
const NEUF_TABLES = () => [1, 2, 3, 3, 4, 5, 6, 7, 8].map((numero, rang) => table(rang + 1, numero));

// Le CSV des objectifs qui refuse une ligne pour chaque motif du § 10.4,
// dans l'ordre du texte ; huit lignes valides précèdent le champ en trop,
// que l'analyse du séparateur ne lit qu'au-delà de ses vingt premiers
// enregistrements.
const VINGT_ET_UNE = Array.from({ length: 21 }, (_, rang) => `mot${rang + 1}`).join('|');
const TEXTE_DES_MOTIFS = [
  'table;tour;objectif;regle',
  '1;;finance;',
  ';;finance;',
  'un;;finance;',
  '9;;finance;',
  '3;;finance;',
  '2;2.0;finance;',
  '2;5;finance;',
  '2;1;;ou',
  `2;1;${'x'.repeat(41)};`,
  `2;1;${VINGT_ET_UNE};`,
  '2;1;finance;peut-être',
  '1;;Finance;et',
  '2;2;FINANCE;toutes',
  '4;;bénévole;ou',
  '4;1;bénévole;',
  '4;2;bénévole;',
  '5;;bénévole;',
  '5;1;bénévole;',
  '5;2;bénévole;',
  '6;;bénévole;',
  '6;1;bénévole;une',
  '1;1;finance;;en trop',
  '',
].join('\r\n');
const MOTIFS_DU_10_4 = [
  'TABLE_ABSENTE', 'TABLE_NON_ENTIERE', 'NUMERO_TABLE_INCONNU', 'PLUSIEURS_TABLES', 'TOUR_NON_ENTIER', 'TOUR_HORS_SOIREE',
  'OBJECTIF_VIDE', 'ETIQUETTE_MAL_FORMEE', 'ETIQUETTES_TROP_NOMBREUSES', 'REGLE_INCONNUE', 'OBJECTIF_EN_DOUBLE', 'CHAMPS_EN_TROP',
];

// Coche une nature du fichier.
function choisirNature(e, nature) {
  dans(e, `[data-nature-import] input[value="${nature}"]`).click();
  flushSync();
}
const natureCochee = (e) => dans(e, '[data-nature-import] input:checked')?.value ?? null;

// Les étiquettes montrées en pastilles dans une cellule de l'aperçu.
const pastilles = (conteneur, ligne, champ) =>
  [...conteneur.querySelectorAll(`[data-lignes] [data-ligne="${ligne}"] [data-cellule="${champ}"] li`)].map(texteDe);

// Un premier geste, sans effet sur les objectifs ni sur les tables : le
// journal existe avant l'import, dont l'entrée se compte seule.
const premierGeste = (seance) => seance.executer('changerRegleObjectifs', { regle: 'et' });

// Les comptes du rapport d'un import d'objectifs, affichés puis attendus.
const COMPTES_DES_OBJECTIFS = [
  ['ajoutes', 'import.rapport.objectifsAjoutes'],
  ['remplaces', 'import.rapport.objectifsRemplaces'],
  ['inchanges', 'import.rapport.objectifsInchanges'],
  ['retires', 'import.rapport.objectifsRetires'],
  ['tables', 'import.rapport.tablesTouchees'],
];
const comptesObjectifsAffiches = (e) =>
  COMPTES_DES_OBJECTIFS.map(([nom]) => {
    const compte = dans(e, `[data-rapport] [data-compte="${nom}"]`);
    return [nom, compte.querySelector('[data-nombre]').textContent, compte.querySelector('[data-nombre] + span').textContent];
  });
const comptesObjectifsDu = (resume) =>
  COMPTES_DES_OBJECTIFS.map(([nom, cle]) => [nom, format.nombre(resume[nom]), t(cle, { n: resume[nom] })]);

describe('la nature du fichier : choisie avant l’aperçu, jamais devinée (§ 10.4)', () => {
  test('Participants est cochée par défaut, avant tout fichier ; le CSV des objectifs livré, lu sous Participants, est refusé sans commande d’import ; coché Objectifs, le même texte se lit en objectifs', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    expect(dans(e, '[data-apercu]')).toBeNull();
    const choix = dans(e, '[data-nature-import]');
    expect(vu(choix)).toBe(true);
    expect(natureCochee(e)).toBe('participants');
    expect([...choix.querySelectorAll('label')].map(texteDe)).toEqual([t('import.nature.participants'), t('import.nature.objectifs')]);
    expect(texteDe(choix.querySelector('legend'))).toBe(t('import.nature.titre'));

    const octets = await lireLivre(urlObjectifs);
    await choisir(e, 'objectifs_cas_limites.csv', octets);
    expect(natureCochee(e)).toBe('participants');
    expect(dans(e, '[data-apercu] [data-refus="AUCUN_ENTETE"]')).not.toBeNull();
    expect(commande(e, 'importer')).toBeNull();
    expect(tous(e, '[data-apercu] [data-champ="mode"]')).toEqual([]);

    choisirNature(e, 'objectifs');
    expect(natureCochee(e)).toBe('objectifs');
    expect(dans(e, '[data-apercu] [data-fichier]').textContent).toBe('objectifs_cas_limites.csv');
    expect(dans(e, '[data-apercu] [data-refus]')).toBeNull();
    const apercu = apercevoirObjectifs(decoder(octets).texte, e.m.seance.etat().charge);
    expect(association(dans(e, '[data-apercu]'))).toEqual([
      ['Table', t('import.champ.table')],
      ['Tour', t('import.champ.tour')],
      ['Objectif', t('import.champ.objectif')],
      ['Règle', t('import.champ.regle')],
    ]);
    expect(tous(e, '[data-apercu] [data-lignes] [data-ligne]').map((ligne) => Number(ligne.dataset.ligne))).toEqual(
      apercu.lignes.map(({ ligne }) => ligne),
    );
    expect(tous(e, '[data-apercu] [data-refusees] [data-ligne]').map((ligne) => Number(ligne.dataset.ligne))).toEqual(
      apercu.refusees.map(({ ligne }) => ligne),
    );
    expect([...dans(e, '[data-champ="mode"]').querySelectorAll('input')].map((input) => input.value)).toEqual(['mettreAJour', 'remplacer']);
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    expect(commande(e, 'importer')).not.toBeNull();
  });

  test('une liste de participants qui porte une colonne « Table », lue sous Participants : la table ignorée, des personnes ; sous Objectifs, refusée faute d’objectif', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    await choisir(e, 'invites.csv', enUtf8('nom;prenom;table\r\nOmbrelle;Iris;2\r\nPervenche;Théo;1\r\n'));
    expect(association(dans(e, '[data-apercu]')).at(-1)).toEqual(['table', tEcran('import.colonne.nonReconnue')]);
    expect(lignesMontrees(dans(e, '[data-apercu]')).map(([nom]) => nom)).toEqual(['Ombrelle', 'Pervenche']);
    choisirNature(e, 'objectifs');
    expect(dans(e, '[data-apercu] [data-refus="OBJECTIF_NON_ASSOCIE"]')).not.toBeNull();
    expect(texteDe(dans(e, '[data-apercu] [data-refus]'))).toContain(t('import.remede.objectifNonAssocie'));
    expect(commande(e, 'importer')).toBeNull();
    choisirNature(e, 'participants');
    expect(dans(e, '[data-apercu] [data-refus]')).toBeNull();
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('ajouter');
  });

  test('au clavier : la flèche passe de Participants à Objectifs de table, l’aperçu ouvert se relit, et le bouton qui a le focus porte l’anneau de l’application', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    await choisir(e, 'objectifs_cas_limites.csv', await lireLivre(urlObjectifs));
    dans(e, '[data-nature-import] input[value="participants"]').focus();
    await touche('ArrowDown');
    await vi.waitFor(() => expect(natureCochee(e)).toBe('objectifs'));
    const actif = document.activeElement;
    expect(actif.value).toBe('objectifs');
    expect(actif.matches(':focus-visible')).toBe(true);
    const style = getComputedStyle(actif);
    expect(style.outlineStyle).toBe('solid');
    const sonde = document.createElement('span');
    sonde.style.color = 'var(--couleur-focus)';
    document.body.append(sonde);
    expect(style.outlineColor).toBe(getComputedStyle(sonde).color);
    sonde.remove();
    await vi.waitFor(() => expect(dans(e, '[data-apercu] [data-refus]')).toBeNull());
    expect(commande(e, 'importer')).not.toBeNull();
  });

  test('un collage de la grille coche Participants, quelle que soit la nature cochée', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    choisirNature(e, 'objectifs');
    await coller(e, 'nom\tprenom\nOmbrelle\tIris\n');
    expect(natureCochee(e)).toBe('participants');
    expect(lignesMontrees(dans(e, '[data-apercu]')).map(([nom]) => nom)).toEqual(['Ombrelle']);
  });
});

describe('l’aperçu des objectifs de table (§ 10.4)', () => {
  test('un refus de chaque motif du § 10.4 rendu dans l’aperçu, à son rang, son motif celui de t ; les lignes valides montrent numéro, tour, étiquettes en pastilles et règle', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    choisirNature(e, 'objectifs');
    await choisir(e, 'motifs.csv', enUtf8(TEXTE_DES_MOTIFS));
    const apercu = apercevoirObjectifs(TEXTE_DES_MOTIFS, e.m.seance.etat().charge);
    expect(apercu.refusees.map(({ code }) => code)).toEqual(MOTIFS_DU_10_4);
    const ici = dans(e, '[data-apercu]');
    for (const { code, brut, ...details } of apercu.refusees) {
      const ligne = refusee(ici, details.ligne);
      expect(ligne, code).not.toBeNull();
      expect(vu(ligne), code).toBe(true);
      expect(ligne.querySelector('[data-motif]').textContent, code).toBe(tEcran(code, details));
    }
    const [{ retenue }] = apercu.fusionsEtiquettes;
    expect(lignesMontrees(ici)[0]).toEqual(['1', t('import.tour.soiree'), retenue, t('import.regle.defaut')]);
    expect(cellule(ici, 14, 'tour')).toBe('2');
    expect(pastilles(ici, 14, 'objectif')).toEqual([retenue]);
    expect(cellule(ici, 14, 'regle')).toBe(t('import.regle.et'));
    expect(cellule(ici, 15, 'regle')).toBe(t('import.regle.ou'));
    expect(texteDe(dans(e, '[data-apercu] [data-valides]'))).toContain(format.nombre(apercu.lignes.length));
  });

  test('« finance » et « FINANCE » fondus en une orthographe : le bloc des étiquettes fondues, en information, nomme la retenue, les orthographes et les lignes réécrites ; aucun bloc d’organisations', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    choisirNature(e, 'objectifs');
    await choisir(e, 'motifs.csv', enUtf8(TEXTE_DES_MOTIFS));
    const [fusion] = apercevoirObjectifs(TEXTE_DES_MOTIFS, e.m.seance.etat().charge).fusionsEtiquettes;
    const bloc = dans(e, '[data-apercu] [data-fusions-etiquettes]');
    expect(vu(bloc)).toBe(true);
    expect(bloc.querySelector('[data-affichee]').textContent).toBe(fusion.retenue);
    expect([...bloc.querySelectorAll('[data-orthographe] [data-texte]')].map((o) => o.textContent)).toEqual(fusion.orthographes);
    expect(bloc.querySelector(':scope > li > [data-nombre]').textContent).toBe(format.nombre(fusion.lignes));
    expect(texteDe(bloc.closest('section'))).toContain(t('import.apercu.fusionsEtiquettes'));
    expect(texteDe(bloc.closest('section'))).toContain(t('import.sorte.information'));
    expect(dans(e, '[data-apercu] [data-fusions]')).toBeNull();
  });

  test('un événement sans table : OBJECTIFS_SANS_TABLE, et son remède ouvre la section des tables', async () => {
    const e = await ouvrir();
    choisirNature(e, 'objectifs');
    await choisir(e, 'objectifs_cas_limites.csv', await lireLivre(urlObjectifs));
    const pose = dans(e, '[data-apercu] [data-refus="OBJECTIFS_SANS_TABLE"]');
    expect(vu(pose)).toBe(true);
    expect(texteDe(pose)).toContain(t('OBJECTIFS_SANS_TABLE'));
    const remede = pose.querySelector('[data-commande="ouvrirSection"]');
    expect(remede.textContent.trim()).toBe(t('communs.remede.ouvrirSection.tables'));
    expect(commande(e, 'importer')).toBeNull();
    remede.click();
    await vi.waitFor(() => expect(e.m.ui.etat().section).toBe('tables'));
  });

  test('chaque refus global propre aux objectifs : sa cause et son remède, aucune commande d’import, rien d’écrit', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    choisirNature(e, 'objectifs');
    const avant = ecritures(e);
    const cas = [
      ['AUCUN_ENTETE', 'a;b\r\n1;finance\r\n', 'import.remede.aucunEnteteObjectifs'],
      ['TABLE_NON_ASSOCIEE', 'tour;objectif\r\n1;finance\r\n', 'import.remede.tableNonAssociee'],
      ['OBJECTIF_NON_ASSOCIE', 'table;tour\r\n1;1\r\n', 'import.remede.objectifNonAssocie'],
      ['AUCUNE_LIGNE_VALIDE', 'table;objectif\r\n9;finance\r\n', 'import.remede.aucuneLigneValide'],
    ];
    for (const [code, texte, remede] of cas) {
      await choisir(e, `${code}.csv`, enUtf8(texte));
      const pose = dans(e, `[data-apercu] [data-refus="${code}"]`);
      expect(pose, code).not.toBeNull();
      expect(texteDe(pose), code).toContain(t(remede));
      expect(commande(e, 'importer'), code).toBeNull();
      expect(natureCochee(e), code).toBe('objectifs');
    }
    expect(ecritures(e)).toBe(avant);
  });
});

describe('importer des objectifs de table (§ 10.4)', () => {
  test('mettre à jour : une entrée, importerObjectifs sous l’aperçu montré ; le rapport porte les comptes du résumé et le bloc des étiquettes fondues ; le CSV des refus est celui d’exporterRefus', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES(), prepare: premierGeste });
    choisirNature(e, 'objectifs');
    await choisir(e, 'motifs.csv', enUtf8(TEXTE_DES_MOTIFS));
    const apercu = apercevoirObjectifs(TEXTE_DES_MOTIFS, e.m.seance.etat().charge);
    commande(e, 'enregistrerRefus').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    expect(e.enregistres[0].nomPropose).toBe(`${BASE}-refus.csv`);
    expect([...e.enregistres[0].octets]).toEqual([...exporterRefusCsv(apercu, libelle)]);

    const entreesAvant = entrees(e);
    const { rendu } = await importer(e, 'importerObjectifs');
    expect(imports(e)).toEqual([]);
    const [[, argumentsRecus]] = imports(e, 'importerObjectifs');
    expect(argumentsRecus.mode).toBe('mettreAJour');
    expect(argumentsRecus.apercu).toEqual(apercu);
    expect(entrees(e)).toBe(entreesAvant + 1);
    expect(rendu.resume).toMatchObject({ ajoutes: 10, remplaces: 0, inchanges: 0, retires: 0 });
    expect(comptesObjectifsAffiches(e)).toEqual(comptesObjectifsDu(rendu.resume));
    const rapport = dans(e, '[data-rapport]');
    expect(vu(rapport.querySelector('h3'))).toBe(true);
    expect(rapport.querySelector('[data-fusions-etiquettes]')).not.toBeNull();
    expect(rapport.querySelectorAll('[data-refusees] [data-ligne]').length).toBe(MOTIFS_DU_10_4.length);
    const tables = e.m.seance.etat().charge.tables;
    const [{ retenue }] = apercu.fusionsEtiquettes;
    expect(tables.find(({ id }) => id === 1).objectifs).toEqual([{ portee: 'tous', tour: null, regle: null, etiquettes: [retenue] }]);

    // L'avis de A20 : l'événement n'a aucun participant, donc aucun des dix
    // objectifs écrits n'a de correspondant. La commande le rend, la séance
    // le relaie, la liste des avertissements de l'événement le montre.
    expect(rendu.avertissements.map(({ code }) => code)).toEqual(Array(10).fill('OBJECTIF_SANS_CORRESPONDANT'));
    const montres = [...e.m.racine.querySelectorAll('[data-avertissement="OBJECTIF_SANS_CORRESPONDANT"]')];
    expect(montres.map((avis) => texteDe(avis.querySelector('p')))).toEqual(rendu.avertissements.map(({ code, details }) => t(code, details)));
    expect(vu(montres[0])).toBe(true);
  });

  test('remplacer annonce ses deux comptes, objectifs et tables ; Annuler n’écrit rien ; Confirmer, une entrée, et les objectifs que le fichier ne nomme pas partent', async () => {
    const soiree = (etiquettes) => ({ portee: 'tous', tour: null, regle: null, etiquettes });
    const tables = [
      table(1, 1, [soiree(['bénévole']), { portee: 'tour', tour: 2, regle: 'et', etiquettes: ['Montréal', 'finance'] }]),
      table(2, 2, [soiree(['ressources humaines'])]),
      table(3, 3),
    ];
    const e = await ouvrir({ tables, prepare: premierGeste });
    choisirNature(e, 'objectifs');
    await choisir(e, 'remplace.csv', enUtf8('table;objectif\r\n3;finance\r\n'));
    choisirMode(e, 'remplacer');
    const bilan = bilanRemplacementObjectifs(e.m.seance.etat().charge);
    expect(bilan).toEqual({ objectifs: 3, tables: 2 });
    const attendus = [t('import.remplacer.objectifs', { n: 3 }), t('import.remplacer.tables', { n: 2 })];
    expect(attendus).toEqual(['3 objectifs de table seront supprimés', '2 tables perdront leurs objectifs']);
    const avant = ecritures(e);
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')?.open).toBe(true));
    expect(texteDe(dans(e, 'dialog'))).toContain(t('import.remplacer.titreObjectifs'));
    expect([...dans(e, 'dialog').querySelectorAll('li')].map((li) => li.textContent)).toEqual(attendus);
    dans(e, 'dialog [data-commande="renoncer"]').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')).toBeNull());
    expect(imports(e, 'importerObjectifs')).toEqual([]);
    expect(ecritures(e)).toBe(avant);

    const entreesAvant = entrees(e);
    commande(e, 'importer').click();
    await vi.waitFor(() => expect(dans(e, 'dialog')?.open).toBe(true));
    dans(e, 'dialog [data-commande="confirmer"]').click();
    await vi.waitFor(() => expect(dans(e, '[data-rapport]')).not.toBeNull());
    expect(imports(e, 'importerObjectifs').map(([, { mode }]) => mode)).toEqual(['remplacer']);
    expect(entrees(e)).toBe(entreesAvant + 1);
    const { resume } = await e.espion.mock.results.at(-1).value;
    expect(resume).toMatchObject({ ajoutes: 1, remplaces: 0, inchanges: 0, retires: 3, tables: 3 });
    expect(comptesObjectifsAffiches(e)).toEqual(comptesObjectifsDu(resume));
    expect(e.m.seance.etat().charge.tables.map(({ objectifs = [] }) => objectifs.length)).toEqual([0, 0, 1]);
  });

  test('bloqué : l’aperçu des objectifs s’ouvre, l’import est refusé à côté de la commande, rien d’écrit', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES(), prepare: (seance) => seance.executer('changerEtat', { etat: 'bloque' }) });
    choisirNature(e, 'objectifs');
    const avant = ecritures(e);
    await choisir(e, 'objectifs_cas_limites.csv', await lireLivre(urlObjectifs));
    const { refus } = await importer(e, 'importerObjectifs');
    expect(refus.code).toBe('LECTURE_SEULE');
    expect(commande(e, 'importer').parentElement.contains(dans(e, '[data-refus="LECTURE_SEULE"]'))).toBe(true);
    expect(ecritures(e)).toBe(avant);
  });
});

describe('l’icône des pastilles de l’aperçu (§ 10.1, § 10.4)', () => {
  // Les tracés de l'icône d'une pastille de cellule, ceux de traceIcone.
  const tracesDe = (li) => [...li.querySelectorAll('svg path')].map((trace) => trace.getAttribute('d'));
  const pastillesDe = (e, ligne, champ) => tous(e, `[data-lignes] [data-ligne="${ligne}"] [data-cellule="${champ}"] li`);

  test('étiquette et objectif à l’icône des étiquettes, conflit seul à « interdit »', async () => {
    const e = await ouvrir({ participants: [personne(1, 'Houle', null, { organisation: 'Club des Merles' })] });
    await choisir(e, 'conflits.csv', enUtf8('nom;organisation;etiquettes;conflit organisation\r\nOmbrelle;Atelier Ressac;finance;club des merles\r\n'));
    const [etiquette] = pastillesDe(e, 2, 'etiquettes');
    const [conflit] = pastillesDe(e, 2, 'conflit_organisation');
    expect(texteDe(etiquette)).toBe('finance');
    expect(texteDe(conflit)).toBe('Club des Merles');
    expect(tracesDe(etiquette)).toEqual(traceIcone('etiquettes'));
    expect(tracesDe(conflit)).toEqual(traceIcone('interdit'));

    const objectifs = await ouvrir({ tables: NEUF_TABLES() });
    choisirNature(objectifs, 'objectifs');
    await choisir(objectifs, 'objectifs.csv', enUtf8('table;objectif\r\n1;finance|bénévole\r\n'));
    const portes = pastillesDe(objectifs, 2, 'objectif');
    expect(portes.map(texteDe)).toEqual(['finance', 'bénévole']);
    for (const li of portes) expect(tracesDe(li), texteDe(li)).toEqual(traceIcone('etiquettes'));
    expect(traceIcone('etiquettes')).not.toEqual(traceIcone('interdit'));
  });
});

describe('les étiquettes des participants dans l’aperçu (§ 10.1, A17)', () => {
  test('les cas limites : chaque cellule d’étiquettes en pastilles, sous l’orthographe retenue ; le bloc des étiquettes fondues présent, à part des organisations, dans l’aperçu puis le rapport', async () => {
    const e = await ouvrir();
    const octets = await lireLivre(urlCasLimites);
    await choisir(e, 'participants_cas_limites.csv', octets);
    const apercu = apercevoir(decoder(octets).texte);
    expect(apercu.fusionsEtiquettes.length).toBeGreaterThanOrEqual(1);
    const ici = dans(e, '[data-apercu]');
    for (const { ligne, champs } of apercu.lignes) expect(pastilles(ici, ligne, 'etiquettes'), `ligne ${ligne}`).toEqual(champs.etiquettes ?? []);
    expect(apercu.lignes.some(({ champs }) => (champs.etiquettes ?? []).length > 1)).toBe(true);
    // Chaque étiquette, la pastille de la fiche : neutre, à icône, de
    // l'encre de la page ; son fond se détache de celui de la cellule.
    const elements = [...ici.querySelectorAll('[data-cellule="etiquettes"] li')];
    expect(elements.length).toBeGreaterThan(1);
    for (const li of elements) {
      const pastille = [li, ...li.querySelectorAll('*')].find((element) => fondDe(element)[3] > 0);
      expect(fondDe(pastille), texteDe(li)).toEqual(jeton('--couleur-neutre-fond'));
      expect(li.querySelector('svg'), texteDe(li)).not.toBeNull();
      expect(composantes(getComputedStyle(pastille).color), texteDe(li)).toEqual(jeton('--couleur-page-texte'));
    }
    expect(vu(elements[0])).toBe(true);
    expect(fondDe(elements[0].closest('td'))).not.toEqual(jeton('--couleur-neutre-fond'));

    for (const lieu of ['[data-apercu]', '[data-rapport]']) {
      if (lieu === '[data-rapport]') await importer(e);
      const conteneur = dans(e, lieu);
      const bloc = conteneur.querySelector('[data-fusions-etiquettes]');
      expect(bloc, lieu).not.toBeNull();
      expect([...bloc.querySelectorAll('[data-affichee]')].map((a) => a.textContent), lieu).toEqual(
        apercu.fusionsEtiquettes.map(({ retenue }) => retenue),
      );
      const organisations = conteneur.querySelector('[data-fusions]');
      expect(organisations.contains(bloc), lieu).toBe(false);
      expect(bloc.contains(organisations), lieu).toBe(false);
      const retenues = new Set(apercu.fusionsEtiquettes.map(({ retenue }) => retenue));
      for (const affichee of organisations.querySelectorAll('[data-affichee]')) expect(retenues.has(affichee.textContent), lieu).toBe(false);
      expect(organisations.querySelectorAll('[data-fusion]').length, lieu).toBe(apercu.fusions.length);
    }
  });
});

describe('le modèle à télécharger, de la nature cochée (§ 10.1, § 10.4)', () => {
  // Le chemin annoncé après l'enregistrement du modèle, quand il paraît.
  const noteDuModele = (e) => dans(e, '[data-modele-enregistre]');

  test('« Télécharger un modèle » remet à « Enregistrer sous… » le modèle de la nature cochée, sous son nom ; le chemin s’annonce ; rien ne s’écrit', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    const avant = ecritures(e);
    const bouton = commande(e, 'telechargerModele');
    expect(bouton.textContent.trim()).toBe(t('import.commande.telechargerModele'));
    expect(bouton.getAttribute('aria-label')).toBe(t('import.modele.participants'));
    expect(noteDuModele(e)).toBeNull();
    bouton.click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    expect(e.enregistres[0].nomPropose).toBe('modele-participants.csv');
    expect([...e.enregistres[0].octets]).toEqual([...modeleParticipants({ tours: 2 })]);
    await vi.waitFor(() => expect(noteDuModele(e)).not.toBeNull());
    expect(noteDuModele(e).getAttribute('role')).toBe('status');
    expect(texteDe(noteDuModele(e))).toBe(`${t('import.modele.enregistre')} modele-participants.csv`);

    choisirNature(e, 'objectifs');
    expect(noteDuModele(e)).toBeNull();
    const objectifs = commande(e, 'telechargerModele');
    expect(objectifs.getAttribute('aria-label')).toBe(t('import.modele.objectifs'));
    objectifs.click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(2));
    const { charge } = e.m.seance.etat();
    expect(e.enregistres[1].nomPropose).toBe(`${BASE}-modele-objectifs.csv`);
    expect([...e.enregistres[1].octets]).toEqual([...modeleObjectifs(charge.tables, charge.evenement.tours)]);
    await vi.waitFor(() => expect(texteDe(noteDuModele(e))).toBe(`${t('import.modele.enregistre')} ${BASE}-modele-objectifs.csv`));
    expect(dans(e, '[data-apercu]')).toBeNull();
    expect(e.espion).not.toHaveBeenCalled();
    expect(ecritures(e)).toBe(avant);
  });

  test('en lecture aussi : le modèle s’enregistre, le mode reste la lecture', async () => {
    const e = await ouvrir({ ecriture: false, tables: NEUF_TABLES() });
    expect(e.m.seance.etat().mode).toBe('lecture');
    choisirNature(e, 'objectifs');
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    expect(e.enregistres[0].nomPropose).toBe(`${BASE}-modele-objectifs.csv`);
    expect(e.m.seance.etat().mode).toBe('lecture');
  });

  test('un enregistrement annulé n’annonce rien, et retire la note du précédent', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(noteDuModele(e)).not.toBeNull());
    let annules = 0;
    e.m.fs.enregistrerSous = async () => {
      annules += 1;
      return null;
    };
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(annules).toBe(1));
    await vi.waitFor(() => expect(noteDuModele(e)).toBeNull());
    expect(texteDe(section(e))).not.toContain('null');
  });

  test('le modèle des objectifs, rechoisi tel quel, deux tables du même numéro comprises : un aperçu sans refus, et l’import n’en refuse aucune ligne', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    choisirNature(e, 'objectifs');
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    await choisir(e, e.enregistres[0].nomPropose, e.enregistres[0].octets);
    expect(dans(e, '[data-apercu] [data-refus]')).toBeNull();
    const { rendu } = await importer(e, 'importerObjectifs');
    expect(rendu.resume).toMatchObject({ ajoutes: 2, remplaces: 0, retires: 0, refusees: [] });
  });

  test('sans table, le modèle des objectifs est refusé à côté de la commande, et son remède ouvre la section des tables', async () => {
    const e = await ouvrir();
    choisirNature(e, 'objectifs');
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(dans(e, '[data-refus="OBJECTIFS_SANS_TABLE"]')).not.toBeNull());
    expect(e.enregistres).toEqual([]);
    const remede = dans(e, '[data-refus="OBJECTIFS_SANS_TABLE"] [data-commande="ouvrirSection"]');
    expect(remede.textContent.trim()).toBe(t('communs.remede.ouvrirSection.tables'));
    choisirNature(e, 'participants');
    expect(dans(e, '[data-refus="OBJECTIFS_SANS_TABLE"]')).toBeNull();
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    expect(e.enregistres[0].nomPropose).toBe('modele-participants.csv');
  });

  test('chaque numéro de table partagé : le modèle des objectifs est refusé à côté de la commande, remède vers la section des tables', async () => {
    const e = await ouvrir({ tables: [table(1, 4), table(2, 4)] });
    choisirNature(e, 'objectifs');
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(dans(e, '[data-refus="OBJECTIFS_NUMEROS_PARTAGES"]')).not.toBeNull());
    expect(texteDe(dans(e, '[data-refus="OBJECTIFS_NUMEROS_PARTAGES"]'))).toContain(t('OBJECTIFS_NUMEROS_PARTAGES'));
    expect(e.enregistres).toEqual([]);
    const remede = dans(e, '[data-refus="OBJECTIFS_NUMEROS_PARTAGES"] [data-commande="ouvrirSection"]');
    expect(remede.textContent.trim()).toBe(t('communs.remede.ouvrirSection.tables'));
  });
});

describe("le guide de l'import, replié sous le modèle (§ 10.1, § 10.4)", () => {
  // Le bouton du guide, son contenu ouvert, et la ligne d'un champ.
  const bouton = (e) => commande(e, 'guideImport');
  const contenu = (e) => dans(e, '[data-guide-import]');
  const ligneDuGuide = (e, champ) => dans(e, `[data-guide-import] [data-guide-colonne="${champ}"]`);
  // Les cellules d'une ligne, après son en-tête : obligatoire, texte,
  // synonymes.
  const celluleDuGuide = (e, champ, rang) => ligneDuGuide(e, champ).querySelectorAll('td')[rang];
  const texteDuGuide = (e, champ) => celluleDuGuide(e, champ, 1);
  // Chaque ligne du tableau : son en-tête, puis ses synonymes, tels que
  // l'écran les écrit en code.
  const lignesDuGuide = (e) =>
    tous(e, '[data-guide-import] [data-guide-colonne]').map((ligne) => [
      ligne.dataset.guideColonne,
      [...ligne.querySelectorAll('code')].map((code) => code.textContent),
    ]);
  // Celles qu'attend une table d'en-têtes de src/csv : une graphie par
  // apostrophe, la première.
  const droite = (texte) => texte.replaceAll('\u{2019}', "'");
  const attendues = (table) =>
    table.map(([champ, entetes]) => [
      champ,
      entetes.filter((entete, rang) => !entetes.slice(0, rang).some((avant) => droite(avant) === droite(entete))),
    ]);

  test('fermé à l’ouverture de la section, dernier de la carte de l’import : « Guide import », aria-expanded faux, aucun contenu', async () => {
    const e = await ouvrir();
    const guide = bouton(e);
    expect(guide.localName).toBe('button');
    expect(guide.getAttribute('type')).toBe('button');
    expect(guide).toHaveAccessibleName(tEcran('import.guide.titre'));
    expect(texteDe(guide)).toBe(tEcran('import.guide.titre'));
    expect(guide.getAttribute('aria-expanded')).toBe('false');
    expect(guide.hasAttribute('aria-controls')).toBe(false);
    expect(contenu(e)).toBeNull();
    expect(vu(guide)).toBe(true);
    const modele = commande(e, 'telechargerModele');
    expect(modele.compareDocumentPosition(guide) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(dans(e, '[data-apercu]')).toBeNull();
  });

  test('au clavier : Entrée l’ouvre, aria-controls désigne le contenu, Espace le ferme ; le bouton qui a le focus porte l’anneau de l’application', async () => {
    const e = await ouvrir();
    const guide = bouton(e);
    guide.focus();
    await touche('Enter');
    await vi.waitFor(() => expect(guide.getAttribute('aria-expanded')).toBe('true'));
    expect(contenu(e)).not.toBeNull();
    expect(guide.getAttribute('aria-controls')).toBe(contenu(e).id);
    expect(document.getElementById(guide.getAttribute('aria-controls'))).toBe(contenu(e));
    expect(vu(contenu(e).querySelector('li'))).toBe(true);
    expect(document.activeElement).toBe(guide);
    expect(guide.matches(':focus-visible')).toBe(true);
    const style = getComputedStyle(guide);
    expect(style.outlineStyle).toBe('solid');
    const sonde = document.createElement('span');
    sonde.style.color = 'var(--couleur-focus)';
    document.body.append(sonde);
    expect(style.outlineColor).toBe(getComputedStyle(sonde).color);
    sonde.remove();

    await touche(' ');
    await vi.waitFor(() => expect(guide.getAttribute('aria-expanded')).toBe('false'));
    expect(guide.hasAttribute('aria-controls')).toBe(false);
    expect(contenu(e)).toBeNull();
    expect(document.activeElement).toBe(guide);
    expect(e.espion).not.toHaveBeenCalled();
  });

  test('ouvert sous Participants : les consignes, puis une ligne par colonne reconnue, dans l’ordre de la table, ses synonymes ceux de la table, « nom » seul obligatoire', async () => {
    const e = await ouvrir();
    bouton(e).click();
    flushSync();
    expect(texteDe(contenu(e).querySelector('caption'))).toBe(tEcran('import.guide.legende.participants'));
    expect([...contenu(e).querySelectorAll('thead th')].map(texteDe)).toEqual(
      ['import.guide.entete', 'import.guide.obligatoire', 'import.guide.contenu', 'import.guide.synonymes'].map((cle) => tEcran(cle)),
    );
    expect([...contenu(e).firstElementChild.children].map(texteDe)).toEqual(
      ['entetes', 'fichier', 'modele', 'apercu'].map((nom) => enLigne(tEcran(`import.guide.consigne.${nom}`))),
    );
    expect(lignesDuGuide(e)).toEqual(attendues(ENTETES_DES_CHAMPS));
    for (const [champ] of ENTETES_DES_CHAMPS) {
      const obligatoire = celluleDuGuide(e, champ, 0);
      expect(texteDe(obligatoire), champ).toBe(tEcran(champ === 'nom' ? 'import.guide.oui' : 'import.guide.non'));
    }
    expect(texteDe(celluleDuGuide(e, 'nom', 2))).toBe(tEcran('import.guide.aucunSynonyme'));
    expect(ligneDuGuide(e, 'exclu').querySelector('th').getAttribute('scope')).toBe('row');
  });

  test('la ligne « conflit_organisation » dit que « ; », « | » ou un retour à la ligne séparent, et qu’une virgule reste dans le nom', async () => {
    const e = await ouvrir();
    bouton(e).click();
    flushSync();
    const ligne = ligneDuGuide(e, 'conflit_organisation');
    expect(texteDe(ligne.querySelector('th'))).toBe('conflit_organisation');
    const texte = texteDe(texteDuGuide(e, 'conflit_organisation'));
    expect(texte).toBe(enLigne(tEcran('import.guide.colonne.conflits')));
    expect(texte).toContain('pas par une virgule, qui reste dans le nom');
    // texteDe ramène les insécables de l'écran à des espaces.
    for (const separateur of [';', '|']) expect(texte).toContain(`« ${separateur} »`);
    expect(texte).not.toContain('« , »');
    expect(texteDe(texteDuGuide(e, 'etiquettes'))).toContain('« , »');
  });

  test('le contenu suit la nature cochée, le guide restant ouvert : les colonnes des objectifs, « table » et « objectif » obligatoires, puis celles des participants', async () => {
    const e = await ouvrir({ tables: NEUF_TABLES() });
    bouton(e).click();
    flushSync();
    choisirNature(e, 'objectifs');
    expect(bouton(e).getAttribute('aria-expanded')).toBe('true');
    expect(texteDe(contenu(e).querySelector('caption'))).toBe(tEcran('import.guide.legende.objectifs'));
    expect(lignesDuGuide(e)).toEqual(attendues(ENTETES_DES_OBJECTIFS));
    expect(
      ENTETES_DES_OBJECTIFS.map(([champ]) => texteDe(celluleDuGuide(e, champ, 0))),
    ).toEqual(['import.guide.oui', 'import.guide.non', 'import.guide.oui', 'import.guide.non'].map((cle) => tEcran(cle)));
    expect(texteDe(texteDuGuide(e, 'regle'))).toBe(enLigne(tEcran('import.guide.colonne.regle')));
    expect(ligneDuGuide(e, 'conflit_organisation')).toBeNull();

    choisirNature(e, 'participants');
    expect(texteDe(contenu(e).querySelector('caption'))).toBe(tEcran('import.guide.legende.participants'));
    expect(lignesDuGuide(e)).toEqual(attendues(ENTETES_DES_CHAMPS));
    expect(ligneDuGuide(e, 'regle')).toBeNull();
  });

  test('ouvert, le tableau tient dans sa carte à 1 366 × 700 ; dans la fenêtre d’un téléphone, il défile dans la carte, jamais la page', async () => {
    const avant = { largeur: innerWidth, hauteur: innerHeight };
    const page = document.documentElement;
    try {
      await fixerCadre(1366, 700);
      const e = await ouvrir();
      bouton(e).click();
      flushSync();
      const defile = contenu(e).querySelector('table').parentElement;
      expect(defile.scrollWidth, 'le tableau défile en largeur').toBeLessThanOrEqual(defile.clientWidth);
      expect(defile.getBoundingClientRect().right).toBeLessThanOrEqual(section(e).getBoundingClientRect().right);
      await fixerCadre(414, 896);
      expect(page.scrollWidth, 'la page défile en largeur').toBeLessThanOrEqual(page.clientWidth);
      expect(defile.getBoundingClientRect().right).toBeLessThanOrEqual(section(e).getBoundingClientRect().right);
    } finally {
      await fixerCadre(avant.largeur, avant.hauteur);
    }
  });
});

describe('la colonne de la présence (§ 10.1)', () => {
  test('le modèle téléchargé porte la neuvième colonne, « presence », puis les conflits ; importé sous quatre tours, son aperçu montre « tours 2 et 3 » et « tours 1 à 3 », les autres vides', async () => {
    const e = await ouvrir({ tours: 4 });
    commande(e, 'telechargerModele').click();
    await vi.waitFor(() => expect(e.enregistres.length).toBe(1));
    const octets = e.enregistres[0].octets;
    expect([...octets]).toEqual([...modeleParticipants({ tours: 4 })]);
    const [entete] = decouper(decoder(octets).texte, ';').enregistrements;
    expect(entete.length).toBe(10);
    expect(entete[8]).toBe('presence');
    expect(entete[9]).toBe('conflit_organisation');
    await choisir(e, 'modele-participants.csv', octets);
    const apercu = dans(e, '[data-apercu]');
    expect(new Map(association(apercu)).get('presence')).toBe(t('import.champ.presence'));
    expect([2, 3, 4, 5].map((ligne) => cellule(apercu, ligne, 'presence'))).toEqual(['', 'tours 2 et 3', '', 'tours 1 à 3']);
    expect(tous(e, '[data-apercu] [data-refusees] [data-ligne]')).toEqual([]);
    await importer(e);
    expect(participantsDe(e).map(({ presence }) => presence)).toEqual([undefined, [2, 3], undefined, [1, 2, 3]]);
    expect(participantsDe(e).map(({ conflits }) => conflits)).toEqual([undefined, undefined, undefined, ['Atelier Ressac']]);
  });

  test('l’aperçu montre « tours 2 à 4 » et « tous les tours » ; une ligne refusée porte son motif, à son rang', async () => {
    const e = await ouvrir({ tours: 4 });
    await choisir(e, 'presences.csv', enUtf8('nom;présence\r\nOmbrelle;2-4\r\nPervenche;tous\r\nLacasse;5\r\nSarcelle;01-mars\r\n'));
    const apercu = dans(e, '[data-apercu]');
    expect(cellule(apercu, 2, 'presence')).toBe('tours 2 à 4');
    expect(cellule(apercu, 3, 'presence')).toBe(t('import.presence.tous'));
    expect(tous(e, '[data-apercu] [data-refusees] [data-ligne]').map((ligne) => ligne.dataset.ligne)).toEqual(['4', '5']);
    expect(texteDe(refusee(apercu, 4))).toContain(libelle('PRESENCE_HORS_TOURS', { ligne: 4, valeur: '5', tour: 5, tours: 4 }));
    expect(texteDe(refusee(apercu, 5))).toContain(libelle('PRESENCE_ILLISIBLE', { ligne: 5, valeur: '01-mars', raison: 'date' }));
  });

  test('en mise à jour, une cellule vide se lit « présence inchangée », et la présence de la personne reste ; sur une ligne que l’import crée, elle ne dit rien', async () => {
    const e = await ouvrir({
      tours: 4,
      participants: [personne(1, 'Ombrelle', 'Iris', { presence: [1, 2] }), personne(2, 'Pervenche', 'Théo', { presence: [3] })],
    });
    await choisir(e, 'maj.csv', enUtf8('nom;prenom;presence\r\nOmbrelle;Iris;\r\nPervenche;Théo;tous\r\nSarcelle;Anouk;\r\n'));
    expect(dans(e, '[data-champ="mode"] input:checked').value).toBe('mettreAJour');
    const apercu = dans(e, '[data-apercu]');
    expect(cellule(apercu, 2, 'presence')).toBe('présence inchangée');
    expect(cellule(apercu, 3, 'presence')).toBe('tous les tours');
    expect(cellule(apercu, 4, 'presence')).toBe('');
    await importer(e);
    expect(participantsDe(e).map(({ presence }) => presence)).toEqual([[1, 2], undefined, undefined]);
  });
});

describe('l’aperçu dans une fenêtre de 1 366 × 700 (§ 10.1)', () => {
  test('le modèle de quatre tours : le tableau tient dans sa carte, les tours nommés d’un tenant', async () => {
    const avant = { largeur: innerWidth, hauteur: innerHeight };
    await fixerCadre(1366, 700);
    try {
      const e = await ouvrir({ tours: 4, participants: [personne(1, 'Houle', 'Agathe', { organisation: 'Atelier Ressac' })] });
      const modele = new TextDecoder().decode(modeleParticipants({ tours: 4 }));
      await choisir(e, 'modele.csv', new TextEncoder().encode(`${modele}Houle;Agathe;;;;;;;;\r\n`));
      const tableau = dans(e, '[data-apercu] [data-lignes]');
      const entetes = [...tableau.tHead.rows[0].cells];
      expect(entetes.at(-1).textContent).toBe(t('import.champ.conflits'));
      // Aucune colonne ne se cache au-delà du bord du conteneur qui défile :
      // il ne défile pas en largeur, et chaque en-tête tient dans sa cellule.
      const defile = tableau.parentElement;
      expect(defile.scrollWidth, 'le tableau défile en largeur dans son conteneur').toBeLessThanOrEqual(defile.clientWidth);
      expect(defile.getBoundingClientRect().right).toBeLessThanOrEqual(section(e).getBoundingClientRect().right);
      for (const entete of entetes) expect(entete.scrollWidth, entete.textContent).toBeLessThanOrEqual(entete.clientWidth);
      // Les tours nommés, en plage et en liste, chacun sur une ligne.
      const lues = [...tableau.querySelectorAll('[data-cellule="presence"]')].filter((c) => /^tours /.test(texteDe(c)));
      expect(lues.map(texteDe).sort()).toEqual(['tours 1 à 3', 'tours 2 et 3']);
      for (const presence of lues) expect(rangeesDeTexte(presence), texteDe(presence)).toBe(1);
    } finally {
      await fixerCadre(avant.largeur, avant.hauteur);
    }
  });
});
