// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// La section des badges dans un vrai moteur de rendu (§ 2.1 étape 12, § 11.2,
// § 11.6, § 11.8, § 8.4, § 8.5, § 14.6, Q1, Q3) : le papier des badges,
// Lettre tant que la machine n'en a pas, sans question, et « Changer » qui le
// choisit pour la machine ; l'annonce avant de produire — planches des deux
// papiers, dérive nommée, « Produire » désactivé et expliqué tant que le
// refus tient ; la production en lecture et sur un plan bloqué sans écriture
// de l'état ni du journal ; le chemin produit, « Ouvrir le dossier » avant
// comme après la production, la réédition ; le refus d'écriture et son remède
// « Enregistrer sous… » ; le choix de la source, de l'imposition et de
// l'ordre, et le retrait de l'annonce quand un réglage ou le papier change ;
// le téléchargement sous web ; la langue témoin.
//
// App est montée par test/navigateur/ecrans.js sur le système de fichiers
// simulé ; le texte attendu vient de la même traduction que celle de
// l'application, les comptes du témoin de test/fixtures/badges/temoin.js.
//
// Le projet navigateur emploie expect, et test et describe de Vitest
// (§ 14.8).
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { appliquerCommande } from '../../application/commandes.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { listeBadges, modelePlanche } from '../../application/planche.js';
import { MARQUE_TEMOIN, creerTraduction } from '../../application/traduction.js';
import { PAPIERS } from '../../geometrie/papiers.js';
import { ErreurStockage } from '../../stockage/erreurs.js';
import { SUFFIXES } from '../../stockage/noms.js';
import { FICHIER_REGLAGES } from '../../stockage/reglages_locaux.js';
import { VERSION } from '../../version.genere.js';
import { couleurDeJeton } from '../../../test/navigateur/captures.js';
import { fixerCadre } from '../../../test/navigateur/entrees.js';
import { composantes, contraste } from '../../../test/navigateur/rendu.js';
import { BASE, attendre, chargeBloquee, chargePrincipale, cliquer, creerContexte, fichierReglages, ouvrirEvenement } from '../../../test/navigateur/ecrans.js';
import { FORME_TEMOIN, chargeTemoin } from '../../../test/fixtures/badges/temoin.js';
import { clesPapier } from '../impression/modele.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { personnesReeditables } from './modele.js';

const TABLES = [...TABLES_APPLICATION, ...TABLES_INTERFACE];
const { t } = creerTraduction(TABLES);

// Images attendues au plus pour une préparation ou une production : la
// police et pdf-lib se chargent à la première, et le témoin met en page
// 257 badges.
const IMAGES = 1800;

let contexte = null;
beforeEach(async () => {
  await fixerCadre(1366, 700);
  contexte = creerContexte();
});
afterEach(async () => {
  const erreurs = contexte.erreurs();
  await contexte.defaire();
  expect(erreurs, 'erreurs reçues par le collecteur').toEqual([]);
});

const dans = (m, selecteur) => m.racine.querySelector(selecteur);
const plat = (chaine) => chaine.replace(/\s+/g, ' ').trim();
const texte = (element) => plat(element.textContent);
const section = (m) => dans(m, '[data-section="badges"]');
const annonce = (m) => dans(m, '[data-section="badges"] [data-annonce-planche]');
const question = (m) => dans(m, '[data-section="badges"] [data-papier="question"]');
const produire = (m) => dans(m, '[data-section="badges"] [data-commande="produirePlanche"]');
const produireListe = (m) => dans(m, '[data-section="badges"] [data-commande="produireListe"]');

// Les écritures relevées depuis le rang donné : celles qui touchent l'état,
// le journal ou la version précédente d'un événement, et toutes les autres.
const ecrituresEvenement = (m, depuis) =>
  m.trace.slice(depuis).filter(([, , chemin]) => [SUFFIXES.etat, SUFFIXES.journal, SUFFIXES.precedent].some((suffixe) => chemin.endsWith(suffixe)));
const planchesEcrites = (m, depuis) => m.trace.slice(depuis).filter(([primitive]) => primitive === 'ecrireOctetsAtomique');
// Le texte d'un fichier du dossier de travail, marque d'ordre d'octets gardée.
const texteFichier = (m, nom) => new TextDecoder('utf-8', { ignoreBOM: true }).decode(m.fs.octets('documents', nom));

// La principale, sa proposition retenue, sur un plan retenu.
function chargeRetenue() {
  const principale = chargePrincipale();
  return appliquerCommande('retenirProposition', principale, { id: principale.propositions[0].id }).charge;
}

// La retenue, une personne de plus posée dans la charge sans passer par une
// commande, comme un fichier écrit ailleurs : la dérive que le retenu ne
// porte pas. Rend la charge et l'id de la personne ajoutée.
function chargeEnDerive() {
  const charge = structuredClone(chargeRetenue());
  const ajoutee = charge.prochainsIds.participant;
  const { id: _id, nom: _nom, prenom: _prenom, ...reste } = charge.participants[0];
  charge.participants.push({ ...reste, id: ajoutee, nom: 'Ombrelle', prenom: 'Iris' });
  charge.prochainsIds.participant = ajoutee + 1;
  return { charge, ajoutee };
}

// Ouvre l'événement de la charge sur la section des badges, le papier et le
// modèle de badge de la machine posés dans les réglages locaux — l'A6 par
// défaut, le modèle que la plupart de ces épreuves éprouvent ; papier null
// n'en pose aucun, et modeleBadge null, avec lui, aucun réglage : une
// machine neuve, sur Avery 5392.
function ouvrirBadges(charge, { papier = 'A4', modeleBadge = 'a6', ecriture = false, options = {} } = {}) {
  const reglages = papier === null && modeleBadge === null ? [] : [fichierReglages(papier, { modeleBadge })];
  const fichiers = [...reglages, ...(options.fichiers ?? [])];
  return ouvrirEvenement(contexte, charge, { ecriture, section: 'badges', options: { ...options, fichiers } });
}

// Choisit la valeur d'un sélecteur de la section, comme l'opérateur.
function choisirReglage(m, champ, valeur) {
  const choix = dans(m, `[data-section="badges"] [data-champ="${champ}"]`);
  choix.value = valeur;
  choix.dispatchEvent(new Event('change', { bubbles: true }));
}

// Relève chaque demande que la section passe à seance.produirePlanche, et
// la transmet telle quelle.
function releverDemandes(m) {
  const demandes = [];
  const originale = m.seance.produirePlanche;
  m.seance.produirePlanche = (demande) => {
    demandes.push(demande);
    return originale(demande);
  };
  return demandes;
}

