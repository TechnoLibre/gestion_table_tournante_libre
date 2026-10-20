// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le coût d'un enregistrement complet (§ 8.2, § 8.9, § 14.4) : la durée d'un
// geste qu'enregistrer (depot.js) écrit sur un vrai système de fichiers — le
// journal, le .precedent, l'état — pour la grande démonstration livrée
// portant vingt propositions, dont une retenue. Deux gestes se mesurent,
// chacun sous son seuil : le geste ordinaire, dont la ligne s'ajoute en fin
// de journal, et le geste dont l'entrée fait passer le journal au-delà de
// PLAFOND_ENTREES, qui le réécrit en entier, élagué. Le système de fichiers
// est celui de la plateforme electron : la page (fichiers_electron.js) devant
// les primitives de la coquille (electron/fichiers.js), sous un dossier
// temporaire neuf, retiré à la fin de l'épreuve ; seul l'IPC d'Electron y est
// remplacé, par une copie des arguments et des réponses. Chaque geste mesure
// aussi le temps qu'il attend la coquille, qui s'ajoute à son seuil.
//
// La charge mesurée se construit une fois pour le fichier (chargeMesuree) :
// le moteur produit ses vingt plans, et une épreuve affirme que l'analyse
// l'admet et que la forme canonique la réécrit telle quelle. Chaque geste
// mesuré retouche le placement retenu — deux personnes changent de table à
// un tour — sur une copie de travail de la charge de l'Ouvert
// (copieDeTravail), comme le font les commandes : ses propositions, figées,
// y restent les mêmes objets. Son entrée porte un correctif qui touche deux
// listes de table, ou l'instantané de la charge à la cadence du journal.
// Après chaque geste, hors de la mesure, l'Ouvert rendu garde ces
// propositions figées, et l'état et le .precedent sur le disque sont, octet
// pour octet, ceux que le geste écrit ; à la fin, le journal relu porte une
// entrée par révision et restitue la charge de révisions choisies : la durée
// retenue vient toujours d'un geste qui a écrit tout ce qu'écrit un
// enregistrement. Un geste qui n'écrirait plus les propositions, plus le
// .precedent ou plus le journal élagué mesurerait autre chose, et passerait
// sous le seuil (§ 14.2) ; un geste dont les propositions arriveraient
// recopiées mesurerait un autre chemin que celui des commandes, et l'épreuve
// le refuse.
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PREFIXE_CANAL, PRIMITIVES, creerFichiers, decrireSysteme, servir } from '../../electron/fichiers.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { regenerer } from '../moteur/recherche.js';
import { VERSION } from '../version.genere.js';
import { canoniser, serialiser } from './canonique.js';
import { creer, enregistrer, ouvrir } from './depot.js';
import { analyser, configurationDepuisCharge } from './document.js';
import { creerFichiersElectron } from './fichiers_electron.js';
import { copieDeTravail, estFigee } from './gel.js';
import {
  INTERVALLE_INSTANTANE,
  PLAFOND_ENTREES,
  PLANCHER_ENTREES,
  estInstantane,
  ligneEntree,
  lireJournal,
  reconstruire,
} from './journal.js';
import { SUFFIXES } from './noms.js';
import { examiner, versFichier } from './placements.js';

const V = VERSION.affichee;
const NOM_PRODUIT = 'Gestion table tournante Libre';

// Les propositions de la charge mesurée, la vingtaine du § 8.9 sur la grande
// démonstration, aux graines 1 à PROPOSITIONS.
const PROPOSITIONS = 20;

// Le compte d'arrêt de chaque proposition, réduit à côté de celui des
// réglages : la taille d'un placement ne dépend que de sa forme, non de sa
// qualité, et la construction de la charge reste brève.
const ARRET_REDUIT = 2_000;

// L'échantillonnage, contre une charge passagère de la machine. Après un
// geste de chauffe, chaque épreuve mesure son nombre de base de gestes, et
// son seuil porte sur le plus court : le minimum écarte ce qu'une machine
// occupée ajoute à un geste, pourvu qu'un geste au moins s'exécute quand la
// charge se relâche. Tant que le plus court dépasse le seuil, l'épreuve
// mesure d'autres gestes, jusqu'à son plafond de gestes ou jusqu'à ce que
// FENETRE_MESURE_MS se soient écoulées depuis le premier geste mesuré, ce
// qui vient d'abord. Une charge plus courte que la fenêtre laisse ainsi
// passer un geste sous le seuil, et l'épreuve passe ; une régression, qui
// allonge chaque geste, le laisse au-delà à chaque geste, et l'épreuve
// échoue au plafond. Sous la charge que couvre MARGE, le nombre de base
// suffit : l'épreuve ne s'allonge qu'au-delà.
//
// GESTES_MESURES, le nombre de base des gestes ordinaires : vingt tiennent
// sous la charge que couvre MARGE, là où cinq n'y tiennent pas.
// GESTES_AU_PLUS, cinq fois autant, borne les gestes ordinaires mesurés.
const GESTES_MESURES = 20;
const GESTES_AU_PLUS = 100;

