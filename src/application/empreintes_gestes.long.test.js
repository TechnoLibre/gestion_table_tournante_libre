// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Empreintes dorées d'une séance de gestes (§ 8.2, § 8.8, § 14.2, § 15.5) :
// une séance réelle sur la grande démonstration, horloge pilotée,
// identifiants fixes, système de fichiers d'épreuve (test/fichiers_simules.js).
// Une génération courte, une proposition retenue, puis une quarantaine de
// gestes — échanges dans le retenu, notes et appartenance modifiées, personne
// ajoutée, exclue puis réintégrée, présence réduite, sièges d'une table,
// titre posé —, deux gestes refusés sans effet, un jalon, cinq défaire, deux
// refaire, un revenir, puis le même revenir, refusé sans effet. Des deux
// gestes sans effet, le premier — les sièges d'une table reposés à leur
// nombre — passe la commande et se refuse à la comparaison des charges
// avant et après, commune à toutes les commandes ; le second — les mêmes
// notes — se refuse dans la commande elle-même. La séance se
// ferme ; le journal, comblé ligne à ligne jusqu'à PLAFOND_ENTREES entrées
// comme dans depot.long.test.js, se rouvre, et le geste suivant l'élague. Une
// dernière séance, neuve sur le même disque, rouvre l'événement.
//
// Après chaque pas, l'épreuve relève l'empreinte du fichier d'état, du
// .precedent, du journal et du compagnon des courses, tels que le disque les
// porte, puis celle de l'état publié (seance.etat()) et de l'historique
// (seance.historique()), en JSON. Les relevés se replient en une seule
// empreinte, comparée à EMPREINTE_SEANCE : aucun octet écrit, aucune valeur
// publiée, aucun ordre de clés ne change sans la faire changer. Le texte de
// la version affichée se remplace par un marqueur avant chaque empreinte :
// une livraison, qui change la version, ne la change pas.
//
// Les propositions de la génération viennent du moteur. Leur empreinte,
// EMPREINTE_GENERATION, se vérifie à part et d'abord : quand le moteur change
// ses plans, c'est elle qui le dit, et non l'empreinte de la séance.
//
// EMPREINTE_SEANCE et EMPREINTE_GENERATION se relèvent sur le code dont les
// sorties font foi ; elles ne se récrivent que par un geste conscient, quand
// une sortie doit changer. En cas d'écart, le message liste l'empreinte
// abrégée de chaque pas : la même liste, relevée sur le code de référence,
// nomme le premier pas qui diffère.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { creerFichiersSimules } from '../../test/fichiers_simules.js';
import { describe, test } from '../../test/lanceur.js';
import { texteLivre } from '../demo/livrees.js';
import { rechercher } from '../moteur/recherche.js';
import { serialiser } from '../stockage/canonique.js';
import { creer } from '../stockage/depot.js';
import { analyser, configurationDepuisCharge } from '../stockage/document.js';
import { PLAFOND_ENTREES, estInstantane, ligneEntree, lireJournal } from '../stockage/journal.js';
import { SUFFIXES } from '../stockage/noms.js';
import { VERSION } from '../version.genere.js';
import { creerHorlogePilotee } from './horloge.js';
import { creerSeance } from './seance.js';

const V = VERSION.affichee;

// L'empreinte repliée des relevés de la séance, et celle des propositions
// que le moteur rend à la génération.
const EMPREINTE_SEANCE = '4d3a6d097b6f5a87673cc40d4223b7f058c74a7edecbf7083f8bd35f077fa5dc';
const EMPREINTE_GENERATION = 'a14f93bd4b0ac9543abb51fdcfa8fb33822225cb4abde28efa1e70ce8098ffff';

// Le nombre de relevés de la séance : une séance qui s'arrêterait en chemin
// ne se compare pas à la référence (§ 14.2).
const RELEVES = 62;

// La génération : trois propositions, graine 11, compte d'arrêt réduit — la
// forme d'un placement ne dépend pas de sa qualité.
const GENERATION = Object.freeze({ graine: 11, arret: 2_000, nombre: 3 });

// Le nombre d'échanges dans le retenu.
const ECHANGES = 28;

