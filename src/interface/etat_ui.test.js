// © 2026 TechnoLibre (http://www.technolibre.ca)
// License AGPL-3.0 or later (https://www.gnu.org/licenses/agpl)

// L'état de navigation de l'interface : chaque transition, le contrat des
// magasins de Svelte, et l'absence de toute écriture — l'état ne connaît pas
// la séance, et regarder n'écrit jamais (§ 8.2, § 8.4).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, test } from '../../test/lanceur.js';
import { VUES_QUALITE_DEMANDABLES, creerEtatUi } from './etat_ui.js';
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
  fiche: null,
  choix: null,
  pose: null,
  appartenance: '',
  apercu: null,
  visee: 0,
  pagePropositions: null,
  melangeTables: 'sieges',
  depart: null,
  comparee: null,
  vueQualite: null,
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
    ui.ouvrirFiche(4);
    ui.choisir({ genre: 'personne', participant: 2, depuis: null });
    ui.poserSurPlace({ place: { table: 1, siege: 2 }, refus: { code: 'SANS_EFFET', details: {} }, avertissements: [] });
    ui.retenirPagePropositions(Object.freeze({ page: 2 }));
    ui.reglerMelangeTables('doublons');
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
    assert.deepEqual(ui.etat(), { ...DEPART, miseEnEvidence: 12, proposition: 3, visee: 1, selection: { table: 2, siege: 1 } });
    ui.mettreEnEvidence(null);
    ui.montrerProposition(null);
    ui.selectionner(null);
    assert.deepEqual(ui.etat(), { ...DEPART, visee: 1 });
  });

  test('montrerProposition numérote chaque visée : la même proposition demandée de nouveau publie un état neuf ; null retire la visée sans la numéroter', () => {
    const { ui, recus } = suivi();
    ui.montrerProposition(5);
    assert.equal(ui.etat().visee, 1);
    ui.montrerProposition(5);
    assert.deepEqual([ui.etat().proposition, ui.etat().visee, recus.length], [5, 2, 3]);
    ui.montrerProposition(null);
    ui.montrerProposition(null);
    assert.deepEqual([ui.etat().proposition, ui.etat().visee, recus.length], [null, 2, 4]);
    ui.montrerProposition(5);
    assert.equal(ui.etat().visee, 3);
    ui.reinitialiser();
    assert.equal(ui.etat().visee, 0);
  });

  test('retenirPagePropositions retient le suivi de la page des propositions, figé, ou null ; un autre événement repart de null ; RangeError sinon, sans rien changer', () => {
    const { ui, recus } = suivi();
    const page = Object.freeze({ cles: Object.freeze(['1/1/40/1000']), visee: 0, page: 2, pages: 3 });
    ui.retenirPagePropositions(page);
    assert.equal(ui.etat().pagePropositions, page);
    ui.retenirPagePropositions(page);
    assert.equal(recus.length, 2);
    ui.allerA('plan');
    ui.allerA('propositions');
    assert.equal(ui.etat().pagePropositions, page);
    for (const faute of [undefined, 2, 'page', { page: 2 }]) assert.throws(() => ui.retenirPagePropositions(faute), RangeError, String(faute));
    assert.equal(ui.etat().pagePropositions, page);
    ui.reinitialiser();
    assert.equal(ui.etat().pagePropositions, null);
    ui.retenirPagePropositions(page);
    ui.retenirPagePropositions(null);
    assert.equal(ui.etat().pagePropositions, null);
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

  test('le plein écran ne vaut que pour le plan : quitter le plan le retire, par allerA, ouvrirFiche ou ouvrirImport ; hors du plan, il ne se pose pas', () => {
    const quitters = [
      ...SECTIONS.filter((section) => section !== 'plan').map((section) => [`allerA ${section}`, (ui) => ui.allerA(section)]),
      ['ouvrirFiche', (ui) => ui.ouvrirFiche(4)],
      ['ouvrirImport', (ui) => ui.ouvrirImport({ texte: 'nom\nOmbrelle', origine: 'collage' })],
    ];
    assert.ok(SECTIONS.includes('plan'));
    assert.equal(quitters.length, SECTIONS.length - 1 + 2);
    for (const [nom, quitter] of quitters) {
      const ui = creerEtatUi();
      ui.allerA('plan');
      ui.basculerPleinEcran();
      assert.equal(ui.etat().pleinEcran, true, nom);
      quitter(ui);
      assert.notEqual(ui.etat().section, 'plan', nom);
      assert.equal(ui.etat().pleinEcran, false, nom);
      ui.basculerPleinEcran();
      assert.equal(ui.etat().pleinEcran, false, `${nom} : hors du plan, la bascule ne pose rien`);
      ui.allerA('plan');
      assert.equal(ui.etat().pleinEcran, false, `${nom} : revenu au plan, la tête est là`);
    }
  });

  test('ouvrirFiche(id) mène à la section participants et ouvre la fiche ; ouvrirFiche(null) la referme, la section reste', () => {
    const ui = creerEtatUi();
    ui.allerA('plan');
    ui.ouvrirFiche(7);
    assert.deepEqual(ui.etat(), { ...DEPART, section: 'participants', fiche: 7 });
    ui.allerA('tables');
    ui.ouvrirFiche(null);
    assert.deepEqual(ui.etat(), { ...DEPART, section: 'tables', fiche: null });
  });

  test('ouvrirFiche prend un identifiant entier positif ou null ; sinon RangeError sans rien changer', () => {
    const ui = creerEtatUi();
    ui.ouvrirFiche(3);
    const avant = ui.etat();
    for (const faute of [0, -2, 1.5, Number.NaN, '3', undefined]) {
      assert.throws(() => ui.ouvrirFiche(faute), RangeError, String(faute));
    }
    assert.equal(ui.etat(), avant);
  });

  test('garderAppartenance tient l’appartenance collante du formulaire d’ajout (§ 10.2) : elle survit au changement de section, et un autre événement repart vide', () => {
    const ui = creerEtatUi();
    ui.allerA('participants');
    ui.garderAppartenance('Club des Merles');
    assert.equal(ui.etat().appartenance, 'Club des Merles');
    ui.allerA('plan');
    ui.allerA('participants');
    ui.ouvrirApropos();
    ui.fermerApropos();
    assert.equal(ui.etat().appartenance, 'Club des Merles');
    ui.reinitialiser();
    assert.equal(ui.etat().appartenance, '');
    for (const faute of [null, undefined, 3, {}]) assert.throws(() => ui.garderAppartenance(faute), RangeError, String(faute));
    assert.equal(ui.etat().appartenance, '');
  });

  test('une transition qui ne change rien ne publie pas d’état neuf', () => {
    const { ui, recus } = suivi();
    ui.allerA(SECTION_OUVERTURE);
    ui.fermerApropos();
    ui.mettreEnEvidence(null);
    ui.ouvrirFiche(null);
    assert.equal(recus.length, 1);
  });
});