// ESSAIS_ELAGAGE, le nombre de base des essais du geste qui élague : cinq
// tiennent sous la charge que couvre MARGE. Chaque essai pose un journal
// plein, d'environ 2 Mo, et relit celui qu'il écrit. ESSAIS_ELAGAGE_AU_PLUS,
// cinq fois autant, borne les essais mesurés.
const ESSAIS_ELAGAGE = 5;
const ESSAIS_ELAGAGE_AU_PLUS = 25;

// La fenêtre de mesure, en millisecondes, au mur, vérifications hors mesure
// comprises : la charge passagère que l'échantillonnage écarte dure moins
// qu'elle. Elle borne aussi la durée d'une épreuve qui échoue : une mesure
// s'arrête au premier geste qui finit au-delà, et la fenêtre vaut un sixième
// du plafond de la série node-long (test/rapporteur.js).
const FENETRE_MESURE_MS = 10_000;

// Les seuils du coût d'un enregistrement complet (§ 8.2, § 14.1), en
// millisecondes, chacun au minimum de ses gestes mesurés, qui garde le coût
// du geste. Le § 8.2 réécrit l'état entier à chaque geste : c'est ce coût
// qui gouverne la forme du fichier (§ 8.9).
//
// Un geste se mesure en deux parts. La première est son attente de la
// coquille : la durée au mur pendant laquelle un appel au moins attend une
// primitive, copie de l'IPC comprise — écrire et vider sur le disque la ligne
// du journal, le .precedent, l'état. Elle dépend du système de fichiers et de
// ce qui l'occupe au même moment, non du stockage : en mémoire (tmpfs), elle
// vaut à peu près ce que le stockage calcule ; sur un disque que d'autres
// séries vident en même temps, jusqu'à une dizaine de fois. La seconde est
// son calcul, le reste de la durée au mur : ce que la page exécute. Chaque
// seuil borne le calcul, et la durée au mur d'un geste admis vaut au plus
// son seuil plus l'attente de la coquille de ce même geste : l'attente,
// relevée geste par geste, ne décide pas de l'issue. Ce qu'écrit le geste se
// vérifie par ailleurs : chaque écriture de la coquille, une fois chacune,
// et les fichiers, octet pour octet, sur le disque.
//
// SEUIL_MS borne le geste ordinaire. Il ne recopie pas la charge entière :
// ses propositions figées restent les mêmes objets, et ce que le stockage
// calcule d'elles — copie canonique, texte, contrôle de forme, examen — se
// garde par leur identité. Restent à calculer la copie canonique du reste de
// la charge, le correctif depuis l'entrée qui précède, qui saute les
// propositions partagées, l'état sérialisé puis relu en entier, la ligne du
// journal ; la coquille ajoute cette ligne et la vide sur le disque, puis
// réécrit le .precedent et l'état par écriture atomique. L'entrée qui porte
// un instantané, une sur INTERVALLE_INSTANTANE, coûte autant : la copie
// canonique du geste y remplace le correctif, et sa ligne s'ajoute de même.
// SEUIL_ELAGAGE_MS borne le geste dont l'entrée fait passer le journal
// au-delà de PLAFOND_ENTREES : le journal se réécrit en entier — son texte
// recomposé et élagué en mémoire — par une écriture atomique de la taille
// d'une dizaine d'instantanés de la charge, avant le .precedent et l'état.
// Le plafond atteint, ce geste revient environ une
// fois par centaine de gestes : l'élagage garde un peu plus de
// PLANCHER_ENTREES entrées. Les autres réécritures entières du journal —
// une entrée de reprise, des lignes écartées à la lecture, un journal qui
// manque (depot.js) — réparent un événement sorti du cours ordinaire des
// gestes, et ces épreuves ne les mesurent pas.
//
// REFERENCE_MS et REFERENCE_ELAGAGE_MS sont les minimums, hors de l'attente
// de la coquille, que relèvent ces épreuves, le fichier lancé seul, médiane
// de plusieurs lancements arrondie à la milliseconde supérieure, sur un
// processeur x86-64 de bureau de génération Zen 3, seize cœurs virtuels sous
// KVM, le dossier temporaire en mémoire (tmpfs), sous Linux et Node 26.
// MARGE, le facteur qui tire chaque seuil de sa référence, couvre, sur la
// machine des références, quatre séries node-long lancées ensemble, autant
// que de conteneurs simultanés par défaut sous make verifier_systemes
// (GTT_PARALLELES), chacune son dossier temporaire sur disque : le calcul du
// plus court des gestes y monte de deux à plus de quatre fois sa référence,
// selon ce qu'exécute la machine par ailleurs. Elle ne couvre pas ce qu'un
// autre conteneur exécute en même temps — make test, npm ci, Chromium —, ni
// une machine plus lente : contre une charge passagère, l'échantillonnage
// mesure d'autres gestes jusqu'à son plafond.
//
// Une proposition inchangée ne coûte presque rien au geste. Le
// seuil du geste ordinaire laisse donc passer un état qui porte dix fois plus
// de propositions, à environ deux fois REFERENCE_MS, et un geste dont les
// propositions arriveraient recopiées, à près de quatre fois : l'épreuve
// refuse ce dernier par l'identité des propositions, hors de la mesure. Un
// geste qui recopierait et recontrôlerait la charge entière, à plus de cinq
// fois REFERENCE_MS, le dépasse. Le geste qui élague dépasse son seuil sous
// dix fois plus de propositions, chaque instantané qu'il réécrit grossissant
// d'autant.
//
// Propriétaire (§ 14.1) : la série node-long, où ces épreuves relèvent la
// mesure à chaque exécution et la nomment quand elle dépasse son seuil. Le
// relevé sur la plateforme livrée — l'exécutable Windows, sous un antivirus
// qui inspecte chaque fichier temporaire, dont le coût tombe dans l'attente
// de la coquille — appartient au niveau manuel, avant livraison : tant qu'il
// n'a pas eu lieu, ces seuils sont des défauts de travail relevés sous Linux.
const REFERENCE_MS = 3;
const REFERENCE_ELAGAGE_MS = 10;
const MARGE = 5;
const SEUIL_MS = REFERENCE_MS * MARGE;
const SEUIL_ELAGAGE_MS = REFERENCE_ELAGAGE_MS * MARGE;

