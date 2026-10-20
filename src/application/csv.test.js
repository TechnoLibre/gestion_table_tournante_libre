// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Épreuves du relais CSV de l'application (§ 13.4, § 10.1) : l'interface
// atteint src/csv par ce module, qui réexporte ses fonctions telles quelles
// et lie le motif du CSV des refus au libellé français ; les textes des
// deux refus d'une ligne pour ses étiquettes ; le CSV des objectifs de table,
// son CSV des refus et les textes de ses refus (§ 10.4) ; le modèle des
// objectifs de l'événement, refusé sans table ; le modèle des participants,
// dont la présence suit les tours de l'événement ; les textes des refus de
// la présence, et celui d'un aperçu calculé pour un autre nombre de tours.
// Les noms sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../test/lanceur.js';
import * as apercu from '../csv/apercu.js';
import * as colonnes from '../csv/colonnes.js';
import * as encodage from '../csv/encodage.js';
import * as exportCsv from '../csv/export.js';
import * as importCsv from '../csv/import.js';
import { decouper } from '../csv/lecture.js';
import * as normalisation from '../csv/normalisation.js';
import * as objectifs from '../csv/objectifs.js';
import { creerCharge } from '../stockage/document.js';
import { appliquerCommande } from './commandes.js';
import * as relais from './csv.js';
import { libelle } from './libelles.js';

describe('csv : le relais de src/csv pour l’interface (§ 13.4)', () => {
  test('decoder, apercevoir, exporterParticipants, bilanRemplacement, cleNormalisee, CHAMPS, JOINTURE_ETIQUETTES et ceux des objectifs sont ceux de src/csv', () => {
    const attendus = [
      ['decoder', encodage.decoder],
      ['apercevoir', apercu.apercevoir],
      ['exporterParticipants', exportCsv.exporterParticipants],
      ['bilanRemplacement', importCsv.bilanRemplacement],
      ['cleNormalisee', normalisation.cleNormalisee],
      ['apercevoirObjectifs', objectifs.apercevoirObjectifs],
      ['exporterObjectifs', objectifs.exporterObjectifs],
      ['bilanRemplacementObjectifs', objectifs.bilanRemplacementObjectifs],
    ];
    assert.equal(attendus.length, 8);
    for (const [nom, fonction] of attendus) {
      assert.equal(typeof fonction, 'function', nom);
      assert.equal(relais[nom], fonction, nom);
    }
    assert.equal(relais.CHAMPS, colonnes.CHAMPS);
    assert.equal(relais.JOINTURE_ETIQUETTES, exportCsv.JOINTURE_ETIQUETTES);
    assert.equal(relais.JOINTURE_ETIQUETTES, ', ');
    assert.equal(relais.CHAMPS_OBJECTIFS, objectifs.CHAMPS_OBJECTIFS);
    assert.deepEqual(Object.keys(relais).sort(), [
      'CHAMPS', 'CHAMPS_OBJECTIFS', 'JOINTURE_ETIQUETTES', 'apercevoir', 'apercevoirObjectifs', 'bilanRemplacement',
      'bilanRemplacementObjectifs', 'cleNormalisee', 'decoder', 'exporterObjectifs', 'exporterParticipants', 'exporterRefus',
      'modeleObjectifs', 'modeleParticipants',
    ]);
  });

  test("exporterRefus écrit sous l'en-tête motif exactement libelle(code, details) d'une ligne refusée NOM_ABSENT", () => {
    const texte = ['nom;prenom', 'Ombrelle;Iris', ';Théo', 'Pervenche;Ondine', ''].join('\r\n');
    const lu = relais.apercevoir(texte);
    assert.equal(lu.refusees.length, 1);
    const [{ code, brut, ...details }] = lu.refusees;
    assert.equal(code, 'NOM_ABSENT');
    const { enregistrements } = decouper(relais.decoder(relais.exporterRefus(lu)).texte, ';');
    assert.equal(enregistrements.length, 2);
    const [entete, ligne] = enregistrements;
    const rang = entete.indexOf('motif');
    assert.ok(rang >= 0, entete.join(';'));
    assert.equal(ligne[rang], libelle('NOM_ABSENT', details));
    assert.equal(ligne[entete.indexOf('ligne')], '3');
    assert.ok(brut.length > 0);
  });

  test('exporterRefus écrit les refus reçus en second argument, à la place de ceux de l’aperçu', () => {
    const lu = relais.apercevoir(['nom;exclu', 'Ombrelle;peut-être', ''].join('\r\n'));
    assert.equal(lu.refusees.length, 1);
    const vide = decouper(relais.decoder(relais.exporterRefus(lu, [])).texte, ';').enregistrements;
    assert.deepEqual(vide, [['nom', 'exclu', 'ligne', 'motif']]);
    const [entete, ligne] = decouper(relais.decoder(relais.exporterRefus(lu, lu.refusees)).texte, ';').enregistrements;
    const [{ code, brut, ...details }] = lu.refusees;
    assert.equal(ligne[entete.indexOf('motif')], libelle(code, details));
    assert.ok(brut.length > 0);
  });
});

