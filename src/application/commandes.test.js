// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Épreuves des commandes nommées (§ 4, § 4.4, § 5.7, § 8.2, § 9, § 10.1) :
// chacune rend une charge neuve et un libellé figé, ne touche pas la charge
// reçue, tire ses identifiants de prochainsIds sans jamais en réutiliser un,
// et refuse par un code. Les noms d'épreuve sont inventés ; la version vient
// du module engendré.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { bilanRemplacement } from '../csv/import.js';
import { apercevoirObjectifs } from '../csv/objectifs.js';
import { rechercher, repartir } from '../moteur/recherche.js';
import { serialiser, serialiserCharge } from '../stockage/canonique.js';
import { analyser, configurationDepuisCharge, creerCharge, etatDeduit } from '../stockage/document.js';
import { cleDeCourse, courseDe, lireCourses, texteDesCourses } from '../stockage/courses.js';
import {
  courseDepuisFichier,
  derive,
  examiner,
  fauteDeCourse,
  fautes,
  formeNommee,
  planDepuisFichier,
} from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { readFileSync } from 'node:fs';
import { chargements } from '../../test/chargements.js';
import {
  COMMANDES,
  ErreurCommande,
  NOM_EVENEMENT_MAX,
  appliquerCommande,
  chargeNeuve,
  formeNommeeDe,
  refusNomEvenement,
  reunirCommandes,
} from './commandes.js';
import { evaluer, nettoyage } from './evaluation.js';
import { COMMANDES_MOBILIER } from './commandes_mobilier.js';
import { COMMANDES_PLACES } from './commandes_places.js';
import { derivationDe, planDuDepart, refusDuDepart } from './depart.js';
import { ErreurCommande as ErreurDesErreurs, refus } from './erreurs.js';

const V1 = VERSION.affichee;

const personne = (id, nom, prenom = null, appartenance = null) => ({
  id,
  nom,
  prenom,
  appartenance,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
});

const table = (id, x) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x, y: 0 } });

// Quatre personnes, deux tables de deux places, deux tours. Iris Ombrelle
// anime la table 1 : une réservation « tous » au siège 1, et le titre de ce
// siège.
function chargeEssai() {
  const charge = creerCharge({ id: 'evt-lucioles', nom: 'Soirée des Lucioles', siegesParDefaut: 2, tours: 2 });
  charge.prochainsIds = { participant: 5, table: 3, proposition: 1 };
  charge.participants = [
    personne(1, 'Ombrelle', 'Iris', 'Club des Merles'),
    personne(2, 'Grisaille', null, 'Club des Merles'),
    personne(3, 'Pervenche', 'Théo'),
    personne(4, 'Lacasse', 'Ondine', 'Société Alpha'),
  ];
  charge.tables = [table(1, 0), table(2, 250)];
  charge.reservations = [{ participant: 1, table: 1, siege: 1, portee: 'tous', tour: null }];
  charge.titres = [{ table: 1, siege: 1, libelle: 'animation' }];
  return charge;
}

// Les arguments d'enregistrerGeneration : une génération courte du moteur
// sur la configuration de la charge.
function generer(charge, nombre = 3, graine = 7) {
  const configuration = configurationDepuisCharge(charge);
  return { propositions: rechercher(configuration, { graine, arret: 40, nombre }), configuration, produitVersion: V1 };
}

// La charge d'essai, une cinquième personne exclue, deux propositions et la
// première retenue.
function chargeRiche() {
  const charge = chargeEssai();
  charge.participants.push({ ...personne(5, 'Ancolie', 'Amandine'), exclu: true });
  charge.prochainsIds.participant = 6;
  const generee = COMMANDES.get('enregistrerGeneration')(charge, generer(charge, 2)).charge;
  return COMMANDES.get('retenirProposition')(generee, { id: 1 }).charge;
}

// Gèle une valeur en profondeur : une commande qui la modifierait lèverait.
function figer(valeur) {
  if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
    Object.freeze(valeur);
    for (const element of Object.values(valeur)) figer(element);
  }
  return valeur;
}

// Le refus attendu : une ErreurCommande de ce code, et de ces détails quand
// ils sont donnés.
function refuse(appel, code, details) {
  assert.throws(appel, (erreur) => {
    assert.ok(erreur instanceof ErreurCommande, `ErreurCommande attendue, reçu ${erreur}`);
    assert.equal(erreur.code, code);
    if (details !== undefined) assert.deepEqual(erreur.details, details);
    return true;
  });
}

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);

const CSV_DEUX = 'nom;prenom;appartenance\nAncolie;Bastien;Club des Merles\nBruyère;Capucine;\n';

describe('commandes : le registre (§ 8.2)', () => {
  test("le registre porte les onze commandes d'A1, changerEtiquettes, garderMeilleures, les dix des places et celles du mobilier, chacune une fonction", () => {
    const attendues = [
      'ajouterParticipant',
      'changerEtat',
      'changerEtiquettes',
      'convertirEnTous',
      'debloquer',
      'deplacerDansRetenu',
      'deplacerReservation',
      'designer',
      'echangerDansRetenu',
      'effacerPropositions',
      'enregistrerGeneration',
      'exclureParticipant',
      'garderMeilleures',
      'importerObjectifs',
      'importerParticipants',
      'modifierParticipant',
      'poserTitre',
      'reintegrerParticipant',
      'reserver',
      'retenirProposition',
      'retirerDuTour',
      'retirerReservation',
      'retirerTitre',
      'supprimerParticipant',
    ];
    assert.equal(attendues.length, 24);
    assert.deepEqual([...COMMANDES.keys()].sort(), [...attendues, ...COMMANDES_MOBILIER.keys()].sort());
    for (const commande of COMMANDES.values()) assert.equal(typeof commande, 'function');
  });

  test('appliquerCommande rend charge, libellé et avertissements ; un nom inconnu est une faute du code', () => {
    const rendu = appliquerCommande('ajouterParticipant', chargeEssai(), { champs: { nom: 'Bruyère' } });
    assert.equal(rendu.libelle, 'Ajouté Bruyère');
    assert.deepEqual(rendu.avertissements, []);
    assert.equal(rendu.charge.participants.length, 5);
    assert.throws(() => appliquerCommande('commandeInventee', chargeEssai(), {}), TypeError);
  });

  test('un geste qui ne change pas la charge est refusé SANS_EFFET', () => {
    const charge = chargeEssai();
    const apercu = apercevoir('nom;prenom\nLacasse;Ondine\n', { participants: charge.participants, mode: 'mettreAJour' });
    refuse(() => appliquerCommande('importerParticipants', charge, { apercu, mode: 'mettreAJour' }), 'SANS_EFFET', {
      commande: 'importerParticipants',
      remede: null,
    });
  });
});