// Durée affichée, une décimale, virgule décimale.
const ms = (duree) => `${duree.toFixed(1).replace('.', ',')} ms`;

const croissant = (a, b) => a - b;

// Un nombre sur deux chiffres.
const deux = (n) => String(n).padStart(2, '0');

// Horodatage d'affichage de l'instant n, une minute par instant depuis 8 h ;
// il n'entre dans aucune mesure.
const heure = (n) => `2031-11-08T${deux(8 + Math.floor(n / 60))}:${deux(n % 60)}:00-05:00`;

const CREATION = { libelle: "Création de l'événement", nomJalon: 'Création', horodatage: heure(0), produitVersion: V };
const geste = (n) => ({ libelle: `Retouche ${n} du placement retenu`, horodatage: heure(n), produitVersion: V });

// Le retenu repris d'une proposition, dont l'identifiant devient l'origine ;
// son placement est une copie, qu'une retouche modifie sans toucher la
// proposition.
function retenuDe({ id, siegesAttribues, tables, capacites, tours, participants, placement }) {
  return {
    proposition: id,
    siegesAttribues,
    tables: [...tables],
    capacites: [...capacites],
    tours,
    participants: [...participants],
    placement: structuredClone(placement),
  };
}

// La grande démonstration livrée, portant PROPOSITIONS propositions que le
// moteur produit aux graines 1 à PROPOSITIONS sous ARRET_REDUIT, numérotées
// depuis le compteur de la charge, qui passe au-delà de la dernière ; la
// première est retenue, et l'événement dans l'état retenu.
function construire() {
  const charge = analyser(texteLivre('grande')).charge;
  const configuration = configurationDepuisCharge(charge);
  const { historique } = charge.reglages.generation;
  const decalage = charge.prochainsIds.proposition - 1;
  charge.propositions = Array.from({ length: PROPOSITIONS }, (_, rang) => {
    const graine = rang + 1;
    const plan = regenerer(configuration, { graine, arret: ARRET_REDUIT, historique });
    return versFichier({ id: graine, graine, arret: ARRET_REDUIT, historique, plan }, configuration, {
      produitVersion: V,
      attribuerSieges: charge.reglages.attribuerSieges,
      decalage,
    });
  });
  charge.prochainsIds.proposition = decalage + PROPOSITIONS + 1;
  charge.retenu = retenuDe(charge.propositions[0]);
  charge.evenement.etat = 'retenu';
  return charge;
}

// La charge mesurée, construite au premier appel et partagée par les
// épreuves du fichier, qui ne la modifient pas.
let construite = null;
const chargeMesuree = () => (construite ??= construire());