// Clique « Produire » et attend l'issue que condition rend.
async function cliquerProduire(m, quoi, condition) {
  produire(m).click();
  return attendre(quoi, condition, IMAGES);
}

// Le texte attendu des planches sur chaque papier, le papier utilisé marqué.
const textePlanches = (planches, choisi) =>
  t('badges.annonce.planches', {
    parPapier: Object.keys(PAPIERS).map((papier) => ({ papier, nom: clesPapier(papier).nom, planches: planches[papier], choisi: papier === choisi })),
  });

// Relève chaque racine que la section passe à l'explorateur du système de
// fichiers, et la transmet telle quelle.
function releverExplorateur(m) {
  const ouvertes = [];
  const originale = m.fs.ouvrirDansExplorateur;
  m.fs.ouvrirDansExplorateur = async (racine) => {
    ouvertes.push(racine);
    return originale(racine);
  };
  return ouvertes;
}

// Le chemin attendu d'un fichier du dossier de travail des épreuves.
async function cheminDocuments(m, nom) {
  const { separateur } = await m.fs.emplacements();
  const racine = m.seance.etat().racine;
  return `${racine.chemin}${separateur}${nom}`;
}

describe('le papier des badges : Lettre par défaut, sans question (§ 8.5, § 11.2)', () => {
  // Le papier que la section des badges montre.
  const papierMontre = (m) => dans(m, '[data-section="badges"] [data-papier="choisi"]');

  test('le témoin sans papier choisi : Lettre montré ; « Produire » annonce 65 A4 et 129 Lettre, produit sur Lettre, ne retient rien', async () => {
    const m = await ouvrirBadges(chargeTemoin(), { papier: null });
    expect(texte(papierMontre(m))).toContain(t('impression.papier.nom.lettre'));
    expect(question(m)).toBeNull();
    const reglages = m.fs.contenu('documents', FICHIER_REGLAGES);
    const depuis = m.trace.length;
    const chemin = await cliquerProduire(m, 'la planche produite', () => dans(m, '[data-chemin-planche]'));
    const { planchesA4: A4, planchesLettre } = FORME_TEMOIN;
    const planches = Object.fromEntries(Object.keys(PAPIERS).map((papier, rang) => [papier, [A4, planchesLettre][rang]]));
    const lue = texte(annonce(m));
    expect(lue).toContain(plat(textePlanches(planches, 'Lettre')));
    expect(lue).toContain(plat(t('badges.annonce.comptes', { produits: FORME_TEMOIN.produits, participants: FORME_TEMOIN.participants, exclus: FORME_TEMOIN.exclus })));
    expect(dans(m, '[data-annonce-planche] [data-refus]')).toBeNull();
    expect(question(m)).toBeNull();
    // Seul le PDF s'écrit : le papier par défaut ne devient pas celui de la
    // machine, que l'aperçu d'impression demande encore.
    expect(m.trace.slice(depuis).map(([primitive]) => primitive)).toEqual(['ecrireOctetsAtomique']);
    const ecrites = planchesEcrites(m, depuis);
    expect(ecrites[0][2]).toMatch(/_Lettre_feuille_/);
    expect(texte(chemin)).toBe(await cheminDocuments(m, ecrites[0][2]));
    expect(m.seance.etat().papier).toBeNull();
    expect(m.fs.contenu('documents', FICHIER_REGLAGES)).toBe(reglages);
  });

  test('« Changer » pose la question ; le papier choisi s’écrit et vaut ensuite, nouvel événement et App remontée compris', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: null });
    dans(m, '[data-section="badges"] [data-papier="choisi"] [data-commande="changerPapier"]').click();
    await attendre('la question du papier', () => question(m), IMAGES);
    dans(m, '[data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]').click();
    await attendre('le papier choisi', () => m.seance.etat().papier === 'A4' && papierMontre(m), IMAGES);
    // Les réglages locaux portent le papier : la seule écriture hors du PDF.
    expect(JSON.parse(m.fs.contenu('documents', FICHIER_REGLAGES)).papier).toBe('A4');
    expect(texte(papierMontre(m))).toContain(t('impression.papier.nom.a4'));
    const depuis = m.trace.length;
    await cliquerProduire(m, 'la planche A4', () => planchesEcrites(m, depuis).length === 1);
    expect(planchesEcrites(m, depuis)[0][2]).toMatch(/_A4_feuille_/);
    expect(question(m)).toBeNull();

    // Un nouvel événement, sans placement : la section montre le papier, et
    // « Produire » dit le refus du placement, jamais la question.
    await m.seance.fermer();
    await m.seance.creer({ nom: 'Bal des Pervenches', date: null, siegesParDefaut: 8, tours: 2 });
    m.ui.allerA('badges');
    await attendre('la section du nouvel événement', () => section(m) && papierMontre(m), IMAGES);
    expect(texte(papierMontre(m))).toContain(t('impression.papier.nom.a4'));
    await cliquerProduire(m, 'le refus du placement', () => dans(m, '[data-annonce-planche] [data-refus="PLANCHE_SANS_PLACEMENT"]'));
    expect(question(m)).toBeNull();

    // App remontée sur le même disque : le papier se relit, et la planche
    // le porte.
    const second = await contexte.monter({ systeme: { disque: m.disque } });
    await cliquer(second, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
    await cliquer(second, '[data-commande="section"][data-cible="badges"]');
    await attendre('le papier relu', () => second.seance.etat().papier === 'A4' && dans(second, '[data-section="badges"] [data-papier="choisi"]'), IMAGES);
    const avant = second.trace.length;
    await cliquerProduire(second, 'la planche du second montage', () => dans(second, '[data-chemin-planche]'));
    expect(question(second)).toBeNull();
    expect(planchesEcrites(second, avant)).toHaveLength(1);
    expect(planchesEcrites(second, avant)[0][2]).toMatch(/_A4_feuille_/);
  });
});