describe('commandes : les participants (§ 4, § 4.4, § 10.2)', () => {
  test('ajouter : seul le nom est requis ; les autres champs valent null, exclu faux ; le compteur avance', () => {
    const { charge, libelle, avertissements } = executer('ajouterParticipant', chargeEssai(), { champs: { nom: '  Pervenche ' } });
    assert.deepEqual(charge.participants.at(-1), personne(5, 'Pervenche'));
    assert.equal(charge.prochainsIds.participant, 6);
    assert.equal(libelle, 'Ajouté Pervenche');
    assert.deepEqual(avertissements, []);
    const complet = executer('ajouterParticipant', chargeEssai(), {
      champs: { nom: 'Parasol', prenom: 'Iris', appartenance: 'Club des Merles', courriel: '', notes: ' arrive tard ', exclu: true },
    });
    assert.deepEqual(complet.charge.participants.at(-1), {
      ...personne(5, 'Parasol', 'Iris', 'Club des Merles'),
      notes: 'arrive tard',
      exclu: true,
    });
    assert.equal(complet.libelle, 'Ajouté Iris Parasol');
  });

  test('ajouter : un nom saisi en NFD est enregistré en NFC', () => {
    const { charge, libelle } = executer('ajouterParticipant', chargeEssai(), { champs: { nom: 'Pervenche', prenom: 'The\u{301}o' } });
    assert.equal(charge.participants.at(-1).prenom, 'Th\u{E9}o');
    assert.equal(libelle, 'Ajouté Th\u{E9}o Pervenche');
  });

  test('ajouter : un nom vide ou blanc est refusé NOM_REQUIS ; un champ inconnu ou de forme fausse est une faute du code', () => {
    refuse(() => executer('ajouterParticipant', chargeEssai(), { champs: { nom: '  ' } }), 'NOM_REQUIS', { remede: null });
    refuse(() => executer('ajouterParticipant', chargeEssai(), { champs: { prenom: 'Iris' } }), 'NOM_REQUIS');
    assert.throws(() => executer('ajouterParticipant', chargeEssai(), { champs: { nom: 'Bruyère', age: 3 } }), TypeError);
    assert.throws(() => executer('ajouterParticipant', chargeEssai(), { champs: { nom: 'Bruyère', exclu: 'oui' } }), TypeError);
    assert.throws(() => executer('ajouterParticipant', chargeEssai(), { champs: { nom: 42 } }), TypeError);
  });

  test("un identifiant ne se réutilise jamais : supprimer ne fait pas reculer le compteur (§ 4)", () => {
    const ajoutee = executer('ajouterParticipant', chargeEssai(), { champs: { nom: 'Bruyère' } }).charge;
    const supprimee = executer('supprimerParticipant', ajoutee, { id: 5 }).charge;
    assert.equal(supprimee.prochainsIds.participant, 6);
    const rajoutee = executer('ajouterParticipant', supprimee, { champs: { nom: 'Bruyère' } }).charge;
    assert.deepEqual(rajoutee.participants.map(({ id }) => id), [1, 2, 3, 4, 6]);
  });

  test('modifier : le libellé nomme la personne et chaque champ changé', () => {
    const { charge, libelle } = executer('modifierParticipant', chargeEssai(), { id: 4, champs: { courriel: ' o@exemple.test ' } });
    assert.equal(charge.participants[3].courriel, 'o@exemple.test');
    assert.equal(libelle, 'Modifié Ondine Lacasse : courriel');
    const deux = executer('modifierParticipant', chargeEssai(), { id: 3, champs: { notes: 'à jeun', titrePressenti: 'hôte', courriel: null } });
    assert.equal(deux.libelle, 'Modifié Théo Pervenche : titre pressenti, notes');
  });

  test("modifier : renommer garde l'ancien nom au libellé et nomme le nouveau", () => {
    const { charge, libelle } = executer('modifierParticipant', chargeEssai(), { id: 1, champs: { nom: 'Parasol' } });
    assert.equal(charge.participants[0].nom, 'Parasol');
    assert.equal(libelle, 'Modifié Iris Ombrelle : nom (désormais Iris Parasol)');
  });

  test('modifier : sans changement SANS_EFFET ; personne inconnue ; nom vidé ; exclu passe par sa commande', () => {
    refuse(() => executer('modifierParticipant', chargeEssai(), { id: 4, champs: { nom: 'Lacasse', courriel: '' } }), 'SANS_EFFET');
    refuse(() => executer('modifierParticipant', chargeEssai(), { id: 9, champs: { nom: 'Lacasse' } }), 'PARTICIPANT_INCONNU', {
      id: 9,
      remede: null,
    });
    refuse(() => executer('modifierParticipant', chargeEssai(), { id: 4, champs: { nom: ' ' } }), 'NOM_REQUIS');
    assert.throws(() => executer('modifierParticipant', chargeEssai(), { id: 4, champs: { exclu: true } }), TypeError);
  });

  test("exclure : les réservations restent, suspendues ; le titre n'est plus pourvu ; l'avertissement le dit (§ 4.4)", () => {
    const avant = chargeEssai();
    assert.equal(bilanRemplacement(avant).titresPourvus, 1);
    const { charge, libelle, avertissements } = executer('exclureParticipant', avant, { id: 1 });
    assert.equal(charge.participants[0].exclu, true);
    assert.deepEqual(charge.reservations, avant.reservations);
    assert.deepEqual(charge.titres, avant.titres);
    assert.equal(bilanRemplacement(charge).titresPourvus, 0);
    assert.equal(libelle, 'Exclu Iris Ombrelle');
    assert.deepEqual(avertissements, [
      { code: 'RESERVATIONS_SUSPENDUES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } },
    ]);
  });

  test('réintégrer rend les réservations et le titre, et le dit', () => {
    const exclue = executer('exclureParticipant', chargeEssai(), { id: 1 }).charge;
    const { charge, libelle, avertissements } = executer('reintegrerParticipant', exclue, { id: 1 });
    assert.equal(charge.participants[0].exclu, false);
    assert.equal(bilanRemplacement(charge).titresPourvus, 1);
    assert.equal(libelle, 'Réintégré Iris Ombrelle');
    assert.deepEqual(avertissements, [
      { code: 'RESERVATIONS_RETABLIES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } },
    ]);
  });

  test("exclure sans réservation n'avertit pas ; exclure deux fois, réintégrer une présente : SANS_EFFET", () => {
    assert.deepEqual(executer('exclureParticipant', chargeEssai(), { id: 3 }).avertissements, []);
    const exclue = executer('exclureParticipant', chargeEssai(), { id: 3 }).charge;
    refuse(() => executer('exclureParticipant', exclue, { id: 3 }), 'SANS_EFFET');
    refuse(() => executer('reintegrerParticipant', chargeEssai(), { id: 3 }), 'SANS_EFFET');
    refuse(() => executer('exclureParticipant', chargeEssai(), { id: 9 }), 'PARTICIPANT_INCONNU');
  });

  test('supprimer : ses réservations partent, les titres et les propositions restent, signalées en dérive', () => {
    const avant = chargeRiche();
    const { charge, libelle, avertissements } = executer('supprimerParticipant', avant, { id: 1 });
    assert.deepEqual(charge.participants.map(({ id }) => id), [2, 3, 4, 5]);
    assert.deepEqual(charge.reservations, []);
    assert.deepEqual(charge.titres, avant.titres);
    assert.deepEqual(charge.prochainsIds, avant.prochainsIds);
    assert.deepEqual(charge.propositions, avant.propositions);
    assert.ok(derive(charge.propositions[0], charge).some(({ code, participant }) => code === 'PARTICIPANT_SUPPRIME' && participant === 1));
    assert.equal(libelle, 'Supprimé Iris Ombrelle');
    assert.deepEqual(avertissements, [
      { code: 'RESERVATIONS_RETIREES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } },
    ]);
    refuse(() => executer('supprimerParticipant', chargeEssai(), { id: 9 }), 'PARTICIPANT_INCONNU');
  });
});

describe('commandes : les étiquettes d’une personne (§ 4.5, § 5.9, A12)', () => {
  // La charge d'essai, Iris Ombrelle « finance », la table 2 d'objectif de
  // soirée « ressources humaines » sous sa règle propre.
  function chargeEtiquetee() {
    const charge = chargeEssai();
    charge.participants[0].etiquettes = ['finance'];
    charge.tables[1].objectifs = [{ portee: 'tous', tour: null, regle: 'ou', etiquettes: ['ressources humaines'] }];
    return charge;
  }
  const etiquettesDe = (charge, id) => charge.participants.find((p) => p.id === id).etiquettes;

  test('ajouter une saisie de deux étiquettes : triées par unités de code, le libellé nomme la personne et chacune', () => {
    const rendu = executer('changerEtiquettes', figer(chargeEssai()), { id: 3, ajouter: ' voile ; Montre\u{0301}al ' });
    assert.deepEqual(etiquettesDe(rendu.charge, 3), ['Montréal', 'voile']);
    assert.equal(rendu.libelle, 'Étiquettes de Théo Pervenche : ajouté « Montréal » et « voile »');
    assert.deepEqual(rendu.avertissements, []);
    const ordre = Object.keys(rendu.charge.participants[2]);
    assert.equal(ordre.at(-1), 'etiquettes');
  });

  test('« a|b » saisi sur la fiche fait deux étiquettes : la barre sépare', () => {
    assert.deepEqual(etiquettesDe(executer('changerEtiquettes', chargeEssai(), { id: 3, ajouter: 'a|b' }).charge, 3), ['a', 'b']);
  });

  test("l'orthographe existante d'une personne est reçue, et le dit : ORTHOGRAPHE_RETENUE {saisie, retenue}", () => {
    const rendu = executer('changerEtiquettes', chargeEtiquetee(), { id: 3, ajouter: 'FINANCE' });
    assert.deepEqual(etiquettesDe(rendu.charge, 3), ['finance']);
    assert.deepEqual(rendu.avertissements, [{ code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'FINANCE', retenue: 'finance' } }]);
  });

  test("deux orthographes d'une clé que l'événement ne porte pas se fondent dans la saisie, sans avertissement", () => {
    const rendu = executer('changerEtiquettes', chargeEssai(), { id: 3, ajouter: 'Montréal, MONTRÉAL' });
    assert.deepEqual(etiquettesDe(rendu.charge, 3), ['MONTRÉAL']);
    assert.deepEqual(rendu.avertissements, []);
  });

  test("la réconciliation lit l'événement entier : une étiquette que seul un objectif porte donne son orthographe", () => {
    const rendu = executer('changerEtiquettes', chargeEtiquetee(), { id: 4, ajouter: 'Ressources  Humaines' });
    assert.deepEqual(etiquettesDe(rendu.charge, 4), ['ressources humaines']);
    assert.deepEqual(rendu.avertissements, [
      { code: 'ORTHOGRAPHE_RETENUE', details: { saisie: 'Ressources Humaines', retenue: 'ressources humaines' } },
    ]);
  });

  test("deux orthographes déjà présentes dans un fichier retouché : la plus petite par points de code est reçue", () => {
    const charge = chargeEtiquetee();
    charge.participants[1].etiquettes = ['Finance'];
    assert.deepEqual(etiquettesDe(executer('changerEtiquettes', charge, { id: 3, ajouter: 'finance' }).charge, 3), ['Finance']);
  });

  test('retirer : la dernière étiquette retirée retire le champ ; une étiquette et sa nouvelle orthographe dans un même geste', () => {
    const charge = chargeEtiquetee();
    const retiree = executer('changerEtiquettes', charge, { id: 1, retirer: 'finance' });
    assert.equal(Object.hasOwn(retiree.charge.participants[0], 'etiquettes'), false);
    assert.equal(retiree.libelle, 'Étiquettes de Iris Ombrelle : retiré « finance »');
    // Seule à porter « finance », Iris la renomme : l'orthographe retirée ne
    // s'impose plus à la saisie.
    const renommee = executer('changerEtiquettes', charge, { id: 1, retirer: 'finance', ajouter: 'Finance' });
    assert.deepEqual(etiquettesDe(renommee.charge, 1), ['Finance']);
    assert.deepEqual(renommee.avertissements, []);
    assert.equal(renommee.libelle, 'Étiquettes de Iris Ombrelle : ajouté « Finance » ; retiré « finance »');
  });

  test('SANS_EFFET par comparaison d’ensembles : une étiquette déjà portée, son autre orthographe, une étiquette absente à retirer', () => {
    const charge = chargeEtiquetee();
    charge.participants[0].etiquettes = ['finance', 'voile'];
    for (const args of [
      { id: 1, ajouter: 'voile, finance' },
      { id: 1, ajouter: 'Finance' },
      { id: 1, retirer: 'escalade' },
      { id: 1, retirer: 'finance', ajouter: 'finance' },
    ]) {
      refuse(() => executer('changerEtiquettes', charge, args), 'SANS_EFFET', { commande: 'changerEtiquettes', remede: null });
    }
  });

  test('une étiquette mal formée est refusée ETIQUETTE_INVALIDE {valeur, raison}, remède null ; une saisie vide aussi', () => {
    const charge = chargeEssai();
    refuse(() => executer('changerEtiquettes', charge, { id: 3, ajouter: 'voile, a\u{0009}b' }), 'ETIQUETTE_INVALIDE', {
      valeur: 'a\u{0009}b',
      raison: 'controle',
      remede: null,
    });
    const longue = 'x'.repeat(41);
    refuse(() => executer('changerEtiquettes', charge, { id: 3, ajouter: longue }), 'ETIQUETTE_INVALIDE', {
      valeur: longue,
      raison: 'longueur',
      remede: null,
    });
    for (const vide of ['', '   ', ' ,; | ']) {
      refuse(() => executer('changerEtiquettes', charge, { id: 3, ajouter: vide }), 'ETIQUETTE_INVALIDE', { valeur: '', raison: 'vide', remede: null });
    }
    assert.deepEqual(etiquettesDe(executer('changerEtiquettes', charge, { id: 3, ajouter: 'x'.repeat(40) }).charge, 3), ['x'.repeat(40)]);
  });

  test('une vingt-et-unième étiquette est refusée ETIQUETTES_EN_TROP {nombre}, remède null ; la vingtième passe', () => {
    const charge = chargeEssai();
    charge.participants[2].etiquettes = Array.from({ length: 19 }, (_, rang) => `e${String(rang).padStart(2, '0')}`);
    assert.equal(etiquettesDe(executer('changerEtiquettes', charge, { id: 3, ajouter: 'voile' }).charge, 3).length, 20);
    refuse(() => executer('changerEtiquettes', charge, { id: 3, ajouter: 'voile, escalade' }), 'ETIQUETTES_EN_TROP', { nombre: 21, remede: null });
  });

  test('les mêmes étiquettes sous deux ordres de saisie s’écrivent pareil', () => {
    const une = executer('changerEtiquettes', chargeEssai(), { id: 3, ajouter: 'voile, Montréal, escalade' }).charge;
    let autre = executer('changerEtiquettes', chargeEssai(), { id: 3, ajouter: 'escalade' }).charge;
    autre = executer('changerEtiquettes', autre, { id: 3, ajouter: 'Montréal | voile' }).charge;
    assert.equal(serialiserCharge(une), serialiserCharge(autre));
    assert.deepEqual(etiquettesDe(une, 3), etiquettesDe(autre, 3));
  });

  test("personne inconnue, plan bloqué, arguments de forme fausse", () => {
    refuse(() => executer('changerEtiquettes', chargeEssai(), { id: 42, ajouter: 'voile' }), 'PARTICIPANT_INCONNU', { id: 42, remede: null });
    const bloquee = { ...chargeEssai(), evenement: { ...chargeEssai().evenement, etat: 'bloque' } };
    refuse(() => executer('changerEtiquettes', bloquee, { id: 3, ajouter: 'voile' }), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
    for (const args of [{ id: 3 }, { id: 3, ajouter: 4 }, { id: 3, retirer: ['voile'] }, { id: 3, retirer: null }]) {
      assert.throws(() => executer('changerEtiquettes', chargeEssai(), args), TypeError, JSON.stringify(args));
    }
  });

  test('changer les étiquettes ne met aucune proposition en dérive (D13)', () => {
    const charge = chargeRiche();
    const apres = executer('changerEtiquettes', charge, { id: 2, ajouter: 'finance' }).charge;
    for (const placement of [...charge.propositions, charge.retenu]) {
      assert.deepEqual(derive(placement, apres), derive(placement, charge));
    }
  });
});

describe("commandes : l'import (§ 10.1)", () => {
  test('ajouter : chaque ligne valide devient une personne, sous le compteur, en une seule commande', () => {
    const avant = chargeEssai();
    const apercu = apercevoir(CSV_DEUX, { participants: avant.participants });
    const { charge, libelle, resume } = executer('importerParticipants', avant, { apercu, mode: 'ajouter' });
    assert.deepEqual(charge.participants.slice(4).map(({ id, nom, prenom, appartenance }) => [id, nom, prenom, appartenance]), [
      [5, 'Ancolie', 'Bastien', 'Club des Merles'],
      [6, 'Bruyère', 'Capucine', null],
    ]);
    assert.equal(charge.prochainsIds.participant, 7);
    assert.equal(libelle, 'Importé 2 participants');
    assert.equal(resume.ajoutes, 2);
  });

  test('remplacer et mettre à jour se nomment au libellé, chaque compte à sa place', () => {
    const avant = chargeEssai();
    const apercu = apercevoir(CSV_DEUX, { participants: avant.participants, mode: 'remplacer' });
    const remplace = executer('importerParticipants', avant, { apercu, mode: 'remplacer' });
    assert.equal(remplace.libelle, 'Remplacé la liste par import : 4 retirés, 2 ajoutés');
    assert.deepEqual(remplace.charge.reservations, []);
    // Deux ajoutés, un modifié : des comptes distincts, qu'un libellé qui les
    // intervertirait ne rendrait pas.
    const csv = 'nom;prenom;courriel\nLacasse;Ondine;o@exemple.test\nAncolie;Bastien;\nBruyère;Capucine;\n';
    const misAJour = executer('importerParticipants', avant, {
      apercu: apercevoir(csv, { participants: avant.participants, mode: 'mettreAJour' }),
      mode: 'mettreAJour',
    });
    assert.deepEqual([misAJour.resume.ajoutes, misAJour.resume.misAJour], [2, 1]);
    assert.equal(misAJour.libelle, 'Mis à jour la liste par import : 2 ajoutés, 1 modifié');
  });

  test("importer selon l'état : rien en brouillon et proposé, l'avertissement de dérive en retenu, refusé en bloqué", () => {
    const enRetenu = [{ code: 'IMPORT_EN_RETENU', details: {} }];
    const brouillon = chargeEssai();
    const proposee = executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2)).charge;
    const retenue = chargeRiche();
    assert.deepEqual([brouillon, proposee, retenue].map(({ evenement }) => evenement.etat), ['brouillon', 'propose', 'retenu']);
    const ajout = (charge, mode = 'ajouter') => ({ apercu: apercevoir('nom\nBruyère\n', { participants: charge.participants, mode }), mode });
    assert.deepEqual(executer('importerParticipants', brouillon, ajout(brouillon)).avertissements, []);
    assert.deepEqual(executer('importerParticipants', proposee, ajout(proposee)).avertissements, []);
    for (const mode of ['ajouter', 'mettreAJour', 'remplacer']) {
      assert.deepEqual(executer('importerParticipants', retenue, ajout(retenue, mode)).avertissements, enRetenu, mode);
    }
    // Une mise à jour sans personne nouvelle avertit aussi : le placement
    // retenu date de la liste d'avant.
    const courriel = apercevoir('nom;prenom;courriel\nLacasse;Ondine;o@exemple.test\n', {
      participants: retenue.participants,
      mode: 'mettreAJour',
    });
    const misAJour = executer('importerParticipants', retenue, { apercu: courriel, mode: 'mettreAJour' });
    assert.deepEqual([misAJour.resume.ajoutes, misAJour.resume.misAJour], [0, 1]);
    assert.deepEqual(misAJour.avertissements, enRetenu);
    const bloquee = { ...retenue, evenement: { ...retenue.evenement, etat: 'bloque' } };
    refuse(() => executer('importerParticipants', bloquee, ajout(bloquee)), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
  });

  test("un aperçu refusé ou ambigu est refusé sous son code ; un plan bloqué nomme le remède « Débloquer »", () => {
    const avant = chargeEssai();
    const sansNom = apercevoir('prenom;courriel\nIris;i@exemple.test\n', { participants: avant.participants });
    refuse(() => executer('importerParticipants', avant, { apercu: sansNom, mode: 'ajouter' }), 'NOM_NON_ASSOCIE', {
      ligne: null,
      remede: null,
    });
    const ambigu = apercevoir('nom;organisation;entreprise\nAncolie;A;B\n', { participants: avant.participants });
    refuse(() => executer('importerParticipants', avant, { apercu: ambigu, mode: 'ajouter' }), 'AMBIGUITE', {
      champs: ['appartenance'],
      remede: null,
    });
    const bloquee = { ...avant, evenement: { ...avant.evenement, etat: 'bloque' } };
    const apercu = apercevoir(CSV_DEUX, { participants: avant.participants });
    refuse(() => executer('importerParticipants', bloquee, { apercu, mode: 'ajouter' }), 'PLAN_BLOQUE', {
      remede: { geste: 'debloquer' },
    });
  });
});

describe("commandes : l'import qui exclut, réintègre ou ne change rien (§ 4.4, § 10.1)", () => {
  // La charge d'essai, où Ondine Lacasse tient aussi une réservation, au
  // tour 1, sans siège.
  function deuxReservees() {
    const charge = chargeEssai();
    charge.reservations.push({ participant: 4, table: 2, siege: null, portee: 'tour', tour: 1 });
    return charge;
  }
  const importer = (charge, csv) =>
    appliquerCommande('importerParticipants', charge, {
      apercu: apercevoir(csv, { participants: charge.participants, mode: 'mettreAJour' }),
      mode: 'mettreAJour',
    });

  test("une mise à jour qui exclut des personnes réservées le dit pour chacune, comme exclure (§ 4.4)", () => {
    const avant = figer(deuxReservees());
    const rendu = importer(avant, 'nom;prenom;exclu\nOmbrelle;Iris;oui\nLacasse;Ondine;oui\nPervenche;Théo;oui\n');
    assert.equal(rendu.libelle, 'Mis à jour la liste par import : 0 ajouté, 3 modifiés');
    assert.deepEqual(rendu.avertissements, [
      { code: 'RESERVATIONS_SUSPENDUES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } },
      { code: 'RESERVATIONS_SUSPENDUES', details: { participant: 4, personne: 'Ondine Lacasse', reservations: 1, titres: 0 } },
    ]);
    // Le même bilan que la commande d'exclusion, personne par personne.
    assert.deepEqual(rendu.avertissements[0], executer('exclureParticipant', avant, { id: 1 }).avertissements[0]);
    assert.deepEqual(rendu.avertissements[1], executer('exclureParticipant', avant, { id: 4 }).avertissements[0]);
  });

  test('une mise à jour qui réintègre une personne réservée le dit, comme réintégrer ; en retenu, après la dérive', () => {
    const exclue = executer('exclureParticipant', chargeEssai(), { id: 1 }).charge;
    const rendu = importer(exclue, 'nom;prenom;exclu\nOmbrelle;Iris;non\n');
    const retablies = { code: 'RESERVATIONS_RETABLIES', details: { participant: 1, personne: 'Iris Ombrelle', reservations: 1, titres: 1 } };
    assert.deepEqual(rendu.avertissements, [retablies]);
    assert.equal(rendu.charge.participants[0].exclu, false);
    const retenue = chargeRiche();
    const enRetenu = importer(retenue, 'nom;prenom;exclu\nOmbrelle;Iris;oui\n');
    assert.deepEqual(enRetenu.avertissements.map(({ code }) => code), ['IMPORT_EN_RETENU', 'RESERVATIONS_SUSPENDUES']);
  });

  test("une mise à jour dont les lignes valides ne changent rien, mais qui refuse des lignes, n'est pas SANS_EFFET : elle rend son résumé, sans entrée", () => {
    const avant = chargeEssai();
    avant.participants.push(personne(5, 'Lacasse', 'Ondine'));
    avant.prochainsIds.participant = 6;
    figer(avant);
    const rendu = importer(avant, 'nom;prenom;courriel\nLacasse;Ondine;o@exemple.test\nPervenche;Théo;\n');
    assert.equal(rendu.libelle, null);
    assert.deepEqual(rendu.avertissements, []);
    assert.equal(rendu.charge, avant);
    assert.deepEqual(rendu.resume.refusees.map(({ ligne, code, participants }) => [ligne, code, participants]), [
      [2, 'PLUSIEURS_CORRESPONDENT', [4, 5]],
    ]);
    assert.deepEqual([rendu.resume.ajoutes, rendu.resume.misAJour, rendu.resume.inchanges], [0, 0, 1]);
  });
});

describe("commandes : l'import des objectifs de table (§ 10.4)", () => {
  // La charge d'essai, Iris Ombrelle étiquetée « finance », Théo Pervenche
  // « Montréal », et la table 1 portant un objectif de soirée.
  function etiquetee(charge = chargeEssai()) {
    const suivante = structuredClone(charge);
    suivante.participants[0].etiquettes = ['finance'];
    suivante.participants[2].etiquettes = ['Montréal'];
    suivante.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['finance'] }];
    return suivante;
  }
  const importer = (charge, texte, mode = 'mettreAJour') =>
    appliquerCommande('importerObjectifs', charge, { apercu: apercevoirObjectifs(texte, charge, { mode }), mode });

  test('mettre à jour et remplacer : une seule commande, le libellé nomme le mode et les comptes, le résumé suit', () => {
    const avant = figer(etiquetee());
    const misAJour = importer(avant, 'table;tour;objectif;regle\n1;;finance, Montréal;ou\n2;2;MONTRÉAL;\n');
    assert.equal(misAJour.libelle, 'Mis à jour les objectifs de table par import : 1 ajouté, 1 remplacé');
    assert.deepEqual(misAJour.charge.tables.map(({ objectifs }) => objectifs), [
      [{ portee: 'tous', tour: null, regle: 'ou', etiquettes: ['Montréal', 'finance'] }],
      [{ portee: 'tour', tour: 2, regle: null, etiquettes: ['Montréal'] }],
    ]);
    assert.deepEqual(misAJour.avertissements, []);
    assert.deepEqual(
      [misAJour.resume.ajoutes, misAJour.resume.remplaces, misAJour.resume.inchanges, misAJour.resume.tables],
      [1, 1, 0, 2],
    );
    const remplace = importer(avant, 'table;tour;objectif\n2;1;finance\n', 'remplacer');
    assert.equal(remplace.libelle, 'Remplacé les objectifs de table par import : 1 retiré, 1 ajouté, 0 remplacé');
    assert.ok(!Object.hasOwn(remplace.charge.tables[0], 'objectifs'));
    assert.deepEqual(remplace.charge.tables[1].objectifs, [{ portee: 'tour', tour: 1, regle: null, etiquettes: ['finance'] }]);
    assert.deepEqual(remplace.charge.participants, avant.participants);
  });

  test("en retenu, IMPORT_OBJECTIFS_RECLASSE, et aucune proposition ni le retenu ne passent en dérive ; rien en brouillon et proposé ; refusé en bloqué", () => {
    const retenue = etiquetee(chargeRiche());
    assert.equal(retenue.evenement.etat, 'retenu');
    const raisons = (charge) => [...charge.propositions, charge.retenu].map((placement) => derive(placement, charge));
    const rendu = importer(retenue, 'table;tour;objectif\n2;;finance\n1;2;Montréal\n');
    assert.deepEqual(rendu.avertissements, [{ code: 'IMPORT_OBJECTIFS_RECLASSE', details: {} }]);
    assert.deepEqual(raisons(rendu.charge), raisons(retenue));
    assert.deepEqual(rendu.charge.propositions, retenue.propositions);
    assert.deepEqual(rendu.charge.retenu, retenue.retenu);
    const proposee = etiquetee(executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2)).charge);
    assert.equal(proposee.evenement.etat, 'propose');
    assert.deepEqual(importer(proposee, 'table;objectif\n2;finance\n').avertissements, []);
    const bloquee = { ...retenue, evenement: { ...retenue.evenement, etat: 'bloque' } };
    refuse(() => importer(bloquee, 'table;objectif\n2;finance\n'), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
  });

  test("l'avis OBJECTIF_SANS_CORRESPONDANT des seuls objectifs écrits, relayé d'avisObjectifs, après la dérive", () => {
    const charge = etiquetee(chargeRiche());
    // La table 1 garde un objectif que personne ne sert : il ne se redit pas.
    charge.tables[0].objectifs = [{ portee: 'tous', tour: null, regle: null, etiquettes: ['voile'] }];
    const rendu = importer(charge, 'table;tour;objectif;regle\n2;;finance, Montréal;et\n2;1;finance;\n');
    assert.deepEqual(rendu.avertissements, [
      { code: 'IMPORT_OBJECTIFS_RECLASSE', details: {} },
      { code: 'OBJECTIF_SANS_CORRESPONDANT', details: { table: 2, tour: null } },
    ]);
  });

  test("un aperçu refusé ou ambigu est refusé sous son code, remède null ; OBJECTIFS_SANS_TABLE mène à la section des tables", () => {
    const avant = etiquetee();
    refuse(() => importer(avant, 'tour;objectif\n1;finance\n'), 'TABLE_NON_ASSOCIEE', { ligne: null, remede: null });
    refuse(() => importer(avant, 'table;objectif\n1;"finance\n'), 'GUILLEMET_OUVERT', { ligne: 2, remede: null });
    refuse(() => importer(avant, 'table;regle;règle;objectif\n1;ou;et;finance\n'), 'AMBIGUITE', { champs: ['regle'], remede: null });
    const sansTable = { ...avant, tables: [] };
    refuse(() => importer(sansTable, 'table;objectif\n1;finance\n'), 'OBJECTIFS_SANS_TABLE', {
      ligne: null,
      remede: { geste: 'ouvrirSection', section: 'tables' },
    });
  });

  test("un import qui ne change rien est SANS_EFFET ; qui ne change rien mais refuse des lignes rend son résumé, sans entrée", () => {
    const avant = figer(etiquetee());
    refuse(() => importer(avant, 'table;objectif\n1;finance\n'), 'SANS_EFFET', { commande: 'importerObjectifs', remede: null });
    const rendu = importer(avant, 'table;tour;objectif;regle\n1;;FINANCE;\n2;;finance;peut-être\n');
    assert.equal(rendu.libelle, null);
    assert.equal(rendu.charge, avant);
    assert.deepEqual(rendu.avertissements, []);
    assert.deepEqual(rendu.resume.refusees.map(({ ligne, code }) => [ligne, code]), [[3, 'REGLE_INCONNUE']]);
    assert.equal(rendu.resume.inchanges, 1);
  });
});