// La charge reçue, son placement retenu retouché au tour d'index tour : la
// première personne sans réservation de la première table et celle de la
// deuxième changent de table, comme une retouche à la main (§ 5.8). Une
// personne réservée ne s'échange pas, ce que le geste refuserait (§ 5.9).
// Les sièges n'étant pas attribués, chaque liste reste triée par
// identifiant (§ 8.9). La retouche se fait sur une copie de travail
// (copieDeTravail), comme celle des commandes : les propositions figées de
// la charge reçue y sont les mêmes objets, les autres des copies, et la
// charge reçue ne change pas.
function echanger(charge, tour) {
  const apres = copieDeTravail(charge);
  const reservees = new Set(charge.reservations.map(({ participant }) => participant));
  const [premiere, deuxieme] = apres.retenu.placement[tour].sieges;
  const a = premiere.find((id) => !reservees.has(id));
  const b = deuxieme.find((id) => !reservees.has(id));
  assert.ok(a !== undefined && b !== undefined, `tour ${tour + 1} : aucune personne à échanger`);
  premiere.splice(premiere.indexOf(a), 1, b);
  deuxieme.splice(deuxieme.indexOf(b), 1, a);
  premiere.sort(croissant);
  deuxieme.sort(croissant);
  return apres;
}

// Les textes d'un événement dont le journal est plein, à PLAFOND_ENTREES
// entrées : le journal que creer a écrit pour la charge a — ouverture,
// entrée 1 en instantané, jalon de la création —, suivi des entrées 2 à
// PLAFOND_ENTREES, écrites ligne à ligne plutôt que par autant de gestes
// enregistrés. Les charges alternent : a aux révisions impaires, b, son
// retenu retouché au premier tour, aux paires. Chaque ligne a la forme que
// ligneEntree donne à son passage — instantané à la cadence du journal
// (estInstantane), correctif de a vers b ou de b vers a sinon —, calculée
// une fois par sorte de passage, sous le libellé et l'horodatage de sa
// révision : les clés remplacées gardent leur place, et chaque ligne est
// celle qu'écrirait ligneEntree. Rend le journal, l'état à la dernière
// révision, le .precedent à celle d'avant, et chargeDe, la charge d'une
// révision.
function evenementPlein(journalCree, a) {
  const b = echanger(a, 0);
  const chargeDe = (revision) => (revision % 2 === 1 ? a : b);
  const formes = new Map();
  const lignes = [];
  for (let revision = 2; revision <= PLAFOND_ENTREES; revision += 1) {
    const { libelle, horodatage } = geste(revision);
    const instantane = estInstantane(revision, 1);
    const sorte = `${instantane} ${revision % 2}`;
    if (!formes.has(sorte)) {
      const ligne = ligneEntree({
        revision,
        libelle,
        horodatage,
        avant: chargeDe(revision - 1),
        apres: chargeDe(revision),
        instantane,
      });
      formes.set(sorte, JSON.parse(ligne));
    }
    lignes.push(JSON.stringify({ ...formes.get(sorte), revision, libelle, horodatage }));
  }
  const etat = (revision) => serialiser(chargeDe(revision), { revision, produitVersion: V });
  return {
    journal: `${journalCree}${lignes.join('\n')}\n`,
    etat: etat(PLAFOND_ENTREES),
    precedent: etat(PLAFOND_ENTREES - 1),
    chargeDe,
  };
}

// Les dialogues et l'explorateur ne servent pas à un enregistrement : un
// appel lèverait TypeError.
const SANS_DIALOGUE = Object.freeze({});

// Le système de fichiers de la plateforme electron sur dossier : la page
// (creerFichiersElectron) devant les primitives de la coquille
// (creerFichiers), que servir offre canal par canal, comme le processus
// principal. L'IPC d'Electron y est remplacé par une copie structurée des
// arguments et de la réponse, comme il les copie. Les Documents et l'AppData
// du poste sont des dossiers de dossier. Rend le système, la racine
// documents, créée, attente, qui rend l'attente de la coquille cumulée
// depuis la création, en millisecondes : la durée au mur pendant laquelle un
// appel au moins attend une primitive, copie de l'IPC comprise — des appels
// qui se chevauchent ne la comptent qu'une fois ; un geste la mesure par
// différence —, et ecritures, la liste, dans l'ordre des appels, des
// primitives qui écrivent (ECRITURES), chacune [primitive, chemin, texte].
async function systemeSur(dossier) {
  const systeme = decrireSysteme({
    env: {},
    plateforme: process.platform,
    cheminSysteme: (nom) => (nom === 'temp' ? tmpdir() : join(dossier, nom)),
    nomProduit: NOM_PRODUIT,
  });
  const gestionnaires = new Map();
  servir(creerFichiers({ ...systeme, dialog: SANS_DIALOGUE, shell: SANS_DIALOGUE }), (canal, gestionnaire) =>
    gestionnaires.set(canal, gestionnaire),
  );
  let attente = 0;
  let enCours = 0;
  let depuis = 0;
  const ecritures = [];
  const pont = Object.fromEntries(
    PRIMITIVES.map((primitive) => {
      const gestionnaire = gestionnaires.get(`${PREFIXE_CANAL}${primitive}`);
      const appeler = async (...parametres) => {
        if (ECRITURES.has(primitive)) ecritures.push([primitive, parametres[1], parametres[2]]);
        if (enCours === 0) depuis = performance.now();
        enCours += 1;
        try {
          return structuredClone(await gestionnaire({ sender: null }, ...structuredClone(parametres)));
        } finally {
          enCours -= 1;
          if (enCours === 0) attente += performance.now() - depuis;
        }
      };
      return [primitive, appeler];
    }),
  );
  const fs = creerFichiersElectron(pont);
  const { documents } = await fs.racines();
  mkdirSync(documents.chemin, { recursive: true });
  return { fs, racine: documents, attente: () => attente, ecritures };
}