describe('sortir n’est pas modifier (§ 8.4, § 11.6, contrainte 24)', () => {
  test('en lecture, sur une proposition : préparer et produire passent, BROUILLON annoncé ; seuls le PDF et les réglages s’écrivent', async () => {
    // La principale n'a pas de retenu : l'ouverture demande au plan sa
    // première proposition, la source de la planche.
    const charge = chargePrincipale();
    const m = await ouvrirBadges(charge, { papier: null });
    expect(m.seance.etat().mode).toBe('lecture');
    const depuis = m.trace.length;
    dans(m, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    await attendre('l’annonce', () => annonce(m), IMAGES);
    const lue = texte(annonce(m));
    expect(lue).toContain(plat(t('badges.annonce.source.proposition', { id: charge.propositions[0].id })));
    expect(lue).toContain(plat(t('badges.annonce.brouillon.proposition')));
    expect(dans(m, '[data-annonce-planche] [data-refus]')).toBeNull();
    dans(m, '[data-section="badges"] [data-papier="choisi"] [data-commande="changerPapier"]').click();
    await attendre('la question du papier', () => question(m), IMAGES);
    dans(m, '[data-papier="question"] [data-cible="A4"] [data-commande="choisirPapier"]').click();
    await attendre('l’annonce sur A4', () => annonce(m) && m.seance.etat().papier === 'A4', IMAGES);
    await cliquerProduire(m, 'la planche', () => dans(m, '[data-chemin-planche]'));
    expect(ecrituresEvenement(m, depuis)).toEqual([]);
    expect(m.trace.slice(depuis).map(([primitive, , chemin]) => [primitive, chemin.endsWith('.pdf') ? 'pdf' : chemin])).toEqual([
      ['ecrireAtomique', FICHIER_REGLAGES],
      ['ecrireOctetsAtomique', 'pdf'],
    ]);
  });

  test('sur un plan bloqué : la planche se produit, sans BROUILLON ; seule l’écriture du PDF', async () => {
    const m = await ouvrirBadges(chargeBloquee());
    expect(m.seance.etat().charge.evenement.etat).toBe('bloque');
    const depuis = m.trace.length;
    await cliquerProduire(m, 'la planche', () => dans(m, '[data-chemin-planche]'));
    expect(texte(annonce(m))).not.toContain('BROUILLON');
    expect(texte(annonce(m))).toContain(plat(t('badges.annonce.source.retenu')));
    expect(m.trace.slice(depuis).map(([primitive]) => primitive)).toEqual(['ecrireOctetsAtomique']);
    expect(ecrituresEvenement(m, depuis)).toEqual([]);
  });
});

describe('la dérive, nommée avant toute production (§ 11.8)', () => {
  test('« Produire » sur un retenu en dérive : le refus nomme la personne ajoutée, rien ne s’écrit ; « Produire » reste désactivé et expliqué tant que le refus tient', async () => {
    const { charge, ajoutee } = chargeEnDerive();
    const m = await ouvrirBadges(charge);
    const depuis = m.trace.length;
    await cliquerProduire(m, 'le refus de dérive', () => dans(m, '[data-annonce-planche] [data-refus="PLANCHE_DERIVE"]'));
    const refus = dans(m, '[data-annonce-planche] [data-refus="PLANCHE_DERIVE"]');
    expect(texte(refus)).toContain('Iris Ombrelle');
    expect(refus.querySelector('[data-commande="ouvrirSection"]')).not.toBeNull();
    expect(planchesEcrites(m, depuis)).toEqual([]);

    const bouton = produire(m);
    expect(bouton.getAttribute('aria-disabled')).toBe('true');
    const explication = m.racine.querySelector(`#${CSS.escape(bouton.getAttribute('aria-describedby'))}`);
    expect(texte(explication)).toBe(plat(t('badges.produire.bloque')));
    bouton.click();
    await attendre('une image', () => true);
    expect(planchesEcrites(m, depuis)).toEqual([]);
    expect(dans(m, '[data-chemin-planche]')).toBeNull();

    // La personne retirée, la dérive tombe : l'annonce d'avant se retire,
    // et « Produire » produit.
    await m.seance.passerEnEcriture();
    await m.seance.executer('supprimerParticipant', { id: ajoutee });
    await attendre('« Produire » rendu', () => produire(m)?.getAttribute('aria-disabled') === null && annonce(m) === null, IMAGES);
    await cliquerProduire(m, 'la planche', () => dans(m, '[data-chemin-planche]'));
    expect(planchesEcrites(m, depuis)).toHaveLength(1);
  });
});

describe('la planche produite, le dossier, la réédition (§ 11.6, § 11.8)', () => {
  test('« Ouvrir le dossier » s’offre avant toute production, sans papier retenu comme sous une dérive qui bloque « Produire », et appelle la façade sur le dossier de travail, sans rien écrire', async () => {
    // La commande active ouvre la racine de travail, sans rien écrire.
    const ouvreLeDossier = async (m) => {
      const commande = dans(m, '[data-section="badges"] [data-commande="ouvrirDossier"]');
      expect(commande).not.toBeNull();
      expect(commande.getAttribute('aria-disabled')).toBeNull();
      const ouvertes = releverExplorateur(m);
      const depuis = m.trace.length;
      commande.click();
      await attendre('l’explorateur appelé', () => ouvertes.length === 1, IMAGES);
      expect(ouvertes[0].id).toBe(m.seance.etat().racine.id);
      expect(planchesEcrites(m, depuis)).toEqual([]);
      expect(ecrituresEvenement(m, depuis)).toEqual([]);
    };

    const papierRetenu = await ouvrirBadges(chargeBloquee());
    expect(dans(papierRetenu, '[data-chemin-planche]')).toBeNull();
    await ouvreLeDossier(papierRetenu);

    // Une machine neuve : aucun papier retenu dans les réglages locaux.
    const sansPapier = await ouvrirBadges(chargeBloquee(), { papier: null });
    expect(sansPapier.seance.etat().papier).toBeNull();
    await ouvreLeDossier(sansPapier);

    // La dérive annoncée bloque « Produire », pas « Ouvrir le dossier ».
    const enDerive = await ouvrirBadges(chargeEnDerive().charge);
    await cliquerProduire(enDerive, 'le refus de dérive', () => dans(enDerive, '[data-annonce-planche] [data-refus="PLANCHE_DERIVE"]'));
    expect(produire(enDerive).getAttribute('aria-disabled')).toBe('true');
    await ouvreLeDossier(enDerive);
    expect(dans(enDerive, '[data-chemin-planche]')).toBeNull();
  });

  test('le chemin s’affiche ; « Ouvrir le dossier » appelle la façade sur le dossier de travail ; trois badges se rééditent', async () => {
    const charge = chargeBloquee();
    const m = await ouvrirBadges(charge);
    const depuis = m.trace.length;
    await cliquerProduire(m, 'la planche', () => dans(m, '[data-chemin-planche]'));
    const [[, , nom]] = planchesEcrites(m, depuis);
    expect(texte(dans(m, '[data-chemin-planche]'))).toBe(await cheminDocuments(m, nom));
    expect(new TextDecoder().decode(m.fs.octets('documents', nom).slice(0, 5))).toBe('%PDF-');

    const ouvertes = releverExplorateur(m);
    dans(m, '[data-section="badges"] [data-commande="ouvrirDossier"]').click();
    await attendre('l’explorateur appelé', () => ouvertes.length === 1, IMAGES);
    expect(ouvertes[0].id).toBe(m.seance.etat().racine.id);

    // Trois personnes cochées, dans le désordre de la liste.
    const personnes = personnesReeditables(charge);
    const choisies = [personnes[4].id, personnes[0].id, personnes[2].id];
    for (const id of choisies) {
      dans(m, `[data-section="badges"] li[data-participant="${id}"] input[type="checkbox"]`).click();
    }
    const reediter = await attendre('« Rééditer 3 badges »', () => dans(m, '[data-section="badges"] [data-commande="reediter"]'), IMAGES);
    expect(texte(reediter)).toBe(plat(t('badges.reedition.produire', { n: 3 })));
    const avant = m.trace.length;
    reediter.click();
    await attendre('la réédition', () => planchesEcrites(m, avant).length === 1, IMAGES);
    const [[, , nomReedition]] = planchesEcrites(m, avant);
    expect(nomReedition).toMatch(/\.badges-3_A4_feuille_/);
    await attendre('son chemin', () => texte(dans(m, '[data-chemin-planche]')).endsWith(nomReedition), IMAGES);
    expect(texte(annonce(m))).toContain(plat(t('badges.annonce.reedition', { n: 3 })));
    expect(ecrituresEvenement(m, depuis)).toEqual([]);
  });

  test('le filtre restreint la liste ; une personne cochée le reste sous le filtre', async () => {
    const charge = chargeBloquee();
    const m = await ouvrirBadges(charge);
    const [premiere, seconde] = personnesReeditables(charge);
    dans(m, `li[data-participant="${premiere.id}"] input[type="checkbox"]`).click();
    const champ = dans(m, '[data-section="badges"] [data-champ="reedition"]');
    champ.value = seconde.nom;
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    await attendre('la liste filtrée', () => dans(m, `li[data-participant="${premiere.id}"]`) === null, IMAGES);
    expect(dans(m, `li[data-participant="${seconde.id}"]`)).not.toBeNull();
    expect(texte(dans(m, '[data-commande="reediter"]'))).toBe(plat(t('badges.reedition.produire', { n: 1 })));
    champ.value = 'zzzz';
    champ.dispatchEvent(new Event('input', { bubbles: true }));
    await attendre('aucune personne', () => texte(section(m)).includes(plat(t('badges.reedition.aucune'))), IMAGES);
  });
});

describe('l’imposition et l’ordre (§ 11.6)', () => {
  test('« En pile » puis « Par table du premier tour » passent à la demande : la planche porte _pile_, l’annonce nomme son fichier', async () => {
    const m = await ouvrirBadges(chargeBloquee());
    const demandes = releverDemandes(m);
    choisirReglage(m, 'imposition', 'pile');
    const depuis = m.trace.length;
    await cliquerProduire(m, 'la planche en pile', () => planchesEcrites(m, depuis).length === 1);
    const [[, , nom]] = planchesEcrites(m, depuis);
    expect(nom).toMatch(/_A4_pile_/);
    expect(texte(annonce(m))).toContain(plat(t('badges.annonce.fichier', { nom })));

    choisirReglage(m, 'ordre', 'table');
    const ensuite = m.trace.length;
    await cliquerProduire(m, 'la planche par table', () => planchesEcrites(m, ensuite).length === 1);
    expect(demandes.map(({ imposition, ordre }) => ({ imposition, ordre }))).toEqual([
      { imposition: 'pile', ordre: 'alphabetique' },
      { imposition: 'pile', ordre: 'table' },
    ]);
  });

  test('l’annonce montrée se retire quand l’imposition change, puis quand le papier change', async () => {
    const m = await ouvrirBadges(chargeBloquee());
    const preparer = () => dans(m, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    preparer();
    await attendre('l’annonce feuille par feuille', () => annonce(m), IMAGES);
    expect(texte(annonce(m))).toMatch(/_A4_feuille_/);
    choisirReglage(m, 'imposition', 'pile');
    await attendre('une image', () => true);
    expect(annonce(m)).toBeNull();

    preparer();
    await attendre('l’annonce en pile', () => annonce(m), IMAGES);
    expect(texte(annonce(m))).toMatch(/_A4_pile_/);
    // Le papier changé hors de la section : l'annonce sur A4 se retire, et
    // la suivante porte le nouveau papier.
    const lettre = Object.keys(PAPIERS)[1];
    await m.seance.choisirPapier(lettre);
    await attendre('une image', () => true);
    expect(annonce(m)).toBeNull();
    preparer();
    await attendre('l’annonce sur le nouveau papier', () => annonce(m), IMAGES);
    expect(texte(annonce(m))).toContain(`_${lettre}_pile_`);
  });
});

describe('sous web, la planche se télécharge (§ 11.6)', () => {
  test('la section dit le nom téléchargé ; ni « Ouvrir le dossier », avant comme après, ni écriture du PDF', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { options: { systeme: { nature: 'web' } } });
    expect(dans(m, '[data-section="badges"] [data-commande="ouvrirDossier"]')).toBeNull();
    const telechargees = [];
    m.fs.enregistrerSous = async (nom, octets) => {
      telechargees.push({ nom, debut: new TextDecoder().decode(octets.slice(0, 5)) });
      return null;
    };
    const depuis = m.trace.length;
    await cliquerProduire(m, 'la planche téléchargée', () => dans(m, '[data-chemin-planche]'));
    expect(telechargees).toHaveLength(1);
    const [{ nom, debut }] = telechargees;
    expect(nom).toMatch(/_A4_feuille_.*\.pdf$/);
    expect(debut).toBe('%PDF-');
    expect(texte(dans(m, '[data-chemin-planche]'))).toBe(plat(t('badges.produite.telechargee', { nom })));
    expect(dans(m, '[data-section="badges"] [data-commande="ouvrirDossier"]')).toBeNull();
    expect(planchesEcrites(m, depuis)).toEqual([]);
  });
});