describe('commandes : la forme nommée, une lecture (§ 8.9, point 4)', () => {
  test("rend la forme nommée d'une proposition ou du retenu, avec ses fautes, sans toucher la charge", () => {
    const charge = figer(chargeRiche());
    assert.deepEqual(formeNommeeDe(charge, { proposition: 2 }), {
      lignes: formeNommee(charge.propositions[1], charge),
      fautes: [],
    });
    const retenu = formeNommeeDe(charge, { retenu: true });
    assert.deepEqual(retenu, { lignes: formeNommee(charge.retenu, charge), fautes: [] });
    assert.ok(retenu.lignes.length > 0);
    assert.ok(retenu.lignes.every(({ nom }) => typeof nom === 'string'));
  });

  test("un retenu incohérent se lit quand même : une ligne par identifiant écrit, et ses fautes à côté", () => {
    const charge = chargeRiche();
    const assis = charge.retenu.placement[0].sieges[0][0];
    charge.retenu.placement[0].reserve = [...charge.retenu.placement[0].reserve, assis].sort((a, b) => a - b);
    const coherent = chargeRiche();
    const lue = formeNommeeDe(charge, { retenu: true });
    assert.deepEqual(lue.fautes, [{ code: 'DOUBLON', tour: 1, participant: assis }]);
    assert.deepEqual(lue.fautes, fautes(charge.retenu));
    assert.equal(lue.lignes.length, formeNommee(coherent.retenu, coherent).length + 1);
    assert.equal(lue.lignes.filter(({ tour, participant }) => tour === 1 && participant === assis).length, 2);
  });

  test("un placement dont la forme est fausse n'a pas de lignes : ses fautes seules le disent", () => {
    const charge = chargeRiche();
    charge.retenu.placement = 'illisible';
    const lue = formeNommeeDe(charge, { retenu: true });
    assert.equal(lue.lignes, null);
    assert.deepEqual(lue.fautes.map(({ code }) => code), ['FORME']);
  });

  test("une proposition inconnue, un retenu absent sont refusés ; une cible d'une autre forme est une faute du code", () => {
    refuse(() => formeNommeeDe(chargeRiche(), { proposition: 9 }), 'PROPOSITION_INCONNUE', { id: 9, remede: null });
    refuse(() => formeNommeeDe(chargeEssai(), { retenu: true }), 'AUCUN_RETENU', {
      remede: { geste: 'ouvrirSection', section: 'propositions' },
    });
    for (const cible of [{}, { retenu: false }, { proposition: '2' }, { proposition: 2, retenu: true }, null]) {
      assert.throws(() => formeNommeeDe(chargeRiche(), cible), TypeError, JSON.stringify(cible));
    }
  });
});

