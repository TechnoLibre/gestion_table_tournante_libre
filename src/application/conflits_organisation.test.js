// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des conflits d'organisation et des inclusions côté application
// (§ 4, § 5.9, § 8.2, § 8.9) : ajouter et retirer un conflit, poser une
// liste de conflits ou d'inclusions, une entrée d'historique chacun, et les
// listes qui suivent un renommage ou la disparition d'une organisation, ou
// la suppression d'une personne incluse, dans l'entrée du geste qui la
// provoque. Chaque charge rendue se relit par l'analyse du fichier : une
// liste qui nommerait une organisation disparue, la sienne, une personne
// retirée ou soi-même y serait refusée. Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import { apercevoir } from '../csv/apercu.js';
import { serialiser } from '../stockage/canonique.js';
import { analyser, creerCharge } from '../stockage/document.js';
import { VERSION } from '../version.genere.js';
import { COMMANDES, ErreurCommande, appliquerCommande } from './commandes.js';
import { organisationsDe, rienASuivre, suivreOrganisations } from './conflits_organisation.js';

const RAMEAU = 'Atelier Rameau';
const TILLEUL = 'Coopérative Tilleul';
const SAULE = 'Ferme du Saule';

const personne = (id, nom, organisation = null, autres = {}) => ({
  id,
  nom,
  prenom: null,
  organisation,
  courriel: null,
  titrePressenti: null,
  notes: null,
  exclu: false,
  ...autres,
});

// Six personnes : 1 et 2 de l'Atelier Rameau, 3 et 4 de la Coopérative
// Tilleul, 5 de la Ferme du Saule, 6 sans organisation. 1 nomme le Tilleul,
// 6 le Rameau et le Saule.
function chargeConflits() {
  const charge = creerCharge({ id: 'evt-sous-bois', nom: 'Soirée du Sous-bois', siegesParDefaut: 3, tours: 2 });
  charge.prochainsIds = { participant: 7, table: 3, proposition: 1 };
  charge.participants = [
    personne(1, 'Fougère', RAMEAU, { conflits: [TILLEUL] }),
    personne(2, 'Lierre', RAMEAU),
    personne(3, 'Mousse', TILLEUL),
    personne(4, 'Ronce', TILLEUL),
    personne(5, 'Bruyère', SAULE),
    personne(6, 'Chèvrefeuille', null, { conflits: [SAULE, RAMEAU].sort() }),
  ];
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 200 * id, y: 0 } }));
  return charge;
}

const executer = (nom, charge, args) => COMMANDES.get(nom)(charge, args);
const conflitsDe = (charge, id) => charge.participants.find((p) => p.id === id).conflits;

// La charge relue par l'analyse du fichier, qui juge chaque liste.
const relue = (charge) => analyser(serialiser(charge, { revision: 1, produitVersion: VERSION.affichee })).charge;

function refuse(appel, code, details) {
  assert.throws(appel, (erreur) => {
    assert.ok(erreur instanceof ErreurCommande, `ErreurCommande attendue, reçu ${erreur}`);
    assert.equal(erreur.code, code);
    if (details !== undefined) assert.deepEqual(erreur.details, details);
    return true;
  });
}

describe('organisationsDe', () => {
  test("les organisations portées, chacune une fois, exclus compris ; aucune pour qui n'en porte pas", () => {
    const charge = chargeConflits();
    charge.participants[4].exclu = true;
    assert.deepEqual([...organisationsDe(charge)], [RAMEAU, TILLEUL, SAULE]);
  });
});

