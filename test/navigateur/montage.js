// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le montage de l'application dans les épreuves du navigateur (§ 13.4,
// § 14.10) : App reçoit des plateformes d'épreuve par ses propriétés, comme
// src/main.js lui donne celles de la machine — le système de fichiers simulé
// de test/fichiers_simules.js, l'horloge pilotée, l'exécuteur direct de la
// génération, un presse-papiers qui enregistre. Chaque montage vit dans son
// propre conteneur, ajouté au corps du document : deux montages simultanés
// ne partagent ni système, ni séance, ni identifiants.
//
// Le collecteur d'erreurs de la page (public/collecteur.js), que index.html
// charge avant le module d'entrée, ne l'est pas dans la page des épreuves :
// monterApp l'y installe, une fois par page, dans un <script> classique.
import { mount, unmount } from 'svelte';
import { creerExecuteurDirect } from '../../src/application/generation.js';
import { creerHorlogePilotee } from '../../src/application/horloge.js';
import { CATALOGUE } from '../../src/demo/catalogue.js';
import { LIVREES } from '../../src/demo/livrees.js';
import App from '../../src/interface/App.svelte';
import { FORMAT } from '../../src/stockage/document.js';
import { VERSION } from '../../src/version.genere.js';
import COLLECTEUR from '../../public/collecteur.js?raw';
import { creerFichiersSimules } from '../fichiers_simules.js';

/** Les primitives que le système simulé compte comme écritures, celles que
 *  tracer relève. */
export const PRIMITIVES_TRACEES = Object.freeze([
  'sonder',
  'ecrireAtomique',
  'ajouterLigne',
  'creerDossier',
  'deplacer',
  'supprimer',
  'verrouiller',
  'deverrouiller',
]);

// Les démonstrations du contrat de données : LIVREES, chacune nommée par
// l'entrée de même clé du catalogue, dans l'ordre du catalogue.
const DEMONSTRATIONS = LIVREES.map(({ cle, texte }) => ({
  cle,
  nom: CATALOGUE.find((entree) => entree.cle === cle).nom,
  texte,
}));

// Le rang du dernier montage de la page : il préfixe les identifiants que
// tire chaque montage.
let montages = 0;

// Pose public/collecteur.js dans la page, une fois : un script classique
// inséré s'exécute aussitôt, dans le contexte de la page.
function installerCollecteur() {
  if (globalThis.__gttErreurs !== undefined) return;
  const script = document.createElement('script');
  script.textContent = COLLECTEUR;
  document.head.append(script);
}

/** Enveloppe les huit primitives d'écriture du système simulé — sonder,
 *  ecrireAtomique, ajouterLigne, creerDossier, deplacer, supprimer,
 *  verrouiller, deverrouiller — et rend leur relevé, dans l'ordre des appels :
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
 *        rend fs.choisirFichierAImporter, dans l'ordre, puis null
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
 * @returns {Promise<Object>} { app, racine, fs, disque, trace, horloge,
 *   presse, seance, facade, ui, erreurs(), demonter() } — seance est un
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
} = {}) {
  installerCollecteur();
  montages += 1;
  const numero = montages;
  const premiereErreur = globalThis.__gttErreurs.length;

  const disque = systeme.disque ?? new Map();
  const fs = creerFichiersSimules({ ...systeme, disque });
  for (const { racine: id, chemin, texte } of fichiers) fs.deposer(id, chemin, texte);
  const enAttente = [...aImporter];
  fs.choisirFichierAImporter = async () => enAttente.shift() ?? null;
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
      demonstrations: demonstrations ?? DEMONSTRATIONS,
      formatCourant: formatCourant ?? FORMAT,
      produitVersion: VERSION.affichee,
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
    horloge: horlogeMontage,
    presse,
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