describe('csv : les textes des refus d’une ligne pour ses étiquettes (§ 10.1, A17)', () => {
  test('ETIQUETTE_MAL_FORMEE cite la valeur et dit la raison : 40 caractères au plus, ou un caractère de contrôle ou invisible', () => {
    const longue = libelle('ETIQUETTE_MAL_FORMEE', { ligne: 3, valeur: 'x'.repeat(41), raison: 'longueur' });
    const invisible = libelle('ETIQUETTE_MAL_FORMEE', { ligne: 3, valeur: 'fin\tance', raison: 'controle' });
    assert.match(longue, new RegExp(`« ${'x'.repeat(41)} »`));
    assert.match(longue, /40/);
    assert.match(invisible, /« fin\tance »/);
    assert.match(invisible, /contrôle/);
    assert.notEqual(longue.replace('x'.repeat(41), ''), invisible.replace('fin\tance', ''));
  });

  test('ETIQUETTES_TROP_NOMBREUSES dit le nombre lu et la borne de 20', () => {
    const texte = libelle('ETIQUETTES_TROP_NOMBREUSES', { ligne: 3, valeur: null, nombre: 23 });
    assert.match(texte, /23/);
    assert.match(texte, /20/);
  });

  test('une raison inconnue lève RangeError plutôt que d’écrire un motif faux', () => {
    assert.throws(() => libelle('ETIQUETTE_MAL_FORMEE', { ligne: 3, valeur: 'x', raison: 'autre' }), RangeError);
  });
});

// Un événement inventé de quatre tours, deux tables numérotées 1 et 2.
function evenementAuxTables() {
  const charge = creerCharge({ id: 'evt-herons', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 4 });
  charge.tables = [1, 2].map((id) => ({ id, numero: id, sieges: null, forme: 'ronde', position: { x: 200 * id, y: 0 } }));
  return charge;
}