describe('une écriture refusée, et son remède (§ 8.5, § 11.6)', () => {
  test('PLANCHE_NON_ECRITE s’affiche à côté de « Produire », remède « Enregistrer sous… », dont le chemin choisi s’affiche ; « Ouvrir le dossier » montre le dossier de travail', async () => {
    const m = await ouvrirBadges(chargeBloquee());
    m.fs.pannes.ecriture('documents');
    const proposes = [];
    m.fs.enregistrerSous = async (nom, octets) => {
      proposes.push({ nom, debut: new TextDecoder().decode(octets.slice(0, 5)) });
      return 'D:\\ailleurs\\planche.pdf';
    };
    await cliquerProduire(m, 'le refus d’écriture', () => dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    const remede = dans(m, '[data-refus="PLANCHE_NON_ECRITE"] [data-commande="enregistrerSous"]');
    expect(texte(remede)).toBe(plat(t('communs.remede.enregistrerSous')));
    remede.click();
    const chemin = await attendre('le chemin choisi', () => dans(m, '[data-chemin-planche]'), IMAGES);
    expect(texte(chemin)).toBe('D:\\ailleurs\\planche.pdf');
    expect(proposes).toHaveLength(1);
    expect(proposes[0].nom).toMatch(/_A4_feuille_.*\.pdf$/);
    expect(proposes[0].debut).toBe('%PDF-');
    // Le refus levé ; « Ouvrir le dossier » demeure, et montre le dossier de
    // travail, pas celui choisi ailleurs.
    expect(dans(m, '[data-refus="PLANCHE_NON_ECRITE"]')).toBeNull();
    const ouvertes = releverExplorateur(m);
    dans(m, '[data-section="badges"] [data-commande="ouvrirDossier"]').click();
    await attendre('l’explorateur appelé', () => ouvertes.length === 1, IMAGES);
    expect(ouvertes[0].id).toBe(m.seance.etat().racine.id);
  });

  test('une production refusée après une réussie ne montre plus le chemin de la précédente', async () => {
    const m = await ouvrirBadges(chargeBloquee());
    await cliquerProduire(m, 'la première planche', () => dans(m, '[data-chemin-planche]'));
    m.fs.pannes.ecriture('documents');
    await cliquerProduire(m, 'le refus d’écriture', () => dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    expect(dans(m, '[data-chemin-planche]')).toBeNull();
  });
});

describe('la source de la planche (Q3)', () => {
  test('le retenu et la proposition demandée au plan : le retenu par défaut ; la proposition choisie s’annonce, BROUILLON', async () => {
    const charge = chargeRetenue();
    const m = await ouvrirBadges(charge);
    expect(dans(m, '[data-section="badges"] [data-champ="source"]')).toBeNull();
    m.ui.montrerProposition(charge.propositions[0].id);
    const choix = await attendre('le choix de la source', () => dans(m, '[data-section="badges"] [data-champ="source"]'), IMAGES);
    expect([...choix.options].map((option) => option.value)).toEqual(['retenu', `proposition:${charge.propositions[0].id}`]);
    expect(choix.value).toBe('retenu');
    choix.value = `proposition:${charge.propositions[0].id}`;
    choix.dispatchEvent(new Event('change', { bubbles: true }));
    dans(m, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    await attendre('l’annonce', () => annonce(m), IMAGES);
    expect(texte(annonce(m))).toContain(plat(t('badges.annonce.source.proposition', { id: charge.propositions[0].id })));
    expect(texte(annonce(m))).toContain(plat(t('badges.annonce.brouillon.proposition')));
  });

  test('sans retenu ni proposition demandée : le refus du placement, remède vers les propositions', async () => {
    const charge = chargePrincipale();
    const m = await ouvrirBadges(charge);
    m.ui.montrerProposition(null);
    await cliquerProduire(m, 'le refus', () => dans(m, '[data-annonce-planche] [data-refus="PLANCHE_SANS_PLACEMENT"]'));
    dans(m, '[data-refus="PLANCHE_SANS_PLACEMENT"] [data-commande="ouvrirSection"]').click();
    await attendre('les propositions', () => dans(m, '[data-section="propositions"]'), IMAGES);
  });
});

describe('la langue témoin (§ 14.6)', () => {
  test('chaque texte de la section, annonce, refus, question et réédition compris, est marqué, hors des données', async () => {
    const temoin = creerContexte({ langue: 'temoin' });
    try {
      const charge = chargeBloquee();
      // L'A6, seul modèle qui montre le papier ; « Changer », après la
      // production, ouvre la question à côté de l'annonce et de la planche.
      const reglages = [fichierReglages(null, { modeleBadge: 'a6' })];
      const m = await ouvrirEvenement(temoin, charge, { section: 'badges', options: { fichiers: reglages } });
      produire(m).click();
      await attendre('la planche et l’annonce', () => dans(m, '[data-chemin-planche]') && annonce(m), IMAGES);
      dans(m, '[data-section="badges"] [data-papier="choisi"] [data-commande="changerPapier"]').click();
      await attendre('la question', () => question(m), IMAGES);
      const racine = m.seance.etat().racine.chemin;
      const noms = new Set([...personnesReeditables(charge).flatMap(({ nom, organisation }) => [nom, organisation]), charge.evenement.nom]);
      const { ouverture, fermeture } = MARQUE_TEMOIN;
      const fautes = [];
      const marchant = document.createTreeWalker(section(m), NodeFilter.SHOW_TEXT);
      let lus = 0;
      for (let noeud = marchant.nextNode(); noeud !== null; noeud = marchant.nextNode()) {
        const lu = plat(noeud.textContent);
        if (lu === '') continue;
        lus += 1;
        const marque = lu.startsWith(ouverture) && lu.endsWith(fermeture);
        if (!marque && !noms.has(lu) && !lu.startsWith(racine)) fautes.push(lu);
      }
      expect(lus).toBeGreaterThan(10);
      expect(fautes).toEqual([]);

      // Avery 5392, revenu d'un choix : l'annonce des cartes et des deux
      // fichiers, et les deux fichiers déposés, marqués eux aussi.
      choisirReglage(m, 'modeleBadge', 'avery5392');
      await attendre('le modèle Avery 5392', () => m.seance.etat().modeleBadge === 'avery5392', IMAGES);
      produire(m).click();
      await attendre('les deux fichiers', () => dans(m, '[data-chemin-controle]') && annonce(m), IMAGES);
      const fautesAvery = [];
      const marchantAvery = document.createTreeWalker(section(m), NodeFilter.SHOW_TEXT);
      for (let noeud = marchantAvery.nextNode(); noeud !== null; noeud = marchantAvery.nextNode()) {
        const lu = plat(noeud.textContent);
        if (lu === '') continue;
        const marque = lu.startsWith(ouverture) && lu.endsWith(fermeture);
        if (!marque && !noms.has(lu) && !lu.startsWith(racine)) fautesAvery.push(lu);
      }
      expect(fautesAvery).toEqual([]);
    } finally {
      const erreurs = temoin.erreurs();
      await temoin.defaire();
      expect(erreurs).toEqual([]);
    }
  });
});

// --- L'habillage : cartes, action principale --------------------------------------

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

describe('l’habillage de la section des badges', () => {
  test('les réglages, le papier, les commandes et l’annonce de la planche dans une carte ; la réédition dans une autre', async () => {
    const m = await ouvrirBadges(chargeRetenue());
    dans(m, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    await attendre('l’annonce', () => annonce(m), IMAGES);
    const planche = carteDe(dans(m, '[data-section="badges"] [data-champ="imposition"]'));
    expect(planche, 'carte de la planche').not.toBeNull();
    expect(section(m).contains(planche)).toBe(true);
    for (const selecteur of ['[data-champ="ordre"]', '[data-papier="choisi"]', '[data-commande="preparerPlanche"]', '[data-commande="produirePlanche"]', '[data-commande="produireListe"]', '[data-annonce-planche]']) {
      expect(planche.contains(dans(m, `[data-section="badges"] ${selecteur}`)), selecteur).toBe(true);
    }
    const reedition = carteDe(dans(m, '[data-section="badges"] [data-champ="reedition"]'));
    expect(reedition, 'carte de la réédition').not.toBeNull();
    expect(reedition).not.toBe(planche);
    expect(planche.contains(reedition)).toBe(false);
  });

  test('l’annonce sur le fond sourd de la carte ; « Produire la planche » est l’action principale, son texte à 4,5:1', async () => {
    const m = await ouvrirBadges(chargeRetenue());
    dans(m, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    await attendre('l’annonce', () => annonce(m), IMAGES);
    expect(composantes(getComputedStyle(annonce(m)).backgroundColor).join()).toBe(couleurDeJeton('--couleur-carte-fond-sourd').join());
    const style = getComputedStyle(produire(m));
    const fond = composantes(style.backgroundColor);
    expect(fond.join()).toBe(couleurDeJeton('--couleur-action-fond').join());
    expect(contraste(composantes(style.color), fond)).toBeGreaterThanOrEqual(4.5);
    expect(produire(m).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });
});

describe('le modèle de badge : Avery 5392 par défaut, l’A6 au choix (§ 8.5, § 11.2, § 11.3)', () => {
  const champ = (m, nom) => dans(m, `[data-section="badges"] [data-champ="${nom}"]`);

  test('une machine neuve : Avery 5392 choisi, ni imposition ni question du papier ; « Produire » dépose les cartes et la feuille de contrôle, et nomme les deux chemins', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: null, modeleBadge: null });
    expect(champ(m, 'modeleBadge').value).toBe('avery5392');
    expect(champ(m, 'imposition')).toBeNull();
    expect(dans(m, '[data-section="badges"] [data-papier]')).toBeNull();
    const depuis = m.trace.length;
    await cliquerProduire(m, 'les deux fichiers', () => dans(m, '[data-chemin-controle]'));
    const ecrites = planchesEcrites(m, depuis).map(([, , nom]) => nom);
    expect(ecrites).toHaveLength(2);
    expect(ecrites[0]).toMatch(/\.badges_avery5392_.*\.pdf$/);
    expect(ecrites[1]).toMatch(/\.controle_avery5392_.*\.pdf$/);
    expect(texte(dans(m, '[data-chemin-planche]'))).toBe(await cheminDocuments(m, ecrites[0]));
    expect(texte(dans(m, '[data-chemin-controle]'))).toBe(await cheminDocuments(m, ecrites[1]));
    expect(dans(m, '[data-section="badges"] [data-papier]')).toBeNull();
    expect(m.seance.etat().papier).toBeNull();
    const lue = texte(annonce(m));
    // Six cartes par feuille.
    const presents = m.seance.etat().charge.participants.filter(({ exclu }) => !exclu).length;
    expect(lue).toContain(plat(t('badges.annonce.cartes', { planches: Math.ceil(presents / 6) })));
    expect(lue).toContain(plat(t('badges.annonce.fichiers', { nom: ecrites[0], nomControle: ecrites[1] })));
    expect(ecrituresEvenement(m, depuis)).toEqual([]);
  });

  test('choisir l’A6 l’écrit sur la machine, montre l’imposition et le papier, retire l’annonce ; revenir à Avery 5392 les cache', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: 'A4', modeleBadge: null });
    dans(m, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    await attendre('l’annonce Avery', () => annonce(m), IMAGES);
    choisirReglage(m, 'modeleBadge', 'a6');
    await attendre('le modèle écrit', () => JSON.parse(m.fs.contenu('documents', FICHIER_REGLAGES)).modele_badge === 'a6', IMAGES);
    await attendre('l’imposition et le papier', () => champ(m, 'imposition') && dans(m, '[data-section="badges"] [data-papier="choisi"]'), IMAGES);
    expect(m.seance.etat().modeleBadge).toBe('a6');
    expect(annonce(m)).toBeNull();
    expect(dans(m, '[data-section="badges"] [data-avertissement="modeleNonRetenu"]')).toBeNull();
    const depuis = m.trace.length;
    await cliquerProduire(m, 'la planche A6', () => planchesEcrites(m, depuis).length === 1);
    expect(planchesEcrites(m, depuis)[0][2]).toMatch(/_A4_feuille_/);
    expect(dans(m, '[data-chemin-controle]')).toBeNull();

    choisirReglage(m, 'modeleBadge', 'avery5392');
    await attendre('l’imposition cachée', () => champ(m, 'imposition') === null, IMAGES);
    expect(dans(m, '[data-section="badges"] [data-papier]')).toBeNull();
    expect(JSON.parse(m.fs.contenu('documents', FICHIER_REGLAGES)).papier).toBe('A4');
  });

  test('sous web, les deux fichiers se téléchargent et se nomment', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: null, modeleBadge: null, options: { systeme: { nature: 'web' } } });
    const telechargees = [];
    m.fs.enregistrerSous = async (nom) => {
      telechargees.push(nom);
      return null;
    };
    await cliquerProduire(m, 'les deux téléchargements', () => dans(m, '[data-chemin-controle]'));
    expect(telechargees).toHaveLength(2);
    expect(texte(dans(m, '[data-chemin-planche]'))).toBe(plat(t('badges.produite.telechargee', { nom: telechargees[0] })));
    expect(texte(dans(m, '[data-chemin-controle]'))).toBe(plat(t('badges.produite.controleTelechargee', { nom: telechargees[1] })));
  });
});