// Les primitives de la coquille qui écrivent sur le disque.
const ECRITURES = new Set([
  'ecrireAtomique',
  'ecrireOctetsAtomique',
  'ajouterLigne',
  'creerDossier',
  'deplacer',
  'supprimer',
]);

// Affirme ce que la coquille a écrit pour le geste de la révision revision,
// depuis le rang depuis de ecritures : la ligne du journal par un ajout, ou
// le journal entier par une écriture atomique quand il s'élague (journal, la
// primitive attendue), puis le .precedent au texte precedent, puis l'état au
// texte etat, une fois chacun, et rien d'autre. Le seuil ne bornant que le
// calcul, ce décompte refuse une écriture de trop, quelle que soit la charge
// du disque.
function affirmerEcritures(ecritures, depuis, base, revision, { journal, etat, precedent }) {
  const faites = ecritures
    .slice(depuis)
    .map(([primitive, chemin, texte]) =>
      chemin === base + SUFFIXES.journal ? [primitive, chemin] : [primitive, chemin, texte],
    );
  assert.deepEqual(
    faites,
    [
      [journal, base + SUFFIXES.journal],
      ['ecrireAtomique', base + SUFFIXES.precedent, precedent],
      ['ecrireAtomique', base + SUFFIXES.etat, etat],
    ],
    `écritures de la coquille pour le geste de la révision ${revision}`,
  );
}

// Affirme qu'un geste mesuré a attendu la coquille, ce que fait tout geste
// qui écrit, et au plus sa durée au mur : un décompte faux de l'attente
// fausserait le calcul que borne le seuil.
function affirmerAttente({ duree, coquille }, quoi) {
  assert.ok(coquille > 0 && coquille <= duree, `${quoi} : attente de la coquille ${coquille} ms pour ${duree} ms au mur`);
}

// Chemin, sur le disque, du fichier de suffixe de l'événement base sous
// racine.
const cheminDe = (racine, base, suffixe) => join(racine.chemin, `${base}${suffixe}`);

// Texte du fichier chemin, ou null quand il manque.
const lireSiPresent = (chemin) => (existsSync(chemin) ? readFileSync(chemin, 'utf8') : null);

// Révision de l'en-tête d'un texte d'état, ou null sans texte.
const revisionDe = (texte) => (texte === null ? null : analyser(texte).entete.revision);

// Affirme que le disque porte ce qu'écrit le geste de la révision revision :
// l'état au texte etat, le .precedent au texte precedent, celui de l'état
// d'avant le geste. Les révisions des en-têtes se comparent d'abord, null
// pour un fichier qui manque : un fichier que le geste n'a pas écrit se
// nomme par la révision qu'il garde, avant toute différence de deux textes.
function affirmerEcrits(racine, base, revision, { etat, precedent }) {
  const ecrits = {
    etat: lireSiPresent(cheminDe(racine, base, SUFFIXES.etat)),
    precedent: lireSiPresent(cheminDe(racine, base, SUFFIXES.precedent)),
  };
  assert.deepEqual(
    { etat: revisionDe(ecrits.etat), precedent: revisionDe(ecrits.precedent) },
    { etat: revision, precedent: revision - 1 },
    `révisions de l'état et du .precedent sur le disque après le geste de la révision ${revision}`,
  );
  assert.ok(ecrits.etat === etat, `l'état sur le disque n'est pas celui qu'écrit le geste de la révision ${revision}`);
  assert.ok(
    ecrits.precedent === precedent,
    `le .precedent sur le disque n'est pas l'état d'avant le geste de la révision ${revision}`,
  );
}

