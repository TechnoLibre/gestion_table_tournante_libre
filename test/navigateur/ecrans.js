// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Les écrans de l'itération, chacun atteint depuis le premier écran de
// l'application montée sur le système simulé (§ 14.5, § 14.6, § 19.11). Un
// écran est { nom, mode, atteindre(contexte) } : atteindre monte App par le
// contexte, pose sur le disque simulé le fichier d'état qu'il lui faut, puis
// mène l'application jusqu'à l'écran par les gestes de l'opérateur — le clic
// d'un bouton désigné par son attribut data-…, une entrée réelle de
// test/navigateur/entrees.js sur le plan, une touche — et rend l'élément qui
// porte l'écran entier, bandeau compris : le conteneur du montage. mode dit
// ce que le bandeau et le cadre en annoncent : null sans événement ouvert,
// 'lecture', 'ecriture' ou 'bloque' sinon.
//
// Aucun délai fixe (§ 19.3) : chaque étape attend une condition du document,
// image après image, et lève en la nommant quand elle ne vient pas. Les
// données sont tirées des démonstrations livrées et de commandes de
// l'application, sans aléa : deux parcours rendent le même écran.
//
// Un état s'atteint sans geste de l'opérateur : la question du dossier de
// travail, qui se pose au démarrage, par les options du système simulé.
import { flushSync } from 'svelte';
import { appliquerCommande } from '../../src/application/commandes.js';
import { ErreurAnnulee } from '../../src/application/generation.js';
import { texteLivre } from '../../src/demo/livrees.js';
import { rechercher } from '../../src/moteur/recherche.js';
import { serialiser } from '../../src/stockage/canonique.js';
import { analyser, configurationDepuisCharge } from '../../src/stockage/document.js';
import { SUFFIXES } from '../../src/stockage/noms.js';
import { VERSION } from '../../src/version.genere.js';
import urlCasLimites from '../../exemples/participants_cas_limites.csv?url';
import { pointer, touche } from './entrees.js';
import { monterApp } from './montage.js';

/** La base du fichier d'état de chaque événement d'épreuve. */
export const BASE = 'soiree';

/** Le nom du CSV des cas limites que sert le dialogue d'import. */
export const NOM_CAS_LIMITES = 'participants_cas_limites.csv';

/** Les sections d'un événement, dans l'ordre de la navigation. */
export const SECTIONS_EVENEMENT = Object.freeze(['import', 'participants', 'tables', 'plan', 'diagnostic', 'generation', 'propositions']);

// L'exécutable publié du système simulé : son dossier data/ refuse
// l'écriture, et la question du dossier de travail se pose au démarrage.
const PUBLIE = 'E:\\soirees-epreuve';

// Images attendues au plus pour qu'une condition se réalise : bien au-delà
// d'un rendu, d'une écriture simulée et d'une génération de la petite
// démonstration.
const IMAGES_MAX = 900;

// --- L'attente et les gestes -------------------------------------------------

const uneImage = () => new Promise((resoudre) => requestAnimationFrame(resoudre));

/** Attend, image après image, que condition() rende une valeur vraie sans
 *  lever, et la rend ; lève en nommant quoi après IMAGES_MAX images. */
export async function attendre(quoi, condition) {
  let derniere = null;
  for (let image = 0; image < IMAGES_MAX; image += 1) {
    flushSync();
    try {
      const valeur = condition();
      if (valeur) return valeur;
    } catch (erreur) {
      derniere = erreur;
    }
    await uneImage();
  }
  throw new Error(`écran : ${quoi} ne vient pas${derniere === null ? '' : ` (${derniere.message})`}`);
}

// Le premier élément du montage qu'atteint le sélecteur, attendu.
const element = (m, selecteur) => attendre(selecteur, () => m.racine.querySelector(selecteur));

/** Clique le bouton du montage que désigne le sélecteur, une fois présent,
 *  par son clic HTML, puis laisse le rendu suivre. */
export async function cliquer(m, selecteur) {
  const bouton = await element(m, selecteur);
  bouton.click();
  flushSync();
  await uneImage();
  return bouton;
}

/** Le centre de la boîte d'un élément, en coordonnées de la fenêtre, une
 *  fois l'élément amené dans la fenêtre. */
