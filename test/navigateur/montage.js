// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le montage de l'application dans les épreuves du navigateur (§ 13.4,
// § 14.10) : App reçoit des plateformes d'épreuve par ses propriétés, comme
// src/main.js lui donne celles de la machine — le système de fichiers simulé
// de test/fichiers_simules.js, l'horloge pilotée, l'exécuteur direct de la
// génération, un presse-papiers qui enregistre, l'imprimante d'épreuve de
// test/imprimante_simulee.js, qui relève ce qu'on lui demande d'imprimer.
// Chaque montage vit dans son
// propre conteneur, ajouté au corps du document : deux montages simultanés
// ne partagent ni système, ni séance, ni identifiants.
//
// Le collecteur d'erreurs de la page (public/collecteur.js), que index.html
// charge avant le module d'entrée, ne l'est pas dans la page des épreuves :
// monterApp l'y installe, une fois par page, dans un <script> classique. Son
// texte se lit où le serveur de Vite sert le dossier public, à la racine :
// Vite refuse d'importer un script de public/, et l'importer par son chemin
// de fichier l'avertit à chaque série.
//
// Les démonstrations sont celles que src/main.js passe à App,
// demonstrationsLivrees() : une seule composition, celle de src/demo. La
// police est chargée comme src/main.js la charge, par chargerPolices : sous
// le serveur de Vite des épreuves, « ?inline » rend les mêmes octets que
// dans la construction. Comme src/main.js, monterApp attend les deux faces
// de la police d'interface (attendrePolices) avant de monter App : un
// mesureur de texte créé au premier rendu lit la police embarquée, non son
// repli. Une face qui ne se charge pas fait échouer le montage.
//
// La section de la qualité, que src/main.js charge par son propre morceau,
// est ici importée d'emblée : la fonction qu'App reçoit rend le composant
// tel quel, et la section se monte sans état de chargement, au rendu même
// qui l'ouvre. Une épreuve de ce chargement passe sa propre fonction, qui
// rend une promesse.
import { mount, unmount } from 'svelte';
import { creerExecuteurDirect } from '../../src/application/generation.js';
import { creerHorlogePilotee } from '../../src/application/horloge.js';
import { demonstrationsLivrees } from '../../src/demo/livrees.js';
import App from '../../src/interface/App.svelte';
import SectionQualite from '../../src/interface/qualite/SectionQualite.svelte';
import { attendrePolices, chargerPolices } from '../../src/polices/chargement.js';
import { FORMAT } from '../../src/stockage/document.js';
import { VERSION } from '../../src/version.genere.js';
import { creerFichiersSimules } from '../fichiers_simules.js';
import { creerImprimanteSimulee } from '../imprimante_simulee.js';

/** Les primitives que le système simulé compte comme écritures, celles que
 *  tracer relève. */
export const PRIMITIVES_TRACEES = Object.freeze([
  'sonder',
  'ecrireAtomique',
  'ecrireOctetsAtomique',
  'ajouterLigne',
  'creerDossier',
  'supprimerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
]);

// Le rang du dernier montage de la page : il préfixe les identifiants que
// tire chaque montage.
let montages = 0;

// Pose public/collecteur.js dans la page, une fois : un script classique
// inséré s'exécute aussitôt, dans le contexte de la page. Deux montages
// lancés ensemble attendent la même installation. Un collecteur que le
// serveur ne rend pas lève, en le nommant.
let installation = null;
function installerCollecteur() {
  if (globalThis.__gttErreurs !== undefined) return Promise.resolve();
  installation ??= (async () => {
    const reponse = await fetch('/collecteur.js');
    if (!reponse.ok) throw new Error(`collecteur.js : réponse ${reponse.status} du serveur des épreuves`);
    const script = document.createElement('script');
    script.textContent = await reponse.text();
    document.head.append(script);
    if (globalThis.__gttErreurs === undefined) throw new Error('collecteur.js : le script posé n’a pas installé __gttErreurs');
  })();
  return installation;
}

/** Enveloppe les dix primitives d'écriture du système simulé — sonder,
 *  ecrireAtomique, ecrireOctetsAtomique, ajouterLigne, creerDossier,
 *  supprimerDossier, deplacer, supprimer, verrouiller, deverrouiller — et
 *  rend leur relevé, dans l'ordre des appels :
 *  [primitive, racine.id, chemin], '' pour sonder, qui ne prend pas de chemin.
 *  Un appel se relève avant de s'exécuter, refusé ou non. */
export function tracer(fs) {
  const trace = [];
  for (const primitive of PRIMITIVES_TRACEES) {
    const originale = fs[primitive];
    fs[primitive] = (...parametres) => {
      const [racine, chemin] = parametres;
      trace.push([primitive, racine?.id, primitive === 'sonder' ? '' : chemin]);
      return Reflect.apply(originale, fs, parametres);
    };
  }
  return trace;
}