describe('le modèle de badge que le poste ne retient pas (§ 8.5)', () => {
  test('l’écriture des réglages refusée : le choix vaut pour la séance, et une annonce le dit près du sélecteur, dans un rôle d’état ; un choix retenu ensuite la retire', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: 'A4', modeleBadge: null });
    expect(dans(m, '[data-section="badges"] [data-avertissement="modeleNonRetenu"]')).toBeNull();
    m.fs.pannes.ecriture('documents');
    choisirReglage(m, 'modeleBadge', 'a6');
    const avis = await attendre('l’annonce du choix non retenu', () => dans(m, '[data-section="badges"] [data-avertissement="modeleNonRetenu"]'), IMAGES);
    expect(m.seance.etat().modeleBadge).toBe('a6');
    expect(texte(avis)).toBe(plat(t('badges.modele.nonRetenu')));
    expect(avis.closest('[role="status"]')).not.toBeNull();
    const reglage = dans(m, '[data-section="badges"] [data-champ="modeleBadge"]').closest('.reglages');
    expect(reglage.parentElement.contains(avis)).toBe(true);
    // Un choix que le poste retient retire l'annonce : la séance le dit
    // retenu, l'écriture refusée mise à part.
    const originale = m.seance.choisirModeleBadge;
    m.seance.choisirModeleBadge = async (modele) => ({ ...(await originale(modele)), retenu: true });
    choisirReglage(m, 'modeleBadge', 'avery5392');
    await attendre('l’annonce retirée', () => dans(m, '[data-section="badges"] [data-avertissement="modeleNonRetenu"]') === null, IMAGES);
  });
});