// Un geste mesuré, { duree, coquille } : sa durée au mur et son attente de la
// coquille, en millisecondes. Rend son calcul, la durée au mur moins
// l'attente, que borne le seuil.
const calcul = ({ duree, coquille }) => duree - coquille;

// La mesure échantillonnée d'un geste (GESTES_MESURES) : faire exécute un
// geste et ses vérifications, et rend le geste mesuré, { duree, coquille }.
// Un premier appel chauffe, sans compter ; suivent base gestes mesurés, puis
// d'autres tant que le plus court calcul dépasse seuil, jusqu'à auPlus gestes
// mesurés ou la fin de FENETRE_MESURE_MS, comptée depuis le premier. Rend
// les gestes, dans leur ordre, et arret, ce qui a clos une mesure restée
// au-delà du seuil.
async function mesurer(faire, { base, auPlus, seuil }) {
  await faire();
  const gestes = [];
  const debut = performance.now();
  const ouverte = () => performance.now() - debut < FENETRE_MESURE_MS;
  const auDela = () => Math.min(...gestes.map(calcul)) > seuil;
  while (gestes.length < base || (auDela() && gestes.length < auPlus && ouverte())) {
    gestes.push(await faire());
  }
  const arret =
    gestes.length >= auPlus
      ? `plafond de ${auPlus} mesures atteint`
      : `fenêtre de ${FENETRE_MESURE_MS / 1000} s écoulée`;
  return { gestes, arret };
}

// Le plus court calcul des gestes mesurés.
const plusCourt = ({ gestes }) => Math.min(...gestes.map(calcul));

// Le message d'un seuil dépassé : le plus court calcul, la durée au mur et
// l'attente de la coquille de son geste, le nombre de mesures, la médiane et
// le plus long des calculs, ce qui a clos la mesure, le seuil, et la
// référence dont MARGE le tire.
function depasse(quoi, { gestes, arret }, seuil, reference) {
  const triees = gestes.map(calcul).sort(croissant);
  const { duree, coquille } = gestes.find((mesure) => calcul(mesure) === triees[0]);
  return (
    `${quoi} calcule en ${ms(triees[0])} au minimum de ${gestes.length} mesures ` +
    `(${ms(duree)} au mur, dont ${ms(coquille)} d'attente de la coquille ; ` +
    `médiane ${ms(triees[Math.floor((triees.length - 1) / 2)])}, le plus long ${ms(triees.at(-1))} ; ` +
    `${arret}), au-delà du seuil de ${ms(seuil)} (§ 8.2) : ${reference}, MARGE ${MARGE}`
  );
}