describe('état de navigation : la position du sélecteur du mélange des tables (§ 12.11, D54)', () => {
  test('la position part de « sièges », se règle sur chacune des trois, et ne publie rien quand elle ne change pas', () => {
    const { ui, recus } = suivi();
    assert.equal(ui.etat().melangeTables, 'sieges');
    for (const position of ['assis', 'doublons', 'sieges']) {
      ui.reglerMelangeTables(position);
      assert.deepEqual(ui.etat(), { ...DEPART, melangeTables: position });
    }
    const publies = recus.length;
    ui.reglerMelangeTables('sieges');
    assert.equal(recus.length, publies);
  });

  test('hors des trois positions, RangeError sans rien changer', () => {
    const ui = creerEtatUi();
    ui.reglerMelangeTables('assis');
    const avant = ui.etat();
    for (const faute of ['Sieges', 'doublon', '', null, undefined, 0, ['assis'], { position: 'assis' }]) {
      assert.throws(() => ui.reglerMelangeTables(faute), RangeError, JSON.stringify(faute));
    }
    assert.equal(ui.etat(), avant);
  });

  test('la position survit au changement de section, au tour montré et à la proposition demandée ; reinitialiser la rend à « sièges »', () => {
    const ui = creerEtatUi();
    ui.reglerMelangeTables('doublons');
    for (const section of SECTIONS) {
      ui.allerA(section);
      assert.equal(ui.etat().melangeTables, 'doublons', section);
    }
    ui.montrerTour(2);
    ui.montrerProposition(3);
    ui.ouvrirFiche(1);
    assert.equal(ui.etat().melangeTables, 'doublons');
    ui.reinitialiser();
    assert.equal(ui.etat().melangeTables, 'sieges');
  });
});