/**
 * Monte App dans un conteneur neuf, ajouté au corps du document, sur des
 * dépendances d'épreuve, et se résout quand app.pret l'est.
 *
 * @param {Object} [options]
 * @param {Object} [options.systeme]   les options de creerFichiersSimules —
 *        disque, executable, documents, nature, sonde, support, hote… ; le
 *        disque d'un montage précédent fait de ce montage un second processus
 * @param {Array<{racine: 'documents'|'portable', chemin: string, texte: string}>} [options.fichiers]
 *        posés avant le montage, sans compter
 * @param {Array<{nom: string, octets: Uint8Array}>} [options.aImporter]  ce que
 *        rend fs.choisirFichierAImporter, dans l'ordre, puis null, quelles
 *        que soient ses options — le genre 'image' du choix d'un logo
 *        compris ; choix relève les options de chaque appel
 * @param {Object} [options.horloge]   une horloge pilotée à partager ; sinon
 *        une neuve, au départ par défaut
 * @param {Object} [options.executeur] sinon l'exécuteur direct
 * @param {'fr'|'temoin'} [options.langue]
 * @param {'clair'|'sombre'|null} [options.theme]  le thème posé au montage,
 *        comme le réglage de l'opérateur ; null : celui de la préférence du
 *        système
 * @param {string} [options.provenance]
 * @param {number} [options.formatCourant]
 * @param {Array<{cle: string, nom: string, texte: string}>} [options.demonstrations]
 * @param {() => Promise<{regulier: Uint8Array, gras: Uint8Array}>} [options.polices]
 *        sinon chargerPolices, celui de src/main.js
 * @param {Object} [options.imprimante]  l'imprimante qu'App reçoit ; sinon
 *        une imprimante d'épreuve neuve, dont chaque impression est envoyée
 * @param {() => Function | PromiseLike<Function>} [options.sectionQualite]
 *        le chargement de la section de la qualité qu'App reçoit ; sinon une
 *        fonction qui rend le composant importé d'emblée
 * @returns {Promise<Object>} { app, racine, fs, disque, trace, choix,
 *   horloge, presse, polices, imprimante, seance, facade, ui, erreurs(),
 *   demonter() } — choix porte, dans l'ordre, les options reçues par
 *   chaque appel de fs.choisirFichierAImporter, null sans options ;
 *   polices est le chargement de la police qu'App a reçu, imprimante
 *   l'imprimante qu'il a reçue ; seance est un
 *   accesseur de app.seance() ; presse.copies, les textes copiés ;
 *   erreurs(), ce que le collecteur a reçu depuis ce montage ; demonter()
 *   démonte App, retire le conteneur et rend à <html> son data-theme d'avant
 */
export async function monterApp({
  systeme = {},
  fichiers = [],
  aImporter = [],
  horloge,
  executeur,
  langue = 'fr',
  theme = 'clair',
  provenance = 'test',
  formatCourant,
  demonstrations,
  polices = chargerPolices,
  imprimante = creerImprimanteSimulee(),
  sectionQualite = () => SectionQualite,
} = {}) {
  await installerCollecteur();
  await attendrePolices(document);
  montages += 1;
  const numero = montages;
  const premiereErreur = globalThis.__gttErreurs.length;

  const disque = systeme.disque ?? new Map();
  const fs = creerFichiersSimules({ ...systeme, disque });
  for (const { racine: id, chemin, texte } of fichiers) fs.deposer(id, chemin, texte);
  const enAttente = [...aImporter];
  const choix = [];
  fs.choisirFichierAImporter = async (options) => {
    choix.push(options ?? null);
    return enAttente.shift() ?? null;
  };
  const trace = tracer(fs);

  const horlogeMontage = horloge ?? creerHorlogePilotee();
  const copies = [];
  const presse = {
    copies,
    async copier(texte) {
      copies.push(texte);
    },
  };
  let tirages = 0;
  const identifiant = () => {
    tirages += 1;
    return `epreuve-${numero}-${tirages}`;
  };

  const racine = document.createElement('div');
  racine.dataset.montage = String(numero);
  document.body.append(racine);
  const racineDocument = document.documentElement;
  const themeAvant = racineDocument.getAttribute('data-theme');

  const app = mount(App, {
    target: racine,
    props: {
      fs,
      horloge: horlogeMontage,
      executeur: executeur ?? creerExecuteurDirect(),
      pressePapiers: presse,
      identifiant,
      langue,
      provenance,
      demonstrations: demonstrations ?? demonstrationsLivrees(),
      formatCourant: formatCourant ?? FORMAT,
      produitVersion: VERSION.affichee,
      polices,
      imprimante,
      sectionQualite,
      ...(theme === null ? {} : { themeInitial: theme }),
    },
  });
  await app.pret;

  return {
    app,
    racine,
    fs,
    disque,
    trace,
    choix,
    horloge: horlogeMontage,
    presse,
    polices,
    imprimante,
    get seance() {
      return app.seance();
    },
    facade: app.facade,
    ui: app.ui,
    erreurs: () => globalThis.__gttErreurs.slice(premiereErreur),
    demonter() {
      unmount(app);
      racine.remove();
      if (themeAvant === null) racineDocument.removeAttribute('data-theme');
      else racineDocument.setAttribute('data-theme', themeAvant);
    },
  };
}
