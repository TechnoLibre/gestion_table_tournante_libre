// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Point d'entrée de la page : le seul module de src/ qui choisit la
// plateforme (§ 13.4). Sous la coquille Electron, le préchargement expose
// window.gtt — le système de fichiers du processus principal et la copie
// dans le presse-papiers ; sans lui, la page est la plateforme web, sur
// l'OPFS et le presse-papiers du navigateur. Il construit les dépendances
// d'App — l'horloge du système, l'exécuteur de la génération sur le
// travailleur, les identifiants tirés par crypto.randomUUID, les
// démonstrations livrées nommées par le catalogue — et monte App dans le
// corps du document. Le thème de départ est laissé à App, qui lit la
// préférence du système.
//
// Il est le seul module qui importe le travailleur de génération, par
// « ?worker&inline » : Vite l'inclut dans la page, que la coquille charge
// par file://, sans fichier de travailleur à côté. Chaque génération en
// prend un neuf, que l'exécuteur termine à son issue (§ 5.10).
import { mount } from 'svelte';
import { creerExecuteurTravailleur } from './application/executeur_travailleur.js';
import { creerHorlogeSysteme } from './application/horloge.js';
import { CATALOGUE } from './demo/catalogue.js';
import { LIVREES } from './demo/livrees.js';
import App from './interface/App.svelte';
import Travailleur from './interface/generation/travailleur.js?worker&inline';
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

// Chaque démonstration livrée, nommée par l'entrée de même clé du catalogue,
// dans l'ordre du catalogue.
const demonstrations = LIVREES.map(({ cle, texte }) => ({
  cle,
  nom: CATALOGUE.find((entree) => entree.cle === cle).nom,
  texte,
}));

mount(App, {
  target: document.body,
  props: {
    fs,
    horloge: creerHorlogeSysteme(),
    executeur: creerExecuteurTravailleur(() => new Travailleur()),
    pressePapiers,
    identifiant: () => crypto.randomUUID(),
    langue: 'fr',
    provenance: import.meta.env.MODE,
    demonstrations,
    formatCourant: FORMAT,
    produitVersion: VERSION.affichee,
  },
});
