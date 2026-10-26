// © 2026 TechnoLibre (http://www.technolibre.ca)
// SPDX-License-Identifier: AGPL-3.0-or-later OR LiLiQ-Rplus-1.1

// Le modèle de l'accueil (§ 8.1, § 8.6, § 8.8) : les six informations d'une
// ligne de la liste, mises en forme, et ses signalements ; les réponses
// d'une question du dossier de travail ; les secours d'un état illisible ;
// le refus d'un geste de la liste, sans remède ; l'annonce du dossier de
// travail, une fois par séance ; les tuiles par état du plan, le résumé de
// la liste, ses groupes et la vue que la séance retient. Chaque clé que le modèle rend existe dans la
// traduction. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { NOM_EVENEMENT_MAX, appliquerCommande, refusNomEvenement } from '../../application/commandes.js';
import { resumeDuMeilleur } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { meilleureProposition } from '../generation/meilleure.js';
import { TABLES_INTERFACE } from '../libelles.js';
import {
  ANNEE_MINIMALE,
  COLONNES_DU_RETENU,
  ETATS,
  FILTRES,
  GROUPEMENTS,
  MEILLEURE,
  SAISIES,
  champDuRefus,
  choixDeGroupement,
  cleDEtat,
  groupesDeLaListe,
  ligneAffichee,
  premiereAnnonce,
  refusDeLaDate,
  resumeDeLaListe,
  retenirVue,
  tuilesDeLaListe,
  vueDeLaListe,
  refusDeLaListe,
  reponsesDe,
  saisieDe,
  secoursOfferts,
  signalementsDe,
  surLaListe,
} from './modele.js';

const { t } = creerTraduction([...TABLES_APPLICATION, ...TABLES_INTERFACE]);
const format = creerFormat(t);
const VIDE = t('format.vide');

const RACINE = 'C:\\Epreuve\\Tablees';

// Les résumés d'une ligne que rend facade.resumer, sans retenu mesurable ni
// proposition classée.
const AUCUN = Object.freeze({ mesuresDuRetenu: null, meilleureDuClassement: null });

// Une ligne de la liste telle que la façade la rend (LigneListe, evenements.js), lisible.
function ligne(champs = {}) {
  return {
    base: 'Bal des Grisailles',
    id: 'evt-grisailles',
    nom: 'Bal des Grisailles',
    date: '2031-05-17',
    etat: 'propose',
    participants: 1234,
    derniereModification: '2031-05-17T08:05:00-04:00',
    chemin: `${RACINE}\\Bal des Grisailles.gtt.json`,
    illisible: null,
    journalSeul: false,
    doublonAvec: [],
    verrou: null,
    ...champs,
  };
}

describe('ligneAffichee : les six informations (§ 8.1)', () => {
  test('une ligne lisible : nom, date, état, participants, dernière modification et chemin, mis en forme', () => {
    const affichee = ligneAffichee(ligne(), format);
    assert.deepEqual(Object.keys(affichee).sort(), [
      'aVerifier',
      'chemin',
      'collisionsCumulees',
      'date',
      'enAttente',
      'etat',
      'meilleure',
      'modification',
      'nom',
      'participants',
      'rencontresRepetees',
      'signalements',
    ]);
    assert.equal(affichee.nom, 'Bal des Grisailles');
    assert.equal(affichee.date, format.date('2031-05-17'));
    assert.equal(affichee.etat, 'accueil.etat.propose');
    assert.equal(affichee.participants, format.nombre(1234));
    assert.equal(affichee.modification, format.horodatage('2031-05-17T08:05:00-04:00'));
    assert.equal(affichee.chemin, `${RACINE}\\Bal des Grisailles.gtt.json`);
    assert.deepEqual(affichee.signalements, []);
  });

  test('sans journal, la dernière modification est la valeur absente ; sans date, de même — jamais une date du système', () => {
    const affichee = ligneAffichee(ligne({ derniereModification: null, date: null }), format);
    assert.equal(affichee.modification, VIDE);
    assert.equal(affichee.date, VIDE);
  });

  test('une ligne illisible : son nom est sa base, ses informations absentes, son état la valeur absente', () => {
    const affichee = ligneAffichee(
      ligne({
        nom: null,
        date: null,
        etat: null,
        participants: null,
        derniereModification: null,
        illisible: { base: 'Bal des Grisailles', raison: 'VIDE', chemin: null, secours: { precedent: null, journal: null } },
      }),
      format,
    );
    assert.equal(affichee.nom, 'Bal des Grisailles');
    assert.equal(affichee.date, VIDE);
    assert.equal(affichee.etat, 'format.vide');
    assert.equal(affichee.participants, VIDE);
    assert.equal(affichee.modification, VIDE);
  });

  test('chaque état du plan a sa clé, qui existe ; un état inconnu lève', () => {
    assert.deepEqual([...ETATS], ['brouillon', 'propose', 'retenu', 'bloque']);
    for (const etat of ETATS) {
      const cle = cleDEtat(etat);
      assert.equal(cle, `accueil.etat.${etat}`);
      assert.equal(typeof t(cle), 'string');
    }
    assert.equal(cleDEtat(null), 'format.vide');
    assert.throws(() => cleDEtat('archive'), RangeError);
  });

  test('ligneAffichee ne lit pas la ligne au-delà de ses champs : deux appels rendent la même chose', () => {
    assert.deepEqual(ligneAffichee(ligne(), format), ligneAffichee(ligne(), format));
  });
});