describe("dépôt : le coût d'un enregistrement complet, sur un vrai système de fichiers (§ 8.2)", () => {
  test("la charge mesurée est la grande démonstration portant vingt propositions du moteur, la première retenue : l'analyse l'admet, la forme canonique la réécrit octet pour octet, et aucune proposition n'est fautive ni périmée", () => {
    const texte = serialiser(chargeMesuree(), { revision: 1, produitVersion: V });
    const lu = analyser(texte);
    const { participants, propositions, retenu } = lu.entete.comptes;
    assert.deepEqual(
      { participants, propositions, retenu },
      { participants: 260, propositions: PROPOSITIONS, retenu: 1 },
    );
    assert.deepEqual(
      lu.charge.propositions.map(({ graine }) => graine),
      Array.from({ length: PROPOSITIONS }, (_, rang) => rang + 1),
    );
    assert.equal(serialiser(lu.charge, lu.entete), texte);
    const { fautives, derives, retenu: examenRetenu } = examiner(lu.charge);
    assert.deepEqual(
      { fautives, derives, retenu: examenRetenu },
      { fautives: [], derives: [], retenu: { fautes: [], raisons: [] } },
    );
  });

  test(`un geste qui retouche le placement retenu s'enregistre — journal, .precedent, état — en au plus ${ms(SEUIL_MS)} de plus que son attente de la coquille, au minimum de ${GESTES_MESURES} à ${GESTES_AU_PLUS} mesures après un geste de chauffe ; chaque geste garde les propositions figées de la charge d'avant, laisse sur le disque l'état et le .precedent qu'il écrit, et l'événement rouvert est celui du dernier geste, dont le journal porte chaque révision`, async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gtt-cout-'));
    try {
      const { fs, racine, attente, ecritures } = await systemeSur(dossier);
      let ouvert = await creer(fs, racine, chargeMesuree(), CREATION);
      // La charge de chaque révision, depuis celle de l'Ouvert créé, dont
      // creer a figé les propositions sur sa copie de la charge mesurée, et
      // le texte de l'état à la dernière. Chaque geste retouche le tour qui
      // suit celui du geste d'avant ; enregistrer garde, dans l'Ouvert rendu,
      // les propositions figées que la retouche a partagées.
      const charges = [ouvert.charge];
      let texteEtat = serialiser(chargeMesuree(), { revision: 1, produitVersion: V });
      const faire = async () => {
        const revision = charges.length + 1;
        const avant = charges.at(-1);
        const apres = echanger(avant, (revision - 2) % avant.evenement.tours);
        const ecrites = ecritures.length;
        const attendu = attente();
        const debut = performance.now();
        ouvert = await enregistrer(ouvert, apres, geste(revision));
        const releve = { duree: performance.now() - debut, coquille: attente() - attendu };
        const texteApres = serialiser(apres, { revision, produitVersion: V });
        assert.equal(ouvert.revision, revision);
        assert.ok(
          ouvert.charge.propositions.every(
            (proposition, rang) => proposition === avant.propositions[rang] && estFigee(proposition),
          ),
          `le geste de la révision ${revision} ne garde pas les propositions figées de la charge d'avant`,
        );
        affirmerAttente(releve, `le geste de la révision ${revision}`);
        affirmerEcritures(ecritures, ecrites, ouvert.base, revision, {
          journal: 'ajouterLigne',
          etat: texteApres,
          precedent: texteEtat,
        });
        affirmerEcrits(racine, ouvert.base, revision, { etat: texteApres, precedent: texteEtat });
        charges.push(apres);
        texteEtat = texteApres;
        return releve;
      };
      const mesure = await mesurer(faire, { base: GESTES_MESURES, auPlus: GESTES_AU_PLUS, seuil: SEUIL_MS });

      // L'événement se rouvre sans rien rattraper ni signaler, à la charge
      // du dernier geste ; l'état sur le disque porte les vingt propositions
      // et le retenu ; le journal porte une entrée par révision.
      const revision = charges.length;
      const rouvert = await ouvrir(fs, racine, ouvert.base);
      assert.deepEqual(rouvert.avertissements, []);
      assert.equal(rouvert.revision, revision);
      assert.deepEqual(rouvert.charge, canoniser(charges.at(-1)));
      const etat = analyser(readFileSync(cheminDe(racine, ouvert.base, SUFFIXES.etat), 'utf8'));
      const { propositions, retenu } = etat.entete.comptes;
      assert.deepEqual({ propositions, retenu }, { propositions: PROPOSITIONS, retenu: 1 });
      const journal = lireJournal(readFileSync(cheminDe(racine, ouvert.base, SUFFIXES.journal), 'utf8'));
      assert.deepEqual(
        journal.entrees.map((entree) => entree.revision),
        Array.from({ length: revision }, (_, rang) => rang + 1),
      );
      // Le journal restitue la charge de chaque révision jusqu'au dernier des
      // GESTES_MESURES gestes de base, puis celle de la dernière.
      // Reconstruire une révision rejoue chaque correctif depuis l'instantané
      // qui la précède : le coût de relire chaque révision croît comme le
      // carré du nombre de gestes entre deux instantanés. Les gestes de base,
      // en nombre fixe, se relisent donc tous, et les gestes de plus de
      // l'échantillonnage par le dernier. Un correctif faux se voit à sa
      // révision : un geste ultérieur qui récrit les mêmes listes de table
      // l'efface des suivantes.
      const relues = Array.from({ length: GESTES_MESURES + 2 }, (_, rang) => rang + 1);
      if (revision > relues.length) relues.push(revision);
      for (const relue of relues) {
        assert.deepEqual(reconstruire(journal, relue), canoniser(charges[relue - 1]), `révision ${relue}`);
      }

      assert.ok(
        plusCourt(mesure) <= SEUIL_MS,
        depasse('un geste sur la grande démonstration', mesure, SEUIL_MS, `REFERENCE_MS ${REFERENCE_MS} ms`),
      );
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });

  test(`le geste dont l'entrée fait passer le journal au-delà de ${PLAFOND_ENTREES} entrées le réécrit élagué — journal, .precedent, état — en au plus ${ms(SEUIL_ELAGAGE_MS)} de plus que son attente de la coquille, au minimum de ${ESSAIS_ELAGAGE} à ${ESSAIS_ELAGAGE_AU_PLUS} essais après un essai de chauffe, chacun sur une copie neuve du journal plein, les propositions figées de l'Ouvert gardées ; le journal écrit part de l'instantané de la coupe et restitue le geste`, async () => {
    const dossier = mkdtempSync(join(tmpdir(), 'gtt-elagage-'));
    try {
      const { fs, racine, attente, ecritures } = await systemeSur(dossier);
      const { base } = await creer(fs, racine, chargeMesuree(), CREATION);
      const chemin = (suffixe) => cheminDe(racine, base, suffixe);
      const plein = evenementPlein(readFileSync(chemin(SUFFIXES.journal), 'utf8'), chargeMesuree());
      const poser = () => {
        writeFileSync(chemin(SUFFIXES.journal), plein.journal);
        writeFileSync(chemin(SUFFIXES.precedent), plein.precedent);
        writeFileSync(chemin(SUFFIXES.etat), plein.etat);
      };

      // L'événement plein s'ouvre sans rien signaler, son journal à
      // PLAFOND_ENTREES entrées, à la charge de sa dernière révision.
      // enregistrer ne modifie pas l'Ouvert reçu : chaque essai part du même,
      // sur le journal plein reposé, la chauffe comprise.
      poser();
      const ouvert = await ouvrir(fs, racine, base);
      assert.deepEqual(
        { avertissements: ouvert.avertissements, revision: ouvert.revision, entrees: ouvert.journal.entrees.length },
        { avertissements: [], revision: PLAFOND_ENTREES, entrees: PLAFOND_ENTREES },
      );
      assert.deepEqual(ouvert.charge, canoniser(plein.chargeDe(PLAFOND_ENTREES)));

      // La coupe de l'élagage : l'instantané le plus récent — révision 1,
      // puis toutes les INTERVALLE_INSTANTANE — d'où le journal garde au
      // moins PLANCHER_ENTREES entrées jusqu'au geste.
      const revision = PLAFOND_ENTREES + 1;
      const coupe = 1 + Math.floor((revision - PLANCHER_ENTREES) / INTERVALLE_INSTANTANE) * INTERVALLE_INSTANTANE;
      // Le geste retouche la charge de l'Ouvert, dont il partage les
      // propositions figées, comme un geste ordinaire.
      const apres = echanger(ouvert.charge, 1);
      const texteApres = serialiser(apres, { revision, produitVersion: V });
      let essai = 0;
      let journal = null;
      const faire = async () => {
        poser();
        const ecrites = ecritures.length;
        const attendu = attente();
        const debut = performance.now();
        const avance = await enregistrer(ouvert, apres, geste(revision));
        const releve = { duree: performance.now() - debut, coquille: attente() - attendu };
        assert.ok(
          avance.charge.propositions.every(
            (proposition, rang) => proposition === ouvert.charge.propositions[rang] && estFigee(proposition),
          ),
          `le geste de l'essai ${essai} ne garde pas les propositions figées de l'Ouvert`,
        );
        affirmerAttente(releve, `l'essai ${essai}`);
        affirmerEcritures(ecritures, ecrites, base, revision, {
          journal: 'ecrireAtomique',
          etat: texteApres,
          precedent: plein.etat,
        });
        affirmerEcrits(racine, base, revision, { etat: texteApres, precedent: plein.etat });
        journal = lireJournal(readFileSync(chemin(SUFFIXES.journal), 'utf8'));
        assert.deepEqual(
          {
            premiere: journal.entrees[0].revision,
            entrees: journal.entrees.length,
            jalons: journal.jalons.length,
            ecartees: journal.ecartees,
          },
          { premiere: coupe, entrees: revision - coupe + 1, jalons: 0, ecartees: 0 },
          `journal écrit par l'essai ${essai}`,
        );
        assert.deepEqual(reconstruire(journal, revision), canoniser(apres));
        essai += 1;
        return releve;
      };
      const mesure = await mesurer(faire, {
        base: ESSAIS_ELAGAGE,
        auPlus: ESSAIS_ELAGAGE_AU_PLUS,
        seuil: SEUIL_ELAGAGE_MS,
      });

      // Le journal élagué restitue encore l'instant d'avant le geste, et
      // l'événement se rouvre sur le geste sans rien rattraper ni signaler.
      assert.deepEqual(reconstruire(journal, PLAFOND_ENTREES), canoniser(plein.chargeDe(PLAFOND_ENTREES)));
      const rouvert = await ouvrir(fs, racine, base);
      assert.deepEqual(
        { avertissements: rouvert.avertissements, revision: rouvert.revision },
        { avertissements: [], revision },
      );
      assert.deepEqual(rouvert.charge, canoniser(apres));

      assert.ok(
        plusCourt(mesure) <= SEUIL_ELAGAGE_MS,
        depasse(
          'le geste qui élague le journal plein',
          mesure,
          SEUIL_ELAGAGE_MS,
          `REFERENCE_ELAGAGE_MS ${REFERENCE_ELAGAGE_MS} ms`,
        ),
      );
    } finally {
      rmSync(dossier, { recursive: true, force: true });
    }
  });
});