describe('ajouterConflit et retirerConflit (§ 4, § 8.2)', () => {
  test("ajouter : la liste se range par unités de code, une entrée qui nomme la personne et l'organisation", () => {
    const { charge, libelle, avertissements } = executer('ajouterConflit', chargeConflits(), { id: 1, organisation: ` ${SAULE} ` });
    assert.deepEqual(conflitsDe(charge, 1), [TILLEUL, SAULE].sort());
    assert.equal(libelle, `Conflits de Fougère : ajouté « ${SAULE} »`);
    assert.deepEqual(avertissements, []);
    // Une personne sans liste en reçoit une ; la charge relue l'admet.
    const premier = executer('ajouterConflit', chargeConflits(), { id: 3, organisation: SAULE }).charge;
    assert.deepEqual(conflitsDe(premier, 3), [SAULE]);
    assert.deepEqual(conflitsDe(relue(premier), 3), [SAULE]);
  });

  test("ajouter refuse sa propre organisation, une organisation que personne ne porte, une organisation déjà nommée", () => {
    refuse(() => executer('ajouterConflit', chargeConflits(), { id: 2, organisation: RAMEAU }), 'CONFLIT_PROPRE_ORGANISATION', {
      personne: 'Lierre',
      organisation: RAMEAU,
      remede: null,
    });
    refuse(() => executer('ajouterConflit', chargeConflits(), { id: 2, organisation: 'Atelier Pivoine' }), 'ORGANISATION_INCONNUE', {
      organisation: 'Atelier Pivoine',
      remede: null,
    });
    // L'égalité de chaînes décide, après NFC et les blancs de bord.
    refuse(() => executer('ajouterConflit', chargeConflits(), { id: 2, organisation: 'atelier rameau' }), 'ORGANISATION_INCONNUE');
    refuse(() => executer('ajouterConflit', chargeConflits(), { id: 2, organisation: '  ' }), 'ORGANISATION_INCONNUE', {
      organisation: '',
      remede: null,
    });
    refuse(() => executer('ajouterConflit', chargeConflits(), { id: 1, organisation: TILLEUL }), 'SANS_EFFET', {
      commande: 'ajouterConflit',
      remede: null,
    });
    refuse(() => executer('ajouterConflit', chargeConflits(), { id: 99, organisation: TILLEUL }), 'PARTICIPANT_INCONNU');
    assert.throws(() => executer('ajouterConflit', chargeConflits(), { id: 1, organisation: 7 }), TypeError);
  });

  test("ajouter sous une organisation en NFD l'enregistre en NFC, comme le fichier la porte", () => {
    const charge = chargeConflits();
    const nfd = 'Cafe\u{301} des Pins';
    charge.participants[4].organisation = nfd.normalize('NFC');
    const { charge: suivante } = executer('ajouterConflit', charge, { id: 1, organisation: nfd });
    assert.deepEqual(conflitsDe(suivante, 1), [nfd.normalize('NFC'), TILLEUL].sort());
  });

  test('retirer : la liste perd l’organisation, le champ se retire vide ; une organisation non nommée est SANS_EFFET', () => {
    const { charge, libelle } = executer('retirerConflit', chargeConflits(), { id: 6, organisation: SAULE });
    assert.deepEqual(conflitsDe(charge, 6), [RAMEAU]);
    assert.equal(libelle, `Conflits de Chèvrefeuille : retiré « ${SAULE} »`);
    const vide = executer('retirerConflit', chargeConflits(), { id: 1, organisation: TILLEUL }).charge;
    assert.ok(!Object.hasOwn(vide.participants[0], 'conflits'));
    refuse(() => executer('retirerConflit', chargeConflits(), { id: 2, organisation: TILLEUL }), 'SANS_EFFET', {
      commande: 'retirerConflit',
      remede: null,
    });
  });

  test('sur un plan bloqué, les deux refusent PLAN_BLOQUE', () => {
    const charge = chargeConflits();
    charge.evenement.etat = 'bloque';
    refuse(() => executer('ajouterConflit', charge, { id: 3, organisation: SAULE }), 'PLAN_BLOQUE');
    refuse(() => executer('retirerConflit', charge, { id: 1, organisation: TILLEUL }), 'PLAN_BLOQUE');
  });
});

describe('changerConflits : la liste entière, en un geste (§ 4, § 8.2)', () => {
  test("ajouts et retraits en une entrée, qui les nomme ; la liste se range, et la charge se relit", () => {
    const { charge, libelle, avertissements } = executer('changerConflits', chargeConflits(), {
      id: 6,
      organisations: [TILLEUL, ` ${RAMEAU} `, TILLEUL],
    });
    assert.deepEqual(conflitsDe(charge, 6), [RAMEAU, TILLEUL]);
    assert.equal(libelle, `Conflits de Chèvrefeuille : ajouté « ${TILLEUL} » ; retiré « ${SAULE} »`);
    assert.deepEqual(avertissements, []);
    assert.deepEqual(conflitsDe(relue(charge), 6), [RAMEAU, TILLEUL]);
    const deux = executer('changerConflits', chargeConflits(), { id: 3, organisations: [SAULE, RAMEAU] });
    assert.deepEqual(conflitsDe(deux.charge, 3), [RAMEAU, SAULE]);
    assert.equal(deux.libelle, `Conflits de Mousse : ajouté « ${RAMEAU} » et « ${SAULE} »`);
  });

  test('la liste vide retire le champ ; la même liste, dans un autre ordre, est SANS_EFFET', () => {
    const { charge, libelle } = executer('changerConflits', chargeConflits(), { id: 6, organisations: [] });
    assert.ok(!Object.hasOwn(charge.participants[5], 'conflits'));
    assert.equal(libelle, `Conflits de Chèvrefeuille : retiré « ${RAMEAU} » et « ${SAULE} »`);
    refuse(() => executer('changerConflits', chargeConflits(), { id: 6, organisations: [SAULE, RAMEAU, SAULE] }), 'SANS_EFFET', {
      commande: 'changerConflits',
      remede: null,
    });
    refuse(() => executer('changerConflits', chargeConflits(), { id: 2, organisations: [] }), 'SANS_EFFET');
  });

  test("un nom nouveau se juge comme ajouterConflit : inconnu, ou sa propre organisation, refuse le geste entier ; la charge reste", () => {
    const charge = chargeConflits();
    const avant = structuredClone(charge);
    refuse(() => executer('changerConflits', charge, { id: 2, organisations: [SAULE, RAMEAU] }), 'CONFLIT_PROPRE_ORGANISATION', {
      personne: 'Lierre',
      organisation: RAMEAU,
      remede: null,
    });
    refuse(() => executer('changerConflits', charge, { id: 2, organisations: [SAULE, 'atelier pivoine'] }), 'ORGANISATION_INCONNUE', {
      organisation: 'atelier pivoine',
      remede: null,
    });
    refuse(() => executer('changerConflits', charge, { id: 99, organisations: [] }), 'PARTICIPANT_INCONNU');
    assert.throws(() => executer('changerConflits', charge, { id: 2, organisations: SAULE }), TypeError);
    assert.throws(() => executer('changerConflits', charge, { id: 2, organisations: [SAULE, 7] }), TypeError);
    charge.evenement.etat = 'bloque';
    refuse(() => executer('changerConflits', charge, { id: 3, organisations: [SAULE] }), 'PLAN_BLOQUE');
    charge.evenement.etat = avant.evenement.etat;
    assert.deepEqual(charge, avant);
  });
});