describe('signalementsDe (§ 8.1, § 8.8)', () => {
  test('un état vide : ETAT_ILLISIBLE, sa base et sa raison', () => {
    const illisible = { base: 'Soirée vide', raison: 'VIDE', chemin: null, secours: { precedent: null, journal: null } };
    const signalements = signalementsDe(ligne({ base: 'Soirée vide', nom: null, illisible }));
    assert.deepEqual(signalements, [{ cle: 'ETAT_ILLISIBLE', details: illisible, noms: [] }]);
    assert.match(t(signalements[0].cle, signalements[0].details), /vide/);
  });

  test('un journal sans état : ETAT_ILLISIBLE de raison ABSENT, qui nomme le secours du journal', () => {
    const illisible = { base: 'Soirée des Hiboux', raison: 'ABSENT', chemin: null, secours: { precedent: null, journal: 1 } };
    const [signalement, ...reste] = signalementsDe(ligne({ base: 'Soirée des Hiboux', journalSeul: true, illisible }));
    assert.deepEqual(reste, []);
    assert.equal(signalement.cle, 'ETAT_ILLISIBLE');
    assert.equal(signalement.details.raison, 'ABSENT');
    assert.match(t(signalement.cle, signalement.details), /historique/);
  });

  test('un doublon nomme chaque autre base à part, hors de son texte, et sa clé existe', () => {
    const signalements = signalementsDe(ligne({ base: 'Merles A', doublonAvec: ['Merles B'] }));
    assert.deepEqual(signalements, [{ cle: 'accueil.signalement.doublon', details: { autres: 1 }, noms: ['Merles B'] }]);
    // Une base est une donnée : elle occupe son propre nœud, jamais le texte.
    assert.ok(!t(signalements[0].cle, signalements[0].details).includes('Merles'));
    const deux = signalementsDe(ligne({ doublonAvec: ['Merles B', 'Merles C'] }));
    assert.deepEqual(deux[0], { cle: 'accueil.signalement.doublon', details: { autres: 2 }, noms: ['Merles B', 'Merles C'] });
    assert.ok(!t(deux[0].cle, deux[0].details).includes('Merles'));
  });

  test('une ligne lisible sans doublon ne porte rien ; un verrou présent ne se signale pas', () => {
    assert.deepEqual(signalementsDe(ligne()), []);
    assert.deepEqual(signalementsDe(ligne({ verrou: { seance: 'seance-autre', depuis: null } })), []);
  });

  test('les détails rendus sont des copies : la ligne reçue ne change pas', () => {
    const recue = ligne({ doublonAvec: ['Merles B'] });
    const [signalement] = signalementsDe(recue);
    signalement.noms.push('Merles Z');
    assert.deepEqual(recue.doublonAvec, ['Merles B']);
    // Les secours d'un état illisible sont copiés eux aussi.
    const illisible = { base: 'Soirée vide', raison: 'VIDE', chemin: null, secours: { precedent: 2, journal: null } };
    const lue = ligne({ base: 'Soirée vide', nom: null, illisible });
    const [etat] = signalementsDe(lue);
    assert.notEqual(etat.details.secours, illisible.secours);
    etat.details.secours.journal = 7;
    assert.deepEqual(lue.illisible.secours, { precedent: 2, journal: null });
  });
});

describe('reponsesDe : les réponses d’une question du dossier de travail (§ 8.6)', () => {
  test('PORTABLE_NON_INSCRIPTIBLE : réessayer, puis travailler dans les Documents', () => {
    const reponses = reponsesDe({ code: 'PORTABLE_NON_INSCRIPTIBLE' });
    assert.deepEqual(reponses, [
      { choix: 'reessayer', cle: 'accueil.question.reessayer' },
      { choix: 'documents', cle: 'accueil.question.documents' },
    ]);
  });

  test('DOCUMENTS_NON_INSCRIPTIBLE : réessayer, puis continuer', () => {
    const reponses = reponsesDe({ code: 'DOCUMENTS_NON_INSCRIPTIBLE' });
    assert.deepEqual(reponses, [
      { choix: 'reessayer', cle: 'accueil.question.reessayer' },
      { choix: 'continuer', cle: 'accueil.question.continuer' },
    ]);
  });

  test('chaque clé de réponse existe ; une question inconnue lève', () => {
    let comptees = 0;
    for (const code of ['PORTABLE_NON_INSCRIPTIBLE', 'DOCUMENTS_NON_INSCRIPTIBLE']) {
      for (const { cle } of reponsesDe({ code })) {
        comptees += 1;
        assert.equal(typeof t(cle), 'string');
      }
    }
    assert.equal(comptees, 4);
    assert.throws(() => reponsesDe({ code: 'AUTRE' }), RangeError);
  });
});