describe('commandes : les états du plan (§ 9)', () => {
  // Une charge à l'état donné : vide, avec des propositions, ou avec un retenu.
  function chargeA(etat, contenu) {
    const charge = contenu === 'vide' ? chargeEssai() : chargeRiche();
    if (contenu === 'propositions') charge.retenu = null;
    charge.evenement.etat = etat;
    return charge;
  }

  test('les transitions admises et refusées, chacune sans rien détruire', () => {
    // [de, contenu, vers, refus attendu ou null]
    const cas = [
      ['brouillon', 'vide', 'propose', 'AUCUNE_PROPOSITION'],
      ['brouillon', 'vide', 'retenu', 'AUCUN_RETENU'],
      ['brouillon', 'vide', 'bloque', null],
      ['brouillon', 'propositions', 'propose', null],
      ['brouillon', 'propositions', 'retenu', 'AUCUN_RETENU'],
      ['propose', 'propositions', 'brouillon', null],
      ['propose', 'retenu', 'retenu', null],
      ['retenu', 'retenu', 'propose', null],
      ['retenu', 'retenu', 'brouillon', null],
      ['retenu', 'retenu', 'bloque', null],
      ['retenu', 'retenu', 'retenu', 'SANS_EFFET'],
      ['bloque', 'retenu', 'retenu', 'PLAN_BLOQUE'],
      ['bloque', 'retenu', 'brouillon', 'PLAN_BLOQUE'],
    ];
    for (const [de, contenu, vers, refus] of cas) {
      const avant = chargeA(de, contenu);
      if (refus !== null) {
        refuse(() => executer('changerEtat', avant, { etat: vers }), refus);
        continue;
      }
      const { charge, libelle } = executer('changerEtat', avant, { etat: vers });
      assert.equal(charge.evenement.etat, vers, `${de} → ${vers}`);
      assert.deepEqual({ ...charge, evenement: { ...charge.evenement, etat: de } }, avant, `${de} → ${vers} : rien d'autre ne change`);
      assert.match(libelle, /^Plan passé à l'état « /);
    }
  });

  test('un refus de transition nomme le remède ; un état inconnu est une faute du code', () => {
    refuse(() => executer('changerEtat', chargeA('brouillon', 'vide'), { etat: 'propose' }), 'AUCUNE_PROPOSITION', {
      remede: { geste: 'ouvrirSection', section: 'generation' },
    });
    refuse(() => executer('changerEtat', chargeA('propose', 'propositions'), { etat: 'retenu' }), 'AUCUN_RETENU', {
      remede: { geste: 'ouvrirSection', section: 'propositions' },
    });
    assert.throws(() => executer('changerEtat', chargeA('brouillon', 'vide'), { etat: 'archive' }), TypeError);
  });

  test("débloquer rend l'état que le contenu impose ; un plan qui n'est pas bloqué est refusé", () => {
    for (const contenu of ['vide', 'propositions', 'retenu']) {
      const avant = chargeA('bloque', contenu);
      const { charge, libelle } = executer('debloquer', avant, {});
      assert.equal(charge.evenement.etat, etatDeduit(avant));
      assert.match(libelle, /^Plan débloqué/);
    }
    refuse(() => executer('debloquer', chargeA('retenu', 'retenu'), {}), 'PLAN_NON_BLOQUE', { remede: null });
  });
});

describe('commandes : générer, retenir, effacer (§ 5.7, § 8.9)', () => {
  test('les propositions prennent leurs identifiants à partir du compteur, et le relèvent ; brouillon passe à proposé', () => {
    const avant = chargeEssai();
    avant.prochainsIds.proposition = 4;
    const args = generer(avant, 3);
    const { charge, libelle } = executer('enregistrerGeneration', avant, args);
    assert.deepEqual(charge.propositions.map(({ id }) => id), [4, 5, 6]);
    assert.equal(charge.prochainsIds.proposition, 7);
    assert.equal(charge.evenement.etat, 'propose');
    assert.equal(libelle, 'Généré 3 propositions (n° 4 à 6)');
    charge.propositions.forEach((p, rang) => {
      const source = args.propositions[rang];
      assert.deepEqual([p.graine, p.arret, p.historique, p.produitVersion], [source.graine, source.arret, source.historique, V1]);
      assert.deepEqual(planDepuisFichier(p), source.plan);
      assert.equal(p.siegesAttribues, avant.reglages.attribuerSieges);
    });
  });

  test("une seconde génération continue la numérotation ; après un effacement, aucun identifiant ne revient", () => {
    const premiere = executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 3)).charge;
    const seconde = executer('enregistrerGeneration', premiere, generer(premiere, 2, 11)).charge;
    assert.deepEqual(seconde.propositions.map(({ id }) => id), [1, 2, 3, 4, 5]);
    assert.equal(seconde.evenement.etat, 'propose');
    const effacee = executer('effacerPropositions', seconde, {}).charge;
    const troisieme = executer('enregistrerGeneration', effacee, generer(effacee, 1, 13)).charge;
    assert.deepEqual(troisieme.propositions.map(({ id }) => id), [6]);
  });

  test("une liste vide est sans effet ; des identifiants du moteur en double sont une faute du code", () => {
    refuse(() => executer('enregistrerGeneration', chargeEssai(), { ...generer(chargeEssai(), 1), propositions: [] }), 'SANS_EFFET');
    const args = generer(chargeEssai(), 2);
    args.propositions[1] = { ...args.propositions[1], id: 1 };
    assert.throws(() => executer('enregistrerGeneration', chargeEssai(), args), TypeError);
  });

  test("retenir pose le placement en vigueur, copié de la proposition, et l'état Retenu", () => {
    const generee = executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2)).charge;
    const { charge, libelle } = executer('retenirProposition', generee, { id: 2 });
    const { id, graine, arret, historique, produitVersion, ...plan } = generee.propositions[1];
    assert.deepEqual(charge.retenu, { proposition: 2, ...plan });
    assert.equal(charge.evenement.etat, 'retenu');
    assert.deepEqual(charge.propositions, generee.propositions);
    assert.equal(libelle, 'Retenu la proposition n° 2');
    assert.deepEqual([id, typeof graine, typeof arret, typeof historique, produitVersion], [2, 'number', 'number', 'number', V1]);
    refuse(() => executer('retenirProposition', generee, { id: 9 }), 'PROPOSITION_INCONNUE', { id: 9, remede: null });
  });

  test("effacer épargne la proposition retenue ; sans retenu, le plan revient en brouillon ; rien à effacer : SANS_EFFET", () => {
    const riche = chargeRiche();
    const { charge, libelle } = executer('effacerPropositions', riche, {});
    assert.deepEqual(charge.propositions.map(({ id }) => id), [1]);
    assert.equal(charge.prochainsIds.proposition, riche.prochainsIds.proposition);
    assert.equal(charge.evenement.etat, 'retenu');
    assert.equal(libelle, 'Effacé 1 proposition, gardé la retenue (n° 1)');
    refuse(() => executer('effacerPropositions', charge, {}), 'SANS_EFFET');
    const proposee = executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2)).charge;
    const videe = executer('effacerPropositions', proposee, {});
    assert.deepEqual(videe.charge.propositions, []);
    assert.equal(videe.charge.evenement.etat, 'brouillon');
    assert.equal(videe.libelle, 'Effacé 2 propositions');
  });
});