describe('les listes suivent les organisations (§ 4, § 8.9)', () => {
  test("la dernière personne d'une organisation qui en change : la référence suit le renommage, dans la même entrée", () => {
    // Le Saule n'a qu'une personne, 5 : elle passe à la Ferme des Saules.
    const { charge, libelle } = appliquerCommande('modifierParticipant', chargeConflits(), {
      id: 5,
      champs: { organisation: 'Ferme des Saules' },
    });
    assert.deepEqual(conflitsDe(charge, 6), ['Ferme des Saules', RAMEAU].sort());
    assert.equal(libelle, `Modifié Bruyère : organisation ; « ${SAULE} » devient « Ferme des Saules » dans les conflits`);
    assert.deepEqual(conflitsDe(relue(charge), 6), ['Ferme des Saules', RAMEAU].sort());
  });

  test("une organisation de deux personnes renommée une à une : la référence suit vers l'organisation que la première a créée", () => {
    // 3 passe à la Coopérative des Frênes, que personne ne portait : le
    // Tilleul garde 4, aucune liste ne change. 4 la rejoint ensuite : le
    // Tilleul disparaît vers une organisation qui existe déjà, et que la
    // liste de 1 ne nommait pas.
    const FRENES = 'Coopérative des Frênes';
    const premier = appliquerCommande('modifierParticipant', chargeConflits(), { id: 3, champs: { organisation: FRENES } });
    assert.deepEqual(conflitsDe(premier.charge, 1), [TILLEUL]);
    assert.equal(premier.libelle, 'Modifié Mousse : organisation');
    const second = appliquerCommande('modifierParticipant', premier.charge, { id: 4, champs: { organisation: FRENES } });
    assert.deepEqual(conflitsDe(second.charge, 1), [FRENES]);
    assert.equal(second.libelle, `Modifié Ronce : organisation ; « ${TILLEUL} » devient « ${FRENES} » dans les conflits`);
    assert.deepEqual(conflitsDe(relue(second.charge), 1), [FRENES]);
  });

  test("un import qui met à jour donne à une personne l'organisation qu'elle nommait : elle quitte sa liste, dans l'entrée de l'import", () => {
    // Une mise à jour ne change pas l'organisation d'une personne qui en a
    // une — une autre clé ne la désigne pas, la même clé garde la graphie de
    // l'événement — : elle en donne une à qui n'en a pas. Chèvrefeuille,
    // sans organisation, nomme le Saule et le Rameau ; elle rejoint le
    // Saule.
    const charge = chargeConflits();
    const apercu = apercevoir(`nom;organisation\nChèvrefeuille;${SAULE}\n`, { participants: charge.participants, mode: 'mettreAJour' });
    const { charge: suivante, libelle } = appliquerCommande('importerParticipants', charge, { apercu, mode: 'mettreAJour' });
    assert.equal(suivante.participants.find(({ id }) => id === 6).organisation, SAULE);
    assert.deepEqual(conflitsDe(suivante, 6), [RAMEAU]);
    assert.equal(libelle, 'Mis à jour la liste par import : 0 ajouté, 1 modifié ; 1 conflit avec sa propre organisation retiré');
    assert.deepEqual(conflitsDe(relue(suivante), 6), [RAMEAU]);
  });

  test("une organisation qui garde des personnes ne change aucune liste ; sans organisation, la dernière quitte les listes", () => {
    // 3 quitte le Tilleul, que 4 porte encore.
    const garde = appliquerCommande('modifierParticipant', chargeConflits(), { id: 3, champs: { organisation: SAULE } });
    assert.deepEqual(conflitsDe(garde.charge, 1), [TILLEUL]);
    assert.equal(garde.libelle, 'Modifié Mousse : organisation');
    // 5 n'a plus d'organisation : le Saule quitte la liste de 6.
    const quitte = appliquerCommande('modifierParticipant', chargeConflits(), { id: 5, champs: { organisation: '' } });
    assert.deepEqual(conflitsDe(quitte.charge, 6), [RAMEAU]);
    assert.equal(quitte.libelle, `Modifié Bruyère : organisation ; « ${SAULE} » quitte les conflits`);
  });

  test('supprimer la dernière personne d’une organisation la retire de chaque liste, le champ vidé retiré', () => {
    let charge = chargeConflits();
    charge = appliquerCommande('supprimerParticipant', charge, { id: 3 }).charge;
    assert.deepEqual(conflitsDe(charge, 1), [TILLEUL]);
    const { charge: suivante, libelle } = appliquerCommande('supprimerParticipant', charge, { id: 4 });
    assert.ok(!Object.hasOwn(suivante.participants.find(({ id }) => id === 1), 'conflits'));
    assert.equal(libelle, `Supprimé Ronce ; « ${TILLEUL} » quitte les conflits`);
    assert.doesNotThrow(() => relue(suivante));
  });

  test("passer à une organisation qu'on nommait l'ôte de sa propre liste ; un renommage vers une organisation existante fusionne", () => {
    // 6 prend le Saule, qu'elle nommait.
    const propre = appliquerCommande('modifierParticipant', chargeConflits(), { id: 6, champs: { organisation: SAULE } });
    assert.deepEqual(conflitsDe(propre.charge, 6), [RAMEAU]);
    assert.equal(propre.libelle, 'Modifié Chèvrefeuille : organisation ; 1 conflit avec sa propre organisation retiré');
    // La dernière du Saule rejoint le Rameau : 6 nommait les deux, et ne
    // nomme plus que le Rameau.
    const fusion = appliquerCommande('modifierParticipant', chargeConflits(), { id: 5, champs: { organisation: RAMEAU } });
    assert.deepEqual(conflitsDe(fusion.charge, 6), [RAMEAU]);
    assert.doesNotThrow(() => relue(fusion.charge));
  });

  test("un import qui remplace la liste retire des conflits les organisations qu'il fait disparaître", () => {
    const charge = chargeConflits();
    const apercu = apercevoir(`nom;organisation\nGenêt;${RAMEAU}\nAjonc;\n`, { participants: charge.participants, mode: 'remplacer' });
    const { charge: suivante } = appliquerCommande('importerParticipants', charge, { apercu, mode: 'remplacer' });
    assert.ok(suivante.participants.every(({ conflits }) => conflits === undefined));
    assert.doesNotThrow(() => relue(suivante));
  });

  test('suivreOrganisations ne copie que les personnes touchées, et rend ce qui a suivi', () => {
    const avant = chargeConflits();
    const suivante = structuredClone(avant);
    suivante.participants = suivante.participants.filter(({ id }) => id !== 5);
    const intacte = suivante.participants[1];
    const suivi = suivreOrganisations(avant, suivante);
    assert.deepEqual(suivi, {
      conflits: { renommee: null, retirees: [SAULE], propres: 0 },
      inclusions: { renommee: null, retirees: [], propres: 0 },
    });
    assert.equal(rienASuivre(suivi.conflits), false);
    assert.equal(rienASuivre(suivi.inclusions), true);
    assert.equal(suivante.participants[1], intacte);
    const rien = suivreOrganisations(avant, structuredClone(avant));
    assert.equal(rienASuivre(rien.conflits) && rienASuivre(rien.inclusions), true);
  });
});