describe('secoursOfferts : les secours d’un état illisible (§ 8.8)', () => {
  test('la version précédente, puis le dernier instant du journal, dans cet ordre', () => {
    assert.deepEqual(secoursOfferts({ precedent: 4, journal: 6 }), [
      { source: 'precedent', cle: 'communs.commande.ouvrirPrecedent' },
      { source: 'journal', cle: 'communs.commande.ouvrirJournal' },
    ]);
  });

  test('seuls les secours lisibles ; aucun, ou des secours inconnus, ne rendent rien', () => {
    assert.deepEqual(secoursOfferts({ precedent: null, journal: 1 }), [
      { source: 'journal', cle: 'communs.commande.ouvrirJournal' },
    ]);
    assert.deepEqual(secoursOfferts({ precedent: 2, journal: null }), [
      { source: 'precedent', cle: 'communs.commande.ouvrirPrecedent' },
    ]);
    assert.deepEqual(secoursOfferts({ precedent: null, journal: null }), []);
    assert.deepEqual(secoursOfferts(null), []);
    assert.deepEqual(secoursOfferts(undefined), []);
  });
});

describe('refusDeLaListe : le refus d’un geste de la liste', () => {
  test('code et détails gardés, le remède retiré : aucun événement n’est ouvert pour l’exécuter', () => {
    const erreur = { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: { geste: 'debloquer' } } };
    const refus = refusDeLaListe(erreur);
    assert.deepEqual(refus, { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: null } });
    assert.deepEqual(erreur.details.remede, { geste: 'debloquer' });
    assert.equal(t(refus.code, refus.details), t(erreur.code, erreur.details));
  });

  test('un refus sans détails en reçoit de vides ; une erreur sans code n’est pas un refus', () => {
    assert.deepEqual(refusDeLaListe({ code: 'NOM_REQUIS' }), { code: 'NOM_REQUIS', details: { remede: null } });
    assert.equal(refusDeLaListe(new TypeError('faute')), null);
    assert.equal(refusDeLaListe(null), null);
  });
});

describe('premiereAnnonce : le dossier de travail s’annonce une fois par séance (§ 8.6)', () => {
  test('vrai la première fois pour une séance, faux ensuite ; une autre séance a sa première fois', () => {
    const seance = {};
    const autre = {};
    assert.equal(premiereAnnonce(seance), true);
    assert.equal(premiereAnnonce(seance), false);
    assert.equal(premiereAnnonce(seance), false);
    assert.equal(premiereAnnonce(autre), true);
    assert.equal(premiereAnnonce(autre), false);
  });

  test('une séance absente lève', () => {
    assert.throws(() => premiereAnnonce(null), TypeError);
  });
});

describe('surLaListe : une opération de la liste et son refus', () => {
  test('rend ce que rend l’opération', async () => {
    assert.deepEqual(await surLaListe(async () => ({ base: 'Bal des Grisailles' })), { base: 'Bal des Grisailles' });
    assert.equal(await surLaListe(() => null), null);
  });

  test('un refus remonte sans remède ; toute autre erreur remonte telle quelle', async () => {
    const refus = { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: { geste: 'debloquer' } } };
    await assert.rejects(
      surLaListe(async () => {
        throw refus;
      }),
      (recu) => {
        assert.deepEqual(recu, { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: null } });
        return true;
      },
    );
    const faute = new TypeError('faute');
    await assert.rejects(
      surLaListe(() => {
        throw faute;
      }),
      (recu) => recu === faute,
    );
  });
});

describe('champDuRefus : le champ contre lequel un refus se pose', () => {
  test('le nom pour NOM_REQUIS et un nom trop long, la date pour DATE_INVALIDE, DATE_INCOMPLETE et une année trop ancienne, aucun sinon', () => {
    assert.equal(champDuRefus({ code: 'NOM_REQUIS', details: {} }), 'nom');
    // Le refus même que la création, la copie et le renommage lèvent.
    assert.equal(champDuRefus(refusNomEvenement('h'.repeat(NOM_EVENEMENT_MAX + 1))), 'nom');
    assert.equal(champDuRefus({ code: 'DATE_INVALIDE', details: { date: '2031-02-30' } }), 'date');
    assert.equal(champDuRefus({ code: 'DATE_INCOMPLETE', details: { remede: null } }), 'date');
    assert.equal(champDuRefus({ code: 'accueil.creation.anneeAvantMinimum', details: { minimum: 1900, remede: null } }), 'date');
    assert.equal(champDuRefus({ code: 'CHEMIN_TROP_LONG', details: {} }), null);
    assert.equal(champDuRefus(null), null);
  });
});