describe('« Enregistrer sous… » d’Avery 5392 : les deux chemins (§ 11.6)', () => {
  test('les cartes refusées d’écriture : le remède ouvre deux dialogues, et la section nomme les deux chemins choisis', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: null, modeleBadge: null });
    m.fs.pannes.ecriture('documents');
    const proposes = [];
    m.fs.enregistrerSous = async (nom) => {
      proposes.push(nom);
      return `D:\\ailleurs\\${nom}`;
    };
    await cliquerProduire(m, 'le refus d’écriture', () => dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    dans(m, '[data-refus="PLANCHE_NON_ECRITE"] [data-commande="enregistrerSous"]').click();
    await attendre('les deux chemins', () => dans(m, '[data-chemin-planche]') && dans(m, '[data-chemin-controle]'), IMAGES);
    expect(proposes).toHaveLength(2);
    expect(proposes[0]).toMatch(/\.badges_avery5392_.*\.pdf$/);
    expect(proposes[1]).toMatch(/\.controle_avery5392_.*\.pdf$/);
    expect(texte(dans(m, '[data-chemin-planche]'))).toBe(`D:\\ailleurs\\${proposes[0]}`);
    expect(texte(dans(m, '[data-chemin-controle]'))).toBe(`D:\\ailleurs\\${proposes[1]}`);
  });

  test('la feuille de contrôle refusée d’écriture au second dialogue : le refus nomme la feuille de contrôle, et le chemin des cartes écrites reste montré', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: null, modeleBadge: null });
    m.fs.pannes.ecriture('documents');
    const proposes = [];
    m.fs.enregistrerSous = async (nom) => {
      proposes.push(nom);
      if (proposes.length === 2) throw new ErreurStockage('ECRITURE', { chemin: 'D:\\ailleurs\\feuille.pdf', dossier: 'D:\\ailleurs', cause: 'ENOSPC' });
      return `D:\\ailleurs\\${nom}`;
    };
    await cliquerProduire(m, 'le refus d’écriture', () => dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    dans(m, '[data-refus="PLANCHE_NON_ECRITE"] [data-commande="enregistrerSous"]').click();
    const refusDuRemede = await attendre('le refus du remède', () => dans(m, '[data-refus="PLANCHE_NON_ECRITE"] [data-refus="PLANCHE_NON_ECRITE"]'), IMAGES);
    expect(proposes).toHaveLength(2);
    const cartes = `D:\\ailleurs\\${proposes[0]}`;
    const lu = texte(refusDuRemede);
    expect(lu).toContain('La feuille de contrôle');
    expect(lu).toContain('D:\\ailleurs\\feuille.pdf');
    expect(lu).toContain(cartes);
    expect(texte(dans(m, '[data-chemin-planche]'))).toBe(cartes);
    expect(dans(m, '[data-chemin-controle]')).toBeNull();
  });

  test('la feuille de contrôle seule refusée à « Produire » : le refus la nomme, et le chemin des cartes écrites se montre', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { papier: null, modeleBadge: null });
    const ecrire = m.fs.ecrireOctetsAtomique.bind(m.fs);
    m.fs.ecrireOctetsAtomique = async (racine, chemin, octets) => {
      if (/\.controle_/.test(chemin)) throw new ErreurStockage('ECRITURE', { chemin, dossier: 'D:\\documents', cause: 'ENOSPC' });
      return ecrire(racine, chemin, octets);
    };
    await cliquerProduire(m, 'le refus d’écriture', () => dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    const lu = texte(dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'));
    expect(lu).toContain('La feuille de contrôle');
    const cartes = await attendre('le chemin des cartes', () => dans(m, '[data-chemin-planche]'), IMAGES);
    expect(texte(cartes)).toMatch(/\.badges_avery5392_.*\.pdf$/);
    expect(lu).toContain(texte(cartes));
    expect(dans(m, '[data-chemin-controle]')).toBeNull();
  });
});