// Marqueur qui remplace la version affichée dans chaque texte relevé.
const MARQUEUR_VERSION = '‹version›';

const sha256 = (texte) => createHash('sha256').update(texte).digest('hex');

// L'empreinte abrégée d'un texte, sa version remplacée par le marqueur ;
// « absent » pour null.
const empreinte = (texte) => (texte === null ? 'absent' : sha256(texte.replaceAll(V, MARQUEUR_VERSION)).slice(0, 16));

const deux = (n) => String(n).padStart(2, '0');

// Horodatage des lignes comblées du journal, une minute par révision depuis
// 6 h, le lendemain de la séance : il ne dépend que de la révision.
const heureComblee = (revision) =>
  `2031-11-10T${deux(6 + Math.floor(revision / 60))}:${deux(revision % 60)}:00-05:00`;

// Le montage : le disque d'épreuve, sa racine documents, l'horloge pilotée et
// les identifiants numérotés dans l'ordre des tirages. seance(sur) crée une
// séance sur le système sur, fs par défaut : un autre système sur le même
// disque est un processus de plus.
async function monter() {
  const disque = new Map();
  const fs = creerFichiersSimules({ disque });
  const { documents: racine } = await fs.racines();
  fs.deposerDossier(racine.id);
  const horloge = creerHorlogePilotee({ depart: '2031-11-09T18:00:00-05:00' });
  let tirages = 0;
  const identifiant = () => {
    tirages += 1;
    return `empreinte-${tirages}`;
  };
  const seance = (sur = fs) =>
    creerSeance({
      fs: sur,
      racine,
      horloge,
      identifiant,
      produitVersion: V,
      planifier: horloge.planifier,
      annuler: horloge.annuler,
    });
  return { disque, fs, racine, horloge, seance };
}

// Les personnes qu'un échange peut déplacer : présentes à tous les tours,
// non exclues, sans réservation ni titre pressenti.
function echangeables(charge) {
  const reservees = new Set(charge.reservations.map(({ participant }) => participant));
  return new Set(
    charge.participants
      .filter((p) => !p.exclu && !reservees.has(p.id) && p.presence === undefined && p.titrePressenti === null)
      .map(({ id }) => id),
  );
}

// L'échange de rang k : au tour k mod tours, la première personne
// échangeable de deux tables que k désigne. Une table sans personne
// échangeable passe à la suivante.
function echangeDeRang(charge, k) {
  const { placement, tables } = charge.retenu;
  const libres = echangeables(charge);
  const tour = (k % charge.evenement.tours) + 1;
  const { sieges } = placement[tour - 1];
  const premiere = (depart) => {
    for (let pas = 0; pas < tables.length; pas += 1) {
      const id = sieges[(depart + pas) % tables.length].find((p) => p !== null && libres.has(p));
      if (id !== undefined) return id;
    }
    throw new Error(`échange ${k} : aucune personne échangeable`);
  };
  const a = premiere((5 * k) % tables.length);
  const b = premiere((5 * k + 11) % tables.length);
  return { tour, a, b };
}

// Les lignes qui comblent le journal du disque jusqu'à PLAFOND_ENTREES
// entrées : depuis la charge c de l'état, une charge voisine c2 — un réglage
// basculé — et c alternent, chaque ligne sous la forme que ligneEntree donne
// à son passage, comme dans depot.long.test.js. Rend le journal comblé,
// l'état à la dernière révision et le .precedent à celle d'avant.
function comble(texteJournal, texteEtat) {
  const journal = lireJournal(texteJournal);
  const premiere = journal.entrees[0].revision;
  const derniere = journal.entrees.at(-1).revision;
  const c = analyser(texteEtat).charge;
  const c2 = structuredClone(c);
  c2.reglages.nouveauxVoisins = !c2.reglages.nouveauxVoisins;
  const chargeDe = (revision) => ((revision - derniere) % 2 === 0 ? c : c2);
  const lignes = [];
  let revision = derniere;
  for (let n = journal.entrees.length; n < PLAFOND_ENTREES; n += 1) {
    revision += 1;
    lignes.push(
      ligneEntree({
        revision,
        libelle: `Réglage basculé ${revision}`,
        horodatage: heureComblee(revision - derniere),
        avant: chargeDe(revision - 1),
        apres: chargeDe(revision),
        instantane: estInstantane(revision, premiere),
      }),
    );
  }
  const etat = (r) => serialiser(chargeDe(r), { revision: r, produitVersion: V });
  return { journal: `${texteJournal}${lignes.join('\n')}\n`, etat: etat(revision), precedent: etat(revision - 1) };
}