describe('refusDeLaDate : une date commencée mais incomplète refuse la création (§ 8.1)', () => {
  test('une saisie que le sélecteur ne lit pas rend DATE_INCOMPLETE, sans remède, contre le champ de la date', () => {
    const refus = refusDeLaDate({ value: '', validity: { badInput: true } });
    assert.deepEqual(refus, { code: 'DATE_INCOMPLETE', details: { remede: null } });
    assert.equal(champDuRefus(refus), 'date');
    assert.equal(
      t(refus.code, refus.details),
      "La date est incomplète ou n'existe pas au calendrier : choisissez le jour, le mois et l'année, ou videz le champ pour créer sans date.",
    );
  });

  test('une date sous le minimum du sélecteur rend un refus qui nomme l’année minimale, contre le champ de la date', () => {
    // « 0203 » tapé dans l'année : le sélecteur lit une date complète, sous
    // son attribut min, et le dit par validity.rangeUnderflow.
    assert.equal(ANNEE_MINIMALE, 1900);
    const refus = refusDeLaDate({ value: '0203-05-17', validity: { badInput: false, rangeUnderflow: true } });
    assert.deepEqual(refus, { code: 'accueil.creation.anneeAvantMinimum', details: { minimum: 1900, remede: null } });
    assert.equal(champDuRefus(refus), 'date');
    assert.equal(
      t(refus.code, refus.details),
      'L\u{2019}année de la date est 1900 au plus tôt : corrigez-la, ou videz le champ pour créer sans date.',
    );
    // Une saisie illisible l'emporte : son refus est DATE_INCOMPLETE.
    // Une année complète sur quatre chiffres, avant le minimum : même refus.
    assert.deepEqual(refusDeLaDate({ value: '1899-12-31', validity: { badInput: false, rangeUnderflow: true } }), refus);
    const illisible = refusDeLaDate({ value: '', validity: { badInput: true, rangeUnderflow: true } });
    assert.equal(illisible.code, 'DATE_INCOMPLETE');
  });

  test('un champ vide ou une date lue par le sélecteur ne refusent rien : la commande juge la date', () => {
    assert.equal(refusDeLaDate({ value: '', validity: { badInput: false, rangeUnderflow: false } }), null);
    assert.equal(refusDeLaDate({ value: '2031-05-17', validity: { badInput: false, rangeUnderflow: false } }), null);
    assert.equal(refusDeLaDate({ value: '1900-01-01', validity: { badInput: false, rangeUnderflow: false } }), null);
  });
});

describe('saisieDe : la saisie d’un nom pour copier ou renommer (§ 8.7)', () => {
  test('copier part d’un champ vide, renommer du nom inscrit ; chaque clé existe', () => {
    assert.deepEqual([...SAISIES], ['copier', 'renommer']);
    const copier = saisieDe('copier', 'Bal des Grisailles');
    assert.deepEqual(copier, {
      champ: 'nomCopie',
      etiquette: 'accueil.operation.nomCopie',
      commande: 'validerCopie',
      valider: 'accueil.operation.validerCopie',
      texte: '',
    });
    const renommer = saisieDe('renommer', 'Bal des Grisailles');
    assert.deepEqual(renommer, {
      champ: 'nouveauNom',
      etiquette: 'accueil.operation.nouveauNom',
      commande: 'validerRenommage',
      valider: 'accueil.operation.validerRenommage',
      texte: 'Bal des Grisailles',
    });
    assert.equal(saisieDe('renommer', null).texte, '');
    for (const saisie of [copier, renommer]) {
      assert.equal(typeof t(saisie.etiquette), 'string');
      assert.equal(typeof t(saisie.valider), 'string');
    }
    assert.throws(() => saisieDe('supprimer', 'x'), RangeError);
  });
});

