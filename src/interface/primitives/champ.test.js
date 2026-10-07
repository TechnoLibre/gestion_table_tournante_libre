// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// La machine d'un champ (§ 2, § 8.2) : la saisie se tient hors de la valeur
// enregistrée jusqu'à la validation, que la sortie du champ déclenche ; Échap
// rend la valeur enregistrée ; une saisie que lire refuse garde son texte et
// porte le refus. Les noms d'épreuve sont inventés.
import assert from 'node:assert/strict';
import { describe, test } from '../../../test/lanceur.js';
import { creerMachineChamp, estRefusSeance, refusSeanceCourant } from './champ.js';

// Une lecture d'épreuve : un texte blanc est refusé LIBELLE_VIDE, tout autre
// se lit sans ses blancs de bord.
function lireLibelle(texte) {
  const valeur = texte.trim();
  if (valeur === '') return { refus: { code: 'LIBELLE_VIDE', details: { remede: null } } };
  return { valeur };
}

// Une lecture d'entier : NON_ENTIER pour ce qui n'en est pas un.
function lireEntier(texte) {
  if (!/^\s*\d+\s*$/.test(texte)) return { refus: { code: 'NON_ENTIER', details: { saisie: texte, remede: null } } };
  return { valeur: Number(texte) };
}

describe('champ : la machine', () => {
  test("au départ, la saisie est la valeur enregistrée, rien n'est en cours", () => {
    const champ = creerMachineChamp({ stockee: 'Grisaille', lire: lireLibelle });
    assert.equal(champ.stockee, 'Grisaille');
    assert.equal(champ.saisie, 'Grisaille');
    assert.equal(champ.enCours, false);
    assert.equal(champ.refus, null);
  });

  test('saisir puis valider sans changement → aucune', () => {
    const champ = creerMachineChamp({ stockee: 'Grisaille', lire: lireLibelle });
    champ.saisir('Grisaill');
    champ.saisir('Grisaille');
    assert.equal(champ.enCours, true);
    assert.deepEqual(champ.valider(), { action: 'aucune' });
    assert.equal(champ.enCours, false);
    assert.equal(champ.saisie, 'Grisaille');
  });

  test('une saisie qui se lit comme la valeur enregistrée → aucune, et la saisie revient à la valeur enregistrée', () => {
    const champ = creerMachineChamp({ stockee: 'Grisaille', lire: lireLibelle });
    champ.saisir('  Grisaille ');
    assert.deepEqual(champ.valider(), { action: 'aucune' });
    assert.equal(champ.saisie, 'Grisaille');
    assert.equal(champ.enCours, false);
  });

  test('valider sans avoir rien saisi → aucune', () => {
    const champ = creerMachineChamp({ stockee: '4', lire: lireEntier });
    assert.deepEqual(champ.valider(), { action: 'aucune' });
  });

  test('Échap (abandonner) → la valeur enregistrée, rien en cours, aucun refus', () => {
    const champ = creerMachineChamp({ stockee: 'Grisaille', lire: lireLibelle });
    champ.saisir('');
    assert.equal(champ.valider().action, 'refus');
    champ.abandonner();
    assert.equal(champ.saisie, 'Grisaille');
    assert.equal(champ.enCours, false);
    assert.equal(champ.refus, null);
  });

  test('une saisie que lire refuse → refus, la saisie gardée et toujours en cours', () => {
    const champ = creerMachineChamp({ stockee: '4', lire: lireEntier });
    champ.saisir('quatre');
    const rendu = champ.valider();
    assert.deepEqual(rendu, { action: 'refus', refus: { code: 'NON_ENTIER', details: { saisie: 'quatre', remede: null } } });
    assert.equal(champ.saisie, 'quatre');
    assert.equal(champ.enCours, true);
    assert.deepEqual(champ.refus, rendu.refus);
    champ.saisir('quatr');
    assert.equal(champ.refus, null, 'une frappe retire le refus');
  });

  test('une saisie lue → executer avec la valeur lue ; la saisie devient la valeur enregistrée', () => {
    const champ = creerMachineChamp({ stockee: '4', lire: lireEntier });
    champ.saisir(' 6');
    assert.deepEqual(champ.valider(), { action: 'executer', valeur: 6 });
    assert.equal(champ.enCours, false);
    assert.equal(champ.stockee, ' 6');
    assert.deepEqual(champ.valider(), { action: 'aucune' }, 'une seconde validation, la sortie après Entrée, ne relance rien');
  });

  test("echec : le refus de l'exécution rend la valeur enregistrée d'avant, garde la saisie, et la remet en cours", () => {
    const champ = creerMachineChamp({ stockee: 'Grisaille', lire: lireLibelle });
    champ.saisir('Club des Merles');
    assert.equal(champ.valider().action, 'executer');
    const refus = { code: 'MODE_LECTURE', details: { remede: { geste: 'modifier' } } };
    champ.echec(refus);
    assert.equal(champ.stockee, 'Grisaille');
    assert.equal(champ.saisie, 'Club des Merles');
    assert.equal(champ.enCours, true);
    assert.deepEqual(champ.refus, refus);
    assert.deepEqual(champ.valider(), { action: 'executer', valeur: 'Club des Merles' });
  });

  test('recevoir : une valeur enregistrée nouvelle se montre hors saisie, et attend la fin de la saisie sinon', () => {
    const champ = creerMachineChamp({ stockee: 'Grisaille', lire: lireLibelle });
    champ.recevoir('Club des Merles');
    assert.equal(champ.saisie, 'Club des Merles');
    champ.saisir('Iris');
    champ.recevoir('Ondine Lacasse');
    assert.equal(champ.saisie, 'Iris');
    assert.equal(champ.stockee, 'Ondine Lacasse');
    champ.abandonner();
    assert.equal(champ.saisie, 'Ondine Lacasse');
  });

  test('une valeur enregistrée que lire refuse se compare par son texte', () => {
    const champ = creerMachineChamp({ stockee: '', lire: lireLibelle });
    champ.saisir('');
    assert.deepEqual(champ.valider(), { action: 'aucune' });
    champ.saisir('Iris');
    assert.deepEqual(champ.valider(), { action: 'executer', valeur: 'Iris' });
  });
});