describe("l'import pose les conflits de la colonne conflit_organisation (§ 10.1)", () => {
  test("une organisation que le même fichier crée se nomme : les listes s'écrivent rangées, dans l'entrée de l'import, et la charge se relit", () => {
    const charge = chargeConflits();
    const texte = `nom;organisation;conflits\nGenêt;Clos des Ajoncs;${RAMEAU.toUpperCase()} | ferme du saule\nAjonc;;Clos des Ajoncs\n`;
    const apercu = apercevoir(texte, { participants: charge.participants, mode: 'ajouter' });
    const { charge: suivante, libelle } = appliquerCommande('importerParticipants', charge, { apercu, mode: 'ajouter' });
    assert.deepEqual(conflitsDe(suivante, 7), [RAMEAU, SAULE]);
    assert.deepEqual(conflitsDe(suivante, 8), ['Clos des Ajoncs']);
    assert.equal(libelle, 'Importé 2 participants');
    assert.deepEqual(relue(suivante).participants, suivante.participants);
  });

  test("une organisation que nul ne porte, ou la sienne, refuse l'import entier : le code, la ligne et l'organisation, sans remède ; la charge reste", () => {
    const charge = chargeConflits();
    const avant = structuredClone(charge);
    for (const [texte, code, details] of [
      [`nom;conflits\nGenêt;${RAMEAU}\nAjonc;Clos des Ajoncs\n`, 'CONFLIT_ORGANISATION_INCONNUE', { ligne: 3, organisation: 'Clos des Ajoncs' }],
      [`nom;organisation;conflits\nGenêt;${SAULE};${SAULE}\n`, 'CONFLIT_ORGANISATION_PROPRE', { ligne: 2, organisation: SAULE }],
    ]) {
      const apercu = apercevoir(texte, { participants: charge.participants, mode: 'ajouter' });
      refuse(() => appliquerCommande('importerParticipants', charge, { apercu, mode: 'ajouter' }), code, { ...details, remede: null });
    }
    assert.deepEqual(charge, avant);
  });

  test("en mise à jour, une organisation que seule porte une ligne refusée DEJA_DESIGNE ou PLUSIEURS_CORRESPONDENT refuse l'import ; portée par une ligne posée, la charge se relit", () => {
    const charge = chargeConflits();
    charge.participants.push(personne(7, 'Ortie'), personne(8, 'Ortie'));
    charge.prochainsIds.participant = 9;
    const avant = structuredClone(charge);
    for (const [texte, ligne] of [
      ['nom;organisation;conflits\nChèvrefeuille;;\nChèvrefeuille;Clos Neuf;\nGenêt;;Clos Neuf\n', 4],
      ['nom;organisation;conflits\nOrtie;Clos Neuf;\nGenêt;;Clos Neuf\n', 3],
    ]) {
      const apercu = apercevoir(texte, { participants: charge.participants, mode: 'mettreAJour' });
      refuse(() => appliquerCommande('importerParticipants', charge, { apercu, mode: 'mettreAJour' }), 'CONFLIT_ORGANISATION_INCONNUE', {
        ligne, organisation: 'Clos Neuf', remede: null,
      });
    }
    assert.deepEqual(charge, avant);
    const texte = 'nom;organisation;conflits\nChèvrefeuille;Clos Neuf;\nChèvrefeuille;;\nGenêt;;Clos Neuf\n';
    const apercu = apercevoir(texte, { participants: charge.participants, mode: 'mettreAJour' });
    const { charge: suivante, resume } = appliquerCommande('importerParticipants', charge, { apercu, mode: 'mettreAJour' });
    assert.deepEqual(resume.refusees.map(({ ligne, code }) => [ligne, code]), [[3, 'DEJA_DESIGNE']]);
    assert.deepEqual(conflitsDe(suivante, 9), ['Clos Neuf']);
    assert.deepEqual(relue(suivante).participants, suivante.participants);
  });
});