describe('ligneAffichee : les mesures du retenu (§ 5.4, § 8.1)', () => {
  test('les collisions cumulées et les rencontres répétées choisies du retenu, celles de la façade, mises en forme chacune à sa place, sans calcul ici', () => {
    for (const [collisionsCumulees, rencontresRepetees] of [
      [500, 3],
      [7, 12],
      [0, 0],
    ]) {
      const affichee = ligneAffichee(ligne(), format, { ...AUCUN, mesuresDuRetenu: { collisionsCumulees, rencontresRepetees } });
      assert.equal(affichee.collisionsCumulees, format.nombre(collisionsCumulees), String(collisionsCumulees));
      assert.equal(affichee.rencontresRepetees, format.nombre(rencontresRepetees), String(rencontresRepetees));
    }
  });

  test('sans retenu mesurable, et pour une ligne illisible, les collisions et les rencontres répétées valent « — »', () => {
    for (const champs of [{}, { nom: null, etat: null, participants: null, illisible: { raison: 'VIDE', chemin: null } }]) {
      const affichee = ligneAffichee(ligne(champs), format, AUCUN);
      assert.equal(affichee.collisionsCumulees, VIDE);
      assert.equal(affichee.rencontresRepetees, VIDE);
    }
  });

  test('COLONNES_DU_RETENU : les collisions cumulées puis les rencontres répétées choisies, chacune sous l’intitulé de sa colonne du tableau des propositions, avec son explication propre à la liste ; plus rien de la différence à la cible', () => {
    assert.deepEqual(COLONNES_DU_RETENU, [
      {
        colonne: 'collisionsCumulees',
        cle: 'propositions.colonne.collisionsCumulees',
        explication: 'accueil.explication.collisionsCumulees',
      },
      {
        colonne: 'rencontresRepetees',
        cle: 'propositions.colonne.rencontresRepetees',
        explication: 'accueil.explication.rencontresRepetees',
      },
    ]);
    assert.ok(Object.isFrozen(COLONNES_DU_RETENU));
    for (const colonne of COLONNES_DU_RETENU) assert.ok(Object.isFrozen(colonne), colonne.colonne);
    assert.equal(t('propositions.colonne.collisionsCumulees'), 'Collisions cumulées (paire et tour)');
    assert.equal(t('propositions.colonne.rencontresRepetees'), 'Rencontres répétées choisies (paires)');
    const explication = t('accueil.explication.collisionsCumulees');
    for (const fragment of ['paire', 'tour', 'Collisions cumulées (paire et tour)', '\u{2014}']) {
      assert.ok(explication.includes(fragment), fragment);
    }
    // L'explication des rencontres répétées dit ce qu'elle compte, d'où elle
    // vient et quand elle vaut « — », et n'est pas celle des collisions.
    const repetees = t('accueil.explication.rencontresRepetees');
    for (const fragment of ['paires', "plus d'un tour", 'réservations', 'Rencontres répétées choisies (paires)', 'retenu', '\u{2014}']) {
      assert.ok(repetees.includes(fragment), fragment);
    }
    assert.notEqual(repetees, explication);
    for (const cle of [
      'accueil.colonne.diffRedondance',
      'accueil.explication.diffRedondance',
      'accueil.colonne.collisionsCumulees',
      'accueil.colonne.rencontresRepetees',
    ]) {
      assert.throws(() => t(cle), RangeError, cle);
    }
  });
});

describe('ligneAffichee : les résumés en attente (§ 8.1)', () => {
  test('sans résumé reçu, la ligne est en attente et ses trois valeurs de résumé ne disent rien ; reçu, elle ne l’est plus', () => {
    const attente = ligneAffichee(ligne(), format);
    assert.equal(attente.enAttente, true);
    assert.equal(attente.collisionsCumulees, VIDE);
    assert.equal(attente.rencontresRepetees, VIDE);
    assert.deepEqual(attente.meilleure, { id: VIDE });
    assert.equal(ligneAffichee(ligne(), format, AUCUN).enAttente, false);
    const recu = ligneAffichee(ligne(), format, {
      mesuresDuRetenu: { collisionsCumulees: 10, rencontresRepetees: 4 },
      meilleureDuClassement: { id: 3 },
    });
    assert.equal(recu.enAttente, false);
    assert.equal(recu.collisionsCumulees, format.nombre(10));
    assert.equal(recu.rencontresRepetees, format.nombre(4));
    assert.deepEqual(recu.meilleure, { id: format.nombre(3) });
  });

  test('les six informations ne dépendent pas des résumés : en attente, à vérifier ou non, elles sont les mêmes', () => {
    const sans = ({ enAttente, aVerifier, collisionsCumulees, rencontresRepetees, meilleure, ...reste }) => reste;
    assert.deepEqual(sans(ligneAffichee(ligne(), format)), sans(ligneAffichee(ligne(), format, AUCUN)));
    assert.deepEqual(sans(ligneAffichee(ligne(), format)), sans(ligneAffichee(ligne(), format, { ...AUCUN, aJour: false })));
  });
});

describe('ligneAffichee : les résumés à vérifier (§ 8.1)', () => {
  const PERIME = Object.freeze({
    mesuresDuRetenu: { collisionsCumulees: 417, rencontresRepetees: 23 },
    meilleureDuClassement: { id: 9 },
    aJour: false,
  });

  test('un résumé reçu à vérifier — l’ancien chiffre d’un aperçu périmé — montre ses trois valeurs, sans attente, et se dit à vérifier', () => {
    const affichee = ligneAffichee(ligne(), format, PERIME);
    assert.equal(affichee.enAttente, false);
    assert.equal(affichee.aVerifier, true);
    assert.equal(affichee.collisionsCumulees, format.nombre(417));
    assert.equal(affichee.rencontresRepetees, format.nombre(23));
    assert.deepEqual(affichee.meilleure, { id: format.nombre(9) });
  });

  test('à jour, sans marque ou sans résumé, la ligne n’est pas à vérifier ; à vérifier, ses valeurs sont celles du même résumé à jour', () => {
    assert.equal(ligneAffichee(ligne(), format).aVerifier, false);
    assert.equal(ligneAffichee(ligne(), format, AUCUN).aVerifier, false);
    assert.equal(ligneAffichee(ligne(), format, { ...PERIME, aJour: true }).aVerifier, false);
    const valeurs = ({ collisionsCumulees, rencontresRepetees, meilleure }) => ({ collisionsCumulees, rencontresRepetees, meilleure });
    assert.deepEqual(valeurs(ligneAffichee(ligne(), format, PERIME)), valeurs(ligneAffichee(ligne(), format, { ...PERIME, aJour: true })));
    assert.equal(ligneAffichee(ligne(), format, { ...AUCUN, aJour: false }).collisionsCumulees, VIDE);
  });

  test('l’aide d’une valeur à vérifier existe dans la traduction et dit le chiffre de la dernière vue d’ensemble', () => {
    assert.equal(t('accueil.verification'), 'Chiffre de la dernière vue d\u{2019}ensemble, en cours de vérification');
  });
});

