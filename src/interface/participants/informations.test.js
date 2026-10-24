// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle des informations de la fiche (§ 4, § 10.2) : la saisie
// préremplie, le brouillon qui diffère de l'enregistré, la commande unique
// des seuls champs changés, l'orthographe d'organisation retenue, le champ
// qui porte un refus, et ce que les listes de conflits ont suivi. Les
// commandes s'éprouvent sur une vraie charge. Les noms d'épreuve sont
// inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { cleNormalisee } from '../../application/csv.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { creerCharge } from '../../stockage/document.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  CHAMPS_INFORMATIONS,
  champDuRefus,
  commandeDesInformations,
  informationsModifiees,
  saisieDesInformations,
  suggestionsOrganisation,
  suiviDesConflits,
} from './informations.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);

// Une personne entière, chaque champ de texte rempli sauf les notes.
const IRIS = Object.freeze({
  id: 4,
  nom: 'Ombrelle',
  prenom: 'Iris',
  organisation: 'Atelier Ressac',
  courriel: 'iris@exemple.invalid',
  titrePressenti: null,
  notes: null,
  exclu: false,
});

// Trois personnes : Iris et Théo à l'Atelier Ressac, Ondine au Club des
// Merles, dont la liste nomme l'Atelier Ressac.
function chargeEssai() {
  let charge = creerCharge({ id: 'evt-informations', nom: 'Soirée des Grèbes', siegesParDefaut: 4, tours: 2 });
  for (const champs of [
    { nom: 'Ombrelle', prenom: 'Iris', organisation: 'Atelier Ressac' },
    { nom: 'Pervenche', prenom: 'Théo', organisation: 'Atelier Ressac' },
    { nom: 'Lacasse', prenom: 'Ondine', organisation: 'Club des Merles' },
  ]) {
    charge = appliquerCommande('ajouterParticipant', charge, { champs }).charge;
  }
  return appliquerCommande('changerConflits', charge, { id: 3, organisations: ['Atelier Ressac'] }).charge;
}

describe('saisieDesInformations, informationsModifiees : la saisie préremplie et le brouillon', () => {
  test('les six champs de texte, dans l’ordre des colonnes, null rendu en chaîne vide', () => {
    assert.deepEqual(CHAMPS_INFORMATIONS, ['nom', 'prenom', 'organisation', 'courriel', 'titrePressenti', 'notes']);
    assert.deepEqual(saisieDesInformations(IRIS), {
      nom: 'Ombrelle',
      prenom: 'Iris',
      organisation: 'Atelier Ressac',
      courriel: 'iris@exemple.invalid',
      titrePressenti: '',
      notes: '',
    });
  });

  test('un brouillon se lit comme la commande l’enregistre : blancs de bord et chaîne vide ne le rendent pas modifié', () => {
    const saisie = saisieDesInformations(IRIS);
    assert.equal(informationsModifiees(IRIS, saisie), false);
    assert.equal(informationsModifiees(IRIS, { ...saisie, nom: '  Ombrelle ', notes: '   ' }), false);
    assert.equal(informationsModifiees(IRIS, { ...saisie, notes: 'végétarienne' }), true);
    assert.equal(informationsModifiees(IRIS, { ...saisie, courriel: '' }), true);
  });

  test('comparé à la saisie de l’ouverture, le brouillon ne suit pas une écriture venue d’ailleurs', () => {
    const initiale = saisieDesInformations(IRIS);
    assert.equal(informationsModifiees(initiale, initiale), false);
    assert.equal(informationsModifiees(initiale, { ...initiale, titrePressenti: '  ' }), false);
    assert.equal(informationsModifiees(initiale, { ...initiale, notes: 'arrive tard' }), true);
  });

  test('la forme décomposée d’un accent se lit en NFC : le brouillon n’est pas modifié', () => {
    const personne = { ...IRIS, prenom: 'Théo' };
    assert.equal(informationsModifiees(personne, { ...saisieDesInformations(personne), prenom: 'The\u{301}o' }), false);
  });
});