// --- Les inclusions ------------------------------------------------------------

// La charge des conflits, ses inclusions posées : 1 (Rameau) inclut le Saule,
// Mousse (3) et Bruyère (5) ; 3 inclut 1 en retour ; 6, sans organisation,
// inclut le Tilleul et Bruyère. Bruyère est la seule du Saule.
function chargeInclusions() {
  const charge = chargeConflits();
  const poser = (id, champs) => Object.assign(charge.participants.find((p) => p.id === id), champs);
  poser(1, { inclusionsOrganisation: [SAULE], inclusionsParticipant: [3, 5] });
  poser(3, { inclusionsParticipant: [1] });
  poser(6, { inclusionsOrganisation: [TILLEUL], inclusionsParticipant: [5] });
  return charge;
}

const champDe = (charge, id, champ) => charge.participants.find((p) => p.id === id)[champ];
const organisationsIncluses = (charge, id) => champDe(charge, id, 'inclusionsOrganisation');
const personnesIncluses = (charge, id) => champDe(charge, id, 'inclusionsParticipant');

describe('changerInclusionsOrganisation : la liste entière, en un geste (§ 4, § 5.9, § 8.2)', () => {
  test("ajouts et retraits en une entrée, qui les nomme ; la liste se range, sans doublon, et la charge se relit", () => {
    const { charge, libelle, avertissements } = executer('changerInclusionsOrganisation', chargeInclusions(), {
      id: 6,
      organisations: [` ${SAULE} `, RAMEAU, SAULE],
    });
    assert.deepEqual(organisationsIncluses(charge, 6), [RAMEAU, SAULE]);
    assert.equal(libelle, `Inclusions d'organisation de Chèvrefeuille : ajouté « ${RAMEAU} » et « ${SAULE} » ; retiré « ${TILLEUL} »`);
    assert.deepEqual(avertissements, []);
    assert.deepEqual(organisationsIncluses(relue(charge), 6), [RAMEAU, SAULE]);
    // Une personne sans liste en reçoit une ; les autres listes ne bougent pas.
    const premier = executer('changerInclusionsOrganisation', chargeInclusions(), { id: 4, organisations: [SAULE] });
    assert.deepEqual(organisationsIncluses(premier.charge, 4), [SAULE]);
    assert.equal(premier.libelle, `Inclusions d'organisation de Ronce : ajouté « ${SAULE} »`);
    assert.deepEqual(conflitsDe(premier.charge, 4), undefined);
    assert.deepEqual(personnesIncluses(premier.charge, 4), undefined);
  });

  test('la liste vide retire le champ ; la même liste, dans un autre ordre, est SANS_EFFET', () => {
    const { charge, libelle } = executer('changerInclusionsOrganisation', chargeInclusions(), { id: 1, organisations: [] });
    assert.ok(!Object.hasOwn(charge.participants[0], 'inclusionsOrganisation'));
    assert.deepEqual(personnesIncluses(charge, 1), [3, 5]);
    assert.equal(libelle, `Inclusions d'organisation de Fougère : retiré « ${SAULE} »`);
    refuse(() => executer('changerInclusionsOrganisation', chargeInclusions(), { id: 1, organisations: [SAULE, SAULE] }), 'SANS_EFFET', {
      commande: 'changerInclusionsOrganisation',
      remede: null,
    });
    refuse(() => executer('changerInclusionsOrganisation', chargeInclusions(), { id: 2, organisations: [] }), 'SANS_EFFET');
  });

  test("une organisation que nomme un conflit de la personne s'admet ; celle des seuls exclus aussi", () => {
    // 1 est en conflit avec le Tilleul, et l'inclut : la contradiction ne se
    // refuse pas (§ 4).
    const contredite = executer('changerInclusionsOrganisation', chargeInclusions(), { id: 1, organisations: [SAULE, TILLEUL] });
    assert.deepEqual(organisationsIncluses(contredite.charge, 1), [TILLEUL, SAULE].sort());
    assert.deepEqual(contredite.avertissements, []);
    assert.doesNotThrow(() => relue(contredite.charge));
    const exclus = chargeInclusions();
    exclus.participants[4].exclu = true;
    const suivante = executer('changerInclusionsOrganisation', exclus, { id: 3, organisations: [SAULE] }).charge;
    assert.deepEqual(organisationsIncluses(relue(suivante), 3), [SAULE]);
  });

  test("sa propre organisation, ou une organisation que nul ne porte, refuse le geste entier, le premier fautif d'abord ; la charge reste", () => {
    const charge = chargeInclusions();
    const avant = structuredClone(charge);
    refuse(() => executer('changerInclusionsOrganisation', charge, { id: 2, organisations: [SAULE, RAMEAU] }), 'INCLUSION_PROPRE_ORGANISATION', {
      personne: 'Lierre',
      organisation: RAMEAU,
      remede: null,
    });
    refuse(() => executer('changerInclusionsOrganisation', charge, { id: 2, organisations: ['atelier pivoine', RAMEAU] }), 'ORGANISATION_INCONNUE', {
      organisation: 'atelier pivoine',
      remede: null,
    });
    refuse(() => executer('changerInclusionsOrganisation', charge, { id: 2, organisations: [RAMEAU, 'atelier pivoine'] }), 'INCLUSION_PROPRE_ORGANISATION');
    refuse(() => executer('changerInclusionsOrganisation', charge, { id: 99, organisations: [] }), 'PARTICIPANT_INCONNU');
    assert.throws(() => executer('changerInclusionsOrganisation', charge, { id: 2, organisations: SAULE }), TypeError);
    assert.throws(() => executer('changerInclusionsOrganisation', charge, { id: 2, organisations: [SAULE, 7] }), TypeError);
    charge.evenement.etat = 'bloque';
    refuse(() => executer('changerInclusionsOrganisation', charge, { id: 3, organisations: [SAULE] }), 'PLAN_BLOQUE');
    charge.evenement.etat = avant.evenement.etat;
    assert.deepEqual(charge, avant);
  });
});