describe('ligneAffichee : la meilleure proposition du classement (§ 5.4, § 5.7, § 8.1)', () => {
  const executer = (charge, nom, args) => appliquerCommande(nom, charge, args).charge;
  // La charge, une génération du moteur de plus, enregistrée par la commande.
  function generee(charge, reglages) {
    const configuration = configurationDepuisCharge(charge);
    const propositions = rechercher(configuration, reglages);
    return executer(charge, 'enregistrerGeneration', { propositions, configuration, produitVersion: VERSION.affichee });
  }

  test("l'identifiant que rend la façade, mis en forme, sans calcul ici", () => {
    const affichee = ligneAffichee(ligne(), format, { ...AUCUN, meilleureDuClassement: { id: 1234 } });
    assert.deepEqual(affichee.meilleure, { id: format.nombre(1234) });
  });

  test('sans proposition classée, et pour une ligne illisible, l’identifiant vaut « — »', () => {
    for (const champs of [{}, { nom: null, etat: null, participants: null, illisible: { raison: 'VIDE', chemin: null } }]) {
      assert.deepEqual(ligneAffichee(ligne(champs), format, AUCUN).meilleure, { id: VIDE });
    }
  });

  test('MEILLEURE : le titre et le libellé de l’identifiant du bloc de la génération, et l’explication du titre, qui existent', () => {
    assert.ok(Object.isFrozen(MEILLEURE));
    assert.deepEqual(MEILLEURE, {
      titre: 'generation.meilleure.titre',
      explication: 'accueil.explication.meilleure',
      proposition: 'generation.meilleure.proposition',
    });
    assert.equal(t(MEILLEURE.titre), 'Meilleure proposition du classement');
    for (const cle of Object.values(MEILLEURE)) assert.ok(t(cle).length > 0, cle);
  });

  test('le texte de la ligne est celui du bloc de la génération sur la même charge, classée ou non', () => {
    const generees = generee(analyser(texteLivre('petite-conflit')).charge, { graine: 4, nombre: 3, arret: 300, historique: 1000 });
    const retenue = executer(generees, 'retenirProposition', { id: generees.propositions.at(-1).id });
    const derivees = executer(generees, 'exclureParticipant', { id: generees.participants[0].id });
    const charges = [generees, retenue, derivees, analyser(texteLivre('petite')).charge];
    let classees = 0;
    for (const charge of charges) {
      const affichee = ligneAffichee(ligne(), format, { ...AUCUN, meilleureDuClassement: resumeDuMeilleur(charge) });
      const bloc = meilleureProposition(charge);
      if (bloc === null) {
        assert.deepEqual(affichee.meilleure, { id: VIDE });
        continue;
      }
      classees += 1;
      assert.deepEqual(affichee.meilleure, { id: format.nombre(bloc.id) });
    }
    assert.equal(classees, 2);
  });
});

// --- La vue de la liste : tuiles, résumé, groupes (§ 8.1, § 9) -------------------

// Une liste de sept lignes, dans l'ordre de la façade : deux brouillons, un
// proposé, un retenu, deux bloqués et un état illisible, entremêlés.
function liste() {
  const lisible = (base, etat, participants) => ligne({ base, id: `evt-${base}`, nom: base, etat, participants });
  return [
    lisible('Nuit des Pervenches', 'bloque', 40),
    lisible('Bal des Grisailles', 'brouillon', 12),
    ligne({ base: 'Soirée vide', id: null, nom: null, etat: null, participants: null, illisible: { raison: 'VIDE' } }),
    lisible('Gala des Ombrelles', 'retenu', 1200),
    lisible('Club des Merles', 'brouillon', 0),
    lisible('Souper des Hiboux', 'propose', 7),
    lisible('Fête des Lucioles', 'bloque', 3),
  ];
}
const bases = (lignes) => lignes.map(({ base }) => base);