export async function centre(cible) {
  const dedans = () => {
    const b = cible.getBoundingClientRect();
    return b.width > 0 && b.left >= 0 && b.top >= 0 && b.right <= innerWidth && b.bottom <= innerHeight;
  };
  if (!dedans()) {
    cible.scrollIntoView({ block: 'center', inline: 'center' });
    await attendre('l’élément dans la fenêtre', dedans);
  }
  const b = cible.getBoundingClientRect();
  return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
}

// Le plateau d'une table, qu'il signale un conflit ou non.
const plateau = (m, table) =>
  m.racine.querySelector(`[data-table="${table}"] [data-marque="contourTable"], [data-table="${table}"] [data-marque="contourConflit"]`);
const chaise = (m, table, siege) => m.racine.querySelector(`[data-siege="${table}:${siege}"]`);

// Un appui relâché sur place, au centre d'un élément : un clic de pointeur
// réel, sous le seuil de glissement.
async function cliquerPointeur(cible) {
  const { x, y } = await centre(cible);
  await pointer('presser', x, y);
  await pointer('relacher', x, y);
  flushSync();
  await uneImage();
}

// --- Les événements d'épreuve -----------------------------------------------

const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;
const demonstration = (cle) => analyser(texteLivre(cle)).charge;

/**
 * La petite démonstration, variante conflit, avec une désignation (la
 * personne 1, « hôte », à la table 1, siège 1), une réservation d'un tour (la
 * personne 2 à la table 2, siège 2, au tour 1), un titre non pourvu
 * (« animateur », table 3, siège 3) et une proposition, tirée de la graine 2
 * : au tour 1, les tables 1 et 2 sont en conflit, les tables 3 et 4 saines.
 */
export function chargePrincipale() {
  let charge = demonstration('petite-conflit');
  charge = executer(charge, 'designer', { participant: 1, table: 1, siege: 1, libelle: 'hôte' });
  charge = executer(charge, 'reserver', { participant: 2, table: 2, siege: 2, portee: 'tour', tour: 1 });
  charge = executer(charge, 'poserTitre', { table: 3, siege: 3, libelle: 'animateur' });
  const configuration = configurationDepuisCharge(charge);
  const propositions = rechercher(configuration, { graine: 2, nombre: 1, arret: 300, historique: 1000 });
  return appliquerCommande('enregistrerGeneration', charge, { propositions, configuration, produitVersion: VERSION.affichee }).charge;
}

// La principale, sa proposition retenue, puis le plan bloqué.
function chargeBloquee() {
  const principale = chargePrincipale();
  const charge = executer(principale, 'retenirProposition', { id: principale.propositions[0].id });
  return executer(charge, 'changerEtat', { etat: 'bloque' });
}

// La principale, sa proposition retenue, puis une personne ajoutée : le
// retenu ne la place pas, et l'ouverture avertit de la dérive.
function chargeEnDerive() {
  const principale = chargePrincipale();
  const charge = executer(principale, 'retenirProposition', { id: principale.propositions[0].id });
  return executer(charge, 'ajouterParticipant', { champs: { nom: 'Ombrelle', prenom: 'Iris' } });
}

// La petite démonstration, la table 4 réservée en entier pour tous les
// tours : elle est gelée.
function chargeGelee() {
  let charge = demonstration('petite');
  for (const participant of [1, 2, 3]) {
    charge = executer(charge, 'reserver', { participant, table: 4, siege: participant, portee: 'tous', tour: null });
  }
  return charge;
}

/** Le fichier d'état d'une charge, posé dans les Documents sous BASE. */
export const fichierEtat = (charge, base = BASE) => ({
  racine: 'documents',
  chemin: `${base}${SUFFIXES.etat}`,
  texte: serialiser(charge, { revision: 1, produitVersion: VERSION.affichee }),
});

/** Les octets du CSV des cas limites, tels que le fichier les porte. */
export async function octetsCasLimites() {
  return new Uint8Array(await (await fetch(urlCasLimites)).arrayBuffer());
}

/**
 * Un exécuteur de génération que l'épreuve ne résout pas : la génération
 * reste en cours tant que le montage vit ; annuler la rejette par
 * ErreurAnnulee.
 */