describe('état de navigation : le choix en attente (§ 5.8, § 7.1)', () => {
  const PERSONNE = { genre: 'personne', participant: 2, depuis: { table: 4, siege: 1 } };
  const DEPUIS_LA_RESERVE = { genre: 'personne', participant: 3, depuis: null };
  const RESERVATION = {
    genre: 'reservation',
    participant: 5,
    depuis: { table: 3, siege: 2 },
    de: { table: 3, portee: 'tous', tour: null },
  };

  test('choisir pose un choix de chaque genre, figé, puis null l’oublie', () => {
    const ui = creerEtatUi();
    for (const choix of [PERSONNE, DEPUIS_LA_RESERVE, RESERVATION]) {
      ui.choisir(choix);
      assert.deepEqual(ui.etat(), { ...DEPART, choix });
      assert.ok(Object.isFrozen(ui.etat().choix));
      ui.choisir(null);
      assert.deepEqual(ui.etat(), DEPART);
    }
  });

  test('un choix hors du contrat lève RangeError sans rien changer', () => {
    const ui = creerEtatUi();
    ui.choisir(PERSONNE);
    const avant = ui.etat();
    const fautes = [
      { genre: 'table', participant: 2, depuis: null },
      { genre: 'personne', participant: 0, depuis: null },
      { genre: 'personne', participant: '2', depuis: null },
      { genre: 'personne', participant: 2 },
      { genre: 'personne', participant: 2, depuis: { siege: 1 } },
      { genre: 'personne', participant: 2, depuis: { table: 1, siege: 0 } },
      { genre: 'reservation', participant: 5, depuis: { table: 3, siege: 2 } },
      { genre: 'reservation', participant: 5, depuis: null, de: { table: 3, portee: 'parfois', tour: null } },
      undefined,
    ];
    for (const faute of fautes) assert.throws(() => ui.choisir(faute), RangeError, JSON.stringify(faute));
    assert.equal(ui.etat(), avant);
  });

  test('montrerTour et selectionner(null) oublient le choix ; selectionner une place le garde', () => {
    const ui = creerEtatUi();
    ui.choisir(PERSONNE);
    ui.selectionner({ table: 2, siege: 3 });
    assert.deepEqual(ui.etat().choix, PERSONNE);
    ui.selectionner(null);
    assert.equal(ui.etat().choix, null);
    ui.choisir(RESERVATION);
    ui.montrerTour(2);
    assert.equal(ui.etat().choix, null);
    ui.choisir(PERSONNE);
    ui.montrerTour(2);
    assert.equal(ui.etat().choix, null, 'le même tour remontré oublie aussi');
  });

  test('poserSurPlace pose un refus ou des avertissements sur une place, puis null les retire ; aucune transition ne reçoit la séance', () => {
    const ui = creerEtatUi();
    const pose = {
      place: { table: 3, siege: null },
      refus: { code: 'PERSONNE_EXCLUE', details: { participant: 1 } },
      avertissements: [{ code: 'TABLE_GELEE', details: { table: 3 } }],
    };
    ui.poserSurPlace(pose);
    assert.deepEqual(ui.etat(), { ...DEPART, pose });
    assert.ok(Object.isFrozen(ui.etat().pose));
    ui.poserSurPlace(null);
    assert.deepEqual(ui.etat(), DEPART);
    assert.throws(() => ui.poserSurPlace({ place: null, refus: null, avertissements: [] }), RangeError);
    assert.equal(ui.choisir.length, 1);
    assert.equal(ui.poserSurPlace.length, 1);
  });

  test('montrerTour, montrerProposition et un changement de section retirent la pose ; la section remontrée la garde', () => {
    const ui = creerEtatUi();
    const pose = { place: { table: 7, siege: 1 }, refus: { code: 'PLACE_RESERVEE', details: { participant: 4 } }, avertissements: [] };
    ui.poserSurPlace(pose);
    ui.montrerTour(2);
    assert.equal(ui.etat().pose, null, 'montrerTour');
    ui.poserSurPlace(pose);
    ui.montrerProposition(1);
    assert.equal(ui.etat().pose, null, 'montrerProposition');
    ui.allerA('plan');
    ui.poserSurPlace(pose);
    ui.allerA('plan');
    assert.deepEqual(ui.etat().pose, pose, 'la même section');
    ui.allerA('tables');
    assert.equal(ui.etat().pose, null, 'une autre section');
  });
});