describe('tuilesDeLaListe : une tuile par filtre (§ 8.1, § 9)', () => {
  test('Tous, puis les quatre états dans l’ordre du § 9 ; chaque compte, mis en forme ; seule la tuile du filtre est pressée', () => {
    assert.deepEqual(FILTRES, ['tous', 'brouillon', 'propose', 'retenu', 'bloque']);
    // Un format qui marque ses nombres : sous 1 000, format.nombre(n) vaut
    // String(n), et un compte resté brut passerait pour mis en forme.
    const marque = { nombre: (n) => `#${n}` };
    const tuiles = tuilesDeLaListe(liste(), 'propose', marque);
    assert.deepEqual(
      tuiles.map(({ filtre, compte, presse }) => [filtre, compte, presse]),
      [
        ['tous', '#7', false],
        ['brouillon', '#2', false],
        ['propose', '#1', true],
        ['retenu', '#1', false],
        ['bloque', '#2', false],
      ],
    );
  });

  test('le nom de chaque état est celui de la colonne État ; Tous et chaque aide ont leur clé, qui existe, et l’aide redit le § 9', () => {
    const tuiles = tuilesDeLaListe(liste(), 'tous', format);
    for (const { filtre, cle, aide } of tuiles) {
      if (filtre !== 'tous') assert.equal(cle, cleDEtat(filtre));
      assert.ok(t(cle).length > 0, cle);
      assert.ok(t(aide).length > 0, aide);
    }
    assert.equal(t(tuiles[0].cle), 'Tous les événements');
    assert.deepEqual(
      tuiles.slice(1).map(({ aide }) => t(aide)),
      ['on prépare', 'des placements existent, aucun n\u{2019}est retenu', 'un placement est en vigueur', 'rien ne peut plus changer'],
    );
  });

  test('la pastille de chaque tuile : celle de son état ; Tous, un statut d’information à l’icône de la liste', () => {
    assert.deepEqual(
      tuilesDeLaListe(liste(), 'tous', format).map(({ pastille }) => pastille),
      [
        { sorte: 'statut', valeur: 'information', icone: 'liste' },
        ...ETATS.map((etat) => ({ sorte: 'etat', valeur: etat, icone: null })),
      ],
    );
  });

  test('une liste vide compte zéro partout ; un filtre inconnu lève', () => {
    assert.deepEqual(
      tuilesDeLaListe([], 'tous', format).map(({ compte }) => compte),
      FILTRES.map(() => format.nombre(0)),
    );
    assert.throws(() => tuilesDeLaListe(liste(), 'illisible', format), RangeError);
    assert.throws(() => tuilesDeLaListe(liste(), undefined, format), RangeError);
  });
});

describe('resumeDeLaListe : le résumé de l’en-tête (§ 8.1)', () => {
  test('le nombre d’événements, et la somme des participants déjà listés : un état illisible n’en apporte aucun', () => {
    assert.deepEqual(resumeDeLaListe(liste()), { evenements: 7, participants: 1262 });
    assert.deepEqual(resumeDeLaListe([]), { evenements: 0, participants: 0 });
  });

  test('le texte du résumé accorde chaque compte, et met les nombres en forme', () => {
    assert.equal(t('accueil.entete.resume', resumeDeLaListe(liste())), `7 événements \u{00B7} ${format.nombre(1262)} participants au total`);
    assert.equal(t('accueil.entete.resume', { evenements: 1, participants: 1 }), '1 événement \u{00B7} 1 participant au total');
    assert.equal(t('accueil.entete.resume', { evenements: 1, participants: 0 }), '1 événement \u{00B7} 0 participant au total');
    // Le compte des événements passe lui aussi par la mise en forme des nombres.
    assert.notEqual(format.nombre(1200), '1200');
    assert.equal(t('accueil.entete.resume', { evenements: 1200, participants: 1 }), `${format.nombre(1200)} événements \u{00B7} 1 participant au total`);
  });
});

