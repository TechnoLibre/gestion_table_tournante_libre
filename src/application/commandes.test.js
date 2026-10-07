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
import { rechercher } from '../moteur/recherche.js';
import { configurationDepuisCharge, creerCharge, etatDeduit } from '../stockage/document.js';
import { derive, fautes, formeNommee, planDepuisFichier } from '../stockage/placements.js';
import { VERSION } from '../version.genere.js';
import { readFileSync } from 'node:fs';
import { chargements } from '../../test/chargements.js';
import { COMMANDES, ErreurCommande, appliquerCommande, chargeNeuve, formeNommeeDe, reunirCommandes } from './commandes.js';
import { COMMANDES_MOBILIER } from './commandes_mobilier.js';
import { COMMANDES_PLACES } from './commandes_places.js';
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
  test("le registre porte les onze commandes d'A1, les dix des places et celles du mobilier, chacune une fonction", () => {
    const attendues = [
      'ajouterParticipant',
      'changerEtat',
      'convertirEnTous',
      'debloquer',
      'deplacerDansRetenu',
      'deplacerReservation',
      'designer',
      'echangerDansRetenu',
      'effacerPropositions',
      'enregistrerGeneration',
      'exclureParticipant',
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
    assert.equal(attendues.length, 21);
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

  // La charge que reçoit chaque commande : la charge riche, sauf debloquer,
  // qui la reçoit bloquée ; convertirEnTous, qui y trouve Théo réservé à la
  // table 2 à chaque tour, en portée « tour » ; deplacerDansRetenu, qui y
  // trouve l'autre personne du tour 1 retirée dans la réserve.
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
      ['changerEtat', { etat: 'bloque' }],
      ['debloquer', {}],
      ['enregistrerGeneration', generer(charge, 1, 5)],
      ['retenirProposition', { id: 2 }],
      ['effacerPropositions', {}],
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

  test("COMMANDES réunit les onze commandes d'A1 et les deux registres de F1, vides tant que leurs tâches ne les remplissent pas", () => {
    assert.equal(COMMANDES.size, 11 + COMMANDES_MOBILIER.size + COMMANDES_PLACES.size);
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