describe('commandeDesInformations : une seule commande, les seuls champs changés', () => {
  const autres = [IRIS, { ...IRIS, id: 5, nom: 'Pervenche', organisation: 'Finance' }];

  test('rien de changé : aucune commande', () => {
    assert.deepEqual(commandeDesInformations(IRIS, saisieDesInformations(IRIS), autres, cleNormalisee), { action: 'aucune' });
  });

  test('le nom et l’organisation changés : modifierParticipant de ces deux champs, lus comme la commande les lit', () => {
    const saisie = { ...saisieDesInformations(IRIS), nom: ' Ombrelle-Varech ', organisation: 'Club des Merles' };
    assert.deepEqual(commandeDesInformations(IRIS, saisie, autres, cleNormalisee), {
      action: 'executer',
      nom: 'modifierParticipant',
      args: { id: 4, champs: { nom: 'Ombrelle-Varech', organisation: 'Club des Merles' } },
      orthographe: null,
    });
  });

  test('un champ vidé part à null ; le nom vidé part aussi, et la commande le refuse', () => {
    const saisie = { ...saisieDesInformations(IRIS), nom: '  ', courriel: '' };
    const rendu = commandeDesInformations(IRIS, saisie, autres, cleNormalisee);
    assert.deepEqual(rendu.args.champs, { nom: null, courriel: null });
    const charge = chargeEssai();
    assert.throws(
      () => appliquerCommande(rendu.nom, charge, { id: 1, champs: rendu.args.champs }),
      (erreur) => erreur.code === 'NOM_REQUIS',
    );
  });

  test('une organisation de casse voisine d’une autre personne prend son orthographe, et le dit', () => {
    const saisie = { ...saisieDesInformations(IRIS), organisation: ' FINANCE ' };
    assert.deepEqual(commandeDesInformations(IRIS, saisie, autres, cleNormalisee), {
      action: 'executer',
      nom: 'modifierParticipant',
      args: { id: 4, champs: { organisation: 'Finance' } },
      orthographe: { saisie: 'FINANCE', retenue: 'Finance' },
    });
  });

  test('seule à porter son organisation, la personne en change la casse : sa propre orthographe ne la retient pas', () => {
    const saisie = { ...saisieDesInformations(IRIS), organisation: 'ATELIER RESSAC' };
    const rendu = commandeDesInformations(IRIS, saisie, autres, cleNormalisee);
    assert.deepEqual(rendu.args.champs, { organisation: 'ATELIER RESSAC' });
    assert.equal(rendu.orthographe, null);
  });

  test('une orthographe retenue égale à l’enregistrée : rien ne change, aucune commande', () => {
    const finance = { ...IRIS, organisation: 'Finance' };
    const saisie = { ...saisieDesInformations(finance), organisation: 'FINANCE' };
    assert.deepEqual(commandeDesInformations(finance, saisie, autres, cleNormalisee), { action: 'aucune' });
  });

  test('deux graphies voisines déjà portées : l’organisation que la saisie ne touche pas ne prend pas celle de l’autre', () => {
    const finance = { ...IRIS, organisation: 'Finance' };
    const voisine = { ...IRIS, id: 5, nom: 'Pervenche', organisation: 'FINANCE' };
    const personnes = [finance, voisine];
    assert.deepEqual(commandeDesInformations(finance, saisieDesInformations(finance), personnes, cleNormalisee), { action: 'aucune' });
    const notes = { ...saisieDesInformations(finance), notes: 'arrive tard' };
    assert.deepEqual(commandeDesInformations(finance, notes, personnes, cleNormalisee), {
      action: 'executer',
      nom: 'modifierParticipant',
      args: { id: 4, champs: { notes: 'arrive tard' } },
      orthographe: null,
    });
  });

  test('une écriture venue pendant la saisie : seuls les champs que la saisie change depuis l’ouverture partent, comparés à la personne courante', () => {
    const initiale = saisieDesInformations(IRIS);
    const courante = { ...IRIS, prenom: 'Zoé', notes: 'végétarienne' };
    // Le prénom, que la saisie ne touche pas, garde l'écriture venue
    // d'ailleurs ; les notes, que la saisie rend égales à la courante, ne
    // partent pas.
    const saisie = { ...initiale, courriel: 'iris@exemple.org', notes: 'végétarienne' };
    assert.deepEqual(commandeDesInformations(courante, saisie, [courante], cleNormalisee, initiale).args.champs, { courriel: 'iris@exemple.org' });
    assert.deepEqual(commandeDesInformations(courante, initiale, [courante], cleNormalisee, initiale), { action: 'aucune' });
    // Le prénom changé dans la saisie l'emporte sur l'écriture venue
    // d'ailleurs.
    assert.deepEqual(commandeDesInformations(courante, { ...initiale, prenom: 'Iris-Anne' }, [courante], cleNormalisee, initiale).args.champs, {
      prenom: 'Iris-Anne',
    });
  });

  test('sur une charge, la commande rendue écrit une entrée qui nomme chaque champ changé', () => {
    const charge = chargeEssai();
    const ondine = charge.participants[2];
    const saisie = { ...saisieDesInformations(ondine), prenom: 'Ondine-Rose', notes: 'arrive tard' };
    const { nom, args } = commandeDesInformations(ondine, saisie, charge.participants, cleNormalisee);
    assert.equal(appliquerCommande(nom, charge, args).libelle, 'Modifié Ondine Lacasse : prénom, notes (désormais Ondine-Rose Lacasse)');
  });
});