describe('csv : le CSV des objectifs de table par le relais (§ 10.4)', () => {
  test("exporterRefus sert tel quel l'aperçu des objectifs : l'en-tête d'origine, ligne, et le motif composé par libelle", () => {
    const texte = ['Table;Tour;Objectif;Règle', '1;;finance;', '1;;bénévole;', '2;6;finance;', '2;;finance;peut-être', ''].join('\r\n');
    const lu = relais.apercevoirObjectifs(texte, evenementAuxTables());
    assert.deepEqual(lu.refusees.map(({ ligne, code }) => [ligne, code]), [
      [3, 'OBJECTIF_EN_DOUBLE'],
      [4, 'TOUR_HORS_SOIREE'],
      [5, 'REGLE_INCONNUE'],
    ]);
    const [entete, ...lignes] = decouper(relais.decoder(relais.exporterRefus(lu)).texte, ';').enregistrements;
    assert.deepEqual(entete, ['Table', 'Tour', 'Objectif', 'Règle', 'ligne', 'motif']);
    lu.refusees.forEach(({ code, brut, ...details }, rang) => {
      assert.equal(lignes[rang][5], libelle(code, details), code);
      assert.deepEqual(lignes[rang].slice(0, 4), brut);
    });
    assert.equal(lignes[0][5], "La ligne 2 donne déjà l'objectif de la table 1 pour la soirée : rien n'est fusionné.");
    assert.equal(lignes[1][5], "La soirée compte 4 tours : le tour 6 n'en est pas un.");
  });

  test('modeleObjectifs lit les tables et les tours de la charge, comme le modèle de src/csv', () => {
    const charge = creerCharge({ id: 'evt-modele', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 3 });
    charge.tables = [
      { id: 1, numero: 2, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 2, numero: 1, sieges: null, forme: 'ronde', position: { x: 200, y: 0 }, objectifs: [
        { portee: 'tour', tour: 2, regle: null, etiquettes: ['bénévole'] },
      ] },
    ];
    assert.deepEqual(relais.modeleObjectifs(charge), objectifs.modeleObjectifs(charge.tables, 3));
    assert.match(relais.decoder(relais.modeleObjectifs(charge)).texte, /^1;3;;\r$/m);
  });

  test('modeleObjectifs refuse un événement sans table, OBJECTIFS_SANS_TABLE, et son remède ouvre la section des tables', () => {
    const charge = creerCharge({ id: 'evt-modele', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 3 });
    assert.throws(
      () => relais.modeleObjectifs(charge),
      (erreur) => {
        assert.equal(erreur.name, 'ErreurCommande');
        assert.equal(erreur.code, 'OBJECTIFS_SANS_TABLE');
        assert.deepEqual(erreur.details, { remede: { geste: 'ouvrirSection', section: 'tables' } });
        assert.match(libelle(erreur.code, erreur.details), /créez les tables/);
        return true;
      },
    );
  });

  test('modeleObjectifs refuse un événement dont chaque numéro de table est partagé, OBJECTIFS_NUMEROS_PARTAGES, remède vers la section des tables ; un seul numéro propre suffit', () => {
    const charge = creerCharge({ id: 'evt-modele', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 3 });
    charge.tables = [
      { id: 1, numero: 4, sieges: null, forme: 'ronde', position: { x: 0, y: 0 } },
      { id: 2, numero: 4, sieges: null, forme: 'ronde', position: { x: 200, y: 0 } },
    ];
    assert.throws(
      () => relais.modeleObjectifs(charge),
      (erreur) => {
        assert.equal(erreur.name, 'ErreurCommande');
        assert.equal(erreur.code, 'OBJECTIFS_NUMEROS_PARTAGES');
        assert.deepEqual(erreur.details, { remede: { geste: 'ouvrirSection', section: 'tables' } });
        assert.match(libelle(erreur.code, erreur.details), /numéros distincts/);
        return true;
      },
    );
    charge.tables.push({ id: 3, numero: 6, sieges: null, forme: 'ronde', position: { x: 400, y: 0 } });
    assert.deepEqual(relais.modeleObjectifs(charge), objectifs.modeleObjectifs(charge.tables, 3));
  });

  test('exporterObjectifs écrit les objectifs des tables, que apercevoirObjectifs relit', () => {
    const charge = evenementAuxTables();
    charge.tables[1].objectifs = [{ portee: 'tour', tour: 3, regle: 'et', etiquettes: ['Montréal', 'finance'] }];
    const texte = relais.decoder(relais.exporterObjectifs(charge.tables)).texte;
    assert.equal(texte, 'table;tour;objectif;regle\r\n2;3;Montréal, finance;et\r\n');
    assert.deepEqual(relais.apercevoirObjectifs(texte, charge).lignes[0].champs, {
      numero: 2, table: 2, tour: 3, regle: 'et', etiquettes: ['Montréal', 'finance'],
    });
    assert.deepEqual(relais.bilanRemplacementObjectifs(charge), { objectifs: 1, tables: 1 });
  });
});