describe('empreintes dorées : une séance de gestes sur la grande démonstration (§ 8.2, § 8.8, § 15.5)', () => {
  test('les propositions de la génération sont celles de la référence', () => {
    const charge = analyser(texteLivre('grande')).charge;
    const propositions = rechercher(configurationDepuisCharge(charge), GENERATION);
    assert.equal(sha256(JSON.stringify(propositions)), EMPREINTE_GENERATION);
  });

  test('chaque fichier écrit et chaque état publié, pas après pas, sont ceux de la référence', async () => {
    const { disque, fs, racine, horloge, seance: nouvelle } = await monter();
    const releves = [];
    let base = null;
    let seance = null;
    const contenu = (suffixe) => fs.contenu(racine.id, `${base}${suffixe}`);
    // Le relevé d'un pas : les quatre fichiers, l'état publié, l'historique,
    // et le texte du refus quand le pas en est un. L'horloge avance ensuite
    // d'une seconde : chaque pas a son instant.
    const relever = (pas, refus) => {
      const fichiers = [SUFFIXES.etat, SUFFIXES.precedent, SUFFIXES.journal, SUFFIXES.courses].map((s) =>
        empreinte(contenu(s)),
      );
      const publie = [JSON.stringify(seance.etat()), JSON.stringify(seance.historique())].map(empreinte);
      const textes = refus === null ? [...fichiers, ...publie] : [...fichiers, ...publie, empreinte(refus)];
      releves.push(`${releves.length + 1} ${pas} ${textes.join(' ')}`);
      horloge.avancer(1_000);
    };
    // Un geste de la séance, relevé. Un refus attendu, de code refus, se
    // relève aussi, son nom, son message et ses détails compris : il n'écrit
    // rien, et ce qu'il dit est une sortie.
    const geste = async (pas, faire, { refus = null } = {}) => {
      if (refus === null) {
        await faire();
        relever(pas, null);
        return;
      }
      let recu = null;
      await assert.rejects(faire, (erreur) => {
        recu = erreur;
        return erreur.code === refus;
      }, pas);
      relever(pas, `${recu.name} ${recu.message} ${JSON.stringify(recu.details)}`);
    };

    // L'événement : la grande démonstration créée dans le dépôt.
    const demonstration = analyser(texteLivre('grande')).charge;
    ({ base } = await creer(fs, racine, demonstration, {
      libelle: "Création de l'événement",
      nomJalon: 'Création',
      horodatage: horloge.horodatage(),
      produitVersion: V,
    }));
    seance = nouvelle();
    await geste('ouvrir', () => seance.ouvrir(base));
    await geste('écriture', () => seance.passerEnEcriture());
    const charge = () => seance.etat().charge;

    // Une génération, puis la deuxième proposition retenue.
    const propositions = rechercher(configurationDepuisCharge(charge()), GENERATION);
    await geste('générer', () =>
      seance.executer('enregistrerGeneration', {
        propositions,
        configuration: configurationDepuisCharge(charge()),
        produitVersion: V,
      }),
    );
    await geste('retenir', () => seance.executer('retenirProposition', { id: 2 }));
    const apresRetenir = lireJournal(contenu(SUFFIXES.journal)).entrees.at(-1).revision;

    // Les gestes : échanges dans le retenu, entre lesquels s'intercalent les
    // autres sortes, chacune à son rang, avec le refus qu'elle attend le cas
    // échéant.
    const cercle = { id: 23, champs: { appartenance: 'Cercle des Hérons' } };
    const sansEffet = { refus: 'SANS_EFFET' };
    const autres = new Map([
      [3, ['notes', () => seance.executer('modifierParticipant', { id: 17, champs: { notes: 'Arrive en retard' } })]],
      [5, ['appartenance', () => seance.executer('modifierParticipant', cercle)]],
      [7, ['ajouter', () => seance.executer('ajouterParticipant', { champs: { nom: 'Brindefeu', prenom: 'Aurèle' } })]],
      [9, ['sièges', () => seance.executer('changerPlacesTable', { id: 4, sieges: 10, origine: 'champ' })]],
      [10, ['sièges sans effet', () => seance.executer('changerPlacesTable', { id: 4, sieges: 10, origine: 'champ' }), sansEffet]],
      [11, ['exclure', () => seance.executer('exclureParticipant', { id: 40 })]],
      [14, ['titre', () => seance.executer('poserTitre', { table: 6, siege: null, libelle: 'accueil' })]],
      [17, ['présence', () => seance.executer('changerPresence', { id: 52, tours: [1, 2] })]],
      [20, ['réintégrer', () => seance.executer('reintegrerParticipant', { id: 40 })]],
      [24, ['notes bis', () => seance.executer('modifierParticipant', { id: 17, champs: { notes: 'Arrive à 19 h' } })]],
    ]);
    for (let k = 0; k < ECHANGES; k += 1) {
      if (autres.has(k)) {
        const [pas, faire, attendu] = autres.get(k);
        await geste(pas, faire, attendu);
      }
      const echange = echangeDeRang(charge(), k);
      await geste(`échange ${k}`, () => seance.executer('echangerDansRetenu', echange));
    }

    // Un geste sans effet, refusé ; un jalon ; les retours.
    const memesNotes = { id: 17, champs: { notes: 'Arrive à 19 h' } };
    await geste('sans effet', () => seance.executer('modifierParticipant', memesNotes), sansEffet);
    await geste('jalon', () => seance.nommer('Avant les retours'));
    for (let n = 1; n <= 5; n += 1) {
      await geste(`défaire ${n}`, () => seance.defaire(n % 2 === 0 ? { touche: 'Ctrl+Z' } : undefined));
    }
    await geste('refaire 1', () => seance.refaire({ touche: 'Ctrl+Y' }));
    await geste('refaire 2', () => seance.refaire());
    await geste('revenir', () => seance.revenir(apresRetenir));
    await geste('revenir sans effet', () => seance.revenir(apresRetenir), sansEffet);
    await geste('échange après revenir', () =>
      seance.executer('echangerDansRetenu', echangeDeRang(charge(), ECHANGES)),
    );
    await geste('fermer', () => seance.fermer());

    // Le journal comblé jusqu'au plafond, l'état et le .precedent récrits à
    // ses deux dernières révisions ; puis le geste qui l'élague.
    const comblee = comble(contenu(SUFFIXES.journal), contenu(SUFFIXES.etat));
    fs.deposer(racine.id, `${base}${SUFFIXES.journal}`, comblee.journal);
    fs.deposer(racine.id, `${base}${SUFFIXES.precedent}`, comblee.precedent);
    fs.deposer(racine.id, `${base}${SUFFIXES.etat}`, comblee.etat);
    assert.equal(lireJournal(comblee.journal).entrees.length, PLAFOND_ENTREES);
    await geste('rouvrir plein', () => seance.ouvrir(base));
    await geste('écriture pleine', () => seance.passerEnEcriture());
    await geste('échange qui élague', () =>
      seance.executer('echangerDansRetenu', echangeDeRang(charge(), ECHANGES + 1)),
    );
    assert.ok(lireJournal(contenu(SUFFIXES.journal)).entrees.length < PLAFOND_ENTREES, 'le journal est élagué');
    await geste('défaire après élagage', () => seance.defaire());
    await geste('fermer plein', () => seance.fermer());

    // La réouverture, par une séance neuve sur le même disque.
    seance = nouvelle(creerFichiersSimules({ disque }));
    await geste('réouverture', () => seance.ouvrir(base));
    await geste('fermer réouverture', () => seance.fermer());

    const liste = releves.join('\n');
    assert.equal(releves.length, RELEVES, liste);
    assert.equal(sha256(liste), EMPREINTE_SEANCE, liste);
  });
});