describe('commandes : garder les meilleures propositions (§ 5.7)', () => {
  // La charge d'essai, deux générations : cinq propositions, 1 à 5.
  function chargeCinq() {
    const premiere = executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 3)).charge;
    return executer('enregistrerGeneration', premiere, generer(premiere, 2, 11)).charge;
  }

  // L'ordre du tableau des propositions : celui de la table d'évaluation.
  const ordreDe = (charge) => evaluer(charge).propositions.map(({ id }) => id);

  test("garde les n premières du classement, dans l'ordre du fichier ; le compteur et l'état ne bougent pas ; une entrée qui le dit", () => {
    const avant = figer(chargeCinq());
    const ordre = ordreDe(avant);
    assert.equal(ordre.length, 5);
    const { charge, libelle, avertissements, resume } = executer('garderMeilleures', avant, { n: 2 });
    const gardees = new Set(ordre.slice(0, 2));
    // Le compte des effacées, rendu par la commande même : l'annonce le lit.
    assert.deepEqual(resume, { effacees: 3 });
    assert.deepEqual(charge.propositions, avant.propositions.filter(({ id }) => gardees.has(id)));
    assert.equal(charge.prochainsIds.proposition, avant.prochainsIds.proposition);
    assert.equal(charge.evenement.etat, 'propose');
    assert.equal(charge.retenu, null);
    assert.equal(libelle, 'Gardé les 2 meilleures propositions, effacé 3 propositions');
    assert.deepEqual(avertissements, []);
    const une = executer('garderMeilleures', avant, { n: 4 });
    assert.deepEqual(une.charge.propositions.map(({ id }) => id).sort(), ordre.slice(0, 4).sort());
    assert.equal(une.libelle, 'Gardé les 4 meilleures propositions, effacé 1 proposition');
    const seule = executer('garderMeilleures', avant, { n: 1 });
    assert.deepEqual(seule.charge.propositions.map(({ id }) => id), [ordre[0]]);
    assert.equal(seule.libelle, 'Gardé la meilleure proposition, effacé 4 propositions');
  });

  test('la proposition du retenu, hors des n premières, reste en plus, et le libellé la nomme ; le plan reste retenu', () => {
    const generee = chargeCinq();
    const derniere = ordreDe(generee).at(-1);
    const avant = figer(executer('retenirProposition', generee, { id: derniere }).charge);
    const ordre = ordreDe(avant);
    assert.equal(ordre.at(-1), derniere);
    const { charge, libelle, resume } = executer('garderMeilleures', avant, { n: 2 });
    assert.deepEqual(charge.propositions.map(({ id }) => id).sort(), [...ordre.slice(0, 2), derniere].sort());
    assert.deepEqual(resume, { effacees: 2 });
    assert.deepEqual(charge.retenu, avant.retenu);
    assert.equal(charge.evenement.etat, 'retenu');
    assert.equal(libelle, `Gardé les 2 meilleures propositions, effacé 2 propositions, gardé aussi la retenue (n° ${derniere})`);
    assert.deepEqual(nettoyage(evaluer(avant), 2).effacees.sort(), ordre.slice(2, 4).sort());
  });

  test("rien à effacer — n au moins le compte, ou la seule au-delà est la retenue : SANS_EFFET", () => {
    const avant = figer(chargeCinq());
    refuse(() => executer('garderMeilleures', avant, { n: 5 }), 'SANS_EFFET', { commande: 'garderMeilleures', remede: null });
    refuse(() => executer('garderMeilleures', avant, { n: 50 }), 'SANS_EFFET');
    const derniere = ordreDe(avant).at(-1);
    const retenue = figer(executer('retenirProposition', avant, { id: derniere }).charge);
    refuse(() => executer('garderMeilleures', retenue, { n: 4 }), 'SANS_EFFET');
  });

  test("une configuration qui ne se normalise pas ne se classe pas : son refus, remède nul ; un plan bloqué refuse d'abord", () => {
    const charge = structuredClone(chargeCinq());
    charge.reservations = [1, 2, 3].map((participant) => ({ participant, table: 1, siege: null, portee: 'tous', tour: null }));
    refuse(() => executer('garderMeilleures', figer(charge), { n: 1 }), 'SURRESERVATION');
    assert.throws(() => executer('garderMeilleures', charge, { n: 1 }), (erreur) => erreur.details.remede === null);
    const bloquee = figer({ ...charge, evenement: { ...charge.evenement, etat: 'bloque' } });
    refuse(() => executer('garderMeilleures', bloquee, { n: 1 }), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
  });

  test("n hors des entiers ≥ 1 est une faute du code ; la commande ne rend aucune course", () => {
    const avant = figer(chargeCinq());
    for (const n of [0, -2, 1.5, '1', null]) assert.throws(() => executer('garderMeilleures', avant, { n }), TypeError, String(n));
    assert.throws(() => executer('garderMeilleures', avant, {}), TypeError);
    assert.equal(Object.hasOwn(executer('garderMeilleures', avant, { n: 1 }), 'courses'), false);
  });

  test("après le nettoyage, aucun identifiant ne revient : la génération suivante continue le compteur", () => {
    const gardee = executer('garderMeilleures', chargeCinq(), { n: 1 }).charge;
    const suite = executer('enregistrerGeneration', gardee, generer(gardee, 1, 13)).charge;
    assert.equal(suite.propositions.at(-1).id, 6);
  });
});