describe('csv : les textes des refus et des avis du CSV des objectifs (§ 10.4)', () => {
  test('chaque refus de ligne nomme sa valeur ; la règle inconnue redit la liste fermée', () => {
    assert.equal(libelle('TABLE_ABSENTE', { ligne: 2, valeur: null }), 'Le numéro de table manque.');
    assert.match(libelle('TABLE_NON_ENTIERE', { ligne: 2, valeur: '3b' }), /^« 3b » n'est pas un numéro de table/);
    assert.equal(libelle('NUMERO_TABLE_INCONNU', { ligne: 2, valeur: '9' }), 'Aucune table ne porte le numéro 9.');
    assert.match(libelle('PLUSIEURS_TABLES', { ligne: 2, valeur: '3' }), /Plusieurs tables portent le numéro 3/);
    assert.match(libelle('TOUR_NON_ENTIER', { ligne: 2, valeur: 'deux' }), /^« deux » n'est pas un numéro de tour : un entier, ou vide pour la soirée/);
    assert.equal(libelle('TOUR_HORS_SOIREE', { ligne: 2, valeur: '0', tours: 1 }), "La soirée compte 1 tour : le tour 0 n'en est pas un.");
    assert.equal(libelle('OBJECTIF_VIDE', { ligne: 2, valeur: null }), "L'objectif manque : au moins une étiquette.");
    const regle = libelle('REGLE_INCONNUE', { ligne: 2, valeur: 'peut-être' });
    assert.match(regle, /« peut-être »/);
    for (const valeur of ['ou', 'une', 'au moins une', 'et', 'toutes', 'vide']) assert.ok(regle.includes(valeur), valeur);
    assert.equal(
      libelle('OBJECTIF_EN_DOUBLE', { ligne: 8, valeur: null, premiereLigne: 3, numero: 1, tour: 2 }),
      "La ligne 3 donne déjà l'objectif de la table 1 au tour 2 : rien n'est fusionné.",
    );
    assert.match(libelle('ETIQUETTES_TROP_NOMBREUSES', { ligne: 2, valeur: null, nombre: 21 }), /objectif/);
  });

  test('les refus globaux nomment la colonne qui manque, et le remède d’un événement sans table', () => {
    assert.match(libelle('TABLE_NON_ASSOCIEE', {}), /« table »/);
    assert.match(libelle('OBJECTIF_NON_ASSOCIE', {}), /« objectif »/);
    assert.match(libelle('OBJECTIFS_SANS_TABLE', { ligne: null, remede: { geste: 'ouvrirSection', section: 'tables' } }), /créez les tables/);
    assert.doesNotMatch(libelle('AUCUN_ENTETE', {}), /« nom »/);
    assert.match(libelle('IMPORT_OBJECTIFS_RECLASSE', {}), /classement/);
  });

  test("le libellé d'historique de l'import nomme le mode et ses comptes ; un mode inconnu lève RangeError", () => {
    assert.equal(
      libelle('ENTREE_IMPORTER_OBJECTIFS', { mode: 'mettreAJour', ajoutes: 3, remplaces: 1, retires: 0 }),
      'Mis à jour les objectifs de table par import : 3 ajoutés, 1 remplacé',
    );
    assert.equal(
      libelle('ENTREE_IMPORTER_OBJECTIFS', { mode: 'remplacer', ajoutes: 1, remplaces: 0, retires: 4 }),
      'Remplacé les objectifs de table par import : 4 retirés, 1 ajouté, 0 remplacé',
    );
    assert.throws(() => libelle('ENTREE_IMPORTER_OBJECTIFS', { mode: 'ajouter', ajoutes: 1, remplaces: 0, retires: 0 }), RangeError);
  });
});

describe('csv : le modèle des participants, sur l’événement (§ 10.1)', () => {
  test('modeleParticipants lit le nombre de tours de la charge, comme le modèle de src/csv, sous chaque nombre de tours de 1 à 6', () => {
    for (let tours = 1; tours <= 6; tours += 1) {
      const charge = creerCharge({ id: 'evt-modele', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours });
      assert.deepEqual(relais.modeleParticipants(charge), exportCsv.modeleParticipants({ tours }), `${tours} tours`);
      const lu = relais.apercevoir(relais.decoder(relais.modeleParticipants(charge)).texte, { tours });
      assert.deepEqual([lu.refusGlobal, lu.refusees], [null, []], `${tours} tours`);
    }
    const quatre = creerCharge({ id: 'evt-modele', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 4 });
    assert.match(relais.decoder(relais.modeleParticipants(quatre)).texte, /^Tourteau;Basile;;;;non;;bénévole;1-3\r$/m);
    assert.match(relais.decoder(relais.modeleParticipants(quatre)).texte, /;2, 3\r$/m);
  });
});

describe('csv : les textes des refus de la présence (§ 10.1)', () => {
  test('PRESENCE_ILLISIBLE cite la valeur ; la date dit de mettre la colonne en texte ; trois raisons, trois textes', () => {
    const syntaxe = libelle('PRESENCE_ILLISIBLE', { ligne: 3, valeur: 'deux', raison: 'syntaxe' });
    const intervalle = libelle('PRESENCE_ILLISIBLE', { ligne: 3, valeur: '3-1', raison: 'intervalle' });
    const date = libelle('PRESENCE_ILLISIBLE', { ligne: 3, valeur: '01-mars', raison: 'date' });
    assert.match(syntaxe, /« deux »/);
    assert.match(intervalle, /« 3-1 »/);
    assert.match(date, /« 01-mars »/);
    assert.match(date, /texte/);
    assert.equal(new Set([syntaxe, intervalle, date].map((texte) => texte.replace(/« [^»]* »/u, ''))).size, 3);
  });

  test('PRESENCE_HORS_TOURS cite la valeur, nomme le tour fautif et le nombre de tours de la soirée', () => {
    const texte = libelle('PRESENCE_HORS_TOURS', { ligne: 4, valeur: '2, 5-6', tour: 5, tours: 4 });
    assert.match(texte, /« 2, 5-6 »/);
    assert.match(texte, /tour 5/);
    assert.match(texte, /4 tours/);
    assert.match(libelle('PRESENCE_HORS_TOURS', { ligne: 4, valeur: '0-2', tour: 0, tours: 1 }), /1 tour\b/);
  });

  test('une raison inconnue lève RangeError plutôt que d’écrire un motif faux', () => {
    assert.throws(() => libelle('PRESENCE_ILLISIBLE', { ligne: 3, valeur: 'x', raison: 'horsTours' }), RangeError);
  });

  test('exporterRefus écrit sous motif le texte de chaque refus de la présence', () => {
    const texte = ['nom;presence', 'Ombrelle;tours 1 et 2', 'Pervenche;0-2', 'Lacasse;1/3', ''].join('\r\n');
    const lu = relais.apercevoir(texte, { tours: 3 });
    assert.deepEqual(lu.refusees.map(({ code }) => code), ['PRESENCE_HORS_TOURS', 'PRESENCE_ILLISIBLE']);
    const [entete, ...lignes] = decouper(relais.decoder(relais.exporterRefus(lu)).texte, ';').enregistrements;
    lu.refusees.forEach(({ code, brut, ...details }, rang) => {
      assert.equal(lignes[rang][entete.indexOf('motif')], libelle(code, details), code);
    });
  });

  test("importerParticipants refuse un aperçu calculé pour un autre nombre de tours : APERCU_TOURS_CHANGES, remède null, le texte dit de relire le fichier", () => {
    const charge = creerCharge({ id: 'evt-tours', nom: 'Soirée des Hérons', siegesParDefaut: 4, tours: 3 });
    const apercuDeQuatre = relais.apercevoir(['nom;presence', 'Ombrelle;4', ''].join('\r\n'), { tours: 4 });
    assert.throws(
      () => appliquerCommande('importerParticipants', charge, { apercu: apercuDeQuatre, mode: 'ajouter' }),
      (erreur) => {
        assert.equal(erreur.name, 'ErreurCommande');
        assert.equal(erreur.code, 'APERCU_TOURS_CHANGES');
        assert.deepEqual(erreur.details, { tours: 3, toursApercu: 4, remede: null });
        assert.equal(
          libelle(erreur.code, erreur.details),
          "Le nombre de tours a changé depuis l'aperçu (4 → 3) : relire le fichier pour refaire l'aperçu.",
        );
        return true;
      },
    );
    const apercuDeTrois = relais.apercevoir(['nom;presence', 'Ombrelle;3', ''].join('\r\n'), { tours: 3 });
    const { charge: apres } = appliquerCommande('importerParticipants', charge, { apercu: apercuDeTrois, mode: 'ajouter' });
    assert.deepEqual(apres.participants.map(({ nom, presence }) => [nom, presence]), [['Ombrelle', [3]]]);
  });
});