export function executeurSuspendu() {
  return {
    lancer() {
      let rejeter;
      const resultat = new Promise((_, ko) => {
        rejeter = ko;
      });
      return {
        surAvancement: () => () => {},
        resultat,
        annuler() {
          rejeter(new ErreurAnnulee());
        },
      };
    },
  };
}

// --- Les parcours -------------------------------------------------------------

/**
 * Monte App sur la charge, ouvre l'événement depuis la liste, passe en
 * écriture si demandé, montre la première proposition au plan quand la
 * charge n'a pas de retenu, puis ouvre la section. Rend le montage.
 *
 * @param {Object} contexte   celui de creerContexte
 * @param {Object} charge
 * @param {{ecriture?: boolean, section?: string, options?: Object}} [reglages]
 *   options : celles de monterApp, ses fichiers ajoutés à celui de la charge
 */
export async function ouvrirEvenement(contexte, charge, { ecriture = false, section = 'plan', options = {} } = {}) {
  const m = await contexte.monter({ ...options, fichiers: [fichierEtat(charge), ...(options.fichiers ?? [])] });
  await cliquer(m, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
  await element(m, '[data-ecran="evenement"]');
  if (ecriture) {
    await cliquer(m, '[data-place-fixe] [data-commande="modifier"]');
    await element(m, '[data-place-fixe] [data-commande="lecture"]');
  }
  if (charge.retenu === null && charge.propositions.length > 0) {
    await cliquer(m, '[data-commande="section"][data-cible="propositions"]');
    await cliquer(m, `[data-proposition="${charge.propositions[0].id}"] [data-commande="voir"]`);
    await element(m, '[data-section="plan"]');
  }
  await cliquer(m, `[data-commande="section"][data-cible="${section}"]`);
  await element(m, `[data-section="${section}"]`);
  if (section === 'plan') {
    await attendre('le plan posé', () => {
      const vue = m.racine.querySelector('[data-vue]');
      return vue?.getAttribute('transform') && m.racine.querySelectorAll('[data-table]').length === charge.tables.length;
    });
  }
  return m;
}

// Un écran d'événement sur la principale, sur la section donnée, au mode
// donné ; la bloquée pour 'bloque'.
function ecranDeSection(section, mode) {
  return {
    nom: `evenement.${section}.${mode}`,
    mode,
    async atteindre(contexte) {
      const charge = mode === 'bloque' ? chargeBloquee() : chargePrincipale();
      const m = await ouvrirEvenement(contexte, charge, { ecriture: mode === 'ecriture', section });
      return m.racine;
    },
  };
}

// La principale en écriture, sur le plan.
const planEnEcriture = (contexte, options) => ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'plan', options });

/**
 * Le contexte d'un parcours : il monte App dans la langue et le thème
 * donnés, garde chaque montage et chaque nettoyage, et défait tout par
 * defaire(), les nettoyages d'abord, dans l'ordre inverse.
 *
 * @param {{langue?: 'fr'|'temoin', theme?: 'clair'|'sombre'}} [reglages]
 */
export function creerContexte({ langue = 'fr', theme = 'clair' } = {}) {
  const montages = [];
  const nettoyages = [];
  return {
    langue,
    montages,
    /** Le dernier montage : celui que l'écran montre. */
    get montage() {
      return montages.at(-1) ?? null;
    },
    async monter(options = {}) {
      const m = await monterApp({ langue, theme, ...options });
      montages.push(m);
      return m;
    },
    nettoyer(fn) {
      nettoyages.push(fn);
    },
    /** Ce que le collecteur a reçu depuis chaque montage. */
    erreurs() {
      return montages.flatMap((m) => m.erreurs());
    },
    async defaire() {
      for (const fn of nettoyages.splice(0).reverse()) await fn();
      for (const m of montages.splice(0).reverse()) m.demonter();
      window.scrollTo(0, 0);
    },
  };
}