describe('la liste des badges en CSV (§ 11.6)', () => {
  // La principale bloquée, sa première table libellée.
  function chargeLibellee() {
    const charge = structuredClone(chargeBloquee());
    charge.tables[0].libelle = 'Terrasse';
    return charge;
  }

  test('« Produire la liste (CSV) » dépose la liste à côté de l’événement, en lecture, et nomme son chemin ; ni l’état ni le journal ne s’écrivent', async () => {
    const charge = chargeLibellee();
    const m = await ouvrirBadges(charge);
    expect(m.seance.mode).toBe('lecture');
    expect(texte(produireListe(m))).toBe(plat(t('badges.commande.produireListe')));
    expect(texte(produire(m))).toBe(plat(t('badges.commande.produire')));
    const depuis = m.trace.length;
    produireListe(m).click();
    await attendre('la liste', () => dans(m, '[data-chemin-liste]'), IMAGES);
    const ecrites = planchesEcrites(m, depuis).map(([, , nom]) => nom);
    expect(ecrites).toHaveLength(1);
    // Un plan bloqué : la liste ne porte pas BROUILLON.
    expect(ecrites[0]).toMatch(/\.badges_[^.]+\.csv$/);
    expect(ecrites[0]).not.toContain('BROUILLON');
    expect(texte(dans(m, '[data-chemin-liste]'))).toBe(await cheminDocuments(m, ecrites[0]));
    const contenu = texteFichier(m, ecrites[0]);
    expect(contenu.startsWith('\u{FEFF}Nom;Prénom;Organisation;Tours\r\n')).toBe(true);
    expect(contenu).toContain(`table ${charge.tables[0].numero} (Terrasse)`);
    const presents = charge.participants.filter(({ exclu }) => !exclu).length;
    expect(contenu.split('\r\n').filter((ligne) => /^[^"]*;/.test(ligne)).length).toBeGreaterThanOrEqual(presents);
    expect(ecrituresEvenement(m, depuis)).toEqual([]);
    expect(dans(m, '[data-chemin-planche]')).toBeNull();
  });

  test('la liste suit les réglages de la section : la proposition montrée au plan et l’ordre par table, dans le nom — « -p<k> », « _table », « _BROUILLON » — et dans l’ordre des lignes', async () => {
    const m = await ouvrirBadges(chargePrincipale());
    const charge = m.seance.etat().charge;
    expect(charge.retenu).toBeNull();
    const k = charge.propositions[0].id;
    m.ui.montrerProposition(k);
    await attendre('une image', () => true);
    choisirReglage(m, 'ordre', 'table');
    const depuis = m.trace.length;
    produireListe(m).click();
    await attendre('la liste ou un refus', () => dans(m, '[data-chemin-liste]') ?? dans(m, '[data-section="badges"] [data-refus]'), IMAGES);
    expect(dans(m, '[data-section="badges"] [data-refus]')).toBeNull();
    const ecrites = planchesEcrites(m, depuis).map(([, , nom]) => nom);
    expect(ecrites).toHaveLength(1);
    expect(ecrites[0]).toContain(`.badges-p${k}_table_BROUILLON_`);
    // Les lignes : celles de la proposition dans l'ordre par table, qui
    // n'est pas l'ordre alphabétique pour cette charge.
    const attendue = (ordre) =>
      new TextDecoder('utf-8', { ignoreBOM: true }).decode(
        listeBadges(modelePlanche(charge, { source: 'proposition', proposition: k, ordre, provenance: 'épreuve', version: VERSION.affichee }), charge),
      );
    expect(attendue('table')).not.toBe(attendue('alphabetique'));
    expect(texteFichier(m, ecrites[0])).toBe(attendue('table'));
  });

  test('une dérive annoncée bloque la liste comme la planche, expliqué ; un nom trop long pour son badge ne bloque que la planche', async () => {
    const enDerive = await ouvrirBadges(chargeEnDerive().charge);
    dans(enDerive, '[data-section="badges"] [data-commande="preparerPlanche"]').click();
    await attendre('le refus de dérive', () => dans(enDerive, '[data-annonce-planche] [data-refus="PLANCHE_DERIVE"]'), IMAGES);
    expect(produireListe(enDerive).getAttribute('aria-disabled')).toBe('true');
    const explication = dans(enDerive, `#${produireListe(enDerive).getAttribute('aria-describedby')}`);
    expect(texte(explication)).toBe(plat(t('badges.liste.bloquee')));

    const charge = structuredClone(chargeBloquee());
    charge.participants[0].nom = `Ombrelle${'w'.repeat(1990)}`;
    const m = await ouvrirBadges(charge);
    await cliquerProduire(m, 'le refus du nom', () => dans(m, '[data-annonce-planche] [data-refus="PLANCHE_NOM_TROP_LONG"]'));
    expect(produire(m).getAttribute('aria-disabled')).toBe('true');
    expect(produireListe(m).getAttribute('aria-disabled')).toBeNull();
    const depuis = m.trace.length;
    produireListe(m).click();
    await attendre('la liste', () => dans(m, '[data-chemin-liste]'), IMAGES);
    expect(planchesEcrites(m, depuis)).toHaveLength(1);
  });

  test('une écriture refusée : PLANCHE_NON_ECRITE nomme la liste à côté de sa commande, remède « Enregistrer sous… », dont le chemin choisi s’affiche', async () => {
    const m = await ouvrirBadges(chargeLibellee());
    m.fs.pannes.ecriture('documents');
    const proposes = [];
    m.fs.enregistrerSous = async (nom, octets) => {
      proposes.push({ nom, debut: new TextDecoder('utf-8', { ignoreBOM: true }).decode(octets).slice(0, 4) });
      return 'D:\\ailleurs\\liste.csv';
    };
    produireListe(m).click();
    const refus = await attendre('le refus d’écriture', () => dans(m, '[data-section="badges"] [data-refus="PLANCHE_NON_ECRITE"]'), IMAGES);
    expect(texte(refus)).toContain('La liste des badges');
    dans(m, '[data-refus="PLANCHE_NON_ECRITE"] [data-commande="enregistrerSous"]').click();
    const chemin = await attendre('le chemin choisi', () => dans(m, '[data-chemin-liste]'), IMAGES);
    expect(texte(chemin)).toBe('D:\\ailleurs\\liste.csv');
    expect(proposes).toEqual([{ nom: expect.stringMatching(/\.csv$/), debut: '\u{FEFF}Nom' }]);
    expect(dans(m, '[data-chemin-planche]')).toBeNull();
  });

  test('sous web, la liste se télécharge et se nomme', async () => {
    const m = await ouvrirBadges(chargeBloquee(), { options: { systeme: { nature: 'web' } } });
    const telechargees = [];
    m.fs.enregistrerSous = async (nom) => {
      telechargees.push(nom);
      return null;
    };
    produireListe(m).click();
    await attendre('la liste téléchargée', () => dans(m, '[data-chemin-liste]'), IMAGES);
    expect(telechargees).toHaveLength(1);
    expect(telechargees[0]).toMatch(/\.csv$/);
    expect(texte(dans(m, '[data-chemin-liste]'))).toBe(plat(t('badges.produite.listeTelechargee', { nom: telechargees[0] })));
  });
});