describe('commandes : la course de la recherche, rendue à côté de la charge (§ 8.9, B31, D53)', () => {
  // La charge d'essai sur trois tours, sièges attribués, deux tables de
  // trois places pour quatre personnes : Iris Ombrelle réservée au siège 3
  // de la table 1, Ondine Lacasse au siège 3 de la table 2, à chaque tour.
  // Chaque table assied sa réservée et au plus deux autres, et l'une au
  // moins reste incomplète : une chaise vide avant le siège 3 à chaque tour.
  function chargeAuxSieges() {
    const charge = chargeEssai();
    charge.evenement.siegesParDefaut = 3;
    charge.evenement.tours = 3;
    charge.reglages.attribuerSieges = true;
    charge.reservations = [
      { participant: 1, table: 1, siege: 3, portee: 'tous', tour: null },
      { participant: 4, table: 2, siege: 3, portee: 'tous', tour: null },
    ];
    charge.titres = [];
    return charge;
  }

  // Le plan reçu, chaque liste et chaque réserve par identifiant croissant,
  // sans chaise vide.
  const range = ({ tables, tours, reserves }) => ({
    tables: [...tables],
    tours: tours.map((listes) => listes.map((liste) => liste.filter((id) => id !== null).sort((a, b) => a - b))),
    reserves: reserves.map((reserve) => [...reserve].sort((a, b) => a - b)),
  });

  test('enregistrerGeneration rend la course de chaque proposition à côté de la charge, sous son identité ; la charge et ses propositions ne portent aucune course', () => {
    const avant = chargeEssai();
    const args = generer(avant, 2, 7);
    args.propositions = rechercher(args.configuration, { graine: 7, arret: 200, nombre: 2 });
    const { charge, courses, libelle } = executer('enregistrerGeneration', avant, args);
    assert.deepEqual(charge.propositions.map(({ id }) => id), [1, 2]);
    assert.equal(charge.prochainsIds.proposition, 3);
    assert.equal(libelle, 'Généré 2 propositions (n° 1 à 2)');
    assert.equal(serialiserCharge(charge).includes('evalues'), false);
    assert.deepEqual(courses.map(cleDeCourse), charge.propositions.map(cleDeCourse));
    charge.propositions.forEach((p, rang) => {
      assert.equal(Object.hasOwn(p, 'course'), false);
      const { course } = courses[rang];
      assert.equal(fauteDeCourse(p, course), null);
      for (const { placement } of course.releves) {
        for (const { sieges } of placement) {
          for (const liste of sieges) assert.deepEqual(liste, [...liste].sort((a, b) => a - b));
        }
      }
      assert.deepEqual(courseDepuisFichier(p, course), {
        evalues: args.propositions[rang].evalues,
        releves: args.propositions[rang].releves.map(({ mouvements, plan }) => ({ mouvements, plan: range(plan) })),
      });
    });
  });

  test("appliquée à un instant, la génération date chaque entrée de course comme sa proposition, et la clé de course en tient compte ; sans instant, aucune n'est datée", () => {
    const avant = chargeEssai();
    const args = generer(avant, 2, 7);
    args.propositions = rechercher(args.configuration, { graine: 7, arret: 200, nombre: 2 });
    const horodatage = '2031-05-17T08:02:00-04:00';
    const datee = appliquerCommande('enregistrerGeneration', avant, args, { horodatage });
    assert.deepEqual(datee.charge.propositions.map((p) => p.horodatage), [horodatage, horodatage]);
    assert.deepEqual(datee.courses.map((entree) => entree.horodatage), [horodatage, horodatage]);
    assert.deepEqual(datee.courses.map(cleDeCourse), datee.charge.propositions.map(cleDeCourse));
    const sansInstant = appliquerCommande('enregistrerGeneration', avant, args);
    assert.equal(sansInstant.courses.some((entree) => Object.hasOwn(entree, 'horodatage')), false);
    assert.deepEqual(sansInstant.courses.map(cleDeCourse), sansInstant.charge.propositions.map(cleDeCourse));
    assert.notDeepEqual(sansInstant.courses.map(cleDeCourse), datee.courses.map(cleDeCourse));
  });

  test('sièges attribués, chaque placement de relevé se range par siège comme celui de la proposition : la chaise vide et les sièges réservés à leur place, et la course se lit sous la proposition', () => {
    const avant = chargeAuxSieges();
    const configuration = configurationDepuisCharge(avant);
    const propositions = rechercher(configuration, { graine: 7, arret: 200, nombre: 2 });
    const { charge, courses } = executer('enregistrerGeneration', avant, { propositions, configuration, produitVersion: V1 });
    let chaisesVides = 0;
    charge.propositions.forEach((p, rang) => {
      const source = propositions[rang];
      const { course } = courses[rang];
      assert.equal(p.siegesAttribues, true);
      assert.deepEqual(fautes(p), []);
      assert.equal(fauteDeCourse(p, course), null);
      assert.equal(course.evalues, source.evalues);
      assert.deepEqual(course.releves.map(({ mouvements }) => mouvements), [1, 10, 100]);
      const placements = [p.placement, ...course.releves.map(({ placement }) => placement)];
      placements.forEach((placement, point) => {
        placement.forEach(({ sieges }, tour) => {
          const ici = `proposition ${p.id}, point ${point}, tour ${tour + 1}`;
          assert.equal(sieges[p.tables.indexOf(1)][2], 1, ici);
          assert.equal(sieges[p.tables.indexOf(2)][2], 4, ici);
          for (const liste of sieges) {
            assert.equal(liste.length, 3, ici);
            chaisesVides += liste.filter((id) => id === null).length;
          }
        });
      });
      assert.deepEqual(
        courseDepuisFichier(p, course).releves.map(({ plan }) => plan),
        source.releves.map(({ plan }) => range(plan)),
      );
    });
    assert.ok(chaisesVides > 0);
  });

  test("sans course rapportée par le moteur, aucune course n'est rendue ; retenir et effacer n'en rendent aucune", () => {
    const args = generer(chargeEssai(), 2);
    args.propositions = args.propositions.map(({ evalues, releves, ...proposition }) => proposition);
    const sans = executer('enregistrerGeneration', chargeEssai(), args);
    assert.deepEqual(sans.courses, []);
    assert.equal(executer('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2)).courses.length, 2);
    const retenue = executer('retenirProposition', sans.charge, { id: 1 });
    assert.equal(Object.hasOwn(retenue, 'courses'), false);
    assert.equal(Object.hasOwn(executer('effacerPropositions', retenue.charge, {}), 'courses'), false);
  });
});

describe('commandes : la génération dérivée (§ 5.7, § 8.9, C6, C24)', () => {
  // Les arguments d'enregistrerGeneration d'une génération dérivée courte du
  // moteur : partie du plan de la proposition depart de la charge, sous
  // toursFiges, à 200 mouvements.
  function genererDepuis(charge, depart, toursFiges, graine = 11, nombre = 2) {
    const configuration = configurationDepuisCharge(charge);
    const propositions = repartir(configuration, { graine, arret: 200, nombre }, { plan: planDuDepart(charge, depart), toursFiges });
    return { propositions, configuration, produitVersion: V1, derivation: { depart, toursFiges } };
  }

  // Sièges attribués, trois tours, deux tables de trois places pour quatre
  // personnes. La proposition n° 1 s'engendre quand Iris Ombrelle est
  // réservée au siège 3 de la table 1 et Ondine Lacasse au siège 3 de la
  // table 2, à chaque tour ; la réservation d'Iris se retire ensuite. Le
  // rangement ne met plus Iris au siège 3, et la proposition n° 1 reste un
  // départ qui tient les réservations courantes : retirer une réservation
  // est un geste légitime.
  function chargeDepartAuxSieges() {
    const charge = chargeEssai();
    charge.evenement.siegesParDefaut = 3;
    charge.evenement.tours = 3;
    charge.reglages.attribuerSieges = true;
    charge.reservations = [
      { participant: 1, table: 1, siege: 3, portee: 'tous', tour: null },
      { participant: 4, table: 2, siege: 3, portee: 'tous', tour: null },
    ];
    charge.titres = [];
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 7, arret: 200, nombre: 1 });
    const generee = executer('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
    return { ...generee, reservations: generee.reservations.filter(({ participant }) => participant !== 1) };
  }

  // La charge d'essai, trois propositions courtes, puis deux dérivées, n° 4
  // et n° 5, de la dernière du classement, sans tour figé : elles se
  // rangent devant leur départ.
  function chargeAvecDerivees() {
    const charge = chargeEssai();
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, { graine: 4, arret: 1, nombre: 3 });
    const generee = executer('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
    const derniere = evaluer(generee).classement.ordre.at(-1);
    const derivee = executer('enregistrerGeneration', generee, genererDepuis(generee, derniere, [])).charge;
    return { charge: derivee, depart: derniere };
  }

  test("sous sièges attribués des deux côtés, la liste d'un tour figé est celle du départ, chaises vides comprises, même quand une réservation à un siège a changé l'ordre que le rangement donnerait : au plan et à chaque point de relevé", () => {
    const avant = figer(chargeDepartAuxSieges());
    const depart = avant.propositions[0];
    const args = genererDepuis(avant, 1, [1, 2]);
    assert.equal(refusDuDepart(avant, { id: 1, toursFiges: [1, 2] }), null);
    // Les mêmes propositions du moteur enregistrées sans dérivation : les
    // listes que le rangement donne.
    const { derivation, ...ordinaire } = args;
    const rangees = executer('enregistrerGeneration', avant, ordinaire).charge.propositions.slice(1);
    const { charge, courses } = executer('enregistrerGeneration', avant, args);
    const derivees = charge.propositions.slice(1);
    assert.deepEqual(derivees.map(({ id }) => id), [2, 3]);
    assert.equal(courses.length, 2);
    let reordonnees = 0;
    let chaisesVides = 0;
    derivees.forEach((p, rang) => {
      assert.deepEqual([p.depart, p.toursFiges, p.siegesAttribues], [1, [1, 2], true], `proposition ${p.id}`);
      assert.deepEqual(p.tables, depart.tables);
      const { course } = courses[rang];
      assert.ok(course.releves.length > 0, `proposition ${p.id} : aucun point de relevé`);
      const placements = [p.placement, ...course.releves.map(({ placement }) => placement)];
      placements.forEach((placement, point) => {
        for (const tour of derivation.toursFiges) {
          assert.deepEqual(placement[tour - 1], depart.placement[tour - 1], `proposition ${p.id}, point ${point}, tour ${tour}`);
          chaisesVides += placement[tour - 1].sieges.flat().filter((id) => id === null).length;
        }
        // Le tour non figé se range comme celui de toute proposition.
        const rangee = point === 0 ? rangees[rang].placement : null;
        if (rangee !== null) assert.deepEqual(placement[2], rangee[2], `proposition ${p.id}, tour 3`);
      });
      for (const tour of derivation.toursFiges) {
        if (JSON.stringify(rangees[rang].placement[tour - 1]) !== JSON.stringify(depart.placement[tour - 1])) reordonnees += 1;
      }
    });
    assert.ok(reordonnees > 0, "le rangement donnerait l'ordre du départ : l'épreuve ne distinguerait pas la recopie");
    assert.ok(chaisesVides > 0, "aucune chaise vide dans les tours figés : l'épreuve ne les éprouverait pas");
  });

  test("sous sièges attribués, la course d'une dérivée se relit après réouverture : cleDeCourse de la proposition enregistrée trouve son entrée, courseDe la rend ; datée à son instant aussi", () => {
    const avant = chargeDepartAuxSieges();
    const args = genererDepuis(avant, 1, [1, 2]);
    for (const options of [{}, { horodatage: '2031-05-17T08:02:00-04:00' }]) {
      const { charge, courses } = appliquerCommande('enregistrerGeneration', avant, args, options);
      const rouverte = examiner(analyser(serialiser(charge, { revision: 1, produitVersion: V1 })).charge).charge;
      const lues = lireCourses(texteDesCourses(rouverte.evenement.id, courses), rouverte);
      const derivees = rouverte.propositions.slice(1);
      assert.deepEqual(derivees.map(({ id, depart }) => [id, depart]), [[2, 1], [3, 1]]);
      derivees.forEach((p, rang) => {
        const ici = `${JSON.stringify(options)}, proposition ${p.id}`;
        assert.ok(lues.has(cleDeCourse(p)), `${ici} : la clé de la proposition ne trouve pas son entrée`);
        const relue = courseDe({ charge: rouverte, courses: lues }, p.id);
        assert.notEqual(relue, null, ici);
        assert.equal(relue.evalues, args.propositions[rang].evalues, ici);
        assert.equal(relue.releves.length, args.propositions[rang].releves.length, ici);
      });
    }
  });

  test('le libellé du journal nomme le départ, les propositions et les tours figés : trois formes', () => {
    const avant = chargeDepartAuxSieges();
    assert.equal(
      executer('enregistrerGeneration', avant, genererDepuis(avant, 1, [1, 2])).libelle,
      'Généré 2 propositions dérivées de n° 1 (n° 2 à 3), tours 1 et 2 figés',
    );
    const sansFige = executer('enregistrerGeneration', avant, genererDepuis(avant, 1, []));
    assert.equal(sansFige.libelle, 'Généré 2 propositions dérivées de n° 1 (n° 2 à 3)');
    // Sans tour figé, la dérivée porte son départ et ne porte pas toursFiges.
    for (const p of sansFige.charge.propositions.slice(1)) {
      assert.equal(p.depart, 1);
      assert.equal(Object.hasOwn(p, 'toursFiges'), false);
    }
    const une = executer('enregistrerGeneration', avant, genererDepuis(avant, 1, [2], 11, 1));
    assert.equal(une.libelle, 'Généré 1 proposition dérivée de n° 1 (n° 2), tour 2 figé');
    assert.deepEqual(derivationDe(une.charge, 2), { depart: 1, toursFiges: [2], departPresent: true });
  });

  test("sans dérivation, ou sous derivation null, la commande rend la charge, le libellé et les courses d'une génération ordinaire", () => {
    const avant = chargeDepartAuxSieges();
    const args = generer(avant, 2, 7);
    const sans = executer('enregistrerGeneration', avant, args);
    const nulle = executer('enregistrerGeneration', avant, { ...args, derivation: null });
    assert.equal(serialiserCharge(nulle.charge), serialiserCharge(sans.charge));
    assert.equal(nulle.libelle, 'Généré 2 propositions (n° 2 à 3)');
    assert.equal(sans.libelle, nulle.libelle);
    assert.deepEqual(nulle.courses, sans.courses);
    for (const p of sans.charge.propositions) {
      assert.equal(Object.hasOwn(p, 'depart'), false);
      assert.equal(Object.hasOwn(p, 'toursFiges'), false);
    }
  });

  test('un départ absent de la charge est refusé PROPOSITION_INCONNUE, rien enregistré ; une dérivation de forme fausse est une faute du code', () => {
    const avant = figer(chargeDepartAuxSieges());
    const args = genererDepuis(avant, 1, [1]);
    refuse(() => executer('enregistrerGeneration', avant, { ...args, derivation: { depart: 9, toursFiges: [1] } }), 'PROPOSITION_INCONNUE', {
      id: 9,
      remede: null,
    });
    for (const derivation of [{ depart: 1 }, { toursFiges: [1] }, 'x', { depart: 'un', toursFiges: [1] }]) {
      assert.throws(() => executer('enregistrerGeneration', avant, { ...args, derivation }), TypeError, JSON.stringify(derivation));
    }
  });

  test("TOUR_FIGE_DIFFERENT, atteint en forçant le défaut : un plan, ou un seul point de relevé, dont le tour figé n'est pas celui du départ ; aucune dérivée du moteur ne l'atteint", () => {
    const { charge: avant, depart } = chargeAvecDerivees();
    const tourDuDepart = planDuDepart(avant, depart).tours[0];
    const configuration = configurationDepuisCharge(avant);
    // Une proposition ordinaire dont le tour 1 n'est pas celui du départ.
    const autre = rechercher(configuration, { graine: 4, arret: 200, nombre: 5 }).find(
      ({ plan }) => JSON.stringify(plan.tours[0]) !== JSON.stringify(tourDuDepart),
    );
    assert.ok(autre !== undefined);
    const forcee = { ...autre, id: 3 };
    const derivation = { depart, toursFiges: [1] };
    refuse(
      () => executer('enregistrerGeneration', avant, { propositions: [forcee], configuration, produitVersion: V1, derivation }),
      'TOUR_FIGE_DIFFERENT',
      { rang: 3, tour: 1, remede: null },
    );
    // Une dérivée du moteur dont un seul point de relevé porte un tour 1
    // aux deux listes échangées.
    const args = genererDepuis(avant, depart, [1]);
    assert.doesNotThrow(() => executer('enregistrerGeneration', avant, args));
    const [premiere, seconde] = args.propositions;
    assert.ok(seconde.releves.length > 1);
    const releves = seconde.releves.map((releve, i) => {
      if (i !== 1) return releve;
      const [a, b] = releve.plan.tours[0];
      return { ...releve, plan: { ...releve.plan, tours: [[b, a], ...releve.plan.tours.slice(1)] } };
    });
    refuse(
      () => executer('enregistrerGeneration', avant, { ...args, propositions: [premiere, { ...seconde, releves }] }),
      'TOUR_FIGE_DIFFERENT',
      { rang: 2, tour: 1, remede: null },
    );
  });

  test("TOUR_FIGE_DIFFERENT sous sièges attribués des deux côtés : un tour figé que le moteur a changé, au plan ou à un seul point de relevé, est refusé avant que la recopie ne l'efface", () => {
    const avant = figer(chargeDepartAuxSieges());
    const args = genererDepuis(avant, 1, [1, 2]);
    assert.doesNotThrow(() => executer('enregistrerGeneration', avant, args));
    // Les deux listes d'un tour échangées entre les tables : les occupants de
    // chaque table ne sont plus ceux du départ.
    const echange = (plan) => {
      const [a, b] = plan.tours[0];
      return { ...plan, tours: [[b, a], ...plan.tours.slice(1)] };
    };
    const [premiere, seconde] = args.propositions;
    refuse(
      () =>
        executer('enregistrerGeneration', avant, { ...args, propositions: [{ ...premiere, plan: echange(premiere.plan) }, seconde] }),
      'TOUR_FIGE_DIFFERENT',
      { rang: 1, tour: 1, remede: null },
    );
    assert.ok(seconde.releves.length > 0);
    const releves = seconde.releves.map((releve, i) => (i === 0 ? { ...releve, plan: echange(releve.plan) } : releve));
    refuse(
      () => executer('enregistrerGeneration', avant, { ...args, propositions: [premiere, { ...seconde, releves }] }),
      'TOUR_FIGE_DIFFERENT',
      { rang: 2, tour: 1, remede: null },
    );
  });

  test("un départ et un événement qui n'attribuent pas tous deux les sièges : les listes se rangent comme celles de toute proposition, au plan et aux points de relevé", () => {
    // Iris Ombrelle réservée au siège 2 de la table 1 : le rangement l'y
    // met après sa voisine, qu'un tri par identifiant mettrait après elle.
    const essai = chargeEssai();
    essai.reservations = [{ participant: 1, table: 1, siege: 2, portee: 'tous', tour: null }];
    for (const [auDepart, ensuite] of [
      [false, true],
      [true, false],
    ]) {
      const charge = structuredClone(essai);
      charge.reglages.attribuerSieges = auDepart;
      const configuration = configurationDepuisCharge(charge);
      const propositions = rechercher(configuration, { graine: 7, arret: 200, nombre: 1 });
      const generee = executer('enregistrerGeneration', charge, { propositions, configuration, produitVersion: V1 }).charge;
      const avant = { ...generee, reglages: { ...generee.reglages, attribuerSieges: ensuite } };
      const args = genererDepuis(avant, 1, [1]);
      const { derivation, ...ordinaire } = args;
      const attendu = executer('enregistrerGeneration', avant, ordinaire);
      const rendu = executer('enregistrerGeneration', avant, args);
      const ici = `départ ${auDepart}, événement ${ensuite}`;
      assert.notDeepEqual(generee.propositions[0].placement[0], attendu.charge.propositions[1].placement[0], ici);
      rendu.charge.propositions.slice(1).forEach((p, rang) => {
        const h = attendu.charge.propositions[rang + 1];
        assert.deepEqual([p.siegesAttribues, p.placement], [ensuite, h.placement], ici);
        assert.deepEqual(rendu.courses[rang].course, attendu.courses[rang].course, ici);
      });
    }
  });

  test("Effacer emporte le départ : la dérivée gardée, d'où vient le retenu, reste comparable et classée, et dit que son départ n'est plus dans la liste ; l'état d'avant, qu'un retour rend, le porte", () => {
    const { charge: generee, depart } = chargeAvecDerivees();
    assert.ok(evaluer(generee).classement.ordre.indexOf(4) < evaluer(generee).classement.ordre.indexOf(depart));
    const avant = figer(executer('retenirProposition', generee, { id: 4 }).charge);
    assert.deepEqual(derivationDe(avant, 4), { depart, toursFiges: [], departPresent: true });
    const { charge, libelle } = executer('effacerPropositions', avant, {});
    assert.deepEqual(charge.propositions.map(({ id }) => id), [4]);
    assert.equal(libelle, 'Effacé 4 propositions, gardé la retenue (n° 4)');
    assert.deepEqual(derivationDe(charge, 4), { depart, toursFiges: [], departPresent: false });
    const table = evaluer(charge);
    assert.deepEqual(table.classement.ordre, [4]);
    assert.equal(table.propositions[0].statut, 'comparable');
    assert.deepEqual(derivationDe(avant, 4).departPresent, true);
  });

  test("garderMeilleures emporte le départ d'une dérivée gardée hors des n premières, comme Effacer : rien ne le protège, et la dérivée le dit", () => {
    const { charge: avant, depart } = chargeAvecDerivees();
    const ordre = evaluer(avant).classement.ordre;
    const n = ordre.indexOf(4) + 1;
    assert.ok(ordre.indexOf(depart) >= n, `le départ n° ${depart} est parmi les ${n} premières : ${ordre}`);
    const { charge } = executer('garderMeilleures', figer(avant), { n });
    assert.deepEqual(charge.propositions.map(({ id }) => id).sort(), ordre.slice(0, n).sort());
    assert.equal(charge.propositions.some(({ id }) => id === depart), false);
    assert.deepEqual(derivationDe(charge, 4), { depart, toursFiges: [], departPresent: false });
    assert.ok(evaluer(charge).classement.ordre.includes(4));
  });

  test("relances, que portent les propositions de repartir, n'entre ni au fichier ni à l'entrée de course : leurs clés sont celles d'une proposition ordinaire, la dérivation en plus", () => {
    const avant = chargeDepartAuxSieges();
    const args = genererDepuis(avant, 1, [1]);
    assert.ok(args.propositions.every((p) => Object.hasOwn(p, 'relances')));
    args.propositions = args.propositions.map((p) => ({ ...p, relances: 3 }));
    const { charge, courses } = executer('enregistrerGeneration', avant, args);
    const ordinaire = executer('enregistrerGeneration', avant, generer(avant, 1, 7));
    const clesOrdinaires = Object.keys(ordinaire.charge.propositions[1]);
    const rang = clesOrdinaires.indexOf('historique') + 1;
    const attendues = [...clesOrdinaires.slice(0, rang), 'depart', 'toursFiges', ...clesOrdinaires.slice(rang)];
    for (const p of charge.propositions.slice(1)) assert.deepEqual(Object.keys(p), attendues);
    for (const entree of courses) assert.deepEqual(Object.keys(entree), Object.keys(ordinaire.courses[0]));
    assert.equal(serialiserCharge(charge).includes('relances'), false);
    assert.equal(JSON.stringify(courses).includes('relances'), false);
  });
});

describe("commandes : la charge d'un événement neuf (§ 8.1)", () => {
  test("chargeNeuve contrôle chaque champ avant de tirer l'identifiant, et convertit la saisie en NFC", () => {
    let tirages = 0;
    const identifiant = () => {
      tirages += 1;
      return `evt-${tirages}`;
    };
    const base = { nom: 'Soirée des Lucioles', date: null, siegesParDefaut: 8, tours: 3 };
    refuse(() => chargeNeuve({ ...base, nom: '   ' }, identifiant), 'NOM_REQUIS');
    refuse(() => chargeNeuve({ ...base, date: '2031-02-30' }, identifiant), 'DATE_INVALIDE', { date: '2031-02-30', remede: null });
    refuse(() => chargeNeuve({ ...base, siegesParDefaut: 1 }, identifiant), 'SIEGES_INVALIDES', { sieges: 1, remede: null });
    refuse(() => chargeNeuve({ ...base, tours: 0 }, identifiant), 'TOURS_INVALIDES', { tours: 0, remede: null });
    assert.equal(tirages, 0);
    const { charge, libelle } = chargeNeuve({ ...base, nom: ' Soire\u{301}e des Lucioles ', date: '2031-05-17' }, identifiant);
    assert.equal(tirages, 1);
    assert.deepEqual(charge, {
      ...creerCharge({ id: 'evt-1', nom: 'Soir\u{E9}e des Lucioles', date: '2031-05-17', siegesParDefaut: 8, tours: 3 }),
    });
    assert.equal(libelle, "Création de l'événement « Soir\u{E9}e des Lucioles »");
  });

  test('chargeNeuve borne le nom à 200 caractères, comptés après NFC et le retrait des blancs de bord, avant de tirer l’identifiant', () => {
    assert.equal(NOM_EVENEMENT_MAX, 200);
    let tirages = 0;
    const identifiant = () => {
      tirages += 1;
      return `evt-${tirages}`;
    };
    const base = { date: null, siegesParDefaut: 8, tours: 3 };
    // 200 « é » en NFD : 400 unités avant NFC, 200 après ; les blancs de bord
    // ne comptent pas.
    const nfd = 'e\u{301}'.repeat(NOM_EVENEMENT_MAX);
    const { charge } = chargeNeuve({ ...base, nom: `  ${nfd}\t` }, identifiant);
    assert.equal(charge.evenement.nom, '\u{E9}'.repeat(NOM_EVENEMENT_MAX));
    // Un caractère hors du plan de base compte pour un, non pour deux unités.
    const astral = '\u{1D11E}'.repeat(NOM_EVENEMENT_MAX);
    assert.equal(chargeNeuve({ ...base, nom: astral }, identifiant).charge.evenement.nom, astral);
    assert.equal(tirages, 2);
    refuse(() => chargeNeuve({ ...base, nom: 'e\u{301}'.repeat(201) }, identifiant), 'NOM_EVENEMENT_TROP_LONG', {
      longueur: 201,
      maximum: 200,
      remede: null,
    });
    refuse(() => chargeNeuve({ ...base, nom: 'x'.repeat(8000) }, identifiant), 'NOM_EVENEMENT_TROP_LONG', {
      longueur: 8000,
      maximum: 200,
      remede: null,
    });
    assert.equal(tirages, 2);
  });

  test('refusNomEvenement : null jusqu’à la borne, le refus au-delà, avec le remède reçu ; une autre valeur qu’une chaîne est une faute du code', () => {
    assert.equal(refusNomEvenement('y'.repeat(200)), null);
    assert.equal(refusNomEvenement(` ${'y'.repeat(200)} `), null);
    // Un nom lu d'un fichier, en NFD : compté après NFC.
    assert.equal(refusNomEvenement('e\u{301}'.repeat(200)), null);
    const trop = refusNomEvenement('y'.repeat(201), { geste: 'modifier' });
    assert.ok(trop instanceof ErreurCommande);
    assert.equal(trop.code, 'NOM_EVENEMENT_TROP_LONG');
    assert.deepEqual(trop.details, { longueur: 201, maximum: 200, remede: { geste: 'modifier' } });
    assert.deepEqual(refusNomEvenement('y'.repeat(201)).details.remede, null);
    assert.throws(() => refusNomEvenement(null), TypeError);
  });
});

describe('commandes : la charge reçue ne change jamais (§ 13.2)', () => {
  // Au tour 1 du retenu de la charge riche : le voisin d'Iris à sa table, et
  // une personne de l'autre table, avec cette table. Lus dans le retenu, qui
  // vient du moteur.
  function auTour1({ retenu }) {
    const { sieges } = retenu.placement[0];
    const rang = sieges.findIndex((liste) => liste.includes(1));
    assert.equal(sieges.length, 2);
    return {
      voisin: sieges[rang].find((id) => id !== null && id !== 1),
      autre: sieges[1 - rang].find((id) => id !== null),
      tableAutre: retenu.tables[1 - rang],
    };
  }

  // Un ordre des priorités réglé : l'excédent et les collisions cumulées
  // partagent le deuxième palier, pondérés.
  const PRIORITES_REGLEES = [
    [{ critere: 'ecartAuPlafondAPrioriMax', poids: 1 }],
    [{ critere: 'excedentCollisions', poids: 2 }, { critere: 'collisionsCumulees', poids: 3 }],
    [{ critere: 'toursHorsObjectif', poids: 1 }],
    [{ critere: 'rencontresRepetees', poids: 1 }],
    [{ critere: 'animateursNonRencontres', poids: 1 }],
    [{ critere: 'redondance', poids: 1 }],
  ];

  // La charge que reçoit chaque commande : la charge riche, sauf debloquer,
  // qui la reçoit bloquée ; garderMeilleures, qui y trouve deux propositions
  // de plus, de quoi effacer au-delà de la première et de la retenue ;
  // convertirEnTous, qui y trouve Théo réservé à la table 2 à chaque tour, en
  // portée « tour » ; deplacerDansRetenu, qui y trouve l'autre personne du
  // tour 1 retirée dans la réserve.
  function recues(charge) {
    const { autre } = auTour1(charge);
    const reservee = structuredClone(charge);
    reservee.reservations.push(
      { participant: 3, table: 2, siege: null, portee: 'tour', tour: 1 },
      { participant: 3, table: 2, siege: null, portee: 'tour', tour: 2 },
    );
    return new Map([
      ['debloquer', { ...charge, evenement: { ...charge.evenement, etat: 'bloque' } }],
      ['convertirEnTous', reservee],
      ['deplacerDansRetenu', executer('retirerDuTour', charge, { tour: 1, participant: autre }).charge],
      ['retirerObjectif', executer('poserObjectif', charge, { table: 2, tour: null, etiquettes: 'finance', regle: null }).charge],
      ['retablirPriorites', executer('changerPriorites', charge, { paliers: PRIORITES_REGLEES }).charge],
      ['garderMeilleures', executer('enregistrerGeneration', charge, generer(charge, 2, 5)).charge],
    ]);
  }

  // Arguments d'exemple de chaque commande sur la charge qu'elle reçoit.
  function exemples(charge) {
    const { voisin, autre, tableAutre } = auTour1(charge);
    return new Map([
      ['ajouterParticipant', { champs: { nom: 'Bruyère' } }],
      ['modifierParticipant', { id: 4, champs: { courriel: 'o@exemple.test' } }],
      ['exclureParticipant', { id: 1 }],
      ['reintegrerParticipant', { id: 5 }],
      ['supprimerParticipant', { id: 2 }],
      ['importerParticipants', { apercu: apercevoir(CSV_DEUX, { participants: charge.participants }), mode: 'ajouter' }],
      ['importerObjectifs', { apercu: apercevoirObjectifs('table;objectif\n2;finance\n', charge), mode: 'mettreAJour' }],
      ['changerEtat', { etat: 'bloque' }],
      ['debloquer', {}],
      ['enregistrerGeneration', generer(charge, 1, 5)],
      ['retenirProposition', { id: 2 }],
      ['effacerPropositions', {}],
      ['garderMeilleures', { n: 1 }],
      ['reserver', { participant: 4, table: 2, siege: null, portee: 'tour', tour: 1 }],
      ['retirerReservation', { participant: 1, table: 1, portee: 'tous', tour: null }],
      ['deplacerReservation', { participant: 1, de: { table: 1, portee: 'tous', tour: null }, vers: { table: 2, siege: null } }],
      ['poserTitre', { table: 2, siege: 1, libelle: 'accueil' }],
      ['retirerTitre', { table: 1, siege: 1 }],
      ['designer', { participant: 3, table: 2, siege: 2, libelle: 'accueil' }],
      ['convertirEnTous', { participant: 3, table: 2 }],
      ['deplacerDansRetenu', { tour: 1, participant: autre, table: tableAutre, siege: null }],
      ['echangerDansRetenu', { tour: 1, a: voisin, b: autre }],
      ['retirerDuTour', { tour: 1, participant: autre }],
      ['creerTable', { forme: 'carree' }],
      ['supprimerTable', { id: 2 }],
      ['deplacerTable', { id: 1, position: { x: 40, y: 40 } }],
      ['changerPlacesTable', { id: 2, sieges: 3, origine: 'champ' }],
      ['realignerTable', { id: 1 }],
      ['changerDefaut', { sieges: 3, realigner: false }],
      ['changerTours', { tours: 3 }],
      ['modifierReglage', { cle: 'nouveauxVoisins', valeur: false }],
      ['changerEtiquettes', { id: 3, ajouter: 'finance' }],
      ['poserObjectif', { table: 2, tour: 1, etiquettes: 'finance', regle: 'et' }],
      ['retirerObjectif', { table: 2, tour: null }],
      ['changerRegleObjectifs', { regle: 'et' }],
      ['changerPriorites', { paliers: PRIORITES_REGLEES }],
      ['retablirPriorites', {}],
    ]);
  }

  test("aucune commande ne modifie la charge qu'elle reçoit", () => {
    const charge = chargeRiche();
    const args = exemples(charge);
    const particulieres = recues(charge);
    assert.deepEqual([...args.keys()].sort(), [...COMMANDES.keys()].sort());
    for (const [nom, commande] of COMMANDES) {
      const recue = particulieres.get(nom) ?? charge;
      const copie = structuredClone(recue);
      const rendu = commande(figer(recue), args.get(nom));
      assert.deepEqual(recue, copie, nom);
      assert.notEqual(rendu.charge, recue, nom);
      assert.equal(typeof rendu.libelle, 'string', nom);
      assert.ok(Array.isArray(rendu.avertissements), nom);
    }
  });

  test('sur un plan bloqué, chaque commande sauf debloquer est refusée PLAN_BLOQUE, remède « Débloquer »', () => {
    const charge = chargeRiche();
    const args = exemples(charge);
    const bloquee = figer({ ...charge, evenement: { ...charge.evenement, etat: 'bloque' } });
    for (const nom of COMMANDES.keys()) {
      if (nom === 'debloquer') continue;
      refuse(() => executer(nom, bloquee, args.get(nom)), 'PLAN_BLOQUE', { remede: { geste: 'debloquer' } });
    }
  });
});

describe('commandes : les registres réunis et les erreurs partagées', () => {
  test("reunirCommandes réunit des registres ; un nom de deux registres lève et le nomme", () => {
    const premiere = () => null;
    const seconde = () => null;
    const reunies = reunirCommandes(new Map([['essaiUn', premiere]]), new Map([['essaiDeux', seconde]]));
    assert.ok(reunies instanceof Map);
    assert.deepEqual([...reunies.keys()], ['essaiUn', 'essaiDeux']);
    assert.equal(reunies.get('essaiDeux'), seconde);
    assert.throws(
      () => reunirCommandes(new Map([['essaiPartage', premiere]]), new Map([['essaiPartage', seconde]])),
      (erreur) => {
        assert.match(erreur.message, /essaiPartage/);
        return true;
      },
    );
  });

  test("COMMANDES réunit les onze commandes d'A1, changerEtiquettes, importerObjectifs, garderMeilleures et les deux registres de F1", () => {
    assert.equal(COMMANDES.size, 14 + COMMANDES_MOBILIER.size + COMMANDES_PLACES.size);
    assert.ok(COMMANDES_MOBILIER instanceof Map);
    assert.ok(COMMANDES_PLACES instanceof Map);
    for (const registre of [COMMANDES_MOBILIER, COMMANDES_PLACES]) {
      for (const [nom, commande] of registre) assert.equal(COMMANDES.get(nom), commande, nom);
    }
  });

  test("ErreurCommande importée de commandes.js est celle d'erreurs.js ; refus pose details.remede", () => {
    assert.equal(ErreurCommande, ErreurDesErreurs);
    const sans = refus('NOM_REQUIS');
    assert.ok(sans instanceof ErreurCommande);
    assert.equal(sans.name, 'ErreurCommande');
    assert.equal(sans.code, 'NOM_REQUIS');
    assert.deepEqual(sans.details, { remede: null });
    const avec = refus('PLAN_BLOQUE', { table: 2 }, { geste: 'debloquer' });
    assert.deepEqual(avec.details, { table: 2, remede: { geste: 'debloquer' } });
    refuse(() => executer('debloquer', chargeEssai(), {}), 'PLAN_NON_BLOQUE');
  });

  test("ni commandes_mobilier.js ni commandes_places.js n'atteignent commandes.js par leurs imports, à toute profondeur", () => {
    const cible = new URL('./commandes.js', import.meta.url).href;
    for (const depart of ['./commandes_mobilier.js', './commandes_places.js']) {
      const vus = new Set();
      const aVoir = [new URL(depart, import.meta.url).href];
      while (aVoir.length > 0) {
        const adresse = aVoir.pop();
        if (vus.has(adresse)) continue;
        vus.add(adresse);
        for (const { specificateur, argument } of chargements(readFileSync(new URL(adresse), 'utf8'))) {
          assert.equal(argument, undefined, `${adresse} : chargement calculé`);
          if (specificateur.startsWith('.')) aVoir.push(new URL(specificateur, adresse).href);
        }
      }
      assert.ok(vus.size >= 1, `${depart} : aucun module parcouru`);
      assert.ok(!vus.has(cible), `${depart} atteint commandes.js`);
    }
  });
});

describe('commandes : le placement daté (§ 8.9, § 11.8, Q2)', () => {
  const H = '2031-05-17T20:15:00-04:00';
  const H2 = '2031-05-17T21:40:00-04:00';
  const H3 = '2031-05-17T22:05:00-04:00';
  const dater = (nom, charge, args, horodatage) => appliquerCommande(nom, charge, args, { horodatage });
  const horodatages = (charge) => charge.propositions.map((p) => [p.id, p.horodatage ?? null]);

  // La charge d'essai, la table 2 surchargée à trois places et une troisième
  // table de deux places : deux propositions engendrées sous H, la première
  // retenue sous H.
  function chargeDatee() {
    const charge = chargeEssai();
    charge.tables[1].sieges = 3;
    charge.tables.push(table(3, 500));
    charge.prochainsIds.table = 4;
    const generee = dater('enregistrerGeneration', charge, generer(charge, 2), H).charge;
    return dater('retenirProposition', generee, { id: 1 }, H).charge;
  }

  test('enregistrerGeneration date les seules propositions nouvelles ; retenirProposition date le retenu, sans toucher les propositions', () => {
    const premiere = dater('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2), H).charge;
    assert.deepEqual(horodatages(premiere), [[1, H], [2, H]]);
    const seconde = dater('enregistrerGeneration', premiere, generer(premiere, 2, 11), H2).charge;
    assert.deepEqual(horodatages(seconde), [[1, H], [2, H], [3, H2], [4, H2]]);
    const retenue = dater('retenirProposition', seconde, { id: 3 }, H3).charge;
    assert.equal(retenue.retenu.horodatage, H3);
    assert.deepEqual(retenue.propositions, seconde.propositions);
  });

  test('deplacerDansRetenu et realignerTable, qui changent le retenu, le datent de leur geste', () => {
    const charge = chargeDatee();
    assert.equal(charge.retenu.horodatage, H);
    const assises = charge.retenu.placement[0].sieges;
    const arrivee = assises.findIndex((liste, rang) => !liste.includes(3) && liste.length < charge.retenu.capacites[rang]);
    assert.ok(arrivee >= 0, 'une table d’arrivée libre');
    const deplace = dater('deplacerDansRetenu', charge, { tour: 1, participant: 3, table: charge.retenu.tables[arrivee], siege: null }, H2).charge;
    assert.notDeepEqual(deplace.retenu.placement, charge.retenu.placement);
    assert.equal(deplace.retenu.horodatage, H2);
    assert.deepEqual(horodatages(deplace), horodatages(charge));
    const realignee = dater('realignerTable', charge, { id: 2 }, H3).charge;
    assert.notDeepEqual(realignee.retenu.capacites, charge.retenu.capacites);
    assert.equal(realignee.retenu.horodatage, H3);
  });

  test('une commande qui ne touche pas le placement le garde daté de son instant : corriger un nom, déplacer une table', () => {
    const charge = chargeDatee();
    const renommee = dater('modifierParticipant', charge, { id: 3, champs: { nom: 'Pervenche-Lacasse' } }, H2).charge;
    assert.equal(renommee.participants.find(({ id }) => id === 3).nom, 'Pervenche-Lacasse');
    assert.equal(renommee.retenu.horodatage, H);
    assert.deepEqual(horodatages(renommee), [[1, H], [2, H]]);
    const deplacee = dater('deplacerTable', charge, { id: 3, position: { x: 700, y: 0 } }, H2).charge;
    assert.equal(deplacee.retenu.horodatage, H);
  });

  test("une commande qui reconstruit le retenu à l'identique garde son horodatage, présent ou absent", () => {
    const proposee = dater('changerEtat', chargeDatee(), { etat: 'propose' }, H2).charge;
    assert.equal(proposee.retenu.horodatage, H);
    const reprise = dater('retenirProposition', proposee, { id: 1 }, H3).charge;
    assert.equal(reprise.evenement.etat, 'retenu');
    assert.equal(reprise.retenu.horodatage, H);
    const ancienne = structuredClone(proposee);
    delete ancienne.retenu.horodatage;
    const repriseAncienne = dater('retenirProposition', ancienne, { id: 1 }, H3).charge;
    assert.equal(Object.hasOwn(repriseAncienne.retenu, 'horodatage'), false);
    const autre = dater('retenirProposition', proposee, { id: 2 }, H3).charge;
    assert.equal(autre.retenu.horodatage, H3);
    // Sans instant, la même reconstruction garde aussi l'horodatage reçu, et
    // SANS_EFFET rend le même verdict qu'avec un instant.
    const repriseSansInstant = dater('retenirProposition', proposee, { id: 1 }, null).charge;
    assert.equal(repriseSansInstant.retenu.horodatage, H);
    refuse(() => dater('retenirProposition', chargeDatee(), { id: 1 }, null), 'SANS_EFFET', { commande: 'retenirProposition', remede: null });
  });

  test('SANS_EFFET se juge avant la datation : retenir de nouveau le même retenu, ou poser le même état, sous un autre instant', () => {
    const charge = chargeDatee();
    refuse(() => dater('retenirProposition', charge, { id: 1 }, H2), 'SANS_EFFET', { commande: 'retenirProposition', remede: null });
    refuse(() => dater('changerEtat', charge, { etat: 'retenu' }, H2), 'SANS_EFFET', { commande: 'changerEtat', remede: null });
  });

  test("horodatage null, ou absent : rien n'est posé ni retiré", () => {
    const generee = appliquerCommande('enregistrerGeneration', chargeEssai(), generer(chargeEssai(), 2)).charge;
    assert.deepEqual(horodatages(generee), [[1, null], [2, null]]);
    const retenue = dater('retenirProposition', generee, { id: 1 }, null).charge;
    assert.equal(Object.hasOwn(retenue.retenu, 'horodatage'), false);
    const datee = chargeDatee();
    const renommee = dater('modifierParticipant', datee, { id: 3, champs: { nom: 'Pervenche-Lacasse' } }, null).charge;
    assert.equal(renommee.retenu.horodatage, H);
    assert.deepEqual(horodatages(renommee), [[1, H], [2, H]]);
  });

  test("la charge reçue ne change pas ; un horodatage d'une autre forme est une faute du code", () => {
    const charge = figer(chargeDatee());
    const avant = structuredClone(charge);
    dater('deplacerTable', charge, { id: 3, position: { x: 700, y: 0 } }, H2);
    dater('retenirProposition', figer(dater('changerEtat', charge, { etat: 'propose' }, H2).charge), { id: 2 }, H3);
    assert.deepEqual(charge, avant);
    for (const faux of ['2031-05-17 20:15', 12, '']) {
      assert.throws(() => dater('deplacerTable', charge, { id: 3, position: { x: 700, y: 0 } }, faux), TypeError, JSON.stringify(faux));
    }
  });
});