describe('état de navigation : l’aperçu avant impression (§ 11.7)', () => {
  test('ouvrirApercu ouvre la vue demandée au tour demandé, les listes du plan, la découpe proposée, la soirée en colonnes, et retient la section d’origine ; l’état est figé', () => {
    const ui = creerEtatUi();
    ui.allerA('propositions');
    ui.basculerListes();
    ui.ouvrirApercu({ vue: 'plan', tour: 2 });
    assert.deepEqual(ui.etat(), {
      ...DEPART,
      section: 'propositions',
      listes: false,
      apercu: { vue: 'plan', tour: 2, listes: false, decoupe: 'auto', parTour: false, retour: 'propositions' },
    });
    assert.ok(Object.isFrozen(ui.etat().apercu));
    ui.ouvrirApercu({ vue: 'accueil', tour: 'tous' });
    assert.deepEqual(ui.etat().apercu, { vue: 'accueil', tour: 'tous', listes: false, decoupe: 'auto', parTour: false, retour: 'propositions' });
  });

  test('ouvrirApercu refuse une vue inconnue, un tour qui n’est ni un entier positif ni « tous », et « tous » pour le plan, sans rien changer', () => {
    const ui = creerEtatUi();
    const avant = ui.etat();
    const fautes = [
      { vue: 'badges', tour: 1 },
      { vue: 'Plan', tour: 1 },
      { vue: 'plan', tour: 0 },
      { vue: 'plan', tour: 1.5 },
      { vue: 'plan', tour: '2' },
      { vue: 'plan', tour: 'tous' },
      { vue: 'tables', tour: null },
      { tour: 1 },
      null,
      undefined,
    ];
    for (const faute of fautes) assert.throws(() => ui.ouvrirApercu(faute), RangeError, JSON.stringify(faute));
    assert.equal(ui.etat(), avant);
  });

  test('reglerApercu change la vue, le tour, les listes, la découpe et la feuille par tour, chacun dans son domaine ; hors de lui, ou sans aperçu ouvert, RangeError sans rien changer', () => {
    const ui = creerEtatUi();
    assert.throws(() => ui.reglerApercu({ vue: 'accueil' }), RangeError);
    ui.ouvrirApercu({ vue: 'plan', tour: 1 });
    ui.reglerApercu({ tour: 3 });
    ui.reglerApercu({ listes: false, decoupe: 'unePage' });
    ui.reglerApercu({ vue: 'tables', parTour: true });
    assert.deepEqual(ui.etat().apercu, { vue: 'tables', tour: 3, listes: false, decoupe: 'unePage', parTour: true, retour: DEPART.section });
    assert.ok(Object.isFrozen(ui.etat().apercu));
    const avant = ui.etat();
    for (const faute of [
      { vue: 'badges' },
      { tour: 0 },
      { listes: 'oui' },
      { decoupe: 'deux' },
      { parTour: 1 },
      { retour: 'plan' },
      { inconnu: true },
      null,
    ]) {
      assert.throws(() => ui.reglerApercu(faute), RangeError, JSON.stringify(faute));
    }
    ui.reglerApercu({ vue: 'accueil', tour: 'tous' });
    assert.throws(() => ui.reglerApercu({ vue: 'plan' }), RangeError, 'le plan à « tous »');
    ui.reglerApercu({ vue: 'plan', tour: 2 });
    assert.equal(ui.etat().apercu.vue, 'plan');
    assert.notEqual(ui.etat(), avant);
  });

  test('fermerApercu ferme l’aperçu et rend la section d’où il s’est ouvert ; fermé, il ne publie rien', () => {
    const { ui, recus } = suivi();
    ui.allerA('participants');
    ui.ouvrirApercu({ vue: 'plan', tour: 1 });
    ui.fermerApercu();
    assert.deepEqual(ui.etat(), { ...DEPART, section: 'participants' });
    const publies = recus.length;
    ui.fermerApercu();
    assert.equal(recus.length, publies);
  });

  test('fermerApercu rend la section d’origine même quand une autre s’est ouverte pendant l’aperçu — par le remède d’un refus', () => {
    const ui = creerEtatUi();
    ui.allerA('tables');
    ui.ouvrirApercu({ vue: 'accueil', tour: 'tous' });
    ui.allerA('propositions');
    ui.fermerApercu();
    assert.equal(ui.etat().section, 'tables');
    assert.equal(ui.etat().apercu, null);
  });

  test('reinitialiser ferme l’aperçu : un autre événement s’ouvre sur sa section d’ouverture', () => {
    const ui = creerEtatUi();
    ui.ouvrirApercu({ vue: 'tables', tour: 'tous' });
    ui.reinitialiser();
    assert.equal(ui.etat().apercu, null);
  });
});