describe('changerInclusionsParticipant : la liste entière, par identifiant, en un geste (§ 4, § 5.9, § 8.2)', () => {
  test("ajouts et retraits en une entrée, qui les nomme par leur nom affiché, dans l'ordre des identifiants ; la liste est croissante", () => {
    const { charge, libelle, avertissements } = executer('changerInclusionsParticipant', chargeInclusions(), {
      id: 1,
      participants: [6, 4, 3, 6],
    });
    assert.deepEqual(personnesIncluses(charge, 1), [3, 4, 6]);
    assert.equal(libelle, "Inclusions de participant de Fougère : ajouté Ronce et Chèvrefeuille ; retiré Bruyère");
    assert.deepEqual(avertissements, []);
    assert.deepEqual(personnesIncluses(relue(charge), 1), [3, 4, 6]);
    assert.deepEqual(organisationsIncluses(charge, 1), [SAULE]);
  });

  test('un collègue, une personne exclue, une réciproque et une source exclue s’admettent', () => {
    const charge = chargeInclusions();
    charge.participants[3].exclu = true;
    charge.participants[4].exclu = true;
    // 1 inclut Lierre, sa collègue du Rameau, et Ronce, exclue ; 5, exclue,
    // inclut 6 ; 1 inclut 3, qui l'inclut déjà.
    let suivante = executer('changerInclusionsParticipant', charge, { id: 1, participants: [2, 3, 4, 5] }).charge;
    suivante = executer('changerInclusionsParticipant', suivante, { id: 5, participants: [6] }).charge;
    const lue = relue(suivante);
    assert.deepEqual(personnesIncluses(lue, 1), [2, 3, 4, 5]);
    assert.deepEqual(personnesIncluses(lue, 3), [1]);
    assert.deepEqual(personnesIncluses(lue, 5), [6]);
  });

  test('la liste vide retire le champ ; la même liste, dans un autre ordre, est SANS_EFFET', () => {
    const { charge, libelle } = executer('changerInclusionsParticipant', chargeInclusions(), { id: 6, participants: [] });
    assert.ok(!Object.hasOwn(charge.participants[5], 'inclusionsParticipant'));
    assert.deepEqual(organisationsIncluses(charge, 6), [TILLEUL]);
    assert.equal(libelle, 'Inclusions de participant de Chèvrefeuille : retiré Bruyère');
    refuse(() => executer('changerInclusionsParticipant', chargeInclusions(), { id: 1, participants: [5, 3, 5] }), 'SANS_EFFET', {
      commande: 'changerInclusionsParticipant',
      remede: null,
    });
    refuse(() => executer('changerInclusionsParticipant', chargeInclusions(), { id: 2, participants: [] }), 'SANS_EFFET');
  });

  test("soi-même, ou un identifiant que nul n'a, refuse le geste entier, le premier fautif d'abord ; la charge reste", () => {
    const charge = chargeInclusions();
    const avant = structuredClone(charge);
    refuse(() => executer('changerInclusionsParticipant', charge, { id: 2, participants: [3, 2, 99] }), 'INCLUSION_DE_SOI', {
      personne: 'Lierre',
      remede: null,
    });
    refuse(() => executer('changerInclusionsParticipant', charge, { id: 2, participants: [3, 99, 2] }), 'PARTICIPANT_INCONNU', {
      id: 99,
      remede: null,
    });
    refuse(() => executer('changerInclusionsParticipant', charge, { id: 99, participants: [] }), 'PARTICIPANT_INCONNU', { id: 99, remede: null });
    for (const participants of [3, [3, '4'], [3, 4.5], [null]]) {
      assert.throws(() => executer('changerInclusionsParticipant', charge, { id: 2, participants }), TypeError);
    }
    charge.evenement.etat = 'bloque';
    refuse(() => executer('changerInclusionsParticipant', charge, { id: 2, participants: [3] }), 'PLAN_BLOQUE');
    charge.evenement.etat = avant.evenement.etat;
    assert.deepEqual(charge, avant);
  });

  test("un homonyme se désigne par son identifiant : le libellé nomme les deux sous le même nom, la liste les distingue", () => {
    const charge = chargeInclusions();
    charge.participants.push(personne(7, 'Ortie'), personne(8, 'Ortie'));
    charge.prochainsIds.participant = 9;
    const { charge: suivante, libelle } = executer('changerInclusionsParticipant', charge, { id: 2, participants: [8] });
    assert.deepEqual(personnesIncluses(suivante, 2), [8]);
    assert.equal(libelle, 'Inclusions de participant de Lierre : ajouté Ortie');
  });
});

