// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Point d'entrée de la page : le seul module de src/ qui choisit la
// plateforme (§ 13.4). Sous la coquille Electron, le préchargement expose
// window.gtt — le système de fichiers du processus principal, la copie
// dans le presse-papiers et l'impression ; sans lui, la page est la
// plateforme web, sur l'OPFS, le presse-papiers et la boîte d'impression
// du navigateur. L'imprimante (src/impression), frontière de plateforme
// comme le système de fichiers, ne s'importe que d'ici. Il construit les
// dépendances d'App — l'horloge du système, l'exécuteur de la génération sur
// le travailleur, les identifiants tirés par crypto.randomUUID, les
// démonstrations livrées nommées par le catalogue, le chargement de la
// police embarquée, l'imprimante, le chargement de la section de la
// qualité — et monte App dans le corps du document. Le thème de départ est
// laissé à App, qui lit la préférence du système.
//
// Il est le seul module qui importe le travailleur de génération, par
// « ?worker&inline » : Vite l'inclut dans la page, que la coquille charge
// par file://, sans fichier de travailleur à côté. Chaque génération fait
// naître un groupe de travailleurs neufs, un par cœur employé, que
// l'exécuteur termine à son issue (§ 5.10). Il est aussi le seul à lire le
// nombre de processeurs logiques du poste, navigator.hardwareConcurrency,
// hyperthreads compris : l'exécuteur l'annonce au contrôleur, qui en fait
// la valeur des cœurs automatiques ; une épreuve donne le sien à
// l'exécuteur qu'elle monte.
//
// La police embarquée (src/polices) n'est importée que d'ici et du montage
// des épreuves : App reçoit chargerPolices, dont les deux import() différés
// ne chargent les graisses qu'à la première production qui les demande.
// La même police est celle de l'interface, que jetons.css déclare : App ne
// se monte qu'une fois ses deux faces chargées (attendrePolices), sans quoi
// un mesureur de texte créé au premier rendu lirait la police de repli et
// garderait sa largeur. Une face qui ne se charge pas ne retient pas
// l'application : l'erreur va au collecteur (reportError), et App se monte
// sur les replis du système.
//
// La section de la qualité forme son propre morceau dans la construction,
// que la page ne télécharge qu'à la première ouverture de la section :
// chargerSectionQualite l'importe par un import différé et rend son
// composant. L'interface ne charge aucun module elle-même ; App reçoit
// cette fonction, et le montage des épreuves lui en passe une qui rend le
// composant importé d'emblée.
import { mount } from 'svelte';
import { creerExecuteurTravailleur } from './application/executeur_travailleur.js';
import { creerHorlogeSysteme } from './application/horloge.js';
import { demonstrationsLivrees } from './demo/livrees.js';
import { creerImprimanteElectron } from './impression/imprimante_electron.js';
import { creerImprimanteWeb } from './impression/imprimante_web.js';
import App from './interface/App.svelte';
import Travailleur from './interface/generation/travailleur.js?worker&inline';
import { attendrePolices, chargerPolices } from './polices/chargement.js';
import { FORMAT } from './stockage/document.js';
import { creerFichiersElectron } from './stockage/fichiers_electron.js';
import { creerFichiersWeb } from './stockage/fichiers_web.js';
import { VERSION } from './version.genere.js';

const pont = window.gtt;
const sousElectron = pont !== undefined;

const fs = sousElectron ? creerFichiersElectron(pont.fichiers) : creerFichiersWeb();
const pressePapiers = sousElectron
  ? { copier: async (texte) => void (await pont.copier(texte)) }
  : { copier: (texte) => navigator.clipboard.writeText(texte) };
const imprimante = sousElectron ? creerImprimanteElectron(pont) : creerImprimanteWeb(window);
const chargerSectionQualite = async () => (await import('./interface/qualite/SectionQualite.svelte')).default;

try {
  await attendrePolices(document);
} catch (erreur) {
  reportError(erreur);
}

mount(App, {
  target: document.body,
  props: {
    fs,
    horloge: creerHorlogeSysteme(),
    executeur: creerExecuteurTravailleur(() => new Travailleur(), {
      coeursDisponibles: navigator.hardwareConcurrency,
    }),
    pressePapiers,
    identifiant: () => crypto.randomUUID(),
    langue: 'fr',
    provenance: import.meta.env.MODE,
    demonstrations: demonstrationsLivrees(),
    formatCourant: FORMAT,
    produitVersion: VERSION.affichee,
    polices: chargerPolices,
    imprimante,
    sectionQualite: chargerSectionQualite,
  },
});