describe('état de navigation : le départ, le second placement et la vue demandée (§ 5.7, § 8.4, § 12, C6, C9, C14)', () => {
  test('le départ et le second placement repartent à l’ouverture d’un événement, et un changement de section les garde', () => {
    const ui = creerEtatUi();
    ui.choisirDepart(4);
    ui.reglerToursFiges([2, 1]);
    ui.comparerA(7);
    ui.demanderVueQualite('comparaison');
    const tenu = { depart: { id: 4, toursFiges: [1, 2] }, comparee: 7, vueQualite: 'comparaison' };
    for (const section of SECTIONS) {
      ui.allerA(section);
      assert.deepEqual(ui.etat(), { ...DEPART, section, ...tenu }, section);
    }
    ui.montrerTour(2);
    ui.montrerProposition(3);
    ui.ouvrirFiche(1);
    ui.ouvrirApropos();
    assert.deepEqual([ui.etat().depart, ui.etat().comparee, ui.etat().vueQualite], [tenu.depart, 7, 'comparaison']);
    ui.reinitialiser();
    assert.deepEqual(ui.etat(), { ...DEPART, apropos: true });
  });

  test('choisirDepart pose le départ, ses cases toutes décochées, figé ; chaque choix — un autre départ, ou le même — décoche les cases', () => {
    const ui = creerEtatUi();
    ui.choisirDepart(4);
    assert.deepEqual(ui.etat(), { ...DEPART, depart: { id: 4, toursFiges: [] } });
    assert.ok(Object.isFrozen(ui.etat().depart));
    assert.ok(Object.isFrozen(ui.etat().depart.toursFiges));
    ui.reglerToursFiges([1, 3]);
    ui.choisirDepart(9);
    assert.deepEqual(ui.etat().depart, { id: 9, toursFiges: [] });
    ui.reglerToursFiges([2]);
    ui.choisirDepart(9);
    assert.deepEqual(ui.etat().depart, { id: 9, toursFiges: [] });
  });

  test('choisirDepart refuse un identifiant qui n’est pas un entier ≥ 1, par RangeError, sans rien changer', () => {
    const ui = creerEtatUi();
    ui.choisirDepart(2);
    ui.reglerToursFiges([1]);
    const avant = ui.etat();
    for (const faute of [0, -1, 1.5, Number.NaN, '4', null, undefined, 'retenu', [4]]) {
      assert.throws(() => ui.choisirDepart(faute), RangeError, String(faute));
    }
    assert.equal(ui.etat(), avant);
  });

  test('reglerToursFiges garde une liste d’entiers ≥ 1 distincts, croissante et figée ; dix tours ; la liste vide décoche tout ; la même liste ne publie rien', () => {
    const { ui, recus } = suivi();
    ui.choisirDepart(5);
    const dix = [10, 9, 8, 7, 6, 5, 4, 3, 2, 1];
    ui.reglerToursFiges(dix);
    assert.deepEqual(ui.etat().depart, { id: 5, toursFiges: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
    assert.ok(Object.isFrozen(ui.etat().depart.toursFiges));
    assert.deepEqual(dix, [10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 'la liste reçue reste telle');
    const publies = recus.length;
    ui.reglerToursFiges([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    assert.equal(recus.length, publies);
    ui.reglerToursFiges([]);
    assert.deepEqual(ui.etat().depart, { id: 5, toursFiges: [] });
  });

  test('reglerToursFiges refuse, par RangeError et sans rien changer, une liste hors du contrat, et toute liste sans départ choisi', () => {
    const sansDepart = creerEtatUi();
    assert.throws(() => sansDepart.reglerToursFiges([1]), RangeError);
    assert.throws(() => sansDepart.reglerToursFiges([]), RangeError);
    assert.deepEqual(sansDepart.etat(), DEPART);
    const ui = creerEtatUi();
    ui.choisirDepart(3);
    ui.reglerToursFiges([2]);
    const avant = ui.etat();
    for (const faute of [[0], [1, 1], [2, 1, 2], [1.5], ['2'], [-1], [Number.NaN], [null], null, undefined, 2, '1,2', { 0: 1, length: 1 }]) {
      assert.throws(() => ui.reglerToursFiges(faute), RangeError, JSON.stringify(faute));
    }
    assert.equal(ui.etat(), avant);
  });

  test('retirerDepart retire le départ et ses cases ; sans départ, il ne publie rien', () => {
    const { ui, recus } = suivi();
    ui.retirerDepart();
    assert.equal(recus.length, 1);
    ui.choisirDepart(6);
    ui.reglerToursFiges([1]);
    ui.retirerDepart();
    assert.deepEqual(ui.etat(), DEPART);
  });

  test('comparerA pose le second placement — un identifiant, le retenu, ou null pour le défaut — ; hors de là, RangeError sans rien changer', () => {
    const ui = creerEtatUi();
    ui.comparerA(12);
    assert.deepEqual(ui.etat(), { ...DEPART, comparee: 12 });
    ui.comparerA('retenu');
    assert.equal(ui.etat().comparee, 'retenu');
    ui.comparerA(null);
    assert.deepEqual(ui.etat(), DEPART);
    ui.comparerA(3);
    const avant = ui.etat();
    for (const faute of [0, -3, 2.5, '3', 'Retenu', '', undefined, {}, ['retenu']]) {
      assert.throws(() => ui.comparerA(faute), RangeError, JSON.stringify(faute));
    }
    assert.equal(ui.etat(), avant);
  });

  test('demanderVueQualite pose la vue demandée, vueQualiteAtteinte la retire ; une vue que la page ne demande pas lève RangeError sans rien changer', () => {
    const { ui, recus } = suivi();
    ui.demanderVueQualite('comparaison');
    assert.deepEqual(ui.etat(), { ...DEPART, vueQualite: 'comparaison' });
    ui.vueQualiteAtteinte();
    assert.deepEqual(ui.etat(), DEPART);
    const publies = recus.length;
    ui.vueQualiteAtteinte();
    assert.equal(recus.length, publies);
    for (const faute of ['profil', 'Comparaison', null, undefined, '']) {
      assert.throws(() => ui.demanderVueQualite(faute), RangeError, String(faute));
    }
    assert.deepEqual(ui.etat(), DEPART);
  });

  test('oublierAbsents retire le départ absent de la liste et le second placement absent — un identifiant absent, ou le retenu sans retenu — ; rien d’autre', () => {
    const ui = creerEtatUi();
    ui.montrerProposition(9);
    ui.choisirDepart(4);
    ui.reglerToursFiges([2]);
    ui.comparerA(7);
    ui.oublierAbsents({ propositions: [4, 7], retenu: false });
    assert.deepEqual([ui.etat().depart, ui.etat().comparee], [{ id: 4, toursFiges: [2] }, 7], 'présents : gardés');
    ui.oublierAbsents({ propositions: [7, 8], retenu: true });
    assert.deepEqual([ui.etat().depart, ui.etat().comparee], [null, 7], 'le départ effacé');
    ui.oublierAbsents({ propositions: [], retenu: true });
    assert.equal(ui.etat().comparee, null, 'le second placement effacé');
    ui.comparerA('retenu');
    ui.oublierAbsents({ propositions: [], retenu: true });
    assert.equal(ui.etat().comparee, 'retenu', 'le retenu présent : gardé');
    ui.oublierAbsents({ propositions: [1, 2, 3], retenu: false });
    assert.equal(ui.etat().comparee, null, 'le retenu parti');
    assert.deepEqual(ui.etat(), { ...DEPART, proposition: 9, visee: 1 }, 'la proposition montrée ne se retire pas ici');
  });

  test('oublierAbsents ne publie rien quand rien n’est absent, et ne rend jamais ce qu’il a retiré', () => {
    const { ui, recus } = suivi();
    ui.choisirDepart(2);
    ui.comparerA('retenu');
    const publies = recus.length;
    ui.oublierAbsents({ propositions: [1, 2], retenu: true });
    assert.equal(recus.length, publies);
    ui.oublierAbsents({ propositions: [1], retenu: false });
    ui.oublierAbsents({ propositions: [1, 2], retenu: true });
    assert.deepEqual([ui.etat().depart, ui.etat().comparee], [null, null]);
  });

  test('oublierAbsents refuse ce qui n’est pas {propositions: identifiants, retenu: booléen}, par RangeError, sans rien changer', () => {
    const ui = creerEtatUi();
    ui.choisirDepart(2);
    const avant = ui.etat();
    for (const faute of [null, undefined, {}, { propositions: [2] }, { propositions: null, retenu: false }, { propositions: [2], retenu: 1 }, { propositions: '2', retenu: true }]) {
      assert.throws(() => ui.oublierAbsents(faute), RangeError, JSON.stringify(faute));
    }
    assert.equal(ui.etat(), avant);
  });
});

describe('état de navigation : chaque vue demandable porte son <div data-vue-qualite> littéral (§ 12.10.6, D55)', () => {
  const source = (nom) => readFileSync(new URL(`./qualite/${nom}`, import.meta.url), 'utf8');
  // Le composant de chaque vue demandable, sous son nom de fichier.
  const COMPOSANTS = new Map([['comparaison', 'VueComparaison.svelte']]);

  // demanderVueQualite mène à l'élément qui porte data-vue-qualite à son nom :
  // le gabarit s'ouvre sur ce <div>, hors de tout bloc conditionnel, et c'est
  // le seul élément à porter ce nom. Ce que le <div> contient est libre.
  test('chaque vue demandable — la comparaison — : le gabarit s’ouvre sur un <div data-vue-qualite> littéral à son nom, seul à le porter', () => {
    assert.deepEqual(VUES_QUALITE_DEMANDABLES, [...COMPOSANTS.keys()]);
    for (const nom of VUES_QUALITE_DEMANDABLES) {
      const texte = source(COMPOSANTS.get(nom));
      const gabarit = texte.slice(texte.lastIndexOf('</script>') + '</script>'.length);
      assert.match(gabarit, new RegExp(`^(?:\\s|<!--[^]*?-->)*<div data-vue-qualite="${nom}">`), nom);
      assert.equal(gabarit.split(`data-vue-qualite="${nom}"`).length, 2, nom);
    }
  });
});