describe('groupesDeLaListe : les groupes du tableau (§ 8.1, § 9)', () => {
  test('par état : les groupes dans l’ordre du § 9, puis les états illisibles ; dans chaque groupe, l’ordre de la façade ; un état sans ligne n’a pas de groupe', () => {
    const lignes = liste().filter(({ etat }) => etat !== 'propose');
    const groupes = groupesDeLaListe(lignes, 'tous', 'etat');
    assert.deepEqual(
      groupes.map(({ groupe, cle, details }) => [groupe, cle, details]),
      [
        ['brouillon', 'accueil.etat.brouillon', { evenements: 2 }],
        ['retenu', 'accueil.etat.retenu', { evenements: 1 }],
        ['bloque', 'accueil.etat.bloque', { evenements: 2 }],
        ['illisible', 'accueil.groupe.illisible', { evenements: 1 }],
      ],
    );
    assert.deepEqual(bases(groupes[0].lignes), ['Bal des Grisailles', 'Club des Merles']);
    assert.deepEqual(bases(groupes[2].lignes), ['Nuit des Pervenches', 'Fête des Lucioles']);
    assert.deepEqual(bases(groupes[3].lignes), ['Soirée vide']);
    assert.equal(groupes[0].lignes[0], lignes[1]);
  });

  test('la pastille de chaque groupe : celle de son état ; les états illisibles, un avis à l’icône du triangle ; chaque clé existe', () => {
    const groupes = groupesDeLaListe(liste(), 'tous', 'etat');
    assert.deepEqual(
      groupes.map(({ pastille }) => pastille),
      [
        ...ETATS.map((etat) => ({ sorte: 'etat', valeur: etat, icone: null })),
        { sorte: 'statut', valeur: 'avis', icone: 'triangle' },
      ],
    );
    for (const { cle, details } of groupes) {
      assert.ok(t(cle).length > 0, cle);
      assert.ok(t('accueil.groupe.compte', details).length > 0);
    }
    assert.equal(t('accueil.groupe.compte', { evenements: 1 }), '1 événement');
    assert.equal(t('accueil.groupe.compte', { evenements: 2 }), '2 événements');
    // Au-delà de 999, le compte prend la mise en forme des nombres.
    assert.notEqual(format.nombre(1200), '1200');
    assert.equal(t('accueil.groupe.compte', { evenements: 1200 }), `${format.nombre(1200)} événements`);
  });

  test('un filtre ne retient que son état, illisibles écartés ; sans ligne retenue, aucun groupe', () => {
    const groupes = groupesDeLaListe(liste(), 'bloque', 'etat');
    assert.deepEqual(
      groupes.map(({ groupe }) => groupe),
      ['bloque'],
    );
    assert.deepEqual(bases(groupes[0].lignes), ['Nuit des Pervenches', 'Fête des Lucioles']);
    assert.deepEqual(groupesDeLaListe(liste().filter(({ etat }) => etat !== 'retenu'), 'retenu', 'etat'), []);
    assert.deepEqual(groupesDeLaListe([], 'tous', 'etat'), []);
    assert.deepEqual(groupesDeLaListe([], 'tous', 'aucun'), []);
  });

  test('sans groupement : un seul groupe sans intitulé, dans l’ordre de la façade, filtré comme les autres', () => {
    const lignes = liste();
    const [seul, ...autres] = groupesDeLaListe(lignes, 'tous', 'aucun');
    assert.deepEqual(autres, []);
    assert.equal(seul.groupe, null);
    assert.equal(seul.cle, null);
    assert.equal(seul.pastille, null);
    assert.deepEqual(seul.details, { evenements: 7 });
    assert.deepEqual(bases(seul.lignes), bases(lignes));
    assert.deepEqual(
      bases(groupesDeLaListe(lignes, 'brouillon', 'aucun')[0].lignes),
      ['Bal des Grisailles', 'Club des Merles'],
    );
  });

  test('un filtre, un groupement ou un état de ligne inconnus lèvent : aucune ligne ne disparaît en silence', () => {
    assert.throws(() => groupesDeLaListe(liste(), 'illisible', 'etat'), RangeError);
    assert.throws(() => groupesDeLaListe(liste(), 'tous', 'date'), RangeError);
    assert.throws(() => groupesDeLaListe([ligne({ etat: 'archive' })], 'tous', 'etat'), RangeError);
    assert.throws(() => groupesDeLaListe([ligne({ etat: 'archive' })], 'tous', 'aucun'), RangeError);
  });

  test('choixDeGroupement : par état du plan, puis aucun, chacun avec sa clé, qui existe', () => {
    assert.deepEqual(GROUPEMENTS, ['etat', 'aucun']);
    const choix = choixDeGroupement();
    assert.deepEqual(
      choix.map(({ groupement }) => groupement),
      GROUPEMENTS,
    );
    assert.deepEqual(
      choix.map(({ cle }) => t(cle)),
      ['État du plan', 'Aucun groupement'],
    );
    choix[0].cle = 'autre';
    assert.equal(choixDeGroupement()[0].cle, 'accueil.groupement.etat');
  });
});

describe('vueDeLaListe : le filtre et le groupement, retenus par la séance, jamais écrits (§ 8.1)', () => {
  test('par défaut, tous les événements groupés par état ; une vue retenue se relit pour la même séance, et pour elle seule', () => {
    const seance = {};
    const autre = {};
    assert.deepEqual(vueDeLaListe(seance), { filtre: 'tous', groupement: 'etat' });
    retenirVue(seance, { filtre: 'retenu', groupement: 'aucun' });
    assert.deepEqual(vueDeLaListe(seance), { filtre: 'retenu', groupement: 'aucun' });
    assert.deepEqual(vueDeLaListe(autre), { filtre: 'tous', groupement: 'etat' });
  });

  test('la vue rendue est une copie : la changer ne change pas ce que la séance retient', () => {
    const seance = {};
    const vue = vueDeLaListe(seance);
    vue.filtre = 'bloque';
    assert.deepEqual(vueDeLaListe(seance), { filtre: 'tous', groupement: 'etat' });
    const retenue = { filtre: 'propose', groupement: 'etat' };
    retenirVue(seance, retenue);
    retenue.filtre = 'bloque';
    assert.equal(vueDeLaListe(seance).filtre, 'propose');
  });

  test('une séance absente, un filtre ou un groupement inconnus lèvent, et rien n’est retenu', () => {
    const seance = {};
    assert.throws(() => vueDeLaListe(null), TypeError);
    assert.throws(() => retenirVue('séance', { filtre: 'tous', groupement: 'etat' }), TypeError);
    assert.throws(() => retenirVue(seance, { filtre: 'illisible', groupement: 'etat' }), RangeError);
    assert.throws(() => retenirVue(seance, { filtre: 'tous', groupement: 'date' }), RangeError);
    assert.deepEqual(vueDeLaListe(seance), { filtre: 'tous', groupement: 'etat' });
  });
});
