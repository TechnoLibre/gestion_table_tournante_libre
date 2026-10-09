// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// Le modèle de l'accueil (§ 8.1, § 8.6, § 8.8) : les six informations d'une
// ligne de la liste, mises en forme, et ses signalements ; les réponses
// d'une question du dossier de travail ; les secours d'un état illisible ;
// le refus d'un geste de la liste, sans remède ; l'annonce du dossier de
// travail, une fois par séance. Chaque clé que le modèle rend existe dans la
// traduction. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { appliquerCommande } from '../../application/commandes.js';
import { resumeDuMeilleur } from '../../application/evaluation.js';
import { creerFormat } from '../../application/format.js';
import { TABLES_APPLICATION } from '../../application/libelles.js';
import { creerTraduction } from '../../application/traduction.js';
import { texteLivre } from '../../demo/livrees.js';
import { rechercher } from '../../moteur/recherche.js';
import { analyser, configurationDepuisCharge } from '../../stockage/document.js';
import { VERSION } from '../../version.genere.js';
import { COLONNE_ANNONCEE, meilleureProposition } from '../generation/meilleure.js';
import { TABLES_INTERFACE } from '../libelles.js';
import { COLONNES, texteCellule } from '../propositions/modele.js';
import {
  COLONNES_DU_RETENU,
  ETATS,
  MEILLEURE,
  SAISIES,
  champDuRefus,
  cleDEtat,
  ligneAffichee,
  premiereAnnonce,
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
      'chemin',
      'collisionsCumulees',
      'date',
      'diffRedondance',
      'enAttente',
      'etat',
      'meilleure',
      'modification',
      'nom',
      'participants',
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
  test('le nom pour NOM_REQUIS, la date pour DATE_INVALIDE, aucun sinon', () => {
    assert.equal(champDuRefus({ code: 'NOM_REQUIS', details: {} }), 'nom');
    assert.equal(champDuRefus({ code: 'DATE_INVALIDE', details: { date: '2031-02-30' } }), 'date');
    assert.equal(champDuRefus({ code: 'CHEMIN_TROP_LONG', details: {} }), null);
    assert.equal(champDuRefus(null), null);
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

describe('ligneAffichee : les mesures du retenu (§ 5.4, § 8.1, § 8.9)', () => {
  test('les collisions cumulées et la différence à la cible, celles de la façade, mises en forme ; aucune ne se calcule ici', () => {
    const mesuresDuRetenu = { collisionsCumulees: 1234, totalRedondance: 1500, cibleRedondance: 1000, diffRedondance: 500 };
    const affichee = ligneAffichee(ligne(), format, { ...AUCUN, mesuresDuRetenu });
    assert.equal(affichee.collisionsCumulees, format.nombre(1234));
    assert.equal(affichee.diffRedondance, format.nombre(500));
    // La différence se lit telle que la façade la rend, jamais refaite
    // depuis la cible et la somme.
    const telleQuelle = ligneAffichee(ligne(), format, { ...AUCUN, mesuresDuRetenu: { ...mesuresDuRetenu, diffRedondance: 7 } });
    assert.equal(telleQuelle.diffRedondance, format.nombre(7));
  });

  test('sans retenu mesurable, et pour une ligne illisible, les deux valent « — »', () => {
    for (const champs of [{}, { nom: null, etat: null, participants: null, illisible: { raison: 'VIDE', chemin: null } }]) {
      const affichee = ligneAffichee(ligne(champs), format, AUCUN);
      assert.equal(affichee.collisionsCumulees, VIDE);
      assert.equal(affichee.diffRedondance, VIDE);
    }
  });

  test('COLONNES_DU_RETENU : les deux colonnes, dans leur ordre, chacune avec son intitulé et son explication, qui existent', () => {
    assert.deepEqual(
      COLONNES_DU_RETENU.map(({ colonne }) => colonne),
      ['collisionsCumulees', 'diffRedondance'],
    );
    assert.ok(Object.isFrozen(COLONNES_DU_RETENU));
    for (const { colonne, cle, explication } of COLONNES_DU_RETENU) {
      assert.equal(cle, `accueil.colonne.${colonne}`);
      assert.equal(explication, `accueil.explication.${colonne}`);
      assert.ok(t(cle).length > 0);
      assert.ok(t(explication).length > 0);
    }
    assert.equal(t('accueil.colonne.collisionsCumulees'), 'Collisions cumulées (paire et tour)');
    assert.equal(t('accueil.colonne.diffRedondance'), "Diff somme d'appartenance");
  });
});

describe('ligneAffichee : les résumés en attente (§ 8.1)', () => {
  test('sans résumé reçu, la ligne est en attente et ses quatre valeurs de résumé ne disent rien ; reçu, elle ne l’est plus', () => {
    const attente = ligneAffichee(ligne(), format);
    assert.equal(attente.enAttente, true);
    assert.equal(attente.collisionsCumulees, VIDE);
    assert.equal(attente.diffRedondance, VIDE);
    assert.deepEqual(attente.meilleure, { id: VIDE, collisions: VIDE });
    assert.equal(ligneAffichee(ligne(), format, AUCUN).enAttente, false);
    const recu = ligneAffichee(ligne(), format, {
      mesuresDuRetenu: { collisionsCumulees: 12, totalRedondance: 990, cibleRedondance: 1000, diffRedondance: 10 },
      meilleureDuClassement: { id: 3, collisionsCumulees: 9 },
    });
    assert.equal(recu.enAttente, false);
    assert.equal(recu.collisionsCumulees, format.nombre(12));
    assert.deepEqual(recu.meilleure, { id: format.nombre(3), collisions: format.nombre(9) });
  });

  test('les six informations ne dépendent pas des résumés : en attente ou non, elles sont les mêmes', () => {
    const sans = ({ enAttente, collisionsCumulees, diffRedondance, meilleure, ...reste }) => reste;
    assert.deepEqual(sans(ligneAffichee(ligne(), format)), sans(ligneAffichee(ligne(), format, AUCUN)));
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

  test("l'identifiant et les collisions cumulées que rend la façade, mis en forme ; aucun ne se calcule ici", () => {
    const affichee = ligneAffichee(ligne(), format, { ...AUCUN, meilleureDuClassement: { id: 1234, collisionsCumulees: 5678 } });
    assert.deepEqual(affichee.meilleure, { id: format.nombre(1234), collisions: format.nombre(5678) });
  });

  test('sans proposition classée, et pour une ligne illisible, les deux valent « — »', () => {
    for (const champs of [{}, { nom: null, etat: null, participants: null, illisible: { raison: 'VIDE', chemin: null } }]) {
      assert.deepEqual(ligneAffichee(ligne(champs), format, AUCUN).meilleure, { id: VIDE, collisions: VIDE });
    }
  });

  test('MEILLEURE : les libellés du bloc de la génération, son explication des collisions, et l’explication du titre, qui existent', () => {
    const colonne = COLONNES.find(({ nom }) => nom === COLONNE_ANNONCEE);
    assert.ok(Object.isFrozen(MEILLEURE));
    assert.deepEqual(MEILLEURE, {
      titre: 'generation.meilleure.titre',
      explication: 'accueil.explication.meilleure',
      proposition: 'generation.meilleure.proposition',
      collisions: colonne.cle,
      explicationCollisions: colonne.explication,
    });
    assert.equal(t(MEILLEURE.titre), 'Meilleure proposition du classement');
    assert.equal(t(MEILLEURE.collisions), 'Collisions cumulées (paire et tour)');
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
        assert.deepEqual(affichee.meilleure, { id: VIDE, collisions: VIDE });
        continue;
      }
      classees += 1;
      assert.deepEqual(affichee.meilleure, { id: format.nombre(bloc.id), collisions: texteCellule(bloc.cellule, { t, format }) });
    }
    assert.equal(classees, 2);
  });
});