describe('champ : le refus de la séance confronté à son état', () => {
  const MODE_LECTURE = { code: 'MODE_LECTURE', details: { remede: { geste: 'modifier' } } };
  const BLOQUE = { code: 'LECTURE_SEULE', details: { raison: 'BLOQUE', remede: { geste: 'debloquer' } } };
  const etatDe = (champs) => ({ mode: 'lecture', refus: null, verrouAutre: null, ...champs });

  test('les codes de la séance : MODE_LECTURE, LECTURE_SEULE, SUPPORT_ROMPU, VERROU_PRIS ; un refus de lire ou de commande est local', () => {
    for (const code of ['MODE_LECTURE', 'LECTURE_SEULE', 'SUPPORT_ROMPU', 'VERROU_PRIS']) {
      assert.equal(estRefusSeance({ code, details: {} }), true, code);
    }
    for (const code of ['NOM_REQUIS', 'NON_ENTIER', 'SANS_EFFET', 'AUCUN_EVENEMENT']) {
      assert.equal(estRefusSeance({ code, details: {} }), false, code);
    }
  });

  test("tenu tant qu'etat.refus le porte, le même objet rendu ; levé quand etat.refus est null ; remplacé par une autre cause", () => {
    const pose = { code: 'MODE_LECTURE', details: { remede: { geste: 'modifier' } } };
    assert.equal(refusSeanceCourant(pose, etatDe({ refus: MODE_LECTURE })), pose);
    assert.equal(refusSeanceCourant(pose, etatDe({ mode: 'ecriture' })), null);
    assert.equal(refusSeanceCourant(pose, etatDe({ refus: BLOQUE })), BLOQUE);
  });

  test("VERROU_PRIS : tenu tant qu'un verrou d'une autre séance est relevé, levé sinon, jamais remplacé par MODE_LECTURE", () => {
    const pris = { code: 'VERROU_PRIS', details: { seance: 'epreuve-2', depuis: null, vivant: null, remede: null } };
    const autre = { seance: 'epreuve-2', depuis: null, vivant: null };
    assert.equal(refusSeanceCourant(pris, etatDe({ refus: MODE_LECTURE, verrouAutre: autre })), pris);
    assert.equal(refusSeanceCourant(pris, etatDe({ refus: MODE_LECTURE })), null);
  });

  test("LECTURE_SEULE d'une raison qu'etat.refus ne porte pas (ENCODAGE) : tenu en lecture, levé en écriture", () => {
    const encodage = { code: 'LECTURE_SEULE', details: { raison: 'ENCODAGE', remede: { geste: 'ouvrirSecours', source: 'precedent' } } };
    assert.equal(refusSeanceCourant(encodage, etatDe({ refus: MODE_LECTURE })), encodage);
    assert.equal(refusSeanceCourant(encodage, etatDe({ mode: 'ecriture' })), null);
  });

  test('un refus local passe tel quel', () => {
    const local = { code: 'NOM_REQUIS', details: { remede: null } };
    assert.equal(refusSeanceCourant(local, etatDe({ mode: 'ecriture' })), local);
  });
});
