// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'état de navigation de l'interface : chaque transition, le contrat des
// magasins de Svelte, et l'absence de toute écriture — l'état ne connaît pas
// la séance, et regarder n'écrit jamais (§ 8.2, § 8.4).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { creerEtatUi } from './etat_ui.js';
import { SECTION_OUVERTURE, SECTIONS } from './evenement/sections.js';

const DEPART = {
  section: SECTION_OUVERTURE,
  apropos: false,
  tour: 1,
  miseEnEvidence: null,
  proposition: null,
  importEnAttente: null,
  listes: true,
  pleinEcran: false,
  selection: null,
};

// Un état et le relevé de ce que reçoit son abonné.
function suivi() {
  const ui = creerEtatUi();
  const recus = [];
  const desabonner = ui.subscribe((etat) => recus.push(etat));
  return { ui, recus, desabonner };
}

describe('état de navigation : départ et magasin', () => {
  test('le départ : la section d’ouverture, le tour 1, rien de choisi, les listes montrées', () => {
    assert.deepEqual(creerEtatUi().etat(), DEPART);
  });

  test('subscribe rend l’état tout de suite, puis chaque nouvel état, figé ; désabonné, plus rien', () => {
    const { ui, recus, desabonner } = suivi();
    assert.deepEqual(recus, [DEPART]);
    ui.allerA('tables');
    assert.equal(recus.length, 2);
    assert.equal(recus[1], ui.etat());
    assert.ok(Object.isFrozen(recus[1]));
    assert.throws(() => {
      recus[1].section = 'plan';
    }, TypeError);
    desabonner();
    ui.allerA('plan');
    assert.equal(recus.length, 2);
  });

  test('l’état ne reçoit rien à sa création : il ne connaît ni la séance, ni la façade, ni un système de fichiers', () => {
    assert.equal(creerEtatUi.length, 0);
    const source = readFileSync(new URL('./etat_ui.js', import.meta.url), 'utf8');
    // Le dernier mot de chaque ligne d'import : le module qu'elle charge.
    const imports = source
      .split('\n')
      .filter((ligne) => ligne.startsWith('import '))
      .map((ligne) => ligne.slice(ligne.lastIndexOf(' ') + 1));
    assert.deepEqual(imports, ["'./evenement/sections.js';"]);
  });
});

describe('état de navigation : chaque transition', () => {
  test('allerA mène à chaque section ; hors de SECTIONS, RangeError sans rien changer', () => {
    const ui = creerEtatUi();
    assert.ok(SECTIONS.length > 0);
    for (const section of SECTIONS) {
      ui.allerA(section);
      assert.deepEqual(ui.etat(), { ...DEPART, section });
    }
    const avant = ui.etat();
    for (const faute of ['accueil', 'apropos', '', undefined, 'Plan', 'constructor']) {
      assert.throws(() => ui.allerA(faute), RangeError, String(faute));
    }
    assert.equal(ui.etat(), avant);
  });

  test('reinitialiser rend l’état de départ, le panneau « À propos » excepté', () => {
    const ui = creerEtatUi();
    ui.allerA('generation');
    ui.montrerTour(3);
    ui.mettreEnEvidence(7);
    ui.montrerProposition(2);
    ui.ouvrirImport({ texte: 'nom\nOmbrelle', origine: 'liste.csv' });
    ui.basculerListes();
    ui.basculerPleinEcran();
    ui.selectionner({ table: 1, siege: 2 });
    ui.ouvrirApropos();
    ui.reinitialiser();
    assert.deepEqual(ui.etat(), { ...DEPART, apropos: true });
    assert.equal(ui.etat().section, SECTION_OUVERTURE);
  });

  test('ouvrirApropos et fermerApropos', () => {
    const ui = creerEtatUi();
    ui.ouvrirApropos();
    assert.deepEqual(ui.etat(), { ...DEPART, apropos: true });
    ui.fermerApropos();
    assert.deepEqual(ui.etat(), DEPART);
  });

  test('montrerTour prend un entier positif ; sinon RangeError', () => {
    const ui = creerEtatUi();
    ui.montrerTour(4);
    assert.equal(ui.etat().tour, 4);
    for (const faute of [0, -1, 1.5, Number.NaN, '2', null]) {
      assert.throws(() => ui.montrerTour(faute), RangeError, String(faute));
    }
    assert.equal(ui.etat().tour, 4);
  });

  test('mettreEnEvidence, montrerProposition et selectionner posent puis retirent leur choix', () => {
    const ui = creerEtatUi();
    ui.mettreEnEvidence(12);
    ui.montrerProposition(3);
    ui.selectionner({ table: 2, siege: 1 });
    assert.deepEqual(ui.etat(), { ...DEPART, miseEnEvidence: 12, proposition: 3, selection: { table: 2, siege: 1 } });
    ui.mettreEnEvidence(null);
    ui.montrerProposition(null);
    ui.selectionner(null);
    assert.deepEqual(ui.etat(), DEPART);
  });

  test('ouvrirImport garde le texte en attente et mène à la section import ; prendreImport le rend une fois', () => {
    const ui = creerEtatUi();
    const enAttente = { texte: 'nom;prénom\nPervenche;Théo', origine: 'invites.csv' };
    ui.ouvrirImport(enAttente);
    assert.deepEqual(ui.etat(), { ...DEPART, section: 'import', importEnAttente: enAttente });
    assert.deepEqual(ui.prendreImport(), enAttente);
    assert.equal(ui.etat().importEnAttente, null);
    assert.equal(ui.prendreImport(), null);
  });

  test('basculerListes et basculerPleinEcran alternent', () => {
    const ui = creerEtatUi();
    ui.basculerListes();
    ui.basculerPleinEcran();
    assert.deepEqual(ui.etat(), { ...DEPART, listes: false, pleinEcran: true });
    ui.basculerListes();
    ui.basculerPleinEcran();
    assert.deepEqual(ui.etat(), DEPART);
  });

  test('une transition qui ne change rien ne publie pas d’état neuf', () => {
    const { ui, recus } = suivi();
    ui.allerA(SECTION_OUVERTURE);
    ui.fermerApropos();
    ui.mettreEnEvidence(null);
    assert.equal(recus.length, 1);
  });
});
