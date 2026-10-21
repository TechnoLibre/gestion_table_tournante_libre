// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves des conflits d'organisation côté application (§ 4, § 8.2,
// § 8.9) : ajouter et retirer un conflit, une entrée d'historique chacun, et
// les listes qui suivent un renommage ou la disparition d'une organisation
// dans l'entrée du geste qui la provoque. Chaque charge rendue se relit par
// l'analyse du fichier : une liste qui nommerait une organisation disparue,
// ou la sienne, y serait refusée. Les noms sont inventés.
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
    assert.deepEqual(suivi, { renommee: null, retirees: [SAULE], propres: 0 });
    assert.equal(rienASuivre(suivi), false);
    assert.equal(suivante.participants[1], intacte);
    assert.equal(rienASuivre(suivreOrganisations(avant, structuredClone(avant))), true);
  });
});