describe('les inclusions suivent les organisations et les personnes (§ 4, § 8.2, § 8.9)', () => {
  test("la dernière personne d'une organisation qui en change : la référence suit dans les inclusions comme dans les conflits", () => {
    const { charge, libelle } = appliquerCommande('modifierParticipant', chargeInclusions(), {
      id: 5,
      champs: { organisation: 'Ferme des Saules' },
    });
    assert.deepEqual(organisationsIncluses(charge, 1), ['Ferme des Saules']);
    assert.deepEqual(conflitsDe(charge, 6), ['Ferme des Saules', RAMEAU].sort());
    assert.equal(
      libelle,
      `Modifié Bruyère : organisation ; « ${SAULE} » devient « Ferme des Saules » dans les conflits ; ` +
        `« ${SAULE} » devient « Ferme des Saules » dans les inclusions`,
    );
    assert.deepEqual(organisationsIncluses(relue(charge), 1), ['Ferme des Saules']);
  });

  test("sans organisation, la dernière quitte les inclusions ; le champ vidé se retire", () => {
    const { charge, libelle } = appliquerCommande('modifierParticipant', chargeInclusions(), { id: 5, champs: { organisation: '' } });
    assert.ok(!Object.hasOwn(charge.participants[0], 'inclusionsOrganisation'));
    assert.deepEqual(personnesIncluses(charge, 1), [3, 5]);
    assert.equal(libelle, `Modifié Bruyère : organisation ; « ${SAULE} » quitte les conflits ; « ${SAULE} » quitte les inclusions`);
    assert.doesNotThrow(() => relue(charge));
  });

  test("prendre l'organisation qu'on incluait l'ôte de sa liste ; une organisation qui garde des personnes ne change rien", () => {
    const propre = appliquerCommande('modifierParticipant', chargeInclusions(), { id: 6, champs: { organisation: TILLEUL } });
    assert.ok(!Object.hasOwn(propre.charge.participants[5], 'inclusionsOrganisation'));
    assert.equal(propre.libelle, 'Modifié Chèvrefeuille : organisation ; 1 inclusion de sa propre organisation retirée');
    assert.doesNotThrow(() => relue(propre.charge));
    const garde = appliquerCommande('modifierParticipant', chargeInclusions(), { id: 3, champs: { organisation: SAULE } });
    assert.deepEqual(organisationsIncluses(garde.charge, 6), [TILLEUL]);
    assert.equal(garde.libelle, 'Modifié Mousse : organisation');
  });

  test("supprimer une personne incluse la retire de chaque liste qui la nomme, dans la même entrée, et le libellé compte les listes", () => {
    // Bruyère, seule du Saule, est incluse par 1 et par 6.
    const { charge, libelle } = appliquerCommande('supprimerParticipant', chargeInclusions(), { id: 5 });
    assert.deepEqual(personnesIncluses(charge, 1), [3]);
    assert.ok(!Object.hasOwn(charge.participants.find(({ id }) => id === 6), 'inclusionsParticipant'));
    assert.deepEqual(personnesIncluses(charge, 3), [1]);
    assert.equal(
      libelle,
      `Supprimé Bruyère ; « ${SAULE} » quitte les conflits ; « ${SAULE} » quitte les inclusions ; retirée de 2 listes d'inclusions`,
    );
    assert.doesNotThrow(() => relue(charge));
    // Une personne qu'une seule liste nomme, dont l'organisation reste.
    const seule = appliquerCommande('supprimerParticipant', chargeInclusions(), { id: 3 });
    assert.deepEqual(personnesIncluses(seule.charge, 1), [5]);
    assert.equal(seule.libelle, "Supprimé Mousse ; retirée de 1 liste d'inclusions");
    // Ni incluse ni dernière de son organisation : le libellé n'ajoute rien.
    assert.equal(appliquerCommande('supprimerParticipant', chargeInclusions(), { id: 2 }).libelle, 'Supprimé Lierre');
    // La personne supprimée emporte ses propres listes.
    const source = appliquerCommande('supprimerParticipant', chargeInclusions(), { id: 1 });
    assert.deepEqual(personnesIncluses(source.charge, 3), undefined);
    assert.doesNotThrow(() => relue(source.charge));
  });

  test("un import qui met à jour donne à une personne l'organisation qu'elle incluait : elle quitte sa liste, dans l'entrée de l'import", () => {
    const charge = chargeInclusions();
    const apercu = apercevoir(`nom;organisation\nChèvrefeuille;${TILLEUL}\n`, { participants: charge.participants, mode: 'mettreAJour' });
    const { charge: suivante, libelle } = appliquerCommande('importerParticipants', charge, { apercu, mode: 'mettreAJour' });
    assert.ok(!Object.hasOwn(suivante.participants.find(({ id }) => id === 6), 'inclusionsOrganisation'));
    assert.equal(libelle, 'Mis à jour la liste par import : 0 ajouté, 1 modifié ; 1 inclusion de sa propre organisation retirée');
    assert.doesNotThrow(() => relue(suivante));
  });

  test("un import qui remplace la liste ne laisse aucune inclusion vers une personne retirée", () => {
    const charge = chargeInclusions();
    const apercu = apercevoir(`nom;organisation\nGenêt;${RAMEAU}\n`, { participants: charge.participants, mode: 'remplacer' });
    const { charge: suivante } = appliquerCommande('importerParticipants', charge, { apercu, mode: 'remplacer' });
    assert.ok(suivante.participants.every((p) => p.inclusionsOrganisation === undefined && p.inclusionsParticipant === undefined));
    assert.doesNotThrow(() => relue(suivante));
  });
});

describe('les inclusions : la charge reçue ne change jamais (§ 13.2)', () => {
  // Gèle une valeur en profondeur : un geste qui la modifierait lèverait.
  function figer(valeur) {
    if (valeur !== null && typeof valeur === 'object' && !Object.isFrozen(valeur)) {
      Object.freeze(valeur);
      for (const element of Object.values(valeur)) figer(element);
    }
    return valeur;
  }

  test('chaque geste qui touche une liste d’inclusions rend une charge neuve et laisse la reçue intacte', () => {
    for (const [nom, args] of [
      ['changerInclusionsOrganisation', { id: 1, organisations: [TILLEUL] }],
      ['changerInclusionsParticipant', { id: 1, participants: [2] }],
      ['modifierParticipant', { id: 5, champs: { organisation: 'Ferme des Saules' } }],
      ['modifierParticipant', { id: 6, champs: { organisation: TILLEUL } }],
      ['supprimerParticipant', { id: 5 }],
    ]) {
      const recue = chargeInclusions();
      const copie = structuredClone(recue);
      const rendu = appliquerCommande(nom, figer(recue), args);
      assert.deepEqual(recue, copie, nom);
      assert.notEqual(rendu.charge, recue, nom);
    }
  });
});