describe('champDuRefus : le champ qui porte un refus du formulaire', () => {
  test('NOM_REQUIS se pose contre le nom ; tout autre refus contre « Enregistrer »', () => {
    assert.equal(champDuRefus('NOM_REQUIS'), 'nom');
    for (const code of ['MODE_LECTURE', 'PLAN_BLOQUE', 'SANS_EFFET', 'PARTICIPANT_INCONNU']) assert.equal(champDuRefus(code), null);
  });
});

describe('suggestionsOrganisation : les organisations proposées au champ', () => {
  test('chacune une fois, rangées par clé normalisée, puis par écriture', () => {
    const organisations = new Set(['Zénith', 'atelier Ressac', 'Atelier Ressac', 'Écluse']);
    assert.deepEqual(suggestionsOrganisation(organisations, cleNormalisee), ['Atelier Ressac', 'atelier Ressac', 'Écluse', 'Zénith']);
    assert.deepEqual(suggestionsOrganisation(new Set(), cleNormalisee), []);
  });
});

describe('suiviDesConflits : ce que les listes ont suivi, lu entre deux charges', () => {
  // La charge d'après modifierParticipant de la personne id, et ce que la
  // fiche en lit.
  function suivre(avant, id, champs) {
    const apres = appliquerCommande('modifierParticipant', avant, { id, champs }).charge;
    return { apres, suivi: suiviDesConflits(avant, apres, id) };
  }

  test('aucune liste changée : null', () => {
    assert.equal(suivre(chargeEssai(), 1, { notes: 'à l’accueil' }).suivi, null);
  });

  test('la dernière personne d’une organisation en change : la référence suit le renommage', () => {
    const avant = appliquerCommande('modifierParticipant', chargeEssai(), { id: 2, champs: { organisation: 'Finance' } }).charge;
    const { apres, suivi } = suivre(avant, 1, { organisation: 'Atelier Embrun' });
    assert.deepEqual(apres.participants[2].conflits, ['Atelier Embrun']);
    assert.deepEqual(suivi, { renommee: { de: 'Atelier Ressac', vers: 'Atelier Embrun' }, retirees: [], propres: 0 });
    assert.equal(
      t('participants.informations.conflitsSuivis', suivi),
      "Les conflits d'organisation suivent ce changement : « Atelier Ressac » devient « Atelier Embrun ».",
    );
  });

  test('vers une organisation que l’événement porte déjà, la référence suit aussi', () => {
    const avant = appliquerCommande('modifierParticipant', chargeEssai(), { id: 2, champs: { organisation: 'Finance' } }).charge;
    const { apres, suivi } = suivre(avant, 1, { organisation: 'Finance' });
    assert.deepEqual(apres.participants[2].conflits, ['Finance']);
    assert.deepEqual(suivi, { renommee: { de: 'Atelier Ressac', vers: 'Finance' }, retirees: [], propres: 0 });
  });

  test('vers l’organisation d’une personne qui la nommait : la référence suit, puis quitte sa liste', () => {
    // Théo quitte l'Atelier Ressac, qu'Iris porte encore : rien ne suit.
    const { apres, suivi } = suivre(chargeEssai(), 2, { organisation: 'Club des Merles' });
    assert.deepEqual(apres.participants[2].conflits, ['Atelier Ressac']);
    const avant = appliquerCommande('modifierParticipant', chargeEssai(), { id: 2, champs: { organisation: 'Finance' } }).charge;
    const rendu = suivre(avant, 1, { organisation: 'Club des Merles' });
    assert.equal(rendu.apres.participants[2].conflits, undefined);
    assert.deepEqual(rendu.suivi, { renommee: { de: 'Atelier Ressac', vers: 'Club des Merles' }, retirees: [], propres: 1 });
    assert.equal(suivi, null);
    assert.equal(
      t('participants.informations.conflitsSuivis', rendu.suivi),
      "Les conflits d'organisation suivent ce changement : « Atelier Ressac » devient « Club des Merles » ; " +
        '1 conflit avec sa propre organisation retiré.',
    );
  });

  test('une organisation qui disparaît quitte les listes ; une personne qui prend celle qu’elle nommait la retire de la sienne', () => {
    const avant = appliquerCommande('modifierParticipant', chargeEssai(), { id: 2, champs: { organisation: null } }).charge;
    const retiree = suivre(avant, 1, { organisation: null }).suivi;
    assert.deepEqual(retiree, { renommee: null, retirees: ['Atelier Ressac'], propres: 0 });
    assert.equal(
      t('participants.informations.conflitsSuivis', retiree),
      "Les conflits d'organisation suivent ce changement : « Atelier Ressac » les quitte.",
    );
    const rejointe = suivre(chargeEssai(), 3, { organisation: 'Atelier Ressac' }).suivi;
    assert.deepEqual(rejointe, { renommee: null, retirees: [], propres: 1 });
    assert.equal(
      t('participants.informations.conflitsSuivis', rejointe),
      "Les conflits d'organisation suivent ce changement : 1 conflit avec sa propre organisation retiré.",
    );
  });

  test('deux organisations retirées : nommées ensemble, rangées ; la charge reçue ne change pas', () => {
    const avant = {
      participants: [
        { id: 1, organisation: 'Zénith', conflits: ['Bêta', 'Alpha'] },
        { id: 2, organisation: 'Bêta' },
        { id: 3, organisation: 'Alpha' },
      ],
    };
    const apres = { participants: [{ id: 1, organisation: 'Zénith' }, { id: 2, organisation: null }, { id: 3, organisation: null }] };
    const copie = structuredClone(apres);
    const suivi = suiviDesConflits(avant, apres, 2);
    assert.deepEqual(suivi, { renommee: null, retirees: ['Alpha', 'Bêta'], propres: 0 });
    assert.deepEqual(apres, copie);
    assert.equal(
      t('participants.informations.conflitsSuivis', suivi),
      "Les conflits d'organisation suivent ce changement : « Alpha » et « Bêta » les quittent.",
    );
  });
});