/** Les écrans de l'itération. Leur union rend chaque sorte de MARQUES. */
export const ECRANS = Object.freeze([
  {
    nom: 'accueil.liste',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter({ fichiers: [fichierEtat(chargePrincipale()), fichierEtat(chargeGelee(), 'gelee')] });
      await element(m, `[data-evenement="${BASE}"]`);
      return m.racine;
    },
  },
  {
    nom: 'accueil.vide',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter();
      await element(m, '[data-ecran="accueil"] [data-dossier-travail]');
      return m.racine;
    },
  },
  {
    nom: 'apropos',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter();
      await cliquer(m, '[data-bandeau] [data-commande="apropos"]');
      await element(m, '[data-ecran="apropos"]');
      return m.racine;
    },
  },
  {
    nom: 'recuperation',
    mode: null,
    async atteindre(contexte) {
      const sain = fichierEtat(chargePrincipale());
      const tronque = { ...sain, texte: sain.texte.slice(0, Math.floor(sain.texte.length / 2)) };
      const precedent = { ...sain, chemin: `${BASE}${SUFFIXES.precedent}` };
      const m = await contexte.monter({ fichiers: [tronque, precedent] });
      await cliquer(m, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
      await element(m, '[data-ecran="recuperation"]');
      return m.racine;
    },
  },
  {
    nom: 'dossier.question',
    mode: null,
    async atteindre(contexte) {
      const m = await contexte.monter({
        systeme: { executable: PUBLIE, sonde: { portable: 'EACCES' } },
        fichiers: [{ ...fichierEtat(chargePrincipale()), racine: 'portable' }],
      });
      await element(m, '[data-question]');
      return m.racine;
    },
  },
  ...SECTIONS_EVENEMENT.flatMap((section) => ['lecture', 'ecriture', 'bloque'].map((mode) => ecranDeSection(section, mode))),
  {
    nom: 'plan.tableGelee',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargeGelee(), { ecriture: true, section: 'plan' });
      await element(m, '[data-table="4"] [data-marque="gel"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.miseEnEvidence',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(chaise(m, 4, 1));
      await cliquer(m, '[data-panneau="place"] [data-menu] [data-commande="mettreEnEvidence"]');
      await element(m, '[data-siege="4:1"] [data-marque="miseEnEvidence"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.focus',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      (await element(m, '[data-commande="pleinEcran"]')).focus();
      await touche('Tab');
      await element(m, '[data-plan] [data-marque="focus"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.panneauPlace',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(chaise(m, 3, 3));
      await element(m, '[data-panneau="place"]');
      await element(m, '[data-siege="3:3"] [data-marque="selection"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.menuPersonne',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(chaise(m, 4, 1));
      await element(m, '[data-panneau="place"] [data-menu]');
      return m.racine;
    },
  },
  {
    nom: 'plan.panneauTable',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      await cliquerPointeur(plateau(m, 3));
      await element(m, '[data-panneau="table"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.infobulle',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      const { x, y } = await centre(plateau(m, 1));
      await pointer('bouger', x, y);
      await attendre('l’infobulle', () => {
        const infobulle = m.racine.querySelector('[role="tooltip"]');
        return infobulle !== null && !infobulle.hidden && infobulle.getBoundingClientRect().width > 0;
      });
      return m.racine;
    },
  },
  {
    nom: 'plan.glissement',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      const depuis = await centre(chaise(m, 3, 2));
      const vers = await centre(chaise(m, 4, 2));
      await pointer('presser', depuis.x, depuis.y);
      contexte.nettoyer(async () => {
        await touche('Escape');
        await pointer('relacher', vers.x, vers.y);
      });
      for (let pas = 1; pas <= 10; pas += 1) {
        await pointer('bouger', depuis.x + ((vers.x - depuis.x) * pas) / 10, depuis.y + ((vers.y - depuis.y) * pas) / 10);
      }
      await element(m, '[data-fantome] [data-marque="fantome"]');
      return m.racine;
    },
  },
  {
    nom: 'plan.refusPlace',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await planEnEcriture(contexte);
      const depuis = await centre(chaise(m, 3, 1));
      const vers = await centre(chaise(m, 1, 1));
      await pointer('presser', depuis.x, depuis.y);
      for (let pas = 1; pas <= 10; pas += 1) {
        await pointer('bouger', depuis.x + ((vers.x - depuis.x) * pas) / 10, depuis.y + ((vers.y - depuis.y) * pas) / 10);
      }
      await pointer('relacher', vers.x, vers.y);
      await element(m, '[data-surface] [data-refus="PLACE_RESERVEE"]');
      return m.racine;
    },
  },
  {
    nom: 'participants.refusChamp',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-section="participants"] [data-commande="ajouter"]');
      await element(m, '[data-section="participants"] [data-refus="NOM_REQUIS"]');
      return m.racine;
    },
  },
  {
    nom: 'participants.fiche',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-participant="1"] [data-commande="fiche"]');
      await element(m, '[data-fiche="1"]');
      return m.racine;
    },
  },
  {
    nom: 'import.apercu',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'import' });
      const octets = await octetsCasLimites();
      m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
      await cliquer(m, '[data-commande="choisirFichier"]');
      await element(m, '[data-apercu] [data-refusees]');
      return m.racine;
    },
  },
  {
    nom: 'import.rapport',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'import' });
      const octets = await octetsCasLimites();
      m.fs.choisirFichierAImporter = async () => ({ nom: NOM_CAS_LIMITES, octets });
      await cliquer(m, '[data-commande="choisirFichier"]');
      await cliquer(m, '[data-apercu] [data-commande="importer"]');
      await attendre('le rapport, ou la confirmation du remplacement', () =>
        m.racine.querySelector('[data-rapport]') ?? m.racine.querySelector('dialog[open]'),
      );
      if (m.racine.querySelector('[data-rapport]') === null) await cliquer(m, 'dialog[open] [data-commande="confirmer"]');
      await element(m, '[data-rapport]');
      return m.racine;
    },
  },
  {
    nom: 'participants.confirmer',
    mode: 'ecriture',
    async atteindre(contexte) {
      // Supprimer une personne qui tient une réservation se confirme dans
      // une fenêtre, qui nomme la réservation.
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      await cliquer(m, '[data-participant="1"] [data-commande="supprimerParticipant"]');
      await element(m, 'dialog[open]');
      return m.racine;
    },
  },
  {
    nom: 'evenement.avertissements',
    mode: 'lecture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargeEnDerive(), { section: 'plan' });
      await element(m, '[data-ecran="evenement"] [data-avertissement]');
      return m.racine;
    },
  },
  {
    nom: 'generation.enCours',
    mode: 'ecriture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), {
        ecriture: true,
        section: 'generation',
        options: { executeur: executeurSuspendu() },
      });
      await cliquer(m, '[data-section="generation"] [data-commande="generer"]');
      await attendre('la génération lancée, ou sa question', () =>
        m.racine.querySelector('[data-avancement]') ?? m.racine.querySelector('[data-question="longue"]'),
      );
      if (m.racine.querySelector('[data-avancement]') === null) await cliquer(m, '[data-commande="confirmerGeneration"]');
      await element(m, '[data-avancement]');
      return m.racine;
    },
  },
  {
    nom: 'refus.modeLecture',
    mode: 'lecture',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargePrincipale(), { section: 'participants' });
      await cliquer(m, '[data-etat="brouillon"] [data-commande="etat"]');
      await element(m, '[data-refus="MODE_LECTURE"]');
      return m.racine;
    },
  },
  {
    nom: 'refus.bloque',
    mode: 'bloque',
    async atteindre(contexte) {
      const m = await ouvrirEvenement(contexte, chargeBloquee(), { section: 'participants' });
      await cliquer(m, '[data-etat="propose"] [data-commande="etat"]');
      await element(m, '[data-refus="LECTURE_SEULE"]');
      return m.racine;
    },
  },
  {
    nom: 'refus.verrou',
    mode: 'lecture',
    async atteindre(contexte) {
      const premier = await ouvrirEvenement(contexte, chargePrincipale(), { ecriture: true, section: 'participants' });
      premier.racine.hidden = true;
      const second = await contexte.monter({ systeme: { disque: premier.disque } });
      await cliquer(second, `[data-evenement="${BASE}"] [data-commande="ouvrir"]`);
      await element(second, '[data-ecran="evenement"]');
      await cliquer(second, '[data-place-fixe] [data-commande="modifier"]');
      await element(second, '[data-refus="VERROU_PRIS"]');
      return second.racine;
    },
  },
]);
